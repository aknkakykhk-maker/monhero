// アプリが送るリクエストの形と、本番へ適用したテーブル定義(docs/BOND_LEVELS_APPLY.sql)が
// 食い違っていないかを、実際のファイルから読み取って突き合わせる。
//
//   node bond-levels-schema-match-check.js
//
// 【なぜ要るか】
// bond-levels-table-check.js は Supabase を差し替えた偽物で動かすため、
// 「アプリが投げた列名が本物のテーブルに在るか」は分からない。列名を1文字打ち間違えても
// 偽物は 200 を返すのでテストは通り、本番へ出してから初めて 400 で書けないと分かる。
// bond_levels は削除の権限をわざと与えていない(消せない)ので、
// 間違った形で書き始めてしまうと後始末ができない。そこで、
//   ① SQL から  … 実在する列・主キー・権限・CHECK制約
//   ② JSXから  … 取得する列(select)・upsertで送る列・on_conflict・Preferヘッダ
// を取り出し、機械的に照合する。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, GAME_SYSTEM } = require('./harness');

const APPLY_SQL = path.join(REPO_ROOT, 'docs', 'BOND_LEVELS_APPLY.sql');
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// ---- ① 適用したSQLから、本物のテーブルの姿を取り出す ----
const sql = fs.readFileSync(APPLY_SQL, 'utf8');

const createMatch = sql.match(/create table if not exists public\.bond_levels\s*\(([\s\S]*?)\n\);/);
if (!createMatch) {
  console.error('NG: BOND_LEVELS_APPLY.sql に bond_levels の create table が見つかりませんでした');
  process.exit(1);
}
const sqlColumns = [];
const notNullColumns = [];
const defaultColumns = [];
for (const rawLine of createMatch[1].split('\n')) {
  const line = rawLine.replace(/--.*$/, '').trim().replace(/,$/, '');
  if (!line || /^constraint\b/i.test(line)) continue;
  const m = line.match(/^([a-z_][a-z0-9_]*)\s+([a-z]+)/i);
  if (!m) continue;
  sqlColumns.push(m[1]);
  if (/\bnot\s+null\b/i.test(line)) notNullColumns.push(m[1]);
  if (/\bdefault\b/i.test(line)) defaultColumns.push(m[1]);
}

const pkMatch = createMatch[1].match(/primary key\s*\(([^)]+)\)/i);
const pkColumns = pkMatch ? pkMatch[1].split(',').map(s => s.trim()) : [];

const checkMatch = createMatch[1].match(/check\s*\(bond_level >= (\d+) and bond_level <= (\d+)\)/i);
const bondRange = checkMatch ? { min: Number(checkMatch[1]), max: Number(checkMatch[2]) } : null;

const grantMatch = sql.match(/grant ([^;]+) on public\.bond_levels to ([^;]+);/);
const grantedPrivileges = grantMatch ? grantMatch[1].split(',').map(s => s.trim().toLowerCase()) : [];
const hasRevoke = /revoke all on public\.bond_levels from anon, authenticated;/.test(sql);

const sqlIndexColumns = [...sql.matchAll(/create index if not exists \w+\s*\n?\s*on public\.bond_levels \(([^)]+)\)/g)]
  .map(m => m[1].split(',').map(s => s.trim().replace(/\s+desc$/i, '')));

// ---- ② アプリ側から、実際に送るリクエストの形を取り出す ----
const src = fs.readFileSync(GAME_SYSTEM, 'utf8');

const tableMatch = src.match(/const BOND_LEVELS_TABLE = '([^']+)';/);
const selectMatch = src.match(/const BOND_LEVELS_SELECT = '([^']+)';/);
const appTable = tableMatch ? tableMatch[1] : null;
const appSelect = selectMatch ? selectMatch[1].split(',').map(s => s.trim()) : [];

const fetchUrlMatch = src.match(/\$\{SUPABASE_URL\}\/rest\/v1\/\$\{BOND_LEVELS_TABLE\}\?select=\$\{BOND_LEVELS_SELECT\}`\s*\n?\s*\+ `&order=([a-z_]+)\.([a-z.]+)&limit=/);
const orderColumn = fetchUrlMatch ? fetchUrlMatch[1] : null;
const orderDirection = fetchUrlMatch ? fetchUrlMatch[2] : null;

