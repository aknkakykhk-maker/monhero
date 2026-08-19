// 助手(ナビゲーター)システムを検証する。
//
// 助手は今後 HOME・神殿・マーケット・M/B管理・バトル・設定・ランキング・イベント案内・
// ギフト・ミッション・チュートリアルへ広げる想定なので、
// 「data/assistants.js を足すだけでどの画面でも同じ見た目で使える」形を保てているかを見る。
//
//   ① 助手の定義(名前・画像・色)がデータとして揃っている
//   ② 表情の画像が差し替え前提の書き方で、用意が無ければ既定の表情や絵文字へ落ちる
//   ③ 場面(scene)を足すだけでセリフ・表情・詳細を出せる
//   ③' 1画面につき5種類以上のセリフを持ち、毎回ランダムで、直前と同じものは出さない
//   ④ 吹き出しの共通コンポーネントが、どの画面からも同じ呼び出しで使える
//   ⑤ セリフや画像のパスを各画面のJSXへ直接書いていない
//   ⑥ data/assistants.js が読めなかったときも画面が落ちない
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- ① 助手の定義 ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,DEFAULT_ASSISTANT_ID,ASSISTANT_SCENES,ASSISTANT_EXPRESSIONS,findAssistant,findAssistantScene,assistantFaceImage,assistantFullImage,assistantExpressionName,assistantSceneLines,pickAssistantLine};`, ctx);
const a = ctx.__a;

check('助手が1人以上いる', Array.isArray(a.ASSISTANTS) && a.ASSISTANTS.length >= 1, `${a.ASSISTANTS.length}人`);
check('最初の助手は「みゅあ」', a.ASSISTANTS.some(x => x.id === 'mua' && x.name === 'みゅあ'));
check('既定の助手が実在する', !!a.ASSISTANTS.find(x => x.id === a.DEFAULT_ASSISTANT_ID));
check('idが重複していない', new Set(a.ASSISTANTS.map(x => x.id)).size === a.ASSISTANTS.length);
check('助手ごとに名前・役割・絵文字・色がそろっている',
  a.ASSISTANTS.every(x => x.id && x.name && x.role && x.emoji && /^#[0-9a-f]{6}$/i.test(x.accent)));
check('みゅあの役割表示は「助手」', a.findAssistant('mua').role === '助手', a.findAssistant('mua').role);
check('idから引ける', a.findAssistant('mua')?.name === 'みゅあ');
check('知らないidでも既定の助手に落ちる', a.findAssistant('nobody')?.id === a.DEFAULT_ASSISTANT_ID);

// --- ② 表情の画像 ---
const EXPECTED_EXPRESSIONS = ['normal','happy','wink','surprise','troubled','angry','crying','excited'];
check('表情が8種そろっている',
  EXPECTED_EXPRESSIONS.every(e => a.ASSISTANT_EXPRESSIONS.includes(e)), a.ASSISTANT_EXPRESSIONS.join(', '));
const mua = a.findAssistant('mua');
check('表情ごとの画像ファイルが実在する', EXPECTED_EXPRESSIONS.every(e => {
  const full = path.join(root, 'monster-hero', a.assistantFullImage(mua, e));
  const face = path.join(root, 'monster-hero', a.assistantFaceImage(mua, e));
  return fs.existsSync(full) && fs.existsSync(face);
}));
check('吹き出しには軽い顔アイコンを使う(元絵は重いため)', (() => {
  const full = fs.statSync(path.join(root, 'monster-hero', a.assistantFullImage(mua, 'normal'))).size;
  const face = fs.statSync(path.join(root, 'monster-hero', a.assistantFaceImage(mua, 'normal'))).size;
  return face * 4 < full;
})(), `顔 ${Math.round(fs.statSync(path.join(root, 'monster-hero', a.assistantFaceImage(mua, 'normal'))).size/1024)}KB`);
check('顔アイコンを作り直す手順がある', fs.existsSync(path.join(root, 'tools/make-assistant-faces.js'))
  && assistantsSrc.includes('tools/make-assistant-faces.js'));
check('知らない表情は既定(normal)へ落ちる',
  a.assistantExpressionName(mua, 'nope') === 'normal' && a.assistantExpressionName(mua, null) === 'normal'
    && a.assistantFaceImage(mua, 'nope').endsWith('myua_normal.PNG'));
check('画像が読めなかったときも既定の表情へ落とす',
  has('onError={()=>setSrc(src === fallback ? null : fallback)}'));
check('それでも駄目なら絵文字で出る', has('{who.emoji}</span>}'));
// 表情が分かるよう、顔は以前(72px)より2割ほど大きくしている
check('助手の顔は大きさと表情を指定して使い回せる', has('const AssistantFace = ({ who, size = 88, accent, expression = null })'));
check('顔は以前より大きい(既定88px・コンパクト48px)',
  has('const size = faceSize != null ? faceSize : (compact ? 48 : 88);'));
check('場面が変わったら表情を読み直す', has('useEffect(() => { setSrc(assistantFaceSrc(who, expression)); }, [who.id, expression]);'));
// キャッシュキー付きで読み込んでいること。読み込み完了をローディングのゲージへ伝える
// onload などの属性が付くことがあるので、タグの中身までは決め打ちしない
check('index.htmlがdata/assistants.jsを読み込んでいる', /<script src="data\/assistants\.js\?v=[0-9a-f]{12}"[^>]*><\/script>/.test(indexHtml));
check('助手は画像を持つbreeder.jsより後に読み込む',
  indexHtml.indexOf('data/breeder.js') < indexHtml.indexOf('data/assistants.js'));

// --- ③ 場面(scene) ---
check('場面がデータで管理されている', a.ASSISTANT_SCENES && typeof a.ASSISTANT_SCENES === 'object');
check('ヘルプのカテゴリ一覧の場面がある', !!a.findAssistantScene('helpTop'));
const SCENES = Object.entries(a.ASSISTANT_SCENES);
const allLines = (def) => [...(def.lines || []), ...Object.values(def.when || {}).flat()];
check('場面はセリフ・詳細を持てる',
  SCENES.every(([, s]) => Array.isArray(s.lines) && (!s.detail || Array.isArray(s.detail)) && (!s.help || s.help.includes('/'))));

// --- ③' 同じ画面で毎回ちがうことを話す ---
check('どの場面も5種類以上のセリフを持つ', (() => {
  const few = SCENES.filter(([, s]) => (s.lines || []).length < 5).map(([k, s]) => `${k}(${(s.lines || []).length})`);
  return few.length === 0;
})(), SCENES.filter(([, s]) => (s.lines || []).length < 5).map(([k, s]) => `${k}(${(s.lines || []).length})`).join(', '));
check('条件つきのセリフも5種類以上', (() => {
  const few = SCENES.flatMap(([k, s]) => Object.entries(s.when || {}).filter(([, l]) => l.length < 5).map(([c]) => `${k}/${c}`));
  return few.length === 0;
})());
check('セリフは { 表情, 本文 } の組で持つ',
  SCENES.every(([, s]) => allLines(s).every(l => l && typeof l.t === 'string' && l.t && typeof l.e === 'string')));
check('セリフの表情はすべて用意されている',
  SCENES.every(([, s]) => allLines(s).every(l => a.ASSISTANT_EXPRESSIONS.includes(l.e))));
check('同じ場面でセリフが重複していない',
  SCENES.every(([, s]) => new Set((s.lines || []).map(l => l.t)).size === (s.lines || []).length));
check('セリフは短く保つ(スマホで読める長さ)', (() => {
  const long = SCENES.flatMap(([k, s]) => allLines(s).filter(l => l.t.length > 45).map(l => `${k}:${l.t.length}字`));
  return long.length === 0;
})(), SCENES.flatMap(([k, s]) => allLines(s).filter(l => l.t.length > 45).map(l => `${k}:${l.t.length}字`)).join(', '));
// 実際に何度も引いて、直前と同じものが出ないこと・全種類がいつか出ることを確かめる
// セリフは親密度Lvで候補が変わるので、Lvごとに「そのLvで出るはずの全部が出るか」を見る
check('引くたびに変わり、直前と同じものは出ない', (() => {
  for (const [key] of SCENES) {
    for (let lv = 1; lv <= 5; lv++) {
      const usable = a.assistantSceneLines(key, null, lv);
      const seen = new Set(); let prev = null;
      // 「たまにしか出ない」セリフ(w が小さいもの)も拾えるよう、多めに引く
      for (let i = 0; i < 3000; i++) {
        const l = a.pickAssistantLine(key, null, lv);
        if (prev && l.t === prev) return false;
        prev = l.t; seen.add(l.t);
      }
      if (seen.size !== usable.length) return false;
    }
  }
  return true;
})());
// 条件つきのセリフ(初回・記録更新・受取可能など)は通常のセリフより優先する
check('条件つきのセリフは通常より優先される', (() => {
  for (const [key, def] of SCENES) {
    for (const cond of Object.keys(def.when || {})) {
      const normal = new Set((def.lines || []).map(l => l.t));
      for (let i = 0; i < 60; i++) if (normal.has(a.pickAssistantLine(key, cond).t)) return false;
    }
  }
  return true;
})());
check('知らない条件では通常のセリフに戻る',
  new Set((a.ASSISTANT_SCENES.home.lines || []).map(l => l.t)).has(a.pickAssistantLine('home', 'nope').t));
// 説明書のような言い回しにしない / 語尾がワンパターンにならない
check('説明書のような言い回しを使っていない', (() => {
  const bad = SCENES.flatMap(([k, s]) => allLines(s).filter(l => /してください|しましょう|できます。|します。/.test(l.t)).map(l => `${k}:${l.t}`));
  return bad.length === 0;
})(), SCENES.flatMap(([k, s]) => allLines(s).filter(l => /してください|しましょう|できます。|します。/.test(l.t)).map(l => `${k}`)).join(', '));
check('同じ場面で語尾が偏っていない', (() => {
  for (const [, def] of SCENES) {
    const ends = (def.lines || []).map(l => l.t.slice(-4));
    const counts = {};
    ends.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    if (Math.max(...Object.values(counts)) > Math.ceil(ends.length / 2)) return false;
  }
  return true;
})());
check('直近に出したセリフは候補から外す',
  assistantsSrc.includes('const ASSISTANT_RECENT = {}') && assistantsSrc.includes('const assistantRecentLimit ='));
check('直近3件が続けて出ない', (() => {
  for (const [key, def] of SCENES) {
    if ((def.lines || []).length < 5) continue;
    const history = [];
    for (let i = 0; i < 200; i++) {
      const t = a.pickAssistantLine(key, null).t;
      if (history.slice(0, 3).includes(t)) return false;
      history.unshift(t);
    }
  }
  return true;
})());
// 一人称は助手ごとに決める。みゅあは「あたし」、ききは「私」。
// 混ざると誰が話しているのか分からなくなるので、セリフ単位で見る
const linesOf = (whoId) => SCENES.flatMap(([k, def]) => [
  ...(def.lines || []), ...Object.values(def.when || {}).flat(),
].filter(l => (l.who || 'mua') === whoId).map(l => ({ k, t: l.t })));
check('みゅあの一人称は「あたし」', (() => {
  const bad = linesOf('mua').filter(l => /わたし|私/.test(l.t));
  return bad.length === 0;
})(), linesOf('mua').filter(l => /わたし|私/.test(l.t)).map(l => l.k).join(', '));
check('ききの一人称は「私」', (() => {
  const bad = linesOf('kiki').filter(l => /あたし/.test(l.t));
  return bad.length === 0;
})(), linesOf('kiki').filter(l => /あたし/.test(l.t)).map(l => l.k).join(', '));
check('ききらしい言葉の崩し方が入っている', (() => {
  const k = linesOf('kiki');
  const soft = k.filter(l => /でつ|まつ|おはゆ/.test(l.t)).length;
  // 全部を崩すと幼児語になってしまう。ほどよく混ざっている状態を保つ
  return soft >= 20 && soft < k.length;
})(), (() => { const k = linesOf('kiki'); return `${k.filter(l => /でつ|まつ|おはゆ/.test(l.t)).length} / ${k.length}件`; })());
check('ききのセリフはみゅあの語尾変換ではない', (() => {
  // みゅあの本文の「です/ます」を置換しただけの文が混ざっていないか
  const mua = new Set(linesOf('mua').map(l => l.t));
  const collide = linesOf('kiki').filter(l => mua.has(l.t.replace(/でつ/g, 'です').replace(/まつ/g, 'ます')));
  return collide.length === 0;
})());

// --- ⑦ 初回チュートリアルとデバッグ ---
check('チュートリアルの台本はデータで持つ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t={tour:ASSISTANT_TUTORIAL,battle:ASSISTANT_BATTLE_TUTORIAL_GUIDE};', c);
  const t = c.__t.tour;
  const battle = c.__t.battle;
  return Array.isArray(t) && t.length >= 6 && t.every(p => p.t && p.e)
    && /困ったらいつでもタップしてね/.test(t[t.length - 1].t)
    && Array.isArray(battle) && battle.length >= 4 && battle.every(p => p.t && p.e)
    && battle.some(p => p.offer === 'battleGuide') && battle.some(p => p.declined === true);
})());
check('チュートリアルの本文をJSXへ直接書いていない', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  return c.__t.every(p => !source.includes(p.t));
})());
// はじめての設定(名前・アイコン)から、そのまま村の案内へ続く1本の流れにする
check('はじめての設定のセリフもデータで持つ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__o={map:ASSISTANT_ONBOARDING,find:findAssistantOnboarding};', c);
  const { map, find } = c.__o;
  return map && ['intro','name','icon','ready'].every(k => map[k] && map[k].t && map[k].e)
    && /はじめまして/.test(map.intro.t)
    // 決まっているものに応じて、次にやることを教える
    && find(false, false) === map.intro && find(true, false) === map.name
    && find(false, true) === map.icon && find(true, true) === map.ready;
})());
// 初回はプロフィール画面で名前とアイコンを決める(専用画面は作らない)
check('初回は助手選択から始まり、プロフィールへ続く',
  has("setGameState(needsAssistantChoice ? 'ASSISTANT_SELECT' : (onboarded ? 'HOME' : 'PROFILE'));")
    && !has("gameState==='ONBOARDING'"));
check('プロフィールで名前・アイコン・決定がそろっている',
  has('findAssistantOnboarding(hasName,hasIcon,selectedAssistantId)') && has('なまえを決める') && has('アイコンを選ぶ')
    && has('けってい！</button>') && has('disabled={!ready} onClick={finishOnboarding}'));
check('決め終わるまでは戻るボタンを出さない',
  has('{/* はじめての設定が終わるまでは、まだ帰る場所(HOME)が無いので戻るボタンを出さない */}'));
check('名前とアイコンを決めたことを覚える',
  has('setOnboardingName(n); // はじめての設定で「名前が決まった」判定に使う')
    && has("setBreederIcon(m.id); setOnboardingIcon(m.id);"));
// デバッグの初回プレイ再生中だけは本物の既読を見ない(見ると、案内済みの人が再生したときに
// 村の案内だけ飛ばされてしまう)。通常プレイの経路はこれまでどおり
check('名前・アイコンを決めたらそのまま案内へ続く',
  has('const seenTutorial = onboardingPreview ? false : await storeGet(TUTORIAL_SEEN_KEY, false, false);')
    && has("if (seenTutorial !== true) { tutorialShownRef.current = true; setTutorialKind('tour'); setTutorialStep(0); }"));
check('案内の最初で決めた名前を呼ぶ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  return /\{name\}/.test(c.__t[0].t) && has("String(page.t).replace('{name}', breederName || 'あなた')");
})());
// 名前を決めるより前に、みゅあのあいさつを出す
check('あいさつの台本をデータで持つ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__i=ASSISTANT_INTRO;', c);
  const i = c.__i;
  return Array.isArray(i) && i.length >= 3 && i.every(p => p.t && p.e) && /はじめまして/.test(i[0].t);
})());
check('助手を選んだあとにあいさつが始まる',
  has("if (!onboarded && !needsAssistantChoice) { setTutorialKind('intro'); setTutorialStep(0); }"));
check('あいさつを読み終えるとプロフィールへ進む',
  has("if (kind === 'intro') { setGameState('PROFILE'); return; }")
    && has("{last?(intro?'名前を決める！':(page.offer==='battle'?'あとでやる':'はじめる！')):'つぎへ'}"));
// 独立した初回案内から同じバトル練習へ入れる(断ってもヘルプから始められる)
check('案内の最後からバトルの練習へ入れる',
  has("{page.offer==='battleGuide'&&(") && has("startBattleTutorial('HOME')")
    && has('チュートリアルを見る') && has('今は見ない'));
check('あいさつと村の案内は同じ吹き出しで台本だけ切り替える',
  has("const intro=tutorialKind==='intro';") && has("const battleGuide=tutorialKind==='battleGuide';") && has('const pages=(battleGuide'));
// 村の案内では、説明している場所だけをHOMEで明るく強調する。
// 施設だけでなく、ミッション/ギフト(reward)とみゅあの吹き出し(assistant)も指せるようにしている
const TUTORIAL_SPOTS = ['management', 'temple', 'market', 'battle', 'reward', 'settings', 'assistant'];
check('説明中の場所を光らせる',
  has("const spotClass = (name) => (tutorialSpot === name ? ' is-tutorial-spot' : '');")
    && TUTORIAL_SPOTS.every(n => has(`spotClass('${n}')`))
    && has('.is-tutorial-spot{z-index:90001}'));
check('どこを指しているかが分かるように矢印を出す',
  has("content:'▼'") && has('@keyframes mhTutorialArrow'));
check('施設以外(ミッション・ギフト・みゅあ・設定)も光る',
  has('.mh-home-mission.is-tutorial-spot,.mh-home-gift.is-tutorial-spot,.mh-home-assistant.is-tutorial-spot,.mh-home-settings.is-tutorial-spot{')
    && has('className={`mh-home-settings${spotClass(\'settings\')}`}'));
