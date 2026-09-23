// ==== 画面: バトル ====
//
// 【誰が攻撃を食らったか】
// 枠ごとに何が起きたか(tacticsSlotFx)を、浮かぶ数字だけでなく**枠そのもの**でも出す
// (2026-09-22 ユーザー指示「攻撃されたときに誰が攻撃されたかが分かりづらい
//  食らったモンスターにエフェクトなどがつくようにしたい」)。
// 色とアイコンはこの表だけに書き、出し方(フラッシュ・輪・縁・揺れ)は1か所にまとめる。
// 新しい種類を足すときは、ここへ1行足して kindOfTacticsSlotFx が返す名前を増やす。
const TACTICS_SLOT_FX_STYLE = Object.freeze({
  hit:     { rgb: '239,68,68',  ring: 'border-red-200',     edge: 'border-red-400' },
  guard:   { rgb: '16,185,129', ring: 'border-emerald-200', edge: 'border-emerald-300' },
  evade:   { rgb: '59,130,246', ring: 'border-sky-200',     edge: 'border-sky-300' },
  reflect: { rgb: '168,85,247', ring: 'border-purple-200',  edge: 'border-purple-300' },
});
// その枠で「いちばん強く伝えたいこと」を1つだけ選ぶ。重ねると何色なのか読めなくなる。
// ★順番に意味がある。かわした・返したは「食らっていない」ので先に見る。
//   ガードは「狙われたが受け止めた」ので、ダメージが通っていなければガード色
const kindOfTacticsSlotFx = (fx) => {
  if (!fx) return null;
  if (fx.evade) return 'evade';
  if (fx.reflect) return 'reflect';
  if (fx.dmg > 0) return 'hit';
  if (fx.guard) return 'guard';
  return null;
};
//
// MonsterHeroGame から切り出した20本目・最後の1本(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-13)。
// バトル画面そのもの(87千字)と、バトル中にだけ重なる演出4つ。
//
// 【この画面ならではの注意】
// ・A等級(docs/refactor/REGRESSION_RISK_MAP.md)。ランキングに影響しうるので、
//   **計算・保存・ターン進行はひとつも移していない**。ここにあるのは見せ方だけ
// ・オート進行・演出・ターンのタイマーはすべて MonsterHeroGame 側に残る。
//   画面へ移すと、画面のライフサイクルで途中の setTimeout が止まって進行不能になる
//   (この画面の中に残る setTimeout は、カードを置いたあと 0.5 秒で光を消す1つだけ)
// ・省エネ切替ボタンだけ、バトル画面の中でもういちど gameState==='BATTLE' を見ていた。
//   画面は gameState を知らない約束(ui/screen-parts-check)なので、
//   本体から battleScreenActive として渡している(綴りだけの違い)
function BattleScreen({
  applyTurnDamageReduction, attackAnim, autoBattle, autoBattleRef, autoRepeat, battleIntimidate,
  battleScenarioRef, battleScreenActive, battleSoulMasus, battleSpeed, battleTutorial,
  battleTutorialAllowsEmergency, battleTutorialCardAllowed, battleTutorialCardKind,
  battleTutorialCardTarget, battleTutorialNeed, battleTutorialNeedCard, battleTutorialSpotClass,
  battleTutorialStep, cardAssignments, cardDragActiveRef, cardEffectMultiplier, cardLimit, makeCardHalveCounter,
  cardNeedsMonster, cycleActiveUniqueForSlot, cycleBattleAuto, cycleBattleSpeed, cycleEcoMode,
  debugBattle, difficulty, dismissQuickRhythmIntro, distTotalBonus, dragOverSlot, dragState,
  ecoBattleView, ecoMode, effectiveMaxGuts, effectiveMaxHp, enemy, enemyAttackAnim,
  enemyAttackFx, enemyDist, enemyIntent, enemyNextIntent, enemyRevivalUsed, enemySkillName,
  extremeDifficulty, extremeRun, extremeRunRef, focusedCard, getAttackPredictedDmg,
  getAvailableUniquesForSlot, getCardGuts, getDmg, getIncomingDamageBeforeTurnReduction,
  getMasuMon, getNextTurnBuff, getPermaBuff, getTurnBuff, getWaveBuff, guardCardWeight, guardFx,
  guardLevel, guardValueOf, tacticsSlotGuardValue, guts, hand, heroCardBonus, heroDist, hp, iceLockActive,
  iceLockPreparing, iceLockTurns, isAssistCard, isAttackCard, isBusy, isHeroSlotMon,
  kikiCardBonus, liteBattleView, mainHero, openHelp, ownedUniques, pendingCard, pendingCardGuts,
  popups, previewLocalBoosts, processTurn, quickRhythmIntroVisible, quickToRhythmButtonNode,
  renderQuickRunBattleBand, runMode, safeDifficulty, score, selectedCardGuts, selectedCards,
  setCardAssignments, setDragState, setFocusedCard, setPendingCard, setShowAutoBgmPicker,
  setShowBattleLog, setShowDeckInfo, setShowEnemyInfo, setShowHeroInfo, setShowQuitConfirm,
  setShowSoulBattleEffects, setSkillPicker, setSlotSettle, slotMaxUses, slotSettle, slotSkill,
  slotUniqueChoice, slots, soulBattleParty, soulCoordinationCardBonus, suppressCardClickRef,
  tacticsCanAssign, tacticsCardBlock, tacticsCardGenre, tacticsCardScope, tacticsSlotFx, tacticsUnits,
  tacticsExInfo, activateTacticsEx, tacticsExTurnUsed, passTacticsTurn, tacticsCoverSlot,
  tacticsExIntroVisible, dismissTacticsExIntro,
  teachingFx, totalTurnCount, turnCount, ultimateDistanceBreakLevels, ultraBattleView,
  unifiedSpecialDefense, useEmergency, wave,
}) {
  // 強化の札を「アイコン1行」と「数値つきの一覧」で切り替える(2026-09-20 ユーザー指摘)。
  // ★いくつ付いても高さが変わらないようにするための状態。ここが無いと、
  //   札が3行4行に伸びて敵の絵・緊急のボタン・与ダメの数字を押し出す
  const [buffDetail, setBuffDetail] = useState(false);
  // バトル中の設定メニュー(2026-09-22 ユーザー指示「BGMは右上に設定ボタンみたいの作って
  // そこにギブアップとかヘルプとかと一緒にまとめて」)。
  // ★ヘッダーに3つ並べていた入口(ヘルプ・あきらめる)とBGMを1つにまとめる。
  //   どれもバトル中に何度も押すものではないので、1枚めくる形にしても手が止まらない
  const [showBattleMenu, setShowBattleMenu] = useState(false);
  // ★タクティクス専用 EXスキルの詳細を開いている枠。距離枠をタップすると開く(開くだけで発動はしない)。
  //   中身は毎回 tacticsExInfo から引き直す(回数・使えるかは開いたあとも変わるため、開いた時点の値を持たない)
  const [exPanelSlot, setExPanelSlot] = useState(null);
  const exPanel = exPanelSlot!=null&&tacticsExInfo ? tacticsExInfo(exPanelSlot) : null;
  // 新タクティクスUIの確認版。デバッグ戦だけで有効にし、通常プレイの表示・挙動は一切変えない。
  // タクティクス自体が現在はデバッグのバトルモード入口からだけ起動できるため、
  // 途中で debugBattle が解除されても確認UIを維持する。公開時は専用フラグへ切り替える。
  const tacticsDebugLayout = Array.isArray(tacticsUnits);
  // ★いま狙われている枠(2026-09-21 ユーザー指摘「誰に攻撃か分からない」)。
  //   間合い攻撃は相手を1体決めず「予告した間合いに立っている子」へ当たるので、
  //   ほかの技と違って targetName を持たない。予告を見ても間合いしか分からなかった。
  // ★数え方は本番と同じ tacticsIntentTargets を通す。別に書くと、距離撃でずらしたときに
  //   予告と実際がずれる(「当たらないはずの枠が光る」)
  const rawAimedSlots = Array.isArray(tacticsUnits) && enemyIntent
    ? tacticsIntentTargets(enemyIntent, tacticsUnits, enemyDist) : [];
  // ★EX「みんなをかばう」が効いているターンは、狙いがかばう子へまとまる(本番と同じ coverTacticsTargets)。
  //   全体攻撃なら、本来当たるはずだった人数ぶんをその子が受ける
  const coverActive = Number.isInteger(tacticsCoverSlot) && rawAimedSlots.length > 0;
  const coverHitCount = coverActive ? rawAimedSlots.length : 1;
  const aimedSlots = coverActive ? [tacticsCoverSlot] : rawAimedSlots;
  const aimedName = (coverActive ? `${tacticsTargetName(tacticsUnits, tacticsCoverSlot)}（かばう）` : null)
    || enemyIntent?.targetName
    || (aimedSlots.length ? aimedSlots.map(idx => tacticsTargetName(tacticsUnits, idx)).join('・')
      : (enemyIntent?.variant === 'sweep' ? 'だれもいない' : ''));
  // 1体ぶんの「このターン減る量」。予告の吹き出しと、枠ごとの表示の両方がここを通る。
  // ★slotIdx を渡すと**その子の丈夫さ**と**その子へ置いたガード**で数える。
  //   全体攻撃は立っている全員に当たり、受ける量は丈夫さで1体ずつ変わるのに、
  //   吹き出しの1つの数字では誰がどれだけ減るのか分からなかった
  //   (2026-09-21 ユーザー依頼「全体攻撃はモンスターごとにダメージが変わるはずだから
  //   それを分かるようにして」)。ガードも枠ごとなのに全部まとめて数えていた。
  // ★slotIdx が null のときは今までどおりパーティの値(既存5モード)
  // ★予告と実行で数え方がずれると「ガードしたのに予定より減った」になるので、
  //   受け方は本番と同じ resolveTacticsGuardedHit を通す
  // ★ガードは枠ごとにまとめてから数える(2026-09-22 の新仕様)。全体ガードかどうかは
  //   「何体が別々に構えたか」で決まるので、1枠だけ見ても分からない。
  //   何枚目かの数え方はアプリ側(makeCardHalveCounter)が持つ。枠を絞るのは集計のときだけで、
  //   半減の数えは全カードを順に通す
  const plannedGuardBySlot = () => {
    const bySlot = {};
    const counter = makeCardHalveCounter();
    selectedCards.forEach(idx => {
      const card = hand[idx];
      const slotIdx = cardAssignments[idx] != null ? cardAssignments[idx] : null;
      const halved = counter.take(card, slotIdx);
      const w = guardCardWeight(card);
      if (!(w > 0) || slotIdx == null) return;
      const effect = cardEffectMultiplier(card, halved);
      const entry = bySlot[slotIdx] || (bySlot[slotIdx] = { flat: 0, mult: 0, weight: 0, cards: 0 });
      entry.flat += GUARD_EVOLUTION[guardLevel].flat * w * effect;
      entry.mult += GUARD_EVOLUTION[guardLevel].mult * w * effect;
      entry.weight += w;
      entry.cards += 1;
    });
    return bySlot;
  };
  // ★連撃は「1発ずつ」出す(2026-09-22 ユーザー指示「連撃ダメージ予測が合算分だから
  //   分かりにくい ガード入れても合算計算だし うまくバラバラでわかるようにしたい」)。
  //   受けたあとの表示と同じ splitTacticsHitAmounts を通すので、予告と実際で割り方がそろう。
  //   ガードで止めた発は通らないので、**通る発の数だけ**に割る(数字の数＝これから食らう回数)
  const plannedHitFor = (slotIdx) => {
    const none = { taken: 0, parts: [], raw: 0 };
    if (!enemyIntent) return none;
    // ★外れた間合い攻撃は予告の時点でも威力を落とす(実行と同じ tacticsSweepIntent を通す)。
    //   予告だけ1.2倍のままだと「予定より少なかった」になる
    const planIntent = Array.isArray(tacticsUnits) ? tacticsSweepIntent(enemyIntent, tacticsUnits, enemyDist) : enemyIntent;
    const raw = getIncomingDamageBeforeTurnReduction(planIntent, slotIdx);
    if (!(raw > 0)) return none;
    const hits = enemyIntent.variant === 'rush' ? Math.max(1, Math.floor(Number(enemyIntent.hits) || 1)) : 1;
    let guard = 0, guardHits = 1;
    // ★タクティクスは枠ごと。構えていない子も、全体ガードなら丈夫さぶんが付く。
    //   受け止めるヒット数は、その子へ何枚構えたかで決まる(2枚以上なら連撃の全部)
    if (Array.isArray(tacticsUnits) && slotIdx !== null) {
      const bySlot = plannedGuardBySlot();
      const own = bySlot[slotIdx] || { cards: 0 };
      guard = enemyIntent.variant === 'pierce' ? 0 : tacticsSlotGuardValue(bySlot, slotIdx);
      guardHits = tacticsGuardHits(own.cards, hits);
    } else {
      // 既存5モードは今までどおり、手札のガードをまとめて1つに数える
      let flat = 0, mult = 0;
      const counter = makeCardHalveCounter();
      selectedCards.forEach(idx => {
        const card = hand[idx];
        const halved = counter.take(card, cardAssignments[idx] != null ? cardAssignments[idx] : null);
        const w = guardCardWeight(card);
        if (!(w > 0)) return;
        const effect = cardEffectMultiplier(card, halved);
        flat += GUARD_EVOLUTION[guardLevel].flat * w * effect;
        mult += GUARD_EVOLUTION[guardLevel].mult * w * effect;
      });
      guard = enemyIntent.variant === 'pierce' ? 0 : guardValueOf(flat, mult, slotIdx);
    }
    const hit = resolveTacticsGuardedHit(raw, hits, guard, guardHits);
    const taken = applyTurnDamageReduction(hit.taken, slotIdx);
    if (!(taken > 0)) return { taken: 0, parts: [], raw };
    // ★発ごとの通る量をそのまま出す。ガードが効いた発は小さく、効いていない発は大きい。
    //   止まった発(0)は数字を出さないので、数字の数＝これから食らう回数
    // ★raw(軽減前の合計)も返す。連撃は1発ずつ並べると**合計がどこにも出ない**ので、
    //   「結局いくつ食らうのか」が読めなかった(2026-09-22 ユーザー指摘)
    return { taken, raw, parts: hits > 1 ? scaleTacticsHitAmounts((hit.amounts || []).filter(value => value > 0), taken) : [taken] };
  };
  // かばう子は、まとめて引き受けたぶん(人数ぶん)を受ける
  const plannedHitWithCover = (slotIdx) => {
    const hit = plannedHitFor(slotIdx);
    if (!coverActive || slotIdx !== tacticsCoverSlot || coverHitCount <= 1 || !(hit.taken > 0)) return hit;
    return { taken: hit.taken * coverHitCount, raw: hit.raw * coverHitCount,
      parts: Array.from({ length: coverHitCount }, () => hit.parts).flat() };
  };
  const plannedDamageFor = (slotIdx) => plannedHitWithCover(slotIdx).taken;
  // ★敵が次に何をするかの札(「3連撃！」など)。作りはここ1か所にして、置き場所だけ変える。
  //   ムーは丸枠の外、ほかの敵は丸枠の右上へ出すので、下の2か所から呼ぶ
  // ★貫通技準備もこの札で出す(2026-09-22 ユーザー指摘「必殺技のためると必殺準備が被って出てる。
  //   それって本来どっちかでいいはずだよね」)。それまでは貫通技準備だけ札から外し、画面まんなかの
  //   大きい警告に任せていたが、必殺技とためるは札と警告が二重に出て、重なってどちらも読めなかった。
  //   タクティクスはこの札にまとめ、まんなかの警告は札の無い既存5モードのためにそちらへ残した
  const enemyNoticeShown = !ecoBattleView&&!!enemy&&!!enemyIntent&&!isBusy&&!enemyAttackFx
    &&Array.isArray(tacticsUnits)&&!!enemyIntent.notice;
  const enemyNoticeCard = () => {
    // ★色・動き・光り方を効果で変える(2026-09-22 ユーザー指示「吹き出しを
    //   効果によって変えると見た目がいい」)。文字を読む前に、攻めてくるのか
    //   回復するのかが見分けられるようにする
    const noticeTone=enemyIntent.type==='SPECIAL'?'bg-fuchsia-600 border-fuchsia-200 text-white shadow-[0_0_14px_rgba(217,70,239,0.85)]'
      :enemyIntent.type==='CHARGE'?'bg-amber-500 border-amber-100 text-black shadow-[0_0_14px_rgba(251,191,36,0.85)]'
      :enemyIntent.type==='PIERCE_CHARGE'?'bg-rose-600 border-rose-200 text-white shadow-[0_0_14px_rgba(244,63,94,0.85)]'
      :enemyIntent.type==='MOVE'?'bg-cyan-600 border-cyan-100 text-white shadow-[0_0_12px_rgba(6,182,212,0.7)]'
      :enemyIntent.type==='ROAR'?'bg-orange-600 border-orange-100 text-white shadow-[0_0_14px_rgba(249,115,22,0.85)]'
      :enemyIntent.type==='REGEN'?'bg-emerald-600 border-emerald-100 text-white shadow-[0_0_14px_rgba(16,185,129,0.85)]'
      :enemyIntent.type==='WAIT'?'bg-slate-600 border-slate-200 text-white shadow-[0_2px_10px_rgba(0,0,0,0.9)]'
      :'bg-red-600 border-red-100 text-white shadow-[0_0_14px_rgba(239,68,68,0.85)]';
    // 動きも効果ごと。殴ってくる技は小刻みに震え、回復はふわっと浮き、
    // 攻撃力アップは左右に揺れ、ためるは膨らみ、様子見と移動は静かに明滅する
    const noticeAnim=enemyIntent.type==='REGEN'?'noticeHeal 1400ms ease-in-out infinite'
      :enemyIntent.type==='ROAR'?'noticeShout 900ms ease-in-out infinite'
      :enemyIntent.type==='CHARGE'?'noticeCharge 1100ms ease-in-out infinite'
      :(enemyIntent.type==='MOVE'||enemyIntent.type==='WAIT')?'noticeCalm 1600ms ease-in-out infinite'
      :'noticeHit 800ms ease-in-out infinite';
    return (
      <div data-enemy-notice={enemyIntent.notice} data-enemy-notice-anim={noticeAnim.split(' ')[0]}
        className={`max-w-[170px] truncate rounded-2xl border-2 px-2 py-0.5 font-black leading-tight flex items-center gap-1 ${noticeTone}`}
        style={{fontSize:'11px',animation:noticeAnim}}>
        {/* ★icon は必ず cardIconNode を通す。絵文字ならそのまま、画像なら <img> になる。
            素で置くと、あとで画像のアイコンを足したときに文字列がそのまま出る */}
        <span style={{fontSize:'12px'}} className="leading-none shrink-0">{cardIconNode(enemyIntent.icon,12)}</span>
        <span className="truncate">{enemyIntent.notice}！</span>
      </div>);
  };
  return (

      <div className="flex-1 flex flex-col h-full relative" data-battle-speed={battleSpeed} data-eco-view={ultraBattleView?'ultra':liteBattleView?'lite':'off'}>
        {/* 舞台の照明(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい。
            イメージ画みたいにかっこよくできないかな？」)。
            ★画像は足さない。スマホの通信量に直に効くうえ、敵ごとに背景を用意すると際限がない
              (docs/rules/ASSETS.md)。上からの光・床の照り返し・周辺減光の3枚だけで奥行きを作る。
            ★静止した塗りなので、描き直しも起きず省エネ表示でも負荷は変わらない。
            ★いちばん後ろ(z-0)。この上に載る帯はどれも bg-slate-950 で塗ってあるので、
              光が見えるのは敵のいる舞台だけになる */}
        <div data-battle-stage-bg aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{zIndex:0,
          background:[
            // 上からの光。敵の頭の高さを中心に、青白く落とす
            'radial-gradient(116% 62% at 50% 20%, rgba(96,124,206,.34) 0%, rgba(30,38,72,.30) 46%, rgba(0,0,0,0) 72%)',
            // 床の照り返し。間合いバーのあたりを薄く持ち上げて、立っている場所を感じさせる
            'radial-gradient(72% 26% at 50% 78%, rgba(88,116,196,.20) 0%, rgba(0,0,0,0) 100%)',
            // 周辺減光。四隅を落とすと、まんなかの敵に目が行く
            'radial-gradient(120% 86% at 50% 38%, rgba(0,0,0,0) 38%, rgba(3,5,12,.72) 100%)',
            'linear-gradient(180deg, #0a0e1e 0%, #070a16 62%, #05070f 100%)',
          ].join(',')}}/>
        {liteBattleView&&<div data-lite-eco-dimmer className="absolute inset-0 bg-black/20 pointer-events-none" style={{zIndex:89999}} aria-hidden="true"/>}
        <header data-battle-header className="h-[5%] min-h-[40px] shrink-0 bg-slate-900 px-1.5 flex items-center border-b border-white/5 z-[6500] overflow-hidden">
          <div className={`flex flex-1 min-w-0 items-center gap-0.5 overflow-hidden${battleTutorialSpotClass('waveInfo')}`}>{debugBattle&&<span className="text-[7px] font-black text-fuchsia-300 border border-fuchsia-500/40 rounded px-1 py-0.5 tracking-widest">DEBUG</span>}<span className={`text-[8px] font-black bg-opacity-10 px-1 py-0.5 rounded border tracking-tight whitespace-nowrap ${difficulty==='Hard'?'text-red-400 bg-red-500 border-red-500':'text-indigo-400 bg-indigo-500 border-indigo-500'}`}>WAVE {wave}/10</span>{/* 狭い幅ではモード名だけを縮め、ターン・スコアと右側の操作領域は動かさない */}<span className="min-w-0 overflow-hidden text-ellipsis text-[7px] font-black px-1 py-0.5 rounded border whitespace-nowrap" style={{color:battleModeInfo(runMode).color,borderColor:`${battleModeInfo(runMode).color}66`,backgroundColor:'rgba(0,0,0,.35)'}}>{extremeRun?`極限チャレンジ / ${extremeDifficulty}`:<>{battleModeInfo(runMode).short} / {QUICK_DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}</>}</span></div>
          <div data-battle-metrics className="shrink-0 flex items-center gap-1 px-1 leading-none">
            <div data-battle-turn className="flex flex-col items-center justify-center whitespace-nowrap font-black text-blue-400"><span className="flex items-center gap-0.5 text-[10px] tracking-wide"><Timer size={7}/>TURN</span><span className="mt-0.5 text-[10px] font-mono">{turnCount}/20</span></div>
            {!isQuickMode(runMode)&&<div data-battle-score className="flex min-w-[64px] flex-col items-end justify-center whitespace-nowrap font-mono font-black text-amber-500"><span className="flex items-center gap-0.5 text-[10px] tracking-wide"><Award size={7}/>SCORE</span><span data-battle-score-value className="mt-0.5 text-[10px] tabular-nums">{score.toLocaleString()}</span></div>}
          </div>
          <div data-battle-controls className="flex shrink-0 items-center gap-0.5"><button type="button" disabled={!!battleTutorial||autoRepeat} onClick={cycleBattleSpeed} aria-label={battleTutorial?'バトルのれんしゅう中は1倍固定':autoRepeat?'∞周回中は4倍固定':`バトル速度、現在${battleSpeed}倍。タップで切り替え`} title={autoRepeat?'∞周回中は×4固定':undefined} className="shrink-0 min-w-[42px] h-[28px] px-1.5 rounded-lg border-2 font-black text-[11px] leading-none active:scale-90 disabled:cursor-not-allowed disabled:opacity-60" style={{color:'#fef3c7',borderColor:'#f59e0b',backgroundColor:'rgba(120,53,15,.72)',boxShadow:'0 0 9px rgba(245,158,11,.35)'}}>×{battleSpeed}{autoRepeat&&<span className="ml-0.5 text-[10px]">固定</span>}</button><button data-battle-menu-button type="button" onClick={()=>setShowBattleMenu(true)} aria-label="設定（BGM・ヘルプ・あきらめる）" title="設定" className="shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-slate-800 rounded text-slate-300 active:scale-90"><Settings size={15}/></button></div>
        </header>
        {/* ★簡易画面には relative z-10 が要る。バトルの背景(data-battle-stage-bg)は
              position:absolute の z-index:0 で、CSSでは「位置指定のある要素」が static より上に描かれる。
              ここを static のままにすると簡易画面がまるごと背景の下へ潜り、
              超省エネにした瞬間に画面が消える(2026-09-22・ユーザー報告
              「超省エネにしたときだけ画面がなくなる」)。通常のバトル画面のほうは、
              中の要素が個別に relative z-* を持っているので沈まない */}
        {ultraBattleView?(
          <div data-ultra-battle-view className="relative z-10 flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100">
            <div className="flex-1 min-h-0 px-2 py-1.5 flex flex-col gap-1.5 overflow-hidden">
              {enemy&&(
                <section className="rounded-xl border border-red-900/70 bg-slate-900/95 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black"><span className="min-w-0 truncate text-red-200">{enemy.name}</span><span className="shrink-0 font-mono text-red-300">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-red-600" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`}}/></div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    <div className="h-[clamp(82px,16dvh,132px)] w-[clamp(82px,16dvh,132px)] flex items-center justify-center">{enemy.imgUrl?<img src={enemy.imgUrl} alt={enemy.name} className="w-full h-full object-contain"/>:<span style={{fontSize:'clamp(58px,11dvh,104px)',lineHeight:1}}>{enemy.emoji}</span>}</div>
                    <div className="text-center"><div className="text-[10px] font-black text-slate-400">現在距離</div><div className={`mt-1 rounded-full border px-3 py-1 text-[11px] font-black ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}距離</div></div>
                  </div>
                  <div data-ultra-enemy-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-red-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{enemySkillName&&<div className="truncate text-[11px] font-black text-red-200">{enemySkillName.label}</div>}{popups.filter(p=>p.side==='enemy').map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
                </section>
              )}
              <section className="rounded-xl border border-indigo-900/70 bg-slate-900/95 px-2 py-1.5">
                <div data-ultra-ally-slots className="grid grid-cols-4 gap-1">{slots.map((s,i)=><div key={i} className={`flex h-[42px] min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border}`}><div className="w-full truncate text-[10px] font-black text-white">{s?.name||'---'}</div><div className="mt-1 text-[10px] font-black">{RANGE_LABELS[i]}距離</div></div>)}</div>
                <div className="mt-1.5 space-y-1">
                  <div><div className="flex justify-between text-[10px] font-black text-pink-300"><span>味方HP</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-pink-500" style={{width:`${(hp/effectiveMaxHp)*100}%`}}/></div></div>
                  <div><div className="flex justify-between text-[10px] font-black text-amber-300"><span>ガッツ</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{width:`${(guts/effectiveMaxGuts)*100}%`}}/></div></div>
                </div>
                <div data-ultra-ally-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-indigo-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{slotSkill&&<div className="truncate text-[11px] font-black text-indigo-200">{slotSkill.name}</div>}{popups.filter(p=>['hero','life','guts'].includes(p.side)).map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
              </section>
              {/* 空いたところへ周回の積み上がりを出す(2026-09-07・ユーザー指示)。
                  ★中身は描くときに組み立てる(関数で呼ぶ)。上のほうで const にすると、
                    見込み報酬の計算がまだ定義されておらず ∞ にした瞬間に画面が落ちる */}
              {renderQuickRunBattleBand()}
            </div>
            <div className="shrink-0 border-t border-white/10 bg-slate-900 p-1">
              <div className="flex items-center justify-between gap-1 px-1">
                <div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-wider text-indigo-300">Action Cards</div><div className="truncate text-[9px] font-bold text-slate-300">AUTO∞で進行中</div></div>
                <button onClick={()=>setShowDeckInfo(true)} className="flex min-h-[32px] items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 text-[10px] font-black"><Layers size={9}/>VIEW</button>
                {/* 超省エネでも🎵の縦列は通常のバトル画面と同じ並びにする */}
                <div className="shrink-0 flex flex-col gap-0.5">
                  <button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="バトルBGMと音量を調整" title="BGM / 音量" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[10px] font-black leading-none">BGM</span></button>
                  {quickToRhythmButtonNode}
                </div>
                <div className="w-[44px] shrink-0 flex flex-col gap-0.5"><button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className="h-8 w-full rounded-lg border-2 border-fuchsia-300 bg-fuchsia-500 text-[10px] font-black leading-tight text-slate-950"><span className="block">AUTO</span><span className="block text-[10px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button><button type="button" onClick={cycleEcoMode} aria-label="省エネ 超" className="min-h-[24px] w-full rounded-md border border-lime-200 bg-lime-500 text-[10px] font-black leading-[9px] text-slate-950"><span className="block">省エネ</span><span className="block">超</span></button></div>
                <button disabled className="min-h-[44px] min-w-[84px] shrink-0 rounded-full border-2 border-black bg-slate-700 px-2 text-[11px] font-black uppercase text-slate-400 opacity-50"><Play fill="currentColor" size={12} className="inline mr-1"/>Action</button>
              </div>
            </div>
          </div>
        ):(<>
        {/* 累計ターンで動く倍率だけをここへ出す。静的なルールの全文は「ルール詳細」で読む。
            ULTIMATEとINFINITYのように同じ系統のルールを持つ難易度は、同じ表示を共有する */}
        {(()=>{
          const statusRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);
          const hasEnemyRate=extremeRuleNumber(statusRule,'enemyTurnRate')!=null;
          const hasDamageRate=extremeRuleNumber(statusRule,'damageTurnRate')!=null;
          if(!hasEnemyRate&&!hasDamageRate)return null;
          const elapsedTotalTurns=totalTurnCount+Math.max(0,turnCount-1);
          const enemyMultiplier=ultimateEnemyTurnMultiplier(totalTurnCount,statusRule);
          const damageMultiplier=extremeDamageTurnMultiplier(elapsedTotalTurns,statusRule,wave);
          const hasJoinRate=extremeRuleNumber(statusRule,'allyJoinPenaltyRate')!=null;
          // 段階(神威・黄昏)と不死の残り回数は難易度名で分岐せず、持っている難易度だけに出す
          const stageLabel=extremeWaveStageLabel(statusRule);
          const stagedEnemyMultiplier=extremeWaveEnemyMultiplier(statusRule,wave);
          const revivalTotal=extremeRevivalCount(statusRule,wave);
          return <div data-ultimate-battle-status={statusRule} className="shrink-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[10px] font-black leading-none text-purple-100">
            <span className="text-amber-300">{statusRule}{stageLabel?` ${stageLabel} Lv.${extremeWaveStageLevel(wave)}`:''}</span>{revivalTotal>0&&<span className="text-slate-200">不死 残り{Math.max(0,revivalTotal-enemyRevivalUsed)}回</span>}{hasEnemyRate&&<span>敵強化 +{compactPercent(enemyMultiplier*stagedEnemyMultiplier-1)}（WAVE開始時 累計{totalTurnCount}T）</span>}{hasDamageRate&&<span>与ダメ {compactPercent(damageMultiplier)}（現在 累計{elapsedTotalTurns}T）</span>}{hasJoinRate&&<span>加入B {compactPercent(ultimateAllyJoinMultiplier(elapsedTotalTurns,statusRule))}（現在）</span>}{extremeDistanceBreakRule(statusRule)&&<span>BREAK {ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]}Lv${level}`:null).filter(Boolean).join(' / ')||'未発生'}</span>}
          </div>;
        })()}
        {(()=>{const rule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);return [NIGHTMARE_SETTING.id,CHAOS_SETTING.id].includes(rule)&&<div data-extreme-battle-status={rule} className="shrink-0 grid grid-cols-4 items-center gap-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[10px] font-black leading-none text-purple-100"><span className="text-amber-300">{rule}</span>{extremeSpecialRuleLines(rule).map(([label,value])=><span key={label} className="text-center whitespace-nowrap">{label} {value}</span>)}</div>;})()}
        {enemy&&(
          <div className={`shrink-0 bg-slate-950/95 border-b border-red-900/40 px-4 py-1 z-[6400] shadow-[0_4px_12px_rgba(0,0,0,0.6)]${battleTutorialSpotClass('enemyBar')}`}>
            <div className="flex justify-between items-center text-[11px] font-black italic uppercase tracking-tighter mb-0.5">
              <span className={`flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 leading-none ${wave===10?'text-red-500 animate-pulse':'text-slate-200'}`}><Skull size={11} className="shrink-0"/><span className="max-w-[34vw] truncate">{enemy.name}</span><span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] text-white font-bold border ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}</span>{iceLockTurns>0&&<span data-ice-lock-status className="shrink-0 px-1 py-0.5 rounded-full border border-cyan-400/60 bg-cyan-950/80 text-[10px] not-italic tracking-tighter whitespace-nowrap text-cyan-100">❄️絶氷 {iceLockPreparing?'準備':<>{iceLockTurns}T　⬇30%</>}</span>}</span>
              <span className="text-red-500 flex items-center gap-1 font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span>
            </div>
            {/* 敵のライフ(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
                ★細い線だったものを、ガラスの筒に色が入っているように見せる。
                  中身は上から下へ暗くなる縦のグラデーション、筒の上半分に白い照りを重ねる。
                ★太くしたのは4pxだけ。ここは敵の名前と同じ帯なので、伸ばすと舞台が縮む */}
            <div className="relative h-[14px] overflow-hidden rounded-full border-2 border-white/25 bg-slate-950" style={{boxShadow:'inset 0 2px 6px rgba(0,0,0,.85)'}}>
              <div className="h-full transition-all duration-1000" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`,backgroundImage:'linear-gradient(180deg,#fca5a5 0%,#ef4444 38%,#b91c1c 72%,#7f1d1d 100%)'}}></div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{background:'linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,0))'}}></div>
            </div>
          </div>
        )}
        {/* 敵の舞台。中身は敵の絵ひとつだけなので真ん中に置く。
            強化の札が増えて舞台が絵より低くなったときは、safe が上そろえへ戻してくれる
            (中央のままだと上へスクロールできず、頭の「!」や技名が読めなくなる)。
            safe を知らないブラウザは宣言ごと捨てるので、クラスの justify-start が残る */}
        <main className="flex-1 relative flex flex-col items-center justify-start pt-3 pb-1 px-2 overflow-x-visible overflow-y-auto min-h-0" style={{justifyContent:'safe center'}}>
          {/* 敵のまわりのボタンは左の1列にまとめる(2026-09-22 ユーザー指示
              「敵周りのボタンを整理したほうがいい。添付イメージ画像のように左にきれいに並べるなど」)。
              ★もとは左(ステータス・緊急)と右(解析・ログ・魂格効果)に分かれていて、敵の絵を両側から
                削っていた。片側へ寄せると**右がまるごと空く**ので、そこへ敵の行動予告を置ける。
              ★並びは今までの左の順(ステータス→緊急)を先に置き、右にあった2つをその下へ足す。
                指が覚えている場所をできるだけ動かさない。
              ★幅と高さはそろえるが、色は役割ごとに残す(青=勇者/緊急、赤=敵を見る、琥珀=記録)。
                全部同じ色にすると、とっさに押し分けられなくなる。
              ★**折り返さない。1列のまま。** 狭い端末で入り切らないぶんを2列へ回したことがあるが、
                2列目がモンスターの絵に重なった(2026-09-22 ユーザー指摘「2列折り返しで
                モンスターにかぶってるのは論外」)。絵に何かを重ねるのは無し。
                入らないのは舞台そのものが低いからなので、**直すのは画面の縦の使い方**であって、
                ボタンの並べ方ではない(行動予告を右へ出す・味方の段をまとめる、で縦を作る) */}
          {/* 敵のまわりの入口は、1列に積まず**舞台の四隅**へ置く(2026-09-22 ユーザー指示
              「解析ボタンを右欄に置けばいい」「ログは左上」「ステータスは左エリアの
              バフ帯の上に置くとかがよさそう」)。
              ★1列に積むと、舞台が低い端末で下のほうが表示から外れる。四隅なら舞台の高さが
                変わっても、上の2つは上に、下の2つは下に貼り付いたままになる。
              ★下の2つは舞台の下端(bottom-1)。舞台の外にある間合いバーや強化の札とは重ならない。
              ★右は上が「解析」、下が敵の行動予測。どちらも敵を読むためのものなので同じ側へ寄せた。
              ★幅と高さはそろえるが、色は役割ごとに残す(青=勇者、赤=敵を見る、琥珀=記録)。
                全部同じ色にすると、とっさに押し分けられなくなる */}
          <button data-battle-log-button type="button" onClick={()=>setShowBattleLog(true)} aria-label="バトルの記録を見る" title="バトルの記録" className="absolute left-2 top-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><BookOpen size={17} className="text-amber-300"/><span className="text-[10px] font-black leading-none text-white">ログ</span></button>
          <button onClick={()=>setShowHeroInfo(true)} aria-label="勇者モンのステータス" className={`absolute left-2 bottom-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95${battleTutorialSpotClass('heroStatus')}`} style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Crown size={17} className="text-indigo-300"/><span className="text-[10px] font-black leading-none text-white">ステータス</span></button>
          <button onClick={()=>setShowEnemyInfo(true)} aria-label="敵を解析する" className="absolute right-2 top-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Search size={17} className="text-red-300"/><span className="text-[10px] font-black leading-none text-white">解析</span></button>
          {battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&<button data-soul-battle-effects-button type="button" onClick={()=>setShowSoulBattleEffects(true)} aria-label="魂格効果" className="absolute right-2 top-[56px] z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Sparkles size={17} className="text-sky-300"/><span className="text-[10px] font-black leading-none text-white">魂格効果</span></button>}
          {/* 敵が次に何をしてくるかの札(2026-09-19・ユーザー指摘「敵の行動予測が見えない」)。
              ★置き場所は**敵の絵の右下**(2026-09-22 ユーザー指示「敵の行動予測は右下に出るほうが
                良くない？ ただバフ帯と被らないように」)。舞台の下端に貼るので、舞台の外にある
                強化の札とは重ならない。右の上には「解析」が居る。もとは絵の下に帯として出していたが、丸1本へ技名・連撃数・
                狙われた子・予想ダメージを詰め込んでいたので、長い技名だと溢れていた。
                行を分けると、読む順(何をしてくる→だれに→いくつ減る)がそのまま縦に並ぶ。
              ★帯をやめたぶん**画面の縦が25px空く**。間合いバーで使ったぶんをここで返す。
              ★絶対位置で置く。フローに置くと、絵が大きい場面で main(overflow-y-auto)の
                外へ押し出されて消える(2026-09-18 に出した不具合)。絶対位置なら押し出されない。
              ★data-enemy-intent は検査の手がかり。どの行動が予告されているかは抽選なので、
                画面の文字から探すと「今回はためるだった」で落ちる */}
          {enemy&&enemyIntent&&!isBusy&&(()=>{
            // ためる・待機・移動はダメージが無いので「予測」を出さない。
            // 出すと必ず0になり、ガードを構える判断の邪魔になる
            // 新モードは「狙われた子の丈夫さ」で受け、「その子が構えたガード」だけが効く。
            // ★targetSlot が無いモードでは今までどおりパーティの値で出る
            const aimedSlot=coverActive?tacticsCoverSlot:(Number.isInteger(enemyIntent.targetSlot)?enemyIntent.targetSlot:null);
            const rawDmg=getIncomingDamageBeforeTurnReduction(enemyIntent,aimedSlot);
            // ★数え方は plannedDamageFor に1か所だけ置く(枠ごとの表示と同じ関数を通す)。
            //   2か所に書くと、ガードの数え方を直したときに片方だけ古くなる
            const plannedHit=plannedHitWithCover(aimedSlot);
            const plannedDmg=plannedHit.taken;
            // 連撃は「129・130」と1発ずつ。1発の技は今までどおり数字ひとつ
            const plannedText=plannedHit.parts.join('・');
            // ★連撃は1発ずつ並べると合計がどこにも出ない(2026-09-22 ユーザー指摘「連撃ダメージで
            //   合計ダメージと軽減後の合計ダメージがないといくつくらうかわからない」)。
            //   ガードやターン軽減が効いていれば「軽減前→軽減後」で、効き目もそのまま読める
            const plannedTotalText=plannedHit.raw>plannedDmg?`${plannedHit.raw}→${plannedDmg}`:`${plannedDmg}`;
            // ★全体攻撃は受ける量が1体ずつ違う。1つの数字にまとめると、
            //   どの子がどれだけ減るのか分からなくなるので、吹き出しには出さず枠ごとに出す
            // かばっているターンは受けるのが1体だけなので、全体攻撃でも吹き出しに出せる
            const showPlannedInBubble=coverActive||!enemyIntent.targetsAll;
            // ★再生も「いくつ戻るか」を数字で出す(2026-09-22 ユーザー指示「敵の回復時で
            //   いくつ回復するかも数値を予測で出してほしい」)。ダメージだけ数字が出て、
            //   回復は「回復」としか出ないので、あと何ターンで削り切れるかが読めなかった。
            //   数えるのは tacticsRegenHealAmount ひとつだけ。実際に回復する量と同じ式を通す
            //   (満タンで頭打ちになるぶんは敵のライフしだいなので、ここは振り込む量を出す)
            const regenHeal=enemyIntent.type==='REGEN'?tacticsRegenHealAmount(enemy?.maxHp):0;
            const tone=enemyIntent.type==='SPECIAL'?'bg-fuchsia-950 border-fuchsia-500 text-fuchsia-300'
              :enemyIntent.type==='CHARGE'?'bg-amber-950 border-amber-500 text-amber-400'
              :enemyIntent.type==='PIERCE_CHARGE'?'bg-rose-950 border-rose-500 text-rose-300'
              :enemyIntent.type==='MOVE'?'bg-cyan-950 border-cyan-500/60 text-cyan-300'
              // ★再生だけは赤にしない。こちらが減るのではなく敵が戻る数字なので、
              //   右上の吹き出し(noticeHeal)と同じ緑にそろえて取り違えを防ぐ
              :enemyIntent.type==='REGEN'?'bg-emerald-950 border-emerald-500/60 text-emerald-300'
              :'bg-red-950 border-red-600/50 text-red-400';
            // 敵の絵のすぐ下へ置く(2026-09-18・ユーザー依頼)。mt-auto で下端へ押しやっていたため、
            // 絵と「次に何をしてくるか」のあいだに200pxほどの空きができ、視線が大きく動いていた。
            // 余りの高さは、この下のバフ帯の mt-auto がまとめて吸う。
            // ★ためるだけは、敵ごとの技名を持たないので label が「必殺技の準備をしている」という
            //   説明文になり、右上の吹き出しの「必殺技準備」を長く言い直しただけになっていた
            //   (2026-09-22 ユーザー指摘「他のにならってやると攻撃予測のとこをためるにして
            //   吹き出しを必殺技準備が正解なはず」)。ほかの行動にならって短い呼び名にそろえる。
            // ★貫通の構えは敵ごとに「◯◯の構え」という名前が付くので、label のままにする。
            // ★何連撃かはここへ書かない。右上の吹き出しが「3連撃！」と出す側で、
            //   両方に書くと同じことを2回言ううえ、札の幅(100px)で名前が2行に折り返す
            const intentTitle=enemyIntent.type==='CHARGE'&&enemyIntent.category?enemyIntent.category:enemyIntent.label;
            return (
              <div data-enemy-intent
                className={`absolute right-2 bottom-1 z-[45] w-[100px] rounded-xl border px-1.5 py-1 shadow-lg animate-pulse${battleTutorialSpotClass('enemyIntent')} ${focusedCard&&!tacticsDebugLayout?'invisible':'visible'} ${tone}`}>
                <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider opacity-80"><Target size={9}/>次の行動</div>
                <div className="mt-0.5 text-[11px] font-black leading-tight">{intentTitle}</div>
                {aimedName?<div className="mt-0.5 truncate text-[9px] font-bold leading-none opacity-90">🎯{aimedName}</div>:null}
                {rawDmg>0&&showPlannedInBubble&&plannedText?(
                  <div className="mt-1 rounded bg-black/55 px-1 py-1 text-center leading-none">
                    <div className="text-[12px] font-black tabular-nums">{plannedTotalText}</div>
                    {plannedHit.parts.length>1?<div className="mt-0.5 text-[9px] font-bold tabular-nums text-white/80">{plannedText}</div>:null}
                  </div>
                ):null}
                {regenHeal>0?(
                  <div data-enemy-regen-heal={regenHeal} className="mt-1 rounded bg-black/55 px-1 py-1 text-center leading-none">
                    <div className="text-[12px] font-black tabular-nums text-emerald-300">+{regenHeal}</div>
                    <div className="mt-0.5 text-[9px] font-bold leading-none text-emerald-200/80">敵が回復</div>
                  </div>
                ):null}
              </div>
            );
          })()}
          {turnCount===1&&battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&!isBusy&&<div data-soul-battle-start-summary className="absolute left-1/2 top-2 -translate-x-1/2 z-10 max-w-[62%] truncate rounded-full border border-sky-400/30 bg-sky-950/75 px-2 py-1 text-[10px] font-black text-sky-100 pointer-events-none">魂格効果 発動中{Math.round(soulBattleParty.damageReduction*10)/10>0?` ・鉄壁${(Math.round(soulBattleParty.damageReduction*10)/10)}%`:''}{unifiedSpecialDefense.rate>0?` ・特殊防御${(Math.round(unifiedSpecialDefense.rate*10)/10)}%`:''}{battleIntimidate>0?` ・威圧${(Math.round(battleIntimidate*10)/10)}%`:''}{soulCoordinationCardBonus>0?' ・カード+1':''}</div>}
          <div className="mt-1 relative flex flex-col items-center">
            {enemySkillName&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{top:'14%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className="px-4 py-1.5 rounded-xl font-black text-[13px] bg-red-700 border-2 border-red-200 text-white shadow-[0_2px_16px_rgba(0,0,0,0.9)] flex items-center gap-2"><span>{cardIconNode(enemySkillName.icon,16)}</span>{enemySkillName.label}</div>
              </div>
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='SPECIAL'&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 500ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(217,70,239,1)]">☠️</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-900 via-fuchsia-700 to-purple-900 border-2 border-fuchsia-300 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(217,70,239,0.9)]">必 殺 技</div>
              </div>
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='CHARGE'&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 700ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(251,191,36,1)]">✨</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-900 via-amber-600 to-amber-900 border-2 border-amber-200 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(251,191,36,0.9)]">た め る</div>
              </div>
            )}
            {/* 貫通技準備。ためると同じ大きさで出す。ガードが効かない技が次に確定で来るので、
                「ガードを固めても無駄」と1ターン早く分かるようにする(2026-09-21 ユーザー指示)。
                色はためる(琥珀)と分けて、貫通撃と同じ赤系にする。
                ★呼び名は「貫通の構え」から変えた(2026-09-22 ユーザー指示「吹き出しは
                貫通技準備とかがいいかな？」)。予告の帯には敵ごとの技名(「◯◯の構え」)が
                出るので、そこへ種別の「構え」を重ねると同じ言葉が2つ並んで読みにくかった */}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='PIERCE_CHARGE'&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 700ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(244,63,94,1)]">⚔️</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-rose-900 via-rose-600 to-rose-900 border-2 border-rose-200 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(244,63,94,0.9)]">貫 通 技 準 備</div>
              </div>
            )}
            {/* 移動の予告。いま出ている行動予告(通常攻撃など)と同時に、
                「その次のターンに間合いを変える」ことを敵のつぶやきとして見せる。
                出す間合いは enemyNextIntent.targetDist そのもので、繰り上げても抽選し直さないため、
                吹き出しに出た間合いへ必ず動く。
                【置き場所】丸枠(敵の円)の中には置かないこと。丸枠は transform を持つため
                独自の重ね順の島になり、いくらz-indexを上げても、枠の外へ巨大に描くムーの
                裏へ回ってしまう。必殺技の警告と同じこの階層に置くと前面に出る */}
            {enemy&&enemyNextIntent&&!isBusy&&!enemyAttackFx&&enemyNextIntent.type==='MOVE'&&(
              // 画面ではなく遊ぶ列(最大600px)の右端に寄せる。left:50%から
              // 「列の半分ぶん右へ、自分の幅だけ左へ」動かすと、広い画面でも列の中に収まる
              <div className="fixed left-1/2 pointer-events-none" style={{top:'22%',transform:'translateX(calc(min(50vw, 300px) - 100% - 8px))',zIndex:65000}}>
                <div className="mh-enemy-move-hint">
                  <span aria-hidden="true">🏃</span>
                  <span>{RANGE_LABELS[enemyNextIntent.targetDist]}距離に移動しようとしている…？</span>
                </div>
              </div>
            )}
            {slotSkill&&(
              <div className="fixed -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{left:`${12.5+slotSkill.slotIndex*25}%`,bottom:'30%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className={`px-3 py-1 rounded-xl font-black text-[12px] border-2 shadow-[0_2px_16px_rgba(0,0,0,0.9)] ${slotSkill.type==='unique'?'bg-purple-700 border-purple-200 text-white drop-shadow-[0_0_10px_rgba(217,70,239,0.9)]':slotSkill.type==='special'?'bg-amber-600 border-amber-200 text-white':'bg-red-700 border-red-200 text-white'}`}>{slotSkill.name}</div>
              </div>
            )}
            {!ecoBattleView&&guardFx&&(
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:64000}}>
                <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                  <div className="text-[120px] drop-shadow-[0_0_30px_rgba(56,189,248,1)]">🛡️</div>
                </div>
                {[0,1,2,3,4,5].map(k=>(
                  <div key={k} className="absolute" style={{transform:`rotate(${k*60}deg)`}}>
                    <div className="rounded-full border-4 border-cyan-200" style={{width:'36px',height:'36px',animation:`guardSpark 500ms ease-out ${k*25}ms forwards`}}></div>
                  </div>
                ))}
                <div className="absolute font-black text-cyan-100 text-4xl tracking-widest drop-shadow-[0_0_16px_rgba(56,189,248,1)]" style={{top:'34%',animation:'guardShine 550ms ease-out forwards'}}>キーン!</div>
                <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.5) 0%, rgba(56,189,248,0.3) 20%, rgba(0,0,0,0) 45%)',animation:'guardFlash 350ms ease-out forwards'}}></div>
              </div>
            )}
            {!ecoBattleView&&teachingFx&&TEACHING_FX_STYLE[teachingFx.id]&&(()=>{
              const fx=TEACHING_FX_STYLE[teachingFx.id];
              return (
                <div key={teachingFx.fxId} className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:63000}}>
                  <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                    <div className="text-[110px] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">{cardIconNode(fx.icon,110)}</div>
                  </div>
                  {[0,1,2,3,4,5,6,7].map(k=>(
                    <div key={k} className="absolute" style={{transform:`rotate(${k*45}deg)`}}>
                      <div className={`rounded-full border-4 ${fx.ring}`} style={{width:'30px',height:'30px',animation:`guardSpark 550ms ease-out ${k*20}ms forwards`}}></div>
                    </div>
                  ))}
                  <div className={`absolute font-black text-3xl tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${fx.text}`} style={{top:'32%',animation:'guardShine 550ms ease-out forwards'}}>{fx.label}</div>
                  <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 45%, rgba(${fx.rgb},0.5) 0%, rgba(${fx.rgb},0.25) 22%, rgba(0,0,0,0) 48%)`,animation:'guardFlash 400ms ease-out forwards'}}></div>
                </div>
              );
            })()}
            {isMooBoss(enemy?.id)&&enemy?.imgUrl&&(
              <div className="fixed left-1/2 pointer-events-none flex items-center justify-center" style={{top:'30%',transform:'translate(-50%,-50%)',zIndex:focusedCard?5:30,width:'min(108vw,560px)',height:'min(108vw,560px)'}}>
                <img src={enemy.imgUrl} alt={enemy?.name||"ムー"} style={{width:'100%',height:'100%',animation:liteBattleView?undefined:(enemyAttackAnim?(enemyAttackFx?.kind==='move'?'mooMoveSlide 1000ms ease-in-out forwards':enemyAttackFx?.kind==='charge'?'mooChargeGather 1100ms ease-in-out forwards':'mooAttackLunge 900ms ease-in-out forwards'):'mooFloat 3000ms ease-in-out infinite'),imageRendering:'auto',WebkitMaskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)',maskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)'}} className={`relative z-[1] object-contain drop-shadow-[0_0_55px_rgba(168,85,247,0.95)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/>
              </div>
            )}
            {/* ムー攻撃時: 全画面の破壊的演出 */}
            {!ecoBattleView&&isMooBoss(enemy?.id)&&enemyAttackFx?.kind==='moo'&&(
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{zIndex:25}}>
                <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 34%, rgba(168,85,247,0.55) 0%, rgba(239,68,68,0.4) 30%, rgba(251,191,36,0.25) 48%, rgba(0,0,0,0) 70%)', animation:'auraPulse 450ms ease-out infinite'}}></div>
                <div className="absolute inset-0" style={{animation:'specialFlash 400ms ease-out infinite', background:'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.45) 0%, rgba(168,85,247,0.15) 35%, rgba(255,255,255,0) 60%)'}}></div>
                <div className="absolute" style={{top:'34%',left:'50%',transform:'translate(-50%,-50%)',width:'min(120vw,640px)',height:'min(120vw,640px)'}}>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute left-1/2 top-1/2 text-5xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-42vw)`, animation:'sparkFlicker 240ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-purple-300/80" style={{animation:'auraRing 500ms ease-out infinite'}}></div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-500/60" style={{animation:'auraRing 650ms ease-out 120ms infinite'}}></div>
                </div>
              </div>
            )}
            {/* ★ムーの札だけは丸枠(敵の円)の外へ出す。丸枠には間合いごとの光り方
                (RANGE_STYLES の drop-shadow ＝ CSSの filter)が掛かっていて、transform と同じく
                **独自の重ね順の島**を作る。島の中に置くと z-index をいくつ上げても、枠の外へ
                巨大に描くムーの立ち絵(z-30)の裏へ回ってしまう
                (2026-09-22 ユーザー指摘「吹き出しが裏に回ってる」。同じ原因で3回目)。
                必殺技の警告・移動の予告と同じこの階層＝丸枠の外なら前面に出る。
                寄せ先は画面の右端ではなく遊ぶ列(最大600px)の右端にして、広い画面でも列に収める */}
            {enemyNoticeShown&&isMooBoss(enemy?.id)&&(
              <div data-enemy-notice-moo className="fixed left-1/2 pointer-events-none"
                style={{top:'max(112px,16dvh)',transform:'translateX(calc(min(50vw, 300px) - 100% - 6px))',zIndex:focusedCard?5:40}}>
                {enemyNoticeCard()}
              </div>
            )}
            {/* 行動予測ラベルはmain下部に移動 */}
            <div className={`rounded-full transition-all duration-500 border-4 relative bg-black/35 ${RANGE_STYLES[enemyDist].border} ${RANGE_STYLES[enemyDist].shadow} ${RANGE_STYLES[enemyDist].glow} shadow-[0_0_50px]`} style={enemyAttackAnim&&!ecoBattleView?{padding:'clamp(6px,1.5dvh,16px)',animation:(enemyAttackFx?.kind==='move'?(isMooBoss(enemy?.id)?'enemyMoveSlideMoo 1000ms ease-in-out forwards':'enemyMoveSlide 1000ms ease-in-out forwards'):enemyAttackFx?.kind==='charge'?'enemyChargeShake 1100ms ease-in-out forwards':'enemyAttackFly 450ms ease-in forwards'), ...(isMooBoss(enemy?.id)&&enemyAttackFx?.kind!=='move'?{top:'3dvh'}:{}),...(!isMooBoss(enemy?.id)&&enemyAttackFx?.kind!=='move'?{zIndex:9999}:{})}:{padding:'clamp(6px,1.5dvh,16px)',...(isMooBoss(enemy?.id)?{top:'3dvh'}:{})}}>
              {/* 足元の影(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
                  丸枠の塗りを落としたぶん、影が無いと宙に浮いて見える。絵(z-[1])より下へ敷く。
                  ★丸枠は transform を持つので重ね順の島になる。この中に置けば絵の下に必ず入る */}
              {!ecoBattleView&&<div aria-hidden="true" className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2" style={{bottom:'11%',width:'64%',height:'13%',borderRadius:'50%',background:'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.62) 0%, rgba(0,0,0,.28) 52%, rgba(0,0,0,0) 76%)'}}></div>}
              {enemy?.imgUrl?(isMooBoss(enemy?.id)?<div style={{width:'clamp(92px,16dvh,142px)',height:'clamp(86px,15dvh,132px)'}}/>:<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'clamp(92px,16dvh,142px)',height:'clamp(86px,15dvh,132px)'}}><img src={enemy.imgUrl} alt={enemy?.name} className={`relative z-[1] w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/></span>):(<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''}><div style={{fontSize:'clamp(58px,10.5dvh,96px)',lineHeight:1}} className={`relative z-[1] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}>{enemy?.emoji}</div></span>)}
              {/* ラスボス・ムー: 丸枠内は台座オーラのみ（本体は枠外に巨大表示） */}
              {!ecoBattleView&&isMooBoss(enemy?.id)&&(
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible" style={{zIndex:1}}>
                  <div className="absolute -inset-8 rounded-full" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(139,0,139,0.32) 45%, rgba(0,0,0,0) 72%)', animation:'auraPulse 1500ms ease-in-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-2 border-purple-500/60" style={{animation:'idleAuraPulse 1700ms ease-in-out infinite'}}></div>
                </div>
              )}
              {/* Move: dash effect with motion marks */}
              {!ecoBattleView&&enemyAttackFx?.kind==='move'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-2 rounded-full border-4 border-cyan-300/80" style={{animation:'shockRing 600ms ease-out forwards'}}></div>
                  <div className="absolute -inset-5 rounded-full border-2 border-sky-400/50" style={{animation:'shockRing 600ms ease-out 100ms forwards'}}></div>
                  <div className="absolute text-5xl drop-shadow-[0_0_14px_rgba(34,211,238,1)]" style={{animation:'moveDash 700ms ease-in-out forwards'}}>💨</div>
                  <div className="absolute -top-3 text-4xl font-black text-cyan-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 600ms cubic-bezier(.2,1.4,.4,1) forwards'}}>🏃</div>
                </div>
              )}
              {/* Normal attack: surprised exclamation burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='normal'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center" style={{animation:'enemyExclaim 500ms ease-out forwards'}}>
                  <div className="absolute -top-3 -right-2 text-5xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 500ms cubic-bezier(.2,1.4,.4,1) forwards'}}>❗</div>
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-300/80" style={{animation:'shockRing 500ms ease-out forwards'}}></div>
                </div>
              )}
              {/* Special attack: crackling aura + lightning burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='special'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(239,68,68,0.45) 40%, rgba(168,85,247,0.25) 60%, rgba(0,0,0,0) 75%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-4 border-amber-300" style={{animation:'auraRing 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-8 rounded-full border-2 border-red-500/70" style={{animation:'auraRing 700ms ease-out 120ms infinite'}}></div>
                  <div className="absolute -inset-12 rounded-full border-2 border-purple-500/50" style={{animation:'auraRing 800ms ease-out 240ms infinite'}}></div>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute text-3xl" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'sparkFlicker 300ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute text-7xl drop-shadow-[0_0_24px_rgba(251,191,36,1)]" style={{animation:'specialThrob 500ms ease-in-out infinite'}}>🔥</div>
                  <div className="absolute inset-0 rounded-full" style={{animation:'specialFlash 600ms ease-out infinite', background:'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)'}}></div>
                </div>
              )}
              {/* MOO (last boss): catastrophic aura + lightning storm */}
              {/* IDLE telegraph (player's turn): show what the enemy is about to do. Hidden while an attack is actually firing. */}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='ATTACK'&&!Array.isArray(tacticsUnits)&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center">
                  <div className="absolute -top-2 -right-1 text-4xl font-black text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style={{animation:'idleExclaim 1100ms ease-in-out infinite'}}>❗</div>
                </div>
              )}
              {/* ★何をする技かを、敵の絵の右上へ出す(2026-09-22 ユーザー指示「右上に必殺技！
                  みたいに吹き出し出せばいい。3連撃！とか」)。タクティクスの敵は技に固有の名前が
                  付いているので、名前だけでは連撃なのか回復なのか覚えられない。
                  予告が出ているあいだずっと見えるようにする(❗はこの札に置き換える)。
                  ★ムーだけはここへ置けない(丸枠の外へ出してある。少し上の data-enemy-notice-moo) */}
              {enemyNoticeShown&&!isMooBoss(enemy?.id)&&(
                <div className="absolute inset-0 pointer-events-none z-[9000]">
                  <div className="absolute -top-3 -right-2">{enemyNoticeCard()}</div>
                </div>
              )}
              {/* ためている最中は、敵の周りにオーラが集まる */}
              {!ecoBattleView&&enemy&&enemyAttackFx?.kind==='charge'&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-6 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0.2) 45%, rgba(0,0,0,0) 70%)', animation:'auraPulse 700ms ease-out infinite'}}></div>
                  {[0,1,2,3,4,5,6,7].map(k=>(
                    <div key={k} className="absolute text-2xl" style={{'--deg':`${k*45}deg`, animation:`chargeGather 900ms ease-in ${k*70}ms infinite`}}>✨</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-amber-300/80" style={{animation:'auraRing 700ms ease-out infinite'}}></div>
                </div>
              )}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&(enemyIntent.type==='SPECIAL'||(isMooBoss(enemy?.id)&&enemyIntent.type==='ATTACK'))&&(()=>{
                // ためる(CHARGE)の予告にはこのオーラを出さない。必殺技の予告と同じ見た目になり、
                // 「準備なのか、いま撃たれるのか」が見分けられなくなるため
                const isSpecial = enemyIntent.type==='SPECIAL';
                // 通常技 = 赤系 / 必殺技(チャージ) = 紫＋金系 で明確に色分け
                return (
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  {isSpecial ? (
                    <>
                      {/* 全画面の危険ビネット(画面端が赤紫に脈動) */}
                      <div className="fixed inset-0 pointer-events-none" style={{position:'fixed',inset:0,zIndex:85000,background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(168,85,247,0.25) 72%, rgba(127,29,29,0.55) 100%)', animation:'specialDangerPulse 700ms ease-in-out infinite'}}></div>
                      {/* 拡大する衝撃波リング(複数) */}
                      <div className="absolute -inset-8 rounded-full border-4 border-fuchsia-400/80" style={{animation:'specialShockwave 1400ms ease-out infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-purple-300/70" style={{animation:'specialShockwave 1400ms ease-out 466ms infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-amber-300/60" style={{animation:'specialShockwave 1400ms ease-out 933ms infinite'}}></div>
                      {/* 内側の脈動オーラ */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(217,70,239,0.6) 0%, rgba(168,85,247,0.45) 38%, rgba(251,191,36,0.3) 62%, rgba(0,0,0,0) 82%)', animation:'specialWarnFlash 600ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-3 rounded-full border-[3px] border-fuchsia-300" style={{animation:'specialWarnFlash 600ms ease-in-out infinite', boxShadow:'0 0 30px rgba(217,70,239,0.9), inset 0 0 30px rgba(217,70,239,0.7)'}}></div>
                      {/* 回転する危険スパーク */}
                      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_12px_rgba(217,70,239,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'idleSpark 600ms ease-in-out infinite', animationDelay:`${deg*1.5}ms`}}>⚡</div>
                      ))}
                      {/* 必殺技バナーは敵コンテナ直下(fixed)に移動済み */}
                    </>
                  ) : (
                    <>
                      {/* 通常技: 赤系のシンプルな警告 */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(239,68,68,0.45) 0%, rgba(220,38,38,0.32) 42%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-4 rounded-full border-2 border-red-500/90" style={{animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-7 rounded-full border-2 border-orange-500/60" style={{animation:'idleAuraPulse 1300ms ease-in-out 120ms infinite'}}></div>
                      {[0,45,90,135,180,225,270,315].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-96px, -12dvh, -60px))`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                      <div className="absolute -top-3 text-3xl drop-shadow-[0_0_12px_rgba(239,68,68,1)]" style={{animation:'idleExclaim 900ms ease-in-out infinite'}}>❗</div>
                    </>
                  )}
                </div>
                );
              })()}
            </div>
            {getTurnBuff('stunEnemy',false)&&<div className="absolute inset-0 flex items-center justify-center text-3xl bg-indigo-500/20 rounded-full border-4 border-indigo-500 animate-pulse">💫</div>}
            {(() => {
    const enemyPopups=popups.filter(p=>p.side==='enemy');
    const wrapEnemyPopups=!liteBattleView&&enemyPopups.length>4;
    const popupColumns=wrapEnemyPopups?Math.ceil(enemyPopups.length/4):1;
    const popupGridStyle=wrapEnemyPopups?{
      display:'grid',
      gridAutoFlow:'column',
      gridTemplateRows:'repeat(4, auto)',
      gridAutoColumns:'max-content',
      justifyContent:'center',
      alignContent:'start',
      columnGap:popupColumns>=3?'0px':'4px',
      rowGap:'2px',
      paddingTop:'4px'
    }:undefined;
    const compactPopupStyle=wrapEnemyPopups?{
      fontSize:popupColumns>=3?'clamp(1.4rem, 5.8vw, 1.85rem)':'clamp(1.75rem, 7.5vw, 2.25rem)',
      lineHeight:1.05,
      paddingLeft:'2px',
      paddingRight:'2px'
    }:undefined;
    return (
      <div className={`absolute inset-0 z-50 pointer-events-none ${wrapEnemyPopups?'':'flex flex-col items-center justify-start pt-1 gap-0.5'}`} style={popupGridStyle}>
        {enemyPopups.map(p=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} style={compactPopupStyle} className={`text-center ${p.color} font-black whitespace-nowrap px-4 ${liteBattleView?'rounded-lg border border-white/20 bg-slate-950/95 py-1 text-base':'drop-shadow-[0_0_15px_rgba(0,0,0,1)]'}`}>{p.text}</div>))}
      </div>
    );
  })()}
          </div>
          {/* 技詳細パネルはmain外(画面直下)に移動して、ムー画像と同階層でz-index勝負させる */}
        </main>
        {/* 間合いバー(2026-09-22 ユーザー依頼「タクティクスバトルのUIレイアウトを良くしたい」)。
            ★このモードの核は「敵と自分がどの間合いにいるか」なのに、敵の間合いは名前の横のバッジ、
              味方の間合いは枠の下のラベルと、離れた2か所を見比べないと分からなかった。
            ★置き場所は敵の絵の下の空き。main(flex-1)が縮むぶんを使うので、画面の縦は1pxも増えない。
            ★列は下の味方の枠と同じ4分割にそろえる。真下の枠がその間合いの子になるので、
              線の上の位置と枠が目で結びつく。
            ★移動の予告が出ているときは、動く先を点線の印で同じ線の上に出す。
              「次のターンに間合いが変わる」が、吹き出しを読まなくても分かる */}
        {!tacticsDebugLayout&&Array.isArray(tacticsUnits)&&enemy&&(()=>{
          const moveTo=enemyNextIntent&&enemyNextIntent.type==='MOVE'&&Number.isFinite(enemyNextIntent.targetDist)
            ?enemyNextIntent.targetDist:null;
          const here=Number.isFinite(enemyDist)?enemyDist:0;
          return (
            <div data-tactics-range-bar={here} data-tactics-range-move={moveTo!=null?String(moveTo):undefined}
              className={`shrink-0 w-full px-2 pt-1 pb-0.5 bg-slate-950 ${focusedCard?'invisible':'visible'}`}>
              <div className="relative grid grid-cols-4 gap-1">
                {/* 軸の線。印は各列の真ん中に立つので、線も列の中心から中心までで止める */}
                <div aria-hidden="true" className="pointer-events-none absolute top-[28px] h-[3px] rounded-full"
                  style={{left:'12.5%',right:'12.5%',background:'linear-gradient(to right,#ef4444,#eab308,#10b981,#3b82f6)',
                    boxShadow:'0 0 8px rgba(120,160,255,.45)'}}></div>
                {/* 両端の矢印。零から遠まで一本の軸が続いていることを示す(2026-09-22 ユーザー指示) */}
                <div aria-hidden="true" className="pointer-events-none absolute text-[11px] font-black leading-none text-red-400" style={{top:'24px',left:'calc(12.5% - 13px)'}}>◀</div>
                <div aria-hidden="true" className="pointer-events-none absolute text-[11px] font-black leading-none text-blue-400" style={{top:'24px',right:'calc(12.5% - 13px)'}}>▶</div>
                {[0,1,2,3].map(i=>{
                  const unit=tacticsUnits[i];
                  const there=!!unit&&!unit.downed;
                  const isHere=here===i;
                  const isMove=moveTo===i&&!isHere;
                  return (
                    <div key={i} data-tactics-range-cell={i} data-tactics-range-enemy={isHere?'true':undefined}
                      data-tactics-range-ally={there?'true':undefined}
                      className="relative flex flex-col items-center">
                      {/* 敵の顔。いまいる間合いは実線の枠、次に動く先は点線の枠で出す。
                          ★枠の色は間合いの色ではなく**赤で固定**する。間合いの色にすると、
                            すぐ下の味方の印と同じ色になり、どちらが敵か形でしか分からなくなる */}
                      <div className="relative h-[22px] flex items-end justify-center">
                        {(isHere||isMove)&&(
                          <div className={`flex items-center justify-center rounded-full border ${isHere
                            ?'h-[20px] w-[20px] border-red-400 bg-black/75 shadow-[0_0_8px_rgba(239,68,68,.65)]'
                            :'h-[18px] w-[18px] border-dashed border-cyan-400/70 bg-black/40 opacity-70'}`}>
                            {enemy.imgUrl
                              ?<img src={enemy.imgUrl} alt="" className="h-[14px] w-[14px] object-contain"/>
                              :<Skull size={11} className="text-red-300"/>}
                          </div>
                        )}
                        {/* 動く向きの矢印(2026-09-22 ユーザー指示「移動予告は矢印表記も足したいね」)。
                            ★点線の丸だけでは「予定」とは読めても、どちらから来るのかが分からなかった。
                            ★矢印は**来る側**の脇に出す。右へ動くなら丸の左に「→」が立つので、
                              いまいる間合いから移動先へ視線がそのまま流れる */}
                        {isMove&&(
                          <span aria-hidden="true"
                            className={`absolute bottom-[3px] animate-pulse text-[12px] font-black leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,.9)] ${moveTo>here?'right-full mr-[1px]':'left-full ml-[1px]'}`}>
                            {moveTo>here?'→':'←'}
                          </span>
                        )}
                      </div>
                      {/* 目盛り。立っている子がいる間合いは塗り、空き・倒れている間合いは抜きで出す */}
                      <div className={`mt-[3px] h-[8px] w-[8px] rotate-45 rounded-[1px] border ${there
                        ?`${RANGE_STYLES[i].border} ${RANGE_STYLES[i].labelBg}`
                        :'border-white/25 bg-slate-900'}`}></div>
                      {/* 間合いの名前。立っている子がいる間合いだけ塗りのバッジにする。
                          ★字の色を間合いの色にすると、零(赤)が敵の赤い光に埋もれて読めなかった。
                            下の枠のラベルと同じ「塗り＋白字」にそろえる */}
                      <span className={`mt-[2px] rounded px-1.5 text-[13px] font-black leading-[16px] ${there
                        ?`${RANGE_STYLES[i].labelBg} text-white shadow-[0_0_10px_rgba(0,0,0,.6)]`
                        :'text-slate-500'}`}>
                        {RANGE_LABELS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* 強化の札(2026-09-19・ユーザー指摘「バフデバフ欄が見にくくなってる」)。
            もとは敵のいる main の中に置いていたが、main は overflow-y-auto なので、
            強化が増えて札が2行3行になると表示の外へ押し出され、下の味方バーに隠れて読めなくなっていた。
            main の外へ出し、味方バーのすぐ上に置く。これで札が何行になっても必ず見える。 */}
          {(()=>{
            // 強化の札(2026-09-20 ユーザー指摘「バフ欄が増えてくると敵や緊急回復等が見えなくなる」)。
            // ★もとは flex-wrap で何行にも伸びていた。強化が10個を超えると札だけで3行4行になり、
            //   敵の絵・「緊急」のボタン・与ダメの数字が押し出されて読めなくなっていた。
            // ★ふだんは**アイコン1行**(横に溢れたら横スクロール)。数値は「詳細」を押したときだけ出す。
            //   どちらの見た目でも周りの高さは変わらないので、下の画面が動かない。
            // ★札を1つずつ書くのをやめ、いったん配列にしてから並べる。
            //   文面と色をここ1か所に置くと、2つの見た目がずれない。
            const chips=[];
            // ★`icon` という名前は使わない。カードの絵は cardIconNode() を通す決まりがあり、
            //   card-icon-check.js が `c.icon` をそのまま描く書き方を禁じている
            const chip=(key,mark,label,value,tone,opts)=>{const o=opts||{};chips.push({key,mark,label,value,tone,short:o.short!=null?o.short:value,pulse:!!o.pulse});};
            const atkPct=Math.floor((getPermaBuff('atkPct')+getPermaBuff('muaAtkPct'))*100);
            if(atkPct>0) chip('atk',<Sword size={9}/>,'ATK',`+${atkPct}%`,'text-red-500 border-red-500/50');
            const dmgCutPct=Math.floor(getPermaBuff('dmgCutPct')*100);
            if(dmgCutPct>0) chip('dmgCut',<Shield size={9}/>,'被ダメ',`-${dmgCutPct}%`,'text-emerald-500 border-emerald-500/50');
            const defPct=Math.floor(getPermaBuff('defPct')*100);
            if(defPct>0) chip('def',<Shield size={9}/>,'DEF',`+${defPct}%`,'text-emerald-500 border-emerald-500/50');
            const muaHpPct=Math.floor(getPermaBuff('muaHpPct')*100);
            if(muaHpPct>0) chip('muaHp',<Heart size={9}/>,'ライフ',`+${muaHpPct}%`,'text-pink-500 border-pink-500/50');
            const muaGutsPct=Math.floor(getPermaBuff('muaGutsPct')*100);
            if(muaGutsPct>0) chip('muaGuts',<Zap size={9}/>,'ガッツ',`+${muaGutsPct}%`,'text-amber-500 border-amber-500/50');
            const critRate=Math.round(getPermaBuff('critRatePct')*100);
            if(critRate>0) chip('critRate',<Sparkles size={9}/>,'クリ率',`+${critRate}%`,'text-yellow-400 border-yellow-400/50');
            const critDmg=Math.round(getPermaBuff('critDmgPct')*100);
            if(critDmg>0) chip('critDmg',<Sparkles size={9}/>,'クリダメ',`+${critDmg}%`,'text-yellow-400 border-yellow-400/50');
            const comboDmg=Math.round(getPermaBuff('comboDmgPct')*100);
            if(comboDmg>0) chip('combo',<Sword size={9}/>,'連撃',`+${comboDmg}%`,'text-cyan-400 border-cyan-400/50');
            if(getPermaBuff('globalComboDmgPct')>0) chip('globalCombo',<Sword size={9}/>,'全体連撃',`+${Math.round(getPermaBuff('globalComboDmgPct')*100)}%`,'text-sky-300 border-sky-300/50');
            if(kikiCardBonus>0) chip('kikiCard',<PlusCircle size={9}/>,'カード上限',`+1（残り${Math.ceil(getPermaBuff('kikiCardBonusTurns'))}T）`,'text-violet-300 border-violet-300/50',{short:'+1'});
            // ソードスキル(剣士モッチー)。連撃パワーは3たまるごとに永久追加連撃へ変わるので、
            // 両方が見えないと進み具合が分からない
            if(getPermaBuff('kenshiComboPower')>0||getPermaBuff('kenshiExtraCombo')>0){
              const kenshiExtra=getPermaBuff('kenshiExtraCombo');
              chip('kenshi',<Sword size={9}/>,'連撃パワー',
                `${getPermaBuff('kenshiComboPower')}/${KENSHI_COMBO_POWER_MAX}${kenshiExtra>0?`・追加連撃 +${kenshiExtra}`:''}`,
                'text-violet-300 border-violet-300/50',{short:`${getPermaBuff('kenshiComboPower')}/${KENSHI_COMBO_POWER_MAX}`});
            }
            chip('autoHp',<Heart size={9}/>,'ライフ回復',`${Math.round(getPermaBuff('autoHpRecovery',0.1)*100)}%`,
              getPermaBuff('autoHpRecovery',0.1)>=0.1?'text-rose-400 border-rose-400/50':'text-red-400 border-red-400/50');
            chip('autoGuts',<Zap size={9}/>,'ガッツ回復',
              `${Math.round(applyIceRulerAutoGutsRecovery(Math.max(0,0.05+(getPermaBuff('autoHpRecovery',0.1)-0.1))+getPermaBuff('gutsRecoverPct'),mainHero?.id,iceLockActive,heroDist,enemyDist)*100)}%`,
              'text-amber-400 border-amber-400/50');
            // ポルツの待機。あと何回ぶん敵の攻撃で発動するかを出す(0になったら消える。得た効果は残る)
            if(getPermaBuff('poltzCharges')>0) chip('poltz',<Zap size={9}/>,BREEDER_EVO_NAMES.poltz[Math.max(0,Math.min(getPermaBuff('poltzTier'),2))],`×${Math.floor(getPermaBuff('poltzCharges'))}`,'text-lime-300 border-lime-400/50',{pulse:true});
            // === ターン限定バフ（都度表示） ===
            if(getNextTurnBuff('melosoFullRecoveryMult',0)>0) chip('meloso',<Heart size={9}/>,'次ターン全回復','','text-rose-300 border-rose-400/50',{pulse:true});
            if(getTurnBuff('atkMult',1.0)>1) chip('boost',<Sparkles size={9}/>,'Boost',`x${getTurnBuff('atkMult',1.0).toFixed(1)}`,'text-red-500 border-red-500/50',{pulse:true});
            if(getTurnBuff('stunEnemy',false)) chip('stun',<Zap size={9}/>,'スタン予約','','text-yellow-400 border-yellow-500/50',{pulse:true});
            if(getTurnBuff('guaranteedCrit',false)) chip('critFix',<Target size={9}/>,'会心予約','','text-orange-400 border-orange-500/50',{pulse:true});
            if(getTurnBuff('zeroGuts',false)||getNextTurnBuff('zeroGuts',false)) chip('zeroGuts',<Star size={9}/>,'0消費中','','text-blue-400 border-blue-500/50',{pulse:true});
            if(getNextTurnBuff('reflect',false)) chip('reflectNext',<RefreshCcw size={9}/>,'次反射','','text-purple-400 border-purple-500/50',{pulse:true});
            if(getTurnBuff('reflect',false)) chip('reflectNow',<RefreshCcw size={9}/>,'反射待機','','text-purple-300 border-purple-400',{pulse:true});
            // 敵の咆哮(2026-09-20 ユーザー指摘「咆哮の効果が分からない」)。
            // ★ポップアップは一瞬で消えるので、いま何回かかっているかがどこにも出ていなかった。
            //   敵の攻撃そのものを上げる(元に戻らない)ので、札に出し続ける
            if(enemy?.roarStacks>0) chip('roarUp',<ArrowUpCircle size={9}/>,'敵の咆哮',`×${enemy.roarStacks}`,'text-orange-400 border-orange-500/50',{pulse:true});
            if(getWaveBuff('enemyAtkDebuffPct')>0) chip('enemyAtkDown',<ArrowDownCircle size={9}/>,'敵攻',`-${Math.round(getWaveBuff('enemyAtkDebuffPct')*100)}%`,'text-indigo-400 border-indigo-500/50',{pulse:true});
            if(getWaveBuff('enemyTakenDmgBonus')>0) chip('enemyTaken',<PlusCircle size={9}/>,'敵被ダメ',`+${Math.round(getWaveBuff('enemyTakenDmgBonus')*100)}%`,'text-orange-400 border-orange-500/50',{pulse:true});
            if(getNextTurnBuff('takenDamageMult',1.0)<1) chip('takenNext',<Shield size={9}/>,'次T被ダメ',`-${Math.round((1-getNextTurnBuff('takenDamageMult',1.0))*100)}%`,'text-pink-400 border-pink-500/50',{pulse:true});
            if(getTurnBuff('takenDamageMult',1.0)<1) chip('takenNow',<Shield size={9}/>,'被ダメ',`-${Math.round((1-getTurnBuff('takenDamageMult',1.0))*100)}%`,'text-pink-300 border-pink-400',{pulse:true});
            if(getNextTurnBuff('gutsCostMult',1.0)>1) chip('costNext',<Zap size={9}/>,'次T消費G',`+${Math.round((getNextTurnBuff('gutsCostMult',1.0)-1)*100)}%`,'text-amber-400 border-amber-500/50',{pulse:true});
            if(getTurnBuff('gutsCostMult',1.0)>1) chip('costNow',<Zap size={9}/>,'消費G',`+${Math.round((getTurnBuff('gutsCostMult',1.0)-1)*100)}%`,'text-amber-300 border-amber-400',{pulse:true});
            if(!chips.length) return null;
            return (
              <div data-battle-buffs={chips.length} data-battle-buffs-mode={buffDetail?'detail':'icon'}
                className={`shrink-0 w-full max-w-[360px] mx-auto px-2 bg-slate-950 relative z-[40] flex flex-col justify-center pt-1 pb-0.5 ${focusedCard&&!tacticsDebugLayout?'invisible':'visible'}`}>
                {/* 「詳細」を開いたときに伸びてよいのは**3段まで**(2026-09-22 ユーザー指示
                    「最大3列ぐらいまで伸びてあとはスクロールでみれるようにして」)。
                    ★札は23px、2段目からの行送りは26px。3段 = 23 + 26×2 = 75px。
                      それより下はこの中で縦スクロールする(スクロールバーは mh-scroll の6px)。
                    ★伸びたぶんは敵の舞台が縮む。上限を切らないと、舞台の低い端末で絵が切れ、
                      左下のステータスが絵に重なる(実測: 375×667 で舞台が120pxまで潰れた)。
                    ★アイコン表示のほうは何個増えても1行のまま(横スクロール)なので、
                      ふだんは距離帯との位置関係が動かない */}
                <div className={`flex items-start gap-1 ${focusedCard&&tacticsDebugLayout?'invisible':'visible'}`}>
                  {buffDetail?(
                    <div data-battle-buff-list className="flex-1 min-w-0 flex flex-wrap justify-center gap-1 overflow-y-auto mh-scroll" style={{maxHeight:'75px'}}>
                      {chips.map(c=>(<div key={c.key} className={`text-[11px] font-black bg-black/60 px-2 py-0.5 rounded border flex items-center gap-1 shadow-lg ${c.tone}${c.pulse?' animate-pulse':''}`}>{c.mark} {c.label}{c.value?` ${c.value}`:''}</div>))}
                    </div>
                  ):(
                    <div data-battle-buff-icons className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-hide">
                      {chips.map(c=>(<div key={c.key} aria-label={`${c.label}${c.value?` ${c.value}`:''}`} title={`${c.label}${c.value?` ${c.value}`:''}`} className={`shrink-0 text-[10px] font-black bg-black/60 px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 leading-none ${c.tone}${c.pulse?' animate-pulse':''}`}>{c.mark}{c.short?<span>{c.short}</span>:null}</div>))}
                    </div>
                  )}
                  <button type="button" data-battle-buff-toggle={buffDetail?'close':'open'} onClick={()=>setBuffDetail(v=>!v)}
                    aria-label={buffDetail?'強化の詳細を閉じる':`強化の詳細を見る（${chips.length}件）`}
                    className="shrink-0 min-h-[20px] px-1.5 rounded-full border border-white/25 bg-black/60 text-[9px] font-black leading-none text-slate-200 active:scale-90 flex items-center">
                    {buffDetail?'とじる':`詳細 ${chips.length}`}
                  </button>
                </div>
          {(()=>{
            // Overall total damage across ALL monster slots, matching processTurn's global attack order.
            // Existing total = sum of already-assigned attack cards.
            // If a card is pending and validly assignable somewhere, also compute the projected new total.
            // committed (already assigned) attack cards in selection order
            // 2枚目以降のカードは効果半減。processTurnと同じく「アシストカード以外の枚数」で数える。
            // 保留中(タップしただけでまだ置いていない)カードは、まだ使っていないので枚数に数えない。
            // ここを数えてしまうと、1枚目なのに自分自身を2枚目とみなして半減表示になる。
            const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
            const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
            // ニコラオ・ゴーレム・モッチー/ミタラシ・ききは使ったターンからすぐ効くため、
            // 先に選んだカードぶんの補正を、あとに続くカードの予測へも反映する
            // (processTurnの実行順序と同じ数え方。localBoostFromCard/previewLocalBoosts参照)。
            const boosts=previewLocalBoosts(pendingIdx);
            let committedTotal=0; let guardFlat=0; let guardMult=0; const guardBySlot={};
            const committedCounter=makeCardHalveCounter();
            selectedCards.forEach(idx=>{
              if(idx===pendingIdx) return;
              const card=hand[idx]; const slotIdx=cardAssignments[idx];
              const halved=committedCounter.take(card,slotIdx!=null?slotIdx:null);
              const b=boosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
              if(slotIdx!=null&&isAttackCard(card)){const baseDmg=getDmg(card,slotIdx,slots[slotIdx],b.oryo,b.dmgMod,halved); committedTotal+=getAttackPredictedDmg(card,slots[slotIdx],baseDmg,b.combo,slotIdx);}
              const gw=guardCardWeight(card);
              if(gw>0){ const e=cardEffectMultiplier(card,halved);
                const gf=GUARD_EVOLUTION[guardLevel].flat*gw*e, gm=GUARD_EVOLUTION[guardLevel].mult*gw*e;
                guardFlat+=gf; guardMult+=gm;
                // ★タクティクスは構えた子ごとに丈夫さが違う。枠ごとに分けて持っておき、
                //   合計は「枠ごとに出した軽減量の足し算」にする(平均で1回出すとずれる)
                if(slotIdx!=null){ const cur=guardBySlot[slotIdx]||{flat:0,mult:0,cards:0};
                  guardBySlot[slotIdx]={flat:cur.flat+gf,mult:cur.mult+gm,cards:(cur.cards||0)+1}; } }
            });
            // ★全体ガード(2体以上が別々に構えた)なら、構えていない子にも丈夫さぶんが付く。
            //   合計にもそれを含める(2026-09-22 の新仕様)
            const sumGuardBySlot=(extra=null)=>{
              const merged={};
              Object.entries(guardBySlot).forEach(([slot,g])=>{ merged[slot]={...g}; });
              if(extra&&extra.slot!=null){ const cur=merged[extra.slot]||{flat:0,mult:0,cards:0};
                merged[extra.slot]={flat:cur.flat+extra.flat,mult:cur.mult+extra.mult,cards:(cur.cards||0)+1}; }
              return (tacticsUnits||[]).reduce((sum,unit,slotIdx)=>
                (unit&&!unit.downed ? sum+tacticsSlotGuardValue(merged,slotIdx) : sum),0);
            };
            const committedGuard=Array.isArray(tacticsUnits)?sumGuardBySlot():guardValueOf(guardFlat,guardMult);
            // 保留カードがガードなら、置いたあとの合計軽減も出す
            const pendingGuardWeight=guardCardWeight(pendingCardObj);
            const pendingGuardHalved=pendingGuardWeight>0&&committedCounter.peek(pendingCardObj,pendingIdx!=null&&cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null);
            const pendingGuardEffect=cardEffectMultiplier(pendingCardObj,pendingGuardHalved);
            // 置く先が決まっている保留カードは、その子の丈夫さで足す(タクティクス)
            const pendingGuardSlot=pendingIdx!=null&&cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null;
            const projectedGuard=pendingGuardWeight>0
              ? (Array.isArray(tacticsUnits)
                ? sumGuardBySlot({slot:pendingGuardSlot,
                    flat:GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*pendingGuardEffect,
                    mult:GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*pendingGuardEffect})
                : guardValueOf(guardFlat+GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*pendingGuardEffect, guardMult+GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*pendingGuardEffect))
              : committedGuard;
            const pendingIsAtk=isAttackCard(pendingCardObj);
            // projected damage the pending card would add (as the next attack in order)
            let pendingAdd=0; let pendingValidSlot=null;
            if(pendingIsAtk){
              // find a slot it could legally hit (for unique: its own monster; else any occupied slot)
              for(let i=0;i<slots.length;i++){
                const s=slots[i]; if(!s) continue;
                // ★置ける枠かどうかは、盤面のタップ判定とまったく同じ答えを使う。
                //   自前で枚数を数えていたころは、ガードを1枚置いた子が
                //   「もう置けない子」に見えて、合計DMGの予測だけ別の子で出ていた
                const tacticsAnswer=tacticsCanAssign?tacticsCanAssign(pendingCardObj,pendingIdx,i):null;
                if(tacticsAnswer===null||tacticsAnswer===undefined){
                  const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
                  const maxUses=slotMaxUses(s,i); if(assignedCount>=maxUses) continue;
                } else if(!tacticsAnswer) continue;
                if(pendingCardObj.type==='unique'&&pendingCardObj.ownerSlotIdx!==i) continue;
                pendingValidSlot=i; const baseDmg=getDmg(pendingCardObj,i,s,boosts.forPending.oryo,boosts.forPending.dmgMod,committedCounter.peek(pendingCardObj,i)); pendingAdd=getAttackPredictedDmg(pendingCardObj,s,baseDmg,boosts.forPending.combo,i); break;
              }
            }
            const projectedTotal=committedTotal+pendingAdd;
            const showProjected=pendingIsAtk&&pendingValidSlot!=null&&pendingAdd>0;
            // 合計軽減は、ガードを置いたぶんの合計。2枚目以降のガードは半分で計算される。
            const showGuardProjected=pendingGuardWeight>0&&projectedGuard>committedGuard;
            const showDmg=committedTotal>0||showProjected;
            const showGuard=committedGuard>0||showGuardProjected;
            if(!showDmg&&!showGuard) return null;
            return(
              // ★浮かせない。ここは**流れの中の1行**として置く(2026-09-22 ユーザー指摘
              //   「表示が被ってて見えない」)。それまでは枠の上へ absolute・bottom:78% で
              //   浮かせていたので、味方の枠の高さが変わると枠の名前の上に乗っていた
              //   (タクティクスはパーティのライフ帯が無いぶん枠が上がるので、必ず重なる)。
              //   ★高さを持つのは出ているあいだだけ。空けておく場所は作らない(舞台が低い端末で
              //     いちばん困るのは敵の絵なので、使わないときは敵へ返す)
              //   ★2つは**横に並べて**折り返す。縦に積むと出た瞬間に舞台が46px縮む
              <div data-battle-total-preview data-tactics-preview-band={tacticsDebugLayout?'buff-overlay':undefined} className={`${tacticsDebugLayout?'absolute left-1/2 top-0 z-[65] w-max max-w-[78%] -translate-x-1/2 -translate-y-full pb-1':'mt-1 w-full'} flex ${tacticsDebugLayout?'flex-col':'flex-wrap'} items-center justify-center gap-x-2 gap-y-0.5 pointer-events-none`}>
                {showDmg&&(
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-lg ${showProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-red-950/90 border-red-500/50'} backdrop-blur-sm`}>
                  <Sword size={11} className={showProjected?'text-yellow-400':'text-red-400'}/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">合計DMG</span>
                  {showProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedTotal}</span>
                      <span className="text-yellow-400">+{pendingAdd}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedTotal}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]">{committedTotal}</span>
                  )}
                </div>
                )}
                {showGuard&&(
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-lg ${showGuardProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-emerald-950/90 border-emerald-500/50'} backdrop-blur-sm`}>
                  <Shield size={11} className={showGuardProjected?'text-yellow-400':'text-emerald-400'}/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">合計軽減</span>
                  {showGuardProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedGuard}</span>
                      <span className="text-yellow-400">+{projectedGuard-committedGuard}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedGuard}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">{committedGuard}</span>
                  )}
                </div>
                )}
              </div>
            );
          })()}
              </div>
            );
          })()}
        <div className="shrink-0 py-1.5 px-2 border-y border-white/10 flex flex-col items-center justify-center gap-1 z-10 relative" style={{backgroundImage:'linear-gradient(180deg, rgba(14,19,38,.97) 0%, rgba(8,11,22,.98) 100%)'}}>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1" style={{zIndex:200}}>{popups.filter(p=>p.side==='hero').map((p)=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} className={`${p.color} font-black leading-tight px-2 py-0.5 rounded-lg ${liteBattleView?'border border-white/20 text-base':'drop-shadow-[0_2px_8px_rgba(0,0,0,1)]'}`} style={{backgroundColor:liteBattleView?'rgba(2,6,23,0.95)':'rgba(2,6,23,0.55)'}}>{p.text}</div>))}</div>
          {/* ライフ・ガッツのポップアップ(吸収・ガードの余り・回復カードなど)。
              ★1体ずつの帯は**カードの中へ入れた**(2026-09-22 ユーザー指摘「距離いれると縦が
                狭くなりすぎる」)。同じ4列が2段あるだけで枠1つぶんと余白を丸ごと使っていたため。
              ★帯を消すときに、出す場所ごと消してはいけない(2026-09-20 に一度やって、回復も
                ガードの余りもどこにも出なくなった)。入れ物だけここに残す */}
          {Array.isArray(tacticsUnits)?(
            <div data-tactics-party-popups className="absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>
                {popups.filter(p=>p.side==='life'||p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}
            </div>
          ):(
          <div className="w-full space-y-0.5 px-2 py-0.5 bg-black/40 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 relative"><Heart className="text-pink-500 shrink-0" size={12}/><div className="flex-1"><div className="flex items-end justify-between text-[9px] font-bold text-pink-400 uppercase tracking-wider"><span>Ally Life</span><span data-ally-life={`${hp}/${effectiveMaxHp}`} className="font-mono text-[11px] leading-none text-pink-200">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-pink-700 to-rose-400 transition-all duration-1000" style={{width:`${(hp/effectiveMaxHp)*100}%`,backgroundImage:'linear-gradient(to right, #be185d, #fb7185)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='life').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
            <div className="flex items-center gap-2 relative"><Zap className="text-amber-500 shrink-0" size={10}/><div className="flex-1"><div className="flex items-end justify-between text-[9px] font-bold text-amber-400 uppercase tracking-wider"><span>Ally Guts</span><span data-ally-guts={`${Math.floor(guts)}/${effectiveMaxGuts}`} className="font-mono text-[11px] leading-none text-amber-200">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{width:`${(guts/effectiveMaxGuts)*100}%`,backgroundImage:'linear-gradient(to right, #d97706, #fde047)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
          </div>
          )}
          {/* 味方の枠。高さは中身の合計で決まる(名前18 + 絵64 + ライフ/ガッツ + 距離ラベル20)。
              ★枠は overflow-visible なので、足りないと下へはみ出して手札の帯に食い込む。
                ライフ・ガッツをラベル付きで整列させたとき(2026-09-22)に実際はみ出した */}
          <div data-tactics-debug-layout={tacticsDebugLayout?'2x2':undefined} className={`grid ${tacticsDebugLayout?'grid-cols-2 grid-rows-2 gap-1.5':'grid-cols-4 gap-2'} w-full relative shrink-0${battleTutorialSpotClass('battleSlots')}`} style={{height:tacticsDebugLayout?'clamp(196px,23dvh,214px)':'clamp(152px,18dvh,168px)'}}>
            {slots.map((s,i)=>{
              // Count how many cards already assigned to this slot
              const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
              // 通常は1枠1枚。枚数+1の勇者特性(ハムの連続攻撃・剣士モッチーの二刀流)を持つ
              // 勇者モンが居ると、その本人のスロットだけ複数枚OK。
              // ききのカード上限+1が効いているときも、その+1ぶんはどのスロットへ重ねてよい
              const maxUses=slotMaxUses(s,i);
              const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
              // 保留中のカードはまだ使っていないので、「何枚目か」の枚数には数えない
              const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
              // Can this slot accept the pending card?
              // 新モードはこの子のライフ・ガッツ・倒れたかどうかを持つ(ほかのモードでは null)
              const tacticsUnit=Array.isArray(tacticsUnits)?(tacticsUnits[i]||null):null;
              // この枠のガードの状態。札の名前(全体ハイガード)と🛡のまとめが同じ答えを使えるよう、
              // ガードのまとめは枠ごとに1回だけ作ってここから配る
              const guardPlanBySlot=Array.isArray(tacticsUnits)?plannedGuardBySlot():null;
              const slotGuardCards=guardPlanBySlot?(guardPlanBySlot[i]?.cards||0):0;
              const slotRushGuard=slotGuardCards>=TACTICS_RUSH_GUARD_CARDS;
              const slotSpreadGuard=!!guardPlanBySlot&&isTacticsSpreadGuard(guardPlanBySlot);
              // ★このターン、この子に何が起きたか(食らった／受け止めた／かわした／返した)。
              //   浮かぶ数字だけでは、全体攻撃のときにどこを見ればよいのか目が追いつかない
              //   (2026-09-22 ユーザー指示「攻撃されたときに誰が攻撃されたかが分かりづらい」)
              const slotHitKind=kindOfTacticsSlotFx(tacticsSlotFx&&tacticsSlotFx[i]);
              // 揺れは省エネ表示では出さない(光と輪だけでも誰かは分かる)
              const slotHitShake=slotHitKind&&!ecoBattleView?{animation:'tacticsHitShake 420ms ease-in-out'}:null;
              // ★「その子だけに効く」バフは、かかっている子の枠へ印を出す(タクティクス)。
              //   画面上の帯(Boost・会心予約…)では誰にかかっているのか分からない。
              //   みゃるの薬と、固有技の効果(消費0・会心確定・贖罪・共鳴)がここに出る
              const slotBuffMarks=(()=>{
                if(!Array.isArray(tacticsUnits)) return [];
                const bySlot=getTurnBuff('bySlot',null);
                const marks=[];
                const atkMult=tacticsSlotRate(bySlot,i,'atkMult',1.0);
                if(atkMult>1) marks.push({text:`⚔×${atkMult.toFixed(1)}`,cls:'text-red-300'});
                if(tacticsSlotFlag(bySlot,i,'zeroGuts')) marks.push({text:'⚡0',cls:'text-blue-300'});
                if(tacticsSlotFlag(bySlot,i,'guaranteedCrit')) marks.push({text:'★会心',cls:'text-yellow-300'});
                const takenMult=tacticsSlotRate(bySlot,i,'takenDamageMult',1.0);
                if(takenMult<1) marks.push({text:`🛡-${Math.round((1-takenMult)*100)}%`,cls:'text-pink-300'});
                const costMult=tacticsSlotRate(bySlot,i,'gutsCostMult',1.0);
                if(costMult>1) marks.push({text:`⚡+${Math.round((costMult-1)*100)}%`,cls:'text-amber-300'});
                if(tacticsSlotTurns(bySlot,i,'pandoraResonanceTurns')>0) marks.push({text:'⚡½',cls:'text-cyan-300'});
                return marks;
              })();
              let canAssign=false;
              if(s && pendingCardObj){
                // 新モードは「その子が払えるか」で決まる。倒れた子へは回復カードだけ置ける。
                // ★null のときだけ今までどおりの判定を使う(既存モードはここを通る)
                const tacticsAnswer=tacticsCanAssign?tacticsCanAssign(pendingCardObj,pendingIdx,i):null;
                if(tacticsAnswer===null||tacticsAnswer===undefined){
                  canAssign = assignedCount<maxUses;
                  if(pendingCardObj.type==='unique') canAssign = canAssign && (pendingCardObj.ownerSlotIdx===i);
                } else canAssign = tacticsAnswer;
              }
              // 選択順に「アシストカード以外」を数え、どのカードが2枚目以降(効果半減)かを出す。
              // 保留中のカードはまだ使っていないので数えない。
              // 保留中のカードは自分を数えず、「次に使う1枚」として半減かどうかを決める。
              // (数えてしまうと1枚目でも半減、除外しっぱなしだと2枚目でも全開の表示になる)
              const halvedByIdx={};
              {const counter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; const c=hand[idx]; const sl=cardAssignments[idx]!=null?cardAssignments[idx]:null; halvedByIdx[idx]=counter.take(c,sl); });
                if(pendingIdx!=null&&selectedCards.includes(pendingIdx)) halvedByIdx[pendingIdx]=counter.peek(hand[pendingIdx],cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null);}
              // Preview damage:
              // - if a card is pending assignment, show what THIS card would do on this monster
              // - otherwise show the sum of damage from cards already assigned to this slot,
              //   using the GLOBAL attack order (2nd+ attack = half damage), matching processTurn
              // ニコラオ・ゴーレム・モッチー/ミタラシ・ききの同ターン即時効果を、
              // このスロットの予測にも反映する(合計DMG欄と同じpreviewLocalBoosts)。
              const slotBoosts=previewLocalBoosts(pendingIdx);
              let previewDmg=0; let isPendingPreview=false; let isPendingHalved=false; let previewSoulPct=0;
              // ★ガードも枠ごとに「この子へ置いたらいくら受け止められるか」を出す
              //   (2026-09-22 ユーザー指摘「ダメージは個別に見えるのにガード値は個別に
              //    分からない…ダメージと同じような仕様にして」)。
              //   受け止める量はその子の丈夫さで決まるので、置く先で変わる
              let previewGuard=0; let isPendingGuardHalved=false;
              if(s && pendingCardObj && canAssign && guardCardWeight(pendingCardObj)>0){
                const guardCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; guardCounter.take(hand[idx],cardAssignments[idx]!=null?cardAssignments[idx]:null); });
                isPendingGuardHalved=guardCounter.peek(pendingCardObj,i);
                const gw=guardCardWeight(pendingCardObj), ge=cardEffectMultiplier(pendingCardObj,isPendingGuardHalved);
                previewGuard=guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge,i);
              }
              if(s && pendingCardObj && canAssign && isAttackCard(pendingCardObj)){
                // 既に選んだぶんを数え、保留カードは「この枠へ置いた次の1枚」として扱う。
                // ★新モードは同じ子の2枚目だけ半減なので、置き先(i)で数え方が変わる
                const pendingCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; pendingCounter.take(hand[idx],cardAssignments[idx]!=null?cardAssignments[idx]:null); });
                const isSecondOrLater = pendingCounter.peek(pendingCardObj,i);
                const baseDmg=getDmg(pendingCardObj,i,s,slotBoosts.forPending.oryo,slotBoosts.forPending.dmgMod,isSecondOrLater);
                previewDmg=getAttackPredictedDmg(pendingCardObj,s,baseDmg,slotBoosts.forPending.combo,i);
                previewSoulPct=soulTraitAttackProfile(s?.masuId?getMasuMon(s.masuId):null,pendingCardObj,i).damagePct;
                isPendingPreview=true; isPendingHalved=isSecondOrLater;
              } else if(s){
                // 選択順で「アシストカード以外」を数え、2枚目以降は半減として予測する
                const slotCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{
                  if(idx===pendingIdx) return;
                  const card=hand[idx];
                  const halved=slotCounter.take(card,cardAssignments[idx]!=null?cardAssignments[idx]:null);
                  if(cardAssignments[idx]===i){
                    const b=slotBoosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
                    const baseDmg=getDmg(card,i,s,b.oryo,b.dmgMod,halved);
                    previewDmg+=getAttackPredictedDmg(card,s,baseDmg,b.combo,i);
                  }
                });
              }
              const isAnimating = !ecoBattleView && attackAnim && attackAnim.slotIndex === i;
              // このスロットに固有技カードが割り当てられているか（セット中は常時エフェクト）
              const hasUniqueSet = selectedCards.some(idx=>cardAssignments[idx]===i && hand[idx]?.type==='unique');
              // このスロットに表示する選択中カード: 攻撃系は割当先スロット、全体系(ガード/バフ/回復等)は全スロット
              const slotAssignedCards = selectedCards.filter(idx=>{
                const card=hand[idx]; if(!card) return false;
                if(cardNeedsMonster(card)) return cardAssignments[idx]===i;
                return true; // 全体系は全スロット
              }).map(idx=>({idx,card:hand[idx]}));
              const distanceBreakLevel=ultimateDistanceBreakLevels[i]||0;
              const distanceBroken=distanceBreakLevel>0;
              const distanceBreakPercent=100*(0.5**distanceBreakLevel);
              const distanceBreakRoman=['','I','II','III','IV'][distanceBreakLevel]||String(distanceBreakLevel);
              // ★この枠が狙われているか(2026-09-21 ユーザー指摘「誰に攻撃か分からない」)。
              //   名前だけでは4つの枠から自分で探すことになるので、枠のほうにも印を出す
              const slotAimed=aimedSlots.includes(i);
              // ★その子の予定ダメージ。全体攻撃は丈夫さで1体ずつ変わるので枠ごとに出す
              //   (2026-09-21 ユーザー依頼)。ガードを置けばその枠の数字だけが減る。
              //   ★連撃は1発ずつ並べると合計が読めない(2026-09-22 ユーザー指摘)ので、
              //     合計を先に出し、1発ずつの内訳を小さく添える
              const slotAimHit=slotAimed?plannedHitWithCover(i):null;
              // この子のEXスキル(タクティクスだけ。持っていなければ null)
              const slotExInfo=tacticsExInfo?tacticsExInfo(i):null;
              return(<button key={i} data-slot-index={i} data-tactics-aimed={slotAimed?'true':undefined} data-distance-broken={distanceBroken?'true':undefined} data-distance-break-level={distanceBroken?distanceBreakLevel:undefined} aria-label={`${RANGE_LABELS[i]}距離${distanceBroken?`（BREAK Lv${distanceBreakLevel}・与ダメージ${distanceBreakPercent}%）`:''}`} onClick={()=>{
                if(isBusy||autoBattleRef.current)return;
                if(pendingCard!=null && canAssign){
                  setCardAssignments(p=>({...p,[pendingCard]:i}));
                  setPendingCard(null);
                  setFocusedCard(null);
                  Audio_.se.card();
                  setSlotSettle(i);
                  setTimeout(()=>{ setSlotSettle(null); }, 500);
                } else if(pendingCard==null && !dragState?.active && tacticsExInfo && tacticsExInfo(i)){
                  // ★カードを置く途中でないときだけ、その子のEXスキルの詳細を開く(タクティクス専用)。
                  //   カードの置き先を選んでいるときのタップは、今までどおりカードの置き場所の操作にする
                  setExPanelSlot(i);
                  // 自分で開けたなら、使い方案内はもう要らない
                  if(tacticsExIntroVisible&&dismissTacticsExIntro) dismissTacticsExIntro();
                }
              }} disabled={isBusy||autoBattle} className={`relative ${tacticsDebugLayout?'rounded-[18px] border grid grid-cols-[40%_60%] grid-rows-[18px_minmax(0,1fr)] items-stretch bg-[linear-gradient(145deg,rgba(15,23,42,.88),rgba(5,10,24,.96))] backdrop-blur-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,.09),inset_0_0_18px_rgba(99,102,241,.035),0_7px_20px_rgba(0,0,0,.24)]':'rounded-2xl border-2 flex flex-col items-stretch'} overflow-visible transition-all ${RANGE_STYLES[i].slotGlow||''} ${tacticsDebugLayout?'':RANGE_STYLES[i].bg} ${distanceBroken?'border-red-400':tacticsDebugLayout?'border-white/[.10]':' '+RANGE_STYLES[i].border} ${(canAssign||(dragState?.active&&dragOverSlot===i))?'ring-2 ring-yellow-400 scale-105 z-10 shadow-lg animate-pulse':'opacity-100'} ${assignedCount>0?'ring-2 ring-indigo-500/80':''} ${tacticsDebugLayout&&!s?'opacity-65 shadow-none border-white/[.06]':''} ${dragState?.active&&dragOverSlot===i?'ring-4 ring-green-400 scale-110':''} ${slotSettle===i?'ring-4 ring-white':''}`} style={isAnimating&&!tacticsDebugLayout?{zIndex:9999, animation:attackMotionAnimation(attackAnim)}:(distanceBroken?{backgroundColor:distanceBreakLevel>=2?'rgb(12,2,5)':'rgb(24,5,25)',boxShadow:`inset 0 0 0 ${Math.min(4,distanceBreakLevel+1)}px rgba(248,113,113,.95), inset 0 0 ${28+distanceBreakLevel*8}px rgba(76,5,25,.98), 0 0 ${9+distanceBreakLevel*4}px rgba(220,38,38,.65)`,...(slotHitShake||{})}:(slotSettle===i?{animation:'slotSettle 400ms ease-out'}:(slotHitShake||undefined)))}>
                {/* ★狙われている枠。カードを置ける黄色の輪・ドラッグ中の緑の輪と重ならないよう、
                    輪ではなく枠の内側の線で出す(BREAKと同じ出し方)。全体攻撃なら全員に付く */}
                {/* ★食らった子の枠そのものを光らせる。数字は一瞬で読み取れないので、
                    色と輪で「どこを見ればよいか」を先に伝える(2026-09-22 ユーザー指示
                    「食らったモンスターにエフェクトなどがつくようにしたい」)。
                    数字(z-[70])より下へ重ねて、数字が読めなくならないようにする */}
                {slotHitKind&&(()=>{
                  const hitFx=TACTICS_SLOT_FX_STYLE[slotHitKind];
                  return(<div data-tactics-hit-fx={slotHitKind} className="absolute inset-0 z-[58] pointer-events-none overflow-visible">
                    <div className="absolute inset-0 rounded-xl" style={{background:`radial-gradient(circle at 50% 50%, rgba(${hitFx.rgb},0.65) 0%, rgba(${hitFx.rgb},0.3) 45%, rgba(0,0,0,0) 75%)`,animation:'tacticsHitFlash 520ms ease-out forwards'}}></div>
                    <div className={`absolute inset-0 rounded-xl border-2 ${hitFx.edge}`} style={{animation:'tacticsHitEdge 620ms ease-out forwards'}}></div>
                    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
                      <div className={`rounded-full border-2 ${hitFx.ring}`} style={{width:'44px',height:'44px',animation:'tacticsHitRing 520ms ease-out forwards'}}></div>
                      {/* 輪を少し遅らせて2枚重ねると「衝撃が広がる」感じが出る。省エネ表示では1枚だけ */}
                      {!ecoBattleView&&<div className={`absolute rounded-full border-2 ${hitFx.ring}`} style={{width:'44px',height:'44px',animation:'tacticsHitRing 520ms ease-out 110ms forwards'}}></div>}
                    </div>
                  </div>);
                })()}
                {/* ★このターン、この子に何が起きたか(2026-09-21 ユーザー指摘
                    「個別ダメージと全体ダメージで誰に何が起きてるか分かりにくい」)。
                    合計の数字は画面のまんなかに出したままなので、
                    「全体で何点減ったか」と「誰が減ったか」の両方が読める */}
                {tacticsSlotFx&&tacticsSlotFx[i]&&(()=>{
                  const f=tacticsSlotFx[i];
                  return (<div data-tactics-slot-fx={i} className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[70] pointer-events-none flex flex-col items-center gap-0.5">
                    {f.evade?<span className="text-[11px] font-black text-blue-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">回避！</span>
                      :f.reflect?<span className="text-[11px] font-black text-purple-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">反射！</span>
                      :<>
                        {f.guard&&<span className="text-[11px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">🛡</span>}
                        {/* ★連撃は1ヒットずつ並べる(60が3ヒットなら 20/20/20)。
                            まとめて1つの数字にすると、3回殴られたことが読めない */}
                        {Array.isArray(f.hits)&&f.hits.length>1
                          ? f.hits.map((value,hitIndex)=><span key={hitIndex} className="text-[15px] font-black text-pink-400 leading-none drop-shadow-[0_0_6px_rgba(0,0,0,.95)]">-{value}</span>)
                          : (f.dmg>0&&<span className="text-[17px] font-black text-pink-400 drop-shadow-[0_0_6px_rgba(0,0,0,.95)]">-{f.dmg}</span>)}
                        {f.heal>0&&<span className="text-[11px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">💚 +{f.heal}</span>}
                        {f.guts>0&&<span className="text-[10px] font-black text-amber-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">⚡ +{f.guts}</span>}
                        {f.revive>0&&<span className="text-[12px] font-black text-teal-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">💤 +{f.revive}</span>}
                      </>}
                  </div>);
                })()}
                {/* ★数字の札は下の「枠の中の札」へまとめてある。ここは輪だけ。
                    それまでは狙いの札だけ枠の側に absolute で浮かせていたので、
                    連撃で2行になると下の札(置いたカード・予想ダメージ)へ乗っていた
                    (2026-09-22 ユーザー指摘「表示が被ってて見えない」) */}
                {slotAimed&&<div data-tactics-aimed-ring className="absolute inset-[2px] rounded-lg border-2 border-red-400/80 pointer-events-none z-[44] animate-pulse" style={{boxShadow:'inset 0 0 10px rgba(239,68,68,.55)'}}></div>}
                {distanceBroken&&<>
                  <div className="absolute inset-0 rounded-lg pointer-events-none z-[15]" style={{background:`repeating-linear-gradient(${135+distanceBreakLevel*12}deg,rgba(0,0,0,.12) 0 ${Math.max(3,8-distanceBreakLevel)}px,rgba(127,29,29,${Math.min(.8,.28+distanceBreakLevel*.14)}) ${Math.max(4,9-distanceBreakLevel)}px ${Math.max(5,10-distanceBreakLevel)}px),radial-gradient(circle at 50% 40%,rgba(${distanceBreakLevel>=2?'69,10,10':'88,28,135'},.55),rgba(5,0,2,.9))`}}></div>
                  <div className="absolute inset-[2px] rounded-lg border border-red-300/80 pointer-events-none z-[45]" style={{boxShadow:'inset 0 0 12px rgba(239,68,68,.7)'}}></div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[65] whitespace-nowrap rounded-full border-2 border-red-200 bg-red-950 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,.9)]">{distanceBreakLevel===1?'⚠':'☠'} BREAK {distanceBreakRoman}｜与ダメ {distanceBreakPercent}%</div>
                  {!s&&<div className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none text-red-200/80"><span className="text-2xl font-black">⚠</span></div>}
                </>}
                {/* 名前の行。勇者モンには王冠を付ける。どれが勇者モンか分からないと
                    「勇者モン選択時だけ効く特性」が効いているのか判断できないため */}
                <div className={`${tacticsDebugLayout?'col-span-2 row-start-1 h-[18px] justify-start gap-0.5 pr-[72px] backdrop-blur-sm':'h-[18px] justify-center'} shrink-0 flex items-center px-1 border-b z-20 ${isHeroSlotMon(s)?'bg-amber-400/10 border-amber-200/20':'bg-white/[.025] border-white/[.055]'}`}>{tacticsDebugLayout&&<span className={`mr-1 shrink-0 rounded px-1 py-0.5 text-[8px] font-black leading-none ${RANGE_STYLES[i].labelBg}`}>{RANGE_LABELS[i]}</span>}{isHeroSlotMon(s)&&<Crown size={8} className="shrink-0 mr-0.5 text-amber-300"/>}<span className={`text-[10px] font-black truncate uppercase leading-none ${isHeroSlotMon(s)?'text-amber-100':'text-white'}`}>{s?.name||'---'}</span>{assignedCount>0&&!tacticsDebugLayout&&<span className="ml-1 text-[10px] font-black text-indigo-300">×{assignedCount}</span>}{tacticsDebugLayout&&slotExInfo&&(<span data-tactics-ex-mark={i} data-tactics-ex-state={slotExInfo.badge.text} className={`absolute right-1 top-[3px] max-w-[68px] truncate rounded px-1 py-0.5 text-[8px] font-black leading-none ${slotExInfo.badge.active?'bg-fuchsia-600 text-white ring-1 ring-fuchsia-200':'bg-black/70 text-fuchsia-200 ring-1 ring-fuchsia-400/60'}`}>EX{slotExInfo.badge.text!=='EX'?` ${slotExInfo.badge.text}`:''}</span>)}{slotBuffMarks.map(mark=>(<span key={mark.text} data-tactics-slot-buff={mark.text} className={`ml-1 shrink-0 text-[8px] font-black leading-none ${mark.cls}`}>{mark.text}</span>))}</div>
                {(()=>{const uOptions=getAvailableUniquesForSlot(s,ownedUniques,i); if(uOptions.length<2) return null; const curKey=activeSlotUniqueKey(slotUniqueChoice,i,s); const curIdx=Math.max(0,uOptions.findIndex(o=>o.key===curKey));
                  return(<div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); if(isBusy||autoBattleRef.current)return; cycleActiveUniqueForSlot(i);}} className={`${tacticsDebugLayout?'absolute left-1 top-[20px]':'shrink-0'} z-20 flex items-center justify-center gap-0.5 bg-purple-700/90 border-b border-purple-300/50 py-0.5 active:scale-95${autoBattle?' opacity-40':''}`}>
                    <RefreshCcw size={7} className="text-white"/><span className="text-[10px] font-black text-white leading-none">固有技 {curIdx+1}/{uOptions.length}</span>
                  </div>);
                })()}
                <div data-tactics-attack-content={tacticsDebugLayout?'content-only':undefined} className={`${tacticsDebugLayout?'col-start-1 row-start-2 min-h-0':'flex-1'} flex flex-col items-center justify-center relative`} style={isAnimating&&tacticsDebugLayout?{zIndex:9999,animation:attackMotionAnimation(attackAnim)}:undefined}>
                  {slotSettle===i&&(
                    <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-visible">
                      <div className="absolute rounded-full border-4 border-cyan-300" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out forwards'}}></div>
                      <div className="absolute rounded-full border-2 border-white" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out 80ms forwards'}}></div>
                      <div className="absolute w-8 h-8 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-[0_0_16px_rgba(103,232,249,0.9)]" style={{animation:'setPop 500ms cubic-bezier(.2,1.5,.4,1) forwards'}}><Check size={18} className="text-white" strokeWidth={4}/></div>
                    </div>
                  )}
                  <div className={`absolute inset-0 rounded-[17px] ${RANGE_STYLES[i].slotBg} ${tacticsDebugLayout?'opacity-[.07]':'opacity-20'} pointer-events-none`}></div>
                  {/* ★この枠のガードの「まとめ」(2026-09-22 の新仕様)。
                      2枚以上構えた枠は連撃ガードなので**合計値**を出す(ユーザー指示
                      「連撃ガード1987が良いんだけどガードタップ時は単体数値がいくつかは
                      わかるようにして」…カードごとの単体値は下の札にそのまま残る)。
                      ★全体ガードになったら**立っている子全員**に出す(2026-09-22 ユーザー指示
                      「全体ガードになったときは全味方モンスターに軽減値を出して」)。
                      構えた子も構えていない子も、その子の丈夫さで軽減量が違うため。
                      全体ガードでない1枚だけの枠は、カードの札と同じ数字になるので出さない。
                      ★空き枠・倒れた子には出ない(tacticsSlotGuardValue が0を返す) */}
                  {guardPlanBySlot&&(()=>{
                    if(!slotRushGuard&&!slotSpreadGuard) return null;
                    const gv=tacticsSlotGuardValue(guardPlanBySlot,i);
                    if(!(gv>0)) return null;
                    return <div data-tactics-guard-total={gv} data-tactics-guard-kind={slotRushGuard?'rush':'spread'}
                      className={`absolute ${tacticsDebugLayout?'left-1 top-[22px]':'bottom-0.5 left-0.5'} z-[61] rounded border px-1 py-0.5 font-black leading-none pointer-events-none ${slotRushGuard?'border-amber-200 bg-amber-600/95 text-white':'border-sky-300/60 bg-sky-800/90 text-sky-50'}`}
                      style={{fontSize:'7px'}}>🛡 {slotRushGuard?'連撃ガード':'全体'} {gv}</div>;
                  })()}
                  {/* ★枠の中に出すものは、ぜんぶこの1本の縦積みに入れる(2026-09-22 ユーザー指摘
                      「表示が被ってて見えない」)。それまでは「置いたカードの札」「予想ダメージ」
                      「狙われている印」を別々に absolute で置き、上からの距離(top-0 / top-[18px] /
                      top-[21px])で避けていた。札が2枚になる・連撃で2行になると必ず重なる。
                      縦積みなら、いくつ増えても順番に下へ伸びるだけで重ならない。
                      ★絵の上には乗る。文字どうしが重ならなければ読めるので、
                        覆ってよいのは絵だけ、という切り分けにしている */}
                  {/* ★EXスキルの札も同じ縦積みの先頭に入れる。名前の行へ入れると名前が切れる
                      (2026-09-23 ユーザー指摘「名前が切れてる」)。二刀流／片手持ちのような「いまの状態」をここで出す */}
                  {(slotAssignedCards.length>0||previewDmg>0||previewGuard>0||slotAimHit||slotExInfo)&&(
                    <div data-tactics-slot-marks className={`${tacticsDebugLayout?'absolute top-1 left-full h-[42px] w-[150%] overflow-hidden items-stretch justify-start px-2':'absolute top-0 left-0 right-0 items-center px-0.5'} flex flex-col gap-px z-[60] pointer-events-none`}>
                      {tacticsDebugLayout&&assignedCount>0&&<div data-tactics-assigned-count={assignedCount} className="self-end rounded bg-indigo-950/85 px-1 py-0.5 text-[7px] font-black leading-none text-indigo-200 ring-1 ring-indigo-400/40">カード×{assignedCount}</div>}{!tacticsDebugLayout&&slotExInfo&&(<div data-tactics-ex-mark={i} data-tactics-ex-state={slotExInfo.badge.text}
                        className={`flex max-w-full items-center gap-0.5 rounded px-1 py-0.5 leading-none shadow ${slotExInfo.badge.active?'bg-fuchsia-600 text-white ring-1 ring-fuchsia-200':'bg-black/70 text-fuchsia-200 ring-1 ring-fuchsia-400/60'}`}>
                        <span style={{fontSize:'7px'}} className="shrink-0 font-black">EX</span>
                        {slotExInfo.badge.text!=='EX'&&<span style={{fontSize:'8px'}} className="truncate min-w-0 font-black">{slotExInfo.badge.text}</span>}
                      </div>)}
                      {slotAssignedCards.map(({idx,card})=>{
                        // ガードは軽減量をその場で出す。2枚目以降なら半分になった値をそのまま表示する
                        const gw=guardCardWeight(card), ge=cardEffectMultiplier(card,halvedByIdx[idx]);
                        const gv=gw>0?guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge,i):0;
                        // ★ガードが連撃・全体に変わったら、札に印を付ける(2026-09-22 ユーザー選択
                        //   「名前＋印に分ける」)。段階の名前は9つあり、後半は「ガード」が付かない
                        //   (金剛不壊・万象拒絶…)ので、名前そのものは変えずにとなりへ印を出す。
                        // ★全体ガードの枠は、軽減量を上の🛡が立っている子全員に出すので札には数字を重ねない。
                        //   連撃ガードの枠だけは1枚ずつの値が要る(合計は🛡に出るため)ので今までどおり
                        const guardMark=gw>0?(slotRushGuard?'連撃':(slotSpreadGuard?'全体':'')):'';
                        const spreadGuardCard=gw>0&&slotSpreadGuard&&!slotRushGuard;
                        return(
                        <div key={idx} className={`flex items-center gap-0.5 px-1 rounded w-full justify-center min-w-0 ${cardNeedsMonster(card)?'bg-red-600/85':'bg-emerald-600/85'}`}>
                          <span style={{fontSize:'7px'}} className="leading-none shrink-0">{cardIconNode(card.icon,9,card.id)}</span>
                          {guardMark&&<span data-tactics-guard-mark={guardMark} style={{fontSize:'6px'}} className="shrink-0 rounded-sm border border-amber-200/70 bg-black/60 px-0.5 font-black leading-none text-amber-200">{guardMark}</span>}
                          <span style={{fontSize:'7px'}} className="font-black text-white leading-none truncate min-w-0">{halvedByIdx[idx]?'½':''}{card.name}</span>
                          {gv>0&&!spreadGuardCard&&<span style={{fontSize:'7px'}} className="font-black text-emerald-100 leading-none shrink-0">-{gv}</span>}
                        </div>
                        );
                      })}
                      {/* 数字の段。左＝こちらが出すぶん、右＝相手から受けるぶん。
                          横に並べて場所を分けるので、両方出ても重ならない */}
                      {!tacticsDebugLayout&&(previewDmg>0||previewGuard>0||slotAimHit)&&(
                        <div className="flex w-full flex-wrap items-start justify-between gap-0.5">
                          {/* ★枠は4つ並ぶので1つ87pxしかない。字を8pxまで落として、
                              出すぶんと受けるぶんが**横1行に収まる**ようにしてある。
                              入り切らなければ折り返すので、重なることはない */}
                          {previewGuard>0&&(<div data-tactics-guard-preview={previewGuard}
                            className="rounded bg-emerald-500 px-0.5 py-0.5 text-[8px] font-black leading-none text-black shadow ring-1 ring-emerald-100">{isPendingGuardHalved?'½':''}守{previewGuard}</div>)}
                          {previewDmg>0&&(<div data-tactics-damage-preview={previewDmg}
                            className={`rounded px-0.5 py-0.5 text-[8px] font-black leading-none shadow ring-1 ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'}`}>{isPendingPreview&&isPendingHalved?'½':''}攻{previewDmg}{isPendingPreview&&previewSoulPct>0&&<span data-soul-damage-preview className="ml-0.5 rounded bg-sky-950/80 px-0.5 text-[7px] text-sky-100">魂格+{previewSoulPct}%</span>}</div>)}
                          {slotAimHit&&(<div data-tactics-aimed-damage={slotAimHit.taken} data-tactics-aimed-parts={slotAimHit.parts.length>1?slotAimHit.parts.join('・'):undefined}
                            className="ml-auto flex flex-col items-center gap-0.5 rounded border border-red-300 bg-red-950 px-0.5 py-0.5 text-[8px] font-black leading-none text-red-100 shadow-[0_0_8px_rgba(239,68,68,.85)] animate-pulse"><span>🎯{slotAimHit.taken>0?`-${slotAimHit.taken}`:''}</span>{slotAimHit.parts.length>1&&<span className="text-[7px] font-bold text-red-200/90">{slotAimHit.parts.join('・')}</span>}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 固有技をセットした枠のオーラ。⚡は絵(飾り)なので data-decoration。
                      ★重ね順は文字より下(z-[5])にする。それまでは z-40 で、置いたカードの札や
                        間合いの補正の上を回っていた(2026-09-22 ユーザー指摘「表示が被ってて見えない」) */}
                  {!ecoBattleView&&hasUniqueSet&&(
                    <div data-decoration aria-hidden="true" className="absolute inset-0 pointer-events-none z-[5] flex items-center justify-center overflow-visible">
                      <div className="absolute inset-0 rounded-xl" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(99,102,241,0.28) 50%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-0.5 rounded-xl border-2 border-purple-400/80" style={{animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      {[0,90,180,270].map(deg=>(
                        <div key={deg} className="absolute text-base" style={{transform:`rotate(${deg}deg) translateY(-26px)`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                    </div>
                  )}
                  {tacticsDebugLayout&&(previewDmg>0||previewGuard>0||slotAimHit)&&(<div data-tactics-image-previews className="absolute left-1 top-1 z-[63] flex max-w-[calc(100%-6px)] flex-wrap items-start gap-0.5 pointer-events-none">{previewDmg>0&&<span data-tactics-damage-preview={previewDmg} className={`rounded px-1 py-0.5 text-[8px] font-black leading-none shadow ring-1 ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'}`}>{isPendingPreview&&isPendingHalved?'½':''}攻{previewDmg}</span>}{previewGuard>0&&<span data-tactics-guard-preview={previewGuard} className="rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-black leading-none text-white shadow ring-1 ring-emerald-200">{isPendingGuardHalved?'½':''}守{previewGuard}</span>}{slotAimHit&&<span data-tactics-aimed-damage={slotAimHit.taken} className="rounded border border-red-300 bg-red-950 px-1 py-0.5 text-[8px] font-black leading-none text-red-100 shadow">🎯{slotAimHit.taken>0?`-${slotAimHit.taken}`:''}{slotAimHit.parts.length>1?<span className="ml-0.5 text-[7px] text-red-200/90">{slotAimHit.parts.join('・')}</span>:null}</span>}</div>)}{/* 距離補正は0%でも出す(「補正が無い」ことも情報なので、枠ごとに常に見えるようにする) */}
                  {(()=>{const totalBonus=distTotalBonus(i); return(<div className={`absolute bottom-0.5 right-0.5 text-[11px] font-black leading-none flex items-center gap-0.5 bg-black/50 px-1 py-0.5 rounded border z-30 ${totalBonus>0?'text-cyan-300 border-cyan-400/30':totalBonus<0?'text-red-300 border-red-400/30':'text-slate-300 border-white/20'}`}><Sword size={5}/>{totalBonus>0?'+':''}{(totalBonus*100).toFixed(1)}%</div>);})()}
                  {s?.imgUrl?(isAnimating&&s.id==='Pandora'&&attackAnim.motion==='pandoraDualThunder'
                    ?<PandoraDualThunder image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsDebugLayout?'58px':'64px',height:tacticsDebugLayout?'58px':'64px'}} className="object-contain drop-shadow-md"/>}/>
                    :isAnimating&&attackAnim.motion==='arkHolyRain'
                      ?<ArkHolyRainMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsDebugLayout?'58px':'64px',height:tacticsDebugLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        charging={attackAnim.charge===true}
                        empowered={attackAnim.charge===false}/>
                    :isAnimating&&attackAnim.motion==='waterBurst'
                      ?<WaterBurstMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsDebugLayout?'58px':'64px',height:tacticsDebugLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                    :isAnimating&&attackAnim.motion==='miaSongNotes'
                      ?<MiaSongNotesMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsDebugLayout?'58px':'64px',height:tacticsDebugLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                      :<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsDebugLayout?'58px':'64px',height:tacticsDebugLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>):(<span style={{fontSize:'40px'}} className="z-10 drop-shadow-md">{s?.emoji||''}</span>)}
                  {/* 倒れた子。カードを置けないことが一目で分かるように覆う */}
                  {tacticsUnit&&tacticsUnit.downed&&(()=>{
                    const revivePct=tacticsUnit.maxHp>0?Math.floor((tacticsUnit.hp/tacticsUnit.maxHp)*100):0;
                    return(<div data-tactics-down-mark={i} data-tactics-revive={`${revivePct}`}
                      className="absolute inset-0 z-[62] flex flex-col items-center justify-center rounded-xl bg-black/70 pointer-events-none">
                      <span className="text-[11px] font-black tracking-[.2em] text-slate-200">ダウン</span>
                      {/* 「全快になったら復活」なので、あとどれだけかを出さないと回復を回す判断が立たない */}
                      <span className="text-[9px] font-black text-emerald-300 leading-tight">復活まで {100-revivePct}%</span>
                    </div>);
                  })()}
                  {/* 剣士モッチーの二刀流の軌跡。エイキの桜と同じく攻撃中だけ重ねる */}
                  {isAnimating&&attackAnim.twinBlade&&<KenshiTwinSlash/>}
                  {/* エイキの桜。攻撃モーションが出ているあいだだけ重ねる(常時アニメーションにしない) */}
                  {isAnimating&&attackAnim.sakura&&<EikiSakuraPetals/>}
                </div>
                {/* ライフとガッツ(2026-09-22 ユーザー指摘「距離いれると縦が狭くなりすぎる」)。
                    ★もとは枠の上に**別の段**として4列並べていた。同じ4列が2段あるだけで、
                      枠1つぶん(55px)と余白を丸ごと使っていたので、カードの中へ入れて段を1つ減らした。
                    ★数字の大きさは前の段とほぼ同じ(10px)。小さくすると瀕死に気づけなくなるので、
                      縮めるのは**帯の高さと余白のほう**にする。
                    ★帯は必ずアニメーションさせる(ライフ duration-1000 / ガッツ duration-500)。
                      でないと回復もダメージも瞬間で増減して見える。
                    ★data-tactics-* は検査の手がかり。枠の位置が変わっても名前は変えない。
                    ★末尾の battleTutorialSpotClass('tacticsParty') は、タクティクスのれんしゅうで
                      「1体ずつのライフ」を説明するときに光らせる印。帯をカードへ入れたときに
                      落とすと、案内が何も指さないまま進む */}
                {tacticsUnit&&(()=>{
                  const hpPct=tacticsUnit.maxHp>0?Math.max(0,Math.min(100,(tacticsUnit.hp/tacticsUnit.maxHp)*100)):0;
                  const gutsPct=tacticsUnit.maxGuts>0?Math.max(0,Math.min(100,(tacticsUnit.guts/tacticsUnit.maxGuts)*100)):0;
                  return(
                    <div data-tactics-party-slot={i}
                      data-tactics-hp={`${tacticsUnit.hp}/${tacticsUnit.maxHp}`}
                      data-tactics-guts={`${tacticsUnit.guts}/${tacticsUnit.maxGuts}`}
                      data-tactics-downed={tacticsUnit.downed?'true':'false'}
                      className={`${tacticsDebugLayout?'absolute right-0 bottom-[3px] w-[60%] min-w-0 border-l flex flex-col justify-end py-px px-2 gap-0 backdrop-blur-sm':'shrink-0 border-t px-1'} z-20 border-white/[.06] bg-[linear-gradient(90deg,rgba(8,15,31,.86),rgba(15,23,42,.72))]${battleTutorialSpotClass('tacticsParty')}`}>
                      {/* ★「♥ 500 /500」と左右へ散らしていたのを、ラベルと数値の2つにそろえた
                          (2026-09-22 ユーザー指摘「カードも距離枠も全て安っぽくない？」)。
                          読む順が「何の値か → いくつか」で固定され、4枚並べたときに縦がそろう */}
                      <div className="flex h-[10px] items-center justify-between leading-none">
                        <span className="text-[8px] font-black tracking-wider text-pink-300">HP</span>
                        <span className="font-mono leading-none"><span className="text-[11px] font-black text-white">{tacticsUnit.hp}</span><span className="text-[8px] text-slate-400">/{tacticsUnit.maxHp}</span></span>
                      </div>
                      <div className="h-[2px] overflow-hidden rounded-full bg-black/60" style={{boxShadow:'inset 0 1px 2px rgba(0,0,0,.9)'}}>
                        <div data-tactics-hp-bar className={`h-full transition-all duration-1000 ${tacticsUnit.downed?'bg-gradient-to-r from-emerald-500 to-teal-300':'bg-gradient-to-r from-rose-500 to-pink-300'}`} style={{width:`${hpPct}%`,boxShadow:'0 0 6px rgba(244,114,182,.55)'}}></div>
                      </div>
                      <div className="flex h-[10px] items-center justify-between leading-none">
                        <span className="text-[8px] font-black tracking-wider text-amber-300">GUTS</span>
                        <span className="font-mono leading-none"><span className="text-[11px] font-black text-white">{tacticsUnit.guts}</span><span className="text-[8px] text-slate-400">/{tacticsUnit.maxGuts}</span></span>
                      </div>
                      <div className="h-[2px] overflow-hidden rounded-full bg-black/60" style={{boxShadow:'inset 0 1px 2px rgba(0,0,0,.9)'}}>
                        <div data-tactics-guts-bar className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-500" style={{width:`${gutsPct}%`,boxShadow:'0 0 6px rgba(251,191,36,.55)'}}></div>
                      </div>
                    </div>
                  );
                })()}
                {!tacticsDebugLayout&&<div className="h-[20px] shrink-0 ${RANGE_STYLES[i].labelBg} flex items-center justify-center border-t border-white/20 z-20"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">{RANGE_LABELS[i]}距離</span></div>}
              </button>);
            })}
          </div>
        </div>
        {/* タクティクスのEXスキルを持つ子がいる最初のバトルで1度だけ、距離枠から開けることを伝える */}
        {tacticsExIntroVisible&&<div data-tactics-ex-intro className="shrink-0 border-t border-fuchsia-400/30 bg-slate-950/95 px-2 py-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="tacticsExIntro" compact/></div>
            <button type="button" onClick={dismissTacticsExIntro} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        {/* ∞周回にした最初の1回だけ、モンビーへ行けることを伝える(PR8) */}
        {quickRhythmIntroVisible&&<div data-quick-rhythm-intro className="shrink-0 border-t border-fuchsia-400/30 bg-slate-950/95 px-2 py-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="quickRhythmIntro" compact/></div>
            <button type="button" onClick={dismissQuickRhythmIntro} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        {/* 手札の帯(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
            まっ黒なべた塗りだったので、上から下へわずかに起こし、上端に細い光を引いて
            板が1枚手前にあるように見せる。塗りだけなので描き直しは起きない */}
        <div className="shrink-0 p-1 flex flex-col relative border-t border-white/[.08] backdrop-blur-sm" style={{height:'clamp(172px,23dvh,196px)',
          backgroundImage:'linear-gradient(180deg, rgba(20,29,52,.94) 0%, rgba(12,18,34,.97) 52%, rgba(7,11,22,.99) 100%)',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.07), 0 -10px 28px rgba(0,0,0,.16)'}}>
          <div className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 flex justify-between px-2 items-center gap-1">
            {/* 勇者モンの特性で枚数が増えているときは、その分を王冠付きで出す。
                「勇者モンに選んだときだけ効く特性」が今効いていることを確かめられるようにする */}
            <span className={`flex-1 min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5${battleTutorialSpotClass('cardCount')}`}><span className="whitespace-nowrap">Action Cards</span> <span className="shrink-0 bg-white/10 text-white px-2 py-0.5 rounded-full font-mono">{selectedCards.length}/{cardLimit}</span>{heroCardBonus>0&&<span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-300/40 text-amber-200 whitespace-nowrap"><Crown size={8}/>+{heroCardBonus}</span>}{kikiCardBonus>0&&<span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-300/40 text-violet-200 whitespace-nowrap">応援+1</span>}{soulCoordinationCardBonus>0&&<span data-soul-coordination-bonus className="shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-300/40 text-sky-200 whitespace-nowrap">魂格+1</span>}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={()=>setShowDeckInfo(true)} className={`flex h-8 items-center gap-0.5 px-2 bg-white/[.035] rounded-[10px] border border-white/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] active:scale-95${battleTutorialSpotClass('deckView')}`}><Layers size={9}/><span className="text-[10px]">VIEW</span></button>
              {/* 緊急回復(2026-09-22 ユーザー指示「緊急回復は手札側の効果だから位置を変えたい」)。
                  ★もとは敵の絵の左に置いていたが、あの列は「敵や自分を見る」入口を並べた場所。
                    緊急はその場で使う行動なので、カードと同じ操作の列へ移した。
                  ★AUTO の左に置く。実行(Action)のすぐ隣だと押し間違える */}
              <button onClick={useEmergency} disabled={isBusy||autoBattle||!battleTutorialAllowsEmergency} aria-label="緊急回復" title="緊急回復" className={`shrink-0 flex h-8 w-[44px] flex-col items-center justify-center rounded-[10px] border border-blue-300/55 bg-blue-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_10px_rgba(59,130,246,.12)] leading-none active:scale-90 disabled:opacity-25${battleTutorialSpotClass('emergency')}`}><Activity size={11} className="text-blue-300"/><span className="mt-0.5 text-[10px] font-black text-blue-50">緊急</span></button>
              {/* モンビーへの入口(クイックモードだけ)。音に関わる入口なので、この並びに残す */}
              <div className="shrink-0 flex flex-col gap-0.5">
                {quickToRhythmButtonNode}
              </div>
              <div className="w-[44px] shrink-0 flex flex-col gap-0.5">
                <button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className={`h-8 w-full px-1 rounded-[10px] border font-black text-[10px] leading-tight active:scale-90 disabled:opacity-25 ${autoRepeat?'border-fuchsia-300 bg-fuchsia-500 text-slate-950 shadow-[0_0_12px_rgba(217,70,239,.65)]':autoBattle?'border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,.65)]':'border-white/[.12] bg-white/[.035] text-slate-300'}`}><span className="block">AUTO</span><span className="block text-[10px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button>
                {battleScreenActive&&isQuickMode(runMode)&&autoRepeat===true&&<button type="button" onClick={cycleEcoMode} aria-label={`省エネ ${ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}`} className={`min-h-[24px] w-full rounded-md border font-black text-[10px] leading-[9px] active:scale-90 ${ecoMode==='lite'?'border-emerald-300 bg-emerald-700 text-emerald-50':ecoMode==='ultra'?'border-lime-200 bg-lime-500 text-slate-950':'border-slate-500 bg-slate-700 text-slate-200'}`}><span className="block">省エネ</span><span className="block">{ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}</span></button>}
              </div>
              {(()=>{const allAttackAssigned=selectedCards.filter(idx=>cardNeedsMonster(hand[idx])).every(idx=>cardAssignments[idx]!=null); const canAct=!autoBattle&&!isBusy&&selectedCards.length>0&&pendingCard===null&&allAttackAssigned&&battleTutorialNeed!=='skillPicker'; // 押せないときは**理由**を出す(2026-09-18・ユーザー依頼「各コマンドをもっとよくしたい」)。
                // 灰色になるだけでは「何が足りなくて押せないのか」が分からず、
                // カードを選んだのに置き場所を決めていない、という取りこぼしに気づけなかった。
                // 押せるときの字は Action のまま(検査がこの字でボタンを押している)。
                const actionHint=canAct?null:(autoBattle||isBusy?null:(selectedCards.length===0?'カードを選ぶ':(!allAttackAssigned?'置き場所を選ぶ':null)));
                // ★EXスキルを使ったターンは、カードを選ばずに敵の番へ進められる(タクティクス専用)。
                //   併用できないEXを使ったターンはカードを選べないので、ここが無いとターンを終えられない
                if(tacticsExTurnUsed&&passTacticsTurn&&selectedCards.length===0&&!autoBattle&&!isBusy&&pendingCard===null){
                  return(<button data-tactics-ex-pass onClick={()=>passTacticsTurn()} className={`min-h-[44px] min-w-[96px] shrink-0 px-2 sm:px-5 rounded-[14px] font-black text-[11px] sm:text-[13px] whitespace-nowrap active:scale-90 flex items-center justify-center gap-1 border-2 border-black tracking-wide transition-all${battleTutorialSpotClass('action')} bg-fuchsia-200 text-black shadow-[0_0_15px_rgba(232,121,249,0.45)]`}><Play fill="currentColor" size={12}/> ターンを進める</button>);
                }
                return(<button data-battle-action onClick={()=>processTurn()} disabled={!canAct} className={`min-h-[44px] min-w-[96px] shrink-0 px-2 sm:px-5 rounded-full font-black text-[11px] sm:text-[13px] whitespace-nowrap active:scale-90 flex items-center justify-center gap-1 border-2 border-black tracking-wide transition-all${actionHint?'':' uppercase'}${battleTutorialSpotClass('action')} ${canAct?'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]':(actionHint?'bg-slate-800 text-slate-300 border-white/20':'bg-slate-700 text-slate-500 opacity-50')}`}><Play fill="currentColor" size={12}/> {actionHint||'Action'}</button>);})()}
            </div>
          </div>
          {/* 使うカードが決まっている番は、その種類だけを光らせる(枠全体は光らせない) */}
          <div className={`flex-1 flex gap-1 overflow-x-auto items-stretch scrollbar-hide px-1 pb-1 justify-center${battleTutorialCardTarget?'':battleTutorialSpotClass('cards')}`}>
            {hand.map((c,i)=>{
              const isSel=selectedCards.includes(i);
              const assignedSlot=cardAssignments[i];
              const curGuts=assignedSlot!=null?getCardGuts(c,assignedSlot):getCardGuts(c,null);
              const requiredGuts=assignedSlot!=null?curGuts:pendingCardGuts(c);
              const remainingGuts=guts-selectedCards.reduce((acc,idx)=>acc+(idx===i?0:selectedCardGuts(idx)),0);
              // 新モードは合計のガッツでは決まらない。「その子が払えるか」をアプリ側へ聞く。
              // null が返るモード(いままでの5つ)では、今までどおり合計で見る
              const cardBlock=tacticsCardBlock?tacticsCardBlock(c,i):null;
              const isSelectable=isSel||(cardBlock?cardBlock.ok:(remainingGuts>=requiredGuts&&selectedCards.length<cardLimit));
              const isPending=pendingCard===i;
              const assignedMon=assignedSlot!=null?slots[assignedSlot]:null;
              const isDragging=dragState?.active&&dragState?.cardIndex===i;
              // 練習で使わせたい種類以外は、つかむこと自体をさせない(選択も割り当ても起きない)
              const tutorialAllowed=battleTutorialCardAllowed(c);
              // 光らせるのは「いま触ってほしい種類」だけ。技変更の番は名前のところも光らせる
              const tutorialTargeted=!!battleTutorialCardTarget&&battleTutorialCardKind(c)===battleTutorialCardTarget;
              return(<div key={c.uid} className="relative flex-1 min-w-0 max-w-[20%] flex"><button data-hand-card={i} data-card-cost={requiredGuts} data-card-type={c.type} data-card-usable={isSelectable?'true':'false'} data-card-block={cardBlock&&!cardBlock.ok?cardBlock.kind:undefined} onPointerDown={(e)=>{
                if(isBusy||autoBattleRef.current||!tutorialAllowed)return;
                const pt=e.touches?e.touches[0]:e;
                cardDragActiveRef.current=false;
                setDragState({cardIndex:i, x:pt.clientX, y:pt.clientY, active:false, card:c});
              }} style={{touchAction:'none',boxShadow:tacticsDebugLayout?`${(TYPE_INLINE_STYLE[c.type]||{}).borderColor?`0 -2px 10px ${(TYPE_INLINE_STYLE[c.type]||{}).borderColor}45, `:''}inset 0 1px 0 rgba(255,255,255,.08), 0 5px 12px rgba(0,0,0,.24)`:`${(TYPE_INLINE_STYLE[c.type]||{}).borderColor?`0 0 12px ${(TYPE_INLINE_STYLE[c.type]||{}).borderColor}70, `:''}inset 0 1px 0 rgba(255,255,255,.34), inset 0 -10px 16px rgba(0,0,0,.30), 0 4px 10px rgba(0,0,0,.5)`),...(TYPE_INLINE_STYLE[c.type]||{})} } className={`relative w-full ${tacticsDebugLayout?'rounded-[12px] border':'rounded-xl border-2'} p-1 flex flex-col items-center justify-between bg-gradient-to-b ${TYPE_COLORS[c.type]} ${isDragging?'ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]':isSel?'transition-all -translate-y-1.5 ring-2 ring-cyan-300 z-20 scale-[1.03] opacity-90 saturate-[0.95] shadow-[0_0_16px_rgba(103,232,249,0.45)]':'transition-all opacity-90'} ${isPending?'ring-4 ring-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.7)]':''} ${!isSelectable&&!isSel&&!isDragging?'grayscale opacity-50':''}${tutorialTargeted?' is-battle-tutorial-spot':''}${battleTutorialCardTarget&&!tutorialTargeted?' grayscale opacity-25':''}`}>
                {isSel&&!assignedMon&&(<div className="absolute top-0.5 left-0.5 z-30 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-lg"><Check size={10} className="text-white" strokeWidth={4}/></div>)}
                {assignedMon&&(<div className="absolute top-0.5 right-0.5 z-30 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center overflow-hidden shadow-lg">{assignedMon.imgUrl?<img src={assignedMon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span className="text-[10px]">{assignedMon.emoji}</span>}</div>)}
                {/* ★data-decoration は「これは絵であって読むものではない」という目じるし。
                    使えないカードの赤い札(枚数上限など)をこの絵の上へわざと出すので、
                    文字の重なりを見る検査ではこの中身を数えない */}
                <div data-decoration className="mt-1.5 flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px] border border-white/[.16] bg-black/20" style={{boxShadow:'inset 0 1px 0 rgba(255,255,255,.25), inset 0 -4px 8px rgba(0,0,0,.35)'}}>{cardIconNode(c.icon,26,c.id)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5">{['atk','range_atk','unique'].includes(c.type)?(<div onClick={(ev)=>{ev.stopPropagation(); if(isBusy||autoBattleRef.current||Date.now()<=suppressCardClickRef.current)return; setSkillPicker({handIndex:i});}} className={`text-[11px] font-black leading-[13px] w-full whitespace-normal h-[30px] flex items-center justify-center overflow-hidden px-0.5 underline decoration-dotted decoration-white/60 underline-offset-2 active:opacity-60${battleTutorialNeedCard&&tutorialTargeted?' is-battle-tutorial-spot':''}`}>{c.name}</div>):(<div className="text-[11px] font-black leading-[13px] w-full whitespace-normal h-[30px] flex items-center justify-center overflow-hidden px-0.5">{c.name}</div>)}{(()=>{
                  // カードの表に「ジャンル」と「誰に効くか」を出す(仕様: BATTLE_NEW_MODE_PLAN.md 4.4
                  // 「単体効果と全体効果が分かるようにカード説明に表示するようにしたい」)。
                  // ★言葉はアプリ側の cardGenreLabel / cardScopeLabel から引く。カードをタップした
                  //   ときの説明が同じ関数を使っているので、表と中で言い方がずれない。
                  // ★攻撃は「攻撃・敵へ」ではなく「攻撃」だけにする。味方に効かないのは攻撃カードの
                  //   前提で、わざわざ言うと守り・支援の「単体／全体」が埋もれる
                  const genre=tacticsCardGenre?tacticsCardGenre(c):null;
                  const scope=tacticsCardScope?tacticsCardScope(c):null;
                  const text=genre?(scope&&scope!=='敵へ'?`${genre}・${scope}`:genre):'';
                  return text?<div data-card-genre={genre} data-card-scope={scope||undefined} className="w-full truncate rounded-[5px] bg-black/30 px-0.5 text-[8px] font-black leading-[11px] text-white/85">{text}</div>:null;
                })()}<div className="text-[10px] font-black bg-black/30 text-white rounded-[6px] py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{curGuts}</div></div></button>{isDragging&&ReactDOM.createPortal(<div data-tactics-drag-card-ghost className={`fixed w-[72px] rounded-[12px] border p-1 flex flex-col items-center justify-between bg-gradient-to-b ${TYPE_COLORS[c.type]} ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]`} style={{left:dragState.x,top:dragState.y,transform:'translate(-50%,-50%) rotate(-3deg) scale(1.15)',zIndex:70000,pointerEvents:'none',filter:'drop-shadow(0 12px 18px rgba(0,0,0,0.65))',...(TYPE_INLINE_STYLE[c.type]||{})}}><div data-decoration className="mt-1.5 flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[11px] border border-white/[.16] bg-black/20">{cardIconNode(c.icon,26,c.id)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5"><div className="text-[11px] font-black leading-[13px] w-full whitespace-normal h-[30px] flex items-center justify-center overflow-hidden px-0.5">{c.name}</div><div className="text-[10px] font-black bg-black/30 text-white rounded-[6px] py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{curGuts}</div></div></div>,document.body)}{cardBlock&&!cardBlock.ok&&cardBlock.short&&!isDragging&&(<div data-tactics-card-block={cardBlock.short} className="pointer-events-none absolute inset-x-0.5 top-1 z-30 rounded-md border border-rose-200 bg-rose-600 px-0.5 py-0.5 text-center text-[8px] font-black leading-tight text-white shadow-[0_2px_8px_rgba(0,0,0,.85)]">{cardBlock.short}</div>)}</div>);
            })}
          </div>
        </div>
        </>)}
        {/* バトル中の設定(2026-09-22 ユーザー指示「BGMは右上に設定ボタンみたいの作って
            そこにギブアップとかヘルプとかと一緒にまとめて」)。
            ★ヘッダーに入口を3つ並べると、WAVE名やモード名を押し出して読めなくなる。
              どれもバトル中に何度も押すものではないので、1枚めくる形にした。
            ★data-battle-quit / data-auto-bgm-button は検査の手がかり。
              置き場所が変わっても名前は変えない。
            ★背景を押しても閉じる。誤って開いたときに、指を上まで運ばずに戻れる */}
        {/* ★body の直下へ出す(ReactDOM.createPortal)。ここへ素直に置くと、画面の揺れで位置がずれる
              (2026-09-22・ユーザー報告「オートでオプション開くと行動によって位置ずれが起きる」)。
              揺れは transform で作ってあり、**transform の掛かった要素は中の position:fixed の
              基準になる**ため、揺れているあいだだけ viewport ではなく揺れる箱が基準になり、
              iPhoneのノッチ(safe-area)ぶん約47px下へ落ちていた。実測でも 52px → 103px とずれる */}
        {/* ★タクティクス専用 EXスキルの詳細(距離枠をタップすると開く)。
            ★開いただけでは発動しない。使うのは「EXスキルを使用」を押したときだけ。
            ★設定メニューと同じく body の直下へ出す(揺れの transform の中に置くと位置がずれる)。
            ★スマホ縦を先に考えて、画面の下から出す。押すボタンは親指の届く下側にまとめ、
              ホームインジケーターに掛からないよう safe-area のぶん下を空ける。背景を押しても閉じる */}
        {exPanel&&ReactDOM.createPortal((
          <div data-tactics-ex-panel={exPanel.slot} role="dialog" aria-modal="true" aria-label={`${exPanel.monName}のEXスキル`} className="fixed inset-0 z-[70000] flex items-center justify-center bg-black/70 px-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} onClick={()=>setExPanelSlot(null)}>
            {/* ★画面の真ん中に出す、ほかのダイアログと同じ大きさのカード(2026-09-23 ユーザー指摘「枠のサイズ感おかしくない？」)。
                下から出す形は横幅いっぱいで枠線が画面の端で切れ、下の余白もホームバーのぶんが二重に空いていた */}
            <div data-tactics-ex-card className="w-full max-w-[340px] rounded-3xl border-2 border-fuchsia-400/60 bg-slate-900 px-4 py-3 shadow-2xl text-white" style={{maxHeight:'100%',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-black leading-none">EX</span>
                <span data-tactics-ex-mon className="min-w-0 truncate text-[12px] font-black text-slate-300">{exPanel.monName}</span>
                {!exPanel.implemented&&<span data-tactics-ex-dev className="ml-auto shrink-0 rounded-full border border-amber-300/60 bg-amber-900/60 px-2 py-0.5 text-[10px] font-black text-amber-100">開発中</span>}
              </div>
              <div data-tactics-ex-name className="mt-1 text-[18px] font-black leading-tight text-fuchsia-100">{exPanel.def.name}</div>
              <p data-tactics-ex-desc className="mt-1.5 text-[12px] font-bold leading-relaxed text-slate-200">{exPanel.def.desc}</p>
              {!exPanel.implemented&&<p className="mt-1.5 rounded-lg border border-amber-300/40 bg-amber-950/50 px-2 py-1.5 text-[11px] font-bold leading-snug text-amber-100">効果はまだ入っていません。使うと回数と「他のカードと一緒に使えるか」の決まりだけが動きます。</p>}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px]">
                <dt className="font-bold text-slate-400">使える回数</dt>
                <dd data-tactics-ex-uses className="font-black text-white">{exPanel.remaining.unlimited?'無制限':`のこり ${exPanel.remaining.left} / ${exPanel.remaining.max}（このラン）`}</dd>
                <dt className="font-bold text-slate-400">カード</dt>
                <dd data-tactics-ex-with-cards={exPanel.def.withCards?'yes':'no'} className="font-black text-white">{exPanel.def.withCards?'同じターンにこの子も通常カードを使える':'使ったターン、この子はカードを使えない（ほかの子は使える）'}</dd>
                {exPanel.durationText&&<><dt className="font-bold text-slate-400">効果時間</dt><dd className="font-black text-white">{exPanel.durationText}</dd></>}
                {exPanel.def.conditionText&&<><dt className="font-bold text-slate-400">条件</dt><dd className="font-black text-white">{exPanel.def.conditionText}</dd></>}
                {exPanel.toggleLabel&&<><dt className="font-bold text-slate-400">いま</dt><dd data-tactics-ex-toggle className="font-black text-fuchsia-200">{exPanel.toggleLabel}</dd></>}
                {!exPanel.toggleLabel&&exPanel.active&&<><dt className="font-bold text-slate-400">いま</dt><dd data-tactics-ex-active className="font-black text-fuchsia-200">効果中</dd></>}
                {exPanel.stats&&<><dt className="font-bold text-slate-400">力／丈夫さ</dt><dd data-tactics-ex-stats className={`font-black ${exPanel.stats.changed?'text-fuchsia-200':'text-white'}`}>{exPanel.stats.atk}／{exPanel.stats.def}{exPanel.stats.changed?'（EXで変化中）':''}</dd></>}
              </dl>
              {!exPanel.check.ok&&<p data-tactics-ex-why className="mt-2 text-[11px] font-bold leading-snug text-rose-200">{exPanel.check.reason}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" data-tactics-ex-close onClick={()=>setExPanelSlot(null)} className="min-h-[44px] flex-1 rounded-xl border border-white/20 bg-slate-800 text-[13px] font-black text-slate-200 active:scale-95">閉じる</button>
                <button type="button" data-tactics-ex-use disabled={!exPanel.check.ok} onClick={()=>{ if(activateTacticsEx&&activateTacticsEx(exPanel.slot)) setExPanelSlot(null); }} className={`min-h-[44px] flex-[2] rounded-xl border-2 text-[14px] font-black active:scale-95 ${exPanel.check.ok?'border-fuchsia-300 bg-fuchsia-600 text-white shadow-[0_0_14px_rgba(217,70,239,.5)]':'border-slate-600 bg-slate-800 text-slate-500'}`}>EXスキルを使用</button>
              </div>
            </div>
          </div>
        ), document.body)}
        {showBattleMenu&&ReactDOM.createPortal((
          <div className="fixed inset-0 z-[70000] flex items-start justify-end bg-black/70 p-2" onClick={()=>setShowBattleMenu(false)}>
            <div data-battle-menu className="mt-11 flex w-[190px] flex-col gap-1.5 rounded-2xl border border-white/20 bg-slate-900 p-2 shadow-2xl" onClick={e=>e.stopPropagation()}>
              <div className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">設定</div>
              <button data-auto-bgm-button type="button" onClick={()=>{setShowBattleMenu(false);setShowAutoBgmPicker(true);}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-indigo-400/50 bg-indigo-950/60 px-2 text-[12px] font-black text-indigo-100 active:scale-95"><span className="text-[14px] leading-none">🎵</span>BGM・音量</button>
              <button type="button" onClick={()=>{setShowBattleMenu(false);openHelp();}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-2 text-[12px] font-black text-emerald-100 active:scale-95"><HelpCircle size={14}/>ヘルプ</button>
              <button data-battle-quit type="button" disabled={!!battleTutorial} onClick={()=>{setShowBattleMenu(false);setShowQuitConfirm(true);}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-red-400/50 bg-red-950/60 px-2 text-[12px] font-black text-red-100 active:scale-95 disabled:opacity-30"><Flag size={14}/>あきらめる</button>
              <button type="button" onClick={()=>setShowBattleMenu(false)} className="min-h-[36px] rounded-lg border border-white/15 bg-slate-800 text-[11px] font-black text-slate-300 active:scale-95">とじる</button>
            </div>
          </div>
        ), document.body)}
      </div>
    
  );
}

function UltimateDistanceBreakReveal({
  difficulty, extremeDifficulty, extremeRunRef, runMode, ultimateDistanceBreakLevels,
  ultimateDistanceBreakReveal,
}) {
  return (
<div data-ultimate-distance-break-reveal data-distance-break-overwrite={ultimateDistanceBreakReveal.level>=2?'true':undefined} className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:ultimateDistanceBreakReveal.level>=2?'radial-gradient(circle,rgba(69,10,10,.9),rgba(0,0,0,.99))':'radial-gradient(circle,rgba(127,29,29,.72),rgba(2,6,23,.97))'}} role="dialog" aria-modal="true" aria-label="距離弱体化発動">
    <div className={`w-full max-w-xs rounded-3xl border-2 border-red-300 px-5 py-7 ${ultimateDistanceBreakReveal.level>=2?'bg-black/95 shadow-[0_0_64px_rgba(220,38,38,.9)]':'bg-purple-950/95 shadow-[0_0_48px_rgba(239,68,68,.65)]'}`} style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-amber-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||ULTIMATE_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-red-100">{ultimateDistanceBreakReveal.level>=2?'DISTANCE BREAK OVERWRITE':'DISTANCE BREAK'}</div>
      <div className="mt-5 text-xl font-black text-white">{RANGE_LABELS[ultimateDistanceBreakReveal.distance]}距離 BREAK Lv{ultimateDistanceBreakReveal.level}</div>
      <div className="mt-2 rounded-xl border border-red-300/50 bg-black/40 py-2 text-sm font-black text-red-200">与ダメージ {100*(0.5**ultimateDistanceBreakReveal.level)}%</div>
      <div className="mt-4 border-t border-red-300/20 pt-3 text-[10px] text-purple-100"><span className="font-black text-slate-400">現在のBREAK：</span><br/><span className="font-black">{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</span></div>
    </div>
  </div>
  );
}

function EnemyRevivalReveal({
  difficulty, enemyRevivalReveal, extremeDifficulty, extremeRunRef, runMode,
}) {
  return (
<div data-extreme-revival-reveal className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:'radial-gradient(circle,rgba(51,65,85,.82),rgba(2,6,23,.98))'}} role="dialog" aria-modal="true" aria-label="死者の再起">
    <div className="w-full max-w-xs rounded-3xl border-2 border-slate-200 bg-slate-950/95 px-5 py-7 shadow-[0_0_56px_rgba(203,213,225,.7)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-slate-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||RAGNAROK_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-slate-100">DEAD RISING</div>
      <div className="mt-5 text-xl font-black text-white">死者の再起 {enemyRevivalReveal.revivalNumber}回目</div>
      <div className="mt-2 rounded-xl border border-slate-300/50 bg-black/40 py-2 text-sm font-black text-slate-200">ライフ半分で起き上がり、攻撃力+50%</div>
      <div className="mt-4 border-t border-slate-300/20 pt-3 text-[10px] text-slate-300"><span className="font-black text-slate-400">残りの再起：</span><span className="font-black">{enemyRevivalReveal.remaining}回</span></div>
    </div>
  </div>
  );
}

