#!/usr/bin/env node
// 自前で画面を回した状態でも、押した場所どおりのレーンが鳴るかを実ブラウザで確かめる。
//
//   node tools/mode/rhythm-forced-rotation-check.js
//
// 【なぜ要るか】(2026-09-06・ユーザーからの相談
//  「端末の設定とか関係なく強制的に画面の向きを変えられないの？」)
// 端末の向きを変える手段は screen.orientation.lock() ひとつしか無く、Androidは全画面中のみ・
// iOSのSafariには存在しない・アプリ内ブラウザは全画面を塞ぐ。頼るかぎり「できない端末」は残る。
// そこで端末が断ったら、端末は縦のまま**絵のほうを90度回して描く**。
//
// 【いちばん危ないところ】
// CSSで回すと getBoundingClientRect() も指の位置(clientX/clientY)も**回ったあとの値**で返る。
// レーン判定もノーツの配置もこの値を使っているので、素直に回すと
// 「押した場所と違うレーンが鳴る」「ノーツが横に流れる」ことになる。
// 回転を打ち消す変換(RHYTHM_VIEW_ROTATION)を1組だけ置いて全員そこを通す作りにしたが、
// **通し忘れが1か所でもあれば遊べない**。それは静的な検査では拾えない。
//
// そこで実際にブラウザで演奏画面を開き、回した状態で
//   ① 絵が本当に横向きの形になっていること(縦の画面なのに、遊ぶ器は横長)
//   ② 器が画面をすき間なく覆っていること
//   ③ **画面上のその場所を実際に押すと、狙ったサブレーンが光ること**(往復の一致)
//   ④ 戻したら元どおりになること
// を確かめる。③が本番で効くかどうかの本体で、ここが合っていれば遊べる。
const http=require('http'),path=require('path'),fs=require('fs');
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

// このサンドボックスは外部CDN(Tailwind)を取りに行けないので、演奏画面が組み上がるぶんだけ足す。
// 自前回転の器は position:fixed なので、中の高さは器の高さに従う
const LAYOUT_CSS=`
html,body{height:100%;margin:0}
/* 自前で回すと一番外の箱に position:fixed と大きさが直接入るので、
   この 100% はその箱の中身にそのまま効く(器のCSSはstyleが勝つ) */
#root>div,#root>div>div{height:100%}
[data-rhythm-tap-test]{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden;height:100%}
[data-rhythm-hud]{position:absolute;left:0;right:0;top:0;z-index:30;display:flex;pointer-events:none}
[data-rhythm-play-area]{position:relative;flex:1 1 0%;min-height:0;overflow:hidden;margin:0 8px 8px}
[data-rhythm-note]{position:absolute;top:0;height:20px}
[data-rhythm-judgment-line]{position:absolute;bottom:12%;left:0;right:0;height:3px}
[data-rhythm-lane]{position:absolute;inset:0}
[data-rhythm-side-monster]{position:absolute}
/* このサンドボックスはTailwindのCDNを取りに行けないので、flex / flex-col が効かない。
   曲えらびの「縦のときは縦積み」だけ手で作る(これが無いと初期値の row になり、
   回して row になったのか、はじめから row だったのかを見分けられない)。
   index.html 側の保険は [data-mh-view-rotation="true"] を前に付けたぶん詳細度が高いので、
   あとから書いたこれより優先される。 */
[data-rhythm-song-select]{display:flex;flex-direction:column}
`;

