// 図鑑の立ち絵を動かすか(2026-09-24 ユーザー指示「そのページで動きを止めるか動かすかをワンタッチで決めれればおけ」
// 「デフォは動く」)。バトルの「待機中の動き」とは別に、図鑑のボタンだけで決める。
// 保存は新しいキー mh_dex_idle_motion_v1(true/false)。無い・壊れているときは動かす(true)
const DEX_IDLE_MOTION_KEY = 'mh_dex_idle_motion_v1';
const useDexIdleMotion = () => {
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    let alive = true;
    storeGet(DEX_IDLE_MOTION_KEY, true).then(v => { if (alive) setMotion(v !== false); });
    return () => { alive = false; };
  }, []);
  const toggle = () => setMotion(prev => { const next = !prev; storeSet(DEX_IDLE_MOTION_KEY, next); return next; });
  return [motion, toggle];
};

// ==== 図鑑でマスモンの染色を見る(2026-09-24 ユーザー指示「図鑑の表示でマスモンで染色してるカラーも見れるようにしたい」) ====
// 同日「マスモン選択式にしたら？」「この画面で染色も出来てどんな色か見れるようにする機能もあるといいね」で作り替えた。
//   ・色の見本は、その種のマスモンを一覧から1体選んで決める(マスモンが増えても横に並び続けない)
//   ・「染めてみる」で、図鑑の中だけで好きな色を試せる
// どちらも見た目だけに使い、保存しない(図鑑を開き直す・ほかの種へ移ると元の色へ戻る)。
// 読み取りだけで、マスモンのデータには一切触れない。
//
// 選んでいる見本(dexColorKey)の形:
//   null            … 元の色
//   { masuId }      … そのマスモンの色(居なくなっていたら元の色)
//   { colors:[…] }  … 「染めてみる」で決めた色
const dexMasuListOf = (masuMons, monId) => {
  if (!Array.isArray(masuMons) || !monId) return [];
  const list = masuMons.filter(masu => masu && masu.baseId === monId);
  // 色を付けた子を先に出す(並びはマスモン一覧の順のまま)
  const colored = (masu) => { const c = getMasuColors(masu); return Array.isArray(c) && c.some(x => typeof x === 'string' && x); };
  return [...list.filter(colored), ...list.filter(masu => !colored(masu))];
};
const dexHasColors = (colors) => Array.isArray(colors) && colors.some(c => typeof c === 'string' && c);
// いま見本にしている配色(見つからなければ null=元の色)
const dexSelectedColors = (masuMons, monId, colorKey) => {
  if (!colorKey || typeof colorKey !== 'object') return null;
  if (Array.isArray(colorKey.colors)) return dexHasColors(colorKey.colors) ? colorKey.colors : null;
  if (colorKey.masuId == null) return null;
  const masu = dexMasuListOf(masuMons, monId).find(m => String(m.id) === String(colorKey.masuId));
  const colors = masu ? getMasuColors(masu) : null;
  return dexHasColors(colors) ? colors : null;
};
// 見本の名前(ボタンに出す)
const dexColorLabel = (masuMons, monId, colorKey) => {
  if (!dexSelectedColors(masuMons, monId, colorKey)) return '元の色';
  if (Array.isArray(colorKey.colors)) return '染めてみた色';
  const masu = dexMasuListOf(masuMons, monId).find(m => String(m.id) === String(colorKey.masuId));
  return masu?.name || 'マスモン';
};
const DexColorSwatches = ({ colors }) => dexHasColors(colors)
  ? <span className="flex -space-x-1 shrink-0" aria-hidden="true">{colors.filter(Boolean).slice(0, 5).map((c, i) => <span key={i} className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ background: getColorSwatchHex(c) }}/>)}</span>
  : <span className="w-3.5 h-3.5 rounded-full border border-white/40 bg-gradient-to-br from-white/70 to-slate-500 shrink-0" aria-hidden="true"/>;
