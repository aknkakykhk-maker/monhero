const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンヒロバトルの入口(BATTLE_SYSTEM_SELECT)を確かめる。
//
//   node tools/battle/battle-system-select-check.js
//
// 2026-09-20 ユーザー指示で、モード選択の1つ上に画面を増やした。
//   モンヒロバトル → どのバトルで遊ぶか → モード選択 → 難易度選択
//   クイックだけは中のモードが1つなので、選んだらそのまま難易度選択へ進む
//
// 【見ているもの】
// ・仕組みの定義(BATTLE_SYSTEMS)と、そこへ属するモードの対応
// ・公開フラグで出し入れできること(新モードは公開前、プロはデバッグだけ)
// ・画面と導線の結線。モード選択のカルーセルが「選んだ仕組みのモードだけ」を並べること
// ・ヘルプ(HELP_SCREEN_COVERAGE)と助手のひとことが付いていること
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GAME_SYSTEM } = require(path.join(TOOLS_DIR, 'harness'));
const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(GAME_SYSTEM, 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'monster-hero/src/parts/69-screen-home.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  if (i < 0) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  const j = source.indexOf(to, i);
  if (j <= i) { console.log(`NG: 終わりが見つかりません（${to}）`); process.exit(1); }
  return source.slice(i, j);
};

// ===== 定義を本体から切り出して動かす =====
// 公開フラグは差し替えて試すので、定数はサンドボックスへ与える側で持つ
const body = slice('const BATTLE_SYSTEM_CLASSIC =', '// 極限チャレンジは通常の3モードとは別に');
// β版フラグは指定が無ければ false(＝今までどおり)
const run = (flags) => {
  const sandbox = { Object, TACTICS_BETA_PRO_RELEASE: false, ...flags };
  vm.createContext(sandbox);
  vm.runInContext(`${body};globalThis.api={BATTLE_SYSTEMS,battleSystemOf,battleSystemModes,visibleBattleSystems,battleSystemComingSoon,`
    + 'battleSystemBeta,battleModePlayable,battleModeComingSoon,'
    + 'BATTLE_SYSTEM_CLASSIC,BATTLE_SYSTEM_TACTICS,BATTLE_SYSTEM_QUICK};', sandbox);
  return sandbox.api;
};
const MODE_IDS = {
  BATTLE_MODE_CHALLENGE: 'challenge', BATTLE_MODE_QUICK: 'quick',
  BATTLE_MODE_SPECIES_CHALLENGE: 'speciesChallenge', BATTLE_MODE_TACTICS: 'tactics',
  BATTLE_MODE_TACTICS_SPECIES: 'tacticsSpecies', BATTLE_MODE_TACTICS_PRO: 'tacticsPro',
  BATTLE_MODE_PRO: 'pro',
};
// 盤面がタクティクス側のモードかどうか。本体と同じ並びを検査からも渡す
MODE_IDS.isTacticsMode = (mode) => [MODE_IDS.BATTLE_MODE_TACTICS,
  MODE_IDS.BATTLE_MODE_TACTICS_SPECIES, MODE_IDS.BATTLE_MODE_TACTICS_PRO].includes(mode);
const api = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: false });

// ===== ① 仕組みの定義 =====
check('仕組みは3つ（クラシック / タクティクス / クイック）', api.BATTLE_SYSTEMS.length === 3,
  api.BATTLE_SYSTEMS.map(s => s.label).join(' / '));
check('どの仕組みにも中身のモードがある',
  api.BATTLE_SYSTEMS.every(s => Array.isArray(s.modes) && s.modes.length > 0));
check('クイックだけが「そのまま難易度へ」',
  api.BATTLE_SYSTEMS.filter(s => s.direct).map(s => s.id).join(',') === api.BATTLE_SYSTEM_QUICK,
  api.BATTLE_SYSTEMS.filter(s => s.direct).map(s => s.id).join(',') || 'なし');
check('同じモードが2つの仕組みに入っていない', (() => {
  const all = api.BATTLE_SYSTEMS.flatMap(s => s.modes);
  return new Set(all).size === all.length;
})());
check('クイックは「これまでのバトル」から外れている',
  !api.BATTLE_SYSTEMS.find(s => s.id === api.BATTLE_SYSTEM_CLASSIC).modes.includes('quick'));
