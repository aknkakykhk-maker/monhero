// ===== クリスマスのレイド(r1119-172)の定義(純粋な計算とデータ) =====
// つなぎ目の正本: docs/progress/event-xmas-2026/BUILD.md / 企画: docs/progress/event-xmas-2026/PLAN.md
//
// 決めごと:
//  ・土台はジャック(35-raid-jack.jsx)。ジャックのデータ・キー・関数の動きは変えない。段階の形・報酬の表・ビートの換算はジャックの物を使い回す。
//  ・サーバーはジャックと同じ表 raid_jack_hits を、イベントid raid_xmas_2026 で使う(デバッグは raid_xmas_debug)。
//  ・端末の保存は新しいキー mh_raid_xmas_v1(形は mh_raid_jack_v1 と同じ)。ジャックのキーには触らない。
//  ・与ダメージの入口は battle / rhythm / card の3つ。レイドバトル(A)の回数は3つで共通。グランドスラム(B)はバトルだけ。
//  ・ボスの名前は「黒いサンタ」(社長決定 r1126-024)。画面は RAID_XMAS_EVENT.name と段階の name を読み、直書きしない。
//  ・数字は仮(ジャックの最後の数字と同じ)。社長が決めたら、この下の表だけ差し替える。
//  ・開催中かどうかは、見るたびに raidXmasWindowAt(Date.now()) で数え直す。
//  ・公開フラグ RELEASE_FLAGS.raidXmas(開始時刻を過ぎたら真)が偽のあいだは、入口もヘルプ・更新履歴も出さない。

// 開始は 17-release-changelog-login-missions.jsx の RAID_XMAS_START_AT と同じ値(更新履歴の公開判定が先に読むため、そちらにも置く。食い違いは raid-xmas-check.js が見る)
const RAID_XMAS_EVENT = Object.freeze({
  id: 'raid_xmas_2026',
  debugId: 'raid_xmas_debug',
  title: '聖夜の名探偵',                 // イベントの名前(社長決定 2026-11-25)。副題の案は「〜雪山ペンションと消えたプレゼント〜」
  name: '黒いサンタ',                   // ボスの名前(社長決定 r1126-024)。ボスは「サンタ」が覚醒した「覚醒サンタ」
  startAt: '2026-11-30T10:00:00+09:00',
  endAt: '2026-12-31T04:00:00+09:00',
  storageKey: 'mh_raid_xmas_v1',
});
const RAID_XMAS_STORAGE_KEY = RAID_XMAS_EVENT.storageKey;
const RAID_XMAS_SOURCES = Object.freeze(['battle', 'rhythm', 'card']);
const RAID_XMAS_FREE_PER_DAY = 3;
const RAID_XMAS_EXTRA_COST_BEAT_P = 300;
const RAID_XMAS_TURNS = 20;

// ---- 段階(仮。ジャックの最後の数字と同じ) ----
// A: レイドバトル(協力・共有ライフ)。攻撃力 350 / 500 / 600 / 800 / 1,000(ジャックと同じ・仮)
// ライフは社長決定(2026-11-25「前半が5倍。後半は前回より少し高め」): 段階1〜3はジャックの5倍(875万 / 1,600万 / 4,000万)、
//   段階4・5はジャックの1.2倍(4,200万 / 9,600万)
const RAID_XMAS_A_HPS = Object.freeze([8750000, 16000000, 40000000, 42000000, 96000000]);
const RAID_XMAS_A_ATKS = Object.freeze([350, 500, 600, 800, 1000]);
// 段階の名前(社長決定 r1126-024)
const RAID_XMAS_A_NAMES = Object.freeze(['黒いサンタ・咎', '黒いサンタ・戒', '黒いサンタ・罰', '黒いサンタ・断罪', '黒いサンタ・煉獄']);
const RAID_XMAS_A_TIERS = Object.freeze(RAID_XMAS_A_NAMES.map((name, i) =>
  raidJackTier(`a${i + 1}`, name, [5.0, 6.5, 8.0, 10.0, 13.0][i], [3, 4, 5, 5, 5][i], RAID_XMAS_A_ATKS[i] / RAID_JACK_BASE.atk, RAID_XMAS_A_HPS[i])));
