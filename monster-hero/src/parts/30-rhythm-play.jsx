// ============================================================================
// 振動(ハプティクス)
// ============================================================================
// 【2026-09-05・「オプションにある振動が機能してない」という指摘で作り直した】
// それまでは navigator.vibrate(8) を呼ぶだけだった。これには2つ問題があった。
//   1. iPhone(Safari)には Vibration API そのものが無い。呼んでも何も起きない
//   2. 8msは短すぎて、対応している端末でも無視されることがある
// そこで、
//   ・使える端末では navigator.vibrate を少し長め(12ms)で呼ぶ
//   ・iOSでは、17.4から入った「スイッチ型チェックボックス」を切り替えると端末が
//     コツンと鳴る仕組みを借りる。画面の外へ置いた見えないスイッチを押して代用する
//   ・どちらも無い端末では何も起きない(音とエフェクトはこれまでどおり出る)。
//     オプション画面には「この端末では振動できません」と出して、
//     「設定はあるのに効かない」状態にしない
const RHYTHM_HAPTICS=(()=>{
  let holder=null,built=false,toggled=false;
  const canVibrate=()=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
  // iOSのスイッチを1つだけ作って使い回す(押すたびに作ると、そのぶん引っかかる)
  const iosSwitch=()=>{
    if(built)return holder;
    built=true;
    if(typeof document==='undefined'||!document.body)return null;
    try{
      const input=document.createElement('input');
      input.type='checkbox';
      // スイッチ表示に対応していない端末では、この仕組みそのものが無い
      if(!('switch' in input))return null;
      input.setAttribute('switch','');
      input.setAttribute('aria-hidden','true');
      input.tabIndex=-1;
      const label=document.createElement('label');
      label.setAttribute('aria-hidden','true');
      label.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      label.appendChild(input);
      document.body.appendChild(label);
      holder={label,input};
    }catch{holder=null;}
    return holder;
  };
  return {
    // この端末で振動できるか(オプション画面の案内に使う)
    supported:()=>canVibrate()||!!iosSwitch(),
    // 標準のAPIが無く、iOSのスイッチで代用しているか
    fallback:()=>!canVibrate()&&!!iosSwitch(),
    tap:(ms=12)=>{
      if(canVibrate()){try{navigator.vibrate(ms);}catch{}return;}
      const entry=iosSwitch();
      if(!entry)return;
      try{toggled=!toggled;entry.input.checked=toggled;entry.label.click();}catch{}
    },
  };
})();

// 歓声(mhRhythmSideCheer)の長さ。CSS側と同じ値をここに持つ。
// 終わったら data-rhythm-side-hit を外して、待機の動きへ戻すために使う。
const RHYTHM_SIDE_CHEER_MS=700;
// ===== マスモンの絵を、演奏の前に1枚の小さな絵へ焼いておく(2026-09-25) =====
// ユーザー報告「どの端末でも演奏中にカクつく / モンスターノーツを踏むと画面が飛ぶ」。
// 以前はノーツの顔を DOM の要素(元絵＋部位ごとの染め絵をマスクで重ね、影を2重に付けたもの)の
// まま canvas の上へ置き、落ちてくるあいだ毎フレーム拡大率を書き換えていた。拡大率は
// 合成用のレイヤーの**内側**で変わるので、端末は毎フレーム、影とマスクを掛け直して
// 最大1024pxの絵を描き直していた。踏んだ瞬間の「弾ける」動きも同じところで起きる。
// いまは顔を焼いた絵にして、ノーツと同じ canvas へ drawImage するだけにした。見た目は同じ。
// 顔の枠(42px)・拡大(1.28倍)・影は、以前の CSS([data-rhythm-canvas-face])の値そのまま。
// ===== 判定文字の光を、演奏の前に1枚の絵へ焼いておく(2026-09-26) =====
// ユーザー報告「設定で軽くしてると平気だけど、演出量を上げるとやっぱり重くてカクつく(iPhone 16e)」。
// 判定文字(MARVELOUS など)の光は filter:drop-shadow を最大6枚重ねたもの(いちばん外はぼかし40px)。
// ぼかしは文字を描き直すたび・合成するたびに計算し直される。判定は1秒に何度も変わり、
// 「多め」「最大」ではそのたびに弾ませるので、文字の何倍もの大きさのレイヤーを作ってはぼかし直していた
// (実測: 6秒で約230回・合計6秒ぶんの描画。影を1枚にすると56msまで減る)。
// そこで、光(影の重なり)だけを判定の種類ごとに canvas で1度だけ焼き、文字の後ろ(::before)へ置く。
// 文字の色・金や虹の流れ・弾み・大きさの切り替えは今までどおり CSS が動かす(::after に同じ文字を重ねる)。
// 影の色・ずれ・ぼかしは、画面に当たっている CSS の値をそのまま読んで焼くので、演出量ごとの違いも同じになる。
// canvas の shadowBlur は、CSS の drop-shadow の2倍の値で同じぼけ方になる(ブラウザで測って合わせた)。
// 焼けないとき(フォントの幅が合わない・drop-shadow 以外の filter がある)は、今までどおり CSS のぼかしで出す。
const RHYTHM_HALO_KEYS=Object.freeze([['MISS',''],['BAD',''],['GOOD',''],['GREAT',''],['EXCELLENT',''],['MARVELOUS',''],['MARVELOUS','1']]);
// 画面に当たっている filter(getComputedStyle の値)を drop-shadow の並びへ分ける。ほかの関数が混ざっていれば null
const rhythmParseDropShadows=filter=>{
  const text=String(filter||'').trim();
  if(!text||text==='none')return [];
  const list=[];
  const rest=text.replace(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g,(_,body)=>{
    const color=(body.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/)||['rgb(0, 0, 0)'])[0];
    const nums=body.replace(color,'').match(/-?[\d.]+px/g)||[];
    list.push({color,x:parseFloat(nums[0])||0,y:parseFloat(nums[1])||0,blur:parseFloat(nums[2])||0});
    return '';
  }).trim();
  return rest?null:list;
};
const rhythmBakeJudgmentHalos=async(textEl,maxScale=2)=>{
  const host=textEl&&textEl.parentElement;
  if(!host||typeof document==='undefined'||typeof window==='undefined')return null;
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(e){}
  // 光はぼけた絵なので、画面の画素密度の2倍までで足りる(3倍の端末でも見分けがつかない)
  const dpr=Math.min(Math.max(1,Number(maxScale)||2),Math.max(1,Number(window.devicePixelRatio)||1));
  const baked=[];
  const fail=()=>{baked.forEach(item=>URL.revokeObjectURL(item.url));return fail();};
  for(const [judgment,precise] of RHYTHM_HALO_KEYS){
    // 本物と同じ場所に、見えない見本を置いて CSS の値を読む(演出量・軽量モードの目印も同じように当たる)
    const probe=document.createElement('b');
    probe.className=textEl.className;probe.setAttribute('data-rhythm-judgment-text','');
    probe.dataset.judgment=judgment;if(precise)probe.dataset.judgmentPrecise=precise;
    probe.textContent=judgment;
    probe.style.cssText='position:absolute;left:0;top:0;visibility:hidden;transition:none;animation:none';
    host.appendChild(probe);
    const cs=getComputedStyle(probe);
    const shadows=rhythmParseDropShadows(cs.filter);
    const fs=parseFloat(cs.fontSize)||26,ls=parseFloat(cs.letterSpacing)||0;
    const font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const range=document.createRange();range.selectNodeContents(probe);
    const domWidth=range.getBoundingClientRect().width;
    host.removeChild(probe);
    if(!shadows)return fail();
    // 影が1枚だけなら焼かない(1枚の小さなぼかしは軽い。「最小」「軽量モード」はここに当たる)
    if(shadows.length<2)continue;
    const measure=document.createElement('canvas').getContext('2d');
    if(!measure)return fail();
    measure.font=font;
    const metrics=measure.measureText(judgment);
    const ascent=Number.isFinite(metrics.fontBoundingBoxAscent)?metrics.fontBoundingBoxAscent:metrics.actualBoundingBoxAscent;
    const descent=Number.isFinite(metrics.fontBoundingBoxDescent)?metrics.fontBoundingBoxDescent:metrics.actualBoundingBoxDescent;
    const runWidth=metrics.width+ls*judgment.length;
    // 画面の文字と canvas の文字で幅が合わなければ、フォントが違う。形がずれた光を出さないよう焼くのをやめる
    if(!(Math.abs(runWidth-domWidth)<=2)||!Number.isFinite(ascent)||!Number.isFinite(descent))return fail();
    const sigma=Math.sqrt(shadows.reduce((sum,s)=>sum+s.blur*s.blur,0));
    const offset=shadows.reduce((max,s)=>Math.max(max,Math.abs(s.x),Math.abs(s.y)),0);
    const margin=Math.ceil(2.5*sigma+offset+2);
    const cssW=runWidth+margin*2,cssH=fs+margin*2,W=Math.ceil(cssW*dpr),H=Math.ceil(cssH*dpr);
    const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
    // 字の形(色は使わない。影は形だけから作られる)。行の高さ=字の大きさなので、上下の余り(ハーフレディング)を同じに取る
    const glyph=make(),gctx=glyph.getContext('2d');
    if(!gctx)return fail();
    gctx.setTransform(dpr,0,0,dpr,0,0);gctx.font=font;gctx.textBaseline='alphabetic';gctx.fillStyle='#000';
    const baseline=margin+(fs-(ascent+descent))/2+ascent;
    for(let i=0;i<judgment.length;i++)gctx.fillText(judgment[i],margin+measure.measureText(judgment.slice(0,i)).width+ls*i,baseline);
    // filter の並びと同じ順に、「それまでの全部(字＋影)」の影を下へ足していく。残すのは影だけ(字は ::after が描く)
    const halo=make(),hctx=halo.getContext('2d'),source=make(),sctx=source.getContext('2d'),shadow=make(),shctx=shadow.getContext('2d');
    if(!hctx||!sctx||!shctx)return fail();
    sctx.drawImage(glyph,0,0);
    const far=W+H+1000;
    for(const s of shadows){
      shctx.clearRect(0,0,W,H);
      shctx.shadowColor=s.color;shctx.shadowBlur=s.blur*2*dpr;shctx.shadowOffsetX=s.x*dpr+far;shctx.shadowOffsetY=s.y*dpr;
      shctx.drawImage(source,-far,0);
      hctx.globalCompositeOperation='destination-over';hctx.drawImage(shadow,0,0);
      sctx.globalCompositeOperation='destination-over';sctx.drawImage(shadow,0,0);
    }
    const url=await new Promise(resolve=>{try{halo.toBlob(blob=>resolve(blob?URL.createObjectURL(blob):null),'image/png');}catch(e){resolve(null);}});
    if(!url)return fail();
    baked.push({judgment,precise,url,width:cssW/fs,height:cssH/fs});
  }
  return baked.length?baked:null;
};
// ===== ライブ背景「派手」のサーチライトと光の粒を、1度だけ画像に焼く(2026-09-26) =====
// ユーザー報告「演出量とライブ背景をマックスに上げると重くなるし発熱がすごい」。
// 以前は、サーチライトを clip-path で台形に切り抜いた層として回し、光の粒は CSS の模様(radial-gradient)を
// 並べた「画面の2倍の高さ」の層を、画面の画素数そのままで上へ流していた。回転する層の切り抜きは合成のたびに
// マスクを通り、粒の層は大きな絵を2枚抱えることになる。
// いまは形を1度だけ canvas で描いて画像にし、<img> を CSS のアニメーション(合成だけで動く)で動かす。
// 画素密度は1.5倍まで(ぼけた光なので見分けがつかない)。位置・動き・速さ・色は以前の CSS のまま。
//   サーチライト … 幅38%・高さ135%。上の辺の44%〜56%から下の辺いっぱいへ広がる台形。色は上から78%で消える
//   光の粒 … 奥8粒(16秒で1周・濃さ.55)、手前6粒(9秒で1周・濃さ.7)。層の上半分と下半分に同じ並び
// ★動くものを毎フレーム canvas へ描き直す形は試してやめた。合成だけで済んでいた動きが毎フレームの塗りになり、
//   この環境の計測でも処理時間が倍近くに増えた。ジャケットと暗幕はもともと軽い(24×24 の絵の引き伸ばし・動かない層)ので変えていない。
const RHYTHM_STAGE_BEAM_COLORS=Object.freeze(['rgba(103,232,249,.22)','rgba(232,121,249,.24)','rgba(251,191,36,.24)','rgba(255,255,255,.26)']);
const RHYTHM_STAGE_SPARKS=Object.freeze([
  {duration:16000,opacity:.55,core:1,mid:2,end:4,dots:[[8,12],[27,63],[41,30],[58,85],[73,18],[88,52],[15,90],[64,45]]},
  {duration:9000,opacity:.7,core:2,mid:3,end:5,dots:[[5,40],[21,8],[36,77],[80,33],[93,70],[50,58]]},
]);
// サーチライト1本。box は要素の箱(CSS px)、回転の中心は箱の上辺の真ん中
const rhythmDrawStageBeam=(g,left,top,bw,bh,angleDeg,color,alpha=.75)=>{
  g.save();
  g.translate(left+bw/2,top);g.rotate(angleDeg*Math.PI/180);g.translate(-bw/2,0);
  g.beginPath();g.moveTo(.44*bw,0);g.lineTo(.56*bw,0);g.lineTo(bw,bh);g.lineTo(0,bh);g.closePath();
  const grad=g.createLinearGradient(0,0,0,bh);grad.addColorStop(0,color);grad.addColorStop(.78,color.replace(/[\d.]+\)$/,'0)'));
  g.globalAlpha=alpha;g.fillStyle=grad;g.fill();
  g.restore();
};
// 光の粒1つ(円の中心から core まで白、mid で水色.35、end で透明)
const rhythmStageSparkSprite=(layer,scale)=>{
  const r=layer.end,size=Math.ceil(r*2*scale)+2,c=document.createElement('canvas');c.width=size;c.height=size;
  const g=c.getContext('2d');if(!g)return c;
  const cx=size/2,grad=g.createRadialGradient(cx,cx,0,cx,cx,r*scale);
  grad.addColorStop(0,'rgba(236,254,255,.95)');grad.addColorStop(layer.core/r,'rgba(236,254,255,.95)');
  grad.addColorStop(layer.mid/r,'rgba(103,232,249,.35)');grad.addColorStop(1,'rgba(103,232,249,0)');
  g.fillStyle=grad;g.fillRect(0,0,size,size);
  return c;
};
// 画質「自動」で下げた段。アプリを開いているあいだだけ覚えておき、次の曲もこの段から始める(保存はしない)
const rhythmAutoQualityMemory={level:'HIGH'};
const RHYTHM_FACE_BOX=42,RHYTHM_FACE_ZOOM=1.28,RHYTHM_FACE_PAD=12;
const rhythmBakeMonsterFace=async(monster,dpr)=>{
  if(!monster||!monster.imageUrl||typeof document==='undefined')return null;
  // 焼く画素 / 顔の枠の1px。ノーツがいちばん手前で 1.28倍になるので、そこで画面の画素と1対1になる
  const ratio=RHYTHM_FACE_ZOOM*Math.max(1,Number(dpr)||1);
  const art=await bakeDyedMonsterCanvas({baseId:monster.baseId,src:monster.imageUrl,masuColors:monster.colors},Math.round(RHYTHM_FACE_BOX*ratio));
  if(!art)return null;
  const pad=Math.ceil(RHYTHM_FACE_PAD*ratio),full=art.width+pad*2;
  const canvasOf=()=>{const c=document.createElement('canvas');c.width=full;c.height=full;return c;};
  // 弾ける演出のあいだは影なし(以前の CSS も filter:none にしていた)
  const plain=canvasOf(),plainCtx=plain.getContext('2d');
  if(!plainCtx)return null;
  plainCtx.drawImage(art,pad,pad);
  // filter:drop-shadow(0 1px 2px rgba(0,0,0,.58)) drop-shadow(0 0 4px rgba(253,224,71,.55)) と同じ順に重ねる。
  // canvas の shadowBlur は CSS の drop-shadow の2倍の値で同じぼけ方になる(ブラウザで測って合わせた)
  const shaded=canvasOf(),shadedCtx=shaded.getContext('2d');
  const glow=canvasOf(),glowCtx=glow.getContext('2d');
  if(!shadedCtx||!glowCtx)return null;
  shadedCtx.shadowColor='rgba(0,0,0,.58)';shadedCtx.shadowOffsetY=1*ratio;shadedCtx.shadowBlur=4*ratio;
  shadedCtx.drawImage(art,pad,pad);
  glowCtx.shadowColor='rgba(253,224,71,.55)';glowCtx.shadowBlur=8*ratio;
  glowCtx.drawImage(shaded,0,0);
  // box … 余白込みの一辺を「顔の枠(42px)の何倍か」で持つ。描くときはこれに拡大率を掛ける
  return {glow,plain,box:full/art.width};
};
// ポーズから戻るときの数え方。開始のときの READY は要らない(もう構えている)ので 3→2→1 だけ
const RHYTHM_RESUME_COUNTDOWN_STEPS=Object.freeze(['3','2','1']);
// 曲の位置を「1:05」の形にする。ポーズ画面の「いまどのあたりか」に使う
const rhythmClockLabel=ms=>{const total=Math.max(0,Math.floor((Number(ms)||0)/1000));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};
// TAPを取った指が境界付近に残ると、iPhoneの接触中心が数px揺れただけでも
// floor(subLaneCoordinate)が隣へ変わり、同じ指で未来TAPを再判定していた。
// 判定ライン付近では1サブレーン約32〜38pxなので、.20は約6〜8px。
// 接触幅側の中心揺れdeadzone(6〜10px)と同程度だけを無視し、明確な横移動は残す。
const RHYTHM_TAP_REJUDGE_MOVE_SUBLANES=.20;
const rhythmAbilityEmoji=abilityId=>abilityId==='GENKI'?'💚':abilityId==='MUTEKI'?'🛡️':abilityId==='GAMAN'?'🧱':abilityId==='KONJO'?'🔥':'✨';
const rhythmAbilityTone=abilityId=>abilityId==='GENKI'?'border-emerald-300/50 bg-emerald-950/40 text-emerald-100'
  :abilityId==='MUTEKI'?'border-cyan-300/50 bg-cyan-950/40 text-cyan-100'
  :abilityId==='GAMAN'?'border-amber-300/50 bg-amber-950/40 text-amber-100'
  :abilityId==='KONJO'?'border-rose-300/50 bg-rose-950/40 text-rose-100'
  :'border-white/20 bg-slate-900/60 text-slate-300';
// 能力ごとに「その能力になる血統」をまとめる。並びは RHYTHM_MONSTER_ABILITIES の順。
const rhythmAbilityRows=()=>Object.values(RHYTHM_MONSTER_ABILITIES).map(ability=>({
  ability,
  lineages:Object.entries(RHYTHM_MONSTER_ABILITY_BY_LINEAGE)
    .filter(([,id])=>id===ability.id)
    .map(([lineageId])=>lineageById(lineageId).name),
}));
const rhythmSlotAbility=masu=>(masu&&masu.baseId)
  ?rhythmMonsterAbilityForLineage(monsterLineageOf(masu.baseId).main.id):null;

