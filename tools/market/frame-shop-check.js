// プロフィールフレームを売る準備(2026-10-03)を確かめる。
//
//   ユーザー指示「フレームも販売実装を予定してるから、ブリーダーポイントとビートポイントのとこに
//   実装できる準備をしといて」。いまは売るフレームが1つも無い。枠に売り値を書けば交換所に並んで買える、
//   という土台だけを入れた。ここでは「売り物を1つ入れたら正しく動く」ことを、検査の中だけで作った
//   仮の売り物で確かめる(ゲームのデータには何も足さない)。
//
// 見るもの
//   ① いま売っているのは、モンスターの枠10枚だけ(モッチー・ムー・スエゾービート・スエゾー・ゴーレム・ライガー・ハム・ピクシー・ミーア・ラグナロク)。
//      ブリーダーP交換所にもビートP交換所にも並び、どれも買える条件が付いている(2026-10-03・ユーザー指示)。
//      後ろの7枚は、条件がブリーダーP交換所だけにかかる(ビートP交換所は条件なし)。そのほかの枠は売らない
//   ② 売り値(unlock:{shop,cost} と unlock:{shops:[…]})の読み方。壊れた書き方は「売り物ではない」になり、検査が拾う
//   ③ ★売る枠を買うまで選べない(unlock が無い枠は最初から全員が選べる、という決まりを破らない)
//   ④ ビートP交換所の計算(rhythmEventPointExchangePreview)が frame を扱う
//   ⑤ 買ったあとの保存は mh_profile_frame_owned_v1 だけ(新しい保存キーを増やしていない)
//   ⑥ 画面・処理のつなぎ
//   ⑦ 買える条件(unlock.condition)。達成するまで買えず、買う処理でも保存値を読み直して確かめる
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
  vm.runInContext(`${src}\nthis.out={PROFILE_FRAMES,PROFILE_FRAME_SHOPS,profileFrameSale,profileFrameSaleIn,profileFrameSales,profileFrameCondition,profileFrameConditionFor,profileFramesForSale,profileFramesWithBrokenSale,profileFrameOwned,normalizeProfileFrameId,releasedProfileFrames,profileFrameUnlock,BREEDER_MARKET_ITEMS};`, ctx);
  return ctx.out;
};

// ① いま売っているのはモンスターの3枚だけ
const real = load();
const SOLD = ['frame_mocchi', 'frame_moo', 'frame_suezo_beat', 'frame_suezo', 'frame_golem', 'frame_tiger', 'frame_ham', 'frame_pixie', 'frame_mia', 'frame_ragnarok'];
const NEW6 = SOLD.slice(3);
check('いま売っているフレームは、モンスターの枠10枚だけ(ブリーダーP・ビートPの両方)',
  real.profileFramesForSale('breederPoint').map(f => f.id).join() === SOLD.join()
  && real.profileFramesForSale('beatPoint').map(f => f.id).join() === SOLD.join(),
  `${real.profileFramesForSale('breederPoint').map(f => f.id).join()} / ${real.profileFramesForSale('beatPoint').map(f => f.id).join()}`);
check('値段はブリーダーP 1 / ビートP 100(ラグナロクだけビートP 10000)',
  SOLD.every(id => {
    const f = real.PROFILE_FRAMES.find(x => x.id === id);
    return real.profileFrameSaleIn(f, 'breederPoint').cost === 1 && real.profileFrameSaleIn(f, 'beatPoint').cost === (id === 'frame_ragnarok' ? 10000 : 100);
  }));
check('10枚とも買える条件が付いている', SOLD.every(id => !!real.profileFrameCondition(real.PROFILE_FRAMES.find(x => x.id === id))));
check('売る枠として書かれているのに売り値が壊れている枠も無い', real.profileFramesWithBrokenSale().length === 0, real.profileFramesWithBrokenSale().join(','));
check('いまの商品の一覧に入っているフレームは、売っている10枚だけ',
  real.BREEDER_MARKET_ITEMS.filter(item => item.type === 'frame').map(item => item.id).join() === SOLD.join());
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
// 本物のモンスターの3枚も並ぶので、仮の枠だけを取り出して見る
const fakeIn = (m, shop) => m.profileFramesForSale(shop).filter(f => f.id === 'fake_sale').length;
check('その交換所の売り場にだけ並ぶ',
  fakeIn(fakeBp, 'breederPoint') === 1 && fakeIn(fakeBp, 'beatPoint') === 0
  && fakeIn(fakeBeat, 'beatPoint') === 1 && fakeIn(fakeBeat, 'breederPoint') === 0);
