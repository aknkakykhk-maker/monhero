#!/usr/bin/env node
// タクティクスバトルの中ボス戦・ボス戦に、それぞれ決めたBGMが鳴ることを確認する。
//
//   node tools/audio/tactics-boss-bgm-check.js
//
// 【なぜ道具にするか】
// 2026-09-21にユーザーからボス戦用の曲を1つ受け取った（「曲数が足りないからボス戦だけいれよう」）。
// 同じ日に中ボス戦（WAVE9）も決まった（「中ボス戦は一旦これで」＝すでに入っている
// The City Beneath the Comets）。**通常戦だけ**チャレンジと同じ曲を鳴らす。
// ここが崩れると、
//   ・タクティクスの全WAVEで同じ曲が鳴る
//   ・逆に専用曲が一度も鳴らない（結線の順番を間違えると、プロや種族の枠へ落ちる）
// のどちらかになるが、どちらもエラーは出ず、WAVE9〜10まで進めないと気づけない。
//
// 結線の順番がとくに危ない。タクティクスの種族チャレンジ・プロは isSpeciesChallengeMode /
// isProMode にも当たるので、isTacticsMode を後ろに置くと**そちらの枠へ落ちる**。
//
// 保存データの決まり（CLAUDE.md ⑦）も見る。新しい枠 tacticsBoss は
// BGM_ARRANGEMENT_LEGACY_FALLBACK へ入れてはいけない。入れると、チャレンジのボス曲を
// 自分で選んでいる人にはその曲が引き継がれ、専用曲が一度も鳴らない。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TRACK_ID = 'tactics_boss';
const AUDIO_REL = 'audio/bgm-tactics-boss.mp3';
// 中ボス戦はすでに入っている曲を指すだけ（音源のコピーを作らない。CLAUDE.md ⑥-2）
const MID_BOSS_TRACK_ID = 'melo_the_city_beneath_the_comets';
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

