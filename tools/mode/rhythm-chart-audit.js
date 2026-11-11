#!/usr/bin/env node
// 公開中の全曲・全難易度の点検(読むだけ)。2026-11-11 社長「新しい譜面制作ツールができたら、全曲確認しておかしくないかとか、レベルに見合ってるとかのチェックもしたい」。
//
//   node tools/mode/rhythm-chart-audit.js                          # 要約を表示
//   node tools/mode/rhythm-chart-audit.js --write <フォルダ>        # 報告(AUDIT.md・audit.json)を書く
//   node tools/mode/rhythm-chart-audit.js --write <フォルダ> --pictures 8   # 問題の大きい上位8譜面の止め絵も
//
// 譜面・レベル表・曲の一覧は書き換えない(直すかどうかは社長が決める・tools/mode/CLAUDE.md ⑩-2)。
// 【出すもの】
//   (1) おかしい所 … 押さえている帯の中のノーツ・モンスターノーツが4個でない・スライドの太さの飛び・横持ちの親指で押せない・
//       交差/届きにくいが公開中の同じ難易度の帯(5〜95%)より多い
//   (2) 表示の Lv. と実際の難しさが合っていない譜面 … 「体感の数字」(毎秒・最密4秒・最短間隔・交差・届きにくい・連打・跳び・長押し・空中)から、
//       公開中の全譜面の表示 Lv. を当てはめた式で「このくらいの数字なら Lv.いくつ」を出し、表示との差が大きいものを並べる。
//       当てはめは全譜面の平均的な関係なので、差=まちがいではない(社長が決めた Lv. もある)。数字の近い5譜面の Lv. も並べて見比べられるようにする。
//       同じ曲で、上の難易度のほうが忙しさ(最密4秒・毎秒)が軽い「段の逆転」も出す
//   (3) 曲ごとの要約(問題の大きい順)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=require('./rhythm-chart-review.js');
const {loadRuntimeSongs}=require('./rhythm-chart-level.js');
const args=process.argv.slice(2),argOf=(n,d=null)=>{const i=args.indexOf(n);return i>=0&&i+1<args.length?args[i+1]:d;};
const ROOT=path.resolve(__dirname,'..','..'),round=(v,d=1)=>Math.round(v*10**d)/10**d;

// 表示の Lv.(地上の5難易度はレベル表・HELL は譜面に書いてある値)
const shownLevels=()=>{const src=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  const a=src.indexOf('// <rhythm-chart-levels>'),b=src.indexOf('// </rhythm-chart-levels>');
  return vm.runInNewContext(`({${src.slice(a,b).replace(/^\/\/.*$/gm,'')}})`,{Object});};
// 開催中のイベントの対象曲(ショート版を含む)。対象曲の譜面は開催中に触らないので、直す案から外して印を付ける
const eventSongs=()=>{try{const src=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-event.js'),'utf8'),now=Date.now(),out=new Set();
    for(const m of src.matchAll(/startAt:\s*'([^']+)',\s*\n\s*endAt:\s*'([^']+)'[\s\S]{0,600}?songIds:\s*Object\.freeze\(\[([^\]]*)\]\)/g)){
      if(Date.parse(m[1])<=now&&now<Date.parse(m[2]))for(const id of m[3].matchAll(/'([^']+)'/g)){out.add(id[1]);out.add(`${id[1]}_short`);}}
    return out;}catch(e){return new Set();}};

// 最小二乗(正規方程式を掃き出しで解く)
const solve=(X,y)=>{const n=X[0].length,A=Array.from({length:n},()=>Array(n+1).fill(0));
  for(let r=0;r<X.length;r++)for(let i=0;i<n;i++){for(let j=0;j<n;j++)A[i][j]+=X[r][i]*X[r][j];A[i][n]+=X[r][i]*y[r];}
  for(let i=0;i<n;i++)A[i][i]+=1e-6;
  for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;[A[i],A[p]]=[A[p],A[i]];
    for(let r=0;r<n;r++){if(r===i)continue;const f=A[r][i]/A[i][i];for(let c=i;c<=n;c++)A[r][c]-=f*A[i][c];}}
  return A.map((row,i)=>row[n]/row[i]);};
