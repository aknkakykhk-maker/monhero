// タクティクスくんの「戦い方」(2026-10-09 社長指示「しっかり戦って最後までクリアして…戦い方をちゃんと覚えて、バランス確認や調整提案まで」)。
//
// 画面に出ている目印だけを読み、人がやるのと同じく「カードを押して、枠ごとの見込み(ダメージ・ガード)を見て、
// いちばん良い枠へ置く」を繰り返す。判定やゲームの中身には触らない。決めごとの出どころ:
//   docs/spec/BATTLE_NEW_MODE_PLAN.md(4.5-2 ガードの数え方・4.6 ガッツと行動回数・4.8 トレーニング・5.x 敵の技)
//   docs/spec/TACTICS_EX_LIST.md(EX の回数と中身)・monster-hero/src/parts/32-tactics-units.jsx
//
// 覚えさせた判断(順に見る):
//   ① とどめ   … 見込みの合計で敵を倒しきれるなら、守らずに全部攻撃
//   ② 守り     … 予告の種類で守り方を変える
//                 ・1発(通常・必殺・間合い攻撃): 狙われた子が重く削られる/倒れるなら、その子へガード
//                 ・3連撃: ガードは1ヒットごとに効き、同じ子へ2枚で「連撃ガード」(全ヒットを受ける)→ 2枚
//                 ・全体攻撃: 別々の2体へ1枚ずつで「全体ガード」(構えていない子にも半分付く)
//                 ・貫通撃: ガードが効かない → ガードは置かず、攻撃で早く倒す
//   ③ 止める   … 「ためる」「貫通技準備」のターンに、スタンのカード(あつの挑発)があれば使う(予約が消える)
//   ④ 回復     … 倒れた子がいる・全体のライフが半分を切ったら、回復カード(倒れた子にも貯まる)
//   ⑤ 攻撃     … 使える攻撃カードを1枚ずつ押して枠ごとの見込みダメージを読み、いちばん大きい組み合わせを置く
//                 (同じ子の2枚目は半分になる・距離撃は敵がいない距離だと4割、も見込みの数字に入っている)
//   ⑥ 支援     … 攻撃が置けず、行動回数が余ったら支援(攻撃アップなど)
//   ⑦ 捨てる   … ガッツが足りず何も置けないときは、重いカードを捨ててガッツを戻す(1枚で全員が最大の5%)
//   EX        … 守りの EX は重い攻撃の前に、満タンにする EX はガッツ・ライフが細ったときに、
//                 火力の EX は敵のライフがたっぷり残っているときに使う(1ランの回数が限られるので、早いWAVEでは控える)
//   WAVE の合間 … トレーニングは「狙われて削られた子=丈夫さ・ライフ」「ガッツが足りなかった子=ガッツ」「ほか=ちから」。
//                 倒れた子は、大事な子(ダメージの多い子)か半分以上が倒れているときだけ起こす。
//                 置き場所は距離の適性がいちばん高い枠・供モンは総合力の高い子・固有技はダメージを多く出した子から上げる。
//                 アシストカードは足りないもの(火力・回復・ガッツ)に合わせて選ぶ(自傷のあるものは避ける)

const DISTS = ['零', '近', '中', '遠'];
const num = (v) => Number(String(v || '').replace(/[,\s]/g, '')) || 0;

