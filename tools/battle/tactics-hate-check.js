#!/usr/bin/env node
// タクティクスのヘイト(確認待ちの試作・2026-10-17 社長「試作する」)の作りを見る。
//
//   node tools/battle/tactics-hate-check.js
//
//   ① 全モンスターが MONSTER_TYPE_OF(タイプの表)にあり、メイン・サブが MONSTER_TYPES にある(足し忘れると止める)。
//     ヘイトの倍率はタイプの表から引く(TACTICS_HATE に役割の表を二重に持たない)
//   ② 切のとき(hate を渡さない)は、狙いの重みが今までの式とまったく同じ
//   ③ 1ターンの動き: 毎ターン ×decay・上限・倒れたら0・空き枠は0・勇者は下地より下がらない・与ダメージは割合で配る
//   ④ 炎の段は 20・50・80。勇者は下地を引いた値で見る
//   ⑤ 名前の出た子の値(資料の★おすすめ): あつの挑発・みゅあの愛・ももすけのおねだり・モノリスのかばう
//   ⑥ 確認待ちの試作の一覧にあり、既定は切(キーが無ければ効かない)。タクティクスバトルだけ(レイド・既存5モードは見ない)
//   ⑦ タイプの表記: 確認待ちの試作の一覧にあり、既定は切。図鑑・図鑑の詳細・パーティ選びに印がある
const fs = require('fs');
const path = require('path');
const { loadGame } = require('../playbot/sim/load-game');
const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const G = loadGame();
const H = G.TACTICS_HATE;
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ①
const mons = Object.values(G.ALL_PLAYER_MONSTERS).filter((m) => m && !m.debugOnly);
const T = G.MONSTER_TYPES, TO = G.MONSTER_TYPE_OF;
const missing = mons.filter((m) => !TO[m.id] || !T[TO[m.id].main] || (TO[m.id].sub != null && (!T[TO[m.id].sub] || TO[m.id].sub === TO[m.id].main))).map((m) => m.id);
check('① 全モンスターがタイプの表にあり、メイン・サブが MONSTER_TYPES にある', missing.length === 0 && mons.length > 0, missing.length ? `足りない・違う: ${missing.join(', ')}(MONSTER_TYPE_OF に1行足す)` : `${mons.length}体`);
check('① タイプの倍率は数で、0より大きい・名前とアイコンがある', Object.values(T).every((r) => Number.isFinite(r.hateMult) && r.hateMult > 0 && r.label && r.icon));
check('① ヘイトに役割の表を二重に持たない', !('roles' in H) && Object.values(H.monsters).every((m) => !('role' in m)));
check('① ヘイトの倍率はタイプの表から引く', mons.every((m) => H.monsters[m.id]?.mult != null || G.tacticsHateProfile(m.id).mult === T[TO[m.id].main].hateMult));

// ②
const unit = (id, hp, maxHp, downed = false) => ({ id, name: id, hp, maxHp, guts: 10, maxGuts: 10, atk: 100, def: 100, downed });
const units = [unit('Mocchi', 700, 720), unit('Monol', 350, 700), unit('Ghost', 100, 450), unit('Ham', 0, 350, true)];
const old = units.map((u, i) => (u.downed ? null : { index: i, weight: 1 + 2 * (1 - u.hp / u.maxHp) })).filter(Boolean);
const nowW = G.tacticsTargetWeights(units);
check('② 切のときは重みが今までの式と同じ', nowW.length === old.length && nowW.every((w, k) => w.index === old[k].index && near(w.weight, old[k].weight)));
const seq = [0.1, 0.5, 0.9, 0.33];
const pick = (hate) => seq.map((r) => G.withTacticsTarget({ type: 'ATTACK', value: 10 }, units, () => r, G.TACTICS_TARGET_LOW_HP_BIAS, hate).targetSlot);
check('② 切のときの抽選は今までと同じ(引数なし = null)', JSON.stringify(pick(undefined)) === JSON.stringify(pick(null)));
const hw = G.tacticsTargetWeights(units, G.TACTICS_TARGET_LOW_HP_BIAS, [50, 0, 0, 0]);
check('② 入のときは ×(1 + ヘイト ÷ k)', near(hw[0].weight, old[0].weight * (1 + 50 / H.k)) && near(hw[1].weight, old[1].weight));

