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
//  ・演奏中に画面の上へ出すと、レーンのいちばん奥(ノーツが現れるところ)に重なる。
//    演奏中だけは位置を変えること。ここが戻ると「邪魔だ」という指摘が再発する
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
check('「小さく」と演奏中は小さい形で出す',
  /updateNoticeMode === 'MINI' \|\| updateNoticeOnPlay/.test(app));
// ここが戻ると「モンビー中にレーン上部に出て邪魔」が再発する
check('演奏中(RHYTHM_PLAY)だけ位置を下へ変える',
  /updateNoticeOnPlay = gameState === 'RHYTHM_PLAY'/.test(app)
  &&/updateNoticeOnPlay[\s\S]{0,120}bottom:'calc\(8px \+ env\(safe-area-inset-bottom\)\)'/.test(app));
check('演奏中の目印を出している(検査が場所を確かめられるように)',
  /data-update-notice-place=\{updateNoticeOnPlay\?'play':'top'\}/.test(app));
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
check('ヘルプに演奏中の場所も書いてある',
  /モンヒロビートの演奏中は[\s\S]{0,60}右下/.test(help));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
