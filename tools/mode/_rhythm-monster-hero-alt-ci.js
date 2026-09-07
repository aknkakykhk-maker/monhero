'use strict';
// Temporary CI extractor for Monster Hero -Another- rhythm authoring.
// This file is removed before the final implementation is merged.
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const track='monster_hero_theme_alt';
const dashed='monster-hero-theme-alt';
// CIにはffmpeg/Playwrightが無いので、作業用tmpへだけffmpeg-staticを入れる。
// package.json / package-lock / 本番依存は変更しない。
const ffRoot='/tmp/mh-alt-ffmpeg';
fs.rmSync(ffRoot,{recursive:true,force:true});
const npmInstall=spawnSync('npm',['install','--prefix',ffRoot,'--no-save','--no-package-lock','ffmpeg-static'],{
  cwd:ROOT,encoding:'utf8',maxBuffer:16*1024*1024
});
if(npmInstall.status!==0){
  console.error(npmInstall.stdout||'');
  console.error(npmInstall.stderr||'');
  process.exit(npmInstall.status||1);
}
const ffmpegPath=require(path.join(ffRoot,'node_modules/ffmpeg-static'));
const ffBin=path.join(ffRoot,'bin');
fs.mkdirSync(ffBin,{recursive:true});
fs.symlinkSync(ffmpegPath,path.join(ffBin,'ffmpeg'));
process.env.PATH=ffBin+path.delimiter+process.env.PATH;
const run=(script,args)=>{
  const r=spawnSync(process.execPath,[path.join(ROOT,'tools/mode',script),...args],{
    cwd:ROOT,encoding:'utf8',maxBuffer:128*1024*1024
  });
  console.log('[MH_ALT_STEP]',script,'status='+r.status);
  if(r.stdout)console.log(r.stdout);
  if(r.stderr)console.error(r.stderr);
  return r;
};
const analyzer=run('rhythm-audio-analyze-v3.js',[
  '--track',track,
  '--audio','monster-hero/audio/bgm-monster-hero-theme-alt.mp3',
  '--write'
]);
if(analyzer.status!==0)process.exit(analyzer.status||1);
const pipeline=run('rhythm-chart-v3-pipeline.js',['--track',track,'--write']);
const authoring=path.join(ROOT,'tools/mode/authoring');
const names=fs.readdirSync(authoring).filter(name=>name.startsWith(dashed)&&name.endsWith('.json')).sort();
const files={};
for(const name of names){
  const raw=fs.readFileSync(path.join(authoring,name),'utf8');
  try{files['tools/mode/authoring/'+name]=JSON.parse(raw);}
  catch{files['tools/mode/authoring/'+name]=raw;}
}
const registry=JSON.parse(fs.readFileSync(path.join(authoring,'rhythm-song-registry.json'),'utf8'));
const payload={
  pipelineStatus:pipeline.status,
  track,
  registryEntry:registry.songs&&registry.songs[track]||null,
  files
};
const serialized=JSON.stringify(payload);
const chunkSize=48000;
const chunks=Math.ceil(serialized.length/chunkSize);
console.log('[MH_ALT_PAYLOAD_BEGIN] chunks='+chunks+' chars='+serialized.length);
for(let i=0;i<chunks;i++){
  console.log('[MH_ALT_PAYLOAD_CHUNK '+i+'/'+chunks+']'+serialized.slice(i*chunkSize,(i+1)*chunkSize));
}
console.log('[MH_ALT_PAYLOAD_END]');
if(pipeline.status!==0)process.exit(pipeline.status||1);
