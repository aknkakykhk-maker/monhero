// 助手の絵の目録を作る道具(2026-11-23 社長「作り直しが何世代も重なり、いま使っている最新版と古い版の見分けがつかず
// 取り違えが繰り返し起きている」・台帳 r1119-124・追跡表 r1123-011)。
//
//   node tools/image/assistant-art-catalog.js            … 要約だけ画面に出し、キャラごとの目録(CATALOG.md)と保管庫の表を書き直す
//   node tools/image/assistant-art-catalog.js --all      … 要確認と古い疑いを全部、画面にも出す
//   node tools/image/assistant-art-catalog.js --check    … 検査だけ(何も書かない)。正本が在るか・目録が古くないか・現行が正本より古くないか
//   node tools/image/assistant-art-catalog.js --no-write … 目録のファイルを書かない(台帳も書かない)
//   node tools/image/assistant-art-catalog.js --why <語> … 道筋に <語> を含む絵が、どの組(キャラ/服/種類)で・正本か旧版かを出す
//   node tools/image/assistant-art-catalog.js --selftest … 道具の自己点検
//
// 【この道具は画像を動かさない・消さない】 読んで数えるだけ。旧版は 2026-11-23 に保管庫 archive/old-art/ へ移した(r1119-128)。
//   目録はキャラごと: tools/art-sources/assistants/<キャラ>/CATALOG.md(原本もそのフォルダの <服>/ の下)。保管庫の表は archive/old-art/README.md
//
// 【読む物・書く物】
//   人が書く  tools/image/assistant-art-catalog.json … キャラ・服の名前、組ごとの「正本(最新の原本)」と作り方、旧版の候補(移す一覧)、要確認
//   道具が書く tools/image/assistant-art-ledger.json  … 絵1枚ごとの「中身の印(sha)と、最後に変えたコミット」。中身が変わった絵だけ git で引き直す
//                                                      (会話の履歴は浅いことがあるので、分かった日付はここへ貯めておく)
//   道具が書く キャラごとの CATALOG.md・archive/old-art/README.md・要確認の一覧(書き先は catalog.json の out)
//
// 【組】 monster-hero/images/assistant の絵を「キャラ/服/種類」に分ける(名前を組み立てて読む決まり data/assistants.js と同じ分け方)。
//   全身絵 fullbody/<名前>[__<表情>].png / 立ち絵 stand-<服>/<接頭辞>_<表情>.png / バスト絵 [<服>/]<接頭辞>_<表情>.PNG / 顔 [<服>/]face/<接頭辞>_<表情>.PNG
//
// 【正本の書き方】 catalog.json の groups["<キャラ>/<服>/<種類>"].master
//   "self"        … ゲームで使っているファイルそのものが正本(完成品を直接入れた・別の原本はリポジトリに無い)
//   ["道筋", …]   … 原本のファイル(* は1階層の任意の文字)。現行の絵はここから how の道具で作る
//
// 【検査(--check)が落とす物】
//   1 組が目録(catalog.json)に無い・目録にあって絵が無い  2 正本に書いたファイルが無い  3 正本が保管庫(archive/)の中にある
//   4 絵の中身が台帳と違う(絵を替えたのに目録を作り直していない → 引数なしで回す)
//   5 現行の絵が正本より古い(正本だけ新しくして、現行を作り直していない)。分かっていて直している最中の物は catalog.json の knownStale に理由つきで書く
//   6 保管庫へ移した旧版(catalog.json の moved)が無い・元の場所にまた在る・保管庫に目録に無い絵がある
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const IMG = 'monster-hero/images/assistant';
const CATALOG = 'tools/image/assistant-art-catalog.json';
const LEDGER = 'tools/image/assistant-art-ledger.json';
const KINDS = ['fullbody', 'stand', 'bust', 'face'];
const KIND_NAME = { fullbody: '全身絵', stand: '立ち絵', bust: 'バスト絵', face: '顔アイコン' };
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const abs = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(abs(p));
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';

const walk = (dir) => {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
};
const isImage = (p) => /\.(png|jpe?g|webp)$/i.test(p);
const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(abs(p))).digest('hex').slice(0, 12);

