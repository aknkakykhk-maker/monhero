// デバッグ設定の入口の合言葉(2026-10-20 社長決定・改善部の見直し M1)を確かめる。
//
//   node tools/boot/debug-passphrase-check.js
//
//   ① ヘルプの「💊」と設定の「🧪 デバッグ設定」は、合言葉を聞く requestDebugSettings を通る(直接 openDebugSettings を呼ばない)
//   ② 合った端末は mh_debug_unlocked_v1 を覚えて次から聞かない。自動操作のブラウザ(navigator.webdriver)では聞かない
//      (検査・手順書が「💊」から開く道を壊さない)
//   ③ 合言葉の文字はソースに無く、塩と PBKDF2(SHA-256)のハッシュだけがある
//   ④ 道具 tools/debug-passphrase-hash.js と画面の照らし方(回数)が同じ
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const storage = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/25-storage.jsx'), 'utf8');

check('ヘルプの「💊」は合言葉を聞く入口を通る', app.includes('onClick={requestDebugSettings}') && !/onClick=\{openDebugSettings\}/.test(app));
check('設定の「🧪 デバッグ設定」も合言葉を聞く入口を通る', app.includes('onOpenDebug={debugEntryKnown?requestDebugSettings:null}'));
const req = (app.split('const requestDebugSettings=')[1] || '').split('\n  };')[0];
check('合った端末(mh_debug_unlocked_v1)と自動操作のブラウザでは聞かずに開く',
  /localStorage\.getItem\(DEBUG_UNLOCK_KEY\)==='1'/.test(req) && /navigator\.webdriver/.test(req) && /openDebugSettings\(\)/.test(req));
const sub = (app.split('const submitDebugPassphrase=')[1] || '').split('\n  };')[0];
check('合ったときだけ覚えて開く(合わなければ開かない)', /if\(!ok\)\{setDebugPassError\('合言葉が違います'\);return;\}/.test(sub)
  && sub.indexOf("localStorage.setItem(DEBUG_UNLOCK_KEY,'1')") > sub.indexOf('if(!ok)') && sub.indexOf('openDebugSettings()') > sub.indexOf('if(!ok)'));
check('保存キーは新しい mh_debug_unlocked_v1', /const DEBUG_UNLOCK_KEY = 'mh_debug_unlocked_v1';/.test(storage));
// 合言葉は短い(数字)ので、ただのハッシュではなく 塩+PBKDF2(SHA-256・回数多め)で照らす(2026-10-20 窓口の指示)
const salt = (storage.match(/const DEBUG_PASSPHRASE_SALT = '([0-9a-f]+)';/) || [])[1] || '';
const iterations = Number((storage.match(/const DEBUG_PASSPHRASE_ITERATIONS = (\d+);/) || [])[1]);
const hash = (storage.match(/const DEBUG_PASSPHRASE_HASH = '([0-9a-f]+)';/) || [])[1] || '';
check('合言葉は 塩(16バイト)+ PBKDF2(SHA-256)のハッシュ(32バイト)だけで持つ', salt.length === 32 && hash.length === 64
  && /subtle\.deriveBits\(\{ name:'PBKDF2', hash:'SHA-256', salt, iterations:DEBUG_PASSPHRASE_ITERATIONS \}/.test(storage));
check('回数は多め(30万回以上。端末で1回0.3〜0.5秒ほど)', iterations >= 300000, String(iterations));
const tool = fs.readFileSync(path.join(ROOT, 'tools/debug-passphrase-hash.js'), 'utf8');
check('ハッシュを作る道具と画面の回数が同じ', tool.includes(`const ITERATIONS = ${iterations};`));
check('合言葉の欄は数字のキーボード・伏せ字', /<input type="password" inputMode="numeric"[^>]*aria-label="合言葉"/.test(app));
check('間違えたら「合言葉が違います」だけ出す', app.includes("setDebugPassError('合言葉が違います')"));
check('前後の空白を除いて照らす・空では開かない', /String\(text \|\| ''\)\.trim\(\)/.test(storage) && /if \(!phrase\) return false;/.test(storage));
// 照らし方の確かめ: 道具と同じ計算(PBKDF2)で、別の字では一致しない
const derive = (s) => crypto.pbkdf2Sync(Buffer.from(s, 'utf8'), Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
check('違う合言葉ではハッシュが一致しない', derive('00000000') !== hash && derive('abc') !== hash);

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
