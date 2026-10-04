// ==================== ジャック確認(デバッグ専用) ====================
// イベント・レイドボス「ジャック」を、公開フラグ・期間・時刻を待たずに確かめる画面。
// 入口はデバッグ設定(DEBUG_SETTINGS)だけで、通常プレイには一切出さない。
// デバッグ専用なので更新履歴・ヘルプには載せない(CLAUDE.md ⑤の但し書き)。設計: docs/spec/RAID_BOSS_JACK.md
//
// 何をするか(実装した段階ごとに、ここへ確認の入口を足していく)
//   ① 定義: 5段階×2種類の名前・倍率・ライフ・技の本数・技名(35-raid-jack.jsx をそのまま表にする)
//   ② 期間と回数: 「いま」を前・中・後に動かしたときの判定、今日の残り回数
//   ③ 端末の記録(mh_raid_jack_v1): 回数・倒した段階・再送待ちの確認と初期化(★保存します)
//   ⑤ 絵と技: バトルの立ち絵2枚・顔アイコン、段階ごとに使う技(実際の行動表 tacticsActionDefinitions)
//   ⑦ 画面: HOMEのジャック(強制表示)・レイド画面を、公開フラグと期間を待たずに開く(記録は別のイベントID)
//   ⑥ 戦う: ジャック戦(専用の1戦)を、段階を選んで始める。回数は使わず、送る記録も別のイベントID(raid_jack_debug)
//   ④ サーバー: 本番の集計(raid_jack_2026)を汚さない別のイベントID(raid_jack_debug)で、
//      テスト送信・段階ごとの合計・Bの上位・再送待ちの送り直しを試す
const RAID_JACK_DEBUG_NOW_CHOICES = Object.freeze([
  { id: 'real', label: 'いま(本物)' },
  { id: 'before', label: '開始の1分前', at: () => Date.parse(RAID_JACK_EVENT.startAt) - 60000 },
  { id: 'open', label: '開始の1分後', at: () => Date.parse(RAID_JACK_EVENT.startAt) + 60000 },
  { id: 'after', label: '終了の1分後', at: () => Date.parse(RAID_JACK_EVENT.endAt) + 60000 },
]);

