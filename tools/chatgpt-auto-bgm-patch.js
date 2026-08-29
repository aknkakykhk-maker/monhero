#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, got ${count}`);
  return source.replace(from, to);
};

const gamePath = 'monster-hero/src/game-system.jsx';
let game = read(gamePath);

game = replaceOnce(
  game,
  "const DEFAULT_BGM_ARRANGEMENT = Object.freeze({ title:'monster_hero_theme_alt', home:'original_home'",
  "const DEFAULT_BGM_ARRANGEMENT = Object.freeze({ title:'monster_hero_theme_alt', autoBattle:'monster_hero_theme', home:'original_home'",
  'add autoBattle default'
);

game = replaceOnce(
  game,
  "{id:'basic',label:'基本',items:[['home','HOME BGM'],['title','タイトル BGM'],['management','M/B管理 BGM'],['clear','ゲームクリア BGM']]}",
  "{id:'basic',label:'基本',items:[['home','HOME BGM'],['title','タイトル BGM'],['autoBattle','AUTOモード BGM'],['management','M/B管理 BGM'],['clear','ゲームクリア BGM']]}",
  'add BGM arrangement item'
);

game = replaceOnce(
  game,
  "      const pandoraBossBgm = pandoraBossBgmForBattle(mainHero?.id, currentWave, enemyId);\n      if (pandoraBossBgm) return pandoraBossBgm;",
  "      const pandoraBossBgm = pandoraBossBgmForBattle(mainHero?.id, currentWave, enemyId);\n      if (pandoraBossBgm) return pandoraBossBgm;\n      // AUTO中はモード別の通常戦BGMへ切り替えず、専用のAUTO曲を周回中そのまま使う。\n      // パンドラ専用最終ボスBGMは既存仕様を守るため、この判定より上で優先する。\n      if (autoBattleRef.current) return bgmArrangement.autoBattle;",
  'route battle auto BGM'
);

game = replaceOnce(
  game,
  "    if (RUN_PHASE_STATES.includes(state)) return wavesDone ? 'result' : 'enhance';",
  "    // AUTO中のWAVE間は、リザルト/強化フェーズ曲へ切り替えずAUTO曲を継続する。\n    // 最終WAVEのクリア曲は上の専用判定を維持し、CHAMPIONでも従来どおり。\n    if (autoBattleRef.current && RUN_PHASE_STATES.includes(state) && state !== 'CHAMPION') return bgmArrangement.autoBattle;\n    if (RUN_PHASE_STATES.includes(state)) return wavesDone ? 'result' : 'enhance';",
  'keep auto BGM through wave phases'
);

game = replaceOnce(
  game,
  "  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id]);",
  "  }, [bootPhase, gameState, wave, enemy?.id, hp, gaveUp, audioOn, waveHistory.length, bgmArrangement, runMode, eventBgmScene, mainHero?.id, autoBattle]);",
  'reroute when auto toggles'
);

game = replaceOnce(
  game,
  "    Audio_.playJingle('victory');",
  "    // AUTO中は周回用BGMを途切れさせないため、WAVE撃破ファンファーレを鳴らさない。\n    if (!autoBattleRef.current) Audio_.playJingle('victory');",
  'suppress victory jingle during auto'
);

write(gamePath, game);

const changelogPath = 'monster-hero/data/changelog.js';
let changelog = read(changelogPath);
const changelogEntry = `  {\n    date: "2026-08-30 08:43", type: 'update', title: 'AUTOモード専用BGMを追加しました', status: 'new',\n    assistantNotice: { id:'update_notice_auto_bgm_v1', type:'feature' },\n    items: [\n      'バトルのAUTOモードに専用のBGM設定を追加しました。デフォルトは「Monster Hero」で、BGMアレンジの「基本」から好きな登録曲へ変更・試聴できます。',\n      'AUTO中はWAVEを倒したあとの勝利ファンファーレと、WAVE間のリザルト・強化フェーズBGMへの切り替えを行わず、AUTOモードBGMが途切れず続くようにしました。',\n      'パンドラ勇者の最終ボス専用BGMと最終クリアBGMはこれまでどおり優先します。AUTO∞の「超省エネ」は従来どおりミュートです。',\n    ],\n  },\n`;
changelog = replaceOnce(changelog, 'const CHANGELOG = [\n', 'const CHANGELOG = [\n' + changelogEntry, 'prepend changelog');
write(changelogPath, changelog);

