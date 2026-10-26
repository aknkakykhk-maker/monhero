// 新血統「キュービ」の新モンスター「キュービ」「オリヒメ」実装予告の告知画像を、立ち絵2枚から作る(2026-10-27)。
//
//   node image/make-kyubi-orihime-lineage-notice.js <太字フォントのパス>
//
// 書き出すのは monster-hero/images/events/kyubi-orihime-notice.jpg(880x880・JPEG quality 80・mozjpeg)。
// 更新履歴の image に使う(お知らせの詳細と、助手の一度きりの告知の両方に出る)。
// イルミネ・ドリーミィの予告(make-illumine-dreamy-lineage-notice.js)を写して、名前・血統・絵の光の色・下の帯の文を差し替えた。
// 下の帯は「近日実装」(マーケットに並べるかはまだ決まっていないので「マーケットに近日追加」とは書かない)。
// 1760pxで描いてから半分へ縮めるので、文字のふちがなめらかになる。
//
// フォントは「M PLUS Rounded 1c」の ExtraBold(800)。Google Fonts から一時的に取ってきて使い、リポジトリには入れない。
// 乱数は種を固定しているので、同じフォントと同じ立ち絵なら毎回同じ絵になる。
const path=require('path');
const {createCanvas,loadImage,registerFont}=require('canvas');
const sharp=require('sharp');
const fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..');
const FONT=process.argv[2];
if(!FONT||!fs.existsSync(FONT)){console.log('使い方: node image/make-kyubi-orihime-lineage-notice.js <太字フォントのパス>');process.exit(1);}
registerFont(FONT,{family:'MPR'});
const OUT=path.join(ROOT,'monster-hero','images','events','kyubi-orihime-notice.jpg');
const W=1760,H=1760;
const c=createCanvas(W,H),x=c.getContext('2d');
let seed=20261027;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
(async()=>{
 // 背景: 上は深い夜の紫、下へ向かってパステルの夢色
 let g=x.createLinearGradient(0,0,0,H);
 g.addColorStop(0,'#0d0a2a');g.addColorStop(.4,'#2c1d5c');g.addColorStop(.72,'#8a5ab0');g.addColorStop(.9,'#f3b6d6');g.addColorStop(1,'#2a1640');
 x.fillStyle=g;x.fillRect(0,0,W,H);
 // 左は月明かり、右は夢のにじみ
 let r=x.createRadialGradient(W*.2,560,30,W*.2,560,820);
 r.addColorStop(0,'rgba(190,170,255,.55)');r.addColorStop(.4,'rgba(140,110,230,.22)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 r=x.createRadialGradient(W*.8,1050,40,W*.8,1050,900);
 r.addColorStop(0,'rgba(255,220,240,.7)');r.addColorStop(.35,'rgba(170,220,255,.3)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 // 月(左上)
 x.fillStyle='rgba(255,246,210,.95)';x.beginPath();x.arc(W*.2,620,180,0,7);x.fill();
 x.fillStyle='rgba(44,29,92,1)';x.beginPath();x.arc(W*.2+70,580,160,0,7);x.fill();
 x.fillStyle='rgba(220,200,255,.22)';x.beginPath();x.arc(W*.2,620,260,0,7);x.fill();
 // 雲(右・パステル)
 const cloud=(cx,cy,s,col)=>{x.fillStyle=col;for(const [ox,oy,rr] of [[-70,0,50],[0,-24,66],[76,0,52],[10,18,60]]){x.beginPath();x.arc(cx+ox*s,cy+oy*s,rr*s,0,7);x.fill();}};
 cloud(W*.66,300,1.6,'rgba(255,220,240,.55)');cloud(W*.9,440,1.2,'rgba(200,230,255,.5)');cloud(W*.76,860,1.4,'rgba(255,240,200,.4)');cloud(W*.95,1150,1.1,'rgba(255,210,235,.45)');
 // 星(全体)ときらめき(右)
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<110;i++){const px=rnd()*W,py=rnd()*H*.55,pr=1.5+rnd()*3.5;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,'rgba(255,250,230,.9)');pg.addColorStop(1,'rgba(255,250,230,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 for(let i=0;i<40;i++){const px=W*.5+rnd()*W*.5,py=500+rnd()*1000,pr=6+rnd()*14;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,i%2?'rgba(255,190,230,.55)':'rgba(170,230,255,.55)');pg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 x.restore();
 // 舞う光のすじ(左・オーロラ)
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<4;i++){const ag=x.createLinearGradient(0,300+i*120,W*.55,700+i*120);ag.addColorStop(0,'rgba(255,120,220,0)');ag.addColorStop(.5,i%2?'rgba(255,140,220,.16)':'rgba(140,170,255,.16)');ag.addColorStop(1,'rgba(255,200,120,0)');
  x.strokeStyle=ag;x.lineWidth=60;x.beginPath();x.moveTo(-40,420+i*140);x.bezierCurveTo(W*.18,300+i*140,W*.32,620+i*140,W*.56,480+i*140);x.stroke();}
 x.restore();

 // 上のリボン「新血統 実装予告」
 // 金の板は文字の長さに合わせて伸ばす(左右の余白は字の大きさの0.6倍ずつ)。後ろの茶色のリボンも板の端に付いてくる。
 // 文字は字の形の上下の中心を板の中心にそろえる(2026-10-22 社長「文字の位置というか後ろのやつずれてない？」)
 const ribbon=(cy,w,h,text,size)=>{x.save();x.translate(W/2,cy);
  x.font=`${size}px MPR`;const tm=x.measureText(text);w=Math.max(w,Math.ceil(tm.width+size*1.2));
  x.fillStyle='#7a4a12';x.beginPath();x.moveTo(-w/2-70,-h/2+18);x.lineTo(-w/2+10,-h/2+18);x.lineTo(-w/2+10,h/2+18);x.lineTo(-w/2-70,h/2+18);x.lineTo(-w/2-40,18);x.closePath();x.fill();
  x.beginPath();x.moveTo(w/2+70,-h/2+18);x.lineTo(w/2-10,-h/2+18);x.lineTo(w/2-10,h/2+18);x.lineTo(w/2+70,h/2+18);x.lineTo(w/2+40,18);x.closePath();x.fill();
  const rg=x.createLinearGradient(0,-h/2,0,h/2);rg.addColorStop(0,'#fff3b0');rg.addColorStop(.5,'#e7b43a');rg.addColorStop(1,'#b87918');
  x.fillStyle=rg;x.beginPath();x.roundRect(-w/2,-h/2,w,h,22);x.fill();x.lineWidth=6;x.strokeStyle='#fff8d6';x.stroke();
  x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='alphabetic';x.fillStyle='#3d2305';x.fillText(text,0,(tm.actualBoundingBoxAscent-tm.actualBoundingBoxDescent)/2);x.restore();};
 ribbon(150,720,120,'新血統 実装予告',78);

 // 大見出し
 const title=(text,cy,size,from,to,stroke)=>{x.save();x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='middle';
  x.lineJoin='round';x.lineWidth=size*.22;x.strokeStyle=stroke;x.strokeText(text,W/2,cy);
  x.lineWidth=size*.09;x.strokeStyle='#fffbe6';x.strokeText(text,W/2,cy);
  const tg=x.createLinearGradient(0,cy-size/2,0,cy+size/2);tg.addColorStop(0,from);tg.addColorStop(1,to);x.fillStyle=tg;x.fillText(text,W/2,cy);x.restore();};
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=30;x.shadowOffsetY=10;title('キュービ & オリヒメ',335,140,'#fff6e0','#ffb35c','#2a1238');x.restore();
 x.save();x.font='62px MPR';x.textAlign='center';x.fillStyle='#fffde8';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.fillText('九つのしっぽの、新しい仲間が2体やってくる',W/2,500);x.restore();

 // 2体
 const mon=async(file,cx,bottom,boxW,boxH,glow)=>{const im=await loadImage(file);const s=Math.min(boxW/im.width,boxH/im.height);const w=im.width*s,h=im.height*s;
  const gg=x.createRadialGradient(cx,bottom-h*.45,20,cx,bottom-h*.45,Math.max(w,h)*.62);gg.addColorStop(0,glow);gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.beginPath();x.arc(cx,bottom-h*.45,Math.max(w,h)*.62,0,7);x.fill();
  x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(cx,bottom-6,w*.42,34,0,0,7);x.fill();
  x.drawImage(im,cx-w/2,bottom-h,w,h);};
 await mon(path.join(ROOT,'monster-hero/images/monsters/kyubi.png'),W*.29,1390,700,840,'rgba(255,190,120,.7)');
 await mon(path.join(ROOT,'monster-hero/images/monsters/orihime.png'),W*.715,1390,700,840,'rgba(190,220,255,.7)');

 // 名札
 const plate=(cx,cy,name,chip,chipCol,sub)=>{x.save();const w=680,h=156;
  x.fillStyle='rgba(28,16,52,.86)';x.beginPath();x.roundRect(cx-w/2,cy-h/2,w,h,36);x.fill();x.lineWidth=6;x.strokeStyle='#e7c45a';x.stroke();
  x.font='64px MPR';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fffbe0';x.fillText(name,cx+82,cy-20);
  x.fillStyle=chipCol;x.beginPath();x.roundRect(cx-w/2+26,cy-52,136,64,32);x.fill();x.font='42px MPR';x.fillStyle='#fff';x.fillText(chip,cx-w/2+94,cy-19);
  x.font='38px MPR';x.fillStyle='#ffe6d2';x.fillText(sub,cx,cy+46);x.restore();};
 plate(W*.29,1478,'キュービ','純血','#c8702a','キュービ × キュービ');
 plate(W*.715,1478,'オリヒメ','レア','#d9a020','キュービ × ？？？');

 // 下の帯
 const bg=x.createLinearGradient(0,1560,0,H);bg.addColorStop(0,'rgba(40,24,70,.0)');bg.addColorStop(.25,'rgba(34,20,60,.9)');bg.addColorStop(1,'rgba(20,12,36,.95)');x.fillStyle=bg;x.fillRect(0,1560,W,H-1560);
 x.save();x.font='80px MPR';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=16;x.strokeStyle='#2c1450';x.strokeText('近日実装',W/2,1652);
 const bt=x.createLinearGradient(0,1614,0,1694);bt.addColorStop(0,'#fff6c2');bt.addColorStop(1,'#f0b93a');x.fillStyle=bt;x.fillText('近日実装',W/2,1652);x.restore();
 x.save();x.font='34px MPR';x.textAlign='center';x.fillStyle='#ffe6d2';x.fillText('C O M I N G   S O O N',W/2,1740);x.restore();
 // 外枠
 x.lineWidth=14;x.strokeStyle='#e7c45a';x.strokeRect(7,7,W-14,H-14);
 const info=await sharp(c.toBuffer('image/png')).resize(880,880).jpeg({quality:80,mozjpeg:true}).toFile(OUT);
 console.log(`書き出しました: ${path.relative(ROOT,OUT)} (${Math.round(info.size/1024)}KB)`);
})();
