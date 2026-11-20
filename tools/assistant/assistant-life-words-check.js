// 助手ライフの言葉の表(data/assistants.js の ASSISTANT_LIFE_WORDS・docs/spec/ASSISTANT_LIFE.md §3・段2)を見張る。ブラウザは使わない。
//   node tools/assistant/assistant-life-words-check.js
//   ① 表の形: 場所・動き4つ・値5つ・戻るの言葉がそろっている
//   ② 場所: 台本の言葉(ASSISTANT_LIFE_PLACES)と同じ id・同じ line。画面の名前は施設の正式名称
//   ③ 部品: 地図の絵文字・画面の名前・体の札の名前は表から引いている(別の表を手で書かない)
//   ④ 画面の文: 場所の名前を出す所で台本の言葉(ASSISTANT_LIFE_PLACES[...])を直接出していない
//   ⑤ 時間の呼び名: 5つの呼び名はゲーム全体の時間帯(TIME_OF_DAY_SLOTS)から引く
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const ctx = vm.createContext({ console, Object, Array, JSON, Math, Number, String });
vm.runInContext(read('monster-hero/data/assistants.js'), ctx);
const W = vm.runInContext('ASSISTANT_LIFE_WORDS', ctx);
const life = read('monster-hero/src/parts/56-assistant-life.jsx');
const placesSrc = life.match(/^const ASSISTANT_LIFE_PLACES = Object\.freeze\(\{[\s\S]*?^\}\);/m);
const LINES = placesSrc ? vm.runInNewContext(placesSrc[0].replace(/^const ASSISTANT_LIFE_PLACES = /, '(').replace(/;\s*$/, '') + ')') : {};

// ① 表の形
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
check('① 表がある(places・actions・values・nav)', !!(W && W.places && W.actions && W.values && W.nav));
check('① 動きは 見る・話す・贈る・誘う の4つ', ['see', 'talk', 'give', 'invite'].map(k => W.actions[k] && W.actions[k].show).join('・') === '見る・話す・贈る・誘う');
check('① 値は 💗仲良し度・🤝友情Lv・🌡調子・🐾マスモン・🏠おなじみ度', ['bond', 'peer', 'mood', 'masmon', 'friend'].map(k => W.values[k] && `${W.values[k].icon}${W.values[k].show}`).join('・') === '💗仲良し度・🤝友情Lv・🌡調子・🐾マスモン・🏠おなじみ度');
check('① 戻るは「← 戻る」と「✕」の2つ', W.nav.back === '← 戻る' && W.nav.close === '✕');
const avoidAll = [...W.actions.avoid, ...Object.values(W.values).flatMap(v => v.avoid), ...W.nav.avoid];
const showAll = [...Object.values(W.places).map(p => p.show), ...['see', 'talk', 'give', 'invite'].map(k => W.actions[k].show), ...Object.values(W.values).map(v => v.show), W.nav.back];
check('① 使わない言い方が、使う名前と重なっていない', avoidAll.every(a => !showAll.includes(a)), avoidAll.filter(a => showAll.includes(a)).join('・'));

// ② 場所
const ids = Object.keys(W.places);
const lineIds = Object.keys(LINES);
check('② 台本の言葉の場所がすべて表にある', lineIds.every(id => W.places[id]), lineIds.filter(id => !W.places[id]).join('・'));
check('② 表の場所は 名前・絵文字・台本の言葉がそろっている', ids.every(id => nonEmpty(W.places[id].show) && nonEmpty(W.places[id].icon) && nonEmpty(W.places[id].line)));
const lineNg = lineIds.filter(id => W.places[id] && W.places[id].line !== LINES[id]);
check('② 台本の言葉が ASSISTANT_LIFE_PLACES と同じ', lineNg.length === 0, lineNg.map(id => `${id}: ${W.places[id].line}≠${LINES[id]}`).join(' / '));
const OFFICIAL = { studio: 'モンヒロビート', ranch: 'M/B管理', cardroom: 'MFバトルカード', battle: 'モンヒロバトル', home: 'みんなの家' };
const offNg = Object.entries(OFFICIAL).filter(([id, name]) => !W.places[id] || W.places[id].show !== name);
check('② 遊び場は施設の正式名称で出す(練習スタジオ・育成場・カード部屋は台詞だけ)', offNg.length === 0, offNg.map(([id]) => id).join('・'));
const shows = ids.map(id => W.places[id].show);
check('② 画面の名前が重ならない(1つの場所に1つの名前)', new Set(shows).size === shows.length);

