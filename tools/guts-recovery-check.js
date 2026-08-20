// 固有技の強化画面(UPGRADE_SKILL)の「強化ポイントでガッツを回復」を確認する。
//
//   node tools/guts-recovery-check.js
//
// 見ているもの:
//   ① 1P消費で現在ガッツが10回復し、最大ガッツは増えず、最大を超えないこと
//   ② 満タン・ポイント0では押せないこと(押しても何も起きないこと)
//   ③ ガッツ回復に使ったポイントは戻せないこと(取り消しの導線が無いこと)
//   ④ 連打しても1ポイントで2回ぶん回復できないこと
//   ⑤ 未使用ポイントの持ち越しなど、既存の仕様に触れていないこと
//   ⑥ 現在ガッツ/最大ガッツが読めて、iPhone縦画面でタップしやすいこと
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- 定義 ----
check('1回の消費は強化ポイント1つ', has('const GUTS_RECOVERY_POINT_COST = 1;'));
check('1回で戻るガッツは10', has('const GUTS_RECOVERY_AMOUNT = 10;'));

// ---- ★実装の計算をそのまま取り出して動かす ----
// 本体の recoverGutsWithPoint と同じ手順を、Reactのstateと同じ振る舞いで再現する
const fn = slice('const gutsRecoveryLockRef = useRef(false);', '  // 合体で引き継いだ固有技の強化');
check('回復処理を取り出せる', fn.length > 0);
// 押せる条件と、回復後の値の式を本体からそのまま取り出す
const condLine = (fn.match(/const canRecoverGutsWithPoint = ([^;]+);/) || [])[1] || '';
const nextLine = (fn.match(/const next = ([^;]+);/) || [])[1] || '';
check('押せる条件を本体から取り出せる', condLine.length > 0, condLine);
check('回復後の値の式を本体から取り出せる', nextLine.length > 0, nextLine);

// 本体の式は guts / upgradePoints / effectiveMaxGuts という名前をそのまま参照するので、
// 同じ名前の変数を用意して動かす。redraw=true なら1回押すごとに描画が追いついて錠が開く
const makeRunner = (redraw) => new Function('GUTS_RECOVERY_POINT_COST', 'GUTS_RECOVERY_AMOUNT', `
  return (input) => {
    let guts = input.guts, upgradePoints = input.upgradePoints;
    const effectiveMaxGuts = input.effectiveMaxGuts;
    let locked = false, applied = 0;
    for (let i = 0; i < input.clicks; i++) {
      const canRecoverGutsWithPoint = ${condLine};
      if (locked) continue;
      if (!canRecoverGutsWithPoint) continue;
      const next = ${nextLine};
      if (next <= guts) continue;
      locked = true;
      guts = next;
      upgradePoints = Math.max(0, upgradePoints - GUTS_RECOVERY_POINT_COST);
      applied++;
      if (${redraw ? 'true' : 'false'}) locked = false; // 描画が追いつくと錠が開く
    }
    return { guts, upgradePoints, applied };
  };
`)(1, 10);
const runner = makeRunner(true);
// 連打(同じ描画の間に続けて押す)を再現する版。錠が無いとここで多重に使えてしまう
const runnerBurst = makeRunner(false);

