#!/usr/bin/env node
// タクティクスのヘイト(確認待ちの試作・2026-10-17 社長「試作する」)の作りを見る。
//
//   node tools/battle/tactics-hate-check.js
//
//   ① 全モンスターが MONSTER_TYPE_OF(タイプの表)にあり、メイン・サブが MONSTER_TYPES にある(足し忘れると止める)。
//     ヘイトの倍率はタイプの表から引く(TACTICS_HATE に役割の表を二重に持たない)
//   ② 切のとき(hate を渡さない)は、狙いの重みが今までの式とまったく同じ
//   ③ 1ターンの動き: 毎ターン ×decay・上限・倒れたら0・空き枠は0・勇者は下地より下がらない・与ダメージは割合で配る
//   ④ 枠の狙われる確率(%): 敵が狙いを決める重みと同じ割合・生きている子だけで割る・合計100・1人なら100%
//   ⑤ 名前の出た子の値(資料の★おすすめ): あつの挑発・みゅあの愛・ももすけのおねだり・モノリスのかばう
//   ⑥ 確認待ちの試作の一覧にあり、既定は切(キーが無ければ効かない)。タクティクスの盤面のバトル全部(タクティクスバトル・レイド。既存5モードは見ない)
//   ⑦ タイプの表記: 確認待ちの試作の一覧にあり、既定は切。図鑑・図鑑の詳細・パーティ選びに印がある
//   ⑧ 行動カードの🔥の段
//   ⑨ 狙われる確率の強さ: WAVE の始めにタンクがガードで約65%・上限で約90%・勇者の下地だけは前と同じ
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
// サブはメインと同じタイプでもよい(2026-10-22 社長。ゴーレム アタッカー/アタッカー・モノリス タンク/タンク)
const missing = mons.filter((m) => !TO[m.id] || !T[TO[m.id].main] || (TO[m.id].sub != null && !T[TO[m.id].sub])).map((m) => m.id);
check('① 全モンスターがタイプの表にあり、メイン・サブが MONSTER_TYPES にある', missing.length === 0 && mons.length > 0, missing.length ? `足りない・違う: ${missing.join(', ')}(MONSTER_TYPE_OF に1行足す)` : `${mons.length}体`);
const noSub = mons.filter((m) => !TO[m.id] || !T[TO[m.id].sub]).map((m) => m.name || m.id);
check('① 全員にサブがある(2026-10-22 社長「サブないやつはぜんぶなにかつけたい」)', noSub.length === 0, noSub.join('・'));
check('① メインと同じサブも、そのまま持てる(消さない)', G.monsterTypeOf('Monol').sub === 'tank' && G.monsterTypeOf('Golem').sub === 'attacker');
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
check('② 入のときは ×(weightCurve の倍率)・ヘイト0の子は今までどおり', near(hw[0].weight, old[0].weight * G.tacticsHateWeightMult([50], 0)) && near(hw[1].weight, old[1].weight));

