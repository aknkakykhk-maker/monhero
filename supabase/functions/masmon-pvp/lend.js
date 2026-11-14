// モンヒロサクセス: フレンドからのレンタルのサーバの口(段取りの回5・2026-11-12 オトズレ)。core.js の handle から呼ぶ。
// 表と関数: supabase/migrations/202611120002_monsuc_lend.sql。設計: docs/progress/player-raise/PLAN.md §2「フレンドからのレンタル」
//   lend_set   … 自分の「貸し出しの子」を置く(置き直しも同じ)。持ち主の鍵は masmon_pvp_owners を使い回す
//   lend_clear … 貸し出しをやめる
//   lend_use   … フレンドの子を借りた(育成をはじめるときに1回)。フレンドどうしだけ・同じ人は続けて LEND_STREAK 回まで
//   lend_claim … 自分の子が借りられた回数を受け取る(名声は1日 LEND_FAME_DAILY_N 回ぶんまで)
// ★送られる中身は 6能力・種・名前・色・型・アシストだけ。ランクと効きは借りる側が6能力から出し直す(ここでも形と範囲だけ見る)
// ★記録に書くのは件数・エラーの種類だけ
export const LEND_STREAK = 2;            // 同じフレンドの子は続けて2回まで(PLAN §8 窓口の既定)
export const LEND_FAME_DAILY_N = 10;     // 仮。貸した側が名声をもらえるのは1日10回ぶんまで
export const LEND_FAME_EACH = 20;        // 仮。1回ごとの名声
export const LEND_STAT_MAX = 999;
export const LEND_ASSIST_MAX = 8;
// アシスト効果の表 monster-hero/data/monhero-success-assist.js(第3版・2026-11-14・71種類・目盛り1〜25)と同じ id と目盛りの上限
//   (tools/friends/monsuc-lend-check.js が表との食い違いを見張る。表を変えたらここも変えて配り直す)
//   1つは { id, lv } か { id, lv, n }。lv = 古い段(1〜5)か目盛り、n = 目盛り(第3版)。どちらも 1〜LEND_ASSIST_LV_MAX の整数
export const LEND_ASSIST_IDS = Object.freeze(['sokoji',  'kizuna',  'hirameki',  'ochitsuki',  'itawari',  'ninzu',  'trainlv',  'gyakkyo',  'hagemi',  'haru',  'natsu',  'aki',  'fuyu',  'ninkigreat',  'challenge',  'tsuika',  'kaifuku',  'atooshi',  'miharu',  'kibarashi',  'kunpow',  'kunwise',  'kunhit',  'kuneva',  'kuntough',  'kunlife',  'kaketsuke',  'shutsugen',  'shitashi',  'tagpow',  'hitonatsu',  'nakayoshi',  'shitsuke',  'shoki',  'ticket0',  'tairyoku',  'kuishinbo',  'trchance',  'shchance',  'gussuri',  'asobi',  'tsukisoi',  'genki',  'shugyo',  'shugyotoku',  'waza',  'chokyo',  'wazakazu',  'shugyohp',  'aptq',  'shokin',  'ikioi',  'ninki',  'kokoroe',  'ticket',  'rivaldamashii',  'event',  'peak',  'yobimizu',  'mejirushi',  'joshu',  'aidcome',  'aidtrain',  'aidluck',  'aidtrust',  'aidkeisho',  'gatsu',  'miseba',  'mitate',  'kensho',  'mimamori']);
export const LEND_ASSIST_LV_MAX = 25;
const LEND_STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const SPECIES_RE = /^[A-Za-z0-9_]{1,40}$/;
const COLORS_MAX = 400;                  // 色(染色)の写しの JSON の長さの上限

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

