const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// デバッグの「初回プレイを最初から再生」を確認する。
//
//   node tools/boot/onboarding-preview-check.js
//
// 見ているもの:
//   ① デバッグ設定から開けること・入口が1つに統合されていること
//   ② 再生の順番が本番と同じ(助手選択→あいさつ→プロフィール→村の案内→HOME)で、
//      画面も台本もデバッグ専用に作り直していないこと
//   ③ ★本体の storeSet をそのまま取り出して動かし、再生中は保存が1件も走らないこと
//   ④ 途中でやめても最後まで見ても、控えた値へ必ず戻ること
//   ⑤ iPhone縦画面で、上の帯と画面の見出しが重ならないこと
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
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

// ---- ① 入口 ----
check('デバッグ設定に「初回プレイを最初から再生」がある',
  has('data-debug-onboarding-preview') && has('初回プレイを最初から再生'));
check('入口はデバッグ設定の中だけ',
  source.indexOf('data-debug-onboarding-preview') > source.indexOf("gameState==='DEBUG_SETTINGS'"));
// 以前の「名前入力から通しで見る」は、この一連プレビューへ統合した(2つ並べない)
check('古い「名前入力から通しで見る」が残っていない', !has('名前入力から通しで見る'));
check('開始・終了の関数が1組だけある',
  (source.match(/const startOnboardingPreview = \(\) => \{/g) || []).length === 1
    && (source.match(/const endOnboardingPreview = \(\) => \{/g) || []).length === 1);

// ---- ② 再生の順番 ----
const startFn = slice('const startOnboardingPreview = () => {', '  // プレビューを終える');
check('再生は助手選択から始まる', /setGameState\('ASSISTANT_SELECT'\)/.test(startFn));
check('新規プレイヤーと同じ状態にしてから始める',
  /setAssistantChosen\(false\)/.test(startFn) && /setOnboarded\(false\)/.test(startFn)
    && /setOnboardingName\(''\)/.test(startFn) && /setOnboardingIcon\(null\)/.test(startFn));
check('きき加入の既読も未読に戻してから始める', /setKikiIntroSeenFlag\(false\)/.test(startFn));
// 助手を選ぶボタンは本番と同じもの。プレビュー用に別のボタンを作っていない
check('助手選択は本番と同じボタンをそのまま使う',
  has("onClick={()=>{chooseAssistant(who.id);markKikiIntroSeen();")
    && has("setGameState('PROFILE');setTutorialKind('intro');setTutorialStep(0);}}")
    && (source.match(/chooseAssistant\(who\.id\);markKikiIntroSeen\(\)/g) || []).length === 1);
check('助手を全員そのまま出している(一覧を使っている)', has('{ASSISTANT_LIST.map(who=>('));
// あいさつ→プロフィール→村の案内は既存の仕組み(tutorialKind)をそのまま使う
check('あいさつは既存の intro をそのまま使う', has("setTutorialKind('intro')"));
check('あいさつのあとはプロフィールへ進む(既存の処理のまま)',
  has("if (kind === 'intro') { setGameState('PROFILE'); return; }"));
check('村の案内は既存の tour をそのまま使う',
  /const seenTutorial = onboardingPreview \? false : await storeGet\(TUTORIAL_SEEN_KEY, false, false\);/.test(source)
    && has("if (seenTutorial !== true) { tutorialShownRef.current = true; setTutorialKind('tour'); setTutorialStep(0); }"));
// 完了処理を丸ごと別実装にしていないこと(以前はプレビュー専用の早期returnがあった)
const finishFn = slice('const finishOnboarding = async () => {', '  useEffect(()=>{');
check('完了処理にプレビュー専用の作り直しが無い',
  !/if \(onboardingPreview\) \{[\s\S]{0,400}setGameState\('HOME'\)/.test(finishFn));
check('完了処理は本番と同じ保存呼び出しをそのまま通す(鍵側で止める)',
  finishFn.includes("await storeSet('mh_onboarded',true,false);")
    && finishFn.includes("await storeSet('mh_breeder_name',name,false);"));

// ---- ③ ★保存が走らないこと。本体の storeSet をそのまま動かして確かめる ----
const storeSrc = [
  'const _memStore = {};',
  'const hasWinStorage = () => false;',
  'const hasLocalStorage = () => true;',
  'let __writes = [];',
  "const window = { localStorage: { setItem: (k,v) => { __writes.push(k); } } };",
  slice('let _storageWriteBlocked = false;', 'const storeList = async (prefix'),
  'module.exports = { storeSet, setStorageWriteBlocked, isStorageWriteBlocked, writes: () => __writes, reset: () => { __writes = []; }, mem: () => _memStore };',
].join('\n');
const mod = { exports: {} };
new Function('module', 'exports', storeSrc)(mod, mod.exports);
const S = mod.exports;

// 再生中に走りうる保存を、実際にこの順で呼んでみる
const KEYS_IN_FLOW = [
  'mh_assistant_selected_v1', 'mh_kiki_intro_seen_v1', 'mh_breeder_name', 'mh_breeder_icon',
  'mh_onboarded', 'mh_update_notice_seen_v1', 'mh_onboarding_step', 'mh_tutorial_seen_v1',
  'mh_assistant_bond_v1', 'mh_assistant_bond_kiki_v1', 'mh_assistant_call_style',
];
const runFlow = async () => { for (const k of KEYS_IN_FLOW) await S.storeSet(k, 'テスト値'); };

(async () => {
  // 鍵をかけていないときは、ふだんどおり保存される(止めっぱなしになっていないことの確認)
  S.reset(); S.setStorageWriteBlocked(false); await runFlow();
  check('ふだんは今までどおり保存される', S.writes().length === KEYS_IN_FLOW.length,
    `${S.writes().length}件 / ${KEYS_IN_FLOW.length}件`);

  // 再生中は1件も保存されない
  S.reset(); S.setStorageWriteBlocked(true); await runFlow();
  check('★再生中は保存が1件も走らない', S.writes().length === 0, `走った保存: ${S.writes().join(', ') || 'なし'}`);
  // メモリの控えにも残らないこと。上のrunFlowで書いた値と混ざらないよう、専用のキーで見る
  await S.storeSet('mh_preview_only_key', 'テスト値');
  check('再生中はメモリの控えにも書かない(終了後に古い値が読めない)',
    S.mem().mh_preview_only_key === undefined, String(S.mem().mh_preview_only_key));

  // 何度くり返しても増えない
  S.reset();
  for (let i = 0; i < 5; i++) await runFlow();
  check('何度くり返しても保存は走らない', S.writes().length === 0, `${S.writes().length}件`);

  // 終了すれば元どおり保存できる(鍵が開くこと)
  S.reset(); S.setStorageWriteBlocked(false); await S.storeSet('mh_gold', 100);
  check('再生を終えれば、また保存できるようになる', S.writes().length === 1 && S.mem().mh_gold === 100);

  // ---- ④ 戻し ----
  const endFn = slice('const endOnboardingPreview = () => {', '  // いま案内しているページが指している施設');
  const backupFn = slice('const startOnboardingPreview = () => {', '    setStorageWriteBlocked(true)');
  for (const [label, backupKey, restoreCall] of [
    ['名前', 'name: breederName', 'setBreederName(backup.name);'],
    ['アイコン', 'icon: breederIcon', 'setBreederIcon(backup.icon);'],
    ['選んでいる助手', 'assistantId: selectedAssistantIdRef.current', 'setSelectedAssistantId(backup.assistantId);'],
    ['助手を選び終えたか', 'assistantChosen', 'setAssistantChosen(backup.assistantChosen);'],
    ['初回設定を終えたか', 'onboarded', 'setOnboarded(backup.onboarded);'],
    ['きき加入の既読', 'kikiIntroSeen: kikiIntroSeenFlag', 'setKikiIntroSeenFlag(backup.kikiIntroSeen);'],
    ['村案内を出したか', 'tutorialShown: tutorialShownRef.current', 'tutorialShownRef.current = backup.tutorialShown;'],
  ]) {
    check(`${label}を控えて、終了時に戻す`, backupFn.includes(backupKey) && endFn.includes(restoreCall));
  }
  check('助手のrefも戻す(表示と中身がずれないように)', endFn.includes('selectedAssistantIdRef.current = backup.assistantId;'));
  check('終了時に鍵を開ける', /setStorageWriteBlocked\(false\)/.test(endFn));
  check('終了するとデバッグ設定へ戻る', /setGameState\('DEBUG_SETTINGS'\)/.test(endFn));

  // ---- ⑤ 途中でやめられること・見た目 ----
  check('再生中はどの画面でも終了できる帯を出す', has('data-onboarding-preview-bar'));
  check('帯の終了ボタンは endOnboardingPreview を呼ぶ',
    /data-onboarding-preview-bar[\s\S]{0,900}onClick=\{endOnboardingPreview\}/.test(source));
  // 案内(z:90000)に隠れると、あいさつ・村案内の最中に終了できなくなる
  check('帯は案内より前に出す(いつでも押せる)', /data-onboarding-preview-bar[\s\S]{0,400}zIndex:96000/.test(source));
  check('帯にタップしやすい大きさがある', /data-onboarding-preview-bar[\s\S]{0,900}min-h-\[32px\]/.test(source));
  check('帯はノッチぶんだけ下げる', /data-onboarding-preview-bar[\s\S]{0,400}env\(safe-area-inset-top\)/.test(source));
  // 帯と画面の見出しが重ならないよう、再生中だけ上を空ける
  check('助手選択の見出しが帯に隠れない',
    has("style={{paddingTop:onboardingPreview?'calc(2.75rem + env(safe-area-inset-top))':'env(safe-area-inset-top)'}}"));
  check('プロフィールの見出しが帯に隠れない',
    has("style={onboardingPreview?{paddingTop:'calc(2.25rem + env(safe-area-inset-top))'}:undefined}"));

  // ---- 既存の作りを壊していないか ----
  check('保存キーの名前を変えていない',
    has("const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';")
      && has("const ASSISTANT_BOND_KEY = 'mh_assistant_bond_v1';")
      && has("const TUTORIAL_SEEN_KEY = 'mh_tutorial_seen_v1';"));
  check('読み込み(storeGet)は止めていない(本物のデータを見て画面を組む)',
    !/const storeGet = async[\s\S]{0,200}_storageWriteBlocked/.test(source));
  check('鍵はプレビュー以外から触らない',
    (source.match(/setStorageWriteBlocked\(/g) || []).length === 2, // 開始1 + 終了1(定義は = なので数えない)
    `${(source.match(/setStorageWriteBlocked\(/g) || []).length}か所`);

  // ---- 更新履歴 ----
  const changelogSrc = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
  check('更新履歴に書いてある', changelogSrc.includes('初回プレイを最初から再生'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
