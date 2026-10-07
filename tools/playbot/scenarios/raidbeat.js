// レイドのモンヒロビート挑戦: レイドの「モンヒロビートで挑戦する」から曲を選び、最後まで演奏する。
//   ・「決定」を二度押ししても、今日の挑戦回数(mh_raid_jack_v1)は1回分しか増えない
//   ・演奏が終わると、与えたダメージが raid_jack_hits へ1行送られる(にせの Supabase が受け止める。本物の共有HPは減らさない)
//   ・結果画面に出たダメージと、送った記録のダメージが同じか
// レイドが開催されていない時期は、入口が無いので何もしない(不具合にしない)。
// 押し方は音ゲー係と同じ(scenarios/rhythm.js の installPlayer)。同時に動かすと押すのが遅れるので、1人で動かす。
const { installPlayer, collectFingerSuspects, installArgs } = require('./rhythm');

const raidState = (s) => s.page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_raid_jack_v1') || 'null'); } catch { return null; } });
// 今日の挑戦回数。ベースモンの挑戦(a)とマスモンの挑戦(b)で別に数える。モンヒロビートの挑戦はベースモン側(a)に入るので、合計で見る
const usedOf = (st) => (st && (st.a || st.b) ? (Number(st.a && st.a.used) || 0) + (Number(st.b && st.b.used) || 0) : null);
const readNum = (t) => Number(String(t || '').replace(/[^\d]/g, '')) || 0;

async function raidBeatScenario(s, { maxSongMs = 240000 } = {}) {
  await s.backHome();
  const entry = (await s.listButtons()).find((x) => /レイド画面を開く/.test(x.label));
  if (!entry) return { ok: true, note: '開催中のレイドなし(HOME に入口が無い)' };
  await s.tap(entry, 'レイドを開く');
  await s.wait(1200);
  await s.dismissOverlays(6);
  await s.tapLabel(/^わかった$/, 600);
  if (!(await s.tapLabel(/^モンヒロビートで 挑戦する$/, 2500))) return { ok: true, note: 'レイドにモンヒロビートの挑戦が無い(公開前か終わった)' };
  await s.dismissOverlays(6);
  await s.tapLabel(/^この案内を閉じる$/, 600);
  await s.inspect();
  const before = await raidState(s);
  // 曲と難易度(EASY〜NORMAL)を選ぶ
  const songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label) && !/大きく見る|お気に入り/.test(b.label));
  if (!songs.length) { await s.addIssue('進めない', 'レイドの曲えらびに曲が出ていない'); return { ok: false, note: '曲が無い' }; }
  const song = songs[Math.floor(s.rand() * Math.min(songs.length, 6))];
  await s.tap(song, '曲を選ぶ');
  const diffs = (await s.listButtons()).filter((b) => /^\d+ (EASY|NORMAL)\b/.test(b.label));
  if (diffs.length) await s.tap(diffs[Math.floor(s.rand() * diffs.length)], '難易度を選ぶ');
  const go = (await s.listButtons()).find((b) => /^決定$/.test(b.label));
  if (!go) { await s.addIssue('進めない', 'レイドの曲えらびに「決定」が無い'); return { ok: false, note: '決定が無い' }; }
  // 決定(二度押し)
  await s.page.mouse.click(go.x, go.y); await s.wait(120);
  await s.tap(go, '決定(二度押し)');
  await s.dismissOverlays(4);
  const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', 'レイドの曲えらびで「決定」しても演奏が始まらない'); return { ok: false, note: '演奏が始まらない' }; }
  const writes0 = s.supabase.writes.length;
  const installed = await s.page.evaluate(installPlayer, installArgs(s));
  if (!installed.ok) { await s.addIssue('進めない', `レイドで演奏できない: ${installed.why}`); return { ok: false, note: '演奏できない' }; }
  const t0 = Date.now();
  const fingers = {};
  while (Date.now() - t0 < maxSongMs) {
    await s.wait(2000);
    await collectFingerSuspects(s, fingers);
    s.state.step += 1;
    const playing = await s.page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null) && !!document.querySelector('[data-rhythm-play-area]'));
    if (!playing) break;
  }
  if (Date.now() - t0 >= maxSongMs) await s.addIssue('進行停止', `レイドの演奏が${Math.round(maxSongMs / 1000)}秒たっても終わらない`);
  // 演奏の結果 →「レイドの結果を見る」でダメージが出る。演出が終わるまで待ってから文字を読む
  await s.wait(4000);
  await collectFingerSuspects(s, fingers, true);
  await s.shot('raidbeat-score');
  await s.inspect();
  if (!(await s.tapLabel(/^レイドの結果を見る$/, 1500))) await s.addIssue('進めない', 'レイドで演奏したあと、結果に「レイドの結果を見る」が無い');
  await s.wait(5000);
  const text = (((await s.health()) || {}).text || '').replace(/\s+/g, ' ');
  const shownDamage = (() => { const m = text.match(/([\d,]{3,})\s*(ダメージ|DAMAGE)/i) || text.match(/(ダメージ|DAMAGE)\D{0,12}([\d,]{3,})/i); return m ? readNum(m[1].match(/\d/) ? m[1] : m[2]) : null; })();
  if (process.env.PLAYBOT_DEBUG) console.log(`    [レイド音ゲー] 結果の文字: ${(text.match(/.{0,60}(ダメージ|DAMAGE|与ダメ).{0,60}/i) || [''])[0]}`);
  await s.shot('raidbeat-result');
  await s.inspect();
  const hits = s.supabase.writes.slice(writes0).filter((w) => w.table === 'raid_jack_hits').map((w) => w.row);
  const sentDamage = hits.reduce((a, r) => a + (Number(r.damage) || 0), 0);
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(レイドへ戻る|曲えらびへ(戻る)?|戻る|閉じる|OK|次へ)$/, 1500))) break; }
  const after = await raidState(s);
  const problems = [];
  const u0 = usedOf(before), u1 = usedOf(after);
  if (u0 !== null && u1 !== null && u1 - u0 > 1) problems.push(`「決定」を二度押ししたら、今日の挑戦回数が ${u0} → ${u1}(1回分だけ増えるはず)`);
  if (u0 !== null && u1 !== null && u1 === u0) problems.push(`レイドで演奏したのに、今日の挑戦回数が ${u0} のまま`);
  if (!hits.length) problems.push('演奏し終えたのに、与えたダメージの記録(raid_jack_hits)が送られていない');
  if (hits.length > 1) problems.push(`1回の演奏で、ダメージの記録が ${hits.length}件送られた`);
  if (shownDamage && sentDamage && shownDamage !== sentDamage) problems.push(`結果画面のダメージは ${shownDamage.toLocaleString()} なのに、送った記録は ${sentDamage.toLocaleString()}`);
  for (const p of problems) await s.addIssue(/二度押し/.test(p) ? '二度押しで二重' : 'レイドの数が合わない', p);
  if (process.env.PLAYBOT_DEBUG) console.log(`    [レイド音ゲー] 回数 ${u0}→${u1} 画面のダメージ ${shownDamage} 送った ${sentDamage} 行 ${JSON.stringify(hits[0] || {}).slice(0, 300)}`);
  await s.backHome();
  return { ok: !problems.length, note: `${song.label.replace(/\s*Lv\..*$/, '')} を ${installed.notes}ノーツ演奏・今日の挑戦回数 ${u0}→${u1}(決定は二度押し)・ダメージ 画面 ${shownDamage ?? '?'} / 送った記録 ${sentDamage}(本物へは届けていない)` };
}

module.exports = { raidBeatScenario };
