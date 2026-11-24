// 直す前と後の止め絵・コマごとの数字のグラフを並べて書き出す(台帳 r1119-166)。
//   node docs/progress/beat/result-smooth-2026-11-24/compose.js <止め絵のフォルダ>
// 止め絵のフォルダには before-yoko/ after-yoko/ … (rhythm-robot-play.js --end-shots の出力)
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const DIR=__dirname,SHOTS=process.argv[2];
const NAMES={yoko:'横 844×390',tate:'縦 390×844',rot:'🔄横(端末は縦)'};
const img=f=>`data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const num=s=>Number(String(s||'').replace(/,/g,''))||0;
// 1本の線: 記録(毎コマ)から [時刻, 値の割合] の点を作る
const pts=(log,get,from,to)=>{const last=num(get(log[log.length-1]))||1;return log.filter(r=>r.t>=from&&r.t<=to).map(r=>[r.t,num(get(r))/last]);};
const svg=(title,lines,from,to)=>{const W=360,H=170,px=t=>30+(t-from)/(to-from)*(W-40),py=v=>H-22-v*(H-42);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0f172a" rx="8"/>
  <text x="10" y="16" fill="#e2e8f0" font-size="12" font-weight="700">${title}</text>
  <line x1="30" y1="${py(0)}" x2="${W-10}" y2="${py(0)}" stroke="#334155"/><line x1="30" y1="${py(1)}" x2="${W-10}" y2="${py(1)}" stroke="#334155" stroke-dasharray="3 3"/>
  <text x="30" y="${H-6}" fill="#94a3b8" font-size="10">${from}ms</text><text x="${W-60}" y="${H-6}" fill="#94a3b8" font-size="10">${to}ms</text>
  ${lines.map(l=>`<polyline fill="none" stroke="${l.c}" stroke-width="1.5" points="${l.p.map(([t,v])=>`${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}"/>`+l.p.map(([t,v])=>`<circle cx="${px(t).toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.2" fill="${l.c}"/>`).join('')).join('')}
  </svg>`;};
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const out=async(name,html)=>{await page.setContent(`<html><body style="margin:0;background:#020617;color:#e2e8f0;font-family:sans-serif">${html}</body></html>`);
    await page.waitForTimeout(200);await page.screenshot({path:path.join(DIR,name),fullPage:true,type:'jpeg',quality:80});console.log(name);};
  // 止め絵(結果に出て 0.45 秒・1.2 秒・2.6 秒)。向きごとに1枚
  for(const o of ['yoko','tate','rot']){
    const row=tag=>`<div style="display:flex;gap:8px;align-items:flex-start"><b style="width:70px">${tag==='before'?'直す前':'直した後'}</b>${[450,1200,2600].map(ms=>`<figure style="margin:0"><img src="${img(path.join(SHOTS,`${tag}-${o}`,`result-${ms}.png`))}" style="width:${o==='yoko'?360:190}px;border-radius:6px"><figcaption style="font-size:12px;text-align:center">${ms}ms</figcaption></figure>`).join('')}</div>`;
    await out(`shot-${o}.jpg`,`<div style="padding:12px;display:inline-block"><h3 style="margin:0 0 8px">${NAMES[o]}・同じ場面(mf_ichika_mix EASY・前の自己ベスト 900,000)</h3>${row('before')}<div style="height:8px"></div>${row('after')}</div>`);
  }
  // グラフ(CPU 4倍遅く・毎コマの点)。灰=直す前・水色=直した後
  const L=f=>JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
  const blocks=['yoko','tate','rot'].map(o=>{const b=L(`before-${o}-cpu4.json`),a=L(`after-${o}-cpu4.json`);
    return `<div><h4 style="margin:6px 0">${NAMES[o]}</h4><div style="display:flex;gap:8px">
      ${svg('スコア(点1つ=1コマ)',[{c:'#64748b',p:pts(b,r=>r.score,250,2600)},{c:'#22d3ee',p:pts(a,r=>r.score,250,2600)}],250,2600)}
      ${svg('いちばん上の判定の行',[{c:'#64748b',p:pts(b,r=>r.rows[0],250,700)},{c:'#22d3ee',p:pts(a,r=>r.rows[0],250,700)}],250,700)}
      ${svg('MAX COMBO',[{c:'#64748b',p:pts(b,r=>r.combo,2050,2550)},{c:'#22d3ee',p:pts(a,r=>r.combo,2050,2550)}],2050,2550)}</div></div>`;}).join('');
  await out('graph-cpu4.jpg',`<div style="padding:12px;display:inline-block"><h3 style="margin:0">コマごとの数字(CPU を4倍遅くした端末の代わり)</h3><p style="margin:4px 0 0;font-size:13px"><span style="color:#94a3b8">●灰 直す前</span>  <span style="color:#22d3ee">●水色 直した後</span>  点の間が空くほどコマが落ちて数字が飛んでいる</p>${blocks}</div>`);
  await browser.close();
})();
