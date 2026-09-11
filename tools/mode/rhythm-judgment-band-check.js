#!/usr/bin/env node
// 判定ラインの「幅」が、本当に判定窓のとおりに出ているか。
//
//   node tools/mode/rhythm-judgment-band-check.js
//
// 【なぜ要るか】(2026-09-06・ユーザー指示
//  「タップ判定ラインの表示を上下goodラインまで広げて真ん中にマーベラスラインを出すような表示に」)
// 判定はミリ秒(MARVELOUS±55 / GOOD±200)で決まるのに、画面には線が1本しか出ていなかったので、
// プレイヤーからは「どこからどこまでなら取れるのか」がまったく見えなかった。
//
// ここで見たいのは「帯が出ていること」ではなく、
// **帯の高さが本当に判定窓ぶんになっていること**。
// 見た目だけそれっぽく置くと、広さがウソになって「見えている幅では取れない」ことになる。
// そこで、画面から測った寸法(判定ラインの位置・ノーツの高さ・プレイエリアの高さ)と、
// ノーツが流れる時間から、帯の上下が来るべき位置を**この検査の中で独立に計算**して突き合わせる。
'use strict';
const http=require('http'),path=require('path'),fs=require('fs'),os=require('os');
const ROOT=path.resolve(__dirname,'..','..'),PORT=8993;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

// 演奏画面が組み上がるための最低限のスタイル（外部CDNのCSSはこのサンドボックスから取りに行けない）
const LAYOUT_CSS=`
html,body{height:100%;margin:0}
#root>div,#root>div>div{height:100%}
[data-rhythm-tap-test]{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden;height:100%}
[data-rhythm-hud]{position:absolute;left:0;right:0;top:0;z-index:30;display:flex;pointer-events:none}
[data-rhythm-play-area]{position:relative;flex:1 1 0%;min-height:0;overflow:hidden;margin:0 8px 8px}
[data-rhythm-note]{position:absolute;top:0;height:20px}
[data-rhythm-judgment-line]{position:absolute;bottom:12%;left:0;right:0;height:3px}
[data-rhythm-lane]{position:absolute;inset:0}
`;

