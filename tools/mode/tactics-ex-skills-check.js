const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクス専用 EXスキル(STEP1: 共通基盤)を、本体の純関数をそのまま動かして確かめる。
// 設計の正本: docs/spec/TACTICS_EX_SKILLS.md
//
//   node tools/mode/tactics-ex-skills-check.js
//
//   ① タクティクス以外へ出ない(公開フラグ・デバッグ・練習の組み合わせを総当たり)
//   ② 定義: 3体(モノリス・ゴーレム・剣士モッチー)の回数・併用・効果時間が仕様どおり
//   ③ 回数: 使うと1減る／0になったら使えない／無制限は減らない
//   ④ WAVEが変わっても回数は戻らない。新しいランの状態は初期値
//   ⑤ 併用: 併用できないEXはその子にカードを置いていると使えず、使ったターンは**その子だけ**カードを選べない
//            併用できるEXは使ってもカードを選べる。どちらも次のターンには解ける
//   ⑥ 倒れた子は使えない(カードと同じ決まり)。同じ子は1ターンに1回まで
//   ⑦ 効果の長さ: 発動ターン／発動WAVE／切り替え(もう一度使うまで)が、見るたびに正しく数え直される
//   ⑧ 壊れた値が来ても落ちない
//   ⑨ 本体への結線(距離枠のタップは詳細を開くだけ・EXは枚数に数えない・ランの片付けで作り直す)
//
// 計算は必ず本体から切り出した実装をそのまま動かす(数式をこのファイルへ書き写さない)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const readPart = (name) => fs.readFileSync(path.join(root, 'monster-hero/src/parts', name), 'utf8');
const app = readPart('60-app.jsx');
const screen = readPart('71-screen-battle.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};
const line = (from) => slice(from, '\n');

const sandbox = { console };
vm.createContext(sandbox);
// モードの定数と isTacticsMode、公開フラグと入口の判定
const modeConsts = source.match(/^const BATTLE_MODE_[A-Z_]+ = '[^']+';$/gm) || [];
vm.runInContext([
  ...modeConsts,
  slice('const TACTICS_BATTLE_MODES', ']);') + ']);',
  line('const RAID_JACK_BATTLE_MODES'),
  line('const isRaidJackMode'),
  line('const isTacticsMode'),
  line('const TACTICS_EX_SKILLS_RELEASE'),
  slice('const tacticsExSkillsEnabled', ';\n') + ';',
  'globalThis.modes={' + modeConsts.map(c => c.match(/const (\w+)/)[1]).join(',') + '};',
  'globalThis.gate={tacticsExSkillsEnabled,TACTICS_EX_SKILLS_RELEASE,isTacticsMode};',
].join('\n'), sandbox);
// EXの純関数。tacticsSafeInt だけは 32-tactics-units の頭から借りる
vm.runInContext([
  slice('const tacticsSafeInt', 'const tacticsClamp'),
  // かばう先は「立っている子」だけ。盤面の関数(tacticsAliveSlots)を借りる
  line('const tacticsClamp'),
  slice('const normalizeTacticsUnit', 'const applyTacticsDamage'),
  // 上限の作り直し(みゅあ補正とEXの上限アップ)も本体から借りる
  slice('const tacticsExMaxRateOf', '// 敵の攻撃。当たった子だけが減り'),
  slice('const tacticsAliveSlots', 'const tacticsFilledSlots'),
  slice('// ==== タクティクス専用 EXスキル(STEP1: 共通基盤) ====', '// ==== タクティクス専用 EXスキルここまで ===='),
  'globalThis.ex={TACTICS_EX_SKILLS,TACTICS_EX_DURATION_TEXT,TACTICS_EX_IMPLEMENTED_EFFECTS,normalizeTacticsExDef,'
    + 'tacticsExDefOf,tacticsExRemainOf,tacticsExThunderOf,addTacticsExThunder,tacticsExMultiBuffOf,tacticsExExtraCombosAt,tacticsExPresentNote,tacticsExPresentKindText,isTacticsExEffectImplemented,createTacticsExState,normalizeTacticsExState,tacticsExUsesOf,'
    + 'tacticsExRemaining,isTacticsExEffectActive,isTacticsExCardLocked,tacticsExLockedSlots,isTacticsExTurnUsed,checkTacticsExUse,'
    + 'applyTacticsExUse,scaleTacticsUnits,setTacticsExMaxRate,expireTacticsExMaxRates,tacticsExDurationText,tacticsExTurnsLeft,tacticsExStyleOf,tacticsExStyleLabel,checkTacticsExChoice,setTacticsExInitialStyle,tacticsExActiveStyle,TACTICS_EX_DUAL_HIT_REPEAT,tacticsExActiveEffect,tacticsExRegenRateAt,applyTacticsExStats,tacticsExCoverSlot,coverTacticsTargets,tacticsExPartyTakenMult,tacticsExPartyRegenRate,tacticsExExtraCombosAt,tacticsExMultiBuffOf,tacticsExLifeCost,tacticsExTargetOptions,checkTacticsExTarget,tacticsExPandoraBoxOf,tacticsExPandoraDevil,tacticsExPandoraTurnEnd,spendTacticsExPandoraBox,setTacticsExMaxHpRate,tacticsExTimeStopSlot,spendTacticsExTimeStop,tacticsExUniqueGuaranteeSlot,ensureTacticsExUniqueInHand,tacticsExCardBonusTotal,tacticsExCardBonusAt,tacticsExVoltageOf,addTacticsExVoltage,rollTacticsExPresent,setTacticsExPresent,tacticsExPresentOf,resetTacticsExWaveUses,TACTICS_EX_PRESENT_KINDS,recordTacticsExDodge,TACTICS_EX_DIST_MATCH_MULT,tacticsExDistMatchDodges};',
].join('\n'), sandbox);
// ヒット列(二刀流で2回ぶん入るか)は本体の buildAttackHits をそのまま動かす
vm.runInContext(slice('const HERO_CARD_BONUS_MONSTER_IDS', 'const attackAtonementDmg') + ';globalThis.hitsApi={buildAttackHits};', sandbox);
const { gate, modes, ex, hitsApi } = sandbox;

// ---------- ① タクティクス以外へ出ない ----------
{
  const all = Object.values(modes);
  const leaks = [];
  for (const mode of [...all, 'extreme', null, undefined, '']) {
    for (const debugBattle of [false, true]) {
      for (const tutorial of [false, true]) {
        const on = gate.tacticsExSkillsEnabled(mode, { debugBattle, tutorial });
        if (on && !gate.isTacticsMode(mode)) leaks.push(`${mode}/debug=${debugBattle}`);
        if (on && tutorial) leaks.push(`${mode}/練習中`);
      }
    }
  }
  check('タクティクス以外のモードと練習では、どの組み合わせでもEXが出ない', leaks.length === 0, leaks.join(', '));
  const tacticsModes = all.filter(m => gate.isTacticsMode(m));
  // 通常の3つ(tactics / tacticsSpecies / tacticsPro)に、ジャック戦の2つ(raidJackA / raidJackB)が加わる(2026-10-04)
  check('タクティクスのモードが5つ見えている(通常3つ+ジャック戦2つ。検査が空回りしていない)', tacticsModes.length === 5, tacticsModes.join(','));
  check('デバッグのバトルでは、タクティクスの3モードすべてでEXが出る',
    tacticsModes.every(m => gate.tacticsExSkillsEnabled(m, { debugBattle: true })));
  check('公開フラグが立っていないあいだは、本番(デバッグでない)のタクティクスへ出ない',
    gate.TACTICS_EX_SKILLS_RELEASE === true
      || tacticsModes.every(m => !gate.tacticsExSkillsEnabled(m, { debugBattle: false })),
    `TACTICS_EX_SKILLS_RELEASE=${gate.TACTICS_EX_SKILLS_RELEASE}`);
}

// ---------- ② 3体の定義 ----------
const monol = ex.tacticsExDefOf('Monol');
const golem = ex.tacticsExDefOf('Golem');
const kenshi = ex.tacticsExDefOf('KenshiMocchi');
// いまは無制限のEXが無いので、無制限の決まり(減らない・1ターン1回)は剣士モッチーの定義から作った無制限版で確かめる
const unlimitedDef = ex.normalizeTacticsExDef({ ...kenshi, unlimited: true, maxUses: 0 });
check('モノリス「みんなをかばう」: ラン10回・併用できる・発動ターン',
  monol && monol.name === 'みんなをかばう' && monol.maxUses === 10 && !monol.unlimited && monol.withCards && monol.duration === 'turn',
  JSON.stringify(monol));
check('ゴーレム「捨て身」: ラン3回・使ったターンは他カード不可・WAVE内・効果中は再使用不可',
  golem && golem.name === '捨て身' && golem.maxUses === 3 && !golem.unlimited && !golem.withCards && golem.duration === 'wave'
    && golem.conditions.includes('notActive'),
  JSON.stringify(golem));
check('剣士モッチー「ソード・コンバージョン」: ラン5回・カードと併用できる・再使用まで続く',
  kenshi && kenshi.name === 'ソード・コンバージョン' && kenshi.maxUses === 5 && !kenshi.unlimited && kenshi.withCards && kenshi.duration === 'style'
    && kenshi.styles.map(st => st.label).join('/') === '片手剣/片手盾/二刀流' && kenshi.defaultStyle === 'sword' && kenshi.heroInitialStyle,
  JSON.stringify(kenshi));
check('ソード・コンバージョンの説明だけで3つのスタイルの効き目が分かる', ['片手剣：', '片手盾：', '二刀流：', '丈夫さ', 'ソードスキル', '連撃', 'メイン']
  .every(w => kenshi.desc.includes(w)), kenshi.desc);
check('EXを持たない子は null', ex.tacticsExDefOf('Ham') === null && ex.tacticsExDefOf(null) === null
  && ex.tacticsExDefOf('toString') === null && ex.tacticsExDefOf('__proto__') === null);
check('どの定義も効果時間の説明を持つ', Object.keys(ex.TACTICS_EX_SKILLS)
  .every(id => !!ex.tacticsExDurationText(ex.tacticsExDefOf(id))));
// 説明文の言い回し(2026-10-03 ユーザー指摘「ガッツの上限のなん%が戻るって回復のことだよね？ 文言おかしくない？」)。
// ライフ・ガッツが増えるのは「回復する」と書く(「戻る」は別の意味に読める)。「最大ライフ」の語順も崩さない
{
  const bad = Object.keys(ex.TACTICS_EX_SKILLS).map(id => ex.tacticsExDefOf(id)).filter(d => /上限の[0-9]+%戻|ライフを最大の/.test(d.desc || '')).map(d => d.name);
  check('どの説明文も「上限の◯%戻る」「ライフを最大の」を使わない(回復と書く)', bad.length === 0, bad.join(','));
}
// 使った直後に出す「何が起きたか」(useNote)。どのEXにも1行ある。プレゼントは中身ごとの数字つきの言い方になる
check('どのEXも使った直後の一言(useNote)を持つ', Object.keys(ex.TACTICS_EX_SKILLS).every(id => ex.tacticsExDefOf(id).useNote.length > 0),
  Object.keys(ex.TACTICS_EX_SKILLS).filter(id => !ex.tacticsExDefOf(id).useNote).join(','));
{
  const sn = ex.tacticsExDefOf('Snegurochka');
  const one = ex.tacticsExPresentNote({ jackpot: false, kinds: ['dmg'] }, sn.present, sn.turns);
  const all = ex.tacticsExPresentNote({ jackpot: true, kinds: ['dmg', 'taken', 'combo', 'heal', 'guts', 'crit'] }, sn.present, sn.turns);
  check('プレゼントの中身は数字つきで言う(1つ・大当たり)', one === '全員のガッツが上限の20%回復＋与ダメージ+20%（2ターン）'
    && all.startsWith('全員のガッツが上限の20%回復＋大当たり！ ') && ['与ダメージ+20%', '被ダメージ−20%', '連撃 与ダメ10%×2回', 'ライフが上限の20%回復', 'ガッツがさらに上限の20%回復', '会心率×1.3'].every(w => all.includes(w)), one + ' / ' + all);
}
const ids = Object.keys(ex.TACTICS_EX_SKILLS).map(id => ex.tacticsExDefOf(id).id);
check('EXのidが重ならない', new Set(ids).size === ids.length, ids.join(','));
// STEP1 では効果の中身がまだ無い。入れたら TACTICS_EX_IMPLEMENTED_EFFECTS へ足すので、ここも合わせて変わる
check('効果が入っていないEXは「未実装」と判定される(画面が「開発中」を出す手がかり)',
  [monol, golem, kenshi].every(d => ex.isTacticsExEffectImplemented(d) === ex.TACTICS_EX_IMPLEMENTED_EFFECTS.includes(d.effect)));

// ---------- ③④ 回数 ----------
const T = (wave, turn) => ({ wave, turn });
// スタイル式(ソード・コンバージョン)は、いまのスタイル以外を1つ選んで使う
const use = (state, def, slot, monId, now, extra = {}) => {
  const c = ex.checkTacticsExUse({ def, state, slot, monId, alive: true, selectedCount: 0, now, ...extra });
  const choice = extra.choice || (def && def.duration === 'style'
    ? def.styles.find(st => st.id !== ex.tacticsExStyleOf(def, state, slot, monId)).id : null);
  return { check: c, state: c.ok ? ex.applyTacticsExUse(state, { def, slot, monId, now, choice }) : state };
};
{
  let s = ex.createTacticsExState();
  // ★モノリスは 2026-09-25 から1ラン10回。回数は定義から読む(数字を検査へ書き写さない)
  const M = monol.maxUses;
  check('新しいランの状態は、どの子も0回', ex.tacticsExUsesOf(s, 0, 'Monol') === 0
    && ex.tacticsExRemaining(monol, 0).left === M);
  let r = use(s, monol, 1, 'Monol', T(1, 1)); s = r.state;
  check(`使うと残りが1減る(${M}→${M - 1})`, r.check.ok && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === M - 1);
  // WAVEをまたぐ(WAVE2の1ターン目)。回数は戻らない
  r = use(s, monol, 1, 'Monol', T(2, 1)); s = r.state;
  check(`WAVEが変わっても回数は戻らない(${M - 1}→${M - 2})`, r.check.ok && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === M - 2);
  let allOk = true;
  for (let k = 2; k < M; k += 1) { r = use(s, monol, 1, 'Monol', T(3 + k, 1)); allOk = allOk && r.check.ok; s = r.state; }
  check(`${M}回目で0になる`, allOk && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === 0);
  r = use(s, monol, 1, 'Monol', T(99, 1));
  check('0回では使えない', !r.check.ok && /回数/.test(r.check.reason), r.check.reason);
  check('ほかの枠の回数には影響しない', ex.tacticsExUsesOf(s, 0, 'Monol') === 0);
  check('枠の子が違えば、その子はまだ使っていない扱い', ex.tacticsExUsesOf(s, 1, 'Golem') === 0);
  const fresh = ex.createTacticsExState();
  check('新しいランを作り直すと初期値に戻る', ex.tacticsExUsesOf(fresh, 1, 'Monol') === 0
    && !ex.isTacticsExCardLocked(fresh, 1, T(1, 1)) && !ex.isTacticsExTurnUsed(fresh, T(1, 1)));
  // 無制限(いまは無制限のEXが無いので、剣士モッチーの定義から無制限版を作って確かめる)
  let k = ex.createTacticsExState();
  let okAll = true;
  for (let turn = 1; turn <= 30; turn += 1) {
    const rr = use(k, unlimitedDef, 0, 'KenshiMocchi', T(1 + Math.floor(turn / 10), turn));
    okAll = okAll && rr.check.ok; k = rr.state;
  }
  const rem = ex.tacticsExRemaining(unlimitedDef, ex.tacticsExUsesOf(k, 0, 'KenshiMocchi'));
  check('無制限EXは何回使っても減らない(30回)', okAll && rem.unlimited && rem.left === Infinity, JSON.stringify(rem));
}

// ---------- ⑤⑥ 併用・倒れた子・1ターン1回 ----------
{
  const s0 = ex.createTacticsExState();
  const blocked = ex.checkTacticsExUse({ def: golem, state: s0, slot: 2, monId: 'Golem', alive: true, selectedCount: 1, now: T(1, 3) });
  check('併用できないEXは、その子にカードを置いていると使えない', !blocked.ok && /カード/.test(blocked.reason), blocked.reason);
  const g = use(s0, golem, 2, 'Golem', T(1, 3)).state;
  check('併用できないEXを使ったターンは、使った子はカードを選べない', ex.isTacticsExCardLocked(g, 2, T(1, 3)));
  // ★止まるのは使った子だけ(2026-09-23 ユーザー指示「EXで他行動禁止はそのモンスターだけ」)
  check('ほかの子は同じターンでもカードを使える', [0, 1, 3].every(slot => !ex.isTacticsExCardLocked(g, slot, T(1, 3)))
    && JSON.stringify(ex.tacticsExLockedSlots(g, T(1, 3))) === '[2]');
  check('次のターンにはカードを選べる', !ex.isTacticsExCardLocked(g, 2, T(1, 4)) && ex.tacticsExLockedSlots(g, T(1, 4)).length === 0);
  check('次のWAVEの同じターン数でも解けている', !ex.isTacticsExCardLocked(g, 2, T(2, 3)));
  const m = use(s0, monol, 1, 'Monol', T(1, 3), { selectedCount: 2 });
  check('併用できるEXは、カードを選んでいても使える', m.check.ok);
  check('併用できるEXを使っても、カードは選べる', !ex.isTacticsExCardLocked(m.state, 1, T(1, 3)));
  check('EXを使ったターンだと分かる(カードを使わずにターンを進められる)', ex.isTacticsExTurnUsed(m.state, T(1, 3))
    && !ex.isTacticsExTurnUsed(m.state, T(1, 4)));
  const again = ex.checkTacticsExUse({ def: monol, state: m.state, slot: 1, monId: 'Monol', alive: true, now: T(1, 3) });
  check('同じ子のEXは1ターンに1回まで', !again.ok, again.reason);
  const k2 = use(ex.createTacticsExState(), unlimitedDef, 0, 'KenshiMocchi', T(1, 1)).state;
  const againK = ex.checkTacticsExUse({ def: unlimitedDef, state: k2, slot: 0, monId: 'KenshiMocchi', alive: true, now: T(1, 1) });
  check('無制限でも同じターンに2回は使えない', !againK.ok);
  const down = ex.checkTacticsExUse({ def: monol, state: s0, slot: 1, monId: 'Monol', alive: false, now: T(1, 1) });
  check('倒れている子のEXは使えない(カードと同じ)', !down.ok && /倒れ/.test(down.reason), down.reason);
  const busy = ex.checkTacticsExUse({ def: monol, state: s0, slot: 1, monId: 'Monol', alive: true, now: T(1, 1), busy: true });
  check('行動中・AUTO中は使えない', !busy.ok);
  const both = use(m.state, golem, 2, 'Golem', T(1, 3));
  check('併用できるEXのあとでも、カードを選んでいなければ併用できないEXを使える', both.check.ok
    && ex.isTacticsExCardLocked(both.state, 2, T(1, 3)) && !ex.isTacticsExCardLocked(both.state, 1, T(1, 3)));
}

// ---------- ⑦ 効果の長さ ----------
{
  const s0 = ex.createTacticsExState();
  const m = use(s0, monol, 1, 'Monol', T(2, 4)).state;
  check('発動ターンのEXは、そのターンだけ効く', ex.isTacticsExEffectActive(m, 1, 'Monol', T(2, 4))
    && !ex.isTacticsExEffectActive(m, 1, 'Monol', T(2, 5)));
  const g = use(s0, golem, 3, 'Golem', T(2, 4)).state;
  check('WAVE内のEXは、そのWAVEのあいだ効き、次のWAVEで切れる', ex.isTacticsExEffectActive(g, 3, 'Golem', T(2, 20))
    && !ex.isTacticsExEffectActive(g, 3, 'Golem', T(3, 1)));
  let k = use(s0, kenshi, 0, 'KenshiMocchi', T(1, 2), { choice: 'shield' }).state;
  const on1 = ex.isTacticsExEffectActive(k, 0, 'KenshiMocchi', T(5, 1));
  k = use(k, kenshi, 0, 'KenshiMocchi', T(5, 1), { choice: 'sword' }).state;
  const on2 = ex.isTacticsExEffectActive(k, 0, 'KenshiMocchi', T(5, 1));
  check('スタイル式は、WAVEをまたいでも続き、片手剣へ戻すと切れる', on1 && !on2);
  check('スタイルの「いま」の呼び名(はじめは片手剣)', ex.tacticsExStyleLabel(kenshi, s0, 0, 'KenshiMocchi') === '片手剣'
    && ex.tacticsExStyleLabel(kenshi, use(s0, kenshi, 0, 'KenshiMocchi', T(1, 1), { choice: 'dual' }).state, 0, 'KenshiMocchi') === '二刀流');
  check('いまのスタイルは選べない・知らないスタイルも選べない', !!ex.checkTacticsExChoice(kenshi, s0, 0, 'KenshiMocchi', 'sword')
    && !!ex.checkTacticsExChoice(kenshi, s0, 0, 'KenshiMocchi', 'axe') && ex.checkTacticsExChoice(kenshi, s0, 0, 'KenshiMocchi', 'dual') === null);
  const bad = ex.applyTacticsExUse(s0, { def: kenshi, slot: 0, monId: 'KenshiMocchi', now: T(1, 1), choice: 'sword' });
  check('選べないスタイルでは何も起きない(回数も減らない)', ex.tacticsExUsesOf(bad, 0, 'KenshiMocchi') === 0);
  const cond = ex.normalizeTacticsExDef({ id: 't', name: 't', maxUses: 5, withCards: true, duration: 'wave', conditions: ['notActive', 'nope'] });
  const sc = use(s0, cond, 0, 'X', T(1, 1)).state;
  const cc = ex.checkTacticsExUse({ def: cond, state: sc, slot: 0, monId: 'X', alive: true, now: T(1, 2) });
  check('使用条件(効果中は使えない)を定義から足せる。知らない条件名は無視する', !cc.ok && /効果/.test(cc.reason)
    && cond.conditions.length === 1, cc.reason);
}

// ---------- ⑩ 効果(2026-09-23 β版でお試し公開) ----------
{
  check('3体とも効果が入っている', [monol, golem, kenshi].every(d => ex.isTacticsExEffectImplemented(d)));
  const s0 = ex.createTacticsExState();
  // 捨て身: 仮仕様の例(力220/丈夫さ150 → 力295/丈夫さ0)
  const golemUnit = { id: 'Golem', hp: 600, maxHp: 600, atk: 220, def: 150, guts: 35, maxGuts: 70, downed: false };
  const g = ex.applyTacticsExUse(s0, { def: golem, slot: 0, monId: 'Golem', now: T(2, 3), snapshot: { atk: 220, def: 150 } });
  const gOn = ex.applyTacticsExStats(golemUnit, g, 0, T(2, 7));
  check('捨て身: 力220/丈夫さ150 → 力295/丈夫さ0', gOn.atk === 295 && gOn.def === 0, `${gOn.atk}/${gOn.def}`);
  const gOff = ex.applyTacticsExStats(golemUnit, g, 0, T(3, 1));
  check('捨て身: 次のWAVEでは元の力と丈夫さに戻る(育成結果は盤面に残ったまま)', gOff.atk === 220 && gOff.def === 150
    && golemUnit.atk === 220 && golemUnit.def === 150);
  const again = ex.checkTacticsExUse({ def: golem, state: g, slot: 0, monId: 'Golem', alive: true, now: T(2, 5) });
  check('捨て身: 効果中はもう一度使えない(回数が無駄に減らない)', !again.ok, again.reason);
  const nextWave = ex.checkTacticsExUse({ def: golem, state: g, slot: 0, monId: 'Golem', alive: true, now: T(3, 1) });
  check('捨て身: 次のWAVEではまた使える', nextWave.ok);
  // ソード・コンバージョン(2026-09-25 ユーザー指示)。新しい基礎値 力135/丈夫さ75 で数える
  const mUnit = { id: 'KenshiMocchi', hp: 350, maxHp: 350, atk: 135, def: 75, guts: 10, maxGuts: 20, downed: false };
  const at = (style, from = s0) => ex.applyTacticsExUse(from, { def: kenshi, slot: 1, monId: 'KenshiMocchi', now: T(1, 1), choice: style });
  const sword = ex.applyTacticsExStats(mUnit, s0, 1, T(1, 1));
  check('片手剣(既定): 力135/丈夫さ75 のまま', sword.atk === 135 && sword.def === 75, `${sword.atk}/${sword.def}`);
  const shield = ex.applyTacticsExStats(mUnit, at('shield'), 1, T(4, 9));
  check('片手盾: 力135/丈夫さ75 → 力135/丈夫さ210(WAVEをまたいでも続く)', shield.atk === 135 && shield.def === 210, `${shield.atk}/${shield.def}`);
  const dual = ex.applyTacticsExStats(mUnit, at('dual'), 1, T(4, 9));
  check('二刀流: 力135/丈夫さ75 → 力135/丈夫さ37(半分・切り捨て)', dual.atk === 135 && dual.def === 37, `${dual.atk}/${dual.def}`);
  // ★切り替えても積み重ならない(いつも元のステータスから数え直す)
  const back = ex.applyTacticsExStats(mUnit, at('dual', at('shield')), 1, T(4, 9));
  check('片手盾→二刀流と選び直しても元のステータスから数える(210の半分ではなく75の半分)', back.def === 37, String(back.def));
  check('効いているスタイルが分かる(片手盾・二刀流。片手剣は null)', ex.tacticsExActiveStyle(at('shield'), 1, 'KenshiMocchi', T(2, 2)) === 'shield'
    && ex.tacticsExActiveStyle(at('dual'), 1, 'KenshiMocchi', T(2, 2)) === 'dual'
    && ex.tacticsExActiveStyle(at('sword', at('dual')), 1, 'KenshiMocchi', T(2, 2)) === null);
  // 勇者モンの初期スタイル。回数も「このターン」も数えない
  const init = ex.setTacticsExInitialStyle(s0, { def: kenshi, slot: 2, monId: 'KenshiMocchi', style: 'dual' });
  check('初期スタイル(二刀流)は回数を使わず、カードも止めない', ex.tacticsExStyleOf(kenshi, init, 2, 'KenshiMocchi') === 'dual'
    && ex.tacticsExUsesOf(init, 2, 'KenshiMocchi') === 0 && ex.tacticsExLockedSlots(init, T(1, 1)).length === 0
    && !ex.isTacticsExTurnUsed(init, T(1, 1)));
  check('初期スタイルでもバトル中に選び直せる(元のステータスから)', ex.applyTacticsExStats(mUnit, at('shield', init), 1, T(1, 1)).def === 210
    && ex.tacticsExStyleOf(kenshi, ex.applyTacticsExUse(init, { def: kenshi, slot: 2, monId: 'KenshiMocchi', now: T(1, 1), choice: 'shield' }), 2, 'KenshiMocchi') === 'shield');
  check('初期スタイルが片手剣なら記録を残さない・スタイル式でない子は初期スタイルを持たない',
    Object.keys(ex.setTacticsExInitialStyle(s0, { def: kenshi, slot: 2, monId: 'KenshiMocchi', style: 'sword' }).effects).length === 0
    && Object.keys(ex.setTacticsExInitialStyle(s0, { def: golem, slot: 2, monId: 'Golem', style: 'dual' }).effects).length === 0);
  // 二刀流のヒット列は、メイン・連撃をまとめて2回ぶん(合計ちょうど2倍)
  const baseHits = hitsApi.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'KenshiMocchi' }, attackerId: 'KenshiMocchi', heroId: 'KenshiMocchi' });
  const dualHits = hitsApi.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'KenshiMocchi' }, attackerId: 'KenshiMocchi', heroId: 'KenshiMocchi', hitRepeat: ex.TACTICS_EX_DUAL_HIT_REPEAT });
  const sum = (hs) => hs.reduce((a, h) => a + h.dmg, 0);
  // ★2回ぶん入るのは連撃だけ。メインは1回のまま(2026-09-25 ユーザー指示「二刀流はメインダメじゃなくて、連撃分のみね」)
  const baseCombos = baseHits.filter(h => h.kind === 'combo');
  const mainDmg = baseHits.filter(h => h.kind === 'main').reduce((a, h) => a + h.dmg, 0);
  check('二刀流: 連撃だけが2回ぶん入り、メインは1回のまま(メイン1000＋連撃10%×3＋20%×2 → メイン1000＋連撃×2)',
    dualHits.filter(h => h.kind === 'main').length === 1 && dualHits.length === baseHits.length + baseCombos.length
    && sum(dualHits) === mainDmg + sum(baseCombos) * 2 && dualHits[0].kind === 'main',
    `${baseHits.length}発 ${sum(baseHits)} → ${dualHits.length}発 ${sum(dualHits)}（メイン ${mainDmg}）`);
  // 通常攻撃(勇者特性の二刀流で 50%+50% に分かれる)も、後半の50%は連撃なので2回ぶん。メインの50%は1回
  const atkBase = hitsApi.buildAttackHits({ d: 1001, card: { type: 'atk' }, attackerId: 'KenshiMocchi', heroId: 'KenshiMocchi' });
  const atkDual = hitsApi.buildAttackHits({ d: 1001, card: { type: 'atk' }, attackerId: 'KenshiMocchi', heroId: 'KenshiMocchi', hitRepeat: ex.TACTICS_EX_DUAL_HIT_REPEAT });
  check('二刀流: 通常攻撃は メイン501＋連撃500 → メイン501＋連撃500×2', sum(atkBase) === 1001 && sum(atkDual) === 1501
    && atkDual.filter(h => h.kind === 'main').length === 1, `${sum(atkBase)} → ${sum(atkDual)}`);
  const noSkill = hitsApi.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'KenshiMocchi' }, attackerId: 'KenshiMocchi', heroId: 'KenshiMocchi', swordSkill: false });
  check('片手盾(swordSkill:false)はソードスキルの20%×2が出ない', baseHits.length - noSkill.length === 2, `${baseHits.length}→${noSkill.length}`);
  // みんなをかばう
  const units = [
    { id: 'Mocchi', hp: 100, maxHp: 100, atk: 1, def: 1, guts: 0, maxGuts: 0, downed: false },
    { id: 'Monol', hp: 700, maxHp: 700, atk: 1, def: 1, guts: 0, maxGuts: 0, downed: false },
    { id: 'Ham', hp: 100, maxHp: 100, atk: 1, def: 1, guts: 0, maxGuts: 0, downed: false },
    null,
  ];
  const m = ex.applyTacticsExUse(s0, { def: monol, slot: 1, monId: 'Monol', now: T(1, 2) });
  const cover = ex.tacticsExCoverSlot(m, units, T(1, 2));
  check('かばう: 使ったターンはモノリスの枠がかばう子になる', cover === 1, String(cover));
  check('かばう: 次のターンには切れる', ex.tacticsExCoverSlot(m, units, T(1, 3)) === null);
  check('かばう: 単体攻撃の狙いはモノリスへ移る', JSON.stringify(ex.coverTacticsTargets([0], cover)) === '[1]');
  check('かばう: 全体攻撃は人数ぶんをモノリスが受ける(当たる回数は変えない)', JSON.stringify(ex.coverTacticsTargets([0, 1, 2], cover)) === '[1,1,1]');
  check('かばう: 誰にも当たらない攻撃は当たらないまま', JSON.stringify(ex.coverTacticsTargets([], cover)) === '[]');
  const downUnits = units.map((u, i) => (i === 1 ? { ...u, hp: 0, downed: true } : u));
  check('かばう: モノリスが倒れていたら、かばわない', ex.tacticsExCoverSlot(m, downUnits, T(1, 2)) === null);
  check('効果の無いEXは力・丈夫さを変えない', JSON.stringify(ex.applyTacticsExStats(units[1], m, 1, T(1, 2))) === JSON.stringify(units[1]));
}

