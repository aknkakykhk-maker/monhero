const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 送れなかった記録を、あとで送り直すしくみを確かめる検査。
//
// 背景(2026-09-13・ユーザー指摘「こういうスコアが出てるんだけどランキングに載ってない」):
//   rankings.score が int4 だったため 45,054,226,345(約450億)が 22003 で拒否され、
//   端末へ退避したまま誰にも気づかれなかった。DB側は bigint へ広げて直したが、
//   すでに弾かれた記録は「送り直す」しくみが無いと載らない。
//   また、送信に失敗しても画面には何も出ないので、プレイヤーは成功と区別できなかった。
//
// ここで見るのは次の2つ。
//   ① 送り直しの組み立て(どれを送るか・どんな行にするか・送れたらどう印を付けるか)を
//      実際に動かして確かめる。通信も保存もしない純粋な関数なので、そのまま呼べる
//   ② 画面とつなぐ側(起動時に1回走らせる・失敗をリザルトで知らせる)が入っているか
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const supabaseSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const resultSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/68-screen-run-result.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① 送り直しの組み立てを、実際に動かして確かめる ---
// 26-supabase.jsx から、通信をしない3つの関数と2つの定数だけを切り出して読む
const pick = (name) => {
  const at = supabaseSrc.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`${name} が見つかりません`);
  // 次の「行頭の const/function/// ===== 」まで
  const rest = supabaseSrc.slice(at + 1);
  const nextAt = rest.search(/\n(?:const |function |\/\/ ===== )/);
  return supabaseSrc.slice(at, nextAt < 0 ? undefined : at + 1 + nextAt);
};
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`
${pick('RANKING_RESEND_LIMIT')}
${pick('RANKING_RESEND_DELAY_MS')}
${pick('pendingLocalRankingEntries')}
${pick('RANKING_CREATED_AT_MIN_MS')}
${pick('rankingCreatedAtFromLocal')}
${pick('rankingRowFromLocalEntry')}
${pick('markLocalRankingEntriesSent')}
globalThis.__t = { RANKING_RESEND_LIMIT, RANKING_RESEND_DELAY_MS,
  pendingLocalRankingEntries, rankingCreatedAtFromLocal, rankingRowFromLocalEntry, markLocalRankingEntriesSent };`, ctx);
const { RANKING_RESEND_LIMIT, RANKING_RESEND_DELAY_MS,
  pendingLocalRankingEntries, rankingCreatedAtFromLocal, rankingRowFromLocalEntry, markLocalRankingEntriesSent } = ctx.__t;

// 端末に残っている記録を模したもの。実際に submitLocalScore が作る形にそろえてある
const sent = { userName:'送信済み', hero:'Mocchi', party:[], score:100, diff:'Legend', level:9,
               icon:'Mocchi', clearId:'sent-1', at:1, nationalSaved:true };
const pending450 = { userName:'あきら', hero:'Mocchi', party:[{role:'hero',id:'Mocchi'}], score:45054226345,
                     diff:'Legend', level:10, icon:'Mocchi', clearId:'pending-450', at:2,
                     reachedWave:10, turns:12, nationalSaved:false,
                     nationalError:{ message:'integer out of range', status:400, code:'22003' } };
const pendingNoId = { userName:'昔の記録', hero:'Mocchi', party:[], score:500, diff:'Legend',
                      clearId:undefined, at:3, nationalSaved:false };
const oldEntry = { userName:'もっと昔', hero:'Mocchi', party:[], score:300, diff:'Legend', at:4 }; // フラグ自体が無い
const brokenScore = { userName:'こわれ', hero:'Mocchi', party:[], score:'あ', diff:'Legend',
                      clearId:'broken-1', at:5, nationalSaved:false };
const list = [sent, pending450, pendingNoId, oldEntry, brokenScore, null];

const pending = pendingLocalRankingEntries(list);
check('送り直すのは「送れていない」ものだけ',
  pending.length === 1 && pending[0].clearId === 'pending-450',
  pending.map(e => e.clearId).join(', ') || '(なし)');
