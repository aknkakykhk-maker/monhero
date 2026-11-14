// 「ゲームにある BGM の音源は、すべて BGMアレンジで選べる」ことを見張る(2026-11-14 社長「BGMアレンジは音源すべて入れる仕組みにして」)。
//
//   node tools/audio/bgm-all-tracks-check.js
//
// 仕組み: 設定のBGMアレンジの曲の欄は BGM_TRACKS をそのまま全部並べる(絞り込みは無い)。
// だから「新しい曲を BGM_TRACKS に足す」だけで、手で一覧に書かなくても全場面の欄に並ぶ。
// ここで守るのは次の4つ。
//   A. audio/ の bgm-*.mp3 は、すべて BGM_TRACKS に入っている(入れ忘れて選べない曲を作らない)
//   B. 曲の欄が BGM_TRACKS を絞らずに並べている(絞り込みを足されても気づく)
//   C. BGM_TRACKS の id は重ならず、音源のファイルが実在する
//   D. モンヒロビートの曲(RHYTHM_SONGS の bgmTrackId)も、BGM_TRACKS にある曲を指している
// 例外は下の名前つきの一覧だけ(効果音・ジングル・デバッグ専用)。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const settings = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// BGM_TRACKS の本体(const BGM_TRACKS = [ ... ];)
const start = settings.indexOf('const BGM_TRACKS = [');
const end = settings.indexOf('\n];', start);
const body = start >= 0 && end > start ? settings.slice(start, end) : '';
check('BGM_TRACKS を切り出せる', body.length > 0);
const tracks = [...body.matchAll(/\{\s*id:'([^']+)'[^}]*?src:'([^']+)'/g)].map((m) => ({ id: m[1], src: m[2] }));
check('BGM_TRACKS が読める', tracks.length >= 90, `${tracks.length}曲`);

// A. audio/ の bgm-*.mp3
const EXEMPT = new Map([
  ['bgm-sheriruth-proto.mp3', 'デバッグ専用の試作(BGM_PROTO_TRACKS・プレイヤーに見せない)'],
]);
const files = fs.readdirSync(path.join(root, 'monster-hero/audio')).filter((f) => /^bgm-.*\.mp3$/.test(f));
const inTracks = new Set(tracks.map((t) => path.basename(t.src)));
const lost = files.filter((f) => !inTracks.has(f) && !EXEMPT.has(f));
check('audio/ の BGM の音源が、すべて BGM_TRACKS に入っている(BGMアレンジで選べる)', lost.length === 0, lost.join(', ') || `${files.length}ファイル / 例外 ${EXEMPT.size}`);
const staleExempt = [...EXEMPT.keys()].filter((f) => !files.includes(f));
check('例外の一覧に、もう無いファイルが残っていない', staleExempt.length === 0, staleExempt.join(', ') || '');

// B. 曲の欄は BGM_TRACKS を絞らない
const pickers = [...app.matchAll(/\{BGM_TRACKS\.([a-zA-Z]+)\(track=>/g)].map((m) => m[1]);
check('BGMアレンジの曲の欄が BGM_TRACKS をそのまま並べている(絞り込みなし)', pickers.length >= 1 && pickers.every((f) => f === 'map'), `${pickers.length}か所`);

// C. id が重ならない・音源が実在する
const ids = tracks.map((t) => t.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
check('BGM_TRACKS の id が重ならない', dup.length === 0, dup.join(', ') || '');
const missingFile = tracks.filter((t) => !fs.existsSync(path.join(root, 'monster-hero', t.src)));
check('BGM_TRACKS の音源が実在する', missingFile.length === 0, missingFile.map((t) => t.id).join(', ') || '');

// D. モンヒロビートの曲の bgmTrackId
const rhythm = read('monster-hero/data/rhythm-mode.js');
const rhythmIds = [...new Set([...rhythm.matchAll(/bgmTrackId\s*:\s*'([^']+)'/g)].map((m) => m[1]))];
const idSet = new Set(ids);
const unknown = rhythmIds.filter((id) => !idSet.has(id) && id !== 'melo_sheriruth_proto');
check('モンヒロビートの曲の bgmTrackId が、BGM_TRACKS にある曲を指している', unknown.length === 0, unknown.join(', ') || `${rhythmIds.length}種`);

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