check('場所を指すページでは暗幕を薄くする',
  has("backgroundColor:page.spot?'rgba(2,6,23,0.74)':'rgba(2,6,23,0.92)'"));
check('光らせる場所もデータで持つ', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  const spots = c.__t.map(p => p.spot).filter(Boolean);
  return spots.length >= 6 && spots.every(x => TUTORIAL_SPOTS.includes(x));
})());
// 「そのページに無いもの(ランキング・ヘルプ)は、どこにあるかを言葉でも伝える」
check('ランキングとヘルプの場所を案内している', (() => {
  const c = {}; require('vm').createContext(c);
  require('vm').runInContext(assistantsSrc + ';globalThis.__t=ASSISTANT_TUTORIAL;', c);
  const text = c.__t.map(p => `${p.title || ''}${p.t || ''}`).join('\n');
  return /ランキング/.test(text) && /ヘルプ/.test(text);
})());
check('初回だけ出し、スキップもできる',
  has("const seen = await storeGet(TUTORIAL_SEEN_KEY, false, false);") && has('スキップ</button>')
    && has('const finishTutorial = async (remember = true)'));
check('チュートリアルの既読は新しい保存キーへ分ける',
  has("const TUTORIAL_SEEN_KEY = 'mh_tutorial_seen_v1';") && !/mh_onboarded[^\n]*tutorial/.test(source));
