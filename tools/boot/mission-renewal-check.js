// ミッションの作り直し(2026-11-08 社長「この文で」・docs/progress/mission-renewal/PLAN.md 第3版)を確かめる。ブラウザは使わない。
//
// 見るもの
//   ① 切り替えの数え方(PLAN.md ④ の表の各行): 同じid・中身が広がる・報酬だけ増える・新しいid(またはバトル)・日替わり/週替わり・
//      週替わりへ移す項目・外す項目・コンプリートの目安(切り替えの期間だけ少ないほう)・次の期間へは持ち越さない
//   ② 二重に受け取れない(受け取り済み sent のidは、新しい定義でも受け取れる一覧に出ない)
//   ③ 途中までの数が残る(古い形の保存を読んでも数が消えない・新しい項目は0で補う)
//   ④ 報酬の量(1日にならしたダイヤ 約24,200・ビートP 約620。PLAN.md 第3版)
//   ⑤ 家具の替え(持っている・助手みんなに贈り終えた → 交換所と同じ値うちのビートP)
//   ⑥ カードパック券のギフト(受け取ると mh_card_tactics_v1 の tickets に入る)
//   ⑦ 助手の1日1行(決まった台詞が8人ぶん・口調の決まり・数字の入った AI の文は使わない)と、中継役 mission-daily-line の中身
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const grab = (a, b) => { const i = source.indexOf(a), j = source.indexOf(b, i + 1); return i >= 0 && j > i ? source.slice(i, j) : ''; };

const core = grab('const LOGIN_BONUS_REWARDS', 'const STAT_POINT_GAIN');
const line = grab('// ===== ミッション: 助手の1日1行の案内', '// 画面から使う:');
check('本番の実装を取り出せている', core.length > 1000 && line.length > 500);
const ctx = {
  // 交換所の家具の値段と、助手8人の並び(本物の表から読む)
  RHYTHM_EVENT_POINT_SHOP_OFFERS: [], ASSISTANT_LIFE_HOUSE_ORDER: ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'],
  window: undefined,
};
vm.createContext(ctx);
const offersSrc = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'rhythm-event.js'), 'utf8');
const offerRows = [...offersSrc.matchAll(/itemId:'(furn_[a-z]+)'[^}]*cost:(\d+)/g)].map((m) => ({ itemId: m[1], cost: Number(m[2]) }));
ctx.RHYTHM_EVENT_POINT_SHOP_OFFERS = offerRows;
vm.runInContext(`${core}\n${line}\nglobalThis.__m={MISSION_DEFS,missionDefsAt,normalizeMissions,missionValue,missionClaimableList,missionCountOf,setMissionRenewMark,normalizeMissionRenewMark,missionRenewMarkAt,missionInSwitch,
  missionDailyPeriod,missionWeeklyPeriod,missionMonthlyPeriod,missionPeriodWeekday,missionRewardsFor,missionFurnitureSwap,buildGiftClaim,emptyMissionCounts,reconcileMonthlyMissionCompletions,
  DAILY_ROTATION_MISSIONS,WEEKLY_ROTATION_MISSIONS,MISSION_MONTHLY_FURNITURE,
  MISSION_DAILY_LINE_FALLBACK,MISSION_DAILY_LINE_IDS,missionDailyLineFor,missionDailyLineValid,missionDailyLineFacts,missionDailyLineShouldFetch,normalizeMissionDailyLine,missionLineRewardText};`, ctx);
const m = ctx.__m;
const at = (s) => Date.parse(s);
// 切り替えた日: 2026-11-08(日)JST 13:00。週は 2026-11-02、月は 2026-11
const T0 = at('2026-11-08T04:00:00Z');
const dayOf = (defs, id) => defs.find((x) => x.id === id);