// 貸し出しの子の形を確かめる。返り値 { mon } か { error }
export const parseLend = (raw, catalog, nameProblem) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'shape' };
  if (typeof raw.species !== 'string' || !SPECIES_RE.test(raw.species) || !(catalog && catalog.species && catalog.species[raw.species])) return { error: 'species' };
  if (nameProblem(raw.name)) return { error: 'name' };
  if (raw.type != null && (!isInt(raw.type) || raw.type < 0 || raw.type > 5)) return { error: 'type' };
  const st = raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : null;
  if (!st) return { error: 'stats' };
  const stats = {};
  for (const k of LEND_STAT_KEYS) {
    if (!isInt(st[k]) || st[k] < 0 || st[k] > LEND_STAT_MAX) return { error: 'stats' };
    stats[k] = st[k];
  }
  const list = raw.assists == null ? [] : raw.assists;
  if (!Array.isArray(list) || list.length > LEND_ASSIST_MAX) return { error: 'assists' };
  const assists = [];
  const seen = new Set();
  for (const a of list) {
    if (!a || typeof a !== 'object' || !LEND_ASSIST_IDS.includes(a.id) || seen.has(a.id) || !isInt(a.lv) || a.lv < 1 || a.lv > LEND_ASSIST_LV_MAX) return { error: 'assists' };
    if (a.n != null && (!isInt(a.n) || a.n < 1 || a.n > LEND_ASSIST_LV_MAX)) return { error: 'assists' };
    seen.add(a.id);
    assists.push(a.n != null ? { id: a.id, lv: a.lv, n: a.n } : { id: a.id, lv: a.lv });
  }
  let colors = null;
  if (raw.colors != null) {
    let s = '';
    try { s = JSON.stringify(raw.colors); } catch (_) { return { error: 'colors' }; }
    if (typeof raw.colors !== 'object' || s.length > COLORS_MAX || /[<>]/.test(s)) return { error: 'colors' };
    colors = raw.colors;
  }
  const mon = { species: raw.species, name: raw.name.trim(), stats, assists };
  if (raw.type != null) mon.type = raw.type;
  if (colors) mon.colors = colors;
  return { mon };
};

// 1つの action を受ける。ownerOk・fail・okRes・nameProblem は core.js から渡してもらう(同じ決まりを使い回す)
export const handleLend = async ({ body, db, catalog, log, ownerOk, fail, okRes, nameProblem, ownerRe }) => {
  const { owner, key } = body;
  const who = await ownerOk(db, owner, key);
  if (who === 'bad') return fail(400, 'owner');
  if (who === 'locked') return fail(403, 'locked');
  switch (body.action) {
    case 'lend_set': {
      const parsed = parseLend(body.mon, catalog, nameProblem);
      if (parsed.error) return fail(400, 'mon', { detail: parsed.error });
      await db.lendUpsert({
        owner_id: owner, mon: parsed.mon,
        user_name: typeof body.name === 'string' ? body.name.slice(0, 40) : '',
        icon: typeof body.icon === 'string' ? body.icon.slice(0, 64) : null,
      });
      log({ step: 'lend_set', result: 'ok', assists: parsed.mon.assists.length });
      return okRes({ status: 'ok' });
    }
    case 'lend_clear': {
      await db.lendDeactivate(owner);
      log({ step: 'lend_clear' });
      return okRes({ status: 'ok' });
    }
    case 'lend_use': {
      const lender = body.lender;
      if (typeof lender !== 'string' || !ownerRe.test(lender)) return fail(400, 'lender');
      if (lender === owner) return fail(400, 'self');
      if (!(await db.areFriends(owner, lender))) return fail(403, 'not_friend');
      const row = await db.lendGet(lender);
      if (!row || !row.active) return fail(404, 'no_lend');
      const r = await db.lendUse(owner, lender, LEND_STREAK);
      if (!r || !r.ok) {
        log({ step: 'lend_use', result: (r && r.reason) || 'ng' });
        return fail(409, (r && r.reason) === 'streak' ? 'streak' : 'server');
      }
      log({ step: 'lend_use', result: 'ok' });
      return okRes({ status: 'ok', version: row.version });
    }
    case 'lend_claim': {
      const r = await db.lendClaim(owner, LEND_FAME_DAILY_N, LEND_FAME_EACH);
      const n = r && isInt(r.n) ? r.n : 0;
      const paid = r && isInt(r.paid) ? r.paid : 0;
      const fame = r && isInt(r.fame) ? r.fame : 0;
      log({ step: 'lend_claim', n, paid });
      return okRes({ n, paid, fame });
    }
    default: return fail(400, 'action');
  }
};
