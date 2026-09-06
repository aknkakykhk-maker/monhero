// 公開前の機能は、ヘルプの項目も更新履歴のお知らせも書き上げたうえで隠しておく。
// data/*.js は game-system.jsx より先に読み込まれるので公開フラグを見られない。
// そこで data 側には releaseFlag という名札だけを書き、出す・出さないの判断はここでまとめて行う。
// 公開するときは SPECIES_CHALLENGE_PUBLIC_RELEASE を true にするだけで、
// ヘルプ・更新履歴・助手の告知が同時に出る(片方だけ先に出てしまうことがない)
// モンヒロビートは2026-09-05のプレオープンで公開した(ユーザー指示)。
// これを true にしたことで、HOMEの「準備中」がプレオープンの導線に変わり、
// ヘルプの項目・更新履歴・助手の告知も同時に出るようになっている
const RHYTHM_MODE_PUBLIC_RELEASE = true;
const RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE, rhythmMode:RHYTHM_MODE_PUBLIC_RELEASE };
// releaseFlag = そのフラグが立つまで出さない。unreleasedFlag = そのフラグが立ったら出さない。
// 逆向きの名札が要るのは「準備中です」の案内で、公開したあとも残っていると
// 遊べているのに準備中の項目が並ぶ(ヘルプのモンヒロビートで実際にそうなっていた・2026-09-06)。
const releasedForPlayers = (item) => !item
  || ((!item.releaseFlag || RELEASE_FLAGS[item.releaseFlag] === true)
    && (!item.unreleasedFlag || RELEASE_FLAGS[item.unreleasedFlag] !== true));
