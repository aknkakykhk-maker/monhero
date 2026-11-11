// ウンディーネ種(2026-11-11 社長「バトルカードに新血統を追加。ウンディーネ種: ウンディーネ・スネグーラチカ。第8弾に追加」)の検査。
//   node tools/card/card-undine-check.js [--verbose]
// 見るもの(設計書 tools/art-sources/card-battle/undine/undine.md・届いた一式 undine.cards.json)
//   A 技13枚・モンスター(ウンディーネ 3種類・スネグーラチカ 3種類)が設計書の数字のまま / 第8弾から出る / 画像がある
//   B 水牢(costUpOnHit): 当てた子だけ、次の相手のターン、ちから技・かしこさ技 +1。特殊・回避・防御・ほかの子は増えない。その次のターンには消える
//   C 重ねがけは大きいほう(2回当てても +1)/ クリスタルレインは当たった全員
//   D アクアドーム(costUpAll): 水中にいない相手全員 +2(水中は増えない・水中かはそのターンで見る)。当てた水牢とは足し合わせる
//   E 回避の「2以上のガッツを使う技」は、増えたあとのガッツで見る(1→2 に上がった技は潜るで回避できる)
//   F スネグーラチカはウンディーネの技を全部使える / ルールの版が上がっている
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/89-card-pack.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardActionCost, cardUsableBy, cardCostUpOf, cardPackOf, cardPackMonPool, cardPackTechPool, cardAiEvadeChance };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (v) => JSON.stringify(v);

// ---- A ----
{
  const design = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'art-sources', 'card-battle', 'undine', 'undine.cards.json'), 'utf8'));
  check('A 届いた一式は13枚', design.cards.length === 13);
  design.cards.forEach((d, i) => {
    const no = String(921 + i);
    const c = db.cards[no];
    check(`A ${no} ${d.name}: 設計書の数字・文・効果のまま`, !!c && c.ready && c.name === d.name && c.kind === d.kind && c.damage === d.damage && c.guts === d.guts && c.text === d.text && J(c.effects) === J(d.effects) && c.user === 'undine', J(c));
    check(`A ${no}: 画面の番号は ◆0${14 + i}`, !!c && c.dispNo === `◆0${14 + i}`);
    for (const size of ['s', 'l']) check(`A ${no}: 画像 ${size}`, fs.existsSync(path.join(GAME, 'images', 'card-battle', size, `${no}.jpg`)));
  });
  const p8 = E.cardPackOf('p8');
  const rar = ['normal', 'kira', 'alt'];
  [['C-921', 'C-U01'], ['C-921S', 'C-U01S'], ['C-921V', 'C-U01V']].forEach(([no, img], i) => {
    const m = db.monsters[no];
    check(`A ${no} ウンディーネ: ライフ6・水中・純血・絵 ${img}`, !!m && m.name === 'ウンディーネ' && m.life === 6 && m.type === 'water' && m.species === 'undine' && !m.main && m.img === img, J(m));
    check(`A ${no}: 第8弾の${rar[i]}から出る`, E.cardPackMonPool(db, p8, rar[i]).includes(no));
  });
  [['C-952', 'C-U02'], ['C-952S', 'C-U02S'], ['C-952V', 'C-U02V']].forEach(([no, img], i) => {
    const m = db.monsters[no];
    check(`A ${no} スネグーラチカ: ライフ6・水中・混血(メイン ウンディーネ・サブ ？？？)・絵 ${img}`, !!m && m.name === 'スネグーラチカ' && m.life === 6 && m.type === 'water' && m.main === 'undine' && m.sub === 'unknown' && m.species === 'hybrid:C-952' && m.ready && m.img === img, J(m));
    check(`A ${no}: 第8弾の${rar[i]}から出る`, E.cardPackMonPool(db, p8, rar[i]).includes(no));
  });
  for (const img of ['C-U01', 'C-U01S', 'C-U01V', 'C-U02', 'C-U02S', 'C-U02V']) for (const size of ['s', 'l']) check(`A 画像 ${size}/${img}`, fs.existsSync(path.join(GAME, 'images', 'card-battle', size, `${img}.jpg`)));
  const techs = E.cardPackTechPool(db, p8);
  check('A 技13枚は第8弾の技などの枠から出る', design.cards.every((_, i) => techs.includes(String(921 + i))), J(techs.length));
  check('A 第8弾の出る割合は 85/12/3 のまま', J(p8.rarity) === J({ normal: 85, kira: 12, alt: 3 }), J(p8.rarity));
}

