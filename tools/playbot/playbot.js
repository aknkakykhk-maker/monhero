// 遊んでくれるロボット「モンヒロくん」(プレイボット)。実ブラウザでゲームを開き、人のように遊んで、
// 「おかしなこと」と「遊びにくいところ」をスクリーンショット付きで記録する。
//
//   node tools/playbot/playbot.js                        ぜんぶ(約15分)
//   node tools/playbot/playbot.js --only rhythm,battle   選んだシナリオだけ(new / battle / rhythm / tour / explore)
//   node tools/playbot/playbot.js --steps 300            探索の手数(既定150)
//   node tools/playbot/playbot.js --seed 12345           同じ押し方を再現する(報告に種が出る)
//   node tools/playbot/playbot.js --headed               画面つきで動かす
//
// 結果は tools/out/playbot/<日時>/ に出る(report.md / report.json / 画像)。tools/out は git に入らない。
// 毎日の定期実行(Routine)では、Claude がこの報告と画像を読んで、改善の提案と不具合の修正PRを作る。
//
// 【遊ぶ人は2人】
//   新人      … 何も保存されていないブラウザ。名前を入れて最初の案内を通り HOME まで行く
//   いつもの  … 最初の案内を済ませた状態から。バトル・モンヒロビート・HOME の全部の入口・探索
//
// 【守ること】(CLAUDE.md ⑦) 詳しくは README.md
//   ・毎回まっさらなブラウザ。手元・本番のセーブデータには触れない
//   ・Supabase(全国ランキング)へは届けない。lib/fake-supabase.js が受け止めて、ボットの手元にだけ覚える
//   ・外部への通信はすべて止める
const http = require('http');
const fs = require('fs');
const path = require('path');
const { quietBootSeed, updateNoticeSeed } = require('../boot/quiet-boot-seed');
const { openSession, BOT_NAME } = require('./lib/session');
const { newPlayerScenario } = require('./scenarios/new-player');
const { battleScenario } = require('./scenarios/battle');
const { rhythmScenario } = require('./scenarios/rhythm');
const { exploreScenario, tourScenario } = require('./scenarios/explore');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const STEPS = Math.max(1, Number(argOf('steps', 150)) || 150);
const SEED = Number(argOf('seed', Date.now() % 1000000)) || 1;
const ONLY = (argOf('only', '') || '').split(',').map((x) => x.trim()).filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
const PORT = 8981;
const PAGE_URL = `http://localhost:${PORT}/monster-hero/index.html`;

const stamp = (() => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
})();
const OUT = path.join(ROOT, 'tools', 'out', 'playbot', stamp);
fs.mkdirSync(OUT, { recursive: true });

