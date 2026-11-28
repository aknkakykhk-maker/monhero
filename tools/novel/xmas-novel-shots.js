#!/usr/bin/env node
// クリスマスのミステリーノベル: 決めた行から事件簿を開いて止め絵を撮る(r1126-043 主役の書き分けの見せ用)。
//   保存(mh_xmas_novel_v1)の「続き」を、撮りたい場面・行・派(f_A1)にして開き、「続きから」を押して撮る。
//   撮る物は下の SHOTS。行は台本の番号(7-1-3a など)で書く
// 使い方: node tools/novel/xmas-novel-shots.js <出力ディレクトリ>   (縦 390×844・2倍)
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-046   幕間と過去編(r1126-046)の組を撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-065   亡くなった人のシルエット(r1126-065)の組を縦と横で撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-071   改行の位置(r1126-071)の組を縦と横で撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-076   謎の客2人の全身の絵(寄り・ふだん・引き・死の場面)の組を縦と横で撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-067   立ち絵の見せ方(寄り・ふだん・引き)の組を縦と横で撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-062   足した選択肢とエンド(r1126-062)の組を撮る
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-077   眠りのドラ(r1126-077)のルートを縦と横で撮る
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || 'shots');
const PORT = 8000 + Math.floor(Math.random() * 900);
const SHOTS = [
  { name: '01-a1', row: 'A1', side: 0, label: '第1章 A1(どっちを手伝う？)' },
  { name: '02-a2-atsu', row: 'A2', side: 1, label: 'あつ派 A2 の選択肢' },
  { name: '03-a2-sora', row: 'A2', side: 2, label: 'ソラシド派 A2 の選択肢' },
  { name: '04-x1-sora', row: '2-X-6s', side: 2, label: 'ソラシド派 END-X1 の場面' },
  { name: '05-x2-atsu', row: '5-X-4a', side: 1, label: 'あつ派 END-X2 の場面' },
  { name: '06-x3-sora', row: '6-X-10s', side: 2, label: 'ソラシド派 END-X3 の場面' },
  { name: '07-c7-atsu', row: '7-1-13a', side: 1, label: 'あつ派 第7章 ソラシドがドラを名指し' },
  { name: '08-c8-atsu', row: '8-1-14a', side: 1, label: 'あつ派 第8章「謎は全て解けた!」' },
  { name: '09-c8-sora', row: '8-1-15s', side: 2, label: 'ソラシド派 第8章「真実はいつもひとつ!」' },
  { name: '10-c8-past', row: '8-3-12', side: 1, label: '第8章 12年前(ももすけ)' },
];
// 幕間と過去編(r1126-046)。list: 起動画面の「章から」の一覧(真グッドを見たあと)を撮る
const SHOTS_046 = [
  { name: '01-m1-secret', row: '1-M-8', side: 1, label: '幕間 眠る客(？？？)' },
  { name: '02-m2-kuroba', row: '2-M-16', side: 1, label: '幕間 鍵をかけた部屋(黒羽「あいつ」)' },
  { name: '03-m3-ichika', row: '3-M-7', side: 2, label: '幕間 古い鍵(イチーカ)' },
  { name: '04-m4-shirase', row: '4-M-6', side: 2, label: '幕間 書きかけの手紙(白瀬)' },
  { name: '05-m5-dra', row: '5-M-12', side: 1, label: '幕間 手をつけないクッキー(ドラ)' },
  { name: '06-m6-mochi', row: '6-M-9', side: 2, label: '幕間 帳面の名前(もちまる)' },
  { name: '07-past-list', list: true, label: '「章から」の一覧(過去編が開いた)' },
  { name: '08-past-kuroba', row: '12-1-9', side: 0, label: '過去編 ホールの子守歌(黒羽)' },
  { name: '09-past-lie', row: '12-4-7', side: 0, label: '過去編 早すぎた鐘(黒羽のうそ)' },
  { name: '10-past-shirase', row: '12-6-3', side: 0, label: '過去編 雪原の朝(白瀬)' },
  { name: '11-past-mochi', row: '12-7-4', side: 0, label: '過去編 開けておく扉(もちまる)' },
];
// 真グッドと普通のグッドの終わり方の書き分け(r1126-054)
const SHOTS_054 = [
  { name: '01-c8-promise-atsu', row: '8-3-23a', side: 1, label: '真ルート 第8章 正しい時刻で鳴らそう(あつ派)' },
  { name: '02-c9-soup', row: '9-2-10', side: 2, label: '終章 もちまるのスープ' },
  { name: '03-g-promise', row: 'G-16f', side: 1, label: '真グッド いつか、お客さんとして' },
  { name: '04-g-last', row: 'G-20z', side: 1, label: '真グッド 最後の一文' },
  { name: '05-outg', row: 'OUT-G-3c', side: 1, label: '真グッドのあと 画面の前' },
  { name: '06-c11n-sora', row: '11-N-82s', side: 2, label: '遅すぎた真相 もう、終わりにしましょう(ソラシド派)' },
  { name: '07-n-leave', row: 'N-13c', side: 2, label: '普通のグッド 山道を下りる' },
  { name: '08-n-last', row: 'N-13f', side: 2, label: '普通のグッド 最後の地の文' },
];
// 予告の手紙(r1126-058)
const SHOTS_058 = [
  { name: '01-letter-atsu', row: '2-L-4', side: 1, label: 'あつ派 赤い字の手紙' },
  { name: '02-letter-sora', row: '2-L-4', side: 2, label: 'ソラシド派 赤い字の手紙' },
  { name: '03-letter-after', row: '2-L-8', side: 2, label: 'ソラシド派 みんなが黙る間' },
  { name: '04-letter-truth', row: '8-3-7b', side: 1, label: '真ルート きゅうこが手紙を明かす' },
];
// 選択肢とエンドを足した分(r1126-062)。endings: 見たエンディング(保存に入れておく)/ history: エンドヒストリーの一覧 / tap: 開いてから画面を叩く回数(エンドの札まで進める)
const ALL_ENDS = ['END-X1', 'END-X2', 'END-X3', 'END-X4', 'END-X5', 'END-M1', 'END-M2', 'END-M3', 'END-M4', 'END-M5', 'END-G', 'END-N', 'END-A', 'END-B', 'END-O', 'END-O2'];
const SHOTS_062 = [
  { name: '01-a2b-atsu', row: 'A2b', side: 1, label: 'あつ派 予告の手紙のあとの選択(A2b)' },
  { name: '02-x4-atsu', row: '2-Y-5', side: 1, label: 'あつ派 END-X4 黒いフードの影が紙を差しこむ' },
  { name: '03-x4-sora', row: '2-Y-13s', side: 2, label: 'ソラシド派 END-X4 裏の階段の下' },
  { name: '04-q7a', row: 'Q7a', side: 1, label: '1回目の推理 Q7a(人を選ぶ)' },
  { name: '05-m1', row: '7-P1-8', side: 2, label: 'END-M1 ももすけが吹雪の中へ' },
  { name: '06-m1-end', row: 'M1-3', side: 2, label: 'END-M1 雪の上の髪飾り' },
  { name: '07-m2', row: 'M2-4', side: 1, label: 'END-M2 薪小屋のもちまる' },
  { name: '08-m3', row: 'M3-7', side: 1, label: 'END-M3 二通目の赤い字の手紙' },
  { name: '09-m4-atsu', row: '7-4-9', side: 1, label: 'あつ派 END-M4 帽子を(プレイヤー)に' },
  { name: '10-m4-sora', row: '7-5-8', side: 2, label: 'ソラシド派 END-M4 ワトソンくんを(プレイヤー)に' },
  { name: '11-m5-atsu', row: 'M5-5a', side: 1, label: 'あつ派 END-M5 鏡の扉の奥(ソラシド)' },
  { name: '12-m5-sora', row: 'M5-5s', side: 2, label: 'ソラシド派 END-M5 鏡の扉の奥(あつ)' },
  { name: '13-a10-sora', row: 'A10', side: 2, label: 'ソラシド派 後半 屋根裏の声の選択(A10)' },
  { name: '14-x5-atsu', row: '10-X-5', side: 1, label: 'あつ派 END-X5 板の上の影' },
  { name: '15-a1-omake', row: 'A1', side: 0, endings: ['END-G'], label: '真グッドのあとの A1(③推理はお休み)' },
  { name: '16-omake', row: '1-O-13', side: 3, endings: ['END-G'], label: 'おまけ 黒いサンタが7人' },
  { name: '17-omake-kyuko', row: '1-O-25', side: 3, endings: ['END-G'], label: 'おまけ きゅうこもケーキ' },
  { name: '18-out-o', row: 'OUT-O-2', side: 3, endings: ['END-G'], label: 'おまけのあと 画面の前' },
  { name: '19-m1-card', row: 'M1-7', side: 2, tap: 3, label: 'END-M1 エンドの札' },
  { name: '20-history-few', history: true, endings: ['END-X1', 'END-M1', 'END-M4', 'END-G'], label: 'エンドヒストリー(まだの物は？？？)' },
  { name: '21-history-all', history: true, endings: ALL_ENDS, label: 'エンドヒストリー(全部見たあと)' },
];
// 眠りのドラ(r1126-077)。ソラシド派の第7章 A7 から、おまけのエンドと画面の前まで。縦と横で撮る
const SHOTS_077 = [];
[['01-a7', 'A7', 'A7 の選択肢(②ワトソンくんの奥の手)'], ['02-okunote', '7-W-3', 'ドラさんの口を、お借りします'], ['03-arere', '7-W-5', 'あれれ〜？'],
  ['04-pshu', '7-W-8', 'プシュッ(針が飛び出す)'], ['05-masui', '7-W-9', 'ノートパソコン型麻酔銃'], ['06-nemu', '7-W-10', 'ドラが眠る'], ['07-isu', '7-W-11', 'ひじかけ椅子'],
  ['08-henseiki', '7-W-13', '椅子の後ろに隠れる'], ['09-dora-voice', '7-W-14', 'ドラの声で推理を始める'], ['10-mua', '7-W-15', '寝たまましゃべった'],
  ['11-hat', '7-W-20', '帽子からクッキーのくず'], ['12-mochi', '7-W-21', 'もちまるのクッキー'], ['13-slip', '7-W-24', 'ワトソンくん……じゃなかった'],
  ['14-photo', '7-W-25', 'くずは0個'], ['15-logic', '7-W-27', '着てたなら、くずだらけ'], ['16-not-me', '7-W-28', 'その服を着てたのは、おでじゃない'],
  ['17-erubin', '7-W-29', '筋は通ってる'], ['18-shinjitsu', '7-W-30', '真実は、いつもひと——'], ['19-peko', '7-W-31', 'おでの腹は、いつもぺこぺこだ'],
  ['20-battery', '7-W-35', '電池の残り 1%'], ['21-guu', '7-W-36', 'いびきの声まね'], ['22-shh', '7-W-38', 'あつだけがのぞきこむ'],
  ['23-wake', '7-W-41', 'ドラが起きる'], ['24-solved', '7-W-43', 'おでが……解いたのか？'], ['25-tensai', '7-W-45', 'おで、天才だったのか'],
  ['26-nanimo', '7-W-47', '何もなかった顔'], ['27-muri', '7-W-48', 'それはさすがに無理ある'], ['28-end-title', 'O2-1', 'エンディング 眠りのドラ'],
  ['29-end-nemuri', 'O2-2', '眠りのドラと呼ばれる'], ['30-end-hari', 'O2-4', '針は残り0本'], ['31-end-close', 'O2-5', 'おまけ、おしまい'],
  ['32-out-conan', 'OUT-O2-1', '画面の前 みゅあ'], ['33-out-kyuko', 'OUT-O2-5', '画面の前 きゅうこ'], ['34-out-last', 'OUT-O2-8', '画面の前 最後の帯']].forEach(([name, row, label]) => {
  SHOTS_077.push({ name: `${name}-tate`, row, side: 2, label: `${label}(縦)` });
  SHOTS_077.push({ name: `${name}-yoko`, row, side: 2, land: true, label: `${label}(横)` });
});
SHOTS_077.push({ name: '35-card-tate', row: 'O2-5', side: 2, tap: 14, label: 'エンドの札(縦)' });
SHOTS_077.push({ name: '35-card-yoko', row: 'O2-5', side: 2, tap: 14, land: true, label: 'エンドの札(横)' });
SHOTS_077.push({ name: '36-history', history: true, endings: ALL_ENDS, label: 'エンドヒストリー(16本・全部見たあと)' });
SHOTS_077.push({ name: '37-a7-atsu', row: '7-2-1', side: 1, label: 'あつ派 第7章は A7 なしで推理へ(比べ用)' });
// 亡くなっているのが見つかる場面のシルエット(r1126-065)。縦と横で撮る(land: 横 844×390)
const SHOTS_065 = [];
[['01-kuroba', '3-1-4', 1, '第3章 黒羽(雪原)'], ['02-kuroba-hands', '3-1-7', 1, '第3章 黒羽の手'], ['03-shirase', '5-4-5', 1, '第5章 白瀬(鏡の裏の通り道)'],
  ['04-erubin', '10-1-4', 1, '後半 えるびん(客室のベッド)'], ['05-momosuke', '10-2-7', 1, '後半 ももすけ(はしごの下)'], ['06-mochimaru', '10-3-7', 1, '後半 もちまる(裏口の外の雪)'],
  ['07-x1', '2-X-6a', 1, 'END-X1 裏口の前(あつ)'], ['08-x1-sora', '2-X-7', 2, 'END-X1 裏口の前(ソラシド)'], ['09-x2', '5-X-4a', 1, 'END-X2 書斎'],
  ['10-x3', '6-X-10a', 1, 'END-X3 扉の外の雪'], ['11-x4', '2-Y-13a', 1, 'END-X4 裏の階段の下'], ['12-x5', '10-X-10a', 1, 'END-X5 はしごの下'],
  ['13-m2', 'M2-4', 1, 'END-M2 薪小屋のもちまる'], ['14-m5', 'M5-5a', 1, 'END-M5 通り道(ソラシド)'], ['15-m5-atsu', 'M5-5s', 2, 'END-M5 通り道(あつ)']].forEach(([name, row, side, label]) => {
  SHOTS_065.push({ name: `${name}-tate`, row, side, label: `${label}(縦)` });
  SHOTS_065.push({ name: `${name}-yoko`, row, side, land: true, label: `${label}(横)` });
});
// 改行の位置(r1126-071)。直す前と後を並べる。縦と横で撮る
const SHOTS_071 = [];
[['01-coat', '3-1-4', 1, '地の文「灰色のコートの影」'], ['02-cake', '1-O-25', 1, 'ト書き「ケーキをほおばって」'], ['03-got', '1-3-12c', 1, '手がかりを手に入れた【二通目の招待状】'],
  ['04-clue', '4-1-6c', 1, '手がかり帳に書きとめた'], ['05-santa', '11-N-3', 1, '地の文「黒いサンタが座りこんで」'], ['06-say', '7-1-12a', 1, '台詞(ぶら下げ)'],
  ['07-out', 'OUT-1-3', 0, '外側の台詞「上書きできません」'], ['08-band', '2-M-8', 1, '幕間の地の文'], ['09-say2', '1-5-13', 1, '台詞'], ['10-choice', 'A10', 1, '選択肢']].forEach(([name, row, side, label]) => {
  SHOTS_071.push({ name: `${name}-tate`, row, side, label: `${label}(縦)` });
  SHOTS_071.push({ name: `${name}-yoko`, row, side, land: true, label: `${label}(横)` });
});
// 立ち絵の見せ方(r1126-067)。寄り・ふだん・引きを縦と横で撮る(前と後を並べる用)
const SHOTS_067 = [];
[['1-yori-atsu', '8-1-14a', 1, '寄り 第8章「謎は全て解けた!」(あつ)'], ['2-yori-erubin', '5-4-8', 1, '寄り 第5章 白瀬を見つけたえるびん(泣く)'],
  ['3-fudan-kyuko', '1-4-6', 1, 'ふだん 第1章 ねじ巻きを申し出るきゅうこ'], ['4-fudan-shirase', '3-5-3', 1, 'ふだん 第3章 窓辺の白瀬'],
  ['5-hiki-kyuko', '1-O-25', 1, '引き おまけ ケーキをほおばるきゅうこ'], ['6-hiki-kuroba', '1-3-2', 1, '引き 第1章 黒羽の登場']].forEach(([name, row, side, label]) => {
  SHOTS_067.push({ name: `${name}-tate`, row, side, label: `${label}(縦)` });
  SHOTS_067.push({ name: `${name}-yoko`, row, side, land: true, label: `${label}(横)` });
});
// 謎の客2人を全身の絵に(r1126-076)。寄り・ふだん・引きと死の場面を縦と横で撮る
const SHOTS_076 = [];
[['1-kuroba-yori', '2-M-14', 1, '寄り 幕間 鍵をかけた部屋の黒羽'], ['2-kuroba-fudan', '2-1-3', 1, 'ふだん 第2章 楽譜が消えた黒羽'], ['3-kuroba-hiki', '1-3-2', 1, '引き 第1章 黒羽の登場'],
  ['4-shirase-yori', '3-5-4', 1, '寄り 第3章 窓辺の白瀬「12年前」'], ['5-shirase-fudan', '3-5-3', 1, 'ふだん 第3章 窓辺の白瀬'], ['6-shirase-hiki', '1-3-6', 1, '引き 第1章 白瀬の登場'],
  ['7-kuroba-shi', '3-1-4', 1, '死の場面 第3章 黒羽(雪原)'], ['8-kuroba-shi-te', '3-1-7', 1, '死の場面 第3章 黒羽の手'], ['9-shirase-shi', '5-4-5', 1, '死の場面 第5章 白瀬(鏡の裏の通り道)']].forEach(([name, row, side, label]) => {
  SHOTS_076.push({ name: `${name}-tate`, row, side, label: `${label}(縦)` });
  SHOTS_076.push({ name: `${name}-yoko`, row, side, land: true, label: `${label}(横)` });
});
// 開幕前の総点検 4・5・9・12番(上の帯の題・血だまり・横の窓・ソラシド派の持ち物)。縦と横で撮る
const SHOTS_FINAL = [];
[['01-where', '7-1-12a', 1, '4番 上の帯の題(第七章)'], ['02-kuroba', '3-1-4', 1, '5番 黒羽(凍死)'], ['03-shirase', '5-4-5', 1, '5番 白瀬(凍死)'], ['04-x2', '5-X-5', 1, '5番 END-X2(首)'],
  ['05-x3-sora', '6-X-10s', 2, '12番 ソラシド派 END-X3'], ['06-choice', 'A1', 0, '9番 選択肢の窓']].forEach(([name, row, side, label]) => {
  SHOTS_FINAL.push({ name: `${name}-tate`, row, side, label: `${label}(縦)` });
  SHOTS_FINAL.push({ name: `${name}-yoko`, row, side, land: true, label: `${label}(横)` });
});
[['tate', false], ['yoko', true]].forEach(([v, land]) => SHOTS_FINAL.push({ name: `08-false-end-${v}`, row: '11-A-1a', side: 1, land, label: `r1126-087 偽りの解決(2回目)の上の帯(${v === 'tate' ? '縦' : '横'})` }));
SHOTS_FINAL.push({ name: '07-gameover-yoko', row: '2-X-10s', side: 2, tap: 14, land: true, label: '9番 GAME OVER の札(横)' });
const LIST_ALL = process.argv.includes('--final') ? SHOTS_FINAL : process.argv.includes('--r1126-077') ? SHOTS_077 : process.argv.includes('--r1126-071') ? SHOTS_071 : process.argv.includes('--r1126-076') ? SHOTS_076 : process.argv.includes('--r1126-067') ? SHOTS_067 : process.argv.includes('--r1126-065') ? SHOTS_065 : process.argv.includes('--r1126-062') ? SHOTS_062 : process.argv.includes('--r1126-046') ? SHOTS_046 : process.argv.includes('--r1126-054') ? SHOTS_054 : process.argv.includes('--r1126-058') ? SHOTS_058 : SHOTS;

