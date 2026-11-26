#!/usr/bin/env node
// クリスマスのミステリーノベルの台本(SCRIPT.md の表)から、ゲームのデータ(monster-hero/src/parts/79-xmas-novel-script.jsx)を作る。
//   node tools/novel/xmas-novel-build.js            本番の台本(docs/progress/event-xmas-2026/SCRIPT.md)から作る。
//                                                     本文(C1- の場面)がまだ無いときは、仮の台本(docs/progress/xmas-novel/SAMPLE.md)から作る
//   node tools/novel/xmas-novel-build.js --sample   仮の台本から作る
//   node tools/novel/xmas-novel-build.js --check    作り直さずに、いまの生成物が台本と同じかだけ見る(違えば 1 で終わる)
//   node tools/novel/xmas-novel-build.js --from <md> 別の台本から作る
// 書き方は docs/progress/xmas-novel/FORMAT.md。気になる所(知らない話し手・答えの手がかりが台本に無い・行き先が無い)は「注意」に出す
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REAL = path.join(ROOT, 'docs/progress/event-xmas-2026/SCRIPT.md');
const SAMPLE = path.join(ROOT, 'docs/progress/xmas-novel/SAMPLE.md');
const OUT = path.join(ROOT, 'monster-hero/src/parts/79-xmas-novel-script.jsx');

// 話し手 → 人のid(79-xmas-novel-engine.jsx の XMAS_NOVEL_CAST)
const SPEAKERS = [
  ['あつ', 'atsu'], ['みゅあ', 'myua'], ['きき', 'kiki'], ['ももすけ', 'momosuke'], ['ドラ', 'dra'], ['きゅうこ', 'kyuko'],
  ['ソラシド', 'sorashido'], ['えるびん', 'erubin'], ['イチーカ', 'ichika'], ['もちまる', 'mochimaru'],
  ['黒羽', 'kuroba'], ['白瀬', 'shirase'], ['ワトソンくん', 'watson'],
];
// 返しの行の英字(-dora など) → 人のid
const PERSON_KEYS = { dora: 'dra', dra: 'dra', mua: 'myua', myua: 'myua', miyua: 'myua', atsu: 'atsu', kiki: 'kiki', momo: 'momosuke', momosuke: 'momosuke',
  kyuko: 'kyuko', sorashido: 'sorashido', sora: 'sorashido', erubin: 'erubin', elvin: 'erubin', ichika: 'ichika', ichiika: 'ichika',
  mochimaru: 'mochimaru', mochi: 'mochimaru', kuroba: 'kuroba', shirase: 'shirase' };
const EXPRESSIONS = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
// 曲の印(SCRIPT.md §5)→ 曲のid。★ は推理の山場の新曲
const BGM_MARKS = {
  日: 'kaze_ga_soyogu', 不: 'melo_dullahan_clockwork', 怖: 'melo_dullahan_steel_ghost', 推: 'melo_dullahan_clockwork_alt',
  決: 'melo_kiss_mystery', 切: 'melo_sad_song_short', 温: 'close_to_your_heart_alt', 戦: 'senjou_no_shippuu', 屋: 'makutsu_no_senritsu',
  ボ: 'original_boss', なし: 'silence', 止: 'silence',
};
// 帯の頭の印 → 演出
const FX_TAGS = { 暗転: 'dark', 白転: 'white', 明転: 'light', ゆれ: 'shake', 揺れ: 'shake', 赤: 'red', 赤い一瞬: 'red', 題字: 'title', 章: 'chapter', 効果音: 'se', 悲鳴: 'se', 帯: 'band', 雪: 'snow' };
const ENDING_KIND = { G: 'good', N: 'normal', B: 'bad', A: 'another' };
const CHAPTER_NO = { 序章: 0, 終章: 9 };

const warn = [];
const note = (where, msg) => warn.push(`${where}: ${msg}`);

