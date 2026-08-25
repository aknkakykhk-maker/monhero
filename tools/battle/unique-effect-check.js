const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 固有技の「効果の説明文」と「実際の実装」が食い違っていないかを見張る。
//
// 【なぜ道具にするか】
// 説明文(data/ally-monsters.js の effectDesc)と実装(game-system.jsx の card.monId 分岐)は
// 別のファイルにあり、片方だけ直しても例外は出ない。遊んでいる側からは
// 「書いてあるとおりに効いていない」としか分からず、原因の切り分けもできない。
//
// 実際に、モッチ砲の効果が
//   説明 「味方丈夫さ3%増」 / 実装 addPermaBuff('dmgCutPct', 0.03)(＝被ダメージ3%軽減)
// と食い違っていた。丈夫さの数値もガードの軽減量も増えないので、
// 「バフが効いていない」という報告になった。数字も意味も、ここで機械的に突き合わせる。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const ctx = { Math };
vm.createContext(ctx);
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/skills.js'),
  read('monster-hero/data/ally-monsters.js'),
  'globalThis.__d = { ALL_PLAYER_MONSTERS };',
].join('\n'), ctx);
const MONS = ctx.__d.ALL_PLAYER_MONSTERS;

const source = read('monster-hero/src/game-system.jsx');

// --- 固有技の効果分岐だけを切り出す ---
// card.monId==='X' は getDmg やザンの連撃判定にも出てくるので、
// 「固有技を使ったときの効果」を書いている範囲へ先に絞ってから探す。
// 範囲は processTurn の中の、モッチーの分岐からアーク/イブリースの分岐までの間。
const EFFECT_FROM = "if(card.monId==='Mocchi'||card.monId==='Mitarashi')";
const EFFECT_TO = "else if(card.monId==='Ark'||card.monId==='Iblis'){";
const effectRegion = (() => {
  const from = source.indexOf(EFFECT_FROM);
  const to = source.indexOf(EFFECT_TO, from);
  return (from >= 0 && to > from) ? source.slice(from, to) : null;
})();
check('固有技の効果を書いている範囲を取り出せる', !!effectRegion);
if (!effectRegion) { console.log('\n1件のNGがあります'); process.exit(1); }
const branchOf = (monId) => {
  // 1行で書かれているので、その行末までで足りる
  const m = effectRegion.match(new RegExp(`card\\.monId==='${monId}'[^\\n]*`));
  return m ? m[0] : null;
};
check('ピクシーとミーアの魔法空間が同じ分岐で次ターン消費0を付ける',
  /card\.monId==='Pixie'\|\|card\.monId==='Mia'\)\{setNextTurnBuff\('zeroGuts',true\)/.test(effectRegion));
check('ピクシーとミーアの魔力開放が固有技を2倍にする',
  /\(mainHero\?\.id==='Pixie'\|\|mainHero\?\.id==='Mia'\)\&\&card\.type==='unique'\?2\.0:1\.0/.test(source));

