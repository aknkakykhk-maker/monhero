#!/usr/bin/env node
// 公開中の曲が「遊んだ感じ」まで変わっていないかを見張る3本の検査の共通部品(2026-11-07・ビート部 マモリ。モンヒロくんの依頼)。
//
// 【なぜ要るか】社長「既存曲の譜面変わってない？ 既存曲ちょこちょこ勝手に変わるけどそうならないようにできないの？」(2026-11-07)
//   rhythm-released-chart-lock-check.js は譜面データ(マーカーの中身)の指紋しか見ていない。データが同じでも、
//   ・ゲームがマーカーからノーツを組み立てる処理(rhythm-mode.js の t/h/f/S と、parts の makeRuntimeNotes・ミラー・アシスト)
//   ・音源(作り直しで頭の無音や長さが変わると、音とノーツがずれる)
//   ・判定の決まり(判定の窓・受付の横幅)
//   が変わると、遊ぶ譜面は変わる。その3つをそれぞれ控えと比べる。
//
// どの検査も --root <フォルダ> で、別のチェックアウト(過去のコミットの git worktree など)を測れる。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');

const DEFAULT_ROOT=path.resolve(__dirname,'..','..');
const argOf=(args,k)=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
const rootFrom=args=>path.resolve(argOf(args,'--root')||DEFAULT_ROOT);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex').slice(0,16);
const jstNow=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,16).replace('T',' ');

// 数の細かい揺れ(浮動小数の最後の桁)で指紋が変わらないよう、6桁で丸めてから、キーを並べて文字にする
const stable=value=>{
  if(typeof value==='number')return Number.isFinite(value)?JSON.stringify(Math.round(value*1e6)/1e6):JSON.stringify(String(value));
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).filter(k=>value[k]!==undefined&&typeof value[k]!=='function').sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value===undefined?null:value);
};

const partsFiles=root=>{
  const dir=path.join(root,'monster-hero/src/parts');
  let order=[];try{const j=JSON.parse(fs.readFileSync(path.join(dir,'parts.json'),'utf8'));order=Array.isArray(j)?j:(j.parts||j.files||[]);}catch(e){}
  const names=order.length?order.map(x=>typeof x==='string'?x:x.file||x.name).filter(Boolean):fs.readdirSync(dir).filter(f=>f.endsWith('.jsx')).sort();
  return names.map(n=>path.join(dir,path.basename(n))).filter(f=>fs.existsSync(f));
};
const partsSource=root=>partsFiles(root).map(f=>fs.readFileSync(f,'utf8')).join('\n');

// 行頭(字下げ可)の `const 名前 = …` から、波かっこが閉じて `;` で終わるところまでを切り出す。
// 見つからなければ null(古いコミットにはまだ無い関数もある)
const extractConst=(source,name)=>{
  const re=new RegExp(`^([ \\t]*)const ${name}\\s*=`,'m');const m=re.exec(source);if(!m)return null;
  let depth=0,i=m.index,started=false;
  for(;i<source.length;i++){const c=source[i];
    if(c==='{'||c==='('||c==='['){depth++;started=true;}
    else if(c==='}'||c===')'||c===']')depth--;
    else if(c===';'&&depth===0&&started)return source.slice(m.index,i+1).trim();
    else if(c==='\n'&&depth===0&&started&&/[;}]\s*$/.test(source.slice(m.index,i)))return source.slice(m.index,i).trim();
  }
  return null;
};

