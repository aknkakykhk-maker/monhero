// ===== MFバトルカード: レイドのボスと戦う(クリスマスイベント 2026・台帳 r1119-172・企画 docs/progress/event-xmas-2026/PLAN.md §4-1 案ア) =====
// レイド画面の「バトルカードで挑む」から、ボスのデッキ(コンピューター)と専用の1戦をする。与えたダメージを換算してレイドへ足す(source='card')。
// ★この部品は画面・保存・サーバーに触らない(計算だけ)。画面は 84-screen-card-battle.jsx、レイドへ足すのはバトル部の口(BUILD.md)。
// ★ボスは仮(「贈り物を奪う黒いサンタ」。名前と絵は社長が後で渡す)。数字も仮(社長が表から選ぶ)。設計と数字の表: docs/spec/CARD_RAID_XMAS.md
// ★82-card-battle-core.jsx(大会のサーバーにも写る)は変えない。ボスの表は助手の表(CARD_AI_HABITS・CARD_AI_DECKS)に足さない
//   (足すと相手えらび・検査・強さの測りが助手として数えてしまう)。

// ボスの定義(仮)。名前・絵が届いたらここだけ直す
const CARD_RAID_BOSS = Object.freeze({
  id: 'raid_xmas_2026',
  name: '黒いサンタ',            // 仮の名前(社長が決める)
  deckName: '奪われた贈り物',    // 仮のデッキ名
  // 3体。黒いサンタはハムなので、ハム種(ハム・ダークハム・ハムライガー)から2体と、ほかの候補(黒い服の子)から1体を、挑むたびに選ぶ(台帳 r1126-101 追記1)
  //   monsters … 種を渡さないとき(検査・代わりの組み方)の3体 / hare … ハム種の候補 / others … ほかの候補
  monsters: Object.freeze(['C-008', 'C-055', 'C-003']),
  hare: Object.freeze(['C-008', 'C-055', 'C-010']),
  others: Object.freeze(['C-047', 'C-024', 'C-003']),
  favor: 'hare',               // この種の札を少し好んで入れる(ハムの技が多い山札にする)
  favorBonus: 0.6,
  cardNoise: 0.45,             // 挑むたびに山札の中身が入れ替わる揺れ(種を渡したときだけ)
  // 考え方のくせ(重みの意味は 82-card-battle-core.jsx の CARD_AI_HABITS と同じ)。
  //   「贈り物を奪う」ので、相手の手札・ガッツをいじる札(disrupt)をいちばん好む。弱った子を狙い、全体攻撃も好き
  habit: Object.freeze({ attack: 1.2, keepGuard: 0.8, saveGuts: 0.8, big: 1.0, disrupt: 1.7, area: 1.3, finish: 1.3 }),
  // デッキに先に入れる札(この3体で使える物だけが入る。無い名前は飛ばす)。「贈り物を奪う」ので相手の手札を捨てさせる「大声」
  prefer: Object.freeze(['大声']),
});

// 段階ごと(レイドの5段階・0 始まり)のボスの強さ。
//   level … 考え方の強さ(CARD_AI_LEVELS の難易度) / life … ボスの3体のライフの倍率。ふだんのカードと同じ 1(台帳 r1126-101 追記2・社長「ライフはそのままでAIで強く調整して」)
//   ai … 考え方の上乗せ(CARD_AI_LEVELS の値を上書き)。ライフを戻したぶん、ふだんの同じ難易度より強く打つ
//     readHand … 相手の手札を読んで守りを見越す(「贈り物を奪う」ボスなので手の内を知っている) / whim・sloppy … 気まぐれ・雑さ(小さいほど手堅い)
//   rate … 換算の段階の補正(上の段階ほど1点が重い)
const CARD_RAID_TIERS = Object.freeze([
  Object.freeze({ level: 'hard', life: 1, rate: 1.0, ai: Object.freeze({ whim: 0.04, sloppy: 0.08, readHand: true }) }),
  Object.freeze({ level: 'expert', life: 1, rate: 1.25, ai: Object.freeze({ whim: 0.02, sloppy: 0.03, readHand: true }) }),
  Object.freeze({ level: 'master', life: 1, rate: 1.5, ai: Object.freeze({ whim: 0.01, sloppy: 0, readHand: true }) }),
  Object.freeze({ level: 'master', life: 1, rate: 1.75, ai: Object.freeze({ whim: 0, sloppy: 0, readHand: true }) }),
  Object.freeze({ level: 'master', life: 1, rate: 2.0, ai: Object.freeze({ whim: 0, sloppy: 0, readHand: true }) }),
]);
const cardRaidTierOf = (tierIndex) => CARD_RAID_TIERS[Math.min(CARD_RAID_TIERS.length - 1, Math.max(0, Math.floor(Number(tierIndex) || 0)))];

