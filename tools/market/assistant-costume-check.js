// 助手の着替え(2026-10-03)を確かめる。
//
//   ユーザー指示「助手の着替え機能を作りたいからプロフィールに作って。着替え自体はマーケットに販売する予定だから、
//   そのタブも追加でいれといて」。いまは売る服が1着も無い。ASSISTANT_COSTUMES に1件足せば、
//   マーケット(ダイヤショップ・ビートP交換所)に並んで買えて、プロフィールで着替えられる、という土台だけを入れた。
//   ここでは「服を1着入れたら正しく動く」ことを、検査の中だけで作った仮の服で確かめる(ゲームのデータには何も足さない)。
//
// 見るもの
//   ① いまは売る服が0着で、入口(プロフィールの着替え・マーケットのタブ)が出ない
//   ② 売り値(price.diamond / price.beatPoint)の読み方。壊れた書き方は「売り物ではない」になり、検査が拾う
//   ③ 保存の読み方(壊れた値・持っていない服・他の助手の服でも落ちない。元の服へ戻る)
//   ④ 着ている服が助手の顔・立ち絵の出し口(assistants.js)に反映される。服の絵が無い表情は元の服へ落ちる
//   ⑤ ダイヤショップの商品とビートP交換所の交換(rhythmEventPointExchangePreview)が costume を扱う
//   ⑥ 保存は新しい2つのキーだけ(既存の mh_* を増やさない・書き換えない)
//   ⑦ 画面・処理のつなぎ
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const breeder = read('monster-hero/data/breeder.js');
const rhythmEvent = read('monster-hero/data/rhythm-event.js');
const assistants = read('monster-hero/data/assistants.js');
const app = read('monster-hero/src/parts/60-app.jsx');
const market = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const profile = read('monster-hero/src/parts/56-screen-profile.jsx');
const purchase = read('monster-hero/src/parts/11-masu-progression.jsx');
const saveSpec = read('docs/spec/SAVE_DATA.md');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 着替えの定義(画像の定数に頼らない範囲)を取り出して動かす
const start = breeder.indexOf('const ASSISTANT_COSTUME_OWNED_KEY');
const endMarker = '    BREEDER_MARKET_ITEMS.push({ id:costume.id';
const end = breeder.indexOf('\n  });', breeder.indexOf(endMarker)) + '\n  });'.length;
const block = breeder.slice(start, end);
check('着替えの定義を取り出せる', start >= 0 && end > start && block.includes('const assistantCostumeImage') && block.includes('BREEDER_MARKET_ITEMS.push'));

const load = (fake = '') => {
  const ctx = { BREEDER_MARKET_ITEMS: [] };
  vm.createContext(ctx);
  const src = fake ? block.replace('const ASSISTANT_COSTUMES = Object.freeze([]);', `const ASSISTANT_COSTUMES = Object.freeze([${fake}]);`) : block;
  vm.runInContext(`${src}\nthis.out={ASSISTANT_COSTUMES,ASSISTANT_COSTUME_PUBLIC_RELEASE,normalizeOwnedAssistantCostumes,releasedAssistantCostumes,assistantCostumeById,assistantCostumesFor,assistantCostumeFeatureOn,assistantCostumeSales,assistantCostumeSaleIn,assistantCostumesWithBrokenSale,assistantCostumeOwned,normalizeWornAssistantCostumes,setAssistantCostumeWornNow,assistantCostumeWornFor,assistantCostumeImage,items:BREEDER_MARKET_ITEMS};`, ctx);
  return ctx.out;
};
const FAKE = `
  { id:'mua_test_v1', assistantId:'mua', name:'テストの服', desc:'検査用', released:true, icon:'images/x/face/myua_happy.PNG', imageDir:'images/x', price:{ diamond:3000, beatPoint:1500 } },
  { id:'kiki_test_v1', assistantId:'kiki', name:'ききの服', desc:'検査用', released:true, imageDir:'images/y', price:{ beatPoint:900 } },
  { id:'mua_hidden_v1', assistantId:'mua', name:'未公開', released:false, price:{ diamond:1 } },
  { id:'mua_free_v1', assistantId:'mua', name:'値段なし', released:true },`;

// ① いまは売る服が0着
const real = load();
check('いまは売る服が0着で、入口を出さない', real.releasedAssistantCostumes().length === 0 && real.assistantCostumeFeatureOn() === false && real.items.length === 0);

