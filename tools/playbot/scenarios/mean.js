// 意地悪係: 人がうっかりやること・せっかちな人がやることを試し、二重になったり壊れたりしないかを見る。
//   ① 二度押し … 買う・ギフトを受け取る・ミッションの報酬で、決定のボタンをすばやく2回押す(数が1回分だけ動くか)
//   ② 途中で読み込み直す … 買う画面を開いたまま読み込み直す(ダイヤも所持数も動かないか)
//   ③ ブラウザの「戻る」 … いろいろな画面でブラウザの戻るを押す(真っ白・エラーにならないか)
//   ④ 裏へ回す … AUTO バトル中にアプリを裏へ回して(画面を隠して)戻す(バトルが止まったままにならないか)
// 2026-10-07 にアシストカードの「習得する」の二度押しで挑戦回数が2回数えられていた(#2282)。同じ種類を探す担当。
const { buyItems, receiveGifts, claimMissions, storage, changedKeys } = require('./shop');
const { enterQuickBattle } = require('./battle');

async function doubleTapScenario(s) {
  const buy = await buyItems(s, { count: 3, double: true });
  const gift = await receiveGifts(s, { count: 3, double: true });
  const mission = await claimMissions(s, { double: true });
  await s.backHome();
  const problems = buy.problems.length + gift.problems.length;
  return { ok: !problems, note: `二度押しで 買う ${buy.bought}回・ギフト ${gift.received}個・ミッション ${mission.claimed}回${problems ? `・二重になった ${problems}件` : '・どれも1回分だけ動いた'}` };
}

async function reloadMidwayScenario(s) {
  await s.backHome();
  await s.tapLabel(/^マーケット$/, 1500); await s.dismissOverlays(6);
  await s.tapLabel(/^ダイヤショップ$/, 1500); await s.dismissOverlays(6);
  await s.tapLabel(/^アイテム$/, 1200);
  const good = (await s.listButtons()).find((b) => /を[\d,]+ダイヤで購入$/.test(b.label));
  if (!good) return { ok: false, note: '買うボタンが見つからない' };
  await s.tap(good, '買う画面を開く');
  await s.wait(500);
  const before = await storage(s);
  // 「購入する」を押さずに読み込み直す
  await s.boot();
  await s.inspect();
  const after = await storage(s);
  const moved = changedKeys(before, after).filter((k) => /^mh_(gold|owned_items|items)$/.test(k));
  if (moved.length) await s.addIssue('途中で読み込み直すと変わる', `買う画面を開いたまま読み込み直したら ${moved.join(', ')} が変わった`);
  return { ok: !moved.length, note: moved.length ? `変わった: ${moved.join(', ')}` : '買う画面を開いたまま読み込み直しても、ダイヤも所持数も変わらない' };
}

async function browserBackScenario(s) {
  const tried = [];
  const left = [];
  for (const entry of [/^マーケット$/, /^M\/B管理$/, /^モンヒロビート$/, /^モンヒロバトル$/, /^設定$/]) {
    await s.backHome();
    const b = (await s.listButtons()).find((x) => entry.test(x.label));
    if (!b) continue;
    await s.tap(b, '開く');
    await s.dismissOverlays(6);
    s.state.step += 1;
    await s.page.goBack({ timeout: 5000 }).catch(() => {});
    await s.wait(1500);
    // ゲームの外(about:blank など)へ出てしまったら、人と同じく開き直す
    // ★このゲームは画面を切り替えても履歴を残さないので、戻るはゲームの外へ出る(スマホの戻るボタンでゲームが閉じる)。
    //   不具合ではなく改善のヒントとして残し、人と同じく開き直す
    if (!/monster-hero/.test(s.page.url())) { left.push(b.label); await s.boot(); }
    await s.inspect();
    tried.push(b.label);
  }
  await s.backHome();
  if (left.length) await s.addIssue('戻るでゲームの外へ出る', `ブラウザ(スマホ)の戻るを押すと、ゲームの外へ出てしまう(${left.join('・')} で確かめた)。ゲームの中の「戻る」と同じ動きにするか`);
  return { ok: true, note: `ブラウザの戻るを ${tried.length}か所で押した(${tried.join('・')})${left.length ? `・${left.length}か所でゲームの外へ出た` : ''}` };
}

// アプリを裏へ回す: document.hidden を真にして visibilitychange を出し、少し待って戻す
const setHidden = (s, hidden) => s.page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event(h ? 'blur' : 'focus'));
}, hidden);

async function backgroundScenario(s) {
  await s.backHome();
  const { inBattle } = await enterQuickBattle(s);
  if (!inBattle) return { ok: false, note: 'バトルへ入れない' };
  await s.page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
  await s.wait(6000);
  const turnOf = () => s.page.evaluate(() => { const t = document.body.innerText.replace(/\s+/g, ' '); const w = t.match(/WAVE\s*(\d+)/); const tr = t.match(/TURN\s*(\d+)/); return `${w ? w[1] : '?'}-${tr ? tr[1] : '?'}`; });
  const before = await turnOf();
  await setHidden(s, true);
  await s.wait(8000);
  await setHidden(s, false);
  // 戻ってから30秒のあいだに、WAVE かターンが動けば止まっていない
  let after = before;
  for (let i = 0; i < 15 && after === before; i++) { await s.wait(2000); after = await turnOf(); }
  await s.inspect();
  const ok = after !== before;
  if (!ok) await s.addIssue('裏から戻ると止まる', `AUTO バトル中に裏へ回して戻したら、30秒たっても WAVE・ターンが動かない(${before})`);
  // バトルを抜ける(AUTO を止めて HOME へ)
  await s.page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
  await s.backHome();
  return { ok, note: ok ? `裏から戻したあともバトルは進んだ(W-T ${before} → ${after})` : `止まったまま(${before})` };
}

module.exports = { doubleTapScenario, reloadMidwayScenario, browserBackScenario, backgroundScenario };
