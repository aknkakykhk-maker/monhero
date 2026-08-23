#!/usr/bin/env node
// 極限チャレンジの難易度カードが、iPhone縦画面で破綻しない形のままかを見る。
//
// 特殊ルールの本文は「ルール詳細」(ボトムシート)へ移したので、カードは
//   ・全難易度で同じ外寸(400px)
//   ・説明と「特殊ルールあり」の1行だけ
//   ・ルール詳細 / 全WAVE詳細 / 挑戦 / ランキング の4操作
// を保つ。ルールが増えてもカードを大きくしたり文字を小さくしたりしないための歯止め。
// ルールの中身そのもの(数値)は tools/mode/infinity-rules-check.js が実データで確かめる。
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const check = (name, condition) => {
  console.log(`${condition ? 'OK' : 'NG'}: ${name}`);
  if (!condition) process.exitCode = 1;
};

const cardAt = source.indexOf('data-extreme-difficulty-card={setting.id}');
const card = cardAt < 0 ? '' : source.slice(cardAt, cardAt + 7000);
const detailAt = source.indexOf('data-extreme-rule-detail={setting.id}');
const detail = detailAt < 0 ? '' : source.slice(detailAt - 900, detailAt + 3400);

check('全極限難易度カードは共通の400px外寸を使い、382px固定へ依存しない',
  card.includes('data-extreme-difficulty-card={setting.id}')
  && card.includes('h-[400px]')
  && !card.includes('h-[382px]')
  && source.match(/data-extreme-difficulty-card=/g)?.length === 1);
check('難易度ごとの高さ分岐を作らず、説明枠を共通化する',
  card.includes('data-extreme-card-description={setting.id}')
  && card.includes('mt-1 min-h-[35px]')
  && !card.includes("setting.id==='ULTIMATE'?'mt-1 h-[32px] shrink-0'")
  && card.includes('{setting.cardDescription||setting.description}'));
check('ULTIMATE・INFINITYの説明はカード用の短い要約を持つ',
  source.includes("cardDescription:'累計ターンで敵が強化され、味方側の各効果が低下。35TごとにDISTANCE BREAKが進行する最高難度。'")
  && source.includes("cardDescription:'極限ルールを統合。与ダメ低下とDISTANCE BREAKがさらに苛烈になる最上位10WAVE。'"));
check('特殊ルールはカードへ並べず、あることだけを1行で出す',
  card.includes('data-extreme-special-rules={setting.id}')
  && card.includes('h-[34px]')
  && card.includes('extremeRuleSummaryText(setting.id)')
  && !card.includes('extremeSpecialRuleLines(setting.id).map')
  && !card.includes("setting.id==='ULTIMATE'?'mt-1.5 h-[62px]':'mt-1 h-[51px]'"));
// 特殊ルール欄の文字を小さくして本文を詰め込む、という直し方を封じる
// (カード上部の「BATTLE DIFFICULTY」など既存の飾り文字はここでは見ない)
const ruleBox = (() => {
  const at = card.indexOf('data-extreme-special-rules={setting.id}');
  return at < 0 ? '' : card.slice(at, card.indexOf('</div>', at));
})();
check('特殊ルール欄の文字を10px未満へ小さくして詰め込んでいない',
  ruleBox.includes('text-[10px] leading-tight text-amber-300')
  && !/text-\[[0-9]px\]/.test(ruleBox)
  && !card.includes("setting.id==='ULTIMATE'?'text-[8px] leading-[9px]'"));
check('ルール詳細・全WAVE詳細・挑戦・ランキングをカード内へ収める',
  card.includes('data-extreme-card-actions')
  && card.includes('data-extreme-rule-detail-open={setting.id}')
  && card.includes('ルール詳細')
  && card.includes('全WAVE詳細')
  && card.includes('この難易度で挑戦')
  && card.includes('のランキング')
  && card.includes('className="grid gap-1.5 mt-auto pt-2 pb-1"')
  && (card.match(/<button [^>]*disabled=/g) || []).length >= 4);
check('ボタンの並びはルール詳細→全WAVE詳細→挑戦→ランキング',
  card.indexOf('ルール詳細') < card.indexOf('全WAVE詳細')
  && card.indexOf('全WAVE詳細') < card.indexOf('この難易度で挑戦')
  && card.indexOf('この難易度で挑戦') < card.indexOf('のランキング'));
check('ランキングボタンの下にカード内余白を確保する',
  card.includes('data-extreme-card-actions')
  && card.includes('pb-1')
  && card.indexOf('pb-1') < card.indexOf('のランキング'));
check('カード・ページドット・助手コメントを順番と余白で分離する',
  source.includes('data-extreme-page-dots')
  && source.includes('data-extreme-assistant')
  && source.indexOf('data-extreme-difficulty-card') < source.indexOf('data-extreme-page-dots')
  && source.indexOf('data-extreme-page-dots') < source.indexOf('data-extreme-assistant')
  && source.includes('data-extreme-page-dots className="flex justify-center gap-1 pt-1.5 pb-1"')
  && source.includes('data-extreme-assistant className="shrink-0 pt-2 pb-1"'));

check('ルール詳細はSafe Areaへ食い込まず、縦スクロールで最後まで読める',
  detail.includes('env(safe-area-inset-top)')
  && detail.includes('env(safe-area-inset-bottom)')
  && detail.includes('data-extreme-rule-detail-body')
  && detail.includes('min-h-0 flex-1 overflow-y-auto'));
check('ルール詳細の本文は11px以上で、閉じる操作は44px以上',
  detail.includes('text-[11px] leading-snug')
  && detail.includes('min-h-[44px] min-w-[44px]')
  && detail.includes('min-h-[44px] w-full')
  && detail.includes('aria-label="閉じる"'));
check('ルール詳細は難易度ごとに違う内容を、実データから作って出す',
  detail.includes('extremeRuleDetailGroups(setting.id)')
  && detail.includes('{group.title}')
  && !/const groups=\[\s*\[/.test(detail));
check('クイックULTIMATEの特殊ルール表示は従来どおり開始案内を使う',
  source.includes('quick&&hasExtremeSpecialRules(key)')
  && source.includes('extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode))'));

if (!process.exitCode) console.log('\nultimate card layout checks passed');
