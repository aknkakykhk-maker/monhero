// ブリーダーLvの「1人1行の表」(breeder_levels)の確認(2026-10-27・社長の決定)。
//   ・送る関数は1行だけ上書きする(壊れた値・IDなしは送らない・表が無ければ黙って止まる)
//   ・読む関数はページ送りで全行を返し、表が無い・読めないときは空(rankings だけで並べる)
//   ・ゲーム側の結線: 送るきっかけは「開いたとき」と「Lvが上がったとき」だけ
//   ・ランキングは表の行を先に並べ、rankings の行で補う(rankings は消さない)
//   ・SQL: 足すだけ・削除の権限なし・Lvが下がらない・既存の表に触らない
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const app = fs.readFileSync('monster-hero/src/parts/60-app.jsx', 'utf8');
const a = src.indexOf('const BREEDER_LEVELS_TABLE'), b = src.indexOf('// ===== 記録そのものから拾う');
assert(a > 0 && b > a, '送る・読む関数のかたまりが見つからない');
const block = src.slice(a, b);

const run = async () => {
  const calls = [];
  let mode = 'ok';
  const pages = [];
  const ctx = {
    SUPABASE_URL: 'https://example.test', SB_HEADERS: { apikey: 'x' },
    _isMissingTableError: (status, body) => status === 404 && /PGRST205/.test(String(body || '')),
    rankingLog: () => {}, console: { error() {}, info() {} }, setTimeout, clearTimeout, AbortController,
    JSON, Math, Number, Array, Object, Promise,
    fetch: async (url, opt = {}) => {
      calls.push({ url, method: opt.method || 'GET', body: opt.body });
      if (mode === 'missing') return { ok: false, status: 404, text: async () => '{"code":"PGRST205"}' };
      if (mode === 'fail') return { ok: false, status: 500, text: async () => 'boom' };
      if (opt.method === 'POST') return { ok: true, status: 201, text: async () => '' };
      return { ok: true, status: 200, text: async () => JSON.stringify(pages.shift() || []) };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${block}\n;globalThis.up=sbUpsertBreederLevel;globalThis.fetchRows=sbFetchBreederLevelRows;globalThis.unavailable=()=>_breederLevelsUnavailable;`, ctx);

  // 送る: 1行だけ・on_conflict=breeder_id
  assert.strictEqual(await ctx.up({ breederId: 'b1', userName: 'あ', icon: 'Mocchi', level: 12.9 }), true);
  assert.strictEqual(calls.length, 1);
  assert(/breeder_levels\?on_conflict=breeder_id$/.test(calls[0].url), '表名と on_conflict');
  const sent = JSON.parse(calls[0].body);
  assert.strictEqual(sent.length, 1, '1行だけ送る');
  assert.strictEqual(JSON.stringify(sent[0]), JSON.stringify({ breeder_id: 'b1', user_name: 'あ', icon: 'Mocchi', level: 12 }));
  // 壊れた値・IDなしは送らない(通信も起きない)
  for (const bad of [{ breederId: '', level: 5 }, { breederId: 'b', level: 0 }, { breederId: 'b', level: NaN }, { breederId: null, level: 3 }, { breederId: 'b', level: 'x' }]) {
    assert.strictEqual(await ctx.up(bad), false);
  }
  assert.strictEqual(calls.length, 1, '壊れた値では通信しない');
  console.log('OK: 送る関数は正しい1行だけを送り、壊れた値は送らない');

  // 読む: ページ送り(1ページ目の件数をそのサーバーの1ページ分とみなす)
  calls.length = 0;
  pages.push([{ breeder_id: 'a', user_name: 'A', level: 9, icon: null }, { breeder_id: 'b', user_name: 'B', level: 8, icon: null }],
             [{ breeder_id: 'c', user_name: 'C', level: 7, icon: null }, { breeder_id: 'd', user_name: 'D', level: 0, icon: null }],
             [{ breeder_id: 'e', user_name: 'テスト', level: 1, icon: '🐣' }], []);
  const rows = await ctx.fetchRows('t');
  assert.strictEqual(JSON.stringify(rows.map(r => r.breeder_id)), '["a","b","c"]', 'Lv.1以下の行(表に残るテスト行など)は外し、全ページを集める');
  assert(calls.every(c => /select=breeder_id,user_name,level,icon/.test(c.url)), '読む列は4つだけ');
  assert(calls.every(c => /level=gte\.2(&|$)/.test(c.url)), 'サーバー側でも Lv.2 以上だけを頼む(通信量も減らす)');
  console.log('OK: 読む関数は全ページを集める(列は4つだけ)');

  // 表が無い: 空で、以後は通信しない
  mode = 'missing'; calls.length = 0;
  assert.strictEqual((await ctx.fetchRows('t')).length, 0);
  assert.strictEqual(ctx.unavailable(), true);
  const n = calls.length;
  assert.strictEqual(await ctx.up({ breederId: 'b1', level: 3 }), false);
  assert.strictEqual((await ctx.fetchRows('t')).length, 0);
  assert.strictEqual(calls.length, n, '表が無いと分かったあとは通信しない');
  console.log('OK: 表が無い環境では黙って止まり、通信も繰り返さない');
};

(async () => {
  await run();
  // 読めない(500)でも投げない
  const ctx = { SUPABASE_URL: 'u', SB_HEADERS: {}, _isMissingTableError: () => false, rankingLog() {}, console: { error() {}, info() {} }, setTimeout, clearTimeout, AbortController, JSON, Math, Number, Array, Object, Promise,
    fetch: async () => ({ ok: false, status: 500, text: async () => 'boom' }) };
  vm.createContext(ctx);
  vm.runInContext(`${block}\n;globalThis.fetchRows=sbFetchBreederLevelRows;`, ctx);
  assert.strictEqual((await ctx.fetchRows('t')).length, 0, '読めなくても投げず、空を返す');
  console.log('OK: 読めないときも投げない(rankings だけで並ぶ)');

  // ゲーム側の結線
  const has = (s) => app.includes(s);
  const eff = app.slice(app.indexOf('const lastPublishedBreederLevelRef'), app.indexOf('// ===== フレンド機能'));
  assert(eff.includes('if (!dataLoaded || !onboarded || onboardingPreview) return;'), '読み終えた後・はじめての設定の後・プレビュー中は送らない');
  assert(eff.includes('lastPublishedBreederLevelRef.current >= level) return;'), '同じ・低いLvは送り直さない');
  assert(eff.includes('level < BREEDER_LEVEL_PUBLISH_MIN'), 'Lv.1の端末は送らない(行を積み上げない)');
  assert(/const BREEDER_LEVEL_PUBLISH_MIN = 2;/.test(src), 'Lv.2から送る');
  assert(eff.includes('sbUpsertBreederLevel('), '送る関数を呼ぶ');
  assert(/\[dataLoaded, onboarded, onboardingPreview, breederXp, breederName, breederIcon\]/.test(eff), 'きっかけは読み終え・Lv(経験値)の変化だけ');
  assert(!/breederLevel\b/.test(eff.replace(/\/\/.*$/gm, '')), 'breederLevel(下で作る)を先に使わない');
  console.log('OK: 送るきっかけは「開いたとき」と「Lvが上がったとき」だけ');
  assert(has('breederLevelTableRows = await sbFetchBreederLevelRows(requestId);'), '表を読む');
  assert(has('aggregateBreederLevels([...levelTableEntries, ...fetched])'), '表の行を先に並べ、rankings の行で補う');
  assert(has('sbFetchAllBreederRows(requestId);'), 'rankings の全行読みは残す(まだ表に来ていない人の分)');
  console.log('OK: ランキングは表を先に並べ、rankings の行で補う');

  // 並べ方: 表の行(裏周回だけの人)が載り、同じ人は高いほうの1行になる
  const g0 = src.indexOf('const aggregateBreederLevels'), g1 = src.indexOf('// ブリーダーLv用に、rankingsの全行をページ送りで読む');
  const h0 = src.indexOf('const breederIdBridgeFrom'), h1 = src.indexOf('const aggregateBreederLevels');
  assert(g0 > 0 && g1 > g0 && h0 > 0);
  const c3 = {}; vm.createContext(c3);
  const helperNames = ['directBreederIdOf', 'breederIdBridgeFrom', 'resolveBreederIdFor'];
  const grab = (name) => { const i = src.indexOf(`const ${name} =`); assert(i > 0, name); const j = src.indexOf('\n};', i); return src.slice(i, j + 3); };
  vm.runInContext(`let _breederProfileById=new Map(),_breederProfileByName=new Map(),_recordIdByName=new Map(),_recordLookById=new Map(),_recordLookByName=new Map();\n${helperNames.map(grab).join('\n')}\n${src.slice(g0, g1)}\n;globalThis.agg=aggregateBreederLevels;`, c3);
  const merged = c3.agg([
    { userName: '裏周回さん', breederId: 'id-ura', level: 120, icon: null },        // 表の行(rankings には1行も無い人)
    { userName: 'チャレンジさん', breederId: 'id-ch', level: 50, icon: null },       // 表の行
    { userName: 'チャレンジさん', breederId: 'id-ch', level: 40, icon: null },       // rankings の古い行(同じ人)
    { userName: '昔の人', level: 70, icon: null },                                    // 表に来ていない人(rankings だけ)
  ]);
  assert.strictEqual(merged.map(r => `${r.userName}:${r.level}`).join(','), '裏周回さん:120,昔の人:70,チャレンジさん:50');
  console.log('OK: 裏周回だけの人も載り、同じ人は高いほうの1行・表に来ていない人は rankings で補われる');

  // 検査の中で navigator.webdriver を偽る(人の端末に見せる)と、ゲームの「自動操作は本物へ書かない」止めが効かない。
  // そういう検査は Supabase を必ず差し替えること(2026-10-27・debug-passphrase-browser-check が本番の表へ行を足していた)
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === 'node_modules' ? [] : e.isDirectory() ? walk(d + '/' + e.name) : e.name.endsWith('.js') ? [d + '/' + e.name] : []);
  const spoofers = walk('tools').filter((f) => /defineProperty\([^)]*['"]webdriver['"]/.test(fs.readFileSync(f, 'utf8')));
  for (const f of spoofers) {
    const t = fs.readFileSync(f, 'utf8');
    assert(/route\([^)]*supabase/i.test(t), `${f}: webdriver を偽るのに Supabase を差し替えていない(本番へ書いてしまう)`);
  }
  console.log(`OK: webdriver を偽る検査(${spoofers.length}本)は Supabase を差し替えている`);
  // __mhSupabaseStubbed = true を立てる検査も同じ(止めが外れる。差し替えが無いと本番へ書く)。
  // 差し替えの印: page/context の route(...)・fake-supabase・sb.handle のどれか
  const stubbers = walk('tools').filter((f) => /__mhSupabaseStubbed\s*=\s*true/.test(fs.readFileSync(f, 'utf8')));
  for (const f of stubbers) {
    const t = fs.readFileSync(f, 'utf8');
    assert(/route\(|createFakeSupabase|sb\.handle/.test(t), `${f}: __mhSupabaseStubbed = true を立てるのに Supabase を差し替えていない(本番へ書いてしまう)`);
    // 表(rest/v1)だけ差し替えて、助手の中継(functions/v1)を忘れると、本物の Edge Function が AI を呼ぶ。
    // 「host ごとまとめて差し替え」「fake-supabase」「functions/v1 の差し替え」のどれかが要る(正規表現で functions\/v1 と書いた差し替えも認める・2026-10-27)
    assert(/functions\\?\/v1|createFakeSupabase|sb\.handle|supabase\\?\.co|\*\*\/\*/.test(t), `${f}: Supabase の表だけ差し替えて、助手の中継(functions/v1)を差し替えていない(本物の AI を呼んでしまう)`);
  }
  console.log(`OK: __mhSupabaseStubbed = true を立てる検査(${stubbers.length}本)は Supabase を差し替えている`);

  // SQL
  const dir = 'docs/sql/rankings/';
  const apply = fs.readFileSync(dir + 'BREEDER_LEVELS_APPLY.sql', 'utf8');
  const test = fs.readFileSync(dir + 'BREEDER_LEVELS_APPLY_TEST.sql', 'utf8');
  const code = (t) => t.replace(/--.*$/gm, '');
  assert(/revoke delete on public\.breeder_levels from anon, authenticated;/.test(apply), '削除の権限は与えない');
  assert(!/\bgrant\s[^;]*delete/i.test(code(apply)), 'DELETE を grant しない');
  assert(/primary key \(breeder_id\)/.test(apply), '1人1行(主キーは breeder_id)');
  assert(/new\.level < old\.level/.test(apply), 'Lvが下がらない');
  assert(!/\b(drop table|truncate|alter table public\.(rankings|bond_levels|breeder_profiles)|update public\.(rankings|bond_levels|breeder_profiles)|delete from public\.(rankings|bond_levels|breeder_profiles))/i.test(code(apply)), '既存の表に触らない');
  assert(/commit;/.test(code(apply)) && /rollback;/.test(code(test)) && !/commit;/.test(code(test)), '予行は rollback・実適用は commit');
  console.log('OK: SQLは足すだけ(削除権限なし・Lvは下がらない・既存の表に触らない・予行は rollback)');
})().catch((e) => { console.error('NG:', e.message); process.exit(1); });