// --- ① 音源そのもの ---
const audioPath = path.join(ROOT, 'monster-hero', AUDIO_REL);
check('音源がある', fs.existsSync(audioPath), AUDIO_REL);
if (fs.existsSync(audioPath)) {
  const mb = fs.statSync(audioPath).size / 1048576;
  // 96kbpsで4分なら約2.9MB。5MBを超えていたら、ジャケットかビットレートを落とし忘れている
  check('音源の大きさが配信向けに収まっている', mb > 0.3 && mb < 5, `${mb.toFixed(2)}MB`);
  let ffmpeg = null;
  try { ffmpeg = require('ffmpeg-static'); } catch { /* CIには無い */ }
  if (!ffmpeg) {
    console.log('SKIP: ffmpeg が無いので中身(ビットレート・ジャケット)は見ません');
  } else {
    const { execFileSync } = require('child_process');
    let info = '';
    try {
      execFileSync(ffmpeg, ['-hide_banner', '-i', audioPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { info = String(e.stderr || ''); }
    const stream = (info.match(/Audio: mp3[^\n]*/) || [''])[0];
    const kbps = Number((stream.match(/(\d+) kb\/s/) || [])[1] || 0);
    // BGMの流儀は 96kbps / 44100Hz ステレオ（tools/audio/compress-audio.js の狙い）
    check('ビットレートがBGMの流儀に収まっている', kbps > 0 && kbps <= 112, `${kbps}kbps`);
    check('44100Hz ステレオ', /44100 Hz/.test(stream) && /stereo/.test(stream), stream.slice(0, 60));
    // ★ジャケット画像が残っていると、音しか使わないのに数百KB余分に配る
    check('ジャケット画像が残っていない', !/Video:/.test(info));
  }
}

// --- ② 起動時に読み込まない（開いたときに初めて読む側が正しい） ---
const indexHtml = fs.readFileSync(path.join(ROOT, 'monster-hero/index.html'), 'utf8');
check('起動時の読み込み一覧に混ざっていない', !indexHtml.includes('bgm-tactics-boss'));

// --- ③ 結線 ---
for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const label = path.basename(file);
  // ★ブロックを切り出して見ない。compiled はコメントを残したまま1行にまとめるので、
  //   「const BGM_TRACKS = [ 〜 \n];」のような切り出しが効かない（2026-09-21にそれで落ちた）。
  //   曲の1件ぶんだけを取り出して見る
  const entry = (compact.match(new RegExp(`\\{id:'${TRACK_ID}'[^}]*\\}`)) || [''])[0];
  check(`${label}: 曲が登録されている`,
    entry.includes(`id:'${TRACK_ID}'`) && entry.includes(`src:'${AUDIO_REL}'`), entry.slice(0, 90));
  // 音量は音源側でそろえてある。gain で持ち上げようとしない（実装が0〜1.25にクランプする）
  check(`${label}: gain を触っていない`, /gain:1[,}]/.test(entry));
  check(`${label}: ループ再生する`, /loop:true/.test(entry));

  check(`${label}: 既定の枠 tacticsBoss が専用曲を指す`,
    compact.includes(`tacticsBoss:'${TRACK_ID}'`));
  check(`${label}: 既定の枠 tacticsMidBoss がすでにある曲を指す`,
    compact.includes(`tacticsMidBoss:'${MID_BOSS_TRACK_ID}'`));
  // ★中ボス戦は音源を増やさない。同じ曲のコピーを作ると、配信サイズがそのぶん増える
  const midBossEntry = (compact.match(new RegExp(`\\{id:'${MID_BOSS_TRACK_ID}'[^}]*\\}`)) || [''])[0];
  check(`${label}: 中ボス戦の曲は、すでに登録されているものをそのまま使う`,
    midBossEntry.includes(`id:'${MID_BOSS_TRACK_ID}'`) && !midBossEntry.includes('tactics'),
    midBossEntry.slice(0, 80));
  // ★ここへ入れると、チャレンジのボス曲を自分で選んでいる人には専用曲が一度も鳴らない
  const legacy = (source.match(/const BGM_ARRANGEMENT_LEGACY_FALLBACK = Object\.freeze\(\{([^}]*)\}/) || [])[1] || '';
  check(`${label}: タクティクスの枠を引き継ぎの表へ入れていない`,
    !legacy.includes('tacticsBoss') && !legacy.includes('tacticsMidBoss'),
    /tactics\w*/.test(legacy) ? '入っています' : '');

  // ★順番。タクティクスの種族・プロは isSpeciesChallengeMode / isProMode にも当たる
  check(`${label}: BGMを選ぶとき、タクティクスをいちばん先に見る`,
    compact.includes("constmodeBgm=isTacticsMode(runMode)?{normal:'battle',dullahan:'tacticsMidBoss',moo:'tacticsBoss'}:isSpeciesChallengeMode(runMode)"));
  // 通常戦だけチャレンジと同じ枠（通常戦の曲がまだ無いので専用の枠を作らない）
  check(`${label}: 通常戦はチャレンジと同じ枠を使う`,
    compact.includes("{normal:'battle',dullahan:'tacticsMidBoss',moo:'tacticsBoss'}") && !compact.includes("tacticsBattle"));

  // アレンジのタブは、モードを公開するまで出さない（種族チャレンジと同じ扱い）
  // ★括弧の数は書き方しだいで変わる（compiled は外側の括弧を外す）。中身だけを見る
  check(`${label}: アレンジのタブは公開フラグで出し分ける`,
    /\.\.\.\(+TACTICS_MODE_PUBLIC_RELEASE\|\|TACTICS_BETA_PRO_RELEASE\)?\?\[\{id:'tactics',label:'タクティクス',items:\[\['tacticsMidBoss','中ボス戦BGM'\],\['tacticsBoss','ボス戦BGM'\]\]\}\]:\[\]\)/.test(compact));
  // ★WAVE9はデュラハンではなくスプラッター。画面に出す呼び名を「デュラハン戦」にしない
  check(`${label}: 中ボス戦の枠を「デュラハン戦」と呼んでいない`,
    !/\['tacticsMidBoss','デュラハン戦/.test(compact));

  // --- ④ 既存5モードのBGM選択を巻き込んで変えていない（回帰） ---
  for (const [name, needle] of [
    ['種族', "isSpeciesChallengeMode(runMode)?{normal:'speciesBattle',dullahan:'speciesDullahan',moo:'speciesMoo'}"],
    ['極限', "extremeRunRef.current?{normal:'extremeBattle',dullahan:'extremeDullahan',moo:'extremeMoo'}"],
    ['プロ', "isProMode(runMode)?{normal:'proBattle',dullahan:'proDullahan',moo:'proMoo'}"],
    ['クイック', "isQuickMode(runMode)?{normal:'quickBattle',dullahan:'quickDullahan',moo:'quickMoo'}"],
    ['チャレンジ', "{normal:'battle',dullahan:'dullahan',moo:'boss'}"],
  ]) {
    check(`${label}: ${name}のBGM選択は今までどおり`, compact.includes(needle));
  }
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