// モンスターノーツの説明。マスモン設定の画面へ置く「詳細」。
// 【2026-09-05・ユーザー指示】「マスモン設定のとこをUIやレイアウトを整えて。
//   モンスターノーツが何がつくかとか説明とかその辺の詳細を追加して」
// 能力の一覧は実データ(RHYTHM_MONSTER_ABILITIES / RHYTHM_MONSTER_ABILITY_BY_LINEAGE)から作る。
// 手で書き写すと、値を変えたときにここだけ古いまま残るため。
const RhythmMonsterNoteGuide=()=>{
  const ratios=rhythmMonsterNoteBaseRatios(RHYTHM_MONSTER_SLOT_MAX).map(ratio=>`${Math.round(ratio*100)}%`);
  return <section data-rhythm-monster-guide className="space-y-3">
    <article className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
      <h3 className="text-sm font-black text-amber-100">モンスターノーツとは</h3>
      <p className="mt-2 text-[11px] font-bold leading-relaxed text-amber-50/90">
        ここで設定したマスモンは、曲の途中で金色の「モンスターノーツ」になって流れてきます。
        ノーツの真ん中には、そのマスモンの染色を反映した絵が出ます。
      </p>
      <ul className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-amber-50/90">
        <li>・設定した順に、<b>1体につき1回・最大{RHYTHM_MONSTER_SLOT_MAX}回</b>出てきます。</li>
        <li>・出てくるのは曲のだいたい {ratios.join(' / ')} あたりです（曲の切れ目に合わせるので前後します）。</li>
        <li>・<b>{RHYTHM_MONSTER_ABILITY_JUDGMENTS.join('・')}</b> で取ると、そのマスモンの能力が出ます。GOOD・BAD・MISSでは出ません。</li>
        <li>・判定の幅・スコアの計算・コンボの数え方は、ふつうのノーツとまったく同じです。</li>
        <li>・いまはTAPのノーツだけがモンスターノーツになります。</li>
      </ul>
    </article>
    <article className="rounded-2xl border border-white/15 bg-slate-900/70 p-4">
      <h3 className="text-sm font-black text-white">どの能力が付くか</h3>
      <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">
        能力は<b className="text-slate-200">主血統</b>で決まります。副血統では変わりません。育成・染色でも変わりません。
      </p>
      <ul data-rhythm-ability-table className="mt-2 space-y-2">
        {rhythmAbilityRows().map(({ability,lineages})=>(
          <li key={ability.id} data-rhythm-ability={ability.id}
            className={`rounded-xl border p-2.5 ${rhythmAbilityTone(ability.id)}`}>
            <div className="flex items-baseline gap-1.5">
              <span aria-hidden="true" className="text-sm leading-none">{rhythmAbilityEmoji(ability.id)}</span>
              <b className="text-[12px] font-black leading-none">{ability.name}</b>
            </div>
            <p className="mt-1.5 text-[11px] font-bold leading-relaxed">{rhythmAbilityEffectText(ability)}</p>
            <p className="mt-1 text-[10px] font-bold leading-relaxed opacity-80">主血統: {lineages.join(' / ')}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">
        無敵と我慢は効果の長さが違うので、それぞれの残り時間で別々に動きます。
        両方効いているあいだは無敵が勝ち、無敵が切れたら我慢の軽減に変わります。
        残り時間と根性を持っているかは、演奏中の画面の右上に出ます。
      </p>
    </article>
  </section>;
};

// マスモン設定の本体。枠の並び順がそのままモンスターノーツの登場順(§3.3)。
// 枠には「何番目に出るか」と「その子で何の能力が出るか」まで出す。
// 名前だけを並べていたころは、設定してもプレイ中に何が起きるのか画面から分からなかった。
const RhythmMonsterSlotsPanel=({rhythmMonsterSlots,rhythmMonsterSlotIdsInUse,rhythmMonsterPickerOpen,setRhythmMonsterPickerOpen,rhythmMonsterMessage,setRhythmMonsterMessage,applyRhythmMonsterSlots,masuMons})=>(
  <section data-rhythm-monster-slots className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-950/20 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-fuchsia-200">モンスターノーツ用マスモン</h3><span data-rhythm-monster-count className="shrink-0 rounded-full border border-fuchsia-300/50 px-2 py-0.5 text-[10px] font-black text-fuchsia-200">{rhythmMonsterSlots.length} / {RHYTHM_MONSTER_SLOT_MAX}体</span></div>
              <p className="mt-2 text-[10px] font-bold leading-relaxed text-fuchsia-100/80">上から順に登場します。同じモンスターは別の個体でも重ねて設定できません。{RHYTHM_MONSTER_SLOT_MAX}体そろえる必要はなく、1〜3体でも遊べます。</p>
              <ol className="mt-3 space-y-2">{Array.from({length:RHYTHM_MONSTER_SLOT_MAX},(_,index)=>{
                const masu=rhythmMonsterSlots[index]||null,base=masu?ALL_PLAYER_MONSTERS[masu.baseId]:null;
                const lineage=masu?monsterLineageOf(masu.baseId).main:null;
                const ability=rhythmSlotAbility(masu);
                return <li key={index} data-rhythm-monster-slot={index+1} className="rounded-xl border border-white/10 bg-slate-900/80 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 rounded-lg border border-fuchsia-300/40 py-0.5 text-center text-[9px] font-black leading-tight text-fuchsia-200">{index+1}<br/>番目</span>
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-950">{masu&&base&&<DyedMonsterImage baseId={masu.baseId} src={masuDisplayImageUrl(base)} alt={masu.name} masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-contain"/>}</div>
                    <div className="min-w-0 flex-1">{masu?<React.Fragment><b className="block truncate text-[12px] font-black">{masu.name}</b><small className="block truncate text-[10px] text-slate-400">{base?.name||masu.baseId}{lineage?` / ${lineage.name}血統`:''}</small></React.Fragment>:<small className="text-[11px] font-bold text-slate-500">未設定</small>}</div>
                    {masu&&<div className="flex shrink-0 gap-1">
                      <button type="button" aria-label={`${index+1}枠目を前へ`} disabled={index===0} onClick={()=>applyRhythmMonsterSlots(moveRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,index,-1),'登場順を入れ替えました')} className="min-h-[40px] min-w-[40px] rounded-lg border border-white/20 text-[12px] font-black text-slate-200 disabled:opacity-30">↑</button>
                      <button type="button" aria-label={`${index+1}枠目を後ろへ`} disabled={index>=rhythmMonsterSlots.length-1} onClick={()=>applyRhythmMonsterSlots(moveRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,index,1),'登場順を入れ替えました')} className="min-h-[40px] min-w-[40px] rounded-lg border border-white/20 text-[12px] font-black text-slate-200 disabled:opacity-30">↓</button>
                      <button type="button" data-rhythm-monster-remove aria-label={`${masu.name}を外す`} onClick={()=>applyRhythmMonsterSlots(removeRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,masu.id),`${masu.name}を外しました`)} className="min-h-[40px] rounded-lg border border-rose-300/50 px-2 text-[11px] font-black text-rose-200">外す</button>
                    </div>}
                  </div>
                  {/* 設定した子で「何が起きるか」まで枠の中に出す。
                      名前だけでは、プレイ中に何が起きるのかここから分からなかった */}
                  {masu&&<p data-rhythm-monster-slot-ability={ability?ability.id:'none'}
                    className={`mt-2 rounded-lg border px-2 py-1.5 text-[10px] font-bold leading-relaxed ${rhythmAbilityTone(ability?ability.id:'')}`}>
                    {ability
                      ?<>{rhythmAbilityEmoji(ability.id)} {ability.name} — {rhythmAbilityEffectText(ability)}</>
                      :<>この血統の能力はまだ決まっていません。モンスターノーツにはなりますが、能力は出ません。</>}
                  </p>}
                </li>;})}</ol>
              <button type="button" data-rhythm-monster-picker-toggle aria-expanded={rhythmMonsterPickerOpen} onClick={()=>{setRhythmMonsterPickerOpen(!rhythmMonsterPickerOpen);setRhythmMonsterMessage('');}} className="mt-3 min-h-[48px] w-full rounded-xl border border-fuchsia-300/60 bg-fuchsia-900/40 text-[12px] font-black text-fuchsia-100">{rhythmMonsterPickerOpen?'マスモン一覧を閉じる':'マスモンから設定する'}</button>
              {rhythmMonsterMessage&&<p data-rhythm-monster-message role="status" className="mt-2 text-[11px] font-bold text-amber-200">{rhythmMonsterMessage}</p>}
              {rhythmMonsterPickerOpen&&<ul data-rhythm-monster-picker className="mh-scroll mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                {masuMons.filter(masu=>masu&&ALL_PLAYER_MONSTERS[masu.baseId]).map(masu=>{
                  const base=ALL_PLAYER_MONSTERS[masu.baseId],issue=rhythmMonsterSlotAddIssue(rhythmMonsterSlotIdsInUse,masu.id,masuMons);
                  const ability=rhythmSlotAbility(masu);
                  return <li key={masu.id}><button type="button" disabled={!!issue} onClick={()=>applyRhythmMonsterSlots(addRhythmMonsterSlot(rhythmMonsterSlotIdsInUse,masu.id,masuMons),`${masu.name}を${rhythmMonsterSlots.length+1}枠目に設定しました`)} className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border p-2 text-left ${issue?'border-white/10 bg-slate-900/40 opacity-50':'border-white/20 bg-slate-900/80'}`}>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-950"><DyedMonsterImage baseId={masu.baseId} src={masuDisplayImageUrl(base)} alt="" masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-contain"/></div>
                    <div className="min-w-0 flex-1"><b className="block truncate text-[12px] font-black">{masu.name}</b><small className="block truncate text-[10px] text-slate-400">{base.name}{ability?` / ${rhythmAbilityEmoji(ability.id)}${ability.name}`:''}</small></div>
                    {issue&&<small className="shrink-0 text-[10px] font-bold text-rose-300">{RHYTHM_MONSTER_SLOT_ISSUE_TEXT[issue]}</small>}
                  </button></li>;})}
                {masuMons.filter(masu=>masu&&ALL_PLAYER_MONSTERS[masu.baseId]).length===0&&<li className="rounded-xl border border-white/10 p-4 text-center text-[11px] font-bold text-slate-500">設定できるマスモンがいません</li>}
              </ul>}
            </section>
);

// debugPlay … 音ゲーデバッグ画面から始めたプレイかどうか。
// デバッグ専用の表示(HOLD TEST / 中断して音ゲーデバッグへ戻る / 座標校正)は、
// ここが true のときだけ出す。体験版から入ったプレイヤーの画面へ出してはいけない
// (2026-09-05・実機の指摘「ここがデバッグのままになってる」)。
// tutorial … 「あそびかた練習」で開いたかどうか。
// 演奏画面をそのまま使って各ノーツの操作を1つずつ覚える(2026-09-05・ユーザー指示)。
// 練習なのでライフは減らさず、スコアも記録も残さない。
// quickRunAward … クイック∞周回を裏で回しているとき、この1曲で何周ぶん入ったか。
// ★以前は曲えらびの帯へ出していたが、帯はいま何WAVE・何周目かを出す唯一の場所なので、
//   そこへ知らせを重ねると肝心の進捗が読めなくなっていた
//   (2026-09-07・ユーザー提案「曲リザルトの画面で出すほうがいい。
//    そうしたら帯にわざわざ何周分追加とか表示する必要もない」)。
const RhythmTapTest=({song,difficulty,settings,bestRecord,monsterEntries,onComplete,onExit,quickRunAward=null,debugPlay=false,tutorial=false,calibrating=false,onApplyCalibration=null})=>{
  // モンスターノーツの演出の段。いちばん軽い段(NONE)では、ノーツへ重ねるマスモンの絵を
  // 作らない(2026-09-13・ユーザー指摘「あれは踏んだときまだカクつきがある / 設定は最小」)。
  // ★この絵だけは canvas ではなくDOMの要素で、毎フレーム transform と scale を書き換えている。
  //   ふつうのノーツには無い処理なので、ここを止めるといちばん効く。
  const monsterNoteEffect=RHYTHM_MONSTER_EFFECT_LEVELS.includes(settings.monsterNoteEffect)?settings.monsterNoteEffect:DEFAULT_RHYTHM_SETTINGS.monsterNoteEffect;
  const monsterFaceHidden=rhythmMonsterEffectAtMost(monsterNoteEffect,'NONE');
  /* アシストモード・ミラー譜面(バンドリ！アワーノーツから取り入れた遊び方。2026-09-24)。
     練習・タイミング合わせでは使わない(アシストはデバッグから始めたプレイでも使わない)。
     譜面は演奏の前に一度だけ作り変える。元の譜面(song.difficulties)は書き換えない */
  const assistOn=!!settings.assistMode&&!tutorial&&!calibrating&&!debugPlay,mirrorOn=!!settings.mirrorChart&&!tutorial&&!calibrating;
  const rawChart=song.difficulties[difficulty.id];
  const transformedChart=useMemo(()=>assistOn||mirrorOn?rhythmTransformChart(song.difficulties[difficulty.id],{mirror:mirrorOn,assist:assistOn}):null,[song.songId,difficulty.id,assistOn,mirrorOn]);
  const chart=transformedChart||rawChart,laneRefs=useRef([]),runRef=useRef(null),frameRef=useRef(null),playAreaRef=useRef(null),judgmentLineRef=useRef(null),judgmentBandRef=useRef(null),judgmentTimerRef=useRef(null),judgmentRevisionRef=useRef(0),startLockRef=useRef(false),generationRef=useRef(0),mountedRef=useRef(false),glowNodesRef=useRef(null),liveTouchSubLanesRef=useRef([]);

  const tutorialBannerRef=useRef(null),tutorialStepRef=useRef(null);
  // タイミング合わせの案内(いま何回ぶん数えたか・途中経過のずれ)を書き換えるための控え。
  // 数えた回数が変わったときだけDOMへ書く(毎フレームReactを動かさない)
  const calibrationBannerRef=useRef(null),calibrationTapsRef=useRef(-1);
  const hasHold=chart.notes.some(note=>note.type==='HOLD');
  // デバッグ画面で譜面の中身をひと目で見るための表記。プレイヤーの画面には出さない。
  // 以前は data/rhythm-mode.js が DOM を直接 'MIX TEST' へ書き換えていて、
  // 体験版から入ったプレイヤーの画面にも出ていた(2026-09-05・実機の指摘)
  const debugChartLabel=chart.notes.some(note=>note.type==='FLICK'||note.type==='SLIDE')?'MIX TEST':hasHold?'HOLD TEST':'TAP TEST';
  // モンスターノーツで使うマスモン。枠の順(1〜4)がそのまま登場順(§3.3)。
  // useCallbackの依存を毎回変えないようrefで持つ
  const monsters=Array.isArray(monsterEntries)?monsterEntries:[];
  const monstersRef=useRef(monsters);monstersRef.current=monsters;
  // 親(App本体)は rhythmMonsterNoteEntries を描画のたびに map で作り直すため、配列の同一性では
  // 判定できない。ノーツの見た目に効く項目だけを文字列にして、中身が同じあいだはメモを保つ。
  const monsterSignature=monsters.map(m=>m?`${m.baseId}|${m.imageUrl}|${JSON.stringify(m.colors||null)}`:'-').join(',');
  // ノーツのDOMは譜面が変わらないかぎり同じものでよい。ここをuseMemoで固定しないと、
  // ノーツを1つ判定して setView するたびに全ノーツ(最大300要素)をReactが作り直し、
  // ref も付け直すため、タップのたびに一瞬止まって見える(2026-09-04の実機報告)。
  // ノーツを canvas 1枚へ描くか(発熱対策・2026-09-07)。公開フラグとデバッグ画面の上書きで決まり、演奏の途中では変えない
  const canvasNotes=useState(()=>rhythmCanvasNotesActive(RELEASE_FLAGS.rhythmCanvasNotes))[0];
  // ノーツを描く canvas の画素密度の上限。演出量「最小」は2倍まで(以前から)、そのうえで画質の設定で下げる(2026-09-26)。
  // begin() と warmSprites() に**同じ値**を渡すこと(食い違うと焼いた光を捨てて作り直す)
  // 画質「自動」では、演奏中に詰まりが続くと一段ずつ下げる(tick が数える)。曲の途中で切り替えるのはノーツとマスモンの顔だけ。
  // 判定文字の光とライブ背景の光は、焼き直すあいだ一瞬消えるので、曲の始めの段のままにする
  const [autoQuality,setAutoQuality]=useState(()=>rhythmAutoQualityMemory.level);
  const autoQualityAtStart=useState(()=>rhythmAutoQualityMemory.level)[0];
  const renderQualityNow=rhythmEffectiveRenderQuality(settings.renderQuality,autoQuality);
  const renderQualityStill=rhythmEffectiveRenderQuality(settings.renderQuality,autoQualityAtStart);
  const stepAutoQualityRef=useRef(null);
  stepAutoQualityRef.current=()=>setAutoQuality(level=>{const index=RHYTHM_RENDER_QUALITY_STEPS.indexOf(level);const next=RHYTHM_RENDER_QUALITY_STEPS[Math.min(RHYTHM_RENDER_QUALITY_STEPS.length-1,Math.max(0,index)+1)];rhythmAutoQualityMemory.level=next;return next;});
  const noteCanvasMaxDpr=Math.min(settings.effectAmount==='MINIMAL'?2:RHYTHM_NOTE_CANVAS_MAX_DPR,rhythmRenderQualityCap(renderQualityNow,RHYTHM_NOTE_CANVAS_MAX_DPR));
  // 毎フレームの処理は作り直さないので、いまの値はここから読む(「自動」で曲の途中に変わるため)
  const noteCanvasMaxDprRef=useRef(noteCanvasMaxDpr);noteCanvasMaxDprRef.current=noteCanvasMaxDpr;
  const noteCanvasRef=useRef(null);
  // 検証用: デバッグ画面の「ノーツの描き方」で WebGL を選んだときだけ、同じ描き方を WebGL の描き込み先で描く(2026-09-26)
  const webglNotes=useState(()=>canvasNotes&&rhythmWebglNotesActive())[0];
  useEffect(()=>{if(!canvasNotes)return undefined;RHYTHM_CANVAS_RENDERER.attach(noteCanvasRef.current,{webgl:webglNotes});const canvas=noteCanvasRef.current;if(canvas)canvas.dataset.rhythmNoteBackend=RHYTHM_CANVAS_RENDERER.backend;return()=>RHYTHM_CANVAS_RENDERER.release();},[canvasNotes,webglNotes]);
  const noteElements=useMemo(()=>canvasNotes?null:chart.notes.map((note,index)=>{const monsterSlot=rhythmNoteMonsterSlot(note),monster=monsterSlot?monsters[monsterSlot-1]||null:null;return <div key={index} ref={el=>laneRefs.current[index]=el} data-rhythm-note data-note-type={note.type} data-rhythm-note-wide={rhythmNoteIsWide(note)?'1':undefined} data-rhythm-monster-note={monster?monsterSlot:undefined} className="absolute top-0 h-5" style={{left:`calc(${note.lane*20}% + 5px)`,width:'calc(20% - 10px)',pointerEvents:'none'}}>{/* HOLDの帯は水色でそろえる。以前は根もとが emerald(緑)だったが、FLICKが緑なので
                「フリックとホールドの色が似ていて分かりにくい」と指摘された(2026-09-07)。
                ヘルプでも HOLD は「シアン(水色)」と説明しているので、そちらへ合わせる */}{note.type==='HOLD'&&<span data-rhythm-hold-body className="absolute left-[18%] right-[18%] bottom-1/2 rounded-t-lg bg-gradient-to-t from-cyan-500/90 to-cyan-200/70" style={{height:'var(--rhythm-hold-body, 0px)'}}/>}{(note.type==='HOLD'||note.type==='SLIDE')&&<span data-rhythm-end-bar data-rhythm-end-flick={note.endFlick===true?'1':undefined} aria-hidden="true" className="absolute z-[2] h-2 rounded-full border border-white/80 bg-gradient-to-r from-fuchsia-400 via-cyan-100 to-fuchsia-400 shadow-[0_0_10px_#67e8f9,0_0_18px_#d946ef]" style={{pointerEvents:'none',transform:'scaleY(var(--rhythm-end-depth-scale, 1))',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 7px #67e8f9':'0 0 10px #67e8f9,0 0 18px #d946ef'}}/>}<span data-rhythm-note-head className={`absolute inset-0 rounded-full ${monster?'bg-gradient-to-b from-amber-100 to-amber-500 ring-2 ring-amber-200':note.type==='HOLD'?'border-2 border-white/90 bg-gradient-to-b from-cyan-50 to-cyan-400':'bg-gradient-to-b from-amber-200 to-fuchsia-500'}`} style={{boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 2px 6px rgba(15,23,42,.45)':'0 10px 15px -3px rgba(0,0,0,.24)'}}>{/* 長押しの押し始めは、帯と同じ色の丸が帯の下でわずかに太るだけで、
                「どこを押せばよいか」が読み取れなかった(2026-09-05・実機の指摘)。
                終わりには光るバーがあるのに、始まりには目印が無かった。
                白いふちと1本の線で「叩く粒」だと分かるようにする。線はspanではないので、
                幅広ノーツの両端バーが使う >span:last-child::before/::after とはぶつからない。
                判定・当たり判定・幅・速さは一切変えていない(見た目だけ) */}
                {!monster&&note.type==='HOLD'&&<i data-rhythm-hold-head-mark aria-hidden="true" className="pointer-events-none absolute left-[24%] right-[24%] top-1/2 block h-[2px] -translate-y-1/2 rounded-full bg-sky-950/55"/>}{/* 上へ払う矢印。以前は粒の ::after に「⇧」の文字で出していたが、
                幅広ノーツ(5サブレーン以上)の両端の縁取りが同じ ::before/::after を使うため、幅広のFLICKでは
                矢印と縁取りが場所を取り合い、どちらでもない縦線が残っていた(2026-09-07・ユーザー指摘)。
                実体のある要素へ切り出し、形はCSS(clip-path)の三角で描く。文字と違って端末のフォントに左右されず、大きさもそろう */}
                {note.type==='FLICK'&&<i data-rhythm-flick-arrow aria-hidden="true"/>}</span>{/* 設定したマスモンの染色済みの絵をノーツ中央へ出す(§3.5)。
                奥行きはレーンと同じ --rhythm-note-depth-scale へ乗せるので、毎フレームJSで書き換えない。
                絵はプレイ開始時に一度だけ組み立て、そのまま使い回す */}
                {monster&&!monsterFaceHidden&&<span data-rhythm-monster-face aria-hidden="true" className="absolute left-1/2 top-1/2 flex h-[42px] w-[42px] items-center justify-center" style={{transform:'translate(-50%,-50%) scale(var(--rhythm-note-depth-scale, 1))'}}>{monster.imageUrl&&<DyedMonsterImage baseId={monster.baseId} src={monster.imageUrl} alt="" masuColors={monster.colors} draggable={false} className="h-full w-full object-contain"/>}</span>}</div>;}),[chart.notes,monsterSignature,settings.lightweightMode,settings.effectAmount,monsterFaceHidden]);
  // canvas で描くときも、マスモンの絵(染色済み・透明部分あり)だけは要素のまま canvas の上へ重ねる。
  // 位置と大きさは tick が transform で書く。絵が無いノーツには要素を作らない
  // 両サイドのマスモンも、焼いた1枚の絵で出す(2026-09-25)。染色の重ね絵(元絵＋部位ごとの染め絵を
  // マスクで重ねたもの)のままだと、能力が効いて絵が1.14倍になるあいだや、跳ねる動きが切り替わるたびに、
  // 端末が最大1024pxの絵へマスクを掛け直して描き直す。モンスターノーツを踏んだ瞬間にちょうど重なる。
  // 大きさは横画面でいちばん大きくなるとき(一辺160px前後・能力中はその1.14倍)が収まる180px。
  const [sideArtUrls,setSideArtUrls]=useState([]);
  useEffect(()=>{let cancelled=false;const made=[];
    const deviceDpr=typeof window!=='undefined'&&window.devicePixelRatio>0?window.devicePixelRatio:1;
    const px=Math.round(180*Math.min(3,Math.max(1,deviceDpr)));
    const toUrl=canvas=>new Promise(resolve=>{try{canvas.toBlob(blob=>resolve(blob?URL.createObjectURL(blob):null),'image/png');}catch(e){resolve(null);}});
    Promise.all(monsters.map(monster=>monster&&monster.imageUrl
      ?bakeDyedMonsterCanvas({baseId:monster.baseId,src:monster.imageUrl,masuColors:monster.colors},px).then(canvas=>canvas?toUrl(canvas):null)
      :Promise.resolve(null)))
      .then(list=>{list.forEach(url=>{if(url)made.push(url);});if(cancelled){made.forEach(url=>URL.revokeObjectURL(url));return;}setSideArtUrls(list);});
    return()=>{cancelled=true;made.forEach(url=>URL.revokeObjectURL(url));};
  },[monsterSignature]);
  // canvas で描くときのマスモンの顔。演奏の前(カウントダウンのあいだ)に1体ずつ焼いておき、
  // tick は焼いた絵を canvas へ置くだけにする(rhythmBakeMonsterFace の説明を参照)。
  // いちばん軽い段(NONE)では焼かない＝顔を出さない。焼けていないうちは顔を出さないだけで、判定には関係しない。
  // 画素密度は RHYTHM_CANVAS_RENDERER.begin() と同じ決め方にそろえる。
  const faceBitmapsRef=useRef([]);
  useEffect(()=>{if(!canvasNotes||monsterFaceHidden){faceBitmapsRef.current=[];return undefined;}let cancelled=false;
    // ★焼き直すあいだは前の絵を使い続ける(画質「自動」で曲の途中に焼き直すとき、顔が一瞬消えないように)
    const deviceDpr=typeof window!=='undefined'&&window.devicePixelRatio>0?window.devicePixelRatio:1;
    const dpr=Math.min(deviceDpr,noteCanvasMaxDpr);
    monsters.forEach((monster,index)=>{rhythmBakeMonsterFace(monster,dpr).then(face=>{if(!cancelled&&face)faceBitmapsRef.current[index]=face;});});
    return()=>{cancelled=true;};
  },[canvasNotes,monsterSignature,monsterFaceHidden,settings.lightweightMode,settings.effectAmount,noteCanvasMaxDpr]);
  // レーン枠・サブレーン境界・サブレーン発光も、遊んでいるあいだは中身が変わらない。
  // 発光の ON/OFF は setPressedLanes が直接DOMへ書くので、Reactが作り直す必要はない。
  // 押したレーンの光(2026-09-26 見直し)。奥の端から手前の端までなめらかに光り、判定ラインのところがいちばん明るい。
  // いちばん明るい位置は判定ラインの高さの設定(--mh-judgment-line-bottom)に合わせて動く。
  // ★ぼかしの影(box-shadow)と filter は付けない。以前は付けていて、押すたびにぼかしを描き直していた。
  //   付けなければ、出した瞬間に1回描いたあとは透明度が変わるだけなので軽い。
  //   canvas の光の柱も試したが、canvas は毎フレーム全体を描き直すので、光る面が広いと叩き続けたときに
  //   フレームが4割減った(実測)。そのため部品(DOM)の光へ戻した。消え方は CSS の transition(rhythm-mode.js)
  const RHYTHM_LANE_PRESS_GRADIENT='linear-gradient(to bottom,rgba(96,165,250,.16) 0%,rgba(96,165,250,.28) 40%,rgba(125,211,252,.44) calc(100% - var(--mh-judgment-line-bottom,20%) - 14%),rgba(224,242,254,.74) calc(100% - var(--mh-judgment-line-bottom,20%) - 3%),rgba(248,250,252,.9) calc(100% - var(--mh-judgment-line-bottom,20%)),rgba(147,197,253,.5) calc(100% - var(--mh-judgment-line-bottom,20%) + 4%),rgba(96,165,250,.34) 100%)';
  const laneElements=useMemo(()=><><div className="pointer-events-none absolute inset-0 grid" style={{gridTemplateColumns:`repeat(${RHYTHM_LANE_COUNT},minmax(0,1fr))`}}>{Array.from({length:RHYTHM_LANE_COUNT},(_,lane)=><div key={lane} data-rhythm-lane={lane} data-pressed="false" aria-hidden="true" className="relative border-r border-white/20 bg-slate-900/40" style={{/* ★filter をここへ入れない。押したレーンの filter を変えると、変化の60msのあいだ そのレーンが毎フレーム作り直しになる(2026-09-12・実機のカクつき調査) */transition:settings.lightweightMode?'none':'background-color 60ms linear, box-shadow 60ms linear, border-color 60ms linear',borderBottom:'3px solid transparent',boxSizing:'border-box'}}></div>)}</div><div className="pointer-events-none absolute inset-0" aria-hidden="true">{Array.from({length:RHYTHM_LANE_COUNT},(_,index)=><i key={index} data-rhythm-sublane-boundary="" />)}</div><div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{"--mh-lane-glow":settings.laneGlow==='NONE'?'0':settings.laneGlow==='LOW'?'.35':'1'}}>{/* ★will-change は置かない。以前はサブレーンの数だけすべてに willChange:"opacity" を常時付けていたが、 will-change は「これから変わる」と前もって伝えるものなので、付けっぱなしにすると 押していないあいだも10枚が合成レイヤーとして居座り続ける。opacity の45msの変化は will-change 無しでも十分間に合う(2026-09-12・実機のカクつき調査)。 */}{Array.from({length:RHYTHM_SUB_LANE_COUNT},(_,subLane)=><i key={subLane} data-rhythm-sublane-feedback={subLane} data-pressed="false" className="absolute inset-0 opacity-0" style={{clipPath:rhythmSubLanePolygon(subLane),background:RHYTHM_LANE_PRESS_GRADIENT}}/>)}</div></>,[settings.lightweightMode,settings.effectAmount,settings.laneGlow]);
  const monsterForNote=note=>{const slot=rhythmNoteMonsterSlot(note);return slot?monstersRef.current[slot-1]||null:null;};
  // --- 両サイドのマスモン ---
  // レーンの外側に空いている三角形へ、設定したマスモンを置いて拍に合わせて跳ねさせる。
  // 跳ねるのはCSSアニメーションなので毎フレームのJSは走らない。置き場所と大きさは
  // rhythmLayoutSideMonsters が、プレイエリアの大きさが変わったときだけ測り直す。
  const sideMonsterRefs=useRef([]),screenFlashRef=useRef(null),judgmentTextRef=useRef(null),comboRef=useRef(null);
  // 判定文字の光を焼いた絵にする(rhythmBakeJudgmentHalos の説明を参照)。演出量・軽量モードで影の枚数が変わるので、そのたびに焼き直す。
  // 焼けるまで・焼けなかったとき・影が1枚だけの判定は、今までどおり CSS のぼかしで出す(haloKeys に入っていない)。
  const [haloKeys,setHaloKeys]=useState(null);
  useEffect(()=>{
    let cancelled=false,made=null;
    setHaloKeys(null);
    const textEl=judgmentTextRef.current;
    if(!textEl||typeof document==='undefined')return undefined;
    rhythmBakeJudgmentHalos(textEl,rhythmRenderQualityCap(renderQualityStill,2)).then(baked=>{
      if(!baked)return;
      if(cancelled){baked.forEach(item=>URL.revokeObjectURL(item.url));return;}
      made=baked;
      let style=document.querySelector('style[data-rhythm-judgment-halo-style]');
      if(!style){style=document.createElement('style');style.setAttribute('data-rhythm-judgment-halo-style','');document.head.appendChild(style);}
      style.textContent=baked.map(item=>`[data-rhythm-judgment-text][data-halo="1"][data-judgment="${item.judgment}"]${item.precise?'[data-judgment-precise="1"]':':not([data-judgment-precise="1"])'}::before{background-image:url("${item.url}");width:${item.width.toFixed(4)}em;height:${item.height.toFixed(4)}em}`).join('\n');
      setHaloKeys(new Set(baked.map(item=>`${item.judgment}|${item.precise}`)));
    }).catch(()=>{});
    return()=>{cancelled=true;const style=document.querySelector('style[data-rhythm-judgment-halo-style]');if(style)style.textContent='';if(made)made.forEach(item=>URL.revokeObjectURL(item.url));};
  },[settings.effectAmount,settings.lightweightMode,renderQualityStill]);
  // ライフの強調(2026-09-12)。DOM へ data 属性を書くだけで、判定・スコア・ライフの数値には触らない。
  // lifeBoxRef … 減った瞬間にHUDのライフ表示を揺らす／lifeDamageRef … 減った量(「-50」)を一瞬出す
  const lifeBoxRef=useRef(null),lifeDamageRef=useRef(null);
  // ===== 背景の演出(ライブ背景。2026-09-24・ユーザー指示「全体的に地味だから設定ありきで派手な感じにしたい」) =====
  // 置くのはプレイエリアのいちばん奥(z-index:-1)。レーン・ノーツ・判定ライン・HUDより必ず後ろなので、
  // 入力にも判定にも触らない(pointer-events:none)。
  // ★重さに気をつける。ぼかしは CSS の filter を使わず、ジャケットを 24×24 の canvas へ一度だけ縮めて描き、
  //   それを引き伸ばして「ぼけた絵」にする(引き伸ばしの補間でぼける。毎フレームの作り直しが起きない)。
  //   動かすのは transform と opacity だけ(合成だけで済むもの)。
  const stageLevel=rhythmStageLevel(settings);
  const stageArtRef=useRef(null),stagePulseRef=useRef(null);
  const stageArtSrc=stageLevel!=='SIMPLE'&&typeof rhythmSongArtSrc==='function'?rhythmSongArtSrc(song):'';
  // 曲名のとなりに出す小さなジャケット(ライブ背景の設定とは関係なく、絵がある曲なら出す)
  const hudArtSrc=typeof rhythmSongArtSrc==='function'?rhythmSongArtSrc(song):'';
  useEffect(()=>{
    const canvas=stageArtRef.current;
    if(!canvas||!stageArtSrc)return;
    let alive=true;const img=new Image();
    img.onload=()=>{if(!alive)return;try{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);canvas.dataset.ready='1';}catch(_){}};
    img.src=stageArtSrc;
    return()=>{alive=false;img.onload=null;};
  },[stageArtSrc]);
  const sideMonsterElements=useMemo(()=>{
    if(settings.sideMonsterOpacity==='OFF')return null;
    const opacity=rhythmSideMonsterOpacityValue(settings.sideMonsterOpacity);
    return <div data-rhythm-side-monsters aria-hidden="true" className="pointer-events-none absolute inset-0">
      {monsters.map((monster,index)=>{
        if(!monster||!monster.imageUrl)return null;
        const slot=index+1;
        // ★マスモンの動きは**専用の設定(両サイドのマスモン｜動き)だけ**で決める。
        //   演出量では止めない(2026-09-13・ユーザー指摘「マスモンの動きが演出量で
        //   制御されてる / マスモンの動きは別に設定がある」)。
        //   軽量モードだけは「重いものを一括で止める」スイッチなので、ここでも止める。
        return <span key={slot} ref={el=>{sideMonsterRefs.current[index]=el;}}
          data-rhythm-side-monster={slot}
          data-rhythm-side-motion={settings.lightweightMode?'NONE':settings.sideMonsterMotion}
          data-rhythm-side-active="0"
          data-rhythm-side-phase="intro"
          style={{'--rhythm-side-opacity':opacity,'--rhythm-side-delay':`${index%2===0?0:-250}ms`}}>
          {/* 絵の入れ物を1枚はさむ。跳ねる動き(transform)は外のspanが使っているので、
              能力中の「さらに大きく見せる」はこちらのtransformで出す(重ねて書けないため)。
              DyedMonsterImage は染色ありのとき<div>で返るので、
              **className で大きさを渡さないと中身が0pxになって何も見えない**(実機で発生) */}
          <span data-rhythm-side-monster-art>
            {/* 焼いた絵ができていればそれを1枚出す(sideArtUrls の説明を参照)。できるまでは今までどおり染色の重ね絵で出す */}
            {sideArtUrls[index]
              ?<img data-rhythm-side-monster-baked src={sideArtUrls[index]} alt="" draggable={false} className="h-full w-full object-contain"/>
              :<DyedMonsterImage baseId={monster.baseId} src={monster.imageUrl} alt="" masuColors={monster.colors} draggable={false} className="h-full w-full object-contain"/>}
          </span>
        </span>;
      })}
    </div>;
  },[monsterSignature,settings.sideMonsterOpacity,settings.sideMonsterMotion,settings.lightweightMode,sideArtUrls]);
  // --- マスモンの能力のカットイン(2026-09-26・ユーザー指示「マスモンのカットインは重くなる気しかしないならそのへんもちゃんと確認しながら」) ---
  // 能力が出たとき、そのマスモンの絵(両サイドと同じ焼いた1枚の画像)を画面の端から差し込む。
  // ★重さ: 部品は演奏開始時にマスモンの数だけ作って使い回す(途中で要素を増やさない)。
  //   動かすのは transform と opacity だけ(CSSアニメーション)。ぼかし・影は使わない。1曲に数回しか出ない。
  // ★演奏の邪魔をしない: ノーツより後ろ(道と同じ層)に置くので、ノーツは常にカットインの上に見える。
  // 設定「マスモン｜能力のカットイン」で出さないにできる。軽量モード・演出量「最小」では出さない。
  const cutInRefs=useRef([]);
  const cutInOn=settings.monsterCutIn!==false&&!settings.lightweightMode&&settings.effectAmount!=='MINIMAL';
  const cutInElements=useMemo(()=>{
    if(!cutInOn)return null;
    return <div data-rhythm-cutin aria-hidden="true">
      {monsters.map((monster,index)=>{
        if(!monster||!sideArtUrls[index])return null;
        return <div key={index+1} ref={el=>{cutInRefs.current[index]=el;}} data-rhythm-cutin-slot={index+1} data-side={index%2===0?'left':'right'}>
          <i data-rhythm-cutin-band/><img src={sideArtUrls[index]} alt="" draggable={false} decoding="async"/>
        </div>;
      })}
    </div>;
  },[cutInOn,monsterSignature,sideArtUrls]);
  const abilityTimerRef=useRef(null),abilityRevisionRef=useRef(0),abilityBadgeRef=useRef(null);
  const emptyCounts=()=>Object.fromEntries(RHYTHM_JUDGMENT_IDS.map(id=>[id,0]));
  // HOLD/SLIDEの追従を難易度ごとにやさしくする値を、演奏を始めるときにノーツへ焼き込む。
  // 譜面データ(data/rhythm-mode.js)は触らないので、保存データにもランキングにも影響しない。
  // 判定の関数は note からこの2つを読む(rhythmSlideTrackingTolerance / evaluatePosition)。
  // チェックポイント(判定線)の間隔は「難易度 × その譜面のレベル」で決まる。
  // 譜面データそのものは触らず、演奏を始めるときにノーツ1つ1つへ焼き込む
  // (追従の許容・猶予と同じやり方。保存データにもランキングにも影響しない)。
  const makeRuntimeNotes=()=>{const tracking=rhythmSlideTrackingFor(difficulty.id);const checkpointIntervalMs=rhythmSlideCheckpointIntervalMs(difficulty.id,chart?.level);return chart.notes.map((note,index)=>({...note,index,done:false,activePointerId:null,holdJudgment:null,holdDeltaMs:0,_rhythmSlideToleranceBonusLanes:tracking.toleranceBonusLanes,_rhythmTrackingGraceMs:tracking.graceMs,...(note.type==='SLIDE'?{_rhythmSlideRenderPoints:rhythmSlidePoints(note),_rhythmSlideCheckpoints:rhythmSlideCheckpointTimes(note,checkpointIntervalMs)}:{})}));};
  const initialView=()=>({status:'loading',score:0,combo:0,maxCombo:0,last:'',lastPrecise:false,fastSlow:'',counts:emptyCounts(),fast:0,slow:0,precise:0,life:RHYTHM_LIFE_MAX,ability:null,result:null});
  const [view,setView]=useState(initialView);
  /* 演奏を始める前のカウントダウン(READY→3→2→1)。
     null のあいだは出さない。曲と毎フレームの処理はこれが終わってから動かす */
  const [countdownStep,setCountdownStep]=useState(null);
  const countdownTimerRef=useRef(null);
  const countdownResolveRef=useRef(null);
  /* ポーズから戻るときも 3→2→1 と数えてから曲を動かす。
     それまでは「再開」を押した瞬間に曲が動き出し、指を構え直すあいだに
     流れてきたノーツを落としていた。true のあいだはポーズメニューを隠して、
     止まったままのノーツ(最後に描いた場面)を見せる */
  const [resumeCountdown,setResumeCountdown]=useState(false);
  const resumingRef=useRef(false);
  // ポーズした時点の曲の位置(ミリ秒)。ポーズ画面の「いまどのあたりか」に使う
  const [pausedSongMs,setPausedSongMs]=useState(0);
  // 曲の進みぐあいのバー。毎フレーム setState せず、要素の幅を直接書き換える
  const songProgressRef=useRef(null);
  // 経過時間の文字(「0:48/2:25」)。秒が変わったときだけ毎フレームの処理が書き換える
  const songTimeRef=useRef(null);
  // 自己ベスト比(IIDXのペースメーカー)と、ずれメーター(osu!)。どちらも判定のたびに DOM へ直接書く
  const paceRef=useRef(null),meterTicksRef=useRef([]);
  // ラッキーラッシュ(アワーノーツのLUCK撃奏)。ゲージと点数は判定のたびに DOM へ直接書き、
  // RUSH中かどうかと、抽選の結果の一言だけを React の状態で持つ(変わるのは抽選のときだけ)
  const luckGaugeRef=useRef(null),luckPointsRef=useRef(null),luckBannerTimerRef=useRef(null);
  const [luckyRush,setLuckyRush]=useState(false);
  const [luckyBanner,setLuckyBanner]=useState(null);
  const luckOn=settings.luckyRush!==false&&!tutorial&&!calibrating;
  const showLuckyBanner=useCallback((text,kind)=>{if(luckBannerTimerRef.current)clearTimeout(luckBannerTimerRef.current);setLuckyBanner({text,kind,id:Date.now()});luckBannerTimerRef.current=setTimeout(()=>{luckBannerTimerRef.current=null;setLuckyBanner(null);},kind==='rush'?1400:800);},[]);
  useEffect(()=>()=>{if(luckBannerTimerRef.current)clearTimeout(luckBannerTimerRef.current);},[]);
  const timingDisplay=RHYTHM_TIMING_DISPLAYS.includes(settings.timingDisplay)?settings.timingDisplay:'STANDARD';
  /* レーンカバーの形。高さは設定の%で、横はレーンの台形(rhythmProjectionScale)に沿って切り抜く。
     台形のふちは少し曲がっているので、8か所で折って近づける(外へ1%だけはみ出させて、ふちの隙間を作らない) */
  const laneCoverStyle=useMemo(()=>{
    const percent=rhythmFiniteStep(settings.laneCover,RHYTHM_LANE_COVER_MIN,RHYTHM_LANE_COVER_MAX,RHYTHM_LANE_COVER_STEP,0);
    if(!(percent>0))return null;
    const steps=8,left=[],right=[];
    for(let i=0;i<=steps;i++){const t=i/steps,half=Math.min(50,50*rhythmProjectionScale(t*percent/100)+1);left.push(`${(50-half).toFixed(2)}% ${(t*100).toFixed(2)}%`);right.unshift(`${(50+half).toFixed(2)}% ${(t*100).toFixed(2)}%`);}
    const clip=`polygon(${left.concat(right).join(',')})`;
    return {height:`${percent}%`,clipPath:clip,WebkitClipPath:clip};
  },[settings.laneCover]);
  // 100コンボごとの演出。
  // 「段階(tier)が変わったときだけ」effectを動かすのが肝心で、以前は view.combo(=ノーツを取るたび
  // 毎回変わる値)を依存にしていたため、100→101など非節目の増加でも毎回effectが再実行され、
  // その"後片付け"がまだ生きていた表示タイマー(setTimeoutで1.1秒後にcomboMilestoneを0へ戻す処理)を
  // 節目の直後に即座に解除してしまっていた。結果、100コンボの表示だけがopacity:0のまま固まって
  // 二度と動かず、200・300では何も起きないように見えるバグになっていた。
  // tierを先に計算してそれをeffectの依存にすることで、実際に100の位が変わったときだけ動く。
  // 演出量MINIMAL・軽量モードでは出さない(端末を重くしないため)。
  // ライフが0になった瞬間だけ、画面の真ん中へ大きく「LIFE 0 / DOWN」を出す(2026-09-12)。
  // 数字を数えるのではなく「いま倒れた」と気づけるようにするためのもの。
  // ★comboMilestone と同じく、段(=0になった回数)が変わったときだけ effect を動かす。
  //   view.life を依存にすると、ライフが動くたびに後片付けが走って消すタイマーを解除してしまう。
  const [lifeDownCount,setLifeDownCount]=useState(0);
  const [lifeDownSlam,setLifeDownSlam]=useState(false);
  useEffect(()=>{
    if(lifeDownCount<=0){setLifeDownSlam(false);return;}
    setLifeDownSlam(true);
    const timer=setTimeout(()=>setLifeDownSlam(false),1400);
    return ()=>clearTimeout(timer);
  },[lifeDownCount]);
  const [comboMilestone,setComboMilestone]=useState(0);
  const comboMilestoneTier=Math.floor((Number(view.combo)||0)/RHYTHM_COMBO_MILESTONE_STEP);
  useEffect(()=>{
    if(settings.lightweightMode||settings.effectAmount==='MINIMAL'||comboMilestoneTier<=0){
      setComboMilestone(0);
      return;
    }
    setComboMilestone(comboMilestoneTier*RHYTHM_COMBO_MILESTONE_STEP);
    const timer=setTimeout(()=>setComboMilestone(0),1100);
    return ()=>clearTimeout(timer);
  },[comboMilestoneTier,settings.lightweightMode,settings.effectAmount]);
  // 100→1段階目のように、コンボが伸びるほど演出を派手にする。ただしどこまでも大きくはせず
  // 500コンボ(5段階目)で頭打ちにする(数字自体はそのまま表示する)。
  const comboMilestoneStage=Math.min(5,comboMilestoneTier);
  // ランクゲージ横の「次のランクはここまで」の表示(2026-09-04)。
  // ランクの判定・しきい値そのものは増やさず、既存のrhythmRankForScore/rhythmRankProgressが
  // 使っているのと同じRHYTHM_RANKSから素直に導く値。最上位(M)に届いたら「★MAX」を出す。
  // 難易度のmaxScore(満点)も渡し、EASYで「→S」のようなその難易度では絶対に届かない
  // 次ランクを出さないようにする(2026-09-04、Codexレビューで指摘された不具合の修正)。
  const rankNextId=rhythmNextRankId(view.score,difficulty.maxScore);
  const rankNextLabel=rankNextId?`→${rankNextId}`:'★MAX';
  // ライフとコンボの「見せ方の段」(2026-09-12)。どちらも数値そのものは変えず、
  // CSSへ渡す data 属性と拡大率を決めるだけ。
  const lifeRatio=rhythmLifeRatio(view.life);
  const lifeState=rhythmLifeState(view.life);
  const comboTier=rhythmComboTier(view.combo);
  // ライブ背景「派手」のサーチライトと光の粒を、1度だけ画像に焼く(RHYTHM_STAGE_* の説明を参照)。
  // 大きさはプレイエリアから決めるので、画面の大きさが変わったら焼き直す。サーチライトは色の段ごとに4枚
  const stageTierNow=Math.min(3,Math.floor(comboTier/2));
  const stageHostRef=useRef(null);
  const [stageImages,setStageImages]=useState(null);
  const stageFxOn=stageLevel==='VIVID'&&settings.effectAmount!=='MINIMAL';
  useEffect(()=>{
    const host=stageHostRef.current;
    if(!host||!stageFxOn||typeof window==='undefined'||typeof document==='undefined')return undefined;
    let alive=true,made=[],timer=0,lastKey='';
    const toUrl=canvas=>new Promise(resolve=>{try{canvas.toBlob(blob=>resolve(blob?URL.createObjectURL(blob):null),'image/png');}catch(e){resolve(null);}});
    const bake=async()=>{
      const w=host.clientWidth,h=host.clientHeight;
      if(!(w>0&&h>0))return;
      // ぼけた光なので画素密度は1.5倍まで(以前は画面の画素数そのまま)
      // 画質「標準」は1.25倍、「省電力」は1倍
      const cap=renderQualityStill==='STANDARD'?1.25:rhythmRenderQualityCap(renderQualityStill,1.5);
      const scale=Math.min(cap,Math.max(1,Number(window.devicePixelRatio)||1));
      const key=`${w}x${h}@${scale}`;
      if(key===lastKey)return;
      lastKey=key;
      const canvasOf=(cw,ch)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(cw*scale));c.height=Math.max(1,Math.round(ch*scale));const g=c.getContext('2d');if(g)g.setTransform(scale,0,0,scale,0,0);return [c,g];};
      const bw=.38*w,bh=1.35*h;
      const beams=await Promise.all(RHYTHM_STAGE_BEAM_COLORS.map(color=>{const [c,g]=canvasOf(bw,bh);if(!g)return null;rhythmDrawStageBeam(g,0,0,bw,bh,0,color,1);return toUrl(c);}));
      const sparks=await Promise.all(RHYTHM_STAGE_SPARKS.map(layer=>{
        const [c,g]=canvasOf(w,h*2);if(!g)return null;
        const sprite=rhythmStageSparkSprite(layer,scale),size=sprite.width/scale;
        for(const [px,py] of layer.dots)for(const k of [0,1])g.drawImage(sprite,px/100*w-size/2,py/100*h+k*h-size/2,size,size);
        return toUrl(c);
      }));
      const urls=[...beams,...sparks];
      if(!alive||urls.some(url=>!url)){urls.forEach(url=>{if(url)URL.revokeObjectURL(url);});return;}
      const old=made;made=urls;
      setStageImages({beams,sparks});
      // 差し替えた古い画像は、読み替えが終わったころに片付ける
      setTimeout(()=>old.forEach(url=>URL.revokeObjectURL(url)),1000);
    };
    bake();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(bake,150);}):null;
    if(observer)observer.observe(host);
    return()=>{alive=false;clearTimeout(timer);if(observer)observer.disconnect();setStageImages(null);made.forEach(url=>URL.revokeObjectURL(url));};
  },[stageFxOn,renderQualityStill]);
  /* フルコンボ・オールマーベラスが続いているか(プロセカ・CHUNITHM のコンボ色)。「COMBO」の字の色で見せる。
     AM=ここまで全部MARVELOUS / FC=ここまでBAD・MISSなし / 空=切れた。設定で出さないこともできる */
  /* アシストモードでは称号が付かないので出さない(出すと「取れる」と思わせてしまう) */const comboStatus=(()=>{if(settings.comboStatusDisplay===false||assistOn||!view.counts)return '';const c=view.counts;if((Number(c.BAD)||0)+(Number(c.MISS)||0)>0)return '';return (Number(c.EXCELLENT)||0)+(Number(c.GREAT)||0)+(Number(c.GOOD)||0)>0?'FC':'AM';})();
  // コンボ数の置き場所(2026-09-12・ユーザー指示)。座標は index.html の
  // [data-combo-pos="…"] が持つので、ここは名前をそのまま属性へ渡すだけ。
  const comboPosition=RHYTHM_COMBO_POSITIONS.includes(settings.comboPosition)?settings.comboPosition:'CENTER';
  // 横画面向けHUD配置(§6.2)で使う。曲名の折り返し行数(WebkitLineClamp)はインラインstyleで
  // 決めるためTailwindのlandscape:だけでは切り替えられず、ここだけJSの向き判定を使う。
  // ほかのHUDレイアウトの出し分けはTailwindのlandscape:バリアントで完結させ、判定・スコア・
  // runには一切触らない(§6.1)。
  // 自前で画面を回しているあいだも「横向き」として扱う(端末は縦のままなので
  // matchMedia だけでは縦と答える)。orientationIsLandscape がその両方を見ている。
  const [isLandscape,setIsLandscape]=useState(()=>orientationIsLandscape());
  useEffect(()=>{
    if(typeof window==='undefined'||typeof window.matchMedia!=='function')return;
    const mql=window.matchMedia('(orientation: landscape)');
    const onChange=()=>setIsLandscape(orientationIsLandscape());
    onChange();
    // 自前で回したときは端末の向きが変わらないので matchMedia は鳴らない
    const unsubscribeRotation=RHYTHM_VIEW_ROTATION.subscribe(onChange);
    if(mql.addEventListener)mql.addEventListener('change',onChange);else mql.addListener?.(onChange);
    return()=>{
      unsubscribeRotation();
      if(mql.removeEventListener)mql.removeEventListener('change',onChange);else mql.removeListener?.(onChange);
    };
  },[]);
  /* ===== 経過時間の箱の置き場所(2026-09-25) =====
     縦持ちと「🔄 横」で回した横画面では、左上のスコア表示のすぐ下・レーンの左ふちへ寄せて置く。
     右上に置いていたころは、ラッキーゲージと自己ベスト比が加わって縦に伸び、右上のコンボ数と重なっていた
     (重なりを測る確認で見つかった)。左ならコンボ数・ライフ・ポーズ(どれも右)と離れ、自己ベスト比もスコアの近くになる。
     ★高さは曲名の折り返しで変わるので、左上の表示の下端を実測して決める。横はレーンの台形のふちから決める。
     ★縦持ち・横持ち・回した横画面のどれも同じ置き方にする */
  const hudLeftRef=useRef(null);
  // スコアの右隣へ置くのに要る幅。「0:24/2:24」に縮めた進みぐあいのバー(20px以上)を添えた1行が収まる幅。
  // 自己ベスト比は長いと末尾が「…」になるが、ふつうの点差(±99,999まで)は収まる
  const RHYTHM_CLOCK_SIDE_MIN_WIDTH=100;
  const [clockPlace,setClockPlace]=useState(null);
  // ★端末を横にした横画面も左へ置く。右上(ライフの下)のままだと、ゲージと自己ベスト比のぶん縦に伸びて、横持ちのコンボ数とレーンにかかった
  const clockOnLeft=true;
  useEffect(()=>{
    if(!clockOnLeft){setClockPlace(null);return;}
    let frame=0;
    const measure=()=>{
      const area=playAreaRef.current,hud=hudLeftRef.current;
      if(!area||!hud)return;
      const ar=RHYTHM_VIEW_ROTATION.rectOf(area),hr=RHYTHM_VIEW_ROTATION.rectOf(hud);
      if(!(ar&&hr&&ar.width>0&&ar.height>0))return;
      const laneLeftAt=y=>ar.width/2-ar.width/2*rhythmProjectionScale(Math.min(1,Math.max(0,y)/ar.height));
      /* ★スコア表示の右隣(レーンの左ふちまで)が空いていれば、そこへ置く(2026-09-26・ユーザー指示
         「残り時間の位置がモンスターとかぶってて気になる / もうちょい上のエリアが空いてるからそっちに移動して」)。
         横画面ではスコアの下に左上のマスモンが来るので重なっていた。縦画面は隙間が20px前後しかないので、今までどおりスコアの下 */
      const sideTop=Math.max(4,Math.round(hr.top-ar.top)),sideLeft=Math.round(hr.right-ar.left)+12;
      const sideWidth=Math.floor(laneLeftAt(sideTop+48)-10-sideLeft);
      if(sideWidth>=RHYTHM_CLOCK_SIDE_MIN_WIDTH){
        setClockPlace(prev=>prev&&prev.top===sideTop&&prev.left===sideLeft&&prev.width===sideWidth?prev:{top:sideTop,left:sideLeft,width:sideWidth});
        return;
      }
      const top=Math.round(hr.bottom-ar.top+8),bottom=top+44;
      const laneLeft=laneLeftAt(bottom);
      const width=Math.max(60,Math.floor(laneLeft-12-6));
      setClockPlace(prev=>prev&&prev.top===top&&prev.left===12&&prev.width===width?prev:{top,left:12,width});
    };
    measure();frame=requestAnimationFrame(measure);const later=setTimeout(measure,400);
    window.addEventListener('resize',measure);
    return()=>{cancelAnimationFrame(frame);clearTimeout(later);window.removeEventListener('resize',measure);};
  },[clockOnLeft,song.songId,view.status]);
  /* 横持ちのライフゲージの長さの上限(2026-09-25)。ライフ表示を200%にすると、左はしのハートがレーンのふちに7pxほどかかっていた。
     横持ちの器は「🔄 横」で回したときも端末の幅(vw)と合わないので、CSSの vw では決められない。器の幅を測って上限を渡す。
     上限 = 器の幅×0.38 − 150px(ライフの行の右はしはポーズの手前、左はしはレーンの右ふち+8px。そこからハートと数字の幅を引いたもの) */
  useEffect(()=>{
    const box=lifeBoxRef.current;
    if(!box)return;
    if(!isLandscape){box.style.removeProperty('--mh-life-track-max');return;}
    const apply=()=>{const area=playAreaRef.current;const ar=area?RHYTHM_VIEW_ROTATION.rectOf(area):null;if(!(ar&&ar.width>0))return;box.style.setProperty('--mh-life-track-max',`${Math.max(60,Math.floor(ar.width*0.38-150))}px`);};
    apply();const later=setTimeout(apply,400);window.addEventListener('resize',apply);
    return()=>{clearTimeout(later);window.removeEventListener('resize',apply);};
  },[isLandscape,view.status]);
  const stopFrame=useCallback(()=>{if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);frameRef.current=null;},[]);
  const clearJudgmentTimer=useCallback(()=>{if(judgmentTimerRef.current!==null)clearTimeout(judgmentTimerRef.current);judgmentTimerRef.current=null;++judgmentRevisionRef.current;},[]);
  const scheduleJudgmentClear=useCallback(()=>{if(judgmentTimerRef.current!==null)clearTimeout(judgmentTimerRef.current);const revision=++judgmentRevisionRef.current;judgmentTimerRef.current=setTimeout(()=>{if(revision!==judgmentRevisionRef.current)return;judgmentTimerRef.current=null;setView(v=>({...v,last:'',lastPrecise:false,fastSlow:''}));},RHYTHM_JUDGMENT_DISPLAY_MS);},[]);
  // 能力の発動表示(「ミーア　元気！」)は短時間で消す。判定表示とは別のタイマーで持つ
  const clearAbilityTimer=useCallback(()=>{if(abilityTimerRef.current!==null)clearTimeout(abilityTimerRef.current);abilityTimerRef.current=null;++abilityRevisionRef.current;},[]);
  /* カウントダウンの後始末。disposeRun がこれを呼ぶので、必ず disposeRun より前で定義する。
     const は「使う場所より後ろ」に書くと初期化前アクセスで画面が真っ白になる */
  const clearCountdown=useCallback(()=>{
    if(countdownTimerRef.current){clearTimeout(countdownTimerRef.current);countdownTimerRef.current=null;}
    /* 待っている側(beginRun の await)へも必ず答えを返す。
       タイマーを消すだけだと次の step が走らず、Promise が解決されないまま残り、
       そのプレイぶんの beginRun がずっと止まったままになる(リスタートのたびに1つ増える) */
    if(countdownResolveRef.current){const resolve=countdownResolveRef.current;countdownResolveRef.current=null;resolve(false);}
    setCountdownStep(null);
  },[]);
  const scheduleAbilityClear=useCallback(()=>{if(abilityTimerRef.current!==null)clearTimeout(abilityTimerRef.current);const revision=++abilityRevisionRef.current;abilityTimerRef.current=setTimeout(()=>{if(revision!==abilityRevisionRef.current)return;abilityTimerRef.current=null;setView(v=>({...v,ability:null}));},RHYTHM_MONSTER_ABILITY_DISPLAY_MS);},[]);
  // プレイエリア・判定ライン・ノーツの箱の大きさは、画面が回転・リサイズされない限り変わらない。
// (ノーツは absolute の固定高さで、奥行きの拡大は子要素のtransformなので外側の高さに響かない)
// それなのに毎フレーム getBoundingClientRect を3回呼んでいたため、直前のフレームで数百個の
// ノーツへ書き込んだスタイルを、毎フレーム強制的に計算し直させていた。ノーツが増える譜面ほど重く、
// これが実機のカクつきの主因だった。測った結果を覚えておき、変わりうるときだけ測り直す。
const travelCacheRef=useRef(null);
// 測った寸法が「遊べる形」になっているか。
// 高さが0でないことだけを見ていたため、まだ組み上がっていない最中の値
// (Tailwindが効く前・絵の読み込み前・画面の回転中など)をそのまま覚えてしまい、
// ノーツが画面の外に置かれたまま固定されて、判定(MISS)だけが進む状態になっていた
// (2026-09-05・実機の指摘「初回起動時はよくこの状態になる」)。
// リスタートで直っていたのは、そのとき覚えた値を捨てていたからにすぎない。
const rhythmTravelLooksReady=(areaRect,lineRect)=>{
  if(!(areaRect.height>0&&areaRect.width>0))return false;
  // 画面より大きいプレイエリアは、まだ中身が積み上がっている最中。
  // (実測: レイアウトが効く前は 844pxの画面で 3352px になっていた)
  const viewportHeight=typeof window!=='undefined'&&window.innerHeight>0?window.innerHeight:0;
  if(viewportHeight>0&&areaRect.height>viewportHeight*1.5)return false;
  // 逆に、画面に対して極端に小さいプレイエリアも「まだ組み上がっていない」。
  // ノーツを canvas 1枚へ描くようにしてから(2026-09-07)、スタイルが効く前の崩れ方が
  // 「要素が縦に積み上がって大きくなる」から「中身が絶対配置だけになって潰れる」へ変わった。
  // (実測: 844pxの画面で 18px)。この値を遊べる形とみなすと、見えないノーツをMISSにして
  // ライフだけが減る――2026-09-05の不具合がそのまま裏返しの形で戻る
  if(viewportHeight>0&&areaRect.height<viewportHeight*0.25)return false;
  // 判定ラインに厚みが無いなら、まだ形が決まっていない。
  // 以前は「中心がエリアの中にあること」しか見ておらず、線が高さ0のまま
  // エリアの先頭に居る状態(スタイルが効く前)をそのまま通していた
  if(!(lineRect.height>0))return false;
  const lineCenter=lineRect.top+lineRect.height/2;
  if(!(lineCenter>=areaRect.top&&lineCenter<=areaRect.bottom))return false;
  // 判定ラインは下から12%の位置に置く。エリアの上半分に居るなら、
  // まだ置き場所が決まっていない(高さ0でなくても、位置だけ未確定のことがある)
  // ★上限(下から32%)まで上げても、ラインの中心はエリアの68%のあたりに残る。
  //   余裕を見て上半分を少しだけ入れたところで区切る
  if(!(lineCenter>areaRect.top+areaRect.height*0.45))return false;
  return true;
};
const measureTravel=useCallback(()=>{
  const cached=travelCacheRef.current;
  if(cached)return cached;
  const area=playAreaRef.current,line=judgmentLineRef.current;
  if(!area||!line)return null;
  RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();RHYTHM_PERF.layoutRead();
  const areaRect=RHYTHM_VIEW_ROTATION.rectOf(area),lineRect=RHYTHM_VIEW_ROTATION.rectOf(line),noteHeight=RHYTHM_VIEW_ROTATION.rectOf(laneRefs.current.find(Boolean))?.height||20;
  const spawnY=-noteHeight+(settings.noteStartPosition/100)*areaRect.height*.2;
  const judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2;
  // ready:false は「まだノーツを正しい場所へ置けない」。判定を進めてよいかの目印にも使う
  const ready=rhythmTravelLooksReady(areaRect,lineRect);
  // ★HOLD/SLIDEの追従は「判定ラインの高さ」でレーンを測る。
  //   ラインを動かせるようにしたので、決めうちの .88 ではなく**実測した位置**を渡す
  if(ready)RHYTHM_JUDGMENT_LINE_Y.set((lineRect.top-areaRect.top+lineRect.height/2)/areaRect.height);
  const result={spawnY,judgmentY,travelPx:judgmentY-spawnY,playAreaHeight:areaRect.height,rect:areaRect,noteHeight,ready};
  // 組み上がっていると確かめられたときだけ覚える。そうでなければ毎フレーム測り直し、
  // 整った瞬間から正しい位置で流れ始める(遊べない状態のまま固定されない)
  if(ready)travelCacheRef.current=result;
  return result;
},[settings.noteStartPosition,settings.judgmentLineHeight]);
// --- 判定ラインの「幅」を描く ---
// 上下のふちがGOOD(前後0.17秒)の端、内側の明るいところがMARVELOUS(前後0.055秒)。
// 何ピクセルになるかはノーツ速度(travelMs)と画面の高さで変わるので、実測から毎回出す。
// 書き込むのは「前と違うときだけ」。位置が変わらないフレームでは何もしないので、
// 毎フレームの塗り直しは増えない。判定・スコアには一切関与しない見た目だけの処理。
const updateJudgmentBand=useCallback((travel,travelMs)=>{
  const el=judgmentBandRef.current;
  if(!el)return;
  const layout=travel&&travel.ready?rhythmJudgmentBandLayout(travel,travelMs):null;
  if(!layout){
    if(el._rhythmBandKey!=='off'){el.style.opacity='0';el._rhythmBandKey='off';}
    return;
  }
  const top=Math.round(layout.top),height=Math.round(layout.height);
  const centerPercent=Math.max(4,Math.min(96,layout.centerRatio*100));
  const key=`${top}/${height}/${centerPercent.toFixed(1)}`;
  if(el._rhythmBandKey===key)return;
  el._rhythmBandKey=key;
  const near=(centerPercent*.55).toFixed(1),far=(centerPercent+(100-centerPercent)*.45).toFixed(1);
  el.style.top=`${top}px`;
  el.style.height=`${height}px`;
  el.style.opacity='1';
  el.style.background='linear-gradient(180deg,rgba(103,232,249,0) 0%,'
    +`rgba(103,232,249,.10) ${near}%,`
    +`rgba(217,70,239,.17) ${centerPercent.toFixed(1)}%,`
    +`rgba(103,232,249,.10) ${far}%,`
    +'rgba(103,232,249,0) 100%)';
  const core=el.querySelector('[data-rhythm-judgment-core]');
  if(core){
    core.style.top=`${Math.round(layout.marvelousTop-layout.top)}px`;
    core.style.height=`${Math.max(2,Math.round(layout.marvelousBottom-layout.marvelousTop))}px`;
  }
},[]);
// 覚えている寸法が今も正しいか。プレイエリアの大きさが変わったら捨てて測り直す。
// 絵の読み込みが終わった・画面が回った・セーフエリアが確定した、はどれも resize を
// 起こさないことがあるので、window の resize だけでは取りこぼす。
useEffect(()=>{
  const area=playAreaRef.current;
  if(!area||typeof ResizeObserver==='undefined')return;
  // 監視するだけでDOMは書き換えないので、自分の変化で自分がまた呼ばれる心配はない
  const observer=new ResizeObserver(()=>{travelCacheRef.current=null;});
  observer.observe(area);
  return ()=>observer.disconnect();
},[]);
// 画面の大きさが変わったら測り直す。設定(開始位置・ノーツサイズ)を変えたときと、
// プレイの状態が切り替わった直後も、いったん捨てて測り直す。
useEffect(()=>{
  travelCacheRef.current=null;
  if(typeof window==='undefined')return;
  const invalidate=()=>{travelCacheRef.current=null;};
  window.addEventListener('resize',invalidate);
  window.addEventListener('orientationchange',invalidate);
  return ()=>{window.removeEventListener('resize',invalidate);window.removeEventListener('orientationchange',invalidate);};
},[settings.noteStartPosition,settings.noteSize,settings.judgmentLineHeight,view.status]);
  const applyJudgment=useCallback((note,judgment,deltaMs)=>{const _judgeT0=RHYTHM_PERF.enabled&&typeof performance!=='undefined'?performance.now():0;const run=runRef.current;if(!run||run.finished||run.paused||note.done)return;if(note.activePointerId!==null){if(note.activePointerId!==-1)run.activePointers.delete(note.activePointerId);note.activePointerId=null;}note.releasedAtMs=null;rhythmFloatingNoteRemove(note);note.done=true;note._rhythmFinalJudgment=judgment;
// MARVELOUSの中でも、とくにぴったり(±20ms)だったか。**見た目にしか使わない**(2026-09-12)。
// 判定の名前・スコア・コンボ・ライフ・判定数・FAST/SLOWの数え方には一切入れないので、
// run にも result にも残さない。judgmentTimingOffsetMs を通したあとのズレを見ている
const preciseHit=rhythmJudgmentIsPrecise(judgment,deltaMs);
// タイミング合わせのときだけ、叩いたずれをそのまま貯める(2026-09-13・ユーザー指示
// 「普通に実際の画面を使ってやればいい / そこで判定も合わせて出して調整するのが1番合う」)。
// ★判定・スコア・コンボ・ライフ・判定数・FAST/SLOWの数え方には一切入れない。貯めるだけ。
// ★MISSは入れない(叩けていないので、そのずれは意味を持たない)。
if(calibrating&&judgment!=='MISS'&&typeof deltaMs==='number'&&Number.isFinite(deltaMs)){if(!Array.isArray(run.deltas))run.deltas=[];run.deltas.push(deltaMs);}
// HOLD / SLIDE を最後まで取れた・FLICKが成立したときは、そこで音と光を返す。
// TAPは指を置いた時点で音が鳴っているので対象にしない。
// (実機で「フリックが成功したのか分かりづらい」「取れた手ごたえがほしい」という報告があった)
const clearedGesture=judgment!=='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note)||note._rhythmOriginalType==='FLICK');
if(clearedGesture){
  RHYTHM_NOTE_SE_RUNTIME.playClear();
  // 光は演出量の設定に従う(MINIMAL・軽量モードでは出さない)。音は設定に関わらず鳴らす
  if(!settings.lightweightMode&&!rhythmEffectAtMost(settings.effectAmount,'LIGHT'))note._rhythmClearAt=run.audio?.songTimeMs?.()??0;
}
// --- 取れたノーツを判定ラインで弾けさせる(2026-09-05「画面演出はあまりかわってない」への対応) ---
// 要素は使い回すので、押すたびにDOMは増えない。動くのは transform と opacity だけ。
// モンスターノーツは1曲に最大4回しか来ないので、光を大きく長くして特別扱いにする。
// ★モンスターノーツかどうかは、演出量のブロックの外で1回だけ出す。
//   振動はここへまとめる(演出量で強さが変わっていた。振動は専用の設定の管轄)。
const monsterHit=judgment!=='MISS'&&!!monsterForNote(note);
if(judgment!=='MISS'){
  if(monsterHit)RHYTHM_NOTE_SE_RUNTIME.playMonster();
  if(!settings.lightweightMode&&settings.effectAmount!=='MINIMAL'){
    const area=playAreaRef.current;
    // 光の位置と幅はノーツと同じ投影から出す(判定ラインの高さ=1)。
    const span=rhythmNoteIsSlide(note)
      ?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,1,run.audio?.songTimeMs?.()??note.timeMs)
      :rhythmNoteVisualSpan(note,note.lane,1,run.audio?.songTimeMs?.()??note.timeMs);
    // 流し直す印はここで集めて、最後にまとめて1回のレイアウトで付け直す
    // (箇所ごとに void offsetWidth を書くと、その回数ぶんページ全体のレイアウトが走る)。
    const restarts=[];
    // モンスターノーツの演出の強さ(2026-09-13・ユーザー依頼「軽量化バージョンもほしい」)。
    //   NORMAL … 粒2.1倍 ＋ 画面全体の光 ＋ そのマスモンが大きく跳ねる
    //   LIGHT  … 画面全体の光をやめる(いちばん重いのが全画面の描き直し)。粒と跳ねは残す
    //   OFF    … 粒もふつうのノーツと同じにし、跳ねもやめる
    // ★どの段でも音・能力名・振動は残す。取れたことが分からなくなるのがいちばん困る。
    const monsterEffect=RHYTHM_MONSTER_EFFECT_LEVELS.includes(settings.monsterNoteEffect)?settings.monsterNoteEffect:DEFAULT_RHYTHM_SETTINGS.monsterNoteEffect;
    // ★段の名前を並べて比べず、必ず順位(rhythmMonsterEffectAtMost)で見る。
    //   2026-09-13、ここが `monsterEffect!=='OFF'` のままだったため、あとから足した
    //   いちばん軽い段「最小」(NONE)が素通りし、**「少なめ」より重い光**が出ていた
    //   (踏んだ瞬間に 900ms・幅1.5倍・粒2.1倍の金色の光。ふつうのノーツは340ms)。
    //   ユーザー報告「設定を最小にしても固まるときがある / 踏んだときに起こる何かが原因」。
    const bigMonsterEffect=monsterHit&&!rhythmMonsterEffectAtMost(monsterEffect,'OFF');
    const hitEffect=rhythmSpawnHitEffect(area,{centerRatio:span.center,widthRatio:span.width,judgment,monster:bigMonsterEffect,precise:preciseHit,defer:true});
    if(hitEffect)restarts.push(hitEffect);
    if(monsterHit&&monsterEffect==='NORMAL'&&screenFlashRef.current)restarts.push({el:screenFlashRef.current,attr:'rhythmFlash'});
    // そのマスモンが両サイドで大きく跳ねる(どのマスモンの番だったかが分かるように)
    // ★いちばん軽い段(NONE)では、このかたまりを丸ごと飛ばす
    //   (2026-09-13・ユーザー指摘「マスモンの表示より踏んだときの挙動だと思うんだけど」)。
    //   跳ねないのに phase を書き換えてアニメを切り替え、700msのタイマーまで張っていた。
    //   踏んだその瞬間にスタイルの計算が走るので、跳ねを出さない段では何もしないのが正しい。
    if(monsterHit&&!rhythmMonsterEffectAtMost(monsterEffect,'NONE')){
      const slot=rhythmNoteMonsterSlot(note),el=slot?sideMonsterRefs.current[slot-1]:null;
      if(el){
        // 「少なめ」では跳ねない(跳ねはそのマスモンの周りを描き直すため)
        if(!rhythmMonsterEffectAtMost(monsterEffect,'OFF'))restarts.push({el,attr:'rhythmSideHit'});
        // 出番が済んだので、このあとの待機は最初のぴょんぴょんとは別の動き(ゆらゆら)にする
        el.dataset.rhythmSidePhase='done';
        // 歓声(700ms)が終わったら印を外す。外さないと !important の指定が残り続けて
        // そのマスモンが曲の終わりまで止まったままになる(2026-09-05に出した不具合)
        setTimeout(()=>{if(el.dataset.rhythmSideHit==='1')el.dataset.rhythmSideHit='0';},RHYTHM_SIDE_CHEER_MS);
      }
    }
    // 判定文字を一度だけ弾ませる
    const judgmentText=judgmentTextRef.current;
    if(judgmentText)restarts.push({el:judgmentText,attr:'rhythmJudgmentPop'});
    // コンボ数も1つ増えるたびに弾ませる(プロセカのように数字が跳ねる)
    const comboText=comboRef.current;
    if(comboText)restarts.push({el:comboText,attr:'rhythmComboPop'});
    // ここで1回だけレイアウトを読む。集めた印をまとめて付け直す
    rhythmRestartAnimations(restarts);
  }
}
// ★振動は「タップ時の振動」の管轄。モンスターノーツだけ強めにする(指でも違いが分かるように)。
//   それまでは演出量のブロックの中で tap(26) を呼んだうえ、ここでも tap() を呼んでいて、
//   モンスターノーツでは**2回**走っていた。しかも演出量を下げると強さが変わっていた。
if(settings.vibrationEnabled&&judgment!=='MISS')RHYTHM_HAPTICS.tap(monsterHit?26:12);const nextCombo=rhythmComboAfter(run.combo,judgment);let keptCombo=nextCombo;
/* アシストモードのコンボガード(アワーノーツの「コンボ継続のアシスト」)。BAD・MISSで切れそうなコンボを、
   ガードが残っていれば代わりに受け止める。判定の数・ライフの減り方はふだんどおりで、コンボ数だけが続く。
   ガードは最大3つ。コンボをつないだ判定20回で1つたまり、最近ガードを使った(崩れている)ときは8回でたまる */
if(assistOn){const guard=run.assistGuard??RHYTHM_ASSIST_GUARD_MAX;run._assistJudged=(run._assistJudged||0)+1;
  if(nextCombo===0&&run.combo>0&&(judgment==='BAD'||judgment==='MISS')&&guard>0){run.assistGuard=guard-1;run.assistGuarded=(run.assistGuarded||0)+1;run._assistLastGuardAt=run._assistJudged;run._assistStreak=0;keptCombo=run.combo;}
  else if(nextCombo>0){run.assistGuard=guard;run._assistStreak=(run._assistStreak||0)+1;const struggling=run._assistLastGuardAt!=null&&run._assistJudged-run._assistLastGuardAt<40;if(guard<RHYTHM_ASSIST_GUARD_MAX&&run._assistStreak>=(struggling?RHYTHM_ASSIST_GUARD_RECHARGE_STRUGGLING:RHYTHM_ASSIST_GUARD_RECHARGE)){run.assistGuard=guard+1;run._assistStreak=0;}}
  else{run.assistGuard=guard;run._assistStreak=0;}}
/* ライブログ(アワーノーツの演奏後の振り返り)。ノーツの時刻と判定だけを控え、リザルトで区間ごとに数える。記録には残さない */
(run.liveLog||(run.liveLog=[])).push([Number(note.timeMs)||0,judgment]);
/* ラッキーラッシュ。うまく叩くほどゲージがたまり、満タンで抽選。RUSH中は2倍でたまり、当たりやすい。
   ★スコア・判定・コンボ・ライフには一切触らない。点数(ラッキーpt)は曲の終わりのおまけにだけ使う */
if(luckOn){const luckNow=run.audio?.songTimeMs?.()??0;const rushActive=run.luckRushUntil!=null&&luckNow<run.luckRushUntil;
  run.luckGauge=(run.luckGauge||0)+(RHYTHM_LUCK_GAIN[judgment]||0)*(rushActive?2:1);
  if(run.luckGauge>=RHYTHM_LUCK_GAUGE_MAX){run.luckGauge=0;const draw=rhythmLuckDraw(rushActive,Math.random());run.luckPoints=(run.luckPoints||0)+draw.points;run.luckDraws=(run.luckDraws||0)+1;
    if(draw.win){run.luckRushUntil=(rushActive?run.luckRushUntil:luckNow)+draw.rushMs;if(!rushActive)run.luckRushCount=(run.luckRushCount||0)+1;setLuckyRush(true);showLuckyBanner(rushActive?'RUSH 延長!':'LUCKY RUSH!!','rush');}
    else showLuckyBanner(`+${draw.points}pt`,'small');}
  const gaugeEl=luckGaugeRef.current;if(gaugeEl){const ratio=Math.min(1,run.luckGauge/RHYTHM_LUCK_GAUGE_MAX);gaugeEl.style.transform=`scaleX(${ratio.toFixed(3)})`;}
  const ptEl=luckPointsRef.current;if(ptEl&&ptEl._mhLuck!==run.luckPoints){ptEl._mhLuck=run.luckPoints||0;ptEl.textContent=`${run.luckPoints||0}pt`;}}
run.combo=keptCombo;run.maxCombo=Math.max(run.maxCombo,keptCombo);run.counts[judgment]++;if(preciseHit)run.precise++;const side=judgment==='MISS'?null:rhythmFastSlow(deltaMs);if(side)run[side.toLowerCase()]++;const songTimeMs=run.audio?.songTimeMs?.()??0;
// ライフ変化は能力(無敵・我慢)を通してから反映する。判定・コンボ・スコアそのものは変えない(§4.2)
// 練習ではライフを減らさない。途中で倒れると、まだ習っていないノーツまで届かなくなる
// lifeBefore … 減ったことを知らせる演出のためだけに控える(2026-09-12)。計算には使わない
const lifeBefore=run.life;
run.life=(tutorial||calibrating)?RHYTHM_LIFE_MAX:rhythmLifeAfterWithMonsterAbilities(run.life,judgment,run.abilities,songTimeMs);
let revived=false,abilityFlash=null;
// 根性ストックを持ったままライフが0になったら、その場で自動的にライフ50へ復活する(§4.4)
const stockRevive=rhythmConsumeKonjoStock(run.abilities,run.life);
if(stockRevive.revived){run.life=stockRevive.life;run.abilities=stockRevive.state;revived=true;abilityFlash={monster:run.konjoOwnerName||'',ability:RHYTHM_MONSTER_ABILITIES.KONJO.name};}
// モンスターノーツはGREAT以上で能力が出る(§3.4)。判定窓は専用に甘くしない
const monster=monsterForNote(note);
if(monster&&monster.ability&&rhythmMonsterAbilityTriggers(judgment)){
  const activated=rhythmActivateMonsterAbility({ability:monster.ability,state:run.abilities,life:run.life,songTimeMs});
  run.abilities=activated.state;run.life=activated.life;
  if(activated.revived)revived=true;
  if(monster.ability.id==='KONJO'&&Number(activated.state?.konjoStock)>0)run.konjoOwnerName=monster.name;
  if(activated.applied){
    abilityFlash={monster:monster.name,ability:monster.ability.name};
    // どのマスモンの能力が効いているかを覚えておく(両サイドの表示で光らせるため)。
    // 判定・スコア・ライフには一切関係しない、見た目だけの控え。
    const slot=rhythmNoteMonsterSlot(note);
    run.abilityOwners=run.abilityOwners||{};
    if(monster.ability.id==='MUTEKI'||monster.ability.id==='GAMAN')run.abilityOwners[monster.ability.id]=slot;
    if(monster.ability.id==='KONJO'&&Number(activated.state?.konjoStock)>0)run.abilityOwners.KONJO=slot;
    // 元気のように一瞬で終わる能力は、少しのあいだだけ光らせる
    run.abilityFlashSlot=slot;
    run.abilityFlashUntilMs=songTimeMs+RHYTHM_SIDE_MONSTER_FLASH_MS;
    // 能力が出た回数をマスモンごとに数える(リザルトの左に、いちばん多く出た子を出すため。見た目だけ・保存しない)
    run.abilityCounts=run.abilityCounts||[];
    if(slot>=1)run.abilityCounts[slot-1]=(Number(run.abilityCounts[slot-1])||0)+1;
    // カットインを1回だけ走らせる(見た目だけ。判定・スコア・ライフには触らない)
    if(cutInOn){const cutIn=cutInRefs.current[slot-1];if(cutIn)rhythmRestartAnimations([{el:cutIn,attr:'rhythmCutinPlay'}]);}
  }
}
const calculatedScore=Math.floor(rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:chart.totalNotes,maxScore:difficulty.maxScore})*(assistOn?RHYTHM_ASSIST_SCORE_RATE:1));if(!run.lifeDepleted)run.score=calculatedScore-run.scoreOffset;if(!run.lifeDepleted&&run.life===0){run.lifeDepleted=true;run.lockedScore=run.score;}
// DOWN中に根性で蘇生したら、**その蘇生ノーツ自身は加算せず次のノーツから** 加算を再開する。
// DOWN中に止まっていたぶんを遡って足さないよう、そのぶんを差し引く量として持つ(§4.4)
if(revived&&run.lifeDepleted&&run.life>0){run.scoreOffset=rhythmScoreOffsetAfterRevive(calculatedScore,run.lockedScore);run.score=run.lockedScore;run.lifeDepleted=false;}
// ===== ライフの変化を目で分かるようにする(2026-09-12・ユーザー指示) =====
// 「ライフ変動や0になったときとか気付きにくい」。バーの数字が小さく動くだけでは気づけないので、
// 減ったその場でHUDを揺らし、減った量を数字で一瞬出す。書くのは data 属性と文字だけで、
// 判定・スコア・ライフの計算には一切関わらない。
// ★根性で蘇生した直後は「増えた」側になるので、減ったときだけ出す(lifeDelta<0)。
const lifeDelta=run.life-lifeBefore;
if(lifeDelta<0){
  // ここも印の付け直しなので、レイアウトの読み取りは1回にまとめる(rhythmRestartAnimations)。
  // 箇所ごとに void offsetWidth を書くと、その回数ぶんページ全体のレイアウトが走る。
  const lifeRestarts=[];
  const lifeBox=lifeBoxRef.current;
  if(lifeBox)lifeRestarts.push({el:lifeBox,attr:'rhythmLifeHit'});
  const lifeDamage=lifeDamageRef.current;
  if(lifeDamage){lifeDamage.textContent=String(lifeDelta);lifeRestarts.push({el:lifeDamage,attr:'rhythmLifeDamageShow'});}
  rhythmRestartAnimations(lifeRestarts);
}
// 0になった瞬間だけ、大きく1度だけ知らせる(蘇生して戻った場合はここを通らない)
if(run.life===0&&lifeBefore>0)setLifeDownCount(count=>count+1);
// ★能力名の大きな表示は、いちばん軽い段(NONE)では出さない(2026-09-13)。
//   効いていることは左上のバッジと音・振動で分かる。能力そのものは当然かかる
const showAbilityFlash=!!abilityFlash&&!rhythmMonsterEffectAtMost(settings.monsterNoteEffect,'NONE');
const score=run.lifeDepleted?run.lockedScore:run.score;setView(v=>({...v,score,combo:run.combo,maxCombo:run.maxCombo,last:judgment,lastPrecise:preciseHit,fastSlow:side||'',counts:{...run.counts},fast:run.fast,slow:run.slow,precise:run.precise,life:run.life,lastDeltaMs:judgment!=='MISS'&&typeof deltaMs==='number'&&Number.isFinite(deltaMs)?deltaMs:null,...(showAbilityFlash?{ability:abilityFlash}:{})}));scheduleJudgmentClear();
/* 自己ベスト比(beatmania IIDX のペースメーカー)。「自己ベストを曲のここまでの割合で割り戻した点」との差。
   前の記録が無い曲・練習・タイミング合わせでは出さない。★見た目だけで、スコアにも記録にも入れない */
const paceEl=paceRef.current;
if(paceEl&&settings.paceDisplay!==false&&!tutorial&&!calibrating&&Number(run.startBestScore)>0&&chart.totalNotes>0){const judged=RHYTHM_JUDGMENT_IDS.reduce((sum,id)=>sum+(Number(run.counts[id])||0),0);const diff=Math.round(score-Number(run.startBestScore)*judged/chart.totalNotes);paceEl.hidden=false;paceEl.dataset.pace=diff>=0?'up':'down';paceEl.textContent=`ベスト比 ${diff>=0?'+':'−'}${Math.abs(diff).toLocaleString()}`;}
/* ずれメーター(osu! のヒットエラーメーター)。直近12回のずれを目盛りに並べ、古いものほど薄くする。
   目盛りの幅は BAD の窓(±185ms)。判定には一切関わらない */
if(settings.timingDisplay==='METER'&&judgment!=='MISS'&&typeof deltaMs==='number'&&Number.isFinite(deltaMs)){const ticks=meterTicksRef.current;if(ticks.length){const slot=(run._meterSlot=((run._meterSlot??-1)+1)%ticks.length);const range=RHYTHM_JUDGMENTS.find(item=>item.id==='BAD')?.windowMs||185;const tick=ticks[slot];if(tick){tick.style.left=`${(50+Math.max(-1,Math.min(1,deltaMs/range))*50).toFixed(2)}%`;tick.dataset.judgment=judgment;}ticks.forEach((el,i)=>{if(!el)return;const age=(slot-i+ticks.length)%ticks.length;el.style.opacity=el.dataset.judgment?String(Math.max(.12,1-age/ticks.length).toFixed(2)):'0';});}}if(showAbilityFlash)scheduleAbilityClear();if(_judgeT0)RHYTHM_PERF.judge(performance.now()-_judgeT0,!!monster);},[chart.totalNotes,difficulty.maxScore,scheduleAbilityClear,scheduleJudgmentClear,settings.vibrationEnabled,settings.monsterNoteEffect,settings.paceDisplay,settings.timingDisplay,tutorial,calibrating,assistOn,luckOn,showLuckyBanner,cutInOn]);
  const finish=useCallback(()=>{const run=runRef.current;if(!run||run.finished||run.paused)return;run.finished=true;stopFrame();RHYTHM_GESTURE_RUNTIME.clear();run.activePointers.clear();run.activeTouchInputs?.clear();run.audio?.stop();const score=run.lifeDepleted?run.lockedScore:run.score;const achievements=rhythmResultAchievements(run.counts,chart.totalNotes);/* アシストモードでは FULL COMBO 等の称号を付けない(アワーノーツと同じ) */if(assistOn){achievements.fullCombo=false;achievements.allExcellent=false;achievements.allMarvelous=false;}
    // ===== クリアか失敗か(2026-09-12・ユーザー指示「終了後にクリアか失敗かもわかるようにして」) =====
    // 失敗＝ライフが0になったまま曲を終えた(不可逆のDOWN)こと。根性で蘇生して0を脱していれば
    // run.lifeDepleted は false に戻っているので、そのときはクリア扱いになる。
    // 練習(tutorial)とタイミング合わせ(calibrating)はライフを減らさないので必ずクリア。
    const failed=!tutorial&&!calibrating&&run.lifeDepleted===true;
    // ビートPは正常に最後まで到達した公開プレイだけ。期間判定は rhythmEventPointAwardAt 側に残す
    // (開催中は通常どおり、非開催中はその1/5。2026-09-24・ユーザー指示)。
    // finishは先頭で run.finished=true にするため、再描画・画面遷移で同じ結果を二重付与しない。
    const eventPointAward=(!debugPlay&&!tutorial&&!calibrating&&!assistOn
      &&typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS?.rhythmEventPoints===true
      &&typeof rhythmEventPointAwardAt==='function')
      ?rhythmEventPointAwardAt(Date.now(),song.songId,score):null;
    // タイミング合わせのときは、貯めたずれから「判定タイミング調整」に入れる値を出す。
    // 助走(はじめの数回)は数に入れない。外れ値の落とし方・刻みは rhythmCalibrationOffsetFromTaps が持つ
    const calibration=calibrating
      ? rhythmCalibrationOffsetFromTaps((Array.isArray(run.deltas)?run.deltas:[]).slice(RHYTHM_CALIBRATION_WARMUP_COUNT))
      : null;
    const result={score,judgments:{...run.counts},maxCombo:run.maxCombo,fast:run.fast,slow:run.slow,precise:run.precise,cleared:!failed,...(calibration?{calibration}:{}),...achievements,...(assistOn?{assist:true}:{})};
    /* アシストモードのプレイは自己ベスト・ランキングに残さない(受け取る側が result.assist を見て保存しない)。
       ここでも自己ベストを混ぜない(NEW RECORD を出さない) */
    const isNewRecord=!assistOn&&score>run.startBestScore;const merged=assistOn?normalizeRhythmBestRecord(run.startBest):mergeRhythmBestRecord(run.startBest,result);
    const liveLogEndMs=Number.isFinite(Number(song.playDurationMs))?Number(song.playDurationMs):chart.durationMs;
    const liveLog=rhythmLiveLogSections(run.liveLog,liveLogEndMs);
    // フルコンボ等を達成していれば、リザルトの数字を出す前に一度「FULL COMBO!」等を
    // 大きく見せる(2026-09-04、ユーザーからの要望)。演出量MINIMAL・軽量モードでは
    // 従来どおりそのままリザルトへ進む(演出だけの分岐で、判定・保存には関わらない)。
    const celebrateTitle=achievements.allMarvelous?'ALL MARVELOUS!!':achievements.allExcellent?'ALL EXCELLENT!!':achievements.fullCombo?'FULL COMBO!':null;
    const showCelebrate=!!celebrateTitle&&!failed&&!settings.lightweightMode&&settings.effectAmount!=='MINIMAL';
    setView(v=>({...v,status:showCelebrate?'celebrate':'result',score,combo:run.combo,maxCombo:run.maxCombo,counts:{...run.counts},fast:run.fast,slow:run.slow,result:{...result,isNewRecord,bestScore:merged.bestScore,eventPointAward,liveLog,liveLogEndMs,assistGuarded:assistOn?run.assistGuarded||0:0,mirror:mirrorOn}}));
    if(eventPointAward&&eventPointAward.amount>0&&typeof addRhythmEventPoints==='function')void addRhythmEventPoints(eventPointAward.amount);
    /* ラッキーラッシュのおまけ。公開の曲を最後まで遊んだときだけ(アシスト・練習・デバッグは除く)。上限10P、イベント期間外は1/5 */
    setLuckyRush(false);
    if(luckOn&&!assistOn&&!debugPlay&&typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS?.rhythmEventPoints===true&&typeof addRhythmEventPoints==='function'){
      const offEvent=!(typeof rhythmLimitedEventAt==='function'&&rhythmLimitedEventAt(Date.now()));
      const luckBonus=rhythmLuckBonusPoints(run.luckPoints,offEvent);
      if(luckBonus>0){run.luckBonus=luckBonus;void addRhythmEventPoints(luckBonus);}
    }
    if(luckOn)setView(v=>v.result?{...v,result:{...v.result,luck:{points:run.luckPoints||0,draws:run.luckDraws||0,rush:run.luckRushCount||0,bonus:run.luckBonus||0}}}:v);
    onComplete(result,merged);
  },[chart.totalNotes,chart.durationMs,difficulty.maxScore,onComplete,settings.effectAmount,settings.lightweightMode,stopFrame,tutorial,calibrating,debugPlay,song.songId,song.playDurationMs,assistOn,mirrorOn,luckOn]);
  // celebrate画面: 出た瞬間に合成SEを1回鳴らし、既定の時間で自動的にresultへ進む。
  // 依存はview.statusだけにしてある。もしview.comboなど毎ノーツ変わる値を依存に入れると、
  // (かつてコンボ演出で実際に踏んだ通り)途中でeffectが再実行されるたびcleanupが走り、
  // 「あと少しで消す」という予約タイマーが節目と無関係に解除されてしまう。
  const celebrateTimerRef=useRef(null);
  useEffect(()=>{
    if(view.status!=='celebrate')return;
    RHYTHM_NOTE_SE_RUNTIME.playFullCombo();
    celebrateTimerRef.current=setTimeout(()=>{setView(v=>v.status==='celebrate'?{...v,status:'result'}:v);},1300);
    return ()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}};
  },[view.status]);
  const skipCelebrate=()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}setView(v=>v.status==='celebrate'?{...v,status:'result'}:v);};
  const scheduleTick=useCallback(()=>{stopFrame();
/* 省電力(settings.frameRateMode='POWER_SAVE')のときは、120Hz以上の画面で1回おきに描く。
   画面の速さはフレームの間隔をならして測る(はじめは60Hzとみなし、20フレームほどで落ち着く)。
   ならした間隔が10ms未満(=100Hzより速い)ときだけ、前に描いてから12.5ms経っていないフレームを飛ばす。
   120Hzならちょうど1回おき(毎秒60回)、144Hzでも1回おき(毎秒72回)で、間隔は乱れない。
   90Hzは抑えない(60へ落とすと間隔が 11ms/22ms と交互になり、かえってガタついて見える)。
   ★飛ばすのは描くことだけ。判定は指の入力のたびに曲の時刻で決めているので変わらない。
     取り逃しのMISSや長押しの終わりも、次に描くフレーム(8ms後)でいつもどおり数える */
const powerSave=settings.frameRateMode!=='DEVICE';const stagePulseOn=rhythmStageLevel(settings)!=='SIMPLE';let prevFrameMs=0,avgFrameMs=1000/60,lastDrawnMs=0;
const tick=(frameNowMs)=>{RHYTHM_PERF.frame(frameNowMs);RHYTHM_GESTURE_RUNTIME.invalidateAreaRect();const run=runRef.current;if(!run||run.finished||run.paused)return;
/* ★ここでプレイエリアの箱を先に測っておく形は、2026-09-25に入れて26日にやめた。毎フレームの最初の時点で
   配置の計算がたまっていることが多く、測るたびにその場で計算させていた(8秒で560ms。タップのときだけ測る
   以前の形は10秒で66ms)。箱はタップが来たときに初めて測る(同じフレームのタップは使い回す) */
/* 画質「自動」。rAF の間隔から「描くのが間に合わなかったフレーム」(いちばん短い間隔の1.8倍より長いもの)を数え、
   3秒のうち8%を超えたら一段下げる。止まっていた間(250ms以上あいた)は数えない。数えるだけで、判定・描画には触らない */
if(settings.renderQuality==='AUTO'){const aq=run._autoQuality||(run._autoQuality={last:0,start:frameNowMs,frames:0,slow:0,minGap:1e9});const gap=aq.last?frameNowMs-aq.last:0;aq.last=frameNowMs;
  if(gap>0&&gap<250){aq.frames++;if(gap>=5&&gap<aq.minGap)aq.minGap=gap;if(gap>Math.max(5,aq.minGap)*1.8)aq.slow++;}
  if(frameNowMs-aq.start>=RHYTHM_AUTO_QUALITY_WINDOW_MS){if(aq.frames>=30&&aq.slow/aq.frames>RHYTHM_AUTO_QUALITY_SLOW_RATIO&&stepAutoQualityRef.current)stepAutoQualityRef.current();aq.start=frameNowMs;aq.frames=0;aq.slow=0;}}
if(powerSave){const gap=prevFrameMs?frameNowMs-prevFrameMs:0;prevFrameMs=frameNowMs;if(gap>0&&gap<50)avgFrameMs=avgFrameMs*.9+gap*.1;if(avgFrameMs<10&&lastDrawnMs&&frameNowMs-lastDrawnMs<12.5){frameRef.current=requestAnimationFrame(tick);return;}lastDrawnMs=frameNowMs;}const perfTickStart=RHYTHM_PERF.enabled?performance.now():0;const songTimeMs=run.audio.songTimeMs();RHYTHM_PERF.songTime(songTimeMs);const travel=measureTravel(),visualTime=songTimeMs-settings.judgmentTimingOffsetMs,travelMs=rhythmTravelMsForSpeed(settings.noteSpeed);let perfScanned=0,perfDrawn=0;updateJudgmentBand(travel,travelMs);
/* ライブ背景の光。ノーツが判定ラインへ来る時刻(=曲のリズム)ごとに背景を光らせる。
   取れたかどうかでは変えない(下手でも曲に合わせて光る)。同時押しとモンスターノーツは強く光る。
   間隔が110ms未満の連打では光らせ直さない(光りっぱなしで何も分からなくなるため)。
   光らせ方は Web Animations の opacity だけ(合成だけで済む) */
if(stagePulseOn){const pulseEl=stagePulseRef.current,notes=run.notes;let index=run._stageNoteIndex||0,count=0,monster=false;while(index<notes.length&&notes[index].timeMs<=visualTime){count++;if(rhythmNoteMonsterSlot(notes[index]))monster=true;index++;}run._stageNoteIndex=index;if(count&&pulseEl&&typeof pulseEl.animate==='function'&&visualTime-(run._stagePulseAt??-1e9)>=110){run._stagePulseAt=visualTime;pulseEl.dataset.stagePulseKind=monster?'monster':'note';try{pulseEl.animate([{opacity:monster?1:count>1?.9:.62},{opacity:0}],{duration:monster?620:count>1?440:340,easing:'cubic-bezier(.2,.7,.3,1)'});}catch(_){}}}
// このフレームでノーツを正しい場所へ置けるか。置けないなら判定も進めない(下のvisitNoteを参照)
const placeable=!!travel&&travel.ready!==false;
// canvas で描くフレームの準備(全面を消し、大きさが変わっていれば作り直す)。DOM 版では何もしない
const canvasReady=canvasNotes&&placeable&&RHYTHM_CANVAS_RENDERER.begin(travel.rect,{nowMs:frameNowMs,effect:settings.effectAmount,lightweight:settings.lightweightMode,maxDpr:noteCanvasMaxDprRef.current,sizeScale:settings.noteSize/100});

// canvas 版のノーツ1個。見えるか・どこに置くかの決め方は DOM 版(下の visitNote)と同じ式。
// 判定はここへ来る前に visitNote が済ませている。描くだけで、judgment・score・input には触らない
const paintCanvasNote=note=>{
  const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&rhythmNoteHasBody(note)&&songTimeMs<rhythmReleaseTargetMs(note);
  const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;
  // 取り終えたノーツは、弾ける演出が済んでからマスモンの絵を隠し、「片付け済み」の印を付ける。
  // 走査の先頭(scanFrom)はこの印まで進めない(DOM 版が要素の非表示を待つのと同じ)。
  // これが無いと取った瞬間に走査から外れ、絵が隠れずに判定ラインへ残った(2026-09-07・実機「canvas 版でマスモンが残る」)
  if(note.done&&!failedTrail&&!clearFlash){note._rhythmCanvasSettled=true;return;}
  const progress=1-(note.timeMs-visualTime)/travelMs,visible=failedTrail||note.activePointerId!==null||(progress>=-.1&&progress<=1.18);
  if(!visible||!travel||!canvasReady)return;
  perfDrawn++;
  let yPx=travel.spawnY+rhythmProjectTravelProgress(progress)*travel.travelPx;
  if(note.type==='HOLD'&&note.activePointerId!==null)yPx=travel.judgmentY;
  if(clearFlash)yPx=travel.judgmentY;
  yPx=Math.round(yPx);
  const releaseTargetMs=rhythmReleaseTargetMs(note),releaseProgress=1-(releaseTargetMs-visualTime)/travelMs,releaseYpx=Math.round(travel.spawnY+rhythmProjectTravelProgress(releaseProgress)*travel.travelPx),bodyPx=Math.max(0,yPx-releaseYpx);
  // 帯を持つかは元の種類で決める。触った FLICK は判定のため type が 'HOLD' に化けているが帯は無い
  const hasBody=rhythmNoteHasBody(note);
  const activeSlideLane=RHYTHM_GESTURE_RUNTIME.slideVisualLaneForIndex(note.index),visualLane=activeSlideLane===null?note.lane:activeSlideLane;
  const geo=rhythmNoteCanvasGeometry(note,yPx,visualLane,travel.rect,travel.noteHeight,hasBody?releaseYpx:null,{chartNowMs:songTimeMs-settings.judgmentTimingOffsetMs,visualTime,travelMs,spawnY:travel.spawnY,travelPx:travel.travelPx},hasBody?bodyPx:0);
  const monster=!!monsterForNote(note);
  const depthScale=Math.round((0.56+geo.scale*.44)*100)/100,brightness=Math.round((0.72+geo.scale*.28)*100)/100;
  RHYTHM_CANVAS_RENDERER.drawNote(note,geo,{failed:failedTrail,monster,wide:rhythmNoteIsWide(note),pressed:note.type==='HOLD'&&note.activePointerId!==null,alpha:failedTrail?.34:1,pop:clearFlash?Math.min(1,(songTimeMs-note._rhythmClearAt)/RHYTHM_CLEAR_FLASH_MS):null,depthScale,brightness});
  // マスモンの顔(焼いた絵)。以前の DOM 版と同じく、落下中は「奥行き×1.28倍」、
  // 取った瞬間は枠の大きさから2.1倍へ広がりながら消える(0.26秒・影なし)
  const monsterSlot=monster?rhythmNoteMonsterSlot(note):0,faceBitmap=monsterSlot?faceBitmapsRef.current[monsterSlot-1]:null;
  if(faceBitmap){
    if(clearFlash){
      const t=Math.min(1,Math.max(0,(songTimeMs-note._rhythmClearAt)/RHYTHM_CLEAR_FLASH_MS)),eased=1-(1-t)*(1-t);
      RHYTHM_CANVAS_RENDERER.drawFace(faceBitmap.plain,geo.head.cx,geo.head.cy,RHYTHM_FACE_BOX*faceBitmap.box*(1+1.1*eased),.95*(1-eased));
    }else{
      RHYTHM_CANVAS_RENDERER.drawFace(faceBitmap.glow,geo.head.cx,geo.head.cy,RHYTHM_FACE_BOX*faceBitmap.box*depthScale*RHYTHM_FACE_ZOOM,1);
    }
  }
};
// 練習の説明。曲の時刻で切り替わる。変わったときだけDOMへ書く(毎フレームReactを動かさない)
if(tutorial){const step=rhythmTutorialStepAt(songTimeMs);if(step!==tutorialStepRef.current){tutorialStepRef.current=step;const banner=tutorialBannerRef.current;if(banner){const title=banner.querySelector('[data-rhythm-tutorial-title]'),body=banner.querySelector('[data-rhythm-tutorial-text]');if(title)title.textContent=step.title;if(body)body.textContent=step.text;}}}
// タイミング合わせの案内。数えた回数が変わったときだけ書き換える。
// ★チュートリアルの案内(ノーツの種類の説明)とは別物。流用すると「れんしゅう」の文が出て
//   何をしている画面なのか分からなくなる(2026-09-13・ユーザー指摘「チュートリアルの流用？」)
if(calibrating){const taps=Array.isArray(run.deltas)?run.deltas.length:0;
  if(taps!==calibrationTapsRef.current){calibrationTapsRef.current=taps;const banner=calibrationBannerRef.current;
    if(banner){const title=banner.querySelector('[data-rhythm-calibration-title]'),body=banner.querySelector('[data-rhythm-calibration-text]');
      const counted=Math.max(0,taps-RHYTHM_CALIBRATION_WARMUP_COUNT);
      const remain=Math.max(0,RHYTHM_CALIBRATION_TAP_COUNT-counted);
      const now=counted>0?rhythmCalibrationOffsetFromTaps(run.deltas.slice(RHYTHM_CALIBRATION_WARMUP_COUNT)):null;
      if(title)title.textContent=taps<RHYTHM_CALIBRATION_WARMUP_COUNT
        ?`かまえて（はじめの${RHYTHM_CALIBRATION_WARMUP_COUNT}回は数えません）`
        :remain>0?`あと ${remain} 回`:'おしまい！';
      if(body)body.textContent=now
        ?`いまのずれ ${now.rawMeanMs>0?'+':''}${now.rawMeanMs}ms（${counted}回ぶん）／ 判定とFAST・SLOWを見ながら、判定ラインに重なった瞬間に叩いてください`
        :'判定ラインにノーツが重なった瞬間に叩いてください。判定とFAST・SLOWはいつもどおり出ます';}}}
const visitNote=note=>{if(note.type==='HOLD'&&note.activePointerId!==null&&songTimeMs>=note.endTimeMs+settings.judgmentTimingOffsetMs)applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);
// 指を離したまま戻ってこなかったHOLD/SLIDE。持ち替えの猶予を過ぎた時点で失敗にする。
// 終わりまで来ていたら、離していても成立させる(終わり際に離すぶんは元から許している)
if(!note.done&&note.activePointerId===null&&note.releasedAtMs!=null){
  const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;
  if(songTimeMs>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){note.releasedAtMs=null;rhythmFloatingNoteRemove(note);applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);}
  else if(songTimeMs-note.releasedAtMs>=RHYTHM_HOLD_HANDOVER_GRACE_MS){const releasedAt=note.releasedAtMs;note.releasedAtMs=null;rhythmFloatingNoteRemove(note);applyJudgment(note,'MISS',releasedAt-holdEndMs);}
}
// ノーツを画面へ置けない状態(レイアウトがまだ組み上がっていない)のあいだに
// 過ぎてしまったぶんは、見えていないのだから取りようがない。
// MISSにしてライフとコンボを削るのは理不尽なので、スコアにも数にも入れずに取り除く。
// (2026-09-05・実機の指摘「初回起動時はよくこの状態になる」。
//  以前はここで見えないノーツを次々MISSにしていて、開幕から立て直せなかった)
// 【2026-09-07】浮いているノーツ(releasedAtMs)は、ここでは失敗にしない。
// 持ち替えのために離した HOLD/SLIDE は activePointerId が null に戻るので、下の「始点を過ぎたのに
// 誰も押していない → MISS」にそのまま当たっていた。始点から240ms以上たった HOLD を離すと、
// 上の猶予(200ms)を見る前に次のフレームで MISS になり、「離してから置き直す」持ち替えが
// 実際にはできていなかった(rhythm-input-scenario-check.js で見つけた)。
// 回収は RHYTHM_MISS_RECLAIM_MS(判定窓＋入力が遅れて届きうるぶん)で見る。
// フレームの時刻と入力の時刻が最大80msずれるため、判定窓ちょうどで回収すると
// 「窓の内側で叩いたのにノーツがもう無い」が起きる(rhythm-mode.js の該当コメント)。
if(!note.done&&note.activePointerId===null&&note.releasedAtMs==null&&!placeable&&songTimeMs-(note.timeMs+settings.judgmentTimingOffsetMs)>RHYTHM_MISS_RECLAIM_MS){note.done=true;note._rhythmUnplaceable=true;return;}
if(!note.done&&note.activePointerId===null&&note.releasedAtMs==null&&songTimeMs-(note.timeMs+settings.judgmentTimingOffsetMs)>RHYTHM_MISS_RECLAIM_MS)applyJudgment(note,'MISS',songTimeMs-note.timeMs);if(canvasNotes){paintCanvasNote(note);return;}
const el=laneRefs.current[note.index];if(!el)return;
// 失敗したHOLD/SLIDEはその場で消さず、譜面上の終端まで薄いグレーで流し続ける。
// 「もう取れない」ことが見えるようにするための表示だけの扱いで、判定・スコアには関与しない。
const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&rhythmNoteHasBody(note)&&songTimeMs<rhythmReleaseTargetMs(note);
// 終わったノーツは毎フレーム display を書き直さない。曲が進むほど終わったノーツが増え、
// そのぶん無駄な書き込みが積み上がって「遊んでいるうちにカクつく」原因になっていた。
// 一度隠したら覚えておき、値が変わるときだけ書く(見た目・判定は変わらない)。
// 取れた直後の短いあいだだけ、判定ラインに置いたまま光らせてから消す
const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;
if(clearFlash){if(el._rhythmClearFlag!==true){el.dataset.rhythmClear='1';el._rhythmClearFlag=true;}}
else if(el._rhythmClearFlag===true){delete el.dataset.rhythmClear;el._rhythmClearFlag=false;}
if(note.done&&!failedTrail&&!clearFlash){if(el._rhythmHidden!==true){el.style.display='none';el._rhythmHidden=true;}return;}
if(el._rhythmHidden===true){el.style.display='';el._rhythmHidden=false;}
const failedFlag=failedTrail?'true':'false';if(el._rhythmFailedFlag!==failedFlag){el.dataset.rhythmFailed=failedFlag;el._rhythmFailedFlag=failedFlag;}
const progress=1-(note.timeMs-visualTime)/travelMs,visible=failedTrail||note.activePointerId!==null||(progress>=-.1&&progress<=1.18);const nextOpacity=failedTrail?'.34':(visible?'1':'0');if(el._rhythmOpacity!==nextOpacity){el.style.opacity=nextOpacity;el._rhythmOpacity=nextOpacity;}const nextWillChange=visible?'transform, opacity':'';if(el._rhythmWillChange!==nextWillChange){el.style.willChange=nextWillChange;el._rhythmWillChange=nextWillChange;}
if(!visible||!travel)return;
perfDrawn++;let yPx=travel.spawnY+rhythmProjectTravelProgress(progress)*travel.travelPx;if(note.type==='HOLD'&&note.activePointerId!==null)yPx=travel.judgmentY;if(clearFlash)yPx=travel.judgmentY;yPx=Math.round(yPx);/* 縦位置は1px刻みへ丸めてある。丸めた値が前のフレームと同じなら書き直さない。   見た目は1pxも変わらないのに、書けばそのノーツは合成のやり直し対象になる。   ノーツが奥にいるあいだ(遠近の効きで1フレームの移動が1px未満)はここで止まる */const nextTransform=`translate3d(0,${yPx}px,0)`;if(el._rhythmTransform!==nextTransform){el.style.transform=nextTransform;el._rhythmTransform=nextTransform;}const releaseTargetMs=rhythmReleaseTargetMs(note),releaseProgress=1-(releaseTargetMs-visualTime)/travelMs,releaseYpx=Math.round(travel.spawnY+rhythmProjectTravelProgress(releaseProgress)*travel.travelPx),bodyPx=Math.max(0,yPx-releaseYpx);if(note.type==='HOLD'){/* 帯の長さもfilterも「変わったときだけ」書く。とくにfilterを毎フレーム書くと、押していない間もそのノーツが毎フレーム塗り直しになり、画面の広い端末ほど重くなる */const holdBody=`${Math.round(bodyPx)}px`;if(el._rhythmHoldBody!==holdBody){el.style.setProperty('--rhythm-hold-body',holdBody);el._rhythmHoldBody=holdBody;}const holdFilter=note.activePointerId!==null?'brightness(1.3)':'';if(el._rhythmHoldFilter!==holdFilter){el.style.filter=holdFilter;el._rhythmHoldFilter=holdFilter;}}if(note.type==='SLIDE'||note._rhythmOriginalType==='SLIDE'){/* HOLDの帯と同じで、SLIDEの帯の高さも変わったときだけ書く。   毎フレーム書くと、押していないSLIDEまで毎フレーム塗り直しの対象になる */const slideBody=`${Math.round(bodyPx)}px`;if(el._rhythmSlideBody!==slideBody){el.style.setProperty('--rhythm-slide-height',slideBody);el.style.setProperty('--rhythm-slide-visible-height',slideBody);el._rhythmSlideBody=slideBody;}}const activeSlideLane=RHYTHM_GESTURE_RUNTIME.slideVisualLaneForIndex(note.index),visualLane=activeSlideLane===null?note.lane:activeSlideLane;rhythmLayoutNoteVisual(el,note,yPx,visualLane,playAreaRef.current,releaseYpx,{chartNowMs:songTimeMs-settings.judgmentTimingOffsetMs,visualTime,travelMs,spawnY:travel.spawnY,travelPx:travel.travelPx},{rect:travel.rect,noteHeight:travel.noteHeight,bodyHeight:bodyPx});};
const notes=run.notes;
// 末尾の打ち切りは「ノーツが時刻の昇順に並んでいる」ことが前提。譜面エディタなどから
// 並び順が崩れた譜面が来た場合は絞り込まず、従来どおり全ノーツを見る(取りこぼさないため)。
if(run.notesAscending===undefined)run.notesAscending=notes.every((n,i)=>i===0||n.timeMs>=notes[i-1].timeMs);
let scanFrom=run.scanFrom||0;
while(scanFrom<notes.length){
  const head=notes[scanFrom],headEl=laneRefs.current[head.index];
  // 判定が終わっていることが先頭を進める条件。表示の後始末(非表示)が残っているあいだは進めない。
  // 要素そのものが無いノーツは隠す対象が無いので、判定さえ終わっていれば進めてよい
  // (要素が無いと永久に先頭が止まり、絞り込みがまるごと効かなくなっていた)。
  if(!(head.done&&(canvasNotes?head._rhythmCanvasSettled===true:(headEl?headEl._rhythmHidden===true:true))))break;
  scanFrom++;
}
run.scanFrom=scanFrom;
const scanHorizonMs=visualTime+travelMs*1.2;
for(let i=scanFrom;i<notes.length;i++){
  const note=notes[i];
  if(run.notesReady&&run.notesAscending&&note.timeMs>scanHorizonMs)break;
  perfScanned++;
  visitNote(note);
}
run.notesReady=true;
if(canvasNotes)RHYTHM_CANVAS_RENDERER.end();
RHYTHM_PERF.notes(perfScanned,perfDrawn,scanFrom,run.notesAscending);
// 無敵・我慢の残り時間と根性ストックは、毎フレームsetStateせずDOMへ直接書く。
// スコアやコンボと同じ頻度でReactを走らせると、そのぶんノーツの描画が遅れるため。
const badge=abilityBadgeRef.current;
// 能力が1つも動いていないあいだは、文字列を組み立てること自体をやめる。
// 曲の大半は何も出ていないので、毎フレームの文字列生成と小数計算をまるごと省ける。
const hasAbilityBadge=badge&&(rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs)>0
  ||rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs)>0
  ||Number(run.abilities?.konjoStock)>0);
if(badge&&!hasAbilityBadge){
  if(badge._rhythmBadgeText!==''){badge.textContent='';badge._rhythmBadgeText='';}
  if(!badge.hidden)badge.hidden=true;
}
if(hasAbilityBadge){
  const mutekiMs=rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs),gamanMs=rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs);
  const text=[mutekiMs>0?`無敵 ${(mutekiMs/1000).toFixed(1)}s`:'',gamanMs>0?`我慢 ${(gamanMs/1000).toFixed(1)}s`:'',Number(run.abilities?.konjoStock)>0?'根性 ストック':''].filter(Boolean).join(' / ');
  if(badge._rhythmBadgeText!==text){badge.textContent=text;badge._rhythmBadgeText=text;}
  if(badge.hidden!==(text===''))badge.hidden=text==='';
}
// 両サイドのマスモン: 能力が効いている枠だけを光らせる。
// 毎フレーム属性を書くと、そのぶん塗り直しが増える。**変わった瞬間だけ**書く。
if(settings.sideMonsterAbilityHighlight&&sideMonsterRefs.current.length){
  const owners=run.abilityOwners||{};
  const active=new Set();
  if(rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs)>0&&owners.MUTEKI)active.add(owners.MUTEKI);
  if(rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs)>0&&owners.GAMAN)active.add(owners.GAMAN);
  if(Number(run.abilities?.konjoStock)>0&&owners.KONJO)active.add(owners.KONJO);
  if(run.abilityFlashSlot&&songTimeMs<Number(run.abilityFlashUntilMs))active.add(run.abilityFlashSlot);
  const signature=[...active].sort().join(',');
  if(run.sideMonsterActiveSignature!==signature){
    run.sideMonsterActiveSignature=signature;
    sideMonsterRefs.current.forEach((el,index)=>{
      if(!el)return;
      const want=active.has(index+1)?'1':'0';
      if(el.dataset.rhythmSideActive!==want)el.dataset.rhythmSideActive=want;
    });
  }
}
const playEndTimeMs=Number.isFinite(Number(song.playDurationMs))?Number(song.playDurationMs):chart.durationMs;
/* 曲の進みぐあい(スコアの下の細いバーと経過時間)。バーは0.5%動いたときだけ、時間は秒が変わったときだけ書き換える。
   ★バーは合成用のレイヤーを持たないので、書き換えるたびに画面全体の層が塗り直される(2026-09-25にトレースで確認)。
   0.1%刻みだと1秒に約7回。バーの幅は長くても120px前後なので、0.5%(1px未満)刻みで見た目は変わらない */
const progressEl=songProgressRef.current;
if(progressEl){const ratio=playEndTimeMs>0?Math.max(0,Math.min(1,songTimeMs/playEndTimeMs)):0;if(Math.abs(ratio-(progressEl._mhRatio||0))>=.005||ratio===1){progressEl._mhRatio=ratio;progressEl.style.transform=`scaleX(${ratio.toFixed(4)})`;}}
if(run.luckRushUntil!=null&&songTimeMs>=run.luckRushUntil){run.luckRushUntil=null;setLuckyRush(false);}
const timeEl=songTimeRef.current;
if(timeEl){const shownMs=Math.max(0,Math.min(playEndTimeMs,songTimeMs)),second=Math.floor(shownMs/1000);if(timeEl._mhSecond!==second){timeEl._mhSecond=second;timeEl.textContent=`${rhythmClockLabel(shownMs)}/${rhythmClockLabel(playEndTimeMs)}`;}}
/* 譜面より音源のほうが長い曲(デュラハンの2曲は音源をバトルと共用しているので切れない)は、
   終わりの手前から音量をなめらかに落とす。何もしないと曲の途中でぶつっと止まる。
   音源が譜面とほぼ同時に終わる曲では何もしない(自然な終わりをいじらない)。 */
const audioDurationMs=Number(run.audio.durationMs)||0;
if(!run.fadedOut&&audioDurationMs>playEndTimeMs+RHYTHM_END_FADE_MARGIN_MS
  &&songTimeMs>=playEndTimeMs-RHYTHM_END_FADE_MS){
  run.fadedOut=true;
  run.audio.fadeOut?.(RHYTHM_END_FADE_MS);
}
if(RHYTHM_PERF.enabled)RHYTHM_PERF.tick(performance.now()-perfTickStart,perfTickStart-frameNowMs);if(songTimeMs>=playEndTimeMs||run.audio.ended())finish();else frameRef.current=requestAnimationFrame(tick);};frameRef.current=requestAnimationFrame(tick);},[applyJudgment,chart.durationMs,finish,measureTravel,settings.frameRateMode,settings.stageEffect,settings.lightweightMode,settings.judgmentTimingOffsetMs,settings.noteSpeed,song.playDurationMs,stopFrame,tutorial,updateJudgmentBand]);
  const disposeRun=useCallback(()=>{stopFrame();clearJudgmentTimer();clearAbilityTimer();clearCountdown();RHYTHM_GESTURE_RUNTIME.clear();rhythmFloatingNotesClear();const run=runRef.current;if(run){run.finished=true;run.paused=true;run.activePointers.clear();run.standbyPointers?.clear();run.activeTouchInputs?.clear();run.inputFeedbackState?.clear();run.audio?.stop();}runRef.current=null;setPressedLanes([]);},[clearAbilityTimer,clearCountdown,clearJudgmentTimer,stopFrame]);
  /* プレイエリアが「遊べる大きさ」になるまで待つ。
     毎フレーム測り直し、整ったらすぐ返す。整わないまま上限に達したら、
     待ち続けて遊べなくなるより始めたほうがましなので諦めて返す。 */
  /* READY→3→2→1 と数えてから返す。
     途中で画面を離れた・作り直された(generationが変わった)ら false を返して、
     呼び出し側が曲を鳴らさずに終われるようにする */
  const runCountdown=(generation,steps=RHYTHM_COUNTDOWN_STEPS)=>new Promise(resolve=>{
    countdownResolveRef.current=resolve;
    const done=value=>{if(countdownResolveRef.current===resolve)countdownResolveRef.current=null;resolve(value);};
    let index=0;
    const step=()=>{
      if(!mountedRef.current||generation!==generationRef.current){countdownResolveRef.current=null;clearCountdown();done(false);return;}
      if(index>=steps.length){setCountdownStep(null);countdownTimerRef.current=null;done(true);return;}
      setCountdownStep(steps[index]);
      index++;
      countdownTimerRef.current=setTimeout(step,RHYTHM_COUNTDOWN_STEP_MS);
    };
    step();
  });
  const waitUntilPlayable=generation=>new Promise(resolve=>{
    const deadline=(typeof performance!=='undefined'?performance.now():Date.now())+RHYTHM_LAYOUT_WAIT_MAX_MS;
    const step=()=>{
      if(!mountedRef.current||generation!==generationRef.current){resolve(false);return;}
      const area=playAreaRef.current,line=judgmentLineRef.current;
      if(area&&line&&rhythmTravelLooksReady(RHYTHM_VIEW_ROTATION.rectOf(area),RHYTHM_VIEW_ROTATION.rectOf(line))){
        // 測り直させる。待っているあいだに覚えた値があれば、それは整う前のもの
        travelCacheRef.current=null;resolve(true);return;
      }
      if((typeof performance!=='undefined'?performance.now():Date.now())>=deadline){travelCacheRef.current=null;resolve(false);return;}
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(step);else setTimeout(step,16);
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(step);else setTimeout(step,16);
  });
  const beginRun=async startBestValue=>{if(startLockRef.current)return;startLockRef.current=true;const generation=++generationRef.current;disposeRun();setLifeDownCount(0);setView({...initialView(),status:'loading'});const audio=await Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume,{autoStart:false});if(!mountedRef.current||generation!==generationRef.current){audio?.stop();return;}if(!audio){startLockRef.current=false;setView(v=>({...v,status:'error'}));return;}const startBest=normalizeRhythmBestRecord(startBestValue);rhythmFloatingNotesClear();runRef.current={audio,notes:makeRuntimeNotes(),activePointers:new Map(),standbyPointers:new Map(),activeTouchInputs:new Set(),combo:0,maxCombo:0,counts:emptyCounts(),fast:0,slow:0,precise:0,deltas:[],life:RHYTHM_LIFE_MAX,lifeDepleted:false,score:0,lockedScore:0,scoreOffset:0,abilities:createRhythmMonsterAbilityState(),konjoOwnerName:'',finished:false,paused:false,generation,startBest,startBestScore:startBest.bestScore};laneRefs.current.forEach(el=>{if(el){el.style.display='block';el.style.opacity='0';el.style.filter='';/* styleを直接書き戻したら、「前に何を書いたか」の控えも一緒に捨てる。   控えだけ古いまま残ると、値が同じだと判断して書き込みを飛ばし、   実際の見た目とズレたまま固まる(例: 透明のまま出てこない)ため */el._rhythmHidden=false;el._rhythmOpacity=undefined;el._rhythmWillChange=undefined;el._rhythmFailedFlag=undefined;el._rhythmClearFlag=undefined;delete el.dataset.rhythmClear;el._rhythmHoldBody=undefined;el._rhythmHoldFilter=undefined;el._rhythmDepthScale=undefined;el._rhythmDepthBrightness=undefined;el._rhythmTransform=undefined;el._rhythmSlideBody=undefined;}});if(canvasNotes)RHYTHM_CANVAS_RENDERER.clear();rhythmLayoutPlayArea(playAreaRef.current);updateJudgmentBand(measureTravel(),rhythmTravelMsForSpeed(settings.noteSpeed));
/* 使い回すヒットエフェクトを先に作っておく。曲の途中で10個まとめて作ると、そこで一瞬引っかかる */
rhythmEnsureHitEffects(playAreaRef.current);
/* 光のスプライトも先に焼いておく。曲の中で「その種類のノーツが初めて出た瞬間」に作ると
   そこで数ms引っかかる(モンスターノーツは3枚まとめて作るのでいちばん重い)。
   カウントダウン(READY→3→2→1 の3.2秒)のあいだに済ませるので、プレイヤーには見えない。
   ★描くときと同じ設定を渡す。キャッシュのキーは種類と画素密度だけなので、
     違う設定で焼くとそのまま曲の終わりまで使われてしまう(2026-09-12) */
if(canvasNotes)RHYTHM_CANVAS_RENDERER.warmSprites({effect:settings.effectAmount,lightweight:settings.lightweightMode,maxDpr:noteCanvasMaxDpr});
/* 両サイドのマスモンが跳ねる速さを曲の1拍へ合わせる。   プレイ開始時に一度書くだけで、あとはCSSアニメーションが回すので毎フレームのJSは走らない */
const sideBeatMs=rhythmSideMonsterBeatMs(song.bgmTrackId);
sideMonsterRefs.current.forEach(el=>{if(el){el.style.setProperty('--rhythm-side-beat',`${sideBeatMs}ms`);el.dataset.rhythmSideActive='0';el.dataset.rhythmSideHit='0';el.dataset.rhythmSidePhase='intro';}});
/* 判定ラインも同じ1拍で脈打たせる。ここで一度書くだけで、あとはCSSが回す。
   変わるのは厚み(scaleY)と濃さ(opacity)だけなので、判定の位置は動かない */
if(judgmentLineRef.current)judgmentLineRef.current.style.setProperty('--rhythm-beat',`${sideBeatMs}ms`);
startLockRef.current=false;setView({...initialView(),status:'playing'});
/* ラッキーラッシュは1曲ごとに0から(リスタートで前のゲージ・RUSHを持ち越さない) */
setLuckyRush(false);setLuckyBanner(null);if(luckGaugeRef.current)luckGaugeRef.current.style.transform='scaleX(0)';if(luckPointsRef.current){luckPointsRef.current._mhLuck=0;luckPointsRef.current.textContent='0pt';}
/* ここまでで画面の中身はそろっているが、実際に置かれる大きさが決まるのは次の描画のあと。
   絵の読み込み・レイアウトの反映が終わる前に曲を鳴らし始めると、ノーツを正しい場所へ
   置けないまま曲だけ進み、MISSが積み上がる(2026-09-05・実機の指摘)。
   遊べる形になるまで待ってから鳴らす。待てない端末のために上限も置く */
await waitUntilPlayable(generation);
if(!mountedRef.current||generation!==generationRef.current){audio.stop();return;}
/* 画面がそろってから READY→3→2→1 と数え、そのあとで曲を鳴らす。
   選んだ瞬間に曲が始まると構える間が無い(2026-09-05・ユーザー指摘)。
   ここで数えているあいだにレイアウトも完全に固まる */
if(!await runCountdown(generation)){audio.stop();return;}
if(!mountedRef.current||generation!==generationRef.current){audio.stop();return;}
audio.start();
scheduleTick();};
  // rhythmChartSwitchHold: 演奏のあいだは「時刻で入れ替わる譜面」の答えを固定する。
  // 曲の途中で切り替えの時刻をまたいでも、総ノーツ数とレベルが変わらないようにするため
  // (data/rhythm-mode.js の RHYTHM_SWITCHING_CHARTS)。
  useEffect(()=>{mountedRef.current=true;rhythmChartSwitchHold(true);beginRun(bestRecord);return()=>{mountedRef.current=false;rhythmChartSwitchHold(false);++generationRef.current;startLockRef.current=false;disposeRun();};},[]);
  const pause=()=>{const run=runRef.current;
    /* カウントダウン中は止められない。まだ曲が鳴っていないので、止めても再開できない。
       ボタンに disabled を付けるのではなくここで弾くのは、HUDの見た目を測る検査
       (rhythm-hud-wedge-check など)がHUDのJSXをそのまま写して使うため、
       式や disabled: 変種を持ち込むと測れなくなるから */
    if(countdownStep!==null)return;
    if(!run||run.finished||run.paused)return;run.activePointers.clear();run.standbyPointers?.clear();run.activeTouchInputs?.clear();run.inputFeedbackState?.clear();run.activePointerFeedback?.clear();setPressedLanes([]);run.notes.forEach(note=>{if(note.type==='HOLD'&&note.activePointerId!==null)note.activePointerId=-1;});setPausedSongMs(Math.max(0,Number(run.audio.songTimeMs())||0));run.paused=true;stopFrame();run.audio.pause();setView(v=>({...v,status:'paused'}));};
  /* 再開は 3→2→1 と数えてから(開始のカウントダウンと同じ部品を使い、READYだけ省く)。
     数えているあいだに画面を離れた・リスタートした(generationが変わった)ら鳴らさない。
     二度押しで数えが2本走らないよう resumingRef で止める */
  const resume=async()=>{const run=runRef.current;if(!run||run.finished||!run.paused||resumingRef.current)return;const generation=generationRef.current;resumingRef.current=true;setResumeCountdown(true);const counted=await runCountdown(generation,RHYTHM_RESUME_COUNTDOWN_STEPS);resumingRef.current=false;if(!mountedRef.current)return;setResumeCountdown(false);if(!counted||generation!==generationRef.current||runRef.current!==run||run.finished||!run.paused)return;const resumed=await run.audio.resume();if(!resumed)return;run.paused=false;setView(v=>({...v,status:'playing'}));scheduleTick();};
  const restart=()=>{const startBest=runRef.current?.startBest;if(startBest)beginRun(startBest);};
  const abort=()=>{++generationRef.current;startLockRef.current=false;disposeRun();onExit();};
  // ageMs … 入力イベントが起きてから処理されるまでの遅れ(rhythmInputAgeMs)。判定に使う曲の時刻から差し引く。
  //          指が触れた瞬間の曲の時刻で判定するためのもので、判定窓そのものは変えない
  const inputStarts=(inputs,ageMs=0)=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs()-(Number(ageMs)>0?Number(ageMs):0);run.inputFeedbackState=run.inputFeedbackState||new Map();rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs).forEach(({input,target,deltaMs,standby})=>{run.inputFeedbackState.set(input.inputKey,{subLane:Math.max(0,Math.min(RHYTHM_SUB_LANE_COUNT-1,Math.floor(input.subLaneCoordinate))),subLaneCoordinate:Number(input.subLaneCoordinate),empty:!target||target.type==='TAP'});RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget(input.inputKey,target);
      // いま押さえている帯へ、持ち替えのために置いた2本目の指。
      // まだ何も取らないが、1本目が離れたらこの指へそのまま渡す(inputEndsを参照)。
      // 空打ちの音は鳴らさない(押し損ねたわけではないので)
      if(!target&&standby){
        run.standbyPointers.set(input.inputKey,standby.index);
        if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}
        return;
      }
      if(!target){RHYTHM_NOTE_SE_RUNTIME.playEmpty();if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}return;}const judgment=rhythmJudgeTap(deltaMs);if(target.type==='HOLD'){
      // 持ち替えの途中(離したばかりで浮いている)なら、続きとして引き継ぐ。
      // 始点の判定は最初に押さえたときのものを保つ(持ち替えで良くも悪くもならない)
      const handover=target.releasedAtMs!=null;
      target.activePointerId=input.inputKey;
      if(handover){target.releasedAtMs=null;rhythmFloatingNoteRemove(target);}
      else{target.holdJudgment=judgment;target.holdDeltaMs=deltaMs;}
      run.activePointers.set(input.inputKey,target.index);if(input.captureTarget&&input.pointerId!==undefined){try{input.captureTarget.setPointerCapture(input.pointerId);}catch{}}const side=rhythmFastSlow(deltaMs);setView(v=>({...v,last:'HOLD',lastPrecise:false,fastSlow:side||''}));scheduleJudgmentClear();return;}applyJudgment(target,judgment,deltaMs);});};
  const inputMoves=(inputKey,subLaneCoordinate)=>{const run=runRef.current,state=run?.inputFeedbackState?.get(inputKey);if(!state||!Number.isFinite(subLaneCoordinate))return;if(Math.abs(subLaneCoordinate-state.subLaneCoordinate)<RHYTHM_TAP_REJUDGE_MOVE_SUBLANES)return;const subLane=Math.max(0,Math.min(RHYTHM_SUB_LANE_COUNT-1,Math.floor(subLaneCoordinate)));if(subLane===state.subLane)return;state.subLane=subLane;state.subLaneCoordinate=subLaneCoordinate;if(state.empty)inputStarts([{lane:Math.floor(subLane/2),subLaneCoordinate,inputKey,rejudge:true}]);};
  // 押さえている帯へ先に置いてあった「控えの指」を探す。
  // 親指で遊ぶ人は「2本目を置いてから1本目を離す」ので、離した瞬間に渡せないと必ずMISSになる
  const standbyFingerFor=(run,noteIndex,exceptKey)=>{
    for(const [key,index] of run.standbyPointers){
      if(index!==noteIndex||key===exceptKey)continue;
      return key;
    }
    return null;
  };
  const inputEnds=inputs=>{const run=runRef.current;if(!run||run.finished||run.paused)return;const now=run.audio.songTimeMs();inputs.forEach(input=>{run.inputFeedbackState?.delete(input.inputKey);run.standbyPointers.delete(input.inputKey);const noteIndex=run.activePointers.get(input.inputKey);if(noteIndex===undefined)return;run.activePointers.delete(input.inputKey);const note=run.notes[noteIndex];if(!note||note.done)return;note.activePointerId=null;const holdEndMs=note.endTimeMs+settings.judgmentTimingOffsetMs;
    // 先に置いてある指があれば、離したその場でそこへ渡す。
    // 浮いている状態を経由しないので、猶予の時間切れに巻き込まれない
    const takeover=standbyFingerFor(run,noteIndex,input.inputKey);
    if(takeover&&!note.done&&now<holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){
      note.activePointerId=takeover;
      note.releasedAtMs=null;rhythmFloatingNoteRemove(note);
      run.activePointers.set(takeover,noteIndex);
      run.standbyPointers.delete(takeover);
      // 経路の追従を続けるため、元の種類で結び直す(SLIDEがただのHOLDへ化けない)
      RHYTHM_GESTURE_RUNTIME.bind(takeover,note,note._rhythmOriginalType||note.type,now,settings.judgmentTimingOffsetMs);
      if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}
      return;
    }
    // 終わり際まで来ていれば、そのまま成立させる
    if(now>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS){applyJudgment(note,note.holdJudgment||'MISS',note.holdDeltaMs||0);}
    // まだ途中なら、すぐには失敗にしない。指を入れ替えている途中かもしれないので、
    // 猶予のあいだは「浮いている」ことだけ覚えておく(rAFのvisitNoteが時間切れを見る)
    else{note.releasedAtMs=now;rhythmFloatingNoteAdd(note);}if(input.releaseTarget&&input.pointerId!==undefined){try{if(input.releaseTarget.hasPointerCapture?.(input.pointerId))input.releaseTarget.releasePointerCapture(input.pointerId);}catch{}}});};
  // 入力のたびに getBoundingClientRect() を呼ぶと、そのフレームで書き込み待ちだった
  // ノーツの位置をすべて確定させられる(強制レイアウト)。指の数ぶん・touchmoveの数ぶん
  // これが起きるため、タップのたびに一瞬止まって見える原因になる。FLICK/SLIDE側と
  // 同じ「1フレームに1回だけ測る」キャッシュを共有する(フレームごと・画面サイズ変化ごとに捨てる)。
  const inputAreaRect=area=>RHYTHM_GESTURE_RUNTIME.areaRect(area)||RHYTHM_VIEW_ROTATION.rectOf(area);
  // 指の位置も「回す前の座標」へそろえてからレーンに直す。
  // 自前で回していないときは受け取った値をそのまま返すだけ
  const inputPoint=(clientX,clientY)=>RHYTHM_VIEW_ROTATION.point(clientX,clientY);
  // 指を置くたびに10要素を querySelectorAll で引き直し、押していないサブレーンまで
  // 毎回書き込んでいた。要素は覚えておき、状態が変わったサブレーンだけ書き換える
  // (dataset/styleへの書き込みはそのたびにstyle再計算を誘発するため)。
  // 【2026-09-13・両手のときレーンが光らなくなる】
  // 押している場所には2つの出どころがある。指(touch)と、ポインタ(マウス＋接触幅の疑似入力'pen')。
  // それぞれが自分のぶんだけで setPressedLanes を呼んでいたため、**片方がもう片方を消して**いた。
  // 接触幅の疑似入力は指が太いほど何度も出るので、両手だとレーンの光が点いたり消えたりする。
  // 「押しているのに反応していないように見える」の一因。両方を足した集合を必ず渡す。
  const pressedLanesNow=()=>[...(liveTouchSubLanesRef.current||[]),...(runRef.current?.activePointerFeedback?.values()||[])];
  const setPressedLanes=coordinates=>{const area=playAreaRef.current;if(!area)return;const active=new Set(Array.from(coordinates||[]).map(value=>Math.max(0,Math.min(RHYTHM_SUB_LANE_COUNT-1,Math.floor(Number(value))))).filter(Number.isFinite)),glowOpacity=settings.laneGlow==='NONE'?'0':settings.laneGlow==='LOW'?'.35':'1';let nodes=glowNodesRef.current;if(!nodes||!nodes.length||!nodes[0].isConnected)nodes=glowNodesRef.current=Array.from(area.querySelectorAll('[data-rhythm-sublane-feedback]'));nodes.forEach((el,index)=>{const pressed=active.has(index);const want=pressed?'true':'false';if(el.dataset.pressed===want&&(!pressed||el.style.opacity===glowOpacity))return;el.dataset.pressed=want;el.style.opacity=pressed?glowOpacity:'0';});};
  const pointerDown=e=>{if(e.pointerType==='touch')return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const rect=inputAreaRect(area),p=inputPoint(e.clientX,e.clientY),lane=rhythmLaneAtPoint(p.x,p.y,rect),subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(p.x,p.y,rect);if(lane===null||subLaneCoordinate===null)return;const run=runRef.current;if(run){run.activePointerFeedback=run.activePointerFeedback||new Map();run.activePointerFeedback.set(e.pointerId,subLaneCoordinate);setPressedLanes(pressedLanesNow());}inputStarts([{lane,subLaneCoordinate,inputKey:rhythmInputKey('pointer',e.pointerId),captureTarget:e.currentTarget,pointerId:e.pointerId}],rhythmInputAgeMs(e.timeStamp,typeof performance!=='undefined'?performance.now():NaN));};
  const pointerMove=e=>{if(e.pointerType==='touch')return;const run=runRef.current;if(!run?.activePointerFeedback?.has(e.pointerId))return;e.preventDefault();const area=playAreaRef.current;if(!area)return;const mp=inputPoint(e.clientX,e.clientY),subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(mp.x,mp.y,inputAreaRect(area));if(subLaneCoordinate===null)return;run.activePointerFeedback.set(e.pointerId,subLaneCoordinate);setPressedLanes(pressedLanesNow());inputMoves(rhythmInputKey('pointer',e.pointerId),subLaneCoordinate);};
  const pointerEnd=e=>{if(e.pointerType==='touch')return;const run=runRef.current;if(run?.activePointerFeedback){run.activePointerFeedback.delete(e.pointerId);setPressedLanes(pressedLanesNow());}else setPressedLanes(pressedLanesNow());inputEnds([{inputKey:rhythmInputKey('pointer',e.pointerId),releaseTarget:e.currentTarget,pointerId:e.pointerId}]);};
  useEffect(()=>{const area=playAreaRef.current;if(!area||view.status==='result'||view.status==='celebrate')return;const syncTouches=e=>{if(e.cancelable)e.preventDefault();const current=runRef.current;if(!current||current.finished||current.paused)return;current.activeTouchInputs=current.activeTouchInputs||new Set();const rect=inputAreaRect(area),live=new Set(),liveSubLanes=[],starts=[],movedTouchInputs=e.type==='touchmove'?new Set(Array.from(e.changedTouches||[]).map(touch=>rhythmInputKey('touch',touch.identifier))):null;Array.from(e.touches||[]).forEach(touch=>{const inputKey=rhythmInputKey('touch',touch.identifier);live.add(inputKey);const tp=inputPoint(touch.clientX,touch.clientY),lane=rhythmLaneAtPoint(tp.x,tp.y,rect),subLaneCoordinate=rhythmSubLaneCoordinateAtPoint(tp.x,tp.y,rect);if(subLaneCoordinate!==null)liveSubLanes.push(subLaneCoordinate);if(current.activeTouchInputs.has(inputKey)){if(movedTouchInputs?.has(inputKey)&&subLaneCoordinate!==null)inputMoves(inputKey,subLaneCoordinate);return;}current.activeTouchInputs.add(inputKey);if(lane!==null&&subLaneCoordinate!==null)starts.push({lane,subLaneCoordinate,inputKey});});liveTouchSubLanesRef.current=liveSubLanes;setPressedLanes(pressedLanesNow());const ageMs=rhythmInputAgeMs(e.timeStamp,typeof performance!=='undefined'?performance.now():NaN);if(starts.length)inputStarts(starts,ageMs);const ended=[];Array.from(current.activeTouchInputs).forEach(inputKey=>{if(!live.has(inputKey)){current.activeTouchInputs.delete(inputKey);ended.push({inputKey});}});if(ended.length)inputEnds(ended);};RHYTHM_GESTURE_RUNTIME.invalidateAreaRect();area.addEventListener('touchstart',syncTouches,{passive:false});area.addEventListener('touchmove',syncTouches,{passive:false});area.addEventListener('touchend',syncTouches,{passive:false});area.addEventListener('touchcancel',syncTouches,{passive:false});return()=>{area.removeEventListener('touchstart',syncTouches);area.removeEventListener('touchmove',syncTouches);area.removeEventListener('touchend',syncTouches);area.removeEventListener('touchcancel',syncTouches);liveTouchSubLanesRef.current=[];setPressedLanes([]);};},[view.status]);
  if(view.status==='celebrate'){const celebrateResult=view.result,celebrateTitle=celebrateResult?.allMarvelous?'ALL MARVELOUS!!':celebrateResult?.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!';return <main data-rhythm-celebrate className="flex flex-1 items-center justify-center bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}} onClick={skipCelebrate}><div className="px-6 text-center"><b data-rhythm-celebrate-slam className="block text-6xl font-black leading-tight">{celebrateTitle}</b><small className="mt-3 block text-sm font-black tracking-[0.3em] text-slate-300">MAX COMBO {view.maxCombo}</small></div></main>;}
  // ===== タイミング合わせのリザルト(2026-09-13・ユーザー指摘「設定にもなってない」) =====
  // スコアやランクは意味を持たないので出さない。測った値をその場で設定へ入れられるようにする。
  // ★ここで決めたら、親が保存してオプションへ戻す(戻ってから別のボタンをもう一度押す、という
  //   二度手間にしない)。入れないまま戻ることもできる。
  if(calibrating&&view.status==='result'){const measured=view.result&&view.result.calibration?view.result.calibration:null;
    const label=measured?`${measured.offsetMs>0?'+':''}${measured.offsetMs}ms`:'';
    return <main data-rhythm-calibration-result className="flex-1 overflow-y-auto bg-slate-950 p-4 text-white" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
      <p className="text-center text-xs text-cyan-300">モンヒロビート・オプション</p>
      <h2 className="text-center text-lg font-black">🎯 タイミング合わせ</h2>
      {measured?<>
        <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-amber-300/50 bg-amber-950/30 p-4 text-center">
          <small className="block text-[11px] font-black tracking-[0.2em] text-amber-200">あなたのずれ</small>
          <b data-rhythm-calibration-offset className="mt-1 block text-4xl font-black tabular-nums text-amber-200">{label}</b>
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-200">
            数えた{measured.usedCount}回の平均は {measured.rawMeanMs>0?'+':''}{measured.rawMeanMs}ms（ばらつき ±{measured.spreadMs}ms{measured.droppedCount>0?`／${measured.droppedCount}回は外れ値として除外`:''}）でした。
          </p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">
            {measured.rawMeanMs<0?'ノーツより少し早く叩くくせがあります。':measured.rawMeanMs>0?'ノーツより少し遅れて叩くくせがあります。':'ほとんどずれていません。'}
            この値を入れると、いつもどおり叩いたときにちょうど真ん中で取れるようになります。
          </p>
          {!measured.stable&&<p data-rhythm-calibration-unstable className="mt-2 text-[11px] font-black text-rose-300">ばらつきが大きめです。もう一度合わせると、より合った値になります。</p>}
        </div>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-1 gap-2">
          <button data-rhythm-calibration-apply className="min-h-[52px] rounded-xl bg-amber-400 text-base font-black text-slate-950" onClick={()=>onApplyCalibration&&onApplyCalibration(measured)}>この値（{label}）にして戻る</button>
          <button data-rhythm-calibration-retry className="min-h-[48px] rounded-xl bg-fuchsia-700 font-black" disabled={startLockRef.current} onClick={()=>beginRun(runRef.current?.startBest)}>もう一度合わせる</button>
          <button data-rhythm-calibration-cancel className="min-h-[48px] rounded-xl border border-white/20 bg-slate-800 font-black" onClick={abort}>使わずにオプションへ戻る</button>
        </div>
      </>:<>
        <p className="mx-auto mt-5 max-w-sm rounded-2xl border border-rose-300/40 bg-rose-950/30 p-4 text-center text-[12px] font-bold leading-relaxed text-rose-100">うまく測れませんでした。ノーツが判定ラインへ来た瞬間に叩いてください（MISSは数えません）。</p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-1 gap-2">
          <button data-rhythm-calibration-retry className="min-h-[52px] rounded-xl bg-fuchsia-700 text-base font-black" disabled={startLockRef.current} onClick={()=>beginRun(runRef.current?.startBest)}>もう一度合わせる</button>
          <button data-rhythm-calibration-cancel className="min-h-[48px] rounded-xl border border-white/20 bg-slate-800 font-black" onClick={abort}>オプションへ戻る</button>
        </div>
      </>}
    </main>;}
  if(view.status==='result'){const result=view.result,rank=rhythmRankForScore(view.score);
    // 大きく出すマスモン。どの子かは rhythmResultHeroIndex が決める(その曲で能力がいちばん多く出た子)。
    // 横に広いときは左の欄、縦持ちはスコアの札の左に出す。同じ子を1回だけ決めて両方で使う
    const index=rhythmResultHeroIndex(sideArtUrls,runRef.current?.abilityCounts);const heroArt=index>=0?sideArtUrls[index]:'';
    // ===== リザルトの演出は結果で変える(2026-09-13・ユーザー依頼
    //   「演奏後のリザルト結果に応じて演出を変えてほしい」) =====
    // ★段(tier)はランクから作る。CSSの条件を増やさずに済むよう、数字ひとつへまとめる。
    //   M=5 / SS=4 / S=3 / A=2 / B・C=1 / それ以下=0。
    // ★失敗(FAILED)は段に関わらず出さない。派手に祝う画面ではないため。
    // ★演出量と軽量モードはここでも効かせる(器へそのまま渡して、CSS側で止める)。
    const rankTier=result.cleared===false?0:({M:5,SS:4,S:3,A:2,B:1,C:1}[rank]||0);
    return <main data-rhythm-result data-rank={rank} data-rank-tier={String(rankTier)}
      data-rhythm-effect={settings.effectAmount} data-rhythm-lightweight={settings.lightweightMode?'true':'false'}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white [container-type:inline-size] landscape:pl-[env(safe-area-inset-left)] landscape:pr-[env(safe-area-inset-right)]" style={{paddingTop:'env(safe-area-inset-top)'}}>
{/* ===== リザルトの並び(2026-09-26・ユーザー依頼「リザルト画面や曲選択画面をこれを参考にしたい」＝バンドリ！のリザルト) =====
    上から「曲の札(ジャケット・曲名・難易度・ランクのゲージ・ランク)」→「SCORE と自己ベスト」→「判定の表と MAX COMBO」。
    そのあとに周回・ビートP・解放・ライブログを並べ、ボタンは下の帯へ固定する(スクロールしても隠れない・中身も隠さない)。
    器の幅が680px以上(スマホの横向き)のときは左にマスモンの大きな絵を置き、右を2列(曲の札とスコア / 判定)にして、1画面で結果が読めるようにする。
    ★向き(landscape:)ではなく器の幅で分ける。タブレットの横向きは枠が600px幅のままなので、2列にすると詰まる
    ★背景のジャケットのぼかしは止まった絵を1回描くだけ。軽量モードでは出さない(index.html) */}
{hudArtSrc&&<div data-rhythm-result-backdrop aria-hidden="true" style={{backgroundImage:`url("${hudArtSrc}")`}}/>}
<div data-rhythm-result-frame className="relative flex min-h-0 flex-1 flex-col [@container(min-width:680px)]:flex-row">
{/* 横に広いときだけ、左に演奏に連れていったマスモンを大きく出す。どの子かは rhythmResultHeroIndex が決める(その曲で能力がいちばん多く出た子。2026-09-26 ユーザーに伝えた決め方)。絵は両サイドのマスモン用に焼いた1枚(sideArtUrls)を使い回す。
    マスモンがいないときは曲のジャケットを出す */}
{(()=>{const art=heroArt;if(!art&&!hudArtSrc)return null;return <aside data-rhythm-result-hero aria-hidden="true" className="relative hidden w-[31%] max-w-[360px] shrink-0 items-center justify-center p-3 [@container(min-width:680px)]:flex">{art?<img data-rhythm-result-hero-art src={art} alt="" draggable={false} decoding="async" className="relative max-h-full w-full object-contain"/>:<img data-rhythm-result-hero-jacket src={hudArtSrc} alt="" draggable={false} decoding="async" className="relative aspect-square w-[82%] rounded-2xl border border-white/20 object-cover"/>}</aside>;})()}
<div data-rhythm-result-body className="relative flex min-h-0 min-w-0 flex-1 flex-col">
<div data-rhythm-result-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
<h2 className="mb-2 text-[11px] font-black tracking-[.3em] text-cyan-200">RHYTHM RESULT</h2>
<div data-rhythm-result-summary className="[@container(min-width:680px)]:grid [@container(min-width:680px)]:grid-cols-2 [@container(min-width:680px)]:items-start [@container(min-width:680px)]:gap-2">
<div data-rhythm-result-summary-main>
<section data-rhythm-result-song className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-slate-900/85 p-2.5">
  {hudArtSrc&&<img data-rhythm-result-jacket src={hudArtSrc} alt="" draggable={false} decoding="async" className="h-16 w-16 shrink-0 rounded-xl border border-white/20 object-cover"/>}
  <div className="min-w-0 flex-1">
    <b data-rhythm-result-song-name className="block truncate text-base font-black leading-tight">{rhythmSongFullName(song)}</b>
    <div className="mt-0.5 flex items-baseline gap-1.5 text-[11px]"><b data-rhythm-difficulty-name className={`font-black ${rhythmDifficultyTextColor(difficulty.id)}`}>{difficulty.id}</b>{Number.isFinite(Number(chart.level))&&<span data-rhythm-result-level className="font-black tabular-nums text-slate-300">Lv.{chart.level}</span>}</div>
    {/* ランクのゲージ。その難易度の満点で届く上の5ランクに目印を置き、いまのスコアまで塗る。
        区切りは RHYTHM_RANKS のまま(ランクの決め方は変えない)。満点で届かないランクは出さない */}
    {(()=>{const max=Number(difficulty.maxScore)>0?Number(difficulty.maxScore):1000000;const asc=RHYTHM_RANKS.filter(item=>item.min>0&&item.min<=max).slice().reverse();const marks=asc.slice(-5);if(!marks.length)return null;const lowIndex=asc.indexOf(marks[0])-1;const low=lowIndex>=0?asc[lowIndex].min:0;const span=Math.max(1,max-low);const at=value=>Math.max(0,Math.min(100,(value-low)/span*100));return <div data-rhythm-result-gauge className="mt-1.5 pr-1.5">
      <div className="relative h-2 rounded-full bg-slate-800"><i data-rhythm-result-gauge-fill className="absolute inset-y-0 left-0 block rounded-full" style={{width:`${at(view.score).toFixed(1)}%`}}/>{marks.map(item=><i key={item.id} className="absolute top-1/2 block h-3 w-px -translate-y-1/2 bg-white/60" style={{left:`${at(item.min).toFixed(1)}%`}}/>)}</div>
      <div className="relative mt-0.5 h-3 text-[9px] font-black leading-none">{marks.map(item=>{const reached=view.score>=item.min;return <span key={item.id} data-rhythm-result-gauge-mark={item.id} data-reached={reached?'1':'0'} className={`absolute -translate-x-1/2 ${reached?RHYTHM_RANK_COLORS[item.id]||'text-white':'text-slate-600'}`} style={{left:`${at(item.min).toFixed(1)}%`}}>{item.id}</span>;})}</div>
    </div>;})()}
  </div>
  <div data-rhythm-result-rank data-rank-tier={String(rankTier)} className={`relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 border-current text-[38px] font-black italic ${RHYTHM_RANK_COLORS[rank]}`}>{rank}</div>
</section>
{/* アシストモード・ミラー譜面で遊んだことを、結果の上で言う。アシストは記録に残らないことも添える */}
{(result.assist||result.mirror)&&<div data-rhythm-result-play-mode className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-black">{result.assist&&<span className="rounded-full border border-emerald-300/60 bg-emerald-500/15 px-2 py-0.5 text-emerald-100">🛟 アシストモード（スコア8割・記録には残りません{Number(result.assistGuarded)>0?`・ガード${Number(result.assistGuarded)}回`:''}）</span>}{result.mirror&&<span className="rounded-full border border-sky-300/60 bg-sky-500/15 px-2 py-0.5 text-sky-100">↔ ミラー譜面</span>}</div>}
<section data-rhythm-result-score-card className="mt-2 rounded-2xl border border-white/10 bg-slate-900/85 px-3 py-2">
  {/* 2026-09-26 に見本の大きさへ(ユーザー指示「見本のほうがサイズ感が見やすい」)。SCOREの数字を大きく、
      縦持ちでも左にマスモンを出す(横に広いときは左の欄に出ているので、ここでは出さない) */}
  <div className="flex items-center gap-2">
    {heroArt&&<div data-rhythm-result-hero-portrait aria-hidden="true" className="-my-1 w-[34%] max-w-[150px] shrink-0 [@container(min-width:680px)]:hidden"><img data-rhythm-result-hero-art src={heroArt} alt="" draggable={false} decoding="async" className="max-h-[140px] w-full object-contain"/></div>}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5"><small className="text-[11px] font-black italic tracking-[.25em] text-slate-300">SCORE</small>{result.isNewRecord&&<b data-rhythm-new-record className="whitespace-nowrap rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black leading-none text-slate-950">NEW RECORD</b>}</div>
      <div data-rhythm-result-score className="text-[42px] font-black leading-none tabular-nums [@container(min-width:680px)]:text-[38px]">{view.score.toLocaleString()}</div>
    {/* ===== クリアか失敗か(2026-09-12・ユーザー指示) =====
    「終了後にクリアか失敗かもわかるようにして / それによって経験値も変わるから」。
    ランクやスコアより先に、まずここで結果を言い切る。失敗はライフが0になったまま
    曲を終えたとき(不可逆のDOWN)だけ。入る周回数(=経験値)も半分になる。
    ★古い result(cleared を持たない)はクリア扱いにする。
    ★2026-09-26 にスコアの下へ横長で置いた(数字を大きくするため、右の箱をやめた) */}
{(()=>{const failed=result.cleared===false;return <div data-rhythm-result-clear data-cleared={failed?'false':'true'} className="mt-1.5 flex items-center gap-2 rounded-xl border-2 px-2 py-1"><b className="shrink-0 text-lg font-black leading-none">{failed?'FAILED':'CLEAR'}</b><small className="min-w-0 text-[9px] font-black leading-snug">{failed?'ライフが0になったまま曲が終わりました（DOWN）':'ライフを残して最後まで演奏しました'}</small></div>;})()}
    </div>
  </div>
  <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-white/10 pt-1 text-[11px] font-black"><span className="tracking-wider text-slate-400">BEST SCORE</span><b data-rhythm-result-best className="tabular-nums text-slate-100">{result.bestScore.toLocaleString()}</b></div>
  {/* 次のランクまでのあと少し。その難易度の満点では届かないランクは出さない(rhythmNextRankId が止める) */}
{(()=>{const nextId=rhythmNextRankId(view.score,difficulty.maxScore);const next=nextId?RHYTHM_RANKS.find(item=>item.id===nextId):null;if(!next)return null;const need=next.min-view.score;if(!(need>0))return null;return <p data-rhythm-next-rank={nextId} className="mt-0.5 text-[11px] font-black tabular-nums text-slate-300">次のランク <b className={RHYTHM_RANK_COLORS[nextId]||'text-white'}>{nextId}</b> まで あと {need.toLocaleString()}</p>;})()}
{/* 前の自己ベストとの差。更新したら「+いくつ」、届かなかったら「あといくつ」。
    次の1回の目標が数字で分かるようにする。前の記録が無い(初めて遊んだ)ときは出さない */}
{(()=>{const before=runRef.current?.startBest;const prev=before&&before.played?Number(before.bestScore)||0:0;if(!(prev>0))return null;const diff=view.score-prev;return <p data-rhythm-best-diff className={`text-[11px] font-black tabular-nums ${diff>0?'text-emerald-300':'text-slate-400'}`}>{diff>0?`前の自己ベストから +${diff.toLocaleString()}`:diff===0?'自己ベストと同じスコア':`自己ベストまで あと ${(-diff).toLocaleString()}`}</p>;})()}
</section>
</div>
<div data-rhythm-result-summary-judgments className="mt-2 [@container(min-width:680px)]:mt-0">
{/* 判定の割合を1本の帯で。数字の表を読む前に、どの判定が多かったかが色でひと目で分かる。
    色は遊んでいるときに弾ける光と同じ(rhythmJudgmentColor)。0件の判定は帯に出さない */}
{(()=>{const total=RHYTHM_JUDGMENT_IDS.reduce((sum,id)=>sum+(Number(view.counts[id])||0),0);if(!(total>0))return null;return <div data-rhythm-result-ratio aria-hidden="true" className="mb-1.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-800">{RHYTHM_JUDGMENT_IDS.map(id=>{const count=Number(view.counts[id])||0;return count>0?<i key={id} data-rhythm-result-ratio-part={id} className="block h-full" style={{width:`${(count/total*100).toFixed(2)}%`,background:rhythmJudgmentColor(id)}}/>:null;})}</div>;})()}
<section data-rhythm-result-judgments className="flex items-stretch gap-2 [@container(min-width:680px)]:flex-col">
<dl data-rhythm-result-judgment-table className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 rounded-2xl border border-white/10 bg-slate-900/85 px-3 py-2 text-[15px] italic">{RHYTHM_JUDGMENT_IDS.map(id=><React.Fragment key={id}>
  {/* ★ぴったりのMARVELOUS(前後0.02秒以内)の回数。MARVELOUSの**内数**だが、並びは
      MARVELOUSの**上**へ置く(2026-09-13・ユーザー指示「普通に表示はMarvelousの上に
      JUST Marvelousがくるようにして」)。スコア・ランク・自己ベストには一切関わらない。 */}
  {id==='MARVELOUS'&&<React.Fragment key="precise">
    {/* ★大きさも並びもほかの判定と同じにする(2026-09-13・ユーザー指摘
        「リザルトの方もJUST Marvelous地味すぎる / スコアには乗らないだけで
        並びは同じようにして色合いは合わせて」)。小さくしていたのをやめる */}
    <dt data-rhythm-result-precise-label data-rhythm-judgment-row="JUST">JUST MARVELOUS</dt>
    <dd data-rhythm-result-precise data-rhythm-judgment-row="JUST" className="text-right font-mono">{Number(view.precise)||0}</dd>
  </React.Fragment>}
  {/* 判定の内訳は、遊んでいるときに出る判定の色と同じ色で出す
      (2026-09-13・ユーザー指示「JUST Marvelous（虹）/ Marvelous（金）みたいな」)。
      色は index.html の [data-rhythm-judgment-row] で決まる */}
  <dt data-rhythm-judgment-row={id}>{id}</dt><dd data-rhythm-judgment-row={id} className="text-right font-mono">{view.counts[id]}</dd>
</React.Fragment>)}
</dl>
{/* MAX COMBO は判定の表の右に大きく出す(バンドリ！の COMBO の置き方)。色は遊んでいるときの段と同じ */}
<div data-rhythm-result-combo className="flex w-[34%] shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/85 px-2 py-2 text-center [@container(min-width:680px)]:w-full [@container(min-width:680px)]:flex-row [@container(min-width:680px)]:justify-between [@container(min-width:680px)]:gap-3 [@container(min-width:680px)]:px-3 [@container(min-width:680px)]:py-1.5">
  <small className={`text-[10px] font-black tracking-[.2em] ${rhythmComboTextColor(view.maxCombo)}`}>MAX COMBO</small>
  <b data-rhythm-max-combo className={`block text-[34px] font-black leading-tight tabular-nums [@container(min-width:680px)]:text-[26px] ${rhythmComboTextColor(view.maxCombo)}`}>{view.maxCombo}</b>
  <div className="mt-1.5 grid w-full grid-cols-2 gap-1 text-[10px] font-black [@container(min-width:680px)]:mt-0 [@container(min-width:680px)]:w-32 [@container(min-width:680px)]:shrink-0"><span data-rhythm-result-fast className="rounded-lg bg-cyan-500/15 py-1 text-cyan-200">FAST<b className="block text-sm tabular-nums text-white">{view.fast}</b></span><span data-rhythm-result-slow className="rounded-lg bg-fuchsia-500/15 py-1 text-fuchsia-200">SLOW<b className="block text-sm tabular-nums text-white">{view.slow}</b></span></div>
</div>
</section>
{/* FAST と SLOW が大きく片寄ったときだけ、くせをひとこと。
    数が少ないうちは偶然の片寄りなので出さない(合わせて12回以上・片方が倍以上) */}
{(()=>{const fast=Number(view.fast)||0,slow=Number(view.slow)||0;if(calibrating||fast+slow<12)return null;const early=fast>=slow*2,late=slow>=fast*2;if(!early&&!late)return null;return <p data-rhythm-timing-tendency className={`mt-2 rounded-xl border px-3 py-2 text-[10px] font-bold leading-relaxed ${early?'border-cyan-400/30 bg-cyan-950/30 text-cyan-100':'border-fuchsia-400/30 bg-fuchsia-950/30 text-fuchsia-100'}`}>{early?'FASTが多めでした。少し早く叩くくせがあるようです。':'SLOWが多めでした。少し遅れて叩くくせがあるようです。'}気になるときは、オプションの「タイミング調整」→「🎯 実際の画面で合わせる」で合わせられます。</p>;})()}
</div>
</div>
{/* 達成をひと目で分かるように、いちばん上の称号だけを大きく出す(2026-09-03)。
    ALL MARVELOUS > ALL EXCELLENT > FULL COMBO の順に上位。残りは下に小さく並べる。 */}
{(result.fullCombo||result.allExcellent||result.allMarvelous)&&<div data-rhythm-result-celebrate className="my-3 text-center">
  <b className="block text-3xl font-black leading-tight">{result.allMarvelous?'ALL MARVELOUS!!':result.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!'}</b>
  <small className="mt-1 block text-[10px] font-black text-amber-200">{result.allMarvelous?'すべてMARVELOUS。文句なしの完璧です':result.allExcellent?'すべてEXCELLENT以上。ほぼ完璧です':'一度もコンボを切らずに完走しました'}</small>
</div>}
<div className="my-3 flex flex-wrap justify-center gap-2 text-xs font-black text-slate-300">{result.fullCombo&&<span>FULL COMBO</span>}{result.allExcellent&&<span>ALL EXCELLENT</span>}{result.allMarvelous&&<span>ALL MARVELOUS</span>}</div>{/* クイック∞周回を裏で回していたときだけ。曲の長さぶんが周回クリア扱いで入る */}
{/* 裏で∞周回していたのに失敗したとき。1周も入らないので、その理由をここで言う
    (2026-09-12・ユーザー指示「失敗しても入るようにすると放置で稼げるようになるから失敗は0にして」)。
    ★裏で周回していない人にはそもそも出ない(quickRunAwardがnullのまま) */}
{quickRunAward&&quickRunAward.loops===0&&quickRunAward.cleared===false&&<div data-rhythm-result-quick-run-failed className="my-3 rounded-2xl border border-rose-400/50 bg-rose-950/30 p-3 text-left">
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] font-black tracking-wider text-rose-200">クイック∞周回</span>
    <b className="text-lg font-black leading-none text-rose-200">+0周</b>
  </div>
  <p className="mt-1 text-[10px] font-bold leading-relaxed text-rose-100">ライフが0になったので、周回クリアにはなりません（クリアしていれば +{Number(quickRunAward.baseLoops||0)}周でした）。経験値・ダイヤ・絆・虹のプシュケーも入りません。</p>
  <p className="mt-1 text-[9px] font-bold leading-relaxed text-slate-400">裏の周回は止まっていたぶんを取り戻しながら、そのまま続きます。</p>
</div>}
{quickRunAward&&quickRunAward.loops>0&&<div data-rhythm-result-quick-run className="my-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-950/30 p-3 text-left">
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-[10px] font-black tracking-wider text-fuchsia-200">クイック∞周回</span>
    <b className="text-lg font-black leading-none text-white">+{quickRunAward.loops}周</b>
  </div>
  {/* イベントの対象曲だけ、ふだんの2倍ではなく3倍で入る(2026-09-11・ユーザー指示)。
      入った周回数だけでは「この曲だから多かった」と気づけないので、その場で言う */}
  {quickRunAward.eventBoosted&&<div data-rhythm-result-quick-run-event className="mt-1.5 rounded-xl border border-amber-300/50 bg-amber-950/40 px-2 py-1 text-[10px] font-black text-amber-200">🏆 イベント対象曲 ×{quickRunAward.scale}（ふだんの曲は ×{RHYTHM_PLAY_RUN_LOOP_SCALE}）</div>}
  <div className="mt-1 text-[11px] font-black text-slate-200">{quickRunAward.fromLoop}周目 <span className="text-slate-500">→</span> {quickRunAward.toLoop}周目</div>
  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold text-slate-300">
    <span>経験値 <b className="text-cyan-300">+{Number(quickRunAward.xp||0).toLocaleString()}</b></span>
    <span>ダイヤ <b className="text-amber-300">+{Number(quickRunAward.gold||0).toLocaleString()}</b></span>
    {quickRunAward.bond>0&&<span>絆 <b className="text-pink-300">+{Number(quickRunAward.bond).toLocaleString()}</b></span>}
    {quickRunAward.psyche>0&&<span>🌈 <b className="text-fuchsia-200">+{Number(quickRunAward.psyche).toLocaleString()}</b></span>}
    {quickRunAward.shard>0&&<span>🎖️ <b className="text-amber-200">+{Number(quickRunAward.shard).toLocaleString()}</b></span>}
  </div>
</div>}
{/* このクリアで上の難易度が開いたら、その場で知らせる。解放は曲えらびで鍵が外れるだけで、
    それまでは戻って難易度ボタンを見ないと気づけなかった。
    ★前の記録がまだクリアしていなかったときだけ(=このプレイで初めて開いたときだけ)出す。
    ★練習・タイミング合わせ・デバッグから始めたプレイは記録に残らないので出さない */}
{(()=>{if(tutorial||calibrating||debugPlay||result.assist||result.cleared===false)return null;const before=runRef.current?.startBest;if(before&&before.clear===true)return null;const opened=Object.keys(RHYTHM_DIFFICULTY_UNLOCK_BY).find(id=>RHYTHM_DIFFICULTY_UNLOCK_BY[id]===difficulty.id&&rhythmChartPlayable(song,id));if(!opened)return null;return <div data-rhythm-result-unlock={opened} className="mx-auto my-3 max-w-xs rounded-2xl border-2 border-amber-300/70 bg-amber-500/15 px-3 py-2 text-center"><b className="block text-base font-black text-amber-100">🔓 {opened} が解放されました！</b><small className="mt-0.5 block text-[10px] font-bold text-amber-200/90">この曲の {opened}（Lv.{song.difficulties[opened].level}）を曲えらびで選べます</small></div>;})()}
{result.luck&&(result.luck.draws>0||result.luck.points>0)&&<div data-rhythm-result-luck className="mx-auto my-2 max-w-xs rounded-2xl border border-lime-300/50 bg-lime-950/30 px-3 py-2 text-center"><small className="block text-[10px] font-black tracking-wider text-lime-200">🍀 ラッキーラッシュ</small><b className="mt-0.5 block text-lg font-black tabular-nums text-white">{Number(result.luck.points).toLocaleString()}pt</b><span className="mt-0.5 block text-[10px] font-bold text-lime-100">抽選 {result.luck.draws}回・RUSH {result.luck.rush}回{result.luck.bonus>0?`・おまけビートP +${result.luck.bonus}P`:''}</span></div>}
{result.eventPointAward&&result.eventPointAward.amount>0&&<div data-rhythm-result-beat-points className="mx-auto my-3 max-w-xs rounded-2xl border border-violet-400/50 bg-violet-950/35 px-3 py-2 text-center"><small className="block text-[10px] font-black tracking-wider text-violet-200">🎟️ ビートP獲得</small><b className="mt-0.5 block text-2xl font-black text-white">+{result.eventPointAward.amount.toLocaleString()}P</b>{result.eventPointAward.target&&<span className="mt-1 block text-[9px] font-black text-amber-200">イベント対象曲 1.5倍</span>}{result.eventPointAward.offEvent&&<span data-rhythm-result-beat-points-off-event className="mt-1 block text-[9px] font-black text-violet-200">イベント開催中はこの5倍もらえます</span>}</div>}{/* ライブログ(バンドリ！アワーノーツの演奏後の振り返り)。曲を8つの区間に分け、区間ごとに
    MARVELOUS・EXCELLENTの割合を棒の高さで、BAD・MISSの数を下の数字で出す。いちばん崩れた区間を一言で言う */}
{(()=>{const sections=Array.isArray(result.liveLog)?result.liveLog:[];if(!sections.some(section=>section.total>0))return null;const worst=sections.filter(section=>section.total>=3&&(section.bad+section.miss)>0).sort((a,b)=>(b.bad+b.miss)/b.total-(a.bad+a.miss)/a.total)[0]||null;return <div data-rhythm-live-log className="mb-2 rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2">
  <div className="flex items-baseline justify-between"><b className="text-[11px] font-black tracking-wider text-cyan-200">ライブログ</b><small className="text-[9px] font-bold text-slate-400">棒＝MARVELOUS・EXCELLENTの割合 / 数字＝BAD・MISS</small></div>
  <div className="mt-2 grid grid-cols-8 items-end gap-1" style={{height:'44px'}}>{sections.map((section,i)=>{const rate=section.rate==null?0:section.rate;const color=section.total===0?'#334155':rate>=.9?'#fbbf24':rate>=.7?'#e879f9':rate>=.5?'#f87171':'#60a5fa';return <i key={i} data-rhythm-live-log-bar={String(i)} className="block rounded-t" style={{height:`${Math.max(6,Math.round(rate*100))}%`,background:color,opacity:section.total===0?.4:(section===worst?1:.85),outline:section===worst?'2px solid rgba(251,113,133,.9)':'none'}}/>;})}</div>
  <div className="mt-1 grid grid-cols-8 gap-1 text-center text-[9px] font-black tabular-nums">{sections.map((section,i)=><span key={i} className={section.bad+section.miss>0?'text-rose-300':'text-slate-500'}>{section.total===0?'−':section.bad+section.miss}</span>)}</div>
  <div className="mt-0.5 flex justify-between text-[8px] font-bold tabular-nums text-slate-500"><span>0:00</span><span>{rhythmClockLabel(result.liveLogEndMs)}</span></div>
  <p data-rhythm-live-log-worst className="mt-1 text-[10px] font-bold leading-relaxed text-slate-300">{worst?`いちばん崩れたのは ${rhythmClockLabel(worst.fromMs)}〜${rhythmClockLabel(worst.toMs)} の区間でした（BAD・MISS ${worst.bad+worst.miss}回）。`:'どの区間も BAD・MISS なしで通せました。'}</p>
</div>;})()}
</div>
<div data-rhythm-result-actions className="relative shrink-0 border-t border-white/10 bg-slate-950/90 px-4 pt-2" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}><div className="grid grid-cols-2 gap-2"><button className="min-h-[48px] rounded-xl bg-fuchsia-700 font-black" disabled={startLockRef.current} onClick={()=>beginRun(mergeRhythmBestRecord(runRef.current?.startBest,result))}>もう一度プレイ</button><button className="min-h-[48px] rounded-xl bg-indigo-700 font-black" onClick={abort}>{debugPlay?'音ゲーデバッグへ戻る':'曲えらびへ戻る'}</button></div></div></div></div></main>}
  /* ★ここへ属性を足すときは className の「後ろ」へ置く。
     rhythm-screen-layout-check.js が <main data-rhythm-tap-test className="…overflow-hidden という
     文字列の並びをそのまま見ているので、あいだに挟むと「1画面になっていない」と落ちる。 */
  return <main data-rhythm-tap-test className="relative flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white landscape:pl-[env(safe-area-inset-left)] landscape:pr-[env(safe-area-inset-right)]" data-rhythm-lightweight={settings.lightweightMode?'true':'false'} data-rhythm-effect={settings.effectAmount} style={{touchAction:'none'}}><header data-rhythm-hud className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-3 pt-1.5"><div ref={hudLeftRef} data-rhythm-hud-left className="min-w-0 max-w-[35vw] text-left landscape:max-w-[28vw]"><div className="landscape:flex landscape:items-center landscape:gap-2"><div className="flex items-center gap-1.5"><div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current bg-slate-950/85 landscape:h-7 landscape:w-7 ${RHYTHM_RANK_COLORS[rhythmRankForScore(view.score)]}`} style={{boxShadow:'0 0 8px rgba(103,232,249,.35)'}}><b data-rhythm-rank className="text-sm font-black leading-none" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{rhythmRankForScore(view.score)}</b></div><div className="min-w-0 landscape:min-w-0"><div className="flex items-center gap-0.5 landscape:hidden"><div data-rhythm-rank-gauge className="relative h-1.5 w-14 overflow-hidden rounded-full border border-white/25 bg-slate-950/80"><i aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300" style={{width:`${rhythmRankProgress(view.score)}%`}}/></div><b data-rhythm-rank-next className="shrink-0 text-[9px] font-black leading-none text-slate-300">{rankNextLabel}</b></div><b data-rhythm-score className="mt-0.5 block font-black leading-none tabular-nums landscape:mt-0" style={{fontSize:'min(18px,4.6vw)',textShadow:'0 1px 6px rgba(2,6,23,.96)'}}>{view.score.toLocaleString()}</b><small className="mt-0.5 block text-[9px] font-bold leading-none text-slate-300 landscape:hidden" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>BEST {Number(bestRecord?.bestScore||0).toLocaleString()}</small></div></div><div className="mt-1.5 flex max-w-[34vw] flex-wrap items-center gap-1 landscape:mt-0 landscape:min-w-0 landscape:shrink"><span className="shrink-0 rounded bg-fuchsia-700/85 px-1.5 py-0.5 text-[9px] font-black leading-none">{difficulty.id}</span><small data-rhythm-mode-label className="text-[9px] font-bold leading-none tracking-[0.14em] text-cyan-300 landscape:hidden" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{calibrating?'タイミング合わせ':tutorial?'れんしゅう':debugPlay?debugChartLabel:`Lv.${chart.level}`}</small></div></div>{/* 曲名のとなり(レーンの外)に小さくジャケットを出す(2026-09-26・ユーザー指示「ジャケットは置くにもレーン外の曲名のあたりがいい」)。
    絵が無い曲は出さない。動かないので毎フレームの仕事は増えない。縦向きは左上の表示が道にかからないよう、絵のぶん曲名の幅を縮める */}
