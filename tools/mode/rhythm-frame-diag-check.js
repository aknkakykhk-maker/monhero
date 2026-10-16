// 1コマの重さを、タッチの診断の行(rhythm_touch_diagnostics の stats.frame)へ足す仕組みの見張り(2026-10-11)。
// 社長「実機の数字で、2D と GPU のどちらが iPhone で軽いかを決める」。決まり: 表・SQL・ランキングは変えない・既存の stats の項目は消さず足すだけ・
// 送る大きさを増やしすぎない・frame の無い古い行を読んでも壊れない・ボットからは送らない。
//   node tools/mode/rhythm-frame-diag-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const mode=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
// 1. 数える部品だけを取り出して動かす
const block=mode.match(/const RHYTHM_FRAME_DIAG=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/)?.[0];
check('数える部品(RHYTHM_FRAME_DIAG)がある',!!block);
if(block){
  const ctx={};vm.runInNewContext(`${block}\nthis.D=RHYTHM_FRAME_DIAG;`,ctx);const D=ctx.D;
  D.reset();
  let t=1000;for(let i=0;i<1000;i++){t+=i%50===49?40:16.7;D.tick(t,i%100===0?12.4:3.2);}
  D.tick(t+5000,3);// アプリを離れた(1秒以上)は数えない
  const s=D.snapshot({draw:'gpu',gpu:'Apple GPU',dpr:3,w:844,h:390,cores:6,effect:'NORMAL',fps:'AUTO',light:false});
  check('コマの数と平均',s.n===999&&Math.abs(s.avg-17.2)<.2,`n=${s.n} avg=${s.avg}`);
  check('16.7/33.3/50ms を超えたコマを数える',s.over17===20&&s.over34===20&&s.over50===0,`${s.over17}/${s.over34}/${s.over50}`);
  check('95% と最長(1秒以上の間隔は数えない)',s.p95===16&&s.max===40,`p95=${s.p95} max=${s.max}`);
  check('ゲームの1コマの JS の時間',Math.abs(s.tickAvg-3.29)<.05&&s.tickP95===3,`avg=${s.tickAvg} p95=${s.tickP95}`);
  check('描き方などを一緒に入れる',s.draw==='gpu'&&s.gpu==='Apple GPU'&&s.dpr===3);
  const bytes=Buffer.byteLength(JSON.stringify(s));
  check('送る大きさが小さい(400バイト未満。stats は4KBまで)',bytes<400,`${bytes}バイト`);
  D.reset();const z=D.snapshot();
  check('演奏の始めに数え直す・数が無いときは null',z.n===0&&z.avg===null&&z.tickAvg===null&&z.p95===null);
}
// 2. 演奏画面: 足すだけ・壊れても診断の行は送れる
check('診断の行の stats に frame を足すだけ(既存の timing などは残す)',/timing:RHYTHM_TIMING_DIAG\.snapshot\(\),[\s\S]{0,80}\.\.\.\(frame&&typeof frame==='object'\?\{frame\}:\{\}\)/.test(play));
check('frame は失敗したら null(診断の行は送れる)',/const rhythmFrameDiagOf=\(\)=>\{try\{[\s\S]*?\}catch\(e\)\{return null;\}\};/.test(play));
check('毎コマ数える(計測ON/OFFに関係なく)',/RHYTHM_FRAME_DIAG\.tick\(frameNowMs,/.test(play)&&!/if\(RHYTHM_PERF\.enabled\)RHYTHM_FRAME_DIAG/.test(play));
check('演奏の始めに数え直す',/RHYTHM_FRAME_DIAG\.reset\(\)/.test(play));
check('デバッグ・練習・判定調整からは送らない(今までどおり)',/const touchDiag=!debugPlay&&!tutorial&&!calibrating\?(rhythmTouchDiagWithMon\()?rhythmTouchDiagOf\(\{[^)]*frame:rhythmFrameDiagOf\(\)\}\)(,RHYTHM_FRAME_DIAG\.monSnapshot\(\)\))?:null;/.test(play));
// モンスターノーツの前後(2026-10-16): stats.mon は行の大きさの上限(4KB)を超えないよう削ってから足す
check('モンスターノーツの前後は大きさを見て削ってから足す(stats.mon)',/const rhythmTouchDiagWithMon=[\s\S]{0,600}RHYTHM_TOUCH_DIAG_MON_MAX[\s\S]{0,400}list\.pop\(\)/.test(play)&&/RHYTHM_FRAME_DIAG\.mark\(songTimeMs,judgment,/.test(play));
// 3. 読む側: frame の無い古い行・壊れた行を読んでも壊れない
const {frameSummary}=require(path.join(ROOT,'tools/mode/rhythm-touch-diag.js'));
const rows=[
  {platform:'ios',created_at:'2026-10-11T00:00:00Z',stats:{inputs:100,timing:{frames:3000}}},// 古い行(frame なし)
  {platform:'ios',created_at:'2026-10-11T00:00:00Z',stats:{frame:'壊れた'}},
  {platform:'ios',created_at:'2026-10-11T00:00:00Z',stats:null},
  {platform:'ios',created_at:'2026-10-11T00:00:00Z',stats:{frame:{n:1000,avg:17,tickAvg:4,over34:10,draw:'gpu',gpu:'Apple GPU'}}},
  {platform:'ios',created_at:'2026-10-11T00:00:00Z',stats:{frame:{n:1000,avg:20,tickAvg:6,over34:30,draw:'2d'}}},
];
let out=null,err=null;try{out=frameSummary(rows);}catch(e){err=e;}
check('frame の無い古い行・壊れた行を読み飛ばす',!err&&out.length===2&&out.find(g=>g.key==='ios:gpu').plays===1,err?String(err):JSON.stringify(out));
// 4. 表・SQL・ランキングに触れていない
const sb=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/26-supabase.jsx'),'utf8');
check('送り先は今までどおり rhythm_touch_diagnostics だけ',/const RHYTHM_TOUCH_DIAG_TABLE = 'rhythm_touch_diagnostics';/.test(sb)&&!/frame/.test((sb.match(/rhythmTouchDiag[\s\S]{0,400}/)||[''])[0]));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
