#!/usr/bin/env node
'use strict';
// モンスターの待機アニメ(MONSTER_IDLE_RIGS)を確かめる。
//
//   node tools/monster/idle-rig-check.js
//
// 【なぜ道具にするか】
// 待機アニメは「同じ絵を部位のマスクで切り抜いて重ね、部位を付け根で回す」作りなので、
// マスクの縦横比が元絵とずれる・回転軸の座標を書き間違える・CSS の動きを書き忘れる、の
// どれが起きても画面はふつうに開いてしまい、翼が肩から外れて回る・動かないことに気づきにくい。
// ミーアのあとに子を足していくときに、設定表1件ぶんの書き忘れをここで拾う。
// またバトルと図鑑が同じ部品(withMonsterIdleArt)を通していることも見る
// (片方だけモンスター名で分岐すると、図鑑だけ動かない子ができる)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const dex = read('monster-hero/src/parts/57-screen-monster-dex.jsx');
const dexArt = read('monster-hero/src/parts/20-market-notices-help.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (text, from, to) => {
  const i = text.indexOf(from), j = text.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 切り出せませんでした（${from}）`); process.exit(1); }
  return text.slice(i, j);
};
// PNG の大きさ(IHDR)を読む。画像を開く道具が入っていない環境でも動くようにする
const pngSize = (rel) => {
  const file = path.join(root, 'monster-hero', String(rel).split('?')[0]);
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

// --- 実データと設定表をそのまま動かす ---
const ctx = { console, Object, Array, Set, Map, String, Number, Math };
vm.createContext(ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext(slice(fx, 'const MONSTER_IDLE_RIGS =', 'const MONSTER_IDLE_MASK_STYLE'), ctx);
vm.runInContext(slice(fx, 'const monsterIdlePoint =', 'const MonsterIdleArt ='), ctx);
vm.runInContext('this.__rigs = MONSTER_IDLE_RIGS; this.__point = monsterIdlePoint; this.__monsters = ALL_PLAYER_MONSTERS;', ctx);
const rigs = ctx.__rigs;
const point = ctx.__point;
const monsters = ctx.__monsters;

const ids = Object.keys(rigs);
check('待機アニメの設定表に1体以上ある', ids.length > 0, ids.join('・'));
const cssKeys = ids.map(id => rigs[id].cssKey);
check('cssKey が重ならない', new Set(cssKeys).size === cssKeys.length, cssKeys.join('・'));

for (const id of ids) {
  const rig = rigs[id];
  const mon = monsters[id];
  check(`${id}: プレイヤーモンスターに居る`, !!mon);
  if (!mon) continue;
  const art = pngSize(mon.imgUrl);
  check(`${id}: size が元絵の大きさと同じ`, !!art && art[0] === rig.size[0] && art[1] === rig.size[1],
    `元絵 ${art ? art.join('×') : '読めない'} / 設定 ${rig.size.join('×')}`);
  const aspect = rig.size[0] / rig.size[1];
  const inArt = ([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= rig.size[0] && y <= rig.size[1];
  check(`${id}: 全体の軸(anchor)が絵の中にある`, Array.isArray(rig.anchor) && inArt(rig.anchor));
  const masks = [['base', rig.base], ...rig.parts.map(p => [p.key, p.mask])];
  for (const [key, url] of masks) {
    const size = typeof url === 'string' ? pngSize(url) : null;
    check(`${id}/${key}: マスクがあり、元絵と同じ縦横比`, !!size && Math.abs(size[0] / size[1] - aspect) < 0.01,
      size ? `${size.join('×')}` : `${url} が見つからない`);
  }
  check(`${id}: 動かす部位が1つ以上ある`, rig.parts.length > 0);
  const partKeys = rig.parts.map(p => p.key);
  check(`${id}: 部位の key が重ならない`, new Set(partKeys).size === partKeys.length);
  for (const p of rig.parts) {
    check(`${id}/${p.key}: 回転軸(pivot)が絵の中にある`, Array.isArray(p.pivot) && inArt(p.pivot));
    check(`${id}/${p.key}: CSS に動きが書いてある`, css.includes(`.monster-idle--${rig.cssKey} .monster-idle__part--${p.key} {`));
  }
  check(`${id}: CSS に全体の動きが書いてある`, css.includes(`.monster-idle--${rig.cssKey} {`));
}

// ミーアは作り直す前(バトル専用だったころ)と同じ軸で回る。枠が正方形のとき、元のCSSの値と一致すること
if (rigs.Mia) {
  const [l, r] = rigs.Mia.parts;
  check('ミーアの翼の軸が作り直す前と同じ(正方形の枠)',
    point(rigs.Mia, l.pivot) === '44.3% 38.1%' && point(rigs.Mia, r.pivot) === '55.7% 38.1%',
    `${point(rigs.Mia, l.pivot)} / ${point(rigs.Mia, r.pivot)}`);
  check('ミーアの浮き沈みの軸が作り直す前と同じ(正方形の枠)', point(rigs.Mia, rigs.Mia.anchor) === '50% 96%', point(rigs.Mia, rigs.Mia.anchor));
}
// 枠が正方形でないときも、元絵の同じ点を指す(横長の枠なら左右の余白ぶんずれる)
const probe = { size: [200, 300] };
check('横長の枠では左右の余白を足して軸を出す', point(probe, [100, 150], 2) === '50% 50%' && point(probe, [0, 0], 2) === '33.3% 0%');
check('縦長の枠では上下の余白を足して軸を出す', point(probe, [0, 0], 0.5) === '0% 12.5%');

// --- バトルと図鑑が同じ部品を通す ---
check('バトルは withMonsterIdleArt を通し、モンスター名で分岐しない',
  battle.includes('withMonsterIdleArt(s?.id, img, {enabled:!ecoBattleView&&!idleMotionOff})') && !/MiaIdleArt/.test(battle));
check('図鑑の詳細の立ち絵は待機アニメ版を使う', dex.includes('<DexMonsterIdleArt mon={mon} alt={mon.name}/>'));
check('図鑑の攻撃アクションも待機アニメを重ねる', dex.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, mon.name)') && dex.includes('monsterIdleAllowedDuring(previewAnim)'));
check('図鑑は絵の要素そのものを渡す(部品を複製しない)', dexArt.includes('const dexMonsterArtImage =') && dexArt.includes('withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, alt), {fill:true})'));
check('軽量表示・「待機中の動き：止める」では図鑑でも止まる', css.includes('[data-phase-look="calm"] .monster-idle, [data-phase-look="calm"] .monster-idle__part { animation:none; }'));
check('動きを減らす設定で止まる', /prefers-reduced-motion: reduce\)\s*\{\s*\.monster-idle, \.monster-idle__part \{ animation:none; \}/.test(css));
check('回転軸は JS が出し、CSS に % を書かない', !/\.monster-idle[^{]*\{[^}]*transform-origin/.test(css));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
