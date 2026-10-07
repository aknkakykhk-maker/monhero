// 育成: マスモンの強化ポイントを振って確定し、保存値が正しく動くかを見る。
//   ① 「＋」で振っているあいだ(確定する前)は、保存データが変わらない(画面にもそう書いてある)
//   ② 「完了」で確定すると、振った数だけ強化ポイントが減り、間合い適性・ステータスへ入る
//   ③ 「完了」をすばやく2回押しても、2回分は入らない
// マスモンは下準備の昔のキー(mh_bond_xp)から、起動時の一度きりの移行で作られる(育成係の storage)。
// 遊ぶのはボットのブラウザの中だけ。手元・本番のセーブには触れない(CLAUDE.md ⑦)。

const masuOf = (s) => s.page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('mh_masu_mons') || '[]') || []).filter(Boolean); } catch { return []; }
});
// 振ったポイントの合計(ステータスへ振った分 + 間合い適性に使った分は distAptPoints の減りで見る)
const spentOf = (m) => Object.values((m && m.statPoints) || {}).reduce((a, v) => a + (Number(v) || 0), 0);

// aria-label で探して、見えるところまで送ってから人と同じく押す
async function tapAria(s, re, why) {
  const ok = await s.page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll('button[aria-label]')].find((x) => !x.disabled && x.offsetParent && re.test(x.getAttribute('aria-label')));
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    return true;
  }, re.source);
  if (!ok) return false;
  await s.wait(250);
  const b = (await s.listButtons()).find((x) => re.test(x.label));
  if (!b) return false;
  await s.tap(b, why);
  return true;
}

