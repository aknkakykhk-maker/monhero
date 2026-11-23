// ゲームで使っていない画像を洗い出す道具(2026-11-22 社長「ゲーム内に使ってない画像とかって保管庫にうつしてある?」
// 「やって そろそろ整理してかないと」・台帳 r1119-121・追跡表 r1123-008)。
//
//   node tools/image/unused-images.js            … 要約(件数と容量)だけ画面に出し、一覧を docs/progress/dev/r1123-008/unused-images.md に書く
//   node tools/image/unused-images.js --all      … 使っていない候補と要確認を全部、画面にも出す
//   node tools/image/unused-images.js --json     … 全画像の判定を JSON で出す(ほかの道具から読む用。一覧は書かない)
//   node tools/image/unused-images.js --no-write … 一覧のファイルを書かない
//   node tools/image/unused-images.js --why <語> … 道筋に <語> を含む画像の、判定と理由だけを出す
//   node tools/image/unused-images.js --selftest … 道具の自己点検(前に保管したカードと作り物の名前を、正しく判定できるか)
//
// 【この道具は画像を動かさない・消さない】 読んで数えるだけ。移すのは社長が一覧を OK してから、人の手で(保管庫 archive/unused-assets/)。
//
// 【判定のしかた】 monster-hero/images の全ファイルを、ゲームのコード・データ(下の「読む物」)と突き合わせる。
//   使っている
//     A 道筋がそのまま書いてある        … 'images/song-art/xxx.jpg' のように、フォルダ名つきで出てくる
//     B 名前を組み立てる型に合う        … `${who.imageDir}/face/${who.imagePrefix}_${表情}.PNG` や 'images/story-bg/' + 名前 + '.jpg' のような
//                                          組み立ての書き方をコードから拾い、穴に入る部品(助手の名前・表情・カード番号・モンスターの id など)が
//                                          すべてコード・データの中の文字列にあるとき
//     C フォルダと名前が別々に書いてある … フォルダの道筋('images/success/skill')と、拡張子を除いた名前('sk-0001')が、どちらも文字列で出てくる
//   使っていない候補
//     どれにも当たらない物。「型には合うが、部品がコード・データのどこにも無い」物(その名前は作られない)もここ(理由に書く)
//   要確認(怪しいので残す側)
//     ・ファイル名だけがフォルダ名なしで出てくる ・デバッグ用の物や道具だけが名前を書いている
//     ・セーブデータに id が残りうる種類(飾り枠・ブリーダーのアイコン)なのに参照が無い
//     ・大文字小文字だけが違う名前で書かれている ・番号を計算して組み立てる型にだけ合う ・画像でないファイル
//
// 【読む物】 monster-hero/ の js・jsx・html・css・json と、リポジトリ直下の index.html、supabase/(サーバー側)。
//   生成物(src/game-system.jsx・game-system.compiled.js・tailwind.css)と asset-manifest.json(全ファイルの一覧なので全部「ある」になる)・
//   vendor/ は読まない。非表示の新曲・開催前のイベント・着せ替えは、データに書いてあれば「使っている」になる。
//
//   行まるごとの注釈(// …)は読まない(注釈に名前があるだけの絵を「使っている」にしない)。
//
// 【限界】 静的に読むだけ。部品の照合は「その文字列がコード・データのどこかにあるか」なので、たまたま別の表の鍵に同じ名前が
//   残っていると「使っている」になる(残す側に倒れる。例: 保管済みの全身絵 sorashido_sleep は、大きさの表に鍵だけ残っているので通る)。
//  サーバーの表(Supabase)の中身にしか無い名前、1文字ずつ組み立てる名前は拾えない。
//   移す前に、動かして読み込まれた物の記録(tools/browser/visual-shoot.js など)でもう一度確かめる(archive/unused-assets/README.md の2条件)。
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GAME_DIR = path.join(REPO_ROOT, 'monster-hero');
const IMAGES_DIR = path.join(GAME_DIR, 'images');
const OUT_FILE = path.join(REPO_ROOT, 'docs', 'progress', 'dev', 'r1123-008', 'unused-images.md');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const whyIdx = args.indexOf('--why');
const WHY = whyIdx >= 0 ? String(args[whyIdx + 1] || '') : '';

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const EXT_ALT = 'png|jpe?g|webp|gif|svg|webm|mp4';
// セーブデータ(mh_*)に id が残りうる種類。参照が見つからなくても「使っていない」と決めない
const PROTECTED_DIRS = ['images/profile-frames/', 'images/breeder-icons/'];
// 読まない物(生成物・全ファイルの一覧・外部の部品)
const SKIP_FILES = new Set(['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js',
  'monster-hero/asset-manifest.json', 'monster-hero/tailwind.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', 'audio', 'movies', 'icons', 'art-sources']);
