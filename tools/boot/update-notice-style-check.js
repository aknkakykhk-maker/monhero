// 新しいバージョンのお知らせ(更新バナー)の出し方の設定を見張る。
//
//   node tools/boot/update-notice-style-check.js
//
// 【なぜ要るか】
// 2026-09-13・ユーザー依頼「更新バナーのオンオフをゲーム上の設定で出来るようにしたい /
// オン / 小さく表示みたいな / オフ」「※モンビー中にレーン上部に出ると邪魔だから
// そこを避けれる位置に出るみたいな」。
//
// 気をつける点が3つある。
//  ・保存の追加なので、既存のキーを触らないこと(CLAUDE.md ⑦)。読むときは必ず
//    正規化を通し、保存が無い既存ユーザーはこれまでどおりの見え方になること
//  ・「出さない」を選んだ人が更新できなくなってはいけない。設定の「ゲームを更新」が
//    別にあるので、そこが残っていること
//  ・演奏中(RHYTHM_PLAY)はどこにも出さないこと。
//    はじめは「上はレーンの奥に重なるから右下へ」としたが、ユーザー指摘
//    「画面の右下ってモンビー演奏中のレーン上に来ない？」でそのとおりだった。
//    プレイエリアは画面の下端まで占め、レーンは inset:0 の全面。台形は下がいちばん広い
//    (上は 27〜73%、下は 0〜100%)ので、右下はいちばん右のレーンの真上になる。
//    判定ラインの下は指で叩く場所で、誤って押すと曲が中断されて記録が消える。
//    台形の外で空いているのは上部の左右の三角形だけだが、そこは HUD が使っている。
//    ここが戻ると「レーンに重なって邪魔」が再発する
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const core=read('monster-hero/src/parts/10-core.jsx');
const app=read('monster-hero/src/parts/60-app.jsx');
const settings=read('monster-hero/src/parts/51-screen-settings.jsx');
const help=read('monster-hero/data/help.js');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 正規化と保存キー -------------------------------------------------------
const block=core.match(/const UPDATE_NOTICE_STYLES[\s\S]*?const UPDATE_NOTICE_STYLE_LABELS[\s\S]*?\]\);/)?.[0];
if(!block){console.log('✗ 10-core.jsx から UPDATE_NOTICE_* を切り出せません');process.exit(1);}
const ctx={Object};vm.createContext(ctx);
vm.runInContext(`${block}\nthis.out={UPDATE_NOTICE_STYLES,normalizeUpdateNoticeStyle,UPDATE_NOTICE_STYLE_KEY,UPDATE_NOTICE_STYLE_LABELS};`,ctx);
const {UPDATE_NOTICE_STYLES:STYLES,normalizeUpdateNoticeStyle:norm,UPDATE_NOTICE_STYLE_KEY:KEY,UPDATE_NOTICE_STYLE_LABELS:LABELS}=ctx.out;

check('選べるのは3つ(ふつう・小さく・出さない)',
  STYLES.length===3&&STYLES.includes('FULL')&&STYLES.includes('MINI')&&STYLES.includes('OFF'),STYLES.join(' / '));
check('保存キーは新しいものを足している',
  KEY==='mh_update_notice_style_v1',KEY);
check('既存の保存キーの名前を流用していない',
  !/mh_(battle_speed|se_volume|bgm_volume|audio_muted|bgm_arrangement)/.test(KEY));
// 保存が無い・壊れている既存ユーザーが、これまでと同じ見え方になること(⑦)
check('保存が無い・知らない値は「ふつう」に落ちる',
  norm(undefined)==='FULL'&&norm(null)==='FULL'&&norm('')==='FULL'&&norm('HUGE')==='FULL'
  &&norm(0)==='FULL'&&norm({})==='FULL'&&norm([])==='FULL',
  `undefined→${norm(undefined)} / 'HUGE'→${norm('HUGE')}`);
check('正しい値はそのまま通る',
  STYLES.every(id=>norm(id)===id));
check('画面に出す名前を一覧として持っている(手で書き写さない)',
  Array.isArray(LABELS)&&LABELS.length===STYLES.length&&LABELS.every(o=>o.id&&o.label&&o.note),
  LABELS.map(o=>o.label).join(' / '));

// --- 読み書き ---------------------------------------------------------------
check('読むときに正規化を通している',
  /normalizeUpdateNoticeStyle\(await storeGet\(UPDATE_NOTICE_STYLE_KEY, 'FULL', false\)\)/.test(app));
check('書くときも正規化を通している',
  /const value = normalizeUpdateNoticeStyle\(next\);[\s\S]{0,200}storeSet\(UPDATE_NOTICE_STYLE_KEY, value, false\)/.test(app));

// --- 出し方 -----------------------------------------------------------------
check('「出さない」のときは出さない',
  /updateNoticeVisible && updateNoticeMode !== 'OFF'/.test(app));
check('「小さく」のときだけ小さい形で出す',
  /const updateNoticeSmall = updateNoticeMode === 'MINI';/.test(app));
// ここが戻ると「モンビー演奏中のレーンに重なって邪魔」が再発する
check('演奏中(RHYTHM_PLAY)はどこにも出さない',
  /updateNoticeOnPlay = gameState === 'RHYTHM_PLAY'/.test(app)
  &&/updateNoticeVisible && updateNoticeMode !== 'OFF' && !updateNoticeOnPlay/.test(app));
// レーンの上へ置く逃げ道(下端・右下)を塞ぐ。プレイエリアは画面の下端まであるので、
// 「下へ出す」は必ずレーンの上になる
check('演奏中の逃げ場として画面の下端を使っていない',
  !/safe-area-inset-bottom/.test(app.slice(app.indexOf('const updateNoticeMode'), app.indexOf('const titleModal'))));
check('出す場所はどちらの形でも画面の上',
  (app.match(/data-update-notice-place="top"/g)||[]).length===2);
check('どちらの形でも「閉じる」ボタンがある',
  (app.match(/aria-label="あとで更新する（この通知を閉じる）"/g)||[]).length===2);

// --- 設定画面 ---------------------------------------------------------------
check('設定画面に3択を置いている',
  settings.includes('data-update-notice-setting')&&/UPDATE_NOTICE_STYLE_LABELS\.map/.test(settings));
check('3択は一覧から作る(名前を手で書き写していない)',
  !/'ふつう'|'小さく'|'出さない'/.test(settings));
check('「ゲームを更新」は残っている(出さないを選んでも更新できる)',
  settings.includes('onOpenGameUpdate'));
check('設定画面へ値と操作を props で渡している',
  /updateNoticeStyle, onChangeUpdateNoticeStyle/.test(settings)
  &&/updateNoticeStyle=\{updateNoticeStyle\}/.test(app)
  &&/onChangeUpdateNoticeStyle=\{setUpdateNoticeStyle\}/.test(app));

// --- ヘルプ -----------------------------------------------------------------
check('ヘルプに載っている',
  /新しいバージョンのお知らせ/.test(help)&&/ふつう／小さく／出さない|ふつう」「小さく」「出さない/.test(help));
check('ヘルプに「演奏中は出ない」ことが書いてある',
  /モンヒロビートの演奏中は出ません/.test(help));
check('設定画面にも「演奏中は出ない」ことが書いてある',
  /モンヒロビートの演奏中は、どの設定でも出ません/.test(settings));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
