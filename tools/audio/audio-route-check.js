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
  // ★2026-10-15 社長の決定で、場面のBGMだけは <audio> で流しながら鳴らす(解いた音を丸ごと持たないため)。
  //   使ってよいのは「流しながら鳴らす」の部品(streamEntry / unlockStreams / startStream)の中だけで、
  //   必ず MediaElementSource で Web Audio の bgmGain へつなぎ、iOS 17 以降は audioSession を 'ambient'(消音スイッチに従う)にする。
  //   それ以外の場所で <audio> を作る・play() を呼ぶのは、今までどおり禁止
  const streamBlock = audioCode.slice(audioCode.indexOf('const STREAM_POOL_SIZE'), audioCode.indexOf('const dropSceneBuffers'));
  const outside = audioCode.replace(streamBlock, ' ');
  check(`${file}: 流しながら鳴らす部品の外で <audio> を作らない・play() を呼ばない`,
    streamBlock.length > 0 && !/\bnew\s+(?:window\.)?Audio\s*\(|createElement\s*\(\s*['"]audio['"]|<audio\b/i.test(outside) && !/\.play\s*\(/.test(outside));
  check(`${file}: 流しながら鳴らす <audio> は MediaElementSource で bgmGain へつなぐ`,
    /createMediaElementSource\s*\(\s*entry\.el\s*\)/.test(streamBlock) && /entry\.node\.connect\s*\(\s*bgmGain\s*\)/.test(streamBlock));
  check(`${file}: 消音スイッチに従わせる(audioSession を ambient にする)`, /navigator\.audioSession\.type\s*=\s*'ambient'/.test(streamBlock));
  check(`${file}: navigator.audioSessionをplaybackへ変更しない`, !/audioSession[\s\S]{0,80}playback/.test(source));
  // 実コードは fetch(audioUrlWithKey(url), …)。以前は /fetch\s*\(url/ がコメントの字にだけ当たって通っていたので、
  // コメントを外した配信用JSでも実コードで確かめる
  check(`${file}: 音源をfetchしてdecodeAudioDataする`, /fetch\s*\((?:audioUrlWithKey\(\s*)?url\b/.test(audioCode) && /decodeAudioData/.test(audioCode));
  check(`${file}: BGMをAudioBufferSourceNodeでループ再生する`,
    /const startBgmBuffer/.test(audioEngine) && /createBufferSource\s*\(\)/.test(audioEngine) && /source\.loop\s*=\s*track\.loop\s*!==\s*false/.test(audioEngine));
  check(`${file}: ジングルをAudioBufferSourceNodeで再生する`,
    /const playJingle/.test(audioEngine) && /source\.buffer\s*=\s*buffer/.test(audioEngine));
  check(`${file}: ミュートとBGM音量をゲインへ反映する`,
    /!enabled\s*\|\|\s*bgmVolumePct\s*<=\s*0/.test(audioEngine) && /applyTrackGain\(resolveTrack\(previewKey\s*\|\|\s*currentKey\)\)/.test(audioEngine));
  check(`${file}: 同一BGMの重複ソースを作らない`, /bgmSource\s*&&\s*bgmSourceKey\s*===\s*key/.test(audioEngine));
}
process.exit(failed ? 1 : 0);
