#!/usr/bin/env node
// モンヒロビートの「みんなで対戦」(マルチ)の仕組みを、通信も実時間も使わずに動かして確かめる。
//
//   node tools/mode/rhythm-multi-check.js
//
// 【なぜ要るか】
// 対戦は、部屋主(ホスト)の端末が進行を決めて配り、ほかの人はそれに従う作り(サーバーを持たない)。
// 段の移り変わり・時間切れ・途中で抜けた人・演奏中の通信停止などは、画面を見ても壊れたことに気づきにくく、
// 実機で2〜5台そろえないと試せない。ここでは本物の RHYTHM_MULTI(77-screen-rhythm-multi.jsx)を、
//   ・偽の通信(同じ部屋の全員へ配る。自分にも返る = Supabase Realtime の broadcast self:true と同じ)
//   ・偽の時計(30秒の制限時間も一瞬で進める)
// の上で複数人ぶん動かし、決めごとを1つずつ確かめる。
// 仕様の正本: docs/spec/RHYTHM_MULTI.md
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PART = path.join(ROOT, 'monster-hero/src/parts/77-screen-rhythm-multi.jsx');
const source = fs.readFileSync(PART, 'utf8');
// 画面(React)より前の「部屋の状態と通信」だけを切り出して動かす
const cut = source.indexOf('const useRhythmMultiView');
if (cut < 0) { console.log('NG: RHYTHM_MULTI の部分を切り出せませんでした(useRhythmMultiView が見つからない)'); process.exit(1); }
const storeSource = source.slice(0, cut);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 偽の時計 ----
const clock = {
  now: 1_800_000_000_000,
  seq: 0,
  timers: new Map(),
  set(fn, ms, repeat) { const id = ++this.seq; this.timers.set(id, { fn, at: this.now + Math.max(0, ms || 0), ms: Math.max(1, ms || 0), repeat }); return id; },
  clear(id) { this.timers.delete(id); },
  // ms だけ時間を進め、そのあいだに来るタイマーを順に動かす
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of this.timers) if (t.at <= end && (!next || t.at < next[1].at || (t.at === next[1].at && id < next[0]))) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      this.now = Math.max(this.now, t.at);
      if (t.repeat) t.at += t.ms; else this.timers.delete(id);
      try { t.fn(); } catch (e) { console.log('NG: タイマーの中で例外', e && e.message); failed++; }
    }
    this.now = end;
  },
};

// ---- 偽の通信(Supabase Realtime の Phoenix のやりとりを、必要なぶんだけ真似る) ----
const hub = { sockets: new Set(), sent: new Map() };
class FakeSocket {
  constructor(url) {
    this.url = url; this.readyState = 0; this.topic = null; this.owner = FakeSocket.owner;
    hub.sockets.add(this);
    clock.set(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen && this.onopen(); } }, 0, false);
  }
  deliver(msg) { if (this.readyState !== 1) return; const data = JSON.stringify(msg); clock.set(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0, false); }
  send(data) {
    if (this.readyState !== 1) throw new Error('closed');
    const m = JSON.parse(data);
    if (m.event === 'phx_join') { this.topic = m.topic; this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } }); return; }
    if (m.event !== 'broadcast') return;
    const t = m.payload && m.payload.payload && m.payload.payload.t;
    const key = `${this.owner}:${t}`;
    hub.sent.set(key, (hub.sent.get(key) || 0) + 1);
    for (const s of hub.sockets) if (s.topic === m.topic) s.deliver({ topic: m.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: m.payload.payload } });
  }
  close() { this.readyState = 3; hub.sockets.delete(this); }
  // 通知なしに消える(電波が切れた・アプリを強制終了した)
  kill() { this.readyState = 3; hub.sockets.delete(this); }
}

