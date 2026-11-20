#!/usr/bin/env node
// モンヒロビートの曲が鳴っているあいだ、フレンドの知らせ(自己ベストの読み直し・記録づくり・送信)を走らせないかを見張る。
// 2026-11-21 r1119-057「ノーツが一瞬止まって飛ぶ」: 演奏画面に入って数秒後と2分ごとの送信が曲の最中に重なり、1コマが長くなっていた。
//   node tools/friends/friend-publish-song-quiet-check.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', 'monster-hero/src/parts');
const app = fs.readFileSync(path.join(ROOT, '60-app.jsx'), 'utf8');
const api = fs.readFileSync(path.join(ROOT, '34-friends-api.jsx'), 'utf8');
let ng = 0; const ok = (name, pass, detail) => { console.log(`${pass ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); if (!pass) ng++; };

ok('曲が鳴っているかは演奏画面の印(window.__mhSongPlaying)で見る', /const friendsSongPlaying = \(\) => \{[^\n]*window\.__mhSongPlaying/.test(api));
const pub = (app.match(/const publishFriendProfile = useCallback\(async \(\) => \{[\s\S]{0,200}/) || [''])[0];
ok('送る関数の入口で、曲が鳴っていたら送らずに後回しの印を立てる', /if \(!friendsActive\) return;\s*if \(friendsSongPlaying\(\)\) \{ friendPublishDeferredRef\.current = true; return; \}/.test(pub));
ok('後回しにした分は、曲の終わり(mh:song-play-end)から少し待って1回送る', /addEventListener\('mh:song-play-end', onEnd\)/.test(app) && /if \(!friendPublishDeferredRef\.current\) return; friendPublishDeferredRef\.current = false;[^\n]*setTimeout\(publishFriendProfile, FRIEND_PUBLISH_AFTER_SONG_MS\)/.test(app));
ok('演奏画面に入ったら、曲が鳴る前(幕のあいだ)に送る', /gameState === 'RHYTHM_PLAY' \? FRIEND_PUBLISH_BEFORE_SONG_MS :/.test(app) && /const FRIEND_PUBLISH_BEFORE_SONG_MS = (\d+);/.test(api) && Number(api.match(/const FRIEND_PUBLISH_BEFORE_SONG_MS = (\d+);/)[1]) < 1000);
ok('フレンド申請の見回りも、曲が鳴っているあいだは見送る', /!friendsSongPlaying\(\)\) refreshFriendRequests\(\); \}, 3 \* 60 \* 1000\)/.test(app));
console.log(ng ? `NG ${ng} 件` : 'すべてOK');
process.exitCode = ng ? 1 : 0;
