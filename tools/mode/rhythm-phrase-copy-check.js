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
//   ・Rev.1の生成には写しが一切出ないこと(入口が閉じている)
//   ・Rev.2で写し率がはっきり上がり、押せる・音に乗る・読める・量を悪くしていないこと
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

// ── 4. 実際に生成して比べる ──────────────────────────────────────────────────
// 繰り返しの区切りがある曲。区切りのはっきりした曲・4小節の輪が続く曲・途中で終わる曲を混ぜる
const tracks=(arg('--tracks','nothing_without_you,4u_hitasura,dullahan,kindan_no_resistance')||'').split(',').filter(Boolean);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'phrase-copy-'));
const generate=(trackId,revision)=>{
  const dir=path.join(tmp,`${trackId}-r${revision}`);
  fs.mkdirSync(dir,{recursive:true});
  const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  if(run.status!==0){console.error((run.stderr||'').split('\n').slice(0,6).join('\n'));return null;}
  return {dir,stdout:run.stdout};
};
const readShapes=(dir,trackId)=>DIFFICULTIES.map(difficulty=>{
  const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
  return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
}).filter(Boolean);
const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:0;
try{
  const echo={1:[],2:[]};

  for(const trackId of tracks){
    const legacy=generate(trackId,1),latest=generate(trackId,2);
    ok(`${trackId}: Rev.1・Rev.2とも生成できる`,!!legacy&&!!latest);
    if(!legacy||!latest)continue;
    ok(`${trackId}: Rev.1/Rev.2 と表示する`,/譜面の作り方: MHB CHART ENGINE Rev\.1（/.test(legacy.stdout)&&/譜面の作り方: MHB CHART ENGINE Rev\.2（/.test(latest.stdout));
    const legacyCharts=readShapes(legacy.dir,trackId),latestCharts=readShapes(latest.dir,trackId);

    ok(`${trackId}: Rev.1には写しが出ない(入口が閉じている)`,
      legacyCharts.every(chart=>chart.chartRevision===1&&!chart.shapes.some(entry=>entry.phraseCopyOf!=null)));
    ok(`${trackId}: Rev.2では写したかたまりがある`,latestCharts.every(chart=>chart.chartRevision===2)
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

    const before=reportFor(trackId,{source:'v3',dir:legacy.dir}),after=reportFor(trackId,{source:'v3',dir:latest.dir});
    for(const difficulty of DIFFICULTIES){
      const b=before.difficulties[difficulty],a=after.difficulties[difficulty];
      if(!a||!b)continue;
      if(b.musicality.phraseEcho!=null)echo[1].push(b.musicality.phraseEcho);
      if(a.musicality.phraseEcho!=null)echo[2].push(a.musicality.phraseEcho);
      const problems=[];
      if(a.gate.impossible>b.gate.impossible)problems.push(`押せない ${b.gate.impossible}→${a.gate.impossible}`);
      if(a.musicality.onsetHitRate<1)problems.push(`鳴っていない場所のノーツ ${a.musicality.ghostNotes}`);
      if(a.scores.readability<b.scores.readability-5)problems.push(`読める ${b.scores.readability}→${a.scores.readability}`);
      // 押しやすさは「忙しい」の件数で比べる。ここは自動修正の前の譜面なので、「押さえている最中の空き手」は
      // 出荷前の自動修正(rhythm-chart-v2-step7-autofix.js)が直す(実測: 4u_hitasura EXPERT で1箇所出たが、自動修正後は100)。
      // 押せる軸の点そのものにはそれが混ざるので、点では比べない
      if(a.hand.strained>b.hand.strained+Math.max(2,Math.round(b.noteCount*.01)))problems.push(`忙しい ${b.hand.strained}→${a.hand.strained}`);
      // 量は難易度の段そのもの。写しで大きく動かさない(取り分の引き上げは元の数まで・上乗せは1/4まで)
      if(Math.abs(a.noteCount-b.noteCount)>Math.max(8,b.noteCount*.06))problems.push(`ノーツ数 ${b.noteCount}→${a.noteCount}`);
      ok(`${trackId} ${difficulty}: 写しで押しやすさ・音・量を悪くしていない`,problems.length===0,problems.join(' / '));
    }
  }
  // 写し率は曲をまたいだ平均で比べる(区切りの短い曲では1曲ごとの揺れが大きい)
  const legacyEcho=mean(echo[1]),latestEcho=mean(echo[2]);
  ok('Rev.2でフレーズの写し率がはっきり上がる(1.4倍以上)',latestEcho>=legacyEcho*1.4&&latestEcho>=.2,
    `Rev.1 ${legacyEcho.toFixed(3)} → Rev.2 ${latestEcho.toFixed(3)}`);
  // ── 5. Rev.2のクロス(端に寄ったHOLDを内側へ寄せて置く) ──────────────────────────
  // 1曲ごとには増減がある(写しで配置が変わると、押さえの位置も変わる)ので、公開中の全曲の合計で見る。
  // 実測(2026-09-24): MASTER Rev.1 31 → Rev.2 53、EXPERT 32 → 40
  {
    const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
    const crossTotal={1:{EXPERT:0,MASTER:0},2:{EXPERT:0,MASTER:0}};
    for(const trackId of Object.values(RELEASED_TRACKS))for(const revision of [1,2])for(const difficulty of ['EXPERT','MASTER']){
      const dir=path.join(tmp,`cross-${trackId}-r${revision}`);
      fs.mkdirSync(dir,{recursive:true});
      const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'--track',trackId,
        '--chart-revision',String(revision),'--difficulty',difficulty,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
      if(run.status!==0)continue;
      const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
      crossTotal[revision][difficulty]+=JSON.parse(fs.readFileSync(file,'utf8')).notes.filter(note=>note.cross===true).length;
    }
    ok('Rev.2でMASTERのクロスがRev.1より減らない(公開中の全曲の合計)',crossTotal[2].MASTER>=crossTotal[1].MASTER,
      `Rev.1 ${crossTotal[1].MASTER} → Rev.2 ${crossTotal[2].MASTER}`);
    ok('Rev.2ではMASTERのクロスがEXPERTより多い(公開中の全曲の合計)',crossTotal[2].MASTER>crossTotal[2].EXPERT,
      `EXPERT ${crossTotal[2].EXPERT} / MASTER ${crossTotal[2].MASTER}`);
  }
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 譜面の作り方のリビジョンと、フレーズの写しは期待どおり');
process.exit(failed?1:0);