check('モードから仕組みを引ける',
  api.battleSystemOf('challenge').id === api.BATTLE_SYSTEM_CLASSIC
    && api.battleSystemOf('quick').id === api.BATTLE_SYSTEM_QUICK
    && api.battleSystemOf('tactics').id === api.BATTLE_SYSTEM_TACTICS);
check('知らないモードは「これまでのバトル」へ寄せる',
  api.battleSystemOf('しらないid').id === api.BATTLE_SYSTEM_CLASSIC);

// ===== ② 公開フラグで出し入れできる =====
const beforeRelease = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: false });
// ★2026-09-20 ユーザー指示で、公開前でも「準備中」の枠として並べるようにした
//   (モンヒロビートの準備中と同じ扱い。押せないだけで、場所は取っておく)
check('新モードは公開前でも「準備中」の枠として並ぶ',
  beforeRelease.visibleBattleSystems().some(s => s.id === beforeRelease.BATTLE_SYSTEM_TACTICS),
  beforeRelease.visibleBattleSystems().map(s => s.label).join(' / '));
check('公開前は「準備中」の印が付く',
  beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_TACTICS) === true);
check('デバッグからは準備中にならない(遊べる)',
  beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_TACTICS, { debugBattle: true }) === false
    && beforeRelease.battleSystemModes(beforeRelease.BATTLE_SYSTEM_TACTICS, { debugBattle: true }).length > 0);
check('準備中になるのは新モードだけ',
  !beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_CLASSIC)
    && !beforeRelease.battleSystemComingSoon(beforeRelease.BATTLE_SYSTEM_QUICK));
check('クイックの上に並ぶ', (() => {
  const ids = beforeRelease.visibleBattleSystems().map(s => s.id);
  return ids.indexOf(beforeRelease.BATTLE_SYSTEM_TACTICS) < ids.indexOf(beforeRelease.BATTLE_SYSTEM_QUICK);
})(), beforeRelease.visibleBattleSystems().map(s => s.label).join(' → '));
const afterRelease = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true, TACTICS_MODE_PUBLIC_RELEASE: true });
check('公開フラグを立てると、準備中が外れて遊べるようになる',
  afterRelease.visibleBattleSystems().some(s => s.id === afterRelease.BATTLE_SYSTEM_TACTICS)
    && afterRelease.battleSystemComingSoon(afterRelease.BATTLE_SYSTEM_TACTICS) === false);
check('種族チャレンジは公開前だと中身から外れる', (() => {
  const hidden = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: false, TACTICS_MODE_PUBLIC_RELEASE: false });
  return !hidden.battleSystemModes(hidden.BATTLE_SYSTEM_CLASSIC).includes('speciesChallenge');
})());
// ★仕組みを足しただけで、モードの出し入れは変えていない。プロは今までどおり本番にも並ぶ
check('プロモードは今までどおり本番のモード選択に並ぶ',
  api.battleSystemModes(api.BATTLE_SYSTEM_CLASSIC).includes('pro'));

// ===== ①-2 カードの説明と「詳しいルール」 =====
// 2026-09-20 ユーザー指示「説明がいまいち。もうちょい見た目がいい説明文に／
// 詳細ルールも見れるように」。3つを見比べて選べるよう、書き方をそろえる
check('どの仕組みにも売りが3行ある',
  api.BATTLE_SYSTEMS.every(s => Array.isArray(s.highlights) && s.highlights.length === 3
    && s.highlights.every(row => Array.isArray(row) && row.length === 2 && row[0] && row[1])),
  api.BATTLE_SYSTEMS.map(s => `${s.short}:${s.highlights?.length}`).join(' / '));
check('どの仕組みにも詳しいルールがある',
  api.BATTLE_SYSTEMS.every(s => Array.isArray(s.points) && s.points.length >= 5
    && s.points.every(row => Array.isArray(row) && row.length === 3 && row.every(Boolean))),
  api.BATTLE_SYSTEMS.map(s => `${s.short}:${s.points?.length}`).join(' / '));
// 説明モーダルは {emoji,label,color,tagline,points} をそのまま読む。
// 1つでも欠けると、開いた瞬間に真っ白になる
check('詳しいルールを出すのに要るものがそろっている',
  api.BATTLE_SYSTEMS.every(s => s.emoji && s.label && s.color && s.tagline && s.points));
