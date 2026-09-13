// ==== 画面: マスモン オート強化設定(gameState === 'MASU_AUTO_ENHANCE') ====
//
// 転生や限界突破のあとは強化が白紙へ戻るので、周回で貯まる強化ポイントを毎回手で振り直すのが
// 大変だった(2026-09-12・ユーザー要望)。この画面では個体ごとに
//   ・オン / オフ
//   ・どこまで上げてよいか(上限)
//   ・その中での優先順位
// の3つだけを決める。実際に振る計算は 11-masu-progression.jsx の
// buildMasuAutoEnhancePlan / applyMasuAutoEnhance が持っていて、
// 手で振るとき(applyEnhancePlanToMasu)とまったく同じ道を通る。
//
// 【この画面ならではの注意】
// ・保存を伴う操作は MonsterHeroGame 側に残し、props で受ける(ほかのマスモン画面と同じ)
// ・上限の数値入力だけは1文字ごとに保存すると書き込みが増えるので、入力中は下書き(draft)を持ち、
//   指を離した(blur)ときとEnterのときにだけ保存する。＋−や目標グレードのselectはその場で保存する

function MasuAutoEnhanceScreen({
  applyAutoEnhanceNow, autoEnhanceLog, getMasuMon, masuMonDetail, moveAutoEnhanceOrder,
  onBack, onMissing, onOpenNormalEnhance, onOpenTranscendEnhance, renderPowerBadge, updateAutoEnhance,
}) {
      // ★フックは必ずいちばん上で呼ぶ。下の「ベースが見つからない」で早期に返す行より後ろへ置くと、
      //   ある回だけフックの数が変わってReactが壊れる。上限の数値は入力中だけ下書きで持つ
      const [limitDraft, setLimitDraft] = useState(null);
      const masu = getMasuMon(masuMonDetail.id) || masuMonDetail;
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      if (!base) { onMissing(); return null; }
      const settings = normalizeMasuAutoEnhance(masu.autoEnhance);
      const points = Math.max(0, Math.floor(Number(masu.distAptPoints) || 0));
      const resolvedApt = resolveMasuDistAptitude(masu, base);
      const baseApt = masuTranscendBaseAptitude(masu, base);
      // ステータスは「合計いくつまで上げてよいか」で決める。素の値(超越の基礎UPを含む)と
      // いまの値は、強化画面に出ている数字とまったく同じものを使う
      const individual = resolveMasuIndividualStats(masu, base);
      const statTargets = autoEnhanceStatTargetsOf(masu, base);
      const baseStatOf = (key) => Math.max(0, Math.floor(Number(individual[key]) || 0));
      const spentStatOf = (key) => Math.max(0, Number(masu.statPoints?.[key]) || 0);
      const currentStatOf = (key) => baseStatOf(key) + spentStatOf(key);
      const hasTarget = autoEnhanceHasTarget(masu, base);
      // 絆ポイントリセットの直後は自動で振らない(道具代を無駄にしないため)。
      // 止まっていることを黙っていると「ONなのに働かない」に見えるので、画面で必ず伝える
      const awaitsReset = masuAwaitsBondResetReallocation(masu);
      // いま持っているポイントを設定どおりに振ったらどうなるか。設定を変えるたびに作り直すので、
      // 「この順番でいいのか」を保存前と同じ計算で確かめられる
      const planned = buildMasuAutoEnhancePlan({ ...masu, autoEnhance:{ ...settings, enabled:true } }, base);
      const plannedLines = planned ? describeAutoEnhancePlan(planned.plan) : [];
      const log = (autoEnhanceLog || []).filter(entry => String(entry.masuId) === String(masu.id));

      // null のあいだは保存値をそのまま出す
      const statTargetText = (key) => {
        if (limitDraft && limitDraft.key === key) return limitDraft.text;
        const goal = statTargets[key];
        return goal === null ? '' : String(goal);
      };
      const commitStatTarget = (key) => {
        if (!limitDraft || limitDraft.key !== key) return;
        const text = limitDraft.text.trim();
        setLimitDraft(null);
        // 空欄は「上限なし」。数字以外が混ざっていたら数字だけを拾う(スマホのキーボード対策)
        const digits = text.replace(/[^0-9]/g, '');
        updateAutoEnhance(masu.id, { statTargets:{ ...statTargets, [key]: digits === '' ? null : Number(digits) } });
      };
      const setStatTarget = (key, value) => {
        setLimitDraft(null);
        updateAutoEnhance(masu.id, { statTargets:{ ...statTargets, [key]: value } });
      };
      const setAptLimit = (index, grade) => {
        const aptLimits = [...settings.aptLimits];
        aptLimits[index] = grade;
        updateAutoEnhance(masu.id, { aptLimits });
      };
      const captureCurrent = () => {
        const captured = buildAutoEnhanceLimitsFromCurrent(masu, base);
        if (captured) { setLimitDraft(null); updateAutoEnhance(masu.id, captured); }
      };
      const clearAll = () => {
        setLimitDraft(null);
        updateAutoEnhance(masu.id, { statTargets:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] });
      };
      const rowLabel = (target) => {
        const aptIndex = autoEnhanceAptIndexOf(target);
        return aptIndex != null ? `${RANGE_LABELS[aptIndex]}距離適性` : STAT_POINT_KEYS[target];
      };
      // 目標に選べるグレード。いまより下は選べない(下げる強化は存在しないため)
      const aptChoices = (index) => {
        const from = Math.max(0, DIST_APTITUDE_GRADES.indexOf(resolvedApt[index] || 'C'));
        return DIST_APTITUDE_GRADES.slice(from + 1);
      };

      return (
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 flex flex-col overflow-hidden" data-auto-enhance={masu.id}>
          <div className="flex items-center gap-2 p-4 shrink-0 border-b border-white/10" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
            <button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
            <h2 className="text-xl font-black italic text-lime-300 uppercase tracking-widest flex-1">オート強化</h2>
          </div>
          <div data-transcend-enhance-tabs className="shrink-0 w-full max-w-md mx-auto px-4 pt-3 grid grid-cols-3 gap-1.5">
            <button onClick={onOpenNormalEnhance} className="min-h-[40px] rounded-xl border border-amber-400/50 bg-slate-900 text-amber-200 text-[11px] font-black active:scale-95">通常強化</button>
            <button onClick={onOpenTranscendEnhance} className="min-h-[40px] rounded-xl border border-sky-400/50 bg-slate-900 text-sky-200 text-[11px] font-black active:scale-95">超越強化</button>
            <button className="min-h-[40px] rounded-xl bg-lime-500 text-slate-950 text-[11px] font-black">オート強化</button>
          </div>
          <div className="shrink-0 w-full max-w-md mx-auto px-4 pt-3"><AssistantBubble scene="masuAutoEnhance" compact/></div>
          <div className="flex-1 overflow-y-auto mh-scroll p-4 space-y-3 max-w-md mx-auto w-full">

            <div className="flex items-center gap-3 bg-slate-900 border border-lime-500/30 rounded-3xl p-3 shadow-xl">
              <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden border border-lime-400/40"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white truncate">{masu.name}</h3>
                <div className="text-[9px] text-lime-300 font-black flex items-center gap-1"><Sparkles size={9}/>未使用の強化P {points}</div>
                <div className="mt-1">{renderPowerBadge(masuPowerOf(masu), {dense:true, size:'sm'})}</div>
              </div>
            </div>

            {/* オン / オフ */}
            <div className={`rounded-3xl border p-3 shadow-xl ${settings.enabled?'border-lime-400/50 bg-lime-950/25':'border-white/10 bg-slate-900'}`}>
              <button type="button" aria-pressed={settings.enabled} onClick={()=>updateAutoEnhance(masu.id, { enabled: !settings.enabled })}
                className={`w-full min-h-[52px] rounded-2xl font-black text-[13px] active:scale-95 flex items-center justify-center gap-2 ${settings.enabled?'bg-gradient-to-r from-lime-500 to-emerald-500 text-slate-950':'bg-slate-800 text-slate-300'}`}>
                <Sparkles size={16}/>{settings.enabled?'オート強化 ON':'オート強化 OFF'}
              </button>
              <div className="mt-2 text-[9px] font-bold leading-relaxed text-slate-300">
                {settings.enabled
                  ? '強化ポイントが入るたびに、下の順番で上限まで自動で振ります。バトル・スキップ・合体・限界突破・転生のあと、AUTO∞の周回中も同じように働きます。'
                  : 'OFFのあいだ、この子の強化ポイントは自動では振られません。'}
              </div>
              {settings.enabled&&awaitsReset&&(
                <div className="mt-2 rounded-xl border border-cyan-400/50 bg-cyan-950/30 px-2.5 py-2 text-[9px] font-black text-cyan-200 leading-relaxed">
                  絆ポイントリセットの直後なので、いまは自動で振りません。振り直すための道具を使ったばかりなので、勝手に振ってしまわないようにしています。通常強化で振り直すか、下の「この内容でいますぐ振る」を押すと、そこから再開します。
                </div>
              )}
              {settings.enabled&&!hasTarget&&(
                <div className="mt-2 rounded-xl border border-amber-500/50 bg-amber-950/30 px-2.5 py-2 text-[9px] font-black text-amber-200 leading-relaxed">
                  振ってよい先がまだ1つもないので、ONでも何も振られません。下で目標を決めるか、「いまの値を目標として取り込む」を押してください。
                </div>
              )}
              <div className="mt-2 text-[8px] font-bold text-slate-500 leading-relaxed">設定は転生しても残ります。目標まで届くと止まり、残った強化ポイントはそのまま手元に残るので、手で振ることもできます。</div>
            </div>

            {/* 上限の一括操作 */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={captureCurrent} className="min-h-[46px] rounded-xl bg-slate-800 border border-lime-400/40 text-lime-200 text-[10px] font-black active:scale-95 px-2 leading-tight">いまの値を<br/>目標として取り込む</button>
              <button type="button" onClick={clearAll} className="min-h-[46px] rounded-xl bg-slate-800 border border-white/10 text-slate-300 text-[10px] font-black active:scale-95 px-2 leading-tight">すべて<br/>「振らない」に戻す</button>
            </div>
            <div className="text-[8px] text-slate-500 font-bold leading-relaxed px-1">「いまの値を目標として取り込む」は、この子のいまの数値をそのまま目標に写します。転生する前に押しておくと、転生後の周回で同じ数値まで自動で戻ります。</div>

            {/* いま持っているポイントの行き先 */}
            <div className="rounded-2xl border border-lime-500/30 bg-black/40 p-3">
              <div className="text-[10px] font-black text-lime-300 uppercase tracking-wider mb-1.5">いまの {points}P の行き先</div>
              {points<=0
                ? <div className="text-[9px] text-slate-400 font-bold">未使用の強化ポイントがありません。</div>
                : plannedLines.length>0
                  ? (<>
                      <div className="space-y-0.5">{plannedLines.map((line,idx)=><div key={idx} className="text-[10px] font-black text-white">・{line}</div>)}</div>
                      <div className="mt-1 text-[8px] font-bold text-slate-400">{planned.used}P を使い、{points-planned.used}P が残ります。{awaitsReset&&'（絆ポイントリセットの直後なので、自動では振りません）'}</div>
                      <button type="button" onClick={()=>applyAutoEnhanceNow(masu.id)} className="mt-2 w-full min-h-[44px] rounded-xl bg-gradient-to-r from-lime-600 to-emerald-600 text-white font-black text-[11px] active:scale-95">この内容でいますぐ振る</button>
                    </>)
                  : <div className="text-[9px] text-amber-300 font-bold">目標まで届いているので、いまの設定では振る先がありません。</div>}
            </div>

            {/* 優先順位と上限 */}
            <div className="bg-slate-900 border border-lime-500/40 rounded-3xl p-3 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-black text-lime-300 uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={14}/>優先順位と上限</div>
                <div className="text-[9px] text-slate-400 font-bold">上から順に埋めます</div>
              </div>
              <div className="space-y-1.5">
                {settings.order.map((target,rank)=>{
                  const aptIndex = autoEnhanceAptIndexOf(target);
                  const isApt = aptIndex != null;
                  const limit = isApt ? settings.aptLimits[aptIndex] : statTargets[target];
                  const active = isApt ? limit !== null : (limit === null || limit > 0);
                  const gain = isApt ? 0 : (STAT_POINT_GAIN[target] || 1);
                  const baseValue = isApt ? 0 : baseStatOf(target);
                  const spentValue = isApt ? 0 : spentStatOf(target);
                  const currentValue = isApt ? 0 : currentStatOf(target);
                  // 目標まであと何ポイント要るか。1Pあたりの上昇量で割り切れないぶんは切り捨て
                  const neededPoints = (isApt || limit === null || limit <= 0) ? 0 : Math.max(0, Math.floor((limit - currentValue) / gain));
                  const choices = isApt ? aptChoices(aptIndex) : [];
                  return (
                    <div key={target} className={`rounded-2xl p-2 border ${active?'border-lime-500/30 bg-black/40':'border-white/5 bg-black/20'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 shrink-0 rounded-full text-[9px] font-black flex items-center justify-center ${active?'bg-lime-500 text-slate-950':'bg-slate-700 text-slate-400'}`}>{rank+1}</span>
                        <span className={`flex-1 min-w-0 truncate text-[11px] font-black ${active?'text-white':'text-slate-500'}`}>{rowLabel(target)}</span>
                        <button type="button" aria-label={`${rowLabel(target)}の優先順位を上げる`} disabled={rank<=0} onClick={()=>moveAutoEnhanceOrder(masu.id,target,-1)} className="w-9 h-9 shrink-0 rounded-lg bg-slate-700 text-sm font-black active:scale-95 disabled:opacity-20">↑</button>
                        <button type="button" aria-label={`${rowLabel(target)}の優先順位を下げる`} disabled={rank>=settings.order.length-1} onClick={()=>moveAutoEnhanceOrder(masu.id,target,1)} className="w-9 h-9 shrink-0 rounded-lg bg-slate-700 text-sm font-black active:scale-95 disabled:opacity-20">↓</button>
                      </div>
                      {isApt
                        ? (<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 shrink-0">いま</span>
                            <span className={`text-[12px] font-mono font-black shrink-0 ${DIST_APTITUDE_COLOR[resolvedApt[aptIndex]]}`}>{resolvedApt[aptIndex]}</span>
                            <span className="text-[8px] text-slate-600 shrink-0">(元{baseApt[aptIndex]})</span>
                            <span className="text-[9px] font-bold text-slate-400 shrink-0">→ 目標</span>
                            <select aria-label={`${rowLabel(target)}の目標`} value={limit===null?'':limit} onChange={event=>setAptLimit(aptIndex, event.target.value===''?null:event.target.value)}
                              className="flex-1 basis-24 min-w-0 min-h-[40px] rounded-lg border border-lime-400/40 bg-slate-950 px-1 text-center text-[11px] font-black text-white">
                              <option value="">振らない</option>
                              {limit!==null&&!choices.includes(limit)&&<option value={limit}>{limit}（到達済み）</option>}
                              {choices.map(grade=><option key={grade} value={grade}>{grade} まで</option>)}
                            </select>
                          </div>)
                        : (<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 shrink-0">いま</span>
                            <span className="text-[13px] font-mono font-black text-white shrink-0">{currentValue}</span>
                            <span className="text-[9px] font-bold text-slate-400 shrink-0">→ ここまで</span>
                            <label className="flex flex-1 basis-16 min-w-0 items-center gap-0.5">
                              <input data-auto-enhance-limit={target} aria-label={`${rowLabel(target)}をいくつまで上げてよいか`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off"
                                placeholder="上限なし" value={statTargetText(target)} onFocus={event=>event.currentTarget.select()}
                                onChange={event=>setLimitDraft({ key:target, text:event.currentTarget.value })}
                                onBlur={()=>commitStatTarget(target)}
                                onKeyDown={event=>{ if(event.key==='Enter') event.currentTarget.blur(); }}
                                className="w-full min-w-0 h-10 rounded-lg border border-lime-400/40 bg-slate-950 px-1 text-center text-[13px] font-mono font-black text-white outline-none focus:border-lime-300 placeholder:text-[10px] placeholder:text-slate-600 placeholder:font-bold"/>
                            </label>
                            <button type="button" aria-label={`${rowLabel(target)}を上限なしにする`} aria-pressed={limit===null} onClick={()=>setStatTarget(target, null)} className={`w-9 h-10 shrink-0 rounded-lg text-[11px] font-black active:scale-95 ${limit===null?'bg-lime-500 text-slate-950':'bg-slate-700 text-slate-300'}`}>∞</button>
                            <button type="button" aria-label={`${rowLabel(target)}を振らないにする`} aria-pressed={limit===0} onClick={()=>setStatTarget(target, 0)} className={`w-9 h-10 shrink-0 rounded-lg text-[11px] font-black active:scale-95 ${limit===0?'bg-slate-500 text-slate-950':'bg-slate-700 text-slate-300'}`}>✕</button>
                          </div>)}
                      {/* 数字の出どころを1行で見せる。「いま」が素の値と強化ぶんの合計だと分かれば、
                          目標をいくつにすればいいか考えなくて済む */}
                      {!isApt&&(
                        <div className="mt-1 text-[8px] font-bold text-slate-500">
                          素の値 {baseValue}{spentValue>0&&<span className="text-emerald-400"> ＋ 強化 {spentValue}</span>} ／ 強化P1つで +{gain}
                          {limit===null&&<span className="text-lime-400"> ／ 上限なし（振れるだけ振ります）</span>}
                          {limit!==null&&limit>0&&(neededPoints>0
                            ? <span className="text-lime-400"> ／ 目標まで あと {neededPoints}P</span>
                            : <span className="text-slate-400"> ／ 目標に届いています</span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[8px] text-slate-500 font-bold leading-relaxed">ステータスは「その能力を合計いくつまで上げてよいか」で決めます（画面に出ている数値そのままです）。空欄か∞で上限なし、✕で振りません。強化P1つで上がる量は決まっているので、割り切れないときは目標を超えない手前で止まります。間合い適性はいまより上の段階だけを目標に選べます。</div>
            </div>

            {/* 直近の自動強化 */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1.5">直近の自動強化</div>
              {log.length<=0
                ? <div className="text-[9px] text-slate-500 font-bold">このアプリを開いてからは、まだ自動で振られていません。</div>
                : <div className="space-y-1">{log.slice(0,5).map((entry,idx)=>(
                    <div key={idx} className="rounded-xl bg-black/40 px-2 py-1.5">
                      <div className="text-[9px] font-black text-lime-300">{entry.used}P を使いました</div>
                      <div className="text-[9px] font-bold text-slate-300 leading-relaxed">{entry.lines.join(' ／ ')}</div>
                    </div>
                  ))}</div>}
            </div>

            <button onClick={onBack} className="w-full bg-white text-black py-3.5 rounded-2xl font-black text-sm uppercase active:scale-95 shadow-lg mt-2">完了</button>
          </div>
        </div>
      );
}
