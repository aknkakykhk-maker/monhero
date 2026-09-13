#!/usr/bin/env node
// 演出量の段が「本当に段になっているか」を、実際のブラウザで測る。
//
//   node tools/mode/rhythm-effect-amount-check.js
//
// 2026-09-13にユーザーから指摘を受けて作った。
//
//   「通常が今までの多めの演出量になってる気がする /
//     今回通常に変えたのっていままでいうと少なめのはずなんだけど 確認して」
//
// 配線は正しかったが、**LOW が NORMAL とほとんど変わらなかった**のが原因。
// LOW が止めていたのは判定文字の流れるグラデーションとぼかしの枚数だけで、
// 判定ラインの脈打ち・マスモンの跳ね・コンボの脈打ちといった
// **曲のあいだずっと動き続けるもの**は NORMAL と同じままだった。
// そこで LIGHT を1段足して既定にし(「段を増やして更に標準をもっと軽くする」)、
// 段ごとに「動き続けるものが何本走っているか」を数えて見張る。
//
// 数えるのは animation-name が none でない要素の本数。
// 段が軽くなるほど減る(増えたり同じになったら段になっていない)。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9163;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
// 段は重い順に並んでいること(この順が「どちらが軽いか」の正本)
ok('演出量の段が重い順に並んでいる',
  game.includes("const RHYTHM_EFFECT_LEVELS = Object.freeze(['NORMAL','LOW','LIGHT','MINIMAL']);"));
ok('段の比較を1か所にまとめてある(段を足すたびに条件を書き足さない)',
  game.includes('const rhythmEffectAtMost = (amount,level)=>rhythmEffectRank(amount)>=RHYTHM_EFFECT_LEVELS.indexOf(level);')
  &&game.includes("rhythmEffectAtMost(settings.effectAmount,'LIGHT')"));
ok('既定は「標準」の段',game.includes("effectAmount:'LIGHT'"));

// 段ごとに「止まるもの」がCSSに入っているか(実要素で測れないものはここで見る)。
// コンボ数は200コンボ以上、マスモンは設定している人にしか出ないので、実画面では作れない。
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const stopsAt=(source,selector,level)=>new RegExp(`\\[data-rhythm-effect="${level}"\\] ${selector.replace(/[[\]]/g,ch=>'\\'+ch)}[^{]*\\{[^}]*animation:none`).test(source);
ok('「標準」でコンボ数の脈打ちと跳ねが止まる',
  stopsAt(html,'[data-rhythm-combo-box]','LIGHT')&&stopsAt(html,'[data-rhythm-combo]','LIGHT'));
ok('「標準」で両サイドのマスモンの跳ねが止まる',
  stopsAt(data,'[data-rhythm-side-monster]','LIGHT'));
ok('「標準」で判定文字が弾む動きが止まる',
  stopsAt(data,'[data-rhythm-judgment-text]','LIGHT'));
ok('「標準」で判定ラインの脈打ちが止まる',
  stopsAt(data,'[data-rhythm-judgment-line]','LIGHT'));
ok('「標準」でノーツを取り切ったときの光を出さない',
  game.includes("if(!settings.lightweightMode&&!rhythmEffectAtMost(settings.effectAmount,'LIGHT'))note._rhythmClearAt="));
// 「最大」では止まっていないこと(段の差が本物であることの裏取り)
ok('「最大」ではどれも止まっていない',
  !stopsAt(html,'[data-rhythm-combo-box]','NORMAL')&&!stopsAt(data,'[data-rhythm-side-monster]','NORMAL')
  &&!stopsAt(data,'[data-rhythm-judgment-line]','NORMAL'));

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  let measured=null;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);});
    const clickText=async(pat,nth=0)=>page.evaluate(([s,i])=>{const rx=new RegExp(s);
      const l=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!l[i])return false;l[i].click();return true;},[pat,nth]);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|とじる|確認)$')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');await page.waitForTimeout(1200);
    await clickText('⚙️');await page.waitForTimeout(700);
    await page.evaluate(()=>document.querySelector('[data-rhythm-calibrator-open]')?.click());
    await page.waitForTimeout(2000);
    // 実際に描かれている要素へ段を差し替えて、CSSがどう効くかをその場で測る。
    // (判定文字は判定が出ている状態を作るために data-judgment を入れてから測る)
    measured=await page.evaluate(()=>{
      const main=document.querySelector('[data-rhythm-tap-test]');
      const area=document.querySelector('[data-rhythm-play-area]');
      const line=document.querySelector('[data-rhythm-judgment-line]');
      const text=document.querySelector('[data-rhythm-judgment-text]');
      if(!main||!area||!line||!text)return null;
      const keepMain=main.getAttribute('data-rhythm-effect'),keepArea=area.getAttribute('data-rhythm-effect');
      text.setAttribute('data-judgment','MARVELOUS');
      const out={};
      for(const level of ['NORMAL','LOW','LIGHT','MINIMAL']){
        main.setAttribute('data-rhythm-effect',level);area.setAttribute('data-rhythm-effect',level);
        const lineStyle=getComputedStyle(line),textStyle=getComputedStyle(text);
        out[level]={
          line:lineStyle.animationName,
          text:textStyle.animationName,
          blurs:(textStyle.filter.match(/drop-shadow/g)||[]).length,
        };
      }
      main.setAttribute('data-rhythm-effect',keepMain);area.setAttribute('data-rhythm-effect',keepArea);
      text.removeAttribute('data-judgment');
      return out;
    });
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  ok('演奏画面で実際に測れた',!!measured);
  if(measured){
    const moving=level=>(measured[level].line!=='none'?1:0)+(measured[level].text!=='none'?1:0);
    ['NORMAL','LOW','LIGHT','MINIMAL'].forEach(level=>{
      const m=measured[level];
      console.log(`      [${level}] 判定ライン=${m.line} / 判定文字=${m.text} / ぼかし${m.blurs}枚`);
    });
    ok('「多め」は「最大」より動きが少ない',moving('LOW')<moving('NORMAL'),
      `最大 ${moving('NORMAL')} → 多め ${moving('LOW')}`);
    ok('「標準」は「多め」より動きが少ない',moving('LIGHT')<moving('LOW'),
      `多め ${moving('LOW')} → 標準 ${moving('LIGHT')}`);
    ok('「標準」では動き続けるものが残っていない',moving('LIGHT')===0);
    // 2026-09-13の指摘そのもの。「標準」が「最大」とほとんど同じでは意味がない
    ok('「標準」のぼかしは「最大」より少ない',measured.LIGHT.blurs<measured.NORMAL.blurs,
      `最大 ${measured.NORMAL.blurs}枚 → 標準 ${measured.LIGHT.blurs}枚`);
    ok('「多め」と「標準」で判定文字の見た目の情報は残る(色を消していない)',
      measured.LIGHT.blurs>=1&&measured.LOW.blurs>=1);
  }

  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
