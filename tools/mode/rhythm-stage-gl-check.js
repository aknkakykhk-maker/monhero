// ライブ背景を WebGL で描く部品(rhythmCreateStageGL・monster-hero/src/parts/30-rhythm-play.jsx)を見張る。
//
//   node tools/mode/rhythm-stage-gl-check.js
//
// 描き込み先が作れないと(シェーダの読み込みに失敗すると)、演奏画面は黙って CSS 版へ戻る。
// 見た目は「派手」のままなので、壊れても誰も気づかない(2026-09-27、「ライブ」を足したとき実際に一度そうなった)。
// ・シェーダが読み込めて描き込み先が作れるか
// ・「派手」と「ライブ」がどちらも絵を描くか。「ライブ」はレーザー・ペンライトのぶん明るい画素が増えるか
// ・拍の頭(pulse=1)は、拍の間(pulse=0)より明るいか
// ・レーザーとペンライトの「離れた画素で計算を打ち切る」「ペンライトの無い上の帯は色みだけ塗る」(2026-09-27・軽くするため)を外した版と、描いた色が同じか。
//   打ち切るのは明るさが 1/255 の1万分の1に届かない画素だけなので、色は変わらないはず。打ち切りの線を広げすぎると、ここで分かる
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=9174;
const SRC=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');

let failures=0;
const check=(label,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};

// 背景の決まりごと(RHYTHM_STAGE_BEAM_COLORS)から、描き込み先を作る関数の終わりまでを切り出す(JSX を含まない範囲)
const from=SRC.indexOf('const RHYTHM_STAGE_BEAM_COLORS='),makeAt=SRC.indexOf('const rhythmCreateStageGL='),to=makeAt<0?-1:SRC.indexOf('\n};\n',makeAt);
check('背景の部品を本体から切り出せる',from>=0&&makeAt>from&&to>makeAt);
const PARTS=from>=0&&to>0?SRC.slice(from,to+4):'';
// 軽くするための工夫(2026-09-27)。外した版(=工夫の前と同じ描き方)を作って描き比べる
//   ・打ち切りの行(シェーダーの中)は消す
//   ・ペンライトの上の帯分けは、上の帯の行数を0にする(画面全体をペンライトの処理で1回描く、もとの形になる)
const SKIPS=['if(perp*perp>480.)continue;','if(d>9.)continue;'];
const BAND='const top=Math.max(0,Math.min(ph,Math.floor(.16*ph-.5)));';
check('レーザー・ペンライトの打ち切りと、ペンライトの上の帯分けが入っている',[...SKIPS,BAND].every(x=>PARTS.includes(x)),[...SKIPS,BAND].filter(x=>!PARTS.includes(x)).join(' / '));
const PARTS_REF=SKIPS.reduce((t,x)=>t.split(x).join(''),PARTS).split(BAND).join('const top=0;');
// 同じ名前の定数を2組読むので、それぞれ関数の中に閉じ込める
const PAGE=`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><script>window.__stage=(()=>{${PARTS}\nreturn {rhythmCreateStageGL,RHYTHM_STAGE_GL_FS};})();
window.__stageRef=(()=>{${PARTS_REF}\nreturn {rhythmCreateStageGL};})();</script>`;

