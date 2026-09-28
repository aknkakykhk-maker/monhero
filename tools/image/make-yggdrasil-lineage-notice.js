// 新血統「ユグドラシル」実装予告の告知画像を、立ち絵2枚から作る(2026-09-28)。
//
//   node image/make-yggdrasil-lineage-notice.js <太字フォントのパス>
//   例) node image/make-yggdrasil-lineage-notice.js /tmp/mplus-rounded-800.ttf
//
// 書き出すのは monster-hero/images/events/yggdrasil-lineage-notice.jpg(880x880・JPEG quality 80・mozjpeg)。
// 更新履歴の image に使う(お知らせの詳細と、助手の一度きりの告知の両方に出る)。
// 1760pxで描いてから半分へ縮めるので、文字のふちがなめらかになる。
//
// フォントは「M PLUS Rounded 1c」の ExtraBold(800)を使った。サンドボックスに太字の日本語フォントが無いので
// Google Fonts から一時的に取ってきて使い、リポジトリには入れていない(3.6MBあるため)。
//   https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800 の中の ttf
// 乱数は種を固定しているので、同じフォントと同じ立ち絵なら毎回同じ絵になる。
const path=require('path');
const {createCanvas,loadImage,registerFont}=require('canvas');
const sharp=require('sharp');
const fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..');
const FONT=process.argv[2];
if(!FONT||!fs.existsSync(FONT)){console.log('使い方: node image/make-yggdrasil-lineage-notice.js <太字フォントのパス>');process.exit(1);}
registerFont(FONT,{family:'MPR'});
const OUT=path.join(ROOT,'monster-hero','images','events','yggdrasil-lineage-notice.jpg');
const W=1760,H=1760;
const c=createCanvas(W,H),x=c.getContext('2d');
let seed=20260928;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
(async()=>{
 // 背景: 森の奥の光
 let g=x.createLinearGradient(0,0,0,H);
 g.addColorStop(0,'#0b2a17');g.addColorStop(.45,'#1d5a2c');g.addColorStop(.8,'#3f7a2e');g.addColorStop(1,'#1a3b1a');
 x.fillStyle=g;x.fillRect(0,0,W,H);
 let r=x.createRadialGradient(W/2,560,40,W/2,560,1100);
 r.addColorStop(0,'rgba(246,255,196,.85)');r.addColorStop(.35,'rgba(190,240,140,.35)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 // 木漏れ日の筋
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<9;i++){const cx=W/2+(i-4)*180+rnd()*60;x.beginPath();x.moveTo(cx-30,-40);x.lineTo(cx+30,-40);x.lineTo(W/2+(i-4)*420+160,H);x.lineTo(W/2+(i-4)*420-160,H);x.closePath();
  const lg=x.createLinearGradient(0,0,0,H);lg.addColorStop(0,'rgba(255,255,220,.16)');lg.addColorStop(.7,'rgba(255,255,220,.03)');lg.addColorStop(1,'rgba(255,255,220,0)');x.fillStyle=lg;x.fill();}
 x.restore();
 // 左右の葉のシルエット
 const leaf=(cx,cy,len,ang,col)=>{x.save();x.translate(cx,cy);x.rotate(ang);x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(len*.5,-len*.28,len,0);x.quadraticCurveTo(len*.5,len*.28,0,0);x.fillStyle=col;x.fill();x.strokeStyle='rgba(0,0,0,.15)';x.lineWidth=4;x.beginPath();x.moveTo(0,0);x.lineTo(len*.95,0);x.stroke();x.restore();};
 for(let i=0;i<26;i++){const side=i%2?1:-1;const cx=side<0?rnd()*260-60:W-rnd()*260+60;const cy=rnd()*H;leaf(cx,cy,180+rnd()*200,(side<0?0:Math.PI)+(rnd()-.5)*1.4,`rgba(${30+rnd()*40|0},${90+rnd()*70|0},${30+rnd()*30|0},${.55+rnd()*.35})`);}
 // 舞う葉と光の粒
 for(let i=0;i<40;i++)leaf(rnd()*W,rnd()*H*.9,30+rnd()*40,rnd()*6.3,`rgba(${150+rnd()*80|0},${220+rnd()*35|0},${90+rnd()*60|0},${.35+rnd()*.4})`);
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<120;i++){const px=rnd()*W,py=rnd()*H,pr=2+rnd()*7;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,'rgba(255,255,230,.9)');pg.addColorStop(1,'rgba(255,255,230,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 x.restore();
 // メルホイップ側に甘い色の粒(イチゴ・ベリー・クリーム)
 for(let i=0;i<26;i++){const px=W*.55+rnd()*W*.42,py=620+rnd()*900;const col=['rgba(255,120,150,.55)','rgba(255,255,255,.6)','rgba(120,110,230,.45)','rgba(255,200,120,.5)'][i%4];x.fillStyle=col;x.beginPath();x.arc(px,py,6+rnd()*10,0,7);x.fill();}

 // 上のリボン「新血統 実装予告」
 const ribbon=(cy,w,h,text,size)=>{x.save();x.translate(W/2,cy);
  x.fillStyle='#7a4a12';x.beginPath();x.moveTo(-w/2-70,-h/2+18);x.lineTo(-w/2+10,-h/2+18);x.lineTo(-w/2+10,h/2+18);x.lineTo(-w/2-70,h/2+18);x.lineTo(-w/2-40,18);x.closePath();x.fill();
  x.beginPath();x.moveTo(w/2+70,-h/2+18);x.lineTo(w/2-10,-h/2+18);x.lineTo(w/2-10,h/2+18);x.lineTo(w/2+70,h/2+18);x.lineTo(w/2+40,18);x.closePath();x.fill();
  const rg=x.createLinearGradient(0,-h/2,0,h/2);rg.addColorStop(0,'#fff3b0');rg.addColorStop(.5,'#e7b43a');rg.addColorStop(1,'#b87918');
  x.fillStyle=rg;x.beginPath();x.roundRect(-w/2,-h/2,w,h,22);x.fill();x.lineWidth=6;x.strokeStyle='#fff8d6';x.stroke();
  x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#3d2305';x.fillText(text,0,4);x.restore();};
 ribbon(150,720,120,'新血統 実装予告',78);

 // 大見出し「ユグドラシル」
 const title=(text,cy,size,from,to,stroke)=>{x.save();x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='middle';
  x.lineJoin='round';x.lineWidth=size*.22;x.strokeStyle=stroke;x.strokeText(text,W/2,cy);
  x.lineWidth=size*.09;x.strokeStyle='#fffbe6';x.strokeText(text,W/2,cy);
  const tg=x.createLinearGradient(0,cy-size/2,0,cy+size/2);tg.addColorStop(0,from);tg.addColorStop(1,to);x.fillStyle=tg;x.fillText(text,W/2,cy);x.restore();};
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=30;x.shadowOffsetY=10;title('ユグドラシル',335,210,'#f7ffb8','#5fbf2a','#123f18');x.restore();
 x.save();x.font='62px MPR';x.textAlign='center';x.fillStyle='#fffde8';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.fillText('森の奥から、新しい仲間がやってくる',W/2,500);x.restore();

 // 2体
 const mon=async(file,cx,bottom,boxW,boxH,glow)=>{const im=await loadImage(file);const s=Math.min(boxW/im.width,boxH/im.height);const w=im.width*s,h=im.height*s;
  const gg=x.createRadialGradient(cx,bottom-h*.45,20,cx,bottom-h*.45,Math.max(w,h)*.62);gg.addColorStop(0,glow);gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.beginPath();x.arc(cx,bottom-h*.45,Math.max(w,h)*.62,0,7);x.fill();
  x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(cx,bottom-6,w*.42,34,0,0,7);x.fill();
  x.drawImage(im,cx-w/2,bottom-h,w,h);};
 await mon(path.join(ROOT,'monster-hero/images/monsters/yggdrasil.png'),W*.285,1390,760,800,'rgba(230,255,170,.75)');
 await mon(path.join(ROOT,'monster-hero/images/monsters/mel-whip.png'),W*.715,1390,700,820,'rgba(255,240,200,.8)');

 // 名札
 const plate=(cx,cy,name,chip,chipCol,sub)=>{x.save();const w=680,h=156;
  x.fillStyle='rgba(12,40,20,.82)';x.beginPath();x.roundRect(cx-w/2,cy-h/2,w,h,36);x.fill();x.lineWidth=6;x.strokeStyle='#e7c45a';x.stroke();
  x.font='64px MPR';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fffbe0';x.fillText(name,cx+82,cy-20);
  x.fillStyle=chipCol;x.beginPath();x.roundRect(cx-w/2+26,cy-52,136,64,32);x.fill();x.font='42px MPR';x.fillStyle='#fff';x.fillText(chip,cx-w/2+94,cy-19);
  x.font='38px MPR';x.fillStyle='#cfe9b5';x.fillText(sub,cx,cy+46);x.restore();};
 plate(W*.285,1478,'ユグドラシル','純血','#3f9d3a','ユグドラシル × ユグドラシル');
 plate(W*.715,1478,'メルホイップ','レア','#c7862a','ユグドラシル × ？？？');

 // 下の帯
 const bg=x.createLinearGradient(0,1560,0,H);bg.addColorStop(0,'rgba(60,20,90,.0)');bg.addColorStop(.25,'rgba(40,16,70,.9)');bg.addColorStop(1,'rgba(20,8,40,.95)');x.fillStyle=bg;x.fillRect(0,1560,W,H-1560);
 x.save();x.font='80px MPR';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=16;x.strokeStyle='#3a1560';x.strokeText('ビートP交換所で先行公開予定',W/2,1652);
 const bt=x.createLinearGradient(0,1614,0,1694);bt.addColorStop(0,'#fff6c2');bt.addColorStop(1,'#f0b93a');x.fillStyle=bt;x.fillText('ビートP交換所で先行公開予定',W/2,1652);x.restore();
 x.save();x.font='34px MPR';x.textAlign='center';x.fillStyle='#e6d6ff';x.fillText('C O M I N G   S O O N',W/2,1740);x.restore();
 // 外枠
 x.lineWidth=14;x.strokeStyle='#e7c45a';x.strokeRect(7,7,W-14,H-14);
 const info=await sharp(c.toBuffer('image/png')).resize(880,880).jpeg({quality:80,mozjpeg:true}).toFile(OUT);
 console.log(`書き出しました: ${path.relative(ROOT,OUT)} (${Math.round(info.size/1024)}KB)`);
})();
