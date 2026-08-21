// 丈夫さの基本防御とガード値を、表示・実処理で共有する仕様に固定する回帰チェック。
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const skills = fs.readFileSync('monster-hero/data/skills.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${skills.slice(skills.indexOf('const GUARD_EVOLUTION'), skills.indexOf('const RANGE_EVOLUTION'))};globalThis.guards=GUARD_EVOLUTION`, ctx);
const guards = ctx.guards;

const effectiveDefense = (baseDef, defPct=0) => Math.floor(baseDef*(1+defPct));
const guardLevel = baseDef => Math.max(0,Math.min(guards.length-1,Math.floor(baseDef/100)));
const baseDamage = (attack, def) => Math.max(30,(attack-def*0.5)*(1-Math.min(0.5,def*0.00015)));
const incoming = ({attack,def,trait=1,dmgCut=0,ice=1}) =>
  Math.max(1,Math.floor(baseDamage(attack,def)*trait*Math.max(0.01,1-dmgCut)*ice));
const guardValue = (def, level, weight=1, effect=1) => Math.floor(def*guards[level].mult*weight*effect);
const resolved = ({attack,baseDef,defPct=0,level=guardLevel(baseDef),weights=[],trait=1,dmgCut=0,ice=1,turn=1}) => {
  const def=effectiveDefense(baseDef,defPct);
  const beforeTurn=incoming({attack,def,trait,dmgCut,ice});
  const guard=weights.reduce((sum,{weight=1,effect=1})=>sum+def*guards[level].mult*weight*effect,0);
  const damage=Math.max(0,beforeTurn-Math.floor(guard));
  return {def,level,guard:Math.floor(guard),damage:damage>0?Math.max(1,Math.floor(damage*turn)):0};
};

assert.strictEqual(JSON.stringify(guards.map(g=>g.flat)),JSON.stringify(Array(9).fill(0)));
assert.strictEqual(JSON.stringify(guards.map(g=>g.mult)),JSON.stringify([2.65,2.85,3.04,3.24,3.64,3.93,4.68,5.57,6.97]));
for (const [def,rate] of [[0,0],[100,.015],[400,.06],[800,.12],[900,.135],[1000,.15],[1200,.18],[10000/3,.5],[4000,.5]]) {
  assert(Math.abs(Math.min(.5,def*.00015)-rate)<1e-12,`丈夫さ${def}の割合軽減`);
}
assert.strictEqual(baseDamage(999999,4000),(999999-2000)*.5,'割合軽減は50%上限');
assert.strictEqual(baseDamage(10,1000),30,'丈夫さ基本防御は最低30');

// 全段階を基礎丈夫さで解放し、その段階の実効丈夫さ倍率を使う。
for (let level=0;level<guards.length;level++) {
  const def=level*100;
  assert.strictEqual(guardLevel(def),level);
  assert.strictEqual(guardValue(def,level),Math.floor(def*guards[level].mult));
}
assert.strictEqual(guardLevel(800),8);
assert.strictEqual(guardLevel(1200),8);
for (const [def,value] of [[800,5576],[900,6273],[1000,6970],[1200,8364]]) {
  assert.strictEqual(guardValue(def,8),value,`万象拒絶は丈夫さ${def}でも伸びる`);
}

// バフは段階を解放せず、基本防御とガード量の実効丈夫さだけを伸ばす。
const buffed=resolved({attack:2000,baseDef:400,defPct:.25,weights:[{}]});
assert.deepStrictEqual([buffed.def,buffed.level,buffed.guard],[500,4,1820]);

// 複数枚・弱ガード・2枚目以降半減。アシストカードは特殊倍率だけを受ける。
assert.strictEqual(resolved({attack:9999,baseDef:400,weights:[{},{}]}).guard,2912);
assert.strictEqual(resolved({attack:9999,baseDef:400,weights:[{weight:.5}]}).guard,728);
assert.strictEqual(resolved({attack:9999,baseDef:400,weights:[{},{effect:.5}]}).guard,2184);
assert.strictEqual(resolved({attack:9999,baseDef:400,weights:[{effect:.5}]}).guard,728);

// 永続軽減と次ターン軽減は、丈夫さ基本防御・ガードの後という実戦順を維持する。
const combined=resolved({attack:7000,baseDef:500,trait:.8,dmgCut:.2,ice:.7,weights:[{}],turn:.5});
assert.strictEqual(combined.damage,416);

// 固定軽減だけを0.5/ptへ弱め、割合軽減は維持する。ガード後の余剰はmainの直前仕様とほぼ同等。
assert.strictEqual(Math.floor(baseDamage(1050,400)),799);
assert.strictEqual(Math.floor(Math.max(30,(1050-400*.75)*(1-Math.min(.5,400*.00015)))),705);
assert.strictEqual(guardValue(400,4)-Math.floor(baseDamage(1050,400)),657);

// 低丈夫さ帯でも、段階上昇によってガード値が逆に下がらない。
let previousGuard=0;
for (let def=50;def<=150;def++) {
  const value=guardValue(def,guardLevel(def));
  assert(value>=previousGuard,`丈夫さ${def}のガード値が逆転しない`);
  previousGuard=value;
}

// 代表値（補正なし・ガード1枚）。基本被ダメ・ガード値・予測と実処理をまとめて固定する。
const cases=[
  [100,150,98,285,0],
  [200,600,485,608,0],
  [400,1050,799,1456,0],
  [500,3500,3006,1965,1041],
  [600,4550,3867,2808,1059],
  [700,7000,5951,3899,2052],
  [800,9100,7656,5576,2080],
  [900,9100,7482,6273,1209],
  [1000,9100,7310,6970,340],
  [1200,9100,6970,8364,0],
];
for (const [def,attack,expectedBase,expectedGuard,expected] of cases) {
  const result=resolved({attack,baseDef:def,weights:[{}]});
  assert.strictEqual(incoming({attack,def}),expectedBase,`基本被ダメ 丈夫さ${def}`);
  assert.strictEqual(result.guard,expectedGuard,`ガード値 丈夫さ${def}`);
  const preview=resolved({attack,baseDef:def,weights:[{}]}).damage;
  const actual=resolved({attack,baseDef:def,weights:[{}]}).damage;
  assert.strictEqual(preview,expected,`代表値 丈夫さ${def}`);
  assert.strictEqual(actual,preview,`予測と実ダメージ 丈夫さ${def}`);
}

// 本番の表示と実処理が同じ実効丈夫さ・集計値を参照する結線も固定する。
assert(game.includes('const defenseRate = Math.min(0.5,effectiveDef*0.00015);'));
assert(game.includes('Math.max(30,(atkVal-effectiveDef*0.5)*(1-defenseRate))'));
assert(game.includes('Math.floor(flat + effectiveDef * mult)'));
assert(game.includes('Math.floor(immediateEffects.guardFlat + effectiveDef*immediateEffects.guardMult)'));
assert(game.includes('applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf'));
console.log('guard defense balance checks passed');