// ---------- ⑪ モッチー「ガッツ全開っちー」(2026-09-25 ユーザー指示) ----------
{
  const gm = ex.tacticsExDefOf('Mocchi');
  check('モッチー「ガッツ全開っちー」: ラン3回・カードと併用できる・5ターン・30%・自動回復30%増・全回復', !!gm && gm.name === 'ガッツ全開っちー'
    && gm.maxUses === 3 && !gm.unlimited && gm.withCards && gm.duration === 'turns' && gm.turns === 5
    && gm.statRate === 0.3 && gm.regenRate === 0.3 && gm.fullRecover && ex.isTacticsExEffectImplemented(gm), JSON.stringify(gm));
  check('効果時間の文にターン数と「WAVEが変わると切れる」が入る', /5ターン/.test(ex.tacticsExDurationText(gm)) && /WAVEが変わると切れる/.test(ex.tacticsExDurationText(gm)), ex.tacticsExDurationText(gm));
  const A = (wave, turn) => ({ wave, turn });
  const s0 = ex.createTacticsExState();
  // WAVE2の3ターン目に使う
  const g = ex.applyTacticsExUse(s0, { def: gm, slot: 0, monId: 'Mocchi', now: A(2, 3) });
  const unit = { id: 'Mocchi', hp: 300, maxHp: 600, atk: 120, def: 120, guts: 50, maxGuts: 100, downed: false };
  const on = ex.applyTacticsExStats(unit, g, 0, A(2, 3));
  check('使ったターンから 力120/丈夫さ120 → 156/156(30%アップ)', on.atk === 156 && on.def === 156, `${on.atk}/${on.def}`);
  check('同じWAVEの5ターン目(7ターン目)まで続く', ex.isTacticsExEffectActive(g, 0, 'Mocchi', A(2, 7)));
  check('6ターン目(8ターン目)には切れて元の値に戻る', !ex.isTacticsExEffectActive(g, 0, 'Mocchi', A(2, 8))
    && ex.applyTacticsExStats(unit, g, 0, A(2, 8)).atk === 120);
  // ★WAVEはまたがない(2026-09-25 ユーザー指示「WAVE跨ぎはなし」)
  const late = ex.applyTacticsExUse(s0, { def: gm, slot: 0, monId: 'Mocchi', now: A(2, 18) });
  check('WAVEが変わったら5ターンたつ前でも切れる(WAVE2の18ターン目に使い、WAVE3の1ターン目で切れる)',
    ex.isTacticsExEffectActive(late, 0, 'Mocchi', A(2, 19)) && !ex.isTacticsExEffectActive(late, 0, 'Mocchi', A(3, 1)));
  check('あと何ターンか(使ったターンは5、最後のターンは1、切れたら0)', ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 3)) === 5
    && ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 7)) === 1 && ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 8)) === 0);
  // ★ライフ・ガッツの上限も上げる(2026-09-25 のちに20% → 30%)(2026-09-25 ユーザー指示「ライフとガッツは上限も上げてさらに全回復のイメージだった」)。
  //   上限はみゅあ補正と同じ作り直し(scaleTacticsUnits)で掛けるので、補正で作り直しても消えない
  const base = { id: 'Mocchi', hp: 300, maxHp: 600, baseMaxHp: 600, atk: 120, def: 120, guts: 50, maxGuts: 100, baseMaxGuts: 100, downed: false };
  const up = ex.scaleTacticsUnits(ex.setTacticsExMaxRate([base], 0, 0.3), 0, 0)[0];
  check('上限が30%上がる(ライフ600→780・ガッツ100→130)。いまのライフ・ガッツはそのまま', up.maxHp === 780 && up.maxGuts === 130 && up.hp === 300 && up.guts === 50,
    `${up.hp}/${up.maxHp} ${up.guts}/${up.maxGuts}`);
  const upMua = ex.scaleTacticsUnits(ex.setTacticsExMaxRate([base], 0, 0.3), 0.1, 0)[0];
  check('みゅあ補正(+10%)で作り直しても30%は消えない(600×1.1×1.3＝858)', upMua.maxHp === 858, String(upMua.maxHp));
  const fullUnit = { ...up, hp: 780, guts: 130 };
  const exp = ex.expireTacticsExMaxRates([fullUnit], g, A(2, 8));
  const down = ex.scaleTacticsUnits(exp.units, 0, 0)[0];
  check('切れたら上限を元へ戻し、ライフ・ガッツは新しい上限で丸める(780→600・130→100)', exp.changed && down.maxHp === 600 && down.hp === 600
    && down.maxGuts === 100 && down.guts === 100, `${down.hp}/${down.maxHp} ${down.guts}/${down.maxGuts}`);
  check('効いているあいだは上限を戻さない', !ex.expireTacticsExMaxRates([fullUnit], g, A(2, 7)).changed);
  check('上限を上げていない子(既存の子)は、作り直しても値が変わらない', ex.scaleTacticsUnits([base], 0.1, 0)[0].maxHp === 660);
  check('使ったターンもほかのカードを使える(その子も)', !ex.isTacticsExCardLocked(g, 0, A(2, 3)));
  // ★効いているあいだ、自動回復を30%増やす(2026-09-25 ユーザー指示「効果中ライフとガッツの自動回復を30%上昇」)
  check('効いているあいだは自動回復の上乗せが0.3、切れたら0・ほかの枠は0',
    ex.tacticsExRegenRateAt(g, [unit], 0, A(2, 3)) === 0.3 && ex.tacticsExRegenRateAt(g, [unit], 0, A(2, 7)) === 0.3
    && ex.tacticsExRegenRateAt(g, [unit], 0, A(2, 8)) === 0 && ex.tacticsExRegenRateAt(g, [unit, unit], 1, A(2, 3)) === 0
    && ex.tacticsExRegenRateAt(late, [unit], 0, A(3, 1)) === 0);
  check('ほかの子に入れ替わっていたら上乗せしない', ex.tacticsExRegenRateAt(g, [{ ...unit, id: 'Golem' }], 0, A(2, 3)) === 0);
  check('自動回復は1体ずつ「上限の30%」を固定値で足す(率への倍率ではない・ライフとガッツは別々の率・倒れている子の戻りには乗せない)',
    /const hpBoost = tacticsExRegenRateAt\(tacticsExStateRef\.current, units, slotIdx, live\.now, 'hp'\);[\s\S]{0,160}const gutsBoost = tacticsExRegenRateAt\(tacticsExStateRef\.current, units, slotIdx, live\.now, 'guts'\);[\s\S]{0,160}rateHealTacticsAt\(units, slotIdx, hpBoost \+ partyHpBoost, gutsBoost\)[\s\S]{0,120}const downed = regenDownedTacticsBoard\(units\)/.test(app));
}