// ---- 小さな読み取り ----
const stripMd = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();
const parseCond = (src) => {
  const s = stripMd(src);
  if (!s) return null;
  const any = s.split(/\s*(?:または|\|\||\|| or )\s*/).map((part) => ({
    all: part.split(/\s*(?:かつ|&&|&|、|,| and )\s*/).map((a) => {
      const m = a.match(/^(f_\w+|score|clues)\s*(>=|<=|!=|=|>|<)\s*(-?\d+)$/);
      if (!m) { if (a) note('条件', `読めない「${a}」(f_xxx=1 / score>=7 の形)`); return null; }
      return { k: m[1], op: m[2], v: Number(m[3]) };
    }).filter(Boolean),
  })).filter((g) => g.all.length);
  return any.length ? { any } : null;
};
const parseSets = (src) => String(src || '').split(/\s*[,、]\s*/).map((a) => {
  const m = a.trim().match(/^(f_\w+)\s*(\+=|-=|=)\s*(-?\d+)$/);
  if (!m) { if (a.trim()) note('フラグ', `読めない「${a}」(f_xxx=1 / f_xxx+=1 の形)`); return null; }
  return { k: m[1], op: m[2], v: Number(m[3]) };
}).filter(Boolean);
// 「(→C3-2へ)」の行き先
const takeTo = (text) => {
  let to = null;
  const t = String(text).replace(/[(（]\s*→\s*([A-Za-z0-9\-]+)\s*へ?[^)）]*[)）]/g, (_, id) => { to = id; return ''; }).trim();
  return { text: t, to };
};
// 台詞の「」を外す。」のあとの(…)はト書き(note)
const cleanLine = (raw) => {
  let s = String(raw || '').trim();
  let lead = '';
  const leadM = s.match(/^[(（]([^)）]*)[)）]\s*(?=「)/);
  if (leadM) { lead = leadM[1]; s = s.slice(leadM[0].length); }
  if (s.startsWith('「')) {
    const end = s.lastIndexOf('」');
    if (end > 0) {
      const body = s.slice(1, end);
      const rest = s.slice(end + 1).trim().replace(/^[(（]|[)）]$/g, '').trim();
      return { text: body, note: [lead, rest].filter(Boolean).join(' ') };
    }
  }
  return { text: s, note: lead };
};
const speakerOf = (name) => {
  const n = stripMd(name);
  if (/^[？?]{3}$/.test(n)) return { secret: true };
  const hit = SPEAKERS.find(([ja]) => n === ja || n.startsWith(ja));
  return hit ? { w: hit[1] } : { n };
};

