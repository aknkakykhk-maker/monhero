// AUTO設定に足した「モンビー中に回すクイック周回」の事前設定
// (docs/spec/QUICK_RHYTHM_LINK.md PR5)を確かめる。
//
//   node tools/run/auto-quick-run-settings-check.js
//
// いちばん大事なのは**既存のセーブデータを壊さないこと**(CLAUDE.md ⑦)。
//   ・保存キーは mh_auto_settings_v1 のまま。新しいキーを作らない
//   ・quickRun の項目が無い既存の保存値でも、既定値(未設定)で補われる
//   ・壊れた値・候補外の勇者モン・知らない難易度は、勝手に補完せず未設定へ落とす
// 正規化の本体を vm で実際に動かして見る(文言の一致ではなく振る舞いで見る)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/18-points-and-auto.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 保存キーと既定値 ----
check('保存キーは mh_auto_settings_v1 のまま(新しいキーを作らない)',
  src.includes("const AUTO_SETTINGS_KEY = 'mh_auto_settings_v1';"));
check('既定値に quickRun がある',
  /quickRun:\{\s*heroRosterEntry:null,\s*distance:null,\s*difficulty:null\s*\}/.test(src));

// ---- 正規化と判定を実際に動かす ----
const slice = (from, to) => {
  const i = src.indexOf(from);
  const j = src.indexOf(to, i);
  if (i < 0 || j < 0) throw new Error(`切り出せません: ${from}`);
  return src.slice(i, j);
};
const box = {};
vm.createContext(box);
vm.runInContext([
  slice("const AUTO_SETTINGS_KEY", '// AUTOの1ターンぶんの選択だけを組み立てる'),
  'globalThis.__n = normalizeAutoSettings; globalThis.__c = autoQuickRunConfigured; globalThis.__d = DEFAULT_AUTO_SETTINGS;',
].join('\n'), box);
const normalize = box.__n;
const configured = box.__c;

const ROSTER = ['Suezo', 'Golem', 'masu:12'];
const DIFFS = ['Beginner', 'Easy', 'Normal', 'Hard'];

// 既存ユーザー(quickRun を保存していない)
const old = normalize({ strategy:'offense', allies:[{ rosterEntry:'Suezo', slot:1 }, {}, {}] }, ROSTER, DIFFS);
check('quickRun の無い既存の保存値でも落ちない', !!old.quickRun);
check('その場合は未設定になる（勝手に決めない）',
  old.quickRun.heroRosterEntry === null && old.quickRun.distance === null && old.quickRun.difficulty === null,
  JSON.stringify(old.quickRun));
check('既存の項目は保たれる', old.strategy === 'offense' && old.allies[0].rosterEntry === 'Suezo' && old.allies[0].slot === 1);

// 正しく設定したとき
const set = normalize({ quickRun:{ heroRosterEntry:'Golem', distance:0, difficulty:'Normal' } }, ROSTER, DIFFS);
check('正しい設定はそのまま残る',
  set.quickRun.heroRosterEntry === 'Golem' && set.quickRun.distance === 0 && set.quickRun.difficulty === 'Normal',
  JSON.stringify(set.quickRun));
check('マスモンの個体も勇者モンに選べる',
  normalize({ quickRun:{ heroRosterEntry:'masu:12', distance:3, difficulty:'Hard' } }, ROSTER, DIFFS).quickRun.heroRosterEntry === 'masu:12');

// 壊れた値・候補外
const broken = normalize({ quickRun:{ heroRosterEntry:'Unknown', distance:9, difficulty:'NoSuchDifficulty' } }, ROSTER, DIFFS);
check('候補にいない勇者モンは未設定へ落とす', broken.quickRun.heroRosterEntry === null);
check('範囲外の距離は未設定へ落とす', broken.quickRun.distance === null);
check('知らない難易度は未設定へ落とす', broken.quickRun.difficulty === null);
check('quickRun が配列や文字列でも落ちない',
  normalize({ quickRun:['x'] }, ROSTER, DIFFS).quickRun.heroRosterEntry === null
  && normalize({ quickRun:'x' }, ROSTER, DIFFS).quickRun.distance === null);
