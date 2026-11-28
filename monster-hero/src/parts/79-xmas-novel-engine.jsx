// ===== クリスマスのミステリーノベル「聖夜の名探偵」の進め方(台帳 r1126-022・純粋な計算とデータ) =====
// 画面は 79-screen-xmas-novel.jsx、台本のデータは 79-xmas-novel-script.jsx(tools/novel/xmas-novel-build.js が SCRIPT.md から作る)。
// ここは React・保存・音に触らない(parts-purity-check)。台本の形は docs/progress/xmas-novel/FORMAT.md。
//
// 進み具合(cur)の形: { scene, idx, flags:{f_x:数}, clues:[{n:名前, d:説明}], ans:{問いID:{t:答えた回数, f:一発目で当てたか}}, panel:{人:状態} }
//   scene … 場面ID(C1-2 など) / idx … 場面の rows の何行目を読んでいるか(問いの行のときは、答えるまでそこに止まる)
// 保存(mh_xmas_novel_v1)の形は xmasNovelNormalize を見る。

const XMAS_NOVEL_STORAGE_KEY = 'mh_xmas_novel_v1';

// 届いたゲームの名前(社長 2026-11-26)。シリーズ名・副題は、次のお話でここだけ差し替えて使い回す
const XMAS_NOVEL_GAME = Object.freeze({ series: 'モンヒロ事件簿', title: '呪いのセーブデータ', sub: '十三番目の鐘' });
// 遊べるのはイベントの期間中だけ(11/28 10:00〜12/31 3:59)。期間が終わっても保存の記録は消さない
const XMAS_NOVEL_OPEN_AT = '2026-11-28T10:00:00+09:00';
const XMAS_NOVEL_CLOSE_AT = '2026-12-31T04:00:00+09:00';
const xmasNovelPlayableAt = (nowMs) => {
  const a = Date.parse(XMAS_NOVEL_OPEN_AT); const b = Date.parse(XMAS_NOVEL_CLOSE_AT);
  return Number.isFinite(nowMs) && nowMs >= a && nowMs < b;
};

// 登場人物(パネル・人を選ぶ問い・立ち絵の名前)。並びは SCRIPT.md の D(12人を6人ずつ2段)
//   kind: 'assistant' = 助手(サンタの立ち絵) / 'monster' = 絵が1枚(art) / 'shadow' = 絵がまだ無い(影の立ち絵)
const XMAS_NOVEL_CAST = Object.freeze([
  { id: 'atsu', name: 'あつ', kind: 'assistant' },
  { id: 'myua', name: 'みゅあ', kind: 'assistant' },
  { id: 'sorashido', name: 'ソラシド', kind: 'assistant' },
  { id: 'kiki', name: 'きき', kind: 'assistant' },
  { id: 'momosuke', name: 'ももすけ', kind: 'assistant' },
  { id: 'dra', name: 'ドラ', kind: 'assistant' },
  { id: 'kyuko', name: 'きゅうこ', kind: 'assistant' },
  { id: 'erubin', name: 'えるびん', kind: 'assistant' },
  { id: 'ichika', name: 'イチーカ', kind: 'monster', art: 'images/monsters/snegurochka.png', face: 'images/monster-icons/face/snegurochka.png' },
  { id: 'mochimaru', name: 'もちまる', kind: 'monster', art: 'images/monsters/mocchi.png', face: 'images/monster-icons/face/mocchi.png' },
  // 謎の客2人(2026-11-26 届いた絵・余白だけ切りそろえた。表情は1枚)。顔は、社長が渡した顔の絵からほかの人と同じ寄り具合に切り出した物(r1126-033)
  { id: 'kuroba', name: '黒羽', full: '黒羽 宗一郎', kind: 'guest', art: 'images/story-guests/kuroba_full.png', face: 'images/story-guests/kuroba_face.png', tone: '#3b3f4a' },
  { id: 'shirase', name: '白瀬', full: '白瀬 雪絵', kind: 'guest', art: 'images/story-guests/shirase_full.png', face: 'images/story-guests/shirase_face.png', tone: '#5a6a86' },
]);
// 話し手だけの人(パネルには出ない)
const XMAS_NOVEL_SPEAKERS_EXTRA = Object.freeze([
  { id: 'watson', name: 'ワトソンくん', kind: 'laptop' },
]);
const xmasNovelCastOf = (id) => XMAS_NOVEL_CAST.find((c) => c.id === id) || XMAS_NOVEL_SPEAKERS_EXTRA.find((c) => c.id === id) || null;

