const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 助手との仲良し度でもらえる飾り枠を確かめる。2026-09-16。
//
//   node tools/ranking/profile-frame-unlock-check.js
//
// 【この仕組みの要点】
//   released … **描いてよいか**。false のものは選択画面にも出ず、
//               ランキングで他人の記録に入っていても描かれない
//   unlock   … **自分が選べるか**。もらうまで選べないだけで、描くのは自由
//   ★ここを一緒にすると「解放した人の枠が他人の画面で消える」。分かれていることを見張る。
//
// 配る・選べる・次に何がもらえるか、の判定は data/breeder.js の関数が正本なので、
// ここではその関数を実際に動かして確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(TOOLS_DIR, '..');
const breederSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/breeder.js'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const profileScreen = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/56-screen-profile.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(ROOT, 'monster-hero/game-system.compiled.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- フレームの節だけを切り出して動かす(breeder.js は絵のデータも抱えているので全部は読まない) ---
const start = breederSrc.indexOf('const PROFILE_FRAME_NONE_ID');
const end = breederSrc.indexOf('// ==================== ブリーダーの教え', start);
const block = end > start ? breederSrc.slice(start, end) : breederSrc.slice(start);
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(`${block}
globalThis.__f = { PROFILE_FRAMES, releasedProfileFrames, profileFrameById, normalizeProfileFrameId,
  profileFrameOwned, profileFrameUnlock, profileFramesForAssistant, profileFramesEarnedAt,
  nextProfileFrameForAssistant, normalizeOwnedProfileFrames, PROFILE_FRAME_OWNED_KEY, PROFILE_FRAME_NONE_ID };`, ctx);
const F = ctx.__f;

// --- ① 助手ごとに3枚、Lv2/5/7 ---
const WANT_LEVELS = [2, 5, 7];
const assistantIds = [...new Set(F.PROFILE_FRAMES.map(f => (F.profileFrameUnlock(f) || {}).assistantId).filter(Boolean))];
check('もらえる枠を持つ助手がいる', assistantIds.length >= 3, assistantIds.join(', '));
for (const who of assistantIds) {
  const frames = F.profileFramesForAssistant(who);
  check(`${who}: 3枚ある`, frames.length === 3, `${frames.length}枚`);
  check(`${who}: もらえるLvが ${WANT_LEVELS.join('/')}`,
    frames.map(f => F.profileFrameUnlock(f).bondLevel).join('/') === WANT_LEVELS.join('/'),
    frames.map(f => 'Lv' + F.profileFrameUnlock(f).bondLevel).join(' '));
  check(`${who}: Lvの小さい順に並ぶ`, frames.every((f, i) => i === 0
    || F.profileFrameUnlock(f).bondLevel > F.profileFrameUnlock(frames[i - 1]).bondLevel));
}
// 絵が実在すること(パスの綴り間違いは公開してから気づくため)
const missing = F.PROFILE_FRAMES.filter(f => f.kind === 'image' && f.src)
  .map(f => f.src.split('?')[0])
  .filter(src => !fs.existsSync(path.join(ROOT, 'monster-hero', src)));
check('画像フレームの絵がすべて実在する', missing.length === 0, missing.join(', '));

// --- ② released と unlock が別物であること(いちばん大事) ---
const unlockable = F.PROFILE_FRAMES.filter(f => F.profileFrameUnlock(f));
check('もらえる枠はすべて released:true(他人の画面でも描かれる)',
  unlockable.every(f => f.released === true),
  unlockable.filter(f => f.released !== true).map(f => f.id).join(', '));
check('もらっていない枠でも、ランキングでは描いてよい',
  unlockable.every(f => F.normalizeProfileFrameId(f.id) === f.id));
check('もらっていない枠は自分では選べない',
  unlockable.every(f => F.profileFrameOwned(f.id, []) === false));
check('もらえば選べる',
  unlockable.every(f => F.profileFrameOwned(f.id, [f.id]) === true));
check('条件の無い枠(色)は最初から選べる',
  F.releasedProfileFrames().filter(f => !F.profileFrameUnlock(f)).every(f => F.profileFrameOwned(f.id, []) === true));
check('未公開の枠は描かないし選べない',
  F.PROFILE_FRAMES.filter(f => f.released !== true)
    .every(f => F.normalizeProfileFrameId(f.id) === F.PROFILE_FRAME_NONE_ID && F.profileFrameOwned(f.id, []) === false));

// --- ③ 配り方 ---
const who0 = assistantIds[0];
check('Lv1では何ももらえない', F.profileFramesEarnedAt(who0, 1, []).length === 0);
check('Lv2で1枚もらえる', F.profileFramesEarnedAt(who0, 2, []).length === 1);
check('間を飛ばして上がっても取りこぼさない(Lv7で3枚)',
  F.profileFramesEarnedAt(who0, 7, []).length === 3);
check('もう持っているものは配り直さない',
  F.profileFramesEarnedAt(who0, 7, F.profileFramesForAssistant(who0).map(f => f.id)).length === 0);
