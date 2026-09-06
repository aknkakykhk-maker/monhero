// ===== Supabase shared ranking (REST API via fetch) =====
const SUPABASE_URL = 'https://zrzevudkbgtxlbvmuziy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
// sb_publishable_* は Data API の apikey 用であり、JWT ではない。Bearer にも設定すると
// PostgREST が publishable key を JWT として検証して 401 (Invalid JWT) にするため送らない。
// ログには秘密値そのものを出さず、公開設定を読み込めたことだけを記録する。
const SB_HEADERS = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };

// 画面表示名とDB識別子を分離し、ランキング通信では必ず既存の難易度keyへ正規化する。
// プロのランキングはチャレンジと混ざらないよう、難易度キーの先頭へ Pro を付けて別枠にする。
// 既存のチャレンジの記録(difficulty='Hard' など)はそのままで、行の書き換えも変換も行わない。
// Supabaseの列(スキーマ)は変えず、difficulty へ入れる値だけで分ける
const PRO_RANKING_PREFIX = 'Pro';
// 極限チャレンジも同じやり方。難易度の並びが通常と別なので、極限の段階IDへ接頭辞を付ける
// (例: ExtremeEXTREME)。チャレンジ・プロの行は読みも書きもしない
const EXTREME_RANKING_PREFIX = 'Extreme';
const RANKING_DIFFICULTY_KEYS = Object.freeze([
  ...Object.keys(DIFFICULTY_SETTINGS),
  ...Object.keys(DIFFICULTY_SETTINGS).map(key => `${PRO_RANKING_PREFIX}${key}`),
  // GOD以降も同じ表(ALL_EXTREME_DIFFICULTIES)から作る。難易度を足すたびにここへ1行書き足すと
  // 書き忘れでランキングだけ落ちるので、正本を1つにしておく
  ...ALL_EXTREME_DIFFICULTIES.map(setting => `${EXTREME_RANKING_PREFIX}${setting.id}`),
]);
// 種族チャレンジは「種族(主血統) × 難易度」ごとに独立したランキングになる。
// 既存 rankings テーブルの difficulty 列(自由文字列)へ Species-<血統id>-<難易度id> の形で入れるだけなので、
// 新しいテーブルも列も要らない。区切りの「-」は既存キー(Normal / ProNormal / ExtremeEXTREME)に
// 一切現れないため、チャレンジ・プロ・極限の行と混ざることが構造上起きない。
const SPECIES_RANKING_PREFIX = 'Species';
const SPECIES_RANKING_SEPARATOR = '-';
const speciesChallengeRankingDifficulty = (speciesId, difficultyId) => {
  const lineage = speciesChallengeLineages().find(item => item.id === speciesId);
  if (!lineage || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)) return null;
  return `${SPECIES_RANKING_PREFIX}${SPECIES_RANKING_SEPARATOR}${lineage.id}${SPECIES_RANKING_SEPARATOR}${difficultyId}`;
};
// ランキングキーから種族と難易度へ戻す。知らない組み合わせはnull(既存キーとして扱う)
const parseSpeciesChallengeRankingDifficulty = (key) => {
  const parts = String(key ?? '').trim().split(SPECIES_RANKING_SEPARATOR);
  if (parts.length !== 3 || parts[0].toLowerCase() !== SPECIES_RANKING_PREFIX.toLowerCase()) return null;
  const lineage = speciesChallengeLineages().find(item => item.id.toLowerCase() === parts[1].toLowerCase());
  const difficultyId = SPECIES_CHALLENGE_DIFFICULTY_IDS.find(id => id.toLowerCase() === parts[2].toLowerCase());
  return lineage && difficultyId ? { speciesId:lineage.id, difficultyId } : null;
};
// 種族をまたいだ「全種族」の全国ランキング。
//
// ★これは読み取り専用の合成キーで、この値をdifficultyへ保存することは一切ない。
//   実体は Species-<各血統>-<難易度> の行そのままで、取りにいくときだけ
//   その難易度の全種族ぶんのキーへ展開して1回のリクエストにまとめる(sbFetchRankings)。
//   新しい行も列も増やさないので、これまでに送られた記録がそのまま並ぶ。
//   別キーを新設して二重送信する方法もあるが、それだと過去の記録が1件も出ないうえ、
//   1周回につき送信が2回に増えて失敗する場所も増えるため採らない。
// 血統idに 'all' は存在しない(data/lineages.js)。実在する種族のキーと重ならないよう、
// 先に parseSpeciesChallengeRankingDifficulty を通してからこちらを見る。
const SPECIES_RANKING_ALL_ID = 'all';
// ランキング画面の種族タブのid。血統idとぶつからない名前にする
const SPECIES_RANK_TAB_ALL = 'allSpecies';
const SPECIES_RANK_TAB_SELF_BEST = 'selfBest';
const speciesChallengeAllRankingDifficulty = (difficultyId) =>
  (SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    ? `${SPECIES_RANKING_PREFIX}${SPECIES_RANKING_SEPARATOR}${SPECIES_RANKING_ALL_ID}${SPECIES_RANKING_SEPARATOR}${difficultyId}`
    : null);
