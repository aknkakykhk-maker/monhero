#!/usr/bin/env node
// サビを見つける・短い動機の写し・盛り上がりに合わせて量を配る(2026-11-11・MHB CHART ENGINE Rev.38)の決まりを見張る。
//
//   node tools/mode/rhythm-chart-chorus-check.js
//
// ① サビ(rhythm-chart-chorus.js): 曲の一覧の全曲で点数が出る。大きいだけの間奏はサビにしない(Evans の区切りE)。同じ入力なら同じ結果
// ② 生成器は climax をサビで決め、サビ直前の小節を軽くし(溜め)、見せ場をサビから先に選ぶ。Rev.38 になっている
// ③ 短い動機(rhythm-chart-motifs.js): 同じリズム+移調した同じ音の上下は動機になり、高さのずれが出る。リズムが違う・音の上下が逆なら動機にしない
// ④ 引き出し R6(盛り上がりに合わせて量を配る): 既定は切。順が逆の区切りだけ直す。'strong' は静かな区切りも軽くする。倍率は 0.6〜1.5
// ⑤ 手の仕上げ: 押せない・帯の中は、いやらしい形をいくつ消しても釣り合わない重さ。山場はサビのうち盛り上がりが山の85%以上
// ⑥ どの道具も、解析ファイル・ゲームのデータ・曲の一覧を書き換えない(生成を通す確かめは rhythm-chart-review-check.js がしている)
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const ROOT=path.resolve(__dirname,'..','..');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const WATCH=[path.join(ROOT,'monster-hero/data/rhythm-mode.js'),path.join(__dirname,'authoring','rhythm-song-registry.json'),
  path.join(__dirname,'authoring','evans-v3-audio.json'),path.join(__dirname,'authoring','evans-v3-layers.json')];
const beforeSha=WATCH.map(sha);
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

// ①
const C=require('./rhythm-chart-chorus.js');
{
  const registry=JSON.parse(read('authoring/rhythm-song-registry.json')).songs;
  let total=0,withChorus=0,bad=[];
  for(const trackId of Object.keys(registry)){
    const data=C.loadForTrack(trackId);if(!data)continue;
    total++;
    const r=C.chorusScores(data.audio,data.layers);
    if(r.hasChorus)withChorus++;
    if(r.sections.some(s=>!(s.score>=0&&s.score<=1))||r.chorus.some(s=>s.bars<4||s.parts.energy<.5))bad.push(trackId);
  }
  ok('曲の一覧の全曲でサビの点数が出る(0〜1・サビは4小節以上で盛り上がりが山の半分以上)',total>=50&&!bad.length,`${total}曲・サビあり ${withChorus}曲${bad.length?' / おかしい: '+bad.join(','):''}`);
  ok('9割以上の曲でサビが見つかる',withChorus>=total*.9,`${withChorus}/${total}`);
  const evans=C.loadForTrack('evans'),r=C.chorusScores(evans.audio,evans.layers);
  ok('Evans のサビは区切りD の2つ(59〜83秒・93〜105秒)。大きいだけの間奏E はサビにしない',
    r.chorus.length===2&&r.chorus.every(s=>s.label==='D')&&!r.sections.find(s=>s.label==='E').chorus,r.chorus.map(s=>`${s.label}(${s.score})`).join(' '));
  ok('同じ入力なら同じ結果',JSON.stringify(C.chorusScores(evans.audio,evans.layers))===JSON.stringify(r));
  ok('区切りが1つの曲はサビなしを返す',C.chorusScores({structure:{sections:[{startBar:0,endBarExclusive:8,intensity:.5}]},timing:evans.audio.timing}).hasChorus===false);
}

