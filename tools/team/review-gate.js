#!/usr/bin/env node
// いまの変更に、検査部(ミハリ)の確認が要るかを、変えたファイルと差分から機械で判定する。
//
//   node tools/ctx.js gate                 … いまの変更(origin/main との差 + 未コミットの分)を判定
//   node tools/ctx.js gate --base <ref>    … その版との差で判定(ミハリが公開前後を見るとき)
//   node tools/ctx.js gate --json          … 機械が読む形
//   (node tools/run-checks.js --changed の最後にも同じ1行が出る)
//
// 【決まり】(2026-11-11 社長「トークンを無駄に使わない仕組み」案D。本文は docs/rules/REVIEW_GATE.md)
// ミハリの確認が要るのは、①保存データ ②ランキング・Supabase ③新機能 に関わる変更だけ。
// それ以外(表示のずれ・文言・絵の差し替え・検査や資料だけ)は、部の run-checks.js --changed が通れば公開してよい。
// ・Edge Function(supabase/functions/)だけの変更は、マージしても本番が変わらない(本番は配ったときの固定の版を読む)ので、
//   確かめるのは配り直しのとき。マージは止めない。
// ・迷う変更は「要る」に倒す(壊すと戻せないため)。この道具は検査の代わりではない。検査はこれまでどおり全部通す。
// ・終了コードはいつも 0(判定を出すだけで、公開を止めない)。
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, PARTS, DATA, GENERATED, git, cut } = require('./lib');

