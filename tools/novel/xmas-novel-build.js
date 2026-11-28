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
// 過去編(12年前の聖夜)だけに出る、立ち絵の無い話し手(名前だけ出す。注意に出さない・r1126-046)
const PAST_SPEAKERS = ['カノン', '祖父', '幼いきゅうこ', '幼いイチーカ', '幼いももすけ', 'ももすけの母', '薬屋の主人', '幼いえるびん'];
// 返しの行の英字(-dora など) → 人のid
const PERSON_KEYS = { dora: 'dra', dra: 'dra', mua: 'myua', myua: 'myua', miyua: 'myua', atsu: 'atsu', kiki: 'kiki', momo: 'momosuke', momosuke: 'momosuke',
  kyuko: 'kyuko', sorashido: 'sorashido', sora: 'sorashido', erubin: 'erubin', elvin: 'erubin', ichika: 'ichika', ichiika: 'ichika',
  mochimaru: 'mochimaru', mochi: 'mochimaru', kuroba: 'kuroba', shirase: 'shirase' };
const EXPRESSIONS = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
// 眠った顔はドラだけ(絵が santa/dra_sleep.PNG にしかない・r1126-077)
const SLEEP_FACE_WHO = ['dra'];
// 曲の印(SCRIPT.md §5)→ 曲のid。★ は推理の山場の新曲
const BGM_MARKS = {
  日: 'kaze_ga_soyogu', 不: 'melo_dullahan_clockwork', 怖: 'melo_dullahan_steel_ghost', 推: 'melo_dullahan_clockwork_alt',
  決: 'melo_kiss_mystery', 切: 'melo_sad_song_short', 温: 'close_to_your_heart_alt', 戦: 'senjou_no_shippuu', 屋: 'makutsu_no_senritsu',
  ボ: 'original_boss', なし: 'silence', 止: 'silence',
};
// 帯の頭の印 → 演出
const FX_TAGS = { 赤いにじみ: 'bleed', 倒れた影: 'fallen', 赤く光る: 'red', 幕が下りる: 'curtainDown', 幕がおりる: 'curtainDown', 幕が上がる: 'curtainUp', 幕があがる: 'curtainUp', 暗転: 'dark', 白転: 'white', 明転: 'light', ゆれ: 'shake', 揺れ: 'shake', 赤: 'red', 赤い一瞬: 'red', 題字: 'title', 章: 'chapter', 効果音: 'se', 悲鳴: 'se', 帯: 'band', 雪: 'snow', 手紙: 'letter' };
// 音の印(〔音:鐘〕など・r1126-066)→ 画面の xmasNovelSe の種類
const SOUND_MARKS = { 鐘: 'bell', 時計: 'tick', 柱時計: 'tick', 手紙: 'letter' };
// (手紙) … 紙の手紙を赤い字で浮かべる(文の「／」で改行・r1126-058)
const ENDING_KIND = { G: 'good', N: 'normal', B: 'bad', A: 'another', X: 'forced', M: 'accuse', O: 'omake' };
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
      // end_G … そのエンディングを見たことがある(エンドヒストリー)なら 1(r1126-062 おまけの選択肢)
      const m = a.match(/^(f_\w+|score|clues|end_[A-Z]+\d*)\s*(>=|<=|!=|=|>|<)\s*(-?\d+)$/);
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
  if (n === '全員' || n === 'みんな') return { n, crowd: true };
  // 過去編だけの人は名前だけ(「ももすけの母」を、頭の「ももすけ」で本人の顔にしない)
  if (PAST_SPEAKERS.includes(n)) return { n };
  const hit = SPEAKERS.find(([ja]) => n === ja || n.startsWith(ja));
  return hit ? { w: hit[1] } : { n };
};

