// 音ゲーの性能計測(デバッグ限定)が、計測のために本体を重くしていないかを確かめる。
//
// 実機で音ゲー中のカクつきが報告されている。原因を断定せず切り分けるための計測を入れたが、
// 計測そのものが負荷になっては本末転倒なので、次を固定する。
//
//   ・既定はOFF。OFFのあいだは加算も配列追加も一切しない
//   ・計測のために requestAnimationFrame を増やさない(本体のrAFのタイムスタンプを使う)
//   ・記録先は新しい保存キー(mh_rhythm_perf_v1)に分け、既存の音ゲー設定・BESTへ触らない
//   ・判定窓 / BPM / noteTime / スコア式 / 譜面データは変更しない
//   ・デバッグ専用なので更新履歴・ヘルプへは載せない(CLAUDE.md ⑤の但し書き)
//
//   node tools/mode/rhythm-perf-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const changelog=read('monster-hero/data/changelog.js');
const help=read('monster-hero/data/help.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 記録器を取り出して、実際に動かして確かめる ──────────────────────────────
const block=data.match(/const RHYTHM_PERF_KEY=[\s\S]*?\n\}\)\(\);/)?.[0];
check('性能計測の実装を抽出できる',!!block);
if(!block){process.exit(1);}
const context={localStorage:undefined};
vm.createContext(context);
vm.runInContext(`${block}\nthis.out={RHYTHM_PERF,RHYTHM_PERF_KEY,RHYTHM_PERF_LONG_MS};`,context);
const {RHYTHM_PERF,RHYTHM_PERF_KEY,RHYTHM_PERF_LONG_MS}=context.out;

check('既定はOFF',RHYTHM_PERF.enabled===false);
check('記録先は新しい保存キーへ分けてある',RHYTHM_PERF_KEY==='mh_rhythm_perf_v1');
check('遅いフレームのしきい値は16.7 / 25 / 33ms',JSON.stringify(RHYTHM_PERF_LONG_MS)==='[16.7,25,33]');

// OFFのあいだは何を呼んでも記録が増えない = 計測のための負荷が乗らない
[0,16,32,48].forEach(t=>RHYTHM_PERF.frame(t));
RHYTHM_PERF.layoutRead();RHYTHM_PERF.domQuery();RHYTHM_PERF.slidePolygons(40);RHYTHM_PERF.gestureFrame();
const off=RHYTHM_PERF.snapshot();
check('OFFのあいだは一切記録しない',
  off.frames===0&&off.layoutReadsPerFrame===0&&off.domQueriesPerFrame===0&&off.slidePolygonsPerFrame===0&&off.gestureFrames===0);

RHYTHM_PERF.setEnabled(true);
check('ONへ切り替えられる(localStorageが無くても落ちない)',RHYTHM_PERF.enabled===true);
// 16ms→50ms→16ms の3フレーム。50msは16.7/25/33のすべてを超える
[0,16,66,82].forEach(t=>RHYTHM_PERF.frame(t));
RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();
RHYTHM_PERF.domQuery();RHYTHM_PERF.slidePolygons(30);RHYTHM_PERF.gestureFrame();
const on=RHYTHM_PERF.snapshot();
check('フレーム数は「間隔の数」で数える',on.frames===3,`${on.frames}`);
check('最悪フレームを拾う',Math.abs(on.maxMs-50)<1e-9,`${on.maxMs}ms`);
check('16.7 / 25 / 33ms超をそれぞれ数える',on.over16===1&&on.over25===1&&on.over33===1,
  `16超=${on.over16} 25超=${on.over25} 33超=${on.over33}`);
check('平均fpsを出せる',Math.abs(on.fps-(1000*3/82))<1e-6,on.fps.toFixed(2));
check('1フレームあたりへ割って出す',
  Math.abs(on.layoutReadsPerFrame-1)<1e-9&&Math.abs(on.slidePolygonsPerFrame-10)<1e-9,
  `layout=${on.layoutReadsPerFrame} slide=${on.slidePolygonsPerFrame}`);

