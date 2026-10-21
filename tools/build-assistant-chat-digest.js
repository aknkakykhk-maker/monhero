#!/usr/bin/env node
// 助手とおしゃべり(2026-10-14・社長の決定)で、中継役(supabase/functions/assistant-chat)が
// Claude へ渡す「ヘルプの中身」と「助手の人柄」を、いまの data/help.js・data/assistants.js から作る。
//   出力: monster-hero/data/assistant-chat-digest.json(公開中のサイトから中継役が読む)
// 手で書き写さないので、ヘルプやセリフを直せば次のビルドで追従する。
//
// 中身は3つ(2026-10-14 窓口の指摘「HELL を取り違えた」で作り直した):
//   index  … ヘルプ全項目の目次(カテゴリ／見出し)。中継役が毎回渡し、キャッシュする
//   basics … いちばん最初のカテゴリ(基本ルール)の本文。毎回渡し、キャッシュする
//   topics … 全項目の見出しと本文。中継役が質問の言葉で上位の数項目を選んで足す(キャッシュの区切りの後ろ)
// ★公開の印(releaseFlag / unreleasedFlag)は、ビルドの時点の RELEASE_FLAGS の値で決める
//   (src/parts/17-release-changelog-login-missions.jsx の RELEASE_FLAGS を、parts にある定数で評価する)。
//   値が分からない印は、まだ出ていないものとしてはぶく。
// ★毎回渡す部分(目次・基本・人柄)に上限を置く(CACHED_MAX_CHARS)。超えたらビルドを止める。
//
//   node tools/build-assistant-chat-digest.js           作り直す
//   node tools/build-assistant-chat-digest.js --check   いまのデータと合っているかだけ見る
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'monster-hero', 'data');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const OUT = path.join(DATA, 'assistant-chat-digest.json');
// 毎回渡す部分(目次・基本・人柄)の上限。日本語はおよそ1文字1トークン強
const CACHED_MAX_CHARS = 20000;
const BASICS_MAX_CHARS = 5000;
// 選んで渡す1項目の本文の上限
const TOPIC_MAX_CHARS = 1500;
// 助手ごとの口調の見本の数(2026-10-14 社長「キャラごとの喋り方の特徴がちゃんと反映されてない気がする」で 24 → 80)
const SAMPLE_LINES = 80;
// 見本から外したいゲームの説明っぽい言葉(多いほど点を下げる)。くせの強い雑談寄りのセリフを残すため
const EXPLAIN_WORDS = /難易度|編成|ボタン|画面|設定|タブ|一覧|押す|押して|選んで|選べ|できる|られる|WAVE|ポイント|ダイヤ|報酬|交換|解放|ランキング|ノーツ|判定/g;
// 検索用の言いかえ(項目id → 遊ぶ人が使いそうな呼び方)。ヘルプの見出しと、画面やプレイヤーの呼び方がずれている項目だけ。
// 答えの中身ではなく「その項目を選ぶための言葉」なので、ここに説明は書かない
const TOPIC_ALIASES = {
  'rhythm/rhythm-multi': 'マルチ マルチプレイ 協力 部屋 フリーマッチ プライベート',
};
// 用語の小さな表(2026-10-14 窓口の指摘「みゅあが自分の愛称『モンビー』を知らないと答えた」)。
// ここに書くのは「同じものの言い方の組」と「説明を取るヘルプの項目」だけ。
//   説明 … そのヘルプ項目(無ければ全項目)で、その言葉を最初に含む1文を機械で取る
//   呼び方 … 助手ごとに、実際のセリフでどの言い方を何回使っているかを数え、いちばん多いものを書く
const TERM_GROUPS = [
  // prefer … 助手の設定にある「いまの呼び方」(ASSISTANTS の rhythmCall)。公開済みのお話は昔の呼び方のままなので、数だけで並べると古い呼び方が先に来る
  { variants: ['モンヒロビート', 'モンビー', 'モンビート'], topic: 'rhythm/rhythm-mode', prefer: 'rhythmCall' },
  { variants: ['モンヒロバトル', 'モンバト'], topic: 'basics/battle-modes' },
  { variants: ['マスモン'], topic: 'masu/masumon' },
  { variants: ['ベースモン'], topic: 'home/roster' },
  { variants: ['勇者モン'], topic: 'basics/quickstart' },
  { variants: ['供モン'], topic: 'basics/quickstart' },
  { variants: ['絆レベル', '絆Lv'], topic: 'masu/masumon' },
  { variants: ['仲良し度'], topic: 'tips/bond' },
  { variants: ['M/B管理'], topic: 'home/roster' },
];

