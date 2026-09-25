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
  slice('const tacticsAliveSlots', 'const tacticsFilledSlots'),
  slice('// ==== タクティクス専用 EXスキル(STEP1: 共通基盤) ====', '// ==== タクティクス専用 EXスキルここまで ===='),
  'globalThis.ex={TACTICS_EX_SKILLS,TACTICS_EX_DURATION_TEXT,TACTICS_EX_IMPLEMENTED_EFFECTS,normalizeTacticsExDef,'
    + 'tacticsExDefOf,isTacticsExEffectImplemented,createTacticsExState,normalizeTacticsExState,tacticsExUsesOf,'
    + 'tacticsExRemaining,isTacticsExEffectActive,isTacticsExCardLocked,tacticsExLockedSlots,isTacticsExTurnUsed,checkTacticsExUse,'
    + 'applyTacticsExUse,tacticsExDurationText,tacticsExTurnsLeft,tacticsExStyleOf,tacticsExStyleLabel,checkTacticsExChoice,setTacticsExInitialStyle,tacticsExActiveStyle,TACTICS_EX_DUAL_HIT_REPEAT,tacticsExActiveEffect,applyTacticsExStats,tacticsExCoverSlot,coverTacticsTargets};',
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
  check('タクティクスのモードが3つ見えている(検査が空回りしていない)', tacticsModes.length === 3, tacticsModes.join(','));
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
check('モノリス「みんなをかばう」: ラン10回・併用できる・発動ターン',
  monol && monol.name === 'みんなをかばう' && monol.maxUses === 10 && !monol.unlimited && monol.withCards && monol.duration === 'turn',
  JSON.stringify(monol));
check('ゴーレム「捨て身」: ラン3回・使ったターンは他カード不可・WAVE内・効果中は再使用不可',
  golem && golem.name === '捨て身' && golem.maxUses === 3 && !golem.unlimited && !golem.withCards && golem.duration === 'wave'
    && golem.conditions.includes('notActive'),
  JSON.stringify(golem));
check('剣士モッチー「ソード・コンバージョン」: 無制限・使ったターンは他カード不可・再使用まで続く',
  kenshi && kenshi.name === 'ソード・コンバージョン' && kenshi.unlimited && !kenshi.withCards && kenshi.duration === 'style'
    && kenshi.styles.map(st => st.label).join('/') === '片手剣/片手盾/二刀流' && kenshi.defaultStyle === 'sword' && kenshi.heroInitialStyle,
  JSON.stringify(kenshi));
check('ソード・コンバージョンの説明だけで3つのスタイルの効き目が分かる', ['片手剣：', '片手盾：', '二刀流：', '丈夫さ', 'ソードスキル', '連撃', 'メイン']
  .every(w => kenshi.desc.includes(w)), kenshi.desc);
check('EXを持たない子は null', ex.tacticsExDefOf('Ham') === null && ex.tacticsExDefOf(null) === null
  && ex.tacticsExDefOf('toString') === null && ex.tacticsExDefOf('__proto__') === null);