// ---- 場面の見出し ----
//  第4案: | | **C3-1a 雪の上の影** | | 条件: f_kuroba=0 / 曲: 怖 / 背景: 雪原 / 次: C3-2 |
//  第3案(序章): | | **場面1** | | **いつもの広場**(曲: 日・背景: `monhero_plaza`) |
const parseSceneHead = (cells, chapter, seq) => {
  const head = stripMd(cells[1]);
  const info = stripMd(cells[3]);
  let id; let title;
  const m = head.match(/^((?:C\d+-\d+[a-z]?)|(?:END-[A-Z]+))\s*(.*)$/);
  if (m) { id = m[1]; title = m[2].trim(); }
  else {
    const n = head.match(/場面\s*(\d+)/);
    id = `${chapter.id}-${n ? n[1] : seq}`;
    title = info.replace(/[(（].*$/, '').trim();
  }
  const kv = {};
  const keys = [...info.matchAll(/(条件|曲|背景|次)\s*[:：]/g)];
  keys.forEach((k, i) => {
    const from = k.index + k[0].length;
    const to = i + 1 < keys.length ? keys[i + 1].index : info.length;
    kv[k[1]] = info.slice(from, to).replace(/[\s/・)）]+$/, '').replace(/^[\s(（]+/, '').trim();
  });
  const bgmRaw = kv['曲'] || '';
  let bgm = null;
  if (bgmRaw) {
    const idm = bgmRaw.match(/[a-z][a-z0-9_]+/);
    if (idm) bgm = idm[0];
    else if (/★/.test(bgmRaw)) bgm = 'melo_kiss_mystery';
    else {
      const mark = Object.keys(BGM_MARKS).find((k) => bgmRaw.startsWith(k));
      if (mark) bgm = BGM_MARKS[mark]; else note(id, `曲の印「${bgmRaw}」が分からない`);
    }
  }
  const scene = { id, chapter: chapter.id, title, cond: parseCond(kv['条件']), bgm, bg: kv['背景'] || null, next: kv['次'] || null, rows: [] };
  const em = id.match(/^END-([A-Z]+)/);
  if (em) {
    const nameM = title.match(/^(グッド|ノーマル|バッド|あつルート)?\s*[「『]?([^」』]*)[」』]?/);
    scene.ending = { id, kind: ENDING_KIND[em[1]] || 'normal', name: (nameM && nameM[2]) || title };
  }
  return scene;
};

// ---- 選択の行 ----
const parseQuestion = (id, raw) => {
  const text = stripMd(raw);
  const segs = text.split(/\s+\/\s+/);
  const tagText = (segs[0].match(/^((?:【[^】]*】\s*)*)/) || ['', ''])[1];
  const prompt = segs[0].slice(tagText.length).trim();
  const answerSegs = segs.slice(1).filter((s) => /【正解】|正解の手がかり/.test(s));
  const rest = segs.slice(1).filter((s) => !/【正解】|正解の手がかり/.test(s));
  const answers = [];
  // 【正解】のあとは、「 / 」で並べた残りもみな正解(【正解】A / B)
  let inAnswer = false;
  segs.slice(1).forEach((s) => {
    if (/【正解】/.test(s)) inAnswer = true;
    if (inAnswer) s.replace(/^.*【正解】/, '').split(/\s*[/／]\s*/).forEach((a) => { const v = a.replace(/[【】]/g, '').replace(/^正解の手がかり\s*[:：]\s*/, '').trim(); if (v) answers.push(v); });
  });
  const isAction = /^A/.test(id) || /【行動/.test(tagText);
  const isPerson = !isAction && (/人を選ぶ|1段目/.test(tagText));
  const firstM = tagText.match(/一発目で決まる[\s:：]*(f_\w+)?/);
  const q = { t: 'q', id, kind: isAction ? 'action' : isPerson ? 'person' : 'present', x: prompt, replies: {} };
  if (/最後の問い/.test(tagText)) q.group = 'final';
  if (!isAction) q.score = true;
  if (firstM) { q.first = firstM[1] || null; if (!firstM[1]) note(id, '【一発目で決まる】のフラグの名前が無い(【一発目で決まる f_kuroba】の形)'); }
  const label = (tagText.match(/【([^】]*)】/) || [])[1];
  if (label) q.label = label.replace(/・?一発目で決まる[\s:：]*(f_\w+)?/, '').replace(/・?人を選ぶ/, '').trim();
  if (isAction) {
    q.options = rest.map((o) => {
      let s = o; const opt = {};
      s = s.replace(/\[([^\]]*)\]/g, (_, c) => { opt.c = parseCond(c); return ''; });
      s = s.replace(/\{([^}]*)\}/g, (_, c) => { opt.set = parseSets(c); return ''; });
      const t = takeTo(s); if (t.to) opt.to = t.to;
      opt.x = t.text.trim();
      return opt;
    });
    if (!q.options.length) note(id, '行動の選択肢が無い(「 / 」で区切る)');
  } else {
    q.answer = isPerson ? answers.map((a) => { const sp = speakerOf(a); if (!sp.w) note(id, `正解の人「${a}」が分からない`); return sp.w || a; }) : answers;
    if (!answers.length) note(id, '【正解】が無い');
  }
  return q;
};

