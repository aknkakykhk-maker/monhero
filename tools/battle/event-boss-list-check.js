#!/usr/bin/env node
// 期間イベントのボスの一覧(EVENT_BOSS_IDS)の足し忘れを止める(2026-11-07 社長「ジャック特攻 → イベボス特攻」)。
// 固有技のオリジナル強化「イベボス特攻」はこの一覧(とレイドの戦い)で相手を見分けるので、
// 新しいイベントのボスを足して一覧に入れ忘れると、そのボスにだけ特攻が効かなくなる。
//   ① ボスの置き方(MOO_BOSS_IDS)に入っている敵は、ムー・覚醒ムーか、イベントのボスの一覧のどちらか
//   ② 敵のデータにあるのに、通常のラン(ENEMY_SEQUENCE)にもタクティクス(TACTICS_ENEMY_SEQUENCE)にも出てこない敵
//      (=イベントでしか戦わない敵)は、イベントのボスの一覧に入っている
//   ③ 一覧の敵はすべて敵のデータにある(消した敵が残っていない)
//   ④ 今のイベントのボス(ジャック)が入っている
// 使い方: node tools/battle/event-boss-list-check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const part = fs.readFileSync(path.join(root, 'monster-hero/src/parts/22-enemy-and-bond-entries.jsx'), 'utf8');
const line = (re) => { const m = part.match(re); return m ? m[0] : null; };
const mooLine = line(/const MOO_BOSS_IDS = \[[^\]]*\];/);
const eventLine = line(/const EVENT_BOSS_IDS = Object\.freeze\(\[[^\]]*\]\);/);
check('MOO_BOSS_IDS と EVENT_BOSS_IDS を取り出せる', !!mooLine && !!eventLine);
if (!mooLine || !eventLine) process.exit(1);
const ctx = {};
vm.createContext(ctx);
// 敵のデータは画像の変数を使うので、名前だけの空の値で読む
const enemySrc = fs.readFileSync(path.join(root, 'monster-hero/data/enemy-monsters.js'), 'utf8');
const imgNames = [...new Set(enemySrc.match(/\b[A-Z][A-Z0-9_]*_IMG(?:_DATA)?\b/g) || [])];
vm.runInContext(`${imgNames.map(n => `var ${n} = '';`).join('\n')}\n${enemySrc}\n${mooLine}\n${eventLine}\n`
  + 'this.E = { ENEMY_DATA, ENEMY_SEQUENCE, TACTICS_ENEMY_DATA, TACTICS_ENEMY_SEQUENCE, MOO_BOSS_IDS, EVENT_BOSS_IDS };', ctx);
const E = ctx.E;
const allEnemyIds = [...Object.keys(E.ENEMY_DATA), ...Object.keys(E.TACTICS_ENEMY_DATA)];
const MOO = ['Moo', 'AwakenedMoo'];
const strayBoss = E.MOO_BOSS_IDS.filter(id => !MOO.includes(id) && !E.EVENT_BOSS_IDS.includes(id));
check('① ボスの置き方の敵は、ムー・覚醒ムーかイベントのボスの一覧に入っている', strayBoss.length === 0, strayBoss.length ? `一覧に無い: ${strayBoss.join(', ')}(EVENT_BOSS_IDS に足す)` : '');
const regular = new Set([...E.ENEMY_SEQUENCE, ...E.TACTICS_ENEMY_SEQUENCE]);
const eventOnly = allEnemyIds.filter(id => !regular.has(id));
const missing = eventOnly.filter(id => !E.EVENT_BOSS_IDS.includes(id));
check('② イベントでしか戦わない敵は、イベントのボスの一覧に入っている', missing.length === 0,
  missing.length ? `一覧に無い: ${missing.join(', ')}(イベントのボスなら EVENT_BOSS_IDS に足す。ボスでない敵なら、この検査に理由を書いて外す)` : `イベントだけの敵: ${eventOnly.join(', ') || 'なし'}`);
const gone = E.EVENT_BOSS_IDS.filter(id => !allEnemyIds.includes(id));
check('③ 一覧の敵はすべて敵のデータにある', gone.length === 0, gone.join(', '));
check('④ ジャックが入っている', E.EVENT_BOSS_IDS.includes('Jack'));
const game = fs.readFileSync(path.join(root, 'monster-hero/src/parts/11-masu-progression.jsx'), 'utf8');
check('イベボス特攻はこの一覧で見分ける', /EVENT_BOSS_IDS\.includes\(String\(enemyId/.test(game));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
