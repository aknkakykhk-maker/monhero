// 時計係: ブラウザの時計だけを動かして(端末の時刻を変えた人と同じ)、時刻で変わるものを見る。
//   ・ログインボーナス … 日の区切り(4:00)の前後・同じ日にもう一度・時計を過去へ戻す
//   ・イベントとキャンペーン … 開催中と終わったあとに開き、HOME の札が出る・消えるか
// 時計は context.clock で差し替える。差し替えたあとも時間はふつうに進む(演出やタイマーは止まらない)。
// ゲームの中身には手を入れない。読むのは保存値と、データファイルの一覧(RHYTHM_EVENTS など)だけ。

const JST = 9 * 3600 * 1000;
const jstDate = (ms) => new Date(ms + JST).toISOString().slice(0, 10);
const at = (date, hm) => new Date(`${date}T${hm}:00+09:00`);
const fmt = (d) => new Date(d.getTime() + JST).toISOString().slice(0, 16).replace('T', ' ');

const readLogin = (s) => s.page.evaluate(() => {
  const parse = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? f : v; } catch { return f; } };
  const lb = parse('mh_login_bonus', {});
  const gifts = parse('mh_gifts', []);
  return { total: Number(lb.totalLoginDays) || 0, period: lb.lastGrantedPeriod || null,
    gifts: (Array.isArray(gifts) ? gifts : []).filter((g) => g && /^gift_login_/.test(String(g.id))).length };
});

async function bootAt(s, when) {
  await s.context.clock.setSystemTime(when);
  await s.boot();
  await s.inspect();
}

async function loginBonusScenario(s) {
  const today = jstDate(Date.now());
  const yesterday = jstDate(Date.now() - 86400000);
  const steps = [];
  const problems = [];
  // ① 区切りの少し前に起動(はじめてなので、ここで1日目がもらえる)
  await s.context.clock.install({ time: at(today, '03:50') });
  await bootAt(s, at(today, '03:50'));
  const a = await readLogin(s);
  steps.push(`${fmt(at(today, '03:50'))} 累計${a.total}日`);
  if (a.total !== 1) problems.push(`はじめての起動で累計が ${a.total}日(1日のはず)`);
  // ② 区切り(4:00)をまたいでから開き直す → 次の日の分がもらえる
  await bootAt(s, at(today, '04:10'));
  const b = await readLogin(s);
  steps.push(`${fmt(at(today, '04:10'))} 累計${b.total}日`);
  if (b.total !== a.total + 1 || b.gifts !== a.gifts + 1) problems.push(`4:00をまたいだのに増えない(累計 ${a.total}→${b.total}日・ギフト ${a.gifts}→${b.gifts}件)`);
  // ③ 同じ日にもう一度 → 増えない
  await bootAt(s, at(today, '09:00'));
  const c = await readLogin(s);
  steps.push(`${fmt(at(today, '09:00'))} 累計${c.total}日`);
  if (c.total !== b.total || c.gifts !== b.gifts) problems.push(`同じ日にもう一度開いたら増えた(累計 ${b.total}→${c.total}日・ギフト ${b.gifts}→${c.gifts}件)`);
  // ④ 時計を過去へ戻す → 増えない・壊れない
  await bootAt(s, at(yesterday, '12:00'));
  const d = await readLogin(s);
  steps.push(`${fmt(at(yesterday, '12:00'))}(過去へ戻した) 累計${d.total}日`);
  if (d.total !== c.total || d.gifts !== c.gifts) problems.push(`時計を過去へ戻したら増えた(累計 ${c.total}→${d.total}日)`);
  for (const p of problems) await s.addIssue('日付の切り替え', `ログインボーナス: ${p}`);
  return { ok: !problems.length, note: steps.join(' → '), stats: { steps } };
}

// 見に行く時刻を、データファイルのイベント・キャンペーンから作る。
// 終わってから3週間より前のものは見ない(もう誰も遊ばない)
async function timePoints(s) {
  const list = await s.page.evaluate(() => {
    const pick = (x, type) => ({ id: x.id, name: x.name, type, startAt: x.startAt, endAt: x.endAt,
      banner: x.banner && typeof x.banner === 'object' && x.banner.title ? x.banner.title : '' });
    return [
      ...(typeof RHYTHM_EVENTS !== 'undefined' ? RHYTHM_EVENTS.map((x) => pick(x, 'イベント')) : []),
      ...(typeof RHYTHM_EVENT_POINT_CAMPAIGNS !== 'undefined' ? RHYTHM_EVENT_POINT_CAMPAIGNS.map((x) => pick(x, 'キャンペーン')) : []),
    ];
  }).catch(() => []);
  const since = Date.now() - 21 * 86400000;
  const points = [];
  for (const x of list) {
    const start = Date.parse(x.startAt), end = Date.parse(x.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < since) continue;
    points.push({ ...x, when: new Date(start + 3600000), phase: '開催中' });
    points.push({ ...x, when: new Date(end + 3600000), phase: '終わったあと' });
  }
  return points.sort((p, q) => p.when - q.when);
}

async function eventPeriodScenario(s) {
  const points = await timePoints(s);
  if (!points.length) return { ok: true, note: '見に行くイベント・キャンペーンが無い(どれも3週間より前に終わっている)' };
  const seen = [];
  let problems = 0;
  for (const p of points) {
    s.state.step += 1;
    await bootAt(s, p.when);
    const homeText = ((await s.health()) || {}).text || '';
    // HOME の札(banner を持つキャンペーンだけ)。開催中は出て、終わったら消えるはず
    if (p.banner) {
      const shown = homeText.includes(p.banner);
      if (p.phase === '開催中' && !shown) { problems += 1; await s.addIssue('時刻のずれ', `「${p.name}」の${fmt(p.when)}(開催中)に、HOME の札「${p.banner}」が出ていない`); }
      if (p.phase === '終わったあと' && shown) { problems += 1; await s.addIssue('時刻のずれ', `「${p.name}」の${fmt(p.when)}(終わったあと)にも、HOME の札「${p.banner}」が出ている`); }
    }
    // ランキングイベントは、モンヒロビートの画面も開いて見る(開催中・終了後の表示で真っ白やエラーにならないか)
    let inRhythm = null;
    if (p.type === 'イベント') {
      await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
      await s.wait(2500);
      await s.dismissOverlays(10);
      await s.inspect();
      inRhythm = (((await s.health()) || {}).text || '').includes(p.name);
      await s.shot(`clock-${p.id}-${p.phase}`);
      await s.backHome();
    }
    seen.push(`${p.name}(${p.phase} ${fmt(p.when)}${inRhythm === null ? '' : inRhythm ? '・画面に名前あり' : '・画面に名前なし'})`);
  }
  return { ok: !problems, note: `${points.length}か所の時刻で開いた: ${seen.join(' / ')}`, stats: { seen } };
}

module.exports = { loginBonusScenario, eventPeriodScenario };
