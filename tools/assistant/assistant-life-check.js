// 助手たちの今(56-assistant-life.jsx)の仕組みを確かめる。ブラウザは使わない。
//   node tools/assistant/assistant-life-check.js            検査
//   node tools/assistant/assistant-life-check.js --table    したいことの好みの表(Markdown)を出す
//   node tools/assistant/assistant-life-check.js --stats    お祭りの人の30日ぶんをまねて、組み合わせごとの1日の回数を出す(台詞の本数を決める元)
// 設計: docs/progress/assistant-peer/LIFE-PLAN.md
//   ① 表: 8人ぶんの好み・していること・場所がそろっている
//   ② 決まり: 同じ時間・同じ端末なら同じ結果/1人は1か所だけ/組は2〜4人/2人きりで「家」「寝る」は作らない/言い合いのあとの2人は組にならない
//   ③ 人柄: きゅうこは午後に図書室でひとりが多い/ドラは家でさみしそうな時がある/ソラシドは夜にカード研究が多い/表のように同じ形がくり返されない
//   ④ 声かけ: 誘った助手は次の時間にだれかといる/引き合わせた2人は一緒に過ごしやすい
//   ⑤ にぎわい: 遊びごとの量と1日の上限・段の境目・日付で数え直し・続けた日数の上乗せ
//   ⑥ 仲良くなり方: 段の倍率と1日の上限(静か 20/ふつう 30/にぎやか 45/お祭り 60)。印が偽なら今のまま
//   ⑦ 保存: 新しいキー(mh_assistant_life_v1・mh_assistant_life_play_v1)だけに書く。壊れた値でも空として読む
//   ⑧ 台本(段階3): ASSISTANT_LIFE_TALKS の id・鍵・話し手/書き直しの表は印が真のときだけ・id を変えない/
//      組・ひとり・誘う・言い合いの台本が様子に合う(顔ぶれ・していること・友情Lv の段・場所の型・空気)/穴が残らない/見たものは14日出さない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const mem = {};
const writes = [];
const flags = { assistantPeer: true, assistantLife: true };
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
  React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); },
  RELEASE_FLAGS: flags,
});
const load = (rel) => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  vm.runInContext(code, ctx);
};
load('monster-hero/data/assistants.js');
// 2人にあげる道具の検査用に、持ち物(breeder.js)と交換所(rhythm-event.js)から2品の行だけを切り出して読む(ファイル丸ごとはほかの定義に頼っているため)
{
  const pick = (rel, re) => fs.readFileSync(path.join(root, rel), 'utf8').split('\n').filter(l => re.test(l));
  const items = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8').match(/\{ id:'peer_(gift|token)'[\s\S]*?desc:"[^"]*" \}/g) || [];
  const offers = pick('monster-hero/data/rhythm-event.js', /Object\.freeze\(\{ id:'peer_(gift|token)'/).map(l => l.trim().replace(/,$/, ''));
  vm.runInContext(`var BREEDER_MARKET_ITEMS = [${items.join(',')}]; var RHYTHM_EVENT_POINT_SHOP_OFFERS = [${offers.join(',')}];`, ctx);
}
let dayNow = '2026-11-07';
vm.runInContext('var assistantBubbleDayKey = () => __day(); var assistantPeerDayKey = () => __day(); var jstDayKey4 = () => __day(); var assistantById = (id) => ASSISTANTS.find(a => a.id === id);', Object.assign(ctx, { __day: () => dayNow }));
load('monster-hero/src/parts/56-assistant-peer.jsx');
load('monster-hero/src/parts/56-assistant-life.jsx');
const G = (expr) => vm.runInContext(expr, ctx);

const PREFS = G('ASSISTANT_LIFE_PREFS');
const DOINGS = G('ASSISTANT_LIFE_DOINGS');
const PLACES = G('ASSISTANT_LIFE_PLACES');
const MOODS = G('ASSISTANT_LIFE_MOODS');
const SLOTS = G('ASSISTANT_LIFE_SLOTS');
const TIERS = G('ASSISTANT_LIFE_TIERS');
const IDS = Object.keys(G('ASSISTANT_PEER_CALLS'));
const NAMES = { mua: 'みゅあ', kiki: 'きき', momosuke: 'ももすけ', dra: 'ドラ', atsu: 'あつ', kyuko: 'きゅうこ', sorashido: 'ソラシド', erubin: 'えるびん' };
const decide = G('assistantLifeDecide');
const pairKey = (a, b) => [a, b].sort().join('-');

// 30日ぶんをまねる(前の様子を次へ渡す)。bond … ペアの点 / tier … 段の id
const simulate = ({ days = 30, members = IDS, bond = {}, tier = 'festival', salt = 'check', startAbs = 20400 * 6 } = {}) => {
  const t = TIERS.find(x => x.id === tier);
  const out = [];
  let prev = null;
  for (let k = 0; k < days * 6; k++) {
    const life = decide({ abs: startAbs + k, members, bond, prev, recent: [], nudges: {}, tier: t, salt });
    out.push(life);
    prev = life;
  }
  return out;
};

if (process.argv.includes('--table')) {
  const ds = Object.keys(DOINGS);
  console.log(`| 助手 | だれかといたい | 好きな場所 | ${ds.map(d => DOINGS[d].label).join(' | ')} | 時間ごと | ひとりが好きな時間 | ひとこと |`);
  console.log(`| --- | --- | --- | ${ds.map(() => '---').join(' | ')} | --- | --- | --- |`);
  for (const id of IDS) {
    const p = PREFS[id];
    const slot = Object.entries(p.slot || {}).map(([s, m]) => `${SLOTS.find(x => x.id === s).label}: ${Object.entries(m).map(([d, v]) => `${DOINGS[d].label}×${v}`).join('・')}`).join(' / ');
    console.log(`| ${NAMES[id]} | ${Math.round(p.social * 100)}% | ${PLACES[p.fav]} | ${ds.map(d => p.w[d]).join(' | ')} | ${slot} | ${(p.solo || []).map(s => SLOTS.find(x => x.id === s).label).join('・') || '—'} | ${p.note}${p.caring ? '' : ''} |`);
  }
  process.exit(0);
}

if (process.argv.includes('--stats')) {
  // 会った8人・ペアの点はいろいろ(Lv1〜6)で、お祭りの段の30日
  const bond = {};
  let n = 0;
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) bond[pairKey(IDS[i], IDS[j])] = [0, 40, 120, 250, 450, 700][(n++) % 6];
  const runs = [];
  for (const salt of ['a', 'b', 'c', 'd', 'e']) runs.push(...simulate({ bond, salt }));
  const days = 30 * 5;
  const count = (m, k) => { m[k] = (m[k] || 0) + 1; };
  const size = {}, gDoing = {}, gPlace = {}, soloKey = {}, soloReason = {}, pairs = {}, trios = {};
  for (const life of runs) {
    for (const g of life.groups) {
      count(size, `${g.ids.length}人`); count(gDoing, `${g.ids.length === 2 ? '2人' : '3人以上'}・${DOINGS[g.doing].label}`); count(gPlace, PLACES[g.place]);
      if (g.ids.length === 2) count(pairs, g.ids.map(i => NAMES[i]).join('・'));
      if (g.ids.length === 3) count(trios, g.ids.map(i => NAMES[i]).join('・'));
    }
    for (const [id, s] of Object.entries(life.solo)) {
      const type = s.place === 'home' ? '家' : (s.place === PREFS[id].fav ? '好きな場所' : 'それ以外');
      count(soloKey, `${NAMES[id]}・${MOODS[life.moods[id]]}・${type}`); count(soloReason, s.reason);
    }
  }
  const show = (title, m, limit = 60) => {
    console.log(`\n## ${title}(1日あたり)`);
    for (const [k, v] of Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, limit)) console.log(`- ${k}: ${(v / days).toFixed(2)}`);
  };
  show('組の人数', size); show('組のしていること', gDoing); show('組の場所', gPlace); show('ひとりの理由', soloReason);
  show('ひとりごと(人・気分・場所の型)', soloKey, 200); show('2人の組', pairs, 40); show('3人の組', trios, 30);
  process.exit(0);
}