// ---- 条件 ----
//  条件のデータ: { any: [ { all: [ { k:'f_kuroba', op:'=', v:1 }, ... ] }, ... ] }(または のどれか・かつ の全部)。null は「いつでも」
//  k は f_* のフラグ、score(いまの読み進めで一発目で当てた数)、clues(手がかりの数)
const xmasNovelValueOf = (k, ctx) => {
  if (k === 'score') return Number(ctx.score) || 0;
  if (k === 'clues') return Array.isArray(ctx.clues) ? ctx.clues.length : 0;
  // end_G … そのエンディングを見たことがあれば 1(エンドヒストリー。おまけの選択肢・r1126-062)
  if (/^end_[A-Z]+\d*$/.test(k)) return Array.isArray(ctx.endings) && ctx.endings.includes(`END-${k.slice(4)}`) ? 1 : 0;
  const v = ctx.flags ? ctx.flags[k] : undefined;
  return Number.isFinite(v) ? v : 0;
};
const xmasNovelTest = (atom, ctx) => {
  if (!atom || typeof atom.k !== 'string') return true;
  const a = xmasNovelValueOf(atom.k, ctx);
  const b = Number(atom.v) || 0;
  switch (atom.op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case '!=': return a !== b;
    default: return a === b;
  }
};
const xmasNovelCondOk = (cond, ctx) => {
  if (!cond || !Array.isArray(cond.any) || !cond.any.length) return true;
  return cond.any.some((g) => !g || !Array.isArray(g.all) || g.all.every((atom) => xmasNovelTest(atom, ctx)));
};

// ---- 台本を引く ----
const xmasNovelScenes = (script) => (script && Array.isArray(script.scenes) ? script.scenes : []);
const xmasNovelSceneById = (script, id) => xmasNovelScenes(script).find((s) => s.id === id) || null;
const xmasNovelIsEnding = (scene) => !!(scene && scene.ending);
// 場面IDの「仲間」: C3-1a と C3-1b は C3-1 の仲間(同じ所で分かれる場面)
const xmasNovelSceneBase = (id) => String(id || '').replace(/^(C\d+-\d+)[a-z]$/, '$1');

// ---- 一発目の成績 ----
//  問いのまとまり(group)ごとに、まとまりの問いが全部「一発目で当てた」なら1。最後の問いは1段目と2段目で1つ(group 'final')
const xmasNovelScoreGroups = (script) => {
  const groups = [];
  xmasNovelScenes(script).forEach((s) => (s.rows || []).forEach((r) => {
    if (r && r.t === 'q' && r.score) {
      const g = r.group || r.id;
      let hit = groups.find((x) => x.id === g);
      if (!hit) { hit = { id: g, qs: [] }; groups.push(hit); }
      hit.qs.push(r.id);
    }
  }));
  return groups;
};
// ans … { 問いID: { f: true/false } } の形(進み具合の ans でも、保存の first でも同じ形で数える)
const xmasNovelScoreOf = (script, ans) => {
  const a = ans && typeof ans === 'object' ? ans : {};
  return xmasNovelScoreGroups(script).filter((g) => g.qs.every((q) => a[q] && a[q].f === true)).length;
};
const xmasNovelCtx = (script, cur, endings) => ({ flags: (cur && cur.flags) || {}, clues: (cur && cur.clues) || [], score: xmasNovelScoreOf(script, cur && cur.ans), endings: Array.isArray(endings) ? endings : [] });

