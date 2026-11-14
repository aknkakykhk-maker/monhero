// 画面の文から、表(ui-kanji-words.js)の「ひらがな」側の語を探す部品。見張り(ui-kanji-check.js)と置き換えの両方で使う。
//   見るのは文字列・テンプレート・JSX の文字だけ(注記・識別子・保存キー・data-* の値・比べる値は見ない)。
//   台詞は見ない: 台詞の部品(DIALOG_FILE)の長い文と、「」・語尾(だよ・ね! など)のある文。お話の台本・助手の台詞集・更新履歴は丸ごと見ない。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { FORMS, NAMES } = require('./ui-kanji-words.js');

let parser;
function getParser() {
  if (!parser) parser = require(path.join(ROOT, 'tools/node_modules/@babel/parser'));
  return parser;
}

// 丸ごと見ないファイル(台詞・お話・出した更新履歴・生成物)
const SKIP_FILE = /(?:^|\/)(?:changelog\.js|assistants\.js|assistant-chat-digest\.json|monhero-success-script-[^/]*\.js|game-system\.jsx|[^/]*css\.jsx|23-rpg-debug\.jsx|31-debug-ui\.jsx|74-screen-monster-check-debug\.jsx|76-screen-debug-data\.jsx|78-screen-raid-jack-debug\.jsx)$/;
// 台詞の多い部品: 短い文(ボタン・札)だけ見る
const DIALOG_FILE = /assistant|buddy|lines|persona|story|convo|talk|peer|chat|sorashido|card-battle-vs|card-battle-multi|finds|gifts|arc|card-ai-deck|tevent|issa|scenario/;
const SHORT = 12;
// 台詞らしい文
const SPEECH = /[「」『』♪〜]|だよ|だね|よね|かな[?？!！。…]|かな$|ます(?:ね|よ)|でつ|じゃん|ねっ|よっ|ね[!！。…]|よ[!！。…]|ね$|よ$|わ[!！]|ぞ[!！]?$|っす|でしょ|なぁ|ねぇ|よぉ|だぞ|ぜ[!！]|ちゃう/;
// 名前・決まった言い回しで、表の語を含んでいても置き換えない物(曲名・あいさつ・お話の題など)
const EXCEPT = /愛はひとつじゃない|はじめまして|はじめての おでかけ|はじめての特訓|ひとつぶ|いけにえ|ぜんぶ見せ場|ぜんぶ必殺技|ちから|かしこさ/;
const PARTICLE = /[をにでがはもとへのやかよ]/;
const HIRA = /[ぁ-んー]/;
const NEXT_OK_N = /[をにでがはもとへのや、。！？!?・／/()（）「」\s0-9０-９]/;

const FORM_LIST = FORMS.map(([h, k, t]) => ({ h, k, t })).sort((a, b) => b.h.length - a.h.length);
const NAME_LIST = NAMES.map(([h, k]) => ({ h, k, t: 'name' })).sort((a, b) => b.h.length - a.h.length);

// 1つの文の中の当たり [{at, h, k}]
function findInText(t) {
  const hits = [];
  if (!/[ぁ-ん]/.test(t)) return hits;
  const ex = [];
  { const re = new RegExp(EXCEPT.source, 'g'); let m; while ((m = re.exec(t))) ex.push([m.index, m.index + m[0].length]); }
  const inEx = (a, b) => ex.some(([s, e]) => a < e && b > s);
  let i = 0;
  while (i < t.length) {
    let hit = null;
    for (const w of NAME_LIST) {
      if (!t.startsWith(w.h, i)) continue;
      const p = t[i - 1], q = t[i + w.h.length];
      if (p && HIRA.test(p) && !PARTICLE.test(p)) continue;
      if (q && HIRA.test(q) && !PARTICLE.test(q) && !/[るたてしす]/.test(q)) continue;
      hit = w; break;
    }
    if (!hit) for (const w of FORM_LIST) {
      if (!t.startsWith(w.h, i)) continue;
      const p = t[i - 1], q = t[i + w.h.length];
      if (p && HIRA.test(p) && !PARTICLE.test(p)) continue;
      if (w.t === 'n' && q && HIRA.test(q) && !NEXT_OK_N.test(q)) continue;
      hit = w; break;
    }
    if (hit && !inEx(i, i + hit.h.length)) { hits.push({ at: i, h: hit.h, k: hit.k }); i += hit.h.length; } else i++;
  }
  return hits;
}

