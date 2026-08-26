// モンスター一覧(編成・ベースモン一覧・マスモン一覧)の「種族しぼりこみ」と「並べかえ」を確認する。
//
//   node tools/monster/monster-list-filter-check.js
//
// この3画面は同じ設定(mh_monster_list_settings)を共有している。見張りたいのは3つ。
//
//  ① 画面で選べる並べかえと、保存が受け付ける並べかえが同じ顔ぶれであること
//     片方にだけ足すと「選べるのに開き直すと元に戻る」になる。実際に「総合力」が
//     保存側へ足されておらず、選んでも次に開くと血統順へ戻っていた。しかも
//     normalizeMonsterListSettings は弾いたとき設定ごと既定へ戻すので、
//     一緒に表示設定まで失われていた。
//  ② 種族しぼりこみを後から足しても、既存の保存値が失われないこと
//     版を上げると保存ごと既定へ戻ってしまう。版は1のまま、無い項目だけ既定で補う。
//  ③ しぼりこみと並べかえが別軸で、掛け合わせて効くこと
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const web = path.join(REPO_ROOT, 'monster-hero');
const read = (rel) => fs.readFileSync(path.join(web, rel), 'utf8');
const source = read('src/game-system.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- ① 画面の選択肢と保存の許可リストが一致しているか ----
const optionKeys = (() => {
  const block = source.match(/const MONSTER_SORT_OPTIONS = \[([\s\S]*?)\];/);
  return block ? [...block[1].matchAll(/key: '([a-z]+)'/g)].map(m => m[1]) : null;
})();
const savedKeys = (() => {
  const line = source.match(/const MONSTER_LIST_SORT_KEYS = \[([^\]]*)\];/);
  return line ? [...line[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]) : null;
})();
check('画面の並べかえ選択肢を取り出せる', !!optionKeys, optionKeys ? optionKeys.join(',') : '');
check('保存が受け付ける並べかえキーを取り出せる', !!savedKeys, savedKeys ? savedKeys.join(',') : '');
if (optionKeys && savedKeys) {
  const onlyInUi = optionKeys.filter(k => !savedKeys.includes(k));
  const onlyInSave = savedKeys.filter(k => !optionKeys.includes(k));
  check('画面で選べる並べかえは、すべて保存できる', onlyInUi.length === 0,
    onlyInUi.length ? `保存側に無い: ${onlyInUi.join(', ')}（選んでも開き直すと戻ってしまう）` : '');
  check('保存側にだけある並べかえが無い', onlyInSave.length === 0, onlyInSave.join(', '));
  check('総合力で並べかえられる', optionKeys.includes('power') && savedKeys.includes('power'));
}

// ---- 保存の正規化を実際に動かす ----
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('data/lineages.js'),
  source.slice(source.indexOf('const MONSTER_LIST_SORT_KEYS'), source.indexOf('const normalizeFusionSortSettings')),
  'globalThis.OUT = { normalizeMonsterListSettings, DEFAULT_MONSTER_LIST_SETTINGS, MONSTER_LINEAGES };',
].join('\n'), ctx);
const { normalizeMonsterListSettings: normalize, DEFAULT_MONSTER_LIST_SETTINGS: DEFAULTS, MONSTER_LINEAGES } = ctx.OUT;

