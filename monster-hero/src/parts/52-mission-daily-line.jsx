// ===== ミッション: 助手の1日1行の案内(2026-11-08 社長 ③A・docs/progress/mission-renewal/PLAN.md 4) =====
// ミッションの画面(デイリーのタブ)で、いま選んでいる助手が、その日の日替わりミッションを1行で教えてくれる。
//   ・文は中継役 supabase/functions/mission-daily-line が、1日1回だけ Claude に8人ぶんまとめて作らせ、全員で同じ文を読む(表 mission_daily_lines)
//   ・AI が書くのは言い回しだけ。{task}(やること)と {reward}(報酬)はゲームの中の表(DAILY_ROTATION_MISSIONS)から入れる。
//     報酬の数を AI に決めさせない(数がぶれると不公平になる)。数字が入った文は中継役でも、ここでも捨てる
//   ・呼ぶのは1人1日1回まで(朝4時の区切り)。届かない・落ちた・切のときは、下の決まった台詞(8人の口調)を出す
//   ・保存は新しいキー mh_mission_daily_line_v1 { day, lines:{ 助手id: 文 }, tries, at } だけ(読むときは normalizeMissionDailyLine を通す)
// ★17 の部品は window を掴まない決まり(parts-purity-check)なので、知らせの口はここに置く。
// ほかの部品(ビート・カード・助手ライフ・フレンド)から「ミッションが進んだ」を知らせる。数えるのは MonsterHeroGame の saveMissionProgress だけ
const MISSION_PROGRESS_EVENT = 'mh:mission-progress';
const missionNotify = (event, amount = 1) => {
  try { if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent(MISSION_PROGRESS_EVENT, { detail: { event, amount } })); } catch (_) {}
};
// 「達成済みかつ未受取(ギフト未送付)」のミッション。HOMEの通知バッジ・タブのバッジ・一括受取が
// すべてこの判定を共有するので、どこか1か所だけ数え方がずれることがない
const MISSION_DAILY_LINE_URL = `${typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''}/functions/v1/mission-daily-line`;
const MISSION_DAILY_LINE_KEY = 'mh_mission_daily_line_v1';
const MISSION_DAILY_LINE_IDS = Object.freeze(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
// 届かなかった日は、10分あけて1日3回まで呼び直す
const MISSION_DAILY_LINE_TRIES = 3, MISSION_DAILY_LINE_RETRY_MS = 10 * 60 * 1000, MISSION_DAILY_LINE_WAIT_MS = 8000;
const MISSION_WEEKDAY_NAMES = Object.freeze(['日', '月', '火', '水', '木', '金', '土']);
// 文に入れる「やること」(日替わりの曜日ごと)。AI には文字で渡し、AI の文では {task} と書かせる
const MISSION_DAILY_LINE_TASKS = Object.freeze({
  0: 'フレンドの家へ行く', 1: 'モンヒロビートを1曲クリアする', 2: 'MFバトルカードで1回勝つ', 3: 'クイックモードを1回クリアする',
  4: 'プロモードを1回クリアする', 5: '種族チャレンジを1回クリアする', 6: 'アイテムを1個使う',
});
// 決まった台詞(8人の口調。docs/progress/assistant-peer/VOICE.md)。{day} 曜日の字・{task} やること・{reward} 報酬
const MISSION_DAILY_LINE_FALLBACK = Object.freeze({
  mua:       '今日は{day}曜日！{task}と、{reward}がもらえるよ♪',
  kiki:      '今日は{day}曜日でつ。{task}と、{reward}がもらえまつよ♪',
  momosuke:  '今日は{day}曜日！！ {task}と{reward}もらえるよ♡ ももと一緒にやろ！！',
  dra:       '今日は{day}曜日だな。{task}と、{reward}がもらえるからな。えへへ',
  atsu:      '今日は{day}曜日！ とりあえず{task}と{reward}もらえるよ笑',
  kyuko:     'ほい！ 今日は{day}曜日ぃ。{task}と{reward}もらえるよ〜',
  sorashido: 'うぉぉぉ！ 今日は{day}曜日だぜ・・・！ {task}と{reward}がもらえるぜ笑',
  erubin:    '今日は{day}曜日だね。{task}と、{reward}がもらえるよ。無理しない程度にね',
});
// 報酬を文の中で読む形(「ビートP150」「カードパック券1枚」)。数はゲームの表のまま
const missionLineRewardText = (r) => {
  const n = Math.max(0, Math.floor(Number(r && r.amount) || 0)).toLocaleString();
  if (!r) return '';
  if (r.type === 'diamond') return `ダイヤ${n}`;
  if (r.type === 'beatPoint') return `ビートP${n}`;
  const name = r.type === 'gameItem'
    ? ((typeof giftItemRewardInfo === 'function' && giftItemRewardInfo(r.itemId)) || {}).name || ''
    : (typeof GIFT_REWARD_LABELS !== 'undefined' && GIFT_REWARD_LABELS[r.type]) || '';
  if (!name) return '';
  return `${name}${n}${/(券|チケット)$/.test(name) ? '枚' : '個'}`;
};
// 今日の日替わりミッション(曜日・やること・報酬の文)
const missionDailyLineFacts = (now = Date.now()) => {
  const wd = typeof missionPeriodWeekday === 'function' ? missionPeriodWeekday(now) : new Date(Number(now) + 5 * 3600000).getUTCDay();
  const m = typeof DAILY_ROTATION_MISSIONS !== 'undefined' ? DAILY_ROTATION_MISSIONS[wd] : null;
  const reward = m ? m.rewards.map(missionLineRewardText).filter(Boolean).join('と') : '';
  return { weekday: wd, day: MISSION_WEEKDAY_NAMES[wd] || '', task: MISSION_DAILY_LINE_TASKS[wd] || '', reward };
};
// AI の文として使ってよいか。{task}・{reward} が1つずつ・数字なし・90字まで・1行・リンクなし
const missionDailyLineValid = (t) => typeof t === 'string' && t.length > 0 && t.length <= 90
  && t.split('{task}').length === 2 && t.split('{reward}').length === 2
  && !/[0-9０-９]/.test(t) && !/[\r\n]/.test(t) && !/https?:|www\./i.test(t) && !/[<>]/.test(t);
const missionDailyLineFill = (template, facts) => String(template).split('{day}').join(facts.day).split('{task}').join(facts.task).split('{reward}').join(facts.reward);
// いま出す1行。AI の文が使えればそれ、無ければ決まった台詞
const missionDailyLineFor = (who, aiLines, facts = missionDailyLineFacts()) => {
  const id = MISSION_DAILY_LINE_IDS.includes(who) ? who : 'mua';
  if (!facts.task || !facts.reward) return null;
  const ai = aiLines && typeof aiLines === 'object' ? aiLines[id] : null;
  return { who: id, text: missionDailyLineFill(missionDailyLineValid(ai) ? ai : MISSION_DAILY_LINE_FALLBACK[id], facts), ai: missionDailyLineValid(ai) };
};
const normalizeMissionDailyLine = (v) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const lines = {};
  if (r.lines && typeof r.lines === 'object' && !Array.isArray(r.lines)) MISSION_DAILY_LINE_IDS.forEach((id) => { if (missionDailyLineValid(r.lines[id])) lines[id] = r.lines[id]; });
  const tries = Number.isFinite(Number(r.tries)) ? Math.max(0, Math.floor(Number(r.tries))) : 0;
  return { day: typeof r.day === 'string' ? r.day : '', lines, tries, at: Number.isFinite(Number(r.at)) ? Number(r.at) : 0 };
};
// 呼ぶかどうか(今日の分が無い・まだ届いていなくて間があいた)
const missionDailyLineShouldFetch = (saved, today, now = Date.now()) => {
  const s = normalizeMissionDailyLine(saved);
  if (s.day !== today) return true;
  if (Object.keys(s.lines).length) return false;
  return s.tries < MISSION_DAILY_LINE_TRIES && now - s.at >= MISSION_DAILY_LINE_RETRY_MS;
};
const missionDailyLineOpen = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.missionDailyLine === true;
// 中継役から今日の8人ぶんをもらう。だめなら null(決まった台詞のまま)
const missionDailyLineFetch = async () => {
  if (!missionDailyLineOpen() || typeof fetch === 'undefined') return null;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ac) ac.abort(); }, MISSION_DAILY_LINE_WAIT_MS);
  try {
    const r = await fetch(MISSION_DAILY_LINE_URL, { method: 'POST', headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' }, body: '{}', signal: ac ? ac.signal : undefined });
    const res = r.ok ? await r.json() : null;
    return res && res.ok === true && res.lines && typeof res.lines === 'object' ? normalizeMissionDailyLine({ lines: res.lines }).lines : null;
  } catch (e) { return null; } finally { clearTimeout(timer); }
};
// 画面から使う: 今日の AI の文(無ければ {})。開いたときに1回だけ、要るときだけ呼ぶ
const useMissionDailyLines = () => {
  const [lines, setLines] = useState({});
  useEffect(() => {
    let live = true;
    (async () => {
      const today = typeof jstDayKey4 === 'function' ? jstDayKey4() : '';
      let saved = null;
      try { saved = await storeGet(MISSION_DAILY_LINE_KEY, null, false); } catch (e) { saved = null; }
      const s = normalizeMissionDailyLine(saved);
      if (s.day === today && live) setLines(s.lines);
      if (!missionDailyLineOpen() || !missionDailyLineShouldFetch(saved, today)) return;
      const got = await missionDailyLineFetch();
      const next = got && Object.keys(got).length ? { day: today, lines: got, tries: (s.day === today ? s.tries : 0) + 1, at: Date.now() }
        : { day: today, lines: {}, tries: (s.day === today ? s.tries : 0) + 1, at: Date.now() };
      try { await storeSet(MISSION_DAILY_LINE_KEY, next, false); } catch (e) {}
      if (live) setLines(next.lines);
    })();
    return () => { live = false; };
  }, []);
  return lines;
};
