#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const once = (s, from, to, label) => {
  const count = s.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, got ${count}`);
  return s.replace(from, to);
};

const gamePath = 'monster-hero/src/game-system.jsx';
let game = read(gamePath);
game = once(game,
  "speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', autoVictoryJingle:'off'",
  "speciesBattle:'original_battle', speciesDullahan:'original_dullahan', speciesMoo:'original_boss', autoBattle:'monster_hero_theme', autoVictoryJingle:'off'",
  'AUTO BGM default');
game = once(game,
  "{id:'basic',label:'基本',items:[['home','HOME BGM'],['title','タイトル BGM'],['management','M/B管理 BGM'],['clear','ゲームクリア BGM']]}",
  "{id:'basic',label:'基本',items:[['home','HOME BGM'],['title','タイトル BGM'],['autoBattle','AUTOモード BGM'],['management','M/B管理 BGM'],['clear','ゲームクリア BGM']]}",
  'AUTO BGM arrangement item');
game = once(game,
  "      if (pandoraBossBgm) return pandoraBossBgm;\n      // 種族チャレンジはモードで1つに決める。EXTREME以上の難易度で遊んでも、",
  "      if (pandoraBossBgm) return pandoraBossBgm;\n      // AUTO中はモード別の通常/デュラハン/ムー曲より専用AUTO曲を使う。\n      // パンドラ勇者の最終ボス専用曲だけは上で優先する。\n      if (autoBattleRef.current) return bgmArrangement.autoBattle;\n      // 種族チャレンジはモードで1つに決める。EXTREME以上の難易度で遊んでも、",
  'AUTO battle routing');
write(gamePath, game);

const helpPath = 'monster-hero/data/help.js';
let help = read(helpPath);
const oldHelp = "          { t:'note', title:'AUTO中のBGM', text:'AUTO中は、敵撃破ファンファーレとWAVE後の強化フェーズ用BGMを初期設定では鳴らさず、直前の戦闘BGMをそのまま流し続けます。曲がWAVEごとに途切れないための設定です。タイトル画面の「BGMアレンジ」→「その他」で、それぞれONに戻すこともできます。' },";
const newHelp = "          { t:'note', title:'AUTO中のBGM', text:'AUTOをオンにすると、BGMアレンジの「AUTOモード BGM」で選んだ曲をバトル中に使います。初期設定は「Monster Hero」です。敵撃破ファンファーレとWAVE後の強化フェーズ用BGMは初期設定ではOFFなので、WAVE間でもAUTOモードBGMが途切れず続きます。「その他」からそれぞれONに戻すこともできます。パンドラ勇者の最終ボス専用BGMはAUTOより優先し、AUTO∞の「超省エネ」は従来どおりミュートです。' },";
help = once(help, oldHelp, newHelp, 'AUTO help');
write(helpPath, help);

const changelogPath = 'monster-hero/data/changelog.js';
let changelog = read(changelogPath);
const entry = `  {\n    date: "2026-08-30 09:00", type: 'update', title: 'AUTOモード専用BGMを追加しました', status: 'new',\n    items: [\n      'バトルのAUTOモードに専用BGM設定を追加しました。初期設定は「Monster Hero」で、タイトル画面のBGMアレンジ「基本」から好きな登録曲へ変更・試聴できます。',\n      'AUTO中は敵撃破ファンファーレとWAVE後の強化フェーズBGMを初期設定でOFFにし、AUTOモードBGMがWAVE間で途切れず続きます。「その他」から個別にONへ戻すこともできます。',\n      'パンドラ勇者の最終ボス専用BGMはこれまでどおり優先し、AUTO∞の「超省エネ」は従来どおりミュートです。',\n    ],\n  },\n`;
changelog = once(changelog, 'const CHANGELOG = [\n', 'const CHANGELOG = [\n' + entry, 'changelog entry');
write(changelogPath, changelog);

const checkPath = 'tools/audio/auto-bgm-continuity-check.js';
let check = read(checkPath);
check = once(check,
  "  check(`${file}: AUTO音設定の既定値は2つともOFF`, compact.includes(\"autoVictoryJingle:'off',autoPostWaveBgm:'off'\"));",
  "  check(`${file}: AUTO専用BGMの既定値はMonster Hero`, compact.includes(\"autoBattle:'monster_hero_theme'\"));\n  check(`${file}: AUTO音設定の既定値は2つともOFF`, compact.includes(\"autoVictoryJingle:'off',autoPostWaveBgm:'off'\"));",
  'check default');
check = once(check,
  "  check(`${file}: AUTO切替でBGM判定を再実行`, /mainHero\\?\\.id,\\s*autoBattle\\]/.test(source));",
  "  check(`${file}: AUTO戦闘は専用BGMへルーティング`, /if \\(autoBattleRef\\.current\\) return bgmArrangement\\.autoBattle;/.test(source));\n  check(`${file}: パンドラ専用最終ボスBGMをAUTOより優先`, source.indexOf('if (pandoraBossBgm) return pandoraBossBgm;') < source.indexOf('if (autoBattleRef.current) return bgmArrangement.autoBattle;'));\n  check(`${file}: AUTO切替でBGM判定を再実行`, /mainHero\\?\\.id,\\s*autoBattle\\]/.test(source));",
  'check route');
check = once(check,
  "  check(`${file}: BGMアレンジにAUTO用2項目を表示`, source.includes('AUTO時 敵撃破ファンファーレ') && source.includes('AUTO時 強化フェーズBGM'));",
  "  check(`${file}: BGMアレンジにAUTO専用曲の選択欄を表示`, source.includes(\"['autoBattle','AUTOモード BGM']\"));\n  check(`${file}: BGMアレンジにAUTO用2項目を表示`, source.includes('AUTO時 敵撃破ファンファーレ') && source.includes('AUTO時 強化フェーズBGM'));",
  'check arrangement');
check = once(check,
  "check('更新情報にAUTO BGM変更を掲載', /AUTO中のBGMが途切れにくくなりました/.test(changelog));",
  "check('更新情報にAUTO専用BGM追加を掲載', /AUTOモード専用BGMを追加しました/.test(changelog));\ncheck('更新情報にAUTO BGM変更を掲載', /AUTO中のBGMが途切れにくくなりました/.test(changelog));",
  'check changelog');
check = once(check,
  "check('ヘルプにAUTO中のBGM説明を掲載', /title:'AUTO中のBGM'/.test(help));",
  "check('ヘルプにAUTO専用曲とMonster Heroの説明を掲載', /title:'AUTO中のBGM'/.test(help) && /AUTOモード BGM/.test(help) && /Monster Hero/.test(help));",
  'check help');
write(checkPath, check);
console.log('dedicated AUTO BGM patch applied');
