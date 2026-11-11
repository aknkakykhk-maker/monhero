// フレンドの家で助手のマスモンをくわしく見せる(56-assistant-life-friend-masmon-share.jsx)の送る側・受け取りの形の検査。
// 本物のサーバーへはつながない。PostgREST の upsert を真似た小さな偽の alfRequest を差しこむ。
//   ・公開の印が偽なら1行も送らない
//   ・変わった助手の行だけ送る。同じ中身は送らない。10分あけるまで送り直さない。見せないへの切り替えは待たない
//   ・表が無ければ、それ以後は送らない・読まない
//   ・受け取りは型を確かめ、知らないモンスター・カード・連絡先のような文・壊れた値を捨てる。古い形(項目の無い行)でも落ちない
//   ・大きさは表の決まり(5000字)の内側
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero/src/parts/56-assistant-life-friend-masmon-share.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const make = ({ flag = true, missing = false, team = null, decks = true } = {}) => {
  const rows = {}; const posts = []; const store = {};
  const sb = {
    console, Date, Math, JSON, Object, Array, Number, String, Set,
    RELEASE_FLAGS: { alfMasmonShareSend: flag },
    ALL_PLAYER_MONSTERS: { Golem: { name: 'ゴーレム' }, Melody: { name: 'メロディ' }, KenshiMocchi: { name: 'ケンシモッチー' } },
    ALF_IDS: ['mua', 'kiki'],
    ALF_COLOR_RE: /^([a-z][a-z0-9_]{0,20}|custom:\d{1,3}:\d{1,3}:\d{1,3})(@(100|[1-9][0-9]))?$/,
    alfSafeOther: (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : null),
    alfInt: (v, lo, hi, d = 0) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; },
    alfNoteShow: (t) => (/\d{3,}|@|http/.test(t) ? '' : t),
    alfSig: (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); },
    storeGet: async (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    storeSet: async (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    alfRequest: async (url, opt = {}) => {
      if (missing) { const e = new Error('missing'); e.missing = true; throw e; }
      if (opt.method === 'POST') {
        posts.push(opt.body);
        if (JSON.stringify(opt.body.body).length > 5000) throw new Error('size');
        rows[`${opt.body.breeder_id}|${opt.body.assistant_id}`] = opt.body.body; return null;
      }
      const m = /breeder_id=eq\.([^&]+)&assistant_id=eq\.([a-z]+)/.exec(url);
      const r = m && rows[`${decodeURIComponent(m[1])}|${m[2]}`];
      return r ? [{ body: r, updated_at: '2026-11-12T00:00:00Z' }] : [];
    },
    assistantLifeMasmonShareOf: (aid) => ({ list: team ? team(aid) : [
      { monster: 'KenshiMocchi', nick: 'もち隊長', colors: ['red@90', 'black@73', null, 'bad color!', null, 'x'], lead: true, slot: 1, lv: 24, grow: 'すばやさ型', growMine: '回避を伸ばす', stats: { life: 312, pow: 240, wise: 178, hit: 351, eva: 402, tough: 205 }, why: '剣を持ったモッチーがかっこかわいい' },
      { monster: 'Golem', nick: 'ごろべえ', colors: [], slot: 2, lv: 19, grow: '攻撃型', stats: { life: 1, pow: 2, wise: 3, hit: 4, eva: 5, tough: 6 }, why: '連絡は090123456へ' },
      { monster: 'NotAMonster', nick: 'x' },
    ], waiting: 2 }),
    cardAssistantDeckShareOf: decks ? (aid, face) => ({ name: `${face}のデッキ`, line: '今日はこれで攻めたい気分！', monsters: ['KenshiMocchi', 'Golem', 'Nope'], ace: 'まわしぎり',
      cards: [...Array.from({ length: 25 }, (_, i) => [`card_${i}`, 2]), ['<bad>', 3]] }) : undefined,
  };
  vm.createContext(sb);
  vm.runInContext(`${source}\n;Object.assign(globalThis, { alfMsPublish, alfMsFetch, alfMsNormalize, alfMsBuild });`, sb);
  return { sb, rows, posts, store };
};

