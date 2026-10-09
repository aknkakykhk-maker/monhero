// ===== モンヒロビート マルチ(みんなで対戦: 協力ライブ) =====
// 仕様の正本: docs/spec/RHYTHM_MULTI.md / 検査: node tools/mode/rhythm-multi-check.js
// プロセカの「みんなでライブ」を本家どおりの流れで真似した、最大5人の協力プレイ。
//
//   ルームえらび(フリー / ベテラン / プライベート)
//   → マッチング(5人そろう・部屋主が「メンバー確定」・公開ルームはしばらく待つと自動で確定)
//   → 選曲(30秒。全員が曲か「おまかせ」をえらぶ。全員そろうか時間切れで次へ)
//   → MUSIC SHUFFLE(全員の選曲から1曲を抽選する演出)
//   → 難易度えらび・準備完了(30秒。全員の準備完了か時間切れでライブ開始)
//   → ライブ(各自の端末で演奏。リスタート・リタイアなし)
//   → 結果(チームのランク・1人ずつのスコア・MVP)
//   → 同じメンバーのまま、次の選曲へ
//
// 通信は Supabase Realtime の「Broadcast」だけを使う。テーブルもSQLも要らず、ランキング(rankings)・
// 自己ベスト・ビートP・周回報酬には一切触れない。演奏は各自の端末で完結するので、通信の遅れは判定に影響しない。
//
// 作り:
//  ・サーバーは持たない。全員が2秒ごとに自分の状態を知らせ(hb)、7秒聞こえない人は抜けた扱い。
//    「部屋主」は、いる人の中でいちばん早く入った人(同時なら id の小さい人)。全員が同じ並びを計算できる。
//  ・部屋の進行(いまどの段か・何曲目か・残り時間)は部屋主の端末だけが決め、hb に載せて配る。
//    ほかの人はそれに従う。部屋主が抜けたら、次の部屋主が受け取っていた進行をそのまま引き継ぐ。
//    残り時間は「あと何秒」で配る(端末の時計がずれていても数え方がそろう)。
//  ・フリー/ベテランの「さがす」は、種類ごとの受付用の通信路(mhb-lobby-◯◯)で行う。
//    空きのある部屋の部屋主が2秒ごとに「ここにいるよ」と知らせ、探す人はそれを3.5秒聞いて入る。
//    探す人どうしが同時に部屋を作っても、1人きりの部屋は「コードの小さい部屋」へ引っ越して1つにまとまる。
//  ・画面を行き来しても部屋が切れないよう、状態は React の外(このファイルの RHYTHM_MULTI)に置く。
const RHYTHM_MULTI_ROOM_MAX = 5;
const RHYTHM_MULTI_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RHYTHM_MULTI_CODE_LENGTH = 4;
const RHYTHM_MULTI_HEARTBEAT_MS = 2000;
const RHYTHM_MULTI_ALIVE_MS = 7000;
const RHYTHM_MULTI_START_COUNTDOWN_SEC = 3;
const RHYTHM_MULTI_SHUFFLE_MS = 2400;
// 各段の制限時間(本家と同じく、時間切れになったら自動で次へ進む)
const RHYTHM_MULTI_SELECT_MS = 30000;
// 選曲の制限時間は部屋主が決められる(2026-10-07・ユーザー指示「30秒、60秒、時間設定なしなど」)。0 は「制限時間なし」。
// 古い端末の知らせには入っていないので、無いときは30秒と読む。決めた値は端末に残し、次の部屋のはじめの値にする
const RHYTHM_MULTI_SELECT_SEC_OPTIONS = Object.freeze([30, 60, 90, 0]);
const RHYTHM_MULTI_SELECT_SEC_DEFAULT = 30;
const RHYTHM_MULTI_SELECT_SEC_KEY = 'mh_rhythm_multi_select_sec_v1';
const rhythmMultiNormalizeSelectSec = (v) => (typeof v === 'number' && RHYTHM_MULTI_SELECT_SEC_OPTIONS.includes(v) ? v : RHYTHM_MULTI_SELECT_SEC_DEFAULT);
const rhythmMultiSelectSecLabel = (sec) => (sec > 0 ? `${sec}秒` : 'なし');
const RHYTHM_MULTI_READY_MS = 30000;
const RHYTHM_MULTI_READY_GRACE_MS = 3000;
const RHYTHM_MULTI_RESULT_MS = 45000;
// ライブが曲の長さを過ぎても終わらない人を待つ上限。
//   対戦の 3・2・1(3秒)+ 演奏画面の READY・3・2・1(0.8秒×4)= 曲が鳴りはじめるまで + 曲が終わってから10秒。
//   最後まで演奏した人は曲が終わった瞬間にスコアを送ってくるので、それ以上待っても届かない人は抜けた人
//   (2026-10-03・ユーザー指摘「演奏後30秒わからないのは不便」。以前は一律30秒だった)
const RHYTHM_MULTI_PLAY_GRACE_MS = RHYTHM_MULTI_START_COUNTDOWN_SEC * 1000 + 4 * 800 + 10000;
// 演奏中に溜めておく知らせの上限(5人・数分のライブなら届かない量。超えたら古いものから捨てる)
const RHYTHM_MULTI_QUEUE_MAX = 300;
// 公開ルームは、2人以上いて、この時間だれも出入りしなければメンバー確定
const RHYTHM_MULTI_PUBLIC_MATCH_WAIT_MS = 15000;
const RHYTHM_MULTI_CHAT_MAX_LENGTH = 40;
const RHYTHM_MULTI_CHAT_KEEP = 50;
const RHYTHM_MULTI_CHAT_INTERVAL_MS = 800;
const RHYTHM_MULTI_CHAT_STAMPS = Object.freeze(['よろしく!', 'ナイス!', '準備OK!', 'もう一回!', 'ありがとう!']);
// 画面ごとに、先頭へ出す定型文(2026-10-03・ユーザー指示「チャット機能もっと使いやすく」
// 「結果画面でもチャットできるように。もういっかいとかありがとうとか意思疎通したい」)。
// 残りは共通の定型文を後ろへ並べる(同じ文は2度並べない)
const RHYTHM_MULTI_CHAT_STAMPS_BY_PHASE = Object.freeze({
  matching: ['よろしく!', 'はじめまして!', 'ちょっと待って!', 'マスモン入れて!', 'マスモン入れるね!'],
  select: ['この曲やりたい!', 'おまかせで!', 'なんでもOK!', 'マスモン入れるね!', 'マスモン入れて!'],
  ready: ['準備OK!', 'ちょっと待って!', 'がんばろう!', 'マスモン入れたよ!'],
  playing: ['おつかれ!', 'ナイス!', '待ってるね!'],
  result: ['もう一回!', 'ありがとう!', 'おつかれ!', 'ナイス!', 'GG!', '次いこう!', 'ドンマイ!', 'またね!'],
});
// 呼んだマスモンに話しかける札(2026-10-08・ユーザー指示「マスモンに聞くボタン」)。押すと「{名前}、{text}」を送る。
// 何を聞くかはマスモンの会話(33-rhythm-buddy-convo.jsx)が読み取れるものだけ。名前は12文字までなので、40文字に収まる
const RHYTHM_BUDDY_ASK_CHIPS = Object.freeze([
  { label: '調子は?', text: '調子どう?' }, { label: '得意な曲は?', text: '得意な曲は?' }, { label: 'レベルは?', text: 'レベルいくつ?' },
  { label: 'さっきの話は?', text: 'さっきの話は?' }, { label: '何点だった?', text: '何点だった?' }, { label: '性格は?', text: 'どんな性格?' },
]);
// マスモンを呼ぶ遊びの定型文(2026-10-07・ユーザー指示「マスモンいれてーとかマスモン出せないとか」)。共通の最後に並べる
const RHYTHM_MULTI_CHAT_BUDDY_STAMPS = Object.freeze(['マスモン入れて!', 'マスモン入れたよ!', 'マスモンうまい!', 'マスモン出せない…', '無料おわった…', '券がない…', '席ゆずるね!']);
const RHYTHM_MULTI_CHAT_COMMON_STAMPS = Object.freeze(['よろしく!', 'ありがとう!', 'ナイス!', 'もう一回!', 'おつかれ!', 'すごい!', 'ドンマイ!', 'またね!', ...RHYTHM_MULTI_CHAT_BUDDY_STAMPS]);
const rhythmMultiStampsFor = (phase) => {
  const list = [...(RHYTHM_MULTI_CHAT_STAMPS_BY_PHASE[phase] || []), ...RHYTHM_MULTI_CHAT_COMMON_STAMPS, ...RHYTHM_MULTI_CHAT_STAMPS];
  return list.filter((text, i) => text.length <= RHYTHM_MULTI_CHAT_MAX_LENGTH && list.indexOf(text) === i);
};
// 発言は、その人のカードの上へ吹き出しでしばらく出す(チャットを開いていなくても気づける)
const RHYTHM_MULTI_CHAT_BUBBLE_MS = 6000;
// 呼んだマスモンのおしゃべり。同じ子が続けて話さない間隔と、人の発言へ返事をしてよい新しさ
const RHYTHM_MULTI_CPU_TALK_GAP_MS = 2500;
const RHYTHM_MULTI_CPU_REPLY_FRESH_MS = 8000;
// 部屋が静かなまま、これだけ過ぎると、ときどきひとりごとを言う
const RHYTHM_MULTI_CPU_IDLE_QUIET_MS = 15000;
// 聞き返して返事を待つ時間と、マスモンどうしが話す間隔(2026-10-08・会話らしくする)
const RHYTHM_MULTI_CPU_AWAIT_MS = 60000;
const RHYTHM_MULTI_CPU_BANTER_GAP_MS = 15000;
const RHYTHM_MULTI_ROOM_TOPIC = 'realtime:mhb-room-';
const RHYTHM_MULTI_LOBBY_TOPIC = 'realtime:mhb-lobby-';
const RHYTHM_MULTI_LOBBY_ANNOUNCE_MS = 2000;
const RHYTHM_MULTI_LOBBY_LISTEN_MS = 3500;
const RHYTHM_MULTI_LOBBY_FRESH_MS = 6000;
// 1人きりの部屋をほかの部屋へまとめるのは、最近この時間だれも見ていないときだけ(ライブ中の仲間とはぐれないため)
const RHYTHM_MULTI_MERGE_QUIET_MS = 5 * 60 * 1000;
// 途中でやめた人が公開ルームへ入れない時間。新しい保存キー(既存のキーは触らない)
const RHYTHM_MULTI_PENALTY_KEY = 'mh_rhythm_multi_penalty_v1';
const RHYTHM_MULTI_PENALTY_MS = 3 * 60 * 1000;
const RHYTHM_MULTI_MODES = Object.freeze(['private', 'free', 'veteran']);
const RHYTHM_MULTI_MODE_LABELS = Object.freeze({ private: 'プライベート', free: 'フリー', veteran: 'ベテラン' });
const RHYTHM_MULTI_PHASES = Object.freeze(['matching', 'select', 'ready', 'playing', 'result']);
// 「おまかせ」を選んだしるし(曲の id とぶつからない文字)
const RHYTHM_MULTI_OMAKASE = '*';
// 対戦のライブで重ねる見た目(オプションの見た目のおまかせ「軽さ優先」と同じ中身。保存してある設定は書き換えない)
// 対戦の演出の段階の選択肢(難易度えらびの画面に並べる)。id は RHYTHM_MULTI_LOOK_LEVELS と同じ
const RHYTHM_MULTI_LOOK_CHOICES = Object.freeze([
  { id: 'LIGHT', label: '軽め' }, { id: 'STANDARD', label: '標準' }, { id: 'VIVID', label: '華やか' }, { id: 'OWN', label: 'いつもの' },
]);
const RHYTHM_MULTI_LIGHT_LOOK = Object.freeze({ ...((RHYTHM_LOOK_PRESETS.find((preset) => preset.id === 'LIGHT') || {}).values || {}) });
// ライブの報酬(周回・ビートP)の人数ボーナス。参加した人が1人ふえるごとに+50%(2人1.5倍〜5人3倍。2026-10-02・ユーザー指示)
// 呼んだマスモン(CPU)は人より少なく、1体あたり+5%(2026-10-07・ユーザー指示「ボーナスが強すぎる。1体あたり5%ずつに」。はじめは+30/20/10/10%だった)。
// count は参加者の数(人+CPU)、cpus はそのうちの CPU の数
const RHYTHM_MULTI_REWARD_STEP = 0.5;
const RHYTHM_MULTI_CPU_REWARD_STEPS = Object.freeze([0.05, 0.05, 0.05, 0.05]);
const rhythmMultiRewardScale = (count, cpus = 0) => {
  const n = Math.max(1, Math.min(RHYTHM_MULTI_ROOM_MAX, Math.floor(Number(count) || 1)));
  const c = Math.max(0, Math.min(n - 1, Math.floor(Number(cpus) || 0)));
  const cpuBonus = RHYTHM_MULTI_CPU_REWARD_STEPS.slice(0, c).reduce((a, b) => a + b, 0);
  return Math.round((1 + RHYTHM_MULTI_REWARD_STEP * (n - c - 1) + cpuBonus) * 100) / 100;
};
// 連続ボーナス(2026-10-03・ユーザー指示「1曲毎に10%、上限100%」)。続けて遊んだライブの何曲目か(streak)で
// (前のライブの全員がまた参加していれば続く。メンバーが増えても続き、だれかが抜けたら1に戻る)、
// 2曲目+10%・3曲目+20%…11曲目より後は+100%。人数ボーナスに掛け合わせて、周回報酬とビートPに使う
const RHYTHM_MULTI_STREAK_STEP = 0.1;
// フリーマッチでひとりのまま待っているとき、プライベートルームを勧めるまでの時間
const RHYTHM_MULTI_ALONE_HINT_MS = 45000;
const RHYTHM_MULTI_STREAK_MAX_BONUS = 1;
const rhythmMultiStreakBonus = (streak) => {
  const v = Number(streak);
  const n = Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1;
  return Math.min(RHYTHM_MULTI_STREAK_MAX_BONUS, Math.round(RHYTHM_MULTI_STREAK_STEP * (n - 1) * 100) / 100);
};
// 人数ボーナス × 連続ボーナス。表示に使うので小数2けたで丸める
const rhythmMultiTotalScale = (count, streak, cpus = 0) => Math.round(rhythmMultiRewardScale(count, cpus) * (1 + rhythmMultiStreakBonus(streak)) * 100) / 100;
// 「メンバーの成績」に出す判定の並び(演奏側の RHYTHM_JUDGMENT_IDS と同じ順)
const RHYTHM_MULTI_JUDGMENT_IDS = Object.freeze(['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS']);

const rhythmMultiMakeCode = () => {
  let code = '';
  for (let i = 0; i < RHYTHM_MULTI_CODE_LENGTH; i += 1) {
    code += RHYTHM_MULTI_CODE_CHARS[Math.floor(Math.random() * RHYTHM_MULTI_CODE_CHARS.length)];
  }
  return code;
};
// 入力されたコードを整える。使える文字だけを残し、4文字にそろわなければ空文字を返す
const rhythmMultiNormalizeCode = (text) => {
  const code = String(text == null ? '' : text).toUpperCase().split('')
    .filter((ch) => RHYTHM_MULTI_CODE_CHARS.includes(ch)).join('');
  return code.length === RHYTHM_MULTI_CODE_LENGTH ? code : '';
};
const rhythmMultiMakeId = (head = 'p') => `${head}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const rhythmMultiText = (value, max) => String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').slice(0, max);
const rhythmMultiInt = (value, max) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};
// 部屋の並び(部屋主が先頭)。全員が同じ並びを得る
// 呼んだマスモン(CPU)は人のうしろに並べる。5人を超えたら、うしろの CPU から外れる(人が優先。2026-10-07・ユーザー指示「1人1体まで呼べる」)
const rhythmMultiSortMembers = (members) => members.slice().sort((a, b) =>
  ((a.cpu ? 1 : 0) - (b.cpu ? 1 : 0)) || (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// ---- 保存(途中でやめたときの入室待ち。保存が壊れていても既定値で動く) ----
const rhythmMultiPenaltyLeftMs = async () => {
  try {
    const saved = await storeGet(RHYTHM_MULTI_PENALTY_KEY, null);
    const until = saved && typeof saved === 'object' ? Number(saved.until) : 0;
    return Number.isFinite(until) ? Math.max(0, Math.min(RHYTHM_MULTI_PENALTY_MS, until - Date.now())) : 0;
  } catch (_) { return 0; }
};
const rhythmMultiPenaltyMark = async () => {
  try { await storeSet(RHYTHM_MULTI_PENALTY_KEY, { until: Date.now() + RHYTHM_MULTI_PENALTY_MS }); } catch (_) { /* 保存できなくても対戦は続ける */ }
};

// ---- 結果の集計(協力スコア) ----
// 1曲ぶん。ライブに参加した人(participants)の平均スコアでチームのランクを決める。
// やめた人・途中で抜けた人は0点として平均に入れる。MVP は、最後まで演奏した人の最高スコア(同点は先に入った人)
const rhythmMultiTeamResult = (members, round, participants, closed = false) => {
  const ids = Array.isArray(participants) && participants.length ? participants : members.map((m) => m.id);
  const rows = ids.map((id) => {
    const m = members.find((x) => x.id === id) || { id, name: '(抜けた人)', icon: '', frame: '', gone: true };
    return { m, res: m.res && m.res.startId === round ? m.res : null };
  });
  // closed … 結果の段に入った(ホストが締めた・上限時間を過ぎた)。まだ結果の無い人は待たない
  const waiting = !closed && rows.some((r) => !r.res && !r.m.gone);
  const scores = rows.map((r) => (r.res && !r.res.quit ? r.res.score : 0));
  const average = scores.length ? Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  let mvpId = null;
  let best = 0;
  rows.forEach((r) => { if (r.res && !r.res.quit && r.res.score > best) { best = r.res.score; mvpId = r.m.id; } });
  return { rows, waiting, average, mvpId, rank: scores.length ? rhythmRankForScore(average) : null };
};

// ---- 受け取った知らせを、安全な形へ作り直す。知らない形・壊れた値は捨てる ----
const rhythmMultiCleanRoom = (raw) => {
  if (!raw || typeof raw !== 'object' || !RHYTHM_MULTI_PHASES.includes(raw.ph)) return null;
  return {
    phase: raw.ph,
    round: rhythmMultiText(raw.rd, 40),
    songId: rhythmMultiText(raw.sg, 60),
    left: rhythmMultiInt(raw.lf, 600),
    // 残り0秒と「制限時間なし」を分ける(0秒を「なし」と読むと、時間切れの扱いが動かなくなる)
    hasDeadline: raw.dl === 1,
    selectSec: rhythmMultiNormalizeSelectSec(raw.ss),
    participants: Array.isArray(raw.pt) ? raw.pt.slice(0, RHYTHM_MULTI_ROOM_MAX).map((id) => rhythmMultiText(id, 40)).filter(Boolean) : [],
  };
};
const rhythmMultiCleanMessage = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = rhythmMultiText(raw.id, 40);
  if (!id) return null;
  const out = { t: raw.t, id };
  if (raw.t === 'hb') {
    out.name = rhythmMultiText(raw.name, 12) || '名無しのブリーダー';
    out.level = rhythmMultiInt(raw.level, 9999);
    out.joinedAt = rhythmMultiInt(raw.joinedAt, 9e15);
    out.icon = rhythmMultiText(raw.icon, 60);
    out.frame = rhythmMultiText(raw.frame, 40);
    // ブリーダーid(フレンド申請に使う。2026-10-03)。英数字と記号だけ通す
    out.bid = rhythmMultiText(raw.bid, 64).replace(/[^A-Za-z0-9_-]/g, '');
    out.pick = rhythmMultiText(raw.pick, 60);
    out.pickRound = rhythmMultiText(raw.pickRound, 40);
    out.readyRound = rhythmMultiText(raw.readyRound, 40);
    out.diff = rhythmMultiText(raw.diff, 20);
    out.playing = raw.playing === true;
    out.open = raw.open === true;
    out.mode = RHYTHM_MULTI_MODES.includes(raw.mode) ? raw.mode : 'private';
    if (raw.res && typeof raw.res === 'object') out.res = rhythmMultiCleanResult(raw.res);
    if (raw.room) out.room = rhythmMultiCleanRoom(raw.room);
    // 相棒(CPU。呼んだ人の端末が代わりに知らせる)。マスモンの種類(mb)と染色の色(mc)で、染めた姿を描く
    out.cpu = raw.cpu === 1 || raw.cpu === true;
    if (out.cpu) {
      out.owner = rhythmMultiText(raw.owner, 40);
      out.mb = rhythmMultiText(raw.mb, 40).replace(/[^A-Za-z0-9_-]/g, '');
      out.mc = Array.isArray(raw.mc) ? raw.mc.slice(0, 8).map((c) => rhythmMultiText(c, 24).replace(/[^A-Za-z0-9_#:-]/g, '')) : [];
      // 選んだ理由(相棒の気持ち。決まった短いコードだけ通す)
      out.pw = rhythmMultiText(raw.pw, 12).replace(/[^a-z]/g, '');
    }
    return out;
  }
  if (raw.t === 'draw' || raw.t === 'start') {
    out.round = rhythmMultiText(raw.round, 40);
    out.songId = rhythmMultiText(raw.songId, 60);
    out.participants = Array.isArray(raw.participants) ? raw.participants.slice(0, RHYTHM_MULTI_ROOM_MAX).map((x) => rhythmMultiText(x, 40)).filter(Boolean) : [];
    return out.round && out.songId ? out : null;
  }
  if (raw.t === 'res') {
    out.res = rhythmMultiCleanResult(raw.res);
    return out.res ? out : null;
  }
  if (raw.t === 'chat') {
    out.name = rhythmMultiText(raw.name, 12) || '名無しのブリーダー';
    out.text = rhythmMultiText(raw.text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
    out.cid = rhythmMultiText(raw.cid, 40);
    return out.text && out.cid ? out : null;
  }
  if (raw.t === 'bye') return out;
  return null;
};
const rhythmMultiCleanResult = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const startId = rhythmMultiText(raw.startId, 40);
  if (!startId) return null;
  return {
    startId,
    score: rhythmMultiInt(raw.score, 1e12),
    maxCombo: rhythmMultiInt(raw.maxCombo, 100000),
    cleared: raw.cleared !== false,
    quit: raw.quit === true,
    diffId: rhythmMultiText(raw.diffId, 20),
    fc: rhythmMultiInt(raw.fc, 3),
    // 判定ごとの数(メンバーの成績)と FAST / SLOW。無ければ空
    j: Array.isArray(raw.j) ? RHYTHM_MULTI_JUDGMENT_IDS.map((_, k) => rhythmMultiInt(raw.j[k], 100000)) : null,
    fs: rhythmMultiInt(raw.fs, 100000),
    sl: rhythmMultiInt(raw.sl, 100000),
  };
};
// 受付用の通信路で流れる「ここに部屋があるよ」
const rhythmMultiCleanRoomNotice = (raw) => {
  if (!raw || typeof raw !== 'object' || raw.t !== 'room') return null;
  const code = rhythmMultiNormalizeCode(raw.code);
  const n = rhythmMultiInt(raw.n, RHYTHM_MULTI_ROOM_MAX);
  return code && n >= 1 && n < RHYTHM_MULTI_ROOM_MAX ? { code, n } : null;
};
// 受付で聞いた部屋のうち、いちばん人が多い部屋(同数ならコードの小さい順)。自分の部屋は除く
const rhythmMultiBestRoom = (rooms, exceptCode) => {
  const now = Date.now();
  const list = Object.entries(rooms)
    .filter(([code, info]) => code !== exceptCode && now - info.seen <= RHYTHM_MULTI_LOBBY_FRESH_MS)
    .map(([code, info]) => ({ code, n: info.n }));
  list.sort((a, b) => (b.n - a.n) || (a.code < b.code ? -1 : 1));
  return list.length ? list[0].code : null;
};

// ---- 通信(Supabase Realtime を Phoenix のことばで直接話す。ライブラリは足さない) ----
const rhythmMultiOpenSocket = ({ topic, onOpen, onMessage, onClose }) => {
  let ws = null;
  let beatTimer = null;
  let ref = 0;
  let closed = false;
  const nextRef = () => String(++ref);
  const send = (event, payload, topicName) => {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify({ topic: topicName || topic, event, payload, ref: nextRef(), join_ref: '1' })); return true; } catch (_) { return false; }
  };
  try {
    ws = new WebSocket(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`);
  } catch (_) {
    setTimeout(() => { if (!closed) onClose(); }, 0);
    return { send: () => false, close: () => { closed = true; } };
  }
  ws.onopen = () => {
    // join_ref は join のときの ref('1')と同じにしておく
    try {
      ws.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { broadcast: { self: true, ack: false }, presence: { key: '' }, private: false } }, ref: '1', join_ref: '1' }));
    } catch (_) { /* 閉じたときに onClose が来る */ }
    beatTimer = setInterval(() => send('heartbeat', {}, 'phoenix'), 25000);
  };
  ws.onmessage = (event) => {
    let msg = null;
    try { msg = JSON.parse(event.data); } catch (_) { return; }
    if (!msg || msg.topic !== topic) return;
    if (msg.event === 'phx_reply' && msg.ref === '1') {
      if (msg.payload && msg.payload.status === 'ok') onOpen(); else onClose();
    } else if (msg.event === 'broadcast' && msg.payload && msg.payload.event === 'msg') {
      onMessage(msg.payload.payload);
    } else if (msg.event === 'phx_close' || msg.event === 'phx_error') {
      onClose();
    }
  };
  ws.onclose = () => { if (beatTimer) clearInterval(beatTimer); beatTimer = null; if (!closed) onClose(); };
  ws.onerror = () => { /* onclose がそのあとに来る */ };
  return {
    send: (payload) => send('broadcast', { type: 'broadcast', event: 'msg', payload }),
    close: () => {
      closed = true;
      if (beatTimer) clearInterval(beatTimer);
      beatTimer = null;
      try { ws.close(); } catch (_) { /* すでに閉じている */ }
    },
  };
};