// 効果の「意味」まで見るために、実装で使っている関数とキーを明示的に突き合わせる。
//   impl … その分岐に必ず出てほしい実装(関数名とキー、割合)
//   desc … 説明文に必ず出てほしい言葉
// 割合は実装から読み取り、説明文の数字と一致するかを数値で確かめる。
const RULES = [
  {
    monId: 'Mocchi', label: 'モッチー(モッチ砲)',
    impl: [
      { re: /addPermaBuff\('dmgCutPct',([\d.]+)\*effMul\)/, mustSay: '被ダメージ', unit: '%', note: '被ダメージの割合軽減' },
      // 敵被ダメ増は「使ったターンからすぐ効く」ため、値は共有関数 localBoostFromCard に
      // 集約されている(processTurnとカード選択中のプレビューの両方がここを参照する)。
      // branch(processTurnのモッチー分岐)ではなく、その定義側で値を確かめる
      { re: /monId==='Mocchi'\|\|card\.monId==='Mitarashi'\)\) return \{ dmgMod: ([\d.]+) \};/, mustSay: '敵被ダメ', unit: '%', note: '敵の被ダメージ増加', target: 'source' },
    ],
    forbid: [{ re: /addPermaBuff\('defPct'/, why: 'モッチーは丈夫さは上げない(被ダメージ軽減)' }],
    usesSharedBoost: 'dmgMod',
  },
  {
    monId: 'Monol', label: 'モノリス(トリオビームX)',
    impl: [
      { re: /addPermaBuff\('defPct',([\d.]+)\*effMul\)/, mustSay: '丈夫さ', unit: '%', note: '丈夫さのバフ(defPct)' },
      { re: /addWaveBuff\('enemyAtkDebuffPct',([\d.]+)\*effMul\)/, mustSay: '敵攻', unit: '%', note: '敵攻撃力の低下' },
    ],
    forbid: [
      { re: /addPermaBuff\('dmgCutPct'/, why: 'モノリスは被ダメージ軽減ではなく丈夫さアップ' },
      { re: /setDef\(/, why: '丈夫さアップは基礎ステータスではなくバフとして持つ' },
    ],
  },
  {
    monId: 'Golem', label: 'ゴーレム(合掌)',
    // 与ダメージ増も「使ったターンからすぐ効く」ため、モッチーと同じく localBoostFromCard 側で確かめる
    impl: [{ re: /monId==='Golem'\) return \{ oryo: ([\d.]+) \};/, mustSay: '与ダメージ', unit: '%', note: '与ダメージの増加', target: 'source' }],
    forbid: [],
    usesSharedBoost: 'oryo',
  },
  {
    monId: 'Zan', label: 'ザン(リバースレイド)',
    impl: [{ re: /addPermaBuff\('comboDmgPct',([\d.]+)\*effMul\)/, mustSay: '連撃ダメージ', unit: '%', note: '連撃ダメージの増加' }],
    forbid: [],
  },
];

// 説明文に「その数字」がパーセントとして出てくるか。3% / 7.5% / 10% のいずれの書き方でも拾う
const descHasPercent = (desc, value) => {
  const pct = value * 100;
  const shown = Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(1)));
  return new RegExp(`${shown.replace('.', '\\.')}\\s*%`).test(desc);
};

for (const rule of RULES) {
  const mon = MONS[rule.monId];
  if (!mon) { check(`${rule.label}: モンスターが存在する`, false); continue; }
  const desc = mon.unique?.effectDesc || '';
  const branch = branchOf(rule.monId);
  check(`${rule.label}: 効果の実装が見つかる`, !!branch);
  if (!branch) continue;
  console.log(`  説明文「${desc}」`);
  for (const one of rule.impl) {
    const m = (one.target === 'source' ? source : branch).match(one.re);
    check(`${rule.label}: ${one.note}が実装されている`, !!m, m ? `${(Number(m[1]) * 100)}%` : '見つからない');
    if (!m) continue;
    const value = Number(m[1]);
    check(`${rule.label}: 説明文が「${one.mustSay}」と書いている`, desc.includes(one.mustSay), desc);
    check(`${rule.label}: 説明文の数字が実装と一致(${(value * 100)}%)`, descHasPercent(desc, value), desc);
  }
  for (const f of rule.forbid) {
    check(`${rule.label}: ${f.why}`, !f.re.test(branch), branch.match(f.re)?.[0] || '');
  }
  // 値の定義元(localBoostFromCard)を、processTurnのこの分岐が実際に参照していること。
  // 定義と参照が別の場所にあるので、繋がりが切れていないかをここで確かめる
  if (rule.usesSharedBoost) {
    check(`${rule.label}: localBoostFromCardの値を使っている(繋がりが切れていない)`,
      new RegExp(`localBoostFromCard\\(card\\)\\.${rule.usesSharedBoost}`).test(branch), branch);
  }
}

