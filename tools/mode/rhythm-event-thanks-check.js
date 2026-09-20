// 週末ゲリラ杯の「閉幕とお礼」の会話(2026-09-13・ユーザー指示)を見る。
//
//   「初のイベントで結構な数が参加してくれて感謝の気持ちとして参加賞に勇者の証を
//     10個追加でプレゼント。そんな感じのやつを助手のストーリーで作って /
//     イベント終了時間に自動で更新されるやつで」
//
// ここで見るのは次の4つ。どれも**公開してからでないと気づけない**類。
//
//   ① 会話で話している数と、実際に配る数が同じこと(食い違うと嘘になる)
//   ② 終了時刻に**自動で**流れること。しかも「読み込みのときに1回だけ決まる値」を
//      使っていないこと(開きっぱなしの端末でも終了時刻をまたいだ瞬間に流れる・CLAUDE.md ⑥-4)
//   ③ 会話が先、受け取り画面はそのあと(順番が逆になると話が通らない)
//   ④ 会話の作りが壊れていないこと(立ち絵・BGM・回想への登録・{name}の置き換え)
//
//   node tools/mode/rhythm-event-thanks-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const eventData=read('monster-hero/data/rhythm-event.js');
const rhythmData=read('monster-hero/data/rhythm-mode.js');
const assistants=read('monster-hero/data/assistants.js');
const app=read('monster-hero/src/parts/60-app.jsx');
const shared=read('monster-hero/src/parts/28-rhythm-shared.jsx');
const bgm=read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const helpSrc=read('monster-hero/data/help.js');
const changelog=read('monster-hero/data/changelog.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const STORY_ID='monbeat_cup_2026_09_thanks';
const EVENT_ID='weekend_2026_09_11';

// --- データ層を実際に動かす ---
const demoIds=(rhythmData.match(/^const RHYTHM_DEMO_SONG_IDS=Object\.freeze\(\[[\s\S]*?\]\);/m)||[''])[0];
const ctx={console};
vm.createContext(ctx);
vm.runInContext(`${demoIds}\n${eventData}\n`
  +'this.out={RHYTHM_EVENTS,RHYTHM_EVENT_REWARD_CLAIM_MS,rhythmEventParticipationReward,'
  +'rhythmLimitedEventAt,rhythmLimitedEventJustEnded,rhythmEventTimeMs,'
  +'rhythmLimitedEventsJustEnded:typeof rhythmLimitedEventsJustEnded!=="undefined"?rhythmLimitedEventsJustEnded:null};',ctx);
const O=ctx.out;
const event=(O.RHYTHM_EVENTS||[]).find(e=>e&&e.id===EVENT_ID);
check('週末ゲリラ杯の定義がある',!!event);

// 台本を取り出す(データファイルは単体で読める作りなので、そのまま動かす)
const aCtx={console};
vm.createContext(aCtx);
vm.runInContext(`${assistants}\nthis.out={EVENT_REPLAYS,ASSISTANT_MONBEAT_CUP_THANKS};`,aCtx);
const A=aCtx.out;
const replay=(A.EVENT_REPLAYS||[]).find(e=>e&&e.id===STORY_ID);
check('回想の一覧に登録されている',!!replay&&Array.isArray(replay.script)&&replay.script.length>0,
  replay?`${replay.title} / ${replay.script.length}行`:'なし');

// ① 数が合っているか
const reward=event?O.rhythmEventParticipationReward(event):null;
check('参加賞に勇者の証が入っている',!!reward&&reward.heroProof>0,JSON.stringify(reward));
{
  const lines=(A.ASSISTANT_MONBEAT_CUP_THANKS||[]).map(l=>l&&l.t||'').join('\n');
  const said=[...lines.matchAll(/勇者の証を?(\d+)個/g)].map(m=>Number(m[1]));
  check('会話で数を言っている',said.length>0,said.join(' / '));
  check('会話で言う数と実際に配る数が同じ',
    said.length>0&&said.every(n=>n===(reward&&reward.heroProof)),
    `会話 ${said.join('/')} ／ 実際 ${reward&&reward.heroProof}`);
  // 参加賞の条件(3曲)も会話と合っていること
  const songsSaid=[...lines.matchAll(/(\d+)曲ぜんぶ/g)].map(m=>Number(m[1]));
  check('会話で言う条件(何曲)と実際が同じ',
    songsSaid.length===0||songsSaid.every(n=>n===(reward&&reward.songs)),
    `会話 ${songsSaid.join('/')} ／ 実際 ${reward&&reward.songs}`);
}
// 2026-09-14: アイテム欄へ直接入れるのをやめ、ギフトで届ける形にした
check('勇者の証は参加賞のぶんだけギフトへ入る(入賞報酬は触っていない)',
  /join\.heroProof>0&&typeof HERO_PROOF_ITEM!=='undefined'\)add\(GIFT_ITEM_REWARD_TYPE,HERO_PROOF_ITEM\.id,join\.heroProof\)/.test(shared)
  &&!/entry\.reward\.heroProof/.test(shared));