// ① 表
{
  const bad = [];
  for (const id of IDS) {
    const p = PREFS[id];
    if (!p) { bad.push(`${id}: 好みが無い`); continue; }
    if (!PLACES[p.fav]) bad.push(`${id}: 好きな場所 ${p.fav}`);
    for (const d of Object.keys(DOINGS)) if (!Number.isFinite(p.w[d])) bad.push(`${id}: ${d} の重み`);
    for (const [s, m] of Object.entries(p.slot || {})) { if (!SLOTS.some(x => x.id === s)) bad.push(`${id}: 時間 ${s}`); for (const d of Object.keys(m)) if (!DOINGS[d]) bad.push(`${id}: ${d}`); }
  }
  for (const [d, v] of Object.entries(DOINGS)) for (const pl of v.places) if (!PLACES[pl]) bad.push(`${d}: 場所 ${pl}`);
  check('① 8人ぶんの好み・していること・場所がそろっている', bad.length === 0, bad.slice(0, 5).join(' / '));
  check('① 2人でもする「していること」は5つ(おやつ・練習・育成・カード研究・散歩)', JSON.stringify(Object.keys(DOINGS).filter(d => DOINGS[d].group)) === JSON.stringify(['snack', 'practice', 'training', 'cards', 'walk']));
  check('① 時間は6つで、0〜24時をすき間なく分ける', SLOTS.length === 6 && SLOTS.every((s, i) => s.to > s.from && (i === 0 ? s.from === 0 : s.from === SLOTS[i - 1].to)) && SLOTS[5].to === 24);
  const at = G('assistantLifeSlotAt');
  const jst = (h) => Date.UTC(2026, 10, 7, h - 9, 30);
  const ok = [[1, 'late'], [4, 'late'], [5, 'morning'], [12, 'noon'], [15, 'afternoon'], [19, 'evening'], [23, 'night']].every(([h, id]) => at(jst(h)).id === id);
  check('① 日本時間で時間が決まり、通しの番号は1つずつ進む', ok && at(jst(5)).abs === at(jst(1)).abs + 1 && at(Date.UTC(2026, 10, 7, 15, 30)).abs === at(jst(23)).abs + 1);
}

