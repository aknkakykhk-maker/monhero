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
check('編成・ベースモン一覧・マスモン一覧の4種のカードが共通サイズを使う', count('style={MONSTER_CARD_STYLE}') === 4, `${count('style={MONSTER_CARD_STYLE}')}か所`);
check('アイコンの大きさも4種で共通', count('MONSTER_CARD_ICON_CLASS}') === 4, `${count('MONSTER_CARD_ICON_CLASS}')}か所`);
check('強化ポイントの有無で行が消えない', has('{monsterCardSub((masu.distAptPoints||0)>0?') && count('{monsterCardSub(null)}') === 2);
check('編成中バッジの有無で行が消えない', count('{monsterCardStatus(') === 4, `${count('{monsterCardStatus(')}か所`);
check('種別ごとにバラバラだった旧サイズが残っていない',
  !has('className="w-14 h-14 rounded-full overflow-hidden border border-white/10 shrink-0"')
    && !has('<div className="relative w-10 h-10 shrink-0">'));

// --- ② 難易度カードの高さ ---
check('スキップが無い難易度でも同じ高さの行を出す',
  has("if(!tid)return(<div className=\"min-h-[40px] rounded-xl bg-black/25 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 whitespace-nowrap\">この難易度はスキップできません</div>);"));
check('スキップ行を条件付きで丸ごと消していない', !has('{SKIP_TICKETS[key]&&(()=>{'));
// モード(チャレンジ／クイック)を切り替えてもカードの高さが変わらないようにする
check('記録の枠は行数が違ってもモードで同じ高さ',
  has("const recordBoxStyle={minHeight:'58px'};") && count('style={recordBoxStyle}') === 2, `${count('style={recordBoxStyle}')}か所`);
check('倍率の下の補足行はクイック限定にしない',
  has('>{noteText}</div>') && !has('{quick&&<div className="mt-1 rounded-xl border'));

// --- ②' マーケットの商品カード ---
// 名前の行数・説明の有無・所持数の有無・詳細ボタンの有無で、
// 「〜で購入」ボタンの位置がカードごとにずれていた
check('商品名は行数が変わっても同じ高さの枠に入れる', has("style={{minHeight:'30px'}}>{item.name}</div>"));
check('アイテムの説明は説明が無くても同じ高さを取る', has("style={{minHeight:'40px'}}>{item.desc||null}</div>"));
check('所持数と詳細ボタンは同じ高さの1行にまとめる', has("<div className=\"w-full flex items-center justify-center\" style={{height:'24px'}}>"));
check('所持数は0でも消さずに出す', has('所持数: {ownedItems[item.id]||0}') && !has('{item.type===\'item\'&&(ownedItems[item.id]||0)>0&&('));
check('購入ボタンはカードの下端に揃える', has('<div className="w-full flex items-center justify-center mt-auto">'));
check('購入ボタンの文字は折り返さない', has("{usesGold?'ダイヤ':'pt'} で購入</button>") && has('rounded-full flex items-center gap-1 whitespace-nowrap'));

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