const SKIP_PATHS = new Set(['monster-hero/images']); // 画像そのものの置き場(data/images の絵の表は読む)

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name) && !(exts && SKIP_PATHS.has(relOf(full)))) walk(full, exts, out); }
    else if (!exts || exts.test(ent.name)) out.push(full);
  }
  return out;
}
const relOf = (full) => path.relative(REPO_ROOT, full).split(path.sep).join('/');

// ---- 読む物を集める -------------------------------------------------------
// kind: game(ゲーム本体とデータ)/ server(supabase)/ debug(monster-hero/debug)/ tools(道具。判定には使わず、注記だけ)
function collectSources() {
  const list = [];
  const add = (full, kind) => { const rel = relOf(full); if (!SKIP_FILES.has(rel)) list.push({ rel, kind, full }); };
  for (const f of walk(GAME_DIR, /\.(js|jsx|html|css|json)$/)) add(f, relOf(f).startsWith('monster-hero/debug/') ? 'debug' : 'game');
  add(path.join(REPO_ROOT, 'index.html'), 'game');
  for (const f of walk(path.join(REPO_ROOT, 'supabase'), /\.(ts|js|sql|json)$/)) add(f, 'server');
  for (const f of walk(path.join(REPO_ROOT, 'tools'), /\.(js|json)$/)) {
    if (path.resolve(f) === __filename || /package(-lock)?\.json$/.test(f)) continue;
    add(f, 'tools');
  }
  return list;
}

// ---- 文字列の部品(穴に入る値の候補)を拾う ------------------------------------
function collectTokens(text, tokens) {
  let m;
  // 引用符でくくられた文字列。長い文も最後まで読む(途中で切ると、開きと閉じの対がずれて次の文字列を落とす)
  const q = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  while ((m = q.exec(text))) if (m[2].length && m[2].length <= 90) tokens.add(m[2].replace(/\?v=[0-9a-f]+$/, ''));
  const k = /([A-Za-z_$][\w$-]*)\s*:/g; // 引用符なしのキー({ angry: ... } の angry)
  while ((m = k.exec(text))) tokens.add(m[1]);
  const t = /[`}]([^`${}\\\n]{1,60})(?=\$\{|`)/g; // テンプレートの中の地の文
  while ((m = t.exec(text))) tokens.add(m[1]);
}

// ---- そのまま書いてある道筋を拾う ------------------------------------------
function collectLiterals(text, kind, lit) {
  const re = new RegExp(`[A-Za-z0-9_\\-./%@+]*\\.(?:${EXT_ALT})(?![A-Za-z0-9])`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const parts = m[0].replace(/^[./]+/, '').split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const suffix = parts.slice(i).join('/');
      let e = lit.get(suffix); if (!e) lit.set(suffix, e = new Set());
      e.add(kind);
    }
  }
}

// ---- 名前を組み立てる型を拾う ----------------------------------------------
// 型 = [{lit:'images/story-bg/'}, {hole:'式'}, {lit:'.jpg'}] のような並び
function parseTemplate(text, start) { // start は開きの ` の位置。閉じの ` の位置と型を返す。読めなければ null
  const segs = []; let buf = ''; let i = start + 1;
  const limit = Math.min(text.length, start + 700);
  while (i < limit) {
    const c = text[i];
    if (c === '\\') { buf += text[i + 1] || ''; i += 2; continue; }
    if (c === '`') { if (buf) segs.push({ lit: buf }); return { end: i, segs }; }
    if (c === '$' && text[i + 1] === '{') {
      if (buf) { segs.push({ lit: buf }); buf = ''; }
      let depth = 1; let j = i + 2; let bare = ''; const alts = []; // 穴の式の中に書いてある文字列・入れ子の型(条件で選ばれる値)
      while (j < limit && depth > 0) {
        const d = text[j];
        if (d === '{') depth++;
        else if (d === '}') depth--;
        else if (d === '\'' || d === '"') { const e = text.indexOf(d, j + 1); if (e < 0 || e > limit) return null; alts.push([{ lit: text.slice(j + 1, e) }]); j = e; bare += '\u0001'; }
        else if (d === '`') { const inner = parseTemplate(text, j); if (!inner) return null; alts.push(inner.segs); j = inner.end; bare += '\u0001'; }
        else bare += d;
        j++;
      }
      if (depth > 0) return null;
      // 「条件 ? '文字' : '文字'」で、どちらも書いてある値のとき(例: 表情があれば `__${表情}`、無ければ '')は、その2つ以外は入らない
      const altsOnly = /\?\s*\u0001\s*:\s*\u0001\s*\}?$/.test(bare);
      segs.push({ hole: text.slice(i + 2, j - 1), alts, altsOnly });
      i = j; continue;
    }
    if (c === '\n') return null;
    buf += c; i++;
  }
  return null;
}

