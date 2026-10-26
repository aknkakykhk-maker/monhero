#!/usr/bin/env node
// MFバトルカードのランキングを、一人ひとりの ID(breeder_id)で数える形(2026-10-26 社長「ブリーダーIDで数える形に直す」)を確かめる。
// 90-card-rank.jsx の通信の部分を node の中で動かし、Supabase は偽物(fetch を差しかえ)にする。本物へはつながない。
//
//   node tools/card/card-rank-table-check.js
//
//   ① ID のある行は、新しい表 card_battle_ranks_v2 へ ?on_conflict=breeder_id で書く(古い表へは書かない)
//   ② 新しい表がまだ無い(SQL を流す前)なら、今までどおり古い表へ ?on_conflict=user_name で書く。以後は新しい表を探さない
//   ③ ID の無い行は古い表へ書く
//   ④ 読むときは2つの表を合わせ、同じ breeder_id は新しい表の行だけ出す(古い表の値が大きくても重ねない)
//   ⑤ 名前が同じでも ID がちがえば別の人として両方出す(前は名前で1行に上書きされていた)
//   ⑥ ID の無い古い行は、同じ名前の人が新しい表にいれば出さない(ID ができる前の同じ人)。いなければ出す
//   ⑦ 新しい表が無い環境では、古い表だけで今までどおり並ぶ。両方無ければ null(「準備中」)
//   ⑧ 古い表へは、読む(GET)以外の書き込みをしない(新しい表がある環境で)
//   ⑨ SQL は足すだけ(DROP・DELETE・TRUNCATE・ALTER TABLE public.card_battle_ranks を書いていない)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// 画面の部品(JSX)より前の、通信と計算の所だけ読む(戦績の表 CardBattleStatsPanel・ランキングの画面より前)
const rankAll = read('monster-hero/src/parts/90-card-rank.jsx');
const rankCut = ['// 戦績の表', '// ---- 画面: ランキング'].map((k) => rankAll.indexOf(k)).filter((i) => i > 0);
const rankSrc = rankAll.slice(0, Math.min(...rankCut));
const missingFn = (read('monster-hero/src/parts/26-supabase.jsx').match(/const _isMissingTableError = [\s\S]*?\n};\n/) || [''])[0];
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 偽の Supabase。tables … 表の名前 → 行の配列(無い表は undefined)
const makeEnv = (tables) => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const m = String(url).match(/\/rest\/v1\/([a-z0-9_]+)(\?.*)?$/);
    const table = m ? m[1] : '';
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ table, method, query: m ? m[2] || '' : '', body: init.body || '' });
    const reply = (status, body) => ({ ok: status < 300, status, statusText: '', text: async () => body });
    if (!(table in tables) || tables[table] === undefined) return reply(404, '{"code":"PGRST205","message":"Could not find the table"}');
    if (method === 'GET') return reply(200, JSON.stringify(tables[table]));
    return reply(201, '');
  };
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date, Promise, setTimeout, clearTimeout, AbortController, fetch,
    SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: {} });
  vm.runInContext(`${read('monster-hero/data/card-battle-cards.js')}\n;\n${read('monster-hero/src/parts/82-card-battle-core.jsx')}\n;\n${missingFn}\n${rankSrc}\n;\n`
    + 'this.E = { sbUpsertCardRank, sbFetchCardRanks, cardRanksUnavailable, cardWeekKeyJst };', ctx);
  return { E: ctx.E, calls };
};
const row = (o) => ({ user_name: 'あ', breeder_id: null, icon: '🐣', week_key: '2026-10-26', wins_easy: 0, wins_normal: 0, wins_hard: 0, wins_expert: 0, wins_master: 0,
  week_wins_easy: 0, week_wins_normal: 0, week_wins_hard: 0, week_wins_expert: 0, week_wins_master: 0, best_streak: 0, current_streak: 0, dex_count: 0, dex_total: 451, updated_at: '2026-10-26T00:00:00Z', ...o });
const q = { kind: 'wins', period: 'total', level: 'easy' };

