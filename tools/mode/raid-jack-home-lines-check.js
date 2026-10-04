// HOMEにいるレイドボスのひとこと(38-raid-jack-home-lines.jsx)を確かめる。
//
//   node tools/mode/raid-jack-home-lines-check.js
//
// 2026-10-05・ユーザー指示「ホームにいるレイドボスに吹き出しで喋らせて。何種類か作って、押すと切り替わる。10種類ぐらい。残りライフでセリフも変わる」
// 見るもの
//   ① 段階(男爵〜大王)ごとに、場面(full / half / low)ごとに4種類以上。ぱんぷきんは10種類。段階ごとに10種類以上
//   ② 爵位の話し方(一人称・語尾)が、どのセリフにも出ている(台本と同じ話し方)
//   ③ 残りライフの場面分け(7割以上=full / 3割以上=half / それ以下=low・壊れた値は full)と、セリフの選び方
//   ④ 重複が無い・英語の文が混ざらない・長すぎない
//   ⑤ HOMEの画面が、この選び方を使い、押すと次のセリフへ進む(ジャック本体の「押すとレイド画面」とは別のボタン)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const src = read('monster-hero/src/parts/38-raid-jack-home-lines.jsx');
const ctx = { Object, Number, Array };
vm.createContext(ctx);
vm.runInContext(`${src}\nthis.o={RAID_JACK_HOME_LINES,RAID_JACK_HOME_LINES_PUMPKIN,raidJackLifeBand,raidJackHomeLines};`, ctx);
const o = ctx.o;
const BANDS = ['full', 'half', 'low'];
const TIERS = ['a1', 'a2', 'a3', 'a4', 'a5'];

// ① 数
check('段階は5つ(a1〜a5)', Object.keys(o.RAID_JACK_HOME_LINES).join() === TIERS.join());
check('どの段階も、場面(full・half・low)ごとに4種類以上', TIERS.every((t) => BANDS.every((b) => Array.isArray(o.RAID_JACK_HOME_LINES[t][b]) && o.RAID_JACK_HOME_LINES[t][b].length >= 4)));
check('どの段階も、全部で10種類以上(「10種類ぐらい」)', TIERS.every((t) => BANDS.reduce((n, b) => n + o.RAID_JACK_HOME_LINES[t][b].length, 0) >= 10));
check('大王を倒したあとのぱんぷきんは10種類', o.RAID_JACK_HOME_LINES_PUMPKIN.length === 10);

// ② 話し方
const voice = {
  a1: /吾輩|であるぞ|のである|ないぞ|ぞ[！。…]/, a2: /わたくし|ですぞ|ですな|ますぞ|ますな|ですとも/, a3: /余|フフ|たまえ|かね|[だの]よ|だね|ようだね|んよ|降りんとも/, a4: /我|である|ひれ伏せ|ぬ[。、]|……|だ$/, a5: /ワシ|じゃ|のう|わい|ガハ|倒れんぞ/,
};
const missing = [];
TIERS.forEach((t) => BANDS.forEach((b) => o.RAID_JACK_HOME_LINES[t][b].forEach((line) => { if (!voice[t].test(line)) missing.push(`${t}/${b}: ${line}`); })));
check('どの段階のセリフにも、その爵位の話し方が出ている(男爵=吾輩/であるぞ・子爵=わたくし/ですぞ・伯爵=余/フフ・公爵=我/である・大王=ワシ/じゃ)', missing.length === 0, missing.slice(0, 3).join(' | '));
check('ぱんぷきんは子どもの話し方(漢字を使わない・ひらがな中心。大文字の固有名詞は除く)', o.RAID_JACK_HOME_LINES_PUMPKIN.every((l) => !/[一-龥]/.test(l.replace(/ハロウィン・ナイト/g, ''))), o.RAID_JACK_HOME_LINES_PUMPKIN.filter((l) => /[一-龥]/.test(l)).join(' | '));
check('男爵は「ですぞ」「わたくし」を使わない(爵位の話し方が混ざらない)', ['full', 'half', 'low'].every((b) => o.RAID_JACK_HOME_LINES.a1[b].every((l) => !/わたくし|ですぞ|ワシ|余の/.test(l))));
check('大王・公爵・伯爵・子爵・男爵がそれぞれ自分の一人称だけを使う', TIERS.every((t) => BANDS.every((b) => o.RAID_JACK_HOME_LINES[t][b].every((l) => (t === 'a1' || !/吾輩/.test(l)) && (t === 'a2' || !/わたくし/.test(l)) && (t === 'a5' || !/ワシ/.test(l))))));

