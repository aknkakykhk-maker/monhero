#!/usr/bin/env node
'use strict';
// AUTO∞の個体別「自動限界突破」は、今回は設定の保存までに限定する。
// 旧保存の正規化、個体ごとの独立性、所有個体だけのUI、実処理との未接続を固定する。
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
let failed = false;
const check = (name, ok) => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
  failed ||= !ok;
};
const slice = (from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  if (start < 0 || end <= start) throw new Error(`本体から切り出せません: ${from}`);
  return source.slice(start, end);
};

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${slice('const buildAutoRepeatBreakthroughUpdate =', '// 固有技ポイントの仮配分')}globalThis.update = buildAutoRepeatBreakthroughUpdate;`, sandbox);
const update = sandbox.update;

// 読み込み時の正規化は true だけをONとし、旧個体・欠損・不正型をOFFにする。
const normalizer = slice('const normalizeMasuProgression =', '// 固有技ポイントの仮配分');
check('旧個体・欠損・不正値はfalseへ正規化', normalizer.includes('autoRepeatBreakthrough: masu?.autoRepeatBreakthrough === true'));

const originalA = { id:'a', bondXp:123, statPoints:{ hp:4 } };
const originalB = { id:'b', bondXp:456, autoRepeatBreakthrough:false };
let saved = [update(originalA, true), originalB];
check('個体AをON、個体BをOFFで別々に保持', saved[0].autoRepeatBreakthrough === true && saved[1].autoRepeatBreakthrough === false);
check('設定変更で他の育成データを変更しない', saved[0].bondXp === 123 && saved[0].statPoints === originalA.statPoints);
saved = JSON.parse(JSON.stringify(saved));
check('再読み込み相当の直列化後もONを保持', saved[0].autoRepeatBreakthrough === true);
saved[0] = update(saved[0], false);
check('ONからOFFへの変更も保存できる', saved[0].autoRepeatBreakthrough === false);
check('更新関数へ不正値を渡してもOFF', update(originalA, 'true').autoRepeatBreakthrough === false);

const saver = slice('const setMasuAutoRepeatBreakthrough =', 'const useUniqueSkillResetTicket');
check('既存のmh_masu_monsだけへ保存', saver.includes("storeSet('mh_masu_mons', next, false)") && !(saver.match(/mh_[a-z0-9_]+/g) || []).some(key => key !== 'mh_masu_mons'));
check('対象IDの個体だけを更新', saver.includes('String(m.id) === String(masuId) ? updated : m'));

const ownedDetail = slice('{masuMonDetail&&!MASU_ENHANCE_STATES.includes(gameState)&&', '{/* 固有技設定:');
const commonDetail = slice('const renderMonsterDetailModal = ({', 'const pct =');
check('所有マスモン詳細に設定UIと説明を表示', ownedDetail.includes('data-auto-repeat-breakthrough-setting') && ownedDetail.includes('AUTO∞ 自動限界突破') && ownedDetail.includes('∞周回中、Lv上限到達時に素材があれば自動で限界突破します（現在Lv100まで）'));
check('ON/OFFは48px以上のswitch操作', ownedDetail.includes('role="switch"') && ownedDetail.includes('min-h-[48px]') && ownedDetail.includes("?'ON':'OFF'"));
check('readOnlyでも使う共通詳細には操作UIを混ぜない', !commonDetail.includes('data-auto-repeat-breakthrough-setting') && !commonDetail.includes('setMasuAutoRepeatBreakthrough'));

const autoRepeatRuntime = slice('// AUTO∞から新しいrunId', '// 正規リザルトの全報酬演出');
check('AUTO∞や限界突破の実処理には未接続', !autoRepeatRuntime.includes('autoRepeatBreakthrough') && !autoRepeatRuntime.includes('setMasuAutoRepeatBreakthrough'));
check('設定項目を参照するのは正規化・保存・所有詳細だけ', (source.match(/autoRepeatBreakthrough/g) || []).length === 7);

console.log(failed ? '\nNGがあります' : '\nすべてOK');
process.exit(failed ? 1 : 0);
