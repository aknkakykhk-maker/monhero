// タクティクスバトル: 1体ずつライフを持ち、敵の予告に「誰を狙うか」が出るバトルを、人のように手で遊ぶ。
//
// 画面が出している目印だけを読む(判定やゲームの中身には手を入れない):
//   [data-slot-index]           … 距離の枠。狙われている子には data-tactics-aimed="true"
//   [data-tactics-party-slot]   … 1体ずつのライフ(data-tactics-hp="今/最大")・倒れたか(data-tactics-downed)
//   [data-enemy-intent]         … 敵の次の行動(「はり手 🎯モッチー 24」のように、狙いと見込みのダメージ)
//   [data-tactics-aimed-damage] … 狙われている子が受ける見込みのダメージ
//   [data-hand-card]            … 手札。data-card-type(atk / range_atk / unique / guard / buff …)・
//                                  data-card-cost・data-card-usable
//   [data-battle-action]        … 実行
//   ACTION CARDS n/m            … このターンに使える枚数
// カードは押すだけで選ばれる(枠を押す必要はない。枠を押すと、その子の EX スキルの窓が開く)。
//
// 考え方(ふつうのプレイヤーくらい):
//   ・狙われている子が、見込みのダメージで3割より多く削られる・半分を切るなら、守りのカードを先に選ぶ
//   ・残りは攻撃。ガッツが足りる中から重い技を選びやすい。ときどき支援
//   ・ときどき EX スキルを使う(使えるときだけ)

// 入口: モンヒロバトル → タクティクス → モード → 難易度 → 勇者モン・供モン → 距離・アシストカード → WAVE 1
// ★押すものは「その画面にしか無いもの」で選ぶ(とりあえず押せるものを押すと、戻るを踏む)。
//   道筋は tools/battle/lib/tactics-battle-page.js と同じ
async function enterTactics(s, { mode }) {
  const { page, rand } = s;
  await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
  await s.wait(1200);
  await s.dismissOverlays(6);
  await s.inspect();
  const sys = await page.evaluate(() => { const b = document.querySelector('[data-battle-system="systemTactics"]'); if (b && !b.disabled) b.click(); return !!b && !b.disabled; });
  if (!sys) { await s.addIssue('進めない', 'モンヒロバトルの「タクティクス」が押せない'); return false; }
  await s.wait(1300);
  // はじめてタクティクスを開いた人には、導入の会話が流れる
  await s.dismissOverlays(40);
  await s.inspect();
  const opened = await page.evaluate((id) => {
    const cards = [...document.querySelectorAll(`[data-battle-mode="${id}"]`)];
    const card = cards[Math.floor(cards.length / 2)] || cards[0];
    if (!card) return 'no-card';
    card.scrollIntoView({ block: 'center' });
    const b = [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ'));
    if (!b || b.disabled) return 'locked';
    b.click();
    return 'ok';
  }, mode);
  if (opened !== 'ok') return opened;
  await s.wait(1500);
  await s.dismissOverlays(6);
  for (let i = 0; i < 9 && !(await s.tapLabel(/この難易度で挑戦/, 1500)); i++) {
    if (!(await s.tapLabel(/^前の難易度$/, 700))) break;
  }
  await s.inspect();
  // 勇者モン・供モン・距離・アシストカード。勇者モンは毎回ちがう子から選ぶ
  await page.evaluate((n) => { window.__pbPick = n; window.__pbChange = 1; }, Math.floor(rand() * 6));
  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(() => /WAVE 1\/\d+/.test(document.body.innerText) && !!document.querySelector('[data-battle-action]'))) break;
    await s.dismissOverlays(4);
    const step = await page.evaluate(() => {
      const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
      const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
      const go = pick(/出撃|バトル開始|この編成で|この子で挑む|供モン\d*にする|はじめる|^決定$|^確定$/); if (go) { go.click(); return go.textContent.trim(); }
      const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
      const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
      const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
      const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力|^この子で挑む$|^供モン\d+にする$/.test(x.textContent.trim()) && x.textContent.trim() !== '詳細を見る' && !/DEBUG/.test(x.textContent));
      if (mons.length) { const m = mons[window.__pbPick % mons.length]; window.__pbPick += 1; m.click(); return 'mon'; }
      const changes = live.filter((x) => x.textContent.trim() === '変更');
      if (changes.length && window.__pbChange < changes.length) { changes[window.__pbChange].click(); window.__pbChange += 1; return 'change'; }
      return null;
    });
    if (!step) break;
    s.state.step += 1;
    await s.wait(1000);
  }
  await s.inspect();
  return (await page.evaluate(() => !!document.querySelector('[data-battle-action]'))) ? 'ok' : 'stuck';
}