check('画面の参加賞の文にも出る',/reward\.heroProof>0/.test(shared));
check('勇者の証を書いていないイベントでは0になる(既存の形をそのまま読める)',(()=>{
  const r=O.rhythmEventParticipationReward({kind:'limited',songIds:['a','b','c'],
    participationReward:{songs:3,gold:100,psyche:10}});
  return !!r&&r.heroProof===0;
})());

// ② 終了時刻に自動で流れるか
{
  const endMs=O.rhythmEventTimeMs(event&&event.endAt);
  check('終了の直前はまだ「終わった直後」にならない',O.rhythmLimitedEventJustEnded(endMs-1)===null);
  check('終了ちょうどで「終わった直後」になる',(O.rhythmLimitedEventJustEnded(endMs)||{}).id===EVENT_ID);
  // ★null ではなく「この回が返らないこと」で見る。イベントが増えると、
  //   この回の期限が切れたあとは**別の回**が返るため(2026-09-17に第2回を足して実際にそうなった)
  check('受取期限(2週間)を過ぎたらもう流さない',
    (O.rhythmLimitedEventJustEnded(endMs+O.RHYTHM_EVENT_REWARD_CLAIM_MS)||{}).id!==EVENT_ID
    &&(O.rhythmLimitedEventJustEnded(endMs+O.RHYTHM_EVENT_REWARD_CLAIM_MS-1000)||{}).id===EVENT_ID);
  check('開催中は流さない',O.rhythmLimitedEventJustEnded(endMs-3600000)===null
    &&!!O.rhythmLimitedEventAt(endMs-3600000));
  check('壊れた値でも落ちない',
    O.rhythmLimitedEventJustEnded(null)===null&&O.rhythmLimitedEventJustEnded('あ')===null);
}
check('1分おきの見回りで流す(読み込み時に1回だけ決まる値を使っていない)',
  /rhythmLimitedEventsJustEnded\(Date\.now\(\)\)/.test(app)
  &&app.includes('setInterval(look, 60000)')
  &&(app.match(/rhythmLimitedEventsJustEnded\(Date\.now\(\)\)/g)||[]).length>=2);