// 売りの1行が長いと、カードの中で2行に折り返して高さがそろわなくなる
check('売りの1行は短くまとめてある',
  api.BATTLE_SYSTEMS.every(s => s.highlights.every(([, text]) => text.length <= 20)),
  api.BATTLE_SYSTEMS.flatMap(s => s.highlights).map(([, t]) => t.length).join(','));
// ★同じ売りを2枚のカードへ書かない。書くと見比べても違いが分からない
// (「スコアが全国ランキングに載る」はクラシックもタクティクスも当てはまり、実際に外した)
{
  const texts = api.BATTLE_SYSTEMS.flatMap(s => s.highlights.map(([, text]) => text));
  check('同じ売りを2枚のカードへ書いていない', new Set(texts).size === texts.length,
    texts.filter((t, i) => texts.indexOf(t) !== i).join(' / ') || 'なし');
  const icons = api.BATTLE_SYSTEMS.flatMap(s => s.highlights.map(([icon]) => icon));
  check('売りの絵文字も重ならない', new Set(icons).size === icons.length, icons.join(''));
}
// 1行目の説明(tagline)をそのまま繰り返さない。同じことが2回書いてあるだけになる
check('売りが説明文の繰り返しになっていない',
  api.BATTLE_SYSTEMS.every(s => s.highlights.every(([, text]) => !s.tagline.includes(text))));
// カード下の1行(note)とも重ならない
check('売りがカード下の1行と重なっていない',
  api.BATTLE_SYSTEMS.every(s => s.highlights.every(([, text]) => !s.note.includes(text))));
// ★どのバトルにもあることを、片方だけの売りとして書かない(2026-09-20 ユーザー指摘)。
//   「敵の行動が1ターン前に予告される」「解析で確率が見られる」はどのバトルにもあるので、
//   クラシック(＝基本)にだけ置く。タクティクス側は「誰を狙うかまで出る」が変わったところ
{
  const classic = api.BATTLE_SYSTEMS.find(s => s.id === api.BATTLE_SYSTEM_CLASSIC);
  const tactics = api.BATTLE_SYSTEMS.find(s => s.id === api.BATTLE_SYSTEM_TACTICS);
  const lineOf = (system) => system.highlights.map(([, text]) => text).join(' ');
  check('基本にもあることをタクティクスの売りにしていない',
    !/1ターン前|予告される|解析/.test(lineOf(tactics)), lineOf(tactics));
  // ★「育てた数字より読みで勝てる」とは書かない。プロ以外はどのバトルでも育成の力が要る
  check('育成が要らないと読める書き方をしていない',
    api.BATTLE_SYSTEMS.every(s => !/育てた数字より|育成の数字より|数字より.*読み/.test(
      `${s.tagline} ${lineOf(s)} ${s.points.map(p => p[2]).join(' ')}`)));
  // クラシックは「いままでの通常のバトル」。基本の骨格(ステータス・カード・強化)を書く
  check('クラシックには基本の骨格が書いてある',
    /ステータス/.test(lineOf(classic)) && /カード/.test(lineOf(classic)) && /強化/.test(lineOf(classic)),
    lineOf(classic));
  // タクティクスは「基本から変わったところ」だけ。基本の説明を繰り返さない
  check('タクティクスは基本との違いが書いてある',
    /1体ずつ/.test(lineOf(tactics)) && /狙う/.test(lineOf(tactics)), lineOf(tactics));
  // ★合算か1体ずつかが分かれるのは**ライフだけではない**(2026-09-21 ユーザー指摘)。
  //   ちから・丈夫さ・ガッツも同じなので、「ライフ」ではなく「ステータス」で書く
  //   (仕様 4.1「合流した供モンは、合算されず自分の値のまま盤面に加わる」)
  check('合算か1体ずつかを「ライフ」だけで書いていない',
    [classic, tactics].every(s => /ステータス/.test(lineOf(s)) && !/^.{0,12}ライフ/.test(lineOf(s))),
    `${lineOf(classic).split(' ')[0]} / ${lineOf(tactics).split(' ')[0]}`);
  // 詳しいルールの1つ目も「ステータスの持ち方」でそろえ、4つとも名前を挙げる
  check('詳しいルールがステータス4つを名前で挙げている',
    [classic, tactics].every(s => s.points[0][1] === 'ステータスの持ち方'
      && ['ライフ', 'ちから', '丈夫さ', 'ガッツ'].every(word => s.points[0][2].includes(word))),
    [classic, tactics].map(s => s.points[0][1]).join(' / '));
  // タクティクス側は「合算されない」ことが読めること。作り直しの中心なので落とさない
  check('供モンが合算されないことが書いてある',
    /合算されず/.test(tactics.points[0][2]));
  // ★勇者特性の効き方も、ステータスと並ぶ大きな違い(2026-09-21 ユーザー指摘)。
  //   クラシックは勇者モンの特性だけがパーティ全体へ、タクティクスは連れてきた全員ぶんが
  //   それぞれの子に効く。供モンを選ぶ意味が変わるので、入口で読めるようにしておく
  const traitPointOf = (system) => system.points.find(([, title]) => title.includes('勇者特性'));
  check('どちらにも勇者特性の説明がある',
    !!traitPointOf(classic) && !!traitPointOf(tactics),
    [classic, tactics].map(s => (traitPointOf(s) || ['', 'なし'])[1]).join(' / '));
  check('クラシックは勇者モンの特性だけと書いてある',
    /勇者モン(にした子)?の特性だけ/.test(traitPointOf(classic)[2]));
  check('タクティクスは供モンの特性も効くと書いてある',
    /供モンの勇者特性も/.test(traitPointOf(tactics)[2])
      && /どの特性を連れていくか/.test(traitPointOf(tactics)[2]));
  check('タクティクスの売りに勇者特性が出ている',
    /勇者特性/.test(lineOf(tactics)), lineOf(tactics));
  // 詳しいルールでも、基本との関係が読めるようにしておく
  check('タクティクスの詳しいルールが基本との関係を書いている',
    tactics.points.some(([, , text]) => text.includes('基本のバトル'))
      && tactics.points.some(([, title]) => title.includes('育成')),
    tactics.points.map(p => p[1]).join(' / '));
}
check('仕組みとモードを同じ入口から引ける',
  has('const battleInfoById = (id) => BATTLE_SYSTEMS.find(s => s.id === id) || battleModeInfo(id);')
    && has('{modeInfoId&&(()=>{const mode=battleInfoById(modeInfoId);return('));