function ExtremeRuleOverlay({
  closeExtremeRule, difficulty, extremeDifficulty, extremeRunRef, runMode, totalTurnCount,
  ultimateDistanceBreakLevels,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-5" style={{zIndex:90500,background:'radial-gradient(circle,rgba(112,26,117,.58),rgba(2,6,23,.9))',paddingTop:'calc(1.25rem + env(safe-area-inset-top))',paddingBottom:'calc(1.25rem + env(safe-area-inset-bottom))'}} onClick={closeExtremeRule} role="dialog" aria-modal="true" aria-label="極限ルール発動">
    <div className="w-full max-w-xs max-h-full flex flex-col rounded-3xl border-2 border-fuchsia-300 bg-slate-950/95 px-5 py-6 text-center shadow-[0_0_42px_rgba(217,70,239,.65)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      {(()=>{const specialDifficulty=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);const groups=extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode));const breakRule=extremeDistanceBreakRule(specialDifficulty);return <>
        <div className="shrink-0 text-[11px] font-black tracking-[.12em] text-amber-300">⚠ {specialDifficulty} 特殊ルール</div>
        <div data-extreme-rule-intro={specialDifficulty} className="mt-3 min-h-0 flex-1 overflow-y-auto mh-scroll grid content-start gap-1.5 text-left">
          {groups.map(group=><div key={group.title} className="rounded-xl border border-fuchsia-400/25 bg-purple-950/55 px-2.5 py-1.5">
            <div className="text-[10px] font-black text-fuchsia-300">【{group.title}】</div>
            {group.lines.map(([label,value])=><div key={label} className="mt-0.5 grid grid-cols-[auto_1fr] items-start gap-2 text-[10px] font-bold leading-snug text-white"><span className="shrink-0 text-slate-300">{label}</span><b className="min-w-0 text-right">{value}</b></div>)}
          </div>)}
        </div>
        {breakRule&&<div className="mt-2 shrink-0 rounded-xl border border-amber-300/40 bg-black/45 px-3 py-2 text-left text-[10px] leading-relaxed text-slate-200">
          <div><span className="text-slate-400">現在の累計ターン：</span><b className="text-white">{totalTurnCount}</b></div>
          <div><span className="text-slate-400">現在のBREAK：</span><b className={ultimateDistanceBreakLevels.some(level=>level>0)?'text-red-200':'text-white'}>{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</b></div>
        </div>}
      </>;})()}
      <div className="mt-4 shrink-0 text-[10px] font-black tracking-widest text-fuchsia-200">タップしてバトル開始</div>
    </div>
  </div>
  );
}

