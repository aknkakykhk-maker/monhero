const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 3人目の助手「ももすけ」が、みゅあ・ききと同じ土台へきちんと乗っているかを見る。
//
//   node tools/assistant/momosuke-check.js
//
// ここで見張りたいのは主に3つ。
//
//   ① 別の仕組みを作っていないこと
//      助手が増えるたびに専用の分岐を書き足すと、画面ごとに抜けが出る。
//      既存の ASSISTANTS / 仲良し度 / 呼び方 / 各SETS へ「1件足しただけ」になっているかを見る。
//   ② どの画面でも、ももすけ自身の言葉で話すこと
//      セリフを書き忘れた場面はみゅあのぶんへ落ちる仕組みがあるため、
//      画面は動いてしまい、抜けに気づけない。全場面で who==='momosuke' が引けるかを直接確かめる。
//   ③ 登場イベントの決めごと（呼び方・得手不得手・名称）が崩れていないこと
//      ここが崩れると、キャラクターとして別人になってしまう。
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const assistantsSrc = fs.readFileSync(path.join(web, 'data/assistants.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,ASSISTANT_EXPRESSIONS,ASSISTANT_SCENES,assistantSceneLines,assistantFaceImage,assistantFullImage,assistantBondLevelsOf,ASSISTANT_BOND_LEVELS,assistantCallStylesOf,assistantIntroPages,assistantTutorialPages,assistantOnboardingOf,assistantRhythmTutorialPages,assistantBattleGuidePages,ASSISTANT_MOMOSUKE_INTRO,ASSISTANT_MOMOSUKE_INTRO_CALLS,EVENT_REPLAYS,assistantSpeak};`, ctx);
const A = ctx.__a;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const momo = A.ASSISTANTS.find(a => a.id === 'momosuke');
const script = A.ASSISTANT_MOMOSUKE_INTRO || [];
const said = (who) => script.filter(l => l.who === who).map(l => l.t).join('\n');
const allText = script.map(l => l.t).join('\n');

// ---- ① 助手として登録されている ----
check('ASSISTANTSにmomosukeがいる', !!momo);
if (!momo) { console.log('\n以降の確認はできません'); process.exit(1); }
check('名前が「ももすけ」', momo.name === 'ももすけ', momo.name);
check('役割・画像の置き場が既存とそろっている',
  momo.role === '助手' && momo.imageDir === 'images/assistant' && momo.imagePrefix === 'momosuke');
check('表情は共通の8種を使う',
  momo.expressions === A.ASSISTANT_EXPRESSIONS && momo.expressions.length === 8, `${momo.expressions.length}種`);
check('既定の表情はnormal', momo.defaultExpression === 'normal');
check('絵文字と色が設定されている', !!momo.emoji && /^#[0-9a-f]{6}$/i.test(momo.accent || ''), `${momo.emoji} ${momo.accent}`);
check('助手選択の紹介文がある', !!momo.tagline && !!momo.intro && !!momo.greeting);
check('紹介文が小悪魔系だと分かる', /小悪魔/.test(momo.tagline + momo.intro), momo.tagline);

// ---- 画像8枚 + face8枚 ----
for (const kind of [['立ち絵', A.assistantFullImage], ['顔アイコン', A.assistantFaceImage]]) {
  const missing = A.ASSISTANT_EXPRESSIONS.filter(e => !fs.existsSync(path.join(web, kind[1](momo, e))));
  check(`${kind[0]}が8表情ぶんそろっている`, missing.length === 0, missing.length ? `無い: ${missing.join(',')}` : '8枚');
}
check('表情ごとに別の画像を使っている（使い回しでごまかしていない）', (() => {
  const seen = new Set(A.ASSISTANT_EXPRESSIONS.map(e => fs.readFileSync(path.join(web, A.assistantFaceImage(momo, e))).toString('base64').slice(0, 64)));
  return seen.size === 8;
})());

// ---- ② 仲良し度・呼び方は共通の仕組みに乗る ----
const levels = A.assistantBondLevelsOf('momosuke');
check('仲良し度の段数が他の助手と同じ', levels.length === A.ASSISTANT_BOND_LEVELS.length, `${levels.length}段`);
check('必要な仲良し度(need)を他の助手と変えていない',
  levels.every((l, i) => l.need === A.ASSISTANT_BOND_LEVELS[i].need));
check('段階ごとの呼び名・話し方がももすけ用に用意されている',
  levels.every(l => l.title && l.tone) && levels[0].title !== A.ASSISTANT_BOND_LEVELS[0].title);
check('はじめから呼び捨てで距離が近い', A.assistantSpeak('{name}', 'ますたー', 1, '', 'momosuke') === 'ますたー');
check('仲良くなると呼び方が変わる', A.assistantSpeak('{name}', 'ますたー', 5, '', 'momosuke') !== 'ますたー');
const callStyles = A.assistantCallStylesOf('momosuke');
check('呼び方のクイック入力がももすけ用に用意されている',
  Array.isArray(callStyles) && callStyles.length >= 2 && callStyles !== A.assistantCallStylesOf('mua'));

// ---- チュートリアル・案内の台本 ----
const sets = [
  ['はじめての設定', () => A.assistantOnboardingOf('momosuke'), () => A.assistantOnboardingOf('mua')],
  ['最初のあいさつ', () => A.assistantIntroPages('momosuke'), () => A.assistantIntroPages('mua')],
  ['村の案内', () => A.assistantTutorialPages('momosuke'), () => A.assistantTutorialPages('mua')],
  ['モンビーのチュートリアル', () => A.assistantRhythmTutorialPages('momosuke'), () => A.assistantRhythmTutorialPages('mua')],
  ['バトル練習の案内', () => A.assistantBattleGuidePages('momosuke'), () => A.assistantBattleGuidePages('mua')],
];
for (const [label, mine, base] of sets) {
  check(`${label}にももすけ用の言い回しがある`, mine() !== base());
}
// 骨組み(spot/help/順番)は変えないこと。ここがずれると光る場所と説明が食い違う
const skeleton = (pages) => pages.map(p => `${p.spot || ''}|${p.help || ''}`).join(',');
check('村の案内の骨組み(光る場所・ヘルプ参照)はみゅあと同じ',
  skeleton(A.assistantTutorialPages('momosuke')) === skeleton(A.assistantTutorialPages('mua')));
check('モンビーのチュートリアルの骨組みもみゅあと同じ',
  skeleton(A.assistantRhythmTutorialPages('momosuke')) === skeleton(A.assistantRhythmTutorialPages('mua')));

// ---- ② どの画面でもももすけ自身の言葉で話す ----
const scenes = Object.keys(A.ASSISTANT_SCENES);
const noLines = scenes.filter(s => !A.assistantSceneLines(s, null, 1, 'momosuke').some(l => l.who === 'momosuke'));
check(`全${scenes.length}場面にももすけのセリフがある（みゅあ・ききへ落ちていない）`,
  noLines.length === 0, noLines.length ? `無い場面: ${noLines.join(' ')}` : `${scenes.length}場面`);
const conditions = [
  ['speciesChallenge', ['species','hero','allies','confirm']], ['home', ['firstRun','bondUp']],
  ['resultWin', ['newRecord','firstWin','firstClear']], ['resultLose', ['firstLose']],
  ['market', ['lowGold']], ['missionsClaimable', ['allDone']],
];
const noCond = [];
for (const [scene, list] of conditions) for (const c of list) {
  if (!A.assistantSceneLines(scene, c, 1, 'momosuke').some(l => l.who === 'momosuke')) noCond.push(`${scene}/${c}`);
}
check('特別な場面(初勝利・自己ベスト更新など)にも専用のセリフがある',
  noCond.length === 0, noCond.length ? `無い: ${noCond.join(' ')}` : '12種');
check('使う表情が8種にかたよっていない', (() => {
  const used = new Set();
  for (const s of scenes) for (const l of A.assistantSceneLines(s, null, 1, 'momosuke')) if (l.who === 'momosuke') used.add(l.e);
  return used.size >= 6;
})());

// ---- ③ 登場イベント ----
check('登場イベントの台本がある', script.length > 0, `${script.length}行`);
check('3人とも登場する',
  ['mua','kiki','momosuke'].every(id => script.some(l => l.who === id)));
check('ももすけの発言がいちばん多い（主役の回）',
  said('momosuke').length > said('mua').length && said('momosuke').length > said('kiki').length);
check('「はじめまして」にしていない（3人は元々の知り合い）', !/はじめまして/.test(allText));
// 呼び方の固定
check('ももはみゅあを「みゅあ姉」と呼ぶ', /みゅあ姉/.test(said('momosuke')));
check('ももはききを「ききちゃん」と呼ぶ', /ききちゃん/.test(said('momosuke')));
check('ききはももを「ももさん」と呼ぶ', /ももさん/.test(said('kiki')));
check('みゅあはももを「もも」と呼ぶ（「ももさん」ではない）',
  /もも/.test(said('mua')) && !/ももさん/.test(said('mua')));
check('プレイヤーの呼び方(仲良し度で変わるもの)を会話に混ぜていない', !allText.includes('{name}'));
check('最後にプレイヤーへ「ますたー」と呼びかける', /ますたー/.test(script[script.length - 2].t + script[script.length - 1].t));
check('ふだんの呼び方を「ますたー」固定にしていない',
  A.assistantSpeak('{name}', 'テスト', 1, '', 'momosuke') === 'テスト');
// 音ゲーの得手不得手
check('みゅあは音ゲーが苦手だと分かる', /できるし|速い|あたしだけ/.test(said('mua')));
check('ききは音ゲーが得意だと分かる', /得意/.test(said('kiki')));
check('ももは上手いききを素直に認める', /認める|すご/.test(said('momosuke')));
check('ももはふつうにモンビーを楽しんでいる（専属ではない）', /余裕|楽し|付き合/.test(said('momosuke')));
// 名称
check('最初に正式名称「モンヒロビート」を出す', /モンヒロビート/.test(allText));
check('そのあと略称「モンビー」を使う', /モンビー/.test(allText));
check('正式名称のほうが先に出てくる', allText.indexOf('モンヒロビート') < allText.indexOf('モンビー'));
check('誤った名前「モンスターヒーロービート」を使っていない', !/モンスターヒーロービート/.test(allText));
// 流れ
check('「え？」「え？」の掛け合いがある', (() => {
  const i = script.findIndex(l => l.t === 'え？');
  return i >= 0 && script[i + 1] && script[i + 1].t === 'え？' && script[i].who !== script[i + 1].who;
})());
check('ももが居着く流れになっている', /いてもよくない|居着く|ここにいる/.test(allText));
check('表情が固定されていない', new Set(script.map(l => l.e)).size >= 5);

// ---- 回想への登録 ----
const replay = (A.EVENT_REPLAYS || []).find(e => e.id === 'momosuke_intro');
check('イベント回想に登録されている', !!replay);
check('回想のタイトルが分かりやすい', !!replay && /ももすけ登場/.test(replay.title), replay ? replay.title : '');
check('回想は同じ台本を参照している（二重に持っていない）', !!replay && replay.script === script);
check('本編で見ていなくても回想から見られる', !!replay && replay.alwaysUnlocked === true);
check('会話中の呼び名が回想でも出る', !!replay && !!replay.calls);

// ---- game-system.jsx 側の作り ----
check('専用の保存キーがある', gameSrc.includes("const MOMOSUKE_INTRO_SEEN_KEY = 'mh_momosuke_intro_seen_v1';"));
check('既存プレイヤーには1回だけ流す（新規には流さない）',
  gameSrc.includes('if (wasOnboarded && momosukeIntroSeen !== true && kikiIntroSeen === true) setMomosukeIntroStep(0);')
  && gameSrc.includes('else if (!wasOnboarded && momosukeIntroSeen !== true)'));
check('ききの会話と同時に出さない（きき→ももの順）',
  gameSrc.includes('kikiIntroStep==null&&momosukeIntroStep!=null'));
check('チュートリアル中にも出さない', gameSrc.includes('tutorialStep==null&&kikiIntroStep==null&&momosukeIntroStep!=null'));
check('アップデート通知と重ならない',
  gameSrc.includes("tutorialStep==null&&kikiIntroStep==null&&momosukeIntroStep==null&&updateGuideQueue.length>0"));
check('見終わったときの処理が1か所にまとまっている',
  (gameSrc.match(/const markMomosukeIntroSeen = useCallback/g) || []).length === 1);
check('回想を先に見ても解放される', gameSrc.includes("if(event&&event.id==='momosuke_intro') markMomosukeIntroSeen();"));
check('解放されるまで助手として選べない', gameSrc.includes("const locked=who.id==='momosuke'&&!momosukeIntroSeenFlag;"));
check('新規プレイヤーは助手選択の時点で選べる',
  gameSrc.includes('chooseAssistant(who.id);markKikiIntroSeen();markMomosukeIntroSeen();'));
check('選んでいる助手を勝手に変えていない',
  !/markMomosukeIntroSeen[^\n]*chooseAssistant\('momosuke'\)/.test(gameSrc)
  && !gameSrc.includes("setSelectedAssistantId('momosuke')"));
check('イベントBGMが指定されている', gameSrc.includes("momosuke_intro:'momosukeIntro'"));
check('BGMはドパガキリミックス', gameSrc.includes("momosukeIntro:'six_eternel_remix'"));
check('通常イベントと回想で同じBGM設定を使う',
  gameSrc.includes('EVENT_BGM_SCENES.momosuke_intro') && gameSrc.includes('EVENT_BGM_SCENES[eventReplay.id]'));
check('イベントが終われば元の画面のBGMへ戻る', /const eventBgmScene[\s\S]{0,400}?: null\)/.test(gameSrc));
check('会話に出てくる助手だけを並べる（無関係な助手を映さない）',
  (gameSrc.match(/const cast=ASSISTANT_LIST\.filter\(who=>script\.some\(l=>l\.who===who\.id\)\);/g) || []).length === 3);

// ---- マーケット ----
const breederSrc = fs.readFileSync(path.join(web, 'data/breeder.js'), 'utf8');
check('マーケットのアイコンは顔画像を使い回している（複製していない）',
  breederSrc.includes('images/assistant/face/momosuke_${key}.PNG'));
check('マーケット用に別の画像を作っていない',
  !fs.existsSync(path.join(web, 'images/breeder-icons/momosuke.PNG')));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