// 立ち絵の左右の列のボタンの文字。列の幅が狭い(スマホで90px前後)ので、記号と名前を2段に分け、
// 名前は折り返さない(「動きを止/める」のような切れ方をさせない)。text は「記号 名前」の形
const DexSideLabel = ({ text }) => {
  const i = String(text).indexOf(' ');
  const icon = i > 0 ? text.slice(0, i) : '';
  const label = i > 0 ? text.slice(i + 1) : text;
  return <>{icon&&<span className="text-[12px] leading-none" aria-hidden="true">{icon}</span>}<span className="text-[10px] leading-tight whitespace-nowrap">{label}</span></>;
};
// 立ち絵の左下に置く「色」のボタン。いまの見本の色と名前を出し、押すとマスモンの一覧を開く
const DexColorPickButton = ({ masuMons, mon, value, onOpen }) => (
  <button type="button" data-dex-color-open aria-label={`色の見本: ${dexColorLabel(masuMons, mon.id, value)}(押すとマスモンを選べます)`} onClick={() => { Audio_.se.tap(); onOpen(); }}
    className={`w-full max-w-[124px] min-h-[44px] px-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 font-black active:scale-95 ${dexSelectedColors(masuMons, mon.id, value) ? 'border-amber-300 bg-amber-700 text-white' : 'border-white/15 bg-slate-900 text-amber-100/90'}`}>
    <span className="flex items-center gap-1 text-[10px] text-amber-200/90"><DexColorSwatches colors={dexSelectedColors(masuMons, mon.id, value)}/>色 ▾</span>
    <span className="block w-full truncate text-[10px] leading-tight">{dexColorLabel(masuMons, mon.id, value)}</span>
  </button>
);
// マスモンの一覧(色の見本を選ぶ)。その種のマスモンだけを出す。色を付けていない子は押せない
const DexMasuColorSheet = ({ masuMons, mon, value, onSelect, onClose }) => {
  const list = dexMasuListOf(masuMons, mon.id);
  const current = dexSelectedColors(masuMons, mon.id, value) ? value : null;
  const row = (key, on, disabled, icon, title, sub, onClick) => (
    <button key={key} type="button" data-dex-color-choice={key} aria-pressed={on} disabled={disabled} onClick={onClick}
      className={`w-full min-h-[56px] px-3 py-2 rounded-2xl border flex items-center gap-3 text-left active:scale-[.98] ${on ? 'border-amber-300 bg-amber-700/70' : 'border-white/10 bg-slate-900'} ${disabled ? 'opacity-45' : ''}`}>
      <span className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-black/40 shrink-0 flex items-center justify-center">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-black text-white truncate">{title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-300 min-w-0">{sub}</span>
      </span>
      {on && <span className="shrink-0 text-amber-200 text-[11px] font-black">表示中</span>}
    </button>
  );
  const face = (colors, alt) => <DyedMonsterImage baseId={mon.id} src={mon.iconUrl || mon.imgUrl} alt={alt} masuColors={dexHasColors(colors) ? colors : []} draggable={false} className="w-full h-full object-cover"/>;
  const pick = (key) => { Audio_.se.tap(); onSelect(key); onClose(); };
  return (
    <div data-dex-color-sheet className="fixed inset-0 flex items-end justify-center" style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.8)', zIndex:31400 }}
      role="dialog" aria-modal="true" aria-label="色の見本にするマスモンを選ぶ" onClick={onClose}>
      <div className="w-full max-w-md max-h-[75dvh] flex flex-col rounded-t-3xl border-2 border-b-0 border-amber-500/70 bg-slate-950 p-4 gap-3"
        style={{ paddingBottom:'calc(1rem + env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-sm font-black text-amber-100">色の見本にするマスモン</h3>
          <button type="button" aria-label="閉じる" onClick={onClose} className="min-w-[40px] min-h-[40px] rounded-full bg-white/5 text-slate-200 font-black active:scale-90">✕</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-1.5">
          {row('base', !current, false, face(null, mon.name), '元の色', <span>もとのイラストの色</span>, () => pick(null))}
          {Array.isArray(value?.colors) && dexHasColors(value.colors) && row('try', true, false, face(value.colors, '染めてみた色'), '染めてみた色', <><DexColorSwatches colors={value.colors}/><span>「染めてみる」で決めた色</span></>, () => pick(value))}
          {list.map(masu => {
            const colors = getMasuColors(masu);
            const has = dexHasColors(colors);
            const on = !!current && current.masuId != null && String(current.masuId) === String(masu.id);
            return row(`masu-${masu.id}`, on, !has, face(colors, masu.name || mon.name), masu.name || mon.name,
              has ? <><DexColorSwatches colors={colors}/><span className="truncate">このマスモンの色</span></> : <span>まだ色を付けていません</span>,
              () => pick({ masuId: masu.id }));
          })}
          {list.length === 0 && <p className="text-center text-[11px] font-bold text-slate-400 py-3">この種のマスモンはまだいません。「染めてみる」で好きな色を試せます。</p>}
        </div>
      </div>
    </div>
  );
};
// 「染めてみる」。マスモンの染色と同じ色の選び方(DyeRegionColorControls)で、図鑑の中だけ色を試す。
// 決めた色は図鑑の立ち絵と攻撃アクションに使うだけで、保存もしないし染色アイテムも使わない
const DexTryDyeSheet = ({ mon, draft, onChange, onCustom, onApply, onReset, onClose }) => (
  <div data-dex-try-dye className="fixed inset-0 flex items-center justify-center p-4" style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.9)', zIndex:31500,
    paddingTop:'calc(1rem + env(safe-area-inset-top))', paddingBottom:'calc(1rem + env(safe-area-inset-bottom))' }} role="dialog" aria-modal="true" aria-label={`${mon.name}を染めてみる`}>
    <div className="bg-slate-900 border-2 border-fuchsia-500 rounded-3xl p-4 w-full max-w-sm flex flex-col gap-2.5 shadow-2xl max-h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-black text-white">🎨 {mon.name}を染めてみる</h3>
        <button type="button" aria-label="閉じる" onClick={onClose} className="min-w-[40px] min-h-[40px] rounded-full bg-white/5 text-slate-200 font-black active:scale-90">✕</button>
      </div>
      <div className="h-36 shrink-0 flex items-center justify-center rounded-2xl bg-black/30 border border-white/5">
        <DyedMonsterImage baseId={mon.id} src={mon.imgUrl || mon.iconUrl} alt={mon.name} masuColors={draft} draggable={false} className="h-full aspect-square max-w-full object-contain"/>
      </div>
      <div className="text-[10px] text-fuchsia-200 font-bold text-center shrink-0">見るだけの機能です。マスモンの色は変わらず、アイテムも使いません。</div>
      {dyeRegionCount(mon.id) === 1 && <div className="text-[9px] text-slate-400 font-bold text-center shrink-0">このモンスターは全身をまとめて染めます</div>}
      <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
        <DyeRegionColorControls baseId={mon.id} colors={draft} onChange={onChange} onCustom={onCustom}/>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={onReset} className="flex-1 min-h-[44px] bg-slate-800 text-slate-300 rounded-xl font-black text-xs">元の色に戻す</button>
        <button type="button" data-dex-try-apply onClick={onApply} className="flex-1 min-h-[44px] rounded-xl font-black text-xs bg-fuchsia-600 text-white active:scale-95">この色で見る</button>
      </div>
    </div>
  </div>
);

