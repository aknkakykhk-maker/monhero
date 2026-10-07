#!/usr/bin/env node
// 呼んだマスモンの会話(発言の読み取りと、セリフ集)を確かめる。
//
//   node tools/mode/rhythm-buddy-convo-check.js
//
// 見張ること:
//   ・全部の場面に、共通・9つの性格・5段階の調子のセリフがそろっている。穴({who}など)は知っているものだけ
//   ・どのセリフも40文字に収まる(名前・曲名は現実的な長さで入れる)
//   ・値(性格・得意な曲・スコアなど)がまだ無くても、どの場面でも何か言える(黙り込まない)
//   ・発言の読み取り: 意図・名前・「みんな」・曲名・質問か・聞き返しへの答え
//   ・「今日は元気!」のような、聞かれていない発言を質問と取り違えない
//   ・読み取りが重くならない(長い発言でも一瞬)
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「会話」
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const sb = { Math, Number, String, Array, Object, Set, console };
vm.createContext(sb);
vm.runInContext(`${read('33-rhythm-buddy-talk.jsx')}\n${read('33-rhythm-buddy-convo.jsx')}\n;globalThis.__c={convo:RHYTHM_BUDDY_CONVO,kinds:RHYTHM_BUDDY_CONVO_KINDS,talk:RHYTHM_BUDDY_TALK,pick:rhythmBuddyTalkPick,parse:rhythmBuddyConvoParse,rules:RHYTHM_BUDDY_CONVO_RULES,max:RHYTHM_BUDDY_TALK_MAX};`, sb);
const C = sb.__c;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TRAITS = ['jester', 'brave', 'clingy', 'smart', 'serious', 'proud', 'worrier', 'stubborn', 'easygoing'];
const MOODS = ['great', 'good', 'normal', 'bad', 'awful'];
const HOLES = ['who', 'me', 'lv', 'mood', 'trait', 'song', 'fav', 'score', 'days', 'plays', 'mate'];
const HON = { jester: 'っち', brave: '', clingy: 'ちゃん', smart: 'さん', serious: '様', proud: '', worrier: 'さん', stubborn: '', easygoing: 'さん' };

// ===== セリフ集 =====
check('会話の場面は39個', C.kinds.length === 39 && C.kinds.every((k) => C.convo[k]), String(C.kinds.length));
const missing = [];
C.kinds.forEach((k) => {
  const set = C.convo[k];
  if (!Array.isArray(set.common) || set.common.length < 4) missing.push(`${k}:共通`);
  TRAITS.forEach((t) => { if (!Array.isArray(set.trait[t]) || set.trait[t].length < 1) missing.push(`${k}:${t}`); });
  MOODS.forEach((m) => { if (!Array.isArray(set.mood[m])) missing.push(`${k}:${m}`); });
  Object.keys(set.trait).forEach((t) => { if (!TRAITS.includes(t)) missing.push(`${k}:知らない性格${t}`); });
  Object.keys(set.mood).forEach((m) => { if (!MOODS.includes(m)) missing.push(`${k}:知らない調子${m}`); });
});
check('どの場面にも、共通・9つの性格・調子の束がある', missing.length === 0, missing.slice(0, 5).join(' / '));
check('会話の場面の名前が、いままでのおしゃべりの場面と重ならない', C.kinds.every((k) => !(k in C.talk)), C.kinds.filter((k) => k in C.talk).join());
const all = [];
C.kinds.forEach((k) => {
  const set = C.convo[k];
  set.common.forEach((l) => all.push([k, l]));
  TRAITS.forEach((t) => (set.trait[t] || []).forEach((l) => all.push([k, l])));
  MOODS.forEach((m) => (set.mood[m] || []).forEach((l) => all.push([k, l])));
});
check('同じ場面で同じセリフを2度書いていない', new Set(all.map(([k, l]) => `${k}|${l}`)).size === all.length, `${all.length - new Set(all.map(([k, l]) => `${k}|${l}`)).size}件の重複`);
check('会話のセリフは600以上', all.length >= 600, String(all.length));
const talkTotal = (() => { let n = 0; Object.keys(C.talk).forEach((k) => { const x = C.talk[k]; n += x.common.length; TRAITS.forEach((t) => { n += (x.trait[t] || []).length; }); MOODS.forEach((m) => { n += (x.mood[m] || []).length; }); }); return n; })();
console.log(`   会話のセリフ: ${all.length} / 場面ごと: ${C.kinds.map((k) => `${k}=${all.filter(([kk]) => kk === k).length}`).join(' ')} / いままでのおしゃべり: ${talkTotal} / 合わせて ${all.length + talkTotal}`);
const badHole = [];
all.forEach(([k, l]) => { (l.match(/\{[^}]*\}/g) || []).forEach((h) => { if (!HOLES.includes(h.slice(1, -1))) badHole.push(`${k}:${l}`); }); });
check('穴は知っているもの({who}{me}{lv}{mood}{trait}{song}{fav}{score}{days}{plays}{mate})だけ', badHole.length === 0, badHole.slice(0, 3).join(' / '));
// 現実的な長さで入れて40文字以内(名前8字・曲名12字・ほか)
const REAL = { who: 'あいうえおかきく', me: 'あいうえおかきく', mate: 'あいうえおかきく', song: '１２３４５６７８９０１２', fav: '１２３４５６７８９０１２', lv: '100', mood: '超不機嫌', trait: 'プライドが高い', score: '100万点', days: '999', plays: '9999' };
const tooLong = all.filter(([, l]) => l.replace(/\{([a-z]+)\}/g, (a, key) => REAL[key]).length > C.max);
check('どのセリフも、現実的な長さの名前・曲名を入れて40文字に収まる', tooLong.length === 0, tooLong.slice(0, 3).map(([k, l]) => `${k}:${l}`).join(' / '));
const noBrace = all.filter(([, l]) => /[{}]/.test(l.replace(/\{[a-z]+\}/g, '')));
check('「{」「}」が穴以外に残っていない', noBrace.length === 0);

