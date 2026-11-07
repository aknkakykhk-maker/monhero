#!/usr/bin/env node
// 公開中の曲の音源が、ノーツとの合い方を変えていないかを見張る(2026-11-07・ビート部 マモリ)。
//
//   node tools/mode/rhythm-released-audio-lock-check.js                          # 見張る(CI でも回す)
//   node tools/mode/rhythm-released-audio-lock-check.js --update --reason "<理由>"  # 音源を意図して差し替えたときだけ控えを更新(ffmpeg が要る)
//   node tools/mode/rhythm-released-audio-lock-check.js --root <フォルダ> --print [--against <控え>]  # 別のチェックアウトの音源を測って出すだけ(控えと重ねたずれも)
//
// 【なぜ要るか】譜面の0秒は音源の0秒(曲ごとのずらしは持っていない)。音源を作り直して頭の無音が数十ms増えると、
//   譜面のデータが同じでも全ノーツが音から遅れる。2026-11-02 に全曲を 44.1kHz/128kbps へ作り直した。
//   社長「既存曲ちょこちょこ勝手に変わる」(2026-11-07)。
// 【何を見るか】曲えらびに出ている曲の音源(BGM_TRACKS の src)ごとに
//   ・頭の無音の長さ(最初に -60dBFS を超える所)
//   ・オフセット = 譜面の0秒と音の頭の対応(控えに持った音の立ち上がりの並びと重ねて、いちばん合うずれ)
//   ・曲の長さ
//   を ms で測り、控え(rhythm-released-audio-lock.json)と比べてオフセット・長さが 5ms、頭の無音が 10ms を超えてずれたら NG。
//   ファイルの指紋(sha256)が控えと同じなら測り直さない(本番の CI には ffmpeg が無いので、指紋だけで見る)。
//   指紋が違うのに ffmpeg が無ければ測れないので NG(ffmpeg のある所で回して、ずれが無ければ --update)。
//   控えに無い曲(新曲)は OK のまま知らせる。
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const L=require('./rhythm-play-lock-lib.js');

const LOCK=path.join(__dirname,'rhythm-released-audio-lock.json');
const NOTE='公開中の曲の音源の控え(指紋・頭の無音・音の立ち上がりの並び・長さ。ms)。勝手に書き換えない。音源を意図して差し替えたときだけ rhythm-released-audio-lock-check.js --update --reason で更新する';
// オフセットと長さは 5ms。頭の無音は、鳴り出しから始まる曲(MF × ICHIKA MIX など)では作り直すだけで最大5ms揺れたので 10ms
const TOLERANCE_MS=5,LEAD_TOLERANCE_MS=10;
const RATE=40000;
const SILENCE=Math.round(32768*10**(-60/20));
const args=process.argv.slice(2);
const root=L.rootFrom(args);
const FFMPEG=L.argOf(args,'--ffmpeg')||'ffmpeg';
const hasFfmpeg=()=>spawnSync(FFMPEG,['-version'],{encoding:'utf8'}).status===0;

