// 画面レイアウトの統一と、画面が小さい端末で中身が切れないかを静的に確認する。
//
// このサンドボックスは外部CDN(Tailwind)へ出られず実描画で確認できないため、
// 「切れる原因になりやすい形」をソース上で潰せているかを機械的に見る。
//   ① モンスターを並べるカードが、種別や強化ポイントの有無で高さを変えない
//   ② 難易度カードが、スキップの有無で高さを変えない
//   ③ 明るい背景の難易度(Master)で文字が白飛びしない
//   ④ 各画面に縦スクロールできる場所があり、背の低い端末で下が切れない
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const count = (needle) => source.split(needle).length - 1;

// --- ① モンスターカードの統一 ---
check('カードの共通サイズを1か所で決めている',
  has("const MONSTER_CARD_CLASS = 'w-full rounded-2xl border-2 p-2 flex flex-col items-center gap-1 active:scale-95 select-none';")
    && has("const MONSTER_CARD_STYLE = { minHeight: '152px' };")
    && has("const MONSTER_CARD_ICON_CLASS = 'w-12 h-12 rounded-full overflow-hidden shrink-0';"));
check('中身が無くても同じ高さの行を確保する',
  has("style={{height:'14px'}}") && has("style={{height:'22px'}}") && has("style={{height:'13px'}}") && has("style={{height:'18px'}}"));
// カードを描く画面は増えていくので件数は決め打ちにせず、「外枠のクラスを使う行は
// 必ず共通サイズも指定する」で見る。片方だけ書いた画面があるとそこだけ高さがずれる
const cardLines = source.split('\n').filter(line => line.includes('MONSTER_CARD_CLASS') && !line.includes('const MONSTER_CARD_CLASS'));
const cardLinesWithoutStyle = cardLines.filter(line => !line.includes('MONSTER_CARD_STYLE'));
check('カードを描く画面はすべて共通クラスと共通サイズをセットで使う',
  cardLines.length >= 4 && cardLinesWithoutStyle.length === 0,
  `${cardLines.length}画面 / サイズ指定もれ ${cardLinesWithoutStyle.length}件`);
// 中身(アイコン・補足行・状態行)は共通部品の中だけで組み立てる。画面ごとに書き写すと
// 片方だけ直したときにずれる(実際にプロモードの横長カードで起きた)
check('カードの中身は共通部品1か所だけで組み立てる',
  count('MONSTER_CARD_ICON_CLASS') === 2 && count('monsterCardSub(') === 1 && count('monsterCardStatus(') === 1,
  `アイコン${count('MONSTER_CARD_ICON_CLASS') - 1}か所 / 補足行${count('monsterCardSub(')}か所 / 状態行${count('monsterCardStatus(')}か所`);
// 中身が無いときは行ごと消さずnullを渡す。消すとカードごとに高さが変わる
check('強化ポイントや編成中バッジが無くても行が消えない',
  has('{monsterCardSub(') && has('{monsterCardStatus(status)}')
    && has("style={{height:'13px'}}>{node||null}") && has("style={{height:'18px'}}>{node||null}"));
check('種別ごとにバラバラだった旧サイズが残っていない',
  !has('className="w-14 h-14 rounded-full overflow-hidden border border-white/10 shrink-0"')
    && !has('<div className="relative w-10 h-10 shrink-0">'));

// --- ② 難易度カードの高さ ---
check('スキップが無い難易度でも同じ高さの行を出す',
  has("if(!tid)return(<div className=\"min-h-[40px] rounded-xl bg-black/25 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 whitespace-nowrap\">この難易度はスキップできません</div>);"));
