// イベント: 開催中のレイド(ジャック)とハロウィン・ナイトを遊ぶ。
//   ・レイドの「バトルで挑戦する」を1回遊ぶ(ベースモンで編成 → タクティクスの盤面で20ターン)
//   ・挑戦すると今日の残り回数が1回分だけ減るか
//   ・与えたダメージが記録として送られるか(にせの Supabase が受け止める。本物の共有HPは減らさない・CLAUDE.md ⑦)
//   ・ランキングと報酬一覧、HOME のハロウィン・ナイトの札も開いて見る
// レイドが開催されていない時期は、入口が無いので「開催中のイベントなし」で終わる(不具合にしない)。
const { fightTactics } = require('./tactics');

const remainOf = (s) => s.page.evaluate(() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/今日の残り\s*(\d+)\s*回/); return m ? Number(m[1]) : null; });

async function openRaid(s) {
  await s.backHome();
  const b = (await s.listButtons()).find((x) => /レイド画面を開く/.test(x.label));
  if (!b) return false;
  await s.tap(b, 'レイドを開く');
  await s.wait(1200);
  await s.dismissOverlays(6);
  await s.tapLabel(/^わかった$/, 600);
  await s.inspect();
  return true;
}

// 20ターン戦い切ったときに、与えたダメージが raid_jack_hits へ1行送られる(36-raid-jack-api.jsx)。途中でやめると送られないので、上限は長めにとる
async function raidScenario(s, { maxMs = 660000 } = {}) {
  if (!(await openRaid(s))) return { ok: true, note: '開催中のレイドなし(HOME に入口が無い)' };
  const remain0 = await remainOf(s);
  if (!(await s.tapLabel(/^バトルで 挑戦する$/, 1500))) { await s.addIssue('進めない', 'レイドに「バトルで挑戦する」が無い'); return { ok: false, note: '挑戦できない' }; }
  await s.inspect();
  // 編成: 勇者モンを1体(上の並び)、供モンを2体(下の並び)。アシカは最初から3枚選ばれている
  const names = (await s.listButtons()).filter((b) => !/詳細|^戻る$/.test(b.label) && /^\S+$/.test(b.label));
  const half = Math.floor(names.length / 2);
  const heroes = names.slice(0, Math.min(8, half)), allies = names.slice(Math.min(8, half), Math.min(16, names.length));
  if (heroes.length) await s.tap(heroes[Math.floor(s.rand() * heroes.length)], '勇者モンを選ぶ');
  await s.wait(500);
  for (let k = 0; k < 2 && allies.length; k++) {
    const list = (await s.listButtons()).filter((b) => allies.some((a) => a.label === b.label && Math.abs(a.y - b.y) < 4));
    if (list.length) await s.tap(list[Math.floor(s.rand() * list.length)], '供モンを選ぶ');
    await s.wait(400);
  }
  await s.inspect();
  // 始める(二度押し)。ボタンは画面の下のほう
  await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && !x.disabled && /挑戦する|始める|出撃|この編成で/.test((x.innerText || '').trim()) && !/バトルで|モンヒロビートで/.test(x.innerText || '')); if (b) b.scrollIntoView({ block: 'center' }); });
  await s.wait(300);
  const start = (await s.listButtons()).find((b) => /挑戦する|始める|出撃|この編成で/.test(b.label) && !/バトルで|モンヒロビートで/.test(b.label));
  if (!start) { await s.addIssue('進めない', 'レイドの編成から始めるボタンが見つからない', { buttons: (await s.listButtons()).map((b) => b.label).slice(0, 30) }); return { ok: false, note: '始められない' }; }
  // ★ここは1回だけ押す。二度押しすると、2回目が次の配置画面の同じ位置にある「選び直す」側へ当たり、編成へ戻ってしまう
  await s.tap(start, start.label);
  // 配置場所(距離)を決める画面などが挟まる。盤面(手札)が出るまで、人と同じく順に進める
  for (let k = 0; k < 20 && !(await s.page.evaluate(() => !!document.querySelector('[data-hand-card]'))); k++) {
    await s.wait(900);
    await s.dismissOverlays(4);
    const list = await s.listButtons();
    const go = list.find((b) => /^(出撃|バトル開始|決定|確定|はじめる|習得する|強化する|この編成で挑戦する)$/.test(b.label))
      || list.find((b) => /^(零|近|中|遠)距離/.test(b.label))
      || list.find((b) => /新規習得|強化後/.test(b.label));
    if (go) await s.tap(go, 'レイドの準備');
  }
  const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-hand-card]'), { timeout: 15000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', 'レイドの編成から盤面へ入れない'); return { ok: false, note: '盤面へ入れない' }; }
  const stats = { turns: 0, waveReached: 0, downs: 0, aimedDanger: 0, guardsWhenAimed: 0, dangerNoGuard: 0, exUsed: 0, discards: 0, pickFailed: 0, cards: {} };
  const writes0 = s.supabase.writes.length;
  await fightTactics(s, stats, { maxMs, waves: false, speedUp: true });
  await s.wait(2500);
  await s.shot('raid-result');
  await s.inspect();
  await s.dismissOverlays(10);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(レイドへ戻る|戻る|閉じる|OK|次へ|結果を閉じる)$/, 1200))) break; }
  const sent = s.supabase.writes.slice(writes0).map((w) => w.table);
  // 残り回数をもう一度見る
  await openRaid(s);
  const remain1 = await remainOf(s);
  const problems = [];
  if (remain0 !== null && remain1 !== null && remain0 - remain1 > 1) problems.push(`レイドに1回挑戦したら、今日の残りが ${remain0} → ${remain1} 回(1回分だけ減るはず)`);
  if (remain0 !== null && remain1 !== null && remain0 === remain1) problems.push(`レイドに挑戦したのに、今日の残りが ${remain0} 回のまま`);
  if (stats.turns >= 20 && !sent.includes('raid_jack_hits')) problems.push(`レイドで20ターン戦い切ったのに、与えたダメージの記録(raid_jack_hits)が送られていない(送った表: ${[...new Set(sent)].join(', ') || 'なし'})`);
  for (const p of problems) await s.addIssue('レイドの数が合わない', p);
  // ランキングと報酬一覧も開く
  for (const re of [/ランキング$/, /報酬一覧$/]) {
    if (await s.tapLabel(re, 1500)) { await s.inspect(); await s.dismissOverlays(4); await s.tapLabel(/^(閉じる|戻る)$/, 800); }
  }
  await s.backHome();
  return { ok: !problems.length, note: `レイドに挑戦: ${stats.turns}ターン戦った・今日の残り ${remain0}→${remain1}回・送った記録 ${sent.length}件(${[...new Set(sent)].join(', ') || 'なし'}・本物へは届けていない)` };
}

async function halloweenScenario(s) {
  await s.backHome();
  const b = (await s.listButtons()).find((x) => /^(🎃 )?ハロウィン・ナイト/.test(x.label));
  if (!b) return { ok: true, note: '開催中のハロウィン・ナイトなし(HOME に札が無い)' };
  await s.tap(b, 'ハロウィン・ナイトの札');
  await s.wait(1200);
  await s.inspect();
  const where = await s.screenName();
  await s.dismissOverlays(6);
  await s.backHome();
  return { ok: true, note: `ハロウィン・ナイトの札を押した → ${where}` };
}

module.exports = { raidScenario, halloweenScenario };
