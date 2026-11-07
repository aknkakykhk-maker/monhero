#!/usr/bin/env node
// モンヒロビート「助手とのセッション」(助手をマルチの部屋に CPU として呼ぶ)の決めごとを、通信も画面も使わずに確かめる。
//
//   node tools/mode/rhythm-assistant-session-check.js
//
// 設計の正本: docs/progress/beat-assistant-session/PLAN.md(社長の決定 2026-11-07)。見るのは:
//   ・保存は新しいキー mh_rhythm_assistant_session_v1 だけ。壊れた保存でも既定値で読める・助手は性格を持たない
//   ・セッションLv はマスモンと同じ式(上限 Lv.100)。好きな曲 ×1.3・苦手な曲 ×1.5 の経験値。同じ回は2度数えない
//   ・好み度は -2〜+3。苦手な曲も一緒に遊ぶと少しずつ上がる
//   ・助手のスコアはマスモンの作り(rhythmBuddyPlay)を使い、満点を超えない
//   ・マスモンの控え(mh_rhythm_buddy_v1 の calls)に kind・assistantId を足しても、古い控えはマスモンとして読める(⑦)
//   ・公開の印(RELEASE_FLAGS.rhythmAssistantSession)が偽のあいだは、呼ぶシートに助手のタブを出さない
//   ・演奏の仕組み(判定・スコア・ランキング)には触れない: 助手の計算は 30-rhythm-play.jsx から呼ばれない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const BUDDY = P('33-rhythm-buddy.jsx');
const SESSION = P('33-rhythm-assistant-session.jsx');
const LINES = P('33-rhythm-assistant-session-lines.jsx');
const SCREEN = P('80-screen-rhythm-assistant-session.jsx');
const SHEET = P('80-screen-rhythm-buddy.jsx');
const MULTI = P('77-screen-rhythm-multi.jsx');
const PLAY = P('30-rhythm-play.jsx');
const FLAGS = P('17-release-changelog-login-missions.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const sb = { Math, Date, Object, Number, String, Array, JSON, console };
vm.createContext(sb);
vm.runInContext(`${BUDDY}\n${SESSION}\n;globalThis.__s={
  key:RHYTHM_ASSIST_SESSION_KEY, ids:RHYTHM_ASSIST_SESSION_IDS, norm:rhythmAssistSessionNormalize, mon:rhythmAssistSessionMon, level:rhythmAssistSessionLevel,
  like:rhythmAssistSessionLike, taste:rhythmAssistSessionTaste, mood:rhythmAssistSessionMood, expScale:rhythmAssistSessionExpScale,
  play:rhythmAssistSessionPlay, apply:rhythmAssistSessionApplyLive, choose:rhythmAssistSessionChooseSong, idOf:rhythmAssistSessionIdOf, keyOf:rhythmAssistSessionKey,
  TASTE:RHYTHM_ASSIST_SESSION_TASTE, enabled:rhythmAssistSessionEnabled,
  normCalls:rhythmBuddyNormalizeCalls, useFreeCall:rhythmBuddyUseFreeWithCall, settle:rhythmBuddySettleCall, buddyNorm:rhythmBuddyNormalize,
  levelInfo:rhythmBuddyLevelInfo, max:RHYTHM_BUDDY_LEVEL_MAX, buddyGain:rhythmBuddyExpGain, why:RHYTHM_BUDDY_PICK_WHY };`, sb);
const s = sb.__s;

// ---- 保存 ----
check('保存は新しいキー mh_rhythm_assistant_session_v1', s.key === 'mh_rhythm_assistant_session_v1');
check('助手は8人(みゅあ・きき・ももすけ・ドラ・あつ・きゅうこ・ソラシド・えるびん)', JSON.stringify(s.ids) === JSON.stringify(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']));
{
  const broken = [null, undefined, 'x', 3, [], { mons: 'x' }, { mons: { mua: { exp: 'zz', songs: [1], likes: [3], trait: 'brave' }, nobody: { exp: 99 } } }];
  const ok = broken.every((raw) => { try { const st = s.norm(raw); return st && typeof st.mons === 'object' && !st.mons.nobody && Object.values(st.mons).every((m) => m.exp >= 0 && m.trait === '' && typeof m.likes === 'object' && !Array.isArray(m.likes)); } catch (e) { return false; } });
  check('壊れた保存・知らない助手でも、既定値で読める(助手は性格を持たない)', ok);
  check('一度も呼んでいない助手は Lv.1', s.level(null, 'mua') === 1);
}
// ---- 好み ----
{
  check('好きな曲・苦手な曲は、どの助手も3曲と1曲', Object.values(s.TASTE).every((t) => t.like.length === 3 && t.dislike.length >= 1));
  check('みゅあはトリコが好き・Grievous Lady が苦手', s.taste('mua', 'toriko') === 'like' && s.taste('mua', 'grievous_lady') === 'dislike' && s.taste('mua', 'evans') === '');
  check('曲の別の版(短い版)も同じ曲として扱う', s.taste('kiki', 'kiki_issen_short') === 'like' && s.taste('erubin', 'crazy_party_night_full') === 'dislike');
  const empty = s.mon(null, 'mua');
  check('好み度は 好き=+3・苦手=-2・ふつう=0 から', s.like(empty, 'mua', 'toriko') === 3 && s.like(empty, 'mua', 'grievous_lady') === -2 && s.like(empty, 'mua', 'evans') === 0);
  const played = { ...empty, likes: { grievous_lady: 9, evans: 100 } };
  check('苦手な曲も一緒に遊ぶと少しずつ上がり、上限は +3', s.like(played, 'mua', 'grievous_lady') === 1 && s.like(played, 'mua', 'evans') === 3);
  check('好きな曲は ご機嫌(少し上がる・ブレ小)・苦手は 不機嫌(少し下がる・ブレ大)・ふつうは 普通', s.mood(3).id === 'good' && s.mood(-2).id === 'bad' && s.mood(0).id === 'normal' && s.mood(2).id === 'normal');
  check('経験値は 好き ×1.3・苦手 ×1.5・ふつう ×1', s.expScale(3) === 1.3 && s.expScale(-1) === 1.5 && s.expScale(0) === 1);
}
// ---- 育ち ----
{
  const base = { round: 'r1', songId: 'toriko', diffId: 'MASTER', durationMs: 120000, teamRank: 'S', dayKey: '2026-11-07', nowMs: Date.UTC(2026, 10, 7, 3), score: 900000, maxScore: 1000000, chartLevel: 26, humans: 1 };
  const r1 = s.apply(null, 'mua', base);
  const plain = s.buddyGain('MASTER', 'S', '', '');
  check('1ライブで経験値が入る(好きな曲は ×1.3)', !!r1.next && r1.gain === Math.round(plain * 1.3), `${r1.gain} / マスモンと同じ式の素の値 ${plain}`);
  const r2 = s.apply(r1.next, 'mua', base);
  check('同じ回(round)は2度数えない', r2.next === null && r2.gain === 0);
  const dis = s.apply(null, 'mua', { ...base, songId: 'grievous_lady', round: 'r2' });
  check('苦手な曲は経験値 ×1.5', dis.gain === Math.round(plain * 1.5), String(dis.gain));
  const nobody = s.apply(null, 'nobody', base);
  check('知らない助手は育てない', nobody.next === null);
  let st = null;
  for (let i = 0; i < 400; i += 1) { const r = s.apply(st, 'kiki', { ...base, songId: 'evans', round: `x${i}` }); st = r.next || st; }
  check('セッションLv の上限は Lv.100', s.level(st, 'kiki') === 100 && s.max === 100, `Lv.${s.level(st, 'kiki')}`);
  check('育てても、ほかの助手の育ちは変わらない', s.level(st, 'mua') === 1);
  check('助手は性格を持たない(育っても空のまま)', s.mon(st, 'kiki').trait === '');
  let st2 = null; let ups = 0;
  for (let i = 0; i < 9; i += 1) { const r = s.apply(st2, 'mua', { ...base, songId: 'grievous_lady', round: `g${i}` }); st2 = r.next; ups += r.likeUp; }
  check('苦手な曲を9回一緒に遊ぶと、好み度が -2 → +1(好きになった)', s.like(s.mon(st2, 'mua'), 'mua', 'grievous_lady') === 1 && ups === 3);
}
// ---- スコア ----
{
  const args = { state: null, assistantId: 'sorashido', songId: 'monster_hero', diffId: 'MASTER', totalNotes: 800, maxScore: 1000000, durationMs: 120000, chartLevel: 26, humans: 1, nowMs: Date.UTC(2026, 10, 7, 3) };
  const scores = []; for (let i = 0; i < 200; i += 1) scores.push(s.play({ ...args, rand: Math.random }).score);
  check('助手のスコアは満点を超えず、0 より大きい', scores.every((x) => x > 0 && x <= 1000000), `${Math.min(...scores)}〜${Math.max(...scores)}`);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const fixed = () => 0.5;
  const like = s.play({ ...args, rand: fixed }).score;
  const dis = s.play({ ...args, songId: 'kaze_ga_soyogu', rand: fixed }).score;
  const mid = s.play({ ...args, songId: 'evans', rand: fixed }).score;
  check('同じ条件なら、好きな曲 > ふつう > 苦手な曲', like > mid && mid > dis, `${like} / ${mid} / ${dis}`);
  check('目安: Lv.1・MASTER Lv.26・初めての曲はマスモンと同じくらい(55〜70万)', avg(scores) > 500000 && avg(scores) < 760000, String(Math.round(avg(scores))));
}
// ---- 選曲の候補 ----
{
  const cat = ['toriko', 'evans', 'grievous_lady', 'monster'];
  const r = s.choose(null, 'mua', cat, () => 0);
  check('好きな曲を候補に出しやすい(理由は「大好き」)', r.songId === 'toriko' && r.why === 'love' && typeof s.why.love === 'string');
  const n = s.choose(null, 'mua', [], () => 0);
  check('遊べる曲が無ければ選ばない', n.songId === '');
  const avoid = Array.from({ length: 50 }, (_, i) => s.choose(null, 'mua', ['grievous_lady', 'evans'], () => (i % 10) / 10 + 0.05).songId);
  check('苦手な曲は、ほかに曲があれば候補に出さない', avoid.every((id) => id === 'evans'));
}
// ---- 部屋の中の印 ----
check('部屋の中の印は as:<助手id>(マスモンの id と混ざらない)', s.keyOf('mua') === 'as:mua' && s.idOf('as:mua') === 'mua' && s.idOf('as:nobody') === '' && s.idOf('m123') === '' && s.idOf(null) === '');
// ---- 控え(マスモンと同じ財布) ----
{
  const old = s.normCalls([{ id: 'a', masuId: 'm1', paid: 'free', day: '2026-11-07', at: 1, load: 'L', started: false }]);
  check('古い控え(kind が無い)はマスモンとして読む(⑦)', old.length === 1 && old[0].kind === 'masu' && old[0].assistantId === '');
  const st = s.useFreeCall(null, '2026-11-07', { id: 'c1', masuId: 'as:mua', at: 1, load: 'L', kind: 'assistant', assistantId: 'mua' });
  check('助手を呼ぶと、マスモンと同じ無料回数を1つ使い、控えに kind・assistantId を残す', st && st.used === 1 && st.calls[0].kind === 'assistant' && st.calls[0].assistantId === 'mua');
  const back = s.settle(st, 'c1', 'end', '2026-11-07');
  check('1曲も始まらずに部屋を出たら、無料1回を返す(マスモンと同じ1本)', back && back.refund === 'free' && back.next.used === 0 && back.next.calls.length === 0);
}
// ---- 公開の印・つなぎ ----
check('公開の印 rhythmAssistantSession は偽(全部そろうまで隠す)', /\n  rhythmAssistantSession: false,\n/.test(FLAGS));
check('印は RELEASE_FLAGS.rhythmAssistantSession === true のときだけ真', /RELEASE_FLAGS\.rhythmAssistantSession === true/.test(SESSION));
check('呼ぶシートの助手のタブは、印が偽のあいだは出さない', /const assistOn = rhythmAssistSessionEnabled\(\) && /.test(SHEET) && /const tabNow = assistOn \? tab : 'masu';/.test(SHEET));
check('部屋で助手を呼ぶのも、印が偽のあいだはしない', /if \(!who \|\| !rhythmAssistSessionEnabled\(\) \|\| !RHYTHM_MULTI\.canSummon\(\)\)/.test(MULTI));
check('部屋の知らせに助手の印(as)を載せ、受け取る側は小文字だけ通す', /as: c\.as \|\| undefined/.test(MULTI) && /out\.as = rhythmMultiText\(raw\.as, 20\)\.replace\(\/\[\^a-z\]\/g, ''\)/.test(MULTI));
check('部屋の頭(cpuBrain)は助手の振り分けで包む', /rhythmAssistSessionWrapBrain\(rhythmBuddyMakeBrain\(songs\), songs\)/.test(MULTI));
check('結果画面で、呼んだ助手を育てる(RhythmAssistSessionGrowth)', /<RhythmAssistSessionGrowth key=\{assistantId\} assistantId=\{assistantId\}/.test(MULTI));
check('演奏の仕組みには触れない(30-rhythm-play.jsx は助手のセッションを呼ばない)', !/rhythmAssistSession|RHYTHM_ASSIST_SESSION/.test(PLAY));
check('助手のスコアをランキングへ送らない(助手の計算の部品は送信の関数を呼ばない)', !/sbUpsert|sbInsert|submitRhythm|rankings/.test(SESSION + SCREEN));
{
  // 台詞は txt が正本。部品は道具で作った生成物(食い違いを見張る)
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/mode/rhythm-assistant-session-lines-import.js'), '--check'], { encoding: 'utf8' });
  check('台詞の部品は txt(docs/progress/beat-assistant-session/lines)と同じ', r.status === 0, (r.stdout || '').trim().split('\n').slice(-2).join(' '));
}
// ---- 段階2: 演奏中の顔とひとこと・Lv で開くもの ----
{
  const APP = P('60-app.jsx');
  // 演奏画面には「読むだけの窓」を置くだけ。窓へ書くのは hud・曲・時刻だけで、演奏画面の中では窓を読まない
  const writes = PLAY.match(/RHYTHM_PLAY_WATCH\.[a-zA-Z]+(?:===|=)/g) || [];
  const reads = (PLAY.match(/RHYTHM_PLAY_WATCH\.[a-zA-Z]+/g) || []).length;
  check('演奏画面は窓(RHYTHM_PLAY_WATCH)に書くだけで、判定・スコアに使わない', writes.length >= 4 && writes.every((w) => /\.(hud|songId|timeMs)=/.test(w) || /===/.test(w)) && reads === writes.length, `${reads}か所`);
  check('顔とひとことは演奏画面の外(60-app)から、マルチで印が立っているときだけ重ねる', /gameState==='RHYTHM_PLAY'&&rhythmPlay&&rhythmPlay\.from==='multi'&&rhythmAssistSessionEnabled\(\)&&<RhythmAssistSessionPlayFace /.test(APP));
  check('ビートP の上乗せは、セッションLv とデュオの両方(rhythmAssistSessionRewardBonusNow)', /assistBonus=rhythmPlay\.from==='multi'&&rhythmAssistSessionEnabled\(\)\?rhythmAssistSessionRewardBonusNow\(\):0/.test(APP));
  check('ひとことは1.6秒で消える', /const RHYTHM_ASSIST_SESSION_BUBBLE_MS = 1600;/.test(SCREEN));
  check('同じ曲で同じ場面のひとことは1回だけ(said に覚える)', /if \(said\.has\(key\)\) continue;/.test(SCREEN));
  check('サビで顔が光るのは セッションLv.15 から', /const RHYTHM_ASSIST_SESSION_GLOW_LEVEL = 15;/.test(SESSION) && /glow && rhythmAssistSessionLevel\(state, aid\) >= RHYTHM_ASSIST_SESSION_GLOW_LEVEL/.test(SCREEN));
  check('ビートP の上乗せは 周回の報酬の倍率(multiScale)にだけ掛ける', /const multiScale=rhythmPlay\.from==='multi'\?Math\.round\(rhythmMultiTotalScale\([^)]*\)\*\(1\+assistBonus\)\*100\)\/100:1;/.test(APP));
  check('セッションLv の祝い(growthFxSessionLevel)は、印が立っていて関数があるときだけ・まとめて1回で呼ぶ', /if \(!rhythmAssistSessionEnabled\(\) \|\| typeof growthFxSessionLevel !== 'function'\) return;/.test(SCREEN) && /if \(q\.timer\) return;/.test(SCREEN));
  check('結果のカードは「CPU」ではなく「助手」の印', /data-rhythm-multi-assist-mark[^>]*>助手<\/b>/.test(MULTI));
}
{
  const sb2 = { Math, Date, Object, Number, String, Array, JSON, console, RHYTHM_SONG_CLIMAX: { x: [[1000, 2000, 0.6], [5000, 9000, 1]] } };
  vm.createContext(sb2);
  vm.runInContext(`${BUDDY}\n${SESSION}\n;globalThis.__t={apply:rhythmAssistSessionApplyLive,bonus:rhythmAssistSessionRewardBonus,climax:rhythmAssistSessionInClimax,level:rhythmAssistSessionLevel,norm:rhythmAssistSessionNormalize};`, sb2);
  const t = sb2.__t;
  check('サビは強さ0.9以上の区間だけ', t.climax('x', 6000) && !t.climax('x', 1500) && !t.climax('x', 9500) && !t.climax('nope', 6000));
  let st = null; let tickets = 0; const got = [];
  for (let i = 0; i < 400; i += 1) { const r = t.apply(st, 'atsu', { round: `t${i}`, songId: 'evans', diffId: 'MASTER', durationMs: 120000, teamRank: 'S', dayKey: '2026-11-07', nowMs: 1, score: 1, maxScore: 1000000 }); if (r.next) st = r.next; if (r.tickets) { tickets += r.tickets; got.push(`Lv.${t.level(st, 'atsu')}:${r.tickets}`); } }
  check('セッション券は Lv.35 で1枚・Lv.65 で2枚・Lv.100 で3枚(合わせて6枚・1回ずつ)', tickets === 6 && got.length === 3, got.join(' '));
  check('渡した節目は保存に残る(読み直しても二重に渡さない)', JSON.stringify(t.norm(JSON.parse(JSON.stringify(st))).mons.atsu.rewarded) === JSON.stringify([35, 65, 100]));
  const lv = (exp) => ({ mons: { mua: { exp } } });
  check('ビートP の上乗せ: Lv.19 は0・Lv.20 で +2%・2人なら足す', t.bonus(lv(0), ['mua']) === 0 && t.bonus(st, ['atsu']) === 0.08 && t.bonus(st, ['atsu', 'atsu']) === 0.08 && t.bonus(st, ['atsu', 'nobody']) === 0.08);
}

// ---- 段階3: 台詞・デュオ・合体・仲良し度 ----
{
  const sb3 = { Math, Date, Object, Number, String, Array, JSON, console };
  vm.createContext(sb3);
  vm.runInContext(`${BUDDY}\n${SESSION}\n${LINES}\n;globalThis.__d={duos:rhythmAssistSessionDuos,bonus:rhythmAssistSessionDuoBonus,SOLO:RHYTHM_ASSIST_SESSION_SOLO_LINES,PAIR:RHYTHM_ASSIST_SESSION_PAIR_LINES,ids:RHYTHM_ASSIST_SESSION_IDS};`, sb3);
  const d = sb3.__d;
  const lv = { 'kiki-mua': 5, 'atsu-mua': 3, 'atsu-kiki': 2, 'dra-kyuko': 4 };
  const levelOf = (a, b) => lv[[a, b].sort().join('-')] || 1;
  const seen = (a, b) => [a, b].sort().join('-') === 'kiki-mua';
  const one = d.duos(['mua', 'atsu'], levelOf, seen);
  check('仲良し度 Lv3 からデュオ(Lv2 以下はならない)', one.length === 1 && one[0].key === 'atsu-mua' && !one[0].result && !one[0].gattai && d.duos(['kiki', 'atsu'], levelOf, seen).length === 0);
  const three = d.duos(['atsu', 'mua', 'kiki'], levelOf, seen);
  check('仲良し度の高いペアから組み、1人は1つのデュオだけ', three.length === 1 && three[0].key === 'kiki-mua' && three[0].result && three[0].gattai);
  const four = d.duos(['mua', 'kiki', 'dra', 'kyuko'], levelOf, () => false);
  check('4人なら2組。Lv5 でも特別なお話を見ていなければ合体しない', four.length === 2 && four.every((x) => !x.gattai) && four.find((x) => x.key === 'dra-kyuko').result);
  check('デュオ(Lv4 以上)1組につきビートP +5%', Math.abs(d.bonus(four) - 0.1) < 1e-9 && d.bonus(one) === 0);
  const scenes = ['join', 'first', 'like', 'dislike', 'combo', 'miss', 'climax', 'last', 'mvp', 'high', 'mid', 'low', 'fc', 'levelup', 'likeup', 'overcome'];
  check('1人ぶんの台詞は、8人とも全部の場面がある', d.ids.every((id) => d.SOLO[id] && scenes.every((sc) => Array.isArray(d.SOLO[id][sc]) && d.SOLO[id][sc].length > 0)));
  let pairOk = 0; for (let i = 0; i < d.ids.length; i += 1) for (let j = i + 1; j < d.ids.length; j += 1) { const t = d.PAIR[[d.ids[i], d.ids[j]].sort().join('-')]; if (t && ['play', 'result', 'gattai'].every((sc) => t[sc] && t[sc].length)) pairOk += 1; }
  check('デュオの台詞は28ペアとも 演奏中・結果・合体 がある', pairOk === 28, `${pairOk}ペア`);
  check('デュオの掛け合いは1曲3回まで・合体は1曲1回', /const RHYTHM_ASSIST_SESSION_DUO_TALK_MAX = 3;/.test(SESSION) && /duoTalks < RHYTHM_ASSIST_SESSION_DUO_TALK_MAX/.test(SCREEN) && /const g = !gattaiDone \? duos\.find\(\(d\) => d\.gattai\) : null;/.test(SCREEN));
  check('仲良し度は assistantPeerGain(a, b, \'session\') で足し、同じ回(round)に2度は足さない', /assistantPeerGain\(ids\[i\], ids\[j\], 'session'\)/.test(SCREEN) && /if \(RHYTHM_ASSIST_SESSION_PEER_DONE\.has\(pk\)/.test(SCREEN));
  check('仲良し度は読むだけ(助手のセッションの部品は ASSISTANT_PEER_STORE を書き換えない)', !/ASSISTANT_PEER_STORE\.set|storeSet\(ASSISTANT_PEER/.test(SCREEN + SESSION));
  check('デュオは公開の印 assistantPeer が偽なら組まない', /if \(typeof assistantPeerEnabled !== 'function' \|\| !assistantPeerEnabled\(\)/.test(SCREEN));
  const DATA = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
  check('仲良し度の行動 session は +3・1日12(ペアの1日の上限の中・uncapped なし)', /\n  session: \{ amount:3, dailyMax:12, label:'2人でセッションをした' \},/.test(DATA));
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