// 与ダメージの換算(仮。社長が表から選ぶ)
//   レイドへ足すダメージ = floor( (与えたダメージ × perPoint + 倒した数 × perKo + 勝ち ? win : 0) × 段階の補正 )
//   与えたダメージ … ボスの3体が減ったライフの合計(倒した子の削りすぎは数えない・回復されたぶんは引かれる)
//   投了しても、それまでに与えたぶんは足す(勝ちの上乗せは付かない)。途中で閉じた(結果が出なかった)ときは 0
const CARD_RAID_DAMAGE = Object.freeze({ perPoint: 8000, perKo: 40000, win: 150000, cap: null });

// ボスの3体を選ぶ(ハム種から2体+ほかから1体)。rnd が無いときは決まった3体
const cardRaidBossMonsters = (db, rnd = null) => {
  const ok = (list) => list.filter((no) => cardMonsterOf(db, no));
  if (!rnd) return ok(CARD_RAID_BOSS.monsters);
  const pick = (list, n) => { const a = ok(list).slice(); const out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
  const out = [...pick(CARD_RAID_BOSS.hare, 2), ...pick(CARD_RAID_BOSS.others, 1)];
  // 同じ種が2体にならないように(カードの表が変わったときの守り)。足りなければ決まった3体
  const sp = out.map((no) => cardMonsterOf(db, no).species);
  return out.length === 3 && new Set(sp).size === 3 ? out : ok(CARD_RAID_BOSS.monsters);
};

// ボスのデッキを組む。seed を渡すと挑むたびに3体と山札が少し変わる(画面は対戦の種を渡す)。渡さなければ段階ごとに毎回同じ(検査用)
const cardRaidBossDeck = (db, tierIndex = 0, seed = null) => {
  const tier = cardRaidTierOf(tierIndex);
  const cfg = CARD_AI_BUILD[tier.level] || CARD_AI_BUILD.normal;
  const habit = CARD_RAID_BOSS.habit;
  const roll = seed !== null && seed !== undefined && Number.isFinite(Number(seed));
  const rnd = cardAiSeededRand(`${CARD_RAID_BOSS.id}:${tier.level}${roll ? `:${Math.floor(Number(seed))}` : ''}`);
  const monsters = cardRaidBossMonsters(db, roll ? rnd : null);
  const mons = monsters.map((no) => cardMonsterOf(db, no));
  const noise = cfg.noise + (roll ? CARD_RAID_BOSS.cardNoise : 0);
  const favor = (c) => (c.user === CARD_RAID_BOSS.favor ? CARD_RAID_BOSS.favorBonus : 0);
  // 弾の制限はかけない(ボスは全部の弾の札を使う)。名前ごとに入れたい度の高い番号1つ
  const pool = Object.values(db.cards).filter((c) => c.ready && (c.user === 'any' || c.user === 'breeder' || mons.some((m) => cardUsableBy(c, { ...m, ko: false }))));
  const byName = {};
  pool.forEach((c) => { const v = cardAiCardValue(c, habit) + favor(c) + noise * (rnd() * 2 - 1); if (!byName[c.name] || byName[c.name].v < v) byName[c.name] = { c, v }; });
  const ranked = Object.values(byName).sort((a, b) => b.v - a.v || (a.c.no < b.c.no ? -1 : 1));
  const cards = [];
  const count = (no) => cards.filter((n) => n === no).length;
  const add = (c, n) => { for (let i = 0; i < n && cards.length < CARD_BATTLE_DECK_SIZE && count(c.no) < CARD_DECK_COPY_MAX; i++) cards.push(c.no); };
  const used = new Set();
  CARD_RAID_BOSS.prefer.forEach((name) => { const x = byName[name]; if (x) { used.add(name); add(x.c, CARD_DECK_COPY_MAX); } });
  // 守りは3体に順番に配る(14枚が目安)
  const guards = ranked.filter((x) => cardIsGuardKind(x.c.kind));
  const guardLanes = mons.map((m) => guards.filter((x) => x.c.user === 'any' || cardUsableBy(x.c, { ...m, ko: false })));
  for (let gi = 0, miss = 0, g = 0; g < 14 && miss < guardLanes.length; gi = (gi + 1) % guardLanes.length) {
    const x = guardLanes[gi].find((y) => !used.has(y.c.name));
    if (!x) { miss += 1; continue; }
    miss = 0; used.add(x.c.name);
    const before = cards.length; add(x.c, Math.min(CARD_DECK_COPY_MAX, 14 - g)); g += cards.length - before;
  }
  // 攻撃は3体と共通の札に順番に(重い技は8枚まで)
  const attacks = ranked.filter((x) => !cardIsGuardKind(x.c.kind));
  const lanes = [...mons.map((m) => attacks.filter((x) => x.c.user !== 'any' && x.c.user !== 'breeder' && cardUsableBy(x.c, { ...m, ko: false }))),
    attacks.filter((x) => x.c.user === 'any' || x.c.user === 'breeder')];
  let heavy = cards.filter((no) => { const c = cardOf(db, no); return c && !cardIsGuardKind(c.kind) && c.guts >= 5; }).length;
  for (let li = 0, loop = 0; cards.length < CARD_BATTLE_DECK_SIZE && loop < 400; li = (li + 1) % lanes.length, loop++) {
    const x = lanes[li].find((y) => !used.has(y.c.name) && !(y.c.guts >= 5 && heavy >= 8) && !cardHasEff(y.c, 'attach'));
    if (!x) continue;
    used.add(x.c.name);
    const before = cards.length; add(x.c, CARD_DECK_COPY_MAX);
    if (x.c.guts >= 5) heavy += cards.length - before;
  }
  for (const x of ranked) { if (cards.length >= CARD_BATTLE_DECK_SIZE) break; add(x.c, CARD_DECK_COPY_MAX); }
  const deck = { monsters: monsters.slice(), cards };
  // 組めなかった(カードの表が変わったなど)ときは、きゅうこの組み方で代わりに組む(対戦は必ず始められる)
  if (cardDeckProblems(db, deck).length) return cardAiBuildDeck(db, 'kyuko', tier.level, rnd);
  return deck;
};

// ボスの打ち方(段階の強さ+ボスのくせ)。戦術カード(助手の基本カード)は持たない
const cardRaidBossPolicy = (tierIndex = 0) => {
  const tier = cardRaidTierOf(tierIndex);
  const base = cardAiPolicy('kyuko', tier.level, { noTactics: true });
  return { ...base, level: { ...base.level, ...(tier.ai || {}) }, habit: { ...CARD_RAID_BOSS.habit } };
};

// 始まりの場に、ボスのライフの倍率をかける(p はボスの側)。cardCreateGame の直後に1回だけ呼ぶ
const cardRaidPrepareGame = (st, tierIndex = 0, p = 1) => {
  const tier = cardRaidTierOf(tierIndex);
  const pl = st && st.players && st.players[p];
  if (!pl) return st;
  // ライフはふだんのカードと同じ(倍率 1。台帳 r1126-101 追記2)。倍率が 1 でないときだけかける
  pl.mons.forEach((m) => { const life = Math.max(1, Math.round(m.max * tier.life)); m.life = life; m.max = life; });
  st.raid = { boss: CARD_RAID_BOSS.id, tier: Math.max(0, Math.floor(Number(tierIndex) || 0)), side: p };
  return st;
};

// 場から「与えたダメージ」を数える(p はボスの側)。削りすぎは数えない
const cardRaidDealt = (st, p = 1) => {
  const pl = st && st.players && st.players[p];
  if (!pl) return { dealt: 0, kos: 0, lifeMax: 0 };
  let dealt = 0, kos = 0, lifeMax = 0;
  pl.mons.forEach((m) => {
    const max = Math.max(0, Number(m.max) || 0);
    const life = Math.max(0, Math.min(max, Number(m.life) || 0));
    lifeMax += max; dealt += max - life; if (m.ko) kos += 1;
  });
  return { dealt, kos, lifeMax };
};

// 換算: レイドへ足すダメージ(0 以上の整数)。outcome は 'win' / 'lose' / 'resign'(投了)など。勝ちの上乗せは 'win' だけ
const cardRaidDamage = ({ dealt = 0, kos = 0, outcome = 'lose', tierIndex = 0 } = {}) => {
  const tier = cardRaidTierOf(tierIndex);
  const d = Math.max(0, Math.floor(Number(dealt) || 0));
  const k = Math.max(0, Math.min(3, Math.floor(Number(kos) || 0)));
  const raw = (d * CARD_RAID_DAMAGE.perPoint + k * CARD_RAID_DAMAGE.perKo + (outcome === 'win' ? CARD_RAID_DAMAGE.win : 0)) * tier.rate;
  const out = Math.max(0, Math.floor(raw));
  return Number.isFinite(CARD_RAID_DAMAGE.cap) && CARD_RAID_DAMAGE.cap > 0 ? Math.min(CARD_RAID_DAMAGE.cap, out) : out;
};

// 終わった場から、まとめて結果を出す(画面と検査が同じものを使う)
const cardRaidResultOf = (st, tierIndex = 0, outcome = 'lose', p = 1) => {
  const { dealt, kos, lifeMax } = cardRaidDealt(st, p);
  return { dealt, kos, lifeMax, outcome, tierIndex, damage: cardRaidDamage({ dealt, kos, outcome, tierIndex }) };
};

// バトル部とのつなぎ目(docs/progress/event-xmas-2026/BUILD.md §4)の名前。カードの換算はこれ1つを直す
//   使い方: raidXmasCardDamageOf({ dealt, kos, outcome, tierIndex }) → レイドへ足すダメージ(raidXmasAddDamage の damage に渡す)
const raidXmasCardDamageOf = (r) => cardRaidDamage(r || {});