const fakeBoth = load(FAKE("{ shops:[{ shop:'breederPoint', cost:1 }, { shop:'beatPoint', cost:100 }] }"));
check('1つの枠を2つの交換所で売れる(値段は交換所ごと)',
  fakeIn(fakeBoth, 'breederPoint') === 1 && fakeIn(fakeBoth, 'beatPoint') === 1
  && fakeBoth.profileFrameSaleIn(fakeBoth.PROFILE_FRAMES.find(f => f.id === 'fake_sale'), 'breederPoint').cost === 1
  && fakeBoth.profileFrameSaleIn(fakeBoth.PROFILE_FRAMES.find(f => f.id === 'fake_sale'), 'beatPoint').cost === 100);
check('2つの交換所の片方が壊れていたら、検査が拾う',
  load(FAKE("{ shops:[{ shop:'breederPoint', cost:1 }, { shop:'beatPoint', cost:0 }] }")).profileFramesWithBrokenSale().join() === 'fake_sale');
check('未公開(released:false)の枠は売り場に並ばない', fakeIn(load(FAKE("{ shop:'beatPoint', cost:1500 }", 'false')), 'beatPoint') === 0);
for (const [label, unlock] of [['値段が0', "{ shop:'beatPoint', cost:0 }"], ['値段が無い', "{ shop:'beatPoint' }"], ['交換所の名前が違う', "{ shop:'dia', cost:100 }"], ['値段が文字', "{ shop:'beatPoint', cost:'abc' }"]]) {
  const broken = load(FAKE(unlock));
  check(`壊れた売り値(${label})は売り物にならず、検査が拾う`,
    fakeIn(broken, 'beatPoint') === 0 && broken.profileFramesWithBrokenSale().join() === 'fake_sale');
}

// ③ ★買うまで選べない
check('★売る枠は、買うまで選べない(無料で全員に出ない)',
  fakeBeat.profileFrameOwned('fake_sale', []) === false && fakeBeat.profileFrameOwned('fake_sale', ['gold']) === false);
