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
//  ・報酬の表は 35-raid-jack.jsx の RAID_JACK_REWARDS(設計書「報酬の表」)。画面は読むだけで、数字を書き写さない。
//    難易度ごとの報酬は各段階のカードの下、モード別・難易度別の一覧は「報酬一覧」から開く。受け取りは本体側(onClaimRewards)がギフトで届ける。

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

// 報酬1つぶんの中身(ダイヤ・虹のプシュケー・魂格の結晶・虹の超越の実・勇者の証。0のものは出さない)
const RaidJackRewardChips = ({ reward }) => (
  <span className="flex flex-wrap gap-x-2 gap-y-0.5">
    {raidJackRewardParts(reward).map((p) => (
      <span key={p.key} className="whitespace-nowrap text-[10px] font-black text-slate-100">{p.emoji}{p.label}<b className="ml-0.5 text-amber-200">×{p.amount.toLocaleString()}</b></span>
    ))}
  </span>
);
const RaidJackRewardRow = ({ label, note, reward, got, dataKey }) => (
  <div data-raid-jack-reward-row={dataKey} className="flex items-start gap-2 border-b border-white/5 py-1.5 last:border-b-0">
    <div className="w-[68px] shrink-0">
      <div className="text-[10px] font-black leading-tight text-orange-200">{label}</div>
      {note && <div className="text-[8px] leading-tight text-slate-400">{note}</div>}
    </div>
    <div className="min-w-0 flex-1"><RaidJackRewardChips reward={reward} /></div>
    {got && <span className="shrink-0 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[8px] font-black text-white">ギフトに届いた</span>}
  </div>
);
// 1つの段階の報酬(難易度別)。A=討伐報酬+貢献1〜5位 / B=初めて倒したとき。未解放の段階も見える
const RaidJackTierRewards = ({ kind, index, claimed }) => {
  const have = Array.isArray(claimed) ? claimed : [];
  if (kind === 'a') {
    return (
      <div data-raid-jack-tier-rewards="a">
        <RaidJackRewardRow dataKey="clear" label="討伐報酬" note="参加した全員" reward={RAID_JACK_REWARDS.aClear[index]} got={have.includes(raidJackClaimId('clear_a', index))} />
        {RAID_JACK_REWARDS.aRank[index].map((r, k) => (
          // 印を付けるのは、実際に届いた順位の行だけ(順位つきの印がある人)。順位の印が無い古い受け取りは、下の一言で伝える
          <RaidJackRewardRow key={k} dataKey={`rank-${k + 1}`} label={`貢献${k + 1}位`} reward={r} got={have.includes(raidJackPlaceId(raidJackClaimId('rank_a', index), k + 1))} />
        ))}
        {have.includes(raidJackClaimId('rank_a', index)) && !RAID_JACK_REWARDS.aRank[index].some((r, k) => have.includes(raidJackPlaceId(raidJackClaimId('rank_a', index), k + 1))) && (
          <div data-raid-jack-rank-note="delivered" className="mt-1 rounded-lg bg-emerald-950/40 px-2 py-1 text-[9px] font-black text-emerald-200">順位の報酬は、ギフトに届いています(何位かは、ギフトの名前で分かります)</div>
        )}
        {have.includes(raidJackNoneId(raidJackClaimId('rank_a', index))) && (
          <div data-raid-jack-rank-note="none" className="mt-1 rounded-lg bg-slate-800/60 px-2 py-1 text-[9px] font-black text-slate-300">この段階では、順位の報酬の対象(5位まで)になりませんでした</div>
        )}
        <div className="mt-1 text-[9px] text-slate-400">{index === RAID_JACK_A_TIERS.length - 1 ? '大王の貢献順位は、期間の終わり(11/1 4:00)に確定してギフトで届きます。' : '倒したときに順位が確定して、ギフトで届きます。'}</div>
      </div>
    );
  }
  return (
    <div data-raid-jack-tier-rewards="b">
      <RaidJackRewardRow dataKey="clear" label="初めて倒したとき" note="1回だけ" reward={RAID_JACK_REWARDS.bClear[index]} got={have.includes(raidJackClaimId('clear_b', index))} />
      <div className="mt-1 text-[9px] text-slate-400">倒した直後にギフトで届きます。順位の報酬は、全難易度の累計ダメージで決まります(報酬一覧)。</div>
    </div>
  );
};
// 報酬一覧(モード別・難易度別)。レイド画面の「報酬一覧」から開く
const RaidJackRewardList = ({ onClose, claimed, initialTab = 'a' }) => {
  const [tab, setTab] = useState(initialTab);
  const have = Array.isArray(claimed) ? claimed : [];
  return (
    <div data-raid-jack-reward-list className="fixed inset-0 z-[32000] flex flex-col bg-slate-950/95 p-3" role="dialog" aria-modal="true" aria-label="ジャックの報酬一覧"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div className="text-[14px] font-black text-orange-200">🎃 ジャックの報酬一覧</div>
        <button type="button" data-raid-jack-reward-close onClick={onClose} aria-label="報酬一覧を閉じる" className="min-h-[40px] rounded-xl border border-white/20 bg-white/10 px-4 text-[11px] font-black text-white active:scale-95">閉じる</button>
      </div>
      <ScreenTabs items={[{ id: 'a', label: 'レイドバトル' }, { id: 'b', label: 'グランドスラム' }]} value={tab} onChange={setTab} />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">参加賞(1回でも挑戦した全員・{tab === 'a' ? 'レイドバトル' : 'グランドスラム'}で1回)</div>
          <RaidJackRewardRow dataKey="participation" label="参加賞" reward={RAID_JACK_REWARDS.participation} got={have.includes(raidJackClaimId(tab === 'a' ? 'part_a' : 'part_b'))} />
        </div>
        {raidJackTiers(tab).map((t, i) => (
          <div key={t.id} data-raid-jack-reward-tier={t.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-1 text-[12px] font-black text-white">{i + 1}. {t.name}</div>
            <RaidJackTierRewards kind={tab} index={i} claimed={have} />
          </div>
        ))}
        {tab === 'b' && (
          <div data-raid-jack-reward-final className="rounded-2xl border border-orange-300/30 bg-orange-950/20 p-3">
            <div className="mb-1 text-[12px] font-black text-orange-200">累計ダメージの最終順位(全難易度の合計)</div>
            {RAID_JACK_REWARDS.bFinal.map((r, k) => (
              <RaidJackRewardRow key={k} dataKey={`final-${k + 1}`} label={`${k + 1}位`} reward={r} got={have.includes(raidJackPlaceId(raidJackClaimId('final_b'), k + 1))} />
            ))}
            <div className="mt-1 text-[9px] text-slate-400">期間の終わり(11/1 4:00)に確定して、ギフトで届きます。</div>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-300">
          🔮 魂格の結晶は、マスモンの魂格特性の画面で使うと、そのマスモンの魂格Pが1個につき+1されます。<br />
          🌈 虹の超越の実は、超越強化で超越ポイント+1に変えられます。
        </div>
      </div>
    </div>
  );
};

// ランキングの行(レイド画面の中と、ランキング画面で同じ見た目にする)。名前・アイコン・プロフィール枠は、通常バトルのランキングと同じ「いまの設定」をかぶせる
const RaidJackRankingRows = ({ rows, myId, renderPlace, renderIcon, cardClass, limit = 100 }) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <ol data-raid-jack-ranking className="space-y-1.5">
      {rows.slice(0, limit).map((r, i) => {
        const entry = typeof applyLatestBreederProfile === 'function' ? applyLatestBreederProfile({ breederId: r.breederId, userName: raidJackNameOf(r.breederId) }) : { breederId: r.breederId, userName: raidJackNameOf(r.breederId) };
        const mineRow = !!myId && r.breederId === myId;
        return (
          <li key={`${r.breederId}-${i}`} data-raid-jack-ranking-row data-ranking-kind="raid-jack" aria-current={mineRow ? 'true' : undefined}
            className={`${typeof cardClass === 'function' ? cardClass(i) : 'rounded-xl border bg-slate-900 border-white/5'} flex min-w-0 items-center gap-1.5 px-2 py-1.5 ${mineRow ? 'ring-2 ring-orange-300/70' : ''}`}>
            {typeof renderPlace === 'function' ? renderPlace(i) : <span className="w-7 shrink-0 text-center text-[10px] font-black text-amber-200">{i + 1}</span>}
            {typeof renderIcon === 'function' && renderIcon(entry)}
            <span className="min-w-0 flex-1 truncate text-[11px] font-black text-white">{entry.userName || '名無しのブリーダー'}{mineRow && <span className="ml-1 text-[8px] text-orange-200">(あなた)</span>}</span>
            <b className="shrink-0 whitespace-nowrap text-[11px] font-black text-orange-200">{r.total.toLocaleString()}<small className="ml-0.5 text-[8px] text-slate-400">ダメージ</small></b>
          </li>
        );
      })}
    </ol>
  );
};
// ランキング画面(レイド画面の「ランキング」ボタンから開く)。モード別(レイドバトル/グランドスラム)・レイドバトルは段階別。
//   レイドバトルは、大王が倒れたあとだけ「累計ダメージ(全段階の合計)」も見られる。上位100位まで。自分の記録と順位は圏外でも出る
const RaidJackRankingList = ({ onClose, eventId, initialTab = 'a', initialTier = 0, bossDown = false, renderPlace, renderIcon, cardClass }) => {
  const [tab, setTab] = useState(initialTab);
  const [tierIdx, setTierIdx] = useState(Math.min(Math.max(initialTier, 0), RAID_JACK_A_TIERS.length - 1));
  const [allMode, setAllMode] = useState(false);   // A の「累計ダメージ(全段階の合計)」。大王が倒れたあとだけ選べる
  const [rows, setRows] = useState(undefined);     // undefined=読み込み中 / null=準備中 / 配列
  const [self, setSelf] = useState(null);
  const [myId, setMyId] = useState(null);
  const [ahead, setAhead] = useState(null);
  const useAll = tab === 'a' && allMode && bossDown;
  useEffect(() => {
    let alive = true;
    (async () => {
      setRows(undefined); setAhead(null);
      const meId = await ensureBreederId();
      if (!alive) return;
      setMyId(meId || null);
      const mine = meId ? await sbFetchRaidJackSelf(meId, eventId) : null;
      if (!alive) return;
      setSelf(mine);
      const list = useAll ? await sbFetchRaidJackARanking(100, eventId)
        : tab === 'a' ? await sbFetchRaidJackContributions(tierIdx + 1, 100, eventId) : await sbFetchRaidJackBRanking(100, eventId);
      if (!alive) return;
      if (list) { try { await ensureBreederProfiles('raid-jack'); } catch (e) { /* 名前が引けなくても順位は出る */ } }
      if (!alive) return;
      setRows(list);
      if (list && mine) {
        const myTotal = useAll ? Object.values(mine.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (mine.a[tierIdx + 1] || 0) : mine.bTotal;
        const count = myTotal > 0 ? await sbCountRaidJackAhead(useAll ? 'a_all' : tab, tierIdx + 1, myTotal, eventId) : null;
        if (alive) setAhead(count);
      }
    })();
    return () => { alive = false; };
  }, [tab, tierIdx, useAll, eventId]);
  const myTotal = self ? (useAll ? Object.values(self.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (self.a[tierIdx + 1] || 0) : self.bTotal) : 0;
  const title = useAll ? 'レイドバトルの累計ダメージ(全段階の合計)' : tab === 'a' ? `${RAID_JACK_A_TIERS[tierIdx].name}への貢献ランキング` : 'グランドスラムの累計ダメージ(5難易度の合計)';
  return (
    <div data-raid-jack-ranking-list className="fixed inset-0 z-[32000] flex flex-col bg-slate-950/95 p-3" role="dialog" aria-modal="true" aria-label="ジャックのランキング"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div className="text-[14px] font-black text-orange-200">🏆 ジャックのランキング</div>
        <button type="button" data-raid-jack-ranking-close onClick={onClose} aria-label="ランキングを閉じる" className="min-h-[40px] rounded-xl border border-white/20 bg-white/10 px-4 text-[11px] font-black text-white active:scale-95">閉じる</button>
      </div>
      <ScreenTabs items={[{ id: 'a', label: 'レイドバトル' }, { id: 'b', label: 'グランドスラム' }]} value={tab} onChange={setTab} />
      {tab === 'a' && (
        <div data-raid-jack-ranking-tiers className="mb-2 flex shrink-0 flex-wrap gap-1.5 text-[10px] font-black">
          {RAID_JACK_A_TIERS.map((t, i) => (
            <button type="button" key={t.id} data-raid-jack-ranking-tier={t.id} onClick={() => { setTierIdx(i); setAllMode(false); }}
              className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${!useAll && tierIdx === i ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{t.name.replace('ジャック', '')}</button>
          ))}
          {bossDown && (
            <button type="button" data-raid-jack-ranking-all onClick={() => setAllMode(true)}
              className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${useAll ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>累計ダメージ</button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="font-black text-orange-200">{title}</span>
          {myTotal > 0 && <span data-raid-jack-ranking-mine className="shrink-0 text-[10px] text-slate-200">あなた {myTotal.toLocaleString()}{ahead !== null ? `(${ahead + 1}位)` : ''}</span>}
        </div>
        <div className="mb-2 text-[9px] text-slate-400">{useAll ? '全段階へ与えたダメージの合計です。' : tab === 'a' ? '1〜5位に報酬があります。男爵〜公爵は倒れた時点、大王は期間の終わりに順位が決まります(報酬一覧)。' : '1〜5位に報酬があります。期間の終わりに順位が決まります(報酬一覧)。'}</div>
        {rows === undefined && <div className="py-3 text-center text-[10px] text-slate-400">読み込み中…</div>}
        {rows === null && <div className="py-3 text-center text-[10px] text-slate-400">ランキングは準備中です</div>}
        {Array.isArray(rows) && rows.length === 0 && <div className="py-3 text-center text-[10px] text-slate-400">まだ記録がありません。いちばんのりを目指そう！</div>}
        <RaidJackRankingRows rows={rows} myId={myId} renderPlace={renderPlace} renderIcon={renderIcon} cardClass={cardClass} />
      </div>
    </div>
  );
};

// renderPlace / renderIcon / cardClass … 通常バトルの全国ランキングと同じ部品(60-app.jsx の rankingPlace / rankingBreederIcon / rankingCardClass)。
//   順位のメダル・ブリーダーのアイコン(プロフィール枠つき)・1位の金色のカードを、レイドでも同じ見た目にそろえる
const RaidJackScreen = ({ onBack, onChallenge, onPurchase, onClaimRewards, beatPoints = 0, eventId, forced = false, unlimited = false, guideVisible = false, onDismissGuide, renderPlace, renderIcon, cardClass }) => {
  const [tab, setTab] = useState('a');
  const [sel, setSel] = useState({ a: 0, b: 0 });
  const [state, setState] = useState(() => raidJackDefaultState());
  const [totals, setTotals] = useState(undefined);       // undefined=読み込み中 / null=準備中 / object
  const [rows, setRows] = useState(undefined);           // 選択中のランキング(A=その段階の貢献 / B=累計)
  const [self, setSelf] = useState(null);
  const [myId, setMyId] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  const [showRewards, setShowRewards] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  // 大王を倒したあと、レイドバトルのランキングを「大王への貢献」から「累計ダメージ(全段階の合計)」へ切り替えられる
  const [aAll, setAAll] = useState(false);
  const nowMs = Date.now();
  const windowState = raidJackWindowAt(nowMs);
  const open = forced || windowState === 'open';

  // 読み込み(サーバーの合計・自分の状態・ランキング)。タブや段階を変えるたびに、そのぶんだけ読み直す
  useEffect(() => {
    let alive = true;
    (async () => {
      let loaded = await raidJackLoadState();
      if (!alive) return;
      // 受け取れる報酬があればギフトで届け(本体側)、届いたら受け取り済みの印を読み直す
      const granted = typeof onClaimRewards === 'function' ? await onClaimRewards() : 0;
      if (!alive) return;
      // 受け取り(と、端末の印の修復)で記録が変わっていることがあるので、読み直す
      loaded = await raidJackLoadState();
      if (granted > 0) setMessage(`ジャックの報酬が${granted}件、ギフトに届きました`);
      setState(loaded);
      const meId = await ensureBreederId();
      if (alive) setMyId(meId || null);
      const t = await sbFetchRaidJackTierTotals(eventId);
      if (!alive) return;
      setTotals(t);
      const mine = meId ? await sbFetchRaidJackSelf(meId, eventId) : null;
      if (!alive) return;
      setSelf(mine);
      setRows(undefined); setAhead(null);
      // 大王を倒したか(共有の合計が大王のライフ以上)。倒したあとだけ「累計ダメージ」のランキングを選べる
      const bossDown = !!t && !!t.a && !!t.a[RAID_JACK_A_TIERS.length] && t.a[RAID_JACK_A_TIERS.length].total >= RAID_JACK_A_TIERS[RAID_JACK_A_TIERS.length - 1].hp;
      const useAll = tab === 'a' && aAll && bossDown;
      const list = useAll ? await sbFetchRaidJackARanking(100, eventId)
        : tab === 'a' ? await sbFetchRaidJackContributions(sel.a + 1, 100, eventId) : await sbFetchRaidJackBRanking(100, eventId);
      if (!alive) return;
      if (list) { try { await ensureBreederProfiles('raid-jack'); } catch (e) { /* 名前が引けなくても順位は出る */ } }
      if (!alive) return;
      setRows(list);
      if (list && mine) {
        const myTotal = useAll ? Object.values(mine.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (mine.a[sel.a + 1] || 0) : mine.bTotal;
        const count = myTotal > 0 ? await sbCountRaidJackAhead(useAll ? 'a_all' : tab, sel.a + 1, myTotal, eventId) : null;
        if (alive) setAhead(count);
      }
    })();
    return () => { alive = false; };
  }, [tab, tab === 'a' ? sel.a : 0, tick, eventId, aAll]);

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
  const bossDownNow = tab === 'a' && !!totals && aDefeated(tiers.length - 1);
  const showAll = bossDownNow && aAll;
  const myTotalHere = self ? (showAll ? Object.values(self.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (self.a[current + 1] || 0) : self.bTotal) : 0;

  const buy = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await onPurchase(tab);
      if (result && result.ok) { setMessage(`追加の挑戦を1回ぶん買いました(ビートP ${RAID_JACK_EXTRA_COST_BEAT_P})`); setTick((n) => n + 1); }
      else setMessage(result && result.reason === 'short' ? 'ビートPが足りません' : '買えませんでした。もう一度ためしてください');
    } finally { setBusy(false); }
  };

  // 倒した段階(男爵〜公爵)には挑めない。貢献順位が倒れたときに固まり、報酬がその場で決まるため。大王だけは倒したあとも続く
  const closedTier = tab === 'a' && !unlimited && current < tiers.length - 1 && aDefeated(current);
  const challengeLabel = !open ? (windowState === 'before' ? 'まだ始まっていません' : '終了しました')
    : !isOpenTier ? '前の段階を倒すと開きます' : closedTier ? 'この段階は倒されました(次の段階へ)' : remaining <= 0 ? '今日の挑戦回数がありません' : 'この段階に挑戦する';

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
      <div className="mb-2 grid shrink-0 grid-cols-2 gap-2">
        <button type="button" data-raid-jack-ranking-open onClick={() => setShowRanking(true)}
          className="min-h-[40px] rounded-xl border border-orange-300/60 bg-orange-950/50 px-3 text-[12px] font-black text-orange-100 active:scale-95">🏆 ランキング</button>
        <button type="button" data-raid-jack-reward-list-open-top onClick={() => setShowRewards(true)}
          className="min-h-[40px] rounded-xl border border-orange-300/60 bg-orange-950/50 px-3 text-[12px] font-black text-orange-100 active:scale-95">🎁 報酬一覧</button>
      </div>
      {message && <div className="mb-2 shrink-0 text-center text-[11px] font-black text-amber-200" role="status">{message}</div>}
      {totals === null && <div className="mb-2 shrink-0 rounded-xl border border-amber-400/40 bg-amber-950/30 p-2 text-center text-[10px] text-amber-100">サーバーを準備中です。みんなの記録は少し待ってから見られます(戦った記録はあとで自動で送られます)</div>}

      <div className={`${SCREEN_LIST_CLASS} space-y-2`}>
        {tiers.map((t, i) => {
          const isOpen = unlocked(i);
          const left = tab === 'a' ? Math.max(0, t.hp - aTotalOf(i)) : t.hp;
          const done = tab === 'a' ? aDefeated(i) : state.b.defeated.includes(t.id);
          // 大王を倒したあとの段階5は、小さなぱんぷきんが相手(共有ライフは無限・毎回ぜんかいのライフから)
          const isPumpkin = tab === 'a' && i === tiers.length - 1 && done;
          const on = i === current;
          return (
            <button type="button" key={t.id} data-raid-jack-tier={t.id} onClick={() => setSel((prev) => ({ ...prev, [tab]: i }))}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left active:scale-[0.99] ${on ? 'border-orange-300 bg-orange-950/40' : 'border-white/10 bg-slate-900/60'}`}>
              {/* 段階ごとに見た目が変わる(オーラの炎・絵の光の色)。未解放は黒いシルエットのまま */}
              <span data-jack-aura={isOpen && !isPumpkin ? i + 1 : undefined} data-raid-pumpkin={isPumpkin ? 'true' : undefined} className="relative block h-14 w-16 shrink-0">
                {isOpen && !isPumpkin && <JackAuraLayer tier={i + 1} limit={8} />}
                {isPumpkin
                  ? <img src={PUMPKIN_ICON_IMG} alt="" className="relative mx-auto h-14 w-14 object-contain" />
                  : <img src={JACK_IMG} alt="" className="relative h-14 w-16 object-contain"
                      style={isOpen ? { filter: raidJackAuraGlowFilter(i + 1, 0.4) } : { filter: 'brightness(0)', opacity: 0.5 }} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-black text-white">{i + 1}. {isPumpkin ? RAID_JACK_PUMPKIN.name : t.name}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isPumpkin ? 'bg-amber-500 text-slate-950' : done ? 'bg-emerald-600 text-white' : isOpen ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    {isPumpkin ? 'あそびに来た' : done ? '討伐済み' : isOpen ? '挑戦できる' : '未解放'}
                  </span>
                </div>
                {tab === 'a' ? (
                  isPumpkin ? (
                    <div data-raid-pumpkin-note className="text-[10px] leading-snug text-amber-100">共有ライフは無限です。毎回ぜんかいのライフから戦い、与えたダメージが累計に足されます{totals && totals.a && totals.a[i + 1] ? `(${totals.a[i + 1].players.toLocaleString()}人が参加)` : ''}</div>
                  ) : isOpen ? (
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

        <div data-raid-jack-rewards className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] text-slate-100">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-black text-orange-200">{tier.name}の報酬</span>
            <button type="button" data-raid-jack-reward-list-open onClick={() => setShowRewards(true)}
              className="min-h-[32px] shrink-0 rounded-xl border border-orange-300/50 bg-orange-950/40 px-3 text-[10px] font-black text-orange-100 active:scale-95">報酬一覧</button>
          </div>
          <RaidJackTierRewards kind={tab} index={current} claimed={state.claimed} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 flex items-baseline justify-between text-[11px]">
            <span className="font-black text-orange-200">{showAll ? 'レイドバトルの累計ダメージ(全段階の合計)' : tab === 'a' ? `${tier.name}への貢献ランキング` : '累計ダメージランキング(5段階の合計)'}</span>
            {myTotalHere > 0 && <span data-raid-jack-mine className="text-[10px] text-slate-200">あなた {myTotalHere.toLocaleString()}{ahead !== null ? `(${ahead + 1}位)` : ''}</span>}
          </div>
          {bossDownNow && (
            <div data-raid-jack-all-toggle className="mb-2 flex gap-1.5 text-[10px] font-black">
              {[[false, '大王への貢献'], [true, '累計ダメージ']].map(([v, label]) => (
                <button type="button" key={label} data-raid-jack-all-mode={v ? 'all' : 'tier'} onClick={() => setAAll(v)}
                  className={`min-h-[32px] flex-1 rounded-xl border px-2 active:scale-95 ${aAll === v ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{label}</button>
              ))}
            </div>
          )}
          {rows === undefined && <div className="py-3 text-center text-[10px] text-slate-400">読み込み中…</div>}
          {rows === null && <div className="py-3 text-center text-[10px] text-slate-400">ランキングは準備中です</div>}
          {Array.isArray(rows) && rows.length === 0 && <div className="py-3 text-center text-[10px] text-slate-400">まだ記録がありません。いちばんのりを目指そう！</div>}
          <RaidJackRankingRows rows={rows} myId={myId} renderPlace={renderPlace} renderIcon={renderIcon} cardClass={cardClass} />
        </div>
      </div>

      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-raid-jack-challenge disabled={!open || !isOpenTier || closedTier || remaining <= 0}
          onClick={() => onChallenge(tab, current)}
          className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
          {challengeLabel}
        </button>
      </div>
      {showRanking && <RaidJackRankingList eventId={eventId} initialTab={tab} initialTier={current} bossDown={bossDownNow} renderPlace={renderPlace} renderIcon={renderIcon} cardClass={cardClass} onClose={() => setShowRanking(false)} />}
      {showRewards && <RaidJackRewardList claimed={state.claimed} initialTab={tab} onClose={() => setShowRewards(false)} />}
    </div>
  );
};

// 編成。A: 解放済みのベースモンから / B: 編成に入れているマスモンから。勇者1体+供モン最大3体。アシカは A=1枚 / B=3枚まで
const RaidJackPrepScreen = ({ kind, tierIndex, candidates, teachings, onBack, onStart, restore = null, onOpenDetail }) => {
  const isB = kind === 'b';
  const maxTeach = RAID_JACK_TEACHING_MAX;   // レイドバトルもグランドスラムも、アシカは3枚まで(数字は 35-raid-jack.jsx)
  const tier = raidJackTierAt(kind, tierIndex);
  const list = Array.isArray(candidates) ? candidates : [];
  const keyOf = (mon) => String(mon.masuId || mon.id);
  // 配置画面から戻ってきたときは、選んでいた編成のまま(restore)
  const [heroKey, setHeroKey] = useState(restore && restore.heroKey ? restore.heroKey : null);
  const [allyKeys, setAllyKeys] = useState(restore && Array.isArray(restore.allyKeys) ? restore.allyKeys : []);
  const [teachIds, setTeachIds] = useState(() => (restore && Array.isArray(restore.teachIds)) ? restore.teachIds : (Array.isArray(teachings) ? teachings : []).slice(0, maxTeach).map((t) => t.id));
  const hero = list.find((m) => keyOf(m) === heroKey) || null;
  const allies = allyKeys.map((k) => list.find((m) => keyOf(m) === k)).filter(Boolean);
  const toggleAlly = (mon) => setAllyKeys((prev) => {
    const k = keyOf(mon);
    if (prev.includes(k)) return prev.filter((x) => x !== k);
    return prev.length >= RAID_JACK_ALLY_MAX ? prev : [...prev, k];
  });
  const toggleTeach = (id) => setTeachIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= maxTeach ? (maxTeach === 1 ? [id] : prev) : [...prev, id])));
  // 選ぶときにモンスターの詳細(ステータス・技・適性など)を見られる(2026-10-05・ユーザー指示)。
  // 詳細のボタンは、選ぶボタンの入れ子にならないよう、外側のdivの右上に重ねて置く(押しても選択は変わらない)
  const tile = (mon, on, onClick, attrs) => (
    <div key={keyOf(mon)} className="relative">
    <button type="button" onClick={onClick} {...attrs}
      className={`flex w-full flex-col items-center rounded-xl border-2 p-1 text-center active:scale-95 ${on ? 'border-orange-300 bg-orange-950/50' : 'border-white/10 bg-slate-900/60'}`}>
      {(() => {
        // 本番のプロフィールのアイコンと同じ見え方(拡大・位置の調整つき)にそろえる
        const face = friendsFaceIconOf(mon.baseId || mon.id);
        return face
          ? <BreederIcon src={face.src} id={face.id} className="h-12 w-12 bg-slate-800" />
          : <img src={mon.faceIconUrl || mon.iconUrl || mon.imgUrl} alt="" className="h-12 w-12 rounded-full bg-slate-800 object-contain" />;
      })()}
      <span className="mt-0.5 w-full truncate text-[9px] font-black text-slate-100">{mon.name}</span>
    </button>
    {typeof onOpenDetail === 'function' && (
      <button type="button" data-raid-detail={keyOf(mon)} aria-label={`${mon.name}の詳細を見る`} onClick={(e) => { e.stopPropagation(); onOpenDetail(mon); }}
        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-sky-300/60 bg-slate-800 text-[11px] font-black leading-none text-sky-200 shadow active:scale-90">i</button>
    )}
    </div>
  );
  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden`} data-raid-jack-prep>
      <ScreenHead title={`${tier.name}に挑む`} icon="🎃" accent="text-orange-200" onBack={onBack}
        note={`${isB ? 'マスモン' : 'ベースモン'}で編成・20ターン勝負`} />
      <div className={`${SCREEN_LIST_CLASS} space-y-3`}>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">勇者モン(1体)<span className="ml-1 text-[9px] font-normal text-slate-300">右上の <b className="text-sky-200">i</b> でモンスターの詳細が見られます</span></div>
          <div className="grid grid-cols-5 gap-1.5">
            {list.map((mon) => tile(mon, heroKey === keyOf(mon), () => { setHeroKey(keyOf(mon)); setAllyKeys((prev) => prev.filter((x) => x !== keyOf(mon))); }, { 'data-raid-hero': keyOf(mon) }))}
          </div>
          {list.length === 0 && <div className="py-2 text-center text-[10px] text-slate-400">編成できるモンスターがいません</div>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">供モン(最大{RAID_JACK_ALLY_MAX}体)<span className="ml-1 text-[9px] text-slate-300">{allies.length} / {RAID_JACK_ALLY_MAX}</span></div>
          <div className="grid grid-cols-5 gap-1.5">
            {list.filter((m) => keyOf(m) !== heroKey).map((mon) => tile(mon, allyKeys.includes(keyOf(mon)), () => toggleAlly(mon), { 'data-raid-ally': keyOf(mon) }))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">アシカ({maxTeach}つまで)<span className="ml-1 text-[9px] text-slate-300">{teachIds.length} / {maxTeach}</span></div>
          <div className="text-[9px] text-slate-300">{isB ? '最大レベルから始まります(戦闘中は成長しません)' : '固有技は3・5・8・11ターン目に2段階ずつ、アシカは3・5ターン目に1段階ずつ強くなります(3枚まで選べます)'}</div>
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
          onClick={() => onStart({ party: [hero, ...allies], teachingIds: teachIds, heroKey, allyKeys })}
          className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
          {hero ? 'この編成で挑戦する' : '勇者モンを選んでください'}
        </button>
      </div>
    </div>
  );
};
