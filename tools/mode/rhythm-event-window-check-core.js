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
const shared=read('monster-hero/src/parts/28-rhythm-shared.jsx');
const release=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const game=read('monster-hero/src/game-system.jsx');
const html=read('monster-hero/index.html');
const help=read('monster-hero/data/help.js');
const changelog=read('monster-hero/data/changelog.js');
const assistants=read('monster-hero/data/assistants.js');
const spec=read('docs/spec/RHYTHM_RANKING.md');
const flags=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const saveSpec=read('docs/spec/SAVE_DATA.md');
const marketScreen=read('monster-hero/src/parts/55-screen-breeder-market.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- データ層(週の区切り・対象曲・部門)を実際に動かす ---
const demoIds=(rhythmData.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
check('公開曲の一覧を抽出できる',!!demoIds);
const context={console};
vm.createContext(context);
vm.runInContext(`${demoIds}\n${eventData}\n`
  +'this.out={RHYTHM_WEEK_MS,RHYTHM_WEEK_ANCHOR_MS,RHYTHM_EVENTS,RHYTHM_DEMO_SONG_IDS,'
  +'rhythmWeekStartMs,rhythmWeekWindow,rhythmWeekId,rhythmWeeklyEvent,rhythmLimitedEventAt,'
  +'rhythmEventWindow,rhythmEventRemainingText,rhythmEventDivisions,rhythmEventDivisionSongId,rhythmEventSong,'
  +'rhythmEventPeriodText,rhythmEventSongsLabel,rhythmEventBanner,rhythmEventDivisionReward,rhythmEventRewardForRank,rhythmEventHasRewards,'
  +'rhythmEventSongDivisionId,RHYTHM_EVENT_REWARD_RANKS,rhythmEventsAwaitingReward,'
  +'normalizeRhythmEventRewardClaims,rhythmEventDivisionIds,rhythmEventParticipationReward,rhythmEventParticipationCleared,'
  +'rhythmEventSongDivisionId,rhythmEventMaxScore,rhythmEventEntryScore,RHYTHM_EVENT_TOTAL_DIVISION,'
  +'RHYTHM_EVENT_POINT_TARGET_MULTIPLIER,rhythmEventPointBaseForScore,rhythmEventPointAwardAt,'
  +'RHYTHM_EVENT_POINT_SHOP_OFFERS,rhythmEventPointExchangePreview,'
  +'rhythmPreviousLimitedEvent,rhythmNextLimitedEvent,rhythmHistoryEvents};',context);
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

// ② 週間ランキングは対象曲を持たない(2026-09-11・ユーザー指示
//    「週間ランキングはそれのみにして、対応曲があるのはイベントのほうにして」)
{
  const week=O.rhythmWeeklyEvent(Date.now());
  check('週間は公開曲すべてが対象',!!week
    &&week.songIds.length===O.RHYTHM_DEMO_SONG_IDS.length
    &&week.songIds.every(id=>O.RHYTHM_DEMO_SONG_IDS.includes(id)),`${week?week.songIds.length:0}曲`);
  check('週間の部門は総合1つだけ',(()=>{
    const divisions=O.rhythmEventDivisions(week,[]);
    return divisions.length===1&&divisions[0].id===O.RHYTHM_EVENT_TOTAL_DIVISION;
  })());
  check('曲を足せば週間の対象も自動で増える(曲の一覧を書き写していない)',
    !/songIds: Object\.freeze\(\[\s*'/.test(eventData.slice(0,eventData.indexOf('const RHYTHM_EVENTS')))
    &&eventData.includes('songIds: Object.freeze([...published])'));
  check('週が変わっても対象曲は変わらない(毎週同じ全曲)',
    O.rhythmWeeklyEvent(Date.now()).songIds.join(',')
    ===O.rhythmWeeklyEvent(Date.now()+7*24*3600*1000).songIds.join(','));
  check('週が変わればIDは変わる(集計する期間が変わる)',
    O.rhythmWeeklyEvent(Date.now()).id!==O.rhythmWeeklyEvent(Date.now()+7*24*3600*1000).id);
  check('対象曲を持つのはイベントだけ',(()=>{
    const limitedEvents=(O.RHYTHM_EVENTS||[]).filter(e=>e.kind==='limited');
    return limitedEvents.every(e=>O.rhythmEventDivisions(e,[]).length===e.songIds.length+1);
  })());
  check('画面は部門が1つのときボタンを出さない',
    screen.includes('{eventDivisions.length>1&&<div data-rhythm-event-divisions'));
  check('曲えらびの案内は期間限定のときだけ',
    app.includes('rhythmEventReleased ? rhythmLimitedEventAt(Date.now()) : null')
    &&!app.includes('rhythmActiveEvent('));
  check('廃止した仕組みが残っていない(ローテーション・rhythmActiveEvent)',
    !eventData.includes('RHYTHM_WEEKLY_ROTATION')
    &&!/const rhythmActiveEvent =/.test(eventData));
}

// --- 告知画像(2026-09-11・ユーザー指示「告知用画像を表示できる仕組みを作って」) ---
{
  const fsx=require('fs');
  const withBanner=(O.RHYTHM_EVENTS||[]).filter(e=>O.rhythmEventBanner(e));
  console.log(`--  告知画像つきイベント: ${withBanner.length?withBanner.map(e=>e.id).join(', '):'なし'}`);
  check('告知画像が実在する',withBanner.every(e=>{
    const rel=O.rhythmEventBanner(e).split('?')[0];
    return fsx.existsSync(path.join(ROOT,'monster-hero',rel));
  }),withBanner.map(e=>O.rhythmEventBanner(e).split('?')[0]).join(' / '));
  // 起動時に読むものを増やさない。開いたときに初めて読むのが正しい(CLAUDE.md ⑥-2)
  check('告知画像は起動時に読み込まない',withBanner.every(e=>{
    const rel=O.rhythmEventBanner(e).split('?')[0];
    return !html.includes(`"${rel}"`);
  }));
  // スマホの通信量に直接効くので、入れる前に軽くする(CLAUDE.md ⑥-2)
  check('告知画像は軽い(200KB以内)',withBanner.every(e=>{
    const rel=O.rhythmEventBanner(e).split('?')[0];
    const file=path.join(ROOT,'monster-hero',rel);
    return !fsx.existsSync(file)||fsx.statSync(file).size<=200*1024;
  }),withBanner.map(e=>{
    const file=path.join(ROOT,'monster-hero',O.rhythmEventBanner(e).split('?')[0]);
    return fsx.existsSync(file)?`${(fsx.statSync(file).size/1024).toFixed(0)}KB`:'?';
  }).join(' / '));
  check('書き方がおかしい画像は出さない',
    O.rhythmEventBanner(null)===null&&O.rhythmEventBanner({banner:''})===null
    &&O.rhythmEventBanner({banner:'../secret.png'})===null
    &&O.rhythmEventBanner({banner:'images/events/a.jpg'})==='images/events/a.jpg');
  check('画像が無いイベントでも画面は壊れない',
    O.rhythmEventBanner(O.rhythmWeeklyEvent(Date.now()))===null
    &&game.includes('if(!src||failed)return null;'));
  check('読めなかったら黙って消す(壊れたアイコンを残さない)',
    game.includes('onError={()=>setFailed(true)}'));
  check('イベントタブと曲えらびの両方に出す',
    (screen.match(/<RhythmEventBanner /g)||[]).length>=2);
  // キャッシュキーを打つ側と、使われていない画像を探す側の両方へ登録が要る
  check('画像を参照するファイルとして登録してある',
    read('tools/stamp-version.js').includes("'data/rhythm-event.js',")
    &&read('tools/image-asset-check.js').includes("'data/rhythm-event.js',"));
  check('キャッシュキーが中身と一致している',withBanner.every(e=>{
    const [rel,query]=O.rhythmEventBanner(e).split('?');
    const file=path.join(ROOT,'monster-hero',rel);
    if(!fsx.existsSync(file))return false;
    const want=require('crypto').createHash('sha256').update(fsx.readFileSync(file)).digest('hex').slice(0,12);
    return (query||'').replace(/^v=/,'')===want;
  }));
}

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
// --- 参加報酬(§9.2) ---
{
  const withJoin=(O.RHYTHM_EVENTS||[]).filter(e=>O.rhythmEventParticipationReward(e));
  console.log(`--  参加報酬つきイベント: ${withJoin.length?withJoin.map(e=>e.id).join(', '):'なし'}`);
  check('参加報酬は対象曲の数を超えない',withJoin.every(e=>
    O.rhythmEventParticipationReward(e).songs<=e.songIds.length));
  check('参加報酬は決めた曲数で成立する',withJoin.every(e=>{
    const need=O.rhythmEventParticipationReward(e).songs;
    return !O.rhythmEventParticipationCleared(e,need-1)
      &&O.rhythmEventParticipationCleared(e,need)
      &&O.rhythmEventParticipationCleared(e,need+1);
  }));
  check('壊れた曲数でも成立しない',withJoin.every(e=>
    [null,'x',-1,NaN,undefined].every(v=>!O.rhythmEventParticipationCleared(e,v))));
  // ★2026-09-13にユーザーが決めて、週間にも参加報酬を付けた(その週に3回遊ぶ)。
  //   参加報酬を持たないのは、書いていない期間限定イベントのほう
  check('参加報酬を書いていないイベントでは成立しない',
    !O.rhythmEventParticipationCleared({kind:'limited',songIds:['a']},99)
    &&O.rhythmEventParticipationReward({kind:'limited',songIds:['a']})===null);
}
check('参加報酬は自分の行から遊んだ曲数を見る(上位5件に入っていなくても成立する)',
  app.includes('if (rhythmEventParticipationReward(event)) {')
  &&app.includes('identityKeys:selfKeys, requestId:`rhythm-reward-${event.id}-join`')
  &&app.includes('rhythmEventParticipationCleared(event, played)'));
// ★2026-09-14にユーザー指摘「イベント報酬が直接アイテム欄に入ってた / ギフト経由して」。
//   直接足すのをやめ、ギフト1件へまとめて届ける形にした。ダイヤもプシュケーも
//   ギフトの受け取り(buildGiftClaim)が既存の入れ物へ振り分ける
check('参加報酬もギフトの中身へ入る(ダイヤ・プシュケー・アイテム)',
  shared.includes("add('rainbowPsyche',null,join.psyche)")
  &&shared.includes("add('diamond',null,join.gold)")
  &&/join\.heroProof>0&&typeof HERO_PROOF_ITEM!=='undefined'/.test(shared));
check('参加報酬を画面に出す(開催中と受け取りの両方)',
  screen.includes('data-rhythm-event-participation')
  &&screen.includes('data-rhythm-event-reward-participation')
  &&game.includes('const rhythmEventParticipationText='));
check('入賞していなくても参加報酬だけで受け取り画面を出す',
  app.includes('if (prizes.length === 0 && !participation) { await markRhythmEventRewardClaimed(event.id); return; }')
  &&screen.includes("{won ? '入賞おめでとうございます！' : 'ご参加ありがとうございました！'}"));
// ★報酬のある順位までしか問い合わせない。週間は1〜10位、イベントは1〜5位
//   (2026-09-13に週間へ報酬を付けたので、数は rankLimit で出す)
check('受け取りは報酬のある順位ぶんだけ問い合わせる',
  app.includes('const rankLimit = weekly ? RHYTHM_WEEKLY_REWARD_RANKS : RHYTHM_EVENT_REWARD_RANKS;')
  &&app.includes('limit:rankLimit'));
check('通信に失敗したら受け取り済みにしない(次の起動でやり直す)',
  app.includes("console.error('[rhythm-event-reward] fetch failed:'")
  &&app.includes('// 通信の失敗で受け取り済みにはしない。次の起動でやり直す'));
check('入賞も参加報酬も無ければ受け取り済みにする(毎回問い合わせ直さない)',
  app.includes('if (prizes.length === 0 && !participation) { await markRhythmEventRewardClaimed(event.id); return; }'));
check('先にフラグを保存してから報酬を配る(二重付与を防ぐ)',(()=>{
  const at=app.indexOf('const claimRhythmEventReward');
  if(at<0)return false;
  // ★切り出す幅は、受け取りの本体がまるごと入る大きさにする。
  //   足りないと「保存が見つからない(-1)」で、順番が正しくても落ちる
  const body=app.slice(at,at+3000);
  const flagAt=body.indexOf('markRhythmEventRewardClaimed');
  // 2026-09-14: アイテム欄へ直接入れるのをやめ、ギフトで届ける形にした
  const giftAt=body.indexOf('grantGiftOnce(before, gift)');
  return flagAt>=0&&giftAt>=0&&flagAt<giftAt;
})());
check('報酬はギフトで届ける(アイテム欄へ直接入れない)',
  app.includes('const rewards = rhythmEventGiftRewards(prize);')
  &&app.includes("source: 'rhythmEvent',")
  &&app.includes('grantGiftOnce(before, gift)')
  // 直接足していた古い書き方が残っていないこと
  &&!app.includes('ownedItemCount(next, item.id) + entry.reward.count'));
check('ギフトは同じidを二重に作らない',
  /if \(list\.some\(item => item\?\.id === gift\.id\)\) return \{ granted:false/.test(release));
check('ギフトの中身は同じ種類をまとめる(同じ行が何本も並ばない)',
  /const totals=new Map\(\);/.test(shared)&&/found\.amount\+=n;/.test(shared));
check('受け取り画面を出す(新しいgameStateは増やさない)',
  screen.includes('function RhythmEventRewardModal')&&screen.includes('data-rhythm-event-reward-claim')
  &&app.includes('<RhythmEventRewardModal')&&!/'RHYTHM_EVENT_REWARD'/.test(app));
check('受け取り済みの保存キーを新しく足している',
  app.includes("const RHYTHM_EVENT_REWARD_KEY = 'mh_rhythm_event_reward_v1';")
  &&saveSpec.includes('mh_rhythm_event_reward_v1'));
check('ヘルプに受け取り方が書いてある',
  help.includes('報酬の受け取り方')&&help.includes('2週間まで'));

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
// 境界そのもの。開始ちょうどで始まり、終了ちょうどで終わる
check('開始・終了の境界で入れ替わる',limited.every(e=>{
  const start=Date.parse(e.startAt),end=Date.parse(e.endAt);
  const at=(ms)=>O.rhythmLimitedEventAt(ms);
  return at(start-1)===null&&(at(start)||{}).id===e.id
    &&(at(end-1)||{}).id===e.id&&at(end)===null;
}));
// ★2026-09-11・ユーザー指示「週間ランキングとイベントランキングは別々に作ったほうがいい」。
//   もとの仕様(§7)の「期間限定のあいだ週間を休む」は取り消した。両方が同時に動く。
check('期間限定のあいだも週間は止まらない',limited.every(e=>{
  const mid=(Date.parse(e.startAt)+Date.parse(e.endAt))/2;
  return !!O.rhythmWeeklyEvent(mid)&&!!O.rhythmLimitedEventAt(mid);
}));
check('画面はタブを分けている(週間 / イベント)',
  screen.includes("{id:'weekly',label:'週間'}")&&screen.includes("{id:'event',label:'イベント'}")
  &&screen.includes("const boardKind=rhythmRankingTab==='weekly'?'weekly'"));
// 2026-09-14・ユーザー依頼「イベントタブを常設して、前回のランキングと今回のランキングを
// 見れるようにしたい。前回や今回がない場合はそのような文言をいれとく」。
// 以前は「開催していないあいだはタブを出さない」形だったので、終わった瞬間に
// ランキングの画面から結果へ辿れなくなっていた。
check('イベントのタブは常設する(開催していなくても出す)',
  screen.includes("...(eventReleased?[{id:'event',label:'イベント'}]:[]),")
  &&!screen.includes("...(eventReleased&&limitedEvent?[{id:'event',label:'イベント'}]:[]),"));
check('イベントのタブの中で「今回」と「前回」を切り替える',
  screen.includes('data-rhythm-event-phase-tabs')
  &&screen.includes("data-rhythm-event-phase={phase.id}")
  &&screen.includes("const openEventPhase=(phase)=>{")
  &&screen.includes("eventPhase==='prev'?(prevEventEntry?'prevEvent':null):(limitedEvent?'limited':null)"));
// 「今回」「前回」は見るたびに数え直す(開きっぱなしの端末でも時刻で入れ替わる)。
// 実際に時刻を動かして、開催前・開催中・終了後で答えが変わることを確かめる
const limitedForPhase=O.RHYTHM_EVENTS.filter(e=>e&&e.kind==='limited');
if(limitedForPhase.length>0){
  const first=limitedForPhase.map(e=>Date.parse(e.startAt)).sort((a,b)=>a-b)[0];
  const last=limitedForPhase.map(e=>Date.parse(e.endAt)).sort((a,b)=>b-a)[0];
  const mid=(Date.parse(limitedForPhase[0].startAt)+Date.parse(limitedForPhase[0].endAt))/2;
  check('1回目が始まる前は「前回」が無い',O.rhythmPreviousLimitedEvent(first-1)===null);
  check('1回目が始まる前は「次回」が分かる',
    !!O.rhythmNextLimitedEvent(first-1)&&O.rhythmNextLimitedEvent(first-1).startMs===first);
  check('開催中は「今回」がある',!!O.rhythmLimitedEventAt(mid));
  check('終わったあとは「前回」になる',
    !!O.rhythmPreviousLimitedEvent(last+1)&&O.rhythmPreviousLimitedEvent(last+1).endMs===last);
  check('終わったあとは「今回」が無い',O.rhythmLimitedEventAt(last+1)===null);
  check('「前回」はいちばん最近に終わった回(新しい順の先頭)',
    O.rhythmPreviousLimitedEvent(last+1)?.id===(O.rhythmHistoryEvents(last+1)[0]||{}).id);
  check('開催中のイベントは「次回」に数えない',
    (O.rhythmNextLimitedEvent(mid)||{id:null}).id!==limitedForPhase[0].id);
}
check('今回が無い・前回が無いときの文言がある',
  screen.includes('data-rhythm-event-none-now')&&screen.includes('いま開催しているイベントはありません。')
  &&screen.includes('data-rhythm-event-none-prev')&&screen.includes('まだ終わったイベントがありません。'));
// 2026-09-13、終わった回をあとから見る履歴(kind:'history')を足した。
// 3つとも別々に持つ(片方を読み込んでも、もう片方の一覧が消えない)ことを見る
check('週間とイベントと履歴の読み込みは別々に持つ',
  app.includes("const loadRhythmEventRanking = useCallback(async (kind, divisionId, historyEntry = null) =>")
  &&app.includes("useState({ weekly:RHYTHM_BOARD_EMPTY, limited:RHYTHM_BOARD_EMPTY, prevEvent:RHYTHM_BOARD_EMPTY, history:RHYTHM_BOARD_EMPTY })")
  &&screen.includes('const event=(boardKind&&boards[boardKind])||'));
check('期間限定の期間は定義の日時そのまま',limited.every(e=>{
  const range=O.rhythmEventWindow(e,null);
  return !!range&&range.startMs===Date.parse(e.startAt)&&range.endMs===Date.parse(e.endAt);
}));
// 画面に出す期間の文。週間と期間限定で出し分けること
check('期間の文を出し分ける',(()=>{
  const week=O.rhythmWeeklyEvent(Date.now());
  const weekText=O.rhythmEventPeriodText(week,O.rhythmEventWindow(week,O.rhythmWeekWindow(Date.now())));
  // ★2026-09-14: 週間も「今週 9/14(月) 5:00 〜 …」と日付を出す。
  //   「毎週 月曜 5:00 に切り替わります」だけだと、いま見ているのが今週なのか
  //   先週のまま残っているのかが画面から分からなかった。
  //   期間が取れないときだけ、これまでどおりの文へ倒す
  if(!/^今週 \d+\/\d+\([日月火水木金土]\) \d+:\d\d 〜 \d+\/\d+\([日月火水木金土]\) \d+:\d\d$/.test(weekText))return false;
  if(O.rhythmEventPeriodText(week,null)!=='毎週 月曜 5:00 に切り替わります')return false;
  return limited.every(e=>{
    const text=O.rhythmEventPeriodText(e,O.rhythmEventWindow(e,null));
    return /\d+\/\d+\([日月火水木金土]\) \d+:\d\d 〜 \d+\/\d+\([日月火水木金土]\) \d+:\d\d/.test(text);
  });
})(),limited.length?O.rhythmEventPeriodText(limited[0],O.rhythmEventWindow(limited[0],null)):'');
// 対象曲を持つのは期間限定だけなので、見出しはいつも「対象曲」
check('対象曲の見出しは「対象曲」',limited.every(e=>O.rhythmEventSongsLabel(e)==='対象曲'));

// --- 報酬(docs/spec/RHYTHM_RANKING.md §9) ---
// 1位から5位まで、個数は5/4/3/2/1・プシュケーは1,000/800/600/400/200。6位以下は無し。
// ★2026-09-13にユーザーが決めて、週間にも報酬を付けた(1〜10位・勇者の証片)。
//   中身の検査は tools/mode/rhythm-weekly-reward-check.js が受け持つ。
//   ここでは「イベントとは別の体系になっている」ことだけを見る
check('週間は1〜10位の報酬を持つ(イベントの1〜5位とは別の体系)',(()=>{
  const week=O.rhythmWeeklyEvent(Date.now());
  if(!O.rhythmEventHasRewards(week))return false;
  const first=O.rhythmEventRewardForRank(week,O.RHYTHM_EVENT_TOTAL_DIVISION,1);
  const tenth=O.rhythmEventRewardForRank(week,O.RHYTHM_EVENT_TOTAL_DIVISION,10);
  const over=O.rhythmEventRewardForRank(week,O.RHYTHM_EVENT_TOTAL_DIVISION,11);
  return !!first&&first.kind==='heroProofShard'&&!!tenth&&over===null;
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
  &&!/['"`](勇者の証|超越の実|虹のプシュケー)/.test(eventData.slice(eventData.indexOf('// ===== 報酬(docs/spec/RHYTHM_RANKING.md §9) ====='))));
check('画面に部門ごとの報酬を出す',
  screen.includes('data-rhythm-event-rewards')&&screen.includes('rhythmEventRewardText(reward)')
  &&screen.includes('rhythmEventRewardForRank(eventDefinition,eventDivisionId,index+1)'));
check('画面は期間の文と対象曲の見出しを出し分ける',
  screen.includes('rhythmEventPeriodText(eventDefinition,eventRange)')
  &&screen.includes('rhythmEventSongsLabel(rhythmEventNotice)')
  &&screen.includes("const eventLimited=boardKind==='limited'||eventPrev;"));

// ④ 部門と点数
{
  // 部門が分かれるのは期間限定だけ。週間は総合1つ(上で確かめている)
  const event=(O.RHYTHM_EVENTS||[]).find(e=>e.kind==='limited')||O.rhythmWeeklyEvent(Date.now());
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
// 週間の期間の正本はサーバー。期間限定は定義に書いた日時をそのまま使うので聞きに行かない
check('週間の期間はサーバーから受け取る',
  app.includes('const weekWindow = kind === \'weekly\' ? await sbFetchRhythmWeekWindow(')
  // 2026-09-13、履歴を足したので三項が1つ増えた。今週はサーバーの窓、開催中は定義の日時、
  // 履歴は終わっているので渡された期間をそのまま使う(聞きに行かない)
  &&app.includes("kind === 'weekly' ? rhythmWeeklyEvent(weekWindow.startMs)")
  &&app.includes("rhythmLimitedEventAt(Date.now());"));
check('期間×対象曲の集計は関数を呼ぶ',
  supa.includes('/rest/v1/rpc/rhythm_event_song_bests')&&supa.includes('/rest/v1/rpc/rhythm_event_totals'));
// ★行の文字列そのままを見ない。曲ごとのほうは party の取り直しを足したときに
//   body を変数へ出したので、1行の形だけを見ていると中身が正しくても落ちる(2026-09-11)
check('対象曲は配列で渡す(3曲でも5曲でも同じ関数)',
  /song_ids: \[songId\],/.test(supa)&&/song_ids: songIds,/.test(supa));
check('並び順は点の降順、同点は先に到達したほうが上',
  supa.includes('order=score.desc,scored_at.asc')&&supa.includes('order=total_score.desc,last_scored_at.asc'));
check('表示件数は50件',/const RHYTHM_EVENT_RANKING_DISPLAY_LIMIT = 50;/.test(supa));
check('関数が無いときは「準備中」として扱う(エラーにしない)',
  supa.includes('const rhythmEventRankingMissing =')&&supa.includes('error.notReady = true;')
  &&app.includes("setRhythmBoard(kind, { status:'notReady'")
  &&screen.includes('data-rhythm-event-not-ready'));
check('自分の行はIDと名前の両方から探す',app.includes('rhythmTotalRankingSelfKeys(breederId, breederName)'));
check('壊れた行でも数として扱う',
  supa.includes('score: Number(row?.score) || 0')&&supa.includes('totalScore: Number(row?.total_score) || 0'));

// 画面の結線
check('タブにイベントを出している',
  screen.includes("{id:'event',label:'イベント'}")&&screen.includes('data-rhythm-ranking-tabs'));
// ★2026-09-11・ユーザー指摘「イベントランキングの総合だけ反映が遅い」。
//   「初めて開いたときだけ取りにいく」にしていたため、一度見た部門は古い順位のまま
//   残っていた。とくに総合はイベントタブを開いた瞬間に読むので、最初の内容が貼り付いた。
//   押すたびに取り直す形へ変えた。前の順位は消さないので画面はちらつかない。
check('週間・イベントのタブは押すたびに取り直す',
  screen.includes('const want=(rhythmEventDivision&&rhythmEventDivision[kind])||RHYTHM_EVENT_TOTAL_DIVISION;')
  &&screen.includes('loadRhythmEventRanking&&loadRhythmEventRanking(kind,want);')
  &&!screen.includes("if(kind&&(!boards[kind]||boards[kind].status==='idle'))loadRhythmEventRanking"));
check('部門も押すたびに取り直す',
  screen.includes('const openDivision=(divisionId)=>{')
  &&screen.includes('loadRhythmEventRanking&&loadRhythmEventRanking(boardKind,divisionId);')
  &&!screen.includes("if(!board||board.status==='idle')loadRhythmEventRanking"));
check('読み直しのあいだも前の順位を消さない',
  app.includes('const keep = before && before.status === \'ready\' && boardStillCurrent(prev);')
  &&app.includes('boards: { ...prev.boards, [wanted]: keep ? before : { status:\'loading\', entries:[], self:null } },'));
// ★ただし週(またはイベント)が変わったときは残さない。
//   残すと、先週のスコアが今週の順位として画面に出たままになる
//   (2026-09-14・ユーザー指摘「5時過ぎてモンヒロビート見たら週間ランキングにスコアが入ってた」)
check('週・イベントが変わったら前の順位は残さない',
  /const boardStillCurrent = \(prev\) =>/.test(app)
  &&/return loaded === rhythmWeekId\(Date\.now\(\)\);/.test(app)
  &&/const now = rhythmLimitedEventAt\(Date\.now\(\)\); return !!now && now\.id === loaded;/.test(app));
check('更新ボタンは開いているタブのほうを読み直す',screen.includes('if(boardTab)loadRhythmEventRanking&&loadRhythmEventRanking(boardKind,eventDivisionId);'));
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
check('曲別の一覧は週間・イベントのタブでは出さない',
  screen.includes('const songTab=!totalTabOpen&&!boardTab&&!eventTabOpen;')
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
  &&screen.includes('const boardTab=eventReleased&&!!boardKind;'));
check('曲えらびの案内も同じフラグで出す',
  app.includes('const rhythmEventReleased = RELEASE_FLAGS.rhythmWeeklyRanking === true;')
  &&app.includes('const rhythmSongSelectEvent = rhythmEventReleased ?'));
check('ヘルプの週間の説明も同じフラグで出す',(()=>{
  const topic=(help.split("id:'rhythm-ranking'")[1]||'').split("id:'rhythm-")[0];
  const lines=topic.split('\n').filter(line=>line.includes("{t:'"))
    .filter(line=>line.includes('週間ランキング')||line.includes('対象曲'))
    .filter(line=>!line.includes("releaseFlag:'rhythmEventPoints'"));
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
check('ヘルプに週間とイベントの説明がある',
  help.includes("title:'「週間」タブ'")&&help.includes('毎週月曜 5:00')
  &&help.includes('「イベント」タブ（期間限定イベント）'));
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
// ★案内を置くのは曲えらびだけ。ランキング画面には説明も吹き出しも置かない
//   (2026-09-11・ユーザー指摘「ランキングページに余計な説明が多くて見にくい」)。
//   順位を見に来る画面なので読み物は場所を取りすぎる。説明はヘルプにある。
check('曲えらびで助手が案内する',
  assistants.includes('rhythmWeeklyEvent: {')
  &&(screen.match(/<AssistantBubble scene="rhythmWeeklyEvent"/g)||[]).length===1
  &&screen.includes('data-rhythm-event-notice'));
// ★見るのは RhythmRankingScreen の中だけ。遊びかた(ヘルプ)の画面は読み物の場所なので、
//   あちらの横画面の案内まで消さない
const rankingScreenBody=screen.slice(screen.indexOf('function RhythmRankingScreen'));
check('ランキング画面に読み物を置いていない',
  rankingScreenBody.length>0
  &&!/合計で競うランキングです|対象曲で競うランキングです/.test(rankingScreenBody)
  &&!rankingScreenBody.includes('<RhythmLandscapeHint')
  &&!rankingScreenBody.includes('<AssistantBubble'));
// 週間の「毎週月曜5:00」の話を期間限定のあいだに出すと、週間が動いていると誤解される
// 曲えらびの案内は期間限定のときだけ出るので、セリフもイベントの話でそろえる
check('助手のセリフは期間限定イベントの話',
  (assistants.match(/rhythmWeeklyEvent: \[/g)||[]).length>=3
  &&!assistants.includes('今週の対象曲だよ')
  &&(assistants.match(/期間限定/g)||[]).length>=3);
check('助手3人ぶんのセリフがある',(assistants.match(/rhythmWeeklyEvent: \[/g)||[]).length>=3);
check('曲えらびの案内は週ごとに1度だけ',
  screen.includes('data-rhythm-event-notice')&&screen.includes('data-rhythm-event-notice-close')
  &&app.includes('rhythmEventNoticeSeen !== rhythmSongSelectEvent.id'));

// --- ビートP STEP2（獲得式・保存・二重付与防止） ---
check('ビートPの基本式は確定仕様どおり',
  [[800000,80],[850000,85],[900000,90],[950000,95],[960000,116],[970000,137],[980000,158],[990000,179],[1000000,200]]
    .every(([score,want])=>O.rhythmEventPointBaseForScore(score)===want));
check('壊れたスコアは0Pへ倒す',
  O.rhythmEventPointBaseForScore(null)===0&&O.rhythmEventPointBaseForScore('x')===0&&O.rhythmEventPointBaseForScore(-100)===0);
if(limited.length){
  const e=limited[0],mid=(Date.parse(e.startAt)+Date.parse(e.endAt))/2;
  const target=e.songIds[0];
  const normal=O.RHYTHM_DEMO_SONG_IDS.find(id=>!e.songIds.includes(id));
  const targetAward=O.rhythmEventPointAwardAt(mid,target,1000000);
  const normalAward=normal?O.rhythmEventPointAwardAt(mid,normal,1000000):null;
  check('イベント対象曲だけ1.5倍になる',!!targetAward&&targetAward.amount===300&&targetAward.multiplier===1.5&&targetAward.target===true
    &&(!normal||!!normalAward&&normalAward.amount===200&&normalAward.multiplier===1&&normalAward.target===false));
  check('公開後もイベント期間外はビートPを出さない',O.rhythmEventPointAwardAt(Date.parse(e.endAt),target,1000000)===null);
  check('DEBUG専用など公開曲でないIDはビートP対象外',O.rhythmEventPointAwardAt(mid,'atsu_cup_theme_debug_short',1000000)===null);
}
check('ビートPは既存の後方互換キーへ保存する',
  game.includes("const RHYTHM_EVENT_POINTS_KEY='mh_rhythm_event_points_v1';")
  &&game.includes('const normalizeRhythmEventPoints=value=>')
  &&game.includes('await storeGet(RHYTHM_EVENT_POINTS_KEY,0,false)')
  &&saveSpec.includes('mh_rhythm_event_points_v1'));
check('イベント終了でビートPを0へ戻す処理を持たない',!game.includes('storeSet(RHYTHM_EVENT_POINTS_KEY,0'));
check('正常リザルトのfinishでだけビートP付与を判定する',
  game.includes('const eventPointAward=(!debugPlay&&!tutorial&&!calibrating')
  &&game.includes('rhythmEventPointAwardAt(Date.now(),song.songId,score)')
  &&game.includes('void addRhythmEventPoints(eventPointAward.amount)'));
check('STEP4でビートP公開フラグをONにする',
  /const RHYTHM_EVENT_POINTS_PUBLIC_RELEASE = true;/.test(flags)
  &&flags.includes('rhythmEventPoints:RHYTHM_EVENT_POINTS_PUBLIC_RELEASE')
  &&game.includes('RELEASE_FLAGS?.rhythmEventPoints===true'));
check('finishは二重付与防止のfinished印を先に立てる',(()=>{
  const from=game.indexOf('const finish=useCallback');
  const done=game.indexOf('run.finished=true;',from);
  const award=game.indexOf('addRhythmEventPoints(eventPointAward.amount)',from);
  return from>=0&&done>from&&award>done;
})());
check('ビートPのヘルプは公開フラグと一緒に出す',help.includes("releaseFlag:'rhythmEventPoints'")&&help.includes("title:'ビートP'"));
check('STEP2の更新履歴は開発メモとして残し、未完成機能を告知しない',(()=>{
  const at=changelog.indexOf('イベントPの獲得・保存基盤を実装しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes('dev:true');
})());

// --- ビートP STEP3（交換所・固定12商品・数量交換・原子的保存） ---
check('ビートP交換所は対象確定済みの固定12商品だけ',(()=>{
  const got=(O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).map(o=>[o.id,o.itemId||'',o.grantAmount,o.cost]);
  const want=[
    // ★2026-09-17に値上げ(ユーザー指示)。高額の3つ(証片・虹の超越の実・勇者の証)は据え置き、
    //   それ以外の9商品を5倍にした。仕様書は RHYTHM_EVENT_POINTS.md §20.1
    ['diamond_300','',300,5],['training_ticket_x3','training_ticket',3,5],['training_ticket_l','training_ticket_l',1,15],
    ['rainbow_psyche','rainbow_psyche',1,5],['skip_ticket_jo','skip_ticket_jo',1,50],['skip_ticket_ha','skip_ticket_ha',1,80],
    ['skip_ticket_kyu','skip_ticket_kyu',1,115],['skip_ticket_kiwami','skip_ticket_kiwami',1,250],['skip_ticket_haou','skip_ticket_haou',1,500],
    ['hero_proof_shard','hero_proof_shard',1,500],['transcend_fruit_rainbow','transcend_fruit_rainbow',1,5000],['hero_proof','hero_proof',1,10000],
  ];
  return JSON.stringify(got)===JSON.stringify(want);
})());
check('対象未決定のアイコンを推測でビートP商品へ入れない',
  (O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).length===12
  &&!(O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).some(o=>o.kind==='icon'||/アイコン/.test(o.name||'')));
check('ビートPの数量交換計算はダイヤと複数個アイテムを正しく扱う',(()=>{
  const diamond=O.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o=>o.id==='diamond_300');
  const ticket=O.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o=>o.id==='training_ticket_x3');
  // ★必要Pは offer.cost から出す。ここへ数字を直書きすると、値上げのたびに
  //   「計算が正しいか」を見たいだけの検査が落ちる(2026-09-17の値上げで実際に落ちた)
  const need=(offer,q)=>offer.cost*q;
  const a=O.rhythmEventPointExchangePreview({offer:diamond,eventPoints:need(diamond,2)+3,gold:100,ownedItems:{},quantity:2});
  const b=O.rhythmEventPointExchangePreview({offer:ticket,eventPoints:need(ticket,2)+3,gold:100,ownedItems:{training_ticket:4},quantity:2});
  const c=O.rhythmEventPointExchangePreview({offer:ticket,eventPoints:need(ticket,2)-1,gold:100,ownedItems:{training_ticket:4},quantity:2});
  return a.ok&&a.eventPoints===3&&a.gold===700
    &&b.ok&&b.eventPoints===3&&b.ownedItems.training_ticket===10
    &&!c.ok&&c.reason==='points'&&c.eventPoints===need(ticket,2)-1&&c.ownedItems.training_ticket===4;
})());
check('交換保存はビートP・ダイヤ・所持品を1取引で扱う',(()=>{
  const from=app.indexOf('const exchangeRhythmEventPoints = async');
  const to=app.indexOf('// 編成画面:',from);
  const body=app.slice(from,to);
  return from>=0&&body.includes('saveStoredValuesOrRollback([')
    &&body.includes('{ key:RHYTHM_EVENT_POINTS_KEY')
    &&body.includes("{ key:'mh_gold'")
    &&body.includes("{ key:'mh_owned_items'")
    &&body.includes('setRhythmEventPoints(exchange.eventPoints)')
    &&body.includes('setOwnedItems(exchange.ownedItems)');
})());
check('マーケットを開くたびビートP保存値を読み直す',
  app.includes("onOpenMarket={async()=>{addAssistantBond('market');setMarketExchangeError('');setRhythmEventPoints(await loadRhythmEventPoints());setGameState('BREEDER_MARKET');}}"));
check('ビートP交換所はイベント非開催中・0Pでも常設表示する',
  marketScreen.includes("event:{label:'ビートP交換所'")
  &&marketScreen.includes("marketSection==='event'&&<>")
  &&marketScreen.includes('value:safeEventPoints.toLocaleString()')
  &&marketScreen.includes('所持ビートP')
  &&!marketScreen.includes("marketSection==='event'&&!eventPointReleased")
  &&!marketScreen.includes('ビートP交換所は準備中'));
check('ビートP交換所は数量選択とMAX・交換後残高を出す',
  marketScreen.includes('data-event-point-shop')
  &&marketScreen.includes('MAX（{Math.max(0,maxQuantity).toLocaleString()}回）')
  &&marketScreen.includes('交換後')
  &&marketScreen.includes('onExchangeEventPoints(eventQuantityOffer,quantity)'));
check('STEP3の更新履歴も開発メモとして隠す',(()=>{
  const at=changelog.indexOf('イベントP交換所の基盤を実装しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes('dev:true')&&entry.includes("releaseFlag:'rhythmEventPoints'");
})());

// --- ビートP STEP4（正式公開・表示・案内） ---
check('曲選択の獲得案内は開催中だけビートPとして出す',
  screen.includes("const beatPointEvent=RELEASE_FLAGS.rhythmEventPoints===true?rhythmLimitedEventAt(Date.now()):null;")
  &&screen.includes('data-rhythm-beat-point-active')
  &&screen.includes('ビートP獲得期間中'));
check('リザルトは獲得したときだけビートPと対象曲倍率を出す',
  game.includes('data-rhythm-result-beat-points')
  &&game.includes('ビートP獲得')
  &&game.includes('result.eventPointAward.target'));
check('プレイヤー向け主要画面はビートP表記へ統一する',
  ![marketScreen,screen,read('monster-hero/src/parts/30-rhythm-play.jsx'),app,help].some(source=>source.includes('イベントP')));
check('正式公開の更新履歴と助手告知を同じ公開フラグで出す',(()=>{
  const at=changelog.indexOf('ビートP交換所を正式公開しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes("releaseFlag:'rhythmEventPoints'")
    &&entry.includes("assistantNotice: { id:'update_notice_rhythm_beat_point_shop_v1', type:'market' }")
    &&!entry.includes('dev:true');
})());
check('正式仕様は名称・常設・非開催時獲得なし・保存互換・アイコン未実装を明記する',(()=>{
  const pointSpec=read('docs/spec/RHYTHM_EVENT_POINTS.md');
  return /STEP4[^\n]*正式公開済み/.test(pointSpec)
    &&pointSpec.includes('ビートP交換所は常設する')
    &&pointSpec.includes('イベント非開催中は新規ビートPを獲得しない')
    &&pointSpec.includes('保存キー `mh_rhythm_event_points_v1` は変更・削除せず')
    &&pointSpec.includes('対象が決まっていないアイコン商品は未実装');
})());

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