// ②
{
  const gen=read('rhythm-chart-v3-generate.js'),rev=require('./rhythm-chart-v3-revision.js');
  ok('作り方の最新は Rev.38 以上',rev.CHART_REVISION_CODE_LATEST>=38,String(rev.CHART_REVISION_CODE_LATEST));
  ok('生成器は climax をサビで決める(サビの無い曲は今までの決め方)',/if\(chorusInfo\.hasChorus\)\{[\s\S]{0,300}chorusStartBars\.has\(section\.startBar\)\)role='climax'/.test(gen));
  ok('サビ直前の小節を軽くする(溜め・0.6倍・1小節)',/CHORUS_TAME=Object\.freeze\(\{bars:1,scale:\.6,showShare:\.7\}\)/.test(gen)&&/tameBars\.has\(bar\)\?CHORUS_TAME\.scale:1/.test(gen));
  ok('見せ場(スイープ・両手スライド)はサビから先に選ぶ',(gen.match(/showpiecePick\(/g)||[]).length>=2);
  ok('--no-chorus・--no-motifs で切れる',/--no-chorus/.test(gen)&&/--no-motifs/.test(gen));
}

// ③ 小さな作り物の曲: 4拍子・1小節16グリッド。小節0と小節2は同じリズムで、小節2は小節0を高くしただけ。小節3はリズムが違う。小節4は同じリズムで音の上下が逆
{
  const M=require('./rhythm-chart-motifs.js');
  const BAR=16,pitchCurve=[];
  const melody=[0,2,4,5,7,5,4,2],put=(bar,transpose,flip=false)=>melody.forEach((m,i)=>{
    const semi=(flip?-m:m)+transpose,hz=440*2**(semi/12);
    pitchCurve.push({grid:bar*BAR+i*2,hz,clarity:.9,height:Math.max(0,Math.min(1,.3+semi/24))});});
  put(0,0);put(2,6);put(3,0);put(4,0,true);
  const audio={timing:{subdivisionsPerBeat:4,beatsPerBar:4},pitchCurve,structure:{sections:[],bars:[0,1,2,3,4].map(bar=>({bar}))}};
  const same=[0,4,8,12],other=[2,6,10,14];
  const offsets=new Map([[0,new Set(same)],[2,new Set(same)],[3,new Set(other)],[4,new Set(same)]]);
  const found=M.detectChartMotifs(audio,null,offsets);
  ok('同じリズム+移調した同じ音の上下は動機になる(小節2 ← 小節0)',found.has(2)&&found.get(2).source===0&&found.get(2).by==='pitch',JSON.stringify([...found]));
  ok('高さのずれが出る(高くなったぶん正)',found.has(2)&&found.get(2).shift>.1,String(found.has(2)&&found.get(2).shift));
  ok('リズムが違う小節・音の上下が逆の小節は動機にしない',!found.has(3)&&!found.has(4));
  ok('もう元が付いている小節は見ない(skip)',!M.detectChartMotifs(audio,null,offsets,{skip:bar=>bar===2}).has(2));
  ok('音高も層の解析も無ければ動機にしない',M.detectChartMotifs({...audio,pitchCurve:[]},null,offsets).size===0);
}

// ④
{
  const D=require('./rhythm-chart-drawers.js'),gen=read('rhythm-chart-v3-generate.js');
  const sec=(startBar,bars,intensity)=>({startBar,endBarExclusive:startBar+bars,startMs:startBar*2000,endMs:(startBar+bars)*2000,intensity});
  // 盛り上がり .2/.5/.9/.6 の区切りに、密度 5/8/6/6(2つ目が、もっと盛り上がる3つ目より重い)
  const audio={timing:{beatMs:500},structure:{sections:[sec(0,8,.2),sec(8,8,.5),sec(16,8,.9),sec(24,8,.6)]}};
  const rates=[5,8,6,6],rate=(from)=>rates[Math.round(from/16000)];
  const plain=D.chooseEnergySpread(audio,'MASTER',{weightRate:rate});
  const scaleAt=(r,bar)=>D.energySpreadBarScale(r,bar);
  ok('R6: 順が逆の区切りだけ直す(重すぎる区切りを下げ、盛り上がる区切りを上げる。順どおりの静かな区切りは動かさない)',
    plain.use&&scaleAt(plain,8)<1&&scaleAt(plain,16)>1&&scaleAt(plain,0)===1,plain.reason);
  const strong=D.chooseEnergySpread(audio,'MASTER',{weightRate:rate,strong:true});
  ok("R6 'strong': 静かな区切りも、盛り上がりに見合う量まで軽くする",strong.use&&scaleAt(strong,0)<1&&scaleAt(strong,0)<scaleAt(plain,0)+1e-9,strong.reason);
  ok('R6: 倍率は 0.6〜1.5',[plain,strong].every(r=>r.sections.every(x=>x.scale>=.6&&x.scale<=1.5)));
  ok('R6: もう順どおりの曲には使わない',D.chooseEnergySpread(audio,'MASTER',{weightRate:from=>[3,5,8,6][Math.round(from/16000)]}).use===false);
  ok('R6 は既定で切(曲の一覧の energySpread か --energy-spread のときだけ)',/let ENERGY_SPREAD_ON=process\.argv\.includes\('--energy-spread'\)/.test(gen)&&/entry\.energySpread===true\|\|entry\.energySpread==='strong'/.test(gen));
  const registry=JSON.parse(read('authoring/rhythm-song-registry.json')).songs;
  const using=Object.keys(registry).filter(k=>registry[k].energySpread);
  ok('R6 を書いた曲は、社長が決めるまで無い(書いたら、この行を決定の日付つきで直す)',using.length===0,using.join(','));
}

// ⑤
{
  const fix=read('rhythm-chart-flow-fix.js'),F=require('./rhythm-chart-flow-fix.js');
  ok('手の仕上げ: 押せない・帯の中の重さは、交差+真ん中越え(100)の10倍',/const MUST_W=1000;/.test(fix)&&/heldBandBlocked\(rt\)\.length\*MUST_W/.test(fix));
  const evans=C.loadForTrack('evans'),ranges=F.climaxRanges(evans.audio,evans.layers);
  const chorus=C.chorusScores(evans.audio,evans.layers).chorus;
  ok('手の仕上げの山場は、サビのうち盛り上がりが山の85%以上の区切り',ranges.length>=1&&ranges.every(([a,b])=>chorus.some(s=>s.startMs===a&&s.endMs===b&&s.parts.energy>=.85)),JSON.stringify(ranges));
}

// ⑥
{
  const noWrite=name=>!/writeFileSync|appendFileSync/.test(read(name));
  ok('サビ・短い動機の道具は書き込まない',noWrite('rhythm-chart-chorus.js')&&noWrite('rhythm-chart-motifs.js'));
  const compare=read('rhythm-chart-compare.js');
  ok('前後比べの道具が書くのは、--make で渡された場所の中だけ',(compare.match(/writeFileSync\(/g)||[]).length===1&&/writeFileSync\(path\.join\(out,/.test(compare)&&!/--release(?!d)|--reanalyze/.test(compare.replace(/^\/\/.*$/gm,'')));
  ok('解析ファイル・ゲームのデータ・曲の一覧は1バイトも変わっていない',WATCH.every((f,i)=>sha(f)===beforeSha[i]));
}
console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);