<div className="mt-1 flex items-center gap-1.5 landscape:mt-0.5 landscape:min-w-0">{hudArtSrc&&<img data-rhythm-hud-art src={hudArtSrc} alt="" aria-hidden="true" decoding="async" draggable={false} className="h-7 w-7 shrink-0 rounded-md border border-white/25 object-cover landscape:h-6 landscape:w-6" style={{boxShadow:'0 1px 6px rgba(2,6,23,.8)'}}/>}<div data-rhythm-hud-song className="min-w-0 max-w-[31vw] text-[10px] font-black text-slate-100 landscape:max-w-none" style={{maxWidth:hudArtSrc&&!isLandscape?'calc(31vw - 34px)':undefined,display:'-webkit-box',WebkitLineClamp:isLandscape?'1':'3',WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:'1.25',textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>♪ {rhythmSongFullName(song)}</div></div></div><div data-rhythm-hud-right className="flex w-[33vw] max-w-[33vw] flex-col items-end gap-1.5">{/* ★縦持ちでも中身を右へそろえる(flex-col items-end)。ブロックのままだとポーズがライフの行の**左端**に並び、
    ライフ表示を大きくして行が左へ伸びると、ポーズもいっしょにレーンの上へ出ていた(2026-09-24・ユーザーの実機の指摘) */}<div className="flex flex-col items-end landscape:flex-row landscape:items-center landscape:gap-2"><div ref={lifeBoxRef} data-rhythm-life data-life-state={lifeState} data-life-wide={isLandscape?'1':''} style={{'--mh-life-scale':rhythmFiniteInRange(settings.lifeDisplaySize,RHYTHM_LIFE_SIZE_MIN,RHYTHM_LIFE_SIZE_MAX,150)/100}} className="relative flex flex-nowrap items-center justify-end gap-x-1"><span aria-hidden="true" data-rhythm-life-heart className="leading-none text-rose-400" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{lifeState==='down'?'💔':'♥'}</span>{/* ★太さ・幅は「小さい端末(320px)でも台形の外の空きへ収まる」ところで止めてある。
        これ以上太く・広くすると tools/mode/rhythm-hud-wedge-check.js が落ちる。
        気づきやすさは大きさではなく、色・点滅・ひび割れ・減った量の数字で出す */}<div data-rhythm-life-track className="relative rounded-full border bg-slate-950/80"><i data-rhythm-life-bar aria-hidden="true" className="absolute inset-y-0 left-0 rounded-full" style={{width:`${(lifeRatio*100).toFixed(1)}%`,background:lifeRatio>.5?'linear-gradient(90deg,#34d399,#22d3ee)':lifeRatio>.25?'linear-gradient(90deg,#fbbf24,#fb923c)':'linear-gradient(90deg,#fb7185,#ef4444)',transition:settings.lightweightMode?'none':'width 140ms linear'}}/></div><b data-rhythm-life-value className="font-black leading-none tabular-nums text-slate-200" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}>{lifeState==='down'?'DOWN':view.life}</b>{/* 減った量(「-50」)を、減ったその場に一瞬だけ出す。中身はapplyJudgmentが直接書く */}<b ref={lifeDamageRef} data-rhythm-life-damage aria-hidden="true" className="pointer-events-none absolute right-0 top-full mt-0.5 text-[11px] font-black leading-none tabular-nums"/></div><button data-rhythm-pause aria-label="ポーズ" className="pointer-events-auto mt-1 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-900/90 text-2xl font-black text-white shadow-[0_0_12px_rgba(103,232,249,0.18)] landscape:mt-0" onClick={pause}>Ⅱ</button></div><b ref={abilityBadgeRef} data-rhythm-ability-badge hidden className="mt-1 block text-right text-[9px] font-black leading-none tracking-[0.06em] text-amber-200 landscape:inline-block landscape:mt-0.5" style={{textShadow:'0 1px 4px rgba(2,6,23,.92)'}}/></div></header>{/* ===== 曲の進みぐあい・経過時間・自己ベスト比(2026-09-24) =====
    ★レーン(台形)の右のふちに寄せて置く。音ゲーは目線がレーンに集まるので、レーンから遠いほど読みにくい
      (ユーザー指摘「残り時間がちょっと目に入りづらい / レーンより遠くなればなるほど目線的にきつくなる」)。
      それまではHUDの右の列の右はしにあり、「🔄 横」で回した横画面では画面のいちばん端まで離れていた。
    ★横の位置は台形のふち(rhythmProjectionScale)から決める。この高さの帯(縦持ち上から82〜112px・横持ち46〜76px)では、
      ふちは画面幅の62〜64%あたりにあるので、64%(横持ち64.5%)+4pxから始めれば、どの画面の高さでもレーンにかからない。
      縦持ちはポーズの下(ポーズはライフ200%でも75pxまで)、横持ちはライフの下(39pxまで)に置き、重ならない。
      横持ちは枠を中身の幅(max-content)にする。右はしまで伸ばすと、枠だけがポーズに重なる。
      縦持ちは右の余白までに収め、狭い画面ではバーが縮む(shrink)。
    ★HUDの検査(rhythm-hud-wedge-check)が写すのは <header> の中だけなので、ここは外に置いて自分で位置を決める。
      中身(時間・自己ベスト比)は毎フレームの処理と判定の処理が ref から直接書く */}
<div data-rhythm-song-clock data-clock-wide={isLandscape?'1':''} data-clock-side={clockOnLeft?'left':'right'} aria-hidden="true" className="pointer-events-none absolute z-30 flex flex-col items-start gap-1" style={clockOnLeft?(clockPlace?{left:`${clockPlace.left}px`,top:`${clockPlace.top}px`,width:`${clockPlace.width}px`}:{left:'12px',top:'110px',width:'100px',visibility:'hidden'}):{left:'calc(64.5% + 4px)',top:'46px',width:'max-content'}}>
  <div className="flex w-full min-w-0 items-center gap-1.5"><div className="relative h-[5px] w-12 min-w-0 shrink overflow-hidden rounded-full border border-white/25 bg-slate-950/80"><i ref={songProgressRef} className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" style={{transform:'scaleX(0)',transformOrigin:'left center'}}/></div><b ref={songTimeRef} data-rhythm-song-time className="shrink-0 text-[11px] font-black leading-none tabular-nums text-white" style={{textShadow:'0 1px 3px rgba(2,6,23,1),0 0 6px rgba(2,6,23,.9)'}}>0:00</b></div>
  {/* アシストモード・ミラー譜面で遊んでいることを、演奏中もひと目で分かるようにする */}
  {(assistOn||mirrorOn)&&<span data-rhythm-play-mode className="flex gap-1 text-[9px] font-black leading-none">{assistOn&&<span className="rounded bg-emerald-600/80 px-1 py-0.5 text-white">ASSIST</span>}{mirrorOn&&<span className="rounded bg-sky-600/80 px-1 py-0.5 text-white">MIRROR</span>}</span>}
  {/* ラッキーゲージ。満タンで抽選(ラッキーラッシュ)。中身は判定のたびに applyJudgment が書く */}
  {luckOn&&<div data-rhythm-luck data-rush={luckyRush?'1':'0'} className="flex items-center gap-1"><span className="text-[10px] leading-none">🍀</span><div className="relative h-[4px] w-10 overflow-hidden rounded-full border border-white/20 bg-slate-950/80"><i ref={luckGaugeRef} data-rhythm-luck-gauge className="absolute inset-y-0 left-0 w-full rounded-full" style={{transform:'scaleX(0)',transformOrigin:'left center'}}/></div><b ref={luckPointsRef} data-rhythm-luck-points className="text-[9px] font-black leading-none tabular-nums text-lime-200" style={{textShadow:'0 1px 3px rgba(2,6,23,1)'}}>0pt</b></div>}
  {/* 自己ベスト比。中身と色は判定のたびに applyJudgment が書く(前の記録が無ければ出さない) */}
  <b ref={paceRef} data-rhythm-pace hidden className="max-w-full truncate text-[10px] font-black leading-none tabular-nums text-slate-200" style={{textShadow:'0 1px 3px rgba(2,6,23,1),0 0 6px rgba(2,6,23,.9)'}}/>
</div>{/* ===== ライフ0(DOWN)の強調(2026-09-12・ユーザー指示) ===== */}
{/* 倒れているあいだ、画面のふちをずっと赤く縁取る。HUDの小さなバーだけでは
    「いつの間にか0だった」に気づけないため。指の当たり判定には関わらない(pointer-events-none) */}
{lifeState==='down'&&<div data-rhythm-down-vignette aria-hidden="true" className="pointer-events-none absolute inset-0 z-20"/>}
{/* 0になったその瞬間だけ、大きく1度だけ出す(1.4秒で消える) */}
{lifeDownSlam&&<div data-rhythm-life-down-slam aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[32%] z-40 text-center"><b className="block text-5xl font-black leading-none">LIFE 0</b><small className="mt-1 block text-xs font-black tracking-[0.34em]">DOWN</small></div>}
<div ref={playAreaRef} data-rhythm-play-area data-rhythm-counting={countdownStep!==null?'1':undefined} data-rhythm-strip={RHYTHM_STRIP.value||undefined} data-rhythm-lightweight={settings.lightweightMode?'true':'false'} data-rhythm-effect={settings.effectAmount} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} className="relative mx-2 mb-2 flex-1 min-h-0 overflow-hidden border-x border-cyan-400/50" style={{/* position と overflow はここにも直接書く。ノーツも判定ラインもこの箱を基準に
    置いているので、Tailwindの relative が効く前だと基準が別の要素へ移り、
    判定ラインが画面の変なところへ出る(2026-09-05)。中身の置き場所に関わるものは
    外部CSSに任せない */position:'relative',overflow:'hidden',touchAction:'none',WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none','--rhythm-note-size-scale':settings.noteSize/100,
    /* 判定ラインの高さ(下から何%)。ライン本体・弾ける光・判定文字がこれを見る
       (2026-09-13・ユーザー依頼「下過ぎて使いづらいという声があり」)。
       ★ノーツが流れ着く先は measureTravel が**ラインを実測**して決めるので、
         ここを動かすだけで譜面も判定もそのままついてくる */
    '--mh-judgment-line-bottom':`${rhythmFiniteStep(settings.judgmentLineHeight,RHYTHM_JUDGMENT_LINE_HEIGHT_MIN,RHYTHM_JUDGMENT_LINE_HEIGHT_MAX,RHYTHM_JUDGMENT_LINE_HEIGHT_STEP,DEFAULT_RHYTHM_SETTINGS.judgmentLineHeight)}%`,filter:settings.effectAmount==='MINIMAL'?'saturate(.78)':settings.effectAmount==='LOW'?'saturate(.92)':'none'}}>{laneElements}{/* ライブ背景。いちばん奥(z-index:-1)。見た目は index.html の [data-rhythm-stage] が持つ */}
{stageLevel!=='SIMPLE'&&<div ref={stageHostRef} data-rhythm-stage={stageLevel} data-stage-tier={String(stageTierNow)} aria-hidden="true">
  {stageArtSrc&&<canvas ref={stageArtRef} data-rhythm-stage-art width="24" height="24"/>}
  {/* サーチライトと光の粒は、1度だけ焼いた画像を CSS のアニメーション(合成だけで動く)で動かす(2026-09-26)。
      以前はサーチライトを clip-path で切り抜いた層、光の粒を画面の2倍の高さの CSS の模様で作っていた */}
  {stageFxOn&&stageImages&&<><img data-rhythm-stage-beam="left" src={stageImages.beams[stageTierNow]||stageImages.beams[0]} alt="" draggable={false}/><img data-rhythm-stage-beam="right" src={stageImages.beams[stageTierNow]||stageImages.beams[0]} alt="" draggable={false}/>
    <img data-rhythm-stage-sparks="far" src={stageImages.sparks[0]} alt="" draggable={false}/><img data-rhythm-stage-sparks="near" src={stageImages.sparks[1]} alt="" draggable={false}/></>}
</div>}{/* ノーツのタイミングの光だけは、レーンの上(z-index:1)・判定の帯とノーツ(2〜6)の下へ置く。
    背景の側に置くとレーンの暗い面に隠れて、下のふちがうっすら光るだけになっていた */}
{stageLevel!=='SIMPLE'&&<i ref={stagePulseRef} data-rhythm-stage-pulse data-stage-tier={String(Math.min(3,Math.floor(comboTier/2)))} aria-hidden="true"/>}{sideMonsterElements}{cutInElements}<div ref={screenFlashRef} data-rhythm-screen-flash aria-hidden="true"/>{/* ===== コンボ数(2026-09-12・ユーザー指示) =====
    「コンボももう少し目立つように段階的に / あと右より過ぎるから邪魔にならないように真ん中に寄せて」。
    右上のHUDから**プレイエリアの真ん中**へ移した。
    ★HUDの左右の列は、レーンの台形の外側の空きに置いてある。その空きは上へ行くほど広く、
      **画面のいちばん上の中央は台形の頂点(ノーツが湧く点・幅18%)**なので、
      HUDの中では「真ん中へ寄せる」余地がそもそも無かった(左列35vw / 台形41〜59% / 右列33vw)。
      プロセカ・チュウニズムと同じく、場に重ねて中央へ置くのが素直な答え。
    ★邪魔にならないよう **ノーツより後ろ(z-2。ノーツはz-5、判定ラインはz-6)** に描き、
      少し透かす。コンボが0のあいだは出さない。
    ★大きさの上限が無くなったので、段(comboTier)でしっかり大きくできる
      (HUDに居たころは台形にかかるので1.13倍までしか上げられなかった)。 */}
{settings.comboDisplay!==false&&view.combo>0&&<div data-rhythm-combo-box data-combo-status={comboStatus} data-combo-tier={String(comboTier)} data-combo-pos={comboPosition} data-combo-wide={isLandscape?'1':''} aria-hidden="true" style={{'--mh-combo-opacity':rhythmFiniteInRange(settings.comboOpacity,RHYTHM_COMBO_OPACITY_MIN,RHYTHM_COMBO_OPACITY_MAX,100)/100}} className="pointer-events-none absolute z-[2] text-center"><b ref={comboRef} data-rhythm-combo data-combo-tier={String(comboTier)} className="block font-black leading-none tabular-nums text-white" style={{'--mh-combo-scale':rhythmComboTierScale(comboTier),'--mh-combo-size':rhythmFiniteInRange(settings.comboSize,RHYTHM_COMBO_SIZE_MIN,RHYTHM_COMBO_SIZE_MAX,100)/100}}>{view.combo}</b><span data-rhythm-combo-label className="mt-1 block font-black leading-none tracking-[0.36em]">COMBO</span>{comboStatus&&<span data-rhythm-combo-status-mark={comboStatus} className="block font-black leading-none">{comboStatus==='AM'?'ALL MARVELOUS':'FULL COMBO'}</span>}</div>}{/* 判定ラインはTailwindのクラスを使わず、位置・高さ・色をすべてここへ直接書く。
    Tailwindは外部CDNのJITが後からCSSを作るため、間に合わないあいだ
    bottom-[12%] も h-[3px] も bg-gradient-to-r も効かず、
    「高さ0・背景なし＝見えない線」になる。実機で「演奏を始めたときに
    下部の判定ラインがないときがある」と報告された(2026-09-05)。
    判定ラインは音ゲーでいちばん大事な目印なので、外部CSSに依存させない */}
{/* 判定ラインの「幅」。上下のふちがGOOD(前後0.17秒)の端、内側の明るいところがMARVELOUS(前後0.055秒)で、
    その真ん中に下の判定ラインがちょうど乗る。位置と高さはノーツ速度と画面の高さで変わるので、
    実測から updateJudgmentBand が書き込む。見た目だけの要素で、判定・スコアには関与しない。
    判定ラインと同じ理由でTailwindに頼らず直接書く(CDNのCSSが間に合わなくても必ず出す) */}
<div ref={judgmentBandRef} data-rhythm-judgment-band aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:0,opacity:0,pointerEvents:'none',
  /* z-index を必ず持たせる(2026-09-06)。DOMの順番では判定ラインの直前に置いてあるのに、
     レーンのSVG([data-rhythm-lane-svg])が z-index:1 を持っているため、
     z-index:auto(=0)のままだと**レーンの下に隠れて色がまったく出なかった**。
     実測でも、帯をまっ赤に塗りつぶしても画面の色は rgb(14,20,36) のまま変わらなかった。
     レーン(1)より上、ノーツ(4)・判定ライン(6)より下に置く。 */
  zIndex:2,transition:settings.lightweightMode?'none':'opacity 220ms ease-out'}}>
  <i data-rhythm-judgment-core aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:0,background:'linear-gradient(180deg,rgba(250,232,255,0),rgba(250,232,255,.26),rgba(250,232,255,0))'}}/>
  <i data-rhythm-judgment-edge data-edge="top" aria-hidden="true" style={{position:'absolute',left:0,right:0,top:0,height:'1px',background:'linear-gradient(90deg,rgba(103,232,249,0),rgba(103,232,249,.55),rgba(103,232,249,0))'}}/>
  <i data-rhythm-judgment-edge data-edge="bottom" aria-hidden="true" style={{position:'absolute',left:0,right:0,bottom:0,height:'1px',background:'linear-gradient(90deg,rgba(103,232,249,0),rgba(103,232,249,.55),rgba(103,232,249,0))'}}/>