// --- 期待値をこの検査の中で作る（実装の関数は呼ばない） ---
// ノーツの縦位置は progress(0=出た瞬間 / 1=判定ライン) に対してこの曲がり方で進む。
// 実装(rhythm-mode.js の rhythmProjectTravelProgress)と同じ式を、ここへ書き写して持つ。
// 片方だけ変えたら食い違って落ちる＝どちらかが勝手に変わったことに気づける。
const travelProgress=p=>p<0?p*.72:p>1?1+(p-1)*1.28:p*(.54+.46*p);
// 既定のノーツ速度 6.0 のときに、ノーツが出てから判定ラインへ着くまでの時間
const TRAVEL_MS=2150;
// 判定の幅だけは実データから読む。ここへ数字を書き写すと、判定表を変えたときに
// 「帯は正しく縮んでいるのに検査だけが古い数字で落ちる」が起きる(2026-09-11に実際に起きた)。
// 曲がり方の式(travelProgress)は意図的に書き写したままにする。あちらは
// 片方だけ変わったことに気づくための二重化なので、性格が違う。
const judgmentWindow=id=>{
  const source=require('fs').readFileSync(
    require('path').resolve(__dirname,'../../monster-hero/data/rhythm-mode.js'),'utf8');
  const hit=new RegExp(`id:'${id}',\\s*windowMs:\\s*(\\d+)`).exec(source);
  if(!hit)throw new Error(`判定 ${id} の windowMs を rhythm-mode.js から読めませんでした`);
  return Number(hit[1]);
};
const GOOD_MS=judgmentWindow('GOOD'),MARVELOUS_MS=judgmentWindow('MARVELOUS');

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',
      args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**cdn.tailwindcss.com**',route=>route.fulfill({status:200,
      contentType:'application/javascript',body:`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(LAYOUT_CSS)};document.head.appendChild(s);})();`}));
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);});
    const clickText=async(pat,nth=0)=>page.evaluate(([s,i])=>{const rx=new RegExp(s);
      const list=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!list[i])return false;list[i].click();return true;},[pat,nth]);

    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    // 配布のお知らせ(「確認」)を閉じずに測ると、画面ぜんぶを覆う 96% の暗い幕ごしに
    // 撮ることになり、色の差が20分の1以下に潰れる(2026-09-06にここで実際に外した)。
    for(let i=0;i<8;i++){if(!(await clickText('受け取る|閉じる|OK|とじる|^確認$')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    // 曲えらびの「決定」は data-rhythm-demo-start が目印。
    // 文字で探すと、みゅあの吹き出し（「…決定！ それだけで始まるよ♪」）まで拾ってしまい、
    // そのセリフが出た回だけ吹き出しが開いて演奏へ入れない(セリフは毎回変わる)。
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    // カウントダウン(READY→3→2→1)が終わって帯が置かれるまで待つ
    await page.waitForFunction(()=>{
      const band=document.querySelector('[data-rhythm-judgment-band]');
      return !!band&&band.getBoundingClientRect().height>1&&getComputedStyle(band).opacity!=='0';
    },undefined,{timeout:40000}).catch(()=>{});

    const snap=await page.evaluate(()=>{
      const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,left:r.left,height:r.height,width:r.width};};
      const area=document.querySelector('[data-rhythm-play-area]');
      const band=document.querySelector('[data-rhythm-judgment-band]');
      return {
        area:box(area),
        band:box(band),
        bandOpacity:band?getComputedStyle(band).opacity:null,
        bandBackground:band?getComputedStyle(band).backgroundImage:null,
        core:box(document.querySelector('[data-rhythm-judgment-core]')),
        edgeTop:box(document.querySelector('[data-rhythm-judgment-edge][data-edge="top"]')),
        edgeBottom:box(document.querySelector('[data-rhythm-judgment-edge][data-edge="bottom"]')),
        line:box(document.querySelector('[data-rhythm-judgment-line]')),
        note:box(document.querySelector('[data-rhythm-note]')),
      };
    });

    if(!snap.area||!snap.line){
      const where=await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,200));
      ok('演奏画面へ入れている',false,`プレイエリアか判定ラインが見つかりません / 画面: ${where}`);
    }else{
      ok('演奏画面へ入れている',true,`エリア高さ${Math.round(snap.area.height)}px`);
      ok('判定ラインの「幅」が出ている',
        !!snap.band&&snap.band.height>1&&snap.bandOpacity!=='0',
        snap.band?`高さ${Math.round(snap.band.height)}px / 透明度${snap.bandOpacity}`:'要素がありません');

      if(snap.band&&snap.band.height>1){
        const areaH=snap.area.height;
        const noteHeight=snap.note?snap.note.height:20;
        const lineCenter=snap.line.top-snap.area.top+snap.line.height/2;
        // 既定の設定(ノーツ開始位置0)のときの、ノーツが出てくる位置と流れる距離
        const spawnY=-noteHeight;
        const judgmentY=lineCenter-noteHeight/2;
        const travelPx=judgmentY-spawnY;
        const yAt=offsetMs=>Math.max(0,Math.min(areaH,
          spawnY+travelProgress(1+offsetMs/TRAVEL_MS)*travelPx+noteHeight/2));
        const wantTop=yAt(-GOOD_MS),wantBottom=yAt(GOOD_MS);
        const gotTop=snap.band.top-snap.area.top,gotBottom=snap.band.bottom-snap.area.top;
        ok('帯の上のふちがGOODの端（早い側）に合っている',Math.abs(gotTop-wantTop)<=2,
          `実測 ${gotTop.toFixed(1)}px / 計算 ${wantTop.toFixed(1)}px`);
        ok('帯の下のふちがGOODの端（遅い側）に合っている',Math.abs(gotBottom-wantBottom)<=2,
          `実測 ${gotBottom.toFixed(1)}px / 計算 ${wantBottom.toFixed(1)}px`);
        // 判定ラインの手前と奥では、同じ1msあたりに進むpxが違う。
        // 曲がりの傾きは判定ラインの直前が1.46、通り過ぎたあとが1.28なので、
        // **早い側(線より上)のほうが広くなる**。ここを左右対称に均すと
        // 「見えている幅」と「本当に取れる幅」が食い違うので、そのまま出しているかを見る。
        const above=lineCenter-gotTop,below=gotBottom-lineCenter;
        ok('上側のほうが広い（遠近の曲がりを均して左右対称にしていない）',above>below+2,
          `上 ${above.toFixed(1)}px / 下 ${below.toFixed(1)}px`);
        ok('判定ラインが帯の中にある',lineCenter>gotTop&&lineCenter<gotBottom,
          `線 ${lineCenter.toFixed(1)}px / 帯 ${gotTop.toFixed(1)}〜${gotBottom.toFixed(1)}px`);

        if(snap.core){
          const coreTop=snap.core.top-snap.area.top,coreBottom=snap.core.bottom-snap.area.top;
          ok('真ん中のMARVELOUSが判定ラインを含んでいる',coreTop<=lineCenter&&lineCenter<=coreBottom,
            `芯 ${coreTop.toFixed(1)}〜${coreBottom.toFixed(1)}px / 線 ${lineCenter.toFixed(1)}px`);
          ok('MARVELOUSはGOODより明らかに細い',
            snap.core.height>0&&snap.core.height<snap.band.height*.5,
            `芯 ${snap.core.height.toFixed(1)}px / 帯 ${snap.band.height.toFixed(1)}px`);
          const wantCore=yAt(MARVELOUS_MS)-yAt(-MARVELOUS_MS);
          ok('MARVELOUSの太さが判定窓ぶんになっている',Math.abs(snap.core.height-wantCore)<=2,
            `実測 ${snap.core.height.toFixed(1)}px / 計算 ${wantCore.toFixed(1)}px`);
        }else{
          ok('真ん中のMARVELOUSが出ている',false,'要素がありません');
        }
        ok('GOODの端に線が出ている',!!snap.edgeTop&&!!snap.edgeBottom,
          snap.edgeTop&&snap.edgeBottom?'上下とも':'足りません');
        ok('帯は判定ラインへ向かって濃くなる（のっぺりした板になっていない）',
          typeof snap.bandBackground==='string'&&snap.bandBackground.includes('gradient'),
          String(snap.bandBackground).slice(0,60));

        // --- ここからが本題: 本当に「見えている」か ---
        // 位置と高さが合っていても、ほかの層の下に隠れていたら意味がない。
        // 実際にそうなった(2026-09-06・ユーザー指摘「帯の色って反映されてる？」)。
        // DOMの順番では判定ラインの直前に置いてあったのに、レーンのSVGが z-index:1 を
        // 持っていたため、z-index:auto の帯はその下へ回り、色がまったく出ていなかった。
        // まっ赤に塗りつぶしても画面の色は rgb(14,20,36) のまま変わらなかった。
        // そこで「帯を消す前と後で画面の色がどれだけ変わるか」を画素で測る。
        const sharp=require(path.join(ROOT,'tools/node_modules/sharp'));
        // カウントダウンの幕(35%の暗さ)が残っているあいだも色が沈むので、消えてから撮る
        await page.waitForFunction(()=>!document.querySelector('[data-rhythm-countdown]'),
          undefined,{timeout:30000}).catch(()=>{});
        const clip={x:snap.area.left,y:snap.area.top,width:snap.area.width,height:snap.area.height};
        // ノーツが写り込むと測れないので、撮るあいだだけ隠す（判定には触らない）
        await page.addStyleTag({content:'[data-rhythm-note]{visibility:hidden!important}'});
        await page.waitForTimeout(200);
        const withBand=path.join(os.tmpdir(),'rhythm-band-on.png');
        const withoutBand=path.join(os.tmpdir(),'rhythm-band-off.png');
        await page.screenshot({path:withBand,clip});
        await page.evaluate(()=>{document.querySelector('[data-rhythm-judgment-band]').style.display='none';});
        await page.waitForTimeout(200);
        await page.screenshot({path:withoutBand,clip});
        const on=await sharp(withBand).raw().toBuffer({resolveWithObject:true});
        const offData=(await sharp(withoutBand).raw().toBuffer({resolveWithObject:true})).data;
        fs.rmSync(withBand,{force:true});fs.rmSync(withoutBand,{force:true});
        const rowDiff=y=>{
          const row=Math.max(0,Math.min(on.info.height-1,Math.round(y)));
          let best=0;
          for(let x=Math.round(on.info.width*.30);x<Math.round(on.info.width*.42);x++){
            const i=(row*on.info.width+x)*on.info.channels;
            best=Math.max(best,Math.abs(on.data[i]-offData[i]),
              Math.abs(on.data[i+1]-offData[i+1]),Math.abs(on.data[i+2]-offData[i+2]));
          }
          return best;
        };
        const bandTop=gotTop,bandBottom=gotBottom;
        ok('GOODの端の線が画面に出ている（ほかの層の下に隠れていない）',
          rowDiff(bandTop)>=12&&rowDiff(bandBottom-1)>=12,
          `上のふち ${rowDiff(bandTop)} / 下のふち ${rowDiff(bandBottom-1)}（12以上）`);
        ok('帯の中が画面で色づいている',
          rowDiff(bandTop+(lineCenter-bandTop)*.4)>=4,
          `帯の中 ${rowDiff(bandTop+(lineCenter-bandTop)*.4)}（4以上）`);
        if(snap.core){
          // 芯のどまん中は判定ラインの光(前後10pxのぼかし)と重なるので、そこで測ると
          // 芯そのものの効き目が埋もれる。線から離れた行のうち、いちばん効いている所を見る。
          const coreTop=snap.core.top-snap.area.top,coreBottom=snap.core.bottom-snap.area.top;
          let coreBest=0,coreAt=0;
          for(let y=Math.ceil(coreTop);y<=Math.floor(coreBottom);y++){
            if(Math.abs(y-lineCenter)<14)continue;
            const value=rowDiff(y);
            if(value>coreBest){coreBest=value;coreAt=y;}
          }
          ok('真ん中のMARVELOUSが画面で光っている',coreBest>=6,
            `芯のいちばん濃い所 ${coreBest}（y=${coreAt} / 6以上）`);
        }
        ok('帯の外は変わっていない（画面ぜんぶを塗っていない）',
          rowDiff(bandTop-25)<=2&&rowDiff(bandBottom+8)<=2,
          `上 ${rowDiff(bandTop-25)} / 下 ${rowDiff(bandBottom+8)}`);
      }
    }
  }catch(error){
    ok('検査を最後まで実行できる',false,error.message);
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
