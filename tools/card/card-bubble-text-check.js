// MFバトルカード: 助手の吹き出しに「文字でないもの」が出ないかを見張る(2026-10-26 フキダシくん)。
// きっかけ: トップの吹き出しに台詞ではなく「[object Object]」と出た(ソラシドさんの報告)。
//   台詞を部品(<span>…</span>)にしてから吹き出しへ渡し、吹き出しの側がもう一度「言葉の切れ目で折る部品(jaWrap)」へ通したため、
//   jaWrap の中の String(…) が部品を「[object Object]」という字に変えていた。
//
//   node tools/card/card-bubble-text-check.js
//
// 見ているもの(ブラウザは使わない。速い)
//   ① 台詞の表が全部「文字」: 対戦中(CARD_BATTLE_LINES)・VSの画面(CARD_VS_LINES)・マルチの結果(CARD_PVP_RESULT_LINES)・
//      チュートリアル(CARD_TUTORIAL_LINES)・トップ(data/assistants.js の場面 cardTop)。6人とも、空・undefined・[object …] が無い
//   ② 台詞を選ぶ関数(cardPickLine・cardPvpResultLine)が、どの助手・どの場面でも文字を返す(表に無い助手・場面では null)
//   ③ トップの台詞は {name} を置き換えたあとも文字で、「{」「}」が残らない
//   ④ 助手の吹き出しへ渡す物(text: …)に部品(JSX)を入れていない。吹き出しの側(ModeSelectAssistantPanel など)が jaWrap に通すので、
//      部品を渡すと「[object Object]」になる。言葉の折り方は吹き出しの側に任せ、渡すのは文字だけにする
//   ⑤ 吹き出しの字を出す所(対戦中・結果・相手えらび・デッキ相談)が、文字に直す前の値をそのまま出していない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const PARTS = path.join(GAME, 'src', 'parts');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails += 1; console.log(`NG: ${msg}`); } };
const read = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');

// 「const 名前 = …;」の文を、かっこの対応で切り出す(JSX の混ざったファイルからも、表と関数だけ取り出せる)
const cut = (src, name) => {
  const at = src.search(new RegExp(`^const ${name} = `, 'm'));
  if (at < 0) return null;
  let depth = 0, q = null;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i += 1; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if ('({['.includes(ch)) depth += 1;
    else if (')}]'.includes(ch)) depth -= 1;
    else if (ch === ';' && depth === 0) return src.slice(at, i + 1);
  }
  return null;
};