// 場を作る: 自分(0)= ウンディーネ・スネグーラチカ・ゴースト / 相手(1)= ライガー(地上)・アローヘッド(水中)・ウンディーネ(水中)。
// ガッツは10ずつ。自分の攻める段(ターン2)。相手の番はターン3
const scene = (hand0, hand1 = []) => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: ['C-921', 'C-952', 'C-024'], cards: Array(50).fill('921') }, { monsters: ['C-001', 'C-048', 'C-921'], cards: Array(50).fill('921') }], seed: 11, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.phase = 'main'; st.pending = null; st.active = 0; st.turn = 2; st.first = 0;
  st.players.forEach((pl) => { pl.guts = Array(10).fill('165'); pl.discard = []; pl.mons.forEach((m) => { m.max = 12; m.life = 12; }); });
  st.players[0].hand = hand0.slice();
  st.players[1].hand = hand1.slice();
  return st;
};
// 攻める(guard: 守りの札の手札の番号 / null なら受ける)
const act = (st, p, cardNo, { mon = 0, target = 0, guard = null, gmon = target } = {}) => {
  const hi = st.players[p].hand.indexOf(cardNo);
  let s = E.cardApplyAction(db, st, { type: 'attack', mon, hand: [hi], target: target === null ? null : { p: 1 - p, m: target } });
  if (!s) return null;
  let n = 0;
  while (s && s.pending && n++ < 5) {
    const a = guard === null || s.pending.defender !== 1 - p ? { type: 'pass' } : { type: 'guard', mon: gmon, hand: guard };
    s = E.cardApplyAction(db, s, a);
    if (a.type === 'guard') guard = null; // 守りは1回だけ
  }
  return s;
};
// 相手の番にする(ターン3)
const oppTurn = (st, turn = 3) => { st.active = 1; st.turn = turn; st.phase = 'main'; st.pending = null; st.players[1].mons.forEach((m) => { m.attacks = 0; }); return st; };
const cost = (st, p, cardNo, mi) => { const h = st.players[p].hand.slice(); if (!h.includes(cardNo)) h.push(cardNo); st.players[p].hand = h; return E.cardActionCost(db, st, p, h, [h.indexOf(cardNo)], mi); };

// ---- B ----
{
  let st = act(scene(['923']), 0, '923', { target: 0 });
  check('B アクアウェイブが当たった(ライガーに2ダメージ)', !!st && st.players[1].mons[0].life === 10, J(st && st.players[1].mons[0].life));
  check('B 当てた子に「次の相手のターン +1」の印', !!st && J(st.players[1].mons[0].costUp) === J({ turn: 3, n: 1 }), J(st && st.players[1].mons[0].costUp));
  check('B 当てていない子には印が無い', !!st && !st.players[1].mons[1].costUp && !st.players[1].mons[2].costUp);
  oppTurn(st);
  check('B 次の相手のターン: ライガーのちから技(突き刺し 3)は 4', cost(st, 1, '005', 0) === 4);
  check('B 次の相手のターン: ライガーのかしこさ技(電撃 2)は 3', cost(st, 1, '007', 0) === 3);
  check('B 次の相手のターン: ライガーの特殊技(吠え 3)は増えない', cost(st, 1, '010', 0) === 3);
  check('B 次の相手のターン: ほかの子(アローヘッド)は増えない', E.cardCostUpOf(st, 1, 1) === 0);
  oppTurn(st, 5);
  check('B その次の相手のターンには消えている(電撃 2)', cost(st, 1, '007', 0) === 2);
}

// ---- C ----
{
  let st = act(scene(['923', '923']), 0, '923', { mon: 0, target: 0 });
  st = st && act(st, 0, '923', { mon: 1, target: 0 });
  check('C 2回当てても +1 のまま(重ねがけは大きいほう)', !!st && st.players[1].mons[0].costUp && st.players[1].mons[0].costUp.n === 1, J(st && st.players[1].mons[0].costUp));
  let s2 = act(scene(['929']), 0, '929', { target: null }); // 全体の技は狙いなし
  check('C クリスタルレイン: 当たった3体とも +1', !!s2 && s2.players[1].mons.every((m) => m.costUp && m.costUp.n === 1 && m.costUp.turn === 3), J(s2 && s2.players[1].mons.map((m) => m.costUp)));
}