// ---------- ① 切り替えの数え方 ----------
m.setMissionRenewMark(m.missionRenewMarkAt(T0));
check('印は切り替えたときの日・週・月を持つ', (() => { const k = m.missionRenewMarkAt(T0); return k.daily === '2026-11-08' && k.weekly === '2026-11-02' && k.monthly === '2026-11'; })());
check('壊れた印は読まない(null)', m.normalizeMissionRenewMark({ daily: 1 }) === null && m.normalizeMissionRenewMark('x') === null && m.normalizeMissionRenewMark(null) === null);
check('はじめての人の印(\'-\')はどの期間にも当たらない', (() => {
  m.setMissionRenewMark({ at: T0, daily: '-', weekly: '-', monthly: '-' });
  const r = !m.missionInSwitch('daily', T0) && !m.missionInSwitch('weekly', T0) && !m.missionInSwitch('monthly', T0);
  m.setMissionRenewMark(m.missionRenewMarkAt(T0));
  return r;
})());
// 切り替える前の保存(前の形。新しい項目なし)
const oldSave = {
  version: 2, dailyPeriod: '2026-11-08', weeklyPeriod: '2026-11-02', monthlyPeriod: '2026-11',
  daily: { login: 1, battles: 2, enhances: 1, challengeClears: 0, quickClears: 0 },
  weekly: { battles: 14, enhances: 10, quickClears: 2, challengeClears: 3, marketTrades: 3, itemUses: 2, speciesClears: 1 },
  monthly: { battles: 60, wins: 96, dailyCompletes: 6, weeklyCompletes: 1, quickRuns: 4, challengeRuns: 3, enhances: 12, marketTrades: 10, modeRuns: 9, proClears: 2 },
  sentDaily: ['daily_login', 'daily_enhance', 'daily_rotation'], sentWeekly: ['weekly_enhance', 'weekly_donations', 'weekly_market'], sentMonthly: ['monthly_market'],
  weeklyLoginDays: ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-08'], monthlyLoginDays: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-08'],
  monthlyDailyCompletePeriods: [], monthlyWeeklyCompletePeriods: [],
};
const st = m.normalizeMissions(oldSave, T0);
const D = m.missionDefsAt('daily', T0), W = m.missionDefsAt('weekly', T0), M = m.missionDefsAt('monthly', T0);
const val = (type, defs, id) => m.missionValue(st, type, dayOf(defs, id), defs);
check('同じidで同じ中身(ログイン・強化)は引き継ぐ(受け取り済みのまま)', val('daily', D, 'daily_login') === 1 && val('daily', D, 'daily_enhance') === 1
  && val('weekly', W, 'weekly_logins') === 4 && val('monthly', M, 'monthly_logins') === 5);
check('中身が広がる項目は、今の期間のバトルの数が始まりになる(好きな遊び)', val('daily', D, 'daily_battles') === 2 && val('weekly', W, 'weekly_battles') === 14 && val('monthly', M, 'monthly_battles') === 60);
check('好きな遊びの勝ちは、今の期間のバトルの勝ちが始まりになる', val('monthly', M, 'monthly_wins') === 96);
check('好きな遊びへ、ビート・カードを足していける', (() => {
  const s2 = JSON.parse(JSON.stringify(st)); s2.daily.beatPlays = 1;
  return m.missionValue(s2, 'daily', dayOf(D, 'daily_battles'), D) === 3;
})());
check('報酬だけ増えた項目(受け取り済み)は済みのまま。差額は配らない', !m.missionClaimableList(st, 'weekly').some((x) => x.id === 'weekly_enhance') && val('weekly', W, 'weekly_enhance') === 10);
check('新しいidは0から。ただし「またはバトル」は今の期間のバトルの数を使う', val('weekly', W, 'weekly_assistant') === 0 && val('weekly', W, 'weekly_beat') === 14 && val('monthly', M, 'monthly_beat') === 60
  && val('monthly', M, 'monthly_card') === 38 /* 96勝 × 20/50 */ && val('daily', D, 'daily_assistant') === 0);
check('日替わりは受け取り済みなら済み扱い(中身が変わっても二重にならない)', val('daily', D, 'daily_rotation') === 1 && !m.missionClaimableList(st, 'daily').some((x) => x.id === 'daily_rotation'));
check('週替わりへ移す項目は、切り替えの週の終わりまで残す', !!dayOf(W, 'weekly_market') && !!dayOf(W, 'weekly_daily_claims'));
check('外す項目は、切り替えの月の終わりまで残す(達成済み・未受取なら受け取れる)', !!dayOf(M, 'monthly_market') && !!dayOf(M, 'monthly_mode_runs')
  && !m.missionClaimableList(st, 'monthly').some((x) => x.id === 'monthly_market'));
