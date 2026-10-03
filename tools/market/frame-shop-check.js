// プロフィールフレームを売る準備(2026-10-03)を確かめる。
//
//   ユーザー指示「フレームも販売実装を予定してるから、ブリーダーポイントとビートポイントのとこに
//   実装できる準備をしといて」。いまは売るフレームが1つも無い。枠に売り値を書けば交換所に並んで買える、
//   という土台だけを入れた。ここでは「売り物を1つ入れたら正しく動く」ことを、検査の中だけで作った
//   仮の売り物で確かめる(ゲームのデータには何も足さない)。
//
// 見るもの
//   ① いまは売るフレームが1つも無い(ゲームに入っているデータでは、何も並ばない・タブも出ない)
//   ② 売り値(unlock:{shop,cost})の読み方。壊れた書き方は「売り物ではない」になり、検査が拾う
//   ③ ★売る枠を買うまで選べない(unlock が無い枠は最初から全員が選べる、という決まりを破らない)
//   ④ ビートP交換所の計算(rhythmEventPointExchangePreview)が frame を扱う
//   ⑤ 買ったあとの保存は mh_profile_frame_owned_v1 だけ(新しい保存キーを増やしていない)
//   ⑥ 画面・処理のつなぎ
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const breeder = read('monster-hero/data/breeder.js');
const rhythmEvent = read('monster-hero/data/rhythm-event.js');
const app = read('monster-hero/src/parts/60-app.jsx');
const market = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const widgets = read('monster-hero/src/parts/20-market-notices-help.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// フレームの定義から売り値の関数まで(画像の定数に頼らない範囲)を取り出して動かす
const start = breeder.indexOf('const PROFILE_FRAME_NONE_ID');
const end = breeder.indexOf('\n', breeder.indexOf('const nextProfileFrameForAssistant')) ;
const block = breeder.slice(start, breeder.indexOf('\n};', end) + 3);
check('フレームと売り値の定義を取り出せる', start >= 0 && block.includes('const profileFrameSale') && block.includes('const profileFramesForSale'));
const load = (fake = '') => {
  const ctx = { BREEDER_MARKET_ITEMS: [] };
  vm.createContext(ctx);
  // 検査の中だけで仮の売り物を足す(PROFILE_FRAMES の最後に差し込む)。ゲームのデータそのものは書き換えない(別のコンテキストで動かす)
  const src = fake ? block.replace(/\n\];\nconst PROFILE_FRAME_MAP/, `\n${fake}];\nconst PROFILE_FRAME_MAP`) : block;
  vm.runInContext(`${src}\nthis.out={PROFILE_FRAMES,PROFILE_FRAME_SHOPS,profileFrameSale,profileFramesForSale,profileFramesWithBrokenSale,profileFrameOwned,normalizeProfileFrameId,releasedProfileFrames,profileFrameUnlock,BREEDER_MARKET_ITEMS};`, ctx);
  return ctx.out;
};

// ① いまは売る枠が無い
const real = load();
check('いまは売るフレームが1つも無い(ブリーダーP・ビートPとも)',
  real.profileFramesForSale('breederPoint').length === 0 && real.profileFramesForSale('beatPoint').length === 0);
check('売る枠として書かれているのに売り値が壊れている枠も無い', real.profileFramesWithBrokenSale().length === 0, real.profileFramesWithBrokenSale().join(','));
check('いまの商品の一覧にフレームは入っていない', real.BREEDER_MARKET_ITEMS.every(item => item.type !== 'frame'));
check('もともとの枠(条件なし・助手の仲良し度)の選べる・選べないは変わらない',
  real.profileFrameOwned('gold', []) === true && real.profileFrameOwned('none', []) === true
  && real.profileFrameOwned('frame_mua_1', []) === false && real.profileFrameOwned('frame_mua_1', ['frame_mua_1']) === true);

// ② 売り値の読み方
// ★PROFILE_FRAME_MAP は定義の直後に1度だけ作られるので、あとから push しても引けない。
//   本物のデータは最初から PROFILE_FRAMES に入っているので問題ない。ここでは定義の文字を書き換えて仮の枠を入れる
const FAKE_FRAME = (unlock, released) => `  { id:'fake_sale', name:'うりもの', kind:'css', className:'mh-profile-frame-gold', released:${released}, desc:'検査用の仮の枠', unlock:${unlock} },\n`;
const FAKE = (unlock, released = 'true') => FAKE_FRAME(unlock, released);
const fakeBp = load(FAKE("{ shop:'breederPoint', cost:300 }"));
const fakeBeat = load(FAKE("{ shop:'beatPoint', cost:1500 }"));
check('売り値を読める(ブリーダーP・ビートP)',
  JSON.stringify(fakeBp.profileFrameSale(fakeBp.PROFILE_FRAMES.find(f => f.id === 'fake_sale'))) === '{"shop":"breederPoint","cost":300,"currency":"breederPoint"}'
  && JSON.stringify(fakeBeat.profileFrameSale(fakeBeat.PROFILE_FRAMES.find(f => f.id === 'fake_sale'))) === '{"shop":"beatPoint","cost":1500,"currency":"beatPoint"}');
check('その交換所の売り場にだけ並ぶ',
  fakeBp.profileFramesForSale('breederPoint').map(f => f.id).join() === 'fake_sale' && fakeBp.profileFramesForSale('beatPoint').length === 0
  && fakeBeat.profileFramesForSale('beatPoint').map(f => f.id).join() === 'fake_sale' && fakeBeat.profileFramesForSale('breederPoint').length === 0);