check('カードから「詳しいルール」を開ける',
  has('<button data-battle-system-info={sys.id} disabled={!!battleTutorial} onClick={()=>setModeInfoId(sys.id)}')
    && has('詳しいルール<ChevronRight size={12}'));
// 準備中でも中身は読めるようにしておく(何が来るのか分かるように)。
// ★止めてよいのはバトルのれんしゅう中だけ(台本から外れないように)。
//   準備中(soon)やβ版を理由に読めなくしない
check('準備中の仕組みでも詳しいルールは読める', (() => {
  const info = source.slice(source.indexOf('<button data-battle-system-info={sys.id}'),
    source.indexOf('</button>', source.indexOf('<button data-battle-system-info={sys.id}')));
  return (info.match(/disabled=\{[^}]*\}/g) || []).every(d => d === 'disabled={!!battleTutorial}')
    && !/soon|beta/.test(info);
})());
check('売りの3行を画面へ出している',
  has('{sys.highlights.map(([icon,text])=>(') && has('<li key={text}'));
// ★1画面に収まる高さは tools/battle/battle-system-fit-check.js が実際に測る。
//   ここでは「収まる作りを崩していないか」の目印だけを見る
check('1画面に収める作りが残っている',
  has('data-battle-system-card={sys.id}')
    && source.includes('tools/battle/battle-system-fit-check.js を通すこと'));

// ===== ②-2 β版（タクティクスプロだけ先に出す） =====
// 2026-09-20 ユーザー指示「公開の前にβ版としてプロモードだけ出来るようにして」。
// ★フラグは2つ。β版が立つと仕組みの準備中が外れ、中はプロだけが遊べる。
//   本公開が立つと3モードすべてが遊べる(β版フラグの状態に関係なく)
const beta = run({ ...MODE_IDS, SPECIES_CHALLENGE_PUBLIC_RELEASE: true,
  TACTICS_MODE_PUBLIC_RELEASE: false, TACTICS_BETA_PRO_RELEASE: true });
