#!/usr/bin/env node
// 公開中の曲の譜面が、知らないうちに1バイトも変わっていないかを見張る(2026-10-11・オンプくん。窓口の依頼)。
//
//   node tools/mode/rhythm-released-chart-lock-check.js                          # 見張る(CI でも回す)
//   node tools/mode/rhythm-released-chart-lock-check.js --update --reason "<理由>"  # 意図して変えたときだけ、控えを今の中身にする
//
// 【なぜ要るか】既存曲の譜面は変えない(tools/mode/CLAUDE.md ⑩-2)。
//   2026-10-11、新曲の仕上げ(rhythm-chart-v3-pipeline.js)が呼ぶ rhythm-overlap-reach-fix.js --write が公開中の全曲を回っていて、
//   新曲を作るたびに Sheriruth の HARD・EXPERT・MASTER のタップを1つ動かしていた。誰も気づかないまま main へ入った。
// 【何を見るか】rhythm-runtime-notes.js の RELEASED_MARKERS に載っている曲の、5難易度と HELL のマーカーの中身。
//   控え(rhythm-released-chart-lock.json)の指紋(sha256)と1つでも違えば NG。まだ控えに無い曲(新曲)は OK のまま知らせる。
//   意図した変更(社長・窓口が決めた直し)なら --update で控えを更新し、理由を控えの履歴に残す。
// あわせて、直しの道具が指定した曲の外へ書かないこと(--write には --song が要る・ほかの曲は1バイトも変えない)も確かめる。
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const {spawnSync}=require('child_process');
const rt0=require('./rhythm-runtime-notes.js');

const LOCK=path.join(__dirname,'rhythm-released-chart-lock.json');
const DIFFS=['easy','normal','hard','expert','master'];
const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
const source=fs.readFileSync(rt0.RUNTIME,'utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex').slice(0,16);
// 見張るのは、表に載っていて、しかも曲えらびに出ている(RHYTHM_DEMO_SONG_IDS)曲だけ。まだ公開していない曲(デバッグで確かめ中)は直してよい
const DEMO=new Set(rt0.loadRuntime().RHYTHM_DEMO_SONG_IDS||[]);
const current={};
for(const [songId,marker] of Object.entries(rt0.RELEASED_MARKERS).filter(([id])=>DEMO.has(id)))for(const d of DIFFS){
  const block=rt0.markerBlock(source,`${marker}-${d}`);if(block)current[`${songId}/${d}`]=hash(block.body);}
// HELL も見張る(2026-10-21 社長「HELL も指紋で見張る」)。HELL は試作の枠の曲に入っていて上の表の外だったので、作り直しても気づけなかった。
//   ふつうは曲のマーカーの -hell。Grievous Lady の HELL だけは別の名前のマーカー
const HELL_MARKERS={grievous_lady:'grievous-lady-hell'};
for(const [songId,marker] of Object.entries(rt0.RELEASED_MARKERS).filter(([id])=>DEMO.has(id))){
  const block=rt0.markerBlock(source,HELL_MARKERS[songId]||`${marker}-hell`);if(block)current[`${songId}/hell`]=hash(block.body);}

if(args.includes('--update')){
  const reason=argOf('--reason');if(!reason)throw new Error('--reason "<理由>" が要る(だれが決めた、どの直しか)');
  const old=fs.existsSync(LOCK)?JSON.parse(fs.readFileSync(LOCK,'utf8')):{charts:{},history:[]};
  const changed=Object.keys(current).filter(k=>old.charts[k]!==current[k]);
  const at=new Date(Date.now()+9*3600e3).toISOString().slice(0,16).replace('T',' ');
  const next={note:'公開中の譜面の指紋。勝手に書き換えない。意図して変えたときだけ rhythm-released-chart-lock-check.js --update --reason で更新する',
    charts:current,history:[...(old.history||[]),{at,reason,...(changed.length<=20?{changed}:{changedCount:changed.length})}]};
  fs.writeFileSync(LOCK,JSON.stringify(next,null,1)+'\n');
  console.log(`控えを更新した(${changed.length}譜面): ${changed.join(' ')||'なし'}`);
  // 公開中の譜面のノーツを動かしたら、押せない配置と手の決まりも必ず見る(2026-10-12: #2808 でタップを1つ戻したら押せない近さの2音になり、#2821 で遊ばれていた形へ戻した)
  if(changed.length)console.log('  続けて回す: node tools/mode/rhythm-overlap-reach-check.js && node tools/mode/rhythm-chart-hand-rules-check.js(遊ばれていた形を変えるときは、変える前の形が何を避けていたかも確かめる)');
  process.exit(0);
}

