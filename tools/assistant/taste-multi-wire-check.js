// マルチで助手と一緒に遊んだとき、助手の好き・苦手(assistantLifeTasteBump)へ 'win' / 'lose' が配線されていることを見る(2026-11-15 r1115-007 の配線)。
//   node tools/assistant/taste-multi-wire-check.js
// 見ること:
//   ・マルチの演奏の結果(60-app.jsx の onComplete)から assistantLifeTasteBump を呼ぶ。クリアは 'win'、同じ日の3連敗は 'lose'
//   ・呼ぶのは「助手のCPUがいる」「マスモン(モンスターノーツ)を入れている」ときだけ。落ちても演奏の結果は止めない(try)
//   ・マルチ以外(ひとり用)では呼ばない
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const i = src.indexOf("// 助手の好き・苦手が遊ぶうちに変わる(r1115-007");
const block = i >= 0 ? src.slice(i, src.indexOf('}catch(_){/* 好き・苦手の配線', i) + 80) : '';
check('マルチの演奏の結果に、好き・苦手の配線がある', !!block);
check("マルチのときだけ呼ぶ(rhythmPlay.from==='multi')", /rhythmPlay\.from==='multi'&&typeof assistantLifeTasteBump==='function'/.test(block));
check("クリアは 'win'・同じ日の3連敗は 'lose'", /kind='win'/.test(block) && /kind='lose'/.test(block) && /tasteLoseRef\.current\.n>=3/.test(block));
check('助手のCPU(m.cpu && m.as)とマスモン(baseId)がそろったときだけ', /m\.cpu&&m\.as/.test(block) && /tasteMons\.length&&tasteAssistants\.length/.test(block));
check('配線が落ちても演奏の結果は止めない(try / catch)', /try\{[\s\S]*\}catch\(_\)/.test(block));
check('呼ぶ先は助手id・モンスターid・種類の順(assistantLifeTasteBump(aid,mon,kind))', /assistantLifeTasteBump\(aid,mon,kind\)/.test(block));
const defSrc = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/56-assistant-life-masmon-taste.jsx'), 'utf8');
check('呼ぶ先の受け口が今も(助手id, モンスターid, 種類)の形', /const assistantLifeTasteBump = \(aid, monsterId, kind, now = Date\.now\(\)\)/.test(defSrc));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
