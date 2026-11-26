// レイドのモンヒロビート挑戦の部品(39-raid-rhythm.jsx)を、偽のつなぎ口で動かして確かめる(通信はしない)。
// 2026-11-25・台帳 r1119-172(クリスマスのレイドもジャックと同じ流れで動かすため、イベントごとのつなぎ口に分けた)
//
// 見るもの
//   ① 回数: つなぎ口が 'none' / 'saveFailed' を返したら始めない。'ok' なら run を作り、ライフを裏で取りに行く
//   ② 送信: 本番のイベントはつなぎ口の submit へ、段階は tierIndex+1・source は 'rhythm'。デバッグの id は別の口で送るだけ
//   ③ 倒したか: 残りのライフ以上で倒した扱い。最後の段階を倒したあとの無限の相手は倒した扱いにしない・名前が変わる
//   ④ ダメージ0(アシストなど)は送らない。途中でやめたときの結果はダメージ0
//   ⑤ ジャックのつなぎ口: 戻る画面・絵文字・段階の数・知らない鍵はジャックへ倒れる
//   ⑦ クリスマスのつなぎ口(BUILD.md の形): raidXmasUseTry の hitId・eventId をそのまま使い、raidXmasAddDamage に source 'rhythm' で1度だけ渡す
//   ⑥ 保存データ(CLAUDE.md ⑦): この部品は保存キーを持たず、端末へ書かない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const src = read('monster-hero/src/parts/39-raid-rhythm.jsx');
const sent = [];
const logs = [];
const ctx = {
  console, Object, Number, Math, Array, JSON, String, Boolean, Date, Promise, Error,
  setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)),
  RELEASE_FLAGS: { battleLog: true },
  ensureBreederId: async () => 'breeder-aaaa1111',
  raidJackMakeHitId: () => `hit${sent.length}${Math.random().toString(36).slice(2, 6)}`,
  raidJackRhythmDamageOf: (result) => Math.max(0, Math.floor(Number(result && result.damage) || 0)),
  sbFetchRaidJackTierTotals: async (eventId) => { ctx.__fetched = eventId; return { a: { 1: { total: 200 } } }; },
  sbSendRaidJackHit: async (hit, breederId, eventId) => { sent.push({ via: 'debug', hit, eventId }); return 'sent'; },
  sbSendRaidBattleLog: async (row) => { logs.push(row); },
  buildRaidBattleLogRow: (x) => x,
  // ジャックのつなぎ口が読むもの(⑤で形だけ見る)
  raidJackSafeEventId: (id) => id, RAID_JACK_EVENT: { id: 'raid_jack_2026_halloween' }, RAID_JACK_A_TIERS: [1, 2, 3, 4, 5],
  raidJackTierAt: (kind, i) => ({ id: `a${i + 1}`, name: `段階${i + 1}`, hp: 1000 }), RAID_JACK_PUMPKIN: { name: 'ぱんぷきん' },
};
vm.createContext(ctx);
vm.runInContext(`${src}\n;this.__rr = { raidRhythmBeginRun, raidRhythmFinish, raidRhythmFxOf, raidRhythmGiveUpResult, raidRhythmBannerOf, raidRhythmAdapter, raidRhythmClampTier, raidXmasRhythmAdapter };`, ctx);
const rr = ctx.__rr;

const fake = (over = {}) => {
  const submitted = [];
  const a = {
    key: 'xmas', eventId: 'raid_xmas_2026', liveEventId: 'raid_xmas_2026', screen: 'RAID_XMAS', icon: '🎄', bossImg: 'boss.png',
    tierCount: 5, tierAt: (i) => ({ id: `x${i + 1}`, name: `黒いサンタ${i + 1}`, hp: 1000 }), infiniteName: '無限の相手',
    totals: { 1: 300 }, infinite: false,
    fetchTotals: async () => a.totals, doneOf: (t, i) => (t && t[i + 1]) || 0, infiniteAt: () => a.infinite,
    useCount: async () => 'ok',
    submit: async (run, hit, tier, defeated) => { submitted.push({ hit, tier, defeated }); return { outcome: 'sent', opened: defeated }; },
    submitted, ...over,
  };
  return a;
};