// ★終わった直後の回は**全部**見る(2026-09-20)。単数で1件だけ引くと、受取期限(2週間)が
//   重なっているあいだ前の回が返り続け、新しい回の閉幕の会話が何日も出てこない。
//   第2回の終了時(2026-09-21 04:00)は第1回もまだ期限内で、実際に8日間出てこない形だった
check('閉幕の会話は、終わった回を全部見てから選ぶ',
  /rhythmLimitedEventsJustEnded\(Date\.now\(\)\)\s*\n?\s*\.map\(rhythmEventThanksStoryIdFor\)\.find\(/.test(app)
  &&(app.match(/\.map\(rhythmEventThanksStoryIdFor\)\.find\(/g)||[]).length>=2);
{
  check('終わった直後の回を全部返す仕組みがある',typeof O.rhythmLimitedEventsJustEnded==='function',
    O.rhythmLimitedEventsJustEnded?'rhythmLimitedEventsJustEnded':'data/rhythm-event.js に無い');
  if(typeof O.rhythmLimitedEventsJustEnded==='function'){
  const ends=(O.RHYTHM_EVENTS||[]).filter(e=>e&&e.kind==='limited')
    .map(e=>({id:e.id,endMs:O.rhythmEventTimeMs(e.endAt)})).filter(e=>e.endMs!==null);
  check('終わった直後の一覧は、新しく終わった回が先頭に来る',
    ends.every(e=>{
      const list=O.rhythmLimitedEventsJustEnded(e.endMs)||[];
      return list.length>0&&list[0].id===e.id;
    }),ends.map(e=>`${e.id}→${(O.rhythmLimitedEventsJustEnded(e.endMs)[0]||{}).id}`).join(' / '));
  check('開催中は一覧に入らない',(O.rhythmLimitedEventsJustEnded(ends[0].endMs-3600000)||[]).every(e=>e.id!==ends[0].id));
  check('壊れた値でも落ちない',
    Array.isArray(O.rhythmLimitedEventsJustEnded(null))&&Array.isArray(O.rhythmLimitedEventsJustEnded('あ')));
}
}
// ★閉幕の会話はイベントidから引く(RHYTHM_EVENT_THANKS_STORY_BY_EVENT)。
//   用意していない回では流さないので、直書きではなく変数で渡している
check('起動したときにも見る(終わったあとに初めて開いた人へ)',
  /rhythmLimitedEventsJustEnded\(Date\.now\(\)\)[\s\S]{0,300}setRhythmEventStoryPending\(bootThanksId\)/.test(app));
check('閉幕の会話をイベントidから引いている(ほかの回の終了で流さない)',
  app.includes('RHYTHM_EVENT_THANKS_STORY_BY_EVENT')
  && new RegExp(`RHYTHM_EVENT_THANKS_STORY_BY_EVENT = \\{ \\[MONBEAT_CUP_EVENT_ID\\]: MONBEAT_CUP_THANKS_STORY_ID`).test(app));
// ★これを書き忘れると、閉幕の会話が**永久に既読にならず**、起動のたびに流れ続ける。
//   しかも受け取り画面が会話待ちのまま出なくなる(2026-09-14に実際にこの形で書いていた)
// ★一覧は会話を足すたびに増える。「開催と閉幕の両方が入っていること」だけを見る
check('会話を最後まで見たら「見た」として記録する',
  /const RHYTHM_EVENT_STORY_IDS = \[[^\]]*\bMONBEAT_CUP_STORY_ID\b[^\]]*\bMONBEAT_CUP_THANKS_STORY_ID\b[^\]]*\];/.test(app)
  &&/RHYTHM_EVENT_STORY_IDS\.includes\(event\.id\)&&!eventReplay\.debug\) void markRhythmEventStorySeen\(event\.id\)/.test(app));
check('飛ばしたときも本編なら「見た」にする(起動のたびに出ない)',
  /eventReplay\.live&&!eventReplay\.debug&&event&&RHYTHM_EVENT_STORY_IDS\.includes\(event\.id\)\) void markRhythmEventStorySeen\(event\.id\)/.test(app));
check('特定の会話IDを決め打ちで記録していない(会話を足したときの書き忘れよけ)',
  !/markRhythmEventStorySeen\(MONBEAT_CUP_STORY_ID\)/.test(app));
check('デバッグから閉幕の会話を確かめられる(既読にはしない)',
  /const debugPlayRhythmEventThanks = \(\) =>/.test(app)
  &&/id: MONBEAT_CUP_THANKS_STORY_ID, step: 0, live: true, debug: true/.test(app)
  &&app.includes('data-debug-rhythm-event-thanks'));
check('見たかどうかは既存の保存キーの中(新しいキーを作っていない)',
  app.includes("const RHYTHM_EVENT_STORY_KEY = 'mh_rhythm_event_story_v1';")
  &&!/mh_.*thanks/.test(app));

