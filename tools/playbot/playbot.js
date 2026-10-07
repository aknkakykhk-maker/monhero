// 遊んでくれるロボット「モンヒロくん」(プレイボット)。実ブラウザでゲームを開き、人のように遊んで、
// 「おかしなこと」と「遊びにくいところ」をスクリーンショット付きで記録する。
//
//   node tools/playbot/playbot.js                         全員(約15分)
//   node tools/playbot/playbot.js --only time,count       選んだ担当だけ(id でも 数字係 のような名前でも)
//   node tools/playbot/playbot.js --only clock            担当の中の部分だけ(もとの担当id・「時計係」でも)
//   node tools/playbot/playbot.js --team battle          班の担当だけ(毎晩の班分け。roles.js の TEAMS)
//   node tools/playbot/playbot.js --list                  担当と班の一覧
//   node tools/playbot/playbot.js --parallel 3            同時に動かす担当の数(既定3。1なら順番に)
//   node tools/playbot/playbot.js --steps 300             探索の手数(既定150)
//   node tools/playbot/playbot.js --seed 12345            同じ押し方を再現する(報告に種が出る)
//   node tools/playbot/playbot.js --compare <report.json> 比べる相手を指定する(既定は前回の結果 → baseline.json)
//   node tools/playbot/playbot.js --save-baseline         今回の結果を比べる基準(baseline.json)として残す
//   node tools/playbot/playbot.js --headed                画面つきで動かす
//
// 結果は tools/out/playbot/<日時>/ に出る(report.md / report.json / 画像)。tools/out は git に入らない。
// 毎日の定期実行(Routine)では、Claude がこの報告と画像を読んで、改善の提案と不具合の修正PRを作る。
//
// 【担当制】 担当は roles.js。担当は「部分」を順に受け持ち、部分ごとに別のブラウザを開き直す。
//   ふつうの担当は --parallel の数ずつ同時に動かし、alone の部分を持つ担当(音ゲー係など)は
//   そのあと1人ずつ動かす。乱数は部分ごとに分けてあるので、同時に動かしても --seed で同じ押し方になる。
//
// 【守ること】(CLAUDE.md ⑦) 詳しくは README.md
//   ・毎回まっさらなブラウザ。手元・本番のセーブデータには触れない
//   ・Supabase(全国ランキング)へは届けない。lib/fake-supabase.js が受け止めて、ボットの手元にだけ覚える
//   ・外部への通信はすべて止める
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openSession, BOT_NAME } = require('./lib/session');
const { prepareVeteran, prepareLegacy } = require('./lib/seeds');
const { findPrevious, compare, saveBaseline } = require('./lib/compare');
const { ROLES, TEAMS, PARTS } = require('./roles');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
// 班に入っていない担当がいたら知らせる(毎晩だれも動かさなくなるため)
const teamless = ROLES.filter((r) => !TEAMS.some((t) => t.roles.includes(r.id)));
if (teamless.length) console.log(`⚠ どの班にも入っていない担当: ${teamless.map((r) => `${r.id}(${r.name})`).join(', ')} — roles.js の TEAMS へ足す`);
const partless = PARTS.filter((p) => !ROLES.some((r) => r.parts.some((q) => q.id === p.id)));
if (partless.length) console.log(`⚠ どの担当にも入っていない部分: ${partless.map((p) => p.id).join(', ')} — roles.js の GROUPS へ足す`);
if (args.includes('--list')) {
  ROLES.forEach((r) => {
    console.log(`${r.id.padEnd(8)} ${r.name}${r.alone ? '(1人で)' : ''} … ${r.does}`);
    r.parts.forEach((p) => console.log(`         ・${p.label}(--only ${p.id}) … ${p.does}`));
  });
  console.log('\n班(--team):');
  TEAMS.forEach((t) => console.log(`${t.id.padEnd(8)} ${t.name} … ${t.roles.join(', ')}`));
  process.exit(0);
}
const TEAM_ID = argOf('team', '');
const TEAM = TEAM_ID ? TEAMS.find((t) => t.id === TEAM_ID || t.name === TEAM_ID) : null;
if (TEAM_ID && !TEAM) { console.log(`知らない班: ${TEAM_ID}(--list で一覧)`); process.exit(1); }
const STEPS = Math.max(1, Number(argOf('steps', 150)) || 150);
const SEED = Number(argOf('seed', Date.now() % 1000000)) || 1;
const PARALLEL = Math.max(1, Math.min(4, Number(argOf('parallel', 3)) || 3));
const ONLY = TEAM ? TEAM.roles.slice() : (argOf('only', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
// --only は担当(id・名前)でも、担当の中の部分(もとの担当id・「〜係」の名前)でも選べる
const isRole = (r, x) => r.id === x || r.name === x;
// 担当と同じ id の部分(battle・rhythm など)は、担当のほうが選ばれる。部分だけなら「バトル係」ではなく部分の名前「バトル」で
const isPart = (p, x) => p.id === x || p.name === x || p.label === x;
const unknown = ONLY.filter((x) => !ROLES.some((r) => isRole(r, x) || r.parts.some((p) => isPart(p, x))));
if (unknown.length) { console.log(`知らない担当: ${unknown.join(', ')}(--list で一覧)`); process.exit(1); }
// 動かす担当と、その中で動かす部分
const picked = ROLES.map((r) => {
  if (!ONLY.length || ONLY.some((x) => isRole(r, x))) return r;
  const parts = r.parts.filter((p) => ONLY.some((x) => isPart(p, x)));
  return parts.length ? { ...r, parts, alone: parts.some((p) => p.alone) } : null;
}).filter(Boolean);
const PORT = 8981;
const PAGE_URL = `http://localhost:${PORT}/monster-hero/index.html`;

const stamp = (() => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
})();
const OUT_ROOT = path.join(ROOT, 'tools', 'out', 'playbot');
const OUT = path.join(OUT_ROOT, stamp);
fs.mkdirSync(OUT, { recursive: true });

// ---- 再現できる乱数(mulberry32)。担当ごとに別の流れにする ----
const makeRand = (seed) => {
  let st = seed >>> 0;
  return () => {
    st = (st + 0x6D2B79F5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seedOf = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, (SEED ^ 2166136261) >>> 0);

// ---- 配信(リポジトリのルート) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

const report = {
  headed: args.includes('--headed'), shotNo: 0, issues: [], steps: [], screens: new Map(),
  issueKeys: new Set(), phases: [],
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので動かせません'); process.exit(0); }
  const server = await serve();
  const started = Date.now();
  const shared = {};   // 担当どうしで受け渡すもの(音ゲー係の記録 → ランキング係)
  const numbers = {};  // 前回と比べる数字
  const roleResults = [];
  const writesAll = [];

  // 部分1つぶん。別のブラウザを開き、下準備 → (起動) → 仕事 → 閉じる。報告の上では担当(role)の名前で出す
  const runPart = async (role, part) => {
    const t0 = Date.now();
    const rand = makeRand(seedOf(part.id));
    const s = await openSession({ playwright, pageUrl: PAGE_URL, port: PORT, out: OUT, rand, persona: role.name, report, ...(part.viewport ? { viewport: part.viewport } : {}), ...(part.cpuSlowdown ? { cpuSlowdown: part.cpuSlowdown } : {}) });
    s.roleId = role.id;
    s.partId = part.id;
    let ok = true;
    const phase = async (name, fn) => {
      const p0 = Date.now();
      s.state.scenario = `${part.label}: ${name}`;
      let pok = true, note = '';
      try {
        const r = await fn();
        if (r && typeof r === 'object') { pok = r.ok !== false; note = r.note || ''; }
      } catch (e) { pok = false; note = e.message.split('\n')[0]; await s.addIssue('シナリオ失敗', `${part.label}: ${name}: ${note}`); }
      if (!pok) ok = false;
      report.phases.push({ roleId: role.id, partId: part.id, persona: role.name, name, ok: pok, ms: Date.now() - p0, note });
      console.log(`${pok ? 'OK' : 'NG'}: [${role.name}/${part.label}] ${name}${note ? ' — ' + note : ''} (${((Date.now() - p0) / 1000).toFixed(0)}秒)`);
    };
    try {
      if (part.prepare === 'veteran') await prepareVeteran(s, { quiet: part.quiet !== false });
      if (part.prepare === 'legacy') await prepareLegacy(s);
      // 部分ごとの下準備(買い物のダイヤなど)。ボットのブラウザへ最初の1回だけ入れる
      if (part.storage) await s.page.addInitScript((pairs) => { if (localStorage.getItem('__playbot_role_seeded')) return; for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, JSON.stringify(v)); localStorage.setItem('__playbot_role_seeded', '1'); }, part.storage);
      if (part.boot) {
        await phase('起動', async () => {
          const r = await s.boot();
          await s.inspect();
          // 読み込みの秒数は、1人で動く部分だけで測る(同時に動いていると遅く出る)
          if (part.measureBoot) {
            numbers['起動: TAP TO START まで(秒)'] = +(r.loadMs / 1000).toFixed(1);
            if (r.loadMs > 15000) await s.addIssue('読み込みが遅い', `TAP TO START が出るまで ${(r.loadMs / 1000).toFixed(1)}秒`);
          }
          return { ok: true, note: `読み込み ${(r.loadMs / 1000).toFixed(1)}秒 / HOME まで ${(r.homeMs / 1000).toFixed(1)}秒` };
        });
      }
      await part.run(s, { phase, steps: STEPS, rand, shared, numbers, out: OUT });
    } catch (e) {
      ok = false;
      await s.addIssue('シナリオ失敗', `${role.name}/${part.label}: ${e.message.split('\n')[0]}`).catch(() => {});
    }
    writesAll.push(...s.supabase.writes.map((w) => ({ persona: role.name, part: part.label, ...w })));
    await s.close().catch(() => {});
    return { id: part.id, label: part.label, ok, minutes: +((Date.now() - t0) / 60000).toFixed(1) };
  };
  // 担当1人ぶん。部分を順に動かす。1つつまずいても次の部分へ進む
  const runRole = async (role) => {
    const t0 = Date.now();
    const parts = [];
    for (const part of role.parts) {
      try { parts.push(await runPart(role, part)); }
      catch (e) { parts.push({ id: part.id, label: part.label, ok: false, minutes: 0 }); console.log(`NG: [${role.name}/${part.label}] ブラウザを開けなかった — ${e.message.split('\n')[0]}`); }
    }
    roleResults.push({ id: role.id, name: role.name, does: role.does, ok: parts.every((p) => p.ok), minutes: +((Date.now() - t0) / 60000).toFixed(1), parts });
  };

  const chosen = picked;
  const together = chosen.filter((r) => !r.alone);
  const alone = chosen.filter((r) => r.alone);
  console.log(`担当: ${chosen.map((r) => r.name).join('・')}(同時に${PARALLEL}人ずつ${alone.length ? `、そのあと ${alone.map((r) => r.name).join('・')} を1人ずつ` : ''})`);
  let next = 0;
  const worker = async () => { while (next < together.length) await runRole(together[next++]); };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, together.length) }, worker));
  for (const r of alone) await runRole(r);

  // ===== まとめ(報告係) =====
  const order = (id) => ROLES.findIndex((r) => r.id === id);
  roleResults.sort((a, b) => order(a.id) - order(b.id));
  // 不具合には担当の id を付ける(画面の名前や比べる鍵に使う)
  const idOfName = new Map(ROLES.map((r) => [r.name, r.id]));
  report.issues.forEach((x) => { x.roleId = idOfName.get(x.persona) || ''; });
  const countOf = (level) => report.issues.filter((x) => x.level === level).length;
  const result = {
    format: 'roles', stamp, seed: SEED, steps: STEPS, only: ONLY, parallel: PARALLEL,
    minutes: +((Date.now() - started) / 60000).toFixed(1),
    roles: roleResults, phases: report.phases, numbers,
    rankingWrites: writesAll.map((w) => ({ persona: w.persona, table: w.table, row: w.row })),
    screens: [...report.screens.entries()].map(([name, v]) => ({ name, ...v })),
    issues: report.issues, path: report.steps,
  };
  const diff = compare(result, findPrevious({ explicit: argOf('compare', ''), outRoot: OUT_ROOT, currentDir: OUT }));
  result.compare = diff && { from: path.relative(ROOT, diff.from), stamp: diff.stamp,
    appeared: diff.appeared.map((x) => `${x.persona}: ${x.kind} — ${x.detail}`.slice(0, 240)),
    gone: diff.gone.map((x) => `${x.persona}: ${x.kind} — ${x.detail}`.slice(0, 240)), numbers: diff.numbers, failedNow: diff.failedNow };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(result, null, 2));
  if (args.includes('--save-baseline')) console.log(`比べる基準を残した: ${path.relative(ROOT, saveBaseline(result))}`);

  const issueLines = (list) => list.map((x, i) => [
    `#### ${i + 1}. ${x.kind} — ${x.screen}`,
    '',
    `- 内容: ${x.detail.replace(/\n/g, ' ').slice(0, 300)}`,
    ...(x.known ? [`- 既知の理由: ${x.known}`] : []),
    `- 場面: ${x.scenario} / 画像: \`${x.image}\``,
    `- 直前に押したもの: ${x.recentSteps.map((st) => `「${st.label}」`).join(' → ') || '(なし)'}`,
    '',
  ].join('\n'));
  const compareLines = !diff ? ['- 比べる前回の結果が無い(`--save-baseline` で基準を残せる)', ''] : [
    `- 比べた相手: \`${path.relative(ROOT, diff.from)}\`${diff.stamp ? `(${diff.stamp})` : ''}`,
    ...(diff.failedNow.length ? [`- ❌ 前回は通ったのに今回つまずいた担当: ${diff.failedNow.join('・')}`] : []),
    `- 新しく出たもの: ${diff.appeared.length}件`,
    ...diff.appeared.map((x) => `  - 🆕 [${x.persona}] ${x.kind} — ${x.detail.replace(/\n/g, ' ').slice(0, 160)}`),
    `- 前回あって今回は出なかったもの: ${diff.gone.length}件(直った・今回は通らなかった、のどちらか)`,
    ...diff.gone.map((x) => `  - ✔ [${x.persona}] ${x.kind} — ${x.detail.replace(/\n/g, ' ').slice(0, 160)}`),
    ...(diff.numbers.length ? ['- 数字の動き:', ...diff.numbers.map((n) => `  - ${n.name}: ${n.before} → ${n.now}`)] : ['- 数字の動き: なし']),
    '',
  ];
  const md = [
    `# モンヒロくんの報告 ${stamp}`,
    '',
    `- 乱数の種: \`${SEED}\`(\`node tools/playbot/playbot.js --seed ${SEED}${TEAM ? ` --team ${TEAM.id}` : ONLY.length ? ` --only ${ONLY.join(',')}` : ''}\` で同じ押し方を再現)`,
    `- かかった時間: ${result.minutes}分(同時に${PARALLEL}人) / 見た画面: ${report.screens.size} / 押した回数: ${report.steps.length}`,
    `- ランキングなどへ送った記録: ${writesAll.length}件(すべてボットの手元で受け止めた。本物へは届いていない)`,
    `- 不具合候補 ${countOf('不具合候補')}件 / 改善のヒント ${countOf('改善のヒント')}件 / 既知 ${countOf('既知')}件`,
    '',
    '## 前回との比較(報告係)',
    '',
    ...compareLines,
    '## 担当ごとの結果',
    '',
    ...roleResults.flatMap((r) => {
      const mine = report.issues.filter((x) => x.persona === r.name && x.level !== '既知');
      return [
        `### ${r.ok ? '✅' : '❌'} ${r.name}(${r.minutes}分)— ${r.does}`,
        '',
        ...r.parts.flatMap((part) => [
          `- ${part.ok ? '✅' : '❌'} **${part.label}**(${part.minutes}分)`,
          ...report.phases.filter((p) => p.roleId === r.id && p.partId === part.id).map((p) => `  - ${p.ok ? '✅' : '❌'} ${p.name}${p.note ? ` — ${p.note}` : ''}(${(p.ms / 1000).toFixed(0)}秒)`),
        ]),
        '',
        ...['不具合候補', '改善のヒント'].flatMap((level) => {
          const list = mine.filter((x) => x.level === level);
          return list.length ? [`**${level}(${list.length}件)**`, '', ...issueLines(list)] : [];
        }),
      ];
    }),
    `## 既知(${countOf('既知')}件)`,
    '',
    ...(countOf('既知') ? issueLines(report.issues.filter((x) => x.level === '既知')) : ['- なし', '']),
    '## 見た画面(画像を見て、遊びにくいところがないかを確かめる)',
    '',
    ...[...report.screens.entries()].map(([n, v]) => `- ${n}(${v.persona} / ${v.scenario} / \`${v.image}\`)`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);

  console.log(`\n見た画面 ${report.screens.size} / 不具合候補 ${countOf('不具合候補')}件 / 改善のヒント ${countOf('改善のヒント')}件 / 既知 ${countOf('既知')}件`);
  if (diff) console.log(`前回と比べて: 新しく出た ${diff.appeared.length}件 / 出なくなった ${diff.gone.length}件`);
  console.log(`報告: ${path.relative(ROOT, path.join(OUT, 'report.md'))}`);
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
