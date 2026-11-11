#!/usr/bin/env node
// バトルの「手ごたえ」を、止め絵の並びと短い動画にして docs/progress/battle-feel/ へ出す(社長に案を選んでもらうための見本づくり)。
//
//   node tools/battle/battle-feel-filmstrip.js now      … いまの画面。本物のオートを録って、当たった瞬間の前後を並べる
//   node tools/battle/battle-feel-filmstrip.js a b c    … 案の見本。本物のバトル画面の上へ docs/progress/battle-feel/proposals.js を
//                                                        その場で足し、コマ送りで撮る(ゲーム本体は変えない)
//   node tools/battle/battle-feel-filmstrip.js after    … 手ごたえを本体に入れたあとの画面。ふつう・会心・倒した を1つずつ並べる
//   引数なしは now a b c の全部。ROOT_DIR=<別のツリー> でほかのツリーを撮れる
//
// 出すもの: strip-<名前>.jpg(止め絵の並び)/ clip-<名前>.mp4(動画。ffmpeg があるときだけ)。最後の1行に OK/NG
// ⚠️ 案の数字(24・68 など)は見本用の作り物。当たりの間(ヒットストップ)は、動画では同じ絵を続けて入れて表している。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { openTacticsBattle } = require('./lib/tactics-battle-page');

const REPO = path.resolve(__dirname, '..', '..');
const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : REPO;
const OUT = path.join(REPO, 'docs', 'progress', 'battle-feel');
const PORT = Number(process.env.PORT_NO || 8951);
const NAMES = process.argv.slice(2).filter((x) => ['now', 'after', 'a', 'b', 'c'].includes(x));
const TARGETS = NAMES.length ? NAMES : ['now', 'a', 'b', 'c'];
const OFFS_AFTER = [-70, 0, 60, 130, 220, 400];
const CLIP = { x: 0, y: 40, width: 390, height: 530 };   // 敵と4枠が入る範囲
const SCENES = [['normal', 'ふつうの当たり'], ['crit', '会心'], ['combo', '3連撃'], ['effect', '反射・吸収・回避'], ['defeat', '倒した']];
const TITLES = { now: 'いま(本物のオートを録ったもの)', after: '入れたあと(本物のオートを録ったもの。当たりの間が入った瞬間を 0 にしている)', a: '案A キレ(当たりの間+強弱)', b: '案B ドカン(会心と撃破を大きく)', c: '案C わかる(軽さ優先・札で知らせる)' };
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

// 止め絵の並びを1枚にする(行 = 場面、列 = 時刻)。ブラウザに並べさせて撮る
const composeStrip = async (ctx, name, rows) => {
  const page = await ctx.newPage();
  const html = `<body style="margin:0;background:#0b1020;color:#e2e8f0;font-family:sans-serif;width:${rows[0].cells.length * 200 + 120}px">
    <div style="padding:10px 12px;font-size:20px;font-weight:900">${TITLES[name]}</div>
    ${rows.map((r) => `<div style="display:flex;align-items:center;border-top:1px solid #334155"><div style="width:108px;padding:0 6px;font-size:15px;font-weight:700">${r.label}${r.note ? `<div style="font-size:11px;font-weight:400;color:#94a3b8;margin-top:4px">${r.note}</div>` : ''}</div>
      ${r.cells.map((c) => `<div style="width:200px;text-align:center;padding:4px 0"><img src="data:image/jpeg;base64,${c.b64}" style="width:195px;display:block;margin:0 auto"><div style="font-size:12px;color:#94a3b8">${c.t}</div></div>`).join('')}</div>`).join('')}</body>`;
  await page.setViewportSize({ width: rows[0].cells.length * 200 + 120, height: 600 });
  await page.setContent(html);
  await page.waitForTimeout(300);
  const file = path.join(OUT, `strip-${name}.jpg`);
  await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72, scale: 'css' });
  await page.close();
  return file;
};