let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'} ${name}${!cond&&detail?` — ${detail}`:''}`);if(!cond)failed++;};
const lock=JSON.parse(fs.readFileSync(LOCK,'utf8'));
const changed=Object.keys(lock.charts).filter(k=>current[k]!==undefined&&current[k]!==lock.charts[k]);
const missing=Object.keys(lock.charts).filter(k=>current[k]===undefined);
const unlocked=Object.keys(current).filter(k=>lock.charts[k]===undefined);
ok(`公開中の譜面(${Object.keys(lock.charts).length}譜面)が控えと1バイトも変わらない`,!changed.length,
  `変わった: ${changed.join(' ')}。意図した変更なら node tools/mode/rhythm-released-chart-lock-check.js --update --reason "<理由>"、そうでなければ元へ戻す`);
ok('控えにある譜面が消えていない',!missing.length,missing.join(' '));
// 目印の行(// <…-notes>)にノーツが乗っていない。乗っているとコメントとして読み飛ばされ、ゲームからそのノーツが消える
// (2026-10-12: HELL の道具が改行なしで書き込み、Sheriruth HELL・風がそよぐ場所 HELL の最初の4ノーツが落ちていた)
{const onMarker=[...source.matchAll(/\/\/ <([a-z0-9-]+)-notes>([^\n]*)/g)].filter(m=>/[tThHfFsS]\(/.test(m[2])).map(m=>m[1]);
  ok('目印の行にノーツが乗っていない(コメントとして読み飛ばされない)',onMarker.length===0,onMarker.join(' '));}
if(unlocked.length)console.log(`(まだ控えに無い譜面 ${unlocked.length}: ${unlocked.join(' ')}。公開したら --update で控えに入れる)`);

// 直しの道具の書き方
const FIX=path.join(__dirname,'rhythm-overlap-reach-fix.js');
const run=extra=>spawnSync(process.execPath,[FIX,...extra],{encoding:'utf8',maxBuffer:64*1024*1024});
const before=hash(source);
const noSong=run(['--write']);
ok('直しの道具: --write に --song が無ければ止まり、何も書かない',noSong.status!==0&&hash(fs.readFileSync(rt0.RUNTIME,'utf8'))===before,(noSong.stdout||'')+(noSong.stderr||''));
const unknown=run(['--write','--song','no_such_song']);
ok('直しの道具: 公開中の曲の表に無い曲は止まる',unknown.status!==0);
const tmp=path.join(os.tmpdir(),`rhythm-mode-fix-${process.pid}.js`);
const target=Object.keys(rt0.RELEASED_MARKERS).slice(-1)[0];
const one=run(['--write','--song',target,'--out',tmp]);
const out=fs.existsSync(tmp)?fs.readFileSync(tmp,'utf8'):source;
const others=Object.entries(rt0.RELEASED_MARKERS).filter(([id])=>id!==target).flatMap(([,m])=>DIFFS.map(d=>`${m}-${d}`));
const touched=others.filter(name=>{const a=rt0.markerBlock(source,name),b=rt0.markerBlock(out,name);return (a&&a.body)!==(b&&b.body);});
ok(`直しの道具: --song ${target} はほかの曲のマーカーを1バイトも変えない`,one.status===0&&!touched.length,touched.join(' ')||(one.stderr||''));
ok('直しの道具: rhythm-mode.js そのものには書いていない(--out の先だけ)',hash(fs.readFileSync(rt0.RUNTIME,'utf8'))===before);
try{fs.unlinkSync(tmp);}catch(e){}
const pipe=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8');
ok('新曲の仕上げは、作った曲だけを指定して直しの道具を呼ぶ(--song)',/rhythm-overlap-reach-fix\.js'\),'--write','--song'/.test(pipe));

console.log(failed?`\n${failed}件 NG`:'\nすべて OK');
process.exit(failed?1:0);