check('切り替えの期間は同じidを二度並べない', [D, W, M].every((defs) => new Set(defs.map((x) => x.id)).size === defs.length));
check('コンプリートの目安は、切り替えの日・週・月だけ少ないほう', dayOf(D, 'daily_complete').target === 4 && dayOf(W, 'weekly_complete').target === 6 && dayOf(M, 'monthly_complete').target === 8
  && /切り替えの日だけ/.test(dayOf(D, 'daily_complete').condition));
const T1 = at('2026-11-09T04:00:00Z'), TW = at('2026-11-16T04:00:00Z'), TM = at('2026-12-01T04:00:00Z');
check('次の日からは新しい目安(デイリー 6個のうち5個)', (() => { const d = dayOf(m.missionDefsAt('daily', T1), 'daily_complete'); return d.target === 5 && d.condition === '通常デイリー6個のうち5個を達成する'; })());
check('次の週からは新しい目安(ウィークリー 9個のうち7個)。前の項目は週替わりの中へ', (() => {
  const w = m.missionDefsAt('weekly', TW); const c = dayOf(w, 'weekly_complete');
  return c.target === 7 && c.condition === '通常ウィークリー9個のうち7個を達成する' && w.filter((x) => !x.complete).length === 9;
})());
check('次の月からは新しい目安(マンスリー 12個のうち9個)。外す項目は出さない', (() => {
  const mo = m.missionDefsAt('monthly', TM); const c = dayOf(mo, 'monthly_complete');
  return c.target === 9 && !dayOf(mo, 'monthly_market') && !dayOf(mo, 'monthly_mode_runs') && mo.filter((x) => !x.complete).length === 12;
})());
check('切り替えの週の週替わりは、今までと同じ(種族チャレンジ3回)', (() => { const r = W.find((x) => x.id === 'weekly_rotation'); return r && r.key === 'speciesClears' && r.target === 3; })());
// ---------- ② 二重に受け取れない ----------
check('受け取り済みのidは、受け取れる一覧に出ない(3つのタブとも)', ['daily', 'weekly', 'monthly'].every((t) => {
  const sent = t === 'daily' ? st.sentDaily : t === 'weekly' ? st.sentWeekly : st.sentMonthly;
  return m.missionClaimableList(st, t).every((x) => !sent.includes(x.id));
}));
check('ギフトidは「種別+期間+ミッションid」のまま(同じ期間に二度作らない)', /gift_mission_\$\{type\}_\$\{period\}_\$\{mission\.id\}/.test(source)
  && source.includes('if(!nextGifts.some(g=>g?.id===gift.id)) nextGifts=[gift,...nextGifts];'));
check('#4800 の受け取りの直し(runGiftWrite の中で送る→受け取る)を変えていない', source.includes('return inGiftWrite ? run() : runGiftWrite(run);') && source.includes('if (missionClaimingRef.current || giftClaimingRef.current) return null;'));
// ---------- ③ 途中までの数が残る ----------
check('古い形の保存を読んでも数が消えない', st.weekly.battles === 14 && st.monthly.wins === 96 && st.weeklyLoginDays.length === 4 && st.sentDaily.length === 3);
check('新しい数える項目は0、ふれあった日は空で補う', ['beatPlays', 'beatClears', 'cardPlays', 'cardWins', 'assistantTouches', 'friendVisits'].every((k) => st.daily[k] === 0 && st.weekly[k] === 0 && st.monthly[k] === 0)
  && Array.isArray(st.weeklyAssistantDays) && st.weeklyAssistantDays.length === 0 && Array.isArray(st.monthlyAssistantDays));
