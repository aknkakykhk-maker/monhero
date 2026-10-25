// MFバトルカード: 助手の手を外のAI(Claude Haiku 5.5)に選ばせて試合を回す(2026-10-25 統括部長の依頼・試し。本番のゲームには組み込まない)
// プレイヤー側は今のAI(HARD・くせの無い kyuko・スターターのデッキ)。助手側は、攻撃の手・守りの返事・札を選ぶ段のたびに
// Edge Function(supabase/functions/card-ai-trial)へ聞く。ガッツにする札・捨てる札・後攻の最初のガッツは今のAIのまま(組み合わせが多いため)。
// 呼んだ回数が上限に届いたら、そのあとは今のAIで最後まで打つ(勝敗は出す)。
//
// 使い方:
//   CARD_AI_TRIAL_URL=<関数のURL> CARD_AI_TRIAL_TOKEN=<合言葉> node tools/card/card-ai-trial.js [--who mua] [--effort low|medium]
//     [--games 1] [--max-calls 80] [--kit speed|powerful|miracle] [--seed 1] [--out <フォルダ>]
//   node tools/card/card-ai-trial.js --fake   … 偽物の Claude で道具の流れだけ確かめる(API を叩かない・docs に書かない)
// 結果: docs/progress/card-battle/ai-trial/README.md の表に1行足し、1試合目の読める記録を game-*.md に書く
// ★URL と合言葉は環境変数からだけ読む。ファイル・ログ・記録には書かない
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const FN_DIR = path.join(ROOT, 'supabase', 'functions', 'card-ai-trial');
const DOC_DIR = path.join(ROOT, 'docs', 'progress', 'card-battle', 'ai-trial');

