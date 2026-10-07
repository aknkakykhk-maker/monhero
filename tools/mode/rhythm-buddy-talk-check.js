#!/usr/bin/env node
// 呼んだマスモンのおしゃべり(セリフ集と選び方)を確かめる。
//
//   node tools/mode/rhythm-buddy-talk-check.js
//
// 見張ること:
//   ・全部の場面に、9つの性格と5段階の調子と共通のセリフがそろっている(足りない組み合わせで黙り込まない)
//   ・どのセリフも40文字(チャットの上限)に収まる。曲名({song})が入る文は、10文字の曲名で入れても収まる
//   ・性格が決まる前(性格なし)・曲名なしでも、どの場面でも何か話せる
//   ・直近に言ったセリフは続けて選ばない。性格のセリフが調子や共通よりよく選ばれる
//   ・人のチャットへの返事の振り分け
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「おしゃべり」
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/33-rhythm-buddy-talk.jsx'), 'utf8');
const sb = { Math, Number, String, Array, Object, Set, console };
vm.createContext(sb);
vm.runInContext(`${src}\n;globalThis.__t={talk:RHYTHM_BUDDY_TALK,kinds:RHYTHM_BUDDY_TALK_KINDS,max:RHYTHM_BUDDY_TALK_MAX,pick:rhythmBuddyTalkPick,replyKind:rhythmBuddyTalkReplyKind};`, sb);
const T = sb.__t;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TRAITS = ['jester', 'brave', 'clingy', 'smart', 'serious', 'proud', 'worrier', 'stubborn', 'easygoing'];
const MOODS = ['great', 'good', 'normal', 'bad', 'awful'];

check('場面は16個', T.kinds.length === 16 && T.kinds.every((k) => T.talk[k]) && Object.keys(T.talk).length === 16);
const missing = [];
T.kinds.forEach((k) => {
  const set = T.talk[k];
  if (!Array.isArray(set.common) || set.common.length < 4) missing.push(`${k}:共通`);
  TRAITS.forEach((t) => { if (!Array.isArray(set.trait[t]) || set.trait[t].length < 2) missing.push(`${k}:${t}`); });
  MOODS.forEach((m) => { if (!Array.isArray(set.mood[m]) || set.mood[m].length < 1) missing.push(`${k}:${m}`); });
  Object.keys(set.trait).forEach((t) => { if (!TRAITS.includes(t)) missing.push(`${k}:知らない性格${t}`); });
  Object.keys(set.mood).forEach((m) => { if (!MOODS.includes(m)) missing.push(`${k}:知らない調子${m}`); });
});
check('どの場面にも、共通・9つの性格・5段階の調子のセリフがある', missing.length === 0, missing.slice(0, 6).join(' / '));

const all = [];
T.kinds.forEach((k) => {
  const set = T.talk[k];
  set.common.forEach((l) => all.push([k, l]));
  TRAITS.forEach((t) => (set.trait[t] || []).forEach((l) => all.push([k, l])));
  MOODS.forEach((m) => (set.mood[m] || []).forEach((l) => all.push([k, l])));
});
const long = all.filter(([, l]) => l.split('{song}').join('１２３４５６７８９０').length > T.max);
check('どのセリフも40文字に収まる(曲名は10文字で数える)', long.length === 0, long.slice(0, 3).map(([k, l]) => `${k}:${l}`).join(' / '));
const unique = new Set(all.map(([k, l]) => `${k}|${l}`));
check('同じ場面で同じセリフを2度書いていない', unique.size === all.length, `${all.length - unique.size}件の重複`);
check('セリフは全部で900以上(たくさん用意する)', all.length >= 900, `${all.length}`);
console.log(`   セリフの数: ${all.length}(場面ごと: ${T.kinds.map((k) => `${k}=${all.filter(([kk]) => kk === k).length}`).join(' ')})`);
check('「{」「}」が{song}以外に残っていない', all.every(([, l]) => !/[{}]/.test(l.split('{song}').join(''))));