check('スキップ行を条件付きで丸ごと消していない', !has('{SKIP_TICKETS[key]&&(()=>{'));
// モード(チャレンジ／クイック)を切り替えてもカードの高さが変わらないようにする
// 高さを数値で指定するのではなく、モードで同じ行構成にして高さをそろえる
// (端末のフォントによって1行の高さが変わるため、数値指定では合いきらなかった)
check('記録の枠はモードで同じ行構成', has('const recordBox=(key)=>quick') && !has('recordBoxStyle'));
check('ランキングボタンの場所は決め打ちの高さにする',
  /className=[{`"]*shrink-0 w-full h-10 mb-1/.test(source) && has('className="w-full h-10 rounded-xl'));
check('倍率の下の補足行はクイック限定にしない',
  has('>{noteText}</div>') && !has('{quick&&<div className="mt-1 rounded-xl border'));
// カードの外にある「所持スキップチケット」の帯も、片方のモードだけ消すと
// 難易度カード全体が上下にずれる。文言を変えて同じ高さの帯を両モードで出す
check('スキップチケットの帯をモードで消さない',
  has('{Object.keys(SKIP_TICKETS).length>0&&(')
    && !has('{quick&&Object.keys(SKIP_TICKETS).length>0&&(')
    && has("{quick?'所持スキップチケット':'スキップチケットはクイックモード専用'}")
    && has('gap-1 mb-1 px-2 min-h-[24px]'));
check('モードのタブはランキングでは出さない',
  /\{battleMenuTab==='difficulty'&&<div className=[{`"]*grid grid-cols-2 gap-1 mb-0\.5 shrink-0 rounded-xl/.test(source));
// モードで枠の位置がずれる不具合を何度も出しているので、原因になる書き方そのものを数える。
// 「クイックのときだけ要素を出す」書き方(`{quick&&`)は、高さを固定した枠の中でしか使わない。
// いま許しているのはスキップチケットの枚数バッジ1か所だけ(親に min-h-[24px] がある)。
// 増やしたくなったら、まず親に高さを持たせてからこの本数を見直すこと
{
  const start = source.indexOf("{battleMenuTab==='difficulty'&&(()=>{\n              const quick=isQuickMode(battleMode),difficulties=");
  const end = source.indexOf("{battleMenuTab==='ranking'&&", start);
  const tab = start >= 0 && end > start ? source.slice(start, end) : '';
  const onlyQuick = (tab.match(/\{quick&&/g) || []).length;
  check('難易度タブでモード限定の要素を増やしていない', tab.length > 0 && onlyQuick === 1, `{quick&&…} が${onlyQuick}か所`);
}

// --- ②' マーケットの商品カード ---
// 名前の行数・説明の有無・所持数の有無・詳細ボタンの有無で、
// 「〜で購入」ボタンの位置がカードごとにずれていた
// 名前は最長14文字。細い端末では3行になるので、3行ぶんの枠を確保しておく
check('商品名は行数が変わっても同じ高さの枠に入れる', has("style={{minHeight:'36px'}}>{item.name}</div>"));
// アイテムの効果は詳細ボタンから出す(カードに長い説明を載せると縦に伸びるため)
check('アイテムの効果は詳細ボタンから出す',
  has('onClick={()=>setMarketItemDetail(item)}') && !has("style={{minHeight:'40px'}}>{item.desc||null}</div>"));
check('所持数と詳細ボタンは同じ高さの1行にまとめる',
  has("<div className=\"w-full flex items-center justify-center gap-1\" style={{height:'22px'}}>"));
// 1行に4商品。カードが細くなるので、アイコンの大きさもそれに合わせて1か所で決める
check('1行に4商品ずつ並べる',
  has("const MARKET_GRID_CLASS = 'grid grid-cols-4 gap-2 pb-4';") && has('<div className={MARKET_GRID_CLASS}>'));
// 4つ並べるとアイコンが小さいので、タップで大きく見られるようにしている
check('商品アイコンはタップで拡大できる',
  has('onClick={()=>setMarketIconZoom(item)}') && has('aria-label={`${item.name}を大きく見る`}')
    && has('{marketIconZoom&&(()=>{const item=marketIconZoom;'));
check('拡大表示は実際に使われる形(丸／角丸)で出す',
  has("const round=item.type==='icon'||item.type==='breeder';"));
check('商品アイコンの大きさを1か所で決めている',
  has("const MARKET_ICON_SIZE = { disc: 'w-12 h-12', breeder: 'w-10 h-10', icon: 'w-10 h-10', item: 'w-9 h-9' };")
    && has("${MARKET_ICON_SIZE[item.type]||'w-10 h-10'}"));
check('所持数は0でも消さずに出す', has('×{ownedItems[item.id]||0}') && !has('{item.type===\'item\'&&(ownedItems[item.id]||0)>0&&('));
// 「詳細」のすぐ下に買うボタンがあると、押し間違えて買ってしまう。
// 間に余白を入れ、買うボタン自体も指で押せる高さにしておく
check('購入ボタンはカードの下端に揃える', has('<div className="w-full flex items-center justify-center mt-auto pt-2">'));
check('詳細と購入ボタンを押し間違えない間隔がある',
  has('mt-auto pt-2') && has("px-2.5 min-h-[30px] rounded-full flex items-center gap-0.5 whitespace-nowrap"));
// 細いカードに収めるためボタンの文字は値段だけにし、意味は読み上げ用の説明で補う
check('購入ボタンの文字は折り返さない',
  has("aria-label={`${item.name}を${item.cost}${usesGold?'ダイヤ':'pt'}で購入`}") && has('rounded-full flex items-center gap-0.5 whitespace-nowrap'));
check('状態の表示も折り返さない', has('rounded-full whitespace-nowrap">近日追加</div>') && has('rounded-full whitespace-nowrap">所持済み</div>'));
// 拡大量は表示コードへ直接書かず、アイコンIDごとの表を1か所に持つ。
// ききはマーケット商品とブリーダーカードの両方で同じ値を使うので、定数を共有する
check('ききの拡大量を1か所の表で持ち、縦横比と円形クリップを保つ',
  has('const KIKI_FACE_ICON_ADJUSTMENT = Object.freeze({ scale:2.37, x:0, y:19 });')
    && has('kiki_icon: KIKI_FACE_ICON_ADJUSTMENT,') && has('kiki: KIKI_FACE_ICON_ADJUSTMENT,')
    && has("transform:`translate(${x}%, ${y}%) scale(${scale})`, transformOrigin:'center center'")
    && has('className="absolute inset-0 w-full h-full object-contain"')
    && !has('images/breeder-icons/kiki.PNG') /* 画像パス判定を表示コードへ重複させない */);

// --- ③ Masterの色 ---
check('挑戦ボタンは明るい難易度で文字を暗くする', has("color:setting.darkText?'#0f172a':'#ffffff'"));
check('タブなどの共通スタイルも同じ扱い', has("color: setting.darkText ? '#0f172a' : '#ffffff'"));
check('Masterの文字色が白飛びしない', has("Master:      { label: \"Master\",       power: 5.0,  score: 5.0,  gold: 2.0,  bg: '#e2e8f0', text: '#cbd5e1',"));

// --- ④ 背の低い端末で下が切れないか ---
// HOMEは絶対配置の1画面レイアウトで、専用のメディアクエリで小さい端末に対応している。
// TRAINING_*(修行)は別担当のため対象外にしている
const ABSOLUTE_LAYOUT_SCREENS = ['HOME'];
const OUT_OF_SCOPE_SCREENS = (name) => name.startsWith('TRAINING_');
const screens = [...new Set([...source.matchAll(/gameState==='([A-Z_]+)'&&/g)].map(m => m[1]))];
check('画面が数えられている', screens.length > 20, `${screens.length}画面`);
const noScroll = screens.filter(name => {
  if (ABSOLUTE_LAYOUT_SCREENS.includes(name) || OUT_OF_SCOPE_SCREENS(name)) return false;
  const at = source.indexOf(`gameState==='${name}'&&`);
  return !source.slice(at, at + 9000).includes('overflow-y-auto');
});
check('各画面に縦スクロールできる場所がある', noScroll.length === 0, noScroll.join(', '));
check('HOMEは小さい端末向けの調整がある', has('@media(max-width:350px)') && has('@media(max-height:620px)'));
check('難易度タブは背の低い端末で縦スクロールできる',
  has('return <div className="flex-1 min-h-0 flex flex-col overflow-y-auto mh-scroll"><div className="text-center text-[8px] tracking-[.18em] text-slate-400 font-black shrink-0">左右にスワイプして難易度を選択</div>'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