// ノーツの見た目の表を写すヘルプの項目(カテゴリid/項目id)。表(kv)の行をそのまま毎回渡す部分へ入れる
const LOOK_TOPICS = ['rhythm/rhythm-note-types', 'rhythm/rhythm-hell'];

const loadScript = (file, names) => {
  const src = fs.readFileSync(path.join(DATA, file), 'utf8');
  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number });
  vm.runInContext(`${src}\n;globalThis.__out = { ${names.map(n => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ')} };`, ctx, { filename: file });
  return ctx.__out;
};

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ビルドの時点の RELEASE_FLAGS を読む。parts にある `const NAME = true/false/'文字';` を定数として与えて評価する
const loadReleaseFlags = () => {
  const consts = {};
  let flagsSrc = '';
  for (const f of fs.readdirSync(PARTS).filter(n => n.endsWith('.jsx'))) {
    const src = fs.readFileSync(path.join(PARTS, f), 'utf8');
    for (const m of src.matchAll(/^const ([A-Z][A-Z0-9_]*)\s*=\s*(true|false|'[^'\n]*'|"[^"\n]*")\s*;/gm)) consts[m[1]] = m[2];
    const i = src.indexOf('const RELEASE_FLAGS = {');
    if (i >= 0) flagsSrc = src.slice(i + 'const RELEASE_FLAGS = '.length, src.indexOf('};', i) + 1);
  }
  if (!flagsSrc) throw new Error('RELEASE_FLAGS が見つかりません');
  const ctx = vm.createContext({ Date });
  const flags = vm.runInContext(`${Object.entries(consts).map(([k, v]) => `const ${k} = ${v};`).join('\n')}\n(${flagsSrc})`, ctx);
  const out = {};
  for (const k of Object.keys(flags)) { try { out[k] = flags[k] === true; } catch { out[k] = false; } }
  return out;
};

const buildDigest = () => {
  const flags = loadReleaseFlags();
  const released = (x) => !x || ((!x.releaseFlag || flags[x.releaseFlag] === true) && (!x.unreleasedFlag || flags[x.unreleasedFlag] === false));
  const help = loadScript('help.js', ['HELP_CATEGORIES', 'helpBlockPlainText']);
  const index = [];
  const topics = [];
  let basics = '';
  (help.HELP_CATEGORIES || []).filter(released).forEach((cat, ci) => {
    const titles = [];
    for (const topic of (cat.topics || []).filter(released)) {
      const body = (topic.blocks || []).filter(released).map(b => clean(help.helpBlockPlainText(b))).filter(Boolean).join(' ');
      if (!body) continue;
      const title = clean(topic.title);
      titles.push(title);
      // heads … 小見出し(note の title)と助手のひとこと。見出しに近い言葉として、質問との一致を少し重く数える
      // (見出しが「みんなで対戦」でも、中の小見出しや助手が「マルチ」と呼んでいれば拾えるように)
      const heads = clean([TOPIC_ALIASES[`${cat.id}/${topic.id}`], topic.assistant, ...(topic.blocks || []).filter(released).map(b => b && b.title)].filter(Boolean).join(' '));
      topics.push({ id: `${cat.id}/${topic.id}`, cat: clean(cat.title), title, heads: cut(heads, 600), text: cut(body, TOPIC_MAX_CHARS) });
      if (ci === 0) basics += `■${title}\n${body}\n`;
    }
    if (titles.length) index.push(`【${clean(cat.title)}】${titles.join('／')}`);
  });

  const a = loadScript('assistants.js', ['ASSISTANTS', 'assistantSceneLines', 'ASSISTANT_SCENES', 'ASSISTANT_LINE_PACKS', 'ASSISTANT_UPDATE_NOTICE_SCRIPTS', 'ASSISTANT_PEER_CALLS', 'ASSISTANT_CHAT_EXAMPLES', 'EVENT_REPLAYS', 'DEFAULT_ASSISTANT_ID']);

  // ---- 用語の表 ----
  // 助手ごとのセリフを全部集める(場面の通常・条件つき・あとから足した束)
  const linesBy = {};
  const addLine = (line, fallbackWho) => {
    if (!line || typeof line.t !== 'string') return;
    const who = line.who || fallbackWho || a.DEFAULT_ASSISTANT_ID || 'mua';
    (linesBy[who] = linesBy[who] || []).push(line.t);
  };
  for (const def of Object.values(a.ASSISTANT_SCENES || {})) {
    for (const line of (def && def.lines) || []) addLine(line);
    for (const list of Object.values((def && def.when) || {})) for (const line of list || []) addLine(line);
  }
  for (const pack of a.ASSISTANT_LINE_PACKS || []) {
    for (const list of Object.values((pack && pack.lines) || {})) for (const line of list || []) addLine(line, pack.assistantId);
  }
  // 告知の読み上げ(告知id → 助手id → セリフ)。愛称(モンビー)はここに多い
  for (const byAssistant of Object.values(a.ASSISTANT_UPDATE_NOTICE_SCRIPTS || {})) {
    for (const [who, list] of Object.entries(byAssistant || {})) for (const line of Array.isArray(list) ? list : []) addLine(line, who);
  }
  // イベントのお話(回想)の台詞。掛け合いのくせがいちばんよく出る
  for (const ev of a.EVENT_REPLAYS || []) for (const line of (ev && Array.isArray(ev.script)) ? ev.script : []) if (line && line.who) addLine(line, line.who);
  const countIn = (texts, word) => texts.reduce((n, t) => n + (t.split(word).length - 1), 0);
  const firstSentence = (word, preferId) => {
    const pool = [topics.find(t => t.id === preferId), ...topics].filter(Boolean);
    for (const t of pool) {
      const s = t.text.split(/(?<=。)/).find(x => x.includes(word));
      if (s) return cut(clean(s), 120);
    }
    return '';
  };
  const glossary = [];
  for (const g of TERM_GROUPS) {
    const meaning = firstSentence(g.variants[0], g.topic);
    const calls = [];
    for (const x of a.ASSISTANTS || []) {
      if (!x || x.role !== '助手') continue;
      const texts = linesBy[x.id] || [];
      // その助手が実際に使う言い方を、多い順に全部並べる(いちばん多いものだけにすると、愛称を「知らない」ことになる)
      // 「モンビー」は「モンビート」の中にも入っているので、長い言い方のぶんを引いて数える
      const countOf = (v) => countIn(texts, v) - g.variants.filter(w => w !== v && w.startsWith(v)).reduce((n, w) => n + countIn(texts, w), 0);
      const preferred = g.prefer && g.variants.includes(x[g.prefer]) ? x[g.prefer] : null;
      const used = g.variants.map(v => [v, countOf(v)]).filter(([v, n]) => n > 0 || v === preferred)
        .sort((p, q) => (q[0] === preferred) - (p[0] === preferred) || q[1] - p[1]).map(([v]) => `「${v}」${v === preferred ? '(いまの呼び方)' : ''}`);
      if (used.length) calls.push(`${x.name}は${used.join('とも')}`);
    }
    const head = g.variants.length > 1 ? `${g.variants[0]}(＝${g.variants.slice(1).join('・')}。どれも同じもの)` : g.variants[0];
    glossary.push(`・${head}: ${meaning || '(ヘルプに説明なし)'}${g.variants.length > 1 && calls.length ? ` 助手の呼び方: ${calls.join('、')}` : ''}`);
  }
  // ---- ノーツの見た目の表(2026-10-21 社長「みゅあがノーツの色を作って答えた」TAP を白っぽい丸・HELL の空のノーツを紫の線と言った) ----
  // ヘルプの「ノーツの種類と取り方」「難易度 HELL と空のノーツ」の表(kv)を、ヘルプから機械で写す(手で書き写さない。ヘルプを直せば次のビルドで追従する)。
  // 項目の本文は TOPIC_MAX_CHARS で切られ、しかも質問の言葉で選ばれたときしか渡らないので、毎回渡す部分(用語の後ろ)へ入れる。
  // 決まりも一緒に入れる(中継役の決まり RULES_TEXT を変えるには出し直しが要るため、ここに書いて公開だけで効くようにした)
  const looks = [];
  for (const id of LOOK_TOPICS) {
    const [catId, topicId] = id.split('/');
    const cat = (help.HELP_CATEGORIES || []).find(c => c.id === catId);
    const topic = cat && (cat.topics || []).find(t => t.id === topicId);
    if (!topic || !released(cat) || !released(topic)) continue;
    const rows = (topic.blocks || []).filter(b => b && b.t === 'kv' && released(b)).flatMap(b => b.rows || []);
    if (rows.length) looks.push(`■ヘルプ「${clean(topic.title)}」の表\n${rows.map(r => `・${clean(r[0])}: ${clean(r[1])}`).join('\n')}`);
  }
  if (looks.length) {
    glossary.push('', 'ノーツの見た目(色・形)。本当なのはここに書いてあることだけ:', ...looks,
      '決まり: ノーツや画面の色・形・数字を聞かれたら、この表と渡されたヘルプの項目に書いてあることだけで答える。書いていない色・形・数字や、「難易度やテーマで色が変わる」のような書いていない仕組みは作らない。分からないところは「ヘルプの「ノーツの種類と取り方」(空のノーツは「難易度 HELL と空のノーツ」)を見てね」と案内する。');
  }
  const assistants = {};
  for (const x of a.ASSISTANTS || []) {
    if (!x || x.role !== '助手') continue;
    // 見本は、その助手の全セリフ(場面・あとから足した束・告知の読み上げ・お話)から、くせの目印(speechMarkers)が多く、
    // ゲームの説明っぽい言葉が少ないものを選ぶ。点が同じなら台本に出てくる順。毎回同じ並びになる(乱数は使わない)
    const markers = x.speechMarkers ? new RegExp(x.speechMarkers, 'g') : null;
    const seen = new Set();
    const scored = [];
    (linesBy[x.id] || []).forEach((raw, i) => {
      const t = clean(raw);
      if (!t || seen.has(t) || t.length < 6 || t.length > 70 || /[{}]/.test(t)) return;
      seen.add(t);
      const quirk = markers ? (t.match(markers) || []).length : 0;
      const explain = (t.match(EXPLAIN_WORDS) || []).length;
      scored.push({ t, i, score: quirk * 2 - explain });
    });
    scored.sort((p, q) => q.score - p.score || p.i - q.i);
    const picked = scored.slice(0, SAMPLE_LINES).sort((p, q) => p.i - q.i).map(x => x.t);
    // ほかの助手の呼び方(ASSISTANT_PEER_CALLS)。「きき → ひめちん」のように名前つきで並べる
    const peers = (a.ASSISTANT_PEER_CALLS && a.ASSISTANT_PEER_CALLS[x.id]) || {};
    const nameOf = (id) => ((a.ASSISTANTS || []).find(y => y && y.id === id) || {}).name || id;
    assistants[x.id] = {
      name: x.name, tagline: clean(x.tagline), intro: clean(x.intro), greeting: clean(x.greeting),
      ...(x.firstPerson ? { firstPerson: clean(x.firstPerson) } : {}),
      ...(x.speech ? { speech: clean(x.speech) } : {}),
      ...(Array.isArray(x.speechQuirks) ? { quirks: x.speechQuirks.map(clean) } : {}),
      ...(a.ASSISTANT_CHAT_EXAMPLES && Array.isArray(a.ASSISTANT_CHAT_EXAMPLES[x.id]) ? { examples: a.ASSISTANT_CHAT_EXAMPLES[x.id].map(e => ({ q: clean(e.q), a: clean(e.a) })) } : {}),
      peerCalls: Object.entries(peers).map(([id, call]) => `${nameOf(id)}は「${call.replace(/\(.*$/, '')}」${/\(/.test(call) ? call.slice(call.indexOf('(')) : ''}`).join('、'),
      samples: picked,
    };
  }
  // terms … 同じものの言い方の組。中継役が質問を広げてから項目を選ぶ(「モンビー」で聞かれてもモンヒロビートの項目が選ばれる)
  return { version: 2, index: index.join('\n'), glossary: glossary.join('\n'), terms: TERM_GROUPS.filter(g => g.variants.length > 1).map(g => g.variants), basics: cut(basics.trim(), BASICS_MAX_CHARS), topics, assistants };
};

const run = ({ check = false } = {}) => {
  const digest = buildDigest();
  const text = `${JSON.stringify(digest, null, 1)}\n`;
  const persona = Math.max(0, ...Object.values(digest.assistants).map(x => JSON.stringify(x).length));
  const size = digest.index.length + digest.glossary.length + digest.basics.length + persona;
  if (size > CACHED_MAX_CHARS) {
    return { ok: false, reason: `助手とおしゃべりの毎回渡す部分が大きすぎます(${size}文字 > ${CACHED_MAX_CHARS})。BASICS_MAX_CHARS を下げてください` };
  }
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (check) {
    return before === text ? { ok: true, size } : { ok: false, reason: 'assistant-chat-digest.json が古いままです' };
  }
  if (before !== text) fs.writeFileSync(OUT, text);
  return { ok: true, changed: before !== text, size, topics: digest.topics.length, assistants: Object.keys(digest.assistants).length };
};

module.exports = { run, buildDigest, loadReleaseFlags, CACHED_MAX_CHARS };

if (require.main === module) {
  const r = run({ check: process.argv.includes('--check') });
  if (!r.ok) { console.error(`NG: ${r.reason}`); process.exit(1); }
  console.log(r.changed === undefined ? `OK: 助手とおしゃべりの材料は最新です(毎回渡す部分 ${r.size}文字)` : `助手とおしゃべりの材料: ${r.changed ? '作り直しました' : '最新でした'}(毎回渡す部分 ${r.size}文字 / ヘルプ${r.topics}項目 / 助手${r.assistants}人)`);
}
