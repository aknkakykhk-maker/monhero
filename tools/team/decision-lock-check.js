#!/usr/bin/env node
// 決めごとの錠: 台帳の「進め方」の決めごとに守らせ方が付いているか・道具や手引きの文が決めごとと食い違っていないかを確かめる。
//
//   node tools/team/decision-lock-check.js            … 検査(OK / NG と理由)
//   node tools/team/decision-lock-check.js --list     … 錠の一覧(守らせ方ごと)
//   node tools/team/decision-lock-check.js --people   … 「人が守る」の一覧と理由だけ
//
// 【なぜあるか】(2026-11-12 社長「決めたことを無視しないでちゃんと決めごととしての仕組み作ってね」・台帳 #5553)
// 同じ日に2回、台帳には書いてあるのに道具が古いままで食い違った。
//   ① 台帳「要約は窓口だけ」なのに、部署向けのフックが「区切りで要約を頼め」と出し続け、部署が社長に要約を頼んだ(#5524 で直した)
//   ② 社長は窓口の要約をトークン数で管理するつもりなのに、フックは回数で数えていた(#5552 で直した)
// それまでの検査は「道具が自分の説明どおりに動くか」しか見ておらず、「台帳の決めごとと合っているか」を見るものが無かった。
// 窓口(モデル)が台帳を読み落としても、ここで止まるようにする。
//
// 【確かめること】(錠の表は tools/team/decision-locks.json・読み方は docs/rules/DECISION_LOCKS.md)
//   A 台帳の「進め方」の行(「## 進め方」の節と、本文の「<日付> 進め方:」「<日付> 窓口の進め方:」で始まる行)が、どれか1つの錠に載っている
//   B 錠の「台帳のことば」が、台帳の行にいまもある(台帳を直したのに錠が古いまま、を止める)
//   C 守らせ方: フック・道具・手引きの錠には、仕組みのファイルが実在し、検査・動き・要ることばのどれかがある。
//     検査のファイルは実在し、決めごとのことばが検査の中に書いてある。「人が守る」「対象外」には理由がある
//   D 動き: 道具とフックを実際に動かして、決めごとどおりの答えが出る
//   E 要ることば: 手引き・依頼文・フックの知らせに、決めごとのことばがある
//   F 逆のことば: 手引き・依頼文・フックの知らせ・台帳の進め方に、決めごとと逆のことばが残っていない。
//     逆のことばの形は、直す前に実際にあった文(例)に当たること(見張りが空振りしていないこと)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, loadDepts, loadRouting } = require('./lib');

const LOCKS = path.join(__dirname, 'decision-locks.json');
const LEDGER = path.join(ROOT, 'docs', 'rules', 'PRESIDENT_DECISIONS.md');
const KINDS = ['フック', '道具', '手引き', '人が守る', '対象外'];
// 本文にあって「進め方」の決めごとと数える行の頭(台帳に足すときは、この形で書く)
const TAGGED = /^- 20\d\d-\d\d-\d\d (窓口の)?進め方[::]/;

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

function ledger() {
  const how = [], tagged = [], all = [];
  let sec = '';
  for (const l of fs.readFileSync(LEDGER, 'utf8').split('\n')) {
    if (l.startsWith('## ')) { sec = l.slice(3).trim(); continue; }
    if (!l.startsWith('- ')) continue;
    all.push(l);
    if (sec === '進め方') how.push(l);
    else if (TAGGED.test(l)) tagged.push(l);
  }
  return { how, tagged, all };
}

// 逆のことばを探す「手引き」: 会話が読む文・道具が出す文のもとになるファイル。
// 検査(*-check.js)と錠の表・錠の説明は、逆のことばそのものを書いているので外す
function guideFiles() {
  const out = ['CLAUDE.md', 'AGENTS.md', '.claude/settings.json'].filter(exists);
  const dir = (d, re) => { if (exists(d)) for (const f of fs.readdirSync(path.join(ROOT, d)).sort()) if (re.test(f)) out.push(`${d}/${f}`); };
  dir('docs/rules', /\.md$/);
  dir('docs/depts', /\.md$/);
  dir('tools/hooks', /\.js$/);
  dir('tools/team', /\.(js|json)$/);
  const skip = /(-check\.js|decision-locks\.json|DECISION_LOCKS\.md|PRESIDENT_DECISIONS\.md)$/;
  return out.filter(f => !skip.test(f));
}

