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
  };
  check(`${file}: 登録済み16曲を全設定欄の共通選択肢に使用`,
    (source.match(/\{\s*id:\s*'[^']+',\s*name:/g) || []).length >= 16 && /BGM_TRACKS\.map\(track\s*=>/.test(source));
  check(`${file}: 4モード×通常・デュラハン・ムーの12設定を定義`,
    Object.values(routes).flat().every(key => Object.hasOwn(defaults, key)));
  check(`${file}: 12設定の既定曲が従来の再生結果を維持`,
    defaults.battle === 'original_battle' && defaults.quickBattle === 'ichika_battle' &&
    defaults.proBattle === 'original_battle' && defaults.extremeBattle === 'original_battle' &&
    ['dullahan','quickDullahan','proDullahan','extremeDullahan'].every(key => defaults[key] === 'original_dullahan') &&
    ['boss','quickMoo','proMoo','extremeMoo'].every(key => defaults[key] === 'original_boss'));
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
  check(`${file}: BGM画面は3カテゴリと4モードの2段タブ`,
    /bgmArrangementBattleMode/.test(source) && /setBgmArrangementCategory/.test(source) &&
    ['challenge','quick','pro','extreme'].every(mode => new RegExp(`id:'${mode}',label:`).test(compact)));
  check(`${file}: バトル専用戦をその他カテゴリから分離し用途名を明示`,
    /id:'other'.*trainingBoard/.test(compact) && !/ボスバトル BGM/.test(source) &&
    /\['(?:boss|quickMoo|proMoo|extremeMoo)',/.test(compact));
  check(`${file}: タブ・選択・試聴のタップ領域が44px以上`,
    (source.match(/min-h-\[44px\]/g) || []).length >= 3);
  check(`${file}: 曲別gainを上限付きで全体音量へ合成`,
    /Math\.min\(1\.25/.test(source) && /_bgmGain\(bgmVolumePct\)\s*\*\s*safeTrackGain/.test(source));
  check(`${file}: Web Audio試聴を単一ソースで管理`,
    /const previewBGM/.test(source) && /previewSource/.test(source) && !/new\s+Audio\s*\(/.test(source));
  check(`${file}: ミュート切替で保存音量を書き換えない`,
    /setQuickMuted\(current\s*=>\s*!current\)/.test(source) &&
    !/if\s*\(audioMuted\)[\s\S]{0,160}changeSeVolume/.test(source));
}
for (const name of ['bgm-home-ichika.mp3','bgm-battle-ichika.mp3','bgm-boss-ichika.mp3','bgm-clear-ichika.mp3']) {
  const file = path.join(ROOT, 'monster-hero/audio', name);
  const data = fs.existsSync(file) ? fs.readFileSync(file) : null;
  check(`audio/${name}: MP3が存在し内容を持つ`, !!data && data.length > 1024 && (data.slice(0, 3).toString() === 'ID3' || data[0] === 0xff));
}

process.exit(failed ? 1 : 0);