function MonsterAttackPreviewScreen({ dexMonsterId, dexAttackPreview, unlockedMonsterIds, masuMons, dexColorKey, getAtkSkillLevels, getUniqueSkillLevels, onMissing, onBackToDetail, onStopPreview, onPlayPreview }) {
      const [idleMotion]=useDexIdleMotion();
      const monsters=dexMonsterList();
      const mon=monsters.find(m=>m.id===dexMonsterId)||null;
      if(!mon||!unlockedMonsterIds.includes(mon.id)){ onMissing(); return null; }
      const atkMotion=mon.atkMotion||'default';
      const playing=dexAttackPreview?.monsterId===mon.id?dexAttackPreview:null;
      const previewAnim=playing?playing.anim:null;
      const playingKind=playing?playing.kind:null;
      const backToDetail=()=>{onStopPreview();onBackToDetail();};
      // 再生そのもの(コマ送りのタイマーと世代管理)は MonsterHeroGame 側に残してある。
      // 進行中の setTimeout を画面のライフサイクルで止めると、演出が途中で固まるため
      const playAttackPreview=async(kind)=>{
        if(playingKind)return;
        await onPlayPreview(mon,kind,atkMotion);
      };
      const kindButton=(kind,label)=>(
        <button key={kind} type="button" data-attack-preview-play={kind} onClick={()=>{Audio_.se.tap();playAttackPreview(kind);}} disabled={!!playingKind}
          className={`flex-1 min-w-0 min-h-[52px] rounded-xl border px-2 text-[12px] font-black active:scale-95 disabled:opacity-40 ${playingKind===kind?'border-cyan-200 bg-cyan-700 text-white':'border-cyan-400/60 bg-slate-900 text-cyan-100'}`}>
          {playingKind===kind?'再生中…':label}
        </button>
      );
      return <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title={`${mon.name}の攻撃アクション`} accent="text-amber-100" note="Attack Action"
          onBack={backToDetail} backLabel="図鑑の詳細へ戻る"/>
        {/* 演出の舞台。立ち絵は下寄りに置き、音符や光が上へ抜けるぶんの余白を上に残す */}
        <div data-attack-preview-stage className="relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-cyan-500/60 bg-gradient-to-b from-slate-900 to-slate-950">
          {/* 立ち絵も演出も、まとめて少しだけ拡大して見せる(演出の移動量はpx固定なので、
              ここを大きくしないと図鑑の枠と同じ大きさのままになる)。
              拡大の基準は足元にして、伸びるぶんはすべて上の余白へ向ける */}
          <div data-attack-preview-art className="absolute left-1/2" style={{bottom:'11%',width:'clamp(132px, 44vw, 184px)',height:'clamp(132px, 44vw, 184px)',transform:'translateX(-50%) scale(1.15)',transformOrigin:'bottom center'}}>
            {/* 待機アニメ(翼の羽ばたきなど)もバトルと同じ場面で重ねる。持たない子は今までどおり1枚の絵 */}
            <BattleAttackMotionPreview image={mon.imgUrl?withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, mon.name, false, dexSelectedColors(masuMons, mon.id, dexColorKey)), {enabled:idleMotion&&monsterIdleAllowedDuring(previewAnim), fill:true, own:true}):<DexMonsterArt mon={mon} alt={mon.name}/>} anim={previewAnim} baseId={mon.id}/>
          </div>
          <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-bold text-slate-400">バトルと同じ演出です（ダメージや性能は変わりません）</span>
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <div className="w-full max-w-md mx-auto flex gap-2">
            {kindButton('normal','通常攻撃')}
            {kindButton('unique','固有技')}
          </div>
        </div>
      </div>;}

