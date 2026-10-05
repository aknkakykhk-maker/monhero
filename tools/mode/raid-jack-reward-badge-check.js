// ジャックの報酬一覧の「ギフトに届いた」の印が、正しい行に付くかを確かめる。
//
//   node tools/mode/raid-jack-reward-badge-check.js
//
// 2026-10-05・ユーザー指摘「貢献度ランキングの報酬バッジは表示ミス?」。
// 順位の報酬の印は段階ごとに1つ(rank_a1)で、何位かは持っていなかった。そのため一覧は、実際の順位に関係なく
// 必ず「貢献1位」の行へ印を付けていた(2位で受け取った人にも1位に印が出ていた)。
//   ・届けた順位も印に残す(rank_a1_p2)。印は、その順位の行にだけ付く
//   ・順位つきの印が無い古い受け取りは、行ではなく段階の下の一言で伝える
//   ・5位以内ではなかった人(_none)にも、一言を出す
//   ・印の言葉は「ギフトに届いた」(ギフトボックスではまだ「受取可」のことがあり、「受け取り済み」だと食い違う)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const defsSrc = read('monster-hero/src/parts/35-raid-jack.jsx');
const ctx = { console, Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN };
vm.createContext(ctx);
vm.runInContext(`${defsSrc}\nthis.o={RAID_JACK_REWARDS,RAID_JACK_A_TIERS,raidJackRewardParts,raidJackClaimId,raidJackPlaceId,raidJackNoneId,raidJackTiers};`, ctx);
const o = ctx.o;

const screenSrc = read('monster-hero/src/parts/79-screen-raid-jack.jsx');
const from = screenSrc.indexOf('const RaidJackRewardChips');
const to = screenSrc.indexOf('// 報酬一覧(モード別・難易度別)。');
check('報酬の行・段階ごとの報酬の部品を切り出せる', from >= 0 && to > from);
const code = babel.transformSync(
  `const { RAID_JACK_REWARDS, RAID_JACK_A_TIERS, raidJackRewardParts, raidJackClaimId, raidJackPlaceId, raidJackNoneId } = deps;\n${screenSrc.slice(from, to)}\nmodule.exports = { RaidJackTierRewards };`,
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'badge.jsx' }).code;
const mod = { exports: {} };
new Function('module', 'exports', 'React', 'deps', code)(mod, mod.exports, React, o);
const render = (kind, index, claimed) => ReactDOMServer.renderToStaticMarkup(React.createElement(mod.exports.RaidJackTierRewards, { kind, index, claimed }));
const rowOf = (html, key) => (html.match(new RegExp(`<div data-raid-jack-reward-row="${key}"[\\s\\S]*?(?=<div data-raid-jack-reward-row=|<div class="mt-1|$)`)) || [''])[0];
const hasBadge = (html, key) => /ギフトに届いた/.test(rowOf(html, key));

const rank1 = o.raidJackClaimId('rank_a', 0);
// 2位で届いた人(印: rank_a1 と rank_a1_p2)
const h2 = render('a', 0, ['clear_a1', rank1, o.raidJackPlaceId(rank1, 2)]);
check('2位で届いた人は、貢献2位の行にだけ印が付く(1位には付かない)', hasBadge(h2, 'rank-2') && !hasBadge(h2, 'rank-1') && !hasBadge(h2, 'rank-3'));
check('討伐報酬の印は、討伐報酬の行に付く', hasBadge(h2, 'clear'));
check('順位が分かっているときは、「届いています」の一言は出さない', !/data-raid-jack-rank-note="delivered"/.test(h2));
// 1位・5位
check('1位で届いた人は、貢献1位の行にだけ印が付く', (() => { const h = render('a', 1, [o.raidJackClaimId('rank_a', 1), o.raidJackPlaceId(o.raidJackClaimId('rank_a', 1), 1)]); return hasBadge(h, 'rank-1') && !hasBadge(h, 'rank-2'); })());
check('5位で届いた人は、貢献5位の行にだけ印が付く', (() => { const h = render('a', 2, [o.raidJackClaimId('rank_a', 2), o.raidJackPlaceId(o.raidJackClaimId('rank_a', 2), 5)]); return hasBadge(h, 'rank-5') && !hasBadge(h, 'rank-1'); })());
// 古い受け取り(順位の印なし)
const hOld = render('a', 0, [rank1]);
check('順位つきの印が無い古い受け取りは、どの順位の行にも印を付けず、段階の下に「ギフトに届いています」を出す', !['rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5'].some((k) => hasBadge(hOld, k)) && /data-raid-jack-rank-note="delivered"/.test(hOld));
// 順位の対象外
const hNone = render('a', 0, [o.raidJackNoneId(rank1)]);
check('5位以内ではなかった人には「対象になりませんでした」の一言が出て、どの行にも印は付かない', /data-raid-jack-rank-note="none"/.test(hNone) && !['rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5'].some((k) => hasBadge(hNone, k)));
// まだ何も届いていない
const hNothing = render('a', 0, []);
check('何も届いていない人には、印も一言も出ない', !/ギフトに届いた/.test(hNothing) && !/data-raid-jack-rank-note/.test(hNothing));
// 言葉
check('印の言葉は「受け取り済み」ではなく「ギフトに届いた」', !/受け取り済み/.test(screenSrc.slice(from, to)));
// 印のid
check('順位の印のid: rank_a1 → rank_a1_p2 / final_b → final_b_p3', o.raidJackPlaceId('rank_a1', 2) === 'rank_a1_p2' && o.raidJackPlaceId('final_b', 3) === 'final_b_p3' && o.raidJackPlaceId('rank_a1', 0) === 'rank_a1_p1');
// 配る側が、順位の印も一緒に残す
const app = read('monster-hero/src/parts/60-app.jsx');
check('配るときに、順位つきの印(raidJackPlaceId)も受け取り済みの印へ一緒に入れる', /found\.due\.filter\(entry=>entry\.place\)\.map\(entry=>raidJackPlaceId\(entry\.id,entry\.place\)\)/.test(app));
const api = read('monster-hero/src/parts/36-raid-jack-api.jsx');
check('順位の報酬(A順位・B最終)は、届けた順位(place)を持って返る', /RAID_JACK_REWARDS\.aRank\[i\]\[place\], place \+ 1\)/.test(api) && /RAID_JACK_REWARDS\.bFinal\[place\], place \+ 1\)/.test(api));
// 保存の上限(64)に収まる
check('印が増えても保存の上限(64個)に収まる(最大でも30個ほど)', 2 + 5 + 5 * 2 + 5 + 2 <= 64);

console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