// 曲 → 音源ファイル(ゲームが鳴らす BGM_TRACKS の src)
const songAudio=play=>{
  const src={};for(const m of play.parts.matchAll(/\{\s*id:\s*'([^']+)'[^{}]*?src:\s*'([^']+)'/g))if(!src[m[1]])src[m[1]]=m[2];
  const ids=new Set(play.RHYTHM_DEMO_SONG_IDS||[]);const out={};
  for(const song of play.RHYTHM_SONGS||[]){
    if(!ids.has(song.songId))continue;
    const s=src[song.bgmTrackId];
    const firstNoteMs=Math.min(...Object.values(song.difficulties||{}).flatMap(c=>c&&Array.isArray(c.notes)?c.notes.map(n=>Number(n.timeMs)):[]).filter(Number.isFinite));
    out[song.songId]={file:s?`monster-hero/${s.replace(/\?.*$/,'')}`:null,firstNoteMs:Number.isFinite(firstNoteMs)?firstNoteMs:null};
  }
  return out;
};
// 音源を 40kHz の1chへ戻して測る(ms・小数1桁)。40kHz なのは 5ms の刻みがちょうど200サンプルになるから
//   ・頭の無音: 最初に -60dBFS を超える所
//   ・オフセット: 音の立ち上がりの並び(5ms ごとの音の強さの増え方)を控えに持ち、今の音源をずらしながら重ねて、
//     いちばん合うずれを ms で出す。しきい値を超える所で測ると、フェードインのある曲は作り直すだけで 20ms 以上動くので使わない
//   ・長さ
const HOP=RATE/200,ENV_LEN_MS=15000,SEARCH_MS=400;
const decode=file=>{
  const r=spawnSync(FFMPEG,['-v','error','-i',file,'-ac','1','-ar',String(RATE),'-f','s16le','-'],{maxBuffer:1024*1024*1024});
  if(r.status!==0)throw new Error(`ffmpeg で読めない: ${file} ${String(r.stderr||'')}`);
  return new Int16Array(r.stdout.buffer,r.stdout.byteOffset,Math.floor(r.stdout.length/2));
};
const onsetCurve=pcm=>{
  const n=Math.floor(pcm.length/HOP),e=new Float64Array(n),o=new Float64Array(n);
  for(let i=0;i<n;i++){let sum=0;for(let j=i*HOP;j<(i+1)*HOP;j++)sum+=pcm[j]*pcm[j];e[i]=Math.log(1+sum/HOP);}
  for(let i=1;i<n;i++)o[i]=Math.max(0,e[i]-e[i-1]);
  return o;
};
const ms=n=>Math.round(n/RATE*1e4)/10;
const measure=(file,ref=null)=>{
  const pcm=decode(file);
  let lead=pcm.length;for(let i=0;i<pcm.length;i++)if(Math.abs(pcm[i])>=SILENCE){lead=i;break;}
  const o=onsetCurve(pcm);
  const out={leadSilenceMs:ms(lead),durationMs:ms(pcm.length)};
  if(!ref){
    // 控えに持つ並び: 頭の無音の少し前から15秒ぶん。0〜255 に丸めて base64
    const startFrame=Math.max(0,Math.floor(lead/HOP)-40),len=ENV_LEN_MS/5;
    const win=Array.from({length:len},(_,i)=>o[startFrame+i]||0),max=Math.max(...win)||1;
    out.onsetStartMs=startFrame*5;out.onset=Buffer.from(win.map(v=>Math.round(v/max*255))).toString('base64');
    out.offsetMs=0;
    return out;
  }
  // 控えの並びと重ねて、いちばん合うずれ(+ は今の音源のほうが遅い=ノーツより音が遅れる)
  const want=[...Buffer.from(ref.onset,'base64')],s0=ref.onsetStartMs/5,range=SEARCH_MS/5;
  const score=lag=>{let a=0,b=0,c=0;for(let i=0;i<want.length;i++){const x=want[i],y=o[s0+i+lag]||0;a+=x*y;b+=x*x;c+=y*y;}return b&&c?a/Math.sqrt(b*c):0;};
  let best=-range,bestScore=-1;const scores={};
  for(let lag=-range;lag<=range;lag++){if(s0+lag<0)continue;scores[lag]=score(lag);if(scores[lag]>bestScore){bestScore=scores[lag];best=lag;}}
  const l=scores[best-1],r=scores[best+1];let frac=0;
  if(l!==undefined&&r!==undefined){const den=l-2*bestScore+r;if(den<0)frac=0.5*(l-r)/den;}
  out.offsetMs=Math.round((best+frac)*5*10)/10;out.match=Math.round(bestScore*1000)/1000;
  return out;
};
const fileHash=abs=>crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0,16);

const collect=({force=false,lock={},against=null}={})=>{
  const play=L.loadPlay(root);const songs=songAudio(play);const ff=hasFfmpeg();const items={},errors=[];
  for(const [id,{file,firstNoteMs}] of Object.entries(songs)){
    const abs=file&&path.join(root,file);
    if(!abs||!fs.existsSync(abs)){errors.push(`${id}: 音源が見つからない(${file})`);continue;}
    const sha256=fileHash(abs);const old=lock[id];
    if(!force&&old&&old.sha256===sha256&&old.file===file){items[id]={...old,firstNoteMs};continue;}
    if(!ff){items[id]={file,sha256,firstNoteMs,measured:false};continue;}
    // 控えと比べるときは控えの並びに重ねてずれを出す(against)。控えを作るときは並びを作り直す
    const ref=against&&against[id]&&against[id].onset?against[id]:null;
    items[id]={file,sha256,...measure(abs,ref),firstNoteMs};
  }
  return {items,errors,ff};
};