// ③ 場面と選び方
check('残りライフ 100%・70% は full、69.9%・30% は half、29.9%・0% は low', o.raidJackLifeBand(1) === 'full' && o.raidJackLifeBand(0.7) === 'full' && o.raidJackLifeBand(0.699) === 'half' && o.raidJackLifeBand(0.3) === 'half' && o.raidJackLifeBand(0.299) === 'low' && o.raidJackLifeBand(0) === 'low');
check('壊れた値(undefined・NaN・文字)は full', ['full'].every((x) => o.raidJackLifeBand(undefined) === x && o.raidJackLifeBand(NaN) === x && o.raidJackLifeBand('x') === x));
check('選び方: 段階と残りライフで、そこのセリフの一覧が返る', TIERS.every((t) => BANDS.every((b, i) => o.raidJackHomeLines(t, [1, 0.5, 0.1][i]) === o.RAID_JACK_HOME_LINES[t][b])));
check('選び方: ぱんぷきんは残りライフを見ない(場面を分けない)', [1, 0.5, 0, undefined].every((r) => o.raidJackHomeLines('a5', r, true) === o.RAID_JACK_HOME_LINES_PUMPKIN));
check('選び方: 知らない段階は男爵のセリフ(落ちない)', o.raidJackHomeLines('zz', 1) === o.RAID_JACK_HOME_LINES.a1.full && o.raidJackHomeLines(undefined, 0) === o.RAID_JACK_HOME_LINES.a1.low);
check('場面が替わるとセリフの一覧も替わる(同じ段階でも full と low は別)', TIERS.every((t) => o.RAID_JACK_HOME_LINES[t].full.every((l) => !o.RAID_JACK_HOME_LINES[t].low.includes(l))));

// ④ 品質
const all = [];
TIERS.forEach((t) => BANDS.forEach((b) => o.RAID_JACK_HOME_LINES[t][b].forEach((l) => all.push(l))));
o.RAID_JACK_HOME_LINES_PUMPKIN.forEach((l) => all.push(l));
check('同じセリフが2回出てこない', new Set(all).size === all.length, `${all.length}本`);
check('吹き出しに収まる長さ(60字以内・空でない)', all.every((l) => typeof l === 'string' && l.length > 0 && l.length <= 60), all.filter((l) => l.length > 60).join(' | '));
check('英語の文が混ざらない(英字の連続は1つも無い)', all.every((l) => !/[A-Za-z]{2,}/.test(l)));
check('{name} など差し込みの印が残っていない', all.every((l) => !/[{}]/.test(l)));

// ⑤ 画面
const home = read('monster-hero/src/parts/69-screen-home.jsx');
check('HOMEのジャックは、段階・残りライフ・ぱんぷきんから、ひとことを選ぶ(raidJackHomeLines(tier.id, rate, allDone))', /const speechLines = raidJackHomeLines\(tier\.id, rate, allDone\);/.test(home));
check('吹き出しは別のボタンで、押すと次のセリフへ進む(ジャック本体のボタンの入れ子にしない)', /data-home-raid-say[\s\S]{0,200}onClick=\{\(\) => setLineNo\(\(n\) => n \+ 1\)\}/.test(home) && /<button type="button" data-home-raid-jack onClick=\{onOpen\}/.test(home) && /<\/button>\s*<button type="button" data-home-raid-jack/.test(home));
check('セリフの番号は一覧の長さで割った余りを使う(段階・場面が替わって一覧が短くなっても落ちない)', /speechLines\[lineNo % speechLines\.length\]/.test(home));
check('動きを減らす設定では、吹き出しの出る動きを止める(data-story-pop を付けている)', /data-home-raid-say data-story-pop="1"/.test(home));
const pj = JSON.parse(read('monster-hero/src/parts/parts.json'));
const entry = pj.parts.find((x) => x.file === '38-raid-jack-home-lines.jsx');
check('部品の一覧(parts.json)に、純粋な部品として登録されている(37 のあと・40 の前)', !!entry && entry.pure === true && pj.parts.findIndex((x) => x.file === '38-raid-jack-home-lines.jsx') === pj.parts.findIndex((x) => x.file === '37-raid-jack-aura.jsx') + 1);

console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
