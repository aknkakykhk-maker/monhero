// マスモン詳細の育成導線が対象個体を保ったまま既存UIへ接続され、表示名だけが変わっていることを確認する。
const fs = require('fs');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const changelog = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
let failed = false;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); failed ||= !ok; };

check('詳細に3つの育成・カスタム操作をまとめて表示', /aria-label="育成・カスタム"[\s\S]{0,1800}>強化<[\s\S]{0,1800}>トレーニング<[\s\S]{0,1800}>染色</.test(source));
check('強化は表示中個体の既存強化画面へ接続', /setMasuEnhanceFrom\(gameState\); setGameState\('MASU_ENHANCE'\)/.test(source));
check('トレーニングは表示中個体を保持して既存枚数UIへ接続', /setTrainingTicketTargetId\(masu\.id\)/.test(source) && /setXpTicketUse\(\{itemId:item\.id,masuId:masu\.id,count:1\}\)/.test(source));
check('染色は表示中個体を保持して既存染色UIへ接続', /setDyeTargetMasuId\(masu\.id\);setDyePreviewColors/.test(source) && /useDyeItem\(masu\.id, dyePreviewColors\)/.test(source));
check('既存のチケットID・効果量・価格を維持', /id:'training_ticket_l', name:"重トレーニングチケット"[^\n]*cost:1000[^\n]*bondXp:150/.test(breeder));
check('ユーザー向けデータと本体に旧表示名が残っていない', ![source, breeder, help, changelog].some(text => text.includes('修行チケット')));

if (failed) process.exit(1);