async function growScenario(s, { taps = 4, double = true } = {}) {
  await s.backHome();
  const masus = await masuOf(s);
  if (!masus.length) { await s.addIssue('進めない', '下準備したのにマスモンが1体もいない(移行が動いていない)'); return { ok: false, note: 'マスモンがいない' }; }
  // ポイントがいちばん残っている子を育てる
  const target = [...masus].sort((a, b) => (b.distAptPoints || 0) - (a.distAptPoints || 0))[0];
  const name = target.name || target.baseId;
  if (!(await s.tapLabel(/^M\/B管理$/, 1500))) return { ok: false, note: 'M/B管理が無い' };
  await s.dismissOverlays(6);
  if (!(await s.tapLabel(/^マスモン一覧\(バトル\)/, 1500))) return { ok: false, note: 'マスモン一覧が無い' };
  await s.dismissOverlays(6);
  const tile = (await s.listButtons()).find((b) => new RegExp(`^\\d+ ${name} `).test(b.label));
  if (!tile) { await s.addIssue('たどり着けない', `マスモン一覧に「${name}」が見当たらない`); return { ok: false, note: `${name}が一覧に無い` }; }
  await s.tap(tile, `${name}の詳細`);
  await s.wait(800);
  await s.inspect();
  if (!(await s.tapLabel(new RegExp(`^${name}を強化$`), 1500))) { await s.addIssue('進めない', `${name}の詳細に「強化」が無い`); return { ok: false, note: '強化が無い' }; }
  await s.inspect();

  const before = (await masuOf(s)).find((m) => m.id === target.id);
  // ① ＋を何回か押す(ステータスと間合い適性をまぜる)
  const plus = await s.page.evaluate(() => [...document.querySelectorAll('button[aria-label]')]
    .map((x) => x.getAttribute('aria-label')).filter((l) => /を増やす$/.test(l)));
  let pressed = 0;
  for (let k = 0; k < taps && plus.length; k++) {
    const label = plus[Math.floor(s.rand() * plus.length)];
    if (await tapAria(s, new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`), '強化ポイントを振る')) pressed += 1;
  }
  const draft = (await masuOf(s)).find((m) => m.id === target.id);
  const restText = await s.page.evaluate(() => (document.body.innerText.replace(/\s+/g, ' ').match(/残りpt\s*\d+\s*\/\s*\d+/) || [''])[0]);
  if (process.env.PLAYBOT_DEBUG) { console.log(`    [育成] 押した＋: ${plus.length}種 / 下書きの ${restText}`); await s.shot('grow-draft'); }
  const changedBeforeConfirm = JSON.stringify(draft) !== JSON.stringify(before);
  if (changedBeforeConfirm) await s.addIssue('確定前に保存が変わる', `${name}の強化で「＋」を押しただけで、確定する前に保存データが変わった`);

  // ② ③ 画面下の「◯ptを使って強化する」で確定する(すばやく2回押す)。
  //   ★「完了」は保存のボタンではない(下書きを捨てて詳細へ戻る。65-screen-masu-enhance.jsx の backToDetail)
  const done = (await s.listButtons()).find((b) => /ptを使って強化する$/.test(b.label));
  if (!done) { await s.addIssue('進めない', `${name}の強化画面に「◯ptを使って強化する」が無い`); return { ok: false, note: '確定のボタンが無い' }; }
  if (double) { await s.page.mouse.click(done.x, done.y); await s.wait(120); }
  await s.tap(done, `${done.label}${double ? '(二度押し)' : ''}`);
  await s.wait(1500);
  await s.dismissOverlays(6);
  await s.inspect();
  const after = (await masuOf(s)).find((m) => m.id === target.id);
  const pointsUsed = (before.distAptPoints || 0) - (after.distAptPoints || 0);
  const statGain = spentOf(after) - spentOf(before);
  const aptChanged = JSON.stringify(after.distApt) !== JSON.stringify(before.distApt);
  const problems = [];
  if (pressed && pointsUsed <= 0) problems.push(`「＋」を${pressed}回押して確定したのに、強化ポイントが減っていない(${before.distAptPoints} → ${after.distAptPoints})`);
  if (pointsUsed > pressed) problems.push(`「＋」は${pressed}回なのに、強化ポイントが ${pointsUsed} 減った(完了の二度押しで二重に入った疑い)`);
  if (pointsUsed > 0 && statGain <= 0 && !aptChanged) problems.push(`強化ポイントが ${pointsUsed} 減ったのに、ステータスにも間合い適性にも入っていない`);
  for (const p of problems) await s.addIssue('育成の数が合わない', `${name}: ${p}`);
  if (process.env.PLAYBOT_DEBUG) console.log(`    [育成] ${name} ＋${pressed}回 ポイント ${before.distAptPoints}→${after.distAptPoints} ステータス +${statGain} 適性 ${JSON.stringify(before.distApt)}→${JSON.stringify(after.distApt)}`);

  // 「完了」で下書きが黙って消えるか(人は「完了」を保存だと思って押しやすい)
  let draftLostSilently = false;
  const plus2 = (await s.listButtons()).find((b) => /を増やす$/.test(b.label));
  if (plus2) {
    const mid = (await masuOf(s)).find((m) => m.id === target.id);
    await s.tap(plus2, '強化ポイントを振る(下書き)');
    await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^完了$/.test((x.innerText || '').trim())); if (b) b.scrollIntoView({ block: 'center' }); });
    await s.wait(300);
    const fin = (await s.listButtons()).find((b) => /^完了$/.test(b.label));
    if (fin) {
      await s.tap(fin, '完了(下書きのまま)');
      await s.wait(800);
      const asked = (await s.listButtons()).some((b) => b.overlay && /破棄|捨て|保存せず|やめる|強化する/.test(b.label));
      const now = (await masuOf(s)).find((m) => m.id === target.id);
      draftLostSilently = !asked && JSON.stringify(now) === JSON.stringify(mid);
      if (draftLostSilently) await s.addIssue('下書きが黙って消える', `マスモン強化で「＋」を振ったあと「完了」を押すと、ひとことも無く振った分が消える(保存は画面下の「◯ptを使って強化する」)。「完了」を押したときに確かめるか、名前を「戻る」にするか`);
      await s.dismissOverlays(4);
    }
  }

  // ついでに編成と図鑑も開いて見る(開けるか・崩れないか)
  for (const entry of [/^モンスター編成/, /^モンスター図鑑/, /^放牧設定/]) {
    await s.backHome();
    await s.tapLabel(/^M\/B管理$/, 1500);
    await s.dismissOverlays(6);
    if (await s.tapLabel(entry, 1500)) { await s.dismissOverlays(6); await s.inspect(); }
  }
  await s.backHome();
  const ok = !problems.length && !changedBeforeConfirm;
  return { ok, note: `${name}に ＋${pressed}回 → 確定(二度押し)で強化ポイント ${before.distAptPoints}→${after.distAptPoints}・ステータス +${statGain}${aptChanged ? '・間合い適性が上がった' : ''}${ok ? '・数は合った' : `・合わない ${problems.length + (changedBeforeConfirm ? 1 : 0)}件`}` };
}

module.exports = { growScenario };
