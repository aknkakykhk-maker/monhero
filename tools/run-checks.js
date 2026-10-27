// 検査を「領域」ごとにまとめて回すための入口。
//
//   node tools/run-checks.js --list                 … 領域と、その中の検査を一覧する
//   node tools/run-checks.js --area required        … CLAUDE.md の必須検査(本体を触ったら必ず通すもの)
//   node tools/run-checks.js --area ci              … compiled-check.yml が回すものと同じ並び
//   node tools/run-checks.js --area battle,masu     … フォルダ単位(tools/<分類>/ の *-check.js)
//   node tools/run-checks.js --area all             … 全部(30分以上かかる)
//   node tools/run-checks.js --changed              … いま変更しているファイルから、要る検査だけを選んで回す
//   node tools/run-checks.js --changed --plan       … 選んだ検査を出すだけ(実行しない)
//   node tools/run-checks.js --area always          … いつも回す短い検査(run-checks-always.json。--changed でも毎回回す)
//   node tools/run-checks.js --measure-always       … いつも回す短い検査の一覧を測り直して書き直す(ブラウザを使わず1秒未満で通るもの)
//   オプション: --limit N(選ぶ上限。既定40) --wide(当たった領域を丸ごと) --base <ref>(そのrefとの差も見る)
//   オプション: --skip-file <ファイル>(1行1検査。# で始まる行は無視。その検査を回さない)
//   オプション: --no-server(実ブラウザ検査用の配信を起動しない) --timeout <秒> --json <出力先>
//   node tools/run-checks.js --area all --parallel 5 … 全部を5組に分けて同時に回す(1時間弱)(2026-10-23。1本ずつだと2時間を超える)
//     組は前回かかった時間(run-checks-times.json)で平らに分ける。同じポートを使う検査は同じ組へ、
//     自分で :8899 を立てる検査と時間を測る検査(perf・fps など)は、最後に1本ずつ回す。結果は1つにまとめて出す
//     --save-times を付けると、今回かかった時間で run-checks-times.json を書き直す
//
// 【なぜ要るか】
// 検査は 300 本以上あるが CI で回るのは 28 本だけで、残りは担当者が変更範囲を見て手で選んでいた。
// 構造を直す作業では「どこに響いたか」が事前に分からないので、領域ごと・あるいは全部を
// 1 コマンドで回して OK / NG / SKIP を集計できる入口が要る(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 1)。
//
// 【決めごと】
// ・検査の中身や判定は一切変えない。ここは既存のスクリプトを順に呼ぶだけ。
// ・領域の中身はできるだけ「探して決める」。フォルダの *-check.js を集め、ci は yml を読む。
//   一覧を手で写すと、検査を足したときにここへ書き忘れて「回っているつもり」になる。
// ・ふつうは並列にしない。実ブラウザ検査が固定ポート(8899 / 8977 など)を使うため、ぶつかる。
//   --parallel N のときだけ、ぶつからない組に分けて同時に回す(共有の配信 :8899 は親が1つ立てて、全部の組で使う)。
// ・playwright が入っていない環境では、それを要る検査を SKIP として数える(NG にはしない)。react・canvas も同じ。
// ・既存の GitHub Actions は触らない。CI に何を足すかは、この結果(所要時間)を見て別途決める。
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const TOOLS_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const SERVER_PORT = 8899;

// CLAUDE.md ⑤⑥ が「触ったら必ず通す」と決めているもの。build.js は --check で呼ぶ
// (ここで本ビルドをすると version が進んでしまうため)。
const REQUIRED = [
  'build.js --check',
  'check-syntax.js',
  'undefined-reference-check.js',
  'jsx-text-brace-check.js',
  'render-error-check.js',
  'compiled-runtime-check.js',
  'help-coverage-check.js',
  'help-guide-check.js',
  'help-render-check.js',
  'assistant-check.js',
  'assistant-bond-check.js',
  'boot/market-notice-check.js',
  'assistant/assistant-update-notice-check.js',
  // 更新履歴が「作業報告」になっていないか(2026-09-18・ユーザー指摘
  // 「更新情報はよくあーいう形になってるから、今後はプレイヤー向けに出すようにして」)。
  // 書き忘れと違って画面はふつうに動いてしまうので、必須に入れて毎回通す
  'changelog/player-words-check.js',
  'image-asset-check.js',
];

// 名前は *-check.js ではないが、CI や運用で「検査」として使っているもの
const EXTRA_CHECKS = {
  mode: ['rhythm-easy-alignment-audit.js', 'rhythm-easy-ear-review-plan.js', 'rhythm-note-geometry-audit.js'],
};

// ---- 変更ファイルから、要る検査だけを選ぶ ----------------------------------------
// 「どの検査を通すか」を毎回その場で考えると、打ち漏らす(精度が落ちる)か、
// 念のため全部回す(時間を食う)のどちらかになる。機械に選ばせて、選んだ理由も出す。
//
// フォルダ(領域)を丸ごと足すと mode だけで 184 本になって実用にならないので、
// 変更したファイル名から語を取り出し、その語を名前に含む検査だけを拾う。
// 広げたいときは --changed --wide（領域を丸ごと）か --area <名前>。

// build.js が作り直すぶん。これだけが変わっていても検査を増やす理由にはならない
const GENERATED_RE = /(^|\/)(game-system\.jsx|game-system\.compiled\.js|tailwind\.css|version\.json|package-lock\.json)$/;

// ゲーム本体・データが変わったら、CLAUDE.md ⑥ の必須検査は必ず通す
const CORE_RE = /^monster-hero\/(src\/parts\/|data\/|index\.html$|images\/)/;

// ファイル名から取り出しても検査の絞り込みに効かない語
const GENERIC_TOKENS = new Set([
  'monster', 'hero', 'src', 'parts', 'data', 'screen', 'index', 'main', 'app', 'core', 'util', 'utils',
  'js', 'jsx', 'css', 'html', 'json', 'png', 'jpg', 'mp3', 'md', 'check', 'tools', 'test', 'tmp', 'probe',
]);

