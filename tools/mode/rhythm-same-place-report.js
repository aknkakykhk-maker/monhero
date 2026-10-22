#!/usr/bin/env node
// 指が同じ位置に来る形(rhythm-chart-hand-rules.js の samePlace)を、公開中の全 HELL と MASTER で曲ごとに数えた一覧を作る(2026-10-22)。
// 社長「いまちょこちょこヘルやってるけど指が同じ位置くるやつが多い。いまやったのだとききいっせんの原曲とか」
//     「空中スライドにほぼ同じ位置に空中タップとか。色々ありすぎで具体的に言うのは難しい。多分他の曲でもあるとおもうよ」
//
//   node tools/mode/rhythm-same-place-report.js                   # 一覧を出すだけ
//   node tools/mode/rhythm-same-place-report.js --out <フォルダ>   # README.md と hell.png・master.png(スマホ幅)も書く
//   node tools/mode/rhythm-same-place-report.js --song kiki_issen_hell_debug [--diff HELL]   # 1譜面の場所の一覧
//
// 譜面は変えない(数えるだけ)。型の決め方は rhythm-chart-hand-rules.js の samePlace の上の説明。
// 帯の中 … 押さえている帯の中(onHeldBand の blocked)。前からある曲の EXPERT・MASTER は rhythm-held-band-existing.json の件数まで許している
'use strict';
const fs=require('fs'),path=require('path');
const HR=require('./rhythm-chart-hand-rules.js');
const {loadRuntimeSongs}=require('./rhythm-chart-level.js');
const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};
const OUT=argOf('--out')?path.resolve(argOf('--out')):null;
const KINDS=Object.keys(HR.SAME_PLACE_KINDS);
const EXISTING=(()=>{try{return require('./rhythm-held-band-existing.json').charts||{};}catch{return {};}})();

const {RHYTHM_SONGS,RHYTHM_PROTO_SONGS,RHYTHM_DEMO_SONG_IDS}=loadRuntimeSongs();
const all=[...RHYTHM_SONGS,...RHYTHM_PROTO_SONGS];

if(argOf('--song')){
  const s=all.find(x=>x.songId===argOf('--song'));if(!s){console.error('曲が見つからない');process.exit(1);}
  for(const [d,c] of Object.entries(s.difficulties||{})){if(argOf('--diff')&&d!==argOf('--diff'))continue;if(!c||!Array.isArray(c.notes)||!c.notes.length)continue;
    const r=HR.samePlace(c.notes);console.log(`== ${s.songId}/${d} ${c.notes.length}ノーツ`);
    for(const k of KINDS){const l=r.filter(x=>x.kind===k);console.log(`  ${HR.SAME_PLACE_KINDS[k]}: ${l.length}件`+(l.length?' — '+l.map(x=>`${(x.at/1000).toFixed(2)} ${x.type}[${x.lanes}]←${x.held}`).join(' / '):''));}}
  process.exit(0);}

const nameOf=id=>{const s=RHYTHM_SONGS.find(x=>x.songId===id);return s?`${s.displayName}${s.subtitle?` ${s.subtitle}`:''}`:id;};
const count=notes=>{const r=HR.samePlace(notes),o={notes:notes.length,band:HR.heldBandBlocked(notes).length};for(const k of KINDS)o[k]=r.filter(x=>x.kind===k).length;
  o.total=KINDS.reduce((a,k)=>a+o[k],0);o.per=Math.round(o.total/notes.length*1000);return o;};
// HELL: 公開中の曲の HELL(RHYTHM_PROTO_SONGS の <曲>_hell_debug・grievous_lady_hell の枠)
const hell=[];
for(const id of RHYTHM_DEMO_SONG_IDS){const p=RHYTHM_PROTO_SONGS.find(x=>x.songId===`${id}_hell_debug`||x.songId===`${id}_hell`);
  const c=p&&(p.difficulties.HELL&&p.difficulties.HELL.notes&&p.difficulties.HELL.notes.length?p.difficulties.HELL:p.difficulties.MASTER);
  if(c&&c.notes&&c.notes.length)hell.push({id,name:nameOf(id),...count(c.notes)});}
const master=[];
for(const id of RHYTHM_DEMO_SONG_IDS){const s=RHYTHM_SONGS.find(x=>x.songId===id),c=s&&s.difficulties.MASTER;
  if(c&&c.notes&&c.notes.length){const track=Object.keys(EXISTING).find(k=>k===`${id}/MASTER`);master.push({id,name:nameOf(id),cap:track?EXISTING[track]:null,...count(c.notes)});}}
// 並びは件数の多い順(社長は遊んだ曲の多さで感じるので)。千あたりは長さをそろえた比べ方として横に出す
const byPer=(a,b)=>b.total-a.total||b.per-a.per;hell.sort(byPer);master.sort(byPer);
const sum=(rows,k)=>rows.reduce((a,r)=>a+r[k],0);

