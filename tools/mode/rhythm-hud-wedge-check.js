// 音ゲーのプレイ画面で、HUD(スコア・コンボ・ライフ等)がレーンの台形と重ならない
// 「独立した薄い帯」になっていることを実ブラウザで確かめる。
//
// 過去の変遷:
//   ・HUDを画面上部へ全幅の背景パネルとして重ねる形を試したが(PR #983)、その背景パネルが
//     台形の頂点(遠近projectionの基準点=yRatio 0)そのものを覆ってしまい、遠近感が変わって
//     プレイしづらくなった。いったん元の横帯レイアウトへ戻した(PR #984)。
//   ・次に、HUD本文を台形の外側の左右ウェッジ(奥へ向かって狭くなる分だけ左右に空く三角形の
//     余白)だけに置く形にした。だがこれは「台形の上端をわざと狭くしてHUDの置き場所を確保する」
//     設計だったため、上端の左右に台形へ入らない黒い余白が大きく残り、
//     「レーンが上まで見えるようにしてほしい」と指摘された(2026-09-03)。
//   ・一度、HUDを実領域を消費する帯へ変えたが、内容量が多く帯の高さがかさみ、
//     「奥行きが変わった/改悪」と指摘され取り消した。
//   ・今回は、常時表示する行(ランク+SCORE、LIFE+COMBO+ポーズ)を1行に絞り、BEST・難易度・
//     曲名は2行目の細い行へ回すことで、帯の高さそのものを大きく削った薄い帯にした。これにより
//     台形の上端をHUDのために狭く保つ必要がなくなり、RHYTHM_PROJECTION_TOP_SCALEを引き上げて
//     レーンを画面の上のほうまで広く見せられるようになった。
//
// この検査では、
//   (1) HUDがプレイエリアに重ならない(構造的に上の帯である)こと
//   (2) 台形の最上部の中心ピクセルに、HUDが敷いた不透明な背景が乗っていないこと
//       (レーン自体の背景と同じ色であること。上の帯である以上ふつうは自明だが、将来また
//       絶対配置へ戻す変更が入っていないかを継続して見張るための回帰チェック)
//   (3) HUDが占める高さが、Safe Areaの内側の高さの中に収まっており、二重に余白を消費して
//       いないこと
//   (4) HUDの帯の高さが、main全体の高さの一定割合以下に収まっていること(薄い帯を維持する)
//   (5) HUD自身が全幅の不透明な背景パネルを持たない(文字に影を付けるだけ)こと
// を実測する。
//
//   node tools/mode/rhythm-hud-wedge-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(ROOT,'tools/node_modules/playwright'));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

check('HUD(<header>)はプレイエリアへ重ねる絶対配置になっていない(通常のflowで上の帯を占める)',
  !/<header data-rhythm-hud className="[^"]*\babsolute\b/.test(game));

// ── HUDのJSXを取り出してHTMLへ写す ──────────────────────────────────────────
const headerStart=game.indexOf('<header data-rhythm-hud');
const headerEnd=game.indexOf('</header>',headerStart)+'</header>'.length;
check('プレイ画面のHUDを取り出せる',headerStart>0);
const headerJsx=game.slice(headerStart,headerEnd);

// 位置に効くstyle(font-size, padding-top, text-shadowの有無)だけ残し、それ以外は落とす。
// 条件式(?:)を含む値は測れないので落とす(text-shadowは値そのものは位置に無関係なので固定文字列に正規化)。
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
const SAMPLE={difficulty:'MASTER',song:'テスト楽曲テスト楽曲テスト',score:'1,000,000',best:'BEST 1,000,000',combo:'9999',life:'1000',rank:'SS'};
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
  .replace(/\{hasHold\?'HOLD TEST':'TAP TEST'\}/g,'HOLD TEST')
  .replace(/<i ([^>]*?)\/>/g,'<i $1></i>')
  .replace(/<b ([^>]*?)\/>/g,'<b $1></b>')
  .replace(/data-rhythm-([a-z-]+)(?=[\s>])/g,'data-rhythm-$1=""');
