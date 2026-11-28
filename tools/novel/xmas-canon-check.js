#!/usr/bin/env node
// 事件簿の辻褄の見張り(r1126-115 追記4): 台本の場面の見出しに書いた「時刻: <区間>」と、正典の表 CANON.md の「居場所の表」を突き合わせる。
//   その区間に、表で「亡くなった」人が話していないか / 表の居場所と違う場面に出ていないか / 「隠れている」人が人前に出ていないか / 区間の名前が表にあるか
//   見出しに「もしも」と書いた場面(ネタ・別ジャンル)は外す。「時刻」の無い場面は見ない(本編は今のまま)
// 使い方: node tools/novel/xmas-canon-check.js [--self] [--from <md>...]
//   --self … 表そのものの見直しと、わざと食い違えた台本で NG になるかを確かめる(検査の検査)
//   ふだんは SCRIPT.md と docs/progress/event-xmas-2026/arcs/*.md を見る。最後に OK / NG の要約だけを出す
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs/progress/event-xmas-2026');
const CANON = path.join(DIR, 'if-routes-r1126-115/CANON.md');
const NAMES = ['あつ', 'みゅあ', 'きき', 'ももすけ', 'ドラ', 'きゅうこ', 'ソラシド', 'えるびん', 'イチーカ', 'もちまる', '黒羽', '白瀬', 'ワトソンくん'];

const cellsOf = (line) => line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
const strip = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();