(async () => {
  // ① ②③ 書き先
  {
    const { E, calls } = makeEnv({ card_battle_ranks: [], card_battle_ranks_v2: [] });
    await E.sbUpsertCardRank(row({ user_name: 'たろう', breeder_id: 'id-taro-0001', wins_easy: 3 }));
    const w = calls.filter((c) => c.method !== 'GET');
    check('① ID のある行は新しい表へ breeder_id で上書きする', w.length === 1 && w[0].table === 'card_battle_ranks_v2' && /on_conflict=breeder_id/.test(w[0].query), JSON.stringify(w.map((c) => c.table + c.query)));
    await E.sbUpsertCardRank(row({ user_name: 'IDなし' }));
    const w2 = calls.filter((c) => c.method !== 'GET').slice(1);
    check('③ ID の無い行は古い表へ名前で書く', w2.length === 1 && w2[0].table === 'card_battle_ranks' && /on_conflict=user_name/.test(w2[0].query), JSON.stringify(w2.map((c) => c.table + c.query)));
  }
  {
    const { E, calls } = makeEnv({ card_battle_ranks: [] });
    const ok = await E.sbUpsertCardRank(row({ user_name: 'たろう', breeder_id: 'id-taro-0001', wins_easy: 3 }));
    const w = calls.filter((c) => c.method !== 'GET');
    check('② 新しい表が無ければ、古い表へ名前で書く(書けた扱い)', ok === true && w.length === 2 && w[0].table === 'card_battle_ranks_v2' && w[1].table === 'card_battle_ranks' && /on_conflict=user_name/.test(w[1].query), JSON.stringify(w.map((c) => c.table)));
    await E.sbUpsertCardRank(row({ user_name: 'たろう', breeder_id: 'id-taro-0001', wins_easy: 4 }));
    const w2 = calls.filter((c) => c.method !== 'GET').slice(2);
    check('② 一度無いと分かったら、以後は新しい表を探さない', w2.length === 1 && w2[0].table === 'card_battle_ranks', JSON.stringify(w2.map((c) => c.table)));
  }
  // ④⑤⑥ 読むとき
  {
    const { E, calls } = makeEnv({
      card_battle_ranks_v2: [
        row({ user_name: 'たろう', breeder_id: 'id-taro-0001', wins_easy: 5, updated_at: '2026-10-26T10:00:00Z' }),
        row({ user_name: '名無しのブリーダー', breeder_id: 'id-nana-000A', wins_easy: 2 }),
        row({ user_name: 'はなこ', breeder_id: 'id-hana-0001', wins_easy: 1 }),
      ],
      card_battle_ranks: [
        row({ user_name: 'たろう(前の名前)', breeder_id: 'id-taro-0001', wins_easy: 9, updated_at: '2026-10-27T10:00:00Z' }), // 古い表の方が値も時刻も大きい
        row({ user_name: '名無しのブリーダー', breeder_id: 'id-nana-000B', wins_easy: 3 }), // 同じ名前の別の人
        row({ user_name: 'はなこ', breeder_id: null, wins_easy: 7 }),   // ID ができる前のはなこ
        row({ user_name: 'じろう', breeder_id: null, wins_easy: 4 }),   // ID ができる前で、まだ移っていない人
      ],
    });
    const list = await E.sbFetchCardRanks(q);
    const names = list.map((e) => `${e.userName}:${e.wins.easy}`);
    const taro = list.filter((e) => e.breederId === 'id-taro-0001');
    check('④ 同じ breeder_id は新しい表の行だけ出す', taro.length === 1 && taro[0].userName === 'たろう' && taro[0].wins.easy === 5, names.join(' / '));
    check('⑤ 名前が同じでも ID がちがえば別の人として両方出す', list.filter((e) => e.userName === '名無しのブリーダー').length === 2, names.join(' / '));
    check('⑥ ID の無い古い行は、同じ名前の人が新しい表にいれば出さない', !list.some((e) => e.userName === 'はなこ' && e.wins.easy === 7), names.join(' / '));
    check('⑥ 新しい表にいない人の古い行(ID なし)は出す', list.some((e) => e.userName === 'じろう'), names.join(' / '));
    check('④ 多い順に並ぶ', list.every((e, i) => i === 0 || list[i - 1].wins.easy >= e.wins.easy), names.join(' / '));
    check('⑧ 古い表へは GET 以外を送らない', !calls.some((c) => c.table === 'card_battle_ranks' && c.method !== 'GET'));
  }
  // ⑦ 表が片方・両方無い
  {
    const { E } = makeEnv({ card_battle_ranks: [row({ user_name: 'じろう', wins_easy: 4 })] });
    const list = await E.sbFetchCardRanks(q);
    check('⑦ 新しい表が無い環境では、古い表だけで並ぶ', Array.isArray(list) && list.length === 1 && list[0].userName === 'じろう');
    const { E: E2 } = makeEnv({});
    check('⑦ 両方無ければ null(準備中)', (await E2.sbFetchCardRanks(q)) === null && E2.cardRanksUnavailable() === true);
  }
  // ⑨ SQL は足すだけ
  {
    const sql = read('docs/sql/card-battle-ranks/CARD_BATTLE_RANKS_V2_APPLY.sql').split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    const bad = sql.match(/\b(drop\s+table|delete\s+from|truncate|alter\s+table\s+public\.card_battle_ranks\b(?!_v2)|update\s+public\.card_battle_ranks\b(?!_v2))/i);
    check('⑨ SQL は足すだけ(旧表を消す・変える文が無い)', !bad, bad ? bad[0] : '');
    check('⑨ SQL は件数を確かめてから commit する', /card_battle_ranks の件数が変化しました/.test(sql) && /\bcommit;/.test(sql));
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
