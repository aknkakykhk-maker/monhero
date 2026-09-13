#!/usr/bin/env node
'use strict';
//
// オート強化(個体ごとの自動強化設定)の検査。
//
// 見るところ:
//   ・目標のステータス値どおりに止まるか(振りすぎない・こえない)
//   ・強化Pで持っていたころ(版1)の保存が、目標の合計値へ正しく読み替わるか
//   ・優先順位のとおり、上から順に埋まるか
//   ・間合い適性の目標グレードで止まるか(上限Mも超えない)
//   ・OFFのときは1Pも動かさないか
//   ・設定を持っていない既存データがOFFとして読めるか(勝手に振られない)
//   ・転生しても設定だけは残るか(この機能の目的そのもの)
//   ・振り終わったあとにもう一度通しても何も起きないか(繰り返しにならない)
//   ・画面(72-screen-masu-auto-enhance.jsx)から本当に呼ばれているか
//
'use strict';
const assert = require('assert');
const fs = require('fs');
const m = require('../harness').loadDyeModule();

const GRADES = ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'];
// ベース適性が C/C/C/C のモンスターを使う(目標グレードの計算を読みやすくするため)
const BASE_ID = 'Mocchi';
const base = (() => {
  const found = m.ALL_PLAYER_MONSTERS ? m.ALL_PLAYER_MONSTERS[BASE_ID] : null;
  return found;
})();

const makeMasu = (autoEnhance, extra = {}) => m.normalizeMasuProgression({
  id:'m1', baseId:BASE_ID, name:'テスト', bondXp:0, levelCap:30,
  distAptPoints:10, statPoints:{ hp:0, atk:0, def:0, guts:0 }, distAptBoosts:[0,0,0,0],
  uniqueSkillLevels:{}, uniqueSkillPoints:0,
  autoEnhance, ...extra,
});

// ---- 1. OFF のときは何もしない ----
{
  const masu = makeMasu({ enabled:false, statTargets:{ hp:null, atk:null, def:null, guts:null } });
  assert.strictEqual(m.applyMasuAutoEnhance(masu), null, 'OFFなら1Pも動かさない');
}

// ---- 2. 設定を持っていない既存データは OFF として読む ----
{
  const legacy = m.normalizeMasuProgression({ id:'old', baseId:BASE_ID, name:'旧', bondXp:0, distAptPoints:99, statPoints:{} });
  assert.strictEqual(legacy.autoEnhance.enabled, false, '項目の無い既存データはOFF');
  assert.strictEqual(m.applyMasuAutoEnhance(legacy), null, '既存データが勝手に振られない');
  // 並び順は壊れていても8項目ちょうどへ直る
  assert.strictEqual(legacy.autoEnhance.order.length, 8, '並び順は必ず8項目');
  const broken = m.normalizeMasuAutoEnhance({ order:['atk','atk','ないもの'] });
  assert.deepStrictEqual([...broken.order].sort(), ['apt0','apt1','apt2','apt3','atk','def','guts','hp'].sort(), '重複・不明な項目は取り除いて補う');
  assert.strictEqual(broken.order[0], 'atk', '書いてある順番は保つ');
}