check('β版では仕組みの「準備中」が外れる',
  beta.battleSystemComingSoon(beta.BATTLE_SYSTEM_TACTICS) === false
    && beta.battleSystemBeta(beta.BATTLE_SYSTEM_TACTICS) === true);
check('β版で遊べるのはタクティクスプロだけ',
  beta.battleModePlayable('tacticsPro') === true
    && beta.battleModePlayable('tactics') === false
    && beta.battleModePlayable('tacticsSpecies') === false);
// カードは3枚とも並べる(ユーザー指示「3つ並べてプロ以外は準備中」)
check('β版でも中のカードは3枚とも並ぶ',
  beta.battleSystemModes(beta.BATTLE_SYSTEM_TACTICS).length === 3,
  beta.battleSystemModes(beta.BATTLE_SYSTEM_TACTICS).join(' / '));
check('β版のプロ以外は「準備中」の印が付く',
  beta.battleModeComingSoon('tactics') === true
    && beta.battleModeComingSoon('tacticsSpecies') === true
    && beta.battleModeComingSoon('tacticsPro') === false);
check('β版の準備中はタクティクス側だけ',
  beta.battleModeComingSoon('challenge') === false
    && beta.battleModeComingSoon('pro') === false
    && beta.battleModeComingSoon('speciesChallenge') === false);
check('デバッグからはβ版でも3つとも遊べる',
  beta.battleSystemModes(beta.BATTLE_SYSTEM_TACTICS, { debugBattle: true }).length === 3
    && ['tactics', 'tacticsSpecies', 'tacticsPro']
      .every(id => beta.battleModeComingSoon(id, { debugBattle: true }) === false));
// 公開前(β版も立っていない)は、これまでどおり中のカードを1枚も出さない
check('β版が立つまでは中のカードを出さない',
  beforeRelease.battleSystemModes(beforeRelease.BATTLE_SYSTEM_TACTICS).length === 0
    && ['tactics', 'tacticsSpecies', 'tacticsPro']
      .every(id => beforeRelease.battleModeComingSoon(id) === false));
check('本公開が立てばβ版の印は消え、3つとも遊べる',
  afterRelease.battleSystemBeta(afterRelease.BATTLE_SYSTEM_TACTICS) === false
    && afterRelease.battleSystemModes(afterRelease.BATTLE_SYSTEM_TACTICS).length === 3
    && ['tactics', 'tacticsSpecies', 'tacticsPro']
      .every(id => afterRelease.battleModePlayable(id) === true
        && afterRelease.battleModeComingSoon(id) === false));
// 画面側の結線。押せないだけでなく、目印と文言もそろっていること
check('β版の印を画面へ出している',
  has('const beta=battleSystemBeta(sys.id,{debugBattle:systemDebug});')
    && has('<span data-battle-system-beta')
    && has('いまはタクティクスプロだけ遊べます。ほかのモードは準備中です'));
check('準備中のモードは押せない',
  has('modeSoon=battleModeComingSoon(m.id,{debugBattle}),')
    && has("data-battle-mode-soon={modeSoon?'1':undefined}")
    && has('disabled={extremeLocked||speciesLocked||modeSoon||')
    && has("{modeSoon?'準備中':extremeLocked||speciesLocked?'まだ挑戦できません'"));
check('準備中のモードからランキングへ行けない',
  has('{isSpecies&&!modeSoon&&<button data-species-record-link'));
// 公開フラグは実装側から勝手に動かさない。ユーザーが決めたときだけ変える。
// 2026-09-21「じゃあβ版実装しようか」でβ版をON。本公開はまだOFF
check('β版はON、本公開はまだOFF',
  /const TACTICS_BETA_PRO_RELEASE = true;/.test(source)
    && /const TACTICS_MODE_PUBLIC_RELEASE = false;/.test(source),
  `beta:${/const TACTICS_BETA_PRO_RELEASE = (\w+);/.exec(source)?.[1]} / public:${/const TACTICS_MODE_PUBLIC_RELEASE = (\w+);/.exec(source)?.[1]}`);