// 場面へ入る: id の場面の条件が合わなければ、同じ仲間(C3-1a→C3-1b)で条件の合う場面へ。どれも合わなければ null
const xmasNovelResolveScene = (script, id, ctx) => {
  const scenes = xmasNovelScenes(script);
  const first = scenes.find((s) => s.id === id);
  if (first && (first.jumpOnly || xmasNovelCondOk(first.cond, ctx))) return first; // 行き先でだけ入る場面は、名指しされたら入る
  const base = xmasNovelSceneBase(id);
  // 名指しされた場面に、分かれた仲間(C3-1a と C3-1b)が無ければ、条件に関係なく入る(問いの行き先 END-B など)
  if (first && !scenes.some((s) => s.id !== id && xmasNovelSceneBase(s.id) === base)) return first;
  return scenes.find((s) => xmasNovelSceneBase(s.id) === base && s.id !== id && xmasNovelCondOk(s.cond, ctx)) || null;
};
// 場面の次: 見出しの「次」→ それが無ければ台本の並びで次の、条件の合う場面(エンディングの場面へは並びでは入らない)。
//   次: END(または最後の場面のあと)… 条件の合う最初のエンディングへ
const xmasNovelNextScene = (script, scene, ctx) => {
  const scenes = xmasNovelScenes(script);
  if (!scene) return null;
  if (xmasNovelIsEnding(scene)) return null;
  const toEnding = () => scenes.find((s) => xmasNovelIsEnding(s) && s.cond && xmasNovelCondOk(s.cond, ctx))
    || scenes.find((s) => xmasNovelIsEnding(s) && !s.cond) || null;
  if (scene.next === 'END') return toEnding();
  if (scene.next) {
    const byScene = xmasNovelResolveScene(script, scene.next, ctx);
    if (byScene) return byScene;
  }
  // 過去編(真グッドのあとに「章から」で読む章)は、最後の場面で終わり(エンディングへは進まない・起動画面へ戻る)
  if (scene.past) return null;
  const i = scenes.findIndex((s) => s.id === scene.id);
  const base = xmasNovelSceneBase(scene.id);
  for (let j = i + 1; j < scenes.length; j += 1) {
    const s = scenes[j];
    if (xmasNovelIsEnding(s)) break;
    if (s.jumpOnly) continue; // 問いの行き先でだけ入る場面(C7-A など)は、並びでは入らない
    if (xmasNovelSceneBase(s.id) === base && s.id !== scene.id) continue; // 自分の仲間(分かれた別の側)は飛ばす
    if (xmasNovelCondOk(s.cond, ctx)) return s;
  }
  return toEnding();
};
// 行IDのある場所(行き先が問いの行のとき: 「選び直す」で Q7a へ)
const xmasNovelFindRow = (script, rowId) => {
  for (const s of xmasNovelScenes(script)) {
    const idx = (s.rows || []).findIndex((r) => r && r.id === rowId);
    if (idx >= 0) return { scene: s, idx };
  }
  return null;
};

