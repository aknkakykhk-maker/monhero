// 音ゲーのプレイ画面で、HUD(スコア・コンボ・ライフ等)が「レーンの台形の左右にできる空きウェッジ
// (奥へ向かって狭くなる分だけ左右に空く三角形の余白)だけを使い、台形の頂点(中央・最上部)を
// 覆っていない」ことを実ブラウザで確かめる。
//
// 一度、HUDを画面上部へ全幅の背景パネルとして重ねる形を試したが(PR #983)、その背景パネルが
// 台形の頂点(遠近projectionの基準点=yRatio 0)そのものを覆ってしまい、
//   ・見えている台形の始まりが実際より進んだ位置になり、遠近感が変わってプレイしづらくなる
//   ・パネルの不透明な高さぶん、プレイエリアのDOM上の高さが増えても実際に見える範囲は増えない
// という2つの問題を実機プレイで指摘され、いったん元の横帯レイアウトへ戻した(PR #984)。
//
// 今回は、HUD本文を台形の外側の左右ウェッジだけに置き、背景パネルを持たせない(文字に影を
// 付けるだけ)ことで、台形の頂点を一切覆わないようにした。この検査では、
//   (1) プレイエリアの高さがHUD分だけ実際に増えていること
//   (2) 台形の最上部の中心ピクセルに、HUDが敷いた不透明な背景が乗っていないこと
//       (レーン自体の背景と同じ色であること)
//   (3) HUD本文(左右それぞれ)の実際のインク範囲が、それが描かれている高さの台形の外側に
//       収まっていること(1点だけでなく、HUDが占める高さの範囲を細かくサンプルして確認する)
// を実測する。
//
//   node tools/mode/rhythm-hud-wedge-check.js
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
  .replace(/data-rhythm-([a-z-]+)(?=[\s>])/g,'data-rhythm-$1=""');
