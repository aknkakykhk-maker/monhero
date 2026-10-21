#!/usr/bin/env node
// 公開中の全曲の EASY〜MASTER について、今の表示 Lv. と新しい測り方(v3)での参考 Lv. を並べた一覧を作る(2026-10-22)。
// 社長の決定「地上の5難易度の Lv. を新しい測り方で付け直す件 → 一覧を作り直して見る」(10/20 に保留していた件)。
//
//   node tools/mode/rhythm-level-v3-report.js                       # 一覧を出すだけ
//   node tools/mode/rhythm-level-v3-report.js --out <フォルダ>       # README.md と難易度ごとの PNG(スマホ幅)も書く
//
// 譜面も表示も変えない(参考だけ)。今の表示 Lv. は曲えらびに出ている値(譜面の level)、
// 参考 Lv. は rhythm-chart-level.js の chartLevel(…,{formula:'v3'})(入り乱れ・押さえている手の側・見分けにくさを重く)。
// 印: 差が ±3 以上は「◆」。同じ曲で上の難易度より Lv. が上になる(順の逆転)は「⇅」(今の表示で起きていれば「今⇅」、v3 で起きれば「v3⇅」)。
'use strict';
const fs=require('fs'),path=require('path');
const L=require('./rhythm-chart-level.js');
const args=process.argv.slice(2),outAt=args.indexOf('--out'),OUT=outAt>=0?path.resolve(args[outAt+1]):null;
const DIFFS=['EASY','NORMAL','HARD','EXPERT','MASTER'],BIG=3;

const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS}=L.loadRuntimeSongs();
const shown=new Set(RHYTHM_DEMO_SONG_IDS);
const songs=RHYTHM_SONGS.filter(s=>shown.has(s.songId));
const rows=songs.map(s=>{
  const name=`${s.displayName}${s.subtitle?` ${s.subtitle}`:''}`;
  const cells=DIFFS.map(d=>{const c=s.difficulties[d];if(!c||!Array.isArray(c.notes)||!c.notes.length)return null;
    return {now:Number(c.level),v3:L.chartLevel(c,{formula:'v3'}).level};});
  // 順の逆転: 下の難易度が上の難易度より Lv. が上(同じは逆転にしない)
  const inv=key=>DIFFS.map((d,i)=>{const a=cells[i];if(!a)return false;
    return cells.slice(i+1).some(b=>b&&b[key]<a[key])||cells.slice(0,i).some(b=>b&&b[key]>a[key]);});
  const invNow=inv('now'),invV3=inv('v3');
  return {songId:s.songId,name,cells:cells.map((c,i)=>c&&{...c,diff:c.v3-c.now,invNow:invNow[i],invV3:invV3[i]})};});

const mark=c=>`${Math.abs(c.diff)>=BIG?'◆':''}${c.invNow?'今⇅':''}${c.invV3?'v3⇅':''}`;
const sign=n=>n>0?`+${n}`:String(n);
const summary=DIFFS.map((d,i)=>{const cs=rows.map(r=>r.cells[i]).filter(Boolean);
  return {d,count:cs.length,up:cs.filter(c=>c.diff>0).length,down:cs.filter(c=>c.diff<0).length,same:cs.filter(c=>c.diff===0).length,
    bigUp:cs.filter(c=>c.diff>=BIG).length,bigDown:cs.filter(c=>c.diff<=-BIG).length,invNow:cs.filter(c=>c.invNow).length,invV3:cs.filter(c=>c.invV3).length};});
const all=rows.flatMap(r=>r.cells.map((c,i)=>c&&{name:r.name,d:DIFFS[i],...c})).filter(Boolean);
const top=(f,n)=>all.slice().sort(f).slice(0,n);
const upTop=top((a,b)=>b.diff-a.diff,5).filter(c=>c.diff>0),downTop=top((a,b)=>a.diff-b.diff,5).filter(c=>c.diff<0);