const readTactics = (s) => s.page.evaluate(() => {
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
  const num = (re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
  const frac = (v) => { const m = String(v || '').match(/(\d+)\s*\/\s*(\d+)/); return m ? { now: Number(m[1]), max: Number(m[2]) } : null; };
  const party = [...document.querySelectorAll('[data-tactics-party-slot]')].map((el) => ({
    slot: Number(el.getAttribute('data-tactics-party-slot')), hp: frac(el.getAttribute('data-tactics-hp')),
    downed: el.getAttribute('data-tactics-downed') === 'true',
  }));
  const aimedEl = document.querySelector('[data-slot-index][data-tactics-aimed="true"]');
  const aimedDamage = Number((document.querySelector('[data-tactics-aimed-damage]') || {}).getAttribute?.('data-tactics-aimed-damage')) || 0;
  const hand = [...document.querySelectorAll('[data-hand-card]')].map((el) => ({
    i: el.getAttribute('data-hand-card'), type: el.getAttribute('data-card-type') || '', cost: Number(el.getAttribute('data-card-cost')) || 0,
    usable: el.getAttribute('data-card-usable') === 'true', label: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
  }));
  const action = document.querySelector('[data-battle-action]');
  return {
    wave: num(/WAVE\s*(\d+)\s*\/\s*\d+/), waveMax: num(/WAVE\s*\d+\s*\/\s*(\d+)/), turn: num(/TURN\s*(\d+)\s*\/\s*\d+/),
    picked: num(/ACTION CARDS\s*(\d+)\s*\//i), limit: num(/ACTION CARDS\s*\d+\s*\/\s*(\d+)/i),
    party, aimed: aimedEl ? Number(aimedEl.getAttribute('data-slot-index')) : null, aimedDamage,
    intent: ((document.querySelector('[data-enemy-intent]') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60),
    // ★WAVE の始まりの演出のあいだは実行ボタンの目印が出ない。手札か味方の枠が並んでいればバトルの中
    hand, inBattle: !!action || hand.length > 0 || !!document.querySelector('[data-tactics-party-slot]'), actionEnabled: !!action && !action.disabled, actionPresent: !!action,
    // 実行ボタンの文字。「カードを選ぶ」→(攻撃カードを選ぶと)「置き場所を選ぶ」→「ACTION」と変わる
    needsPlace: /置き場所を選ぶ/.test((action && action.innerText) || ''),
    exPanel: !!document.querySelector('[data-tactics-ex-panel]'),
    over: !action && !hand.length && /GAME OVER|ゲームオーバー|RUN RESULT|ラン終了|ランの結果|最終結果|ALL CLEAR|全WAVE制覇|CHAMPION/.test(text),
  };
});

// 要素の真ん中を、人の指と同じく押す(上に何か重なっていれば、それを押すことになる)
async function tapEl(s, selector, why) {
  const box = await s.page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, label: (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
  }, selector);
  if (!box) return false;
  await s.tap({ ...box, label: box.label || selector }, why);
  return true;
}

// 手札を名前で探して押す。★選んだり引き直したりすると並びが変わるので、番号は押す直前に取り直す
async function tapCard(s, card, why) {
  const i = await s.page.evaluate((label) => {
    // 同じ名前のカードが2枚あることがある(ハイガードなど)。使えるほうを押す
    const same = [...document.querySelectorAll('[data-hand-card]')].filter((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) === label);
    const el = same.find((x) => x.getAttribute('data-card-usable') === 'true') || same[0];
    return el ? el.getAttribute('data-hand-card') : null;
  }, card.label);
  if (i === null) return false;
  return tapEl(s, `[data-hand-card="${i}"]`, why);
}

// 手札を敵側へドラッグして捨てる(行動回数を1つ使い、ガッツが少し戻る。tactics-discard-browser-check.js と同じ動き)
async function discardCard(s, card) {
  const pos = await s.page.evaluate((label) => {
    const el = [...document.querySelectorAll('[data-hand-card]')].find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30) === label);
    const slots = [...document.querySelectorAll('[data-slot-index]')].map((e) => e.getBoundingClientRect());
    if (!el || !slots.length) return null;
    const r = el.getBoundingClientRect();
    const top = Math.min(...slots.map((x) => x.top));
    return { from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, to: { x: innerWidth / 2, y: Math.max(60, top - 60) } };
  }, card.label);
  if (!pos) return false;
  const { mouse } = s.page;
  await mouse.move(pos.from.x, pos.from.y);
  await mouse.down();
  await mouse.move(pos.from.x, pos.from.y - 40, { steps: 4 });
  await mouse.move(pos.to.x, pos.to.y, { steps: 10 });
  await s.wait(250);
  await mouse.up();
  await s.wait(700); // 離した直後のクリックは画面が捨てるので、少し置く
  return true;
}