const conflictMatch = src.match(/\$\{BOND_LEVELS_TABLE\}\?on_conflict=([a-z_,]+)`/);
const onConflict = conflictMatch ? conflictMatch[1].split(',').map(s => s.trim()) : [];

const preferMatch = src.match(/'Prefer': '([^']+)'[^]*?BOND_LEVELS|'Prefer': '(resolution=merge-duplicates[^']*)'/);
const preferHeader = preferMatch ? (preferMatch[2] || preferMatch[1]) : null;

// upsertで送る行の組み立て(bondLevelRowsFromParty)から、実際に入れる列名を取り出す
const rowBuildMatch = src.match(/byIndividual\.set\(individualId, \{([\s\S]*?)\n    \}\);/);
const upsertColumns = rowBuildMatch
  ? [...rowBuildMatch[1].matchAll(/(?:^|[\s,{])([a-z_][a-z0-9_]*)\s*:/g)].map(m => m[1])
  : [];

// ---- ③ 突き合わせ ----
console.log('== テーブルの姿(docs/BOND_LEVELS_APPLY.sql) ==');
console.log(`  列: ${sqlColumns.join(', ')}`);
console.log(`  主キー: ${pkColumns.join(', ')}`);
console.log(`  権限: ${grantedPrivileges.join(', ')}`);
console.log('\n== アプリが送る形(game-system.jsx) ==');
console.log(`  取得する列: ${appSelect.join(', ')}`);
console.log(`  upsertで送る列: ${upsertColumns.join(', ')}`);
console.log(`  on_conflict: ${onConflict.join(', ')}`);

console.log('\n== 照合 ==');
check('テーブル名が bond_levels', appTable === 'bond_levels', String(appTable));

const missingInTable = appSelect.filter(c => !sqlColumns.includes(c));
check('取得する列がすべて実在する', appSelect.length > 0 && missingInTable.length === 0,
  missingInTable.length ? `テーブルに無い列: ${missingInTable.join(', ')}` : `${appSelect.length}列`);

const upsertMissing = upsertColumns.filter(c => !sqlColumns.includes(c));
check('upsertで送る列がすべて実在する', upsertColumns.length > 0 && upsertMissing.length === 0,
  upsertMissing.length ? `テーブルに無い列: ${upsertMissing.join(', ')}` : `${upsertColumns.length}列`);

// NOT NULL かつ既定値の無い列を送り忘れると、その周回の書き込みが丸ごと失敗する
const requiredColumns = notNullColumns.filter(c => !defaultColumns.includes(c));
const notSent = requiredColumns.filter(c => !upsertColumns.includes(c));
check('NOT NULLの列を送り忘れていない', notSent.length === 0,
  notSent.length ? `送っていない必須列: ${notSent.join(', ')}` : requiredColumns.join(', '));

check('on_conflict が主キーと一致する',
  pkColumns.length > 0 && onConflict.length === pkColumns.length && onConflict.every((c, i) => c === pkColumns[i]),
  `on_conflict=${onConflict.join(',')} / 主キー=${pkColumns.join(',')}`);

check('upsertに resolution=merge-duplicates を付けている',
  !!preferHeader && preferHeader.includes('resolution=merge-duplicates'), String(preferHeader));

check('並べ替えに使う列が実在し、索引がある',
  !!orderColumn && sqlColumns.includes(orderColumn) && sqlIndexColumns.some(cols => cols[0] === orderColumn),
  `order=${orderColumn}.${orderDirection} / 索引=${sqlIndexColumns.map(c => c.join('+')).join(' , ')}`);

// 種類別タブはモンスターごとに絞り込むので、その索引も要る
check('種類別タブ用の索引がある(monster_id)',
  sqlIndexColumns.some(cols => cols[0] === 'monster_id'),
  sqlIndexColumns.map(c => c.join('+')).join(' , '));

// 絆Lvは計算上の上限があるため、CHECK制約に引っかかって
// バッチ全体が400で落ちることが無いことを確かめる
const iterMatch = src.match(/const MAX_BOND_LEVEL_ITERATIONS = (\d+);/);
const maxBondLevel = iterMatch ? Number(iterMatch[1]) + 1 : null;
check('ありうる絆LvがCHECK制約の範囲に収まる',
  !!bondRange && !!maxBondLevel && maxBondLevel <= bondRange.max,
  `絆Lvの上限=${maxBondLevel} / 制約=${bondRange ? `${bondRange.min}〜${bondRange.max}` : '不明'}`);

// 0以下は送らない(CHECKの下限とアプリ側の足切りが噛み合っているか)
check('絆Lvが0以下の個体は送らない',
  /if \(!member \|\| !Number\.isFinite\(bondLevel\) \|\| bondLevel <= 0\) return;/.test(src),
  `制約の下限=${bondRange ? bondRange.min : '不明'}`);

check('書き込みに要る権限(select/insert/update)が与えられている',
  ['select', 'insert', 'update'].every(p => grantedPrivileges.includes(p)),
  grantedPrivileges.join(', '));

check('deleteの権限は与えない(自動付与ぶんもrevokeで外す)',
  !grantedPrivileges.includes('delete') && hasRevoke,
  hasRevoke ? 'revoke all のあとに3権限だけ付与' : 'revoke all が無い(自動付与のDELETEが残る)');

// 送信は待たずに投げる(結果画面を待たせない)ことも、崩れると体感に出るので固定しておく
check('upsertは周回の進行を止めない(結果を待たない)',
  /sbUpsertBondLevels\(bondRows\)[\s\S]{0,200}?\.catch\(/.test(src),
  '投げっぱなし + catchで握りつぶし');

const ng = results.filter(r => !r).length;
console.log(`\n${results.length - ng}/${results.length} 項目が一致`);
if (ng) {
  console.error('\nNG: アプリが送る形と本番のテーブル定義が食い違っています。');
  console.error('    bond_levels は削除の権限を与えていないため、間違った形で書き始めると後始末ができません。');
  process.exit(1);
}
console.log('すべてOK');