// 道筋の型(* は / 以外の任意)を、在るファイルへ広げる。フォルダを書いたら、その下の全部
const expand = (pat) => {
  if (!pat.includes('*')) {
    if (!exists(pat)) return [];
    return fs.statSync(abs(pat)).isDirectory() ? walk(pat) : [pat];
  }
  const dir = pat.slice(0, pat.lastIndexOf('/'));
  const re = new RegExp('^' + pat.slice(dir.length + 1).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
  if (!exists(dir)) return [];
  return fs.readdirSync(abs(dir)).filter(n => re.test(n)).map(n => dir + '/' + n);
};

// ---- 組に分ける ----
// 戻り値 { key: 'mua/normal/fullbody', who, outfit, kind, sleep } か null(助手の絵の名前の形でない)
const classify = (file, cat) => {
  const rel = file.slice(IMG.length + 1);
  const parts = rel.split('/');
  const base = parts[parts.length - 1];
  const byPrefix = (prefix) => Object.keys(cat.who).find(id => cat.who[id].prefix === prefix) || null;
  const outfitOf = (who, dir) => (dir === '' || dir === 'normal') ? 'normal' : (cat.who[who] && cat.who[who].outfits[dir] ? dir : null);
  if (parts[0] === 'fullbody' && parts.length === 2) {
    const m = base.match(/^(.+?)(?:__([a-z]+))?\.(?:png|webp)$/); // 重い絵は WebP の組あり(2026-11-28 r1126-095・data/assistants.js の assistantArtFile)
    if (!m) return null;
    const hit = Object.keys(cat.fullbodyNames).find(k => cat.fullbodyNames[k] === m[1]);
    if (!hit) return null;
    const [who, outfit] = hit.split('/');
    return { key: `${who}/${outfit}/fullbody`, who, outfit, kind: 'fullbody', sleep: false, base: !m[2] };
  }
  const m = base.match(/^([a-z]+)_([a-z]+)\.(png|PNG|webp)$/);
  if (!m) return null;
  const who = byPrefix(m[1]);
  if (!who) return null;
  let kind = null; let dir = '';
  if (parts.length === 1) { kind = 'bust'; }
  else if (parts.length === 2 && parts[0] === 'face') { kind = 'face'; }
  else if (parts.length === 2 && parts[0].startsWith('stand-')) { kind = 'stand'; dir = parts[0].slice(6); }
  else if (parts.length === 2) { kind = 'bust'; dir = parts[0]; }
  else if (parts.length === 3 && parts[1] === 'face') { kind = 'face'; dir = parts[0]; }
  else return null;
  const outfit = outfitOf(who, dir);
  if (!outfit) return null;
  return { key: `${who}/${outfit}/${kind}`, who, outfit, kind, sleep: m[2] === 'sleep', base: false };
};

// ---- 台帳(絵ごとの中身の印と、最後に変えたコミット) ----
const loadJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(abs(p), 'utf8')); } catch (_) { return fallback; } };
const PENDING = '(まだコミットしていない)';
// 中身が台帳と違うファイルだけ、git で「最後に変えたコミット」を引く。履歴に無い(浅い)・未コミットなら PENDING
const gitLastChange = (files) => {
  const out = {};
  if (!files.length) return out;
  let dirty = new Set();
  try {
    dirty = new Set(execFileSync('git', ['status', '--porcelain', '--', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, '')));
  } catch (_) { /* git が無いときは全部 PENDING */ }
  let log = '';
  try {
    log = execFileSync('git', ['log', '--format=@@%h|%cI|%s', '--name-only', '--', ...new Set(files.map(f => path.dirname(f)))],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch (_) { log = ''; }
  let cur = null;
  const want = new Set(files);
  for (const line of log.split('\n')) {
    if (line.startsWith('@@')) { const [h, d, ...s] = line.slice(2).split('|'); cur = { h, date: d, subject: s.join('|') }; continue; }
    if (!line || !want.has(line) || out[line]) continue;
    out[line] = cur;
  }
  for (const f of files) if (dirty.has(f) || !out[f]) out[f] = null;
  return out;
};
const refreshLedger = (files, old) => {
  const ledger = { note: 'このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない', commits: {}, files: {} };
  const need = [];
  const shas = {};
  // 置き場だけ変わった絵(git mv)は、中身の印が同じ前の控え(もう無い道筋の物)から「最後に変えたコミット」を引き継ぐ
  const movedFrom = {};
  for (const [f, v] of Object.entries(old.files || {})) if (!exists(f) && v.split(' ')[1] !== PENDING) movedFrom[v.split(' ')[0]] = v;
  for (const f of files) {
    shas[f] = sha(f);
    const prev = old.files && old.files[f];
    if (prev && prev.split(' ')[0] === shas[f] && prev.split(' ')[1] !== PENDING) ledger.files[f] = prev;
    else if (!prev && movedFrom[shas[f]]) ledger.files[f] = movedFrom[shas[f]];
    else need.push(f);
  }
  const got = gitLastChange(need);
  for (const f of need) {
    const c = got[f];
    ledger.files[f] = shas[f] + ' ' + (c ? c.h : PENDING);
    if (c) ledger.commits[c.h] = { date: c.date, subject: c.subject.slice(0, 120) };
  }
  for (const v of Object.values(ledger.files)) {
    const h = v.split(' ')[1];
    if (h !== PENDING && !ledger.commits[h] && old.commits && old.commits[h]) ledger.commits[h] = old.commits[h];
  }
  const sorted = {};
  for (const k of Object.keys(ledger.files).sort()) sorted[k] = ledger.files[k];
  ledger.files = sorted;
  const cs = {};
  for (const k of Object.keys(ledger.commits).sort()) cs[k] = ledger.commits[k];
  ledger.commits = cs;
  return ledger;
};
const commitOf = (ledger, f) => {
  const v = ledger.files[f];
  if (!v) return null;
  const h = v.split(' ')[1];
  if (h === PENDING) return { h: PENDING, date: '9999', subject: PENDING, pending: true };
  const c = ledger.commits[h] || { date: '', subject: '' };
  return { h, date: c.date, subject: c.subject };
};
const prOf = (subject) => { const m = String(subject || '').match(/\(#(\d+)\)\s*$/); return m ? '#' + m[1] : ''; };
const day = (iso) => String(iso || '').slice(0, 10);

// ---- 本体: 目録を組み立てる ----
const build = (cat, ledger, files) => {
  const problems = []; // 検査が落とす物
  const confirms = []; // 要確認(落とさない)
  const groups = {};
  const strays = [];
  for (const f of files) {
    const c = classify(f, cat);
    if (!c) { if (isImage(f)) strays.push(f); continue; }
    const g = groups[c.key] || (groups[c.key] = { ...c, files: [], bytes: 0 });
    g.files.push({ path: f, sleep: c.sleep, base: c.base });
    g.bytes += fs.statSync(abs(f)).size;
  }
  for (const f of strays) problems.push(`組に分けられない絵が現行フォルダにある(旧版の疑い・名前の形が決まりと違う): ${f}`);
  for (const key of Object.keys(cat.groups)) if (!groups[key]) problems.push(`目録(${CATALOG})に ${key} があるが、絵が無い`);


  for (const key of Object.keys(groups).sort()) {
    const g = groups[key];
    const spec = cat.groups[key];
    // その組の「作った日」: 寝顔を除いた絵のうち、いちばん古い変更といちばん新しい変更
    const made = {};
    for (const x of g.files) {
      const c = commitOf(ledger, x.path);
      if (!c) continue;
      const m = made[c.h] || (made[c.h] = { ...c, n: 0, sleep: 0, base: 0 });
      m.n++; if (x.sleep) m.sleep++; if (x.base) m.base++;
    }
    g.made = Object.values(made).sort((a, b) => (a.date < b.date ? 1 : -1));
    const main = g.made.filter(m => m.n > m.sleep + m.base);
    g.oldest = main.length ? main[main.length - 1] : null;
    g.newest = main.length ? main[0] : null;
    if (!spec) { problems.push(`${key} が目録(${CATALOG} の groups)に無い。正本と作り方を書く`); continue; }
    g.spec = spec;
    if (spec.master === 'self') { g.masterFiles = null; continue; }
    g.masterFiles = [];
    for (const p of spec.master) {
      const hit = expand(p);
      if (!hit.length) problems.push(`${key} の正本に書いたファイルが無い: ${p}`);
      if (p.startsWith('archive/')) problems.push(`${key} の正本が保管庫(旧版の置き場)を指している: ${p}`);
      g.masterFiles.push(...hit);
    }
    // 現行が正本より古くないか
    let masterNewest = null;
    for (const f of g.masterFiles) { const c = commitOf(ledger, f); if (c && (!masterNewest || c.date > masterNewest.date)) masterNewest = { ...c, path: f }; }
    g.masterNewest = masterNewest;
    // 日で比べる(同じ日にまとめて入れた物は、コミットの順が前後していても古いとは言わない)
    if (masterNewest && g.oldest && day(masterNewest.date) > day(g.oldest.date)) {
      const msg = `${key} の現行の絵(${day(g.oldest.date)})が、正本(${day(masterNewest.date)} ${masterNewest.path})より古い。正本から作り直す`;
      const known = (cat.knownStale || {})[key];
      if (known) { g.stale = known; confirms.push(`[直している最中] ${msg} — ${known}`); } else problems.push(msg);
    }
  }
  for (const key of Object.keys(cat.knownStale || {})) {
    if (groups[key] && !groups[key].stale) problems.push(`${key} はもう古くない。${CATALOG} の knownStale から外す`);
  }
  // 同じ服のなかで、全身絵が立ち絵より新しい(立ち絵が「直接入れた完成品」の組だけ。道具で切る組は上の 5 で見ている)
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (g.kind !== 'stand' || !g.spec || g.spec.master !== 'self') continue;
    const fb = groups[`${g.who}/${g.outfit}/fullbody`];
    if (fb && fb.newest && g.newest && day(fb.newest.date) > day(g.newest.date)) {
      confirms.push(`${key}: 全身絵(${day(fb.newest.date)})のほうが立ち絵(${day(g.newest.date)})より新しい。立ち絵は作り直した全身絵と同じ絵か`);
    }
  }
  // 表情なしの全身絵(<名前>.png)が、表情つきより古い世代のまま
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (g.kind !== 'fullbody' || !g.newest) continue;
    const baseMade = g.made.find(m => m.base > 0);
    if (baseMade && day(baseMade.date) < day(g.oldest.date)) {
      confirms.push(`${key}: 表情なしの全身絵(${cat.fullbodyNames[g.who + '/' + g.outfit]}.png・${day(baseMade.date)})が、表情つき(${day(g.oldest.date)})より古い世代のまま現行フォルダにある`);
    }
  }
  for (const c of cat.confirm || []) confirms.push(c);

  // 保管庫へ移した旧版: 行き先に在るか・元の場所へ戻っていないか
  const moves = [];
  for (const m of cat.moved || []) {
    if (!/^archive\/old-art\//.test(m.to)) problems.push(`旧版の行き先が保管庫(archive/old-art/)でない: ${m.to}`);
    const files = expand(m.to);
    if (!files.length) problems.push(`保管庫に移したはずの旧版が無い: ${m.to}`);
    for (const p of m.from) if (expand(p).length) problems.push(`保管庫へ移した旧版が、元の場所にまた在る(旧版を戻していないか): ${p}`);
    moves.push({ ...m, files, bytes: files.reduce((t, f) => t + fs.statSync(abs(f)).size, 0) });
  }
  // 保管庫の中に、目録(moved)に書いていない物が無いか
  const known = new Set(moves.flatMap(m => m.files));
  for (const f of walk('archive/old-art')) if (isImage(f) && !known.has(f)) problems.push(`保管庫に、目録(${CATALOG} の moved)に無い絵がある: ${f}`);
  return { groups, problems, confirms, moves };
};

// ---- 書き出し ----
const madeText = (g) => {
  if (!g.made || !g.made.length) return '不明';
  return g.made.map(m => `${m.pending ? '未コミット' : day(m.date)} ${m.pending ? '' : (prOf(m.subject) || m.h)}(${m.n}枚${m.sleep ? '・うち寝顔' + m.sleep : ''}${m.base ? '・うち表情なし' + m.base : ''})`).join(' / ');
};
const filesText = (g) => {
  const dir = path.dirname(g.files[0].path);
  const names = g.files.map(x => path.basename(x.path));
  if (g.kind === 'fullbody') return `\`${dir}/${names.find(n => !n.includes('__')).replace(/\.png$/, '') || ''}[__<表情>].png\``;
  return `\`${dir}/${names[0].replace(/_[a-z]+\.(png|PNG)$/, '_')}<表情>.${names[0].split('.').pop()}\``;
};
const masterText = (g) => {
  if (!g.spec) return '**目録に無い**';
  if (g.spec.master === 'self') return '現行のファイルそのもの(完成品を直接入れた・別の原本はリポジトリに無い)';
  return g.spec.master.map(p => '`' + p + '`').join('<br>');
};
const renderCatalog = (cat, r, who) => {
  const w = cat.who[who];
  const L = [];
  L.push(`# ${w.name}(${who})の絵の目録 — どれが正本で、ゲームはどれを使っているか`, '');
  L.push('<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json) -->', '');
  L.push('台帳 r1119-124・r1119-128。**絵を作り直す・差し替える前に、ここで「正本」を確かめる。**', '');
  L.push('- 「正本」= その絵を作り直すときに元にするファイル。「現行のファイルそのもの」とある組は、ゲームの絵が完成品で、道具で作り直してはいけない(道具も断る)');
  L.push('- このフォルダ(`tools/art-sources/assistants/' + who + '/<服>/`)にあるのは、いまも正本の原本だけ。**旧版は `archive/old-art/assistant/' + who + '/` にあり、正本ではない**');
  L.push('- 「最後に作った日」= ゲームの絵を最後に替えたコミットの日と PR(PR の番号が無い物はコミットの印)');
  L.push('- 絵を替えたら `node tools/image/assistant-art-catalog.js` を回す(回さないと検査 `--check` が落ちる)', '');
  for (const outfit of ['normal', ...Object.keys(w.outfits)]) {
    L.push(`## ${outfit === 'normal' ? 'ふだんの服' : '服「' + w.outfits[outfit] + '」(' + outfit + ')'}`, '');
    L.push('| 種類 | ゲームで使っているファイル | 枚数 | 最後に作った日・PR | 正本(最新の原本) | 作り方 |', '| --- | --- | ---: | --- | --- | --- |');
    for (const kind of KINDS) {
      const g = r.groups[`${who}/${outfit}/${kind}`];
      if (!g) { L.push(`| ${KIND_NAME[kind]} | なし | 0 | | | |`); continue; }
      L.push(`| ${KIND_NAME[kind]} | ${filesText(g)} | ${g.files.length} | ${madeText(g)} | ${masterText(g)} | ${(g.spec && g.spec.how) || ''}${g.stale ? '<br>**いま古い**: ' + g.stale : ''} |`);
    }
    L.push('');
  }
  const old = r.moves.filter(m => m.to.startsWith(`archive/old-art/assistant/${who}/`));
  L.push('## 旧版(正本ではない・保管庫)', '');
  if (!old.length) L.push('なし');
  for (const m of old) L.push(`- \`${m.to}/\`(${m.files.length}枚)… ${m.why}`);
  L.push('', '## 寝顔(`_sleep`)', '', cat.sleepNote || '', '');
  return L.join('\n') + '\n';
};
const renderOldArt = (cat, r) => {
  const L = [];
  const total = r.moves.reduce((t, m) => t + m.files.length, 0);
  L.push('# 旧版の絵の保管庫(配信しない・正本ではない)', '');
  L.push('<!-- このファイルは node tools/image/assistant-art-catalog.js が書く。手で直さない(直すのは tools/image/assistant-art-catalog.json の moved) -->', '');
  L.push('**ここにあるのは旧版(作り直す前の絵・重複)。ここから絵を作らない・ゲームへ入れない。** 正本は `tools/art-sources/assistants/<キャラ>/CATALOG.md` で確かめる(台帳 r1119-124・r1119-128)。', '');
  L.push('- 配信されない(GitHub Pages に載るのは `index.html` と `monster-hero/` だけ)。消さずに残している');
  L.push('- 置き方: `archive/old-art/assistant/<キャラ>/<服>/<その版が入った日>-old-<何の版>/`');
  L.push('- 戻すときは `git mv` で元の場所へ戻し、`tools/image/assistant-art-catalog.json` の `moved` から外して正本に書く(検査 `--check` が、戻した旧版と目録の食い違いを見ている)', '');
  L.push(`合計 ${total} 枚・${mb(r.moves.reduce((t, m) => t + m.bytes, 0))}(${r.moves.length} 組)`, '');
  L.push('| 保管庫の場所 | 枚数 | 容量 | 移した日 | 元の場所 | 旧版とする理由 |', '| --- | ---: | ---: | --- | --- | --- |');
  for (const m of r.moves) L.push(`| \`${m.to}/\` | ${m.files.length} | ${mb(m.bytes)} | ${m.date} | ${m.from.map(p => '\`' + p + '\`').join('<br>')} | ${m.why} |`);
  return L.join('\n') + '\n';
};
const renderConfirm = (cat, r) => {
  const L = ['# 助手の絵の目録: 要確認(道具が書く)', '', '<!-- node tools/image/assistant-art-catalog.js が書く。手で直さない -->', '', `## 要確認(${r.confirms.length} 件)`, ''];
  for (const c of r.confirms) L.push('- ' + c);
  L.push('', `## 検査で落ちている物(${r.problems.length} 件)`, '');
  if (!r.problems.length) L.push('なし');
  for (const p of r.problems) L.push('- ' + p);
  return L.join('\n') + '\n';
};

// ---- 自己点検 ----
const selftest = () => {
  const cat = { who: { mua: { prefix: 'myua', outfits: { halloween: 'ハロウィン' } } }, fullbodyNames: { 'mua/normal': 'mua', 'mua/halloween': 'mua_halloween' } };
  const t = (file, want) => { const c = classify(IMG + '/' + file, cat); const got = c ? c.key + (c.sleep ? ' sleep' : '') + (c.base ? ' base' : '') : null; if (got !== want) { console.error(`自己点検 NG: ${file} → ${got}(期待 ${want})`); process.exitCode = 1; } };
  t('myua_happy.PNG', 'mua/normal/bust');
  t('face/myua_sleep.PNG', 'mua/normal/face sleep');
  t('halloween/face/myua_wink.PNG', 'mua/halloween/face');
  t('stand-normal/myua_happy.png', 'mua/normal/stand');
  t('stand-halloween/myua_happy.png', 'mua/halloween/stand');
  t('fullbody/mua_halloween__angry.png', 'mua/halloween/fullbody');
  t('fullbody/mua.png', 'mua/normal/fullbody base');
  t('fullbody/mua_halloween__angry.webp', 'mua/halloween/fullbody'); // 重い絵は WebP の組あり(r1126-095)
  t('stand-halloween/myua_happy.webp', 'mua/halloween/stand');
  t('halloween/myua_happy.webp', 'mua/halloween/bust');
  t('fullbody/mua_old.png', null);
  t('old/myua_happy.PNG', null);
  t('myua_happy_v1.PNG', null);
  if (prOf('作り直し (#7292)') !== '#7292' || prOf('Add files via upload') !== '') { console.error('自己点検 NG: PR 番号'); process.exitCode = 1; }
  if (!process.exitCode) console.log('自己点検 OK(組の分け方 10 件・PR 番号)');
};

const main = () => {
  if (has('--selftest')) return selftest();
  const cat = loadJson(CATALOG, null);
  if (!cat) { console.error(`${CATALOG} が読めない`); process.exit(1); }
  const files = walk(IMG).filter(f => !f.endsWith('.gitkeep'));
  const masterFiles = [];
  for (const g of Object.values(cat.groups)) if (Array.isArray(g.master)) for (const p of g.master) masterFiles.push(...expand(p));
  const tracked = [...new Set([...files, ...masterFiles])];
  const oldLedger = loadJson(LEDGER, { commits: {}, files: {} });
  const checkOnly = has('--check');
  const write = !checkOnly && !has('--no-write') && !has('--why');
  const ledger = (checkOnly || !write) ? oldLedger : refreshLedger(tracked, oldLedger);
  const r = build(cat, ledger, files);
  if (checkOnly || !write) {
    // 絵の中身が台帳と違う(絵を替えたのに目録を作り直していない)
    const changed = tracked.filter(f => !ledger.files[f] || ledger.files[f].split(' ')[0] !== sha(f));
    const gone = Object.keys(ledger.files).filter(f => !exists(f));
    if (changed.length || gone.length) r.problems.push(`絵が変わったのに目録が古い(変わった ${changed.length} 枚・無くなった ${gone.length} 枚。例 ${[...changed, ...gone].slice(0, 3).join(' , ')})。node tools/image/assistant-art-catalog.js を回して目録を作り直す`);
  }
  const why = argv[argv.indexOf('--why') + 1];
  if (has('--why') && why) {
    for (const g of Object.values(r.groups)) for (const x of g.files) if (x.path.includes(why)) console.log(`現行 ${x.path} … ${g.key} / 正本: ${g.spec ? (g.spec.master === 'self' ? 'このファイルそのもの' : g.spec.master.join(' , ')) : '目録に無い'}`);
    for (const g of Object.values(r.groups)) for (const f of g.masterFiles || []) if (f.includes(why)) console.log(`正本 ${f} … ${g.key} の原本`);
    for (const m of r.moves) for (const f of m.files) if (f.includes(why)) console.log(`旧版(保管庫・正本ではない) ${f} … ${m.why}`);
    return;
  }
  if (write) {
    fs.writeFileSync(abs(LEDGER), JSON.stringify(ledger, null, 1) + '\n');
    const outs = Object.keys(cat.who).map(who => [`${cat.out.catalogDir}/${who}/CATALOG.md`, renderCatalog(cat, r, who)]);
    outs.push([cat.out.oldArtReadme, renderOldArt(cat, r)], [cat.out.confirm, renderConfirm(cat, r)]);
    for (const [p, text] of outs) {
      fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
      fs.writeFileSync(abs(p), text);
    }
  }
  const total = Object.values(r.groups).reduce((t, g) => t + g.files.length, 0);
  const self = Object.values(r.groups).filter(g => g.spec && g.spec.master === 'self').length;
  console.log(`助手の絵 ${total} 枚 / 組 ${Object.keys(r.groups).length}(正本が現行そのもの ${self}・原本あり ${Object.keys(r.groups).length - self})`);
  console.log(`保管庫の旧版 ${r.moves.reduce((t, m) => t + m.files.length, 0)} 枚・${mb(r.moves.reduce((t, m) => t + m.bytes, 0))} / 要確認 ${r.confirms.length} 件 / 検査で落ちる物 ${r.problems.length} 件`);
  const show = (title, list) => { if (!list.length) return; console.log(title); for (const x of (has('--all') ? list : list.slice(0, 5))) console.log('  - ' + x); if (!has('--all') && list.length > 5) console.log(`  …ほか ${list.length - 5} 件(--all)`); };
  show('検査で落ちる物:', r.problems);
  show('要確認:', r.confirms);
  if (write) console.log(`目録 → ${cat.out.catalogDir}/<キャラ>/CATALOG.md / 保管庫の表 → ${cat.out.oldArtReadme} / 要確認 → ${cat.out.confirm}`);
  if (checkOnly && r.problems.length) process.exitCode = 1;
  if (checkOnly && !r.problems.length) console.log('OK: 助手の絵の目録は現行と合っている');
};
main();