check('送信済みの記録は送り直さない', !pending.includes(sent));
check('clearIdが無い古い記録は送り直さない(二重登録を防ぐ鍵が無いため)',
  !pending.some(e => e === pendingNoId));
check('フラグ自体が無い記録には手を出さない', !pending.some(e => e === oldEntry));
check('スコアが数値でない記録は送り直さない', !pending.some(e => e === brokenScore));
check('壊れた要素(null)があっても落ちない', Array.isArray(pending));
check('保存が無い・配列でない場合も落ちない',
  pendingLocalRankingEntries(null).length === 0 && pendingLocalRankingEntries(undefined).length === 0
    && pendingLocalRankingEntries({}).length === 0);

// 送るときの行。submitLocalScore が作る row と同じ形であること
const row = rankingRowFromLocalEntry(pending450, 'Legend');
check('送る行が元の記録どおりに組み立てられる',
  row.difficulty === 'Legend' && row.user_name === 'あきら' && row.hero === 'Mocchi'
    && row.score === 45054226345 && row.clear_id === 'pending-450' && row.level === 10
    && row.icon === 'Mocchi' && Array.isArray(row.party) && row.party.length === 1,
  JSON.stringify({ score: row.score, clear_id: row.clear_id }));
check('450億がそのまま送られる(丸めない)', row.score === 45054226345);
check('WAVEとターン数も一緒に送る', row.reached_wave === 10 && row.turns === 12);
// 0やnullを入れて「0ターンでクリア」に見せないこと
const rowNoStats = rankingRowFromLocalEntry(
  { ...pending450, reachedWave: undefined, turns: undefined }, 'Legend');
check('値が無い列は付けない',
  !('reached_wave' in rowNoStats) && !('turns' in rowNoStats),
  Object.keys(rowNoStats).join(', '));
check('難易度が分からないときは送らない',
  rankingRowFromLocalEntry({ ...pending450, diff: undefined }, null) === null
    && rankingRowFromLocalEntry(null, 'Legend') === null);
// モンビーの記録も同じ仕組みに乗る(難易度キーが Rhythm-<曲>-<難易度>)
const rhythmRow = rankingRowFromLocalEntry(
  { ...pending450, diff:'Rhythm-crossing_field-master', clearId:'pending-rhythm', breederId:'MH-XXXX' },
  'Rhythm-crossing_field-master');
check('モンビーの記録も送り直せる(ブリーダーIDも一緒に)',
  rhythmRow.difficulty === 'Rhythm-crossing_field-master' && rhythmRow.breeder_id === 'MH-XXXX');

// --- ①-2 送り直しでも「遊んだ時刻」のまま残ること(2026-09-14) ---
// created_at を付けずに送ると DB が now() を入れるため、先週の記録が
// 「今週遊んだこと」になって週間ランキングの合計へ足されてしまう。
const playedMs = Date.UTC(2026, 8, 8, 12, 34, 0); // 2026-09-08 21:34 JST(先週)
const playedEntry = { ...pending450, at: playedMs };
const playedRow = rankingRowFromLocalEntry(playedEntry, 'Legend');
check('送り直す行に、遊んだ時刻(created_at)が入る',
  playedRow.created_at === new Date(playedMs).toISOString(), String(playedRow.created_at));
check('遊んだ時刻が分からない記録には created_at を付けない(従来どおり now() になる)',
  !('created_at' in rankingRowFromLocalEntry({ ...pending450, at: undefined }, 'Legend')));
check('ありえない昔の時刻は付けない', rankingCreatedAtFromLocal(1) === null);
check('端末の時計が進んでいる場合も付けない', rankingCreatedAtFromLocal(Date.now() + 86400000) === null);
check('数値でない時刻は付けない',
  rankingCreatedAtFromLocal('あ') === null && rankingCreatedAtFromLocal(null) === null
    && rankingCreatedAtFromLocal(undefined) === null);
check('いまの時刻は付けられる', typeof rankingCreatedAtFromLocal(Date.now()) === 'string');