// 「どこ」→ { texts: [{ name, text }], generated } 。道具が出す文は、その場で道具を動かして作る
function makePlaces() {
  const cache = new Map();
  const R = loadRouting();
  const limit = R['区切り'];
  const hook = require('../hooks/session-length-nudge.js');
  const get = (where) => {
    if (cache.has(where)) return cache.get(where);
    let texts = [];
    if (where === '手引き') texts = guideFiles().map(f => ({ name: f, text: read(f) }));
    else if (where === '台帳の進め方') texts = [{ name: 'docs/rules/PRESIDENT_DECISIONS.md(進め方)', text: ledger().how.join('\n') }];
    else if (where === '依頼文') {
      const { build } = require('./newsession');
      for (const d of loadDepts()) for (const job of ['表示のずれを直す', '全曲点検の道具を作る', '道具を回して結果をまとめる']) texts.push({ name: `依頼文(${d.id}・${job})`, text: build(d, job, {}).prompt });
    } else if (where === '部署の知らせ') {
      for (const p of [1, 10, 20, 30, limit['やりとり'], limit['やりとり'] + limit['くり返し'], limit['やりとり'] * 3]) for (const m of [0, 3, limit['公開'], limit['公開'] * 3]) for (const c of [0, 1]) {
        const t = hook.message({ prompts: p, merges: m, compacts: c, tokens: 800000, prevTokens: 100000 }, limit);
        if (t) texts.push({ name: `部署の知らせ(やりとり${p}・公開${m})`, text: t });
      }
    } else if (where === '窓口の知らせ') {
      const first = Number(limit['窓口の要約のトークン']) || 500000;
      const step = Number(limit['窓口の要約のくり返しトークン']) || 50000;
      for (const [t, prev] of [[first + 10000, first - 20000], [first + step + 1000, first + 1000], [first + step * 4, first + step * 3], [first * 2, 0]]) for (const p of [1, 30, 200]) for (const c of [0, 1]) {
        const s = hook.message({ prompts: p, merges: p > 1 ? 9 : 0, compacts: c, tokens: t, prevTokens: prev }, limit, { hq: true });
        if (s) texts.push({ name: `窓口の知らせ(${t}トークン・やりとり${p})`, text: s });
      }
    } else if (exists(where)) texts = [{ name: where, text: read(where) }];
    else texts = null; // 知らない場所
    cache.set(where, texts);
    return texts;
  };
  return get;
}

