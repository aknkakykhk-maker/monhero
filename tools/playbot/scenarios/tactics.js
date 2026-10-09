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
async function enterTactics(s, { mode, difficulty = 'keep', stats = {}, ctx = null }) {
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
  // 'max' のときは、いちばん奥の難易度まで送ってから、挑戦できるところまで戻る
  if (difficulty === 'max') {
    for (let k = 0; k < 20; k++) {
      const moved = await page.evaluate(() => { const b = document.querySelector('button[aria-label="次の難易度"]'); if (!b || b.disabled) return false; b.click(); return true; });
      if (!moved) break;
      await s.wait(250);
    }
  }
  // ★難易度の札(article[data-difficulty-card])は全部の難易度ぶん並んでいて、どの札にも「この難易度で挑戦」がある。
  //   文字で探して押すと、いつも先頭の Beginner を押してしまう(2026-10-09 まで、ずっと Beginner で戦っていた)。
  //   いま選んでいる札(class に on)の中のボタンを押す。押せなければ(まだ開いていない)1つ前へ戻る
  for (let i = 0; i < 20; i++) {
    const r = await page.evaluate(() => {
      const card = document.querySelector('article[data-difficulty-card].on') || document.querySelector('article[data-difficulty-card]');
      if (!card) return { none: true };
      const go = [...card.querySelectorAll('button')].find((x) => /この難易度で挑戦/.test(x.innerText || ''));
      if (!go || go.disabled) return { key: card.getAttribute('data-difficulty-card'), locked: true };
      go.scrollIntoView({ block: 'center' });
      go.click();
      return { key: card.getAttribute('data-difficulty-card') };
    });
    if (r.none) { if (await s.tapLabel(/この難易度で挑戦/, 1500)) break; }
    if (r.key) stats.difficulty = r.key;
    if (!r.locked && !r.none) { await s.wait(1500); break; }
    if (!(await s.tapLabel(/^前の難易度$/, 700))) break;
  }
  await s.inspect();
  // 勇者モン・供モン・距離・アシストカード。勇者モンは毎回ちがう子から選ぶ
  // --hero で指定があれば、その子たちを勇者モン・供モンの順に先に選ぶ(名前は本体のデータから引く)
  const wantIds = String(process.env.PLAYBOT_HERO_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  await page.evaluate(([n, ids]) => {
    window.__pbPick = n; window.__pbChange = 1;
    // eslint-disable-next-line no-undef
    window.__pbWant = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ids.map((id) => ALL_PLAYER_MONSTERS[id] && ALL_PLAYER_MONSTERS[id].name).filter(Boolean) : [];
  }, [Math.floor(rand() * 6), wantIds]);
  // --hero の指定が無ければ、覚え書き(tactics-knowledge.json)の成績から勇者モン・供モンの順を決める
  if (!wantIds.length && ctx) {
    const pref = brain.preferredOrder(stats.difficulty || '', rand);
    await page.evaluate((names) => { window.__pbWant = names; }, pref.order);
    ctx.log.note(`編成の順(覚え書き ${pref.knownRuns}回ぶんから): ${pref.order.join('・')}`);
  }
  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(() => /WAVE 1\/\d+/.test(document.body.innerText) && !!document.querySelector('[data-battle-action]'))) break;
    await s.dismissOverlays(4);
    if (process.env.PLAYBOT_DEBUG) {
      const dom = await page.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => `${x.disabled ? '[x]' : ''}${(x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)}`).join(' | '));
      console.log(`    [入口] ${await s.screenName()} ${(await page.evaluate(() => ((document.querySelector('h2,h1') || {}).innerText || '').trim().slice(0, 30)))}\n      DOM=${dom.slice(0, 1500)}`);
    }
    // 置き場所(適性)・アシストカード(足りないもの)は、戦い方の判断で選ぶ
    if (ctx && await brain.chooseBetween(s, ctx.mem, ctx.log)) { s.state.step += 1; await s.wait(900); continue; }
    const scrName = await s.screenName();
    const step = await page.evaluate(() => {
      const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
      const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
      // ★勇者モン・供モンの画面は、はじめから誰かが選ばれていて「この子で挑む」「供モンNにする」が押せる。
      //   先に決定を押すと、選びたい子ではなく前回の子・一覧の先頭の子になる。選びたい子が画面にいれば、先にその子を押す
      const monsEarly = live.filter((x) => /ライフ\s*\d+ちから|総合力|^この子で挑む$|^供モン\d+にする$/.test(x.textContent.trim()) && x.textContent.trim() !== '詳細を見る' && !/DEBUG/.test(x.textContent));
      const wantBtnEarly = (name) => live.find((x) => x.textContent.trim().replace(/^前回/, '') === name) || monsEarly.find((x) => x.textContent.includes(name));
      if (!window.__pbJustPicked && pick(/この子で挑む|供モン\d*にする/)) {
        const at = (window.__pbWant || []).findIndex((name) => !!wantBtnEarly(name));
        if (at >= 0) { const name = window.__pbWant.splice(at, 1)[0]; wantBtnEarly(name).click(); window.__pbJustPicked = true; return `mon:${name}`; }
      }
      const go = pick(/出撃|バトル開始|この編成で|この子で挑む|供モン\d*にする|はじめる|^決定$|^確定$/); if (go) { window.__pbJustPicked = false; go.click(); return go.textContent.trim(); }
      const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
      const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
      const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
      const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力|^この子で挑む$|^供モン\d+にする$/.test(x.textContent.trim()) && x.textContent.trim() !== '詳細を見る' && !/DEBUG/.test(x.textContent));
      // 勇者えらびは顔アイコンの並びで、タイルの文字は名前だけ(「前回」が付くことがある)。一覧のカードは名前を含む
      const wantBtnOf = (name) => live.find((x) => x.textContent.trim().replace(/^前回/, '') === name) || mons.find((x) => x.textContent.includes(name));
      const wantAt = (window.__pbWant || []).findIndex((name) => !!wantBtnOf(name));
      if (wantAt >= 0) { const name = window.__pbWant.splice(wantAt, 1)[0]; wantBtnOf(name).click(); return `mon:${name}`; }
      if (mons.length) { const m = mons[window.__pbPick % mons.length]; window.__pbPick += 1; m.click(); return `mon:${m.textContent.trim().split(/\s/)[0]}`; }
      const changes = live.filter((x) => x.textContent.trim() === '変更');
      if (changes.length && window.__pbChange < changes.length) { changes[window.__pbChange].click(); window.__pbChange += 1; return 'change'; }
      return null;
    });
    if (!step) break;
    // 編成を記録する(勇者モン・供モンの候補5体)
    if (ctx && step.startsWith('mon:')) {
      const nm = step.slice(4);
      if (/勇者モン/.test(scrName)) ctx.log.data.build.hero = nm;
      else if (/供モン/.test(scrName) && !ctx.log.data.build.pool.includes(nm)) ctx.log.data.build.pool.push(nm);
      ctx.mem.lastPicked = nm;
    }
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
    wave: num(/WAVE\s*(\d+)\s*\/\s*\d+/), waveMax: num(/WAVE\s*\d+\s*\/\s*(\d+)/), turn: num(/TURN\s*(\d+)\s*\/\s*\d+/), turnMax: num(/TURN\s*\d+\s*\/\s*(\d+)/),
    picked: num(/ACTION CARDS\s*(\d+)\s*\//i), limit: num(/ACTION CARDS\s*\d+\s*\/\s*(\d+)/i),
    party, aimed: aimedEl ? Number(aimedEl.getAttribute('data-slot-index')) : null, aimedDamage,
    intent: ((document.querySelector('[data-enemy-intent]') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 60),
    // ★WAVE の始まりの演出のあいだは実行ボタンの目印が出ない。手札か味方の枠が並んでいればバトルの中
    hand, inBattle: !!action || hand.length > 0 || !!document.querySelector('[data-tactics-party-slot]'), actionEnabled: !!action && !action.disabled, actionPresent: !!action,
    // 実行ボタンの文字。「カードを選ぶ」→(攻撃カードを選ぶと)「置き場所を選ぶ」→「ACTION」と変わる
    needsPlace: /置き場所を選ぶ/.test((action && action.innerText) || ''),
    exPanel: !!document.querySelector('[data-tactics-ex-panel]'),
    over: !action && !hand.length && /敗\s*北|GAME OVER|ゲームオーバー|RUN RESULT|ラン終了|ランの結果|最終結果|ALL CLEAR|全WAVE制覇|CHAMPION/.test(text) || /敗\s*北/.test(text),
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

// 戦い方(何を守り、どのカードをどの枠へ置くか・EX・WAVE の合間の選び方)は tactics-brain.js
const brain = require('./tactics-brain');
const closeExPanel = (s) => s.page.evaluate(() => { const b = document.querySelector('[data-tactics-ex-close]'); if (b) b.click(); return !!b; });

// WAVE の合間・報酬えらびなど。人と同じく「次へ進む」を押し、選ぶ画面では1つ選ぶ
// 取り消し・やり直しも押さない(押すと同じ画面を行ったり来たりする)
const BACKWARD = /^(キャンセル|閉じる|とじる|戻る|もどる|×)$|話しかける|説明を開く|詳しいルール|あきらめる|降参|取り消す|下げる|選び直す|やり直す|変更せず戻る/;
// 進むボタン。上にあるものほど先に押す(選ぶ画面で1つ選んだあと、確定 → 次の画面へ)
const FORWARD = [/^(この供モンを選ぶ|勇者モンに選ぶ|この子で挑む|供モン\d*にする)/, /^(習得する|強化する|決定する|決定|確定)$/, /^(次へ進む|次のWAVEへ|次へ|進む|バトルへ|出撃|出発|OK|受け取る)/, /^アシストカードへ$/];
async function betweenWaves(s, ctx) {
  const pressed = new Map(); // 押しても画面が変わらなかった進むボタン → 回数
  const avoid = new Set();   // 選んでも先へ進めなかった選択肢(人も別のものを選び直す)
  let lastPick = '';
  for (let i = 0; i < 60; i++) {
    const st = await readTactics(s);
    if (st.inBattle) return 'battle';
    if (st.over) return 'over';
    await s.inspect();
    // 選ぶ画面(トレーニング・置き場所・供モン・固有技・アシストカード)は、戦い方の判断で1手選ぶ
    if (ctx && await brain.chooseBetween(s, ctx.mem, ctx.log)) { s.state.step += 1; await s.wait(700); continue; }
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
  await s.addIssue('進めない', 'タクティクスの WAVE の合間から60手押してもバトルへ戻れない');
  return 'stuck';
}

// difficulty: 'max' … 開いている中でいちばん難しい難易度 / 'keep' … 前回の難易度のまま(既定)
async function tacticsScenario(s, { maxMs = 360000, modes = ['tactics', 'tacticsPro'], difficulty = 'keep', out = '', runNo = 1 } = {}) {
  const stats = { mode: '', difficulty: '', entered: false, turns: 0, waveReached: 0, waveMax: 0, downs: 0, aimedDanger: 0, guardsWhenAimed: 0, dangerNoGuard: 0,
    guards: 0, exUsed: 0, discards: 0, pickFailed: 0, cards: {}, finished: false, result: '' };
  const mem = brain.newMemory();
  const log = brain.makeLog({ mode: '', difficulty: '', runNo, startedAt: new Date().toISOString() });
  let entered = '';
  for (const mode of modes) {
    entered = await enterTactics(s, { mode, difficulty, stats, ctx: { mem, log } });
    if (entered === 'ok') { stats.mode = mode; break; }
    await s.backHome();
  }
  if (entered !== 'ok') {
    await s.addIssue('進めない', `タクティクスのバトル画面へ入れなかった(${entered})`);
    return { ok: false, stats, note: `入れなかった(${entered})` };
  }
  stats.entered = true;
  log.data.meta.mode = stats.mode;
  log.data.meta.difficulty = stats.difficulty;
  const t0 = Date.now();
  await fightTactics(s, stats, { maxMs, speedUp: true, brainCtx: { mem, log } });
  const end = await readTactics(s);
  const endText = await s.page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300));
  if (end.over) { stats.finished = true; await s.shot('tactics-result'); }
  // 勝ち負け: 最後の WAVE まで着いて決着した=クリア / 途中で決着=負け(ターン切れか全員倒れた) / 時間切れ=打ち切り
  const lastWave = log.data.waves[log.data.waves.length - 1];
  if (stats.finished) {
    const cleared = !!lastWave && lastWave.result === 'clear' && stats.waveReached >= (stats.waveMax || 10);
    stats.result = cleared ? 'clear' : (lastWave && lastWave.turns >= 20 ? 'timeout' : 'wipe');
  } else stats.result = 'stopped';
  log.finish(stats.result, stats.result === 'stopped' ? `時間の上限(${Math.round(maxMs / 60000)}分)で打ち切った` : '');
  log.data.meta.endText = endText.slice(0, 160);
  log.data.meta.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  log.data.meta.party = Object.keys(mem.mons);
  log.data.why = brain.explain(log.data);
  brain.rememberRun(log.data, stats);
  if (end.over) { await s.dismissOverlays(10); await s.inspect(); }
  if (out) {
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(out, `tactics-log-${runNo}.json`), JSON.stringify(log.data, null, 1));
  }
  // 狙われて危ないのに守りを選べなかったことが続くなら、手札の配り方か、ボットの読み違いのどちらか
  if (stats.aimedDanger >= 4 && stats.dangerNoGuard / stats.aimedDanger > 0.75) {
    await s.addIssue('守りが足りない', `狙われて危ないターン ${stats.aimedDanger}回のうち ${stats.dangerNoGuard}回は、使える守りのカードが手札に無かった`);
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const RESULT_JA = { clear: 'クリア', wipe: '全員倒れた', timeout: 'ターン切れ', stopped: '打ち切り' };
  return { ok: true, stats, log: log.data,
    note: `${stats.mode}${stats.difficulty ? `(${stats.difficulty})` : ''}・${RESULT_JA[stats.result] || stats.result}・${stats.turns}ターン(${mins}分)で WAVE ${stats.waveReached} まで・倒れた ${stats.downs}回・危ないときに守った ${stats.guardsWhenAimed}/${stats.aimedDanger}回・ガード ${stats.guards}枚・EX ${stats.exUsed}回・捨てた ${stats.discards}枚 — ${log.data.why.join(' / ')}` };
}

// タクティクスの盤面で、手で戦い続ける(タクティクス係とイベント係のレイドで使う)。
// waves: false のときは、バトルの外へ出たら(レイドの20ターンが終わったら)そこで止める
async function fightTactics(s, stats, { maxMs = 360000, waves = true, speedUp = false, brainCtx = null } = {}) {
  const ctx = brainCtx || { mem: brain.newMemory(), log: brain.makeLog({}) };
  stats.guards = stats.guards || 0;
  // 登場の演出が終わるまで待つ(終わる前は手札を押しても入らない)
  await s.wait(2500);
  // 長い戦いは、人と同じく「バトル速度」をいちばん速くしてから戦う
  if (speedUp) {
    for (let k = 0; k < 4; k++) {
      const b = (await s.listButtons()).find((x) => /^バトル速度、現在(\d+)倍/.test(x.label));
      if (!b) break;
      const now = Number(b.label.match(/現在(\d+)倍/)[1]);
      if (k > 0 && now === 1) { await s.tap(b, 'バトル速度(戻りすぎたので1つ進める)'); continue; }
      if (now >= 3) break;
      await s.tap(b, 'バトル速度を上げる');
      await s.wait(300);
      const next = (await s.listButtons()).find((x) => /^バトル速度、現在(\d+)倍/.test(x.label));
      if (next && Number(next.label.match(/現在(\d+)倍/)[1]) <= now) break;
    }
  }
  const t0 = Date.now();
  let lastDowned = 0;
  while (Date.now() - t0 < maxMs) {
    s.state.step += 1;
    await s.dismissOverlays(4);
    let st = await readTactics(s);
    if (st.over && waves) { stats.finished = true; break; }
    if (!st.inBattle) {
      if (!waves) break;
      const where = await betweenWaves(s, ctx);
      if (where !== 'battle') { stats.finished = where === 'over'; break; }
      st = await readTactics(s);
    }
    if (st.exPanel) await closeExPanel(s);
    // ★ターンに上限がある戦い(レイドは20ターン)は、上限を超えたら終わり
    if (Number.isFinite(st.turnMax) && st.turnMax > 0 && Number.isFinite(st.turn) && st.turn > st.turnMax) break;
    // ターンの始め(WAVE の始まりの演出・敵の番の直後)は、実行ボタンが出て手札が押せるようになるまで待つ
    for (let k = 0; k < 16 && !(st.inBattle && st.hand.length && st.hand.some((c) => c.usable) && st.actionPresent); k++) {
      await s.wait(500);
      st = await readTactics(s);
    }
    let b = await brain.readBoard(s);
    stats.waveReached = Math.max(stats.waveReached, b.wave || 0);
    stats.waveMax = Math.max(stats.waveMax || 0, b.waveMax || 0);
    const downed = b.slots.filter((x) => x.occupied && x.downed).length;
    if (downed > lastDowned) stats.downs += downed - lastDowned;
    lastDowned = downed;
    // 狙われて危ないか(記録用)。狙われた子は覚えておき、WAVE の合間のトレーニングで丈夫さを上げる
    const aimedSlot = b.slots.find((x) => x.aimed);
    const danger = aimedSlot && aimedSlot.hp && aimedSlot.aimDamage > 0
      && (aimedSlot.aimDamage >= aimedSlot.hp.max * 0.25 || aimedSlot.aimDamage >= aimedSlot.hp.now * 0.6);
    if (aimedSlot && aimedSlot.name) brain.monOf(ctx.mem, aimedSlot.name).aimed += 1;
    if (process.env.PLAYBOT_DEBUG) console.log(`    [タクティクス] W${b.wave} T${b.turn} 敵 ${b.enemy ? `${b.enemy.name}(${b.enemy.dist}) ${b.enemy.hp}/${b.enemy.max}` : `?「${b.enemyBar}」`} 予告「${b.notice}」${aimedSlot ? ` 🎯${aimedSlot.name} ${aimedSlot.aimDamage}` : ''} 枚数${b.picked}/${b.limit} 味方 ${b.slots.filter((x) => x.occupied).map((x) => `${x.name}${x.downed ? '(倒)' : ''} ${x.hp ? x.hp.now : '?'}/${x.guts ? x.guts.now : '?'}G`).join(' ')}`);
    const exBefore = ctx.log.data.ex.length;
    await brain.maybeUseEx(s, b, ctx.mem, ctx.log);
    stats.exUsed += ctx.log.data.ex.length - exBefore;
    b = await brain.readBoard(s);
    ctx.mem.recentDealt = ctx.mem.recentDealt || 0;
    const picks = await brain.playTurn(s, b, ctx.mem, ctx.log, stats);
    if (danger) {
      stats.aimedDanger += 1;
      if (picks.some((p) => p.kind === 'guard')) stats.guardsWhenAimed += 1;
      else if (!b.hand.some((c) => /guard/.test(c.type))) stats.dangerNoGuard += 1;
    }
    // ドラッグ直後のクリックは捨てられることがあるので、少し置いてから実行する
    await s.wait(500);
    const before = await readTactics(s);
    // ★EXを使ったターン(併用できないEX)はカードを選べず、実行ボタンの代わりに「ターンを進める」が出る(71-screen-battle.jsx の data-tactics-ex-pass)
    let acted = false;
    if (!before.actionEnabled && await s.page.evaluate(() => { const x = document.querySelector('[data-tactics-ex-pass]'); return !!x && !x.disabled; })) {
      await tapEl(s, '[data-tactics-ex-pass]', 'ターンを進める');
      acted = true;
    } else {
      if (!before.actionEnabled) {
        // 置いた直後の演出のあいだは押せない(最大6秒待つ)
        for (let k = 0; k < 12 && !(await readTactics(s)).actionEnabled; k++) await s.wait(500);
        if (!(await readTactics(s)).actionEnabled) { await s.addIssue('反応なし', `タクティクスで実行が押せない(手札 ${before.hand.map((c) => `${c.type}${c.usable ? '' : '×'}`).join(' ')})`); break; }
      }
      await tapEl(s, '[data-battle-action]', 'ACTION');
      acted = true;
    }
    if (acted) stats.turns += 1;
    // 敵の番の演出が終わるまで待つ(ターンか WAVE が動く・バトルの外へ出る)。上限60秒
    let moved = false;
    for (let k = 0; k < 120 && !moved; k++) {
      await s.wait(500);
      const now = await readTactics(s);
      // ★負けたときは「敗北」の画面が盤面の上に出る(手札は残っている)ので、それも動いたと見る
      moved = !now.inBattle || now.over || now.turn !== before.turn || now.wave !== before.wave;
    }
    const after = await brain.readBoard(s);
    // 記録: このターンに出たダメージを、置いたカードの見込みの割合で子ごとに分ける
    ctx.log.turn(b, picks, after);
    const planned = picks.filter((p) => p.kind === 'attack').reduce((a, p) => a + p.value, 0) || 1;
    const dealt = b.enemy ? Math.max(0, b.enemy.hp - (after.enemy && after.wave === b.wave ? after.enemy.hp : 0)) : 0;
    for (const p of picks) if (p.kind === 'attack' && p.mon) brain.monOf(ctx.mem, p.mon).dmg += dealt * (p.value / planned);
    // 1ターンあたりのダメージ(なだらかに)。WAVE が変わったら数え直す
    if (after.wave === b.wave) ctx.mem.recentDealt = ctx.mem.recentDealt ? ctx.mem.recentDealt * 0.6 + dealt * 0.4 : dealt; else ctx.mem.recentDealt = 0;
    for (const x of after.slots || []) {
      const was = b.slots.find((y) => y.i === x.i);
      if (x.occupied && x.downed && was && !was.downed && x.name) brain.monOf(ctx.mem, x.name).downs += 1;
    }
    ctx.mem.lastParty = Object.fromEntries((after.wave === b.wave ? after : b).slots.filter((x) => x.occupied).map((x) => [x.name, x.hp ? x.hp.now / Math.max(1, x.hp.max) : 1]));
    if (after.wave !== b.wave || !after.inBattle) {
      ctx.log.waveEnd(after.inBattle || !after.over ? 'clear' : '');
      // 合間のアシストカード選びで使う: このWAVEで味方の最大ライフの何割を受けたか
      const w = ctx.log.data.waves[ctx.log.data.waves.length - 1];
      if (w) ctx.mem.dmgTakenWave = w.partyMax ? w.taken / w.partyMax : 0;
    }
    await s.inspect();
    if (!moved) { await s.addIssue('進行停止', `タクティクスで実行してから60秒たってもターンが進まない (W${before.wave}/T${before.turn})`); break; }
  }
}

module.exports = { tacticsScenario, fightTactics, readTactics };