const VIEW={width:390,height:844};

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:VIEW});
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
    // 配布物のモーダルなどが出ていたら閉じる(押した場所を奪われないように)
    // 「お詫びの配布」などのモーダルは、押す場所を奪うので先に全部閉じる。
    // 「確認」を入れ忘れていて、これが開いたまま測っていたことがある(2026-09-06)
    // 「確認」は前後に何も付かないものだけを狙う。緩めると別のボタンまで押してしまう
    for(let i=0;i<8;i++){if(!(await clickText('受け取る|閉じる|OK|とじる|^確認$')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    // 「決定」は目印で押す。文字で探すと、みゅあの吹き出しのセリフを拾うことがある
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    await page.addStyleTag({content:LAYOUT_CSS});

    // ---- ⓪ 曲えらびの並び ----
    // 【2026-09-06・iPhoneの画面写真】自前で回したのに、曲の一覧がほとんど見えなかった。
    // Tailwind の landscape: は「@media (orientation: landscape)」に展開されるが、
    // 自前で回しているときは端末そのものが縦のままなのでこれが成立せず、
    // 53個ある landscape: がひとつも効かない。横長の器へ縦持ち用の並び
    // (見出し・一覧・詳細を縦に積む)が入り、高さ393pxへ押し込められて一覧が消える。
    //
    // index.html の tailwind.config で landscape: 自体を差し替えてあるが、
    // このサンドボックスはTailwindのCDNを取りに行けないので、そこは実機でしか確かめられない。
    // 代わりに「CDNの設定が効かなかったときの保険」として素のCSSも書いてあり、
    // **こちらは実ブラウザで確かめられる**。ここではその保険が効くことを見る。
    {
      const before=await page.evaluate(()=>{
        const el=document.querySelector('[data-rhythm-song-select]');
        return el?getComputedStyle(el).flexDirection:null;
      });
      ok('曲えらびは縦のときは縦積み',before==='column',String(before));
      await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(90));
      await page.waitForTimeout(300);
      const after=await page.evaluate(()=>{
        const el=document.querySelector('[data-rhythm-song-select]');
        const rot=document.querySelector('[data-mh-view-rotation="true"]');
        return {dir:el?getComputedStyle(el).flexDirection:null,marked:!!rot};
      });
      ok('自前で回すと目印が付く',after.marked);
      ok('自前で回すと曲えらびが左右2列になる（一覧が潰れない）',after.dir==='row',
        `flex-direction=${after.dir}`);
      await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));
      await page.waitForTimeout(300);
      const back=await page.evaluate(()=>{
        const el=document.querySelector('[data-rhythm-song-select]');
        return el?getComputedStyle(el).flexDirection:null;
      });
      ok('戻すと縦積みに戻る',back==='column',String(back));
    }

    // ---- ⓪-2 回したときのSafe Area(2026-09-12・ユーザー報告) ----
    // 「縦横ボタンを押して横画面にしたときにiPhoneの場合、左上の戻るボタンが押せない」。
    // 器は position:fixed なので body の Safe Area 用の余白の外に置かれ、画面のいちばん端から
    // 始まる。しかも90度回っているので **器の左端は端末の上端**。横画面の左上に置いた
    // 「戻る」が、ちょうどステータスバー(時計・電池)の下へ入り込んでいた。
    // iPhoneはそこのタップをOSが取るので、押しても反応しない。
    //
    // env() はテストから作れないので、器のCSSが env() を包んでいる var(--mh-safe-*) を
    // 差し替えて、実寸を測る。
    {
      const INSET={top:59,bottom:34,left:0,right:0};   // ダイナミックアイランド世代のiPhone相当
      for(const angle of [90,270]){
        await page.evaluate(([a,inset])=>{
          const root=document.documentElement.style;
          Object.entries(inset).forEach(([side,px])=>root.setProperty(`--mh-safe-${side}`,`${px}px`));
          RHYTHM_VIEW_ROTATION.set(0);
          RHYTHM_VIEW_ROTATION.set(a);
        },[angle,INSET]);
        await page.waitForTimeout(300);
        const measured=await page.evaluate(()=>{
          const back=document.querySelector('[data-rhythm-back]');
          if(!back)return null;
          const r=back.getBoundingClientRect();          // 回したあと=画面上の実寸
          const cx=r.left+r.width/2,cy=r.top+r.height/2;
          const hit=document.elementFromPoint(cx,cy);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
            reachable:!!(hit&&(hit===back||back.contains(hit))),
            vw:window.innerWidth,vh:window.innerHeight};
        });
        ok(`  ${angle}度: 「戻る」を画面上で見つけられる`,!!measured);
        if(measured){
          // ★ここが本体。ステータスバー(上59px)・ホームインジケータ(下34px)へ
          //   1pxでも入っていたら、その端末では押せない
          ok(`  ${angle}度: 「戻る」がSafe Areaの内側にある(端末の端に埋まらない)`,
            measured.top>=INSET.top&&measured.bottom<=measured.vh-INSET.bottom
            &&measured.left>=INSET.left&&measured.right<=measured.vw-INSET.right,
            `上端=${measured.top.toFixed(1)}px(>=${INSET.top}) / 下端=${measured.bottom.toFixed(1)}px(<=${measured.vh-INSET.bottom})`);
          // 回転のぶん当たり判定がずれていないか(押した場所にその要素が居るか)
          ok(`  ${angle}度: 「戻る」の真ん中を押すとその要素に当たる`,measured.reachable);
        }
      }
      await page.evaluate(()=>{
        const root=document.documentElement.style;
        ['top','bottom','left','right'].forEach(side=>root.removeProperty(`--mh-safe-${side}`));
        RHYTHM_VIEW_ROTATION.set(0);
      });
      await page.waitForTimeout(300);
    }
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    await page.addStyleTag({content:LAYOUT_CSS});
    // 読み込みとカウントダウンが終わって、実際にノーツが流れている状態まで待つ。
    // 「大きさが入っている」だけだと LOADING… のまま測ってしまう
    await page.waitForFunction(()=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      if(!area)return false;
      const r=area.getBoundingClientRect();
      if(!(r.width>50&&r.height>50))return false;
      if(document.querySelectorAll('[data-rhythm-sublane-feedback]').length===0)return false;
      // ノーツは公開フラグ rhythmCanvasNotes が true になってから(2026-09-07)
      // [data-rhythm-note-canvas] 1枚へ毎フレーム描いている。要素を数える書き方のままだと
      // 永遠に見つからず、ここで40秒のTimeoutになって検査ぜんぶが止まる。
      // canvas 版は「透明でない画素が描かれているか」で、流れていることを見る
      const canvas=document.querySelector('[data-rhythm-note-canvas]');
      if(canvas){
        if(!(canvas.width>0&&canvas.height>0))return false;
        try{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          for(let i=3;i<d.length;i+=4)if(d[i]>8)return true;
        }catch{return false;}
        return false;
      }
      return [...document.querySelectorAll('[data-rhythm-note]')].some(n=>{
        const st=getComputedStyle(n);
        if(st.display==='none'||st.opacity==='0')return false;
        const b=n.getBoundingClientRect();
        return b.height>0&&b.bottom>0&&b.top<window.innerHeight;
      });
    },undefined,{timeout:40000,polling:200});

    ok('変換のしくみがページから見えている',
      await page.evaluate(()=>typeof RHYTHM_VIEW_ROTATION==='object'&&typeof RHYTHM_VIEW_ROTATION.set==='function'));

    // ---- 押した場所と光るサブレーンが合っているかを見る道具 ----
    // 「器の中の座標」でサブレーンの真ん中を求め、それを画面上の座標へ出してから実際に押す。
    // 回していないときは器の中＝画面上なので、同じ手順がそのまま対照実験になる。
    const pointForSubLane=(subLane)=>page.evaluate((k)=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
      if(!rect)return null;
      // 判定ラインのあたり(下から12%)を狙う。実際に指を置く高さ
      const yRatio=0.88;
      const y=rect.top+rect.height*yRatio;
      const nx=rhythmProjectBoundary((k+0.5)/2,yRatio);
      const x=rect.left+rect.width*nx;
      const screen=RHYTHM_VIEW_ROTATION.unpoint(x,y);
      return {screenX:screen.clientX,screenY:screen.clientY,
        localX:x,localY:y,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};
    },subLane);
    const pressedSubLanes=()=>page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-sublane-feedback]')]
      .map((el,i)=>el.dataset.pressed==='true'?i:-1).filter(i=>i>=0));
    const tapAt=async(x,y)=>{
      await page.mouse.move(x,y);
      await page.mouse.down();
      const got=await pressedSubLanes();
      await page.mouse.up();
      return got;
    };

    // ノーツは譜面から先に並ぶので、「ノーツが見えている」だけでは**まだ演奏が始まっていない**。
    // 演奏が始まる前に押しても、押した指の控え(run)が無いのでサブレーンは光らない。
    // 実測で約1.5秒早く押していて、そのぶんだけ落ちていた(2026-09-06)。
    // 読み込み(LOADING…)とカウントダウン(READY→3→2→1)の両方が終わるまで待つ。
    await page.waitForFunction(()=>!document.querySelector('[data-rhythm-countdown]')
      &&!(document.body.innerText||'').includes('LOADING'),
      undefined,{timeout:40000}).catch(()=>{});
    await page.waitForTimeout(400);

    // ---- ① 回していないとき（対照）----
    const flat=await pointForSubLane(4);
    ok('回していないときのプレイエリアは縦長',flat&&flat.rect.width<flat.rect.height,
      flat?`${Math.round(flat.rect.width)}x${Math.round(flat.rect.height)}`:'測れない');
    const flatPressed=await tapAt(flat.screenX,flat.screenY);
    ok('回していないとき、押した場所のサブレーンが光る',flatPressed.includes(4),
      `光ったサブレーン [${flatPressed.join(',')}] / 狙い 4`);

    // ---- ② 自前で回す ----
    await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(90));
    await page.waitForTimeout(400);
    const frame=await page.evaluate(()=>{
      const el=document.querySelector('[data-mh-view-rotation="true"]');
      if(!el)return null;
      const style=getComputedStyle(el);
      const r=el.getBoundingClientRect();
      return {transform:style.transform,position:style.position,
        box:{left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)},
        layoutWidth:parseFloat(style.width),layoutHeight:parseFloat(style.height),
        vw:window.innerWidth,vh:window.innerHeight};
    });
    ok('回すと一番外の箱に目印が付く',!!frame);
    ok('一番外の箱を実際に回している',!!frame&&frame.transform!=='none'&&frame.transform!=='',
      frame?frame.transform:'');
    ok('器の縦横が入れ替わっている（縦の画面に横長の器）',
      !!frame&&Math.round(frame.layoutWidth)===frame.vh&&Math.round(frame.layoutHeight)===frame.vw,
      frame?`器 ${Math.round(frame.layoutWidth)}x${Math.round(frame.layoutHeight)} / 画面 ${frame.vw}x${frame.vh}`:'');
    ok('回した器が画面をすき間なく覆う',
      !!frame&&Math.abs(frame.box.left)<=1&&Math.abs(frame.box.top)<=1
      &&Math.abs(frame.box.width-frame.vw)<=1&&Math.abs(frame.box.height-frame.vh)<=1,
      frame?JSON.stringify(frame.box):'');

    const turned=await pointForSubLane(4);
    ok('回すとプレイエリアは横長になる（遊ぶ形が横向きになった）',
      turned&&turned.rect.width>turned.rect.height,
      turned?`${Math.round(turned.rect.width)}x${Math.round(turned.rect.height)}`:'測れない');

    // ---- ③ ここが本体。回した状態で押した場所どおりのサブレーンが光るか ----
    const misses=[];
    for(const k of [0,2,4,7,9]){
      const at=await pointForSubLane(k);
      if(!at){misses.push(`${k}:測れない`);continue;}
      const inside=at.screenX>=0&&at.screenX<=VIEW.width&&at.screenY>=0&&at.screenY<=VIEW.height;
      if(!inside){misses.push(`${k}:画面の外(${Math.round(at.screenX)},${Math.round(at.screenY)})`);continue;}
      const got=await tapAt(at.screenX,at.screenY);
      if(!got.includes(k))misses.push(`${k}:光ったのは[${got.join(',')}]`);
      await page.waitForTimeout(60);
    }
    ok('回した状態でも、押した場所どおりのサブレーンが光る',misses.length===0,
      misses.length?misses.join(' / '):'0・2・4・7・9 のすべて一致');

    // ノーツも器の中に収まっているか(横へ流れ出していないか)
    const noteOutside=await page.evaluate(()=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const rect=RHYTHM_VIEW_ROTATION.rectOf(area);
      if(!rect)return 'エリアを測れない';
      const bad=[...document.querySelectorAll('[data-rhythm-note]')].filter(n=>{
        const s=getComputedStyle(n);
        if(s.display==='none'||s.opacity==='0')return false;
        const r=RHYTHM_VIEW_ROTATION.rectOf(n);
        if(!r||r.width<=0)return false;
        return r.left<rect.left-2||r.right>rect.right+2;
      });
      return bad.length?`${bad.length}個がはみ出している`:'';
    });
    ok('回してもノーツがレーンの外へはみ出さない',noteOutside==='',noteOutside);

    // ---- ④ 戻したら元どおり ----
    await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));
    await page.waitForTimeout(400);
    const back=await page.evaluate(()=>{
      const el=document.querySelector('[data-mh-view-rotation="false"]');
      const area=document.querySelector('[data-rhythm-play-area]');
      const r=area?area.getBoundingClientRect():null;
      return {marked:!!el,transform:el?getComputedStyle(el).transform:null,
        width:r?Math.round(r.width):null,height:r?Math.round(r.height):null};
    });
    ok('戻すと目印も戻る',back.marked);
    ok('戻すと回転も外れる',back.transform==='none'||back.transform===''||back.transform===null,String(back.transform));
    ok('戻すとプレイエリアも縦長に戻る',back.width!==null&&back.width<back.height,
      `${back.width}x${back.height}`);
    const backPressed=await tapAt(flat.screenX,flat.screenY);
    ok('戻したあとも押した場所どおりのサブレーンが光る',backPressed.includes(4),
      `光ったサブレーン [${backPressed.join(',')}] / 狙い 4`);
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