// 正典: 日付の並びの区間と、居場所の表
const readCanon = (md) => {
  const spans = new Set();
  const where = {}; // where[区間][人] = { places:[], state }
  let sec = '';
  md.split('\n').forEach((line) => {
    const h = line.match(/^##\s+(.*)$/); if (h) { sec = h[1]; return; }
    if (!/^\|/.test(line)) return;
    const c = cellsOf(line);
    if (/^-+$/.test(c[0].replace(/\s/g, '')) || c[0] === '区間') return;
    if (/^日付の並び/.test(sec) && c[0]) spans.add(c[0]);
    if (/^居場所の表/.test(sec) && c.length >= 4) {
      const [span, who, place, state] = c;
      (where[span] = where[span] || {})[who] = { places: place === '—' ? [] : place.split(/[・、]/).map((p) => p.trim()).filter(Boolean), state };
    }
  });
  return { spans, where };
};

// 台本: 「時刻」のある場面と、その場面の話し手
const readScenes = (md, file) => {
  const out = [];
  let cur = null;
  md.split('\n').forEach((line, i) => {
    if (!/^\|/.test(line)) return;
    const c = cellsOf(line);
    if (c.length < 4) return;
    const head = strip(c[1]);
    const hm = !strip(c[0]) && head.match(/^((?:C\d+-[0-9A-Za-z]+)|(?:END-[A-Z]+\d*)|(?:[A-Z]{2,}\d*-[0-9A-Za-z-]+))\b/);
    if (hm) {
      const info = strip(c[3]);
      const t = info.match(/時刻\s*[:：]\s*([A-Z0-9]+)/);
      const bg = (info.match(/背景\s*[:：]\s*([^/]+)/) || [])[1] || '';
      cur = t ? { id: hm[1], span: t[1], bg: bg.trim(), ifonly: /もしも/.test(info), file, line: i + 1, speakers: new Set() } : null;
      if (cur) out.push(cur);
      return;
    }
    if (cur && NAMES.includes(strip(c[1]))) cur.speakers.add(strip(c[1]));
  });
  return out;
};

const check = (canon, scenes) => {
  const ng = [];
  scenes.forEach((sc) => {
    const at = `${sc.file}:${sc.line} ${sc.id}`;
    if (sc.ifonly) return;
    if (!canon.spans.has(sc.span)) { ng.push(`${at}: 時刻「${sc.span}」が CANON.md の日付の並びに無い`); return; }
    const row = canon.where[sc.span] || {};
    sc.speakers.forEach((who) => {
      const w = row[who];
      if (!w) return;
      if (/亡くなった/.test(w.state)) ng.push(`${at}: ${who} は ${sc.span} には亡くなっている(話させるなら見出しに「もしも」・声だけなら話し手を ？？？ に)`);
      else if (w.places.length && !w.places.some((p) => sc.bg.includes(p))) ng.push(`${at}: ${who} は ${sc.span} に「${w.places.join('・')}」にいる(この場面の背景は「${sc.bg}」)`);
      else if (/隠れている/.test(w.state) && !w.places.some((p) => sc.bg.includes(p))) ng.push(`${at}: ${who} は ${sc.span} に隠れている`);
    });
  });
  return ng;
};

const main = () => {
  const args = process.argv.slice(2);
  const canon = readCanon(fs.readFileSync(CANON, 'utf8'));
  const ng = [];
  if (!canon.spans.size || !Object.keys(canon.where).length) ng.push('CANON.md の「日付の並び」か「居場所の表」が読めない');
  Object.keys(canon.where).forEach((sp) => { if (!canon.spans.has(sp)) ng.push(`CANON.md の居場所の表の区間「${sp}」が、日付の並びに無い`); });
  Object.values(canon.where).forEach((r) => Object.keys(r).forEach((who) => { if (!NAMES.includes(who)) ng.push(`CANON.md の居場所の表に知らない人「${who}」`); }));

  if (args.includes('--self')) {
    // わざと食い違えた場面: 亡くなった黒羽が話す / 台所にいるはずのドラが雪原にいる / 隠れているきゅうこがホールにいる / 知らない区間 / もしもは外れる
    const bad = [
      '| | **C2-Q1 テスト** | | 時刻: D4 / 背景: ペンションのホール |', '| q-1 | 黒羽 | — | 「……」 |',
      '| | **C2-Q2 テスト** | | 時刻: D2B / 背景: 朝の雪原 |', '| q-2 | ドラ | normal | 「……」 |',
      '| | **C2-Q3 テスト** | | 時刻: D7 / 背景: ペンションのホール |', '| q-3 | きゅうこ | normal | 「……」 |',
      '| | **C2-Q4 テスト** | | 時刻: Z9 / 背景: 台所 |', '| q-4 | あつ | normal | 「……」 |',
      '| | **C2-Q5 テスト** | | もしも / 時刻: D4 / 背景: ペンションのホール |', '| q-5 | 黒羽 | — | 「……」 |',
      '| | **C2-Q6 テスト** | | 時刻: D2B / 背景: 台所 |', '| q-6 | ドラ | normal | 「……」 |',
    ].join('\n');
    const got = check(canon, readScenes(bad, 'self'));
    const want = ['C2-Q1', 'C2-Q2', 'C2-Q3', 'C2-Q4'];
    want.forEach((id) => { if (!got.some((g) => g.includes(id))) ng.push(`検査の検査: ${id} が NG にならない`); });
    ['C2-Q5', 'C2-Q6'].forEach((id) => { if (got.some((g) => g.includes(id))) ng.push(`検査の検査: ${id} が NG になった(OK のはず)`); });
  }

  const files = [];
  const fromIdx = args.indexOf('--from');
  if (fromIdx >= 0) args.slice(fromIdx + 1).filter((a) => !/^--/.test(a)).forEach((f) => files.push(path.resolve(f)));
  else {
    files.push(path.join(DIR, 'SCRIPT.md'));
    const arcs = path.join(DIR, 'arcs');
    if (fs.existsSync(arcs)) fs.readdirSync(arcs).filter((f) => /\.md$/.test(f) && f !== 'README.md').sort().forEach((f) => files.push(path.join(arcs, f)));
  }
  let n = 0;
  files.forEach((f) => { const sc = readScenes(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f)); n += sc.length; ng.push(...check(canon, sc)); });
  ng.slice(0, 30).forEach((m) => console.log(`NG: ${m}`));
  if (ng.length > 30) console.log(`… ほか ${ng.length - 30} 件`);
  console.log(ng.length ? `NG ${ng.length} 件(時刻のある場面 ${n})` : `OK: 正典の表と台本の時刻・居場所が合っている(時刻のある場面 ${n}・表の区間 ${canon.spans.size})`);
  process.exit(ng.length ? 1 : 0);
};
main();