check('壊れた数(文字・マイナス)は0で読む', (() => { const s = m.normalizeMissions({ ...oldSave, daily: { battles: 'x', login: -3 } }, T0); return s.daily.battles === 0 && s.daily.login === 0; })());
check('月の途中の切り替えで、前の月のコンプリートをさかのぼって足さない', st.monthly.dailyCompletes === 6);
check('保存キー mh_missions の名前は変えていない', source.includes("await storeSet('mh_missions',reconciled,false);") && source.includes("storeGet('mh_missions', null, false)"));
// ---------- ④ 報酬の量 ----------
m.setMissionRenewMark(null);
const sumOf = (rewards, type) => rewards.filter((r) => r.type === type).reduce((a, r) => a + r.amount, 0);
const perDay = (type) => {
  let daily = 0;
  for (let i = 0; i < 7; i++) daily += m.missionDefsAt('daily', at('2026-11-16T04:00:00Z') + i * 86400000).reduce((a, x) => a + sumOf(x.rewards, type), 0);
  const weekly = m.missionDefsAt('weekly', TW).reduce((a, x) => a + sumOf(x.rewards, type), 0);
  const monthly = m.missionDefsAt('monthly', TM).reduce((a, x) => a + sumOf(x.rewards, type), 0);
  return daily / 7 + weekly / 7 + monthly / 30;
};
const dia = perDay('diamond'), beat = perDay('beatPoint');
check('1日にならしたダイヤは約24,200(PLAN.md 第3版)', Math.abs(dia - 24200) / 24200 < 0.02, `${Math.round(dia).toLocaleString()}`);
check('1日にならしたビートPは約620(ランクアップの約2,000より小さい)', Math.abs(beat - 620) / 620 < 0.03 && beat < 2000, `${Math.round(beat)}`);
check('コンプリートのダイヤは 5,000 / 30,000 / 100,000', sumOf(dayOf(m.missionDefsAt('daily', T1), 'daily_complete').rewards, 'diamond') === 5000
  && sumOf(dayOf(m.missionDefsAt('weekly', TW), 'weekly_complete').rewards, 'diamond') === 30000 && sumOf(dayOf(m.missionDefsAt('monthly', TM), 'monthly_complete').rewards, 'diamond') === 100000);
check('曜日のおやつ・週替わりの道具・月替わりの家具が入れ替わる', (() => {
  const items = (i) => dayOf(m.missionDefsAt('daily', at('2026-11-16T04:00:00Z') + i * 86400000), 'daily_assistant').rewards[0].itemId;
  const week = (i) => dayOf(m.missionDefsAt('weekly', TW + i * 7 * 86400000), 'weekly_assistant').rewards[0].itemId;
  const month = (iso) => dayOf(m.missionDefsAt('monthly', at(iso)), 'monthly_complete').rewards.find((r) => /^furn_/.test(r.itemId || '')).itemId;
  return items(0) === 'peer_onigiri' && items(1) === 'peer_tea' && items(4) === 'peer_gift' && new Set([0, 1, 2, 3, 4].map(week)).size === 5
    && month('2026-11-15T04:00:00Z') === 'furn_sofa' && month('2026-12-15T04:00:00Z') === 'furn_bear' && m.MISSION_MONTHLY_FURNITURE.length === 12;
})());
check('報酬の数は表の中だけ(AI の文から数を取らない)', !/amount\s*:\s*(?:ai|line|res)\b/i.test(grab('// ===== ミッション: 助手の1日1行の案内', 'const useMissionDailyLines')));
// ---------- ⑤ 家具の替え ----------
const sofaCost = (offerRows.find((o) => o.itemId === 'furn_sofa') || {}).cost;
check('交換所の家具の値段を読めた', offerRows.length === 20 && sofaCost === 1200);
check('持っていない家具はそのまま届く', m.missionFurnitureSwap('furn_sofa', { furn_sofa: 0 }, {}) === null);
check('持っている家具は、交換所と同じ値うちのビートPに替える', (() => { const r = m.missionFurnitureSwap('furn_sofa', { furn_sofa: 1 }, {}); return r && r.type === 'beatPoint' && r.amount === 1200; })());
check('助手みんなに贈り終えた家具もビートPに替える(1人でも残っていればそのまま)', (() => {
  const got = { got: { sofa: '2026-11-08' } };
  const all = Object.fromEntries(ctx.ASSISTANT_LIFE_HOUSE_ORDER.map((id) => [id, got]));
  const some = { ...all }; delete some.erubin;
  return !!m.missionFurnitureSwap('furn_sofa', {}, all) && m.missionFurnitureSwap('furn_sofa', {}, some) === null;
})());
check('家具でない物は替えない', m.missionFurnitureSwap('peer_cake', { peer_cake: 9 }, {}) === null);
check('マンスリーコンプリートの家具だけがビートPに替わり、ほかの報酬はそのまま', (() => {
  const c = dayOf(m.missionDefsAt('monthly', at('2026-11-15T04:00:00Z')), 'monthly_complete');
  const r = m.missionRewardsFor(c.rewards, { ownedItems: { furn_sofa: 2 } });
  return r.length === c.rewards.length && r.filter((x) => x.swappedFrom === 'furn_sofa' && x.type === 'beatPoint' && x.amount === 1200).length === 1
    && sumOf(r, 'beatPoint') === 3000 + 1200 && sumOf(r, 'diamond') === 100000;
})());
check('受け取りでも同じ替え方を通し、ギフトには替えた印を残さない', source.includes('buildMissionGift(type,period,mission,missionRewardsFor(mission.rewards,{ownedItems,room}))')
  && source.includes('.map(({swappedFrom,...r})=>({...r}))'));