// ---- 進み具合 ----
const xmasNovelFreshCur = (script) => {
  const ctx = { flags: {}, clues: [], score: 0 };
  const first = xmasNovelScenes(script).find((s) => !xmasNovelIsEnding(s) && xmasNovelCondOk(s.cond, ctx));
  return { scene: first ? first.id : null, idx: 0, flags: {}, clues: [], ans: {}, panel: {} };
};
// 行き先(場面ID・行ID・END)へ飛ぶ。返り値は新しい cur(場所だけ変わる)
const xmasNovelJump = (script, cur, to) => {
  const ctx = xmasNovelCtx(script, cur);
  if (to === 'END') {
    const s = xmasNovelNextScene(script, { id: '__', next: 'END' }, ctx);
    return s ? { ...cur, scene: s.id, idx: 0 } : cur;
  }
  const s = xmasNovelResolveScene(script, to, ctx);
  if (s) return { ...cur, scene: s.id, idx: 0 };
  const row = xmasNovelFindRow(script, to);
  if (row) return { ...cur, scene: row.scene.id, idx: row.idx };
  return cur;
};
// 行の効き目(読んだ瞬間に起きること): 手がかりをためる・フラグを書く
const xmasNovelApplyRow = (cur, row) => {
  if (!row) return cur;
  if (row.t === 'clue' && row.clue) {
    const list = Array.isArray(cur.clues) ? cur.clues : [];
    const at = list.findIndex((c) => c.n === row.clue);
    if (at < 0) return { ...cur, clues: [...list, { n: row.clue, d: row.x || '' }] };
    if (!row.add) return cur;
    const d = list[at].d && row.x && !list[at].d.includes(row.x) ? `${list[at].d}\n${row.x}` : (list[at].d || row.x || '');
    return { ...cur, clues: list.map((c, i) => (i === at ? { ...c, d } : c)) };
  }
  if (row.t === 'flag' && Array.isArray(row.set)) return { ...cur, flags: xmasNovelSetFlags(cur.flags, row.set) };
  if (row.t === 'panel') return { ...cur, panel: xmasNovelPanelApply(cur.panel, row) };
  return cur;
};
// ---- 登場人物パネル(話の進みで積み上げる) ----
//  状態: '' ふつう / 'missing' 行方不明のはんこ / 'hurt' けがの札 / 'dead' 暗いパネルと赤いバツ / 'santa' 暗いパネルと黒いサンタの判(バッドエンド)
//  行の ops(人ごとの変わり方)と stamp(1 = まだ暗くない人を1人・'all' = のこった人みんなに黒いサンタの判)
const XMAS_NOVEL_PANEL_STATES = Object.freeze(['missing', 'hurt', 'dead', 'santa']);
const xmasNovelPanelApply = (panel, row) => {
  const next = { ...(panel || {}) };
  (row.ops || []).forEach((o) => {
    if (!o || !xmasNovelCastOf(o.id)) return;
    if (o.st === 'normal') delete next[o.id]; else if (XMAS_NOVEL_PANEL_STATES.includes(o.st)) next[o.id] = o.st;
  });
  const alive = () => XMAS_NOVEL_CAST.filter((c) => next[c.id] !== 'dead' && next[c.id] !== 'santa');
  if (row.stamp === 'all') alive().forEach((c) => { next[c.id] = 'santa'; });
  else if (row.stamp === 1) { const c = alive()[0]; if (c) next[c.id] = 'santa'; }
  return next;
};
// その行でパネルが変わった人(画面で目立たせる)
const xmasNovelPanelChanged = (before, after) => XMAS_NOVEL_CAST.map((c) => c.id).filter((id) => (before || {})[id] !== (after || {})[id]);
const xmasNovelSetFlags = (flags, sets) => {
  const next = { ...(flags || {}) };
  (sets || []).forEach((s) => {
    if (!s || typeof s.k !== 'string') return;
    const v = Number(s.v) || 0;
    const was = Number.isFinite(next[s.k]) ? next[s.k] : 0;
    next[s.k] = s.op === '+=' ? was + v : s.op === '-=' ? was - v : v;
  });
  return next;
};
// いまの場所から、条件の合う次の行へ(idx が今の行を指していれば、その次から探す)。
//   返り値 { cur, row, scene, ending, chapterChanged }。row=null で ending があれば、そのエンディングの終わり
const xmasNovelSettle = (script, cur) => {
  let c = cur;
  for (let guard = 0; guard < 4000; guard += 1) {
    const scene = xmasNovelSceneById(script, c.scene);
    if (!scene) return { cur: c, row: null, scene: null, ending: null };
    const rows = scene.rows || [];
    const ctx = xmasNovelCtx(script, c);
    let i = Math.max(0, Number(c.idx) || 0);
    while (i < rows.length && !xmasNovelCondOk(rows[i] && rows[i].c, ctx)) i += 1;
    if (i < rows.length) return { cur: { ...c, idx: i }, row: rows[i], scene, ending: null };
    // エンディングの場面のあと、「次」が場面(カーテンコール)ならそこへ続け、終わったところでエンディングの札を出す
    if (xmasNovelIsEnding(scene) || c.end) {
      const endScene = xmasNovelIsEnding(scene) ? scene : xmasNovelSceneById(script, c.end);
      const follow = scene.next && scene.next !== 'END' ? xmasNovelResolveScene(script, scene.next, ctx) : null;
      if (follow && follow.id !== scene.id && !xmasNovelIsEnding(follow)) { c = { ...c, scene: follow.id, idx: 0, end: endScene ? endScene.id : c.end }; continue; }
      const { end, ...rest } = c;
      return { cur: { ...rest, idx: rows.length }, row: null, scene: endScene || scene, ending: endScene ? endScene.ending : null };
    }
    const next = xmasNovelNextScene(script, scene, ctx);
    if (!next) return { cur: { ...c, idx: rows.length }, row: null, scene, ending: null };
    c = { ...c, scene: next.id, idx: 0 };
  }
  return { cur: c, row: null, scene: null, ending: null };
};
// 1行すすめる(問いの行では使わない。問いは xmasNovelAnswer)
const xmasNovelStep = (script, cur) => xmasNovelSettle(script, { ...cur, idx: (Number(cur.idx) || 0) + 1 });