const closeExPanel = (s) => s.page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-close]'); if (b) b.click(); return !!b; });

// ときどき EX スキルを使う。EX の印がある子の枠を押すと窓が開く。使えなければ閉じる
async function maybeUseEx(s, stats) {
  if (s.rand() > 0.25) return;
  const slots = await s.page.evaluate(() => [...document.querySelectorAll('[data-slot-index]')]
    .filter((el) => !el.disabled && /\bEX\b/.test(el.innerText || '')).map((el) => el.getAttribute('data-slot-index')));
  if (!slots.length) return;
  const slot = slots[Math.floor(s.rand() * slots.length)];
  await tapEl(s, `[data-slot-index="${slot}"]`, 'EX スキルを見る');
  await s.wait(500);
  const can = await s.page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-use]'); return !!b && !b.disabled; });
  if (can) { await tapEl(s, '[data-tactics-ex-use]', 'EX スキルを使う'); stats.exUsed += 1; await s.wait(900); }
  // 選ぶ画面(どの効果にするか)が出たら1つ選ぶ
  const choice = await s.page.evaluate(() => [...document.querySelectorAll('[data-tactics-ex-choices] button')].filter((b) => !b.disabled && !b.hasAttribute('data-tactics-ex-choice-back')).length);
  if (choice) await s.page.evaluate((n) => [...document.querySelectorAll('[data-tactics-ex-choices] button')].filter((b) => !b.disabled && !b.hasAttribute('data-tactics-ex-choice-back'))[n]?.click(), Math.floor(s.rand() * choice));
  await s.wait(500);
  if ((await readTactics(s)).exPanel) await closeExPanel(s);
  await s.wait(400);
}

