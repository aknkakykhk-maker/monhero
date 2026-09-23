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
//   ⑤ 併用: 併用できないEXはカードを選んでいると使えず、使ったターンはカードを選べない
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
  slice('// ==== タクティクス専用 EXスキル(STEP1: 共通基盤) ====', '// ==== タクティクス専用 EXスキルここまで ===='),
  'globalThis.ex={TACTICS_EX_SKILLS,TACTICS_EX_DURATION_TEXT,TACTICS_EX_IMPLEMENTED_EFFECTS,normalizeTacticsExDef,'
    + 'tacticsExDefOf,isTacticsExEffectImplemented,createTacticsExState,normalizeTacticsExState,tacticsExUsesOf,'
    + 'tacticsExRemaining,isTacticsExEffectActive,isTacticsExCardLocked,isTacticsExTurnUsed,checkTacticsExUse,'
    + 'applyTacticsExUse,tacticsExToggleLabel};',
].join('\n'), sandbox);
const { gate, modes, ex } = sandbox;

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
check('モノリス「みんなをかばう」: ラン3回・併用できる・発動ターン',
  monol && monol.name === 'みんなをかばう' && monol.maxUses === 3 && !monol.unlimited && monol.withCards && monol.duration === 'turn',
  JSON.stringify(monol));
check('ゴーレム「捨て身」: ラン3回・使ったターンは他カード不可・WAVE内',
  golem && golem.name === '捨て身' && golem.maxUses === 3 && !golem.unlimited && !golem.withCards && golem.duration === 'wave',
  JSON.stringify(golem));
check('剣士モッチー「武器チェンジ」: 無制限・使ったターンは他カード不可・再使用まで続く',
  kenshi && kenshi.name === '武器チェンジ' && kenshi.unlimited && !kenshi.withCards && kenshi.duration === 'toggle'
    && kenshi.toggleLabels[0] === '二刀流' && kenshi.toggleLabels[1] === '片手持ち',
  JSON.stringify(kenshi));
check('EXを持たない子は null', ex.tacticsExDefOf('Ham') === null && ex.tacticsExDefOf(null) === null
  && ex.tacticsExDefOf('toString') === null && ex.tacticsExDefOf('__proto__') === null);
check('どの定義も効果時間の説明を持つ', Object.keys(ex.TACTICS_EX_SKILLS)
  .every(id => !!ex.TACTICS_EX_DURATION_TEXT[ex.tacticsExDefOf(id).duration]));
const ids = Object.keys(ex.TACTICS_EX_SKILLS).map(id => ex.tacticsExDefOf(id).id);
check('EXのidが重ならない', new Set(ids).size === ids.length, ids.join(','));
// STEP1 では効果の中身がまだ無い。入れたら TACTICS_EX_IMPLEMENTED_EFFECTS へ足すので、ここも合わせて変わる
check('効果が入っていないEXは「未実装」と判定される(画面が「開発中」を出す手がかり)',
  [monol, golem, kenshi].every(d => ex.isTacticsExEffectImplemented(d) === ex.TACTICS_EX_IMPLEMENTED_EFFECTS.includes(d.effect)));