check('バトル練習の視聴済みと初回案内表示済みを分ける',
  has("const BATTLE_TUTORIAL_SEEN_KEY = 'mh_battle_tutorial_seen_v1';")
    && has("const BATTLE_TUTORIAL_GUIDE_SHOWN_KEY = 'mh_battle_tutorial_guide_shown_v1';")
    && has('storeGet(BATTLE_TUTORIAL_SEEN_KEY, false, false)')
    && has('storeGet(BATTLE_TUTORIAL_GUIDE_SHOWN_KEY, false, false)'));
// 「見た」と記録するのは、ふだんの入口(HOMEへ戻る練習)から最後まで通したときだけ。
// デバッグのお試し再生では書き換えない
check('バトル初回案内は表示時に記録し、完了時だけ練習を視聴済みにする',
  has('storeSet(BATTLE_TUTORIAL_GUIDE_SHOWN_KEY, true, false)')
    && has("if (completed && back === 'HOME') { try { await storeSet(BATTLE_TUTORIAL_SEEN_KEY, true, false); } catch {} }")
    && has('if(last) endBattleTutorial(true)') && has('endBattleTutorial(false)'));
check('デバッグはデバッグ設定からだけ開ける',
  has('💖 みゅあデバッグ') && source.indexOf('💖 みゅあデバッグ') > source.indexOf("gameState==='DEBUG_SETTINGS'"));