check('どの定義も効果時間の説明を持つ', Object.keys(ex.TACTICS_EX_SKILLS)
  .every(id => !!ex.tacticsExDurationText(ex.tacticsExDefOf(id))));
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
  // 無制限
  let k = ex.createTacticsExState();
  let okAll = true;
  for (let turn = 1; turn <= 30; turn += 1) {
    const rr = use(k, kenshi, 0, 'KenshiMocchi', T(1 + Math.floor(turn / 10), turn));
    okAll = okAll && rr.check.ok; k = rr.state;
  }
  const rem = ex.tacticsExRemaining(kenshi, ex.tacticsExUsesOf(k, 0, 'KenshiMocchi'));
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
  const k2 = use(ex.createTacticsExState(), kenshi, 0, 'KenshiMocchi', T(1, 1)).state;
  const againK = ex.checkTacticsExUse({ def: kenshi, state: k2, slot: 0, monId: 'KenshiMocchi', alive: true, now: T(1, 1) });
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
  check('モッチー「ガッツ全開っちー」: ラン3回・カードと併用できる・5ターン・20%・全回復', !!gm && gm.name === 'ガッツ全開っちー'
    && gm.maxUses === 3 && !gm.unlimited && gm.withCards && gm.duration === 'turns' && gm.turns === 5
    && gm.statRate === 0.2 && gm.fullRecover && ex.isTacticsExEffectImplemented(gm), JSON.stringify(gm));
  check('効果時間の文にターン数と「WAVEが変わると切れる」が入る', /5ターン/.test(ex.tacticsExDurationText(gm)) && /WAVEが変わると切れる/.test(ex.tacticsExDurationText(gm)), ex.tacticsExDurationText(gm));
  const A = (wave, turn) => ({ wave, turn });
  const s0 = ex.createTacticsExState();
  // WAVE2の3ターン目に使う
  const g = ex.applyTacticsExUse(s0, { def: gm, slot: 0, monId: 'Mocchi', now: A(2, 3) });
  const unit = { id: 'Mocchi', hp: 300, maxHp: 600, atk: 120, def: 120, guts: 50, maxGuts: 100, downed: false };
  const on = ex.applyTacticsExStats(unit, g, 0, A(2, 3));
  check('使ったターンから 力120/丈夫さ120 → 144/144(20%アップ)', on.atk === 144 && on.def === 144, `${on.atk}/${on.def}`);
  check('同じWAVEの5ターン目(7ターン目)まで続く', ex.isTacticsExEffectActive(g, 0, 'Mocchi', A(2, 7)));
  check('6ターン目(8ターン目)には切れて元の値に戻る', !ex.isTacticsExEffectActive(g, 0, 'Mocchi', A(2, 8))
    && ex.applyTacticsExStats(unit, g, 0, A(2, 8)).atk === 120);
  // ★WAVEはまたがない(2026-09-25 ユーザー指示「WAVE跨ぎはなし」)
  const late = ex.applyTacticsExUse(s0, { def: gm, slot: 0, monId: 'Mocchi', now: A(2, 18) });
  check('WAVEが変わったら5ターンたつ前でも切れる(WAVE2の18ターン目に使い、WAVE3の1ターン目で切れる)',
    ex.isTacticsExEffectActive(late, 0, 'Mocchi', A(2, 19)) && !ex.isTacticsExEffectActive(late, 0, 'Mocchi', A(3, 1)));
  check('あと何ターンか(使ったターンは5、最後のターンは1、切れたら0)', ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 3)) === 5
    && ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 7)) === 1 && ex.tacticsExTurnsLeft(g, 0, 'Mocchi', A(2, 8)) === 0);
  check('ライフ・ガッツの上限は変えない(満タンにするのは使った瞬間の回復)', on.maxHp === 600 && on.maxGuts === 100 && on.hp === 300);
  check('使ったターンもほかのカードを使える(その子も)', !ex.isTacticsExCardLocked(g, 0, A(2, 3)));
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
  const limitBlock = app.slice(app.indexOf('const baseCardLimit'), app.indexOf('const slotMaxUses'));
  check('EXは1ターンに選べる枚数(cardLimit・👑の+1)の計算に入っていない', !/tacticsEx/.test(limitBlock));
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
  check('勇者モンを置いた瞬間に初期スタイルを書き込む(タクティクスだけ)',
    /if \(isTacticsMode\(runMode\)\) \{\n\s*const heroExDef=tacticsExDefOf\(m\.id\);/.test(app)
    && /setTacticsHeroStyle\(null\);/.test(app.slice(app.indexOf('const resetTacticsJoinCatchUp'), app.indexOf('const resetTacticsJoinCatchUp') + 800)));
  check('効き目は ref から「いま」を読む(useCallback の古い関数から呼ばれても同じ答え)',
    /const tacticsExEffectAt = \(slotIdx\) => \{\n\s*const live=tacticsExLiveRef\.current;/.test(app));
  // 発動の入口は詳細パネルの中だけ(「EXスキルを使用」と、スタイル式の選択肢)。距離枠のタップからは発動しない
  const panelSrc = screen.slice(screen.indexOf('{exPanel&&ReactDOM.createPortal('), screen.indexOf('{showBattleMenu&&ReactDOM.createPortal('));
  check('使った瞬間にその子のライフとガッツを満タンにする(ガッツ全開っちー)',
    /if\(def\.fullRecover\)\{[\s\S]{0,300}recoverTacticsGutsAt\(healTacticsAt\(tacticsUnitsRef\.current,slotIdx,hpGain\),slotIdx,gutsGain\)/.test(app)
    && /const tacticsExNow = \{ wave, turn:turnCount \};/.test(app));
  check('発動は詳細パネルの「EXスキルを使用」(スタイル式はその先の選択肢)からだけ',
    (screen.match(/activateTacticsEx\(/g) || []).length === (panelSrc.match(/activateTacticsEx\(/g) || []).length
    && (panelSrc.match(/activateTacticsEx\(/g) || []).length === 2
    && /data-tactics-ex-use disabled=\{!exPanel\.check\.ok\}/.test(screen)
    && /data-tactics-ex-choice=\{st\.id\} disabled=\{st\.current\|\|!exPanel\.check\.ok\}/.test(screen));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