// ③
const ids = units.map((u) => u.id);
const s0 = G.tacticsHateStep([40, 40, 40, 40], {}, units, -1, ids);
check('③ 何もしなければ ×decay・倒れた子は0', near(s0[0], 40 * H.decay) && near(s0[1], 40 * H.decay) && s0[3] === 0);
const capped = G.tacticsHateStep([0, 90, 0, 0], { gains: [0, 300, 0, 0] }, units, -1, ids);
check('③ 上限で止まる', capped[1] === H.cap);
const emptyUnits = [units[0], null, units[2], null];
check('③ 空き枠は0', G.tacticsHateStep([10, 10, 10, 10], { gains: [5, 5, 5, 5] }, emptyUnits, -1, ids)[1] === 0);
const hero = G.tacticsHateStep([0, 0, 0, 0], {}, units, 0, ids);
check('③ 勇者は下地より下がらない', hero[0] === H.hero.floor && hero[1] === 0);
check('③ WAVE の始めは0・勇者だけ下地', JSON.stringify(G.tacticsHateWaveStart(2)) === JSON.stringify([0, 0, H.hero.floor, 0]));
const share = G.tacticsHateStep([0, 0, 0, 0], { dealt: [300, 100, 0, 0] }, units, -1, ids);
const monolMult = G.tacticsHateProfile('Monol').mult;
check('③ 与ダメージは味方の中の割合 × dmgShare(敵のライフに左右されない)', near(share[0], H.action.dmgShare * 0.75) && near(share[1], monolMult * H.action.dmgShare * 0.25));
const big = G.tacticsHateStep([0, 0, 0, 0], { dealt: [300000, 100000, 0, 0] }, units, -1, ids);
check('③ A:10,000 と B:100,000 のように桁が違っても、割合が同じなら同じヘイト', near(big[0], share[0]) && near(big[1], share[1]));

// ④
const f = (v, hero = false) => G.tacticsHateFlame(v, hero);
check('④ 炎は 20・50・80 で1段ずつ', [f(19), f(20), f(49), f(50), f(79), f(80), f(100)].join() === '0,1,1,2,2,3,3');
check('④ 勇者は下地を引いた値で見る', f(H.hero.floor, true) === 0 && f(H.hero.floor + 20, true) === 1);

// ⑤
const gain = (card, id) => G.tacticsHateCardGain(card, id) * G.tacticsHateProfile(id).mult;
check('⑤ あつの挑発 +40(攻撃の子)', near(gain({ id: 'atsu', type: 'debuff', subType: 'stun_atsu' }, 'Mocchi'), 40));
check('⑤ みゅあの愛 +15 / +31.5 / +40.5', [0, 1, 2].map((lv) => gain({ id: 'mua', type: 'heal', evoLevel: lv }, 'Mocchi')).every((v, k) => near(v, [15, 31.5, 40.5][k])));
check('⑤ ももすけのおねだり +7.5 / +31.5 / +40.5', [0, 1, 2].map((lv) => gain({ id: 'momosuke', type: 'heal', evoLevel: lv }, 'Mocchi')).every((v, k) => near(v, [7.5, 31.5, 40.5][k])));
check('⑤ ガード +25(盾は +6 上乗せ)', near(G.tacticsHateCardGain({ type: 'guard' }, 'Mocchi'), 25) && near(G.tacticsHateCardGain({ type: 'guard' }, 'Yggdrasil'), 31));
const cover = G.tacticsHateExGain('coverAll', 'Monol') * monolMult;
check('⑤ モノリスのかばう (60 + 行動のたび3) × 1.5', near(cover, (60 + 3) * 1.5) && monolMult === 1.5 && G.tacticsHateProfile('Monol').always === 3);