const RANKS = [['M', 1000000], ['SS', 900000], ['S', 800000], ['A', 700000], ['B', 600000], ['C', 500000], ['D', 0]];
let clientSeq = 0;
// 1人ぶんの端末を作る(それぞれ別の RHYTHM_MULTI を持つ)
const makeClient = (name) => {
  const tag = `${name}#${++clientSeq}`;
  const saved = {};
  const sandbox = {
    console, Math, JSON, Object, Array, Number, String, Boolean, Promise, Set, Map, Error,
    Date: { now: () => clock.now },
    setTimeout: (fn, ms) => clock.set(fn, ms, false), clearTimeout: (id) => clock.clear(id),
    setInterval: (fn, ms) => clock.set(fn, ms, true), clearInterval: (id) => clock.clear(id),
    SUPABASE_URL: 'https://example.test', SUPABASE_KEY: 'test-key',
    WebSocket: class extends FakeSocket { constructor(url) { FakeSocket.owner = tag; super(url); } },
    storeGet: async (k, d) => (k in saved ? saved[k] : d), storeSet: async (k, v) => { saved[k] = v; },
    rhythmRankForScore: (score) => (RANKS.find(([, min]) => score >= min) || ['D'])[0],
    RHYTHM_LOOK_PRESETS: [{ id: 'LIGHT', values: { effectAmount: 'MINIMAL' } }],
  };
  vm.createContext(sandbox);
  vm.runInContext(`${storeSource}\n;globalThis.__api={M:RHYTHM_MULTI,team:rhythmMultiTeamResult,scale:rhythmMultiRewardScale,clean:rhythmMultiCleanMessage,code:rhythmMultiNormalizeCode,K:{SELECT:RHYTHM_MULTI_SELECT_MS,READY:RHYTHM_MULTI_READY_MS,GRACE:RHYTHM_MULTI_PLAY_GRACE_MS,SHUFFLE:RHYTHM_MULTI_SHUFFLE_MS,PUBLIC:RHYTHM_MULTI_PUBLIC_MATCH_WAIT_MS,PENALTY:RHYTHM_MULTI_PENALTY_KEY,MAX:RHYTHM_MULTI_ROOM_MAX}};`, sandbox, { filename: '77-screen-rhythm-multi.jsx' });
  const api = sandbox.__api;
  const starts = [];
  api.M.onStart((info) => starts.push(info));
  api.M.setCatalog(['songA', 'songB', 'songC'], { songA: 60000, songB: 90000, songC: 120000 });
  return { name, tag, ...api, starts, saved, socket: () => [...hub.sockets].find((s) => s.owner === tag && s.topic && s.topic.includes('mhb-room-')) };
};
const view = (c) => c.M.view();
const phaseOf = (c) => (view(c) ? view(c).room.phase : '-');
const phases = (cs) => cs.map(phaseOf).join(',');
const all = (cs, ph) => cs.every((c) => phaseOf(c) === ph);
const joinRoom = (cs, code, mode = 'private') => {
  cs.forEach((c, i) => { c.M.join(code, { name: c.name, level: 40, icon: '', frame: '', diff: 'NORMAL' }, mode); clock.advance(10 + i); });
  clock.advance(3000);
};
const leaveAll = (cs) => cs.forEach((c) => c.M.leave());

// 後から届く結果(Promise)を受け取るため、時計を進めたあとに一度だけ待つ
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
// ===== ① 人数ボーナス =====
{
  const c = makeClient('x');
  check('人数ボーナスは1人ごとに+50%(1人1倍〜5人3倍)', [1, 2, 3, 4, 5].map(c.scale).join(',') === '1,1.5,2,2.5,3');
  check('人数ボーナスは壊れた値・範囲外でも1〜3倍に収まる', c.scale(0) === 1 && c.scale(99) === 3 && c.scale('x') === 1 && c.scale(-3) === 1);
  check('部屋コードは使える文字の4文字だけを通す', c.code('ab2c') === 'AB2C' && c.code('ABC') === '' && c.code('IO01') === '' && c.code(null) === '');
}

// ===== ② 届いた知らせは作り直してから使う(壊れた値・知らない形は捨てる) =====
{
  const c = makeClient('x');
  check('知らない種類の知らせは捨てる', c.clean({ t: 'evil', id: 'a' }) === null && c.clean(null) === null && c.clean('str') === null);
  check('id の無い知らせは捨てる', c.clean({ t: 'hb' }) === null);
  const r = c.clean({ t: 'res', id: 'a', res: { startId: 'r1', score: 9e20, maxCombo: -5, j: ['1', 2, 'x'] } });
  check('スコアは上限で切り、負の数は0にする', r && r.res.score === 1e12 && r.res.maxCombo === 0);
  check('判定の数は6種類の数字にそろえる', r && Array.isArray(r.res.j) && r.res.j.length === 6 && r.res.j.join(',') === '1,2,0,0,0,0');
  const hb = c.clean({ t: 'hb', id: 'a', name: 'x'.repeat(40), mode: 'hack', room: { ph: 'boss', rd: 'r' } });
  check('名前は12文字まで・知らない部屋の種類はプライベート扱い・知らない段は捨てる', hb && hb.name.length === 12 && hb.mode === 'private' && hb.room === null);
  const chat = c.clean({ t: 'chat', id: 'a', cid: 'c1', text: '  ' });
  check('空のチャットは捨てる', chat === null);
}