// 一時停止やバックグラウンド復帰の巨大な間隔を平均へ混ぜない
RHYTHM_PERF.reset();
[0,16,5000,5016].forEach(t=>RHYTHM_PERF.frame(t));
const gap=RHYTHM_PERF.snapshot();
check('数秒空いた間隔は数えない(一時停止・復帰で平均が壊れない)',gap.frames===2&&gap.maxMs<100,
  `frames=${gap.frames} max=${gap.maxMs}`);

RHYTHM_PERF.setEnabled(false);
check('OFFへ戻せる',RHYTHM_PERF.enabled===false);

// ── 実装への結線 ────────────────────────────────────────────────────────
check('計測のためにrequestAnimationFrameを増やしていない(本体のrAFの時刻を使う)',
  /const tick=\(frameNowMs\)=>\{RHYTHM_PERF\.frame\(frameNowMs\);/.test(game)
  &&!/RHYTHM_PERF[\s\S]{0,200}requestAnimationFrame/.test(data.match(/const RHYTHM_PERF=[\s\S]*?\n\}\)\(\);/)?.[0]||''));
check('毎フレームのgeometry測定(measureTravel)を数えている',
  /measureTravel=useCallback[\s\S]{0,220}RHYTHM_PERF\.layoutRead\(\)/.test(game));
check('ジェスチャー側の別rAFのフレーム数を数えている',
  /RHYTHM_PERF\.gestureFrame\(\);\s*\n\s*if\(sessions\.size/.test(data));
check('入力のたびのDOM検索と強制レイアウトを数えている',
  /RHYTHM_PERF\.domQuery\(\);\s*\n\s*const area=document\.querySelector\('\[data-rhythm-play-area\]'\)/.test(data)
  &&/RHYTHM_PERF\.layoutRead\(\);\s*\n\s*const rect=area\.getBoundingClientRect\(\)/.test(data));
check('SLIDE帯のpolygon更新数を数えている',/RHYTHM_PERF\.slidePolygons\(polygons\.length\)/.test(data));
// 発光の要素はキャッシュするようになったので、実際に引き直したときだけ数える
check('サブレーン発光は引き直したときだけDOM検索として数える',
  /if\(!glowNodes[\s\S]{0,80}RHYTHM_PERF\.domQuery\(\);\s*\n\s*glowNodes=Array\.from\(document\.querySelectorAll\('\[data-rhythm-sublane-feedback\]'\)\)/.test(data));

// ── デバッグ画面の中だけに置く ──────────────────────────────────────────
check('計測UIは音ゲーデバッグ画面の設定タブの中にある',
  game.includes('<section data-rhythm-perf-panel')
  &&/rhythmDebugTab!=='settings'[\s\S]{0,400}data-rhythm-perf-panel/.test(game));
check('計測UIは既定OFFの状態から始まる',game.includes("useState(()=>RHYTHM_PERF.enabled)"));
// デバッグ専用の機能は更新履歴・ヘルプへ載せない(CLAUDE.md ⑤)
check('デバッグ専用なので更新履歴へ載せていない',!/性能計測/.test(changelog));
check('デバッグ専用なのでヘルプへ載せていない',!/性能計測/.test(help));

// ── 守るもの(計測で触っていないこと) ────────────────────────────────────
const judgments=data.match(/const RHYTHM_JUDGMENTS = [\s\S]*?\n\]\);/)?.[0]||'';
check('判定窓は変更していない',
  ['windowMs:25','windowMs:50','windowMs:100','windowMs:150','windowMs:200'].every(w=>judgments.replace(/\s/g,'').includes(w)),
  judgments?'':'抽出できず');
check('スコアの重み(判定90% / コンボ10%)は変更していない',
  /RHYTHM_SCORE_WEIGHTS\s*=\s*Object\.freeze\(\{\s*judgment:\s*\.9\s*,\s*combo:\s*\.1\s*\}\)/.test(data.replace(/\n/g,'')));
check('既存の保存キーを増減していない',
  game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")
  &&game.includes("RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1'"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