// ---- 立ち絵の見せ方(r1126-067) ----
//  〔立ち:寄り〕胸から上を大きく(緊迫・告白・推理の決め台詞・泣く所) / 〔立ち:ふだん〕頭から腰(既定) / 〔立ち:引き〕全身を小さめ(登場・集まる所・離れて立つ所)
//  場面の見出しの行に書くと場面ぜんぶ、台詞の行に書くとその行だけ(行の印が場面の印より強い)
const FRAME_MARK = /〔\s*立ち\s*[:：]\s*([^〕]+?)\s*〕/g;
const FRAMES = { 寄り: 'close', ふだん: 'normal', 引き: 'far' };
const frameOf = (k, where) => { const f = FRAMES[String(k).trim()]; if (!f) note(stripMd(where || ''), `立ち絵の印「${k}」が分からない(寄り・ふだん・引き)`); return f || ''; };

// ---- 場面の見出し ----
//  第4案: | | **C3-1a 雪の上の影** | | 条件: f_kuroba=0 / 曲: 怖 / 背景: 雪原 / 次: C3-2 |
//  第3案(序章): | | **場面1** | | **いつもの広場**(曲: 日・背景: `monhero_plaza`) |
const parseSceneHead = (cells, chapter, seq) => {
  const head = stripMd(cells[1]);
  // 〔立ち:寄り〕〔立ち:引き〕… この場面の立ち絵の見せ方(r1126-067)。印が無ければ「ふだん」(頭から腰)
  let frame = '';
  const info = stripMd(cells[3]).replace(FRAME_MARK, (_, k) => { frame = frameOf(k, cells[1]); return ''; }).trim();
  let id; let title;
  const m = head.match(/^((?:C\d+-[0-9A-Za-z]+)|(?:END-[A-Z]+\d*(?:-[0-9A-Za-z]+)*)|(?:[A-Z]{2,}\d*-[0-9A-Za-z-]+))\s*(.*)$/);
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
    const idm = bgmRaw.split(/→/)[0].match(/[a-z][a-z0-9_]+/);
    if (idm) bgm = idm[0];
    else if (/★/.test(bgmRaw)) bgm = 'melo_kiss_mystery';
    else {
      const mark = Object.keys(BGM_MARKS).find((k) => bgmRaw.split(/→/)[0].trim().startsWith(k));
      if (mark) bgm = BGM_MARKS[mark]; else note(id, `曲の印「${bgmRaw}」が分からない`);
    }
  }
  // 条件が文で書いてある場面(「Q7a でドラを選んだ」など)は、問いの行き先でだけ入る場面(jumpOnly)にする
  const condSrc = kv['条件'] || '';
  const condOk = /^[\sf_\w=<>!&|,、]*$|かつ|または/.test(condSrc) && /f_\w+|score|clues/.test(condSrc);
  const cond = condSrc && condOk ? parseCond(condSrc) : null;
  const nextRaw = (kv['次'] || '').trim();
  // 「G-10(そのままクリスマス会へ)」のように、ID のうしろの覚え書きは読み飛ばす
  // 「「選択の直前からやり直す」で A2 へ」… やり直しの行き先(選択の行)
  const retryM = nextRaw.match(/やり直す[^A-Z]*?([AQ]\d+[a-z]*)\s*へ/);
  const nextTok = retryM ? retryM[1] : (nextRaw.match(/^([A-Za-z0-9][0-9A-Za-z-]*)/) || [])[1] || '';
  const next = /^(C\d+-[0-9A-Za-z]+|END-[A-Z]+\d*(?:-[0-9A-Za-z]+)*|END|Q\d+[a-z]+|A\d+[a-z]*|[A-Z]{2,}\d*-[0-9A-Za-z-]+|[A-Z]-\d+[a-z0-9]*)$/.test(nextTok) ? nextTok : null;
  // カーテンコールの差しこみ: 「END-G の G-9 のあと」「END-N のあと」
  const afterM = condSrc.match(/(END-[A-Z]+)(?:\s*の\s*([A-Z]-[0-9a-z]+))?\s*のあと/);
  const bgRaw = (kv['背景'] || '').split(/→/)[0].trim();
  const scene = { id, chapter: chapter.id, title, cond, bgm, bg: bgRaw || null, next, rows: [] };
  if (frame && frame !== 'normal') scene.frame = frame;
  if (condSrc && !cond) scene.jumpOnly = true;
  if (/^外側/.test(info)) scene.outside = true; // ゲームの外(助手たち本人)の場面
  // 過去編(真グッドを見たあと「章から」で読む章)の場面は、並びでは入らない。最後の場面のあとは起動画面へ戻る(r1126-046)
  if (chapter.past) { scene.past = true; scene.jumpOnly = true; }
  if (afterM) scene.after = { scene: afterM[1], row: afterM[2] || null };
  // カーテンコールの場面(題か ID に「カーテンコール」「CC」)。エンディングの場面の「次」でつなぐ
  if (/カーテンコール/.test(title) || /(^|-)CC(-|$)/.test(id)) scene.curtain = true;
  const em = !scene.curtain && id.match(/^END-([A-Z]+)\d*$/);
  if (em) {
    // 名前は見出しの題か、「### END-G 真グッド「…」」の小見出しから
    const src = title || (chapter.endingNames && chapter.endingNames[id]) || '';
    const nameM = src.match(/^([^「『]*?)\s*[「『]([^」』]*)[」』]/);
    scene.ending = { id, kind: ENDING_KIND[em[1]] || 'normal', label: nameM ? nameM[1].trim() : '', name: nameM ? nameM[2] : src };
  }
  return scene;
};