// ===== ③ 通しの流れ: マッチング → 選曲 → シャッフル → 準備 → ライブ → 結果 → 次の選曲 =====
{
  const [h, a, b] = ['h', 'a', 'b'].map(makeClient);
  joinRoom([h, a, b], 'QQ7Z');
  check('入った直後は全員マッチング', all([h, a, b], 'matching'), phases([h, a, b]));
  check('部屋主はいちばん早く入った人で、全員の見え方が同じ', [h, a, b].every((c) => view(c).hostId === view(h).selfId));
  check('部屋主以外は「メンバー確定」できない', a.M.confirmMembers() === false);
  check('部屋主の「メンバー確定」で選曲へ', h.M.confirmMembers() === true && (clock.advance(2500), all([h, a, b], 'select')), phases([h, a, b]));
  const round = view(h).room.round;
  check('選曲の制限時間が全員に配られる(残り30秒前後)', [a, b].every((c) => Math.abs(view(c).room.left - c.K.SELECT / 1000) <= 3), [a, b].map((c) => view(c).room.left).join('/'));
  h.M.pick('songB'); a.M.pick('*'); b.M.pick('songB');
  clock.advance(3000);
  check('全員えらぶと抽選して準備の段へ(曲は選ばれた中から)', all([h, a, b], 'ready') && [h, a, b].every((c) => view(c).room.songId === 'songB'), `${phases([h, a, b])} ${view(a).room.songId}`);
  [h, a, b].forEach((c) => { c.M.setDiff('HARD'); c.M.ready(); });
  clock.advance(3000);
  check('全員の準備完了でライブ開始(全員に開始の合図・人数3)', all([h, a, b], 'playing') && [h, a, b].every((c) => c.starts.length === 1 && c.starts[0].count === 3 && c.starts[0].songId === 'songB'),
    [h, a, b].map((c) => c.starts.length).join(','));

  // ④ 演奏中は送らない・溜めておく
  hub.sent.clear();
  clock.advance(20000);
  const sentDuringPlay = [...hub.sent.entries()].filter(([k]) => [h, a, b].some((c) => k.startsWith(`${c.tag}:`)));
  check('演奏中は何も送らない(20秒で0件)', sentDuringPlay.length === 0, JSON.stringify(sentDuringPlay));
  check('ライブ中の人は抜けた扱いにならない', [h, a, b].every((c) => view(c).members.length === 3));

  a.M.reportResult(round, { score: 700000, cleared: true, maxCombo: 100, judgments: { MARVELOUS: 10, EXCELLENT: 1, GREAT: 0, GOOD: 0, BAD: 0, MISS: 2 }, fast: 3, slow: 1 }, false, { diffId: 'HARD' });
  clock.advance(1500);
  check('先に終わった人は、まだライブ中の人を待つ', phaseOf(a) === 'playing');
  b.M.reportResult(round, null, true, { diffId: 'HARD' });
  h.M.reportResult(round, { score: 900000, cleared: true, fullCombo: true, maxCombo: 200 }, false, { diffId: 'HARD' });
  clock.advance(3000);
  check('全員の結果がそろうと結果の段へ', all([h, a, b], 'result'), phases([h, a, b]));
  const v = view(a);
  const t = a.team(v.members, v.room.round, v.room.participants, true);
  check('チームの平均は、リタイアした人を0点として数える', t.average === Math.floor((900000 + 700000 + 0) / 3), String(t.average));
  check('MVPは最後まで演奏した人の最高スコア', t.mvpId === view(h).selfId);
  const hRow = t.rows.find((r) => r.m.id === view(h).selfId);
  check('フルコンボの印と判定の数が届く', hRow && hRow.res.fc === 1 && t.rows.find((r) => r.m.id === view(a).selfId).res.j.join(',') === '10,1,0,0,0,2');
  h.M.nextFromResult(round);
  clock.advance(2500);
  check('部屋主の「次へ」で同じメンバーのまま次の選曲へ(新しい回)', all([h, a, b], 'select') && view(a).room.round !== round);
  leaveAll([h, a, b]);
}

// ===== ⑤ 時間切れ: 選曲しなければおまかせ・準備しなければいまの難易度で準備完了(全員ライブに入る) =====
{
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'TT5Z');
  h.M.confirmMembers(); clock.advance(2500);
  clock.advance(h.K.SELECT + 2000);
  check('選曲の時間切れで抽選へ進む', all([h, a], 'ready'), phases([h, a]));
  clock.advance(h.K.SHUFFLE + h.K.READY + 5000);
  check('準備の時間切れでライブ開始(だれも押していなくても全員入る)', all([h, a], 'playing') && h.starts.length === 1 && a.starts.length === 1 && h.starts[0].count === 2,
    `${phases([h, a])} starts=${h.starts.length}/${a.starts.length}`);
  leaveAll([h, a]);
}

