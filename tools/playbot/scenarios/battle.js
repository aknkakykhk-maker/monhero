// バトル: クイックモードへ入り、最初は人のようにカードを選んで数ターン戦い、そのあと AUTO で回す。
//
// 手で戦うときの考え方(ふつうのプレイヤーくらい):
//   ・ガッツが足りるカードの中から選ぶ。攻撃を多めに、たまに守りや支援
//   ・ときどき距離を変える
//   ・ライフが3割を切ったら守り(ガード)を選びやすくする

// 入口(モンヒロバトル → 仕組み → [モード] → 挑戦できる難易度 → 勇者モン → 距離 → アシストカード)
// system: 'systemQuick'(クイック。中のモードは1つ) / 'systemClassic'(クラシック。中のチャレンジモードを選ぶ)
// ★クイックは「同じ難易度をチャレンジ・プロ・極限のどれかでクリア」すると開放される。はじめての人はクラシックから
async function enterQuickBattle(s, { system = 'systemQuick', mode = 'challenge' } = {}) {
  const { page, rand } = s;
  await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
  await s.wait(1200);
  await s.inspect();
  await page.evaluate((id) => document.querySelector(`[data-battle-system="${id}"]`)?.click(), system);
  await s.wait(1300);
  await s.inspect();
  if (system !== 'systemQuick') {
    // モード選択: カードを押し、中に「選ぶ」系のボタンがあれば押す
    const picked = await page.evaluate((id) => {
      const card = document.querySelector(`[data-battle-mode="${id}"]`);
      if (!card) return '';
      card.scrollIntoView({ block: 'center' });
      const btns = [...card.querySelectorAll('button')].filter((b) => !/説明|ランキング/.test(b.innerText || ''));
      const btn = btns.find((b) => /難易度を選ぶ/.test(b.innerText || '')) || btns.find((b) => /遊ぶ|挑戦|選ぶ|はじめる|決定/.test(b.innerText || ''));
      (btn || card).click();
      return (btn ? btn.innerText : card.innerText || '').split('\n')[0].trim();
    }, mode);
    if (!picked) { await s.addIssue('進めない', `モード選択に「${mode}」のカードが無い`); return { inBattle: false, heroName: '' }; }
    await s.wait(1300);
    await s.dismissOverlays(6);
    await s.inspect();
  }
  // 難易度は前回の選択(初めてなら Normal)から始まる。挑戦できる難易度が出るまで左へ送る
  for (let i = 0; i < 9 && !(await s.tapLabel(/この難易度で挑戦/, 1500)); i++) {
    if (!(await s.tapLabel(/^前の難易度$/, 700))) break;
  }
  await s.inspect();
  // 勇者モンは毎回ちがう子を選ぶ。カードは「総合力」と「詳細を見る」を含む枠で見分ける
  // ★画像の有無で探すと、助手の顔(吹き出しの横)を勇者モンと取り違える
  const pick = Math.floor(rand() * 8);
  const heroName = await page.evaluate((n) => {
    const cards = [...document.querySelectorAll('article,button,[role="button"],div')]
      .filter((x) => /総合力/.test(x.innerText || '') && /詳細を見る/.test(x.innerText || '') && x.querySelectorAll('img').length === 1);
    const card = cards[n % Math.max(1, cards.length)];
    if (!card) return '';
    card.scrollIntoView({ block: 'center' });
    const detail = [...card.querySelectorAll('button')].find((b) => /詳細を見る/.test(b.innerText || ''));
    (detail || card).click();
    return (card.innerText || '').split('\n')[0].trim();
  }, pick);
  await s.wait(900);
  await s.inspect();
  await s.tapLabel(/勇者モンに選ぶ/, 900);
  await s.tapLabel(/近距離|中距離|零距離|遠距離/, 1300);
  await s.dismissOverlays();
  await s.tapLabel(/新規習得/, 900);
  await s.tapLabel(/^習得する$/, 3500);
  await s.inspect();
  const inBattle = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
  return { inBattle, heroName };
}