// ===== 選べる(どの値が無くても黙らない)=====
const NEED = { banter: ['mate'], qHow: ['who'], qFav: ['who'], songTalk: ['song'], nameAsk: ['me'], welcome: ['who'], farewell: ['who'], reactPick: ['who', 'song'], reactOmakase: ['who'], hMvp: ['who'], hHigh: ['who'], hLow: ['who'], hFull: ['who'], hQuit: ['who'], callOut: ['who'] };
const vars0 = {}; // 値がまだ何も無い(性格も得意な曲も決まっていない)
const silent = [];
C.kinds.forEach((k) => ['', ...TRAITS].forEach((t) => MOODS.forEach((m) => {
  const need = {}; (NEED[k] || []).forEach((h) => { need[h] = REAL[h]; });
  const vars = { ...vars0, ...need };
  if (!C.pick({ kind: k, trait: t, moodId: m, vars, recent: [], rand: Math.random })) silent.push(`${k}/${t || '性格なし'}/${m}`);
})));
check('値が無くても(必要な穴だけ渡せば)、どの場面・性格・調子でも何か言える', silent.length === 0, silent.slice(0, 4).join(' / '));
const allVars = {}; HOLES.forEach((h) => { allVars[h] = REAL[h]; });
let withVals = 0;
for (let i = 0; i < 400; i++) { const t = C.pick({ kind: 'lvAsk', trait: 'brave', moodId: 'good', vars: allVars, recent: [], rand: Math.random }); if (/100/.test(t)) withVals++; }
check('自分の育ち({lv}など)が、セリフに混ざる', withVals > 40, String(withVals));
check('値の無い穴の文は選ばない({fav}が無ければ、{fav}を使う文は出ない)', (() => { for (let i = 0; i < 300; i++) { const t = C.pick({ kind: 'favAsk', trait: 'brave', moodId: 'good', vars: {}, recent: [], rand: Math.random }); if (!t || /[{}]/.test(t) || /なら負けない/.test(t) && /{/.test(t)) return false; } return true; })());

// ===== 発言の読み取り =====
const names = ['モッチー', 'ハム'];
const songs = [{ id: 'sA', name: 'SIX ÉTERNEL' }, { id: 'sB', name: 'Stay With Me ～Locked Fate～ remix' }, { id: 'sC', name: 'MF × ICHIKA MIX' }];
const P = (text, extra = {}) => C.parse({ text, names, songs, ...extra });
const cases = [
  ['マスモン入れて!', 'replyCall'], ['マスモンいれてー', 'replyCall'], ['調子どう?', 'howMe'], ['モッチー元気?', 'howMe'], ['みんな調子どう', 'howMe'],
  ['レベルいくつ?', 'lvAsk'], ['ハムのLvは?', 'lvAsk'], ['好きな曲は?', 'favAsk'], ['モッチーの得意な曲ってなに', 'favAsk'], ['どんな性格?', 'traitAsk'],
  ['何点だった?', 'scoreAsk'], ['毎日来てるね?', 'daysAsk'], ['名前は?', 'nameAsk'], ['フルコンした!', 'fullcombo'], ['ミスした…', 'missTalk'],
  ['これむずい', 'hardTalk'], ['楽勝だった', 'easyTalk'], ['ドンマイ!', 'replyDrop'], ['もう一回やろ', 'replyAgain'], ['ちょっと待って', 'replyWait'],
  ['がんばろう!', 'cheer'], ['勝負しよう', 'challenge'], ['ごめんね', 'sorry'], ['ありがとう!', 'replyThanks'], ['かわいい', 'cute'],
  ['ナイス!', 'replyNice'], ['うまいね', 'replyNice'], ['ねむい', 'tired'], ['おなかすいた', 'hungry'], ['つらい', 'sad'], ['やった!', 'happy'],
  ['ｗｗｗ', 'laugh'], ['草', 'laugh'], ['またね', 'bye'], ['おつかれ!', 'bye'], ['よろしく!', 'replyHello'], ['はじめまして', 'replyHello'],
  ['今日は元気!', 'howGood'], ['調子わるい', 'howBad'], ['モッチー', 'hey'], ['ハム!', 'hey'], ['モッチーはどう思う?', 'dunno'], ['おなかすいたなぁ', 'hungry'],
];
const wrong = cases.filter(([text, kind]) => P(text).kind !== kind).map(([text, kind]) => `${text}→${P(text).kind}(期待${kind})`);
check(`発言の読み取り(${cases.length}例)`, wrong.length === 0, wrong.slice(0, 5).join(' / '));
check('聞かれていない「今日は元気!」を、調子の質問と取り違えない(howMe にならない)', P('今日は元気!').kind !== 'howMe' && P('今日は元気!').ask === '');
check('質問の形でも名前の呼びかけでもない「レベル」は、質問として読まない', P('レベル上げがんばろ').kind !== 'lvAsk');
check('どの意図にも当てはまらない発言は kind が空', ['ええと', 'うーん', '1234', 'あ', ''].every((t) => P(t).kind === ''), JSON.stringify(['ええと', 'うーん', '1234', 'あ', ''].map((t) => P(t).kind)));
check('名前を呼ばれたマスモンの添字が分かる', JSON.stringify(P('モッチー、調子どう?').mentioned) === '[0]' && JSON.stringify(P('ハムとモッチー、すごい').mentioned) === '[0,1]' && P('調子どう?').mentioned.length === 0);
check('「みんな」「全員」の呼びかけが分かる', P('みんなありがとう').all === true && P('全員おつかれ').all === true && P('ありがとう').all === false);
check('曲名を拾う(記号・大文字小文字・空白をそろえる)', P('six éternel いいよね').song && P('six éternel いいよね').song.id === 'sA' && P('ＳＩＸ　ÉＴＥＲＮＥＬ好き').song && P('MF×ICHIKA MIX 好き').song && P('MF×ICHIKA MIX 好き').song.id === 'sC');
check('曲名と感想が一緒なら、その曲の話として読む', P('SIX ÉTERNEL 好き').kind === 'songTalk' && P('SIX ÉTERNEL むずい').kind === 'songTalk' && P('SIX ÉTERNEL').kind === 'songTalk');
check('曲名があっても、強い質問(調子・レベルなど)は質問として読む', P('モッチー、SIX ÉTERNELのLvいくつ?').kind === 'lvAsk');
check('質問か(「?」「ですか」)', P('これ何?').isQuestion && P('いいですか').isQuestion && !P('ありがとう').isQuestion);
// 聞き返しへの答え
check('聞き返し(調子)への答え: いい', P('元気!', { awaiting: 'how' }).kind === 'howGood' && P('元気!', { awaiting: 'how' }).answered && P('まあまあかな', { awaiting: 'how' }).kind === 'howGood');
check('聞き返し(調子)への答え: わるい', P('ねむい', { awaiting: 'how' }).kind === 'howBad' && P('ちょっと疲れた', { awaiting: 'how' }).kind === 'howBad' && P('絶不調', { awaiting: 'how' }).kind === 'howBad');
check('聞き返し(好きな曲)への答え: 曲名なら、その曲の話', P('SIX ÉTERNELかな', { awaiting: 'fav' }).kind === 'songTalk' && P('SIX ÉTERNELかな', { awaiting: 'fav' }).answered);
check('待っていないときは、答えとして読まない', P('ねむい').answered === false && P('元気!').answered === false);
check('聞き返しへの答えにならない発言は、ふつうに読む', P('ナイス!', { awaiting: 'how' }).kind === 'replyNice' && P('ナイス!', { awaiting: 'how' }).answered === false);
check('質問には聞き返しの種類がつく(調子→qHow・好きな曲→qFav)', P('調子どう?').ask === 'qHow' && P('調子どう?').awaits === 'how' && P('好きな曲は?').ask === 'qFav' && P('好きな曲は?').awaits === 'fav' && P('ありがとう').ask === '');
check('壊れた入力でも落ちない', [null, undefined, 123, {}, [], '   ', '\u0000'].every((t) => { try { return typeof P(t).kind === 'string'; } catch (_) { return false; } }) && (() => { try { C.parse({}); C.parse({ text: 'a', names: null, songs: null }); return true; } catch (_) { return false; } })());
const t0 = Date.now();
const longText = 'あ'.repeat(5000) + 'ナイス' + 'w'.repeat(3000);
for (let i = 0; i < 50; i++) P(longText);
check('長い発言でも、読み取りは一瞬(50回で1秒未満)', Date.now() - t0 < 1000, `${Date.now() - t0}ms`);


// ===== 性格ごとの呼び方 =====
{
  const hon = vm.runInContext('rhythmBuddyHonorific', sb);
  check('性格ごとの呼び方が決まっている(ひょうきん=っち・甘えん坊=ちゃん・真面目=様・勇敢/プライド/頑固=呼び捨て)', TRAITS.every((t) => hon(t) === HON[t]) && hon('') === 'さん' && hon('unknown') === 'さん' && hon(null) === 'さん');
  const callOf = (trait) => { const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(C.pick({ kind: 'welcome', trait, moodId: 'normal', vars: { who: 'たろう' }, recent: [], rand: Math.random })); return [...seen]; };
  check('「{who}さん」は、性格ごとの呼び方に替わる(ひょうきん→たろうっち / 甘えん坊→たろうちゃん / 真面目→たろう様 / 勇敢→呼び捨て)',
    callOf('jester').some((t) => t.includes('たろうっち')) && !callOf('jester').some((t) => t.includes('たろうさん'))
    && callOf('clingy').some((t) => t.includes('たろうちゃん')) && callOf('serious').some((t) => t.includes('たろう様'))
    && callOf('brave').some((t) => /たろう[^さっちゃ様]/.test(t)) && !callOf('brave').some((t) => /たろうさん|たろうっち|たろうちゃん|たろう様/.test(t)) && callOf('smart').some((t) => t.includes('たろうさん')));
  check('呼び方を渡せば(vars.hon)、それを使う', C.pick({ kind: 'welcome', trait: 'jester', moodId: 'normal', vars: { who: 'たろう', hon: 'どの' }, recent: [], rand: () => 0 }).includes('たろうどの'));
  check('性格が決まる前は「さん」', (() => { for (let i = 0; i < 100; i++) { const t = C.pick({ kind: 'welcome', trait: '', moodId: 'normal', vars: { who: 'たろう' }, recent: [], rand: Math.random }); if (/たろう(っち|ちゃん|様)/.test(t)) return false; } return true; })());
  check('呼びかけを付けてよい場面の名前は、どれも会話か今までのおしゃべりの場面', vm.runInContext('RHYTHM_BUDDY_CONVO_CALLABLE', sb).every((k) => k in C.convo || k in C.talk));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