// このターンに使うカードを選ぶ
async function pickCards(s, st, stats) {
  const target = st.party.find((p) => p.slot === st.aimed);
  const danger = target && target.hp && st.aimedDamage > 0
    && (st.aimedDamage >= target.hp.max * 0.3 || target.hp.now - st.aimedDamage < target.hp.max * 0.5);
  const limit = Math.max(1, st.limit || 1);
  let guarded = false;
  // ★選んだカードをもう一度押すと選択が外れる。このターンに押したものは覚えておいて押さない
  const tapped = new Map(); // カードの名前 → このターンに選んだ枚数
  for (let n = 0; n < limit; n++) {
    const now = await readTactics(s);
    if (Number.isFinite(now.picked) && now.picked >= limit) break;
    const seen = new Map();
    // 同じ名前のカードは、選んだ枚数ぶんだけ候補から外す
    const usable = now.hand.filter((c) => { const n = (seen.get(c.label) || 0) + 1; seen.set(c.label, n); return c.usable && n > (tapped.get(c.label) || 0); });
    if (!usable.length) {
      // 1枚も選べていないのにガッツ不足で何も使えないなら、人と同じく1枚捨ててガッツを戻す
      if (!(now.picked > 0)) {
        const rest = now.hand;
        if (rest.length && await discardCard(s, rest[Math.floor(s.rand() * rest.length)])) stats.discards += 1;
      }
      break;
    }
    let card = null;
    if (danger && !guarded) card = usable.find((c) => c.type === 'guard');
    if (card) { guarded = true; stats.guardsWhenAimed += 1; }
    if (!card) {
      const attacks = usable.filter((c) => /atk|unique/.test(c.type));
      const buffs = usable.filter((c) => c.type === 'buff');
      const pool = attacks.length && (s.rand() < 0.8 || !buffs.length) ? attacks : buffs.length ? buffs : usable;
      // 重い技を選びやすい
      const weight = (c) => 1 + c.cost / 20;
      let r = s.rand() * pool.reduce((a, c) => a + weight(c), 0);
      card = pool[0];
      for (const c of pool) { r -= weight(c); if (r <= 0) { card = c; break; } }
    }
    // ★バトルに入った直後や敵の番のすぐあとは、押しても選ばれないことがある。数が増えなければ押し直す
    const pickedBefore = now.picked || 0;
    let placed = false;
    for (let k = 0; k < 3 && !placed; k++) {
      await tapCard(s, card, `カードを選ぶ(${card.type})`);
      await s.wait(600);
      const sel = await readTactics(s);
      if ((sel.picked || 0) > pickedBefore && !sel.needsPlace) { placed = true; break; }
      // 味方が2体以上いると、攻撃カードは数に入ったあとも「置き場所を選ぶ」(誰が使うか)を決めるまで実行できない。
      // モンスターのいる枠を順に押す(その技を使えない子の枠は押しても置けない)
      if (sel.needsPlace) {
        const slots = await s.page.evaluate(() => [...document.querySelectorAll('[data-slot-index]')]
          .filter((el) => !el.disabled && !/^\S+\s*---/.test((el.innerText || '').trim()) && el.querySelector('img'))
          .map((el) => el.getAttribute('data-slot-index')));
        for (const slot of slots) {
          await tapEl(s, `[data-slot-index="${slot}"]`, '置き場所を選ぶ');
          await s.wait(450);
          const after = await readTactics(s);
          if (after.exPanel) { await closeExPanel(s); await s.wait(300); }
          if ((after.picked || 0) > pickedBefore && !after.needsPlace) { placed = true; break; }
        }
        if (placed) break;
      }
      await s.wait(900);
    }
    if (placed) tapped.set(card.label, (tapped.get(card.label) || 0) + 1);
    else stats.pickFailed += 1;
    if (process.env.PLAYBOT_DEBUG) console.log(`    [タクティクス] T${now.turn} ${card.label} → ${placed ? '選べた' : '選べない'} (${(await readTactics(s)).picked}/${limit})`);
    stats.cards[card.type] = (stats.cards[card.type] || 0) + 1;
    await s.wait(350);
  }
  if (danger) stats.aimedDanger += 1;
  if (danger && !guarded) stats.dangerNoGuard += 1;
}