// ⑥
const trials = read('monster-hero/src/parts/81-debug-trials.jsx');
// 2026-10-18 公開(社長「ヘイトシステムは実装していいよ」)。入/切は公開の印 RELEASE_FLAGS.tacticsHate だけで決まる
const vm = require('vm');
const protoSrc = trials.split('\n').filter((l) => /^const (tacticsHateProtoOn|monsterTypeProtoOn) = /.test(l)).join('\n').replace(/^const /gm, 'var ');
const runProto = (flags) => { const P = { RELEASE_FLAGS: flags, localStorage: { getItem: () => null } }; vm.createContext(P); vm.runInContext(protoSrc, P); return P; };
const P = runProto({ tacticsHate: true }), Poff = runProto({ tacticsHate: false });
Object.assign(G, { tacticsHateProtoOn: P.tacticsHateProtoOn, monsterTypeProtoOn: P.monsterTypeProtoOn });
const release = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
check('⑥ 入/切を読む関数が試作の一覧の部品にある', typeof P.tacticsHateProtoOn === 'function' && typeof P.monsterTypeProtoOn === 'function');
check('⑥ 公開の印が立っている', /^\s*tacticsHate: true,/m.test(release));
check('⑥ 公開の印が真なら入・偽なら切(試作のキーは読まない)', P.tacticsHateProtoOn() === true && Poff.tacticsHateProtoOn() === false && !/localStorage/.test(protoSrc));
check('⑥ 確認待ちの試作の一覧から外した', !trials.includes("key: 'mh_tactics_hate_proto_v1'") && !trials.includes("key: 'mh_monster_type_proto_v1'"));
const app = read('monster-hero/src/parts/60-app.jsx');
check('⑥ タクティクスバトルだけ(レイドバトルは見ない)', /const tacticsHateOnFor = \(mode\) => TACTICS_BATTLE_MODES\.includes\(mode\) && !isRaidJackMode\(mode\) && tacticsHateProtoOn\(\);/.test(app));
check('⑥ 保存データの一覧に試作のキーが残っている(消さない)', read('docs/spec/SAVE_DATA.md').includes('mh_tactics_hate_proto_v1'));

// ⑦
check('⑦ タイプの表記も同じ印', P.monsterTypeProtoOn() === true && Poff.monsterTypeProtoOn() === false);
check('⑦ 保存データの一覧にタイプのキーが残っている(消さない)', read('docs/spec/SAVE_DATA.md').includes('mh_monster_type_proto_v1'));
const dex = read('monster-hero/src/parts/57-screen-monster-dex.jsx'), pickSrc = read('monster-hero/src/parts/67-screen-pick.jsx');
check('⑦ 図鑑・図鑑の詳細・パーティ選びに印がある', (dex.match(/<MonsterTypeBadge /g) || []).length >= 2 && /<MonsterTypeBadge /.test(pickSrc));

// ⑧ 行動カードの🔥(使うと上がる量の段。基準は TACTICS_HATE.cardFlames の1か所)
check('⑧ カードの段の基準が TACTICS_HATE にある', Array.isArray(H.cardFlames) && H.cardFlames.length === 2 && H.cardFlames[0] < H.cardFlames[1] && Number.isFinite(H.cardDmgShareGuess));
check('⑧ 段は 0〜3(小・中・大)', G.tacticsHateGainLevel(0) === 0 && G.tacticsHateGainLevel(1) === 1 && G.tacticsHateGainLevel(H.cardFlames[0]) === 2 && G.tacticsHateGainLevel(H.cardFlames[1]) === 3 && G.TACTICS_HATE_LEVEL_LABELS.join() === ',小,中,大');
const lv = (card, id) => G.tacticsHateCardLevel(card, id);
check('⑧ 通常攻撃は小・ガードは中・挑発は大', lv({ type: 'atk' }, 'Mocchi') === 1 && lv({ type: 'guard' }, 'Mocchi') === 2 && lv({ id: 'atsu', type: 'taunt' }, 'Mocchi') === 3);
check('⑧ 子のタイプ・特性で変わる(盾のガード・モノリスの攻撃)', lv({ type: 'guard' }, 'Yggdrasil') === 3 && lv({ type: 'atk' }, 'Monol') === 2);
check('⑧ EX のかばうは大', G.tacticsHateExLevel('coverAll', 'Monol') === 3);
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
check('⑧ 手札と EX の詳細に段を出す(ヘイトが切なら出さない)', /tacticsHateOn&&\(\(\)=>\{const lv=tacticsHateCardLevel\(/.test(battle) && /tacticsHateOn&&\(\(\)=>\{const lv=tacticsHateExLevel\(/.test(battle));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
