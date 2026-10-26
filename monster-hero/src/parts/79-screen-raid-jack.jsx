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
// 名前を「…」で切らず、枠の幅に合わせて字を縮めて1行に収める(320 で「オボロゲ…」と切れていた。2026-10-27 カゲあつくん)。
//   編成の枠の名前(67-screen-pick.jsx・#3857)と同じ形
const RaidJackFitName = ({ label, size = 9, className = 'text-slate-100' }) => (
  <span className={`mt-0.5 w-full overflow-hidden whitespace-nowrap font-black leading-tight [container-type:inline-size] ${className}`}>
    <span className="block" style={{ fontSize: `min(${size}px, calc(100cqw / ${[...String(label || '')].length + 0.3}))` }}>{label}</span>
  </span>
);
// 画面の見出しも同じ形で縮める(320 で「カボチャの大王ジャッ」と右の端で切れていた。2026-10-27 ダメダシくん)。
//   見出しの残りの幅いっぱいに置き、字の数で割った大きさ(上限は見出しのふだんの 20px)にする。斜体ぶん少し余らせる
const RaidJackFitTitle = ({ text }) => (
  <span data-raid-jack-fit-title className="block min-w-0 flex-1 overflow-hidden whitespace-nowrap [container-type:inline-size]">
    <span className="block pr-1" style={{ fontSize: `min(1.25rem, calc(100cqw / ${[...text].length + 0.8}))` }}>{text}</span>
  </span>
);
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
      {/* 「初めて倒した／とき」と言葉の途中で折れていたので、言葉の切れ目で折る(2026-10-27 カゲあつくん) */}
      <div className="text-[10px] font-black leading-tight text-orange-200" style={JA_WRAP_STYLE}>{jaWrap(label)}</div>
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
    <div data-raid-jack-reward-list className="fixed inset-0 z-[32000] flex flex-col bg-slate-950 p-3" role="dialog" aria-modal="true" aria-label="ジャックの報酬一覧"
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
//   レイドバトルは「累計ダメージ(全段階の合計)」もいつでも見られる(2026-10-15 社長「合計もいつでも累計を出す」。前は大王が倒れたあとだけ)。
//   順位の報酬は、これまでどおり段階ごとの貢献で決まる。上位100位まで。自分の記録と順位は圏外でも出る
const RaidJackRankingList = ({ onClose, eventId, initialTab = 'a', initialTier = 0, renderPlace, renderIcon, cardClass }) => {
  const [tab, setTab] = useState(initialTab);
  const [tierIdx, setTierIdx] = useState(Math.min(Math.max(initialTier, 0), RAID_JACK_A_TIERS.length - 1));
  const [allMode, setAllMode] = useState(false);   // A の「累計ダメージ(全段階の合計)」。合計・バトル・モンヒロビートのどれでもいつでも選べる
  const [maxHit, setMaxHit] = useState(false);     // 「1戦の最大ダメージ」ランキング(A・Bどちらでも・報酬なし)
  const [rows, setRows] = useState(undefined);     // undefined=読み込み中 / null=準備中 / 配列
  const [self, setSelf] = useState(null);
  const [myId, setMyId] = useState(null);
  const [ahead, setAhead] = useState(null);
  const [myMax, setMyMax] = useState(null);
  const [maxTier, setMaxTier] = useState(0);       // 最大ダメージの難易度(0=全難易度 / 1〜5)
  const [src, setSrc] = useState('all');         // A の与ダメージの種類: 'all'(合計) / 'battle'(バトル) / 'rhythm'(モンヒロビート)
  const useSrc = tab === 'a' && src !== 'all';
  const srcName = src === 'rhythm' ? 'モンヒロビート' : 'バトル';
  const useAll = !maxHit && tab === 'a' && allMode;
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
      const list = useSrc ? await sbFetchRaidJackSourceRanking(src, maxHit ? maxTier : useAll ? 0 : tierIdx + 1, maxHit ? 'max' : 'total', 100, eventId)
        : maxHit ? await sbFetchRaidJackMaxHitRanking(tab, 100, eventId, maxTier)
        : useAll ? await sbFetchRaidJackARanking(100, eventId)
        : tab === 'a' ? await sbFetchRaidJackContributions(tierIdx + 1, 100, eventId) : await sbFetchRaidJackBRanking(100, eventId);
      if (!alive) return;
      if (list) { try { await ensureBreederProfiles('raid-jack'); } catch (e) { /* 名前が引けなくても順位は出る */ } }
      if (!alive) return;
      setRows(list);
      if (list && useSrc) {
        const tierArg = maxHit ? maxTier : useAll ? 0 : tierIdx + 1;
        const metric = maxHit ? 'max' : 'total';
        const best = meId ? await sbFetchRaidJackSourceSelf(meId, src, tierArg, metric, eventId) : null;
        if (!alive) return;
        setMyMax(best);
        const count = best > 0 ? await sbCountRaidJackSourceAhead(src, tierArg, metric, best, eventId) : null;
        if (alive) setAhead(count);
      } else if (list && maxHit) {
        const best = meId ? await sbFetchRaidJackMaxHitSelf(meId, tab, eventId, maxTier) : null;
        if (!alive) return;
        setMyMax(best);
        const count = best > 0 ? await sbCountRaidJackMaxHitAhead(tab, best, eventId, maxTier) : null;
        if (alive) setAhead(count);
      } else if (list && mine) {
        const myTotal = useAll ? Object.values(mine.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (mine.a[tierIdx + 1] || 0) : mine.bTotal;
        const count = myTotal > 0 ? await sbCountRaidJackAhead(useAll ? 'a_all' : tab, tierIdx + 1, myTotal, eventId) : null;
        if (alive) setAhead(count);
      }
    })();
    return () => { alive = false; };
  }, [tab, tierIdx, useAll, maxHit, maxTier, src, eventId]);
  const myTotal = (useSrc || maxHit) ? (Number(myMax) || 0) : self ? (useAll ? Object.values(self.a).reduce((sum, n) => sum + (Number(n) || 0), 0) : tab === 'a' ? (self.a[tierIdx + 1] || 0) : self.bTotal) : 0;
  const maxTierName = maxTier >= 1 ? raidJackTiers(tab)[maxTier - 1].name : '全難易度';
  const title = useSrc && maxHit ? `${srcName}の最大ダメージ(${src === 'rhythm' ? '1曲' : '1戦'}あたり・${maxTierName})`
    : useSrc ? `${srcName}で与えたダメージの合計(${useAll ? '全段階の合計' : `${RAID_JACK_A_TIERS[tierIdx].name.replace('ジャック', '')}`})`
    : maxHit ? `${tab === 'a' ? 'レイドバトル' : 'グランドスラム'}の最大ダメージ(1戦あたり・${maxTierName})` : useAll ? 'レイドバトルの累計ダメージ(全段階の合計)' : tab === 'a' ? `${RAID_JACK_A_TIERS[tierIdx].name}への貢献ランキング` : 'グランドスラムの累計ダメージ(5難易度の合計)';
  return (
    <div data-raid-jack-ranking-list className="fixed inset-0 z-[32000] flex flex-col bg-slate-950 p-3" role="dialog" aria-modal="true" aria-label="ジャックのランキング"
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <div className="text-[14px] font-black text-orange-200">🏆 ジャックのランキング</div>
        <button type="button" data-raid-jack-ranking-close onClick={onClose} aria-label="ランキングを閉じる" className="min-h-[40px] rounded-xl border border-white/20 bg-white/10 px-4 text-[11px] font-black text-white active:scale-95">閉じる</button>
      </div>
      <ScreenTabs items={[{ id: 'a', label: 'レイドバトル' }, { id: 'b', label: 'グランドスラム' }]} value={tab} onChange={(next) => { setTab(next); setMaxTier(0); setSrc('all'); }} />
      {/* 絞り込みの札は2段まで(320 で4段になり、ランキングが下の半分しか使えなかった。2026-10-27 ダメダシくん)。
          種類と遊び方を1段にまとめ、入りきらないぶんは横に送る */}
      <div className="mb-1.5 flex shrink-0 gap-1.5 overflow-x-auto mh-scroll whitespace-nowrap text-[10px] font-black [&>*]:shrink-0">
      <div data-raid-jack-ranking-kinds className="flex shrink-0 gap-1.5">
        <button type="button" data-raid-jack-ranking-kind="total" onClick={() => setMaxHit(false)}
          className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${!maxHit ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{tab === 'a' ? '貢献・累計' : '累計ダメージ'}</button>
        <button type="button" data-raid-jack-ranking-kind="max" onClick={() => setMaxHit(true)}
          className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${maxHit ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>1戦の最大ダメージ</button>
      </div>
      {tab === 'a' && (
        <div data-raid-jack-ranking-sources className="flex shrink-0 gap-1.5 border-l border-white/15 pl-1.5">
          {[['all', '合計'], ['battle', 'バトル'], ['rhythm', 'モンヒロビート']].map(([id, label]) => (
            <button type="button" key={id} data-raid-jack-ranking-source={id} onClick={() => setSrc(id)}
              className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${src === id ? 'border-fuchsia-300 bg-fuchsia-900 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{label}</button>
          ))}
        </div>
      )}
      </div>
      {maxHit && (
        <div data-raid-jack-ranking-max-tiers className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto mh-scroll whitespace-nowrap text-[10px] font-black [&>*]:shrink-0">
          {[{ id: 'all', name: '全難易度', n: 0 }, ...raidJackTiers(tab).map((t, i) => ({ id: t.id, name: t.name.replace('ジャック', ''), n: i + 1 }))].map((t) => (
            <button type="button" key={t.id} data-raid-jack-ranking-max-tier={t.n} onClick={() => setMaxTier(t.n)}
              className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${maxTier === t.n ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{t.name}</button>
          ))}
        </div>
      )}
      {tab === 'a' && !maxHit && (
        <div data-raid-jack-ranking-tiers className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto mh-scroll whitespace-nowrap text-[10px] font-black [&>*]:shrink-0">
          {RAID_JACK_A_TIERS.map((t, i) => (
            <button type="button" key={t.id} data-raid-jack-ranking-tier={t.id} onClick={() => { setTierIdx(i); setAllMode(false); }}
              className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${!useAll && tierIdx === i ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{t.name.replace('ジャック', '')}</button>
          ))}
          <button type="button" data-raid-jack-ranking-all onClick={() => setAllMode(true)}
            className={`min-h-[34px] rounded-xl border px-2.5 active:scale-95 ${useAll ? 'border-orange-300 bg-orange-800 text-white' : 'border-white/10 bg-slate-900 text-slate-300'}`}>累計ダメージ</button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="font-black text-orange-200">{title}</span>
          {myTotal > 0 && <span data-raid-jack-ranking-mine className="shrink-0 text-[10px] text-slate-200">あなた {myTotal.toLocaleString()}{ahead !== null ? `(${ahead + 1}位)` : ''}</span>}
        </div>
        <div className="mb-2 text-[9px] text-slate-400">{useSrc && maxHit ? `${src === 'rhythm' ? '1曲' : '1回の戦い'}で出した、いちばん大きいダメージで競います。難易度ごとにも見られます。順位報酬はありません。` : useSrc ? `${srcName}だけで与えたダメージで競います。順位報酬はありません(報酬は全体の貢献ランキングで決まります)。` : maxHit ? '1回の戦いで出した、いちばん大きいダメージで競います。難易度ごとにも見られます。順位報酬はありません。' : useAll ? '全段階へ与えたダメージの合計です。この順位に報酬はありません(報酬は段階ごとの貢献で決まります)。' : tab === 'a' ? '1〜5位に報酬があります。男爵〜公爵は倒れた時点、大王は期間の終わりに順位が決まります(報酬一覧)。' : '1〜5位に報酬があります。期間の終わりに順位が決まります(報酬一覧)。'}</div>
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
const RaidJackScreen = ({ initialTier = 0, onBack, onChallenge, onPurchase, onClaimRewards, beatPoints = 0, eventId, forced = false, unlimited = false, guideVisible = false, onDismissGuide, renderPlace, renderIcon, cardClass }) => {
  const [tab, setTab] = useState('a');
  const [sel, setSel] = useState(() => ({ a: Math.min(Math.max(Math.floor(Number(initialTier) || 0), 0), RAID_JACK_A_TIERS.length - 1), b: 0 }));   // モンヒロビート挑戦から戻ったときは、挑んでいた段階を選んだまま
  const [state, setState] = useState(() => raidJackDefaultState());
  const [totals, setTotalsState] = useState(() => raidJackCachedTotals(eventId));   // undefined=読み込み中 / null=準備中 / object(前回取れた値から描き始める)
  const setTotals = (t) => { raidJackRememberTotals(eventId, t); setTotalsState((prev) => (t || prev === undefined ? t : prev)); };
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
    // 段階の合計は、報酬の受け取りなどを待たずに先に取り始める(待たせるほど、男爵・満タンのまま見える時間が延びる)
    const totalsPromise = sbFetchRaidJackTierTotals(eventId);
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
      // 通信が弱くて送れなかった与ダメージが残っていれば、読む前に送り直す(本番のイベントだけ。デバッグの別イベントには出さない)
      let flushed = 0;
      if (!forced && eventId === RAID_JACK_EVENT.id && loaded.pending && loaded.pending.length > 0) {
        flushed = await raidJackFlushStoredPending(meId, eventId);
        if (!alive) return;
        if (flushed > 0) { setMessage(`送れていなかった与ダメージを${flushed}件、送り直しました`); loaded = await raidJackLoadState(); if (!alive) return; setState(loaded); }
      }
      const t = flushed > 0 ? await sbFetchRaidJackTierTotals(eventId) : await totalsPromise;
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
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden [@media(orientation:landscape)_and_(max-height:520px)]:overflow-y-auto mh-scroll`} data-raid-jack-screen>
      {/* 横向きの背の低い画面(844×390 など)では、上の札だけで高さを使い切り、一覧が0になって挑戦のボタンが画面の下の外に出ていた
          (送ることもできず挑戦できない。ダメダシ見回り 10/26 raid #1)。その画面だけ、画面ごと下へ送れる形にする */}
      <ScreenHead title={<RaidJackFitTitle text="カボチャの大王ジャック" />} icon="🎃" accent="text-orange-200" onBack={onBack}
        note={forced ? '(デバッグ表示・別のイベントIDの記録)' : '全員でジャックを倒そう'} />
      {guideVisible && (
        <div data-raid-jack-guide className="mb-2 shrink-0">
          <AssistantBubble scene="raidJackIntro" compact />
          <button type="button" data-raid-jack-guide-close onClick={onDismissGuide}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-orange-300/50 bg-orange-950/40 text-[12px] font-black text-orange-100 active:scale-95">わかった</button>
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

      <div className={`${SCREEN_LIST_CLASS} [@media(orientation:landscape)_and_(max-height:520px)]:flex-none [@media(orientation:landscape)_and_(max-height:520px)]:overflow-visible space-y-2`}>
        {/* 初めて読み込むあいだは、段階もライフも分からないので一覧を出さない(出すと男爵・満タンから本当の姿へ切り替わって見える) */}
        {tab === 'a' && totals === undefined && <div data-raid-jack-loading className="py-6 text-center text-[11px] text-slate-300">読み込み中…</div>}
        {!(tab === 'a' && totals === undefined) && tiers.map((t, i) => {
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

      {/* 横向きの背の低い画面は画面ごと下へ送る形なので、挑戦のボタンが画面3つぶん下にあった(2026-10-27 ジン部長)。
          その画面だけ、送っても画面の下に貼り付けて、すぐ押せるようにする。後ろの一覧が透けないよう地を敷く。画面の下の余白(30px)に止まるので、その下も影で同じ地にする。縦画面は変えない */}
      <div data-raid-jack-footer className={`${SCREEN_FOOTER_CLASS} [@media(orientation:landscape)_and_(max-height:520px)]:sticky [@media(orientation:landscape)_and_(max-height:520px)]:bottom-0 [@media(orientation:landscape)_and_(max-height:520px)]:z-20 [@media(orientation:landscape)_and_(max-height:520px)]:-mx-4 [@media(orientation:landscape)_and_(max-height:520px)]:-mb-4 [@media(orientation:landscape)_and_(max-height:520px)]:px-4 [@media(orientation:landscape)_and_(max-height:520px)]:pb-3 [@media(orientation:landscape)_and_(max-height:520px)]:bg-slate-950 [@media(orientation:landscape)_and_(max-height:520px)]:shadow-[0_60px_0_0_#020617]`}>
        {/* レイドバトルは「バトル」と「モンヒロビート」の2つの挑み方(2026-10-06・ユーザー指示)。回数は同じものを使う。
            挑めないとき(開始前・未解放・倒された・回数切れ)は、これまでどおり理由を出す1つのボタンにする */}
        {tab === 'a' && open && isOpenTier && !closedTier && remaining > 0 && (RELEASE_FLAGS.raidJackRhythm === true || forced) ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" data-raid-jack-challenge onClick={() => onChallenge(tab, current, 'battle')}
              className="min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-2 text-[12px] font-black leading-tight text-white active:scale-95">バトルで<br />挑戦する</button>
            <button type="button" data-raid-jack-challenge-rhythm onClick={() => onChallenge(tab, current, 'rhythm')}
              className="min-h-[48px] rounded-2xl border-2 border-fuchsia-300/70 bg-fuchsia-800 px-2 text-[12px] font-black leading-tight text-white active:scale-95">モンヒロビートで<br />挑戦する</button>
          </div>
        ) : (
          <button type="button" data-raid-jack-challenge disabled={!open || !isOpenTier || closedTier || remaining <= 0}
            onClick={() => onChallenge(tab, current, 'battle')}
            className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
            {challengeLabel}
          </button>
        )}
      </div>
      {showRanking && <RaidJackRankingList eventId={eventId} initialTab={tab} initialTier={current} renderPlace={renderPlace} renderIcon={renderIcon} cardClass={cardClass} onClose={() => setShowRanking(false)} />}
      {showRewards && <RaidJackRewardList claimed={state.claimed} initialTab={tab} onClose={() => setShowRewards(false)} />}
    </div>
  );
};

// 編成。A: 解放済みのベースモンから / B: 編成に入れているマスモンから。勇者1体+供モン最大3体。アシカは3枚まで
// 2026-10-19 社長「パーティー選ぶときにそのまま同時に距離適性も選択できるように」「アシカの選択も忘れやすいから、パーティー選んで距離決めたあとに」:
//   ① 編成と距離: 零・近・中・遠の4つの枠に、一覧で押した子を置く(光っている枠へ入る)。最初に置いた子が勇者モン(👑で替えられる)。
//      枠と一覧に、その距離での適性(%)を出す。タクティクスは「その距離に立っている子の適性だけ」が効く(足し算にならない)
//   ② アシカ: 編成が決まってから選ぶ。ここで「この編成で挑戦する」
const RAID_JACK_RANGE_TONE = ['border-red-400/70 bg-red-600 text-white', 'border-amber-300/70 bg-amber-500 text-black', 'border-emerald-300/70 bg-emerald-600 text-white', 'border-sky-300/70 bg-sky-600 text-white'];
const raidJackAptPct = (mon, range) => aptGradeToPct((mon && mon.distAptitude && mon.distAptitude[range]) || 'C');
const RaidJackPrepScreen = ({ kind, tierIndex, candidates, teachings, onBack, onStart, restore = null, onOpenDetail, onOpenTeachingDetail }) => {
  const isB = kind === 'b';
  const maxTeach = RAID_JACK_TEACHING_MAX;   // レイドバトルもグランドスラムも、アシカは3枚まで(数字は 35-raid-jack.jsx)
  const tier = raidJackTierAt(kind, tierIndex);
  const list = Array.isArray(candidates) ? candidates : [];
  const keyOf = (mon) => String(mon.masuId || mon.id);
  const monOf = (k) => (k ? list.find((m) => keyOf(m) === k) || null : null);
  const ranges = RANGE_LABELS.map((_, i) => i);
  const [slotKeys, setSlotKeys] = useState(() => {
    const keys = restore && Array.isArray(restore.slotKeys) ? restore.slotKeys : [];
    return ranges.map((i) => (typeof keys[i] === 'string' && list.some((m) => keyOf(m) === keys[i]) ? keys[i] : null));
  });
  const [heroRange, setHeroRange] = useState(() => (restore && Number.isInteger(restore.heroRange) ? restore.heroRange : null));
  const [pickRange, setPickRange] = useState(() => { const keys = restore && Array.isArray(restore.slotKeys) ? restore.slotKeys : []; const i = ranges.findIndex((r) => !keys[r]); return i < 0 ? null : i; });
  const [step, setStep] = useState('party');
  const [teachIds, setTeachIds] = useState(() => (restore && Array.isArray(restore.teachIds)) ? restore.teachIds : (Array.isArray(teachings) ? teachings : []).slice(0, maxTeach).map((t) => t.id));
  const slotMons = slotKeys.map(monOf);
  // 勇者モンは「② 勇者モンをえらぶ」で選ぶ(2026-10-19 社長「零距離が勇者モン固定になる。距離別に決めたあとに誰を勇者モンにするかの選択で」)。置いた子が1体だけならその子
  const heroIdx = Number.isInteger(heroRange) && slotMons[heroRange] ? heroRange : (slotMons.filter(Boolean).length === 1 ? slotMons.findIndex(Boolean) : -1);
  const hero = heroIdx >= 0 ? slotMons[heroIdx] : null;
  const placedCount = slotMons.filter(Boolean).length;
  const nextEmpty = (keys, from) => { for (let n = 1; n <= 4; n++) { const r = (from + n) % 4; if (!keys[r]) return r; } return null; };
  const removeAt = (r) => {
    const next = [...slotKeys]; next[r] = null;
    setSlotKeys(next);
    if (heroRange === r) setHeroRange(null);
    setPickRange(r);
  };
  const pickMon = (mon) => {
    const k = keyOf(mon);
    const at = slotKeys.indexOf(k);
    if (at >= 0) { removeAt(at); return; }
    const r = Number.isInteger(pickRange) && !slotKeys[pickRange] ? pickRange : nextEmpty(slotKeys, 3);
    if (r == null) return;   // 4つの枠がうまっている
    const next = [...slotKeys]; next[r] = k;
    setSlotKeys(next);
    setPickRange(nextEmpty(next, r));
  };
  const pickSlot = (r) => { if (slotKeys[r]) removeAt(r); else setPickRange(r); };
  const party = hero ? [hero, ...slotMons.filter((m, i) => m && i !== heroIdx)] : [];
  // 詳細の窓に出す「どの段から始まり、いつ強くなるか」。数字は戦闘の中身と同じ定数から作る(60-app.jsx の raidJack の開始処理)
  const teachGrowTurns = RAID_JACK_LEVEL_UP_TURNS.slice(0, RAID_JACK_TEACHING_MAX_LEVEL);
  const teachDetailInfo = isB
    ? { startLevel: RAID_JACK_TEACHING_MAX_LEVEL, note: `このイベントでは Lv.${RAID_JACK_TEACHING_MAX_LEVEL}(最大)から始まります。戦闘中は成長しません` }
    : { startLevel: 0, note: `このイベントでは Lv.0 から始まり、${teachGrowTurns.join('・')}ターン目に1段階ずつ強くなります(最大 Lv.${RAID_JACK_TEACHING_MAX_LEVEL})` };
  const toggleTeach = (id) => setTeachIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= maxTeach ? (maxTeach === 1 ? [id] : prev) : [...prev, id])));
  const faceOf = (mon, cls) => {
    // 本番のプロフィールのアイコンと同じ見え方(拡大・位置の調整つき)にそろえる
    const face = friendsFaceIconOf(mon.baseId || mon.id);
    return face
      ? <BreederIcon src={face.src} id={face.id} className={`${cls} bg-slate-800`} />
      : <img src={mon.faceIconUrl || mon.iconUrl || mon.imgUrl} alt="" className={`${cls} rounded-full bg-slate-800 object-contain`} />;
  };
  const pctTone = (v) => (v > 0 ? 'text-emerald-300' : v < 0 ? 'text-rose-300' : 'text-slate-300');
  const rangeChip = (r, extra = '') => <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-0.5 text-[9px] font-black leading-none ${RAID_JACK_RANGE_TONE[r]} ${extra}`}>{RANGE_LABELS[r]}</span>;
  // 選ぶときにモンスターの詳細(ステータス・技・適性など)を見られる(2026-10-05・ユーザー指示)。
  // 詳細のボタンは、選ぶボタンの入れ子にならないよう、外側のdivの右上に重ねて置く(押しても選択は変わらない)
  const tile = (mon) => {
    const k = keyOf(mon);
    const at = slotKeys.indexOf(k);
    const role = at < 0 ? null : 'placed';
    const showR = at >= 0 ? at : pickRange;
    const pct = Number.isInteger(showR) ? raidJackAptPct(mon, showR) : null;
    return (
    <div key={k} className="relative">
    <button type="button" onClick={() => pickMon(mon)} data-raid-mon={k} data-raid-mon-role={role || undefined} data-raid-mon-range={at >= 0 ? at : undefined} aria-pressed={!!role}
      className={`flex w-full flex-col items-center rounded-xl border-2 p-1 text-center active:scale-95 ${role ? 'border-sky-300 bg-sky-950/60' : 'border-white/10 bg-slate-900/60'}`}>
      {faceOf(mon, 'h-12 w-12')}
      <RaidJackFitName label={mon.name} />
      {/* タイプの印(2026-10-19・社長「タイプわかるようにしてほしい」)。札が狭いのでメインだけ。サブは詳細(i)に出る */}
      {monsterTypeProtoOn() && (() => { const t = MONSTER_TYPES[monsterTypeOf(mon.baseId || mon.id).main]; return t ? <span data-raid-mon-type={monsterTypeOf(mon.baseId || mon.id).main} className="mt-0.5 flex w-full items-center justify-center gap-px truncate rounded-full border border-white/15 bg-black/30 px-0.5 text-[8px] font-black leading-[12px] tracking-tight text-slate-200"><span aria-hidden="true">{cardIconNode(t.icon, 8)}</span>{t.label}</span> : null; })()}
      {/* 置いた距離(置いていなければ、いま光っている枠の距離)での適性 */}
      {pct != null && <span data-raid-mon-apt={showR} className="mt-0.5 flex items-center gap-0.5">{rangeChip(showR)}<span className={`text-[9px] font-black tabular-nums ${pctTone(pct)}`}>{formatAptPct(pct)}</span></span>}
    </button>
    {role && <span aria-hidden="true" className="pointer-events-none absolute -left-1 -top-1 rounded-full border border-sky-200 bg-sky-600 px-1 text-[9px] font-black leading-[14px] text-white shadow">{RANGE_LABELS[at]}に置いた</span>}
    {typeof onOpenDetail === 'function' && (
      <button type="button" data-raid-detail={k} aria-label={`${mon.name}の詳細を見る`} onClick={(e) => { e.stopPropagation(); onOpenDetail(mon); }}
        className="mh-hit-expand absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-sky-300/60 bg-slate-800 text-[11px] font-black leading-none text-sky-200 shadow active:scale-90">i</button>
    )}
    </div>
    );
  };
  // 距離の枠。① 光っている枠が「次に押した子が入る先」。うまった枠を押すと外れる。② 押した子が勇者モンになる
  const slot = (r) => {
    const mon = slotMons[r];
    const active = step === 'party' && !mon && pickRange === r;
    const isHero = mon && step !== 'party' && r === heroIdx;
    const heroPick = step === 'hero' && !!mon;
    const pct = mon ? raidJackAptPct(mon, r) : null;
    return (
      <div key={r} className="relative min-w-0">
        <button type="button" data-raid-slot={r} data-raid-slot-active={active ? 'true' : undefined} onClick={() => { if (step === 'hero') { if (mon) setHeroRange(r); return; } if (step === 'teach') { setStep('hero'); return; } pickSlot(r); }}
          data-raid-slot-hero={isHero ? 'true' : undefined} disabled={step === 'hero' && !mon}
          aria-label={step === 'party' ? (mon ? `${RANGE_LABELS[r]}距離の${mon.name}を外す` : `${RANGE_LABELS[r]}距離に置く子を選ぶ`) : (mon ? `${mon.name}を勇者モンにする` : `${RANGE_LABELS[r]}距離は空き`)}
          className={`flex w-full min-w-0 flex-col items-center rounded-xl border-2 p-1 ${mon ? 'pb-2.5' : ''} text-center active:scale-95 ${active ? 'border-orange-300 bg-orange-900/40 shadow-[0_0_10px_rgba(253,186,116,.55)]' : mon ? (isHero ? 'border-amber-300 bg-amber-900/50 shadow-[0_0_10px_rgba(252,211,77,.55)]' : heroPick ? 'border-amber-200/50 bg-sky-950/40' : 'border-sky-300/60 bg-sky-950/40') : 'border-dashed border-white/20 bg-slate-900/40'}`}>
          <span className="flex items-center gap-0.5">{rangeChip(r)}<span className="text-[9px] font-black text-slate-200">距離</span></span>
          {mon ? faceOf(mon, 'mt-0.5 h-10 w-10 [@media(max-height:640px)]:h-8 [@media(max-height:640px)]:w-8') : <span className={`mt-0.5 flex h-10 w-10 [@media(max-height:640px)]:h-8 [@media(max-height:640px)]:w-8 items-center justify-center rounded-full border border-dashed text-[16px] font-black ${active ? 'border-orange-200 text-orange-100' : 'border-white/25 text-slate-500'}`}>+</span>}
          <RaidJackFitName label={mon ? mon.name : (active ? 'ここに入る' : '空き')} />
          <span data-raid-slot-apt={mon ? r : undefined} className={`text-[10px] font-black leading-tight tabular-nums ${mon ? pctTone(pct) : 'text-slate-600'}`}>{mon ? formatAptPct(pct) : '—'}</span>
          {mon && step === 'party' && <span aria-hidden="true" className="absolute right-1 top-[18px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-black leading-none text-slate-100">×</span>}
        </button>
        {isHero && <span aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-500 px-1 text-[9px] font-black leading-[14px] text-black shadow">👑勇者</span>}
        {heroPick && !isHero && <span aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-slate-800 px-1 text-[9px] font-black leading-[14px] text-slate-200 shadow">押して👑</span>}
      </div>
    );
  };
  const guide = step === 'hero' ? (hero ? `${hero.name}が勇者モンです。ほかの子を押すと替えられます` : '勇者モンにする子を、上の枠から1体えらんでください')
    : placedCount === 0 ? '好きな距離の枠を押してから、下の一覧で置く子をえらんでください(どの順でもOK)'
    : Number.isInteger(pickRange) && placedCount < 4 ? `次は${RANGE_LABELS[pickRange]}距離(ほかの枠を押すとそこに置けます)。全部で${1 + RAID_JACK_ALLY_MAX}体まで`
    : '置けました。枠を押すとその子を外せます。勇者モンは次でえらびます';
  const partyRow = (
    // 一覧の流れる枠の外に置いて、画面の上に固定する(2026-10-19 社長「編成のとこは固定にしたほうが見やすいんじゃない？」)。
    // 背の低い端末(高さ640以下)は、説明の行を畳み・案内を1行にして、下の一覧が2行以上見える高さを残す
    <section className="mb-2 shrink-0 rounded-2xl border border-orange-300/30 bg-black/30 p-2 [@media(max-height:640px)]:mb-1 [@media(max-height:640px)]:py-1.5" data-raid-party>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-1 text-[11px] font-black text-orange-200">いまの編成と距離<span className="text-[9px] font-normal text-slate-300 [@media(max-height:640px)]:hidden">%はその距離での適性(その距離に立つ子のぶんだけ効きます)</span></div>
      <div className="grid grid-cols-4 gap-1.5 pb-1.5 pt-1">{ranges.map((r) => slot(r))}</div>
      {step !== 'teach' && <div data-raid-guide title={guide} className="mt-1.5 rounded-lg bg-orange-950/40 px-2 py-1 text-[10px] font-bold text-orange-100 [@media(max-height:640px)]:mt-1 [@media(max-height:640px)]:truncate [@media(max-height:640px)]:py-0.5">{guide}</div>}
    </section>
  );
  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden`} data-raid-jack-prep data-raid-prep-step={step}>
      <ScreenHead title={`${tier.name}に挑む`} icon="🎃" accent="text-orange-200" onBack={step === 'teach' ? () => setStep('hero') : step === 'hero' ? () => setStep('party') : onBack}
        note={step === 'teach' ? '③ アシカをえらぶ' : step === 'hero' ? '② 勇者モンをえらぶ' : `① ${isB ? 'マスモン' : 'ベースモン'}を距離に置く・20ターン勝負`} />
      {partyRow}
      <div className={`${SCREEN_LIST_CLASS} space-y-3`} data-raid-prep-list>
        {step === 'party' && (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-1 text-[11px] font-black text-orange-200">モンスター<span className="ml-1 text-[9px] font-normal text-slate-300">押すと上の光っている距離に入ります。右上の <b className="text-sky-200">i</b> で詳細が見られます</span></div>
          <div className="grid grid-cols-4 gap-1.5 pt-1 min-[360px]:grid-cols-5">
            {list.map((mon) => tile(mon))}
          </div>
          {list.length === 0 && <div className="py-2 text-center text-[10px] text-slate-400">編成できるモンスターがいません</div>}
        </section>
        )}
        {step === 'hero' && (
        <section className="rounded-2xl border border-amber-300/30 bg-black/30 p-3 text-[10px] leading-relaxed text-slate-200" data-raid-hero-step>
          <div className="mb-1 text-[11px] font-black text-amber-200">👑 勇者モンとは</div>
          <div>戦いの主役になる1体です。ちから・丈夫さは勇者モンをもとに、供モンのぶんが足されます。勇者モンを置いた距離から戦いが始まり、少しだけ狙われやすくなります(🔥)。</div>
        </section>
        )}
        {step === 'teach' && (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-3" data-raid-teach-step>
          <div className="mb-1 text-[11px] font-black text-orange-200">アシカ({maxTeach}つまで)<span className="ml-1 text-[9px] text-slate-300">{teachIds.length} / {maxTeach}</span>{typeof onOpenTeachingDetail === 'function' && <span className="ml-1 text-[9px] font-normal text-slate-300">右上の <b className="text-sky-200">i</b> で効果が見られます</span>}</div>
          <div className="text-[9px] text-slate-300">{isB ? '最大レベルから始まります(戦闘中は成長しません)' : '固有技は3・5・8・11ターン目に2段階ずつ、アシカは3・5ターン目に1段階ずつ強くなります(3枚まで選べます)'}</div>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {(Array.isArray(teachings) ? teachings : []).map((t) => (
              <div key={t.id} className="relative">
              <button type="button" data-raid-teach={t.id} onClick={() => toggleTeach(t.id)}
                className={`flex w-full flex-col items-center rounded-xl border-2 p-1 text-center active:scale-95 ${teachIds.includes(t.id) ? 'border-orange-300 bg-orange-950/50' : 'border-white/10 bg-slate-900/60'}`}>
                {/* 手札のカードと同じ見え方(きき のように全身の絵は、カード用の拡大・位置の補正で顔に寄せる) */}
                {cardIconNode(t.icon, 40, t.id)}
                <RaidJackFitName label={t.baseName} />
              </button>
              {/* アシカの効果も見られるようにする(2026-10-13・ユーザー指示)。モンスターの札と同じ右上の i。押しても選ぶ/外すは変わらない */}
              {typeof onOpenTeachingDetail === 'function' && (
                <button type="button" data-raid-teach-detail={t.id} aria-label={`${t.baseName}の効果を見る`} onClick={(e) => { e.stopPropagation(); onOpenTeachingDetail(t, teachDetailInfo); }}
                  className="mh-hit-expand absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-sky-300/60 bg-slate-800 text-[11px] font-black leading-none text-sky-200 shadow active:scale-90">i</button>
              )}
              </div>
            ))}
          </div>
        </section>
        )}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[10px] text-slate-300">
          ライフ {tier.hp.toLocaleString()} / 技 {tier.actionCount}本 / 20ターンで終わります。始めると今日の挑戦回数を1回使います。途中でやめても回数は戻りませんが、そこまでのダメージは記録されます。
        </div>
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        {step === 'party' ? (
          <button type="button" data-raid-prep-next disabled={placedCount === 0} onClick={() => setStep('hero')}
            className="w-full min-h-[48px] rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
            {placedCount > 0 ? '次へ(勇者モンをえらぶ)' : '距離に子を置いてください'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" data-raid-prep-back onClick={() => setStep(step === 'teach' ? 'hero' : 'party')}
              className="min-h-[48px] shrink-0 rounded-2xl border-2 border-white/15 bg-slate-800 px-3 text-[12px] font-black text-slate-100 active:scale-95">{step === 'teach' ? '← 勇者モン' : '← 置き直す'}</button>
            {step === 'hero' ? (
              <button type="button" data-raid-prep-hero-next disabled={!hero} onClick={() => setStep('teach')}
                className="min-h-[48px] flex-1 rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
                {hero ? '次へ(アシカをえらぶ)' : '勇者モンをえらんでください'}
              </button>
            ) : (
              <button type="button" data-raid-prep-start disabled={!hero}
                onClick={() => onStart({ party, teachingIds: teachIds, slots: slotMons, heroSlot: heroIdx, restore: { slotKeys, heroRange: heroIdx, teachIds } })}
                className="min-h-[48px] flex-1 rounded-2xl border-2 border-orange-300/70 bg-orange-700 px-3 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
                この編成で挑戦する
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