// ---- 問いに答える ----
//  pick … 突きつけ: 手がかりの名前 / 人を選ぶ: 人のid / 行動: 選択肢の番号(0から)
//  返り値 { cur, ok, replies:[行], then:'retry'|'next'|{to} }。replies を読ませたあと then のとおりに進める
const xmasNovelPickReplies = (q, key) => (q.replies && Array.isArray(q.replies[key]) ? q.replies[key] : []);
// endings … 見たエンディングの一覧(おまけの選択肢など end_G の条件に使う)
const xmasNovelAnswer = (script, cur, q, pick, endings) => {
  if (!q || q.t !== 'q') return { cur, ok: false, replies: [], then: 'next' };
  const was = (cur.ans && cur.ans[q.id]) || null;
  const tries = (was ? was.t : 0) + 1;
  // やり直しのない推理(1回目・2回目の推理): 選んだら、その答えの行き先へ(返しは正解の -ok か、選んだ人の返しだけ)
  if (q.once) {
    const key = q.kind === 'action' ? `o${pick}` : String(pick);
    const ok = Array.isArray(q.answer) && q.answer.includes(pick);
    const route = q.route || {};
    const to = route[key] || route['*'] || null;
    const next = { ...cur, ans: { ...(cur.ans || {}), [q.id]: { t: tries, f: was ? was.f === true : ok, w: (was && was.w ? was.w : 0) + (ok ? 0 : 1), done: true, pick } } };
    if (q.kind === 'action') next.flags = { ...(cur.flags || {}), [`f_${q.id}`]: pick + 1 };
    const replies = ok && xmasNovelPickReplies(q, 'ok').length ? xmasNovelPickReplies(q, 'ok') : xmasNovelPickReplies(q, q.kind === 'action' ? String(pick + 1) : String(pick));
    const rto = xmasNovelRepliesTo(replies);
    return { cur: next, ok, replies, then: rto ? { to: rto } : to ? { to } : 'next' };
  }
  if (q.kind === 'action') {
    const ctx = xmasNovelCtx(script, cur, endings);
    const opts = xmasNovelOptionsOf(q, ctx);
    const opt = opts.find((o) => o.i === pick) || null;
    if (!opt) return { cur, ok: false, replies: [], then: 'retry' };
    // 選んだ番号は f_<問いID> にも残す(A1 の1つめ/2つめ = あつ派/ソラシド派の行 a / s)
    const next = { ...cur, flags: { ...xmasNovelSetFlags(cur.flags, opt.set), [`f_${q.id}`]: opt.i + 1 }, ans: { ...(cur.ans || {}), [q.id]: { t: tries, f: true, pick: opt.i } } };
    const replies = xmasNovelPickReplies(q, String(opt.i + 1));
    const lastTo = xmasNovelRepliesTo(replies);
    return { cur: next, ok: true, replies, then: opt.to ? { to: opt.to } : lastTo ? { to: lastTo } : 'next' };
  }
  const answers = Array.isArray(q.answer) ? q.answer : [];
  const ok = answers.includes(pick);
  const firstOk = was ? was.f === true : ok;
  let flags = cur.flags;
  if (!was && q.first) flags = { ...(flags || {}), [q.first]: ok ? 1 : 0 }; // 一発目で決まるフラグ(あとから当てても変えない)
  const done = ok || !!(was && was.done);
  const wrongs = (was && Number.isFinite(was.w) ? was.w : 0) + (ok ? 0 : 1);
  const next = { ...cur, flags, ans: { ...(cur.ans || {}), [q.id]: { t: tries, f: firstOk, w: wrongs, ...(done ? { done: true } : {}) } } };
  if (ok) {
    const replies = xmasNovelPickReplies(q, 'ok').length ? xmasNovelPickReplies(q, 'ok') : xmasNovelPickReplies(q, String(pick));
    const to = xmasNovelRepliesTo(replies);
    return { cur: next, ok: true, replies, then: to ? { to } : 'next' };
  }
  // まちがえても進む問い(r1126-099 追記1・q.pass): 返し(近い手がかり / 1回目のまちがい)→ 話し手が正しい手がかりを突きつける帯 → 正解の返しで先へ。
  //   一発目を外したことは ans の f(成績)に残る。ans の形 { t, f, w, done } は変えない
  if (q.pass && q.kind === 'present') {
    const okRows = xmasNovelPickReplies(q, 'ok');
    const why = Array.isArray(q.near) && q.near.includes(pick) && xmasNovelPickReplies(q, 'near').length ? xmasNovelPickReplies(q, 'near') : xmasNovelPickReplies(q, 'x1');
    const by = okRows[0] && okRows[0].w ? xmasNovelCastOf(okRows[0].w) : null;
    const clue = answers[0] || '';
    const band = clue ? [{ id: `${q.id}-pass`, t: 'band', x: `${by && by.name ? by.name : '探偵'}が、手がかり帳から【${clue}】を突きつけた` }] : [];
    // 正解の返しの頭の「はい。」は、選んだ人への返事なので、仲間が自分で突きつけたときは外す
    const okSelf = okRows.map((r, i) => (i === 0 && r && typeof r.x === 'string' && /^はい。\s*/.test(r.x) ? { ...r, x: r.x.replace(/^はい。\s*/, '') } : r));
    const replies = [...why, ...band, ...okSelf];
    const passed = { ...next, ans: { ...next.ans, [q.id]: { ...next.ans[q.id], done: true } } };
    const to = xmasNovelRepliesTo(replies);
    return { cur: passed, ok: false, replies, then: to ? { to } : 'next' };
  }
  // まちがい: 人ごとの返し → 近い手がかりの返し → 回数の返し(3回目からは x3)
  const personal = q.kind === 'person' ? xmasNovelPickReplies(q, String(pick)) : [];
  const near = q.kind === 'present' && Array.isArray(q.near) && q.near.includes(pick) ? xmasNovelPickReplies(q, 'near') : [];
  const n = Math.min(3, Math.max(1, wrongs));
  let counted = [];
  for (let k = n; k >= 1 && !counted.length; k -= 1) counted = xmasNovelPickReplies(q, `x${k}`);
  const replies = personal.length ? personal : near.length ? near : counted;
  const to = xmasNovelRepliesTo(replies);
  return { cur: next, ok: false, replies, then: to ? { to } : 'retry' };
};
const xmasNovelRepliesTo = (replies) => {
  for (let i = (replies || []).length - 1; i >= 0; i -= 1) if (replies[i] && replies[i].to) return replies[i].to;
  return null;
};
// 行動の選択肢の行き先の先にあるエンディングのID(強制バッドの「見たエンド」の印・r1126-099 追記1)。場面を next でたどる。無ければ null
const xmasNovelEndingAhead = (script, to) => {
  let s = to ? xmasNovelSceneById(script, to) : null;
  for (let k = 0; s && k < 12; k += 1) {
    if (s.ending && s.ending.id) return s.ending.id;
    if ((s.rows || []).some((r) => r && r.t === 'q')) return null; // 途中に分かれ道がある道は、エンドの直前ではない(r1126-102)
    s = typeof s.next === 'string' ? xmasNovelSceneById(script, s.next) : null;
  }
  return null;
};
// 手がかり帳のうち、問いで突きつけられる物(q.narrow があれば、その候補だけ・r1126-099 追記1)。絞った結果に正解が無ければ全部
const xmasNovelPresentable = (q, clues) => {
  const list = Array.isArray(clues) ? clues : [];
  if (!q || !Array.isArray(q.narrow) || !q.narrow.length) return list;
  const picked = list.filter((c) => q.narrow.includes(c.n));
  const ans = Array.isArray(q.answer) ? q.answer : [];
  return picked.some((c) => ans.includes(c.n)) ? picked : list;
};
// 行動の選択肢のうち、いま出せる物(条件つきの選択肢: 「オルゴールを鳴らす」は f_lullaby=1 のときだけ)
const xmasNovelOptionsOf = (q, ctx) => (Array.isArray(q && q.options) ? q.options : [])
  .map((o, i) => ({ ...o, i }))
  .filter((o) => xmasNovelCondOk(o.c, ctx));