// ② 決まり
{
  const bond = { 'kiki-mua': 700, 'dra-momosuke': 250, 'atsu-sorashido': 450 };
  const a = simulate({ days: 3, bond, salt: 'x' });
  const b = simulate({ days: 3, bond, salt: 'x' });
  check('② 同じ時間・同じ端末なら同じ結果(開くたびに変わらない)', JSON.stringify(a) === JSON.stringify(b));
  const c = simulate({ days: 3, bond, salt: 'y' });
  check('② 端末がちがえば様子もちがう', JSON.stringify(a) !== JSON.stringify(c));
  const runs = [...simulate({ bond }), ...simulate({ bond, tier: 'quiet', salt: 'q' }), ...simulate({ members: ['mua', 'kiki', 'dra'], salt: 'three' }), ...simulate({ members: ['mua', 'kiki'], salt: 'two' })];
  const bad = [];
  for (const life of runs) {
    const seen = [...life.groups.flatMap(g => g.ids), ...Object.keys(life.solo)];
    const members = new Set(Object.keys(life.moods));
    if (seen.length !== new Set(seen).size || seen.length !== members.size) bad.push(`${life.abs}: 1人が2か所 / いない`);
    for (const g of life.groups) {
      if (g.ids.length < 2 || g.ids.length > 4) bad.push(`${life.abs}: ${g.ids.length}人の組`);
      if (!DOINGS[g.doing].group) bad.push(`${life.abs}: 組で ${g.doing}`);
      if (g.ids.length === 2 && g.place === 'home') bad.push(`${life.abs}: 2人きりで家`);
      if (!DOINGS[g.doing].places.includes(g.place)) bad.push(`${life.abs}: ${g.doing} を ${g.place} で`);
    }
    for (const [id, s] of Object.entries(life.solo)) if (!DOINGS[s.doing].places.includes(s.place) && !(s.reason === 'lonely' && s.place === 'home') && !((s.doing === 'idle' || s.doing === 'walk') && s.place === PREFS[id].fav)) bad.push(`${life.abs}: ${id} が ${s.doing} を ${s.place} で`);
    for (const id of Object.keys(life.moods)) if (!MOODS[life.moods[id]]) bad.push(`${life.abs}: 気分 ${life.moods[id]}`);
  }
  check('② 1人は1か所だけ・組は2〜4人・2人きりで「家」「寝る」は作らない・場所としていることが合う', bad.length === 0, bad.slice(0, 5).join(' / '));
  // 言い合い
  let together = 0;
  for (let k = 0; k < 60; k++) {
    const abs = 20400 * 6 + k * 7;
    const life = decide({ abs, members: IDS, bond: { 'kiki-mua': 2500 }, recent: [{ kind: 'quarrel', abs: abs - 1, pair: 'kiki-mua', ids: ['kiki', 'mua'] }], nudges: {}, tier: TIERS[3], salt: 's' + k });
    if (life.groups.some(g => g.ids.includes('kiki') && g.ids.includes('mua'))) together++;
  }
  check('② 言い合いのあとの2人は一緒にいない(距離をおく)', together === 0, `${together}/60`);
  let made = 0;
  for (let k = 0; k < 60; k++) {
    const abs = 20400 * 6 + k * 7;
    const life = decide({ abs, members: IDS, bond: { 'kiki-mua': 2500 }, recent: [{ kind: 'quarrel', abs: abs - 2, pair: 'kiki-mua' }, { kind: 'makeup', abs: abs - 1, pair: 'kiki-mua' }], nudges: {}, tier: TIERS[3], salt: 's' + k });
    if (life.groups.some(g => g.ids.includes('kiki') && g.ids.includes('mua'))) made++;
  }
  check('② 仲直りしたら、また一緒にいるようになる', made >= 15, `${made}/60`);
}

// ③ 人柄とくり返し
{
  const runs = [];
  for (const salt of ['a', 'b', 'c']) runs.push(...simulate({ salt, tier: 'normal' }));
  const slotOf = (life) => SLOTS[((life.abs % 6) + 6) % 6].id;
  const rate = (pred, cond) => { const xs = runs.filter(cond); return xs.length ? xs.filter(pred).length / xs.length : 0; };
  const kyuLib = rate(l => l.solo.kyuko && l.solo.kyuko.place === 'library', l => slotOf(l) === 'afternoon');
  check('③ きゅうこは午後に図書室でひとりの時間が多い', kyuLib >= 0.3, `${Math.round(kyuLib * 100)}%`);
  const draHomeLonely = runs.filter(l => l.solo.dra && l.solo.dra.place === 'home' && l.solo.dra.reason === 'lonely').length;
  check('③ ドラは家でさみしそうにしている時がある(でも毎回ではない)', draHomeLonely >= 3 && draHomeLonely / runs.length < 0.4, `${draHomeLonely}/${runs.length}`);
  const soraCards = rate(l => (l.solo.sorashido && l.solo.sorashido.doing === 'cards') || l.groups.some(g => g.ids.includes('sorashido') && g.doing === 'cards'), l => slotOf(l) === 'night');
  check('③ ソラシドは夜にカード研究が多い', soraCards >= 0.4, `${Math.round(soraCards * 100)}%`);
  const lateSleep = rate(l => Object.values(l.solo).filter(s => s.doing === 'sleep').length >= 3, l => slotOf(l) === 'late');
  check('③ 深夜はたいてい何人か寝ている', lateSleep >= 0.6, `${Math.round(lateSleep * 100)}%`);
  // 同じ時間の形が次の日もそのまま、はほとんど無い
  const shape = (l) => JSON.stringify([l.groups.map(g => g.ids.join('+')).sort(), Object.keys(l.solo).sort()]);
  let same = 0, total = 0;
  for (let k = 6; k < runs.length; k++) { if (Math.floor(k / 180) !== Math.floor((k - 6) / 180)) continue; total++; if (shape(runs[k]) === shape(runs[k - 6])) same++; }
  check('③ 前の日の同じ時間と同じ顔ぶれになるのは2割まで', same / total <= 0.2, `${Math.round(same / total * 100)}%`);
  const pairSet = new Set(runs.flatMap(l => l.groups.flatMap(g => { const o = []; for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) o.push(pairKey(g.ids[i], g.ids[j])); return o; })));
  check('③ 30日で、28ペアのほとんど(24以上)が一緒に過ごす', pairSet.size >= 24, `${pairSet.size}/28`);
  const lonelyShare = runs.reduce((s, l) => s + Object.values(l.solo).filter(x => x.reason === 'lonely').length, 0) / runs.length;
  check('③ さみしそうな助手は、1つの時間に平均0.3〜2.5人', lonelyShare >= 0.3 && lonelyShare <= 2.5, lonelyShare.toFixed(2));
  // 仲のよいペアほど一緒にいやすい
  const hi = [], lo = [];
  for (const salt of ['p', 'q', 'r']) {
    const xs = simulate({ salt, bond: { 'atsu-kiki': 2500 }, tier: 'normal' });
    hi.push(xs.filter(l => l.groups.some(g => g.ids.includes('atsu') && g.ids.includes('kiki'))).length);
    const ys = simulate({ salt, bond: {}, tier: 'normal' });
    lo.push(ys.filter(l => l.groups.some(g => g.ids.includes('atsu') && g.ids.includes('kiki'))).length);
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  check('③ 友情Lv の高いペアほど一緒にいやすい', sum(hi) > sum(lo) * 1.3, `高い ${sum(hi)} / 低い ${sum(lo)}`);
  // ペアの差(コトバ 2026-11-07「同じ2人ばかりに見えそう」)。点をそろえたら最多/最少が5倍まで、点をまぜても12倍まで
  const spread = (bond) => {
    const cnt = {};
    for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) cnt[pairKey(IDS[i], IDS[j])] = 0;
    for (const salt of ['a', 'b', 'c', 'd', 'e']) for (const l of simulate({ salt, bond })) for (const g of l.groups) for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) cnt[pairKey(g.ids[i], g.ids[j])]++;
    const v = Object.values(cnt);
    return Math.max(...v) / Math.max(1, Math.min(...v));
  };
  const mixed = {};
  { let n = 0; for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) mixed[pairKey(IDS[i], IDS[j])] = [0, 40, 120, 250, 450, 700][(n++) % 6]; }
  const sp0 = spread({}), sp1 = spread(mixed);
  check('③ 同じ2人ばかりにならない(ペアの出る数の差: 点をそろえて5倍まで・点をまぜて12倍まで)', sp0 <= 5 && sp1 <= 12, `${sp0.toFixed(1)}倍 / ${sp1.toFixed(1)}倍`);
  const draHome = runs.filter(l => l.solo.dra && l.solo.dra.place === 'home' && l.solo.dra.reason === 'lonely').length / (runs.length / 6);
  check('③ ドラが家でさみしそうなのは1日0.5〜2回くらい(社長の例)', draHome >= 0.5 && draHome <= 2, `${draHome.toFixed(2)}回/日`);
  const quiet = simulate({ salt: 'g', tier: 'quiet' }).reduce((s, l) => s + l.groups.length, 0);
  const fest = simulate({ salt: 'g', tier: 'festival' }).reduce((s, l) => s + l.groups.length, 0);
  check('③ にぎわうほど集まる組が増える', fest > quiet, `静か ${quiet} / お祭り ${fest}`);
}

