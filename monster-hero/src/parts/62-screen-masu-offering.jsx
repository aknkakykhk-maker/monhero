// ==== 画面: 神殿のお布施(MASU_OFFERING) ====
//
// ダイヤを払って、選んだマスモンへ直接絆経験値を与える画面。
// ダイヤと経験値の割合はトレーニングチケットと同じ(100ダイヤ=15EXP)。
// 「ダイヤ指定」「レベル指定」「転生」の3つの頼み方があり、見積もりと実行は
// どちらも buildMasuOffering(11-masu-progression.jsx)1本で計算する。
//
// 【この画面ならではの注意】
// ・保存は一切していない。個体・ダイヤ・プシュケーの更新は MonsterHeroGame 側の
//   executeMasuOffering が担う(実行時に最新の所持数で計算し直す)
// ・状態(選んだ子・頼み方・入力)は画面の中に持つ。画面を出るたびに白紙へ戻ってよい

const OFFERING_TAB_LABELS = Object.freeze({ diamonds:'ダイヤ指定', levels:'レベル指定', reincarnate:'転生' });
const OFFERING_DIAMOND_STEPS = Object.freeze([100, 1000, 10000, 100000]);
const OFFERING_LEVEL_STEPS = Object.freeze([1, 10, 100]);

function MasuOfferingScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, buildUnifiedMonsterEntries, executeMasuOffering,
  gold, introVisible = false, lockedIds = [], masuMons, monsterDisplayFlags, monsterEntryMatchesDisplayFlags, monsterEntryMatchesLineage,
  monsterRosterIds, onBackToTemple, onDismissIntro, ownedItems, renderMonsterCardBody, renderMonsterSortFilterBar, renderScreenNote,
  sortMonsterEntries,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('diamonds');
  const [diamondText, setDiamondText] = useState('');
  const [levels, setLevels] = useState(1);
  const [times, setTimes] = useState(1);
  const [autoBreak, setAutoBreak] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const selected = masuMons.find(m=>String(m.id)===String(selectedId)) || null;

  const resetInputs = () => { setMode('diamonds'); setDiamondText(''); setLevels(1); setTimes(1); setError(''); setDone(null); setConfirmOpen(false); };
  const pick = (id) => { resetInputs(); setSelectedId(id); };

  // 上限まで頼んだときの見積もり(MAXの値になる)。入力のたびに数え直す必要はないので個体と所持が変わったときだけ
  const limits = useMemo(()=>{
    if (!selected) return { maxLevels:0, maxTimes:0, maxDiamonds:0 };
    const common = { masu:selected, gold, ownedItems, lockedIds, autoBreakthrough:autoBreak };
    const lv = buildMasuOffering({ ...common, mode:'levels', amount:SOUL_RANK_LEVEL_CAP });
    const rt = buildMasuOffering({ ...common, mode:'reincarnate', amount:OFFERING_MAX_REINCARNATIONS });
    return { maxLevels:Math.max(0, lv.toLevel-lv.fromLevel), maxTimes:rt.reincarnations, maxDiamonds:donationDiamondValue(gold) };
  }, [selected, gold, ownedItems, lockedIds, autoBreak]);

  const diamondAmount = Math.min(limits.maxDiamonds, Math.max(0, parseInt(String(diamondText).replace(/[^0-9]/g,''),10) || 0));
  const amount = mode==='diamonds' ? diamondAmount : mode==='levels' ? Math.min(levels, Math.max(1, limits.maxLevels)) : Math.min(times, Math.max(1, limits.maxTimes));
  const plan = useMemo(()=>selected ? buildMasuOffering({ masu:selected, gold, ownedItems, lockedIds, mode, amount, autoBreakthrough:autoBreak }) : null,
    [selected, gold, ownedItems, lockedIds, mode, amount, autoBreak]);

  const run = async () => {
    if (busy || !plan?.ok) return;
    setBusy(true); setError(''); setConfirmOpen(false);
    try {
      const res = await executeMasuOffering({ masuId:selected.id, mode, amount, autoBreakthrough:autoBreak });
      if (res?.ok) { setDone(res.plan); setDiamondText(''); }
      else setError(res?.error || 'お布施を保存できませんでした。もう一度お試しください。');
    } finally { setBusy(false); }
  };
  const needsConfirm = !!plan && (plan.breakthroughs>0 || plan.reincarnations>0);

  if (!selected) {
    const entries = sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds)).filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)&&monsterEntryMatchesLineage(e));
    return <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="お布施" accent="text-violet-300" onBack={onBackToTemple} backLabel="神殿へ戻る"/>
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="temple" compact/></div>
      {introVisible&&<div data-offering-intro className="shrink-0 mb-2 rounded-xl border border-violet-400/40 bg-violet-950/50 p-3">
        <div className="text-[11px] font-black text-violet-200">お布施の使い方</div>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[10px] font-bold leading-relaxed text-slate-300"><li>お布施をするマスモンを選びます。</li><li>「ダイヤ指定」「レベル指定」「転生」から頼み方を選びます。</li><li>見積もりを見て「お布施する」を押します。</li></ol>
        <button type="button" onClick={onDismissIntro} className="mh-button mh-button-secondary mt-2 min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-900 text-xs font-black active:scale-[.98]">わかった</button>
      </div>}
      {renderScreenNote('offering','ダイヤを払って、マスモンへ直接絆経験値を与えられます。',['ダイヤと経験値の割合はトレーニングチケットと同じです（100ダイヤ＝経験値15）。','上限に届いたら限界突破、Lv.100になったら転生まで続けて行えます。'])}
      {renderMonsterSortFilterBar({singleType:true})}
      <div className={SCREEN_LIST_CLASS}>{entries.length===0?<ScreenEmpty emoji="🙏" lines={['表示できるマスモンがいません。','並べ替え・絞り込みの設定を見直してください。']}/>:
        <div className="grid grid-cols-3 gap-2 pb-3">{entries.map(({masu})=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;
          return <button key={masu.id} onClick={()=>pick(masu.id)} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-violet-500/40 bg-slate-900`}>{renderMonsterCardBody({masu,base,status:<ReincarnateBadge count={masu.reincarnateCount} className="is-inline"/>})}</button>;})}</div>}</div>
    </div>;
  }

  const normalized = normalizeMasuProgression(selected);
  const base = ALL_PLAYER_MONSTERS[selected.baseId];
  const lvl = masuBondLevelInfo(selected);
  const psyche = ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID);
  const stepBtn = 'mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 text-[12px] font-black active:scale-95 disabled:opacity-30';
  const fmt = (n) => Number(n || 0).toLocaleString();
  const row = (label, value, cls='text-slate-200') => <div className="flex justify-between gap-2 text-[11px] font-bold"><span className="text-slate-400">{label}</span><span className={`font-mono font-black ${cls}`}>{value}</span></div>;

  return <div data-mh-screen className={SCREEN_SHELL_CLASS}>
    <ScreenHead title="お布施" accent="text-violet-300" onBack={()=>{setSelectedId(null);resetInputs();}} backLabel="お布施の一覧へ戻る" disabled={busy}/>
    <div className={`${SCREEN_LIST_CLASS} space-y-3 pb-2`}>
      <div className="flex items-center gap-3 mh-panel rounded-2xl border border-white/10 bg-slate-900 p-3">
        <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden"><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/><RebirthStars count={selected.rebirthCount} className="mh-rebirth-stars-overlay"/></div>
        <div className="min-w-0 flex-1">
          <b className="block truncate">{selected.name}</b>
          <div className="text-pink-300 text-xs font-black">絆Lv.{lvl.level} / 上限Lv.{normalized.levelCap}</div>
          <div className="text-[10px] font-bold text-slate-400">限界突破 {normalized.rebirthCount}回 ・ 転生 {normalized.reincarnateCount}回</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={SCREEN_PANEL_FLAT_CLASS}><div className="text-[10px] font-bold text-slate-400">所持ダイヤ</div><div className="flex items-center gap-1 font-mono font-black text-amber-300"><Gem size={13}/>{fmt(gold)}</div></div>
        <div className={SCREEN_PANEL_FLAT_CLASS}><div className="text-[10px] font-bold text-slate-400">虹のプシュケー</div><div className="font-mono font-black text-violet-200">{fmt(psyche)}個</div></div>
      </div>

      <div className="grid grid-cols-3 gap-1.5" role="tablist">
        {OFFERING_MODES.map(key=><button key={key} role="tab" aria-selected={mode===key} onClick={()=>{setMode(key);setError('');}} className={`min-h-[44px] rounded-xl text-xs font-black active:scale-95 ${mode===key?'bg-violet-600 text-white':'bg-slate-900 border border-slate-700 text-slate-300'}`}>{OFFERING_TAB_LABELS[key]}</button>)}
      </div>

      <div className="mh-panel rounded-2xl border border-white/10 bg-slate-900/70 p-3 space-y-2">
        {mode==='diamonds'&&<>
          <div className="text-[11px] font-black text-slate-300">使うダイヤ（自由に入力できます）</div>
          <input type="text" inputMode="numeric" aria-label="お布施に使うダイヤ" value={diamondText===''?'':diamondAmount.toLocaleString()} placeholder="0" onChange={e=>setDiamondText(e.target.value)} className="w-full min-h-[48px] rounded-xl border border-slate-600 bg-black/50 p-3 text-right font-mono text-lg font-black text-white outline-none focus:border-violet-300"/>
          <div className="grid grid-cols-4 gap-1.5">{OFFERING_DIAMOND_STEPS.map(step=><button key={step} className={stepBtn} onClick={()=>setDiamondText(String(Math.min(limits.maxDiamonds, diamondAmount+step)))}>+{fmt(step)}</button>)}</div>
          <div className="grid grid-cols-2 gap-1.5"><button className={stepBtn} onClick={()=>setDiamondText('')}>クリア</button><button className={stepBtn} disabled={limits.maxDiamonds<=0} onClick={()=>setDiamondText(String(limits.maxDiamonds))}>MAX（{fmt(limits.maxDiamonds)}）</button></div>
        </>}
        {mode==='levels'&&<>
          <div className="text-[11px] font-black text-slate-300">上げるレベル（いまのLvから）</div>
          <div className="text-center font-mono text-2xl font-black text-white">+{amount}<span className="ml-2 text-sm text-slate-400">→ Lv.{lvl.level+amount}</span></div>
          <div className="grid grid-cols-6 gap-1.5">
            {[...OFFERING_LEVEL_STEPS].reverse().map(step=><button key={`m${step}`} className={stepBtn} disabled={amount<=1} onClick={()=>setLevels(Math.max(1,amount-step))}>-{step}</button>)}
            {OFFERING_LEVEL_STEPS.map(step=><button key={`p${step}`} className={stepBtn} disabled={amount>=limits.maxLevels} onClick={()=>setLevels(Math.min(limits.maxLevels,amount+step))}>+{step}</button>)}
          </div>
          <button className={`${stepBtn} w-full`} disabled={limits.maxLevels<=0} onClick={()=>setLevels(limits.maxLevels)}>MAX（+{fmt(limits.maxLevels)}レベル）</button>
        </>}
        {mode==='reincarnate'&&<>
          <div className="text-[11px] font-black text-slate-300">転生する回数</div>
          <div className="text-[10px] font-bold leading-relaxed text-slate-400">Lv.{REINCARNATE_MIN_LEVEL}未満なら先に経験値を与え、Lv.{REINCARNATE_MIN_LEVEL}以上になったところで転生します。これを回数ぶん続けます。固有技は「あとで決める」（固有技ポイント+1）になります。</div>
          <div className="text-center font-mono text-2xl font-black text-white">{amount}<span className="ml-1 text-sm text-slate-400">回</span></div>
          <div className="grid grid-cols-4 gap-1.5">
            <button className={stepBtn} disabled={amount<=1} onClick={()=>setTimes(Math.max(1,amount-10))}>-10</button>
            <button className={stepBtn} disabled={amount<=1} onClick={()=>setTimes(Math.max(1,amount-1))}>-1</button>
            <button className={stepBtn} disabled={amount>=limits.maxTimes} onClick={()=>setTimes(Math.min(limits.maxTimes,amount+1))}>+1</button>
            <button className={stepBtn} disabled={amount>=limits.maxTimes} onClick={()=>setTimes(Math.min(limits.maxTimes,amount+10))}>+10</button>
          </div>
          <button className={`${stepBtn} w-full`} disabled={limits.maxTimes<=0} onClick={()=>setTimes(limits.maxTimes)}>MAX（{fmt(limits.maxTimes)}回）</button>
        </>}
        <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 text-[11px] font-black text-slate-200">
          <input type="checkbox" checked={autoBreak} onChange={e=>setAutoBreak(e.target.checked)} className="h-5 w-5"/>
          <span className="min-w-0 flex-1">上限に届いたら限界突破も続ける<small className="block text-[9px] font-bold text-slate-400">ダイヤ（Lv×{REBIRTH_COST_PER_LEVEL}）と虹のプシュケーを使います。固有技はポイントとして残します</small></span>
        </label>
      </div>

      {plan&&<div className="mh-panel rounded-2xl border border-violet-400/30 bg-slate-950/70 p-3 space-y-1.5">
        <div className="text-[11px] font-black text-violet-200">この内容でお布施すると</div>
        {row('絆Lv', `Lv.${plan.fromLevel} → Lv.${plan.toLevel}`, 'text-pink-300')}
        {row('絆経験値', `+${fmt(plan.xpGained)}`, 'text-emerald-300')}
        {plan.gainedPoints>0&&row('強化ポイント', `+${fmt(plan.gainedPoints)}`, 'text-amber-300')}
        {plan.breakthroughs>0&&row('限界突破', `${plan.breakthroughs}回（上限Lv.${plan.fromCap} → ${plan.toCap}）`, 'text-violet-200')}
        {plan.reincarnations>0&&row('転生', `${plan.reincarnations}回`, 'text-violet-200')}
        <div className="my-1 border-t border-white/10"/>
        {row('お布施（経験値ぶん）', `${fmt(plan.xpDiamonds)} ダイヤ`)}
        {plan.breakthroughs>0&&row('限界突破', `${fmt(plan.breakDiamonds)} ダイヤ ＋ プシュケー${fmt(plan.psycheUsed)}個`)}
        {plan.reincarnations>0&&row('転生', `${fmt(plan.reincDiamonds)} ダイヤ`)}
        {row('合計', `${fmt(plan.spent)} ダイヤ`, 'text-amber-300')}
        {row('お布施後の所持', `${fmt(plan.nextGold)} ダイヤ${plan.psycheUsed>0?` ／ プシュケー${fmt(psyche-plan.psycheUsed)}個`:''}`)}
        {(plan.stopMessage||plan.reason)&&<div className="rounded-lg bg-amber-500/10 p-2 text-[10px] font-bold leading-relaxed text-amber-200">{plan.changed?plan.stopMessage:plan.reason}{plan.stopDetail&&plan.stopReason!=='none'?`（${plan.stopDetail}）`:''}</div>}
      </div>}
      {error&&<div className="text-red-300 text-[11px] font-bold">{error}</div>}
    </div>
    <div className={SCREEN_FOOTER_CLASS}>
      <button disabled={!plan?.ok||busy} onClick={()=>needsConfirm?setConfirmOpen(true):run()} className="mh-button mh-button-primary w-full min-h-[52px] rounded-2xl bg-violet-600 text-sm font-black active:scale-[.98] disabled:opacity-30">お布施する</button>
    </div>
    {confirmOpen&&plan&&<ConfirmSheet title="この内容でお布施しますか？" message={`${plan.breakthroughs>0?`限界突破 ${plan.breakthroughs}回\n`:''}${plan.reincarnations>0?`転生 ${plan.reincarnations}回（強化の振り直しになります）\n`:''}合計 ${fmt(plan.spent)} ダイヤ${plan.psycheUsed>0?` ・ プシュケー${fmt(plan.psycheUsed)}個`:''} を使います。\n元には戻せません。`} confirmLabel="お布施する" onConfirm={run} onCancel={()=>setConfirmOpen(false)}/>}
    {done&&<ModalFrame label="お布施の結果" border="border-violet-400/70" onClose={()=>setDone(null)}>
      <h3 className="text-center text-base font-black text-violet-200">お布施をしました</h3>
      <div className="mt-3 space-y-1.5">
        {row('絆Lv', `Lv.${done.fromLevel} → Lv.${done.toLevel}`, 'text-pink-300')}
        {row('絆経験値', `+${fmt(done.xpGained)}`, 'text-emerald-300')}
        {done.gainedPoints>0&&row('強化ポイント', `+${fmt(done.gainedPoints)}`, 'text-amber-300')}
        {done.breakthroughs>0&&row('限界突破', `${done.breakthroughs}回（上限Lv.${done.toCap}）`, 'text-violet-200')}
        {done.reincarnations>0&&row('転生', `${done.reincarnations}回`, 'text-violet-200')}
        {row('使ったダイヤ', fmt(done.spent), 'text-amber-300')}
      </div>
      <div className="mt-4"><ModalCloseButton onClick={()=>setDone(null)} label="とじる"/></div>
    </ModalFrame>}
  </div>;
}