// 最後の段階を倒したあと: 共有ライフは無限(倒した扱いにしない)・1戦のライフ 455万・攻撃力 700。サーバーへ送る段階は 5 のまま
// 正気に戻った普通の「サンタ」(ジャックのぱんぷきんと同じ形・社長決定 r1126-024)。絵は RAID_XMAS_SANTA_IMG
const RAID_XMAS_AFTER_BOSS = raidJackTier('a6', 'サンタ', 13.0, 5, 1.0, 4550000);
// B: グランドスラム(個人・累計)。倍率 0.2 / 2 / 10 / 40 / 100
const RAID_XMAS_B_TIERS = Object.freeze([
  raidJackTier('b1', '初級 黒いサンタ', 0.2, 3),
  raidJackTier('b2', '中級 黒いサンタ', 2, 4),
  raidJackTier('b3', '上級 黒いサンタ', 10, 5),
  raidJackTier('b4', '超級 黒いサンタ', 40, 5),
  raidJackTier('b5', '極級 黒いサンタ', 100, 5),
]);
const raidXmasTiers = (kind) => (kind === 'b' ? RAID_XMAS_B_TIERS : RAID_XMAS_A_TIERS);
const raidXmasTierAt = (kind, index) => {
  const list = raidXmasTiers(kind);
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return list[Math.min(Math.max(i, 0), list.length - 1)];
};

// ボス(覚醒サンタ)の技の名前(社長決定 2026-11-25・台帳 r1125-058)。動き(rush/sweep/roar/pierce/allout)と本数 3/4/5/5/5 はジャックのまま。
//   名前だけを 35-raid-jack.jsx の raidJackMakeEnemy(opts.ev === 'xmas')で敵へ写す。ジャックの RAID_JACK_SKILL_NAMES・敵データ Jack は変えない。
//   「X’マス」の「’」は全角の右シングル引用符(U+2019)
const RAID_XMAS_SKILL_NAMES = Object.freeze({
  normal: '正拳・闇',
  special: '瞬黒撃',
  sweep: '超宝屁',   // ちょうほうひ(社長の訂正 2026-11-25)
  rush: '超飛び蹴り',
  pierce: '超暗けい',
  roar: '怪しこの夜',
  allout: 'X\u2019マスプレデター',
});

// 報酬はジャックと同じ表(社長決定 2026-11-25)
const RAID_XMAS_REWARDS = RAID_JACK_REWARDS;

