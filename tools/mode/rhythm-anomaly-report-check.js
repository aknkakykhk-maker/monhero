// 判定の異変を毎日報告する(2026-10-16 社長の決定)を、本番の Claude API と DB を使わずに確かめる。
//
//   node tools/mode/rhythm-anomaly-report-check.js
//
// 偽物の Claude・偽物の DB を、Edge Function の中身(supabase/functions/rhythm-anomaly-report/core.js)へ渡して、
//   ① 合言葉が無い・違う・照らせない → 403。集計も Claude も呼ばず、表にも書かない
//   ② 異変が0件 → Claude を呼ばずに quiet で書く(費用0)
//   ③ 異変あり → Claude Haiku 5.5 を1回(effort low・max_tokens 4000)。報告と使ったトークンを ok で書く
//   ④ 断られた(refusal) → refused で、数字の表だけ書く
//   ⑤ API エラー・空の返事 → error で書き、502
//   ⑥ 端末の種類ごとの MISS 率が急に上がった日は、異変が0件でも Claude を呼ぶ
//   ⑦ Claude へ渡すものに device_key などの欄が無い(あれば Claude を呼ばずに error)
//   ⑧ 日付: ?day= の形が違えば 400、無ければ日本時間の昨日
//   ⑨ 入口(index.ts)が合言葉を DB で照らし、表へは report_date で上書きする
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const DIR = path.join(root, 'supabase', 'functions', 'rhythm-anomaly-report');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 10/15 の本番の集計(SELECT だけで取った形そのもの)
const FLAGGED_FACTS = {
  day: '2026-10-15', plays_day: 25, plays_base_per_day: 63.6,
  builds_day: ['2026-10-14 19:25', '2026-10-15 22:05'],
  platforms: [
    { platform: 'android', plays_day: 12, miss_rate_day: 0.021, miss_rate_base: 0.0134, no_input_rate_day: 0.0011, no_input_rate_base: 0.0011, late_rate_day: 0, late_rate_base: 0, slow_per_1000_day: 0, slow_per_1000_base: 1.71 },
    { platform: 'ios', plays_day: 13, miss_rate_day: 0.0309, miss_rate_base: 0.0204, no_input_rate_day: 0.0019, no_input_rate_base: 0.0011, late_rate_day: 0.042, late_rate_base: 0.1873, slow_per_1000_day: 5.71, slow_per_1000_base: 7.52 },
  ],
  flagged: [{ song: 'toriko', difficulty: 'MASTER', platform: 'ios', plays_day: 2, plays_base: 9, miss_rate_day: 0.0755, miss_rate_base: 0.0084,
    no_input_miss_day: 9, no_input_miss_base: 1, logs_day: 2, logs_base: 17,
    miss_by_5pct_day: [4, 2, 6, 0, 0, 4, 2, 3, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    miss_by_5pct_base: [1, 0, 1, 1, 1, 2, 3, 2, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }],
};
const QUIET_FACTS = { ...FLAGGED_FACTS, flagged: [], platforms: FLAGGED_FACTS.platforms.map((p) => ({ ...p, miss_rate_day: p.miss_rate_base })) };
const JUMP_FACTS = { ...QUIET_FACTS, platforms: [{ platform: 'ios', plays_day: 20, miss_rate_day: 0.05, miss_rate_base: 0.02 }] };

const fakeClient = (respond) => {
  const calls = [];
  return { calls, messages: { create: async (params) => { calls.push(params); return respond(params); } } };
};
const okText = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], usage: { input_tokens: 1500, output_tokens: 700 } });
const fakeDb = ({ facts = FLAGGED_FACTS, tokenOk = true, tokenThrows = false } = {}) => {
  const state = { rows: [], factsCalls: [], tokens: [] };
  return {
    state,
    tokenOk: async (t) => { state.tokens.push(t); if (tokenThrows) throw new Error('rpc'); return tokenOk; },
    loadFacts: async (d) => { state.factsCalls.push(d); return typeof facts === 'function' ? facts(d) : facts; },
    save: async (row) => { state.rows.push(row); },
  };
};