// ③ 部品が表から引いている
const house = read('monster-hero/src/parts/56-assistant-life-house.jsx');
const body = read('monster-hero/src/parts/56-assistant-life-body.jsx');
check('③ 地図の絵文字(ASSISTANT_LIFE_PLACE_ICON)は表から', /const ASSISTANT_LIFE_PLACE_ICON = Object\.freeze\(Object\.fromEntries\(Object\.entries\(assistantLifeWordsPlaces\(\)\)/.test(house));
check('③ 画面の名前(ASSISTANT_LIFE_PLACE_SHOW)は表から', /const ASSISTANT_LIFE_PLACE_SHOW = Object\.freeze\(Object\.fromEntries\(Object\.entries\(assistantLifeWordsPlaces\(\)\)/.test(house));
check('③ 体の札の名前(ASSISTANT_LIFE_BODY_LABEL)は表から', /const ASSISTANT_LIFE_BODY_LABEL = [^\n]*ASSISTANT_LIFE_WORDS\.places/.test(body));

// ④ 画面の文で台本の言葉を直接出していない
//    ASSISTANT_LIFE_PLACES[...] を使ってよいのは、台本の穴を埋める所・中身の確かめ・予備の答えだけ。ここに無い使い方が増えたら NG
const ALLOW = [
  /typeof ASSISTANT_LIFE_PLACES !== 'undefined' && ASSISTANT_LIFE_PLACES\[/, // 中身の確かめ(フレンド・予定)
  /\.replace\(\/\\\{place\\\}\/g/, // 台本の穴
  /\.replace\(\/\\\{want\\\}\/g/,
  /: ASSISTANT_LIFE_PLACES\[(p|k)\]\)/, // 予備の答え
  /\[ASSISTANT_LIFE_PLACES\[k\], ASSISTANT_LIFE_PLACES\[k\]\]/,
  /ASSISTANT_LIFE_PLACE_SHOW\[place\] \|\| ASSISTANT_LIFE_PLACES\[place\]/,
  /&& ASSISTANT_LIFE_PLACES\[(g|s)\.place\]/, // 保存の読み直し
  /if \(keys\.place && ASSISTANT_LIFE_PLACES\[keys\.place\]\)/,
  /const place = ASSISTANT_LIFE_PLACES\[c\.place\]/,
  /^const assistantLifeDescribe|out\.push\(`\$\{/, // 様子の1行(検査と見積もり用)
];
const partsDir = path.join(root, 'monster-hero/src/parts');
const bad = [];
for (const f of fs.readdirSync(partsDir).filter(f => /^56-assistant-.*\.jsx$/.test(f))) {
  read(`monster-hero/src/parts/${f}`).split('\n').forEach((l, i) => {
    if (!l.includes('ASSISTANT_LIFE_PLACES[')) return;
    if (!ALLOW.some(re => re.test(l))) bad.push(`${f}:${i + 1}`);
  });
}
check('④ 画面の文は assistantLifePlaceLabel で場所の名前を出す(台本の言葉を直接出さない)', bad.length === 0, bad.join(' '));

// ⑤ 時間の呼び名
check('⑤ 時間の呼び名は TIME_OF_DAY_SLOTS から引く(assistantLifeTimeNameOf)', /const assistantLifeTimeNameOf = [\s\S]{0,400}TIME_OF_DAY_SLOTS/.test(life));

console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