// WAVE の合間・報酬えらびなど。人と同じく「次へ進む」を押し、選ぶ画面では1つ選ぶ
// 取り消し・やり直しも押さない(押すと同じ画面を行ったり来たりする)
const BACKWARD = /^(キャンセル|閉じる|とじる|戻る|もどる|×)$|話しかける|説明を開く|詳しいルール|あきらめる|降参|取り消す|下げる|選び直す|やり直す|変更せず戻る/;
// 進むボタン。上にあるものほど先に押す(選ぶ画面で1つ選んだあと、確定 → 次の画面へ)
const FORWARD = [/^(この供モンを選ぶ|勇者モンに選ぶ|この子で挑む|供モン\d*にする)/, /^(習得する|強化する|決定する|決定|確定)$/, /^(次へ進む|次のWAVEへ|次へ|進む|バトルへ|出撃|出発|OK|受け取る)/, /^アシストカードへ$/];
async function betweenWaves(s) {
  const pressed = new Map(); // 押しても画面が変わらなかった進むボタン → 回数
  const avoid = new Set();   // 選んでも先へ進めなかった選択肢(人も別のものを選び直す)
  let lastPick = '';
  for (let i = 0; i < 24; i++) {
    const st = await readTactics(s);
    if (st.inBattle) return 'battle';
    if (st.over) return 'over';
    await s.inspect();
    // 確定のボタンは、詳細の窓の下のほう(画面の外)にあることがある(「この供モンを選ぶ」)。
    // 人がスクロールして押すのと同じく、見えるところまで送ってから押す
    const hidden = await s.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => !x.disabled && x.offsetParent
        && /^(この供モンを選ぶ|勇者モンに選ぶ|この子で挑む|供モン\d*にする)$/.test((x.innerText || '').trim()));
      if (!b) return false;
      b.scrollIntoView({ block: 'center' });
      return true;
    });
    if (hidden) await s.wait(400);
    const list = await s.listButtons();
    const go = FORWARD.map((re) => list.find((x) => re.test(x.label))).find(Boolean);
    const options = list.filter((b) => !BACKWARD.test(b.label) && !/^\(無名|^BUTTON$/.test(b.label) && !avoid.has(b.label));
    // 一覧に無い進むボタン(窓が出てくる演出の途中で、上に薄い層が重なっているとき)は、ボタンそのものを押す
    const direct = !go && await s.page.evaluate((sources) => {
      const res = sources.map((src) => new RegExp(src));
      const live = [...document.querySelectorAll('button')].filter((x) => !x.disabled && x.offsetParent);
      for (const re of res) {
        const b = live.find((x) => re.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
        if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return (b.innerText || '').trim().slice(0, 30); }
      }
      return '';
    }, FORWARD.map((re) => re.source));
    if (process.env.PLAYBOT_DEBUG) {
      const dom = await s.page.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => `${x.disabled ? '[x]' : ''}${(x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 24)}`).join(' | '));
      console.log(`    [合間] ${await s.screenName()} 一覧=${list.map((x) => x.label.slice(0, 20)).join(' | ')} 直接=${direct}\n      DOM=${dom.slice(0, 600)}`);
    }
    if (direct) { s.state.step += 1; await s.wait(900); continue; }
    if (go) {
      const n = (pressed.get(go.label) || 0) + 1;
      pressed.set(go.label, n);
      if (n >= 4) {
        // 押しても進まない。人と同じく窓を閉じて、ほかの選択肢を選び直す
        if (lastPick) avoid.add(lastPick);
        pressed.delete(go.label);
        const back = list.find((x) => /^(戻る|もどる|閉じる|とじる|×)$/.test(x.label));
        if (back) await s.tap(back, 'WAVE の合間(選び直す)');
        continue;
      }
      if (n >= 2) {
        // 押しても画面が変わらない。ボタンそのものを押してみる
        await s.page.evaluate((label) => { const b = [...document.querySelectorAll('button')].find((x) => !x.disabled && x.offsetParent && (x.innerText || '').replace(/\s+/g, ' ').trim().startsWith(label.slice(0, 8))); if (b) b.click(); }, go.label);
        await s.wait(900);
      } else {
        await s.tap(go, 'WAVE の合間');
        // 「習得する」「強化する」のあとは NEW CARD! の演出(約1.9秒)が出て、その間も窓が残る。
        // 人と同じく演出が終わるのを待つ(演出中の押し直しは、2026-10-07 からゲームが受け付けない。HISTORY.md)
        if (/^(習得する|強化する)$/.test(go.label)) { await s.wait(2600); pressed.delete(go.label); }
      }
    } else if (options.length) {
      const pick = options[Math.floor(s.rand() * options.length)];
      lastPick = pick.label;
      await s.tap(pick, 'WAVE の合間(えらぶ)');
    }
    else await s.wait(1000);
  }
  await s.addIssue('進めない', 'タクティクスの WAVE の合間から24手押してもバトルへ戻れない');
  return 'stuck';
}