// 送れたものに印を付ける。行は消さず、ほかの項目も触らない
const after = markLocalRankingEntriesSent(list, ['pending-450']);
const afterTarget = after.find(e => e && e.clearId === 'pending-450');
check('送れたら「送信済み」の印が付く', afterTarget.nationalSaved === true);
check('送れたらエラーの控えは消える', afterTarget.nationalError === undefined);
check('記録そのものは消さない(ブリーダーLv・絆Lvの集計に使うため)',
  after.length === list.length && afterTarget.score === 45054226345 && afterTarget.userName === 'あきら');
check('ほかの記録は1つも変わらない',
  after.find(e => e && e.clearId === 'sent-1') === sent
    && after.includes(oldEntry) && after.includes(pendingNoId));
check('送れなかったときは何も変えない',
  markLocalRankingEntriesSent(list, []) === list || markLocalRankingEntriesSent(list, []).every((e, i) => e === list[i]));

check('一度に送る数に上限がある', Number.isInteger(RANKING_RESEND_LIMIT) && RANKING_RESEND_LIMIT > 0 && RANKING_RESEND_LIMIT <= 50,
  String(RANKING_RESEND_LIMIT));
check('起動直後は少し待ってから始める', Number.isFinite(RANKING_RESEND_DELAY_MS) && RANKING_RESEND_DELAY_MS >= 1000,
  `${RANKING_RESEND_DELAY_MS}ms`);

// --- ② 画面とつなぐ側 ---
const hasApp = (needle) => appSrc.includes(needle);
check('送り直しの入口がある', hasApp('const resendPendingRankingScores = async ('));
check('端末に残した記録を難易度ごとに拾う', hasApp("storeList('mh_rank_', false)"));
check('モンビーの未送信キューも送り直す', hasApp('RHYTHM_RANKING_PENDING_KEY'));
check('モンビーの記録は専用の送信を通す', hasApp("String(diff).startsWith('Rhythm-') ? sbInsertRhythmScore : sbInsertScore"));
check('送れたぶんにだけ印を付けて書き戻す', hasApp('markLocalRankingEntriesSent(list, done)'));
check('送り直しは insertResentRankingRow を通す(DBに「いま」を刻ませない)',
  hasApp('insertResentRankingRow(insert, row)')
    && hasApp('insertResentRankingRow(sbInsertRhythmScore, payload)')
    && supabaseSrc.includes('const insertResentRankingRow = async (insert, row) =>'));
check('モンビーの未送信キューも、退避したときの時刻を付けて送る',
  hasApp('rankingCreatedAtFromLocal(at)'));
check('created_at が拒まれても、先週以前の記録は今週へ混ぜない',
  supabaseSrc.includes('keptPending: true') && supabaseSrc.includes('inThisWeek'));
check('同時に2回走らせない', hasApp('resendPendingRankingRef.current'));
check('HOMEへ落ち着いてから1回だけ走らせる',
  hasApp("if (bootPhase !== 'GAME' || gameState !== 'HOME' || !dataLoaded || !onboarded || resendCheckedRef.current) return;")
    && hasApp('RANKING_RESEND_DELAY_MS'));
// 失敗したら次の起動へ回すだけ。記録を消さない
check('送り直しに失敗しても記録を消さない',
  !/storeSet\([^)]*mh_rank_[^)]*\[\]\)/.test(appSrc) && !appSrc.includes('storeRemove(key'));

check('送信に失敗した周回に目印を立てる',
  (appSrc.match(/setRunHighlights\(prev => \(\{ \.\.\.prev, rankingFailed: true \}\)\);/g) || []).length >= 4,
  'チャレンジ・プロ・極限・種族チャレンジ');
check('新しい周回を始めるときに目印を戻す',
  (appSrc.match(/rankingFailed: ?false/g) || []).length >= 3);
check('リザルトで「送れませんでした」と知らせる',
  resultSrc.includes('function RankingFailedNote()')
    && resultSrc.includes('全国ランキングへ送れませんでした')
    && (resultSrc.match(/\{runHighlights\.rankingFailed&&<RankingFailedNote\/>\}/g) || []).length === 2,
  '勝ち・負けの両方のリザルト');
check('自動で送り直すことも伝える', resultSrc.includes('自動でもう一度送ります'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
