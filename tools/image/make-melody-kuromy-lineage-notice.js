// 新モンスター「メロディー」「クロミー」実装予告の告知画像を、立ち絵2枚から作る(2026-10-07)。
//
//   node image/make-melody-kuromy-lineage-notice.js <太字フォントのパス>
//   例) node image/make-melody-kuromy-lineage-notice.js /tmp/mplus-rounded-800.ttf
//
// 書き出すのは monster-hero/images/events/melody-kuromy-notice.jpg(880x880・JPEG quality 80・mozjpeg)。
// 更新履歴の image に使う(お知らせの詳細と、助手の一度きりの告知の両方に出る)。
// ゴーストの予告(make-ghost-lineage-notice.js)を写して、背景を「森から夕焼けへ」(左は森・右は夕焼け)にした。
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
if(!FONT||!fs.existsSync(FONT)){console.log('使い方: node image/make-melody-kuromy-lineage-notice.js <太字フォントのパス>');process.exit(1);}
registerFont(FONT,{family:'MPR'});
const OUT=path.join(ROOT,'monster-hero','images','events','melody-kuromy-notice.jpg');
const W=1760,H=1760;
const c=createCanvas(W,H),x=c.getContext('2d');
let seed=20261007;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
(async()=>{
 // 背景: 上は夜が明けきらない深い緑、下へ向かって夕焼け
 let g=x.createLinearGradient(0,0,0,H);
 g.addColorStop(0,'#0c2414');g.addColorStop(.4,'#24502c');g.addColorStop(.72,'#9a4a5e');g.addColorStop(.9,'#e8883a');g.addColorStop(1,'#3a1a30');
 x.fillStyle=g;x.fillRect(0,0,W,H);
 // 左は森の木もれ日、右は夕日のにじみ
 let r=x.createRadialGradient(W*.22,520,30,W*.22,520,820);
 r.addColorStop(0,'rgba(210,255,170,.55)');r.addColorStop(.4,'rgba(120,200,110,.2)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 r=x.createRadialGradient(W*.8,1050,40,W*.8,1050,900);
 r.addColorStop(0,'rgba(255,200,110,.7)');r.addColorStop(.35,'rgba(255,120,120,.28)');r.addColorStop(1,'rgba(0,0,0,0)');
 x.fillStyle=r;x.fillRect(0,0,W,H);
 // 夕日
 x.fillStyle='rgba(255,226,150,.9)';x.beginPath();x.arc(W*.8,640,200,0,7);x.fill();
 x.fillStyle='rgba(255,170,90,.35)';x.beginPath();x.arc(W*.8,640,270,0,7);x.fill();
 // 木のシルエット(左)
 const tree=(cx,base,h,w,col)=>{x.fillStyle=col;x.beginPath();x.moveTo(cx-w*.07,base);x.lineTo(cx-w*.05,base-h*.35);x.lineTo(cx-w*.5,base-h*.42);x.quadraticCurveTo(cx-w*.62,base-h*.78,cx,base-h);x.quadraticCurveTo(cx+w*.62,base-h*.78,cx+w*.5,base-h*.42);x.lineTo(cx+w*.05,base-h*.35);x.lineTo(cx+w*.07,base);x.closePath();x.fill();};
 for(const [tx,th,tw] of [[70,900,330],[260,700,260],[460,820,300],[150,540,220]])tree(tx,1500,th,tw,'rgba(8,30,14,.62)');
 // 雲(右・夕焼け色)
 const cloud=(cx,cy,s,col)=>{x.fillStyle=col;for(const [ox,oy,rr] of [[-70,0,50],[0,-24,66],[76,0,52],[10,18,60]]){x.beginPath();x.arc(cx+ox*s,cy+oy*s,rr*s,0,7);x.fill();}};
 cloud(W*.62,300,1.5,'rgba(255,170,140,.5)');cloud(W*.9,430,1.1,'rgba(255,150,120,.45)');cloud(W*.74,860,1.3,'rgba(255,190,130,.35)');
 // 星(右上)と蛍(左)
 x.save();x.globalCompositeOperation='lighter';
 for(let i=0;i<70;i++){const px=W*.5+rnd()*W*.5,py=rnd()*H*.45,pr=1.5+rnd()*3.5;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,'rgba(255,250,220,.9)');pg.addColorStop(1,'rgba(255,250,220,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 for(let i=0;i<46;i++){const px=rnd()*W*.55,py=500+rnd()*1000,pr=6+rnd()*14;const pg=x.createRadialGradient(px,py,0,px,py,pr*3);pg.addColorStop(0,'rgba(220,255,150,.6)');pg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=pg;x.beginPath();x.arc(px,py,pr*3,0,7);x.fill();}
 x.restore();
 // 舞う葉(左)と花びら(右)
 const leaf=(cx,cy,s,a,col)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);x.fillStyle=col;x.beginPath();x.moveTo(0,-26);x.quadraticCurveTo(22,-6,0,26);x.quadraticCurveTo(-22,-6,0,-26);x.fill();x.restore();};
 for(let i=0;i<16;i++)leaf(rnd()*W*.5,200+rnd()*1200,.7+rnd()*1.2,rnd()*6,i%2?'rgba(170,230,120,.8)':'rgba(255,214,110,.75)');
 for(let i=0;i<16;i++)leaf(W*.5+rnd()*W*.5,200+rnd()*1200,.7+rnd()*1.2,rnd()*6,i%2?'rgba(255,150,170,.8)':'rgba(255,200,120,.75)');

 // 上のリボン「新血統 実装予告」
 const ribbon=(cy,w,h,text,size)=>{x.save();x.translate(W/2,cy);
  x.fillStyle='#7a4a12';x.beginPath();x.moveTo(-w/2-70,-h/2+18);x.lineTo(-w/2+10,-h/2+18);x.lineTo(-w/2+10,h/2+18);x.lineTo(-w/2-70,h/2+18);x.lineTo(-w/2-40,18);x.closePath();x.fill();
  x.beginPath();x.moveTo(w/2+70,-h/2+18);x.lineTo(w/2-10,-h/2+18);x.lineTo(w/2-10,h/2+18);x.lineTo(w/2+70,h/2+18);x.lineTo(w/2+40,18);x.closePath();x.fill();
  const rg=x.createLinearGradient(0,-h/2,0,h/2);rg.addColorStop(0,'#fff3b0');rg.addColorStop(.5,'#e7b43a');rg.addColorStop(1,'#b87918');
  x.fillStyle=rg;x.beginPath();x.roundRect(-w/2,-h/2,w,h,22);x.fill();x.lineWidth=6;x.strokeStyle='#fff8d6';x.stroke();
  x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='middle';x.fillStyle='#3d2305';x.fillText(text,0,4);x.restore();};
 ribbon(150,720,120,'新モンスター 実装予告',78);

 // 大見出し「ユグドラシル」
 const title=(text,cy,size,from,to,stroke)=>{x.save();x.font=`${size}px MPR`;x.textAlign='center';x.textBaseline='middle';
  x.lineJoin='round';x.lineWidth=size*.22;x.strokeStyle=stroke;x.strokeText(text,W/2,cy);
  x.lineWidth=size*.09;x.strokeStyle='#fffbe6';x.strokeText(text,W/2,cy);
  const tg=x.createLinearGradient(0,cy-size/2,0,cy+size/2);tg.addColorStop(0,from);tg.addColorStop(1,to);x.fillStyle=tg;x.fillText(text,W/2,cy);x.restore();};
 x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=30;x.shadowOffsetY=10;title('メロディー & クロミー',335,140,'#fff3c4','#f08a24','#3a1428');x.restore();
 x.save();x.font='62px MPR';x.textAlign='center';x.fillStyle='#fffde8';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=14;x.fillText('森と夕焼けから、新しい仲間が2体やってくる',W/2,500);x.restore();

 // 2体
 const mon=async(file,cx,bottom,boxW,boxH,glow)=>{const im=await loadImage(file);const s=Math.min(boxW/im.width,boxH/im.height);const w=im.width*s,h=im.height*s;
  const gg=x.createRadialGradient(cx,bottom-h*.45,20,cx,bottom-h*.45,Math.max(w,h)*.62);gg.addColorStop(0,glow);gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.beginPath();x.arc(cx,bottom-h*.45,Math.max(w,h)*.62,0,7);x.fill();
  x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(cx,bottom-6,w*.42,34,0,0,7);x.fill();
  x.drawImage(im,cx-w/2,bottom-h,w,h);};
 await mon(path.join(ROOT,'monster-hero/images/monsters/melody.png'),W*.29,1390,680,800,'rgba(255,240,170,.7)');
 await mon(path.join(ROOT,'monster-hero/images/monsters/kuromy.png'),W*.715,1390,680,820,'rgba(255,170,200,.65)');

 // 名札
 const plate=(cx,cy,name,chip,chipCol,sub)=>{x.save();const w=680,h=156;
  x.fillStyle='rgba(34,16,30,.86)';x.beginPath();x.roundRect(cx-w/2,cy-h/2,w,h,36);x.fill();x.lineWidth=6;x.strokeStyle='#e7c45a';x.stroke();
  x.font='64px MPR';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fffbe0';x.fillText(name,cx+82,cy-20);
  x.fillStyle=chipCol;x.beginPath();x.roundRect(cx-w/2+26,cy-52,136,64,32);x.fill();x.font='42px MPR';x.fillStyle='#fff';x.fillText(chip,cx-w/2+94,cy-19);
  x.font='38px MPR';x.fillStyle='#ffe6d2';x.fillText(sub,cx,cy+46);x.restore();};
 plate(W*.29,1478,'メロディー','レア','#c7862a','ユグドラシル × ？？？');
 plate(W*.715,1478,'クロミー','レア','#c7862a','ユグドラシル × ？？？');

 // 下の帯
 const bg=x.createLinearGradient(0,1560,0,H);bg.addColorStop(0,'rgba(70,24,50,.0)');bg.addColorStop(.25,'rgba(50,20,40,.9)');bg.addColorStop(1,'rgba(28,12,26,.95)');x.fillStyle=bg;x.fillRect(0,1560,W,H-1560);
 x.save();x.font='80px MPR';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=16;x.strokeStyle='#4a1a30';x.strokeText('マーケットに近日追加',W/2,1652);
 const bt=x.createLinearGradient(0,1614,0,1694);bt.addColorStop(0,'#fff6c2');bt.addColorStop(1,'#f0b93a');x.fillStyle=bt;x.fillText('マーケットに近日追加',W/2,1652);x.restore();
 x.save();x.font='34px MPR';x.textAlign='center';x.fillStyle='#ffe6d2';x.fillText('C O M I N G   S O O N',W/2,1740);x.restore();
 // 外枠
 x.lineWidth=14;x.strokeStyle='#e7c45a';x.strokeRect(7,7,W-14,H-14);
 const info=await sharp(c.toBuffer('image/png')).resize(880,880).jpeg({quality:80,mozjpeg:true}).toFile(OUT);
 console.log(`書き出しました: ${path.relative(ROOT,OUT)} (${Math.round(info.size/1024)}KB)`);
})();
