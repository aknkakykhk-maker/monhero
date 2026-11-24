// 結果の画面の見ごたえの案(台帳 r1119-156)を、本物の結果の画面の上で止め絵にする台本。ゲーム本体は変えない。
//   python3 tools/serve.py &   (8899)
//   node tools/mode/rhythm-robot-play.js --song beyond_the_same_sky_short --difficulty HELL --release early \
//        --viewport 844x390 --best-score 985712 --result-script docs/progress/beat/result-count-2026-11-24/proposal.js
// 結果が出た瞬間の画面を写し取り(React の外の複製)、その上で時刻 t を決めて、今の数え上げと案A〜Cの動きを描いて撮る。
// 撮った物は docs/progress/beat/result-count-2026-11-24/shots/<案>-<向き>-<ms>.png
'use strict';
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'shots');
const PLAN={
  now:[300,800,1300,1700,2600],
  A:[500,1100,1700,2250,3000],
  B:[450,900,1300,1650,2600],
  C:[500,1100,1550,1800,2600],
};
const SIZES={yoko:[844,390],tate:[390,844]};

// ── ページの中で動く ──
function install(){
  const ease=k=>1-Math.pow(1-k,3),cl=(x)=>Math.max(0,Math.min(1,x));
  const live=document.querySelector('[data-rhythm-result]');
  const snap=live.cloneNode(true);
  // 数字は社長の写真の回(Beyond the Same Sky short ver. HELL・FC でない回)に合わせた例へ置き換える(ロボットはクリアまで届かないため)
  {const EX={score:953722,prev:985712,rows:[282,592,89,18,4,0,9],combo:214};
    const set=(sel,fn)=>snap.querySelectorAll(sel).forEach(fn);
    set('[data-rhythm-result-score]',el=>{el.dataset.countTo=EX.score;el.textContent=EX.score.toLocaleString();});
    set('[data-rhythm-result-score-card]',el=>{el.dataset.countScore=EX.score;el.dataset.countPrev=EX.prev;});
    set('[data-rhythm-result-vs-best]',el=>{el.dataset.max=String(Math.max(EX.score,EX.prev)*1.004);const m=el.querySelector('[data-rhythm-result-vs-best-mark]');if(m)m.style.left=(EX.prev/(Math.max(EX.score,EX.prev)*1.004)*100).toFixed(2)+'%';});
    [...snap.querySelectorAll('[data-rhythm-result-judgment-table] > dd')].forEach((el,i)=>{el.dataset.countTo=EX.rows[i];el.textContent=String(EX.rows[i]);});
    set('[data-rhythm-max-combo]',el=>{el.dataset.countTo=EX.combo;el.textContent=String(EX.combo);});
    set('[data-rhythm-result-clear]',el=>{el.dataset.cleared='true';const b=el.querySelector('b');if(b){b.textContent='CLEAR';b.style.color='#67e8f9';}const sm=el.querySelector('small');if(sm)sm.innerHTML='ライフを<wbr>残して<wbr>最後まで<wbr>演奏しました';});
    {const w=document.createTreeWalker(snap,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(n.textContent.trim()==='+0'&&/経験値/.test(n.parentElement.closest('div')?.textContent||''))n.textContent='+77';if(/\(ランク1\)/.test(n.textContent))n.textContent=n.textContent.replace('(ランク1)','(ランク98)');}}
    set('[data-rhythm-result-rank]',el=>{const t=[...el.childNodes].find(n=>n.nodeType===3);if(t)t.textContent='SS';el.style.color='#fde68a';el.dataset.rankTier='4';});
    set('[data-rhythm-result-achievement]',el=>{el.textContent='満点の90%';});
    set('[data-rhythm-result-best]',el=>{el.textContent=EX.prev.toLocaleString();});
    set('[data-rhythm-next-rank]',el=>{el.innerHTML='次のランク <b style="color:#f0abfc">M</b> まで あと 46,278';});
    set('[data-rhythm-result-gauge-fill]',el=>{el.style.width='72%';});
    set('[data-rhythm-result-ratio]',el=>{el.style.display='none';});
    set('[data-rhythm-result-fast] b',el=>{el.textContent='373';});set('[data-rhythm-result-slow] b',el=>{el.textContent='330';});
    set('[data-rhythm-result-song-name]',el=>{el.textContent='Beyond the Same Sky short ver.';});
    set('[data-rhythm-difficulty-name]',el=>{el.textContent='HELL';el.style.color='#f87171';});
    set('[data-rhythm-result-level]',el=>{el.textContent='Lv.63';});
  }
  // 数え上げの最終値を、写した時点の React の値から拾う(data-count-to)
  const COLORS={JUST:'#fde68a',MARVELOUS:'#fbbf24',EXCELLENT:'#e879f9',GREAT:'#f87171',GOOD:'#a3e635',BAD:'#60a5fa',MISS:'#cbd5e1'};
  let root=null,P='now';
  const css=document.createElement('style');css.textContent=`
    [data-prop-layer]{position:absolute;inset:0;pointer-events:none;z-index:40;overflow:hidden}
    [data-prop-layer] i{position:absolute;display:block}
    .pp-digit{display:inline-block}
  `;document.head.appendChild(css);
  const q=(s)=>root.querySelector(s),qa=(s)=>[...root.querySelectorAll(s)];
  const rel=(el)=>{const r=el.getBoundingClientRect(),b=root.getBoundingClientRect();return {x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height,cx:r.left-b.left+r.width/2,cy:r.top-b.top+r.height/2};};
  window.__prop={
    reset(p){P=p;if(root)root.remove();root=snap.cloneNode(true);root.setAttribute('data-rhythm-count-anim','1');root.style.transform='';
      // 本物(React の物)は見えなくするだけで残し、同じ場所に重ねた箱へ写しを入れる(React が描き直しても壊れない)
      const cur=document.querySelector('[data-rhythm-result]:not([data-pp-copy])');if(cur)cur.style.visibility='hidden';
      let box=document.getElementById('pp-box');if(!box){box=document.createElement('div');box.id='pp-box';document.body.appendChild(box);}
      const r=cur?cur.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
      box.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:2147483000;display:flex;flex-direction:column`;
      // 案Aは行の入り・じゃん・はんこ・下の物の時刻を案の時刻へ合わせる(1行 260ms・7行のあとに MAX COMBO とスコアが決まる)
      if(p==='A'){const st=(k,v)=>root.style.setProperty(k,v);st('--mh-count-jan','2380ms');st('--mh-count-stamp','2450ms');st('--mh-count-ribbon','2700ms');st('--mh-count-rest','2700ms');
        const dt=[...root.querySelectorAll('[data-rhythm-result-judgment-table] > dt')],dd=[...root.querySelectorAll('[data-rhythm-result-judgment-table] > dd')];
        dt.forEach((el,i)=>{el.style.setProperty('--mh-row-d',`${300+i*260}ms`);dd[i].style.setProperty('--mh-row-d',`${300+i*260}ms`);});}
      root.setAttribute('data-pp-copy','');box.appendChild(root);
      const layer=document.createElement('div');layer.setAttribute('data-prop-layer','');root.appendChild(layer);
      root.querySelectorAll('[data-count-to]').forEach(el=>{el.dataset.ppTo=el.dataset.countTo;});
      const s=q('[data-rhythm-result-score]');if(s){s.dataset.ppText=Number(s.dataset.countTo).toLocaleString();}
    },
    at(t){
      for(const a of root.getAnimations({subtree:true})){try{a.pause();a.currentTime=t;}catch(_){}}
      const layer=q('[data-prop-layer]');layer.innerHTML='';
      const card=q('[data-rhythm-result-score-card]'),scoreEl=q('[data-rhythm-result-score]');
      const prev=card?Number(card.dataset.countPrev)||0:0,score=card?Number(card.dataset.countScore)||0:0;
      const vs=q('[data-rhythm-result-vs-best]'),fill=vs&&vs.querySelector('[data-rhythm-result-vs-best-fill]'),diff=q('[data-rhythm-best-diff]');
      const gmax=vs?Number(vs.dataset.max)||1:1;
      const rows=qa('[data-rhythm-result-judgment-table] > dd');
      const labels=qa('[data-rhythm-result-judgment-table] > dt');
      const combo=q('[data-rhythm-max-combo]');
      const setScore=v=>{if(fill)fill.style.transform=`scaleX(${Math.min(1,v/gmax).toFixed(4)})`;
        if(diff&&prev>0){const d=v-prev;diff.textContent=d>0?`前の自己ベストから +${d.toLocaleString()}`:d===0?'自己ベストと同じスコア':`自己ベストまで あと ${(-d).toLocaleString()}`;diff.dataset.reached=v>=prev?'1':'0';}};
      // 今の数え上げ(30-rhythm-play.jsx と同じ式)を基本にする
      const base=()=>{for(const el of qa('[data-pp-to]')){const to=Number(el.dataset.ppTo),at=Number(el.dataset.countAt)||0,ms=Math.max(1,Number(el.dataset.countMs)||1);
          const v=Math.round(to*ease(cl((t-at)/ms)));el.textContent=el.dataset.countPlain==='1'?String(v):v.toLocaleString();}
        setScore(Math.round(score*ease(cl((t-300)/1200))));};
      const spark=(cx,cy,n,r,color,size,alpha)=>{for(let i=0;i<n;i++){const a=i*137.5*Math.PI/180,rr=r*(.6+.4*((i*7)%5)/4);
        layer.insertAdjacentHTML('beforeend',`<i style="left:${cx+Math.cos(a)*rr-size/2}px;top:${cy+Math.sin(a)*rr-size/2}px;width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 ${size*2}px ${color};opacity:${alpha}"></i>`);}};
      const ring=(cx,cy,r,color,alpha,w)=>layer.insertAdjacentHTML('beforeend',`<i style="left:${cx-r}px;top:${cy-r}px;width:${2*r}px;height:${2*r}px;border-radius:50%;border:${w}px solid ${color};box-shadow:0 0 18px ${color},inset 0 0 18px ${color};opacity:${alpha}"></i>`);
      const glowRow=(i,k)=>{const L=rel(labels[i]),R=rel(rows[i]),c=COLORS[rows[i].dataset.rhythmJudgmentRow]||'#fff';
        layer.insertAdjacentHTML('beforeend',`<i style="left:${L.x-8}px;top:${L.y-2}px;width:${R.x+R.w-L.x+16}px;height:${L.h+4}px;border-radius:8px;background:linear-gradient(90deg,transparent,${c}55 30%,${c}88 70%,transparent);opacity:${k}"></i>`);};
      if(P==='now'){base();return;}
      if(P==='A'){
        // 案A 判定が1行ずつ決まる: 上の行から順に、1行 260ms で数えて決まる。数えている行は大きく光り、決まると弾けて行の色の粒が散る
        const start=300,step=260,cnt=200;
        rows.forEach((el,i)=>{const at=start+i*step,to=Number(el.dataset.ppTo),k=cl((t-at)/cnt);el.textContent=String(Math.round(to*ease(k)));
          const lab=labels[i];const active=t>=at&&t<at+step;const settled=t>=at+cnt;const pop=settled?Math.max(0,1-(t-at-cnt)/220):0;
          const s=1+(active?.18:0)+pop*.25;if(t>=at+350)[el,lab].forEach(x=>{x.style.animation='none';x.style.transformOrigin=x===el?'100% 50%':'0 50%';x.style.transform=`scale(${s.toFixed(3)})`;});
          if(active)glowRow(i,1);
          if(pop>0){const R=rel(el);spark(R.x+R.w-6,R.cy,8,10+26*(1-pop),COLORS[el.dataset.rhythmJudgmentRow]||'#fff',4,pop);}
        });
        const rowsEnd=start+rows.length*step;
        if(combo){const to=Number(combo.dataset.ppTo);combo.textContent=String(Math.round(to*ease(cl((t-rowsEnd)/300))));const pop=t>=rowsEnd+300?Math.max(0,1-(t-rowsEnd-300)/250):0;combo.style.transform=`scale(${(1+pop*.3).toFixed(3)})`;
          if(pop>0){const R=rel(combo);ring(R.cx,R.cy,24+40*(1-pop),'#fbbf24',pop,3);}}
        // スコアは行が決まるたびに積み上がる(行の進みに合わせて)
        const k=ease(cl((t-start)/(rowsEnd+300-start)));const v=Math.round(score*k);if(scoreEl)scoreEl.textContent=v.toLocaleString();setScore(v);
        const jan=rowsEnd+300;if(scoreEl){const pop=t>=jan?Math.max(0,1-(t-jan)/300):0;scoreEl.style.transformOrigin='0 70%';scoreEl.style.transform=`scale(${(1+pop*.25).toFixed(3)})`;
          if(pop>0){const R=rel(scoreEl);spark(R.cx,R.cy,18,R.w*.35+60*(1-pop),'#fde68a',5,pop);}}
        return;}
      if(P==='B'){
        // 案B スロットの桁止め: スコアの桁がスロットのように回り、左の桁から 1つずつ「カチッ」と止まる。止まった桁は金色に光る。最後に光が横切り、輪が広がる
        base();
        const text=(scoreEl&&scoreEl.dataset.ppText)||'0';const digits=[...text];const nDig=digits.filter(c=>/\d/.test(c)).length;
        let di=0;const first=600,gap=130;
        const html=digits.map((c,idx)=>{if(!/\d/.test(c))return `<span class="pp-digit" style="opacity:.8">${c}</span>`;const i=di++;const stop=first+i*gap;
          if(t<300)return `<span class="pp-digit" style="opacity:.35">0</span>`;
          if(t<stop){const r=(Math.floor(t/40)*7+i*3)%10;const off=((t/40)%1)*-10;return `<span class="pp-digit" style="color:#67e8f9;transform:translateY(${off.toFixed(1)}%);text-shadow:0 -6px 0 rgba(103,232,249,.35),0 6px 0 rgba(103,232,249,.35)">${r}</span>`;}
          const f=Math.max(0,1-(t-stop)/220);return `<span class="pp-digit" style="color:${f>0?'#fff':'#fde68a'};transform:scale(${(1+f*.35).toFixed(3)});text-shadow:0 0 ${(4+f*14).toFixed(0)}px rgba(253,230,138,${(.5+f*.5).toFixed(2)})">${c}</span>`;}).join('');
        if(scoreEl)scoreEl.innerHTML=html;
        const end=first+(nDig-1)*gap+120;
        if(scoreEl){const R=rel(scoreEl);
          // 止まった桁の下に小さな光
          const spans=[...scoreEl.querySelectorAll('.pp-digit')];let j=0;spans.forEach(sp=>{if(!/\d/.test(sp.textContent))return;const stop=first+(j++)*gap;const f=t>=stop?Math.max(0,1-(t-stop)/220):0;if(f>0){const S=rel(sp);spark(S.cx,S.cy,6,6+16*(1-f),'#fde68a',3,f);}});
          if(t>=end&&t<end+450){const k=(t-end)/450;layer.insertAdjacentHTML('beforeend',`<i style="left:${R.x-40+k*(R.w+80)}px;top:${R.y-6}px;width:46px;height:${R.h+12}px;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)"></i>`);}
          if(t>=end){const f=Math.max(0,1-(t-end)/600);if(f>0){ring(R.cx,R.cy,30+R.w*.6*(1-f),'#fde68a',f,3);ring(R.cx,R.cy,18+R.w*.4*(1-f),'#f0abfc',f*.8,2);}}}
        // 判定の行は決まる瞬間に数字が弾む
        rows.forEach((el,i)=>{const at=Number(el.dataset.countAt)||0,ms=Number(el.dataset.countMs)||1;const f=t>=at+ms?Math.max(0,1-(t-at-ms)/260):0;el.style.transformOrigin='100% 50%';el.style.transform=`scale(${(1+f*.4).toFixed(3)})`;if(f>0)glowRow(i,f*.9);});
        return;}
      if(P==='C'){
        // 案C 光のステージ: スコアの札の後ろで光の筋が回り、判定の表を光の帯が上から下へなでる。決まる瞬間に白く光って衝撃の輪と金の粒、ランクのはんこで画面が小さく揺れる
        base();
        const R=card?rel(card):{cx:0,cy:0,w:100,h:100};
        if(t>=250){const a=cl((t-250)/400),rot=(t/20)%360;layer.insertAdjacentHTML('afterbegin',`<i style="left:${R.cx-R.w}px;top:${R.cy-R.w}px;width:${R.w*2}px;height:${R.w*2}px;border-radius:50%;opacity:${(a*.55).toFixed(2)};background:repeating-conic-gradient(from ${rot}deg,rgba(253,230,138,.38) 0 8deg,transparent 8deg 24deg);-webkit-mask:radial-gradient(closest-side,#000 25%,transparent);mask:radial-gradient(closest-side,#000 25%,transparent);z-index:-1"></i>`);}
        const tab=q('[data-rhythm-result-judgment-table]');if(tab&&t>=400&&t<1300){const T=rel(tab),k=(t-400)/900;layer.insertAdjacentHTML('beforeend',`<i style="left:${T.x}px;top:${T.y+k*T.h-14}px;width:${T.w}px;height:28px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.45),transparent);mix-blend-mode:screen"></i>`);}
        rows.forEach((el,i)=>{const at=Number(el.dataset.countAt)||0,ms=Number(el.dataset.countMs)||1;const f=t>=at+ms?Math.max(0,1-(t-at-ms)/300):0;if(f>0)glowRow(i,f*.7);});
        const jan=1500;
        if(scoreEl&&t>=jan){const S=rel(scoreEl),f=Math.max(0,1-(t-jan)/700);
          if(t<jan+220)layer.insertAdjacentHTML('beforeend',`<i style="inset:0;width:100%;height:100%;background:rgba(255,255,255,${(.45*(1-(t-jan)/220)).toFixed(2)})"></i>`);
          if(f>0){ring(S.cx,S.cy,30+260*(1-f),'#fde68a',f,4);ring(S.cx,S.cy,20+170*(1-f),'#ffffff',f*.8,2);spark(S.cx,S.cy,26,40+200*(1-f),'#fbbf24',5,f);}}
        const stamp=1550;if(t>=stamp&&t<stamp+260){const k=(t-stamp)/260;root.style.transform=`translate(${(Math.sin(k*30)*4*(1-k)).toFixed(1)}px,${(Math.cos(k*24)*3*(1-k)).toFixed(1)}px)`;}else root.style.transform='';
        return;}
    }
  };
}

module.exports=async(page)=>{
  fs.mkdirSync(OUT,{recursive:true});
  await page.waitForTimeout(150);
  await page.addStyleTag({content:'[data-player-rank-up-fx]{display:none!important}'});
  await page.evaluate(install);
  for(const [o,[w,h]] of Object.entries(SIZES)){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(500);
    for(const [p,times] of Object.entries(PLAN)){
      for(const ms of times){await page.evaluate(([p])=>window.__prop.reset(p),[p]);await page.waitForTimeout(60);
        await page.evaluate(([ms])=>window.__prop.at(ms),[ms]);await page.waitForTimeout(60);
        await page.screenshot({path:path.join(OUT,`${p}-${o}-${ms}.png`)});}
    }
  }
  console.log('案の止め絵: '+OUT);
};
