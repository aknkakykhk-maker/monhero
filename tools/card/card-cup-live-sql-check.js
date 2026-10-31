// MFバトルカード 個人杯のリアルタイム杯の SQL(docs/sql/card-cup/CARD_CUP_LIVE_APPLY.sql・2026-10-31 ブレイブくん)を確かめる。
//
//   node tools/card/card-cup-live-sql-check.js
//
//   A(いつも): 足すだけの SQL か(DELETE・DROP・ALTER・TRUNCATE が無い)。中の部品の関数は、ゲームから呼べない(anon・authenticated から外す)。
//              ゲームから呼ぶ5つだけに実行の権限がある
//   B(PostgreSQL が手元にあるときだけ): 使い捨てのデータベースを作り、②(CARD_CUP_APPLY.sql)と④を流して、筋書きどおりに進むか
//     B1 トーナメント5人: 早すぎる集合・主催以外の早い開始・全員そろわない開始は断る / 時刻を過ぎたらだれでも始められ、2回押しても同じ /
//        山は8の大きさで不戦勝3つ / 2台の答えが違えば「食い違い」で待ち、auto で決まる / 来ない相手とは absent ですぐ決まる /
//        片方だけ送って90秒たつと settle で leave / 順位は 1・2・3・3・5
//        どの試合も card_cup_match で見返せる(手の並びは1試合1回だけ書く。抜けた試合は待つあいだに残した手)
//     B2 総当たり4人: 1回戦だけ戦える → 終わると次の回戦が開く / 全部終わると順位(勝ち数 → 倒した数)
//   本物のデータベースには何もしない(流すのは手元に作った使い捨てのものだけ)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LIVE = fs.readFileSync(path.join(ROOT, 'docs/sql/card-cup/CARD_CUP_LIVE_APPLY.sql'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- A ----
const code = LIVE.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
check('A 足すだけ(DELETE・DROP・ALTER・TRUNCATE が無い)', !/\b(delete\s+from|drop\s+(table|function|index)|alter\s+table|truncate)\b/i.test(code));
const fns = [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1]);
const PUBLIC_FNS = ['card_cup_live_checkin', 'card_cup_live_start', 'card_cup_live_match', 'card_cup_live_report', 'card_cup_live_settle'];
check('A ゲームから呼ぶ5つがそろっている', PUBLIC_FNS.every((f) => fns.includes(f)), fns.join('・'));
const granted = [...code.matchAll(/grant execute on function public\.(\w+)\(/g)].map((m) => m[1]);
check('A 実行の権限はゲームから呼ぶ5つだけ', JSON.stringify(granted.slice().sort()) === JSON.stringify(PUBLIC_FNS.slice().sort()), granted.join('・'));
const inner = fns.filter((f) => !PUBLIC_FNS.includes(f));
check('A 中の部品は anon・authenticated から外す', inner.every((f) => new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`).test(code)), inner.join('・'));

// ---- B ----
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/17/bin'].find((d) => fs.existsSync(path.join(d, 'initdb')));
const canSu = pgBin && typeof process.getuid === 'function' && process.getuid() === 0 && spawnSync('id', ['postgres']).status === 0;
if (!pgBin || !canSu) {
  console.log('SKIP: B(PostgreSQL の使い捨てのデータベースを作れない環境。A だけ見た)');
} else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-cup-live-'));
  fs.chmodSync(dir, 0o777);
  const port = String(56000 + Math.floor(Math.random() * 900));
  const asPg = (cmd) => execFileSync('su', ['postgres', '-c', cmd], { stdio: 'pipe' });
  let started = false;
  try {
    asPg(`${pgBin}/initdb -D ${dir}/data -A trust`);
    asPg(`${pgBin}/pg_ctl -D ${dir}/data -o '-p ${port} -k ${dir}' -l ${dir}/log -w start`);
    started = true;
    const psql = (sql, file = null) => execFileSync('psql', ['-h', dir, '-p', port, '-U', 'postgres', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', ...(file ? ['-f', file] : ['-c', sql])], { encoding: 'utf8' }).trim();
    psql('create role anon; create role authenticated;');
    const share = fs.readFileSync(path.join(ROOT, 'docs/sql/card-deck-share/CARD_DECK_SHARE_APPLY.sql'), 'utf8');
    psql(share.slice(share.indexOf('create table if not exists public.card_deck_entries'), share.indexOf('\n);', share.indexOf('create table if not exists public.card_deck_entries')) + 3));
    psql(null, path.join(ROOT, 'docs/sql/card-cup/CARD_CUP_APPLY.sql'));
    psql(null, path.join(ROOT, 'docs/sql/card-cup/CARD_CUP_LIVE_APPLY.sql'));
    const K = (o) => `'k_${o}_xxxxxxxxxxxxxxxxxxxxxxxx'`;
    psql(`insert into card_deck_entries (owner_id, key_hash, user_name, deck) select 'p'||i, md5('k_p'||i||'_xxxxxxxxxxxxxxxxxxxxxxxx'), 'P'||i, '{"monsters":["C-001"]}'::jsonb from generate_series(1,8) i;`);
    const one = (sql) => psql(sql).split('\n')[0];

    // B1 トーナメント5人(p1 主催・p1〜p3 が来る)
    const cupK = JSON.parse(one(`select card_cup_create('p1',${K('p1')},'テスト杯','P1',null,'live','ko',8,true,null, date_trunc('hour', now()) + interval '2 hours')`)).id;
    for (let i = 2; i <= 5; i++) one(`select card_cup_join('${cupK}','p${i}',${K(`p${i}`)},'P${i}',null)`);
    check('B1 10分より前の集合は早い', one(`select card_cup_live_checkin('${cupK}','p1',${K('p1')})`) === 'early');
    psql(`update card_cups set entry_until = now() + interval '5 minutes', start_at = now() + interval '5 minutes' where id = '${cupK}'`);
    const cks = [1, 2, 3].map((i) => one(`select card_cup_live_checkin('${cupK}','p${i}',${K(`p${i}`)})`));
    check('B1 10分前からは集合できる', cks.every((x) => x === 'ok'), cks.join('・'));
    check('B1 鍵が違うと集合できない', one(`select card_cup_live_checkin('${cupK}','p2','wrongkeyxxxxxxxxxxxxxxxxxxxx')`) === 'none');
    check('B1 時刻の前は主催しか始められない', one(`select card_cup_live_start('${cupK}','p2',${K('p2')})`) === 'early');
    check('B1 全員そろうまでは主催も早くは始められない', one(`select card_cup_live_start('${cupK}','p1',${K('p1')})`) === 'wait');
    psql(`update card_cups set start_at = now() - interval '1 second', entry_until = now() - interval '1 second' where id = '${cupK}'`);
    // 1回戦が「来ている2人どうし」になる種(0.2)で始める
    const st = psql(`select setseed(0.2); select card_cup_live_start('${cupK}','p4',${K('p4')});`).split('\n').pop();
    check('B1 時刻を過ぎたら来ていない人でも始められる', st === 'ok', st);
    check('B1 もう一度押しても同じ(ok)', one(`select card_cup_live_start('${cupK}','p4',${K('p4')})`) === 'ok');
    const br = JSON.parse(one(`select bracket::text from card_cups where id='${cupK}'`));
    check('B1 山は8の大きさで不戦勝が3つ', br.rounds[0].length === 4 && br.rounds[0].filter((p) => p[1] === null).length === 3, JSON.stringify(br));
    const m0 = one(`select id||','||a_seat||','||b_seat from card_cup_matches where cup_id='${cupK}' and round=0`).split(',').map(Number);
    const ownerOf = (seat) => one(`select owner_id from card_cup_entries where cup_id='${cupK}' and seat=${seat}`);
    const [a0, b0] = [ownerOf(m0[1]), ownerOf(m0[2])];
    const third = ['p1', 'p2', 'p3'].find((o) => o !== a0 && o !== b0);
    check('B1 自分の試合には部屋の合言葉(8文字)が来る', /^[A-Z2-9]{8}$/.test(JSON.parse(one(`select card_cup_live_match(${m0[0]},'${a0}',${K(a0)})::text`)).room));
    check('B1 ほかの人の試合の合言葉は来ない', JSON.parse(one(`select card_cup_live_match(${m0[0]},'${third}',${K(third)})::text`)).room === null);
    const r1 = one(`select card_cup_live_report(${m0[0]},'${a0}',${K(a0)},0,'pvp',false,'{2,1}','[[0,{"type":"pass"}]]',6)`);
    const r2 = one(`select card_cup_live_report(${m0[0]},'${b0}',${K(b0)},1,'pvp',false,'{1,2}',null,6)`);
    check('B1 2台の答えが違うと決まらず待つ', r1 === 'wait' && r2 === 'wait', `${r1}・${r2}`);
    check('B1 試合に出ていない人は absent を送れない', one(`select card_cup_live_report(${m0[0]},'${third}',${K(third)},0,'absent',false,'{3,0}',null,6)`) === 'none');
    check('B1 食い違いは auto で決まる', one(`select card_cup_live_report(${m0[0]},'${third}',${K(third)},1,'auto',false,'{1,3}','[[1,{"type":"auto"}]]',6)`) === 'ok');
    check('B1 食い違いの試合の手の並びは auto の物', one(`select acts::text from card_cup_matches where id=${m0[0]}`).includes('auto'));
    check('B1 決まったあとの結果は done', one(`select card_cup_live_report(${m0[0]},'${a0}',${K(a0)},0,'pvp',true,'{3,0}',null,6)`) === 'done');
    const r1rows = psql(`select m.id, case when ea.checkin_at is not null then ea.owner_id else eb.owner_id end, case when ea.checkin_at is not null then 0 else 1 end
      from card_cup_matches m join card_cup_entries ea on ea.cup_id=m.cup_id and ea.seat=m.a_seat join card_cup_entries eb on eb.cup_id=m.cup_id and eb.seat=m.b_seat
      where m.cup_id='${cupK}' and m.round=1 order by m.slot`).split('\n').map((l) => l.split('|'));
    check('B1 2回戦が2試合できる', r1rows.length === 2, String(r1rows.length));
    const ab = r1rows.map(([id, who, w]) => one(`select card_cup_live_report(${id},'${who}',${K(who)},${w},'absent',false,'{3,1}','[]',6)`));
    check('B1 来ない相手とは absent ですぐ決まる', ab.every((x) => x === 'ok'), ab.join('・'));
    const fin = one(`select id||','||a_seat from card_cup_matches where cup_id='${cupK}' and round=2`).split(',');
    const fa = ownerOf(Number(fin[1]));
    check('B1 決勝で片方だけ送ると待つ', one(`select card_cup_live_report(${fin[0]},'${fa}',${K(fa)},0,'pvp',false,'{3,1}','[[0,{"type":"final"}]]',7)`) === 'wait');
    check('B1 90秒たつ前は settle で決まらない', one(`select card_cup_live_settle('${cupK}')`) === '0');
    psql(`update card_cup_matches set live = jsonb_set(live,'{rep_a,at}',to_jsonb(now() - interval '2 minutes')) where id=${fin[0]}`);
    check('B1 90秒たつと settle で leave として決まる', one(`select card_cup_live_settle('${cupK}')`) === '1' && one(`select decided from card_cup_matches where id=${fin[0]}`) === 'leave');
    check('B1 抜けた試合も、送った側の手の並びが残り見返せる(card_cup_match)', (() => { const r = JSON.parse(one(`select card_cup_match(${fin[0]})::text`) || 'null'); return r && JSON.stringify(r.acts).includes('final') && r.rules === 7 && r.a && r.a.deck && r.seed > 0; })());
    check('B1 2人とも来ない・来ない相手の試合も見返せる', psql(`select count(*) from card_cup_matches m where m.cup_id='${cupK}' and card_cup_match(m.id) is null`) === '0');
    const places = psql(`select place from card_cup_entries where cup_id='${cupK}' and not dropped order by place`).split('\n').join(',');
    check('B1 終わって順位は 1・2・3・3・5', one(`select status from card_cups where id='${cupK}'`) === 'done' && places === '1,2,3,3,5', places);

    // B2 総当たり4人(p6 主催)
    const cupR = JSON.parse(one(`select card_cup_create('p6',${K('p6')},'総当たり杯','P6',null,'live','rr',4,true,null, date_trunc('hour', now()) + interval '2 hours')`)).id;
    for (const o of ['p7', 'p8', 'p2']) one(`select card_cup_join('${cupR}','${o}',${K(o)},'${o}',null)`);
    psql(`update card_cups set start_at = now() - interval '1 second', entry_until = now() - interval '1 second' where id = '${cupR}'`);
    for (const o of ['p6', 'p7', 'p8', 'p2']) one(`select card_cup_live_checkin('${cupR}','${o}',${K(o)})`);
    check('B2 始められる', one(`select card_cup_live_start('${cupR}','p7',${K('p7')})`) === 'ok');
    const ready = () => psql(`select round||':'||bool_and((live->>'ready_at') is not null) from card_cup_matches where cup_id='${cupR}' group by round order by round`).split('\n').join(',');
    check('B2 はじめは1回戦だけ戦える(3回戦×2試合)', ready() === '0:true,1:false,2:false', ready());
    const playRound = (r, kos) => psql(`select card_cup_live_report(m.id, e.owner_id, 'k_'||e.owner_id||'_xxxxxxxxxxxxxxxxxxxxxxxx', 0, 'pvp', true, '${kos}', null, 6)
      from card_cup_matches m join card_cup_entries e on e.cup_id=m.cup_id and e.seat=m.a_seat where m.cup_id='${cupR}' and m.round=${r}`);
    playRound(0, '{3,1}');
    check('B2 1回戦が終わると2回戦が開く', ready() === '0:true,1:true,2:false', ready());
    playRound(1, '{3,2}');
    playRound(2, '{3,0}');
    const rr = psql(`select seat||':'||place||':'||wins from card_cup_entries where cup_id='${cupR}' order by place`).split('\n').join(',');
    check('B2 全部終わると順位(勝ち数 → 倒した数)', one(`select status from card_cups where id='${cupR}'`) === 'done' && rr === '0:1:2,2:2:2,1:3:2,3:4:0', rr);
  } catch (e) {
    check('B 筋書きが最後まで進む', false, String(e.stderr || e.message).slice(0, 400));
  } finally {
    if (started) { try { asPg(`${pgBin}/pg_ctl -D ${dir}/data -m immediate stop`); } catch (_) { /* 止まっていればよい */ } }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* 使い捨ての場所 */ }
  }
}
console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
