// クリスマスのレイドの定義(35-raid-xmas.jsx)と、回数・与ダメージの口(36-raid-xmas-api.jsx)を、偽の fetch で確かめる(通信はしない)。
// つなぎ目の正本: docs/progress/event-xmas-2026/BUILD.md
//
// 見るもの
//   ① 定義: イベントid・期間・保存キー・入口3つ・段階5つずつ・開始時刻が 17-release の RAID_XMAS_START_AT と同じ
//   ② 回数: 期間外は使えない・1日3回・使ったら mh_raid_xmas_v1 に書く・ジャックのキーには書かない
//   ③ ダメージ: raid_xmas_2026 で source 付きで送る・共有ライフの残りで倒したかを決める・倒したら次が開く
//   ④ card: 端末の再送待ちで battle に化けない・SQL の前(制約で 400)は再送待ちに残す
//   ⑤ デバッグ: デバッグのidで送り、端末の記録に書かない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const P = 'monster-hero/src/parts/';
const src = ['35-raid-jack.jsx', '35-raid-xmas.jsx', '36-raid-jack-api.jsx', '36-raid-xmas-api.jsx'].map((f) => read(P + f)).join('\n');

const make = (nowIso) => {
  const calls = [];
  const store = {};
  let responder = () => ({ ok: true, status: 201, body: '' });
  const RealDate = Date;
  const fixed = RealDate.parse(nowIso);
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
  const ctx = {
    console, Object, Number, Math, Array, JSON, String, Boolean, Date: FakeDate, isNaN, Promise, Set, encodeURIComponent,
    setTimeout: (f, ms) => { if (!(ms >= 4000)) f(); return 0; }, clearTimeout, AbortController, RegExp, Error,   // 再試行の待ちは飛ばし、取得を打ち切る待ち(4秒以上)は起こさない
    ensureBreederId: async () => 'breeder-aaaa1111',
    SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: { apikey: 'k' }, BUILD_DATE: '2026-11-26 12:00',
    _isMissingTableError: (status) => status === 404,
    storeGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storeSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    createBattleEnemy: () => null,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const r = responder(url, init);
      return { ok: r.ok, status: r.status, text: async () => r.body, headers: { get: () => null } };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${src}\nthis.o={RAID_XMAS_EVENT,RAID_XMAS_SOURCES,RAID_XMAS_A_TIERS,RAID_XMAS_B_TIERS,RAID_XMAS_STORY_IDS,raidXmasWindowAt,raidXmasUseTry,raidXmasAddDamage,raidXmasLoadState,raidXmasSetDebug,raidXmasStoryCandidates,raidJackNormalizePending,sbSendRaidJackHit,RAID_XMAS_SKILL_NAMES,RAID_JACK_SKILL_NAMES};`, ctx);
  return { o: ctx.o, calls, store, setResponder: (f) => { responder = f; } };
};
const OPEN = '2026-12-01T12:00:00+09:00';
const totalsBody = (a1) => JSON.stringify([{ kind: 'a', tier: 1, total_damage: a1, player_count: 3, any_defeated: false }]);

(async () => {
  // ① 定義
  {
    const t = make(OPEN);
    const E = t.o.RAID_XMAS_EVENT;
    check('イベントidは raid_xmas_2026・デバッグは raid_xmas_debug', E.id === 'raid_xmas_2026' && E.debugId === 'raid_xmas_debug');
    check('期間は 2026-11-30 10:00〜2026-12-31 4:00(JST)', E.startAt === '2026-11-30T10:00:00+09:00' && E.endAt === '2026-12-31T04:00:00+09:00');
    check('保存キーは新しい mh_raid_xmas_v1', E.storageKey === 'mh_raid_xmas_v1');
    check('入口は battle / rhythm / card', JSON.stringify(t.o.RAID_XMAS_SOURCES) === '["battle","rhythm","card"]');
    check('段階は A・B とも5つ', t.o.RAID_XMAS_A_TIERS.length === 5 && t.o.RAID_XMAS_B_TIERS.length === 5);
    check('期間の判定', t.o.raidXmasWindowAt(Date.parse('2026-11-30T09:59:59+09:00')) === 'before' && t.o.raidXmasWindowAt(Date.parse('2026-11-30T10:00:00+09:00')) === 'open' && t.o.raidXmasWindowAt(Date.parse('2026-12-31T04:00:00+09:00')) === 'after');
    const rel = read(P + '17-release-changelog-login-missions.jsx');
    const m = rel.match(/const RAID_XMAS_START_AT = '([^']+)'/);
    check('17-release の RAID_XMAS_START_AT と開始時刻が同じ', !!m && m[1] === E.startAt, m ? m[1] : 'なし');
    check('RELEASE_FLAGS.raidXmas は開始時刻で開く getter', /get raidXmas\(\) \{ try \{ return Date\.now\(\) >= Date\.parse\(RAID_XMAS_START_AT\)/.test(rel));
    check('お話のidは raid_xmas_ で始まる8本', t.o.RAID_XMAS_STORY_IDS.length === 8 && t.o.RAID_XMAS_STORY_IDS.every((id) => /^raid_xmas_/.test(id)));
    const cand = t.o.raidXmasStoryCandidates({ a: { 1: { total: t.o.RAID_XMAS_A_TIERS[0].hp } } }, Date.parse(OPEN));
    check('段階1を倒すと2本目のお話が候補に出る', JSON.stringify(cand) === '["raid_xmas_story_2"]', JSON.stringify(cand));
  }
  // ② 回数
  {
    const before = make('2026-11-30T09:00:00+09:00');
    check('開始前は回数を使えない', (await before.o.raidXmasUseTry()).ok === false);
    const t = make(OPEN);
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await t.o.raidXmasUseTry());
    check('1日3回まで', r.slice(0, 3).every((x) => x.ok && /^[0-9A-Za-z_-]{8,64}$/.test(x.hitId) && x.eventId === 'raid_xmas_2026') && r[3].ok === false);
    check('使った数は mh_raid_xmas_v1 に入る', t.store.mh_raid_xmas_v1 && t.store.mh_raid_xmas_v1.a.used === 3);
    check('ジャックのキーには書かない', !('mh_raid_jack_v1' in t.store) && Object.keys(t.store).every((k) => k === 'mh_raid_xmas_v1'));
  }
  // ③ ダメージ
  {
    const t = make(OPEN);
    const hp = t.o.RAID_XMAS_A_TIERS[0].hp;
    t.setResponder((url) => (/raid_jack_tier_totals/.test(url) ? { ok: true, status: 200, body: totalsBody(hp - 1000) } : { ok: true, status: 201, body: '' }));
    const tr = await t.o.raidXmasUseTry();
    const res = await t.o.raidXmasAddDamage({ source: 'card', kind: 'a', tierIndex: 0, damage: 1500, hitId: tr.hitId, eventId: tr.eventId, detail: { won: true } });
    const post = t.calls.find((c) => c.init && c.init.method === 'POST');
    const row = post ? JSON.parse(post.init.body) : {};
    check('raid_xmas_2026・source card で送る', row.event_id === 'raid_xmas_2026' && row.source === 'card' && row.tier === 1 && row.damage === 1500 && row.hit_id === tr.hitId, JSON.stringify(row));
    check('残り1,000に1,500で倒した扱い・次が開く', res.outcome === 'sent' && res.defeated === true && res.opened === true && res.lifeBefore === 1000 && res.lifeLeft === 0, JSON.stringify(res));
    check('倒した段階は端末に入る', t.store.mh_raid_xmas_v1.a.defeated.includes('a1'));
    const t2 = make(OPEN);
    t2.setResponder((url) => (/raid_jack_tier_totals/.test(url) ? { ok: true, status: 200, body: totalsBody(0) } : { ok: true, status: 201, body: '' }));
    const small = await t2.o.raidXmasAddDamage({ source: 'rhythm', kind: 'a', tierIndex: 0, damage: 10, hitId: 'rjtest0001' });
    check('残りに届かなければ倒していない', small.defeated === false && small.opened === false && small.outcome === 'sent');
    const bad = await t2.o.raidXmasAddDamage({ source: 'card', kind: 'b', tierIndex: 0, damage: 10, hitId: 'rjtest0002' });
    check('グランドスラムにカードは入れない', bad.outcome === 'invalid');
    const zero = await t2.o.raidXmasAddDamage({ source: 'rhythm', kind: 'a', tierIndex: 0, damage: 0, hitId: 'rjtest0003' });
    check('0ダメージは送らない', zero.outcome === 'sent' && !t2.calls.some((c) => c.init && c.init.body && /rjtest0003/.test(c.init.body)));
  }
  // ④ card の再送待ち
  {
    const t = make(OPEN);
    const p = t.o.raidJackNormalizePending([{ hitId: 'rjcard0001', kind: 'a', tier: 1, damage: 5, source: 'card' }, { hitId: 'rjold00001', kind: 'a', tier: 1, damage: 5 }]);
    check('再送待ちで card は card のまま・印の無い古い行は battle', p[0].source === 'card' && p[1].source === 'battle');
    t.setResponder((url, init) => (init && init.method === 'POST' ? { ok: false, status: 400, body: 'new row violates check constraint "raid_jack_hits_source_check"' } : { ok: true, status: 200, body: '[]' }));
    const res = await t.o.raidXmasAddDamage({ source: 'card', kind: 'a', tierIndex: 0, damage: 99, hitId: 'rjcard0002' });
    const posts = t.calls.filter((c) => c.init && c.init.method === 'POST').map((c) => JSON.parse(c.init.body));
    check('SQL の前は battle として送り直さない', posts.every((r) => r.source === 'card'), JSON.stringify(posts));
    check('SQL の前は再送待ちに card で残る', res.outcome === 'pending' && t.store.mh_raid_xmas_v1.pending.some((x) => x.hitId === 'rjcard0002' && x.source === 'card'));
  }
  // ⑤ デバッグ
  {
    const t = make('2026-11-27T12:00:00+09:00');
    t.o.raidXmasSetDebug({ force: true });
    const tr = await t.o.raidXmasUseTry();
    check('デバッグは開始前でも始められ・デバッグのidになる', tr.ok && tr.eventId === 'raid_xmas_debug');
    await t.o.raidXmasAddDamage({ source: 'battle', kind: 'a', tierIndex: 0, damage: 50, hitId: tr.hitId, eventId: tr.eventId, defeated: true });
    const row = JSON.parse((t.calls.find((c) => c.init && c.init.method === 'POST') || { init: { body: '{}' } }).init.body);
    check('デバッグはデバッグのidで送る', row.event_id === 'raid_xmas_debug');
    check('デバッグは端末の記録に書かない', !('mh_raid_xmas_v1' in t.store));
  }
  // ---- ボスの技の名前(社長決定・r1125-058)。サンタの名前は敵を作るときだけ写す。ジャックの名前は変えない ----
  {
    const t = make('2026-12-01T12:00:00+09:00');
    const x = t.o.RAID_XMAS_SKILL_NAMES, j = t.o.RAID_JACK_SKILL_NAMES;
    check('サンタの技名(正拳・闇 / 瞬黒撃 / X’マスキャロル / 超飛び蹴り / 超暗けい / 怪しこの夜 / X’マスプレデター)',
      x.normal === '正拳・闇' && x.special === '瞬黒撃' && x.sweep === 'X\u2019マスキャロル' && x.rush === '超飛び蹴り'
      && x.pierce === '超暗けい' && x.roar === '怪しこの夜' && x.allout === 'X\u2019マスプレデター');
    check('ジャックの技名は前のまま', j.normal === 'カボチャ張り手' && j.allout === 'おばけパレード');
    check('クリスマスのボスを作るときにサンタの技名を写す', /const sn = RAID_XMAS_SKILL_NAMES;[\s\S]{0,300}normal: sn\.normal, special: sn\.special,[\s\S]{0,200}sweep: sn\.sweep, rush: sn\.rush, pierce: sn\.pierce, roar: sn\.roar, allout: sn\.allout/.test(read(P + '35-raid-jack.jsx')));
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nOK: クリスマスのレイドの定義と回数・与ダメージの口');
  process.exit(failed ? 1 : 0);
})();
