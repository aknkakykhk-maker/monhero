#!/usr/bin/env node
'use strict';
// AUTO∞で「1周目の最初に確定したアシストカードを、次の周回でも同じものにする」ことを確かめる。
//
//   node tools/run/auto-repeat-initial-teaching-check.js
//
// 【なぜ道具にするか】
// ここは「毎周ランダムに変わってしまう」という形で表に出る。ランダムなので目視では
// 直ったかどうかが判定しづらく、たまたま同じカードが出ただけかもしれない。
// 覚える条件(ラン開始時の1枚だけ・手動でもAUTOでも・∞がONでなくても)と、
// 使い直す条件(見つからなければランダムへ落とす)を、実装から取り出して1つずつ確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from), j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// --- 選び直しの本体をそのまま動かす ---
const sandbox = { console, Math, Array };
vm.createContext(sandbox);
vm.runInContext([
  slice('const chooseAutoTeachingCard', 'const trainingOptionOf'),
  'globalThis.api = { chooseAutoTeachingCard, resolveRepeatInitialTeaching };',
].join('\n'), sandbox);
const { chooseAutoTeachingCard, resolveRepeatInitialTeaching } = sandbox.api;

const pool = [
  { id: 'dodge', name: '完全回避' },
  { id: 'guard', name: 'ガード' },
  { id: 'heal', name: '回復' },
  { id: 'power', name: '力' },
];

// ① 覚えたカードを選び直せる
check('覚えたIDから同じカードを選び直せる', resolveRepeatInitialTeaching(pool, 'dodge')?.id === 'dodge');
check('覚えていない(null)ならカードを返さない', resolveRepeatInitialTeaching(pool, null) === null
  && resolveRepeatInitialTeaching(pool, '') === null && resolveRepeatInitialTeaching(pool, undefined) === null);
check('候補に無いIDならカードを返さない（ランダムへ落とすため）',
  resolveRepeatInitialTeaching(pool, 'deleted_card') === null);
check('候補が壊れていても落ちない',
  resolveRepeatInitialTeaching(null, 'dodge') === null
  && resolveRepeatInitialTeaching([], 'dodge') === null
  && resolveRepeatInitialTeaching([null, undefined, {}], 'dodge') === null);
// ② 落としたあとは、これまでどおりのランダム選択がそのまま働く
check('見つからないときのフォールバック先は今までのランダム選択',
  (() => {
    const fixed = resolveRepeatInitialTeaching(pool, 'deleted_card');
    const choice = fixed || chooseAutoTeachingCard(pool, [], true, () => 0.99);
    return !fixed && choice && pool.some(card => card.id === choice.id);
  })());

// --- 覚えるタイミング・使う場所を実装から見る ---
const confirm = slice('const confirmPickTeaching = (explicitTeaching=null) => {', '// トレーニング(旧「能力覚醒」)を確定する');
const create = slice('const createRepeatRunTemplate =', 'const resolveRepeatRunTemplate =');
const startRun = slice('const startRunFromRepeatTemplate =', 'const updateNoticeVisible =');
const autoPick = slice("if(gameState==='PICK_TEACHING'){", "if(gameState==='UPGRADE_SKILL'){");

check('テンプレートは安定したIDだけを持つ（カードそのものは持たない）',
  create.includes('initialTeachingId:null')
  && !/initialTeaching\s*:\s*(?!null)/.test(create)
  && !/evoLevel|ownedTeachings|teachingPool/.test(create));
check('覚えるのはラン開始時の1枚だけ（既存の !enemy 判定を使う）',
  confirm.includes('if (!enemy && repeatRunTemplateRef.current && !repeatRunTemplateRef.current.initialTeachingId && teaching.id)'));
check('WAVE途中のカードで書き換えない（すでに覚えていれば上書きしない）',
  confirm.includes('!repeatRunTemplateRef.current.initialTeachingId'));
check('覚えるのは確定処理そのもの（手動でもAUTOでも同じ経路）',
  confirm.includes('const teaching=explicitTeaching||selectedTeachingCard;')
  && confirm.indexOf('const teaching=explicitTeaching') < confirm.indexOf('initialTeachingId:teaching.id'));
// コメントを外して、実際のコードが autoRepeat を見ていないことだけを確かめる
const confirmCode = confirm.replace(/\/\/[^\n]*/g, '');
check('∞がONでなくても覚える（autoRepeatの状態を見ない）', !/autoRepeat/.test(confirmCode));
// 1周目でも覚えられるように、テンプレートは PICK_TEACHING へ入る前に作られている
check('1周目もPICK_TEACHINGへ入る前にテンプレートができている', (() => {
  const at = source.indexOf('repeatRunTemplateRef.current=createRepeatRunTemplate({ hero:m, allies:[] });');
  const next = source.indexOf("setGameState('PICK_TEACHING')", at);
  return at > 0 && next > at && next - at < 200;
})());
check('次の周回でもテンプレートを持ち越す（IDは正規化して渡す）',
  startRun.includes('repeatRunTemplateRef.current=Object.freeze({ ...template, initialTeachingId:resolved.initialTeachingId })'));
check('AUTOの初回選択で覚えたカードを使い、見つからなければランダムへ落とす',
  autoPick.includes('const fixedInitial=!enemy')
  && autoPick.includes('resolveRepeatInitialTeaching(teachingPool, repeatRunTemplateRef.current?.initialTeachingId)')
  && autoPick.includes('const choice=fixedInitial||chooseAutoTeachingCard(teachingPool,ownedTeachings,!enemy);'));
check('WAVE途中の選択は今までどおり（固定を効かせない）',
  autoPick.includes('const fixedInitial=!enemy') && !/fixedInitial[\s\S]*enemy\s*\?/.test(autoPick.replace('const fixedInitial=!enemy', '')));
check('取得はこれまでの確定経路(confirmPickTeaching)を使う',
  autoPick.includes('confirmPickTeaching(choice);')
  && !/setOwnedTeachings|initBattle/.test(autoPick));
// 前の周回の育ち具合は持ち越さない(引き継ぐのは種類だけ)。
// アシストカードの持ち物は applyResetAllState で白紙になり、候補は毎周作り直す
check('前の周回の強化状態を持ち越さない',
  !/evoLevel|ownedTeachings/.test(create)
  && startRun.includes('setTeachingPool([...getActiveTeachingCards()])')
  && startRun.includes('applyResetAllState()')
  && !/setOwnedTeachings/.test(startRun));
// 保存キー・設定UIを増やしていない
// 既存の mh_teaching_roster / mh_unlocked_teachings はそのまま。
// 周回や固定カードのための保存キーを新しく作っていないことを見る
check('新しい保存キーを増やしていない',
  !/['"]mh_[^'"]*(?:repeat|infinity|fixed|initial_teaching)/i.test(source));
check('AUTO設定へアシストカードの項目を増やしていない',
  !/autoSettings\s*\.\s*teaching/.test(source) && !/teaching:\s*\{/.test(slice('const DEFAULT_AUTO_SETTINGS', 'const normalizeAutoSettings')));
check('ヘルプに次の周回でも同じカードを使うと書いてある',
  help.includes('1周目で最初に選んだアシストカード'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
