#!/usr/bin/env node
// お知らせ(更新履歴)から外へ出るリンクが、出してよい形になっているか。
//
//   node tools/changelog/external-link-check.js
//
// 【なぜ要るか】(2026-09-14・よそのゲームの曲を入れたときの案内用に足した)
// 更新履歴の項目へ link:{url,label} と書くと、更新情報の詳細にボタンが出る。
// ここは **data/changelog.js の文字列をそのまま href へ入れる** 場所なので、
// 書き間違いや、うっかり貼った javascript: が、そのまま画面のリンクになってしまう。
//
// 見るのは3つ。
//   ・データ側: 書いてあるURLが https で、URLとして解釈できること
//   ・実装側:   https だけ通す関門(changelogSafeLink)を経由していること
//   ・実装側:   target="_blank" と rel="noopener noreferrer" が付いていること
//               (付けないと、開いた先のページから window.opener でこちらを触れる)
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── ① データ側: 書いてあるURL ────────────────────────────────────────────────
const changelogCtx={};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8')}
this.out=CHANGELOG;`,changelogCtx);
const changelog=changelogCtx.out;

const bad=[],noLabel=[];
let linked=0;
for(const entry of changelog){
  const link=entry&&entry.link;
  if(!link)continue;
  linked++;
  const url=typeof link.url==='string'?link.url.trim():'';
  let parsed=null;
  try{parsed=new URL(url);}catch{}
  if(!parsed||parsed.protocol!=='https:')bad.push(`${entry.date} ${String(entry.title||'').slice(0,24)}: ${url||'(空)'}`);
  if(!(typeof link.label==='string'&&link.label.trim()))noLabel.push(`${entry.date} ${String(entry.title||'').slice(0,24)}`);
}
ok('お知らせのリンクはすべて https で、URLとして読める',bad.length===0,
  bad.length?bad.join(' / '):`${linked}件を照合`);
ok('リンクにボタンの文字(label)が付いている',noLabel.length===0,noLabel.join(' / '));

// ── ② 実装側: 関門を通しているか ───────────────────────────────────────────
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const gate=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/17-release-changelog-login-missions.jsx'),'utf8');

ok('https だけ通す関門がある（changelogSafeLink）',
  /const changelogSafeLink\s*=/.test(gate)&&/protocol === 'https:'/.test(gate),
  '17-release-changelog-login-missions.jsx');
ok('関門が「URLとして読めないもの」を落としている',
  /new URL\(url\)/.test(gate)&&/catch\s*\{\s*return ''/.test(gate));
ok('画面のリンクが関門を通した値を href にしている',
  /href=\{changelogSafeLink\(c\.link\)\}/.test(app),
  '60-app.jsx の data-changelog-link');
// entry.link.url を直接 href へ入れる書き方へ戻っていないか
ok('生のURLを href へ入れていない',
  !/href=\{(?:c|entry)\.link\.url\}/.test(app)&&!/href=\{(?:c|entry)\.link\?\.url\}/.test(app));

// ── ③ 実装側: 開いた先からこちらを触られないか ─────────────────────────────
const anchor=/(<a data-changelog-link[\s\S]{0,400}?>)/.exec(app);
ok('リンクのタグを読めた',!!anchor,anchor?'':'60-app.jsx に <a data-changelog-link> が無い');
if(anchor){
  const tag=anchor[1];
  ok('別のタブで開く（target="_blank"）',/target="_blank"/.test(tag));
  ok('開いた先からこちらを触られない（rel="noopener noreferrer"）',
    /rel="noopener noreferrer"/.test(tag),tag.replace(/\s+/g,' ').slice(0,90));
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
