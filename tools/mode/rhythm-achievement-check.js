#!/usr/bin/env node
// モンヒロビートの実績の仕組み(フルコンボ・オールエクセレント・オールマーベラス)を、実装をそのまま取り出して動かして確かめる。
//
//   node tools/mode/rhythm-achievement-check.js
//
// 仕様の正本: docs/spec/RHYTHM_ACHIEVEMENTS.md(2026-10-05・ユーザー指示「実績の仕組みを作って。報酬は決まっていないので仕組みだけ」)
//
// 見るもの:
//   ・称号の数え方(AM ⊃ AE ⊃ FC)・実績のid・台帳の整え方(壊れた保存値でも落ちない)
//   ・BEST記録との同期(足すだけで消さない・初回は「すでに取っていたぶん」を時刻不明で取り込む・初めて遊んだ人の最初の実績は「いま取れた」)
//   ・報酬(ルールの検証・受け取り待ちの絞り込み・一度だけ渡す・渡せなかったら待つ・1件ずつ書く・順番待ち)
//   ・報酬ルールが空のあいだは、読み書きを一切しない
//   ・画面側の配線(BESTを保存した直後と、モンヒロビートを開いたとき)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const settings = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const storage = read('monster-hero/src/parts/25-storage.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const pure = settings.match(/\/\/ <rhythm-achievement-ledger>[\s\S]*?\/\/ <\/rhythm-achievement-ledger>/)?.[0];
const io = storage.match(/\/\/ <rhythm-achievement-io>[\s\S]*?\/\/ <\/rhythm-achievement-io>/)?.[0];
check('実績の実装(計算・保存)を取り出せる', !!pure && !!io);
if (!pure || !io) process.exit(1);

// ── 実装を、偽の保存と偽の曲一覧つきで動かす ──
const makeWorld = () => {
  const store = new Map();
  const calls = { get: 0, set: 0 };
  const world = {
    storeGet: async (key, fallback) => { calls.get++; if (world.failGet) throw new Error('read failed'); return store.has(key) ? JSON.parse(store.get(key)) : fallback; },
    storeSet: async (key, value) => { calls.set++; await Promise.resolve(); store.set(key, JSON.stringify(value)); return true; },
    RHYTHM_SONGS: [
      { songId: 'song_a', difficulties: { EASY: { notes: [1] }, MASTER: { notes: [1] } } },
      { songId: 'song_b', difficulties: { EASY: { notes: [1] }, HARD: { notes: [1] } } },
      { songId: 'hidden', difficulties: { EASY: { notes: [1] } } },
    ],
    RHYTHM_DIFFICULTIES: ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'].map((id) => ({ id })),
    rhythmDemoSongs: (songs) => songs.filter((song) => song.songId !== 'hidden'),
    rhythmDemoDifficulties: (song, list) => list.filter((item) => song.difficulties[item.id]),
    console,
  };
  vm.createContext(world);
  vm.runInContext(`${pure}\n${io}\nthis.X={RHYTHM_ACHIEVEMENT_KINDS,RHYTHM_ACHIEVEMENT_KIND_IDS,RHYTHM_ACHIEVEMENT_LEDGER_KEY,RHYTHM_ACHIEVEMENT_LEDGER_MAX,rhythmAchievementId,parseRhythmAchievementId,rhythmAchievedKinds,emptyRhythmAchievementLedger,rhythmAchievementClaimKey,normalizeRhythmAchievementLedger,syncRhythmAchievementLedger,RHYTHM_ACHIEVEMENT_REWARDS,normalizeRhythmAchievementRules,rhythmAchievementPending,RHYTHM_ACHIEVEMENT_GRANTERS,rhythmAchievementEligible,readRhythmAchievementLedger,syncRhythmAchievements,claimRhythmAchievementRewards,recordRhythmAchievements};`, world);
  return { X: world.X, store, calls, world };
};
const best = (flags) => ({ played: true, clear: true, fullCombo: false, allExcellent: false, allMarvelous: false, ...flags });

