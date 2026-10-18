// モンヒロビートのマルチの部屋で、小さいアイコン(上の5人の帯・チャット)には絵の枠を重ねないことを見る(2026-10-19)。
// 社長「前に指摘したモンビーマルチのマスモンの染色ずれなおってないよ」。崩れていたのはプロフィールの絵の枠(リース)で、
// 28px に縮めると細かい飾りが白とピンクの点のように見えた。経緯: docs/playbot/reports/2026-10-19/multi-small-frame/
//   node tools/mode/rhythm-multi-small-frame-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/77-screen-rhythm-multi.jsx'),'utf8');
let failed=0;const ok=(name,cond)=>{console.log(`${cond?'OK':'NG'}: ${name}`);if(!cond)failed++;};
const avatar=(src.match(/function RhythmMultiAvatar\([\s\S]*?\n\}\n/)||[''])[0];
ok('アイコンの部品に small がある',/function RhythmMultiAvatar\(\{[^}]*small = false[^}]*\}\)/.test(avatar));
ok('small のとき、絵の枠(kind image)は重ねない',/const frameId = small && frame && frame\.kind === 'image' \? null : m\.frame;/.test(avatar)&&/frameId=\{frameId\}/.test(avatar));
ok('上の5人の細い帯は small で描く',/sizeClass=\{tall \? 'h-12 w-12 landscape:h-16 landscape:w-16' : 'h-7 w-7'\} small=\{!tall\}/.test(src));
ok('チャットのアイコンは small で描く',/sizeClass="h-8 w-8 shrink-0" small \/>/.test(src));
ok('大きく出す所(ステータスの窓)は今までどおり枠つき',(src.match(/<RhythmMultiAvatar m=\{m\} resolveIconUrl=\{resolveIconUrl\} sizeClass="h-16 w-16" \/>/g)||[]).length>=2);
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
