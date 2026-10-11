#!/usr/bin/env node
// 参考譜面に寄せる道具 段4: 下書き(ref-work/<曲id>/*.json)を、ゲームの譜面の書き方(t/h/f/s と空中の T/F/S)へ写す(2026-10-11・Grievous Lady)。
//
//   node tools/mode/rhythm-ref-to-runtime.js --in tools/mode/ref-work/<曲id>/master.json --marker <マーカー名> [--ground] [--write]
//     --ground … 空中のタップ・フリックを地上へ、スライドの高さを0にする(地上の5難易度用)
//     --write  … monster-hero/data/rhythm-mode.js の // <マーカー名> 〜 // </マーカー名> の中身を書き換える(書かなければ件数だけ出す)
//   入れ物の形: const xxxNotes=((t,h,f,s,T,F,S)=>[ // <マーカー> … // </マーカー> ])(mhTap,mhHoldV2,mhFlick,mhSlideV2,mhSkyTap,mhSkyFlick,mhSkySlide);
//
// 下書きの形は rhythm-ref-map.js の冒頭のとおり:
//   タップ/フリック {k:'t'|'f', t, sub, w, sky:0|1, dir:''|'left'|'right'}  ホールド {k:'h', t, end, sub, w}
//   スライド {k:'s', hand:'L'|'R', pts:[[ms, レーン(左端・0〜5・0.5刻み), 幅, 高さ0〜1, ease]], endFlick}
// 【決めごと】読むのは ref-work/ の下だけ(写しはリポジトリに置かない)。ゲームへ入れるのは、手で詰めて押せる形にした譜面だけ。
'use strict';
const fs=require('fs'),path=require('path');
const {assertWorkPath,REPO_ROOT}=require('./rhythm-ref-capture.js');
const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
const IN=get('in'),MARKER=get('marker'),GROUND=args.includes('--ground'),WRITE=args.includes('--write');
if(!IN||!MARKER){console.log('使い方: --in <ref-work の下書き> --marker <マーカー名> [--ground] [--write]');process.exit(1);}
const file=path.resolve(IN);assertWorkPath(file);
const draft=JSON.parse(fs.readFileSync(file,'utf8')),notes=Array.isArray(draft)?draft:draft.notes;
const DIR={'':0,left:1,right:2};
const r=v=>Math.round(Number(v));
const num=v=>Number(Number(v).toFixed(3));
const items=[];
for(const n of notes){
  if(n.k==='t'||n.k==='f'){
    const sky=!GROUND&&Number(n.sky)>0,at=r(n.t);
    if(n.k==='t')items.push([at,sky?`T(${at},${r(n.sub)},${r(n.w)})`:`t(${at},${r(n.sub)},${r(n.w)})`]);
    else items.push([at,sky?`F(${at},${r(n.sub)},${r(n.w)},${DIR[n.dir]||0})`:`f(${at},${r(n.sub)},${r(n.w)},${DIR[n.dir]||0})`]);
  }else if(n.k==='h'){
    const at=r(n.t);items.push([at,`h(${at},${r(n.sub)},${r(n.w)},${r(n.end)})`]);
  }else if(n.k==='s'&&Array.isArray(n.pts)&&n.pts.length>=2){
    const pts=n.pts,at=r(pts[0][0]),end=r(pts[pts.length-1][0]);
    const sky=!GROUND&&pts.some(p=>Number(p[3])>0);
    if(sky)items.push([at,`S(${at},${end},[${pts.map(p=>`[${r(p[0])},${num(p[1])},${num(p[2])},${num(p[3])},${r(p[4]||0)}]`).join(',')}],${n.endFlick?1:0},'${n.hand==='L'?'L':'R'}')`]);
    else items.push([at,`s(${at},${end},[${pts.map(p=>`[${r(p[0])},${num(p[1])},${num(p[2])},${r(p[4]||0)}]`).join(',')}],${n.endFlick?1:0})`]);
  }
}
items.sort((a,b)=>a[0]-b[0]);
const lines=[];for(let i=0;i<items.length;i+=4)lines.push('  '+items.slice(i,i+4).map(x=>x[1]).join(',')+',');
const counts=items.reduce((m,[,s])=>{const k=s[0];m[k]=(m[k]||0)+1;return m;},{});
console.log(`写したノーツ ${items.length}個 ${JSON.stringify(counts)}(${GROUND?'地上だけ':'空中あり'})`);
if(WRITE){
  const p=path.join(REPO_ROOT,'monster-hero/data/rhythm-mode.js');let s=fs.readFileSync(p,'utf8');
  const open=`// <${MARKER}>`,close=`// </${MARKER}>`,a=s.indexOf(open),b=s.indexOf(close);
  if(a<0||b<a){console.log(`マーカーが見つかりません: ${MARKER}`);process.exit(1);}
  s=s.slice(0,a+open.length)+'\n'+lines.join('\n')+'\n'+s.slice(b);
  fs.writeFileSync(p,s);console.log(`書き込みました: ${MARKER}`);
}
