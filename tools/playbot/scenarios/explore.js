// 探索と、HOME から行ける場所をひととおり回るツアー。
//
// 探索: 見えているボタンを、まだ押していないものを優先して押していく(モンキーテスト)。
// ツアー: HOME のボタンを1つずつ開き、その中で少し遊んでから HOME へ戻る。
//         探索は乱数しだいで行かない場所が出るので、ツアーで「全部の入口」を必ず1回は通る。

// 選んだ印の一覧(押す前と後で比べる)。「選ばれている札」「開いている／閉じている」の切り替えを、文字の変化とは別に見る
const toggleSig = (s) => s.page.evaluate(() => [...document.querySelectorAll('[aria-pressed],[aria-selected],[aria-checked],[aria-expanded]')]
  .map((e) => `${e.getAttribute('aria-pressed')}${e.getAttribute('aria-selected')}${e.getAttribute('aria-checked')}${e.getAttribute('aria-expanded')}`).join(',')).catch(() => '');
// 押した札がすでに「選ばれている」ものか(押し直しても変わらないのが正しい)
const isSelectedChip = (s, b) => s.page.evaluate(({ x, y }) => {
  const e = document.elementFromPoint(x, y);
  const el = e && e.closest('[aria-pressed],[aria-selected],[aria-checked]');
  return !!el && ['aria-pressed', 'aria-selected', 'aria-checked'].some((a) => el.getAttribute(a) === 'true');
}, { x: b.x, y: b.y }).catch(() => false);

async function step(s, ctx) {
  const { rand, report } = ctx;
  s.state.step += 1;
  await s.fillEmptyInputs();
  const before = await s.screenName();
  let list = await s.listButtons();
  // 「ゲームを更新」などで読み込み直している間(NOW LOADING)は押せるものが無い。人と同じく少し待つ
  // (担当を同時に動かしているとCPUを分け合うので、ひとりのときより長く出る)
  for (let w = 0; !list.length && w < 6; w++) { await s.wait(2000); list = await s.listButtons(); }
  if (!list.length) {
    await s.addIssue('行き止まり', '押せるボタンが1つも無い');
    await s.backHome();
    return before;
  }
  // まだ押していないボタンを優先する(押した回数が少ないほど選ばれやすい)
  const weights = list.map((b) => 1 / (1 + (report.clickCount.get(`${before}|${b.label}`) || 0)) ** 2);
  let r = rand() * weights.reduce((a, b) => a + b, 0), pick = list[0];
  for (let k = 0; k < list.length; k++) { r -= weights[k]; if (r <= 0) { pick = list[k]; break; } }
  const key = `${before}|${pick.label}`;
  report.clickCount.set(key, (report.clickCount.get(key) || 0) + 1);
  const textBefore = ((await s.health()) || { text: '' }).text;
  const sigBefore = await toggleSig(s);
  await s.tap(pick, '探索');
  let { name, h } = await s.inspect();
  // 押しても画面の文字が1文字も変わらない → 3回続いたら「反応しないボタン」
  // ★文字が変わらなくても、選んだ印(aria-pressed など)が変わったなら反応している(画面テーマの「おまかせ」「クラシック」など)。
  //   選ばれている札を押し直しても何も変わらないのは正しい動き。また、切り替えの動きの最中に読んで見逃さないよう、少し待って読み直す
  if (h && h.text === textBefore && pick.tag !== 'SELECT' && pick.tag !== 'INPUT') {
    await s.wait(700);
    const again = await s.inspect();
    h = again.h; name = again.name;
  }
  if (h && h.text === textBefore && (await toggleSig(s)) === sigBefore && pick.tag !== 'SELECT' && pick.tag !== 'INPUT' && !(await isSelectedChip(s, pick))) {
    const n = (ctx.noEffect.get(key) || 0) + 1; ctx.noEffect.set(key, n);
    if (n === 3) await s.addIssue('反応なし', `「${pick.label}」を押しても画面が変わらない`);
  }
  return name;
}

async function exploreScenario(s, { steps, rand, report }) {
  const ctx = { rand, report, noEffect: new Map() };
  await s.backHome();
  let streak = 0, prev = '';
  for (let i = 0; i < steps; i++) {
    const name = await step(s, ctx);
    streak = name === prev ? streak + 1 : 0;
    prev = name;
    // 同じ画面に長くいたら、戻ってほかの画面も見に行く
    if (streak >= 12 || (i > 0 && i % 40 === 0)) { await s.backHome(); streak = 0; }
  }
  return { ok: true, note: `${steps}手` };
}

async function tourScenario(s, { stepsEach, rand, report }) {
  const ctx = { rand, report, noEffect: new Map() };
  await s.backHome();
  const entries = (await s.listButtons()).map((b) => b.label)
    .filter((l) => !/話しかける|ひとこと|みゅあ|きき|ももすけ|ドラ|ジャック/.test(l));
  const visited = [];
  for (const label of [...new Set(entries)]) {
    await s.backHome();
    // 残り時間や件数のように中の文字が変わるボタンもあるので、頭の数文字で探す
    const head = label.replace(/[\s\d,()（）件個]+$/, '').slice(0, 8) || label.slice(0, 8);
    const b = (await s.listButtons()).find((x) => x.label === label) || (await s.listButtons()).find((x) => x.label.startsWith(head));
    if (!b) { await s.addIssue('たどり着けない', `HOME の「${label}」が2回目には見当たらない`); continue; }
    s.state.step += 1;
    await s.tap(b, `ツアー: ${label}`);
    await s.dismissOverlays(6);
    await s.inspect();
    for (let i = 0; i < stepsEach; i++) await step(s, ctx);
    visited.push(label);
  }
  await s.backHome();
  return { ok: true, note: `HOME の入口 ${visited.length}か所`, visited };
}

module.exports = { exploreScenario, tourScenario };
