// 絆Lv・総合力ランキングのリアルタイム更新(2026-09-27)を確認する。
//
//   node tools/ranking/bond-levels-live-sync-check.js
//
// 周回の終わりだけでなく、マスモンが育ったら(アイテム・融合・強化・モンヒロビート)
// 変わった個体の行だけを bond_levels へ上書きする。ここで見張るのは次の4点。
//
//   1. 手持ちのマスモンから作る行が、周回の終わりと同じ bondLevelRowsFromParty を通っているか
//      (行の作り方が2通りになると、どちらかだけ列が抜ける)
//   2. 前に送った内容と同じ行は送らず、変わった行だけを送るか(起動のたびに全員を送らない)
//   3. 保存した指紋が壊れていても落ちず、空から数え直すか
//   4. 画面側が「送れた行だけ」指紋を覚え、読み込みが終わる前には送らないか
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const supabaseSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 1〜3. 行を作る関数・指紋の関数を実際に動かす ----
const start = supabaseSrc.indexOf('const bondLevelRowsFromParty');
const end = supabaseSrc.indexOf('const sbFetchRankings', start);
check('行を作る関数と指紋の関数が 26-supabase.jsx にある', start >= 0 && end > start);

const context = {
  ALL_PLAYER_MONSTERS: { Mocchi: { name: 'モッチー' }, Suezo: { name: 'スエゾー' } },
  rankingPartyColors: (baseId, colors) => [0, 1, 2].map(i => (Array.isArray(colors) ? colors : [])[i] || null),
  getMasuColors: (masu) => masu.colors || [],
  masuBondLevelInfo: (masu) => ({ level: Math.floor((masu.bondXp || 0) / 10) }),
  rankingMasuDetail: (masu) => ({ v: 6, bondXp: masu.bondXp || 0, power: masu.power || null }),
  rankingProfileFrameValue: (v) => (v && v !== 'none') ? v : null,
};
vm.createContext(context);
vm.runInContext(`${supabaseSrc.slice(start, end)}\n;globalThis.api = { bondLevelRowsFromMasuMons, bondLevelRowSignature, normalizeBondLiveSync, bondLiveSyncKeyOf, bondLevelRowsToSync, BOND_LIVE_SYNC_KEY };`, context);
const api = context.api;

const masuMons = [
  { id: 'm1', baseId: 'Mocchi', bondXp: 120, power: 5000 },
  { id: 'm2', baseId: 'Suezo', bondXp: 300, power: 9000, colors: ['#ff0000'] },
  { id: 'm3', baseId: 'Mocchi', bondXp: 0 },          // 絆Lv0は周回の終わりと同じく載せない
  { id: 'm4', baseId: 'Unknown', bondXp: 500 },       // 知らない種は載せない
  null,
];
const rows = api.bondLevelRowsFromMasuMons('あいな', 'Mocchi', masuMons, 'gold', 'bid-1');
check('絆Lvが1以上の既知のマスモンだけが行になる', rows.map(r => r.individual_id).join(',') === 'm1,m2',
  rows.map(r => r.individual_id).join(','));
const m2 = rows.find(r => r.individual_id === 'm2');
check('行の形は周回の終わりと同じ(名前・ID・種・絆Lv・フレーム・詳細・色)',
  m2 && m2.user_name === 'あいな' && m2.breeder_id === 'bid-1' && m2.monster_id === 'Suezo'
  && m2.mon_name === 'スエゾー' && m2.bond_level === 30 && m2.profile_frame === 'gold'
  && m2.detail && m2.detail.power === 9000 && Array.isArray(m2.colors) && m2.colors[0] === '#ff0000',
  JSON.stringify(m2));
check('染めていない子には色を付けない', rows.find(r => r.individual_id === 'm1').colors === null);
check('マスモン一覧が配列でなくても落ちない',
  api.bondLevelRowsFromMasuMons('a', null, null).length === 0 && api.bondLevelRowsFromMasuMons('a', null, undefined).length === 0);