(async () => {
  // 印が偽
  {
    const { sb, posts } = make({ flag: false });
    const n = await sb.alfMsPublish('me1', ['mua', 'kiki'], true, 1000);
    check('公開の印が偽なら1行も送らない', n === 0 && posts.length === 0);
  }
  // ふつうに送る → 同じ中身は送らない → 変わっても10分は待つ → 10分後に送る
  {
    const { sb, rows, posts, store } = make();
    const t0 = 10 * 60 * 1000 * 100;
    const n1 = await sb.alfMsPublish('me1', ['mua', 'kiki', 'nobody'], true, t0);
    check('迎えた助手の行だけ送る(知らない助手は送らない)', n1 === 2 && posts.length === 2 && posts.every(p => ['mua', 'kiki'].includes(p.assistant_id)));
    const body = rows['me1|mua'];
    check('大きさは表の決まりの内側', JSON.stringify(body).length <= 5000, String(JSON.stringify(body).length));
    check('知らないモンスターは送らない', body.ms.length === 2 && body.ms.every(t => t.mo !== 'NotAMonster'));
    check('連絡先のような理由は送らない', !body.ms[1].w && body.ms[0].w === '剣を持ったモッチーがかっこかわいい');
    check('6つの能力は決まった順の数字', JSON.stringify(body.ms[0].st) === JSON.stringify([312, 240, 178, 351, 402, 205]));
    check('デッキは3つ・3体は実装済みだけ・壊れたカードidは捨てる', body.dk.length === 3 && body.dk[0].m.length === 2 && body.dk[0].cd.every(c => c[0] !== '<bad>'));
    check('送った指紋を新しいキーに残す', store.mh_alf_masmon_share_sent_v1 && store.mh_alf_masmon_share_sent_v1.sig.mua);
    const n2 = await sb.alfMsPublish('me1', ['mua', 'kiki'], true, t0 + 60000);
    check('同じ中身は送り直さない', n2 === 0);
    sb.assistantLifeMasmonShareOf = () => ({ list: [{ monster: 'Golem', nick: 'ごろべえ', lv: 20 }], waiting: 0 });
    const n3 = await sb.alfMsPublish('me1', ['mua'], true, t0 + 5 * 60000);
    check('変わっても10分あけるまでは送らない', n3 === 0);
    const n4 = await sb.alfMsPublish('me1', ['mua'], true, t0 + 11 * 60000);
    check('10分あければ変わった行を送る', n4 === 1 && rows['me1|mua'].ms[0].lv === 20);
    const n5 = await sb.alfMsPublish('me1', ['mua'], false, t0 + 12 * 60000);
    check('見せないに切り替えたら待たずに off で上書き(消さない)', n5 === 1 && rows['me1|mua'].off === 1 && rows['me1|kiki'] && !rows['me1|kiki'].off);
    const back = await sb.alfMsPublish('me1', ['mua'], true, t0 + 13 * 60000);
    check('見せるに戻したら待たずに送り直す', back === 1 && !rows['me1|mua'].off);
    // 次の起動(指紋はキーから読む)
    const again = make(); Object.assign(again.store, store);
    sb.assistantLifeMasmonShareOf = undefined;
    check('次の起動でも同じ中身は送らない(新しいキーを読む)', (await again.sb.alfMsPublish('me1', ['kiki'], true, t0 + 20 * 60000)) === 0);
    // 読む
    const got = await sb.alfMsFetch('me1', 'kiki');
    check('読む: 1人の助手の行を受け取りの形で返す', got && got.ms.length === 2 && got.ms[0].stats.eva === 402 && got.dk.length === 3 && got.wt === 2);
    check('読む: 行が無ければ null', (await sb.alfMsFetch('other', 'kiki')) === null);
    check('読む: ありえない助手・IDは読まない', (await sb.alfMsFetch('me1', 'zzz')) === null && (await sb.alfMsFetch('../x', 'mua')) === null);
  }
  // 表が無い
  {
    const { sb, posts } = make({ missing: true });
    check('表が無ければ送れず、落ちない', (await sb.alfMsPublish('me1', ['mua'], true, 1e9)) === 0 && posts.length === 0);
    check('表が無いと分かったら、それ以後は読まない', (await sb.alfMsFetch('me1', 'mua')) === null);
  }
  // 口が無い(キズナ・ツナグの口がまだ)→ 今ある口だけで送る
  {
    const { sb, rows } = make({ decks: false });
    sb.assistantLifeMasmonShareOf = undefined;
    sb.assistantLifeMasmonTeamOf = () => [{ monster: 'Melody', nick: 'メロちゃん', colors: ['pink@73'], lead: true }];
    await sb.alfMsPublish('me1', ['mua'], true, 1e9);
    check('口が無くても種類・名前・色・勇者だけ送る', rows['me1|mua'] && rows['me1|mua'].ms[0].mo === 'Melody' && !rows['me1|mua'].dk);
  }
  // 受け取りの見張り
  {
    const { sb } = make();
    const n = sb.alfMsNormalize;
    check('壊れた中身は null', n(null) === null && n([]) === null && n('x') === null);
    check('古い形(項目の無い行)でも空の一覧', JSON.stringify(n({ v: 1 })) === JSON.stringify({ off: false, ms: [], dk: [], wt: 0 }));
    check('見せていない人は off', n({ v: 1, off: 1 }).off === true);
    const odd = n({ ms: [{ mo: 'Golem', n: '<b>ごろ</b>', st: [1, 2, 3], lv: -5, c: ['javascript:x', 'red'] }, { mo: 'Zzz' }, 'x'], dk: [{ f: 'evil', cd: [['a', 1]] }, { f: 'oshi', cd: [] }, { f: 'suki', cd: [['ok_1', 999]], m: ['Golem', 'Zzz'] }], wt: 999 });
    check('受け取り: 知らないモンスターを捨て、能力の数が合わなければ出さない', odd.ms.length === 1 && odd.ms[0].stats === null && odd.ms[0].lv === 1);
    check('受け取り: 名前の < > を除く・色は決まった形だけ', !/[<>]/.test(odd.ms[0].nick) && odd.ms[0].colors[0] === null && odd.ms[0].colors[1] === 'red');
    check('受け取り: 知らない型・空のデッキは捨て、枚数と数は丸める', odd.dk.length === 1 && odd.dk[0].face === 'suki' && odd.dk[0].cards[0][1] === 50 && odd.dk[0].monsters.length === 1 && odd.wt === 20);
  }
  // 大きすぎる中身は表の決まりの内側に収める
  {
    const big = Array.from({ length: 8 }, (_, i) => ({ monster: 'Golem', nick: 'ながいなまえながいなまえながい', colors: ['red@90', 'red@90', 'red@90', 'red@90', 'red@90'], lead: i === 0, slot: i, lv: 99, grow: 'すばやさ型すばやさ型', growMine: '回避を伸ばす回避を伸ばす', stats: { life: 9999, pow: 9999, wise: 9999, hit: 9999, eva: 9999, tough: 9999 }, why: 'あ'.repeat(40) }));
    const { sb, rows } = make({ team: () => big });
    sb.cardAssistantDeckShareOf = (aid, f) => ({ name: 'な'.repeat(24), line: 'い'.repeat(40), monsters: ['Golem', 'Golem', 'Golem'], ace: 'わ'.repeat(20), cards: Array.from({ length: 50 }, (_, i) => [`card_long_id_${i}_abcdefgh`, 1]) });
    await sb.alfMsPublish('me1', ['mua'], true, 1e9);
    const b = rows['me1|mua'];
    check('いちばん大きい中身でも5000字の内側(デッキから減らす)', b && JSON.stringify(b).length <= 4800 && b.ms.length >= 5, b ? String(JSON.stringify(b).length) : 'no row');
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
