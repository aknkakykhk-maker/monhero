// 種族チャレンジ系checkが共有する、血統ヘルパーの読み込み。
//
// 「種族」は主血統(モッチー種・ピクシー種…)なので、選択validationも報酬も
// monsterLineageOf / dexMainLineages を通る。これらは data/lineages.js と
// game-system.jsx の別々の場所にあり、check側で切り出すコードの外にある。
// 各checkが同じ読み込みを書き写すと片方だけ直して食い違うので、ここへまとめる。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT } = require('../harness');

// checkが vm.createContext へ渡す前の sandbox へ、血統の引き方を実物のまま流し込む。
// スタブ(偽物)は作らない。本番と同じ関数を使わないと、種族の判定がずれても気づけない
const installLineageHelpers = (vm, context, { source = null } = {}) => {
  const jsx = source || fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
  const lineages = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/lineages.js'), 'utf8');
  const allyMonsters = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/ally-monsters.js'), 'utf8');
  const helperStart = jsx.indexOf('const UNKNOWN_LINEAGE =');
  const helperEnd = jsx.indexOf('// ==================== 総合力 ====================', helperStart);
  if (helperStart < 0 || helperEnd < 0) throw new Error('血統ヘルパーが見つかりません');
  // ally-monsters.js は画像定数(MOCCHI_IMG 等)を参照する。血統の判定には使わないので、
  // data/images/images-ally.js を実物のまま先に読み込んでおく
  const imagesAlly = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8');
  vm.runInContext('var window=undefined;', context);
  vm.runInContext(
    [imagesAlly, allyMonsters, lineages, jsx.slice(helperStart, helperEnd)]
      .map(part => part.replace(/^const /gm, 'var ')).join('\n'),
    context, { filename: 'lineage-helpers' });
  return context;
};

module.exports = { installLineageHelpers };