// ③ 会話が先、受け取りはあと
// ★2026-09-20、回ごとの直書きをやめた。閉幕の会話を持つ回が増えても同じ形で待たせる
check('会話を見るまで受け取り画面を出さない(回ごとに直書きしない)',
  /const pendingThanksId = rhythmEventThanksStoryIdFor\(weekly \? null : event\);/.test(app)
  &&/if \(pendingThanksId[\s\S]{0,200}includes\(pendingThanksId\)\) return;/.test(app));
check('会話を見終えたら受け取りを確かめ直す',
  /thanksIds\.some\(id => rhythmEventStorySeen\.includes\(id\)\)/.test(app)
  &&/rhythmEventRewardCheckedRef\.current = false;[\s\S]{0,80}checkRhythmEventRewards\(\)/.test(app));
check('ほかのイベントの受け取りは待たせない',app.includes("const MONBEAT_CUP_EVENT_ID = 'weekend_2026_09_11';"));

// ④ 会話の作り
{
  const script=A.ASSISTANT_MONBEAT_CUP_THANKS||[];
  const who=new Set(script.map(l=>l&&l.who));
  check('3人とも話している',['mua','kiki','momosuke'].every(id=>who.has(id)),[...who].join(' / '));
  check('全部の行に話し手・表情・本文がある',
    script.every(l=>l&&typeof l.who==='string'&&typeof l.e==='string'&&typeof l.t==='string'&&l.t.length>0));
  check('呼び名で「{name}」を使っている(さん付け・呼び捨てに置き換わる)',
    script.some(l=>l&&l.t.includes('{name}')));
  check('会話の中だけの呼び名が用意してある',!!replay&&!!replay.calls
    &&['mua','kiki','momosuke'].every(id=>typeof replay.calls[id]==='string'));
  check('BGMの場面が決まっている',/monbeat_cup_2026_09_thanks:'[a-zA-Z]+'/.test(bgm));
  check('回想の解放フラグが本体側で解決されている',app.includes('monbeatCupThanksSeen:'));
  check('正式名称で書いている(略称だけで済ませていない)',(()=>{
    const text=script.map(l=>l&&l.t||'').join('');
    return !text.includes('モンビー')||text.includes('モンヒロビート');
  })());
}


