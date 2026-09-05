#!/usr/bin/env node
// 円盤石の画像を「どれも同じ大きさ・真ん中」で見せるための scale/x/y を計算して出す。
//
//   node tools/image/disc-icon-values.js
//
// 出た値を game-system.jsx の MARKET_PROFILE_ICON_STYLES の「--- 円盤石 ---」へ貼る。
// 円盤石の画像を差し替えたり増やしたりしたら流し直す。
//
// 【なぜ要るか】
// 円盤石の画像は余白の量が絵ごとにまったく違う。
// 正方形の絵(1254x1254など)は中身が97%まで来ているが、
// 1536x1024の絵は円盤が幅の64%しかなく、そのまま出すと同じ画面に大小の円盤が並ぶ。
// 手で倍率を決めていたので、付いている絵と付いていない絵が混ざり、
// 「◯◯の円盤石」と「◯◯の円盤石アイコン」が同じ画像なのに別物に見えていた。
// さらにミーア・パンドラの円盤石には顔用の拡大値が付いたままで、
// 円盤が枠からはみ出していた(2026-09-05・ユーザー指摘)。
// 元画像から計算すれば、どの絵でも同じ収まりになる。
const fs=require('fs'),path=require('path'),vm=require('vm');
const {createCanvas,loadImage}=require('canvas');
const ROOT=path.resolve(__dirname,'..','..','monster-hero');
const BOX=256, TARGET=0.95;   // 円盤の直径を枠の95%にそろえる
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'data/images/images-ally.js'),'utf8')+'\n'
  +fs.readFileSync(path.join(ROOT,'data/breeder.js'),'utf8')
  +"\nglobalThis.__D=BREEDER_MARKET_ITEMS.filter(i=>/円盤石/.test(i.name));",ctx);
(async()=>{
  console.log('商品id                    画像                        → scale  x     y');
  const out={};
  for(const it of ctx.__D){
    const rel=String(it.icon).split('?')[0];
    const img=await loadImage(path.join(ROOT,rel));
    const c=createCanvas(img.width,img.height),cc=c.getContext('2d');
    cc.drawImage(img,0,0);
    const d=cc.getImageData(0,0,img.width,img.height).data;
    let l=img.width,r=-1,t=img.height,b=-1;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
      if(d[(y*img.width+x)*4+3]<24)continue;
      if(x<l)l=x; if(x>r)r=x; if(y<t)t=y; if(y>b)b=y;
    }
    const k=Math.min(BOX/img.width,BOX/img.height);
    const drawnW=img.width*k, drawnH=img.height*k;
    const cw=(r-l+1)*k, ch=(b-t+1)*k;         // 枠に収めた時点での中身の大きさ
    const s=+(TARGET*BOX/Math.max(cw,ch)).toFixed(3);
    const cxFrac=((l+r)/2)/img.width, cyFrac=((t+b)/2)/img.height;
    const x=+(-s*(cxFrac-0.5)*(drawnW/BOX)*100).toFixed(1);
    const y=+(-s*(cyFrac-0.5)*(drawnH/BOX)*100).toFixed(1);
    out[it.id]={scale:s,x,y};
    console.log(it.id.padEnd(24),rel.replace('images/disc-icons/','').padEnd(24),
      String(s).padStart(6),String(x).padStart(6),String(y).padStart(6));
  }
  console.log('');
  console.log('game-system.jsx の MARKET_PROFILE_ICON_STYLES へ貼る形:');
  for(const [id,v] of Object.entries(out))
    console.log(`  ${id}: { scale: ${v.scale}, x: ${v.x}, y: ${v.y} },`);
})();