// いちばんあとに「人を選ぶ」推理で選んだ人(台詞の {犯人にした人})。選んでいなければ null
const xmasNovelAccusedOf = (script, cur) => {
  let found = null;
  xmasNovelScenes(script).forEach((s) => (s.rows || []).forEach((r) => {
    const a = r && r.t === 'q' && r.kind === 'person' && cur && cur.ans ? cur.ans[r.id] : null;
    if (a && typeof a.pick === 'string' && xmasNovelCastOf(a.pick)) found = a.pick;
  }));
  return found;
};
// 人を選ぶ問いの候補(12人)
const xmasNovelPersonChoices = () => XMAS_NOVEL_CAST.map((c) => ({ id: c.id, name: c.name }));

// 章: 場面の chapter から。章の初めの場面(読み直しの入口)
const xmasNovelChapters = (script) => (script && Array.isArray(script.chapters) ? script.chapters : []);
const xmasNovelChapterOfScene = (script, sceneId) => {
  const s = xmasNovelSceneById(script, sceneId);
  return s ? s.chapter : null;
};

// ---- 保存 ----
//  { v:1,
//    cur: 進み具合 | null(はじめから・エンディングのあと),
//    read: [行の読んだ印(場面ID:行ID)],
//    endings: [見たエンディングID], first: {問いID:{f:一発目で当てたか}}(一番はじめに答えたときだけ書く・読み直しで変えない),
//    snaps: {章ID: 章に入ったときの {flags, clues, ans}}(章から読み直す),
//    endAt: {エンディングID: はじめて見た日時(ISO)}(エンドヒストリー), auto: オートの速さ(0=切 1=ふつう 2=はやい) }
const xmasNovelNormalizeCur = (raw, script) => {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.scene !== 'string' || (script && !xmasNovelSceneById(script, raw.scene))) return null;
  const flags = {};
  if (raw.flags && typeof raw.flags === 'object') Object.keys(raw.flags).forEach((k) => { const v = raw.flags[k]; if (/^f_\w+$/.test(k) && Number.isFinite(v)) flags[k] = v; });
  const clues = Array.isArray(raw.clues) ? raw.clues.filter((c) => c && typeof c.n === 'string').map((c) => ({ n: c.n, d: typeof c.d === 'string' ? c.d : '' })) : [];
  const ans = {};
  if (raw.ans && typeof raw.ans === 'object') Object.keys(raw.ans).forEach((k) => {
    const a = raw.ans[k];
    if (a && typeof a === 'object' && Number.isFinite(a.t)) ans[k] = { t: Math.max(1, Math.floor(a.t)), f: a.f === true, ...(Number.isFinite(a.w) && a.w >= 0 ? { w: Math.floor(a.w) } : {}), ...(a.done ? { done: true } : {}), ...(Number.isInteger(a.pick) || (typeof a.pick === 'string' && a.pick.length < 40) ? { pick: a.pick } : {}) };
  });
  const idx = Number.isInteger(raw.idx) && raw.idx >= 0 ? raw.idx : 0;
  const panel = {};
  if (raw.panel && typeof raw.panel === 'object') Object.keys(raw.panel).forEach((k) => { if (xmasNovelCastOf(k) && XMAS_NOVEL_PANEL_STATES.includes(raw.panel[k])) panel[k] = raw.panel[k]; });
  const end = typeof raw.end === 'string' && (!script || xmasNovelSceneById(script, raw.end)) ? raw.end : null;
  return { scene: raw.scene, idx, flags, clues, ans, panel, ...(end ? { end } : {}) };
};
const xmasNovelNormalize = (raw, script = null) => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const strs = (v, max) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x))].slice(-max) : []);
  const first = {};
  if (r.first && typeof r.first === 'object') Object.keys(r.first).forEach((k) => { const a = r.first[k]; if (a && typeof a === 'object' && typeof a.f === 'boolean') first[k] = { f: a.f }; });
  const snaps = {};
  if (r.snaps && typeof r.snaps === 'object') Object.keys(r.snaps).forEach((k) => {
    const s = r.snaps[k];
    if (!/^C\d+$|^END$/.test(k) || !s || typeof s !== 'object') return;
    const c = xmasNovelNormalizeCur({ ...s, scene: typeof s.scene === 'string' ? s.scene : '' }, script);
    if (c) snaps[k] = c;
  });
  const endAt = {};
  if (r.endAt && typeof r.endAt === 'object') Object.keys(r.endAt).forEach((k) => { const t = r.endAt[k]; if (/^END-[A-Z]+\d*$/.test(k) && typeof t === 'string' && Number.isFinite(Date.parse(t))) endAt[k] = t; });
  return {
    v: 1,
    cur: xmasNovelNormalizeCur(r.cur, script),
    read: strs(r.read, 6000),
    endings: strs(r.endings, 50),
    first,
    snaps,
    endAt,
    auto: [0, 1, 2].includes(r.auto) ? r.auto : 0,
  };
};
// 一番はじめの答えを記録(読み直しでは書き変えない)。一発で当てた数は記録だけ(称号はやめた・r1126-022 の決め)
const xmasNovelRecordFirst = (save, qid, ok) => {
  if (!save || !qid || (save.first && save.first[qid])) return save;
  return { ...save, first: { ...(save.first || {}), [qid]: { f: !!ok } } };
};
// 一番はじめの答えで、一発で当てた数(記録だけ)
const xmasNovelPerfectCount = (script, save) => xmasNovelScoreOf(script, save && save.first);
// エンドヒストリーに記録(はじめて見た日時だけ残す)
const xmasNovelRecordEnding = (save, endingId, iso) => {
  const endings = save.endings.includes(endingId) ? save.endings : [...save.endings, endingId];
  const endAt = save.endAt && save.endAt[endingId] ? save.endAt : { ...(save.endAt || {}), [endingId]: iso };
  return { ...save, endings, endAt };
};