// 動き: 名前 → 問題の文の並び(空なら OK)
function behaviours() {
  const R = loadRouting();
  const limit = R['区切り'];
  const hook = require('../hooks/session-length-nudge.js');
  const { pick } = require('./model-pick');
  const model = (t, o) => pick(t, o).kind.model;
  const settings = JSON.parse(read('.claude/settings.json'));
  const run = (file, args, opt) => spawnSync('node', [path.join(ROOT, file), ...args], { encoding: 'utf8', ...opt });
  const B = {};
  B['SQL の許可が設定に入っている'] = () => {
    const allow = (settings.permissions && settings.permissions.allow) || [];
    return ['execute_sql', 'apply_migration'].filter(n => !allow.some(a => String(a).endsWith(n))).map(n => `.claude/settings.json の permissions.allow に ${n} が無い(SQL のたびに社長へ許可の問いが出る)`);
  };
  B['部署のサブエージェントはフックが止める'] = () => {
    const p = [];
    const { judge } = require('../hooks/no-subagent-in-dept.js');
    const hq = R['窓口の会話'];
    const hqEnv = { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_' + String(hq).replace(/^session_/, '') };
    const dept = { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_01BushoNoKaiwa' };
    for (const t of ['Agent', 'Task', 'Workflow']) if (!judge(t, hq, dept)) p.push(`部署の会話で ${t} が止まらない`);
    if (judge('Agent', hq, hqEnv)) p.push('窓口の会話で Agent が止まってしまう');
    if (judge('Agent', hq, {})) p.push('手元の端末の会話(番号なし)で Agent が止まってしまう');
    if (judge('Read', hq, dept) || judge('TaskCreate', hq, dept)) p.push('サブエージェントではない道具(Read・TaskCreate)まで止めている');
    const pre = JSON.stringify((settings.hooks && settings.hooks.PreToolUse) || '');
    if (!pre.includes('no-subagent-in-dept.js') || !/Agent/.test(pre)) p.push('.claude/settings.json の PreToolUse に no-subagent-in-dept.js(matcher に Agent)が登録されていない');
    const r1 = run('tools/hooks/no-subagent-in-dept.js', [], { input: JSON.stringify({ tool_name: 'Agent' }), env: { ...process.env, ...dept } });
    if (r1.status !== 2 || !/サブエージェント/.test(r1.stderr || '')) p.push(`フックを動かしても止まらない(終了コード ${r1.status})`);
    for (const input of ['', 'こわれた入力']) { const r = run('tools/hooks/no-subagent-in-dept.js', [], { input, env: { ...process.env, ...dept } }); if (r.status !== 0) p.push('こわれた入力でフックが会話を止めてしまう'); }
    return p;
  };
  B['部署は目安で引き継ぎメモを知らせる'] = () => {
    const p = [];
    if (hook.message({ prompts: limit['やりとり'] - 1, merges: 0 }, limit) !== '') p.push('目安の前に部署へ知らせが出る');
    const t = hook.message({ prompts: limit['やりとり'], merges: 0 }, limit);
    if (!/handoff <自分の部> --write/.test(t) || !/窓口へ/.test(t)) p.push('目安に届いても、部署へ「引き継ぎメモ → 窓口へ」の知らせが出ない');
    if (!JSON.stringify((settings.hooks && settings.hooks.UserPromptSubmit) || '').includes('session-length-nudge.js')) p.push('.claude/settings.json の UserPromptSubmit にフックが登録されていない');
    return p;
  };
  B['窓口はトークン数で数える(回数では出さない)'] = () => {
    const p = [];
    const first = Number(limit['窓口の要約のトークン']);
    const step = Number(limit['窓口の要約のくり返しトークン']);
    if (first !== 500000 || step !== 50000) p.push(`routing.json の目安が台帳(50万・そのあと5万ごと)と違う: ${first}・${step}`);
    const hq = { hq: true };
    if (hook.message({ prompts: 200, merges: 30, compacts: 1, tokens: 310000, prevTokens: 300000 }, limit, hq) !== '') p.push('窓口で、50万トークンの前なのに回数・公開の数で問いが出る(台帳: 回数ではなくトークン数)');
    if (!hook.message({ prompts: 1, merges: 0, compacts: 0, tokens: 510000, prevTokens: 480000 }, limit, hq)) p.push('窓口で、50万トークンを超えたのに問いが出ない(やりとり1回)');
    if (hook.message({ prompts: 50, merges: 9, compacts: 0, tokens: 530000, prevTokens: 510000 }, limit, hq) !== '') p.push('窓口で、節目(5万ごと)をまたいでいないのに毎回問いが出る');
    if (!hook.message({ prompts: 50, merges: 9, compacts: 0, tokens: 555000, prevTokens: 545000 }, limit, hq)) p.push('窓口で、次の節目(55万)をまたいでも問いが出ない');
    return p;
  };
  B['handoff --compact は止まる'] = () => {
    const r = run('tools/team/handoff.js', ['dev', '--compact']);
    return r.status !== 0 && /要約は窓口だけ/.test(r.stderr || '') ? [] : ['node tools/ctx.js handoff <部> --compact が NG で止まらない(部署に要約の指示文を出してしまう)'];
  };
  B['道具を作る仕事は最新モデル・回す仕事は安いモデル'] = () => {
    const p = [];
    if (model('譜面の全曲点検の道具を作る') !== 'claude-fable-5-2') p.push('道具を作る仕事が claude-fable-5-2 にならない');
    if (!/^claude-(sonnet|haiku)-/.test(model('rhythm-chart-review.js を回して全曲点検の結果をまとめる'))) p.push('道具を回してまとめる仕事が安いモデルにならない');
    return p;
  };
  B['保存データ・ランキングの仕事は opus 以上'] = () => ['ランキングの文言を直して', '保存データの題を変える', 'SQL を足す小さな直し']
    .filter(t => !/^claude-(opus|fable)-/.test(model(t))).map(t => `「${t}」が安いモデルに回る(壊すと戻せない所は opus 以上)`);
  B['Fable の会話を作るときは条件と「聞いてから」が出る'] = () => {
    const r = run('tools/team/newsession.js', ['dev', '全曲点検の道具を作る']);
    const out = r.stdout || '';
    const p = [];
    if (!out.includes('model: claude-fable-5-2')) p.push('道具を作る仕事の newsession が claude-fable-5-2 を出さない(動きの例が古い)');
    if (!out.includes('AskUserQuestion') || !out.includes('聞かずに使わない')) p.push('newsession が claude-fable-5-2 を出すとき、「当てはまらないなら社長に選択式で聞いてから」が出ない');
    if (model('モンスターノーツのかくつきを直す', { failed: 1 }) === 'claude-fable-5-2') p.push('1回目の直しで claude-fable-5-2 が出る');
    return p;
  };
  B['窓口の返事に表の記法が残ると止まる'] = () => {
    const p = [];
    const t = require('../hooks/hq-table-as-image.js');
    if (!t.findTable('結果です。\n\n| 部 | 件数 |\n| --- | --- |\n| 開発 | 3 |')) p.push('表の記法(| --- | --- |)を見つけられない');
    if (!t.findTable('a|b\n:--|--:\n1|2')) p.push('外枠の無い表の記法を見つけられない');
    if (t.findTable('箇条書きです。\n- 開発 3件\n---\n次の話')) p.push('区切り線(---)や箇条書きを表と間違える');
    if (t.findTable('```\n| a | b |\n| --- | --- |\n```')) p.push('コードブロックの中の表まで止めている');
    const hq = R['窓口の会話'];
    const hqEnv = { ...process.env, CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_' + String(hq).replace(/^session_/, '') };
    const deptEnv = { ...process.env, CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_01BushoNoKaiwa' };
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-lock-'));
    const tr = path.join(tmp, 't.jsonl');
    const write = (reply) => fs.writeFileSync(tr, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: '一覧を見せて' } }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: reply }] } }),
    ].join('\n'));
    const fire = (env, extra) => run('tools/hooks/hq-table-as-image.js', [], { input: JSON.stringify({ transcript_path: tr, ...extra }), env });
    write('一覧です。\n\n| 部 | 件数 |\n| --- | --- |\n| 開発 | 3 |');
    if (!/"decision":"block"/.test(fire(hqEnv).stdout || '')) p.push('窓口の返事に表の記法があっても止まらない');
    if ((fire(deptEnv).stdout || '') !== '') p.push('部署の会話まで止めている(動くのは窓口の会話だけ)');
    if (/"decision":"block"/.test(fire(hqEnv, { stop_hook_active: true }).stdout || '')) p.push('書き直しのあとも止め続ける(止まらなくなる)');
    write('一覧です。\n- 開発 3件\n- ビート 2件');
    if ((fire(hqEnv).stdout || '') !== '') p.push('表の無い返事まで止めている');
    for (const input of ['', 'こわれた入力']) { const r = run('tools/hooks/hq-table-as-image.js', [], { input, env: hqEnv }); if (r.status !== 0 || r.stdout) p.push('こわれた入力でフックが会話を止めてしまう'); }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (!JSON.stringify((settings.hooks && settings.hooks.Stop) || '').includes('hq-table-as-image.js')) p.push('.claude/settings.json の Stop に hq-table-as-image.js が登録されていない');
    return p;
  };
  B['窓口の自動の要約の設定が違えば知らせる'] = () => {
    const p = [];
    const want = Number(limit['窓口の自動の要約']);
    if (want !== 700000) p.push(`routing.json の「窓口の自動の要約」が台帳(700000)と違う: ${limit['窓口の自動の要約']}`);
    const hq = { hq: true };
    const n1 = { prompts: 1, merges: 0 };
    if (typeof hook.autoCompactNotice !== 'function') return [...p, 'フックに、自動の要約の設定を見張る所(autoCompactNotice)が無い'];
    if (hook.autoCompactNotice(700000, n1, limit, hq) !== '') p.push('設定が 700000 なのに知らせが出る');
    for (const v of [undefined, 450000, 200000]) if (!/autoCompactWindow/.test(hook.autoCompactNotice(v, n1, limit, hq)) || !hook.autoCompactNotice(v, n1, limit, hq).includes('700000')) p.push(`設定が ${v} でも、窓口へ知らせが出ない`);
    if (hook.autoCompactNotice(450000, n1, limit, {}) !== '') p.push('部署の会話にまで知らせが出る(動くのは窓口の会話だけ)');
    if (hook.autoCompactNotice(450000, { prompts: 3, merges: 0 }, limit, hq) !== '') p.push('毎回の頼みで知らせが出る(最初と、くり返しの回だけ)');
    if (!hook.autoCompactNotice(450000, { prompts: limit['くり返し'], merges: 0 }, limit, hq)) p.push('くり返しの回で知らせが出ない');
    const os = require('os');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-home-'));
    if (hook.readAutoCompact(home) !== undefined) p.push('設定のファイルが無いのに値が読める');
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({ autoCompactWindow: 700000 }));
    if (hook.readAutoCompact(home) !== 700000) p.push('ユーザー設定の autoCompactWindow が読めない');
    fs.rmSync(home, { recursive: true, force: true });
    return p;
  };
  B['錠の検査がいつも回る一覧に入っている'] = () => {
    const always = JSON.parse(read('tools/run-checks-always.json')).checks || [];
    return always.includes('team/decision-lock-check.js') ? [] : ['tools/run-checks-always.json に team/decision-lock-check.js が無い(公開の前と CI で錠の検査が回らない)'];
  };
  return B;
}

