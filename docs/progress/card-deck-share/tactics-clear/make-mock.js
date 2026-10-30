// 戦術カードを分かりやすくする案の見本の絵(1案1画面1枚・390px幅)。土台の写真は now/ と ../chatshot/
// 使い方: node make.js <now のフォルダ> <対戦の写真のフォルダ> <出力先>
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const [NOW, BAT, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const img = (dir, n) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, n)).toString('base64');
const css = `
*{box-sizing:border-box}body{margin:0;background:#120b26;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;color:#fff;width:390px}
.ph{position:relative;width:390px;height:844px;background-size:390px 844px;overflow:hidden}
.scr{position:relative;width:390px;min-height:844px;background:linear-gradient(180deg,#1e1145,#120b26);padding:12px 12px 16px}
.cap{padding:10px 12px 14px;background:#111827;border-top:3px solid #fbbf24}
.cap h1{margin:0 0 4px;font-size:17px;color:#fde68a}.cap p{margin:2px 0;font-size:13px;line-height:1.55;color:#e2e8f0}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}.hd b{font-size:19px;color:#fcd34d}.bk{width:34px;height:34px;border-radius:10px;border:1px solid #fff3;display:grid;place-items:center}
.tag{position:absolute;background:#ef4444;color:#fff;font-size:12px;font-weight:900;border-radius:999px;padding:3px 9px;border:2px solid #fff}
.dim{position:absolute;inset:0;background:rgba(2,6,23,.6)}
.pair{border-radius:12px;background:#0f172a;border:1px solid #334155;margin-bottom:7px;padding:7px 9px}
.pair .old{font-size:11px;color:#94a3b8;line-height:1.45}.pair .old b{color:#cbd5e1}
.pair .new{font-size:13.5px;font-weight:800;color:#fff;line-height:1.45;margin-top:4px}.pair .new i{font-style:normal;color:#fde68a}
.pair .k{display:inline-block;font-size:10px;font-weight:900;border-radius:6px;padding:1px 6px;margin-right:5px}
.kc{background:#1d4ed8}.ka{background:#b91c1c}.kb{background:#b45309}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#1a1438;border-top:2px solid #38bdf8;border-radius:20px 20px 0 0;padding:12px 12px 16px}
.row{display:flex;align-items:center;gap:6px;background:#0f172a;border:2px solid #334155;border-radius:14px;padding:7px 8px}
.row .n{width:22px;height:22px;border-radius:999px;background:#334155;display:grid;place-items:center;font-size:12px;font-weight:900;flex:none}
.if{font-size:11px;font-weight:900;color:#93c5fd;flex:none}.then{font-size:11px;font-weight:900;color:#fca5a5;flex:none}
.cc{flex:1;font-size:13px;font-weight:800;line-height:1.3}.cc span{display:block}
.chip{display:inline-flex;align-items:center;gap:3px;border-radius:9px;padding:4px 7px;font-size:12.5px;font-weight:800}
.chip.c{background:#1d4ed8}.chip.a{background:#b91c1c}.chip.b{background:#b45309}
.down{font-size:11px;color:#94a3b8;text-align:center;margin:3px 0;font-weight:800}
.tile{border-radius:12px;padding:7px;border:2px solid #ffffff55;background:linear-gradient(160deg,#1d4ed8,#1e3a8a);min-height:96px}
.tile.dim2{opacity:.45}.tile .ic{font-size:22px}.tile b{display:block;font-size:13px;line-height:1.3;margin-top:2px}.tile small{display:block;font-size:10.5px;color:#dbeafe;line-height:1.4;margin-top:3px}
.badge{display:inline-block;font-size:10px;font-weight:900;border-radius:6px;padding:1px 5px;margin-right:3px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
.search{display:flex;align-items:center;gap:6px;border:2px solid #38bdf8;border-radius:12px;background:#020617;padding:8px 10px;font-size:14px;color:#94a3b8;margin-bottom:7px}
.fl{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}.fl span{border-radius:999px;font-size:11.5px;font-weight:900;padding:4px 9px;border:1px solid #ffffff33;background:#1e293b;color:#cbd5e1}.fl span.on{background:#fbbf24;color:#111;border-color:#fbbf24}
.tpl{border-radius:14px;border:2px solid #ffffff33;background:#0f172a;padding:9px;margin-bottom:8px}
.tpl h3{margin:0 0 2px;font-size:15px}.tpl p{margin:0 0 6px;font-size:11.5px;color:#cbd5e1;line-height:1.45}
.btn{border-radius:12px;font-weight:900;text-align:center;padding:10px;font-size:14px}
.glow{position:absolute;border-radius:12px;background:rgba(251,191,36,.95);color:#111;font-size:12px;font-weight:900;padding:5px 9px;box-shadow:0 0 0 3px #fff,0 0 18px 6px rgba(251,191,36,.8)}
.logbox{position:absolute;left:8px;right:8px;background:rgba(2,6,23,.92);border:2px solid #fbbf24;border-radius:14px;padding:7px 9px}
.logbox p{margin:0;padding:4px 0;font-size:12.5px;line-height:1.4;border-bottom:1px solid #ffffff14}.logbox p b{color:#fde68a}
.rank{display:flex;align-items:center;gap:8px;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:7px 9px;margin-bottom:6px}
.rank .no{width:24px;font-size:16px;font-weight:900;color:#fde68a;text-align:center}.rank .cnt{font-size:16px;font-weight:900;color:#fde68a}
.bar{height:6px;border-radius:9px;background:#334155;margin-top:4px}.bar i{display:block;height:6px;border-radius:9px;background:#fbbf24}
`;
const page = (body, h1, lines, bg) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${css}</style></head><body>
${bg ? `<div class="ph" style="background-image:url(${bg})">${body}</div>` : `<div class="scr">${body}</div>`}
<div class="cap"><h1>${h1}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}</div></body></html>`;

// ---- 1. 文の言い換え(10枚) ----
const PAIRS = [
  ['kc', '条件', '倒せる相手がいる', '手札の攻撃の技(特殊技は除く)で、いまのガッツで出せて、ダメージが残りライフ以上になる相手のモンスターがいるとき。その相手を狙う', '<i>倒せる相手がいる</i>とき → その相手をねらう'],
  ['kc', '条件', '攻撃がいちばん強い相手', '相手のモンスターのうち、使える技の最大ダメージがいちばん大きい相手を狙う(手札は見ない)', '<i>いちばん強い技をもつ相手</i>を、先にねらう'],
  ['kc', '条件', '相手のライフ50%以下', '残りライフが最大の50%以下になっている相手のモンスターがいるとき。その相手を狙う', '<i>ライフが半分を切った相手</i>がいたら → その相手をねらう'],
  ['kc', '条件', '味方のライフ30%以下', '残りライフが最大の30%以下の自分のモンスターがいるとき。守るカードと組むと、そのモンスターが狙われたときだけ守る', '<i>味方がピンチ(ライフ3割以下)</i>のとき → その味方を守る'],
  ['kc', '条件', '相手が大技を撃てそう', '相手のガッツが4以上で手札があり、相手のモンスターが使える大技(払うガッツ4以上)をいまのガッツ+1で払えるとき', '<i>相手の大技が来そう</i>なとき'],
  ['kc', '条件', '受けるダメージ3以上', '攻撃を受けたとき、受けるダメージの見込みが3以上なら(守るときだけ見る)', '<i>3ダメージ以上の攻撃</i>を受けたとき'],
  ['ka', '行動', 'いちばん得な攻撃', 'このモンスターが出せる攻撃のうち、点数(ダメージ・とどめ・ガッツの損得)がいちばん高い攻撃をする', '<i>いちばん良い技</i>で攻撃する'],
  ['ka', '行動', 'ダメージ3以上だけ守る', 'このモンスターが攻撃を受けたとき、受けるダメージの見込みが3より小さければ守らずに受ける。3以上なら守る', '<i>大きい攻撃(3以上)だけ</i>守る。小さい攻撃は受けて、守りのカードをとっておく'],
  ['ka', '行動', 'このターンの攻撃をやめる', '当てはまったら、このターンの攻撃をここで終える', '<i>これ以上攻撃しないで</i>ターンを終える'],
  ['kb', '基本', '守り型', '守りのカードを残す(1.5倍重く)・攻撃は控えめ(0.7倍)。攻撃を受けたら、守れるときはいつも守る', '<i>守りのカードを大事にとっておき</i>、攻撃を受けたらできるだけ守る。攻撃はひかえめ'],
];
const shots = [];
shots.push(['文-案A-ひとことに言い換え(10枚).png', page(`
  <div class="hd"><div class="bk">←</div><b>カードの文の言い換え(10枚)</b></div>
  <p style="font-size:12px;color:#cbd5e1;margin:0 0 8px">灰色が今の文、白が案の文。<b style="color:#93c5fd">条件</b>は「〜とき」、<b style="color:#fca5a5">行動</b>は「〜する」で終わる一文に</p>
  ${PAIRS.map(([k, kn, nm, old, nw]) => `<div class="pair"><div class="old"><span class="k ${k}">${kn}</span><b>今: ${nm}</b> … ${old}</div><div class="new">→ ${nw}</div></div>`).join('')}`,
  '文・案A: 「〜のとき → 〜する」の一文に', ['条件のカードは「〜とき」、行動のカードは「〜する」で終わる短い一文にそろえる。数字(1.5倍・点数など)はカードの表から外し、「くわしく」を押したときだけ出す。', '並べると「もし[倒せる相手がいる]とき → [いちばん良い技]で攻撃する」と、そのまま読める'])]);

// ---- 1b. カードの見え方 ----
const TILES = [['🎯', '倒せる相手がいる', 'その相手をねらう', true], ['💪', 'いちばん強い技をもつ相手', '先にねらう', false], ['❤️', 'ライフが半分を切った相手', 'その相手をねらう', true], ['🆘', '味方がピンチ', 'ライフ3割以下の味方を守る', false], ['💥', '相手の大技が来そう', '大技に備える', false], ['🛡️', '3ダメージ以上を受けた', '守るときだけ見る', false]];
shots.push(['文-案B-カードの絵と一文.png', page(`
  <div class="hd"><div class="bk">←</div><b>条件(〜とき)をえらぶ</b></div>
  <div class="g2">${TILES.map(([ic, t, s, own]) => `<div class="tile ${own ? '' : 'dim2'}"><span class="badge" style="background:#0008">N</span><span class="badge" style="background:#1e40af">条件</span><div class="ic">${ic}</div><b>${t}とき</b><small>→ ${s}</small></div>`).join('')}</div>
  <p style="font-size:12px;color:#cbd5e1;margin:10px 2px 0">押すと「くわしく」: 今の細かい文(どの技を数えるか・倍率など)と、<b>このカードと相性のいい行動カード</b>3枚</p>`,
  '文・案B: 絵(しるし)と一文だけのカード', ['カードの表は「しるしの絵+一文」だけにして、細かい文は押したときの「くわしく」へ。', 'しるしは区分ごとにそろえる(🎯標的・❤️ライフ・⚡ガッツ・🃏手札・🛡️受けたとき…)。持っていないカードは暗く'])]);

// ---- 2. 組み方: もし→なら の並び ----
shots.push(['組み方-案A-もしならの並び.png', page(`
  <div class="sheet" style="top:150px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:18px">ゴーレムの戦い方</b><span style="margin-left:auto;font-size:20px;color:#94a3b8">✕</span></div>
    <p style="margin:0 0 8px;font-size:12px;color:#bae6fd;font-weight:800">上から順に見て、<u>最初に当てはまった1つ</u>だけを使います</p>
    <div class="row"><span class="n">1</span><span class="if">もし</span><span class="cc"><span class="chip c">🎯 倒せる相手がいる</span></span></div>
    <div class="row" style="border-color:#7f1d1d;margin-top:-4px;border-top-left-radius:4px;border-top-right-radius:4px"><span class="n" style="opacity:0"></span><span class="then">なら →</span><span class="cc"><span class="chip a">⚔️ いちばん良い技で攻撃</span></span></div>
    <div class="down">↓ 当てはまらなければ、次へ</div>
    <div class="row"><span class="n">2</span><span class="if">もし</span><span class="cc"><span class="chip c">❤️ ライフが半分を切った相手</span></span></div>
    <div class="row" style="border-color:#7f1d1d;margin-top:-4px"><span class="n" style="opacity:0"></span><span class="then">なら →</span><span class="cc"><span class="chip a">💥 大技で攻撃</span></span></div>
    <div class="down">↓ 当てはまらなければ、次へ</div>
    <div class="row"><span class="n">3</span><span class="if">もし</span><span class="cc"><span class="chip c">🛡️ 3ダメージ以上を受けた</span></span></div>
    <div class="row" style="border-color:#7f1d1d;margin-top:-4px"><span class="n" style="opacity:0"></span><span class="then">なら →</span><span class="cc"><span class="chip a">🛡️ 守る</span></span></div>
    <div class="down">↓ どれにも当てはまらなければ</div>
    <div class="row" style="border-color:#b45309;background:#2a1606"><span class="n" style="background:#b45309">型</span><span class="cc"><span class="chip b">📘 基本の型: バランス型</span><span style="font-size:11px;color:#fde68a;margin-top:3px">で打つ</span></span></div>
    <div style="display:flex;gap:6px;margin-top:10px"><div class="btn" style="flex:1;border:1px solid #ffffff44">＋ 1行たす</div><div class="btn" style="flex:1;background:#fbbf24;color:#111">おまかせで組む</div></div>
  </div>`,
  '組み方・案A: 「もし〜なら → こうする」の並び', ['1行を「もし[条件] なら → [行動]」の2段で見せ、行と行のあいだに「↓ 当てはまらなければ、次へ」。いちばん下に「どれにも当てはまらなければ → 基本の型」。', '上から順に試して、最初に当たった1つだけを使う仕組みが、図のまま分かる'], img(NOW, '今-02-モンスターの戦い方.png'))]);

// ---- 2b. テンプレートとおまかせ ----
const TPL = [['⚔️ 攻めて倒しきる', 'とどめを最優先。弱った相手から倒していく', ['🎯 倒せる相手がいる → いちばん良い技', '❤️ 半分を切った相手 → 大技', 'いつでも → いちばん良い技'], '#7f1d1d'],
  ['🛡️ 守って耐える', '大きい攻撃だけ守って、守りのカードを切らさない', ['🛡️ 3ダメージ以上 → 守る', '🆘 味方がピンチ → かばう', 'いつでも → いちばん良い技'], '#1e3a8a'],
  ['💥 ためて大技', 'ガッツをためて、大技で一気にダメージ', ['⚡ ガッツ4以上 → 大技', '🎯 倒せる相手がいる → いちばん良い技', 'ガッツを多めにためる'], '#78350f']];
shots.push(['組み方-案B-おすすめの組み方.png', page(`
  <div class="hd"><div class="bk">←</div><b>おすすめの組み方</b></div>
  <p style="font-size:12px;color:#cbd5e1;margin:0 0 8px">はじめての人へ。えらぶと3体の戦い方とブリーダーの手が、まとめて入ります(持っていないカードは近いカードで代わり)</p>
  ${TPL.map(([t, d, rows, c]) => `<div class="tpl" style="border-color:${c}"><h3>${t}</h3><p>${d}</p>${rows.map((r) => `<div style="font-size:12px;padding:3px 6px;background:#ffffff0d;border-radius:7px;margin-bottom:3px">${r}</div>`).join('')}<div class="btn" style="background:#fbbf24;color:#111;margin-top:6px;padding:7px">これで組む</div></div>`).join('')}
  <div class="btn" style="border:2px dashed #38bdf8;color:#bae6fd">🎲 おまかせ(このデッキと持っているカードから組む)</div>`,
  '組み方・案B: おすすめの組み方(テンプレート)とおまかせ', ['「攻めて倒しきる」「守って耐える」「ためて大技」など3〜5つの型を、中の並びを見せたまま選べる。', '「おまかせ」は、いまの「おすすめで入れる」を3体+ブリーダーへ広げたもの。組んだあとに1行ずつ直せる'])]);

// ---- 3. 対戦中に光る+ログ ----
shots.push(['効き目-案A-対戦中に光る.png', page(`
  <div class="glow" style="left:16px;top:226px">📜 倒せる相手を ねらった!</div>
  <div class="logbox" style="top:470px"><p style="color:#fde68a;font-weight:900">記録(戦術カード)</p>
    <p><b>ターン13</b> ゴーレム: <b>「倒せる相手がいる → いちばん良い技」</b>で、ディノを攻撃</p>
    <p><b>ターン12</b> ナーガ: <b>「3ダメージ以上を受けた → 守る」</b>で、ふせぐで守った</p>
    <p><b>ターン11</b> どれにも当てはまらず <b>基本の型(バランス型)</b>で打った</p></div>`,
  '効き目・案A: 戦術カードで動いたときに光る+記録', ['ほかのブリーダーのデッキ・大会・「ためしに戦わせる」で、戦術カードで動いたモンスターの上に、使った1行を2秒だけ光らせる。', '「記録」に「◯◯のカードで、△△を狙った」と残る。相手のデッキが勝手に動く理由が、その場で分かる'], img(BAT, 'watch-03-host.png'))]);

// ---- 3b. ためしに戦わせる+よく働いたカード ----
const RK = [['🎯 倒せる相手がいる → いちばん良い技', 'ゴーレム', 9, 100], ['🛡️ 3ダメージ以上 → 守る', 'ナーガ', 6, 66], ['❤️ 半分を切った相手 → 大技', 'ピクシー', 4, 44], ['🔋 ガッツをためる', 'ブリーダー', 3, 33]];
shots.push(['効き目-案B-よく働いたカード.png', page(`
  <div class="hd"><div class="bk">←</div><b>この戦い方の成績</b></div>
  <div style="display:flex;gap:6px;margin-bottom:8px"><div class="btn" style="flex:1;background:#7c3aed">▶ ためしに戦わせる(助手と自動で1戦)</div></div>
  <p style="font-size:12px;color:#cbd5e1;margin:0 0 6px">さっきの1戦(ためし・自動)で: <b style="color:#fde68a">勝ち</b>・14ターン</p>
  <p style="font-size:13px;font-weight:900;margin:8px 0 6px;color:#fde68a">よく働いたカード</p>
  ${RK.map(([t, who, n, w], i) => `<div class="rank"><span class="no">${i + 1}</span><div style="flex:1"><div style="font-size:12.5px;font-weight:800">${t}</div><div style="font-size:10.5px;color:#94a3b8">${who}</div><div class="bar"><i style="width:${w}%"></i></div></div><span class="cnt">${n}回</span></div>`).join('')}
  <p style="font-size:13px;font-weight:900;margin:10px 0 6px;color:#fca5a5">一度も当てはまらなかったカード</p>
  <div class="rank" style="opacity:.8"><span class="no">-</span><div style="flex:1;font-size:12.5px;font-weight:800">⚡ 相手のガッツ1以下 → 大技<div style="font-size:10.5px;color:#94a3b8">ピクシー ・ 上の行が先に当たっていたかも</div></div></div>
  <p style="font-size:11.5px;color:#94a3b8;margin:8px 2px 0">遊ぶ人が自分で打つ対戦では、戦術カードは使われません(自分のデッキが「ほかのブリーダー」や大会で戦うときに使われる)</p>`,
  '効き目・案B: ためしに戦わせる+よく働いたカード', ['戦い方の画面から「ためしに戦わせる」で、自分のデッキを助手と自動で1戦させ、盤面で見られる(案Aの光る・記録つき)。', '終わったら「よく働いたカード」と「一度も当てはまらなかったカード」。自分のカードが働くのを見られる場がほかに無いので、いちばん効く'])]);

// ---- 4. 一覧: 絞り込み・検索・おすすめ ----
const LT = [['🎯', '倒せる相手がいる', 'その相手をねらう', '★おすすめ', 1], ['❤️', 'ライフが半分を切った相手', 'その相手をねらう', 'よく使う', 1], ['🛡️', '3ダメージ以上を受けた', '守るときだけ', '', 1], ['🆘', '味方がピンチ', 'ライフ3割以下', '', 1], ['💪', 'いちばん強い技をもつ相手', '先にねらう', '', 0], ['💥', '相手の大技が来そう', '大技に備える', '', 0]];
shots.push(['一覧-案A-しぼりこみと検索.png', page(`
  <div class="hd"><div class="bk">←</div><b>条件(〜とき)をえらぶ</b></div>
  <div class="search">🔍 ことばでさがす(例: ライフ・大技・守る)</div>
  <div class="fl"><span class="on">すべて</span><span>🎯 ねらう相手</span><span>❤️ ライフ</span><span>⚡ ガッツ</span><span>🃏 手札</span><span>🛡️ 受けたとき</span><span>📍 場</span></div>
  <div class="fl"><span class="on">持っているだけ</span><span>このデッキで効く</span><span>★おすすめ順</span><span>よく使う順</span></div>
  <div class="g2">${LT.map(([ic, t, s, b, own]) => `<div class="tile ${own ? '' : 'dim2'}">${b ? `<span class="badge" style="background:${b.startsWith('★') ? '#fbbf24;color:#111' : '#059669'}">${b}</span>` : '<span class="badge" style="background:#0008">N</span>'}<div class="ic">${ic}</div><b>${t}とき</b><small>→ ${s}</small></div>`).join('')}</div>`,
  '一覧・案A: しぼりこみ・検索・おすすめ', ['上に「ことばでさがす」、その下に区分のしぼりこみ(ねらう相手・ライフ・ガッツ・手札・受けたとき・場)。', '「持っているだけ」(はじめはON)・「このデッキで効く」(デッキに無い技の種類や、全体攻撃の無いデッキの「全体攻撃がある」などを外す)・「おすすめ順/よく使う順」(よく使う=自分の登録で入れた回数)'])]);
// 今の対戦中(戦術カードで動いても、何も出ない)
shots.push(['今-05-対戦中(どのカードで動いたか出ない).png', page(`<div class="tag" style="left:70px;top:300px">戦術カードで動いても、どのカードかは出ない</div>`,
  '今: 対戦中', ['ほかのブリーダーのデッキと戦っても、相手がどの戦術カードで動いたかは見えない。', '自分のデッキの戦術カードは、自分が打つ対戦では使われないので、働くところを見る場が無い'], img(BAT, 'watch-03-host.png'))]);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
  for (const [name, html] of shots) { await p.setContent(html, { waitUntil: 'load' }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); }
  await b.close();
  console.log('ok', shots.length);
})();