// どの組み合わせでも話せる(性格なし・曲名なしでも)
let silent = [];
T.kinds.forEach((k) => ['', ...TRAITS].forEach((t) => MOODS.forEach((m) => {
  [{}, { song: 'テスト曲' }].forEach((vars) => { if (!T.pick({ kind: k, trait: t, moodId: m, vars, recent: [], rand: Math.random })) silent.push(`${k}/${t || '性格なし'}/${m}/${vars.song ? '曲名あり' : '曲名なし'}`); });
})));
check('性格なし・曲名なしを含め、どの場面・性格・調子でも何か話せる', silent.length === 0, silent.slice(0, 4).join(' / '));
check('知らない場面は黙る', T.pick({ kind: 'nope', trait: 'jester', moodId: 'good' }) === '');
// 曲名が長すぎて入らない文は使わない
const longSong = '１２３４５６７８９０１２３４５６７８９０１２３４５６７８９０１２３４';
const withLong = Array.from({ length: 200 }, () => T.pick({ kind: 'pick', trait: 'brave', moodId: 'good', vars: { song: longSong }, recent: [], rand: Math.random }));
check('曲名が長くて40文字を超える文は選ばない', withLong.every((t) => t && t.length <= T.max && !t.includes('{song}')));
check('曲名の文は、曲名を入れて返す', (() => { const t = T.pick({ kind: 'song', trait: '', moodId: 'normal', vars: { song: 'テスト曲' }, recent: [], rand: () => 0 }); return typeof t === 'string' && !t.includes('{'); })());

// 直近は避ける
let seq = []; let recent = [];
for (let i = 0; i < 30; i++) { const t = T.pick({ kind: 'join', trait: 'smart', moodId: 'good', vars: {}, recent, rand: Math.random }); seq.push(t); recent = [t, ...recent].slice(0, 8); }
check('直近8つに言ったセリフは続けて選ばない', seq.every((t, i) => !seq.slice(Math.max(0, i - 8), i).includes(t)), seq.slice(0, 3).join(' / '));
// 性格のセリフが選ばれやすい(重み3対調子2対共通1)
const counts = { trait: 0, mood: 0, common: 0 };
const set = T.talk.join;
for (let i = 0; i < 6000; i++) {
  const t = T.pick({ kind: 'join', trait: 'jester', moodId: 'good', vars: {}, recent: [], rand: Math.random });
  if (set.trait.jester.includes(t)) counts.trait++; else if (set.mood.good.includes(t)) counts.mood++; else if (set.common.includes(t)) counts.common++;
}
check('性格のセリフ > 調子のセリフ の順によく選ばれる(共通も混ざる)', counts.trait > counts.mood * 0.9 && counts.common > 0 && counts.mood > 0 && counts.trait > counts.common, JSON.stringify(counts));
check('性格が決まる前は、共通と調子のセリフだけ', (() => { const set2 = T.talk.mvp; for (let i = 0; i < 300; i++) { const t = T.pick({ kind: 'mvp', trait: '', moodId: 'bad', vars: {}, recent: [], rand: Math.random }); if (!set2.common.includes(t) && !set2.mood.bad.includes(t)) return false; } return true; })());
check('乱数が端(0や1)でも落ちない', ['join', 'bump'].every((k) => [0, 0.9999999, 1].every((r) => typeof T.pick({ kind: k, trait: 'proud', moodId: 'awful', vars: {}, recent: [], rand: () => r }) === 'string')));

// 返事の振り分け
const rk = T.replyKind;
const cases = [['マスモン入れて!', 'replyCall'], ['よろしく!', 'replyHello'], ['はじめまして!', 'replyHello'], ['ありがとう!', 'replyThanks'], ['ナイス!', 'replyNice'], ['すごい!', 'replyNice'],
  ['もう一回!', 'replyAgain'], ['ドンマイ!', 'replyDrop'], ['ちょっと待って!', 'replyWait'], ['おなかすいた', ''], ['', ''], [null, '']];
check('人のチャットへの返事の振り分け', cases.every(([text, want]) => rk(text) === want), cases.filter(([text, want]) => rk(text) !== want).map(([t]) => t).join(','));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