// 期間。見るたびに数え直す
const raidXmasWindowAt = (nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : 0;
  const start = Date.parse(RAID_XMAS_EVENT.startAt);
  const end = Date.parse(RAID_XMAS_EVENT.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'before';
  if (now < start) return 'before';
  if (now >= end) return 'after';
  return 'open';
};

// 最後の段階が倒されたか(totals は sbFetchRaidJackTierTotals の返り値)
const raidXmasBossDown = (totals) => !!totals && !!totals.a && !!totals.a[RAID_XMAS_A_TIERS.length]
  && (Number(totals.a[RAID_XMAS_A_TIERS.length].total) || 0) >= RAID_XMAS_A_TIERS[RAID_XMAS_A_TIERS.length - 1].hp;

// 今日の残りの回数(日付の区切りはジャックと同じ 4:00)。extra はビートPで買った分(その日のうち)
const raidXmasRemaining = (side, nowMs) => {
  const s = raidJackNormalizeSide(side, false);
  const today = raidJackDayKey(nowMs);
  const used = s.day === today ? s.used : 0;
  const extra = s.day === today ? s.extra : 0;
  return Math.max(0, RAID_XMAS_FREE_PER_DAY + extra - used);
};

// モンヒロビートの換算。はじめはジャックの式そのまま(数字を変えるときはここだけ直す)
const raidXmasRhythmDamageOf = (result, difficulty) => raidJackRhythmDamageOf(result, difficulty);

// ---- 段階を倒すたびのお話(台本は docs/progress/event-xmas-2026/SCRIPT.md。データは data/assistants.js の EVENT_REPLAYS に足す) ----
const RAID_XMAS_STORY_START_ID = 'raid_xmas_story_1b';
const RAID_XMAS_STORY_AFTER_TIER = Object.freeze({
  a1: 'raid_xmas_story_2', a2: 'raid_xmas_story_3', a3: 'raid_xmas_story_4', a4: 'raid_xmas_story_5', a5: 'raid_xmas_story_6',
});
const RAID_XMAS_ENDING_CLEARED_ID = 'raid_xmas_ending_cleared';
const RAID_XMAS_ENDING_NOTCLEARED_ID = 'raid_xmas_ending_notcleared';
const RAID_XMAS_STORY_IDS = Object.freeze([
  RAID_XMAS_STORY_START_ID, ...Object.values(RAID_XMAS_STORY_AFTER_TIER), RAID_XMAS_ENDING_CLEARED_ID, RAID_XMAS_ENDING_NOTCLEARED_ID,
]);
// 段階を倒したあと・期間が終わったあとに流すお話の候補(古い順)。totals が取れていないときは段階の話を出さない
const raidXmasStoryCandidates = (totals, nowMs) => {
  const out = [];
  const a = totals && totals.a ? totals.a : null;
  const defeatedAt = (i) => !!a && !!a[i + 1] && (Number(a[i + 1].total) || 0) >= RAID_XMAS_A_TIERS[i].hp;
  if (a) RAID_XMAS_A_TIERS.forEach((t, i) => { if (defeatedAt(i)) out.push(RAID_XMAS_STORY_AFTER_TIER[t.id]); });
  if (raidXmasWindowAt(nowMs) === 'after' && a) {
    out.push(defeatedAt(RAID_XMAS_A_TIERS.length - 1) ? RAID_XMAS_ENDING_CLEARED_ID : RAID_XMAS_ENDING_NOTCLEARED_ID);
  }
  return out.filter(Boolean);
};

// ---- 期間中のモンヒロバトルのごほうび1.5倍(r1119-172 追記「期間中のボーナス」③・社長の選択) ----
//  ・期間はクリスマスのイベントと同じ(11/30 10:00〜12/31 4:00)。見るたびに時刻で決める(保存しない)。
//  ・掛けるのは、モンヒロバトルのランで配るブリーダー経験値・絆経験値・ダイヤ(60-app.jsx の awardRunRewards)と、
//    プロのランぶんのクイック周回の周回数。今ある倍率(難易度・クイック・プロなど)とは掛け算で重ねる(カードと同じ「A 掛け算」)。
//  ・スコア・ランキングの送信・自己ベスト・スキップチケット・レイド・モンヒロビートの周回(ビートの5倍の側)には掛けない。
const XMAS_BATTLE_BONUS_RATE = 1.5;
const xmasBattleBonusRateAt = (nowMs) => (raidXmasWindowAt(nowMs) === 'open' ? XMAS_BATTLE_BONUS_RATE : 1);

// ---- ひとりで進める物語(イベントページの「物語」タブ・台帳 r1126-006) ----
//  ・話はイベントページから選んで読む。自動では流さない(社長 2026-11-25)。開いた話はいつでも読み返せる
//  ・開く日時: 序章は 11/28(開催予告)から、第1話は開始と同時(11/30 10:00)、第2話からは毎日 4:00(1日の区切りと同じ)に1話ずつ(仮)
//  ・前の話を読んだ(戦う話は勝った)ら次が選べる。戦う話はバトル・モンヒロビート・バトルカードのどれかで勝つと進む
//  ・題と「読む/戦う」は台本の全話一覧(第3案・docs/progress/event-xmas-2026/SCRIPT.md §0)の仮。台本が決まったらこの表だけ直す
//  ・お話の中身は data/assistants.js の EVENT_REPLAYS に scriptId の id で入れる(入るまでは「準備中」と出す)
const XMAS_STORY_LIST = Object.freeze([
  ['招待状', 'read'], ['雪の音', 'fight'], ['夜中の足音', 'read'], ['開かずの部屋', 'read'], ['窓の外の影', 'fight'],
  ['柱時計', 'read'], ['十二の鐘', 'read'], ['足あとの先', 'fight'], ['ふたつめの空箱', 'read'], ['見張り番', 'fight'],
  ['閉じたノート', 'read'], ['ふたりの探偵助手', 'read'], ['鏡の中', 'read'], ['影の行進', 'fight'], ['みんなで眠る夜', 'read'],
  ['見回りのランタン', 'read'], ['雪の上の砂', 'fight'], ['13の鐘', 'fight'], ['そろう手がかり', 'read'], ['謎はすべて解けた!', 'read'],
  ['おでじゃない', 'read'], ['そろいすぎた手がかり', 'read'], ['最後の手がかり', 'fight'], ['真実はいつもひとつ!', 'read'], ['やり直しのクリスマス会', 'read'],
]);
// 第2話から: 12/(話-1) 4:00 JST(第25話 = 12/24)
const xmasStoryOpenAtOf = (no) => (no <= 1 ? RAID_XMAS_EVENT.startAt : `2026-12-${String(no - 1).padStart(2, '0')}T04:00:00+09:00`);
// 序章(台帳 r1126-012・社長): 第1話の前。イチーカから招待状が届いて行くまで。11/28 の開催予告のときから開く(時刻 10:00 は仮)。お話は data/assistants.js の XMAS_STORY_00(EVENT_REPLAYS の xmas_story_00)
const XMAS_STORY_PROLOGUE_OPEN_AT = '2026-11-28T10:00:00+09:00';
const XMAS_STORY_CHAPTERS = Object.freeze([
  Object.freeze({ id: 'xs00', no: 0, prologue: true, openAt: XMAS_STORY_PROLOGUE_OPEN_AT, type: 'read', title: '届いたゲーム', scriptId: 'xmas_story_00' }),
  ...XMAS_STORY_LIST.map(([title, type], i) => Object.freeze({
    id: `xs${String(i + 1).padStart(2, '0')}`,
    no: i + 1,
    openAt: xmasStoryOpenAtOf(i + 1),
    type,
    title,
    scriptId: `xmas_story_${String(i + 1).padStart(2, '0')}`,
  })),
]);
// 前の話(並びの1つ前。序章の前は無い)
const xmasStoryPrevOf = (chapter) => {
  const i = XMAS_STORY_CHAPTERS.findIndex((c) => c.id === chapter.id);
  return i > 0 ? XMAS_STORY_CHAPTERS[i - 1] : null;
};
const XMAS_STORY_STORAGE_KEY = 'mh_xmas_story_v1';
// 保存の形 { v:1, cleared:[id], seen:[id], rewardClaimed:false }。壊れていても既定へ戻す(⑦)
const xmasStoryNormalize = (raw) => {
  const ids = new Set(XMAS_STORY_CHAPTERS.map((c) => c.id));
  const list = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && ids.has(x)))] : []);
  const r = raw && typeof raw === 'object' ? raw : {};
  return { v: 1, cleared: list(r.cleared), seen: list(r.seen), rewardClaimed: r.rewardClaimed === true };
};
// 1話の状態: 'locked'(日時がまだ)/ 'waiting'(前の話がまだ)/ 'new'(開いた・まだ開いていない)/ 'open'(開いたことがある)/ 'cleared'(読んだ・勝った)
//   allOpen: デバッグの強制表示(日時も順番も見ない)
const xmasStoryStatusOf = (chapter, progress, nowMs, allOpen = false) => {
  const p = xmasStoryNormalize(progress);
  if (p.cleared.includes(chapter.id)) return 'cleared';
  if (!allOpen) {
    const at = Date.parse(chapter.openAt);
    if (!Number.isFinite(at) || !Number.isFinite(nowMs) || nowMs < at) return 'locked';
    const prev = xmasStoryPrevOf(chapter);
    if (prev && !p.cleared.includes(prev.id)) return 'waiting';
  }
  return p.seen.includes(chapter.id) ? 'open' : 'new';
};
// 読んだ(戦う話は勝った)いちばん先の話の番号(0 = まだ1話も)
const xmasStoryReachedNo = (progress) => {
  const p = xmasStoryNormalize(progress);
  return XMAS_STORY_CHAPTERS.reduce((n, c) => (p.cleared.includes(c.id) ? Math.max(n, c.no) : n), 0);
};