// ---- 部屋の状態(React の外に置く) ----
// 結果のなかで、ミスが占める割合(判定の数がなければ 0)。マスモンが「ミス多めだったね」と励ますかの目安
const rhythmMultiMissRate = (res) => {
  const j = res && Array.isArray(res.j) ? res.j : null;
  if (!j || j.length < RHYTHM_MULTI_JUDGMENT_IDS.length) return 0;
  const total = j.reduce((sum, n) => sum + (Number(n) || 0), 0);
  return total > 0 ? (Number(j[RHYTHM_MULTI_JUDGMENT_IDS.length - 1]) || 0) / total : 0;
};
const RHYTHM_MULTI = (() => {
  const listeners = new Set();
  const startListeners = new Set();
  let s = null;
  let socket = null;
  let lobby = null; // { kind, socket, rooms, lastAnnounce }
  let hbTimer = null;
  let sweepTimer = null;
  let reconnectTimer = null;
  let catalog = []; // 抽選に使う曲の id(画面から渡してもらう)
  let durations = {}; // 曲の長さ(ミリ秒)。ライブが終わらない人を待ち続けないための上限に使う
  // 相棒(CPU)の演奏と選曲を作る関数(画面から渡してもらう)。play({ songId, diffId }) → 演奏の結果 / pick(catalog) → 曲の id
  let cpuBrain = null;
  // 部屋主として使う選曲の制限時間(端末に残した前回の値。無ければ30秒)
  let selectSecPref = RHYTHM_MULTI_SELECT_SEC_DEFAULT;
  let selectSecLoaded = false;
  const loadSelectSecPref = () => {
    if (selectSecLoaded) return;
    selectSecLoaded = true;
    Promise.resolve().then(() => storeGet(RHYTHM_MULTI_SELECT_SEC_KEY, null)).then((saved) => {
      selectSecPref = rhythmMultiNormalizeSelectSec(saved);
      // 部屋を作った直後に読み終えたとき、まだ自分で変えていなければ前回の値にそろえる
      if (s && !s.selectSecTouched && s.room.phase === 'matching') { s.room = { ...s.room, selectSec: selectSecPref }; emit(); }
    }).catch(() => {});
  };
  // アプリを閉じる・別のページへ移るときに「抜けます」を送る(ほかの人がすぐ気づけるように)。
  // 送れない閉じ方(強制終了など)のときは、上の上限時間で抜けた扱いになる
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => {
      if (s && socket) { socket.send({ t: 'bye', id: s.selfId }); s.cpus.forEach((c) => socket.send({ t: 'bye', id: c.id })); }
    });
  }
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (_) { /* 画面側の失敗で通信を止めない */ } }); };
  // ライブ中の人は演奏のあいだ何も送ってこないので、ライブの上限時間(曲の長さ+ゆとり)までは抜けた扱いにしない
  // 自分が呼んだ相棒は、自分の端末が知らせているので、自分と同じく常にいる扱い
  const alive = () => (s ? Object.values(s.members).filter((m) => Date.now() - m.seen <= RHYTHM_MULTI_ALIVE_MS || m.id === s.selfId
    || s.cpus.some((c) => c.id === m.id)
    || (m.playing && s.room.phase === 'playing' && Date.now() < s.playUntil)) : []);
  const ordered = () => rhythmMultiSortMembers(alive()).slice(0, RHYTHM_MULTI_ROOM_MAX);
  const selfMember = () => (s ? s.members[s.selfId] : null);
  const isHostNow = () => { const o = ordered(); return !!s && o.length > 0 && o[0].id === s.selfId; };
  const roomPayload = () => {
    const r = s.room;
    return { ph: r.phase, rd: r.round, sg: r.songId, lf: r.deadline ? Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)) : 0, dl: r.deadline ? 1 : 0, ss: rhythmMultiNormalizeSelectSec(r.selectSec), pt: r.participants };
  };
  // 演奏中は送らない(2026-10-03・ユーザー指示「演奏中の通信は止める」)。force はライブ開始の知らせだけ
  const sendHb = (force = false) => {
    const me = selfMember();
    if (!s || !socket || !me) return;
    if (me.playing && !force) return;
    socket.send({
      t: 'hb', id: s.selfId, name: me.name, level: me.level, joinedAt: me.joinedAt, icon: me.icon, frame: me.frame, bid: me.bid || undefined,
      pick: me.pick, pickRound: me.pickRound, readyRound: me.readyRound, diff: me.diff, playing: me.playing,
      open: me.open, mode: s.mode, res: me.res || undefined, room: isHostNow() ? roomPayload() : undefined,
    });
    sendCpuHb();
  };
  // 自分が呼んだ相棒のぶんの知らせ。相棒は部屋主にならない(呼んだ時刻が joinedAt なので、呼んだ人より必ず後)
  // 1人で何体も呼べる(2026-10-07・ユーザー指示「無料枠と券がある分だけ入れられる」)。s.cpus = [{ id, masuId, callId }](callId は呼んだ1回ごとの控えの id。曲が始まった・部屋を出たを cpuBrain へ知らせるときに渡す)
  const myCpu = (id) => (s && s.cpus.some((c) => c.id === id) ? s.members[id] : null);
  const sendCpuHb = () => { if (s) s.cpus.forEach((x) => sendOneCpuHb(x.id)); };
  const sendOneCpuHb = (cpuId) => {
    const c = myCpu(cpuId);
    if (!c || !socket) return;
    socket.send({
      t: 'hb', id: c.id, name: c.name, level: c.level, joinedAt: c.joinedAt, icon: '', frame: '',
      pick: c.pick, pickRound: c.pickRound, readyRound: c.readyRound, diff: c.diff, playing: c.playing,
      open: false, mode: s.mode, res: c.res || undefined, cpu: 1, owner: s.selfId, mb: c.mb, mc: c.mc, pw: c.pickWhy || '',
    });
  };
  // 相棒の結果を作って知らせる(自分の演奏が終わったとき。自分が参加していないライブなら始まってすぐ)
  const reportCpuResult = (round) => { if (s) s.cpus.slice().forEach((x) => reportOneCpuResult(round, x)); };
  const reportOneCpuResult = (round, x) => {
    const c = myCpu(x.id);
    if (!c || !round || !c.playing || (c.res && c.res.startId === round)) return;
    let result = null;
    const humans = Math.max(1, ordered().filter((m) => !m.cpu).length);
    try { result = cpuBrain && cpuBrain.play ? cpuBrain.play({ songId: s.room.songId, diffId: c.diff, masuId: x.masuId, round, humans }) : null; } catch (_) { result = null; }
    c.res = rhythmMultiCleanResult({
      startId: round, score: result && result.score, maxCombo: result && result.maxCombo, cleared: true, quit: false, diffId: c.diff,
      fc: result ? (result.allMarvelous ? 3 : result.allExcellent ? 2 : result.fullCombo ? 1 : 0) : 0,
      j: result && result.judgments ? RHYTHM_MULTI_JUDGMENT_IDS.map((id) => result.judgments[id]) : null,
      fs: result && result.fast, sl: result && result.slow,
    });
    c.playing = false;
    if (socket) socket.send({ t: 'res', id: c.id, res: c.res });
  };
  const stopTimers = () => {
    if (hbTimer) clearInterval(hbTimer);
    if (sweepTimer) clearInterval(sweepTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    hbTimer = sweepTimer = reconnectTimer = null;
  };
  const closeLobby = () => { if (lobby) { try { lobby.socket.close(); } catch (_) { /* 無視 */ } lobby = null; } };

  // ---- 部屋主だけが進める部屋の進行 ----
  const setRoom = (next) => { s.room = { ...s.room, ...next }; sendHb(); emit(); };
  // 部屋にいる「人」の数(呼んだマスモン=CPU は数えない)。自分ひとりのときは、曲えらびの制限時間を進めない
  // (2026-10-07・ユーザー指示「人間がいないときは曲選びの時間制限を進めなくして」)。deadline が 0 のあいだは「制限時間なし」
  const humanCount = () => ordered().filter((m) => !m.cpu).length;
  // 選曲の制限時間(ミリ秒)。0 は制限なし(部屋主が「なし」にした)
  const selectLimitMs = () => (s && s.room.selectSec > 0 ? s.room.selectSec * 1000 : 0);
  const toSelect = () => setRoom({ phase: 'select', round: rhythmMultiMakeId('r'), songId: '', deadline: humanCount() <= 1 || !selectLimitMs() ? 0 : Date.now() + selectLimitMs(), participants: [] });
  const doDraw = (members) => {
    const r = s.room;
    const pickOf = (list) => list.filter((m) => m.pickRound === r.round && m.pick && m.pick !== RHYTHM_MULTI_OMAKASE && catalog.includes(m.pick)).map((m) => m.pick);
    // 本番の曲は人の選んだ曲だけから決める。相棒(CPU)の選曲は演出(シャッフル画面の表示)だけで、抽選には入れない
    // (2026-10-07・ユーザー指示「マスモンが曲を選んでくるのは演出として残して、実際は自分が選んだ曲に」)。
    // 人がだれも曲を選んでいない(おまかせ)ときは、全曲から引く
    const picks = pickOf(members.filter((m) => !m.cpu));
    const pool = picks.length ? picks : catalog;
    if (!pool.length) return;
    const songId = pool[Math.floor(Math.random() * pool.length)];
    if (socket) socket.send({ t: 'draw', id: s.selfId, round: r.round, songId });
    setRoom({ phase: 'ready', songId, deadline: Date.now() + RHYTHM_MULTI_SHUFFLE_MS + RHYTHM_MULTI_READY_MS });
  };
  // everyone … ホストの「すぐ開始」。準備完了を押していない人も、いまえらんでいる難易度でいっしょに始める(時間切れと同じ扱い)
  const doStart = (members, everyone = false) => {
    const r = s.room;
    const participants = members.filter((m) => everyone || m.readyRound === r.round).map((m) => m.id);
    if (!participants.length) { toSelect(); return; }
    if (socket) socket.send({ t: 'start', id: s.selfId, round: r.round, songId: r.songId, participants });
    // ライブの上限時間: 曲の長さ+カウントダウンと読み込みのゆとり。過ぎても終わらない人はリタイア扱いで結果へ進む
    const songMs = Number(durations[r.songId]) > 0 ? Number(durations[r.songId]) : 240000;
    setRoom({ phase: 'playing', participants, deadline: Date.now() + songMs + RHYTHM_MULTI_PLAY_GRACE_MS });
  };
  const hostTick = () => {
    if (!s || !isHostNow() || s.status !== 'open') return;
    const members = ordered();
    const r = s.room;
    const now = Date.now();
    if (r.phase === 'matching') {
      if (members.length >= RHYTHM_MULTI_ROOM_MAX) toSelect();
      else if (s.mode !== 'private' && members.length >= 2 && now - s.lastMemberChange >= RHYTHM_MULTI_PUBLIC_MATCH_WAIT_MS) toSelect();
    } else if (r.phase === 'select') {
      if (members.length < 2) { setRoom({ phase: 'matching', deadline: 0 }); return; }
      const allPicked = members.every((m) => m.pickRound === r.round && m.pick);
      // 人がひとりだけのあいだは制限時間なし(deadline を 0 にして、全員が選ぶまで待つ)。人が入ってきたら、そこから数えはじめる
      if (humanCount() <= 1 || !selectLimitMs()) {
        if (r.deadline) { setRoom({ deadline: 0 }); return; }
        if (allPicked) doDraw(members);
        return;
      }
      if (!r.deadline) { setRoom({ deadline: now + selectLimitMs() }); return; }
      // ★締め切りのあと少しだけ(準備の猶予と同じ3秒)待つ。締め切り直前に選んだ人の選曲がまだ届いていないと、
      //   その曲が抽選から漏れ、部屋主がおまかせなら全曲から引いてしまう(2026-10-03・ユーザー指示
      //   「おまかせはみんなでの曲抽選のときは他の人のが優先されるように」)。時間切れの人は自分でおまかせを送ってくるので、
      //   ふつうはそろった時点(allPicked)で引く
      if (allPicked || now >= r.deadline + RHYTHM_MULTI_READY_GRACE_MS) doDraw(members);
    } else if (r.phase === 'ready') {
      const allReady = members.every((m) => m.readyRound === r.round);
      if (allReady || now >= r.deadline + RHYTHM_MULTI_READY_GRACE_MS) doStart(members);
    } else if (r.phase === 'playing') {
      const aliveIds = members.map((m) => m.id);
      const done = r.participants.every((id) => !aliveIds.includes(id) || (s.members[id] && s.members[id].res && s.members[id].res.startId === r.round));
      if (done || (r.deadline && now >= r.deadline)) setRoom({ phase: 'result', deadline: now + RHYTHM_MULTI_RESULT_MS });
    } else if (r.phase === 'result') {
      if (now >= r.deadline) toSelect();
    }
  };
  // だれもが自分のぶんだけ行う、時間切れの扱い(選んでいなければおまかせ・準備していなければ準備完了)
  const selfTick = () => {
    const me = selfMember();
    if (!s || !me) return;
    const r = s.room;
    if (!r.deadline || Date.now() < r.deadline) return;
    if (r.phase === 'select' && me.pickRound !== r.round) { me.pick = RHYTHM_MULTI_OMAKASE; me.pickRound = r.round; sendHb(); }
    if (r.phase === 'ready' && me.readyRound !== r.round) { me.readyRound = r.round; sendHb(); }
  };
  // 呼んだマスモンが、部屋のチャットへ一言を送る(2026-10-07・ユーザー指示「マスモンもチャットで話してくる」)。
  // セリフは cpuBrain.talk が用意したものから選ぶ。みんなが同時にしゃべらないよう、少しずらして送り、
  // 同じ子は RHYTHM_MULTI_CPU_TALK_GAP_MS あけて話す。部屋を出た・席をゆずったあとは送らない
  const cpuSay = (x, kind, vars = {}, opts = {}) => {
    if (!s || !x || !cpuBrain || typeof cpuBrain.talk !== 'function') return;
    const room = s;
    const run = () => {
      if (s !== room || !socket) return;
      const c = myCpu(x.id);
      if (!c) return;
      const now = Date.now();
      if (!opts.now && !opts.skipGap && now - (room.talk.at[x.id] || 0) < RHYTHM_MULTI_CPU_TALK_GAP_MS) return;
      let text = '';
      try { text = cpuBrain.talk({ masuId: x.masuId, kind, me: c.name, ...vars }); } catch (_) { text = ''; }
      text = rhythmMultiText(text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
      if (!text) return;
      room.talk.at[x.id] = now;
      socket.send({ t: 'chat', id: c.id, name: c.name, text, cid: `c${now.toString(36)}${Math.random().toString(36).slice(2, 7)}` });
    };
    if (opts.now) { run(); return; }
    const index = Math.max(0, s.cpus.findIndex((c) => c.id === x.id));
    setTimeout(run, 600 + Math.floor(Math.random() * 1800) + index * 900 + (opts.extraDelay || 0));
  };
  const cpuPickOne = () => (s && s.cpus.length ? s.cpus[Math.floor(Math.random() * s.cpus.length)] : null);
  // 人(自分を含む)のチャットへの返事(2026-10-08・会話らしくする)。発言の意図を cpuBrain.understand で読んで、返す。
  //   名前を呼ばれた子が返す(「みんな」なら3体まで)/ 呼ばれていなければ1体だけ、ときどき返す
  //   質問には聞き返すことがある(「調子どう?」→「{名前}さんは?」)。次の発言を、その答えとして読む(60秒のあいだ)
  //   2体以上いるときは、ときどき別の子が話に加わる。マスモンの発言には返さない(返し合いにならない)
  const cpuNameOf = (x) => (x && s.members[x.id] ? s.members[x.id].name : '');
  const cpuReplyTo = (msg) => {
    if (!s || !s.cpus.length || !msg || (s.members[msg.id] && s.members[msg.id].cpu) || s.cpus.some((c) => c.id === msg.id)) return;
    // 届くのが遅れた(演奏中にたまっていた)発言には返さない。cid の先頭に送った時刻が入っている
    const sentAt = parseInt(String(msg.cid || '').slice(1, 9), 36);
    if (Number.isFinite(sentAt) && Date.now() - sentAt > RHYTHM_MULTI_CPU_REPLY_FRESH_MS) return;
    const now = Date.now();
    const aw = s.talk.awaiting && s.talk.awaiting.from === msg.id && now < s.talk.awaiting.until ? s.talk.awaiting : null;
    let parsed = null;
    try { parsed = cpuBrain && typeof cpuBrain.understand === 'function' ? cpuBrain.understand({ text: msg.text, names: s.cpus.map(cpuNameOf), awaiting: aw ? aw.kind : '' }) : null; } catch (_) { parsed = null; }
    if (!parsed) {
      const k = typeof rhythmBuddyTalkReplyKind === 'function' ? rhythmBuddyTalkReplyKind(msg.text) : '';
      parsed = k ? { kind: k, mentioned: [], all: false, ask: '', awaits: '', answered: false, isQuestion: false, songId: '' } : null;
    }
    if (!parsed || !parsed.kind || now - s.talk.replyAt < RHYTHM_MULTI_CPU_TALK_GAP_MS) return;
    // 呼ばれた・質問された・聞き返しの答えには必ず返す。ふつうの発言にはときどき
    const direct = parsed.mentioned.length > 0 || parsed.all || parsed.isQuestion || parsed.answered || parsed.kind === 'replyCall';
    if (!direct && Math.random() > 0.6) return;
    let responders;
    if (parsed.answered && aw) responders = s.cpus.filter((c) => c.id === aw.cpuId);
    else if (parsed.mentioned.length) responders = parsed.mentioned.map((i) => s.cpus[i]).filter(Boolean);
    else if (parsed.all) responders = s.cpus.slice(0, 3);
    else { const one = cpuPickOne(); responders = one ? [one] : []; }
    if (!responders.length) return;
    s.talk.replyAt = now;
    const mateOf = (x) => cpuNameOf(s.cpus.find((c) => c.id !== x.id));
    // 会話の記憶(直近4つの話題・10分のあいだ)。「さっきの話は?」には、ひとつ前の話題を答える
    const topics = (s.talk.topics || (s.talk.topics = [])).filter((t) => now - t.at < 10 * 60 * 1000);
    let kind = parsed.kind;
    let topicVars = {};
    if (kind === 'recallAsk') {
      const prev = topics[0];
      kind = prev ? 'recall' : 'recallNone';
      topicVars = prev ? { topicKind: prev.kind, topicSongId: prev.songId || '' } : {};
    } else if (parsed.songId && kind === 'songTalk') topics.unshift({ kind: 'songTalk', songId: parsed.songId, at: now });
    else if (typeof RHYTHM_BUDDY_CONVO_TOPIC !== 'undefined' && RHYTHM_BUDDY_CONVO_TOPIC[kind] && !(topics[0] && topics[0].kind === kind)) topics.unshift({ kind, songId: '', at: now });
    s.talk.topics = topics.slice(0, 4);
    // 呼ばれた・聞かれたときの返事は、直前に話していたとしても返す(返事をしない子になってしまうため)
    responders.forEach((x, i) => cpuSay(x, kind, { who: msg.name, mate: mateOf(x), songId: parsed.songId || '', ...topicVars }, { extraDelay: i * 1300, skipGap: direct }));
    if (aw && parsed.answered) s.talk.awaiting = null;
    const first = responders[0];
    // 1つの発言に質問がふたつ入っていたら、続けてふたつ目にも答える(「調子どう?あと得意な曲は?」)
    if (parsed.extra) cpuSay(first, parsed.extra, { who: msg.name, mate: mateOf(first), songId: parsed.songId || '' }, { extraDelay: 2200, skipGap: true });
    // 聞き返す頻度は性格で変わる(甘えん坊は何度も聞き、プライドは聞かない)
    const askRate = cpuBrain && typeof cpuBrain.style === 'function' ? cpuBrain.style(first.masuId).ask : 0.6;
    if (!parsed.extra && parsed.ask && parsed.awaits && Math.random() < askRate) {
      cpuSay(first, parsed.ask, { who: msg.name }, { extraDelay: 2600, skipGap: true });
      s.talk.awaiting = { cpuId: first.id, from: msg.id, kind: parsed.awaits, until: now + RHYTHM_MULTI_CPU_AWAIT_MS };
    } else if (responders.length === 1 && s.cpus.length > 1 && now - s.talk.banterAt > RHYTHM_MULTI_CPU_BANTER_GAP_MS && Math.random() < 0.3) {
      const other = s.cpus.find((c) => c.id !== first.id);
      s.talk.banterAt = now;
      // 2体の性格の相性で、張り合ったり和やかに話したりする
      const pairKind = cpuBrain && typeof cpuBrain.pair === 'function' ? cpuBrain.pair(first.masuId, other.masuId) : 'banter';
      cpuSay(other, pairKind, { mate: cpuNameOf(first) }, { extraDelay: 3400, skipGap: true });
    }
  };
  // 場面の変わり目で話す(曲が決まった・結果が出た)。1回の場面につき1度だけ
  // 自分(呼んだ人)の名前。マスモンが名前で呼びかけるときに使う
  const ownerName = () => { const me = selfMember(); return me ? me.name : ''; };
  // 部屋の人の入室・退室・選曲への反応(2026-10-08・ユーザー指示「自分以外のプレイヤーにも反応する」)。
  // はじめて見たときは黙って覚える。通信の乱れで一瞬いなくなって戻っただけなら、あいさつし直さない
  const reactToHumans = (r) => {
    const T = s.talk;
    const humans = ordered().filter((m) => !m.cpu);
    const now = Date.now();
    if (!T.seen) { T.seen = {}; T.left = {}; T.pickSeen = {}; T.pickRound = ''; humans.forEach((m) => { T.seen[m.id] = m.name; }); return; }
    humans.forEach((m) => {
      if (T.seen[m.id]) { T.seen[m.id] = m.name; return; }
      T.seen[m.id] = m.name;
      if (T.left[m.id] && now - T.left[m.id] < 60000) return;
      if (Math.random() < 0.9) cpuSay(cpuPickOne(), 'welcome', { who: m.name }, { skipGap: true });
    });
    Object.keys(T.seen).forEach((id) => {
      if (humans.some((m) => m.id === id)) return;
      const name = T.seen[id];
      delete T.seen[id];
      T.left[id] = now;
      if (Math.random() < 0.9) cpuSay(cpuPickOne(), 'farewell', { who: name }, { skipGap: true });
    });
    // ほかの人が曲を選んだ(おまかせにした)とき、ときどき一言(自分の選曲には言わない)
    if (r.phase === 'select') {
      if (T.pickRound !== r.round) { T.pickRound = r.round; T.pickSeen = {}; }
      humans.forEach((m) => {
        if (m.id === s.selfId || m.pickRound !== r.round || !m.pick || T.pickSeen[m.id]) return;
        T.pickSeen[m.id] = 1;
        if (Math.random() >= 0.35) return;
        if (m.pick === RHYTHM_MULTI_OMAKASE) cpuSay(cpuPickOne(), 'reactOmakase', { who: m.name }, { skipGap: true });
        else cpuSay(cpuPickOne(), 'reactPick', { who: m.name, songId: m.pick }, { skipGap: true });
      });
    }
  };
  const cpuTalkTick = () => {
    if (!s || !s.cpus.length) return;
    const r = s.room;
    if (r.phase === 'ready' && r.round && s.talk.songRound !== r.round) {
      s.talk.songRound = r.round;
      if (Math.random() < 0.9) cpuSay(cpuPickOne(), 'song', { songId: r.songId });
    }
    // 待ち合わせ・曲えらびで、しばらく静かなときのひとりごと(ときどき)
    if (r.phase === 'matching' || r.phase === 'select' || r.phase === 'result') {
      const lastChat = s.chat.length ? s.chat[s.chat.length - 1].at || 0 : 0;
      if (Date.now() - Math.max(lastChat, s.talk.idleAt) > RHYTHM_MULTI_CPU_IDLE_QUIET_MS && Math.random() < 0.3) {
        s.talk.idleAt = Date.now();
        // 人がいれば、話しかけて会話をはじめる(調子・好きな曲)。聞いた相手の次の発言を、その答えとして読む
        const humans = ordered().filter((m) => !m.cpu);
        const target = humans.length ? humans[Math.floor(Math.random() * humans.length)] : null;
        const starter = cpuPickOne();
        if (target && starter && Math.random() < 0.6) {
          // 何を話しかけるかは性格で変わる(甘えん坊・のんびりは調子、真面目・賢いは得意な曲、強気な子は呼びかけ)
          const w = cpuBrain && typeof cpuBrain.style === 'function' ? cpuBrain.style(starter.masuId).starter : [1, 1, 1];
          const roll = Math.random() * (w[0] + w[1] + w[2]);
          const how = roll < w[0];
          const fav = !how && roll < w[0] + w[1];
          if (how || fav) {
            cpuSay(starter, how ? 'qHow' : 'qFav', { who: target.name });
            s.talk.awaiting = { cpuId: starter.id, from: target.id, kind: how ? 'how' : 'fav', until: Date.now() + RHYTHM_MULTI_CPU_AWAIT_MS };
          } else cpuSay(starter, 'callOut', { who: target.name });
        } else cpuSay(starter, 'idle');
      }
    }
    if (r.phase === 'result' && r.round && s.talk.resultRound !== r.round) {
      s.talk.resultRound = r.round;
      const team = rhythmMultiTeamResult(Object.values(s.members), r.round, r.participants, true);
      s.cpus.forEach((x) => {
        const row = team.rows.find((q) => q.m.id === x.id);
        if (!row || !row.res || row.res.quit) return;
        const mvp = team.mvpId === x.id;
        cpuSay(x, 'result', { score: row.res.score, diffId: row.res.diffId, mvp, who: ownerName() });
      });
      // 部屋の人(自分を含む)の結果への反応。目立つ結果(MVP・フルコン・高得点・伸びなかった・途中でやめた)にだけ、2人まで。
      // 何を言うかは cpuBrain.talk の reactResult が決める(目立たない結果なら黙る)。MVPの人は先に
      const humanRows = team.rows.filter((q) => !q.m.cpu && !q.m.gone && q.res);
      humanRows.sort((a, b) => ((b.m.id === team.mvpId ? 2 : 0) + Math.random()) - ((a.m.id === team.mvpId ? 2 : 0) + Math.random()));
      humanRows.slice(0, 2).forEach((q, i) => {
        cpuSay(s.cpus[i % s.cpus.length], 'reactResult', { who: q.m.name, score: q.res.score, diffId: q.res.diffId, mvp: team.mvpId === q.m.id, fc: q.res.fc || 0, quit: !!q.res.quit, missRate: rhythmMultiMissRate(q.res) }, { extraDelay: 1800 + i * 1500, skipGap: true });
      });
    }
    reactToHumans(r);
  };
  // 人が入って5人を超えたら、呼んだマスモンは席をゆずって帰る。使った回数・券は呼んだ側へ返す(cpuBrain.refund)
  // (CPU どうしは呼んだ順に並ぶので、あとから呼んだ子から外れる)
  const dropCpuIfBumped = () => {
    if (!s || !s.cpus.length || s.room.phase === 'playing') return;
    const kept = new Set(ordered().map((m) => m.id));
    s.cpus.filter((c) => !kept.has(c.id)).forEach((gone) => {
      cpuSay(gone, 'bump', {}, { now: true });
      delete s.members[gone.id];
      s.cpus = s.cpus.filter((c) => c.id !== gone.id);
      if (socket) socket.send({ t: 'bye', id: gone.id });
      try { if (cpuBrain && cpuBrain.refund) cpuBrain.refund(gone.masuId, gone.callId); } catch (_) { /* 返せなくても部屋は続ける */ }
    });
  };
  // 相棒は、選曲の段に入ったらすぐ選び(得意な曲)、準備の段に入ったらすぐ準備完了にする。難易度は呼んだ人と同じ
  const cpuTick = () => { if (s) s.cpus.forEach((x) => oneCpuTick(x)); };
  const oneCpuTick = (x) => {
    const c = myCpu(x.id);
    const me = selfMember();
    if (!c || !me) return;
    const r = s.room;
    let changed = false;
    if (c.diff !== me.diff) { c.diff = me.diff; changed = true; }
    if (r.phase === 'select' && c.pickRound !== r.round) {
      let pick = '';
      let why = '';
      try {
        const r = cpuBrain && cpuBrain.pick ? cpuBrain.pick(catalog, x.masuId) : '';
        if (r && typeof r === 'object') { pick = String(r.songId || ''); why = String(r.why || ''); } else pick = String(r || '');
      } catch (_) { pick = ''; why = ''; }
      c.pick = pick && catalog.includes(pick) ? pick : RHYTHM_MULTI_OMAKASE;
      c.pickWhy = c.pick === RHYTHM_MULTI_OMAKASE ? '' : why;
      c.pickRound = r.round;
      changed = true;
      if (c.pick !== RHYTHM_MULTI_OMAKASE && Math.random() < 0.9) cpuSay(x, 'pick', { songId: c.pick });
    }
    if (r.phase === 'ready' && c.readyRound !== r.round) { c.readyRound = r.round; changed = true; }
    if (changed) sendOneCpuHb(x.id);
  };
  // 空きのある公開(または解放した)部屋の部屋主だけが、受付へ「ここにいるよ」と知らせる。
  // 自分1人だけの部屋は、受付で聞こえたコードの小さい部屋へ引っ越して、バラバラの部屋を1つにまとめる
  const syncLobby = () => {
    if (!s) { closeLobby(); return; }
    const order = ordered();
    const me = selfMember();
    // 呼んだマスモンは数えない(人が来れば席をゆずる)
    const humans = order.filter((m) => !m.cpu).length;
    const want = isHostNow() && !!me && me.open && humans < RHYTHM_MULTI_ROOM_MAX
      && (s.room.phase === 'matching' || s.room.phase === 'select') && s.status === 'open';
    if (!want) { closeLobby(); return; }
    const kind = s.mode === 'veteran' ? 'veteran' : 'free';
    if (lobby && lobby.kind !== kind) closeLobby();
    if (!lobby) {
      const rooms = {};
      lobby = {
        kind, rooms, lastAnnounce: 0,
        socket: rhythmMultiOpenSocket({
          topic: RHYTHM_MULTI_LOBBY_TOPIC + kind,
          onOpen: () => {},
          onMessage: (raw) => { const n = rhythmMultiCleanRoomNotice(raw); if (n) rooms[n.code] = { n: n.n, seen: Date.now() }; },
          onClose: () => {},
        }),
      };
    }
    if (Date.now() - lobby.lastAnnounce >= RHYTHM_MULTI_LOBBY_ANNOUNCE_MS) {
      lobby.lastAnnounce = Date.now();
      lobby.socket.send({ t: 'room', code: s.code, n: humans });
    }
    // ★最近ほかの人を見ていた部屋はまとめない。ライブ中の人は何も送ってこないので、自分1人に見えても
    //   実はほかの人が演奏しているだけかもしれない(そこで引っ越すと、戻ってきた仲間とはぐれる)
    const recentlySawOthers = Object.values(s.members).some((m) => m.id !== s.selfId && Date.now() - m.seen < RHYTHM_MULTI_MERGE_QUIET_MS);
    if (order.length === 1 && !s.cpus.length && s.mode !== 'private' && !recentlySawOthers && Date.now() - s.createdAt > RHYTHM_MULTI_LOBBY_LISTEN_MS) {
      const other = rhythmMultiBestRoom(lobby.rooms, s.code);
      if (other && other < s.code) {
        api.join(other, { name: me.name, level: me.level, icon: me.icon, frame: me.frame, diff: me.diff }, s.mode);
      }
    }
  };
  const sweep = () => {
    if (!s) return;
    const me = selfMember();
    // 演奏中は、演奏の判定と描画に余計な仕事を割り込ませないよう、点検と画面更新を止める
    if (me && me.playing) return;
    const sig = ordered().map((m) => m.id).join(',');
    if (sig !== s.memberSig) { s.memberSig = sig; s.lastMemberChange = Date.now(); }
    selfTick();
    dropCpuIfBumped();
    cpuTick();
    cpuTalkTick();
    hostTick();
    if (s) syncLobby();
    emit();
  };
  const onMessage = (raw) => {
    if (!s) return;
    // 演奏中は、届いた知らせを処理せずに溜めておく(演奏の判定と描画に一切割り込ませない)。
    // 演奏が終わったら reportResult がまとめて処理する。溜めすぎないよう古いものから捨てる
    const playingNow = selfMember();
    if (playingNow && playingNow.playing) {
      s.queue.push(raw);
      if (s.queue.length > RHYTHM_MULTI_QUEUE_MAX) s.queue.shift();
      return;
    }
    const msg = rhythmMultiCleanMessage(raw);
    if (!msg) return;
    if (msg.t === 'bye') { delete s.members[msg.id]; emit(); return; }
    if (msg.t === 'chat') {
      // 同じ発言(cid)は2度出さない。覚えておくのは直近だけ(保存はしない)
      if (!s.chat.some((c) => c.cid === msg.cid)) {
        s.chat.push({ cid: msg.cid, id: msg.id, name: msg.name, text: msg.text, at: Date.now() });
        if (s.chat.length > RHYTHM_MULTI_CHAT_KEEP) s.chat.splice(0, s.chat.length - RHYTHM_MULTI_CHAT_KEEP);
        cpuReplyTo(msg);
      }
      emit();
      return;
    }
    const fromHost = () => { const o = ordered(); return o.length > 0 && o[0].id === msg.id; };
    const prev = s.members[msg.id] || { id: msg.id, name: '', level: 0, joinedAt: 0, icon: '', frame: '', pick: '', pickRound: '', readyRound: '', diff: '', playing: false, open: false, res: null };
    if (msg.t === 'hb') {
      // 自分の状態は自分が持っているものが正しいので、自分の知らせでは上書きしない
      if (msg.id === s.selfId || myCpu(msg.id)) { prev.seen = Date.now(); emit(); return; }
      s.members[msg.id] = {
        ...prev, name: msg.name, level: msg.level, joinedAt: msg.joinedAt, icon: msg.icon, frame: msg.frame, bid: msg.bid,
        pick: msg.pick, pickRound: msg.pickRound, readyRound: msg.readyRound, diff: msg.diff, playing: msg.playing,
        open: msg.open, res: msg.res || prev.res, seen: Date.now(),
        cpu: msg.cpu, owner: msg.owner || '', mb: msg.mb || '', mc: msg.mc || [], pickWhy: msg.pw || '',
      };
      // 部屋の進行は部屋主の知らせに従う(残り時間は受け取った時刻から数える)
      if (msg.room && fromHost()) {
        const r = msg.room;
        s.room = { phase: r.phase, round: r.round, songId: r.songId, participants: r.participants, selectSec: r.selectSec, deadline: r.hasDeadline ? Date.now() + r.left * 1000 : 0 };
      }
    } else if (msg.t === 'res') {
      if (myCpu(msg.id)) { emit(); return; }
      s.members[msg.id] = { ...prev, res: msg.res, playing: false, seen: Date.now() };
    } else if (msg.t === 'draw') {
      if (fromHost() && s.room.round === msg.round) s.room = { ...s.room, phase: 'ready', songId: msg.songId, deadline: Date.now() + RHYTHM_MULTI_SHUFFLE_MS + RHYTHM_MULTI_READY_MS };
    } else if (msg.t === 'start') {
      // ライブ開始の合図は、部屋主から出たものだけ受ける。同じ合図は2度受けない
      if (fromHost() && s.startedRound !== msg.round) {
        s.startedRound = msg.round;
        s.room = { ...s.room, phase: 'playing', round: msg.round, songId: msg.songId, participants: msg.participants, deadline: 0 };
        // ライブに入った人は、ここから演奏が終わるまで何も送ってこない。抜けた扱いにしない期限を、曲の長さから決めておく
        const songMs = Number(durations[msg.songId]) > 0 ? Number(durations[msg.songId]) : 240000;
        s.playUntil = Date.now() + songMs + RHYTHM_MULTI_PLAY_GRACE_MS;
        msg.participants.forEach((pid) => { if (s.members[pid]) s.members[pid].playing = true; });
        s.cpus.forEach((c) => { if (s.members[c.id]) s.members[c.id].res = null; });
        // 呼んだマスモンが1曲目に入った: その1回は使った扱い(部屋を出ても返さない。2026-10-09・ユーザー指示「1曲も始まらなければ返す」)
        s.cpus.filter((c) => msg.participants.includes(c.id)).forEach((c) => { try { if (cpuBrain && cpuBrain.started) cpuBrain.started(c.masuId, c.callId); } catch (_) { /* 印が付けられなくても部屋は続ける */ } });
        const me = selfMember();
        if (me && msg.participants.includes(s.selfId)) {
          me.playing = true; me.res = null;
          const kept = s.liveIds.length > 0 && s.liveIds.every((pid) => msg.participants.includes(pid));
          s.liveStreak = kept ? s.liveStreak + 1 : 1;
          s.liveIds = msg.participants.slice();
          // 報酬の人数ボーナスは、人と呼んだマスモン(CPU)で分けて数える(rhythmMultiRewardScale)
          const cpus = msg.participants.filter((pid) => s.members[pid] && s.members[pid].cpu).length;
          startListeners.forEach((fn) => { try { fn({ round: msg.round, songId: msg.songId, count: msg.participants.length, cpus, streak: s.liveStreak }); } catch (_) { /* 無視 */ } });
        }
        // 「ライブに入った」を1回だけ知らせて、そこからは演奏が終わるまで送らない
        sendHb(true);
        // 自分は参加しないライブに相棒だけが入ったときは、相棒の結果をすぐ出す(自分の演奏の終わりを待てない)
        if (!msg.participants.includes(s.selfId)) s.cpus.filter((c) => msg.participants.includes(c.id)).forEach((c) => reportOneCpuResult(msg.round, c));
      }
    }
    emit();
  };
  const connect = () => {
    if (!s) return;
    s.status = 'connecting';
    emit();
    socket = rhythmMultiOpenSocket({
      topic: RHYTHM_MULTI_ROOM_TOPIC + s.code,
      onOpen: () => { if (!s) return; s.status = 'open'; sendHb(); emit(); },
      onMessage,
      onClose: () => {
        if (!s) return;
        s.status = 'reconnecting';
        emit();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (s) { if (socket) socket.close(); connect(); } }, 2500);
      },
    });
  };
  const api = {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onStart(fn) { startListeners.add(fn); return () => startListeners.delete(fn); },
    setCpuBrain(brain) { cpuBrain = brain && typeof brain === 'object' ? brain : null; },
    // いまマスモンを呼べるか(満員でない・ライブ中でない)。1人で何体でも呼べる(回数・券は呼ぶ側が数える。2026-10-07・ユーザー指示)
    canSummon() {
      if (!s || s.status !== 'open') return false;
      return ordered().length < RHYTHM_MULTI_ROOM_MAX && s.room.phase !== 'playing';
    },
    // 相棒を呼ぶ。buddy = { masuId, name, level, baseId, colors }。回数・セッション券は呼ぶ側が先に数える
    summon(buddy) {
      if (!this.canSummon() || !buddy) return false;
      const me = selfMember();
      const id = rhythmMultiMakeId('c');
      const masuId = rhythmMultiText(buddy.masuId, 80);
      if (s.cpus.some((c) => c.masuId === masuId)) return false; // 同じ子は2体呼べない
      s.cpus.push({ id, masuId, callId: rhythmMultiText(buddy.callId, 40) });
      s.members[id] = {
        id, cpu: true, owner: s.selfId, name: rhythmMultiText(buddy.name, 12) || 'マスモン', level: rhythmMultiInt(buddy.level, 9999),
        mb: rhythmMultiText(buddy.baseId, 40).replace(/[^A-Za-z0-9_-]/g, ''),
        mc: Array.isArray(buddy.colors) ? buddy.colors.slice(0, 8).map((c) => rhythmMultiText(c, 24).replace(/[^A-Za-z0-9_#:-]/g, '')) : [],
        icon: '', frame: '', bid: '', joinedAt: Math.max(Date.now(), me ? me.joinedAt + 1 : 0),
        pick: '', pickRound: '', readyRound: '', diff: me ? me.diff : '', playing: false, open: false, res: null, seen: Date.now(),
      };
      oneCpuTick(s.cpus[s.cpus.length - 1]);
      sendOneCpuHb(id);
      cpuSay(s.cpus[s.cpus.length - 1], 'join', { who: ownerName() });
      emit();
      return true;
    },
    // いま自分が呼んでいるマスモン(呼んだ順)
    myBuddies() { return s ? s.cpus.filter((c) => s.members[c.id]).map((c) => ({ id: c.id, masuId: c.masuId, res: s.members[c.id].res })) : []; },
    setCatalog(songIds, songDurations) {
      catalog = Array.isArray(songIds) ? songIds.slice() : [];
      durations = songDurations && typeof songDurations === 'object' ? { ...songDurations } : {};
    },
    // 画面へ見せる形に直して返す。毎回新しい値を返すので、呼ぶ側は emit のたびに作り直してよい
    view() {
      if (!s) return null;
      const all = rhythmMultiSortMembers(alive());
      const selfIndex = all.findIndex((m) => m.id === s.selfId);
      const r = s.room;
      return {
        code: s.code, mode: s.mode, status: s.status, selfId: s.selfId,
        members: all.slice(0, RHYTHM_MULTI_ROOM_MAX),
        hostId: all.length ? all[0].id : s.selfId,
        full: selfIndex >= RHYTHM_MULTI_ROOM_MAX,
        room: { ...r, left: r.deadline ? Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)) : 0 },
        shuffleShown: s.shuffleShown,
        resultSeen: s.resultSeen,
        chat: s.chat.slice(),
        streak: s.liveStreak,
        // 自分が呼んだマスモン(呼んだ順)。{ id, masuId }
        myCpus: s.cpus.map((c) => ({ id: c.id, masuId: c.masuId })),
      };
    },
    join(code, profile, mode) {
      loadSelectSecPref();
      this.leave();
      const now = Date.now();
      const id = rhythmMultiMakeId();
      const roomMode = RHYTHM_MULTI_MODES.includes(mode) ? mode : 'private';
      s = {
        code, mode: roomMode, status: 'connecting', selfId: id, members: {}, chat: [], lastChatAt: 0, createdAt: now,
        room: { phase: 'matching', round: '', songId: '', deadline: 0, participants: [], selectSec: selectSecPref },
        memberSig: '', lastMemberChange: now, startedRound: '', shuffleShown: '', resultSeen: '', queue: [], playUntil: 0,
        // 続けて遊んだライブの数(連続ボーナス)。前のライブの参加者が全員またいれば1つ増やす。
        // メンバーが増えただけなら続く(2026-10-03・ユーザー指示「メンバーが増える側のときはボーナス継続がいい」)。だれかが抜けたら1に戻る
        liveIds: [], liveStreak: 0,
        // 自分が呼んだマスモン(CPU)の一覧 [{ id, masuId }]。部屋を出たら消える(呼んだ1回ぶんはそこで使い切り)
        cpus: [],
        // 呼んだマスモンのおしゃべり(最後に話した時刻・場面ごとに1回だけ話すための印)
        talk: { at: {}, songRound: '', resultRound: '', replyAt: 0, idleAt: now, awaiting: null, banterAt: 0, topics: [] },
      };
      s.members[id] = {
        id, name: rhythmMultiText(profile && profile.name, 12) || '名無しのブリーダー', level: rhythmMultiInt(profile && profile.level, 9999),
        icon: rhythmMultiText(profile && profile.icon, 60), frame: rhythmMultiText(profile && profile.frame, 40),
        bid: rhythmMultiText(profile && profile.bid, 64).replace(/[^A-Za-z0-9_-]/g, ''),
        joinedAt: now, pick: '', pickRound: '', readyRound: '', diff: rhythmMultiText(profile && profile.diff, 20), playing: false,
        // フリー/ベテランの部屋は、はじめから公開(空きがあるあいだ受付へ知らせる)。プライベートは「ルーム解放」を押したときだけ
        open: roomMode !== 'private', res: null, seen: now,
      };
      connect();
      // 演奏中は sendHb が何も送らない(演奏中の通信は止める)
      hbTimer = setInterval(() => sendHb(), RHYTHM_MULTI_HEARTBEAT_MS);
      sweepTimer = setInterval(sweep, 1000);
      emit();
    },
    leave() {
      // 呼んだマスモンも一緒に帰る。1曲も始まっていない子は、呼ぶ側(cpuBrain.ended)が払ったものを返す
      if (s) s.cpus.forEach((c) => { try { if (cpuBrain && cpuBrain.ended) cpuBrain.ended(c.masuId, c.callId); } catch (_) { /* 返せなくても抜ける */ } });
      if (socket) {
        try { socket.send({ t: 'bye', id: s && s.selfId }); if (s) s.cpus.forEach((c) => socket.send({ t: 'bye', id: c.id })); } catch (_) { /* 無視 */ }
        socket.close();
      }
      socket = null;
      closeLobby();
      stopTimers();
      s = null;
      emit();
    },
    // フリー/ベテランの部屋さがし。空きのある部屋のコードを返す(無ければ null)。呼ぶ側が見つからなければ自分で部屋を作る
    findRoom(kind) {
      return new Promise((resolve) => {
        const rooms = {};
        const sock = rhythmMultiOpenSocket({
          topic: RHYTHM_MULTI_LOBBY_TOPIC + (kind === 'veteran' ? 'veteran' : 'free'),
          onOpen: () => {},
          onMessage: (raw) => { const n = rhythmMultiCleanRoomNotice(raw); if (n) rooms[n.code] = { n: n.n, seen: Date.now() }; },
          onClose: () => {},
        });
        setTimeout(() => { sock.close(); resolve(rhythmMultiBestRoom(rooms, '')); }, RHYTHM_MULTI_LOBBY_LISTEN_MS);
      });
    },
    // フリーマッチの受付を聞いて、いま人を待っている部屋の人数を数える(モードえらびの「いま◯人が待っています」・2026-10-03)。
    // 部屋主が2秒ごとに知らせる「ここにいるよ」を、最近8秒ぶんだけ数える。onCount(人数, 部屋数) を1秒ごとに呼ぶ。止める関数を返す
    watchLobby(kind, onCount) {
      const rooms = {};
      const sock = rhythmMultiOpenSocket({
        topic: RHYTHM_MULTI_LOBBY_TOPIC + (kind === 'veteran' ? 'veteran' : 'free'),
        onOpen: () => {},
        onMessage: (raw) => { const n = rhythmMultiCleanRoomNotice(raw); if (n) rooms[n.code] = { n: n.n, seen: Date.now() }; },
        onClose: () => {},
      });
      const tick = () => {
        const now = Date.now();
        let people = 0; let count = 0;
        Object.keys(rooms).forEach((code) => { if (now - rooms[code].seen > 8000) { delete rooms[code]; return; } people += rooms[code].n; count += 1; });
        try { onCount(people, count); } catch (_) { /* 無視 */ }
      };
      const timer = setInterval(tick, 1000);
      return () => { clearInterval(timer); try { sock.close(); } catch (_) { /* 無視 */ } };
    },
    // 部屋主の「メンバー確定」(プライベートルーム)。2人以上いるときだけ
    confirmMembers() {
      if (!s || !isHostNow() || s.room.phase !== 'matching' || ordered().length < 2) return false;
      toSelect();
      return true;
    },
    // 選曲。曲の id か、おまかせ(RHYTHM_MULTI_OMAKASE)。抽選が始まるまでは選び直せる
    pick(songId) {
      const me = selfMember();
      if (!me || s.room.phase !== 'select') return;
      me.pick = songId === RHYTHM_MULTI_OMAKASE ? RHYTHM_MULTI_OMAKASE : rhythmMultiText(songId, 60);
      me.pickRound = s.room.round;
      sendHb(); emit();
    },
    setDiff(difficultyId) {
      const me = selfMember();
      if (!me) return;
      me.diff = rhythmMultiText(difficultyId, 20);
      sendHb(); emit();
    },
    // 準備完了(本家と同じく取り消しはできない)
    ready() {
      const me = selfMember();
      if (!me || s.room.phase !== 'ready') return;
      me.readyRound = s.room.round;
      sendHb(); emit();
    },
    // 「ルーム解放」。プライベートの部屋を、知らない人にも開く
    setOpen(open) {
      const me = selfMember();
      if (!me) return;
      me.open = open === true;
      sendHb(); syncLobby(); emit();
    },
    markShuffleShown(round) { if (s) { s.shuffleShown = round; emit(); } },
    // 結果画面の「次へ」。ホストが押したら、まだライブ中の人がいても待たずに次の選曲へ進める
    // (途中で抜けた人がいて先へ進めなくなる、を防ぐ。2026-10-03・ユーザー報告)
    nextFromResult(round) {
      if (!s) return;
      s.resultSeen = round;
      if (isHostNow() && (s.room.phase === 'result' || s.room.phase === 'playing') && s.room.round === round) toSelect();
      emit();
    },
    // 部屋主が選曲の制限時間を決める(30秒・60秒・90秒・なし)。ほかの人には部屋主の知らせで伝わる。
    // 選曲の最中に変えたら、いまの残り時間もその場から数え直す(なし にしたら、すぐ制限なしになる)
    setSelectSeconds(sec) {
      if (!s || !isHostNow() || s.status !== 'open') return false;
      const next = rhythmMultiNormalizeSelectSec(sec);
      selectSecPref = next;
      s.selectSecTouched = true;
      try { void Promise.resolve(storeSet(RHYTHM_MULTI_SELECT_SEC_KEY, next)).catch(() => {}); } catch (_) { /* 残せなくても部屋は続ける */ }
      if (s.room.phase === 'select') setRoom({ selectSec: next, deadline: next > 0 && humanCount() > 1 ? Date.now() + next * 1000 : 0 });
      else setRoom({ selectSec: next });
      return true;
    },
    // ホストの「待たずに進む」。マッチング → 選曲 → シャッフル → ライブ開始 を、時間を待たずに1段進める
    hostAdvance() {
      if (!s || !isHostNow() || s.status !== 'open') return false;
      const members = ordered();
      const ph = s.room.phase;
      if (ph === 'matching') { if (members.length < 2) return false; toSelect(); return true; }
      if (ph === 'select') { doDraw(members); return true; }
      if (ph === 'ready') {
        // 自分がまだ準備完了でなければ、いまの難易度で準備完了にしてから始める
        const me = selfMember();
        if (me && me.readyRound !== s.room.round) me.readyRound = s.room.round;
        doStart(members, true);
        return true;
      }
      return false;
    },
    // 曲が終わった(または途中でやめた)ときに、自分のスコアを部屋へ知らせる。同じ回の2度目は無視する。
    // 途中でやめたことが公開ルームで起きたら、しばらく公開ルームへ入れなくする(opts.noPenalty で外せる)
    reportResult(round, result, quit, opts) {
      const me = selfMember();
      if (!me || !round) return;
      if (me.res && me.res.startId === round) return;
      me.res = rhythmMultiCleanResult({
        startId: round, score: result && result.score, maxCombo: result && result.maxCombo,
        cleared: result ? result.cleared !== false : false, quit: quit === true, diffId: opts && opts.diffId,
        fc: result && result.cleared !== false ? (result.allMarvelous ? 3 : result.allExcellent ? 2 : result.fullCombo ? 1 : 0) : 0,
        j: result && result.judgments ? RHYTHM_MULTI_JUDGMENT_IDS.map((id) => result.judgments[id]) : null,
        fs: result && result.fast, sl: result && result.slow,
      });
      me.playing = false;
      // 演奏中に溜めておいた知らせを、ここでまとめて処理する
      const queued = s.queue;
      s.queue = [];
      queued.forEach((raw) => onMessage(raw));
      if (!s) return;
      if (quit === true && !(opts && opts.noPenalty) && s.mode !== 'private') void rhythmMultiPenaltyMark();
      if (socket) socket.send({ t: 'res', id: s.selfId, res: me.res });
      // 呼んだ相棒の結果も、自分の演奏が終わったこの場で出す(やめたときも、相棒は最後まで演奏した扱い)
      reportCpuResult(round);
      sendHb(); emit();
    },
    // 呼んだマスモンが結果で育ったとき(ビートLvが上がった・性格が決まった)、本人が一言祝う
    noteBuddyGrowth(masuId, growth) {
      if (!s || !growth) return;
      const x = s.cpus.find((c) => c.masuId === masuId);
      if (!x) return;
      if (growth.levelUp > 0) cpuSay(x, 'lvUp', { who: ownerName() }, { extraDelay: 800, skipGap: true });
      if (growth.traitNew) cpuSay(x, 'traitNew', { who: ownerName() }, { extraDelay: growth.levelUp > 0 ? 3000 : 800, skipGap: true });
    },
    // 部屋のチャット。自分の発言も部屋からの返りで表示する(=相手にも届いたと分かる)。続けて送るのは受けない
    sendChat(text) {
      if (!s || !socket) return false;
      const clean = rhythmMultiText(text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
      const me = selfMember();
      if (!clean || !me || Date.now() - s.lastChatAt < RHYTHM_MULTI_CHAT_INTERVAL_MS) return false;
      s.lastChatAt = Date.now();
      return socket.send({ t: 'chat', id: s.selfId, name: me.name, text: clean, cid: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` });
    },
    hasReported(round) { const me = selfMember(); return !!(me && me.res && me.res.startId === round); },
    // 自分が選んだ難易度(演奏の結果へ添える)
    myDiff() { const me = selfMember(); return me ? me.diff : ''; },
  };
  return api;
})();

// ---- 対戦の記録(2026-10-03・ユーザー指示「一緒に遊んだ記録」) ----
// 新しい保存キー。ライブの回数・MVPの回数・いちばん高いチームの平均・いちばん長い連続・最近30回ぶん。
// 読むときは必ず rhythmMultiNormalizeRecord を通す(無い・壊れているときは0から)。同じ回(round)は2度数えない
const RHYTHM_MULTI_RECORD_KEY = 'mh_rhythm_multi_record_v1';
const RHYTHM_MULTI_RECORD_RECENT_MAX = 30;
const rhythmMultiNormalizeRecord = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const int = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : 0);
  const recent = (Array.isArray(o.recent) ? o.recent : []).filter((x) => x && typeof x === 'object').slice(0, RHYTHM_MULTI_RECORD_RECENT_MAX).map((x) => ({
    at: int(x.at), round: rhythmMultiText(x.round, 40), songId: rhythmMultiText(x.songId, 60),
    avg: int(x.avg), score: int(x.score), n: Math.min(RHYTHM_MULTI_ROOM_MAX, Math.max(1, int(x.n) || 1)), streak: Math.max(1, int(x.streak) || 1),
    mvp: x.mvp === true, quit: x.quit === true,
    names: (Array.isArray(x.names) ? x.names : []).slice(0, RHYTHM_MULTI_ROOM_MAX - 1).map((n) => rhythmMultiText(n, 12)).filter(Boolean),
  }));
  return { lives: int(o.lives), mvp: int(o.mvp), bestAvg: int(o.bestAvg), bestStreak: int(o.bestStreak), lastRound: rhythmMultiText(o.lastRound, 40), recent };
};
const rhythmMultiAddRecord = (record, entry) => {
  const rec = rhythmMultiNormalizeRecord(record);
  if (!entry || !entry.round || rec.lastRound === entry.round || rec.recent.some((x) => x.round === entry.round)) return rec;
  const one = rhythmMultiNormalizeRecord({ recent: [entry] }).recent[0];
  return {
    lives: rec.lives + 1, mvp: rec.mvp + (one.mvp ? 1 : 0), bestAvg: Math.max(rec.bestAvg, one.avg), bestStreak: Math.max(rec.bestStreak, one.streak),
    lastRound: one.round, recent: [one, ...rec.recent].slice(0, RHYTHM_MULTI_RECORD_RECENT_MAX),
  };
};

const useRhythmMultiView = () => {
  const [view, setView] = React.useState(() => RHYTHM_MULTI.view());
  React.useEffect(() => {
    const refresh = () => setView(RHYTHM_MULTI.view());
    refresh();
    return RHYTHM_MULTI.subscribe(refresh);
  }, []);
  return view;
};

// 抽選された曲に、自分の希望の難易度が無いときは、希望より易しい中でいちばん難しいものへ(無ければ最も易しいもの)
const rhythmMultiPickDifficulty = (available, wishId, orderIds) => {
  if (!available.length) return null;
  const exact = available.find((d) => d.id === wishId);
  if (exact) return exact;
  const rank = (id) => orderIds.indexOf(id);
  const want = rank(wishId);
  const lower = available.filter((d) => rank(d.id) < want).sort((a, b) => rank(b.id) - rank(a.id));
  if (lower.length) return lower[0];
  return available.slice().sort((a, b) => rank(a.id) - rank(b.id))[0];
};

// ---- 画面 ----
// 部屋の中の状態は React の外(RHYTHM_MULTI)にあるので、画面を行き来しても部屋は切れない。
// チャット欄(2026-10-03・ユーザー指摘「チャットが使いにくい」で作り直し)。
// 上に見出しと✕、真ん中に発言の一覧(高さいっぱい)、下に定型文(折り返して全部見せる)と入力欄
function RhythmMultiChatPanel({ view, phase = '', members = [], resolveIconUrl = null, onClose = null, talkTip = '', onTalkTipClose = null, askName = '' }) {
  const [chatText, setChatText] = React.useState('');
  const [waitNote, setWaitNote] = React.useState(false);
  const listRef = React.useRef(null);
  const count = view && view.chat ? view.chat.length : 0;
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  // 続けて押したときは「少し待ってね」を出す(送れなかったことが分からないと、何度も押してしまう)
  const send = (text) => {
    const ok = RHYTHM_MULTI.sendChat(text);
    setWaitNote(!ok && !!String(text || '').trim());
    return ok;
  };
  const submit = () => { if (send(chatText)) setChatText(''); };
  const memberOf = (id) => members.find((m) => m.id === id) || null;
  return (
    <section data-rhythm-multi-chat className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 pb-1.5">
        <h3 className="min-w-0 flex-1 text-sm font-black text-cyan-100">💬 チャット<small className="ml-1.5 text-[10px] font-bold text-slate-400">ルームの{count}件</small></h3>
        {onClose && <button data-rhythm-multi-chat-close type="button" aria-label="チャットを閉じる" onClick={onClose} className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 text-lg font-black text-slate-200">✕</button>}
      </div>
      {talkTip && (
        <div data-rhythm-buddy-talk-tip className="mb-1.5 flex shrink-0 items-start gap-2 rounded-xl border border-lime-300/50 bg-lime-950/80 p-2 landscape:p-1.5">
          <span aria-hidden="true" className="text-lg leading-none">🎵</span>
          <p className="min-w-0 flex-1 text-[11px] font-black leading-snug text-lime-100 landscape:line-clamp-2 landscape:text-[10px]">呼んだマスモンに話しかけてみよう。「{talkTip}、調子どう?」のように名前を付けて聞くと、そのマスモンの本当の調子で答えます。「みんな」と呼ぶと全員が返します</p>
          {onTalkTipClose && <button type="button" aria-label="案内を閉じる" onClick={onTalkTipClose} className="min-h-[36px] min-w-[36px] shrink-0 rounded-lg bg-slate-800 text-sm font-black">✕</button>}
        </div>
      )}
      {/* LINE のように、自分の発言は右、ほかの人は左(顔アイコンつき) */}
      <ul ref={listRef} data-rhythm-multi-chat-list className="min-h-[6rem] flex-1 space-y-1.5 overflow-y-auto rounded-xl bg-slate-950/70 p-2 text-[15px] font-bold">
        {count === 0 && <li className="text-[12px] text-slate-500">まだ発言はありません。下の定型文をタップすると、すぐに送れます</li>}
        {view.chat.map((c) => {
          const mine = c.id === view.selfId;
          const m = memberOf(c.id);
          return (
            <li key={c.cid} data-rhythm-multi-chat-line className={`flex items-end gap-1.5 ${mine ? 'justify-end' : ''}`}>
              {!mine && (m
                ? <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-8 w-8 shrink-0" />
                : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs">🎵</span>)}
              <span className={`flex min-w-0 max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && <b className="max-w-full truncate text-[10px] text-amber-200">{c.name}</b>}
                <span className={`break-words rounded-2xl px-3 py-1.5 leading-snug ${mine ? 'rounded-br-sm bg-cyan-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-900'}`}>{c.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {/* 「マスモンに聞く」札と定型文。縦は高さを抑えて中だけ上下にすべらせ、横向きは1行で横にすべらせる
          (チャットの発言と自由入力の欄を押しつぶさない。2026-10-08・ユーザー報告「定型文のゾーンが動かせず、下の自由入力が出せない」) */}
      <div data-rhythm-multi-chat-quick className="mt-2 flex max-h-[8.5rem] shrink-0 flex-col gap-2 overflow-y-auto landscape:max-h-none landscape:flex-row landscape:items-center landscape:gap-1.5 landscape:overflow-x-auto landscape:overflow-y-hidden landscape:[scrollbar-width:none]">
        {askName && (
          <div data-rhythm-buddy-ask className="flex shrink-0 flex-wrap items-center gap-1.5 landscape:flex-nowrap">
            <b className="shrink-0 text-[10px] font-black text-lime-300">🎵 {askName}に聞く</b>
            {RHYTHM_BUDDY_ASK_CHIPS.map((chip) => (
              <button key={chip.label} data-rhythm-buddy-ask-chip type="button" onClick={() => send(`${askName}、${chip.text}`)}
                className="min-h-[34px] shrink-0 whitespace-nowrap rounded-full border border-lime-300/50 bg-lime-950/70 px-2.5 text-[11px] font-black text-lime-100 transition active:scale-95">{chip.label}</button>
            ))}
          </div>
        )}
        <RhythmMultiStampBar phase={phase} onSend={send} wrap limit={10} className="shrink-0 landscape:flex-nowrap" />
      </div>
      {waitNote && <small data-rhythm-multi-chat-wait className="mt-1 block shrink-0 text-[11px] font-black text-amber-300">続けて送るときは、少し待ってね</small>}
      <form className="mt-2 flex shrink-0 gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input data-rhythm-multi-chat-input value={chatText} maxLength={RHYTHM_MULTI_CHAT_MAX_LENGTH} autoComplete="off" enterKeyHint="send"
          onChange={(e) => setChatText(e.target.value)} placeholder={`ひとこと(${RHYTHM_MULTI_CHAT_MAX_LENGTH}文字まで)`}
          className="min-h-[46px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-base font-bold text-white" />
        <button data-rhythm-multi-chat-send type="submit" disabled={!chatText.trim()} className="min-h-[46px] shrink-0 rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 px-4 text-sm font-black disabled:opacity-40">送信</button>
      </form>
    </section>
  );
}

// 定型文。wrap なら折り返して全部見せる(横にすべらせて探さなくていい)。そうでなければ横に並べてすべらせる。
// 押したら、その札が「✓ 送信」に一瞬変わる(届いたか分からないと何度も押してしまう)。続けて送れないときは「⏳」
function RhythmMultiStampBar({ phase, onSend, className = '', limit = 0, wrap = false, big = false }) {
  const stamps = rhythmMultiStampsFor(phase);
  const shown = limit > 0 ? stamps.slice(0, limit) : stamps;
  const [flash, setFlash] = React.useState(null); // { text, ok }
  React.useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(timer);
  }, [flash]);
  const press = (stamp) => { const ok = onSend(stamp) !== false; setFlash({ text: stamp, ok }); };
  return (
    <div data-rhythm-multi-stamps className={`${wrap ? 'flex flex-wrap' : 'flex overflow-x-auto pb-0.5'} gap-1.5 ${className}`} style={wrap ? undefined : { scrollbarWidth: 'none' }}>
      {shown.map((stamp) => {
        const hit = flash && flash.text === stamp;
        return (
          <button key={stamp} data-rhythm-multi-chat-stamp type="button" onClick={() => press(stamp)}
            className={`shrink-0 whitespace-nowrap rounded-full border font-black transition active:scale-95 ${big ? 'min-h-[42px] px-3.5 text-[13px]' : 'min-h-[38px] px-3 text-xs'} ${hit ? (flash.ok ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-amber-300 bg-amber-700 text-white') : 'border-white/15 bg-slate-700/90 text-white'}`}>
            {hit ? (flash.ok ? '✓ 送信' : '⏳ 少し待って') : stamp}
          </button>
        );
      })}
    </div>
  );
}


// カードの上の吹き出し(発言してから少しのあいだだけ)
function RhythmMultiChatBubble({ text }) {
  if (!text) return null;
  return (
    <span data-rhythm-multi-chat-bubble className="pointer-events-none absolute inset-x-0.5 top-3 z-40 flex justify-center">
      <span className="line-clamp-2 max-w-full break-words rounded-xl bg-white px-1.5 py-0.5 text-center text-[10px] font-black leading-tight text-slate-900 shadow-lg landscape:text-xs">{text}</span>
    </span>
  );
}

// ---- 2026-10-03・ユーザー指示「フレンド申請と待ち時間の目安」「ごほうびと記録」で足した小さな部品 ----
// 部品の中に自分の状態を持たせる(大きな画面の部品の途中で return するので、そこへ hooks を足さないため)

// フリーマッチの受付を聞いて「いま◯人が待っています」。モードえらびを開いているあいだだけ聞く
function RhythmMultiLobbyCount() {
  const [count, setCount] = React.useState(null);
  React.useEffect(() => RHYTHM_MULTI.watchLobby('free', (people) => setCount(people)), []);
  return (
    <small data-rhythm-multi-lobby-count className="block truncate text-[10px] font-black leading-tight text-slate-950/80">
      {count == null ? '待っている人を数えています…' : count > 0 ? `いま${count}人が待っています` : 'いま待っている人はいません'}
    </small>
  );
}

// フリーマッチで、しばらく自分ひとりのときの案内(人が来ないときはプライベートルームへ)
function RhythmMultiAloneHint({ alone, onLeave }) {
  const [since, setSince] = React.useState(() => Date.now());
  const [, tick] = React.useState(0);
  React.useEffect(() => { if (alone) setSince(Date.now()); }, [alone]);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  if (!alone || Date.now() - since < RHYTHM_MULTI_ALONE_HINT_MS) return null;
  return (
    <div data-rhythm-multi-alone-hint className="mt-1.5 rounded-xl border border-amber-300/40 bg-amber-950/40 p-2 text-[11px] font-bold leading-snug text-amber-100">
      いまはメンバーが集まりにくいようです。このまま待つか、友だちとプライベートルームで遊ぶのもおすすめです。
      {onLeave && <button type="button" onClick={onLeave} className="mt-1 block min-h-[36px] w-full rounded-lg bg-slate-700 text-[11px] font-black">モードえらびへ戻る</button>}
    </div>
  );
}

// 結果が出たら、対戦の記録へ1回ぶん足す(同じ回は2度数えない)
function RhythmMultiRecordSaver({ entry }) {
  React.useEffect(() => {
    if (!entry || !entry.round) return;
    let alive = true;
    (async () => {
      try {
        const saved = await storeGet(RHYTHM_MULTI_RECORD_KEY, null);
        if (!alive) return;
        const next = rhythmMultiAddRecord(saved, entry);
        if (next.lastRound === entry.round) await storeSet(RHYTHM_MULTI_RECORD_KEY, next);
      } catch (_) { /* 記録できなくても対戦は続ける */ }
    })();
    return () => { alive = false; };
  }, [entry && entry.round]);
  return null;
}

// 対戦の記録(モードえらびの「記録」から開く)
function RhythmMultiRecordSheet({ songName, onClose }) {
  const [rec, setRec] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    (async () => { const saved = await storeGet(RHYTHM_MULTI_RECORD_KEY, null).catch(() => null); if (alive) setRec(rhythmMultiNormalizeRecord(saved)); })();
    return () => { alive = false; };
  }, []);
  const date = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const rank = rec && rec.bestAvg > 0 && typeof rhythmRankForScore === 'function' ? rhythmRankForScore(rec.bestAvg) : '—';
  return (
    <div className="absolute inset-0 z-[85000]">
      <button type="button" aria-label="記録を閉じる" className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div data-rhythm-multi-record className="absolute inset-x-0 bottom-0 flex h-[82%] flex-col rounded-t-2xl border-t border-cyan-400/40 bg-slate-900 p-3 shadow-2xl landscape:inset-y-0 landscape:left-auto landscape:right-0 landscape:h-full landscape:w-[55%] landscape:rounded-none landscape:rounded-l-2xl" style={{ paddingBottom: 'calc(.6rem + var(--mh-sa-bottom))' }}>
        <div className="flex shrink-0 items-center gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-black text-cyan-100">📜 みんなで対戦の記録</h3>
          <button type="button" aria-label="閉じる" onClick={onClose} className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 text-lg font-black">✕</button>
        </div>
        {!rec ? <p className="mt-3 text-xs font-bold text-slate-400">読み込んでいます…</p> : <>
          <div className="mt-2 grid shrink-0 grid-cols-4 gap-1.5 text-center">
            {[['ライブ', `${rec.lives}回`], ['MVP', `${rec.mvp}回`], ['最高ランク', rank], ['最長連続', `${rec.bestStreak}曲`]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-800/80 px-1 py-1.5"><small className="block text-[9px] font-black text-slate-400">{k}</small><b className="block text-sm font-black text-white">{v}</b></div>
            ))}
          </div>
          <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
            {rec.recent.length === 0 && <li className="text-[12px] font-bold text-slate-400">まだ記録はありません。みんなで対戦を遊ぶと、ここに残ります</li>}
            {rec.recent.map((x) => (
              <li key={x.round} data-rhythm-multi-record-row className="rounded-xl bg-slate-800/70 px-2 py-1.5 text-[11px] font-bold leading-snug">
                <div className="flex items-center gap-2">
                  <small className="shrink-0 text-[10px] text-slate-400">{date(x.at)}</small>
                  <b className="min-w-0 flex-1 truncate text-white">{songName(x.songId)}</b>
                  {x.mvp && <small className="shrink-0 rounded-full bg-amber-300 px-1.5 text-[9px] font-black text-slate-950">👑 MVP</small>}
                  <b className="shrink-0 text-amber-200">{typeof rhythmRankForScore === 'function' ? rhythmRankForScore(x.avg) : ''}</b>
                </div>
                <small className="block truncate text-[10px] text-slate-400">{x.n}人{x.streak > 1 ? `・連続${x.streak}曲目` : ''}{x.names.length ? `・${x.names.join('、')}` : ''}{x.quit ? '・リタイア' : `・自分 ${x.score.toLocaleString()}`}</small>
              </li>
            ))}
          </ul>
        </>}
      </div>
    </div>
  );
}

