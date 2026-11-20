#!/usr/bin/env node
// モンヒロサクセス(モンサク)の見た目を、分析の入り口(analysis-gateway・kind ui-check)経由で Claude API(Opus)に点検してもらう道具。
// r1119-014 PR3 の続き(2026-11-19 社長「いまいちすぎるから API 通し点検を早くできるようにして」)。
//
// 撮る(どちらも偽のデータでページの中だけ。本番のサーバーへは送らない。デバッグの合言葉は使わない):
//   node tools/browser/visual-shoot.js --only <monsuc-* の id を , で> --sizes tate,yoko,yoko-s --out <入口の結果>
//       … HOME から開く入口・ランキング(偽の行)・ヘルプ・助手の説明など(visual-scenes.js の group:'monsuc')
//   SHOT_SIZES=base,land,s568 SHOT_DIR=<奥>/msx node tools/success/success-shoot.js      … 育成の開始1/6〜6/6・毎ターン・図鑑
//   SHOT_SIZES=base,land,s568 SHOT_DIR=<奥>/r3  node tools/success/success-r3-shoot.js   … 大会・修行・期末・ファイナル・引退・ボックス・合体・お別れ
//   SHOT_SIZES=base,land,s568 SHOT_DIR=<奥>/arc node tools/success/success-arc-shoot.js  … みゅあ編のお話
//   (各道具の画面の出力を <奥>/msx.log などに残すと、NG の行を「機械の見つけ物」として一緒に送る)
//
// 送る:
//   node tools/browser/visual-api-monsuc.js --home <入口の結果> --deep <奥> --out <置き場>            見積りだけ(送らない)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-monsuc.js ... --send                  バッチで送る(半額・急がない物)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-monsuc.js ... --send --message        その場で返す(急ぐ物・倍の値段)
//   ANALYSIS_GATEWAY_TOKEN=proxy node tools/browser/visual-api-monsuc.js --out <置き場> --fetch        バッチの結果を受け取り、表にする
//   --only <場面の名前の一部を , で>  場面を絞る / --max-usd 15  見積りがこれを超えたら送らない(既定 $15・入り口は1回 $20・1日 $25)
//
// 頼みの文は tools/browser/prompts/monsuc-ui-check.md(社長の目線を書いた物)。参考の止め絵(docs/reference/line-mf/)を場面のまとまりごとに1枚添える。
// 合言葉は環境のネットワークの秘密で自動で付く(ANALYSIS_GATEWAY_TOKEN=proxy)。値はどこにも書かない。
// 結果: <置き場>/manifest.json(何をどの頼みで送ったか)・batch.json・api-findings.json・api-findings.md
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const gw = require('../analysis/gateway-client');
const uiMeasure = require('./ui-measure');