// ===== ③ 画面と導線の結線 =====
check('仕組みを選ぶ画面がある', has("{gameState==='BATTLE_SYSTEM_SELECT'&&(()=>{"));
check('HOMEの入口は仕組みの画面へ入る', has('onOpenBattle={openBattleSystemSelect}'));
check('HOMEのボタンは正式名称', home.includes('aria-label="モンヒロバトル"') && home.includes('モンヒロバトル</span>'));
check('カードに検査の手がかりがある', has('data-battle-system={sys.id}') && has('data-battle-systems={systems.length}'));
check('準備中のカードは押せない',
  has("const soon=battleSystemComingSoon(sys.id,{debugBattle:systemDebug});")
    && has('disabled={soon||tutorialLocked}')
    && has("data-battle-system-soon={soon?'1':undefined}")
    && has('if (battleSystemComingSoon(system.id, { debugBattle })) return; // 準備中は枠だけ'));
// ★バトルのれんしゅう中は記録を残さないために debugBattle が立つ。その副作用で
//   入口の並び(準備中・β版・DEBUGの出し分け)まで変わると、練習で覚えた画面と
//   ふだんの画面が食い違ってしまう(2026-09-21 ユーザー指摘)
check('れんしゅう中の入口はふだんと同じ並びで見せる',
  has('const systemDebug=debugBattle&&!battleTutorial;')
    && has('visibleBattleSystems({debugBattle:systemDebug})'));
check('準備中と分かる書き方をしている',
  has('準備中</span>') && has("aria-label={soon?`${sys.label}（準備中）`:sys.label}"));
check('「そのまま難易度へ」の仕組みは難易度選択へ飛ぶ',
  has('if (system.direct) {') && has("setGameState('BATTLE_DIFFICULTY_SELECT');"));
check('モード選択は「選んだ仕組みのモードだけ」を並べる',
  (source.match(/const modes=battleSystemModes\(battleSystem,\{debugBattle\}\)\.map\(id=>battleModeInfo\(id\)\);/g) || []).length === 2,
  '描画と初期位置の2か所');
check('モード選択の戻るは仕組みの画面へ',
  has("setGameState('BATTLE_SYSTEM_SELECT');}}"));
check('選んだ仕組みは保存しない', !source.includes("mh_battle_system") && !source.includes("'mh_system"));
// ★「そのまま難易度へ」で入ったモードは、戻る先もモード選択ではなく入口。
//   モード選択へ戻すと、そのモード1つだけが並ぶ画面が出てしまう(2026-09-20 に検査が見つけた)
check('そのまま難易度へ入ったときは、戻ると入口に帰る',
  has("battleSystemOf(battleMode).direct?'BATTLE_SYSTEM_SELECT':'BATTLE_MODE_SELECT'"));

// ===== ④ ヘルプと助手 =====
check('画面がヘルプの対応表にある', help.includes("BATTLE_SYSTEM_SELECT:     'basics/battle-modes',"));
check('助手のひとことが付いている', has('<AssistantBubble scene="battleSystemSelect" compact/>'));
check('助手の場面が定義してある', assistants.includes('battleSystemSelect: {'));
check('助手4人ぶんのセリフがある',
  ['battleSystemSelectGuide', 'battleSystemSelectGuideKiki', 'battleSystemSelectGuideMomosuke', 'battleSystemSelectGuideDra']
    .every(id => assistants.includes(`id: '${id}'`)));
check('ヘルプの本文が新しい入口を説明している',
  help.includes('HOMEの「モンヒロバトル」を開くと、まず「どのバトルで遊ぶか」を選びます'));
// ★名前は定義が正本。ヘルプや更新履歴へ書き写した名前が古くなっていないか見る
const labelOf = (id) => (api.BATTLE_SYSTEMS.find(s => s.id === id) || {}).label || '';
check('ヘルプがいまの名前で書いてある', help.includes(labelOf(api.BATTLE_SYSTEM_CLASSIC)),
  labelOf(api.BATTLE_SYSTEM_CLASSIC));
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
check('更新履歴がいまの名前で書いてある',
  changelog.includes(labelOf(api.BATTLE_SYSTEM_CLASSIC)) && changelog.includes(labelOf(api.BATTLE_SYSTEM_TACTICS)),
  `${labelOf(api.BATTLE_SYSTEM_CLASSIC)} / ${labelOf(api.BATTLE_SYSTEM_TACTICS)}`);
check('仮の名前が残っていない',
  !source.includes("label: 'これまでのバトル'") && !source.includes("label:'戦術モード'"));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
