// 助手の台詞が、ほかの助手の行に落ちていないか・ほかの助手の口ぐせが混ざっていないかを見る(2026-11-05)。
// 社長「これみゅあのせりふじゃない？」「新助手出るたびにみゅあのセリフとごっちゃになるのどうにかして」
//   → モンヒロビートのモードえらび(rhythmModeSelect)は、場面の定義を持たない束(addAssistantLinePack)だけの場面で、
//     ソラシド・えるびんの行が無く、filterAssistantLines がみゅあの行へ黙って落としていた(「てかてか…まぢおいしい✨」)。
//     いまは落とさず何も言わない作りにしたので、抜けはこの検査で止める。
//
//   node tools/assistant/assistant-line-owner-check.js
//
// 見るもの
//   ① 全助手(公開前も含む)×全場面(ASSISTANT_SCENES と、束だけで作る場面の両方)で、その助手自身の行がある
//   ② filterAssistantLines が、ほかの助手(みゅあ)の行へ落とさない(行が無い助手には空を返す)
//   ③ 各助手の行に、ほかの助手の口ぐせの目印が混ざっていない。
//      目印は ASSISTANTS[].speechQuirks の「」の中から自動で作る(新しい助手の口ぐせも自動で見張る)。
//      ほかの助手もふつうに使う言葉(「です」「いいね」など)は SHARED に書いて目印から外す
//   ④ ヘルプの助手のひとこと(help.js の assistant)は、いま選んでいる助手がそのまま読むので、だれの口ぐせも入れない
//   ⑤ 助手ごとの台本の表(ASSISTANT_..._SETS)の行にも、ほかの助手の口ぐせが混ざっていない
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const ctx = { console: { log() {}, warn() {}, error() {} } };
vm.createContext(ctx);
vm.runInContext('var RELEASE_FLAGS = {};', ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/breeder.js', 'data/assistants.js']) vm.runInContext(read(`monster-hero/${f}`), ctx, { filename: f });

const data = vm.runInContext(`(() => {
  const D = DEFAULT_ASSISTANT_ID;
  const ids = ASSISTANTS.map(a => a.id);
  const quirks = Object.fromEntries(ASSISTANTS.map(a => [a.id, Array.isArray(a.speechQuirks) ? a.speechQuirks : []]));
  const packScenes = [...new Set(ASSISTANT_LINE_PACKS.flatMap(p => Object.keys(p.lines || {})))].filter(k => !ASSISTANT_SCENES[k]);
  const linesOf = (scene) => {
    const def = ASSISTANT_SCENES[scene];
    if (def) return (def.lines || []).concat(...Object.values(def.when || {}));
    return ASSISTANT_LINE_PACKS.flatMap(p => Array.isArray(p.lines?.[scene]) ? stampAssistantOnLines(p.lines[scene], p.assistantId || D) : []);
  };
  const scenes = [...Object.keys(ASSISTANT_SCENES), ...packScenes].map(s => ({ s, pack: !ASSISTANT_SCENES[s],
    lines: linesOf(s).filter(l => l && typeof l.t === 'string').map(l => ({ who: l.who || D, t: l.t })) }));
  // 助手ごとの台本の表(ASSISTANT_..._SETS)
  const sets = [];
  for (const name of Object.getOwnPropertyNames(globalThis)) {
    if (!/^ASSISTANT_[A-Z0-9_]+_SETS$/.test(name)) continue;
    let table; try { table = globalThis[name]; } catch { continue; }
    if (!table || typeof table !== 'object') continue;
    for (const [who, v] of Object.entries(table)) {
      const texts = [];
      const walk = (x) => { if (typeof x === 'string') texts.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { for (const k of ['t', 'text', 'title', 'body']) if (typeof x[k] === 'string') texts.push(x[k]); for (const k of ['lines', 'steps', 'pages']) if (x[k]) walk(x[k]); } };
      walk(v);
      for (const t of texts) sets.push({ set: name, who, t });
    }
  }
  // ② 落とさないか: どの場面にも行の無い、架空の助手で引いてみる
  const leak = filterAssistantLines([{ t: 'x' }, { who: 'kiki', t: 'y' }], '__nobody__').length;
  return { ids, quirks, scenes, sets, leak, D };
})()`, ctx);
// vm の中の const は globalThis に乗らないので、_SETS は名前を拾って別に読む
if (!data.sets.length) {
  const src = read('monster-hero/data/assistants.js');
  for (const m of src.matchAll(/^const (ASSISTANT_[A-Z0-9_]+_SETS) = \{/gm)) {
    const table = vm.runInContext(m[1], ctx);
    for (const [who, v] of Object.entries(table || {})) {
      const texts = [];
      const walk = (x) => { if (typeof x === 'string') texts.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { for (const k of ['t', 'text', 'title', 'body']) if (typeof x[k] === 'string') texts.push(x[k]); for (const k of ['lines', 'steps', 'pages']) if (x[k]) walk(x[k]); } };
      walk(v);
      for (const t of texts) data.sets.push({ set: m[1], who, t });
    }
  }
}
check('助手と場面を読める', data.ids.length >= 8 && data.scenes.length > 50, `助手${data.ids.length}人・場面${data.scenes.length}・台本の表の行${data.sets.length}`);

// ① 全助手×全場面で、自分の行がある
const missing = [];
for (const sc of data.scenes) {
  if (!sc.lines.length) continue; // 行を持たない場面(画面側で文を渡す場面)は見ない
  const who = new Set(sc.lines.map((l) => l.who));
  for (const id of data.ids) if (!who.has(id)) missing.push(`${sc.s}${sc.pack ? '(束)' : ''}:${id}`);
}
check('① 全助手×全場面で、その助手自身の行がある(無いと吹き出しが出ない)', missing.length === 0, missing.slice(0, 12).join(' ') + (missing.length > 12 ? ` ほか${missing.length - 12}件` : ''));

// ② ほかの助手の行へ落とさない
check('② 行の無い助手で引いても、ほかの助手(みゅあ)の行を返さない', data.leak === 0, `返った行 ${data.leak}`);

// ③ 口ぐせの目印
// ほかの助手もふつうに使う言葉。speechQuirks に書いてあっても、その助手だけの目印にはならない
// 2026-11-08 話し方メモ(SPEECH-STYLE.md)から足した例の「それ」「かな」「そっち」「楽ちん」は、ほかの助手もふつうに使う言葉(ミハリ。「楽ちん」はももすけも使う)
const SHARED = new Set(['それ', 'かな', 'そっち', '楽ちん', 'すぎる', 'しよ', 'いこ', 'モンビー', 'です', 'ます', '迷ったら', 'モンヒロビート', 'えらい', 'すご', 'かわいい', 'まって',
  'くさ', 'なるほど', 'からな', 'リーダー', 'とりあえず', 'でいいよ', 'てか', 'やっぱ', 'いいね', 'おけ', 'まあ', 'なに', 'さすが', 'たしかに', 'ふむ', 'まぁ',
  'もも']); // 「もも」は名前でもある(ほかの助手が「ももちゃん」と呼ぶ・「券ももらえる」)。一人称の「もも」は④で別に見る
// speechQuirks に書いていないが、はっきりその助手のものと分かる目印(社長の指摘「てかてか」)
const EXTRA = { mua: ['てかてか'] };
const markers = {};
for (const id of data.ids) {
  const set = new Set(EXTRA[id] || []);
  for (const q of data.quirks[id]) for (const m of q.matchAll(/「([^」]+)」/g)) for (const part of m[1].split(/[・\/、]/)) {
    const x = part.replace(/^〜|〜$/g, '').replace(/[！!？?]+$/, '').trim();
    if (x.length >= 2 && !SHARED.has(x) && !/^〜/.test(x)) set.add(x);
  }
  markers[id] = [...set];
}
const foreignIn = (who, t) => {
  const hits = [];
  for (const other of data.ids) {
    if (other === who) continue;
    for (const mk of markers[other]) {
      if (!t.includes(mk)) continue;
      // 自分の目印でもある言葉(同じ言い回しを2人が持つ)は取り違えではない
      if ((markers[who] || []).includes(mk)) continue;
      hits.push(`${other}の「${mk}」`);
    }
  }
  return hits;
};
const mixed = [];
for (const sc of data.scenes) for (const l of sc.lines) { const h = foreignIn(l.who, l.t); if (h.length) mixed.push(`${sc.s}:${l.who}「${l.t.slice(0, 24)}」に${h.join('・')}`); }
check('③ 各助手の行に、ほかの助手の口ぐせ(speechQuirks から作った目印)が混ざっていない', mixed.length === 0, mixed.slice(0, 6).join(' / ') + (mixed.length > 6 ? ` ほか${mixed.length - 6}件` : ''));
check('③-2 目印を作れている(みゅあ「まぢ」・きき「でつ」がある)', markers.mua.includes('まぢ') && markers.kiki.includes('でつ'), `みゅあ ${markers.mua.join('/')} ・きき ${markers.kiki.slice(0, 6).join('/')}`);

// ④ ヘルプの助手のひとこと
const help = read('monster-hero/data/help.js');
const helpBad = [];
for (const m of help.matchAll(/assistant:\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
  const t = m[2];
  const h = [];
  for (const id of data.ids) for (const mk of markers[id]) if (t.includes(mk)) h.push(`${id}の「${mk}」`);
  if (/(^|[^ぁ-ん])もも(たち|は|が|の|も)/.test(t)) h.push('ももすけの一人称「もも」');
  if (h.length) helpBad.push(`「${t.slice(0, 24)}」に${h.join('・')}`);
}
check('④ ヘルプの助手のひとことに、だれかの口ぐせが入っていない(選んだ助手がそのまま読む)', helpBad.length === 0, helpBad.slice(0, 4).join(' / '));

// ⑤ 助手ごとの台本の表
const setMixed = [];
for (const r of data.sets) { const h = foreignIn(r.who, r.t); if (h.length) setMixed.push(`${r.set}.${r.who}「${r.t.slice(0, 20)}」に${h.join('・')}`); }
check('⑤ 助手ごとの台本の表の行に、ほかの助手の口ぐせが混ざっていない', setMixed.length === 0, setMixed.slice(0, 6).join(' / ') + (setMixed.length > 6 ? ` ほか${setMixed.length - 6}件` : ''));

// ⑥ 助手ライフのできごとの台詞(ASSISTANT_LIFE_DAILY_TALKS。2026-11-11 ナカヨシ20)。ひとこと・場面・珍しいできごとの全部
const dailyMixed = [];
{
  let D = null;
  try { D = vm.runInContext('typeof ASSISTANT_LIFE_DAILY_TALKS !== "undefined" ? ASSISTANT_LIFE_DAILY_TALKS : null', ctx); } catch (_) { D = null; }
  if (!D) { const m = read('monster-hero/data/assistants.js').match(/^const ASSISTANT_LIFE_DAILY_TALKS = (.+);$/m); D = m ? JSON.parse(m[1]) : null; }
  const rows = [];
  if (D) {
    for (const [who, o] of Object.entries(D.lines || {})) for (const [k, l] of Object.entries(o)) for (const x of l) rows.push({ at: `ひとこと.${k}`, who, t: x.t });
    for (const sc of [...(D.scenes || []), ...(D.rares || [])]) for (const [who, o] of Object.entries(sc.parts || {})) for (const [role, x] of Object.entries(o)) rows.push({ at: `${sc.id}.${role}`, who, t: x.t });
  }
  for (const r of rows) { const h = foreignIn(r.who, r.t); if (h.length) dailyMixed.push(`${r.at}:${r.who}「${r.t.slice(0, 20)}」に${h.join('・')}`); }
  check('⑥ 助手ライフのできごとの台詞に、ほかの助手の口ぐせが混ざっていない', dailyMixed.length === 0, `${rows.length}本 ` + dailyMixed.slice(0, 6).join(' / ') + (dailyMixed.length > 6 ? ` ほか${dailyMixed.length - 6}件` : ''));
}

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