// ---- 行 ----
const parseRow = (cells, where) => {
  const idCell = stripMd(cells[0]);
  const who = stripMd(cells[1]);
  const face = stripMd(cells[2]);
  const raw = String(cells[3] || '').trim();
  let id = idCell; let cond = null;
  const cm = idCell.match(/^(.*?)\[([^\]]+)\]$/);
  if (cm) { id = cm[1]; cond = parseCond(cm[2]); }
  const row = { id: idCell };
  if (cond) row.c = cond;
  if (who === '選択') return { ...parseQuestion(id, raw), ...(cond ? { c: cond } : {}), id: idCell };
  if (who === '帯' || who === '演出') {
    let s = stripMd(raw); const fx = [];
    for (;;) {
      const m = s.match(/^[(（]([^)）]+)[)）]\s*/);
      if (!m || !FX_TAGS[m[1]]) break;
      fx.push(FX_TAGS[m[1]]); s = s.slice(m[0].length);
    }
    // 終わりの(…)は書いた人への覚え(画面に出さない)。「出す」「画面」「声の主」「確認」を含むものだけ外す
    s = s.replace(/[(（][^)）]*(出す|画面|声の主|確認|ここ)[^)）]*[)）]\s*$/, '').trim();
    row.t = 'band'; row.x = s;
    const uniq = [...new Set(fx.filter((f) => f !== 'band'))];
    if (uniq.length) row.fx = uniq;
    if (fx.includes('se')) row.se = /鐘|時計/.test(s) ? 'bell' : /悲鳴|ドン|バタン|ガタン|ブツン|ザザッ/.test(s) ? 'impact' : /オルゴール|♪/.test(s) ? 'music' : 'tap';
    return row;
  }
  if (who === '手がかり') {
    const m = stripMd(raw).match(/^【([^】]+)】\s*(.*)$/);
    if (!m) { note(where, `手がかりの名前が【】で書かれていない: ${raw.slice(0, 30)}`); return null; }
    let d = m[2].trim(); let add = false;
    if (/^[(（]書き足し[^)）]*[)）]/.test(d)) { add = true; d = d.replace(/^[(（]書き足し[^)）]*[)）]\s*/, ''); }
    return { ...row, t: 'clue', clue: m[1].trim(), x: d, ...(add ? { add: true } : {}) };
  }
  if (who === '並び') {
    const s = stripMd(raw);
    const pick = (label) => { const m = s.match(new RegExp(`${label}\\s*[:：]\\s*([^/(（]+)`)); return m ? m[1].split(/[・、,\s]+/).map((n) => speakerOf(n).w).filter(Boolean) : []; };
    const old = s.match(/白黒のパネル\s*[:：]\s*([^)）]+)/);
    const missing = [...pick('行方不明'), ...(old ? old[1].split(/[・、,\s]+/).map((n) => speakerOf(n).w).filter(Boolean) : [])];
    return { ...row, t: 'panel', x: s.replace(/[(（][^)）]*[)）]/g, '').trim(), missing, hurt: pick('けが'), dead: pick('亡くなった') };
  }
  if (who === 'フラグ') return { ...row, t: 'flag', set: parseSets(stripMd(raw)) };
  // 台詞
  const sp = speakerOf(who);
  const { text, note: memo } = cleanLine(stripMd(raw));
  const line = { ...row, t: 'line', ...sp, x: text };
  if (sp.n) note(where, `知らない話し手「${sp.n}」(名前だけ出す)`);
  if (sp.secret) { line.n = '？？？'; delete line.w; }
  if (face && face !== '—' && face !== '-') { if (EXPRESSIONS.includes(face)) line.e = face; else note(where, `知らない表情「${face}」`); }
  if (memo && !sp.secret && !/声の主/.test(memo)) line.note = memo;
  return line;
};
// 返しの行(Q2a-x1 など)。頭の(…のとき)は外し、(もう一度選ぶ)(→…へ)は読み取って外す
const parseReply = (q, cells, where) => {
  const idCell = stripMd(cells[0]);
  let key = idCell.slice(q.id.length + 1);
  const multi = key.match(/^([^-]+)-\d+$/); // 2行目からの返し(Q7a-dora-2 → dora)
  if (multi) key = multi[1];
  const raw = stripMd(cells[3]);
  let s = raw; let pickedNear = [];
  const lead = s.match(/^[(（]([^)）]*)[)）]\s*/);
  if (lead) { pickedNear = [...lead[1].matchAll(/「([^」]+)」/g)].map((m) => m[1]); s = s.slice(lead[0].length); }
  const t = takeTo(s); s = t.text.replace(/[(（]もう一度[^)）]*[)）]\s*$/, '').trim();
  const row = parseRow([cells[0], cells[1], cells[2], s], where);
  if (!row) return;
  if (t.to) row.to = t.to;
  if (PERSON_KEYS[key]) key = PERSON_KEYS[key];
  if (key === 'near' && pickedNear.length) q.near = [...new Set([...(q.near || []), ...pickedNear])];
  (q.replies[key] = q.replies[key] || []).push(row);
};