// --- 2枚目以降の半減(effMul)が全ての固有技効果へ掛かっていること ---
// 掛け忘れると、2枚目に使ったときだけ効果が丸ごと1枚目ぶん乗ってしまう
// chuuniUniqueStack は「使った回数」を数える積み上げなので、半減の対象外
const NOT_HALVED = new Set(['chuuniUniqueStack']);
const buffCalls = [...effectRegion.matchAll(/add(?:PermaBuff|WaveBuff)\('(\w+)',([^)]+)\)/g)];
check('固有技の効果に効果量がある', buffCalls.length > 0, `${buffCalls.length}件`);
for (const m of buffCalls) {
  const [, key, arg] = m;
  if (NOT_HALVED.has(key)) continue;
  // 呼び出しへ直接 `値*effMul` を渡す形と、先に
  // `const boost=localBoostFromCard(card).x*effMul` を作ってから渡す形の両方を認める。
  // どちらでも、その呼び出しを含む行のどこかに `*effMul` があるはず
  const lineStart = effectRegion.lastIndexOf('\n', m.index) + 1;
  const lineEndIdx = effectRegion.indexOf('\n', m.index);
  const line = effectRegion.slice(lineStart, lineEndIdx < 0 ? undefined : lineEndIdx);
  check(`2枚目以降の半減が効く: ${key}`, /\*effMul/.test(arg) || /\*effMul/.test(line), arg);
}
// --- 丈夫さバフが「基礎ステータスを書き換えない」こと ---
// def を直接いじると、能力報酬の計算((丈夫さ+20)×1.1)やガード段階まで巻き込み、
// バフが外れたときに戻せなくなる。ライフ・ガッツと同じく実効値で扱う
check('丈夫さバフは基礎ステータスを書き換えない', !/setDef\(d => d \+/.test(source));
check('丈夫さバフを乗せた実効値がある',
  /const effectiveDef = useMemo\(\(\) => resolveEffectiveMaxStat\(def, getPermaBuff\('defPct'\)\), \[def, permaBuffs\]\);/.test(source));
// 丈夫さの固定軽減の係数は 0.75 → 0.5 と調整されている。係数そのものを固定すると
// バランス調整のたびにここが落ちるだけなので、「実効の丈夫さを使っているか」を見る。
// 係数を変えたときは meloso-assist-check.js のモデルも直す必要があるため、
// あちらのDRIFT GUARDが係数を見張っている
check('被ダメージの固定軽減に実効の丈夫さを使う',
  /Math\.max\(30,\(atkVal-effectiveDef\*[\d.]+\)\*\(1-defenseRate\)\)/.test(source));
check('被ダメージの割合軽減に実効の丈夫さを使う',
  /const defenseRate = Math\.min\(0\.5,effectiveDef\*[\d.]+\);/.test(source));
check('ガードの軽減量(表示)に実効の丈夫さを使う', /Math\.floor\(flat \+ effectiveDef \* mult\)/.test(source));
check('ガードの軽減量(実処理)に実効の丈夫さを使う', /Math\.floor\(immediateEffects\.guardFlat \+ effectiveDef\*immediateEffects\.guardMult\)/.test(source));

// --- 「そのターンから効く」か「次のターンから効く」かが説明文と合っていること ---
// processTurn / handleEnemyTurn は await を挟んで進むため、途中で付けた permaBuffs /
// waveBuffs は state から読み直せない(そのターンが始まった時点の値を掴み続ける)。
// そのため「ずっと続く効果」は原則そのターンには乗らず、次のターンから効く。
// 一部だけローカル変数へ控えて同じターンから効かせているので、
// どちらなのかをここで固定し、説明文と食い違わないようにする。
// ＊即時にしたい効果を増やすときは、必ずローカル変数での持ち回りとセットで行うこと。
{
  // 同じターンから効くもの(ローカル変数で持ち回っている)
  const immediatePairs = [
    ["攻撃アップ(おりょう・ゴーレム)", /localOryoAdd\+=/, /getPermaBuff\('atkPct'\)\+getPermaBuff\('muaAtkPct'\)\+additionalOryo/],
    ["敵の被ダメージ増(モッチー・ミタラシ)", /localDmgModAdd\+=/, /getWaveBuff\('enemyTakenDmgBonus'\)\+additionalDmgMod/],
    ["全体連撃(きき)", /localGlobalComboAdd\+=/, /getPermaBuff\('globalComboDmgPct'\)\+localGlobalComboAdd/],
  ];
  for (const [name, add, use] of immediatePairs) {
    check(`同じターンから効く: ${name}`, add.test(source) && use.test(source));
  }
  // ライフ・ガッツの上限は、ゲージがその場で新しい上限を描くので即時でなければならない
  check('同じターンから効く: ライフ・ガッツの上限アップ',
    /const liveEffectiveMaxHp = \(\) => resolveEffectiveMaxStat\(maxHpRef\.current, livePermaBuff\('muaHpPct'\)\);/.test(source)
    && /const liveEffectiveMaxGuts = \(\) => resolveEffectiveMaxStat\(maxGutsRef\.current, livePermaBuff\('muaGutsPct'\)\);/.test(source));

  // 次のターンから効くもの(持ち回っていない＝そのターンの計算には乗らない)。
  // 説明文へ「次のターンから」と書いてあることまで確かめる
  const monsters = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
  const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
  const nextTurnKeys = ['defPct','dmgCutPct','critRatePct','critDmgPct','comboDmgPct',
    'muaAtkPct','autoHpRecovery','gutsRecoverPct','snegurochkaGutsDiscountStacks','chuuniUniqueStack'];
  for (const key of nextTurnKeys) {
    check(`次のターンから効く(持ち回っていない): ${key}`, !new RegExp(`local[A-Za-z]*\\+=[^\\n]*${key}`).test(source));
  }
  check('モノリスの障壁が「次のターンから」と書いてある', /障壁：次のターンから/.test(monsters));
  check('モッチー・ミタラシの被ダメ軽減が「次のターンから」と書いてある', /味方の被ダメージ3%軽減\(永続\/次のターンから\)/.test(monsters));
  check('ライガーの会心アップが「次のターンから」と書いてある', /会心ダメージ\+2%\(永続\/重複可\/次のターンから\)/.test(monsters));
  check('ザンの連撃ダメージが「次のターンから」と書いてある', /連撃ダメージ\+3%\(永続\/重複可\/次のターンから\)/.test(monsters));
  check('絶氷の楔の消費ガッツ減が「次のターンから」と書いてある', /消費ガッツ3%減（永続・重複可・次のターンから）/.test(monsters));
  check('中二病の消費ガッツ増が「次のターンから」と書いてある', /ダメージ倍率\+0\.1\(永続\/重複可\/次のターンから\)/.test(monsters));
  check('ドラの被ダメージダウンが「次のターンから」と書いてある', /%ダウン（次のターンから）/.test(source));
  check('かどみうむの自動回復が「次のターンから」と書いてある', /自動回復 \$\{pct\(tier\.auto(Hp|Guts)\)\}%アップ（次のターンから）/.test(source));
  check('みゅあの攻撃アップが「次のターンから」と書いてある', /攻撃 \d%アップ（次のターンから）/.test(source));
  check('ヘルプに全体のルールが書いてある', /ずっと続く効果は「次のターンから」です/.test(help));
}

// --- 画面の表示が意味と合っていること ---
// 「被ダメージ軽減」を「DEF +3%」と出していたため、丈夫さが増えたように見えていた
check('丈夫さバフが「DEF +◯%」として出る', /DEF \+\{Math\.floor\(getPermaBuff\('defPct'\)\*100\)\}%/.test(source));
check('被ダメージ軽減は「被ダメ -◯%」として別に出る', /被ダメ -\{Math\.floor\(getPermaBuff\('dmgCutPct'\)\*100\)\}%/.test(source));
check('被ダメージ軽減を「DEF +◯%」と表示していない', !/DEF \+\{Math\.floor\(getPermaBuff\('dmgCutPct'\)\*100\)\}%/.test(source));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
