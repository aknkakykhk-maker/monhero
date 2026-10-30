#!/usr/bin/env node
// 同じ主血統の立ち絵の見た目の大きさをそろえる表示の倍率(MONSTER_ART_SCALE)を見張る(2026-10-29 社長・案A)。
//
//   node tools/monster/lineage-art-scale-check.js
//
// ① 倍率を掛けても、絵の不透明な部分が正方形の箱からはみ出さない(幅 0.99・高さ 1.0 まで。横に広い子は幅で頭打ち)
// ② 倍率は「その子の立ち絵を contain で出すとき」だけ: DyedMonsterImage・MonsterArtFrame の素の img・モンスターノーツの canvas
// ③ 待機アニメの部品の軸(origin)も同じ式で動かす(部品が体から浮かない)
// 絵を差し替えたら、この検査が測り直して知らせる。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };

const art = read('monster-hero/src/parts/15-dye-and-art.jsx');
const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
const tableSrc = art.match(/const MONSTER_ART_SCALE = Object\.freeze\(\{[\s\S]*?\n\}\);/);
check('MONSTER_ART_SCALE がある', !!tableSrc);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${read('monster-hero/data/images/images-ally.js')}\n${read('monster-hero/data/ally-monsters.js')}\n${tableSrc ? tableSrc[0] : 'const MONSTER_ART_SCALE={};'}\nglobalThis.x={ALL_PLAYER_MONSTERS,MONSTER_ART_SCALE};`, ctx);
const { ALL_PLAYER_MONSTERS: mons, MONSTER_ART_SCALE: table } = ctx.x;

check('つなぎ込み: DyedMonsterImage が倍率を掛ける(マスクの位置合わせの画面では掛けない)',
  /const artScale = debugMaskPlacement \? null : monsterArtScaleOf\(baseId, src, className, monsterArtFitStyle\(baseId, givenStyle\)\);/.test(art));
check('つなぎ込み: 倍率は src がその子の立ち絵(imgUrl)で、収め方が contain のときだけ',
  /_artPathOf\(src\) !== _artPathOf\(mon\.imgUrl\)/.test(art) && /return fit === 'contain' \? def : null;/.test(art));
check('つなぎ込み: MonsterArtFrame の素の img とモンスターノーツの canvas にも掛ける',
  /const plainScale = Array\.isArray\(masuColors\) \? null : monsterArtScaleOf\(/.test(art) && /const out = await _bakeDyedMonsterCanvasRaw\(opts, size\);/.test(art));
check('つなぎ込み: 待機アニメの部品の軸を同じ式で動かす',
  /transformOrigin:originOf\(part\.origin\)/.test(fx) && /50 \+ artScale\.scale \* \(Number\(m\[1\]\) - 50\)/.test(fx) && /artScale\.ty \* 100/.test(fx));

// ---------- MFバトルカードの場(84-screen-card-battle.jsx の CardMonSlot)。2026-10-30 社長「同じ血統同士のサイズがあってない」 ----------
// 場の立ち絵は ART_CONTENT_BOXES(絵の中身の範囲)から計算して余白を詰める(1体ずつの数字は持たない)。
// カードに出る全員(カードだけの混血を含む)を主血統ごとに分け、詰めたあとの「要素に対する中身の高さ」がそろうかを見る
{
  const card = read('monster-hero/src/parts/84-screen-card-battle.jsx');
  check('カードの場: 立ち絵に cardFieldArtTransform を掛け、相手は左右の向きもそこで返す',
    /const artFit = art \? cardFieldArtTransform\(art, opp\) : null;/.test(card) && /\$\{opp && !artFit \? '-scale-x-100' : ''\}/.test(card));
  const spread = Number((card.match(/const CARD_FIELD_ART_SPREAD = ([\d.]+);/) || [])[1]);
  check('カードの場: 横に広い子の左右へのはみ出しは、枠に収まる 1.15 倍まで', spread > 1 && spread <= 1.15, String(spread));
  const cctx = {};
  vm.createContext(cctx);
  vm.runInContext(`${read('monster-hero/data/images/images-ally.js')}\n${read('monster-hero/data/ally-monsters.js')}\n${read('monster-hero/data/card-battle-cards.js')}\nglobalThis.x={ART_CONTENT_BOXES,HYBRID_MONSTER_IMGS,ALL_PLAYER_MONSTERS,CARD_BATTLE_DATA};`, cctx);
  const { ART_CONTENT_BOXES: boxes, HYBRID_MONSTER_IMGS: hybrid, ALL_PLAYER_MONSTERS: all, CARD_BATTLE_DATA: data } = cctx.x;
  const species = Function(`return (${card.match(/const CARD_SPECIES_ART = Object\.freeze\((\{[^}]*\})\)/)[1]})`)();
  const newArt = {};
  for (const m of card.matchAll(/^  (\w+): typeof (MF_\w+_IMG) !== 'undefined'/gm)) newArt[m[1]] = vm.runInContext(`typeof ${m[2]} !== 'undefined' ? ${m[2]} : null`, cctx);
  const artOf = (mon) => (mon.main ? (hybrid || {})[mon.no] || null
    : (species[mon.species] && all[species[mon.species]] && all[species[mon.species]].imgUrl) || newArt[mon.species] || null);
  const groups = {};
  const missing = [];
  for (const mon of Object.values(data.monsters)) {
    if (mon.variant) continue;
    const art = artOf(mon);
    if (!art) continue;
    const box = boxes[String(art).split('?')[0].replace(/^images\//, '')];
    if (!box) { missing.push(mon.name); continue; }
    const fw = box[2] - box[0], fh = box[3] - box[1];
    const k = Math.min(spread / fw, 1 / fh);
    (groups[mon.main || mon.species] = groups[mon.main || mon.species] || []).push([mon.name, k > 1.02 ? fh * k : fh]);
  }
  check('カードの場: 立ち絵のある子は全員、中身の範囲(ART_CONTENT_BOXES)がある', missing.length === 0, missing.join('・'));
  const off = Object.entries(groups).filter(([, list]) => list.length > 1)
    .map(([lin, list]) => [lin, Math.min(...list.map((x) => x[1])), list]).filter(([, low]) => low < 0.9);
  check('カードの場: 同じ主血統の子は、詰めたあとの中身の高さが 0.9 以上でそろう', off.length === 0,
    off.map(([lin, , list]) => `${lin}: ${list.map(([n, h]) => `${n} ${h.toFixed(2)}`).join(' / ')}`).join(' | '));
}

let sharp = null;
try { sharp = require(path.join(ROOT, 'tools/node_modules/sharp')); } catch (_) { /* 無ければ①は飛ばす */ }
(async () => {
  if (!sharp) { console.log('SKIP: sharp が無いので、はみ出しの測り直しを飛ばします(cd tools && npm install)'); }
  else {
    for (const [id, def] of Object.entries(table)) {
      const mon = mons[id];
      if (!mon) { check(`${id} が ALL_PLAYER_MONSTERS にいる`, false); continue; }
      const { data, info } = await sharp(path.join(ROOT, 'monster-hero', mon.imgUrl.split('?')[0])).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const B = Math.max(info.width, info.height);
      // 正方形の箱(1×1)に contain で入れ、中心で scale・ty だけ上下へ動かしたときの、不透明な部分の端
      const off = (v) => 0.5 + def.scale * (v / B - 0.5);
      const ox = (B - info.width) / 2, oy = (B - info.height) / 2;
      const L = off(x0 + ox), R = off(x1 + 1 + ox), T = off(y0 + oy) + def.ty, D = off(y1 + 1 + oy) + def.ty;
      check(`${mon.name}: ×${def.scale} でも箱からはみ出さない`, L >= 0.005 && R <= 0.995 && T >= 0 && D <= 1,
        `左${L.toFixed(3)} 右${R.toFixed(3)} 上${T.toFixed(3)} 下${D.toFixed(3)} 高さ${(D - T).toFixed(2)}`);
    }
  }
  console.log(failed ? `\nNG: ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
