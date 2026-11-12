#!/usr/bin/env node
// 「🔄 横」(モンヒロビートで、端末は縦のまま絵を回す)のときに、窓・シートが回した画面からはみ出さないかを見張る。
//
//   node tools/ui/rotation-height-check.js          (LIST=1 で一覧をすべて出す)
//
// 【2026-11-07 レフェリーくん・ジン部長】回したときは、器(RHYTHM_VIEW_ROTATION.frameStyle)が幅と高さを入れ替えて回すだけで、
//   CSS の「画面の高さ」(--mh-vh・vh)は端末の縦の長さ(844 など)のまま残っていた。そのため、高さの上限にそれを使う窓は、
//   回した画面(高さ 390 など)の上下からはみ出していた(マスモン詳細 #4834・オリジナル強化のシート・クイックの案内)。
//   回すのはモンヒロビートの中(gameState が RHYTHM_ で始まるあいだ)だけ。外へ出ると戻る(60-app.jsx の releaseScreenOrientation)。
//
// 見ること:
//   ① 器が --mh-vh を回した画面の高さ(端末の幅)で渡している … これで --mh-vh を使う窓は、器の中ならまとめて収まる
//   ② vh(dvh/svh)で高さを決めていて、46vh を超えるもの … 844×0.46 ≒ 390 を超えると、回した画面に入らない。
//      回したとき用の上限([[data-mh-view-rotation=true]_&]:…)を同じ所に持つか、下の一覧で「モンヒロビートの外でしか開かない」と確かめてあること
//   ③ document.body へ直に出す(ReactDOM.createPortal(…, document.body))窓 … 回した器の外なので、絵と一緒に回らず --mh-vh も効かない。
//      回しているときは器へ出す作りにするか、下の一覧で「モンヒロビートの外でしか開かない」と確かめてあること
//   新しく足した所が一覧に無ければ NG(確かめてから一覧に足す)。一覧の「直す(担当)」は、まだ回したとき用が無い所(NG にはしない・担当へ回してある)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let parser;
try { parser = require(path.join(ROOT, 'tools/node_modules/@babel/parser')); } catch { console.log('NG: @babel/parser が無い(cd tools && npm install)'); process.exit(1); }
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 確かめた一覧。キーは「ファイル|見つけた書き方|そのファイルの中で何番目か」(行番号は動くので使わない)
//   outside … モンヒロビートの外(バトル・MFバトルカード・HOME など)でしか開かないので、回すことが無い
//   todo:担当 … モンヒロビートの中で開けるのに、回したとき用がまだ無い(担当へ回してある)
const REVIEWED = {
  // ② vh で高さを決めている窓
  '24-sorashido-copy-view.jsx|94dvh|1': 'outside ソラシドのAIコピー(バトルの中だけ)',
  '56-assistant-life-masmon-sleep.jsx|92dvh|1': 'outside 冬眠中の助手のマスモンのくわしい画面(助手ライフの育成ノートだけ。モンヒロビートの外)',
  '56-assistant-life-masmon-sleep.jsx|80dvh|1': 'outside 助手のマスモンを眠らせる窓(助手ライフの育成ノートだけ。モンヒロビートの外)',
  '56-assistant-life-masmon-sleep.jsx|92dvh|2': 'outside 冬眠中の助手のマスモンどうしの合体の窓(助手ライフの育成ノートだけ。モンヒロビートの外)',
  '56-assistant-life-masmon-ranch.jsx|92dvh|1': 'outside M/B管理で助手のマスモンにチケットを使う窓(助手ライフの地図と M/B管理の画面だけ。モンヒロビートの外)',
  '56-screen-profile.jsx|58vh|1': 'outside プロフィールの仲良し度のごほうびの一覧(gameState が PROFILE のときだけ。モンヒロビートの外)',
  '60-app.jsx|86vh|1': 'outside バトルのモードの説明(バトルのモードえらび)',
  '60-app.jsx|75vh|1': 'outside バトルの技えらび',
  '84-screen-card-battle.jsx|60vh|1': 'outside MFバトルカード',
  '84-screen-card-battle.jsx|55vh|1': 'outside MFバトルカード',
  '84-screen-card-battle.jsx|55vh|2': 'outside MFバトルカード',
  '84-screen-card-battle.jsx|50vh|1': 'outside MFバトルカード',
  '84-screen-card-battle.jsx|50vh|2': 'outside MFバトルカード',
  '95-card-deck-share.jsx|86vh|1': 'outside MFバトルカードのデッキの共有',
  // ③ document.body へ直に出す窓
  '44-time-of-day.jsx|portal|1': 'outside HOME の時刻の札を押したときの小さな窓(HOME でしか開かない・高さ約150pxで横持ち390pxに収まる)',
  '24-battle-fx.jsx|portal|1': 'outside バトルの演出',
  '44-time-of-day.jsx|portal|1': 'outside HOME の時計の表示形式のシート(TimeOfDayClock の home 付きは 69-screen-home.jsx だけ。HOME で開く物で、モンヒロビートの中では開かない・2026-11-11 開発部が確かめた)',
  // 保存できない知らせ・新しい版の知らせ(どの画面でも出す)は、rotationAwarePortalTarget() で回した器へ出すので、ここには出てこない(2026-11-07)
  '60-app.jsx|portal|1': 'outside 「ゲームをやめる」の確認(バトルのメニューからだけ開く。71-screen-battle.jsx の data-battle-quit)',
  '57-screen-monster-dex.jsx|75dvh|1': 'outside モンスター図鑑(M/B管理から)',
  '24-battle-fx.jsx|portal|2': 'outside バトルの演出', '24-battle-fx.jsx|portal|3': 'outside バトルの演出',
  '71-screen-battle.jsx|portal|1': 'outside バトル', '71-screen-battle.jsx|portal|2': 'outside バトル', '71-screen-battle.jsx|portal|3': 'outside バトル',
  '71-screen-battle.jsx|portal|4': 'outside バトル', '71-screen-battle.jsx|portal|5': 'outside バトル', '71-screen-battle.jsx|portal|6': 'outside バトル',
  '71-screen-battle.jsx|portal|7': 'outside バトル', '71-screen-battle.jsx|portal|8': 'outside バトル',
  ...Object.fromEntries([9, 10, 11, 12, 13, 14].map((i) => [`71-screen-battle.jsx|portal|${i}`, 'outside バトル'])),
  '56-assistant-life-friend.jsx|portal|1': 'outside フレンドのプロフィールの「🏘 家へ遊びに行く」(75-screen-friends.jsx。gameState が FRIENDS のときだけ。#5037・2026-11-08 レフェリーくんが確かめた)',
  '77-screen-rhythm-multi.jsx|portal|1': 'outside HOME の招待の帯(RhythmInviteHomeBar。gameState が HOME のときだけ出す。回すのはモンヒロビートの中だけ・2026-11-07 テンポが確かめた)',
  '84-screen-card-battle.jsx|portal|1': 'outside MFバトルカード', '84-screen-card-battle.jsx|portal|2': 'outside MFバトルカード', '84-screen-card-battle.jsx|portal|3': 'outside MFバトルカード',
};