const CASES = [
  { label: '1P消費でガッツ+10', guts: 70, upgradePoints: 3, effectiveMaxGuts: 100, clicks: 1, wantGuts: 80, wantPoints: 2 },
  { label: '最大を超えない(95→100)', guts: 95, upgradePoints: 3, effectiveMaxGuts: 100, clicks: 1, wantGuts: 100, wantPoints: 2 },
  { label: '満タンでは何も起きない', guts: 100, upgradePoints: 3, effectiveMaxGuts: 100, clicks: 3, wantGuts: 100, wantPoints: 3 },
  { label: 'ポイント0では何も起きない', guts: 10, upgradePoints: 0, effectiveMaxGuts: 100, clicks: 3, wantGuts: 10, wantPoints: 0 },
  { label: '持っているポイントぶんだけ使える', guts: 0, upgradePoints: 2, effectiveMaxGuts: 100, clicks: 5, wantGuts: 20, wantPoints: 0 },
  { label: '満タンになったらそれ以上減らない', guts: 85, upgradePoints: 5, effectiveMaxGuts: 100, clicks: 5, wantGuts: 100, wantPoints: 3 },
  { label: '最大ガッツが上がっている場合もその値まで', guts: 100, upgradePoints: 2, effectiveMaxGuts: 130, clicks: 2, wantGuts: 120, wantPoints: 0 },
];
for (const c of CASES) {
  const r = runner(c);
  check(`${c.label}: ガッツ ${c.guts}→${c.wantGuts}`, r.guts === c.wantGuts, String(r.guts));
  check(`${c.label}: ポイント ${c.upgradePoints}→${c.wantPoints}`, r.upgradePoints === c.wantPoints, String(r.upgradePoints));
}
// 最大ガッツそのものは、この処理で書き換えない
check('回復処理は最大ガッツ(maxGuts)を書き換えない', !/setMaxGuts/.test(fn));
check('回復処理は強化ポイントを増やさない(取り消しが無い)', !/setUpgradePoints\(p\s*=>\s*p\s*\+/.test(fn));

// ---- ④ 連打 ----
const burst = runnerBurst({ guts: 50, upgradePoints: 1, effectiveMaxGuts: 100, clicks: 5 });
check('★同じ描画の間に連打しても、1ポイントで1回しか回復しない',
  burst.applied === 1 && burst.guts === 60 && burst.upgradePoints === 0,
  `${burst.applied}回 / ガッツ${burst.guts} / ポイント${burst.upgradePoints}`);
check('連打を止める同期の錠がある',
  has('const gutsRecoveryLockRef = useRef(false);')
    && /if \(gutsRecoveryLockRef\.current\) return;/.test(fn)
    && has('useEffect(() => { gutsRecoveryLockRef.current = false; });'));

// ---- ③ 取り消しできないこと ----
check('ガッツ回復を取り消す導線が無い',
  !/戻す|取り消|返還|undo/i.test(slice('data-guts-recovery', '{uniqueUpgradeEntries()')));
// 技の＋／－は従来どおり(ポイントが戻るのは技の側だけ)
check('固有技の＋／－は従来どおり',
  has('if(diff>0) setUpgradePoints(p=>p-1); else setUpgradePoints(p=>p+1);')
    && has('setUpgradePoints(p=>diff>0?p-1:p+1);'));

// ---- ⑤ 既存仕様に触れていないこと ----
// 強化フェーズを抜けるときにポイントを捨てていないこと(残したぶんは次回へ持ち越す)。
// 「ブリーダー継承へ」で次の画面に進むところに、ポイントを0へ戻す処理が無いことを見る
const nextButton = slice("setTeachingPool(availableTeachings.sort", "ブリーダー継承へ");
check('未使用ポイントを残して次へ進んでも捨てられない', !/setUpgradePoints/.test(nextButton), nextButton.slice(0, 80));
// ポイントを0へ戻すのは、ランを始めるとき(resetAllState経由)だけ
check('ポイントを0へ戻すのはラン開始時だけ',
  (source.match(/setUpgradePoints\(0\)/g) || []).length === 2,
  `${(source.match(/setUpgradePoints\(0\)/g) || []).length}か所`);
check('WAVEクリア時のポイント付与を変えていない',
  has('setUpgradePoints(prev=>prev+(Math.floor(Math.random()*4)+1));'));
check('固有技のLv上限は8のまま', has('const MAX_UNIQUE_SKILL_LEVEL = 8;') && has('Math.max(0,Math.min(8,u.evoLevel+diff))'));
check('クイックモードの自動強化に触れていない', has('const rolled=rollQuickUniqueUpgrade(nextUniques,nextSlots);'));
// ガッツ回復のボタンは強化画面の中だけに置く
check('ガッツ回復は固有技の強化画面の中だけ',
  (source.match(/data-guts-recovery /g) || []).length === 1
    && (source.match(/data-guts-recovery-button/g) || []).length === 1
    && source.indexOf('data-guts-recovery ') > source.indexOf("gameState==='UPGRADE_SKILL'"));

// ---- ⑥ 表示 ----
const ui = slice('data-guts-recovery className', '{uniqueUpgradeEntries()');
check('現在ガッツと最大ガッツを出す', ui.includes('現在ガッツ') && ui.includes('{guts}') && ui.includes('/ {effectiveMaxGuts}'));
check('1Pで+10と分かる表示', ui.includes('{GUTS_RECOVERY_POINT_COST}P で +{GUTS_RECOVERY_AMOUNT}'));
check('満タンならMAXと出して押せない', ui.includes('MAX') && ui.includes('disabled={!canRecoverGutsWithPoint}'));
check('ポイント不足のときもそう分かる', ui.includes('ポイント不足'));
check('タップしやすい大きさ(44px以上)', ui.includes('min-h-[44px]'));
check('技一覧を圧迫しないよう1行に収める(shrink-0で高さ固定)', ui.includes('shrink-0') && ui.includes('flex items-center gap-2'));

// ---- ヘルプ・更新履歴 ----
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelogSrc = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
// 「ガッツ回復」「強化ポイント」は他の項目にも出てくる語なので、今回の仕様の中身で見る
check('ヘルプに1Pで10回復すると書いてある',
  helpSrc.includes('強化ポイント1つで今のガッツを10回復'));
check('ヘルプに最大ガッツは増えないと書いてある',
  helpSrc.includes('最大ガッツは増えず'));
check('ヘルプに満タン・ポイント0では押せないと書いてある',
  helpSrc.includes('ガッツが満タンのときと、強化ポイントが0のときは押せません'));
check('ヘルプにガッツ回復のポイントは戻せないと書いてある',
  helpSrc.includes('ガッツ回復に使ったポイントは戻せません'));
check('ヘルプに持ち越しの説明がある',
  helpSrc.includes('残したぶんはそのまま次の強化のタイミングへ持ち越され'));
check('更新履歴に書いてある',
  changelogSrc.includes('強化ポイントでガッツを回復できるようにしました'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
