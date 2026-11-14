#!/usr/bin/env node
// 画面の文に、漢字で書ける語がひらがなで入っていないかを見る(2026-11-14 社長「漢字使えるのは漢字にして」。錠 ui-kanji・追跡表 r1114-089)
//   node tools/ui/ui-kanji-check.js            … 見る(当たりがあれば NG)
//   node tools/ui/ui-kanji-check.js --list     … 当たりを全部出す
//   node tools/ui/ui-kanji-check.js --fix <ファイル> … そのファイルの当たりを表のとおり置き換える(置き換えたあと差分を目で見ること)
// 表: tools/ui/ui-kanji-words.js(ひらがな → 漢字。ひらがなのままにする語は KEEP に理由つき)
// 見ないもの: 台詞・お話(台詞の部品の長い文、「」や語尾のある文、お話の台本・助手の台詞集)、出した更新履歴、
//   識別子・保存キー・data-* の値・比べる値、戦術カードの段(保存値)。探し方は ui-kanji-scan.js
// 置き換えを部品ごとに進めているあいだは、まだの部品を PENDING に書いて見送る(済んだら消す)。
'use strict';
const path = require('path');
const { scanFile, applyFile, targetFiles } = require('./ui-kanji-scan.js');

// まだ置き換えていない部品(r1114-089 で部品ごとに PR を分けて進めている。済んだら消す)
const PENDING = [
  /src\/parts\/(?:60-app|70-bootstrap|56-monhero-success|56-monsuc-)/, // まだ: 60-app・起動・モンサク(最後)
  /data\/(?:monhero-success|success-)/, // モンサクの名前の表(最後)
];

// モンサクの物の名前は、モンサクの PR で名前の表と一緒に変える(ヘルプの中の字もそのときに)
const NAME_PENDING = /^(?:いのちの実|ちえの実|ねらいの実|かたさの実|うけつぎ草|うけつぐ魂|スタミナだんご|ねらいうちベリー|うできき|はなまる|信頼のきずな|人なつっこさ|かけつけ|仲よし特訓|通院の付きそい|博士の目じるし|ねぼけ|ゆるがない絆|しめくくり杯)$/;

const args = process.argv.slice(2);
if (args[0] === '--fix') {
  const rel = args[1];
  if (!rel) { console.log('使い方: --fix <ファイル>'); process.exit(1); }
  const n = applyFile(rel, null, { skipName: (h) => NAME_PENDING.test(h) });
  console.log(`${rel}: ${n} か所を置き換えた`);
  process.exit(0);
}
const list = args.includes('--list');
const found = [];
for (const f of targetFiles()) {
  if (PENDING.some(re => re.test(f))) continue;
  for (const it of scanFile(f)) {
    for (const h of it.hits) {
      if (NAME_PENDING.test(h.h)) continue;
      found.push(`${f.replace('monster-hero/', '')}:${it.line} 「${h.h}」→「${h.k}」 … ${it.text.replace(/\s+/g, ' ').slice(Math.max(0, h.at - 8), h.at + h.h.length + 8)}`);
    }
  }
}
if (found.length) {
  console.log(`NG: 画面の文に、漢字で書ける語がひらがなで ${found.length} か所(表: tools/ui/ui-kanji-words.js)`);
  for (const s of (list ? found : found.slice(0, 15))) console.log('  ' + s);
  if (!list && found.length > 15) console.log(`  …ほか ${found.length - 15} か所(--list で全部)`);
  console.log('  直し方: 漢字にする。台詞・名前で直さない物なら ui-kanji-scan.js の EXCEPT か ui-kanji-words.js の KEEP に理由つきで足す');
  process.exit(1);
}
console.log('OK: 画面の文に、表のひらがなの語は無い');