// --- md ---
const md=[];
md.push('# 地上の5難易度の Lv.: 今の表示と新しい測り方(v3)の参考値(2026-10-22)','');
md.push('社長の決定「地上の5難易度(EASY〜MASTER)の Lv. を、新しい測り方で付け直す件 → 一覧を作り直して見る」。**譜面も表示も変えていない(参考だけ)。**','');
md.push('- 今 … 曲えらびに出ている Lv.(譜面の level)');
md.push('- v3 … `rhythm-chart-level.js` の新しい測り方(地上と空中の入り乱れ・押さえている手の側・見分けにくさを重く)で測った参考値');
md.push(`- 印: ◆ = 差が ±${BIG} 以上 / 今⇅ = 今の表示で同じ曲の難易度の順が逆転 / v3⇅ = v3 で逆転`);
md.push('- 作り直し: `node tools/mode/rhythm-level-v3-report.js --out docs/playbot/reports/2026-10-22/level-v3`','');
md.push('## まとめ','','| 難易度 | 譜面 | 上がる | 下がる | 同じ | ◆上がる | ◆下がる | 今⇅ | v3⇅ |','| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for(const s of summary)md.push(`| ${s.d} | ${s.count} | ${s.up} | ${s.down} | ${s.same} | ${s.bigUp} | ${s.bigDown} | ${s.invNow} | ${s.invV3} |`);
md.push('','上がる幅が大きい: '+(upTop.map(c=>`${c.name} ${c.d} ${c.now}→${c.v3}`).join(' / ')||'なし'));
md.push('','下がる幅が大きい: '+(downTop.map(c=>`${c.name} ${c.d} ${c.now}→${c.v3}`).join(' / ')||'なし'),'');
md.push('## 一覧(公開中の曲・曲えらびの並び)','','| 曲 | '+DIFFS.join(' | ')+' |','| --- |'+DIFFS.map(()=>' --- |').join(''));
for(const r of rows)md.push(`| ${r.name} | `+r.cells.map(c=>c?`${c.now}→${c.v3} (${sign(c.diff)})${mark(c)?` ${mark(c)}`:''}`:'—').join(' | ')+' |');
md.push('');
const text=md.join('\n');
if(!OUT){console.log(text);process.exit(0);}
fs.mkdirSync(OUT,{recursive:true});

// --- PNG(難易度ごと・幅390) ---
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const page=(d,i)=>{const s=summary[i];
  const list=rows.map(r=>({name:r.name,c:r.cells[i]})).filter(x=>x.c);
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#16121f;color:#eee;font:14px/1.35 'Noto Sans CJK JP',sans-serif;width:390px}
  h1{font-size:17px;margin:12px 12px 4px}p{margin:0 12px 8px;font-size:12px;color:#bbb}
  table{border-collapse:collapse;width:366px;margin:0 12px 12px}td,th{padding:5px 4px;border-bottom:1px solid #332b44}
  th{font-size:12px;color:#bbb;text-align:left}td.n{text-align:right;width:26px;font-variant-numeric:tabular-nums}
  /* 曲名は英単語の途中で折らない(単語の区切りで折る・2026-10-22 窓口の指摘)。数字と印の列を詰めて曲名の列を広げる */
  td.s{word-break:normal;overflow-wrap:normal;font-size:13px}td.m{width:44px;font-size:11px;color:#ffcf5a}
  .up{color:#ff8a8a}.down{color:#7fc3ff}.big td{background:#2c2140}</style>
  <h1>${d}: 今の Lv. → v3 の参考</h1>
  <p>譜面${s.count} / 上がる${s.up}・下がる${s.down}・同じ${s.same} / ◆(±${BIG}以上) 上${s.bigUp}・下${s.bigDown} / 逆転 今${s.invNow}・v3 ${s.invV3}</p>
  <table><tr><th>曲</th><th>今</th><th>v3</th><th>差</th><th>印</th></tr>
  ${list.map(({name,c})=>`<tr class="${Math.abs(c.diff)>=BIG?'big':''}"><td class="s">${esc(name)}</td><td class="n">${c.now}</td><td class="n">${c.v3}</td><td class="n ${c.diff>0?'up':c.diff<0?'down':''}">${sign(c.diff)}</td><td class="m">${mark(c)}</td></tr>`).join('')}
  </table>`;};
(async()=>{
  fs.writeFileSync(path.join(OUT,'README.md'),text+DIFFS.map(d=>`\n![${d}](./${d.toLowerCase()}.png)`).join('')+'\n');
  let playwright;try{playwright=require('playwright');}catch{console.log('playwright が無いので PNG は作らない');return;}
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{const p=await browser.newPage({viewport:{width:390,height:400},deviceScaleFactor:2});
    for(const [i,d] of DIFFS.entries()){await p.setContent(page(d,i));await p.screenshot({path:path.join(OUT,`${d.toLowerCase()}.png`),fullPage:true});}}
  finally{await browser.close();}
  console.log(`書いた: ${path.relative(process.cwd(),OUT)}/README.md と ${DIFFS.map(d=>d.toLowerCase()+'.png').join(' ')}`);
})();