check('買ったら選べる(持っているidに入っている)', fakeBeat.profileFrameOwned('fake_sale', ['fake_sale']) === true);
check('売る枠は公開(released:true)なので、ランキングで他の人が付けていれば描かれる', fakeBeat.normalizeProfileFrameId('fake_sale') === 'fake_sale');
check('未公開の枠は、売り値があっても描かれない', load(FAKE("{ shop:'beatPoint', cost:1500 }", 'false')).normalizeProfileFrameId('fake_sale') === 'none');
check('ブリーダーP交換所の商品は、売り値の枠から自動で作る(type:\'frame\')',
  /PROFILE_FRAMES\s*\n?\s*\.filter\(frame => frame\.released === true && profileFrameSaleIn\(frame, 'breederPoint'\)\)/.test(breeder)
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
check('売る枠が無いときは、ブリーダーP交換所に「フレーム」タブを出さない',
  market.includes("...(breederFrameItems.length?[{key:'frame',label:'フレーム'}]:[])"));
check('売る枠が無いときは、ビートP交換所にも「フレーム」タブを出さない',
  market.includes("...(RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS.length?[{key:'frame',label:'フレーム'}]:[])"));
check('ビートP交換所の売り場が、売る枠から自動で並ぶ', market.includes("{eventTab==='frame'&&RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS.map(offer=>{"));
check('商品の絵はフレームを自分のアイコンへ重ねて見せる(拡大も)',
  widgets.includes("if(item.type==='frame'){") && app.includes('data-market-frame-zoom={item.id}'));

// ⑦ 買える条件
const cond = (id) => real.profileFrameCondition(real.PROFILE_FRAMES.find(f => f.id === id));
check('モッチーの条件は、モッチー種(主血統 mocchi)を1回以上限界突破', cond('frame_mocchi').kind === 'speciesRebirth' && cond('frame_mocchi').lineage === 'mocchi' && cond('frame_mocchi').count === 1);
check('ムーの条件は、難易度マスター以上のクリア', cond('frame_moo').kind === 'difficultyCleared' && cond('frame_moo').difficulty === 'Master');
check('スエゾービートの条件は、モンヒロビート10回クリア', cond('frame_suezo_beat').kind === 'rhythmClears' && cond('frame_suezo_beat').count === 10);
// 新しい6枚: 条件はブリーダーP交換所だけにかかり、ビートP交換所は条件なしで買える
const condFor = (id, shop) => real.profileFrameConditionFor(real.PROFILE_FRAMES.find(f => f.id === id), shop);
check('スエゾー・ゴーレム・ライガー・ハム・ピクシー・ミーアの条件は、そのモンスターを1回転生(monsterReincarnate)',
  [['frame_suezo', 'Suezo'], ['frame_golem', 'Golem'], ['frame_tiger', 'Tiger'], ['frame_ham', 'Ham'], ['frame_pixie', 'Pixie'], ['frame_mia', 'Mia']]
    .every(([id, mon]) => cond(id).kind === 'monsterReincarnate' && cond(id).monsterId === mon && cond(id).count === 1));
check('ラグナロクの条件は、難易度ラグナロク(RAGNAROK)のクリア', cond('frame_ragnarok').kind === 'difficultyCleared' && cond('frame_ragnarok').difficulty === 'RAGNAROK');
check('新しい7枚は、ブリーダーP交換所だけ条件つきで、ビートP交換所は条件なし',
  NEW6.every(id => !!condFor(id, 'breederPoint') && condFor(id, 'beatPoint') === null));
check('もとの3枚は、どちらの交換所でも条件つき',
  SOLD.slice(0, 3).every(id => !!condFor(id, 'breederPoint') && !!condFor(id, 'beatPoint')));
check('転生は reincarnateCount を見る(限界突破の rebirthCount と取り違えない)',
  (() => {
    const at = app.indexOf("c.kind === 'monsterReincarnate'");
    const block = at >= 0 ? app.slice(at, app.indexOf('return {', at)) : '';
    return block.includes('reincarnateCount') && !block.includes('rebirthCount');
  })());
check('壊れた条件(知らない種類)は「条件なし」でなく、売り値の壊れとして検査が拾う',
  load(FAKE("{ shop:'beatPoint', cost:100, condition:{ kind:'nothing' } }")).profileFramesWithBrokenSale().join() === 'fake_sale');
check('ブリーダーP交換所で買うとき、条件を保存値で読み直して確かめる',
  /if \(item\.type === 'frame'\) \{\s*const status = profileFrameConditionStatus\(profileFrameById\(item\.id\), await loadRhythmClearTotal\(\), 'breederPoint'\);\s*if \(status && !status\.met\)/.test(app));
check('ビートP交換所で交換するときも、条件を保存値で読み直して確かめる',
  /if \(isFrame\) \{\s*const frameStatus = profileFrameConditionStatus\(profileFrameById\(offer\.frameId\), await loadRhythmClearTotal\(\), 'beatPoint'\);\s*if \(frameStatus && !frameStatus\.met\)/.test(app));
check('条件が未達成のカードは買えない札が出る(ブリーダーP・ビートP)',
  market.includes('canBuy = !comingSoon && !frameLocked && !owned') && market.includes("canBuy={!owned&&!frameLocked&&safeEventPoints>=offer.cost&&!busy}"));
check('モンヒロビートの通算クリア回数は新しいキーで数え、既存の mh_rhythm_best_v1 は書き換えない',
  breeder.includes("const RHYTHM_CLEAR_TOTAL_KEY = 'mh_rhythm_clear_total_v1'") && app.includes('addRhythmClearTotal()'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
