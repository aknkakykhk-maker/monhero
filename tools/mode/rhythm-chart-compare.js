#!/usr/bin/env node
// 生成器の強化の前後を、何曲かまとめて比べる(2026-11-11・書き出すだけ。ゲームのデータには何も入れない)。
//
//   node tools/mode/rhythm-chart-compare.js --before <場所A> --after <場所B> [--tracks evans,humanoid] [--difficulty EXPERT,MASTER]
//   node tools/mode/rhythm-chart-compare.js --make <場所> [--root <変更前のワークツリー>] [--tracks …] [--gen-args "--energy-spread"]
//                                                                その場所へ作る(生成 → 自動修正 → 手の仕上げ)。--gen-args は生成器へ足す引数(つまみの試し)
//
//   node tools/mode/rhythm-chart-compare.js --released --after <場所B> [--tracks …]     公開中の譜面(前) と、いまの道具で作り直した書き出し(後) を比べる
//       「公開中の譜面へ今の道具を当てたら何が変わるか」を読むだけで見る。公開中の譜面・ゲームのデータは変えない。
//       公開中の譜面は人の手直し・公開時のつまみも入っているので、差は道具の強化だけのものではない(譜面ごとの行も出す)。
//       サビ・動機の数字は書き出し(後)の側だけ出る(公開中の譜面は時刻で持っていて、小節の位置を持たないため)
//
// 場所A・B は、同じ曲を `--make` で作ったフォルダ(<曲>-v3-fixed-<難易度>.json が並ぶ)。
// 変更前は `git worktree add <場所> HEAD` で立てたワークツリーを --root に渡して作る(docs/rules/CHART_ENGINE.md「比べ方」)。
// 出すのは合計と、サビまわりの数字だけ(1譜面ずつの点検は rhythm-chart-review.js --before/--after)。
//   手の数字 … 押せない・帯の中・交差・届きにくい・跳び・連打(rhythm-chart-review.js と同じ物差しの合計)
//   サビ     … 見せ場(左右対称の同時フリック・両手スライド・端から端のSLIDE・同時押しの連なり)のうちサビの中にある割合、
//               サビの密度 ÷ サビ以外の密度、溜め(サビ直前の1小節)の密度 ÷ その前2小節の密度
//   盛り上がりとの合い方 … 譜面ごとの順位の相関の平均と、いちばん低い譜面
//   動機     … 短い動機(1〜2小節)の小節で、隣への1歩の向きが元の小節と同じ割合(rhythm-chart-motifs.js。何もしなくても5割は超える)。
//               比べる小節の組は後の書き出しが持つもの(生成器が書く)を前にも使う
'use strict';
const fs=require('fs'),path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const DEFAULT_TRACKS=['evans','rose','rose_short','humanoid','altar_world_tree_short','rebellion_short','toward_the_stars_short'];
const tracks=(arg('--tracks')||DEFAULT_TRACKS.join(',')).split(',').filter(Boolean);
const difficulties=(arg('--difficulty')||'EASY,NORMAL,HARD,EXPERT,MASTER').split(',');
const round=(x,k=2)=>Math.round(x*10**k)/10**k;