// 結果画面でメンバーのカードを押したときのシート(名前・Lv・この曲のスコア・フレンド申請)
function RhythmMultiMemberSheet({ m, res, resolveIconUrl, friendsOn, friendSelfId, isFriend, onClose }) {
  const [state, setState] = React.useState(isFriend ? 'already' : '');
  const [busy, setBusy] = React.useState(false);
  const canAsk = friendsOn && !!friendSelfId && !!m.bid && m.bid !== friendSelfId;
  const send = async () => {
    if (!canAsk || busy) return;
    setBusy(true);
    try { setState(await sbSendFriendRequest(friendSelfId, m.bid)); } catch (_) { setState('error'); }
    setBusy(false);
  };
  const text = state && typeof FRIENDS_RESULT_TEXT !== 'undefined' && FRIENDS_RESULT_TEXT[state] ? FRIENDS_RESULT_TEXT[state][0]
    : state === 'error' ? '申請を送れませんでした。もう一度ためしてください' : '';
  return (
    <div className="absolute inset-0 z-[86000] flex items-center justify-center p-4">
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <div data-rhythm-multi-member-sheet className="relative w-full max-w-xs rounded-2xl border border-cyan-300/40 bg-slate-900 p-4 text-center shadow-2xl">
        <div className="mx-auto w-fit"><RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-16 w-16" /></div>
        <b className="mt-2 block truncate text-base font-black">{m.name}</b>
        <small className="block text-[11px] font-black text-slate-400">{m.cpu ? 'ビート' : 'ブリーダー'}Lv.{m.level}{res && !res.quit ? ` ・ この曲 ${res.score.toLocaleString()}` : ''}</small>
        {canAsk && !['already', 'accepted', 'sent', 'pending'].includes(state) && (
          <button data-rhythm-multi-friend-request type="button" disabled={busy} onClick={send} className="mt-3 min-h-[46px] w-full rounded-xl bg-gradient-to-b from-pink-500 to-fuchsia-700 text-sm font-black disabled:opacity-50">{busy ? '送っています…' : '🤝 フレンド申請'}</button>
        )}
        {m.cpu && <p data-rhythm-multi-cpu-note className="mt-3 text-[11px] font-bold leading-relaxed text-lime-200">メンバーが呼んだ、CPUのマスモンです</p>}
        {!m.cpu && !canAsk && !isFriend && <p className="mt-3 text-[11px] font-bold text-slate-400">{!friendsOn ? 'フレンド機能はいま使えません' : 'この人には、ここからはフレンド申請できません'}</p>}
        {text && <p data-rhythm-multi-friend-result className="mt-2 text-[12px] font-black text-amber-200">{text}</p>}
        <button type="button" onClick={onClose} className="mt-3 min-h-[42px] w-full rounded-xl bg-slate-700 text-sm font-black">閉じる</button>
      </div>
    </div>
  );
}

