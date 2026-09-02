// 音ゲーのBGM／タップ音量を、メインゲーム(HOME)の音量設定から独立させたことを確かめる。
//
// 修正前は、音ゲーのBGMがメインのbgmGain(HOMEのBGM音量、対数カーブ)を経由してから
// 音ゲー側のrhythmGain(線形)を掛けていたため、両方の音量設定が掛け算になっていた。
// メイン側のBGM音量が低い(または0)だけで、音ゲー側をどれだけ上げても小さいまま・無音になる。
//
// 対応方針(ユーザー確定): 音量は完全に独立させる。ただし全体ミュート
// (タイトル画面の「音がオフです」)だけは共通に効かせる。
//
//   node tools/mode/rhythm-audio-independence-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx'),data=read('monster-hero/data/rhythm-mode.js'),changelog=read('monster-hero/data/changelog.js'),help=read('monster-hero/data/help.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

check('音ゲーBGMのgainノードはメインのbgmGainではなくctx.destinationへ直結',
  game.includes('nextSource.connect(rhythmGain);rhythmGain.connect(ctx.destination);')
  &&!game.includes('nextSource.connect(rhythmGain);rhythmGain.connect(bgmGain);'));
check('音ゲーBGMの音量はメインのBGM音量(bgmVolumePct)を掛けない',
  !/rhythmGain\.gain\.value[^;]*bgmVolumePct/.test(game)
  &&!/startRhythmTrack[\s\S]{0,400}applyTrackGain\(track\)/.test(game));
check('曲ごとの音量差はsafeTrackGainで正規化する',
  /const raw=Math\.max\(0,Math\.min\(1,Number\(rhythmVolumePct\)\/100\)\)\*safeTrackGain\(track\);/.test(game));

check('全体ミュート(enabled)はグローバル変数として公開する',
  game.includes("if (typeof window !== 'undefined') window.__mhAudioEnabled = enabled;"));
check('setEnabledは稼働中の音ゲーgainへもミュートを反映する',
  game.includes('applyRhythmMute();')&&game.includes('const applyRhythmMute = () => { activeRhythmGains.forEach(entry => { entry.node.gain.value = enabled ? entry.raw : 0; }); };'));
check('unlock()経由でミュート解除された場合も反映する',
  /if \(!enabled\) \{ enabled = true; if \(typeof window !== 'undefined'\) window\.__mhAudioEnabled = true; applyRhythmMute\(\); \}/.test(game));
check('音源停止時はgainノードの登録を解除する(古いノードにミュート操作が残らない)',
  game.includes('stop:()=>{if(stopped)return;stopped=true;playing=false;const old=source;source=null;stopSource(old);dropGainEntry();}'));

check('タップ音(SE)もメインの全体ミュートだけ共通で見る',
  data.includes("const rhythmAudioGloballyEnabled=()=>typeof window==='undefined'||window.__mhAudioEnabled!==false;")
  &&(data.match(/rhythmAudioGloballyEnabled\(\)/g)||[]).length>=2);
check('タップ音のplay/emitEmptyの両方でミュートを判定',
  /if\(!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)\)return false;[\s\S]*?const audio=context\(\);\s*if\(!audio\)return false;\s*if\(audio\.state==='suspended'&&typeof audio\.resume==='function'\)audio\.resume\(\)\.catch\(\(\)=>\{\}\);\s*const oscillator=/.test(data)
  &&/if\(!settings\.enabled\|\|settings\.volume<=0\|\|!rhythmAudioGloballyEnabled\(\)\)return false;[\s\S]*?const duration=\.055/.test(data));

check('デフォルト(window.__mhAudioEnabledが未設定)ではミュート扱いにしない',
  data.includes('window.__mhAudioEnabled!==false'));

check('オプション画面に独立設定であることの説明を表示',
  game.includes('この音量はメインゲームの音量設定と別に、音ゲーだけで使います。タイトル画面の全体ミュートのみ共通です。'));
check('ヘルプにも独立設定であることを明記',
  help.includes('メインゲームの音量設定(HOMEの音量設定)とは別に音ゲーだけで使う独立した値'));
check('更新履歴に修正内容を記載',
  changelog.includes('音ゲーのBGM／タップ音量をメインの音量設定から独立させました'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