// ③
const ids = units.map((u) => u.id);
const s0 = G.tacticsHateStep([40, 40, 40, 40], {}, units, ids);
check('③ 何もしなければ ×decay・倒れた子は0', near(s0[0], 40 * H.decay) && near(s0[1], 40 * H.decay) && s0[3] === 0);
const capped = G.tacticsHateStep([0, 90, 0, 0], { gains: [0, 300, 0, 0] }, units, ids);
check('③ 上限で止まる', capped[1] === H.cap);
const emptyUnits = [units[0], null, units[2], null];
check('③ 空き枠は0', G.tacticsHateStep([10, 10, 10, 10], { gains: [5, 5, 5, 5] }, emptyUnits, ids)[1] === 0);
// WAVE の始めはタイプ(メイン + サブ)で決まる。勇者モンかどうかは見ない・下限も無い(2026-10-22 社長)
const st0 = G.tacticsHateWaveStart(['Monol', 'Golem', 'Ghost', 'Pandora']);
check('③ WAVE の始めはタイプで決まる(モノリス 30・ゴーレム 15・ゴースト 5・パンドラ 5)', JSON.stringify(st0) === JSON.stringify([30, 15, 5, 5]), JSON.stringify(st0));
check('③ ユグドラシル 25・メロディー 20・スネグーラチカ 10・空き枠は0', JSON.stringify(G.tacticsHateWaveStart(['Yggdrasil', 'Melody', 'Snegurochka', null])) === JSON.stringify([25, 20, 10, 0]));
check('③ 0 未満にはしない(シャドウ0 + サブのシャドウ −5 なら0)', (() => { const keep = TO.Tiger; TO.Tiger = { main: 'shadow', sub: 'shadow' }; const v = G.tacticsHateStartOf('Tiger'); TO.Tiger = keep; return v === 0; })());
check('③ 勇者の下限は無い(何もしなければ下がる)', !('hero' in H) && G.tacticsHateStep([20, 0, 0, 0], {}, units, ids)[0] === 20 * H.decay);
check('③ 初期ヘイトの数字は社長が決めた表のまま', JSON.stringify(H.start) === JSON.stringify({ main: { tank: 20, healer: 10, attacker: 10, supporter: 5, shadow: 0 }, sub: { tank: 10, healer: 5, attacker: 5, supporter: 3, shadow: -5 } }));
const share = G.tacticsHateStep([0, 0, 0, 0], { dealt: [300, 100, 0, 0] }, units, ids);
const monolMult = G.tacticsHateProfile('Monol').mult;
check('③ 与ダメージは味方の中の割合 × dmgShare(敵のライフに左右されない)', near(share[0], H.action.dmgShare * 0.75) && near(share[1], monolMult * H.action.dmgShare * 0.25));
const big = G.tacticsHateStep([0, 0, 0, 0], { dealt: [300000, 100000, 0, 0] }, units, ids);
check('③ A:10,000 と B:100,000 のように桁が違っても、割合が同じなら同じヘイト', near(big[0], share[0]) && near(big[1], share[1]));

// ④
// 枠には炎の段ではなく「狙われる確率(%)」を出す(2026-10-22 社長「ヘイトは炎じゃなくて数値化したほうがいいかもね。ひとりなら常に100%で…」)
{
  const full = (id, hp = 500, downed = false) => ({ id, name: id, hp: downed ? 0 : hp, maxHp: 500, guts: 10, maxGuts: 10, atk: 100, def: 100, downed });
  const ch = (us, hate) => G.tacticsTargetChances(us, hate);
  const sum = (a) => a.filter(Number.isInteger).reduce((x, y) => x + y, 0);
  check('④ 1人なら100%・空き枠は出さない', JSON.stringify(ch([full('Mocchi'), null, null, null], [50, 0, 0, 0])) === JSON.stringify([100, null, null, null]));
  check('④ 倒れた子は出さず、生きている子だけで割る', JSON.stringify(ch([full('Mocchi'), full('Ham', 0, true), full('Ghost'), null], [0, 90, 0, 0])) === JSON.stringify([50, null, 50, null]));
  const mixes = [[[20, 40, 0, 0], [500, 500, 500, 500]], [[30, 20, 5, 5], [500, 250, 100, 500]], [[0, 0, 0, 0], [500, 500, 500, 500]], [[33, 33, 33, 0], [500, 500, 500, 500]], [[100, 7, 3, 61], [480, 12, 300, 77]]];
  const allSum100 = mixes.every(([hate, hps]) => sum(ch(['Mocchi', 'Ham', 'Ghost', 'Pixie'].map((id, k) => full(id, hps[k])), hate)) === 100);
  check('④ 2〜4人でも、合計はちょうど100%', allSum100 && sum(ch([full('Mocchi'), full('Ham'), full('Ghost'), null], [0, 0, 0, 0])) === 100);
  // 敵が実際に狙いを決める重み(tacticsTargetWeights)と同じ割合(四捨五入の差は1まで)
  const us = ['Mocchi', 'Ham', 'Ghost', 'Pixie'].map((id, k) => full(id, [500, 250, 100, 500][k])), hate = [30, 20, 5, 5];
  const w = G.tacticsTargetWeights(us, G.TACTICS_TARGET_LOW_HP_BIAS, hate), tot = w.reduce((a, x) => a + x.weight, 0), c = ch(us, hate);
  check('④ 敵が狙いを決める重みと同じ割合(表示と抽選が食い違わない)', w.every((x) => Math.abs(c[x.index] - x.weight / tot * 100) < 1), JSON.stringify(c));
  const battleSrc = read('monster-hero/src/parts/71-screen-battle.jsx');
  check('④ 枠の表示は tacticsTargetChances を通す(炎の段は出さない)', /tacticsTargetChances\(tacticsUnits,tacticsHate\)\[i\]/.test(battleSrc) && /data-tactics-hate-pct=\{hatePct\}/.test(battleSrc)  && !/tacticsHateFlame/.test(battleSrc) && !('flames' in H));
}

