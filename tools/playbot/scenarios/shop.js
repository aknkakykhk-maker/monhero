// 買い物と受け取り: ダイヤショップでアイテムを買う / ギフトを受け取る / ミッションの報酬を受け取る。
// 押す前と押したあとの保存値をくらべて、
//   ・ダイヤが、買う画面に出ていた「購入後 残り」と同じになったか
//   ・アイテムの「所持」が、買った数だけ増えたか
//   ・ギフトを1つ受け取ったら、ダイヤがその報酬ぶんだけ増え、未受取が1つ減ったか
// を見る。double: true のときは決定のボタンをすばやく2回押す(意地悪係)。それでも1回分しか動かないのが正しい。
// 遊ぶのはボットのブラウザの中だけ(ダイヤは下準備で入れたもの)。手元・本番のセーブには触れない(CLAUDE.md ⑦)。

const readNum = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; };

// mh_ で始まる保存値をまとめて読む(くらべる用)
const storage = (s) => s.page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mh_')) out[k] = localStorage.getItem(k); }
  return out;
});
const gold = async (s) => { const v = await s.page.evaluate(() => localStorage.getItem('mh_gold')); return readNum(v); };
// 押す前後で変わった保存キー(報告用。値は長いので名前だけ)
const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);

// 決定のボタンを押す。double なら人の指の二度押しくらいの間(120ms)で2回押す
async function press(s, b, why, double) {
  if (double) { await s.page.mouse.click(b.x, b.y).catch(() => {}); await s.wait(120); }
  await s.tap(b, why);
}

// 「◯◯ 所持 N」を画面の文字から読む
const ownedOf = (s, name) => s.page.evaluate((n) => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  const i = t.indexOf(`${n} 所持`);
  if (i < 0) return null;
  const m = t.slice(i + n.length).match(/^\s*所持\s*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}, name);

async function openDiamondItems(s) {
  await s.backHome();
  if (!(await s.tapLabel(/^マーケット$/, 1500))) return false;
  await s.dismissOverlays(6);
  if (!(await s.tapLabel(/^ダイヤショップ$/, 1500))) return false;
  await s.dismissOverlays(6);
  if (!(await s.tapLabel(/^アイテム$/, 1200))) return false;
  await s.inspect();
  return true;
}

// ダイヤショップのアイテムを count 個、1つずつ買う
async function buyItems(s, { count = 3, double = false } = {}) {
  const tag = double ? '(二度押し)' : '';
  const res = { bought: 0, problems: [] };
  if (!(await openDiamondItems(s))) { await s.addIssue('進めない', 'ダイヤショップのアイテムまで行けない'); return res; }
  const goods = (await s.listButtons()).filter((b) => /を[\d,]+ダイヤで購入$/.test(b.label));
  for (let k = 0; k < Math.min(count, goods.length); k++) {
    const good = goods[Math.floor(s.rand() * goods.length)];
    const name = good.label.replace(/を[\d,]+ダイヤで購入$/, '');
    const fresh = (await s.listButtons()).find((b) => b.label === good.label);
    if (!fresh) continue;
    const ownedBefore = await ownedOf(s, name);
    const before = await storage(s);
    await s.tap(fresh, `${name}を買う`);
    await s.wait(500);
    // 買う画面: 数は1のまま。「購入後 残り◯ダイヤ」を読んでおく
    const dlg = await s.page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, ' ');
      const total = t.match(/合計\s*([\d,]+)\s*ダイヤ/); const rest = t.match(/購入後\s*残り\s*([\d,]+)\s*ダイヤ/);
      return { total: total ? Number(total[1].replace(/,/g, '')) : null, rest: rest ? Number(rest[1].replace(/,/g, '')) : null };
    });
    const buy = (await s.listButtons()).find((b) => b.overlay && /^購入する$/.test(b.label));
    if (!buy) { res.problems.push(`${name}: 買う画面に「購入する」が無い`); await s.dismissOverlays(4); continue; }
    await press(s, buy, `購入する${tag}`, double);
    await s.wait(1200);
    await s.dismissOverlays(4);
    // 二度押しの2回目が、窓の下の別の品物を開くことがある。人と同じく「キャンセル」で閉じる
    const cancel = (await s.listButtons()).find((b) => b.overlay && /^キャンセル$/.test(b.label));
    if (cancel) { await s.tap(cancel, '開いた窓を閉じる'); await s.wait(500); }
    const after = await storage(s);
    const g = readNum(after.mh_gold);
    const ownedAfter = await ownedOf(s, name);
    res.bought += 1;
    if (dlg.rest !== null && g !== dlg.rest) res.problems.push(`${name}${tag}: 買ったあとのダイヤが ${g}(画面では「残り${dlg.rest}」・合計${dlg.total})`);
    if (ownedBefore !== null && ownedAfter !== null && ownedAfter !== ownedBefore + 1) res.problems.push(`${name}${tag}: 所持が ${ownedBefore} → ${ownedAfter}(1つ増えるはず)`);
    if (process.env.PLAYBOT_DEBUG) console.log(`    [買い物] ${name}${tag} ダイヤ ${readNum(before.mh_gold)}→${g}(残り表示${dlg.rest}) 所持 ${ownedBefore}→${ownedAfter} 変わったキー ${changedKeys(before, after).join(',')}`);
    await s.inspect();
  }
  for (const p of res.problems) await s.addIssue(double ? '二度押しで二重' : '買い物の数が合わない', p);
  return res;
}

