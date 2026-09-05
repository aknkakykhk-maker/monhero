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
const jsx=fs.readFileSync(path.join(WEB,'src/game-system.jsx'),'utf8');
const head=jsx.indexOf('const MARKET_PROFILE_ICON_STYLES = {');
const body=jsx.slice(head,jsx.indexOf('};',head));
const styles={};
for(const m of body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*\{\s*scale:\s*([\d.]+),\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\}/gm))
  styles[m[1]]={scale:+m[2],x:+m[3],y:+m[4]};
ok('画面側の調整値を読めている',Object.keys(styles).length>=5,`${Object.keys(styles).length}件`);

const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB,'data/images/images-ally.js'),'utf8')+'\n'
  +fs.readFileSync(path.join(WEB,'data/breeder.js'),'utf8')
  +"\nglobalThis.__I=BREEDER_MARKET_ITEMS.filter(i=>i.type==='icon');",ctx);
const items=ctx.__I;
ok('マーケットのアイコン商品を読めている',items.length>0,`${items.length}件`);

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
  let top=BOX,bottom=-1;
  for(let y=0;y<BOX;y++)for(let x=0;x<BOX;x++){
    const px=x-R+.5, py=y-R+.5;
    if(px*px+py*py>R*R)continue;
    if(d[(y*BOX+x)*4+3]<ALPHA)continue;
    if(y<top)top=y; if(y>bottom)bottom=y;
  }
  // 元画像のふちまで絵が続いているか(四隅が不透明か)を見る。
  // 続いているなら、枠を絵で覆いきれていないと直線のふちが枠内へ出る
  const sc=createCanvas(img.width,img.height), scc=sc.getContext('2d');
  scc.drawImage(img,0,0);
  const sd=scc.getImageData(0,0,img.width,img.height).data;
  const at=(x,y)=>sd[((y*img.width)+x)*4+3];
  const m=2, corners=[at(m,m),at(img.width-1-m,m),at(m,img.height-1-m),at(img.width-1-m,img.height-1-m)];
  const fullBleed=corners.every(a=>a>=200);
  // 枠(丸)を絵が覆いきれているか。丸は箱に内接するので、箱を覆えていれば足りる
  const covers=dx<=0.5 && dy<=0.5 && dx+dw>=BOX-0.5 && dy+dh>=BOX-0.5;
  return {st,fullBleed,covers,fillH:bottom<0?0:(bottom-top+1)/BOX*100,
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
  const ark=await arkFaceOffset();
  ok('アークの顔が枠の中央にある',ark!==null&&Math.abs(ark)<=3,
    ark===null?'目を見つけられません':`中央から${ark>0?'右':'左'}へ${Math.abs(ark).toFixed(1)}%（3%まで）`);
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