const helpPath = 'monster-hero/data/help.js';
let help = read(helpPath);
const speedLine = help.match(/^\s*\{ t:'note', title:'バトルの進行速度'.*$/m)?.[0];
if (!speedLine) throw new Error('help AUTO insertion anchor not found');
const autoHelp = `          { t:'note', title:'AUTOモードのBGM', text:'バトル中にAUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲を使います。初期設定は「Monster Hero」です。AUTO中は敵撃破後の勝利ファンファーレと、WAVE間のリザルト・強化フェーズBGMへの切り替えを行わず、同じ曲が続きます。パンドラ勇者の最終ボス専用BGMと最終クリアBGMはこれまでどおり優先します。AUTO∞の「超省エネ」はBGM・SEともミュートのままです。' },`;
help = replaceOnce(help, speedLine, speedLine + '\n' + autoHelp, 'add AUTO BGM help');
write(helpPath, help);

const devPath = 'DEVELOPMENT.md';
let dev = read(devPath);
const devAnchor = '   新モード、新難易度、新機能、新モンスター、マーケット新商品、重要な仕様変更は更新履歴の対象とし、';
const devAdd = `${devAnchor}\n   **利用者向けの機能追加・仕様変更では、既存項目の書き換えだけで済ませず新しい更新履歴項目を追加し、タイトル上部の「お知らせ NEW」とHOMEの「更新履歴」未読バッジに出ることも確認する。**`;
dev = replaceOnce(dev, devAnchor, devAdd, 'persist update banner rule');
write(devPath, dev);

const checkPath = path.join(ROOT, 'tools/audio/auto-bgm-check.js');
const checkSource = `#!/usr/bin/env node\nconst fs=require('fs');const path=require('path');\nconst ROOT=path.resolve(__dirname,'..','..');\nconst files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];let failed=0;\nconst check=(name,ok)=>{console.log((ok?'✓':'✗')+' '+name);if(!ok)failed++;};\nfor(const file of files){\n const source=fs.readFileSync(path.join(ROOT,file),'utf8');const compact=source.replace(/\\s+/g,'');\n const m=source.match(/const DEFAULT_BGM_ARRANGEMENT = Object\\.freeze\\((\\{[^;]+\\})\\);/);const defaults=m?Function('return ('+m[1]+')')():{};\n check(file+': AUTO BGMの既定値がMonster Hero',defaults.autoBattle==='monster_hero_theme');\n check(file+': BGMアレンジにAUTOモード欄',compact.includes("['autoBattle','AUTOモードBGM']"));\n check(file+': AUTO戦闘中はAUTO曲を使用',compact.includes('if(autoBattleRef.current)returnbgmArrangement.autoBattle;'));\n check(file+': WAVE間もAUTO曲を継続',compact.includes("if(autoBattleRef.current&&RUN_PHASE_STATES.includes(state)&&state!=='CHAMPION')returnbgmArrangement.autoBattle;"));\n check(file+': AUTO切替をBGM effect依存に含める',/mainHero\\?\\.id,\\s*autoBattle\\]\\);/.test(source));\n check(file+': AUTO中は勝利ファンファーレを抑止',compact.includes("if(!autoBattleRef.current)Audio_.playJingle('victory');"));\n check(file+': パンドラ専用ボスBGMをAUTOより優先',source.indexOf('if (pandoraBossBgm) return pandoraBossBgm;')<source.indexOf('if (autoBattleRef.current) return bgmArrangement.autoBattle;'));\n check(file+': 最終クリアBGMをAUTOより優先',source.indexOf("currentWave === 10 && (state === 'WAVE_RESULT' || state === 'CHAMPION')")<source.indexOf("if (autoBattleRef.current && RUN_PHASE_STATES.includes(state)"));\n check(file+': 既存BGM保存キーを維持',source.includes("mh_bgm_arrangement"));\n check(file+': 超省エネの自動消音機構を維持',source.includes('ultraAudioSessionRef')&&source.includes('quickMuted'));\n}\nconst help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');\nconst changelog=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');\ncheck('ヘルプにAUTO BGMと超省エネの説明',help.includes("title:'AUTOモードのBGM'")&&help.includes('超省エネ'));\ncheck('更新履歴に新規項目と助手通知',changelog.includes("title: 'AUTOモード専用BGMを追加しました'")&&changelog.includes("update_notice_auto_bgm_v1"));\nconsole.log(failed?'\\n'+failed+'件のNGがあります':'\\nすべてOK');process.exit(failed?1:0);\n`;
fs.writeFileSync(checkPath, checkSource);

console.log('AUTO BGM patch applied');