check('候補・難易度の一覧を渡さないときは値を残す（読み込み前に消さない）',
  normalize({ quickRun:{ heroRosterEntry:'Suezo', distance:2, difficulty:'Legend' } }).quickRun.difficulty === 'Legend');

// 「使える／使えない」の判定
check('3つそろって初めて使える', configured(set) === true);
check('1つでも欠けたら使えない',
  configured(old) === false
  && configured(normalize({ quickRun:{ heroRosterEntry:'Golem', distance:0 } }, ROSTER, DIFFS)) === false
  && configured(normalize({ quickRun:{ heroRosterEntry:'Golem', difficulty:'Normal' } }, ROSTER, DIFFS)) === false
  && configured(normalize({ quickRun:{ distance:0, difficulty:'Normal' } }, ROSTER, DIFFS)) === false);
check('距離0（零距離）を「未設定」と間違えない', configured(set) === true && set.quickRun.distance === 0);
check('壊れた入力でも判定は false', configured(null) === false && configured({}) === false && configured({ quickRun:'x' }) === false);

// ---- 本体の使いかた ----
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
check('読み込み時の正規化へ難易度の一覧を渡している',
  /normalizeAutoSettings\(await storeGet\(AUTO_SETTINGS_KEY[^)]*\)[^)]*, activeMonsterRoster, Object\.keys\(QUICK_DIFFICULTY_SETTINGS\)\)/.test(app));
// クイックは通常の9段階だけでなく EXTREME〜ULTIMATE も選べる。
// DIFFICULTY_SETTINGS だけを見ていると Legend までしか出ない
// (2026-09-06・ユーザー指摘「難易度がレジェンドまでしか出てない」)
check('難易度の顔ぶれはバトルの難易度選択と同じ表から取る',
  app.includes('const AUTO_QUICK_DIFFICULTY_IDS = Object.keys(QUICK_DIFFICULTY_SETTINGS);')
  && app.includes('{Object.entries(QUICK_DIFFICULTY_SETTINGS).map(([key,setting])=>{const unlocked=isQuickDifficultyUnlocked('));
// 「DIFFICULTY_SETTINGS を見ている箇所」はランキングの集計などにもあるので、
// ここで見るのはAUTO設定に関わる2か所だけに絞る
check('AUTO設定が通常の難易度表だけを見ている形へ戻っていない',
  !app.includes('const AUTO_QUICK_DIFFICULTY_IDS = Object.keys(DIFFICULTY_SETTINGS);')
  && !app.includes('activeMonsterRoster, Object.keys(DIFFICULTY_SETTINGS))')
  && !app.includes('Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=>{const unlocked='));
check('未解放の難易度は選べないだけで一覧には出す',
  /QUICK_DIFFICULTY_SETTINGS\)\.map\(\(\[key,setting\]\)=>\{const unlocked=[\s\S]{0,220}?disabled=\{!unlocked\}[\s\S]{0,60}?未解放/.test(app));
check('事前設定から周回テンプレートを作れる', app.includes('const repeatTemplateFromAutoSettings ='));
check('未解放の難易度では始めない',
  /repeatTemplateFromAutoSettings[\s\S]{0,700}?isQuickDifficultyUnlocked\(quick\.difficulty/.test(app));
check('いなくなった勇者モンでは始めない',
  /repeatTemplateFromAutoSettings[\s\S]{0,900}?resolveRosterEntryToMon\(quick\.heroRosterEntry\)/.test(app));
check('作るテンプレートはクイックの通常難易度（極限を混ぜない）',
  /repeatTemplateFromAutoSettings[\s\S]{0,1200}?runMode:BATTLE_MODE_QUICK[\s\S]{0,400}?extremeRun:false/.test(app));
// 1周目に自分で組んだ編成のほうを優先する。設定で勝手に置き換えない
check('周回テンプレートがあればそちらを優先する',
  app.includes('const repeatTemplateForNewRun = () => repeatRunTemplateRef.current || repeatTemplateFromAutoSettings();'));
check('∞周回の次の周もその入口を通る',
  app.includes('startRunFromRepeatTemplate(repeatTemplateForNewRun())'));
check('AUTO設定の画面に項目がある',
  app.includes('3. モンビー中に回すクイック周回') && app.includes('auto-quick-hero') && app.includes('auto-quick-difficulty'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