// ④ 声かけ
{
  let inv = 0, intro = 0, introBase = 0;
  for (let k = 0; k < 80; k++) {
    const abs = 20400 * 6 + 1 + k * 6 + (k % 5); // 深夜を避ける
    const fixed = abs % 6 === 0 ? abs + 1 : abs;
    const l1 = decide({ abs: fixed, members: IDS, bond: {}, nudges: { invite: [{ id: 'dra', abs: fixed }] }, tier: TIERS[1], salt: 'n' + k });
    if (l1.groups.some(g => g.ids.includes('dra'))) inv++;
    const l2 = decide({ abs: fixed, members: IDS, bond: {}, nudges: { introduce: [{ pair: 'erubin-momosuke', abs: fixed }] }, tier: TIERS[1], salt: 'n' + k });
    if (l2.groups.some(g => g.ids.includes('erubin') && g.ids.includes('momosuke'))) intro++;
    const l3 = decide({ abs: fixed, members: IDS, bond: {}, nudges: {}, tier: TIERS[1], salt: 'n' + k });
    if (l3.groups.some(g => g.ids.includes('erubin') && g.ids.includes('momosuke'))) introBase++;
  }
  check('④ 誘った助手は、次の時間にだれかと一緒にいる(9割以上)', inv >= 72, `${inv}/80`);
  check('④ 引き合わせた2人は、ふだんよりずっと一緒にいやすい', intro >= 40 && intro >= introBase * 2, `引き合わせ ${intro}/80・ふだん ${introBase}/80`);
}

// ⑤ にぎわい
{
  const add = G('assistantLifeAddPlayState');
  const tierOf = G('assistantLifeTierOf');
  let p = null;
  let r = add(p, 'rhythm', '2026-11-07'); p = r.play;
  check('⑤ ビート1曲 +2', r.gained === 2 && p.points === 2);
  r = add(p, 'card', '2026-11-07'); p = r.play;
  check('⑤ カード1戦 +3', r.gained === 3 && p.points === 5);
  for (let i = 0; i < 30; i++) p = add(p, 'chat', '2026-11-07').play;
  check('⑤ おしゃべりは1日 +20 まで', p.counts.chat === 20 && p.points === 25);
  const bounds = [[0, 'quiet'], [19, 'quiet'], [20, 'normal'], [59, 'normal'], [60, 'lively'], [119, 'lively'], [120, 'festival'], [999, 'festival']];
  check('⑤ 段の境目(0〜19 静か・20〜59 ふつう・60〜119 にぎやか・120〜 お祭り)', bounds.every(([v, id]) => tierOf(v).id === id));
  check('⑤ 段の倍率と1日の上限(×1/20・×1.25/30・×1.5/45・×2/60)', JSON.stringify(TIERS.map(t => [t.mult, t.cap])) === JSON.stringify([[1, 20], [1.25, 30], [1.5, 45], [2, 60]]));
  let up = null; let q = { day: '2026-11-07', points: 18, counts: {}, streak: 1 };
  r = add(q, 'battle', '2026-11-07'); up = r.tierUp;
  check('⑤ 段が上がったときに知らせる', up && up.id === 'normal');
  r = add(p, 'battle', '2026-11-08');
  check('⑤ 日付が変わると数え直す(前の日から続けて遊ぶと日数が進む)', r.play.points === 2 && r.play.streak === 2 && r.play.lastDay === '2026-11-07');
  let s = { day: '2026-11-06', points: 50, counts: {}, streak: 6 };
  r = add(s, 'battle', '2026-11-07');
  check('⑤ 7日続けて遊ぶと、その日の始まりに +10', r.play.streak === 7 && r.play.points === 12);
  s = { day: '2026-11-04', points: 50, counts: {}, streak: 6 };
  r = add(s, 'battle', '2026-11-07');
  check('⑤ 1日でも空くと続けた日数は1から', r.play.streak === 1 && r.play.points === 2);
  r = add(p, 'nanika', '2026-11-07');
  check('⑤ 知らない遊びでは増えない', r.gained === 0);
}

