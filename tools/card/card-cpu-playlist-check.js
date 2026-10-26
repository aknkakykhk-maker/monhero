// MFバトルカードの「助手と対戦の曲の並び」(2026-10-26 社長の依頼)を、ブラウザなしで確かめる。
//
//   node tools/card/card-cpu-playlist-check.js
//
// 【なぜ要るか】
// 助手ごとに1〜5曲を選び、対戦中は全部を1回ずつシャッフルで流す。並びの決まり(周の境目で同じ曲が続かない・
// 2曲なら交互・1曲なら繰り返し・止めたら遅れて来た知らせで進まない・読めない曲は飛ばす)は音を聞かないと
// 気づきにくいので、流す係(82 の cardPlaylistPlayer)を偽の音の出口につないで、知らせを順に送って見る。
// 保存(mh_card_cpu_playlist_v1)の読み方は、壊れた値・知らない曲・同じ曲・6曲目からを落とすか見る。
//
// 【見るもの】
// ① 保存の読み方(cardNormalizeCpuPlaylist): 無い・壊れている・知らない助手・知らない曲・同じ曲・6曲目から・0曲
// ② 1曲は繰り返し(1回だけの印を付けない) / 2曲は交互 / 3〜5曲は1周で全部1回・周の境目で同じ曲が続かない
// ③ 対戦を始め直すと順を作り直す・前の曲を1曲目にしない / 止めたあと・始め直したあとの古い知らせでは進まない
// ④ 読めない曲は飛ばす・全部だめなら止める(何度も読み直さない) / 先に読むのは次の1曲だけ
// ⑤ 画面と音の側のつなぎ(84 は前の1曲えらびを使わない・前の保存は書き換えない / 14-audio は流れ終わったときだけ次へ)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const PARTS = path.join(GAME, 'src', 'parts');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const core = fs.readFileSync(path.join(PARTS, '82-card-battle-core.jsx'), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${core}\n;globalThis.__p = { CARD_SAVE_KEYS, CARD_PLAYLIST_MAX, CARD_CPU_PLAYLIST_DEFAULT, cardNormalizeCpuPlaylist, cardShufflePlaylist, cardPlaylistPlayer, normalizeCardBgm };`, ctx, { filename: '82-card-battle-core.jsx' });
const P = ctx.__p;
const plain = (v) => JSON.parse(JSON.stringify(v));
const WHO = ['mua', 'kiki', 'momosuke', 'kyuko', 'dra', 'atsu'];
const TRACKS = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 'melo_toriko', 'eiki_boss', 'melo_crossing_field', 'melo_toward_the_stars_short', 'melo_mou_hitotsu_no_sekai_e', 'melo_against_my_own_shadow'];
const isTrack = (id) => TRACKS.includes(id);
const seeded = (k) => () => ((k = (k * 9301 + 49297) % 233280) / 233280);

// ① 保存の読み方
check('保存先は新しいキー mh_card_cpu_playlist_v1 で、前の mh_card_bgm_v1 はそのまま', P.CARD_SAVE_KEYS.cpuPlaylist === 'mh_card_cpu_playlist_v1' && P.CARD_SAVE_KEYS.bgm === 'mh_card_bgm_v1');
const def = plain(P.cardNormalizeCpuPlaylist(null, isTrack));
check('無いときは助手ごとの曲1つ(台帳 #3438 の曲)', def.v === 1 && WHO.every((w) => def.assistants[w].length === 1)
  && def.assistants.mua[0] === 'melo_toriko' && def.assistants.kiki[0] === 'eiki_boss' && def.assistants.momosuke[0] === 'melo_crossing_field'
  && def.assistants.kyuko[0] === 'melo_toward_the_stars_short' && def.assistants.dra[0] === 'melo_mou_hitotsu_no_sekai_e' && def.assistants.atsu[0] === 'melo_against_my_own_shadow', JSON.stringify(def));
