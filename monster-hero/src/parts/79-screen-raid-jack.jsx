// ==================== イベント・レイドボス「ジャック」(レイド画面と編成画面) ====================
// 設計の正本: docs/spec/RAID_BOSS_JACK.md
//   RAID_JACK      … A(ベースモン協力戦・段階ごとの共有HP)とB(マスモンの累計ダメージ)。残り回数・追加購入・ランキング
//   RAID_JACK_PREP … 編成(勇者1体+供モン最大3体)とアシカえらび。始めると専用の1戦(60-app.jsx の startRaidJackBattle)へ
//
// 決めごと:
//  ・この画面は表示と選択だけ。回数を使う・ビートPを払う・戦闘を始めるのは本体側(onChallenge / onPurchase / onStart)。
//  ・サーバー(36-raid-jack-api.jsx)が準備中(SQL未適用)・通信できないときも、画面は壊さず「準備中」と出す。
//  ・A の段階は「前の段階の共有HPが0になったら開く」。未解放はシルエットで見せる(報酬も見えるようにする)。
//  ・B の段階は「自分が前の段階を倒したら開く」。解放した段階にはいつでも戻れる。
//  ・報酬の中身はまだ決まっていないので「準備中」と出す(決まったらここへ差し込む)。
const RAID_JACK_REWARD_NOTE = '報酬の中身は準備中です(決まりしだいここに出ます)';

// ランキングの1行ぶんの名前(ブリーダー名)。プロフィールが引けない人は「名無しのブリーダー」
const raidJackNameOf = (breederId) => {
  const profile = typeof latestBreederProfileFor === 'function' ? latestBreederProfileFor({ breederId }) : null;
  return (profile && profile.userName) || '名無しのブリーダー';
};

