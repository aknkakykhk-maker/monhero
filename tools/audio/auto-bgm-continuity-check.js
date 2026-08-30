const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const compact = source.replace(/\s+/g, '');
  check(`${file}: AUTO専用BGMの既定値はMonster Hero`, compact.includes("autoBattle:'monster_hero_theme'"));
  check(`${file}: AUTO音設定の既定値は2つともOFF`, compact.includes("autoVictoryJingle:'off',autoPostWaveBgm:'off'"));
  check(`${file}: AUTO中の敵撃破ファンファーレを既定OFF`, /!autoBattleRef\.current\s*\|\|\s*bgmArrangement\.autoVictoryJingle\s*===\s*['\"]on['\"]/.test(source));
  check(`${file}: AUTO中WAVE後は戦闘BGMを継続`, source.includes("return '__keep_battle_bgm__';") && source.includes("if (key === '__keep_battle_bgm__')"));
  check(`${file}: AUTO戦闘は専用BGMへルーティング`, /if \(autoBattleRef\.current\) return bgmArrangement\.autoBattle;/.test(source));
  check(`${file}: パンドラ専用最終ボスBGMをAUTOより優先`, source.indexOf('if (pandoraBossBgm) return pandoraBossBgm;') < source.indexOf('if (autoBattleRef.current) return bgmArrangement.autoBattle;'));
  check(`${file}: AUTO切替でBGM判定を再実行`, /mainHero\?\.id,\s*autoBattle\]/.test(source));
  check(`${file}: BGMアレンジにAUTO専用曲の選択欄を表示`, compact.includes("['autoBattle',"));
  check(`${file}: BGMアレンジにAUTO用2項目を表示`, source.includes('AUTO時 敵撃破ファンファーレ') && source.includes('AUTO時 強化フェーズBGM'));
  check(`${file}: AUTO用2項目はON/OFFを保存正規化`, /BGM_TOGGLE_SCENES/.test(source) && /autoVictoryJingle/.test(source) && /autoPostWaveBgm/.test(source) && /saved\s*===\s*['"]on['"]/.test(source) && /saved\s*===\s*['"]off['"]/.test(source));
}
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
const help = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');
const development = fs.readFileSync(path.join(ROOT, 'DEVELOPMENT.md'), 'utf8');
check('更新情報にAUTO専用BGM追加を掲載', /AUTOモード専用BGMを追加しました/.test(changelog));
check('更新情報にAUTO BGM変更を掲載', /AUTO中のBGMが途切れにくくなりました/.test(changelog));
check('ヘルプにAUTO専用曲とMonster Heroの説明を掲載', /title:'AUTO中のBGM'/.test(help) && /AUTOモード BGM/.test(help) && /Monster Hero/.test(help));
check('今後の更新バナー・更新情報確認を開発ルール化', /更新バナー・更新情報の必須確認/.test(development) && /update-notice-check\.js/.test(development));
if (failed) process.exit(1);
console.log('OK: AUTO中BGM継続の検証に成功しました');
