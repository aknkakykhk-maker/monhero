// ストーリー: 時刻で流れるストーリーが正しく流れるか、回想を最後まで読めるかを見る。
//   ① 流れる条件 … ハロウィン・ナイト第1部(HALLOWEEN_NIGHT_STORIES の at)を例に、時計を開始の前と後に合わせて起動し、
//      前は「見た」記録が付かず、後は付くか(既読を入れない下準備で始める・ストーリー係の quiet: false)
//   ② 回想 … プロフィールの「イベント回想」から1つずつ開き、「◯ / 全◯」の最後まで進んで閉じられるか
// 2026-10-07 に「マスモンとセッション」のストーリーが流れなかった不具合があった。同じ種類を探す担当。
const JST = 9 * 3600 * 1000;
const fmt = (ms) => new Date(ms + JST).toISOString().slice(0, 16).replace('T', ' ');

// そのストーリーの id が、保存のどこかに「見た」として残っているか
const seenAnywhere = (s, id) => s.page.evaluate((needle) => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if ((localStorage.getItem(k) || '').includes(needle) || k.includes(needle)) return k; }
  return '';
}, id);

// 時刻で流れる部を、データファイル(data/rhythm-event.js)から読む。起動より前に時計を合わせたいので、ページではなくファイルから読む
function timedStory() {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'monster-hero', 'data', 'rhythm-event.js'), 'utf8');
  const startAt = (src.match(/HALLOWEEN_NIGHT_START_AT\s*=\s*'([^']+)'/) || [])[1];
  const id = (src.match(/const HALLOWEEN_NIGHT_STORIES\s*=\s*Object\.freeze\(\[\s*Object\.freeze\(\{\s*id:\s*'([^']+)'/) || [])[1];
  return startAt && id ? { id, start: Date.parse(startAt) } : null;
}

async function storyTimingScenario(s) {
  const story = timedStory();
  if (!story || !Number.isFinite(story.start)) return { ok: true, note: '時刻で流れるストーリーが読めない(データの形が変わった)' };
  const problems = [];
  // 開始の1時間前に起動 → 流れないはず
  await s.context.clock.install({ time: new Date(story.start - 3600 * 1000) });
  await s.boot();
  await s.inspect();
  const before = await seenAnywhere(s, story.id);
  if (before) problems.push(`開始(${fmt(story.start)})の1時間前に起動したのに、「${story.id}」を見た記録が付いた(早く流れた)`);
  // 開始の10分後に開き直す → 流れるはず
  await s.context.clock.setSystemTime(new Date(story.start + 10 * 60 * 1000));
  await s.boot();
  await s.inspect();
  const after = await seenAnywhere(s, story.id);
  if (!after) problems.push(`開始(${fmt(story.start)})の10分後に開き直したのに、「${story.id}」を見た記録が付かない(流れていない)`);
  for (const p of problems) await s.addIssue('ストーリーが流れない', p);
  // 回想の確かめのため、時計をいまへ戻す
  await s.context.clock.setSystemTime(new Date());
  await s.boot();
  return { ok: !problems.length, note: `${story.id}(${fmt(story.start)}から): 1時間前は${before ? '流れた(早い)' : '流れない'} → 10分後は${after ? '流れた' : '流れない'}` };
}

async function replayScenario(s, { max = 6 } = {}) {
  // 既読を入れていないので、起動のたびにストーリーが流れて HOME を覆う。閉じきってから開く
  await s.dismissOverlays(60);
  await s.backHome();
  await s.dismissOverlays(60);
  if (!(await s.tapLabel(/^プロフィールを開く$/, 1500))) { await s.addIssue('進めない', 'HOME からプロフィールが開けない'); return { ok: false, note: 'プロフィールが開けない' }; }
  await s.dismissOverlays(4);
  if (!(await s.tapLabel(/^イベント回想/, 1200))) {
    await s.page.evaluate(() => { const el = [...document.querySelectorAll('h3,b,button')].find((x) => /イベント回想/.test(x.innerText || '')); if (el) el.scrollIntoView({ block: 'center' }); });
    await s.wait(400);
    await s.tapLabel(/^イベント回想/, 1200);
  }
  // 回想は2ページ(2026-10-07)。1ページ目はイベント単位のパネル、押すとそのまとまりのお話の一覧(2ページ目)へ。
  // 全パネルを順に開いて、見返せるお話を集める(まとまりごとに1本ずつ → 足りなければ続きから)
  const openPanel = async (id) => {
    await s.page.evaluate(() => { document.querySelector('[data-event-replay-back]')?.click(); });
    await s.wait(250);
    const ok = await s.page.evaluate((gid) => { const b = document.querySelector(`[data-event-replay-group="${gid}"]`); if (b) { b.click(); return true; } return false; }, id);
    await s.wait(350);
    return ok;
  };
  const episodeLabels = () => s.page.evaluate(() => [...document.querySelectorAll('[data-event-replay-episodes] button')]
    .filter((x) => /タップして見返/.test(x.innerText || '')).map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40)));
  const panelIds = await s.page.evaluate(() => [...document.querySelectorAll('[data-event-replay-group]')].map((x) => x.getAttribute('data-event-replay-group')));
  if (process.env.PLAYBOT_DEBUG) console.log(`    [回想] パネル: ${panelIds.join(' | ')}`);
  const all = [];
  for (const id of panelIds) {
    if (!(await openPanel(id))) continue;
    for (const label of await episodeLabels()) all.push({ panel: id, label });
  }
  if (!all.length) { await s.addIssue('たどり着けない', 'イベント回想に見返せるストーリーが1つも無い'); return { ok: false, note: '回想が無い' }; }
  // まとまりごとに1本ずつ先に取り、残りを順に足す
  const firsts = panelIds.map((id) => all.find((x) => x.panel === id)).filter(Boolean);
  const picks = [...firsts, ...all.filter((x) => !firsts.includes(x))].slice(0, max);
  const done = [], stuck = [];
  for (const item of picks) {
    const title = item.label.replace(/\s*\d{4}\/\d{2}\/\d{2}.*$/, '');
    // 1本読み終えると、同じまとまりのお話の一覧へ戻る。ほかのまとまりのお話は、パネルから開き直す
    if (!(await s.page.evaluate(() => !!document.querySelector('[data-event-replay-page]')))) await s.tapLabel(/^イベント回想/, 1000);
    await openPanel(item.panel);
    const fresh = (await s.listButtons()).find((b) => b.label === item.label);
    if (!fresh) { stuck.push(`${title}(一覧で見つからない)`); continue; }
    await s.tap(fresh, `回想: ${title}`);
    await s.wait(900);
    let maxSeen = 0, total = 0;
    for (let k = 0; k < 120; k++) {
      const prog = await s.page.evaluate(() => { const m = document.body.innerText.match(/(\d+)\s*\/\s*(\d+)\s*(次へ|▶)/); return m ? [Number(m[1]), Number(m[2])] : null; });
      if (prog) { maxSeen = Math.max(maxSeen, prog[0]); total = prog[1]; }
      const next = (await s.listButtons()).find((b) => b.overlay && /^(次へ|▶ つぎ|つぎ|とじる|閉じる|OK|おわり)$/.test(b.label));
      if (!next) break;
      s.state.step += 1;
      await s.tap(next, '回想を読み進める');
    }
    await s.inspect();
    if (total && maxSeen < total) { stuck.push(title); await s.addIssue('回想が最後まで読めない', `回想「${title}」が ${maxSeen} / ${total} で止まった`); }
    else done.push(`${title}(${total || '?'}場面)`);
    await s.dismissOverlays(6);
  }
  await s.backHome();
  return { ok: !stuck.length, note: `回想を ${done.length}本 最後まで読んだ${stuck.length ? `・止まった ${stuck.join('・')}` : ''}` };
}

module.exports = { storyTimingScenario, replayScenario };
