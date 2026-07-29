// BGMアレンジ、クリア曲ルーティング、保存互換性を編集元と生成物の両方で確認する。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(`${file}: 4曲のいちかトラックを登録`,
    ['ichika_home','ichika_battle','ichika_boss','ichika_clear'].every(id => source.includes(id)));
  check(`${file}: 場面別デフォルトを定義`,
    /DEFAULT_BGM_ARRANGEMENT/.test(source) && /home:\s*['"]original_home/.test(source) && /clear:\s*['"]ichika_clear/.test(source));
  check(`${file}: 不正な保存IDを既定値へ正規化`, /normalizeBgmArrangement/.test(source) && /BGM_TRACK_BY_ID\[value/.test(source));
  check(`${file}: アレンジを専用キーへ保存`, /mh_bgm_arrangement/.test(source));
  check(`${file}: 最終WAVEリザルトとCHAMPIONだけクリア曲へルーティング`,
    /!debugBattleRef\.current\s*&&\s*wave\s*===\s*10/.test(source) && /WAVE_RESULT/.test(source) && /bgmArrangement\.clear/.test(source));
  check(`${file}: 曲別gainを上限付きで全体音量へ合成`,
    /Math\.min\(1\.25/.test(source) && /_bgmGain\(bgmVolumePct\)\s*\*\s*safeTrackGain/.test(source));
  check(`${file}: Web Audio試聴を単一ソースで管理`,
    /const previewBGM/.test(source) && /previewSource/.test(source) && !/new\s+Audio\s*\(/.test(source));
}

for (const name of ['bgm-home-ichika.mp3','bgm-battle-ichika.mp3','bgm-boss-ichika.mp3','bgm-clear-ichika.mp3']) {
  const file = path.join(ROOT, 'monster-hero/audio', name);
  const data = fs.existsSync(file) ? fs.readFileSync(file) : null;
  check(`audio/${name}: MP3が存在し内容を持つ`, !!data && data.length > 1024 && (data.slice(0, 3).toString() === 'ID3' || data[0] === 0xff));
}

process.exit(failed ? 1 : 0);