// 演出の段階(ライブ→華やか→おだやか)が変わっても、背景の WebGL を作り直さない(2026-09-27)。
// 「重いときは演出を自動で控えめに」が働いた瞬間に、シェーダーの組み立てをやり直させないため。
// 段階ごとに違う絵の濃さ・拍の扱いは、毎回の描画で stageGlLiveRef から読む
{
  const canvasKey=(SRC.match(/<canvas key=\{`(stage-gl-[^`]*)`\} ref=\{stageGlRef\}/)||[])[1]||'';
  check('背景の canvas は演出の段階が変わっても作り直さない(key に段階を入れない)',!!canvasKey&&!canvasKey.includes('stageLevel'),canvasKey);
  const effectAt=SRC.indexOf('const renderer=rhythmCreateStageGL(canvas);');
  const deps=effectAt<0?'':(SRC.slice(effectAt).match(/\n  \},\[([^\]]*)\]\);/)||[])[1]||'';
  check('背景を動かす処理も演出の段階で作り直さない(依存に段階を入れない)',!!deps&&!/\bstageLevel\b/.test(deps),deps);
  check('絵の濃さは毎回の描画で読む',/stageGlLiveRef\.current=\{[^}]*art:stageLevel==='CALM'\?\.34:\.5/.test(SRC)&&SRC.includes('const fullArt=Number(live.art)||.5;'));
}

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
      // 打ち切りを外した版と描き比べる(画素密度1.5・いくつかの時刻・拍・色の段で)
      const pixels=(make,opts)=>{const c=document.createElement('canvas'),r=make(c);if(!r)return null;
        r.draw({w:390,h:700,scale:1.5,artA:0,fx:true,...opts});
        // GPU が出した値(透明度を掛けたまま)を直接読む。2D へ写すと透明度で割り戻され、1段の差が2〜3段にふくらむ
        const gl=c.getContext('webgl')||c.getContext('experimental-webgl');const d=new Uint8Array(c.width*c.height*4);
        gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,d);r.release();return d;};
      let same={frames:0,maxDiff:0,diffPixels:0,pixels:0};
      for(const [timeMs,beats,pulse,tier] of [[1234,8,0,0],[5210,13.4,.7,1],[9876,21.9,1,2],[15000,33.25,.3,3]]){
        const opts={timeMs,tier,live:{beats,bar:4,pulse}};
        const a=pixels(rhythmCreateStageGL,opts),b=pixels(window.__stageRef.rhythmCreateStageGL,opts);if(!a||!b)continue;
        same.frames++;same.pixels+=a.length/4;
        for(let i=0;i<a.length;i+=4){const m=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]));if(m>0)same.diffPixels++;if(m>same.maxDiff)same.maxDiff=m;}
      }
      return {log,made:!!rhythmCreateStageGL(document.createElement('canvas')),vivid:shot({}),live:shot({live:{beats:8,bar:4,pulse:0}}),livePulse:shot({live:{beats:8,bar:4,pulse:1}}),same};
    });
    check('背景のシェーダが読み込める',result.log==='',result.log.slice(0,300));
    check('描き込み先が作れる',result.made);
    check('「派手」が絵を描く',!!result.vivid&&result.vivid.sum>0,result.vivid?`明るい画素 ${result.vivid.lit}`:'描けない');
    check('「ライブ」はレーザー・ペンライトのぶん明るい画素が増える',!!result.live&&!!result.vivid&&result.live.lit>result.vivid.lit+500,result.live?`派手 ${result.vivid&&result.vivid.lit} → ライブ ${result.live.lit}`:'描けない');
    check('拍の頭は拍の間より明るい',!!result.livePulse&&!!result.live&&result.livePulse.sum>result.live.sum*1.02,result.livePulse?`拍の間 ${result.live&&result.live.sum} → 拍の頭 ${result.livePulse.sum}`:'描けない');
    // 足されなくなる明るさはごく小さい(1/255 の1万分の1未満)が、四捨五入のちょうど境目に乗った画素は1段動くことがある
    // (打ち切りの線を極端に遠くすると0になることで確かめた)。差は1段まで・画素の0.1%未満までを「同じ」とする
    check('軽くする工夫を外した版と描いた色が同じ(ライブ・4場面)',result.same.frames===4&&result.same.maxDiff<=1&&result.same.diffPixels<result.same.pixels*.001,
      `${result.same.frames}場面・いちばん大きい差 ${result.same.maxDiff}段・違う画素 ${result.same.diffPixels}/${result.same.pixels}`);
    check('ページでエラーが起きていない',!errors.length,errors.join(' / ').slice(0,300));
  }catch(e){check('実測できる',false,String(e&&e.message||e));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failures?`\n${failures}件のNGがあります`:'\nすべてOK');
  process.exit(failures?1:0);
})();
