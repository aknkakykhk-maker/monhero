#!/usr/bin/env node
const TOOLS_DIR=require('path').join(__dirname,'..');
// キーフレームで「ぼかし半径」を動かしていないかを見張る。
//
//   node tools/mode/rhythm-keyframe-blur-check.js
//
// 【なぜ要るか】
// monster-hero/index.html に、リポジトリ自身のルールがこう書いてある。
//
//   脈動は opacity だけ。box-shadow をキーフレームで変えると、モンスターノーツが
//   見えているあいだ毎フレームぼかしを描き直す(2026-09-07・実機「モンスターノーツを
//   取ったあとに飛ぶ」の一因)。影は濃いほうで固定し、薄くなる側は opacity で作る。
//
// ぼかし半径(blur / drop-shadow / box-shadow の第3引数)をキーフレームで動かすと、
// ブラウザはその要素を**毎フレーム描き直す**。opacity や transform のように
// 合成側だけで済まないため、画面が詰まる原因になる。
//
// ルールはあったが**守られているかを見る検査が無かった**ので、コンボ枠が
// 2026-09-12 まで違反したまま残っていた(実機のカクつき調査で見つけた)。
//
// 【何を見るか】
//   ① 演奏画面(プレイエリア・ノーツ・レーン・判定ライン)では、そもそも書かない
//   ② それ以外(HUDなど)にあるものは、軽量モード・演出量MINIMALで止まること。
//      HUD はプレイエリアの外の兄弟なので、[data-rhythm-play-area] 配下へ書いた
//      打ち消しがひとつも届かない(実際に届いていなかった)
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(TOOLS_DIR,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const sources=[['monster-hero/index.html',read('monster-hero/index.html')],
               ['monster-hero/data/rhythm-mode.js',read('monster-hero/data/rhythm-mode.js')]];

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// @keyframes を取り出す。0.9MB のファイルを相手にするので、
// ・行番号は split を使わず、必要になったときだけ数える
// ・本体の探索には上限を置く(1つのキーフレームが 4000 字を超えることはない)
// この2つを守らないと固まる(実際に踏んだ)。
const KEYFRAME_MAX=4000;
const lineAt=(text,index)=>{let n=1;for(let i=0;i<index;i++)if(text.charCodeAt(i)===10)n++;return n;};
const keyframesOf=(text)=>{
  const out=[];
  let i=0;
  while((i=text.indexOf('@keyframes',i))>=0){
    const head=/^@keyframes\s+([A-Za-z_][\w-]*)\s*\{/.exec(text.slice(i,i+160));
    if(!head){i+=10;continue;}
    const from=i+head[0].length;
    let depth=1,j=from;
    const limit=Math.min(text.length,from+KEYFRAME_MAX);
    while(j<limit&&depth>0){const c=text[j];if(c==='{')depth++;else if(c==='}')depth--;j++;}
    if(depth===0)out.push({name:head[1],body:text.slice(from,j-1),at:i});
    i=Math.max(j,i+10);
  }
  return out;
};
// ぼかし半径を取り出す。長さの 0 は単位を省けるので px は任意にすること。
// ここを必須にしていて、実在の違反を1件も拾えない検査になっていた。
const LEN='[-\\d.]+(?:px)?';
const blurRadii=(decl)=>{
  const out=[];
  for(const m of decl.matchAll(/blur\(\s*([\d.]+)px/g))out.push(`blur:${m[1]}`);
  for(const m of decl.matchAll(new RegExp(`drop-shadow\\(\\s*${LEN}\\s+${LEN}\\s+([\\d.]+)px`,'g')))out.push(`drop:${m[1]}`);
  for(const m of decl.matchAll(/box-shadow\s*:\s*([^;{}]+)/g))
    for(const one of m[1].split(',')){
      const r=one.match(new RegExp(`${LEN}\\s+${LEN}\\s+([\\d.]+)px`));
      if(r)out.push(`box:${r[1]}`);
    }
  return out;
};
const stepsOf=(body)=>{
  const out=[];
  const re=/([\d.]+%|from|to)(\s*,\s*(?:[\d.]+%|from|to))*\s*\{([^}]*)\}/g;
  let m;while((m=re.exec(body)))out.push(m[3]);
  return out;
};

const offenders=[];
for(const [file,text] of sources)
  for(const kf of keyframesOf(text)){
    const sig=stepsOf(kf.body).map(s=>blurRadii(s).join('|'));
    if(sig.length<2)continue;
    // 段ごとのぼかし半径の並びが全部同じなら「動かしていない」。
    // どこかの段でだけ影が付く(なし → 値)のも、その段で描き直しが起きるので違反
    if(new Set(sig).size>1&&sig.some(Boolean))offenders.push({file,text,name:kf.name,at:kf.at,sig});
  }

console.log(`ぼかし半径を動かしているキーフレーム: ${offenders.length}件`);
for(const o of offenders)
  console.log(`    ${o.file}:${lineAt(o.text,o.at)} @keyframes ${o.name}  ${o.sig.map(x=>x||'(なし)').join(' → ')}`);

// そのキーフレームを使っているCSSルールのセレクタを探す(素直な文字列検索)
const rulesUsing=(name)=>{
  const found=[];
  for(const [file,text] of sources)
    for(const needle of [`animation:${name}`,`animation: ${name}`]){
      let i=0;
      while((i=text.indexOf(needle,i))>=0){
        const brace=text.lastIndexOf('{',i);
        const prev=Math.max(text.lastIndexOf('}',brace),text.lastIndexOf(';',brace),text.lastIndexOf('\n',brace-1));
        found.push({file,selector:text.slice(prev+1,brace).trim().replace(/\s+/g,' ').slice(-140)});
        i+=needle.length;
      }
    }
  return found;
};
// そのセレクタが軽量モード・演出量MINIMALで止められているか
const stoppedFor=(selector)=>{
  const keys=selector.match(/\[data-rhythm-[\w-]+\]/g)||[];
  if(!keys.length)return false;
  const key=keys[keys.length-1];
  for(const [,text] of sources){
    let i=0;
    while((i=text.indexOf(key,i))>=0){
      const brace=text.indexOf('{',i),close=brace>=0?text.indexOf('}',brace):-1;
      if(brace>=0&&close>brace
        &&/data-rhythm-(lightweight="true"|effect="MINIMAL")/.test(text.slice(Math.max(0,i-260),brace))
        &&/animation\s*:\s*none/.test(text.slice(brace,close)))return true;
      i+=key.length;
    }
  }
  return false;
};

for(const o of offenders){
  const users=rulesUsing(o.name);
  if(!users.length){check(`@keyframes ${o.name} を誰かが使っている`,false,'使い手が見つからない(消してよい可能性)');continue;}
  for(const u of users){
    if(/data-rhythm-(play-area|note|lane|judgment)/.test(u.selector)){
      check(`${o.name} をプレイエリアの中で使っていない`,false,u.selector);
    }else{
      const ok=stoppedFor(u.selector);
      check(`${o.name} は軽量モード・演出量MINIMALで止まる`,ok,ok?u.selector:`${u.selector} — 止める指定が無い`);
    }
  }
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