// ---- 台本全体 ----
const parseScript = (md, srcName) => {
  const lines = md.split(/\r?\n/);
  const chapters = []; const scenes = [];
  let chapter = null; let scene = null; let lastQ = null; let seq = 0; let started = false;
  const seenRowIds = new Set();
  for (const line of lines) {
    if (/^# 旧案/.test(line)) break;
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      const t = h[1].trim();
      if (/みんなで進む話|レイド/.test(t)) { chapter = null; continue; }
      const cm = t.match(/^(序章|終章|第\s*(\d+)\s*章|エンディング)\s*(?:[～〜]\s*([^～〜]+?)\s*[～〜])?/);
      if (cm) {
        started = true;
        const no = cm[2] ? Number(cm[2]) : CHAPTER_NO[cm[1]];
        if (cm[1] === 'エンディング') { chapter = { id: 'END', no: 99, label: 'エンディング', title: '' }; }
        else chapter = { id: `C${no}`, no, label: cm[1].replace(/\s+/g, ''), title: (cm[3] || '').trim() };
        if (!chapters.some((c) => c.id === chapter.id)) chapters.push(chapter);
        scene = null; lastQ = null; seq = 0;
      } else chapter = null;
      continue;
    }
    if (!started || !chapter || !/^\|/.test(line)) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0].replace(/\s/g, '')) || cells[0] === '番号') continue;
    if (!stripMd(cells[0])) {
      // 見出しの行(番号が空)。「戦う」の見出しはノベルでは使わない
      if (/^\*\*戦う\*\*$/.test(cells[1])) continue;
      seq += 1;
      scene = parseSceneHead(cells, chapter, seq);
      if (scenes.some((s) => s.id === scene.id)) note(scene.id, '場面IDが2回ある');
      scenes.push(scene); lastQ = null;
      continue;
    }
    if (!scene) { seq += 1; scene = { id: `${chapter.id}-${seq}`, chapter: chapter.id, title: '', cond: null, bgm: null, bg: null, next: null, rows: [] }; scenes.push(scene); }
    const idCell = stripMd(cells[0]);
    const where = `${scene.id} ${idCell}`;
    if (lastQ && idCell.startsWith(`${lastQ.id}-`)) { parseReply(lastQ, cells, where); continue; }
    const row = parseRow(cells, where);
    if (!row) continue;
    let uid = `${scene.id}:${row.id}`; let n = 2;
    while (seenRowIds.has(uid)) { uid = `${scene.id}:${row.id}#${n}`; n += 1; }
    seenRowIds.add(uid); row.k = uid;
    scene.rows.push(row);
    lastQ = row.t === 'q' ? row : null;
  }
  return { v: 1, src: srcName, chapters: chapters.filter((c) => scenes.some((s) => s.chapter === c.id)).map(({ id, no, label, title }) => ({ id, no, label, title })), scenes };
};