if(require.main===module){
  if(args.includes('--print')){const lockFile=L.argOf(args,'--against');const against=lockFile?L.readLock(path.resolve(lockFile)).items:null;
    const {items,errors}=collect({force:true,against});for(const v of Object.values(items))delete v.onset;console.log(JSON.stringify({items,errors}));process.exit(0);}
  if(args.includes('--update')){
    const reason=L.argOf(args,'--reason');if(!reason)throw new Error('--reason "<理由>" が要る(だれが決めた、どの直しか)');
    if(!hasFfmpeg())throw new Error('ffmpeg が無いと音源を測れない(--ffmpeg <パス> でも渡せる)');
    const old=L.readLock(LOCK).items||{};
    const {items,errors}=collect({force:true});if(errors.length)throw new Error(errors.join('\n'));
    const changed=Object.keys(items).filter(k=>JSON.stringify(old[k])!==JSON.stringify(items[k]));
    L.writeLock(LOCK,NOTE,items,reason,changed);
    console.log(`控えを更新した(${changed.length}曲): ${changed.join(' ')||'なし'}`);
    process.exit(0);
  }
  const r=L.reporter();
  const lock=L.readLock(LOCK).items||{};
  const {items,errors,ff}=collect({lock,against:lock});
  r.ok('公開中の曲の音源がすべて見つかる',!errors.length,errors.join(' / '));
  const shifted=[],unmeasured=[],resaved=[];
  for(const [id,want] of Object.entries(lock)){
    const got=items[id];if(!got)continue;
    if(got.sha256===want.sha256&&got.file===want.file)continue;
    if(got.measured===false){unmeasured.push(id);continue;}
    const d=[['leadSilenceMs',(got.leadSilenceMs??0)-(want.leadSilenceMs??0)],['offsetMs',got.offsetMs??0],['durationMs',(got.durationMs??0)-(want.durationMs??0)]]
      .map(([k,v])=>[k,Math.round(v*10)/10]).filter(([k,v])=>Math.abs(v)>(k==='leadSilenceMs'?LEAD_TOLERANCE_MS:TOLERANCE_MS));
    if(d.length)shifted.push(`${id}(${d.map(([k,v])=>`${k} ${v>0?'+':''}${v}ms`).join('・')})`);else resaved.push(id);
  }
  r.ok(`公開中の曲(${Object.keys(lock).length}曲)の音源が、オフセット・長さとも控えから ${TOLERANCE_MS}ms、頭の無音が ${LEAD_TOLERANCE_MS}ms 以内`,!shifted.length,
    `ずれた: ${shifted.join(' ')}。音とノーツの時刻がずれる。直すか、決まった差し替えなら node tools/mode/rhythm-released-audio-lock-check.js --update --reason "<理由>"`);
  r.ok('音源が控えから変わった曲は、測って確かめられる',!unmeasured.length,
    `ffmpeg が無く測れない: ${unmeasured.join(' ')}。ffmpeg のある所でこの検査を回し、ずれが無ければ --update で控えの指紋を新しくする`);
  if(resaved.length)console.log(`(ファイルは変わったが、ずれは ${TOLERANCE_MS}ms 以内: ${resaved.join(' ')}。--update --reason で控えの指紋を新しくする)`);
  const fresh=Object.keys(items).filter(k=>!lock[k]);
  if(fresh.length)console.log(`(まだ控えに無い曲 ${fresh.length}: ${fresh.join(' ')}。公開したら --update で控えに入れる)`);
  if(!ff)console.log('(ffmpeg が無いので、指紋が控えと同じかだけを見た)');
  r.finish();
}
module.exports={collect,measure,songAudio};