// ---------- 盤面を読む ----------
const readBoard = (s) => s.page.evaluate(() => {
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
  const n = (re, src = text) => { const m = src.match(re); return m ? Number(String(m[1]).replace(/,/g, '')) : null; };
  const frac = (v) => { const m = String(v || '').match(/(\d+)\s*\/\s*(\d+)/); return m ? { now: Number(m[1]), max: Number(m[2]) } : null; };
  const slots = [...document.querySelectorAll('[data-slot-index]')].map((el) => {
    const i = Number(el.getAttribute('data-slot-index'));
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const party = el.querySelector('[data-tactics-party-slot]') || document.querySelector(`[data-tactics-party-slot="${i}"]`);
    const nm = t.match(/(?:^|\s)(零|近|中|遠)\s+(\S+)/);
    const aimHit = el.querySelector('[data-tactics-aimed-damage]');
    return {
      i, occupied: !!party, name: party && nm && nm[2] !== '---' ? nm[2] : '',
      hp: party ? frac(party.getAttribute('data-tactics-hp')) : null,
      guts: party ? frac(party.getAttribute('data-tactics-guts')) : null,
      downed: party ? party.getAttribute('data-tactics-downed') === 'true' : false,
      aimed: el.getAttribute('data-tactics-aimed') === 'true',
      aimDamage: aimHit ? Number(aimHit.getAttribute('data-tactics-aimed-damage')) || 0 : 0,
      aimParts: aimHit ? aimHit.getAttribute('data-tactics-aimed-parts') || '' : '',
      ex: /\bEX\b/.test(t) && !el.disabled, exOn: el.getAttribute('data-tactics-ex-on') || '',
      exActive: /あと\d+ターン/.test(t) || !!el.getAttribute('data-tactics-ex-on'),
    };
  });
  const barEl = document.querySelector('[data-enemy-bar]');
  const bar = barEl ? (barEl.innerText || '').replace(/\s+/g, ' ').trim() : '';
  // 「メタルナー 遠 ⬆ +10% ▼ 258 / 825」のように、距離とライフのあいだに強化・弱体の印が入ることがある
  const bm = bar.match(/^(.*?)\s+(零|近|中|遠)\s.*?([\d,]+)\s*\/\s*([\d,]+)\s*$/) || bar.match(/^(.*?)\s+(零|近|中|遠)\s.*?([\d,]+)\s*\/\s*([\d,]+)/);
  const hand = [...document.querySelectorAll('[data-hand-card]')].map((el) => ({
    i: el.getAttribute('data-hand-card'), type: el.getAttribute('data-card-type') || '', cost: Number(el.getAttribute('data-card-cost')) || 0,
    usable: el.getAttribute('data-card-usable') === 'true', block: el.getAttribute('data-card-block') || '',
    discard: el.hasAttribute('data-card-discard'),
    // 選び済み(右上のチェック、または置いた子の顔が付く)。もう一度押すと外れてしまうので、見込みを読む対象から外す
    selected: !!el.querySelector('.bg-cyan-400, .bg-indigo-600'),
    label: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
  }));
  const action = document.querySelector('[data-battle-action]');
  return {
    wave: n(/WAVE\s*(\d+)\s*\/\s*\d+/), waveMax: n(/WAVE\s*\d+\s*\/\s*(\d+)/), turn: n(/TURN\s*(\d+)\s*\/\s*\d+/), turnMax: n(/TURN\s*\d+\s*\/\s*(\d+)/),
    picked: n(/ACTION CARDS\s*(\d+)\s*\//i), limit: n(/ACTION CARDS\s*\d+\s*\/\s*(\d+)/i),
    slots, party: slots.filter((x) => x.occupied).map((x) => ({ slot: x.i, hp: x.hp, downed: x.downed })),
    enemyBar: bar.slice(0, 60),
    enemy: bm ? { name: bm[1].trim(), dist: bm[2], hp: Number(bm[3].replace(/,/g, '')), max: Number(bm[4].replace(/,/g, '')) } : null,
    notice: ((document.querySelector('[data-enemy-notice]') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    intent: ((document.querySelector('[data-enemy-intent]') || {}).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    aimed: (slots.find((x) => x.aimed) || {}).i ?? null, aimedDamage: slots.reduce((a, x) => a + x.aimDamage, 0),
    hand, inBattle: !!action || hand.length > 0 || !!document.querySelector('[data-tactics-party-slot]'),
    actionEnabled: !!action && !action.disabled, actionPresent: !!action, actionText: action ? (action.innerText || '').replace(/\s+/g, ' ').trim() : '',
    needsPlace: /置き場所を選ぶ/.test((action && action.innerText) || ''),
    exPanel: !!document.querySelector('[data-tactics-ex-panel]'),
    exPass: (() => { const b = document.querySelector('[data-tactics-ex-pass]'); return !!b && !b.disabled; })(),
    over: !action && !hand.length && /敗\s*北|GAME OVER|ゲームオーバー|RUN RESULT|ラン終了|ランの結果|最終結果|ALL CLEAR|全WAVE制覇|CHAMPION/.test(text) || /敗\s*北/.test(text),
    cleared: /ALL CLEAR|全WAVE制覇|CHAMPION|優勝|完全制覇/.test(text), gameOver: /敗\s*北|GAME OVER|ゲームオーバー|全滅/.test(text),
  };
});

// 予告の種類。右上の吹き出し(data-enemy-notice)と、次の行動(data-enemy-intent)の文字から決める
function threatOf(b) {
  const t = `${b.notice} ${b.intent}`;
  if (/貫通撃！|貫通撃(?!準備)/.test(b.notice) && !/準備/.test(b.notice)) return 'pierce';
  if (/貫通技準備|構え/.test(b.notice)) return 'pierceCharge';
  if (/必殺技準備|ためる/.test(t) && !/必殺技！/.test(b.notice)) return 'charge';
  if (/全体攻撃/.test(t)) return 'all';
  if (/3連撃|連撃/.test(b.notice) || /×\d/.test(b.slots.map((x) => x.aimParts).join(' '))) return 'multi';
  if (/必殺技！/.test(b.notice)) return 'big';
  if (/様子見|移動|回復|攻撃力アップ/.test(b.notice) && !b.aimedDamage) return 'none';
  if (b.aimedDamage > 0) return 'single';
  return 'none';
}

// ---------- 押す ----------
async function boxOf(s, sel) {
  return s.page.evaluate((q) => {
    const el = document.querySelector(q);
    if (!el) return null;
    let r = el.getBoundingClientRect();
    // 画面の外にあると、指(マウス)で押しても届かない。人と同じく見えるところまで送る
    if (r.bottom > innerHeight || r.top < 0) { el.scrollIntoView({ block: 'nearest' }); r = el.getBoundingClientRect(); }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }, sel);
}
// 見込みを読むための押し・取り消しは、記録に残さず素早く押す(人が指で触って確かめるのと同じ)
// ★同じカードを続けて押すときは 0.8秒あける。350ms 以内の2回目は「ダブルタップ=カードの説明を開く」になる
//   (10-core.jsx の CARD_DOUBLE_TAP_MS・60-app.jsx の selectCardAt)。見込みを読んだあとの取り消しが説明を開いてしまい、
//   そのあとのカードが置けなくなっていた(2026-10-09)
const lastTapAt = new Map();
async function quickTap(s, sel) {
  const since = Date.now() - (lastTapAt.get(sel) || 0);
  if (since < 800) await s.wait(800 - since);
  const b = await boxOf(s, sel);
  if (!b) return false;
  await s.page.mouse.click(b.x, b.y);
  lastTapAt.set(sel, Date.now());
  return true;
}

const readPreviews = (s) => s.page.evaluate(() => [...document.querySelectorAll('[data-slot-index]')].map((el) => {
  const d = el.querySelector('[data-tactics-damage-preview]');
  const g = el.querySelector('[data-tactics-guard-preview]');
  return { i: Number(el.getAttribute('data-slot-index')), dmg: d ? Number(d.getAttribute('data-tactics-damage-preview')) || 0 : 0, guard: g ? Number(g.getAttribute('data-tactics-guard-preview')) || 0 : 0 };
}));

// 手札を名前ごとに1枚ずつ押して、枠ごとの見込みを読む。読んだらもう一度押して取り消す
async function evalHand(s, b, skipLabels) {
  const seen = new Set();
  const opts = [];
  for (const c of b.hand) {
    if (!c.usable || c.discard || c.selected || seen.has(c.label) || (skipLabels && skipLabels.has(c.i))) continue;
    seen.add(c.label);
    if (!/atk|unique|guard|debuff/.test(c.type)) { opts.push({ card: c, previews: [] }); continue; }
    const before = await readBoard(s);
    // ★置き済みのカードがあると、その枠には置き済みぶんの合計が出ている。押す前の数字との差で、このカードの見込みを見る
    const base = await readPreviews(s);
    let pv = [];
    let mid = before;
    for (let k = 0; k < 3; k++) {
      if (!(await quickTap(s, `[data-hand-card="${c.i}"]`))) break;
      await s.wait(380 + k * 300);
      pv = await readPreviews(s);
      mid = await readBoard(s);
      if (pv.some((p) => p.dmg > 0 || p.guard > 0) || (mid.picked || 0) > (before.picked || 0) || mid.needsPlace) break;
    }
    // 取り消す(押す前の枚数へ戻るまで)。★押したあと画面へ反映されるまで待ってから確かめる。
    //   すぐ確かめると「まだ選ばれている」と見えて、もう一度押して選び直してしまう
    const stillPicked = async () => { const now = await readBoard(s); return (now.picked || 0) > (before.picked || 0) || now.needsPlace || now.hand.some((h) => h.i === c.i && h.selected); };
    for (let k = 0; k < 2 && await stillPicked(); k++) {
      await quickTap(s, `[data-hand-card="${c.i}"]`);
      await s.wait(700);
      if (await stillPicked()) await s.wait(600);
    }
    const net = pv.map((p) => { const b0 = base.find((x) => x.i === p.i) || { dmg: 0, guard: 0 }; return { i: p.i, dmg: p.dmg !== b0.dmg ? p.dmg : 0, guard: p.guard !== b0.guard ? p.guard : 0 }; });
    let previews = net.filter((p) => p.dmg > 0 || p.guard > 0);
    // ★置ける子が1体だけのときは、押した瞬間にその子へ置かれ、ガードの見込みは枠に出ない(攻撃は出る)。
    //   ガードが「置けない」に見えて、WAVE 1 で一度も守れずに倒れた(2026-10-09 Master)。その子へ置けるものとして扱う
    if (!previews.length && /guard/.test(c.type) && (mid.picked || 0) > (before.picked || 0)) {
      const alive = before.slots.filter((x) => x.occupied && !x.downed);
      if (alive.length === 1) previews = [{ i: alive[0].i, dmg: 0, guard: 1 }];
    }
    opts.push({ card: c, previews, auto: (mid.picked || 0) > (before.picked || 0) });
  }
  return opts;
}

// ---------- 決める ----------
// mem: そのランのあいだ覚えておくこと(子ごとの被弾・ガッツ不足・ダメージ、固有技の持ち主)
function newMemory() {
  return { mons: {}, uniqueOwner: {}, exUsed: {}, dmgTakenWave: 0 };
}
const monOf = (mem, name) => (mem.mons[name] = mem.mons[name] || { dmg: 0, taken: 0, aimed: 0, gutsShort: 0, downs: 0, turns: 0 });

function decidePick(b, opts, ctx) {
  const alive = b.slots.filter((x) => x.occupied && !x.downed);
  const threat = threatOf(b);
  const enemyHp = b.enemy ? b.enemy.hp : Infinity;
  const left = Math.max(0, (b.limit || 1) - (b.picked || 0));
  const atkOpts = [];
  const guardOpts = [];
  for (const o of opts) {
    for (const p of o.previews) {
      if (p.dmg > 0 && /atk|unique|debuff/.test(o.card.type)) atkOpts.push({ o, slot: p.i, value: p.dmg });
      if (p.guard > 0 && /guard/.test(o.card.type)) guardOpts.push({ o, slot: p.i, value: p.guard });
    }
  }
  // ★ガッツは1ターンに最大の5%しか戻らない。払う子のガッツが細っているときは「ガッツ1あたりのダメージ」で選ぶ
  //   (Master の WAVE 4 でガッツ切れが続いて負けた。2026-10-09)。たっぷりあるときは、1手あたりのダメージで選ぶ
  const gutsOf = (slot) => { const x = b.slots.find((y) => y.i === slot); return x && x.guts ? x.guts : null; };
  //   ★カードの種類でガッツ1あたりのダメージが大きく違う(Master の例: 通常技 16ガッツで 1,378 / 固有技 84ガッツで 1,158)。
  //   ガッツが満タン近く(85%以上=戻るぶんが無駄になる)のときだけ1手あたりで選び、それ以外は「ダメージ ÷ ガッツ^0.7」で選ぶ
  for (const a0 of atkOpts) {
    const g = gutsOf(a0.slot);
    const full = !g || !g.max || g.now >= g.max * 0.85;
    a0.rank = full ? a0.value : a0.value / Math.pow(Math.max(8, a0.o.card.cost || 8), 0.7) * 7;
  }
  // ★通常技の段階(倍率)は「敵がいる距離の枠に立っている子の適性」で決まる(BATTLE_NEW_MODE_PLAN.md 4.4)。
  //   敵が誰もいない距離にいるときは、いちばんダメージを出している子の距離の距離撃で引き寄せる(当てたあと敵がその距離へ動く)
  if (b.enemy && ctx.mainDist != null && DISTS[ctx.mainDist] !== b.enemy.dist && !b.slots.some((x) => x.occupied && !x.downed && DISTS[x.i] === b.enemy.dist)) {
    for (const a0 of atkOpts) if (a0.o.card.type === 'range_atk' && new RegExp(`^\\d+\\s*${DISTS[ctx.mainDist]}\\s`).test(a0.o.card.label)) { a0.rank *= 3; a0.pull = true; }
  }
  atkOpts.sort((a, z) => z.rank - a.rank);
  // ① とどめ: 残りの行動回数ぶんの上位の見込みで倒せるなら攻撃だけ
  const topSum = atkOpts.slice(0, left).reduce((a, x) => a + x.value, 0) + (ctx.plannedDmg || 0);
  const lethal = b.enemy && topSum >= enemyHp;
  if (!lethal) {
    // ② 守り
    const guardOn = (slot) => guardOpts.filter((g) => g.slot === slot).sort((a, z) => z.value - a.value)[0];
    // ★ガードは行動回数を1つ使う(=攻撃が1枚減る)。WAVE は20ターンで打ち切り(21ターン目で負け)なので、
    //   守るのは「倒れるのを防ぐ」か「最大ライフの45%以上を削られる」ときだけにする(Master で手数が足りず負けた。2026-10-09)
    const turnsLeft = Math.max(1, (b.turnMax || 20) - (b.turn || 1) + 1);
    const perTurn = ctx.recentDealt || 0;
    const rushing = b.enemy && perTurn > 0 && b.enemy.hp > perTurn * turnsLeft * 0.9;
    const needFor = (x) => {
      if (!x.occupied || x.downed || !x.aimDamage || !x.hp) return false;
      const deadly = x.aimDamage >= x.hp.now * 0.85;
      const heavy = x.aimDamage >= x.hp.max * 0.45;
      // 残りターンで倒しきれない見込みのときは、倒れるのを防ぐときだけ守る
      return rushing ? deadly : (deadly || heavy);
    };
    if (threat === 'multi' || threat === 'single' || threat === 'big') {
      const target = b.slots.find((x) => x.aimed);
      // 3連撃は同じ子へ2枚(連撃ガード)。必殺技も1枚で受けきれないことが多いので、倒れそうなら2枚重ねる
      const want = threat === 'multi' || (threat === 'big' && target && target.hp && target.aimDamage >= target.hp.now) ? 2 : 1;
      if (target && needFor(target) && (ctx.guarded[target.i] || 0) < want) {
        const g = guardOn(target.i);
        if (g) return { kind: 'guard', card: g.o.card, slot: g.slot, value: g.value, why: `${target.name}が${threat === 'multi' ? '3連撃' : threat === 'big' ? '必殺技' : '攻撃'}で${target.aimDamage}削られる予告` };
      }
    }
    if (threat === 'all') {
      const hit = b.slots.filter((x) => needFor(x)).sort((a, z) => z.aimDamage - a.aimDamage);
      const guardedSlots = Object.keys(ctx.guarded).length;
      if ((hit.length || b.aimedDamage > 0) && guardedSlots < 2) {
        const pool = (hit.length ? hit : alive).filter((x) => !ctx.guarded[x.i]);
        for (const x of pool) { const g = guardOn(x.i); if (g) return { kind: 'guard', card: g.o.card, slot: g.slot, value: g.value, why: `全体攻撃。別々の2体で構えると全員に半分のガードが付く` }; }
      }
    }
  }
  // ③ 止める
  if ((threat === 'charge' || threat === 'pierceCharge') && !ctx.stunned) {
    const st = atkOpts.find((a) => a.o.card.type === 'debuff');
    if (st) return { kind: 'attack', card: st.o.card, slot: st.slot, value: st.value, why: `${threat === 'charge' ? '必殺技のため' : '貫通撃の構え'}をスタンで止める`, stun: true };
  }
  // ④ 回復
  const hpNow = alive.reduce((a, x) => a + (x.hp ? x.hp.now : 0), 0);
  const hpMax = b.slots.filter((x) => x.occupied).reduce((a, x) => a + (x.hp ? x.hp.max : 0), 0);
  const downed = b.slots.filter((x) => x.occupied && x.downed).length;
  const heal = opts.find((o) => o.card.type === 'heal');
  if (heal && !ctx.healed && (downed > 0 || (hpMax && hpNow / hpMax < 0.35))) return { kind: 'support', card: heal.card, why: downed ? `倒れた子がいる(回復は倒れた子にも貯まる)` : `全体のライフが${Math.round((hpNow / hpMax) * 100)}%` };
  // ④' あとから出たアシストカード。ガッツや手数を増やすものは、早めに使うほど得
  const richestG = alive.reduce((m, x) => Math.max(m, x.guts && x.guts.max ? x.guts.now / x.guts.max : 0), 0);
  const leanG = alive.some((x) => x.guts && x.guts.max && x.guts.now < x.guts.max * 0.35);
  const named2 = (re) => opts.find((o) => re.test(o.card.label.replace(/^\d+\s*/, '')));
  const kiki = named2(/^きき/), poltz = named2(/^ポルツ/), momo = named2(/^ももすけ/), meloso = named2(/^メロソ/);
  if (momo && leanG && !ctx.healed) return { kind: 'support', card: momo.card, why: 'ガッツが細った子がいる(ももすけ: ガッツ回復)' };
  if (kiki && !ctx.buffed && richestG >= 0.3 && b.enemy && b.enemy.hp > b.enemy.max * 0.3) return { kind: 'support', card: kiki.card, why: '次のターンからカードの上限を増やす(きき)' };
  if (poltz && !ctx.buffed && richestG >= 0.3 && b.enemy && b.enemy.hp > b.enemy.max * 0.4) return { kind: 'support', card: poltz.card, why: '受けるたびにガッツが戻るようにする(ポルツ)' };
  if (meloso && !ctx.healed && (hpMax && hpNow / hpMax < 0.55)) return { kind: 'support', card: meloso.card, why: 'ライフが減っている(メロソ: 回復とガード)' };
  // ⑤ 攻撃。★スタンのカード(あつの挑発など・type debuff)は「ためる」「貫通の構え」のターンまで取っておく。
  //   先に撃つと、必殺技(×2.5)を止められずに倒れる(2026-10-09 Master の WAVE 3)。とどめのときだけは使ってよい
  const keepStun = !lethal && !(threat === 'charge' || threat === 'pierceCharge');
  const atkUse = keepStun ? atkOpts.filter((a) => a.o.card.type !== 'debuff') : atkOpts;
  if (atkUse.length) {
    const a = atkUse[0];
    return { kind: 'attack', card: a.o.card, slot: a.slot, value: a.value, why: lethal ? 'とどめ' : a.pull ? `敵を${DISTS[ctx.mainDist]}距離へ引き寄せる(通常技の段階が上がる)` : '見込みのダメージがいちばん大きい' };
  }
  // ⑤' 見込みが読めなかった攻撃カード(押しても印が出ない)でも、使えるなら置いてみる
  const blind = opts.find((o) => /atk|unique/.test(o.card.type) && !o.previews.length && !ctx.blindTried);
  if (blind) { ctx.blindTried = true; return { kind: 'attack', card: blind.card, slot: null, value: 0, why: '見込みが読めなかったが使える攻撃カード' }; }
  // ⑥' ガードはガッツを使わない。攻撃が置けず行動回数が余ったら、狙われた子(いなければライフのいちばん減った子)へ置く。
  //     1ヒットの攻撃で余ったガードは、構えた子のライフとガッツになる(BATTLE_NEW_MODE_PLAN.md 段階7)
  //     ガッツが足りずに使えないカードがあるときは、ガードより「捨ててガッツを戻す」ほうを先にする(下の⑦)
  const starvedHand = b.hand.some((c) => c.block === 'guts' && !c.discard && !c.selected);
  if (guardOpts.length && threat !== 'pierce' && threat !== 'none' && !starvedHand) {
    const want = b.slots.find((x) => x.aimed && !x.downed) || [...alive].sort((p, q) => (p.hp ? p.hp.now / p.hp.max : 1) - (q.hp ? q.hp.now / q.hp.max : 1))[0];
    const g = want && guardOpts.filter((x) => x.slot === want.i).sort((p, q) => q.value - p.value)[0];
    if (g && (ctx.guarded[want.i] || 0) < 2) return { kind: 'guard', card: g.o.card, slot: g.slot, value: g.value, why: '攻撃が置けないので、ガードを構える(余りはライフとガッツになる)' };
  }
  // ⑥ 支援
  // ★支援は20ガッツかかる。ガッツが細っているとき(いちばん多い子でも6割未満)は使わず、⑦の「捨ててガッツを戻す」へ回す
  const richest = alive.reduce((m, x) => Math.max(m, x.guts && x.guts.max ? x.guts.now / x.guts.max : 0), 0);
  const buff = opts.find((o) => o.card.type === 'buff' && !/自傷/.test(o.card.label));
  if (buff && richest >= 0.6 && b.enemy && b.enemy.hp > b.enemy.max * 0.3 && !ctx.buffed) return { kind: 'support', card: buff.card, why: '攻撃が置けないので支援' };
  return null;
}

// 決めたカードを置く。攻撃・ガードは決めた枠へ、支援・回復はガッツのいちばん多い子に払わせる
async function placePick(s, d) {
  const before = await readBoard(s);
  await quickTap(s, `[data-hand-card="${d.card.i}"]`);
  await s.wait(450);
  let now = await readBoard(s);
  if ((now.picked || 0) > (before.picked || 0) && !now.needsPlace) return true;
  const order = d.slot != null ? [d.slot] : before.slots.filter((x) => x.occupied && !x.downed).sort((a, z) => (z.guts ? z.guts.now : 0) - (a.guts ? a.guts.now : 0)).map((x) => x.i);
  const rest = before.slots.filter((x) => x.occupied && !order.includes(x.i)).map((x) => x.i);
  for (const slot of [...order, ...rest]) {
    await quickTap(s, `[data-slot-index="${slot}"]`);
    await s.wait(380);
    now = await readBoard(s);
    if (now.exPanel) { await s.page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click()); await s.wait(250); }
    if ((now.picked || 0) > (before.picked || 0) && !now.needsPlace) return true;
  }
  // 置けなかった。押したカードを取り消す
  now = await readBoard(s);
  if (process.env.PLAYBOT_DEBUG) console.log(`      [置けない] ${d.card.label} 枚数${before.picked}→${now.picked}/${now.limit} 実行「${now.actionText}」 置き場所待ち${now.needsPlace} 手札 ${now.hand.map((c) => `${c.i}:${c.type}${c.usable ? '' : '×'}`).join(' ')}`);
  if (now.needsPlace) { await quickTap(s, `[data-hand-card="${d.card.i}"]`); await s.wait(300); }
  return false;
}

// ---------- EX ----------
// 名前 → 使い方。表に無い子は、説明の文字で決める
const EX_ROLE = {
  モノリス: 'shield', ユグドラシル: 'shield', ヤオビクニ: 'shield', エイキ: 'dodge', ザン: 'dodge',
  モッチー: 'refill', ミタラシ: 'refill', メロディー: 'refill',
  アーク: 'burst', イブリース: 'burst', メルホイップ: 'burst', クロミー: 'burst', 剣士モッチー: 'burst', ゴーレム: 'skip',
};
function exRoleOf(name, desc) {
  if (EX_ROLE[name]) return EX_ROLE[name];
  if (/かばう|被ダメ|行動しない|無効|守り/.test(desc)) return 'shield';
  if (/回避/.test(desc)) return 'dodge';
  if (/満タン|回復/.test(desc)) return 'refill';
  if (/与ダメ|連撃|力|会心/.test(desc)) return 'burst';
  return 'burst';
}

async function maybeUseEx(s, b, mem, log) {
  const threat = threatOf(b);
  const bigHit = threat === 'big' || threat === 'all' || threat === 'pierce' || (threat === 'multi' && b.aimedDamage > 0)
    || b.slots.some((x) => x.aimDamage && x.hp && x.aimDamage >= x.hp.now * 0.8);
  const aliveCount = b.slots.filter((y) => y.occupied && !y.downed).length;
  for (const x of b.slots.filter((y) => y.occupied && !y.downed && y.ex && !y.exActive)) {
    const role = exRoleOf(x.name, '');
    // かばう EX(モノリス)は、かばう相手がいないと意味がない
    if (role === 'shield' && x.name === 'モノリス' && aliveCount < 2) continue;
    const enemyFull = b.enemy && b.enemy.hp >= b.enemy.max * 0.5;
    const gutsLow = x.guts && x.guts.now < x.guts.max * 0.25;
    const hpLow = x.hp && x.hp.now < x.hp.max * 0.4;
    const late = (b.wave || 0) >= 5;
    let why = '';
    // モノリスの「みんなをかばう」は1ランで10回。かばう子(自分)以外が倒れそうなら使う(打たれ弱いピクシー・ライガーを守る)
    const victim = b.slots.find((y) => y.occupied && !y.downed && y.i !== x.i && y.aimDamage && y.hp && y.aimDamage >= y.hp.now * 0.5);
    if (role === 'shield' && x.name === 'モノリス' && victim && x.hp && x.hp.now > victim.aimDamage * 0.4) why = `${victim.name}が倒れそうなので、モノリスがかばう(守りのEX)`;
    else if (role === 'shield' && bigHit) why = '重い攻撃の予告(守りのEX)';
    else if (role === 'dodge' && x.aimed && b.enemy && b.enemy.dist === DISTS[x.i] && bigHit) why = '狙われていて、敵と同じ距離(回避のEX)';
    // 満タンにする EX は回数が少ない(モッチー3回)。敵がもうすぐ倒れるときは使わない
    // 手強い WAVE(敵のライフが、いまの1ターンのダメージの8倍より多い)の始めは、ガッツが7割を切っていれば先に使う(+30% が5ターン続く)
    else if (role === 'refill' && b.enemy && b.enemy.hp >= b.enemy.max * 0.9 && (b.turn || 1) <= 2 && mem.recentWave && b.enemy.max > mem.recentWave * 8 && x.guts && x.guts.now < x.guts.max * 0.7) why = '手強いWAVEの始め(満タンにして力を上げるEX)';
    else if (role === 'refill' && (gutsLow || hpLow) && (hpLow || (b.enemy && b.enemy.hp >= b.enemy.max * 0.4))) why = gutsLow ? 'ガッツが細った(満タンにするEX)' : 'ライフが細った(満タンにするEX)';
    else if (role === 'burst' && enemyFull && (late || (b.enemy && b.enemy.max >= 3000))) why = '敵のライフがたっぷり残っている(火力のEX)';
    if (!why) continue;
    await quickTap(s, `[data-slot-index="${x.i}"]`);
    await s.wait(500);
    const panel = await s.page.evaluate(() => {
      const p = document.querySelector('[data-tactics-ex-panel]');
      if (!p) return null;
      const t = (q) => ((p.querySelector(q) || {}).innerText || '').replace(/\s+/g, ' ').trim();
      const use = p.querySelector('[data-tactics-ex-use]');
      return { name: t('[data-tactics-ex-name]'), desc: t('[data-tactics-ex-desc]').slice(0, 120), uses: t('[data-tactics-ex-uses]'), why: t('[data-tactics-ex-why]'), ok: !!use && !use.disabled };
    });
    if (!panel) continue;
    // 説明を読み直して、役目が違えば使わない(表に無い子)
    const role2 = exRoleOf(x.name, panel.desc);
    if (role2 !== role && !EX_ROLE[x.name]) { await s.page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click()); await s.wait(300); continue; }
    if (panel.ok) {
      await quickTap(s, '[data-tactics-ex-use]');
      await s.wait(800);
      // 選ぶものがあれば、火力寄りのもの(二刀流など)を先に、無ければ最初の1つ
      await s.page.evaluate(() => {
        const bs = [...document.querySelectorAll('[data-tactics-ex-choices] button')].filter((y) => !y.disabled && !y.hasAttribute('data-tactics-ex-choice-back'));
        const pick = bs.find((y) => /二刀流|攻撃|火力/.test(y.innerText || '')) || bs[0];
        if (pick) pick.click();
      });
      await s.wait(700);
      await s.wait(1200);
      mem.exUsed[panel.name || x.name] = (mem.exUsed[panel.name || x.name] || 0) + 1;
      log.ex({ wave: b.wave, turn: b.turn, mon: x.name, ex: panel.name, why, enemyHp: b.enemy ? b.enemy.hp : null });
    }
    if ((await readBoard(s)).exPanel) { await s.page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click()); await s.wait(300); }
  }
}

// ---------- 1ターン ----------
// カードを選び終えるまで。戻り値は置いたカードの一覧(記録用)
async function playTurn(s, b0, mem, log, stats) {
  const picks = [];
  const top = b0.slots.filter((x) => x.occupied && !x.downed && x.name).sort((p, q) => monOf(mem, q.name).dmg - monOf(mem, p.name).dmg)[0];
  const ctx = { guarded: {}, healed: false, buffed: false, stunned: false, plannedDmg: 0, recentDealt: mem.recentDealt || 0, mainDist: top ? top.i : null };
  const limit = Math.max(1, b0.limit || 1);
  const failed = new Set();
  // ガッツが足りずに使えない攻撃カードがある子を数える(トレーニングの猛勉強・ガッツ系のアシストカード選びに使う)
  const blockedTypes = b0.hand.filter((c) => c.block === 'guts' && /atk|unique/.test(c.type));
  if (blockedTypes.length) for (const x of b0.slots.filter((y) => y.occupied && !y.downed && y.guts && y.guts.now < y.guts.max * 0.35)) monOf(mem, x.name).gutsShort += 1;
  for (let n = 0; n < limit + 2; n++) {
    let b = await readBoard(s);
    if (Number.isFinite(b.picked) && b.picked >= limit) break;
    // EX の演出のあいだなどは、手札が一時的にどれも押せない。押せるようになるまで待つ(最大5秒)
    for (let k = 0; k < 10 && !(b.picked > 0) && !b.hand.some((c) => c.usable); k++) { await s.wait(500); b = await readBoard(s); }
    let opts = await evalHand(s, b, failed);
    let d = decidePick(b, opts, ctx);
    if (!d && !(b.picked > 0) && n === 0) {
      // 何も置けないと出たときは、少し待ってからもう一度だけ読み直す(演出の途中で読んだことがある)
      await s.wait(1500);
      b = await readBoard(s);
      opts = await evalHand(s, b, failed);
      d = decidePick(b, opts, ctx);
    }
    if (!d && process.env.PLAYBOT_DEBUG) {
      const top = await s.page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight - 60); return el ? `${el.tagName}.${String(el.className).slice(0, 60)}` : ''; });
      console.log(`    [判断なし] 敵「${b.enemy ? b.enemy.name : '?'}」 手札 ${b.hand.map((c) => `${c.type}${c.usable ? '' : '×'}${c.block ? `(${c.block})` : ''}`).join(' ')} 候補 ${opts.map((o) => `${o.card.type}:${o.previews.length}`).join(' ')} 失敗 ${[...failed].join(',')} 一番下の要素 ${top} 枚数${b.picked}/${b.limit} 実行「${b.actionText}」`);
    }
    if (!d) {
      // ⑦ 置けるものが無い → 余った行動回数ぶん、ガッツが足りずに使えないカードを捨てる(1枚で全員が最大ガッツの5%戻る)。
      //    置けたカードが無いときは、1枚は必ず捨てる(実行できないため)
      const left = Math.max(0, (b.limit || 1) - (b.picked || 0));
      const blocked = b.hand.filter((c) => !c.discard && !c.selected && (!c.usable || c.block === 'guts')).sort((a, z) => z.cost - a.cost);
      const pool = blocked.length ? blocked : b.hand.filter((c) => !c.discard && !c.selected && !/guard/.test(c.type)).sort((a, z) => z.cost - a.cost);
      const n = Math.min(left, b.picked > 0 ? blocked.length : Math.max(1, blocked.length));
      for (const c of pool.slice(0, n)) {
        if (await discardCard(s, c)) { stats.discards += 1; picks.push({ kind: 'discard', label: c.label, why: 'ガッツが足りず使えないので捨てて、ガッツを戻す' }); }
        if (process.env.PLAYBOT_DEBUG) console.log(`    [判断] W${b.wave} T${b.turn} discard ${c.label} … ガッツが足りず使えないので捨てて、ガッツを戻す`);
      }
      break;
    }
    const ok = await placePick(s, d);
    if (!ok) { failed.add(d.card.i); stats.pickFailed += 1; continue; }
    const owner = d.slot != null ? (b.slots.find((x) => x.i === d.slot) || {}).name : '';
    if (d.card.type === 'unique' && owner) mem.uniqueOwner[d.card.label.replace(/^\d+\s*/, '').replace(/\s*⇄.*$/, '')] = owner;
    if (d.kind === 'guard') { ctx.guarded[d.slot] = (ctx.guarded[d.slot] || 0) + 1; stats.guards += 1; }
    if (d.kind === 'attack') ctx.plannedDmg += d.value || 0;
    if (d.stun) ctx.stunned = true;
    if (d.card.type === 'heal') ctx.healed = true;
    if (d.card.type === 'buff') ctx.buffed = true;
    stats.cards[d.card.type] = (stats.cards[d.card.type] || 0) + 1;
    picks.push({ kind: d.kind, type: d.card.type, label: d.card.label, slot: d.slot, mon: owner, value: d.value || 0, why: d.why });
    if (process.env.PLAYBOT_DEBUG) console.log(`    [判断] W${b.wave} T${b.turn} ${d.kind} ${d.card.label} → ${owner || '-'} (${d.value || '-'}) … ${d.why}`);
  }
  return picks;
}