// ⑤
const gain = (card, id) => G.tacticsHateCardGain(card, id) * G.tacticsHateProfile(id).mult;
check('⑤ あつの挑発 +40(攻撃の子)', near(gain({ id: 'atsu', type: 'debuff', subType: 'stun_atsu' }, 'Mocchi'), 40));
check('⑤ みゅあの愛 +15 / +31.5 / +40.5', [0, 1, 2].map((lv) => gain({ id: 'mua', type: 'heal', evoLevel: lv }, 'Mocchi')).every((v, k) => near(v, [15, 31.5, 40.5][k])));
check('⑤ ももすけのおねだり +7.5 / +31.5 / +40.5', [0, 1, 2].map((lv) => gain({ id: 'momosuke', type: 'heal', evoLevel: lv }, 'Mocchi')).every((v, k) => near(v, [7.5, 31.5, 40.5][k])));
// 2026-10-22 社長「ガードは狙われたら使うからそこまでむしろ上げないほうがよさそう。ヘイトはアシカとかexでためる」
check('⑤ ガード +5(タンクは +2 上乗せ)・攻撃や強化と同じくらい', near(G.tacticsHateCardGain({ type: 'guard' }, 'Mocchi'), 5) && near(G.tacticsHateCardGain({ type: 'guard' }, 'Yggdrasil'), 7));
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
check('⑥ タクティクスの盤面のバトル全部(レイドバトル・グランドスラムも。既存5モードは見ない)', /const tacticsHateOnFor = \(mode\) => isTacticsMode\(mode\) && tacticsHateProtoOn\(\);/.test(app) && /const isTacticsMode = \(mode\) => TACTICS_BATTLE_MODES\.includes\(mode\) \|\| isRaidJackMode\(mode\);/.test(read('monster-hero/src/parts/10-core.jsx')));
check('⑥ WAVE の始めは、盤面の子の id でタイプから決める(勇者モンかどうかは見ない)', /tacticsHateWaveStart\(tacticsUnitsRef\.current\.map\(u => u && u\.id\)\)/.test(app) && !/tacticsHateHeroSlot|tacticsHateHeroIdRef/.test(app));
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
check('⑧ 通常攻撃は小・ガードも小(2026-10-22)・挑発は大', lv({ type: 'atk' }, 'Mocchi') === 1 && lv({ type: 'guard' }, 'Mocchi') === 1 && lv({ type: 'guard' }, 'Yggdrasil') === 1 && lv({ id: 'atsu', type: 'taunt' }, 'Mocchi') === 3);
check('⑧ 子のタイプ・特性で変わる(タンクのガードは多め・モノリスの攻撃)', G.tacticsHateCardEstimate({ type: 'guard' }, 'Yggdrasil') > G.tacticsHateCardEstimate({ type: 'guard' }, 'Mocchi') && lv({ type: 'atk' }, 'Monol') === 2);
check('⑧ EX のかばうは大', G.tacticsHateExLevel('coverAll', 'Monol') === 3);
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
check('⑧ 手札と EX の詳細に段を出す(ヘイトが切なら出さない)', /tacticsHateOn&&\(\(\)=>\{const lv=tacticsHateCardLevel\(/.test(battle) && /tacticsHateOn&&\(\(\)=>\{const lv=tacticsHateExLevel\(/.test(battle));

// ⑨ 狙われる確率の強さ(2026-10-22 社長「最大40%じゃヘイト調整してもなかなかこない」で選んだ強さ)
//   4体ともライフ満タンで、1体がヘイト40・1体が20・2体が0 → ヘイト40の子が約65%・ヘイト上限100で約90%。
//   社長「ガードは…そこまで上げない」「ヘイトはアシカとかexでためる」ので、ガードではなくヘイトの値で見る
{
  const W = H.weightCurve;
  check('⑨ 倍率の点が TACTICS_HATE.weightCurve にあり、0 で ×1・上限まで増える一方', Array.isArray(W) && W[0][0] === 0 && W[0][1] === 1 && W[W.length - 1][0] === H.cap
    && W.every((pt, i) => i === 0 || (pt[0] > W[i - 1][0] && pt[1] > W[i - 1][1])) && !('k' in H));
  // 倍率の計算は tacticsHateWeightMult だけ。ヘルプの表(tacticsHateHelpRows)は点を表示に読むだけで、確率は tacticsHateWeightMult で出す
  const unitsSrc = read('monster-hero/src/parts/32-tactics-units.jsx');
  const helpFn = unitsSrc.slice(unitsSrc.indexOf('const tacticsHateHelpRows'), unitsSrc.indexOf('// ===== ヘイトの数字ここまで'));
  check('⑨ 倍率の式は tacticsHateWeightMult の1か所だけ(ヘルプの表は点を表示するだけ)', (unitsSrc.match(/TACTICS_HATE\.weightCurve/g) || []).length === 2
    && (helpFn.match(/TACTICS_HATE\.weightCurve/g) || []).length === 1 && /tacticsHateWeightMult\(hate, i\)/.test(helpFn));
  const full = (id) => ({ id, name: id, hp: 500, maxHp: 500, guts: 10, maxGuts: 10, atk: 100, def: 100 });
  const ids4 = ['Mocchi', 'Yggdrasil', 'Ghost', 'Ham'], us = ids4.map(full);
  const prob = (hate, i) => { const w = G.tacticsTargetWeights(us, G.TACTICS_TARGET_LOW_HP_BIAS, hate); return w.find((x) => x.index === i).weight / w.reduce((a, x) => a + x.weight, 0); };
  const p40 = prob([20, 40, 0, 0], 1), pc = prob([20, H.cap, 0, 0], 1);
  check('⑨ ヘイト40の子は約65%(ほかは20・0・0)', p40 > 0.62 && p40 < 0.68, `${(p40 * 100).toFixed(1)}%`);
  check('⑨ ヘイト上限100の子は約90%', pc > 0.87 && pc < 0.93, `${(pc * 100).toFixed(1)}%`);
  check('⑨ ヘイト20 は ×1.8', near(G.tacticsHateWeightMult([20], 0), 1.8));
  check('⑨ 4体とも同じヘイト0なら、ライフの減り具合だけで決まる(等分)', [0, 1, 2, 3].every((i) => near(prob([0, 0, 0, 0], i), 0.25)));
  // WAVE の始め(だれも動いていない)に、1体へ偏りすぎない: 26体から4体のどの組でも、いちばん狙われる子は 60% 未満
  const all = mons.map((m) => m.id);
  let worst = { p: 0, team: null };
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) for (let c = b + 1; c < all.length; c++) for (let d = c + 1; d < all.length; d++) {
    const team = [all[a], all[b], all[c], all[d]], h = G.tacticsHateWaveStart(team);
    const w = team.map((_, i) => G.tacticsHateWeightMult(h, i)), sum = w.reduce((x, y) => x + y, 0);
    const p = Math.max(...w) / sum;
    if (p > worst.p) worst = { p, team };
  }
  // ヘルプ「狙われやすさ(🔥)の数字」の目安(tacticsHateHelpRows)は、ライフ満タンの4体を狙いの関数(tacticsTargetWeights)で計算した値と同じ
  const odds = G.tacticsHateHelpRows('tacticsHateOdds').filter((r) => /^1体が🔥/.test(r[0]));
  const oddsOk = odds.length === 6 && odds.every((r) => {
    const h = Number(/🔥(\d+)/.exec(r[0])[1]), m = /その子 (\d+)% ／ ほか (\d+)%/.exec(r[1]);
    return m && +m[1] === Math.round(prob([h, 0, 0, 0], 0) * 100) && +m[2] === Math.round(prob([h, 0, 0, 0], 1) * 100);
  });
  check('⑨ ヘルプの目安の表は、ゲームの狙いの関数と同じ値(🔥90 なら その子91%・ほか3%)', oddsOk && odds.some((r) => r[0] === '1体が🔥90・ほか0' && r[1] === 'その子 91% ／ ほか 3%ずつ'), odds.map((r) => r.join(' ')).join(' / '));
  check('⑨ ヘルプの表は3つとも行がある(数字は TACTICS_HATE から作る)', ['tacticsHateGains', 'tacticsHateTypes', 'tacticsHateOdds'].every((id) => G.tacticsHateHelpRows(id).length > 0));
  check('⑨ WAVE の始めは、どの4体でもいちばん狙われる子が 60% 未満', worst.p < 0.6, `いちばん偏る組 ${worst.team.join('・')} → ${(worst.p * 100).toFixed(1)}%`);
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