// ゲームと同じ処理を読み込む。rhythm-mode.js を丸ごと動かし、parts からは演奏を始めるときに通る関数だけを足す
const PARTS_FUNCS=['rhythmMirrorNote','rhythmAssistNote','rhythmTransformChart','rhythmJudgeTap'];
const loadPlay=root=>{
  const runtimePath=path.join(root,'monster-hero/data/rhythm-mode.js');
  const source=fs.readFileSync(runtimePath,'utf8');
  const parts=partsSource(root);
  const extracted=PARTS_FUNCS.map(n=>extractConst(parts,n)).filter(Boolean).join('\n');
  const makeRuntime=extractConst(parts,'makeRuntimeNotes');
  // HELL は公開の印が真のときだけ譜面を返すので、印を立てて読む(本番は 17-*.jsx で rhythmHell:true)
  const context={console,RELEASE_FLAGS:{rhythmHell:true}};
  vm.createContext(context);
  const names=['RHYTHM_SONGS','RHYTHM_DEMO_SONG_IDS','RHYTHM_PLAY_DIFFICULTIES','RHYTHM_DIFFICULTIES',...PARTS_FUNCS];
  vm.runInContext(`${source}\n${extracted}\nglobalThis.__x={${names.map(n=>`${n}:typeof ${n}!=='undefined'?${n}:undefined`).join(',')}};`
    +(makeRuntime?`\nglobalThis.__x.makeRuntimeFor=(song,difficulty,chart)=>{${makeRuntime}\nreturn makeRuntimeNotes;};`:''),context,{filename:runtimePath});
  return {source,parts,context,hasMakeRuntime:!!makeRuntime,...context.__x};
};

// 曲えらびに出ている曲(RHYTHM_DEMO_SONG_IDS)× 5難易度 + HELL の、演奏が始まるときのノーツ列
const playCharts=(play)=>{
  const out={};
  const ids=new Set(play.RHYTHM_DEMO_SONG_IDS||[]);
  const diffs=(play.RHYTHM_PLAY_DIFFICULTIES||play.RHYTHM_DIFFICULTIES||[]).map(d=>d.id);
  for(const song of play.RHYTHM_SONGS||[]){
    if(!ids.has(song.songId))continue;
    for(const id of diffs){
      const chart=song.difficulties&&song.difficulties[id];
      if(!chart||!Array.isArray(chart.notes)||!chart.notes.length)continue;
      const difficulty=(play.RHYTHM_PLAY_DIFFICULTIES||[]).find(d=>d.id===id)||{id};
      out[`${song.songId}/${id.toLowerCase()}`]={song,difficulty,chart};
    }
  }
  return out;
};

// 1譜面ぶんの指紋。ふつう・ミラー・アシストの3通りを、ゲームの makeRuntimeNotes(刻みの数え方あり)で組み立てる
const CHART_FIELDS=['totalNotes','durationMs','laneCount','scrollChanges','scrollGroups'];
const chartPrints=(play,{song,difficulty,chart})=>{
  const build=c=>{
    if(!play.makeRuntimeFor)return c.notes;
    return play.makeRuntimeFor(song,difficulty,c)(true);
  };
  const head=Object.fromEntries(CHART_FIELDS.map(k=>[k,chart[k]]));
  const variant=opts=>{
    const c=play.rhythmTransformChart&&(opts.mirror||opts.assist)?play.rhythmTransformChart(chart,opts):chart;
    return sha(stable({head,notes:build(c)}));
  };
  return {notes:variant({}),mirror:variant({mirror:true}),assist:variant({assist:true})};
};

// 控えの読み書き(どの検査も同じ形: {note, items, history})。--update は --reason が要る
const readLock=file=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{items:{},history:[]};
const writeLock=(file,note,items,reason,changed)=>{
  const old=readLock(file);
  const next={note,items,history:[...(old.history||[]),{at:jstNow(),reason,...(changed.length<=20?{changed}:{changedCount:changed.length})}]};
  fs.writeFileSync(file,JSON.stringify(next,null,1)+'\n');
};
const reporter=()=>{
  let failed=0;
  const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'} ${name}${!cond&&detail?` — ${detail}`:''}`);if(!cond)failed++;};
  const finish=()=>{console.log(failed?`\n${failed}件 NG`:'\nすべて OK');process.exit(failed?1:0);};
  return {ok,finish,get failed(){return failed;}};
};

module.exports={DEFAULT_ROOT,argOf,rootFrom,sha,stable,jstNow,partsSource,extractConst,loadPlay,playCharts,chartPrints,readLock,writeLock,reporter};
