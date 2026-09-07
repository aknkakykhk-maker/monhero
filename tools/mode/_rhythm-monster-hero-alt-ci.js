'use strict';
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const track='monster_hero_theme_alt';
const dashed='monster-hero-theme-alt';
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
const r=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-audio-analyze-v3.js'),
  '--track',track,'--audio','monster-hero/audio/bgm-monster-hero-theme-alt.mp3','--write'],{
  cwd:ROOT,encoding:'utf8',maxBuffer:256*1024*1024
});
if(r.status!==0){console.error(r.stdout||'');console.error(r.stderr||'');process.exit(r.status||1);}
const file=path.join(ROOT,'tools/mode/authoring/'+dashed+'-v3-audio.json');
const raw=fs.readFileSync(file);
const br=zlib.brotliCompressSync(raw,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}});
const b64=br.toString('base64');
console.log('[MH_ALT_AUDIO_META] raw='+raw.length+' br='+br.length+' b64='+b64.length);
const size=30000;
for(let i=0;i<Math.ceil(b64.length/size);i++)console.log('[MH_ALT_AUDIO_BR '+i+']'+b64.slice(i*size,(i+1)*size));