// デバッグから「名前入力のところ」を含めて通しで見られること。
// 見るだけなので、名前・アイコン・完了フラグのどれも保存しない
// 初回導線は「助手えらび」から通しで再生できる(以前は名前入力からだけだったのを統合した)
check('初回プレイを最初から通しで見られる',
  has('const startOnboardingPreview = () => {') && has('初回プレイを最初から再生')
    && has("setOnboardingName('');") && has("setOnboardingIcon(null);")
    && has("setGameState('ASSISTANT_SELECT');"));
// 「保存しない」は画面ごとの分岐ではなく、保存の入口(storeSet)を丸ごと止めて実現している。
// 画面ごとに書き分けると必ず書き忘れが出るため、鍵ひとつに集約した
// (詳しい動作確認は tools/onboarding-preview-check.js が実際に storeSet を動かして行う)
check('見るだけの表示では何も保存しない',
  has('  if (_storageWriteBlocked) return;')
    && /const startOnboardingPreview = \(\) => \{[\s\S]{0,900}setStorageWriteBlocked\(true\)/.test(source)
    && /const endOnboardingPreview = \(\) => \{[\s\S]{0,900}setStorageWriteBlocked\(false\)/.test(source));
check('見るだけをやめたら、名前も助手も元へ戻す',
  has('setBreederName(backup.name);') && has('setSelectedAssistantId(backup.assistantId);')
    && has('setKikiIntroSeenFlag(backup.kikiIntroSeen);'));
check('見るだけでは段階を保存する仕組みごと残していない', !has('moveOnboarding') && !has('onboardingStep'));
check('見るだけと分かる表示を出す', has('DEBUG・見るだけの表示です。名前もアイコンも保存されません'));
check('デバッグに必要な項目がそろっている',
  ['初回プレイを最初から再生','みゅあのあいさつだけ再生','村の案内だけ再生','全助手コメント確認','全表情確認','条件コメント確認','連打リアクション確認','初回状態へ戻す','バトル練習を未視聴へ戻す','初回案内を未表示へ戻す','バトル初回案内を再生']
    .every(label => source.includes(label)));
check('初回状態へ戻してもセーブデータは消さない',
  has('モンスターやダイヤなどのセーブデータは消えません') && has('await storeSet(TUTORIAL_SEEN_KEY,false,false);'));
check('話し方の決まりごとが書いてある',
  assistantsSrc.includes('一人称は「あたし」') && assistantsSrc.includes('語尾は'));
// JSX に置いた scene とデータ定義を結ぶ。直接指定・三項演算子に加え、scene に渡す
// 変数や小さな選択関数の同じ行にある候補も拾う（battleModeAssistantScene など）。
const sceneRefs = new Set();
const addQuotedSceneRefs = (text) => {
  for (const match of text.matchAll(/['"]([A-Za-z][A-Za-z0-9]*)['"]/g)) sceneRefs.add(match[1]);
};
for (const match of source.matchAll(/\bscene=(?:"([A-Za-z][A-Za-z0-9]*)"|\{([^}\n]+)\})/g)) {
  if (match[1]) sceneRefs.add(match[1]);
  if (!match[2]) continue;
  addQuotedSceneRefs(match[2]);
  for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    const declaration = source.match(new RegExp(`const\\s+${id[1]}\\s*=([^\\n;]+)`));
    if (declaration) addQuotedSceneRefs(declaration[1]);
  }
}
const missingSceneRefs = [...sceneRefs].filter(scene => !a.ASSISTANT_SCENES[scene]).sort();
if (missingSceneRefs.length === 0) {
  check('JSXで使うAssistant sceneがすべて定義されている', true, `${sceneRefs.size}場面`);
} else {
  for (const scene of missingSceneRefs) check(`Assistant scene “${scene}” が ASSISTANT_SCENES に存在する`, false,
    'game-system.jsx の scene 指定か data/assistants.js の定義を確認してください');
}

// scene の help は任意。ただし設定した参照はカテゴリ/トピックとも実在しなければならない。
const helpCtx = {};
vm.createContext(helpCtx);
vm.runInContext(`${helpSrc}\nglobalThis.__h={helpFindCategory,helpFindTopic};`, helpCtx);
const badSceneHelpRefs = [];
for (const [scene, def] of SCENES) {
  if (!def.help) continue;
  const parts = typeof def.help === 'string' ? def.help.split('/') : [];
  const categoryExists = parts.length === 2 && !!helpCtx.__h.helpFindCategory(parts[0]);
  const topicExists = categoryExists && !!helpCtx.__h.helpFindTopic(parts[0], parts[1]);
  if (!topicExists) badSceneHelpRefs.push({ scene, ref:def.help, categoryExists });
}
if (badSceneHelpRefs.length === 0) {
  check('Assistant sceneのhelp参照先がすべて実在する', true);
} else {
  for (const { scene, ref, categoryExists } of badSceneHelpRefs) {
    check(`Assistant scene “${scene}” の help参照 “${ref}” が存在する`, false,
      categoryExists ? 'data/help.js にトピックがありません' : 'data/help.js にカテゴリがありません');
  }
}
check('知らない場面キーではnullを返す', a.findAssistantScene('nope') === null);
check('場面の足しかたが手順として書いてある',
  assistantsSrc.includes('<AssistantBubble scene="home"/>') && assistantsSrc.includes('ASSISTANT_SCENES に場面を1つ足す'));

// --- ④ 共通コンポーネント ---
check('吹き出しは1つの共通コンポーネント', has('const AssistantBubble = ({ scene=null, assistantId=null, line=null, detail=null, helpRef=null, condition=null, expression=null, accent=null, faceSize=null, compact=false, defaultOpen=false })'));
check('選んだセリフの表情がそのまま顔に渡る', has('const face = expression || shown?.e || null;') && has('<AssistantFace who={who} size={size} accent={color} expression={face}/>'));
// 場面や条件が変わったときだけ選び直す。ほかの再描画でセリフが入れ替わると読めない
check('セリフは場面と条件が変わったときだけ選び直す',
  has('const pickKey = `${who.id}|${scene || \'\'}|${condition || \'\'}|${bond.level}`;') && has("if (pickedRef.current?.key !== pickKey) {"));
check('画面から条件を渡せる', has('condition=null') && /condition=\{[^}]+\}/.test(source));
// 顔をタップすると次のセリフへ。詳細は吹き出し側なので、操作が分かれている
check('顔をタップすると次のセリフへ送れる',
  has('const onFaceTap = () => {') && has("aria-label={`${who.name}にはなしかける`}") && has('if (typeof pickAssistantLine === \'function\') setTapped(pickAssistantLine(scene, condition, bond.level, who.id));'));
check('詳細は吹き出し側の操作のまま', has("onClick:()=>setOpen(true), 'aria-label':`${who.name}の説明を開く`"));
check('連打には専用のリアクションを出す',
  has('const spamLine = spam ? (spam.recovering ? spamRecover : spamLines[spam.step]) : null;')
    && assistantsSrc.includes('ASSISTANT_SPAM_LINES') && assistantsSrc.includes('ASSISTANT_SPAM_RECOVER'));
check('連打のあとは笑って元に戻す',
  (() => { const c = {}; require('vm').createContext(c);
    require('vm').runInContext(assistantsSrc + ';globalThis.__s={ASSISTANT_SPAM_LINES,ASSISTANT_SPAM_RECOVER};', c);
    const last = c.__s.ASSISTANT_SPAM_LINES[c.__s.ASSISTANT_SPAM_LINES.length - 1];
    return c.__s.ASSISTANT_SPAM_LINES.length >= 5 && last.last === true && /うそだよ/.test(c.__s.ASSISTANT_SPAM_RECOVER.t);
  })());
check('場面が変わったら送ったセリフも連打もリセットする',
  has('useEffect(() => { setTapped(null); setSpam(null); tapTimesRef.current = []; }, [pickKey]);'));
check('場面キーだけでも、直接指定でも呼べる',
  has('const sceneDef = assistantSceneById(scene);') && has("const text = assistantSpeakText(line || shown?.t || who.greeting || '', bond.name, bond.level, bond.callStyle, who.id);") && has('const paragraphs = detail || sceneDef?.detail || null;'));
check('詳細はヘルプ本文をそのまま出せる', has('const ref = helpRef || sceneDef?.help || null;') && has('renderHelpBlocks(topic.blocks, color)'));
check('吹き出し風の見た目(しっぽ付き)', has('{/* 吹き出しのしっぽ(左向き) */}') && has("borderRight:`9px solid ${color}`"));
check('タップで詳細が開く', has('onClick:()=>setOpen(true)') && has('タップで詳しく'));
check('詳細が無いときはボタンにしない', has("const Wrapper = hasDetail ? 'button' : 'div';"));
check('チュートリアル用に最初から開いた状態にもできる', has('defaultOpen=false') && has('useState(defaultOpen)'));
check('画面のテーマ色に合わせられる', has('const color = accent || who.accent || ASSISTANT_FALLBACK.accent;'));
check('ヘルプ画面で実際に使っている', has('<AssistantBubble key={`${helpCatId||\'\'}/${helpTopicId||\'\'}`}'));
// ヘルプ以外の画面へ広げるときに1行で済むこと(この形が崩れていないか)
check('ほかの画面は scene を渡すだけで使える', /const sceneDef = assistantSceneById\(scene\);/.test(source) && assistantsSrc.includes('その画面のJSXに1行置く'));

// --- ⑤ セリフや画像のパスを画面へ直接書いていない ---
// 直に書くと、直すときに全画面を探し回ることになる。data/assistants.js に集約しておく
check('セリフをJSXへ直接書いていない', (() => {
  const texts = SCENES.flatMap(([, s]) => allLines(s).map(l => l.t));
  return texts.every(t => !source.includes(t));
})());
check('画像のパスをJSXへ直接書いていない', !/images\/assistant\//.test(source));
// HOMEは絶対配置なので、置き場所をCSSで決める。施設のボタンやマスモンに
// かぶらないよう、プレイヤー情報と更新履歴の下の空きへ置く
check('HOMEの吹き出しは施設の上に重ならない場所へ置く',
  has('.mh-home-assistant{position:absolute;z-index:5;left:3%;width:70%;top:calc(72px + env(safe-area-inset-top));pointer-events:auto}')
    && has('@media(max-width:350px){.mh-home-assistant{width:62%}}')
    && has('<div className={`mh-home-assistant${spotClass(\'assistant\')}`}><AssistantBubble scene="home" condition={assistantBondUp?\'bondUp\':(masuMons.length===0?\'firstRun\':null)} compact/></div>'));
// 上のプロフィールカードに重ならないことを、CSSの数値から計算して確かめる。
// safe-area は帯にも吹き出しにも同じだけ効くので、比べるのは固定の px だけでよい
check('HOMEの吹き出しはプロフィールカードの下に来る', (() => {
  const num = (re) => { const m = source.match(re); return m ? Number(m[1]) : null; };
  const headerPad = num(/\.mh-home-status\{[^}]*padding:calc\((\d+)px \+ env\(safe-area-inset-top\)\)/);
  const avatar = num(/\.mh-home-avatar\{flex:0 0 (\d+)px/);
  const playerPad = num(/\.mh-home-player\{[^}]*padding:(\d+)px/);
  const assistantTop = num(/\.mh-home-assistant\{[^}]*top:calc\((\d+)px \+ env\(safe-area-inset-top\)\)/);
  if ([headerPad, avatar, playerPad, assistantTop].some(v => v == null)) return false;
  // プロフィールカードの下端 = 帯の上余白 + (アイコン + 上下の内側余白 + 枠線)
  const cardBottom = headerPad + avatar + playerPad * 2 + 2;
  return assistantTop >= cardBottom + 6;
})(), (() => {
  const num = (re) => { const m = source.match(re); return m ? Number(m[1]) : 0; };
  const cardBottom = num(/\.mh-home-status\{[^}]*padding:calc\((\d+)px \+ env/) + num(/\.mh-home-avatar\{flex:0 0 (\d+)px/) + num(/\.mh-home-player\{[^}]*padding:(\d+)px/) * 2 + 2;
  return `カード下端 ${cardBottom}px / 吹き出し ${num(/\.mh-home-assistant\{[^}]*top:calc\((\d+)px \+ env/)}px`;
})());
// はじめての案内で、光らせた場所が画面の下のほうにあるときは説明を上へ寄せる。
// バトルやミッションを説明しているときに、説明の吹き出しがその上に重なっていた
check('案内の吹き出しは光らせた場所と重ならない位置へ動く',
  has('const [tutorialPanelAtTop, setTutorialPanelAtTop] = useState(false);')
    && has("document.querySelectorAll('.is-tutorial-spot')")
    && has('setTutorialPanelAtTop(height > 0 && bottom > height * 0.5);')
    && has("${tutorialPanelAtTop?'justify-start':'justify-end'}"));
check('画面側は scene を渡すだけ', (() => {
  const calls = source.match(/<AssistantBubble[^/]*\/>/g) || [];
  // ヘルプ画面だけは項目ごとの文面を渡すので line/detail を使う
  const written = calls.filter(c => /line="|detail="/.test(c));
  return calls.length >= 20 && written.length === 0;
})(), `${(source.match(/<AssistantBubble[^/]*\/>/g) || []).length}か所`);

// --- ⑥ 読めなかったときの守り ---
check('data/assistants.jsが読めなくても落ちない',
  has("const ASSISTANT_LIST = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];")
    && has("const ASSISTANT_SCENE_MAP = (typeof ASSISTANT_SCENES !== 'undefined' && ASSISTANT_SCENES) || {};")
    && has("const ASSISTANT_FALLBACK = { id:'', name:'助手', image:null, emoji:'💬'"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
