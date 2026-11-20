#!/usr/bin/env node
// モンヒロサクセス 回3(大会・修行・引退・ゲームオーバー・保存枠)を本物のブラウザで開き、画面ごとに
// 「真っ白にならない・字が枠からはみ出さない・ページのエラーが出ない・保存枠に1回だけ入る」を見る。
//
//   node tools/success/success-r3-shoot.js                  … 縦390×844 で全部の画面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-r3-shoot.js … 縦390×844 と 幅320×568 で撮る
//
// 入口はデバッグ設定だけなので、回2の撮影(success-shoot.js)と同じく MonheroSuccessScreen を直接置いて開く。
// 途中の育成は芯で決まった手を打って作り、場面に合わせて形を整えてから mh_monsuc_run_v1 へ入れる。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
// SHOT_REV=<コミット> … ゲームの画面だけその版から配る(社長の指摘の較正。tools/browser/serve-rev.js)
const serveRev = require('../browser/serve-rev');
const FROM_REV = serveRev.make(ROOT);
// 撮った止め絵ごとに大きさの釣り合いを測り、置き場の _measure.jsonl に残す(tools/browser/ui-measure.js。UI_MEASURE=0 で止める)
const uiMeasure = require('../browser/ui-measure');
const SHOT_DIR = process.env.SHOT_DIR || '';
// 一部だけ回す: ONLY=<画面の名前をコンマで>(例: ONLY=C1,C1w で大会の受付だけ)。名前は下の表 SHOTS の1つ目
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const { scanTextWrap } = require(path.resolve(__dirname, '..', 'playbot', 'lib', 'text-wrap')); // 言葉・値の途中の折れ(r1114-077)
const { measureBtnPixels } = require('./msx-btn-pixel'); // 実際に描いた画素で、ボタンの字・記号の真ん中を測る(r1115-066)
const { msxUiRulesMeasure, msxScrollStripTexts, BLANK_MAX } = require('./msx-ui-rules'); // 画面の決まり(docs/spec/MONSUC_UI.md)の見張り
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で: 芯で途中の育成を作り、場面に合わせて形を整える
const makeRun = async (kind) => {
  /* global msxLoad, msxSuc */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'r3-shot-1', species: window.__SHOT_SPECIES || 'Mocchi', aid: 'mua', team, aidBondLv: 4, items: { sand: 2, rainbow: 1 } });
  const goal = window.__SHOT_GOAL || (kind === 'debut' ? 5 : 22); // SHOT_GOAL=<ターン> で、大会の名前の見え方を月ごとに撮れる
  let guard = 0;
  while (s.turn < goal && !s.over && guard++ < 200) {
    const v = SUC.peek(s);
    let a;
    if (v.can.includes('cond')) a = { kind: 'cond' };
    else if (v.can.includes('retry')) a = { kind: 'retry' };
    else if (s.hp < s.hpMax * 0.45) a = { kind: 'rest' };
    else { const keys = Object.keys(v.cards).filter((k) => k.startsWith('light:') || k.startsWith('train:')); keys.sort((x, y) => (v.cards[y].mult - v.cards[x].mult)); a = { kind: v.cards[keys[0]].kind, stat: v.cards[keys[0]].stat }; }
    s = SUC.act(s, a).state;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
    let g2 = 0; while (s.battle && g2++ < 5) s = SUC.settle(s, true).state;
  }
  s = { ...s, acted: false, battle: null, over: null, tickets: 3, items: { sand: 2, rainbow: 1 } };
  let phase = 'main';
  const stats = (n) => ({ life: n, pow: n, wise: n, hit: n, eva: n, tough: n });
  // 結果だけ見る(r1115-057): その大会で1回でも勝った記録(wonBefore)があるときだけ押せる。win・lose は「勝ったことがある」大会・winnew は初めての大会
  // 大会名は本番と同じく、芯が期・月で付けたいまの名前(cupNameAt)を渡す。渡さないと古い既定の名前に落ちる(r1115-193)
  const cupNm = (sys, star) => { if (typeof SUC.cupsOf !== 'function') return null; for (let tt = 1; tt <= (SUC.TOTAL_TURNS || 46); tt++) { const c = (SUC.cupsOf({ ...s, turn: tt }) || []).find((x) => x.sys === sys && x.star === star && x.name && x.name !== sys); if (c) return c.name; } return null; };
  if (kind === 'win' || kind === 'lose' || kind === 'winnew') { s = { ...s, stats: stats(kind === 'lose' ? 40 : 700), wonBefore: kind === 'winnew' ? [] : ['str:2'], wonNow: [], battle: { kind: 'cup', id: 'x', sys: 'str', star: 2, name: cupNm('str', 2), rival: null, round: 0 } }; phase = 'battle'; }
  // R1・C3: 優勝で賞金ランクが1段上がるように、賞金の合計を次の段のすぐ手前にそろえる(段の境目は芯の FAME_RANK。r1115-168 で境目が変わり、上がらなくなって R1 がごはんの段になっていた・r1115-197)
  if (kind === 'win' && Array.isArray(SUC.FAME_RANK)) { const nx = SUC.FAME_RANK.slice(2).find((r) => Number(r.min) > (Number(s.fameTotal) || 0)); if (nx) s = { ...s, fameTotal: nx.min - 1 }; }
  if (kind === 'debutlose') { s = { ...s, turn: 5, wonNow: [], wonBefore: ['debut'], stats: stats(30), debutLoss: 2, debutWon: false, rematchUsed: 3, battle: { kind: 'debut', round: 0, retry: 2 } }; phase = 'battle'; }
  if (kind === 'kimatsu' || kind === 'summit') { // 期末の大会・最後の大会の当日(芯が battle を立てた直後。まだ「はい」を押していない)
    const want = kind === 'kimatsu' ? 'junior' : 'final';
    let t = 1; while (t < (SUC.TOTAL_TURNS || 46) && !(SUC.periodOf(t).key === want && (kind === 'summit' ? SUC.periodOf(t).at >= 3 : SUC.periodOf(t + 1).key !== want))) t++;
    s = { ...s, turn: t, battle: kind === 'kimatsu' ? { kind: 'junior', round: 0 } : { kind: 'summit', round: 0 } }; phase = 'battle';
  }
  if (kind === 'qhit' || kind === 'qmiss' || kind === 'qmix') { // 技のくじの当たり外れを撮る(r1115-063): 乱数の種(id)を替えて、どの技を選んでも決まった結果になる種を探す
    s = { ...s, hp: s.hpMax, superLeft: 2 };
    const ids = SUC.learnable(s, 'fire').map((t) => t.id);
    const want = kind === 'qhit' ? [true] : kind === 'qmiss' ? [false] : [true, false];
    const pats = kind === 'qmix' ? ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => [a, b])) : ids.map((a) => [a]);
    for (let k = 0; k < 3000; k++) {
      const t = { ...s, id: `r3-shot-q${k}` };
      if (pats.every((p) => { const o = SUC.act(t, { kind: 'shugyo', course: 'fire', techs: p }).out; return o.ok && (o.tries || []).map((x) => x.hit).join() === want.join(); })) { s = t; break; }
    }
  }
  if (kind === 'hpmid') s = { ...s, hp: 40 }; // 体力40: 修行(30)は行けて超修行(60)は行けない(r1115-062)
  if (kind === 'hplow') s = { ...s, hp: 6 }; // 体力6: 修行にも行けない
  if (kind === 'gameover') { s = { ...s, turn: 7, debutLoss: 3, over: 'gameover' }; phase = 'over'; }
  if (kind === 'retire') { s = { ...s, turn: 46, pts: 34, over: 'done' }; phase = 'over'; }
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase, out: null, log: [{ turn: 3, t: '休んだ' }], startAt: 1 };
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (f.startsWith(ROOT) && serveRev.serve(FROM_REV, ROOT, f, res, TYPES[path.extname(f)])) return;
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [844, 390, 'land'], [320, 568, 's320']] : [[390, 844, '']]; // 撮るときは横画面も(社長に見せる止め絵は縦と横)
  // SHOT_SIZES=base,land,s568 のように名札を並べると、その大きさだけ撮る(s568 = 小さい横 568×320。見た目の点検 visual-shoot.js --monsuc-deep が使う)
  const pickSizes = (process.env.SHOT_SIZES || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (SHOT_DIR && pickSizes.length) sizes.splice(0, sizes.length, ...[[390, 844, ''], [844, 390, 'land'], [320, 568, 's320'], [568, 320, 's568'], [1280, 800, 'pc']].filter(([, , t]) => pickSizes.includes(t || 'base')));
  // [名前, 作る育成, 操作(data 属性 か テキストの正規表現)]。'@x' は [data-msx-r3-x] を押す
  const SHOTS = [
    ['C1', 'mid', ['cont', /^🏆大会/]],
    ['C1w', 'mid', ['cont', /^🏆大会/, '@cup']], ['C1p', 'mid', ['cont', /^🏆大会/, '@cup', '@prize=g']], ['C1m', 'mid', ['cont', /^🏆大会/, '@next-month']], // 受付の作り直し(確認の窓・賞品の詳細・次の月)
    // 大会の1戦はバトル部の見せる部品 MonsucCupShow('%x' は [data-msc-x])。賞品のあとのごはんは回3
    ['B1', 'win', ['cont', '@cupintro-go']], ['C2', 'win', ['cont', '@cupintro-go', '%go']], ['W1', 'win', ['cont', '@cupintro-go', '%go', '%ready']], ['MA1', 'win', ['cont', '@cupintro-go', '%go', '%ready', 'w4000', '@@h', '*[data-msxm-move="1"]', 'w600', '@@h', 'w5400', '@@h']], ['MA2', 'win', ['cont', '@cupintro-go', '%go', '%ready', 'w4000', '*[data-msxm-move="-1"]', 'w6000']], // 手動の試合: 札の案A・場の高さが番で変わらない・零で吹き飛ばし(r1115-050②・074・185・193)
    ['G2', 'win', ['cont', '@cupintro-go', '%go', '%ready', 'w4000', '*[data-msxm-move="1"]', 'w6000']], // 手動の試合の2ラウンド目の自分の番: 上の帯と操作欄のガッツが同じ(r1115-187)
    // 続きの止め絵(SHOT_SEQ で名指ししたときだけ撮る。見せ場と流れの点検 r1119-033): 大会の1試合を受付から結果まで
    ...((process.env.SHOT_SEQ || '').split(',').includes('SQC') ? [['SQC', 'win', ['cont', '@cupintro-go', '%go', '%ready', 'w1500', '*[data-msa-ctl="manual"]', ...Array(12).fill('w3000'), 'w1500', /^結果へ/, '%next', '@next']]] : []),
    ['B2', 'win', ['cont', '@cupintro-go', '%quick']], ['R1', 'win', ['cont', '@cupintro-go', '%quick', '%next']], ['C3', 'win', ['cont', '@cupintro-go', '%quick', '%next', '@next']], ['C3b', 'win', ['cont', '@cupintro-go', '%quick', '%next', '@next']], // R1: 賞金ランク UP!(段が上がったときだけ)。C3b: ごはんは その場では出ない(2026-11-17 社長: ファームで あげる)。権利が育成に残るかを見る
    ['C4', 'lose', ['cont', '@cupintro-go', '%quick']], ['C4r', 'lose', ['cont', '@cupintro-go', '%quick', '%rematch=sand']], ['C4g', 'lose', ['cont', '@cupintro-go', '%quick', '%giveup']],
    ['C4d', 'debutlose', ['cont', '@cupintro-go', '%quick']],
    ['Y1', 'win', ['cont', '@cupintro-go']], ['N1', 'winnew', ['cont', '@cupintro-go']], ['N2', 'winnew', ['cont', '@cupintro-go', '%go']], // 初めての大会: 結果だけ見るは押せず、理由が出る(r1115-057)
    ['Q1', 'mid', ['cont', /^⚔修行/]], ['Q6', 'mid', ['cont', /^⚔修行/]], ['Q7', 'mid', ['cont', /^⚔修行/, '$qok0']], // SHOT_SPECIES=Golem で撮ると、間合い適性(零 A・近 E・中 G・遠 G)で同じランクの技の率が分かれる(r1115-041)
    ['Q4', 'mid', ['cont', /^⚔修行/, '$qok0']], ['Q5', 'mid', ['cont', /^⚔修行/, '$qok0', '$qok1']], ['Q2', 'mid', ['cont', /^⚔修行/, '@shugyo']], ['Q2b', 'mid', ['cont', /^⚔修行/, '@shugyo', '@qskip']], ['Q3', 'mid', ['cont', /^⚔修行/, '@shugyo', '@qskip', '@qnext']], // 修行の段の演出 → 「結果へ」(Fable ①-12)
    ['QL1', 'qhit', ['cont', /^⚔修行/, '$qok0', '@shugyo', '@qskip']], ['QL2', 'qmiss', ['cont', /^⚔修行/, '$qok0', '@shugyo', '@qskip']], ['QL3', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', '@qskip']], // 技を覚えた/覚えられなかった/超修行で1つだけ(r1115-063)
    ['QH0', 'hplow', ['cont']], ['QH1', 'hpmid', ['cont', /^⚔修行/, '$qok0', '$qok1']], // 体力が足りない: ホームの修行が押せない/超修行だけ行けない(r1115-062)
    // 修行の段の演出(r1115-060): 超修行で2つ選び1つ当たり(qmix)。段ごとに待って撮る(0 一言 1.0秒 → STAGE 1・2 各2.6秒 → 編成のおかげ 2.4秒 → 技のくじ 2.8秒)
    ['QF0', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', 'w900']], ['QF1', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', 'w1700']], ['QF2', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', 'w4300']],
    ['QF3', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', 'w6900']], ['QF4', 'qmix', ['cont', /^⚔修行/, '$qok0', '$qok1', '@shugyo', 'w9800']], ['QF5', 'qmiss', ['cont', /^⚔修行/, '$qok0', '@shugyo', 'w9800']],
    // 期末の大会の当日(参考 te-30〜34): 当日のメイン(能力と大会だけ)→ 受付に1つ → 参加の確認 → 紋章の入り → 表
    ['K0', 'kimatsu', ['cont']], ['K1', 'kimatsu', ['cont', '@precup']], ['K2', 'kimatsu', ['cont', '@precup', '@enter']], ['K2c', 'kimatsu', ['cont', '@precup', '@enter', '@pre-cancel']],
    ['K3', 'kimatsu', ['cont', '@precup', '@enter', '@yes']], ['K4', 'kimatsu', ['cont', '@precup', '@enter', '@yes', '@cupintro-go']],
    ['S0', 'summit', ['cont']], ['S2', 'summit', ['cont', '@precup', '@enter']],
    ['G1', 'gameover', ['cont']],
    // マスモン一覧(モンサク)の画面(2026-11-14 作り直し): X0 入口・X3 一覧・X4 詳細(基礎・技)・X5 特徴と育成情報・X6 適性とアシスト・X7 お別れのタブ・X8 表示の切り替えの小窓
    ['X0', 'box', ['@openbox']], ['X3', 'box', ['@openbox', '@mmlist']], ['X4', 'box', ['@openbox', '@mmlist', '@boxmon=b1']],
    ['X13', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-btab=assist']], ['X14', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-btab=info']], ['X15', 'box', ['@openbox', '@mmlist', '@boxmon=b2', '#detail-btab=assist']], // 詳細の下の段のタブ(技・アシスト・育成情報・r1115-095)
    ['X5', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-tab=feat']], ['X6', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#detail-btab=tech']],
    ['X9', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '#tech=sk-0405']],
    ['X11', 'box', ['@openbox', '@mmlist', '@boxmon=bx3']], ['X12', 'box', ['@openbox', '@mmlist', '@boxmon=bx5']], // 資料に無い技(オリジナルの子)の影絵の絵
    ['X10', 'box', ['@openbox', '@mmlist', '@boxmon=bx0']], // 同じ間合い・同じランクに技が2つある種族(スネグーラチカ): そのランクの段が2行になる // 詳細の技の升目で、覚えていない技を押した所(右の詳細に覚え方の条件)
    ['A1', 'box', ['@openbox', '#mm-open-assist']], ['A2', 'box', ['@openbox', '#mm-open-assist', '#assist-mon=as1']], ['A3', 'box', ['@openbox', '#mm-open-assist', '#assist-tab-rm', '#assist-mon=as1', '#assist-mon=as3', '#assist-remove']], // メモモン: 押すとマスモンと同じ詳細(アシストのタブから)・外すはタブで選ぶ(r1119-006)
    ['A4', 'box', ['@openbox', '#mm-open-assist', '#assist-mon=as1', '#detail-btab=info']], ['A5', 'box', ['@openbox', '#mm-open-assist', '#assist-mon=as2']],
    ['F1', 'box', ['@openbox', '@mmlist', '@mmbye', '@boxmon=b2', '#mm-bye']], ['F2', 'box', ['@openbox', '@fuse', '~fuse-pick=b1', '~fuse-pick=b2']],
    // 編成(r1115-096・115 で6枠+全画面の選ぶ画面に作り直し): T1 = 枠を押して選ぶ画面のメモリアルのタブ(見出し assist-head)/ T2 = メモリアルの as1・as3 を1・2枠目に入れて決定 → 編成の札に2体が入ったか
    ['T1', 'box', [/新しく育成/, /次へ/, /このモンスターにする/, '#slot=0', '#tp-tab=memo', '^assist-head']],
    ['T2', 'box', [/新しく育成/, /次へ/, /このモンスターにする/, '#slot=0', '#tp-tab=memo', '#tp-item=as1', '#tp-ok', '#slot=1', '#tp-tab=memo', '#tp-item=as3', '#tp-ok', '^team-slot-assist=as1', '^team-slot-assist=as3']],
    ['F3', 'box', ['@openbox', '@mmlist', '@mmbye', '@boxmon=b2', '#mm-bye', '#mm-bye-yes']], ['K9', 'box', ['@openbox']],
    ['F4', 'box', ['@openbox', '@fuse', '~fuse-pick=b1', '~fuse-pick=b2', '~fuse-go', 'w1100', '~fuse-go']], ['F5', 'box', ['@openbox', '@fuse', '~fuse-pick=b1', '~fuse-pick=b2', '~fuse-go', 'w1100', '~fuse-go', '=fuse-nameinput:ぷにお', '~fuse-namego']],
    ['F6', 'box', ['@openbox', '@fuse', '~fuse-pick=b1', '~fuse-pick=b2', '~fuse-go', 'w1100', '~fuse-go', '=fuse-nameinput:ぷにお', '~fuse-namego', '!sheet-close', '#mm-open-assist']],
    ['X7', 'box', ['@openbox', '@mmlist', '@mmbye']], ['X8', 'box', ['@openbox', '@mmlist', '@mmlabel']],
    ['X1', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '@edit']], ['X2', 'box', ['@openbox', '@mmlist', '@boxmon=b1', '@edit', '@editsave']],
    // 引退: 能力ポイントが残っていれば E3(使う)→ E0(最終の評価)→ E1(振り返り)→ E2(アシスト)→ マスモンボックス(2026-11-14 参考 v4 の順)
    ['E3', 'retire', ['cont']], ['E3b', 'retire', ['cont', '@bal']], ['E3u', 'retire', ['cont', '@plus=pow', '@plus=hit', '@ptminus=pow']], ['E3v', 'retire', ['cont', '@bal', '@ptminus=pow']], // 引退の能力ポイント: 押した能力だけ戻る・まとめて振ったあとも個別に戻せる(r1115-172) ['E0', 'retire', ['cont', '@bal', '@e3']], ['E1', 'retire', ['cont', '@bal', '@e3', '@e0']],
    ['E2', 'retire', ['cont', '@bal', '@e3', '@e0', '@e1', '@auto']], ['E9', 'retire', ['cont', '@bal', '@e3', '@e0', '@e1', '@auto', '@decide', '@decide', 'w1200']] /* w1200: ベスト3のせり上がり(650ms 待ち+0.8秒)が終わってから撮る。途中を撮ると1位が空に見えた(API 点検 r3-E9) */,
  ];
  try {
    for (const [w, h, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript((g) => { window.__SHOT_GOAL = g; }, Number(process.env.SHOT_GOAL) || 0);
      await page.addInitScript((sp) => { window.__SHOT_SPECIES = sp; }, process.env.SHOT_SPECIES || '');
      await page.addInitScript((r) => { if (r) window.__MSC_BK_RESULT = r; }, process.env.SHOT_BK_RESULT || ''); // win / lose: 決勝のあとの表(勝った側の線が優勝の札へ)
      await page.addInitScript((k) => { if (k) window.__MSC_BK_T = k; }, Number(process.env.SHOT_BK) || 0); // SHOT_BK=<倍率> で、組み合わせ表の演出をゆっくりにして段ごとに撮る
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      // SHOT_CSS='…' … 撮る前にその CSS を足す(success-shoot.js と同じ口)
      if (process.env.SHOT_CSS) await page.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }); }, process.env.SHOT_CSS);
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, meal: 1, rank: 1, scn: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); /* β版の説明は monsuc-beta-browser-check.js が見る */ localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'])); } catch (e) {} });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof MsxR3 === 'function' && typeof msxLoad === 'function' && typeof MASMON_CALC !== 'undefined', undefined, { timeout: 90000 });
      for (const [name, kind, steps] of SHOTS) {
        if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue; // ONLY=C1,C1w で撮る画面だけにする
        const label = `${name}${tag ? `(${tag})` : ''}`;
        await page.evaluate(async ({ kind, mk }) => {
          // eslint-disable-next-line no-new-func
          const make = new Function(`return (${mk})`)();
          if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; }
          localStorage.removeItem('mh_monsuc_box_v1'); localStorage.removeItem('mh_monsuc_assist_v1');
          if (kind === 'box') { // 保存枠に2体(名前と染色を変える画面を見る)
            const st = { life: 600, pow: 700, wise: 400, hit: 500, eva: 450, tough: 650 };
            localStorage.setItem('mh_monsuc_box_v1', JSON.stringify({ v: 1, cap: 30, memory: [], mons: [
              { id: 'b1', species: 'Mocchi', nick: 'もちまる', colors: [], gen: 1, st, techs: ['sk-0402', 'sk-0400', 'sk-0401'], mast: [40, 12, 0], fav: ['pow', 'tough'], coach: 'mua', endAt: Date.parse('2026-11-14T12:00:00+09:00'), ending: 'good', loy: 80, pop: 60, lv: 8, rank: 'A', grade: 'A2', score: 11800, raised: true, assists: [{ id: 'sokoji', lv: 5, n: 25 }, { id: 'kizuna', lv: 3, n: 12 }, { id: 'hirameki', lv: 2, n: 4 }], titles: [], keepMe: 'x' },
              { id: 'b2', species: 'Golem', nick: 'いわお', colors: [], gen: 1, st, techs: [], mast: [], loy: 70, pop: 40, lv: 6, rank: 'B', grade: 'B3', score: 9200, raised: true, assists: [], titles: [] },
              ...['Snegurochka', 'Golem', 'Mocchi', 'Eiki', 'Mocchi', 'KenshiMocchi'].map((sp, i) => ({ id: `bx${i}`, species: sp, nick: '', colors: [], gen: 1 + (i % 3), st, techs: [], mast: [], loy: 50, pop: 30, lv: 3 + i, rank: 'C', grade: `C${i + 1}`, score: 6000 + i * 350, raised: true, assists: [], titles: [] }))] }));
            // アシスト用に残した子(合体の親・お別れした子)。育成には使えず、編成にだけ入る(2026-11-14 社長)
            localStorage.setItem('mh_monsuc_assist_v1', JSON.stringify({ v: 1, cap: 100, mons: ['Pixie', 'Tiger', 'Ghost', 'Plant'].map((sp, i) => ({ id: `as${i + 1}`, species: sp, nick: ['ぴくる', 'キリモチ', 'きき', ''][i], colors: [], gen: 1, st, techs: [], mast: [], loy: 60, pop: 40, lv: 5, rank: ['A', 'B', 'S', 'C'][i], grade: ['A1', 'B2', 'S1', 'C3'][i], score: 9000, raised: true, fav: i === 0 ? ['wise', 'eva'] : [], assists: i === 0 ? [{ id: 'sokoji', lv: 4, n: 18 }] : [], titles: [], keep: { from: i % 2 ? 'farewell' : 'fuse', at: 1 } })) }));
            localStorage.removeItem('mh_monsuc_run_v1');
          } else { const run = await make(kind); localStorage.setItem('mh_monsuc_run_v1', JSON.stringify(run)); }
          const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' });
          document.body.appendChild(el);
          window.__msxRoot = ReactDOM.createRoot(el);
          window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
        }, { kind, mk: makeRun.toString() });
        await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
        const beat0 = name === 'R1' || name === 'E9' ? await page.evaluate(() => loadRhythmEventPoints()) : 0;
        const pend0 = name === 'E9' ? await page.evaluate(async () => { const r = await storeGet(MSX_KEYS.run, null); return r && r.s ? (r.s.beatEarned || 0) - (r.beatSent || 0) : 0; }) : 0; // まだ本編へ渡していない大会の分
        // 曲の呼び出しを記録する(段C 2026-11-14 社長「バトルに入ったらバトル用の音楽に」: 試合に入ったら大会の曲から original_battle へ)
        await page.evaluate(() => { window.__bgmLog = []; if (!window.__bgmHooked && typeof SuccessSound !== 'undefined') { window.__bgmHooked = true; const o = SuccessSound.scene; SuccessSound.scene = function (id) { window.__bgmLog.push(id); return o.apply(this, arguments); }; } });
        await page.evaluate(() => { window.__stageH = []; });
        const keysSeen = [];
        // SHOT_SEQ=MA1,C3 … その場面は操作のたびに1枚撮る(続きの止め絵。見せ場と流れの点検 r1119-033)
        const seq = SHOT_DIR && (process.env.SHOT_SEQ || '').split(',').includes(name);
        let seqN = 0;
        const seqShot = async () => { if (seq) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `r3-${name}~${String(seqN++).padStart(2, '0')}${tag ? `-${tag}` : ''}.png`) }); } };
        await seqShot();
        for (const st of steps) {
          const done = await page.evaluate(async (st) => {
            if (st.re) { const re = new RegExp(st.re); const b = [...document.querySelectorAll('.msx button')].find((x) => re.test((x.innerText || '').replace(/\s+/g, '')) && !x.disabled); if (b) b.click(); return !!b; }
            if (st === 'cont') { const b = [...document.querySelectorAll('.msx button')].find((x) => /続きから|結果を見る/.test(x.innerText || '')); if (b) b.click(); return !!b; }
            if (/^w\d+$/.test(st)) return true; // 'w1000' は待つだけ
            if (st[0] === '=') { const [k, v] = st.slice(1).split(':'); const e = document.querySelector(`[data-monsuc-${k}]`); if (!e) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); return true; } // '=k:文字' は [data-monsuc-k] の入力に文字を入れる
            if (st.startsWith('$qok')) { const n = Number(st.slice(4)) || 0; const c = [...document.querySelectorAll('.q-card.ok, .q-cell.ok')][n]; if (!c) return false; c.click(); return true; } // '$qokN' は修行の「覚えられる技」の緑の札を上からN番目(0始まり)で選ぶ(r1113-034)
            if (st[0] === '*') { const e = document.querySelector(st.slice(1)); if (e && !e.disabled) e.click(); return !!(e && !e.disabled); } // '*sel' は CSS の印で押す
            if (st === '@@h') { const b = document.querySelector('.msa-stagebox'); (window.__stageH = window.__stageH || []).push(b ? Math.round(b.getBoundingClientRect().height) : -1); return true; } // '@@h' は場の高さを覚える(番で変わらないかを見る)
            if (st[0] === '^') { const e = document.querySelector(`[data-msx-${st.slice(1)}]`); if (e) e.scrollIntoView({ block: 'start' }); return !!e; } // '^x' は [data-msx-x] が見出しの頭に来るところまでスクロール
            const [k, val] = st.slice(1).split('=');
            const pre = st[0] === '%' ? 'data-msc-' : st[0] === '#' ? 'data-msx-' : st[0] === '~' ? 'data-monsuc-' : st[0] === '!' ? 'data-mhl-' : 'data-msx-r3-'; // '#x' は [data-msx-x](詳細の窓 MsxMonDetail のタブなど)
            const b = document.querySelector(`[${pre}${k}${val ? `="${val}"` : ''}]`);
            if (b && !b.disabled) b.click(); return !!(b && !b.disabled);
          }, st instanceof RegExp ? { re: st.source } : st);
          if (!done) check(`${label}: 「${st}」が押せる`, false);
          await page.waitForTimeout(st === '%ready' ? 2500 : /^w\d+$/.test(st) ? Number(st.slice(1)) : 700);
          await seqShot();
          keysSeen.push(await page.evaluate(() => (window.Audio_ && Audio_.currentBgmKey ? Audio_.currentBgmKey() : null)));
        }
        if (name === 'A1') { const q = await page.evaluate(() => { const cs = [...document.querySelectorAll('[data-msx-assist-mon]')]; return { n: cs.length, mark: document.querySelectorAll('[data-msx-assist-mon] .mmg-as').length, hit: cs.filter((c) => { const nm = c.querySelector('.mmg-nm2, .mmg-lb'); if (!nm) return true; const r = nm.getBoundingClientRect(); return [...c.querySelectorAll('i')].some((e) => { const o = e.getBoundingClientRect(); return o.width > 0 && o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top; }); }).length }; });
          check(`${label}: メモモンの升の名前に札が重ならない(マスモンボックスと同じ見せ方)`, q.n === 4 && q.mark === 0 && q.hit === 0, JSON.stringify(q)); }
        if (name === 'A2') { const q = await page.evaluate(() => ({ det: !!document.querySelector('[data-msx-detail-btab="assist"].on'), why: !!document.querySelector('[data-msx-assist-why]'), txt: (document.body.innerText || '').includes('メモモン') }));
          check(`${label}: メモモンを押すとマスモンと同じ詳細がアシストのタブで開き、使えない理由が出る`, q.det && q.why && q.txt, JSON.stringify(q)); }
        if (name === 'MA1' || name === 'MA2') { const q = await page.evaluate(() => { const tools = [...document.querySelectorAll('.msa-tools')]; const bottom = tools.length ? Math.round(Math.max(...tools.map((e) => e.getBoundingClientRect().bottom))) : -1;
            const cards = [...document.querySelectorAll('[data-msa-dc-look="a"] [data-msa-dc-card]')]; const withT = cards.filter((c) => c.getAttribute('data-msa-dc-rep'));
            const full = withT.every((c) => c.querySelector('.msa-dc-ic') && c.querySelector('[data-msa-dc-l1]') && c.querySelector('[data-msa-dc-l2]'));
            const cut = withT.some((c) => [...c.querySelectorAll('.msa-tn, [data-msa-dc-l1], [data-msa-dc-l2]')].some((n) => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > c.getBoundingClientRect().right + 1));
            const blow = document.querySelector('[data-msxm-blow]'); const r3 = document.querySelector('.msxm-row.r3'); const hs = window.__stageH || [];
            return { bottom, n: cards.length, withT: withT.length, full, cut, blow: blow ? { far: blow.getAttribute('data-msxm-blow') === 'far', off: blow.disabled } : null, r3: r3 ? r3.children.length : 0, hs, h: innerHeight };
          });
          check(`${label}: 攻撃の札は案A(4枚・技のある札に絵と性能の2行・技名と数字が切れない)`, q.n === 4 && q.withT > 0 && q.full && !q.cut, JSON.stringify(q));
          check(`${label}: 移動の段は「◀後退・💨吹き飛ばし・前進▶」の横3つ`, q.r3 === 3 && !!q.blow, JSON.stringify(q.blow));
          if (name === 'MA2') check(`${label}: 零距離では吹き飛ばしが押せる`, q.blow && !q.blow.far && !q.blow.off, JSON.stringify(q.blow));
          if (!tag) check(`${label}: 下のボタン列まで1画面に収まる(縦390×844)`, q.bottom > 0 && q.bottom <= q.h, `${q.bottom}px / ${q.h}px`);
          if (name === 'MA1' && tag !== 'land') check(`${label}: 自分の番・演出中・次の番で場の高さが変わらない`, q.hs.length === 3 && Math.max(...q.hs) - Math.min(...q.hs) <= 2, JSON.stringify(q.hs)); }
        if (name === 'G2') { const g = await page.evaluate(() => { const top = document.querySelector('[data-msa-hud="A"] [data-msa-gauge="gt"]'); const bar = [...document.querySelectorAll('.msxm b')].find((b) => /^ガッツ \d+/.test(b.innerText || '')); const rd = document.querySelector('[data-msa-round]'); return { top: top ? Number(top.getAttribute('data-msa-gauge-v')) : null, bar: bar ? Number((bar.innerText.match(/\d+/) || [])[0]) : null, round: rd ? Number(rd.getAttribute('data-msa-round')) : null }; });
          check(`${label}: 自分の番のとき、上の帯と操作欄のガッツが同じ`, g.top != null && g.bar != null && Math.round(g.top) === g.bar, JSON.stringify(g));
          check(`${label}: 2ラウンド目の自分の番は、上の帯のラウンドも 2`, g.round === 2, JSON.stringify(g)); }
        if (name === 'G2' || name === 'MA1' || name === 'MA2') { const ov = await page.evaluate(() => { const box = document.querySelector('.msa-stagebox'); const bar = document.querySelector('[data-msxm] .msxm-top'); const say = document.querySelector('[data-msa-say]'); if (!box || !bar) return null;
            // 2026-11-18 社長「極力1画面に」: 実況は場の下の行から場の上への重ねに変わった。場の要素(実況の重ね自身を除く)が操作欄に重ならないことと、実況が場の中に収まることを見る
            const inSay = (e) => say && (e === say || say.contains(e));
            const cand = [...box.querySelectorAll('*')].filter((e) => !inSay(e));
            const low = Math.max(...cand.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => e.getBoundingClientRect().bottom), box.getBoundingClientRect().bottom);
            const lowEl = cand.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
            const br = box.getBoundingClientRect(); const sr = say ? say.getBoundingClientRect() : null;
            return { boxBottom: Math.round(br.bottom), lowEl: lowEl ? String(lowEl.className && lowEl.className.baseVal != null ? lowEl.className.baseVal : lowEl.className).slice(0, 40) : '', sayTxt: say ? say.innerText.slice(0, 20) : '', stageLow: Math.round(low), sayTop: sr ? Math.round(sr.top) : null, sayIn: sr ? (sr.top >= br.top - 1 && sr.bottom <= br.bottom + 1) : false, barTop: Math.round(bar.getBoundingClientRect().top), boxH: Math.round(br.height) }; });
          check(`${label}: 場(間合いの札まで)が操作欄の見出しに重ならず、実況は場の中に重なる`, ov && ov.stageLow <= ov.barTop + 1 && ov.sayIn, JSON.stringify(ov)); }
        if (name === 'W1') { const lg = await page.evaluate(() => window.__bgmLog.slice()); const iC = lg.lastIndexOf('cupPre'), iB = lg.lastIndexOf('cupMatch');
          check(`${label}: 試合に入ったら、場面の曲が cupPre から cupMatch(バトルの曲 ichika_battle)へ替わる`, iC >= 0 && iB > iC, lg.join('>'));
          // 場面→曲の表: 試合の前の画面(cupPre=能力を見るバトルカード)と試合(cupMatch)は別の曲で、音源のファイルも別
          const tb = await page.evaluate(() => ({ pre: successSoundBgm('cupPre'), match: successSoundBgm('cupMatch'), srcPre: (BGM_TRACK_BY_ID[successSoundBgm('cupPre')] || {}).src, srcMatch: (BGM_TRACK_BY_ID[successSoundBgm('cupMatch')] || {}).src }));
          check(`${label}: 前の画面の曲(${tb.pre})と試合の曲(${tb.match})は別の曲・別の音源`, !!tb.pre && !!tb.match && tb.pre !== tb.match && !!tb.srcPre && tb.srcPre !== tb.srcMatch, JSON.stringify(tb)); }
        await page.waitForTimeout(500 + (Number(process.env.SHOT_WAIT) || 0)); // SHOT_WAIT=<ms> で、動く演出の途中を撮る
        const m = await page.evaluate(() => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          const R = root.getBoundingClientRect();
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map((e) => (e.innerText || e.className).slice(0, 20));
          const box = JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null');
          return { ok: true, text: root.innerText.length, over, head: root.innerText.slice(0, 160).replace(/\s+/g, ' '), boxN: box && Array.isArray(box.mons) ? box.mons.length : 0, run: localStorage.getItem('mh_monsuc_run_v1') };
        });
        const u = await page.evaluate(msxUiRulesMeasure);
        // 演出の飾り(舞う葉っぱ・炎など、絵文字だけの粒)が画面の外へ出るのは見ない
        const strip = await page.evaluate(msxScrollStripTexts);
        const wr = (await scanTextWrap(page)).filter((x) => !(x.kind === '画面の外へはみ出した文字' && (!/[0-9A-Za-zぁ-んァ-ヶ一-龠]/.test(x.text) || strip.some((t) => t.startsWith(x.text.slice(0, 12))))));
        // 基準の大きさ(縦390・横844)では止める。小さい画面・大きい文字は、直す順番待ちの一覧として知らせるだけ(2026-11-14)
        if (!tag) check(`${label}: 文字が値・札の途中で折れない(scanTextWrap)`, wr.length === 0, wr.slice(0, 3).map((x) => `${x.kind}「${x.text}」`).join(' / '));
        // 賞品の札は幅320 でも見る(r1115-201: 「+12 ⏎ 0」と数が割れた)
        if (tag) { const pz = wr.filter((x) => /data-msx-r3-prize/.test(x.where)); check(`${label}: 賞品の札の字が値の途中で折れない(scanTextWrap)`, pz.length === 0, pz.slice(0, 3).map((x) => `${x.kind}「${x.text}」`).join(' / ')); }
        else if (wr.length) console.log(`  見張り ${label}: 文字の折れ ${wr.length}件 ${wr.slice(0, 2).map((x) => `${x.kind}「${x.text}」`).join(' / ')}`);
        // 保存枠(マスモンの画面)はクラフト12が参考 mm-01〜04 の形へ作り直し中。それまでは知らせるだけ(作り直したら外す)
        // 大会の1戦の画面(B・C2〜C4・W・R)はバトル部の受け持ち(MonsucCupShow)。決まりは渡してあるので、直るまでは知らせるだけ
        const blankLater = ['X1', 'X2'].includes(name) || /^(B\d|C[2-4]|W\d|R\d)/.test(name);
        if (u && u.blank != null && blankLater && u.blank > BLANK_MAX) console.log(`  見張り ${label}: 下の空き ${u.blank}px(作り直し待ち)`);
        else if (u && u.blank != null) check(`${label}: 下に大きな空きが無い(${BLANK_MAX}px まで)`, u.blank <= BLANK_MAX, `${u.blank}px`);
        if (u) check(`${label}: 見せ場の数字(.v-num)が真ん中`, u.offNum.length === 0, u.offNum.slice(0, 3).join(' / '));
        if (u) check(`${label}: ボタンの文字・記号が上下左右とも真ん中`, u.offBtn.length === 0, u.offBtn.slice(0, 4).join(' / '));
        { const px = await measureBtnPixels(page); check(`${label}: 描いた画素でも字・記号がボタンの真ん中(±1.5px)`, px.length === 0, px.slice(0, 4).join(' / ')); }
        check(`${label}: 画面が出る`, m.ok && m.text > 20, m.head);
        check(`${label}: 枠からはみ出さない`, m.ok && m.over.length === 0, m.over && m.over.slice(0, 3).join(' / '));
        if (name === 'X2') { const b = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null')); const m = b && b.mons.find((x) => x.id === 'b1');
          check(`${label}: 名前と染色を決めても、ほかの項目と子は残る`, !!m && m.nick === 'もちまる' && m.keepMe === 'x' && Array.isArray(m.colors) && b.mons.length === 8); }
        if (name === 'K0' || name === 'S0') { const k = await page.evaluate(() => ({ n: document.querySelectorAll('[data-msx-pre-main] button').length, train: [...document.querySelectorAll('.msx .v-act button')].some((b) => /トレーニング|修行/.test(b.innerText || '')), bracket: !!document.querySelector('[data-msc-go], [data-msx-r3-cupintro]') }));
          check(`${label}: 当日のメインのボタンは「能力」と「大会」の2つだけ・まだ表へ飛ばない`, k.n === 2 && !k.train && !k.bracket, JSON.stringify(k)); }
        if (/^(K[0-3]|S[02]|Q1)$/.test(name) && !tag) { // 画面の決まり(MONSUC_UI): 中身のいちばん下とボタンの列のあいだは 48px まで(縦)
          const gap = await page.evaluate(() => { const ft = document.querySelector('.msx .v-ft'); const kids = [...document.querySelectorAll('.msx .v-body > *')].filter((e) => getComputedStyle(e).position !== 'absolute' && e.getBoundingClientRect().height > 0); if (!ft || !kids.length) return -1; const rs = kids.map((e) => e.getBoundingClientRect()).sort((x, y) => x.top - y.top); let mid = 0; for (let i = 1; i < rs.length; i++) mid = Math.max(mid, rs[i].top - Math.max(...rs.slice(0, i).map((r) => r.bottom))); return Math.round(Math.max(mid, ft.getBoundingClientRect().top - Math.max(...rs.map((r) => r.bottom)))); });
          check(`${label}: 下の空き・札のあいだの空きが 48px まで`, gap >= 0 && gap <= 48, `${gap}px`); }
        if (name === 'E3u' || name === 'E3v') { const q = await page.evaluate(() => { const ad = {}; document.querySelectorAll('.v-pa > div').forEach((r) => { const m = r.querySelector('[data-msx-r3-plus]'); if (m) ad[m.getAttribute('data-msx-r3-plus')] = Number((r.querySelector('.st b') || {}).innerText || 0); }); return ad; });
          if (name === 'E3u') check(`${label}: ちから+1→命中+1→ちから−1 で、ちからだけ戻り命中は +1 のまま`, q.pow === 0 && q.hit === 1, JSON.stringify(q));
          else check(`${label}: バランスで振ったあとの「−」で、ちからだけ1つ戻る`, q.hit >= 1 && q.pow === q.hit - 1, JSON.stringify(q)); }
        if (name === 'Y1') { const q = await page.evaluate(() => { const b = document.querySelector('[data-msc-quick]'); return { has: !!b, on: !!(b && !b.disabled), why: !!document.querySelector('[data-msc-quick-why]') }; });
          check(`${label}: 優勝したことのある大会は「結果だけ見る」が押せる`, q.has && q.on && !q.why, JSON.stringify(q)); }
        if (name === 'N1' || name === 'N2') { const q = await page.evaluate(() => { const b = document.querySelector('[data-msc-quick]'); const w = document.querySelector('[data-msc-quick-why]'); return { has: !!b, off: !!(b && b.disabled), why: !!w }; });
          check(`${label}: 優勝したことのない大会は「結果だけ見る」が押せず、理由が出る`, q.has && q.off && q.why, JSON.stringify(q)); }
        if ((name === 'N1' || name === 'N2' || name === 'Y1') && !tag) { const fb = await page.evaluate(() => { const b = document.querySelector('[data-msc-quick]'); return b ? Math.round(b.getBoundingClientRect().bottom) : -1; });
          check(`${label}: 「結果だけ見る」のボタンがスクロールせずに画面に収まる`, fb > 0 && fb <= h, `${fb}px / ${h}px`); }
        if (name === 'K2') { const pz = await page.evaluate(() => { const box = document.querySelector('[data-msx-r3-cupwin] .in'); if (!box) return { ok: false }; const R = box.getBoundingClientRect(); const bs = [...box.querySelectorAll('[data-msx-r3-prize]')]; return { ok: bs.length > 0 && bs.every((b) => { const r = b.getBoundingClientRect(); return r.left >= R.left - 1 && r.right <= R.right + 1; }), n: bs.length }; });
          check(`${label}: 獲得物の札が全部 枠の中に見える`, pz.ok, `${pz.n}枚`); }
        if (name === 'R1') { // ビートP: 優勝の分が本編のビートPに1回だけ足される(同じ育成をもう一度保存しても増えない)
          const bp = await page.evaluate(async (w0) => { const run = await storeGet(MSX_KEYS.run, null); let rv = Number(run && run.rev) || 0; const R = (o) => ({ ...o, rev: ++rv }); // 保存の版番号(r1115-200 3b): 画面と同じく保存のたびに進める
            const w1 = await loadRhythmEventPoints(); if (run) await msxSaveRun(R(run)); if (run) await msxSaveRun(R(run)); const w2 = await loadRhythmEventPoints();
            // デバッグの入口からの育成: 渡した量の印は進むが、財布は増えない
            const more = { ...run, s: { ...run.s, beatEarned: (run.s.beatEarned || 0) + 100 } }; more.beatSent = more.s.beatEarned; await msxSaveRun(R(more), true);
            const w3 = await loadRhythmEventPoints(); const st = await storeGet(MSX_KEYS.run, null); if (run) await msxSaveRun(R(run), true);
            // ほかのタブで引退・やめたあとの古い画面: 途中の育成を消してから古い run で保存 → 財布は増えず、育成も戻らない
            await msxClearRun(); const stale = { ...run, s: { ...run.s, beatEarned: (run.s.beatEarned || 0) + 50 } }; stale.beatSent = stale.s.beatEarned; await msxSaveRun(stale); const w4 = await loadRhythmEventPoints(); const back = await storeGet(MSX_KEYS.run, null); if (run) await storeSet(MSX_KEYS.run, run);
            return { sent: run && run.beatSent, earned: run && run.s && run.s.beatEarned, d1: w1 - w0, d2: w2 - w1, dbg: w3 - w2, dbgSent: st && st.beatSent === more.beatSent, stale: w4 - w3, staleBack: !!back }; }, beat0);
          check(`${label}: 優勝のビートPが本編へ1回だけ足される`, bp.sent > 0 && bp.sent === bp.earned && bp.d1 === bp.sent && bp.d2 === 0, JSON.stringify(bp));
          check(`${label}: デバッグの入口からの育成では、本編のビートPに足さない`, bp.dbg === 0 && bp.dbgSent, JSON.stringify(bp));
          check(`${label}: 途中の育成を消したあとの古い画面の保存では、財布が増えず育成も戻らない`, bp.stale === 0 && !bp.staleBack, JSON.stringify(bp)); }
        if (name === 'F3') { // お別れすると、箱から消え、アシスト用の置き場に残る(5体目)・もう一度お別れしても二重に入らない
          const f = await page.evaluate(async () => { const a = JSON.parse(localStorage.getItem('mh_monsuc_assist_v1') || 'null'); const b = JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null'); const m = a && a.mons.find((x) => x.id === 'b2'); const again = await msxAssistKeep([{ id: 'b2', species: 'Golem' }], 'farewell'); return { n: a && a.mons.length, kept: !!m, from: m && m.keep && m.keep.from, inBox: !!(b && b.mons.some((x) => x.id === 'b2')), again: again.kept }; });
          check(`${label}: お別れで、箱から消え、アシスト用に残る(二重には入らない)`, f.n === 5 && f.kept && f.from === 'farewell' && !f.inBox && f.again === 0, JSON.stringify(f)); }
        if (name === 'K9') { // 置き場は100体まで: いっぱいなら入れず、読めない値は壊さず空で始める
          const k = await page.evaluate(async () => {
            const many = Array.from({ length: 120 }, (_, i) => ({ id: `z${i}`, species: 'Mocchi', st: {}, techs: [], mast: [] }));
            await storeSet('mh_monsuc_assist_v1', { v: 1, cap: 100, mons: [] });
            const r = await msxAssistKeep(many, 'fuse'); const a = JSON.parse(localStorage.getItem('mh_monsuc_assist_v1'));
            const r2 = await msxAssistKeep([{ id: 'zz', species: 'Mocchi', st: {}, techs: [], mast: [] }], 'farewell');
            const rm = await msxAssistRemove(['z0', 'z1']); const r3 = await msxAssistKeep([{ id: 'zz', species: 'Mocchi', st: {}, techs: [], mast: [] }], 'farewell');
            localStorage.setItem('mh_monsuc_assist_v1', JSON.stringify('こわれた')); const broken = await msxReadAssist();
            return { kept: r.kept, full: r.full, n: a.mons.length, r2: r2.kept, r2full: r2.full, rm: rm.mons.length, r3: r3.kept, brokenN: broken.mons.length, copy: !!localStorage.getItem('mh_monsuc_assist_v1_broken') }; });
          check(`${label}: 置き場は100体まで・外すと空く・壊れた値は写して空で始める`, k.kept === 100 && k.full === 20 && k.n === 100 && k.r2 === 0 && k.r2full === 1 && k.rm === 98 && k.r3 === 1 && k.brokenN === 0 && k.copy, JSON.stringify(k)); }
        if (name === 'C3b') { const q = await page.evaluate(async () => { const run = await storeGet(MSX_KEYS.run, null); return { panel: !!document.querySelector('[data-msx-r3-meal]'), kept: !!(run && run.s && run.s.mealReady), phase: run && run.phase }; });
          check(`${label}: 優勝しても その場では ごはんは出ず、権利が育成に残る(ファームで あげる)`, !q.panel && q.kept, JSON.stringify(q)); }
        if (name === 'K2c') check(`${label}: キャンセルで受付へ戻る`, await page.evaluate(() => !document.querySelector('[data-msx-r3-cupwin]') && !!document.querySelector('[data-msx-r3-pre-card]')));
        if (name === 'K3') check(`${label}: 「はい」で紋章の入り`, await page.evaluate(() => !!document.querySelector('[data-msx-r3-cupintro="junior"]')));
        if (name === 'E9') { const e = await page.evaluate(async (w0) => { const b = await storeGet(MSX_KEYS.box, null); const m = b && b.mons && b.mons[0]; const w1 = await loadRhythmEventPoints(); return { rank: m && m.rank, d: w1 - w0, end: msxSuc.SUC.beatOfEnd(m && m.rank) }; }, beat0); e.want = e.end + pend0;
          check(`${label}: 引退したら、総合力のランクのビートPが1回だけ足される`, e.d === e.want, JSON.stringify(e)); }
        if (name === 'E9') check(`${label}: 保存枠に1体入り、途中の育成が消える`, m.boxN === 1 && (m.run === null || m.run === 'null'), `保存枠 ${m.boxN}体`);
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `r3-${name}${tag ? `-${tag}` : ''}.png`) }); await uiMeasure.record(page, path.join(SHOT_DIR, `r3-${name}${tag ? `-${tag}` : ''}.png`)); }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();