// ギフトを count 個、1つずつ受け取る。ダイヤの報酬があるギフトは増え方も確かめる
async function receiveGifts(s, { count = 3, double = false } = {}) {
  const tag = double ? '(二度押し)' : '';
  const res = { received: 0, problems: [] };
  await s.backHome();
  if (!(await s.tapLabel(/^ギフト/, 1500))) { await s.addIssue('進めない', 'HOME の「ギフト」が無い'); return res; }
  await s.dismissOverlays(6);
  await s.inspect();
  // 未受取のギフト(id → ダイヤの報酬)
  const unclaimed = () => s.page.evaluate(() => {
    try {
      const list = JSON.parse(localStorage.getItem('mh_gifts') || '[]') || [];
      return list.filter((g) => g && !g.claimed && !g.claimedAt && !g.received)
        .map((g) => ({ id: g.id, diamond: (g.rewards || []).filter((r) => r && r.type === 'diamond').reduce((a, r) => a + (Number(r.amount) || 0), 0) }));
    } catch { return []; }
  });
  for (let k = 0; k < count; k++) {
    const btn = (await s.listButtons()).find((b) => /^受け取る$/.test(b.label));
    if (!btn) break;
    const before = await unclaimed();
    const g0 = await gold(s);
    await press(s, btn, `ギフトを受け取る${tag}`, double);
    await s.wait(1500);
    await s.dismissOverlays(6);
    const after = await unclaimed();
    const g1 = await gold(s);
    res.received += 1;
    // ★二度押しすると、1回目で消えたギフトの次のギフトを2回目で受け取ることがある(一覧が上へ詰まるため)。
    //   それは二重取りではない。見るのは「消えたギフトの報酬の合計」と「実際に増えたダイヤ」が同じか
    const gone = before.filter((g) => !after.some((x) => x.id === g.id));
    const expected = gone.reduce((a, g) => a + g.diamond, 0);
    const plus = (g1 ?? 0) - (g0 ?? 0);
    if (!gone.length) res.problems.push(`ギフト${tag}: 「受け取る」を押しても未受取が減らない`);
    else if (plus !== expected) res.problems.push(`ギフト${tag}: 受け取った ${gone.length}個の報酬はダイヤ ${expected} なのに、${plus} 増えた`);
    if (process.env.PLAYBOT_DEBUG) console.log(`    [ギフト] ${tag} 受け取った ${gone.length}個 ダイヤ +${plus}(報酬の合計 ${expected})`);
    await s.inspect();
  }
  for (const p of res.problems) await s.addIssue(double ? '二度押しで二重' : '受け取りの数が合わない', p);
  return res;
}

// ミッションの「受け取る」を押せるだけ押す(数が合うかは見ない。押せる・閉じられる・エラーが出ないか)
async function claimMissions(s, { double = false } = {}) {
  await s.backHome();
  if (!(await s.tapLabel(/^ミッション/, 1500))) return { claimed: 0 };
  await s.dismissOverlays(6);
  await s.inspect();
  let claimed = 0;
  for (const tab of ['デイリー', 'ウィークリー', 'マンスリー']) {
    await s.tapLabel(new RegExp(`^${tab}`), 800);
    for (let k = 0; k < 6; k++) {
      const b = (await s.listButtons()).find((x) => /^(受け取る|まとめて受け取る|すべて受け取る)$/.test(x.label));
      if (!b) break;
      await press(s, b, `ミッションの報酬${double ? '(二度押し)' : ''}`, double);
      await s.wait(1200);
      await s.dismissOverlays(6);
      claimed += 1;
    }
    await s.inspect();
  }
  return { claimed };
}

async function shopScenario(s) {
  const buy = await buyItems(s, { count: 3 });
  const gift = await receiveGifts(s, { count: 3 });
  const mission = await claimMissions(s);
  await s.backHome();
  const problems = buy.problems.length + gift.problems.length;
  return { ok: !problems, note: `アイテムを ${buy.bought}回買った・ギフトを ${gift.received}個受け取った・ミッションの報酬を ${mission.claimed}回受け取った${problems ? `・数が合わない ${problems}件` : '・数はすべて合った'}` };
}

module.exports = { shopScenario, buyItems, receiveGifts, claimMissions, storage, changedKeys };
