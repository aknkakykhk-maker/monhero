#!/usr/bin/env node
// 譜面の作り方のリビジョン(chartRevision)と、Rev.2の「フレーズの写し」を見張る。
//
//   node tools/mode/rhythm-phrase-copy-check.js
//   node tools/mode/rhythm-phrase-copy-check.js --tracks a,b,c   # 実際に生成して比べる曲を指定する
//
// 【なぜ要るか】(2026-09-24・ユーザー指示「譜面製作ツールを、音ゲーにふさわしい性能に強化して」)
// 本物の音ゲーの譜面は、2番のサビを1番のサビと同じ配置(か左右反転)で書く。覚えた形がそのまま効くのが
// 「曲を覚えた」手応えになる。ところが自動生成では、繰り返しの小節で**時刻とレーンが元と同じノーツは
// 1割ほど**しか無かった(音源の打点は約5割が同じ位置なのに、拾う音も形も1番と2番で別々に選んでいた)。
// Rev.2で「元の小節で取った位置の音を先に取る」「元のレーンを写す」を入れた(docs/spec/RHYTHM_CHART_DESIGN.md 3.1.19)。
//
// リビジョンを分けたのは運用ルール ⑩-2 のため(既存曲の生成結果を変えない)。この検査は
//   ・リビジョンの読み方(書いていない曲はRev.1)と、解析器が新しい曲にだけ最新リビジョンを書くこと
//   ・公開中の曲がRev.2で作ってあること／公開していない曲が黙ってRev.2へ上がっていないこと
//   ・最新リビジョンで生成すると、写しが出て・鳴っていない所に置かず・写し率が 0.2 以上(2026-10-12 から最新だけを作る)
// を確かめる。写し率の物差しは品質レポート(rhythm-chart-quality-report.js の phraseEcho)と同じものを使う。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {CHART_ENGINE_NAME,chartRevisionLabel,CHART_REVISION_LEGACY,CHART_REVISION_LATEST,chartRevisionOf,chartRevisionForRegistry}=require('./rhythm-chart-v3-revision.js');
const {reportFor}=require('./rhythm-chart-quality-report.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

// ── 1. リビジョンの読み方 ────────────────────────────────────────────────────────────
ok('最新リビジョンは2以上',CHART_REVISION_LATEST>=2&&CHART_REVISION_LEGACY===1);
// 呼び名(2026-09-26): ツールの名前は MHB CHART ENGINE、世代は「Rev.7」。「版7」とは書かない
ok('呼び名は「MHB CHART ENGINE Rev.◯」',CHART_ENGINE_NAME==='MHB CHART ENGINE'&&chartRevisionLabel(7)==='MHB CHART ENGINE Rev.7');
ok('書いていない曲はRev.1',chartRevisionOf(undefined)===1&&chartRevisionOf({})===1&&chartRevisionOf(null)===1);
ok('壊れた値・範囲外はRev.1',chartRevisionOf({chartRevision:'x'})===1&&chartRevisionOf({chartRevision:0})===1
  &&chartRevisionOf({chartRevision:1.5})===1&&chartRevisionOf({chartRevision:CHART_REVISION_LATEST+1})===1);
ok('書いたリビジョンはそのまま読む',chartRevisionOf({chartRevision:2})===2);

// ── 2. 解析器が付けるリビジョン ──────────────────────────────────────────────────────
ok('一覧に無い曲 → 最新リビジョン',chartRevisionForRegistry(undefined).chartRevision===CHART_REVISION_LATEST);
ok('音源のパスだけ手で足した曲 → 最新リビジョン',chartRevisionForRegistry({audio:'monster-hero/audio/x.mp3'}).chartRevision===CHART_REVISION_LATEST);
ok('一度解析した曲 → 付けない(Rev.1のまま)',!('chartRevision' in chartRevisionForRegistry({audio:'a.mp3',audioSha256:'abc'})));
ok('人が書いたリビジョンは解析のやり直しで消さない',chartRevisionForRegistry({audioSha256:'abc',chartRevision:1}).chartRevision===1);
{
  const source=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-audio-analyze-v3.js'),'utf8');
  ok('解析器が一覧へ書くときにリビジョンを付けている',/\.\.\.chartRevisionForRegistry\(registry\.songs\[trackId\]\)/.test(source));
}

// ── 3. リビジョンをどこまで上げたか ──────────────────────────────────────────────────
// 2026-09-24、ユーザーの判断(「既存曲も最新ツールで変えてもいいよ」)で、公開中の21曲をRev.2で作り直した。
// 公開曲(RELEASED_TRACKS)はすべてRev.2以上であること、公開していない曲はRev.1のまま残っていることを見る。
// 公開していない曲を公開するときは、先にRev.2で作り直すか、ここから外すかを決める(黙ってRev.1のまま出さない)。
const LEGACY_TRACKS=Object.freeze(['pandora_boss_beat','eiki_boss_beat','six_eternel_remix']);
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json'),'utf8')).songs||{};
{
  const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
  const released=Object.values(RELEASED_TRACKS);
  const behind=released.filter(id=>!registry[id]||chartRevisionOf(registry[id])<2);
  ok('公開中の曲はRev.2以上で作ってある',behind.length===0,behind.join(', '));
  const raised=LEGACY_TRACKS.filter(id=>registry[id]&&chartRevisionOf(registry[id])!==1);
  ok('公開していない曲はRev.1のまま',raised.length===0,raised.join(', '));
  const overlap=LEGACY_TRACKS.filter(id=>released.includes(id));
  ok('Rev.1のまま残す曲に公開曲が混ざっていない',overlap.length===0,overlap.join(', '));
}

// ── 4. 最新リビジョンで実際に生成する ──────────────────────────────────────────
// 2026-10-12 から作れるのは最新リビジョンだけ。Rev.1 との比べ(写し率の上がり幅・押しやすさ・量・クロスの増減)は、
// Rev.2 を入れたときの一度きりの見張りだったので外し、比べなくても成り立つことだけを見る。
// 繰り返しの区切りがある曲。区切りのはっきりした曲・4小節の輪が続く曲・途中で終わる曲を混ぜる
const tracks=(arg('--tracks','nothing_without_you,4u_hitasura,dullahan,kindan_no_resistance')||'').split(',').filter(Boolean);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'phrase-copy-'));
const generate=(trackId,extra=[])=>{
  const dir=path.join(tmp,`${trackId}${extra.length?'-'+extra.join('-'):''}`);
  fs.mkdirSync(dir,{recursive:true});
  const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--track',trackId,...extra,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  if(run.status!==0){console.error((run.stderr||'').split('\n').slice(0,6).join('\n'));return null;}
  return {dir,stdout:run.stdout};
};
const readShapes=(dir,trackId)=>DIFFICULTIES.map(difficulty=>{
  const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
  return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
}).filter(Boolean);
const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;
try{
  const echo=[];
  for(const trackId of tracks){
    const latest=generate(trackId);
    ok(`${trackId}: 最新リビジョンで生成できる`,!!latest);
    if(!latest)continue;
    ok(`${trackId}: Rev.${CHART_REVISION_LATEST} と表示する`,new RegExp(`譜面の作り方: MHB CHART ENGINE Rev\\.${CHART_REVISION_LATEST}（`).test(latest.stdout));
    const latestCharts=readShapes(latest.dir,trackId);
    ok(`${trackId}: 写したかたまりがある`,latestCharts.every(chart=>chart.chartRevision===CHART_REVISION_LATEST)
      &&latestCharts.filter(chart=>chart.shapes.some(entry=>entry.phraseCopyOf!=null)).length>=3);
    // 元の1つの形を2つに割って写したときは、記録も1つにまとまっている(同じ形が続いたように数えない)
    // (区切りの境目で「同じ元を、片方は反転・片方はそのまま」写したのは2回ぶんなので、別の記録でよい)
    ok(`${trackId}: 同じ元の写しが記録の上で割れていない`,latestCharts.every(chart=>chart.shapes.every((entry,i)=>{
      const previous=chart.shapes[i-1];
      return !previous||entry.phraseCopyOf==null||entry.phraseCopyOf!==previous.phraseCopyOf
        ||entry.mirrored!==previous.mirrored||entry.pattern!==previous.pattern;
    })));
    // 反転で写した区切りもある(ずっと同じ向きにしない)
    ok(`${trackId}: 左右反転の写しも出る`,latestCharts.some(chart=>chart.shapes.some(entry=>entry.phraseCopyOf!=null&&entry.mirrored)));
    const after=reportFor(trackId,{source:'v3',dir:latest.dir});
    for(const difficulty of DIFFICULTIES){
      const a=after.difficulties[difficulty];
      if(!a)continue;
      if(a.musicality.phraseEcho!=null)echo.push(a.musicality.phraseEcho);
      ok(`${trackId} ${difficulty}: 鳴っていない場所にノーツを置かない`,a.musicality.onsetHitRate>=1,`${a.musicality.ghostNotes}`);
    }
  }
  // 写し率は曲をまたいだ平均で見る(区切りの短い曲では1曲ごとの揺れが大きい)
  ok('フレーズの写し率が 0.2 以上',mean(echo)>=.2,mean(echo).toFixed(3));
  // ── 5. クロス(端に寄ったHOLDを内側へ寄せて置く) ──────────────────────────
  // 1曲ごとには増減があるので、公開中の全曲の合計で見る
  {
    const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
    const crossTotal={EXPERT:0,MASTER:0};
    for(const trackId of Object.values(RELEASED_TRACKS))for(const difficulty of ['EXPERT','MASTER']){
      const made=generate(trackId,['--difficulty',difficulty]);
      if(!made)continue;
      const file=path.join(made.dir,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
      crossTotal[difficulty]+=JSON.parse(fs.readFileSync(file,'utf8')).notes.filter(note=>note.cross===true).length;
    }
    ok('MASTERのクロスがEXPERTより多い(公開中の全曲の合計)',crossTotal.MASTER>crossTotal.EXPERT,
      `EXPERT ${crossTotal.EXPERT} / MASTER ${crossTotal.MASTER}`);
  }
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 譜面の作り方のリビジョンと、フレーズの写しは期待どおり');
process.exit(failed?1:0);