// 部屋の中で相棒(CPU)の札を押したときの窓(2026-10-09)。
// 自分が呼んだ子は、相棒の画面と同じ詳しい中身(RhythmBuddyDetail)をそのまま出す。
// ほかの人が呼んだ子は、通信で届いている分(名前・見た目・ビートLv)だけ出す。窓を開いていても部屋の流れは止めない
function RhythmMultiBuddyInfoSheet({ m, masu, songName, resolveIconUrl, onClose }) {
  const state = useRhythmBuddyState();
  const dayKey = useRhythmBuddyDayKey();
  if (masu) {
    return (
      <div className="absolute inset-0 z-[86000] flex items-end justify-center landscape:items-center">
        <button type="button" aria-label="閉じる" className="absolute inset-0 bg-slate-950/75" onClick={onClose} />
        <section data-rhythm-multi-buddy-info className="relative flex max-h-[88%] w-full max-w-md flex-col rounded-t-3xl border border-lime-300/30 bg-slate-900 p-3 shadow-2xl landscape:max-h-[92%] landscape:max-w-xl landscape:rounded-3xl" style={{ paddingBottom: 'calc(.75rem + var(--mh-sa-bottom))' }}>
          <header className="mb-2 flex shrink-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-black text-lime-200">🎵 マスモンのステータス</h3>
            <button data-rhythm-multi-buddy-info-close type="button" aria-label="閉じる" onClick={onClose} className="min-h-[40px] min-w-[40px] rounded-full bg-slate-800 text-lg font-black">✕</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RhythmBuddyDetail masu={masu} mon={state.mons[masu.id]} dayKey={dayKey} songName={songName} onBack={null} />
          </div>
          <button type="button" onClick={onClose} className="mt-2 min-h-[44px] w-full shrink-0 rounded-xl bg-slate-700 text-sm font-black">閉じる</button>
        </section>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-[86000] flex items-center justify-center p-4">
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <div data-rhythm-multi-buddy-info data-rhythm-multi-buddy-info-other className="relative w-full max-w-xs rounded-2xl border border-lime-300/40 bg-slate-900 p-4 text-center shadow-2xl">
        <div className="mx-auto w-fit"><RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-16 w-16" /></div>
        <b className="mt-2 block truncate text-base font-black">{m.name}</b>
        <small className="block text-[12px] font-black text-lime-200">ビートLv.{m.level}</small>
        <p className="mt-3 text-[11px] font-bold leading-relaxed text-slate-300">ほかのメンバーが呼んだマスモンです。くわしいステータスは、呼んだ人だけが見られます</p>
        <button type="button" onClick={onClose} className="mt-3 min-h-[42px] w-full rounded-xl bg-slate-700 text-sm font-black">閉じる</button>
      </div>
    </div>
  );
}

// 参加者の顔。名前の横に、ブリーダーのアイコン(プロフィールフレーム付き)を出す
function RhythmMultiAvatar({ m, resolveIconUrl, sizeClass = 'h-10 w-10' }) {
  // 相棒(CPU)は、呼んだ人のマスモンを染めた姿で描く(種類 mb と色 mc は知らせに載っている)
  if (m.cpu) {
    const base = m.mb && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[m.mb] : null;
    // 染色は全身の絵に合わせて作ってあるので、顔アイコンではなく全身の絵を使う(2026-10-07 ユーザー指摘)
    const src = masuDisplayImageUrl(base);
    return (
      <span data-rhythm-multi-cpu-avatar className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-lime-300/80 bg-slate-800 ${sizeClass}`}>
        {src
          ? <DyedMonsterImage baseId={m.mb} src={src} alt="" masuColors={Array.isArray(m.mc) ? m.mc.filter(Boolean) : []} draggable={false} className="h-full w-full object-contain p-0.5" />
          : <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-lg">🐾</span>}
      </span>
    );
  }
  const src = resolveIconUrl ? resolveIconUrl(m.icon) : null;
  return (
    <ProfileAvatar src={src} id={m.icon} frameId={m.frame} alt="" className={sizeClass}
      fallback={<span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-slate-800 text-lg">🎵</span>} />
  );
}

// 本家の上に並ぶ5人のカード。空いている枠も点線で見せる(何人で遊んでいるかがひと目で分かる)。
// size="tall" はマッチング・準備・待機の画面で、空いている高さいっぱいに大きく出す(横画面では画面の上半分以上)。
// size="strip" は曲えらびの上の細い帯。曲の一覧を狭めないよう、横画面ではアイコンと名前を横並びにして低くする
// onOpen があれば、相棒(CPU)の札を押すとステータスの窓を開く(2026-10-09・ユーザー指示「セッション中にもマスモンのステータスを見れるように」)
function RhythmMultiMemberCards({ members, hostId, selfId, resolveIconUrl, badgeOf, size = 'tall', bubbleOf = null, onOpen = null }) {
  const tall = size === 'tall';
  return (
    <ul data-rhythm-multi-cards className={tall
      ? 'grid min-h-[120px] max-h-[230px] flex-1 grid-cols-5 gap-1.5 bg-slate-900/40 px-2 pb-2 pt-3 landscape:max-h-none landscape:gap-2 landscape:px-3'
      : 'grid shrink-0 grid-cols-5 gap-1 border-b border-white/10 bg-slate-900/70 px-1.5 pb-1 pt-2 landscape:pt-1.5'}>
      {Array.from({ length: RHYTHM_MULTI_ROOM_MAX }).map((_, i) => {
        const m = members[i];
        if (!m) return <li key={i} className={`flex items-center justify-center rounded-xl border border-dashed border-white/10 text-[10px] font-black text-slate-600 ${tall ? '' : 'h-[60px] landscape:h-[38px]'}`}>募集中</li>;
        const badge = badgeOf(m);
        const self = m.id === selfId;
        const openable = !!(onOpen && m.cpu);
        const openProps = openable ? {
          role: 'button', tabIndex: 0, 'data-rhythm-multi-member-open': '', 'aria-label': `${m.name}のステータスを見る`,
          onClick: () => onOpen(m), onKeyDown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(m); } },
        } : {};
        return (
          <li key={m.id} data-rhythm-multi-member {...openProps} className={`relative flex min-h-0 min-w-0 rounded-xl ${openable ? 'cursor-pointer active:brightness-125 ' : ''}${self ? 'border border-cyan-300/70 bg-cyan-950/50' : 'border border-white/10 bg-slate-950/70'} ${tall
            ? 'flex-col items-center justify-center px-1 pb-1.5 pt-3'
            : 'h-[60px] flex-col items-center px-0.5 pt-1.5 landscape:h-[38px] landscape:flex-row landscape:gap-1 landscape:px-1 landscape:pt-0'}`}>
            <RhythmMultiChatBubble text={bubbleOf ? bubbleOf(m.id) : ''} />
            <small data-rhythm-multi-member-badge className={`absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-black leading-tight ${badge.cls}`}>{badge.text}</small>
            <span className="relative shrink-0">
              <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass={tall ? 'h-12 w-12 landscape:h-16 landscape:w-16' : 'h-7 w-7'} />
              {m.id === hostId && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 text-[11px]">👑</span>}
              {openable && <span aria-hidden="true" className={`absolute -bottom-1 -right-1.5 flex items-center justify-center rounded-full bg-lime-300 font-black leading-none text-slate-950 ${tall ? 'h-4 w-4 text-[10px]' : 'h-3 w-3 text-[8px]'}`}>i</span>}
            </span>
            <span className={`min-w-0 ${tall ? 'mt-1 w-full text-center' : 'mt-0.5 w-full text-center landscape:mt-0 landscape:flex-1 landscape:text-left'}`}>
              <span className={`block truncate font-black leading-tight ${tall ? 'text-[11px] landscape:text-sm' : 'text-[10px]'}`}>{m.cpu && <b data-rhythm-multi-cpu-mark className="mr-0.5 rounded bg-lime-300 px-0.5 text-[8px] font-black text-slate-950">CPU</b>}{m.name}{self ? '*' : ''}</span>
              {badge.sub && <small className={`block truncate font-bold leading-tight text-slate-400 ${tall ? 'text-[9px] landscape:text-[11px]' : 'text-[8px]'}`}>{badge.sub}</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const RHYTHM_MULTI_FC_LABELS = Object.freeze(['', 'FULL COMBO!', 'ALL EXCELLENT!', 'ALL MARVELOUS!']);

// ---- モードえらびの見た目(2026-10-03・ユーザー指示「見た目自体の強化して」) ----
// ライブ会場の舞台のような背景(揺れるスポットライト・舞う音符・キラキラ・床の光)と、
// 角を切った札の形のボタン(光が流れる・英字の透かし)。
// ★CSSは <head> へ1回だけ入れる(HOMEのバッジと同じやり方。画面のDOMへ <style> を混ぜない)。
// ★動かすのは transform と opacity だけ(裏で回している周回や演奏の重さに響かないように)。
// ★動きを減らす設定の人には、すべて止める
const RHYTHM_MODE_SELECT_CSS = `
.mhms-stage{background:radial-gradient(120% 70% at 50% -10%,rgba(217,70,239,.32),transparent 60%),radial-gradient(90% 60% at 15% 110%,rgba(56,189,248,.22),transparent 65%),radial-gradient(90% 60% at 90% 105%,rgba(244,114,182,.22),transparent 65%),linear-gradient(160deg,#0b0620 0%,#1d0b3a 45%,#0a1030 100%);}
.mhms-fx{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.mhms-beam{position:absolute;top:-20%;width:34%;height:130%;transform-origin:50% 0;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 75%);filter:blur(6px);opacity:.55;mix-blend-mode:screen;clip-path:polygon(42% 0,58% 0,100% 100%,0 100%)}
.mhms-beam.b1{left:8%;background:linear-gradient(180deg,rgba(244,114,182,.45),rgba(244,114,182,0) 75%);animation:mhmsSway 7s ease-in-out infinite}
.mhms-beam.b2{left:40%;background:linear-gradient(180deg,rgba(125,211,252,.4),rgba(125,211,252,0) 75%);animation:mhmsSway 9s ease-in-out -3s infinite reverse}
.mhms-beam.b3{left:70%;background:linear-gradient(180deg,rgba(250,204,21,.32),rgba(250,204,21,0) 75%);animation:mhmsSway 8s ease-in-out -5s infinite}
.mhms-floor{position:absolute;left:-10%;right:-10%;bottom:-18%;height:42%;background:radial-gradient(50% 50% at 50% 50%,rgba(232,121,249,.35),transparent 70%);animation:mhmsPulse 4s ease-in-out infinite}
.mhms-note{position:absolute;bottom:-8%;font-weight:900;color:rgba(255,255,255,.55);text-shadow:0 0 8px rgba(244,114,182,.9);animation:mhmsRise 9s linear infinite}
.mhms-spark{position:absolute;width:4px;height:4px;border-radius:9999px;background:#fff;box-shadow:0 0 8px 2px rgba(255,255,255,.8);animation:mhmsTwinkle 2.8s ease-in-out infinite}
.mhms-title{background:linear-gradient(90deg,#67e8f9,#f0abfc 55%,#fde68a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 6px rgba(240,171,252,.45))}
.mhms-glow{position:absolute;left:50%;top:46%;width:120%;aspect-ratio:1;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(244,114,182,.45),rgba(168,85,247,.18) 55%,transparent 75%);animation:mhmsPulse 3.6s ease-in-out infinite}
.mhms-float{animation:mhmsFloat 4.5s ease-in-out infinite}
.mhms-card{position:relative;overflow:hidden;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -3px 0 rgba(0,0,0,.18)}
.mhms-card::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:40%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:mhmsShine 3.8s ease-in-out infinite}
.mhms-card.free::after{animation-delay:1.9s}
.mhms-card .mhms-mark{position:absolute;right:-4px;bottom:-6px;font-size:26px;line-height:1;font-style:italic;font-weight:900;letter-spacing:-.02em;color:rgba(255,255,255,.2);white-space:nowrap;pointer-events:none}
.mhms-card .mhms-ico{filter:drop-shadow(0 2px 0 rgba(0,0,0,.25))}
.mhms-glass{background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 24px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.mhms-bubble::before{content:"";position:absolute;top:-8px;left:22px;width:14px;height:14px;transform:rotate(45deg);background:inherit;border-left:inherit;border-top:inherit}
.mhms-bubble-alone::before{display:none}
.mhbs-screen>*:not(.mhms-fx){position:relative;z-index:1}
.mhbs-tabs{display:grid;gap:3px;padding:3px;border-radius:14px;background:rgba(8,5,24,.6);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.mhbs-tab{min-height:36px;border-radius:11px;font-weight:900;color:rgba(203,213,225,.75);transition:background .2s,color .2s}
.mhbs-tab.on{color:#fff;background:linear-gradient(135deg,rgba(232,121,249,.55),rgba(139,92,246,.55));box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 14px -4px rgba(217,70,239,.7)}
.mhbs-tab.on.x{background:linear-gradient(135deg,rgba(244,63,94,.6),rgba(217,70,239,.6))}
.mhbt-tile{position:relative;overflow:hidden;color:#0f172a;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));background:linear-gradient(150deg,color-mix(in srgb,var(--acc) 22%,white),color-mix(in srgb,var(--acc) 55%,white) 38%,var(--acc) 78%,color-mix(in srgb,var(--acc) 78%,black));box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.mhbt-tile::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:38%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:mhmsShine 4.6s ease-in-out infinite;pointer-events:none}
.mhbt-tile:not(.on)::after{display:none}
.mhbt-tile.dim{filter:grayscale(1)}
.mhbt-mark{position:absolute;right:-10px;top:112px;font-size:58px;line-height:1;font-style:italic;font-weight:900;letter-spacing:-.03em;color:rgba(255,255,255,.2);white-space:nowrap;transform:rotate(-6deg);pointer-events:none}
.mhbt-eyebrow{position:relative;font-size:9px;font-weight:900;letter-spacing:.3em;color:rgba(15,23,42,.58)}
.mhbt-name{position:relative;margin-top:2px;font-weight:900;font-style:italic;line-height:1.12;letter-spacing:.01em}
.mhbt-sub{position:relative;margin-top:4px;min-height:28px;font-size:10.5px;font-weight:800;line-height:1.35;color:rgba(15,23,42,.72)}
.mhbt-score{position:relative;margin-top:8px}
.mhbt-score b{display:block;font-size:30px;line-height:1;font-style:italic;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mhbt-score small{display:block;margin-top:3px;font-size:9.5px;font-weight:900;color:rgba(15,23,42,.66);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mhbt-feats{position:relative;display:grid;gap:4px;margin-top:9px}
.mhbt-feats li{display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:9px;font-size:10.5px;font-weight:900;background:rgba(255,255,255,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.mhbt-cells{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px}
.mhbt-cells>div{border-radius:9px;padding:3px 0;text-align:center;font-size:8.5px;font-weight:900;color:rgba(15,23,42,.62);background:rgba(255,255,255,.38);white-space:nowrap}
.mhbt-cells b{display:block;font-size:13px;color:#0f172a}
.mhbt-note{position:relative;margin-top:5px;display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:9px;font-weight:900;color:rgba(15,23,42,.72);white-space:nowrap;overflow:hidden}
.mhbt-reward{position:relative;margin-top:6px;border-radius:10px;padding:5px 9px;background:rgba(15,23,42,.82);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.mhbt-ic{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:46px;min-height:50px;border-radius:12px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.6);color:#0f172a;line-height:1}
.mhbt-ic b{font-size:17px}.mhbt-ic small{margin-top:3px;font-size:8.5px;font-weight:900}
.mhbt-ic:active,.mhbt-go:active{transform:scale(.96)}
.mhbt-go{position:relative;min-height:50px;padding:0 6px;white-space:nowrap;background:#0f172a;color:#fff;font-size:15px;font-style:italic;font-weight:900;letter-spacing:.02em;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.mhbt-tile[class*="mhbt-d-"]{background:var(--d-bg)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 0 0 var(--d-ringw,0px) var(--d-ring,transparent),inset 0 -40px 60px -30px var(--d-deep,transparent)}
.mhbt-tile[class*="mhbt-d-"] .mhbt-mark{color:var(--d-mark,rgba(255,255,255,.2))}
.mhbt-tile[class*="mhbt-d-"]::after{animation-duration:var(--d-shine,4.6s);background:linear-gradient(90deg,transparent,var(--d-sheen,rgba(255,255,255,.35)),transparent)}
.mhbt-tile.dark{color:#fff}
.mhbt-tile[class*="mhbt-d-"] .mhbt-name{color:var(--d-name,#0f172a)}
.mhbt-tile.dark .mhbt-eyebrow{color:var(--d-eyebrow,rgba(255,255,255,.7))}
.mhbt-tile.dark .mhbt-sub,.mhbt-tile.dark .mhbt-score small,.mhbt-tile.dark .mhbt-note{color:rgba(255,255,255,.78)}
.mhbt-tile.dark .mhbt-name{text-shadow:0 0 14px var(--d-ring,transparent),0 2px 0 rgba(0,0,0,.4)}
.mhbt-tile.dark .mhbt-cells>div,.mhbt-tile.dark .mhbt-feats li{background:rgba(0,0,0,.32);color:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.mhbt-tile.dark .mhbt-cells b{color:#fff}
.mhbt-tile.dark .mhbt-reward{background:rgba(0,0,0,.5);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
.mhbt-tile.dark .mhbt-pb{color:#fff;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
.mhbt-tile.dark .mhbt-go{background:linear-gradient(135deg,#fff,var(--d-go,#e2e8f0));color:#0f172a}
.mhbt-d-Beginner{--d-name:#14532d;--d-bg:linear-gradient(150deg,#f0fdf4,#bbf7d0 45%,#86efac);--d-mark:rgba(22,101,52,.12);--d-shine:6s}
.mhbt-d-Easy{--d-name:#155e75;--d-bg:linear-gradient(150deg,#ecfeff,#a5f3fc 45%,#67e8f9);--d-mark:rgba(14,116,144,.13);--d-shine:5.6s}
.mhbt-d-Normal{--d-name:#1e3a8a;--d-bg:linear-gradient(150deg,#eff6ff,#93c5fd 42%,#3b82f6);--d-mark:rgba(255,255,255,.22);--d-shine:5.2s;--d-ring:rgba(59,130,246,.5);--d-ringw:1px}
.mhbt-d-Hard{--d-name:#7c2d12;--d-bg:linear-gradient(150deg,#fff7ed,#fdba74 38%,#f97316 78%,#c2410c);--d-mark:rgba(255,255,255,.26);--d-shine:4.6s;--d-ring:rgba(249,115,22,.65);--d-ringw:2px;--d-deep:rgba(154,52,18,.45)}
.mhbt-d-Expert{--d-name:#fee2e2;--d-bg:linear-gradient(150deg,#f87171,#dc2626 45%,#7f1d1d);--d-mark:rgba(255,255,255,.16);--d-shine:4s;--d-ring:rgba(254,202,202,.7);--d-ringw:2px;--d-deep:rgba(69,10,10,.6);--d-go:#fecaca}
.mhbt-d-Master{--d-name:#f3e8ff;--d-bg:linear-gradient(150deg,#c084fc,#7e22ce 45%,#3b0764);--d-mark:rgba(255,255,255,.16);--d-shine:3.6s;--d-ring:rgba(233,213,255,.75);--d-ringw:2px;--d-deep:rgba(30,6,60,.6);--d-go:#e9d5ff}
.mhbt-d-GrandMaster{--d-name:#fde68a;--d-bg:radial-gradient(90% 60% at 50% 0%,rgba(251,191,36,.28),transparent 60%),linear-gradient(150deg,#5b21b6,#2e1065 50%,#14072b);--d-mark:rgba(251,191,36,.18);--d-shine:3.2s;--d-ring:#fbbf24;--d-ringw:3px;--d-deep:rgba(10,3,24,.7);--d-eyebrow:#fcd34d;--d-sheen:rgba(253,230,138,.45);--d-go:#fde68a}
.mhbt-d-Hell{--d-name:#fecaca;--d-bg:radial-gradient(100% 55% at 50% 105%,rgba(220,38,38,.65),transparent 65%),radial-gradient(60% 40% at 80% 0%,rgba(127,29,29,.6),transparent 70%),linear-gradient(170deg,#2a0606,#0c0101 60%,#000);--d-mark:rgba(248,113,113,.2);--d-shine:2.8s;--d-ring:#dc2626;--d-ringw:3px;--d-eyebrow:#fca5a5;--d-sheen:rgba(248,113,113,.4);--d-go:#fca5a5}
.mhbt-d-Legend{--d-name:#78350f;--d-bg:linear-gradient(150deg,#fef3c7,#fbbf24 32%,#f59e0b 62%,#92400e);--d-mark:rgba(255,255,255,.4);--d-shine:2.4s;--d-ring:rgba(255,255,255,.85);--d-ringw:3px;--d-deep:rgba(120,53,15,.35);--d-sheen:rgba(255,255,255,.7)}
.mhbt-d-Legend::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,rgba(244,114,182,.7),rgba(250,204,21,.5),rgba(52,211,153,.6),rgba(96,165,250,.7),rgba(192,132,252,.7),rgba(244,114,182,.7));background-size:300% 100%;mix-blend-mode:overlay;opacity:.9;animation:mhbtRainbow 6s linear infinite}
.mhbt-d-EXTREME{--d-name:#f5d0fe;--d-bg:radial-gradient(90% 55% at 50% 0%,rgba(232,121,249,.45),transparent 62%),linear-gradient(160deg,#4a044e,#1e0322 60%,#0a010c);--d-mark:rgba(240,171,252,.22);--d-shine:2.6s;--d-ring:#e879f9;--d-ringw:4px;--d-eyebrow:#f5d0fe;--d-go:#f5d0fe}
.mhbt-d-NIGHTMARE{--d-name:#c7d2fe;--d-bg:radial-gradient(90% 55% at 50% 0%,rgba(129,140,248,.45),transparent 62%),linear-gradient(160deg,#1e1b4b,#0b0a24 60%,#020210);--d-mark:rgba(165,180,252,.22);--d-shine:2.4s;--d-ring:#818cf8;--d-ringw:4px;--d-eyebrow:#c7d2fe;--d-go:#c7d2fe}
.mhbt-d-CHAOS{--d-name:#fbcfe8;--d-bg:radial-gradient(70% 50% at 15% 10%,rgba(236,72,153,.55),transparent 65%),radial-gradient(70% 50% at 90% 95%,rgba(34,211,238,.5),transparent 65%),linear-gradient(160deg,#1a0420,#05010a);--d-mark:rgba(255,255,255,.18);--d-shine:2.1s;--d-ring:#f472b6;--d-ringw:4px;--d-eyebrow:#a5f3fc;--d-go:#fbcfe8}
.mhbt-d-ULTIMATE{--d-name:#f1f5f9;--d-bg:radial-gradient(90% 55% at 50% 0%,rgba(255,255,255,.35),transparent 60%),linear-gradient(160deg,#334155,#0f172a 55%,#000);--d-mark:rgba(255,255,255,.22);--d-shine:1.9s;--d-ring:#f8fafc;--d-ringw:4px;--d-eyebrow:#e2e8f0;--d-sheen:rgba(255,255,255,.55);--d-go:#e2e8f0}
.mhbt-d-INFINITY,.mhbt-d-GOD,.mhbt-d-RAGNAROK,.mhbt-d-HELHEIM{--d-name:#fef08a;--d-name:#99f6e4;--d-deep:rgba(250,204,21,.25);--d-bg:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 40% 75%,#fff,transparent),radial-gradient(90% 60% at 50% 0%,rgba(250,204,21,.4),transparent 60%),linear-gradient(160deg,#0c1445,#020617 60%,#000);--d-mark:rgba(253,224,71,.24);--d-shine:1.7s;--d-ring:#facc15;--d-ringw:5px;--d-eyebrow:#fde68a;--d-sheen:rgba(253,224,71,.5);--d-go:#fde68a}
.mhbt-d-GOD{--d-name:#fffbeb;--d-bg:radial-gradient(90% 60% at 50% 0%,rgba(255,255,255,.55),transparent 55%),radial-gradient(80% 50% at 50% 100%,rgba(250,204,21,.45),transparent 65%),linear-gradient(160deg,#78350f,#1c1003 55%,#000);--d-ring:#fff7d6;--d-ringw:6px;--d-shine:1.5s;--d-sheen:rgba(255,255,255,.7);--d-mark:rgba(255,247,214,.28)}
.mhbt-d-RAGNAROK{--d-name:#fed7aa;--d-bg:radial-gradient(90% 60% at 50% 100%,rgba(239,68,68,.75),transparent 62%),radial-gradient(70% 45% at 50% 0%,rgba(250,204,21,.45),transparent 65%),linear-gradient(170deg,#3b0505,#120000 55%,#000);--d-ring:#f59e0b;--d-ringw:6px;--d-shine:1.3s;--d-sheen:rgba(254,215,170,.65);--d-mark:rgba(252,165,165,.28);--d-eyebrow:#fed7aa;--d-go:#fed7aa}
.mhbt-d-HELHEIM{--d-bg:radial-gradient(90% 60% at 50% 100%,rgba(45,212,191,.55),transparent 62%),radial-gradient(70% 45% at 50% 0%,rgba(167,139,250,.45),transparent 65%),linear-gradient(170deg,#042f2e,#020617 55%,#000);--d-ring:#5eead4;--d-ringw:6px;--d-shine:1.2s;--d-sheen:rgba(204,251,241,.6);--d-mark:rgba(153,246,228,.26);--d-eyebrow:#99f6e4;--d-go:#ccfbf1}
@keyframes mhbtRainbow{from{background-position:0% 0}to{background-position:300% 0}}
@media (prefers-reduced-motion:reduce){.mhbt-tile::after,.mhbt-d-Legend::before{animation:none!important}}
.mhbt-go::after{content:" ▶";font-size:11px;font-style:normal}
.mhbt-go{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis}
.mhbt-go.sm{font-size:12px;letter-spacing:0}
.mhbt-pb{flex:1 1 0;min-width:0;min-height:36px;border-radius:10px;font-size:11px;font-weight:900;white-space:nowrap;color:#0f172a;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.mhbt-pb:active{transform:scale(.96)}
.mhbs-hint{text-align:center;font-size:8px;font-weight:900;letter-spacing:.24em;color:rgba(240,171,252,.7)}
.mhbs-arrow{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;color:#fff;background:rgba(14,9,38,.78);border:1px solid rgba(255,255,255,.18);box-shadow:0 4px 14px rgba(0,0,0,.4)}
.mhbs-dot{width:6px;height:6px;border-radius:9999px;background:rgba(255,255,255,.22);transition:all .2s}
.mhbs-dot.on{width:16px;background:linear-gradient(90deg,#f0abfc,#a78bfa)}
.mhms-in{animation:mhmsIn .45s cubic-bezier(.2,.9,.3,1.2) both}
.mhmv-mvp{animation:mhmvGlow 1.8s ease-in-out infinite}
.mhmv-mvp::after{content:"";position:absolute;top:-30%;bottom:-30%;left:-70%;width:45%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,236,170,.45),transparent);animation:mhmsShine 2.6s ease-in-out infinite;pointer-events:none}
.mhmv-badge{animation:mhmvPop .5s cubic-bezier(.2,1.4,.4,1) both}
.mhmv-ring{box-shadow:0 0 0 3px #fcd34d,0 0 12px 2px rgba(252,211,77,.6)}
@keyframes mhmvGlow{0%,100%{box-shadow:0 0 10px 1px rgba(252,211,77,.55),inset 0 0 12px rgba(252,211,77,.25)}50%{box-shadow:0 0 22px 5px rgba(244,114,182,.75),inset 0 0 18px rgba(252,211,77,.4)}}
@keyframes mhmvPop{0%{transform:translateX(-50%) scale(.3);opacity:0}100%{transform:translateX(-50%) scale(1);opacity:1}}
.mhms-in-left{animation:mhmsInLeft .5s ease-out both}
@keyframes mhmsSway{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
@keyframes mhmsPulse{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes mhmsRise{0%{transform:translateY(0) rotate(-8deg);opacity:0}12%{opacity:1}100%{transform:translateY(-115vh) rotate(12deg);opacity:0}}
@keyframes mhmsTwinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}
@keyframes mhmsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes mhmsShine{0%,55%{transform:translateX(0) skewX(-20deg)}100%{transform:translateX(420%) skewX(-20deg)}}
@keyframes mhmsIn{from{opacity:0;transform:translateX(24px) scale(.96)}to{opacity:1;transform:none}}
@keyframes mhmsInLeft{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mhms-beam,.mhms-floor,.mhms-note,.mhms-spark,.mhms-glow,.mhms-float,.mhms-card::after,.mhms-in,.mhms-in-left,.mhmv-mvp,.mhmv-mvp::after,.mhmv-badge{animation:none!important}.mhms-note,.mhms-spark{display:none}}
`;
// 助手の立ち絵の切り出し方(2026-10-03・ユーザー指摘「もものアイコンが右側に変なの見えてる / 位置も調整して」)。
// みゅあ・ききの絵は横長(1536×1024)なので、枠いっぱいに広げて真ん中を切り出す(object-cover)。
// ももすけ・ドラの絵は正方形で、ももすけは右端に別の絵のかけらが入っている。顔の位置(cx, cy・絵の幅と高さに対する割合)を
// 枠の真ん中(横)・top(縦)に合わせ、枠の幅の zoom 倍に広げて、かけらを枠の外へ出す
// (高さで合わせると、縦画面の縦長の枠で大きくなりすぎて耳が切れた)
const RHYTHM_MODE_ASSISTANT_FRAMES = Object.freeze({
  // ももすけは表情ごとに体の位置が違い、かけらも左(angry・happy)と右(crying・wink)にある。
  // 透明でない部分を数えて決めた体の真ん中(cxBy)へ合わせ、体の幅だけが入る 1.5 倍に広げる(2026-10-03)
  momosuke: { zoom: 1.5, cx: 0.5, cy: 0.48, top: 0.42,
    cxBy: { angry: 0.545, happy: 0.545, crying: 0.44, wink: 0.46, excited: 0.38, surprise: 0.38, normal: 0.645, troubled: 0.655 } },
  dra: { zoom: 0.85, cx: 0.5, cy: 0.5, top: 0.4 },
});
// 舞台の飾り(スポットライト3本・音符・キラキラ・床の光)。位置と遅れは固定(描くたびに変わらないように)
const RHYTHM_MODE_SELECT_NOTES = Object.freeze([
  { left: '6%', delay: '0s', size: 18, ch: '♪' }, { left: '22%', delay: '-3.2s', size: 14, ch: '♫' },
  { left: '41%', delay: '-6.1s', size: 20, ch: '♪' }, { left: '63%', delay: '-1.6s', size: 15, ch: '♬' },
  { left: '80%', delay: '-4.8s', size: 19, ch: '♫' }, { left: '93%', delay: '-7.4s', size: 13, ch: '♪' },
]);
const RHYTHM_MODE_SELECT_SPARKS = Object.freeze([
  { left: '12%', top: '18%', delay: '0s' }, { left: '34%', top: '9%', delay: '-.9s' }, { left: '57%', top: '22%', delay: '-1.8s' },
  { left: '76%', top: '12%', delay: '-.4s' }, { left: '88%', top: '34%', delay: '-2.2s' }, { left: '48%', top: '40%', delay: '-1.3s' },
]);
function RhythmModeSelectStage({ notes = true }) {
  return (
    <div className="mhms-fx" aria-hidden="true">
      <span className="mhms-beam b1" /><span className="mhms-beam b2" /><span className="mhms-beam b3" />
      <span className="mhms-floor" />
      {RHYTHM_MODE_SELECT_SPARKS.map((sp, i) => <span key={`s${i}`} className="mhms-spark" style={{ left: sp.left, top: sp.top, animationDelay: sp.delay }} />)}
      {notes && RHYTHM_MODE_SELECT_NOTES.map((n, i) => <span key={`n${i}`} className="mhms-note" style={{ left: n.left, fontSize: `${n.size}px`, animationDelay: n.delay }}>{n.ch}</span>)}
    </div>
  );
}
// モンヒロバトルの「モード→難易度→ランキング」の画面の見出し。ScreenHead と同じ引数で、英字の小見出し(eyebrow)と
// 題名を舞台の上へ載せる作りにしたもの(モンヒロビートのモードえらびの見出しと同じ並び)
function BattleScreenHead({ eyebrow, title, accent = 'text-white', accentStyle = null, note = '', onBack = null, disabled = false, right = null }) {
  return (
    <header className="relative z-10 -mx-4 mb-1.5 flex shrink-0 items-center gap-1.5 border-b border-fuchsia-300/20 bg-slate-950/55 px-2 py-1 backdrop-blur-sm">
      {onBack && <button type="button" aria-label="戻る" onClick={onBack} disabled={disabled} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-lg font-black text-slate-300 active:scale-90 disabled:opacity-30">←</button>}
      <div className="min-w-0 flex-1 leading-none">
        <small className="block truncate text-[8px] font-black tracking-[0.2em] text-fuchsia-300">{eyebrow}</small>
        <b className={`block truncate text-lg font-black leading-tight tracking-wider ${accentStyle ? '' : accent}`} style={accentStyle || undefined}>{title}</b>
        {note && <small className="block truncate text-[9px] font-black text-slate-300/90">{note}</small>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
// 舞台のCSSは <head> へ1回だけ入れる。モンヒロビートとモンヒロバトルの入口が同じ札・舞台を使うので、入れる処理も1つにしてある
function useModeSelectStageCss() {
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-rhythm-mode-select-css')) return;
    const tag = document.createElement('style');
    tag.id = 'mh-rhythm-mode-select-css';
    tag.textContent = RHYTHM_MODE_SELECT_CSS;
    document.head.appendChild(tag);
  }, []);
}
// 助手の「立ち絵 ON/OFF」「コメント ON/OFF」の札。立ち絵があるときはその右下の角に重ねて(帽子や顔にかぶせず・行を増やさず、絵の枠を広く使う。
// 2026-10-04・ユーザー指摘「立絵エリアがせまくなってる」)、立ち絵が無いときは枠の中(両方オフなら右の列の上)に並べる
function ModeSelectAssistToggles({ assistant, showArt, showComment, onToggle, cls, withLabel }) {
  return onToggle ? (
    <div data-rhythm-mode-assistant-toggles role="group" aria-label="助手の表示" className={`flex items-center gap-1.5 ${cls}`}>
      {withLabel && <small className="mr-auto text-[10px] font-black text-slate-400">助手 {assistant ? assistant.name : ''}</small>}
      {[['modeSelectArt', showArt, '立ち絵', 'data-rhythm-mode-toggle-art'], ['modeSelectComment', showComment, 'コメント', 'data-rhythm-mode-toggle-comment']].map(([key, on, label, attr]) => (
        <button key={key} type="button" {...{ [attr]: '' }} aria-pressed={on} onClick={() => onToggle(key)}
          className={`min-h-[32px] rounded-full border px-2.5 text-[10px] font-black backdrop-blur-sm ${on ? 'border-emerald-300 bg-emerald-700/85 text-white' : 'border-white/25 bg-slate-900/75 text-slate-200'}`}>{label} {on ? 'ON' : 'OFF'}</button>
      ))}
    </div>
  ) : null;
}
// 助手の枠。上に立ち絵、その下にコメント(絵に重ねない。2026-10-04・ユーザー指摘「助手コメントが助手に被ってる」)。
// 立ち絵とコメントは別々にオン・オフできる。両方オフなら枠ごと出さない
function ModeSelectAssistantPanel({ assistant, showArt, showComment, onToggle }) {
  if (!assistant || !(showArt || showComment)) return null;
  return (
    <div data-rhythm-mode-assistant className={`mhms-glass mhms-in-left relative mx-3 mt-3 flex flex-col overflow-hidden rounded-3xl landscape:m-0 landscape:w-[32%] landscape:flex-none landscape:rounded-none landscape:border-0 landscape:bg-none landscape:shadow-none ${showArt ? 'min-h-[150px] flex-1' : 'flex-none'}`}>
      {showArt && (
        <div data-rhythm-mode-assistant-art-box className="relative min-h-0 flex-1 overflow-hidden">
          <span aria-hidden="true" className="mhms-glow" />
          <ModeSelectAssistToggles assistant={assistant} showArt={showArt} showComment={showComment} onToggle={onToggle} cls="absolute bottom-1.5 right-1.5 z-20" withLabel={false} />
          <div className="mhms-float pointer-events-none absolute inset-0">
            {RHYTHM_MODE_ASSISTANT_FRAMES[assistant.id]
              ? (() => { const fr = RHYTHM_MODE_ASSISTANT_FRAMES[assistant.id]; const ex = (/_([a-z]+)\.png$/i.exec(assistant.image || '') || [])[1]; const cx = (fr.cxBy && fr.cxBy[ex]) || fr.cx; return <img data-rhythm-mode-assistant-art src={assistant.image} alt="" draggable={false} className="absolute max-w-none" style={{ width: `${fr.zoom * 100}%`, height: 'auto', left: '50%', top: `${fr.top * 100}%`, transform: `translate(-${cx * 100}%, -${fr.cy * 100}%)` }} />; })()
              : <img data-rhythm-mode-assistant-art src={assistant.image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-[50%_22%] landscape:object-[50%_30%]" />}
          </div>
        </div>
      )}
      {!showArt && <ModeSelectAssistToggles assistant={assistant} showArt={showArt} showComment={showComment} onToggle={onToggle} cls="mx-2 mt-2 justify-end" withLabel />}
      {showComment && (
        <p data-rhythm-mode-assistant-line className={`mhms-bubble ${showArt ? '' : 'mhms-bubble-alone'} relative z-10 m-1.5 shrink-0 rounded-2xl border-2 bg-slate-900/95 px-3 py-1.5 text-[12px] font-bold leading-snug text-white shadow-lg landscape:text-[11px]`} style={{ borderColor: assistant.accent }}>
          <b className="mb-0.5 block text-[10px]" style={{ color: assistant.accent }}>{assistant.name}</b>{assistant.text}
        </p>
      )}
    </div>
  );
}

// songs / difficultiesOf / difficultyList は曲えらびと同じ一覧(rhythmDemoSongs など)。
// onStartPlay は演奏画面へ入る処理を親が持つ。bestRecords は難易度の鍵(解放)の判定に使う
// 「マスモンを呼ぶ」を閉じてから「ルームを出る」を受け付けるまでの時間(ms)。二度押しの間隔(ふつう 100〜300ms)より長く、
// わざと出る人が待たされたと感じない長さ
const RHYTHM_BUDDY_LEAVE_GUARD_MS = 500;
function RhythmMultiScreen({ profile, songs, difficultiesOf, difficultyList, bestRecords, resolveIconUrl, quickRunInfo = null, onPreviewSong = null, onUserGesture = null, multiLook = 'LIGHT', onChangeMultiLook = null, onBack, onStartPlay, modeSelect = null, onRoomEntered = null, rankingSupport = null, masuMons = [], masuPicker = null, buddyTickets = 0, onUseBuddyTicket = null, onRefundBuddyTicket = null, onOpenMasuBeat = null }) {
  const view = useRhythmMultiView();
  useModeSelectStageCss();
  const difficultyIds = difficultyList.map((d) => d.id);
  const songIds = songs.map((song) => song.songId);
  React.useEffect(() => {
    const lengths = {};
    songs.forEach((song) => { const ms = Number(song.playDurationMs); if (ms > 0) lengths[song.songId] = ms; });
    RHYTHM_MULTI.setCatalog(songIds, lengths);
  }, [songIds.join(',')]);
  const [codeInput, setCodeInput] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [searching, setSearching] = React.useState(null);
  const [countdown, setCountdown] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  // 未読の数(チャットを閉じているあいだに届いた、ほかの人の発言)。開いたら既読にする
  const [chatSeenAt, setChatSeenAt] = React.useState(() => Date.now());
  const chatList = view && view.chat ? view.chat : [];
  const lastChatAt = chatList.length ? chatList[chatList.length - 1].at || 0 : 0;
  React.useEffect(() => { if (chatOpen) setChatSeenAt(Math.max(Date.now(), lastChatAt)); }, [chatOpen, lastChatAt]);
  const chatUnread = chatOpen ? 0 : chatList.filter((c) => c.id !== (view && view.selfId) && (c.at || 0) > chatSeenAt).length;
  // 吹き出しは時間が来たら消す。新しい発言が来るたびに、消す時刻で1回だけ描き直す
  const [, setBubbleTick] = React.useState(0);
  React.useEffect(() => {
    if (!lastChatAt) return undefined;
    const wait = lastChatAt + RHYTHM_MULTI_CHAT_BUBBLE_MS - Date.now();
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setBubbleTick((n) => n + 1), wait + 50);
    return () => clearTimeout(timer);
  }, [lastChatAt]);
  const chatBubbleOf = (id) => {
    const now = Date.now();
    for (let k = chatList.length - 1; k >= 0; k--) {
      const c = chatList[k];
      if (now - (c.at || 0) > RHYTHM_MULTI_CHAT_BUBBLE_MS) return '';
      if (c.id === id) return c.text;
    }
    return '';
  };
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [memberSheetId, setMemberSheetId] = React.useState('');
  const [rankingOpen, setRankingOpen] = React.useState(false);
  // モードえらびの「プライベートルーム」の入室シートと、「ランキング」(全国/マスモン)の重ね画面(2026-10-07)
  const [privateOpen, setPrivateOpen] = React.useState(false);
  const [rankHubOpen, setRankHubOpen] = React.useState(false);
  const [rankHubTab, setRankHubTab] = React.useState('national');
  const [recordOpen, setRecordOpen] = React.useState(false);
  // マスモンを呼ぶ(docs/spec/RHYTHM_BUDDY.md)。'' / 'pick'(部屋へ呼ぶ選択の画面)
  const [buddySheet, setBuddySheet] = React.useState('');
  const buddySongKey = songs.map((song) => song.songId).join(',');
  // モードえらびに出す、今日の無料のセッション残り回数(2026-10-07・ユーザー指示「この画面で無料セッション分と券の枚数を見れるように」)
  const buddyStoreState = useRhythmBuddyState();
  const buddyDayKey = useRhythmBuddyDayKey();
  // 「マスモンを呼べるようになった」の一度きりの案内(新しい保存キー。既存のキーは触らない)
  const [buddyIntroSeen, setBuddyIntroSeen] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    (async () => { try { const seen = await storeGet(RHYTHM_BUDDY_SEEN_KEY, false); if (alive) setBuddyIntroSeen(seen === true); } catch (_) { /* 読めなければ出さない */ } })();
    return () => { alive = false; };
  }, []);
  const closeBuddyIntro = (open) => {
    setBuddyIntroSeen(true);
    void storeSet(RHYTHM_BUDDY_SEEN_KEY, true).catch(() => {});
    if (open && onOpenMasuBeat) onOpenMasuBeat();
  };
  // 「マスモンランキングができた」の一度きりの案内と、「マスモンに話しかけてみよう」の一度きりの案内(新しい保存キー)。
  // 読めなければ出さない。先に「マスモンを呼べるようになった」案内を出し、それを閉じてから出す(2枚が重ならない)
  const [rankIntroSeen, setRankIntroSeen] = React.useState(true);
  const [talkTipSeen, setTalkTipSeen] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try { const seen = await storeGet(RHYTHM_BUDDY_RANK_SEEN_KEY, false); if (alive) setRankIntroSeen(seen === true); } catch (_) { /* 出さない */ }
      try { const seen = await storeGet(RHYTHM_BUDDY_TALK_SEEN_KEY, false); if (alive) setTalkTipSeen(seen === true); } catch (_) { /* 出さない */ }
    })();
    return () => { alive = false; };
  }, []);
  const closeRankIntro = (open) => {
    setRankIntroSeen(true);
    void storeSet(RHYTHM_BUDDY_RANK_SEEN_KEY, true).catch(() => {});
    if (open) openRankHub('buddy');
  };
  const closeTalkTip = () => { setTalkTipSeen(true); void storeSet(RHYTHM_BUDDY_TALK_SEEN_KEY, true).catch(() => {}); };
  // 払ったものは、呼んだ1回ごとの控え(mh_rhythm_buddy_v1 の calls)で数える(2026-10-09・ユーザー指示「1曲も始まらなければ返す」)。
  //   人が来て席をゆずった … いままでどおり返す(cpuBrain.refund)
  //   部屋を出た(呼んだ人が抜けた・部屋が解散した) … 1曲も始まっていなければ返す(cpuBrain.ended)。1曲始まったら使った扱い(cpuBrain.started)
  //   アプリを閉じて残った控え … 次にモンヒロビートを開いたとき一度だけ返す(rhythmBuddySettleLeftoversOnce)
  const refundBuddy = (masuId, callId) => {
    void rhythmBuddySettle(callId, 'bump', onRefundBuddyTicket);
    setBuddyBumped(true);
  };
  const endBuddy = (masuId, callId) => {
    void rhythmBuddySettle(callId, 'end', onRefundBuddyTicket).then((paid) => { if (paid) RHYTHM_BUDDY_REFUND_NOTE.add(paid); });
  };
  const startBuddy = (masuId, callId) => { void RHYTHM_BUDDY_STORE.update((st) => rhythmBuddyMarkStarted(st, callId)); };
  const [buddyBumped, setBuddyBumped] = React.useState(false);
  React.useEffect(() => { RHYTHM_MULTI.setCpuBrain({ ...rhythmBuddyMakeBrain(songs), refund: refundBuddy, ended: endBuddy, started: startBuddy }); }, [buddySongKey]);
  React.useEffect(() => { void rhythmBuddySettleLeftoversOnce(onRefundBuddyTicket); }, []);
  const buddyRefundNote = useRhythmBuddyRefundNote();
  // 呼ぶ: 先に今日の無料ぶん、なければセッション券を1枚使ってから部屋へ入れる。払ったのと同時に控えを残す
  const callBuddy = async (masu) => {
    if (!masu || !RHYTHM_MULTI.canSummon()) { setBuddySheet(''); return; }
    const day = rhythmBuddyDayKey(Date.now());
    const call = { id: rhythmBuddyCallId(), masuId: masu.id, at: Date.now(), load: RHYTHM_BUDDY_LOAD_ID };
    let paid = (await RHYTHM_BUDDY_STORE.update((st) => rhythmBuddyUseFreeWithCall(st, day, call))) ? 'free' : '';
    if (!paid && onUseBuddyTicket) {
      try { paid = (await onUseBuddyTicket()) === true ? 'ticket' : ''; } catch (_) { paid = ''; }
      if (paid) await RHYTHM_BUDDY_STORE.update((st) => rhythmBuddyAddCall(st, { ...call, paid: 'ticket', day }));
    }
    if (!paid) return;
    setBuddyBumped(false);
    const mon = RHYTHM_BUDDY_STORE.get().mons[masu.id];
    const joined = RHYTHM_MULTI.summon({ masuId: masu.id, callId: call.id, name: rhythmBuddyMasuName(masu), level: mon ? rhythmBuddyLevelInfo(mon.exp).level : 1, baseId: masu.baseId, colors: getMasuColors(masu) });
    // 払っているあいだに満員・ライブ中になって入れなかったら、払ったぶんをすぐ返す
    if (!joined) endBuddy(masu.id, call.id);
    setBuddySheet('');
  };
  const buddySongName = (id) => { const song = songs.find((x) => x.songId === id); return song ? rhythmSongFullName(song) : '(曲)'; };
  // 部屋の中で相棒の札を押したときの窓。開いているのは札の id(呼んだ子が帰ったら自然に消える)
  const [buddyInfoId, setBuddyInfoId] = React.useState('');
  const openBuddyInfo = (m) => { if (m && m.cpu) setBuddyInfoId(m.id); };
  const buddyInfoMember = buddyInfoId && view ? (view.members || []).find((x) => x && x.id === buddyInfoId) : null;
  const buddyInfoMine = buddyInfoMember && view && view.myCpus ? view.myCpus.find((c) => c.id === buddyInfoMember.id) : null;
  const buddyInfoLayer = buddyInfoMember ? (
    <RhythmMultiBuddyInfoSheet m={buddyInfoMember} songName={buddySongName} resolveIconUrl={resolveIconUrl} onClose={() => setBuddyInfoId('')}
      masu={buddyInfoMine ? (masuMons || []).find((x) => x && x.id === buddyInfoMine.masuId) || null : null} />
  ) : null;
  // 自分のライブが始まったら閉じる(演奏から戻ったときに窓が残らないように)
  const buddyInfoPhase = view && view.room ? view.room.phase : '';
  React.useEffect(() => { if (buddyInfoPhase === 'playing') setBuddyInfoId(''); }, [buddyInfoPhase]);
  const buddySheetLayer = buddySheet === 'pick' ? (
    <RhythmBuddySheet masuMons={masuMons} masuPicker={masuPicker} songName={buddySongName} tickets={buddyTickets} pick={callBuddy} onClose={() => setBuddySheet('')}
      calledIds={(view && view.myCpus ? view.myCpus : []).map((c) => c.masuId)} />
  ) : null;
  const buddyCallButton = (extra = '') => (view && RHYTHM_MULTI.canSummon() && masuMons.length > 0 ? (
    <button data-rhythm-buddy-open type="button" onClick={() => setBuddySheet('pick')}
      className={`min-h-[44px] w-full rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 px-2 text-sm font-black text-slate-950 ${extra}`}>
      🎵 マスモンを呼ぶ<small className="block text-[9px] font-bold opacity-80">マスモンがCPUとして一緒に遊びます</small>
    </button>
  ) : null);
  const mine = view ? view.members.find((m) => m.id === view.selfId) : null;
  const [selSongId, setSelSongId] = React.useState(mine && mine.pick && mine.pick !== RHYTHM_MULTI_OMAKASE ? mine.pick : '');
  const [selectView, setSelectView] = React.useState(null);
  const songById = (songId) => songs.find((song) => song.songId === songId) || null;
  const defaultDiff = difficultyIds.includes('NORMAL') ? 'NORMAL' : difficultyIds[0] || '';
  const me = mine;
  const isHost = !!view && view.hostId === view.selfId;
  const room = view ? view.room : null;
  const myDiffId = me && me.diff ? me.diff : defaultDiff;
  // 抽選された曲で、自分が遊べる難易度(ソロと同じく、鍵の掛かった難易度は選べない)
  const drawnSong = room && room.songId ? songById(room.songId) : null;
  const drawnDiffs = drawnSong ? difficultiesOf(drawnSong) : [];
  const drawnOpenDiffs = drawnSong ? drawnDiffs.filter((d) => rhythmDifficultyUnlocked(drawnSong.songId, d.id, bestRecords)) : [];
  const pickPlayDifficulty = () => rhythmMultiPickDifficulty(drawnOpenDiffs.length ? drawnOpenDiffs : drawnDiffs, RHYTHM_MULTI.myDiff() || defaultDiff, difficultyIds);

  // ---- フレンド(公開前はすべて動かない) ----
  // 招待は Supabase の friend_invites へ書く。受ける側は、ルームに入っていないあいだだけ数秒ごとに読む。
  // 出すのは「承認済みのフレンド」からの3分以内の招待だけ。保存データ・ランキングには触れない
  const friendsOn = RELEASE_FLAGS.friends === true;
  const [friendSelfId, setFriendSelfId] = React.useState('');
  const [roster, setRoster] = React.useState(null);        // フレンド名簿(承認済みのみ)。null=まだ読んでいない
  const [friendInvites, setFriendInvites] = React.useState([]);
  const [invitePanel, setInvitePanel] = React.useState(false);
  const [invitedIds, setInvitedIds] = React.useState({});
  const [inviteMessage, setInviteMessage] = React.useState('');
  const loadRoster = React.useCallback(async (id) => {
    try { setRoster(await sbFetchFriendRoster(id)); } catch (_) { setRoster([]); }
  }, []);
  React.useEffect(() => {
    if (!friendsOn) return undefined;
    let cancelled = false;
    (async () => {
      const id = await ensureBreederId();
      if (cancelled || !id) return;
      setFriendSelfId(id);
      await loadRoster(id);
    })();
    return () => { cancelled = true; };
  }, [friendsOn]);
  // 同じ部屋にいた人を「最近いっしょに遊んだ人」として端末に覚える(あとからフレンド画面で申請できる)。
  // 相手のブリーダーIDは知らせ(hb)に載ってくる。自分と同じ・IDの無い人は覚えない。サーバーへは送らない
  const recentSig = view ? view.members.map((m) => `${m.bid || ''}:${m.name || ''}`).join(',') : '';
  React.useEffect(() => {
    if (!friendsOn || !view || !friendSelfId) return;
    const others = view.members.filter((m) => m.bid && m.bid !== friendSelfId && m.id !== view.selfId).map((m) => ({ id: m.bid, name: m.name }));
    if (others.length) friendsRememberRecent(others);
  }, [friendsOn, recentSig, friendSelfId]);
  const hasRoster = !!(roster && roster.length);
  React.useEffect(() => {
    if (!friendsOn || view || !friendSelfId || !hasRoster) { setFriendInvites([]); return undefined; }
    let cancelled = false;
    const ids = new Set(roster.map((friend) => friend.otherId));
    const poll = async () => {
      try {
        const list = await sbFetchRoomInvites(friendSelfId, Date.now());
        if (!cancelled) setFriendInvites(list.filter((invite) => ids.has(invite.senderId)));
      } catch (_) { /* 通信できないときは、次の確認まで何も出さない */ }
    };
    poll();
    const timer = setInterval(poll, FRIEND_INVITE_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [friendsOn, !!view, friendSelfId, roster]);
  const friendNameOf = (id) => ((roster || []).find((friend) => friend.otherId === id) || {}).userName || 'フレンド';
  const openInvitePanel = () => {
    const next = !invitePanel;
    setInvitePanel(next);
    setInviteMessage('');
    if (next && friendSelfId) loadRoster(friendSelfId);   // 直前に承認したフレンドも出せるよう、開くたびに読み直す
  };
  const inviteFriend = async (friendId) => {
    if (!view || !friendSelfId) return;
    const result = await sbSendRoomInvite(friendSelfId, friendId, view.code);
    if (result === 'invited') { setInvitedIds((prev) => ({ ...prev, [friendId]: true })); setInviteMessage(''); }
    else setInviteMessage(result === 'notready' ? 'フレンド機能はただいま準備中です' : '招待を送れませんでした。もう一度ためしてください');
  };

  // ライブ開始の合図が来たら 3・2・1 を数えて演奏へ入る。数えるのは受け取った時刻から(端末の時計のずれに左右されない)
  React.useEffect(() => RHYTHM_MULTI.onStart((info) => {
    setCountdown({ info, left: RHYTHM_MULTI_START_COUNTDOWN_SEC });
    setChatOpen(false);
    setRankingOpen(false);
  }), []);
  React.useEffect(() => {
    if (!countdown) return undefined;
    if (countdown.left <= 0) {
      const song = songById(countdown.info.songId);
      const diffs = song ? difficultiesOf(song) : [];
      const open = song ? diffs.filter((d) => rhythmDifficultyUnlocked(song.songId, d.id, bestRecords)) : [];
      const diff = song ? rhythmMultiPickDifficulty(open.length ? open : diffs, RHYTHM_MULTI.myDiff() || defaultDiff, difficultyIds) : null;
      setCountdown(null);
      if (song && diff) onStartPlay(song, diff, countdown.info.round, countdown.info.count, countdown.info.streak, countdown.info.cpus || 0);
      else RHYTHM_MULTI.reportResult(countdown.info.round, null, true, { noPenalty: true });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ? { ...c, left: c.left - 1 } : c)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // MUSIC SHUFFLE: 全員の選曲を早送りで回し、最後に決まった曲で止める(本家の演出を参考)
  const shuffleRound = room && room.phase === 'ready' && view.shuffleShown !== room.round ? room.round : '';
  const [shuffleIndex, setShuffleIndex] = React.useState(0);
  const [shuffleStopped, setShuffleStopped] = React.useState(false);
  React.useEffect(() => {
    if (!shuffleRound) return undefined;
    setShuffleStopped(false);
    const tick = setInterval(() => setShuffleIndex((n) => n + 1), 110);
    const stop = setTimeout(() => { clearInterval(tick); setShuffleStopped(true); }, RHYTHM_MULTI_SHUFFLE_MS - 800);
    const done = setTimeout(() => RHYTHM_MULTI.markShuffleShown(shuffleRound), RHYTHM_MULTI_SHUFFLE_MS);
    return () => { clearInterval(tick); clearTimeout(stop); clearTimeout(done); };
  }, [shuffleRound]);

  // 曲の試聴(本体が鳴らす)へ、いま鳴らしたい曲を知らせる。
  //   選曲中 … 曲えらびで見ている曲(まだ触っていなければ一覧の先頭)
  //   シャッフル・難易度選択・ライブの直前 … 決まった曲
  //   それ以外 … '' (本体はソロで選んでいた曲を鳴らし続ける)
  const previewPhase = room ? room.phase : '';
  // シャッフルの演出中は、まだ答えを鳴らさない(選曲中の曲のまま)
  const selectPreviewId = selSongId || (songs[0] ? songs[0].songId : '');
  // 曲が決まった瞬間(シャッフルの始まり)から、決まった曲を流す。ライブが始まるまで切り替えない
  // (2026-10-03・ユーザー報告「難易度設定で音が一回なくなって最初からになる」「一瞬モンスターヒーローが流れる」)
  const previewId = previewPhase === 'select' ? selectPreviewId
    : (previewPhase === 'ready' || previewPhase === 'playing') && room.songId ? room.songId : '';
  React.useEffect(() => { if (onPreviewSong) onPreviewSong(previewId); }, [previewId]);

  const myProfile = () => ({ name: profile.name, level: profile.level, icon: profile.icon, frame: profile.frame, diff: defaultDiff, bid: friendSelfId });
  const createPrivate = () => { setMessage(''); RHYTHM_MULTI.join(rhythmMultiMakeCode(), myProfile(), 'private'); };
  const joinFromInvite = (invite) => {
    setMessage('');
    RHYTHM_MULTI.join(invite.roomCode, myProfile(), 'private');
  };
  const joinPrivate = () => {
    const code = rhythmMultiNormalizeCode(codeInput);
    if (!code) { setMessage(`部屋コードは${RHYTHM_MULTI_CODE_LENGTH}文字です`); return; }
    setMessage('');
    RHYTHM_MULTI.join(code, myProfile(), 'private');
  };
  // フリー: 空きのある部屋を探して入る(ベテランは2026-10-03に画面から外した。部屋さがしの仕組みは残してある)。無ければ自分で部屋を作って、人が来るのを待つ
  const searchRoom = async (kind) => {
    setMessage('');
    const left = await rhythmMultiPenaltyLeftMs();
    if (left > 0) { setMessage(`途中でやめたため、あと${Math.ceil(left / 60000)}分は公開ルームに入れません`); return; }
    setSearching(kind);
  };
  React.useEffect(() => {
    if (!searching) return undefined;
    let alive = true;
    RHYTHM_MULTI.findRoom(searching).then((code) => {
      if (!alive) return;
      RHYTHM_MULTI.join(code || rhythmMultiMakeCode(), myProfile(), searching);
      setSearching(null);
    });
    return () => { alive = false; };
  }, [searching]);
  const leaveRoom = () => { RHYTHM_MULTI.leave(); setCountdown(null); setChatOpen(false); setRankingOpen(false); setSearching(null); };
  // 「マスモンを呼ぶ」を閉じた直後の「ルームを出る」は受け付けない(2026-10-07・モンヒロくんの反応の点検で見つけた)。
  // 呼ぶ画面の「呼ぶ」(右下)のちょうど真下に「ルームを出る」(横いっぱい)があり、「呼ぶ」を二度押しすると
  // 2回目が「ルームを出る」に当たって、呼んだマスモンごと部屋から出てしまっていた。閉じてから少しのあいだだけ無視する
  const buddySheetClosedAtRef = React.useRef(0);
  const buddySheetWasOpenRef = React.useRef(false);
  React.useEffect(() => {
    // マスモンのステータスの窓(下の「閉じる」)も同じ場所にあるので、同じように守る
    if (buddySheet || buddyInfoId) { buddySheetWasOpenRef.current = true; return; }
    if (buddySheetWasOpenRef.current) { buddySheetWasOpenRef.current = false; buddySheetClosedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  }, [buddySheet, buddyInfoId]);
  const leaveRoomAfterTap = () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (buddySheetClosedAtRef.current > 0 && now - buddySheetClosedAtRef.current < RHYTHM_BUDDY_LEAVE_GUARD_MS) return;
    leaveRoom();
  };
  // モードえらび(modeSelect あり)で部屋に入れたら、対戦の画面(RHYTHM_MULTI)へ移る。
  // 対戦の画面で部屋が無くなったら(出た・満員で抜けた)、モードえらびへ戻る
  const inRoom = !!view;
  React.useEffect(() => {
    if (modeSelect) { if (inRoom && onRoomEntered) onRoomEntered(); return; }
    if (!inRoom && !searching && onBack) onBack();
  }, [inRoom, !!searching]);
  const shareCode = async () => {
    if (!view) return;
    const text = `モンヒロビートで協力ライブしよう! 部屋コード: ${view.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* 共有をやめたときは何もしない */ }
  };

  const card = 'rounded-2xl border border-white/15 bg-slate-900/85 p-3';
  const btn = 'min-h-[48px] rounded-xl px-3 font-black disabled:opacity-40';
  const shell = 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white';
  // 選曲の制限時間を、次の候補へ切り替える(部屋主だけ)
  const cycleSelectSec = () => {
    const list = RHYTHM_MULTI_SELECT_SEC_OPTIONS;
    const now = room ? rhythmMultiNormalizeSelectSec(room.selectSec) : RHYTHM_MULTI_SELECT_SEC_DEFAULT;
    RHYTHM_MULTI.setSelectSeconds(list[(list.indexOf(now) + 1) % list.length]);
  };
  // 見出しの右に置く「マスモンを呼ぶ」。選曲中は縦も横も、画面の上にいつも見えるようにする(2026-10-07・ユーザー指示
  // 「横画面だとマスモンも呼ぶがわかりづらい」。曲の一覧の注意書きの中にあったので、横画面では隠れていた)。呼んでいる数も出す
  const selectTimeButton = (extra = '', narrow = false) => (
    <button {...(narrow ? { 'data-rhythm-multi-select-time-narrow': true } : { 'data-rhythm-multi-select-time': true })} type="button" aria-label={`選曲の制限時間 ${rhythmMultiSelectSecLabel(room.selectSec)}。押すと切り替え`} onClick={cycleSelectSec}
      className={`min-h-[40px] shrink-0 rounded-xl border border-amber-300/50 bg-amber-950/40 px-2 text-[11px] font-black leading-tight text-amber-100 ${extra}`}>選曲<br />{rhythmMultiSelectSecLabel(room.selectSec)}</button>
  );
  const buddyHeaderButton = (extra = '') => (view && RHYTHM_MULTI.canSummon() && masuMons.length > 0 ? (
    <button data-rhythm-buddy-open data-rhythm-buddy-header type="button" aria-label="マスモンを呼ぶ" onClick={() => setBuddySheet('pick')}
      className={`relative flex min-h-[44px] min-w-[52px] max-[480px]:min-w-[46px] max-[380px]:min-w-[42px] shrink-0 flex-col items-center justify-center rounded-xl border border-lime-300/70 bg-gradient-to-b from-lime-400 to-emerald-600 px-1.5 max-[480px]:px-1 leading-none text-slate-950 ${extra}`}>
      <span aria-hidden="true" className="text-base">🎵</span>
      <span className="text-[10px] font-black">マスモン</span>
      {view.myCpus && view.myCpus.length > 0 && <b className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-slate-950 px-1 text-[10px] font-black leading-[18px] text-lime-200">{view.myCpus.length}</b>}
    </button>
  ) : null);
  // 本家の左上の題字(MULTI LIVE)と、その下の小さな段の名前。右に残り時間とチャット
  const header = (step, onBackClick, opts = {}) => (
    <header className="z-10 flex shrink-0 items-center gap-2 max-[480px]:gap-1.5 border-b border-cyan-400/15 bg-slate-950/95 px-2 py-1" style={{ paddingTop: 'calc(0.25rem + var(--mh-sa-top))' }}>
      <button data-rhythm-multi-back type="button" aria-label="戻る" className="min-h-[44px] min-w-[44px] max-[380px]:min-w-[36px] shrink-0 rounded-xl text-lg font-black text-slate-300" onClick={onBackClick}>←</button>
      <div className="min-w-0 flex-1 leading-none">
        <b className="block truncate text-base font-black italic tracking-wider text-cyan-200">MULTI LIVE</b>
        <small className="mt-0.5 block truncate text-[10px] font-black text-fuchsia-200">▶ {step}{view ? ` ・ ${view.mode === 'private' ? '友だち' : RHYTHM_MULTI_MODE_LABELS[view.mode]} ${view.code}` : ''}</small>
      </div>
      {/* クイック∞周回を裏で回しているときの進み具合(曲えらびの帯と同じ中身)。対戦の待ち時間も周回は進む */}
      {quickRunInfo && <small data-rhythm-multi-quick-run className={`max-w-[38%] max-[480px]:max-w-[24%] shrink truncate rounded-full border px-2 py-1 text-[10px] font-black ${quickRunInfo.finished ? 'border-amber-300/50 text-amber-200' : 'border-fuchsia-400/40 text-fuchsia-100'}`}>
        {quickRunInfo.finished ? quickRunInfo.reason : `🔁 WAVE ${quickRunInfo.wave}/10・${quickRunInfo.loops}周目${quickRunInfo.catchingUp ? '・追いつき中' : ''}`}
      </small>}
      {/* ホストだけの「待たずに進む」(2026-10-03・ユーザー指示「時間を待たずに先に進めるボタンもほしい」) */}
      {opts.buddy && buddyHeaderButton()}
      {opts.advance && isHost && <button data-rhythm-multi-advance type="button" onClick={() => { if (opts.gesture && onUserGesture) onUserGesture(); RHYTHM_MULTI.hostAdvance(); }}
        className="min-h-[40px] shrink-0 rounded-xl bg-fuchsia-700 px-2 text-[11px] font-black">{opts.advance}</button>}
      {/* 部屋主だけの、選曲の制限時間の切り替え(押すたびに 30秒 → 60秒 → 90秒 → なし)。横画面でも見えるようヘッダーに置く */}
      {opts.selectTime && view && room && isHost && selectTimeButton('max-[480px]:hidden landscape:block')}
      {opts.timer != null && <b data-rhythm-multi-timer className={`shrink-0 rounded-full px-2 py-1 text-sm font-black tabular-nums ${opts.timer <= 5 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-amber-200'}`}>⏱ {opts.timer}</b>}
      {/* 縦⇄横の切り替え(曲えらびと同じボタン。2026-10-03・ユーザー報告「縦横が変えられない」) */}
      <RhythmOrientationButton/>
      {view && rankingButton()}
      {view && chatButton()}
    </header>
  );
  // 💬 ボタン。閉じているあいだに届いた発言の数を赤い丸で出す
  const chatButton = (extra = '') => (
    <button data-rhythm-multi-chat-open type="button" aria-label={chatUnread ? `チャット(未読${chatUnread}件)` : 'チャット'} onClick={() => setChatOpen((v) => !v)}
      className={`relative min-h-[44px] min-w-[44px] max-[380px]:min-w-[38px] shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-lg ${extra}`}>
      💬
      {chatUnread > 0 && <b data-rhythm-multi-chat-unread className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-rose-500 px-1 text-[11px] font-black leading-5 text-white">{chatUnread > 9 ? '9+' : chatUnread}</b>}
    </button>
  );
  // 🏆 全国ランキング(部屋の中。2026-10-04・ユーザー指示「マルチ中にもランキングボタンいれて」)。
  // 見る曲は、選曲中なら見ている曲、決まったあと(難易度えらび・結果)ならその曲、まだ無ければ一覧の先頭
  const rankingSongId = (room && room.phase !== 'select' && room.songId) ? room.songId : (selSongId || (songs[0] ? songs[0].songId : ''));
  const openRanking = () => {
    const song = songById(rankingSongId);
    if (!song || !rankingSupport) return;
    rankingSupport.open(song);
    setChatOpen(false);
    setRankingOpen(true);
  };
  // モードえらびの「ランキング」。全国ランキング(いつもの画面)とマスモンランキングを切り替える。
  // 全国のほうは曲ごとの順位なので、見る曲は部屋の中のときと同じ決め方
  const openRankHub = (tab) => {
    const song = songById(rankingSongId);
    if (rankingSupport && song) rankingSupport.open(song);
    setRankHubTab(tab === 'buddy' ? 'buddy' : 'national');
    setRankHubOpen(true);
  };
  const rankingButton = (extra = '') => rankingSupport && (
    <button data-rhythm-multi-ranking type="button" aria-label="全国ランキング" onClick={openRanking}
      className={`min-h-[44px] min-w-[44px] max-[380px]:min-w-[38px] shrink-0 rounded-xl border border-amber-400/50 bg-amber-950/40 text-lg ${extra}`}>🏆</button>
  );
  // ランキングは対戦の画面の上へ重ねる(画面を移すと、ライブ開始の合図を受ける側が外れて取り逃すため)
  const rankingLayer = rankingOpen && rankingSupport && view && (
    <div data-rhythm-multi-ranking-layer className="absolute inset-0 z-[88000] flex min-h-0 flex-col bg-slate-950">
      {rankingSupport.render(() => setRankingOpen(false))}
    </div>
  );
  // 最新の発言を添えた💬(結果画面用)。押すとチャット欄が開く
  const chatLatestButton = () => {
    const last = chatList.length ? chatList[chatList.length - 1] : null;
    return (
      <button data-rhythm-multi-chat-open type="button" onClick={() => setChatOpen(true)} aria-label={chatUnread ? `チャット(未読${chatUnread}件)` : 'チャット'}
        className="relative flex min-h-[42px] w-[30%] max-w-[200px] shrink-0 items-center gap-1.5 rounded-2xl border border-cyan-400/50 bg-cyan-950/50 px-2 text-left">
        <span aria-hidden="true" className="text-xl leading-none">💬</span>
        <span className="min-w-0 flex-1 leading-tight">
          <small className="block text-[9px] font-black text-cyan-200">{last ? last.name : 'チャット'}</small>
          <b data-rhythm-multi-chat-latest className="block truncate text-[12px] font-black text-white">{last ? last.text : 'タップで開く'}</b>
        </span>
        {chatUnread > 0 && <b data-rhythm-multi-chat-unread className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-rose-500 px-1 text-[11px] font-black leading-5 text-white">{chatUnread > 9 ? '9+' : chatUnread}</b>}
      </button>
    );
  };
  // チャット欄。外側(暗いところ)を押しても閉じる。縦画面は下から8割、横画面は右半分を高さいっぱい
  const chatSheet = chatOpen && view && (
    <div className="absolute inset-0 z-[80000]">
      <button type="button" aria-label="チャットを閉じる" className="absolute inset-0 bg-slate-950/55" onClick={() => setChatOpen(false)} />
      <div data-rhythm-multi-chat-sheet className="absolute inset-x-0 bottom-0 flex h-[80%] flex-col rounded-t-2xl border-t border-cyan-400/40 bg-slate-900 p-2.5 shadow-2xl landscape:inset-y-0 landscape:left-auto landscape:right-0 landscape:h-full landscape:w-[50%] landscape:rounded-none landscape:rounded-l-2xl landscape:border-l landscape:border-t-0 landscape:pt-[calc(.6rem+var(--mh-sa-top))]" style={{ paddingBottom: 'calc(.6rem + var(--mh-sa-bottom))' }}>
        <RhythmMultiChatPanel view={view} phase={room ? room.phase : ''} members={view.members} resolveIconUrl={resolveIconUrl} onClose={() => setChatOpen(false)} askName={(view.myCpus || []).length > 0 ? ((view.members.find((m) => m.id === view.myCpus[0].id) || {}).name || 'マスモン') : ''} talkTip={!talkTipSeen && (view.myCpus || []).length > 0 ? ((view.members.find((m) => m.id === view.myCpus[0].id) || {}).name || 'マスモン') : ''} onTalkTipClose={closeTalkTip} />
      </div>
    </div>
  );
  const countdownLayer = countdown && (
    <div data-rhythm-multi-countdown className="absolute inset-0 z-[90000] flex flex-col items-center justify-center bg-slate-950/90">
      <small className="text-[11px] font-black tracking-widest text-slate-400">LIVE START</small>
      <p className="px-4 text-center text-base font-black text-cyan-200">{songById(countdown.info.songId) ? rhythmSongFullName(songById(countdown.info.songId)) : ''}</p>
      <b className="text-8xl font-black text-white">{Math.max(1, countdown.left)}</b>
    </div>
  );

  // ①モードえらび(2026-10-03・ユーザー指示「モンビーを始めたときにまずモード選択画面」「ソロモード、マルチモード、
  // マスモン選択などいれられる場所を作る」「マルチのベテランはなくしていい」。参考はプロセカの SELECT ROOM)。
  // ここは RHYTHM_MODE_SELECT の画面として描く(modeSelect を受け取ったとき)。部屋に入ったら onRoomEntered で
  // RHYTHM_MULTI へ移る。RHYTHM_MULTI で部屋を出たら(view が無くなったら)モードえらびへ戻す(下の useEffect)。
  // 横画面(推奨)では左に助手の立ち絵とひとこと、右に遊び方のボタンを並べる
  if (!view && !searching && modeSelect) {
    const ms = modeSelect;
    const tile = 'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 leading-none';
    const assistToggles = (cls, withLabel) => <ModeSelectAssistToggles assistant={ms.assistant} showArt={ms.showArt} showComment={ms.showComment} onToggle={ms.onToggleAssistant} cls={cls} withLabel={withLabel} />;
    return (
      <main data-rhythm-mode-select data-rhythm-multi-step="rooms" className={`${shell} mhms-stage`}>
        <RhythmModeSelectStage />
        <header className="relative z-10 flex shrink-0 items-center gap-1.5 border-b border-fuchsia-300/20 bg-slate-950/55 px-2 py-1 backdrop-blur-sm" style={{ paddingTop: 'calc(0.25rem + var(--mh-sa-top))' }}>
          {/* 戻るとHOMEへ。裏でクイック∞周回が回っているときは、締めてから戻る(曲えらびにあった戻るボタンの役目をここへ移した) */}
          <button data-rhythm-back data-quick-run-finishing={ms.backgroundRun ? '1' : undefined} data-quick-run-exiting={ms.exiting ? '1' : undefined} disabled={!!ms.exiting}
            type="button" aria-label={ms.exiting ? '周回を終えています' : ms.backgroundRun ? '周回を終えてホームへ戻る' : '戻る'} onClick={ms.onExit}
            className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl font-black ${ms.exiting ? 'text-amber-300/60' : ms.backgroundRun ? 'text-amber-200' : 'text-lg text-slate-300'}`}>
            {ms.backgroundRun ? <span className="text-[10px] leading-tight">⏹<br />終了</span> : '←'}
          </button>
          <div className="min-w-0 flex-1 leading-none">
            <small className="block truncate text-[8px] font-black tracking-[0.2em] text-fuchsia-300">MONBEAT ・ SELECT MODE</small>
            <b className="mhms-title block truncate text-lg font-black leading-tight tracking-wider">モードえらび</b>
            {ms.beatPointText && <small data-rhythm-beat-point-balance className="block truncate text-[9px] font-black text-violet-200/90">{ms.beatPointText}</small>}
          </div>
          {quickRunInfo && <small data-rhythm-multi-quick-run className={`max-w-[42%] shrink truncate rounded-full border px-2 py-1 text-[10px] font-black ${quickRunInfo.finished ? 'border-amber-300/50 text-amber-200' : 'border-fuchsia-400/40 text-fuchsia-100'}`}>
            {quickRunInfo.finished ? quickRunInfo.reason : `🔁 WAVE ${quickRunInfo.wave}/10・${quickRunInfo.loops}周目${quickRunInfo.catchingUp ? '・追いつき中' : ''}`}
          </small>}
          <RhythmOrientationButton/>
        </header>
        {ms.exiting && <div data-quick-run-exit-overlay className="absolute inset-0 z-[90000] flex items-center justify-center bg-slate-950/60 px-6 text-center"><b className="text-sm font-black text-amber-200">周回を終えています…</b></div>}
        {/* 縦画面: 上に助手の立ち絵(余った高さを使って大きく)、下にボタン。
            横画面: 左に立ち絵、右にボタン(2026-10-03・ユーザー指摘「サイズ感悪い」で組み直し) */}
        <div className={`relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto landscape:flex-row landscape:overflow-hidden ${ms.showArt && ms.assistant ? '' : 'portrait:justify-center'}`}>
          <ModeSelectAssistantPanel assistant={ms.assistant} showArt={ms.showArt} showComment={ms.showComment} onToggle={ms.onToggleAssistant} />
          <div className="shrink-0 space-y-2 p-3 landscape:flex landscape:min-h-0 landscape:flex-1 landscape:shrink landscape:flex-col landscape:justify-center landscape:space-y-2.5 landscape:overflow-y-auto landscape:py-2">
            {!(ms.assistant && (ms.showArt || ms.showComment)) && assistToggles('justify-end', true)}
            {friendsOn && friendInvites.length > 0 && (
              <section data-rhythm-multi-friend-invites className={`${card} space-y-2 border-pink-400/60`}>
                <h3 className="text-xs font-black text-pink-200">フレンドからの招待</h3>
                {friendInvites.map((invite) => (
                  <div key={invite.senderId} className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5">
                    <span className="min-w-0 flex-1 break-words text-[13px] font-black leading-snug">{friendNameOf(invite.senderId)}さんが部屋に誘っています</span>
                    <button data-rhythm-multi-friend-join type="button" className={`${btn} shrink-0 bg-pink-700 text-xs`} onClick={() => joinFromInvite(invite)}>参加する</button>
                  </div>
                ))}
              </section>
            )}
            <div className={`grid gap-2 ${ms.multi ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* ソロ: いつもの曲えらびへ */}
              <button data-rhythm-mode-solo type="button" onClick={ms.onSolo}
                className="mhms-card mhms-in flex min-h-[80px] min-w-0 flex-col items-start justify-center gap-1 bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-400 px-3 text-left text-slate-950 active:scale-[.97] landscape:min-h-[76px] landscape:flex-row landscape:items-center landscape:gap-2" style={{ animationDelay: '.05s' }}>
                <span aria-hidden="true" className="mhms-mark">SOLO LIVE</span>
                <span aria-hidden="true" className="mhms-ico relative text-3xl leading-none">🎵</span>
                <span className="relative min-w-0"><b className="block text-[18px] font-black italic leading-tight">ソロライブ</b><small className="block text-[10px] font-black leading-tight text-slate-800/80">ひとりで好きな曲を演奏</small></span>
              </button>
              {/* マルチ: フリーマッチ(だれとでも)。ベテランは無くした(2026-10-03・ユーザー指示) */}
              {ms.multi && <button data-rhythm-multi-free type="button" onClick={() => searchRoom('free')}
                className="mhms-card free mhms-in flex min-h-[80px] min-w-0 flex-col items-start justify-center gap-1 bg-gradient-to-br from-pink-300 via-fuchsia-400 to-violet-500 px-3 text-left text-slate-950 active:scale-[.97] landscape:min-h-[76px] landscape:flex-row landscape:items-center landscape:gap-2" style={{ animationDelay: '.12s' }}>
                <span aria-hidden="true" className="mhms-mark">FREE MATCH</span>
                <span aria-hidden="true" className="mhms-ico relative text-3xl leading-none">🎮</span>
                <span className="relative min-w-0"><b className="block text-[18px] font-black italic leading-tight">フリーマッチ</b><small className="block text-[10px] font-black leading-tight text-slate-900/80">だれとでも最大{RHYTHM_MULTI_ROOM_MAX}人で協力</small><RhythmMultiLobbyCount /></span>
              </button>}
              {/* プライベートルーム: 友だちと遊ぶ。作成と、コードを入れての入室は、押すと開くシートへ(2026-10-07・「ダサいので一新して」) */}
              {ms.multi && <button data-rhythm-mode-private data-rhythm-mode-private-open type="button" onClick={() => { setMessage(''); setPrivateOpen(true); }}
                className="mhms-card private mhms-in flex min-h-[80px] min-w-0 flex-col items-start justify-center gap-1 bg-gradient-to-br from-sky-200 via-sky-400 to-blue-500 px-3 text-left text-slate-950 active:scale-[.97] landscape:min-h-[76px] landscape:flex-row landscape:items-center landscape:gap-2" style={{ animationDelay: '.2s' }}>
                <span aria-hidden="true" className="mhms-mark">PRIVATE</span>
                <span aria-hidden="true" className="mhms-ico relative text-3xl leading-none">🔑</span>
                <span className="relative min-w-0"><b className="block text-[18px] font-black italic leading-tight">プライベート</b><small className="block text-[10px] font-black leading-tight text-slate-900/80">合言葉で友だちと遊ぶ</small></span>
              </button>}
              {/* ランキング: 全国ランキングとマスモンランキング */}
              {ms.multi && <button data-rhythm-mode-ranking type="button" onClick={() => openRankHub('national')}
                className="mhms-card rank mhms-in flex min-h-[80px] min-w-0 flex-col items-start justify-center gap-1 bg-gradient-to-br from-lime-200 via-emerald-300 to-teal-500 px-3 text-left text-slate-950 active:scale-[.97] landscape:min-h-[76px] landscape:flex-row landscape:items-center landscape:gap-2" style={{ animationDelay: '.24s' }}>
                <span aria-hidden="true" className="mhms-mark">RANKING</span>
                <span aria-hidden="true" className="mhms-ico relative text-3xl leading-none">🏆</span>
                <span className="relative min-w-0"><b className="block text-[18px] font-black italic leading-tight">ランキング</b><small className="block text-[10px] font-black leading-tight text-slate-900/80">全国とマスモンの順位</small></span>
              </button>}
            </div>
            {message && !privateOpen && <p data-rhythm-multi-message className="text-[12px] font-black text-rose-300">{message}</p>}
            {ms.multi && !buddyIntroSeen && masuMons.length > 0 && (
              <section data-rhythm-buddy-intro className="mhms-in flex items-center gap-2 rounded-2xl border border-lime-300/60 bg-lime-950/80 p-2.5">
                <span aria-hidden="true" className="text-2xl leading-none">🎵</span>
                <p className="min-w-0 flex-1 text-[11px] font-black leading-snug text-lime-100">マスモンを、マルチの部屋に呼べるようになりました。部屋の中の「マスモンを呼ぶ」から呼べて、一緒に遊ぶほどビートLvが上がります</p>
                <button type="button" onClick={() => closeBuddyIntro(true)} className="min-h-[44px] shrink-0 rounded-xl bg-lime-400 px-2.5 text-xs font-black text-slate-950">育ち具合を見る</button>
                <button type="button" aria-label="閉じる" onClick={() => closeBuddyIntro(false)} className="min-h-[44px] min-w-[36px] shrink-0 rounded-xl bg-slate-800 text-sm font-black">✕</button>
              </section>
            )}
            {ms.multi && buddyIntroSeen && !rankIntroSeen && (
              <section data-rhythm-buddy-rank-intro className="mhms-in flex items-center gap-2 rounded-2xl border border-lime-300/60 bg-lime-950/80 p-2.5">
                <span aria-hidden="true" className="text-2xl leading-none">🏆</span>
                <p className="min-w-0 flex-1 text-[11px] font-black leading-snug text-lime-100">「ランキング」に「マスモンランキング」ができました。育てたマスモンのビートLvと最高スコアの順位が見られます</p>
                <button type="button" onClick={() => closeRankIntro(true)} className="min-h-[44px] shrink-0 rounded-xl bg-lime-400 px-2.5 text-xs font-black text-slate-950">見てみる</button>
                <button type="button" aria-label="閉じる" onClick={() => closeRankIntro(false)} className="min-h-[44px] min-w-[36px] shrink-0 rounded-xl bg-slate-800 text-sm font-black">✕</button>
              </section>
            )}
            {/* マスモンを呼べる回数。1日の無料ぶんの残りと、セッション券の枚数(部屋の「マスモンを呼ぶ」で使う) */}
            {ms.multi && (
              <div data-rhythm-mode-session className="mhms-in -my-1 flex items-center justify-center gap-x-2 whitespace-nowrap px-1 text-[10px] leading-none">
                <b className="font-black text-lime-200">🎶 マスモンのセッション</b>
                <RhythmBuddyAllowance freeLeft={rhythmBuddyFreeLeft(buddyStoreState, buddyDayKey)} tickets={buddyTickets} compact className="text-slate-200" />
              </div>
            )}
            {/* マスモン・遊びかた・オプション(曲えらびの上の帯から、マスモンと遊びかたをここへ移した) */}
            <div className={`mhms-in grid gap-2 ${ms.multi ? 'grid-cols-5 gap-1.5' : 'grid-cols-3'}`} style={{ animationDelay: '.28s' }}>
              <button data-rhythm-demo-monsters type="button" aria-label={`マスモン設定(${ms.monsterCount}/${ms.monsterMax}体)`} onClick={ms.onMonsters} className={`${tile} mhms-glass min-w-0 text-fuchsia-100`}>
                <span data-rhythm-demo-monsters-faces aria-hidden="true" className="flex h-6 items-center">{ms.monsterFaces.length
                  ? ms.monsterFaces.map((face, i) => <span key={face.id} className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-fuchsia-200/70 bg-slate-950" style={i ? { marginLeft: '-7px' } : undefined}>{face.src && <img src={face.src} alt="" draggable={false} className="h-full w-full object-cover" />}</span>)
                  : <span className="text-lg leading-none">👾</span>}</span>
                <span className="whitespace-nowrap text-[10px] font-black">マスモン {ms.monsterCount}/{ms.monsterMax}</span>
              </button>
              <button data-rhythm-demo-help type="button" onClick={ms.onHelp} className={`${tile} mhms-glass min-w-0 text-amber-100`}>
                <span aria-hidden="true" className="text-lg leading-none">📖</span><span className="text-[11px] font-black">遊びかた</span>
              </button>
              {ms.multi && <button data-rhythm-mode-record type="button" onClick={() => setRecordOpen(true)} className={`${tile} mhms-glass min-w-0 text-emerald-100`}>
                <span aria-hidden="true" className="text-lg leading-none">📜</span><span className="text-[11px] font-black">記録</span>
              </button>}
              {ms.multi && onOpenMasuBeat && <button data-rhythm-mode-buddy type="button" onClick={onOpenMasuBeat} className={`${tile} mhms-glass min-w-0 text-lime-100`}>
                <span aria-hidden="true" className="text-lg leading-none">📈</span><span className="text-[11px] font-black">ビートLv</span>
              </button>}
              <button data-rhythm-mode-options type="button" onClick={ms.onOptions} className={`${tile} mhms-glass min-w-0 text-cyan-100`}>
                <span aria-hidden="true" className="text-lg leading-none">⚙️</span><span className="whitespace-nowrap text-[11px] font-black">オプション</span>
              </button>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="shrink-0" style={{ height: 'var(--mh-sa-bottom)' }} />
        {recordOpen && <RhythmMultiRecordSheet songName={(id) => { const song = songById(id); return song ? rhythmSongFullName(song) : '(曲)'; }} onClose={() => setRecordOpen(false)} />}
        {buddySheetLayer}
        {buddyRefundNote && <div data-rhythm-buddy-refund role="status" className="pointer-events-none absolute inset-x-3 top-3 z-[86000] mx-auto max-w-sm rounded-xl border border-lime-300/60 bg-slate-950/90 px-3 py-2 text-center text-xs font-black leading-snug text-lime-100 shadow-lg" style={{ marginTop: 'var(--mh-sa-top)' }}>{buddyRefundNote}</div>}
        {/* プライベートルーム: 部屋をつくる / 合言葉で入る(2026-10-07。もとは欄の中に作成・コード・入室を並べていた) */}
        {privateOpen && (
          <div className="absolute inset-0 z-[85000]">
            <button type="button" aria-label="閉じる" className="absolute inset-0 bg-slate-950/70" onClick={() => setPrivateOpen(false)} />
            <div data-rhythm-mode-private-sheet className="absolute inset-x-0 bottom-0 flex max-h-[90%] flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-sky-300/40 bg-slate-900 p-4 shadow-2xl landscape:inset-y-0 landscape:left-auto landscape:right-0 landscape:max-h-full landscape:w-[min(440px,62%)] landscape:rounded-none landscape:border-l landscape:border-t-0" style={{ paddingBottom: 'calc(1rem + var(--mh-sa-bottom))' }}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-2xl leading-none">🔑</span>
                <div className="min-w-0 flex-1 leading-tight"><b className="block text-base font-black text-sky-100">プライベートルーム</b><small className="block text-[11px] font-bold text-slate-400">合言葉で、友だちだけと遊べます</small></div>
                <button type="button" aria-label="閉じる" onClick={() => setPrivateOpen(false)} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 text-sm font-black">✕</button>
              </div>
              <section className="space-y-1.5 rounded-2xl border border-sky-300/25 bg-slate-950/50 p-3">
                <b className="block text-[13px] font-black text-white">部屋をつくる</b>
                <p className="text-[11px] font-bold leading-snug text-slate-300">合言葉(ルームコード)ができます。友だちに伝えて入ってもらいましょう</p>
                <button data-rhythm-multi-create type="button" onClick={createPrivate} className="min-h-[48px] w-full rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,.35)] active:scale-[.98]">＋ 部屋をつくる</button>
              </section>
              <section className="space-y-1.5 rounded-2xl border border-violet-300/25 bg-slate-950/50 p-3">
                <b className="block text-[13px] font-black text-white">合言葉で入る</b>
                <input id="rhythm-multi-code" data-rhythm-multi-code-input aria-label="ルームコード" value={codeInput} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className="min-h-[52px] w-full rounded-xl border border-violet-300/30 bg-slate-950/80 px-2 text-center text-xl font-black tracking-[0.35em] text-white" placeholder="ABCD" />
                <button data-rhythm-multi-join type="button" onClick={joinPrivate} className="min-h-[48px] w-full rounded-xl bg-gradient-to-b from-violet-500 to-purple-700 text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,.35)] active:scale-[.98]">入室する</button>
              </section>
              {message && <p data-rhythm-multi-message className="text-[12px] font-black text-rose-300">{message}</p>}
            </div>
          </div>
        )}
        {/* ランキング: 全国ランキング(いつもの画面)とマスモンランキングを、下のタブで切り替える */}
        {rankHubOpen && (
          <div data-rhythm-mode-ranking-layer className="absolute inset-0 z-[88000] flex min-h-0 flex-col bg-slate-950">
            <div className="flex min-h-0 flex-1 flex-col">
              {rankHubTab === 'national'
                ? (rankingSupport ? rankingSupport.render(() => setRankHubOpen(false)) : null)
                : <RhythmBuddyRankingBoard renderBreederIcon={rankingSupport && rankingSupport.breederIcon} selfName={myProfile().name} onClose={() => setRankHubOpen(false)} friendIds={friendsOn ? (roster || []).map((f) => f.otherId) : null} />}
            </div>
            <div data-rhythm-mode-ranking-tabs className="flex shrink-0 gap-2 border-t border-white/10 bg-slate-900 px-3 pt-2" style={{ paddingBottom: 'calc(0.5rem + var(--mh-sa-bottom))' }}>
              {[['national', '🏆 全国ランキング'], ['buddy', '🎶 マスモンランキング']].map(([id, label]) => (
                <button key={id} type="button" data-rhythm-mode-ranking-tab={id} onClick={() => setRankHubTab(id)}
                  className={`min-h-[44px] min-w-0 flex-1 rounded-xl border px-2 text-[12px] font-black ${rankHubTab === id ? 'border-lime-300 bg-lime-500/25 text-lime-100' : 'border-white/10 bg-slate-800 text-slate-300'}`}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }
  // RHYTHM_MULTI で部屋にいない(出た・閉じられた)ときは、すぐモードえらびへ戻す(下の useEffect が戻す。そのあいだは空の画面)
  if (!view && !searching) return <main data-rhythm-multi data-rhythm-multi-step="leaving" className={shell} />;

  const members = view ? view.members : [];
  const phase = room ? room.phase : 'matching';
  const participant = !!room && room.participants.includes(view.selfId);
  const team = room && room.round && (phase === 'playing' || phase === 'result') ? rhythmMultiTeamResult(members, room.round, room.participants, phase === 'result') : null;
  // 結果を見せる: 自分が参加したライブで、だれかが終わっていて、まだ「次へ」を押していないとき
  const showResult = !!team && participant && view.resultSeen !== room.round && (phase === 'result' || (me && me.res && me.res.startId === room.round));

  // ②マッチング。上半分に5人のカード、下に部屋の情報とボタン(横画面では左右に並べる)
  if (!view || view.full || (phase === 'matching' && !countdown)) {
    const publicRoom = !!view && view.mode !== 'private';
    return (
      <main data-rhythm-multi data-rhythm-multi-step="matching" className={shell}>
        {header('マッチング', leaveRoom, { buddy: true })}
        {view && view.full
          ? <div className="min-h-0 flex-1 overflow-y-auto p-3"><section data-rhythm-multi-full className={card}>
            <p className="text-sm font-black text-rose-300">このルームは満員です(最大{RHYTHM_MULTI_ROOM_MAX}人)</p>
            <button type="button" className={`${btn} mt-2 w-full bg-slate-700`} onClick={leaveRoom}>モードえらびへ戻る</button>
          </section></div>
          : <>
            <RhythmMultiMemberCards onOpen={openBuddyInfo} bubbleOf={chatBubbleOf} members={members} hostId={view ? view.hostId : ''} selfId={view ? view.selfId : ''} resolveIconUrl={resolveIconUrl} size="tall"
              badgeOf={(m) => ({ text: view && m.id === view.hostId ? 'ホスト' : '入室', cls: view && m.id === view.hostId ? 'bg-amber-400 text-slate-950' : 'bg-cyan-500 text-slate-950', sub: `Lv.${m.level}` })} />
            <div className="mt-auto max-h-[52%] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-950/90 p-2 landscape:grid landscape:max-h-[58%] landscape:grid-cols-2 landscape:gap-2" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
              <section data-rhythm-multi-matching className="rounded-2xl border border-white/15 bg-slate-900/85 p-2">
                <p className="animate-pulse text-sm font-black text-amber-200">{!view ? `${RHYTHM_MULTI_MODE_LABELS[searching]}ルームをさがしています…` : 'メンバーを待っています…'}</p>
                <p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-400">
                  {!view ? '' : publicRoom ? `${RHYTHM_MULTI_ROOM_MAX}人そろうか、2人以上でしばらく待つとメンバーが確定します` : isHost ? '2人以上そろったら「メンバー確定」を押してください' : 'ホストがメンバーを確定するのを待っています'}
                </p>
                <RhythmMultiAloneHint alone={!!view && publicRoom && members.length <= 1} onLeave={leaveRoom} />
                {view && <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <small className="block text-[9px] font-black text-slate-400">ルームコード</small>
                    <b data-rhythm-multi-room-code className="block text-2xl font-black leading-none tracking-[0.3em] text-cyan-200">{view.code}</b>
                    {view.status !== 'open' && <small className="block text-[9px] font-black text-amber-300">{view.status === 'connecting' ? 'ルームへつないでいます…' : 'つなぎ直しています…'}</small>}
                  </div>
                  <button data-rhythm-multi-share type="button" className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-3 text-xs font-black" onClick={shareCode}>{copied ? 'コピーした!' : '友だちに送る'}</button>
                </div>}
                {/* 選曲の制限時間。部屋主が決める(ほかの人には、決まった時間だけ見せる)。2026-10-07・ユーザー指示 */}
                {view && room && <div data-rhythm-multi-select-time-row className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <small className="shrink-0 text-[10px] font-black text-slate-400">選曲の制限時間</small>
                  {isHost
                    ? RHYTHM_MULTI_SELECT_SEC_OPTIONS.map((sec) => (
                      <button key={sec} type="button" data-rhythm-multi-select-sec={sec} aria-pressed={rhythmMultiNormalizeSelectSec(room.selectSec) === sec} onClick={() => RHYTHM_MULTI.setSelectSeconds(sec)}
                        className={`min-h-[36px] min-w-[52px] rounded-lg border px-2 text-[11px] font-black ${rhythmMultiNormalizeSelectSec(room.selectSec) === sec ? 'border-amber-300 bg-amber-600/80 text-white' : 'border-white/15 bg-slate-900/80 text-slate-300'}`}>{rhythmMultiSelectSecLabel(sec)}</button>))
                    : <b data-rhythm-multi-select-sec-view className="text-[11px] font-black text-amber-200">{rhythmMultiSelectSecLabel(rhythmMultiNormalizeSelectSec(room.selectSec))}<small className="ml-1 text-[9px] font-bold text-slate-400">(ホストが決めます)</small></b>}
                </div>}
              </section>
              <div className="mt-2 space-y-2 landscape:mt-0">
                {view && isHost && view.mode !== 'private' && (
                  <button data-rhythm-multi-confirm type="button" disabled={members.length < 2} onClick={() => RHYTHM_MULTI.confirmMembers()}
                    className="min-h-[48px] w-full rounded-xl bg-fuchsia-700 px-2 text-sm font-black disabled:opacity-40">このメンバーで始める<small className="block text-[9px] font-bold opacity-80">待たずにメンバーを確定</small></button>
                )}
                {view && isHost && view.mode === 'private' && me && (
                  <div className="grid grid-cols-2 gap-2">
                    <button data-rhythm-multi-open type="button" onClick={() => RHYTHM_MULTI.setOpen(!me.open)}
                      className={`min-h-[48px] rounded-xl px-2 text-xs font-black ${me.open ? 'bg-amber-600' : 'bg-slate-700'}`}>
                      {me.open ? 'ルーム解放中' : 'ルーム解放'}<small className="block text-[9px] font-bold opacity-80">{me.open ? 'タップでやめる' : '知らない人も呼ぶ'}</small>
                    </button>
                    <button data-rhythm-multi-confirm type="button" disabled={members.length < 2} onClick={() => RHYTHM_MULTI.confirmMembers()}
                      className="min-h-[48px] rounded-xl bg-fuchsia-700 px-2 text-sm font-black disabled:opacity-40">メンバー確定</button>
                  </div>
                )}
              {friendsOn && view && view.mode === 'private' && (
                <section data-rhythm-multi-friend-invite className={card}>
                  <button data-rhythm-multi-friend-invite-toggle type="button" className={`${btn} w-full bg-pink-700`} onClick={openInvitePanel}>{invitePanel ? 'フレンドの招待をとじる' : 'フレンドを招待する'}</button>
                  {invitePanel && (
                    <div className="mt-2 space-y-1">
                      {roster === null && <p className="text-[11px] font-bold text-slate-400">フレンドを読み込んでいます…</p>}
                      {roster !== null && roster.length === 0 && (
                        <p className="text-[11px] font-bold leading-relaxed text-slate-400">まだフレンドがいません。プロフィールの「フレンド」から、フレンドコードで申請できます。</p>
                      )}
                      {(roster || []).map((friend) => (
                        <div key={friend.otherId} data-rhythm-multi-friend-row className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm font-black">{friend.userName}</b>
                            <small className="block truncate text-[10px] font-bold text-slate-400">{friendsLastSeenText(friend.lastSeenAt, Date.now())}</small>
                          </span>
                          <button data-rhythm-multi-friend-send type="button" disabled={!!invitedIds[friend.otherId]} onClick={() => inviteFriend(friend.otherId)}
                            className={`${btn} shrink-0 text-xs ${invitedIds[friend.otherId] ? 'bg-slate-700' : 'bg-pink-700'}`}>{invitedIds[friend.otherId] ? '招待ずみ' : '招待する'}</button>
                        </div>
                      ))}
                      {inviteMessage && <p data-rhythm-multi-friend-message className="text-[11px] font-black text-rose-300">{inviteMessage}</p>}
                      <p className="text-[10px] font-bold leading-relaxed text-slate-400">招待は3分のあいだ届きます。相手がマルチの入口をひらくと「参加する」が出ます。</p>
                    </div>
                  )}
                </section>
              )}
                {buddyBumped && <p data-rhythm-buddy-bumped className="text-[11px] font-black leading-snug text-amber-200">人が入ってきたので、呼んだマスモンは席をゆずって帰りました(使った回数・券は戻りました)</p>}
                {buddyCallButton()}
                <button data-rhythm-multi-leave type="button" className={`${btn} w-full bg-slate-700`} onClick={leaveRoomAfterTap}>{view ? 'ルームを出る' : 'やめる'}</button>
                {message && <p className="text-[12px] font-black text-rose-300">{message}</p>}
              </div>
            </div>
          </>}
        {chatSheet}{rankingLayer}{buddyInfoLayer}{buddySheetLayer}
      </main>
    );
  }

  // ⑥結果(本家の RESULT 画面: 上に曲とスコアランク、真ん中に5人の縦長カード、右下に「メンバーの成績」「次へ」)
  if (showResult) {
    const fill = Math.min(1, Math.max(0, team.average / 1000000));
    const marks = ['C', 'B', 'A', 'S', 'SS'].map((id) => ({ id, pos: (RHYTHM_RANKS.find((r) => r.id === id) || { min: 0 }).min / 1000000 }));
    const drawnLevel = (diffId) => (drawnSong && drawnSong.difficulties && drawnSong.difficulties[diffId] ? Number(drawnSong.difficulties[diffId].level) || 0 : 0);
    return (
      <main data-rhythm-multi data-rhythm-multi-step="result" className={`${shell} bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950`}>
        <b aria-hidden="true" className="pointer-events-none absolute left-2 top-0 text-6xl font-black italic tracking-widest text-white/[0.06]" style={{ top: 'var(--mh-sa-top)' }}>RESULT</b>
        <section data-rhythm-multi-results className="relative mx-2 mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/90 p-2 [@media(max-height:440px)]:py-1 [[data-mh-view-rotation=true]_&]:py-1" style={{ marginTop: 'calc(.4rem + var(--mh-sa-top))' }}>
          {drawnSong && <span className="h-12 w-12 shrink-0 landscape:h-14 landscape:w-14"><RhythmSongArt song={drawnSong} marked={false} /></span>}
          <div className="min-w-0 flex-1 landscape:max-w-[34%]">
            <b className="block truncate text-sm font-black">{drawnSong ? rhythmSongFullName(drawnSong) : ''}</b>
            <small className="block text-[10px] font-black text-slate-400">{team.waiting ? 'ほかの人のライブが終わるのを待っています…' : `チームの平均 ${team.average.toLocaleString()}`}</small>
            {/* 同じメンバーで続けたライブ(連続ボーナス・2026-10-03) */}
            {view.streak >= 2 && <small data-rhythm-multi-streak className="mt-0.5 inline-block rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 text-[10px] font-black text-white">🔥 連続{view.streak}曲目 ・ ごほうび+{Math.round(rhythmMultiStreakBonus(view.streak) * 100)}%</small>}
          </div>
          <div className="hidden min-w-0 flex-1 landscape:block">
            <div data-rhythm-multi-gauge className="relative mt-3 h-3 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-300 to-violet-400" style={{ width: `${Math.round(fill * 100)}%` }} />
              {marks.map((mk) => (
                <span key={mk.id} className="absolute top-0 h-3 w-px bg-white/70" style={{ left: `${Math.round(mk.pos * 100)}%` }}>
                  <small className="absolute -top-3.5 -translate-x-1/2 text-[9px] font-black text-slate-300">{mk.id}</small>
                </span>
              ))}
            </div>
          </div>
          <div className="flex w-16 shrink-0 flex-col items-center">
            <b data-rhythm-multi-team-rank className="text-5xl font-black leading-none text-amber-300 drop-shadow">{team.waiting ? '…' : team.rank}</b>
            <small className="text-[8px] font-black tracking-widest text-slate-400">SCORE RANK</small>
          </div>
        </section>
        {/* 縦画面ではゲージを曲の下へ1段で出す(横画面では上の帯の中) */}
        <div className="mx-3 mt-4 shrink-0 landscape:hidden">
          <div className="relative h-2.5 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-300 to-violet-400" style={{ width: `${Math.round(fill * 100)}%` }} />
            {marks.map((mk) => (
              <span key={mk.id} className="absolute top-0 h-2.5 w-px bg-white/70" style={{ left: `${Math.round(mk.pos * 100)}%` }}>
                <small className="absolute -top-3.5 -translate-x-1/2 text-[9px] font-black text-slate-300">{mk.id}</small>
              </span>
            ))}
          </div>
        </div>
        <ul className="grid max-h-[260px] min-h-0 flex-1 grid-cols-5 gap-1.5 px-2 pb-1 pt-4 landscape:max-h-none landscape:gap-2 landscape:px-3 [@media(max-height:440px)]:pt-2 [[data-mh-view-rotation=true]_&]:pt-2">
          {Array.from({ length: RHYTHM_MULTI_ROOM_MAX }).map((_, i) => {
            const r = team.rows[i];
            if (!r) return <li key={`empty${i}`} aria-hidden="true" className="rounded-xl border border-dashed border-white/5" />;
            const isMvp = r.m.id === team.mvpId && !team.waiting;
            const lv = r.res ? drawnLevel(r.res.diffId) : 0;
            return (
              <li key={r.m.id} data-rhythm-multi-result-row role={r.m.id !== view.selfId ? 'button' : undefined} onClick={r.m.id !== view.selfId ? () => (r.m.cpu ? setBuddyInfoId(r.m.id) : setMemberSheetId(r.m.id)) : undefined} className={`relative flex ${r.m.id !== view.selfId ? 'cursor-pointer active:brightness-125' : ''} min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl px-0.5 pb-1.5 text-center ${isMvp ? 'mhmv-mvp z-10 border-2 border-amber-300 bg-gradient-to-b from-amber-500/35 via-pink-600/25 to-slate-900 pt-4 [@media(max-height:440px)]:pt-3.5 [[data-mh-view-rotation=true]_&]:pt-3.5' : 'border border-white/10 bg-slate-900/80 pt-3 [@media(max-height:440px)]:pt-1.5 [[data-mh-view-rotation=true]_&]:pt-1.5'}`}>
                <RhythmMultiChatBubble text={chatBubbleOf(r.m.id)} />
                {/* MVP は札をアイコンより前に出し、王冠・金色の光で目立たせる(2026-10-03・ユーザー指摘「MVPが裏に回ってる / もっと強調して」) */}
                {isMvp && <b data-rhythm-multi-mvp className="mhmv-badge absolute left-1/2 top-1 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-slate-950 shadow-[0_0_12px_rgba(252,211,77,.9)] landscape:text-[13px]">👑 MVP</b>}
                <span className={`relative z-10 shrink-0 rounded-full ${isMvp ? 'mhmv-ring' : ''}`}>
                  <RhythmMultiAvatar m={r.m} resolveIconUrl={resolveIconUrl} sizeClass="h-12 w-12 landscape:h-16 landscape:w-16 [@media(max-height:440px)]:h-11 [[data-mh-view-rotation=true]_&]:h-11 [@media(max-height:440px)]:w-11 [[data-mh-view-rotation=true]_&]:w-11" />
                </span>
                <span className={`relative z-20 mt-1 w-full shrink-0 truncate text-[10px] font-black landscape:text-xs ${isMvp ? 'text-amber-100' : ''}`}>{r.m.name}{r.m.id === view.selfId ? '(あなた)' : ''}</span>
                <small className="block h-3 shrink-0 text-[7px] font-black italic leading-3 text-pink-300 landscape:text-[9px]">{r.res && !r.res.quit && r.res.cleared && r.res.fc > 0 ? RHYTHM_MULTI_FC_LABELS[r.res.fc].replace('!', '') : ''}</small>
                <b className={`block w-full shrink-0 text-[10px] font-black leading-tight tracking-tighter tabular-nums landscape:text-base landscape:tracking-normal [@media(max-height:440px)]:text-sm [[data-mh-view-rotation=true]_&]:text-sm ${isMvp ? 'text-amber-200' : ''}`}>{r.res ? (r.res.quit ? 'リタイア' : String(r.res.score).padStart(8, '0')) : r.m.gone ? '—' : 'ライブ中…'}</b>
                {r.res && !r.res.quit && <>
                  <small className="mt-1 shrink-0 rounded bg-slate-800 px-1 text-[8px] font-black text-slate-300 landscape:text-[10px] [@media(max-height:440px)]:mt-0.5 [[data-mh-view-rotation=true]_&]:mt-0.5">{r.res.diffId || '-'}{lv ? ` Lv.${lv}` : ''}</small>
                  {!r.res.cleared && <small className="text-[8px] font-black text-rose-300">失敗</small>}
                </>}
              </li>
            );
          })}
        </ul>
        {/* 結果を見ながら、ワンタップで「もう一回!」「ありがとう!」(2026-10-03・ユーザー指示) */}
        {/* 定型文は折り返して6つだけ(すべらせて探さない)。右の💬に最新の発言を出す(2026-10-03・ユーザー指摘「チャットが使いにくい」) */}
        <div data-rhythm-multi-result-chat className="flex shrink-0 items-center gap-2 px-2 pt-1.5 landscape:px-3 [@media(max-height:440px)]:pt-1 [[data-mh-view-rotation=true]_&]:pt-1">
          {/* ★画面を自前で回している間(data-mh-view-rotation)は、端末の向きが縦のままなので `portrait:` も `max-height` の指定も
              縦画面のほうが効いてしまう。回転中の写し(`[[data-mh-view-rotation=true]_&]:`)を並べて書く(2026-10-04・ユーザー報告「画面切れしてる」)。
              ★折り返さない。実機の横画面は左右と下に余白(切り欠き・ホームバー)があって狭く、2段になるとカードが押しつぶされて
              アイコンと難易度が切れた(2026-10-03・ユーザー報告)。入りきらないぶんは横にすべらせる */}
          <RhythmMultiStampBar phase="result" onSend={(text) => RHYTHM_MULTI.sendChat(text)} big limit={6} className="min-w-0 flex-1 portrait:flex-wrap [[data-mh-view-rotation=true]_&]:flex-nowrap" />
          {rankingButton()}
          {chatLatestButton()}
        </div>
        {(() => {
          // 自分が呼んだマスモンがこのライブに出ていたら、1体ずつ育てて見せる(全員の結果がそろってから)
          if (team.waiting) return null;
          // 自分が途中でやめたライブでは、呼んだマスモンも育てない(やめたのにクリア扱いで経験値が入っていた。2026-10-07・ユーザー指摘)
          const myRow = team.rows.find((row) => row.m.id === view.selfId);
          if (!myRow || !myRow.res || myRow.res.quit) return null;
          const song = songById(room.songId);
          const grown = (view.myCpus || []).map((c) => {
            const cpuRow = team.rows.find((row) => row.m.id === c.id);
            const masu = cpuRow && cpuRow.res ? masuMons.find((x) => x && x.id === c.masuId) : null;
            return masu ? { masu, cpuRow } : null;
          }).filter(Boolean);
          if (!grown.length) return null;
          return <div data-rhythm-buddy-growth-list className="grid shrink-0 grid-cols-1 gap-1 px-3 pt-1 landscape:grid-cols-2 [[data-mh-view-rotation=true]_&]:grid-cols-2">{grown.map(({ masu, cpuRow }) => (
            <RhythmBuddyGrowth key={masu.id} masu={masu} round={room.round} songId={room.songId} diffId={cpuRow.res.diffId} durationMs={song ? Number(song.playDurationMs) || 0 : 0} teamRank={team.rank}
              chartLevel={song && song.difficulties && song.difficulties[cpuRow.res.diffId] ? Number(song.difficulties[cpuRow.res.diffId].level) || 0 : 0}
              humans={team.rows.filter((row) => !row.m.cpu).length}
              score={cpuRow.res.score} maxScore={((typeof RHYTHM_DIFFICULTIES !== 'undefined' ? RHYTHM_DIFFICULTIES : []).find((d) => d.id === cpuRow.res.diffId) || {}).maxScore || 0} />
          ))}</div>;
        })()}
        <div className="mt-auto flex shrink-0 gap-2 border-t border-white/10 bg-slate-950/90 px-3 pt-2 landscape:justify-end landscape:border-t-0 landscape:bg-transparent [@media(max-height:440px)]:pt-1 [[data-mh-view-rotation=true]_&]:pt-1" style={{ paddingBottom: 'calc(.4rem + var(--mh-sa-bottom))' }}>
          <button data-rhythm-multi-member-stats type="button" onClick={() => setStatsOpen(true)}
            className="min-h-[46px] flex-1 rounded-full border border-white/30 bg-slate-800 px-4 text-sm font-black landscape:w-48 landscape:flex-none [@media(max-height:440px)]:min-h-[40px] [[data-mh-view-rotation=true]_&]:min-h-[40px]">メンバーの成績</button>
          <button data-rhythm-multi-result-next type="button" onClick={() => RHYTHM_MULTI.nextFromResult(room.round)}
            className="min-h-[46px] flex-1 rounded-full bg-gradient-to-r from-teal-300 to-cyan-400 px-4 font-black text-slate-950 landscape:w-56 landscape:flex-none [@media(max-height:440px)]:min-h-[40px] [[data-mh-view-rotation=true]_&]:min-h-[40px]">{team.waiting ? (isHost ? '待たずに次の曲へ' : '次へ(ほかの人を待たない)') : '次へ'}</button>
        </div>
        {/* 結果が出たら対戦の記録へ足す(自分が参加して、全員の結果がそろってから) */}
        {(() => {
          const mine = team.rows.find((row) => row.m.id === view.selfId);
          if (team.waiting || !mine || !mine.res) return null;
          return <RhythmMultiRecordSaver entry={{ at: Date.now(), round: room.round, songId: room.songId, avg: team.average, score: mine.res.score, n: room.participants.length,
            streak: view.streak || 1, mvp: team.mvpId === view.selfId, quit: !!mine.res.quit, names: team.rows.filter((row) => row.m.id !== view.selfId).map((row) => row.m.name) }} />;
        })()}
        {memberSheetId && (() => {
          const row = team.rows.find((x) => x.m.id === memberSheetId);
          if (!row) return null;
          const isFriend = !!(row.m.bid && (roster || []).some((f) => f.otherId === row.m.bid));
          return <RhythmMultiMemberSheet m={row.m} res={row.res} resolveIconUrl={resolveIconUrl} friendsOn={friendsOn} friendSelfId={friendSelfId} isFriend={isFriend} onClose={() => setMemberSheetId('')} />;
        })()}
        {statsOpen && (
          <div data-rhythm-multi-stats className="absolute inset-0 z-[85000] flex flex-col bg-slate-950" style={{ paddingTop: 'var(--mh-sa-top)', paddingBottom: 'var(--mh-sa-bottom)' }}>
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
              <b className="min-w-0 flex-1 truncate text-sm font-black">メンバーの成績{drawnSong ? ` ・ ${rhythmSongFullName(drawnSong)}` : ''}</b>
              <button type="button" className="min-h-[44px] shrink-0 rounded-xl bg-slate-700 px-4 text-sm font-black" onClick={() => setStatsOpen(false)}>閉じる</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-center text-[11px] font-black">
                <thead>
                  <tr className="text-[10px] text-slate-400">
                    <th className="px-1 text-left">メンバー</th><th className="px-1">難易度</th><th className="px-1">スコア</th><th className="px-1">最大コンボ</th>
                    {RHYTHM_MULTI_JUDGMENT_IDS.map((id) => <th key={id} className="px-1" style={{ color: rhythmJudgmentColor(id) }}>{id}</th>)}
                    <th className="px-1">FAST / SLOW</th>
                  </tr>
                </thead>
                <tbody>
                  {team.rows.map((r) => (
                    <tr key={r.m.id} data-rhythm-multi-stats-row className={r.m.id === team.mvpId ? 'bg-pink-950/50' : 'bg-slate-900/80'}>
                      <td className="rounded-l-lg px-1 py-1.5 text-left">
                        <span className="flex items-center gap-1.5"><RhythmMultiAvatar m={r.m} resolveIconUrl={resolveIconUrl} sizeClass="h-7 w-7" /><span className="max-w-[7rem] truncate">{r.m.name}</span>{r.m.id === team.mvpId && <small className="rounded bg-pink-500 px-1 text-[8px] text-white">MVP</small>}</span>
                      </td>
                      <td className="px-1">{r.res ? r.res.diffId || '-' : '-'}</td>
                      <td className="px-1 tabular-nums">{r.res ? (r.res.quit ? 'リタイア' : r.res.score.toLocaleString()) : '—'}</td>
                      <td className="px-1 tabular-nums">{r.res && !r.res.quit ? r.res.maxCombo : '—'}</td>
                      {RHYTHM_MULTI_JUDGMENT_IDS.map((id, k) => <td key={id} className="px-1 tabular-nums">{r.res && !r.res.quit && r.res.j ? r.res.j[k] : '—'}</td>)}
                      <td className="rounded-r-lg px-1 tabular-nums">{r.res && !r.res.quit ? `${r.res.fs} / ${r.res.sl}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {chatSheet}{rankingLayer}{buddyInfoLayer}
      </main>
    );
  }

  // ライブ中(自分は参加していない・または結果のあと次の選曲を待っているとき)
  if (phase === 'playing' || phase === 'result') {
    return (
      <main data-rhythm-multi data-rhythm-multi-step="waiting" className={shell}>
        {header(phase === 'playing' ? 'ライブ中' : '次の選曲を待っています', leaveRoom)}
        <RhythmMultiMemberCards onOpen={openBuddyInfo} bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} size="tall"
          badgeOf={(m) => (m.playing ? { text: 'ライブ中', cls: 'bg-amber-400 text-slate-950' } : { text: '待機中', cls: 'bg-slate-600 text-white' })} />
        <RhythmMultiStampBar phase={phase} onSend={(text) => RHYTHM_MULTI.sendChat(text)} wrap big limit={6} className="shrink-0 px-2 pt-1" />
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-950/90 p-2 landscape:flex-row landscape:items-center" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          <p className="min-w-0 flex-1 text-sm font-black text-amber-200">{phase === 'playing' ? 'いまライブ中です。次の曲から参加できます' : 'ホストが次へ進むのを待っています'}{drawnSong ? <small className="block truncate text-[11px] font-bold text-slate-300">{rhythmSongFullName(drawnSong)}</small> : null}</p>
          <button data-rhythm-multi-leave type="button" className={`${btn} bg-slate-700 landscape:w-48`} onClick={leaveRoomAfterTap}>ルームを出る</button>
        </div>
        {chatSheet}{rankingLayer}{buddyInfoLayer}
        {countdownLayer}
      </main>
    );
  }

  // ④MUSIC SHUFFLE の演出(準備の画面へ入る前に一度だけ)。横画面ではジャケットを左、全員の選曲を右に並べる
  if (shuffleRound) {
    const picked = members.map((m) => ({ m, song: m.pickRound === room.round && m.pick !== RHYTHM_MULTI_OMAKASE ? songById(m.pick) : null }));
    const pool = picked.filter((x) => x.song);
    const spinning = pool.length ? pool[shuffleIndex % pool.length] : null;
    const shown = shuffleStopped ? drawnSong : (spinning ? spinning.song : songs[shuffleIndex % Math.max(1, songs.length)]);
    return (
      <main data-rhythm-multi data-rhythm-multi-step="shuffle" className={shell}>
        {header('楽曲シャッフル', leaveRoom)}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-3 landscape:flex-row landscape:items-stretch landscape:justify-center">
          <div data-rhythm-multi-shuffle className={`flex w-full max-w-xs shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border p-3 landscape:w-[42%] ${shuffleStopped ? 'border-amber-300 bg-amber-950/30' : 'border-fuchsia-400/40 bg-slate-900/80'}`}>
            <b className="text-lg font-black italic tracking-widest text-fuchsia-200">MUSIC SHUFFLE</b>
            {shown && <span className="h-32 w-32 landscape:h-36 landscape:w-36"><RhythmSongArt song={shown} large marked={false} /></span>}
            <b className="w-full truncate text-center text-base font-black">{shown ? rhythmSongFullName(shown) : ''}</b>
            <small className={`text-xs font-black text-amber-200 ${shuffleStopped ? '' : 'invisible'}`}>この曲に決まりました!</small>
          </div>
          <ul className="w-full max-w-sm space-y-1 landscape:flex landscape:max-w-md landscape:flex-col landscape:justify-center">
            {picked.map(({ m, song }) => (
              <li key={m.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${shuffleStopped && song && drawnSong && song.songId === drawnSong.songId ? 'bg-amber-500/25' : 'bg-slate-900/80'}`}>
                <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-8 w-8" />
                <span className="w-20 shrink-0 truncate text-[11px] font-black text-slate-300">{m.name}</span>
                {song && <img src={rhythmSongArtSrc(song)} alt="" draggable={false} className="h-8 w-8 shrink-0 rounded-md object-cover" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-black">{song ? rhythmSongFullName(song) : 'おまかせ'}</span>
                  {m.cpu && song && RHYTHM_BUDDY_PICK_WHY[m.pickWhy] && <small data-rhythm-buddy-pick-why className="block truncate text-[10px] font-bold text-lime-200">「{RHYTHM_BUDDY_PICK_WHY[m.pickWhy]}」</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  // ⑤難易度えらび・準備完了(本家: 上に5人の大きなカード、下の帯に曲・難易度・「準備完了」)
  if (phase === 'ready') {
    const iAmReady = !!me && me.readyRound === room.round;
    const shownDiffId = (drawnOpenDiffs.find((d) => d.id === myDiffId) || pickPlayDifficulty() || {}).id;
    return (
      <main data-rhythm-multi data-rhythm-multi-step="ready" className={shell}>
        {header('難易度選択', leaveRoom, { timer: room.left, advance: 'すぐ開始', gesture: true })}
        <RhythmMultiMemberCards onOpen={openBuddyInfo} bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} size="tall"
          badgeOf={(m) => (m.readyRound === room.round ? { text: '準備完了', cls: 'bg-emerald-400 text-slate-950', sub: m.diff } : { text: '準備中', cls: 'bg-slate-600 text-white', sub: m.diff })} />
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-950/95 p-2 landscape:flex-row landscape:items-center landscape:gap-3" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          {drawnSong && (
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-900/90 p-1.5 landscape:w-[32%]">
              <span className="h-12 w-12 shrink-0"><RhythmSongArt song={drawnSong} marked={false} /></span>
              <div className="min-w-0 flex-1">
                <small className="block text-[9px] font-black text-slate-400">ライブする曲</small>
                <b data-rhythm-multi-drawn className="block truncate text-sm font-black leading-tight">{rhythmSongFullName(drawnSong)}</b>
                {/* 演出の段階(2026-10-03・ユーザー指示「完全に軽くじゃないやつも切り替えられるように」)。
                    軽め・標準・華やか は見た目のおまかせを対戦のあいだだけ重ねる。いつもの は自分の設定のまま */}
                {onChangeMultiLook && <div data-rhythm-multi-light-look role="group" aria-label="対戦の演出" className="mt-1 flex items-center gap-0.5">
                  <small className="mr-0.5 shrink-0 text-[9px] font-black text-slate-400">演出</small>
                  {RHYTHM_MULTI_LOOK_CHOICES.map((c) => (
                    <button key={c.id} type="button" data-rhythm-multi-look={c.id} aria-pressed={multiLook === c.id} onClick={() => onChangeMultiLook(c.id)}
                      className={`min-h-[26px] rounded-full border px-1.5 text-[10px] font-black leading-none ${multiLook === c.id ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-white/20 bg-slate-800 text-slate-300'}`}>{c.label}</button>
                  ))}
                </div>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5 landscape:flex-1">
            {drawnDiffs.map((d) => {
              const open = drawnOpenDiffs.some((x) => x.id === d.id);
              const level = drawnSong && drawnSong.difficulties && drawnSong.difficulties[d.id] ? Number(drawnSong.difficulties[d.id].level) || 0 : 0;
              const active = shownDiffId === d.id;
              return (
                <button key={d.id} type="button" data-rhythm-multi-difficulty={d.id} disabled={!open || iAmReady} onClick={() => RHYTHM_MULTI.setDiff(d.id)}
                  className={`flex min-h-[52px] flex-col items-center justify-center rounded-full border-2 text-[9px] font-black disabled:opacity-40 ${active ? 'border-fuchsia-300 bg-fuchsia-600 text-white' : 'border-white/20 bg-slate-800 text-slate-200'}`}>
                  <span className="text-base leading-none">{level || '-'}</span>
                  <span className="leading-tight">{open ? d.id : '🔒'}</span>
                </button>
              );
            })}
          </div>
          <button data-rhythm-multi-ready type="button" disabled={iAmReady} onClick={() => { if (onUserGesture) onUserGesture(); if (shownDiffId) RHYTHM_MULTI.setDiff(shownDiffId); RHYTHM_MULTI.ready(); }}
            className="min-h-[52px] rounded-xl bg-gradient-to-r from-teal-300 to-cyan-400 px-3 text-base font-black text-slate-950 disabled:opacity-60 landscape:w-[22%]">{iAmReady ? '準備完了!' : '準備完了'}{iAmReady && <small className="block text-[9px] font-bold">ほかのメンバーを待っています</small>}</button>
        </div>
        {chatSheet}{rankingLayer}{buddyInfoLayer}
        {countdownLayer}
      </main>
    );
  }

  // ③選曲(ソロと同じ曲えらびの画面。上に5人の細いカードで「選曲中 / 選曲済(何をえらんだか)」)
  const myPick = me && me.pickRound === room.round ? me.pick : '';
  const pickLabel = (m) => {
    if (m.pickRound !== room.round || !m.pick) return { text: '選曲中', cls: 'bg-slate-600 text-white' };
    const song = m.pick === RHYTHM_MULTI_OMAKASE ? null : songById(m.pick);
    return { text: '選曲済', cls: 'bg-fuchsia-400 text-slate-950', sub: song ? rhythmSongFullName(song) : 'おまかせ' };
  };
  return (
    <main data-rhythm-multi data-rhythm-multi-step="select" className={shell}>
      {header('楽曲シャッフル ・ 選曲', leaveRoom, { timer: room.deadline ? room.left : null, advance: '締め切る', buddy: true, selectTime: true })}
      <RhythmMultiMemberCards onOpen={openBuddyInfo} bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} badgeOf={pickLabel} size="strip" />
      <RhythmSongSelect
        songs={songs}
        difficulties={difficultyList}
        bestRecords={bestRecords}
        songId={selSongId}
        difficultyId={myDiffId}
        onSongId={(id) => setSelSongId(id)}
        onDifficultyId={(id) => RHYTHM_MULTI.setDiff(id)}
        view={selectView}
        onView={setSelectView}
        onPlay={(song, difficulty) => { RHYTHM_MULTI.setDiff(difficulty.id); RHYTHM_MULTI.pick(song.songId); }}
        playLabel={myPick ? 'この曲に変更' : 'この曲で決定'}
        hideRandom
        notice={(
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-bold leading-snug text-slate-300">全員がえらぶか時間になると、全員の選曲からシャッフルで1曲が決まります。{!room.deadline && 'いまは人があなたひとりなので、制限時間はありません。ゆっくり選べます。'}</p>
            {/* 狭い画面では、制限時間の切り替えを注意書きの右に置く(行を増やさない。広い画面はヘッダーに出る) */}
            {isHost && selectTimeButton('min-[481px]:hidden', true)}
          </div>
        )}
        footer={() => (
          <div className="grid grid-cols-2 gap-1.5">
            <button data-rhythm-multi-omakase type="button" aria-pressed={myPick === RHYTHM_MULTI_OMAKASE} onClick={() => RHYTHM_MULTI.pick(RHYTHM_MULTI_OMAKASE)}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border px-1 text-[11px] font-black leading-tight ${myPick === RHYTHM_MULTI_OMAKASE ? 'border-amber-300 bg-amber-600/80 text-white' : 'border-white/15 bg-slate-900/80 text-slate-300'}`}>🔀 おまかせ{myPick === RHYTHM_MULTI_OMAKASE ? '(選曲済)' : ''}<small className="block text-[8px] font-bold opacity-80">ほかの人の曲が優先</small></button>
            <button data-rhythm-multi-leave type="button" onClick={leaveRoom}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 px-1 text-[11px] font-black text-slate-300">ルームを出る</button>
          </div>
        )} />
      {chatSheet}{rankingLayer}{buddyInfoLayer}{buddySheetLayer}
      {countdownLayer}
    </main>
  );
}
