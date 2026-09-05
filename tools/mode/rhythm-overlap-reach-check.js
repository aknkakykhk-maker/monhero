const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 配信している譜面に「物理的に押せない配置」が残っていないかを見る。
//
//   node tools/mode/rhythm-overlap-reach-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「スライドノーツに他ノーツが重なってるパターンで、
//     太さが同じぐらいのスライドノーツにくると物理的に押せない」
//
// SLIDE / HOLD を押さえている指はその帯から離れられない。そこへ重なって別のノーツが来たとき、
// 2本目の指を置く場所が帯から指の太さぶん離れていなければ、指が入らない。
// 幅の広いSLIDEに幅の広いTAPが重なると、2つ合わせて5レーンを超えて置き場所が無くなる。
//
// これまでの検査(STEP6)は authoring の中間ファイル(grid単位)を見ていて、しかも
// 105ms以内に並ぶ2音と同時押しのレーン差しか測っていなかった。
// 長いSLIDEの**途中**に重なるノーツは「もう片方の指へ回す」とだけ判定していて、
// その指が入る隙間があるかどうかは誰も測っていなかった。
// ここでは、プレイヤーが実際に遊ぶ monster-hero/data/rhythm-mode.js を、
// ランタイムと同じ関数(見た目と同じ幅・位置)で測る。
//
// 落ちたら node tools/mode/rhythm-overlap-reach-fix.js --write で直せる。
const rt0 = require(require('path').join(TOOLS_DIR, 'mode', 'rhythm-runtime-notes.js'));
const { HAND_MODEL } = require(require('path').join(TOOLS_DIR, 'mode', 'rhythm-hand-model.js'));

const runtime = rt0.loadRuntime();
const spanAt = rt0.makeSpanAt(runtime);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 物差しそのもの ----
check('指の太さがレーン単位の定義から来ている',
  rt0.FINGER_GAP_SUB === HAND_MODEL.fingerMinGapLanes * 2, `${rt0.FINGER_GAP_SUB}サブレーン`);
check('先行公開の曲を全部見ている',
  Object.keys(rt0.RELEASED_MARKERS).length === runtime.RHYTHM_DEMO_SONG_IDS.length
  && runtime.RHYTHM_DEMO_SONG_IDS.every(id => rt0.RELEASED_MARKERS[id]),
  runtime.RHYTHM_DEMO_SONG_IDS.join(' / '));

// ---- 物差しが効いていること(わざと押せない配置を作って確かめる) ----
// 検査が素通しになっていないことを、その場で作った譜面で確かめる。
// 幅2のSLIDEの真上へ幅3のTAPを置いたら、必ず見つからなければいけない
const fakeSlide = { type:'SLIDE', timeMs:0, endTimeMs:1000, lane:2, endLane:2, subLaneWidth:2,
  slidePoints:[{timeMs:0,lane:2,subLaneWidth:2},{timeMs:1000,lane:2,subLaneWidth:2}] };
const onTop = { type:'TAP', timeMs:500, lane:2, subLane:4, subLaneWidth:3 };
const farAway = { type:'TAP', timeMs:500, lane:0, subLane:0, subLaneWidth:2 };
check('帯の真上に重なるノーツを見つけられる',
  rt0.overlapConflicts([fakeSlide, onTop], spanAt).length === 1);
check('離れた場所のノーツは見つけない(何でも落とす検査になっていない)',
  rt0.overlapConflicts([fakeSlide, farAway], spanAt).length === 0);
// ほぼ同じ場所を 60ms で叩き分ける組み合わせ。指2本は入らず、1本で叩き直すには速すぎる
check('近いのに速い2音を見つけられる',
  rt0.fastPairConflicts([{type:'TAP',timeMs:0,lane:2,subLane:4,subLaneWidth:2},
    {type:'TAP',timeMs:60,lane:2,subLane:4,subLaneWidth:2}], spanAt).length === 1);
// 指が2本入る離れ方なら見つけない(何でも落とす検査になっていないこと)
check('離れていれば速くても見つけない',
  rt0.fastPairConflicts([{type:'TAP',timeMs:0,lane:0,subLane:0,subLaneWidth:2},
    {type:'TAP',timeMs:60,lane:4,subLane:8,subLaneWidth:2}], spanAt).length === 0);

// ---- 配信データ ----
let overlapTotal = 0, fastTotal = 0;
const worst = [];
for (const songId of Object.keys(rt0.RELEASED_MARKERS)) {
  const song = runtime.RHYTHM_SONGS.find(entry => entry.songId === songId);
  for (const difficulty of ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER']) {
    const chart = song && song.difficulties[difficulty];
    if (!chart || !chart.notes.length) continue;
    const overlap = rt0.overlapConflicts(chart.notes, spanAt);
    const fast = rt0.fastPairConflicts(chart.notes, spanAt);
    overlapTotal += overlap.length;
    fastTotal += fast.length;
    if (overlap.length || fast.length) {
      worst.push(`${songId} ${difficulty}: 重なり${overlap.length}件 / 近いのに速い${fast.length}件`);
      const sample = overlap[0] || fast[0];
      if (sample) worst.push(`   例: ${Math.round(sample.timeMs)}ms`);
    }
  }
}
check('押さえている帯に重なって指が入らない配置が無い', overlapTotal === 0, `${overlapTotal}件`);
check('指が2本入らない近さなのに速すぎる2音が無い', fastTotal === 0, `${fastTotal}件`);
if (worst.length) worst.forEach(line => console.log(`   ${line}`));

// ---- 直す道具が残っていること ----
const fs = require('fs');
const fixPath = require('path').join(TOOLS_DIR, 'mode', 'rhythm-overlap-reach-fix.js');
check('直す道具がある', fs.existsSync(fixPath), 'tools/mode/rhythm-overlap-reach-fix.js');
const fixSource = fs.existsSync(fixPath) ? fs.readFileSync(fixPath, 'utf8') : '';
check('直す道具は押さえている帯そのものを動かさない',
  fixSource.includes("const movable=note=>(note.type==='TAP'||note.type==='FLICK'||note.type==='HOLD')"));
check('直す道具はほかの曲の譜面を巻き添えにしない',
  fixSource.includes('先行公開5曲以外の譜面まで書き換えようとしました'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