const parseSpeciesChallengeAllRankingDifficulty = (key) => {
  const parts = String(key ?? '').trim().split(SPECIES_RANKING_SEPARATOR);
  if (parts.length !== 3 || parts[0].toLowerCase() !== SPECIES_RANKING_PREFIX.toLowerCase()) return null;
  if (parts[1].toLowerCase() !== SPECIES_RANKING_ALL_ID) return null;
  // 実在する血統と同じidなら、そちらの解釈を優先する(取り違えを構造的に防ぐ)
  if (speciesChallengeLineages().some(item => item.id.toLowerCase() === SPECIES_RANKING_ALL_ID)) return null;
  const difficultyId = SPECIES_CHALLENGE_DIFFICULTY_IDS.find(id => id.toLowerCase() === parts[2].toLowerCase());
  return difficultyId ? { difficultyId } : null;
};
// 「全種族」を、実際にDBへ入っている種族別キーの一覧へ展開する
const speciesChallengeAllRankingMembers = (difficultyId) => speciesChallengeLineages()
  .map(lineage => speciesChallengeRankingDifficulty(lineage.id, difficultyId))
  .filter(Boolean);
// 「全種族」の一覧で、1件ごとの記録がどの種族のものかを表示するための短いラベル。
// difficulty列(Species-<血統id>-<難易度id>)から血統名を戻すだけで、既存キーの意味は変えない。
// 知らないキーや列が来ていない古い記録ではnullを返し、呼び出し側でバッジごと出さない
const speciesRankingLabel = (difficultyKey) => {
  const parsed = parseSpeciesChallengeRankingDifficulty(difficultyKey);
  if (!parsed) return null;
  const lineage = speciesChallengeLineages().find(item => item.id === parsed.speciesId);
  return lineage ? `${lineage.name}種` : null;
};
// 極限の段階ID。知らない値が来ても実装済みの段階へ落として、ランキングのキーを壊さない
// 内部難易度も将来用の記録・ランキングIDへ正規化できる。通常UIへの公開可否はavailableで別管理し、
// デバッグ戦は送信入口で遮断するため、ここで未公開IDを別難易度へ混ぜない。
const normalizeExtremeDifficulty = (value) => (ALL_EXTREME_DIFFICULTIES
  .find(setting => setting.id === value) ? value : EXTREME_SETTING.id);
// そのモード・難易度の記録を置く難易度キー。チャレンジは従来どおりの値をそのまま使う。
// 極限チャレンジは diff に極限の段階ID(EXTREMEなど)を渡す
// 種族チャレンジだけは種族(主血統)も要るので、第3引数で受け取る
const rankingDifficultyForMode = (mode, diff, speciesId=null) => {
  if (mode === BATTLE_MODE_SPECIES_CHALLENGE) {
    const key = speciesChallengeRankingDifficulty(speciesId, diff);
    if (!key) throw new Error(`unknown species challenge ranking: ${String(speciesId)}/${String(diff)}`);
    return key;
  }
  if (typeof EXTREME_MODE !== 'undefined' && EXTREME_MODE && mode === EXTREME_MODE.id) {
    return `${EXTREME_RANKING_PREFIX}${normalizeExtremeDifficulty(diff)}`;
  }
  return isProMode(mode) ? `${PRO_RANKING_PREFIX}${normalizeBattleDifficulty(diff)}` : normalizeBattleDifficulty(diff);
};
// ランキングの難易度キーから、表示に使う素の難易度へ戻す
const rankingDifficultyBase = (key) => {
  const text = String(key || '');
  const species = parseSpeciesChallengeRankingDifficulty(text);
  if (species) return species.difficultyId;
  if (text.startsWith(EXTREME_RANKING_PREFIX)) return text.slice(EXTREME_RANKING_PREFIX.length);
  return text.startsWith(PRO_RANKING_PREFIX) ? text.slice(PRO_RANKING_PREFIX.length) : text;
};
const normalizeRankingDifficulty = (value) => {
  // 種族チャレンジのキーは種族×難易度の組で決まるので、固定リストではなく組み合わせで確かめる
  const species = parseSpeciesChallengeRankingDifficulty(value);
  if (species) return speciesChallengeRankingDifficulty(species.speciesId, species.difficultyId);
  // 「全種族」は保存には使わない読み取り専用の合成キー。取得のときだけ種族別キーへ展開する
  const speciesAll = parseSpeciesChallengeAllRankingDifficulty(value);
  if (speciesAll) return speciesChallengeAllRankingDifficulty(speciesAll.difficultyId);
  const compact = String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
  const canonical = RANKING_DIFFICULTY_KEYS.find(key => key.toLowerCase() === compact);
  if (!canonical) throw new Error(`unknown ranking difficulty: ${String(value)}`);
  return canonical;
};
// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー。
// 表示ラベルや大文字小文字の異なる入力を、そのままオブジェクトキーにしない。
const rankingDifficultyKey = (value) => normalizeRankingDifficulty(value);

