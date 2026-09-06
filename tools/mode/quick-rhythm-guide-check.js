// 公開時に出す「画面のなかでの使い方案内」(docs/spec/QUICK_RHYTHM_LINK.md PR8)を見張る。
//
//   node tools/mode/quick-rhythm-guide-check.js
//
// ヘルプと更新履歴は探しに行った人しか読まない。この連携は
// 「別の画面へ移る」「裏で進む」「演奏中だけ止まる」という遊んでいるだけでは
// 気づけない仕組みなので、公開と同時に画面のなかでも伝える(CLAUDE.md ⑤)。
//
// ここで守らせたいのは3つ。
//   ① 公開フラグが false のあいだは案内も出さない(説明だけ先に出ない)
//   ② 一度きりの案内は**新しい**保存キーで管理する(既存の mh_* を触らない・⑦)
//   ③ セリフは ASSISTANT_SCENES を直接書き換えず addAssistantLinePack で足す(⑤)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- ① 公開フラグと連動している ----
check('案内は公開フラグを見ている',
  app.includes('const quickRhythmGuideReleased = RELEASE_FLAGS.quickRhythmLink === true;'));
check('バトル側の案内もフラグを通る',
  /const quickRhythmIntroVisible = quickRhythmGuideReleased &&/.test(app));
check('モンビー側の案内もフラグを通る',
  /const quickRhythmBackgroundVisible = quickRhythmGuideReleased &&/.test(app));

// ---- ② 一度きりの管理 ----
check('新しい保存キーを使っている（既存キーを流用していない）',
  app.includes("const QUICK_RHYTHM_INTRO_KEY = 'mh_quick_rhythm_intro_seen_v1';")
  && app.includes("const QUICK_RHYTHM_BACKGROUND_KEY = 'mh_quick_rhythm_bg_seen_v1';"));
check('閉じたら保存する（次からは出ない）',
  /dismissQuickRhythmIntro = \(\) => \{[^}]*storeSet\(QUICK_RHYTHM_INTRO_KEY, true, false\)/.test(app)
  && /dismissQuickRhythmBackground = \(\) => \{[^}]*storeSet\(QUICK_RHYTHM_BACKGROUND_KEY, true, false\)/.test(app));
// 読めなかったとき(保存が壊れている・読めない端末)は「見た」扱いにする。
// 案内が二度出るより、出ないほうが害が小さい
check('読み込みの既定値は「見た」側',
  app.includes('const [quickRhythmIntroSeen, setQuickRhythmIntroSeen] = useState(true);')
  && app.includes('const [quickRhythmBackgroundSeen, setQuickRhythmBackgroundSeen] = useState(true);')
  && /storeGet\(QUICK_RHYTHM_INTRO_KEY, true, false\) !== false/.test(app));
check('案内はどちらも「まだ見ていないとき」だけ出す',
  /quickRhythmIntroVisible = [^;]*!quickRhythmIntroSeen/.test(app)
  && /quickRhythmBackgroundVisible = [^;]*!quickRhythmBackgroundSeen/.test(app));

// ---- 出る場面 ----
check('バトル側は「クイックの∞周回中」だけに出す',
  /quickRhythmIntroVisible = [^;]*gameState === 'BATTLE' && isQuickMode\(runMode\) && autoRepeat === true/.test(app));
check('モンビー側は「裏で周回している」ときだけに出す',
  /quickRhythmBackgroundVisible = [^;]*rhythmBackgroundRun/.test(app));
check('画面に置いてある', app.includes('data-quick-rhythm-intro') && app.includes('data-quick-rhythm-background'));
check('AUTO設定の節にも助手のひとことがある',
  app.includes('<AssistantBubble scene="autoQuickRunSettings" compact/>'));
check('閉じるボタンは指で押せる大きさ',
  (app.match(/aria-label="この案内を閉じる" className="min-h-\[44px\] min-w-\[44px\]/g) || []).length === 2);

// ---- ③ セリフの足しかた ----
check('セリフは addAssistantLinePack で足している',
  /addAssistantLinePack\(\{\s*id: 'quickRhythmLinkGuide'/.test(assistants));
const scenes = ['quickRhythmIntro', 'quickRhythmBackground', 'autoQuickRunSettings'];
check('場面の受け皿が ASSISTANT_SCENES にある',
  scenes.every(scene => new RegExp(`\\n  ${scene}: \\{`).test(assistants)), scenes.join(','));
// 実際に読み込んで、場面とセリフが結びついているかを見る
const box = {};
vm.createContext(box);
vm.runInContext(assistants + ';globalThis.__s = ASSISTANT_SCENES; globalThis.__p = ASSISTANT_LINE_PACKS;', box);
const packs = box.__p || [];
const pack = packs.find(p => p.id === 'quickRhythmLinkGuide');
check('セリフの束を読み込める', !!pack);
if (pack) {
  for (const scene of scenes) {
    const lines = (pack.lines || {})[scene] || [];
    check(`${scene} のセリフが5つ以上ある`, lines.length >= 5, `${lines.length}件`);
    check(`${scene} の場面が定義されている`, !!(box.__s || {})[scene]);
  }
}

// ---- 生成物にも入っている ----
check('配信用JSにも案内が入っている',
  compiled.includes('quickRhythmIntroVisible') && compiled.includes('mh_quick_rhythm_bg_seen_v1'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
