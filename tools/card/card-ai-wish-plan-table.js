// MFバトルカード: 遊ぶ人の提案の型(攻め・守り・ふつう)を、どの助手のどの顔なら寄せてよいかの表を作る(2026-11-08 部長「A で」)。
//   目安: 社長が決めた強さの目安(EXPERT・MASTER で、その助手の今の組み方の勝率 ±10点)に、両方の強さで入る型だけ寄せてよい。
//   入らない組み合わせは型を寄せず、名前だけ使う(83 の cardAiWishPlanOk)。
//
//   node tools/card/card-ai-wish-plan-table.js [--who mua,kiki] [--write]
//     --write … 83-card-ai-deck.jsx の CARD_AI_WISH_PLAN_OK(<<< と >>> の間)を書き直す。無ければ表を出すだけ
//     --jobs 4 … 並べて走らせる数(既定 4。助手ごとに分ける)
//
// 測り方: プレイヤー役=スターター3つ(くせの無い考え方 kyuko・同じ強さ)。今の組み方は1組300戦。
//   提案の型は、まず1組100戦で測り、ずれが 5点以内か 18点以上ならそこで決める(はっきりしている)。あいだのときだけ 300戦まで測る。
//   主役・振り分け・型が同じになる顔(よそいき・本音の多く)は1回だけ測る。
//   1回で 4並べて 30分〜1時間ほど(カードや助手が増えたら作り直す。検査 card-ai-deck-check の W が「表がそろっているか」を見る)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fork } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const P83 = path.join(GAME, 'src', 'parts', '83-card-ai-deck.jsx');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LEVELS = ['expert', 'master'];
const PLANS = ['attack', 'guard', 'normal'];
const SLOTS = ['oshi', 'suki', 'yoso', 'honne'];
const LIMIT = 10;

const load = () => {
  const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date });
  vm.runInContext(`${src('data/card-battle-cards.js')}\n;${src('src/parts/82-card-battle-core.jsx')}\n;${src('src/parts/82-card-tactics-core.jsx')}\n;${src('src/parts/83-card-ai-deck.jsx')}\n;`
    + 'this.E={CARD_BATTLE_DATA,CARD_AI_FACES,CARD_AI_FACE_NOISE,cardAiFaceSpec,cardAiFaceBuild,cardAiBuildDeck,cardSimulate,cardAiPolicy,cardAiSeededRand,cardAiStyleOf};', ctx);
  return ctx.E;
};

// 1人ぶんを測る(子の作業)
const measure = (who) => {
  const E = load();
  const db = E.CARD_BATTLE_DATA;
  const kits = Object.keys(db.starters);
  const rate = (lv, mk, from, to) => {
    let win = 0, n = 0;
    for (const k of kits) for (let g = from; g < to; g++) {
      const rr = E.cardAiSeededRand(`wish:${who}:${lv}:${k}:${g}`);
      const mine = mk(rr, E.cardAiBuildDeck(db, k));
      const st = E.cardSimulate(db, { decks: [mine, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(who, lv, { sameBlood: !!mine.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 50000 + g * 7 + kits.indexOf(k), first: g % 2 });
      if (st.winner === 0) win += 1;
      n += 1;
    }
    return { win, n };
  };
  const base = {};
  for (const lv of LEVELS) { const r = rate(lv, (rr, pd) => E.cardAiBuildDeck(db, who, lv, rr, { playerDeck: pd }), 0, 100); base[lv] = (r.win / r.n) * 100; }
  const seen = {};
  const out = { who, base: Object.fromEntries(LEVELS.map((lv) => [lv, Math.round(base[lv] * 10) / 10])), rates: {}, ok: {} };
  for (const sl of SLOTS) {
    const spec = E.cardAiFaceSpec(db, who, sl);
    out.ok[sl] = [];
    for (const plan of PLANS) {
      let allOk = true;
      for (const lv of LEVELS) {
        const nz = (((E.CARD_AI_FACE_NOISE[who] || {})[sl] || {})[lv]) || 0;
        const key = JSON.stringify([spec.lead, spec.avoid, spec.keep, spec.free, nz, plan, lv]);
        let pct = seen[key];
        if (pct === undefined) {
          const mk = (rr, pd) => E.cardAiFaceBuild(db, who, sl, lv, rr, { playerDeck: pd }, null, plan);
          let r = rate(lv, mk, 0, 34);
          let d = Math.abs((r.win / r.n) * 100 - base[lv]);
          if (d > 5 && d < 18) { const r2 = rate(lv, mk, 34, 100); r = { win: r.win + r2.win, n: r.n + r2.n }; }
          pct = (r.win / r.n) * 100;
          seen[key] = pct;
        }
        out.rates[`${sl}:${plan}:${lv}`] = Math.round(pct * 10) / 10;
        // 境目(ちょうど10点)で小数の誤差に左右されないよう、表に残す数(小数第1位)でくらべる
        if (Math.abs(Math.round(pct * 10) / 10 - Math.round(base[lv] * 10) / 10) > LIMIT + 1e-9) allOk = false;
      }
      if (allOk) out.ok[sl].push(plan);
    }
  }
  return out;
};

if (process.env.WISH_CHILD) {
  process.send(measure(process.env.WISH_CHILD));
  process.exit(0);
}

(async () => {
  const E = load();
  const who = (opt('--who', '') || Object.keys(E.CARD_AI_FACES).join(',')).split(',').filter((w) => E.CARD_AI_FACES[w]);
  const jobs = Math.max(1, Number(opt('--jobs', 4)) || 4);
  const results = [];
  const queue = who.slice();
  const run = () => new Promise((resolve) => {
    const next = () => {
      const w = queue.shift();
      if (!w) { resolve(); return; }
      const c = fork(__filename, [], { env: { ...process.env, WISH_CHILD: w } });
      c.on('message', (m) => { results.push(m); console.log(`${m.who}: 今 ${JSON.stringify(m.base)} / 寄せてよい ${JSON.stringify(m.ok)}`); });
      c.on('exit', next);
    };
    next();
  });
  await Promise.all([...Array(Math.min(jobs, who.length))].map(run));
  results.sort((a, b) => who.indexOf(a.who) - who.indexOf(b.who));
  const lines = results.map((m) => `  ${m.who}: { ${SLOTS.map((sl) => `${sl}: [${m.ok[sl].map((p) => `'${p}'`).join(', ')}]`).join(', ')} },`);
  const table = `const CARD_AI_WISH_PLAN_OK = Object.freeze({\n${lines.join('\n')}\n});`;
  fs.writeFileSync(path.join(ROOT, 'docs', 'progress', 'card-ai-faces', 'wish-plan-rates.json'), `${JSON.stringify(results, null, 1)}\n`);
  if (args.includes('--write')) {
    const s = fs.readFileSync(P83, 'utf8');
    const a = s.indexOf('// <<< CARD_AI_WISH_PLAN_OK');
    const b = s.indexOf('// >>> CARD_AI_WISH_PLAN_OK');
    if (a < 0 || b < 0) { console.error('83 に CARD_AI_WISH_PLAN_OK の印(<<< >>>)がありません'); process.exit(1); }
    const head = s.slice(0, s.indexOf('\n', a) + 1);
    fs.writeFileSync(P83, `${head}${table}\n${s.slice(b)}`);
    console.log('83 の CARD_AI_WISH_PLAN_OK を書き直しました');
  } else console.log(table);
})();