// ===== ここから下は「閉幕の会話を持つ回ぜんぶ」を見る(2026-09-20) =====
// 上の節は第1回(週末ゲリラ杯)の作り込みを固定するためのもので、回ごとの事情が入っている。
// 共通の作り(台本・呼び名・BGM・回想・既読の記録)は、回が増えるたびに書き足さなくて
// よいようここでまとめて見る。★第2回を足したとき、閉幕の会話そのものが
// 用意されていないことに誰も気づけなかったのが、この節を作った理由。
{
  const table=(app.match(/const RHYTHM_EVENT_THANKS_STORY_BY_EVENT = \{([\s\S]*?)\};/)||[])[1]||'';
  const pairs=[...table.matchAll(/\[(\w+)\]:\s*(\w+)/g)].map(m=>[m[1],m[2]]);
  const idOfConst=name=>{
    const m=app.match(new RegExp(`const ${name} = '([^']+)';`));
    return m?m[1]:null;
  };
  check('閉幕の会話の対応表が読める',pairs.length>0,`${pairs.length}件`);
  // ★開催が終わった回に閉幕の会話が用意されているか。
  //   用意し忘れると、終わっても何も流れないまま静かに幕が下りる(第2回で実際にそうなった)。
  const limited=(O.RHYTHM_EVENTS||[]).filter(e=>e&&e.kind==='limited');
  const covered=new Set(pairs.map(([eventConst])=>idOfConst(eventConst)));
  const missing=limited.filter(e=>!covered.has(e.id));
  check('どの期間限定イベントにも閉幕の会話がある',missing.length===0,
    missing.length?missing.map(e=>e.id).join(' / '):`${limited.length}回ぶん`);

  for(const [eventConst,storyConst] of pairs){
    const eventId=idOfConst(eventConst),storyId=idOfConst(storyConst);
    const label=eventId||eventConst;
    const entry=(A.EVENT_REPLAYS||[]).find(e=>e&&e.id===storyId);
    check(`${label}: 閉幕の会話が回想の一覧にある`,!!entry&&Array.isArray(entry.script)&&entry.script.length>0,
      entry?`${entry.title} / ${entry.script.length}行`:`${storyId} が見つからない`);
    if(!entry)continue;
    const script=entry.script;
    const who=[...new Set(script.map(l=>l&&l.who))];
    check(`${label}: 全部の行に話し手・表情・本文がある`,
      script.every(l=>l&&typeof l.who==='string'&&typeof l.e==='string'&&typeof l.t==='string'&&l.t.length>0));
    check(`${label}: 呼び名で「{name}」を使っている`,script.some(l=>l&&l.t.includes('{name}')),
      `${script.filter(l=>l&&l.t.includes('{name}')).length}行`);
    check(`${label}: 出てくる助手ぜんぶに会話の中の呼び名がある`,
      !!entry.calls&&who.every(id=>typeof entry.calls[id]==='string'),
      who.join(' / '));
    check(`${label}: BGMの場面が決まっている`,new RegExp(`${storyId}:'[a-zA-Z]+'`).test(bgm));
    check(`${label}: 回想の解放フラグが本体側で解決されている`,
      !!entry.unlockedKey&&app.includes(`${entry.unlockedKey}:`),String(entry.unlockedKey));
    check(`${label}: 見終えたら「見た」として記録する一覧に入っている`,
      new RegExp(`const RHYTHM_EVENT_STORY_IDS = \\[[^\\]]*\\b${storyConst}\\b`).test(app));
    check(`${label}: 正式名称で書いている(略称だけで済ませていない)`,(()=>{
      const text=script.map(l=>l&&l.t||'').join('');
      return !text.includes('モンビー')||text.includes('モンヒロビート');
    })());
    // 会話で数を言うなら、実際に配る数と同じであること(第1回で踏んだ形)
    const reward=(()=>{const e=(O.RHYTHM_EVENTS||[]).find(x=>x&&x.id===eventId);
      return e?O.rhythmEventParticipationReward(e):null;})();
    const text=script.map(l=>l&&l.t||'').join('\n');
    const songsSaid=[...text.matchAll(/(\d+)曲/g)].map(m=>Number(m[1]));
    check(`${label}: 会話で言う曲数と実際の参加賞の条件が同じ`,
      songsSaid.length===0||songsSaid.every(n=>n===(reward&&reward.songs)),
      `会話 ${songsSaid.join('/')||'—'} ／ 実際 ${reward&&reward.songs}`);
    const proofSaid=[...text.matchAll(/勇者の証を?(\d+)個/g)].map(m=>Number(m[1]));
    check(`${label}: 会話で言う勇者の証の数と実際が同じ`,
      proofSaid.length===0||proofSaid.every(n=>n===(reward&&reward.heroProof)),
      `会話 ${proofSaid.join('/')||'言っていない'} ／ 実際 ${reward&&reward.heroProof}`);
  }
}

// --- 案内 ---
check('ヘルプに書いてある',/title:'イベントが終わったときの会話'/.test(helpSrc)
  &&helpSrc.includes('勇者の証が付くこともあります'));
// ★先頭◯文字で探さない。更新履歴は先頭に足していくので、あとから項目が増えると
//   同じ検査が「無くなった」と言い出す(2026-09-14に実際に落ちた)。項目の題で探す
const THANKS_ENTRY_TITLE = '【週末ゲリラ杯】お礼として、参加賞に勇者の証を10個追加しました';
check('更新履歴に書いてある',changelog.includes(THANKS_ENTRY_TITLE));
check('更新履歴は終了時刻まで出さない(会話と同時に出はじめる)',(()=>{
  const at=changelog.indexOf(THANKS_ENTRY_TITLE);
  if(at<0)return false;
  // その項目の中だけを見る。次の項目(先頭が「  {」)まで
  const rest=changelog.slice(at);
  const end=rest.indexOf('\n  {');
  const entryText=rest.slice(0,end<0?1200:end);
  const from=(entryText.match(/visibleFrom:'([^']+)'/)||[])[1];
  return from===String(event&&event.endAt);
})(),`イベントの終了 ${event&&event.endAt}`);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