// ---- 再現できる乱数(mulberry32) ----
let rngState = SEED >>> 0;
const rand = () => {
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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

// 「いつもの」の下準備: 最初の案内と、起動直後に重なる会話・告知を済ませた状態
const veteranSeed = (name) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  if (localStorage.getItem('mh_breeder_name')) return; // 再読み込みのときは上書きしない
  put('mh_breeder_name', name);
  put('mh_breeder_icon', '🤖');
  put('mh_intro_done', true);
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua');
  put('mh_assistant_unlock_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  // 新しい助手の紹介(きき・ももすけ)は、しばらく遊んでいる人ならもう見ている
  put('mh_kiki_intro_seen_v1', true);
  put('mh_momosuke_intro_seen_v1', true);
  put('mh_clears_Beginner', 1);
  put('mh_quick_clears_Beginner', 1);
};

const report = {
  headed: args.includes('--headed'), shotNo: 0, issues: [], steps: [], screens: new Map(),
  issueKeys: new Set(), clickCount: new Map(), phases: [], metrics: {},
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので動かせません'); process.exit(0); }
  const server = await serve();
  const started = Date.now();
  const writesAll = [];

  const phase = async (s, name, fn) => {
    const t0 = Date.now();
    s.state.scenario = name;
    let ok = true, note = '', stats = null;
    try {
      const r = await fn();
      if (r && typeof r === 'object') { ok = r.ok !== false; note = r.note || ''; stats = r.stats || r.visited || null; }
    } catch (e) { ok = false; note = e.message.split('\n')[0]; await s.addIssue('シナリオ失敗', `${name}: ${note}`); }
    report.phases.push({ persona: s.persona, name, ok, ms: Date.now() - t0, note });
    if (stats) report.metrics[name] = stats;
    console.log(`${ok ? 'OK' : 'NG'}: [${s.persona}] ${name}${note ? ' — ' + note : ''} (${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
  };

  // ===== 新人 =====
  if (want('new')) {
    const s = await openSession({ playwright, pageUrl: PAGE_URL, port: PORT, out: OUT, rand, persona: '新人', report });
    await phase(s, 'はじめて遊ぶ', () => newPlayerScenario(s));
    // 設定を終えたら、はじめての人として最初のバトルも遊ぶ(案内のあとの導線を確かめる)
    if (want('battle')) await phase(s, '新人のはじめてのバトル', async () => { await s.backHome(); const r = await battleScenario(s, { manualTurns: 4, autoMs: 30000, system: 'systemClassic' }); await s.backHome(); return r; });
    if (want('explore')) await phase(s, '新人の探索', () => exploreScenario(s, { steps: Math.ceil(STEPS / 3), rand, report }));
    writesAll.push(...s.supabase.writes.map((w) => ({ persona: s.persona, ...w })));
    await s.close();
  }

  // ===== いつもの =====
  if (['battle', 'rhythm', 'tour', 'explore'].some(want)) {
    const s = await openSession({ playwright, pageUrl: PAGE_URL, port: PORT, out: OUT, rand, persona: 'いつもの', report });
    await s.page.addInitScript(veteranSeed, BOT_NAME);
    // ★種は最初の1回だけ入れる。読み込み直すたびに入れると、既読の一覧が上書きされて、
    //   ボットがそのあと見た会話(レイドのお話など)が「まだ見ていない」に戻り、毎回流れてしまう
    await s.page.addInitScript({ content: `(() => { try { if (localStorage.getItem('__playbot_seeded')) return; ${quietBootSeed().content}\n${updateNoticeSeed().content}\nlocalStorage.setItem('__playbot_seeded', '1'); } catch (e) {} })();` });
    await phase(s, '起動', async () => {
      const r = await s.boot();
      await s.inspect();
      report.metrics['起動'] = r;
      if (r.loadMs > 15000) await s.addIssue('読み込みが遅い', `TAP TO START が出るまで ${(r.loadMs / 1000).toFixed(1)}秒`);
      return { ok: true, note: `読み込み ${(r.loadMs / 1000).toFixed(1)}秒 / HOME まで ${(r.homeMs / 1000).toFixed(1)}秒` };
    });
    if (want('battle')) await phase(s, 'バトル', async () => { const r = await battleScenario(s); await s.backHome(); return r; });
    if (want('rhythm')) await phase(s, 'モンヒロビート', async () => { const r = await rhythmScenario(s); await s.backHome(); return r; });
    if (want('tour')) await phase(s, 'HOME の入口ツアー', () => tourScenario(s, { stepsEach: 8, rand, report }));
    if (want('explore')) await phase(s, '探索', () => exploreScenario(s, { steps: STEPS, rand, report }));
    writesAll.push(...s.supabase.writes.map((w) => ({ persona: s.persona, ...w })));
    await s.close();
  }

  // ===== まとめ =====
  const countOf = (level) => report.issues.filter((x) => x.level === level).length;
  const result = {
    stamp, seed: SEED, steps: STEPS, only: ONLY, minutes: +((Date.now() - started) / 60000).toFixed(1),
    phases: report.phases, metrics: report.metrics,
    rankingWrites: writesAll.map((w) => ({ persona: w.persona, table: w.table, row: w.row })),
    screens: [...report.screens.entries()].map(([name, v]) => ({ name, ...v })),
    issues: report.issues, path: report.steps,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(result, null, 2));

  const md = [
    `# モンヒロくんの報告 ${stamp}`,
    '',
    `- 乱数の種: \`${SEED}\`(\`node tools/playbot/playbot.js --seed ${SEED}${ONLY.length ? ` --only ${ONLY.join(',')}` : ''}\` で同じ押し方を再現)`,
    `- かかった時間: ${result.minutes}分 / 見た画面: ${report.screens.size} / 押した回数: ${report.steps.length}`,
    `- ランキングなどへ送った記録: ${writesAll.length}件(すべてボットの手元で受け止めた。本物へは届いていない)`,
    '',
    '## 遊んだこと',
    '',
    ...report.phases.map((p) => `- ${p.ok ? '✅' : '❌'} [${p.persona}] ${p.name}${p.note ? ` — ${p.note}` : ''}(${(p.ms / 1000).toFixed(0)}秒)`),
    '',
    ...['不具合候補', '改善のヒント', '既知'].flatMap((level) => {
      const list = report.issues.filter((x) => x.level === level);
      return [
        `## ${level}(${list.length}件)`,
        '',
        ...(list.length ? [] : ['- なし', '']),
        ...list.map((x, i) => [
          `### ${i + 1}. ${x.kind} — ${x.screen}`,
          '',
          `- 内容: ${x.detail.replace(/\n/g, ' ').slice(0, 300)}`,
          ...(x.known ? [`- 既知の理由: ${x.known}`] : []),
          `- 遊んでいた人・場面: ${x.persona} / ${x.scenario} / 画像: \`${x.image}\``,
          `- 直前に押したもの: ${x.recentSteps.map((st) => `「${st.label}」`).join(' → ') || '(なし)'}`,
          '',
        ].join('\n')),
      ];
    }),
    '## 見た画面(画像を見て、遊びにくいところがないかを確かめる)',
    '',
    ...[...report.screens.entries()].map(([n, v]) => `- ${n}(${v.persona} / ${v.scenario} / \`${v.image}\`)`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);

  console.log(`\n見た画面 ${report.screens.size} / 不具合候補 ${countOf('不具合候補')}件 / 改善のヒント ${countOf('改善のヒント')}件 / 既知 ${countOf('既知')}件`);
  console.log(`報告: ${path.relative(ROOT, path.join(OUT, 'report.md'))}`);
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