// ---- 選択の行 ----
//  突きつけ / 人を選ぶ / 行動 / やり直しのない推理(行き先の書き添え「(ドラ → C7-A へ。きゅうこ → Q7m へ。ほか → C7-B へ)」がある問い)
const CIRCLED = '①②③④⑤⑥⑦⑧⑨';
// 「(… → … へ。…)」の書き添えを切り出す(中に括弧があってもよい)
const takeRouteNote = (seg) => {
  const arrow = seg.indexOf('→');
  if (arrow < 0) return { seg, note: '' };
  const open = Math.max(seg.lastIndexOf('(', arrow), seg.lastIndexOf('（', arrow));
  if (open < 0) return { seg, note: '' };
  if (!seg.slice(open + 1, arrow).trim()) return { seg, note: '' }; // 「(→5-3-7 へ)」は選択肢の行き先(書き添えではない)
  return { seg: seg.slice(0, open).trim(), note: seg.slice(open + 1).replace(/[)）]\s*$/, '') };
};
const routeKeyOf = (lhs) => {
  const t = lhs.replace(/[(（][^)）]*[)）]/g, '').trim();
  if (/^(ほかの人|ほか|それ以外|そのほか)$/.test(t)) return '*';
  if (/まだ決めない/.test(t)) return '__undecided';
  const c = CIRCLED.indexOf(t[0]);
  if (c >= 0 && t.length === 1) return `o${c}`;
  const sp = speakerOf(t);
  return sp.w || null;
};
const parseRoutes = (note, where) => {
  const route = {};
  note.split(/。/).forEach((part) => {
    const m = part.match(/^(.*?)→\s*(.*)$/);
    if (!m) return;
    const to = (m[2].match(/(C\d+-[0-9A-Za-z]+|END-[A-Z]+\d*|Q\d+[a-z]+)/) || [])[1];
    if (!to) return;
    m[1].split(/[・、,]/).forEach((l) => { const k = routeKeyOf(l.trim()); if (k) route[k] = to; else if (l.trim()) note && notes(where, `行き先の「${l.trim()}」が分からない`); });
  });
  return route;
};
const notes = (where, msg) => note(where, msg);
const NOSCORE = /2回目|推理の問い⑦|数えない/;
const parseQuestion = (id, raw) => {
  const text = stripMd(raw);
  let segs = text.split(/\s+\/\s+/);
  const last = takeRouteNote(segs[segs.length - 1]);
  segs[segs.length - 1] = last.seg;
  const tagText = (segs[0].match(/^((?:【[^】]*】\s*)*)/) || ['', ''])[1];
  let prompt = segs[0].slice(tagText.length).trim();
  const pc = cleanLine(prompt.replace(/[(（][^)）]*[)）]\s*$/, '')); prompt = pc.text;
  const isAction = /^A/.test(id) || /【行動|動機を選ぶ/.test(tagText);
  const isPerson = !isAction && /人を選ぶ|1段目/.test(tagText);
  const firstM = tagText.match(/一発目で決まる[\s:：]*(f_\w+)?/);
  const q = { t: 'q', id, kind: isAction ? 'action' : isPerson ? 'person' : 'present', x: prompt, replies: {} };
  const label = (tagText.match(/【([^】]*)】/) || [])[1];
  if (label) q.label = label.replace(/・?一発目で決まる[\s:：]*(f_\w+)?/, '').replace(/・?人を選ぶ/, '').replace(/・?動機を選ぶ/, '').trim();
  if (/最後の問い|1回目の推理/.test(tagText)) q.group = 'final';
  if (!/^A/.test(id) && !NOSCORE.test(tagText)) q.score = true;
  if (firstM) { q.first = firstM[1] || null; if (!firstM[1]) note(id, '【一発目で決まる】のフラグの名前が無い(【一発目で決まる f_kuroba】の形)'); }
  if (last.note) { q.route = parseRoutes(last.note, id); q.once = true; }
  const rest = segs.slice(1);
  if (isAction) {
    q.options = rest.filter((o) => !/^正解の手がかり/.test(o)).map((o, i) => {
      let t = o; const opt = {};
      if (/【正解】/.test(t)) { (q.answer = q.answer || []).push(i); t = t.replace(/【正解】/g, ''); }
      t = t.replace(/\[([^\]]*)\]/g, (_, c) => { opt.c = parseCond(c); return ''; });
      t = t.replace(/\{([^}]*)\}/g, (_, c) => { opt.set = parseSets(c); return ''; });
      const tt = takeTo(t); if (tt.to) opt.to = tt.to;
      opt.x = tt.text.replace(new RegExp(`^[${CIRCLED}]\\s*`), '').trim();
      return opt;
    });
    if (!q.options.length) note(id, '行動の選択肢が無い(「 / 」で区切る)');
    if (!q.answer) delete q.score;
    return q;
  }
  const answers = [];
  if (isPerson && rest.length > 2) {
    // 人の名前を並べて書く形(Q7a): 【正解】の付いた人が正解。人でない物(「まだ決めない」)は選択肢を足す
    rest.forEach((o) => {
      const ok = /【正解】/.test(o);
      const name = o.replace(/【正解】/g, '').trim();
      const sp = speakerOf(name.replace(/[(（].*$/, ''));
      if (sp.w) { if (ok) answers.push(sp.w); }
      else if (name) (q.extra = q.extra || []).push({ key: /まだ決めない/.test(name) ? '__undecided' : `x${(q.extra || []).length}`, x: name.replace(/[(（]([^)）]*)[)）]/, '($1)') });
    });
  } else {
    let inAnswer = false;
    rest.forEach((sg) => {
      if (/【正解】/.test(sg)) inAnswer = true;
      if (inAnswer) sg.replace(/^.*【正解】/, '').split(/\s*[/／]\s*/).forEach((a) => { const v = a.replace(/[【】]/g, '').replace(/^正解の手がかり\s*[:：]\s*/, '').trim(); if (v) answers.push(isPerson ? (speakerOf(v).w || v) : v); });
    });
  }
  q.answer = answers;
  if (!answers.length) note(id, '【正解】が無い');
  return q;
};

