#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(ROOT,p),s);
const once=(s,from,to,label)=>{
  const count=s.split(from).length-1;
  if(count!==1) throw new Error(`${label}: expected 1 match, got ${count}`);
  return s.replace(from,to);
};

const gamePath='monster-hero/src/game-system.jsx';
let game=read(gamePath);
game=once(game,
  "autoBattle:'monster_hero_theme', autoVictoryJingle:'off', autoPostWaveBgm:'off', clear:'ichika_clear'",
  "autoBattle:'monster_hero_theme', autoVictoryJingle:'off', autoPostWaveBgm:'off', autoRepeatResultBgm:'off', clear:'ichika_clear'",
  'AUTO repeat result default');
game=once(game,
  "const BGM_TOGGLE_SCENES = new Set(['autoVictoryJingle','autoPostWaveBgm']);",
  "const BGM_TOGGLE_SCENES = new Set(['autoVictoryJingle','autoPostWaveBgm','autoRepeatResultBgm']);",
  'AUTO repeat result normalization');
game=once(game,
  "    if (!debugBattleRef.current && currentWave === 10 && (state === 'WAVE_RESULT' || state === 'CHAMPION')) return bgmArrangement.clear;",
  "    if (!debugBattleRef.current && currentWave === 10 && (state === 'WAVE_RESULT' || state === 'CHAMPION')) {\n      // AUTO∞は最終リザルトでも直前の戦闘BGMを継続する。設定をONにした場合だけ従来のクリアBGMへ切り替える。\n      if (autoRepeatRef.current && bgmArrangement.autoRepeatResultBgm !== 'on') return '__keep_battle_bgm__';\n      return bgmArrangement.clear;\n    }",
  'AUTO repeat result routing');
game=once(game,
  "      ['autoPostWaveBgm','AUTO時 強化フェーズBGM'],\n    ].map",
  "      ['autoPostWaveBgm','AUTO時 強化フェーズBGM'],\n      ['autoRepeatResultBgm','AUTO∞ 最終リザルトBGM'],\n    ].map",
  'AUTO repeat result UI');
write(gamePath,game);

const helpPath='monster-hero/data/help.js';
let help=read(helpPath);
const oldHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。「その他」からそれぞれONに戻すこともできます。パンドラ勇者の最終ボス専用BGMはAUTOより優先し、AUTO∞の「超省エネ」は従来どおりミュートです。' },";
const newHelp="          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFFで、直前のBGMをそのまま継続します。タイトル画面のBGMアレンジ「その他」から各項目をONに戻せます。パンドラ勇者の最終ボス専用BGMはAUTOより優先し、AUTO∞の「超省エネ」は従来どおりミュートです。' },";
help=once(help,oldHelp,newHelp,'AUTO help');
write(helpPath,help);

const changelogPath='monster-hero/data/changelog.js';
let changelog=read(changelogPath);
const entry=`  {\n    date: "2026-08-30 09:10", type: 'update', title: 'AUTO∞の最終リザルトBGMを設定できるようにしました', status: 'new',\n    items: [\n      'AUTO∞では、WAVE10勝利後の最終リザルトでゲームクリアBGMへ切り替えない設定を初期値にしました。OFF時は直前の戦闘BGMをそのまま流し続けます。',\n      'タイトル画面のBGMアレンジ「その他」に「AUTO∞ 最終リザルトBGM」を追加しました。ONにすると従来どおりゲームクリアBGMへ切り替わります。',\n      '通常プレイと通常AUTOの最終リザルトBGMは変更していません。',\n    ],\n  },\n`;
changelog=once(changelog,'const CHANGELOG = [\n','const CHANGELOG = [\n'+entry,'changelog entry');
write(changelogPath,changelog);

const checkPath='tools/audio/auto-repeat-result-bgm-check.js';
write(checkPath,`const fs=require('fs');\nconst path=require('path');\nconst ROOT=path.resolve(__dirname,'../..');\nconst files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];\nlet failed=0;\nconst check=(name,ok)=>{console.log(\`${'${ok ? \'OK\' : \'NG\'}'}: ${'${name}'}\`);if(!ok)failed++;};\nfor(const file of files){\n  const source=fs.readFileSync(path.join(ROOT,file),'utf8');\n  const compact=source.replace(/\\s+/g,'');\n  check(\`${'${file}'}: AUTO∞最終リザルトBGMは既定OFF\`,compact.includes(\"autoRepeatResultBgm:'off'\"));\n  check(\`${'${file}'}: AUTO∞最終リザルトBGMを保存正規化\`,source.includes(\"'autoRepeatResultBgm'\")&&source.includes('BGM_TOGGLE_SCENES'));\n  check(\`${'${file}'}: AUTO∞の最終リザルトはOFF時に直前BGMを継続\`,/autoRepeatRef\\.current\\s*&&\\s*bgmArrangement\\.autoRepeatResultBgm\\s*!==\\s*['\"]on['\"]\\) return ['\"]__keep_battle_bgm__['\"]/.test(source));\n  check(\`${'${file}'}: BGMアレンジにAUTO∞最終リザルト設定を表示\`,source.includes('AUTO∞ 最終リザルトBGM'));\n}\nconst help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');\nconst changelog=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');\ncheck('ヘルプにAUTO∞最終リザルトBGMを説明',help.includes('AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFF'));\ncheck('更新履歴にAUTO∞最終リザルトBGMを掲載',changelog.includes('AUTO∞の最終リザルトBGMを設定できるようにしました'));\nif(failed)process.exit(1);\nconsole.log('OK: AUTO∞最終リザルトBGMの検証に成功しました');\n`);
console.log('AUTO repeat result BGM patch applied');