const load = () => {
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
  const src = `${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAiBuildDeck, cardAiPolicy, cardAiChooseAction, cardAiScoreAttack, cardAiFillBind, cardAttackOptions, cardGuardOptions, cardDecider, cardMonType, cardRngNext };';
  vm.runInContext(src, ctx, { filename: '82-card-battle-core.jsx' });
  return ctx.E;
};

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fake = args.includes('--fake');
const who = opt('--who', 'mua');
const effort = opt('--effort', 'low');
const games = Math.max(1, Number(opt('--games', 1)) || 1);
const maxCalls = Math.max(1, Number(opt('--max-calls', 80)) || 80);
const kit = opt('--kit', 'speed');
const seed0 = Number(opt('--seed', 1)) || 1;
const outDir = opt('--out', fake ? path.join(os.tmpdir(), 'card-ai-trial') : DOC_DIR);
const LEVEL = 'hard';
const MAX_MOVES = 40; // 一覧が長いときは、今のAIの点の高い順に残す(core.js の上限 60 より少なく)
const NET_TIMEOUT_MS = 15000; // 通信ごと止まったとき用。Haiku の待ち時間(8秒)は関数の側で切る

const E = load();
const db = E.CARD_BATTLE_DATA;
if (!E.cardAiPolicy(who, LEVEL) || !db.starters[kit]) { console.error('--who / --kit が違います'); process.exit(1); }
const NAME = { mua: 'みゅあ', momosuke: 'ももすけ', kiki: 'きき', kyuko: 'きゅうこ', dra: 'ドラ', atsu: 'あつ' };
// 助手のくせ(CARD_AI_HABITS の数字を言葉にしたもの)
const PERSONA = {
  mua: '攻めるのが大好き。守りの札はあまり残さず、ガッツも貯めずにどんどん攻撃する。',
  momosuke: '相手の邪魔をするのが好き。手札を捨てさせる・攻撃できなくする技を好んで使う。ガッツは少し残す。',
  kiki: 'ガッツを貯めて、大きいダメージの技で一気に倒すのが好き。小さい技は控えめ。',
  kyuko: 'くせは無い。とどめを刺せるときは逃さない。',
  dra: '守りが固い。守りの札を手元に残し、攻撃は控えめ。',
  atsu: '相手全員に当たる技が大好き。とどめを刺せるときは必ず刺す。',
};
const KIND = { pow: 'ちから', int: 'かしこさ', spe: '特殊', dge: '回避', blk: '防御' };
const TYPE = { ground: '地上', air: '空中', water: '水中' };
const speciesName = {};
Object.values(db.monsters).forEach((m) => { if (!m.main && !speciesName[m.species]) speciesName[m.species] = m.name; });
const userName = (u) => (u === 'any' ? '全モンスター' : u === 'breeder' ? 'ブリーダー' : speciesName[u] || u);
const card = (no) => db.cards[no] || null;
const cname = (no) => (card(no) ? card(no).name : '(裏)');

// 試合に出てくる札の説明(試合のあいだ変わらない。番号順にそろえてキャッシュが効くようにする)
const cardsText = (decks) => {
  const nos = [...new Set(decks.flatMap((d) => d.cards))].sort();
  const mons = [...new Set(decks.flatMap((d) => d.monsters))].sort();
  const lines = mons.map((no) => { const m = db.monsters[no]; return `${m.name}(${userName(m.species)}${m.main ? `・メイン${userName(m.main)}/サブ${userName(m.sub)}` : ''}) ${TYPE[m.type] || m.type} ライフ${m.life}`; });
  lines.push('');
  nos.forEach((no) => {
    const c = card(no); if (!c) return;
    lines.push(`「${c.name}」${KIND[c.kind] || c.kind}・${userName(c.user)}・ガッツ${c.guts ?? 0}${Number.isFinite(c.damage) ? `・ダメージ${c.damage}` : ''}: ${c.text}${c.note ? `(補足: ${c.note})` : ''}`);
  });
  return lines.join('\n');
};

const monLine = (st, m) => {
  if (m.ko) return `${m.name}: 倒れた`;
  const marks = [];
  if (m.stunTurn === st.turn) marks.push('このターン攻撃できない');
  if (m.attacks) marks.push('このターンもう攻撃した');
  if (m.cocoon) marks.push('まゆ');
  if (m.mult) marks.push(`次のちから技${m.mult.n}倍`);
  return `${m.name}: ライフ${m.life}/${m.max}・${TYPE[E.cardMonType(m, st.turn)] || ''}${marks.length ? `・${marks.join('・')}` : ''}`;
};
// いまの場面(助手=p から見たもの。相手の手札は見せない)
const stateText = (st, p) => {
  const me = st.players[p], op = st.players[1 - p];
  const lines = [`ターン${st.turn}・${st.active === p ? 'あなたの番' : '相手の番'}`];
  lines.push(`あなた: ガッツ${me.guts.length}・山札${me.deck.length}・捨て札${me.discard.length}`);
  me.mons.forEach((m) => lines.push(`  ${monLine(st, m)}`));
  lines.push(`  手札: ${me.hand.map(cname).join('、') || 'なし'}`);
  lines.push(`相手: ガッツ${op.guts.length}・山札${op.deck.length}・手札${op.hand.length}枚・捨て札${op.discard.length}`);
  op.mons.forEach((m) => lines.push(`  ${monLine(st, m)}`));
  if (op.discard.length) lines.push(`  相手の捨て札: ${op.discard.map(cname).join('、')}`);
  const pd = st.pending;
  if (pd && pd.defender === p) {
    const tg = pd.targets[pd.ti];
    const tm = st.players[tg.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tg.m];
    const am = pd.mon >= 0 ? op.mons[pd.mon].name : 'ブリーダー';
    lines.push(`いま: 相手の${am}の「${cname(pd.main)}」が、あなたの${tm.name}を狙っている(ダメージ ${Math.max(0, pd.base * pd.mult - pd.reduce)}${pd.evaded ? '・回避ずみ' : ''}${pd.targets.length > 1 ? `・${pd.targets.length}体のうち${pd.ti + 1}体目` : ''})。守るか、守らないかを選ぶ。`);
  }
  if (st.pendingChoice && st.pendingChoice.p === p) lines.push(`いま: 「${cname(st.pendingChoice.card)}」の効果で、札を1枚選ぶ。`);
  return lines.join('\n');
};

const moveText = (st, p, o) => {
  const me = st.players[p], op = st.players[1 - p];
  if (o.type === 'endAttacks') return '攻撃を終える(ガッツの段へ)';
  if (o.type === 'pass') return '守らない';
  if (o.type === 'choose') {
    const ch = st.pendingChoice; const list = ch.then === 'oppDiscard' ? op.hand : ch.src === 'hand' ? me.hand : me.discard;
    return `「${cname(list[o.pick])}」を選ぶ`;
  }
  if (o.type === 'guard') {
    const m = me.mons[o.mon];
    return `${m.name}が「${cname(me.hand[o.hand])}」で守る${o.to !== undefined ? `(目標を${me.mons[o.to].name}へ移す)` : ''}`;
  }
  const by = o.type === 'breeder' || o.mon < 0 ? 'ブリーダー' : me.mons[o.mon].name;
  const tgt = o.target ? (o.target.p === p ? `味方の${me.mons[o.target.m].name}` : `相手の${op.mons[o.target.m].name}`) : '';
  const ex = [];
  if (o.form) ex.push(`${TYPE[o.form]}になる`);
  if (o.split) ex.push(`割り振り ${o.split.map((n, j) => `${op.mons[j].name}${n}`).join('・')}`);
  if (o.fuse) ex.push(`${me.mons[o.fuse.a].name}と${me.mons[o.fuse.b].name}で${db.monsters[o.fuse.no].name}に合体`);
  if (o.to !== undefined) ex.push(`移す先 ${me.mons[o.to].name}`);
  return `${by}が「${o.hand.map((i) => cname(me.hand[i])).join('」+「')}」${tgt ? ` → ${tgt}` : ''}${ex.length ? `(${ex.join('・')})` : ''}`;
};

const sameMove = (a, b) => { const k = (o) => JSON.stringify({ ...o, bind: undefined }); return k(a) === k(b); };

// 聞く手の一覧と、今のAIが選ぶ手の番号
const askList = (st, p, policy, rand) => {
  let list;
  if (st.pendingChoice) list = st.pendingChoice.cands.map((i) => ({ type: 'choose', pick: i }));
  else if (st.pending) list = [...E.cardGuardOptions(db, st), { type: 'pass' }];
  else {
    let opts = E.cardAttackOptions(db, st);
    if (opts.length > MAX_MOVES - 1) opts = opts.map((o) => ({ o, s: E.cardAiScoreAttack(db, st, o, policy) })).sort((a, b) => b.s - a.s).slice(0, MAX_MOVES - 1).map((x) => x.o);
    list = [...opts, { type: 'endAttacks' }];
  }
  const mine = E.cardAiChooseAction(db, st, policy, rand);
  let fb = list.findIndex((o) => sameMove(o, mine));
  if (fb < 0) fb = list.length - 1; // 今のAIの手が一覧から外れた(点の低い手)ときは、終える/守らない
  return { list, fallback: fb, mine };
};

// ---- 関数を呼ぶ口(本物は fetch・偽物は core.js へ偽の Claude を渡す) ----
const makeCaller = async () => {
  if (fake) {
    const core = await import(path.join(FN_DIR, 'core.js'));
    let k = 0;
    const client = { messages: { create: async (req) => {
      k += 1;
      const n = (req.messages[0].content.match(/^\d+: /gm) || []).length;
      if (k % 7 === 0) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'わからない' }], usage: { input_tokens: 10, output_tokens: 5 } };
      return { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '(偽物)一覧の先頭寄りを選ぶ' }, { type: 'text', text: `{"pick": ${k % Math.max(1, Math.min(n, 3))}, "reason": "偽物の答え"}` }], usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: k > 1 ? 3000 : 0, cache_creation_input_tokens: k > 1 ? 0 : 3000 } };
    } } };
    return async (body) => { const r = await core.handleRequest({ method: 'POST', token: 'fake-local-token', bodyText: JSON.stringify(body) }, { client, expectedToken: 'fake-local-token' }); return r.status === 200 ? r.body : { error: r.body.error }; };
  }
  const url = process.env.CARD_AI_TRIAL_URL, token = process.env.CARD_AI_TRIAL_TOKEN;
  if (!url || !token) { console.error('CARD_AI_TRIAL_URL と CARD_AI_TRIAL_TOKEN を環境変数で渡してください(または --fake)'); process.exit(1); }
  return async (body) => {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), NET_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-trial-token': token }, body: JSON.stringify(body), signal: ac.signal });
      const j = await res.json().catch(() => ({}));
      return res.ok ? j : { error: `http_${res.status}${j && j.error ? `_${j.error}` : ''}` };
    } catch (e) { return { error: e && e.name === 'AbortError' ? 'net_timeout' : 'net_error' }; } finally { clearTimeout(timer); }
  };
};

const playGame = async (call, g) => {
  const seed = seed0 + g;
  const aiSide = g % 2; // 先攻・後攻を入れかえる(1試合なら助手が先攻)
  const decks = [];
  decks[aiSide] = E.cardAiBuildDeck(db, who, LEVEL);
  decks[1 - aiSide] = E.cardAiBuildDeck(db, kit);
  let st = E.cardCreateGame(db, { decks, seed, first: 0, names: aiSide === 0 ? [NAME[who], 'プレイヤー役'] : ['プレイヤー役', NAME[who]] });
  const policies = [];
  policies[aiSide] = E.cardAiPolicy(who, LEVEL);
  policies[1 - aiSide] = E.cardAiPolicy('kyuko', LEVEL);
  let s = (seed * 7919) >>> 0;
  const rand = () => { const n = E.cardRngNext(s); s = n.s; return n.v; };
  const cards = cardsText(decks);
  const calls = [];
  for (let i = 0; i < 4000 && st.winner === null; i++) {
    const side = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : E.cardDecider(st);
    let act;
    const askable = side === aiSide && !st.pendingDiscard && !st.pendingReveal && st.phase !== 'setup' && (st.pendingChoice || st.pending || st.phase === 'main');
    const ask = askable && calls.length < maxCalls ? askList(st, aiSide, policies[aiSide], rand) : null;
    if (ask && ask.list.length === 1) act = ask.list[0]; // 選びようが無い(守れる札が無い など)ときは聞かない
    else if (ask) {
      const { list, fallback } = ask;
      const t0 = Date.now();
      if (process.env.CARD_AI_TRIAL_DUMP && !calls.length) console.log(`\n${stateText(st, aiSide)}\n${list.map((x, j) => `${j}: ${moveText(st, aiSide, x)}`).join('\n')}\n札の説明 ${cards.length}字`);
      const r = await call({ state: stateText(st, aiSide), moves: list.map((o) => moveText(st, aiSide, o)), cards, persona: PERSONA[who], fallback, effort });
      const rtt = Date.now() - t0;
      const ok = !r.error && Number.isInteger(r.pick) && r.pick >= 0 && r.pick < list.length;
      const pick = ok ? r.pick : fallback;
      const kind = st.pendingChoice ? '選ぶ' : st.pending ? '守り' : '攻撃';
      calls.push({ turn: st.turn, kind, n: list.length, pick, fallbackPick: fallback, same: pick === fallback, move: moveText(st, aiSide, list[pick]),
        reason: ok ? r.reason : '', thinking: ok ? r.thinking : '', replaced: !ok || !!r.fallback, why: r.error || r.why || null,
        ms: ok ? r.ms : null, rtt, usage: ok ? r.usage : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } });
      act = list[pick];
      if (act.hand && act.type !== 'guard') act = E.cardAiFillBind(db, st, act, policies[aiSide]);
      process.stdout.write(`\r  ${calls.length}回 `);
    } else act = E.cardAiChooseAction(db, st, policies[side], rand);
    const next = E.cardApplyAction(db, st, act);
    if (!next) { const fb = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; st = E.cardApplyAction(db, st, fb) || st; if (!fb) break; } else st = next;
  }
  process.stdout.write('\n');
  return { seed, aiSide, st, calls, win: st.winner === aiSide, capped: calls.length >= maxCalls };
};

const fmtMs = (n) => (Number.isFinite(n) ? `${(n / 1000).toFixed(1)}秒` : '-');
const gameLog = (gm) => {
  const L = [`# 試し試合の記録(${NAME[who]}・effort ${effort}${fake ? '・偽物' : ''})`, '',
    `- 助手: ${NAME[who]}(${gm.aiSide === 0 ? '先攻' : '後攻'})/ プレイヤー役: 今のAI HARD・スターター「${db.starters[kit].name}」`,
    `- 結果: ${gm.st.winner === null ? '決着つかず' : gm.win ? '助手の勝ち' : '助手の負け'}(ターン${gm.st.turn}${gm.st.reason ? `・${gm.st.reason}` : ''})`,
    `- 外のAIに聞いた回数: ${gm.calls.length}${gm.capped ? `(上限${maxCalls}回に届いたので、そのあとは今のAI)` : ''}`,
    `- 「今のAIと同じ手」: ${gm.calls.filter((c) => c.same).length}回 / 置きかえ: ${gm.calls.filter((c) => c.replaced).length}回`, '',
    '時間は「Haiku の考えた時間 / 往復」。置きかえ = 遅れ・答えが読めない などで今のAIの手を使ったもの', ''];
  gm.calls.forEach((c, i) => {
    L.push(`## ${i + 1}. ターン${c.turn}・${c.kind}(候補${c.n})`);
    L.push(`- 選んだ手: ${c.pick}「${c.move}」${c.same ? '(今のAIと同じ)' : `(今のAIは ${c.fallbackPick})`}${c.replaced ? ` **置きかえ: ${c.why}**` : ''}`);
    if (c.reason) L.push(`- 理由: ${c.reason}`);
    L.push(`- 時間: ${fmtMs(c.ms)} / ${fmtMs(c.rtt)}・トークン 入${c.usage.input} 出${c.usage.output} キャッシュ読${c.usage.cacheRead} 書${c.usage.cacheWrite}`);
    if (c.thinking) L.push(`- 考えた中身: ${c.thinking.replace(/\s+/g, ' ')}`);
    L.push('');
  });
  L.push('## 試合の流れ(ゲームの記録・最後の60行)', '', '```', ...gm.st.log.slice(-60).map((x) => x.text), '```', '');
  return L.join('\n');
};