const readBattle = (s) => s.page.evaluate(() => {
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
  const num = (re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
  return {
    turn: num(/TURN\s*(\d+)/), wave: num(/WAVE\s*(\d+)/),
    life: num(/ALLY LIFE\s*([\d,]+)/), lifeMax: num(/ALLY LIFE\s*[\d,]+\s*\/\s*([\d,]+)/),
    guts: num(/ALLY GUTS\s*(\d+)/),
    picked: num(/ACTION CARDS\s*(\d+)\s*\//),
    inBattle: !!document.querySelector('button[aria-label^="AUTO"]'),
    // ラン全体の終わり(WAVE ごとの「WAVE 1 リザルト」は含めない)
    over: !document.querySelector('button[aria-label^="AUTO"]') && /GAME OVER|ゲームオーバー|RUN RESULT|ラン終了|ランの結果|最終結果|ALL CLEAR|全WAVE制覇/.test(text),
  };
});

// WAVE の合間(結果 → 報酬えらび など)。人と同じく「次へ進む」を押し、選ぶ画面では1つ選ぶ。
// バトルへ戻れば 'battle'、ランが終われば 'over'
const BACKWARD = /^(キャンセル|閉じる|とじる|戻る|もどる|×)$|話しかける|説明を開く|詳しいルール|あきらめる/;
async function betweenWaves(s) {
  for (let i = 0; i < 20; i++) {
    const st = await readBattle(s);
    if (st.inBattle) return 'battle';
    if (st.over) return 'over';
    await s.inspect();
    const list = await s.listButtons();
    const go = list.find((b) => /^(次へ進む|次のWAVEへ|次へ|進む|バトルへ|出発|決定|OK|受け取る)/.test(b.label));
    const options = list.filter((b) => !BACKWARD.test(b.label));
    if (go) await s.tap(go, 'WAVE の合間');
    else if (options.length) await s.tap(options[Math.floor(s.rand() * options.length)], 'WAVE の合間(えらぶ)');
    else await s.wait(800);
  }
  await s.addIssue('進めない', 'WAVE の合間から20手押してもバトルへ戻れない');
  return 'stuck';
}

// カードのボタン名は「雷撃 攻撃 ⇄ 技変更 46」のように、種類と消費ガッツを含む
const cardsNow = async (s) => (await s.listButtons())
  .filter((b) => /(攻撃|守り|支援)/.test(b.label) && /\d+$/.test(b.label) && !/技を変える/.test(b.label) && b.y > 500)
  .map((b) => ({ ...b, cost: Number(b.label.match(/(\d+)$/)[1]), kind: (b.label.match(/攻撃|守り|支援/) || [''])[0] }));

async function playManualTurns(s, turns, stats) {
  const { rand } = s;
  for (let t = 0; t < turns; t++) {
    s.state.step += 1;
    await s.dismissOverlays(4);
    let st = await readBattle(s);
    if (!st.inBattle) {
      const where = await betweenWaves(s);
      if (where !== 'battle') { stats.finished = where === 'over'; break; }
      stats.wavesCleared += 1;
      st = await readBattle(s);
    }
    if (rand() < 0.2) {
      const dist = (await s.listButtons()).filter((b) => /^(零|近|中|遠)距離$/.test(b.label)); // 「零距離撃の技を変える」を拾わない
      if (dist.length) await s.tap(dist[Math.floor(rand() * dist.length)], '距離を変える');
    }
    const cards = await cardsNow(s);
    const guts = Number.isFinite(st.guts) ? st.guts : 999;
    const ok = cards.filter((c) => c.cost <= guts);
    if (!ok.length) {
      stats.noCardTurns += 1;
      stats.noCardWhy = `手札${cards.length}枚・ガッツ${guts}・画面「${await s.screenName()}」`;
      if (stats.noCardTurns >= 4) break;
      // 手札が見えないのは、技えらびなどの「選ぶ画面」が出ているとき。人と同じく1つ選んで進める
      const all = await s.listButtons();
      const options = all.filter((b) => !BACKWARD.test(b.label) && !/^AUTO|バトル速度|VIEW|緊急回復|記録を見る|ステータス|解析|強化の詳細|^詳細$|^\(無名|^BUTTON$/.test(b.label));
      // 選ぶものが見当たらなければ、閉じて戻る(人も迷ったら閉じる)
      if (!options.length) { const back = all.find((b) => BACKWARD.test(b.label) && !/話しかける|説明/.test(b.label)); if (back) { await s.tap(back, '選ぶ画面を閉じる'); t -= 1; continue; } }
      const go = options.find((b) => /^(決定|OK|これにする|習得する|選ぶ|次へ進む|次へ)$/.test(b.label));
      if (go) await s.tap(go, '選ぶ画面(決定)');
      else if (options.length) await s.tap(options[Math.floor(rand() * options.length)], '選ぶ画面');
      else await s.wait(1500);
      t -= 1;
      continue;
    }
    const lowLife = st.life && st.lifeMax && st.life / st.lifeMax < 0.3;
    const weight = (c) => (c.kind === '攻撃' ? 3 : c.kind === '守り' ? (lowLife ? 4 : 0.6) : 1);
    let r = rand() * ok.reduce((a, c) => a + weight(c), 0), choice = ok[0];
    for (const c of ok) { r -= weight(c); if (r <= 0) { choice = c; break; } }
    const before = st;
    await s.tap(choice, `カードを選ぶ(${choice.kind})`);
    // カードのあとは画面の案内に従う: 「置き場所を選ぶ」なら距離の枠を押す / 決定のボタンが出たら押す。
    // 演出が終わるのを待ち、ターンかWAVEが動いたら次へ
    let moved = false;
    for (let w = 0; w < 14 && !moved; w++) {
      const now = await readBattle(s);
      moved = now.turn !== before.turn || now.wave !== before.wave || !now.inBattle;
      if (moved) break;
      // 演出中に押すと選択が入らないことがある(ACTION CARDS 0/…)。人と同じく選び直す
      if (now.picked === 0) {
        const again = (await cardsNow(s)).find((c) => c.label === choice.label);
        if (again) await s.tap(again, 'カードを選び直す'); else await s.wait(700);
        continue;
      }
      const list = await s.listButtons();
      // 押せるときの字は Action(大文字で見える)。「置き場所を選ぶ」の間は押せない(無効)ので一覧に出ない
      const go = list.find((b) => /^(ACTION|決定|実行|確定)$/i.test(b.label));
      if (go) { await s.tap(go, 'ACTION'); await s.wait(700); continue; }
      // 攻撃カードは、使うモンスター(枠の中にモンスターがいる距離)へ置く。空き枠('---')には置けない
      const slots = await s.page.evaluate(() => [...document.querySelectorAll('button[aria-label]')]
        .filter((b) => /^(零|近|中|遠)距離/.test(b.getAttribute('aria-label')) && !/---/.test(b.innerText || '') && !b.disabled)
        .map((b) => { const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      if (slots.length && w % 2 === 0) await s.tap(slots[Math.floor(rand() * slots.length)], '置き場所を選ぶ');
      else await s.wait(700);
    }
    stats.manualTurns += 1;
    await s.inspect();
    if (!moved) { await s.addIssue('反応なし', `カード「${choice.label}」を選んでもターンが進まない`); break; }
  }
}

async function watchAuto(s, ms, stats) {
  const { page } = s;
  // 手で戦い終えたのが WAVE の合間なら、先にバトルへ戻ってから AUTO を入れる
  if (!(await readBattle(s)).inBattle) {
    const where = await betweenWaves(s);
    if (where !== 'battle') { stats.finished = where === 'over'; return; }
  }
  await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
  await s.wait(800);
  const t0 = Date.now();
  let last = await readBattle(s), lastChange = Date.now();
  while (Date.now() - t0 < ms) {
    await s.wait(3000);
    s.state.step += 1;
    const st = await readBattle(s);
    stats.samples.push({ t: Date.now() - t0, wave: st.wave, turn: st.turn, life: st.life });
    if (st.turn !== last.turn || st.wave !== last.wave || st.over !== last.over) lastChange = Date.now();
    if (st.over) { stats.finished = true; break; }
    if (Date.now() - lastChange > 20000) {
      await s.addIssue('進行停止', `AUTO中に20秒以上 WAVE/ターンが動かない (W${st.wave}/T${st.turn})`);
      break;
    }
    last = st;
    await s.inspect();
  }
  const end = await readBattle(s);
  stats.endWave = end.wave; stats.endTurn = end.turn;
  if (end.over) {
    await s.shot('battle-result');
    // 結果画面から先へ進めるか(人なら「HOMEへ」などを押す)
    await s.dismissOverlays(10);
    await s.inspect();
  }
}

async function battleScenario(s, { manualTurns = 6, autoMs = 60000, system = 'systemQuick' } = {}) {
  const stats = { entered: false, system, hero: '', manualTurns: 0, wavesCleared: 0, noCardTurns: 0, samples: [], finished: false };
  const { inBattle, heroName } = await enterQuickBattle(s, { system });
  stats.entered = inBattle; stats.hero = heroName;
  if (!inBattle) { await s.addIssue('進めない', `${system === 'systemQuick' ? 'クイックモード' : 'チャレンジモード'}のバトル画面へ入れなかった`); return { ok: false, stats }; }
  if (manualTurns > 0) await playManualTurns(s, manualTurns, stats);
  // AUTO は AUTO係の受け持ち。手で遊ぶ係(autoMs: 0)は AUTO を入れずに終える
  if (autoMs > 0) await watchAuto(s, autoMs, stats);
  else { const end = await readBattle(s); stats.endWave = end.wave; stats.endTurn = end.turn; }
  const manual = manualTurns > 0 ? `手で${stats.manualTurns}ターン(WAVE ${stats.wavesCleared}つ突破)` : '';
  const auto = autoMs > 0 ? `AUTO ${Math.round(autoMs / 1000)}秒で W${stats.endWave} / T${stats.endTurn}` : `W${stats.endWave} / T${stats.endTurn} まで`;
  return { ok: true, stats, note: `${heroName || '?'}・${[manual, auto].filter(Boolean).join(' → ')}${stats.finished ? '(決着)' : ''}` };
}

module.exports = { battleScenario, enterQuickBattle };