// ---- 3. 目標のステータス値どおりに止まる(こえない) ----
{
  // ちからは素の値120。目標129なら、1Pで+3なので3Pで129ちょうど。10P持っていても3Pしか使わない
  const masu = makeMasu({ enabled:true, order:['atk','hp','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:0, atk:129, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.ok(applied, '振る先があれば適用される');
  assert.strictEqual(applied.used, 3, '目標までの3Pだけを使う');
  assert.strictEqual(applied.masu.statPoints.atk, 9, 'ちからは1Pあたり+3');
  assert.strictEqual(m.resolveMasuIndividualStats(applied.masu, base).atk + applied.masu.statPoints.atk, 129, '目標ちょうどになる');
  assert.strictEqual(applied.masu.distAptPoints, 7, '残りは手元に残る');
  assert.strictEqual(m.applyMasuAutoEnhance(applied.masu), null, '目標に届いたら二度目は何もしない');
}

// ---- 3b. 1Pで割り切れない目標は、こえない手前で止まる ----
{
  // ちから素の値120、目標128。1Pで+3なので 120→123→126 まで(2P)。129にはしない
  const masu = makeMasu({ enabled:true, order:['atk','hp','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:0, atk:128, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.used, 2, '目標をこえない範囲で止まる');
  assert.strictEqual(m.resolveMasuIndividualStats(applied.masu, base).atk + applied.masu.statPoints.atk, 126, '目標を1も超えない');
}

// ---- 4. 優先順位のとおり上から埋まる ----
{
  const order = ['def','hp','atk','guts','apt0','apt1','apt2','apt3'];
  // 素の値: ライフ600 / ちから120 / 丈夫さ120 / ガッツ100
  // 丈夫さ126(2P) → ライフ640(4P) → ちから上限なし(残り4P) の順で埋まる
  const masu = makeMasu({ enabled:true, order,
    statTargets:{ hp:640, atk:null, def:126, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.used, 10, '持っている10Pを使い切る');
  assert.strictEqual(applied.masu.statPoints.def, 2 * 3, '1番目の丈夫さが先に目標126まで');
  assert.strictEqual(applied.masu.statPoints.hp, 4 * 10, '2番目のライフが目標640まで');
  assert.strictEqual(applied.masu.statPoints.atk, 4 * 3, '3番目のちから(上限なし)に残り4P');
  assert.strictEqual(applied.masu.statPoints.guts, 0, '「振らない」のガッツには入らない');
  assert.strictEqual(applied.masu.distAptPoints, 0, '使い切った');
}

// ---- 5. 上限なし(null)は残り全部を使う ----
{
  const masu = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:null, atk:null, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.masu.statPoints.hp, 10 * 10, '上限なしの1番目が残り全部を取る');
  assert.strictEqual(applied.masu.statPoints.atk, 0, '2番目までは回らない');
}

// ---- 6. 間合い適性は目標グレードで止まり、上限Mも超えない ----
{
  const masu = makeMasu({ enabled:true, order:['apt0','apt1','apt2','apt3','hp','atk','def','guts'],
    statTargets:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:['A',null,null,null] });
  const current = m.resolveMasuDistAptitude(masu, base)[0];
  const steps = GRADES.indexOf('A') - GRADES.indexOf(current);
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.used, steps, `零距離は目標Aまでの${steps}段階で止まる`);
  assert.strictEqual(m.resolveMasuDistAptitude(applied.masu, base)[0], 'A', '目標グレードちょうどになる');
  assert.strictEqual(m.applyMasuAutoEnhance(applied.masu), null, '目標に届いたら二度目は何もしない');

  // 目標Mでも、Mを超える段階は使わない
  const toMax = makeMasu({ enabled:true, order:['apt0','apt1','apt2','apt3','hp','atk','def','guts'],
    statTargets:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:['M',null,null,null] }, { distAptPoints:999 });
  const maxed = m.applyMasuAutoEnhance(toMax);
  assert.strictEqual(m.resolveMasuDistAptitude(maxed.masu, base)[0], 'M', '上限Mまで上がる');
  assert.strictEqual(maxed.used, GRADES.indexOf('M') - GRADES.indexOf(current), 'Mを超えるぶんは使わない');
}

// ---- 7. 振る先が1つも無ければ ON でも何もしない ----
{
  const masu = makeMasu({ enabled:true, statTargets:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  assert.strictEqual(m.autoEnhanceHasTarget(masu, base), false, '振る先が無いと分かる');
  assert.strictEqual(m.applyMasuAutoEnhance(masu), null, 'ONでも振る先が無ければ何もしない');
}

// ---- 8. いまの配分を上限として写し取れる ----
{
  const built = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:630, atk:126, def:0, guts:0 }, aptLimits:['B',null,null,null] }, { distAptPoints:20 });
  const grown = m.applyMasuAutoEnhance(built).masu;
  const captured = m.buildAutoEnhanceLimitsFromCurrent(grown, base);
  assert.strictEqual(captured.statTargets.hp, 630, 'いまのライフの値がそのまま目標になる');
  assert.strictEqual(captured.statTargets.atk, 126, 'いまのちからの値がそのまま目標になる');
  assert.strictEqual(captured.statTargets.def, 0, '振っていない能力は「振らない」');
  assert.strictEqual(captured.aptLimits[0], 'B', '上げてある距離はいまの段階が目標になる');
  assert.strictEqual(captured.aptLimits[1], null, '上げていない距離は「振らない」');
}

// ---- 9. 転生しても設定は残る(この機能の目的そのもの) ----
{
  const settings = { enabled:true, order:['guts','hp','atk','def','apt0','apt1','apt2','apt3'],
    version:2, statTargets:{ hp:650, atk:0, def:0, guts:106 }, aptLimits:[null,'A',null,null] };
  const grown = m.normalizeMasuProgression({
    id:'r1', baseId:BASE_ID, name:'転生前', bondXp:m.totalBondXpForLevel(120), levelCap:150,
    distAptPoints:0, statPoints:{ hp:50, atk:0, def:0, guts:6 }, distAptBoosts:[0,2,0,0],
    uniqueSkillLevels:{}, uniqueSkillPoints:0, autoEnhance:settings,
  });
  const reincarnated = m.buildMasuReincarnation({ masu:grown, skillKey:'', gold:9999999 });
  assert.ok(reincarnated.ok, '転生できる個体で試す');
  const after = m.normalizeMasuProgression(reincarnated.nextMasu);
  assert.strictEqual(after.autoEnhance.enabled, true, '転生してもONのまま');
  // vm の外と中でプロトタイプが違うので、中身だけを見る
  assert.deepStrictEqual([...after.autoEnhance.order], settings.order, '転生しても優先順位が残る');
  assert.strictEqual(JSON.stringify(after.autoEnhance.statTargets), JSON.stringify(settings.statTargets), '転生しても目標が残る');
  assert.strictEqual(JSON.stringify(after.autoEnhance.aptLimits), JSON.stringify(settings.aptLimits), '転生しても目標グレードが残る');
  assert.strictEqual(after.statPoints.guts, 0, '振ってあった強化そのものは(従来どおり)白紙に戻る');
  // 転生直後に自動で振り直せる
  const rebuilt = m.applyMasuAutoEnhance(after);
  assert.ok(rebuilt && rebuilt.used > 0, '転生後の未使用Pが設定どおりに振られる');
  assert.strictEqual(rebuilt.masu.statPoints.guts, 2 * 3, '1番目のガッツが目標106まで戻る');
  // AUTO∞自動限界突破の設定も同じく残す
  const withBreakthrough = m.resetMasuForRebirth(m.normalizeMasuProgression({
    ...grown, autoRepeatBreakthroughMode:'follow',
  }));
  assert.strictEqual(m.normalizeMasuProgression(withBreakthrough).autoRepeatBreakthroughMode, 'follow',
    'AUTO∞自動限界突破の設定も転生で消えない');
}

// ---- 10. 所持マスモン全体へ一度に通す ----
{
  const on = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:620, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const off = { ...makeMasu({ enabled:false }), id:'m2' };
  const result = m.applyAutoEnhanceToMasuMons([on, off]);
  assert.ok(result, '1体でも振れば結果を返す');
  assert.strictEqual(result.results.length, 1, '振ったのはONの1体だけ');
  assert.strictEqual(result.next[1], off, 'OFFの個体は同じ参照のまま(保存が増えない)');
  assert.strictEqual(m.applyAutoEnhanceToMasuMons(result.next), null, '振るものが無ければ null(保存もstate更新もしない)');
  assert.strictEqual(m.applyAutoEnhanceToMasuMons([]), null, '1体もいなくても落ちない');
  assert.strictEqual(m.applyAutoEnhanceToMasuMons(null), null, '壊れた入力でも落ちない');
  // 表示用の文言が作れている
  assert.ok(result.results[0].lines.some(line => line.includes('ライフ')), '何が増えたかを文にできる');
}

// ---- 11. 絆ポイントリセットの直後は自動で振らない ----
// 「絆ポイントリセットの書」は500ダイヤの、振り直すための道具。
// 使った直後に自動で振ってしまうと、振り直す機会ごと道具代を失わせることになる
{
  const settings = { enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statTargets:{ hp:null, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] };
  const grown = m.applyMasuAutoEnhance(makeMasu(settings, { distAptPoints:6 })).masu;
  assert.strictEqual(grown.statPoints.hp, 60, 'まず上限なしで振っておく');
  const reset = m.buildMasuBondPointReset(grown, base);
  assert.ok(reset && reset.nextMasu.distAptPoints === 6, 'リセットで6Pが未使用へ戻る');
  assert.ok(reset.nextMasu.bondResetAllocationSnapshot, 'リセット前の配分が下書きとして残る');
  assert.strictEqual(m.masuAwaitsBondResetReallocation(reset.nextMasu), true, 'リセット直後だと分かる');
  assert.strictEqual(m.applyMasuAutoEnhance(reset.nextMasu), null, 'リセット直後は自動で振らない');
  assert.strictEqual(m.applyAutoEnhanceToMasuMons([reset.nextMasu]), null, '全体へ通しても振らない');
  // 自分で「いますぐ振る」を押したときだけ振り、復元の下書きの役目も終わらせる
  const manual = m.applyMasuAutoEnhance(reset.nextMasu, { manual:true });
  assert.ok(manual && manual.used === 6, '「いますぐ振る」なら振れる');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(manual.masu, 'bondResetAllocationSnapshot'), false,
    '自分で振ったら復元の下書きは残さない（いま振ったぶんの上へ重ねて復元されてしまうため）');
  assert.strictEqual(m.masuAwaitsBondResetReallocation(manual.masu), false, 'そこから自動強化が再開する');
  // 振り直しが終われば(下書きが消えれば)、次に貯まったぶんからは自動で振る
  const later = m.applyMasuAutoEnhance({ ...manual.masu, distAptPoints:2 });
  assert.ok(later && later.used === 2, '振り直しのあとは自動で振る');
}

// ---- 11b. 強化Pで持っていたころ(版1)の保存が、目標の合計値へ読み替わる ----
// 上限の決め方を「振ってよいP数」から「いくつまで上げてよいか」へ変えたとき、
// 読み替えを間違えると設定が黙って消える(全部0＝振らない)。ここが最大の危険なので厚めに見る。
{
  // 版1: ライフに5P・ガッツに2P・ちからは上限なし・丈夫さは振らない
  const legacy = makeMasu(undefined, {});
  legacy.autoEnhance = { enabled:true, order:['hp','guts','atk','def','apt0','apt1','apt2','apt3'],
    statLimits:{ hp:5, guts:2, atk:null, def:0 }, aptLimits:[null,'A',null,null] };
  // 素の値: ライフ600 / ちから120 / 丈夫さ120 / ガッツ100
  const targets = m.autoEnhanceStatTargetsOf(legacy, base);
  assert.strictEqual(targets.hp, 600 + 5 * 10, '5P → 素の値＋50 の合計値になる');
  assert.strictEqual(targets.guts, 100 + 2 * 3, '2P → 素の値＋6 の合計値になる');
  assert.strictEqual(targets.atk, null, '上限なしは上限なしのまま');
  assert.strictEqual(targets.def, 0, '振らないは振らないまま');
  // 版1のままでも、振る量は読み替え後と同じになる(移行し忘れても壊れない)
  const applied = m.applyMasuAutoEnhance({ ...legacy, distAptPoints:10 });
  assert.strictEqual(applied.masu.statPoints.hp, 50, '版1のままでも5Pぶんで止まる');
  assert.strictEqual(applied.masu.statPoints.guts, 6, '版1のままでも2Pぶんで止まる');
  assert.strictEqual(m.autoEnhanceHasTarget(legacy, base), true, '版1でも「振る先がある」と分かる');

  // 画面で1項目だけ触ったとき、触っていない項目が0へ落ちないこと(ここが消える事故の本体)
  const edited = m.buildMasuAutoEnhanceUpdate(legacy, { enabled:false });
  const after = m.normalizeMasuAutoEnhance(edited.autoEnhance);
  assert.strictEqual(after.version, m.AUTO_ENHANCE_SETTINGS_VERSION, '書き換えたら版2になる');
  assert.strictEqual(after.statTargets.hp, 650, '触っていないライフの目標が残る');
  assert.strictEqual(after.statTargets.guts, 106, '触っていないガッツの目標が残る');
  assert.strictEqual(after.statTargets.atk, null, '触っていない「上限なし」も残る');
  assert.deepStrictEqual([...after.aptLimits], [null,'A',null,null], '間合い適性の目標も残る');
  assert.strictEqual(after.enabled, false, '指定した項目だけが変わる');

  // 並べ替えでも同じ(buildMasuAutoEnhanceOrderMove も同じ入口を通る)
  const moved = m.normalizeMasuAutoEnhance(m.buildMasuAutoEnhanceOrderMove(legacy, 'guts', -1).autoEnhance);
  assert.strictEqual(moved.statTargets.hp, 650, '並べ替えでも目標が消えない');
  assert.strictEqual(moved.order[0], 'guts', '並べ替えは効いている');
}

// ---- 12. 優先順位の入れ替え ----
{
  const masu = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'] });
  const moved = m.buildMasuAutoEnhanceOrderMove(masu, 'atk', -1);
  assert.strictEqual(m.normalizeMasuAutoEnhance(moved.autoEnhance).order[0], 'atk', '1つ上へ動く');
  assert.strictEqual(m.buildMasuAutoEnhanceOrderMove(masu, 'hp', -1), masu, '先頭より上へは動かない');
  assert.strictEqual(m.buildMasuAutoEnhanceOrderMove(masu, 'apt3', 1), masu, '末尾より下へは動かない');
}

// ---- 13. 画面と本体がつながっているか ----
{
  const screen = fs.readFileSync('monster-hero/src/parts/72-screen-masu-auto-enhance.jsx', 'utf8');
  const app = fs.readFileSync('monster-hero/src/parts/60-app.jsx', 'utf8');
  const enhance = fs.readFileSync('monster-hero/src/parts/65-screen-masu-enhance.jsx', 'utf8');
  assert.ok(screen.includes('buildMasuAutoEnhancePlan'), '画面は本体と同じ計算で行き先を見せる');
  assert.ok(screen.includes('AssistantBubble scene="masuAutoEnhance"'), '助手の案内が置いてある');
  assert.ok(/MASU_ENHANCE_STATES = \[[^\]]*'MASU_AUTO_ENHANCE'/.test(app), '詳細モーダルを重ねない画面に入っている');
  assert.ok(app.includes("gameState==='MASU_AUTO_ENHANCE'&&masuMonDetail&&"), '画面が本体からマウントされている');
  assert.ok(app.includes('applyAutoEnhanceToMasuMons(masuMonsRef.current'), '強化ポイントが増えたら自動で振る仕掛けがある');
  assert.ok(app.includes("storeSet(AUTO_ENHANCE_INTRO_KEY"), '使い方案内の保存キーが新設されている');
  // storeGet はキーが無いときも既定値を返す。既定値を true にすると
  // 「保存が無い＝見た扱い」になり、案内が誰にも一度も出ない
  assert.ok(app.includes("storeGet(AUTO_ENHANCE_INTRO_KEY, false, false) === true"),
    '使い方案内は、保存が無いうちは「まだ見ていない」として出す');
  assert.ok(screen.includes('masuAwaitsBondResetReallocation'), '絆ポイントリセット直後は画面でもそう伝える');
  // 上限は「強化Pの数」ではなく「いくつまで上げてよいか」で入れる(2026-09-12・ユーザー指摘)
  assert.ok(screen.includes('autoEnhanceStatTargetsOf'), '画面も目標の合計値で出し入れする');
  assert.ok(screen.includes('→ ここまで'), '入力欄は「いくつまで上げてよいか」として見せる');
  assert.ok(screen.includes('素の値 '), '素の値がどれだけかを画面に出す');
  assert.ok(!/statLimitText|commitStatLimit|setStatLimit\(/.test(screen), '強化Pで入れる作りが残っていない');
  assert.ok(enhance.includes('onOpenAutoEnhance'), '通常強化の画面からオート強化へ行ける');
}

console.log('OK: オート強化は、上限・優先順位・OFF・転生後の引き継ぎまで設定どおりに働く');
console.log('すべてOK');