// 送った指紋と同じなら送らない。1体だけ育てたら、その1体だけ送る
const sent = {};
rows.forEach(r => { sent[api.bondLiveSyncKeyOf(r)] = api.bondLevelRowSignature(r); });
check('はじめは全員が送る対象', api.bondLevelRowsToSync(rows, {}).length === 2);
check('前に送った内容と同じなら何も送らない', api.bondLevelRowsToSync(rows, sent).length === 0);
const grown = api.bondLevelRowsFromMasuMons('あいな', 'Mocchi',
  [{ ...masuMons[0], bondXp: 125 }, masuMons[1]], 'gold', 'bid-1');
const diff = api.bondLevelRowsToSync(grown, sent);
check('育てた1体だけが送る対象になる(絆経験値が動けば絆Lvが同じでも送る)',
  diff.length === 1 && diff[0].individual_id === 'm1', diff.map(r => r.individual_id).join(','));
const renamed = api.bondLevelRowsFromMasuMons('あいな2', 'Mocchi', masuMons, 'gold', 'bid-1');
check('名前を変えたら(主キーが変わるので)全員送り直す', api.bondLevelRowsToSync(renamed, sent).length === 2);
const reframed = api.bondLevelRowsFromMasuMons('あいな', 'Mocchi', masuMons, 'silver', 'bid-1');
check('フレームを変えたら全員送り直す', api.bondLevelRowsToSync(reframed, sent).length === 2);

// 保存した指紋が壊れていても落ちない
check('保存キーは新しいキー(mh_bond_live_sync_v1)', api.BOND_LIVE_SYNC_KEY === 'mh_bond_live_sync_v1');
const bad = [null, undefined, 'x', 3, [], { sent: [] }, { sent: 'x' }, { sent: { a: 1, b: 'ok' } }];
const normalized = bad.map(v => api.normalizeBondLiveSync(v));
check('壊れた保存値は空から数え直す', normalized.slice(0, 7).every(n => n.version === 1 && Object.keys(n.sent).length === 0));
check('文字列でない指紋だけを捨てる', JSON.stringify(normalized[7].sent) === JSON.stringify({ b: 'ok' }));

// ---- 4. 画面側の送り方 ----
const syncStart = appSrc.indexOf('const syncBondLevelsLive');
const syncEnd = appSrc.indexOf('const submitLocalScore', syncStart);
const syncSrc = syncStart >= 0 && syncEnd > syncStart ? appSrc.slice(syncStart, syncEnd) : '';
check('60-app.jsx に syncBondLevelsLive がある', Boolean(syncSrc));
check('送れなかったら指紋を覚えずに止める', /const ok = await sbUpsertBondLevels\(chunk\);\s*if \(!ok\) break;/.test(syncSrc));
check('指紋は送れたあとに保存する',
  syncSrc.indexOf('sbUpsertBondLevels(chunk)') >= 0
  && syncSrc.indexOf('sbUpsertBondLevels(chunk)') < syncSrc.indexOf('storeSet(BOND_LIVE_SYNC_KEY'));
check('周回の終わりと同じ関数で行を作る', /bondLevelRowsFromMasuMons\(/.test(syncSrc));
check('テーブルが無い環境では何もしない', /bondLevelsUnavailable\(\)/.test(syncSrc));
check('セーブデータの読み込みが終わるまで送らない(初期値の空一覧で動かない)',
  /useEffect\(\(\) => \{\s*if \(!dataLoaded\) return;[\s\S]{0,400}syncBondLevelsLive\(\)/.test(syncSrc));
check('マスモン・名前・アイコン・フレームの変化で動く',
  /\[dataLoaded, masuMons, breederName, breederIcon, profileFrameId, bondLiveSyncTick\]/.test(syncSrc));
check('送る間隔の下限を守る', /BOND_LIVE_SYNC_MIN_INTERVAL_MS/.test(syncSrc) && /BOND_LIVE_SYNC_DELAY_MS/.test(syncSrc));
check('周回の終わりの送信は残っている', /sbUpsertBondLevels\(bondRows\)/.test(appSrc));

if (failed) { console.log(`\nNG ${failed}件`); process.exit(1); }
console.log('\nすべてOK');