(async () => {
  // ①
  for (const reason of ['none', 'saveFailed']) {
    const b = await rr.raidRhythmBeginRun(fake({ useCount: async () => reason }), 0);
    check(`回数: つなぎ口が ${reason} なら始めない`, b.run === null && b.reason === reason);
  }
  const a1 = fake();
  const b1 = await rr.raidRhythmBeginRun(a1, 9);
  check('回数: ok なら run を作る・段階は範囲に収める・送る先はつなぎ口の eventId', !!b1.run && b1.run.tierIndex === 4 && b1.run.eventId === 'raid_xmas_2026' && b1.run.adapter === a1);
  const life = await b1.run.lifePromise;
  check('ライフを裏で取る(段階5は合計なし → 満タン)', life && life.lifeBefore === 1000 && life.pumpkin === false);

  // ②③
  const a2 = fake();
  const run2 = (await rr.raidRhythmBeginRun(a2, 0)).run;
  const r2 = await rr.raidRhythmFinish(run2, { damage: 500, score: 900000 }, { displayName: '曲' }, { id: 'MASTER' });
  check('送信: 本番はつなぎ口の submit へ・段階は tierIndex+1・source は rhythm', a2.submitted.length === 1 && a2.submitted[0].hit.tier === 1 && a2.submitted[0].hit.source === 'rhythm' && a2.submitted[0].hit.kind === 'a');
  check('倒していない(残り700に500)・結果の中身', r2.defeated === false && r2.damage === 500 && r2.lifeBefore === 700 && r2.lifeLeft === 200 && r2.eventKey === 'xmas' && r2.reason === 'rhythm');
  check('バトルの1回ごとの記録にも source rhythm で送る', logs.some((x) => x.raid && x.raid.event === 'raid_xmas_2026' && x.raid.source === 'rhythm'));
  check('同じ run は二度送らない', (await rr.raidRhythmFinish(run2, { damage: 500 }, null, { id: 'MASTER' })) === null && a2.submitted.length === 1);

  const a3 = fake();
  const r3 = await rr.raidRhythmFinish((await rr.raidRhythmBeginRun(a3, 0)).run, { damage: 700 }, null, { id: 'MASTER' });
  check('残りちょうどで倒した扱い・開いた印', r3.defeated === true && r3.reason === 'defeated' && r3.opened === true && a3.submitted[0].defeated === true);

  const a4 = fake({ infinite: true });
  const r4 = await rr.raidRhythmFinish((await rr.raidRhythmBeginRun(a4, 4)).run, { damage: 99999 }, null, { id: 'MASTER' });
  check('無限の相手は倒した扱いにしない・名前が変わる', r4.defeated === false && r4.tierName === '無限の相手' && r4.pumpkin === true);

  const a5 = fake({ eventId: 'raid_xmas_debug' });
  const before = sent.length;
  await rr.raidRhythmFinish((await rr.raidRhythmBeginRun(a5, 0)).run, { damage: 100 }, null, { id: 'MASTER' });
  check('デバッグの id は submit を通らず、別の id で送るだけ', a5.submitted.length === 0 && sent.length === before + 1 && sent[sent.length - 1].eventId === 'raid_xmas_debug');

  // ④
  const a6 = fake();
  const r6 = await rr.raidRhythmFinish((await rr.raidRhythmBeginRun(a6, 0)).run, { damage: 0, assist: true }, null, { id: 'MASTER' });
  check('ダメージ0(アシスト)は送らない', a6.submitted.length === 0 && r6.damage === 0 && r6.outcome === 'sent');
  const g = rr.raidRhythmGiveUpResult({ eventId: 'raid_xmas_2026' }, fake(), 2);
  check('途中でやめた結果はダメージ0・段階の名前', g.reason === 'giveup' && g.damage === 0 && g.tierName === '黒いサンタ3');
  const fx = rr.raidRhythmFxOf({ adapter: fake(), tierIndex: 0, hitId: 'h' }, { lifeBefore: 700, pumpkin: false }, { damage: 10, score: 5 }, { id: 'MASTER' });
  check('演出の中身にボスの絵(bossImg)が入る', fx.bossImg === 'boss.png' && fx.damage === 10 && fx.lifeBefore === 700 && fx.max === 1000);
  const banner = rr.raidRhythmBannerOf(fake(), 1);
  check('曲えらびの帯はイベントの絵文字と段階の名前', banner.icon === '🎄' && banner.tierName === '黒いサンタ2');

  // ⑤
  const jack = rr.raidRhythmAdapter('jack', { eventId: 'raid_jack_2026_halloween' });
  check('ジャックのつなぎ口: 戻る画面 RAID_JACK・🎃・5段階・演出はジャックの絵(bossImg なし)', jack.key === 'jack' && jack.screen === 'RAID_JACK' && jack.icon === '🎃' && jack.tierCount === 5 && jack.bossImg === null && jack.infiniteName === 'ぱんぷきん');
  check('知らない鍵はジャックへ倒れる', rr.raidRhythmAdapter('unknown', {}).key === 'jack');

  // ⑦
  {
    const added = [];
    const opened = [];
    let tries = 0;
    const xctx = {
      event: { id: 'raid_xmas_2026' }, tiers: [{ id: 'a1', name: '(仮)段階1', hp: 1000 }, { id: 'a2', name: '(仮)段階2', hp: 2000 }],
      tierAt: (i) => [{ id: 'a1', name: '(仮)段階1', hp: 1000 }, { id: 'a2', name: '(仮)段階2', hp: 2000 }][i], bossImg: 'santa.png', screen: 'RAID_XMAS',
      damageOf: (result) => (result && result.damage) * 2,
      useTry: async () => { tries++; return { ok: true, hitId: 'rxhit001', eventId: 'raid_xmas_debug' }; },
      addDamage: async (input) => { added.push(input); return { way: 'rhythm', outcome: 'sent', damage: input.damage, defeated: false, opened: false, tierIndex: input.tierIndex, tierName: '(仮)段階1', lifeBefore: 800, lifeLeft: 600, lifeMax: 1000, afterBoss: false, detail: input.detail }; },
      openResult: (r) => opened.push(r),
    };
    const x = rr.raidRhythmAdapter('xmas', xctx);
    check('クリスマス: 鍵 xmas・🎄・戻る画面・ボスの絵', x.key === 'xmas' && x.icon === '🎄' && x.screen === 'RAID_XMAS' && x.bossImg === 'santa.png' && x.tierCount === 2);
    const b = await rr.raidRhythmBeginRun(x, 0);
    check('クリスマス: 回数は raidXmasUseTry で1回・hitId と eventId は向こうの値', tries === 1 && b.run && b.run.hitId === 'rxhit001' && b.run.eventId === 'raid_xmas_debug');
    await b.run.lifePromise;
    check('クリスマス: 演出のライフは同じ表をその eventId で引く', ctx.__fetched === 'raid_xmas_debug');
    const r = await rr.raidRhythmFinish(b.run, { damage: 100, score: 777 }, { displayName: '曲A' }, { id: 'EASY' });
    check('クリスマス: raidXmasAddDamage に source rhythm・kind a・式は raidXmasRhythmDamageOf・バトルの記録は score だけ', added.length === 1 && added[0].source === 'rhythm' && added[0].kind === 'a' && added[0].damage === 200 && added[0].hitId === 'rxhit001' && added[0].eventId === 'raid_xmas_debug' && added[0].detail.songName === '曲A' && added[0].detail.score === 777 && added[0].log && added[0].log.score === 777);
    check('クリスマス: 結果は向こうの中身(ライフ)に way rhythm を付けて返す・表へ直接送らない', r.way === 'rhythm' && r.lifeLeft === 600 && r.eventKey === 'xmas' && !sent.some((y) => y.hit.hitId === 'rxhit001'));
    check('クリスマス: 同じ run は二度足さない', (await rr.raidRhythmFinish(b.run, { damage: 1 }, null, { id: 'EASY' })) === null && added.length === 1);
    const g = rr.raidRhythmGiveUpResult(b.run, x, 1);
    check('クリスマス: 途中でやめた結果は BUILD.md §3 の形(damage 0・outcome sent・detail)', g.way === 'rhythm' && g.damage === 0 && g.outcome === 'sent' && g.tierIndex === 1 && !!g.detail);
    const xb = rr.raidRhythmAdapter('xmas', { ...xctx, bossDown: (t) => !!(t && t.down) });
    check('クリスマス: 最後の段階を倒したかは raidXmasBossDown で見る', xb.infiniteAt({ down: true, a: {} }, 1) === true && xb.infiniteAt({ down: true, a: {} }, 0) === false && xb.infiniteAt({ a: {} }, 1) === false);
    const x2 = rr.raidRhythmAdapter('xmas', { ...xctx, useTry: async () => ({ ok: false }) });
    check('クリスマス: 回数を使えなければ始めない', (await rr.raidRhythmBeginRun(x2, 0)).run === null);
    const x3 = rr.raidRhythmAdapter('xmas', { ...xctx, addDamage: async () => { throw new Error('x'); } });
    const r3 = await rr.raidRhythmFinish((await rr.raidRhythmBeginRun(x3, 0)).run, { damage: 5 }, null, { id: 'EASY' });
    check('クリスマス: 足す関数が落ちても結果は error で返る(画面は止まらない)', r3.outcome === 'error' && r3.damage === 10);
  }

  // ⑥
  const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  check('保存キーを持たず、端末へ直接書かない(storeSet・localStorage を使わない)', !/storeSet\(|localStorage|'mh_[a-z_0-9]+'/.test(code));

  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
