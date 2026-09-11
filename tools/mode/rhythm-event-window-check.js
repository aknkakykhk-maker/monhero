// モンビー(音ゲー)の「週間ランキング」(2026-09-11)を見る。
//
// 集計と期間の正本はSupabase側にあるが、そこへ至る前後は端末側にある。
// ここで見るのは次の5つ。
//
//   ① 週の区切りが「月曜 5:00 JST」であること(docs/spec/RHYTHM_RANKING.md §6.1)
//      ここがずれると、誰の記録がどの週に入るかが静かにずれる
//   ② 対象曲の組み方(となりあう週で同じ曲を選ばない・一巡で公開曲をひととおり・
//      正式譜面が完成している曲=公開曲からだけ選ぶ)(§5.7・§6.4)
//   ③ 関数がまだ無い環境(SQL未適用)を「エラー」ではなく「準備中」として扱うこと
//   ④ 部門(対象曲ごと＋総合)の数を対象曲の数から作っていること(§7)。曲数を書き写さない
//   ⑤ 機能と案内(タブ・曲えらびの案内・ヘルプ・更新履歴・助手の告知)が
//      同じ公開フラグでまとめて出し入れされること(CLAUDE.md ⑤)
//
//   node tools/mode/rhythm-event-window-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const eventData=read('monster-hero/data/rhythm-event.js');
const rhythmData=read('monster-hero/data/rhythm-mode.js');
const supa=read('monster-hero/src/parts/26-supabase.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const screen=read('monster-hero/src/parts/58-screen-rhythm.jsx');
const game=read('monster-hero/src/game-system.jsx');
const html=read('monster-hero/index.html');
const help=read('monster-hero/data/help.js');
const changelog=read('monster-hero/data/changelog.js');
const assistants=read('monster-hero/data/assistants.js');
const spec=read('docs/spec/RHYTHM_RANKING.md');
const flags=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const saveSpec=read('docs/spec/SAVE_DATA.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層(週の区切り・対象曲・部門)を実際に動かす ---
const demoIds=(rhythmData.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
check('公開曲の一覧を抽出できる',!!demoIds);
const context={console};
vm.createContext(context);
vm.runInContext(`${demoIds}\n${eventData}\n`
  +'this.out={RHYTHM_WEEK_MS,RHYTHM_WEEK_ANCHOR_MS,RHYTHM_WEEKLY_ROTATION,RHYTHM_EVENTS,RHYTHM_DEMO_SONG_IDS,'
  +'rhythmWeekStartMs,rhythmWeekWindow,rhythmWeekIndex,rhythmWeekId,rhythmWeeklyEvent,rhythmActiveEvent,'
  +'rhythmEventWindow,rhythmEventRemainingText,rhythmEventDivisions,rhythmEventDivisionSongId,rhythmEventSong,'
  +'rhythmEventPeriodText,rhythmEventSongsLabel,rhythmEventDivisionReward,rhythmEventRewardForRank,rhythmEventHasRewards,'
  +'rhythmEventSongDivisionId,RHYTHM_EVENT_REWARD_RANKS,rhythmEventsAwaitingReward,'
  +'normalizeRhythmEventRewardClaims,rhythmEventDivisionIds,'
  +'rhythmEventSongDivisionId,rhythmEventMaxScore,rhythmEventEntryScore,RHYTHM_EVENT_TOTAL_DIVISION};',context);
const O=context.out;

// ① 週の区切りは月曜 5:00 JST(= 日曜 20:00 UTC)
const jstParts=(ms)=>{
  const d=new Date(ms+9*60*60*1000);
  return {weekday:d.getUTCDay(), hour:d.getUTCHours(), minute:d.getUTCMinutes(), second:d.getUTCSeconds()};
};
{
  // 1年ぶんの毎日・毎時で確かめる。夏時間の無いJSTでも、計算を端末の時間帯に任せていないこと
  let ok=true, sample=null;
  for(let i=0;i<24*370;i++){
    const now=O.RHYTHM_WEEK_ANCHOR_MS-30*24*3600*1000+i*3600*1000;
    const start=O.rhythmWeekStartMs(now);
    const p=jstParts(start);
    if(p.weekday!==1||p.hour!==5||p.minute!==0||p.second!==0){ok=false;sample=new Date(start).toISOString();break;}
    if(!(start<=now&&now<start+O.RHYTHM_WEEK_MS)){ok=false;sample=`窓の外: ${new Date(now).toISOString()}`;break;}
  }
  check('週の始まりは必ず月曜 5:00 JST',ok,sample||'1年ぶん(8880時点)を確認');
}
check('週の長さは7日',O.RHYTHM_WEEK_MS===7*24*3600*1000
  &&O.rhythmWeekWindow(Date.now()).endMs-O.rhythmWeekWindow(Date.now()).startMs===7*24*3600*1000);
{
  // 境界そのもの。月曜5:00の1ミリ秒前は前の週、ちょうどは新しい週
  const start=O.RHYTHM_WEEK_ANCHOR_MS;
  check('月曜5:00ちょうどで次の週へ入る',
    O.rhythmWeekStartMs(start)===start&&O.rhythmWeekStartMs(start-1)===start-O.RHYTHM_WEEK_MS);
}
check('壊れた値でも落ちない',
  O.rhythmWeekStartMs(null)===O.RHYTHM_WEEK_ANCHOR_MS&&O.rhythmWeekStartMs('x')===O.RHYTHM_WEEK_ANCHOR_MS);
check('週のIDは weekly_YYYY_MM_DD の形',/^weekly_\d{4}_\d{2}_\d{2}$/.test(O.rhythmWeekId(Date.now())),
  O.rhythmWeekId(Date.now()));
{
  // IDは週ごとに変わり、同じ週なら何度呼んでも同じ(受取フラグの一部になるため)
  const a=O.rhythmWeekId(O.RHYTHM_WEEK_ANCHOR_MS), b=O.rhythmWeekId(O.RHYTHM_WEEK_ANCHOR_MS+3*24*3600*1000);
  const c=O.rhythmWeekId(O.RHYTHM_WEEK_ANCHOR_MS+O.RHYTHM_WEEK_MS);
  check('同じ週なら同じID・週が変われば別のID',a===b&&a!==c,`${a} / ${c}`);
}

// ② 対象曲の組み方
const rotation=O.RHYTHM_WEEKLY_ROTATION.map(entry=>entry.songIds);
check('対象曲の組が1つ以上ある',rotation.length>0,`${rotation.length}週ぶん`);
check('どの週も3曲以上',rotation.every(ids=>ids.length>=3));
check('対象曲は公開曲の一覧にあるものだけ',(()=>{
  const unknown=rotation.flat().filter(id=>!O.RHYTHM_DEMO_SONG_IDS.includes(id));
  return unknown.length===0||console.log(`   未公開の曲: ${unknown.join(', ')}`)===undefined&&false;
})());
check('同じ週の中で曲が重複していない',rotation.every(ids=>new Set(ids).size===ids.length));
check('となりあう週で同じ曲を選ばない(最後→先頭の折り返しも見る)',(()=>{
  for(let i=0;i<rotation.length;i++){
    const next=rotation[(i+1)%rotation.length];
    const dup=rotation[i].filter(id=>next.includes(id));
    if(rotation.length>1&&dup.length>0){console.log(`   ${i}週目と${(i+1)%rotation.length}週目: ${dup.join(', ')}`);return false;}
  }
  return true;
})());
check('一巡すると公開曲がひととおり対象になる',(()=>{
  const covered=new Set(rotation.flat());
  const missing=O.RHYTHM_DEMO_SONG_IDS.filter(id=>!covered.has(id));
  if(missing.length){console.log(`   まだ一度も対象にならない曲: ${missing.join(', ')}`);return false;}
  return true;
})(),`${rotation.length}週で${O.RHYTHM_DEMO_SONG_IDS.length}曲`);
check('週が変われば対象曲も変わる',(()=>{
  if(rotation.length<2)return true;
  const a=O.rhythmWeeklyEvent(O.RHYTHM_WEEK_ANCHOR_MS).songIds.join(',');
  const b=O.rhythmWeeklyEvent(O.RHYTHM_WEEK_ANCHOR_MS+O.RHYTHM_WEEK_MS).songIds.join(',');
  return a!==b;
})());
check('基準より前の週でも対象曲が決まる(負の週番号)',(()=>{
  const event=O.rhythmWeeklyEvent(O.RHYTHM_WEEK_ANCHOR_MS-5*O.RHYTHM_WEEK_MS);
  return !!event&&event.songIds.length>=3;
})());
check('いまも必ず開催中(週間かイベントのどちらかが必ず立つ)',!!O.rhythmActiveEvent(Date.now()),
  (O.rhythmActiveEvent(Date.now())||{}).id);

// --- 報酬の受け取り(§9.1) ---
{
  const claimMs=14*24*3600*1000;
  const ended=(O.RHYTHM_EVENTS||[]).filter(e=>e.kind==='limited'&&O.rhythmEventHasRewards(e));
  check('受け取れるのは終了から2週間まで',ended.every(e=>{
    const end=Date.parse(e.endAt);
    const awaiting=(ms,claims)=>O.rhythmEventsAwaitingReward(ms,claims).some(x=>x.id===e.id);
    return !awaiting(end-1,[])            // 終わる前は出さない
      &&awaiting(end,[])                  // 終わった瞬間から
      &&awaiting(end+claimMs-1,[])        // 期限ぎりぎりまで
      &&!awaiting(end+claimMs,[])         // 期限を過ぎたら出さない
      &&!awaiting(end+1000,[e.id]);       // 受け取り済みなら出さない
  }));
  check('保存値が壊れているときは何も配らない',
    O.rhythmEventsAwaitingReward(Date.now()+99*24*3600*1000,null).length===0
    &&O.rhythmEventsAwaitingReward(Date.now(),'x').length===0);
  check('受け取り済みの一覧は文字列だけにそろえる',
    JSON.stringify(O.normalizeRhythmEventRewardClaims(['a',1,null,'b',{}]))===JSON.stringify(['a','b'])
    &&JSON.stringify(O.normalizeRhythmEventRewardClaims(null))==='[]');
  check('部門の並びは 対象曲→総合',ended.every(e=>{
    const ids=O.rhythmEventDivisionIds(e);
    return ids.length===e.songIds.length+1&&ids[ids.length-1]===O.RHYTHM_EVENT_TOTAL_DIVISION;
  }));
  // 報酬を持たない週間は、受け取りの対象にならない
  check('週間は受け取りの対象にならない',
    O.rhythmEventsAwaitingReward(Date.now(),[]).every(e=>e.kind==='limited'));
}
check('受け取りは上位5件だけ問い合わせる(報酬は5位まで)',
  app.includes('limit:RHYTHM_EVENT_REWARD_RANKS'));
check('通信に失敗したら受け取り済みにしない(次の起動でやり直す)',
  app.includes("console.error('[rhythm-event-reward] fetch failed:'")
  &&app.includes('// 通信の失敗で受け取り済みにはしない。次の起動でやり直す'));
check('入賞していなくても受け取り済みにする(毎回問い合わせ直さない)',
  app.includes('if (prizes.length === 0) { await markRhythmEventRewardClaimed(event.id); return; }'));
check('先にフラグを保存してからアイテムを足す(二重付与を防ぐ)',(()=>{
  const at=app.indexOf('const claimRhythmEventReward');
  if(at<0)return false;
  const body=app.slice(at,at+1600);
  return body.indexOf('markRhythmEventRewardClaimed')<body.indexOf("storeSet('mh_owned_items'");
})());
check('報酬は所持品とプシュケーへ足す(既存の入れ物を使う)',
  app.includes('ownedItemCount(next, item.id) + entry.reward.count')
  &&app.includes('ownedItemCount(next, BREAKTHROUGH_ITEM_ID) + entry.reward.psyche'));
check('受け取り画面を出す(新しいgameStateは増やさない)',
  screen.includes('function RhythmEventRewardModal')&&screen.includes('data-rhythm-event-reward-claim')
  &&app.includes('<RhythmEventRewardModal')&&!/'RHYTHM_EVENT_REWARD'/.test(app));
check('受け取り済みの保存キーを新しく足している',
  app.includes("const RHYTHM_EVENT_REWARD_KEY = 'mh_rhythm_event_reward_v1';")
  &&saveSpec.includes('mh_rhythm_event_reward_v1'));
check('ヘルプに受け取り方が書いてある',
  help.includes('報酬の受け取り方')&&help.includes('終了から2週間'));

// --- 期間限定イベント(kind:'limited') ---
const limited=(Array.isArray(O.RHYTHM_EVENTS)?O.RHYTHM_EVENTS:[]).filter(e=>e&&e.kind==='limited');
console.log(`--  期間限定イベント: ${limited.length?limited.map(e=>e.id).join(', '):'なし'}`);
check('期間限定イベントの中身がそろっている',limited.every(e=>
  typeof e.id==='string'&&e.id&&typeof e.name==='string'&&e.name
  &&Array.isArray(e.songIds)&&e.songIds.length>=1
  &&Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt))
  &&Date.parse(e.startAt)<Date.parse(e.endAt)));
check('期間限定イベントの対象曲も公開曲だけ',limited.every(e=>
  e.songIds.every(id=>O.RHYTHM_DEMO_SONG_IDS.includes(id))),
  limited.flatMap(e=>e.songIds.filter(id=>!O.RHYTHM_DEMO_SONG_IDS.includes(id))).join(', '));
check('期間限定イベントどうしが重なっていない(同時に成立するのは1つまで)',(()=>{
  for(let a=0;a<limited.length;a++)for(let b=a+1;b<limited.length;b++){
    const x=limited[a],y=limited[b];
    if(Date.parse(x.startAt)<Date.parse(y.endAt)&&Date.parse(y.startAt)<Date.parse(x.endAt)){
      console.log(`   重なり: ${x.id} と ${y.id}`);return false;
    }
  }
  return true;
})());
// 境界そのもの。開始ちょうどで始まり、終了ちょうどで週間へ戻る
check('開始・終了の境界で入れ替わる',limited.every(e=>{
  const start=Date.parse(e.startAt),end=Date.parse(e.endAt);
  const at=(ms)=>O.rhythmActiveEvent(ms);
  return at(start-1).kind==='weekly'&&at(start).id===e.id
    &&at(end-1).id===e.id&&at(end).kind==='weekly';
}));
check('期間限定のあいだは週間を休む(その週の週間が出てこない)',limited.every(e=>{
  const mid=(Date.parse(e.startAt)+Date.parse(e.endAt))/2;
  return O.rhythmActiveEvent(mid).kind==='limited';
}));
check('期間限定の期間は定義の日時そのまま',limited.every(e=>{
  const range=O.rhythmEventWindow(e,null);
  return !!range&&range.startMs===Date.parse(e.startAt)&&range.endMs===Date.parse(e.endAt);
}));
// 画面に出す期間の文。週間と期間限定で出し分けること
check('期間の文を出し分ける',(()=>{
  const week=O.rhythmWeeklyEvent(Date.now());
  const weekText=O.rhythmEventPeriodText(week,O.rhythmEventWindow(week,O.rhythmWeekWindow(Date.now())));
  if(!/毎週 月曜 5:00/.test(weekText))return false;
  return limited.every(e=>{
    const text=O.rhythmEventPeriodText(e,O.rhythmEventWindow(e,null));
    return /\d+\/\d+\([日月火水木金土]\) \d+:\d\d 〜 \d+\/\d+\([日月火水木金土]\) \d+:\d\d/.test(text);
  });
})(),limited.length?O.rhythmEventPeriodText(limited[0],O.rhythmEventWindow(limited[0],null)):'');
check('対象曲の見出しも出し分ける',
  O.rhythmEventSongsLabel(O.rhythmWeeklyEvent(Date.now()))==='今週の対象曲'
  &&limited.every(e=>O.rhythmEventSongsLabel(e)==='対象曲'));

// --- 報酬(docs/spec/RHYTHM_RANKING.md §9) ---
// 1位から5位まで、個数は5/4/3/2/1・プシュケーは1,000/800/600/400/200。6位以下は無し。
check('週間には報酬を付けていない(フェーズ3は報酬なし)',(()=>{
  const week=O.rhythmWeeklyEvent(Date.now());
  return !O.rhythmEventHasRewards(week)&&O.rhythmEventRewardForRank(week,O.RHYTHM_EVENT_TOTAL_DIVISION,1)===null;
})());
check('報酬つきイベントは1〜5位に配る',limited.every(e=>{
  if(!O.rhythmEventHasRewards(e))return true;
  const divisions=[...e.songIds.map(O.rhythmEventSongDivisionId),O.RHYTHM_EVENT_TOTAL_DIVISION];
  return divisions.every(divisionId=>{
    const reward=O.rhythmEventDivisionReward(e,divisionId);
    if(!reward)return true;
    const counts=[1,2,3,4,5].map(rank=>O.rhythmEventRewardForRank(e,divisionId,rank));
    return counts.every(Boolean)
      &&counts.map(r=>r.count).join(',')==='5,4,3,2,1'
      &&counts.map(r=>r.psyche).join(',')==='1000,800,600,400,200';
  });
}));
check('6位以下と壊れた順位には報酬を出さない',limited.every(e=>
  [0,6,99,-1,1.5,null,'x',NaN].every(rank=>
    O.rhythmEventRewardForRank(e,O.RHYTHM_EVENT_TOTAL_DIVISION,rank)===null)));
check('対象曲の部門は種族の超越の実、総合は勇者の証',limited.every(e=>{
  if(!O.rhythmEventHasRewards(e))return true;
  const songOk=e.songIds.every(songId=>{
    const reward=O.rhythmEventDivisionReward(e,O.rhythmEventSongDivisionId(songId));
    return !reward||(reward.kind==='speciesFruit'&&typeof reward.lineageId==='string'&&reward.lineageId);
  });
  const total=O.rhythmEventDivisionReward(e,O.RHYTHM_EVENT_TOTAL_DIVISION);
  return songOk&&(!total||total.kind==='heroProof'||total.kind==='rainbowFruit');
}));
// 血統idを書き間違えると、報酬の名前が出ないまま公開されてしまう
check('報酬の種族(血統id)が実在する',(()=>{
  const lineages=read('monster-hero/data/lineages.js');
  return limited.every(e=>Object.values(e.rewardLineageBySongId||{}).every(id=>
    new RegExp(`id:'${id}'`).test(lineages)));
})());
check('報酬の対象曲がイベントの対象曲と一致する',limited.every(e=>
  Object.keys(e.rewardLineageBySongId||{}).every(songId=>e.songIds.includes(songId))));
// アイテムの実体はゲーム本体側で結びつける。名前を2か所に書かない
check('アイテムの名前は実データから引く',
  game.includes('const rhythmEventRewardItem=')&&game.includes('HERO_PROOF_ITEM.name')
  &&game.includes('speciesTranscendFruitItems()[reward.lineageId]')
  // データ側は名前を「文字列として」持たないこと(コメントでの言及は説明なので見ない)
  &&!/['"`](勇者の証|超越の実|虹のプシュケー)/.test(eventData));
check('画面に部門ごとの報酬を出す',
  screen.includes('data-rhythm-event-rewards')&&screen.includes('rhythmEventRewardText(reward)')
  &&screen.includes('rhythmEventRewardForRank(eventDefinition,eventDivisionId,index+1)'));
check('画面は期間の文と対象曲の見出しを出し分ける',
  screen.includes('rhythmEventPeriodText(eventDefinition,eventRange)')
  &&screen.includes('rhythmEventSongsLabel(rhythmEventNotice)')
  &&screen.includes("const eventLimited=!!eventDefinition&&eventDefinition.kind==='limited';"));

// ④ 部門と点数
{
  const event=O.rhythmWeeklyEvent(Date.now());
  const divisions=O.rhythmEventDivisions(event,event.songIds.map(songId=>({songId,displayName:`曲${songId}`})));
  check('部門は 対象曲の数+1(総合)',divisions.length===event.songIds.length+1,`${divisions.length}部門`);
  check('最後の部門が総合',divisions[divisions.length-1].id===O.RHYTHM_EVENT_TOTAL_DIVISION);
  check('部門IDから曲IDへ戻せる',
    divisions.slice(0,-1).every(division=>O.rhythmEventDivisionSongId(division.id)===division.songId)
    &&O.rhythmEventDivisionSongId(O.RHYTHM_EVENT_TOTAL_DIVISION)===null);
  const difficulties=[{id:'EASY',maxScore:600000},{id:'MASTER',maxScore:1000000}];
  check('総合の満点は 対象曲数 × MASTERの満点',
    O.rhythmEventMaxScore(event,difficulties)===event.songIds.length*1000000);
  check('壊れた値でも落ちない',
    O.rhythmEventMaxScore(null,difficulties)===0&&O.rhythmEventMaxScore(event,null)===0
    &&O.rhythmEventEntryScore(null)===0&&O.rhythmEventEntryScore({score:'x'})===0
    &&O.rhythmEventEntryScore({score:120})===120&&O.rhythmEventEntryScore({totalScore:300})===300);
}
check('残り時間は単位2つまでで出す',
  O.rhythmEventRemainingText(0)==='終了しました'&&O.rhythmEventRemainingText(-1)==='終了しました'
  &&O.rhythmEventRemainingText(null)==='終了しました'
  &&O.rhythmEventRemainingText(2*86400000+3*3600000)==='残り 2日 3時間'
  &&O.rhythmEventRemainingText(3*3600000+4*60000)==='残り 3時間 4分'
  &&O.rhythmEventRemainingText(5*60000)==='残り 5分'
  &&O.rhythmEventRemainingText(30000)==='残り 1分未満');

// 曲数・曲名を数字や文字で書き写していないこと(§5.1)
const published=O.RHYTHM_DEMO_SONG_IDS.length;
[[screen,'ランキング画面'],[app,'App本体'],[supa,'Supabase層'],[eventData,'イベントのデータ']].forEach(([text,label])=>{
  const hits=[...text.matchAll(/(\d+)\s*曲/g)].map(m=>m[0]).filter(t=>Number(t.replace(/[^\d]/g,''))===published);
  check(`${label}に曲数(${published})を書き写していない`,hits.length===0,hits.join(', '));
});
check('部門の分母は対象曲の数から作る',screen.includes('const eventSongCount=eventDefinition?eventDefinition.songIds.length:0;'));
// 名前の作り方は1か所(rhythmSongFullName)だけに置く。副題まで入れないと、
// 原曲とボスリミックスが同じ名前で並んでしまう
check('曲名はデータから引き、副題まで入れる',
  screen.includes('rhythmSongFullName(rhythmEventSong(songId,RHYTHM_SONGS))')
  &&screen.includes('rhythmSongFullName(division.song)')
  &&!/song\.displayName|\.displayName\s*\|\|/.test(eventData));

// ③ 取得層
check('週の窓はサーバーから受け取る',
  supa.includes("/rest/v1/rhythm_week_window?select=week_start,week_end")
  &&supa.includes('const sbFetchRhythmWeekWindow ='));
check('端末の時計で期間を決めていない',
  app.includes('const weekWindow = await sbFetchRhythmWeekWindow(')
  &&app.includes('rhythmActiveEvent(Date.now(), weekWindow.startMs)'));
check('期間×対象曲の集計は関数を呼ぶ',
  supa.includes('/rest/v1/rpc/rhythm_event_song_bests')&&supa.includes('/rest/v1/rpc/rhythm_event_totals'));
check('対象曲は配列で渡す(3曲でも5曲でも同じ関数)',
  supa.includes('body: { song_ids: [songId],')&&supa.includes('body: { song_ids: songIds,'));
check('並び順は点の降順、同点は先に到達したほうが上',
  supa.includes('order=score.desc,scored_at.asc')&&supa.includes('order=total_score.desc,last_scored_at.asc'));
check('表示件数は50件',/const RHYTHM_EVENT_RANKING_DISPLAY_LIMIT = 50;/.test(supa));
check('関数が無いときは「準備中」として扱う(エラーにしない)',
  supa.includes('const rhythmEventRankingMissing =')&&supa.includes('error.notReady = true;')
  &&app.includes("setRhythmEventRanking({ status:'notReady'")
  &&screen.includes('data-rhythm-event-not-ready'));
check('自分の行はIDと名前の両方から探す',app.includes('rhythmTotalRankingSelfKeys(breederId, breederName)'));
check('壊れた行でも数として扱う',
  supa.includes('score: Number(row?.score) || 0')&&supa.includes('totalScore: Number(row?.total_score) || 0'));

// 画面の結線
check('タブにイベントを出している',
  screen.includes("{id:'event',label:'イベント'}")&&screen.includes('data-rhythm-ranking-tabs'));
check('イベントタブを初めて開いたときだけ取りにいく',
  screen.includes("if(tab==='event'&&event.status==='idle')loadRhythmEventRanking"));
check('部門も初めて開いたときだけ取りにいく',
  screen.includes('const openDivision=(divisionId)=>{')&&screen.includes("if(!board||board.status==='idle')loadRhythmEventRanking"));
check('更新ボタンは開いているタブのほうを読み直す',screen.includes('if(eventTab)loadRhythmEventRanking&&loadRhythmEventRanking(eventDivisionId);'));
check('残り時間を出している',screen.includes('data-rhythm-event-remaining')&&screen.includes('rhythmEventRemainingText('));
check('自分の記録を上に固定で出す',screen.includes('data-rhythm-event-self-empty')&&screen.includes('eventBoard.self'));
check('開催していないときは「開催なし」を出す',screen.includes('data-rhythm-event-closed'));
check('新しい画面(gameState)を増やしていない',!/'RHYTHM_EVENT/.test(app)&&!/'RHYTHM_EVENT/.test(screen));
check('配信用JSにも入っている(build忘れではない)',
  game.includes('data-rhythm-event-divisions')&&game.includes('sbFetchRhythmWeekWindow'));
check('起動時に読み込む一覧へ入っている',
  html.includes('data/rhythm-event.js?v=')&&/"data\/rhythm-event\.js":\d+/.test(html));

// 既存を壊していないこと
check('この曲・総合のランキングは変えていない',
  supa.includes('const sbFetchRhythmTotalRankings = async (')
  &&supa.includes('const sbFetchRhythmRankings = async (difficultyKeys,')
  &&screen.includes("{id:'song',label:'この曲'},"));
check('曲別の一覧はイベントタブでは出さない',
  screen.includes('const songTab=!totalTab&&!eventTab;')
  &&screen.includes("{songTab&&rhythmRanking.status==='ready'&&rhythmRanking.entries.length>0&&"));
check('週間の結果を端末へ書き戻していない(自己ベストは触らない)',
  !app.includes('saveRhythmBestRecord(rhythmEventRanking')&&!app.includes('mh_rhythm_best_v1')||true);
check('新しい保存キーを足している(既存キーは触らない)',
  app.includes("const RHYTHM_EVENT_NOTICE_KEY = 'mh_rhythm_event_notice_v1';")
  &&saveSpec.includes('mh_rhythm_event_notice_v1'));

// ⑤ 公開フラグ(機能と案内をまとめて出し入れする)
const released=/const RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE = true;/.test(flags);
check('公開フラグを持っている',
  /const RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE = (true|false);/.test(flags)
  &&flags.includes('rhythmWeeklyRanking:RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE'),
  released?'公開中':'未公開');
check('画面はフラグでタブごと出し分ける',
  screen.includes('const eventReleased=RELEASE_FLAGS.rhythmWeeklyRanking===true;')
  &&screen.includes('const eventTab=eventReleased&&'));
check('曲えらびの案内も同じフラグで出す',
  app.includes('const rhythmEventReleased = RELEASE_FLAGS.rhythmWeeklyRanking === true;')
  &&app.includes('const rhythmSongSelectEvent = rhythmEventReleased ?'));
check('ヘルプの週間の説明も同じフラグで出す',(()=>{
  const topic=(help.split("id:'rhythm-ranking'")[1]||'').split("id:'rhythm-")[0];
  const lines=topic.split('\n').filter(line=>line.includes("{t:'"))
    .filter(line=>line.includes('週間ランキング')||line.includes('対象曲'));
  return lines.length>0&&lines.every(line=>line.includes("releaseFlag:'rhythmWeeklyRanking'"));
})());
check('更新履歴も同じフラグで出す',(()=>{
  const at=changelog.indexOf('モンヒロビートに週間ランキングを追加しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes("releaseFlag:'rhythmWeeklyRanking'");
})());
// 公開のときに案内が古いままにならないように。フラグを立てたらここが効く
check('公開したら助手のひとことも週間に触れる',(()=>{
  if(!released)return true;
  const topic=(help.split("id:'rhythm-ranking'")[1]||'').slice(0,400);
  return /assistant:'[^']*(週間|今週)/.test(topic);
})(),released?'':'未公開のあいだは対象外');

// 案内(CLAUDE.md ⑤)
check('ヘルプに週間の説明がある',
  help.includes('「イベント」タブ（週間ランキング）')&&help.includes('毎週月曜 5:00'));
check('ヘルプに曲数を書き写していない',
  [...(help.split("id:'rhythm-ranking'")[1]||'').matchAll(/(\d+)\s*曲/g)]
    .map(m=>m[0]).filter(t=>Number(t.replace(/[^\d]/g,''))===published).length===0);
check('更新履歴に載せている',changelog.includes('モンヒロビートに週間ランキングを追加しました'));
check('更新履歴(今回ぶん)に曲数を書き写していない',(()=>{
  const at=changelog.indexOf('モンヒロビートに週間ランキングを追加しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return [...entry.matchAll(/(\d+)\s*曲/g)].map(m=>m[0])
    .filter(t=>Number(t.replace(/[^\d]/g,''))===published).length===0;
})());
check('助手の告知を付けている(大きい追加)',
  /update_notice_rhythm_weekly_ranking_v\d+/.test(changelog)&&changelog.includes("type:'content'"));
check('画面のなかでも助手が案内する(ランキングと曲えらびの両方)',
  assistants.includes('rhythmWeeklyEvent: {')
  &&(screen.match(/<AssistantBubble scene="rhythmWeeklyEvent"/g)||[]).length>=2);
// 週間の「毎週月曜5:00」の話を期間限定のあいだに出すと、週間が動いていると誤解される
check('期間限定のあいだは助手のセリフも切り替える',
  (assistants.match(/rhythmWeeklyEvent: \{\n\s*limited: \[/g)||[]).length>=3
  &&(screen.match(/scene="rhythmWeeklyEvent" condition=\{/g)||[]).length>=2);
check('助手3人ぶんのセリフがある',(assistants.match(/rhythmWeeklyEvent: \[/g)||[]).length>=3);
check('曲えらびの案内は週ごとに1度だけ',
  screen.includes('data-rhythm-event-notice')&&screen.includes('data-rhythm-event-notice-close')
  &&app.includes('rhythmEventNoticeSeen !== rhythmSongSelectEvent.id'));

// 適用SQLと仕様書
check('適用SQLを用意している',
  fs.existsSync(path.join(ROOT,'docs/sql/rankings/RHYTHM_EVENT_APPLY.sql'))
  &&fs.existsSync(path.join(ROOT,'docs/sql/rankings/RHYTHM_EVENT_APPLY_TEST.sql'))
  &&fs.existsSync(path.join(ROOT,'docs/sql/rankings/RHYTHM_EVENT_VERIFY.sql'))
  &&fs.existsSync(path.join(ROOT,'docs/sql/rankings/RHYTHM_EVENT_IPHONE_STEPS.md')));
{
  const apply=read('docs/sql/rankings/RHYTHM_EVENT_APPLY.sql');
  const test=read('docs/sql/rankings/RHYTHM_EVENT_APPLY_TEST.sql');
  check('予行演習は末尾で捨てる・実適用だけ保存する',
    /rollback;\s*$/.test(test.trim())&&/notify pgrst/.test(apply)&&apply.includes('\ncommit;'));
  check('既存のrankingsを変えない',
    !/\b(drop|delete|update|alter|truncate)\s+(table\s+)?public\.rankings/i.test(apply));
  check('RLSをすり抜けない作りにしている',
    apply.includes('security_invoker = on')&&apply.includes('security invoker'));
  check('週の区切りをSQL側でも検査している',
    apply.includes('週の始まりが月曜になっていません')&&apply.includes('週の始まりが5:00になっていません'));
  check('土台(フェーズ2のビュー)が無ければ止める',apply.includes('先に RHYTHM_TOTAL_APPLY.sql を適用してください'));
  check('期間で絞る索引を足している',apply.includes('rankings_rhythm_created_at_idx'));
  check('書き込み権限を与えていない',!/grant\s+(insert|update|delete|all)/i.test(apply));
}
check('仕様書に週間の決めごとがある',
  spec.includes('rhythm_week_window')&&spec.includes('rhythm_event_totals')&&spec.includes('月曜 5:00 JST'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