// ---------- ⑥ カードパック券 ----------
const cardClaim = m.buildGiftClaim({ rewards: [{ type: 'cardPackTicket', amount: 2 }, { type: 'beatPoint', amount: 500 }], expiresAt: null, claimedAt: null },
  { gold: 0, breederPoints: 0, ownedItems: {}, beatPoints: 10, cardPackTickets: 3 });
check('カードパック券のギフトを受け取れる(券の数に足す)', cardClaim.ok && cardClaim.balances.cardPackTickets === 5 && cardClaim.balances.beatPoints === 510);
check('受け取ると mh_card_tactics_v1 の tickets を同じ取引で保存する', source.includes("entries.push({ key:CARD_TACTICS_KEY, before:storedCardBefore, next:{ ...cardBefore, tickets:balances.cardPackTickets } })")
  && source.includes('if (!cardBefore && Array.isArray(gift?.rewards) && gift.rewards.some(r => r?.type === \'cardPackTicket\')) return gift;'));
// ---------- ⑦ 助手の1日1行 ----------
const facts = m.missionDailyLineFacts(at('2026-11-09T04:00:00Z')); // 月曜
check('今日のやること・報酬はゲームの表から作る(月曜: ビートP150)', facts.day === '月' && facts.task === 'モンヒロビートを1曲クリアする' && facts.reward === 'ビートP150');
check('火曜の報酬はカードパック券1枚', m.missionDailyLineFacts(at('2026-11-10T04:00:00Z')).reward === 'カードパック券1枚');
check('決まった台詞が8人ぶんあり、{task}・{reward} を1つずつ持つ', m.MISSION_DAILY_LINE_IDS.length === 8 && m.MISSION_DAILY_LINE_IDS.every((id) => {
  const t = m.MISSION_DAILY_LINE_FALLBACK[id]; return typeof t === 'string' && t.split('{task}').length === 2 && t.split('{reward}').length === 2 && !/[0-9]/.test(t);
}));
const fb = (id) => m.missionDailyLineFor(id, {}, facts).text;
check('決まった台詞は穴埋めが全部入る', m.MISSION_DAILY_LINE_IDS.every((id) => !/[{}]/.test(fb(id)) && fb(id).includes('ビートP150') && fb(id).includes('モンヒロビート')));
check('口調: みゅあは「じゃん」「まじ」を使わない・ききはタメ口にしない', !/じゃん|まじ/.test(fb('mua')) && /でつ|まつ|ます/.test(fb('kiki')) && !/だよ|だね/.test(fb('kiki')));
check('口調: ももすけは自分を「私」「あたし」と言わない・ドラは関西弁にしない', !/私|あたし/.test(fb('momosuke')) && !/ほんま|やで|とる|とんだ/.test(fb('dra')));
check('口調: あつは文の最後が「笑」か記号', /[笑！？…!?]$/.test(fb('atsu')));
// 2026-11-11 社長: ソラシドは丁寧語が土台。「だぜ」はほぼ使わない
check('口調: ソラシドは丁寧語で「ぜ」を使わない、きゅうこは「ほい！」、えるびんは気づかう', /です|ます/.test(fb('sorashido')) && !/ぜ/.test(fb('sorashido')) && /ほい！/.test(fb('kyuko')) && /無理しない/.test(fb('erubin')));
check('AI の文は、数字が入っていたら使わない(決まった台詞に戻す)', (() => {
  const r = m.missionDailyLineFor('mua', { mua: '今日は{task}で{reward}！ 3回やろ' }, facts);
  return !r.ai && r.text === fb('mua');
})());
check('AI の文は、{reward} が無い・2つある・長すぎる・リンクがあると使わない', !m.missionDailyLineValid('{task}だよ') && !m.missionDailyLineValid('{task}と{reward}{reward}')
  && !m.missionDailyLineValid(`{task}と{reward}${'あ'.repeat(90)}`) && !m.missionDailyLineValid('{task}と{reward} https://x'));