const CHANGELOG_TYPES = ['update', 'issue'];
// 日付やBUILD_DATEではなく、内容から作った安定IDでお知らせを識別する。同じID・同じ本文は
// ビルドし直しても未読へ戻らず、本文を変更した場合だけ新しい項目として扱う。
const changelogEntryId = entry => {
  const source = entry.id || [entry.type, entry.title, ...(entry.items || [])].join('\u001f');
  let hash = 2166136261;
  for (let i=0;i<source.length;i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${entry.type || 'notice'}-${(hash >>> 0).toString(36)}`;
};
// 開発中の作業メモ(dev:true)は、どちらのタブにも出さない。
// releaseFlag だけで隠していたころは、公開フラグを true にした瞬間に公開前の作業メモが
// まとめて更新情報へ並んでしまい、プレイヤーには「見たこともない画面の不具合が直った話」が
// 延々と続いて見えていた(2026-09-05・ユーザー指摘でモンヒロビートの80件を dev:true にした)。
// 記録自体は data/changelog.js に残し、出す・出さないだけをここで決める。
const changelogForPlayers = (entry) => !!entry && entry.dev !== true && releasedForPlayers(entry);
const CHANGELOG_ENTRIES = (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).filter(changelogForPlayers).map(entry => Object.freeze({...entry,id:changelogEntryId(entry)}));
// 更新履歴から作る助手の告知も、隠している項目のぶんは出さない
// (data/assistants.js は公開フラグも dev も見られないため、ここで落とす)
const HIDDEN_UPDATE_NOTICE_IDS = new Set((typeof CHANGELOG !== 'undefined' ? CHANGELOG : [])
  .filter(entry => !changelogForPlayers(entry) && typeof entry?.assistantNotice?.id === 'string')
  .map(entry => entry.assistantNotice.id.trim()));
// どのタブへ出すかを決める。
// 「不具合情報」は不具合の話をまとめる場所なので、調査中(issue)だけでなく
// 直したもの(fix)もここへ出す。「更新情報」は新機能・改善・マーケットだけになる
// (2026-09-05・ユーザー指摘「上にタブがあるから不具合修正とかは右にして」)。
// 以前は type がタブ名と完全一致するものだけを出していたため、fix / feature / market と
// 書いた項目がどちらのタブにも出ず、更新履歴に載せたつもりで載っていなかった。
// 種別を新しく足しても消えないよう、下の CHANGELOG_ISSUE_TAB_TYPES 以外は必ず更新情報へ拾う
const CHANGELOG_ISSUE_TAB_TYPES = Object.freeze(['issue', 'fix']);
const changelogEntriesOfTab = (tab) => CHANGELOG_ENTRIES.filter(entry => CHANGELOG_ISSUE_TAB_TYPES.includes(entry.type) === (tab === 'issue'));
// 既読の判定に使う「いま存在するすべてのID」。
// タブの振り分けを変えると、既読にしたIDが別のタブへ移る。タブごとのID一覧で
// ふるいにかけると移った先で未読へ戻ってしまうため、こちらで残す・捨てるを決める
const CHANGELOG_ALL_IDS = new Set(CHANGELOG_ENTRIES.map(entry => entry.id));
// 更新情報の「種類」の見せ方。データには前から type があったのに画面へ出しておらず、
// 不具合を直したのか新しく何かが増えたのかが読んでも分からなかった
// (2026-09-05・ユーザー指摘「直近の更新情報が不具合修正との区別がついてない」)。
// 文字とセットの色で、一覧を流し読みしても種類が分かるようにする。
const CHANGELOG_TYPE_LABELS = Object.freeze({
  fix:     { label:'不具合修正', tone:'fix' },
  feature: { label:'新機能',     tone:'feature' },
  update:  { label:'改善',       tone:'update' },
  market:  { label:'マーケット', tone:'market' },
  issue:   { label:'調査中',     tone:'issue' },
});
const changelogTypeOf = (entry) => CHANGELOG_TYPE_LABELS[entry?.type] || CHANGELOG_TYPE_LABELS.update;
const CHANGELOG_IDS_BY_TYPE = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, changelogEntriesOfTab(type).map(entry => entry.id)]));
// 一覧の並べかえに使えるキー。画面の選択肢(MONSTER_SORT_OPTIONS)と必ず同じ顔ぶれにする。
// 片方にだけ足すと、画面では選べるのに保存だけ弾かれて、開き直すと元に戻る
// (実際に「総合力」がここへ足されておらず、選んでも次に開くと血統順へ戻っていた)。
// tools/monster/monster-list-filter-check.js が両者の一致を見張る。
const MONSTER_LIST_SORT_KEYS = ['base', 'masu', 'lineage', 'bond', 'power', 'name', 'active', 'fused', 'reborn'];
const DEFAULT_MONSTER_LIST_SETTINGS = { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', lineage: 'all', display: { base: true, masu: true, fused: true, active: true, reborn: true } };
const DEFAULT_FUSION_SORT_SETTINGS = { version: 1, sortKey: 'bond', sortDir: 'desc' };
const DEFAULT_DONATION_SORT_SETTINGS = { version: 1, sortKey: 'bondXp', sortDir: 'desc' };
const normalizeMonsterListSettings = (value) => {
  const displayKeys = ['base', 'masu', 'fused', 'active', 'reborn'];
  if (!value || value.version !== 1 || !MONSTER_LIST_SORT_KEYS.includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir) || !['sort', 'lineage', 'display'].includes(value.modalTab) || !value.display) return DEFAULT_MONSTER_LIST_SETTINGS;
  // 種族(主血統)のしぼりこみは後から足した項目。持っていない既存の保存値は「すべて」で補う。
  // 版を上げると保存ごと既定へ戻って並べかえ・表示設定まで失われるので、版は1のままにする
  const lineage = typeof value.lineage === 'string' && (value.lineage === 'all' || (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[value.lineage]))
    ? value.lineage : 'all';
  return { version: 1, modalTab: value.modalTab, sortKey: value.sortKey, sortDir: value.sortDir, lineage, display: Object.fromEntries(displayKeys.map(key => [key, typeof value.display[key] === 'boolean' ? value.display[key] : DEFAULT_MONSTER_LIST_SETTINGS.display[key]])) };
};
const normalizeFusionSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bond', 'lineage', 'name', 'fused'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_FUSION_SORT_SETTINGS;
  return { version: 1, sortKey: value.sortKey, sortDir: value.sortDir };
};
const normalizeDonationSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bondXp', 'bond', 'power', 'name', 'lineage', 'newest', 'active'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_DONATION_SORT_SETTINGS;
  return value;
};
// 不具合情報タブに出す状態バッジの見た目
const CHANGELOG_STATUS = {
  fixed:         { label: '修正済み', cls: 'bg-emerald-900/70 text-emerald-300 border-emerald-500/50' },
  investigating: { label: '調査中',   cls: 'bg-amber-900/70 text-amber-300 border-amber-500/50' },
  known:         { label: '判明済み', cls: 'bg-slate-800 text-slate-300 border-slate-500/50' },
};
// 音量の既定値。初期状態は「音がオン」で、いきなり大きな音が鳴らないよう最小の1から始める
// (ミュートを解除したときの音量もこの値に合わせている)
const DEFAULT_VOLUME = 1;
// ログインボーナスは毎日、既存の報酬に加えてスキップチケット・序を1枚配る。
// 4日目の「100」はもともとブリーダー経験値のつもりだったが、
// 報酬の種類をブリーダーポイント(pt)にしていたため、使い道のないptが大量に配られていた。
// ptはマーケットのアイコン(1個1pt・全部で20種ほど)にしか使わないので、まとめて配らない
const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 },             { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },               { type:'skipTicketJo', amount:1 }],
  [{ type:'trainingTicket', amount:5 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'breederXp', amount:200 },           { type:'skipTicketJo', amount:1 }],
  [{ type:'uniqueSkillResetTicket', amount:1 },{ type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:2000 }, { type:'rainbowPsyche', amount:10 }, { type:'skipTicketJo', amount:1 }],
  [{ type:'bondPointReset', amount:1 }, { type:'trainingTicketLarge', amount:1 }, { type:'skipTicketJo', amount:1 }],
];
const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーポイント', breederXp:'ブリーダー経験値', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットの書', uniqueSkillResetTicket:'スキルポイントリセット券', rainbowPsyche:'虹のプシュケー', rainbowTranscendFruit:'虹の超越の実', trainingTicket:'トレーニングチケット', trainingTicketLarge:'重トレーニングチケット', skipTicketJo:'スキップチケット・序', skipTicketHa:'スキップチケット・破', skipTicketKyu:'スキップチケット・急' };
const LOGIN_BONUS_DEFAULT = { currentDay:1, lastGrantedPeriod:null, totalLoginDays:0 };
// 日本時間へ直した後に4時間戻した暦日を期間キーにする。03:59と04:00は別の日、
// 04:00から翌03:59までは同じ日として扱える、比較・保存しやすい YYYY-MM-DD 形式。
const loginBonusPeriodKey = (now=Date.now()) => new Date(Number(now) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
// ---------- どの助手と一緒に遊ぶか ----------
// 助手は「みゅあ」「きき」から選ぶ。どちらも最初から解放されていて、解放条件は無い。
//
// 【既存プレイヤーの互換】★重要
// この保存キーが無い人は、これまでどおり「みゅあ」を選んでいる扱いにする。
// 助手選択の画面も出さない(いままで遊んできた人に選び直しを迫らない)。
const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';
// ききが増える前から遊んでいた人へ、1回だけ見せる加入の会話。
// 「フラグが無い人＝既存プレイヤー」ではない(新しく始めた人も持っていない)ので、
// 既にオンボーディングを終えている(mh_onboarded)ことと合わせて判定する。
// 新しく始めた人は助手選択を通った時点で見たことにして、あとから誤って流れないようにする。
const KIKI_INTRO_SEEN_KEY = 'mh_kiki_intro_seen_v1';
// ももすけ登場の会話。ききのときと同じ考え方で、
//   ・すでに遊んでいた人 … アップデート後の初回HOMEで1回だけ流す。見終わるとももすけを選べるようになる
//   ・新しく始めた人     … 最初の助手選択でももすけを選べるので、この会話は流さない(その場で見たことにする)
// 本編を待たずにプロフィールの回想から見た場合も、最後まで見たらこのキーを立てる
// (＝解放され、あとから本編で重ねて流れない)。
const MOMOSUKE_INTRO_SEEN_KEY = 'mh_momosuke_intro_seen_v1';
const normalizeAssistantId = (value) => (typeof assistantIdOrDefault === 'function')
  ? assistantIdOrDefault(typeof value === 'string' ? value : null)
  : ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua');

// ---------- 助手との仲良し度(親密度) ----------
// 遊ぶほど助手と打ち解けていく。段階と呼び方・セリフは data/assistants.js が持ち、
// ここは「どれだけ貯まったか」を数えて端末に残すだけ。
//
// 既存の保存キーには一切触れず、新しいキーへ分けて持つ。読み込みは必ず normalize を
// 通すので、値が無い・壊れている場合もLv1から始まるだけで、ほかのデータには影響しない。
// 放置しても減らない(久しぶりに開いた人が冷たくされないようにするため)。
//
// 【助手ごとに完全に分ける】★重要
// みゅあとききの仲良し度は別のキーへ保存し、片方を進めてももう片方は変わらない。
// みゅあのぶんは今までのキーをそのまま使い続ける(既存プレイヤーの進捗を守るため)。
// 助手を増やしたときは mh_assistant_bond_<id>_v1 が自動で割り当たる。
const ASSISTANT_BOND_KEY = 'mh_assistant_bond_v1';
const assistantBondKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_BOND_KEY : `mh_assistant_bond_${id}_v1`;
};
// そのアシストカードが助手本人のカードなら、その助手のIDを返す(違えばnull)。★重要
// アシストカードのIDと助手のIDは同じ綴り('mua'/'kiki')なので、そのまま本人へ結び付く。
// カード名の文字列で見ると、進化で名前が変わったとき(みゅあの愛→深愛→慈愛)に外れるため、
// 必ずIDで判定する。助手を増やしてもカードIDを合わせておけば、ここは書き換え不要
const assistantIdOfAssistCard = (cardId) => {
  const id = String(cardId == null ? '' : cardId);
  const list = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
  return list.some(a => a && a.id === id) ? id : null;
};
// 呼び方の上書きも助手ごとに分ける。みゅあのぶんは今までのキーのまま
const ASSISTANT_CALL_STYLE_KEY = 'mh_assistant_call_style';
const assistantCallStyleKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_CALL_STYLE_KEY : `mh_assistant_call_style_${id}`;
};
const ASSISTANT_BOND_EMPTY = { points: 0, day: null, daily: {}, dailyTotal: 0 };
const normalizeAssistantBond = (value) => {
  const raw = (value && typeof value === 'object') ? value : {};
  const daily = {};
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [k, v] of Object.entries(raw.daily)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n > 0) daily[k] = n;
    }
  }
  return {
    points: Math.max(0, Math.floor(Number(raw.points) || 0)),
    day: typeof raw.day === 'string' ? raw.day : null,
    daily,
    dailyTotal: Math.max(0, Math.floor(Number(raw.dailyTotal) || 0)),
  };
};
// 行動に応じて仲良し度を増やした結果を返す(渡された値は変えない)。
// 日付が変わっていれば、その日の集計だけをリセットする(貯まった量はそのまま)
const gainAssistantBond = (state, actionKey, now = Date.now()) => {
  const cur = normalizeAssistantBond(state);
  const actions = (typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS) || {};
  const action = actions[actionKey];
  const day = loginBonusPeriodKey(now);
  const sameDay = cur.day === day;
  const daily = sameDay ? { ...cur.daily } : {};
  const dailyTotal = sameDay ? cur.dailyTotal : 0;
  if (!action) return { changed: false, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  const used = Math.max(0, Math.floor(Number(daily[actionKey]) || 0));
  const totalMax = (typeof ASSISTANT_BOND_DAILY_MAX !== 'undefined' && ASSISTANT_BOND_DAILY_MAX) || 30;
  // 「1回ぶん」「その行動の1日ぶん」「1日の合計」の3つのうち、いちばん小さいところで止める
  const gain = Math.min(
    Math.max(0, Math.floor(Number(action.amount) || 0)),
    Math.max(0, Math.floor(Number(action.dailyMax) || 0) - used),
    Math.max(0, totalMax - dailyTotal),
  );
  if (gain <= 0) return { changed: !sameDay, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  daily[actionKey] = used + gain;
  return { changed: true, state: { points: cur.points + gain, day, daily, dailyTotal: dailyTotal + gain }, gained: gain };
};
const assistantBondLevelOf = (points) => (typeof assistantBondLevel === 'function') ? assistantBondLevel(points) : 1;

const normalizeLoginBonus = (value) => ({
  currentDay: Number.isInteger(value?.currentDay) && value.currentDay >= 1 && value.currentDay <= 7 ? value.currentDay : 1,
  lastGrantedPeriod: typeof value?.lastGrantedPeriod === 'string' ? value.lastGrantedPeriod : null,
  totalLoginDays: Math.max(0, Math.floor(Number(value?.totalLoginDays) || 0)),
});
const grantLoginBonus = (loginBonus, gifts, now=Date.now()) => {
  const state = normalizeLoginBonus(loginBonus);
  const period = loginBonusPeriodKey(now);
  // 同一期間に加え、端末時計が前回より過去へ戻った場合も配布しない。
  if (state.lastGrantedPeriod && period <= state.lastGrantedPeriod) return { granted:false, loginBonus:state, gifts:Array.isArray(gifts)?gifts:[] };
  const day = state.currentDay;
  const createdAt = new Date(now).toISOString();
  const gift = { id:`gift_login_${period}`, source:'loginBonus', title:`ログインボーナス ${day}日目`, description:'ログインボーナスです。', rewards:LOGIN_BONUS_REWARDS[day-1].map(r=>({...r})), createdAt, expiresAt:new Date(Number(now)+30*24*60*60*1000).toISOString(), claimedAt:null };
  const list = Array.isArray(gifts) ? gifts : [];
  // 期間由来の固定IDでも重複を防ぐ。既に存在する場合は進捗だけを勝手に進めない。
  if (list.some(item=>item?.id===gift.id)) return { granted:false, loginBonus:{...state,lastGrantedPeriod:period}, gifts:list };
  return { granted:true, day, gift, gifts:[gift,...list], loginBonus:{ currentDay:day===7?1:day+1, lastGrantedPeriod:period, totalLoginDays:state.totalLoginDays+1 } };
};
// 不具合のお詫びとして、起動時に1度だけギフトボックスへ送る配布物。
// 受け取り方は通常のギフトと同じ(期限内に「受け取る」を押す)。
// idが既にギフト一覧にあれば配らないので、受取済み・未受取のどちらでも二重には届かない。
// 追加するときは新しいidで足す。過去の項目は消さない(消すと再配布されてしまうため)。
const COMPENSATION_GIFTS = [
  {
    id: 'gift_compensation_20260731_battle',
    title: 'お詫びのしるし',
    description: 'バトルが進行できなくなる不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'diamond', amount:1000 },
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260801_points',
    title: 'お詫びのしるし',
    description: 'ログインボーナスの報酬が、ブリーダー経験値ではなくブリーダーポイントになっていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260823_skip',
    title: 'お詫びのしるし',
    description: 'クイックモードの報酬方針を「プシュケー優先」「ダイヤ優先」にしたままスキップすると、経験値も絆経験値も入らないままチケットだけ減っていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketKyu', amount:5 },
    ],
  },
  {
    id: 'gift_compensation_20260807_dye',
    title: 'お詫びのしるし',
    description: 'アークの染色で、色が入らなかったり濃く出すぎたりしていた不具合のお詫びです。染めなおしにお使いください。ご迷惑をおかけしました。',
    rewards: [
      { type:'dyeMock', amount:5 },
    ],
  },
];
// 【一度きりの付け替え】ログインボーナス4日目の「100」は、もともとブリーダー経験値の
// つもりだったのに、報酬の種類をブリーダーポイント(pt)にしていたため使い道のないptが
// 大量に配られていた。すでに受け取ってしまったぶんを「経験値が入っていた」形へ寄せる。
//
//   ・受け取り済みのログインボーナスのギフトから、ptで配ってしまった量を数える
//   ・その量だけptを減らし(持っている以上には減らさない)、同じ量の経験値を足す
//   ・専用のフラグ(mh_login_pt_to_xp_v1)を持たせ、二度は行わない
const LOGIN_PT_TO_XP_KEY = 'mh_login_pt_to_xp_v1';
const MISTAKEN_LOGIN_PT = 100;   // ログインボーナス4日目で配ってしまっていた量
const mistakenLoginPoints = (gifts) => (Array.isArray(gifts) ? gifts : [])
  .filter(g => g?.source === 'loginBonus' && g.claimedAt && Array.isArray(g.rewards))
  .reduce((sum, g) => sum + g.rewards
    .filter(r => r?.type === 'breederPoint' && Math.floor(Number(r.amount)) === MISTAKEN_LOGIN_PT)
    .reduce((a, r) => a + Math.floor(Number(r.amount)), 0), 0);
// 付け替えた結果を返す(渡された値は変えない)。
// ptは持っている以上には減らさず、経験値は配られるはずだった量をそのまま足す
const applyLoginPointFix = (points, xp, gifts) => {
  const wrong = mistakenLoginPoints(gifts);
  const nowPoints = Math.max(0, Math.floor(Number(points) || 0));
  const nowXp = Math.max(0, Math.floor(Number(xp) || 0));
  if (wrong <= 0) return { changed:false, points:nowPoints, xp:nowXp, moved:0 };
  const moved = Math.min(wrong, nowPoints);
  return { changed:true, points:nowPoints - moved, xp:nowXp + wrong, moved, granted:wrong };
};

const grantCompensationGifts = (gifts, now=Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const missing = COMPENSATION_GIFTS.filter(def => !list.some(item => item?.id === def.id));
  if (missing.length === 0) return { granted:false, gifts:list };
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(Number(now) + 30*24*60*60*1000).toISOString();
  const added = missing.map(def => ({ ...def, source:'compensation', rewards:def.rewards.map(r=>({...r})), createdAt, expiresAt, claimedAt:null }));
  return { granted:true, gifts:[...added, ...list] };
};
// ---------- モンヒロビート プレオープン記念 新規プレイヤーキャンペーン ----------
// 今回のアップデート以降にはじめてMonster Heroを始めた人へ、1回だけ配る。
// すでに遊んでいた人には配らない(これが最重要。ここを間違えると全員へ配ってしまう)。
//
// 【新規かどうかの見分け方】
// 「キャンペーンの保存キーを持っていない」だけで決めてはいけない。新しく始めた人も
// 既存の人も、アップデート直後はどちらも持っていないため。既存の判定(mh_onboarded)で
// 「はじめての設定をこれから通る人」だけを対象にする。実際の発行は、その設定を
// 終えた瞬間(finishOnboarding)にだけ行う。
//
// 【二重に配らないための決まり】
// 配布済みフラグ(CAMPAIGN_KEY)だけに頼らず、ギフト側に同じidが無いかも必ず見る。
// ギフトを足したあとフラグを保存する前に閉じられても、次に開いたときidで気づける。
// idは固定。ランダムに作らないこと(作ると毎回「まだ無い」と判断してしまう)。
//
// 【受取期限】
// ユーザーからの指定が無いので付けない(expiresAtを書かない＝期限なし)。
const NEW_PLAYER_CAMPAIGN_ENABLED = true;   // 後からOFFにできるようにしておく
const NEW_PLAYER_CAMPAIGN_KEY = 'mh_monhiro_beat_preopen_new_player_campaign_v1';
const NEW_PLAYER_CAMPAIGN_GIFT = Object.freeze({
  id: 'monhiro_beat_preopen_new_player_v1',
  title: 'モンヒロビート プレオープン記念',
  description: '新規プレイヤーキャンペーンのプレゼントです。モンヒロビートのプレオープンを記念して、はじめた方へお贈りします。',
  rewards: [
    { type:'diamond', amount:100000 },
    { type:'rainbowPsyche', amount:100 },
  ],
});
// ギフト一覧へ1件足す。すでに同じidがあれば何もしない(何度呼んでも増えない)
const grantNewPlayerCampaignGift = (gifts, now=Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  if (!NEW_PLAYER_CAMPAIGN_ENABLED) return { granted:false, gifts:list };
  if (list.some(item => item?.id === NEW_PLAYER_CAMPAIGN_GIFT.id)) return { granted:false, gifts:list };
  const gift = {
    ...NEW_PLAYER_CAMPAIGN_GIFT,
    source: 'campaign',
    rewards: NEW_PLAYER_CAMPAIGN_GIFT.rewards.map(r=>({...r})),
    createdAt: new Date(now).toISOString(),
    claimedAt: null,
  };
  return { granted:true, gifts:[gift, ...list] };
};

const normalizeGiftRewards = (gift) => {
  if (!gift || !Array.isArray(gift.rewards) || gift.rewards.length === 0) return null;
  const supported = Object.keys(GIFT_REWARD_LABELS);
  const rewards = gift.rewards.map(r=>({ type:r?.type, amount:Math.floor(Number(r?.amount)) }));
  return rewards.every(r=>supported.includes(r.type) && Number.isFinite(r.amount) && r.amount > 0) ? rewards : null;
};
// 受取期限。expiresAt を書いていないギフトは「期限なし(ずっと受け取れる)」として扱う。
// ログインボーナス・お詫び・ミッションの3つは必ず30日の期限を入れているので、
// ここを通る既存のギフトの扱いは何も変わらない。
// 値が入っていて読めない(壊れている)ときは、これまでどおり期限切れのままにする
const giftIsExpired = (gift, now=Date.now()) => {
  if (!gift) return true;
  if (gift.expiresAt == null) return false;
  const at = Date.parse(gift.expiresAt);
  return !Number.isFinite(at) || at <= Number(now);
};
// 「今すぐ受け取れるギフト」。未受取・期限内・報酬が有効、の3つを満たすもの。
// HOMEの通知バッジ・ギフト画面のバッジ・「すべて受け取る」が同じ判定を使う
const giftIsClaimable = (gift, now=Date.now()) => !!gift && !gift.claimedAt && !giftIsExpired(gift, now) && !!normalizeGiftRewards(gift);
const giftClaimableCount = (gifts, now=Date.now()) => (Array.isArray(gifts) ? gifts : []).filter(g => giftIsClaimable(g, now)).length;
const buildGiftClaim = (gift, balances, now=Date.now()) => {
  if (!gift || gift.claimedAt || giftIsExpired(gift, now)) return { ok:false, reason:gift?.claimedAt?'claimed':'expired' };
  const rewards = normalizeGiftRewards(gift);
  if (!rewards) return { ok:false, reason:'invalidReward' };
  const next = { gold:Math.max(0,Number(balances?.gold)||0), breederPoints:Math.max(0,Number(balances?.breederPoints)||0), breederXp:Math.max(0,Number(balances?.breederXp)||0), ownedItems:{...(balances?.ownedItems||{})} };
  // 虹の超越の実は既存の RAINBOW_TRANSCEND_FRUIT_ITEM_ID と同じ保存ID。
  const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', uniqueSkillResetTicket:'unique_skill_reset_ticket', rainbowPsyche:'rainbow_psyche', rainbowTranscendFruit:'transcend_fruit_rainbow', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l', skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu' };
  rewards.forEach(({type,amount})=>{ if(type==='diamond') next.gold+=amount; else if(type==='breederPoint') next.breederPoints+=amount; else if(type==='breederXp') next.breederXp+=amount; else { const id=itemIds[type]; next.ownedItems[id]=(next.ownedItems[id]||0)+amount; } });
  return { ok:true, balances:next, gift:{...gift,claimedAt:new Date(now).toISOString()} };
};
const giftRewardText = (reward) => `${GIFT_REWARD_LABELS[reward.type] || reward.type} ×${Number(reward.amount).toLocaleString()}`;
const giftTitleDisplay = (gift) => {
  const fallback = '名称なしギフト';
  const title = typeof gift?.title === 'string' && gift.title.trim() ? gift.title.trim() : fallback;
  if (gift?.source === 'compensation') return { label:'お詫び', title };
  if (gift?.source === 'campaign') return { label:'キャンペーン', title };
  if (gift?.source !== 'mission') return { label:null, title };
  const missionTitle = title.replace(/^ミッション報酬[「『]?/, '').replace(/[」』]$/, '').trim();
  return { label:'ミッション', title:missionTitle || title };
};
const missionDailyPeriod = loginBonusPeriodKey;
// --- 遊んだ時間 ---
// 新しい保存キーへ足すだけで、既存の保存(mh_*)には一切触らない。
// 画面が見えているあいだだけ数える(裏に回している時間・端末を置いている時間は遊んでいないため)。
// 数え始めた日(since)も一緒に持つ。既存プレイヤーは0から始まるので、
// 「いつからの記録か」が分からないと短すぎると誤解されてしまう。
const PLAYTIME_KEY = 'mh_playtime_v1';
const PLAYTIME_TICK_MS = 15000;        // 数える間隔
const PLAYTIME_SAVE_MS = 60000;        // 保存する間隔(数えるたびに保存すると書き込みが多すぎる)
const PLAYTIME_MAX_STEP_MS = 60000;    // 1回で足してよい上限。スリープ復帰などで飛んだぶんは数えない
const playtimeDayKey = (now=Date.now()) => new Date(Number(now)+9*60*60*1000).toISOString().slice(0,10);
const PLAYTIME_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const playtimeDayValue = (value) => typeof value === 'string' && PLAYTIME_DAY_PATTERN.test(value) ? value : null;
const playtimeSpan = (value) => {
  const ms = Number(value?.ms);
  return { day: playtimeDayValue(value?.day), ms: Number.isFinite(ms) && ms >= 0 ? ms : 0 };
};
// 保存値が無い・壊れている場合も必ず既定へ落とす(型を確かめてから使う)。
// days / today / longest は後から足した項目なので、それらを持たない古い保存を読んでも
// 既定で埋まり、それまでの合計(totalMs)と数え始めた日(since)はそのまま引き継がれる。
const normalizePlaytime = (value) => {
  const totalMs = Number(value?.totalMs);
  const days = Number(value?.days);
  return {
    totalMs: Number.isFinite(totalMs) && totalMs >= 0 ? totalMs : 0,
    since: playtimeDayValue(value?.since),
    days: Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0,
    today: playtimeSpan(value?.today),      // 今日のぶん
    longest: playtimeSpan(value?.longest),  // いちばん長く遊んだ日
  };
};
// 経過したぶんを足す。日をまたいだら「今日」を0へ戻して遊んだ日数を1増やす。
// 純粋な関数にしてあるので、日またぎの動きを検査でそのまま確かめられる。
const advancePlaytime = (current, deltaMs, now=Date.now()) => {
  const base = normalizePlaytime(current);
  const delta = Number(deltaMs);
  if (!(Number.isFinite(delta) && delta > 0)) return base;
  const day = playtimeDayKey(now);
  const sameDay = base.today.day === day;
  const todayMs = (sameDay ? base.today.ms : 0) + delta;
  return {
    totalMs: base.totalMs + delta,
    since: base.since || day,
    // 同じ日のあいだは増やさない。初日(dayが無い状態)は1日目として数える
    days: sameDay ? Math.max(1, base.days) : base.days + 1,
    today: { day, ms: todayMs },
    longest: todayMs > base.longest.ms ? { day, ms: todayMs } : base.longest,
  };
};
// 表示用。前に遊んだのが昨日以前なら、今日はまだ0分として出す
// (プロフィールを開いた時点ではまだ加算が走っていないことがあるため)
const playtimeTodayMs = (value, now=Date.now()) => {
  const base = normalizePlaytime(value);
  return base.today.day === playtimeDayKey(now) ? base.today.ms : 0;
};
const formatPlaytime = (ms) => {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  if (minutes > 0) return `${minutes}分`;
  return '1分未満';
};
const missionWeeklyPeriod = (now=Date.now()) => { const d=new Date(Number(now)+5*60*60*1000); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-((day+6)%7)); return d.toISOString().slice(0,10); };
const missionMonthlyPeriod = (now=Date.now()) => new Date(Number(now)+5*60*60*1000).toISOString().slice(0,7);
const MISSION_WEEK_ROTATION_EPOCH = '2026-08-24';
const missionPeriodWeekday = (now=Date.now()) => new Date(`${missionDailyPeriod(now)}T00:00:00Z`).getUTCDay();
const missionWeekRotationIndex = (now=Date.now()) => {
  const periodMs=Date.parse(`${missionWeeklyPeriod(now)}T00:00:00Z`), epochMs=Date.parse(`${MISSION_WEEK_ROTATION_EPOCH}T00:00:00Z`);
  const index=Math.floor((periodMs-epochMs)/(7*24*60*60*1000));
  return ((index%4)+4)%4;
};
const DAILY_ROTATION_MISSIONS = Object.freeze({
  1:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'diamond',amount:200}]},
  2:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'trainingTicket',amount:3}]},
  3:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
  4:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  5:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'dyeMock',amount:1}]},
  6:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'diamond',amount:300}]},
  0:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
});
const WEEKLY_ROTATION_MISSIONS = Object.freeze([
  {id:'weekly_rotation',name:'今週のミッション',condition:'プロモードを3回クリアする',key:'proClears',target:3,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'極限チャレンジを1回クリアする（未解放ならクイックモードを10回クリア）',key:'extremeOrQuick',target:1,rewards:[{type:'rainbowPsyche',amount:30}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'クイックモードを10回クリアする',key:'quickClears',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'アイテムを10個使用する',key:'itemUses',target:10,rewards:[{type:'bondPointReset',amount:1}]},
]);
const missionDailyDefinitions = (now=Date.now()) => [
  {id:'daily_login',name:'今日もMonster Hero！',condition:'その期間中にログインする',key:'login',target:1,rewards:[{type:'diamond',amount:100}]},
  {id:'daily_battles',name:'バトルに挑戦',condition:'バトルを3回行う',key:'battles',target:3,rewards:[{type:'trainingTicket',amount:3}]},
  // 旧 daily_wins のIDは受取履歴互換のため維持。条件は通常チャレンジのクリアへ置き換える。
  {id:'daily_wins',name:'デイリーチャレンジ',condition:'チャレンジモードを1回クリアする',key:'challengeClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  {id:'daily_enhance',name:'モンスター育成',condition:'モンスターを1回強化する',key:'enhances',target:1,rewards:[{type:'diamond',amount:200}]},
  {...DAILY_ROTATION_MISSIONS[missionPeriodWeekday(now)]},
  {id:'daily_complete',name:'デイリーコンプリート',condition:'通常デイリー5個のうち4個を達成する',key:'complete',target:4,rewards:[{type:'diamond',amount:500},{type:'skipTicketHa',amount:1}],complete:true},
];
const missionWeeklyDefinitions = (now=Date.now()) => [
  {id:'weekly_logins',name:'継続は力なり',condition:'異なる5日分のログインを行う',key:'loginDays',target:5,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_battles',name:'バトル週間',condition:'バトルを20回行う',key:'battles',target:20,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_enhance',name:'育成週間',condition:'モンスターを10回強化する',key:'enhances',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  // 旧 weekly_wins のIDをクイック枠へ再利用し、同期間の二重受取を防ぐ。
  {id:'weekly_wins',name:'クイック育成',condition:'クイックモードを5回クリアする',key:'quickClears',target:5,rewards:[{type:'rainbowPsyche',amount:20}]},
  // 旧IDは受取履歴互換のため維持。旧「プレイ」から通常チャレンジのクリアへ変更する。
  {id:'weekly_donations',name:'チャレンジャー',condition:'チャレンジモードを3回クリアする',key:'challengeClears',target:3,rewards:[{type:'breederXp',amount:300}]},
  {id:'weekly_market',name:'マーケット常連',condition:'マーケットで3回購入する',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:2}]},
  // 旧 weekly_daily_claims のIDをアイテム使用枠へ再利用する。
  {id:'weekly_daily_claims',name:'アイテム活用',condition:'アイテムを5個使用する',key:'itemUses',target:5,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {...WEEKLY_ROTATION_MISSIONS[missionWeekRotationIndex(now)]},
  {id:'weekly_complete',name:'ウィークリーコンプリート',condition:'通常ウィークリー8個のうち6個を達成する',key:'complete',target:6,rewards:[{type:'diamond',amount:2000},{type:'skipTicketKyu',amount:1},{type:'rainbowPsyche',amount:30}],complete:true},
];
const missionMonthlyDefinitions = () => [
  {id:'monthly_logins',name:'月間ログイン',condition:'異なる20日分のログインを行う',key:'loginDays',target:20,rewards:[{type:'diamond',amount:3000}]},
  {id:'monthly_battles',name:'月間バトル',condition:'バトルを100回行う',key:'battles',target:100,rewards:[{type:'rainbowPsyche',amount:50}]},
  {id:'monthly_wins',name:'月間勝利',condition:'バトルで200回勝利する',key:'wins',target:200,rewards:[{type:'trainingTicketLarge',amount:5}]},
  {id:'monthly_daily_completes',name:'デイリーマスター',condition:'デイリーコンプリートを20回達成する',key:'dailyCompletes',target:20,rewards:[{type:'diamond',amount:5000}]},
  {id:'monthly_weekly_completes',name:'ウィークリーマスター',condition:'ウィークリーコンプリートを3回達成する',key:'weeklyCompletes',target:3,rewards:[{type:'rainbowPsyche',amount:100}]},
  {id:'monthly_quick_runs',name:'クイック月間',condition:'クイックモードを20回プレイする',key:'quickRuns',target:20,rewards:[{type:'skipTicketKyu',amount:2}]},
  {id:'monthly_challenge_runs',name:'チャレンジ月間',condition:'チャレンジモードを10回プレイする',key:'challengeRuns',target:10,rewards:[{type:'rainbowPsyche',amount:50}]},
  {id:'monthly_enhances',name:'育成月間',condition:'モンスターを30回強化する',key:'enhances',target:30,rewards:[{type:'uniqueSkillResetTicket',amount:2}]},
  {id:'monthly_market',name:'マーケット月間',condition:'マーケットで10回取引する',key:'marketTrades',target:10,rewards:[{type:'dyeMock',amount:5}]},
  {id:'monthly_mode_runs',name:'モードプレイヤー',condition:'各種モードを合計30回プレイする',key:'modeRuns',target:30,rewards:[{type:'bondPointReset',amount:2}]},
  {id:'monthly_complete',name:'マンスリーコンプリート',condition:'通常マンスリー10個のうち8個を達成する',key:'complete',target:8,rewards:[{type:'diamond',amount:10000},{type:'rainbowPsyche',amount:200},{type:'rainbowTranscendFruit',amount:1}],complete:true},
];
// 日次・週次はJST期間に応じてローテーションするため、参照時に現在の定義を返す。
const MISSION_DEFS = {
  get daily(){ return missionDailyDefinitions(); },
  get weekly(){ return missionWeeklyDefinitions(); },
  get monthly(){ return missionMonthlyDefinitions(); },
};
const emptyMissionCounts = () => ({login:0,battles:0,wins:0,enhances:0,dailyClaims:0,dailyCompletes:0,weeklyCompletes:0,marketTrades:0,donations:0,challengeRuns:0,quickRuns:0,modeRuns:0,challengeClears:0,quickClears:0,proClears:0,extremeClears:0,itemUses:0});
const normalizeMissions = (value,now=Date.now()) => {
  const dailyPeriod=missionDailyPeriod(now), weeklyPeriod=missionWeeklyPeriod(now), monthlyPeriod=missionMonthlyPeriod(now), old=value&&typeof value==='object'?value:{};
  const dailySame=old.dailyPeriod===dailyPeriod, weeklySame=old.weeklyPeriod===weeklyPeriod, monthlySame=old.monthlyPeriod===monthlyPeriod;
  const state={version:2,dailyPeriod,weeklyPeriod,monthlyPeriod,daily:dailySame?{...emptyMissionCounts(),...(old.daily||{})}:emptyMissionCounts(),weekly:weeklySame?{...emptyMissionCounts(),...(old.weekly||{})}:emptyMissionCounts(),monthly:monthlySame?{...emptyMissionCounts(),...(old.monthly||{})}:emptyMissionCounts(),sentDaily:dailySame&&Array.isArray(old.sentDaily)?old.sentDaily:[],sentWeekly:weeklySame&&Array.isArray(old.sentWeekly)?old.sentWeekly:[],sentMonthly:monthlySame&&Array.isArray(old.sentMonthly)?old.sentMonthly:[],weeklyLoginDays:weeklySame&&Array.isArray(old.weeklyLoginDays)?old.weeklyLoginDays:[],monthlyLoginDays:monthlySame&&Array.isArray(old.monthlyLoginDays)?old.monthlyLoginDays:[],monthlyDailyCompletePeriods:monthlySame&&Array.isArray(old.monthlyDailyCompletePeriods)?old.monthlyDailyCompletePeriods:[],monthlyWeeklyCompletePeriods:monthlySame&&Array.isArray(old.monthlyWeeklyCompletePeriods)?old.monthlyWeeklyCompletePeriods:[]};
  // 月途中の初導入や月替わりでは、導入前・前月中に既に終わっていた現在期間の
  // コンプリートを遡及加算しない。期間IDだけ記録し、次の新しい期間から数える。
  if(!monthlySame){
    const completed=(type)=>{
      const defs=MISSION_DEFS[type], normal=defs.filter(m=>!m.complete), target=defs.find(m=>m.complete)?.target||Infinity;
      const sent=type==='daily'?state.sentDaily:state.sentWeekly;
      return normal.filter(m=>{
        if(sent.includes(m.id))return true;
        if(m.key==='loginDays')return state.weeklyLoginDays.length>=m.target;
        if(type==='weekly'&&m.key==='extremeOrQuick')return state.weekly.extremeClears>=1||state.weekly.quickClears>=10;
        return (Number(state[type]?.[m.key])||0)>=m.target;
      }).length>=target;
    };
    if(dailySame&&completed('daily'))state.monthlyDailyCompletePeriods=[dailyPeriod];
    if(weeklySame&&completed('weekly'))state.monthlyWeeklyCompletePeriods=[weeklyPeriod];
  }
  return state;
};
const missionValue = (state,type,mission) => {
  if(mission.complete){ const normal=MISSION_DEFS[type].filter(m=>!m.complete); return normal.filter(m=>missionValue(state,type,m)>=m.target).length; }
  if(mission.key==='loginDays') return type==='monthly'?state.monthlyLoginDays.length:state.weeklyLoginDays.length;
  // 旧仕様で同じIDの報酬を受取済みなら、新条件へ変わった同じ期間でも達成済みとして扱う。
  const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly;
  if(Array.isArray(sent)&&sent.includes(mission.id)) return mission.target;
  if(type==='weekly'&&mission.key==='extremeOrQuick') return ((Number(state.weekly?.extremeClears)||0)>=1||(Number(state.weekly?.quickClears)||0)>=10)?1:0;
  return Number(state[type]?.[mission.key])||0;
};
// 「達成済みかつ未受取(ギフト未送付)」のミッション。HOMEの通知バッジ・タブのバッジ・一括受取が
// すべてこの判定を共有するので、どこか1か所だけ数え方がずれることがない
const missionClaimableList = (state,type) => { const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly; return MISSION_DEFS[type].filter(m=>missionValue(state,type,m)>=m.target && !sent.includes(m.id)); };
const missionClaimableCount = state => ['daily','weekly','monthly'].reduce((sum,type)=>sum+missionClaimableList(state,type).length,0);
const missionNextReset = (type,now=Date.now()) => { const shifted=new Date(Number(now)+5*60*60*1000); shifted.setUTCHours(0,0,0,0); if(type==='monthly')shifted.setUTCMonth(shifted.getUTCMonth()+1,1);else shifted.setUTCDate(shifted.getUTCDate()+(type==='daily'?1:7-((shifted.getUTCDay()+6)%7))); return shifted.getTime()-5*60*60*1000; };
const reconcileMonthlyMissionCompletions = (value,now=Date.now()) => {
  const state=normalizeMissions(value,now), dailyComplete=MISSION_DEFS.daily.find(m=>m.complete), weeklyComplete=MISSION_DEFS.weekly.find(m=>m.complete);
  if(dailyComplete&&missionValue(state,'daily',dailyComplete)>=dailyComplete.target&&!state.monthlyDailyCompletePeriods.includes(state.dailyPeriod)){
    state.monthlyDailyCompletePeriods=[...state.monthlyDailyCompletePeriods,state.dailyPeriod];
    state.monthly.dailyCompletes=(Number(state.monthly.dailyCompletes)||0)+1;
  }
  if(weeklyComplete&&missionValue(state,'weekly',weeklyComplete)>=weeklyComplete.target&&!state.monthlyWeeklyCompletePeriods.includes(state.weeklyPeriod)){
    state.monthlyWeeklyCompletePeriods=[...state.monthlyWeeklyCompletePeriods,state.weeklyPeriod];
    state.monthly.weeklyCompletes=(Number(state.monthly.weeklyCompletes)||0)+1;
  }
  return state;
};
