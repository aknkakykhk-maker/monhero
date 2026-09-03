// 音ゲーの横画面HUD配置を実ブラウザで確かめる。
//
// 縦画面のHUD検査(rhythm-hud-wedge-check.js)と同じ考え方を、横画面(landscape)側でも行う。
// HUD(<header data-rhythm-hud>)はプレイエリアに重ねる絶対配置ではなく、プレイエリアの
// 外側・上に置く薄い帯にしている(2026-09-03、台形の外側ウェッジへHUD本文を押し込む
// 旧方式は、台形の上端をわざと狭くする必要があり「レーンが上まで見えない」原因になっていた)。
//   (1) HUDがプレイエリアに重ならない(構造的に上の帯である)こと
//   (2) 台形の最上部・中心ピクセルがHUDに覆われていないこと(縦画面と同じ大前提)
//   (3) HUDの高さが、main全体の高さの一定割合以下に収まっていること
//   (4) ポーズボタンは横画面でも44px未満に縮めていないこと(タップ精度を落とさない)
//   (5) 横画面ではプレイ画面自身が左右のSafe Area(ノッチ)ぶんを確保していること
//
// landscape: バリアントはTailwindの `@media (orientation: landscape)` そのものなので、
// ビューポートを横長にするだけでブラウザが実際に適用する(縦画面用のCSSシムを横流用できない
// 理由はここにある。縦画面の検査はビューポートが常に縦長なのでlandscape:は一切発火しない)。
//
//   node tools/mode/rhythm-landscape-hud-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(ROOT,'tools/node_modules/playwright'));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 縦画面検査と同じ前提の確認 ────────────────────────────────────────────────
// isLandscapeは曲名の折り返し行数(WebkitLineClamp)だけで使う。見た目だけの分岐で、
// run・audio・スコア・コンボ・判定そのものには一切触れない。
check('向き判定(isLandscape)の宣言がある',
  /const \[isLandscape,setIsLandscape\]=useState/.test(game));
const sliceBetween=(startNeedle,endNeedle)=>{
  const start=game.indexOf(startNeedle);
  if(start<0)return '';
  const end=game.indexOf(endNeedle,start+startNeedle.length);
  return end<0?'':game.slice(start,end);
};
const applyJudgmentBody=sliceBetween('const applyJudgment=useCallback(','const finish=useCallback(');
const beginRunBody=sliceBetween('const beginRun=async startBestValue=>{','const pause=()=>{');
check('applyJudgmentとbeginRunの本体を抽出できる',!!applyJudgmentBody&&!!beginRunBody);
check('向き判定はmatchMediaの購読で、判定処理(applyJudgment)とrun開始処理(beginRun)には一切出てこない',
  /window\.matchMedia\('\(orientation: landscape\)'\)/.test(game)
  &&!/isLandscape/.test(applyJudgmentBody)
  &&!/isLandscape/.test(beginRunBody));
check('横画面ではプレイ画面自身が左右のSafe Area(ノッチ)を確保する(bodyは上下しか確保していない)',
  /data-rhythm-tap-test[\s\S]{0,400}landscape:pl-\[env\(safe-area-inset-left\)\]/.test(game)
  &&/data-rhythm-tap-test[\s\S]{0,400}landscape:pr-\[env\(safe-area-inset-right\)\]/.test(game));
check('HUD(<header>)はプレイエリアへ重ねる絶対配置になっていない(通常のflowで上の帯を占める)',
  !/<header data-rhythm-hud className="[^"]*\babsolute\b/.test(game));

// ── HUDのJSXを取り出してHTMLへ写す(rhythm-hud-wedge-check.jsと同じ変換) ─────────
const headerStart=game.indexOf('<header data-rhythm-hud');
const headerEnd=game.indexOf('</header>',headerStart)+'</header>'.length;
check('プレイ画面のHUDを取り出せる',headerStart>0);
const headerJsx=game.slice(headerStart,headerEnd);

