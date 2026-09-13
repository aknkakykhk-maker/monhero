// モンヒロビートの週間ランキング(2026-09-13にユーザーが決めた仕様)を見る。
//
//   ① スコアは**累計方式**(その週に出した記録をぜんぶ足す)。曲ごとのベスト合算ではない
//   ② 累計はサーバー側で数える(端末で足すと上位50件の切り出しで人が消える)
//   ③ 順位報酬は1〜10位。片=11−順位 / プシュケー=片×50 / ダイヤ=片×3,000
//   ④ 参加報酬は「その週に3回遊ぶ」。イベントの「何曲遊んだか」とは別の見かた
//   ⑤ 勇者の証片は mh_owned_items の中の新しいid。**新しい保存キーを作っていない**
//   ⑥ 始める前に終わった週へ遡って報酬を配らない(RHYTHM_WEEKLY_REWARD_FROM_MS)
//   ⑦ 週間に回数ボーナスは付けない(累計そのものが回数を反映するため)
//
//   node tools/mode/rhythm-weekly-reward-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const eventData=read('monster-hero/data/rhythm-event.js');
const rhythmData=read('monster-hero/data/rhythm-mode.js');
const supa=read('monster-hero/src/parts/26-supabase.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const screen=read('monster-hero/src/parts/58-screen-rhythm.jsx');
const market=read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const inventory=read('monster-hero/src/parts/54-screen-item-inventory.jsx');
const masu=read('monster-hero/src/parts/11-masu-progression.jsx');
const shared=read('monster-hero/src/parts/28-rhythm-shared.jsx');
const helpSrc=read('monster-hero/data/help.js');
const helpRows=read('monster-hero/src/parts/20-market-notices-help.jsx');
const changelog=read('monster-hero/data/changelog.js');
const spec=read('docs/spec/RHYTHM_RANKING.md');
const applySql=read('docs/sql/rankings/RHYTHM_WEEK_TOTAL_APPLY.sql');
const testSql=read('docs/sql/rankings/RHYTHM_WEEK_TOTAL_APPLY_TEST.sql');
const steps=read('docs/sql/rankings/RHYTHM_WEEK_TOTAL_IPHONE_STEPS.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層を実際に動かす ---
const demoIds=(rhythmData.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
const context={console};
vm.createContext(context);
vm.runInContext(`${demoIds}\n${eventData}\n`
  +'this.out={RHYTHM_WEEKLY_REWARD_RANKS,RHYTHM_WEEKLY_PARTICIPATION,RHYTHM_WEEKLY_REWARD_FROM_MS,'
  +'RHYTHM_WEEK_MS,rhythmWeeklyRewardForRank,rhythmWeeksAwaitingReward,rhythmWeekId,'
  +'rhythmEventRewardForRank,rhythmEventRewardRankCount,rhythmEventParticipationReward,'
  +'rhythmEventParticipationCleared,rhythmEventHasRewards,rhythmEventPlayBonusRates,rhythmWeeklyEvent};',context);
const O=context.out;
const weekly={kind:'weekly'};

// ③ 順位報酬
check('順位報酬は1〜10位',O.RHYTHM_WEEKLY_REWARD_RANKS===10
  &&!!O.rhythmWeeklyRewardForRank(10)&&O.rhythmWeeklyRewardForRank(11)===null);
check('片は 11−順位（1位10片・10位1片）',
  O.rhythmWeeklyRewardForRank(1).count===10&&O.rhythmWeeklyRewardForRank(10).count===1
  &&Array.from({length:10},(_,i)=>O.rhythmWeeklyRewardForRank(i+1).count).join(',')==='10,9,8,7,6,5,4,3,2,1');
check('プシュケーは片×50 / ダイヤは片×3,000',
  Array.from({length:10},(_,i)=>O.rhythmWeeklyRewardForRank(i+1))
    .every(r=>r.psyche===r.count*50&&r.gold===r.count*3000),
  JSON.stringify(O.rhythmWeeklyRewardForRank(1)));
check('配るのは勇者の証片',Array.from({length:10},(_,i)=>O.rhythmWeeklyRewardForRank(i+1))
  .every(r=>r.kind==='heroProofShard'));
check('壊れた順位では何も配らない',[0,-1,1.5,'あ',null,undefined,NaN]
  .every(rank=>O.rhythmWeeklyRewardForRank(rank)===null));
check('週間は週の体系へ回る（イベントの1〜5位ではない）',
  O.rhythmEventRewardForRank(weekly,'total',10)?.count===1
  &&O.rhythmEventRewardRankCount(weekly)===10
  &&O.rhythmEventRewardRankCount({kind:'limited'})===5);
check('週間は報酬を持つ扱いになる',O.rhythmEventHasRewards(weekly)===true);

// ④ 参加報酬
check('参加報酬は「その週に3回遊ぶ」',O.RHYTHM_WEEKLY_PARTICIPATION.plays===3);
check('参加報酬は10位より軽い',
  O.RHYTHM_WEEKLY_PARTICIPATION.count===1
  &&O.RHYTHM_WEEKLY_PARTICIPATION.psyche<O.rhythmWeeklyRewardForRank(10).psyche
  &&O.RHYTHM_WEEKLY_PARTICIPATION.gold<O.rhythmWeeklyRewardForRank(10).gold,
  JSON.stringify(O.RHYTHM_WEEKLY_PARTICIPATION));
check('成立の見かたが週間とイベントで違う（回数 / 曲数）',
  O.rhythmEventParticipationCleared(weekly,3)===true
  &&O.rhythmEventParticipationCleared(weekly,2)===false
  &&O.rhythmEventParticipationCleared({kind:'limited',songIds:['a','b','c'],participationReward:{songs:3,gold:1,psyche:1}},3)===true);

// ⑥ 始める前の週へ遡らない
{
  const from=O.RHYTHM_WEEKLY_REWARD_FROM_MS;
  const justAfterFirstWeek=from+O.RHYTHM_WEEK_MS+1000;
  check('始めた最初の週が終わると受け取れる',
    O.rhythmWeeksAwaitingReward(justAfterFirstWeek,[]).map(w=>w.id).join(',')===O.rhythmWeekId(from));
  check('始める前に終わった週へは遡らない',
    O.rhythmWeeksAwaitingReward(from+1000,[]).length===0
    &&O.rhythmWeeksAwaitingReward(from-O.RHYTHM_WEEK_MS+1000,[]).length===0);
  check('受け取り済みの週は出てこない',
    O.rhythmWeeksAwaitingReward(justAfterFirstWeek,[O.rhythmWeekId(from)]).length===0);
  // 期限切れの週が混ざらないこと。遡るのは直前の2週だけなので、
  // 最初の週は3週も経てば一覧から消えている(受け取り損ねたぶんが延々と残らない)
  check('受取期限を過ぎた週は出てこない',
    !O.rhythmWeeksAwaitingReward(from+3*O.RHYTHM_WEEK_MS+1000,[]).some(w=>w.id===O.rhythmWeekId(from))
    &&O.rhythmWeeksAwaitingReward(from+O.RHYTHM_WEEK_MS+15*24*3600*1000,[])
        .every(w=>(from+O.RHYTHM_WEEK_MS+15*24*3600*1000)<w.endMs+14*24*3600*1000),
    JSON.stringify(O.rhythmWeeksAwaitingReward(from+3*O.RHYTHM_WEEK_MS+1000,[]).map(w=>w.id)));
  check('保存値が壊れていたら何も配らない',
    O.rhythmWeeksAwaitingReward(justAfterFirstWeek,null).length===0
    &&O.rhythmWeeksAwaitingReward(justAfterFirstWeek,'あ').length===0);
  check('まだ終わっていない今週は対象にしない',
    O.rhythmWeeksAwaitingReward(from+O.RHYTHM_WEEK_MS/2,[]).length===0);
}

// ⑦ 週間に回数ボーナスは付けない
check('週間に回数ボーナスは付かない',O.rhythmEventPlayBonusRates(weekly)===null);
check('週間の行は加点の内訳を持たない',
  /baseScore: null, bonusScore: 0, playCounts: \{\}/.test(supa));

// ① ② 累計方式はサーバー側
check('累計を数える関数を作るSQLがある',
  /create function public\.rhythm_week_score_totals/.test(applySql)
  &&/sum\(s\.score\)::bigint/.test(applySql));
check('対象曲の引数を持たない（週間は公開曲すべて）',
  /rhythm_week_score_totals\(from_at timestamptz, to_at timestamptz\)/.test(applySql));
check('除外曲はこれまでどおり外す',
  /rhythm_ranking_song_exclusions/.test(applySql));
check('既存の関数を消していない',
  !/drop function[^\n]*rhythm_event_totals\(/.test(applySql)
  &&!/drop function[^\n]*rhythm_total/.test(applySql));
check('rankings を書き換えていない',
  !/\b(delete from|update|alter table|drop table)\b[^\n]*rankings/i.test(applySql));
check('何度流しても同じ結果になる（作り直す形）',
  /drop function if exists public\.rhythm_week_score_totals/.test(applySql));
check('予行演習(rollback)と手順書がそろっている',
  /^rollback;$/m.test(testSql)&&!/^commit;$/m.test(testSql)
  &&steps.includes('RHYTHM_WEEK_TOTAL_APPLY_TEST.sql'));
check('アプリは累計の関数を呼ぶ',
  supa.includes('rpc/rhythm_week_score_totals')
  &&/const weeklyTotals = kind === 'weekly' && !targetSongId;/.test(app));
check('関数が無い環境を「準備中」として扱う',
  /rhythm_week_score_totals\|rhythm_event_song_bests/.test(supa));
check('端末側で累計を足していない',
  !/entries\.reduce\([^)]*totalScore/.test(app));

// ⑤ 勇者の証片
check('勇者の証片のidと交換レートがある',
  /const HERO_PROOF_SHARD_ITEM_ID = 'hero_proof_shard';/.test(masu)
  &&/const HERO_PROOF_SHARD_PER_PROOF = 20;/.test(masu));
check('所持数は mh_owned_items の中（新しい保存キーを作っていない）',
  /\[HERO_PROOF_SHARD_ITEM_ID\]:shardHave - shardCost/.test(masu)
  &&!/mh_hero_proof|mh_shard/.test(masu+app+market+inventory));
check('足りないときは所持品に触らない',
  /if \(shardHave < shardCost\) return \{ ok:false/.test(masu));
check('アイテム欄に並ぶ',
  inventory.includes('HERO_PROOF_SHARD_ITEM_ID')&&inventory.includes('HERO_PROOF_SHARD_ITEM')
  &&/usage==='heroProofShard'/.test(inventory));
check('マーケットに交換カードがある',
  /currency:'heroProofShard', cost:HERO_PROOF_SHARD_PER_PROOF/.test(market)
  &&/const exchangeHeroProofByShard = async/.test(app)
  &&/onExchangeHeroProof=\{exchangeHeroProofByShard\}/.test(app));
check('交換は保存に失敗したら元へ戻す',
  /hero proof shard exchange save failed/.test(app)
  &&/勇者の証片は消費していません/.test(app));
check('マーケットの上に持ち高を出す（プシュケー・証片・証）',
  market.includes('data-market-balances')
  &&market.includes("data-market-balance")
  &&/psycheHave|shardHave|proofHave/.test(market));
check('報酬から証片が配られる',
  /reward\.kind==='heroProofShard'/.test(shared)
  &&/next\[HERO_PROOF_SHARD_ITEM_ID\] = ownedItemCount\(next, HERO_PROOF_SHARD_ITEM_ID\)/.test(app));
check('順位報酬のダイヤも配られる',
  /if \(entry\.reward\.gold > 0\) goldGain \+= entry\.reward\.gold;/.test(app));
check('受け取り済みは先に保存してからアイテムを足す',
  app.indexOf('await markRhythmEventRewardClaimed(prize.event.id);')
    < app.indexOf('const next = { ...ownedItemsRef.current };\n      // ダイヤは mh_gold'));

// --- 案内(画面・ヘルプ・更新履歴・仕様書) ---
check('週間の行に遊んだ回数を出す',/eventWeekly\?`\$\{entry\.playCount\}回/.test(screen));
check('週間の詳細で数え方を伝えている',screen.includes('data-rhythm-week-score-rule'));
check('∞周回の倍率は週間に出さない（対象曲が無いため）',
  /\{!eventWeekly&&<p data-rhythm-event-loop-bonus/.test(screen));
check('ヘルプに順位報酬の表がある（手で書き写していない）',
  helpSrc.includes("{t:'data', id:'rhythmWeeklyRewards'}")
  &&helpRows.includes("case 'rhythmWeeklyRewards':")
  &&helpRows.includes("rhythmWeeklyRewards: '週間ランキングの順位報酬'"));
check('ヘルプに累計方式と証片の説明がある',
  /title:'勇者の証片'/.test(helpSrc)&&/title:'週間ランキングの参加報酬'/.test(helpSrc)
  &&helpSrc.includes('「すべて足し合わせた合計」で競うランキング'));
check('更新履歴に書いてある',/週間ランキング/.test(changelog.slice(0,4000)));
check('仕様書に決めごとが残っている',
  spec.includes('### 6.2 何を競うか — **累計スコア方式**')
  &&spec.includes('### 6.2.1 報酬'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
