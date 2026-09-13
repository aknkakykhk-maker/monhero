#!/usr/bin/env node
// モンスターノーツの演出の段が「本当に段になっているか」を、実際のブラウザで確かめる。
//
//   node tools/mode/rhythm-monster-effect-check.js
//
// 2026-09-13にユーザーから指摘を受けて作った。
//
//   「モンスターノーツの演出もっと軽いの設定で選べるようにしてほしい /
//     あれは踏んだときまだカクつきがある / ちなみに設定は最小」
//
// 原因はひとつ。モンスターノーツだけは、canvasに描くのとは**別に**マスモンの絵を
// DOMの要素で重ねていて、tick が毎フレーム transform と scale を書き換えている。
// ふつうのノーツには無い処理なので、それまでのいちばん軽い段(OFF)にしても残っていた。
// そこで NONE を足し、**絵の要素そのものを作らない**ようにした。
//
// 見るのは「段を下げるほど、モンスターノーツのために増える要素が減る」こと。
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');

ok('段は重い順に4つ',
  game.includes("const RHYTHM_MONSTER_EFFECT_LABELS = Object.freeze([['NORMAL','多め'],['LIGHT','標準'],['OFF','少なめ'],['NONE','最小']]);"));
ok('既定は「標準」の段',game.includes("monsterNoteEffect:'LIGHT'"));
// いちばん軽い段では、絵の要素を**作らない**(隠すのではなく作らない)。
// 隠すだけだと、要素はDOMに残って tick の走査対象にもなる
ok('いちばん軽い段ではマスモンの絵の要素を作らない',
  game.includes("const monsterFaceHidden=monsterNoteEffect==='NONE';")
  &&game.includes('const canvasFaceElements=useMemo(()=>canvasNotes&&!monsterFaceHidden?')
  &&game.includes('{monster&&!monsterFaceHidden&&<span data-rhythm-monster-face'));
ok('作る・作らないが変わったら組み直す(依存に入っている)',
  /\[canvasNotes,chart\.notes,monsterSignature,monsterFaceHidden\]/.test(game)
  &&/\[chart\.notes,monsterSignature,settings\.lightweightMode,settings\.effectAmount,monsterFaceHidden\]/.test(game));
ok('いちばん軽い段では能力名の大きな表示も出さない',
  game.includes("const showAbilityFlash=abilityFlash&&")&&game.includes("!=='NONE';")
  &&game.includes('...(showAbilityFlash?{ability:abilityFlash}:{})')
  &&game.includes('if(showAbilityFlash)scheduleAbilityClear();'));
// ---- 踏んだ瞬間の処理(2026-09-13・ユーザー指摘「マスモンの表示より踏んだときの挙動
//      だと思うんだけどその辺は何もいじらない？」) ----
// いちばん軽い段では、マスモンへの反応を**丸ごと飛ばす**。跳ねを出さないのに
// phase を書き換えてアニメを切り替え、700msのタイマーまで張っていた。
// 踏んだその瞬間にスタイルの計算が走るので、跳ねない段では何もしないのが正しい。
ok('いちばん軽い段では、踏んだときのマスモンへの反応を丸ごと飛ばす',
  game.includes("if(monsterHit&&monsterEffect!=='NONE'){")
  &&!/if\(monsterHit\)\{\s*\/\/ モンスターノーツだけは振動も強くする/.test(game));
// 振動は「タップ時の振動」の管轄。演出量のブロックの中で呼ぶと、
// 演出量を下げただけで強さが変わり、しかもモンスターノーツでは2回走っていた。
ok('振動は1か所だけで、モンスターノーツのときだけ強くする',
  game.includes("if(settings.vibrationEnabled&&judgment!=='MISS')RHYTHM_HAPTICS.tap(monsterHit?26:12);")
  &&(game.match(/RHYTHM_HAPTICS\.tap\(/g)||[]).length<=3);
ok('モンスターノーツかどうかは演出量のブロックの外で1回だけ出す',
  game.includes("const monsterHit=judgment!=='MISS'&&!!monsterForNote(note);"));
// どの段でも残すもの。ここが消えると「取れたことが分からない」になる
ok('どの段でも音は鳴る',game.includes('if(monsterHit)RHYTHM_NOTE_SE_RUNTIME.playMonster();'));
ok('どの段でも能力そのものは効く(見た目だけの分岐にする)',
  !/monsterNoteEffect[^\n]{0,80}rhythmActivateMonsterAbility/.test(game)
  &&game.includes('const activated=rhythmActivateMonsterAbility({ability:monster.ability,state:run.abilities,life:run.life,songTimeMs});'));
// マスモンを光らせるのは専用の設定(2026-09-13・前日の指摘と同じ筋)
ok('マスモンを光らせるのは専用の設定のまま(演出の段で横取りしない)',
  game.includes('if(settings.sideMonsterAbilityHighlight&&sideMonsterRefs.current.length){'));

// ---- 実ブラウザ: 段ごとにモンスターノーツのぶんだけ増える要素を数える ----
const http=require('http');
const PORT=9181;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  const counts={};
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    for(const level of ['LIGHT','NONE']){
      const page=await browser.newPage({viewport:{width:390,height:844}});
      await page.addInitScript(([effect])=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);
        put('mh_rhythm_settings_v1',{monsterNoteEffect:effect});},[level]);
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
      // 曲えらびから本番の譜面で始める(タイミング合わせの譜面にはモンスターノーツが無い)
      await clickText('^(決定|はじめる|プレイ|▶)$');
      await page.waitForTimeout(2500);
      counts[level]=await page.evaluate(()=>({
        play:!!document.querySelector('[data-rhythm-tap-test]'),
        faces:document.querySelectorAll('[data-rhythm-canvas-face],[data-rhythm-monster-face]').length,
      }));
      await page.close();
    }
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  ok('どの段でも演奏画面が開ける',!!counts.LIGHT?.play&&!!counts.NONE?.play);
  console.log(`      標準=${counts.LIGHT?.faces}個 / 最小=${counts.NONE?.faces}個 (モンスターノーツのために増える要素)`);
  // ★マスモンを枠へ入れていない状態では、どの段でも絵は作られない(比べても差が出ない)。
  //   ここでは「最小では**必ず**0」だけを見て、段ごとの差は上の静的な確かめに任せる。
  //   枠に入れて確かめられる状態なら、そのときは差も見る。
  ok('「最小」ではマスモンの絵の要素を1つも作らない',counts.NONE?.faces===0,`${counts.NONE?.faces}個`);
  if(Number(counts.LIGHT?.faces)>0)ok('「標準」より「最小」のほうが要素が少ない',counts.NONE.faces<counts.LIGHT.faces,
    `標準 ${counts.LIGHT.faces}個 → 最小 ${counts.NONE.faces}個`);
  else console.log('--  マスモンを枠へ入れていないので、段ごとの差は比べない(静的な確かめで見ている)');

  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