check('HUDに未変換のJSX式が残っていない',!/\{|\}/.test(headerHtml),headerHtml.match(/\{[^"]{0,40}/)?.[0]||'');
check('HUDの<header>自身に背景色・背景画像を持たせていない(台形の頂点を覆わないため)',
  !/<header[^>]*style="[^"]*background/.test(headerHtml));
check('曲名は truncate(1行で…に切る)を使わない(実機で曲名が切れて読めなかったため)',
  !/data-rhythm-hud-song[^>]*class="[^"]*truncate/.test(headerHtml)&&/data-rhythm-hud-song/.test(headerHtml));

// ── 使われている utility を手書きCSSへ写す(知らないものは失敗させる) ───────────
const PALETTE={
  'white':'#ffffff','slate-200':'#e2e8f0','slate-300':'#cbd5e1','slate-400':'#94a3b8',
  'slate-100':'#f1f5f9','slate-900':'#0f172a','slate-950':'#020617','cyan-200':'#a5f3fc','cyan-300':'#67e8f9','emerald-200':'#a7f3d0',
  'fuchsia-200':'#f5d0fe','fuchsia-300':'#f0abfc','fuchsia-700':'#a21caf',
};
const SPACE={'0':'0px','0.5':'2px','1':'4px','1.5':'6px','2':'8px','3':'12px','12':'48px'};
const STATIC={
  'absolute':'position:absolute','relative':'position:relative','block':'display:block','flex':'display:flex',
  'flex-col':'flex-direction:column','shrink-0':'flex-shrink:0','flex-1':'flex:1 1 0%','min-w-0':'min-width:0',
  'items-center':'align-items:center','items-start':'align-items:flex-start','items-end':'align-items:end','items-baseline':'align-items:baseline',
  'flex-wrap':'flex-wrap:wrap','justify-end':'justify-content:flex-end',
  'justify-between':'justify-content:space-between','justify-center':'justify-content:center','text-left':'text-align:left','text-right':'text-align:right',
  'font-black':'font-weight:900','font-bold':'font-weight:700','leading-none':'line-height:1',
  'tabular-nums':'font-variant-numeric:tabular-nums','truncate':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
  'rounded':'border-radius:4px','rounded-full':'border-radius:9999px','rounded-xl':'border-radius:12px',
  'border':'border-width:1px;border-style:solid','inset-x-0':'left:0;right:0','inset-y-0':'top:0;bottom:0',
  'top-0':'top:0','left-0':'left:0','overflow-hidden':'overflow:hidden','w-full':'width:100%',
  'pointer-events-none':'pointer-events:none','pointer-events-auto':'pointer-events:auto',
};
const cssFor=token=>{
  if(STATIC[token])return STATIC[token];
  if(/^z-\d+$/.test(token))return `z-index:${token.slice(2)}`;
  if(/^shadow-\[/.test(token))return '';
  if(/^bg-slate-950\/80$/.test(token))return 'background-color:rgba(2,6,23,.8)';
  if(/^bg-slate-900\/90$/.test(token))return 'background-color:rgba(15,23,42,.9)';
  if(/^bg-fuchsia-700\/85$/.test(token))return 'background-color:rgba(162,28,175,.85)';
  if(/^border-white\/(\d+)$/.test(token)){const m=/^border-white\/(\d+)$/.exec(token);return `border-color:rgba(255,255,255,${Number(m[1])/100})`;}
  const size=value=>value.startsWith('[')?value.slice(1,-1).replace(/_/g,' '):SPACE[value];
  let m;
  if((m=/^(p|px|py|pt|pb|m|mt|mb|mx|gap|w|h|min-h|min-w|max-w)-(.+)$/.exec(token))){
    const value=size(m[2]);
    if(!value)return null;
    const props={p:['padding'],px:['padding-left','padding-right'],py:['padding-top','padding-bottom'],pt:['padding-top'],pb:['padding-bottom'],
      m:['margin'],mt:['margin-top'],mb:['margin-bottom'],mx:['margin-left','margin-right'],gap:['gap'],
      w:['width'],h:['height'],'min-h':['min-height'],'min-w':['min-width'],'max-w':['max-width']}[m[1]];
    return props.map(prop=>`${prop}:${value}`).join(';');
  }
  if((m=/^max-w-\[(\d+)%\]$/.exec(token)))return `max-width:${m[1]}%`;
  if((m=/^w-\[(\d+)%\]$/.exec(token)))return `width:${m[1]}%`;
  if((m=/^text-\[(\d+)px\]$/.exec(token)))return `font-size:${m[1]}px`;
  if((m=/^text-(xs|sm|lg|2xl)$/.exec(token)))return `font-size:${{xs:'12px',sm:'14px',lg:'18px','2xl':'24px'}[m[1]]}`;
  if((m=/^tracking-\[([^\]]+)\]$/.exec(token)))return `letter-spacing:${m[1]}`;
  if((m=/^(text|bg|border)-([a-z]+-\d{2,3}|white)$/.exec(token))){
    const hex=PALETTE[m[2]];
    if(!hex)return null;
    return {text:'color',bg:'background-color',border:'border-color'}[m[1]]+`:${hex}`;
  }
  return null;
};
const tokens=[...new Set([...headerHtml.matchAll(/class="([^"]*)"/g)].flatMap(m=>m[1].split(/\s+/)).filter(Boolean))];
const unknown=tokens.filter(token=>cssFor(token)===null);
check('HUDのクラスはすべてこの検査のCSSへ写せる',unknown.length===0,unknown.join(' '));
const utilityCss=tokens.map(token=>`.${token.replace(/[^A-Za-z0-9_-]/g,c=>'\\'+c)}{${cssFor(token)}}`).join('\n');

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
// HUD本文がここより下まで伸びると、台形の外側ウェッジが狭くなりすぎて衝突しやすくなる
const HUD_BOTTOM_LIMIT_RATIO=.30;

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  for(const size of SIZES){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.setContent(PAGE);
    const measured=await page.evaluate(()=>{
      // text nodeのRange.getClientRects()は、overflow:hidden+ellipsis(truncate)で視覚的に
      // 切られる前の「クリップ前の行のレイアウト幅」を返してしまい、実際には画面に出ない
      // 余白まで「はみ出している」と誤検出する。実際に見えている範囲を測るため、要素の
      // getBoundingClientRect()(overflow:hiddenの効果を含む、実際に描画される箱)を使う。
      const inkSamples=el=>{
        const samples=[];
        el.querySelectorAll('*').forEach(child=>{
          if(child.children.length>0)return; // 葉要素だけを見る(親の箱は子と重複するため)
          const hasText=child.textContent.trim().length>0;
          const cs=getComputedStyle(child);
          const hasVisibleBg=cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent';
          const hasVisibleBorder=cs.borderTopWidth!=='0px'&&cs.borderTopStyle!=='none';
          if(!hasText&&!hasVisibleBg&&!hasVisibleBorder)return;
          const r=child.getBoundingClientRect();
          if(r.width||r.height)samples.push(r);
        });
        return samples;
      };
      const play=document.querySelector('[data-rhythm-play-area]').getBoundingClientRect();
      const left=document.querySelector('[data-rhythm-hud-left]');
      const right=document.querySelector('[data-rhythm-hud-right]');
      const toPlain=r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
      return {
        play:toPlain(play),
        leftSamples:inkSamples(left).map(toPlain),
        rightSamples:inkSamples(right).map(toPlain),
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
    const playHeight=measured.play.bottom-measured.play.top;
    // Safe Areaはbodyが1回だけ引く。プレイ画面がenv()を足し直していたらここが合わなくなる。
    const expected=size.height-SAFE_TOP-SAFE_BOTTOM-8;
    check(`  レーンがSafe Areaの内側をそのまま使う(Safe Areaの二重掛けが無い)`,Math.abs(playHeight-expected)<1,
      `プレイ=${playHeight.toFixed(1)}px / 期待=${expected}px (画面${size.height} - 上${SAFE_TOP} - 下${SAFE_BOTTOM} - 余白8)`);
    // 台形の最上部・中心ピクセルは、HUDに覆われずレーン自身の背景色のまま見えていること
    check(`  台形の頂点(最上部中心)はHUDに覆われずレーンの背景のまま`,
      measured.apexColor==='rgb(21, 32, 51)',`実際の色=${measured.apexColor}`);
    const half=yRatio=>(measured.play.right-measured.play.left)/2*rhythmProjectionScale(yRatio);
    const laneEdgeAt=y=>{
      const ratio=Math.max(0,Math.min(1,(y-measured.play.top)/(measured.play.bottom-measured.play.top)));
      const center=(measured.play.left+measured.play.right)/2;
      return {left:center-half(ratio),right:center+half(ratio)};
    };
    let maxBottom=0;
    for(const [label,samples,side] of [['SCORE側',measured.leftSamples,'left'],['COMBO側',measured.rightSamples,'right']]){
      let worst=null;
      for(const box of samples){
        maxBottom=Math.max(maxBottom,box.bottom);
        // 要素の下端(台形が最も広がった高さ)で判定するのが最も厳しい
        const edge=laneEdgeAt(box.bottom);
        const ok=side==='left'?box.right<=edge.left+.5:box.left>=edge.right-.5;
        const margin=side==='left'?edge.left-box.right:box.left-edge.right;
        if(!ok&&(worst===null||margin<worst.margin))worst={box,edge,margin};
      }
      check(`  ${label}のHUDは、それが描かれる高さの台形へ一切かぶらない(${samples.length}要素をサンプル)`,
        worst===null,
        worst?`bottom=${worst.box.bottom.toFixed(1)}px, HUD側=${(side==='left'?worst.box.right:worst.box.left).toFixed(1)}px, 台形側=${(side==='left'?worst.edge.left:worst.edge.right).toFixed(1)}px`:'');
    }
    const bottomRatio=(maxBottom-measured.play.top)/(measured.play.bottom-measured.play.top);
    check(`  HUD本文は画面上部${Math.round(HUD_BOTTOM_LIMIT_RATIO*100)}%以内に収まる`,bottomRatio<=HUD_BOTTOM_LIMIT_RATIO,
      `${(bottomRatio*100).toFixed(1)}%`);
    await page.close();
  }
  await browser.close();
  console.log(failed===0?'\nすべてのチェックを通過しました。':`\n${failed}件のチェックに失敗しました。`);
  process.exit(failed===0?0:1);
})();
