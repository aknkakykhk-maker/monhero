// BGM/ジングルのHTMLAudioElementが、再生前にWeb Audioへ接続されることを静的に確認する。
// iOSの消音モード自体は自動化できないため、消音モードを無視するメディア再生経路へ
// 一瞬でも漏れないための必須条件を、編集元と配信用生成物の両方で検証する。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [
  'monster-hero/src/game-system.jsx',
  'monster-hero/game-system.compiled.js',
];
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
};

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const connectStart = source.indexOf('const connectBgmToGain =');
  const connectEnd = source.indexOf('const stopJingles =', connectStart);
  const connectBody = source.slice(connectStart, connectEnd);
  const playStart = source.indexOf('const _playBGM =');
  const playEnd = source.indexOf('let bgmQueue =', playStart);
  const playBody = source.slice(playStart, playEnd);
  const immediateStart = source.indexOf('const startCurrentBgmNow =');
  const immediateEnd = source.indexOf('const ensurePlaying =', immediateStart);
  const immediateBody = source.slice(immediateStart, immediateEnd);
  const jingleStart = source.indexOf('const playJingle =');
  const jingleEnd = source.indexOf('const connectJingleToGain =', jingleStart);
  const jingleBody = source.slice(jingleStart, jingleEnd);

  check(`${file}: AudioContextがsuspendedでもBGMを接続できる`,
    connectStart >= 0 && !/ctx\.state\s*!==\s*['"]running['"]/.test(connectBody));
  check(`${file}: 通常BGMはplay()より前に接続される`,
    playBody.indexOf('connectBgmToGain(key)') >= 0
      && playBody.indexOf('connectBgmToGain(key)') < playBody.indexOf('el.play()'));
  check(`${file}: 初回タップの同期再生もplay()より前に接続される`,
    immediateBody.indexOf('connectBgmToGain(currentKey)') >= 0
      && immediateBody.indexOf('connectBgmToGain(currentKey)') < immediateBody.indexOf('el.play()'));
  check(`${file}: ジングルはplay()より前に接続される`,
    jingleBody.indexOf('connectJingleToGain(key)') >= 0
      && jingleBody.indexOf('connectJingleToGain(key)') < jingleBody.indexOf('el.play()'));
}

process.exit(failed ? 1 : 0);