// 難易度ごとの記録を取得する。order を変えることで「スコア上位」と「レベル上位」を出し分ける
// 表示件数。rankingsテーブルにdifficulty+scoreの索引が無く、取得のたびに全行を走査して
// 並べ替えているため、件数を増やすとそのまま待ち時間になる。索引を追加するまでは20件にする。
// 一覧に見せる件数(難易度タブを選んだときは、その1難易度だけを取りにいく)。
// 20件→50件にしても、通信は1難易度ぶんで +24KB、描画は +14ms しか増えない
// (実測 tools/ranking-dye-cost-check.js)
const RANKING_SCORE_LIMIT = 50;
// 難易度を指定せずにまとめて取りにいくとき(いまは呼ぶ場所が無い)の1難易度あたりの件数。
// ここで50件にすると9難易度ぶん=450行(約367KB)になるので、控えめにしておく。
// ブリーダーLv・絆Lvは難易度で絞らない専用の取得(絆Lvは RANKING_LEVEL_FETCH_LIMIT の1回、
// ブリーダーLvは sbFetchAllBreederRows のページ送り)なので、この値の影響は受けない
const RANKING_BULK_LIMIT = 20;
// 取得ごとの詳細ログは切り分け用。常時出すと件数ぶんの文字列生成が毎回走るので、
// 必要なときだけ localStorage の mh_ranking_debug='1' で有効にする(エラーは常に出す)。
const rankingDebugEnabled = () => { try { return window.localStorage.getItem('mh_ranking_debug') === '1'; } catch { return false; } };
const rankingLog = (requestId, event, detail={}) => { if (rankingDebugEnabled()) console.info('[ranking][diagnostic]', { requestId, event, at: new Date().toISOString(), ...detail }); };
// レベル系ランキングは難易度で絞らず1回で取る。件数が多いほど並べ替えと転送に時間がかかるため、
// 表示に必要な範囲にとどめる。
// 絆Lvは編成(party)ごと取るので1行が重い。ただし60件では取得枠が狭すぎて、
// プレイ直後の自分の記録すら入らないことがあったため広げた
const RANKING_LEVEL_FETCH_LIMIT = 120;
// 絆Lvは「新しい記録」から取りたい。以前は order=id.desc だけを使っていたが、
// rankings.id が uuid の場合 id.desc は作成順にならず、毎回ばらばらの記録を拾ってしまう
// (スコアは score.desc、ブリーダーLvは level.desc なので影響が無く、絆Lvだけが
//  「プレイしても更新されない」ように見えていた)。
// 記録した時刻で並べ、その列が使えない環境では従来どおり id.desc へ落とす。
const BOND_RANKING_ORDERS = ['created_at.desc.nullslast', 'id.desc'];
// ブリーダーLvは「1人1行」ではなく、プレイのたびに増える記録(1プレイ=1行)から
// 名前ごとにまとめて出す。そのため「上位N行」を取る作りだと、よく遊ぶ人の過去の記録が
// 枠を食いつぶし、Lvの低い人は1行も取れずに一覧から丸ごと消えてしまう。
// (60行では7人いても3人しか出ず、400行へ増やしたあとも記録が貯まって再発した)
// 行数を増やして誤魔化すのではなく、行が尽きるまでページ送りして全員を必ず集計する。
// 取るのは name/level/icon の3列だけなので1行は数十バイトで、1万行でも数百KBに収まる。
const RANKING_BREEDER_PAGE_SIZE = 2000;
// 万一記録が想定以上に増えても通信が止まらないようにする上限。
// ここに達したときはLvの高い側から読めたぶんだけで集計する
const RANKING_BREEDER_MAX_ROWS = 24000;
const RANKING_BREEDER_MAX_PAGES = 12;
// ブリーダーLvは編成(party)を使わない。partyはJSONで1行あたりが大きいため、
// 使わない場面では取得しないだけで転送量と待ち時間がはっきり減る
const RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon';
const RANKING_SELECT_NO_PARTY = 'user_name,hero,score,level,icon';
// ブリーダーLvの一覧は名前・レベル・アイコンしか出さない。全件をページ送りで読むので、
// 使わない列(hero/score)まで運ばない
const RANKING_SELECT_BREEDER = 'user_name,level,icon';

