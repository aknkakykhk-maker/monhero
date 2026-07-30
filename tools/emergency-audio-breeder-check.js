const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const unlock = source.slice(source.indexOf('const unlock = async'), source.indexOf('const ensurePlaying'));
const boot = source.slice(source.indexOf('const unlockBootSound'), source.indexOf("useEffect(() => {\n    if (bootPhase !== 'TITLE')"));
const ranking = source.slice(source.indexOf('const loadRankings = useCallback'), source.indexOf('// 寄付・合体・削除'));

assert(unlock.includes('if (!enabled) enabled = true'));
assert(boot.indexOf('Audio_.setEnabled(true)') < boot.indexOf('await Promise.all'));
assert(boot.indexOf('Audio_.unlock(true)') < boot.indexOf('await Promise.all'));
assert(boot.indexOf("Audio_.playBGM('title')") < boot.indexOf('await Promise.all'));
assert(boot.includes('audioMuted ? Promise.resolve(false)'));
assert(source.includes("storeGet('mh_audio_muted', false, false)"));
assert(source.includes("storeSet('mh_audio_muted', !quickMuted, false)"));
assert(ranking.includes("includeLevels ? levelKind : 'score'"));
assert(ranking.includes('const latestKey = includeLevels ? requestKey : d'));
assert(source.includes("loadRankings(null,true,false,t.k)"));
assert(source.includes("loadRankings(null,true,true,'breeder')"));
assert(source.includes('breederRankingLoading') && source.includes('breederRankingFailed'));

console.log('OK: 起動タップの音声有効化・保存ミュート保護・ブリーダーLv独立取得/UI状態');
