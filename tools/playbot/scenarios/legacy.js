// 久しぶりに戻ってきた人: 昔の形のセーブ(lib/seeds.js の legacySeed)で開き、
//   ① 起動で持ち物が消えたり減ったりしないか
//   ② もう一度起動しても、移行や補填が二重にかからないか
//   ③ そのまま遊べるか(探索)
//   ④ 遊んだあとも、名前と昔のキーが残っているか
// を見る。数字の細かい中身は tools/boot/legacy-save-boot-check.js が見ているので、ここでは
// 「戻ってきた人が困るか」だけを見る(CLAUDE.md ⑦)。
const { exploreScenario } = require('./explore');

// 二度目の起動で変わってはいけないもの(一度きりの移行・補填が書くキー)
const ONCE_KEYS = ['mh_masu_mons', 'mh_breeder_points', 'mh_breeder_points_granted', 'mh_owned_items', 'mh_bond_xp',
  'mh_hs_Normal', 'mh_onboarded', 'mh_masu_migrated', 'mh_points_migrated', 'mh_points_base_granted'];

const snapshot = (s) => s.page.evaluate((keys) => {
  const parse = (v) => { try { return JSON.parse(v); } catch { return undefined; } };
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('mh_') && keys.includes(k)) out[k] = localStorage.getItem(k);
  }
  return { raw: out, name: parse(localStorage.getItem('mh_breeder_name')), gold: parse(localStorage.getItem('mh_gold')),
    xp: parse(localStorage.getItem('mh_breeder_xp')), items: parse(localStorage.getItem('mh_owned_items')),
    masu: (parse(localStorage.getItem('mh_masu_mons')) || []).map((m) => m && m.id), hasBondXp: localStorage.getItem('mh_bond_xp') !== null };
}, [...ONCE_KEYS, 'mh_gold', 'mh_breeder_xp', 'mh_breeder_name']);

// 移行が書き終わるのを待つ(画面のタップを待たずに走る)
const waitMigrated = (s) => s.page.waitForFunction(() => localStorage.getItem('mh_masu_migrated') === 'true'
  && localStorage.getItem('mh_points_base_granted') === 'true', { timeout: 30000 }).then(() => true).catch(() => false);

async function legacyReturnScenario(s) {
  await s.boot();
  const migrated = await waitMigrated(s);
  await s.wait(1500);
  await s.inspect();
  const a = await snapshot(s);
  const lost = [];
  if (a.name !== s.BOT_NAME) lost.push(`名前(${JSON.stringify(a.name)})`);
  if (!(Number(a.gold) >= 1234)) lost.push(`ダイヤ 1234 → ${a.gold}`);
  if (!(Number(a.xp) >= 5000)) lost.push(`ブリーダーXP 5000 → ${a.xp}`);
  if (!(a.items && Number(a.items.psyche) >= 3)) lost.push(`プシュケー 3 → ${a.items && a.items.psyche}`);
  if (!a.masu.includes('masu_migrated_Mocchi') || !a.masu.includes('masu_migrated_Suezo')) lost.push(`育てていたモッチー・スエゾーがマスモンにいない(${a.masu.join(', ') || 'なし'})`);
  if (!a.hasBondXp) lost.push('昔のキー mh_bond_xp が消えた');
  if (!migrated) await s.addIssue('データの移行', '昔のセーブで起動して30秒たっても、移行のフラグが立たない');
  if (lost.length) await s.addIssue('データが消えた', `昔のセーブで起動したら: ${lost.join(' / ')}`);
  return { ok: migrated && !lost.length, note: lost.length ? `消えた・減った: ${lost.length}件` : `持ち物は残った・マスモン ${a.masu.length}体`, stats: { first: a } };
}

async function legacyRebootScenario(s, first) {
  // 何も遊ばずに読み込み直す。一度きりのものが二度かかっていれば、ここで数字が動く
  await s.boot();
  await waitMigrated(s);
  await s.wait(1500);
  await s.inspect();
  const b = await snapshot(s);
  const changed = ONCE_KEYS.filter((k) => (first.raw[k] ?? null) !== (b.raw[k] ?? null));
  if (changed.length) await s.addIssue('二重に適用', `もう一度起動しただけで変わった: ${changed.join(', ')}`);
  return { ok: !changed.length, note: changed.length ? `二度目の起動で ${changed.length}個のキーが変わった` : '二度目の起動でも同じ' };
}

async function legacyPlayScenario(s, { steps, rand }) {
  const r = await exploreScenario(s, { steps, rand, report: { clickCount: new Map() } });
  const c = await snapshot(s);
  const lost = [];
  if (c.name !== s.BOT_NAME) lost.push(`名前が ${JSON.stringify(c.name)} になった`);
  if (!c.hasBondXp) lost.push('昔のキー mh_bond_xp が消えた');
  if (lost.length) await s.addIssue('データが消えた', `遊んだあと: ${lost.join(' / ')}`);
  return { ok: !lost.length, note: `${r.note}遊んだあとも${lost.length ? `、${lost.join(' / ')}` : '名前と昔のキーは残った'}` };
}

module.exports = { legacyReturnScenario, legacyRebootScenario, legacyPlayScenario };