// ---- 登場人物パネル(10人・台帳 r1125-063。並びは SCRIPT.md §3 の仮) ----
//  face: 顔の絵(イチーカはスネグーラチカ・もちまるはモッチー)。santa: 助手のサンタ衣装の顔(置き場は data/assistants.js の STORY_OUTFIT_DIRS.santa。パスを画面へ直書きしない)
const XMAS_STORY_CAST = Object.freeze([
  { id: 'atsu', name: 'あつ', santa: true },
  { id: 'sorashido', name: 'ソラシド', santa: true },
  { id: 'myua', name: 'みゅあ', santa: true },
  { id: 'kiki', name: 'きき', santa: true },
  { id: 'momosuke', name: 'ももすけ', santa: true },
  { id: 'dra', name: 'ドラ', santa: true },
  { id: 'kyuko', name: 'きゅうこ', santa: true },
  { id: 'erubin', name: 'えるびん', santa: true },
  { id: 'ichika', name: 'イチーカ', face: 'images/monster-icons/face/snegurochka.png' },
  { id: 'mochimaru', name: 'もちまる', face: 'images/monster-icons/face/mocchi.png' },
]);
const xmasCastFaceOf = (c) => {
  if (!c) return '';
  if (!c.santa) return c.face || '';
  const dir = typeof STORY_OUTFIT_DIRS !== 'undefined' && STORY_OUTFIT_DIRS && STORY_OUTFIT_DIRS.santa;
  return dir ? `${dir}/face/${c.id}_normal.PNG` : '';
};
// いなくなる人(第3案・社長 2026-11-26)。at = いなくなる話 / found = 見つかる話 / box = プレゼントの箱も空になるか(もちまるは空にならない)
const XMAS_STORY_MISSING = Object.freeze([
  { id: 'momosuke', at: 7, found: 25, box: true },
  { id: 'kyuko', at: 9, found: 24, box: true },
  { id: 'erubin', at: 13, found: 25, box: true },
  { id: 'mochimaru', at: 16, found: 25, box: false },
]);
// その話を読み終えたところでの並び。shown: パネルを出すか(はじめてだれかがいなくなった話から)
const xmasStoryCastAt = (no) => {
  const n = Number.isFinite(no) ? Math.floor(no) : 0;
  const away = XMAS_STORY_MISSING.filter((m) => m.at <= n && n < m.found);
  const firstAt = Math.min(...XMAS_STORY_MISSING.map((m) => m.at));
  return {
    shown: n >= firstAt,
    missing: away.map((m) => m.id),
    newly: XMAS_STORY_MISSING.filter((m) => m.at === n).map((m) => m.id),
    left: XMAS_STORY_CAST.length - away.length,
    emptyBoxes: away.filter((m) => m.box).length,
  };
};

// イベントページ(レイドの準備画面も)を開いているあいだの曲(台帳 r1126-015)。閉じると画面の曲へ戻る。BGM を切っている人には鳴らない(ふだんの BGM と同じ口)
const XMAS_EVENT_BGM_TRACK = 'melo_kiss_mystery';
// クリスマスイベントの期間(11/30 10:00〜12/31 3:59)だけの曲(台帳 r1126-023)。期間の外は今までの曲。開催中かは見るたびに数え直す
//  ・ホームのBGM「Dear Santa」(台帳 r1126-023 追記1): HOME の曲(プロフィール・持ち物など HOME の曲を続ける画面も)。BGMアレンジでデフォルトのままの人だけ(自分で選んだ曲は替えない)
//  ・レイドバトル曲「winter fall」: レイドのボスとの戦いの最中(モンヒロバトルの戦闘・MFバトルカードの対戦)
const XMAS_HOME_BGM_TRACK = 'melo_dear_santa';
const XMAS_RAID_BATTLE_BGM_TRACK = 'melo_winter_fall';
const xmasEventBgmOpenAt = (nowMs) => raidXmasWindowAt(nowMs) === 'open';