</div>
<div ref={judgmentLineRef} data-rhythm-judgment-line style={{position:'absolute',left:0,right:0,bottom:'var(--mh-judgment-line-bottom,12%)',height:'3px',background:'linear-gradient(90deg,#f0abfc,#cffafe,#f0abfc)',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 8px #67e8f9':'0 0 18px #67e8f9,0 0 30px #c084fc'}}/>{/* 演奏を始める前のカウントダウン。Tailwindに頼らず直接書くのは判定ラインと同じ理由で、
    CDNのCSSが間に合わなくても必ず読める大きさで出るようにするため */}
{countdownStep!==null&&<div data-rhythm-countdown aria-live="assertive" style={{position:'absolute',inset:0,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',pointerEvents:'none',background:'rgba(2,6,23,.35)'}}><b data-rhythm-countdown-step style={{fontSize:countdownStep==='READY'?'44px':'88px',fontWeight:900,lineHeight:1,color:'#fff',letterSpacing:countdownStep==='READY'?'.12em':'0',textShadow:'0 0 18px rgba(103,232,249,.85),0 2px 10px rgba(2,6,23,.95)'}}>{countdownStep}</b><small style={{fontSize:'12px',fontWeight:900,color:'#a5f3fc',textShadow:'0 1px 6px rgba(2,6,23,.95)'}}>{resumeCountdown?'まもなく 再開します':'まもなく はじまります'}</small></div>}
<div data-rhythm-judgment-display className="pointer-events-none absolute left-1/2 z-10 w-[88%] -translate-x-1/2 text-center" style={{bottom:'calc(var(--mh-judgment-line-bottom,12%) + 38px)'}}>{/* 判定文字の見た目(色のグラデーション・光・大きさ)は index.html が data-judgment ごとに持つ。
      どれも文字を透かしてグラデーションを敷くので、色を1つだけ選ぶインラインstyleでは書けない。
      判定ラインで弾ける光の単色は data/rhythm-mode.js の RHYTHM_JUDGMENT_COLORS が正本で、
      文字のグラデーションにも必ずその色を含める(rhythm-hit-effect-check.js が突き合わせる)。
      ここが渡すのは「どの判定か」「ぴったりか」の2つだけ。
      text-[26px] と text-white は、判定がまだ無いとき(LOADING…など)の見た目 */}<b ref={judgmentTextRef} data-rhythm-judgment-text data-judgment={view.last||''} data-judgment-precise={view.lastPrecise?'1':''} data-halo={haloKeys&&settings.judgmentTextDisplay&&view.last&&view.status!=='error'&&view.status!=='loading'&&haloKeys.has(`${view.last}|${view.lastPrecise?'1':''}`)?'1':undefined} className="block text-[26px] font-black leading-none tracking-wide text-white">{view.status==='error'?'音源を再生できません':view.status==='loading'?'LOADING…':settings.judgmentTextDisplay?view.last:''}</b><small className={`mt-1 block min-h-[16px] text-xs font-black tracking-[0.24em] ${!settings.fastSlowDisplay?'text-transparent':view.fastSlow==='FAST'?'text-cyan-300':view.fastSlow==='SLOW'?'text-fuchsia-300':'text-transparent'}`}>{settings.fastSlowDisplay?(view.fastSlow?(timingDisplay!=='STANDARD'&&typeof view.lastDeltaMs==='number'?`${view.fastSlow} ${Math.round(Math.abs(view.lastDeltaMs))}ms`:view.fastSlow):'—'):'—'}</small>{/* ずれメーター。判定文字のすぐ上へ置く(文字の位置は動かさない)。判定ラインのすぐ上は叩く指で隠れるため。
    帯の色は判定窓(MARVELOUS 金・EXCELLENT 紫・GREAT 赤・GOOD 緑・BAD 青)で、真ん中がぴったり */}
{timingDisplay==='METER'&&<div data-rhythm-timing-meter aria-hidden="true" className="absolute bottom-full left-1/2 mb-1.5 h-[10px] w-[160px] -translate-x-1/2" style={{'--meter-mar':`${(55/185*50).toFixed(2)}%`,'--meter-exc':`${(100/185*50).toFixed(2)}%`,'--meter-gre':`${(150/185*50).toFixed(2)}%`,'--meter-goo':`${(170/185*50).toFixed(2)}%`}}><i data-rhythm-timing-meter-band/><i data-rhythm-timing-meter-center/>{Array.from({length:12},(_,i)=><i key={i} ref={el=>{meterTicksRef.current[i]=el;}} data-rhythm-timing-meter-tick style={{opacity:0}}/>)}</div>}</div>{/* 能力が出たら、どのマスモンの何が出たかを短時間だけ見せる(§3.5) */}
{/* ラッキーラッシュ中は、プレイエリアのふちが金色に光る(ノーツより後ろ・入力に触らない) */}
{luckyRush&&<div data-rhythm-lucky-rush aria-hidden="true"/>}
{/* 抽選の結果。当たりは大きく「LUCKY RUSH!!」、はずれは小さく「+2pt」 */}
{luckyBanner&&<div key={luckyBanner.id} data-rhythm-lucky-banner data-kind={luckyBanner.kind} aria-hidden="true"><b>{luckyBanner.text}</b></div>}
{comboMilestone>0&&<div data-rhythm-combo-milestone data-milestone-stage={comboMilestoneStage} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2 whitespace-nowrap text-center"><b className={`block font-black leading-none tabular-nums landscape:text-4xl ${comboMilestoneStage>=3?'text-6xl':'text-5xl'}`}>{comboMilestone}</b><small className="mt-1 block text-sm font-black tracking-[0.3em]">COMBO</small></div>}
                {view.ability&&<div data-rhythm-ability-flash className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-amber-200 bg-slate-950/90 px-4 py-1.5 text-lg font-black text-amber-100" style={{bottom:'calc(12% + 78px)',textShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':'0 0 10px rgba(251,191,36,.8)'}}>{view.ability.ability}！</div>}{canvasNotes?<canvas ref={noteCanvasRef} data-rhythm-note-canvas aria-hidden="true"/>:noteElements}{/* レーンカバー(beatmania IIDX・SOUND VOLTEX の SUDDEN)。レーンの奥を幕で隠し、ノーツが見えはじめる位置を手前へ寄せる。
    隠すのはレーンの台形の中だけ(laneCoverStyle の clip-path)。左右の空きにあるコンボ数・マスモン・背景は隠さない。
    ノーツ(z-5)より前、判定ライン(z-6)より前(上端から伸びるので判定ラインとは重ならない)、HUD(z-30)より後ろ。
    ★隠すだけで、ノーツが流れる速さ・判定のタイミングは変わらない */}
{laneCoverStyle&&<div data-rhythm-lane-cover aria-hidden="true" style={laneCoverStyle}/>}{calibrating&&<div ref={calibrationBannerRef} data-rhythm-calibration-banner className="pointer-events-none absolute z-20 rounded-2xl border border-amber-300/60 bg-slate-950/92 text-center shadow-[0_0_18px_rgba(251,191,36,.18)]" style={isLandscape
      // 横持ち: HUDの左(スコア)と右(ライフ・ポーズ)にはさまれた上の空きへ。
      //   器を自前で回しているのでCSSの landscape: は効かない(@media が成立しない)。向きはJSで見る。
      //   ★真ん中に置かない。ライフ表示は設定で最大200%まで伸びて左へせり出すので、
      //     中央そろえだと大きくしたときにポーズボタンと重なる(2026-09-13に実測して分かった)。
      //     左のスコア(器の 12〜145px)と右のライフ(最大で 563px あたりまで)の**あいだ**へ置く。
      ?{left:'19%',right:'36%',top:'2%',padding:'4px 10px'}
      // 縦持ち: 判定ラインの下の空き(bottom 12%より下)。上に置くとコンボ数と重なった
      //   (2026-09-13、実画面で確認)。ここなら目線も判定ラインの近くで済む
      :{left:'12px',right:'12px',bottom:'1.5%',padding:'8px 12px'}}><b data-rhythm-calibration-title className="block font-black text-amber-200" style={{fontSize:isLandscape?'12px':'14px',lineHeight:1.2}}>かまえて（はじめの{RHYTHM_CALIBRATION_WARMUP_COUNT}回は数えません）</b><span data-rhythm-calibration-text className="mt-1 block font-bold text-slate-200" style={{fontSize:isLandscape?'9px':'11px',lineHeight:isLandscape?1.3:1.6}}>判定ラインにノーツが重なった瞬間に叩いてください。判定とFAST・SLOWはいつもどおり出ます</span></div>}{tutorial&&<div ref={tutorialBannerRef} data-rhythm-tutorial-banner className="pointer-events-none absolute inset-x-3 top-[14%] z-20 rounded-2xl border border-cyan-300/50 bg-slate-950/92 px-3 py-2.5 text-center shadow-[0_0_18px_rgba(34,211,238,.18)]"><b data-rhythm-tutorial-title className="block text-[14px] font-black text-cyan-100">{RHYTHM_TUTORIAL_STEPS[0].title}</b><span data-rhythm-tutorial-text className="mt-1 block text-[11px] font-bold leading-relaxed text-slate-200">{RHYTHM_TUTORIAL_STEPS[0].text}</span></div>}{view.status==='paused'&&!resumeCountdown&&<div data-rhythm-pause-menu data-rhythm-debug-play={debugPlay?'1':undefined} className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-5"><h3 className="text-2xl font-black">PAUSE</h3>{/* いま何を・どこまで遊んでいるか。止めた位置・スコア・コンボをここで見られる */}
{(()=>{const endMs=Number.isFinite(Number(song.playDurationMs))?Number(song.playDurationMs):chart.durationMs;const ratio=endMs>0?Math.max(0,Math.min(1,pausedSongMs/endMs)):0;return <div data-rhythm-pause-info className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2.5">
  <b className="block truncate text-[12px] font-black text-slate-100">♪ {rhythmSongFullName(song)}</b>
  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-black"><span className="shrink-0 rounded bg-fuchsia-700/85 px-1.5 py-0.5 leading-none">{difficulty.id}</span>{!calibrating&&!tutorial&&<span className="text-cyan-300">Lv.{chart.level}</span>}<span className="ml-auto tabular-nums text-slate-300">SCORE <b className="text-white">{view.score.toLocaleString()}</b></span><span className="tabular-nums text-slate-300">COMBO <b className="text-white">{view.combo}</b></span></div>
  <div className="mt-2 flex items-center gap-2"><div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><i className="absolute inset-y-0 left-0 block rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" style={{width:`${(ratio*100).toFixed(1)}%`}}/></div><small data-rhythm-pause-time className="shrink-0 text-[10px] font-black tabular-nums text-slate-300">{rhythmClockLabel(pausedSongMs)} / {rhythmClockLabel(endMs)}</small></div>
</div>;})()}
<p className="text-[10px] font-bold text-slate-400">「再開」を押すと 3・2・1 と数えてから続きが始まります</p><button data-rhythm-pause-resume className="min-h-[48px] w-full rounded-xl bg-cyan-700 font-black" onClick={resume}>再開</button><button data-rhythm-pause-restart className="min-h-[48px] w-full rounded-xl bg-fuchsia-700 font-black" onClick={restart}>リスタート</button><button data-rhythm-pause-exit className="min-h-[48px] w-full rounded-xl bg-rose-800 font-black" onClick={abort}>{calibrating?'やめてオプションへ戻る':tutorial?'練習をやめて曲えらびへ戻る':debugPlay?'中断して音ゲーデバッグへ戻る':'中断して曲えらびへ戻る'}</button></div>}</div></main>;
};