// ⑥ 仲良くなり方
{
  const gainState = G('assistantPeerGainState');
  const opts = G('assistantLifeGainOpts');
  const run = (o) => { let st = { bond: {}, bondDay: { day: null, got: {} } }; let total = 0; for (const act of ['talk', 'talk', 'talk', 'talk', 'choice', 'choice', 'story', 'switch', 'play', 'play', 'play', 'event', 'talk', 'talk']) { const r = gainState(st, 'kiki', 'mua', act, '2026-11-07', o); st = r.st; total += r.gained; } return { total, st }; };
  const none = run(null).total;
  check('⑥ にぎわいなし(印が偽)なら、今の上限 20 のまま', none === 20, String(none));
  const capOf = (pts) => run(opts({ day: '2026-11-07', points: pts, counts: {} }, '2026-11-07')).total;
  check('⑥ 1日の上限: 静か 20・ふつう 30・にぎやか 45・お祭り 60', capOf(0) === 20 && capOf(20) === 30 && capOf(60) === 45 && capOf(120) === 60, [capOf(0), capOf(20), capOf(60), capOf(120)].join('/'));
  const r1 = gainState({ bond: {}, bondDay: { day: null, got: {} } }, 'kiki', 'mua', 'talk', '2026-11-07', { mult: 2, cap: 60 });
  check('⑥ お祭りの日は1回の量も2倍(掛け合い +2 → +4)', r1.gained === 4);
  const r2 = gainState({ bond: {}, bondDay: { day: null, got: {} } }, 'kiki', 'mua', 'gift', '2026-11-07', { mult: 2, cap: 60 });
  check('⑥ 差し入れなど決まった量のものは倍にしない', r2.gained === 15);
}

