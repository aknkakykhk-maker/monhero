// プレイヤーの実戦の記録(全国ランキングの rankings 表)を、勇者モン別・供モン別に集計する(2026-10-21 社長「仕組みは作って」)。
// ティア表の決め方 overall に「実戦の重み」として混ぜられる(tactics-tier.js --method overall --player-weight <w>。既定は混ぜない)。
//
//   node tools/playbot/player-battle-stats.js                 公開の鍵(anon・読むだけ)で読んで集計し、保存する
//   node tools/playbot/player-battle-stats.js --from-cache    前に読んだもの(下の cache)から集計だけし直す(ネットに出られない環境用)
//   --out <file>   集計の置き場所(既定 docs/playbot/reports/tier/player-battle-stats.json)
//
// ★読むだけ。データベースへは何も書かない(GET だけ)。
// ★名前(user_name)・ブリーダーid・アイコン・マスモンの中身は読まない・出さない。読むのは difficulty・hero・score・reached_wave・turns と、
//   party の各枠の monsterId(無い古い行は baseId・id)だけ
// ★cache(読んだ行)も同じ列だけ(monsterId と数字)。tools/playbot/player-battle-cache.json。ネットに出られない環境でも作り直せるよう、git に入れておく
//
// 集計の決め:
//   ・モード: difficulty の頭で分ける(TacticsPro / Tactics / Pro / Extreme / 通常)。Rhythm-*(音ゲー)と種族チャレンジは数えない
//   ・クリア: turns が入っている行(クリアした回だけ送る clearTurns)か、届いた WAVE が 10 以上
//   ・届いた WAVE: reached_wave。クリアは 11 と数える(tactics-tier.js の reach と同じ)
//   ・供モン: party の2枠目以降。勇者モン(1枠目)は勇者モン別へ
//
// レイド「カボチャの大王ジャック」(raid_jack_hits・2026-10-21 社長「バトルデータはレイドからのデータも取れるよね？」)も読む。
//   読むのは event_id・kind(a=レイドバトル / b=グランドスラム)・tier(段階)・damage・defeated・source(battle / rhythm=モンヒロビート挑戦)だけ。
//   hit_id・breeder_id は読まない。★この表には使ったモンスターが入っていないので、モンスター別には分けられない
//   (モンスター別に見るには battle_logs が要る。docs/spec/BATTLE_LOG.md)。event_id が raid_jack_debug の行(デバッグ)は数えない
const fs = require('fs');
const path = require('path');
const https = require('https');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'player-battle-stats.json')));
const CACHE = path.join(HERE, 'player-battle-cache.json');
const FROM_CACHE = args.includes('--from-cache');

// 公開の鍵とURLはゲームのソースから読む(書き写さない)
const supa = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', '26-supabase.jsx'), 'utf8');
  return { url: (src.match(/const SUPABASE_URL = '([^']+)'/) || [])[1], key: (src.match(/const SUPABASE_KEY = '([^']+)'/) || [])[1] };
})();
// monsterId → 名前(data/ally-monsters.js)。ティア表は名前で並ぶので名前へそろえる
const NAME_BY_ID = (() => {
  const out = {};
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'ally-monsters.js'), 'utf8');
  // 1体1行の「{ id:'Golem',  name:"ゴーレム", ...」
  const re = /\{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
})();