// ② 売り値
const t = load(FAKE);
const mua = t.assistantCostumeById('mua_test_v1');
check('公開済みの服だけが見える(未公開は見えない)', !!mua && !t.assistantCostumeById('mua_hidden_v1') && t.releasedAssistantCostumes().length === 3);
check('服が1着でも公開されると入口が出る', t.assistantCostumeFeatureOn() === true);
check('売り値を両方の交換所で読める', t.assistantCostumeSaleIn(mua, 'diamond').cost === 3000 && t.assistantCostumeSaleIn(mua, 'beatPoint').cost === 1500);
check('片方だけ書いた服は、その交換所にだけ並ぶ', !t.assistantCostumeSaleIn(t.assistantCostumeById('kiki_test_v1'), 'diamond') && t.assistantCostumeSaleIn(t.assistantCostumeById('kiki_test_v1'), 'beatPoint').cost === 900);
check('値段を書いていない公開済みの服は検査が拾う(無料で着られてしまうため)', t.assistantCostumesWithBrokenSale().join() === 'mua_free_v1', t.assistantCostumesWithBrokenSale().join());
check('助手ごとに服を分ける', t.assistantCostumesFor('mua').length === 2 && t.assistantCostumesFor('kiki').length === 1 && t.assistantCostumesFor('dra').length === 0);

// ダイヤショップの商品が自動で並ぶ
check('ダイヤの売り値がある服だけがダイヤショップに並ぶ', t.items.length === 1 && t.items[0].id === 'mua_test_v1' && t.items[0].type === 'costume' && t.items[0].currency === 'diamond' && t.items[0].cost === 3000);

// ③ 保存の読み方
check('壊れた値でも持ち物は文字列の配列になる', JSON.stringify(t.normalizeOwnedAssistantCostumes(null)) === '[]' && JSON.stringify(t.normalizeOwnedAssistantCostumes('x')) === '[]'
  && JSON.stringify(t.normalizeOwnedAssistantCostumes(['a', 'a', 3, '', ' b '])) === '["a","b"]');
check('持っていない服・他の助手の服・消えた服は着ていないことになる',
  JSON.stringify(t.normalizeWornAssistantCostumes({ mua: 'mua_test_v1' }, [])) === '{}'
  && JSON.stringify(t.normalizeWornAssistantCostumes({ kiki: 'mua_test_v1' }, ['mua_test_v1'])) === '{}'
  && JSON.stringify(t.normalizeWornAssistantCostumes({ mua: 'gone' }, ['gone'])) === '{}'
  && JSON.stringify(t.normalizeWornAssistantCostumes(['mua'], ['mua_test_v1'])) === '{}'
  && JSON.stringify(t.normalizeWornAssistantCostumes(undefined, undefined)) === '{}');
check('持っている自分の服は着ていると読める', JSON.stringify(t.normalizeWornAssistantCostumes({ mua: 'mua_test_v1', kiki: 'kiki_test_v1' }, ['mua_test_v1'])) === '{"mua":"mua_test_v1"}');
check('持っているかを判定できる', t.assistantCostumeOwned('mua_test_v1', ['mua_test_v1']) && !t.assistantCostumeOwned('mua_test_v1', []) && !t.assistantCostumeOwned('mua_hidden_v1', ['mua_hidden_v1']));

// ④ 画像の出し口
const who = { id: 'mua', imagePrefix: 'myua', imageDir: 'images/assistant', expressions: ['normal', 'happy'] };
check('着ていないあいだは服の絵を返さない(元の服の絵が使われる)', t.assistantCostumeImage(who, 'happy', 'face') === null);
t.setAssistantCostumeWornNow({ mua: 'mua_test_v1' });
check('着ると顔と立ち絵が服の絵になる', t.assistantCostumeImage(who, 'happy', 'face') === 'images/x/face/myua_happy.PNG' && t.assistantCostumeImage(who, 'happy', 'full') === 'images/x/myua_happy.PNG');
check('その助手の表情に無いものは服の絵を返さず、元の服へ落ちる', t.assistantCostumeImage(who, 'angry', 'face') === null);
check('ほかの助手には効かない', t.assistantCostumeImage({ ...who, id: 'kiki', imagePrefix: 'kiki' }, 'happy', 'face') === null);
t.setAssistantCostumeWornNow(null);
check('着ている服の入れ物が壊れていても落ちない', t.assistantCostumeImage(who, 'happy', 'face') === null);
check('assistants.js の顔・立ち絵の出し口が服の絵を先に見る',
  /assistantCostumeImage\(who, assistantExpressionName\(who, expression\), 'face'\)/.test(assistants) && /assistantCostumeImage\(who, assistantExpressionName\(who, expression\), 'full'\)/.test(assistants)
  && assistants.includes("typeof assistantCostumeImage === 'function'"));