const ASSISTANT_IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko'];
const BAD = /\[object |\bundefined\b|\bNaN\b|^\s*null\s*$/;
const isLine = (t) => typeof t === 'string' && t.trim() !== '' && !BAD.test(t);

// ---- 表と関数を読み込む ----
const pLines = read('83-card-battle-lines.jsx'), pVs = read('83-card-battle-vs.jsx'), pTut = read('86-card-tutorial.jsx'), pMulti = read('91-card-battle-multi.jsx');
const want = [
  [pLines, 'CARD_LINE_SCENES'], [pLines, 'CARD_LINE_FACE'], [pLines, 'CARD_BATTLE_LINES'], [pLines, 'cardPickLine'],
  [pVs, 'CARD_VS_LINES'], [pTut, 'CARD_TUTORIAL_LINES'], [pMulti, 'CARD_PVP_RESULT_LINES'], [pMulti, 'cardPvpResultLine'],
];
const pieces = want.map(([src, name]) => { const s = cut(src, name); ok(!!s, `${name} が見つからない(名前を変えたらこの検査も直す)`); return s || ''; });
const ctx = vm.createContext({ Object, Array, Math, String, Number, JSON });
vm.runInContext(`${pieces.join('\n')}\nthis.E = { CARD_LINE_SCENES, CARD_LINE_FACE, CARD_BATTLE_LINES, cardPickLine, CARD_VS_LINES, CARD_TUTORIAL_LINES, CARD_PVP_RESULT_LINES, cardPvpResultLine };`, ctx, { filename: 'card-lines' });
const E = ctx.E;

// ① ② 対戦中の台詞
for (const who of ASSISTANT_IDS) {
  const table = E.CARD_BATTLE_LINES[who];
  ok(!!table, `対戦中の台詞に ${who} がいない`);
  if (!table) continue;
  for (const [scene, list] of Object.entries(table)) {
    ok(Array.isArray(list) && list.length > 0, `対戦中の台詞 ${who}.${scene} が空`);
    (list || []).forEach((entry, i) => {
      const t = Array.isArray(entry) ? entry[0] : entry;
      ok(isLine(t), `対戦中の台詞 ${who}.${scene}[${i}] が文字でない(${JSON.stringify(entry)})`);
      if (Array.isArray(entry)) ok(entry.length === 2 && typeof entry[1] === 'string', `対戦中の台詞 ${who}.${scene}[${i}] の表情が文字でない`);
    });
    // どの台詞を引いても文字になる(直前と同じものは避ける作りなので、直前を変えて全部引く)
    for (let last = -1; last < list.length; last++) {
      for (const r of [0, 0.5, 0.999]) {
        const line = E.cardPickLine(who, scene, last >= 0 ? { [scene]: last } : null, () => r);
        ok(line && isLine(line.text) && typeof line.face === 'string', `cardPickLine(${who}, ${scene}) が文字を返さない(${JSON.stringify(line)})`);
      }
    }
  }
}
ok(E.cardPickLine('mua', 'no-such-scene', null) === null, '表に無い場面で cardPickLine が null を返さない(空の吹き出しが出る)');
ok(isLine((E.cardPickLine('no-such-assistant', 'start', null) || {}).text), '表に無い助手で cardPickLine が文字を返さない(みゅあの台詞に落とす決まり)');

// ① VSの画面の台詞
for (const who of ASSISTANT_IDS) {
  const table = E.CARD_VS_LINES[who];
  ok(!!table, `VSの台詞に ${who} がいない`);
  for (const [level, line] of Object.entries(table || {})) ok(line && isLine(line.t) && typeof line.e === 'string', `VSの台詞 ${who}.${level} が文字でない(${JSON.stringify(line)})`);
}

// ① ② マルチの結果の台詞
for (const who of ASSISTANT_IDS) {
  const table = E.CARD_PVP_RESULT_LINES[who];
  ok(!!table, `マルチの結果の台詞に ${who} がいない`);
  for (const [scene, list] of Object.entries(table || {})) {
    (list || []).forEach((entry, i) => ok(Array.isArray(entry) && isLine(entry[0]) && typeof entry[1] === 'string', `マルチの結果の台詞 ${who}.${scene}[${i}] が文字でない(${JSON.stringify(entry)})`));
    for (const seed of [0, 1, 2, 7, 12345, -3]) { const l = E.cardPvpResultLine(who, scene, seed); ok(l && isLine(l.text), `cardPvpResultLine(${who}, ${scene}, ${seed}) が文字を返さない`); }
  }
}

// ① チュートリアルの台詞
for (const [id, t] of Object.entries(E.CARD_TUTORIAL_LINES)) ok(isLine(t), `チュートリアルの台詞 ${id} が文字でない(${JSON.stringify(t)})`);

// ① ③ トップの台詞(data/assistants.js の場面 cardTop)
{
  const actx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date });
  vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'assistants.js'), 'utf8')}\n;this.A = { pickAssistantLine, assistantSpeak: typeof assistantSpeak === 'function' ? assistantSpeak : null };`, actx, { filename: 'assistants' });
  const A = actx.A;
  ok(typeof A.assistantSpeak === 'function', 'data/assistants.js に assistantSpeak が無い');
  for (const who of ASSISTANT_IDS) {
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const line = A.pickAssistantLine('cardTop', null, 5, who);
      ok(line && isLine(line.t), `トップの台詞(${who})が文字でない(${JSON.stringify(line)})`);
      if (!line) break;
      seen.add(line.t);
      for (const name of ['テスト', '']) {
        const said = A.assistantSpeak ? A.assistantSpeak(line.t, name, 5, null, who) : line.t;
        ok(isLine(said) && !/[{}]/.test(said), `トップの台詞(${who})を呼び方へ置き換えると文字でなくなる・「{」「}」が残る(${JSON.stringify(said)})`);
      }
    }
    ok(seen.size >= 2, `トップの台詞(${who})が1本しか無い`);
  }
}

// ④ 吹き出しへ渡す物(text: …)に部品(JSX)を入れていない
//    カードの部品だけでなく、同じ吹き出し(ModeSelectAssistantPanel)を使うモンヒロビート・モンヒロバトルのトップも見る
for (const f of fs.readdirSync(PARTS).filter((x) => x.endsWith('.jsx'))) {
  read(f).split('\n').forEach((line, i) => {
    if (/\btext: *(\(\s*)?</.test(line)) ok(false, `${f}:${i + 1} 吹き出しへ渡す text に部品(JSX)を入れている。jaWrap が「[object Object]」にするので、文字のまま渡す`);
  });
}
// 吹き出しの側は、渡された text を jaWrap に通している(折り方は吹き出しの側で決める)。ここが変わったら④の前提も見直す
{
  const p77 = read('77-screen-rhythm-multi.jsx');
  ok(/function ModeSelectAssistantPanel[\s\S]{0,4000}jaWrap\(assistant\.text\)/.test(p77), 'ModeSelectAssistantPanel が台詞を jaWrap(assistant.text) で出していない(④の前提が変わった)');
}

// ⑤ 吹き出しの字を出す所が、文字の台詞だけを出している
{
  const p84 = read('84-screen-card-battle.jsx'), p87 = read('87-card-deck-edit.jsx');
  ok(/data-card-bubble\b[\s\S]{0,1500}jaWrap\(bubble\.text\)/.test(p84), '対戦中の吹き出しが bubble.text を jaWrap で出していない');
  ok(/const text = ai \? ai\.text : line \? line\.text : '';/.test(p84), '結果の台詞が「AIの文 → 決まった台詞 → 空」の順で文字を選んでいない');
  ok(/typeof res\.text !== 'string'/.test(read('83-card-battle-talk-ai.jsx')), '外のAIの返事が文字かどうかを確かめていない(文字でない返事が吹き出しに出る)');
  ok(/data-card-deck-ask-text[^\n]*ask\.text/.test(p87), 'デッキ相談の吹き出しが ask.text を出していない(形が変わったらこの検査も直す)');
}

if (fails) { console.log(`\n${fails} 件 NG`); process.exit(1); }
console.log('OK: MFバトルカードの助手の吹き出しに渡る台詞は、全部文字(6人・トップ/対戦中/VS/結果/マルチ/チュートリアル)');