const md=[];
md.push('# 指が同じ位置に来る形: 公開中の HELL・MASTER の件数(2026-10-22)','');
md.push('社長「指が同じ位置くるやつが多い。いまやったのだとききいっせんの原曲とか」「空中スライドにほぼ同じ位置に空中タップとか」。**譜面は変えていない(数えただけ)。**','');
md.push('## 型(`rhythm-chart-hand-rules.js` の `samePlace`)','');
md.push(`- **通り道** … ${HR.SAME_PLACE_KINDS.skyPath}: 空中のノーツの前後${HR.SAME_PLACE_PATH_MS}msに、空中にいるスライドがすき間${HR.SAME_PLACE_NEAR}レーン未満を通る。社長の例(ききいっせん 93.09秒: 空中スライドが右から左へ払う通り道に空中タップ)`);
md.push(`- **真上・真下** … ${HR.SAME_PLACE_KINDS.stacked}: 長押しの最中に、高さの違うノーツが帯と横に重なる(ききいっせん 89.80秒: 空中から地上へ下りたスライドの真上に空中タップ)`);
md.push(`- **すぐ横** … ${HR.SAME_PLACE_KINDS.beside}: 地上の長押しの最中に、地上のノーツがすき間${HR.SAME_PLACE_NEAR}レーン未満(半レーンの重なりを許した形も含む)`);
md.push(`- **同時隣** … ${HR.SAME_PLACE_KINDS.chord}: 同じ高さの同時押しが、すき間${HR.SAME_PLACE_NEAR}レーン未満`);
md.push('- **真ん中** … 真ん中で左右が同じ所: 続く2つの押し始め(250ms以内・同じ高さ)が1レーン以上重なり、真ん中(レーン3)の左右に分かれる。左の親指が叩いた所を、すぐに右の親指が叩く(半レーンだけの重なりは流れの階段なので数えない)');
md.push('- **帯の中** … 押さえている帯の中(置かない形)。前からある曲の EXPERT・MASTER は `rhythm-held-band-existing.json` の件数まで許している(上限)');
md.push('- 千あたり … 5つの型の合計を、ノーツ1000個あたりにした数(曲の長さをそろえて比べる)。作り直し: `node tools/mode/rhythm-same-place-report.js --out <フォルダ>`','');
md.push(`## HELL(${hell.length}曲)`,'',`合計: 通り道 ${sum(hell,'skyPath')} / 真上・真下 ${sum(hell,'stacked')} / すぐ横 ${sum(hell,'beside')} / 同時隣 ${sum(hell,'chord')} / 真ん中 ${sum(hell,'centerSwap')} / 帯の中 ${sum(hell,'band')}`,'');
md.push('| 曲 | ノーツ | 通り道 | 真上・真下 | すぐ横 | 同時隣 | 真ん中 | 帯の中 | 計 | 千あたり |','| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for(const r of hell)md.push(`| ${r.name} | ${r.notes} | ${r.skyPath} | ${r.stacked} | ${r.beside} | ${r.chord} | ${r.centerSwap} | ${r.band} | ${r.total} | ${r.per} |`);
md.push('',`## MASTER(${master.length}曲・地上だけなので「すぐ横」「同時隣」「真ん中」と帯の中)`,'',`合計: すぐ横 ${sum(master,'beside')} / 同時隣 ${sum(master,'chord')} / 真ん中 ${sum(master,'centerSwap')} / 帯の中 ${sum(master,'band')}`,'');
md.push('| 曲 | ノーツ | すぐ横 | 同時隣 | 真ん中 | 帯の中(上限) | 計 | 千あたり |','| --- | --- | --- | --- | --- | --- | --- | --- |');
for(const r of master)md.push(`| ${r.name} | ${r.notes} | ${r.beside} | ${r.chord} | ${r.centerSwap} | ${r.band}${r.cap!=null?`(${r.cap})`:''} | ${r.total} | ${r.per} |`);
md.push('');
const text=md.join('\n');
if(!OUT){console.log(text);process.exit(0);}
fs.mkdirSync(OUT,{recursive:true});

// --- PNG(幅390) ---
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
// 曲名は意味のまとまりでだけ折る(rhythm-level-v3-report.js と同じ: keep-all・副題はひとかたまり)
// 空白の無い日本語の曲名は、助詞「の」のあと(次が漢字・カタカナ)でも折ってよい(「呪われた騎士の/時計仕掛け」。列が狭いこの表だけ)
const wrapName=s=>esc(s).split(/([～〜—―「][^～〜—―」]*[～〜—―」])/).map((x,i)=>i%2?`<wbr><span class="u">${x}</span>`:x.replace(/の(?=[一-龯ァ-ヴ])/g,'の<wbr>')).join('');
const page=(title,lead,head,rows)=>`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#16121f;color:#eee;font:13px/1.35 'Noto Sans CJK JP',sans-serif;width:390px}
  h1{font-size:16px;margin:12px 10px 4px}p{margin:0 10px 8px;font-size:11.5px;color:#bbb}
  table{border-collapse:collapse;width:370px;margin:0 10px 12px}td,th{padding:5px 2px;border-bottom:1px solid #332b44}
  th{font-size:10.5px;color:#bbb;text-align:right;line-height:1.2}th:first-child{text-align:left}
  td.n{text-align:right;width:27px;font-variant-numeric:tabular-nums}td.n.z{color:#5d5670}
  td.s{word-break:keep-all;overflow-wrap:anywhere;font-size:12.5px}td.s .u{white-space:nowrap}
  td.p{text-align:right;width:34px;color:#ffcf5a;font-weight:bold}.hot td{background:#2c2140}</style>
  <h1>${title}</h1><p>${lead}</p>
  <table><tr><th>曲</th>${head.map(h=>`<th>${h}</th>`).join('')}</tr>
  ${rows.map(r=>`<tr class="${r.hot?'hot':''}"><td class="s">${wrapName(r.name)}</td>${r.cells.map((v,i)=>`<td class="${i===r.cells.length-1?'p':'n'}${v===0||v==='0'?' z':''}">${v}</td>`).join('')}</tr>`).join('')}
  </table>`;
const hellPage=page('HELL: 指が同じ位置に来る形',
  `通り道=空中スライドの通り道に空中のノーツ / 真上下=押さえている所の真上・真下 / 横=地上の帯のすぐ横 / 同時=同時押しが隣り合う / 真中=真ん中で左右が同じ所 / 計=5つの合計(多い順)/ 千=ノーツ千あたり。帯の中は全曲0。合計 通り道${sum(hell,'skyPath')}・真上下${sum(hell,'stacked')}・横${sum(hell,'beside')}・同時${sum(hell,'chord')}・真中${sum(hell,'centerSwap')}`,
  ['通り道','真上下','横','同時','真中','計','千'],hell.map((r,i)=>({name:r.name,hot:i<10,cells:[r.skyPath,r.stacked,r.beside,r.chord,r.centerSwap,r.total,r.per]})));
const masterPage=page('MASTER: 指が同じ位置に来る形',
  `地上だけなので 横=地上の帯のすぐ横 / 同時=同時押しが隣り合う / 真中=真ん中で左右が同じ所 / 帯中=帯の中(かっこは前からある曲に許している上限)/ 計=横・同時・真中の合計(多い順)/ 千=ノーツ千あたり。合計 横${sum(master,'beside')}・同時${sum(master,'chord')}・真中${sum(master,'centerSwap')}・帯中${sum(master,'band')}`,
  ['横','同時','真中','帯中','計','千'],master.map((r,i)=>({name:r.name,hot:i<10,cells:[r.beside,r.chord,r.centerSwap,`${r.band}${r.cap!=null?`(${r.cap})`:''}`,r.total,r.per]})));
(async()=>{
  fs.writeFileSync(path.join(OUT,'README.md'),`${text}\n![HELL](./hell.png)\n![MASTER](./master.png)\n`);
  let playwright;try{playwright=require('playwright');}catch{console.log('playwright が無いので PNG は作らない');return;}
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{const p=await browser.newPage({viewport:{width:390,height:400},deviceScaleFactor:2});const bad=[];let breaks=0;
    for(const [file,html] of [['hell.png',hellPage],['master.png',masterPage]]){await p.setContent(html);
      // 曲名が言葉の途中で折れていないか(rhythm-level-v3-report.js と同じ確かめ方)
      const found=await p.evaluate(()=>[...document.querySelectorAll('td.s')].flatMap(td=>{const t=[];const w=document.createTreeWalker(td,NodeFilter.SHOW_TEXT);let n;
        while((n=w.nextNode()))for(let k=0;k<n.length;k++){const rg=document.createRange();rg.setStart(n,k);rg.setEnd(n,k+1);const rc=rg.getClientRects()[0];if(rc)t.push([n.data[k],rc.top]);}
        const text=t.map(x=>x[0]).join('');const out=[];for(let k=1;k<t.length;k++)if(t[k][1]>t[k-1][1]+3)out.push({ok:/[\sの]/.test(t[k-1][0])||/[\s～〜—―「]/.test(t[k][0]),at:`${text.slice(0,k)}/${text.slice(k)}`});return out;}));
      breaks+=found.length;for(const f of found)if(!f.ok)bad.push(`${file}: ${f.at}`);
      await p.screenshot({path:path.join(OUT,file),fullPage:true});}
    console.log(`曲名の折れ ${breaks}か所・言葉の途中で折れた所 ${bad.length}${bad.length?` — ${bad.join(' / ')}`:''}`);if(bad.length)process.exitCode=1;}
  finally{await browser.close();}
  console.log(`書いた: ${path.relative(process.cwd(),OUT)}/README.md と hell.png master.png`);
})();