// ---------- ⑪-2 ミタラシ「ドラゴンだっちー」(2026-09-27 ユーザー指示) ----------
// ガッツ全開っちーの上がるステが違う版。ユーザーが選んだ「ちから＋ガッツ」:
// ちから・ガッツ上限40% / 丈夫さ・ライフ上限20%、自動回復の上乗せはガッツ40%・ライフ20%。回数・ターン・併用はモッチーと同じ
{
  const dm = ex.tacticsExDefOf('Mitarashi');
  check('ミタラシ「ドラゴンだっちー」: ラン3回・カードと併用できる・5ターン・全回復・効果はガッツ全開っちーと同じ種類', !!dm && dm.name === 'ドラゴンだっちー'
    && dm.maxUses === 3 && !dm.unlimited && dm.withCards && dm.duration === 'turns' && dm.turns === 5 && dm.fullRecover
    && dm.effect === 'statBoost' && ex.isTacticsExEffectImplemented(dm), JSON.stringify(dm));
  check('上げ幅: ちから40%・丈夫さ20%・ライフ上限20%・ガッツ上限40%、回復はライフ20%・ガッツ40%',
    JSON.stringify(dm.rates) === JSON.stringify({ atk: 0.4, def: 0.2, hp: 0.2, guts: 0.4 })
    && JSON.stringify(dm.regenRates) === JSON.stringify({ hp: 0.2, guts: 0.4 }), JSON.stringify([dm.rates, dm.regenRates]));
  const gm = ex.tacticsExDefOf('Mocchi');
  check('ガッツ全開っちーは rates を書かなくても4つとも30%・回復も30%ずつ(今までどおり)',
    JSON.stringify(gm.rates) === JSON.stringify({ atk: 0.3, def: 0.3, hp: 0.3, guts: 0.3 })
    && JSON.stringify(gm.regenRates) === JSON.stringify({ hp: 0.3, guts: 0.3 }), JSON.stringify([gm.rates, gm.regenRates]));
  const A = (wave, turn) => ({ wave, turn });
  const s0 = ex.createTacticsExState();
  const d = ex.applyTacticsExUse(s0, { def: dm, slot: 1, monId: 'Mitarashi', now: A(1, 2) });
  const unit = { id: 'Mitarashi', hp: 300, maxHp: 680, atk: 150, def: 115, guts: 50, maxGuts: 120, downed: false };
  const on = ex.applyTacticsExStats(unit, d, 1, A(1, 2));
  check('力150/丈夫さ115 → 210/138(40%・20%アップ)', on.atk === 210 && on.def === 138, `${on.atk}/${on.def}`);
  check('6ターン目には切れて元の値に戻る', ex.applyTacticsExStats(unit, d, 1, A(1, 7)).atk === 150);
  const base = { id: 'Mitarashi', hp: 300, maxHp: 680, baseMaxHp: 680, atk: 150, def: 115, guts: 50, maxGuts: 120, baseMaxGuts: 120, downed: false };
  const up = ex.scaleTacticsUnits(ex.setTacticsExMaxRate([null, base], 1, dm.rates.hp, dm.rates.guts), 0, 0)[1];
  check('上限はライフ20%・ガッツ40%(680→816・120→168)', up.maxHp === 816 && up.maxGuts === 168, `${up.maxHp}/${up.maxGuts}`);
  const upMua = ex.scaleTacticsUnits(ex.setTacticsExMaxRate([null, base], 1, dm.rates.hp, dm.rates.guts), 0.1, 0.1)[1];
  check('みゅあ補正(+10%)で作り直しても消えない(680×1.1×1.2＝897・120×1.1×1.4＝184)', upMua.maxHp === 897 && upMua.maxGuts === 184, `${upMua.maxHp}/${upMua.maxGuts}`);
  const exp = ex.expireTacticsExMaxRates([null, { ...up, hp: 816, guts: 168 }], d, A(1, 7));
  const down = ex.scaleTacticsUnits(exp.units, 0, 0)[1];
  check('切れたらライフ・ガッツとも上限が元へ戻る', exp.changed && down.maxHp === 680 && down.maxGuts === 120 && down.hp === 680 && down.guts === 120,
    `${down.hp}/${down.maxHp} ${down.guts}/${down.maxGuts}`);
  check('自動回復の上乗せはライフ0.2・ガッツ0.4、切れたら0',
    ex.tacticsExRegenRateAt(d, [null, unit], 1, A(1, 2), 'hp') === 0.2 && ex.tacticsExRegenRateAt(d, [null, unit], 1, A(1, 2), 'guts') === 0.4
    && ex.tacticsExRegenRateAt(d, [null, unit], 1, A(1, 7), 'guts') === 0);
  const g = ex.applyTacticsExUse(s0, { def: gm, slot: 0, monId: 'Mocchi', now: A(1, 2) });
  const mUnit = { id: 'Mocchi', hp: 1, maxHp: 720, atk: 140, def: 140, guts: 1, maxGuts: 140, downed: false };
  check('ガッツ全開っちーの自動回復はライフ・ガッツとも0.3のまま', ex.tacticsExRegenRateAt(g, [mUnit], 0, A(1, 2), 'hp') === 0.3
    && ex.tacticsExRegenRateAt(g, [mUnit], 0, A(1, 2), 'guts') === 0.3);
  const legacyUnit = { id: 'Mocchi', hp: 1, maxHp: 600, baseMaxHp: 600, atk: 1, def: 1, guts: 1, maxGuts: 100, baseMaxGuts: 100, exMaxRate: 0.3, downed: false };
  check('ガッツの率を持っていない子は、ライフと同じ率でガッツの上限を上げる', ex.scaleTacticsUnits([legacyUnit], 0, 0)[0].maxGuts === 130);
}

