#!/usr/bin/env node
// マーケット・プロフィールの丸いアイコンが、枠の中へきちんと収まっているかを測る。
//
//   node tools/image/market-icon-framing-check.js
//
// 【なぜ道具にするか】
// 丸枠の中での見え方は MARKET_PROFILE_ICON_STYLES の scale/x/y だけで決まる。
// 画像を差し替えたり値を触ったりしても例外は出ず、画面も壊れないので、
// 「片側へ寄っている」「寄りすぎて切れている」「引きすぎて元画像のふちが見えている」
// といったズレは、公開してから目で気づくしかなかった。
// 実際に2026-09-05、実機で次の3件を指摘された。
//   ・アークが右に寄っている（目の中心が枠の中央から9.0%右）
//   ・イブリースが近すぎる（角も上下も枠で切れている）
//   ・パンドラが少し遠い（顔が小さい）
//
// ここでは元画像を実際に丸枠へ描き、次を数値で見る。
//   ① 枠の中に背景の隙間ができていないか
//      （縮めすぎると元画像の直線のふちが枠内へ出て、切り貼りしたように見える）
//   ② 左右どちらかへ極端に寄っていないか
//   ③ 中身が枠に対して小さすぎ・大きすぎないか
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),WEB=path.join(ROOT,'monster-hero');
const BOX=256, ALPHA=24;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

let canvas;
try{canvas=require('canvas');}
catch{console.log('SKIP: canvas が入っていないので測れません');process.exit(0);}
const {createCanvas,loadImage}=canvas;

// 画面側の値をそのまま読む（検査用に書き写さない。写すとズレる）
const readStyles=()=>{
  const jsx=fs.readFileSync(path.join(WEB,'src/game-system.jsx'),'utf8');
  // 調整値には KIKI_FACE_ICON_ADJUSTMENT のような名前付き定数も混ざる。
  // 正規表現で数字だけを拾うと、そこを既定値(1/0/0)と読み違える。
  // 必要な const をそのまま取り出して評価する
  const pick=(name)=>{
    const i=jsx.indexOf(`const ${name} =`);
    if(i<0)return '';
    const j=jsx.indexOf('\n};',i)>=0&&jsx.indexOf('\n};',i)<jsx.indexOf(';',jsx.indexOf('{',i))+1
      ? jsx.indexOf('\n};',i)+3 : 0;
    return '';
  };
  const head=jsx.indexOf('const MARKET_PROFILE_ICON_STYLES = {');
  const tail=jsx.indexOf('\n};',head)+3;
  const adj=jsx.match(/const KIKI_FACE_ICON_ADJUSTMENT = [^;]+;/);
  const src=(adj?adj[0]:'')+'\n'+jsx.slice(head,tail)+'\nglobalThis.__S=MARKET_PROFILE_ICON_STYLES;';
  const c={};vm.createContext(c);vm.runInContext(src,c);
  return c.__S;
};
const styles=readStyles();
ok('画面側の調整値を読めている',Object.keys(styles).length>=5,`${Object.keys(styles).length}件`);

const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB,'data/images/images-ally.js'),'utf8')+'\n'
  +fs.readFileSync(path.join(WEB,'data/breeder.js'),'utf8')
  // アイコン商品(type:'icon')だけでなく、円盤石そのもの(type:'disc')も見る。
  // 以前は 'icon' だけを見ていたため、円盤石の商品が1件も検査されておらず、
  // ミーア・パンドラの円盤石に顔用の拡大値が付いたままなのを拾えなかった
  +"\nglobalThis.__I=BREEDER_MARKET_ITEMS.filter(i=>i.type==='icon'||i.type==='disc');",ctx);
const items=ctx.__I;
ok('マーケットのアイコン・円盤石商品を読めている',items.length>0,`${items.length}件`);