// ① 器が --mh-vh を渡している
const rhythm = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const fsAt = rhythm.indexOf('const frameStyle=()=>{');
const fsBody = fsAt >= 0 ? rhythm.slice(fsAt, rhythm.indexOf('};', fsAt) + 2) : '';
check('① 回したときの器が --mh-vh を回した画面の高さ(端末の幅 vw())で渡している', /'--mh-vh':`\$\{vw\(\)\}px`/.test(fsBody));

const partsDir = path.join(ROOT, 'monster-hero/src/parts');
const files = fs.readdirSync(partsDir).filter((f) => f.endsWith('.jsx'));
const VH = /(?:max-h|h|min-h)-\[(?:min\()?(\d+)(?:d|s)?vh|(?:maxHeight|height)\s*:\s*['"`](\d+)(?:d|s)?vh/g;
const found = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(partsDir, f), 'utf8');
  const lines = src.split('\n');
  const count = {};
  const add = (kind, line, extra) => { count[kind] = (count[kind] || 0) + 1; found.push({ key: `${f}|${kind}|${count[kind]}`, f, line, kind, extra }); };
  // ② vh。回したとき用の上限を同じ行に持つ物は数えない
  lines.forEach((ln, i) => {
    let m; VH.lastIndex = 0;
    while ((m = VH.exec(ln))) {
      const v = Number(m[1] || m[2]);
      if (!(v > 46)) continue;
      if (/\[\[data-mh-view-rotation=true\]_&\]:[a-z!-]*max-h|\[\[data-mh-view-rotation=true\]_&\]:!?h-/.test(ln)) continue;
      add(`${v}${/dvh/.test(m[0]) ? 'dvh' : 'vh'}`, i + 1, m[0]);
    }
  });
  // ③ document.body へ直に出す
  const ast = parser.parse(src, { sourceType: 'script', plugins: ['jsx'], errorRecovery: true });
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'createPortal') {
      const t = n.arguments && n.arguments[1];
      if (t && t.type === 'MemberExpression' && t.object && t.object.name === 'document' && t.property && t.property.name === 'body') add('portal', n.loc.start.line, 'createPortal(…, document.body)');
    }
    for (const k in n) { if (k === 'loc' || /Comments$/.test(k)) continue; const v = n[k]; if (v && typeof v === 'object') visit(v); }
  };
  visit(ast.program);
}
// ④ どの画面でも出る窓(保存できない知らせ・新しい版の知らせ)は、回しているとき回した器へ出す
const app = fs.readFileSync(path.join(partsDir, '60-app.jsx'), 'utf8');
const ui41 = fs.readFileSync(path.join(partsDir, '41-screen-ui.jsx'), 'utf8');
check('④ 出し先の部品 rotationAwarePortalTarget が、回しているときは回した器・ふだんは body を返す', /const rotationAwarePortalTarget = \(\) => \{[\s\S]{0,400}RHYTHM_VIEW_ROTATION\.active\(\)[\s\S]{0,120}data-mh-view-rotation="true"[\s\S]{0,40}document\.body/.test(ui41));
check('④ 保存できない知らせ・新しい版の知らせは rotationAwarePortalTarget() へ出す',
  /const storageTroubleNotice = storageTrouble \? ReactDOM\.createPortal\([\s\S]{0,4000}?\n\s*rotationAwarePortalTarget\(\)\n\s*\) : null;/.test(app)
  && /const updateNotice = [^\n]*ReactDOM\.createPortal\([\s\S]{0,6000}?\n\s*rotationAwarePortalTarget\(\)\n\s*\) : null;/.test(app));
const unknown = found.filter((x) => !REVIEWED[x.key]);
check('② ③ 回したときにはみ出しうる窓(46vh を超える vh・document.body へ直に出す物)は、全部確かめてある', unknown.length === 0,
  unknown.map((x) => `${x.f}:${x.line} ${x.extra}(一覧のキー '${x.key}')`).join(' / '));
const gone = Object.keys(REVIEWED).filter((k) => !found.some((x) => x.key === k));
check('一覧に、もう無い所が残っていない(直したら一覧から外す)', gone.length === 0, gone.join(' / '));
const todo = found.filter((x) => /^todo:/.test(REVIEWED[x.key] || ''));
console.log(`\n回したとき用がまだ無い所(担当へ回してある・NG にはしない): ${todo.length}件`);
todo.forEach((x) => console.log(`  ${x.f}:${x.line} ${x.extra} … ${REVIEWED[x.key].replace(/^todo:/, '')}`));
if (process.env.LIST) { console.log('\nすべて:'); found.forEach((x) => console.log(`  ${x.f}:${x.line} ${x.extra} … ${REVIEWED[x.key] || '(未確認)'}`)); }
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