// 手札を敵側へドラッグして捨てる(行動回数を1つ使い、全員のガッツが最大の5%戻る)
async function discardCard(s, card) {
  const pos = await s.page.evaluate((i) => {
    const el = document.querySelector(`[data-hand-card="${i}"]`);
    const zone = document.querySelector('[data-discard-zone]');
    const slots = [...document.querySelectorAll('[data-slot-index]')].map((e) => e.getBoundingClientRect());
    if (!el || !slots.length) return null;
    const r = el.getBoundingClientRect();
    const top = Math.min(...slots.map((x) => x.top));
    const z = zone ? zone.getBoundingClientRect() : null;
    return { from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, to: z && z.height ? { x: z.left + z.width / 2, y: z.top + z.height / 2 } : { x: innerWidth / 2, y: Math.max(60, top - 60) } };
  }, card.i);
  if (!pos) return false;
  const { mouse } = s.page;
  await mouse.move(pos.from.x, pos.from.y);
  await mouse.down();
  await mouse.move(pos.from.x, pos.from.y - 40, { steps: 4 });
  await mouse.move(pos.to.x, pos.to.y, { steps: 10 });
  await s.wait(250);
  await mouse.up();
  await s.wait(700);
  return true;
}

// ---------- WAVE の合間 ----------
const GRADE = ['M', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
// 画面に合わせて1手だけ選ぶ。選んだら true(あとは呼び出し側の「進む」に任せる)
async function chooseBetween(s, mem, log) {
  const scr = await s.page.evaluate(() => {
    const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
    const lab = (x) => (x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const target = document.querySelector('[data-tactics-training-target]');
    return {
      title: ((document.querySelector('h2') || {}).innerText || '').trim(),
      trainingName: target ? ((target.innerText || '').match(/(\S+)のトレーニング/) || [])[1] || '' : '',
      trainingDone: target ? /全員ぶん決まりました/.test(target.innerText || '') : false,
      // 選んだ数は「1回目の◯◯を取り消す」の札の数で数える(数字の表示は読み違えやすい)
      picked: [...document.querySelectorAll('button[aria-label]')].filter((x) => /^\d+回目の.+を取り消す$/.test(x.getAttribute('aria-label'))).length,
      revive: [...document.querySelectorAll('[data-tactics-training-revive] button')].filter((x) => !x.disabled).map(lab),
      buttons: live.map(lab),
    };
  });
  const press = async (re, why) => {
    const b = (await s.listButtons()).find((x) => re.test(x.label));
    if (!b) return false;
    await s.tap(b, why);
    return true;
  };
  const totalDmg = Object.values(mem.mons).reduce((a, m) => a + m.dmg, 0) || 1;
  // トレーニング
  if (scr.trainingName || scr.revive.length) {
    if (scr.revive.length && !mem.reviveAsked) {
      mem.reviveAsked = true;
      const names = scr.revive.map((t) => (t.match(/^(\S+)を起こす/) || [])[1]).filter(Boolean);
      const alive = Object.keys(mem.lastParty || {}).length;
      const key = names.find((nm) => (monOf(mem, nm).dmg / totalDmg) >= 0.35);
      if (key || names.length * 2 >= alive) {
        const nm = key || names[0];
        log.note(`トレーニング: ${nm}を起こす(${key ? 'ダメージの多い子' : '半分以上が倒れている'})`);
        log.data.build.training.push({ wave: log.data.waves.length, name: nm, picks: ['起こす'] });
        return press(new RegExp(`^${nm}を起こす`), 'トレーニング(起こす)');
      }
    }
    // 同じ合間で同じ子を2回選び終えたら、もう押さない(決定のあとの演出のあいだも、名前の札が残っている)
    const tkey = `${log.data.waves.length}:${scr.trainingName}`;
    mem.trained = mem.trained || {};
    if (scr.trainingName && !scr.trainingDone && scr.picked < 2 && (mem.trained[tkey] || 0) < 2) {
      const m = monOf(mem, scr.trainingName);
      const hpRatio = (mem.lastParty || {})[scr.trainingName];
      // 敵は「ライフの割合が低い子」を狙いやすい(32-tactics-units.jsx)。1体しかいない WAVE 1〜2 は狙われるのが当たり前なので、
      // 狙われた回数ではなく「倒れた・削られた」で守りを上げる。ダメージ役(頭割り以上を出した子)はちからを上げる
      const share = totalDmg > 1 ? m.dmg / totalDmg : 0;
      const members = Math.max(1, Object.keys(mem.lastParty || {}).length);
      // ★伸び方: 走り込み=ライフ+20%・丸太うけ=丈夫さ+20%(ガードの量も丈夫さで決まる)に対して、ドミノ倒し=ちから+5&+5%・猛勉強=ガッツ+5&+5%。
      //   同じ項目を2回選ぶと掛け算で効く。2026-10-09 までダメージ役にドミノ倒しを選び続けて、モッチーのライフが WAVE 5 でも最初の 720 のまま、
      //   敵の1発(1,000〜2,800)で倒れていた。基本は「丸太うけ+走り込み」。ガッツ切れが続く子だけ猛勉強を1つ混ぜる
      let plan = ['丸太うけ', '走り込み'];
      if (m.gutsShort >= 4 && !(hpRatio != null && hpRatio < 0.5)) plan = ['丸太うけ', '猛勉強'];
      const want = plan[scr.picked] || plan[0];
      if (scr.picked === 0 && !mem.trained[tkey]) log.data.build.training.push({ wave: log.data.waves.length, name: scr.trainingName, picks: plan });
      if (scr.picked === 0 && !mem.trained[tkey]) log.note(`トレーニング: ${scr.trainingName} → ${plan.join('・')}(ダメージの割合${Math.round(share * 100)}%・倒れた${m.downs}回・ガッツ不足${m.gutsShort}回)`);
      if (process.env.PLAYBOT_DEBUG) console.log(`      [トレーニング] ${scr.trainingName} 選んだ数${scr.picked} → ${want}`);
      if (await press(new RegExp(`^${want}`), 'トレーニング')) { mem.trained[tkey] = (mem.trained[tkey] || 0) + 1; await s.wait(500); return true; }
    }
    return false;
  }
  // 置き場所: 適性のいちばん高い距離
  const placeBtns = scr.buttons.filter((t) => /^(零|近|中|遠)距離\s+[MSABCDEFG]\b/.test(t));
  if (placeBtns.length) {
    const best = placeBtns.sort((a, z) => GRADE.indexOf(a.split(/\s+/)[1]) - GRADE.indexOf(z.split(/\s+/)[1]))[0];
    log.note(`置き場所: ${best.split(/\s+/).slice(0, 2).join(' ')}(適性がいちばん高い距離)`);
    // 置き場所は押し直せる(1回目で仮に決まり、2回目で動かすことがある)。同じ子は最後の1つだけ残す
    const pl = log.data.build.placements;
    const entry = { wave: log.data.waves.length, name: mem.lastPicked || '', dist: best.split(/\s+/)[0].replace('距離', ''), grade: best.split(/\s+/)[1] };
    if (pl.length && pl[pl.length - 1].name === entry.name && pl[pl.length - 1].wave === entry.wave) pl[pl.length - 1] = entry; else pl.push(entry);
    return press(new RegExp(`^${best.split(/\s+/)[0]}`), '置き場所(適性)');
  }
  // 供モン: 総合力のいちばん高い子
  const allyBtns = scr.buttons.filter((t) => /総合力\s*[\d,]+/.test(t));
  if (allyBtns.length && !scr.buttons.some((t) => /^(この供モンを選ぶ|供モン\d*にする)/.test(t))) {
    // ★敵は「編成の総合力 ÷ 始めの総合力」の0.7乗で強くなる(32-tactics-units.jsx・上限6倍)。総合力が高いだけの子を入れると敵も強くなる。
    //   覚え書きで「実際にダメージを出した子」(頭割り比)を先に、かばう EX(モノリス)は守りの柱として足し、総合力は低いほうを少しよしとする
    const diff = (log.data.meta || {}).difficulty || '';
    const first = !log.data.build.allies.length;
    const scoreAlly = (t) => {
      const nm = t.split(/\s+/)[0];
      const f = first ? firstAllyScore(nm, diff) : null;
      return (f != null ? f + allyScore(nm) * 0.1 : allyScore(nm)) - num(t.match(/総合力\s*([\d,]+)/)[1]) / 4000;
    };
    const best = allyBtns.sort((a, z) => scoreAlly(z) - scoreAlly(a))[0];
    log.note(`供モン: ${best.split(/\s+/)[0]}(総合力 ${best.match(/総合力\s*([\d,]+)/)[1]}・覚え書きの頭割り比 ${allyScore(best.split(/\s+/)[0]).toFixed(2)})`);
    if (!log.data.build.allies.some((x) => x.wave === log.data.waves.length)) log.data.build.allies.push({ wave: log.data.waves.length, name: best.split(/\s+/)[0], power: num(best.match(/総合力\s*([\d,]+)/)[1]) });
    mem.lastPicked = best.split(/\s+/)[0];
    return press(new RegExp(`^${best.split(/\s+/)[0]}\\s+総合力`), '供モン(総合力)');
  }
  // 固有技の強化: ダメージを多く出した子の固有技から上げる
  const ups = scr.buttons.filter((t) => /のレベルを1つ上げる$/.test(t));
  if (ups.length) {
    const ownerDmg = (t) => { const sk = t.replace(/のレベルを1つ上げる$/, ''); const o = mem.uniqueOwner[sk]; return o ? monOf(mem, o).dmg : 0; };
    const best = ups.sort((a, z) => ownerDmg(z) - ownerDmg(a))[0];
    mem.uniqueUps = (mem.uniqueUps || 0) + 1;
    if (mem.uniqueUps > 12) return false;
    log.note(`固有技: ${best.replace(/のレベルを1つ上げる$/, '')}を上げる`);
    log.data.build.uniques.push({ wave: log.data.waves.length, skill: best.replace(/のレベルを1つ上げる$/, '') });
    return press(new RegExp(`^${best.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '固有技の強化');
  }
  // アシストカード: 足りないものに合わせる
  if (/アシストカード/.test(scr.title) || scr.buttons.some((t) => /新規習得|強化後/.test(t))) {
    if (scr.buttons.some((t) => /^(習得する|強化する)$/.test(t))) return false;
    const cards = scr.buttons.filter((t) => /アップ|ダウン|回復|ガッツ|倍|軽減|守り/.test(t) && !/話しかける|説明/.test(t));
    if (!cards.length) return false;
    const starved = Object.values(mem.mons).reduce((a, m) => a + m.gutsShort, 0) >= 3;
    const hurt = mem.dmgTakenWave > 0.5;
    // ★「ガッツ自動回復」は回復(ライフ)ではなくガッツのカード。ライフの回復は「ライフ … 回復」
    const isHeal = (t) => /ライフ[^ガ]*回復|回復・全体/.test(t);
    const isGuts = (t) => /ガッツ/.test(t) && !isHeal(t);
    // 書かれている%で比べる(攻撃 20%アップ > 攻撃 3%アップ)。WAVE は20ターンの打ち切りがあるので火力を重く見る
    const pctOf = (t, re) => { const m = t.match(re); return m ? Number(m[1]) : 0; };
    const atkPct = (t) => pctOf(t, /攻撃\s*(\d+(?:\.\d+)?)%アップ/) + (/攻撃\s*(\d+(?:\.\d+)?)倍/.test(t) && !/自傷/.test(t) ? (pctOf(t, /攻撃\s*(\d+(?:\.\d+)?)倍/) - 1) * 100 : 0);
    // あとから出たアシストカード(2026-10-09 に全部解放で使えるようにした)。ボットが詰まっていた「ガッツ」と「手数」を直接補う
    //   きき=次ターンからカード上限アップ・全体連撃 / ポルツ=受けるたびガッツ回復・自動回復アップ / ももすけ=ガッツ回復・能力永続アップ / メロソ=回復・ガード
    const named = (t) => (/^きき/.test(t) ? 5 : 0) + (/^ポルツ/.test(t) ? (starved ? 5 : 3.5) : 0) + (/^ももすけ/.test(t) ? (starved ? 4.5 : 3) : 0) + (/^メロソ/.test(t) ? (hurt ? 3.5 : 2) : 0);
    const score = (t) => (/自傷/.test(t) ? -5 : 0) + atkPct(t) / 5 + (isHeal(t) ? (hurt ? 3 : 1.5) : 0) + named(t)
      + (isGuts(t) ? (starved ? 3.2 : 1.2) : 0) + (/被ダメ|軽減|守り/.test(t) ? (hurt ? 2.5 : 1) : 0) + (/行動を無効|スタン/.test(t) ? 2.5 : 0);
    const best = cards.sort((a, z) => score(z) - score(a))[0];
    // 理由は、点数にいちばん効いた項目で言う
    const parts = [['火力を伸ばす', atkPct(best) / 5], [hurt ? '被ダメージが多いので回復' : '回復の手段を持つ', isHeal(best) ? (hurt ? 3 : 1.5) : 0],
      [starved ? 'ガッツ不足が多い' : 'ガッツを補う', isGuts(best) ? (starved ? 3.2 : 1.2) : 0], ['守りを固める', /被ダメ|軽減|守り/.test(best) ? (hurt ? 2.5 : 1) : 0],
      ['敵の行動を止める', /行動を無効|スタン/.test(best) ? 2.5 : 0], ['手数とガッツを補う(あとから出たカード)', named(best)]];
    const kind = parts.sort((p, q) => q[1] - p[1])[0][0];
    log.note(`アシストカード: ${best.slice(0, 24)}(${kind})`);
    log.data.build.assists.push({ wave: log.data.waves.length, card: best.split(/\s+/)[0], text: best.slice(0, 40), upgrade: !/新規習得/.test(best) });
    return press(new RegExp(`^${best.slice(0, 8).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'アシストカード');
  }
  return false;
}

// ---------- 記録 ----------
// WAVE ごとの残りライフ・倒れた子・決着までのターン・モンスター/EX ごとの貢献を数で残す
function makeLog(meta) {
  const L = { meta, build: { hero: '', pool: [], allies: [], placements: [], assists: [], training: [], uniques: [] }, waves: [], ex: [], notes: [], result: null, reason: '' };
  let cur = null;
  const api = {
    data: L,
    note: (t) => { L.notes.push({ wave: cur ? cur.wave : 0, t }); if (process.env.PLAYBOT_DEBUG) console.log(`    [合間の判断] ${t}`); },
    ex: (e) => { L.ex.push({ ...e, dealt: null }); if (process.env.PLAYBOT_DEBUG) console.log(`    [EX] W${e.wave} T${e.turn} ${e.mon}「${e.ex}」… ${e.why}`); },
    turn: (b, picks, after) => {
      if (!b.wave) return;
      if (!cur || cur.wave !== b.wave) {
        cur = { wave: b.wave, enemy: b.enemy ? b.enemy.name : '?', enemyMax: b.enemy ? b.enemy.max : 0, turns: 0, threats: {}, guards: 0,
          dealt: 0, taken: 0, healed: 0, downs: 0, byMon: {}, byType: {}, presence: {}, partyMax: 0, startParty: partyOf(b), endParty: null, result: '' };
        L.waves.push(cur);
      }
      cur.turns = Math.max(cur.turns, b.turn || 0);
      for (const x of b.slots.filter((y) => y.occupied && !y.downed)) cur.presence[x.name] = (cur.presence[x.name] || 0) + 1;
      cur.partyMax = Math.max(cur.partyMax, b.slots.filter((x) => x.occupied).reduce((a2, x) => a2 + (x.hp ? x.hp.max : 0), 0));
      const th = threatOf(b); cur.threats[th] = (cur.threats[th] || 0) + 1;
      const planned = picks.filter((p) => p.kind === 'attack').reduce((a, p) => a + p.value, 0) || 1;
      const enemyAfter = after && after.enemy && after.wave === b.wave ? after.enemy.hp : 0;
      const dealt = b.enemy ? Math.max(0, b.enemy.hp - enemyAfter) : 0;
      cur.dealt += dealt;
      for (const p of picks) {
        if (p.kind === 'guard') cur.guards += 1;
        cur.byType[p.type || p.kind] = (cur.byType[p.type || p.kind] || 0) + 1;
        if (p.kind === 'attack' && p.mon) cur.byMon[p.mon] = (cur.byMon[p.mon] || 0) + Math.round(dealt * (p.value / planned));
      }
      // EX の効き目: 使ったターンから3ターンぶんのダメージを足す(多くの EX は3〜5ターン続く)
      for (const e of L.ex.filter((x) => x.wave === b.wave && b.turn >= x.turn && b.turn < x.turn + 3)) {
        e.dealtSum = (e.dealtSum || 0) + dealt; e.turnsCounted = (e.turnsCounted || 0) + 1;
        if (b.turn === e.turn) e.dealt = dealt;
      }
      if (after && after.wave === b.wave) {
        const before = sumHp(b), now = sumHp(after);
        if (now < before) cur.taken += before - now; else cur.healed += now - before;
        const d0 = b.slots.filter((x) => x.occupied && x.downed).length, d1 = after.slots.filter((x) => x.occupied && x.downed).length;
        if (d1 > d0) cur.downs += d1 - d0;
      }
      if (after) cur.endParty = partyOf(after.wave === b.wave ? after : b);
    },
    waveEnd: (result) => { if (cur && !cur.result) cur.result = result; },
    finish: (result, reason) => { L.result = result; L.reason = reason; if (cur && !cur.result) cur.result = result === 'clear' ? 'clear' : result; },
  };
  return api;
}
const partyOf = (b) => b.slots.filter((x) => x.occupied).map((x) => ({ name: x.name, hp: x.hp ? x.hp.now : 0, max: x.hp ? x.hp.max : 0, downed: x.downed }));
const sumHp = (b) => b.slots.filter((x) => x.occupied).reduce((a, x) => a + (x.hp ? x.hp.now : 0), 0);

// 勝てた/負けた理由を、記録から1〜3行で言う
function explain(L) {
  const lines = [];
  const last = L.waves[L.waves.length - 1];
  if (L.result === 'clear') {
    const slow = [...L.waves].sort((a, z) => z.turns - a.turns)[0];
    lines.push(`全${L.waves.length}WAVEをクリア。合計${L.waves.reduce((a, w) => a + w.turns, 0)}ターン、倒れた子はのべ${L.waves.reduce((a, w) => a + w.downs, 0)}回`);
    if (slow) lines.push(`いちばん長引いたのは WAVE ${slow.wave}(${slow.enemy})の${slow.turns}ターン`);
  } else if (last) {
    const th = Object.entries(last.threats).sort((a, z) => z[1] - a[1]).map(([k, v]) => `${THREAT_JA[k] || k}${v}`).join('・');
    const how = L.result === 'timeout' ? 'ターン切れ' : L.result === 'wipe' ? '全員倒れた' : '途中で止まった';
    lines.push(`WAVE ${last.wave}(${last.enemy})で${how}。このWAVEの予告: ${th}`);
    const dmgShare = last.enemyMax ? Math.round((last.dealt / last.enemyMax) * 100) : 0;
    lines.push(`敵のライフを${dmgShare}%削った。受けたダメージ ${last.taken}・ガード ${last.guards}枚`);
  }
  if (L.reason) lines.push(L.reason);
  return lines;
}
const THREAT_JA = { none: '様子見など', single: '1発', big: '必殺技', multi: '3連撃', all: '全体攻撃', pierce: '貫通撃', pierceCharge: '貫通の構え', charge: 'ためる' };

// ---------- 覚え書き(どの編成・どのアシストカードで、どこまで行けたか) ----------
// 2026-10-09 社長「どのモンスターを使ったとか、どのアシカを使ったとか、そのへんを覚えてもらわないとバランス調整なんてできない」。
// 1回ごとの結果を tools/playbot/tactics-knowledge.json に積み、次の勇者モン・供モン選びに使う。
// 成績のよい子を先に選びつつ、試した回数の少ない子も少しずつ試す(試さないと、よいかどうかが分からない)
const path = require('path');
const fs = require('fs');
const KNOWLEDGE = path.resolve(__dirname, '..', 'tactics-knowledge.json');
const BASE_NAMES = ['モッチー', 'スエゾー', 'ゴーレム', 'ライガー', 'ハム', 'ピクシー', 'モノリス', 'オボロゲソウ'];
const DIFF_ORDER = ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell', 'Legend'];
function loadKnowledge() {
  try { const k = JSON.parse(fs.readFileSync(KNOWLEDGE, 'utf8')); if (Array.isArray(k.runs)) return k; } catch (e) { /* 無ければ空から */ }
  return { note: 'タクティクスくんの覚え書き。tools/playbot/scenarios/tactics-brain.js が1回ごとに足す。消してよい(覚え直す)。★タクティクスプロはベースモンだけを使うので、セーブ(育ち)に関係なく全員が同じ条件。勝ち負けを分けるのは戦い方・編成・アシストカードの選び方だけ', runs: [] };
}
// 1回の出来: 着いたWAVE(10で1.0)+クリアで1。倒れた回数で少し引く
const runValue = (r) => (r.wave || 0) / 10 + (r.result === 'clear' ? 1 : 0) - Math.min(0.3, (r.downs || 0) * 0.03);
function scoreNames(k, difficulty, role) {
  const d0 = DIFF_ORDER.indexOf(difficulty);
  const acc = {};
  for (const r of k.runs) {
    // 同じ難易度は1、近い難易度ほど重く数える(下の難易度でクリアした子は、上でも勇者モンの候補になる)
    const gap = d0 >= 0 ? Math.abs(DIFF_ORDER.indexOf(r.difficulty) - d0) : 9;
    const w = gap === 0 ? 1 : gap === 1 ? 0.6 : gap === 2 ? 0.45 : 0.25;
    const names = role === 'hero' ? [r.hero] : (r.pool || []);
    for (const nm of names.filter(Boolean)) { acc[nm] = acc[nm] || { v: 0, w: 0, n: 0 }; acc[nm].v += runValue(r) * w; acc[nm].w += w; acc[nm].n += 1; }
  }
  return acc;
}
// 勇者モン → 供モン5体の順に並べた名前の一覧(画面にある名前を上から順に選ぶ)
// roster: ゲームから読んだ全モンスター(すべて解放のときは全種が選べる)。試していない子の見込みは、能力から決める:
//   勇者モン=1体で戦う WAVE 1〜2 を持ちこたえる打たれ強さ(ライフ×丈夫さ)、供モン=ちから
function preferredOrder(difficulty, rand, roster) {
  const k = loadKnowledge();
  const mons = roster && Array.isArray(roster.monsters) ? roster.monsters.filter((m) => !m.debugOnly && m.name) : [];
  const names = [...new Set([...(mons.length ? mons.map((m) => m.name) : BASE_NAMES), ...k.runs.flatMap((r) => [r.hero, ...(r.pool || [])]).filter(Boolean)])];
  const statOf = (nm) => mons.find((m) => m.name === nm);
  // 勇者モンは1体で WAVE 1〜2 を倒しきる必要があるので「打たれ強さ×ちから」で見る(打たれ強いだけのモノリスは火力が足りなかった)
  const heroVal = (m) => Math.sqrt((m.hp || 0) * (m.def || 0)) * (m.atk || 0);
  const maxTank = Math.max(1, ...mons.map(heroVal));
  const maxAtk = Math.max(1, ...mons.map((m) => m.atk || 0));
  // ★Expert 以上で、試していない子を勇者モンにすると、1体で戦う WAVE 1〜2 で倒れることが多い
  //   (2026-10-09 Master: ライフ 250 のピクシー・400 のライガーが WAVE 1〜2 で負けた)。
  //   難しい難易度ほど「知っている、成績のよい子」を選び、試すのは供モンの候補と、やさしい難易度で行う
  const hard = DIFF_ORDER.indexOf(difficulty) >= DIFF_ORDER.indexOf('Expert');
  const rank = (role) => {
    const sc = scoreNames(k, difficulty, role);
    const strict = hard && role === 'hero';
    // 平均の出来 + 試した回数が少ないほど足す(よく知らない子も試す)
    return names.map((nm) => {
      const x = sc[nm];
      const st = statOf(nm);
      const guess = st ? (role === 'hero' ? heroVal(st) / maxTank : (st.atk || 0) / maxAtk) : 0.5;
      const mean = x && x.w ? x.v / x.w : (strict ? 0.1 + 0.4 * guess : 0.9 + 0.6 * guess);
      return { nm, v: mean + (strict ? 0.05 : 0.35) / Math.sqrt((x ? x.n : 0) + 1) + rand() * (strict ? 0.05 : 0.15) };
    }).sort((a, z) => z.v - a.v).map((x) => x.nm);
  };
  const hero = rank('hero')[0];
  let allies = rank('ally').filter((nm) => nm !== hero);
  if (hard) allies = allies.map((nm, i) => ({ nm, v: allyScore(nm) - i * 0.05 })).sort((a, z) => z.v - a.v).map((x) => x.nm);
  return { hero, order: [hero, ...allies], knownRuns: k.runs.length };
}
// 供モンの見込み: 覚え書きの「その子のダメージ ÷ 頭割り」の平均(記録が無ければ 1.0)。モノリスはかばう EX があるので +0.8
// 同じ難易度で「その子を最初の供モンにした回」がどこまで行けたか(着いた WAVE ÷ 5)。WAVE 3〜4 の2体の時間がいちばん苦しいので、
// ここを持ちこたえられる子を選ぶ(2026-10-09 Master: モノリス・ハムは WAVE 5 まで、ライガーは2回とも WAVE 3 で負けた)
function firstAllyScore(name, difficulty) {
  const rs = loadKnowledge().runs.filter((r) => r.difficulty === difficulty && (r.allies || [])[0] === name);
  if (!rs.length) return null;
  return rs.reduce((a, r) => a + (r.wave || 0) + (r.result === 'clear' ? 5 : 0), 0) / rs.length / 5;
}
function allyScore(name) {
  const k = loadKnowledge();
  const rel = [];
  for (const r of k.runs) {
    const d = r.dmg || {};
    const members = Object.keys(d);
    const total = Object.values(d).reduce((a, x) => a + x, 0);
    if (!members.includes(name) || !total || members.length < 2) continue;
    rel.push(d[name] / (total / members.length));
  }
  const base = rel.length ? rel.reduce((a, x) => a + x, 0) / rel.length : 1;
  return base + (name === 'モノリス' ? 0.8 : 0);
}
// 全モンスター・全アシストカード・全 EX の一覧を tools/playbot/tactics-roster.json に書く(人が読む一覧。ゲームのデータから毎回作り直す)
const ROSTER = path.resolve(__dirname, '..', 'tactics-roster.json');
function saveRoster(roster) {
  try {
    const body = { note: 'タクティクスくんがゲームのデータ(ALL_PLAYER_MONSTERS・TEACHING_CARDS・TACTICS_EX_SKILLS)から読んだ一覧。ボットが動くたびに作り直す', ...roster };
    const text = `${JSON.stringify(body, null, 1)}\n`;
    if (!fs.existsSync(ROSTER) || fs.readFileSync(ROSTER, 'utf8') !== text) fs.writeFileSync(ROSTER, text);
  } catch (e) { /* 書けなくても戦える */ }
}
function rememberRun(L, stats) {
  if (process.env.PLAYBOT_TACTICS_LEARN === '0') return;
  const k = loadKnowledge();
  const dmg = {};
  for (const w of L.waves) for (const [m, d] of Object.entries(w.byMon || {})) dmg[m] = (dmg[m] || 0) + d;
  k.runs.push({
    at: new Date().toISOString().slice(0, 16), mode: L.meta.mode, difficulty: L.meta.difficulty, hero: L.build.hero, pool: L.build.pool,
    allies: L.build.allies.map((a) => a.name), placements: L.build.placements.map((p) => `${p.name || '?'}:${p.dist}${p.grade}`),
    assists: L.build.assists.map((a) => `${a.card}${a.upgrade ? '+' : ''}`), ex: Object.entries(L.ex.reduce((o, e) => { o[e.ex || e.mon] = (o[e.ex || e.mon] || 0) + 1; return o; }, {})).map(([n, c]) => `${n}×${c}`),
    result: L.result, wave: stats.waveReached, turns: L.waves.reduce((a, w) => a + w.turns, 0), downs: L.waves.reduce((a, w) => a + w.downs, 0),
    lostAt: L.result === 'clear' ? null : (L.waves[L.waves.length - 1] || {}).enemy || null, dmg: Object.fromEntries(Object.entries(dmg).map(([m, d]) => [m, Math.round(d)])),
  });
  // 増えすぎないよう、新しい 300 回ぶんだけ持つ
  k.runs = k.runs.slice(-300);
  fs.writeFileSync(KNOWLEDGE, `${JSON.stringify(k, null, 1)}\n`);
}

module.exports = { saveRoster, preferredOrder, rememberRun, readBoard, threatOf, evalHand, decidePick, placePick, playTurn, maybeUseEx, chooseBetween, makeLog, explain, newMemory, monOf, THREAT_JA };
