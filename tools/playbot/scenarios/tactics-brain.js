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
  const bm = bar.match(/^(.*?)\s+(零|近|中|遠)\s+([\d,]+)\s*\/\s*([\d,]+)/);
  const hand = [...document.querySelectorAll('[data-hand-card]')].map((el) => ({
    i: el.getAttribute('data-hand-card'), type: el.getAttribute('data-card-type') || '', cost: Number(el.getAttribute('data-card-cost')) || 0,
    usable: el.getAttribute('data-card-usable') === 'true', block: el.getAttribute('data-card-block') || '',
    discard: el.hasAttribute('data-card-discard'),
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
    over: !action && !hand.length && /GAME OVER|ゲームオーバー|RUN RESULT|ラン終了|ランの結果|最終結果|ALL CLEAR|全WAVE制覇|CHAMPION/.test(text),
    cleared: /ALL CLEAR|全WAVE制覇|CHAMPION|優勝|完全制覇/.test(text), gameOver: /GAME OVER|ゲームオーバー|全滅/.test(text),
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
async function quickTap(s, sel) {
  const b = await boxOf(s, sel);
  if (!b) return false;
  await s.page.mouse.click(b.x, b.y);
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
    if (!c.usable || c.discard || seen.has(c.label) || (skipLabels && skipLabels.has(c.i))) continue;
    seen.add(c.label);
    if (!/atk|unique|guard|debuff/.test(c.type)) { opts.push({ card: c, previews: [] }); continue; }
    const before = await readBoard(s);
    // ★敵の番のすぐあとは、押しても選ばれないことがある。見込みも選ばれた印も出なければ押し直す
    let pv = [];
    let mid = before;
    for (let k = 0; k < 3; k++) {
      if (!(await quickTap(s, `[data-hand-card="${c.i}"]`))) break;
      await s.wait(380 + k * 300);
      pv = await readPreviews(s);
      mid = await readBoard(s);
      if (pv.some((p) => p.dmg > 0 || p.guard > 0) || (mid.picked || 0) > (before.picked || 0) || mid.needsPlace) break;
    }
    // 取り消す(押す前の枚数へ戻るまで)
    for (let k = 0; k < 3; k++) {
      const now = await readBoard(s);
      if ((now.picked || 0) <= (before.picked || 0) && !now.needsPlace) break;
      await quickTap(s, `[data-hand-card="${c.i}"]`);
      await s.wait(320);
    }
    opts.push({ card: c, previews: pv.filter((p) => p.dmg > 0 || p.guard > 0), auto: (mid.picked || 0) > (before.picked || 0) });
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
  atkOpts.sort((a, z) => z.value - a.value);
  // ① とどめ: 残りの行動回数ぶんの上位の見込みで倒せるなら攻撃だけ
  const topSum = atkOpts.slice(0, left).reduce((a, x) => a + x.value, 0) + (ctx.plannedDmg || 0);
  const lethal = b.enemy && topSum >= enemyHp;
  if (!lethal) {
    // ② 守り
    const guardOn = (slot) => guardOpts.filter((g) => g.slot === slot).sort((a, z) => z.value - a.value)[0];
    const needFor = (x) => {
      if (!x.occupied || x.downed || !x.aimDamage || !x.hp) return false;
      const heavy = x.aimDamage >= x.hp.max * 0.25;
      const deadly = x.aimDamage >= x.hp.now * 0.6;
      return heavy || deadly;
    };
    if (threat === 'multi' || threat === 'single' || threat === 'big') {
      const target = b.slots.find((x) => x.aimed);
      const want = threat === 'multi' ? 2 : 1;
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
  if (heal && !ctx.healed && (downed > 0 || (hpMax && hpNow / hpMax < 0.5))) return { kind: 'support', card: heal.card, why: downed ? `倒れた子がいる(回復は倒れた子にも貯まる)` : `全体のライフが${Math.round((hpNow / hpMax) * 100)}%` };
  // ⑤ 攻撃
  if (atkOpts.length) {
    const a = atkOpts[0];
    return { kind: 'attack', card: a.o.card, slot: a.slot, value: a.value, why: lethal ? 'とどめ' : '見込みのダメージがいちばん大きい' };
  }
  // ⑤' 見込みが読めなかった攻撃カード(押しても印が出ない)でも、使えるなら置いてみる
  const blind = opts.find((o) => /atk|unique/.test(o.card.type) && !o.previews.length && !ctx.blindTried);
  if (blind) { ctx.blindTried = true; return { kind: 'attack', card: blind.card, slot: null, value: 0, why: '見込みが読めなかったが使える攻撃カード' }; }
  // ⑥ 支援
  const buff = opts.find((o) => o.card.type === 'buff' && !/自傷/.test(o.card.label));
  if (buff && b.enemy && b.enemy.hp > b.enemy.max * 0.3 && !ctx.buffed) return { kind: 'support', card: buff.card, why: '攻撃が置けないので支援' };
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
  for (const x of b.slots.filter((y) => y.occupied && !y.downed && y.ex && !y.exActive)) {
    const role = exRoleOf(x.name, '');
    const enemyFull = b.enemy && b.enemy.hp >= b.enemy.max * 0.5;
    const gutsLow = x.guts && x.guts.now < x.guts.max * 0.25;
    const hpLow = x.hp && x.hp.now < x.hp.max * 0.4;
    const late = (b.wave || 0) >= 5;
    let why = '';
    if (role === 'shield' && bigHit) why = '重い攻撃の予告(守りのEX)';
    else if (role === 'dodge' && x.aimed && b.enemy && b.enemy.dist === DISTS[x.i] && bigHit) why = '狙われていて、敵と同じ距離(回避のEX)';
    else if (role === 'refill' && (gutsLow || hpLow)) why = gutsLow ? 'ガッツが細った(満タンにするEX)' : 'ライフが細った(満タンにするEX)';
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
  const ctx = { guarded: {}, healed: false, buffed: false, stunned: false, plannedDmg: 0 };
  const limit = Math.max(1, b0.limit || 1);
  const failed = new Set();
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
      // ⑦ ガッツ不足で何も置けない → 重いカードを1枚捨ててガッツを戻す(置けたカードが無いときだけ)
      if (!(b.picked > 0)) {
        const heavy = b.hand.filter((c) => !c.discard).sort((a, z) => z.cost - a.cost)[0];
        if (heavy && await discardCard(s, heavy)) { stats.discards += 1; picks.push({ kind: 'discard', label: heavy.label, why: 'ガッツが足りず置けない' }); }
        for (const x of b.slots.filter((y) => y.occupied && !y.downed)) monOf(mem, x.name).gutsShort += 1;
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
        return press(new RegExp(`^${nm}を起こす`), 'トレーニング(起こす)');
      }
    }
    if (scr.trainingName && !scr.trainingDone && scr.picked < 2) {
      const m = monOf(mem, scr.trainingName);
      const hpRatio = (mem.lastParty || {})[scr.trainingName];
      let plan;
      if (m.aimed >= 2 || (hpRatio != null && hpRatio < 0.5)) plan = ['丸太うけ', '走り込み'];
      else if (m.gutsShort >= 2) plan = ['猛勉強', 'ドミノ倒し'];
      else plan = ['ドミノ倒し', 'ドミノ倒し'];
      const want = plan[scr.picked] || plan[0];
      if (scr.picked === 0) log.note(`トレーニング: ${scr.trainingName} → ${plan.join('・')}(狙われた${m.aimed}回・ガッツ不足${m.gutsShort}回)`);
      if (await press(new RegExp(`^${want}`), 'トレーニング')) { await s.wait(500); return true; }
    }
    return false;
  }
  // 置き場所: 適性のいちばん高い距離
  const placeBtns = scr.buttons.filter((t) => /^(零|近|中|遠)距離\s+[MSABCDEFG]\b/.test(t));
  if (placeBtns.length) {
    const best = placeBtns.sort((a, z) => GRADE.indexOf(a.split(/\s+/)[1]) - GRADE.indexOf(z.split(/\s+/)[1]))[0];
    log.note(`置き場所: ${best.split(/\s+/).slice(0, 2).join(' ')}(適性がいちばん高い距離)`);
    return press(new RegExp(`^${best.split(/\s+/)[0]}`), '置き場所(適性)');
  }
  // 供モン: 総合力のいちばん高い子
  const allyBtns = scr.buttons.filter((t) => /総合力\s*[\d,]+/.test(t));
  if (allyBtns.length && !scr.buttons.some((t) => /^(この供モンを選ぶ|供モン\d*にする)/.test(t))) {
    const best = allyBtns.sort((a, z) => num(z.match(/総合力\s*([\d,]+)/)[1]) - num(a.match(/総合力\s*([\d,]+)/)[1]))[0];
    log.note(`供モン: ${best.split(/\s+/)[0]}(総合力 ${best.match(/総合力\s*([\d,]+)/)[1]})`);
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
    return press(new RegExp(`^${best.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '固有技の強化');
  }
  // アシストカード: 足りないものに合わせる
  if (/アシストカード/.test(scr.title) || scr.buttons.some((t) => /新規習得|強化後/.test(t))) {
    if (scr.buttons.some((t) => /^(習得する|強化する)$/.test(t))) return false;
    const cards = scr.buttons.filter((t) => /アップ|ダウン|回復|ガッツ|倍|軽減|守り/.test(t) && !/話しかける|説明/.test(t));
    if (!cards.length) return false;
    const starved = Object.values(mem.mons).reduce((a, m) => a + m.gutsShort, 0) >= 3;
    const hurt = mem.dmgTakenWave > 0.5;
    const score = (t) => (/自傷/.test(t) ? -5 : 0) + (/攻撃.*アップ|与ダメ/.test(t) ? 3 : 0) + (/回復/.test(t) ? (hurt ? 3.5 : 2) : 0)
      + (/ガッツ/.test(t) ? (starved ? 3.2 : 1.5) : 0) + (/被ダメ|軽減|守り/.test(t) ? (hurt ? 3 : 1.8) : 0);
    const best = cards.sort((a, z) => score(z) - score(a))[0];
    const kind = /自傷/.test(best) ? '' : /攻撃.*アップ|与ダメ/.test(best) ? '火力を伸ばす' : /回復/.test(best) ? (hurt ? '被ダメージが多いので回復' : '回復の手段を持つ') : /ガッツ/.test(best) ? (starved ? 'ガッツ不足が多い' : 'ガッツを補う') : '守りを固める';
    log.note(`アシストカード: ${best.slice(0, 24)}(${kind})`);
    return press(new RegExp(`^${best.slice(0, 8).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), 'アシストカード');
  }
  return false;
}

// ---------- 記録 ----------
// WAVE ごとの残りライフ・倒れた子・決着までのターン・モンスター/EX ごとの貢献を数で残す
function makeLog(meta) {
  const L = { meta, waves: [], ex: [], notes: [], result: null, reason: '' };
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
      const pend = L.ex.filter((e) => e.wave === b.wave && e.turn === b.turn && e.dealt == null);
      for (const e of pend) e.dealt = dealt;
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

module.exports = { readBoard, threatOf, evalHand, decidePick, placePick, playTurn, maybeUseEx, chooseBetween, makeLog, explain, newMemory, monOf, THREAT_JA };