const LAYOUT_STYLE_PROPS=new Set(['fontSize','paddingTop','lineHeight','display','WebkitLineClamp','WebkitBoxOrient','overflow']);
const kebab=name=>name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`);
const inlineStyle=body=>{
  const kept=[];
  if(/textShadow:/.test(body))kept.push('text-shadow:0 1px 4px rgba(0,0,0,.9)');
  for(const m of body.matchAll(/([A-Za-z]+):'([^']*)'/g)){
    if(!LAYOUT_STYLE_PROPS.has(m[1]))continue;
    const before=body.slice(0,m.index).trimEnd();
    if(/[?:]$/.test(before))continue;
    kept.push(`${kebab(m[1])}:${m[2]}`);
  }
  return kept.length?` style="${kept.join(';')}"`:'';
};
// isLandscape?'1':'2' のような三項はinlineStyle側で拾えない(条件式なので前段のガードで落ちる)。
// 横画面検査では1行折り返しを見たいので、先に固定値へ置き換えてから変換する。
const headerJsxLandscape=headerJsx.replace(/WebkitLineClamp:isLandscape\?'1':'2'/,"WebkitLineClamp:'1'");
const SAMPLE={difficulty:'MASTER',song:'テスト楽曲テスト楽曲テスト',score:'1,000,000',best:'BEST 1,000,000',combo:'9999',life:'1000',rank:'SS'};
const headerHtml=headerJsxLandscape
  .replace(/\sstyle=\{\{((?:[^{}]|\{[^{}]*\})*)\}\}/g,(_,body)=>inlineStyle(body))
  .replace(/\sref=\{[^}]*\}/g,'')
  .replace(/\son[A-Z][A-Za-z]*=\{[^}]*\}/g,'')
  .replace(/className=\{`([^`]*)`\}/g,(_,body)=>`class="${body.replace(/\$\{RHYTHM_RANK_COLORS\[[^\]]*\]\}/g,'text-fuchsia-200')}"`)
  .replace(/className=/g,'class=')
  .replace(/\{difficulty\.id\}/g,SAMPLE.difficulty)
  .replace(/\{song\.displayName\}/g,SAMPLE.song)
  .replace(/\{view\.score\.toLocaleString\(\)\}/g,SAMPLE.score)
  .replace(/BEST \{Number\(bestRecord\?\.bestScore\|\|0\)\.toLocaleString\(\)\}/g,SAMPLE.best)
  .replace(/\{view\.combo\}/g,SAMPLE.combo)
  .replace(/\{view\.life\}/g,SAMPLE.life)
  .replace(/\{rhythmRankForScore\(view\.score\)\}/g,SAMPLE.rank)
  .replace(/\{hasHold\?'HOLD TEST':'TAP TEST'\}/g,'HOLD TEST')
  .replace(/<i ([^>]*?)\/>/g,'<i $1></i>')
  .replace(/<b ([^>]*?)\/>/g,'<b $1></b>')
  .replace(/data-rhythm-([a-z-]+)(?=[\s>])/g,'data-rhythm-$1=""');
