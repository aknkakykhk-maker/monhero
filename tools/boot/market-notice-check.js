#!/usr/bin/env node
// マーケットへ商品を足したのに、助手からの告知を付け忘れていないかを見張る検査。
//
// 更新履歴のエントリへ assistantNotice を書くと、助手が一度だけ
// 「新しく○○が入ったよ」と知らせて「マーケットを見る」ボタンを出す
// (data/assistants.js の assistantUpdateNoticeFromChangelog)。
// この1行は書き忘れても画面はふつうに動いてしまうため、
// 「マーケットに並んでいるのに誰も教えてくれない」状態に気づけない。
// 実際にアシストカード「ポルツ」を追加したとき、これを付け忘れた。
//
// そこで次を機械的に確かめる。
//   ① 最新リリース(更新履歴の先頭)がマーケットへの追加を含むなら assistantNotice がある
//   ② assistantNotice の id が重複していない(重複すると片方が二度と出ない)
//   ③ assistantNotice の type が data/assistants.js の対応表にある値になっている
//   ④ 告知の宛先になる更新履歴には、本文(items)とタイトルが入っている
//      (どちらかが空だと assistantUpdateNoticeFromChangelog が黙って捨てる)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(TOOLS_DIR, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const assistantsSource = fs.readFileSync(path.join(WEB_ROOT, 'data/assistants.js'), 'utf8');

const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext([
  fs.readFileSync(path.join(WEB_ROOT, 'data/changelog.js'), 'utf8'),
  ';globalThis.__data = { CHANGELOG };',
].join('\n'), sandbox, { filename: 'data/changelog.js' });
const { CHANGELOG } = sandbox.__data;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// data/assistants.js が受け付ける type。ここを増やしたら検査も自動で追随する
const allowedTypes = new Set(
  (assistantsSource.match(/ASSISTANT_UPDATE_NOTICE_TYPES = new Set\(\[([^\]]*)\]\)/)?.[1] || '')
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean));
check('告知の種類の対応表を読み込めている', allowedTypes.size > 0, [...allowedTypes].join(' / '));

// --- ① 最新リリースがマーケットへの追加なら告知が要る ---
// 判定は更新履歴の先頭(=いま出そうとしているリリース)だけを見る。
// 過去のぶんは告知が済んでいるので蒸し返さない。
const latest = CHANGELOG[0];
const latestItems = Array.isArray(latest?.items) ? latest.items : [];
const addsToMarket = latest?.type === 'update'
  && [latest.title || '', ...latestItems].some(text => text.includes('マーケット') && text.includes('追加'));
check('最新リリースがマーケットへの追加なら助手の告知が付いている',
  !addsToMarket || (latest.assistantNotice && latest.assistantNotice.type === 'market'),
  addsToMarket
    ? `「${latest.title}」${latest.assistantNotice ? `→ ${latest.assistantNotice.id}` : ' に assistantNotice がない（data/changelog.js へ assistantNotice: { id:\'update_notice_◯◯_v1\', type:\'market\' } を足す）'}`
    : 'マーケットへの追加を含まないリリース');

// --- ②③④ 告知そのものの作りが壊れていないか(全件) ---
const notices = CHANGELOG.filter(entry => entry && entry.assistantNotice);
check('告知付きの更新履歴がある', notices.length > 0, `${notices.length}件`);

const ids = notices.map(entry => entry.assistantNotice.id);
const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
check('告知のidが重複していない', duplicated.length === 0, duplicated.join(' / '));

const badType = notices.filter(entry => !allowedTypes.has(entry.assistantNotice.type));
check('告知の種類が対応表の値になっている', badType.length === 0,
  badType.map(e => `${e.assistantNotice.id}:${e.assistantNotice.type}`).join(' / '));

// タイトルか本文が空の告知は assistantUpdateNoticeFromChangelog が null を返して黙って消える
const empty = notices.filter(entry => !entry.title
  || !(Array.isArray(entry.items) && entry.items.some(item => typeof item === 'string' && item.trim())));
check('告知に出す本文とタイトルが入っている', empty.length === 0,
  empty.map(e => e.assistantNotice.id).join(' / '));

// id の付け方をそろえておくと、あとから「どの告知がどの更新か」を追いやすい
const badId = ids.filter(id => !/^update_notice_[a-z0-9_]+_v\d+$/.test(id));
check('告知のidが update_notice_◯◯_v1 の形になっている', badId.length === 0, badId.join(' / '));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