const FEATURES=[['毎秒',m=>m.nps],['最密4秒',m=>m.peak4s],['速さ(1000/最短ms)',m=>1000/Math.max(40,m.minGapMs)],['交差/100',m=>m.crossPer100],['届きにくい/100',m=>m.reachPer100],
  ['連打の割合',m=>m.jackRate],['跳びの割合',m=>m.jumpRate],['長押しの割合',m=>m.longShare],['空中の割合',m=>m.sky/m.notes],['休みなし秒',m=>Math.min(30,m.noRestSec)]];

// 押さえている帯の中の決まり(2026-10-13)より前からある曲。今の件数を上限に認めている(rhythm-held-band-existing.json)ので、「決まりに反する」には数えず別に並べる
const grandfathered=(()=>{const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js'),t=new Set(JSON.parse(fs.readFileSync(path.join(__dirname,'rhythm-held-band-existing.json'),'utf8')).tracks||[]);
  return songId=>t.has(RELEASED_TRACKS[songId]||songId);})();
const audit=()=>{
  const rt=loadRuntimeSongs(),demo=new Set(rt.RHYTHM_DEMO_SONG_IDS||[]),shown=shownLevels(),bands=R.readBands(),inEvent=eventSongs(),rows=[];
  for(const song of rt.RHYTHM_SONGS){if(demo.size&&!demo.has(song.songId))continue;
    const L=R.loadReleased(song.songId),by=R.reviewOf(L);
    for(const d of R.DIFFS){const m=by[d];if(!m)continue;
      const lv=d==='HELL'?Number(L.charts.HELL&&m.level&&((rt.RHYTHM_PROTO_SONGS||[]).find(s=>String(s.songId).startsWith(`${song.songId}_hell`))||{difficulties:{}}).difficulties&&Object.values(((rt.RHYTHM_PROTO_SONGS||[]).find(s=>String(s.songId).startsWith(`${song.songId}_hell`))||{difficulties:{}}).difficulties)[0]?.level)||m.level:(shown[song.songId]||{})[d];
      rows.push({songId:song.songId,old:grandfathered(song.songId),name:`${song.displayName||song.songId}${/_short$/.test(song.songId)&&!/short/i.test(song.displayName||'')?' short':''}`,difficulty:d,shown:Number.isFinite(lv)?lv:m.level,m,chart:L.charts[d],audio:L.audio,event:inEvent.has(song.songId)});}
    const lad=R.ladderOf(by);for(const l of lad){if(l.to==='HELL')continue;const r=rows.find(x=>x.songId===song.songId&&x.difficulty===l.to);if(r&&(l.peakRatio<1||l.notesRatio<1.03))r.inversion=`${l.from}→${l.to}: ノーツ数 ×${l.notesRatio}・最密4秒 ×${l.peakRatio}`;}
  }
  // (2) 体感の数字 → Lv. の当てはめ
  //   地上の5難易度と HELL は別々に当てはめる(HELL の Lv. は空中の難しさを足して測るので、地上と同じ式に乗らない)
  let w=null;
  for(const hell of [false,true]){const part=rows.filter(r=>(r.difficulty==='HELL')===hell);if(part.length<20)continue;
    const X=part.map(r=>[1,...FEATURES.map(([,f])=>f(r.m))]),ww=solve(X,part.map(r=>r.shown));if(!hell)w=ww;
    part.forEach((r,i)=>{r.expected=round(X[i].reduce((a,x,j)=>a+x*ww[j],0));r.gap=round(r.shown-r.expected);});}
  for(const r of rows)if(r.expected==null){r.expected=r.shown;r.gap=0;}
  const {LEVEL_OVERRIDES}=require('./rhythm-chart-level.js');for(const r of rows)r.decided=!!(LEVEL_OVERRIDES[r.songId]&&Number.isFinite(LEVEL_OVERRIDES[r.songId][r.difficulty]));
  const sigma=Math.sqrt(rows.reduce((a,r)=>a+r.gap*r.gap,0)/rows.length);
  // 数字の近い5譜面(毎秒・最密4秒・最短間隔・交差・届きにくいを、全譜面のばらつきでそろえて測る)
  const keys=[m=>m.nps,m=>m.peak4s,m=>1000/Math.max(40,m.minGapMs),m=>m.crossPer100,m=>m.reachPer100],sd=keys.map(f=>{const v=rows.map(r=>f(r.m)),mu=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+(b-mu)**2,0)/v.length)||1;});
  for(const r of rows){const near=rows.filter(o=>o!==r&&o.songId!==r.songId&&(o.difficulty==='HELL')===(r.difficulty==='HELL')).map(o=>({o,d:keys.reduce((a,f,i)=>a+((f(o.m)-f(r.m))/sd[i])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,5).map(x=>x.o);
    r.near=near.map(o=>`${o.name} ${o.difficulty} Lv.${o.shown}`);r.nearMedian=near.map(o=>o.shown).sort((a,b)=>a-b)[2];}
  // (1) おかしい所と、問題の大きさ
  for(const r of rows){const m=r.m,b=bands&&bands.byDifficulty[r.difficulty],odd=[];
    const band=r.old?0:m.heldBand;r.heldOld=r.old?m.heldBand:0;
    if(band)odd.push(`帯の中 ${band}`);if(m.monsters!==4)odd.push(`モンスター ${m.monsters}個`);if(m.widthJumps)odd.push(`太さの飛び ${m.widthJumps}`);if(m.impossible)odd.push(`押せない ${m.impossible}`);
    const over=(k,label)=>{if(b&&b[k]&&m[k]>b[k].hi)odd.push(`${label} ${m[k]}(帯 〜${b[k].hi})`);return b&&b[k]&&m[k]>b[k].hi?(m[k]-b[k].hi)/Math.max(.5,b[k].hi):0;};
    const ex=over('crossPer100','交差/100')+over('reachPer100','届きにくい/100')+over('jumpRate','跳びの割合');
    if(r.inversion)odd.push(`段の逆転(${r.inversion})`);
    r.odd=odd;r.levelFlag=Math.abs(r.gap)>=Math.max(5,2*sigma)&&Math.sign(r.shown-r.nearMedian)===Math.sign(r.gap)&&Math.abs(r.shown-r.nearMedian)>=4?(r.gap>0?'表示が高い':'表示が低い'):'';
    r.score=round(band*6+(m.monsters!==4?8:0)+m.widthJumps*3+m.impossible*4+ex*5+(r.inversion?6:0)+(r.levelFlag?Math.abs(r.gap):0));}
  return {rows,sigma:round(sigma,2),weights:Object.fromEntries([['切片',round(w[0],2)],...FEATURES.map(([n],i)=>[n,round(w[i+1],2)])]),eventSongs:[...inEvent]};
};

const report=a=>{const {rows}=a,L=[],fmtRow=r=>`| ${r.name} | ${r.difficulty} | ${r.shown} | ${r.expected} | ${r.gap>0?'+':''}${r.gap} | ${r.nearMedian} | ${r.m.notes} | ${r.m.nps} | ${r.m.peak4s} | ${r.m.minGapMs} | ${r.m.cross} | ${r.m.reach} |${r.event?' 開催中のイベント対象(案から外す)':''}${r.decided?' 表示は社長が決めた値':''}`;
  const head='| 曲 | 難易度 | 表示Lv. | 数字からの見込み | 差 | 近い5譜面のLv.の中央 | ノーツ | 毎秒 | 最密4秒 | 最短ms | 交差 | 届きにくい |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
  L.push('# 公開中の全曲の点検(読むだけ・譜面は変えていない)','',`作った道具: \`tools/mode/rhythm-chart-audit.js\`(中身は \`rhythm-chart-review.js\` と同じ物差し)。${new Set(rows.map(r=>r.songId)).size}曲・${rows.length}譜面。`,
    `開催中のイベントの対象曲: ${a.eventSongs.length?a.eventSongs.join('・'):'なし(いまの本オープン記念キャンペーンは全曲が対象で、対象曲の指定が無い)'}`,'');
  const odd=rows.filter(r=>r.odd.length).sort((x,y)=>y.score-x.score);
  const hard=rows.filter(r=>(!r.old&&r.m.heldBand)||r.m.monsters!==4||r.m.widthJumps);
  L.push('## (1) おかしい所','',`### 決まりに反しているもの(帯の中・モンスター4個でない・太さの飛び): ${hard.length}譜面`,'');
  if(hard.length){L.push('| 曲 | 難易度 | 中身 |','| --- | --- | --- |');for(const r of hard)L.push(`| ${r.name} | ${r.difficulty} | ${r.odd.filter(o=>/帯の中|モンスター|太さ/.test(o)).join('・')}${r.event?'(イベント対象)':''} |`);}else L.push('なし。');
  if(hard.some(r=>r.songId==='altar_world_tree'&&r.difficulty==='EXPERT'))L.push('','※ アルター原曲 EXPERT の太さの飛び1本は、2026-11-05 に社長が「配信中の譜面はそのまま・生成器を強化」と決めた分(直さない)。');
  {const olds=rows.filter(r=>r.heldOld);L.push('',`### 押さえている帯の中のノーツ(決まりより前からある曲。2026-10-13 に「今の件数を上限にそのまま」と決めてある分): ${olds.length}譜面・${olds.reduce((a,r)=>a+r.heldOld,0)}個`,'',
    '検査(`rhythm-chart-hand-rules-check.js`)が上限を見張っている。直すなら位置だけ動かす道具(`rhythm-chart-flow-fix.js --song`)で外へ出せる(遊ぶ譜面が変わるので社長の判断)。','','| 曲 | 難易度ごとの数 |','| --- | --- |');
    const g=new Map();for(const r of olds){const x=g.get(r.name)||[];x.push(`${r.difficulty} ${r.heldOld}`);g.set(r.name,x);}
    for(const [n,x] of [...g].sort((a,b)=>b[1].length-a[1].length))L.push(`| ${n} | ${x.join('・')} |`);}
  const imp=rows.filter(r=>r.m.impossible).sort((x,y)=>y.m.impossible-x.m.impossible);
  L.push('',`### 横持ちの親指2本で「押せない」と出る所がある譜面: ${imp.length}譜面(合計 ${imp.reduce((s,r)=>s+r.m.impossible,0)} か所)`,'',
    '両手のシミュレート(公開の関門)は通っている。こちらは横持ちで親指が左右の端から伸びる前提の、より厳しい物差し。3本目の指・持ち替えで押せる所も含む。','',
    '| 曲 | 難易度 | 押せない | 時刻(先頭5つ) |','| --- | --- | ---: | --- |');
  for(const r of imp.slice(0,40))L.push(`| ${r.name} | ${r.difficulty} | ${r.m.impossible} | ${r.m.issues.filter(i=>i.kind==='impossible').slice(0,5).map(i=>`${Math.floor(i.timeMs/60000)}:${((i.timeMs%60000)/1000).toFixed(1).padStart(4,'0')}`).join(' ')} |`);
  const many=rows.filter(r=>r.odd.some(o=>/交差\/100|届きにくい\/100|跳びの割合/.test(o))).sort((x,y)=>y.score-x.score);
  L.push('',`### 交差・届きにくい・跳びが、公開中の同じ難易度の帯(上位5%)より多い譜面: ${many.length}譜面`,'','| 曲 | 難易度 | Lv. | 中身 |','| --- | --- | ---: | --- |');
  for(const r of many)L.push(`| ${r.name} | ${r.difficulty} | ${r.shown} | ${r.odd.filter(o=>/交差\/100|届きにくい\/100|跳びの割合/.test(o)).join('・')} |`);
  L.push('','## (2) 表示の Lv. と実際の難しさ(体感の数字)','',`全${rows.length}譜面の表示 Lv. に、体感の数字(${FEATURES.map(f=>f[0]).join('・')})を当てはめた式との差。ばらつき(標準偏差)は ${a.sigma}。`,
    '地上の5難易度と HELL は別々に当てはめた。「差」が大きく、数字の近い5譜面の Lv. と比べても同じ向きに4以上ずれているものだけを並べた。差=まちがいではない(社長が決めた Lv. や、数字に出ない難しさ=見分けにくさ・止まる演出などがある)。','');
  const hi=rows.filter(r=>r.levelFlag==='表示が高い').sort((x,y)=>y.gap-x.gap),lo=rows.filter(r=>r.levelFlag==='表示が低い').sort((x,y)=>x.gap-y.gap);
  L.push(`### 表示の Lv. が、数字のわりに高い(遊ぶと「思ったより易しい」になりやすい): ${hi.length}譜面`,'',head,...hi.map(fmtRow),'',`### 表示の Lv. が、数字のわりに低い(遊ぶと「思ったより難しい」になりやすい): ${lo.length}譜面`,'',head,...lo.map(fmtRow),'');
  const inv=rows.filter(r=>r.inversion);
  L.push(`### 同じ曲の難易度の段の逆転・差が無い: ${inv.length}譜面`,'');if(inv.length){L.push('| 曲 | 中身 |','| --- | --- |');for(const r of inv)L.push(`| ${r.name} | ${r.inversion} |`);}else L.push('なし。');
  L.push('','## (3) 曲ごとの要約(問題の大きい順)','','点数 = 帯の中(新しい決まりの曲だけ)×6 + モンスター4個でない 8 + 太さの飛び×3 + 押せない×4 + 帯を超えた交差・届きにくい・跳びの超え方×5 + 段の逆転 6 + Lv. の差(並べた譜面だけ)。','','| 曲 | 点数 | 中身 |','| --- | ---: | --- |');
  const bySong=new Map();for(const r of rows){const s=bySong.get(r.songId)||{name:r.name,score:0,parts:[],event:r.event};s.score+=r.score;if(r.odd.length||r.levelFlag)s.parts.push(`${r.difficulty}: ${[...r.odd,r.levelFlag?`${r.levelFlag}(表示 ${r.shown}・見込み ${r.expected})`:''].filter(Boolean).join('・')}`);bySong.set(r.songId,s);}
  for(const s of [...bySong.values()].sort((x,y)=>y.score-x.score))L.push(`| ${s.name}${s.event?'(イベント対象)':''} | ${round(s.score)} | ${s.parts.join(' / ')||'気になる所なし'} |`);
  return L.join('\n')+'\n';};

module.exports={audit,report};
if(require.main===module)(async()=>{
  const a=audit(),dir=argOf('--write');
  const top=a.rows.slice().sort((x,y)=>y.score-x.score);
  console.log(`${new Set(a.rows.map(r=>r.songId)).size}曲・${a.rows.length}譜面 / 決まりに反する ${a.rows.filter(r=>(!r.old&&r.m.heldBand)||r.m.monsters!==4||r.m.widthJumps).length} / 押せないあり ${a.rows.filter(r=>r.m.impossible).length} / Lv. 高い ${a.rows.filter(r=>r.levelFlag==='表示が高い').length}・低い ${a.rows.filter(r=>r.levelFlag==='表示が低い').length} / 段の逆転 ${a.rows.filter(r=>r.inversion).length}`);
  for(const r of top.slice(0,12))console.log(`  ${String(r.score).padStart(6)}  ${r.name} ${r.difficulty} Lv.${r.shown}(見込み ${r.expected})  ${[...r.odd,r.levelFlag].filter(Boolean).join('・')}`);
  if(!dir)return;
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'AUDIT.md'),report(a));
  fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify({note:'node tools/mode/rhythm-chart-audit.js --write が作る。手で書かない',sigma:a.sigma,weights:a.weights,rows:a.rows.map(r=>({songId:r.songId,difficulty:r.difficulty,shown:r.shown,expected:r.expected,gap:r.gap,nearMedian:r.nearMedian,near:r.near,score:r.score,odd:r.odd,levelFlag:r.levelFlag,event:r.event,
    notes:r.m.notes,nps:r.m.nps,peak4s:r.m.peak4s,minGapMs:r.m.minGapMs,impossible:r.m.impossible,cross:r.m.cross,reach:r.m.reach,jump:r.m.jump,heldBand:r.m.heldBand,monsters:r.m.monsters}))},null,1)+'\n');
  console.log(`書いた: ${path.join(dir,'AUDIT.md')}`);
  const n=Number(argOf('--pictures',0))||0;
  if(n)for(const r of top.slice(0,n)){const files=await R.writePicture(path.join(dir,`${r.songId.replace(/_/g,'-')}-${r.difficulty.toLowerCase()}`),
      R.pictureSvg([{label:r.difficulty,chart:r.chart,metrics:r.m}],r.audio,`${r.name} ${r.difficulty} 表示Lv.${r.shown} ${r.m.notes}ノーツ  ${[...r.odd,r.levelFlag].filter(Boolean).join('・')}`));
    console.log(`止め絵: ${files[files.length-1]}`);}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
