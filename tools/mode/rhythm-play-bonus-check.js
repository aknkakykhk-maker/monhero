// モンヒロビートのイベント「回数ボーナス」(2026-09-11・ユーザー指示)を見る。
//
// 「ただスコアを競うだけだと、うまい人が毎回上位に行く。それはそれでいいけど、
//   頑張った人が報われるシステムにもしたい。例えばやった回数×1%の加点がかかるみたいな」
//
// ここで見るのは次の6つ。どれも**公開してからでないと気づけない**類なので機械で見張る。
//
//   ① 難易度ごとの割合が実データにあり、EASY→MASTERで増えていくこと
//   ② 加点の足し算が**サーバー側**にあること(端末で足すと上位50件の切り出しで人が消える)
//   ③ 関数がまだ無い環境では、加点なしのこれまでの関数へ戻ること(画面が壊れない)
//   ④ 一覧に出る点が加点込みで、内訳(素点・回数・加点・合計)を開けること
//   ⑤ ランク(S/SS/…)は**素点**で決めること(加点込みだと満点を超えて評価が化ける)
//   ⑥ 報酬の受け取りも、画面と**同じ計算**で順位を見ること
//      (渡し忘れると「1位だったのに報酬が来ない」)
//
//   node tools/mode/rhythm-play-bonus-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const eventData=read('monster-hero/data/rhythm-event.js');
const rhythmData=read('monster-hero/data/rhythm-mode.js');
const supa=read('monster-hero/src/parts/26-supabase.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const screen=read('monster-hero/src/parts/58-screen-rhythm.jsx');
const helpSrc=read('monster-hero/data/help.js');
const helpRows=read('monster-hero/src/parts/20-market-notices-help.jsx');
const changelog=read('monster-hero/data/changelog.js');
const spec=read('docs/spec/RHYTHM_RANKING.md');
const applySql=read('docs/sql/rankings/RHYTHM_EVENT_BONUS_APPLY.sql');
const testSql=read('docs/sql/rankings/RHYTHM_EVENT_BONUS_APPLY_TEST.sql');
const verifySql=read('docs/sql/rankings/RHYTHM_EVENT_BONUS_VERIFY.sql');
const steps=read('docs/sql/rankings/RHYTHM_EVENT_BONUS_IPHONE_STEPS.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層を実際に動かす ---
const demoIds=(rhythmData.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
const difficultyIds=(rhythmData.match(/^const RHYTHM_DEMO_DIFFICULTY_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
const context={console};
vm.createContext(context);
vm.runInContext(`${demoIds}\n${difficultyIds}\n${eventData}\n`
  +'this.out={RHYTHM_EVENTS,RHYTHM_DEMO_DIFFICULTY_IDS,RHYTHM_EVENT_PLAY_BONUS_RATES,'
  +'rhythmEventPlayBonusRates,rhythmEventPlayBonusPercentText,rhythmEventPlayBonusRateText,'
  +'rhythmEventPlayCountRows,rhythmLimitedEventAt};',context);
const O=context.out;

// ① 割合の表
const rates=O.RHYTHM_EVENT_PLAY_BONUS_RATES;
check('難易度ごとの割合が実データにある',!!rates&&typeof rates==='object');
const ids=O.RHYTHM_DEMO_DIFFICULTY_IDS;
check('公開している難易度がすべて書いてある',ids.every(id=>Number.isFinite(Number(rates[id]))),
  ids.filter(id=>!Number.isFinite(Number(rates[id]))).join(', '));
check('難しい難易度ほど割合が大きい',
  ids.every((id,i)=>i===0||Number(rates[id])>Number(rates[ids[i-1]])),
  ids.map(id=>`${id}=${rates[id]}`).join(' / '));
check('割合は0より大きく1回10%以下(書き間違いよけの範囲に収まっている)',
  ids.every(id=>Number(rates[id])>0&&Number(rates[id])<=0.1));
check('使わないイベントでは null を返す',O.rhythmEventPlayBonusRates({kind:'weekly'})===null
  &&O.rhythmEventPlayBonusRates(null)===null);
check('playBonus を書いたイベントでは割合を返す',O.rhythmEventPlayBonusRates({playBonus:true})===rates);
check('画面へ出す文字列が作れる',ids.every(id=>/^1回ごとに \+\d/.test(O.rhythmEventPlayBonusPercentText(id))),
  O.rhythmEventPlayBonusPercentText(ids[ids.length-1]));

// ② 加点の足し算はサーバー側
check('加点込みの関数を作るSQLがある',
  /create function public\.rhythm_event_song_bests_bonus/.test(applySql)
  &&/create function public\.rhythm_event_totals_bonus/.test(applySql));
check('加点なしの関数を消していない',
  !/drop function[^\n]*rhythm_event_song_bests\(/.test(applySql)
  &&!/drop function[^\n]*rhythm_event_totals\(/.test(applySql));
check('rankings を書き換えていない',
  !/\b(delete from|update|alter table|drop table)\b[^\n]*rankings/i.test(applySql));
check('割合は引数で受ける(数字をSQLへ埋め込んでいない)',
  /bonus_rates jsonb/.test(applySql)&&/bonus_rates ->> d\.difficulty_id/.test(applySql));
check('壊れた割合でも落ちない(数として読める値だけ使う)',
  /~ '\^\[0-9\]\+\(\\\.\[0-9\]\+\)\?\$'/.test(applySql));
check('1回あたりを 0〜0.1 へ丸めている(書き間違いよけ)',
  /least\(greatest\(/.test(applySql)&&/, 0\), 0\.1\)/.test(applySql));
check('素点・加点・回数も返す(内訳に使う)',
  /base_score integer, bonus_score integer, play_count integer, play_counts jsonb/.test(applySql)
  &&/base_total bigint, bonus_total bigint, play_count integer, play_counts jsonb/.test(applySql));
check('難易度ごとの回数も返す(内訳の難易度の行に使う)',
  /jsonb_object_agg\(d\.difficulty_id, d\.n\)/.test(applySql)
  &&/jsonb_object_agg\(d\.difficulty_id, d\.n\) as play_counts/.test(applySql));
check('何度流しても同じ結果になる(作り直す形)',
  /drop function if exists public\.rhythm_event_song_bests_bonus/.test(applySql)
  &&/drop function if exists public\.rhythm_event_totals_bonus/.test(applySql));
check('予行演習(rollback)と確認(読み取りだけ)と手順書がそろっている',
  /^rollback;$/m.test(testSql)&&!/^commit;$/m.test(testSql)
  &&!/^\s*(create|drop|alter|insert|update|delete)\b/im.test(verifySql)
  &&steps.includes('RHYTHM_EVENT_BONUS_APPLY_TEST.sql'));
check('端末側では加点を計算していない',
  !/bonusScore\s*=\s*[^;]*\*\s*(playCount|rate)/.test(app)
  &&!/baseScore\s*\*\s*/.test(screen));

// ③ 関数が無い環境では加点なしへ戻る
check('加点込みの関数を先に試す',
  supa.includes('rpc/rhythm_event_song_bests_bonus')&&supa.includes('rpc/rhythm_event_totals_bonus'));
check('関数が無ければ加点なしへ戻す',
  /rhythm-event-song-bonus-fallback/.test(supa)&&/rhythm-event-total-bonus-fallback/.test(supa));
check('加点なしで取ったときは内訳を出さない(素点が null)',
  /if \(!Number\.isFinite\(base\)\) return \{ baseScore: null/.test(supa));
check('難易度ごとの回数が無い環境では1段落として取り直す',
  supa.includes('RHYTHM_EVENT_SONG_BONUS_SELECT_BASE')&&supa.includes('RHYTHM_EVENT_TOTAL_BONUS_SELECT_BASE')
  &&/play_counts/.test(supa)&&/\/party\|play_counts\/i/.test(supa));
check('壊れた難易度ごとの回数でも落ちない',
  /const rhythmEventPlayCountsFromRow = \(value\) =>/.test(supa));

// ④ 一覧は加点込み・内訳を開ける
check('並べ替えは加点込みの点でサーバーがする',
  /rhythm_event_song_bests_bonus\?select=[\s\S]{0,160}&order=score\.desc/.test(supa)
  &&/rhythm_event_totals_bonus\?select=[\s\S]{0,160}&order=total_score\.desc/.test(supa));
check('曲の部門に内訳ボタンがある',/entry\.detail\|\|entry\.baseScore!==null\)&&<button data-rhythm-event-detail-row/.test(screen));
check('総合の部門に内訳ボタンがある',/entry\.baseScore!==null&&<button data-rhythm-event-bonus-row/.test(screen));
check('内訳に素点・回数・加点・合計の4つを出す',
  screen.includes('data-rhythm-bonus-breakdown')
  &&screen.includes('素点（ベスト）')&&screen.includes('遊んだ回数')
  &&screen.includes('回数ボーナス')&&screen.includes('合計（順位に使う点）'));
check('内訳に難易度ごとの回数を並べる',
  screen.includes('data-rhythm-bonus-difficulties')
  &&/rhythmEventPlayCountRows\(rhythmRankingDetail\.playCounts,RHYTHM_DEMO_DIFFICULTY_IDS\)/.test(screen));
check('0回の難易度は内訳に出さない',
  O.rhythmEventPlayCountRows({MASTER:2,HARD:0},ids).map(r=>r.id).join(',')==='HARD,MASTER'.split(',').filter(x=>x==='MASTER').join(','),
  JSON.stringify(O.rhythmEventPlayCountRows({MASTER:2,HARD:0},ids)));
check('難易度ごとの回数はEASY→MASTERの並びになる',
  O.rhythmEventPlayCountRows({MASTER:1,EASY:3,HARD:2},ids).map(r=>r.id).join(',')==='EASY,HARD,MASTER');
check('知らない難易度が混ざっても落ちない',
  O.rhythmEventPlayCountRows({NAZO:2,EASY:1},ids).map(r=>r.id).join(',')==='EASY,NAZO'
  &&O.rhythmEventPlayCountRows(null,ids).length===0);
check('加点があった行は一覧にも加点と回数を添える',
  /entry\.bonusScore>0&&<p[^>]*>\+\{entry\.bonusScore\.toLocaleString\(\)\}（\{entry\.playCount\}回）/.test(screen));

// ⑤ ランクは素点で決める
check('ランクは素点で決める',
  /const eventRankScore=\(entry\)=>entry&&entry\.baseScore!==null/.test(screen)
  &&/RHYTHM_RANK_COLORS\[rhythmRankForScore\(eventRankScore\(entry\)\)\]/.test(screen));

// ⑥ 順位の出し方は画面と報酬で同じ
const bonusPassed=(app.match(/bonusRates/g)||[]).length;
check('ランキングの取得へ割合を渡している',/const bonusRates = rhythmEventPlayBonusRates\(event\);/.test(app));
check('報酬の受け取りにも同じ割合を渡している',bonusPassed>=6,`bonusRates の出現 ${bonusPassed}か所`);

// --- 案内(ヘルプ・更新履歴・仕様書) ---
check('ヘルプに割合の表がある(手で書き写していない)',
  helpSrc.includes("{t:'data', id:'rhythmEventPlayBonus'}")
  &&helpRows.includes("case 'rhythmEventPlayBonus':")
  &&helpRows.includes("rhythmEventPlayBonus: 'イベントの回数ボーナス（1回あたり）'"));
check('ヘルプの本文に回数ボーナスの説明がある',/title:'回数ボーナス（遊んだぶんだけ加点）'/.test(helpSrc));
check('イベント詳細の画面にも割合を出している',screen.includes('data-rhythm-event-play-bonus'));
check('更新履歴に書いてある',/回数ボーナス/.test(changelog.slice(0,6000)));
check('仕様書に決めごとが残っている',spec.includes('### 7.2 回数ボーナス'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
