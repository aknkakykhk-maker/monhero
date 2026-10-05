// 新血統「ゴースト」実装予告の告知画像を、立ち絵2枚から作る(2026-10-05)。
//
//   node image/make-ghost-lineage-notice.js <太字フォントのパス>
//   例) node image/make-ghost-lineage-notice.js /tmp/mplus-rounded-800.ttf
//
// 書き出すのは monster-hero/images/events/ghost-lineage-notice.jpg(880x880・JPEG quality 80・mozjpeg)。
// 更新履歴の image に使う(お知らせの詳細と、助手の一度きりの告知の両方に出る)。
// ユグドラシルの予告(make-yggdrasil-lineage-notice.js)を写して、背景をハロウィンの夜(紫の夜空・月・こうもり・かぼちゃ)にした。
// 1760pxで描いてから半分へ縮めるので、文字のふちがなめらかになる。
//
// フォントは「M PLUS Rounded 1c」の ExtraBold(800)。Google Fonts から一時的に取ってきて使い、リポジトリには入れない。
//   https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800 の中の ttf
// 乱数は種を固定しているので、同じフォントと同じ立ち絵なら毎回同じ絵になる。
const path=require('path');
const {createCanvas,loadImage,registerFont}=require('canvas');
const sharp=require('sharp');
const fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..');
const FONT=process.argv[2];
if(!FONT||!fs.existsSync(FONT)){console.log('使い方: node image/make-ghost-lineage-notice.js <太字フォントのパス>');process.exit(1);}
registerFont(FONT,{family:'MPR'});
const OUT=path.join(ROOT,'monster-hero','images','events','ghost-lineage-notice.jpg');
const W=1760,H=1760;
const c=createCanvas(W,H),x=c.getContext('2d');
let seed=20261005;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
(async()=>{
 // 背景: ハロウィンの夜空
 let g=x.createLinearGradient(0,0,0,H);
 g.addColorStop(0,'#120a2e');g.addColorStop(.45,'#2e1458');g.addColorStop(.8,'#4a1f5e');g.addColorStop(1,'#1a0c2a');
 x.fillStyle=g;x.fillRect(0,0,W,H);
 // 大きな月
 let r=x.createRadialGradient(W/2,600,40,W/2,600,1000);
 r.addColorStop(0,'rgba(255,236,170,.75)');r.addColorStop(.3,'rgba(255,190,120,.25)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 x.fillStyle='rgba(255,240,190,.92)';x.beginPath();x.arc(W/2,640,330,0,7);x.fill();
 x.fillStyle='rgba(240,210,150,.35)';for(const [mx,my,mr] of [[-120,-90,70],[90,60,50],[-30,150,40],[150,-140,34]]){x.beginPath();x.arc(W/2+mx,640+my,mr,0,7);x.fill();}
 // 星
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<140;i++){const px=rnd()*W,py=rnd()*H*.75,pr=1.5+rnd()*4;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,'rgba(255,250,220,.9)');pg.addColorStop(1,'rgba(255,250,220,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 x.restore();
 // こうもり
 const bat=(cx,cy,s,a)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);x.fillStyle='rgba(20,8,30,.85)';x.beginPath();
  x.moveTo(0,-8);x.quadraticCurveTo(-20,-30,-60,-20);x.quadraticCurveTo(-48,-6,-52,8);x.quadraticCurveTo(-36,0,-28,14);x.quadraticCurveTo(-16,4,0,16);
  x.quadraticCurveTo(16,4,28,14);x.quadraticCurveTo(36,0,52,8);x.quadraticCurveTo(48,-6,60,-20);x.quadraticCurveTo(20,-30,0,-8);x.fill();x.restore();};
 for(let i=0;i<14;i++)bat(rnd()*W,120+rnd()*H*.45,.8+rnd()*1.4,(rnd()-.5)*.6);
 // 下のかぼちゃ
 const pumpkin=(cx,cy,s)=>{x.save();x.translate(cx,cy);x.scale(s,s);
  for(const [ox,w] of [[-38,52],[38,52],[0,60]]){const pg=x.createRadialGradient(ox-10,-14,6,ox,0,70);pg.addColorStop(0,'#ffb347');pg.addColorStop(1,'#c4570e');x.fillStyle=pg;x.beginPath();x.ellipse(ox,0,w,56,0,0,7);x.fill();}
  x.fillStyle='#3a6b1e';x.beginPath();x.roundRect(-8,-74,16,26,6);x.fill();
  x.fillStyle='rgba(255,230,120,.95)';x.beginPath();x.moveTo(-34,-8);x.lineTo(-18,-24);x.lineTo(-6,-6);x.closePath();x.fill();x.beginPath();x.moveTo(34,-8);x.lineTo(18,-24);x.lineTo(6,-6);x.closePath();x.fill();
  x.beginPath();x.moveTo(-40,14);x.lineTo(-24,24);x.lineTo(-12,14);x.lineTo(0,26);x.lineTo(12,14);x.lineTo(24,24);x.lineTo(40,14);x.lineTo(28,38);x.lineTo(-28,38);x.closePath();x.fill();x.restore();};
 for(const [px,s] of [[110,1.5],[260,1.0],[W-120,1.6],[W-270,1.0]])pumpkin(px,1500,s);
 // 漂うおばけの光
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<40;i++){const px=rnd()*W,py=500+rnd()*1000,pr=6+rnd()*14;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,i%2?'rgba(160,255,220,.5)':'rgba(255,220,150,.45)');pg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 x.restore();

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
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=30;x.shadowOffsetY=10;title('ゴースト',335,230,'#fff3c4','#f08a24','#2a0f3d');x.restore();
 x.save();x.font='62px MPR';x.textAlign='center';x.fillStyle='#fffde8';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.fillText('いたずら好きの、新しい仲間がやってくる',W/2,500);x.restore();

 // 2体
 const mon=async(file,cx,bottom,boxW,boxH,glow)=>{const im=await loadImage(file);const s=Math.min(boxW/im.width,boxH/im.height);const w=im.width*s,h=im.height*s;
  const gg=x.createRadialGradient(cx,bottom-h*.45,20,cx,bottom-h*.45,Math.max(w,h)*.62);gg.addColorStop(0,glow);gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.beginPath();x.arc(cx,bottom-h*.45,Math.max(w,h)*.62,0,7);x.fill();
  x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(cx,bottom-6,w*.42,34,0,0,7);x.fill();
  x.drawImage(im,cx-w/2,bottom-h,w,h);};
 await mon(path.join(ROOT,'monster-hero/images/monsters/ghost.png'),W*.29,1390,640,800,'rgba(255,245,210,.7)');
 await mon(path.join(ROOT,'monster-hero/images/monsters/spooky.png'),W*.715,1390,700,820,'rgba(170,255,225,.65)');

 // 名札
 const plate=(cx,cy,name,chip,chipCol,sub)=>{x.save();const w=680,h=156;
  x.fillStyle='rgba(30,12,48,.85)';x.beginPath();x.roundRect(cx-w/2,cy-h/2,w,h,36);x.fill();x.lineWidth=6;x.strokeStyle='#e7c45a';x.stroke();
  x.font='64px MPR';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fffbe0';x.fillText(name,cx+82,cy-20);
  x.fillStyle=chipCol;x.beginPath();x.roundRect(cx-w/2+26,cy-52,136,64,32);x.fill();x.font='42px MPR';x.fillStyle='#fff';x.fillText(chip,cx-w/2+94,cy-19);
  x.font='38px MPR';x.fillStyle='#e3d2ff';x.fillText(sub,cx,cy+46);x.restore();};
 plate(W*.29,1478,'ゴースト','純血','#7a4fc4','ゴースト × ゴースト');
 plate(W*.715,1478,'スプーキー','レア','#c7862a','ゴースト × ？？？');

 // 下の帯
 const bg=x.createLinearGradient(0,1560,0,H);bg.addColorStop(0,'rgba(60,20,90,.0)');bg.addColorStop(.25,'rgba(40,16,70,.9)');bg.addColorStop(1,'rgba(20,8,40,.95)');x.fillStyle=bg;x.fillRect(0,1560,W,H-1560);
 x.save();x.font='80px MPR';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=16;x.strokeStyle='#3a1560';x.strokeText('マーケットに近日追加',W/2,1652);
 const bt=x.createLinearGradient(0,1614,0,1694);bt.addColorStop(0,'#fff6c2');bt.addColorStop(1,'#f0b93a');x.fillStyle=bt;x.fillText('マーケットに近日追加',W/2,1652);x.restore();
 x.save();x.font='34px MPR';x.textAlign='center';x.fillStyle='#e6d6ff';x.fillText('C O M I N G   S O O N',W/2,1740);x.restore();
 // 外枠
 x.lineWidth=14;x.strokeStyle='#e7c45a';x.strokeRect(7,7,W-14,H-14);
 const info=await sharp(c.toBuffer('image/png')).resize(880,880).jpeg({quality:80,mozjpeg:true}).toFile(OUT);
 console.log(`書き出しました: ${path.relative(ROOT,OUT)} (${Math.round(info.size/1024)}KB)`);
})();
