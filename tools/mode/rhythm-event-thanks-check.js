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
  +'rhythmLimitedEventAt,rhythmLimitedEventJustEnded,rhythmEventTimeMs};',ctx);
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
check('配るのは参加賞のぶんだけ(入賞報酬は触っていない)',
  /if \(prize\.participation\.heroProof > 0\)/.test(app)
  &&/next\[HERO_PROOF_ITEM_ID\] = ownedItemCount\(next, HERO_PROOF_ITEM_ID\) \+ prize\.participation\.heroProof/.test(app));
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
  check('受取期限(2週間)を過ぎたらもう流さない',
    O.rhythmLimitedEventJustEnded(endMs+O.RHYTHM_EVENT_REWARD_CLAIM_MS)===null
    &&(O.rhythmLimitedEventJustEnded(endMs+O.RHYTHM_EVENT_REWARD_CLAIM_MS-1000)||{}).id===EVENT_ID);
  check('開催中は流さない',O.rhythmLimitedEventJustEnded(endMs-3600000)===null
    &&!!O.rhythmLimitedEventAt(endMs-3600000));
  check('壊れた値でも落ちない',
    O.rhythmLimitedEventJustEnded(null)===null&&O.rhythmLimitedEventJustEnded('あ')===null);
}
check('1分おきの見回りで流す(読み込み時に1回だけ決まる値を使っていない)',
  /rhythmLimitedEventJustEnded\(Date\.now\(\)\)/.test(app)
  &&app.includes('setInterval(look, 60000)')
  &&(app.match(/rhythmLimitedEventJustEnded\(Date\.now\(\)\)/g)||[]).length>=2);
check('起動したときにも見る(終わったあとに初めて開いた人へ)',
  /rhythmLimitedEventJustEnded\(Date\.now\(\)\)[\s\S]{0,200}setRhythmEventStoryPending\(MONBEAT_CUP_THANKS_STORY_ID\)/.test(app));
check('見たかどうかは既存の保存キーの中(新しいキーを作っていない)',
  app.includes("const RHYTHM_EVENT_STORY_KEY = 'mh_rhythm_event_story_v1';")
  &&!/mh_.*thanks/.test(app));

// ③ 会話が先、受け取りはあと
check('会話を見るまで受け取り画面を出さない',
  /event\.id === MONBEAT_CUP_EVENT_ID[\s\S]{0,200}includes\(MONBEAT_CUP_THANKS_STORY_ID\)\) return;/.test(app));
check('会話を見終えたら受け取りを確かめ直す',
  /rhythmEventStorySeen\.includes\(MONBEAT_CUP_THANKS_STORY_ID\)/.test(app)
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

// --- 案内 ---
check('ヘルプに書いてある',/title:'イベントが終わったときの会話'/.test(helpSrc)
  &&helpSrc.includes('勇者の証が付くこともあります'));
check('更新履歴に書いてある',/勇者の証を10個追加/.test(changelog.slice(0,3000)));
check('更新履歴は終了時刻まで出さない(会話と同時に出はじめる)',(()=>{
  const head=changelog.slice(0,3000);
  const at=head.indexOf('勇者の証を10個追加');
  const around=head.slice(Math.max(0,at-600),at+600);
  const from=(around.match(/visibleFrom:'([^']+)'/)||[])[1];
  return from===String(event&&event.endAt);
})(),`イベントの終了 ${event&&event.endAt}`);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
