#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const arrangeableBlock = source.match(/const BGM_TRACKS = \[([\s\S]*?)\];/)?.[1] || '';
  const arrangeableCompact = arrangeableBlock.replace(/\s+/g, '');
  const helperExpression = source.match(/const eikiBossBgmForBattle = \(heroId, currentWave, enemyId\) =>\s*([^;]+);/)?.[1];
  let resolveEikiBoss = null;
  try {
    resolveEikiBoss = helperExpression ? Function(`return ((heroId, currentWave, enemyId) => ${helperExpression})`)() : null;
  } catch {}

  check(`${file}: エイキ専用曲を登録曲一覧へ追加`,
    arrangeableCompact.includes("id:'eiki_boss'") &&
    arrangeableCompact.includes("name:'綺季一閃～花雪に舞う詠姫～'") &&
    arrangeableCompact.includes("src:'audio/綺季一閃_～花雪に舞う詠姫～.mp3'"));
  check(`${file}: BGMアレンジの共通選択・試聴・保存処理を再利用`,
    compact.includes('BGM_TRACKS.map(track=>') &&
    compact.includes('Audio_.previewBGM(trackId)') &&
    compact.includes('BGM_TRACK_BY_ID[saved]') &&
    !source.includes('mh_eiki_boss'));
  check(`${file}: 専用BGM判定を取り出せる`, typeof resolveEikiBoss === 'function');
  if (resolveEikiBoss) {
    check(`${file}: エイキ勇者 + WAVE10で専用BGM`, resolveEikiBoss('Eiki', 10, 'Moo') === 'eiki_boss');
    check(`${file}: エイキ勇者 + ムーで専用BGM`, resolveEikiBoss('Eiki', 1, 'Moo') === 'eiki_boss');
    check(`${file}: エイキ勇者 + WAVE9では専用BGMにしない`, resolveEikiBoss('Eiki', 9, 'Durahan') === null);
    check(`${file}: エイキ勇者 + 通常戦では専用BGMにしない`, resolveEikiBoss('Eiki', 1, 'NormalEnemy') === null);
    check(`${file}: 供モンだけエイキ想定では専用BGMにしない`, resolveEikiBoss('Mocchi', 10, 'Moo') === null);
    check(`${file}: 敵だけエイキでも専用BGMにしない`, resolveEikiBoss('Mocchi', 1, 'Eiki') === null);
  }
  check(`${file}: 勇者モンの種idだけで専用BGMを判定`,
    compact.includes('eikiBossBgmForBattle(mainHero?.id,currentWave,enemyId)'));
  check(`${file}: モード別ムー戦BGMより先にエイキ専用曲を優先`,
    source.indexOf('if (eikiBossBgm) return eikiBossBgm;') >= 0 &&
    source.indexOf('if (eikiBossBgm) return eikiBossBgm;') < source.indexOf("if (enemyId === 'Moo' || currentWave === 10) return bgmArrangement[modeBgm.moo];"));
  check(`${file}: パンドラ専用BGMも維持`,
    compact.includes("id:'pandora_boss'") && compact.includes('pandoraBossBgmForBattle(mainHero?.id,currentWave,enemyId)'));
}

const audioPath = path.join(ROOT, 'monster-hero/audio/綺季一閃_～花雪に舞う詠姫～.mp3');
const audio = fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
check('エイキ専用MP3が存在し内容を持つ', !!audio && audio.length > 1024 && (audio.slice(0, 3).toString() === 'ID3' || audio[0] === 0xff));

const help = fs.readFileSync(path.join(ROOT, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
check('ヘルプに発動条件とBGMアレンジ登録を記載',
  help.includes("title:'エイキ専用の最終ボスBGM'") &&
  help.includes('供モンだけがエイキの場合や通常戦・デュラハン戦') &&
  help.includes('綺季一閃 ～花雪に舞う詠姫～'));
check('更新履歴と助手更新告知を追加',
  changelog.includes("title:'エイキ専用の最終ボスBGMを追加しました'") &&
  changelog.includes("assistantNotice:{id:'update_notice_eiki_boss_bgm_v1',type:'feature'}") &&
  changelog.includes('綺季一閃 ～花雪に舞う詠姫～'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