// ==================== 周回の結果(ターン数・到達WAVE) ====================
// 「クリアしたときの累計ターン数」と「どのWAVEで終わったか」をスコアランキングに出すための列。
// rankings へ後から足す列なので、SQLをまだ適用していない環境が必ず存在する。
//
// 【なぜ気を付けるか】
// PostgRESTは知らない列を送る/選ぶと400を返す。ここを素通しにすると、列が無い環境では
// スコアの保存そのものが失敗し、ランキングも開けなくなる(既存の記録を壊しはしないが、
// 新しい記録が1件も残らなくなる)。そこで、一度400で気付いたらその後は列を外して動く。
// SQLを適用すればアプリ側は何もしなくても自動的に載りはじめる。
const RANKING_RUN_STATS_COLUMNS = 'turns,reached_wave';
let _rankingRunStatsUnavailable = false;
const rankingRunStatsUnavailable = () => _rankingRunStatsUnavailable;
// 「その列は無い」という応答かどうか。通信の失敗や権限の失敗と取り違えない
//   選ぶとき  … 400 + 42703 (column rankings.turns does not exist)
//   送るとき  … 400 + PGRST204 (Could not find the 'turns' column of 'rankings')
const _isMissingColumnError = (status, body) => {
  if (status !== 400) return false;
  const text = String(body || '');
  if (!/turns|reached_wave/i.test(text)) return false;
  return /PGRST204|PGRST100|42703|does not exist|Could not find the/i.test(text);
};
// 取得する列。ターン数を使う一覧(スコア)にだけ足す。ブリーダーLvの一覧は
// 全件をページ送りで読むので、使わない列を運ばせない
const rankingSelectWithRunStats = (base) =>
  (_rankingRunStatsUnavailable || !base || !base.includes('score')) ? base : `${base},${RANKING_RUN_STATS_COLUMNS}`;
