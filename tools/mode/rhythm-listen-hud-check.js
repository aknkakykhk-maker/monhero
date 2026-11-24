#!/usr/bin/env node
// 曲鑑賞の画面の表示(2026-11-23 r1119-151 社長「鑑賞のジャケットがちいさい。あと設定でいじれていいからコンボ数の表示とか判定の表示とかもいれたい」)。
// ソースを読むだけ(すぐ終わる)。見るもの:
//   ・鑑賞で隠す物(RHYTHM_LISTEN_HIDE_CSS)に、判定の文字・コンボ数が入っていない(出す・出さないはふつうに遊ぶ時の設定に従う)
//   ・スコア・ライフなど(右上の列・進みぐあい・ずれのメーター)は今までどおり隠す。左上はスコアの行を詰め、曲名の行だけ残す
//   ・判定の文字・コンボ数は、ふつうの設定(judgmentTextDisplay・comboDisplay)で切れる
//   ・鑑賞中は曲名の横のジャケットを大きくし、4秒で薄くする動き(hudSongFade)を効かせない
//   ・鑑賞の画面の入/切(r1119-151 追記): 新しいキーに覚え、鑑賞のあいだだけ上書きする。オプションの保存値は変えない
//   ・判定とコンボは別々のボタン・別々のキー(2026-11-24 r1119-162)。前のまとめたキーは読むだけ(書かない)
//   ・操作を隠すと、ふつうに遊ぶ時と同じ形(listenLook=false)。押して確かめるのは rhythm-listen-toggles-check.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
let ng = 0; const ok = (cond, label) => { console.log(`${cond ? 'OK' : 'NG'}: ${label}`); if (!cond) ng++; };
const m = src.match(/const RHYTHM_LISTEN_HIDE_CSS='([^']*)'/); const css = m ? m[1] : '';
ok(!!css, '鑑賞で隠す CSS がある');
for (const sel of ['[data-rhythm-judgment-display]', '[data-rhythm-sky-judgment-display]', '[data-rhythm-combo]', '[data-rhythm-combo-box]'])
  ok(!css.includes(sel), `鑑賞で ${sel} を隠さない(判定の文字・コンボ数を出す)`);
for (const sel of ['[data-rhythm-hud-right]', '[data-rhythm-pace]', '[data-rhythm-timing-meter]'])
  ok(css.includes(sel), `鑑賞で ${sel} は隠したまま(スコア・ライフなど)`);
ok(/\[data-rhythm-hud-left\]>:not\(\[data-rhythm-hud-songline\]\)\{display:none!important\}/.test(css), '左上はスコアの行を詰めて、曲名の行(ジャケット)だけ残す');
ok(/settings\.comboDisplay===false/.test(src), 'コンボ数はふつうの設定(comboDisplay)で切れる');
ok(/settings\.judgmentTextDisplay\?last:''/.test(src), '判定の文字はふつうの設定(judgmentTextDisplay)で切れる');
ok(/data-rhythm-hud-art[^>]*className=\{listenLook\?"h-16 w-16[^"]*landscape:h-14 landscape:w-14"/.test(src), '鑑賞中はジャケットを大きくする(縦 64px・横 56px)');
ok(/settings\.hudSongFade===false\|\|listenLook\)\{setHudSongDim\(false\)/.test(src), '鑑賞中は曲名とジャケットを薄くしない');
// 鑑賞の画面の「判定・コンボ」入/切(2026-11-23 r1119-151 追記 社長「鑑賞の画面でワンタップで変えられるように」)
ok(/const RHYTHM_LISTEN_HUD_KEY='mh_rhythm_listen_hud_v1';/.test(src), '入/切は新しいキー mh_rhythm_listen_hud_v1 に覚える');
ok(/if\(v==='1'\)return true;if\(v==='0'\)return false;\}catch\{\}\s*return !!settings&&\(settings\.judgmentTextDisplay!==false\|\|settings\.comboDisplay!==false\);/.test(src), '無い・壊れているときは、オプションのどちらかが入なら入');
// 判定とコンボを分ける(2026-11-24 r1119-162 社長「判定とかコンボの入りきりをひとにまとめないで」)
ok(/const RHYTHM_LISTEN_JUDGE_KEY='mh_rhythm_listen_judge_v1';/.test(src) && /const RHYTHM_LISTEN_COMBO_KEY='mh_rhythm_listen_combo_v1';/.test(src), '判定とコンボは別々の新しいキーに覚える');
ok(/const rhythmListenFlagRead=\(key,settings\)=>\{[^\n]*if\(v==='1'\)return true;if\(v==='0'\)return false;\}catch\{\}\s*return rhythmListenHudRead\(settings\);\};/.test(src), '新しいキーが無いときは、前のまとめた入/切(と前と同じ既定)を読む');
ok(!/rhythmListenHudWrite\(/.test(src.slice(src.indexOf('const rhythmListenHudWrite') + 30)), '前のまとめたキー(mh_rhythm_listen_hud_v1)は、もう書かない');
ok(/listenMode&&lined\?\{\.\.\.lined,judgmentTextDisplay:listenJudge,comboDisplay:listenCombo,\.\.\.\(listenJudge\?\{\}:\{fastSlowDisplay:false\}\)\}:lined/.test(src), '鑑賞のあいだだけ、判定の文字(切なら FAST・SLOW も)とコンボ数を別々に上書きする');
ok(!/setItem\('mh_rhythm_settings_v1'/.test(src.slice(src.indexOf('const rhythmListenHudWrite'), src.indexOf('const RhythmListenBar'))), 'オプションの保存値(mh_rhythm_settings_v1)は書かない');
ok((src.match(/\{judgeToggle\}\{comboToggle\}/g) || []).length === 2 && (src.match(/\{hideBtn\}/g) || []).length === 2, '判定・コンボ・隠すのボタンは横(右の列)と縦(下の帯)の両方にある');
ok(/data-rhythm-listen-toggle=\{key\} data-state=\{on\?'on':'off'\} aria-pressed=\{on\}/.test(src) && /min-h-\[44px\] min-w-0 flex-1 flex-col/.test(src), '入/切のボタンは押せる高さ(44px)で、いまの状態が分かる');
// 操作を隠す(r1119-162)。隠したら演奏する時と同じ見た目、叩くと戻る
ok(/const listenLook=listenMode&&!listenBarHidden;/.test(src), '操作を隠したら、上の表示はふつうに遊ぶ時と同じ形(listenLook)');
ok(/listenBarHidden\?<RhythmListenReveal onShow=\{\(\)=>setListenBarHidden\(false\)\}/.test(src), '隠したあと、画面を叩くと操作が戻る');
ok(!/localStorage[^\n]*listenBarHidden|listenBarHidden[^\n]*localStorage/.test(src), '隠したかどうかは覚えない(鑑賞を開くたびに出た状態から)');
{ const doc = fs.readFileSync(path.join(__dirname, '../../docs/spec/SAVE_DATA.md'), 'utf8'); ok(['mh_rhythm_listen_hud_v1', 'mh_rhythm_listen_judge_v1', 'mh_rhythm_listen_combo_v1'].every(k => doc.includes('| `' + k + '` |')), 'SAVE_DATA.md に入/切のキーの行がある'); }
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべてOK');
process.exitCode = ng ? 1 : 0;
