// 音ゲーのプレイ画面で、HUD(スコア・コンボ・ライフ)がレーンの縦を食っていないかを実測する。
//
// もともとHUDは画面上部の独立した横帯(header shrink-0)だった。そのぶんレーンは
// 画面の高さから135pxを引いた分しか使えず、設計図の「レーンが画面いっぱいを使う」形から離れていた。
// そこでHUDをプレイエリアへ重ねる絶対配置へ変えた。ただし重ねた以上は
//   ・HUDがレイアウトの高さを一切取らない(取ると重ねた意味がない)
//   ・スコア・コンボがレーンの台形(遠近)へかぶらない
//   ・HUDの下端が判定ラインの側まで伸びてこない
// を守る必要がある。ここはそれを実際のブラウザで測る。
//
// Tailwindはこのサンドボックスから読めないので、JSXのHUDから class を取り出し、
// 使われている utility を手書きのCSSへ写して測る。**知らない utility が出てきたら失敗させる**ので、
// HUDへ新しいクラスを足したらこのファイルも一緒に更新することになる(黙って古いCSSで測る事故を防ぐ)。
//
//   node tools/mode/rhythm-hud-overlay-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(ROOT,'tools/node_modules/playwright'));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');
const rhythm=read('monster-hero/data/rhythm-mode.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── レーンの台形(遠近)は実装から取り出してそのまま使う ──────────────────────────
const projectionSource=[
  rhythm.match(/const RHYTHM_LANE_COUNT\s*=[^\n]*/)[0],
  rhythm.match(/const RHYTHM_PROJECTION_TOP_SCALE=[^\n]*/)[0],
  rhythm.match(/const rhythmClamp01=[^\n]*/)[0],
  rhythm.match(/const rhythmProjectionScale=[^\n]*/)[0],
].join('\n');
const rhythmProjectionScale=new Function(`${projectionSource}\nreturn rhythmProjectionScale;`)();

// ── HUDのJSXを取り出してHTMLへ写す ──────────────────────────────────────────
const headerStart=game.indexOf('<header data-rhythm-hud');
const headerEnd=game.indexOf('</header>',headerStart)+'</header>'.length;
check('プレイ画面のHUDを取り出せる',headerStart>0);
const headerJsx=game.slice(headerStart,headerEnd);

// 見た目の色・影は位置に影響しないので落とし、位置に効く style と class だけを見る。
// env(safe-area-inset-top) はこのブラウザでは0に解決されるので、実機の余白ぶんは差し引いた形で測る。
const SAMPLE={difficulty:'MASTER',song:'テスト楽曲テスト楽曲',score:'1,000,000',best:'BEST 1,000,000',combo:'9999',life:'1000',rank:'SS'};
// style属性のうち、位置・大きさに効くものだけは残す(色や影は測定へ影響しないので捨てる)。
// 条件式(?:)やテンプレート式を含む値は測れないので落とす。
const LAYOUT_STYLE_PROPS=new Set(['fontSize','lineHeight','letterSpacing','paddingTop','paddingBottom','paddingLeft','paddingRight',
  'marginTop','marginBottom','marginLeft','marginRight','width','height','minWidth','minHeight','maxWidth','maxHeight','top','bottom','left','right']);
const kebab=name=>name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`);
const inlineStyle=body=>{
  const kept=[];
  for(const m of body.matchAll(/([A-Za-z]+):'([^']*)'/g)){
    if(!LAYOUT_STYLE_PROPS.has(m[1]))continue;
    // 直前が「?」「:」なら条件式の一部なので測れない
    const before=body.slice(0,m.index).trimEnd();
    if(/[?:]$/.test(before))continue;
    kept.push(`${kebab(m[1])}:${m[2]}`);
  }
  return kept.length?` style="${kept.join(';')}"`:'';
};
const headerHtml=headerJsx
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
  .replace(/\{hasHold\?'HOLD':'TAP'\}/g,'HOLD')
  .replace(/<i ([^>]*?)\/>/g,'<i $1></i>')
  .replace(/data-rhythm-([a-z-]+)(?=[\s>])/g,'data-rhythm-$1=""');
check('HUDに未変換のJSX式が残っていない',!/\{|\}/.test(headerHtml),headerHtml.match(/\{[^"]{0,40}/)?.[0]||'');

// ── 使われている utility を手書きCSSへ写す(知らないものは失敗させる) ───────────
const PALETTE={
  'white':'#ffffff','slate-200':'#e2e8f0','slate-300':'#cbd5e1','slate-400':'#94a3b8','slate-500':'#64748b',
  'slate-900':'#0f172a','slate-950':'#020617','cyan-200':'#a5f3fc','cyan-300':'#67e8f9','emerald-200':'#a7f3d0',
  'fuchsia-200':'#f5d0fe','fuchsia-300':'#f0abfc','fuchsia-700':'#a21caf','lime-300':'#bef264','lime-400':'#a3e635',
  'amber-300':'#fcd34d','orange-300':'#fdba74','yellow-200':'#fef08a',
};
const SPACE={'0':'0px','0.5':'2px','1':'4px','1.5':'6px','2':'8px','2.5':'10px','3':'12px','4':'16px','5':'20px','6':'24px','10':'40px','12':'48px'};
const FONT={'xs':'12px','sm':'14px','base':'16px','lg':'18px','xl':'20px','2xl':'24px','3xl':'30px'};
const STATIC={
  'absolute':'position:absolute','relative':'position:relative','block':'display:block','flex':'display:flex',
  'flex-col':'flex-direction:column','flex-1':'flex:1 1 0%','shrink-0':'flex-shrink:0','min-w-0':'min-width:0',
  'items-center':'align-items:center','items-start':'align-items:flex-start','items-end':'align-items:flex-end',
  'justify-between':'justify-content:space-between','justify-center':'justify-content:center',
  'overflow-hidden':'overflow:hidden','text-left':'text-align:left','text-right':'text-align:right',
  'font-black':'font-weight:900','font-bold':'font-weight:700','leading-none':'line-height:1',
  'tabular-nums':'font-variant-numeric:tabular-nums','truncate':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
  'rounded':'border-radius:4px','rounded-full':'border-radius:9999px','rounded-xl':'border-radius:12px',
  'border':'border-width:1px;border-style:solid','inset-x-0':'left:0;right:0','inset-y-0':'top:0;bottom:0',
  'top-0':'top:0','left-0':'left:0','ml-auto':'margin-left:auto','pointer-events-none':'pointer-events:none','pointer-events-auto':'pointer-events:auto',
};
const cssFor=token=>{
  if(STATIC[token])return STATIC[token];
  if(/^z-\d+$/.test(token))return `z-index:${token.slice(2)}`;
  if(/^shadow-\[/.test(token))return '';                       // 影は位置に影響しない
  const px=(prop,value)=>`${prop}:${value}`;
  const size=value=>value.startsWith('[')?value.slice(1,-1).replace(/_/g,' '):SPACE[value];
  let m;
  if((m=/^(p|px|py|pt|pb|m|mt|mb|mx|gap|w|h|min-h|min-w|max-w)-(.+)$/.exec(token))){
    const value=size(m[2]);
    if(!value)return null;
    const props={p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],
      m:['margin'],mt:['margin-top'],mb:['margin-bottom'],mx:['margin-left','margin-right'],gap:['gap'],
      w:['width'],h:['height'],'min-h':['min-height'],'min-w':['min-width'],'max-w':['max-width']}[m[1]];
    return props.map(prop=>px(prop,value)).join(';');
  }
  if((m=/^text-\[(\d+)px\]$/.exec(token)))return `font-size:${m[1]}px`;
  if((m=/^text-(xs|sm|base|lg|xl|2xl|3xl)$/.exec(token)))return `font-size:${FONT[m[1]]}`;
  if((m=/^tracking-\[([^\]]+)\]$/.exec(token)))return `letter-spacing:${m[1]}`;
  if((m=/^(text|bg|border)-([a-z]+-\d{2,3}|white)(?:\/(\d+))?$/.exec(token))){
    const hex=PALETTE[m[2]];
    if(!hex)return null;
    const value=m[3]?`${hex}${Math.round(Number(m[3])/100*255).toString(16).padStart(2,'0')}`:hex;
    return {text:'color',bg:'background-color',border:'border-color'}[m[1]]+`:${value}`;
  }
  return null;
};
const tokens=[...new Set([...headerHtml.matchAll(/class="([^"]*)"/g)].flatMap(m=>m[1].split(/\s+/)).filter(Boolean))];
const unknown=tokens.filter(token=>cssFor(token)===null);
check('HUDのクラスはすべてこの検査のCSSへ写せる',unknown.length===0,unknown.join(' '));
const utilityCss=tokens.map(token=>`.${token.replace(/[^A-Za-z0-9_-]/g,c=>'\\'+c)}{${cssFor(token)}}`).join('\n');

// 本物と同じ入れ子(main = HUDオーバーレイ + プレイエリア)
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;border:0 solid transparent}
html,body{height:100%}body{display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#020617;color:#fff}
main{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden}
[data-rhythm-hud]{background:linear-gradient(180deg,rgba(2,6,23,.94),rgba(2,6,23,0))}
[data-rhythm-play-area]{position:relative;margin:0 8px 8px;flex:1 1 0%;min-height:0;overflow:hidden}
${utilityCss}
</style></head><body><main>${headerHtml}<div data-rhythm-play-area=""></div></main></body></html>`;

const SIZES=[
  {name:'iPhone SE  375x667',width:375,height:667},
  {name:'小さい端末 320x568',width:320,height:568},
  {name:'ふつう     390x844',width:390,height:844},
  {name:'大きい端末 428x926',width:428,height:926},
];
// HUDの下端がここより下まで伸びると、判定側の見通しを削り始める
const HUD_BOTTOM_LIMIT_RATIO=.24;

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for(const size of SIZES){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.setContent(PAGE);
    const measured=await page.evaluate(()=>{
      // 枠(max-w)からはみ出した文字も拾いたいので、箱ではなく実際に描かれた文字の範囲で測る
      const inkRect=el=>{
        let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
        const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
        const boxes=[el.getBoundingClientRect()];
        for(let node=walker.nextNode();node;node=walker.nextNode()){
          if(!node.textContent.trim())continue;
          const range=document.createRange();range.selectNodeContents(node);
          boxes.push(...range.getClientRects());
        }
        boxes.forEach(box=>{
          if(!box.width&&!box.height)return;
          left=Math.min(left,box.left);right=Math.max(right,box.right);
          top=Math.min(top,box.top);bottom=Math.max(bottom,box.bottom);
        });
        return {left,right,top,bottom};
      };
      const rect=selector=>{const el=document.querySelector(selector);return el?inkRect(el):null;};
      const play=document.querySelector('[data-rhythm-play-area]').getBoundingClientRect();
      const hud=document.querySelector('[data-rhythm-hud]');
      // pb-5 は下へ薄く消えるためのぼかし分なので、文字の下端で測る
      const children=[...hud.children].map(el=>el.getBoundingClientRect().bottom);
      return {play:play.toJSON(),contentBottom:Math.max(...children),
        left:rect('[data-rhythm-hud-left]'),right:rect('[data-rhythm-hud-right]'),
        life:rect('[data-rhythm-life]'),title:rect('[data-rhythm-hud-title]')};
    });
    console.log(`— ${size.name}`);
    check(`  JSエラーが出ない`,errors.length===0,errors[0]||'');
    // 1. HUDはレイアウトの高さを取らない = プレイエリアが画面いっぱい(下marginの8pxだけ引く)
    check(`  レーンが画面の高さをそのまま使う`,Math.abs(measured.play.height-(size.height-8))<1,
      `プレイ=${measured.play.height.toFixed(1)}px / 画面=${size.height}px`);
    // 2. HUDの文字がレーンの台形へかぶらない
    const half=yRatio=>measured.play.width/2*rhythmProjectionScale(yRatio);
    const laneEdge=(top,bottom)=>{
      // 台形は下ほど広い。要素の下端の高さで測るのが最も厳しい。
      const ratio=Math.max(0,Math.min(1,(bottom-measured.play.top)/measured.play.height));
      const center=measured.play.left+measured.play.width/2;
      return {left:center-half(ratio),right:center+half(ratio),ratio};
    };
    for(const [label,box,side] of [['SCORE側',measured.left,'left'],['COMBO側',measured.right,'right']]){
      const edge=laneEdge(box.top,box.bottom);
      const ok=side==='left'?box.right<=edge.left+.5:box.left>=edge.right-.5;
      check(`  ${label}のHUDがレーンの台形へかぶらない`,ok,
        side==='left'?`右端=${box.right.toFixed(1)}px / 台形の左端=${edge.left.toFixed(1)}px`
          :`左端=${box.left.toFixed(1)}px / 台形の右端=${edge.right.toFixed(1)}px`);
    }
    // 3. HUDの下端が判定側まで伸びてこない
    const bottomRatio=(measured.contentBottom-measured.play.top)/measured.play.height;
    check(`  HUDの下端が画面上部${Math.round(HUD_BOTTOM_LIMIT_RATIO*100)}%以内に収まる`,bottomRatio<=HUD_BOTTOM_LIMIT_RATIO,
      `${(bottomRatio*100).toFixed(1)}%`);
    // 4. ライフ・曲名は横いっぱいだが、いちばん上の薄い帯に収まっている
    check(`  ライフと曲名は画面上部8%以内に収まる`,(measured.title.bottom-measured.play.top)/measured.play.height<=.08,
      `${(((measured.title.bottom-measured.play.top)/measured.play.height)*100).toFixed(1)}%`);
    await page.close();
  }
  await browser.close();
  console.log(failed===0?'\nすべてのチェックを通過しました。':`\n${failed}件のチェックに失敗しました。`);
  process.exit(failed===0?0:1);
})();