// ── ① 称号と実績のid ──
{
  const { X } = makeWorld();
  check('称号は FC・AE・AM の3つで、上の称号ほど rank が大きい',
    X.RHYTHM_ACHIEVEMENT_KINDS.map((k) => `${k.short}:${k.rank}`).join() === 'FC:1,AE:2,AM:3'
    && X.RHYTHM_ACHIEVEMENT_KIND_IDS.join() === 'fullCombo,allExcellent,allMarvelous');
  check('称号の名前は、画面に出す正式な言い方(フルコンボ・オールエクセレント・オールマーベラス)',
    X.RHYTHM_ACHIEVEMENT_KINDS.map((k) => k.name).join() === 'フルコンボ,オールエクセレント,オールマーベラス');
  check('何も取っていなければ称号なし', X.rhythmAchievedKinds(best({})).length === 0 && X.rhythmAchievedKinds(null).length === 0 && X.rhythmAchievedKinds(undefined).length === 0);
  check('FC だけなら FC だけ', X.rhythmAchievedKinds(best({ fullCombo: true })).join() === 'fullCombo');
  check('AE を取っていれば、FC の印が無くても FC も取ったことになる', X.rhythmAchievedKinds(best({ allExcellent: true })).join() === 'fullCombo,allExcellent');
  check('AM を取っていれば、FC・AE も取ったことになる(AM ⊃ AE ⊃ FC)', X.rhythmAchievedKinds(best({ allMarvelous: true })).join() === 'fullCombo,allExcellent,allMarvelous');
  check('真偽値でない印(文字列の "true" など)は取れたと見ない', X.rhythmAchievedKinds({ fullCombo: 'true', allExcellent: 1, allMarvelous: 'yes' }).length === 0);
  const id = X.rhythmAchievementId('song_a', 'EXPERT', 'fullCombo');
  check('実績のidは 曲:難易度:称号 で、元に戻せる', id === 'song_a:EXPERT:fullCombo' && JSON.stringify(X.parseRhythmAchievementId(id)) === '{"songId":"song_a","difficultyId":"EXPERT","kind":"fullCombo"}');
  check('壊れたidは読まない', ['', 'a', 'a:b', 'a:b:c', ':EASY:fullCombo', 'a::fullCombo', null, undefined, 5, `${'x'.repeat(81)}:EASY:fullCombo`].every((v) => X.parseRhythmAchievementId(v) === null));
}

// ── ② 台帳の整え方(壊れた保存値でも落ちない) ──
{
  const { X } = makeWorld();
  const empty = JSON.stringify(X.emptyRhythmAchievementLedger());
  check('保存が無い・壊れている・配列・数字のときは、空の台帳になる',
    [undefined, null, 'x', 5, [], [1, 2], true].every((v) => JSON.stringify(X.normalizeRhythmAchievementLedger(v)) === empty));
  const mixed = X.normalizeRhythmAchievementLedger({
    items: { 'song_a:EASY:fullCombo': { at: 1000 }, 'song_a:EASY:bogus': { at: 5 }, 'broken': { at: 5 }, 'song_b:HARD:allMarvelous': 77, 'song_c:EASY:allExcellent': { at: -4 }, 'song_d:EASY:allExcellent': { at: 'x' } },
    claimed: { 'song_a:EASY:fullCombo#rule1': 2000, 'song_a:EASY:fullCombo#': 5, 'nonsense': 5, 'song_a:EASY:bogus#r': 5, 'song_a:EASY:fullCombo#rule2': 'x', 'song_a:EASY:fullCombo#rule3': -1 },
  });
  check('読める項目だけ残す(壊れたid・知らない称号は捨てる)',
    Object.keys(mixed.items).sort().join() === 'song_a:EASY:fullCombo,song_b:HARD:allMarvelous,song_c:EASY:allExcellent,song_d:EASY:allExcellent', Object.keys(mixed.items).join());
  check('達成時刻が読めない・負の値は 0(時刻不明)にする。数字だけの古い形も読める',
    mixed.items['song_a:EASY:fullCombo'].at === 1000 && mixed.items['song_c:EASY:allExcellent'].at === 0 && mixed.items['song_d:EASY:allExcellent'].at === 0 && mixed.items['song_b:HARD:allMarvelous'].at === 77);
  check('受け取り済みの印は、時刻が読めなくても消さない(二重に渡さないため)',
    Object.keys(mixed.claimed).sort().join() === 'song_a:EASY:fullCombo#rule1,song_a:EASY:fullCombo#rule2,song_a:EASY:fullCombo#rule3'
    && mixed.claimed['song_a:EASY:fullCombo#rule1'] === 2000 && mixed.claimed['song_a:EASY:fullCombo#rule2'] === 1 && mixed.claimed['song_a:EASY:fullCombo#rule3'] === 1);
  const again = X.normalizeRhythmAchievementLedger(mixed);
  check('整えたものをもう一度整えても変わらない', JSON.stringify(again) === JSON.stringify(mixed));
  const many = { items: {} };
  for (let i = 0; i < X.RHYTHM_ACHIEVEMENT_LEDGER_MAX + 50; i++) many.items[`song_${i}:EASY:fullCombo`] = { at: 1 };
  check('件数に上限がある(保存値がふくらみ続けない)', Object.keys(X.normalizeRhythmAchievementLedger(many).items).length === X.RHYTHM_ACHIEVEMENT_LEDGER_MAX);
  check('保存キーは新しく分けてある(BESTには何も足さない)', X.RHYTHM_ACHIEVEMENT_LEDGER_KEY === 'mh_rhythm_achievements_v1' && X.RHYTHM_ACHIEVEMENT_LEDGER_KEY !== 'mh_rhythm_best_v1');
}