const broken = ['x', 3, [], { assistants: 'x' }, { assistants: [] }, { v: 1, assistants: { mua: 'melo_toriko' } }];
check('壊れた値は既定に戻る', broken.every((b) => JSON.stringify(plain(P.cardNormalizeCpuPlaylist(b, isTrack))) === JSON.stringify(def)));
const raw = { v: 1, assistants: { mua: ['t1', 'nope', 't1', 't2', 7, null, 't3', 't4', 't5', 't6'], kiki: ['nope'], momosuke: [], ghost: ['t1'], dra: ['t2', 't1'] } };
const rawCopy = JSON.stringify(raw);
const n1 = plain(P.cardNormalizeCpuPlaylist(raw, isTrack));
check('知らない曲・同じ曲の2つ目・曲でない値を落とし、6曲目からは入れない', JSON.stringify(n1.assistants.mua) === JSON.stringify(['t1', 't2', 't3', 't4', 't5']), JSON.stringify(n1.assistants.mua));
check('0曲になった助手は、その助手のはじめの曲に戻る', n1.assistants.kiki[0] === 'eiki_boss' && n1.assistants.kiki.length === 1 && n1.assistants.momosuke[0] === 'melo_crossing_field');
check('知らない助手は捨て、書いていない助手ははじめの曲', !('ghost' in n1.assistants) && n1.assistants.atsu[0] === 'melo_against_my_own_shadow' && JSON.stringify(n1.assistants.dra) === '["t2","t1"]');
check('読むだけでは元の値を書き換えない', JSON.stringify(raw) === rawCopy);
check('入れられるのは5曲まで', P.CARD_PLAYLIST_MAX === 5);
const oldBgm = { top: 'atsu_cup_theme', cpu: 'melo_toriko', pvp: 'ichika_battle' };
check('前の1曲えらび(mh_card_bgm_v1 の cpu)は読み方を変えていない(値はそのまま残る)', plain(P.normalizeCardBgm(oldBgm, isTrack)).cpu === 'melo_toriko');

// ② ③ ④ 流す係を偽の出口につなぐ
const harness = (rnd) => {
  const log = { plays: [], preloads: [], silence: 0, once: null };
  const io = {
    setOnce: (key, h) => { log.once = key ? { key, ...h } : null; },
    play: (key) => log.plays.push(key),
    preload: (key) => log.preloads.push(key),
    silence: () => { log.silence += 1; },
  };
  return { log, player: P.cardPlaylistPlayer(io, rnd) };
};
// 1曲
{
  const { log, player } = harness(seeded(1));
  player.start(['t1']);
  check('1曲なら、そのままふつうに鳴らす(1回だけの印を付けない=繰り返す)', log.plays.join() === 't1' && log.once === null && !player.active());
}
// 2曲
{
  const { log, player } = harness(seeded(2));
  player.start(['t1', 't2']);
  for (let i = 0; i < 9; i++) log.once.onEnd();
  const pairs = log.plays.slice(1).every((k, i) => k !== log.plays[i]);
  check('2曲なら交互に流れる(10曲ぶん)', log.plays.length === 10 && pairs, log.plays.join(' '));
}
// 3〜5曲
for (const n of [3, 4, 5]) {
  let ok = true; let boundary = true; let detail = '';
  for (let seed = 1; seed <= 40; seed++) {
    const list = TRACKS.slice(0, n);
    const { log, player } = harness(seeded(seed * 7 + n));
    player.start(list);
    for (let i = 0; i < n * 6 - 1; i++) log.once.onEnd();
    for (let r = 0; r < 6; r++) {
      const round = log.plays.slice(r * n, r * n + n);
      if (new Set(round).size !== n || !round.every((k) => list.includes(k))) { ok = false; detail = `周${r + 1}: ${round.join(' ')}`; }
      if (r > 0 && log.plays[r * n] === log.plays[r * n - 1]) { boundary = false; detail = `周${r + 1}の境目: ${log.plays.join(' ')}`; }
    }
  }
  check(`${n}曲: 1周で全部が1回ずつ流れる(40通り×6周)`, ok, detail);
  check(`${n}曲: 周の境目で同じ曲が続かない`, boundary, detail);
}
// 始め直し
{
  const firsts = new Set();
  const orders = new Set();
  let avoidOk = true;
  const rnd = seeded(99);
  for (let i = 0; i < 30; i++) {
    const { log, player } = harness(rnd);
    player.start(['t1', 't2', 't3', 't4'], 't2');
    firsts.add(log.plays[0]);
    if (log.plays[0] === 't2') avoidOk = false;
    for (let k = 0; k < 3; k++) log.once.onEnd();
    orders.add(log.plays.join());
  }
  check('対戦を始めるたびに順を作り直す(30回で違う順が出る)', orders.size >= 5, `${orders.size}通り`);
  check('始め直したとき、いま鳴っている曲を1曲目にしない', avoidOk && !firsts.has('t2'), [...firsts].join());
}
// 止めたあと・始め直したあとの古い知らせ
{
  const { log, player } = harness(seeded(5));
  player.start(['t1', 't2', 't3']);
  const old = log.once;
  player.stop();
  const before = log.plays.length;
  old.onEnd(); old.onFail();
  check('止めたあとに古い「流れ終わった」「読めなかった」が来ても進まない', log.plays.length === before && log.once === null && log.silence === 0 && !player.active());
  player.start(['t4', 't5']);
  const stale = old;
  const before2 = log.plays.length;
  stale.onEnd();
  check('新しい並びを始めたあと、前の並びの知らせでは進まない', log.plays.length === before2 && log.once && ['t4', 't5'].includes(log.once.key));
  player.start(['t6']);
  check('1曲にしたら前の並びの印を外す(ほかの曲・トップの曲にしたときと同じ)', log.once === null && !player.active() && log.plays[log.plays.length - 1] === 't6');
}
// 読めない曲
{
  const { log, player } = harness(seeded(8));
  player.start(['t1', 't2', 't3']);
  log.once.onFail();
  const afterFail = log.plays.length;
  check('読めない曲は飛ばして次へ進む', afterFail === 2 && log.plays[1] !== log.plays[0] && player.active());
  log.once.onEnd();
  log.once.onFail(); log.once.onFail();
  check('流れた曲があれば、読めなかった数は数え直す(続けて全部だめになるまで止めない)', player.active() && log.silence === 0);
  log.once.onFail();
  check('並びの曲が続けて全部読めなければ、並びをやめて BGM を止める(1回だけ・それ以上読み直さない)', !player.active() && log.silence === 1 && log.once === null, `${log.plays.length}回鳴らした`);
}
{
  const { log, player } = harness(seeded(3));
  player.start(['t1', 't2', 't3', 't4', 't5']);
  check('先に読むのは次の1曲だけ(5曲を一度に読まない)', log.preloads.length === 1 && log.preloads[0] !== log.plays[0], log.preloads.join());
  log.once.onEnd();
  check('次の曲へ進むたびに、その次の1曲だけ読む', log.preloads.length === 2 && log.preloads[1] !== log.plays[1]);
}