(async () => {
  const core = await import(path.join(DIR, 'core.js'));
  const run = (db, client, extra = {}) => core.runReport({ token: 'ok-token', day: '2026-10-15', ...db, client, ...extra });

  // ① 合言葉
  for (const [label, token, opts] of [['空', '', {}], ['違う', 'wrong', { tokenOk: false }], ['照らせない', 'ok-token', { tokenThrows: true }]]) {
    const db = fakeDb(opts), client = fakeClient(() => okText('x'));
    const res = await run(db, client, { token });
    check(`合言葉が${label} → 403・集計も Claude も呼ばない・表に書かない`,
      res.status === 403 && db.state.factsCalls.length === 0 && client.calls.length === 0 && db.state.rows.length === 0,
      `status=${res.status} 集計=${db.state.factsCalls.length} Claude=${client.calls.length} 行=${db.state.rows.length}`);
  }
  {
    const db = fakeDb(), client = fakeClient(() => okText('x'));
    await run(db, client, { token: '' });
    check('合言葉が空なら DB にも照らしに行かない', db.state.tokens.length === 0);
  }

  // ② quiet
  {
    const db = fakeDb({ facts: QUIET_FACTS }), client = fakeClient(() => okText('x'));
    const res = await run(db, client);
    const row = db.state.rows[0] || {};
    check('異変が0件 → Claude を呼ばずに quiet で書く', res.status === 200 && client.calls.length === 0 && row.status === 'quiet'
      && row.summary === core.QUIET_SUMMARY && row.flagged_count === 0 && row.report_date === '2026-10-15' && row.model === null,
      JSON.stringify({ status: res.status, calls: client.calls.length, row: { ...row, facts: undefined } }));
  }

  // ③ ok
  {
    const db = fakeDb(), client = fakeClient(() => okText('・toriko MASTER(iPhone)の MISS が増えました。'));
    const res = await run(db, client);
    const call = client.calls[0] || {}, row = db.state.rows[0] || {};
    check('異変あり → Claude Haiku 5.5 を1回(effort low・max_tokens 4000)', client.calls.length === 1 && call.model === 'claude-haiku-5-5'
      && call.max_tokens === 4000 && call.output_config?.effort === 'low' && !('thinking' in call) && !('temperature' in call),
      JSON.stringify({ model: call.model, max: call.max_tokens, oc: call.output_config }));
    check('Claude へは集計の JSON だけを1通で渡す', Array.isArray(call.messages) && call.messages.length === 1 && call.messages[0].role === 'user'
      && JSON.stringify(JSON.parse(call.messages[0].content)) === JSON.stringify(FLAGGED_FACTS) && typeof call.system === 'string' && call.system.includes('600字'));
    check('報告・件数・トークンを ok で書く', res.status === 200 && row.status === 'ok' && row.summary.startsWith('・toriko') && row.flagged_count === 1
      && row.model === 'claude-haiku-5-5' && row.input_tokens === 1500 && row.output_tokens === 700 && row.facts === FLAGGED_FACTS && db.state.rows.length === 1,
      JSON.stringify({ ...row, facts: undefined }));
  }
  // ③-2 連打の多いプレイを外した数(2026-10-19・mashed_excluded_day)。外した日だけ本文に1行足す。無い日・0 の日は今までと同じ本文
  {
    const db = fakeDb({ facts: { ...QUIET_FACTS, mashed_excluded_day: 35 } }), client = fakeClient(() => okText('x'));
    await run(db, client);
    const row = db.state.rows[0] || {};
    check('quiet の日も、連打で外した数を本文に1行足す', row.status === 'quiet' && row.summary === `${core.QUIET_SUMMARY}\n連打の多いプレイ35件を除いた。` && client.calls.length === 0, row.summary);
  }
  {
    const db = fakeDb({ facts: { ...FLAGGED_FACTS, mashed_excluded_day: 2 } }), client = fakeClient(() => okText('・toriko MASTER(iPhone)の MISS が増えました。'));
    await run(db, client);
    const row = db.state.rows[0] || {};
    check('報告の本文の最後に、連打で外した数を1行足す', row.status === 'ok' && row.summary === '・toriko MASTER(iPhone)の MISS が増えました。\n連打の多いプレイ2件を除いた。', row.summary);
  }
  {
    const db = fakeDb({ facts: { ...QUIET_FACTS, mashed_excluded_day: 0 } }), client = fakeClient(() => okText('x'));
    await run(db, client);
    check('外した数が0の日は本文を変えない', (db.state.rows[0] || {}).summary === core.QUIET_SUMMARY);
  }
  check('Claude への説明に、外した数の項目の意味を書いている', core.SYSTEM.includes('mashed_excluded_day'));
  {
    const long = 'あ'.repeat(core.MAX_SUMMARY_CHARS + 50);
    const db = fakeDb(), client = fakeClient(() => okText(long));
    await run(db, client);
    check(`報告は ${core.MAX_SUMMARY_CHARS} 字で切る`, (db.state.rows[0]?.summary || '').length === core.MAX_SUMMARY_CHARS);
  }

  // ④ refused
  {
    const db = fakeDb(), client = fakeClient(() => ({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: null }, content: [], usage: { input_tokens: 1500, output_tokens: 3 } }));
    const res = await run(db, client);
    const row = db.state.rows[0] || {};
    check('断られた → refused で数字の表だけ書く', res.status === 200 && row.status === 'refused' && row.summary === null && row.facts === FLAGGED_FACTS && row.flagged_count === 1,
      JSON.stringify({ ...row, facts: undefined }));
  }

  // ⑤ API エラー・空の返事
  {
    const db = fakeDb(), client = fakeClient(() => { const e = new Error('overloaded'); e.status = 529; throw e; });
    const res = await run(db, client);
    check('API エラー → error で書いて 502', res.status === 502 && db.state.rows[0]?.status === 'error' && db.state.rows[0]?.summary === null);
  }
  {
    const db = fakeDb(), client = fakeClient(() => ({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }], usage: { input_tokens: 1500, output_tokens: 4000 } }));
    const res = await run(db, client);
    check('文の無い返事 → error で書いて 502', res.status === 502 && db.state.rows[0]?.status === 'error' && db.state.rows[0]?.output_tokens === 4000);
  }
  {
    const db = fakeDb({ facts: () => { throw new Error('rpc'); } }), client = fakeClient(() => okText('x'));
    const res = await run(db, client);
    check('集計が取れない → Claude を呼ばずに error で書いて 500', res.status === 500 && client.calls.length === 0 && db.state.rows[0]?.status === 'error');
  }

  // ⑥ 端末の種類ごとの急な上がり
  {
    const db = fakeDb({ facts: JUMP_FACTS }), client = fakeClient(() => okText('・iPhone 全体の MISS が増えました。'));
    await run(db, client);
    check('異変0件でも、端末の種類ごとの MISS 率が急に上がった日は Claude を呼ぶ', client.calls.length === 1 && db.state.rows[0]?.status === 'ok' && db.state.rows[0]?.flagged_count === 0);
    check('回数が少ない(10回未満)端末の上がりは数えない', core.platformJump({ platforms: [{ plays_day: 9, miss_rate_day: 0.05, miss_rate_base: 0.02 }] }) === false
      && core.platformJump({ platforms: [{ plays_day: 20, miss_rate_day: 0.05, miss_rate_base: null }] }) === false);
  }

  // ⑦ 個人の情報の欄
  {
    const leaky = { ...FLAGGED_FACTS, flagged: [{ ...FLAGGED_FACTS.flagged[0], device_key: 'abc' }] };
    const db = fakeDb({ facts: leaky }), client = fakeClient(() => okText('x'));
    const res = await run(db, client);
    const row = db.state.rows[0] || {};
    check('device_key などの欄があれば Claude を呼ばず、表にも中身を残さない', client.calls.length === 0 && res.status === 500 && row.status === 'error'
      && !JSON.stringify(row).includes('abc'), JSON.stringify(row));
  }
  {
    const db = fakeDb(), client = fakeClient(() => okText('x'));
    await run(db, client);
    const sent = JSON.stringify(client.calls[0] || {});
    check('Claude へ渡すものに device_key・名前・ID の欄が無い', !/device_key|breeder|player_name|user_id/.test(sent));
  }

  // ⑧ 日付
  {
    const db = fakeDb(), client = fakeClient(() => okText('x'));
    const res = await run(db, client, { day: '2026-13-40' });
    check('?day= の形が違えば 400(集計も呼ばない)', res.status === 400 && db.state.factsCalls.length === 0);
  }
  {
    const db = fakeDb({ facts: QUIET_FACTS }), client = fakeClient(() => okText('x'));
    await run(db, client, { day: null, now: new Date('2026-10-15T18:10:00Z') }); // 10/16 3:10 JST
    check('日付が無ければ日本時間の昨日(3:10 JST に動いたら前の日)', db.state.factsCalls[0] === '2026-10-15' && db.state.rows[0]?.report_date === '2026-10-15', db.state.factsCalls[0]);
    check('日本時間の日付の境目', core.jstYesterday(new Date('2026-10-15T14:59:00Z')) === '2026-10-14' && core.jstYesterday(new Date('2026-10-15T15:00:00Z')) === '2026-10-15');
  }

  // ⑨ 入口
  {
    const src = fs.readFileSync(path.join(DIR, 'index.ts'), 'utf8');
    check('入口: 合言葉を x-cron-token から取り、DB の rhythm_anomaly_token_ok で照らす',
      /req\.headers\.get\("x-cron-token"\)/.test(src) && /rpc\("rhythm_anomaly_token_ok", \{ p_token: token \}\)/.test(src));
    check('入口: 集計は rhythm_anomaly_facts、表へは report_date で上書き',
      /rpc\("rhythm_anomaly_facts", \{ p_day: day \}\)/.test(src) && /from\("rhythm_anomaly_reports"\)\.upsert\(row, \{ onConflict: "report_date" \}\)/.test(src));
    check('入口: API キー・合言葉の値をコードに書いていない', !/sk-ant-|ANTHROPIC_API_KEY\s*=|apiKey\s*:/.test(src) && !/RHYTHM_ANOMALY_CRON_TOKEN/.test(src));
    check('入口: POST だけを受ける', /req\.method !== "POST"/.test(src));
  }
  // 曲の途中から放置したプレイ(入力5回以下・未クリア)を集計から外す(2026-10-21 社長の決定)。
  // 外すのは見張りの集計だけ(関数を作り直すだけで、表・行には触れない)。連打を外す決まりも残っていること
  {
    const sql = fs.readFileSync(path.join(root, 'docs/sql/rankings/RHYTHM_ANOMALY_FACTS_ABANDON_APPLY.sql'), 'utf8');
    const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    check('集計: 放置したプレイ(入力5回以下・未クリア)と連打の多いプレイを外し、外した数を返す',
      /\(t\.stats->>'inputs'\)::int,0\) <= 5 and coalesce\(\(t\.stats->>'cleared'\)::boolean,true\) = false\) as abandoned/.test(code)
        && /d as \(select \* from d0 where touches <= notes \* 5 and not abandoned\)/.test(code)
        && /'abandoned_excluded_day'/.test(code) && /'mashed_excluded_day'/.test(code)
        && /l\.cleared = false and \(select count\(\*\)[\s\S]*?<> 'zz'\) <= 5/.test(code));
    check('集計: 関数を作り直すだけで、表・行を変えない', /create or replace function public\.rhythm_anomaly_facts\(p_day date\)/.test(code)
      && !/\b(insert|update|delete|truncate|drop|alter)\b/i.test(code));
  }

  console.log('');
  if (failed) { console.log(`${failed}件のNGがあります`); process.exit(1); }
  console.log('すべてOK');
})().catch((e) => { console.error(e); process.exit(1); });