const RaidJackDebugScreen = ({ onBack, onStartBattle, raidForce = false, onToggleRaidForce, realRules = false, onToggleRealRules, onOpenRaid, onGoHome }) => {
  const [nowChoice, setNowChoice] = useState('real');
  const [state, setState] = useState(() => raidJackDefaultState());
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState(undefined);   // undefined=未取得 / null=準備中 / object
  const [ranking, setRanking] = useState(undefined);
  const [testDamage, setTestDamage] = useState(1000);
  const [testKind, setTestKind] = useState('a');
  const [testTier, setTestTier] = useState(1);
  const [fightKind, setFightKind] = useState('a');
  const [fightTier, setFightTier] = useState(1);
  const say = (text) => setLog((prev) => [`${new Date().toLocaleTimeString('ja-JP')} ${text}`, ...prev].slice(0, 12));

  useEffect(() => {
    let alive = true;
    raidJackLoadState().then((loaded) => { if (alive) setState(loaded); });
    return () => { alive = false; };
  }, []);

  const choice = RAID_JACK_DEBUG_NOW_CHOICES.find((c) => c.id === nowChoice) || RAID_JACK_DEBUG_NOW_CHOICES[0];
  const nowMs = choice.at ? choice.at() : Date.now();
  const windowLabel = { before: '開始前', open: '開催中', after: '終了後' }[raidJackWindowAt(nowMs)];
  const save = async (next) => { const ok = await raidJackSaveState(next); setState(raidJackNormalizeState(next)); say(ok ? '端末の記録を保存しました' : '保存できませんでした'); };
  const withBusy = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const sendTest = () => withBusy(async () => {
    const breederId = await ensureBreederId();
    if (!breederId) { say('ブリーダーIDが作れず、送れません'); return; }
    const hit = { hitId: raidJackMakeHitId(), kind: testKind, tier: testTier, damage: Math.max(0, Math.floor(Number(testDamage) || 0)), defeated: false };
    const { state: next, outcome } = await raidJackSubmitHit(state, hit, breederId, RAID_JACK_DEBUG_EVENT_ID);
    await raidJackSaveState(next); setState(next);
    say(`テスト送信(${testKind.toUpperCase()}${testTier}・${hit.damage}): ${({ sent: '送れました', notready: '準備中(SQL未適用)', invalid: '形が違うので送りません', error: '通信できず再送待ちへ' })[outcome] || outcome}`);
  });
  const flush = () => withBusy(async () => {
    const breederId = await ensureBreederId();
    const next = await raidJackFlushPending(state, breederId, RAID_JACK_DEBUG_EVENT_ID);
    await raidJackSaveState(next); setState(next);
    say(`再送待ちを送り直しました(残り ${next.pending.length} 件)`);
  });
  const fetchAll = () => withBusy(async () => {
    const t = await sbFetchRaidJackTierTotals(RAID_JACK_DEBUG_EVENT_ID);
    setTotals(t);
    const r = await sbFetchRaidJackBRanking(100, RAID_JACK_DEBUG_EVENT_ID);
    setRanking(r);
    say(t === null ? '取得できません(準備中か通信エラー)' : '段階ごとの合計とBの上位を取得しました');
  });

  const cell = 'border border-white/10 px-1.5 py-1 text-[10px]';
  const tierTable = (label, tiers) => (
    <div className="overflow-x-auto">
      <div className="mb-1 text-[11px] font-black text-cyan-200">{label}</div>
      <table className="w-full border-collapse text-slate-100">
        <thead><tr className="bg-white/10"><th className={cell}>段階</th><th className={cell}>名前</th><th className={cell}>倍率</th><th className={cell}>ライフ</th><th className={cell}>技</th>{totals ? <th className={cell}>削った量</th> : null}</tr></thead>
        <tbody>{tiers.map((t, i) => (
          <tr key={t.id}><td className={cell}>{i + 1}</td><td className={cell}>{t.name}</td><td className={cell}>{t.power}</td><td className={`${cell} text-right`}>{t.hp.toLocaleString()}</td><td className={cell}>{t.actionCount}本</td>
            {totals ? <td className={`${cell} text-right`}>{((totals[t.id[0]] || {})[i + 1]?.total || 0).toLocaleString()}</td> : null}</tr>
        ))}</tbody>
      </table>
    </div>
  );
  const btn = 'min-h-[44px] rounded-xl border px-2 text-center text-[11px] font-black leading-tight active:scale-95 disabled:opacity-40';

  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-y-auto`} data-raid-jack-debug>
      <DebugScreenHead title="ジャック確認" note="イベント・レイドボス「ジャック」の確認。サーバーへのテスト送信は別のイベントID(raid_jack_debug)で、本番の集計に入りません" saves onBack={onBack} />
      <div className="space-y-3 pb-8">
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-amber-200">① 公開フラグと期間</div>
          <div>公開フラグ(RAID_JACK_PUBLIC_RELEASE): <b>{RELEASE_FLAGS.raidJack === true ? 'true(公開中)' : 'false(公開前)'}</b></div>
          <div className="mt-1">期間: {RAID_JACK_EVENT.startAt.replace('T', ' ').slice(0, 16)} 〜 {RAID_JACK_EVENT.endAt.replace('T', ' ').slice(0, 16)}(仮)</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RAID_JACK_DEBUG_NOW_CHOICES.map((c) => (
              <button key={c.id} onClick={() => setNowChoice(c.id)} className={`${btn} ${nowChoice === c.id ? 'border-amber-300 bg-amber-900/50 text-amber-50' : 'border-white/20 bg-white/5 text-slate-200'}`}>{c.label}</button>
            ))}
          </div>
          <div className="mt-2">この時刻の判定: <b className="text-amber-200">{windowLabel}</b>(日付キー {raidJackDayKey(nowMs)})</div>
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[11px] font-black text-amber-200">② 段階の定義(ライフ = 35,000×倍率×10)</div>
          {tierTable('A: ベースモン協力戦(共有HP)', RAID_JACK_A_TIERS)}
          {tierTable('B: マスモンの累計ダメージ(ランキングは共有)', RAID_JACK_B_TIERS)}
          <div className="text-[10px] text-slate-300">技名: {Object.entries(RAID_JACK_SKILL_NAMES).map(([k, v]) => `${k}=${v}`).join(' / ')}</div>
        </section>

        <section className="rounded-2xl border border-rose-400/40 bg-rose-950/20 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-rose-200">③ 端末の記録(mh_raid_jack_v1)★保存します</div>
          <div>今日の残り回数: A {raidJackRemaining(state.a, nowMs)} / B {raidJackRemaining(state.b, nowMs)}(無料{RAID_JACK_FREE_PER_DAY}回+買い足し)</div>
          <div>倒した段階: A [{state.a.defeated.join(',')}] / B [{state.b.defeated.join(',')}]・開いている段階: A {raidJackUnlockedCount('a', state.a.defeated)} / B {raidJackUnlockedCount('b', state.b.defeated)}</div>
          <div>Bの自分用の累計: {state.b.total.toLocaleString()}・再送待ち: {state.pending.length}件・受け取り済み報酬: {state.claimed.length}件</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button className={`${btn} border-rose-400/60 bg-rose-950/40`} onClick={() => save(raidJackDefaultState())}>記録を初期化</button>
            <button className={`${btn} border-rose-400/60 bg-rose-950/40`} onClick={() => save({ ...state, a: { ...state.a, day: raidJackDayKey(nowMs), used: RAID_JACK_FREE_PER_DAY }, b: { ...state.b, day: raidJackDayKey(nowMs), used: RAID_JACK_FREE_PER_DAY } })}>今日の無料回数を使い切る</button>
            <button className={`${btn} border-rose-400/60 bg-rose-950/40`} onClick={() => save({ ...state, a: { ...state.a, defeated: [] }, b: { ...state.b, defeated: [] } })}>倒した段階をリセット</button>
            <button className={`${btn} border-rose-400/60 bg-rose-950/40`} onClick={() => save({ ...state, b: { ...state.b, defeated: RAID_JACK_B_TIERS.slice(0, 4).map((t) => t.id) }, a: { ...state.a, defeated: RAID_JACK_A_TIERS.slice(0, 4).map((t) => t.id) } })}>手前4段階を倒した状態にする</button>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-400/40 bg-cyan-950/20 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-cyan-200">④ サーバー(別のイベントID raid_jack_debug)</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select value={testKind} onChange={(e) => setTestKind(e.target.value)} className="rounded border border-white/20 bg-slate-900 px-1 py-2 text-[11px]"><option value="a">A(協力)</option><option value="b">B(累計)</option></select>
            <select value={testTier} onChange={(e) => setTestTier(Number(e.target.value))} className="rounded border border-white/20 bg-slate-900 px-1 py-2 text-[11px]">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>段階{n}</option>)}</select>
            <input type="number" min="0" max="100000000" value={testDamage} onChange={(e) => setTestDamage(e.target.value)} className="w-28 rounded border border-white/20 bg-slate-900 px-1 py-2 text-[11px]" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button disabled={busy} className={`${btn} border-cyan-400/60 bg-cyan-950/40`} onClick={sendTest}>テスト送信</button>
            <button disabled={busy} className={`${btn} border-cyan-400/60 bg-cyan-950/40`} onClick={flush}>再送待ちを送る</button>
            <button disabled={busy} className={`${btn} border-cyan-400/60 bg-cyan-950/40`} onClick={fetchAll}>合計と上位を取得</button>
          </div>
          {totals === null && <div className="mt-2 text-amber-200">準備中(docs/sql/raid/ のSQLが未適用か、通信できません)</div>}
          {Array.isArray(ranking) && (
            <div className="mt-2">Bの上位(デバッグ分): {ranking.length === 0 ? 'まだありません' : ranking.slice(0, 10).map((r, i) => `${i + 1}位 ${r.breederId.slice(0, 6)}… ${r.total.toLocaleString()}`).join(' / ')}</div>
          )}
        </section>

        <section className="rounded-2xl border border-orange-400/40 bg-orange-950/20 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-orange-200">⑦ HOMEのジャックとレイド画面(公開フラグ・期間を待たずに)</div>
          <div className="text-[10px] text-slate-300">強制表示を入れると、HOMEの真ん中にジャックが出ます。レイド画面・編成・追加購入・戦闘が、別のイベントID(raid_jack_debug)の記録で動きます。追加購入でビートPは減りません。初めは何度でも挑め、全段階を選べます(本番どおりの回数・解放で見たいときは下のボタン)。</div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button data-raid-force-toggle className={`${btn} ${raidForce ? 'border-amber-300 bg-amber-900/50 text-amber-50' : 'border-orange-400/60 bg-orange-950/40'}`} onClick={() => onToggleRaidForce && onToggleRaidForce()}>HOMEに出す: {raidForce ? 'ON' : 'OFF'}</button>
            <button data-raid-real-rules-toggle className={`${btn} col-span-2 ${realRules ? 'border-amber-300 bg-amber-900/50 text-amber-50' : 'border-orange-400/60 bg-orange-950/40'}`} onClick={() => onToggleRealRules && onToggleRealRules()}>本番どおりの回数・解放で確認: {realRules ? 'ON' : 'OFF'}(OFFは何度でも・全段階)</button>
            <button data-raid-open className={`${btn} border-orange-400/60 bg-orange-950/40`} onClick={() => onOpenRaid && onOpenRaid()}>レイド画面を開く</button>
            <button data-raid-go-home className={`${btn} col-span-2 border-orange-400/60 bg-orange-950/40`} onClick={() => onGoHome && onGoHome()}>HOMEを見る(ジャックが出ているか確認)</button>
          </div>
        </section>

        <section className="rounded-2xl border border-orange-400/40 bg-orange-950/20 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-orange-200">⑥ ジャックと戦う(回数は使わない・別のイベントIDで送る)</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select data-raid-fight-kind value={fightKind} onChange={(e) => setFightKind(e.target.value)} className="rounded border border-white/20 bg-slate-900 px-1 py-2 text-[11px]"><option value="a">A(ベースモン・協力戦)</option><option value="b">B(マスモン・累計ダメージ)</option></select>
            <select data-raid-fight-tier value={fightTier} onChange={(e) => setFightTier(Number(e.target.value))} className="rounded border border-white/20 bg-slate-900 px-1 py-2 text-[11px]">
              {raidJackTiers(fightKind).map((t, i) => <option key={t.id} value={i + 1}>{i + 1}: {t.name}</option>)}
            </select>
          </div>
          <div className="mt-1 text-[10px] text-slate-300">{(() => { const t = raidJackTierAt(fightKind, fightTier - 1); return `${t.name}: ライフ ${t.hp.toLocaleString()} / 攻撃 ${t.atk.toLocaleString()} / 技 ${t.actionCount}本 / 10ターン${fightKind === 'a' ? '(3・5・8ターン目に固有技とアシカが成長)' : '(成長なし・アシカは最大Lv)'}`; })()}</div>
          <button data-raid-fight-start className={`${btn} mt-2 w-full border-orange-400/60 bg-orange-950/40`} onClick={() => { if (onStartBattle && onStartBattle(fightKind, fightTier - 1) === false) say('編成できるモンスターがいません'); }}>この条件でジャックと戦う</button>
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="text-[11px] font-black text-amber-200">⑤ 絵と、段階ごとに使う技</div>
          <div className="flex items-end justify-around gap-2 rounded-xl bg-slate-900/70 p-2">
            <figure className="text-center text-[9px] text-slate-300"><img src={JACK_IMG} alt="ジャック(通常)" className="mx-auto h-24 object-contain" />通常</figure>
            <figure className="text-center text-[9px] text-slate-300"><img src={JACK_POSE_IMG} alt="ジャック(ポーズ)" className="mx-auto h-24 object-contain" />両腕ポーズ</figure>
            <figure className="text-center text-[9px] text-slate-300"><img src={JACK_ICON_IMG} alt="ジャック(顔アイコン)" className="mx-auto h-16 object-contain" />顔アイコン</figure>
          </div>
          <div className="text-[10px] text-slate-200">
            {[...RAID_JACK_A_TIERS, ...RAID_JACK_B_TIERS].map((t) => (
              <div key={t.id} className="mt-1"><b>{t.name}</b>({t.actionCount}本): {tacticsEnemyActionIds('Jack', 'Normal', t.actionCount).map((id) => (TACTICS_ENEMY_DATA.Jack.actions[id] || id)).join(' / ')}</div>
            ))}
            <div className="mt-1 text-slate-400">通常攻撃「{TACTICS_ENEMY_DATA.Jack.normal}」・必殺技「{TACTICS_ENEMY_DATA.Jack.special}」は全段階で使う(再生なし)</div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-slate-200">ログ</div>
          {log.length === 0 ? <div className="text-[10px] text-slate-400">まだ何もしていません</div> : log.map((l, i) => <div key={i} className="text-[10px] text-slate-300">{l}</div>)}
        </section>
      </div>
    </div>
  );
};
