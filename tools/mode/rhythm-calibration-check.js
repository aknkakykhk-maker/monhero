#!/usr/bin/env node
// タイミング合わせ(オプション →「実際の画面で合わせる」)を、実際のブラウザで最後まで通す。
//
//   node tools/mode/rhythm-calibration-check.js
//
// 2026-09-13にユーザーから次の指摘を受けて作った。
//
//   「タイミング合わせはチュートリアルの流用？
//     設定にもなってないし判定も出ないし終わったら進行不能になるし終わってる」
//
// 原因は1つで、叩いたずれを貯める run.deltas を**演奏の状態(run)ではなく画面の状態(view)**へ
// 足していた。叩いた瞬間に `Cannot read properties of undefined (reading 'push')` が投げられ、
// そこで applyJudgment が止まるので **判定もコンボもスコアも出ず**、
// 曲の終わりでも `run.deltas.slice` で落ちるため **リザルトへ進めない**(＝進行不能)。
// 構文としては正しいので check-syntax.js では拾えず、画面を開いた瞬間には落ちないので
// render-error-check.js でも拾えない。**実際に叩いてみる**この検査でしか分からない。
//
// 見るのは次の6つ。
//   ① 叩いても例外が出ない(run.deltas が居る)
//   ② 判定の文字が出る
//   ③ 曲が終わるとリザルトへ進む(進行不能にならない)
//   ④ リザルトで「この値にする」を押すと、設定(mh_rhythm_settings_v1)へ実際に入る
//   ⑤ 案内がチュートリアルの流用ではない(専用の文言・進み具合が出る)
//   ⑥ 案内がHUD(スコア・ライフ)に重ならない。縦持ち・横持ち(自前回転)の両方で
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9141;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

