// ライブ背景を WebGL で描く部品(rhythmCreateStageGL・monster-hero/src/parts/30-rhythm-play.jsx)を見張る。
//
//   node tools/mode/rhythm-stage-gl-check.js
//
// 描き込み先が作れないと(シェーダの読み込みに失敗すると)、演奏画面は黙って CSS 版へ戻る。
// 見た目は「派手」のままなので、壊れても誰も気づかない(2026-09-27、「ライブ」を足したとき実際に一度そうなった)。
// ・シェーダが読み込めて描き込み先が作れるか
// ・「派手」と「ライブ」がどちらも絵を描くか。「ライブ」はレーザー・ペンライトのぶん明るい画素が増えるか
// ・拍の頭(pulse=1)は、拍の間(pulse=0)より明るいか
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=9174;
const SRC=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');

let failures=0;
const check=(label,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};

// 背景の決まりごと(RHYTHM_STAGE_BEAM_COLORS)から、描き込み先を作る関数の終わりまでを切り出す(JSX を含まない範囲)
const from=SRC.indexOf('const RHYTHM_STAGE_BEAM_COLORS='),makeAt=SRC.indexOf('const rhythmCreateStageGL='),to=makeAt<0?-1:SRC.indexOf('\n};\n',makeAt);
check('背景の部品を本体から切り出せる',from>=0&&makeAt>from&&to>makeAt);
const PARTS=from>=0&&to>0?SRC.slice(from,to+4):'';
const PAGE=`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script>${PARTS}\nwindow.__stage={rhythmCreateStageGL,RHYTHM_STAGE_GL_FS};</script>`;

(async()=>{
  if(!PARTS){console.log(`\n${failures}件のNGがあります`);process.exit(1);}
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(0);}}
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(PAGE);});
  await new Promise(r=>server.listen(PORT,r));
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:700},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'load'});
    const result=await page.evaluate(()=>{
      const {rhythmCreateStageGL,RHYTHM_STAGE_GL_FS}=window.__stage;
      // シェーダの読み込みの結果(失敗したときの中身を報告に出す)
      const probe=document.createElement('canvas').getContext('webgl');
      let log='no-webgl';
      if(probe){const sh=probe.createShader(probe.FRAGMENT_SHADER);probe.shaderSource(sh,RHYTHM_STAGE_GL_FS);probe.compileShader(sh);log=probe.getShaderParameter(sh,probe.COMPILE_STATUS)?'':String(probe.getShaderInfoLog(sh)||'?');}
      // 描いた直後(同じ処理の中)に 2D へ写して、明るい画素を数える
      const shot=(opts)=>{
        const c=document.createElement('canvas'),r=rhythmCreateStageGL(c);if(!r)return null;
        r.draw({w:390,h:700,scale:1,timeMs:1234,artA:0,fx:true,tier:0,...opts});
        const p=document.createElement('canvas');p.width=390;p.height=700;const g=p.getContext('2d');g.drawImage(c,0,0);
        const d=g.getImageData(0,0,390,700).data;let lit=0,sum=0;for(let i=0;i<d.length;i+=4){const v=d[i]+d[i+1]+d[i+2];sum+=v;if(v>150)lit++;}
        r.release();return {lit,sum};
      };
      return {log,made:!!rhythmCreateStageGL(document.createElement('canvas')),vivid:shot({}),live:shot({live:{beats:8,bar:4,pulse:0}}),livePulse:shot({live:{beats:8,bar:4,pulse:1}})};
    });
    check('背景のシェーダが読み込める',result.log==='',result.log.slice(0,300));
    check('描き込み先が作れる',result.made);
    check('「派手」が絵を描く',!!result.vivid&&result.vivid.sum>0,result.vivid?`明るい画素 ${result.vivid.lit}`:'描けない');
    check('「ライブ」はレーザー・ペンライトのぶん明るい画素が増える',!!result.live&&!!result.vivid&&result.live.lit>result.vivid.lit+500,result.live?`派手 ${result.vivid&&result.vivid.lit} → ライブ ${result.live.lit}`:'描けない');
    check('拍の頭は拍の間より明るい',!!result.livePulse&&!!result.live&&result.livePulse.sum>result.live.sum*1.02,result.livePulse?`拍の間 ${result.live&&result.live.sum} → 拍の頭 ${result.livePulse.sum}`:'描けない');
    check('ページでエラーが起きていない',!errors.length,errors.join(' / ').slice(0,300));
  }catch(e){check('実測できる',false,String(e&&e.message||e));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failures?`\n${failures}件のNGがあります`:'\nすべてOK');
  process.exit(failures?1:0);
})();
