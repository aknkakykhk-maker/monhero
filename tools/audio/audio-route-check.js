const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// iOSの消音スイッチを尊重するため、配信コードを含む全音声経路がWeb Audioであることを確認する。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(TOOLS_DIR, '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };

for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const audioEngine = source.slice(source.indexOf('const Audio_ ='), source.indexOf('const MOO_IMG'));
  // 説明のコメントに <audio> の字が出てくる(キャッシュキーの目印 <audio-cache-keys> と、
  // 「BGMは <audio> ではなく Web Audio」という但し書き)。コメントは実行されないので、
  // ここだけはコメントを外したコードを見る。実コードに対する厳しさは変えない。
  const audioCode = audioEngine.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  check(`${file}: HTMLAudioElement/new Audioを使用しない`,
    !/\bnew\s+Audio\s*\(|createElement\s*\(\s*['"]audio['"]|<audio\b/i.test(audioCode));
  check(`${file}: HTML Audioのplay()を直接呼ばない`, !/\.play\s*\(/.test(audioCode));
  check(`${file}: MediaElementSourceを使用しない`, !/createMediaElementSource/.test(audioEngine));
  check(`${file}: navigator.audioSessionをplaybackへ変更しない`, !/audioSession[\s\S]{0,80}playback/.test(source));
  check(`${file}: 音源をfetchしてdecodeAudioDataする`, /fetch\s*\(url/.test(audioEngine) && /decodeAudioData/.test(audioEngine));
  check(`${file}: BGMをAudioBufferSourceNodeでループ再生する`,
    /const startBgmBuffer/.test(audioEngine) && /createBufferSource\s*\(\)/.test(audioEngine) && /source\.loop\s*=\s*track\.loop\s*!==\s*false/.test(audioEngine));
  check(`${file}: ジングルをAudioBufferSourceNodeで再生する`,
    /const playJingle/.test(audioEngine) && /source\.buffer\s*=\s*buffer/.test(audioEngine));
  check(`${file}: ミュートとBGM音量をゲインへ反映する`,
    /!enabled\s*\|\|\s*bgmVolumePct\s*<=\s*0/.test(audioEngine) && /applyTrackGain\(resolveTrack\(previewKey\s*\|\|\s*currentKey\)\)/.test(audioEngine));
  check(`${file}: 同一BGMの重複ソースを作らない`, /bgmSource\s*&&\s*bgmSourceKey\s*===\s*key/.test(audioEngine));
}
process.exit(failed ? 1 : 0);
