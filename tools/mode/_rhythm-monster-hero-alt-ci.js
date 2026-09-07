'use strict';
// Temporary CI-only implementation rehearsal for Monster Hero -Another-.
// Removed before merge. It uses existing repo tools and prints a patch for ChatGPT to apply.
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const track='monster_hero_theme_alt';
const dashed='monster-hero-theme-alt';
const run=(script,args=[])=>{
  const r=spawnSync(process.execPath,[path.join(ROOT,'tools/mode',script),...args],{
    cwd:ROOT,encoding:'utf8',maxBuffer:256*1024*1024
  });
  console.log('[MH_ALT_STEP]',script,'status='+r.status);
  if(r.stdout)console.log(r.stdout);
  if(r.stderr)console.error(r.stderr);
  if(r.status!==0)throw new Error(script+' failed');
  return r;
};
const runCmd=(cmd,args=[])=>{
  const r=spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8',maxBuffer:256*1024*1024});
  console.log('[MH_ALT_CMD]',cmd,args.join(' '),'status='+r.status);
  if(r.stdout)console.log(r.stdout);
  if(r.stderr)console.error(r.stderr);
  if(r.status!==0)throw new Error(cmd+' failed');
  return r;
};

// CIにffmpeg/Playwrightが無いので、作業用tmpへだけffmpeg-staticを入れる。
// package.json / package-lock / 本番依存は変更しない。
const ffRoot='/tmp/mh-alt-ffmpeg';
fs.rmSync(ffRoot,{recursive:true,force:true});
const npmInstall=spawnSync('npm',['install','--prefix',ffRoot,'--no-save','--no-package-lock','ffmpeg-static'],{
  cwd:ROOT,encoding:'utf8',maxBuffer:32*1024*1024
});
if(npmInstall.status!==0)throw new Error((npmInstall.stderr||npmInstall.stdout||'npm install failed').trim());
const ffmpegPath=require(path.join(ffRoot,'node_modules/ffmpeg-static'));
const ffBin=path.join(ffRoot,'bin');
fs.mkdirSync(ffBin,{recursive:true});
fs.symlinkSync(ffmpegPath,path.join(ffBin,'ffmpeg'));
process.env.PATH=ffBin+path.delimiter+process.env.PATH;

// 1) 音源そのものからV3解析・5難易度生成
run('rhythm-audio-analyze-v3.js',[
  '--track',track,'--audio','monster-hero/audio/bgm-monster-hero-theme-alt.mp3','--write'
]);
run('rhythm-chart-v3-pipeline.js',['--track',track,'--write']);