// エンディングの種類の名前(一覧の札)
const XMAS_NOVEL_ENDING_KINDS = Object.freeze({
  good: { label: '真グッド', tone: '#f5d27a' },
  normal: { label: 'ノーマルグッド', tone: '#b9c7e6' },
  bad: { label: 'バッドエンド', tone: '#e07a7a' },
  another: { label: '偽りエンド', tone: '#e8a95b' },
  forced: { label: '強制バッド', tone: '#b0303a' },
  accuse: { label: '名指しエンド', tone: '#a78bd8' },
  omake: { label: 'おまけ', tone: '#7fd6a8' },
});

// ---- 分岐の地図「聖夜の見取り図」の読み直し(r1126-102) ----
//  保存は新しいキー mh_xmas_novel_route_v1 だけ(mh_xmas_novel_v1 は形も中身も変えない・⑦)。
//  { v:1, at:{ "<問いID>|<派 0〜2>": その問いの行に止まった時の cur }, back: 読み直す前の cur | null, seeded: 0|1 }
//  付与・補償・数を足す処理は無い(上書きと読み出しだけ)。seeded は「今の保存から機械で作る」を1回だけにする印
const XMAS_NOVEL_ROUTE_KEY = 'mh_xmas_novel_route_v1';
const xmasNovelRouteKeyOf = (qid, cur) => {
  const side = cur && cur.flags && Number.isFinite(cur.flags.f_A1) ? Math.max(0, Math.min(2, Math.floor(cur.flags.f_A1))) : 0;
  return `${qid}|${side}`;
};
const xmasNovelRowAt = (script, cur) => {
  const scene = cur ? xmasNovelSceneById(script, cur.scene) : null;
  const row = scene && Array.isArray(scene.rows) ? scene.rows[Number(cur.idx) || 0] : null;
  return row || null;
};
const xmasNovelRouteNormalize = (raw, script = null) => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const at = {};
  if (r.at && typeof r.at === 'object') Object.keys(r.at).slice(0, 120).forEach((k) => {
    const m = /^([AQ]\d+[a-z]?)\|([0-2])$/.exec(k);
    if (!m) return;
    const c = xmasNovelNormalizeCur(r.at[k], script);
    if (!c) return;
    if (script) { const row = xmasNovelRowAt(script, c); if (!row || row.t !== 'q' || row.id !== m[1]) return; } // 台本が変わって問いの行でなくなった物は捨てる
    at[k] = c;
  });
  return { v: 1, at, back: xmasNovelNormalizeCur(r.back, script), seeded: r.seeded === 1 ? 1 : 0 };
};
// 問いの行に着いたときに、その時の状態を残す(同じ分かれ道は一番新しく通った時で上書き)
const xmasNovelRouteRecord = (route, script, cur) => {
  const row = xmasNovelRowAt(script, cur);
  if (!route || !row || row.t !== 'q') return route;
  const c = xmasNovelNormalizeCur(cur, script);
  if (!c) return route;
  return { ...route, at: { ...route.at, [xmasNovelRouteKeyOf(row.id, c)]: c } };
};
// 地図を入れる前に通った分かれ道を、今の保存(章の頭の状態 snaps・読んだ印 read・続き cur)から機械で作る(1回だけ)。
//   章の頭から、安全な方・正解で、その章の中だけ進める。読んだ印のある問いの行だけを残す。やり直しのない推理(1回目・2回目)は残して止まる
const xmasNovelRouteSeed = (script, save, route) => {
  const base = route || xmasNovelRouteNormalize(null, script);
  if (base.seeded === 1) return base;
  const read = new Set((save && Array.isArray(save.read)) ? save.read : []);
  let at = { ...base.at };
  const keep = (cur, row) => { const k = xmasNovelRouteKeyOf(row.id, cur); if (!at[k] && read.has(row.k)) { const c = xmasNovelNormalizeCur(cur, script); if (c) at = { ...at, [k]: c }; } };
  const sideOfSave = save && save.cur && save.cur.flags && Number.isFinite(save.cur.flags.f_A1) ? save.cur.flags.f_A1 : 0;
  const snaps = save && save.snaps && typeof save.snaps === 'object' ? save.snaps : {};
  Object.keys(snaps).filter((k) => /^C\d+$/.test(k)).forEach((chId) => {
    let st = xmasNovelSettle(script, snaps[chId]);
    for (let guard = 0; st && st.row && guard < 3000; guard += 1) {
      if (!st.scene || st.scene.chapter !== chId) break;
      const r = st.row;
      if (r.t !== 'q') { st = xmasNovelStep(script, xmasNovelApplyRow(st.cur, r)); continue; }
      keep(st.cur, r);
      if (r.once) break;
      let pick = null;
      if (r.kind === 'present') pick = (r.answer || [])[0];
      else if (r.kind === 'action') {
        const opts = xmasNovelOptionsOf(r, xmasNovelCtx(script, st.cur, (save && save.endings) || []));
        if (r.id === 'A1') { const o = opts.find((x) => x.i === sideOfSave - 1); if (!o) break; pick = o.i; }
        else { const safe = opts.find((o) => !(o.to && xmasNovelEndingAhead(script, o.to))); if (!safe) break; pick = safe.i; }
      }
      if (pick === null || pick === undefined) break;
      const a = xmasNovelAnswer(script, st.cur, r, pick, (save && save.endings) || []);
      let c = a.cur; (a.replies || []).forEach((x) => { c = xmasNovelApplyRow(c, x); });
      st = a.then === 'next' ? xmasNovelStep(script, c) : a.then === 'retry' ? null : xmasNovelSettle(script, xmasNovelJump(script, c, a.then.to));
    }
  });
  if (save && save.cur) { const row = xmasNovelRowAt(script, save.cur); if (row && row.t === 'q') keep(save.cur, row); }
  return { ...base, at, seeded: 1 };
};