// ⑧ 台本(段階3)
{
  // テキスト(docs/progress/assistant-peer/lines/)とデータがずれていない
  const { spawnSync } = require('child_process');
  for (const tool of ['life-talks-import.js', 'peer-rewrite-table.js']) {
    const r = spawnSync(process.execPath, [path.join(__dirname, tool), '--check'], { encoding: 'utf8' });
    check(`⑧ ${tool} --check(テキストとデータが同じ)`, r.status === 0, (r.stdout || r.stderr || '').trim().split('\n').pop());
  }
  const LT = G('ASSISTANT_LIFE_TALKS');
  const RW = G('ASSISTANT_PEER_REWRITES');
  const RAW = G('ASSISTANT_PEER_TALKS');
  const KEYS = { place: Object.keys(PLACES), mood: Object.keys(MOODS), why: ['lonely', 'mypace', 'distance'], doing: ['snack', 'practice', 'training', 'cards', 'walk'],
    lv: ['1-3', '4-6', '7-10'], air: ['normal', 'after', 'makeup'], answer: ['glad', 'decline', 'shy'], seed: ['snack', 'order', 'look', 'plan', 'late', 'noise', 'peek', 'score'] };
  const oldIds = new Set([...RAW, ...G('ASSISTANT_PEER_EVENTS'), ...G('ASSISTANT_PEER_QUARRELS'), ...G('ASSISTANT_PEER_TRIO_TALKS')].map(t => t.id));
  const ids = LT.map(t => t.id);
  check('⑧ 台本の id が重ならない(今の台本とも)', new Set(ids).size === ids.length && ids.every(id => !oldIds.has(id) && !oldIds.has(id.replace(/m$/, ''))), `${ids.length}本`);
  const badKey = LT.filter(t => Object.entries(t.keys || {}).some(([k, v]) => !KEYS[k] || !KEYS[k].includes(v)));
  check('⑧ 鍵の名前と値が決めたものだけ', badKey.length === 0, badKey.slice(0, 3).map(t => t.id).join(', '));
  const speakers = (t) => t.kind === 'solo' || t.kind === 'breeder' ? [t.who] : t.kind === 'invite' ? [t.who, t.from] : (Array.isArray(t.trio) ? t.trio : t.pair);
  const badWho = LT.filter(t => { const m = speakers(t) || []; const rows = [...t.lines, ...(t.distance || []), ...(t.makeup || [])]; return !m.every(id => IDS.includes(id)) || !rows.every(l => m.includes(l.who)); });
  check('⑧ 話し手はその台本の顔ぶれの中の人', badWho.length === 0, badWho.slice(0, 3).map(t => t.id).join(', '));
  const twoOk = LT.filter(t => t.kind === 'pair' || (t.kind === 'trio' && t.any)).every(t => new Set(t.lines.map(l => l.who)).size === 2);
  check('⑧ 2人の掛け合い・どの3人でもは2人とも話す', twoOk);
  check('⑧ 2人きりで「家」の台本は無い', !LT.some(t => t.kind === 'pair' && t.keys.place === 'home'));

  // 書き直しの表: 印が偽なら今の文のまま・真なら表の文。id と話す人は変えない
  flags.assistantLife = false;
  const offList = G('assistantPeerTalkList()');
  check('⑧ 印が偽なら今の台本をそのまま使う', offList === RAW);
  flags.assistantLife = true;
  const onList = G('assistantPeerTalkList()');
  const sameIds = onList.length === RAW.length && onList.every((t, i) => t.id === RAW[i].id);
  const sameWho = onList.every((t, i) => t.lines.length === RAW[i].lines.length && t.lines.every((l, j) => l.who === RAW[i].lines[j].who));
  const changed = onList.filter((t, i) => JSON.stringify(t.lines) !== JSON.stringify(RAW[i].lines)).length;
  const want = RAW.filter(t => RW[t.id] && RW[t.id].lines).length;
  check('⑧ 印が真なら書き直しの文で出す(id・行の数・話す人は同じ)', sameIds && sameWho && changed === want && changed > 0, `${changed}本`);
  const q0 = G('ASSISTANT_PEER_QUARRELS')[0];
  const qOn = G('assistantPeerExtraTalks()').quarrels.find(t => t.id === q0.id);
  check('⑧ けんかに「距離をおく」の行がつく(印が真のとき)', !RW[q0.id] || !RW[q0.id].distance || (qOn.distance && qOn.distance.length === RW[q0.id].distance.length));
  flags.assistantLife = false;
  const allOff = G('assistantPeerAllTalks()').length;
  flags.assistantLife = true;
  const allOn = G('assistantPeerAllTalks()').length;
  check('⑧ アルバムには印が真のときだけ新しい2人・3人の台本も入る', allOn > allOff, `${allOff} → ${allOn}`);

  // 様子に合う台本
  const lstore = G('ASSISTANT_LIFE_STORE');
  lstore.set({ loaded: true, seen: {} });
  const bondOf = (lv) => [0, 0, 40, 120, 250, 450, 700, 1000, 1400, 1900, 2500][lv];
  const peer = (lv, extra = {}) => { const bond = {}; for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) bond[pairKey(IDS[i], IDS[j])] = bondOf(lv); return { bond, quarrel: { pending: null, done: [] }, ...extra }; };
  const rank = { '1-3': 0, '4-6': 1, '7-10': 2 };
  const pickG = G('assistantLifePickGroupTalk');
  const membersOf = (t) => (Array.isArray(t.trio) ? t.trio : t.pair);
  const lifeBase = { abs: 1000, moods: {}, recent: [], groups: [], solo: {} };
  let n = 0, bad = [], doingHit = 0, doingAll = 0, bandBad = 0;
  for (let i = 0; i < IDS.length; i++) for (let j = i + 1; j < IDS.length; j++) for (const d of KEYS.doing) for (const lv of [1, 5, 8]) {
    const g = { ids: [IDS[i], IDS[j]].sort(), doing: d, place: DOINGS[d].places[0] };
    const t = pickG(g, peer(lv), lifeBase, Math.random);
    n++;
    if (!t || !membersOf(t).every(id => g.ids.includes(id))) { bad.push(`${g.ids.join('-')} ${d} Lv${lv}`); continue; }
    const tl = (t.keys && t.keys.lv) || t.lifeLv;
    const band = lv >= 7 ? '7-10' : lv >= 4 ? '4-6' : '1-3';
    if (tl && rank[tl] > rank[band]) bandBad++;
    const td = (t.keys && t.keys.doing) || t.lifeDoing;
    doingAll++; if (!td || td === d) doingHit++;
  }
  check('⑧ 2人の組: どの2人・していること・段でも、その2人の台本が出る', bad.length === 0, bad.slice(0, 3).join(' / ') || `${n}通り`);
  check('⑧ 2人の組: 友情Lv の段より上の台本は出ない', bandBad === 0, `${bandBad}`);
  check('⑧ 2人の組: していることが合う台本を先に出す(9割以上)', doingHit / doingAll >= 0.9, `${Math.round(100 * doingHit / doingAll)}%`);
  // 14日のあいだは同じ台本を出さない(全部見たら、いちばん前に見たもの)
  {
    lstore.set({ seen: {} });
    const g = { ids: ['erubin', 'momosuke'], doing: 'snack', place: 'cafe' };
    const got = [];
    for (let k = 0; k < 12; k++) { const t = pickG(g, peer(5), lifeBase, Math.random); got.push(t.id); G('assistantLifeMarkSeen')(t); }
    check('⑧ 見た台本は続けて出さない(14日)', new Set(got).size === got.length, `${new Set(got).size}/${got.length}`);
    const seen = G('ASSISTANT_LIFE_STORE').state.seen;
    check('⑧ 見た記録は id と日付だけ', Object.entries(seen).every(([k, v]) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)));
    const norm = G('normalizeAssistantLifeSeen')({ a: '2026-10-01', b: '2026-11-06', c: 5, d: 'x' }, '2026-11-07');
    check('⑧ 14日より前の記録と壊れた値は捨てる', JSON.stringify(norm) === JSON.stringify({ b: '2026-11-06' }));
    lstore.set({ seen: {} });
  }
  // 3人以上の組
  {
    let bad3 = [];
    for (let k = 0; k < 200; k++) {
      const pool = [...IDS].sort(() => Math.random() - 0.5);
      const g = { ids: pool.slice(0, 3 + (k % 2)).sort(), doing: KEYS.doing[k % 5], place: 'plaza' };
      const t = pickG(g, peer(3), lifeBase, Math.random);
      if (!t || !membersOf(t).every(id => g.ids.includes(id))) bad3.push(g.ids.join('-'));
    }
    check('⑧ 3人・4人の組: その組の中の人だけが話す台本が出る', bad3.length === 0, bad3.slice(0, 3).join(' / '));
  }
  // ひとりの助手
  {
    let badS = [];
    for (const id of IDS) for (const [place, reason, mood] of [['home', 'lonely', 'lonely'], [PREFS[id].fav, 'mypace', 'happy'], ['hill', 'mypace', 'sleepy']]) {
      const life = { ...lifeBase, moods: { [id]: mood }, solo: { [id]: { doing: 'idle', place, reason } } };
      const t = G('assistantLifePickSoloTalk')(id, life, peer(1), () => 0.99);
      const okPlace = t && (t.parts || []).every(pid => { const raw = LT.find(x => x.id === pid); const pl = raw.keys.place; return !pl || G('assistantLifePlaceType')(id, pl) === G('assistantLifePlaceType')(id, place); });
      if (!t || !t.lines.every(l => l.who === id) || !okPlace) badS.push(`${id}@${place}`);
    }
    check('⑧ ひとりの助手: その人のひとりごと(場所の型が合う・様子→気持ち)が出る', badS.length === 0, badS.slice(0, 4).join(' / '));
    const t = G('assistantLifePickSoloTalk')('dra', { ...lifeBase, moods: { dra: 'lonely' }, solo: { dra: { doing: 'sleep', place: 'home', reason: 'lonely' } } }, peer(1), () => 0.99);
    check('⑧ ひとりごとは「様子の1行 → 気持ちの1行」の順', t && t.parts.length === 2 && LT.find(x => x.id === t.parts[0]).line === 'scene' && LT.find(x => x.id === t.parts[1]).line === 'feel');
  }
  // 言い合い中の2人がまた一緒なら仲直り
  {
    const q = G('assistantPeerExtraTalks()').quarrels.find(t => t.kind === 'quarrel');
    const st = peer(3, { quarrel: { pending: { id: q.id, pair: pairKey(q.pair[0], q.pair[1]), at: 0 }, done: [q.id] } });
    const t = pickG({ ids: [...q.pair].sort(), doing: 'walk', place: 'plaza' }, st, lifeBase, Math.random);
    check('⑧ 言い合いのあとの2人がまた一緒にいると、仲直りが流れる', t && t.kind === 'makeup' && t.quarrelId === q.id);
    const life = { ...lifeBase, moods: { [q.pair[0]]: 'sulky' }, solo: { [q.pair[0]]: { doing: 'idle', place: 'hill', reason: 'distance' } } };
    const d = G('assistantLifePickSoloTalk')(q.pair[0], life, st, () => 0.5);
    check('⑧ 距離をおいている助手の様子を見ると「距離をおく」の行', !q.distance.length || (d && d.kind === 'life-distance'));
  }
  // 穴が残らない
  {
    const fill = G('assistantPeerLineText');
    const left = [];
    for (const t of [...LT]) for (const l of [...t.lines, ...(t.distance || []), ...(t.makeup || [])]) {
      const text = fill(l, { ...t, pair: speakers(t), trio: t.kind === 'trio' && !t.any ? t.trio : undefined, ctx: { place: 'plaza', doing: 'snack' } });
      if (/[{}]/.test(text)) left.push(`${t.id}: ${text}`);
    }
    check('⑧ 台本の穴({c}・{place}・{doing} など)が残らない', left.length === 0, left.slice(0, 2).join(' / '));
  }
  // 新しい種類(声かけ・決まった3人・言い合い・ブリーダーへ)が引ける
  {
    const T = G('assistantLifeTalkSet()');
    let badInv = [];
    for (const id of IDS) {
      const others = IDS.filter(x => x !== id);
      const life = { ...lifeBase, moods: { [id]: 'lonely' }, solo: { [id]: { doing: 'idle', place: 'home', reason: 'lonely' } }, groups: [{ ids: others.slice(0, 2), doing: 'snack', place: 'cafe' }, { ids: others.slice(2, 4), doing: 'walk', place: 'plaza' }] };
      const t = G('assistantLifePickInviteTalk')(id, life, peer(3), Math.random);
      if (T.invite.some(x => x.who === id) && (!t || t.who !== id || !others.slice(0, 4).includes(t.from))) badInv.push(id);
    }
    check('⑧ 誘う: 誘われる人と、いま組にいる人のあいだの声かけが出る', badInv.length === 0, badInv.join(',') || `${T.invite.length}本`);
    let badTrio = 0, hitFixed = 0;
    for (const t of T.trio) {
      lstore.set({ seen: {} });
      const got = pickG({ ids: [...t.trio], doing: t.keys.doing || 'snack', place: 'plaza' }, peer(3), lifeBase, Math.random);
      if (!got || !got.trio || !got.trio.every(id => t.trio.includes(id))) badTrio++;
      else if (!got.anyTrio) hitFixed++;
    }
    check('⑧ 決まった3人がそろうと、その3人の台本が先に出る', badTrio === 0 && hitFixed === T.trio.length, `${hitFixed}/${T.trio.length}`);
    const lq = T.quarrel.filter(t => t.kind === 'quarrel');
    const lifeQ = G('assistantPeerExtraTalks()').quarrels.filter(t => t.kind === 'quarrel' && /^life-/.test(t.id));
    check('⑧ 言い合い(言い合い・距離・仲直り)が仲直りの流れに乗る', lq.length > 0 && lifeQ.length === lq.length && lq.every(q => q.distance.length && T.quarrel.some(m => m.kind === 'makeup' && m.quarrelId === q.id)), `${lq.length}本`);
    // 気分がすぐれない2人はたまに言い合い(Lv2 から)
    lstore.set({ seen: {} });
    let qn = 0;
    for (let k = 0; k < 400; k++) { const t = pickG({ ids: ['kiki', 'mua'], doing: 'snack', place: 'cafe' }, peer(3), { ...lifeBase, moods: { kiki: 'sulky' } }, Math.random); if (t && t.kind === 'quarrel') qn++; }
    check('⑧ すねている2人は3割くらいで言い合いになる', qn > 80 && qn < 160, `${qn}/400`);
    let brN = 0;
    for (let k = 0; k < 300; k++) { const t = G('assistantLifePickSoloTalk')('mua', { ...lifeBase, moods: { mua: 'happy' }, solo: { mua: { doing: 'walk', place: 'plaza', reason: 'mypace' } } }, peer(1), Math.random); if (t && t.kind === 'life-breeder') brN++; }
    check('⑧ ようすを見ると、ときどきブリーダーへのひとこと', T.breeder.length === 0 || (brN > 30 && brN < 150), `${brN}/300`);
    lstore.set({ seen: {} });
  }
  // 2人にあげる道具: 数字は表から読む/渡すとよさそうな印
  {
    const g = G("assistantLifeItemInfo('gift')"), t = G("assistantLifeItemInfo('token')");
    check('⑧ 道具の名前・値段・上がる量は表から読む(差し入れ 200P・友情Lv +15/しるし 500P・+30)', g.name === '差し入れ' && g.cost === 200 && g.peerAmt === 15 && g.playerAmt > 0 && t.cost === 500 && t.peerAmt === 30, `${g.name} ${g.cost} ${g.peerAmt}/${g.playerAmt}・${t.name} ${t.cost} ${t.peerAmt}/${t.playerAmt}`);
    const hint = G('assistantLifePairHint');
    const h1 = hint({ bond: { 'kiki-mua': 440 }, quarrel: {} }, lifeBase, 'kiki', 'mua');
    const h2 = hint({ bond: { 'kiki-mua': 300 }, quarrel: { pending: { pair: 'kiki-mua' } } }, lifeBase, 'kiki', 'mua');
    check('⑧ 印: もうすぐ友情Lv が上がる(あと30以内)・言い合いのあと', h1.near && h1.near.level === 5 && h1.near.left === 10 && !h1.after && !h2.near && h2.after);
    flags.assistantLife = false;
    const off = G("assistantLifeItemDesc(BREEDER_MARKET_ITEMS.find(x => x.id === 'peer_gift'))");
    flags.assistantLife = true;
    const on = G("assistantLifeItemDesc(BREEDER_MARKET_ITEMS.find(x => x.id === 'peer_gift'))");
    check('⑧ 持ち物・交換所の説明は、印が真のときだけ「何が起きるか」中心の文', off === G("BREEDER_MARKET_ITEMS.find(x => x.id === 'peer_gift').desc") && /友情Lv \+15/.test(on) && /助手ライフ/.test(on) && /1日1回/.test(on)); // 2026-11-07 名前を「助手ライフ」にそろえた
  }
  // ⑦ のために入れ物を読み込む前へ戻す
  lstore.loading = null;
  lstore.set({ loaded: false, life: G('normalizeAssistantLife(null)'), play: G('normalizeAssistantLifePlay(null)'), seen: {} });
}