// ===== ⑥ ホストの「待たずに進む」 =====
{
  const [h, a, b] = ['h', 'a', 'b'].map(makeClient);
  joinRoom([h, a, b], 'AD7Z');
  check('部屋主以外は「待たずに進む」を使えない', a.M.hostAdvance() === false);
  check('マッチングを待たずに選曲へ', h.M.hostAdvance() === true && (clock.advance(2000), all([h, a, b], 'select')));
  check('選曲を締め切って準備へ', h.M.hostAdvance() === true && (clock.advance(2000), all([h, a, b], 'ready')));
  check('「すぐ開始」は準備していない人もいっしょに始める', h.M.hostAdvance() === true && (clock.advance(2000), all([h, a, b], 'playing')) && [h, a, b].every((c) => c.starts.length === 1 && c.starts[0].count === 3));
  leaveAll([h, a, b]);
}

// ===== ⑦ ライブ中に抜けた人がいても止まらない =====
{
  // 「抜けます」を送ってから抜けた(タブを閉じた・ルームを出た)
  const [h, a, b] = ['h', 'a', 'b'].map(makeClient);
  joinRoom([h, a, b], 'BY7Z');
  h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000);
  const round = view(h).room.round;
  b.M.leave();
  clock.advance(5000);
  h.M.reportResult(round, { score: 800000, cleared: true }, false); a.M.reportResult(round, { score: 600000, cleared: true }, false);
  clock.advance(3000);
  check('「抜けます」を送った人は、演奏が終わった時点で抜けたと分かり、結果へ進む', all([h, a], 'result') && view(h).members.length === 2, `${phases([h, a])} ${view(h).members.length}人`);
  leaveAll([h, a]);
}
{
  // 何も送らずに消えた(電波が切れた・強制終了)
  const [h, a, b] = ['h', 'a', 'b'].map(makeClient);
  joinRoom([h, a, b], 'KL7Z');
  h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000);
  const round = view(h).room.round;
  const song = view(h).room.songId;
  const songMs = { songA: 60000, songB: 90000, songC: 120000 }[song];
  b.socket().kill();
  h.M.reportResult(round, { score: 800000, cleared: true }, false); a.M.reportResult(round, { score: 600000, cleared: true }, false);
  clock.advance(3000);
  check('何も送らずに消えた人は、曲が終わるまではライブ中として待つ', phaseOf(h) === 'playing');
  clock.advance(songMs + h.K.GRACE);
  check('曲の長さ+ゆとりを過ぎると抜けた扱いになり、結果へ進む', all([h, a], 'result'), phases([h, a]));
  check('ゆとりは「曲が鳴るまでの準備+曲が終わってから10秒」(30秒より短い)', h.K.GRACE < 30000 && h.K.GRACE >= 10000, String(h.K.GRACE));
  leaveAll([h, a, b]);
}
{
  // 結果の「次へ」は、ライブ中の人がいても押せる(部屋主なら次の曲へ)
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'NX7Z');
  h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000);
  const round = view(h).room.round;
  h.M.reportResult(round, { score: 800000, cleared: true }, false);
  clock.advance(1000);
  h.M.nextFromResult(round);
  clock.advance(1500);
  check('部屋主は、ライブ中の人を待たずに次の選曲へ進める', phaseOf(h) === 'select');
  leaveAll([h, a]);
}

// ===== ⑧ 部屋主が抜けても、次の人が進行を引き継ぐ =====
{
  const [h, a, b] = ['h', 'a', 'b'].map(makeClient);
  joinRoom([h, a, b], 'HM7Z');
  h.M.confirmMembers(); clock.advance(2500);
  h.M.leave(); clock.advance(3000);
  check('部屋主が抜けると、次に早く入った人が部屋主になる', [a, b].every((c) => view(c).hostId === view(a).selfId));
  a.M.pick('songC'); b.M.pick('songC'); clock.advance(3000);
  check('引き継いだ部屋主が進行を続ける(選曲 → 準備)', all([a, b], 'ready') && view(b).room.songId === 'songC', phases([a, b]));
  leaveAll([a, b]);
}

// ===== ⑨ 開始の合図は部屋主からだけ受ける =====
{
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'FK7Z');
  a.socket().send(JSON.stringify({ topic: a.socket().topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: { t: 'start', id: view(a).selfId, round: 'fake', songId: 'songA', participants: [view(h).selfId, view(a).selfId] } } }));
  clock.advance(1000);
  check('部屋主以外が送った「開始」は無視する', h.starts.length === 0 && phaseOf(h) === 'matching');
  leaveAll([h, a]);
}