// ---- 見直し(行き先・答え・エンディング) ----
const lint = (data) => {
  const sceneIds = new Set(data.scenes.map((s) => s.id));
  const rowIds = new Set(); const clueNames = new Set();
  data.scenes.forEach((s) => s.rows.forEach((r) => {
    rowIds.add(r.id.replace(/\[.*$/, ''));
    if (r.t === 'clue') clueNames.add(r.clue);
    if (r.t === 'q') Object.values(r.replies).forEach((list) => list.forEach((x) => { if (x.t === 'clue') clueNames.add(x.clue); }));
  }));
  const base = (id) => id.replace(/^(C\d+-\d+)[a-z]$/, '$1');
  const okTo = (to) => to === 'END' || sceneIds.has(to) || rowIds.has(to) || data.scenes.some((s) => base(s.id) === to);
  data.scenes.forEach((s) => {
    if (s.next && !okTo(s.next)) note(s.id, `次「${s.next}」が台本に無い`);
    s.rows.forEach((r) => {
      if (r.t !== 'q') return;
      if (r.kind === 'present') {
        (r.answer || []).forEach((a) => { if (!clueNames.has(a)) note(r.id, `正解の手がかり「${a}」が手がかりの行に無い`); });
        (r.near || []).forEach((a) => { if (!clueNames.has(a)) note(r.id, `近い手がかり「${a}」が手がかりの行に無い`); });
        if (!r.replies.ok) note(r.id, '正解の返し(-ok)が無い');
        if (!r.replies.x1) note(r.id, 'まちがいの返し(-x1)が無い');
      }
      Object.values(r.replies).forEach((list) => list.forEach((x) => { if (x.to && !okTo(x.to)) note(r.id, `行き先「${x.to}」が台本に無い`); }));
      (r.options || []).forEach((o) => { if (o.to && !okTo(o.to)) note(r.id, `行き先「${o.to}」が台本に無い`); });
    });
  });
  if (!data.scenes.some((s) => s.ending)) note('全体', 'エンディング(END-)の場面が無い');
};

const render = (data) => {
  const json = JSON.stringify(data, null, 0).replace(/\},\{"id"/g, '},\n{"id"');
  return `// ===== クリスマスのミステリーノベルの台本データ(生成物・手で直さない) =====
// 直すのは台本 ${data.src}。作り直し: node tools/novel/xmas-novel-build.js(書き方は docs/progress/xmas-novel/FORMAT.md)
// 形: { v, src, chapters:[{id,no,label,title}], scenes:[{id,chapter,title,cond,bgm,bg,next,ending?,rows:[行]}] }。行の t は line/band/clue/panel/flag/q
const XMAS_NOVEL_SCRIPT = ${json};
`;
};

const main = () => {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  let src = fromIdx >= 0 ? path.resolve(args[fromIdx + 1]) : args.includes('--sample') ? SAMPLE : REAL;
  let md = fs.readFileSync(src, 'utf8');
  let data = parseScript(md, path.relative(ROOT, src));
  if (src === REAL && !data.scenes.some((s) => /^C[1-9]/.test(s.id) || s.ending)) {
    console.log('本番の台本には、まだ第1章からの本文が無い → 仮の台本から作る');
    warn.length = 0; src = SAMPLE; md = fs.readFileSync(src, 'utf8');
    data = parseScript(md, path.relative(ROOT, src));
  }
  lint(data);
  const out = render(data);
  const rows = data.scenes.reduce((n, s) => n + s.rows.length, 0);
  const qs = data.scenes.reduce((n, s) => n + s.rows.filter((r) => r.t === 'q').length, 0);
  const clues = new Set(); data.scenes.forEach((s) => s.rows.forEach((r) => { if (r.t === 'clue') clues.add(r.clue); }));
  console.log(`台本: ${path.relative(ROOT, src)} → 章 ${data.chapters.length} / 場面 ${data.scenes.length} / 行 ${rows} / 選択 ${qs} / 手がかり ${clues.size} / エンディング ${data.scenes.filter((s) => s.ending).length}`);
  if (warn.length) { console.log(`注意 ${warn.length} 件:`); warn.slice(0, 40).forEach((w) => console.log(`  - ${w}`)); }
  if (args.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== out) { console.log('NG: 生成物が台本と違う → node tools/novel/xmas-novel-build.js で作り直す'); process.exit(1); }
    console.log('OK: 生成物は台本と同じ');
    return;
  }
  fs.writeFileSync(OUT, out);
  console.log(`書いた: ${path.relative(ROOT, OUT)}(${Math.round(out.length / 1024)}KB)`);
};

if (require.main === module) main();
module.exports = { parseScript, lint, render };
