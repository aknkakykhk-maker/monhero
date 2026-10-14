#!/usr/bin/env node
// 助手とおしゃべり(2026-10-14・社長の決定)で、中継役(supabase/functions/assistant-chat)が
// Claude へ渡す「ヘルプの中身」と「助手の人柄」を、いまの data/help.js・data/assistants.js から作る。
//   出力: monster-hero/data/assistant-chat-digest.json(公開中のサイトから中継役が読む)
// 手で書き写さないので、ヘルプやセリフを直せば次のビルドで追従する。
//
// ★公開の印(releaseFlag / unreleasedFlag)が付いたヘルプは、ここでは全部はぶく。
//   ビルドの外では印が立っているかを確かめられないため、まだ出ていない機能を助手が話さないよう安全側に倒す。
// ★大きさに上限を置く(DIGEST_MAX_CHARS)。全部入れると1往復の費用が跳ねるため。超えたらビルドを止める。
//
//   node tools/build-assistant-chat-digest.js           作り直す
//   node tools/build-assistant-chat-digest.js --check   いまのデータと合っているかだけ見る
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'monster-hero', 'data');
const OUT = path.join(DATA, 'assistant-chat-digest.json');
// 日本語はおよそ1文字1トークン強。3万トークンほどに収める
const DIGEST_MAX_CHARS = 26000;
// 1トピックの本文の上限(長い説明は頭のほうだけで足りる)
const TOPIC_MAX_CHARS = 380;
// 助手ごとの口調の見本の数
const SAMPLE_LINES = 24;

const loadScript = (file, names) => {
  const src = fs.readFileSync(path.join(DATA, file), 'utf8');
  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number });
  vm.runInContext(`${src}\n;globalThis.__out = { ${names.map(n => `${n}: (typeof ${n} !== 'undefined' ? ${n} : undefined)`).join(', ')} };`, ctx, { filename: file });
  return ctx.__out;
};

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);
const unreleased = (x) => !!(x && (x.releaseFlag || x.unreleasedFlag));

const buildDigest = () => {
  const help = loadScript('help.js', ['HELP_CATEGORIES', 'helpBlockPlainText']);
  const topics = [];
  for (const cat of help.HELP_CATEGORIES || []) {
    if (unreleased(cat)) continue;
    for (const topic of cat.topics || []) {
      if (unreleased(topic)) continue;
      const body = (topic.blocks || []).filter(b => !unreleased(b)).map(b => clean(help.helpBlockPlainText(b))).filter(Boolean).join(' ');
      if (!body) continue;
      topics.push(`■${clean(cat.title)}／${clean(topic.title)}\n${cut(body, TOPIC_MAX_CHARS)}`);
    }
  }
  const helpText = topics.join('\n');

  const a = loadScript('assistants.js', ['ASSISTANTS', 'assistantSceneLines']);
  const assistants = {};
  for (const x of a.ASSISTANTS || []) {
    if (!x || x.role !== '助手') continue;
    // 見本は HOME のセリフから、仲良し度の低い段階と高い段階をまぜて取る(同じ文は1回だけ)
    const seen = new Set();
    const samples = [];
    for (const lv of [1, 3, 5, 8, 12, 20]) {
      const lines = typeof a.assistantSceneLines === 'function' ? a.assistantSceneLines('home', null, lv, x.id) : [];
      for (const line of lines || []) {
        const t = clean(line && line.t);
        if (!t || seen.has(t)) continue;
        seen.add(t);
        samples.push(t);
      }
    }
    // 毎回同じ並びになるよう、間引きは等間隔(乱数を使うとビルドのたびに中身が変わり、キャッシュも効かなくなる)
    const step = Math.max(1, samples.length / SAMPLE_LINES);
    const picked = [];
    for (let i = 0; i < samples.length && picked.length < SAMPLE_LINES; i += step) picked.push(samples[Math.floor(i)]);
    assistants[x.id] = {
      name: x.name, tagline: clean(x.tagline), intro: clean(x.intro), greeting: clean(x.greeting),
      samples: picked,
    };
  }
  return { version: 1, help: helpText, assistants };
};

const run = ({ check = false } = {}) => {
  const digest = buildDigest();
  const text = `${JSON.stringify(digest, null, 1)}\n`;
  const size = digest.help.length + Object.values(digest.assistants).reduce((n, x) => n + JSON.stringify(x).length, 0);
  if (size > DIGEST_MAX_CHARS) {
    return { ok: false, reason: `助手とおしゃべりの材料が大きすぎます(${size}文字 > ${DIGEST_MAX_CHARS})。TOPIC_MAX_CHARS を下げてください` };
  }
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (check) {
    return before === text ? { ok: true, size } : { ok: false, reason: 'assistant-chat-digest.json が古いままです' };
  }
  if (before !== text) fs.writeFileSync(OUT, text);
  return { ok: true, changed: before !== text, size, topics: digest.help.split('\n■').length, assistants: Object.keys(digest.assistants).length };
};

module.exports = { run, buildDigest, DIGEST_MAX_CHARS };

if (require.main === module) {
  const r = run({ check: process.argv.includes('--check') });
  if (!r.ok) { console.error(`NG: ${r.reason}`); process.exit(1); }
  console.log(r.changed === undefined ? `OK: 助手とおしゃべりの材料は最新です(${r.size}文字)` : `助手とおしゃべりの材料: ${r.changed ? '作り直しました' : '最新でした'}(${r.size}文字 / ヘルプ${r.topics}項目 / 助手${r.assistants}人)`);
}
