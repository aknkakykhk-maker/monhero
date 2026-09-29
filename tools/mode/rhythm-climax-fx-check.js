#!/usr/bin/env node
// モンヒロビートの「盛り上がりの光」「叩いた場所に判定」「ランクが上がった瞬間」(2026-09-29・参考動画から)を見張る。
//
//   node tools/mode/rhythm-climax-fx-check.js
//
//   ・盛り上がる区間の表(RHYTHM_SONG_CLIMAX)が解析と合っている。公開中の全曲に行がある
//   ・設定「盛り上がりの光」「叩いた場所に判定」は既定 OFF。保存値に無い・壊れているときも OFF で補われる
//   ・見た目のおまかせ「華やか」「全部のせ」だけが盛り上がりの光を点ける。重いときの自動調整で消える
//   ・本体を開いて、区間の中と外で強さが出る・叩いた場所の判定の部品が使い回される・CSS が効いている
//   ・道の演出の奥のもやと光の CSS がある(2026-09-26 の main の取り込みで消え、出ていなかった)
//   ・ランクが上がった瞬間の演出は、S 以上へ上がったときだけ・演出量「最小」と軽量モードでは出さない
// 実際の演奏で出るかは、ロボット(rhythm-robot-play.js --settings ... )で確かめる(2026-09-29: トリコ MASTER で
// 光は 46.7秒に点いて 74.7秒に消え、叩いた場所の判定は159回、S 65.1秒 → SS 69.8秒 → M 77.8秒)。
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9186;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
let failures=0;
const check=(label,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

// --- 表が解析と合っているか ---
{
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-song-climax.js'),'--check'],{cwd:ROOT,encoding:'utf8'});
  check('盛り上がる区間の表が解析と合っている',r.status===0,(r.stdout||r.stderr).trim().split('\n').pop());
  const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
  const runtime=read('monster-hero/data/rhythm-mode.js');
  const table=runtime.slice(runtime.indexOf('// <rhythm-song-climax>'),runtime.indexOf('// </rhythm-song-climax>'));
  const missing=Object.keys(RELEASED_TRACKS).filter(id=>!new RegExp(`^\\s+'?${id}'?:`,'m').test(table));
  check('公開中の全曲に行がある',!missing.length,missing.join(', '));
}

// --- 本体のソース ---
{
  const settings=read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
  const play=read('monster-hero/src/parts/30-rhythm-play.jsx');
  const html=read('monster-hero/index.html');
  check('道の演出の奥のもや・光の CSS がある',/\[data-rhythm-road-haze\]\{position:absolute/.test(html)&&/\[data-rhythm-road-glow\]\{position:absolute/.test(html));
  check('盛り上がりの光の CSS がある(transform だけで流す・最小では出さない)',/@keyframes mhRhythmClimaxStreak\{from\{transform:translate3d/.test(html)&&/\[data-rhythm-effect="MINIMAL"\] \[data-rhythm-climax\]\{display:none\}/.test(html));
  check('盛り上がりの光は演出量「最小」・軽量モード・チュートリアルでは置かない',/const climaxFxOn=settings\.climaxFx===true&&settings\.effectAmount!=='MINIMAL'&&!settings\.lightweightMode&&!tutorial/.test(play));
  check('盛り上がりの光は重いときの自動調整(演奏中の設定)に従う',/settingsLiveRef\.current\.climaxFx===true\?rhythmSongClimaxAt\(/.test(play));
  check('叩いた場所の判定はタイミング合わせでは出さない',/settings\.judgmentAtTap===true&&judgment!=='MISS'&&!calibrating/.test(play));
  check('ランクの演出は演出量「最小」・軽量モードでは出さない',/rankFx=\{!settings\.lightweightMode&&settings\.effectAmount!=='MINIMAL'\}/.test(play));
  check('ランクの演出は S 以上へ上がったときだけ',/order\(rank\)<order\(prev\)&&order\(rank\)<=order\('S'\)/.test(play));
  check('自動調整の段に盛り上がりの光が入っている',/s=>s\.roadFx\|\|s\.noteMotionFx\|\|s\.climaxFx\?\{roadFx:false,noteMotionFx:false,climaxFx:false\}:null/.test(settings));
}

// --- 本体を開いて ---
(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので本体を開けません');finish();return;}}
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
  await new Promise(r=>server.listen(PORT,r));
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>typeof rhythmSongClimaxAt==='function'&&typeof normalizeRhythmSettings==='function',undefined,{timeout:60000});
    const got=await page.evaluate(()=>{
      const out={};
      out.defaults=[DEFAULT_RHYTHM_SETTINGS.climaxFx,DEFAULT_RHYTHM_SETTINGS.judgmentAtTap];
      const empty=normalizeRhythmSettings({}),broken=normalizeRhythmSettings({climaxFx:'yes',judgmentAtTap:1}),on=normalizeRhythmSettings({climaxFx:true,judgmentAtTap:true});
      out.normalized=[empty.climaxFx,empty.judgmentAtTap,broken.climaxFx,broken.judgmentAtTap,on.climaxFx,on.judgmentAtTap];
      out.presets=Object.fromEntries(RHYTHM_LOOK_PRESETS.map(p=>[p.id,p.values.climaxFx]));
      out.capped=rhythmCapEffects({...on,noteBloom:false,stageEffect:'SIMPLE',roadFx:false,noteMotionFx:false},3).climaxFx;
      const [a,b,strength]=RHYTHM_SONG_CLIMAX.only_my_railgun[0];
      out.inside=rhythmSongClimaxAt('only_my_railgun',(a+b)/2);out.strength=strength;
      out.outside=[rhythmSongClimaxAt('only_my_railgun',a-1),rhythmSongClimaxAt('only_my_railgun',b),rhythmSongClimaxAt('no_such_song',a),rhythmSongClimaxAt('only_my_railgun',NaN)];
      // 叩いた場所の判定(本物の演奏エリアと同じ印の器で)
      const area=document.createElement('div');area.setAttribute('data-rhythm-play-area','');area.style.cssText='position:fixed;left:0;top:0;width:390px;height:700px';document.body.appendChild(area);
      out.miss=rhythmSpawnTapJudgment(area,{centerRatio:.3,judgment:'MISS'});
      for(let i=0;i<11;i++)rhythmSpawnTapJudgment(area,{centerRatio:i/10,judgment:i%2?'GREAT':'MARVELOUS',side:'FAST'});
      const items=[...area.querySelectorAll('[data-rhythm-tap-judgment]')];
      out.pool=items.length;out.layers=area.querySelectorAll('[data-rhythm-tap-judgments]').length;
      const last=items[(11-1)%items.length];out.lastText=[last.firstChild.textContent,last.lastChild.textContent];
      const marv=items[(10-1)%items.length];out.marvSide=marv.lastChild.textContent;
      const cs=getComputedStyle(items[0]);out.tapCss=[cs.position,cs.pointerEvents];
      // CSS が効いているか(道のもや・盛り上がりの光)
      const haze=document.createElement('i');haze.setAttribute('data-rhythm-road-haze','');area.appendChild(haze);
      out.hazeCss=getComputedStyle(haze).position;
      const climax=document.createElement('i');climax.setAttribute('data-rhythm-climax','');climax.setAttribute('data-on','1');climax.innerHTML='<b data-side="l"></b><b data-side="r"></b>';area.appendChild(climax);
      out.climaxCss=[getComputedStyle(climax).position,getComputedStyle(climax.firstChild,'::before').animationName,getComputedStyle(climax.firstChild,'::before').animationPlayState];
      climax.setAttribute('data-on','0');out.climaxPaused=getComputedStyle(climax.firstChild,'::before').animationPlayState;
      area.setAttribute('data-rhythm-effect','MINIMAL');out.climaxMinimal=getComputedStyle(climax).display;
      area.remove();
      return out;
    });
    check('既定は2つとも OFF',got.defaults.every(v=>v===false),JSON.stringify(got.defaults));
    check('保存値に無い・壊れているときは OFF、true はそのまま',JSON.stringify(got.normalized)===JSON.stringify([false,false,false,false,true,true]),JSON.stringify(got.normalized));
    check('おまかせ: 「華やか」「全部のせ」だけ盛り上がりの光を点ける',JSON.stringify(got.presets)===JSON.stringify({LIGHT:false,STANDARD:false,VIVID:true,FULL:true}),JSON.stringify(got.presets));
    check('重いときの自動調整で盛り上がりの光が消える',got.capped===false);
    check('区間の中では強さが出る',got.inside===got.strength&&got.inside>0,`${got.inside}`);
    check('区間の外・知らない曲・壊れた時刻では 0',got.outside.every(v=>v===0),JSON.stringify(got.outside));
    check('MISS では叩いた場所の判定を出さない',got.miss===false);
    check('叩いた場所の判定は8個を使い回す(DOM が増えない)',got.pool===8&&got.layers===1,`${got.pool}個・器${got.layers}`);
    check('判定の文字と FAST / SLOW が入る',got.lastText[0]==='MARVELOUS'&&got.lastText[1]===''&&got.marvSide==='FAST',JSON.stringify([got.lastText,got.marvSide]));
    check('叩いた場所の判定の CSS が効いている(重ねて置く・指を邪魔しない)',got.tapCss[0]==='absolute'&&got.tapCss[1]==='none',got.tapCss.join(','));
    check('道のもやの CSS が効いている',got.hazeCss==='absolute',got.hazeCss);
    check('盛り上がりの光の CSS が効いている(流れる)',got.climaxCss[0]==='absolute'&&got.climaxCss[1]==='mhRhythmClimaxStreak'&&got.climaxCss[2]==='running',got.climaxCss.join(','));
    check('消えているあいだは流れを止める',got.climaxPaused==='paused',got.climaxPaused);
    check('演出量「最小」では盛り上がりの光を出さない',got.climaxMinimal==='none',got.climaxMinimal);
    check('ページでエラーが起きていない',!errors.length,errors.join(' / ').slice(0,300));
  }catch(e){check('本体を開ける',false,String(e&&e.message||e).split('\n')[0]);}
  finally{await browser.close();server.close();}
  finish();
})();
function finish(){console.log(failures?`\n${failures}件のNGがあります`:'\nすべてOK');process.exit(failures?1:0);}