const SAVE_FILES = [PARTS + '25-storage.jsx', DATA + 'mhsave-backup.js'];
const KEY_RE = /['"`](mh_[A-Za-z0-9_]+)/g;
const SAVE_LINE_RE = /localStorage\.(removeItem|clear)\(|_migrated_v\d|indexedDB\.deleteDatabase/;
// 既存のキーの値に項目を足す・形を変える変更(2026-11-13 ミハリ6: #5866 の aptUp・aptBase を見落とした穴)。誤報が少し出てもよい
//   ・保存の入れ物の部品(名前に store・storage・backup・save・record を含む本体・データのファイル)の増えた行
//   ・保存値を読み戻す行(raw.〜 を読む・restore / normalize〜 / msxNorm〜 / 〜Norm( を呼ぶ・storeSet で書く)
const SAVE_SHAPE_FILE_RE = /(^|\/)[^/]*(store|storage|backup|save|record)[^/]*\.(jsx|js)$/i;
const SAVE_SHAPE_LINE_RE = /\braw\??\.[A-Za-z_]\w*|\b(restore|normalize[A-Z]\w*|msxNorm\w*|\w+Norm)\s*\(|\bstoreSet\(/;
const RANK_LINE_RE = /\.rpc\(\s*['"`]|\.from\(\s*['"`][a-z_]+['"`]\s*\)\s*\.\s*(insert|upsert|update|delete)|\.(upsert|insert)\(\s*[\[{]|submit[A-Z]\w*(Score|Rank|Record|Result)\w*\s*[=(]/;
const FLAG_FILE = PARTS + '17-release-changelog-login-missions.jsx';
const FLAG_LINE_RE = /^\s*[A-Za-z]\w*:\s*true\s*,|_RELEASE\w*\s*=\s*true\b/;

function baseRef(arg) {
  if (arg) return arg;
  const mb = git(['merge-base', 'HEAD', 'origin/main']).trim();
  return mb || 'HEAD';
}

function judge({ base } = {}) {
  const ref = baseRef(base);
  const names = new Map(); // file -> status
  for (const l of git(['diff', '--name-status', ref]).split('\n').filter(Boolean)) {
    const p = l.split('\t'); names.set(p[p.length - 1], p[0][0]);
  }
  for (const f of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)) names.set(f, 'A');
  const files = [...names.keys()].filter(f => !GENERATED.test(f));
  const save = [], rank = [], feature = [], edge = [];
  let final = false;

  for (const f of files) {
    if (SAVE_FILES.includes(f)) save.push(`保存の土台を変えている: ${f}`);
    if (/^supabase\/migrations\//.test(f) || /^docs\/sql\//.test(f)) rank.push(`SQL(表・関数)を足している/変えている: ${f}`);
    else if (/^supabase\/functions\//.test(f)) edge.push(f);
    if (f.startsWith(PARTS) && f.endsWith('.jsx') && names.get(f) === 'A') { feature.push(`新しい部品を足している: ${f}`); final = true; }
  }

  // 差分の行(本体とデータだけ。増えた行・消えた行)
  const src = files.filter(f => (f.startsWith(PARTS) || f.startsWith(DATA)) && /\.(jsx|js)$/.test(f) && names.get(f) !== 'A');
  const added = [], removed = [];
  if (src.length) {
    let cur = '';
    for (const l of git(['diff', '-U0', ref, '--', ...src]).split('\n')) {
      if (l.startsWith('+++ ')) { cur = l.slice(6); continue; }
      if (l.startsWith('--- ') || l.startsWith('@@')) continue;
      if (l[0] === '+') added.push([cur, l.slice(1)]); else if (l[0] === '-') removed.push([cur, l.slice(1)]);
    }
  }
  for (const f of files.filter(f => names.get(f) === 'A' && f.startsWith(PARTS) && f.endsWith('.jsx'))) {
    try { for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) added.push([f, line]); } catch (e) { /* 読めなければ見ない */ }
  }

  // ① 保存データ
  const keysIn = (rows) => { const s = new Map(); for (const [f, line] of rows) for (const m of line.matchAll(KEY_RE)) if (!s.has(m[1])) s.set(m[1], f); return s; };
  const addedKeys = keysIn(added), removedKeys = keysIn(removed);
  const existsAt = (key, where) => !!git(['grep', '-l', '-F', key, ...(where ? [where] : []), '--', PARTS, DATA]).trim();
  for (const [key, f] of addedKeys) if (!existsAt(key, ref)) save.push(`新しい保存キー ${key}(${path.basename(f)})`);
  for (const [key, f] of removedKeys) if (!addedKeys.has(key) && !existsAt(key, '')) save.push(`★保存キー ${key} を使う行がすべて消えた(${path.basename(f)})。既存のキーは消さない決まり`);
  {
    const code = (line) => line.trim() && !/^\s*(\/\/|\*|\/\*)/.test(line);
    const shape = added.filter(([f, line]) => code(line) && (SAVE_SHAPE_FILE_RE.test(f) || SAVE_SHAPE_LINE_RE.test(line)) && !SAVE_FILES.includes(f));
    if (shape.length) save.push(`保存の形に項目を足している/変えている(既存のキーの値)${shape.length} 行(${[...new Set(shape.map(r => path.basename(r[0])))].slice(0, 4).join('・')})`);
  }
  for (const [f, line] of [...added, ...removed]) if (SAVE_LINE_RE.test(line)) { save.push(`保存を消す・移す行に触れている(${path.basename(f)}): ${cut(line.trim(), 70)}`); break; }

  // ② ランキング・Supabase
  const rk = [...added, ...removed].filter(([, line]) => RANK_LINE_RE.test(line));
  if (rk.length) rank.push(`ランキング・通信の送り方に触れている ${rk.length} 行(${[...new Set(rk.map(r => path.basename(r[0])))].slice(0, 3).join('・')})`);

  // ③ 新機能
  const cl = added.filter(([f]) => f === DATA + 'changelog.js').length;
  if (cl >= 3) feature.push(`更新履歴に ${cl} 行足している(プレイヤーに見える変更)`);
  const fl = added.filter(([f, line]) => (f === FLAG_FILE && FLAG_LINE_RE.test(line)) || /_PUBLIC_RELEASE\w*\s*=\s*true\b/.test(line));
  if (fl.length) { feature.push(`公開の印を真にしている: ${cut(fl[0][1].trim(), 60)}`); final = true; }

  // Edge Function は、マージしても本番は変わらない(本番は配ったときの固定の版を読む)。確かめるのは配り直しのとき
  const mergeNeed = save.length + rank.length + feature.length > 0;
  const need = mergeNeed || edge.length > 0;
  // 確認のモデル(docs/rules/MODEL_ROUTING.md): 新しい画面・公開の印 → 要所のモデルで最終確認 / 保存・ランキング → 設計のモデル / ほか → 検査のモデル
  const model = !need ? '' : final ? 'claude-fable-5-2' : (save.length || rank.length || edge.length) ? 'claude-opus-5-5' : 'claude-sonnet-5-5';
  return { need, mergeNeed, save, rank, feature, edge, final, model, files: files.length, base: ref };
}

function format(r) {
  if (!r.files) return 'ミハリ確認: 変更がありません';
  if (!r.need) return `ミハリ確認: 要らない(保存データ・ランキング・新機能に触れていない ${r.files} ファイル)。run-checks.js --changed が通れば公開してよい`;
  const L = [r.mergeNeed ? 'ミハリ確認: 要る(マージの前に窓口へ知らせる。docs/rules/REVIEW_GATE.md)' : 'ミハリ確認: 要る(配り直しのとき。マージは進めてよい。docs/rules/REVIEW_GATE.md)'];
  for (const x of r.save) L.push(`  ・保存データ: ${x}`);
  for (const x of r.rank) L.push(`  ・ランキング/Supabase: ${x}`);
  for (const x of r.feature) L.push(`  ・新機能: ${x}`);
  if (r.edge.length) L.push(`  ・Edge Function: ${r.edge.map(f => f.replace('supabase/functions/', '')).join('・')}(マージでは本番は変わらない。main に入ったら窓口へ配り直しを頼み、配ったあとに本番で確かめる)`);
  L.push(`  確認のモデル: ${r.model}${r.final ? '(新機能の公開前の最終確認・1回)' : ''}`);
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--base');
  let r;
  try { r = judge({ base: i >= 0 ? argv[i + 1] : undefined }); } catch (e) { console.log('ミハリ確認: 判定できませんでした(' + (e && e.message) + ')。迷うときは「要る」として窓口へ'); return; }
  console.log(argv.includes('--json') ? JSON.stringify(r, null, 1) : format(r));
}

if (require.main === module) main();
module.exports = { judge, format };