function MonsterDexScreen({ dexLineageFilter, unlockedMonsterIds, onSelectLineage, onOpenDetail, onBackToManagement }) {
      const monsters=dexMonsterList();
      const unlockedCount=monsters.filter(mon=>unlockedMonsterIds.includes(mon.id)).length;
      const filters=dexMainLineages();
      const shown=dexLineageFilter==='all'?monsters:monsters.filter(mon=>monsterLineageOf(mon.id).main.id===dexLineageFilter);
      const chipClass=(on)=>`shrink-0 min-h-[44px] px-3 rounded-xl border text-[11px] font-black whitespace-nowrap active:scale-95 ${on?'bg-amber-600 border-amber-300 text-white':'bg-slate-900 border-white/10 text-amber-200/80'}`;
      return (
      <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="モンスター図鑑" accent="text-amber-300" onBack={onBackToManagement} backLabel="M/B管理へ戻る"/>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="monsterDex"/></div>
        <div data-dex-count className="shrink-0 w-full max-w-md mx-auto mb-2 rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-950/70 to-orange-950/50 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-black text-amber-300 shrink-0">図鑑登録数</span>
          <span className="text-[15px] font-mono font-black text-amber-100 tabular-nums">{unlockedCount}<span className="text-slate-400 text-[10px]"> / {monsters.length}</span></span>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="主血統でしぼりこむ">
          <button type="button" aria-pressed={dexLineageFilter==='all'} onClick={()=>onSelectLineage('all')} className={chipClass(dexLineageFilter==='all')}>すべて</button>
          {filters.map(lineage=>(
            <button key={lineage.id} type="button" aria-pressed={dexLineageFilter===lineage.id} onClick={()=>onSelectLineage(lineage.id)} className={chipClass(dexLineageFilter===lineage.id)}>{lineage.name}</button>
          ))}
        </div>
        <div className={`${SCREEN_LIST_CLASS} w-full max-w-md mx-auto`}>
          <div className="grid grid-cols-3 gap-2.5 pb-4">
            {shown.map(mon=>{
              const unlocked=unlockedMonsterIds.includes(mon.id);
              const iconSrc=mon.iconUrl||mon.imgUrl||'';
              const category=monsterCategoryOf(mon.id);
              return (
                <button key={mon.id} type="button" data-dex-entry aria-label={unlocked?`${mon.name}の図鑑を見る`:'まだ出会っていないモンスター'}
                  onClick={()=>onOpenDetail(mon.id)}
                  className="w-full min-h-[124px] rounded-2xl border border-white/10 bg-gradient-to-b from-amber-950/40 to-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95 select-none">
                  {/* 血統チップと同じ理由。丸く切り抜くと円の外側へかかる部分が切れるので、
                      少し縮めて中央へ置き、全身が円の中へ収まるようにする */}
                  <DexMonsterIcon src={iconSrc} hidden={!unlocked}/>
                  <div className="text-[11px] font-black truncate w-full text-center leading-tight text-amber-100">{unlocked?mon.name:'？？？'}</div>
                  <div className="text-[10px] font-black text-amber-400/80 leading-tight">{unlocked?monsterCategoryName(category):'未発見'}</div>
                </button>
              );
            })}
          </div>
          {shown.length===0&&<ScreenEmpty emoji="📖" lines={['この血統のモンスターはまだいません。']}/>}
        </div>
      </div>);}