const make=(dir,root)=>{
  const out=path.resolve(dir);fs.mkdirSync(out,{recursive:true});
  for(const track of tracks){
    for(const [tool,args] of [['rhythm-chart-v3-generate.js',['--output-dir',out,'--write',...(arg('--gen-args')||'').split(/\s+/).filter(Boolean)]],
      ['rhythm-chart-v2-step7-autofix.js',['--source','v3','--input-dir',out,'--output-dir',out,'--write']],
      ['rhythm-chart-flow-fix.js',['--dir',out,'--write']]]){
      const r=spawnSync(process.execPath,[path.join(root,'tools/mode',tool),'--track',track,...args],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
      fs.writeFileSync(path.join(out,`${track}.${tool.replace(/^rhythm-chart-|\.js$/g,'')}.log`),(r.stdout||'')+(r.stderr||''));
      if(r.status!==0)console.log(`✗ ${track} ${tool} が失敗(記録: ${path.join(out,track)}.*.log)`);
    }
    console.log(`✓ ${track}`);
  }
};

const SUM_KEYS=[['impossible','押せない'],['heldBand','帯の中'],['cross','交差'],['reach','届きにくい'],['jump','跳び'],['jack','連打'],['notes','ノーツ数']];
// listDir … 動機の小節の組を読む場所(後の書き出し)。前後で同じ小節どうしを比べるために、前を数えるときにも後の組を使う
const measure=(dir,listDir=dir,{released=false}={})=>{
  const releasedSongOf=track=>{const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');const hit=Object.entries(RELEASED_TRACKS).find(([,t])=>t===track);return hit?hit[0]:null;};
  const {chorusScores,loadForTrack}=require('./rhythm-chart-chorus.js');
  let motifs=null;try{motifs=require('./rhythm-chart-motifs.js');}catch{motifs=null;}
  const total={charts:0,show:0,showInChorus:0,chorusDensity:[],tame:[],corr:[],corrWorst:null,quietHeavy:0,motifBars:0,motifPairs:0,motifStep:0,levels:{},rows:{}};
  for(const [key] of SUM_KEYS)total[key]=0;
  for(const track of tracks){
    const songId=released?releasedSongOf(track):null;
    if(released&&!songId){console.log(`… ${track} は公開中の曲ではないので飛ばす`);continue;}
    const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-review.js'),...(released?['--released',songId]:['--track',track,'--dir',path.resolve(dir)]),'--difficulty',difficulties.join(','),'--json'],
      {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    let by={};try{by=JSON.parse(r.stdout);}catch{console.log(`✗ ${track} の点検が読めない`);continue;}
    const data=loadForTrack(track);if(!data)continue;
    const {audio,layers}=data,chorus=chorusScores(audio,layers);
    const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
    const inChorus=bar=>chorus.chorus.some(s=>bar>=s.startBar&&bar<s.endBarExclusive);
    const tame=[];{const list=chorus.sections;list.forEach((s,i)=>{if(s.chorus&&i>0&&!list[i-1].chorus&&list[i-1].bars>=3)tame.push(s.startBar-1);});}
    for(const d of difficulties){
      const m=by[d];if(!m)continue;
      const file=released?null:path.join(path.resolve(dir),`${track.replace(/_/g,'-')}-v3-fixed-${d.toLowerCase()}.json`);
      if(file&&!fs.existsSync(file))continue;
      total.charts++;total.levels[`${track}:${d}`]=m.level;
      total.rows[`${track}:${d}`]={notes:m.notes,level:m.level,cross:m.cross,reach:m.reach,jump:m.jump,corr:m.energyCorr};
      for(const [key] of SUM_KEYS)total[key]+=Number(m[key])||0;
      if(Number.isFinite(m.energyCorr)){total.corr.push(m.energyCorr);if(!total.corrWorst||m.energyCorr<total.corrWorst.value)total.corrWorst={value:m.energyCorr,chart:`${track} ${d}`};}
      total.quietHeavy+=(m.sections||[]).filter(s=>s.gap>=.25).length;
      if(released)continue;
      const chart=JSON.parse(fs.readFileSync(file,'utf8'));
      // 見せ場: 左右対称の同時フリック(2本で1組)・両手スライドの2本目・端から端のSLIDE・同時押しの連なり(1組ずつ)
      const perBar=new Map();
      for(const n of chart.notes){
        const bar=Math.floor(n.grid/BAR);perBar.set(bar,(perBar.get(bar)||0)+1);
        const weight=n.mirrorFlick?.5:n.doubleSlide?1:n.sweep?1:n.chordRun?.5:0;
        if(!weight)continue;
        total.show+=weight;if(inChorus(bar))total.showInChorus+=weight;
      }
      if(chorus.hasChorus){
        let cn=0,cb=0,on=0,ob=0;
        for(const b of audio.structure.bars){const k=perBar.get(b.bar)||0;if(inChorus(b.bar)){cn+=k;cb++;}else{on+=k;ob++;}}
        if(cb&&ob&&on)total.chorusDensity.push((cn/cb)/(on/ob));
        for(const bar of tame){const before=((perBar.get(bar-1)||0)+(perBar.get(bar-2)||0))/2;if(before>0)total.tame.push((perBar.get(bar)||0)/before);}
      }
      if(motifs&&motifs.copyRateOfChart){
        let list=null;
        try{const other=JSON.parse(fs.readFileSync(path.join(path.resolve(listDir),path.basename(file)),'utf8'));if(other.motifs&&Array.isArray(other.motifs.list))list=other.motifs.list;}catch{list=null;}
        if(list&&list.length){const rate=motifs.copyRateOfChart(chart,audio,layers,{list});total.motifBars+=list.length;total.motifPairs+=rate.pairs;total.motifStep+=rate.sameStep;}
      }
    }
  }
  return total;
};
const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:NaN;

if(require.main===module){
  const makeDir=arg('--make');
  if(makeDir){make(makeDir,path.resolve(arg('--root')||ROOT));process.exit(0);}
  const before=arg('--before'),after=arg('--after'),vsReleased=process.argv.includes('--released');
  if((!before&&!vsReleased)||!after){console.error('使い方: --before <場所A> --after <場所B> | --released --after <場所B> | --make <場所> [--root <ワークツリー>]');process.exit(1);}
  const a=vsReleased?measure(null,after,{released:true}):measure(before,after),b=measure(after);
  if(vsReleased)console.log('前=公開中の譜面(読むだけ) / 後=いまの道具で作り直した書き出し。公開中の譜面は変えていない');
  const line=(label,x,y)=>console.log(`${label.padEnd(16,'　')} ${String(x).padStart(8)} → ${String(y).padStart(8)}`);
  console.log(`前後比べ(${tracks.length}曲・${difficulties.join(',')}・${a.charts}→${b.charts}譜面の合計)`);
  for(const [key,label] of SUM_KEYS)line(label,a[key],b[key]);
  const dash=x=>vsReleased?'-':x;
  line('見せ場(組)',dash(round(a.show,1)),round(b.show,1));
  line('見せ場のサビ率',dash(round(a.showInChorus/Math.max(1,a.show))),round(b.showInChorus/Math.max(1,b.show)));
  line('サビ/ほかの密度',dash(round(mean(a.chorusDensity))),round(mean(b.chorusDensity)));
  line('溜め/その前の密度',dash(round(mean(a.tame))),round(mean(b.tame)));
  line('盛り上がりとの合い方',round(mean(a.corr)),round(mean(b.corr)));
  line('　いちばん低い',`${a.corrWorst?a.corrWorst.value:'-'}`,`${b.corrWorst?b.corrWorst.value+'('+b.corrWorst.chart+')':'-'}`);
  line('静かなのに重い区切り',a.quietHeavy,b.quietHeavy);
  if(b.motifBars&&!vsReleased){
    line('短い動機の小節',a.motifBars,b.motifBars);
    line('動機: 元と同じ向き',`${a.motifStep}/${a.motifPairs}=${round(a.motifStep/Math.max(1,a.motifPairs))}`,`${b.motifStep}/${b.motifPairs}=${round(b.motifStep/Math.max(1,b.motifPairs))}`);
  }
  const moved=Object.keys(b.levels).filter(k=>a.levels[k]!=null&&Math.abs(a.levels[k]-b.levels[k])>=2).map(k=>`${k} ${a.levels[k]}→${b.levels[k]}`);
  console.log(`Lv. が2以上動いた譜面: ${moved.length?moved.join(' / '):'なし'}`);
  if(vsReleased||process.argv.includes('--rows')){
    console.log('譜面ごと(ノーツ / Lv. / 交差 / 届きにくい / 跳び / 盛り上がりとの合い方):');
    for(const key of Object.keys(b.rows)){const x=a.rows[key],y=b.rows[key];if(!x)continue;
      console.log(`  ${key.padEnd(34)} ${x.notes}→${y.notes} / ${x.level}→${y.level} / ${x.cross}→${y.cross} / ${x.reach}→${y.reach} / ${x.jump}→${y.jump} / ${x.corr}→${y.corr}`);}
  }
}
module.exports={measure,DEFAULT_TRACKS};