check('HUDに未変換のJSX式が残っていない',!/\{|\}/.test(headerHtml),headerHtml.match(/\{[^"]{0,40}/)?.[0]||'');

// ── 使われている utility を手書きCSSへ写す(知らないものは失敗させる) ───────────
const PALETTE={
  'white':'#ffffff','slate-200':'#e2e8f0','slate-300':'#cbd5e1','slate-400':'#94a3b8',
  'slate-100':'#f1f5f9','slate-900':'#0f172a','slate-950':'#020617','cyan-200':'#a5f3fc','cyan-300':'#67e8f9','emerald-200':'#a7f3d0',
  'fuchsia-200':'#f5d0fe','fuchsia-300':'#f0abfc','fuchsia-700':'#a21caf','amber-200':'#fde68a','rose-400':'#fb7185',
};
const SPACE={'0':'0px','0.5':'2px','1':'4px','1.5':'6px','2':'8px','3':'12px','7':'28px','8':'32px','12':'48px','14':'56px','16':'64px','20':'80px'};
const STATIC={
  'absolute':'position:absolute','relative':'position:relative','block':'display:block','flex':'display:flex',
  'inline-block':'display:inline-block',
  'flex-col':'flex-direction:column','flex-row':'flex-direction:row','flex-nowrap':'flex-wrap:nowrap',
  'shrink-0':'flex-shrink:0','shrink':'flex-shrink:1','flex-1':'flex:1 1 0%','basis-full':'flex-basis:100%',
  'min-w-0':'min-width:0','max-w-none':'max-width:none','w-auto':'width:auto',
  'items-center':'align-items:center','items-start':'align-items:flex-start','items-end':'align-items:end','items-baseline':'align-items:baseline',
  'flex-wrap':'flex-wrap:wrap','justify-end':'justify-content:flex-end',
  'justify-between':'justify-content:space-between','justify-center':'justify-content:center','text-left':'text-align:left','text-right':'text-align:right',
  'font-black':'font-weight:900','font-bold':'font-weight:700','leading-none':'line-height:1','leading-tight':'line-height:1.25',
  'tabular-nums':'font-variant-numeric:tabular-nums','truncate':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
  'rounded':'border-radius:4px','rounded-full':'border-radius:9999px','rounded-xl':'border-radius:12px',
  'border':'border-width:1px;border-style:solid','border-2':'border-width:2px','border-current':'border-color:currentColor',
  'inset-x-0':'left:0;right:0','inset-y-0':'top:0;bottom:0',
  'top-0':'top:0','left-0':'left:0','overflow-hidden':'overflow:hidden','w-full':'width:100%',
  'pointer-events-none':'pointer-events:none','pointer-events-auto':'pointer-events:auto','hidden':'display:none',
};
const cssFor=token=>{
  if(STATIC[token])return STATIC[token];
  if(/^z-\d+$/.test(token))return `z-index:${token.slice(2)}`;
  if(/^shadow-\[/.test(token))return '';
  if(/^bg-gradient-to-[a-z]+$/.test(token))return '';
  if(/^(from|to)-[a-z]+-\d{2,3}$/.test(token))return '';
  if(/^bg-slate-950\/80$/.test(token))return 'background-color:rgba(2,6,23,.8)';
  if(/^bg-slate-950\/85$/.test(token))return 'background-color:rgba(2,6,23,.85)';
  if(/^bg-slate-900\/90$/.test(token))return 'background-color:rgba(15,23,42,.9)';
  if(/^bg-fuchsia-700\/85$/.test(token))return 'background-color:rgba(162,28,175,.85)';
  if(/^border-white\/(\d+)$/.test(token)){const m=/^border-white\/(\d+)$/.exec(token);return `border-color:rgba(255,255,255,${Number(m[1])/100})`;}
  const size=value=>value.startsWith('[')?value.slice(1,-1).replace(/_/g,' '):SPACE[value];
  let m;
  if((m=/^(p|px|py|pt|pb|m|mt|mb|ml|mr|mx|gap-x|gap-y|gap|w|h|min-h|min-w|max-w)-(.+)$/.exec(token))){
    const value=size(m[2]);
    if(!value)return null;
    const props={p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],
      m:['margin'],mt:['margin-top'],mb:['margin-bottom'],ml:['margin-left'],mr:['margin-right'],mx:['margin-left','margin-right'],
      gap:['gap'],'gap-x':['column-gap'],'gap-y':['row-gap'],
      w:['width'],h:['height'],'min-h':['min-height'],'min-w':['min-width'],'max-w':['max-width']}[m[1]];
    return props.map(prop=>`${prop}:${value}`).join(';');
  }
  if((m=/^max-w-\[(\d+)(vw|%)\]$/.exec(token)))return `max-width:${m[1]}${m[2]}`;
  if((m=/^w-\[(\d+)(vw|%)\]$/.exec(token)))return `width:${m[1]}${m[2]}`;
  if((m=/^min-h-\[(\d+)px\]$/.exec(token)))return `min-height:${m[1]}px`;
  if((m=/^min-w-\[(\d+)px\]$/.exec(token)))return `min-width:${m[1]}px`;
  if((m=/^text-\[(\d+)px\]$/.exec(token)))return `font-size:${m[1]}px`;
  if((m=/^text-(xs|sm|base|lg|xl|2xl)$/.exec(token)))return `font-size:${{xs:'12px',sm:'14px',base:'16px',lg:'18px',xl:'20px','2xl':'24px'}[m[1]]}`;
  if((m=/^tracking-\[([^\]]+)\]$/.exec(token)))return `letter-spacing:${m[1]}`;
  if((m=/^(text|bg|border)-([a-z]+-\d{2,3}|white)$/.exec(token))){
    const hex=PALETTE[m[2]];
    if(!hex)return null;
    return {text:'color',bg:'background-color',border:'border-color'}[m[1]]+`:${hex}`;
  }
  return null;
};
const LANDSCAPE_PREFIX='landscape:';
const baseOf=token=>token.startsWith(LANDSCAPE_PREFIX)?token.slice(LANDSCAPE_PREFIX.length):token;
const tokens=[...new Set([...headerHtml.matchAll(/class="([^"]*)"/g)].flatMap(m=>m[1].split(/\s+/)).filter(Boolean))];
const unknown=tokens.filter(token=>cssFor(baseOf(token))===null);
check('HUDのクラスはすべてこの検査のCSSへ写せる',unknown.length===0,unknown.join(' '));
const utilityCss=tokens.map(token=>{
  const escaped=token.replace(/[^A-Za-z0-9_-]/g,c=>'\\'+c);
  const rule=`.${escaped}{${cssFor(baseOf(token))}}`;
  return token.startsWith(LANDSCAPE_PREFIX)?`@media (orientation: landscape){${rule}}`:rule;
}).join('\n');

const LANE_BG='#152033';
// 横画面は上下のSafe Areaが小さく(ホームインジケーターぶんだけ)、代わりに左右へノッチが来る。
// どちら側に来るかは回転方向で変わるため、ここでは大きい方(59px相当)を両側へ与えて
// 「左右どちらにノッチが来ても崩れない」ことを固定する(実機確認前の安全側の近似値)。
const SAFE_TOP=0,SAFE_BOTTOM=21,SAFE_SIDE=59;
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;border:0 solid transparent}
html{height:100%}
body{height:100%;padding:${SAFE_TOP}px ${SAFE_SIDE}px ${SAFE_BOTTOM}px ${SAFE_SIDE}px;display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#020617;color:#fff}
main{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden}
[data-rhythm-play-area]{position:relative;margin:0 8px 8px;flex:1 1 0%;min-height:0;overflow:hidden;background:${LANE_BG}}
${utilityCss}
</style></head><body><main>${headerHtml}<div data-rhythm-play-area=""></div></main></body></html>`;

const SIZES=[
  {name:'iPhone横      844x390',width:844,height:390},
  {name:'大きい端末横  926x428',width:926,height:428},
  {name:'小さい端末横  667x375',width:667,height:375},
];
// 横画面は縦幅の余裕が少ないため、HUDの帯はさらに明確に小さくする。
const HUD_LANDSCAPE_LIMIT_RATIO=.22;

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for(const size of SIZES){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.setContent(PAGE);
    const measured=await page.evaluate(()=>{
      const toPlain=r=>r&&({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height});
      const main=document.querySelector('main').getBoundingClientRect();
      const header=document.querySelector('[data-rhythm-hud]').getBoundingClientRect();
      const play=document.querySelector('[data-rhythm-play-area]').getBoundingClientRect();
      const pause=document.querySelector('[data-rhythm-pause]')?.getBoundingClientRect();
      return {
        main:toPlain(main),
        header:toPlain(header),
        play:toPlain(play),
        pause:toPlain(pause),
        apexColor:(()=>{
          const cx=Math.round((play.left+play.right)/2);
          const cy=Math.round(play.top+1);
          const el=document.elementFromPoint(cx,cy);
          return el?getComputedStyle(el).backgroundColor:null;
        })(),
      };
    });
    console.log(`— ${size.name}`);
    check(`  JSエラーが出ない`,errors.length===0,errors[0]||'');
    check(`  HUDはプレイエリアより上にあり、重ならない`,
      measured.header.bottom<=measured.play.top+.5,
      `header.bottom=${measured.header.bottom.toFixed(1)}px, play.top=${measured.play.top.toFixed(1)}px`);
    check(`  台形の頂点(最上部中心)はHUDに覆われずレーンの背景のまま`,
      measured.apexColor==='rgb(21, 32, 51)',`実際の色=${measured.apexColor}`);
    check(`  ポーズボタンは横画面でも44px未満に縮めていない`,
      measured.pause&&measured.pause.width>=44&&measured.pause.height>=44,
      measured.pause?`${measured.pause.width.toFixed(1)}x${measured.pause.height.toFixed(1)}px`:'見つからない');
    const mainHeight=measured.main.bottom-measured.main.top;
    const headerHeight=measured.header.bottom-measured.header.top;
    const heightRatio=headerHeight/mainHeight;
    check(`  HUDの帯は横画面のmain全体の高さの${Math.round(HUD_LANDSCAPE_LIMIT_RATIO*100)}%以内に収まる`,
      heightRatio<=HUD_LANDSCAPE_LIMIT_RATIO,`${(heightRatio*100).toFixed(1)}%`);
    await page.close();
  }
  await browser.close();
  console.log(failed===0?'\nすべてのチェックを通過しました。':`\n${failed}件のチェックに失敗しました。`);
  process.exit(failed===0?0:1);
})();