// ── ③ BEST記録との同期 ──
{
  const { X } = makeWorld();
  const records = { song_a: { EASY: best({ fullCombo: true }), MASTER: best({ allMarvelous: true }), HARD: best({}) }, song_b: { EASY: best({ allExcellent: true }) } };
  const first = X.syncRhythmAchievementLedger(null, records, { now: 0 });
  check('BESTの印から、取れた称号ぶんの実績を作る(上の称号は下の称号も含む)',
    first.added.sort().join() === ['song_a:EASY:fullCombo', 'song_a:MASTER:allExcellent', 'song_a:MASTER:allMarvelous', 'song_a:MASTER:fullCombo', 'song_b:EASY:allExcellent', 'song_b:EASY:fullCombo'].sort().join(), first.added.join());
  check('初回の取り込みは、時刻不明(0)で入る', Object.values(first.ledger.items).every((item) => item.at === 0));
  const second = X.syncRhythmAchievementLedger(first.ledger, records, { now: 5000 });
  check('もう一度同期しても何も増えず、台帳は変わらない(何度走らせても同じ)', second.added.length === 0 && JSON.stringify(second.ledger) === JSON.stringify(first.ledger));
  const next = X.syncRhythmAchievementLedger(first.ledger, { ...records, song_a: { ...records.song_a, EASY: best({ allMarvelous: true }) } }, { now: 9000 });
  check('新しく取れた称号だけが足され、時刻が付く(もとからあるものの時刻は動かない)',
    next.added.sort().join() === 'song_a:EASY:allExcellent,song_a:EASY:allMarvelous'
    && next.ledger.items['song_a:EASY:allMarvelous'].at === 9000 && next.ledger.items['song_a:EASY:fullCombo'].at === 0);
  const shrunk = X.syncRhythmAchievementLedger(next.ledger, {}, { now: 9500 });
  check('BESTが空でも(読み込み前など)台帳は減らない', Object.keys(shrunk.ledger.items).length === Object.keys(next.ledger.items).length && shrunk.added.length === 0);
  check('受け取り済みの印は同期で消えない',
    X.syncRhythmAchievementLedger({ items: {}, claimed: { 'song_a:EASY:fullCombo#r1': 123 } }, records, { now: 1 }).ledger.claimed['song_a:EASY:fullCombo#r1'] === 123);
  check('壊れたBEST(配列・数字・曲ごとの値が壊れている)でも落ちない',
    [undefined, null, 5, 'x', [], { song_a: null, song_b: 5, song_c: [] }].every((v) => { try { return X.syncRhythmAchievementLedger(null, v, { now: 1 }).added.length === 0; } catch { return false; } }));
}