// --- まずソースだけで分かること ---
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
ok('叩いたずれを貯める先は演奏の状態(run)であって画面の状態(view)ではない',
  /runRef\.current=\{[^}]*deltas:\[\]/.test(play)&&!/initialView=\(\)=>\(\{[^}]*deltas:/.test(play));
ok('タイミング合わせをチュートリアル扱いで渡していない',
  /tutorial=\{rhythmPlay\.from==='tutorial'\}/.test(app)
  &&!/tutorial=\{rhythmPlay\.from==='tutorial'\|\|rhythmPlay\.from==='calibration'\}/.test(app));
ok('ライフはタイミング合わせでも減らない(途中で落ちて測れなくならない)',
  play.includes('run.life=(tutorial||calibrating)?RHYTHM_LIFE_MAX:')
  &&play.includes('const failed=!tutorial&&!calibrating&&run.lifeDepleted===true;'));
ok('チュートリアルとは別の案内を出している',
  play.includes('data-rhythm-calibration-banner')&&play.includes('data-rhythm-calibration-title'));
// ライフ表示の大きさは設定で変えられる。いちばん大きい形で案内の置き場所を測る
const LIFE_MAX_SIZE=Number((play.match(/RHYTHM_LIFE_SIZE_MAX/)&&fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8').match(/const RHYTHM_LIFE_SIZE_MAX *= *(\d+);/)||[])[1])||150;
ok('ライフ表示の最大の大きさを実装から取り出せる',Number.isFinite(LIFE_MAX_SIZE)&&LIFE_MAX_SIZE>=100,`${LIFE_MAX_SIZE}%`);
ok('測った値をその場で設定へ入れる口がある',
  play.includes('onApplyCalibration')&&app.includes('judgmentTimingOffsetMs:offsetMs'));

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    for(const mode of ['portrait','landscape']){
      const page=await browser.newPage({viewport:{width:390,height:844}});
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      // ★ライフ表示はいちばん大きい設定で測る(2026-09-13)。既定の大きさだけで測っていたため、
      //   200%にすると横持ちで案内とポーズボタンが重なることを見逃していた
      await page.addInitScript(([lifeMax])=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);
        put('mh_rhythm_settings_v1',{lifeDisplaySize:lifeMax});},[LIFE_MAX_SIZE]);
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
      // 横持ちは端末を回さず、器のほうを回す(RHYTHM_VIEW_ROTATION)。CSSの landscape: は効かない
      if(mode==='landscape'){await clickText('🔄');await page.waitForTimeout(800);}
      const rotated=await page.evaluate(()=>!!document.querySelector('[data-rhythm-rotate-frame],[data-rhythm-rotated]')
        ||/rotate\(90deg\)/.test(document.body.innerHTML));
      await clickText('⚙️');await page.waitForTimeout(600);
      const opened=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-calibrator-open]');if(!b)return false;b.click();return true;});
      ok(`[${mode}] オプションから「実際の画面で合わせる」を開ける`,opened);
      if(!opened){await page.close();continue;}
      await page.waitForTimeout(1500);

      const head=await page.evaluate(()=>({
        play:!!document.querySelector('[data-rhythm-tap-test]'),
        banner:!!document.querySelector('[data-rhythm-calibration-banner]'),
        tutorialBanner:!!document.querySelector('[data-rhythm-tutorial-banner]'),
        label:(document.querySelector('[data-rhythm-mode-label]')?.textContent||'').trim(),
      }));
      ok(`[${mode}] 演奏画面がそのまま開く`,head.play);
      ok(`[${mode}] 専用の案内が出る`,head.banner);
      ok(`[${mode}] チュートリアルの説明は出さない`,!head.tutorialBanner);
      if(mode==='portrait')ok('肩書きが「タイミング合わせ」になっている',head.label==='タイミング合わせ',head.label||'(空)');

      // 案内がHUD(スコア・ライフ)へ重なっていないこと
      const boxes=await page.evaluate(()=>{
        const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
        // ★箱(hud-right)ではなく**実際に描かれているもの**を measure する。
        //   ライフ行は箱の幅(33vw)を越えて左へはみ出すので、箱だけ見ていると
        //   ポーズボタンや行が案内に重なっているのを見逃す(2026-09-13に実際に見逃した)
        return {banner:r('[data-rhythm-calibration-banner]'),hudL:r('[data-rhythm-hud-left]'),hudR:r('[data-rhythm-hud-right]'),
          life:r('[data-rhythm-life]'),pause:r('[data-rhythm-pause]'),
          combo:r('[data-rhythm-combo-box]'),judgment:r('[data-rhythm-judgment-display]'),line:r('[data-rhythm-judgment-line]')};
      });
      const overlap=(a,b)=>!!a&&!!b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
      ok(`[${mode}] 案内がスコアの表示に重ならない`,!overlap(boxes.banner,boxes.hudL),
        boxes.banner?`案内 top=${boxes.banner.top.toFixed(0)} / スコア bottom=${boxes.hudL?boxes.hudL.bottom.toFixed(0):'?'}`:'案内なし');
      ok(`[${mode}] 案内がライフの表示に重ならない`,!overlap(boxes.banner,boxes.hudR)&&!overlap(boxes.banner,boxes.life),
        boxes.life&&boxes.banner?`案内 ${boxes.banner.left.toFixed(0)}〜${boxes.banner.right.toFixed(0)} / ライフ ${boxes.life.left.toFixed(0)}〜${boxes.life.right.toFixed(0)}`:'');
      ok(`[${mode}] 案内がポーズボタンに重ならない`,!overlap(boxes.banner,boxes.pause),
        boxes.pause&&boxes.banner?`案内 ${boxes.banner.left.toFixed(0)}〜${boxes.banner.right.toFixed(0)} / ポーズ ${boxes.pause.left.toFixed(0)}〜${boxes.pause.right.toFixed(0)}`:'');
      ok(`[${mode}] 案内が判定の文字に重ならない`,!overlap(boxes.banner,boxes.judgment));
      ok(`[${mode}] 案内が判定ラインを隠さない`,!overlap(boxes.banner,boxes.line));

      // 叩く。判定が出ること・例外が出ないこと・リザルトへ進むこと
      // 叩く場所は**判定ラインの真ん中**。自前回転のときは器ごと回っているので、
      // プレイエリアの「下のほう」を画面の座標で出すと、横持ちでは別の場所になる
      const area=await page.evaluate(()=>{const l=document.querySelector('[data-rhythm-judgment-line]');if(!l)return null;
        const r=l.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
      const judgments=new Set();let reachedResult=false,progressed=false,comboOverlap=false,comboSeen=false;
      for(let i=0;i<240;i++){
        const st=await page.evaluate(()=>({
          j:(document.querySelector('[data-rhythm-judgment-text]')?.textContent||'').trim(),
          title:(document.querySelector('[data-rhythm-calibration-title]')?.textContent||'').trim(),
          result:!!document.querySelector('[data-rhythm-calibration-result]'),
          combo:(e=>e?(b=>({top:b.top,bottom:b.bottom,left:b.left,right:b.right}))(e.getBoundingClientRect()):null)(document.querySelector('[data-rhythm-combo-box]')),
          banner:(e=>e?(b=>({top:b.top,bottom:b.bottom,left:b.left,right:b.right}))(e.getBoundingClientRect()):null)(document.querySelector('[data-rhythm-calibration-banner]')),
        }));
        if(st.j)judgments.add(st.j);
        if(/あと/.test(st.title)||/おしまい/.test(st.title))progressed=true;
        if(st.combo&&st.banner){comboSeen=true;if(st.combo.left<st.banner.right&&st.banner.left<st.combo.right&&st.combo.top<st.banner.bottom&&st.banner.top<st.combo.bottom)comboOverlap=true;}
        if(st.result){reachedResult=true;break;}
        if(area)await page.mouse.click(area.x,area.y);
        await page.waitForTimeout(110);
      }
      ok(`[${mode}] 案内がコンボ数に重ならない`,!comboOverlap,comboSeen?'コンボが出た状態で確かめた':'コンボが出なかったので重なりようがない');
      ok(`[${mode}] 叩いても実行時エラーが出ない`,errors.length===0,errors.slice(0,2).join(' / ')||'なし');
      ok(`[${mode}] 判定の文字が出る`,judgments.size>0,[...judgments].join(' / ')||'(出なかった)');
      ok(`[${mode}] MISS以外の判定も出る(数える対象がある)`,[...judgments].some(j=>j&&j!=='MISS'),[...judgments].join(' / '));
      ok(`[${mode}] 案内が進み具合を出す(チュートリアルの文言のままにならない)`,progressed);
      ok(`[${mode}] 曲が終わるとリザルトへ進む(進行不能にならない)`,reachedResult);
      if(reachedResult){
        const before=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('mh_rhythm_settings_v1')||'{}').judgmentTimingOffsetMs;}catch{return null;}});
        const shown=await page.evaluate(()=>{
          const el=document.querySelector('[data-rhythm-calibration-offset]');
          return {offset:el?(el.textContent||'').trim():null,
            apply:!!document.querySelector('[data-rhythm-calibration-apply]'),
            retry:!!document.querySelector('[data-rhythm-calibration-retry]'),
            cancel:!!document.querySelector('[data-rhythm-calibration-cancel]')};
        });
        ok(`[${mode}] 測った値がリザルトに出る`,!!shown.offset&&/-?\d+ms/.test(shown.offset),shown.offset||'(出ていない)');
        ok(`[${mode}] 「この値にする」「もう一度」「使わずに戻る」がそろっている`,shown.apply&&shown.retry&&shown.cancel);
        await page.evaluate(()=>document.querySelector('[data-rhythm-calibration-apply]')?.click());
        await page.waitForTimeout(1500);
        const after=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('mh_rhythm_settings_v1')||'{}').judgmentTimingOffsetMs;}catch{return null;}});
        const back=await page.evaluate(()=>({options:!!document.querySelector('[data-rhythm-options]'),
          notice:(document.querySelector('[data-rhythm-calibrator-result]')?.innerText||'').replace(/\s+/g,' ')}));
        const expected=Number(String(shown.offset).replace('ms',''));
        ok(`[${mode}] 「この値にする」で設定へ実際に入る`,Number.isFinite(after)&&after===expected,
          `保存前 ${before} → 保存後 ${after} / リザルトの表示 ${shown.offset}`);
        ok(`[${mode}] オプションへ戻る`,back.options);
        ok(`[${mode}] 戻った先で「入れました」と分かる`,/にしました/.test(back.notice),back.notice.slice(0,60)||'(出ていない)');
      }
      await page.close();
    }
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
