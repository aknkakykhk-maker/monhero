// 横画面で実機から指摘された「奥行きが短すぎて難易度が大幅アップ」への対応
// (rhythmTravelMsHeightRatio)を、実装から取り出して純粋関数として確かめる。
//
// 原因: プレイエリアの高さが縦画面よりずっと低いのに、ノーツが判定ラインへ着くまでの
// 見た目の飛行時間(travelMs)は画面の高さに関係なく同じ値を使っていた。狭い縦幅へ同じ時間で
// 詰め込むぶん、ノーツを見て追える余地が減り、実機で難易度が大きく上がったと指摘された
// (2026-09-03)。
//
// 対応方針:
//   ・judgmentタイミング・BPM・noteTime・判定窓・スコア式は一切変えない
//   ・**見た目の飛行時間(travelMs)だけ**を、プレイエリアの実測高さに応じて伸ばす
//   ・縦画面の基準高さ以上(=ふつうの縦画面)では比率が1に留まり、既存の縦画面の挙動を
//     一切変えない(zeroレグレッション)
//   ・伸ばし過ぎないよう上限もかける(暫定値。実機の感触を見て今後調整する)
//
//   node tools/mode/rhythm-landscape-travel-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 実装を取り出して実際に動かす ────────────────────────────────────────────
const speedConsts=[
  game.match(/const RHYTHM_NOTE_SPEED_MIN=[^\n]*/)?.[0],
  game.match(/const RHYTHM_NOTE_SPEED_MAX=[^\n]*/)?.[0],
  game.match(/const RHYTHM_NOTE_SPEED_STEP=[^\n]*/)?.[0],
].filter(Boolean).join('\n');
const block=game.match(/const RHYTHM_NOTE_TRAVEL_BASE_MS=[\s\S]*?const rhythmTravelMsForSpeed=[\s\S]*?\n\};/)?.[0];
check('実装を抽出できる',!!block&&!!speedConsts);
if(!block)process.exit(1);
const context={DEFAULT_RHYTHM_SETTINGS:{noteSpeed:6}};vm.createContext(context);
vm.runInContext(`${speedConsts}\n${block}\nthis.out={RHYTHM_LANDSCAPE_TRAVEL_REFERENCE_HEIGHT_PX,RHYTHM_LANDSCAPE_TRAVEL_RATIO_MAX,rhythmTravelMsHeightRatio,rhythmTravelMsForSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX};`,context);
const M=context.out;

check('基準高さはiPhone縦画面の実測(390x844相当・プレイエリア743px)と同じ',
  M.RHYTHM_LANDSCAPE_TRAVEL_REFERENCE_HEIGHT_PX===743);

// ── 縦画面(基準以上の高さ)では比率1のまま、既存の挙動を一切変えない ──────────
check('基準の高さちょうどでは比率1',M.rhythmTravelMsHeightRatio(743)===1);
check('基準より高い(大きい縦画面端末)でも比率1のまま(速くしない)',
  M.rhythmTravelMsHeightRatio(825)===1&&M.rhythmTravelMsHeightRatio(2000)===1);
// 式(高さだけ見る純粋関数)は小さい端末でも比率1超を返し得る。縦画面で使わせないための
// 歯止めは本体側のisLandscape分岐が持つ(下の「本体のtickは横画面のときだけ」で確認する)。
check('式自体は高さだけで決まる(小さい縦画面端末の467pxでも1超になり得る)',
  M.rhythmTravelMsHeightRatio(467)>1);

// ── 横画面(実測361px/399px/346px相当)では比率が1より大きくなる ──────────────
const ratio844x390=M.rhythmTravelMsHeightRatio(361);
const ratio926x428=M.rhythmTravelMsHeightRatio(399);
const ratio667x375=M.rhythmTravelMsHeightRatio(346);
check('横画面(844x390相当・プレイエリア361px)では見た目の飛行時間を伸ばす',
  ratio844x390>1.9&&ratio844x390<2.2,ratio844x390.toFixed(3));
check('横画面(926x428相当・プレイエリア399px)では見た目の飛行時間を伸ばす',
  ratio926x428>1.7&&ratio926x428<2,ratio926x428.toFixed(3));
check('横画面(667x375相当・プレイエリア346px)では見た目の飛行時間を伸ばす',
  ratio667x375>2&&ratio667x375<=M.RHYTHM_LANDSCAPE_TRAVEL_RATIO_MAX,ratio667x375.toFixed(3));
