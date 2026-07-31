// はじめて遊ぶ人向けの流れ(名前とアイコンを決めるところ)を確認する。
//
// 初回はプロフィール画面が開き、みゅあの案内にしたがって名前とアイコンを決める。
// 両方そろってから完了フラグを立て、そのまま村の案内へ続く。
// 以前は専用画面(gameState==='ONBOARDING')だったが、プロフィール画面へまとめた。
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

// --- 入口 ---
check('初回はプロフィール画面から始まる', has("setGameState(onboarded ? 'HOME' : 'PROFILE');"));
check('専用のオンボーディング画面は残っていない',
  !has("gameState==='ONBOARDING'") && !has('moveOnboarding') && !has('onboardingStep'));
check('決め終わるまで戻るボタンを出さない',
  has('{/* はじめての設定が終わるまでは、まだ帰る場所(HOME)が無いので戻るボタンを出さない */}'));

// --- 名前とアイコン ---
check('名前とアイコンの両方を決められる', has('なまえを決める') && has('アイコンを選ぶ'));
check('決まったかどうかを覚えている',
  has('setOnboardingName(n); // はじめての設定で「名前が決まった」判定に使う')
    && has('setBreederIcon(m.id); setOnboardingIcon(m.id);'));
check('両方そろうまで決定できない',
  has('const ready=hasName&&hasIcon;') && has('disabled={!ready} onClick={finishOnboarding}'));
check('名前は10文字まで',
  has('const n = tempName.trim().substring(0, 10);') && has("(onboardingName||'').trim().slice(0,10)"));
check('空の名前では決定できない', has('if(!name||!onboardingIcon)return;'));

// --- 保存の順序 ---
// 名前とアイコンを保存し終えてからでないと完了フラグを立てない。
// 途中でやめても「設定済みなのに名前が無い」状態にならないようにするため
const nameSave = source.indexOf("storeSet('mh_breeder_name',name");
const iconSave = source.indexOf("storeSet('mh_breeder_icon',onboardingIcon");
const done = source.indexOf("storeSet('mh_onboarded',true");
check('完了フラグはプロフィールを保存したあとに立てる',
  nameSave >= 0 && iconSave > nameSave && done > iconSave);
check('保存済みかどうかを起動時に見て、続きから設定できる',
  has("setOnboardingName(hasSavedName ? savedName.trim().slice(0,10) : '');")
    && has('setOnboardingIcon(hasSavedIcon ? savedIcon : null);')
    && has('if (wasOnboarded && !(hasSavedName && hasSavedIcon)) wasOnboarded = false;'));

// --- 決定したあと ---
check('決定するとそのまま村の案内へ続く',
  has('const seenTutorial = await storeGet(TUTORIAL_SEEN_KEY, false, false);')
    && has('if (seenTutorial !== true) { tutorialShownRef.current = true; setTutorialStep(0); }'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
