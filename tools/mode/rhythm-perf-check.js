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
// 呼び出し側が要素を持っているときは querySelector を省くので const 宣言とは限らない
// 2026-09-06: 箱の測定は RHYTHM_VIEW_ROTATION.rectOf(area) を通すようになった
// (自前で画面を回すため。回していないときは getBoundingClientRect の値をそのまま返す)。
// 見たいこと(DOM検索と強制レイアウトを数えている)は変わっていない。
check('入力のたびのDOM検索と強制レイアウトを数えている',
  /RHYTHM_PERF\.domQuery\(\);\s*\n\s*(?:const )?area=document\.querySelector\('\[data-rhythm-play-area\]'\)/.test(data)
  &&/RHYTHM_PERF\.layoutRead\(\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*const rect=RHYTHM_VIEW_ROTATION\.rectOf\(area\)/.test(data));
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
  ['windowMs:55','windowMs:100','windowMs:150','windowMs:200','windowMs:240'].every(w=>judgments.replace(/\s/g,'').includes(w)),
  judgments?'':'抽出できず');
check('スコアの重み(判定90% / コンボ10%)は変更していない',
  /RHYTHM_SCORE_WEIGHTS\s*=\s*Object\.freeze\(\{\s*judgment:\s*\.9\s*,\s*combo:\s*\.1\s*\}\)/.test(data.replace(/\n/g,'')));
check('既存の保存キーを増減していない',
  game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")
  &&game.includes("RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1'"));

// --- 毎フレームの無駄を作らない（実機のカクつき対策・2026-09-03） ---
// どれも「同じ値を書き直さない」「変わらないものを測り直さない」だけで、
// 見た目・判定・スコア・落下速度は変えていない。戻すとカクつきが再発する。
const gameSrc=require('fs').readFileSync(require('path').join(__dirname,'..','..','monster-hero/src/game-system.jsx'),'utf8');
check('プレイエリアの寸法を毎フレーム測り直さない（覚えておく）',
  gameSrc.includes('const travelCacheRef=useRef(null);')
  &&gameSrc.includes('const cached=travelCacheRef.current;\n  if(cached)return cached;'));
check('画面の大きさが変わったら測り直す',
  gameSrc.includes("window.addEventListener('resize',invalidate)")
  &&gameSrc.includes("window.addEventListener('orientationchange',invalidate)"));
// 2026-09-05: 「高さが0でなければ覚える」では足りなかった。
// 組み上がっていない最中のプレイエリアは 844pxの画面で 3352px あり、
// その値を覚え込んでノーツが画面の外に置かれたまま戻らなくなっていた(実機の指摘)。
// いまは「遊べる形になっているか」を確かめてから覚える。
// 実際にその通り動くかは tools/mode/rhythm-first-run-layout-check.js が見る
check('組み上がっていない値は覚えない',
  gameSrc.includes('if(ready)travelCacheRef.current=result;')
  &&gameSrc.includes('const rhythmTravelLooksReady=')
  &&gameSrc.includes('areaRect.height>viewportHeight*1.5'));
check('プレイエリアの大きさが変わったら覚え直す',
  gameSrc.includes('new ResizeObserver(()=>{travelCacheRef.current=null;})'));
