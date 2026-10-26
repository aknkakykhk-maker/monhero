#!/usr/bin/env node
// 会話イベントの途中で曲を替える(2026-10-17 社長「途中で変わるのいいね」)の作りを見る。
//
//   node tools/assistant/event-line-bgm-check.js
//
//   ① eventScriptBgmAt: その行までに書かれた最後の bgm を返す。無ければ null。曲の表に無い id は使わない
//   ② 台本に書いた bgm はすべて曲の表(BGM_TRACKS)にある
//   ③ bgm を書いていない会話イベントは今までどおり(曲は会話イベントの1曲だけ)
//   ④ 曲を替えるときは今の曲を下げてから移す(Audio_.fadeToBGM・EVENT_BGM_FADE_MS)。同じお話の中で替わるときだけ使う
//   ⑤ 案D(tactics_types)は、名乗りまでイベントBGM 1、ドラが前に立つ行から戦場の疾風。公開の印は偽(回想に出ない)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const bgm = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');
const ctx = {};
vm.createContext(ctx);
const tracksSrc = bgm.slice(bgm.indexOf('const BGM_TRACKS = ['), bgm.indexOf('];', bgm.indexOf('const BGM_TRACKS = [')) + 2);
vm.runInContext(tracksSrc.replace(/^const /, 'var '), ctx);
const fnStart = bgm.indexOf('const eventScriptBgmAt = ');
const fnSrc = bgm.slice(fnStart, bgm.indexOf('\n};', fnStart) + 3);
vm.runInContext(fnSrc.replace(/^const /, 'var '), ctx);
const at = ctx.eventScriptBgmAt;
const ids = new Set(ctx.BGM_TRACKS.map((t) => t.id));

// ①
const s = [{ t: 'a' }, { t: 'b', bgm: 'senjou_no_shippuu' }, { t: 'c' }, { t: 'd', bgm: 'no_such_song' }];
check('① 書いてある行より前は null', at(s, 0) === null);
check('① 書いた行からその曲', at(s, 1) === 'senjou_no_shippuu' && at(s, 2) === 'senjou_no_shippuu');
check('① 曲の表に無い id は使わない(前の曲のまま)', at(s, 3) === 'senjou_no_shippuu');
check('① 台本が無い・空なら null', at(null, 0) === null && at([], 0) === null);

// ② ③ ⑤
const assistants = read('monster-hero/data/assistants.js');
const written = [...assistants.matchAll(/\bbgm:'([^']+)'/g)].map((m) => m[1]);
check('② 台本に書いた bgm はすべて曲の表にある', written.length > 0 && written.every((id) => ids.has(id)), written.join(', '));
const types = assistants.slice(assistants.indexOf('const ASSISTANT_TACTICS_TYPES = ['), assistants.indexOf('];', assistants.indexOf('const ASSISTANT_TACTICS_TYPES = [')));
const lines = types.split('\n').filter((l) => /\{ who:/.test(l));
const switchAt = lines.findIndex((l) => /bgm:'senjou_no_shippuu'/.test(l));
check('⑤ 案Dはドラが前に立つ行から戦場の疾風', switchAt > 0 && /who:'dra'/.test(lines[switchAt]) && /タンク/.test(lines[switchAt]), `${switchAt + 1}行目`);
// 2026-10-22 きゅうこの加入のお話も、きゅうこ登場の前に Toward the Stars へ替える(社長の決定。holdMs で数秒止まる)
check('③ bgm を書いているのは案Dと、きゅうこの加入のお話だけ(ほかの会話イベントは今までどおり)',
  written.length === 2 && written.includes('senjou_no_shippuu') && written.includes('melo_toward_the_stars_short'), written.join(', '));
check('⑤ 案Dの会話イベントの曲はイベントBGM 1', /tactics_types:'tacticsTypesEvent'/.test(bgm) && /tacticsTypesEvent:'original_event_01'/.test(bgm));
const core = read('monster-hero/src/parts/10-core.jsx');
check('⑤ 案Dはヘイトの公開の印と一緒に出る', /get tacticsTypes\(\) \{ return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS\.tacticsHate === true; \}/.test(core) && /releaseFlag: 'tacticsTypes'/.test(assistants));

// ④
const audio = read('monster-hero/src/parts/14-audio.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
check('④ 音の部品に fadeToBGM があり、外から呼べる', /const fadeToBGM = \(key, ms = 800\)/.test(audio) && /playBGM, fadeToBGM, stopBGM/.test(audio));
check('④ 次の曲を鳴らすときは下げる予定を消してから音量を戻す', /const applyTrackGain = track => \{ if \(bgmGain\) \{ try \{ bgmGain\.gain\.cancelScheduledValues\(0\)/.test(audio));
check('④ 同じお話の中で曲が替わるときだけ下げてから移す', /prev && prev\.id === eventId && prev\.key !== key\) Audio_\.fadeToBGM\(key, EVENT_BGM_FADE_MS\)/.test(app) && /const EVENT_BGM_FADE_MS = 800;/.test(bgm));
check('④ 曲の決め方は、行の bgm → 会話イベントの曲 の順', /if \(eventLineBgm\) return eventLineBgm;\n\s*if \(eventBgmScene\) return bgmArrangementWithEventDefault/.test(app));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