const authoringDir=path.join(ROOT,'tools/mode/authoring');
const registryPath=path.join(authoringDir,'rhythm-song-registry.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const reg=registry.songs[track];
if(!reg)throw new Error('registry entry missing');

// 2) ランタイムへ空マーカーと曲定義を追加し、正式release処理に流し込ませる
const runtimePath=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
let rt=fs.readFileSync(runtimePath,'utf8');
const diffIds=['easy','normal','hard','expert','master'];
const vars={easy:'Easy',normal:'Normal',hard:'Hard',expert:'Expert',master:'Master'};
const arrays=diffIds.map(id=>`const monsterHeroAnother${vars[id]}Notes=((t,h,f,s)=>[
// <monster-hero-theme-alt-v3-${id}-notes>
// </monster-hero-theme-alt-v3-${id}-notes>
])(mhTap,mhHoldV2,mhFlick,mhSlideV2);`).join('\n');
const chartBlock=`
// Monster Hero -Another-。本編BGMに既にある別テイクをそのまま使う。
// 音源を複製せず、V3がこの音源そのものを解析して作った譜面。
const MONSTER_HERO_ANOTHER_DURATION_MS=${reg.durationMs};
${arrays}
const monsterHeroAnotherCharts=Object.freeze({
  EASY:mhChart(1,monsterHeroAnotherEasyNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  NORMAL:mhChart(3,monsterHeroAnotherNormalNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  HARD:mhChart(5,monsterHeroAnotherHardNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  EXPERT:mhChart(7,monsterHeroAnotherExpertNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
  MASTER:mhChart(9,monsterHeroAnotherMasterNotes,MONSTER_HERO_ANOTHER_DURATION_MS),
});

`;
const insertBefore="// MF × ICHIKA MIX（元「あつ杯テーマ」）。先行公開の1曲。譜面はV3パイプラインが入れる。";
if(!rt.includes(insertBefore))throw new Error('runtime chart insert anchor missing');
rt=rt.replace(insertBefore,chartBlock+insertBefore);

const nextSong="  Object.freeze({\n    songId:'six_eternel_remix',";
const songBlock=`  Object.freeze({
    songId:'monster_hero_another',
    displayName:'Monster Hero -Another-',
    bgmTrackId:'monster_hero_theme_alt',
    // ユーザー指示: ジャケットは「Monster Hero」と同じ絵を使う。
    artwork:'images/song-art/monster-hero.jpg?v=8f7d0efd07fd',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,monsterHeroAnotherCharts[id]||emptyRhythmChart()
    ])))
  }),
`;
if(!rt.includes(nextSong))throw new Error('song insert anchor missing');
rt=rt.replace(nextSong,songBlock+nextSong);
const demoAnchor="  'monster_hero',\n";
if(!rt.includes(demoAnchor))throw new Error('demo id anchor missing');
rt=rt.replace(demoAnchor,demoAnchor+"  // 2026-09-08追加。本編BGMの別テイク。ジャケットはMonster Heroと共通。\n  'monster_hero_another',\n");
fs.writeFileSync(runtimePath,rt);

// 配信側の「押せる」検査が新曲を必ず見るための対応表
const runtimeNotesPath=path.join(ROOT,'tools/mode/rhythm-runtime-notes.js');
let rn=fs.readFileSync(runtimeNotesPath,'utf8');
rn=rn.replace("  monster_hero:'monster-hero-v3',\n","  monster_hero:'monster-hero-v3',\n  monster_hero_another:'monster-hero-theme-alt-v3',\n");
rn=rn.replace("  monster_hero:'monster_hero_theme',\n","  monster_hero:'monster_hero_theme',\n  monster_hero_another:'monster_hero_theme_alt',\n");
fs.writeFileSync(runtimeNotesPath,rn);

// 3) 正式runtimeへ流し込み。debug候補も作られ、配信データの重なり補正も走る
run('rhythm-chart-v3-pipeline.js',['--track',track,'--release']);
run('rhythm-chart-level.js',['--write']);

// 4) ヘルプ: 曲一覧自体は実データから自動生成。ここでは別テイク＋共通ジャケットだけ説明する
const helpPath=path.join(ROOT,'monster-hero/data/help.js');
let help=fs.readFileSync(helpPath,'utf8');
const helpAnchor="{t:'p',text:'モンヒロビートでは、公開している曲をそれぞれEASY・NORMAL・HARD・EXPERT・MASTERの5難易度で遊べます。曲は少しずつ増えていきます。'},";
if(!help.includes(helpAnchor))throw new Error('help anchor missing');
help=help.replace(helpAnchor,helpAnchor+"\n          {t:'note', title:'Monster Hero -Another-', text:'「Monster Hero -Another-」は「Monster Hero」とは別テイクの曲です。曲えらびでは別の曲として記録されます。ジャケットは「Monster Hero」と同じ絵を使っています。'},");
fs.writeFileSync(helpPath,help);

// 5) 実データから更新情報の数値を作る
rt=fs.readFileSync(runtimePath,'utf8');
const levelMatch=rt.match(/monster_hero_another:Object\.freeze\(\{([^}]+)\}\)/);
if(!levelMatch)throw new Error('computed levels missing');
const levels=Object.fromEntries(levelMatch[1].split(',').map(part=>{
  const [k,v]=part.split(':'); return [k.trim(),Number(v)];
}));
const fixed={};
for(const id of ['EASY','NORMAL','HARD','EXPERT','MASTER']){
  fixed[id]=JSON.parse(fs.readFileSync(path.join(authoringDir,`${dashed}-v3-fixed-${id.toLowerCase()}.json`),'utf8'));
}
const counts=Object.fromEntries(Object.entries(fixed).map(([k,v])=>[k,v.notes.length]));
const seconds=(reg.durationMs/1000).toFixed(2);
const changelogPath=path.join(ROOT,'monster-hero/data/changelog.js');
let changelog=fs.readFileSync(changelogPath,'utf8');
const changeAnchor='const CHANGELOG = [';
if(!changelog.includes(changeAnchor))throw new Error('changelog anchor missing');
const entry=`
  {
    date: "2026-09-08 07:35", type:'update', title:'モンヒロビートに新曲「Monster Hero -Another-」を追加しました', status:'new',
    assistantNotice:{id:'update_notice_monster_hero_another_v1',type:'content'},
    items:[
      '「Monster Hero -Another-」（約${Math.round(reg.durationMs/1000)}秒）を追加しました。本編ですでに使っている別テイクのBGMをそのまま使い、音源は複製していません。ジャケットは「Monster Hero」と同じ絵です。',
      'EASY Lv.${levels.EASY} ／ NORMAL Lv.${levels.NORMAL} ／ HARD Lv.${levels.HARD} ／ EXPERT Lv.${levels.EXPERT} ／ MASTER Lv.${levels.MASTER}。ノーツ数は ${counts.EASY} ／ ${counts.NORMAL} ／ ${counts.HARD} ／ ${counts.EXPERT} ／ ${counts.MASTER} です。',
      '譜面はAnotherの音源そのものを解析して作っています（約${reg.analyzedTiming.bpm.toFixed(1)}BPM・${reg.analyzedTiming.beatsPerBar}拍子）。元の「Monster Hero」の譜面コピーではありません。',
      '自己ベスト・全国ランキングは「Monster Hero」と別の曲として記録されます。EXPERT以上は、同じ曲の1つ下の難易度をクリアすると遊べます。',
    ],
  },`;