check('プレイエリアが低いほど比率が大きい(単調)',
  ratio667x375>=ratio844x390&&ratio844x390>ratio926x428);

// ── 伸ばし過ぎない上限がある ─────────────────────────────────────────────────
check('極端に低いプレイエリアでも上限で頭打ちになる',
  M.rhythmTravelMsHeightRatio(10)===M.RHYTHM_LANDSCAPE_TRAVEL_RATIO_MAX);

// ── 壊れた値でも落ちない ─────────────────────────────────────────────────────
check('高さが取れない(undefined/0/NaN)ときは比率1で安全側に倒す',
  M.rhythmTravelMsHeightRatio(undefined)===1
  &&M.rhythmTravelMsHeightRatio(0)===1
  &&M.rhythmTravelMsHeightRatio(NaN)===1
  &&M.rhythmTravelMsHeightRatio(-100)===1);

// ── ノーツ速度設定の基準値そのものは変更していない ──────────────────────────
check('ノーツ速度設定(6.0=2150ms)そのものは変更していない',M.rhythmTravelMsForSpeed(6)===2150);
check('比率を掛ける前の基準travelMsの範囲・刻みは変更していない',
  M.RHYTHM_NOTE_SPEED_MIN===1&&M.RHYTHM_NOTE_SPEED_MAX===12);

// ── 本体への結線 ────────────────────────────────────────────────────────────
check('本体のtickは横画面のときだけ高さ比率を掛ける(縦画面の小さい端末には適用しない)',
  /travelMs=rhythmTravelMsForSpeed\(settings\.noteSpeed\)\*\(isLandscapeRef\.current\?rhythmTravelMsHeightRatio\(travel\?\.playAreaHeight\):1\)/.test(game));
check('プレイエリアが測れないとき(travelがnull)は比率1で安全に倒れる',
  /rhythmTravelMsHeightRatio\(travel\?\.playAreaHeight\)/.test(game));
const scheduleTickDeps=game.match(/const scheduleTick=useCallback\(\(\)=>\{[\s\S]*?\},\[([^\]]*)\]\);/)?.[1]||'';
check('scheduleTickの依存配列を抽出できる',!!scheduleTickDeps);
check('向き判定はrefで持ち、プレイ中の回転でも即座に反映する(次のpause/resumeまで古い値のまま、にしない)',
  /const isLandscapeRef=useRef\(isLandscape\);/.test(game)
  &&/isLandscapeRef\.current=isLandscape;/.test(game)
  &&!/\bisLandscape\b/.test(scheduleTickDeps));
// オプション画面の表示(現在 約○○ms)は設定の基準値を見せるだけで、高さ比率は含めない
// (向きで変わる値を設定画面の説明文に混ぜると、実機ごとに違う数字が出てかえって分かりにくいため)
check('オプション画面の説明は基準travelMsを表示するだけ(高さ比率を混ぜない)',
  /rhythmTravelMsForSpeed\(draft\.noteSpeed\)\.toLocaleString\(\)/.test(game)
  &&!/rhythmTravelMsForSpeed\(draft\.noteSpeed\)\*rhythmTravelMsHeightRatio/.test(game));

// ── 守るもの(判定・BPM・noteTime・判定窓・スコア式には一切関与しない) ────────
const tickBody=game.match(/const tick=\(frameNowMs\)=>\{[\s\S]*?frameRef\.current=requestAnimationFrame\(tick\);\};/)?.[0]||'';
check('見た目の飛行時間の調整は判定(applyJudgment)より前で完結し、判定条件そのものは変えない',
  !!tickBody&&/travelMs=rhythmTravelMsForSpeed/.test(tickBody));
check('判定はsongTimeMsとnote.timeMsの実時間比較のままで、travelMsを判定条件に使っていない',
  !/applyJudgment\([^)]*travelMs/.test(game));
const judgments=game.match(/const RHYTHM_JUDGMENTS = [\s\S]*?\n\]\);/)?.[0]
  ||read('monster-hero/data/rhythm-mode.js').match(/const RHYTHM_JUDGMENTS = [\s\S]*?\n\]\);/)?.[0]||'';
check('判定窓は変更していない',
  ['windowMs:25','windowMs:50','windowMs:100','windowMs:150','windowMs:200'].every(w=>judgments.replace(/\s/g,'').includes(w)));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
