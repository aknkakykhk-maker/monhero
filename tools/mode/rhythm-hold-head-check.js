#!/usr/bin/env node
// 長押し(HOLD)の「押し始め」が見て分かるかを守る。
//
// 直した不具合(2026-09-05・実機の指摘):
//   長押しの始まりは、帯と同じ緑〜シアンの丸が帯の下でわずかに太るだけだった。
//   終わりには白いふちの光るバーがあるのに、始まりには目印が無く、
//   「どこを押せばよいか・いつ押せばよいか」が読み取れなかった。
//   帯より明るい塗り・白いふち・中央の線で「叩く粒」だと分かるようにした。
//
// ここは見た目そのものなので、置き方が元へ戻っていないかを構造で確かめる。
// 幅・当たり判定・判定の値は一切触っていないことも併せて見る。
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const source=read('monster-hero/src/game-system.jsx');
const rhythm=read('monster-hero/data/rhythm-mode.js');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ノーツの粒(ヘッド)を書いている場所
const head=source.match(/<span data-rhythm-note-head className=\{`([^`]*)`\}/)?.[1]||'';
check('ノーツの粒に目印が付いている',!!head,head?'見つかった':'data-rhythm-note-head が無い');
const holdHead=head.match(/note\.type==='HOLD'\?'([^']*)'/)?.[1]||'';
check('長押しの粒の書き方を取り出せる',!!holdHead,holdHead);

// 帯(HOLDのbody)の塗り
const body=source.match(/data-rhythm-hold-body className="([^"]*)"/)?.[1]||'';
check('長押しの帯の書き方を取り出せる',!!body,body);

const gradient=text=>(text.match(/(from|via|to)-[a-z]+-\d+(\/\d+)?/g)||[]).join(' ');
check('粒の塗りは帯の塗りと同じではない',
  !!holdHead&&!!body&&gradient(holdHead)!==gradient(body),
  `粒[${gradient(holdHead)}] 帯[${gradient(body)}]`);
check('粒には白いふちがある',/border-2/.test(holdHead)&&/border-white/.test(holdHead),holdHead);
check('粒の大きさは変えていない(inset-0のまま)',/absolute inset-0/.test(head));

// 押し始めの線。span ではない(=幅広ノーツの >span:last-child::before/::after とぶつからない)
const mark=source.match(/<(\w+) data-rhythm-hold-head-mark[^>]*className="([^"]*)"/);
check('押し始めの線がある',!!mark,mark?`<${mark[1]}> ${mark[2]}`:'data-rhythm-hold-head-mark が無い');
check('押し始めの線はspanではない',!!mark&&mark[1]!=='span',mark?`<${mark[1]}>`:'');
check('押し始めの線は長押しのときだけ出す',/\{!monster&&note\.type==='HOLD'&&<\w+ data-rhythm-hold-head-mark/.test(source));
check('押し始めの線は入力を奪わない',!!mark&&/pointer-events-none/.test(mark[2]));

// 幅広ノーツの両端バーは >span:last-child の擬似要素。粒の中の線とは別の場所に出る
check('幅広ノーツの両端バーは今までどおり粒の擬似要素',
  rhythm.includes('[data-rhythm-note][data-rhythm-note-wide="1"]>span:last-child::before'));

// 見た目だけの変更であることの裏取り(幅と当たり判定の値は不変)
check('ノーツの幅の割合は変えていない',rhythm.includes('const RHYTHM_NOTE_WIDTH_RATIO=.78;'));
check('帯の幅の割合は変えていない',rhythm.includes('const RHYTHM_BODY_WIDTH_RATIO=.64;'));
// 受け付ける範囲は判定表のいちばん外側から作る形。ここも触っていない
check('受け付ける範囲は判定表から作るまま',
  /const RHYTHM_INPUT_MATCH_WINDOW_MS = RHYTHM_JUDGMENTS\s*\n\s*\.reduce\(/.test(rhythm));
check('いちばん外側の判定(BAD 240ms)は変えていない',/id:'BAD'[^}]*windowMs:\s*240/.test(rhythm));

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