function SoulBattleEffects({
  battleIntimidate, battleSoulMasus, setShowSoulBattleEffects, soulBattleParty,
  soulCoordinationCardBonus, unifiedSpecialDefense,
}) {
  return (
<div data-soul-battle-effects className="fixed inset-0 flex flex-col bg-slate-950 text-white" style={{position:'fixed',inset:0,zIndex:41000,paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-sky-400/20 px-4 pb-3">
      <div><div className="text-[10px] font-black tracking-[.25em] text-sky-400">SOUL RANK</div><h3 className="text-lg font-black text-sky-100">魂格効果</h3></div>
      <button type="button" onClick={()=>setShowSoulBattleEffects(false)} className="min-h-[44px] min-w-[64px] rounded-full bg-white/10 px-4 text-[11px] font-black active:scale-95">戻る</button>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto mh-scroll px-4 py-3 space-y-3">
      <section className="rounded-2xl border border-sky-400/30 bg-sky-950/25 p-3">
        <div className="mb-2 text-[10px] font-black text-sky-200">パーティ効果</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">被ダメージ</span><b className="text-emerald-300">-{(Math.round(soulBattleParty.damageReduction*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">特殊防御率</span><b className="text-cyan-300">{(Math.round(unifiedSpecialDefense.rate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">回避 / 反射 / 吸収</span><b className="text-slate-100">{(Math.round(unifiedSpecialDefense.evasion*10)/10)} / {(Math.round(unifiedSpecialDefense.reflect*10)/10)} / {(Math.round(unifiedSpecialDefense.absorb*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">威圧</span><b className="text-violet-300">{(Math.round(battleIntimidate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">自動ガッツ回復</span><b className="text-amber-300">×{soulBattleParty.autoGutsMultiplier.toFixed(2)}</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">使用可能カード</span><b className="text-sky-300">{soulCoordinationCardBonus>0?'+1':'変化なし'}</b></div>
        </div>
        {unifiedSpecialDefense.rate>0&&<div className="mt-2 text-[10px] leading-relaxed text-slate-400">特殊防御が発動した場合、回避・反射・吸収の比率から1つだけ発動します。</div>}
      </section>
      <section className="space-y-2">
        <div className="text-[10px] font-black text-sky-200">参加中マスモン</div>
        {battleSoulMasus.filter(m=>normalizeSoulRankStage(m.soulRankStage)>0).map(masu=>{
          const stage=normalizeSoulRankStage(masu.soulRankStage);
          const active=SOUL_TRAIT_DEFINITIONS.filter(t=>soulTraitLevel(masu,t.id)>0);
          const base=ALL_PLAYER_MONSTERS[masu.baseId];
          return <div key={masu.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2"><b className="truncate text-[11px]">{masu.name||base?.name||'マスモン'}</b><span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-950/50 px-2 py-1 text-[10px] font-black text-sky-200">魂格{['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][stage]}</span></div>
            {active.length>0?<div className="mt-2 flex flex-wrap gap-1">{active.map(t=><span key={t.id} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px]"><b className="text-slate-200">{t.name}</b> <span className="text-sky-300">{formatSoulTraitEffect(t,soulTraitEffectValue(masu,t.id))}</span></span>)}</div>:<div className="mt-2 text-[10px] text-slate-500">振り分け済みの魂格特性はありません。</div>}
          </div>;
        })}
      </section>
    </div>
  </div>
  );
}