// ── ④ 報酬ルールの検証 ──
{
  const { X } = makeWorld();
  const ok = { id: 'fc-all', kinds: ['fullCombo'], difficulties: null, songs: null, reward: { type: 'beatP', amount: 100 } };
  const rules = X.normalizeRhythmAchievementRules([
    ok, { ...ok }, { ...ok, id: 'bad id!' }, { ...ok, id: '' }, { ...ok, id: 'no-reward', reward: null }, { ...ok, id: 'no-type', reward: { amount: 1 } },
    { ...ok, id: 'unknown-kind', kinds: ['nope'] }, { ...ok, id: 'long-type', reward: { type: 'x'.repeat(31) } }, null, 5,
    { id: 'minimal', reward: { type: 'item' } }, { ...ok, id: 'with-since', since: 7000.9 },
  ]);
  check('ルールは、名前の綴り・報酬の形・称号の名前が正しいものだけ残る(同じ名前は先のものだけ)',
    rules.map((r) => r.id).join() === 'fc-all,minimal,with-since', rules.map((r) => r.id).join());
  check('絞り込みを書かなかったルールは「すべて」に効く', rules[1].kinds === null && rules[1].difficulties === null && rules[1].songs === null && rules[1].since === 0);
  check('時刻の下限は整数にそろえる', rules[2].since === 7000);
  check('配列でない入力は空のルール', [undefined, null, 'x', 5, {}].every((v) => X.normalizeRhythmAchievementRules(v).length === 0));
  check('出荷しているルールは、すべて正しい形で、渡す処理も用意されている(ルールを足すときの取りこぼし防止)',
    X.normalizeRhythmAchievementRules(X.RHYTHM_ACHIEVEMENT_REWARDS).length === X.RHYTHM_ACHIEVEMENT_REWARDS.length
    && X.RHYTHM_ACHIEVEMENT_REWARDS.every((rule) => typeof X.RHYTHM_ACHIEVEMENT_GRANTERS[rule.reward?.type] === 'function'),
    `ルール${X.RHYTHM_ACHIEVEMENT_REWARDS.length}件`);
}