check('ほかの助手の枠は配らない',
  F.profileFramesEarnedAt(who0, 20, []).every(id => F.profileFrameUnlock(F.profileFrameById(id)).assistantId === who0));
check('壊れたLvでも落ちない', F.profileFramesEarnedAt(who0, NaN, []).length === 0 && F.profileFramesEarnedAt(who0, null, null).length === 0);
check('保存値が壊れていても配れる', F.profileFramesEarnedAt(who0, 2, 'こわれた値').length === 1);

// --- ④ 次にもらえるもの ---
check('Lv1のときは1枚目が次', (F.nextProfileFrameForAssistant(who0, 1, []) || {}).id === F.profileFramesForAssistant(who0)[0].id);
check('Lv2で1枚持っていれば2枚目が次',
  (F.nextProfileFrameForAssistant(who0, 2, [F.profileFramesForAssistant(who0)[0].id]) || {}).id
  === F.profileFramesForAssistant(who0)[1].id);
check('全部持っていれば次は無い',
  F.nextProfileFrameForAssistant(who0, 20, F.profileFramesForAssistant(who0).map(f => f.id)) === null);

// --- ⑤ 保存 ---
check('保存キーは新設のみ(既存の mh_* を使い回さない)',
  F.PROFILE_FRAME_OWNED_KEY === 'mh_profile_frame_owned_v1');
check('壊れた保存値でも必ず配列になる',
  Array.isArray(F.normalizeOwnedProfileFrames(null)) && Array.isArray(F.normalizeOwnedProfileFrames('x'))
  && F.normalizeOwnedProfileFrames(['a', 'a', '', 1]).join(',') === 'a');

// --- ⑥ アプリ側の結線 ---
check('仲良し度が上がったら配る', /if \(after > before\) grantProfileFrames\(id, after\);/.test(app));
check('選んでいない助手のぶんも配る(アシストカード経由で増えるため)',
  /const addAssistantBondFor[\s\S]{0,900}grantProfileFrames\(id, after\)/.test(app));
check('起動時に、すでに条件を満たしているぶんを配る',
  /profileFramesEarnedAt\(who\.id, level, catchUp\)/.test(app));
check('一度もらったら外さない(空にして保存する処理が無い)',
  !/setOwnedProfileFrames\(\[\]\)/.test(app)
  && !/storeSet\(PROFILE_FRAME_OWNED_KEY, *\[\]/.test(app));
check('持っていない枠は選べない',
  /const selectProfileFrame[\s\S]{0,400}if \(!profileFrameOwned\(next, ownedProfileFramesRef\.current\)\) return;/.test(app));
check('選択画面に未所持の枠も並べる(絵を見せて鍵を付ける)',
  app.includes("data-profile-frame-locked={owned?'no':'yes'}") && /<Lock size=\{14\}/.test(app));
check('鍵を押すと条件といまの進み具合が出る',
  app.includes('data-profile-frame-locked-info') && /でもらえます/.test(app) && /いまは Lv/.test(app));
check('プロフィールに「次にもらえる飾り枠」を出す',
  /data-assistant-next-frame=/.test(profileScreen) && /nextProfileFrameForAssistant/.test(profileScreen));

// --- ⑦ もらったときのお知らせ ---
check('助手が知らせる案内がある', assistantsSrc.includes("id: 'unlock_profile_frame_v1'"));
check('案内はプロフィール画面で出す', /id: 'unlock_profile_frame_v1'[\s\S]{0,200}scene: 'profile'/.test(assistantsSrc));
check('もらうたびに出し直す(1回きりにしない)',
  app.includes('const assistantUnlockSeenForNotices') && app.includes('PROFILE_FRAME_NOTICE_ID'));
check('知らせ済みは枠ごとに覚える', app.includes("const PROFILE_FRAME_NOTICE_KEY = 'mh_profile_frame_notice_v1';"));
check('本文へLvを直接書かない(データから作る)',
  /id: 'unlock_profile_frame_v1'[\s\S]{0,1400}newProfileFrameNames/.test(assistantsSrc));

// --- ⑧ ヘルプ ---
const help = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/20-market-notices-help.jsx'), 'utf8');
check('ヘルプの表がもらう条件を実データから作る',
  /case 'profileFrames':[\s\S]{0,700}profileFrameUnlock/.test(help)
  && /case 'profileFrames':[\s\S]{0,700}仲良し度 Lv/.test(help));

// --- ⑨ 配信用JSにも入っている ---
// ★保存キーと案内の文面は data/*.js 側にあり、そちらは配信用JSへは入らない(別ファイルのまま配る)。
//   ここで見るのは「アプリ側の結線が配信用JSへ届いているか」(build忘れの検出)
check('配信用JSにも入っている(build忘れではない)',
  compiled.includes('grantProfileFrames') && compiled.includes('mh_profile_frame_notice_v1'),
  `grantProfileFrames=${compiled.includes('grantProfileFrames')} / notice=${compiled.includes('mh_profile_frame_notice_v1')}`);
check('保存キーと案内の文面はデータ側にある',
  breederSrc.includes("'mh_profile_frame_owned_v1'") && assistantsSrc.includes("'unlock_profile_frame_v1'"));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