// ファイル名では拾えない結び付き（変えたもの → 一緒に見ておきたい語）
const EXTRA_TOKENS = [
  { re: /^monster-hero\/audio\//, add: ['bgm', 'loudness', 'boot'] },
  { re: /^monster-hero\/images\/song-art\//, add: ['song-art', 'changelog', 'boot'] },
  { re: /^monster-hero\/images\//, add: ['image-asset', 'boot'] },
  { re: /^monster-hero\/data\/changelog\.js$/, add: ['notice', 'update-notice'] },
  { re: /^monster-hero\/data\/help\.js$/, add: ['help'] },
  { re: /^monster-hero\/data\/assistants\.js$/, add: ['assistant', 'bond'] },
  { re: /^monster-hero\/data\/rhythm-/, add: ['rhythm', 'chart', 'song'] },
  { re: /^monster-hero\/index\.html$/, add: ['boot'] },
  { re: /^tools\/([a-z-]+)\//, add: m => [m[1]] },
];

// ファイル名の語では拾えないので、検査そのものを名指しするもの
// いつも回す短い検査(2026-10-12)。ファイル名の語で選ぶ仕組みでは、名前の語が当たらない検査が素通りする
// (同じ日に quick-extreme-special-rules-check と save-keys-check が main で落ちたまま気づかれなかった)。
// ブラウザを使わず1本1秒未満で通るものは、変更の中身に関係なく毎回回す。一覧は --measure-always で作り直す
const ALWAYS_FILE = path.join(TOOLS_DIR, 'run-checks-always.json');
function alwaysChecks() {
  try { const j = JSON.parse(fs.readFileSync(ALWAYS_FILE, 'utf8')); return Array.isArray(j.checks) ? j.checks.filter(c => typeof c === 'string' && fs.existsSync(path.join(TOOLS_DIR, c.split(' ')[0]))) : []; }
  catch { return []; }
}
const FORCE_CHECKS = [
  // 保存キー(mh_*)は docs/spec/SAVE_DATA.md の一覧に載せる決まり。本体・データを触ったら必ず確かめる
  // (2026-10-12・新しいキーを一覧に書き忘れて main で落ちた。ファイル名の語では拾えない)
  { re: /^monster-hero\/(src\/parts\/.+\.jsx|data\/.+\.js|index\.html)$|^docs\/spec\/SAVE_DATA\.md$/, checks: ['boot/save-keys-check.js'], why: '保存キーが SAVE_DATA.md の一覧に載っているか' },
  { re: /^monster-hero\/(sw\.js|src\/parts\/25-asset-cache\.jsx)$|^tools\/(build|stamp-version|stamp-game-build|build-asset-manifest)\.js$|^tools\/boot\/code-prefetch-check\.js$/, checks: ['boot/code-prefetch-check.js'], why: '新しい版を出したら必ず新しい本体が動くか(事前ダウンロードの JS・CSS)' },
  { re: /^(CLAUDE|AGENTS|README)\.md$|^docs\/|^\.claude\/skills\//, checks: ['rules-index-check.js'], why: 'ルールと資料' },
  // 新モード(tactics)の分岐が入っているファイル。ファイル名の語(app・parts)では拾えないので名指しする。
  // 「isTacticsMode で締めたつもり」が既存5モードへ漏れると、遊んでいる人の記録に直に効く
  { re: /^monster-hero\/src\/parts\/(10-core|22-enemy-and-bond-entries|32-tactics-units|60-app|71-screen-battle)\.jsx$/,
    checks: ['battle/legacy-mode-parity-check.js'], why: '新モードの分岐が既存5モードへ漏れていないか' },
  // モンヒロバトルの入口(仕組み → モード → 難易度)。導線を1本でも切ると遊べなくなるのに、
  // ファイル名の語(app・home・core)では拾えないので名指しする
  { re: /^monster-hero\/(src\/parts\/(10-core|60-app|69-screen-home)\.jsx|data\/(help|assistants)\.js)$/,
    checks: ['battle/battle-system-select-check.js'], why: 'モンヒロバトルの入口と導線' },
  // 5人目の助手あつの解放(仲良し度 → お話 → 選べる)。公開の印・お話の流し方・一覧の出し分けは実ブラウザでないと通らない(2026-10-22)
  { re: /^monster-hero\/(src\/parts\/(10-core|17-release-changelog-login-missions|56-screen-profile|60-app)\.jsx|data\/assistants\.js)$/,
    checks: ['assistant/atsu-unlock-browser-check.js'], why: 'あつの解放の流れ(公開の印・お話・選ぶ画面)' },
  // 入口のカードは、行を1つ足すだけで小さい端末から簡単にあふれる。
  // あふれてもエラーは出ず、大きい端末では気づけない(2026-09-21・ユーザー報告)
  { re: /^monster-hero\/src\/parts\/(10-core|60-app)\.jsx$/,
    checks: ['battle/battle-system-fit-check.js'], why: 'バトルの入口が1画面に収まるか' },
  // モード選択のカードも同じ。名前を1つ長くするだけで見出しが2行になり、
  // カードの中のボタンの文字が横にあふれて切れる(2026-09-21・ユーザー報告)
  { re: /^monster-hero\/src\/parts\/(10-core|60-app)\.jsx$/,
    checks: ['battle/battle-mode-card-fit-check.js'], why: 'モード選択のカードが崩れていないか' },
  // ヘルプの🆕(2026-10-18)。added を書き忘れても、印の出し方を壊してもエラーは出ない
  { re: /^monster-hero\/(data\/help\.js|src\/parts\/(19-difficulties-and-rules|60-app)\.jsx)$/,
    checks: ['boot/help-new-badge-check.js'], why: 'ヘルプの新しい項目に🆕が付き、開くと消えるか' },
  // 敵の並びは2本ある(クラシック・クイック / タクティクス)。混ざると、いま遊んでいる人の
  // チャレンジ・プロの手ごたえが静かに変わる。ファイル名の語では拾えないので名指しする
  { re: /^monster-hero\/(data\/(enemy-monsters|images\/images-enemy)\.js|src\/parts\/(22-enemy-and-bond-entries|60-app)\.jsx)$/,
    checks: ['mode/tactics-enemies-check.js', 'mode/tactics-enemy-actions-check.js'],
    why: 'タクティクス専用の敵が既存の並びと混ざっていないか／敵ごとの技名と行動表' },
  // タクティクスの導入会話。公開前に回想の一覧へ出てしまうと、まだ見せていないモードの
  // 名前と中身がそこから丸ごと見える。一覧に並ぶだけなのでエラーは出ず、気づけない
  { re: /^monster-hero\/(data\/assistants\.js|src\/parts\/(10-core|56-screen-profile|60-app)\.jsx)$/,
    checks: ['assistant/tactics-intro-story-check.js'], why: 'タクティクスの導入会話と、回想の出し分け' },
  // タクティクスのWAVEごとのBGM(通常戦・中ボス戦・ボス戦)を鳴らし分ける結線。
  // 判定の順番を1つ動かすだけでプロや種族の枠へ落ちるのに、
  // ファイル名の語(app・settings)では拾えないので名指しする
  { re: /^monster-hero\/(src\/parts\/(13-bgm-and-rhythm-settings|60-app)\.jsx|audio\/bgm-(senjou-no-shippuu|makutsu-no-senritsu)\.mp3)$/,
    checks: ['audio/tactics-bgm-check.js'], why: 'タクティクスのWAVEごとのBGM' },
  // ラスボスの見せ方(丸枠の外の巨大な立ち絵・専用の演出)。id を画面のあちこちへ
  // 直に書いて出し分けていたため、覚醒ムーが演出の分岐から丸ごと漏れていた。
  // 絵は出るしバトルも終わるので、WAVE10まで進めて目で見るまで気づけない
  { re: /^monster-hero\/src\/parts\/(22-enemy-and-bond-entries|60-app|71-screen-battle)\.jsx$/,
    checks: ['battle/moo-boss-presentation-check.js'], why: 'ラスボスの見せ方(ムー・覚醒ムー)' },
  // 「次に鳴る曲を、鳴り出す前に読んでおく」導線。外れても画面はふつうに動くし、
  // 手元の速い回線では鳴り出しの差が分からない。曲を入れ替えたときにだけ表に出る
  // (2026-09-21・ユーザー報告「通常バトル曲のBGMの入りが遅い」)
  { re: /^monster-hero\/src\/parts\/60-app\.jsx$/,
    checks: ['audio/bgm-preload-check.js'], why: '次に鳴る曲を先に読んでおく導線' },
  // 画面を足したときのBGMの決め忘れ。対応表へ載せ忘れてもエラーは出ず、
  // その画面だけ静かに無音になるので、遊んだ人が言うまで気づけない(2回やっている)
  { re: /^monster-hero\/src\/parts\/60-app\.jsx$/,
    checks: ['boot/bgm-screen-coverage-check.js'], why: '画面ごとのBGMの決め忘れ' },
  // タクティクスバトルの中のモード(記録・ランキング・極限タブ)。
  // まちがえるとチャレンジの自己ベストとクリア回数を上書きするのに、
  // ファイル名の語(core・app・difficulties・supabase)では拾えないので名指しする
  { re: /^monster-hero\/src\/parts\/(10-core|19-difficulties-and-rules|26-supabase|56-screen-profile|60-app)\.jsx$/,
    checks: ['mode/tactics-modes-check.js'], why: 'タクティクスの記録・ランキング・極限タブ' },
  // 譜面(data/rhythm-mode.js)を触ったら、終点フリックの置き場所は必ず見る。
  // 語の当たりだけでは本数の上限で落ちることがあり、曲を足した回だけ静かに見逃す(2026-09-18)
  // 横画面ボタン(絵だけ90度回す)のあいだは器の高さが端末の横幅になる。--mh-vh のままだと
  // ダイアログが器より高くなり「閉じる」に届かない(2026-10-06・プレイボットが発見)
  { re: /^monster-hero\/src\/parts\/(28-rhythm-shared|30-rhythm-play|58-screen-rhythm)\.jsx$/,
    checks: ['mode/rhythm-rotated-dialog-height-check.js'], why: '横画面でもダイアログが器に収まるか' },
  { re: /^monster-hero\/data\/rhythm-mode\.js$/, checks: ['mode/rhythm-end-flick-swing-check.js'], why: '譜面の終点フリックの置き場所' },
  // バトルの演出は「出す→待つ→消す」。ランを片付けると**消すほうへ到達しない**ので、
  // 片付けで捨て忘れると次のランの画面に残る(2026-09-20・誰もいない間合いに技名が出た)
  { re: /^monster-hero\/src\/parts\/60-app\.jsx$/, checks: ['battle/run-abandon-fx-check.js'], why: 'ランを片付けたときの演出' },
  // バトル画面の重さ(2026-09-28)。飾りの CSS は 70-bootstrap に、見張りは 71-screen-battle にある。
  // 描き直しになる書き方・マスクは手元の速い端末では分からず、iPhone で熱くなってから気づく(2026-09-24〜25 に踏んだ)
  { re: /^monster-hero\/src\/parts\/(10-core|13-bgm-and-rhythm-settings|70-bootstrap|71-screen-battle)\.jsx$/,
    checks: ['battle/battle-fx-lint-check.js'], why: 'バトルの飾りの書き方(描き直し・マスク)と重さの見張り' },
  { re: /^monster-hero\/src\/parts\/(10-core|60-app|67-screen-pick|68-screen-run-result|70-bootstrap|71-screen-battle)\.jsx$/,
    checks: ['battle/battle-perf-budget-check.js'], why: 'バトル画面の重さの予算と「重いときは自動で軽く」' },
  // 入力の割り当て(rhythmMatchInputBatch)は、片側を直すともう片側が静かに壊れる。
  // 2026-09-18、持ち替えの直しが「押さえている上に重なるノーツを叩けない」を生んだ
  { re: /^monster-hero\/data\/rhythm-mode\.js$/, checks: ['mode/rhythm-tap-during-hold-check.js', 'mode/rhythm-finger-swap-check.js'], why: '押さえながら叩く・指の持ち替え' },
  // 公開中の全譜面の中身を見張る検査(どれも1〜8秒)。「rhythm」「mode」の語は300本以上に当たるので、
  // 上限40本で落ちて素通りしていた。2026-10-12、ノーツを1つ動かしたら「押せない近さの2音」が出たのに
  // rhythm-overlap-reach-check が選ばれず、main で NG になった(#2808 → #2821 で戻した)
  { re: /^monster-hero\/data\/rhythm-mode\.js$/,
    checks: ['mode/rhythm-overlap-reach-check.js', 'mode/rhythm-note-reach-check.js', 'mode/rhythm-released-chart-lock-check.js',
      'mode/rhythm-monster-four-check.js', 'mode/rhythm-slide-start-lane-check.js', 'mode/rhythm-expert-master-order-check.js', 'mode/rhythm-chart-hand-rules-check.js'],
    why: '公開中の譜面の中身(押せない配置・取れないノーツ・指紋・モンスターノーツ4個・スライドの始まり・EXPERT と MASTER の順・手の決まり)' },
];

function tokensOf(file) {
  const rel = file.replace(/^monster-hero\//, '').replace(/\.[^./]+$/, '');
  const out = new Set();
  // tools/ 直下のスクリプト名と、資料(.md)からは語を取らない。
  // run / where / rules のような一般的な語が、無関係な検査に当たってしまう。
  if (!/^tools\/[^/]+$/.test(file) && !/^docs\//.test(file) && !/^[^/]+\.md$/.test(file)) {
    for (const t of rel.split(/[/\-_.]+/)) {
      const w = t.toLowerCase();
      if (w.length < 3 || GENERIC_TOKENS.has(w) || /^\d+$/.test(w)) continue;
      out.add(w);
    }
  }
  for (const rule of EXTRA_TOKENS) {
    const m = rule.re.exec(file);
    if (!m) continue;
    for (const a of (typeof rule.add === 'function' ? rule.add(m) : rule.add)) out.add(a);
  }
  return [...out];
}

function changedFiles(base) {
  const run = args => {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    return (r.stdout || '').split('\n').filter(l => l.length);
  };
  const out = new Set();
  // porcelain は「XY<空白>パス」。先に trim すると状態の記号を消しそこねる
  for (const l of run(['status', '--porcelain', '-uall'])) out.add(l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
  if (base) for (const f of run(['diff', '--name-only', `${base}...HEAD`])) out.add(f.trim());
  return [...out].filter(Boolean);
}

function checkTokens(command) {
  return new Set(command.replace(/\.[^./]+$/, '').split(/[/\-_.\s]+/).map(t => t.toLowerCase()).filter(Boolean));
}

// 変更から「通す検査の並び」を作る。
// 語が当たる検査が多いほど、その語は大まかだということなので、当たりの少ない語から順に並べる。
// 上限で切ったぶんは必ず本数を出す（黙って減らすと「全部通した」と読めてしまう）。
function planForChanges(files, areas, wide, limit) {
  const core = files.some(f => !GENERATED_RE.test(f) && CORE_RE.test(f));
  const reasons = new Map();      // 検査 -> なぜ選ばれたか
  const rank = new Map();         // 検査 -> 当たった語の大まかさ（小さいほど的確）
  const allChecks = [];
  for (const [name, list] of areas) if (!['required', 'ci'].includes(name)) for (const c of list) if (!allChecks.includes(c)) allChecks.push(c);
  const tokenIndex = allChecks.map(c => ({ c, t: checkTokens(c), area: c.includes('/') ? c.split('/')[0] : 'root' }));

  const hitAreas = new Set();
  for (const f of files) {
    if (GENERATED_RE.test(f)) continue;
    // 検査スクリプト自身を直したときは、その検査を回す。
    // ファイル名から語を取る仕組みでは拾えず、直した本人だけが素通りしていた。
    const self = /^tools\/(.+\.js)$/.exec(f);
    if (self && allChecks.includes(self[1])) { reasons.set(self[1], `この検査自体を変えた（${f}）`); rank.set(self[1], 0); }
    for (const rule of FORCE_CHECKS) {
      if (!rule.re.test(f)) continue;
      for (const c of rule.checks) if (!reasons.has(c)) { reasons.set(c, `${rule.why}（${f}）`); rank.set(c, 0); }
    }
    for (const token of tokensOf(f)) {
      const matched = tokenIndex.filter(x => x.t.has(token));
      for (const x of matched) {
        hitAreas.add(x.area);
        if (!reasons.has(x.c) || matched.length < rank.get(x.c)) { reasons.set(x.c, `${token}（${f}）`); rank.set(x.c, matched.length); }
      }
    }
  }
  if (wide) {
    for (const a of hitAreas) for (const c of areas.get(a) || []) if (!reasons.has(c)) { reasons.set(c, `領域 ${a} を丸ごと（--wide）`); rank.set(c, 9999); }
  }
  const required = core ? areas.get('required').slice() : [];
  for (const c of required) if (!reasons.has(c)) reasons.set(c, 'ゲーム本体を触った（CLAUDE.md ⑥ の必須検査）');
  // いつも回す短い検査(上限の数には入れない)。生成物だけの変更では足さない
  if (files.some(f => !GENERATED_RE.test(f))) for (const c of areas.get('always') || []) if (!required.includes(c)) { required.push(c); if (!reasons.has(c)) reasons.set(c, 'いつも回す短い検査（run-checks-always.json）'); }
  const rest = [...reasons.keys()].filter(c => !required.includes(c))
    .sort((a, b) => (rank.get(a) - rank.get(b)) || a.localeCompare(b));
  // 上限(--limit)から引くのは必須検査だけ。いつも回す短い検査は数に入れない
  const room = wide ? rest.length : Math.max(0, limit - (core ? areas.get('required').length : 0));
  const picked = [...required, ...rest.slice(0, room)];
  return { picked, reasons, core, dropped: rest.length - Math.min(room, rest.length) };
}

function parseArgs(argv) {
  const opts = { areas: [], list: false, server: true, timeoutSec: 600, json: null, changed: false, plan: false, wide: false, base: null, limit: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--changed') opts.changed = true;
    else if (a === '--plan' || a === '--dry-run') opts.plan = true;
    else if (a === '--measure-always') opts.measureAlways = true;
    else if (a === '--wide') opts.wide = true;
    else if (a === '--limit') opts.limit = Number(argv[++i]) || opts.limit;
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--no-server') opts.server = false;
    else if (a === '--area') opts.areas.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (a === '--timeout') opts.timeoutSec = Number(argv[++i]) || opts.timeoutSec;
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--skip-file') opts.skipFile = String(argv[++i] || '');
    else if (a === '--parallel') opts.parallel = Math.max(1, Math.min(8, Number(argv[++i]) || 4));
    else if (a === '--save-times') opts.saveTimes = true;
    else if (a === '--lane') opts.lane = String(argv[++i] || '');
    else if (a === '--script') opts.scripts = (opts.scripts || []).concat(String(argv[++i] || '').split(',').filter(Boolean));
    else if (a.startsWith('--area=')) opts.areas.push(...a.slice(7).split(',').filter(Boolean));
    else if (!a.startsWith('--')) opts.areas.push(a);
  }
  return opts;
}

function ciCommands() {
  // compiled-check.yml の `node tools/...` 行をそのまま拾う。yml を正本にするため、ここには書き写さない
  const yml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/compiled-check.yml'), 'utf8');
  const out = [];
  for (const line of yml.split('\n')) {
    const m = line.match(/^\s*(?:-\s*)?(?:run:\s*)?node tools\/(\S+)(\s+--\S+)?\s*$/);
    if (m) out.push((m[1] + (m[2] || '')).trim());
  }
  return out;
}

function discoverAreas() {
  const areas = new Map();
  areas.set('required', REQUIRED.slice());
  areas.set('ci', ciCommands());
  areas.set('docs', ['rules-index-check.js']);
  areas.set('always', alwaysChecks());
  const rootChecks = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('-check.js')).sort();
  areas.set('root', rootChecks);
  for (const dir of fs.readdirSync(TOOLS_DIR).sort()) {
    const full = path.join(TOOLS_DIR, dir);
    if (!fs.statSync(full).isDirectory() || ['node_modules', 'art-sources', 'out'].includes(dir)) continue;
    const files = fs.readdirSync(full).filter(f => f.endsWith('-check.js'));
    for (const extra of EXTRA_CHECKS[dir] || []) if (fs.existsSync(path.join(full, extra))) files.push(extra);
    if (files.length) areas.set(dir, files.sort().map(f => `${dir}/${f}`));
  }
  return areas;
}

function scriptMeta(command) {
  const file = path.join(TOOLS_DIR, command.split(' ')[0]);
  let src = '';
  try { src = fs.readFileSync(file, 'utf8'); } catch { return { exists: false }; }
  return {
    exists: true,
    needsServer: /localhost:8899|:8899\//.test(src),
    // 自分で serve.py や http.createServer を立てる検査。共有の配信と同じポートを取り合うので、その間は共有側を止める
    ownServer: /spawn(?:Sync)?\([^\n]*(?:serve\.py|python)|createServer\(/.test(src),
    needsPlaywright: /require\(['"]playwright['"]\)/.test(src),
    // react で画面を組み立てて確かめる検査。CI は依存を --omit=optional で入れるので react が無い(2026-10-12)
    needsReact: /require\(['"]react['"]\)/.test(src),
    needsCanvas: /require\(['"]canvas['"]\)|loadDyeModule\(/.test(src),
    // 本当の時間を待つ長い検査は、ファイルの中に「run-checks-timeout: <秒>」と書いて上限を延ばせる(短くはしない。2026-10-27 card-pvp-browser-check)
    timeoutSec: Number((src.match(/run-checks-timeout:\s*(\d+)/) || [])[1]) || 0,
  };
}

function canResolve(mod) {
  try { require.resolve(mod, { paths: [TOOLS_DIR] }); return true; } catch { return false; }
}

function portOpen(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.end(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

async function startServer() {
  if (await portOpen(SERVER_PORT)) return { stop() {}, note: `既に :${SERVER_PORT} が開いていたのでそれを使う` };
  const child = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(SERVER_PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await portOpen(SERVER_PORT)) return { stop() { try { child.kill(); } catch {} }, note: `serve.py を :${SERVER_PORT} で起動` };
    await new Promise(r => setTimeout(r, 100));
  }
  try { child.kill(); } catch {}
  return { stop() {}, note: `serve.py を起動できなかった(:${SERVER_PORT})。実ブラウザ検査は NG になりうる` };
}

function runOne(command, timeoutSec) {
  const [file, ...args] = command.split(' ');
  timeoutSec = Math.max(timeoutSec, scriptMeta(command).timeoutSec || 0);
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(TOOLS_DIR, file), ...args], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const sec = (Date.now() - t0) / 1000;
  const output = (r.stdout || '') + (r.stderr || '');
  if (r.error && r.error.code === 'ETIMEDOUT') return { status: 'TIMEOUT', sec, output };
  return { status: r.status === 0 ? 'OK' : 'NG', sec, output, code: r.status };
}

// いつも回す短い検査の一覧を測り直す。ブラウザ・配信を使う検査は除き、1本ずつ5秒まで回して、1秒未満で通ったものだけを残す
function measureAlways(areas) {
  const list = [];
  for (const [name, checks] of areas) if (!['required', 'ci', 'always'].includes(name)) for (const c of checks) if (!list.includes(c)) list.push(c);
  const keep = []; let total = 0, browser = 0, slow = 0, failed = [];
  for (const c of list) {
    const file = path.join(TOOLS_DIR, c.split(' ')[0]);
    let src = ''; try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (/playwright|chromium|puppeteer|createServer|serve\.py|8899|launch\(/.test(src)) { browser++; continue; }
    const t0 = Date.now(); const r = spawnSync(process.execPath, [file, ...c.split(' ').slice(1)], { cwd: REPO_ROOT, timeout: 5000, encoding: 'utf8' }); const ms = Date.now() - t0;
    if (r.status !== 0) { failed.push(c); continue; }
    if (ms >= 1000) { slow++; continue; }
    keep.push(c); total += ms;
  }
  keep.sort();
  const doc = { _説明: `run-checks.js --changed が、変更の中身に関係なく毎回回す短い検査(ブラウザを使わず、1本1秒未満で通るもの)。作り直しは node tools/run-checks.js --measure-always(${new Date().toISOString().slice(0, 10)} 作成。そのときの合計 約${Math.round(total / 1000)}秒)`, checks: keep };
  fs.writeFileSync(ALWAYS_FILE, JSON.stringify(doc, null, 1) + '\n');
  console.log(`いつも回す短い検査 ${keep.length} 本(合計 約${Math.round(total / 1000)}秒)・ブラウザで除外 ${browser}・1秒以上 ${slow}・いま落ちている ${failed.length}`);
  for (const c of failed) console.log(`  いま落ちている: ${c}`);
}

// ==================== 分けて同時に回す(--parallel N・2026-10-23) ====================
// 全部の検査(680本あまり)を1本ずつ回すと2時間を超え、1回で回せる時間の上限で止まった。
// 子の run-checks を N 個立てて、それぞれに --script で受け持ちを渡す。親は共有の配信(:8899)を1つ立て、子は --no-server で使う。
const TIMES_FILE = path.join(TOOLS_DIR, 'run-checks-times.json');
const readTimes = () => { try { return (JSON.parse(fs.readFileSync(TIMES_FILE, 'utf8')).times) || {}; } catch { return {}; } };
// その検査が使う固定ポート(:8899 は共有の配信なので数えない)。同じポートを使う検査は同じ組に入れる
const portsOf = (src) => {
  const ports = new Set();
  // 待ち時間(timeout: 60000 など)をポートと取り違えないよう、ポートを書く形だけを見て、3000〜20000 の数だけを数える
  for (const re of [/localhost:(\d{4,5})/g, /\bPORT\s*=\s*[^;\n]*?\b(\d{4,5})\b/g, /\.listen\(\s*(\d{4,5})/g, /serve\.py['"][^\n]{0,40}?['"](\d{4,5})['"]/g]) {
    let m; while ((m = re.exec(src))) { const p = Number(m[1]); if (p >= 3000 && p <= 20000 && p !== SERVER_PORT) ports.add(p); }
  }
  return [...ports];
};
// 時間を測る検査は、ほかと同時に回すと遅く出て落ちるので、最後に1本ずつ回す
const TIMING_SENSITIVE_RE = /(perf|fps|budget|timing|latency|jank|sync|frame-rate|smooth|long-task|stall|freeze|cost|speed|slow|gpu|touch-bridge|flicker|background-run)/i;
function planLanes(commands, n) {
  const times = readTimes();
  const metas = commands.map(c => {
    const file = path.join(TOOLS_DIR, c.split(' ')[0]);
    let src = ''; try { src = fs.readFileSync(file, 'utf8'); } catch {}
    const meta = scriptMeta(c);
    const ownsShared = meta.ownServer && (/\b8899\b/.test(src) || /serve\.py['"]\s*\)\s*\]/.test(src));
    const browser = meta.needsPlaywright || meta.needsServer || meta.ownServer;
    const sec = Number.isFinite(times[c]) ? times[c] : (browser ? 30 : 2);
    return { c, sec, ports: portsOf(src), solo: ownsShared || (browser && TIMING_SENSITIVE_RE.test(c)) };
  });
  // 同じポートを使う検査をつなぐ(素朴な union-find)
  const parent = metas.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byPort = new Map();
  metas.forEach((m, i) => { if (m.solo) return; for (const p of m.ports) { if (byPort.has(p)) parent[find(i)] = find(byPort.get(p)); else byPort.set(p, i); } });
  const groups = new Map();
  metas.forEach((m, i) => { if (m.solo) return; const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(m); });
  // 重い組から、いちばん空いている組へ(LPT)
  const lanes = Array.from({ length: n }, () => ({ commands: [], sec: 0 }));
  [...groups.values()].map(g => ({ g, sec: g.reduce((a, m) => a + m.sec, 0) })).sort((a, b) => b.sec - a.sec).forEach(({ g, sec }) => {
    const lane = lanes.reduce((min, l) => (l.sec < min.sec ? l : min), lanes[0]);
    lane.commands.push(...g.map(m => m.c)); lane.sec += sec;
  });
  // 並びは元の順に戻す(領域ごとのまとまりを保つ)
  const order = new Map(commands.map((c, i) => [c, i]));
  lanes.forEach(l => l.commands.sort((a, b) => order.get(a) - order.get(b)));
  const solo = metas.filter(m => m.solo).map(m => m.c);
  return { lanes: lanes.filter(l => l.commands.length), solo, soloSec: metas.filter(m => m.solo).reduce((a, m) => a + m.sec, 0) };
}
async function runParallel(commands, opts, wanted) {
  const { lanes, solo, soloSec } = planLanes(commands, opts.parallel);
  if (opts.plan) {
    lanes.forEach((l, i) => console.log(`組${i + 1}: ${l.commands.length}本・見込み${Math.round(l.sec / 60)}分`));
    console.log(`最後に1本ずつ: ${solo.length}本・見込み${Math.round(soloSec / 60)}分\n  ${solo.join('\n  ')}`);
    console.log(`見込みの合計: ${Math.round((Math.max(...lanes.map(l => l.sec)) + soloSec) / 60)}分`);
    return;
  }
  const started = Date.now();
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'run-checks-par-'));
  console.log(`検査 ${commands.length} 本を ${lanes.length} 組で同時に回す(見込み: ${lanes.map(l => Math.round(l.sec / 60) + '分').join(' / ')})・最後に1本ずつ ${solo.length} 本(${Math.round(soloSec / 60)}分)`);
  let server = null;
  if (opts.server) { server = await startServer(); console.log(`  (${server.note})`); }
  const runLane = (lane, idx) => new Promise((resolve) => {
    const list = path.join(tmp, `lane${idx}.txt`), out = path.join(tmp, `lane${idx}.json`);
    const args = [__filename, '--lane', String(idx), '--no-server', '--timeout', String(opts.timeoutSec), '--json', out, '--script', lane.commands.join(',')];
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const onData = (d) => { buf += d; let k; while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k); buf = buf.slice(k + 1); if (/^(OK|NG|TIMEOUT|SKIP|MISSING)\s/.test(line)) console.log(`[組${idx + 1}] ${line}`); } };
    child.stdout.on('data', onData); child.stderr.on('data', () => {});
    child.on('close', () => { let j = null; try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch {} resolve(j ? j.results : lane.commands.map(c => ({ command: c, status: 'NG', sec: 0, output: '組が結果を返さなかった' }))); });
    void list;
  });
  let results = [];
  // 共有の配信は、1本ずつ回す番でも使い続ける。自分で配信を立てる検査の前だけ止め、閉じ切るまで待つ
  // (止めた直後に「まだ開いている」と取り違えて、配信の無いまま回して落ちたことがある)
  const releaseShared = async () => { if (server) { server.stop(); server = null; for (let i = 0; i < 50 && await portOpen(SERVER_PORT); i++) await new Promise(r => setTimeout(r, 100)); } };
  const ensureShared = async () => { if (!server && opts.server) server = await startServer(); };
  const runSolo = async (command, label) => {
    const meta = scriptMeta(command);
    let res;
    if (!meta.exists) res = { status: 'MISSING', sec: 0, output: '' };
    else if (meta.needsPlaywright && !canResolve('playwright')) res = { status: 'SKIP', sec: 0, output: 'playwright が無い' };
    else {
      if (meta.ownServer) await releaseShared(); else if (meta.needsServer) await ensureShared();
      res = runOne(command, opts.timeoutSec);
    }
    console.log(`[${label}] ${res.status.padEnd(4)} ${res.sec.toFixed(1).padStart(6)}s  ${command}`);
    return { command, status: res.status, sec: Math.round(res.sec * 10) / 10, ...(['OK', 'SKIP'].includes(res.status) ? {} : { output: String(res.output || '').slice(-6000) }) };
  };
  const retried = [];
  try {
    const laneResults = await Promise.all(lanes.map(runLane));
    results = laneResults.flat();
    // 自分で配信を立てる検査・時間を測る検査は、ほかが終わってから1本ずつ
    for (const command of solo) results.push(await runSolo(command, '1本ずつ'));
    // 同時に回して落ちたものは、もう一度だけ1本で回す。1本で通ったら「同時に回すと落ちる」として分けて出す(OK に数える)
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (['OK', 'SKIP', 'MISSING'].includes(r.status) || solo.includes(r.command)) continue;
      const again = await runSolo(r.command, '1本で回し直し');
      if (again.status === 'OK') { retried.push(r.command); results[i] = { ...again, sec: r.sec, retriedAlone: true }; }
      else results[i] = again;
    }
  } finally { await releaseShared(); }
  const order = new Map(commands.map((c, i) => [c, i]));
  results.sort((a, b) => order.get(a.command) - order.get(b.command));
  const count = s => results.filter(r => r.status === s).length;
  const totalSec = (Date.now() - started) / 1000;
  console.log(`\n合計 ${results.length} 本 / OK ${count('OK')} / NG ${count('NG')} / TIMEOUT ${count('TIMEOUT')} / SKIP ${count('SKIP')} / MISSING ${count('MISSING')} / ${Math.round(totalSec)}秒(${lanes.length}組で同時)`);
  const bad = results.filter(r => !['OK', 'SKIP'].includes(r.status));
  const FAIL_LINE = /(^|\s)(NG|FAIL|失敗|不一致|エラー|Error|Cannot|undefined|✗|❌)/;
  for (const r of bad.slice(0, 8)) {
    console.log(`\n--- ${r.status}: ${r.command}`);
    const lines = String(r.output || '').trim().split('\n').filter(l => l.trim());
    const core = lines.filter(l => FAIL_LINE.test(l));
    console.log((core.length ? core.slice(0, 10) : lines.slice(-8)).map(l => '    ' + (l.length > 200 ? l.slice(0, 200) + ' …' : l)).join('\n'));
  }
  if (bad.length > 8) console.log(`\n… ほか ${bad.length - 8} 本が失敗しています（1本ずつ見るなら  node tools/run-checks.js --script <名前>）`);
  if (retried.length) console.log(`\n同時に回すと落ちたが、1本で回し直すと通った検査(${retried.length}本・OK に数えた。続くなら最後に1本ずつ回す組へ):\n  ${retried.join('\n  ')}`);
  if (opts.saveTimes) {
    const times = readTimes();
    for (const r of results) if (r.status !== 'SKIP' && r.status !== 'MISSING') times[r.command] = r.sec;
    const doc = { _説明: 'run-checks.js --parallel が組を分けるときに使う、検査1本ごとのかかった秒数(前回の記録)。作り直しは node tools/run-checks.js --area all --parallel 5 --save-times', times: Object.fromEntries(Object.entries(times).sort()) };
    fs.writeFileSync(TIMES_FILE, JSON.stringify(doc, null, 1) + '\n');
    console.log(`\nかかった時間を書き直した: ${path.relative(REPO_ROOT, TIMES_FILE)}`);
  }
  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ at: new Date().toISOString(), areas: wanted, totalSec, parallel: lanes.length, results }, null, 1));
    console.log(`\n結果を書き出した: ${opts.json}`);
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  process.exit(bad.length ? 1 : 0);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const areas = discoverAreas();

  if (opts.measureAlways) { measureAlways(areas); return; }
  if (opts.changed) {
    const files = changedFiles(opts.base);
    const { picked, reasons, core, dropped } = planForChanges(files, areas, opts.wide, opts.limit);
    const src = files.filter(f => !GENERATED_RE.test(f));
    console.log(`変更 ${src.length} 件（ほかに生成物 ${files.length - src.length} 件）→ 検査 ${picked.length} 本`);
    for (const f of src.slice(0, 15)) console.log(`  変更: ${f}`);
    if (src.length > 15) console.log(`  … ほか ${src.length - 15} 件`);
    if (!picked.length) {
      console.log('該当する検査はありません。広げるなら --changed --wide か --area <名前>（--list で一覧）。');
      process.exit(0);
    }
    if (dropped) console.log(`  ※ 当てはまる検査があと ${dropped} 本ありますが、上限 ${opts.limit} 本で切りました（--limit で増やす / --wide で領域ごと）`);
    if (opts.plan) {
      console.log(`\n通す検査 ${picked.length} 本${core ? '（必須検査を含む）' : ''}:`);
      for (const c of picked) console.log(`  ${c.padEnd(46)} ← ${reasons.get(c)}`);
      console.log('\n実行するなら --plan を外してください。広げるなら --wide。');
      return;
    }
    opts.scripts = (opts.scripts || []).concat(picked);
    console.log('');
  }

  if (opts.list || (opts.areas.length === 0 && !(opts.scripts && opts.scripts.length))) {
    console.log('領域と検査の一覧(--area <名前> で実行。all で全部):');
    for (const [name, list] of areas) {
      console.log(`\n[${name}] ${list.length}本`);
      for (const c of list) console.log(`  ${c}`);
    }
    if (opts.areas.length === 0) console.log('\n例: node tools/run-checks.js --area required');
    return;
  }
  const wanted = opts.areas.includes('all') ? [...areas.keys()] : opts.areas;
  const unknown = wanted.filter(a => !areas.has(a));
  if (unknown.length) { console.error(`NG: 知らない領域: ${unknown.join(', ')}(--list で確認)`); process.exit(2); }
  const commands = [];
  for (const a of wanted) for (const c of areas.get(a)) if (!commands.includes(c)) commands.push(c);
  for (const c of opts.scripts || []) if (!commands.includes(c)) commands.push(c);
  if (opts.skipFile) {
    const skip = new Set(fs.readFileSync(opts.skipFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));
    for (let i = commands.length - 1; i >= 0; i--) if (skip.has(commands[i])) commands.splice(i, 1);
  }

  if (opts.parallel > 1 && !opts.lane) { await runParallel(commands, opts, wanted); return; }
  const hasPlaywright = canResolve('playwright');
  const hasCanvas = canResolve('canvas');
  const hasReact = canResolve('react');
  // 共有の配信(serve.py)は、要る検査の直前に起動し、自分で配信を立てる検査の前には止める(ポートの取り合いを避ける)
  let server = null;
  const ensureServer = async () => { if (!server && opts.server) { server = await startServer(); console.log(`  (${server.note})`); } };
  const releaseServer = async () => { if (server) { server.stop(); server = null; for (let i = 0; i < 50 && await portOpen(SERVER_PORT); i++) await new Promise(r => setTimeout(r, 100)); } };
  console.log(`検査 ${commands.length} 本 / 領域: ${wanted.join(', ')} / playwright: ${hasPlaywright ? 'あり' : 'なし'} / canvas: ${hasCanvas ? 'あり' : 'なし'} / 配信: ${opts.server ? '必要なときだけ自動起動' : '起動しない(--no-server)'}`);

  const results = [];
  const started = Date.now();
  try {
    for (const command of commands) {
      const meta = scriptMeta(command);
      let res;
      if (!meta.exists) res = { status: 'MISSING', sec: 0, output: '' };
      else if (meta.needsPlaywright && !hasPlaywright) res = { status: 'SKIP', sec: 0, output: 'playwright が無い' };
      else if (meta.needsCanvas && !hasCanvas) res = { status: 'SKIP', sec: 0, output: 'canvas が無い' };
      else if (meta.needsReact && !hasReact) res = { status: 'SKIP', sec: 0, output: 'react が無い' };
      else {
        if (meta.ownServer) await releaseServer(); else if (meta.needsServer) await ensureServer();
        res = runOne(command, opts.timeoutSec);
      }
      results.push({ command, ...res, needsServer: !!meta.needsServer, needsPlaywright: !!meta.needsPlaywright });
      const mark = res.status === 'OK' ? 'OK  ' : res.status === 'SKIP' ? 'SKIP' : res.status === 'NG' ? 'NG  ' : res.status;
      console.log(`${mark} ${res.sec.toFixed(1).padStart(6)}s  ${command}`);
    }
  } finally {
    await releaseServer();
  }

  const count = s => results.filter(r => r.status === s).length;
  const totalSec = (Date.now() - started) / 1000;
  console.log(`\n合計 ${results.length} 本 / OK ${count('OK')} / NG ${count('NG')} / TIMEOUT ${count('TIMEOUT')} / SKIP ${count('SKIP')} / MISSING ${count('MISSING')} / ${Math.round(totalSec)}秒`);
  const bad = results.filter(r => !['OK', 'SKIP'].includes(r.status));
  // 失敗の中身は「最後の8行」ではなく、失敗をじかに言っている行を拾う。
  // 検査によっては原因が途中に出て、最後は集計だけということがあるため。
  const FAIL_LINE = /(^|\s)(NG|FAIL|失敗|不一致|エラー|Error|Cannot|undefined|✗|❌)/;
  for (const r of bad.slice(0, 5)) {
    console.log(`\n--- ${r.status}: ${r.command}`);
    const lines = r.output.trim().split('\n').filter(l => l.trim());
    const core = lines.filter(l => FAIL_LINE.test(l));
    const show = core.length ? core.slice(0, 10) : lines.slice(-8);
    console.log(show.map(l => '    ' + (l.length > 200 ? l.slice(0, 200) + ' …' : l)).join('\n'));
    if (core.length > 10) console.log(`    … ほか ${core.length - 10} 行（全部見るなら  node tools/${r.command}）`);
    else if (!core.length) console.log(`    （失敗を名指しする行が見つからないので末尾を出しています: node tools/${r.command}）`);
  }
  if (bad.length > 5) console.log(`\n… ほか ${bad.length - 5} 本が失敗しています（1本ずつ見るなら  node tools/run-checks.js --script <名前>）`);
  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ at: new Date().toISOString(), areas: wanted, totalSec, results: results.map(r => ({ command: r.command, status: r.status, sec: Math.round(r.sec * 10) / 10, ...(['OK', 'SKIP'].includes(r.status) ? {} : { output: String(r.output || '').slice(-6000) }), needsServer: r.needsServer, needsPlaywright: r.needsPlaywright, tail: r.status === 'OK' ? undefined : r.output.trim().split('\n').slice(-8) })) }, null, 2));
    console.log(`\n結果を書き出した: ${opts.json}`);
  }
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('NG: run-checks 自体が失敗:', e && e.stack || e); process.exit(2); });