check('使える AI の文は、その助手の行に穴埋めして出す', (() => { const r = m.missionDailyLineFor('atsu', { atsu: 'てか{task}で{reward}な笑' }, facts); return r.ai && r.text === 'てかモンヒロビートを1曲クリアするでビートP150な笑'; })());
check('知らない助手は、みゅあの台詞にする', m.missionDailyLineFor('nobody', {}, facts).who === 'mua');
check('呼ぶのは1人1日1回(届いていれば同じ日は呼ばない)・届かなければ10分あけて3回まで', (() => {
  const day = '2026-11-09', now = at('2026-11-09T05:00:00Z');
  return m.missionDailyLineShouldFetch(null, day, now)
    && !m.missionDailyLineShouldFetch({ day, lines: { mua: '{task}で{reward}♪' }, tries: 1, at: now }, day, now)
    && !m.missionDailyLineShouldFetch({ day, lines: {}, tries: 1, at: now - 60000 }, day, now)
    && m.missionDailyLineShouldFetch({ day, lines: {}, tries: 1, at: now - 11 * 60000 }, day, now)
    && !m.missionDailyLineShouldFetch({ day, lines: {}, tries: 3, at: now - 3600000 }, day, now)
    && m.missionDailyLineShouldFetch({ day: '2026-11-08', lines: { mua: '{task}で{reward}♪' }, tries: 1, at: now }, day, now);
})());
check('保存の控えは壊れていても読める(使えない文は落とす)', (() => { const s = m.normalizeMissionDailyLine({ day: 3, lines: { mua: '1{task}{reward}', kiki: '{task}と{reward}でつ' }, tries: 'x' }); return s.day === '' && !s.lines.mua && !!s.lines.kiki && s.tries === 0; })());
check('ミッション画面のデイリーで、選んでいる助手が話す', source.includes('const dailyLine = missionDailyLineFor(bond && bond.assistantId, aiLines);') && source.includes("dailyLine&&missionTab==='daily'?"));