//  --only <語>: 名前にその語を含む物だけ撮る(例: --only kuroba)
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] || '' : '';
const LIST = ONLY ? LIST_ALL.filter((x) => x.name.includes(ONLY)) : LIST_ALL;

const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/79-xmas-novel-script.jsx'), 'utf8')}\nthis.S = XMAS_NOVEL_SCRIPT;`, ctx);
const where = (rowId) => {
  for (const sc of ctx.S.scenes) { const i = (sc.rows || []).findIndex((r) => r.id === rowId); if (i >= 0) return { scene: sc.id, idx: i }; }
  return null;
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  try {
    for (const sh of LIST) {
      const at = sh.list || sh.history ? { scene: 'C1-1', idx: 0 } : where(sh.row);
      if (!at) { console.log(`NG: ${sh.row} が台本に無い`); bad += 1; continue; }
      const page = await (await browser.newContext({ viewport: sh.land ? { width: 844, height: 390 } : { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript((seed) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_xmas_novel_v1', seed);
      }, { cur: sh.list || sh.history ? null : { scene: at.scene, idx: at.idx, flags: sh.side ? { f_A1: sh.side } : {}, clues: [], ans: {}, panel: {} },
        ...(sh.endings ? { endings: sh.endings, endAt: Object.fromEntries(sh.endings.map((e) => [e, '2026-12-03T12:15:00.000Z'])) } : {}),
        ...(sh.list || LIST_ALL === SHOTS_046 ? { endings: ['END-G'], snaps: { C1: { scene: 'C1-1', idx: 0, flags: {}, clues: [], ans: {}, panel: {} } } } : {}) });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      await page.evaluate(() => openXmasNovel({ force: true, playerName: 'テスト' }));
      await page.locator(sh.list ? '[data-xmas-novel-chapters]' : sh.history ? '[data-xmas-novel-endings]' : '[data-xmas-novel-continue]').click({ timeout: 8000 });
      await page.waitForTimeout(2600);
      // 文字送りを最後まで(1回だけ叩く。問いの行はそのまま)
      const row = await page.evaluate(() => { const r = document.querySelector('[data-xmas-novel]'); return r ? r.getAttribute('data-row') : null; });
      await page.waitForTimeout(1200);
      for (let t = 0; t < (sh.tap || 0); t += 1) { await page.mouse.click(195, 640); await page.waitForTimeout(1600); }
      await page.screenshot({ path: path.join(OUT, `${sh.name}.jpg`), type: 'jpeg', quality: 82 });
      console.log(`${errors.length ? 'NG' : 'OK'}: ${sh.name} ${sh.label} — 画面の行 ${row}${errors.length ? ` エラー ${errors[0]}` : ''}`);
      if (errors.length) bad += 1;
      await page.context().close();
    }
  } finally { await browser.close(); server.close(); }
  process.exit(bad ? 1 : 0);
})();
