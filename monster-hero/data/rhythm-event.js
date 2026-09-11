// モンヒロビートの週間ランキング／期間限定イベントの定義
// (docs/spec/RHYTHM_RANKING.md §6・§7。フェーズ3「週間ランキング(報酬なし)」)。
//
// ここに置くのは「いつの週か」と「その週の対象曲はどれか」だけ。
// 順位そのものは Supabase 側の関数(rhythm_event_song_bests / rhythm_event_totals)が集計する。
// 端末は集計済みの数十行を受け取って並べるだけなので、曲が増えても通信量は変わらない(§8.7)。
//
// ★期間の正本はサーバー(rhythm_week_window)。端末の時計を進めても週は変わらない(§6.1)。
//   ここにある週の計算は、①ランキングを開く前に「いまどの週か」を見当づける
//   ②残り時間を1秒ごとに数える(そのたびにサーバーへ聞きに行かないため)の2つにだけ使う。
// ★曲数・曲名をどこにも書き写さない(§5.1)。対象曲はIDで書き、表示名は実データから引く。

// 週の区切りは毎週月曜 5:00 JST(= 日曜 20:00 UTC)。
// 2026-09-14(月) 05:00 JST を基準点にして、そこから7日ずつ数える。
// 基準点を固定にしておくと、端末の地域設定や夏時間の有無に左右されない
// (JSTに夏時間は無いが、Dateの曜日計算を端末の時間帯に任せないためにこの形にする)。
const RHYTHM_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RHYTHM_WEEK_ANCHOR_MS = Date.UTC(2026, 8, 13, 20, 0, 0); // 2026-09-14 05:00 JST
const RHYTHM_JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// その時刻が属する週の始まり(月曜5:00 JST)。壊れた値は基準点へ倒す
// (null を Number() に通すと 0 = 1970年になってしまうので、先にはじく)
const rhythmWeekStartMs = (nowMs) => {
  const t = (nowMs === null || nowMs === undefined || nowMs === '') ? NaN : Number(nowMs);
  if (!Number.isFinite(t)) return RHYTHM_WEEK_ANCHOR_MS;
  return RHYTHM_WEEK_ANCHOR_MS + Math.floor((t - RHYTHM_WEEK_ANCHOR_MS) / RHYTHM_WEEK_MS) * RHYTHM_WEEK_MS;
};
// 週の始まりと終わり。終わりは次の週の始まりと同じ時刻(その瞬間は次の週に入る)
const rhythmWeekWindow = (nowMs) => {
  const startMs = rhythmWeekStartMs(nowMs);
  return { startMs, endMs: startMs + RHYTHM_WEEK_MS };
};
// 基準週を0とした通し番号。ローテーションのどこを使うかを決めるのに使う
const rhythmWeekIndex = (nowMs) => Math.round((rhythmWeekStartMs(nowMs) - RHYTHM_WEEK_ANCHOR_MS) / RHYTHM_WEEK_MS);
// 週のID。フェーズ4で報酬の受取フラグの一部になるので、**あとから形を変えない**(§7)。
// 月曜5:00 JSTの日付そのままで weekly_YYYY_MM_DD になる
const rhythmWeekId = (nowMs) => {
  const jst = new Date(rhythmWeekStartMs(nowMs) + RHYTHM_JST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `weekly_${jst.getUTCFullYear()}_${pad(jst.getUTCMonth() + 1)}_${pad(jst.getUTCDate())}`;
};

// ===== 今週の対象曲 =====
//
// 3曲の組を手で選んで並べ、週ごとに順に回す(§5.7「いまは手で選ぶ」)。
// ★ローテーションにしたのは、毎週デプロイしないと週間ランキングが消える作りにしないため。
//   一覧が一巡したら先頭へ戻るので、放っておいても必ずその週の3曲が決まる。
// ★組み方の決めごと
//   ・となりあう週で同じ曲を選ばない(最後の組と先頭の組のあいだも見る)
//   ・一巡すると公開曲がひととおり対象になる
//   ・正式譜面が完成している曲(=曲えらびに並んでいる曲)からだけ選ぶ(§6.4)
//   曲を足したらここへも組を足す。tools/mode/rhythm-event-window-check.js が上の3つを見張る。
const RHYTHM_WEEKLY_ROTATION = Object.freeze([
  Object.freeze({ songIds: Object.freeze(['monster_hero', 'toriko', 'crossing_field']) }),
  Object.freeze({ songIds: Object.freeze(['kiki_issen', 'kaze_ga_soyogu', 'nothing_without_you']) }),
  Object.freeze({ songIds: Object.freeze(['stay_with_me', 'dullahan', '4u_hitasura']) }),
  Object.freeze({ songIds: Object.freeze(['mf_ichika_mix', 'close_to_your_heart', 'kindan_no_resistance']) }),
  Object.freeze({ songIds: Object.freeze(['six_eternel_remix', 'dullahan_clockwork', 'monster_hero_another']) }),
  Object.freeze({ songIds: Object.freeze(['eiki_boss_remix', 'pandora_boss_remix', 'kaze_ga_soyogu']) }),
]);

// 期間限定イベント(kind:'limited')。
// 開催中は週間を休む(§7「同時に成立するイベントは1つまで」)ので、
// ここへ1件書くと、その期間だけ週間ランキングの代わりにイベントが出る。
// id は受取フラグの一部になるので、**あとから変えない**。
//
// rewardLineageBySongId … その曲の部門の1〜5位へ配る超越の実の種族(主血統id)。
//   書かなければ、その部門の報酬はプシュケーだけになる。
// totalReward … 総合部門の1〜5位へ配るもの。'heroProof'(勇者の証) か 'rainbowFruit'(虹の超越の実)。
//   書かなければ総合もプシュケーだけ。
// ★週間(kind:'weekly')には報酬を付けていない(フェーズ3は報酬なし)。
//   報酬が要るのは、いまのところ期間限定イベントだけ。
const RHYTHM_EVENTS = Object.freeze([
  // 2026-09-11・ユーザー指示「試験イベントとしてゲリラで週末イベントみたいな形でやる」。
  // 金曜15:00から月曜5:00まで。終わりを週の区切りに合わせてあるので、
  // イベントが終わった瞬間に週間ランキングへ戻り、空白の時間ができない。
  Object.freeze({
    id: 'weekend_2026_09_11',
    kind: 'limited',
    name: 'モンヒロビート 週末ゲリラ杯',
    startAt: '2026-09-11T15:00:00+09:00',
    endAt: '2026-09-14T05:00:00+09:00',
    songIds: Object.freeze(['monster_hero', 'kaze_ga_soyogu', 'close_to_your_heart']),
    rewardLineageBySongId: Object.freeze({
      monster_hero: 'suezo',
      kaze_ga_soyogu: 'mocchi',
      close_to_your_heart: 'tiger',
    }),
    totalReward: 'heroProof',
  }),
]);

// ===== 報酬(docs/spec/RHYTHM_RANKING.md §9) =====
//
// 1位から5位まで。個数は 5 / 4 / 3 / 2 / 1、プシュケーは 1,000 / 800 / 600 / 400 / 200。
// 6位以下は無し。ここは「何位に何個」だけを持ち、**アイテムの実体(id)はゲーム本体側で解決する**
// (アイテムの定義は 11-masu-progression.jsx にあり、このファイルより後で読み込まれるため)。
const RHYTHM_EVENT_REWARD_COUNTS = Object.freeze([5, 4, 3, 2, 1]);
const RHYTHM_EVENT_REWARD_PSYCHE = Object.freeze([1000, 800, 600, 400, 200]);
const RHYTHM_EVENT_REWARD_RANKS = RHYTHM_EVENT_REWARD_COUNTS.length;

// その部門で配るものの種類。報酬を持たないイベント(週間)では null を返す
const rhythmEventDivisionReward = (event, divisionId) => {
  if (!event) return null;
  const songId = rhythmEventDivisionSongId(divisionId);
  if (songId) {
    const lineageId = event.rewardLineageBySongId ? event.rewardLineageBySongId[songId] : null;
    return lineageId ? { kind: 'speciesFruit', lineageId } : null;
  }
  return event.totalReward === 'heroProof' ? { kind: 'heroProof' }
    : event.totalReward === 'rainbowFruit' ? { kind: 'rainbowFruit' }
    : null;
};
// 何位に何個か。順位が範囲外・壊れた値なら null(=報酬なし)
const rhythmEventRewardForRank = (event, divisionId, rank) => {
  const place = Number(rank);
  if (!Number.isInteger(place) || place < 1 || place > RHYTHM_EVENT_REWARD_RANKS) return null;
  const reward = rhythmEventDivisionReward(event, divisionId);
  if (!reward) return null;
  return {
    ...reward,
    count: RHYTHM_EVENT_REWARD_COUNTS[place - 1],
    psyche: RHYTHM_EVENT_REWARD_PSYCHE[place - 1],
  };
};
// そのイベントが報酬を持っているか(画面に報酬の表を出すかどうかの判定)
const rhythmEventHasRewards = (event) => {
  if (!event) return false;
  const divisions = [...(Array.isArray(event.songIds) ? event.songIds.map(rhythmEventSongDivisionId) : []),
    RHYTHM_EVENT_TOTAL_DIVISION];
  return divisions.some(divisionId => !!rhythmEventDivisionReward(event, divisionId));
};

// 公開曲の一覧(data/rhythm-mode.js)。読み込みの順番が前後しても落ちないよう、
// 見つからないときは絞り込みをせず、書いてある組をそのまま使う
const rhythmEventPublishedSongIds = () =>
  (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' && Array.isArray(RHYTHM_DEMO_SONG_IDS)) ? RHYTHM_DEMO_SONG_IDS : null;

// その週の週間イベント。対象曲のうち、いま公開されている曲だけを残す
// (曲を下げたときに「押せるのに無い曲」が部門として並ばないようにするため)
const rhythmWeeklyEvent = (nowMs) => {
  if (!Array.isArray(RHYTHM_WEEKLY_ROTATION) || RHYTHM_WEEKLY_ROTATION.length === 0) return null;
  const size = RHYTHM_WEEKLY_ROTATION.length;
  const index = ((rhythmWeekIndex(nowMs) % size) + size) % size;
  const entry = RHYTHM_WEEKLY_ROTATION[index];
  const published = rhythmEventPublishedSongIds();
  const songIds = (entry && Array.isArray(entry.songIds) ? entry.songIds : [])
    .filter(songId => typeof songId === 'string' && songId
      && (!published || published.includes(songId)));
  if (songIds.length === 0) return null;
  return Object.freeze({
    id: rhythmWeekId(nowMs),
    kind: 'weekly',
    name: '今週のモンヒロビート',
    songIds: Object.freeze(songIds),
  });
};

// 期間限定イベントの日時。書き間違いで画面が壊れないよう、読めない値は無いものとして扱う
const rhythmEventTimeMs = (value) => {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : null;
};
const rhythmLimitedEventAt = (nowMs) => {
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0;
  const list = Array.isArray(RHYTHM_EVENTS) ? RHYTHM_EVENTS : [];
  return list.find(event => {
    if (!event || event.kind !== 'limited' || !Array.isArray(event.songIds) || event.songIds.length === 0) return false;
    const startMs = rhythmEventTimeMs(event.startAt);
    const endMs = rhythmEventTimeMs(event.endAt);
    return startMs !== null && endMs !== null && now >= startMs && now < endMs;
  }) || null;
};

// いま成立しているイベント。期間限定があればそちらを優先し、その週の週間は休む(§7)。
// weekStartMs にはサーバーから受け取った週の始まりを渡す(渡さなければ端末の時計で見当をつける)
const rhythmActiveEvent = (nowMs, weekStartMs) => {
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0;
  const limited = rhythmLimitedEventAt(now);
  if (limited) return limited;
  return rhythmWeeklyEvent(Number.isFinite(Number(weekStartMs)) ? Number(weekStartMs) : now);
};

// そのイベントの期間。週間はサーバーの週の窓、期間限定は定義に書いた日時
const rhythmEventWindow = (event, weekWindow) => {
  if (event && event.kind === 'limited') {
    const startMs = rhythmEventTimeMs(event.startAt);
    const endMs = rhythmEventTimeMs(event.endAt);
    if (startMs !== null && endMs !== null) return { startMs, endMs };
    return null;
  }
  if (weekWindow && Number.isFinite(Number(weekWindow.startMs)) && Number.isFinite(Number(weekWindow.endMs))) {
    return { startMs: Number(weekWindow.startMs), endMs: Number(weekWindow.endMs) };
  }
  return null;
};

// 残り時間の文字列。1秒ごとの書き換えでも読みやすいよう、出す単位は2つまでにする
const rhythmEventRemainingText = (remainMs) => {
  const ms = Number(remainMs);
  if (!Number.isFinite(ms) || ms <= 0) return '終了しました';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  if (days > 0) return `残り ${days}日 ${hours}時間`;
  if (hours > 0) return `残り ${hours}時間 ${minutes}分`;
  if (minutes > 0) return `残り ${minutes}分`;
  return '残り 1分未満';
};

// ===== 部門(対象曲ごと＋総合) =====
//
// 部門の数は対象曲の数から作る(§7)。3曲でも5曲でも画面を書き換えずに済む。
const RHYTHM_EVENT_TOTAL_DIVISION = 'total';
const rhythmEventSongDivisionId = (songId) => `song:${songId}`;
const rhythmEventDivisionSongId = (divisionId) => {
  const id = String(divisionId || '');
  return id.startsWith('song:') ? id.slice('song:'.length) : null;
};
// 対象曲の曲データ。**名前の出し方はここで決めない**。
// 副題まで入れて1つの名前にする決まりは画面側の rhythmSongFullName が持っているので、
// そちらへ渡す(「綺季一閃」と「綺季一閃 ～花雪に舞う詠姫～ battle remix」は別の曲で、
// displayName だけだと見分けがつかない)。2か所に名前の作り方を書かない。
const rhythmEventSong = (songId, songs) =>
  (Array.isArray(songs) ? songs : []).find(entry => entry && entry.songId === songId) || null;
const rhythmEventDivisions = (event, songs) => {
  const songIds = event && Array.isArray(event.songIds) ? event.songIds : [];
  return [
    ...songIds.map(songId => ({
      id: rhythmEventSongDivisionId(songId),
      songId,
      song: rhythmEventSong(songId, songs),
    })),
    { id: RHYTHM_EVENT_TOTAL_DIVISION, songId: null, song: null },
  ];
};
// 対象曲すべてでMASTER満点を取ったときの合計。曲数は対象曲の配列から数える(§5.1)
const rhythmEventMaxScore = (event, difficulties) => {
  const songIds = event && Array.isArray(event.songIds) ? event.songIds : [];
  const best = (Array.isArray(difficulties) ? difficulties : [])
    .reduce((max, difficulty) => Math.max(max, Number(difficulty && difficulty.maxScore) || 0), 0);
  return songIds.length * best;
};
// 並べ替え・自分の行えらびで使う点数。曲の部門は score、総合の部門は totalScore を持つ
const rhythmEventEntryScore = (entry) => {
  if (!entry || typeof entry !== 'object') return 0;
  const value = entry.totalScore !== undefined && entry.totalScore !== null ? entry.totalScore : entry.score;
  return Number(value) || 0;
};

// 画面へ出す期間の文。週間は「毎週 月曜 5:00 に切り替わります」で足りるが、
// 期間限定は終わりの日時そのものを出さないと、いつまでか分からない。
// 端末の時間帯に左右されないよう、JST(+9時間)へ寄せてから組み立てる。
const RHYTHM_EVENT_WEEKDAY_LABELS = Object.freeze(['日', '月', '火', '水', '木', '金', '土']);
const rhythmEventJstText = (ms) => {
  const t = Number(ms);
  if (!Number.isFinite(t)) return '—';
  const d = new Date(t + RHYTHM_JST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${RHYTHM_EVENT_WEEKDAY_LABELS[d.getUTCDay()]}) ${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
};
const rhythmEventPeriodText = (event, range) => {
  if (event && event.kind === 'limited' && range) {
    return `${rhythmEventJstText(range.startMs)} 〜 ${rhythmEventJstText(range.endMs)}`;
  }
  return '毎週 月曜 5:00 に切り替わります';
};
// 対象曲の見出し。週間は「今週の対象曲」、期間限定はイベントの名前で呼ぶ
const rhythmEventSongsLabel = (event) => (event && event.kind === 'limited') ? '対象曲' : '今週の対象曲';