// ---------- ③④ 回数 ----------
const T = (wave, turn) => ({ wave, turn });
const use = (state, def, slot, monId, now, extra = {}) => {
  const c = ex.checkTacticsExUse({ def, state, slot, monId, alive: true, selectedCount: 0, now, ...extra });
  return { check: c, state: c.ok ? ex.applyTacticsExUse(state, { def, slot, monId, now }) : state };
};
{
  let s = ex.createTacticsExState();
  check('新しいランの状態は、どの子も0回', ex.tacticsExUsesOf(s, 0, 'Monol') === 0
    && ex.tacticsExRemaining(monol, 0).left === 3);
  let r = use(s, monol, 1, 'Monol', T(1, 1)); s = r.state;
  check('使うと残りが1減る(3→2)', r.check.ok && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === 2);
  // WAVEをまたぐ(WAVE2の1ターン目)。回数は戻らない
  r = use(s, monol, 1, 'Monol', T(2, 1)); s = r.state;
  check('WAVEが変わっても回数は戻らない(2→1)', r.check.ok && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === 1);
  r = use(s, monol, 1, 'Monol', T(3, 5)); s = r.state;
  check('3回目で0になる', r.check.ok && ex.tacticsExRemaining(monol, ex.tacticsExUsesOf(s, 1, 'Monol')).left === 0);
  r = use(s, monol, 1, 'Monol', T(4, 1));
  check('0回では使えない', !r.check.ok && /回数/.test(r.check.reason), r.check.reason);
  check('ほかの枠の回数には影響しない', ex.tacticsExUsesOf(s, 0, 'Monol') === 0);
  check('枠の子が違えば、その子はまだ使っていない扱い', ex.tacticsExUsesOf(s, 1, 'Golem') === 0);
  const fresh = ex.createTacticsExState();
  check('新しいランを作り直すと初期値に戻る', ex.tacticsExUsesOf(fresh, 1, 'Monol') === 0
    && !ex.isTacticsExCardLocked(fresh, T(1, 1)) && !ex.isTacticsExTurnUsed(fresh, T(1, 1)));
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
  check('併用できないEXは、カードを選んでいると使えない', !blocked.ok && /カード/.test(blocked.reason), blocked.reason);
  const g = use(s0, golem, 2, 'Golem', T(1, 3)).state;
  check('併用できないEXを使ったターンは、カードを選べない', ex.isTacticsExCardLocked(g, T(1, 3)));
  check('次のターンにはカードを選べる', !ex.isTacticsExCardLocked(g, T(1, 4)));
  check('次のWAVEの同じターン数でも解けている', !ex.isTacticsExCardLocked(g, T(2, 3)));
  const m = use(s0, monol, 1, 'Monol', T(1, 3), { selectedCount: 2 });
  check('併用できるEXは、カードを選んでいても使える', m.check.ok);
  check('併用できるEXを使っても、カードは選べる', !ex.isTacticsExCardLocked(m.state, T(1, 3)));
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
    && ex.isTacticsExCardLocked(both.state, T(1, 3)));
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
  let k = use(s0, kenshi, 0, 'KenshiMocchi', T(1, 2)).state;
  const on1 = ex.isTacticsExEffectActive(k, 0, 'KenshiMocchi', T(5, 1));
  const label1 = ex.tacticsExToggleLabel(kenshi, k, 0, 'KenshiMocchi');
  k = use(k, kenshi, 0, 'KenshiMocchi', T(5, 1)).state;
  const on2 = ex.isTacticsExEffectActive(k, 0, 'KenshiMocchi', T(5, 1));
  check('切り替え式は、WAVEをまたいでも続き、もう一度使うと戻る', on1 && !on2);
  check('切り替え式の「いま」の呼び名', ex.tacticsExToggleLabel(kenshi, s0, 0, 'KenshiMocchi') === '二刀流'
    && label1 === '片手持ち' && ex.tacticsExToggleLabel(kenshi, k, 0, 'KenshiMocchi') === '二刀流');
  const cond = ex.normalizeTacticsExDef({ id: 't', name: 't', maxUses: 5, withCards: true, duration: 'wave', conditions: ['notActive', 'nope'] });
  const sc = use(s0, cond, 0, 'X', T(1, 1)).state;
  const cc = ex.checkTacticsExUse({ def: cond, state: sc, slot: 0, monId: 'X', alive: true, now: T(1, 2) });
  check('使用条件(効果中は使えない)を定義から足せる。知らない条件名は無視する', !cc.ok && /効果/.test(cc.reason)
    && cond.conditions.length === 1, cc.reason);
}

// ---------- ⑧ 壊れた値 ----------
{
  let fine = true;
  for (const bad of [null, undefined, 1, 'x', [], { uses: 3, effects: null, lastUse: [], turnUsed: { wave: 'a' } }]) {
    try {
      const n = ex.normalizeTacticsExState(bad);
      fine = fine && typeof n.uses === 'object' && ex.tacticsExUsesOf(bad, 0, 'Monol') === 0
        && ex.isTacticsExCardLocked(bad, T(1, 1)) === false;
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
  check('手動の選択・スワイプ・ACTION・AUTOが、併用できないEXのターンを止める',
    /selectedCards\.length<cardLimit && !tacticsExCardLocked/.test(app)
    && /const dragAssignToSlot[\s\S]{0,200}if\(tacticsExCardLocked\)/.test(app)
    && /usedCardEntries\.length===0\) return;\s*\/\/[^\n]*\n\s*if \(tacticsExCardLocked\) return;/.test(app)
    && /if\(tacticsExCardLocked\) return passTacticsTurn\(\);/.test(app));
  check('緊急回復も、併用できないEXのターンは使えない', /const useEmergency = async \(\) => \{[\s\S]{0,200}if \(tacticsExCardLocked\) return;/.test(app)
    && /onClick=\{useEmergency\} disabled=\{[^}]*tacticsExCardLocked/.test(screen));
  // 距離枠のタップ: カードを置く途中ならカードの操作、そうでなければ詳細を開くだけ(使うのは詳細のボタン)
  const slotClick = screen.slice(screen.indexOf('if(pendingCard!=null && canAssign){'), screen.indexOf('}}', screen.indexOf('if(pendingCard!=null && canAssign){')));
  check('距離枠のタップは、カードの置き場所の操作を先に見る', slotClick.indexOf('setCardAssignments') < slotClick.indexOf('setExPanelSlot'));
  check('距離枠のタップはEXの詳細を開くだけで、発動しない', /setExPanelSlot\(i\)/.test(slotClick) && !/activateTacticsEx/.test(slotClick));
  check('発動は詳細パネルの「EXスキルを使用」からだけ', (screen.match(/activateTacticsEx\(/g) || []).length === 1
    && /data-tactics-ex-use disabled=\{!exPanel\.check\.ok\}/.test(screen));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