check('未公開(released:false)の枠は売り場に並ばない', load(FAKE("{ shop:'beatPoint', cost:1500 }", 'false')).profileFramesForSale('beatPoint').length === 0);
for (const [label, unlock] of [['値段が0', "{ shop:'beatPoint', cost:0 }"], ['値段が無い', "{ shop:'beatPoint' }"], ['交換所の名前が違う', "{ shop:'dia', cost:100 }"], ['値段が文字', "{ shop:'beatPoint', cost:'abc' }"]]) {
  const broken = load(FAKE(unlock));
  check(`壊れた売り値(${label})は売り物にならず、検査が拾う`,
    broken.profileFramesForSale('beatPoint').length === 0 && broken.profileFramesWithBrokenSale().join() === 'fake_sale');
}

// ③ ★買うまで選べない
check('★売る枠は、買うまで選べない(無料で全員に出ない)',
  fakeBeat.profileFrameOwned('fake_sale', []) === false && fakeBeat.profileFrameOwned('fake_sale', ['gold']) === false);
check('買ったら選べる(持っているidに入っている)', fakeBeat.profileFrameOwned('fake_sale', ['fake_sale']) === true);
check('売る枠は公開(released:true)なので、ランキングで他の人が付けていれば描かれる', fakeBeat.normalizeProfileFrameId('fake_sale') === 'fake_sale');
check('未公開の枠は、売り値があっても描かれない', load(FAKE("{ shop:'beatPoint', cost:1500 }", 'false')).normalizeProfileFrameId('fake_sale') === 'none');
check('ブリーダーP交換所の商品は、売り値の枠から自動で作る(type:\'frame\')',
  /PROFILE_FRAMES\s*\n?\s*\.filter\(frame => frame\.released === true && \(frame\.unlock && frame\.unlock\.shop === 'breederPoint'\)\)/.test(breeder)
  && breeder.includes("BREEDER_MARKET_ITEMS.push({ id:frame.id, name:`${frame.name}のフレーム`, type:'frame', cost:sale.cost"));

// ④ ビートP交換所の計算
const ctx2 = {};
vm.createContext(ctx2);
vm.runInContext(`${rhythmEvent}\nthis.out={rhythmEventPointExchangePreview,RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS};`, ctx2);
const E = ctx2.out;
check('(breeder.js が無い環境でも)この定義だけを読めて、フレームの交換の一覧は空', Array.isArray(E.RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS) && E.RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS.length === 0);
const offer = { id:'frame_fake_sale', name:'うりもののフレーム', kind:'frame', frameId:'fake_sale', grantAmount:1, unit:'枚', cost:1500 };
const ok1 = E.rhythmEventPointExchangePreview({ offer, eventPoints:2000, ownedProfileFrames:['gold'] });
check('ビートPが足りれば交換でき、1,500P引かれて、持っているフレームに足される',
  ok1.ok && ok1.eventPoints === 500 && ok1.frameId === 'fake_sale' && JSON.stringify(ok1.ownedProfileFrames) === '["gold","fake_sale"]');
check('ダイヤ・所持品は変わらない', ok1.gold === 0 && Object.keys(ok1.ownedItems).length === 0);
const short = E.rhythmEventPointExchangePreview({ offer, eventPoints:1499, ownedProfileFrames:[] });
check('ビートPが足りないと交換できず、何も変わらない', !short.ok && short.reason === 'points' && short.eventPoints === 1499);
const owned = E.rhythmEventPointExchangePreview({ offer, eventPoints:9999, ownedProfileFrames:['fake_sale'] });
check('持っているフレームは交換できない(1枚につき1回)', !owned.ok && owned.reason === 'owned' && owned.eventPoints === 9999);
check('frameId の無い・壊れた商品は交換できない', !E.rhythmEventPointExchangePreview({ offer:{ ...offer, frameId:'' }, eventPoints:9999 }).ok);
check('個数を増やしても1枚ぶんしか引かない', E.rhythmEventPointExchangePreview({ offer, eventPoints:9000, quantity:5, ownedProfileFrames:[] }).eventPoints === 7500);

// ⑤ 保存
check('買ったあとの保存は mh_profile_frame_owned_v1 だけ(ビートP交換所)',
  app.includes('...(isFrame ? [{ key:PROFILE_FRAME_OWNED_KEY, before:storedFrames, next:exchange.ownedProfileFrames }] : []),'));
check('買ったあとの保存は mh_profile_frame_owned_v1 だけ(ブリーダーP交換所)',
  /else if \(item\.type === 'frame'\) \{[\s\S]{0,500}storeSet\(PROFILE_FRAME_OWNED_KEY, nextFrames, false\);/.test(app));
check('新しい保存キーを増やしていない(SAVE_DATA.md の一覧は変えなくてよい)', !/mh_profile_frame_shop|mh_frame_sale/.test(app + breeder + rhythmEvent + saveSpec));
check('所持の判定がフレームの商品を扱う', app.includes("if (item.type === 'frame') return normalizeOwnedProfileFrames(ownedProfileFrames).includes(item.id);"));

// ⑥ 画面
check('売る枠が無いうちは、ブリーダーP交換所に「フレーム」タブを出さない',
  market.includes("...(breederFrameItems.length?[{key:'frame',label:'フレーム'}]:[])"));
check('売る枠が無いうちは、ビートP交換所にも「フレーム」タブを出さない',
  market.includes("...(RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS.length?[{key:'frame',label:'フレーム'}]:[])"));
check('ビートP交換所の売り場が、売る枠から自動で並ぶ', market.includes("{eventTab==='frame'&&RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS.map(offer=>{"));
check('商品の絵はフレームを自分のアイコンへ重ねて見せる(拡大も)',
  widgets.includes("if(item.type==='frame'){") && app.includes('data-market-frame-zoom={item.id}'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
