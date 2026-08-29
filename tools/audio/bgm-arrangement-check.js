const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// BGMアレンジ、クリア曲ルーティング、保存互換性を編集元と生成物の両方で確認する。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(TOOLS_DIR, '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const defaultsMatch = source.match(/const DEFAULT_BGM_ARRANGEMENT = Object\.freeze\((\{[^;]+\})\);/);
  const defaults = defaultsMatch ? Function(`return (${defaultsMatch[1]})`)() : {};
  const compact = source.replace(/\s+/g, '');
  const routes = {
    challenge:['battle','dullahan','boss'],
    quick:['quickBattle','quickDullahan','quickMoo'],
    pro:['proBattle','proDullahan','proMoo'],
    extreme:['extremeBattle','extremeDullahan','extremeMoo'],
    species:['speciesBattle','speciesDullahan','speciesMoo'],
  };
  check(`${file}: 登録済み20曲を全設定欄の共通選択肢に使用`,
    (source.match(/\{\s*id:\s*'[^']+',\s*name:/g) || []).length >= 20 && /BGM_TRACKS\.map\(track\s*=>/.test(source));
  check(`${file}: 5モード×通常・デュラハン・ムーの15設定を定義`,
    Object.values(routes).flat().every(key => Object.hasOwn(defaults, key)));
  // チャレンジ・クイック・種族はオリジナル3曲。極限は旧クイックの3曲
  check(`${file}: チャレンジ・クイック・種族の既定曲がオリジナル3曲`,
    defaults.battle === 'original_battle' && defaults.dullahan === 'original_dullahan' && defaults.boss === 'original_boss' &&
    defaults.quickBattle === 'original_battle' && defaults.quickDullahan === 'original_dullahan' && defaults.quickMoo === 'original_boss' &&
    defaults.speciesBattle === 'original_battle' && defaults.speciesDullahan === 'original_dullahan' && defaults.speciesMoo === 'original_boss');
  // 設定欄を足しただけなので、既存の保存へは何もしない(移行は要らない)。
  // まだ自分で選んでいない人には、そのときのチャレンジの設定がそのまま引き継がれる
  check(`${file}: 種族の3枠はチャレンジの設定を引き継ぐ`,
    /speciesBattle:'battle',speciesDullahan:'dullahan',speciesMoo:'boss'/.test(compact));
  check(`${file}: 種族チャレンジのランは種族の枠を使う(極限難易度でも)`,
    /isSpeciesChallengeMode\(runMode\)\?\{normal:'speciesBattle',dullahan:'speciesDullahan',moo:'speciesMoo'\}/.test(compact));
  // 極限は旧クイックの3曲
  check(`${file}: 極限の既定曲が いちか通常／時計仕掛け／いちかボス`,
    defaults.extremeBattle === 'ichika_battle' &&
    defaults.extremeDullahan === 'melo_dullahan_clockwork' &&
    defaults.extremeMoo === 'ichika_boss');
  // プロは専用曲。デュラハン戦は通常戦との暫定共用をやめて専用曲にした
  check(`${file}: プロの既定曲がプロ戦闘BGM1／鋼鉄の亡霊／プロ戦闘BGM2`,
    defaults.proBattle === 'original_pro_battle_01' &&
    defaults.proDullahan === 'melo_dullahan_steel_ghost' &&
    defaults.proMoo === 'original_pro_battle_02');
  // デュラハン戦の曲は、通常戦・ムー戦の曲と別であること(暫定共用へ戻っていないか)
  check(`${file}: デュラハン戦の既定曲が通常戦・ムー戦と別の曲`,
    defaults.quickDullahan !== defaults.quickBattle && defaults.quickDullahan !== defaults.quickMoo &&
    defaults.proDullahan !== defaults.proBattle && defaults.proDullahan !== defaults.proMoo);
  // 既定を変えても、すでに遊んでいる人の保存は起動時に丸ごと書き戻されるため届かない。
  // 「以前の既定のままの人」だけを一度きりで入れ替え、自分で選んだ曲は残す
  check(`${file}: プロ既定の入れ替えは一度きりで、自分で選んだ曲を上書きしない`,
    /mh_bgm_pro_default_migrated_v1/.test(source) &&
    /BGM_PRO_PREVIOUS_DEFAULTS/.test(source) &&
    /if \(next\[scene\] !== previousDefault\) return;/.test(source));
  // デュラハン戦の曲を足したぶんの移行。フラグはプロのぶんと別にして二重適用を防ぐ
  check(`${file}: デュラハン既定の入れ替えも一度きりで、フラグがプロのぶんと別`,
    /mh_bgm_dullahan_default_migrated_v1/.test(source) &&
    /BGM_DULLAHAN_PREVIOUS_DEFAULTS/.test(source) &&
    /BGM_DULLAHAN_DEFAULT_MIGRATION_KEY='mh_bgm_dullahan_default_migrated_v1'/.test(compact) &&
    /BGM_PRO_DEFAULT_MIGRATION_KEY='mh_bgm_pro_default_migrated_v1'/.test(compact));
  check(`${file}: デュラハン移行の対象がクイック2枠とプロ1枠`,
    /BGM_DULLAHAN_PREVIOUS_DEFAULTS=Object\.freeze\(\{quickDullahan:'original_dullahan',quickMoo:'original_boss',proDullahan:'original_pro_battle_01'\}\)/.test(compact));
  check(`${file}: クイック・極限の既定入れ替えは一度きりで、自分で選んだ曲を上書きしない`,
    /mh_bgm_quick_extreme_default_migrated_v1/.test(source) &&
    /BGM_QUICK_EXTREME_PREVIOUS_DEFAULTS/.test(source) &&
    /migrateQuickExtremeBgmDefaults/.test(source) &&
    /if \(next\[scene\] !== previousDefault\) return;/.test(source));
  // 追加した4曲。既定に使う2曲と、既定では使わないが選べる2曲
  check(`${file}: デュラハン戦の4曲が登録されている`,
    ['melo_dullahan_clockwork', 'melo_dullahan_clockwork_alt', 'melo_dullahan_steel_ghost', 'melo_dullahan_steel_ghost_alt']
      .every(id => new RegExp(`id:'${id}'`).test(compact)));
  check(`${file}: -Another- の2曲は自動では使わないが選択肢には並ぶ`,
    !Object.values(defaults).includes('melo_dullahan_clockwork_alt') &&
    !Object.values(defaults).includes('melo_dullahan_steel_ghost_alt') &&
    /id:'melo_dullahan_clockwork_alt'/.test(compact) && /id:'melo_dullahan_steel_ghost_alt'/.test(compact));
  // アップロード時のファイル名(「(1)(1)」など)が画面やコードへ紛れ込んでいないこと
  check(`${file}: 元の添付ファイル名が混ざっていない`,
    !/デュラハン戦[AB]/.test(source) && !/\(1\)\(1\)/.test(source) && !/あつゲーム/.test(source));
  check(`${file}: イベントBGMの設定欄が既定でイベントBGM 1`,
    defaults.kikiIntro === 'original_event_01');
  check(`${file}: イベントBGM 2は自動では使わないが選択肢には並ぶ`,
    !Object.values(defaults).includes('original_event_02') && /id:'original_event_02'/.test(compact));
  check(`${file}: 会話イベント中は画面より優先してイベントBGMを鳴らす`,
    /EVENT_BGM_SCENES/.test(source) && /kiki_intro:'kikiIntro'/.test(compact) &&
    /if \(eventBgmScene\) return bgmArrangement\[eventBgmScene\];/.test(source) &&
    source.indexOf('if (eventBgmScene) return bgmArrangement[eventBgmScene];') < source.indexOf("if (isGameOver) return 'gameOver';"));
  check(`${file}: 通常再生もイベント回想も同じイベントBGM設定を使う`,
    /kikiIntroPlaying[\s\S]{0,200}EVENT_BGM_SCENES\.kiki_intro/.test(source) &&
    /eventReplay\s*\?\s*\(?EVENT_BGM_SCENES\[eventReplay\.id\]\s*\|\|\s*null\)?\s*:\s*null/.test(source));
  check(`${file}: イベントが終われば元の画面のBGMへ戻る（依存に入れて鳴らし直す）`,
    /bgmArrangement, runMode, eventBgmScene, mainHero\?\.id\]/.test(source));
  check(`${file}: 旧保存のデュラハン・boss選択を新規キーへ継承`,
    /quickMoo:'boss'/.test(compact) && /proDullahan:'dullahan'/.test(compact) && /proMoo:'boss'/.test(compact) &&
    /extremeDullahan:'dullahan'/.test(compact) && /extremeMoo:'boss'/.test(compact) && /BGM_TRACK_BY_ID\[legacySaved\]/.test(source));
  check(`${file}: 不正track IDを既定値へ正規化`,
    /BGM_TRACK_BY_ID\[saved\]/.test(source) && /BGM_TRACK_BY_ID\[legacySaved\]\s*\?\s*legacySaved\s*:\s*fallback/.test(source));
  check(`${file}: mh_bgm_arrangementを同じ保存領域で維持`, /mh_bgm_arrangement/.test(source));
  check(`${file}: M\/B管理・マーケット・神殿へ選択曲をルーティング`,
    /MB_MANAGEMENT:\s*['"]management/.test(source) && /BREEDER_MARKET:\s*['"]market/.test(source) &&
    /TEMPLE:\s*['"]temple/.test(source) && /bgmArrangement\[BGM_STATE_MAP\[state\]\]/.test(source));
  check(`${file}: 最終WAVEリザルトとCHAMPIONだけクリア曲へルーティング`,
    /!debugBattleRef\.current\s*&&\s*currentWave\s*===\s*10/.test(source) && /WAVE_RESULT/.test(source) && /bgmArrangement\.clear/.test(source));
  for (const [mode, [normal, dullahan, moo]] of Object.entries(routes)) {
    check(`${file}: ${mode}の通常・デュラハン・ムーを個別ルーティング`,
      compact.includes(`normal:'${normal}',dullahan:'${dullahan}',moo:'${moo}'`));
  }
  check(`${file}: ムー→デュラハン→通常戦の優先順位と敵ID・WAVE判定`,
    source.indexOf("enemyId === 'Moo' || currentWave === 10") < source.indexOf("enemyId === 'Durahan' || currentWave === 9") &&
    /return bgmArrangement\[modeBgm\.moo\]/.test(source) && /return bgmArrangement\[modeBgm\.dullahan\]/.test(source) &&
    /return bgmArrangement\[modeBgm\.normal\]/.test(source));
  check(`${file}: BGM画面は4カテゴリと4モードの2段タブ`,
    /bgmArrangementBattleMode/.test(source) && /setBgmArrangementCategory/.test(source) &&
    ['basic','battle','event','other'].every(category => new RegExp(`id:'${category}',label:`).test(compact)) &&
    ['challenge','quick','pro','extreme'].every(mode => new RegExp(`id:'${mode}',label:`).test(compact)));
  check(`${file}: イベントカテゴリにきき加入イベントの設定欄がある`,
    /id:'event',label:'イベント',items:\[\['kikiIntro',/.test(compact));
  check(`${file}: バトル専用戦をその他カテゴリから分離し用途名を明示`,
    /id:'other'.*trainingBoard/.test(compact) && !/ボスバトル BGM/.test(source) &&
    /\['(?:boss|quickMoo|proMoo|extremeMoo)',/.test(compact));
  check(`${file}: タブ・選択・試聴のタップ領域が44px以上`,
    (source.match(/min-h-\[44px\]/g) || []).length >= 3);
  check(`${file}: 曲別gainを上限付きで全体音量へ合成`,
    /Math\.min\(1\.25/.test(source) && /_bgmGain\(bgmVolumePct\)\s*\*\s*safeTrackGain/.test(source));
  check(`${file}: Web Audio試聴を単一ソースで管理`,
    /const previewBGM/.test(source) && /previewSource/.test(source) && !/new\s+Audio\s*\(/.test(source));
  // ミュートは mh_audio_muted だけを書き、SE/BGMの保存音量には触らない
  // (以前は書き方そのものを見ていたが、実装の書き換えで判定だけが古くなっていた)
  check(`${file}: ミュート切替で保存音量を書き換えない`,
    /const nextMuted\s*=\s*!quickMuted;/.test(source) &&
    /storeSet\('mh_audio_muted', nextMuted, false\)/.test(source) &&
    !/toggleQuickMute[\s\S]{0,400}mh_(?:se|bgm)_volume/.test(source));
}
// BGM_TRACKS が指しているMP3をすべて確かめる。曲を足すたびにここへ書き足す方式だと
// 書き忘れて「登録したのにファイルが無い(本番で無音)」を取り逃すので、登録から引く
{
  const jsx = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
  const block = jsx.match(/const BGM_TRACKS = \[([\s\S]*?)\n\];/);
  check('BGM_TRACKSの一覧を取り出せる', !!block);
  const srcs = block ? [...block[1].matchAll(/src:'(audio\/[^']+)'/g)].map(m => m[1]) : [];
  check(`登録曲のMP3をすべて検査する(${srcs.length}曲)`, srcs.length >= 20);
  for (const rel of srcs) {
    const file = path.join(ROOT, 'monster-hero', rel);
    const data = fs.existsSync(file) ? fs.readFileSync(file) : null;
    check(`${rel}: MP3が存在し内容を持つ`, !!data && data.length > 1024 && (data.slice(0, 3).toString() === 'ID3' || data[0] === 0xff));
  }
  // 今回足した4曲が、それぞれ別の音源であること(同じファイルを2回置いていないか)
  const added = ['audio/bgm-dullahan-clockwork.mp3','audio/bgm-dullahan-clockwork-alt.mp3',
    'audio/bgm-dullahan-steel-ghost.mp3','audio/bgm-dullahan-steel-ghost-alt.mp3'];
  check('デュラハン戦の4曲がすべて登録から参照されている', added.every(rel => srcs.includes(rel)));
  const sizes = added.map(rel => { const f = path.join(ROOT, 'monster-hero', rel); return fs.existsSync(f) ? fs.readFileSync(f).length : 0; });
  check('デュラハン戦の4曲がそれぞれ別の音源', new Set(sizes).size === 4 && sizes.every(n => n > 1024), sizes.join('/'));
}

process.exit(failed ? 1 : 0);