// object-contain で枠へ収め、transform: translate(x%,y%) scale(s) を掛ける。
// game-system.jsx の iconAdjustmentTransformStyle と同じ順序で計算する
const frame=async(item)=>{
  const rel=String(item.icon).split('?')[0];
  const file=path.join(WEB,rel);
  if(!fs.existsSync(file))return null;
  const img=await loadImage(file);
  const st=styles[item.id]||{scale:1,x:0,y:0};
  const k=Math.min(BOX/img.width,BOX/img.height);
  const dw=img.width*k*st.scale, dh=img.height*k*st.scale;
  const dx=(BOX-dw)/2+st.x/100*BOX, dy=(BOX-dh)/2+st.y/100*BOX;
  const c=createCanvas(BOX,BOX), cc=c.getContext('2d');
  cc.clearRect(0,0,BOX,BOX);
  cc.drawImage(img,dx,dy,dw,dh);
  const d=cc.getImageData(0,0,BOX,BOX).data, R=BOX/2;
  const sc=createCanvas(img.width,img.height), scc=sc.getContext('2d');
  scc.drawImage(img,0,0);
  const sd=scc.getImageData(0,0,img.width,img.height).data;
  let top=BOX,bottom=-1;
  for(let y=0;y<BOX;y++)for(let x=0;x<BOX;x++){
    const px=x-R+.5, py=y-R+.5;
    if(px*px+py*py>R*R)continue;
    if(d[(y*BOX+x)*4+3]<ALPHA)continue;
    if(y<top)top=y; if(y>bottom)bottom=y;
  }
  // 元画像のふちまで絵が続いているか(四隅が不透明か)を見る。
  // 続いているなら、枠を絵で覆いきれていないと直線のふちが枠内へ出る
  const at=(x,y)=>sd[((y*img.width)+x)*4+3];
  const m=2, corners=[at(m,m),at(img.width-1-m,m),at(m,img.height-1-m),at(img.width-1-m,img.height-1-m)];
  const fullBleed=corners.every(a=>a>=200);
  // 枠(丸)を絵が覆いきれているか。丸は箱に内接するので、箱を覆えていれば足りる
  const covers=dx<=0.5 && dy<=0.5 && dx+dw>=BOX-0.5 && dy+dh>=BOX-0.5;
  // 中身が「枠へ収まる前に」どれだけの大きさで描かれているか。
  // 切り取られたあとの画素を数えると、はみ出すほど大きくても100%に見えてしまい、
  // 円盤が枠から飛び出している状態を拾えない
  let sl=img.width,sr=-1,st2=img.height,sb=-1;
  for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
    if(sd[((y*img.width)+x)*4+3]<ALPHA)continue;
    if(x<sl)sl=x; if(x>sr)sr=x; if(y<st2)st2=y; if(y>sb)sb=y;
  }
  const drawnSize=sr<0?0:Math.max((sr-sl+1)*k*st.scale,(sb-st2+1)*k*st.scale)/BOX*100;
  return {st,fullBleed,covers,drawnSize,fillH:bottom<0?0:(bottom-top+1)/BOX*100,
    gap:{left:Math.max(0,dx),top:Math.max(0,dy),right:Math.max(0,BOX-(dx+dw)),bottom:Math.max(0,BOX-(dy+dh))}};
};

// アークは「顔そのものが元絵の右へ寄っている」ことが原因だった。
// 左右の目(淡い黄色のX)の重心＝顔の中心なので、それが枠の中央へ来ているかを直接見る。
// 2026-09-05の指摘「アークが右に寄ってる」を、そのまま数値で押さえておくためのもの
const arkFaceOffset=async()=>{
  const item=items.find(i=>i.id==='ark_icon');
  if(!item)return null;
  const img=await loadImage(path.join(WEB,String(item.icon).split('?')[0]));
  const st=styles.ark_icon||{scale:1,x:0,y:0};
  const k=Math.min(BOX/img.width,BOX/img.height);
  const dw=img.width*k*st.scale, dh=img.height*k*st.scale;
  const c=createCanvas(BOX,BOX), cc=c.getContext('2d');
  cc.clearRect(0,0,BOX,BOX);
  cc.drawImage(img,(BOX-dw)/2+st.x/100*BOX,(BOX-dh)/2+st.y/100*BOX,dw,dh);
  const d=cc.getImageData(0,0,BOX,BOX).data;
  let sx=0,n=0;
  for(let y=0;y<BOX;y++)for(let x=0;x<BOX;x++){
    const i=(y*BOX+x)*4;
    if(d[i+3]<64)continue;
    if(!(d[i]>225&&d[i+1]>210&&d[i+2]>130&&d[i+2]<200))continue;
    sx+=x;n++;
  }
  return n?((sx/n)-BOX/2)/BOX*100:null;
};