// ---- パネルの文 ----
const PANEL_NAMES = SPEAKERS.filter(([, id]) => id !== 'watson');
const panelOpsOf = (text) => {
  const hits = [];
  PANEL_NAMES.forEach(([ja, id]) => { let i = text.indexOf(ja); while (i >= 0) { hits.push({ at: i, end: i + ja.length, id }); i = text.indexOf(ja, i + ja.length); } });
  hits.sort((a, b) => a.at - b.at);
  const kindOf = (seg) => (/色が戻|白い花が消え|バツが消え/.test(seg) ? 'normal' : /白い花|赤いバツ|バツ|暗く|暗い/.test(seg) ? 'dead' : /行方不明/.test(seg) ? 'missing' : /けが/.test(seg) ? 'hurt' : '');
  const ops = []; let group = [];
  hits.forEach((h, i) => {
    const seg = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : text.length);
    group.push(h.id);
    if (/^[\s・、とも]*$/.test(seg) && i + 1 < hits.length) return; // 並んだ名前は、次の名前の文と同じ
    const k = kindOf(seg.split(/。/)[0]);
    if (k) group.forEach((id) => ops.push({ id, st: k }));
    group = [];
  });
  return ops;
};

// ---- 行 ----
const parseRow = (cells, where) => {
  const idCell = stripMd(cells[0]);
  const who = stripMd(cells[1]);
  const face = stripMd(cells[2]);
  let frame = '';
  const raw = String(cells[3] || '').replace(FRAME_MARK, (_, k) => { frame = frameOf(k, where); return ''; }).trim();
  let id = idCell; let cond = null;
  const cm = idCell.match(/^(.*?)\[([^\]]+)\]$/);
  if (cm) { id = cm[1]; cond = parseCond(cm[2]); }
  // あつ派/ソラシド派(番号の末尾 a / s・第1章の A1 の1つめ/2つめ)。
  //   本編の 7-1-3a のほか、強制バッドの 2-X-4a・場面の 7-A-1a・エンドの G-17a・外側の OUT-G-3a も(r1126-043 主役の書き分け)
  else if (/^(?:[A-Z]+\d*-|\d+-)(?:[0-9A-Z]+-)*\d+a$/.test(idCell)) cond = { any: [{ all: [{ k: 'f_A1', op: '=', v: 1 }] }] };
  else if (/^(?:[A-Z]+\d*-|\d+-)(?:[0-9A-Z]+-)*\d+s$/.test(idCell)) cond = { any: [{ all: [{ k: 'f_A1', op: '=', v: 2 }] }] };
  // 結びの一言(末尾 g3 = 7問とも / g2 = 4〜6問 / g1 = 3問以下)
  else if (/g3$/.test(idCell)) cond = { any: [{ all: [{ k: 'score', op: '>=', v: 7 }] }] };
  else if (/g2$/.test(idCell)) cond = { any: [{ all: [{ k: 'score', op: '>=', v: 4 }, { k: 'score', op: '<=', v: 6 }] }] };
  else if (/g1$/.test(idCell) && /^[A-Z]-/.test(idCell)) cond = { any: [{ all: [{ k: 'score', op: '<=', v: 3 }] }] };
  const row = { id: idCell };
  if (cond) row.c = cond;
  // 条件つきの選択の行(`A7[f_A1=2]`)は、問いのIDを条件の前まで(f_A7。保存の正規化 /^f_\w+$/ で消えない・r1126-077)
  if (who === '選択') return { ...parseQuestion(id, raw), ...(cond ? { c: cond } : {}), id: cm ? id : idCell };
  if (who === '帯' || who === '演出') {
    let s = stripMd(raw); const fx = [];
    // 〔遺体:黒羽〕… 亡くなっているのが見つかる行。その人の立ち絵を黒い影にして倒し、血だまりを広げる(r1126-065)。
    //   〔遺体:主役〕〔遺体:相手〕は A1 で選んだ方 / 選ばなかった方(画面が f_A1 で決める)。行の頭か末尾に書く
    let body = '';
    s = s.replace(/〔遺体\s*[:：]\s*([^〕]+)〕/g, (_, n) => {
      const k = n.trim();
      const w = k === '主役' ? 'lead' : k === '相手' ? 'partner' : speakerOf(k).w;
      if (w) body = w; else note(where, `遺体の印の人が分からない「${k}」`);
      return '';
    }).trim();
    // 〔血なし〕… 遺体の行で、血だまりと床の赤みを出さない(凍えて・首を絞められて亡くなった場面。2026-11-28 ミハリの総点検 5番)
    let noBlood = false;
    s = s.replace(/〔血なし〕/g, () => { noBlood = true; return ''; }).trim();
    // 〔音:鐘〕〔音:時計〕〔音:手紙〕… その行で鳴らす効果音(r1126-066)。鐘は「ボーン」、時計は「カチ」の数だけ鳴らす(3回まで)。
    //   〔音:鐘×2〕のように回数も書ける。行のどこに書いてもよい(画面には出さない)
    let snd = ''; let sndN = 0;
    s = s.replace(/〔音\s*[:：]\s*([^〕×xX]+?)\s*(?:[×xX]\s*(\d+))?\s*〕/g, (_, n, c) => {
      const k = SOUND_MARKS[n.trim()];
      if (!k) { note(where, `知らない音の印「${n.trim()}」`); return ''; }
      snd = k; sndN = c ? Number(c) : 0;
      return '';
    }).trim();
    if (snd && !sndN) sndN = snd === 'bell' ? (s.match(/ボーン/g) || []).length : snd === 'tick' ? (s.match(/カチ(?![リャッ])/g) || []).length : 1;
    for (;;) {
      const m = s.match(/^[(（]([^)）]+)[)）]\s*/);
      if (!m || !FX_TAGS[m[1]]) break;
      fx.push(FX_TAGS[m[1]]); s = s.slice(m[0].length);
    }
    // (演出:赤いにじみ)(演出:赤く光る)(演出:倒れた影)… 死ぬ場面の演出(社長 2026-11-26「文章ははっきり、絵は演出で」)。文のどこにあってもよい
    s = s.replace(/[(（]演出\s*[:：]\s*([^)）]+)[)）]/g, (_, w) => {
      w.split(/[・、,\s]+/).forEach((x) => { const k = /にじみ|血/.test(x) ? 'bleed' : /倒れた影|倒れ/.test(x) ? 'fallen' : /赤/.test(x) ? 'red' : /暗転/.test(x) ? 'dark' : /白/.test(x) ? 'white' : /ゆれ|揺れ/.test(x) ? 'shake' : ''; if (k) fx.push(k); else if (x) note(where, `知らない演出「${x}」`); });
      return '';
    }).trim();
    // 文の中の(…幕が下りる)(…幕が上がる)も演出(「(効果音)パチパチ……(幕が下りる)」「カーン(開演の鐘。幕が上がる)」)
    if (/幕が(下|お)りる/.test(s)) fx.push('curtainDown');
    if (/幕が(上|あ)がる/.test(s)) fx.push('curtainUp');
    // 終わりの(…)は書いた人への覚え(画面に出さない)。「出す」「画面」「声の主」「確認」「幕が」を含むものだけ外す
    s = s.replace(/[(（][^)）]*(出す|画面|声の主|確認|ここ|幕が|やり直す)[^)）]*[)）]\s*$/, '').trim();
    if (!s && !fx.length) return null; // 書いた人への覚えだけの帯は出さない
    row.t = 'band'; row.x = s;
    const uniq = [...new Set(fx.filter((f) => f !== 'band'))];
    if (uniq.length) row.fx = uniq;
    if (body) row.body = body;
    if (body && noBlood) row.noBlood = true;
    if (frame) row.f = frame;
    if (snd) { row.se = snd; const c = Math.max(1, Math.min(3, sndN || 1)); if (c > 1) row.seN = c; }
    else if (fx.includes('se')) row.se = /パチパチ|拍手/.test(s) ? 'clap' : /悲鳴|ドン|バタン|ガタン|ブツン|ザザッ/.test(s) ? 'impact' : /オルゴール|♪/.test(s) ? 'music' : 'tap';
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
    // 文で書いたパネルの変わり方(「黒羽のパネルが暗くなり、赤いバツ」「えるびんに「けが」の札」「きゅうこの赤いバツが消え、色が戻る」。前の書き方の「白い花」も読む・r1126-053)。
    //   名前ごとに、次の名前までの文で決める(「黒羽・白瀬も暗いパネルと赤いバツ」のように並んだ名前は同じ扱い)。強さ: 色が戻る > 亡くなった > 行方不明 > けが
    const ops = panelOpsOf(s);
    const stamp = /のこらず|すべてに|みんな暗い/.test(s) && /判/.test(s) ? 'all' : /1枚|また1枚/.test(s) && /判/.test(s) ? 1 : 0;
    if (ops.length || stamp) return { ...row, t: 'panel', x: '', ops, ...(stamp ? { stamp } : {}) };
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
  if (frame) line.f = frame;
  if (sp.n && !sp.crowd && !PAST_SPEAKERS.includes(sp.n)) note(where, `知らない話し手「${sp.n}」(名前だけ出す)`);
  delete line.crowd;
  if (sp.secret) { line.n = '？？？'; delete line.w; }
  if (face && face !== '—' && face !== '-') { if (EXPRESSIONS.includes(face) || (face === 'sleep' && SLEEP_FACE_WHO.includes(sp.w))) line.e = face; else note(where, `知らない表情「${face}」`); }
  const bgmM = memo && memo.match(/曲[:：]\s*([^\s)）]+)/);
  if (bgmM) { const mk = Object.keys(BGM_MARKS).find((k) => bgmM[1].startsWith(k)); line.bgm = bgmM[1].includes('★') ? 'melo_kiss_mystery' : mk ? BGM_MARKS[mk] : bgmM[1]; }
  const memo2 = memo ? memo.replace(/[(（]?曲[:：][^)）]*[)）]?/, '').replace(/^\s*(あつ派|ソラシド派|[0-9〜]+問[^)）]*のとき|7問とも一発のとき)\s*/, '').trim() : '';
  if (memo2 && !sp.secret && !/声の主/.test(memo2)) line.note = memo2;
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
      // 過去編 ～12年前の聖夜～(真グッドのあとに開く章。章ID C12・r1126-046)
      if (started && /^過去編/.test(t)) {
        chapter = { id: 'C12', no: 12, label: '過去編', disp: '過去編', title: ((t.match(/[～〜]\s*([^～〜]+?)\s*[～〜]/) || [])[1] || '').trim(), past: true };
        chapters.push(chapter); scene = null; lastQ = null; seq = 0;
        continue;
      }
      const cm = t.replace(/^後半\s*/, '').replace(/^(強制バッド|名指しエンド|おまけ).*$/, 'エンディング').match(/^(序章|終章|第\s*(\d+)\s*章|エンディング|カーテンコール)\s*(?:[～〜]\s*([^～〜]+?)\s*[～〜])?/);
      if (cm) {
        started = true;
        const no = cm[2] ? Number(cm[2]) : CHAPTER_NO[cm[1]];
        const KAN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        if (cm[1] === 'カーテンコール') { chapter = { id: 'END', no: 99, label: 'エンディング', disp: 'カーテンコール', title: '', endingNames: {} }; }
        else if (cm[1] === 'エンディング') { chapter = { id: 'END', no: 99, label: 'エンディング', disp: 'エンディング', title: '', endingNames: {} }; }
        else chapter = { id: `C${no}`, no, label: cm[1].replace(/\s+/g, ''), disp: cm[2] ? `第${KAN[no] || no}章` : cm[1], title: (cm[3] || '').trim(), fresh: true };
        chapters.push(chapter);
        scene = null; lastQ = null; seq = 0;
      } else if (started && /^外側/.test(t)) {
        // 外側(ゲームの外・助手たち本人)の場面の見出し。章の札は出さない(章ID OUT)
        chapter = { id: 'OUT', no: 98, label: '外側', disp: '', title: ((t.match(/[～〜]\s*([^～〜]+?)\s*[～〜]/) || [])[1] || '').trim(), outside: true };
        chapters.push(chapter); scene = null; lastQ = null; seq = 0;
      } else chapter = null;
      continue;
    }
    const eh = line.match(/^###\s+(END-[A-Z]+\d*)\s+(.*)$/) || line.match(/^###\s+C\d+-[A-Z]+\s*→\s*(END-X\d+)\s*(.*)$/);
    if (eh && chapter && chapter.endingNames) { chapter.endingNames[eh[1]] = `${/^END-X/.test(eh[1]) ? '強制バッド' : ''}${eh[2].replace(/[(（][^)）]*[)）]\s*$/, '').trim()}`; continue; }
    if (!started || !chapter || !/^\|/.test(line)) continue;
    const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0].replace(/\s/g, '')) || cells[0] === '番号') continue;
    if (!stripMd(cells[0])) {
      // 見出しの行(番号が空)。「戦う」の見出しはノベルでは使わない
      if (/^\*\*戦う\*\*$/.test(cells[1])) continue;
      seq += 1;
      // 見出しの章番号と場面IDがちがう章(後半 第8章 = C10)は、場面IDのほうに合わせる
      const sid = stripMd(cells[1]).match(/^C(\d+)-/);
      if (sid && chapter.fresh && chapter.id !== `C${sid[1]}` && chapter.id !== 'END') { chapter.id = `C${sid[1]}`; chapter.no = Number(sid[1]); }
      chapter.fresh = false;
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
    // カーテンコールをエンディングにつなぐ。行のあと(END-G の G-9 のあと)なら、エンディングの場面をそこで分け、カーテンコールの「次」(G-10)を分けたうしろの場面にする
  scenes.filter((sc) => sc.after).forEach((cc) => {
    const end = scenes.find((x) => x.id === cc.after.scene);
    if (!end) { note(cc.id, `差しこむ先「${cc.after.scene}」が無い`); return; }
    if (cc.after.row) {
      const at = end.rows.findIndex((r) => r.id.replace(/\[.*$/, '') === cc.after.row);
      if (at < 0) { note(cc.id, `差しこむ行「${cc.after.row}」が ${end.id} に無い`); return; }
      const tail = { ...end, id: `${end.id}-2`, rows: end.rows.slice(at + 1), next: end.next };
      delete tail.ending;
      tail.rows.forEach((r) => { if (r.k) r.k = r.k.replace(`${end.id}:`, `${tail.id}:`); });
      end.rows = end.rows.slice(0, at + 1);
      end.next = cc.id;
      // うしろの行(G-10〜)が、カーテンコールの表の続きに書いてあるときは、カーテンコールの中で分ける
      const inCc = cc.next ? cc.rows.findIndex((r) => r.id.replace(/\[.*$/, '') === cc.next) : -1;
      if (inCc >= 0) {
        tail.rows = [...cc.rows.slice(inCc), ...tail.rows];
        tail.rows.forEach((r) => { if (r.k) r.k = r.k.replace(`${cc.id}:`, `${tail.id}:`); });
        cc.rows = cc.rows.slice(0, inCc);
      }
      if (!cc.next || inCc >= 0 || tail.rows.some((r) => r.id.replace(/\[.*$/, '') === cc.next)) cc.next = tail.id;
      scenes.splice(scenes.indexOf(end) + 1, 0, tail);
    } else if (!end.next || !scenes.some((x) => x.id === end.next)) end.next = cc.id;
    delete cc.after;
  });
  // エンディングのすぐうしろに置いた場面(外側の OUT-G など・「次」の無いエンディング)は、そのエンディングの続き
  scenes.forEach((sc, i) => {
    const nx = scenes[i + 1];
    const nextIsRow = sc.next && scenes.some((x) => x.rows.some((r) => r.id.replace(/\[.*$/, '') === sc.next));
    if (sc.ending && !nextIsRow && (!sc.next || !scenes.some((x) => x.id === sc.next)) && nx && !nx.ending && nx.chapter === sc.chapter && !nx.after && !/-X$/.test(nx.id)) sc.next = nx.id;
  });
  const seenCh = new Set();
  const chs = chapters.filter((c) => scenes.some((s) => s.chapter === c.id) && !seenCh.has(c.id) && seenCh.add(c.id));
  return { v: 1, src: srcName, chapters: chs.map(({ id, no, label, disp, title, outside, past }) => ({ id, no, label, disp, title, ...(outside ? { outside: true } : {}), ...(past ? { past: true } : {}) })), scenes };
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
        if (!r.replies.ok && !r.once) note(r.id, '正解の返し(-ok)が無い');
        if (!r.replies.x1 && !r.once) note(r.id, 'まちがいの返し(-x1)が無い');
      }
      Object.values(r.replies).forEach((list) => list.forEach((x) => { if (x.to && !okTo(x.to)) note(r.id, `行き先「${x.to}」が台本に無い`); }));
      (r.options || []).forEach((o) => { if (o.to && !okTo(o.to)) note(r.id, `行き先「${o.to}」が台本に無い`); });
      Object.entries(r.route || {}).forEach(([k, to]) => { if (!okTo(to)) note(r.id, `行き先「${k} → ${to}」が台本に無い`); });
      if (r.once && !(r.route || {})['*'] && r.kind === 'person') note(r.id, 'やり直しのない推理に「ほかの人 →」の行き先が無い');
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