// 連番の絵 → 動画。frames は [{ file, ms }](ms はその絵を出しておく時間)
const encode = (name, frames, dir) => {
  if (!hasFfmpeg || !frames.length) return null;
  const list = path.join(dir, `${name}.txt`);
  fs.writeFileSync(list, frames.map((f) => `file '${f.file}'\nduration ${(f.ms / 1000).toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`);
  const file = path.join(OUT, `clip-${name}.mp4`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-movflags', '+faststart', file]);
  return r.status === 0 ? file : null;
};

const shootNow = async (run, dir, name = 'now') => {
  const { page, ctx } = run;
  const cdp = await ctx.newCDPSession(page);
  const shots = [];
  cdp.on('Page.screencastFrame', (f) => { shots.push({ t: f.metadata.timestamp * 1000, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await page.evaluate((forceCrit) => {
    // FORCE_CRIT=1: 会心を出して撮るための確かめ用。乱数を小さい値に寄せるだけ(ゲーム本体は変えない)
    if (forceCrit) { const r = Math.random.bind(Math); let n = 0; Math.random = () => (++n % 3 ? 0.002 : r()); }
    window.__hits = [];
    document.addEventListener('animationstart', (e) => { if (/^(thmHitCore|tacticsHitRing|kzHurt)$/.test(e.animationName)) window.__hits.push(Date.now()); }, true);
    // 手ごたえが入ったあとの版は、当たりの間が入った瞬間(data-feel-stop)と数字の札が出た瞬間を「当たり」とする
    window.__feelHits = [];
    new MutationObserver(() => { const r = document.querySelector('[data-feel-stop]'); if (r) window.__feelHits.push([Date.now(), r.getAttribute('data-feel-stop')]); }).observe(document.getElementById('root'), { attributes: true, subtree: true, attributeFilter: ['data-feel-stop'] });
    const auto = [...document.querySelectorAll('button')].find((x) => /AUTO/.test(x.textContent) && /OFF/.test(x.textContent));
    if (auto) auto.click();
  }, process.env.FORCE_CRIT === '1');
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 });
  await page.waitForTimeout(name === 'after' ? 26000 : 16000);
  await cdp.send('Page.stopScreencast');
  const feel = await page.evaluate(() => window.__feelHits);
  const raw = name === 'after' ? feel.map((x) => x[0]) : await page.evaluate(() => window.__hits);
  // 入れたあとの版は、種類(ふつう・会心・撃破)が1つずつ入るように選ぶ
  const pick = name === 'after' ? ['normal', 'crit', 'defeat'].map((t) => (feel.find((x) => x[1] === t) || [])[0]).filter(Boolean).sort((a, b) => a - b) : [];
  const hits = pick.length ? pick : raw.filter((t, i) => i === 0 || t - raw[i - 1] > 900).slice(0, 4);
  const kindOf = (t) => ({ normal: 'ふつうの当たり', crit: '会心', defeat: '倒した' }[(feel.find((x) => x[0] === t) || [])[1]] || '');   // 続けて出る合図は1回の当たりにまとめる
  if (!hits.length || shots.length < 30) return { fail: `当たりを録れなかった(当たり ${hits.length}・絵 ${shots.length})` };
  const crop = await ctx.newPage();
  await crop.setViewportSize({ width: CLIP.width, height: CLIP.height });
  const cropOf = async (data) => { await crop.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;overflow:hidden"><img src="data:image/jpeg;base64,${data}" style="width:390px;margin-top:-${CLIP.y}px;display:block">`); return (await crop.screenshot({ type: 'jpeg', quality: 70, scale: 'css' })).toString('base64'); };
  const OFFS = [-70, 0, 70, 150, 280, 500];
  const rows = [];
  for (let i = 0; i < hits.length; i += 1) {
    const cells = [];
    for (const off of OFFS) { const want = hits[i] + off; const s = shots.reduce((a, b) => (Math.abs(b.t - want) < Math.abs(a.t - want) ? b : a)); cells.push({ t: `${off >= 0 ? '+' : ''}${off}ms`, b64: await cropOf(s.data) }); }
    rows.push({ label: kindOf(hits[i]) || `当たり ${i + 1}`, cells });
  }
  await crop.close();
  const from = hits[0] - 600, to = hits[hits.length - 1] + 1500;
  const use = shots.filter((s) => s.t >= from && s.t <= to);
  const frames = use.map((s, i) => { const file = path.join(dir, `${name}-${String(i).padStart(4, '0')}.jpg`); fs.writeFileSync(file, Buffer.from(s.data, 'base64')); return { file, ms: Math.max(16, (use[i + 1] ? use[i + 1].t : s.t + 33) - s.t) }; });
  return { rows, frames, note: `当たり ${hits.length}回${name === 'after' ? `(当たりの間 ${feel.length}回: ${['normal', 'crit', 'defeat'].map((t) => `${t} ${feel.filter((x) => x[1] === t).length}`).join('・')})` : ''}` };
};

const shootProposal = async (run, name, dir) => {
  const { page } = run;
  await page.addScriptTag({ path: path.join(OUT, 'proposals.js') });
  const rows = [], frames = [], counts = [];
  const TIMES = [0, 70, 150, 280, 500, 800];
  const LATE_TIMES = [0, 200, 500, 700, 1000, 1250];   // 反射 → 吸収 → 回避 を順に出す場面は、後ろまで撮る
  for (const [scene, label] of SCENES) {
    const info = await page.evaluate(([v, s]) => window.__feel.stage(v, s), [name, scene]);
    counts.push(info.anims);
    const cells = [];
    for (const t of (scene === 'effect' ? LATE_TIMES : TIMES)) { await page.evaluate((x) => window.__feel.seek(x), t); cells.push({ t: `+${t}ms`, b64: (await page.screenshot({ clip: CLIP, type: 'jpeg', quality: 70, scale: 'css' })).toString('base64') }); }
    rows.push({ label, note: `足す演出 ${info.anims}個`, cells });
    if (hasFfmpeg) {
      const end = Math.min(info.duration + 250, 2200);
      for (let t = -200; t <= end; t += 33) {
        await page.evaluate((x) => window.__feel.seek(Math.max(0, x)), t);
        const file = path.join(dir, `${name}-${scene}-${String(t + 200).padStart(5, '0')}.jpg`);
        await page.screenshot({ path: file, clip: CLIP, type: 'jpeg', quality: 70, scale: 'css' });
        frames.push({ file, ms: 33 });
      }
    }
  }
  return { rows, frames, note: `足す演出 ${counts.join('/')}個` };
};

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-feel-'));
  const done = []; let ng = 0;
  for (let i = 0; i < TARGETS.length; i += 1) {
    const name = TARGETS[i];
    let run;
    try {
      run = await openTacticsBattle({ root: ROOT, port: PORT + i, storage: { mh_battle_fx_v1: { load: 'RICH', autoLoad: 'OFF' } } });
      if (run.skip) { console.log(`SKIP: ${run.skip}`); break; }
      if (!run.inBattle) throw new Error('バトルまで進めなかった');
      // みゅあの説明は盤にかかるので、撮るあいだだけ閉じる(本体は変えない)
      await run.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(✖|×|✕)$/.test(x.textContent.trim()) || /閉じる/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); });
      await run.page.waitForTimeout(1500);
      const r = name === 'now' || name === 'after' ? await shootNow(run, dir, name) : await shootProposal(run, name, dir);
      if (r.fail) throw new Error(r.fail);
      const strip = await composeStrip(run.ctx, name, r.rows);
      const clip = encode(name, r.frames, dir);
      done.push(`${name}: ${path.basename(strip)} ${Math.round(fs.statSync(strip).size / 1024)}KB${clip ? ` / ${path.basename(clip)} ${Math.round(fs.statSync(clip).size / 1024)}KB` : ''}(${r.note})`);
      if (run.errors.length) { ng += 1; console.log(`NG ${name}: 実行時エラー ${run.errors[0]}`); }
    } catch (e) { ng += 1; console.log(`NG ${name}: ${String(e.message || e).split('\n')[0].slice(0, 200)}`); }
    finally { if (run && run.close) await run.close(); }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  done.forEach((x) => console.log(x));
  console.log(ng ? `NG: ${ng}件` : `OK: ${done.length}件を docs/progress/battle-feel/ へ出した`);
  process.exit(ng ? 1 : 0);
})();