// ── ⑤ 受け取り待ちの絞り込み ──
{
  const { X } = makeWorld();
  const ledger = {
    items: {
      'song_a:EASY:fullCombo': { at: 0 }, 'song_a:EASY:allExcellent': { at: 0 }, 'song_a:MASTER:fullCombo': { at: 5000 },
      'song_a:MASTER:allMarvelous': { at: 9000 }, 'song_b:HARD:fullCombo': { at: 9000 }, 'hidden:EASY:allMarvelous': { at: 9000 },
    },
    claimed: { 'song_a:MASTER:fullCombo#fc': 6000 },
  };
  const all = (eligible) => X.rhythmAchievementPending(ledger, [{ id: 'fc', kinds: ['fullCombo'], reward: { type: 'beatP', amount: 1 } }], eligible).map((p) => p.achievementId);
  check('ルールが空なら、受け取り待ちは無い', X.rhythmAchievementPending(ledger, [], X.rhythmAchievementEligible).length === 0);
  check('称号で絞る・受け取り済みは除く', all(null).join() === 'song_a:EASY:fullCombo,song_b:HARD:fullCombo', all(null).join());
  const elig = X.rhythmAchievementPending(ledger, [{ id: 'any', reward: { type: 'item' } }], X.rhythmAchievementEligible).map((p) => p.achievementId);
  check('公開していない曲・存在しない難易度の実績は、報酬の対象にしない',
    !elig.some((id) => id.startsWith('hidden:')) && elig.includes('song_a:MASTER:allMarvelous') && !elig.includes('song_b:EASY:fullCombo'), elig.join());
  const byDiff = X.rhythmAchievementPending(ledger, [{ id: 'm', difficulties: ['MASTER'], reward: { type: 'item' } }], null).map((p) => p.achievementId);
  check('難易度で絞る(別のルールで受け取り済みでも、このルールではまだ待つ)', byDiff.sort().join() === 'song_a:MASTER:allMarvelous,song_a:MASTER:fullCombo', byDiff.join());
  const bySong = X.rhythmAchievementPending(ledger, [{ id: 's', songs: ['song_b'], reward: { type: 'item' } }], null).map((p) => p.songId);
  check('曲で絞る', bySong.length === 1 && bySong[0] === 'song_b');
  const since = X.rhythmAchievementPending(ledger, [{ id: 'sn', since: 8000, reward: { type: 'item' } }], null).map((p) => p.achievementId);
  check('since を書いたルールは、それより後に取ったものだけ(時刻不明の 0 は対象外)', since.sort().join() === 'hidden:EASY:allMarvelous,song_a:MASTER:allMarvelous,song_b:HARD:fullCombo', since.join());
  const two = X.rhythmAchievementPending({ items: { 'song_a:EASY:fullCombo': { at: 1 } }, claimed: { 'song_a:EASY:fullCombo#r1': 5 } },
    [{ id: 'r1', reward: { type: 'a' } }, { id: 'r2', reward: { type: 'b' } }], null);
  check('同じ実績へ別のルールを足したときは、受け取り済みでないほうだけが待つ', two.length === 1 && two[0].ruleId === 'r2' && two[0].key === 'song_a:EASY:fullCombo#r2');
  const order1 = JSON.stringify(X.rhythmAchievementPending(ledger, [{ id: 'z', reward: { type: 'a' } }, { id: 'y', reward: { type: 'b' } }], null).map((p) => p.key));
  const order2 = JSON.stringify(X.rhythmAchievementPending({ items: Object.fromEntries(Object.entries(ledger.items).reverse()), claimed: ledger.claimed }, [{ id: 'z', reward: { type: 'a' } }, { id: 'y', reward: { type: 'b' } }], null).map((p) => p.key));
  check('並びはいつも同じ(保存値の並びに左右されない)', order1 === order2);
}