// ---------- ⑪-3 ユグドラシル「世界樹の守り」・メルホイップ「スイーツパラダイス」(2026-09-29 ユーザー指示) ----------
// 世界樹の守り: 3ターンのあいだ味方全員の被ダメ30%軽減＋ターン終わりに味方全員のライフを上限の20%回復、1ラン5回。
// スイーツパラダイス: 発動したターンだけ、その子の攻撃へ与ダメ30%の連撃×4、1ラン3回。どちらもカードと併用できる
{
  const A = (wave, turn) => ({ wave, turn });
  const yg = ex.tacticsExDefOf('Yggdrasil');
  check('ユグドラシル「世界樹の守り」: ラン5回・併用できる・3ターン・効果は partyGuard(実装済み)', !!yg && yg.name === '世界樹の守り'
    && yg.maxUses === 5 && !yg.unlimited && yg.withCards && yg.duration === 'turns' && yg.turns === 3
    && yg.partyTakenRate === 0.3 && yg.partyRegenRate === 0.2 && yg.effect === 'partyGuard' && ex.isTacticsExEffectImplemented(yg), JSON.stringify(yg));
  const ygUnit = { id: 'Yggdrasil', hp: 500, maxHp: 1000 }, other = { id: 'Mocchi', hp: 300, maxHp: 600 };
  const g = ex.applyTacticsExUse(ex.createTacticsExState(), { def: yg, slot: 0, monId: 'Yggdrasil', now: A(2, 3) });
  const units = [ygUnit, other];
  check('世界樹の守り: 使ったターンから3ターン(3〜5ターン目)、味方全員の被ダメ倍率0.7。6ターン目・次のWAVEでは1',
    ex.tacticsExPartyTakenMult(g, units, A(2, 3)) === 0.7 && ex.tacticsExPartyTakenMult(g, units, A(2, 5)) === 0.7
    && ex.tacticsExPartyTakenMult(g, units, A(2, 6)) === 1 && ex.tacticsExPartyTakenMult(g, units, A(3, 1)) === 1
    && ex.tacticsExPartyTakenMult(g, units, A(2, 2)) === 1);
  check('世界樹の守り: 効いているあいだ、ターン終わりのライフ回復へ味方全員0.2を足す(ガッツには足さない)',
    ex.tacticsExPartyRegenRate(g, units, A(2, 4)) === 0.2 && ex.tacticsExPartyRegenRate(g, units, A(2, 6)) === 0
    && ex.tacticsExRegenRateAt(g, units, 0, A(2, 4), 'guts') === 0);
  check('世界樹の守り: 2体が同時に効いていれば掛け算で重なる(0.7×0.7)',
    Math.abs(ex.tacticsExPartyTakenMult(ex.applyTacticsExUse(g, { def: yg, slot: 1, monId: 'Yggdrasil', now: A(2, 3) }), [ygUnit, ygUnit], A(2, 3)) - 0.49) < 1e-9);
  check('世界樹の守り: 枠の子が入れ替わっていたら効かない', ex.tacticsExPartyTakenMult(g, [other, other], A(2, 3)) === 1);
  check('世界樹の守り: 使ったターンもその子を含め全員がカードを使える', !ex.isTacticsExCardLocked(g, 0, A(2, 3)));

  const mw = ex.tacticsExDefOf('MelWhip');
  check('メルホイップ「スイーツパラダイス」: ラン3回・併用できる・発動ターンだけ・効果は comboBurst(実装済み)', !!mw && mw.name === 'スイーツパラダイス'
    && mw.maxUses === 3 && !mw.unlimited && mw.withCards && mw.duration === 'turn'
    && JSON.stringify(mw.extraCombos) === JSON.stringify({ count: 4, rate: 0.3 }) && mw.effect === 'comboBurst' && ex.isTacticsExEffectImplemented(mw), JSON.stringify(mw));
  const melUnit = { id: 'MelWhip', hp: 500, maxHp: 1000 };
  const m = ex.applyTacticsExUse(ex.createTacticsExState(), { def: mw, slot: 1, monId: 'MelWhip', now: A(1, 2) });
  check('スイーツパラダイス: 発動したターンだけ、使った子の枠に{4回, 30%}。次のターン・ほかの枠は null',
    JSON.stringify(ex.tacticsExExtraCombosAt(m, [other, melUnit], 1, A(1, 2))) === JSON.stringify({ count: 4, rate: 0.3 })
    && ex.tacticsExExtraCombosAt(m, [other, melUnit], 1, A(1, 3)) === null
    && ex.tacticsExExtraCombosAt(m, [other, melUnit], 0, A(1, 2)) === null);
  const card = { type: 'atk', monId: 'MelWhip' };
  const plain = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'MelWhip', heroId: 'Mocchi' });
  const burst = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'MelWhip', heroId: 'Mocchi', exCombos: { count: 4, rate: 0.3 } });
  const extra = burst.slice(plain.length);
  check('スイーツパラダイス: ヒット列に与ダメ30%(300)の連撃が4本だけ足される(メインは変わらない)',
    extra.length === 4 && extra.every(h => h.kind === 'combo' && h.dmg === 300 && h.skillName === 'スイーツパラダイス') && burst[0].dmg === plain[0].dmg,
    JSON.stringify(extra));
  check('本体: 被ダメ軽減・自動回復・ヒット列(3か所)へ結線してある',
    /\*\(isTacticsMode\(runMode\)\?tacticsExPartyTakenMultNow\(\)\*tacticsExMultiBuffNow\(slotIdx\)\.taken\*tacticsExPartyBuffNow\(\)\.taken:1\)/.test(app)
    && /const partyHpBoost = live\.enabled \? tacticsExPartyRegenRate\(tacticsExStateRef\.current, units, live\.now\) : 0;/.test(app)
    && (app.match(/exCombos:tacticsExCombosAt\(slotIdx(,halved|,true)?\)/g) || []).length === 3);
}

