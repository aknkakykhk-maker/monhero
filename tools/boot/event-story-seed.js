// 起動したとたんに流れる「イベントの会話」を、検査では見終わったことにする。
//
//   const { eventStorySeed } = require('../boot/event-story-seed');
//   await page.addInitScript(eventStorySeed());   // ← 起動前に入れる
//
// モンヒロビートのイベントには「開幕」と「閉幕とお礼」の会話があり、**閉幕は終了の時刻に
// 自動で流れる**(60-app.jsx の rhythmEventThanksStoryIdFor)。34ステップの会話が
// 画面いっぱいに出るので、実ブラウザの検査はそこで進めなくなる。
// 2026-09-20 に第2回「異世界交響祭」が終わったとき、これで6本が一度に落ちた。
//
// ★会話idを検査へ書き写さない。本体の RHYTHM_EVENT_STORY_IDS から読む。
//   書き写すと、次のイベントを足したときにまた同じことが起きる
//   (実際、各検査が第1回のidだけを直書きしていたため第2回で落ちた)。
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..', '..', 'monster-hero/src/parts/60-app.jsx');

const readSource = () => fs.readFileSync(APP, 'utf8');

// 「const ◯◯_STORY_ID = '…';」から id を引く
const idOf = (source, name) => {
  const hit = source.match(new RegExp(`const ${name} = '([^']+)'`));
  return hit ? hit[1] : null;
};

// 本編で流す会話のid一覧(開幕・閉幕の両方)
const eventStoryIds = () => {
  const source = readSource();
  const names = (source.match(/const RHYTHM_EVENT_STORY_IDS = \[([^\]]*)\]/) || [])[1] || '';
  const ids = names.split(',').map(s => s.trim()).filter(Boolean)
    .map(name => idOf(source, name)).filter(Boolean);
  if (!ids.length) throw new Error('RHYTHM_EVENT_STORY_IDS を読めませんでした(本体の書き方が変わった可能性)');
  return ids;
};

// 会話の既読を入れる保存キー。本体から引く(名前を変えられても検査が気づく)
const eventStoryKey = () => {
  const key = (readSource().match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1];
  if (!key) throw new Error('RHYTHM_EVENT_STORY_KEY を読めませんでした');
  return key;
};

// addInitScript へそのまま渡せる形。ページの中では引数だけを使う(この外の変数は見えない)
const eventStorySeed = () => ({
  content: `(() => { try { localStorage.setItem(${JSON.stringify(eventStoryKey())}, ${JSON.stringify(JSON.stringify(eventStoryIds()))}); } catch (e) {} })();`,
});

module.exports = { eventStoryIds, eventStoryKey, eventStorySeed };
