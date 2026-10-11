#!/usr/bin/env node
// 参考譜面に寄せる道具 段1c: 参考と演奏画面を同じ曲の時刻で並べる(2026-10-11・オンプくん。docs/playbot/REFERENCE_VIDEO.md「社長に見せる前に」)
//
//   node tools/mode/rhythm-ref-compare.js --track <曲id> --video <参考動画> --offset <秒> --song "<曲名>" --diff MASTER --times 82.1,82.6,83.0
//   node tools/mode/rhythm-ref-compare.js ... --look STANDARD      # 見た目のおまかせ(LIGHT / STANDARD / VIVID / FULL。既定 STANDARD)
//   node tools/mode/rhythm-ref-compare.js ... --w 844 --h 390      # 演奏画面の大きさ(既定は横持ち 844×390)
//
// 【何をするか】曲の時刻ごとに、左に参考動画のコマ(参考の時刻 = 曲の時刻 + ずれ)、右にこちらの演奏画面を並べた1枚を作り、
//   全部を縦につないだ一覧(compare-sheet.png)も作る。演奏画面は rhythm-slowmo-shot.js(仮想の時間で曲の時刻ちょうどを撮る)で撮る。
//   曲がまだゲームに入っていないときは、参考の側だけを並べ、右に「まだゲームに無い」と書く。
// 【決めごと】参考のコマは写しなので、書き出すのは tools/mode/ref-work/<曲id>/compare/ だけ(リポジトリに置かない)
'use strict';
const fs=require('fs'),path=require('path');
const {execFileSync,spawnSync}=require('child_process');
const {workDirFor,assertWorkPath,REPO_ROOT}=require('./rhythm-ref-capture.js');

const shotGame=({song,diff,t,look,w,h,outDir,name})=>{
  const r=spawnSync('node',[path.join(__dirname,'rhythm-slowmo-shot.js')],{cwd:REPO_ROOT,encoding:'utf8',timeout:240000,
    env:{...process.env,SONG:song,DIFF:diff,T:String(t),FRAMES:'1',STEP:'1',OUT:outDir,NAME:name,ONLY:look,W:String(w),H:String(h)}});
  const file=path.join(outDir,`${name}-${look.toLowerCase()}-00.png`);
  return fs.existsSync(file)?file:null;
};
// 日本語の字体(無い環境では英数字だけのラベルにする。字体が無いと日本語は四角に化ける)
const JP_FONTS=['/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf','/usr/share/fonts/truetype/fonts-japanese-gothic.ttf','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'];
const JP_FONT=JP_FONTS.find(f=>fs.existsSync(f))||null;
const label=(text,size,ascii)=>{
  const t=(JP_FONT?text:(ascii||text.replace(/[^\x20-\x7e]/g,'').trim()||'-')).replace(/[':\\%]/g,' ');
  return `drawtext=${JP_FONT?`fontfile=${JP_FONT}:`:''}text='${t}':x=8:y=8:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.6`;
};

if(require.main===module){
  const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
  try{
    const track=get('track'),video=get('video'),offset=Number(get('offset')),song=get('song'),diff=get('diff')||'MASTER';
    if(!video||!Number.isFinite(offset)||!get('times'))throw new Error('--video <参考動画> --offset <秒> --times <曲の秒,…> が要る');
    const look=get('look')||'STANDARD',W=Number(get('w')||844),H=Number(get('h')||390);
    const outDir=assertWorkPath(path.join(workDirFor(track),'compare'));fs.mkdirSync(outDir,{recursive:true});
    const rows=[];
    for(const t of get('times').split(',').map(Number)){
      const tag=t.toFixed(3).replace('.','_'),ref=path.join(outDir,`ref-${tag}.png`),row=path.join(outDir,`compare-${tag}.png`);
      execFileSync('ffmpeg',['-v','error','-y','-ss',String(t+offset),'-i',video,'-frames:v','1','-vf',`scale=-2:${H},${label(`参考 ${(t+offset).toFixed(2)}s`,18,`REF ${(t+offset).toFixed(2)}s`)}`,ref]);
      const game=song?shotGame({song,diff,t,look,w:W,h:H,outDir,name:`game-${tag}`}):null;
      if(game)execFileSync('ffmpeg',['-v','error','-y','-i',ref,'-i',game,'-filter_complex',`[1:v]scale=-2:${H},${label(`${song} ${diff} 曲 ${t.toFixed(2)}s`,18,`GAME ${diff} ${t.toFixed(2)}s`)}[g];[0:v][g]hstack=inputs=2`,row]);
      else execFileSync('ffmpeg',['-v','error','-y','-i',ref,'-f','lavfi','-i',`color=c=gray:s=${W}x${H}`,'-filter_complex',`[1:v]${label('まだゲームに無い(参考だけ)',22,'NOT IN GAME YET')}[g];[0:v][g]hstack=inputs=2`,'-frames:v','1',row]);
      rows.push(row);console.log(`曲 ${t.toFixed(2)}秒: ${game?'参考と演奏画面':'参考だけ'} → ${path.relative(REPO_ROOT,row)}`);
    }
    const sheet=path.join(outDir,'compare-sheet.png');
    if(rows.length>1){
      // 横幅をそろえてから縦につなぐ
      const inputs=rows.flatMap(r=>['-i',r]);const scaled=rows.map((_,i)=>`[${i}:v]scale=${2*W}:-2[v${i}]`).join(';');
      execFileSync('ffmpeg',['-v','error','-y',...inputs,'-filter_complex',`${scaled};${rows.map((_,i)=>`[v${i}]`).join('')}vstack=inputs=${rows.length}`,sheet]);
    }else fs.copyFileSync(rows[0],sheet);
    console.log('一覧:',path.relative(REPO_ROOT,sheet),'(リポジトリには入らない)');
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}

module.exports={shotGame};
