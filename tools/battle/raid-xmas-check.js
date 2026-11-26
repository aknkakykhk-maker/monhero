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
  vm.runInContext(`${src}\nthis.o={story:{XMAS_STORY_CHAPTERS,XMAS_STORY_CAST,xmasStoryStatusOf,xmasStoryNormalize,xmasStoryCastAt,xmasStoryMarkSeen,xmasStoryMarkCleared},RAID_XMAS_EVENT,RAID_XMAS_SOURCES,RAID_XMAS_A_TIERS,RAID_XMAS_B_TIERS,RAID_XMAS_STORY_IDS,raidXmasWindowAt,raidXmasUseTry,raidXmasAddDamage,raidXmasLoadState,raidXmasSetDebug,raidXmasStoryCandidates,raidJackNormalizePending,sbSendRaidJackHit,RAID_XMAS_SKILL_NAMES,RAID_JACK_SKILL_NAMES,xmasBattleBonusRateAt};`, ctx);
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
    check('サンタの技名(正拳・闇 / 瞬黒撃 / 超宝屁 / 超飛び蹴り / 超暗けい / 怪しこの夜 / X’マスプレデター)',
      x.normal === '正拳・闇' && x.special === '瞬黒撃' && x.sweep === '超宝屁' && x.rush === '超飛び蹴り'
      && x.pierce === '超暗けい' && x.roar === '怪しこの夜' && x.allout === 'X\u2019マスプレデター');
    check('ジャックの技名は前のまま', j.normal === 'カボチャ張り手' && j.allout === 'おばけパレード');
    check('クリスマスのボスを作るときにサンタの技名を写す', /const sn = RAID_XMAS_SKILL_NAMES;[\s\S]{0,300}normal: sn\.normal, special: sn\.special,[\s\S]{0,200}sweep: sn\.sweep, rush: sn\.rush, pierce: sn\.pierce, roar: sn\.roar, allout: sn\.allout/.test(read(P + '35-raid-jack.jsx')));
  }
  // ---- 期間中のモンヒロバトルのごほうび1.5倍(r1119-172 期間中のボーナス③) ----
  {
    const t = make('2026-12-01T12:00:00+09:00');
    const r = t.o.xmasBattleBonusRateAt;
    check('ごほうび1.5倍: 開始前は1倍・期間中は1.5倍・終わったら1倍',
      r(Date.parse('2026-11-30T09:59:59+09:00')) === 1 && r(Date.parse('2026-11-30T10:00:00+09:00')) === 1.5
      && r(Date.parse('2026-12-31T03:59:59+09:00')) === 1.5 && r(Date.parse('2026-12-31T04:00:00+09:00')) === 1);
    const app = read(P + '60-app.jsx');
    const body = (name, len = 6000) => { const i = app.indexOf(`const ${name} = `); return i < 0 ? '' : app.slice(i, i + len); };
    const award = body('awardRunRewards', 3000);
    check('ごほうび1.5倍: ランの終わりで経験値とダイヤの倍率に掛ける(スコアには掛けない)',
      /const xmasBonus = xmasBattleBonusRateAt\(Date\.now\(\)\);\s*const goldMult = goldMultBase \* xmasBonus;\s*const xpMult = xpMultBase \* xmasBonus;/.test(award) && !/scoreMult \* xmasBonus|scoreMult\*xmasBonus/.test(award));
    check('ごほうび1.5倍: 倍率の元(runRewardMultipliers)には掛けない(モンヒロビートの周回の報酬に重ならない)', !/xmasBattleBonus/.test(body('runRewardMultipliers', 900)));
    check('ごほうび1.5倍: プロのランぶんの周回数に掛ける', /proQuickLoopsFor\([^;]*\* xmasBattleBonusRateAt\(Date\.now\(\)\)\)/.test(body('awardProRunQuickLoops', 1500)));
    check('ごほうび1.5倍: 結果のまとめの札に🎄の一言', /data-xmas-battle-bonus/.test(read(P + '27-result-widgets.jsx')) && /xmasBonus: xmasBonus > 1 \? xmasBonus : null/.test(award + body('awardRunRewards', 12000)));
  }
  // ---- ひとりで進める物語(イベントページの「物語」タブ・台帳 r1126-006) ----
  {
    const t = make('2026-12-01T12:00:00+09:00');
    const S = t.o.story;
    const C = S.XMAS_STORY_CHAPTERS;
    check('物語: 序章+25話・序章は 11/28・第1話は開始と同時・第2話は 12/1 4:00・第25話は 12/24 4:00',
      C.length === 26 && C[0].id === 'xs00' && C[0].openAt === '2026-11-28T10:00:00+09:00' && C[1].openAt === '2026-11-30T10:00:00+09:00' && C[2].openAt === '2026-12-01T04:00:00+09:00' && C[25].openAt === '2026-12-24T04:00:00+09:00');
    const now = Date.parse('2026-12-01T12:00:00+09:00');
    const st = (i, p, all) => S.xmasStoryStatusOf(C[i], p, now, all);
    check('物語: 日時の前は locked・前の話がまだなら waiting・開いたら new(序章を読むと第1話)',
      st(3, {}) === 'locked' && st(1, {}) === 'waiting' && st(0, {}) === 'new' && st(1, { cleared: ['xs00'] }) === 'new'
      && st(2, { cleared: ['xs00'] }) === 'waiting' && st(2, { cleared: ['xs00', 'xs01'] }) === 'new' && st(0, { seen: ['xs00'] }) === 'open');
    check('物語: デバッグの強制表示は日時も順番も見ない', st(10, {}, true) === 'new');
    check('物語: 壊れた保存値は既定へ戻す', JSON.stringify(S.xmasStoryNormalize({ cleared: 'x', seen: [1, 'xs01', 'xs01', 'zz'] })) === '{"v":1,"cleared":[],"seen":["xs01"],"rewardClaimed":false}');
    await S.xmasStoryMarkSeen('xs01');
    const r = await S.xmasStoryMarkCleared('xs01');
    check('物語: 読んだ印は新しいキー mh_xmas_story_v1 だけに書く',
      r.ok && Object.keys(t.store).join(',') === 'mh_xmas_story_v1' && t.store.mh_xmas_story_v1.cleared[0] === 'xs01');
    check('物語: 知らない話の印は書かない', (await S.xmasStoryMarkCleared('nope')).ok === false && t.store.mh_xmas_story_v1.cleared.length === 1);
    const a6 = S.xmasStoryCastAt(6), a7 = S.xmasStoryCastAt(7), a16 = S.xmasStoryCastAt(16), a25 = S.xmasStoryCastAt(25);
    check('並び: はじめてだれかがいなくなった第7話から出す(第6話までは出さない)', !a6.shown && a7.shown && a7.newly.join() === 'momosuke');
    check('並び: 帯は10人みんなを数える(第7話 9人/1つ・第16話 6人/3つ・第25話 10人/0つ)',
      a7.left === 9 && a7.emptyBoxes === 1 && a16.left === 6 && a16.emptyBoxes === 3 && a25.left === 10 && a25.emptyBoxes === 0);
    check('並び: 10人', S.XMAS_STORY_CAST.length === 10);
  }
  {
    // レイドのお話(raid_xmas_story_*・r1126-026)が、データにあり・開始の印で出し分けられ・HOME の見回りで流れるようにつながっているか
    const app = read('monster-hero/src/parts/60-app.jsx');
    const core = read('monster-hero/src/parts/10-core.jsx');
    const data = read('monster-hero/data/assistants.js');
    const ids = ['raid_xmas_story_1b', 'raid_xmas_story_2', 'raid_xmas_story_3', 'raid_xmas_story_4', 'raid_xmas_story_5', 'raid_xmas_story_6', 'raid_xmas_ending_cleared', 'raid_xmas_ending_notcleared'];
    check('お話: 8本とも EVENT_REPLAYS にあり、公開の印は raidXmas', ids.every((id) => new RegExp(`\\{ id: '${id}'[^\\n]*releaseFlag: 'raidXmas'`).test(data)));
    check('お話: 回想の出し分けの表に raidXmas がある(開始より前は回想にも出ない)', /get raidXmas\(\) \{ return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS\.raidXmas === true; \}/.test(core));
    check('お話: 見た印を残すお話の一覧に入っている', app.includes('...RAID_JACK_STORY_IDS, ...RAID_XMAS_STORY_IDS,'));
    check('お話: 見回りは開始の印のあとだけ・段階の合計から候補を出す',
      app.includes('if (RELEASE_FLAGS.raidXmas === true) {') && app.includes('raidXmasStoryCandidates(xmasTotals, Date.now())'));
    check('お話: 待ち行列の2つの並び(開催中のビートのイベントがある/ない)の両方に入っている',
      (app.match(/else if \(raidXmasStoryId\) setRhythmEventStoryPending\(prev => prev \|\| raidXmasStoryId\);/g) || []).length === 2);
    check('お話: 回想の見た印の表に入っている', app.includes('RAID_XMAS_STORY_IDS.includes(ev.id)).map(ev => [ev.unlockedKey'));
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nOK: クリスマスのレイドの定義と回数・与ダメージの口');
  process.exit(failed ? 1 : 0);
})();
