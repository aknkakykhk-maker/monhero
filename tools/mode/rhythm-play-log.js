#!/usr/bin/env node
// モンヒロビートの遊んだ記録を読み、「音に合わせて押せているか」を測って、生成器の調整値を学ぶ(2026-09-28)。
//
//   node tools/mode/rhythm-play-log.js --fetch              # サーバー(rhythm_play_logs)から新しい記録を取り、まとめへ足す
//   node tools/mode/rhythm-play-log.js --import <file>      # サーバーの行と同じ形の JSON(配列)/ JSONL から取り込む
//   node tools/mode/rhythm-play-log.js --report [--json]    # 譜面ごとの遊んだ感覚
//   node tools/mode/rhythm-play-log.js --learn [--write]    # 調整値を計算する(--write で新しいリビジョンとして書き足す)
//   (--summary <file> でまとめの置き場所を変えられる。検査用)
//
// 【なぜ要るか】ユーザー指示「人間が関与しないで完璧なツールに仕上がる仕組みを」「全プレイヤーから送る」「新曲にだけ使う」「週1回」。
// 譜面の物差し(rhythm-chart-quality-report.js / rhythm-chart-feel-report.js)は解析の結果を正解として測るので、
// 解析のくせ(低音の遅れなど)を見抜けない(docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の8章)。
// ここはプレイヤーが実際に押した時刻を正解として測る。仕組みの全体は docs/spec/RHYTHM_PLAY_LOG.md。
//
// 【まとめ(tools/mode/authoring/playlog/summary.json)】生の記録は持たず、譜面(曲・難易度・指紋)ごとに
//   ノーツごとの「押した時刻のずれ(その回の中央値を引いたもの)」の件数・和・二乗和・MISS 数と、回ごとのばらつきだけを足していく。
//   同じ端末からの記録は1譜面あたり MAX_PLAYS_PER_DEVICE 回まで(1人の記録が多すぎて偏らないように)。
//
// 【学ぶもの】(rhythm-chart-play-tuning.js)
//   lowLagFactor … 低音だけが鳴っている所のノーツで「プレイヤーが聞いている低音の時刻」を逆算し、解析が測った遅れの何倍が本当かを出す
//   lineBoost / lineDemote … 小節ごとの「つまみ食い」(歌とドラムをかわるがわる拾う度合い)と、押した時刻のばらつきの関係。
//                            つまみ食いの多い小節ほど合わせにくいなら強め、関係が無い・逆なら弱める
//   どちらも証拠が足りないときは動かさない。動かすときも1回あたりの幅を決めて少しずつ(行き過ぎたら次の週に戻る)。
'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const {loadRuntime,RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
const {lowLagOf,isLowHit}=require('./rhythm-chart-low-lag.js');
const {TUNING_FILE,readPlayTuning,playTuningForRevision,clampTuning,DEFAULT_PLAY_TUNING}=require('./rhythm-chart-play-tuning.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const SUMMARY_FILE=path.resolve(ROOT,arg('--summary','tools/mode/authoring/playlog/summary.json'));
const SUPABASE_URL='https://zrzevudkbgtxlbvmuziy.supabase.co';
const SUPABASE_KEY='sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
const TABLE='rhythm_play_logs';

const MAX_PLAYS_PER_DEVICE=5;      // 1譜面あたり、同じ端末から数える回数の上限
const REL_CLAMP_MS=150;            // その回の中央値からこれ以上ずれた押し方は、別のノーツを押したとみなして数えない
const SEGMENT_MS=8000;             // 区間の長さ(譜面メモと同じ)
const NEAR_MS=45;                  // 「低音だけが鳴っている所」: ノーツから NEAR_MS 以内の打点が低音の強い一発だけ
// 学ぶための証拠の量と、1回あたりに動かす幅
const LOW_LAG_MIN_SAMPLES=150,LOW_LAG_MIN_SONGS=2,LOW_LAG_RATE=.5,LOW_LAG_STEP=.05;
const LINE_MIN_BARS=200,LINE_SLOPE_MS=4,LINE_STEP=.15;

// ── 記録の文字列をほどく(ゲーム側 rhythmPlayLogEncode の逆) ──
const decodeDeltas=text=>{
  const out=[];
  for(let i=0;i+1<String(text||'').length;i+=2){
    const token=text.slice(i,i+2);
    if(token==='--'||token==='__')out.push(null);
    else if(token==='zz')out.push('MISS');
    else{const value=parseInt(token,36);out.push(Number.isFinite(value)?value-600:null);}
  }
  return out;
};
const median=list=>{if(!list.length)return 0;const s=list.slice().sort((a,b)=>a-b);const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

// ── 公開中の譜面(ゲームと同じ並び・同じ指紋) ──
let runtimeCache=null;
const runtime=()=>runtimeCache||(runtimeCache=loadRuntime());
const fingerprintOf=notes=>{
  const times=notes.map(note=>Number(note.timeMs)).filter(Number.isFinite).sort((a,b)=>a-b);
  return `${notes.length}:${times.length?Math.round(times[0]):0}:${times.length?Math.round(times[times.length-1]):0}`;
};
const chartFor=(songId,difficulty)=>{
  const song=(runtime().RHYTHM_SONGS||[]).find(s=>s.songId===songId);
  const chart=song&&song.difficulties&&song.difficulties[difficulty];
  return chart&&Array.isArray(chart.notes)?chart:null;
};
const audioFor=songId=>{
  const track=RELEASED_TRACKS[songId];
  if(!track)return null;
  const file=path.join(ROOT,'tools/mode/authoring',`${track.replace(/_/g,'-')}-v3-audio.json`);
  return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
};

// ── まとめ ──
const readSummary=()=>{
  try{const data=JSON.parse(fs.readFileSync(SUMMARY_FILE,'utf8'));if(data&&data.charts)return data;}catch{}
  return {schemaVersion:1,note:'モンヒロビートの遊んだ記録のまとめ(rhythm-play-log.js)。生の記録は持たない',cursor:{lastId:0},charts:{}};
};
const writeSummary=summary=>{
  fs.mkdirSync(path.dirname(SUMMARY_FILE),{recursive:true});
  fs.writeFileSync(SUMMARY_FILE,JSON.stringify(summary)+'\n');
};
// 1行を足す。返り値: 足したか(理由)
const addRow=(summary,row)=>{
  if(!row||Number(row.schema_version)!==1)return 'schema';
  if(row.mirror)return 'mirror';          // 左右反転の回は、レーンの動きが譜面と違うので数えない
  const deltas=decodeDeltas(row.deltas);
  if(!deltas.length||deltas.length!==Number(row.note_count))return 'shape';
  const key=`${row.song_id}|${row.difficulty}|${row.fingerprint}`;
  const chart=summary.charts[key]||(summary.charts[key]={songId:row.song_id,difficulty:row.difficulty,fingerprint:row.fingerprint,
    plays:0,devices:{},notes:Array.from({length:deltas.length},()=>[0,0,0,0]),madSum:0,madN:0,misses:0,judged:0});
  if(chart.notes.length!==deltas.length)return 'shape';
  const device=String(row.device_key||'');
  if((chart.devices[device]||0)>=MAX_PLAYS_PER_DEVICE)return 'device-cap';
  const numbers=deltas.filter(value=>typeof value==='number');
  if(numbers.length<Math.min(10,deltas.length*.3))return 'too-few';
  const center=median(numbers);
  const rels=[];
  deltas.forEach((value,index)=>{
    const stat=chart.notes[index];
    if(value==='MISS'){stat[3]++;chart.misses++;chart.judged++;return;}
    if(typeof value!=='number')return;
    chart.judged++;
    const rel=value-center;
    if(Math.abs(rel)>REL_CLAMP_MS)return;
    stat[0]++;stat[1]+=rel;stat[2]+=rel*rel;rels.push(Math.abs(rel));
  });
  chart.madSum+=median(rels);chart.madN++;
  chart.plays++;chart.devices[device]=(chart.devices[device]||0)+1;
  return 'added';
};

// ── 取り込み ──
const importRows=(summary,rows)=>{
  const counts={};
  for(const row of rows){
    const result=addRow(summary,row);counts[result]=(counts[result]||0)+1;
    if(Number.isFinite(Number(row.id)))summary.cursor.lastId=Math.max(summary.cursor.lastId,Number(row.id));
  }
  return counts;
};
const parseRows=text=>{
  const trimmed=String(text||'').trim();
  if(!trimmed)return [];
  if(trimmed.startsWith('['))return JSON.parse(trimmed);
  return trimmed.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>JSON.parse(line));
};
const fetchRows=afterId=>{
  const rows=[];
  let last=afterId;
  for(let page=0;page<200;page++){
    const url=`${SUPABASE_URL}/rest/v1/${TABLE}?select=*&id=gt.${last}&order=id.asc&limit=1000`;
    const result=spawnSync('curl',['-sS','-m','30','-H',`apikey: ${SUPABASE_KEY}`,'-w','\n%{http_code}',url],{encoding:'utf8',maxBuffer:256*1024*1024});
    const lines=(result.stdout||'').trimEnd().split('\n');
    const status=Number(lines.pop());
    if(result.status!==0||status!==200){
      const reason=result.status!==0?(result.stderr||'').trim():`HTTP ${status} ${lines.join(' ').slice(0,200)}`;
      throw new Error(`サーバーから記録を取れませんでした(${reason})`);
    }
    const batch=JSON.parse(lines.join('\n')||'[]');
    rows.push(...batch);
    if(batch.length<1000)break;
    last=batch[batch.length-1].id;
  }
  return rows;
};

// ── 譜面ごとの遊んだ感覚 ──
const gridOf=(audio,timeMs)=>Math.round((timeMs-audio.timing.beatZeroMs)/(audio.timing.beatMs/audio.timing.subdivisionsPerBeat));
// 小節ごとの「つまみ食い」: 歌の線とドラムの線の両方を拾っている度合い(0〜0.5)
const lineOfGrid=audio=>{
  const pitch=new Map((audio.pitchCurve||[]).map(point=>[point.grid,point]));
  const clear=point=>!!point&&Number(point.clarity)>=.5&&Number(point.hz)>0;
  const head=grid=>{const here=pitch.get(grid);if(!clear(here))return false;const before=pitch.get(grid-1);return !clear(before)||Math.abs(12*Math.log2(here.hz/before.hz))>=.8;};
  const onsetByGrid=new Map();for(const onset of audio.onsets)if(onset.grid!=null)onsetByGrid.set(onset.grid,onset);
  return grid=>{
    const onset=onsetByGrid.get(grid),melody=head(grid)||head(grid-1)||head(grid+1);
    const drums=!!onset&&(onset.character==='PUNCH'||onset.character==='FULL')&&!(Number(onset.pitchClarity)>=.5&&Number(onset.pitchHz)>0);
    return melody&&!drums?'v':drums&&!melody?'d':null;
  };
};
const measureChart=entry=>{
  const chart=chartFor(entry.songId,entry.difficulty),audio=audioFor(entry.songId);
  const out={songId:entry.songId,difficulty:entry.difficulty,fingerprint:entry.fingerprint,plays:entry.plays,devices:Object.keys(entry.devices).length,
    current:!!chart&&fingerprintOf(chart.notes)===entry.fingerprint,spreadMs:entry.madN?entry.madSum/entry.madN:null,missRate:entry.judged?entry.misses/entry.judged:null};
  if(!out.current||!audio)return out;
  const notes=chart.notes;
  // 区間ごと
  const segments=new Map();
  notes.forEach((note,index)=>{
    const stat=entry.notes[index],seg=Math.floor(note.timeMs/SEGMENT_MS),o=segments.get(seg)||{n:0,sq:0,miss:0,notes:0};
    o.n+=stat[0];o.sq+=stat[2];o.miss+=stat[3];o.notes+=stat[0]+stat[3];segments.set(seg,o);
  });
  out.segments=[...segments.entries()].sort((a,b)=>a[0]-b[0]).map(([seg,o])=>({fromMs:seg*SEGMENT_MS,rmsMs:o.n?Math.sqrt(o.sq/o.n):null,missRate:o.notes?o.miss/o.notes:null,samples:o.n}));
  // 低音だけが鳴っている所: プレイヤーが聞いている低音の時刻を逆算する(推定の遅れ = 解析の時刻 − ノーツの時刻 − 押したずれ)
  const onsets=audio.onsets.filter(onset=>Number.isFinite(onset.timeMs)).sort((a,b)=>a.timeMs-b.timeMs);
  let lagN=0,lagSum=0;
  notes.forEach((note,index)=>{
    const stat=entry.notes[index];
    if(!stat[0])return;
    const near=onsets.filter(onset=>Math.abs(onset.timeMs-note.timeMs)<=NEAR_MS+60);
    const low=near.filter(isLowHit),others=near.filter(onset=>!isLowHit(onset)&&Math.abs(onset.timeMs-note.timeMs)<=NEAR_MS);
    if(low.length!==1||others.length)return;
    const detectedOffset=low[0].timeMs-note.timeMs;
    if(detectedOffset<-NEAR_MS||detectedOffset>NEAR_MS+60)return;
    lagSum+=(detectedOffset*stat[0]-stat[1]);lagN+=stat[0];
  });
  const lag=lowLagOf(audio);
  out.lowLag={detectedMs:lag.lagMs,heardMs:lagN?lagSum/lagN:null,samples:lagN};
  // 小節ごとのつまみ食いと、押した時刻のばらつき
  const line=lineOfGrid(audio),BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
  const bars=new Map();
  notes.forEach((note,index)=>{
    const grid=gridOf(audio,note.timeMs),bar=Math.floor(grid/BAR),o=bars.get(bar)||{d:0,v:0,n:0,sq:0};
    const kind=line(grid);if(kind==='d')o.d++;else if(kind==='v')o.v++;
    const stat=entry.notes[index];o.n+=stat[0];o.sq+=stat[2];bars.set(bar,o);
  });
  out.bars=[...bars.values()].filter(o=>o.d+o.v>=3&&o.n>=6).map(o=>({mixing:Math.min(o.d,o.v)/(o.d+o.v),rmsMs:Math.sqrt(o.sq/o.n),samples:o.n}));
  return out;
};

// ── 学ぶ ──
const currentRevision=()=>{
  const {CHART_REVISION_LATEST}=require('./rhythm-chart-v3-revision.js');
  return CHART_REVISION_LATEST;
};
const learn=measures=>{
  const now=playTuningForRevision(currentRevision());
  const next={...now},reasons=[];
  // 低音の遅れ: 解析が測った遅れのうち、プレイヤーが聞いているのは何倍か(曲ごとの推定を、件数の重みで平均)
  const lagSongs=new Map();
  for(const m of measures){
    if(!m.lowLag||!m.lowLag.detectedMs||!m.lowLag.samples||m.lowLag.heardMs==null)continue;
    const o=lagSongs.get(m.songId)||{w:0,sum:0,detected:m.lowLag.detectedMs};
    o.w+=m.lowLag.samples;o.sum+=m.lowLag.heardMs*m.lowLag.samples;lagSongs.set(m.songId,o);
  }
  const lagTotal=[...lagSongs.values()].reduce((a,o)=>a+o.w,0);
  if(lagSongs.size>=LOW_LAG_MIN_SONGS&&lagTotal>=LOW_LAG_MIN_SAMPLES){
    const target=[...lagSongs.values()].reduce((a,o)=>a+(o.sum/o.w)/o.detected*o.w,0)/lagTotal;
    const moved=Math.round((now.lowLagFactor+(target-now.lowLagFactor)*LOW_LAG_RATE)/LOW_LAG_STEP)*LOW_LAG_STEP;
    next.lowLagFactor=moved;
    reasons.push(`低音の遅れ: ${lagSongs.size}曲・${lagTotal}件から、プレイヤーが聞いているのは解析の遅れの ${target.toFixed(2)}倍 → ${now.lowLagFactor} を ${clampTuning({...now,lowLagFactor:moved}).lowLagFactor} へ`);
  }else reasons.push(`低音の遅れ: 証拠が足りない(${lagSongs.size}曲・${lagTotal}件。${LOW_LAG_MIN_SONGS}曲・${LOW_LAG_MIN_SAMPLES}件から)。動かさない`);
  // 1本の線: 小節のつまみ食い(x)と押した時刻のばらつき(y)の、件数の重み付きの傾き
  const bars=measures.flatMap(m=>m.bars||[]);
  if(bars.length>=LINE_MIN_BARS){
    const w=bars.reduce((a,b)=>a+b.samples,0),mx=bars.reduce((a,b)=>a+b.mixing*b.samples,0)/w,my=bars.reduce((a,b)=>a+b.rmsMs*b.samples,0)/w;
    const cov=bars.reduce((a,b)=>a+b.samples*(b.mixing-mx)*(b.rmsMs-my),0),vx=bars.reduce((a,b)=>a+b.samples*(b.mixing-mx)**2,0);
    const slope=vx>0?cov/vx*.5:0;   // つまみ食い 0→0.5 のあいだに、ばらつきが何ms増えるか
    const step=slope>LINE_SLOPE_MS?LINE_STEP:slope<-LINE_SLOPE_MS?-LINE_STEP:0;
    next.lineBoost=Math.round((now.lineBoost+step)*100)/100;next.lineDemote=Math.round(next.lineBoost/2*100)/100;
    reasons.push(`1本の線: ${bars.length}小節で、つまみ食いの多い小節はばらつきが ${slope.toFixed(1)}ms ${slope>=0?'大きい':'小さい'} → ${step>0?'強める':step<0?'弱める':'動かさない'}`);
  }else reasons.push(`1本の線: 証拠が足りない(${bars.length}小節。${LINE_MIN_BARS}小節から)。動かさない`);
  const clamped=clampTuning(next);
  const changed=Object.keys(DEFAULT_PLAY_TUNING).some(key=>Math.abs(clamped[key]-now[key])>1e-9);
  return {now,next:clamped,changed,reasons};
};
const writeTuning=(result,basedOn)=>{
  const data=readPlayTuning();
  const revision=currentRevision()+1;
  data.schemaVersion=1;
  data.note='遊んだ記録から学ぶ調整値(rhythm-chart-play-tuning.js)。リビジョンごとに残す。rhythm-play-log.js --learn --write が書き足す。前のリビジョンは消さない';
  data.revisions[String(revision)]={createdAt:new Date(Date.now()+9*3600e3).toISOString().slice(0,16).replace('T',' '),basedOn,reasons:result.reasons,values:result.next};
  fs.mkdirSync(path.dirname(TUNING_FILE),{recursive:true});
  fs.writeFileSync(TUNING_FILE,JSON.stringify(data,null,1)+'\n');
  return revision;
};

module.exports={decodeDeltas,addRow,importRows,measureChart,learn,readSummary,fingerprintOf,chartFor,audioFor,lineOfGrid,gridOf,MAX_PLAYS_PER_DEVICE,LINE_MIN_BARS};

if(require.main===module){
  const summary=readSummary();
  let wrote=false;
  if(process.argv.includes('--fetch')){
    const rows=fetchRows(summary.cursor.lastId);
    const counts=importRows(summary,rows);
    console.log(`サーバーから ${rows.length}件(${JSON.stringify(counts)})`);
    wrote=true;
  }
  const file=arg('--import',null);
  if(file){
    const rows=parseRows(file==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(ROOT,file),'utf8'));
    const counts=importRows(summary,rows);
    console.log(`取り込み ${rows.length}件(${JSON.stringify(counts)})`);
    wrote=true;
  }
  if(wrote)writeSummary(summary);
  const measures=Object.values(summary.charts).map(measureChart);
  if(process.argv.includes('--report')){
    if(process.argv.includes('--json'))console.log(JSON.stringify(measures,null,1));
    else{
      console.log(`遊んだ記録: ${measures.length}譜面・${measures.reduce((a,m)=>a+m.plays,0)}回`);
      for(const m of measures.sort((a,b)=>(b.spreadMs||0)-(a.spreadMs||0))){
        const worst=(m.segments||[]).filter(s=>s.samples>=20).sort((a,b)=>(b.rmsMs||0)-(a.rmsMs||0))[0];
        console.log(`  ${m.songId} ${m.difficulty}${m.current?'':'(作り直す前の譜面)'}: ${m.plays}回・${m.devices}台 ばらつき ${m.spreadMs==null?'-':m.spreadMs.toFixed(1)+'ms'} ミス ${m.missRate==null?'-':(m.missRate*100).toFixed(1)+'%'}`
          +(m.lowLag&&m.lowLag.samples?` 低音 解析${m.lowLag.detectedMs.toFixed(0)}ms/聞こえ${m.lowLag.heardMs.toFixed(0)}ms(${m.lowLag.samples}件)`:'')
          +(worst?` いちばん合わせにくい区間 ${Math.floor(worst.fromMs/60000)}:${String(Math.floor(worst.fromMs/1000)%60).padStart(2,'0')}(${worst.rmsMs.toFixed(0)}ms)`:''));
      }
    }
  }
  if(process.argv.includes('--learn')){
    const result=learn(measures.filter(m=>m.current));
    for(const line of result.reasons)console.log(line);
    console.log(`調整値: ${JSON.stringify(result.now)} → ${JSON.stringify(result.next)}${result.changed?'':'(変わらない)'}`);
    if(result.changed&&process.argv.includes('--write')){
      const revision=writeTuning(result,{charts:measures.length,plays:measures.reduce((a,m)=>a+m.plays,0)});
      console.log(`書き足した: ${path.relative(ROOT,TUNING_FILE)} の Rev.${revision}(次に足す曲から効く)`);
    }
  }
}
