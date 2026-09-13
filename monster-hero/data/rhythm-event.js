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
// 週のID。フェーズ4で報酬の受取フラグの一部になるので、**あとから形を変えない**(§7)。
// 月曜5:00 JSTの日付そのままで weekly_YYYY_MM_DD になる
const rhythmWeekId = (nowMs) => {
  const jst = new Date(rhythmWeekStartMs(nowMs) + RHYTHM_JST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `weekly_${jst.getUTCFullYear()}_${pad(jst.getUTCMonth() + 1)}_${pad(jst.getUTCDate())}`;
};

// ===== 週間ランキング =====
//
// ★2026-09-11・ユーザー指示「週間ランキングはそれのみにして、対応曲があるのは
//   イベントのほうにして」。**週間に対象曲は無い**。公開曲すべてが対象で、
//   部門も分けない1本のランキングにする。
//   (それまでは3曲の組を週ごとに回していたが、対象曲の仕組みはイベント専用にした)
//
// 中身は「総合」ランキングの今週ぶん。曲ごとのベストを全曲ぶん合計して競う。
// 「総合」と違うのは数える期間だけ。
//   総合   … ずっと(はじめてからの全期間)
//   週間   … 今週だけ(月曜5:00 JST 区切り)
//
// ★曲の一覧をここに書かない。公開曲が増えれば、そのまま週間の対象も増える(§5.1)。
//
// ★2026-09-13・ユーザーが決めた: **週間は「累計」方式**へ変えた。
//   「曲別合算方式じゃなくて、どの曲でもやった分のスコア加算」。
//   その週に出した記録を**全部そのまま足す**(同じ曲を何回遊んでも、そのつど積み上がる)。
//     総合(常設) … 曲ごとのベストを全曲ぶん合計 = **うまさ**
//     週間       … その週に出した記録をぜんぶ足す = **やりこみ量**
//   難易度ごとに満点が違う(EASY 60万〜MASTER 100万)ので、足すだけで難易度差は自然に付く。
//   重み付けはしない。上限も付けない。
//   ★**回数ボーナス(イベントの playBonus)は週間には付けない。**
//     累計そのものが回数を反映しているので、二重になる。
//   集計はサーバーの rhythm_week_score_totals(docs/sql/rankings/RHYTHM_WEEK_TOTAL_APPLY.sql)。

// 期間限定イベント(kind:'limited')。
// 週間とは別のタブで、同時に動く(§7・2026-09-11にユーザーが決めた)。
// **対象曲を持つのはこちらだけ**。id は受取フラグの一部になるので、**あとから変えない**。
//
// banner … 告知用の画像(images/events/…)。イベントタブの上と曲えらびの案内に出す。
//   書かなければ画像は出ない(仕組みだけあって画像が無い状態でも画面は壊れない)。
//   ★入れる前に軽くすること(CLAUDE.md ⑥-2)。横1080px・JPEG・quality 80・mozjpeg で
//     150KB以内が目安。起動時には読まない(開いたときに初めて読む)ので、
//     index.html の SIZES には入らない。
// rewardLineageBySongId … その曲の部門の1〜5位へ配る超越の実の種族(主血統id)。
//   書かなければ、その部門の報酬はプシュケーだけになる。
// totalReward … 総合部門の1〜5位へ配るもの。'heroProof'(勇者の証) か 'rainbowFruit'(虹の超越の実)。
//   書かなければ総合もプシュケーだけ。
// ★週間(kind:'weekly')には報酬を付けていない(フェーズ3は報酬なし)。
//   報酬が要るのは、いまのところ期間限定イベントだけ。
const RHYTHM_EVENTS = Object.freeze([
  // 2026-09-11・ユーザー指示「試験イベントとしてゲリラで週末イベントみたいな形でやる」。
  // 金曜15:00から月曜5:00まで。
  //
  // ★終わりを週の区切り(月曜5:00)に合わせてあるのは、**イベントが週をまたがないようにする**ため。
  //   またぐと、そのイベントの記録が2つの週間ランキングへ割れる。
  //   「イベントで出した記録なのに、今週の週間ランキングに半分しか入っていない」ことになり、
  //   どちらを見ればいいのか分からなくなる。
  //   区切りに合わせておけば、イベントの期間はまるごと1つの週の中に収まる。
  //   ★以前ここに「終わった瞬間に週間ランキングへ戻る」と書いていたのは、週間を
  //     お休みさせる設計だったころの名残。いまは週間とイベントは別のタブで同時に動くので、
  //     お休みも空白も無い(2026-09-11・ユーザー指示「別々に作ったほうがいい」)。
  Object.freeze({
    id: 'weekend_2026_09_11',
    kind: 'limited',
    name: 'モンヒロビート 週末ゲリラ杯',
    startAt: '2026-09-11T15:00:00+09:00',
    endAt: '2026-09-14T05:00:00+09:00',
    // 告知画像(横長)。イベントタブの上に出す。起動時の告知は正方形のほうを使う
    // (更新履歴の image。縦に余裕がある場所なので、大きい絵のほうが映える)
    banner: 'images/events/monbeat-event-2026-09-11-wide.jpg?v=628fda574507',
    songIds: Object.freeze(['monster_hero', 'kaze_ga_soyogu', 'close_to_your_heart']),
    rewardLineageBySongId: Object.freeze({
      monster_hero: 'suezo',
      kaze_ga_soyogu: 'mocchi',
      close_to_your_heart: 'tiger',
    }),
    totalReward: 'heroProof',
    // 回数ボーナス(2026-09-11・ユーザー指示)。遊んだ回数ぶん自分のベストへ加点する。
    // 割合は RHYTHM_EVENT_PLAY_BONUS_RATES(難易度ごと)。イベントごとに入り切りできるよう、
    // ここに書いたときだけ効く(週間ランキングには付かない)
    playBonus: true,
    // 参加報酬(2026-09-11・ユーザー指示「3曲すべて遊んだらもらえる」)。
    // 入賞しなくても、対象曲を**すべて**遊べばもらえる。個数は仕様書 §9.2 の候補のまま。
    // songs は「何曲遊べば成立か」。書かなければ参加報酬は無し
    participationReward: Object.freeze({ songs: 3, gold: 3000, psyche: 50 }),
  }),
]);

// ===== 回数ボーナス(2026-09-11・ユーザー指示) =====
//
// 「ただスコアを競うだけだと、うまい人が毎回上位に行く。それはそれでいいけど、
//   頑張った人が報われるシステムにもしたい」。
// 期間中にその曲を遊んだ回数ぶん、自分のベストスコアへ加点する。
//
//   加点 = ベストスコア × (期間中の1回ごとの割合の合計)
//
// ★1回あたりの割合は、**その回を遊んだ難易度**で決まる(下の表)。
//   EASYを何度も回すより、MASTERを1回のほうが大きい。
// ★上限は付けない(2026-09-11・ユーザー指示「回数で抜かれたら抜き返せばいいから、
//   上限とかはいらないと思う」)。
// ★数えるのは**その部門の曲**を遊んだ回数。総合部門は対象曲それぞれの
//   「加点込みのスコア」を足したものなので、結局その3曲ぶんの回数が効く。
// ★足し算は**サーバー(SQL)側**で行う。端末で足すと、上位50件を切り出したあとの加点になり、
//   「加点すれば50位以内に入るはずの人」が一覧から消える(並べ替えはサーバーがしている)。
//   実体は docs/sql/rankings/RHYTHM_EVENT_BONUS_APPLY.sql。
// ★ここの数字を変えても**SQLは流し直さない**。割合は問い合わせのたびに渡している。
const RHYTHM_EVENT_PLAY_BONUS_RATES = Object.freeze({
  EASY: 0.001, NORMAL: 0.002, HARD: 0.003, EXPERT: 0.005, MASTER: 0.007,
});
// そのイベントで回数ボーナスを使うか。使わないイベント(週間など)では null を返し、
// 呼ぶ側は加点なしの集計へ回る
const rhythmEventPlayBonusRates = (event) =>
  (event && event.playBonus === true) ? RHYTHM_EVENT_PLAY_BONUS_RATES : null;
// 画面・ヘルプへ出す割合の文字列。書かれていない難易度は「なし」
const rhythmEventPlayBonusPercentText = (difficultyId) => {
  const rate = Number(RHYTHM_EVENT_PLAY_BONUS_RATES[difficultyId]);
  if (!Number.isFinite(rate) || rate <= 0) return 'なし';
  return `1回ごとに +${(rate * 100).toFixed(1)}%`;
};
// 内訳の1行へ添える短いほう(「+0.7%」だけ)。幅の無い場所で使う
const rhythmEventPlayBonusRateText = (difficultyId) => {
  const rate = Number(RHYTHM_EVENT_PLAY_BONUS_RATES[difficultyId]);
  if (!Number.isFinite(rate) || rate <= 0) return '';
  return `+${(rate * 100).toFixed(1)}%`;
};
// 難易度ごとの回数を、画面へ出す並び(EASY→MASTER)へそろえる。
// 0回の難易度は出さない。知らない難易度が混ざっていたら最後にそのまま並べる
// (2026-09-12・ユーザー指示「難易度別回数の内訳もあったほうがいい」)
const rhythmEventPlayCountRows = (playCounts, difficultyIds) => {
  const counts = (playCounts && typeof playCounts === 'object') ? playCounts : {};
  const known = Array.isArray(difficultyIds) ? difficultyIds : [];
  const rest = Object.keys(counts).filter(id => !known.includes(id)).sort();
  return [...known, ...rest]
    .map(id => ({ id, count: Math.max(0, Math.floor(Number(counts[id]) || 0)), rateText: rhythmEventPlayBonusRateText(id) }))
    .filter(row => row.count > 0);
};

// ===== 報酬(docs/spec/RHYTHM_RANKING.md §9) =====
//
// 1位から5位まで。個数は 5 / 4 / 3 / 2 / 1、プシュケーは 1,000 / 800 / 600 / 400 / 200。
// 6位以下は無し。ここは「何位に何個」だけを持ち、**アイテムの実体(id)はゲーム本体側で解決する**
// (アイテムの定義は 11-masu-progression.jsx にあり、このファイルより後で読み込まれるため)。
const RHYTHM_EVENT_REWARD_COUNTS = Object.freeze([5, 4, 3, 2, 1]);
const RHYTHM_EVENT_REWARD_PSYCHE = Object.freeze([1000, 800, 600, 400, 200]);
const RHYTHM_EVENT_REWARD_RANKS = RHYTHM_EVENT_REWARD_COUNTS.length;

// ===== 週間ランキングの報酬(2026-09-13・ユーザーが決めた) =====
//
// 1位から10位まで。**勇者の証片**を主軸にして、プシュケーとダイヤを添える。
// 数字を10行書き写すのではなく、**式で出す**(幅を変えるのがここ1か所で済む)。
//
//   勇者の証片 = 11 − 順位   (1位=10片 … 10位=1片)
//   虹のプシュケー = 片 × 50
//   ダイヤ         = 片 × 3,000
//
// ★勇者の証片は20個で「勇者の証」1個とマーケットで交換できる(新アイテム)。
//   20個未満でも無駄にならず貯まる。証は魂格進化に合計200個要るので、週間ぶんは補助。
// ★イベント(1〜5位・超越の実/勇者の証)とは別の体系。混ぜない。
const RHYTHM_WEEKLY_REWARD_RANKS = 10;
const RHYTHM_WEEKLY_REWARD_PSYCHE_PER_SHARD = 50;
const RHYTHM_WEEKLY_REWARD_GOLD_PER_SHARD = 3000;
const rhythmWeeklyRewardForRank = (rank) => {
  const place = Number(rank);
  if (!Number.isInteger(place) || place < 1 || place > RHYTHM_WEEKLY_REWARD_RANKS) return null;
  const count = RHYTHM_WEEKLY_REWARD_RANKS + 1 - place;
  return Object.freeze({
    kind: 'heroProofShard',
    count,
    psyche: count * RHYTHM_WEEKLY_REWARD_PSYCHE_PER_SHARD,
    gold: count * RHYTHM_WEEKLY_REWARD_GOLD_PER_SHARD,
  });
};
// 参加報酬(2026-09-13・ユーザーが決めた「条件は3回遊ぶ」「10位より軽く」)。
// 週間に対象曲は無いので、イベントの「何曲遊んだか」ではなく**何回遊んだか**で見る。
const RHYTHM_WEEKLY_PARTICIPATION = Object.freeze({ plays: 3, count: 1, psyche: 30, gold: 2000 });

// 週間の報酬を配りはじめた時刻。**これより前に終わった週は対象にしない**。
// 入れておかないと、公開した瞬間に「先週・先々週ぶん」がまとめて配られる(CLAUDE.md ⑦)。
const RHYTHM_WEEKLY_REWARD_FROM_MS = Date.UTC(2026, 8, 13, 20, 0, 0); // 2026-09-14 05:00 JST

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
// 何位に何個か。順位が範囲外・壊れた値なら null(=報酬なし)。
// ★週間は別の体系(1〜10位・勇者の証片)なので、そちらへ回す
const rhythmEventRewardForRank = (event, divisionId, rank) => {
  if (event && event.kind === 'weekly') return rhythmWeeklyRewardForRank(rank);
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
// 何位まで報酬があるか。週間は1〜10位、イベントは1〜5位。
// 画面はこの数だけ順位の行を作るので、数字を書き写さずに済む
const rhythmEventRewardRankCount = (event) =>
  (event && event.kind === 'weekly') ? RHYTHM_WEEKLY_REWARD_RANKS : RHYTHM_EVENT_REWARD_RANKS;
// 参加報酬。入賞しなくても、対象曲を決まった数だけ遊べばもらえる(§9.2)。
// 書かれていないイベント(週間など)では null を返す
const rhythmEventParticipationReward = (event) => {
  // 週間は「何曲」ではなく「何回遊んだか」で成立する(対象曲が無いため)
  if (event && event.kind === 'weekly') return RHYTHM_WEEKLY_PARTICIPATION;
  const reward = event && event.participationReward;
  if (!reward || typeof reward !== 'object') return null;
  const songs = Math.max(1, Math.floor(Number(reward.songs) || 0));
  const gold = Math.max(0, Math.floor(Number(reward.gold) || 0));
  const psyche = Math.max(0, Math.floor(Number(reward.psyche) || 0));
  if (!(gold > 0 || psyche > 0)) return null;
  // 対象曲より多い数を書いてしまうと、誰も成立しない報酬になる。対象曲の数で頭打ちにする
  const songIds = (event && Array.isArray(event.songIds)) ? event.songIds : [];
  return { songs: Math.min(songs, songIds.length || songs), gold, psyche };
};
// 参加報酬が成立しているか。
// イベントは遊んだ曲数(総合部門の songCount)、週間は遊んだ回数(playCount)で見る
const rhythmEventParticipationCleared = (event, playedCount) => {
  const reward = rhythmEventParticipationReward(event);
  if (!reward) return false;
  const played = Math.max(0, Math.floor(Number(playedCount) || 0));
  const need = (event && event.kind === 'weekly') ? reward.plays : reward.songs;
  return played >= Math.max(1, Math.floor(Number(need) || 0));
};
// そのイベントが報酬を持っているか(画面に報酬の表を出すかどうかの判定)
const rhythmEventHasRewards = (event) => {
  if (!event) return false;
  if (event.kind === 'weekly') return true;   // 週間は1〜10位＋参加報酬をいつも持つ
  const divisions = [...(Array.isArray(event.songIds) ? event.songIds.map(rhythmEventSongDivisionId) : []),
    RHYTHM_EVENT_TOTAL_DIVISION];
  return divisions.some(divisionId => !!rhythmEventDivisionReward(event, divisionId));
};

// 公開曲の一覧(data/rhythm-mode.js)。読み込みの順番が前後しても落ちないよう、
// 見つからないときは絞り込みをせず、書いてある組をそのまま使う
const rhythmEventPublishedSongIds = () =>
  (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' && Array.isArray(RHYTHM_DEMO_SONG_IDS)) ? RHYTHM_DEMO_SONG_IDS : null;

// その週の週間ランキング。対象は**公開曲すべて**で、部門は分けない(§6.3)。
// 公開曲の一覧が読めないときだけ null を返す(データの読み込み順が前後したとき)
const rhythmWeeklyEvent = (nowMs) => {
  const published = rhythmEventPublishedSongIds();
  if (!published || published.length === 0) return null;
  return Object.freeze({
    id: rhythmWeekId(nowMs),
    kind: 'weekly',
    name: '今週のモンヒロビート',
    songIds: Object.freeze([...published]),
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

// ★rhythmActiveEvent は廃止した(2026-09-11)。週間と期間限定は別のタブで同時に動くので、
//   「いま成立しているのはどちらか」を1つに決める必要がなくなった。
//   曲えらびの案内は期間限定のときだけ出す(週間は対象曲を持たないので、知らせることが無い)。

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
// 部門の一覧。**対象曲を持つのはイベントだけ**なので、週間は総合1つだけになる
// (2026-09-11・ユーザー指示)。数は対象曲の数から作るので、3曲でも5曲でも画面は変えない
const rhythmEventDivisions = (event, songs) => {
  const songIds = (event && event.kind === 'limited' && Array.isArray(event.songIds)) ? event.songIds : [];
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
// 対象曲の見出し。対象曲を持つのは期間限定だけなので、いつも「対象曲」でよい
const rhythmEventSongsLabel = (event) => '対象曲';

// 告知用の画像。書かれていない・形がおかしいときは null(画像を出さない)
const rhythmEventBanner = (event) => {
  const banner = event && event.banner;
  return (typeof banner === 'string' && /^images\/[^\s]+\.(png|jpe?g|webp)(\?v=[0-9a-f]+)?$/i.test(banner))
    ? banner : null;
};

// ===== 報酬の受け取り(docs/spec/RHYTHM_RANKING.md §9.1) =====
//
// このゲームはサーバー処理を持たない(Supabaseは記録の保存と閲覧だけ)ので、
// イベントが終わったあとに端末が順位を問い合わせ、その場で受け取る形にする。
// 受け取ったイベントのIDは mh_rhythm_event_reward_v1 へ残して二重受取を防ぐ(CLAUDE.md ⑦)。
//
// ★受け取れるのは終了から2週間まで(2026-09-11・ユーザーが決めた)。
//   順位は終了した時点で固まっているので、遅れても内容は変わらない。
//   期限を切ってあるのは、古いイベントの問い合わせが溜まり続けないようにするため。
const RHYTHM_EVENT_REWARD_CLAIM_MS = 14 * 24 * 60 * 60 * 1000;
// 終わっていて、まだ受け取っておらず、受取期限の中にあるイベント(先に終わったものから順)
const rhythmEventsAwaitingReward = (nowMs, claimedIds) => {
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0;
  // 保存値が壊れている(配列でない)ときは「1つも受け取っていない」ではなく
  // 「分からないので何もしない」に倒す。受け取り済みを取りこぼして二重に配らないため
  if (!Array.isArray(claimedIds)) return [];
  const list = Array.isArray(RHYTHM_EVENTS) ? RHYTHM_EVENTS : [];
  return list
    .filter(event => event && event.kind === 'limited' && rhythmEventHasRewards(event))
    .filter(event => !claimedIds.includes(event.id))
    .filter(event => {
      const endMs = rhythmEventTimeMs(event.endAt);
      return endMs !== null && now >= endMs && now < endMs + RHYTHM_EVENT_REWARD_CLAIM_MS;
    })
    .sort((a, b) => rhythmEventTimeMs(a.endAt) - rhythmEventTimeMs(b.endAt));
};
// 終わっていて、まだ受け取っておらず、受取期限の中にある**週**(先に終わった週から順)。
// ★受取フラグはイベントと同じ配列(mh_rhythm_event_reward_v1)へ入れる。
//   週のidは weekly_YYYY_MM_DD、イベントのidは weekend_… なので取り違えない。
//   新しい保存キーを作らない(CLAUDE.md ⑦)。
// ★RHYTHM_WEEKLY_REWARD_FROM_MS より前に終わった週は対象にしない。
//   入れておかないと、公開した瞬間に過去の週ぶんがまとめて配られる。
const rhythmWeeksAwaitingReward = (nowMs, claimedIds) => {
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0;
  // 保存値が壊れている(配列でない)ときは「分からないので何もしない」に倒す(二重に配らないため)
  if (!Array.isArray(claimedIds)) return [];
  const thisWeekStart = rhythmWeekStartMs(now);
  const weeks = [];
  // 受取期限は2週間なので、遡るのは直前の2週で足りる
  for (let back = 1; back <= 2; back++) {
    const startMs = thisWeekStart - back * RHYTHM_WEEK_MS;
    const endMs = startMs + RHYTHM_WEEK_MS;
    if (startMs < RHYTHM_WEEKLY_REWARD_FROM_MS) continue;      // 始める前の週
    if (now < endMs) continue;                                  // まだ終わっていない
    if (now >= endMs + RHYTHM_EVENT_REWARD_CLAIM_MS) continue;  // 期限切れ
    const id = rhythmWeekId(startMs);
    if (claimedIds.includes(id)) continue;
    weeks.push(Object.freeze({ id, kind: 'weekly', name: '週間ランキング', startMs, endMs }));
  }
  return weeks.sort((a, b) => a.startMs - b.startMs);           // 先に終わった週から
};
// 受け取り済みの一覧。保存値が壊れていても落ちないように通す
const normalizeRhythmEventRewardClaims = (value) =>
  Array.isArray(value) ? value.filter(id => typeof id === 'string' && id) : [];
// そのイベントの部門の並び(対象曲ごと→総合)。受け取りの問い合わせにも画面にも同じ順で使う
const rhythmEventDivisionIds = (event) => [
  ...((event && Array.isArray(event.songIds)) ? event.songIds.map(rhythmEventSongDivisionId) : []),
  RHYTHM_EVENT_TOTAL_DIVISION,
];
