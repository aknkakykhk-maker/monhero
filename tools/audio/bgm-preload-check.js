#!/usr/bin/env node
// 「次に鳴る曲を、鳴り出す前に読んでおく」導線が外れていないかを確認する。
//
//   node tools/audio/bgm-preload-check.js
//
// 【なぜ道具にするか】
// 曲は開いたときに初めて読む(起動時に読むmp3はタイトル曲だけ)。押してから読み始めると、
// その曲が大きいほど鳴り出しが遅れる。2026-09-21にユーザーから
// 「通常バトル曲のBGMの入りが遅い」と報告があり、タクティクスの通常戦(2.3MB)で出た。
// クラシックのバトルテーマは0.5MBなので、同じ作りのまま何年も気づけなかった。
//
// この遅れは**曲を入れ替えたときにだけ表に出る**。先読みが外れても画面は動くし、
// 手元の速い回線では鳴り出しの差が分からないので、検査でしか気づけない。
//   ・バトルへ向かう画面の一覧から編成の画面が抜ける → 編成中に読まないので開幕が遅れる
//   ・呼ぶ場所が「直前の曲を続ける」の早期returnより後ろへ動く → AUTO中に読まなくなる
//   ・WAVEひとつ手前で読む式が消える → 中ボス戦・ボス戦の入りが遅れる
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};
const decodeUnicodeEscapes = source => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
// ★画面の名前を検査へ書き写さない。本体の配列をそのまま読む
const listOf = (compact, name) => {
  const body = (compact.match(new RegExp(`const${name}=\\[([^\\]]*)\\]`)) || [])[1];
  return body ? body.split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
};

for (const file of files) {
  const source = decodeUnicodeEscapes(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const compact = source.replace(/\s+/g, '');
  const label = path.basename(file);

  const preloadStates = listOf(compact, 'BGM_PRELOAD_BATTLE_STATES');
  const runPhase = listOf(compact, 'RUN_PHASE_STATES');
  check(`${label}: バトルへ向かう画面の一覧がある`, preloadStates.length > 0, `${preloadStates.length}画面`);

  // ★編成・強化のフェーズ(RUN_PHASE_STATES)は、そのままバトルへ入る。ここで読んでおかないと開幕が遅れる。
  //   リザルト系(CHAMPION)はバトルが終わったところなので対象外
  const missing = runPhase.filter(s => s !== 'CHAMPION' && !preloadStates.includes(s));
  check(`${label}: 編成・強化の画面がすべて入っている`, missing.length === 0, missing.join(',') || `${runPhase.length}画面ぶん`);

  // ★難易度えらびから始める。ここを外すと、編成の短いモード(クイック)で読む時間が足りない。
  //   難易度をえらぶ画面は難易度ごとに増えるので、名前を並べずに「そういう画面が入っているか」で見る
  const selects = preloadStates.filter(s => /_SELECT$/.test(s));
  check(`${label}: 難易度・モードをえらぶ画面が入っている`,
    selects.filter(s => /DIFFICULTY_SELECT$/.test(s)).length >= 2 && selects.some(s => /MODE_SELECT$/.test(s)),
    selects.join(','));

  // ★「どのバトルで遊ぶか」を選ぶ前は、まだモードが決まっていない。そこで読むと違う曲を取りに行く
  check(`${label}: 仕組みをえらぶ前の画面では読まない`, !preloadStates.includes('BATTLE_SYSTEM_SELECT'));

  // ★読む曲を決める式。鳴らす曲を決める bgmKeyForState を使い回す(二重に書かない)
  check(`${label}: 読む曲は、鳴らす曲を決める式から取る`,
    /constbgmPreloadKeys=\(state,currentWave\)=>\{/.test(compact)
    && compact.includes("if(BGM_PRELOAD_BATTLE_STATES.includes(state))add(bgmKeyForState('BATTLE',1,null,false,false,false))"));

  // ★WAVE9は中ボス戦、WAVE10はボス戦で曲が変わる。そのひとつ手前で読む
  check(`${label}: 曲が変わるWAVEのひとつ手前で読む`,
    compact.includes("state==='BATTLE'&&Number.isFinite(w)&&w>=8&&w<10")
    && compact.includes("add(bgmKeyForState('BATTLE',w+1,null,false,false,false))"));

  // ★「直前の曲を続ける」は曲名ではない。読む対象から落ちていないと preloadBGM が空振りする
  check(`${label}: 曲ではない合図(__keep__ など)は読まない`,
    compact.includes("!key.startsWith('__')"));
  check(`${label}: 「直前の曲を続ける」を読む対象にしない`,
    /add\(bgmKeyForState\('BATTLE',1,null,false,false,false\)\)/.test(compact));

  // ★呼ぶ場所。AUTO中は早期returnへ入るので、その前で呼ばないと読まなくなる
  // ★compiled は (next)=> を next=> へ縮める。どちらの書き方でも同じ1行として見る
  const callAt = compact.search(/bgmPreloadKeys\(gameState,wave\)\.forEach\(\(?next\)?=>Audio_\.preloadBGM\(next\)\)/);
  const keepReturnAt = compact.indexOf("if(key==='__keep_battle_bgm__'){");
  check(`${label}: BGMの切り替えから呼んでいる`, callAt >= 0);
  check(`${label}: AUTO中の早期returnより先に呼んでいる`, callAt >= 0 && keepReturnAt >= 0 && callAt < keepReturnAt,
    callAt >= 0 && keepReturnAt >= 0 ? `呼ぶ:${callAt} / return:${keepReturnAt}` : '');

  // ★いまの画面の曲を読む今までの1行も残っている(先読みで置き換えたのではなく、足した)
  check(`${label}: いまの画面の曲も今までどおり読む`, compact.includes('if(key)Audio_.preloadBGM(key)'));
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