function check() {
  const problems = [];
  const ng = (msg) => problems.push(msg);
  let table;
  try { table = JSON.parse(fs.readFileSync(LOCKS, 'utf8')); } catch (e) { return { problems: [`錠の表が読めない: ${e.message}`], locks: [] }; }
  const locks = Array.isArray(table['錠']) ? table['錠'] : [];
  const L = ledger();
  const hitLine = (lock, line) => { const k = lock['台帳'] || {}; return !!k['ことば'] && line.includes(k['ことば']) && (!k['日付'] || line.includes(k['日付'])); };

  // A
  for (const line of [...L.how, ...L.tagged]) {
    if (!locks.some(k => hitLine(k, line))) ng(`A 台帳の「進め方」の決めごとに錠が無い: ${line.slice(0, 70)}… → tools/team/decision-locks.json に1つ足す(守らせ方を決める。docs/rules/DECISION_LOCKS.md)`);
  }
  // B・C
  const ids = new Set();
  const place = makePlaces();
  let B = {};
  try { B = behaviours(); } catch (e) { ng(`D 動きの用意ができない: ${e.message}`); }
  const ranBehaviour = new Map();
  for (const k of locks) {
    const id = k.id || '(id なし)';
    if (!k.id || ids.has(k.id)) ng(`C ${id}: id が無いか重なっている`);
    ids.add(k.id);
    if (!L.all.some(line => hitLine(k, line))) ng(`B ${id}: 台帳にこのことばの行が無い「${(k['台帳'] || {})['ことば'] || ''}」(台帳を直したら錠も直す。決めごとが無くなったなら錠を消す)`);
    if (!KINDS.includes(k['守らせ方'])) { ng(`C ${id}: 守らせ方は ${KINDS.join('・')} のどれか`); continue; }
    const soft = k['守らせ方'] === '人が守る' || k['守らせ方'] === '対象外';
    if (soft) {
      if (!k['理由'] || String(k['理由']).length < 15) ng(`C ${id}: 「${k['守らせ方']}」には理由を書く(なぜ機械で確かめられないか)`);
    } else {
      const n = (k['検査'] || []).length + (k['動き'] || []).length + (k['要る'] || []).length;
      if (!n) ng(`C ${id}: 守らせ方が「${k['守らせ方']}」なのに、検査・動き・要ることばが1つも無い(確かめる手だてが無い)`);
      if (k['守らせ方'] !== '手引き' && !(k['仕組み'] || []).length) ng(`C ${id}: 守らせている道具・フックのファイル(仕組み)が書いていない`);
    }
    for (const f of k['仕組み'] || []) if (!exists(f)) ng(`C ${id}: 仕組みのファイルが無い ${f}`);
    for (const c of k['検査'] || []) {
      if (!c.file || !exists(c.file)) { ng(`C ${id}: 検査のファイルが無い ${c.file}`); continue; }
      let re; try { re = new RegExp(c['ことば']); } catch (e) { ng(`C ${id}: 検査のことばが正規表現として読めない`); continue; }
      if (!c['ことば'] || !re.test(read(c.file))) ng(`C ${id}: 検査 ${c.file} が、この決めごとのことば /${c['ことば']}/ を確かめていない(検査が変わったか、錠が古い)`);
    }
    // D
    for (const name of k['動き'] || []) {
      if (!B[name]) { ng(`D ${id}: 知らない動き「${name}」(decision-lock-check.js の behaviours に足す)`); continue; }
      if (!ranBehaviour.has(name)) { let r; try { r = B[name](); } catch (e) { r = [`動かせない: ${e.message}`]; } ranBehaviour.set(name, r); }
      for (const p of ranBehaviour.get(name)) ng(`D ${id}(${name}): ${p}`);
    }
    // E
    for (const w of k['要る'] || []) {
      const texts = place(w['どこ']);
      if (!texts) { ng(`E ${id}: 知らない場所「${w['どこ']}」`); continue; }
      if (!texts.length) { ng(`E ${id}: 「${w['どこ']}」の文が1つも作れない(道具が何も出さない)`); continue; }
      const miss = texts.filter(t => !t.text.includes(w['語']));
      if (miss.length) ng(`E ${id}: ${miss[0].name}${miss.length > 1 ? ` ほか${miss.length - 1}件` : ''} に、決めごとのことば「${w['語']}」が無い`);
    }
    // F
    for (const r of k['逆'] || []) {
      let re, except;
      try { re = new RegExp(r['形']); except = r['除く'] ? new RegExp(r['除く']) : null; } catch (e) { ng(`F ${id}: 逆のことばの形が正規表現として読めない`); continue; }
      if (!r['例'] || !re.test(r['例']) || (except && except.test(r['例']))) ng(`F ${id}: 逆のことば /${r['形']}/ が、直す前の文(例)に当たらない(見張りが空振りする)`);
      const texts = place(r['どこ']);
      if (!texts) { ng(`F ${id}: 知らない場所「${r['どこ']}」`); continue; }
      for (const t of texts) {
        const lines = t.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (!re.test(lines[i]) || (except && except.test(lines[i]))) continue;
          ng(`F ${id}: ${t.name}${lines.length > 1 ? ':' + (i + 1) : ''} に、決めごと「${k['決めごと']}」と逆のことばが残っている: ${lines[i].trim().slice(0, 90)}`);
        }
      }
    }
  }
  // 同じ行が2つの形に当たっても1件に数える(出力を小さく)
  return { problems: [...new Set(problems)], locks, lines: L.how.length + L.tagged.length };
}