// ---- D ----
{
  let st = act(scene(['931']), 0, '931', { target: null });
  check('D アクアドームを使えた(ガッツ2を払った)', !!st && st.players[0].guts.length === 8, J(st && st.players[0].guts.length));
  check('D 相手のブリーダーに「次のターン +2」の印', !!st && J(st.players[1].costUpAll) === J({ turn: 3, n: 2 }), J(st && st.players[1].costUpAll));
  oppTurn(st);
  check('D 地上のライガー: 突き刺し 3 → 5', cost(st, 1, '005', 0) === 5);
  check('D 水中のアローヘッド: 増えない', E.cardCostUpOf(st, 1, 1) === 0);
  check('D 水中のウンディーネ: 増えない(アイスブレード 1 のまま)', cost(st, 1, '921', 2) === 1);
  // 水中かは、そのターンで見る(ひきずりこむなどで水中になった子には効かない)
  st.players[1].mons[0].waterUntil = 3;
  check('D そのターンに水中になったライガーには効かない', E.cardCostUpOf(st, 1, 0) === 0);
  // 当てた水牢とは足し合わせる
  let s2 = act(scene(['923', '931']), 0, '923', { mon: 0, target: 0 });
  s2 = s2 && act(s2, 0, '931', { mon: 1, target: null });
  oppTurn(s2);
  check('D 当てた +1 とアクアドームの +2 で +3(電撃 2 → 5)', !!s2 && cost(s2, 1, '007', 0) === 5, J(s2 && E.cardCostUpOf(s2, 1, 0)));
}

// ---- E ----
{
  // 相手のウンディーネ(水中)に水牢 +1 → 相手の番にアイスブレード(1)が 2 になり、こちらの「潜る」(2以上の技を回避・0ガッツ)で回避できる
  let st = act(scene(['923']), 0, '923', { target: 2 });
  oppTurn(st);
  st.players[0].hand = ['932'];
  st.players[1].hand = ['921'];
  const s1 = act(st, 1, '921', { mon: 2, target: 0, guard: 0 });
  check('E 1→2 に上がったアイスブレードは、潜るで回避できる', !!s1 && s1.players[0].mons[0].life === 12 && s1.players[0].discard.includes('932'), J(s1 && { life: s1.players[0].mons[0].life, discard: s1.players[0].discard }));
  let s3 = oppTurn(scene([]));
  s3.players[0].hand = ['932'];
  s3.players[1].hand = ['921'];
  const s4 = act(s3, 1, '921', { mon: 2, target: 0, guard: 0 });
  check('E 水牢が無ければ、アイスブレード(1)は潜るで回避できない', s4 === null || s4.players[0].mons[0].life === 10, J(s4 && s4.players[0].mons[0].life));
  // コンピューターの回避の見込みも、水牢込みの払う数で見る(ミハリ 2026-11-11)
  const pick = (x) => { x.players[0].hand = ['932']; x.players[1].hand = ['921']; return x; };
  const withUp = pick(oppTurn(act(scene(['923']), 0, '923', { target: 2 })));
  const noUp = pick(oppTurn(scene([])));
  const ch = (x) => E.cardAiEvadeChance(db, x, 1, db.cards['921'], { p: 0, m: 0 }, 'master', {}, x.players[1].mons[2]);
  check('E コンピューターの見込み: 水牢で 1→2 のアイスブレードは潜るで回避されうる(水牢なしより高い)', ch(withUp) > ch(noUp), J({ up: ch(withUp), none: ch(noUp) }));
}

// ---- F ----
{
  const s = db.monsters['C-952'];
  const all = Array.from({ length: 13 }, (_, i) => db.cards[String(921 + i)]);
  check('F スネグーラチカ: ウンディーネの技を13枚とも使える', all.every((c) => E.cardUsableBy(c, { ...s, ko: false })), J(all.filter((c) => !E.cardUsableBy(c, { ...s, ko: false })).map((c) => c.no)));
  const m = /const CARD_REPLAY_RULES = (\d+)/.exec(src('src/parts/93-card-replay.jsx'));
  check('F ルールの版は 12 以上(水牢で払うガッツが変わる。古い版の人とマルチで組まない)', !!m && Number(m[1]) >= 12, m && m[1]);
  const ally = src('data/images/images-ally.js');
  // 場の立ち絵は本編の絵(2026-11-11 社長。キュービ・オリヒメと同じ)
  check('F スネグーラチカの立ち絵は本編の SNEGUROCHKA_IMG(番号から引ける)', ['C-952', 'C-952S', 'C-952V'].every((no) => new RegExp(`'${no}': SNEGUROCHKA_IMG`).test(ally)));
  check('F ウンディーネの立ち絵は本編の Undine(CARD_SPECIES_ART)', /undine: 'Undine'/.test(src('src/parts/84-screen-card-battle.jsx')));
}

console.log(`card-undine-check: ${passed} OK / ${fails.length} NG`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); process.exit(1); }