async function tacticsScenario(s, { maxMs = 360000, modes = ['tactics', 'tacticsPro'] } = {}) {
  const stats = { mode: '', entered: false, turns: 0, waveReached: 0, downs: 0, aimedDanger: 0, guardsWhenAimed: 0, dangerNoGuard: 0, exUsed: 0, discards: 0, pickFailed: 0, cards: {}, finished: false };
  let entered = '';
  for (const mode of modes) {
    entered = await enterTactics(s, { mode });
    if (entered === 'ok') { stats.mode = mode; break; }
    await s.backHome();
  }
  if (entered !== 'ok') {
    await s.addIssue('進めない', `タクティクスのバトル画面へ入れなかった(${entered})`);
    return { ok: false, stats, note: `入れなかった(${entered})` };
  }
  stats.entered = true;
  // 登場の演出が終わるまで待つ(終わる前は手札を押しても入らない)
  await s.wait(2500);
  const t0 = Date.now();
  let lastDowned = 0;
  while (Date.now() - t0 < maxMs) {
    s.state.step += 1;
    await s.dismissOverlays(4);
    let st = await readTactics(s);
    if (!st.inBattle) {
      const where = await betweenWaves(s);
      if (where !== 'battle') { stats.finished = where === 'over'; break; }
      st = await readTactics(s);
    }
    if (st.exPanel) await closeExPanel(s);
    // ターンの始め(WAVE の始まりの演出・敵の番の直後)は、実行ボタンが出て手札が押せるようになるまで待つ
    for (let k = 0; k < 16 && !(st.inBattle && st.hand.length && st.hand.some((c) => c.usable) && st.actionPresent); k++) {
      await s.wait(500);
      st = await readTactics(s);
    }
    if (process.env.PLAYBOT_DEBUG) console.log(`    [タクティクス] W${st.wave} T${st.turn} 枚数${st.picked}/${st.limit} 狙い${st.aimed}(${st.aimedDamage}) 手札 ${st.hand.map((c) => `${c.type}${c.usable ? '' : '×'}`).join(' ')}`);
    stats.waveReached = Math.max(stats.waveReached, st.wave || 0);
    const downed = st.party.filter((p) => p.downed).length;
    if (downed > lastDowned) stats.downs += downed - lastDowned;
    lastDowned = downed;
    await maybeUseEx(s, stats);
    await pickCards(s, st, stats);
    // ドラッグ直後のクリックは捨てられることがあるので、少し置いてから実行する
    await s.wait(700);
    const before = await readTactics(s);
    if (!before.actionEnabled) {
      // 手札がどれも使えない(ガッツ切れ)ときは、捨てる操作の代わりに AUTO の1手に頼らず、そのまま待つ
      await s.wait(1500);
      if (!(await readTactics(s)).actionEnabled) { await s.addIssue('反応なし', `タクティクスで実行が押せない(手札 ${before.hand.map((c) => `${c.type}${c.usable ? '' : '×'}`).join(' ')})`); break; }
    }
    await tapEl(s, '[data-battle-action]', 'ACTION');
    stats.turns += 1;
    // 敵の番の演出が終わるまで待つ(ターンか WAVE が動く・バトルの外へ出る)。上限60秒
    let moved = false;
    for (let k = 0; k < 120 && !moved; k++) {
      await s.wait(500);
      const now = await readTactics(s);
      moved = !now.inBattle || now.turn !== before.turn || now.wave !== before.wave;
    }
    await s.inspect();
    if (!moved) { await s.addIssue('進行停止', `タクティクスで実行してから60秒たってもターンが進まない (W${before.wave}/T${before.turn})`); break; }
  }
  const end = await readTactics(s);
  if (end.over) { stats.finished = true; await s.shot('tactics-result'); await s.dismissOverlays(10); await s.inspect(); }
  // 狙われて危ないのに守りを選べなかったことが続くなら、手札の配り方か、ボットの読み違いのどちらか
  if (stats.aimedDanger >= 4 && stats.dangerNoGuard / stats.aimedDanger > 0.75) {
    await s.addIssue('守りが足りない', `狙われて危ないターン ${stats.aimedDanger}回のうち ${stats.dangerNoGuard}回は、使える守りのカードが手札に無かった`);
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  return { ok: true, stats, note: `${stats.mode}・${stats.turns}ターン(${mins}分)で WAVE ${stats.waveReached} まで${stats.finished ? '(決着)' : ''}・倒れた ${stats.downs}回・危ないときに守った ${stats.guardsWhenAimed}/${stats.aimedDanger}回・EX ${stats.exUsed}回・捨てた ${stats.discards}枚` };
}

module.exports = { tacticsScenario };