const RaidJackHpBar = ({ left, max, tone = 'orange' }) => {
  const rate = max > 0 ? Math.max(0, Math.min(1, left / max)) : 0;
  const color = tone === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500';
  return (
    <div className="h-3 w-full overflow-hidden rounded-full border border-white/20 bg-black/50" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0, left)}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${rate * 100}%` }} />
    </div>
  );
};

const RaidJackScreen = ({ onBack, onChallenge, onPurchase, beatPoints = 0, eventId, forced = false, unlimited = false, guideVisible = false, onDismissGuide }) => {
  const [tab, setTab] = useState('a');
  const [sel, setSel] = useState({ a: 0, b: 0 });
  const [state, setState] = useState(() => raidJackDefaultState());
  const [totals, setTotals] = useState(undefined);       // undefined=読み込み中 / null=準備中 / object
  const [rows, setRows] = useState(undefined);           // 選択中のランキング(A=その段階の貢献 / B=累計)
  const [self, setSelf] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  const nowMs = Date.now();
  const windowState = raidJackWindowAt(nowMs);
  const open = forced || windowState === 'open';

  // 読み込み(サーバーの合計・自分の状態・ランキング)。タブや段階を変えるたびに、そのぶんだけ読み直す
  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await raidJackLoadState();
      if (!alive) return;
      setState(loaded);
      const myId = await ensureBreederId();
      const t = await sbFetchRaidJackTierTotals(eventId);
      if (!alive) return;
      setTotals(t);
      const mine = myId ? await sbFetchRaidJackSelf(myId, eventId) : null;
      if (!alive) return;
      setSelf(mine);
      setRows(undefined); setAhead(null);
      const list = tab === 'a' ? await sbFetchRaidJackContributions(sel.a + 1, 100, eventId) : await sbFetchRaidJackBRanking(100, eventId);
      if (!alive) return;
      if (list) { try { await ensureBreederProfiles('raid-jack'); } catch (e) { /* 名前が引けなくても順位は出る */ } }
      if (!alive) return;
      setRows(list);
      if (list && mine) {
        const myTotal = tab === 'a' ? (mine.a[sel.a + 1] || 0) : mine.bTotal;
        const count = myTotal > 0 ? await sbCountRaidJackAhead(tab, sel.a + 1, myTotal, eventId) : null;
        if (alive) setAhead(count);
      }
    })();
    return () => { alive = false; };
  }, [tab, tab === 'a' ? sel.a : 0, tick, eventId]);

  const side = tab === 'a' ? state.a : state.b;
  // デバッグの強制表示中は、回数は無制限・全段階を最初から選べる
  const remaining = unlimited ? Infinity : raidJackRemaining(side, nowMs);
  const tiers = raidJackTiers(tab);
  const aTotalOf = (i) => (totals && totals.a && totals.a[i + 1] ? totals.a[i + 1].total : 0);
  const aDefeated = (i) => totals ? aTotalOf(i) >= tiers[i].hp : false;
  const unlocked = unlimited ? () => true : tab === 'a'
    ? (i) => i === 0 || aDefeated(i - 1)
    : (i) => i < raidJackUnlockedCount('b', state.b.defeated);
  const current = Math.min(sel[tab], tiers.length - 1);
  const tier = tiers[current];
  const isOpenTier = unlocked(current);
  const myTotalHere = self ? (tab === 'a' ? (self.a[current + 1] || 0) : self.bTotal) : 0;

  const buy = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await onPurchase(tab);
      if (result && result.ok) { setMessage(`追加の挑戦を1回ぶん買いました(ビートP ${RAID_JACK_EXTRA_COST_BEAT_P})`); setTick((n) => n + 1); }
      else setMessage(result && result.reason === 'short' ? 'ビートPが足りません' : '買えませんでした。もう一度ためしてください');
    } finally { setBusy(false); }
  };

  const challengeLabel = !open ? (windowState === 'before' ? 'まだ始まっていません' : '終了しました')
    : !isOpenTier ? '前の段階を倒すと開きます' : remaining <= 0 ? '今日の挑戦回数がありません' : 'この段階に挑戦する';

  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden`} data-raid-jack-screen>
      <ScreenHead title="カボチャの大王ジャック" icon="🎃" accent="text-orange-200" onBack={onBack}
        note={forced ? '(デバッグ表示・別のイベントIDの記録)' : '全員でジャックを倒そう'} />
      {guideVisible && (
        <div data-raid-jack-guide className="mb-2 shrink-0">
          <AssistantBubble scene="raidJackIntro" compact />
          <button type="button" data-raid-jack-guide-close onClick={onDismissGuide}
            className="mt-1 w-full min-h-[36px] rounded-xl border border-orange-300/50 bg-orange-950/40 text-[11px] font-black text-orange-100 active:scale-95">わかった</button>
        </div>
      )}
      <ScreenTabs items={[{ id: 'a', label: 'レイドバトル' }, { id: 'b', label: 'グランドスラム' }]} value={tab} onChange={setTab} />
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-slate-100">
        <div>
          <div className="font-black text-orange-200">{tab === 'a' ? 'ベースモンで挑戦' : 'マスモンで挑戦'}</div>
          <div data-raid-jack-remaining>{unlimited ? <>今日の残り <b className="text-white">無制限</b>(デバッグ・全段階を選べます)</> : <>今日の残り <b className="text-white">{remaining}</b> 回(無料{RAID_JACK_FREE_PER_DAY}回+買い足し)</>}</div>
        </div>
        <button type="button" data-raid-jack-buy disabled={busy || !open || unlimited} onClick={buy}
          className="min-h-[40px] shrink-0 rounded-xl border border-amber-400/60 bg-amber-950/40 px-3 text-[11px] font-black leading-tight text-amber-100 active:scale-95 disabled:opacity-40">
          1回追加<br /><small className="text-[9px] opacity-80">ビートP {RAID_JACK_EXTRA_COST_BEAT_P}(所持 {beatPoints})</small>
        </button>
      </div>
      {message && <div className="mb-2 shrink-0 text-center text-[11px] font-black text-amber-200" role="status">{message}</div>}
      {totals === null && <div className="mb-2 shrink-0 rounded-xl border border-amber-400/40 bg-amber-950/30 p-2 text-center text-[10px] text-amber-100">サーバーを準備中です。みんなの記録は少し待ってから見られます(戦った記録はあとで自動で送られます)</div>}

      <div className={`${SCREEN_LIST_CLASS} space-y-2`}>
        {tiers.map((t, i) => {
          const isOpen = unlocked(i);
          const left = tab === 'a' ? Math.max(0, t.hp - aTotalOf(i)) : t.hp;
          const done = tab === 'a' ? aDefeated(i) : state.b.defeated.includes(t.id);
          const on = i === current;
          return (
            <button type="button" key={t.id} data-raid-jack-tier={t.id} onClick={() => setSel((prev) => ({ ...prev, [tab]: i }))}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left active:scale-[0.99] ${on ? 'border-orange-300 bg-orange-950/40' : 'border-white/10 bg-slate-900/60'}`}>
              {/* 段階ごとに見た目が変わる(オーラの炎・絵の光の色)。未解放は黒いシルエットのまま */}
              <span data-jack-aura={isOpen ? i + 1 : undefined} className="relative block h-14 w-16 shrink-0">
                {isOpen && <JackAuraLayer tier={i + 1} limit={8} />}
                <img src={JACK_IMG} alt="" className="relative h-14 w-16 object-contain"
                  style={isOpen ? { filter: raidJackAuraGlowFilter(i + 1, 0.4) } : { filter: 'brightness(0)', opacity: 0.5 }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-black text-white">{i + 1}. {t.name}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${done ? 'bg-emerald-600 text-white' : isOpen ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {done ? '討伐済み' : isOpen ? '挑戦できる' : '未解放'}
                  </span>
                </div>
                {tab === 'a' ? (
                  isOpen ? (
                    <>
                      <RaidJackHpBar left={left} max={t.hp} tone={done ? 'emerald' : 'orange'} />
                      <div className="mt-0.5 text-[9px] text-slate-300">共有HP {left.toLocaleString()} / {t.hp.toLocaleString()}{totals && totals.a && totals.a[i + 1] ? `(${totals.a[i + 1].players.toLocaleString()}人が参加)` : ''}</div>
                    </>
                  ) : <div className="text-[10px] text-slate-400">前の段階のジャックを倒すと姿をあらわします</div>
                ) : (
                  <div className="text-[10px] text-slate-300">ライフ {t.hp.toLocaleString()} / 技 {t.actionCount}本{isOpen ? '' : '(前の段階を倒すと開く)'}</div>
                )}
              </div>
            </button>
          );
        })}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-100">
          <div className="mb-1 font-black text-orange-200">{tier.name}の報酬</div>
          <div className="text-[10px] text-slate-300">{RAID_JACK_REWARD_NOTE}</div>
          <div className="mt-2 text-[10px] text-slate-300">{tab === 'a' ? '討伐報酬(参加者全員)・貢献ランキング1〜5位の報酬' : '初めて倒したときの報酬・累計ダメージ上位の報酬'}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="font-black text-orange-200">{tab === 'a' ? `${tier.name}への貢献ランキング` : '累計ダメージランキング(5段階の合計)'}</span>
            {myTotalHere > 0 && <span data-raid-jack-mine className="text-[10px] text-slate-200">あなた {myTotalHere.toLocaleString()}{ahead !== null ? `(${ahead + 1}位)` : ''}</span>}
          </div>
          {rows === undefined && <div className="py-3 text-center text-[10px] text-slate-400">読み込み中…</div>}
          {rows === null && <div className="py-3 text-center text-[10px] text-slate-400">ランキングは準備中です</div>}
          {Array.isArray(rows) && rows.length === 0 && <div className="py-3 text-center text-[10px] text-slate-400">まだ記録がありません。いちばんのりを目指そう！</div>}
          {Array.isArray(rows) && rows.length > 0 && (
            <ol data-raid-jack-ranking className="space-y-1">
              {rows.slice(0, 100).map((r, i) => (
                <li key={`${r.breederId}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-2 py-1 text-[11px] text-slate-100">
                  <span className="w-7 shrink-0 text-right font-black text-amber-200">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{raidJackNameOf(r.breederId)}</span>
                  <b className="shrink-0 text-white">{r.total.toLocaleString()}</b>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-raid-jack-challenge disabled={!open || !isOpenTier || remaining <= 0}
          onClick={() => onChallenge(tab, current)}
          className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
          {challengeLabel}
        </button>
      </div>
    </div>
  );
};

// 編成。A: 解放済みのベースモンから / B: 編成に入れているマスモンから。勇者1体+供モン最大3体。アシカは A=1枚 / B=3枚まで
const RaidJackPrepScreen = ({ kind, tierIndex, candidates, teachings, onBack, onStart }) => {
  const isB = kind === 'b';
  const maxTeach = 3;   // レイドバトルもグランドスラムも、アシカは3枚まで
  const tier = raidJackTierAt(kind, tierIndex);
  const list = Array.isArray(candidates) ? candidates : [];
  const keyOf = (mon) => String(mon.masuId || mon.id);
  const [heroKey, setHeroKey] = useState(null);
  const [allyKeys, setAllyKeys] = useState([]);
  const [teachIds, setTeachIds] = useState(() => (Array.isArray(teachings) ? teachings : []).slice(0, maxTeach).map((t) => t.id));
  const hero = list.find((m) => keyOf(m) === heroKey) || null;
  const allies = allyKeys.map((k) => list.find((m) => keyOf(m) === k)).filter(Boolean);
  const toggleAlly = (mon) => setAllyKeys((prev) => {
    const k = keyOf(mon);
    if (prev.includes(k)) return prev.filter((x) => x !== k);
    return prev.length >= 3 ? prev : [...prev, k];
  });
  const toggleTeach = (id) => setTeachIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= maxTeach ? (maxTeach === 1 ? [id] : prev) : [...prev, id])));
  const tile = (mon, on, onClick, attrs) => (
    <button type="button" key={keyOf(mon)} onClick={onClick} {...attrs}
      className={`flex flex-col items-center rounded-xl border-2 p-1 text-center active:scale-95 ${on ? 'border-orange-300 bg-orange-950/50' : 'border-white/10 bg-slate-900/60'}`}>
      {(() => {
        // 本番のプロフィールのアイコンと同じ見え方(拡大・位置の調整つき)にそろえる
        const face = friendsFaceIconOf(mon.baseId || mon.id);
        return face
          ? <BreederIcon src={face.src} id={face.id} className="h-12 w-12 bg-slate-800" />
          : <img src={mon.faceIconUrl || mon.iconUrl || mon.imgUrl} alt="" className="h-12 w-12 rounded-full bg-slate-800 object-contain" />;
      })()}
      <span className="mt-0.5 w-full truncate text-[9px] font-black text-slate-100">{mon.name}</span>
    </button>
  );
  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden`} data-raid-jack-prep>
      <ScreenHead title={`${tier.name}に挑む`} icon="🎃" accent="text-orange-200" onBack={onBack}
        note={`${isB ? 'マスモン' : 'ベースモン'}で編成・20ターン勝負`} />
      <div className={`${SCREEN_LIST_CLASS} space-y-3`}>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">勇者モン(1体)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {list.map((mon) => tile(mon, heroKey === keyOf(mon), () => { setHeroKey(keyOf(mon)); setAllyKeys((prev) => prev.filter((x) => x !== keyOf(mon))); }, { 'data-raid-hero': keyOf(mon) }))}
          </div>
          {list.length === 0 && <div className="py-2 text-center text-[10px] text-slate-400">編成できるモンスターがいません</div>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">供モン(最大3体)<span className="ml-1 text-[9px] text-slate-300">{allies.length} / 3</span></div>
          <div className="grid grid-cols-5 gap-1.5">
            {list.filter((m) => keyOf(m) !== heroKey).map((mon) => tile(mon, allyKeys.includes(keyOf(mon)), () => toggleAlly(mon), { 'data-raid-ally': keyOf(mon) }))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">アシカ({maxTeach}つまで)<span className="ml-1 text-[9px] text-slate-300">{teachIds.length} / {maxTeach}</span></div>
          <div className="text-[9px] text-slate-300">{isB ? '最大レベルから始まります(戦闘中は成長しません)' : '3・5・8ターン目に1段階ずつ強くなります(3枚まで選べます)'}</div>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {(Array.isArray(teachings) ? teachings : []).map((t) => (
              <button type="button" key={t.id} data-raid-teach={t.id} onClick={() => toggleTeach(t.id)}
                className={`flex flex-col items-center rounded-xl border-2 p-1 text-center active:scale-95 ${teachIds.includes(t.id) ? 'border-orange-300 bg-orange-950/50' : 'border-white/10 bg-slate-900/60'}`}>
                {/* 手札のカードと同じ見え方(きき のように全身の絵は、カード用の拡大・位置の補正で顔に寄せる) */}
                {cardIconNode(t.icon, 40, t.id)}
                <span className="mt-0.5 w-full truncate text-[9px] font-black text-slate-100">{t.baseName}</span>
              </button>
            ))}
          </div>
        </section>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[10px] text-slate-300">
          ライフ {tier.hp.toLocaleString()} / 技 {tier.actionCount}本 / 20ターンで終わります。始めると今日の挑戦回数を1回使います。途中でやめても回数は戻りませんが、そこまでのダメージは記録されます。
        </div>
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-raid-prep-start disabled={!hero}
          onClick={() => onStart({ party: [hero, ...allies], teachingIds: teachIds })}
          className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
          {hero ? 'この編成で挑戦する' : '勇者モンを選んでください'}
        </button>
      </div>
    </div>
  );
};