const SLOT_COLS = [0, 1, 2, 3].flatMap((i) => [`m${i}:party->${i}->>monsterId`, `b${i}:party->${i}->>baseId`, `i${i}:party->${i}->>id`]);
const SELECT = ['difficulty', 'hero', 'score', 'reached_wave', 'turns', ...SLOT_COLS].join(',');
const get = (url, headers) => new Promise((resolve, reject) => {
  https.get(url, { headers }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve(body) : reject(new Error(`${res.statusCode} ${body.slice(0, 200)}`))));
  }).on('error', reject);
});
const fetchPaged = async (table, select, order) => {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const url = `${supa.url}/rest/v1/${table}?select=${encodeURI(select)}&order=${order}`;
    const body = await get(url, { apikey: supa.key, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' });
    const page = JSON.parse(body);
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
};
const RAID_SELECT = 'event_id,kind,tier,damage,defeated,source';
const fetchRaid = async () => (await fetchPaged('raid_jack_hits', RAID_SELECT, 'created_at.asc'))
  .map((r) => ({ event_id: r.event_id, kind: r.kind, tier: r.tier, damage: r.damage, defeated: r.defeated, source: r.source || 'battle' }));
const fetchAll = async () => {
  const rows = await fetchPaged('rankings', SELECT, 'id.asc');
  // 1枠ごとに monsterId だけへまとめて残す(ほかの列は持たない)
  return rows.map((r) => ({
    difficulty: r.difficulty, hero: r.hero, score: r.score, reached_wave: r.reached_wave, turns: r.turns,
    party: [0, 1, 2, 3].map((i) => r[`m${i}`] || r[`b${i}`] || r[`i${i}`] || null),
  }));
};

const modeOf = (key) => {
  const k = String(key || '');
  if (k.startsWith('Rhythm')) return null;
  if (/^Species/i.test(k) || k.includes(':')) return null;
  if (k.startsWith('TacticsPro')) return { mode: 'TacticsPro', diff: k.replace(/^TacticsPro(Beta)?/, '') };
  if (k.startsWith('Tactics')) return { mode: 'Tactics', diff: k.slice('Tactics'.length) };
  if (k.startsWith('Extreme')) return { mode: 'Extreme', diff: k.slice('Extreme'.length) };
  if (k.startsWith('Pro')) return { mode: 'Pro', diff: k.slice('Pro'.length) };
  return { mode: '通常', diff: k };
};
const isClear = (r) => Number(r.turns) > 0 || Number(r.reached_wave) >= 10;
const reach = (r) => (Number(r.reached_wave) || 0) + (isClear(r) ? 1 : 0);
const nameOf = (id) => NAME_BY_ID[id] || id;

const aggregate = (rows) => {
  const out = { 件数: { 読んだ行: rows.length, バトル: 0, 数えなかった: 0 }, モード: {} };
  const meanWave = {};
  const battle = [];
  for (const r of rows) {
    const mk = modeOf(r.difficulty);
    if (!mk || !mk.diff) { out.件数.数えなかった++; continue; }
    battle.push({ ...r, ...mk });
  }
  out.件数.バトル = battle.length;
  for (const r of battle) { const k = `${r.mode}/${r.diff}`; (meanWave[k] = meanWave[k] || []).push(reach(r)); }
  for (const k of Object.keys(meanWave)) { const xs = meanWave[k]; meanWave[k] = xs.reduce((a, b) => a + b, 0) / xs.length; }
  const add = (bucket, name, r) => {
    const e = (bucket[name] = bucket[name] || { 回数: 0, クリア: 0, 届いたWAVEの合計: 0, 伸びの合計: 0, 難易度: {} });
    e.回数++; if (isClear(r)) e.クリア++;
    e.届いたWAVEの合計 += reach(r);
    e.伸びの合計 += reach(r) - meanWave[`${r.mode}/${r.diff}`];
    e.難易度[r.diff] = (e.難易度[r.diff] || 0) + 1;
  };
  for (const r of battle) {
    const m = (out.モード[r.mode] = out.モード[r.mode] || { 回数: 0, 難易度ごとの平均WAVE: {}, 勇者モン: {}, 供モン: {} });
    m.回数++;
    const heroId = r.party[0];
    add(m.勇者モン, heroId ? nameOf(heroId) : String(r.hero || '不明'), r);
    for (const id of r.party.slice(1).filter(Boolean)) add(m.供モン, nameOf(id), r);
  }
  for (const [mode, m] of Object.entries(out.モード)) {
    for (const [k, v] of Object.entries(meanWave)) if (k.startsWith(`${mode}/`)) m.難易度ごとの平均WAVE[k.slice(mode.length + 1)] = Math.round(v * 100) / 100;
    for (const bucket of [m.勇者モン, m.供モン]) for (const e of Object.values(bucket)) {
      e.クリア率 = Math.round((e.クリア / e.回数) * 1000) / 1000;
      e.届いたWAVE = Math.round((e.届いたWAVEの合計 / e.回数) * 100) / 100;
      e.伸び = Math.round((e.伸びの合計 / e.回数) * 100) / 100;
      delete e.届いたWAVEの合計; delete e.伸びの合計;
    }
  }
  return out;
};

const RAID_WAY = { a: 'レイドバトル', b: 'グランドスラム' };
const aggregateRaid = (raidRows) => {
  const out = { 件数: { 読んだ行: raidRows.length, 数えた: 0, デバッグ: 0 }, イベント: {} };
  for (const r of raidRows) {
    if (String(r.event_id).includes('debug')) { out.件数.デバッグ++; continue; }
    out.件数.数えた++;
    const way = r.source === 'rhythm' ? 'モンヒロビート挑戦' : (RAID_WAY[r.kind] || String(r.kind));
    const ev = (out.イベント[r.event_id] = out.イベント[r.event_id] || {});
    const w = (ev[way] = ev[way] || {});
    const t = (w[`段階${r.tier}`] = w[`段階${r.tier}`] || { 回数: 0, 倒した回数: 0, ダメージの合計: 0, 最大ダメージ: 0 });
    const dmg = Math.max(0, Number(r.damage) || 0);
    t.回数++; if (r.defeated) t.倒した回数++;
    t.ダメージの合計 += dmg; t.最大ダメージ = Math.max(t.最大ダメージ, dmg);
  }
  for (const ev of Object.values(out.イベント)) for (const w of Object.values(ev)) for (const t of Object.values(w)) t['1回あたりのダメージ'] = Math.round(t.ダメージの合計 / t.回数);
  return out;
};

(async () => {
  let rows;
  let raidRows = [];
  if (FROM_CACHE) {
    try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); rows = c.rows; raidRows = c.raidRows || []; } catch (e) { console.error(`cache が読めない: ${CACHE}(一度ネットに出られる所で、--from-cache なしで回す)`); process.exit(1); }
  } else {
    if (!supa.url || !supa.key) { console.error('公開の鍵が読めない(26-supabase.jsx)'); process.exit(1); }
    rows = await fetchAll();
    // レイドの表が読めなくても(無い・権限が無い)ランキングの集計は続ける
    try { raidRows = await fetchRaid(); } catch (e) { console.error(`raid_jack_hits は読めなかった: ${e.message}`); raidRows = []; }
    fs.writeFileSync(CACHE, JSON.stringify({ 読んだ時刻: new Date().toISOString(), rows, raidRows }) + '\n');
  }
  const stats = { 作った時刻: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '), 決め: 'クリア = turns あり か 届いた WAVE 10 以上。届いた WAVE はクリアを 11 と数える。伸び = その回の届いた WAVE − 同じモード・難易度の平均', ...aggregate(rows), レイド: aggregateRaid(raidRows) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(stats, null, 2) + '\n');
  const modes = Object.entries(stats.モード).map(([k, v]) => `${k} ${v.回数}`).join(' / ');
  console.log(`読んだ行 ${stats.件数.読んだ行}(バトル ${stats.件数.バトル}・数えなかった ${stats.件数.数えなかった})。${modes}`);
  console.log(`レイド(raid_jack_hits): 読んだ行 ${stats.レイド.件数.読んだ行}(数えた ${stats.レイド.件数.数えた}・デバッグ ${stats.レイド.件数.デバッグ})`);
  console.log(`書き出した: ${path.relative(ROOT, OUT)}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
