// マスモン詳細の育成導線が対象個体を引き継ぎ、神殿の機能を混ぜていないことを確認する。
const fs = require('fs');
const { screenSource } = require(require('path').join(__dirname, '..', 'harness'));
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const breeder = fs.readFileSync('monster-hero/data/breeder.js', 'utf8');
let failed = false;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); failed ||= !ok; };

// 詳細モーダルの表示条件。強化画面(通常・超越)を開いているあいだは出さない
const start = source.indexOf("{masuMonDetail&&!MASU_ENHANCE_STATES.includes(gameState)&&");
const end = source.indexOf("{/* マスモン強化:", start);
const detail = source.slice(start, end);
check('詳細にコンパクトな育成・カスタム3導線', detail.includes('育成・カスタム') && detail.includes('grid grid-cols-3') && ['強化','トレーニング','染色'].every(label=>detail.includes(`>${label}<`)));
check('強化は詳細の個体を維持して専用画面へ進む', detail.includes("setMasuEnhanceFrom(gameState);setGameState('MASU_ENHANCE')"));
// 戻り先も詳細にする。masuMonDetail を消すと一覧まで戻され、続けて染色やトレーニングができない
// 2026-09-10(STEP 6-9)にマスモン強化を MasuEnhanceScreen へ切り出した。
// 戻り先を決めるのは本体のまま(画面へは onBack として渡す)。
// 数を数える対象は強化画面に限る——図鑑にも同名の backToDetail があり、
// 連結物を丸ごと数えると他の画面のぶんまで混ざるため
const enhanceScreen = screenSource('MASU_ENHANCE', 'MasuEnhanceScreen');
// ★戻る導線は2つ(見出しの戻る・いちばん下のボタン)。見出しは ScreenHead へ切り出され
//   onBack= で渡すようになったので、onClick だけを数えると足りなくなる
const enhanceBacks = (enhanceScreen.match(/on(?:Back|Click)=\{backToDetail\}/g) || []).length;
check('強化から戻ると一覧ではなく詳細へ戻る',
  source.includes("const backToDetail = () => { setGameState(masuEnhanceFrom||'MASU_MONS'); setMasuEnhanceFrom(null); setBulkPlan(null); };")
    && enhanceBacks === 2
    && !source.includes('backToList'));
check('トレーニングは詳細の個体IDを引き継ぐ', detail.includes('setDetailTrainingMasuId(masu.id)') && source.includes('masuId:masu.id,count:1'));
check('染色は詳細の個体IDと現在色を引き継ぐ', detail.includes('setDyeTargetMasuId(masu.id)') && detail.includes('getMasuColors(masu)'));
// ★3つの操作は共通クラス(MASU_DETAIL_ACTION_CLASS)へまとめられた。
//   高さは「指で押せる大きさか」で見る(何pxかを決め打ちしない)
const actionClass = (source.match(/const MASU_DETAIL_ACTION_CLASS = '([^']*)'/) || [])[1] || '';
const actionMinH = Number((actionClass.match(/min-h-\[(\d+)px\]/) || [])[1] || 0);
check('3つの操作は対象名つきのアクセシブルなタップボタン', ['を強化','をトレーニング','を染色'].every(label=>detail.includes(`aria-label={\`${'${masu.name}'}${label}\`}`))
  && (detail.match(/MASU_DETAIL_ACTION_CLASS/g)||[]).length>=3 && actionMinH>=44);
check('トレーニングと染色のモーダルはiPhoneのSafe Area内に収まる', (source.match(/paddingBottom:'calc\(1rem \+ env\(safe-area-inset-bottom\)\)'/g)||[]).length>=2 && source.includes('aria-label={`${masu.name}のトレーニング`}') && source.includes('aria-label={`${masu.name}の染色`}'));
check('限界突破・転生・合体の操作導線を追加していない', !detail.includes('限界突破する') && !detail.includes('転生する') && !detail.includes('合体する'));
check('重トレーニングチケットは表示名だけ変更', /id:'training_ticket_l', name:"重トレーニングチケット", type:'item', emoji:"🎟️", cost:1000, bondXp:150/.test(breeder));

process.exit(failed ? 1 : 0);