function list(locks, onlyPeople) {
  for (const kind of KINDS) {
    if (onlyPeople && kind !== '人が守る') continue;
    const hit = locks.filter(k => k['守らせ方'] === kind);
    if (!hit.length) continue;
    console.log(`## ${kind}(${hit.length})`);
    for (const k of hit) console.log(`- ${k['決めごと']}` + (k['理由'] ? `\n    理由: ${k['理由']}` : `  ← ${[...(k['仕組み'] || []), ...(k['検査'] || []).map(c => c.file)].map(f => path.basename(f)).filter((v, i, a) => a.indexOf(v) === i).join('・')}`));
  }
}

function main() {
  const argv = process.argv.slice(2);
  const r = check();
  if (argv.includes('--list') || argv.includes('--people')) { list(r.locks, argv.includes('--people')); return; }
  if (r.problems.length) {
    console.error(`NG: 決めごとの錠に ${r.problems.length} 件の問題(台帳の決めごとと、道具・手引きが食い違っている)`);
    for (const p of r.problems.slice(0, 20)) console.error(`  - ${p}`);
    if (r.problems.length > 20) console.error(`  … ほか ${r.problems.length - 20} 件`);
    process.exit(1);
  }
  const by = (kind) => r.locks.filter(k => k['守らせ方'] === kind).length;
  console.log(`OK: 決めごとの錠 ${r.locks.length} 件(フック ${by('フック')}・道具 ${by('道具')}・手引き ${by('手引き')}・人が守る ${by('人が守る')}・対象外 ${by('対象外')})/台帳の「進め方」${r.lines} 行すべてに錠あり/逆のことば 0 件`);
}

if (require.main === module) main();
module.exports = { check };