// bond_levels の1行を、rankings から集計したものと同じ形のエントリへ直す。
// 表示側(renderBondRankingEntry)はどちらから来た行かを知らなくてよい
const bondLevelRowToEntry = (row) => {
  const monsterId = row?.monster_id || null;
  const monName = ALL_PLAYER_MONSTERS[monsterId]?.name || row?.mon_name || null;
  const bondLevel = Number(row?.bond_level);
  if (!monName || !Number.isFinite(bondLevel) || bondLevel <= 0) return null;
  const individualId = String(row?.individual_id || '');
  return {
    userName: row?.user_name || '名無しのブリーダー',
    icon: row?.icon ?? null,
    monName, bondLevel, monsterId,
    imgUrl: ALL_PLAYER_MONSTERS[monsterId]?.iconUrl || null,
    emoji: ALL_PLAYER_MONSTERS[monsterId]?.emoji || null,
    masuId: individualId.startsWith('legacy:') ? null : (individualId || null),
    // 詳細表示に使う育成スナップショット(古い記録には無い)
    detail: row?.detail ?? null,
    colors: Array.isArray(row?.colors) ? row.colors : [],
    individualId,
  };
};
// 正本テーブルの結果と、rankings から集計した結果を1つに束ねる。
// 同じ「人 × 個体」は正本テーブル側を採用し、正本にまだ載っていない人だけ
// 従来どおり rankings の集計で補う(テーブルを作った直後から一覧が欠けないようにするため)
const mergeBondRankingEntries = (primaryEntries, legacyEntries) => {
  const keyOf = (e) => `${e?.userName}\u0000${e?.individualId || (e?.masuId != null && String(e.masuId) !== '' ? String(e.masuId) : `legacy:${e?.monsterId || e?.monName}`)}`;
  const merged = new Map();
  (primaryEntries || []).forEach(e => { if (e) merged.set(keyOf(e), e); });
  (legacyEntries || []).forEach(e => { if (e && !merged.has(keyOf(e))) merged.set(keyOf(e), e); });
  return [...merged.values()].sort((a, b) => b.bondLevel - a.bondLevel);
};
// ==================== 絆Lvの正本テーブル(bond_levels) ====================
// 絆Lvは編成(party)のJSONの中にあるため、rankings からはDB側で「絆Lvの高い順」に
// 並べられない。そのため新着順に RANKING_LEVEL_FETCH_LIMIT 行だけ取ってアプリ側で
// 集計しており、よく遊ぶ人の記録で枠が埋まると、しばらく遊んでいない人が一覧から
// 丸ごと消える(ブリーダーLvで2度起きたのと同じ構造の問題)。
// そこで「1人 × 1個体で必ず1行」の専用テーブルへ、プレイ終了時に上書き保存する。
//
// テーブルがまだ無い環境でも動くようにしてある(適用前・適用中でも壊れない)。
// 1度でも「テーブルが無い」と分かったら、そのセッションでは以後アクセスしない。
const BOND_LEVELS_TABLE = 'bond_levels';
const BOND_LEVELS_SELECT = 'user_name,individual_id,monster_id,mon_name,bond_level,icon,detail,colors';
// 1行が数百バイトなので、種類別タブぶんまで含めて1回で取り切れる余裕を持たせる
const BOND_LEVELS_FETCH_LIMIT = 1000;
// 「テーブルが無い」と分かったあとは、毎回404を出しにいかない
let _bondLevelsUnavailable = false;
const bondLevelsUnavailable = () => _bondLevelsUnavailable;
// PostgRESTはテーブルが無いとき404 + PGRST205 を返す。権限や通信の失敗と取り違えない
const _isMissingTableError = (status, body) => {
  if (status !== 404) return false;
  return /PGRST205|Could not find the table|does not exist/i.test(String(body || ''));
};
// 絆Lvの正本を読む。テーブルが無ければ null を返し、呼び出し側は今までどおり
// rankings から集計する(新旧併用)
const sbFetchBondLevels = async (requestId='untracked') => {
  if (_bondLevelsUnavailable) return null;
  const url = `${SUPABASE_URL}/rest/v1/${BOND_LEVELS_TABLE}?select=${BOND_LEVELS_SELECT}`
    + `&order=bond_level.desc.nullslast&limit=${BOND_LEVELS_FETCH_LIMIT}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      if (_isMissingTableError(res.status, body)) {
        _bondLevelsUnavailable = true;
        rankingLog(requestId, 'bond-levels-missing', { status: res.status });
        return null;
      }
      throw new Error(`bond_levels ${res.status}: ${body || res.statusText}`);
    }
    const rows = JSON.parse(body || '[]');
    rankingLog(requestId, 'bond-levels-fetched', { received: Array.isArray(rows) ? rows.length : 0 });
    return Array.isArray(rows) ? rows : [];
  } finally {
    clearTimeout(timer);
  }
};
// 絆Lvの正本を書く。同じ個体は何度書いても1行のまま、最新の絆Lvで上書きされる
// (転生で下がった場合もそのまま反映する。いまの状態を映すのが正しいため)。
// ランキング送信の付随処理なので、失敗しても周回の進行は止めない。
const sbUpsertBondLevels = async (rows) => {
  if (_bondLevelsUnavailable || !Array.isArray(rows) || rows.length === 0) return false;
  const url = `${SUPABASE_URL}/rest/v1/${BOND_LEVELS_TABLE}?on_conflict=user_name,individual_id`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows), signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      if (_isMissingTableError(res.status, body)) { _bondLevelsUnavailable = true; return false; }
      throw new Error(`bond_levels upsert ${res.status}: ${body || res.statusText}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
};
// ランキングへ送る編成から、絆Lvの正本へ入れる行を作る。
// 個体が特定できる記録は masuId、できない古い形は legacy:種ID でまとめる
// (どちらも rankings 側の集計と同じ考え方)。
const bondLevelRowsFromParty = (userName, icon, party) => {
  const byIndividual = new Map();
  (Array.isArray(party) ? party : []).forEach(member => {
    const bondLevel = Number(member?.bondLevel);
    if (!member || !Number.isFinite(bondLevel) || bondLevel <= 0) return;
    const monsterId = member.baseId || member.monsterId || member.id || null;
    const monName = ALL_PLAYER_MONSTERS[monsterId]?.name || member.name || null;
    if (!monName) return;
    const individualId = (member.masuId != null && String(member.masuId) !== '')
      ? String(member.masuId) : `legacy:${monsterId || monName}`;
    // 同じ周回に同じ個体が2枠入ることは無いが、万一重なったら高い方を残す
    const current = byIndividual.get(individualId);
    if (current && current.bond_level >= bondLevel) return;
    byIndividual.set(individualId, {
      user_name: userName || '名無しのブリーダー',
      individual_id: individualId,
      monster_id: monsterId, mon_name: monName,
      bond_level: Math.floor(bondLevel),
      icon: icon ?? null,
      detail: member.detail ?? null,
      colors: Array.isArray(member.colors) ? member.colors : null,
    });
  });
  return [...byIndividual.values()];
};
const sbFetchRankings = async (diff, limit=RANKING_SCORE_LIMIT, order='score.desc.nullslast', offset=0, requestId='untracked', selectColumns=RANKING_SELECT_FULL) => {
  // diff を省略(null)すると難易度で絞らず、全難易度をまとめて取る
  const normalizedDifficulty = diff == null ? null : normalizeRankingDifficulty(diff);
  // 必要な列だけを受け取り、過去記録が多い難易度でもレスポンスを不用意に大きくしない。
  // ターン数・到達WAVEはSQLをまだ適用していない環境では選べないので、そのときは外れる。
  const baseSelect = selectColumns || RANKING_SELECT_FULL;
  const select = rankingSelectWithRunStats(baseSelect);
  // DBに保存する正規keyと同じ値をeqで取得する。ilikeによる別系統の
  // 取得条件を残さず、NormalもHardと完全に同じSELECT経路にする。
  //
  // 種族チャレンジの「全種族」だけは、その難易度の種族別キーをすべて並べた in.(...) にする。
  // これも前方一致(ilike)ではなく実在するキーの完全一致の並びなので、
  // 他モードの行(Normal / ProNormal / ExtremeEXTREME)が紛れ込むことは構造上ない。
  // 並べ替えと件数の絞り込みはDB側で効くので、通信は他のタブと同じ1回で済む。
  const speciesAllDifficulty = normalizedDifficulty == null ? null : parseSpeciesChallengeAllRankingDifficulty(normalizedDifficulty);
  const speciesAllMembers = speciesAllDifficulty ? speciesChallengeAllRankingMembers(speciesAllDifficulty.difficultyId) : [];
  const difficultyFilter = normalizedDifficulty == null
    ? ''
    : speciesAllDifficulty
      // 値ごとに符号化し、区切りのカンマだけを生のまま残す(値に「-」以外の記号は入らない)
      ? `&difficulty=in.(${speciesAllMembers.map(key => encodeURIComponent(`"${key}"`)).join(',')})`
      : `&difficulty=eq.${encodeURIComponent(normalizedDifficulty)}`;
  // 展開先が1件も無いときに in.() を送るとDB側の構文エラーになるので、その前に空で返す
  if (speciesAllDifficulty && speciesAllMembers.length === 0) return [];
  // 「全種族」だけは difficulty 列(Species-<血統id>-<難易度id>)も一緒に受け取る。
  // 展開した種族別キーがまとめて返るので、この列が無いとどの行がどの種族のものか
  // 一覧側で区別できない。他の難易度は元々1本のキーしか要求しないので不要
  const selectWithDifficulty = speciesAllDifficulty ? `${select},difficulty` : select;
  const url = `${SUPABASE_URL}/rest/v1/rankings?select=${selectWithDifficulty}${difficultyFilter}&order=${order}&limit=${limit}&offset=${offset}`;
  const startedAt = Date.now();
  rankingLog(requestId, 'request-start', {
    difficulty: normalizedDifficulty, requestedDifficulty: diff, category: 'ranking', rankingType: order, table: 'rankings',
    columns: select, limit, offset, url, supabaseUrl: SUPABASE_URL,
    keyLoaded: Boolean(SUPABASE_KEY), keyType: SUPABASE_KEY.startsWith('sb_publishable_') ? 'publishable' : 'legacy'
  });
  // モバイル回線などで接続だけが残り続けても、ランキング画面を永久に待機させない。
  const controller = new AbortController();
  // 8秒では「遅いだけで成功する取得」まで失敗扱いになり、そのたびに端末内の復旧表示へ
  // 落ちていた。回線が細くても待てる範囲まで伸ばす(それでも返らなければ打ち切る)
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    rankingLog(requestId, 'supabase-response', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, status: res.status, statusText: res.statusText, ok: res.ok, dataCount: res.ok ? (() => { try { const parsed = JSON.parse(body); return Array.isArray(parsed) ? parsed.length : null; } catch { return null; } })() : null, error: res.ok ? null : body });
    if (!res.ok) {
      // ターン数・到達WAVEの列がまだ無い環境。列を外して取り直せば今までどおり表示できる。
      // 一度気付いたら以後は最初から外して送るので、この寄り道は多くても1回きり
      if (select !== baseSelect && _isMissingColumnError(res.status, body)) {
        _rankingRunStatsUnavailable = true;
        rankingLog(requestId, 'run-stats-columns-missing', { status: res.status });
        return sbFetchRankings(diff, limit, order, offset, requestId, baseSelect);
      }
      throw new Error(`fetch ${res.status} ${res.statusText}; url=${url}; response=${body || '(empty)'}`);
    }
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error(`invalid JSON; url=${url}; response=${body || '(empty)'}; error=${e.message}`);
    }
  } catch (error) {
    const normalized = error?.name === 'AbortError'
      ? new Error(`ranking request timed out after 8000ms; url=${url}`)
      : error;
    rankingLog(requestId, 'supabase-error', { difficulty: normalizedDifficulty, endedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt, timeout: error?.name === 'AbortError', networkError: error instanceof TypeError, name: normalized?.name, message: normalized?.message, stack: normalized?.stack });
    throw normalized;
  } finally {
    clearTimeout(timer);
  }
};
// ブリーダーLvの記録を名前ごとに1件へまとめ、最も高いレベルを採用する。
// 1プレイ=1行なので同じ人が何行も持つ。取得直後にここでまとめておくと、
// 端末へ残すキャッシュも人数ぶんの大きさで収まる
const aggregateBreederLevels = (rows) => {
  const byName = new Map();
  (rows || []).forEach(r => {
    const name = r?.userName || '名無しのブリーダー';
    const lv = Number(r?.level) || 0;
    const cur = byName.get(name);
    if (!cur || lv > cur.level) byName.set(name, { ...r, userName: name, level: lv });
  });
  return [...byName.values()].filter(x => x.level > 0).sort((a, b) => b.level - a.level);
};
// ブリーダーLv用に、rankingsの全行をページ送りで読む。
// 1プレイ=1行なので同じ人が何行も持つ。「上位N行」では下位の人が消えるため、
// 行が尽きる(空のページが返る)まで読み進めてから名前ごとにまとめる。
const sbFetchAllBreederRows = async (requestId='untracked') => {
  const all = [];
  // 1ページの実際の件数はサーバー側の上限で要求より少なくなることがある。
  // 1ページ目の件数を「そのサーバーでの1ページ分」とみなし、それより少なくなったら最後のページとする
  let pageSize = RANKING_BREEDER_PAGE_SIZE;
  let offset = 0;
  for (let page = 0; page < RANKING_BREEDER_MAX_PAGES && offset < RANKING_BREEDER_MAX_ROWS; page++) {
    const got = await sbFetchRankings(null, pageSize, 'level.desc.nullslast', offset, requestId, RANKING_SELECT_BREEDER);
    const rows = Array.isArray(got) ? got : [];
    all.push(...rows);
    rankingLog(requestId, 'breeder-page', { page, offset, pageSize, received: rows.length, total: all.length });
    if (rows.length === 0) break;
    if (page === 0 && rows.length < pageSize) pageSize = rows.length;
    if (rows.length < pageSize) break;
    offset += rows.length;
  }
  return all;
};
// 記録を1件挿入する(1プレイ=1件)
const sbInsertScore = async (row) => {
  // 全国ランキングの書き込みは常にclear_id必須とする。呼び出し側の指定漏れで通常POSTへ
  // 戻る経路を残すと、タイムアウト後の再送などが同じクリアを別行として保存してしまう。
  if (typeof row?.clear_id !== 'string' || !row.clear_id.trim()) {
    throw new Error('ranking clear_id is required; unsafe insert skipped');
  }
  const normalizedRow = { ...row, difficulty: normalizeRankingDifficulty(row?.difficulty) };
  // ターン数・到達WAVEの列がまだ無い環境では、その2つを送ると400になり
  // 記録そのものが保存できない。無いと分かっている間は最初から外して送る
  if (_rankingRunStatsUnavailable) { delete normalizedRow.turns; delete normalizedRow.reached_wave; }
  const requestId = `insert-${normalizedRow.difficulty}-${Date.now()}`;
  const query = '?on_conflict=clear_id';
  const prefer = 'resolution=ignore-duplicates,return=minimal';
  // 結果画面はこのPOSTが確定するまで入力をロックするため、通信が切れかけた端末でも
  // 永久に「処理中」にならないようGETと同じ上限を設ける。タイムアウト後はclear_id付きの
  // ローカル記録へ退避し、同じクリアを非冪等なPOSTで再送しない。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    rankingLog(requestId, 'insert-start', {
      difficulty: normalizedRow.difficulty, table: 'rankings', clearId: normalizedRow.clear_id,
      score: normalizedRow.score, userName: normalizedRow.user_name, level: normalizedRow.level,
      hasIcon: Boolean(normalizedRow.icon), columns: Object.keys(normalizedRow), payload: normalizedRow
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings${query}`, { method:'POST', headers:{...SB_HEADERS, 'Prefer':prefer}, body: JSON.stringify(normalizedRow), signal: controller.signal });
    const body = await res.text();
    let errorCode = null;
    if (body) {
      try { errorCode = JSON.parse(body)?.code || null; } catch {}
    }
    const isUniqueViolation = res.status === 409 && errorCode === '23505';
    rankingLog(requestId, 'insert-response', {
      difficulty: normalizedRow.difficulty, clearId: normalizedRow.clear_id,
      status: res.status, statusText: res.statusText, ok: res.ok,
      errorCode, isUniqueViolation, error: res.ok ? null : (body || res.statusText)
    });
    if (!res.ok) {
      // ターン数・到達WAVEの列がまだ無い環境。ここで諦めるとスコアが1件も残らなくなるので、
      // その2つを外して必ず送り直す(記録を落とさないことを最優先にする)。
      // 一度気付けば以後は最初から外して送るので、この寄り道は多くても1回きり
      if (!_rankingRunStatsUnavailable
          && (normalizedRow.turns !== undefined || normalizedRow.reached_wave !== undefined)
          && _isMissingColumnError(res.status, body)) {
        _rankingRunStatsUnavailable = true;
        rankingLog(requestId, 'run-stats-columns-missing', { status: res.status });
        const { turns, reached_wave, ...withoutRunStats } = normalizedRow;
        return sbInsertScore(withoutRunStats);
      }
      const error = new Error(`insert ${res.status}: ${body || res.statusText}`);
      error.status = res.status;
      error.body = body;
      error.code = errorCode;
      error.isUniqueViolation = isUniqueViolation;
      throw error;
    }
    return { saved: true, status: res.status, body, row: normalizedRow };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('ranking insert timed out after 8000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 検査(tools/ranking-run-stats-check.js)からスコア送信だけを呼べるようにしておく。
// 「turns/reached_wave の列がまだ無い環境でもスコアが保存できること」は、
// 実際に1周遊ばないと通らない経路だと確かめるのに何分もかかるうえ、
// 落ちたときの被害(記録が1件も残らない)が大きいので、ここだけ直接叩けるようにする。
// 読み出し専用の参照を1つ足すだけで、ゲーム側の動きは何も変わらない。
try { if (typeof window !== 'undefined') window.__mhTestHooks = { ...(window.__mhTestHooks || {}), sbInsertScore, rankingRunStatsUnavailable }; } catch {}

// 全国保存と端末内フォールバックの成否を混同しない共通送信経路。
// insertが失敗しても診断情報を端末側の行へ残すが、全国保存成功としては返さない。
const persistRankingScore = async ({ row, insertScore=sbInsertScore, saveLocal }) => {
  try {
    const response = await insertScore(row);
    return { nationalSaved: response?.saved === true, localSaved: false, response, error: null };
  } catch (error) {
    let localSaved = false;
    try {
      await saveLocal(error);
      localSaved = true;
    } catch (localError) {
      console.error('[ranking] local fallback also failed:', localError && localError.message ? localError.message : localError);
    }
    return { nationalSaved: false, localSaved, response: null, error };
  }
};

const createRunId = () => globalThis.crypto?.randomUUID?.() || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

// モンビー(音ゲー)の全国ランキング専用の送受信(2026-09-04)。
//
// 既存の sbInsertScore / sbFetchRankings は、difficulty列の値を必ず
// normalizeRankingDifficulty で検証しており、そこで認めているのは通常バトル・プロ・極限・
// 種族チャレンジの固定パターンだけ。Rhythm-<songId>-<難易度id> をそのまま渡すと
// 「unknown ranking difficulty」で例外になる。normalizeRankingDifficultyやその一覧
// (RANKING_DIFFICULTY_KEYS)は全モードの送受信が経由する共通処理なので、モンビーのために
// そこを緩めると他モードの検証まで一緒に緩んでしまう。そのため触らず、モンビー専用の
// 送受信をここへ分けて持つ。テーブル・列は既存の rankings をそのまま使う
// (difficulty列の値だけで区別する、種族チャレンジと同じ考え方)。
const RHYTHM_RANKING_SELECT = 'user_name,hero,party,score,level,icon,difficulty';
const sbInsertRhythmScore = async (row) => {
  if (typeof row?.clear_id !== 'string' || !row.clear_id.trim()) {
    throw new Error('rhythm ranking clear_id is required; unsafe insert skipped');
  }
  if (!String(row?.difficulty ?? '').startsWith(`${RHYTHM_RANKING_PREFIX}${RHYTHM_RANKING_SEPARATOR}`)) {
    throw new Error(`invalid rhythm ranking difficulty key: ${String(row?.difficulty)}`);
  }
  const query = '?on_conflict=clear_id';
  const prefer = 'resolution=ignore-duplicates,return=minimal';
  const requestId = `rhythm-insert-${row.difficulty}-${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    rankingLog(requestId, 'rhythm-insert-start', { difficulty: row.difficulty, clearId: row.clear_id, score: row.score, userName: row.user_name });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rankings${query}`, { method:'POST', headers:{...SB_HEADERS,'Prefer':prefer}, body: JSON.stringify(row), signal: controller.signal });
    const body = await res.text();
    rankingLog(requestId, 'rhythm-insert-response', { status: res.status, ok: res.ok, error: res.ok ? null : (body || res.statusText) });
    if (!res.ok) {
      const error = new Error(`rhythm ranking insert ${res.status}: ${body || res.statusText}`);
      error.status = res.status; error.body = body;
      throw error;
    }
    return { saved: true, status: res.status, body };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('rhythm ranking insert timed out after 8000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
// 難易度合算表示のため、複数のdifficultyキーをin.(...)でまとめて1回のリクエストにする
// (種族チャレンジの「全種族」がsbFetchRankings内で行っているのと同じ考え方だが、
// あちらは既存モードの検証を経由するため触らず、こちらは完全に独立させる)
const sbFetchRhythmRankings = async (difficultyKeys, limit=RHYTHM_RANKING_FETCH_LIMIT, offset=0, requestId='untracked') => {
  const keys = (Array.isArray(difficultyKeys) ? difficultyKeys : [difficultyKeys]).filter(Boolean);
  if (keys.length === 0) return [];
  const url = `${SUPABASE_URL}/rest/v1/rankings?select=${RHYTHM_RANKING_SELECT}&difficulty=in.(${keys.map(k=>encodeURIComponent(`"${k}"`)).join(',')})&order=score.desc.nullslast&limit=${limit}&offset=${offset}`;
  rankingLog(requestId, 'rhythm-request-start', { keys, limit, offset, url, table: 'rankings' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: SB_HEADERS, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`rhythm ranking fetch ${res.status} ${res.statusText}; url=${url}; response=${body || '(empty)'}`);
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error(`invalid JSON; url=${url}; response=${body || '(empty)'}; error=${e.message}`);
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('rhythm ranking fetch timed out after 15000ms');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// 難易度に依存しない周回開始処理。Normalだけ前周のclear_idや送信ロックを引き継ぐ
// 分岐が生まれないよう、タイトル復帰と再挑戦の両方からこの1か所を呼ぶ。
const beginNewRankingRun = ({ runIdRef, scoreSubmittedRef, runFinalizingRef, rewardsAwardedRef, clearRecordedRef }) => {
  runFinalizingRef.current = false;
  scoreSubmittedRef.current = false;
  rewardsAwardedRef.current = false;
  clearRecordedRef.current = false;
  runIdRef.current = createRunId();
  return runIdRef.current;
};