changelog=changelog.replace(changeAnchor,changeAnchor+entry);
fs.writeFileSync(changelogPath,changelog);

// 6) 正規ビルドと関連検査
runCmd(process.execPath,['tools/build.js']);
const checks=[
 ['tools/build.js',['--check']],
 ['tools/check-syntax.js',[]],
 ['tools/undefined-reference-check.js',[]],
 ['tools/update-notice-check.js',[]],
 ['tools/assistant/assistant-update-notice-check.js',[]],
 ['tools/help-coverage-check.js',[]],
 ['tools/help-guide-check.js',[]],
 ['tools/mode/rhythm-demo-entry-check.js',[]],
 ['tools/mode/rhythm-chart-level-check.js',[]],
 ['tools/mode/rhythm-song-length-check.js',[]],
 ['tools/mode/rhythm-song-challenge-check.js',[]],
 ['tools/mode/rhythm-overlap-reach-check.js',[]],
 ['tools/audio/bgm-arrangement-check.js',[]],
];
for(const [script,args] of checks)runCmd(process.execPath,[script,...args]);

// 7) ChatGPTへ返す: 既存ファイルはunified diff、新規JSONはpayload。
// temp helper/hook自体はHEADにあるのでdiffへ混ざらない。
const diff=runCmd('git',['diff','--no-ext-diff','--unified=1']).stdout;
const newFiles={};
const status=runCmd('git',['status','--porcelain']).stdout.split(/\r?\n/).filter(Boolean);
for(const line of status){
  if(!line.startsWith('?? '))continue;
  const rel=line.slice(3);
  if(rel.startsWith('tools/mode/authoring/'+dashed)||rel.startsWith('monster-hero/debug/'+dashed)){
    const raw=fs.readFileSync(path.join(ROOT,rel),'utf8');
    newFiles[rel]=JSON.parse(raw);
  }
}
const finalPayload=JSON.stringify({
  summary:{registryEntry:reg,levels,counts,durationSeconds:Number(seconds)},
  diff,
  newFiles
});
const chunkSize=48000,chunks=Math.ceil(finalPayload.length/chunkSize);
console.log('[MH_ALT_FINAL_BEGIN] chunks='+chunks+' chars='+finalPayload.length);
for(let i=0;i<chunks;i++)console.log('[MH_ALT_FINAL_CHUNK '+i+'/'+chunks+']'+finalPayload.slice(i*chunkSize,(i+1)*chunkSize));
console.log('[MH_ALT_FINAL_END]');
