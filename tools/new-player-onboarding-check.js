// はじめて遊ぶ人向けの流れ(助手を選び、名前とアイコンを決めるところ)を確認する。
//
// 正式な流れ:
//   助手をえらぶ → 選んだ助手のあいさつ → プロフィール(名前・アイコン) → 村の案内
//
// 助手を選ぶ前に、みゅあ固定のあいさつを出してはいけない
// (まだ選んでいない助手が勝手に話しかけることになるため)。
// 既存プレイヤーには助手選択を出さず、これまでどおり「みゅあ」のまま進める。
// 以前は専用画面(gameState==='ONBOARDING')だったが、プロフィール画面へまとめた。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 入口: 助手選択がいちばん最初に来る ---
check('はじめての人は助手選択から始まる',
  has('const needsAssistantChoice = !onboarded && !assistantChosen;')
    && has("setGameState(needsAssistantChoice ? 'ASSISTANT_SELECT' : (onboarded ? 'HOME' : 'PROFILE'));"));
check('助手を選ぶ前にあいさつを出さない',
  has("if (!onboarded && !needsAssistantChoice) { setTutorialKind('intro'); setTutorialStep(0); }"));
check('助手を選ぶとあいさつ→プロフィールへ続く',
  has("onClick={()=>{chooseAssistant(who.id);setGameState('PROFILE');setTutorialKind('intro');setTutorialStep(0);}}")
    && has("if (kind === 'intro') { setGameState('PROFILE'); return; }"));
check('中断して開き直しても助手選択から再開する',
  has("setGameState(savedAssistant ? 'PROFILE' : 'ASSISTANT_SELECT');"));
check('助手選択の画面がある',
  has("{gameState==='ASSISTANT_SELECT'&&(") && has('助手をえらぶ'));
check('助手選択でも顔・名前・紹介を見て選べる',
  has('<AssistantFace who={who} size={88} accent={who.accent} expression="happy"/>')
    && has('{who.tagline||\'\'}') && has('{who.intro||\'\'}'));
check('助手選択はヘルプの対象画面になっている', /ASSISTANT_SELECT:\s*'tips\/assistant'/.test(helpSrc));

// --- 既存プレイヤーの互換 ---
check('既存プレイヤーには助手選択を出さない',
  has('setAssistantChosen(!!savedAssistant || wasOnboarded);'));
check('助手の保存が無ければ「みゅあ」を選んでいる扱いにする',
  has("const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';")
    && has('const activeAssistant = normalizeAssistantId(savedAssistant);'));
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

// --- デバッグの「見るだけ」表示 ---
// onboarded が true のままだと初回のまとまりが出ず、ふつうのプロフィールが開くだけになる
check('見るだけの表示でも「はじめての設定」を出す',
  has('{(!onboarded||onboardingPreview)&&(()=>{'));
check('見るだけの表示でも戻るボタンを出さない',
  has('{(onboarded&&!onboardingPreview)'));
check('見るだけでは名前もアイコンも保存しない',
  has("if (!onboardingPreview) await storeSet('mh_breeder_name', n, false);")
    && has("if(!onboardingPreview) storeSet('mh_breeder_icon', m.id, false);"));

// --- 決定したあと ---
check('決定するとそのまま村の案内へ続く',
  has('const seenTutorial = await storeGet(TUTORIAL_SEEN_KEY, false, false);')
    && has("if (seenTutorial !== true) { tutorialShownRef.current = true; setTutorialKind('tour'); setTutorialStep(0); }"));

// --- 案内は「選んだ助手」が担当する ---
// ここが固定のままだと、ききを選んだのにみゅあが案内してしまう
check('あいさつ・村の案内・はじめての設定は選んだ助手のもの',
  has('assistantIntroPages(selectedAssistantId)')
    && has('assistantTutorialPages(selectedAssistantId)')
    && has('findAssistantOnboarding(hasName,hasIcon,selectedAssistantId)'));
check('台本を固定の助手のものへ書き戻していない',
  !/\(\(typeof ASSISTANT_INTRO!=='undefined'/.test(source)
    && !/\(\(typeof ASSISTANT_TUTORIAL!=='undefined'/.test(source));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