// ── ⑥ 保存まで通す(偽の保存) ──
(async () => {
  {
    const { X, store } = makeWorld();
    const prev = { song_a: { EASY: best({}) } };
    const next = { song_a: { EASY: best({ fullCombo: true }) } };
    const r = await X.syncRhythmAchievements(next, { initialRecords: prev, now: 4242 });
    check('初めて遊んだ人でも、そのプレイで取れた実績は「いま取れた」(時刻が付く)',
      r.added.join() === 'song_a:EASY:fullCombo' && r.ledger.items['song_a:EASY:fullCombo'].at === 4242 && JSON.parse(store.get('mh_rhythm_achievements_v1')).items['song_a:EASY:fullCombo'].at === 4242);
  }
  {
    const { X, store } = makeWorld();
    const records = { song_a: { EASY: best({ allMarvelous: true }) } };
    const r = await X.syncRhythmAchievements(records, { now: 9999 });
    check('台帳が無いときの読み込み同期は、すでに取れていたぶんを時刻不明(0)で取り込む(「いま取れた」には数えない)',
      r.added.length === 0 && Object.keys(r.ledger.items).length === 3 && Object.values(r.ledger.items).every((i) => i.at === 0) && store.has('mh_rhythm_achievements_v1'));
    const again = await X.syncRhythmAchievements({ ...records, song_b: { EASY: best({ fullCombo: true }) } }, { now: 7777 });
    check('台帳ができたあとの同期は、新しく取れたものに時刻を付ける', again.added.join() === 'song_b:EASY:fullCombo' && again.ledger.items['song_b:EASY:fullCombo'].at === 7777);
  }
  {
    const { X, store, calls } = makeWorld();
    const res = await X.claimRhythmAchievementRewards({ now: 1 });
    check('報酬ルールが空のあいだは、受け取りの処理が何も読まず何も書かない', res.granted.length === 0 && res.pending.length === 0 && calls.get === 0 && calls.set === 0 && store.size === 0);
  }
  {
    // 渡す・渡せない・落ちる
    const { X, store, calls } = makeWorld();
    await X.syncRhythmAchievements({ song_a: { EASY: best({ allExcellent: true }), MASTER: best({ fullCombo: true }) } }, { now: 0 });
    const given = [];
    const granters = { beatP: async (reward, info) => { given.push(`${info.achievementId}=${reward.amount}`); return true; }, flaky: async () => false, boom: async () => { throw new Error('boom'); } };
    const rules = [{ id: 'fc', kinds: ['fullCombo'], reward: { type: 'beatP', amount: 50 } }, { id: 'ae', kinds: ['allExcellent'], reward: { type: 'beatP', amount: 200 } }];
    const r1 = await X.claimRhythmAchievementRewards({ rules, granters, now: 3000 });
    check('取れていた実績の報酬を、遡って渡す(渡すのは1回ずつ・取れていないものは渡さない)',
      given.sort().join() === 'song_a:EASY:allExcellent=200,song_a:EASY:fullCombo=50,song_a:MASTER:fullCombo=50' && r1.granted.length === 3 && r1.pending.length === 0, given.join());
    const written = JSON.parse(store.get('mh_rhythm_achievements_v1'));
    check('渡せたものは「受け取り済み」として台帳に残る', Object.keys(written.claimed).length === 3 && written.claimed['song_a:EASY:fullCombo#fc'] === 3000);
    const r2 = await X.claimRhythmAchievementRewards({ rules, granters, now: 4000 });
    check('もう一度呼んでも、二重には渡さない', r2.granted.length === 0 && given.length === 3);
    const r3 = await X.claimRhythmAchievementRewards({ rules: [...rules, { id: 'extra', kinds: ['fullCombo'], reward: { type: 'beatP', amount: 7 } }], granters, now: 5000 });
    check('あとからルールを足すと、そのルールのぶんだけ渡す(前のルールは渡さない)', r3.granted.length === 2 && given.filter((g) => g.endsWith('=7')).length === 2 && given.length === 5, given.join());
    // 渡せないとき
    const w = makeWorld();
    await w.X.syncRhythmAchievements({ song_a: { EASY: best({ fullCombo: true }) } }, { now: 0 });
    const noGranter = await w.X.claimRhythmAchievementRewards({ rules: [{ id: 'x', reward: { type: 'unknownType' } }], granters, now: 1 });
    const falsy = await w.X.claimRhythmAchievementRewards({ rules: [{ id: 'y', reward: { type: 'flaky' } }], granters, now: 1 });
    const thrown = await w.X.claimRhythmAchievementRewards({ rules: [{ id: 'z', reward: { type: 'boom' } }], granters, now: 1 });
    check('渡す処理が無い種類・false を返す・例外を投げるときは、渡さず待たせる(受け取り済みの印は付けない)',
      noGranter.granted.length === 0 && noGranter.pending.length === 1 && falsy.pending.length === 1 && thrown.pending.length === 1
      && Object.keys(JSON.parse(w.store.get('mh_rhythm_achievements_v1')).claimed).length === 0);
    // 途中で落ちる
    const c = makeWorld();
    await c.X.syncRhythmAchievements({ song_a: { EASY: best({ allMarvelous: true }) } }, { now: 0 });
    let n = 0;
    const partial = { once: async () => { n++; if (n === 2) throw new Error('crash'); return true; } };
    const rr = await c.X.claimRhythmAchievementRewards({ rules: [{ id: 'p', reward: { type: 'once' } }], granters: partial, now: 1 });
    check('1件ずつ書くので、途中で失敗しても渡し済みのぶんは残る(次は残りだけ)',
      rr.granted.length === 2 && rr.pending.length === 1 && Object.keys(JSON.parse(c.store.get('mh_rhythm_achievements_v1')).claimed).length === 2);
    const left = await c.X.claimRhythmAchievementRewards({ rules: [{ id: 'p', reward: { type: 'once' } }], granters: partial, now: 2 });
    check('失敗して待っていたぶんが、次の呼び出しで渡る', left.granted.length === 1 && left.pending.length === 0);
    // 公開していない曲には渡さない
    const h = makeWorld();
    await h.X.syncRhythmAchievements({ hidden: { EASY: best({ fullCombo: true }) }, song_a: { EASY: best({ fullCombo: true }) } }, { now: 0 });
    const got = [];
    await h.X.claimRhythmAchievementRewards({ rules: [{ id: 'f', reward: { type: 't' } }], granters: { t: async (_r, i) => { got.push(i.songId); return true; } }, now: 1 });
    check('公開していない曲の実績には渡さない', got.join() === 'song_a', got.join());
    void calls;
  }
  {
    // 同時に呼ばれても取りこぼさない
    const { X, store } = makeWorld();
    await X.syncRhythmAchievements({}, { now: 0 });
    await Promise.all([
      X.syncRhythmAchievements({ song_a: { EASY: best({ fullCombo: true }) } }, { initialRecords: {}, now: 10 }),
      X.syncRhythmAchievements({ song_b: { EASY: best({ fullCombo: true }) } }, { initialRecords: {}, now: 20 }),
      X.syncRhythmAchievements({ song_a: { MASTER: best({ allMarvelous: true }) } }, { initialRecords: {}, now: 30 }),
    ]);
    const items = Object.keys(JSON.parse(store.get('mh_rhythm_achievements_v1')).items).sort();
    check('同時に3回呼ばれても、どれも取りこぼさない(順番待ち)', items.join() === 'song_a:EASY:fullCombo,song_a:MASTER:allExcellent,song_a:MASTER:allMarvelous,song_a:MASTER:fullCombo,song_b:EASY:fullCombo', items.join());
  }
  {
    const { X, world } = makeWorld();
    world.failGet = true;
    const r = await X.recordRhythmAchievements({ song_a: { EASY: best({ fullCombo: true }) } }, { now: 1 });
    check('保存を読めなくても、画面側の入口は例外を投げない(BEST記録の保存や遊びを止めない)', r && r.added.length === 0 && r.ledger === null);
    world.failGet = false;
    const ok = await X.recordRhythmAchievements({ song_a: { EASY: best({ fullCombo: true }) } }, { initialRecords: {}, now: 5 });
    check('読めるようになれば、そのまま記録される', ok.added.join() === 'song_a:EASY:fullCombo');
  }
  {
    const { X, store } = makeWorld();
    store.set('mh_rhythm_achievements_v1', JSON.stringify('壊れた保存値'));
    const r = await X.syncRhythmAchievements({ song_a: { EASY: best({ fullCombo: true }) } }, { initialRecords: {}, now: 8 });
    check('保存値が壊れていても、空の台帳として読み直して続けられる', r.added.join() === 'song_a:EASY:fullCombo');
  }

  // ── ⑦ 画面側の配線(文字列) ──
  check('BESTを保存した直後に、保存前のBESTを添えて実績を記録する',
    /const records=await saveRhythmBestRecord\([^\n]*?setRhythmBestRecords\(records\);void recordRhythmAchievements\(records,\{initialRecords:rhythmBestRecords\}\);/.test(app));
  check('アシスト・練習・タイミング合わせでは実績を記録しない(それらはBESTの保存より前に抜ける)',
    app.indexOf("if(result?.assist===true)return;") > 0 && app.indexOf("if(result?.assist===true)return;") < app.indexOf('void recordRhythmAchievements(records,{initialRecords:rhythmBestRecords})')
    && app.indexOf("if(rhythmPlay.from==='tutorial')return;") < app.indexOf('void recordRhythmAchievements(records,{initialRecords:rhythmBestRecords})'));
  check('モンヒロビートを開くとき(通常・デバッグ)に、BESTから台帳へそろえる',
    (app.match(/setRhythmBestRecords\(records\); setRhythmMonsterSlotIds\(monsterSlots\);\n\s+void recordRhythmAchievements\(records\);/g) || []).length === 2);
  check('実績の保存は、BESTのキーを書き換えない(読むだけ)', !/storeSet\(RHYTHM_BEST_RECORDS_KEY/.test(io));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