// 保存に書く値(戦術カードの段 = mh_card_tactics_v1 の id。tools/boot/saved-value-lock.json の cardTacticIds)
const SAVED_KEY = /^tiers$/;
// プレイヤーが送る定型文・スタンプの言葉(プレイヤーの台詞なので見ない)
const SPEECH_VAR = /STAMP/;
const SKIP_ATTR = /^(?:data-|className$|class$|key$|id$|style$|type$|name$|ref$|role$|htmlFor$|src$|href$|value$)/;
function skipByParent(node, parent, grand) {
  if (!parent) return false;
  if (parent.type === 'ObjectProperty' && parent.key === node) return true;
  if (parent.type === 'JSXAttribute') { const n = parent.name && (parent.name.name || ''); return SKIP_ATTR.test(String(n)); }
  if (parent.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator)) return true;
  if (parent.type === 'SwitchCase') return true;
  if (parent.type === 'CallExpression' || parent.type === 'OptionalCallExpression') {
    const c = parent.callee; const nm = c && (c.property ? (c.property.name || '') : (c.name || ''));
    if (/^(?:includes|startsWith|endsWith|indexOf|test|match|getItem|setItem|removeItem|querySelector|querySelectorAll|getElementById|log|warn|error|info|debug|has|get|set|delete)$/.test(nm)) return true;
    if (c && c.object && c.object.name === 'console') return true;
  }
  if (parent.type === 'TemplateLiteral' && grand && (grand.type === 'TaggedTemplateExpression')) return true;
  return false;
}

// ファイルの中の当たり [{line, start, end, raw, text, hits, speech}]
function scanFile(rel, opts = {}) {
  if (SKIP_FILE.test(rel)) return [];
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');
  let ast;
  try { ast = getParser().parse(src, { sourceType: 'script', plugins: ['jsx'], errorRecovery: true }); } catch (e) { return []; }
  const dialog = DIALOG_FILE.test(path.basename(rel));
  const out = [];
  const visit = (n, parent, grand, saved) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(x => visit(x, parent, grand, saved)); return; }
    if (n.type === 'ObjectProperty' && n.key && SAVED_KEY.test(n.key.name || n.key.value || '')) saved = true;
    if (n.type === 'VariableDeclarator' && n.id && SPEECH_VAR.test(n.id.name || '')) saved = true;
    if (saved) return;
    if (n.type === 'StringLiteral' || n.type === 'TemplateElement' || n.type === 'JSXText') {
      const text = n.type === 'TemplateElement' ? (n.value.cooked || '') : n.value;
      if (/[ぁ-ん]/.test(text) && !skipByParent(n, parent, grand)) {
        const speech = SPEECH.test(text) || (dialog && text.trim().length > SHORT);
        if (!speech || opts.all) {
          const hits = findInText(text);
          if (hits.length) out.push({ line: n.loc.start.line, start: n.start, end: n.end, raw: src.slice(n.start, n.end), text, hits, speech });
        }
      }
    }
    for (const k in n) {
      if (k === 'loc' || /omments$/.test(k) || k === 'extra') continue;
      const v = n[k];
      if (v && typeof v === 'object') visit(v, n, parent, saved);
    }
  };
  visit(ast.program, null, null, false);
  return out;
}

// 置き換え(raw の中で同じ探し方をして置き換える)
function applyFile(rel, filter, opts = {}) {
  const abs = path.join(ROOT, rel);
  let src = fs.readFileSync(abs, 'utf8');
  const items = scanFile(rel).filter(it => !filter || filter(it));
  let n = 0;
  for (const it of items.sort((a, b) => b.start - a.start)) {
    const hits = findInText(it.raw).filter(h => !opts.skipNames || FORM_LIST.some(w => w.h === h.h));
    if (!hits.length) continue;
    let r = it.raw;
    for (const h of hits.sort((a, b) => b.at - a.at)) { r = r.slice(0, h.at) + h.k + r.slice(h.at + h.h.length); n++; }
    src = src.slice(0, it.start) + r + src.slice(it.end);
  }
  fs.writeFileSync(abs, src);
  return n;
}

function targetFiles() {
  const parts = fs.readdirSync(path.join(ROOT, 'monster-hero/src/parts')).filter(f => f.endsWith('.jsx')).map(f => `monster-hero/src/parts/${f}`);
  const data = fs.readdirSync(path.join(ROOT, 'monster-hero/data')).filter(f => f.endsWith('.js')).map(f => `monster-hero/data/${f}`);
  return [...parts, ...data].filter(f => !SKIP_FILE.test(f) && !/rhythm-mode\.js$/.test(f));
}

module.exports = { scanFile, applyFile, findInText, targetFiles, SKIP_FILE, DIALOG_FILE };
