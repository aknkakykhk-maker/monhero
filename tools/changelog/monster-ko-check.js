#!/usr/bin/env node
// プレイヤー向けの文(更新履歴・ヘルプ・説明文・画面の文字)で、モンスターを「子」と呼んでいないかを見る。
//   node tools/changelog/monster-ko-check.js
// 【2026-11-06 社長「モンスターのことを『子』って表現するのやめてほしい」】
//   「使った子」「好きな子」「3体の子」などは「モンスター」「〜体」と書く。
//   ★助手などの台詞(data/assistants.js と、下の DIALOG_FILES)は見ない。助手が特定のマスモンを「この子」「あの子」と言うのはそのままでよい(社長)
//   見るのは文字列・テンプレート・JSX の文字だけ(注記は見ない)。人を指す言葉(女の子・様子・調子・帽子 など)は除く
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
let parser;try{parser=require(path.join(ROOT,'tools/node_modules/@babel/parser'));}catch{console.log('NG: @babel/parser が無い(cd tools && npm install)');process.exit(1);}
const DIALOG_FILES=new Set(['monster-hero/data/assistants.js','monster-hero/src/parts/83-card-battle-lines.jsx','monster-hero/src/parts/33-rhythm-buddy-persona.jsx',
  'monster-hero/src/parts/32-sorashido-copy.jsx','monster-hero/src/parts/83-card-battle-vs.jsx','monster-hero/src/parts/91-card-battle-multi.jsx']);
const files=['monster-hero/data/help.js','monster-hero/data/changelog.js','monster-hero/data/breeder.js','monster-hero/data/rhythm-event.js','monster-hero/data/ally-monsters.js','monster-hero/data/lineages.js',
  ...fs.readdirSync(path.join(ROOT,'monster-hero/src/parts')).filter(f=>f.endsWith('.jsx')).map(f=>`monster-hero/src/parts/${f}`)].filter(f=>!DIALOG_FILES.has(f));
const EXCL=/様子|調子|梯子|帽子|扇子|椅子|王子|双子|女子|男子|団子|菓子|拍子|粒子|原子|電子|分子|冊子|格子|種子|子供|子ども|息子|弟子|振り?子|骨子|面子|利子|因子|子守|黒子|障子|迷子|親子|子会社|子音|子分|子孫|子連れ|子犬|子猫|子羊|遺伝子|女の子|男の子|お子|っ子|餃子|柚子|茄子|椰子|獅子|玉子|子規|玖子/;
const KO=/(?<![子])子(?=[がをはにのもとでやへ、。！？!?…」』）)\s,，・／/〜~]|$|たち|ら|だけ|まで|より|から|しか|ごと|同士|ばかり|ばっかり|だった|です|でも|じゃ|なら|なの|って|ってる|には|へは|とは|でした)/g;
// 保存の値として使っている文(画面にはそのまま出さない)は見ない。書き換えると、プレイヤーが組んだ戦術(保存データ)が働かなくなる(CLAUDE.md ⑦)。
//   MFバトルカードの戦術の「立ち回り」「ブリーダー」の選択肢の値と、その値で分ける判定・手本。画面には CARD_TACTIC_* の表の表示用の文(「モンスター」)が出る
const SAVED_VALUE_LINE=/\{ id: '(stance|bEff)',|if \(v === '|'(stance|bEff)\.[^']*'/;
const found=[];
for(const f of files){
  const src=fs.readFileSync(path.join(ROOT,f),'utf8');
  const ast=parser.parse(src,{sourceType:'script',plugins:['jsx'],errorRecovery:true});
  const lines=src.split('\n');
  const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}
    if((n.type==='StringLiteral'||n.type==='TemplateElement'||n.type==='JSXText')&&!SAVED_VALUE_LINE.test(lines[n.loc.start.line-1]||'')){
      const t=n.type==='TemplateElement'?n.value.cooked||'':n.value;let m;KO.lastIndex=0;
      while((m=KO.exec(t))){if(EXCL.test(t.slice(Math.max(0,m.index-4),m.index+3)))continue;found.push(`${f.replace('monster-hero/','')}:${n.loc.start.line} 「${t.slice(Math.max(0,m.index-8),m.index+3)}」`);}}
    for(const k in n){if(k==='loc'||/Comments$/.test(k))continue;const v=n[k];if(v&&typeof v==='object')visit(v);}};
  visit(ast.program);
}
// 【2026-11-07 ジン部長】助手などの台詞でも、複数・一般のモンスターを「子」と呼ばない(「この子たち」「この子ら」「高い子ほど」「どの子」など)。
//   特定の1体を指す「この子」「あの子」はそのまま通す(社長)。人を指す言葉(女の子・〜ばっかりの子 など)は台詞の場面で決めるので、
//   ここでは複数・一般の形だけを見る
const DIALOG_KO=/子(?:たち|ら(?![しい]))|子ほど|(?:どの|ほかの|他の)子(?![供ど])/g;
// 開催中のイベントのお話は、開催のあいだ触らない決まり(CLAUDE.md ⑥-4)。終わったら言い換えること(期限を過ぎると NG になる)
// 開催中のイベントで見送った台詞は、2026-11-09 のイベント終了後に言い換えた(パンドラとふたつの翼 EP3・EP7)。見送りが要るときはここへ { text, until, why } を足す
const DIALOG_KO_HOLD=[];
const dialogFound=[],held=[];
for(const f of DIALOG_FILES){
  if(!fs.existsSync(path.join(ROOT,f)))continue;
  const src=fs.readFileSync(path.join(ROOT,f),'utf8');
  const ast=parser.parse(src,{sourceType:'script',plugins:['jsx'],errorRecovery:true});
  const visit=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}
    if(n.type==='StringLiteral'||n.type==='TemplateElement'||n.type==='JSXText'){
      const t=n.type==='TemplateElement'?n.value.cooked||'':n.value;let m;DIALOG_KO.lastIndex=0;
      while((m=DIALOG_KO.exec(t))){
        const at=m.index+m[0].indexOf('子');
        if(EXCL.test(t.slice(Math.max(0,at-4),at+3)))continue;
        const hold=DIALOG_KO_HOLD.find(h=>t.includes(h.text));
        if(hold&&Date.now()<Date.parse(hold.until)){held.push(`${hold.why}「${hold.text}」`);continue;}
        dialogFound.push(`${f.replace('monster-hero/','')}:${n.loc.start.line} 「${t.slice(Math.max(0,at-8),at+4)}」`);
      }}
    for(const k in n){if(k==='loc'||/Comments$/.test(k))continue;const v=n[k];if(v&&typeof v==='object')visit(v);}};
  visit(ast.program);
}
console.log(`${found.length?'NG':'OK'}: プレイヤー向けの文で、モンスターを「子」と呼んでいない(助手の台詞は除く) — ${found.length?found.slice(0,8).join(' / '):`${files.length}ファイル`}`);
console.log(`${dialogFound.length?'NG':'OK'}: 助手などの台詞で、複数・一般のモンスターを「子たち」「子ら」「〜子ほど」「どの子」と呼んでいない(特定の1体の「この子」は通す) — ${dialogFound.length?dialogFound.slice(0,process.env.ALL?999:8).join(' / '):`${DIALOG_FILES.size}ファイル`}${held.length?` (開催中のイベントのため期限まで見送り: ${held.join('・')})`:''}`);
const ng=found.length+dialogFound.length;
console.log(ng?`\n${ng}件のNGがあります`:'\nすべてOK');
process.exit(ng?1:0);