// 中継役(supabase/functions/mission-daily-line/core.js)を偽物の Claude と偽物の表で動かす
(async () => {
  const c = await import(path.join(ROOT, 'supabase', 'functions', 'mission-daily-line', 'core.js'));
  const good = Object.fromEntries(c.IDS.map((id) => [id, c.EXAMPLES[id][0]]));
  const fake = (text) => ({ messages: { create: async () => ({ content: [{ type: 'text', text }] }) } });
  let put = null, calls = 0;
  const run = (claimed, text) => c.handleRequest({ claim: async () => claimed, put: async (d, l, ok) => { put = { d, l, ok }; }, client: { messages: { create: async (a) => { calls++; return fake(text).messages.create(a); } } } });
  calls = 0; put = null;
  const r1 = await run({ state: 'claimed', day: '2026-11-09' }, '```json\n' + JSON.stringify({ ...good, erubin: '{task}で{reward}を3個' }) + '\n```');
  check('中継役: 作る番なら Claude を1回呼び、使える行だけを表に置く', calls === 1 && r1.json.ok && Object.keys(r1.json.lines).length === 7 && !r1.json.lines.erubin && put && put.ok && put.d === '2026-11-09');
  calls = 0;
  const r2 = await run({ state: 'ready', day: '2026-11-09', lines: good }, '');
  check('中継役: もうできていれば Claude を呼ばず、表の文を返す', calls === 0 && r2.json.ok && Object.keys(r2.json.lines).length === 8);
  calls = 0;
  const r3 = await run({ state: 'pending', day: '2026-11-09' }, '');
  check('中継役: ほかの人が作っている途中なら呼ばない(ゲームは決まった台詞)', calls === 0 && r3.json.ok === false);
  put = null;
  const r4 = await run({ state: 'claimed', day: '2026-11-09' }, 'ごめんなさい');
  check('中継役: 返事が使えなければ failed として置き、ok:false を返す', r4.json.ok === false && put && put.ok === false);
  check('中継役: Claude に報酬の数を渡さない・数字を書かせない', (() => { const p = c.buildPrompt('2026-11-09'); return !/[0-9０-９]/.test(p.user) && /数字(.*)書かない/.test(p.system); })());
  check('中継役: ゲームと同じ見張り(数字・{task}{reward}・長さ)', !c.lineValid('{task}{reward}1') && c.lineValid('{task}と{reward}だよ') && !c.lineValid('この子と{task}{reward}') && c.LINE_MAX === 90);
  check('中継役: モデルは claude-haiku-5-5', c.MODEL === 'claude-haiku-5-5');
  // 崩れた返事(2026-11-08 本番の1回目で「返事は来たが使える行が0本」だった)。どれも0本にならず、数字の文は捨てる
  const L8 = (f) => Object.fromEntries(c.IDS.map((id, i) => [id, f(id, i)]));
  const base = (id) => `今日は月曜日！{task}と{reward}がもらえるよ${id === 'atsu' ? '笑' : ''}`;
  const shapes = {
    '前後に説明と```json の囲み': `はい、作りました！\n\`\`\`json\n${JSON.stringify(L8(base), null, 2)}\n\`\`\`\nどうでしょう？`,
    '配列で返る': JSON.stringify(c.IDS.map((id) => ({ id, line: base(id) }))),
    'キーが日本語の名前': JSON.stringify({ 'みゅあ': base('mua'), 'きき': base('kiki'), 'ももすけ': base('momosuke'), 'ドラ': base('dra'), 'あつ': base('atsu'), 'きゅうこ': base('kyuko'), 'ソラシド': base('sorashido'), 'えるびん': base('erubin') }),
    '中に包まれている': JSON.stringify({ lines: L8(base) }),
    '途中で切れた JSON': JSON.stringify(L8(base)).slice(0, 260),
    '{task}・{reward} を書かない': JSON.stringify(L8(() => '今日もいっしょにがんばろ！')),
    '{task}・{reward} を2回書く': JSON.stringify(L8(() => '{task}と{reward}！ {task}で{reward}だよ')),
    '全角のかっこ・【】で書く': JSON.stringify(L8(() => '今日は｛task｝で【reward】がもらえるよ')),
    '曜日や日付を数字で書く(一部)': JSON.stringify(L8((id, i) => (i % 2 ? '11月9日は{task}で{reward}！' : base(id)))),
    '長すぎる(一部)': JSON.stringify(L8((id, i) => (i < 3 ? `{task}と{reward}${'あ'.repeat(95)}` : base(id)))),
    '見張りの語に当たる(一部)': JSON.stringify(L8((id, i) => (i === 0 ? 'この子と{task}で{reward}' : base(id)))),
  };
  for (const [name, text] of Object.entries(shapes)) {
    const d = c.parseLinesDetail(text);
    const n = Object.keys(d.lines).length;
    check(`中継役: 崩れた返事でも0本にならない(${name})`, n >= 3 && Object.values(d.lines).every((t) => c.lineValid(t) && !/[0-9０-９]/.test(t)), JSON.stringify({ n, reasons: d.reasons }));
  }
  check('中継役: 穴の無い行は後ろに「({task}と{reward})」を足す・2回目の穴は消す', c.tidyLine('がんばろ！') === 'がんばろ！({task}と{reward})' && c.tidyLine('{task}と{reward}！{task}') === '{task}と{reward}！');
  check('中継役: 数字の入った文は捨て、理由を数える(本文は出さない)', (() => { const d = c.parseLinesDetail(JSON.stringify(L8(() => '3回{task}で{reward}'))); return Object.keys(d.lines).length === 0 && d.reasons.number === 8; })());
  check('中継役: 返事が文だけ(JSON なし)なら理由を no_reply / no_json で数える', c.parseLinesDetail('ごめんなさい').reasons.no_reply === 1 && c.parseLinesDetail('{ こわれた').reasons.no_json === 1);
  {
    const logs = [];
    put = null;
    const r = await c.handleRequest({ claim: async () => ({ state: 'claimed', day: '2026-11-09' }), put: async (d, l, ok) => { put = { d, l, ok }; },
      client: fake('```json\n' + JSON.stringify(L8((id, i) => (i === 0 ? base(id) : '9時に{task}で{reward}'))) + '\n```'), log: (e) => logs.push(e) });
    const made = logs.find((e) => e.event === 'made');
    check('中継役: 1行でも使えれば ready にして、その行を返す', r.json.ok && Object.keys(r.json.lines).length === 1 && put && put.ok === true);
    check('中継役: ログは使えた数と落ちた理由の数だけ(本文を出さない)', !!made && made.count === 1 && made.reasons.number === 7 && !JSON.stringify(logs).includes('{task}'));
  }
  // 口調の見張り(2026-11-08 窓口: 本番の文で、みゅあ「もらえちゃぢゃん！」・きゅうこ「日曜日ぇ。」が不自然だった)
  check('中継役: みゅあの「〜ちゃぢゃん」、きゅうこの名詞のあとの「ぇ」は捨てる', c.toneProblem('mua', '{task}で{reward}もらえちゃぢゃん！') && c.toneProblem('kyuko', '今日は日曜日ぇ。{task}で{reward}')
    && !c.toneProblem('mua', '{task}で{reward}！ 楽ちんぢゃん') && !c.toneProblem('kyuko', '{task}で{reward}だってさ。効率いいねぇ'));
  check('中継役: ききのタメ口・ももすけの「私」・ドラの関西弁・あつの文末なし・みゅあの「じゃん」も捨てる', c.toneProblem('kiki', '{task}で{reward}だよ') && c.toneProblem('momosuke', '私も{task}で{reward}')
    && c.toneProblem('dra', '{task}で{reward}やで') && c.toneProblem('atsu', '{task}で{reward}') && c.toneProblem('mua', '{task}で{reward}じゃん'));
  check('中継役: 頼み方の見本は8人とも2〜3行あり、どれも見張りを通る', c.IDS.every((id) => Array.isArray(c.EXAMPLES[id]) && c.EXAMPLES[id].length >= 2 && c.EXAMPLES[id].every((t) => c.lineValid(t) && !c.toneProblem(id, t))));
  check('中継役: 口調の崩れた行は、その助手だけ捨てる(理由 tone を数える)', (() => { const d = c.parseLinesDetail(JSON.stringify({ ...L8(base), mua: '{task}で{reward}もらえちゃぢゃん！', kyuko: '今日は日曜日ぇ。{task}で{reward}' })); return Object.keys(d.lines).length === 6 && d.reasons.tone === 2; })());
  check('中継役: 1行は短め(30字くらい・長くても45字)と頼む', /30字くらい\(長くても45字\)/.test(c.buildPrompt('2026-11-09').system));
  check('中継役: Claude を待つのは15〜20秒(ゲームは8秒で決まった台詞に戻る)', (() => { const ix = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'mission-daily-line', 'index.ts'), 'utf8'); const m = /timeout:\s*(\d+)_?(\d*)/.exec(ix); const ms = m ? Number(m[1] + m[2]) : 0; return ms >= 15000 && ms <= 20000; })());
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '202611080002_mission_daily_lines.sql'), 'utf8');
  check('SQL は足すだけ(drop・delete・truncate・alter column なし)・ゲームから読めない', !/\bdrop\b|\bdelete\b|\btruncate\b|alter\s+table\s+\S+\s+(?:drop|alter)\s/i.test(sql)
    && /enable row level security/.test(sql) && /revoke all on table public\.mission_daily_lines from anon, authenticated/.test(sql));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
