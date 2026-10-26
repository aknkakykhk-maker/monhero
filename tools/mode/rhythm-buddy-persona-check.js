#!/usr/bin/env node
// マスモンの個体差(一人称・呼び方・口ぐせ・好きな曲/苦手な曲・叩き方のくせ・好物/趣味・誕生日)を確かめる。
//
//   node tools/mode/rhythm-buddy-persona-check.js
//
// 見張ること:
//   ・同じ子(同じ id・同じ性格)なら、何度決めても同じ値になる。id が違えば、同じ性格でもちゃんとばらける
//   ・性格と合わない組み合わせが出ない(真面目の子が「おれ」「呼び捨て」にならない など。表にあるものだけ)
//   ・性格ごとの呼び方の既定(RHYTHM_BUDDY_HONORIFICS)が、その性格の候補の先頭にある(性格の言葉づかいを崩さない)
//   ・個体差のセリフが、全部の場面・9つの性格にそろい、どの子の値を入れても40文字に収まるか、収まらなければ選ばれない
//   ・好き・苦手な曲は記録を読むだけで、渡したものを書き換えない
//   ・口ぐせは40文字を超えるときは付けない。誕生日は日本時間の暦の日付で判定する
//   ・個体差は保存キーを足さない(このファイルに mh_ の文字や localStorage が無い)
//   ・ウンディーネ種・ピクシー種(派生・レアを含む主血統)は女の子。一人称は女の子の言い方だけ。ほかの種・種を渡さないときは今までと1文字も変わらない(2026-10-16)
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「個体差」
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const personaSrc = read('33-rhythm-buddy-persona.jsx');
const sb = { Math, Number, String, Array, Object, Set, Date, console };
vm.createContext(sb);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/lineages.js'), 'utf8')}\n;globalThis.MONSTER_LINEAGE_MAP=MONSTER_LINEAGE_MAP;\n${read('33-rhythm-buddy-talk.jsx')}\n${personaSrc}\n;globalThis.__p={
  persona:rhythmBuddyPersona, songs:rhythmBuddyPersonaSongs, quirk:rhythmBuddyApplyQuirk, bday:rhythmBuddyIsBirthday,
  talk:RHYTHM_BUDDY_PERSONA_TALK, kinds:RHYTHM_BUDDY_PERSONA_KINDS, pick:rhythmBuddyTalkPick, hon:RHYTHM_BUDDY_HONORIFICS,
  self:RHYTHM_BUDDY_SELF_WORDS, calls:RHYTHM_BUDDY_CALLS, styles:RHYTHM_BUDDY_CALL_STYLES, quirks:RHYTHM_BUDDY_QUIRKS,
  selfF:RHYTHM_BUDDY_SELF_WORDS_FEMALE, gender:rhythmBuddyGenderOf, selfLine:rhythmBuddyPersonaSelf, map:MONSTER_LINEAGE_MAP,
  habits:RHYTHM_BUDDY_HABITS, foods:RHYTHM_BUDDY_FOODS, hobbies:RHYTHM_BUDDY_HOBBIES, base:RHYTHM_BUDDY_TALK };`, sb);
const P = sb.__p;
const screen0 = read('80-screen-rhythm-buddy.jsx');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TRAITS = ['jester', 'brave', 'clingy', 'smart', 'serious', 'proud', 'worrier', 'stubborn', 'easygoing'];
const ALL_T = ['', ...TRAITS];
const ids = Array.from({ length: 300 }, (_, i) => `masu_${i}_${(i * 7919).toString(36)}`);

// ---- 同じ子は同じ値・ばらける ----
const same = ALL_T.every((t) => ids.slice(0, 40).every((id) => JSON.stringify(P.persona(id, t)) === JSON.stringify(P.persona(id, t))));
check('同じ子(同じ id・同じ性格)なら、何度決めても同じ値', same);
const spread = (t, f) => new Set(ids.map((id) => f(P.persona(id, t)))).size;
const spreadNg = [];
ALL_T.forEach((t) => {
  if (spread(t, (p) => p.self) < P.self[t].length) spreadNg.push(`${t || '性格なし'}:一人称`);
  if (spread(t, (p) => p.call.id) < P.calls[t].length) spreadNg.push(`${t || '性格なし'}:呼び方`);
  if (spread(t, (p) => p.quirk.pre || p.quirk.end) < P.quirks[t].length) spreadNg.push(`${t || '性格なし'}:口ぐせ`);
});
if (spread('serious', (p) => p.habit.id) < P.habits.length) spreadNg.push('叩き方のくせ');
if (spread('serious', (p) => p.food) < P.foods.length || spread('serious', (p) => p.hobby) < P.hobbies.length) spreadNg.push('好物・趣味');
if (spread('serious', (p) => `${p.birthday.month}/${p.birthday.day}`) < 200) spreadNg.push('誕生日');
check('300体なら、どの候補もどれかの子に出る(同じ性格でもばらける)', spreadNg.length === 0, spreadNg.join(' / '));
const combos = new Set(ids.map((id) => { const p = P.persona(id, 'serious'); return `${p.self}|${p.call.id}|${p.quirk.pre || p.quirk.end}|${p.food}|${p.habit.id}`; })).size;
check('同じ性格(真面目)の300体で、話し方と好みの組み合わせが250通り以上にばらける', combos >= 250, `${combos}通り`);
check('性格なし・知らない性格は「性格なし」の候補から選ぶ', ids.slice(0, 50).every((id) => P.self[''].includes(P.persona(id, 'unknown').self) && P.calls[''].includes(P.persona(id, null).call.id)));

// ---- 性格と合わない組み合わせが出ない ----
const BAN = {
  serious: { self: ['おれ', 'オイラ', 'あたし', 'うち', 'わし', '拙者'], call: ['bare', 'boss', 'cchi', 'partner'] },
  smart: { self: ['おれ', 'オイラ', 'わし', '拙者'], call: ['bare', 'boss', 'cchi'] },
  clingy: { self: ['わし', '拙者', 'おれ'], call: ['bare', 'boss', 'sama', 'dono'] },
  stubborn: { self: ['あたし', 'うち', 'わたくし'], call: ['chan', 'cchi', 'lord'] },
  worrier: { self: ['おれ', 'わし', '拙者', 'オイラ'], call: ['bare', 'boss'] },
  proud: { self: ['うち', '拙者', 'オイラ'], call: ['lord', 'sama', 'master'] },
};
const banNg = [];
Object.keys(BAN).forEach((t) => ids.forEach((id) => {
  const p = P.persona(id, t);
  if (BAN[t].self.includes(p.self)) banNg.push(`${t}:${p.self}`);
  if (BAN[t].call.includes(p.call.id)) banNg.push(`${t}:${p.call.id}`);
}));
check('性格と合わない一人称・呼び方が出ない(真面目に「おれ」「呼び捨て」など)', banNg.length === 0, [...new Set(banNg)].slice(0, 6).join(' / '));
const quirkNg = [];
ALL_T.forEach((t) => ids.forEach((id) => { const q = P.persona(id, t).quirk; if (!P.quirks[t].some((x) => (x.pre || '') === (q.pre || '') && (x.end || '') === (q.end || ''))) quirkNg.push(t); }));
check('口ぐせは、その性格の表にあるものだけ(真面目に「…なんてね」は出ない)', quirkNg.length === 0 && !P.quirks.serious.some((q) => /なんてね/.test(q.end || '')), quirkNg.slice(0, 3).join(' / '));
check('性格ごとの呼び方の既定が、その性格の候補の先頭にある', TRAITS.every((t) => P.styles[P.calls[t][0]].suf === P.hon[t]) && P.styles[P.calls[''][0]].suf === 'さん');
check('呼び方の候補は、どれも表にある', ALL_T.every((t) => P.calls[t].every((c) => P.styles[c] && (typeof P.styles[c].suf === 'string' || P.styles[c].call))));
const firstShare = (t) => ids.filter((id) => P.persona(id, t).self === P.self[t][0]).length / ids.length;
check('一人称・呼び方は、その性格のいちばん多い形が出やすい', TRAITS.every((t) => firstShare(t) > 1 / P.self[t].length));

// ---- 個体差のセリフ ----
const lack = [];
P.kinds.forEach((k) => {
  const set = P.talk[k];
  if (!Array.isArray(set.common) || !set.common.length) lack.push(`${k}:共通`);
  TRAITS.forEach((t) => { if (!Array.isArray(set.trait[t]) || !set.trait[t].length) lack.push(`${k}:${t}`); });
});
check('個体差の場面(10個)に、共通と9つの性格のセリフがそろう', P.kinds.length === 10 && lack.length === 0, lack.slice(0, 6).join(' / '));
check('個体差の場面の名前が、もとの場面と重ならない', P.kinds.every((k) => !P.base[k]));
const longNg = [];
const SONG10 = 'あいうえおかきくけこ'; // 曲名は14文字まで、長いと短い名前で入る
TRAITS.forEach((t) => ids.slice(0, 60).forEach((id) => {
  const p = P.persona(id, t);
  P.habits.forEach((h) => P.kinds.forEach((k) => {
    const vars = { who: 'あいうえおかきくけこあい', self: p.self, call: p.call.call || '', hon: typeof p.call.suf === 'string' ? p.call.suf : 'さん',
      food: p.food, hobby: p.hobby, like: SONG10, dislike: SONG10, hg: h.good, hb: h.bad, ht: h.talk };
    const text = P.pick({ kind: k, trait: t, moodId: 'normal', vars, recent: [], rand: () => 0.5 });
    if (text.length > 40) longNg.push(`${k}:${text}`);
    if (/\{[A-Za-z]+\}/.test(text)) longNg.push(`穴が残る ${k}:${text}`);
  }));
}));
check('個体差のセリフは、どの子の値・長い名前でも40文字に収まる(穴も残らない)', longNg.length === 0, longNg.slice(0, 3).join(' / '));
const noVals = P.kinds.filter((k) => P.pick({ kind: k, trait: 'serious', moodId: 'normal', vars: { who: 'たろう' }, recent: [], rand: () => 0 }) !== '' && k !== 'pBday' && k !== 'pJoin');
check('値が無い(好きな曲が無いなど)ときは、その場面は黙る(言いかけの文を出さない)', noVals.length === 0, noVals.join(','));
const reachable = TRAITS.every((t) => P.kinds.every((k) => {
  const p = P.persona(ids[0], t);
  const vars = { who: 'たろう', self: p.self, call: '', hon: 'さん', food: p.food, hobby: p.hobby, like: 'ソング', dislike: 'ソング', hg: p.habit.good, hb: p.habit.bad, ht: p.habit.talk };
  return P.pick({ kind: k, trait: t, moodId: 'normal', vars, recent: [], rand: () => 0.9 }) !== '';
}));
check('どの性格でも、個体差の場面ごとに何か話せる', reachable);
const commonLeak = [];
TRAITS.forEach((t) => P.kinds.forEach((k) => { const p = P.persona(ids[1], t);
  const vars = { who: 'たろう', self: p.self, food: p.food, hobby: p.hobby, like: 'ソング', dislike: 'ソング', hg: p.habit.good, hb: p.habit.bad, ht: p.habit.talk };
  for (let i = 0; i < 20; i += 1) { const text = P.pick({ kind: k, trait: t, moodId: 'normal', vars, recent: [], rand: () => i / 20 });
    if (P.talk[k].common.some((c) => text === P.pick({ kind: k, trait: '', moodId: 'normal', vars, recent: [], rand: () => P.talk[k].common.indexOf(c) / P.talk[k].common.length }))) { commonLeak.push(`${t}:${text}`); break; } } }));
check('性格が決まった子は、個体差の場面で共通の文(砕けた言い方)を使わず、性格の文だけで話す', commonLeak.length === 0, commonLeak.slice(0, 3).join(' / '));
const callText = P.pick({ kind: 'pJoin', trait: 'serious', moodId: 'normal', vars: { who: 'あつ', self: 'わたし', call: 'マスター' }, recent: [], rand: () => 0 });
check('呼び方「マスター」の子は「{who}さん」を「マスター」で呼ぶ', callText.indexOf('マスター') === 0 && callText.indexOf('あつ') < 0, callText);
const selfText = P.pick({ kind: 'mvp', trait: 'proud', moodId: 'normal', vars: { self: 'わたくし' }, recent: [], rand: () => 0 });
const selfAll = P.base.mvp.trait.proud.some((x) => /私/.test(x));
check('既存のセリフの「私」「ぼく」も、その子の一人称で話す', !/私|ぼく/.test(selfText) && selfAll && TRAITS.every((t) => P.base.mvp.trait[t].every((_, i) => !/私|ぼく/.test(P.pick({ kind: 'mvp', trait: t, moodId: 'normal', vars: { self: 'おれ' }, recent: [], rand: () => i / 10 })))), selfText);
const untouched = P.pick({ kind: 'mvp', trait: 'proud', moodId: 'normal', vars: {}, recent: [], rand: () => 0 });
check('個体差を渡さなければ、これまでどおりの文', P.base.mvp.trait.proud.concat(P.base.mvp.mood.normal, P.base.mvp.common).includes(untouched));

// ---- D 好きな曲・苦手な曲(読むだけ) ----
const mon = {
  songs: { a: 12, b: 5, c: 4, d: 1 },
  recent: [
    { songId: 'b', score: 500, max: 1000 }, { songId: 'b', score: 600, max: 1000 }, { songId: 'c', score: 900, max: 1000 },
    { songId: 'a', score: 300, max: 1000 }, { songId: 'd', score: 10, max: 1000 },
  ],
};
const before = JSON.stringify(mon);
const fav = P.songs(mon);
check('好きな曲=いちばん多く遊んだ曲 / 苦手な曲=3回以上遊んだ曲のうち平均がいちばん低い曲(好きな曲とは別・1回だけの曲は入れない)', fav.like === 'a' && fav.dislike === 'b', JSON.stringify(fav));
check('好き・苦手な曲を決めても、渡した記録を書き換えない', JSON.stringify(mon) === before);
check('記録が無い・少ないときは、好き・苦手な曲は空', JSON.stringify(P.songs({})) === '{"like":"","dislike":""}' && P.songs({ songs: { a: 1 } }).like === ''
  && P.songs({ songs: { a: 5, b: 3 }, recent: [{ songId: 'b', score: 1, max: 10 }] }).dislike === '' && JSON.stringify(P.songs(null)) === '{"like":"","dislike":""}');
check('壊れた記録でも止まらない', (() => { try { P.songs({ songs: 'x', recent: [null, { songId: 'a', score: 'x', max: 0 }] }); return true; } catch (_) { return false; } })());

// ---- C 口ぐせ・G 誕生日 ----
check('口ぐせ(頭): 「よーし、」を頭に付ける', P.quirk('がんばります!', { pre: 'よーし、' }) === 'よーし、がんばります!');
check('口ぐせ(終わり): 終わりの「!」を外して付ける・問いかけには付けない', P.quirk('がんばろう!', { end: '♪' }) === 'がんばろう♪' && P.quirk('いいの?', { end: '♪' }) === 'いいの?');
check('口ぐせ: 40文字を超えるとき・「…」で始まる文には付けない', P.quirk('あ'.repeat(38), { pre: 'よーし、' }) === 'あ'.repeat(38) && P.quirk('…まあね', { pre: 'よーし、' }) === '…まあね');
const pb = { birthday: { month: 3, day: 1 } };
check('誕生日は日本時間の暦の日付(3/1 0:30 JST は当日・2/28 23:30 JST は前日)', P.bday(pb, Date.UTC(2026, 1, 28, 15, 30)) && !P.bday(pb, Date.UTC(2026, 1, 28, 14, 30)));
check('誕生日にうるう日(2/29)は出ない', ids.every((id) => { const b = P.persona(id, '').birthday; return !(b.month === 2 && b.day === 29) && b.month >= 1 && b.month <= 12 && b.day >= 1 && b.day <= 31; }));

// ---- 女の子の種(2026-10-16 社長「ウンディーネとピクシー種は明確に女個体」) ----
const FEMALE_BASES = Object.keys(P.map).filter((b) => ['pixie', 'undine'].includes(P.map[b].main));
const OTHER_BASES = Object.keys(P.map).filter((b) => !FEMALE_BASES.includes(b));
check('ピクシー種・ウンディーネ種(派生・レアを含む)が女の子になる', ['Pixie', 'Mia', 'Pandora', 'Undine', 'Yaobikuni', 'Snegurochka'].every((b) => FEMALE_BASES.includes(b) && P.gender(b) === 'female'),
  FEMALE_BASES.join(','));
check('ほかの種・知らない種・種なしは性別を決めない', OTHER_BASES.every((b) => P.gender(b) === '') && P.gender('NoSuchMon') === '' && P.gender(null) === '' && P.gender(undefined) === '');
const MASC = ['おれ', 'オイラ', 'ぼく', 'わし', '拙者', '自分'];
check('女の子の一人称の表に、男の子の言い方が無い・どの性格にも候補がある', ALL_T.every((t) => Array.isArray(P.selfF[t]) && P.selfF[t].length > 0 && P.selfF[t].every((w) => !MASC.includes(w))));
const femaleNg = [];
ALL_T.forEach((t) => FEMALE_BASES.forEach((b) => ids.slice(0, 60).forEach((id) => {
  const p = P.persona(id, t, b);
  if (p.gender !== 'female' || !P.selfF[t].includes(p.self)) femaleNg.push(`${b}/${t || '性格なし'}/${id}:${p.self}`);
})));
check('女の子の種の子は、どの性格でも一人称が女の子の言い方', femaleNg.length === 0, femaleNg.slice(0, 3).join(' / '));
check('女の子の種でも、一人称は性格ごとの候補がばらけて出る', ALL_T.every((t) => new Set(ids.map((id) => P.persona(id, t, 'Undine').self)).size === P.selfF[t].length));
const sameNg = [];
ALL_T.forEach((t) => OTHER_BASES.concat([null, 'NoSuchMon']).forEach((b) => ids.slice(0, 40).forEach((id) => {
  const a = P.persona(id, t), c = P.persona(id, t, b);
  if (JSON.stringify(a) !== JSON.stringify(c) || c.gender !== '') sameNg.push(`${b}/${t}`);
})));
check('ほかの種・種なしは、個体差が今までと1文字も変わらない', sameNg.length === 0, sameNg.slice(0, 3).join(' / '));
check('女の子の種でも、一人称以外(呼び方・口ぐせ・好物・趣味・誕生日・くせ)は今までと同じ', ALL_T.every((t) => ids.slice(0, 40).every((id) => {
  const a = P.persona(id, t), c = P.persona(id, t, 'Pixie');
  return a.call.id === c.call.id && JSON.stringify(a.quirk) === JSON.stringify(c.quirk) && a.food === c.food && a.hobby === c.hobby
    && JSON.stringify(a.birthday) === JSON.stringify(c.birthday) && a.habit.id === c.habit.id;
})));
check('セリフに直に書かれた「俺」なども、女の子の個体だけその子の一人称にする',
  P.selfLine('これが俺のやり方だ!', 'あたし', true) === 'これがあたしのやり方だ!' && P.selfLine('オイラも僕も拙者も私も', 'うち', true) === 'うちもうちもうちもうちも'
  && P.selfLine('これが俺のやり方だ!', 'おれ') === 'これが俺のやり方だ!' && P.selfLine('私とぼく', 'おれ') === 'おれとおれ');
{
  const vars = { who: 'たろう', self: 'あたし', female: true };
  const all = [];
  Object.keys(P.base).forEach((kind) => { for (let i = 0; i < 40; i++) all.push(P.pick({ kind, trait: 'stubborn', vars, rand: () => i / 40 })); });
  check('女の子の個体(頑固)のセリフに「俺」「オイラ」「僕」「拙者」が出ない', all.every((t) => !/俺|オイラ|僕|拙者/.test(t)));
}
check('詳細画面: 女の子の種だけ「性別 女の子」を出し、セリフにも種を渡す',
  /\.\.\.\(persona\.gender === 'female' \? \[\['gender', '性別', '女の子'\]\] : \[\]\)/.test(screen0)
  && /rhythmBuddyPersona\(masu\.id, m\.trait, masu\.baseId\)/.test(screen0) && /rhythmBuddyPersona\(masuId, norm\.trait, baseId\)/.test(screen0)
  && /female: persona\.gender === 'female'/.test(screen0)
  && /cpuBrain\.talk\(\{ masuId: x\.masuId, baseId: c\.mb \|\| null,/.test(read('77-screen-rhythm-multi.jsx')));

// ---- 女の子用のセリフ(2026-10-16 社長「女の子用のセリフを足す」) ----
{
  const parts = ['33-rhythm-buddy-talk.jsx', '33-rhythm-buddy-convo.jsx', '33-rhythm-buddy-persona.jsx'].map(read).join('\n');
  const mk = (src) => { const c = { Math, Number, String, Array, Object, Set, Date, console }; vm.createContext(c);
    vm.runInContext(`${src}\n;globalThis.__q={ pick:rhythmBuddyTalkPick, T:RHYTHM_BUDDY_TALK, C:RHYTHM_BUDDY_CONVO, P:RHYTHM_BUDDY_PERSONA_TALK, F:RHYTHM_BUDDY_FEMALE_LINES };`, c); return c.__q; };
  const Q = mk(parts);
  // 表を空にした写し(女の子用のセリフを足す前と同じ動き)
  const Q0 = mk(parts.replace(/const RHYTHM_BUDDY_FEMALE_LINES = Object\.freeze\(\{[\s\S]*?\n\}\);/, 'const RHYTHM_BUDDY_FEMALE_LINES = Object.freeze({});'));
  const F = Q.F, keys = Object.keys(F);
  const traitLines = new Set();
  [Q.T, Q.C, Q.P].forEach((set) => Object.values(set).forEach((sc) => Object.values((sc && sc.trait) || {}).forEach((ls) => (ls || []).forEach((l) => traitLines.add(l)))));
  check(`女の子用の言い換えが100組以上あり、左はどれも実際にある性格のセリフ`, keys.length >= 100 && keys.every((k) => traitLines.has(k)), `${keys.length}組 / 無い: ${keys.filter((k) => !traitLines.has(k)).slice(0, 3).join(' / ')}`);
  const holes = (t) => (String(t).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
  check('言い換えの左右で、差し込み口({song} など)が同じ・右が空でない・40文字以内', keys.every((k) => holes(k) === holes(F[k]) && F[k].length > 0 && F[k] !== k && F[k].length <= 40),
    keys.filter((k) => holes(k) !== holes(F[k]) || !F[k] || F[k] === k || F[k].length > 40).slice(0, 3).join(' / '));
  check('言い換えの右に、男の子っぽい言い回し(ぞ・ぜ・俺・〜ん!・〜しろ)が無い', keys.every((k) => !/ぞ|ぜ|俺|オイラ|僕|拙者|[^な]ん[!。…]*$|しろ$|しとらん|せん[!ぞ]?$/.test(F[k])),
    keys.filter((k) => /ぞ|ぜ|俺|オイラ|僕|拙者|[^な]ん[!。…]*$|しろ$|しとらん|せん[!ぞ]?$/.test(F[k])).slice(0, 3).map((k) => F[k]).join(' / '));
  const kinds = [...new Set([...Object.keys(Q.T), ...Object.keys(Q.C), ...Object.keys(Q.P)])];
  const base = { who: 'たろう', me: 'ピク', mate: 'モノ', song: 'Monster', fav: 'Monster', lv: '12', score: '90万点', plays: '8', days: '3', trait: '勇敢', topic: 'Monster',
    like: 'Monster', dislike: 'Sheriruth', food: 'プリン', hobby: '歌', hg: '早めに入れた', hb: '急ぎすぎた', ht: 'つい早めに叩いちゃう', mood: '最高' };
  let femaleBad = [], otherDiff = [];
  TRAITS.forEach((t) => kinds.forEach((kind) => { for (let i = 0; i < 24; i++) {
    const r = () => i / 24;
    const fv = { ...base, self: 'あたし', female: true }, mv = { ...base, self: 'おれ' };
    const f = Q.pick({ kind, trait: t, moodId: 'normal', vars: fv, rand: r });
    if (keys.some((k) => k && f && f === k.replace(/\{who\}さん/g, 'たろう').replace(/\{([a-zA-Z]+)\}/g, (a, x) => (x === 'self' ? 'あたし' : base[x] || a)))) femaleBad.push(`${t}/${kind}:${f}`);
    const m1 = Q.pick({ kind, trait: t, moodId: 'normal', vars: mv, rand: r }), m0 = Q0.pick({ kind, trait: t, moodId: 'normal', vars: mv, rand: r });
    if (m1 !== m0) otherDiff.push(`${t}/${kind}:${m0}→${m1}`);
  } }));
  check('女の子の子は、言い換えの左(もとの男の子っぽいセリフ)を話さない', femaleBad.length === 0, femaleBad.slice(0, 3).join(' / '));
  check('ほかの子のセリフは、女の子用のセリフを足す前と1文字も変わらない(全場面・9性格)', otherDiff.length === 0, otherDiff.slice(0, 3).join(' / '));
  check('女の子の子(勇敢)は「勝負よ!」のような言い換えで話す', Q.pick({ kind: 'song', trait: 'brave', vars: { ...base, self: 'あたし', female: true }, rand: () => 0 }) !== ''
    && Object.values(F).includes('{song}で勝負よ!'));
  check('セリフを選ぶところで、女の子の子のときだけ言い換える', /if \(female && typeof RHYTHM_BUDDY_FEMALE_LINES !== 'undefined' && Object\.prototype\.hasOwnProperty\.call\(RHYTHM_BUDDY_FEMALE_LINES, raw\)\) raw = RHYTHM_BUDDY_FEMALE_LINES\[raw\];/.test(read('33-rhythm-buddy-talk.jsx'))
    && /const female = vars\.female === true;/.test(read('33-rhythm-buddy-talk.jsx')));
}

// ---- 保存しない ----
check('個体差は保存キーを足さない(mh_ の文字・localStorage が無い)', !/mh_[a-z]/.test(personaSrc.replace(/^\/\/.*$/gm, '')) && !/localStorage/.test(personaSrc));
const screen = read('80-screen-rhythm-buddy.jsx');
check('詳細画面にプロフィール(9項目)を出す', /data-rhythm-buddy-profile\b/.test(screen) && ['一人称', '呼び方', '口ぐせ', '好物', '趣味', '誕生日', '叩き方のくせ', '好きな曲', '苦手な曲'].every((w) => screen.includes(`'${w}'`)));
check('叩き方のくせは、演奏(rhythmBuddyPlay)に使わない', !/habit/.test(read('33-rhythm-buddy.jsx')));

console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