// ⑤ つなぎ
const screen = fs.readFileSync(path.join(PARTS, '84-screen-card-battle.jsx'), 'utf8');
const app = fs.readFileSync(path.join(PARTS, '60-app.jsx'), 'utf8');
const audio = fs.readFileSync(path.join(PARTS, '14-audio.jsx'), 'utf8');
check('助手と対戦は、助手ごとの曲の並びで始める(前の1曲えらびを使わない)', /onBgm\(cardCpuPlaylistOf\(save\.cpuPlaylist, pick\.who\)\)/.test(screen) && !/cardCpuBgm\(/.test(screen));
check('オプションに助手と対戦の1曲えらびの欄が無い(トップ画面・マルチ対戦の欄は残る)', /\[\['top', 'トップ画面'\], \['pvp', 'マルチ対戦'\]\]/.test(screen) && !/option value="auto"/.test(screen));
check('並びを直したときに書くのは新しいキーだけ(mh_card_bgm_v1 を書き換えない)', /persist\(\{ cpuPlaylist: cardNormalizeCpuPlaylist\(/.test(screen) && !/persist\(\{[^}]*bgm:[^}]*cpuPlaylist/.test(screen));
check('練習試合は、みゅあの曲のまま(並びにしない)', /onBgm\(CARD_AI_BGM\.mua\)/.test(screen));
check('助手ごとのはじめの曲は1か所(82)から作る', /const CARD_AI_BGM = Object\.freeze\(Object\.fromEntries\(Object\.entries\(CARD_CPU_PLAYLIST_DEFAULT\)/.test(screen));
check('オプションを閉じたら・画面を出たら試聴を止める', /if \(view !== 'options'\) \{ stopBgmPreview\(\)/.test(screen) && /stop:\(\)=>\{Audio_\.stopPreview\(\);setPreviewTrackId\(null\);\}/.test(app));
check('60-app: 並びを流す係につなぎ、対戦の画面を出たら止める', /onBgm=\{playCardBgm\}/.test(app) && /cardPlaylistPlayer\(\{/.test(app) && /if \(gameState !== 'CARD_BATTLE'\) stopCardPlaylist\(\)/.test(app));
check('14-audio: 止めるときは onended を外してから止める(流れ終わったときだけ次へ進む)', /const stopSource = \(source\) => \{ if \(source\) \{ try \{ source\.onended = null; source\.stop\(\);/.test(audio));
check('14-audio: 1回だけの曲は繰り返さず、ほかの曲を鳴らしたら印が外れる', /source\.loop = once \? false : track\.loop !== false/.test(audio) && /if \(bgmOnce && bgmOnce\.key !== track\.id\) bgmOnce = null;/.test(audio));
check('14-audio: 読めなかったと知らせるのは、その呼び出しが今も最新のときだけ', /request === bgmRequest && currentKey === track\.id\) \{ bgmOnce = null; try \{ o\.onFail/.test(audio));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
