#!/usr/bin/env node
// CLAUDE.md を「小さいまま、痩せさせない」ための検査。
//
// CLAUDE.md は会話のたびに全文が読み込まれるので、大きさがそのまま恒久コストになる。
// だから小さく保ちたい。ただし**小さくしてよいのは「置き場所を変える」ときだけ**で、
// 守るべき一文を消してはいけない。短くする作業でうっかり落ちるのを機械で止める。
//
//   node tools/rules-index-check.js
//
// 見るもの:
//   1. CLAUDE.md の大きさが上限以内か（また膨らんでいないか）
//   2. CLAUDE.md と docs/rules/ のリンク先が実在するか
//   3. docs/rules/ に、どこからも参照されていない置き去りのページが無いか
//   4. 要のことばが CLAUDE.md 本体から消えていないか  ← これが本体
//   5. tools/ 直下のスクリプトが tools/README.md に載っていて、説明コメントを持っているか
//      （直下は CLAUDE.md と CI が名指しする場所。ここだけは索引を腐らせない。
//        node tools/ctx.js checks が説明コメントから検査を引くので、説明が無いと見つからない）
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const RULES_DIR = path.join(ROOT, 'docs/rules');

// 2026-09-17に 42650 → 22780 バイトへ寄せた。余白は持たせつつ、元の大きさへ戻るのは止める。
const MAX_BYTES = 26000;

// CLAUDE.md 本体に必ず残っていなければならないことば。
// 「詳細は docs/rules/ へ」と移してよいのは経緯・失敗例・手順であって、下の語が指す決めごとは
// 本体に無いと、読み込まれた時点で見えない＝守られない。
const MUST_KEEP = [
  // 会話とフロー
  ['日本語に固定', '会話言語'],
  ['コミットしても良いですか', '②確認を取らずにコミットする'],
  ['いちいち聞かない', '③プッシュ・マージまで自動'],
  ['マージがコンフリクトで断られても、そこで止めない', '③コンフリクトで止まらない'],
  ['https://aknkakykhk-maker.github.io/monhero/', '④本番URL'],
  // 更新履歴・ヘルプ・助手
  ['monster-hero/data/changelog.js', '⑤更新履歴の場所'],
  ['monster-hero/data/help.js', '⑤ヘルプの場所'],
  ["TZ=Asia/Tokyo date", '⑤日時は実時刻(JST)'],
  ['配列の先頭', '⑤足す位置'],
  ["{ t:'data', id:'...' }", '⑤一覧は実データから作る'],
  ['HELP_SCREEN_COVERAGE', '⑤画面を増やしたとき'],
  ['addAssistantLinePack', '⑤助手のセリフの足し方'],
  ['assistantNotice', '⑤助手の告知'],
  ['`market`', '⑤告知の種別'],
  ['`mode`', '⑤告知の種別'],
  ['`content`', '⑤告知の種別'],
  ['mh_◯◯_seen_v1', '⑤一度きりの案内'],
  ['RELEASE_FLAGS', '⑤案内は同じフラグで出し入れ'],
  ['モンヒロビート', '⑤正式名称'],
  ['モンビー', '⑤略称を使ってよい場面'],
  ['DEBUG_SETTINGS', '⑤デバッグ専用は載せない'],
  // ビルドと検査
  ['node tools/build.js', '⑥ビルド'],
  ['check-syntax.js', '⑥検査'],
  ['undefined-reference-check.js', '⑥検査'],
  ['jsx-text-brace-check.js', '⑥検査'],
  ['render-error-check.js', '⑥検査'],
  ['image-asset-check.js', '⑥絵を差し替えたとき'],
  ['home-layout-check.js', '⑥HOMEの配置'],
  // 画像・音源
  ['512×512', '⑥-2ジャケットの形'],
  ['-14 LUFS', '⑥-2音量'],
  ['-1 dBTP', '⑥-2真のピーク'],
  ['BGM_TRACKS', '⑥-2 gain では直せない'],
  ["force-cache", '⑥-2音源を差し替えたらビルド'],
  ['1104', '⑥-2エンコーダ遅延'],
  // 新曲
  ['rhythm-song-add', '⑥-3スキル'],
  ['challengeFactor', '⑥-3難易度'],
  ['CHALLENGE_', '⑥-3測り方は触らない'],
  ['RELEASED_MARKERS', '⑥-3登録し忘れ'],
  ['RELEASED_TRACKS', '⑥-3登録し忘れ'],
  ['song-art-notice-check.js', '⑥-3ジャケットの絵'],
  ['changelogSafeLink', '⑥-3外部リンク'],
  ['chartIntensity', '⑥-3上だけ尖らせる'],
  // イベント
  ['rhythm-event.js', '⑥-4足す場所'],
  ['月曜5:00', '⑥-4終わりの時刻'],
  ['visibleFrom', '⑥-4公開の時刻'],
  ['notifyFrom', '⑥-4告知の時刻'],
  ['RHYTHM_SWITCHING_CHARTS', '⑥-4譜面の入れ替え'],
  ['rhythmChartSwitchHold', '⑥-4演奏中は固定'],
  // 保存データ
  ['mh_*', '⑦保存キー'],
  ['Number.isFinite', '⑦型を確かめる'],
  ['normalizeBgmArrangement', '⑦正規化'],
  ['mh_quick_hs_*', '⑦別のキーに足す'],
  ['_migrated_v1', '⑦二重適用を防ぐ'],
  // Actions / PR
  ['compiled-check.yml', '⑧置いてよいワークフロー'],
  ['build-and-check.yml', '⑧置いてよいワークフロー'],
  ['古いPRをそのままマージしない', '⑧'],
  // 文脈
  ['game-system.compiled.js', '⑨開かないファイル'],
  ['60-app.jsx', '⑨開かないファイル'],
  ['tools/ctx.js', '⑨代わりに打つもの'],
  ['ultracode', '⑩設定よりこのルールが優先'],
  ['--reanalyze', '⑩-2やってはいけない'],
  ['--release', '⑩-2やってはいけない'],
];