(async()=>{
  const uncovered=[], tiny=[], missing=[];
  for(const item of items){
    const f=await frame(item);
    if(!f){missing.push(item.id);continue;}
    // ① 絵がふちまで続いているのに枠を覆いきれていない＝直線のふちが枠内へ出る
    if(f.fullBleed&&!f.covers){
      const g=f.gap, side=[g.left&&`左${g.left.toFixed(0)}px`,g.right&&`右${g.right.toFixed(0)}px`,
        g.top&&`上${g.top.toFixed(0)}px`,g.bottom&&`下${g.bottom.toFixed(0)}px`].filter(Boolean).join('・');
      uncovered.push(`${item.name}(${side})`);
    }
    // ② 中身が枠に対して小さすぎる
    if(f.fillH<60)tiny.push(`${item.name}(占有${f.fillH.toFixed(0)}%)`);
  }
  ok('画像がすべて見つかる',missing.length===0,missing.join(' / '));
  ok('ふちまで絵が続く画像は枠を覆えている',uncovered.length===0,uncovered.join(' / '));
  ok('中身が枠に対して小さすぎない',tiny.length===0,tiny.join(' / '));
  // ④ 円盤石は「円盤そのものを、どれも同じ大きさで真ん中に」出す。
  //    同じ画像を使う「◯◯の円盤石」と「◯◯の円盤石アイコン」が別の値になっていたり、
  //    顔用の拡大値が円盤石へ付いたままだったりすると、同じ画面に大小の円盤が並ぶ
  //    (2026-09-05・ユーザー指摘「円盤石の表示方法に統一感が。全部見直して統一して」)
  const discs=[];
  for(const item of items.filter(i=>/円盤石/.test(i.name))){
    const f=await frame(item);
    if(!f)continue;
    discs.push({name:item.name,size:f.drawnSize,st:f.st});
  }
  const fills=discs.map(d=>d.size);
  const spread=fills.length?Math.max(...fills)-Math.min(...fills):0;
  ok('円盤石はどれも同じ大きさで出る',discs.length>0&&spread<=6,
    discs.length?`占有 ${Math.min(...fills).toFixed(0)}〜${Math.max(...fills).toFixed(0)}%（差${spread.toFixed(0)}ポイント・6まで）`:'円盤石が見つかりません');
  // 同じ画像を使う商品どうしは、必ず同じ値であること
  const byImage={};
  for(const item of items.filter(i=>/円盤石/.test(i.name))){
    const key=String(item.icon).split('?')[0];
    const st=styles[item.id]||{scale:1,x:0,y:0};
    (byImage[key]=byImage[key]||[]).push(`${item.name}(s${st.scale} x${st.x} y${st.y})`);
  }
  const mismatched=Object.values(byImage).filter(v=>new Set(v.map(t=>t.replace(/^[^(]+/,''))).size>1);
  ok('同じ画像の円盤石どうしは同じ値',mismatched.length===0,mismatched.map(v=>v.join(' ≠ ')).join(' / '));
  const ark=await arkFaceOffset();
  ok('アークの顔が枠の中央にある',ark!==null&&Math.abs(ark)<=3,
    ark===null?'目を見つけられません':`中央から${ark>0?'右':'左'}へ${Math.abs(ark).toFixed(1)}%（3%まで）`);
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