const display = { base: false, masu: true, fused: true, active: false, reborn: true };
// 総合力を選んだ設定が、そのまま読み戻せること
{
  const saved = { version: 1, modalTab: 'sort', sortKey: 'power', sortDir: 'desc', lineage: 'all', display };
  const back = normalize(saved);
  check('総合力の並べかえが保存から復元できる', back.sortKey === 'power' && back.sortDir === 'desc', `sortKey=${back.sortKey}`);
  check('そのとき表示設定も失われない', JSON.stringify(back.display) === JSON.stringify(display));
}
// ---- ② 種族しぼりこみを持っていない既存の保存値 ----
{
  const legacy = { version: 1, modalTab: 'sort', sortKey: 'bond', sortDir: 'desc', display };
  const back = normalize(legacy);
  check('種族の項目が無い既存の保存値でも既定値で補う', back.lineage === 'all', `lineage=${back.lineage}`);
  check('そのとき並べかえ・表示設定はそのまま残る',
    back.sortKey === 'bond' && back.sortDir === 'desc' && JSON.stringify(back.display) === JSON.stringify(display));
}
// 版は上げない(上げると保存ごと既定へ戻り、並べかえも表示設定も失われる)
check('保存の版を1のままにしている', DEFAULTS.version === 1);
check('既定は「すべての種族」', DEFAULTS.lineage === 'all');
// 知らない種族idや壊れた値は「すべて」へ落とす
{
  const first = Object.keys(MONSTER_LINEAGES)[0];
  check('実在する種族idはそのまま残る',
    normalize({ version: 1, modalTab: 'lineage', sortKey: 'name', sortDir: 'asc', lineage: first, display }).lineage === first);
  for (const broken of ['__unknown__', 123, null, {}]) {
    const back = normalize({ version: 1, modalTab: 'sort', sortKey: 'name', sortDir: 'asc', lineage: broken, display });
    if (back.lineage !== 'all') { check(`壊れた種族id(${JSON.stringify(broken)})は「すべて」に落とす`, false, `lineage=${back.lineage}`); break; }
  }
  check('壊れた種族idは「すべて」に落とす', true);
}
check('モーダルの種族タブを保存できる',
  normalize({ version: 1, modalTab: 'lineage', sortKey: 'name', sortDir: 'asc', lineage: 'all', display }).modalTab === 'lineage');

// ---- ③ しぼりこみと並べかえが別軸で掛け合わさるか ----
check('しぼりこみは並べかえ・表示設定と別に持っている',
  source.includes('const [monsterLineageFilter, setMonsterLineageFilter] = useState(\'all\');'));
check('しぼりこみを一覧へ掛けている',
  source.includes('const monsterEntryMatchesLineage = (e) => monsterLineageFilter === \'all\'')
  && source.includes("monsterLineageOf(e.baseId).main.id === monsterLineageFilter"));
// 並べかえたあとに絞る形になっていること(どちらか一方しか効かない書き方になっていないか)
const bothApplied = (name) => new RegExp(`${name} = useMemo\\(\\s*\\(\\) => sortMonsterEntries\\([\\s\\S]{0,220}monsterEntryMatchesLineage\\(e\\)`).test(source);
check('編成/一覧の両方で、並べかえとしぼりこみが同時に効く',
  bothApplied('unifiedMonsterEntriesSingleType') && bothApplied('unifiedMonsterEntriesDraft'));
// 種族が変わったら計算し直すこと(useMemoの依存に入っていないと画面が更新されない)
check('しぼりこみを変えたら一覧を計算し直す',
  (source.match(/monsterDisplayFlags, monsterLineageFilter\]/g) || []).length >= 2);
// 種族の顔ぶれを画面へ書き写していないこと(モンスターを足したとき2か所直すことになる)
const hardcoded = Object.values(MONSTER_LINEAGES).map(l => l.name)
  .filter(name => source.includes(`'${name}種'`) || source.includes(`"${name}種"`));
check('画面側に種族名を書き写していない', hardcoded.length === 0, hardcoded.join(', '));
check('種族の選択肢を dexMainLineages から作っている',
  source.includes("...dexMainLineages().map(l=>({id:l.id,label:`${l.name}種`}))"));

// しぼりこみのボタンを出している画面で、実際に絞れていること。
// 一覧の組み立てには2通りある。共通のuseMemo(unifiedMonsterEntries*)を使う画面と、
// 画面側で buildUnifiedMonsterEntries を直に呼ぶ画面。後者はしぼりこみを書き足さないと
// 「ボタンは出るのに何も起きない」になる(超越・放牧設定が実際にそうなっていた)。
{
  // 一覧を組み立てている場所をすべて拾い、その直後にしぼりこみが書いてあるかを見る。
  // 込み入った正規表現は書き方の揺れで取りこぼすので、出現位置から一定の範囲を見るだけにする
  const NEEDLE = 'sortMonsterEntries(buildUnifiedMonsterEntries(';
  const sites = [];
  for (let at = source.indexOf(NEEDLE); at >= 0; at = source.indexOf(NEEDLE, at + 1)) sites.push(at);
  check('一覧を組み立てている場所を見つけられる', sites.length > 0, `${sites.length}か所`);
  const missing = sites.filter(at => !source.slice(at, at + 400).includes('monsterEntryMatchesLineage'));
  check('一覧を組み立てているすべての場所でしぼりこみが掛かっている', missing.length === 0,
    missing.map(at => source.slice(at, at + 110).replace(/\s+/g, ' ')).join(' / '));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