// ⑦ 保存
(async () => {
  for (const k of Object.keys(mem)) delete mem[k];
  writes.length = 0;
  mem.mh_assistant_life_v1 = { salt: 7, abs: 'x', moods: { mua: 'zzz', nobody: 'happy' }, groups: [{ ids: ['mua'], doing: 'snack', place: 'cafe' }, 3], solo: { kiki: { doing: 'fly', place: 'moon' } }, recent: 'x', nudges: 5 };
  mem.mh_assistant_life_play_v1 = { day: 3, points: -4 };
  const store = G('ASSISTANT_LIFE_STORE');
  await store.load();
  const s = store.state;
  check('⑦ 壊れた値でも空として読む', s.life.groups.length === 0 && Object.keys(s.life.moods).length === 0 && Object.keys(s.life.solo).length === 0 && s.life.recent.length === 0 && s.play.points === 0 && !!s.life.salt);
  const now = Date.UTC(2026, 10, 7, 3, 0); // 日本時間 12時
  const life = await G('assistantLifeNow')({ members: ['mua', 'kiki', 'dra', 'kyuko'], now });
  check('⑦ いまの時間の様子を決めて保存する', life && life.slot === 'noon' && mem.mh_assistant_life_v1 && mem.mh_assistant_life_v1.abs === life.abs);
  const again = await G('assistantLifeNow')({ members: ['mua', 'kiki', 'dra', 'kyuko'], now: now + 3600000 });
  check('⑦ 同じ時間のうちは開き直しても同じ', JSON.stringify(again.groups) === JSON.stringify(life.groups));
  await G('assistantLifeNudge')('invite', 'dra', now);
  check('⑦ 誘うと次の時間の声かけとして残る', mem.mh_assistant_life_v1.nudges.invite.some(n => n.id === 'dra' && n.abs === life.abs + 1));
  await G('assistantLifeAddPlay')('rhythm', now);
  check('⑦ にぎわいを保存する(誘った分 +2 とビート +2)', mem.mh_assistant_life_play_v1 && mem.mh_assistant_life_play_v1.points === 4, JSON.stringify(mem.mh_assistant_life_play_v1));
  flags.assistantLife = false;
  const before = writes.length;
  await G('assistantLifeAddPlay')('rhythm', now);
  const off = await G('assistantLifeNow')({ members: ['mua'], now });
  check('⑦ 印が偽なら数えず、何も書かない', writes.length === before && off === null && G('assistantLifeGainOptsNow()') === null);
  flags.assistantLife = true;
  const keys = [...new Set(writes)];
  check('⑦ 書くのは mh_assistant_life_v1・mh_assistant_life_play_v1・mh_assistant_peer_seen14_v1 だけ', keys.every(k => ['mh_assistant_life_v1', 'mh_assistant_life_play_v1', 'mh_assistant_peer_seen14_v1'].includes(k)), keys.join(', '));

  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
