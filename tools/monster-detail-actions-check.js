// マスモン詳細の育成導線が対象個体を引き継ぎ、神殿の機能を混ぜていないことを確認する。
const fs = require('fs');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
let failed = false;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); failed ||= !ok; };

const start = source.indexOf("{masuMonDetail&&gameState!=='MASU_ENHANCE'");
const end = source.indexOf("{/* マスモン強化:", start);
const detail = source.slice(start, end);
check('詳細にコンパクトな育成・カスタム3導線', detail.includes('育成・カスタム') && detail.includes('grid grid-cols-3') && ['強化','トレーニング','染色'].every(label=>detail.includes(`>${label}<`)));
check('強化は詳細の個体を維持して専用画面へ進む', detail.includes("setMasuEnhanceFrom(gameState);setGameState('MASU_ENHANCE')"));
check('トレーニングは詳細の個体IDを引き継ぐ', detail.includes('setDetailTrainingMasuId(masu.id)') && source.includes('masuId:masu.id,count:1'));
check('染色は詳細の個体IDと現在色を引き継ぐ', detail.includes('setDyeTargetMasuId(masu.id)') && detail.includes('getMasuColors(masu)'));
check('限界突破・転生・合体の操作導線を追加していない', !detail.includes('限界突破する') && !detail.includes('転生する') && !detail.includes('合体する'));
check('重トレーニングチケットは表示名だけ変更', /id:'training_ticket_l', name:"重トレーニングチケット", type:'item', emoji:"🎟️", cost:1000, bondXp:150/.test(breeder));

process.exit(failed ? 1 : 0);