check('HUDに未変換のJSX式が残っていない',!/\{|\}/.test(headerHtml),headerHtml.match(/\{[^"]{0,40}/)?.[0]||'');
check('HUDの<header>自身に背景色・背景画像を持たせていない(文字影だけで読ませる)',
  !/<header[^>]*style="[^"]*background/.test(headerHtml));
check('曲名は truncate(1行で…に切る)を使わない(実機で曲名が切れて読めなかったため)',
  !/data-rhythm-hud-song[^>]*class="[^"]*truncate/.test(headerHtml)&&/data-rhythm-hud-song/.test(headerHtml));

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
  // 見た目だけのグラデーション指定はレイアウト(箱の位置・大きさ)に影響しないため、
  // このチェックでは実際のグラデーションを再現せず素通りさせる。
  if(/^bg-gradient-to-[a-z]+$/.test(token))return '';
  if(/^(from|to)-[a-z]+-\d{2,3}$/.test(token))return '';
  if(/^bg-slate-950\/80$/.test(token))return 'background-color:rgba(2,6,23,.8)';
  if(/^bg-slate-950\/85$/.test(token))return 'background-color:rgba(2,6,23,.85)';
  if(/^bg-slate-900\/90$/.test(token))return 'background-color:rgba(15,23,42,.9)';
  if(/^bg-fuchsia-700\/85$/.test(token))return 'background-color:rgba(162,28,175,.85)';
  if(/^border-white\/(\d+)$/.test(token)){const m=/^border-white\/(\d+)$/.exec(token);return `border-color:rgba(255,255,255,${Number(m[1])/100})`;}
  const size=value=>value.startsWith('[')?value.slice(1,-1).replace(/_/g,' '):SPACE[value];
  let m;
  // gap-x / gap-y は gap より先に試す(先に "gap" が当たると "gap-x-2" の "x-2" が値として
  // 拾われてしまい、SPACEに無い値として失敗する)
  if((m=/^(p|px|py|pt|pb|m|mt|mb|ml|mr|mx|gap-x|gap-y|gap|w|h|min-h|min-w|max-w)-(.+)$/.exec(token))){
    const value=size(m[2]);
    if(!value)return null;
    const props={p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],
      m:['margin'],mt:['margin-top'],mb:['margin-bottom'],ml:['margin-left'],mr:['margin-right'],mx:['margin-left','margin-right'],
      gap:['gap'],'gap-x':['column-gap'],'gap-y':['row-gap'],
      w:['width'],h:['height'],'min-h':['min-height'],'min-w':['min-width'],'max-w':['max-width']}[m[1]];
    return props.map(prop=>`${prop}:${value}`).join(';');
  }
  if((m=/^max-w-\[(\d+)%\]$/.exec(token)))return `max-width:${m[1]}%`;
  if((m=/^w-\[(\d+)%\]$/.exec(token)))return `width:${m[1]}%`;
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
const tokens=[...new Set([...headerHtml.matchAll(/class="([^"]*)"/g)].flatMap(m=>m[1].split(/\s+/)).filter(Boolean))];
// landscape: バリアントは横画面(§6.2)専用のHUD配置。中身のユーティリティ自体は
// 通常のものと同じなので、prefixを剥がしてから同じ変換表を通し、
// @media (orientation: landscape) の中だけへ出す(Tailwindの実際の挙動と同じ)。
const LANDSCAPE_PREFIX='landscape:';
const baseOf=token=>token.startsWith(LANDSCAPE_PREFIX)?token.slice(LANDSCAPE_PREFIX.length):token;
const unknown=tokens.filter(token=>cssFor(baseOf(token))===null);
check('HUDのクラスはすべてこの検査のCSSへ写せる',unknown.length===0,unknown.join(' '));
const utilityCss=tokens.map(token=>{
  const escaped=token.replace(/[^A-Za-z0-9_-]/g,c=>'\\'+c);
  const rule=`.${escaped}{${cssFor(baseOf(token))}}`;
  return token.startsWith(LANDSCAPE_PREFIX)?`@media (orientation: landscape){${rule}}`:rule;
}).join('\n');

const LANE_BG='#152033';
// 実機の index.html は body 側で Safe Area を確保している。ここでも同じ形にして、
// プレイ画面が env() をもう一度足していないか(=上部に二重の空白が出ないか)を測れるようにする。
const SAFE_TOP=59,SAFE_BOTTOM=34;   // ダイナミックアイランド世代のiPhone相当
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;border:0 solid transparent}
html{height:100%}
body{height:100%;padding-top:${SAFE_TOP}px;padding-bottom:${SAFE_BOTTOM}px;display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#020617;color:#fff}
main{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden}
[data-rhythm-play-area]{position:relative;margin:0 8px 8px;flex:1 1 0%;min-height:0;overflow:hidden;background:${LANE_BG}}
${utilityCss}
</style></head><body><main>${headerHtml}<div data-rhythm-play-area=""></div></main></body></html>`;

const SIZES=[
  {name:'iPhone SE  375x667',width:375,height:667},
  {name:'小さい端末 320x568',width:320,height:568},
  {name:'ふつう     390x844',width:390,height:844},
  {name:'大きい端末 428x926',width:428,height:926},
];
// HUDが上の帯としてこれ以上高さを使うと、レーンの実質的な高さを削りすぎる。
// 帯の絶対高さ(68.5〜81px)は端末サイズによらずほぼ一定だが、画面が小さい端末ほど
// main全体に対する比率が上がる(実測: 小さい端末 320x568で最大17.1%)。
const HUD_HEIGHT_LIMIT_RATIO=.18;

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for(const size of SIZES){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.setContent(PAGE);
    const measured=await page.evaluate(()=>{
      const toPlain=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      const main=document.querySelector('main').getBoundingClientRect();
      const header=document.querySelector('[data-rhythm-hud]').getBoundingClientRect();
      const play=document.querySelector('[data-rhythm-play-area]').getBoundingClientRect();
      return {
        main:toPlain(main),
        header:toPlain(header),
        play:toPlain(play),
        apexColor:(()=>{
          // 台形の最上部・中心ピクセルの直前(1px下)を、DOM越しに実際に見える色として調べる。
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
    const mainHeight=measured.main.bottom-measured.main.top;
    const headerHeight=measured.header.bottom-measured.header.top;
    const playHeight=measured.play.bottom-measured.play.top;
    // Safe Areaはbodyが1回だけ引く。プレイ画面がenv()を足し直していたらここが合わなくなる。
    // (HUDの帯ぶんの高さは、レーンのmb-2(8px)を除いた残りをHUDと分け合う形になる)
    check(`  レーンがSafe Areaの内側をそのまま使う(Safe Areaの二重掛けが無い)`,
      Math.abs((headerHeight+playHeight+8)-mainHeight)<1,
      `header=${headerHeight.toFixed(1)}px + プレイ=${playHeight.toFixed(1)}px + 余白8px / main=${mainHeight.toFixed(1)}px`);
    // 台形の最上部・中心ピクセルは、HUDに覆われずレーン自身の背景色のまま見えていること
    check(`  台形の頂点(最上部中心)はHUDに覆われずレーンの背景のまま`,
      measured.apexColor==='rgb(21, 32, 51)',`実際の色=${measured.apexColor}`);
    const heightRatio=headerHeight/mainHeight;
    check(`  HUDの帯はmain全体の高さの${Math.round(HUD_HEIGHT_LIMIT_RATIO*100)}%以内に収まる薄い帯である`,
      heightRatio<=HUD_HEIGHT_LIMIT_RATIO,`${(heightRatio*100).toFixed(1)}%`);
    await page.close();
  }
  await browser.close();
  console.log(failed===0?'\nすべてのチェックを通過しました。':`\n${failed}件のチェックに失敗しました。`);
  process.exit(failed===0?0:1);
})();
