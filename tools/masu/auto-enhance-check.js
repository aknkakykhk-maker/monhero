#!/usr/bin/env node
'use strict';
//
// オート強化(個体ごとの自動強化設定)の検査。
//
// 見るところ:
//   ・上限どおりに止まるか(振りすぎない・足りないところで止まる)
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
  const masu = makeMasu({ enabled:false, statLimits:{ hp:null, atk:null, def:null, guts:null } });
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

// ---- 3. 上限どおりに止まる(振りすぎない) ----
{
  // ちからの上限3P。10P持っていても3Pしか使わない
  const masu = makeMasu({ enabled:true, order:['atk','hp','def','guts','apt0','apt1','apt2','apt3'],
    statLimits:{ hp:0, atk:3, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.ok(applied, '振る先があれば適用される');
  assert.strictEqual(applied.used, 3, '上限の3Pだけを使う');
  assert.strictEqual(applied.masu.statPoints.atk, 3 * 3, 'ちからは1Pあたり+3');
  assert.strictEqual(applied.masu.distAptPoints, 7, '残りは手元に残る');
  // もう一度通しても、上限に達しているので何も起きない(繰り返しにならない)
  assert.strictEqual(m.applyMasuAutoEnhance(applied.masu), null, '上限まで振ったら二度目は何もしない');
}

// ---- 4. 優先順位のとおり上から埋まる ----
{
  const order = ['def','hp','atk','guts','apt0','apt1','apt2','apt3'];
  const masu = makeMasu({ enabled:true, order,
    statLimits:{ hp:4, atk:99, def:2, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.used, 10, '持っている10Pを使い切る');
  assert.strictEqual(applied.masu.statPoints.def, 2 * 3, '1番目の丈夫さが先に上限2Pまで');
  assert.strictEqual(applied.masu.statPoints.hp, 4 * 10, '2番目のライフが上限4Pまで');
  assert.strictEqual(applied.masu.statPoints.atk, 4 * 3, '3番目のちからに残り4P');
  assert.strictEqual(applied.masu.statPoints.guts, 0, '「振らない」のガッツには入らない');
  assert.strictEqual(applied.masu.distAptPoints, 0, '使い切った');
}

// ---- 5. 上限なし(null)は残り全部を使う ----
{
  const masu = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statLimits:{ hp:null, atk:null, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.masu.statPoints.hp, 10 * 10, '上限なしの1番目が残り全部を取る');
  assert.strictEqual(applied.masu.statPoints.atk, 0, '2番目までは回らない');
}

// ---- 6. 間合い適性は目標グレードで止まり、上限Mも超えない ----
{
  const masu = makeMasu({ enabled:true, order:['apt0','apt1','apt2','apt3','hp','atk','def','guts'],
    statLimits:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:['A',null,null,null] });
  const current = m.resolveMasuDistAptitude(masu, base)[0];
  const steps = GRADES.indexOf('A') - GRADES.indexOf(current);
  const applied = m.applyMasuAutoEnhance(masu);
  assert.strictEqual(applied.used, steps, `零距離は目標Aまでの${steps}段階で止まる`);
  assert.strictEqual(m.resolveMasuDistAptitude(applied.masu, base)[0], 'A', '目標グレードちょうどになる');
  assert.strictEqual(m.applyMasuAutoEnhance(applied.masu), null, '目標に届いたら二度目は何もしない');

  // 目標Mでも、Mを超える段階は使わない
  const toMax = makeMasu({ enabled:true, order:['apt0','apt1','apt2','apt3','hp','atk','def','guts'],
    statLimits:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:['M',null,null,null] }, { distAptPoints:999 });
  const maxed = m.applyMasuAutoEnhance(toMax);
  assert.strictEqual(m.resolveMasuDistAptitude(maxed.masu, base)[0], 'M', '上限Mまで上がる');
  assert.strictEqual(maxed.used, GRADES.indexOf('M') - GRADES.indexOf(current), 'Mを超えるぶんは使わない');
}

// ---- 7. 振る先が1つも無ければ ON でも何もしない ----
{
  const masu = makeMasu({ enabled:true, statLimits:{ hp:0, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] });
  assert.strictEqual(m.autoEnhanceHasTarget(masu.autoEnhance), false, '振る先が無いと分かる');
  assert.strictEqual(m.applyMasuAutoEnhance(masu), null, 'ONでも振る先が無ければ何もしない');
}

// ---- 8. いまの配分を上限として写し取れる ----
{
  const built = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'],
    statLimits:{ hp:3, atk:2, def:0, guts:0 }, aptLimits:['B',null,null,null] }, { distAptPoints:20 });
  const grown = m.applyMasuAutoEnhance(built).masu;
  const captured = m.buildAutoEnhanceLimitsFromCurrent(grown, base);
  assert.strictEqual(captured.statLimits.hp, 3, '振ってあるライフのP数がそのまま上限になる');
  assert.strictEqual(captured.statLimits.atk, 2, '振ってあるちからのP数がそのまま上限になる');
  assert.strictEqual(captured.statLimits.def, 0, '振っていない能力は「振らない」');
  assert.strictEqual(captured.aptLimits[0], 'B', '上げてある距離はいまの段階が目標になる');
  assert.strictEqual(captured.aptLimits[1], null, '上げていない距離は「振らない」');
}

// ---- 9. 転生しても設定は残る(この機能の目的そのもの) ----
{
  const settings = { enabled:true, order:['guts','hp','atk','def','apt0','apt1','apt2','apt3'],
    statLimits:{ hp:5, atk:0, def:0, guts:2 }, aptLimits:[null,'A',null,null] };
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
  assert.strictEqual(JSON.stringify(after.autoEnhance.statLimits), JSON.stringify(settings.statLimits), '転生しても上限が残る');
  assert.strictEqual(JSON.stringify(after.autoEnhance.aptLimits), JSON.stringify(settings.aptLimits), '転生しても目標グレードが残る');
  assert.strictEqual(after.statPoints.guts, 0, '振ってあった強化そのものは(従来どおり)白紙に戻る');
  // 転生直後に自動で振り直せる
  const rebuilt = m.applyMasuAutoEnhance(after);
  assert.ok(rebuilt && rebuilt.used > 0, '転生後の未使用Pが設定どおりに振られる');
  assert.strictEqual(rebuilt.masu.statPoints.guts, 2 * 3, '1番目のガッツが上限2Pまで戻る');
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
    statLimits:{ hp:2, atk:0, def:0, guts:0 }, aptLimits:[null,null,null,null] });
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

// ---- 11. 優先順位の入れ替え ----
{
  const masu = makeMasu({ enabled:true, order:['hp','atk','def','guts','apt0','apt1','apt2','apt3'] });
  const moved = m.buildMasuAutoEnhanceOrderMove(masu, 'atk', -1);
  assert.strictEqual(m.normalizeMasuAutoEnhance(moved.autoEnhance).order[0], 'atk', '1つ上へ動く');
  assert.strictEqual(m.buildMasuAutoEnhanceOrderMove(masu, 'hp', -1), masu, '先頭より上へは動かない');
  assert.strictEqual(m.buildMasuAutoEnhanceOrderMove(masu, 'apt3', 1), masu, '末尾より下へは動かない');
}

// ---- 12. 画面と本体がつながっているか ----
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
  assert.ok(enhance.includes('onOpenAutoEnhance'), '通常強化の画面からオート強化へ行ける');
}

console.log('OK: オート強化は、上限・優先順位・OFF・転生後の引き継ぎまで設定どおりに働く');
console.log('すべてOK');