// ---------- ⑫ エイキ「緋桜瞬歩」(2026-10-02 ユーザー指示) ----------
{
  const ek = ex.tacticsExDefOf('Eiki');
  check('エイキ「緋桜瞬歩」: ラン3回・カードと併用できない・3ターン・距離一致', !!ek && ek.name === '緋桜瞬歩'
    && ek.maxUses === 3 && !ek.unlimited && !ek.withCards && ek.duration === 'turns' && ek.turns === 3
    && ek.effect === 'distMatch' && ex.isTacticsExEffectImplemented(ek), JSON.stringify(ek));
  const A = (wave, turn) => ({ wave, turn });
  const e = ex.applyTacticsExUse(ex.createTacticsExState(), { def: ek, slot: 2, monId: 'Eiki', now: A(1, 4) });
  check('使ったターンから3ターン(4〜6ターン目)だけ distMatch が効き、7ターン目には切れる',
    ex.tacticsExActiveEffect(e, 2, 'Eiki', A(1, 4)) === 'distMatch' && ex.tacticsExActiveEffect(e, 2, 'Eiki', A(1, 6)) === 'distMatch'
    && ex.tacticsExActiveEffect(e, 2, 'Eiki', A(1, 7)) === null);
  check('使ったターンは、エイキだけがカードを使えない(ほかの枠は使える)', ex.isTacticsExCardLocked(e, 2, A(1, 4)) && !ex.isTacticsExCardLocked(e, 1, A(1, 4)));
  check('WAVEが変わったら切れる・ほかの子には効かない', ex.tacticsExActiveEffect(e, 2, 'Eiki', A(2, 4)) === null
    && ex.tacticsExActiveEffect(e, 2, 'Golem', A(1, 4)) === null && ex.tacticsExActiveEffect(e, 1, 'Eiki', A(1, 4)) === null);
  check('距離補正の定数は ×1.7', ex.TACTICS_EX_DIST_MATCH_MULT === 1.7);
  check('getDmg の距離補正は、distMatch が効いているあいだだけ距離の差に関係なく ×1.7',
    /const distMult = tacticsExEffectAt\(slotIdx\)==='distMatch' \? TACTICS_EX_DIST_MATCH_MULT : \(exDistMult>0 \? exDistMult : \(\[1\.5,1\.3,1\.1,0\.9\]\[distDiff\]\|\|1\.0\)\);/.test(app));
  check('敵と同じ距離の枠にいるときだけ完全に回避する(ほかの距離・ほかの効果・距離が不明なら回避しない)',
    ex.tacticsExDistMatchDodges('distMatch', 2, 2) && !ex.tacticsExDistMatchDodges('distMatch', 2, 1)
    && !ex.tacticsExDistMatchDodges('statBoost', 2, 2) && !ex.tacticsExDistMatchDodges(null, 2, 2)
    && !ex.tacticsExDistMatchDodges('distMatch', 2, undefined) && !ex.tacticsExDistMatchDodges('distMatch', null, 2));
  check('敵の攻撃の当たり先ごとの判定に、その子の距離と敵の距離を渡している',
    /tacticsExDistMatchDodges\(tacticsExEffectAt\(slotIdx\),slotIdx,actingEnemyDist\);[\s\S]{0,520}if\(slotIdx===evadedSlot\|\|exDodge(\|\|thunderDodge)?\)\{ evadedName=/.test(app));
}

// ---------- ⑬ ザン「血踊」(2026-10-02 ユーザー指示) ----------
{
  const zn = ex.tacticsExDefOf('Zan');
  check('ザン「血踊」: ラン5回・カードと併用できる・3ターン・回避1回で連撃10%', !!zn && zn.name === '血踊'
    && zn.maxUses === 5 && !zn.unlimited && zn.withCards && zn.duration === 'turns' && zn.turns === 3
    && zn.effect === 'dodgeCombo' && zn.dodgeComboRate === 0.1 && ex.isTacticsExEffectImplemented(zn), JSON.stringify(zn));
  const A = (wave, turn) => ({ wave, turn });
  const units = [null, { id: 'Zan' }, { id: 'Eiki' }];
  let z = ex.applyTacticsExUse(ex.createTacticsExState(), { def: zn, slot: 1, monId: 'Zan', now: A(1, 2) });
  check('使った直後は連撃が増えていない(回避0回)', ex.tacticsExExtraCombosAt(z, units, 1, A(1, 2)) === null);
  check('敵と同じ距離の枠にいるときだけ完全に回避する(エイキと同じ判定)', ex.tacticsExDistMatchDodges(ex.tacticsExActiveEffect(z, 1, 'Zan', A(1, 2)), 1, 1)
    && !ex.tacticsExDistMatchDodges(ex.tacticsExActiveEffect(z, 1, 'Zan', A(1, 2)), 1, 2));
  z = ex.recordTacticsExDodge(z, units, 1, A(1, 3));
  const c1 = ex.tacticsExExtraCombosAt(z, units, 1, A(1, 3));
  check('1回回避すると、与ダメ10%の連撃が1回', !!c1 && c1.count === 1 && Math.abs(c1.rate - 0.1) < 1e-9 && c1.label === '血踊', JSON.stringify(c1));
  z = ex.recordTacticsExDodge(ex.recordTacticsExDodge(z, units, 1, A(1, 4)), units, 1, A(1, 4));
  const c3 = ex.tacticsExExtraCombosAt(z, units, 1, A(1, 4));
  check('回避するごとに連撃が1回ずつ増えていく(3回回避 → 10%の連撃が3回)', !!c3 && c3.count === 3 && Math.abs(c3.rate - 0.1) < 1e-9, JSON.stringify(c3));
  check('3ターン目(4ターン目)まで続き、切れたら連撃も消える', ex.tacticsExExtraCombosAt(z, units, 1, A(1, 4)).count === 3 && ex.tacticsExExtraCombosAt(z, units, 1, A(1, 5)) === null);
  check('WAVEが変わったら切れる', ex.tacticsExExtraCombosAt(z, units, 1, A(2, 3)) === null);
  const same = ex.recordTacticsExDodge(ex.createTacticsExState(), units, 1, A(1, 3));
  check('効いていない子の回避は数えない(使っていない・別の効果・別の子)', ex.tacticsExExtraCombosAt(same, units, 1, A(1, 3)) === null
    && ex.tacticsExExtraCombosAt(ex.recordTacticsExDodge(ex.applyTacticsExUse(ex.createTacticsExState(), { def: ex.tacticsExDefOf('Eiki'), slot: 2, monId: 'Eiki', now: A(1, 2) }), units, 2, A(1, 3)), units, 2, A(1, 3)) === null);
  const again = ex.applyTacticsExUse(z, { def: zn, slot: 1, monId: 'Zan', now: A(1, 8) });
  check('もう一度使うと、回避の数は0からやり直し', ex.tacticsExExtraCombosAt(again, units, 1, A(1, 8)) === null);
  const card = { type: 'unique', monId: 'Zan' };
  const hits = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Zan', heroId: 'Mocchi', exCombos: c3 });
  const base = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Zan', heroId: 'Mocchi' });
  check('ヒット列に与ダメ10%(100)の連撃が回避した数だけ足される', hits.length - base.length === 3 && hits.slice(base.length).every(h => h.dmg === 100) , `${base.length}→${hits.length}`);
  check('本体: 回避したら数える(結線)・連撃の名前を渡す', /const exDodge=tacticsExDistMatchDodges\(tacticsExEffectAt\(slotIdx\),slotIdx,actingEnemyDist\);[\s\S]{0,260}recordTacticsExDodge\(tacticsExStateRef\.current,tacticsUnitsRef\.current,slotIdx,tacticsExLiveRef\.current\.now\)[\s\S]{0,200}if\(slotIdx===evadedSlot\|\|exDodge(\|\|thunderDodge)?\)/.test(app)
    && readPart('22-enemy-and-bond-entries.jsx').includes("ec.label || 'スイーツパラダイス'"));
}

// ---------- ⑭ アーク「抗えぬ宿命を追え」・イブリース「堕天の烙印」(2026-10-02 ユーザー指示) ----------
{
  const ak = ex.tacticsExDefOf('Ark'), ib = ex.tacticsExDefOf('Iblis');
  check('アーク「抗えぬ宿命を追え」: ラン5回・5ターン・併用できる・与ダメ+30%・被ダメ-20%・連撃10%×1', !!ak && ak.name === '抗えぬ宿命を追え'
    && ak.maxUses === 5 && !ak.unlimited && ak.withCards && ak.duration === 'turns' && ak.turns === 5 && ak.effect === 'multiBuff'
    && ak.dmgRate === 0.3 && ak.selfTakenRate === 0.2 && ak.extraCombos && ak.extraCombos.count === 1 && ak.extraCombos.rate === 0.1
    && ex.isTacticsExEffectImplemented(ak), JSON.stringify(ak));
  check('イブリース「堕天の烙印」: ラン5回・5ターン・併用できる・5%連撃×5・会心率×1.5・会心ダメ×1.3・丈夫さ+30%', !!ib && ib.name === '堕天の烙印'
    && ib.maxUses === 5 && !ib.unlimited && ib.withCards && ib.duration === 'turns' && ib.turns === 5 && ib.effect === 'multiBuff'
    && ib.extraCombos && ib.extraCombos.count === 5 && ib.extraCombos.rate === 0.05 && ib.critRateRate === 0.5 && ib.critDmgRate === 0.3
    && ib.rates && ib.rates.def === 0.3 && ex.isTacticsExEffectImplemented(ib), JSON.stringify(ib));
  check('イブリースは使うとき最大ライフの30%を払う(ほかのEXは払わない)', ib.lifeCostRate === 0.3 && ex.tacticsExLifeCost(ib, 360) === 108 && ex.tacticsExLifeCost(ak, 440) === 0
    && ex.tacticsExLifeCost(ib, 0) === 0 && /最大ライフの30%/.test(ib.desc) && /30%より多い/.test(ib.conditionText || ''));
  {
    const base = { def: ib, state: ex.createTacticsExState(), slot: 1, monId: 'Iblis', alive: true, now: { wave: 1, turn: 1 } };
    const full = ex.checkTacticsExUse({ ...base, hp: 360, maxHp: 360 });
    const just = ex.checkTacticsExUse({ ...base, hp: 109, maxHp: 360 });
    const edge = ex.checkTacticsExUse({ ...base, hp: 108, maxHp: 360 });
    const low = ex.checkTacticsExUse({ ...base, hp: 50, maxHp: 360 });
    check('ライフが払う量(108)より多いときだけ使える(払って倒れない)', full.ok && just.ok && !edge.ok && !low.ok && /ライフが足りない/.test(edge.reason || ''), JSON.stringify([full.ok, just.ok, edge.ok, low.ok]));
    check('ライフを渡さなければ見ない・払わないEXはライフが少なくても使える', ex.checkTacticsExUse(base).ok
      && ex.checkTacticsExUse({ def: ak, state: ex.createTacticsExState(), slot: 0, monId: 'Ark', alive: true, now: { wave: 1, turn: 1 }, hp: 1, maxHp: 440 }).ok);
    check('本体: 判定にライフを渡し、使うときに払って枠へ出す', (app.match(/hp:lifeUnit\?lifeUnit\.hp:null, maxHp:lifeUnit\?lifeUnit\.maxHp:null/g) || []).length === 1
      && /hp:lifeNow\?lifeNow\.hp:null, maxHp:lifeNow\?lifeNow\.maxHp:null/.test(app)
      && /commitTacticsUnits\(damageTacticsTargets\(tacticsUnitsRef\.current,\[slotIdx\],cost\)\);/.test(app));
  }
  const A = (wave, turn) => ({ wave, turn });
  const units = [{ id: 'Ark', atk: 130, def: 90 }, { id: 'Iblis', atk: 145, def: 100 }];
  const s = ex.applyTacticsExUse(ex.applyTacticsExUse(ex.createTacticsExState(), { def: ak, slot: 0, monId: 'Ark', now: A(1, 2) }), { def: ib, slot: 1, monId: 'Iblis', now: A(1, 2) });
  const mA = ex.tacticsExMultiBuffOf(s, units, 0, A(1, 2)), mI = ex.tacticsExMultiBuffOf(s, units, 1, A(1, 2));
  check('アーク: 与ダメ×1.3・被ダメ×0.8(会心は変わらない)', !!mA && Math.abs(mA.dmg - 1.3) < 1e-9 && Math.abs(mA.taken - 0.8) < 1e-9 && mA.critRate === 1 && mA.critDmg === 1, JSON.stringify(mA));
  check('イブリース: 会心率×1.5・会心ダメ×1.3(与ダメ・被ダメは変わらない)', !!mI && mI.dmg === 1 && mI.taken === 1 && Math.abs(mI.critRate - 1.5) < 1e-9 && Math.abs(mI.critDmg - 1.3) < 1e-9, JSON.stringify(mI));
  check('5ターン(2〜6ターン目)だけ効き、7ターン目には切れる・WAVEが変わったら切れる・ほかの子には効かない',
    !!ex.tacticsExMultiBuffOf(s, units, 0, A(1, 6)) && ex.tacticsExMultiBuffOf(s, units, 0, A(1, 7)) === null
    && ex.tacticsExMultiBuffOf(s, units, 0, A(2, 2)) === null && ex.tacticsExMultiBuffOf(s, [{ id: 'Golem' }, units[1]], 0, A(1, 2)) === null
    && ex.tacticsExMultiBuffOf(ex.createTacticsExState(), units, 0, A(1, 2)) === null);
  check('イブリースの丈夫さ+30%(アークは力も丈夫さも変わらない)', ex.applyTacticsExStats(units[1], s, 1, A(1, 2)).def === 130 && ex.applyTacticsExStats(units[1], s, 1, A(1, 2)).atk === 145
    && ex.applyTacticsExStats(units[0], s, 0, A(1, 2)).atk === 130 && ex.applyTacticsExStats(units[0], s, 0, A(1, 2)).def === 90);
  const cA = ex.tacticsExExtraCombosAt(s, units, 0, A(1, 2)), cI = ex.tacticsExExtraCombosAt(s, units, 1, A(1, 2));
  check('連撃: アークは10%を1回、イブリースは5%を5回(名前はそのEXの名前)', !!cA && cA.count === 1 && cA.rate === 0.1 && cA.label === '抗えぬ宿命を追え'
    && !!cI && cI.count === 5 && cI.rate === 0.05 && cI.label === '堕天の烙印', JSON.stringify([cA, cI]));
  const card = { type: 'unique', monId: 'Iblis' };
  const plain = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Iblis', heroId: 'Mocchi', guaranteedCrit: true });
  const crit = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Iblis', heroId: 'Mocchi', guaranteedCrit: true, critDmgMult: 1.3 });
  check('会心ダメージは(1.5+補正)にかける乗算(1.5 → 1.95)', plain[0].crit && crit[0].crit && crit[0].dmg === Math.floor(plain[0].dmg * 1.3), `${plain[0].dmg}→${crit[0].dmg}`);
  const withCombos = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Iblis', heroId: 'Mocchi', exCombos: cI });
  const noCombos = hitsApi.buildAttackHits({ d: 1000, card, attackerId: 'Iblis', heroId: 'Mocchi' });
  check('ヒット列に与ダメ5%(50)の連撃が5本だけ足される', withCombos.length - noCombos.length === 5 && withCombos.slice(noCombos.length).every(h => h.dmg === 50 && h.skillName === '堕天の烙印'), `${noCombos.length}→${withCombos.length}`);
  check('本体: 与ダメ(getDmg)・会心率・会心ダメ(3か所)・被ダメ(applyTurnDamageReduction)へ結線してある',
    /const totalBuffMult=traitMult\*tacticsExMultiBuffNow\(slotIdx\)\.dmg\*/.test(app)
    && /Math\.random\(\)<Math\.min\(1,\(\(card\.crit\|\|0\.1\)\+critRateBonus(\+\(tacticsExMultiBuffNow\(slotIdx\)\.critAdd\|\|0\))?\)\*tacticsExMultiBuffNow\(slotIdx\)\.critRate\)/.test(app)
    && (app.match(/critDmgMult:tacticsExMultiBuffNow\(slotIdx\)\.critDmg/g) || []).length === 3);
}

// ---------- ⑮ ピクシー・ミーア・スネグーラチカ(2026-10-03 ユーザーの案・数字は仮) ----------
{
  const px = ex.tacticsExDefOf('Pixie'), mi = ex.tacticsExDefOf('Mia'), sn = ex.tacticsExDefOf('Snegurochka');
  check('ピクシー「お気に入りの魔法」: 3回・併用できる・3ターン・距離補正×1.5・固有技が必ず出る', !!px && px.name === 'お気に入りの魔法' && px.maxUses === 3 && px.withCards
    && px.duration === 'turns' && px.turns === 3 && px.distMult === 1.5 && px.guaranteeUnique && px.effect === 'multiBuff' && ex.isTacticsExEffectImplemented(px), JSON.stringify(px));
  check('ミーア「オン・ステージ！」: 3回・併用できる・4ターン・枚数+1・ボルテージ(最大10・与ダメ3%・回復5%・ガッツ2%)', !!mi && mi.name === 'オン・ステージ！' && mi.maxUses === 3 && mi.withCards
    && mi.turns === 4 && mi.cardBonus === 1 && mi.voltage && mi.voltage.max === 10 && mi.voltage.dmg === 0.03 && mi.voltage.heal === 0.05 && mi.voltage.guts === 0.02 && mi.voltage.hp === 0.03
    && mi.effect === 'stage' && ex.isTacticsExEffectImplemented(mi), JSON.stringify(mi));
  check('スネグーラチカ「クリスマスプレゼント」: 各WAVE1回・併用できる・2ターン・ガッツ20%・大当たり10%', !!sn && sn.name === 'クリスマスプレゼント' && sn.maxUses === 1 && sn.usesPerWave && sn.withCards
    && sn.turns === 2 && sn.present && sn.present.fixedGuts === 0.2 && sn.present.jackpot === 0.1 && sn.present.combo.count === 2 && sn.effect === 'present' && ex.isTacticsExEffectImplemented(sn), JSON.stringify(sn));
  const A = (wave, turn) => ({ wave, turn });
  const units = [{ id: 'Pixie' }, { id: 'Mia' }, { id: 'Snegurochka' }, { id: 'Golem' }];
  const use = (state, def, slot, id, now) => ex.applyTacticsExUse(state, { def, slot, monId: id, now });
  // --- ピクシー ---
  const sp = use(ex.createTacticsExState(), px, 0, 'Pixie', A(1, 2));
  const mbP = ex.tacticsExMultiBuffOf(sp, units, 0, A(1, 2));
  check('ピクシー: 効いているあいだ距離補正が×1.5(与ダメ・被ダメ・会心は変わらない)・3ターンで切れる', !!mbP && mbP.distMult === 1.5 && mbP.dmg === 1 && mbP.taken === 1
    && !!ex.tacticsExMultiBuffOf(sp, units, 0, A(1, 4)) && ex.tacticsExMultiBuffOf(sp, units, 0, A(1, 5)) === null && ex.tacticsExMultiBuffOf(sp, units, 0, A(2, 2)) === null);
  check('ピクシー: 固有技を出す子の枠は、効いているあいだだけ(次のターンまで見られる)', ex.tacticsExUniqueGuaranteeSlot(sp, units, A(1, 4)) === 0 && ex.tacticsExUniqueGuaranteeSlot(sp, units, A(1, 5)) === null
    && ex.tacticsExUniqueGuaranteeSlot(ex.createTacticsExState(), units, A(1, 2)) === null
    && ex.tacticsExUniqueGuaranteeSlot(use(ex.createTacticsExState(), ex.tacticsExDefOf('Eiki'), 2, 'Eiki', A(1, 2)), [{}, {}, { id: 'Eiki' }], A(1, 2)) === null);
  {
    const isFav = (c) => c.type === 'unique' && c.monId === 'Pixie' && c.ownerSlotIdx === 0;
    const fav = { uid: 'fav', type: 'unique', monId: 'Pixie', ownerSlotIdx: 0 }, other = { uid: 'o', type: 'unique', monId: 'Pixie', ownerSlotIdx: 1 };
    const c = (n) => ({ uid: 'c' + n, type: 'atk' });
    const inHand = ex.ensureTacticsExUniqueInHand({ hand: [c(1), fav], deck: [c(2)], graveyard: [] }, isFav);
    check('手札に固有技がすでにあれば何も動かさない', !inHand.moved && inHand.hand.length === 2);
    const fromDeck = ex.ensureTacticsExUniqueInHand({ hand: [c(1), c(2)], deck: [c(3), fav], graveyard: [] }, isFav);
    check('山札にあれば手札へ移す(手札に空きがあるとき)', fromDeck.moved && fromDeck.hand.length === 3 && fromDeck.hand.includes(fav) && !fromDeck.deck.includes(fav));
    const fromGrave = ex.ensureTacticsExUniqueInHand({ hand: [c(1)], deck: [c(2)], graveyard: [fav] }, isFav);
    check('山札になければ捨て札から探して手札へ移す', fromGrave.moved && fromGrave.hand.includes(fav) && fromGrave.graveyard.length === 0);
    const full = ex.ensureTacticsExUniqueInHand({ hand: [c(1), c(2), c(3), c(4), c(5)], deck: [fav], graveyard: [] }, isFav);
    check('手札がいっぱい(5枚)なら、いちばん後ろの別のカードを山札へ戻して入れ替える(枚数は5のまま・カードは消えない)',
      full.moved && full.hand.length === 5 && full.hand[4] === fav && full.deck.length === 1 && full.deck[0].uid === 'c5');
    const none = ex.ensureTacticsExUniqueInHand({ hand: [c(1)], deck: [c(2), other], graveyard: [] }, isFav);
    check('見つからなければそのまま(別の子の固有技は出さない)', !none.moved && none.hand.length === 1 && none.deck.length === 2);
    const input = { hand: [c(1)], deck: [fav], graveyard: [] };
    ex.ensureTacticsExUniqueInHand(input, isFav);
    check('渡した配列は書き換えない', input.hand.length === 1 && input.deck.length === 1);
  }
  // --- ミーア ---
  let sm = use(ex.createTacticsExState(), mi, 1, 'Mia', A(1, 3));
  check('ミーア: 効いているあいだ、盤面の枚数+1・ミーア自身+1(ほかの子の自身は+0)。4ターン(3〜6)で切れる',
    ex.tacticsExCardBonusTotal(sm, units, A(1, 3)) === 1 && ex.tacticsExCardBonusAt(sm, units, 1, A(1, 3)) === 1 && ex.tacticsExCardBonusAt(sm, units, 0, A(1, 3)) === 0
    && ex.tacticsExCardBonusTotal(sm, units, A(1, 6)) === 1 && ex.tacticsExCardBonusTotal(sm, units, A(1, 7)) === 0 && ex.tacticsExCardBonusTotal(sm, units, A(2, 3)) === 0
    && ex.tacticsExCardBonusTotal(ex.createTacticsExState(), units, A(1, 3)) === 0);
  const v0 = ex.tacticsExVoltageOf(sm, units, A(1, 3));
  check('ミーア: はじめのボルテージは0(強化なし)', !!v0 && v0.voltage === 0 && v0.max === 10 && v0.dmgMult === 1 && v0.healMult === 1 && v0.gutsAdd === 0 && v0.hpAdd === 0, JSON.stringify(v0));
  sm = ex.addTacticsExVoltage(sm, units, A(1, 3), 5);
  const v5 = ex.tacticsExVoltageOf(sm, units, A(1, 4));
  check('ミーア: カード5枚でボルテージ5 → 与ダメ×1.15・回復×1.25・ガッツ自動回復+10%・ライフ自動回復+15%', !!v5 && v5.voltage === 5 && Math.abs(v5.dmgMult - 1.15) < 1e-9 && Math.abs(v5.healMult - 1.25) < 1e-9 && Math.abs(v5.gutsAdd - 0.1) < 1e-9 && Math.abs(v5.hpAdd - 0.15) < 1e-9, JSON.stringify(v5));
  sm = ex.addTacticsExVoltage(sm, units, A(1, 4), 30);
  check('ミーア: ボルテージは最大10で止まる(与ダメ×1.30・回復×1.50・ガッツ+20%)', ex.tacticsExVoltageOf(sm, units, A(1, 5)).voltage === 10 && Math.abs(ex.tacticsExVoltageOf(sm, units, A(1, 5)).dmgMult - 1.3) < 1e-9
    && Math.abs(ex.tacticsExVoltageOf(sm, units, A(1, 5)).healMult - 1.5) < 1e-9);
  check('ミーア: 効果が切れたらボルテージは消える・もう一度使うと0から・効いていないときは何もたまらない',
    ex.tacticsExVoltageOf(sm, units, A(1, 7)) === null && ex.tacticsExVoltageOf(use(sm, mi, 1, 'Mia', A(1, 8)), units, A(1, 8)).voltage === 0
    && ex.tacticsExVoltageOf(ex.addTacticsExVoltage(ex.createTacticsExState(), units, A(1, 3), 3), units, A(1, 3)) === null
    && ex.tacticsExVoltageOf(ex.addTacticsExVoltage(sm, units, A(1, 7), 3), units, A(1, 7)) === null);
  // --- スネグーラチカ ---
  let ss = use(ex.createTacticsExState(), sn, 2, 'Snegurochka', A(1, 2));
  check('スネグーラチカ: 使うと回数が0 / 1。WAVEのはじめに戻る(1 / 1)・ほかのEXの回数は戻さない',
    ex.tacticsExRemaining(sn, ex.tacticsExUsesOf(ss, 2, 'Snegurochka')).left === 0
    && ex.tacticsExRemaining(sn, ex.tacticsExUsesOf(ex.resetTacticsExWaveUses(ss), 2, 'Snegurochka')).left === 1
    && ex.tacticsExUsesOf(ex.resetTacticsExWaveUses(use(ss, ex.tacticsExDefOf('Monol'), 3, 'Monol', A(1, 3))), 3, 'Monol') === 1);
  check('回数を戻す必要がなければ、同じ state をそのまま返す', ex.resetTacticsExWaveUses(ex.createTacticsExState()) === ex.createTacticsExState() || (() => { const st = ex.createTacticsExState(); return ex.resetTacticsExWaveUses(st) === st; })());
  const kinds = ex.TACTICS_EX_PRESENT_KINDS;
  check('プレゼント: 6種(与ダメ・被ダメ・連撃・ライフ・ガッツ・会心率)', kinds.length === 6 && ['dmg', 'taken', 'combo', 'heal', 'guts', 'crit'].every(k => kinds.includes(k)));
  const jp = ex.rollTacticsExPresent(0.05, 0.5, 0.1), r0 = ex.rollTacticsExPresent(0.5, 0, 0.1), r5 = ex.rollTacticsExPresent(0.5, 0.999, 0.1), edge = ex.rollTacticsExPresent(0.1, 0.5, 0.1);
  check('プレゼント: 乱数が0.1より小さければ大当たり(6つ全部)・そうでなければ1つ(乱数0で最初・0.999で最後)・ちょうど0.1は大当たりではない',
    jp.jackpot && jp.kinds.length === 6 && !r0.jackpot && r0.kinds.length === 1 && r0.kinds[0] === 'dmg' && r5.kinds[0] === 'crit' && !edge.jackpot);
  const allKinds = new Set(Array.from({ length: 60 }, (_, i) => ex.rollTacticsExPresent(0.5, i / 60, 0.1).kinds[0]));
  check('乱数を均等に振ると6種ぜんぶ出る', allKinds.size === 6);
  const gift = (roll) => ex.tacticsExPresentOf(ex.setTacticsExPresent(ss, 2, roll), units, A(1, 2));
  const gD = gift({ jackpot: false, kinds: ['dmg'] }), gT = gift({ jackpot: false, kinds: ['taken'] }), gC = gift({ jackpot: false, kinds: ['combo'] }), gK = gift({ jackpot: false, kinds: ['crit'] }), gH = gift({ jackpot: false, kinds: ['heal'] });
  check('プレゼントの持続4種: 与ダメ×1.2・被ダメ×0.8・連撃(10%×2回)・会心率×1.3。回復・ガッツはその場だけで持続しない',
    Math.abs(gD.dmg - 1.2) < 1e-9 && gD.taken === 1 && Math.abs(gT.taken - 0.8) < 1e-9 && gC.combo && gC.combo.count === 2 && gC.combo.rate === 0.1 && gC.combo.label === 'クリスマスプレゼント'
    && Math.abs(gK.critRate - 1.3) < 1e-9 && gH.dmg === 1 && gH.taken === 1 && gH.critRate === 1 && gH.combo === null);
  const gJ = gift({ jackpot: true, kinds: kinds.slice() });
  check('大当たりは持続4種がぜんぶ重なる', gJ.jackpot && Math.abs(gJ.dmg - 1.2) < 1e-9 && Math.abs(gJ.taken - 0.8) < 1e-9 && Math.abs(gJ.critRate - 1.3) < 1e-9 && !!gJ.combo);
  check('プレゼントは2ターンで切れる・WAVEが変わったら切れる・中身を決める前は何も起きない',
    ex.tacticsExPresentOf(ex.setTacticsExPresent(ss, 2, { jackpot: false, kinds: ['dmg'] }), units, A(1, 4)).dmg === 1
    && ex.tacticsExPresentOf(ex.setTacticsExPresent(ss, 2, { jackpot: false, kinds: ['dmg'] }), units, A(2, 2)).dmg === 1
    && ex.tacticsExPresentOf(ss, units, A(1, 2)).dmg === 1);
  const ecA = { count: 1, rate: 0.1, label: 'A' }, ecB = { count: 2, rate: 0.05, label: 'B' };
  const hitsBoth = hitsApi.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'Ark' }, attackerId: 'Ark', heroId: 'Mocchi', exCombos: [ecA, ecB] });
  const hitsNone = hitsApi.buildAttackHits({ d: 1000, card: { type: 'unique', monId: 'Ark' }, attackerId: 'Ark', heroId: 'Mocchi' });
  check('連撃は配列で渡すと、自分のぶんとプレゼントのぶんが別々に足される(100×1 + 50×2)', hitsBoth.length - hitsNone.length === 3
    && hitsBoth.slice(hitsNone.length).map(h => h.dmg).join(',') === '100,50,50' && hitsBoth.slice(hitsNone.length).map(h => h.skillName).join(',') === 'A,B,B');
  check('本体: 距離補正・味方全員ぶんの倍率・連撃(配列)・回復カード・ガッツ自動回復へ結線してある',
    /const exDistMult = tacticsExMultiBuffNow\(slotIdx\)\.distMult;/.test(app)
    && /out\.dmg\*=party\.dmg; out\.critRate\*=party\.critRate;/.test(app)
    && /const list=\[own,gift,devil\]\.filter\(Boolean\);\n\s*return list\.length===0\?null:\(list\.length===1\?list\[0\]:list\);/.test(app)
    && /tacticsRateHeal\(cardHealRate\*tacticsExPartyBuffNow\(\)\.heal,0\)/.test(app)
    && /baseGutsRecoveryRate\+tacticsExPartyBuffNow\(\)\.gutsAdd/.test(app));
  check('本体: ターン終わりにボルテージをため、次のターンも効くならピクシーの固有技を手札へ出す・使ったときにも出す',
    /addTacticsExVoltage\(stNow,tacticsUnitsRef\.current,\{ wave, turn:turnCount \},usedCardEntries\.length\)/.test(app)
    && /tacticsExUniqueGuaranteeSlot\(tacticsExStateRef\.current,tacticsUnitsRef\.current,\{ wave, turn:turnCount\+1 \}\)/.test(app)
    && /if\(def\.guaranteeUnique&&\(hand\.length<5\|\|!selectedCards\.includes\(hand\.length-1\)\)\)/.test(app));
  check('本体: 使ったときにプレゼントの中身を決めて(必ず全員のガッツ)・WAVEが変わったら回数を戻す・詳細に状態を出す',
    /rollTacticsExPresent\(Math\.random\(\),Math\.random\(\),def\.present\.jackpot\)/.test(app) && /tacticsRateHeal\(0,def\.present\.fixedGuts,false\)/.test(app)
    && /resetTacticsExWaveUses\(tacticsExStateRef\.current\)[\s\S]{0,160}\}, \[wave, runMode\]\);/.test(app)
    && /statusLines:\(\(\)=>\{/.test(app) && /data-tactics-ex-status/.test(screen));
}