const problems = [];

// 1. 大きさ
const text = fs.readFileSync(CLAUDE_MD, 'utf8');
const bytes = Buffer.byteLength(text, 'utf8');
if (bytes > MAX_BYTES) {
  problems.push(`CLAUDE.md が ${bytes} バイトで上限 ${MAX_BYTES} を超えています。`
    + '\n    足した決めごとは残し、経緯・失敗例・手順を docs/rules/ へ移してください（中身を削るのではなく置き場所を変える）。');
}

// 2. リンク先が実在するか
function linksOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    out.push(href.split('#')[0]);
  }
  return out;
}

const checkedFiles = [CLAUDE_MD];
if (fs.existsSync(RULES_DIR)) for (const f of fs.readdirSync(RULES_DIR).sort()) if (f.endsWith('.md')) checkedFiles.push(path.join(RULES_DIR, f));

for (const file of checkedFiles) {
  for (const href of linksOf(file)) {
    if (!href) continue;
    const target = path.resolve(path.dirname(file), href);
    if (!fs.existsSync(target)) problems.push(`${path.relative(ROOT, file)} のリンク先がありません: ${href}`);
  }
}

// 3. 置き去りのページが無いか（CLAUDE.md か docs/rules/README.md のどちらかから参照されていること）
if (fs.existsSync(RULES_DIR)) {
  const readme = path.join(RULES_DIR, 'README.md');
  if (!fs.existsSync(readme)) problems.push('docs/rules/README.md がありません（索引が無いと、詳細を置いても誰も開けません）。');
  const referenced = new Set();
  for (const file of [CLAUDE_MD, ...(fs.existsSync(readme) ? [readme] : [])]) {
    for (const href of linksOf(file)) referenced.add(path.basename(href));
  }
  for (const f of fs.readdirSync(RULES_DIR)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    if (!referenced.has(f)) problems.push(`docs/rules/${f} がどこからも参照されていません（CLAUDE.md か docs/rules/README.md から案内してください）。`);
  }
}

// 4. 要のことばが残っているか
const missing = MUST_KEEP.filter(([word]) => !text.includes(word));
for (const [word, where] of missing) {
  problems.push(`CLAUDE.md から「${word}」（${where}）が消えています。`
    + '\n    移してよいのは経緯・失敗例・手順だけです。決めごと本体は CLAUDE.md に残してください。');
}

// 5. tools/ 直下の索引（CLAUDE.md と CI が名指しする場所だけを見る）
const TOOLS_DIR = path.join(ROOT, 'tools');
const TOOLS_README = path.join(TOOLS_DIR, 'README.md');
let rootScripts = 0;
if (fs.existsSync(TOOLS_README)) {
  const readme = fs.readFileSync(TOOLS_README, 'utf8');
  for (const name of fs.readdirSync(TOOLS_DIR).sort()) {
    if (!name.endsWith('.js')) continue;
    rootScripts++;
    if (!readme.includes(name)) {
      problems.push(`tools/${name} が tools/README.md に載っていません（直下は CLAUDE.md と CI が名指しする場所なので、足したら同じPRで1行足す）。`);
    }
    const head = fs.readFileSync(path.join(TOOLS_DIR, name), 'utf8').split('\n').slice(0, 6);
    if (!head.some(l => /^\s*\/\/\s*\S/.test(l))) {
      problems.push(`tools/${name} の先頭に、何をするものかを1行で書いたコメントがありません（node tools/ctx.js checks がここを読んで検査を探します）。`);
    }
  }
}

const kb = (bytes / 1024).toFixed(1);
if (problems.length) {
  console.error(`NG: ルールの索引に ${problems.length} 件の問題`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`OK: CLAUDE.md ${kb}KB（上限 ${(MAX_BYTES / 1024).toFixed(1)}KB） / 詳細 ${checkedFiles.length - 1} ページ / 要のことば ${MUST_KEEP.length} 件すべて健在 / tools直下 ${rootScripts} 本すべて索引済み`);
