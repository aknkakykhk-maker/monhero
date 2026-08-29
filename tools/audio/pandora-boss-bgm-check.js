#!/usr/bin/env node
// パンドラを勇者モンにした最終ボス戦だけで専用BGMを優先することを確認する。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
};
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const arrangeableBlock = source.match(/const BGM_TRACKS = \[([\s\S]*?)\];/)?.[1] || '';
  const arrangeableCompact = arrangeableBlock.replace(/\s+/g, '');
  const helperExpression = source.match(/const pandoraBossBgmForBattle = \(heroId, currentWave, enemyId\) =>\s*([^;]+);/)?.[1];
  let resolvePandoraBoss = null;
  try {
    resolvePandoraBoss = helperExpression
      ? Function(`return ((heroId, currentWave, enemyId) => ${helperExpression})`)()
      : null;
  } catch {}

  check(`${file}: 専用曲のID・曲名・保存先を登録曲一覧へ追加`,
    arrangeableCompact.includes("id:'pandora_boss'") &&
    arrangeableCompact.includes("name:'StayWithMe～LockedFate～'") &&
    arrangeableCompact.includes("src:'audio/bgm-pandora-boss.mp3'"));
  check(`${file}: 専用曲を既存Web Audioのトラック解決へ接続`,
    compact.includes('constresolveTrack=key=>BGM_TRACK_BY_ID[key]||BGM_TRACK_BY_KEY[key]||null;'));
  check(`${file}: 専用曲をBGMアレンジの選択・試聴・保存対象に含める`,
    arrangeableCompact.includes("id:'pandora_boss'") &&
    compact.includes('BGM_TRACKS.map(track=>') &&
    compact.includes('Audio_.previewBGM(trackId)') &&
    compact.includes('if(BGM_TRACK_BY_ID[saved])return[scene,saved]') &&
    !source.includes('mh_pandora_boss'));
  check(`${file}: 本体の専用BGM判定を取り出せる`, typeof resolvePandoraBoss === 'function');
  if (resolvePandoraBoss) {
    check(`${file}: パンドラ勇者 + WAVE10で専用BGM`, resolvePandoraBoss('Pandora', 10, 'Moo') === 'pandora_boss');
    check(`${file}: パンドラ勇者 + ムーで専用BGM`, resolvePandoraBoss('Pandora', 1, 'Moo') === 'pandora_boss');
    check(`${file}: パンドラ勇者 + WAVE9では専用BGMにしない`, resolvePandoraBoss('Pandora', 9, 'Durahan') === null);
    check(`${file}: パンドラ勇者 + 通常戦では専用BGMにしない`, resolvePandoraBoss('Pandora', 1, 'NormalEnemy') === null);
    check(`${file}: 供モンだけパンドラでも専用BGMにしない`, resolvePandoraBoss('Mocchi', 10, 'Moo') === null);
    check(`${file}: 敵だけパンドラでも専用BGMにしない`, resolvePandoraBoss('Mocchi', 1, 'Pandora') === null);
  }
  check(`${file}: 勇者モンの種idだけで専用BGMを判定`,
    compact.includes('pandoraBossBgmForBattle(mainHero?.id,currentWave,enemyId)') &&
    !String(helperExpression || '').includes('slots'));
  check(`${file}: 専用曲をモード別ムー戦BGMより先に優先`,
    source.indexOf('if (pandoraBossBgm) return pandoraBossBgm;') >= 0 &&
    source.indexOf('if (pandoraBossBgm) return pandoraBossBgm;') < source.indexOf("if (enemyId === 'Moo' || currentWave === 10) return bgmArrangement[modeBgm.moo];"));
  check(`${file}: 他の勇者は既存のモード別ムー戦BGMへ戻る`,
    compact.includes("if(enemyId==='Moo'||currentWave===10)returnbgmArrangement[modeBgm.moo];") &&
    ['boss', 'quickMoo', 'proMoo', 'extremeMoo', 'speciesMoo'].every(key => compact.includes(`moo:'${key}'`)));
  check(`${file}: 勇者変更もBGM切替の依存に含める`,
    compact.includes('bgmArrangement,runMode,eventBgmScene,mainHero?.id,autoBattle]);'));
}

const audioPath = path.join(ROOT, 'monster-hero/audio/bgm-pandora-boss.mp3');
const audio = fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
check('パンドラ専用MP3が存在し内容を持つ',
  !!audio && audio.length > 1024 && (audio.slice(0, 3).toString() === 'ID3' || audio[0] === 0xff));
check('添付された音源と同じMP3を保存',
  !!audio && crypto.createHash('sha256').update(audio).digest('hex') === 'b6683818f250cb8777113961ddc522b02a60687f9a3f6830184a3924ec956fd2');

const help = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
check('ヘルプに発動条件と非発動条件を記載',
  help.includes("title:'パンドラ専用の最終ボスBGM'") &&
  help.includes('供モンだけがパンドラの場合や通常戦・デュラハン戦') &&
  help.includes('この専用曲もBGMアレンジの全設定欄から選択・試聴できます'));
check('更新履歴に曲名・発動条件・BGMアレンジ登録を記載',
  changelog.includes("title: 'パンドラ専用の最終ボスBGMを追加しました'") &&
  changelog.includes('Stay With Me ～Locked Fate～') &&
  changelog.includes('BGMアレンジの登録曲一覧'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