// ===== ⑩ 公開ルーム: しばらく待つと自動でメンバー確定・受付で部屋が見つかる・バラバラの部屋はまとまる =====
{
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'PB7Z', 'free');
  clock.advance(h.K.PUBLIC + 2000);
  check('フリールームは2人以上でしばらく出入りが無ければ自動でメンバー確定', all([h, a], 'select'), phases([h, a]));
  leaveAll([h, a]);
}
{
  const host = makeClient('h');
  host.M.join('LB7Z', { name: 'h', level: 40 }, 'free');
  clock.advance(5000);
  const seeker = makeClient('s');
  let found = 'pending';
  seeker.M.findRoom('free').then((code) => { found = code; });
  clock.advance(5000);
  await flush();
  check('受付を聞くと、空きのあるフリールームが見つかる', found === 'LB7Z', String(found));
  let foundVet = 'pending';
  seeker.M.findRoom('veteran').then((code) => { foundVet = code; });
  clock.advance(5000);
  await flush();
  check('ベテランの受付にはフリールームは出てこない', foundVet === null, String(foundVet));
  host.M.leave();
}
{
  const x = makeClient('x'); const y = makeClient('y');
  x.M.join('ZZ9Z', { name: 'x', level: 40 }, 'free');
  y.M.join('AA2A', { name: 'y', level: 40 }, 'free');
  clock.advance(15000);
  check('同時に作られた1人きりの部屋は、コードの小さい部屋へまとまる', view(x).code === 'AA2A' && view(x).members.length === 2 && view(y).members.length === 2, `${view(x).code} ${view(x).members.length}人`);
  leaveAll([x, y]);
}

{
  // 仲間がライブ中(何も送ってこない)で自分1人に見えても、ほかの部屋へ引っ越さない
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'MM8Z', 'free');
  const other = makeClient('o');
  other.M.join('AA3A', { name: 'o', level: 40 }, 'free');
  a.socket().kill();
  clock.advance(60000);
  check('最近ほかの人を見ていた部屋は、1人に見えてもほかの部屋へまとめない', view(h).code === 'MM8Z', view(h).code);
  leaveAll([h, a, other]);
}

// ===== ⑪ 途中でやめたときの入室待ち(公開ルームだけ。保存キーは専用の新しいもの) =====
{
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'PN7Z', 'free');
  h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000); h.M.hostAdvance(); clock.advance(2000);
  a.M.reportResult(view(a).room.round, null, true);
  check('公開ルームのライブを途中でやめると入室待ちが保存される', !!a.saved[a.K.PENALTY] && Number(a.saved[a.K.PENALTY].until) > clock.now);
  check('入室待ちの保存キーは mh_rhythm_multi_penalty_v1', a.K.PENALTY === 'mh_rhythm_multi_penalty_v1');
  leaveAll([h, a]);
  const [p, q] = ['p', 'q'].map(makeClient);
  joinRoom([p, q], 'PV7Z', 'private');
  p.M.hostAdvance(); clock.advance(2000); p.M.hostAdvance(); clock.advance(2000); p.M.hostAdvance(); clock.advance(2000);
  q.M.reportResult(view(q).room.round, null, true);
  check('プライベートルームでは入室待ちにしない', !(q.K.PENALTY in q.saved));
  leaveAll([p, q]);
}

// ===== ⑫ 満員とチャット =====
{
  const cs = ['a', 'b', 'c', 'd', 'e', 'f'].map(makeClient);
  joinRoom(cs, 'FL7Z');
  check(`部屋は${cs[0].K.MAX}人まで(6人目は満員と出る)`, view(cs[5]).full === true && cs.slice(0, 5).every((c) => view(c).full === false));
  leaveAll(cs);
}
{
  const [h, a] = ['h', 'a'].map(makeClient);
  joinRoom([h, a], 'CH7Z');
  check('チャットを送れる', h.M.sendChat('よろしく!') === true);
  check('続けての送信は間を空ける', h.M.sendChat('連投') === false);
  clock.advance(1000);
  check('届いたチャットは自分と相手の両方に1回ずつ出る', view(a).chat.length === 1 && view(h).chat.length === 1 && view(a).chat[0].text === 'よろしく!');
  for (let i = 0; i < 60; i += 1) { a.M.sendChat(`m${i}`); clock.advance(900); }
  check('チャットは直近50件だけ覚える', view(h).chat.length === 50);
  leaveAll([h, a]);
}

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