// ---------- ⑯ ウンディーネ「生命の泉」・ヤオビクニ「悠久の刻」(2026-10-03 ユーザーの案) ----------
{
  const un = ex.tacticsExDefOf('Undine'), yb = ex.tacticsExDefOf('Yaobikuni');
  check('ウンディーネ「生命の泉」: 5回・併用できる・3ターン・味方を選ぶ・上限+30%・ガッツ30%', !!un && un.name === '生命の泉' && un.maxUses === 5 && un.withCards && un.duration === 'turns' && un.turns === 3
    && un.target === 'ally' && un.lifeSpring && un.lifeSpring.maxUpRate === 0.3 && un.lifeSpring.gutsRate === 0.3 && un.effect === 'lifeSpring' && ex.isTacticsExEffectImplemented(un), JSON.stringify(un));
  check('ヤオビクニ「悠久の刻」: 回数2回・併用できる・発動ターンだけ・時間停止', !!yb && yb.name === '悠久の刻' && yb.maxUses === 2 && !yb.unlimited && yb.withCards && yb.duration === 'turn'
    && yb.effect === 'timeStop' && ex.isTacticsExEffectImplemented(yb), JSON.stringify(yb));
  const A = (wave, turn) => ({ wave, turn });
  const units = [
    { id: 'Undine', hp: 100, maxHp: 350, baseMaxHp: 350, atk: 1, def: 1, guts: 10, maxGuts: 170, baseMaxGuts: 170, downed: false },
    { id: 'Golem', hp: 40, maxHp: 600, baseMaxHp: 600, atk: 1, def: 1, guts: 10, maxGuts: 70, baseMaxGuts: 70, downed: true },
    null,
    { id: 'Yaobikuni', hp: 450, maxHp: 450, baseMaxHp: 450, atk: 1, def: 1, guts: 10, maxGuts: 125, baseMaxGuts: 125, downed: false },
  ];
  const opts = ex.tacticsExTargetOptions(un, units);
  check('選べる味方は、立っている子もダウン中の子も(自分も)。選ばないEXは null', opts.length === 3 && opts.map(o => o.slot).join(',') === '0,1,3' && opts[1].downed && !opts[0].downed
    && ex.tacticsExTargetOptions(yb, units) === null && ex.tacticsExTargetOptions(null, units) === null);
  check('味方を選んでいなければ使えない・選んだ枠に味方がいなければ使えない・選ぶEXでなければ確認しない',
    !!ex.checkTacticsExTarget(un, units, null) && !!ex.checkTacticsExTarget(un, units, 2) && ex.checkTacticsExTarget(un, units, 1) === null && ex.checkTacticsExTarget(un, units, 0) === null
    && ex.checkTacticsExTarget(yb, units, null) === null);
  const used = ex.applyTacticsExUse(ex.createTacticsExState(), { def: un, slot: 0, monId: 'Undine', now: A(1, 2), target: 3 });
  check('使うと選んだ味方の枠を覚える(選ぶEXでなければ null)', used.effects[0].target === 3 && ex.applyTacticsExUse(ex.createTacticsExState(), { def: yb, slot: 3, monId: 'Yaobikuni', now: A(1, 2) }).effects[3].target === null);
  // ライフ上限: 対象の子は泉が効いているあいだ戻さない
  const withRate = ex.scaleTacticsUnits(ex.setTacticsExMaxHpRate(units, 3, 0.3), 0, 0);
  check('ライフの上限だけが上がる(450 → 585・ガッツ125のまま)。すでに上がっていれば大きいほうを残す', withRate[3].maxHp === 585 && withRate[3].maxGuts === 125
    && ex.setTacticsExMaxHpRate(ex.setTacticsExMaxHpRate(units, 3, 0.5), 3, 0.3)[3].exMaxRate === 0.5);
  check('生命の泉の対象は、泉が効いているあいだ(2〜4ターン目)は上限を戻さない・5ターン目には戻す・WAVEが変わったら戻す',
    !ex.expireTacticsExMaxRates(withRate, used, A(1, 2)).changed && !ex.expireTacticsExMaxRates(withRate, used, A(1, 4)).changed
    && ex.expireTacticsExMaxRates(withRate, used, A(1, 5)).changed && ex.expireTacticsExMaxRates(withRate, used, A(2, 2)).changed);
  check('泉の対象ではない子の上限アップは、これまでどおり(自分のガッツ全開っちーが効いていなければ戻す)',
    ex.expireTacticsExMaxRates(ex.setTacticsExMaxHpRate(withRate, 0, 0.3), used, A(1, 2)).changed);
  // 時間停止
  const ts = ex.applyTacticsExUse(ex.createTacticsExState(), { def: yb, slot: 3, monId: 'Yaobikuni', now: A(1, 4) });
  check('時間停止: 使ったターンだけ止まっている枠が見つかる(次のターン・別のWAVE・使う前は null)', ex.tacticsExTimeStopSlot(ts, units, A(1, 4)) === 3 && ex.tacticsExTimeStopSlot(ts, units, A(1, 5)) === null
    && ex.tacticsExTimeStopSlot(ts, units, A(2, 4)) === null && ex.tacticsExTimeStopSlot(ex.createTacticsExState(), units, A(1, 4)) === null);
  const spent = ex.spendTacticsExTimeStop(ts);
  check('敵の番を止めたあとは「使い終わった」ことにする(同じターンの数字が続いても止まらない)・止まっていなければ同じ state', ex.tacticsExTimeStopSlot(spent, units, A(1, 4)) === null
    && ex.isTacticsExEffectActive(spent, 3, 'Yaobikuni', A(1, 4)) && (() => { const st = ex.createTacticsExState(); return ex.spendTacticsExTimeStop(st) === st; })());
  check('使ったターンは、もう一度使えない(止めたあとの同じターンの数字でも)', !ex.checkTacticsExUse({ def: yb, state: spent, slot: 3, monId: 'Yaobikuni', alive: true, now: A(1, 4) }).ok);
  check('本体: 使う前の確認・選んだ味方の記録・生命の泉・選べる一覧・時間停止(敵の番・ターン数)へ結線してある',
    /if\(checkTacticsExTarget\(def,tacticsUnitsRef\.current,choice\)\) return false;/.test(app)
    && /choice, target:def\.target==='ally'\?choice:null \}\);/.test(app)
    && /if\(def\.lifeSpring&&Number\.isInteger\(choice\)\)\{/.test(app) && /setTacticsExMaxHpRate\(units,choice,def\.lifeSpring\.maxUpRate\)/.test(app)
    && /targetOptions:\(\(\)=>\{ const opts=tacticsExTargetOptions\(def,tacticsUnits\)/.test(app)
    && /const timeStopSlot = isTacticsMode\(runMode\)&&tacticsExEnabled \? tacticsExTimeStopSlot\(/.test(app)
    && /if \(timeStopSlot!=null\) \{\n\s*addPopup\('⏳ 時間停止！/.test(app)
    && /const nextTurn=timeStopSlot!=null\?turnCount:turnCount\+1; setTurnCount\(nextTurn\);/.test(app)
    && /data-tactics-ex-target=\{t\.slot\}/.test(screen));
}

// ---------- 残りターンの言い方(2026-10-05 ユーザー指示「残り効果ターンも分かるようにして」) ----------
{
  const A = (wave, turn) => ({ wave, turn });
  const mo = ex.tacticsExDefOf('Mocchi'), go = ex.tacticsExDefOf('Golem'), mn = ex.tacticsExDefOf('Monol'), km = ex.tacticsExDefOf('KenshiMocchi');
  const st = ex.applyTacticsExUse(ex.createTacticsExState(), { def: mo, slot: 0, monId: 'Mocchi', now: A(1, 4) });
  const r4 = ex.tacticsExRemainOf(mo, st, 0, 'Mocchi', A(1, 4)), r8 = ex.tacticsExRemainOf(mo, st, 0, 'Mocchi', A(1, 8));
  check('残りターン: 使ったターンは5(このターンを含む)・5ターン目は1・切れたら null', !!r4 && r4.kind === 'turns' && r4.turns === 5 && r4.short === 'あと5ターン' && /このターンを含む/.test(r4.text)
    && !!r8 && r8.turns === 1 && ex.tacticsExRemainOf(mo, st, 0, 'Mocchi', A(1, 9)) === null && ex.tacticsExRemainOf(mo, st, 0, 'Mocchi', A(2, 4)) === null);
  const sg = ex.applyTacticsExUse(ex.createTacticsExState(), { def: go, slot: 0, monId: 'Golem', now: A(1, 2), snapshot: { atk: 1, def: 1 } });
  const sm = ex.applyTacticsExUse(ex.createTacticsExState(), { def: mn, slot: 0, monId: 'Monol', now: A(1, 2) });
  const sk = ex.applyTacticsExUse(ex.createTacticsExState(), { def: km, slot: 0, monId: 'KenshiMocchi', now: A(1, 2), choice: 'dual' });
  check('ターン数で切れないものも、いつまでかを言葉で言う(WAVE・このターン・切り替えるまで)',
    ex.tacticsExRemainOf(go, sg, 0, 'Golem', A(1, 5)).text === 'このWAVEが終わるまで' && ex.tacticsExRemainOf(mn, sm, 0, 'Monol', A(1, 2)).text === 'このターンだけ'
    && ex.tacticsExRemainOf(km, sk, 0, 'KenshiMocchi', A(1, 9)).text === '切り替えるまでずっと' && ex.tacticsExRemainOf(mn, sm, 0, 'Monol', A(1, 3)) === null);
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '60-app.jsx'), 'utf8');
  const scr = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '71-screen-battle.jsx'), 'utf8');
  check('画面へ結線してある(札の残り・詳細の「残り」と状態のひとこと・ターン終わりのログ)', /remainText:\(\(\)=>\{/.test(app) && /stateText:\(\(\)=>\{/.test(app)
    && /data-tactics-ex-remain/.test(scr) && /data-tactics-ex-state-pill/.test(scr) && /の効果が切れた/.test(app) && /雷纏が始まる！/.test(app));
}

// ---------- ⑱ ライガー「雷狼影」(2026-10-05 ユーザー指示・数字はユーザー指定) ----------
{
  const tg = ex.tacticsExDefOf('Tiger');
  check('ライガー「雷狼影」: ラン5回・併用できる・合計6ターン(ため3＋雷纏3)・雷×与ダメ30%/会心10%/連撃10%/回避5%/ライフ5%/ガッツ5%',
    !!tg && tg.name === '雷狼影' && tg.maxUses === 5 && !tg.unlimited && tg.withCards && tg.duration === 'turns' && tg.turns === 6
    && tg.effect === 'thunder' && ex.isTacticsExEffectImplemented(tg) && !!tg.thunder && tg.thunder.chargeTurns === 3
    && tg.thunder.dmg === 0.3 && tg.thunder.crit === 0.1 && tg.thunder.comboRate === 0.1 && tg.thunder.dodge === 0.05
    && tg.thunder.regenHp === 0.05 && tg.thunder.regenGuts === 0.05 && /雷纏/.test(tg.desc), JSON.stringify(tg));
  const A = (wave, turn) => ({ wave, turn });
  const tiger = { id: 'Tiger', hp: 400, maxHp: 400, baseMaxHp: 400, atk: 1, def: 1, guts: 50, maxGuts: 135, baseMaxGuts: 135, downed: false };
  const units = [null, tiger];
  let st = ex.applyTacticsExUse(ex.createTacticsExState(), { def: tg, slot: 1, monId: 'Tiger', now: A(2, 4) });
  const t0 = ex.tacticsExThunderOf(st, units, 1, A(2, 4));
  check('使った直後は雷0・ためている前半(あと3ターン)・強化なし', !!t0 && t0.charge === 0 && t0.phase === 'charge' && t0.turnsLeft === 3
    && ex.tacticsExMultiBuffOf(st, units, 1, A(2, 4)) === null && ex.tacticsExExtraCombosAt(st, units, 1, A(2, 4)) === null, JSON.stringify(t0));
  // 行動(カード)の数だけたまる: 2枚・3枚(ガードやききで増えたぶんも含む)・1枚 → 雷6
  st = ex.addTacticsExThunder(st, units, A(2, 4), 1, 2);
  st = ex.addTacticsExThunder(st, units, A(2, 5), 1, 3);
  st = ex.addTacticsExThunder(st, units, A(2, 6), 1, 1);
  const tc = ex.tacticsExThunderOf(st, units, 1, A(2, 6));
  check('ためている3ターンのあいだ、使ったカードの枚数だけ雷がたまる(2+3+1=6)', !!tc && tc.charge === 6 && tc.phase === 'charge' && tc.turnsLeft === 1, JSON.stringify(tc));
  check('ためているあいだは、与ダメ・会心・連撃・回避・自動回復は変わらない', ex.tacticsExMultiBuffOf(st, units, 1, A(2, 6)) === null
    && ex.tacticsExExtraCombosAt(st, units, 1, A(2, 6)) === null && tc.dodgeRate === 0
    && ex.tacticsExRegenRateAt(st, units, 1, A(2, 6), 'hp') === 0 && ex.tacticsExRegenRateAt(st, units, 1, A(2, 6), 'guts') === 0);
  const tw = ex.tacticsExThunderOf(st, units, 1, A(2, 7));
  const mb = ex.tacticsExMultiBuffOf(st, units, 1, A(2, 7)), cb = ex.tacticsExExtraCombosAt(st, units, 1, A(2, 7));
  check('3ターンのあと雷纏が始まる: 雷6 → 与ダメ+180%・会心率+60%・回避率+30%・連撃10%×6回',
    !!tw && tw.phase === 'wrap' && tw.charge === 6 && tw.turnsLeft === 3 && Math.abs(mb.dmg - 2.8) < 1e-9 && Math.abs(mb.critAdd - 0.6) < 1e-9 && mb.critRate === 1
    && Math.abs(tw.dodgeRate - 0.3) < 1e-9 && !!cb && cb.count === 6 && Math.abs(cb.rate - 0.1) < 1e-9 && cb.label === '雷纏', JSON.stringify({ tw, mb, cb }));
  check('雷纏のあいだ、ターン終わりの自動回復へライフ・ガッツとも 雷×5% を足す(6 → 30%)',
    Math.abs(ex.tacticsExRegenRateAt(st, units, 1, A(2, 8), 'hp') - 0.3) < 1e-9 && Math.abs(ex.tacticsExRegenRateAt(st, units, 1, A(2, 8), 'guts') - 0.3) < 1e-9);
  const more = ex.addTacticsExThunder(st, units, A(2, 7), 1, 3);
  check('雷纏に入ったあとは、カードを使っても雷は増えない', ex.tacticsExThunderOf(more, units, 1, A(2, 8)).charge === 6);
  check('雷纏は3ターンで終わる(9ターン目まで・10ターン目には切れる)・次のWAVEでは切れる',
    !!ex.tacticsExThunderOf(st, units, 1, A(2, 9)) && ex.tacticsExThunderOf(st, units, 1, A(2, 10)) === null && ex.tacticsExThunderOf(st, units, 1, A(3, 5)) === null
    && ex.tacticsExMultiBuffOf(st, units, 1, A(2, 10)) === null && ex.tacticsExRegenRateAt(st, units, 1, A(2, 10), 'hp') === 0);
  check('効いているあいだ(ため・雷纏とも)はもう一度使えない・切れたあとは使える(ラン5回のうち残り4回)',
    !ex.checkTacticsExUse({ def: tg, state: st, slot: 1, monId: 'Tiger', alive: true, now: A(2, 5) }).ok
    && !ex.checkTacticsExUse({ def: tg, state: st, slot: 1, monId: 'Tiger', alive: true, now: A(2, 8) }).ok
    && ex.checkTacticsExUse({ def: tg, state: st, slot: 1, monId: 'Tiger', alive: true, now: A(2, 10) }).ok
    && ex.tacticsExRemaining(tg, ex.tacticsExUsesOf(st, 1, 'Tiger')).left === 4);
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '60-app.jsx'), 'utf8');
  check('本体へ結線してある(カード枚数で雷をためる・回避率・会心率の足し算)', /addTacticsExThunder\(stTh,tacticsUnitsRef\.current/.test(app)
    && /Math\.random\(\)<tacticsExThunderDodgeNow\(slotIdx\)/.test(app) && /evadedSlot\|\|exDodge\|\|thunderDodge/.test(app)
    && /critRateBonus\+\(tacticsExMultiBuffNow\(slotIdx\)\.critAdd\|\|0\)/.test(app));
}

// ---------- ⑰ パンドラ「パンドラの箱」(2026-10-03 ユーザーの案・数字は仮) ----------
{
  const pd = ex.tacticsExDefOf('Pandora');
  check('パンドラ「パンドラの箱」: ラン3回・併用できる・3ターン・ライフ30%・自分+1枚・悪魔側 与ダメ×1.5と連撃30%×1・天使側10%・最後の希望ガッツ50%', !!pd && pd.name === 'パンドラの箱' && pd.maxUses === 3 && pd.withCards
    && pd.duration === 'turns' && pd.turns === 3 && pd.effect === 'pandoraBox' && ex.isTacticsExEffectImplemented(pd) && !!pd.pandoraBox
    && pd.pandoraBox.costRate === 0.3 && pd.pandoraBox.selfCardBonus === 1 && pd.pandoraBox.devilDmg === 1.5 && pd.pandoraBox.devilCombo.count === 1 && pd.pandoraBox.devilCombo.rate === 0.3
    && pd.pandoraBox.angelRate === 0.1 && pd.pandoraBox.hopeGutsRate === 0.5, JSON.stringify(pd));
  const A = (wave, turn) => ({ wave, turn });
  const mk = (id, hp, downed = false) => ({ id, hp, maxHp: 400, baseMaxHp: 400, atk: 1, def: 1, guts: 50, maxGuts: 135, baseMaxGuts: 135, downed });
  const units = [mk('Pandora', 400), mk('Golem', 400), mk('Mocchi', 200, true)];
  const st = ex.applyTacticsExUse(ex.createTacticsExState(), { def: pd, slot: 0, monId: 'Pandora', now: A(2, 3) });
  check('箱が効いているのは使ったターンから3ターン(3〜5ターン目)・次のWAVEでは切れる・パンドラの枠だけ',
    !!ex.tacticsExPandoraBoxOf(st, units, 0, A(2, 3)) && !!ex.tacticsExPandoraBoxOf(st, units, 0, A(2, 5)) && ex.tacticsExPandoraBoxOf(st, units, 0, A(2, 6)) === null
    && ex.tacticsExPandoraBoxOf(st, units, 0, A(3, 3)) === null && ex.tacticsExPandoraBoxOf(st, units, 1, A(2, 3)) === null
    && ex.tacticsExPandoraBoxOf(ex.createTacticsExState(), units, 0, A(2, 3)) === null);
  const dv = ex.tacticsExPandoraDevil(st, units, 0, A(2, 3), false);
  check('悪魔側の力: 1枚目だけ 与ダメ×1.5・連撃30%×1(名前「悪魔の力」)。「同じ子の2枚目」・箱が無いときは null',
    !!dv && dv.dmg === 1.5 && dv.combo.count === 1 && dv.combo.rate === 0.3 && dv.combo.label === '悪魔の力'
    && ex.tacticsExPandoraDevil(st, units, 0, A(2, 3), true) === null && ex.tacticsExPandoraDevil(ex.createTacticsExState(), units, 0, A(2, 3), false) === null);
  check('パンドラ自身が使えるカードが+1(自分の枠+1・盤面の枚数も+1・ほかの子の枠は+0)', ex.tacticsExCardBonusAt(st, units, 0, A(2, 3)) === 1 && ex.tacticsExCardBonusAt(st, units, 1, A(2, 3)) === 0
    && ex.tacticsExCardBonusTotal(st, units, A(2, 3)) === 1 && ex.tacticsExCardBonusTotal(st, units, A(2, 6)) === 0);
  const t1 = ex.tacticsExPandoraTurnEnd(st, units, A(2, 3)), t2 = ex.tacticsExPandoraTurnEnd(st, units, A(2, 4)), t3 = ex.tacticsExPandoraTurnEnd(st, units, A(2, 5));
  check('ターン終わり: 1・2ターン目はライフを払う(cost)・3ターン目は最後の希望(hope)・箱が無ければ null', !!t1 && t1.slot === 0 && t1.phase === 'cost' && t2.phase === 'cost' && t3.phase === 'hope'
    && ex.tacticsExPandoraTurnEnd(st, units, A(2, 6)) === null && ex.tacticsExPandoraTurnEnd(ex.createTacticsExState(), units, A(2, 3)) === null);
  const downedUnits = [mk('Pandora', 0, true), mk('Golem', 400), mk('Mocchi', 200, true)];
  check('パンドラが倒れていたら died(最後の希望は起きない)', ex.tacticsExPandoraTurnEnd(st, downedUnits, A(2, 4)).phase === 'died' && ex.tacticsExPandoraTurnEnd(st, downedUnits, A(2, 5)).phase === 'died');
  const spent = ex.spendTacticsExPandoraBox(st);
  check('始末が済むと何も起きない(同じターンの数字が続いても)・効いていなければ同じ state',
    ex.tacticsExPandoraTurnEnd(spent, units, A(2, 5)) === null && ex.tacticsExPandoraBoxOf(spent, units, 0, A(2, 4)) === null && ex.tacticsExPandoraDevil(spent, units, 0, A(2, 4), false) === null
    && (() => { const e = ex.createTacticsExState(); return ex.spendTacticsExPandoraBox(e) === e; })());
  check('箱が効いているあいだは、もう一度使えない(ラン3回のうち、切れたあとなら使える)', !ex.checkTacticsExUse({ def: pd, state: st, slot: 0, monId: 'Pandora', alive: true, now: A(2, 4) }).ok && ex.checkTacticsExUse({ def: pd, state: ex.spendTacticsExPandoraBox(st), slot: 0, monId: 'Pandora', alive: true, now: A(3, 1) }).ok);
  check('本体: 悪魔側(与ダメ・連撃・予測)・天使側(2枚目)・ターン終わりの始末へ結線してある',
    /tacticsExPandoraDevilNow\(slotIdx,isSecondOrLaterAtk\)\.dmg\*/.test(app)
    && /const devil=tacticsExPandoraDevilNow\(slotIdx,halved\)\.combo;/.test(app)
    && /getAttackPredictedDmg = useCallback\(\(card, mon, baseDmg, additionalGlobalCombo=0, slotIdx=null, halved=false\)/.test(app)
    && (screen.match(/getAttackPredictedDmg\([^;]*,(halved|pendingHalved|isSecondOrLater)\)/g) || []).length === 4
    && /pandoraCardNo\[entry\.slotIdx\]===2\?tacticsExPandoraBoxOf\(/.test(app) && /tacticsRateHeal\(boxNow\.angelRate,boxNow\.angelRate,false\)/.test(app)
    && /setTacticsPandoraForms\(\{\[entry\.slotIdx\]:'devil'\}\)/.test(app) && /setTacticsPandoraForms\(\{\[entry\.slotIdx\]:'angel'\}\)/.test(app) && /setTacticsPandoraForms\(\{\}\);/.test(app)
    && /attackHits\[k\]\.pandoraForm=pdTagForm/.test(app) && /setTacticsPandoraForms\(hit&&hit\.pandoraForm&&hit\.slotIdx!=null\?/.test(app)
    && /data-pandora-pair/.test(screen) && /\{pandoraArt\?pandoraArt:s\?\.imgUrl\?/.test(screen) && /tacticsPandoraForms=\{tacticsPandoraForms\}/.test(app)
    && /const boxStep=tacticsExPandoraTurnEnd\(tacticsExStateRef\.current,tacticsUnitsRef\.current,tacticsExLiveRef\.current\.now\);\s*if\(boxStep\) await settleTacticsExPandoraBox\(boxStep\);/.test(app)
    && /if\(timeStopSlot==null&&isTacticsMode\(runMode\)&&tacticsExEnabled\)\{\s*const boxStep/.test(app));
}

// ---------- ⑧ 壊れた値 ----------
{
  let fine = true;
  for (const bad of [null, undefined, 1, 'x', [], { uses: 3, effects: null, lastUse: [], turnUsed: { wave: 'a' } }]) {
    try {
      const n = ex.normalizeTacticsExState(bad);
      fine = fine && typeof n.uses === 'object' && ex.tacticsExUsesOf(bad, 0, 'Monol') === 0
        && ex.isTacticsExCardLocked(bad, 0, T(1, 1)) === false;
      ex.checkTacticsExUse({ def: monol, state: bad, slot: 0, monId: 'Monol', alive: true, now: T(1, 1) });
      ex.applyTacticsExUse(bad, { def: monol, slot: 0, monId: 'Monol', now: T(1, 1) });
    } catch (e) { fine = false; }
  }
  check('壊れた状態が来ても落ちず、初期値として扱う', fine);
  const d = ex.normalizeTacticsExDef({ id: 'x', maxUses: -3, duration: 'forever' });
  check('壊れた定義は控えめな既定値へ倒す(併用しない・発動ターン・回数0)', d && d.maxUses === 0 && !d.withCards
    && d.duration === 'turn' && ex.normalizeTacticsExDef({}) === null, JSON.stringify(d));
  const s = ex.applyTacticsExUse(ex.createTacticsExState(), { def: monol, slot: 1, monId: 'Monol', now: T(1, 1) });
  const before = JSON.stringify(s);
  ex.applyTacticsExUse(s, { def: golem, slot: 2, monId: 'Golem', now: T(1, 2) });
  check('渡された状態を書き換えない', JSON.stringify(s) === before);
}

// ---------- ⑨ 本体への結線 ----------
{
  const reset = app.slice(app.indexOf('const resetTacticsJoinCatchUp'), app.indexOf('};', app.indexOf('const resetTacticsJoinCatchUp')));
  check('ランの片付け(resetTacticsJoinCatchUp)でEXの状態を作り直す', /commitTacticsExState\(createTacticsExState\(\)\)/.test(reset));
  check('EXを出すかは tacticsExSkillsEnabled 1か所で決める', /const tacticsExEnabled = tacticsExSkillsEnabled\(runMode/.test(app)
    && (app.match(/tacticsExSkillsEnabled\(/g) || []).length === 1);
  // EXは枚数(cardLimit)の計算に入らない
  //   ★2026-10-03 例外はミーアの「オン・ステージ！」だけ(盤面の枚数+1と、ミーア自身の+1)。元の計算(baseCardLimit)には入れない
  const limitBlock = app.slice(app.indexOf('const baseCardLimit'), app.indexOf('const exCardBonus'));
  check('EXは元の枚数の計算(baseCardLimit・👑の+1)に入っていない', !/tacticsEx/.test(limitBlock));
  check('ミーアの「オン・ステージ！」だけが cardLimit・ミーア自身の枚数へ足される',
    /const exCardBonus = isTacticsMode\(runMode\) \? tacticsExCardBonusTotal\(tacticsExState,tacticsUnits,\{ wave, turn:turnCount \}\) : 0;\n\s*const cardLimit = Math\.min\(5,baseCardLimit\+soulCoordinationCardBonus\+exCardBonus\);/.test(app)
    && /tacticsExCardBonusAt\(tacticsExState,tacticsUnits,slotIdx,\{ wave, turn:turnCount \}\)/.test(app));
  // ★止めるのは使った子だけ。置ける子の一覧(tacticsUsableSlots)から外すので、手動の選択・スワイプ・枠のタップが一度に止まる
  check('併用できないEXを使った子は、置ける子の一覧(手動・スワイプ・枠のタップ)から外れる',
    /if\(tacticsExLocked\.includes\(slotIdx\)\) return;\n\s*if\(countsTowardTacticsSlotLimit\(card\)/.test(app)
    && !/tacticsExCardLocked/.test(app) && !/tacticsExCardLocked/.test(screen));
  check('ACTION・AUTOも、その子のカードだけ止める(ほかの子のカードは通す)',
    /if \(usedCardEntries\.some\(entry=>tacticsExLocked\.includes\(entry\.slotIdx\)\)\) return;/.test(app)
    && /canTacticsSlotAct\(tacticsUnitsRef\.current,idx\)&&!tacticsExLocked\.includes\(idx\)\?mon:null/.test(app)
    && /if\(tacticsExTurnUsed\)return passTacticsTurn\(\);/.test(app));
  check('緊急回復は止めない(止まるのはEXを使った子のカードだけ)', !/const useEmergency = async \(\) => \{[\s\S]{0,200}tacticsEx/.test(app));
  check('併用できないEXの判定は「その子へ置いたカード」だけを数える',
    (app.match(/selectedCount:tacticsSlotCardCount\(slotIdx\)/g) || []).length === 2);
  // 距離枠のタップ: カードを置く途中ならカードの操作、そうでなければ詳細を開くだけ(使うのは詳細のボタン)
  const slotClick = screen.slice(screen.indexOf('if(pendingCard!=null && canAssign){'), screen.indexOf('}}', screen.indexOf('if(pendingCard!=null && canAssign){')));
  check('距離枠のタップは、カードの置き場所の操作を先に見る', slotClick.indexOf('setCardAssignments') < slotClick.indexOf('setExPanelSlot'));
  check('距離枠のタップはEXの詳細を開くだけで、発動しない', /setExPanelSlot\(i\)/.test(slotClick) && !/activateTacticsEx/.test(slotClick));
  // 効果の結線。モンスターのidではなく「いま効いている効果の種類」を見る
  check('被ダメ・ガード・与ダメの3か所が、EXを乗せた1体ぶん(tacticsBattleUnit)を読む',
    /\? tacticsBattleUnit\(targetSlot\) : null;/.test(app)
    && /const unit = tacticsBattleUnit\(slotIdx\);\n\s*return unit \? resolveEffectiveMaxStat/.test(app)
    && /normalizeTacticsUnit\(tacticsBattleUnit\(slotIdx\)\)\.atk/.test(app));
  check('敵の攻撃の当たり先はすべて tacticsTargetsNow(かばう)を通る',
    !/tacticsIntentTargets\(intent,tacticsUnitsRef\.current,actingEnemyDist\)/.test(app)
    && (app.match(/tacticsTargetsNow\(intent,actingEnemyDist\)/g) || []).length === 3);
  check('片手盾の剣士モッチーはソードスキルが出ない・二刀流は連撃が2回ぶん(実処理・予測の両方)',
    (app.match(/swordSkill:tacticsExStyleAt\(slotIdx\)!=='shield'/g) || []).length === 2
    && (app.match(/hitRepeat:tacticsExStyleAt\(slotIdx\)==='dual'\?TACTICS_EX_DUAL_HIT_REPEAT:1/g) || []).length === 2
    && /card\.monId==='KenshiMocchi'&&tacticsExStyleAt\(slotIdx\)==='shield'/.test(app)
    && /if \(swordSkill && isUniqueOf\('KenshiMocchi'\)\)/.test(source));
  // 定義の取り方は、ジャックのレイドバトルでEXの回数を2回にする包み(raidExDefOf)を通る形になった(2026-10)
  check('勇者モンを置いた瞬間に初期スタイルを書き込む(タクティクスだけ)',
    /if \(isTacticsMode\(runMode\)\) \{\n\s*const heroExDef=(?:tacticsExDefOf|raidExDefOf)\(m\.id\);/.test(app)
    && /setTacticsHeroStyle\(null\);/.test(app.slice(app.indexOf('const resetTacticsJoinCatchUp'), app.indexOf('const resetTacticsJoinCatchUp') + 800)));
  check('効き目は ref から「いま」を読む(useCallback の古い関数から呼ばれても同じ答え)',
    /const tacticsExEffectAt = \(slotIdx\) => \{\n\s*const live=tacticsExLiveRef\.current;/.test(app));
  // 発動の入口は詳細パネルの中だけ(「EXスキルを使用」と、スタイル式の選択肢)。距離枠のタップからは発動しない
  const panelSrc = screen.slice(screen.indexOf('{exPanel&&ReactDOM.createPortal('), screen.indexOf('{showBattleMenu&&ReactDOM.createPortal('));
  check('使った瞬間にその子のライフとガッツを満タンにする(ガッツ全開っちー)',
    /if\(def\.fullRecover\)\{[\s\S]{0,600}recoverTacticsGutsAt\(healTacticsAt\(units,slotIdx,hpGain\),slotIdx,gutsGain\)/.test(app)
    && /const tacticsExNow = \{ wave, turn:turnCount \};/.test(app)
    && /if\(def\.rates\.hp>0\|\|def\.rates\.guts>0\) units=scaleTacticsUnits\(setTacticsExMaxRate\(units,slotIdx,def\.rates\.hp,def\.rates\.guts\)/.test(app)
    && /const result = expireTacticsExMaxRates\(tacticsUnitsRef\.current, tacticsExStateRef\.current, \{ wave, turn:turnCount \}\);/.test(app));
  check('発動は詳細パネルの「EXスキルを使用」(スタイル式はその先の選択肢)からだけ',
    (screen.match(/activateTacticsEx\(/g) || []).length === (panelSrc.match(/activateTacticsEx\(/g) || []).length
    && (panelSrc.match(/activateTacticsEx\(/g) || []).length === 3 // 使う・スタイルを選ぶ・味方を選ぶ(生命の泉。2026-10-03)
    && /data-tactics-ex-use disabled=\{!exPanel\.check\.ok\}/.test(screen)
    && /data-tactics-ex-choice=\{st\.id\} disabled=\{st\.current\|\|!exPanel\.check\.ok\}/.test(screen)
    && /data-tactics-ex-target=\{t\.slot\} data-tactics-ex-target-downed=\{t\.downed\?'yes':'no'\} disabled=\{!exPanel\.check\.ok\}/.test(screen));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