function MonsterDexDetailScreen({ dexMonsterId, dexTab, unlockedMonsterIds, masuMons, dexColorKey, onSelectColor, tryDyeDraft, onOpenTryDye, onTryDyeChange, onTryDyeCustom, onTryDyeReset, onCloseTryDye, getAtkSkillLevels, getUniqueSkillLevels, swipeRef, onMissing, onBackToList, onOpenAttackPreview, onSelectMonster, onSelectTab, onStopPreview }) {
      const [idleMotion,toggleIdleMotion]=useDexIdleMotion();
      const monsters=dexMonsterList();
      const [colorSheetOpen,setColorSheetOpen]=useState(false); // 色の見本にするマスモンの一覧(開いているあいだだけ)
      const index=monsters.findIndex(m=>m.id===dexMonsterId);
      const mon=index>=0?monsters[index]:null;
      if(!mon){ onMissing(); return null; }
      const unlocked=unlockedMonsterIds.includes(mon.id);
      const {main,sub}=monsterLineageOf(mon.id);
      const category=monsterCategoryOf(mon.id);
      const categoryClass=category==='rare'?'bg-amber-600 text-white':category==='pure'?'bg-emerald-700 text-white':'bg-indigo-700 text-white';
      // 攻撃演出そのものは MONSTER_ATTACK_PREVIEW で再生する。ここでは立ち絵を静止で見せ、
      // 途中で移動・離脱したときに向こうの再生が残らないよう止める口だけ持つ
      const stopDexAttackPreview=onStopPreview;
      const go=(delta)=>{ stopDexAttackPreview(); const next=monsters[(index+delta+monsters.length)%monsters.length]; if(!next) return; onSelectMonster(next.id); Audio_.se.tap(); };
      // 血統1つぶんの見せ方。絵があるときだけ絵を出し、無い血統は名前だけにする
      const lineageChip=(lineage)=><DexLineageChip lineage={lineage} iconUrl={lineageIconUrl(lineage)}/>;
      const tabs=[['basic','基本'],['stats','能力'],['skills','技']];
      const tab=tabs.some(([id])=>id===dexTab)?dexTab:'basic';
      // 図鑑の1行。値は左揃えにする。
      // 以前は text-right だったが、折り返すたびに行頭がずれて読みにくかった
      // (2026-09-08・ユーザー指摘「図鑑説明の文字の並びが悪い」。ザンの特性の効果は
      //  最終行が「撃」1文字だけになっていた)。1行に収まる短い値は flex の justify-between が
      //  右端へ寄せるので、text-right を外しても見た目は1pxも変わらない(実測で確認済み)。
      // 「特性の効果」のように必ず長くなる値だけは block:true でラベルを上に置き、
      // 幅いっぱいを使って行数を減らす(文字数で機械的に決めると、端末の幅しだいで
      //  同じ行の見た目が入れ替わってしまうため、呼ぶ側が明示する)
      const row=(label,value,{block=false}={})=>(
        block
          ? (
            <div className="border-b border-amber-500/15 py-1.5 last:border-b-0">
              <span className="block text-[10px] font-black text-amber-300/90">{label}</span>
              <span className="mt-1 block text-[11px] font-bold leading-relaxed text-white break-words">{value}</span>
            </div>
          )
          : (
            <div className="flex items-start justify-between gap-3 border-b border-amber-500/15 py-1.5 last:border-b-0">
              <span className="text-[10px] font-black text-amber-300/90 shrink-0">{label}</span>
              <span className="text-[11px] font-bold text-white min-w-0 break-words">{value}</span>
            </div>
          )
      );
      const skillPills=(list,accent)=>(
        <div className="grid grid-cols-2 gap-1.5">
          {list.map(skill=>(
            <div key={skill.lvl} className={`min-w-0 rounded-xl border px-2 py-1.5 ${accent}`}>
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span className="text-[11px] font-black text-white truncate min-w-0">{skill.name}</span>
                <span className="text-[10px] font-mono font-black text-amber-300 shrink-0">Lv.{skill.lvl}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono font-black text-slate-400">
                <span className="text-red-300">威力{skill.power}</span><span className="text-amber-300">消費ガッツ{skill.guts}</span><span className="text-yellow-300">会心{skill.crit}%</span>
              </div>
            </div>
          ))}
        </div>
      );
      return (
      <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="モンスター図鑑" accent="text-amber-300"
          onBack={()=>{stopDexAttackPreview();onBackToList();}} backLabel="図鑑一覧へ戻る"
          right={<span className="text-[11px] font-mono font-black text-amber-200/80 tabular-nums">{index+1} / {monsters.length}</span>}/>
        {/* 上半分: 立ち絵。左右のボタンと横スワイプで前後へ移る */}
        {/* 立ち絵の左右の空きに、前後へ移る矢印と操作ボタンを縦に並べる(2026-09-24 ユーザー指摘
            「ボタン追加してるから図鑑の説明画面が小さくなってる。両サイドの空いたスペース使って説明画面の縦幅は小さくしないで」)。
            以前は立ち絵の下に「動きを止める・攻撃アクション」「色」の2行を足していて、そのぶん下の情報カードが縮んでいた。
            そのあと「圧迫感ありすぎるからもうすこし下の縦幅縮めてもいいよ」で、この段を少し高くし(絵は少しだけ大きく)、
            ボタンと矢印のあいだと、下の情報カードとのあいだに余白を取った。
              左: 動きを止める / ← / 色(マスモンを選ぶ)
              右: 攻撃アクション / → / 染めてみる
            ボタンは立ち絵の枠(data-dex-art)の外の列に置くので、絵には重ならない。 */}
        <div data-dex-stage className="shrink-0 w-full max-w-md mx-auto flex items-center gap-1 px-1.5 py-1.5" style={{height:'clamp(176px, 26dvh, 226px)'}}
          onTouchStart={e=>{swipeRef.current=e.touches&&e.touches[0]?e.touches[0].clientX:null;}}
          onTouchEnd={e=>{const from=swipeRef.current; swipeRef.current=null; if(from==null)return; const to=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientX:from; const dx=to-from; if(Math.abs(dx)>=48) go(dx<0?1:-1);}}>
          <div data-dex-side="left" className="flex-1 min-w-0 self-stretch flex flex-col items-center justify-between py-1">
            {unlocked&&monsterIdleRigOf(mon.id)
              ? <button type="button" data-dex-idle-toggle aria-pressed={idleMotion} onClick={()=>{Audio_.se.tap();toggleIdleMotion();}}
                  className={`w-full max-w-[124px] min-h-[44px] px-1 rounded-xl border flex flex-col items-center justify-center gap-0.5 font-black shadow-lg active:scale-95 ${idleMotion?'border-amber-300/60 bg-slate-950/85 text-amber-100':'border-white/20 bg-slate-800 text-slate-300'}`}>
                  <DexSideLabel text={idleMotion?'⏸ 動きを止める':'▶ 動かす'}/>
                </button>
              : <span className="min-h-[44px]" aria-hidden="true"/>}
            <button type="button" data-dex-prev aria-label="前のモンスター" onClick={()=>go(-1)} className="w-11 min-h-[44px] shrink-0 rounded-full bg-black/50 border border-amber-400/40 text-amber-200 flex items-center justify-center active:scale-90"><ChevronLeft size={22}/></button>
            {/* 色を変えて見る(マスモンを選んでその子の色) */}
            {unlocked
              ? <DexColorPickButton masuMons={masuMons} mon={mon} value={dexColorKey} onOpen={()=>setColorSheetOpen(true)}/>
              : <span className="min-h-[44px]" aria-hidden="true"/>}
          </div>
          {/* 立ち絵の枠。高さをここで決め、絵は枠に合わせて縮尺する。
              元画像は160px四方のものと1024px四方のものが混ざっており、
              寸法を指定しないと「小さい元画像はそのままの大きさ、大きい元画像は枠いっぱい」となって
              モンスターごとに見た目の大きさが2倍近く変わってしまう(ザンだけ極端に大きく見えた)。 */}
          <div data-dex-art className="relative shrink-0 aspect-square flex items-center justify-center" style={{height:'clamp(152px, 22dvh, 190px)'}}>
            {unlocked
              ? <DexMonsterIdleArt mon={mon} alt={mon.name} motion={idleMotion} colors={dexSelectedColors(masuMons, mon.id, dexColorKey)}/>
              : <DexMonsterArt mon={mon} alt="まだ出会っていないモンスター" hidden/>}
          </div>
          {/* 攻撃アクションの入口。立ち絵の上に重ねると絵が隠れてしまうので、枠の外(右の列)に置く。
              演出は上へ大きく飛ぶため、ここでは再生せず専用画面(MONSTER_ATTACK_PREVIEW)へ移る */}
          <div data-dex-side="right" className="flex-1 min-w-0 self-stretch flex flex-col items-center justify-between py-1">
            {unlocked
              ? <button type="button" data-dex-attack-preview onClick={()=>{stopDexAttackPreview();Audio_.se.tap();onOpenAttackPreview();}}
                  className="w-full max-w-[124px] min-h-[44px] px-1.5 rounded-xl border border-cyan-300/60 bg-slate-950/85 font-black text-cyan-100 shadow-lg active:scale-95 flex flex-col items-center justify-center gap-0.5">
                  <DexSideLabel text="▶ 攻撃アクション"/>
                </button>
              : <span className="min-h-[44px]" aria-hidden="true"/>}
            <button type="button" data-dex-next aria-label="次のモンスター" onClick={()=>go(1)} className="w-11 min-h-[44px] shrink-0 rounded-full bg-black/50 border border-amber-400/40 text-amber-200 flex items-center justify-center active:scale-90"><ChevronRight size={22}/></button>
            {/* 図鑑の中だけで染めてみる */}
            {unlocked
              ? <button type="button" data-dex-color-try onClick={()=>{Audio_.se.tap();onOpenTryDye(dexSelectedColors(masuMons, mon.id, dexColorKey)||[]);}}
                  className="w-full max-w-[124px] min-h-[44px] px-1.5 rounded-xl border border-fuchsia-400/60 bg-slate-950/85 font-black text-fuchsia-100 active:scale-95 flex flex-col items-center justify-center gap-0.5">
                  <DexSideLabel text="🎨 染めてみる"/>
                </button>
              : <span className="min-h-[44px]" aria-hidden="true"/>}
          </div>
        </div>
        {unlocked&&colorSheetOpen&&<DexMasuColorSheet masuMons={masuMons} mon={mon} value={dexColorKey} onSelect={onSelectColor} onClose={()=>setColorSheetOpen(false)}/>}
        {unlocked&&Array.isArray(tryDyeDraft)&&<DexTryDyeSheet mon={mon} draft={tryDyeDraft} onChange={onTryDyeChange} onCustom={onTryDyeCustom}
          onReset={()=>{Audio_.se.tap();onTryDyeReset();}} onClose={onCloseTryDye}
          onApply={()=>{Audio_.se.tap();onSelectColor(dexHasColors(tryDyeDraft)?{colors:tryDyeDraft.slice()}:null);onCloseTryDye();}}/>}
        {/* 下半分: 情報カード */}
        <div className="flex-1 min-h-0 pt-3">
          <div className="w-full max-w-md mx-auto h-full flex flex-col min-h-0 rounded-2xl border border-amber-500/60 bg-gradient-to-b from-amber-950/50 to-slate-950 p-3">
            <div className="shrink-0 text-center text-[17px] font-black text-amber-100 truncate">{unlocked?mon.name:'？？？'}</div>
            {unlocked?(<>
              {/* 血統の行。血統名や区分の文字数で位置が動かないよう、
                  左右のチップを同じ幅(1fr)の枠へ入れ、ラベル・×・区分は端と中央へ固定する */}
              <div data-dex-lineage-row className="shrink-0 mt-2 grid items-center gap-1.5" style={{gridTemplateColumns:'auto minmax(0,1fr) auto minmax(0,1fr) auto'}}>
                <span className="text-[10px] font-black text-amber-300 shrink-0">血統</span>
                {lineageChip(main)}
                <span className="text-[12px] font-black text-amber-300 shrink-0 text-center">×</span>
                {lineageChip(sub)}
                <span data-dex-category className={`shrink-0 min-w-[42px] text-center text-[10px] font-black px-1.5 py-1 rounded-full ${categoryClass}`}>{monsterCategoryName(category)}</span>
              </div>
              {/* 説明文。1行の子と3行の子でタブから下がまるごと動いてしまうため、
                  3行ぶんの高さを必ず確保する(それより長い説明はこの枠の中で送る) */}
              <div data-dex-desc className="shrink-0 mt-2 overflow-y-auto mh-scroll text-[11px]" style={{height:'calc(1.625em * 3)'}}>
                <p className="font-bold leading-relaxed text-slate-200 break-words">{monsterDexDescription(mon.id)}</p>
              </div>
              <ScreenTabs className="mt-2" value={tab} onChange={onSelectTab}
                items={tabs.map(([id,label])=>({id,label,color:'#d97706'}))}/>
              <div className="flex-1 min-h-0 overflow-y-auto mh-scroll pr-0.5">
                {tab==='basic'&&(<div data-dex-tab-basic>
                  {row('主血統', main.name)}
                  {row('副血統', sub.name)}
                  {row('区分', monsterCategoryName(category))}
                  {row('勇者特性', mon.trait||'なし')}
                  {row('特性の効果', mon.traitDesc||'特性なし', {block:true})}
                </div>)}
                {tab==='stats'&&(<div data-dex-tab-stats>
                  <div className="text-[10px] font-black text-amber-300/90 mb-1">その種の基礎能力（育てたマスモンの値ではありません）</div>
                  {row('ライフ', mon.baseHp)}
                  {row('ちから', mon.baseAtk)}
                  {row('丈夫さ', mon.baseDef)}
                  {row('ガッツ', mon.baseGuts)}
                  {/* 間合い適性の色は、マスモンの詳細やバトル画面と同じ決まりで塗る。
                      ここだけ琥珀色1色だったため、A・C・Dの違いが図鑑では見分けられなかった
                      (2026-09-13・ユーザー指摘「図鑑の距離適性の色がみんな同じになってる」)。
                      距離のラベルは RANGE_STYLES、ランクは DIST_APTITUDE_COLOR を使う。 */}
                  <div className="text-[10px] font-black text-amber-300/90 mt-2 mb-1">間合い適性</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RANGE_LABELS.map((label,i)=>{
                      const grade=(mon.distAptitude&&mon.distAptitude[i])||'C';
                      return (
                      <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-black/30 py-1.5 text-center">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${RANGE_STYLES[i].labelBg}`}>{label}</span>
                        <span className={`w-[86%] rounded-xl border py-0.5 text-[13px] font-mono font-black leading-none ${DIST_APTITUDE_COLOR[grade]||DIST_APTITUDE_COLOR.C}`}>{grade}</span>
                      </div>
                      );
                    })}
                  </div>
                </div>)}
                {tab==='skills'&&(<div data-dex-tab-skills className="space-y-2">
                  <div>
                    <div className="text-[10px] font-black text-amber-300/90 mb-1 text-center tracking-widest">通常技</div>
                    {skillPills(getAtkSkillLevels(mon), 'border-white/10 bg-red-950/25')}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-amber-300/90 mb-1 text-center tracking-widest">固有技（進化段階）</div>
                    {skillPills(getUniqueSkillLevels(mon), 'border-white/10 bg-amber-950/30')}
                    <div className="text-[11px] text-slate-300 font-bold leading-relaxed mt-1.5 italic break-words">"{mon.unique?.effectDesc||''}"</div>
                  </div>
                  {(()=>{
                    const exDef=typeof tacticsExDefOf==='function'?tacticsExDefOf(mon.id):null;
                    if(!exDef)return null;
                    const durationLabel={turn:'そのターン',wave:'そのWAVE',toggle:'再使用まで'}[exDef.duration]||String(exDef.duration||'—');
                    return <div data-dex-ex-skill className="rounded-xl border border-violet-400/40 bg-violet-950/25 p-2"><div className="flex items-center justify-between gap-2"><div className="text-[10px] font-black text-violet-300 tracking-widest">EXスキル</div><div className="text-[9px] font-black text-violet-200/80">タクティクス専用</div></div><div className="mt-0.5 text-[12px] font-black text-white">EX《{exDef.name}》</div><div className="mt-1 text-[10px] font-bold leading-relaxed text-slate-200">{exDef.desc}</div><div className="mt-1.5 flex flex-wrap gap-1 text-[9px] font-black text-slate-300"><span className="rounded-lg bg-black/30 px-1.5 py-1">回数 <b className="text-white">{exDef.unlimited?'無制限':`${exDef.maxUses}回`}</b></span><span className="rounded-lg bg-black/30 px-1.5 py-1">効果時間 <b className="text-white">{durationLabel}</b></span><span className="rounded-lg bg-black/30 px-1.5 py-1">通常カード <b className="text-white">{exDef.withCards?'併用可':'併用不可'}</b></span></div></div>;
                  })()}
                </div>)}
              </div>
            </>):(
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <ScreenEmpty emoji="❓" lines={['まだ出会っていないモンスターです','マーケットで円盤石を手に入れて解放すると、血統・能力・技が図鑑に記録されます。']}/>
              </div>
            )}
          </div>
        </div>
      </div>);}