// 2026-09-04: 実機で「ノーツを押したときにカクつく」報告を受けて足した3点。
// どれも「タップ1回あたりの仕事を減らす」ためのもので、判定・スコアには関与しない。
check('ノーツのDOMを毎回作り直さない(判定のたびの再生成を止める)',
  // canvas 化(2026-09-07)以降は「canvas のときはノーツ要素を作らない」分岐が入るが、useMemo で固定していることは同じ
  /const noteElements=useMemo\(\(\)=>(canvasNotes\?null:)?chart\.notes\.map/.test(gameSrc)
  &&/[{:]noteElements\}/.test(gameSrc)
  &&!/\{chart\.notes\.map\(\(note,index\)=>\{/.test(gameSrc));
check('レーン枠・サブレーン発光のDOMも毎回作り直さない',
  /const laneElements=useMemo\(\(\)=><>/.test(gameSrc)&&gameSrc.includes('{laneElements}'));
check('入力のrect取得はジェスチャー側と同じ1フレーム1回のキャッシュを共有する',
  gameSrc.includes('const inputAreaRect=area=>RHYTHM_GESTURE_RUNTIME.areaRect(area)||RHYTHM_VIEW_ROTATION.rectOf(area);')
  &&data.includes('invalidateAreaRect,areaRect,')
  &&!/const rect=area\.getBoundingClientRect\(\),live=new Set\(\)/.test(gameSrc)
  // 自前で画面を回したときも、覚えている箱は必ず捨てる(ズレると入力位置がずれる)
  &&data.includes('RHYTHM_VIEW_ROTATION.subscribe(invalidateAreaRect);'));
// 2026-09-04: 「指を触れていない降下中にもカクつく」報告を受けて足した3点。
// 実機で「絞り込みが本当に効いているか」まで分かるよう、走査数・実描画数に加えて
// 先頭スキップ数と絞り込みの有無も渡す形になった(推測で直さないための計測)。
check('毎フレームの走査数と実描画数を計測できる(長いフレームの切り分け用)',
  data.includes('notes(scanned,drawn,headSkipped,narrowed){if(!on)return;')
  &&data.includes('notesScannedPerFrame:per(acc.notesScanned)')
  &&data.includes('worstFrameScanned:acc.worstScanned')
  &&data.includes('headSkippedPerFrame:per(acc.headSkipped)')
  &&gameSrc.includes('RHYTHM_PERF.notes(perfScanned,perfDrawn,scanFrom,run.notesAscending);'));
// tick本体にかかった時間そのもの。これが分からないと、JSをいくら削っても
// 効かない場合に気づけない。ただしフレーム全体との差を「描画時間」とは呼べない
// (rAFの間隔には次のリフレッシュ待ち16.7msとコールバック外の処理が含まれる)。
// 言えるのは「tickの外で起きている時間」までで、そこから先は別に測る。rAFは増やさない。
// tickが0msでも「JSが無実」とは言えない(判定時のReact描画・GC・他のコールバックは
// このコールバックの外で走る)。そこで、フレームが始まってから実際にtickへ入るまでの
// 遅れも測る。遅れが大きいフレームは、tickへ入る前にメインスレッドが塞がっていた証拠。
check('tick本体の処理時間と、tickへ入るまでの遅れを計測できる(tickの中か外かの切り分け用)',
  data.includes('tick(ms,delayMs){if(!on)return;')
  &&data.includes('tickMsPerFrame:per(acc.tickMs)')
  &&data.includes('worstFrameTickMs:acc.worstTickMs')
  &&data.includes('tickDelayMsPerFrame:per(acc.tickDelayMs)')
  &&data.includes('worstFrameDelayMs:acc.worstDelayMs')
  &&gameSrc.includes('const perfTickStart=RHYTHM_PERF.enabled?performance.now():0;')
  &&gameSrc.includes('if(RHYTHM_PERF.enabled)RHYTHM_PERF.tick(performance.now()-perfTickStart,perfTickStart-frameNowMs);'));
check('will-changeは今動いているノーツにだけ付ける(全ノーツへ出しっぱなしにしない)',
  gameSrc.includes("const nextWillChange=visible?'transform, opacity':'';")
  &&!gameSrc.includes("willChange:'transform, opacity'"));
// 2026-09-04: iPhone SE2(1.00M画素)では滑らかなのに iPhone 16e(2.96M画素)でカクつく、
// という報告から。塗り直し(ラスタライズ)の重さは画素数に比例するため、画面の広い端末ほど
// 不利になり、発熱してGPUが絞られるとそのままカクつきになる。
// filterの値が毎フレーム変わる要素はGPUで動かすだけでは済まず毎フレーム塗り直しになるので、
// 「値が実際に変わったときだけ書く」形を固定する。戻すと発熱時に再発する。
check('ノーツの奥行き(scaleY)と明るさ(filter)を毎フレーム書き直さない',
  data.includes("const depthScale=(Math.round((0.56+projected.scale*.44)*100)/100).toFixed(2);")
  &&data.includes("const depthBrightness=(Math.round((0.72+projected.scale*.28)*100)/100).toFixed(2);")
  &&data.includes("if(el._rhythmDepthScale!==depthScale){")
  &&data.includes("if(el._rhythmDepthBrightness!==depthBrightness){")
  &&!data.includes("el.style.setProperty('--rhythm-note-depth-brightness',(0.72+projected.scale*.28).toFixed(3));"));
check('押している間だけ変わるHOLDのfilterを毎フレーム書き直さない',
  gameSrc.includes("if(el._rhythmHoldFilter!==holdFilter){el.style.filter=holdFilter;el._rhythmHoldFilter=holdFilter;}")
  &&!gameSrc.includes("el.style.filter=note.activePointerId!==null?'brightness(1.3)':'';"));
// 「変わったときだけ書く」を安全に成立させるには、styleを直接書き戻したときに
// 控えも捨てる必要がある。控えだけ古いと、同じ値と誤判定して書き込みを飛ばし、
// 実際の見た目とズレたまま固まる(例: 透明のまま出てこない)。
check('プレイ開始でstyleを戻すとき、覚えている値も一緒に捨てる',
  gameSrc.includes("el._rhythmHidden=false;el._rhythmOpacity=undefined;el._rhythmWillChange=undefined;el._rhythmFailedFlag=undefined;")
  &&gameSrc.includes("el._rhythmHoldBody=undefined;el._rhythmHoldFilter=undefined;el._rhythmDepthScale=undefined;el._rhythmDepthBrightness=undefined;"));

// 2026-09-04: 実機A/Bで、軽量モードONにすると33ms超が2.72%→0.55%(引っかかり79%減)になった。
// つまりカクつきは装飾のラスタライズが作っている「たまに跳ねる」問題。
// ただし見た目を落とす解決はしない。サブレーン発光を自前の合成レイヤーへ載せると、
// ぼかし影が一度だけ焼かれ、以後はopacityの切り替えだけで済む(塗り直しが起きない)。
// 実測(Chromium・16e相当の画素数・5回の中央値)で、上位5%のフレーム時間が
// 5.00ms → 2.00ms(-60%)。装飾を全部外した場合(3.30ms)より速く、しかも見た目は同じ。
check('サブレーン発光は合成レイヤーへ載せ、タップのたびに影を焼き直さない',
  gameSrc.includes("willChange:settings.lightweightMode?'auto':'opacity'"));
// プレイエリア全面サイズのSVGは、幅・高さ・viewBoxが遊んでいるあいだ変わらない。
// 毎フレーム書き直すと中身の再構築を招くので、変わったときだけ書く。
check('SLIDE帯SVGの変わらない値(幅・viewBox)を毎フレーム書き直さない',
  data.includes("if(body._rhythmSlideArea!==slideArea){")
  &&data.includes("if(body._rhythmSlideLeft!==slideLeft){")
  &&!data.includes("body.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);\n    const polygons="));

// ★2026-09-07・ユーザー指摘「モンスターノーツとフリックノーツによく分からない縦線がある」。
//   ノーツの子は [hold-body] → [end-bar] → [note-head] → (絵があれば)[monster-face] の順なので、
//   マスモンの絵が入るノーツでは **最後のspanが絵** になる。span:last-child で装飾を書くと
//   色も枠も光も絵のほうへ付いてしまう。粒は必ず [data-rhythm-note-head] で名指しする。
//   注意書き自体に span:last-child と書くので、まず /* … */ のコメントを外してから見る
{
  const indexHtml=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
  const noteDecorLastChild=(src)=>src.replace(/\/\*[\s\S]*?\*\//g,'').split('\n')
    .filter(line=>line.includes('data-rhythm-note')&&line.includes('span:last-child'))
    .map(line=>line.trim().slice(0,80));
  for(const [name,src] of [['index.html',indexHtml],['data/rhythm-mode.js',data]]){
    const bad=noteDecorLastChild(src);
    check(`${name}: ノーツの装飾を span:last-child で書いていない(マスモンの絵に当たる)`,
      bad.length===0,bad[0]||'');
  }
  // 2026-09-07・実機「モンスターノーツを取ったあとに飛ぶ」。光の脈動は opacity だけで動かし、
  // 弾ける演出(0.26秒)のあいだは影付きの外周の光・絵のぼかしを外す。
  check('モンスターノーツの光の脈動は opacity だけ(box-shadow をキーフレームで変えない)',
    /@keyframes rhythmMonsterNoteAura \{\s*from \{ opacity:[\d.]+; \}\s*to \{ opacity:[\d.]+; \}\s*\}/.test(indexHtml));
  check('弾ける演出のあいだは外周の光・絵のぼかしを外す',
    indexHtml.includes('[data-rhythm-note][data-rhythm-clear] > [data-rhythm-note-head]::before,')
    &&indexHtml.includes('[data-rhythm-note][data-rhythm-clear] > [data-rhythm-note-head]::after { display:none; }')
    &&indexHtml.includes('[data-rhythm-note][data-rhythm-clear] > [data-rhythm-monster-face] { filter:none !important; }'));
  // 2026-09-07: 「幅は scaleX・帯は scaleY・明るさは影の層・粒を別レイヤーへ」の発熱対策は iPhone で
  // 以前よりカクついたため撤回した(docs/spec/RHYTHM_MODE.md)。戻ってきていないことを見張る。
  check('撤回した発熱対策(scaleX の幅・影の層・別レイヤー・帯の scaleY)が戻ってきていない',
    !data.includes('--rhythm-note-width-scale')&&!data.includes('data-rhythm-note-shade')
    &&!data.includes('rhythmHoldBodyBaseHeight')&&!data.includes('data-rhythm-live')
    &&!gameSrc.includes('data-rhythm-note-shade')&&!indexHtml.includes('data-rhythm-note-shade'));
}
// ★矢印は粒の ::after ではなく実体のある要素で描く。幅広ノーツ(5サブレーン以上)の両端の縁取りが
//   粒の ::before/::after を使っているため、疑似要素で矢印を作ると幅広のFLICKで場所を取り合う。
check('FLICKの矢印は疑似要素ではなく [data-rhythm-flick-arrow] という要素で描く(幅広ノーツの縁取りと衝突させない)',
  data.includes('[data-rhythm-flick-arrow]{position:absolute;')
  &&data.includes('clip-path:polygon(50% 0,100% 100%,0 100%);')
  &&gameSrc.includes("note.type==='FLICK'&&<i data-rhythm-flick-arrow aria-hidden=\"true\"/>")
  &&!/\[data-note-type="FLICK"\][^\n]*::after\{content:"▲"/.test(data));

check('失敗表示フラグをdatasetから毎フレーム読み直さない',
  gameSrc.includes('el._rhythmFailedFlag!==failedFlag')
  &&!gameSrc.includes('el.dataset.rhythmFailed!==failedFlag'));
check('サブレーン発光は要素を覚えて、変わったところだけ書き換える',
  gameSrc.includes('glowNodesRef=useRef(null)')
  &&/nodes=glowNodesRef\.current=Array\.from\(area\.querySelectorAll\('\[data-rhythm-sublane-feedback\]'\)\)/.test(gameSrc)
  &&!/area\.querySelectorAll\('\[data-rhythm-sublane-feedback\]'\)\.forEach/.test(gameSrc));
check('終わったノーツへ毎フレーム同じ指示を書き直さない',
  gameSrc.includes('if(el._rhythmHidden!==true){')&&gameSrc.includes('el._rhythmHidden=true;'));
check('見え方が変わったときだけ書き込む',gameSrc.includes('if(el._rhythmOpacity!==nextOpacity){'));
check('能力が動いていないあいだは表示の文字列を組み立てない',
  gameSrc.includes('const hasAbilityBadge=badge&&(')&&gameSrc.includes('if(hasAbilityBadge){'));

check('ノーツ横位置は毎フレームleftを書かず独立translateで動かす',
  data.includes("if(el._rhythmPositionOrigin!==true){el.style.left='0px';el._rhythmPositionOrigin=true;}")
  &&data.includes("el.style.translate=nextTranslate")
  &&!data.includes("el.style.left=\`\${left.toFixed(2)}px\`;"));
check('TAP/FLICKで存在しないvisual bodyを毎フレーム再検索しない',
  data.includes("Object.prototype.hasOwnProperty.call(el,'_rhythmVisualBody')")
  &&data.includes("el._rhythmVisualBody=body||null;")
  &&data.includes("RHYTHM_PERF.domQuery();body=el.querySelector('[data-rhythm-hold-body],[data-rhythm-slide-body]')"));

// --- 2026-09-05 の最適化(ユーザー指示「カクつき防止用の最適化をゲームに影響のないように」) ---
check('縦位置は丸めた値が変わったときだけ書く',
  gameSrc.includes('const nextTransform=`translate3d(0,${yPx}px,0)`;')
  &&gameSrc.includes('if(el._rhythmTransform!==nextTransform){')
  &&!gameSrc.includes('yPx=Math.round(yPx);el.style.transform='));
check('SLIDEの帯の高さも変わったときだけ書く(HOLDと同じ扱い)',
  gameSrc.includes('if(el._rhythmSlideBody!==slideBody){')
  &&!/el\.style\.setProperty\('--rhythm-slide-height',`\$\{Math\.round\(bodyPx\)\}px`\)/.test(gameSrc));
check('書き込みを飛ばすための控えは、開始時にすべて捨てる',
  gameSrc.includes('el._rhythmTransform=undefined;')&&gameSrc.includes('el._rhythmSlideBody=undefined;'));

// --- 2026-09-05 の演出強化(判定ラインの拍) ---
// 演出を足しても毎フレームのJSは増やさない。CSSアニメーションへ寄せる。
check('判定ラインの脈打ちはCSSアニメーションで、拍は開始時に一度書くだけ',
  data.includes('@keyframes mhRhythmLinePulse')
  &&data.includes('animation:mhRhythmLinePulse var(--rhythm-beat,500ms) ease-out infinite')
  &&gameSrc.includes("judgmentLineRef.current.style.setProperty('--rhythm-beat',`${sideBeatMs}ms`)"));
check('脈打ちで動かすのは厚みと濃さだけ(判定ラインの位置を変えない)',(()=>{
  const start=data.indexOf('@keyframes mhRhythmLinePulse');
  const block=data.slice(start,data.indexOf('}',data.indexOf('100%{',start)));
  return /transform:scaleY\(/.test(block)&&!/translate/.test(block)&&!/\btop\b|\bbottom\b/.test(block);
})());
check('軽量モード・演出量MINIMALでは脈打ちを止める',
  data.includes('[data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-judgment-line]')
  &&data.includes('[data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-judgment-line]'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
