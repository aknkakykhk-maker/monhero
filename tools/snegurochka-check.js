#!/usr/bin/env node
const fs = require('fs');
const ally = fs.readFileSync('monster-hero/data/ally-monsters.js', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const images = fs.readFileSync('monster-hero/data/images/images-ally.js', 'utf8');
const faceIcons = fs.readFileSync('tools/make-face-icons.js', 'utf8');
const checks = [
  ['基礎能力・適性・合流値', /Snegurochka:[\s\S]*?baseHp:400, baseGuts:150, baseAtk:135, baseDef:80[\s\S]*?plusStats:\{hp:150,atk:40,def:10,guts:40\}[\s\S]*?distAptitude:\['D','E','B','A'\]/.test(ally)],
  ['通常技9段階', /Snegurochka: \["アイスブレード"[\s\S]*?"ジングルベル"\]/.test(ally)],
  ['固有技9段階・倍率・消費', /name:"アイスアロー"[\s\S]*?baseMult:2\.2,baseGuts:44[\s\S]*?"メリークリスマス"/.test(ally)],
  ['マーケット1500ダイヤ', /id:'Snegurochka'[\s\S]*?type:'disc'[\s\S]*?cost:1500/.test(breeder)],
  ['専用円盤石画像を商品に使用', /const SNEGUROCHKA_DISC_ICON = "images\/disc-icons\/snegurochka-disc\.PNG\?v=[a-f0-9]{12}"/.test(breeder) && /id:'Snegurochka'[\s\S]*?type:'disc'[\s\S]*?icon:SNEGUROCHKA_DISC_ICON/.test(breeder)],
  ['円盤石の商品詳細も共通表示を使用', game.includes('marketDiscIcon:item.icon') && game.includes('detailOpts.marketDiscIcon')],
  ['移動封印は有効中のMOVEを失敗し行動済みを維持', /intent\.type==='MOVE' && getWaveBuff\('iceLockTurns'\)>0[\s\S]*?移動できない！/.test(game)],
  ['付与ターンは減算せず次ターンから5ターン', /iceLockTurns:5/.test(game) && /getWaveBuff\('iceLockTurns'\)>0 && !immediateEffects\.iceLockRefreshed/.test(game) && /iceLockTurns:Math\.max\(0,\(p\.iceLockTurns\|\|0\)-1\)/.test(game)],
  ['初回付与ターンは準備中として次ターンに解除', /iceLockPreparing:\(p\.iceLockTurns\|\|0\)<=0/.test(game) && /iceLockRefreshed\) setWaveBuffs\(p=>\(\{\.\.\.p,iceLockPreparing:false\}\)\)/.test(game)],
  ['消費ガッツ3%累積・安全な下限', /Math\.max\(0\.1, 1 - 0\.03\*getPermaBuff\('snegurochkaGutsDiscountStacks'\)\)/.test(game)],
  ['勇者限定AND条件・既存距離倍率と別乗算', game.includes("mainHero?.id==='Snegurochka'") && game.includes('iceLockTurns>0') && game.includes('slotIdx===targetDist') && /traitMult=[^\n]*\*iceRulerMult/.test(game)],
  ['付与中フラグを特性判定へ混ぜない', !game.includes('activatesIceLock') && !/getDmg\([^\n]*activatedIceLockThisTurn/.test(game)],
  ['特性の実効果と表示は共通発動判定を使用', game.includes('const isIceRulerActive = (slotIdx, targetDist)') && game.includes('&& !iceLockPreparing') && game.includes('iceRulerMult=isIceRulerActive(slotIdx,attackStartDist)') && /isIceRulerActive\(slots\.findIndex\(isHeroSlotMon\),enemyDist\)[\s\S]*?data-ice-ruler-active/.test(game)],
  ['敵情報欄に準備・残りターンの小型バッジ', /data-ice-lock-status[\s\S]*?iceLockPreparing\?'準備':`\$\{iceLockTurns\}T`/.test(game) && /text-\[7px\][\s\S]*?❄️絶氷/.test(game)],
  ['専用水攻撃モーション', /atkMotion:'waterBurst'/.test(ally) && /@keyframes waterBurstAttack/.test(game) && /@keyframes waterBurstLunge/.test(game)],
  ['ヘルプに特性・固有効果', help.includes('勇者特性「氷海の支配者」') && help.includes('スネグーラチカ「絶氷の楔」')],
  // 立ち絵は他のモンスターと同じ正方形・同じ余白へそろえる(import-monster-art.jsの出力)。
  // 元絵は縦長(1024x1536)のままだったため、丸いアイコンや一覧では上下が切れ、
  // ほかのモンスターと頭身がそろわなかった
  ['立ち絵は正方形にそろえた画像を使う', /const SNEGUROCHKA_IMG = "images\/monsters\/snegurochka\.png(\?v=[a-f0-9]{12})?"/.test(images)],
  ['一覧アイコンは立ち絵と同じ画像', /const SNEGUROCHKA_ICON = SNEGUROCHKA_IMG;/.test(images)],
  // 顔アイコンに立ち絵を流用すると、プロフィール選択などで全身が小さく縮んで見える
  ['顔アイコンは専用の顔クロップ', /const SNEGUROCHKA_FACE_ICON = "images\/monster-icons\/face\/snegurochka\.png(\?v=[a-f0-9]{12})?"/.test(images)
    && /SNEGUROCHKA: \[/.test(faceIcons)],
  // 染色もどきは3部位(髪とヒレ・サンタの衣装・体と尾)。部位定義が無いと全身一括の1枠しか出ない
  ['染色もどきは3部位に分かれる', /Snegurochka: \[\s*\{ hue: 181[\s\S]*?\{ hue: 355[\s\S]*?white: true[\s\S]*?\],\s*\],/.test(game)],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
if (failed.length) process.exit(1);