const argv = process.argv.slice(2);
const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const OUT = opt('--out');
if (!OUT) { console.log('使い方はこのファイルの先頭を見てください(--out は必ず要る)'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
let sharp;
try { sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (e) { sharp = null; }

const PROMPT_FILE = path.join(__dirname, 'prompts', 'monsuc-ui-check.md');
const MAX_SCENES_PER_REQ = 6; // 1つの頼みに 6場面 × 3つの大きさ = 18枚 + 参考 1枚(入り口の上限は20枚)
const MAX_IMGS_PER_REQ = 18; // 大きさを絞ったとき(--sizes tate,pc)は、18枚に収まるだけ場面を詰める
// 入り口の上限: その場で返す(--message)は 16000、バッチは 32000(analysis-gateway/core.js)。超えると g001 から断られる(2026-11-20)
const TOKEN_CAP = has('--message') ? 16000 : 32000;
const MAX_TOKENS = Math.min(Number(opt('--max-tokens', has('--message') ? '16000' : '24000')) || TOKEN_CAP, TOKEN_CAP); // 12000 だと考えに使って 35本中12本が途中で切れた(2026-11-19)
const EFFORT = opt('--effort', 'high');
const MAX_USD = Number(opt('--max-usd', '15'));
const SIZE_OF = { '': 'tate', land: 'yoko', s568: 'yoko-s', pc: 'pc' };
const SIZE_NAME = { tate: '縦390×844', yoko: '横844×390', 'yoko-s': '小さい横568×320', pc: 'PC1280×800' };
// --sizes tate,pc … 送る大きさを絞る(r1119-026 でモンサクは横を見ない。既定は撮ってある物を全部)
const SIZES = opt('--sizes', 'tate,pc,yoko,yoko-s').split(',').filter((x) => x in SIZE_NAME);

// 奥の撮影の道具の場面の名前(名札 → 日本語)。道具の表の注に合わせる。合わない物は名札のまま送る
const LABELS = {
  msx: [
    [/^H0$/, 'ホーム(育成なし)'], [/^H1$/, 'ホーム(途中の育成あり)'], [/^RW\d$/, '育成ホームの歩き回り'], [/^OV\d$/, '上限アップ(能力の上限を超えた所)'],
    [/^DX[1-3]$/, 'イベント図鑑(一覧)'], [/^DX[4-7]$/, 'イベント図鑑(読む画面・押す前後・戻る)'], [/^HB\d$/, 'ベースモン(モンサクのホーム)'],
    [/^S0$/, '育成の開始 ストーリー選択'], [/^TP\d$/, '育成の開始1/6 技の升の選び替え'], [/^S1$/, '育成の開始1/6 育てる子を選ぶ'], [/^S1[DAF]$/, '育成の開始1/6 子の詳細(基礎・適性・特徴)'],
    [/^S1Z/, '育成の開始1/6 合体の子を選ぶ'], [/^S2$/, '育成の開始2/6 編成'], [/^S2P$/, '育成の開始2/6 枠を選ぶ窓'], [/^S2B$/, '育成の開始2/6 枠にベースモンを入れた'],
    [/^S2G$/, '育成の開始2/6 編成の集まり'], [/^S2E$/, '育成の開始2/6 効果一覧の窓'], [/^S2F$/, '育成の開始2/6 フレンドの一覧'], [/^S3$/, '育成の開始3/6'],
    [/^S4/, '育成の開始4/6 持ちこみ'], [/^S5$/, '育成の開始5/6'], [/^S6$/, '育成の開始6/6(確認)'], [/^IN2?$/, '育成の始まりの場面'],
    [/^M1$/, '育成の毎ターン メイン'], [/^M2$/, '育成の毎ターン メイン(ようすあり)'], [/^M3A?$/, '育成の毎ターン 持ち物'], [/^M1A$/, 'メイン 能力の列を押した素質の表示'],
    [/^M1[DF]$/, 'メイン 子の詳細'], [/^T\d$/, '育成の毎ターン トレーニングを選ぶ'], [/^Q[01]$/, '章の区切り'], [/^R1$/, '休む/ほめる・叱る'],
    [/^K\d|^K3A$/, 'トレーニングの結果'], [/^I1$/, 'いっさ(助手のひとこと)'], [/^P\d$/, '能力ポイントの振り分け'], [/^E[1-5]$/, '育成イベント(選択肢・結果)'],
    [/^R\d/, 'ほめる・叱る(場面ごとの選択肢)'], [/^PL1$/, '方針が変わったあとのメイン'], [/^KI$/, '章の終わり'], [/^CL$/, '通院の結果'], [/^TV\d$/, '編成の子のイベント'],
  ],
  r3: [
    [/^C1/, '大会の受付(一覧・確認の窓・賞品・次の月)'], [/^B1$|^C2$|^W1$/, '大会の入り・試合の前'], [/^MA\d$|^G2$/, '大会の試合(手動)'], [/^B2$/, '大会の試合(結果だけ見る)'],
    [/^R1$|^C3/, '大会の結果'], [/^C4/, '大会で負けた(やり直し・あきらめる)'], [/^Y1$|^N\d$/, '初めての大会'], [/^Q[1-7]b?$/, '修行(技を選ぶ・修行する)'],
    [/^QL\d$/, '修行の結果'], [/^QH\d$/, '体力が足りないときの修行'], [/^QF\d$/, '修行の演出の段'], [/^K\d/, '期末の大会の当日(受付・確認)'],
    [/^S0$|^S2$/, 'ヒーローズファイナル(当日・受付)'], [/^G1$/, 'ゲームオーバー'], [/^X0$/, 'マスモンボックスの入口'], [/^X[3-6]$|^X1[0-5]$|^X9$/, 'マスモンの詳細(タブ)'],
    [/^X7$/, 'お別れのタブ'], [/^X8$/, 'ボックスの表示の切り替え'], [/^X[12]$/, '名前と染色を変える'], [/^A\d$/, 'メモモン(アシスト用に残した子)・編成'],
    [/^F[12]$/, 'お別れ・合体'], [/^F3$/, 'お別れの確認のあと'], [/^F[4-6]$/, '合体'], [/^T\d$/, '編成(枠を押して選ぶ画面)'], [/^K9$/, 'マスモンボックス'],
    [/^E3/, '引退 能力ポイントを使う'], [/^E0$/, '引退 最終の評価'], [/^E1$/, '引退 振り返り'], [/^E2$/, '引退 アシスト'], [/^E9$/, '引退のあと(保存枠・ボックスへ)'],
  ],
  arc: [[/./, 'みゅあ編のお話(ストーリー)']],
  // 助手との対戦(tools/battle/msa-beta-shots.js の止め絵。名札は <auto|manual>.<止め絵の名前>)
  asst: [
    [/\.1-prep/, '助手との対戦 準備(上)'], [/\.2b?-compare/, '助手との対戦 くらべる'], [/\.3-settings/, '助手との対戦 設定'],
    [/\.[4-6]-watch/, '助手との対戦 観戦(おまかせ)'], [/\.7[ab]-prep-rep/, '助手との対戦 準備 代わりの技'],
    [/\.8-manual-cards/, '助手との対戦 手動 技の札'], [/\.9b?-manual/, '助手との対戦 手動 技の一覧'], [/\.10-manual-after/, '助手との対戦 手動 技のあと'],
    [/\.11-manual-all/, '助手との対戦 手動 全部の技'], [/\.12-foe-list/, '助手との対戦 相手の技の一覧'], [/\.1[34]-blow/, '助手との対戦 吹き飛ばし'],
  ],
};
const labelOf = (tool, code) => { for (const [re, l] of LABELS[tool] || []) if (re.test(code)) return l; return code; };

// 場面のまとまりと、添える参考の止め絵(docs/reference/line-mf/ の止め絵。REF-MAP.md の行に合わせた)
const REF = 'docs/reference/line-mf';
const AREAS = [
  { key: 'home', re: /^home:monsuc-(story|home|new|basemon)$|^msx:(H|RW|HB|OV)/, name: '入口・モンサクのホーム', ref: `${REF}/master-monster-2026-11-14/01-lab-menu.png` },
  { key: 'rank', re: /^home:monsuc-rank/, name: 'ランキング', ref: null },
  { key: 'help', re: /^home:monsuc-(help|assistant)/, name: 'ヘルプ・助手の説明', ref: null },
  { key: 'dex', re: /^home:monsuc-dex|^msx:DX/, name: 'イベント図鑑', ref: null },
  { key: 'start', re: /^msx:(S\d|TP|IN)/, name: '育成の開始1/6〜6/6', ref: `${REF}/assist-hensei-2026-11-19.png` },
  { key: 'turn', re: /^msx:/, name: '育成の毎ターン', ref: `${REF}/taikai-entry-2026-11-13/30-main-honban.jpg` },
  { key: 'cup', re: /^r3:(C|B|W|MA|G2|R1|Y|N|K\d|S0|S2)/, name: '大会・ヒーローズファイナル', ref: `${REF}/taikai-entry-2026-11-13/02-kakunin-earth.jpg` },
  { key: 'quest', re: /^r3:Q/, name: '修行', ref: null },
  { key: 'box', re: /^r3:(X|A|F|T|K9|G1)|^home:monsuc-box/, name: 'マスモンボックス・詳細・メモモン・合体・お別れ・編成', ref: `${REF}/monster-detail-basic-2026-11-14.png` },
  { key: 'retire', re: /^r3:E/, name: '引退', ref: null },
  { key: 'story', re: /^arc:/, name: 'お話(みゅあ編)', ref: null },
  { key: 'asst', re: /^asst:/, name: '助手との対戦', ref: null },
];
const areaOf = (key) => AREAS.find((a) => a.re.test(key)) || { key: 'etc', name: 'その他', ref: null };

// ---- 止め絵を集める ----
const FLOW_NAME = { TV1S: '編成の子のイベント その1(6つの拍・押すたびに1拍)', TV2S: '編成の子の小さな出来事(6つの拍)', SQE: '育成イベント1つ(起きてから戻るまで)', SQT: 'トレーニングの1ターン(選ぶ→結果→次の月)', SQV: '編成の子のイベント(トレーニングのあと)', SQC: '大会の1試合(入りから結果まで・オート)', S6: 'みゅあ編のお話 特別な結末(最後まで)', G4: 'みゅあ編のお話 良い結末', N2: 'みゅあ編のお話 悪い結末' };
const seqs = new Map(); // 続きの止め絵: 名前 → { key, label, frames }
const collect = () => {
  const scenes = new Map(); // key → { key, label, shots: { tate, yoko, 'yoko-s' }, machine: [] }
  const put = (key, label, size, file, machine = []) => {
    const sc = scenes.get(key) || scenes.set(key, { key, label, shots: {}, machine: [] }).get(key);
    sc.shots[size] = file;
    machine.forEach((m) => sc.machine.push(`${size}: ${m}`));
  };
  const home = opt('--home');
  if (home && fs.existsSync(path.join(home, 'results.json'))) {
    const res = JSON.parse(fs.readFileSync(path.join(home, 'results.json'), 'utf8'));
    for (const sc of res.scenes.filter((x) => /^monsuc-/.test(x.id))) {
      for (const tag of SIZES) {
        const f = path.join(home, 'shots', tag, `${sc.id}.png`);
        if (!fs.existsSync(f)) continue;
        const rel = path.join('shots', tag, `${sc.id}.png`);
        put(`home:${sc.id}`, sc.name, tag, f, res.findings.filter((x) => x.shot === rel).map((x) => (/^測る:/.test(x.kind) ? `[測る・${x.priority}] ${x.kind.slice(3)}: ${x.detail}` : `${x.kind} ${x.detail}`).slice(0, 220)));
      }
    }
  }
  const deep = opt('--deep');
  if (deep) {
    for (const tool of ['msx', 'r3', 'arc', 'asst']) {
      const dir = path.join(deep, tool);
      if (!fs.existsSync(dir)) continue;
      const log = fs.existsSync(`${dir}.log`) ? fs.readFileSync(`${dir}.log`, 'utf8').split('\n').filter((l) => l.startsWith('NG')) : [];
      const meas = uiMeasure.load(dir); // 撮るときに測った大きさの釣り合い(tools/browser/ui-measure.js)
      for (const f of fs.readdirSync(dir).sort()) {
        const m = new RegExp(`^${tool}-(.+?)(?:-(land|s568|s320|ip|land667|big|landbig|s320big|pc))?\\.png$`).exec(f);
        if (!m || !((m[2] || '') in SIZE_OF)) continue;
        const code = m[1], size = SIZE_OF[m[2] || ''];
        if (!SIZES.includes(size)) continue;
        // 続きの止め絵(SHOT_SEQ で撮った <名前>~NN)は、縦だけを1つの流れとして束ねる(見せ場と流れの点検 r1119-033)
        if (code.includes('~')) { if (size === 'tate') { const [c0] = code.split('~'); const q = seqs.get(c0) || seqs.set(c0, { key: `flow:${tool}:${c0}`, label: `${FLOW_NAME[c0] || labelOf(tool, c0)}〔${tool}-${c0}〕`, frames: [] }).get(c0); q.frames.push(path.join(dir, f)); } continue; }
        const tagRe = new RegExp(`^NG: ${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\(${m[2] || 'zz'}\\))?[:：(]`);
        const mach = log.filter((l) => tagRe.test(l) && (m[2] ? l.includes(`(${m[2]})`) : !/\((land|s568|s320)\)/.test(l))).map((l) => l.replace(/^NG:\s*/, '').slice(0, 160));
        put(`${tool}:${code}`, `${labelOf(tool, code)}〔${tool}-${code}〕`, size, path.join(dir, f), [...uiMeasure.lines(meas.get(f)), ...mach.slice(0, 3)]);
      }
    }
  }
  // 同じ画面の時間違い(歩き回りの途中・演出の途中)は1枚で足りるので送らない(費用を抑える)
  const SKIP = /^msx:RW[2-5]$|^r3:QF[1-4]$|^(msx|r3):SQ/;
  return [...scenes.values()].filter((sc) => !SKIP.test(sc.key));
};

const pngBlock = async (file, { ref = false } = {}) => {
  // 参考の止め絵は大きい(1170×2532)ので、縦 844 に縮めた jpeg にする。撮った止め絵は縮めない(もとが 844 以下)
  if (ref && sharp) {
    const buf = await sharp(path.join(ROOT, file)).resize({ height: 844, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { type: 'image', media_type: 'image/jpeg', data: buf.toString('base64') };
  }
  // sharp が無い環境(クラウドの会話など)は ImageMagick の convert で同じように縮める。入り口の1枚の上限(5MB)を超える参考の絵が断られていた(2026-11-20)
  if (ref) {
    const r = require('child_process').spawnSync('convert', [path.join(ROOT, file), '-resize', 'x844>', '-quality', '80', 'jpeg:-'], { maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 && r.stdout && r.stdout.length) return { type: 'image', media_type: 'image/jpeg', data: r.stdout.toString('base64') };
  }
  const ext = path.extname(file).toLowerCase();
  return { type: 'image', media_type: ext === '.png' ? 'image/png' : 'image/jpeg', data: fs.readFileSync(ref ? path.join(ROOT, file) : file).toString('base64') };
};

const only = opt('--only').split(',').filter(Boolean);
const buildRequests = async (scenes) => {
  // 共通の「大きさの釣り合い」と「測った数字の扱い」を続けて渡す(モンサク・助手ライフ・モンビーで同じ)
  const system = `${fs.readFileSync(PROMPT_FILE, 'utf8')}\n${fs.readFileSync(path.join(__dirname, 'prompts', 'common-balance.md'), 'utf8')}`;
  const groups = [];
  for (const a of [...AREAS, { key: 'etc' }]) {
    const list = scenes.filter((sc) => areaOf(sc.key).key === a.key);
    let cur = [], n = 0;
    for (const sc of list) {
      const k = SIZES.filter((z) => sc.shots[z]).length;
      if (cur.length && (cur.length >= (SIZES.length >= 3 ? MAX_SCENES_PER_REQ : 99) || n + k > MAX_IMGS_PER_REQ)) { groups.push({ area: areaOf(cur[0].key), scenes: cur }); cur = []; n = 0; }
      cur.push(sc); n += k;
    }
    if (cur.length) groups.push({ area: areaOf(cur[0].key), scenes: cur });
  }
  const reqs = [];
  for (const [n, g] of groups.entries()) {
    const content = [{ type: 'text', text: `まとまり: ${g.area.name}(${g.scenes.length}場面)。止め絵の前に名札を置きます。` }];
    if (g.area.ref && fs.existsSync(path.join(ROOT, g.area.ref))) {
      content.push({ type: 'text', text: `【参考】手本にしている別のゲームの近い画面(${path.basename(g.area.ref)})。比べる相手で、まねる物ではない` });
      content.push(await pngBlock(g.area.ref, { ref: true }));
    }
    for (const sc of g.scenes) {
      for (const size of SIZES) {
        if (!sc.shots[size]) continue;
        const mach = sc.machine.filter((x) => x.startsWith(`${size}:`)).map((x) => x.slice(size.length + 2));
        content.push({ type: 'text', text: `【${sc.label}@${size}】${SIZE_NAME[size]}${mach.length ? ` / 機械の見つけ物(machine): ${mach.join(' ・ ')}` : ''}` });
        content.push(await pngBlock(sc.shots[size]));
      }
    }
    content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。' });
    reqs.push({ custom_id: `g${String(n + 1).padStart(3, '0')}`, area: g.area.name, scenes: g.scenes.map((s) => s.label),
      request: { system, cache_system: true, messages: [{ role: 'user', content }], max_tokens: MAX_TOKENS, effort: EFFORT } });
  }
  // 続きの止め絵: 1つの流れを1本の頼みに(19枚を超える物は間引く)。観点11(見せ場と流れ)を見てもらう
  for (const q of seqs.values()) {
    if (only.length && !only.some((o) => q.key.includes(o) || q.label.includes(o))) continue;
    const fr = q.frames.sort();
    const pick = fr.length <= 19 ? fr : Array.from({ length: 19 }, (_, i) => fr[Math.round(i * (fr.length - 1) / 18)]);
    const content = [{ type: 'text', text: `続きの止め絵: ${q.label}。縦390×844 で、1枚目から押すたびに撮った ${pick.length}枚を順に並べます(試合は約3秒ごと)。観点11(見せ場と流れ)を中心に、1〜12 の全部で見てください。場面の名前は「${q.label}」、sizes は ["tate"] にしてください。` }];
    for (const [i, f] of pick.entries()) { content.push({ type: 'text', text: `【${q.label} ${i + 1}枚目@tate】` }); content.push(await pngBlock(f)); }
    content.push({ type: 'text', text: '上の止め絵を点検し、決めた形の JSON の配列だけを返してください。' });
    reqs.push({ custom_id: `f${String(reqs.length + 1).padStart(3, '0')}`, area: '流れ(続きの止め絵)', scenes: [q.label],
      request: { system, cache_system: true, messages: [{ role: 'user', content }], max_tokens: MAX_TOKENS, effort: EFFORT } });
  }
  return reqs;
};

const parseJson = (text) => {
  const t = String(text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch (e) {}
  const s = t.indexOf('['), e = t.lastIndexOf(']');
  if (s >= 0 && e > s) { try { const j = JSON.parse(t.slice(s, e + 1)); return Array.isArray(j) ? j : []; } catch (e2) {} }
  // 出力の上限で切れた返事は、最後まで閉じた1件までを読む
  for (let k = t.lastIndexOf('}'); s >= 0 && k > s; k = t.lastIndexOf('}', k - 1)) {
    try { const j = JSON.parse(t.slice(s, k + 1) + ']'); if (Array.isArray(j)) return j; } catch (e3) {}
  }
  return null;
};

const writeFindings = (results, usd) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
  const all = [];
  const bad = [];
  for (const r of results) {
    const g = manifest.requests.find((x) => x.custom_id === r.custom_id) || {};
    const list = r.type === 'succeeded' ? parseJson(r.text) : null;
    if (!list) { bad.push(`${r.custom_id}(${r.type || '?'}・${r.stop_reason || ''})`); continue; }
    list.forEach((f) => all.push({ group: r.custom_id, area: g.area, ...f }));
  }
  const order = { 高: 0, 中: 1, 低: 2 };
  all.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3) || String(a.area).localeCompare(String(b.area)));
  fs.writeFileSync(path.join(OUT, 'api-findings.json'), JSON.stringify({ usd, findings: all, unreadable: bad }, null, 1));
  const cnt = (p) => all.filter((f) => f.priority === p).length;
  const md = [`# モンサクの見た目 API 点検の結果(${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} JST)`, '',
    `- 件数 ${all.length}(高 ${cnt('高')}・中 ${cnt('中')}・低 ${cnt('低')})/ 使った額 $${usd}${bad.length ? ` / 読めなかった返事 ${bad.join('、')}` : ''}`, '',
    '| 優先度 | まとまり | 場面 | 大きさ | 何が悪いか | 直し方 | 観点 | 受け持ちの手がかり | 機械 |', '|---|---|---|---|---|---|---|---|---|',
    ...all.map((f) => `| ${f.priority} | ${f.area} | ${f.scene} | ${(f.sizes || []).join('・')} | ${String(f.what || '').replace(/\|/g, '／')} | ${String(f.fix || '').replace(/\|/g, '／')} | ${f.viewpoint ?? ''} | ${f.owner_hint || ''} | ${f.machine_verdict || ''} |`)];
  fs.writeFileSync(path.join(OUT, 'api-findings.md'), md.join('\n') + '\n');
  console.log(`API の見つけ物 ${all.length}件(高 ${cnt('高')}・中 ${cnt('中')}・低 ${cnt('低')})/ 使った額 $${usd} → ${path.join(OUT, 'api-findings.md')}`);
};

(async () => {
  if ((has('--send') || has('--fetch')) && gw.ensureProxyEnv()) return;
  if (has('--fetch')) {
    const b = JSON.parse(fs.readFileSync(path.join(OUT, 'batch.json'), 'utf8'));
    const results = [];
    let usd = 0, waiting = 0;
    for (const x of b.batches || [b]) {
      const r = await gw.send({ action: 'batch_get', batch_id: x.batch_id });
      if (r.status !== 200 || !r.json?.ok) { console.log(`受け取れない: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); process.exit(1); }
      if (!r.json.results) { waiting++; console.log(`  まだ: ${(x.custom_ids || []).join(',')} ${r.json.processing_status} ${JSON.stringify(r.json.request_counts || {})}`); continue; }
      results.push(...r.json.results);
      usd += Number(r.json.usd) || 0;
    }
    if (waiting) { console.log(`まだ終わっていないバッチ ${waiting}本`); process.exit(3); }
    fs.writeFileSync(path.join(OUT, 'batch-results.json'), JSON.stringify({ results }, null, 1));
    writeFindings(results, Math.round(usd * 10000) / 10000);
    return;
  }
  let scenes = collect();
  if (only.length) scenes = scenes.filter((s) => only.some((o) => s.key.includes(o) || s.label.includes(o)));
  let reqs = await buildRequests(scenes);
  // --groups g002,g003 … 前に送った頼みのうち、その番号だけ送り直す(同じ止め絵なら番号は同じになる)
  const groups = opt('--groups').split(',').filter(Boolean);
  if (groups.length) reqs = reqs.filter((q) => groups.includes(q.custom_id));
  let usd = 0;
  for (const q of reqs) {
    const e = await gw.estimate(q.request, { batch: !has('--message') });
    if (!e.ok) { console.log(`${q.custom_id} の形が入り口に断られる: ${e.error}`); process.exit(1); }
    q.usd_est = e.usd_est;
    usd += e.usd_est;
  }
  const imgs = reqs.reduce((n, q) => n + q.request.messages[0].content.filter((c) => c.type === 'image').length, 0);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), batch: !has('--message'), usd_est: Math.round(usd * 100) / 100,
    requests: reqs.map(({ request, ...rest }) => rest) }, null, 1));
  console.log(`場面 ${scenes.length} / 止め絵 ${imgs}枚(参考を含む)/ 頼み ${reqs.length}本 / 多めの見積り $${usd.toFixed(2)}(${has('--message') ? 'その場で返す' : 'バッチ・半額'}・出力は max_tokens を全部使った額)`);
  AREAS.forEach((a) => { const n = scenes.filter((s) => areaOf(s.key).key === a.key).length; if (n) console.log(`  ${a.name}: ${n}場面`); });
  if (usd > MAX_USD) { console.log(`見積りが $${MAX_USD} を超えるので送らない(--only で絞る)`); process.exit(2); }
  if (!has('--send')) return;
  if (has('--message')) {
    const results = [];
    let spent = 0;
    for (const q of reqs) {
      const r = await gw.send({ action: 'message', kind: 'ui-check', label: `monsuc-${q.custom_id}`, request: q.request });
      if (r.status !== 200 || !r.json?.ok) { console.log(`${q.custom_id} 断られた・失敗: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); break; }
      spent += Number(r.json.usd) || 0;
      results.push({ custom_id: q.custom_id, type: 'succeeded', stop_reason: r.json.stop_reason, text: r.json.text });
      console.log(`  ${q.custom_id} OK $${r.json.usd}(ここまで $${spent.toFixed(2)})`);
    }
    fs.writeFileSync(path.join(OUT, 'batch-results.json'), JSON.stringify({ results }, null, 1));
    writeFindings(results, Math.round(spent * 10000) / 10000);
    return;
  }
  // 入り口(Edge Function)は1回に受け取れる大きさに限りがある(35本・約70MB を一度に送ると WORKER_RESOURCE_LIMIT)。
  // --per-batch 本ずつ(既定 3本 ≒ 6MB)に分けて頼む。batch.json に全部の batch_id を残す
  const PER = Number(opt('--per-batch', '3'));
  const sent = [];
  for (let i = 0; i < reqs.length; i += PER) {
    const part = reqs.slice(i, i + PER);
    const r = await gw.send({ action: 'batch_submit', kind: 'ui-check', label: `monsuc-visual-${part[0].custom_id}`, requests: part.map((q) => ({ custom_id: q.custom_id, request: q.request })) });
    if (r.status !== 200 || !r.json?.ok) { console.log(`${part[0].custom_id} から断られた・失敗: ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); break; }
    sent.push({ batch_id: r.json.batch_id, id: r.json.id, usd_est: r.json.usd_est, custom_ids: part.map((q) => q.custom_id) });
    fs.writeFileSync(path.join(OUT, 'batch.json'), JSON.stringify({ batches: sent }, null, 1));
    console.log(`  ${part.map((q) => q.custom_id).join(',')} を頼んだ(見積り $${r.json.usd_est})`);
  }
  console.log(`バッチを ${sent.length}本 頼んだ。結果は --fetch で受け取る(終わるまで数分〜1時間)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
