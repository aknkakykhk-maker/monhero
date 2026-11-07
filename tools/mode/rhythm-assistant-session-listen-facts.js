#!/usr/bin/env node
// 助手とのセッション Lv.75「曲の聞きどころ」を書くための、曲の特徴の一覧を作る(2026-11-07 ビート部マモリ・社長「全部の曲」)。
// 聞きどころは実際の曲の特徴に合わせる(作り話の歌詞・作曲者の話は書かない)ので、書く人はこの一覧の事実だけを使う。
//
//   node tools/mode/rhythm-assistant-session-listen-facts.js            … docs/progress/beat-assistant-session/lines/listen-facts.md を書き直す
//   node tools/mode/rhythm-assistant-session-listen-facts.js <曲id>     … その曲の特徴だけを画面に出す(新曲を足すとき)
//
// 事実の出どころ: 曲の一覧(data/rhythm-mode.js の RHYTHM_SONGS・RHYTHM_SONG_CLIMAX)と、譜面を作るときの音の解析
// (tools/mode/authoring/<曲>-v3-audio.json のテンポ・節の強さ・音の性格)。どちらも読むだけ。
// 曲の別の版(短い版・フル版)は1つにまとめる(rhythmAssistSessionListenBase と同じ決まり)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(`${src};this.__S=RHYTHM_SONGS;this.__C=typeof RHYTHM_SONG_CLIMAX!=='undefined'?RHYTHM_SONG_CLIMAX:{};`, ctx);
const SONGS = ctx.__S; const CLIMAX = ctx.__C;
const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'rhythm-released-chart-lock.json'), 'utf8'));
const released = [...new Set(Object.keys(lock.charts).map((k) => k.split(/[:|@/]/)[0]))];
// 別の版を1つにまとめる: 末尾の _short・_full を外した id がある曲は、その id へ
const baseOf = (id) => { const b = id.replace(/_(short|full)$/, ''); return b !== id && SONGS.some((s) => s.songId === b) ? b : id; };
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const factsOf = (id) => {
  const song = SONGS.find((s) => s.songId === id);
  if (!song) return null;
  const versions = released.filter((x) => baseOf(x) === id);
  const diffs = song.difficulties || {};
  const top = diffs.MASTER || diffs.EXPERT || Object.values(diffs).slice(-1)[0] || {};
  const lines = [`## ${id}`, `- 曲名: ${song.displayName}${versions.length > 1 ? `(版: ${versions.join('・')})` : ''}`, `- 長さ: ${mmss(Number(top.durationMs) || 0)}`];
  // 解析ファイルの名前は id の「_」を「-」にしたもの。無ければ別の版(短い版)・決まった別名の解析を使う
  const dash = id.replace(/_/g, '-');
  const ALIAS = { monster_hero: 'monster-hero-theme', monster_hero_another: 'monster-hero-theme-alt' };
  const auth = [ALIAS[id], dash, `${dash}-short`, `${dash}-full`, ...versions.map((v) => v.replace(/_/g, '-'))].filter(Boolean)
    .map((n) => path.join(__dirname, 'authoring', `${n}-v3-audio.json`)).find((f) => fs.existsSync(f)) || '';
  if (auth) {
    const j = JSON.parse(fs.readFileSync(auth, 'utf8'));
    if (j.timing && j.timing.bpm) lines.push(`- テンポ: およそ BPM ${Math.round(j.timing.bpm)}`);
    // 音源が譜面より長い曲(デュラハンの2曲は音源をバトルと共用)は、譜面の長さを越えた区間を出さない(2026-11-07 コトバの指摘)
    const limit = Number(top.durationMs) || Infinity;
    const secs = ((j.structure && j.structure.sections) || []).filter((x) => Number(x.startMs) < limit);
    if (secs.length) {
      const max = Math.max(...secs.map((x) => x.intensity || 0)) || 1;
      const word = (v) => (v / max >= 0.85 ? 'いちばん強い' : v / max >= 0.55 ? '強め' : v / max >= 0.3 ? 'ふつう' : '静か');
      lines.push(`- 盛り上がりの流れ: ${secs.map((x) => `${mmss(x.startMs)} ${word(x.intensity || 0)}`).join(' → ')}`);
    }
    const cc = j.summary && j.summary.characterCounts;
    if (cc) {
      const total = Object.values(cc).reduce((a, b) => a + b, 0) || 1;
      const punch = (cc.PUNCH || 0) / total; const light = (cc.LIGHT || 0) / total;
      lines.push(`- 音の性格: ${punch >= 0.4 ? '強く打つ音が多い' : light >= 0.3 ? '軽く細かい音が多い' : '強い音と軽い音がまざる'}(強い ${Math.round(punch * 100)}%・軽い ${Math.round(light * 100)}%)`);
    }
  }
  const cl = (CLIMAX[id] || []).filter((x) => Number(x[2]) >= 0.9).map((x) => `${mmss(x[0])}〜${mmss(x[1])}`);
  if (cl.length) lines.push(`- サビ(いちばん盛り上がる所): ${cl.join('・')}`);
  if (top.totalNotes) lines.push(`- いちばん上の難易度: Lv.${top.level}・${top.totalNotes}ノーツ`);
  return lines.join('\n');
};

const one = process.argv[2];
if (one) { const f = factsOf(baseOf(one)); console.log(f || `NG: 曲 ${one} が見つからない`); process.exit(f ? 0 : 1); }
const bases = [...new Set(released.map(baseOf))];
const out = [
  '# 曲の聞きどころ — 曲の特徴の一覧(生成物。手で直さない)',
  '',
  '`node tools/mode/rhythm-assistant-session-listen-facts.js` で書き直す。聞きどころの台詞は、この一覧の事実だけを使って書く',
  '(作り話の歌詞・作曲者や歌い手の話は書かない。社長 2026-11-07)。書き方は `lines/LISTEN-GUIDE.md`。',
  `曲 ${bases.length}曲(別の版は1つにまとめた)。`,
  '',
  ...bases.map((id) => `${factsOf(id)}\n`),
].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs/progress/beat-assistant-session/lines/listen-facts.md'), out);
console.log(`書き直しました: ${bases.length}曲 → docs/progress/beat-assistant-session/lines/listen-facts.md`);