function concatChain(line, endQuotePos) { // line の中で endQuotePos に閉じの引用符がある文字列から、+ でつないだ型をさかのぼって作る
  const lits = []; // {s,e,text}
  const re = /(['"])((?:(?!\1)[^\\\n])*)\1/g; let m;
  while ((m = re.exec(line))) { lits.push({ s: m.index, e: m.index + m[0].length - 1, text: m[2] }); if (m.index > endQuotePos) break; }
  let idx = lits.findIndex((l) => l.e === endQuotePos);
  if (idx < 0) return null;
  const segs = [{ lit: lits[idx].text }];
  let cur = idx;
  for (;;) {
    if (cur === 0) break;
    const gap = line.slice(lits[cur - 1].e + 1, lits[cur].s);
    if (/^\s*\+\s*$/.test(gap)) { segs.unshift({ lit: lits[cur - 1].text }); cur--; continue; } // '文字' + '文字'
    if (!/\+\s*$/.test(gap)) break; // 手前が + でなければ、ここが先頭
    // 手前は式(穴)。式の頭の「'文字' +」までさかのぼる(式の中の文字列は飛ばす)
    let k = cur - 1; let found = -1;
    while (k >= 0) {
      const g = line.slice(lits[k].e + 1, lits[k + 1].s);
      const holeText = line.slice(lits[k].e + 1, lits[cur].s);
      const open = (holeText.match(/[([{]/g) || []).length; const close = (holeText.match(/[)\]}]/g) || []).length;
      if (/^\s*\+/.test(g) && open === close) { found = k; break; }
      k--;
    }
    const altsIn = (a, b) => lits.slice(a, b).map((l) => [{ lit: l.text }]); // 式の中に書いてある文字列(|| '既定値' など)
    if (found < 0) { segs.unshift({ hole: gap, alts: [] }); break; } // 式から始まる(穴 + '文字')
    segs.unshift({ hole: line.slice(lits[found].e + 1, lits[cur].s), alts: altsIn(found + 1, cur) });
    segs.unshift({ lit: lits[found].text });
    cur = found;
  }
  return segs;
}

function normalizeSegs(segs) { // となり合う地の文・穴をまとめ、?v= を落とす
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (s.lit != null) { if (last && last.lit != null) last.lit += s.lit; else out.push({ lit: s.lit }); }
    else out.push({ hole: s.hole, alts: s.alts || [], altsOnly: !!s.altsOnly });
  }
  const tail = out[out.length - 1];
  if (tail && tail.lit != null) tail.lit = tail.lit.replace(/\?v=.*$/, '');
  return out;
}
const segsText = (segs) => segs.map((s) => (s.lit != null ? s.lit : '{' + s.hole.replace(/\s+/g, ' ').slice(0, 28) + '}')).join('');

function collectPatterns(text, rel, kind, patterns) {
  const re = new RegExp(`\\.(?:${EXT_ALT})(?:\\?v=[0-9a-f]*)?(['"\`])`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const endPos = m.index + m[0].length - 1; const quote = m[1];
    const found = [];
    if (quote === '`') {
      let from = endPos;
      for (let n = 0; n < 12; n++) { // 手前の ` を近い順に試し、ここで閉じる物を全部拾う(入れ子があるので1つに決めない)
        const s = text.lastIndexOf('`', from - 1);
        if (s < 0 || endPos - s > 600) break;
        const t = parseTemplate(text, s);
        if (t && t.end === endPos) found.push(t.segs);
        from = s;
      }
    } else {
      const ls = text.lastIndexOf('\n', endPos) + 1;
      if (endPos - ls < 3000) { const c = concatChain(text.slice(ls, endPos + 1), endPos - ls); if (c) found.push(c); }
    }
    for (const raw of found) {
      const segs = normalizeSegs(raw);
      if (!segs.some((s) => s.hole != null)) continue; // 穴の無い物は「そのまま書いてある道筋」で拾う
      const tail = segs[segs.length - 1];
      if (!tail || tail.lit == null || !new RegExp(`\\.(?:${EXT_ALT})$`, 'i').test(tail.lit)) continue;
      if (segs.some((s) => s.lit != null && /[\s<>(){};=]/.test(s.lit))) continue; // 道筋でない物(文章・式の切れ端)
      const key = segsText(segs);
      if (!patterns.has(key)) patterns.set(key, { segs, text: key, where: rel, kinds: new Set(), hits: 0 });
      patterns.get(key).kinds.add(kind);
    }
  }
}

// ---- 型と画像を突き合わせる ------------------------------------------------
function holeOk(seg, value, tokens) { // 穴に入った値が、コード・データの文字列にあるか('ok' / 'num' 番号だけ / 'ng')
  if (value === '') return (!seg.altsOnly || (seg.alts || []).some((a) => a.length === 0 || (a.length === 1 && a[0].lit === ''))) ? 'ok' : 'ng';
  for (const alt of seg.alts || []) { // 穴の式の中に書いてある値(条件で選ぶ文字列・入れ子の型)
    if (alt.length === 1 && alt[0].lit != null) { if (alt[0].lit === value) return 'ok'; continue; }
    const r = matchPattern(alt, value, tokens);
    if (r && r.bad.length === 0) return r.num ? 'num' : 'ok';
  }
  if (seg.altsOnly) return 'ng';
  if (value.includes('/')) { // フォルダをまたぐ値は、その道筋がそのまま文字列で書かれているときだけ
    const v = value.replace(/\/$/, '');
    return (tokens.has(v) || tokens.has(v + '/') || tokens.has(value)) ? 'ok' : 'ng';
  }
  if (tokens.has(value)) return 'ok'; // 部品はまるごと一致で見る(分けて探すと、たまたまある単語で通ってしまう)
  if (/^\d+$/.test(value)) return 'num'; // 番号だけ(計算で作っているかもしれない)
  return 'ng';
}

function matchPattern(segs, s, tokens) { // 合えば {bad:[部品], num:bool}。合わなければ null。部品がいちばん揃う当て方を返す
  let best = null;
  const walkSeg = (i, pos, bad, num) => {
    if (best && best.bad.length === 0 && !best.num) return;
    if (i === segs.length) {
      if (pos === s.length && (!best || bad.length < best.bad.length || (bad.length === best.bad.length && !num && best.num))) best = { bad: bad.slice(), num };
      return;
    }
    const seg = segs[i];
    if (seg.lit != null) { if (s.startsWith(seg.lit, pos)) walkSeg(i + 1, pos + seg.lit.length, bad, num); return; }
    const next = segs[i + 1];
    const tryValue = (end) => {
      const value = s.slice(pos, end); const r = holeOk(seg, value, tokens);
      if (r === 'ng') { if (bad.length >= 2) return; bad.push(value); walkSeg(i + 1, end, bad, num); bad.pop(); }
      else walkSeg(i + 1, end, bad, num || r === 'num');
    };
    if (!next) { tryValue(s.length); return; }
    if (next.lit == null) { for (let e = pos; e <= s.length; e++) tryValue(e); return; } // 穴が続く(名前 + 条件で付く部分)
    let idx = s.indexOf(next.lit, pos);
    while (idx >= 0) { tryValue(idx); idx = s.indexOf(next.lit, idx + 1); }
  };
  walkSeg(0, 0, [], false);
  return best;
}

// ---- 本体 ------------------------------------------------------------------
function analyze(fakeFiles) { // fakeFiles: 自己点検用(実在しない道筋を判定にかける)
  const sources = collectSources();
  const tokens = new Set(); const literals = new Map(); const toolLiterals = new Map(); const patterns = new Map();
  const constOf = new Map(); // 道筋 → 絵の表(data/images/images-*.js)でその道筋を持つ定数の名前
  const identCount = new Map(); // 大文字の名前(定数)が、読んだ物全体で何回出てくるか
  for (const src of sources) {
    let text; try { text = fs.readFileSync(src.full, 'utf8'); } catch (e) { continue; }
    // 行まるごとの注釈(// …)は読まない。注釈に道筋や名前が書いてあるだけの絵を「使っている」にしないため
    if (/\.(js|jsx|ts)$/.test(src.rel)) text = text.replace(/^[ \t]*\/\/.*$/gm, '');
    if (src.kind === 'tools') { collectLiterals(text, 'tools', toolLiterals); continue; }
    if (src.kind !== 'debug') { const idRe = /[A-Z][A-Z0-9_]{3,}/g; let im; while ((im = idRe.exec(text))) identCount.set(im[0], (identCount.get(im[0]) || 0) + 1); }
    if (/^monster-hero\/data\/images\/images-[^/]*\.js$/.test(src.rel)) {
      // 絵の表: 「const 名前 = "images/…"」は、その定数がほかで使われているかまで見る。
      // 道筋を鍵にした表("monsters/x.png": [枠の数字])は、全ファイルぶん機械的に書いてあるので「使っている」の根拠にしない
      const cRe = new RegExp(`const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*["'](images/[^"'?]+\\.(?:${EXT_ALT}))`, 'gi'); let cm;
      while ((cm = cRe.exec(text))) { if (!constOf.has(cm[2])) constOf.set(cm[2], []); constOf.get(cm[2]).push(cm[1]); }
      const rest = text.replace(cRe, 'const $1 = "').replace(/^\s*["'][^"'\n]+["']\s*:\s*\[.*$/gm, '');
      collectLiterals(rest, 'game', literals);
      collectTokens(rest, tokens); collectPatterns(rest, src.rel, src.kind, patterns);
      continue;
    }
    collectLiterals(text, src.kind, literals);
    if (src.kind === 'debug') continue;
    collectTokens(text, tokens);
    collectPatterns(text, src.rel, src.kind, patterns);
  }
  const lowerLiterals = new Map();
  for (const k of literals.keys()) if (k.includes('/')) lowerLiterals.set(k.toLowerCase(), k);
  const patternList = [...patterns.values()];

  const files = walk(IMAGES_DIR, null).map((full) => {
    const rel = 'images/' + path.relative(IMAGES_DIR, full).split(path.sep).join('/');
    return { rel, size: fs.statSync(full).size };
  }).filter((f) => !/(^|\/)(\.gitkeep|CLAUDE\.md)$/.test(f.rel)).sort((a, b) => a.rel.localeCompare(b.rel));
  if (fakeFiles) { files.length = 0; for (const rel of fakeFiles) files.push({ rel, size: 0 }); }

  for (const f of files) {
    const parts = f.rel.split('/'); const base = parts[parts.length - 1];
    const dir = parts.slice(0, -1).join('/'); const stem = base.replace(/\.[^.]+$/, '');
    f.dir = dir;
    const kindsOf = (set) => (set ? [...set] : []);
    // A そのまま書いてある(フォルダ名つき)
    let litKinds = [];
    for (let i = 0; i < parts.length - 1; i++) litKinds = litKinds.concat(kindsOf(literals.get(parts.slice(i).join('/'))));
    const realKinds = litKinds.filter((k) => k === 'game' || k === 'server');
    if (realKinds.length) { f.verdict = 'used'; f.how = 'A'; f.reason = '道筋がそのまま書いてある'; continue; }
    // A' 絵の表の定数で、その定数がほかの所でも使われている
    const consts = constOf.get(f.rel) || [];
    const liveConst = consts.find((n) => (identCount.get(n) || 0) >= 2);
    if (liveConst) { f.verdict = 'used'; f.how = 'A'; f.reason = `絵の表の定数 ${liveConst} が使われている`; continue; }
    // B 名前を組み立てる型
    let bestFail = null; let usedBy = null; let numBy = null;
    for (const p of patternList) {
      for (const target of [f.rel, f.rel.slice('images/'.length)]) {
        const r = matchPattern(p.segs, target, tokens);
        if (!r) continue;
        if (r.bad.length === 0 && !r.num) { usedBy = p; break; }
        if (r.bad.length === 0 && r.num) { numBy = numBy || p; continue; }
        // フォルダの部品が無いだけの当たり(どのフォルダにも合う広い型)は理由にしない
        if (r.bad.some((b) => b.includes('/'))) continue;
        if (!bestFail || r.bad.length < bestFail.bad.length) bestFail = { p, bad: r.bad };
      }
      if (usedBy) break;
    }
    if (usedBy) { usedBy.hits++; f.verdict = 'used'; f.how = 'B'; f.reason = `型 ${usedBy.text} に合う(${usedBy.where})`; continue; }
    // C フォルダと名前が別々に書いてある
    if ((tokens.has(dir) || tokens.has(dir + '/')) && (tokens.has(stem) || tokens.has(base))) {
      f.verdict = 'used'; f.how = 'C'; f.reason = `フォルダ '${dir}' と名前 '${stem}' が別々に書いてある`; continue;
    }
    // ここから下は「使っている」と言えない物
    const check = [];
    if (consts.length) check.push(`絵の表(data/images)に定数 ${consts.join('・')} があるが、その定数をどこも使っていない`);
    if (!IMAGE_EXT_RE.test(base)) check.push('画像でないファイル');
    if (numBy) check.push(`番号を組み立てる型 ${numBy.text} にだけ合う(${numBy.where})`);
    if (litKinds.includes('debug')) check.push('デバッグ用の物(monster-hero/debug)だけが道筋を書いている');
    const baseKinds = kindsOf(literals.get(base));
    if (baseKinds.includes('game') || baseKinds.includes('server')) check.push('ファイル名だけがフォルダ名なしで書かれている');
    const lower = lowerLiterals.get(f.rel.toLowerCase()) || lowerLiterals.get(f.rel.slice('images/'.length).toLowerCase());
    if (lower) check.push(`大文字小文字だけが違う名前で書かれている(${lower})`);
    if (PROTECTED_DIRS.some((d) => f.rel.startsWith(d))) check.push('セーブデータに id が残りうる種類(飾り枠・アイコン)');
    let toolHit = false;
    for (let i = 0; i < parts.length - 1 && !toolHit; i++) toolHit = toolLiterals.has(parts.slice(i).join('/'));
    f.toolOnly = toolHit;
    if (check.length) { f.verdict = 'check'; f.reason = check.join(' / '); continue; }
    f.verdict = 'unused';
    f.reason = bestFail
      ? `型 ${bestFail.p.text} には合うが、部品「${bestFail.bad.join('」「')}」がコード・データに無い(この名前は作られない)`
      : 'コード・データに道筋も名前も無く、どの型にも合わない';
    if (toolHit) f.reason += ' / 道具(tools/)には名前がある';
  }
  return { files, patterns: patternList, sourceCount: sources.filter((s) => s.kind !== 'tools').length };
}

// ---- 出力 ------------------------------------------------------------------
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
const kb = (n) => (n >= 1048576 ? mb(n) : (n / 1024).toFixed(1) + 'KB');
const sum = (list) => list.reduce((a, f) => a + f.size, 0);
function groupKey(rel) { const p = rel.split('/'); return p.length <= 2 ? 'images(直下)' : p.length === 3 ? p[1] : p[1] + '/' + p[2]; }
function byGroup(list) {
  const g = new Map();
  for (const f of list) { const k = groupKey(f.rel); if (!g.has(k)) g.set(k, []); g.get(k).push(f); }
  return [...g.entries()].sort((a, b) => sum(b[1]) - sum(a[1]));
}

function buildReport(res) {
  const { files, patterns } = res;
  const used = files.filter((f) => f.verdict === 'used'); const unused = files.filter((f) => f.verdict === 'unused');
  const check = files.filter((f) => f.verdict === 'check');
  const L = [];
  L.push('# ゲームで使っていない画像の一覧(r1123-008)');
  L.push('');
  L.push('<!-- このファイルは node tools/image/unused-images.js が書く。手で直さない(直すのは道具) -->');
  L.push('');
  L.push('**まだ何も移していない・消していない。** 社長が OK したあとに、保管庫 `archive/unused-assets/` へ移す(消さない)。');
  L.push('判定のしかたと限界は `tools/image/unused-images.js` の頭の説明。静的に読んだ結果なので、移す前に動かして読み込まれた物の記録でも確かめる。');
  L.push('');
  L.push('## 要約');
  L.push('');
  L.push('| 判定 | 枚数 | 容量 |');
  L.push('| --- | ---: | ---: |');
  L.push(`| 全画像 | ${files.length} | ${mb(sum(files))} |`);
  L.push(`| 使っている | ${used.length} | ${mb(sum(used))} |`);
  L.push(`| 使っていない候補 | ${unused.length} | ${mb(sum(unused))} |`);
  L.push(`| 要確認(怪しいので残す側) | ${check.length} | ${mb(sum(check))} |`);
  L.push('');
  const how = { A: '道筋がそのまま書いてある(絵の表の定数を含む)', B: '名前を組み立てる型に合う', C: 'フォルダと名前が別々に書いてある' };
  L.push('「使っている」の内訳: ' + Object.keys(how).map((k) => `${how[k]} ${used.filter((f) => f.how === k).length} 枚`).join(' / '));
  L.push('');
  L.push('## 種類(フォルダ)ごとの内訳');
  L.push('');
  L.push('| フォルダ | 全部 | 使っていない候補 | 容量 | 要確認 | 容量 |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  const groups = byGroup(files).map(([k, list]) => ({ k, list, u: list.filter((f) => f.verdict === 'unused'), c: list.filter((f) => f.verdict === 'check') }))
    .filter((g) => g.u.length || g.c.length).sort((a, b) => sum(b.u) - sum(a.u));
  for (const g of groups) L.push(`| \`${g.k}\` | ${g.list.length} | ${g.u.length} | ${kb(sum(g.u))} | ${g.c.length} | ${kb(sum(g.c))} |`);
  L.push('');
  const listOut = (title, list) => {
    L.push(`## ${title}(${list.length} 枚・${mb(sum(list))})`);
    L.push('');
    if (!list.length) { L.push('なし'); L.push(''); return; }
    for (const [k, items] of byGroup(list)) {
      L.push(`### \`${k}\`(${items.length} 枚・${kb(sum(items))})`);
      L.push('');
      const byReason = new Map();
      for (const f of items) { if (!byReason.has(f.reason)) byReason.set(f.reason, []); byReason.get(f.reason).push(f); }
      for (const [reason, fs2] of byReason) {
        L.push(`- 理由: ${reason}`);
        for (const f of fs2) L.push(`  - \`${f.rel}\` ${kb(f.size)}`);
      }
      L.push('');
    }
  };
  listOut('使っていない候補', unused);
  listOut('要確認', check);
  L.push('## 拾った「名前を組み立てる型」(当たった枚数の多い順)');
  L.push('');
  const hit = patterns.filter((p) => p.hits > 0).sort((a, b) => b.hits - a.hits);
  for (const p of hit) L.push(`- ${p.hits} 枚: \`${p.text}\`(${p.where})`);
  L.push('');
  L.push(`当たらなかった型: ${patterns.length - hit.length} 個(画像のフォルダの外・音・動画の組み立てなど)`);
  L.push('');
  return L.join('\n');
}

// 自己点検: 判定が甘くなって何でも「使っている」にしていないか・厳しくなって使っている絵を候補にしていないか。
// 前に保管庫へ移したカード(archive/unused-assets/README.md)と、作り物の名前を判定にかける
const SELFTEST = [
  ['images/assistant/fullbody/atsu__zzpose.png', 'unused'], // 全身絵に無い表情
  ['images/card-battle/s/C060C.jpg', 'unused'], ['images/card-battle/l/C060C.jpg', 'unused'], // カードの表に無い番号(保管済み)
  ['images/song-art/zz-no-such-song.jpg', 'unused'], ['images/assistant/face/atsu_zzpose.PNG', 'unused'], ['images/monsters/zz-nobody.png', 'unused'],
  ['images/profile-frames/zz-old-frame.png', 'check'], // セーブデータに残りうる種類は、参照が無くても要確認
  ['images/assistant/face/atsu_angry.PNG', 'used'], ['images/assistant/halloween/kiki_sleep.PNG', 'used'], ['images/card-battle/l/001.jpg', 'used'],
  ['images/assistant/fullbody/kiki_twintail__wink.png', 'used'], ['images/story-bg/forest_evening.jpg', 'used'],
];
function selftest() {
  const res = analyze(SELFTEST.map((t) => t[0])); let ng = 0;
  for (const [rel, want] of SELFTEST) {
    const f = res.files.find((x) => x.rel === rel);
    if (f.verdict !== want) { ng++; console.log(`NG: ${rel} は ${want} のはずが ${f.verdict}(${f.reason})`); }
  }
  console.log(ng ? `自己点検 NG ${ng} 件 → この道具の結果で画像を動かさない。窓口へ知らせる` : `自己点検 OK(${SELFTEST.length} 件)`);
  process.exitCode = ng ? 1 : 0;
}

function main() {
  if (flag('--selftest')) { selftest(); return; }
  const res = analyze();
  const { files } = res;
  if (flag('--json')) { process.stdout.write(JSON.stringify(files.map(({ rel, size, verdict, how, reason }) => ({ rel, size, verdict, how, reason }))) + '\n'); return; }
  if (WHY) {
    const hit = files.filter((f) => f.rel.includes(WHY));
    for (const f of hit.slice(0, 40)) console.log(`${{ used: '使っている', unused: '使っていない候補', check: '要確認' }[f.verdict]}  ${f.rel}  ${kb(f.size)}\n    ${f.reason}`);
    if (hit.length > 40) console.log(`… ほか ${hit.length - 40} 枚`);
    if (!hit.length) console.log(`「${WHY}」を道筋に含む画像は無い`);
    return;
  }
  const used = files.filter((f) => f.verdict === 'used'); const unused = files.filter((f) => f.verdict === 'unused');
  const check = files.filter((f) => f.verdict === 'check');
  if (!flag('--no-write')) { fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true }); fs.writeFileSync(OUT_FILE, buildReport(res)); }
  if (res.patterns.length < 10 || used.length < files.length * 0.5) console.log('!! 拾えた型が少ない・「使っている」が半分に満たない。コードの書き方が変わって道具が読めていないかもしれない → この結果で動かさず、窓口へ知らせる');
  console.log(`画像 ${files.length} 枚・${mb(sum(files))}(読んだコード・データ ${res.sourceCount} 本・拾った型 ${res.patterns.length} 個)`);
  console.log(`  使っている        ${used.length} 枚・${mb(sum(used))}`);
  console.log(`  使っていない候補  ${unused.length} 枚・${mb(sum(unused))}`);
  console.log(`  要確認            ${check.length} 枚・${mb(sum(check))}`);
  const top = byGroup(unused).slice(0, flag('--all') ? 999 : 8);
  if (top.length) console.log('使っていない候補の多い所: ' + top.map(([k, l]) => `${k} ${l.length}枚(${kb(sum(l))})`).join(' / '));
  if (flag('--all')) for (const f of unused.concat(check)) console.log(`${f.verdict === 'unused' ? '候補' : '要確認'}  ${f.rel}  ${kb(f.size)}  ${f.reason}`);
  if (!flag('--no-write')) console.log(`一覧: ${relOf(OUT_FILE)}`);
  console.log('(画像は動かしていない。理由を見る: node tools/image/unused-images.js --why <語>)');
}

if (require.main === module) main();
module.exports = { analyze };