const TABLE_HEAD = '| 日時 | 助手 | effort | 試合 | 呼んだ回数/試合 | 平均 | 最長 | 置きかえ | 今のAIと同じ手 | 勝敗 | トークン 入/出/キャッシュ読 | 記録 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const README_HEAD = `# 助手の手を外のAI(Claude Haiku 5.5)に選ばせる試し

統括部長の依頼(2026-10-25)。**試しだけで、本番のゲームには組み込まない。**

- 関数: \`supabase/functions/card-ai-trial/\`(中身は core.js・入口は index.ts)。鍵と合言葉は Supabase の Secrets にだけ置く
- 道具: \`node tools/card/card-ai-trial.js\`(使い方は先頭の説明)。URL と合言葉は環境変数で渡す
- プレイヤー側は今のAI(HARD)。助手側は、攻撃の手・守りの返事・札を選ぶ段のたびに関数へ聞く(ガッツにする札などは今のAI)
- 時間は Haiku が考えた時間(関数の中で測ったもの)。8秒を過ぎた・答えが読めない・失敗したときは今のAIの手に置きかえる

## 結果

<!-- trial-rows -->
${TABLE_HEAD}
`;

(async () => {
  const call = await makeCaller();
  const results = [];
  for (let g = 0; g < games; g++) { results.push(await playGame(call, g)); }
  const all = results.flatMap((r) => r.calls);
  const ms = all.map((c) => c.ms).filter(Number.isFinite);
  const sum = (k) => all.reduce((a, c) => a + (c.usage[k] || 0), 0);
  const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  const file = `game-${stamp.replace(/[-: ]/g, '').slice(0, 12)}-${who}-${effort}${fake ? '-fake' : ''}.md`;
  const row = `| ${stamp} | ${NAME[who]} | ${effort} | ${games} | ${(all.length / games).toFixed(1)} | ${fmtMs(ms.reduce((a, b) => a + b, 0) / (ms.length || 1))} | ${fmtMs(Math.max(0, ...ms))} | ${all.filter((c) => c.replaced).length} | ${all.filter((c) => c.same).length}/${all.length} | ${results.filter((r) => r.win).length}勝${results.filter((r) => !r.win).length}敗 | ${sum('input')}/${sum('output')}/${sum('cacheRead')} | [記録](${file}) |`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, file), gameLog(results[0]));
  const readme = path.join(outDir, 'README.md');
  const cur = fs.existsSync(readme) ? fs.readFileSync(readme, 'utf8') : README_HEAD;
  fs.writeFileSync(readme, `${cur.replace(/\n*$/, '\n')}${row}\n`);
  console.log(TABLE_HEAD.split('\n')[0]);
  console.log(row);
  console.log(`置きかえの理由: ${JSON.stringify(all.filter((c) => c.replaced).reduce((a, c) => { a[c.why] = (a[c.why] || 0) + 1; return a; }, {}))}`);
  console.log(`書いた場所: ${path.relative(ROOT, outDir) || outDir}/${file}`);
})();