// ⑤ ビートP交換所
const reStart = rhythmEvent.indexOf('const RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS');
const reEnd = rhythmEvent.indexOf('\n};\n', rhythmEvent.indexOf('const rhythmEventPointExchangePreview')) + 4;
check('ビートP交換所の定義を取り出せる', reStart >= 0 && reEnd > reStart);
const ctx2 = { BREEDER_MARKET_ITEMS: [] };
vm.createContext(ctx2);
vm.runInContext(`${block.replace('const ASSISTANT_COSTUMES = Object.freeze([]);', `const ASSISTANT_COSTUMES = Object.freeze([${FAKE}]);`)}\n${rhythmEvent.slice(reStart, reEnd)}\nthis.out={RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS,rhythmEventPointExchangePreview};`, ctx2);
const offers = ctx2.out.RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS;
check('ビートPの売り値がある服だけが交換所に並ぶ', offers.map(o => o.costumeId).join() === 'mua_test_v1,kiki_test_v1' && offers[0].cost === 1500 && offers[1].cost === 900, offers.map(o => o.costumeId).join());
const ex = ctx2.out.rhythmEventPointExchangePreview;
const ok = ex({ offer: offers[0], eventPoints: 2000, gold: 10, ownedItems: { a: 1 }, ownedAssistantCostumes: [] });
check('交換できる(ビートPだけ減り、ダイヤ・所持品は変わらない)', ok.ok && ok.eventPoints === 500 && ok.gold === 10 && ok.ownedItems.a === 1 && ok.ownedAssistantCostumes.join() === 'mua_test_v1' && ok.costumeId === 'mua_test_v1');
check('ビートPが足りないと交換できない', ex({ offer: offers[0], eventPoints: 1499, ownedAssistantCostumes: [] }).reason === 'points');
check('持っている服は交換できない', ex({ offer: offers[0], eventPoints: 9999, ownedAssistantCostumes: ['mua_test_v1'] }).reason === 'owned');
check('壊れた持ち物でも落ちない', ex({ offer: offers[0], eventPoints: 9999, ownedAssistantCostumes: null }).ok === true);
check('服のidが無い交換は受けない', ex({ offer: { ...offers[0], costumeId: '' }, eventPoints: 9999 }).reason === 'invalidOffer');

// ⑥ 保存キー
check('保存キーは新しい2つだけ', block.includes("'mh_assistant_costume_owned_v1'") && block.includes("'mh_assistant_costume_worn_v1'"));
check('SAVE_DATA.md に新しい2つのキーが書いてある', saveSpec.includes('mh_assistant_costume_owned_v1') && saveSpec.includes('mh_assistant_costume_worn_v1'));
check('読み込みで保存値を書き戻さない(あるのは読み込みだけ)', !/storeSet\(ASSISTANT_COSTUME_OWNED_KEY, loadedCostumes/.test(app) && !/storeSet\(ASSISTANT_COSTUME_WORN_KEY, normalizeWornAssistantCostumes\(await/.test(app));

// ⑦ 画面・処理のつなぎ
check('買う処理が costume を扱う(保存を読み直して足す)', /item\.type === 'costume'\) \{[\s\S]{0,400}storeGet\(ASSISTANT_COSTUME_OWNED_KEY[\s\S]{0,400}storeSet\(ASSISTANT_COSTUME_OWNED_KEY/.test(app));
check('所持の判定が costume を扱う', app.includes("if (item.type === 'costume') return normalizeOwnedAssistantCostumes(ownedAssistantCostumes)"));
check('通貨はダイヤ(購入計算・売り場の表示とも)', /item\?\.type === 'costume'\) \? 'diamond'/.test(purchase) && read('monster-hero/src/parts/20-market-notices-help.jsx').includes("item?.type==='costume') ? 'diamond'"));
check('ビートP交換が costume の保存を同じ取引に入れる', /isCostume \? \[\{ key:ASSISTANT_COSTUME_OWNED_KEY, before:storedCostumes, next:exchange\.ownedAssistantCostumes \}\]/.test(app));
check('マーケット: ダイヤショップに「着替え」タブ(服があるときだけ)', market.includes("...(costumeItems.length?[{key:'costume',label:'着替え'}]:[])"));
check('マーケット: ビートP交換所に「着替え」タブ(服があるときだけ)', market.includes("...(RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS.length?[{key:'costume',label:'着替え'}]:[])"));
check('マーケット: ビートP交換所が交換の確認へつながる', market.includes("eventTab==='costume'&&RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS.map") && market.includes("data-event-point-costume"));
check('プロフィールに「着替え」の入口(服があるときだけ)', profile.includes('data-profile-tile="costume"') && profile.includes('costumeEnabled&&onOpenCostumePicker'));
check('着替えの窓が持っていない服に鍵を付け、元の服へ戻せる', app.includes('data-assistant-costume-locked') && app.includes("wearAssistantCostume(who.id, costume?costume.id:null)"));
check('着替えは持っている服・その助手の服だけ受ける', /costume\.assistantId !== assistantId \|\| !ownedAssistantCostumesRef\.current\.includes\(costume\.id\)/.test(app));
check('描く瞬間に「いま着ている服」を助手の出し口へ渡す', app.includes('setAssistantCostumeWornNow(wornAssistantCostumes)'));

console.log(failed ? `\n${failed} 件失敗` : '\nすべてOK');
process.exit(failed ? 1 : 0);
