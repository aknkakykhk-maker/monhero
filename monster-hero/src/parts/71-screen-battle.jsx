// ==== 画面: バトル ====
//
// 【横向きで背の低い画面の並べ方】(2026-10-26 社長が案Aを選んだ。docs/progress/battle-landscape/)
// 縦持ち用の1列(幅=画面の高さ)のままだと、844×390 では敵の絵が潰れ、手札が画面の下に隠れて
// 「手札と敵を同時に見られない」。横で背の低いときだけ、左に 上の帯・敵の帯・敵の絵と予告・バフ・4枠
// (タクティクスも横1列)、右に 手札とボタン の2列にする。条件は難易度えらびの2列(#3790)と同じ。
// 縦画面には効かない(@media の外には何も書かない)。クラシックとタクティクスは同じ組み方。
// 画面の真ん中に出す札(data-battle-float)は左の列の真ん中へ、列の右端に寄せる札
// (data-battle-float-right="右からの余白")は左の列の右端へ寄せる(右の手札にかからないように)。
// 右の列の幅は MFバトルカードの横向き(カード部ブレイブくん)にそろえて、画面の幅の42%・最大420px(844 で約354px)。
const BATTLE_LANDSCAPE_HAND_W = 'min(42vw, 420px)';
const BATTLE_LANDSCAPE_CSS = `@media (orientation: landscape) and (max-height: 520px) {
#root > div[data-mh-portrait-layout="true"]:has([data-battle-speed]) { max-width: none !important; }
[data-battle-speed] { display: grid !important; grid-template-columns: minmax(0,1fr) ${BATTLE_LANDSCAPE_HAND_W};
  grid-template-rows: auto auto minmax(0,1fr) auto auto auto; }
[data-battle-speed] > * { grid-column: 1; }
[data-battle-speed] > [data-battle-stage-bg] { grid-column: 1 / -1; grid-row: 1 / -1; }
[data-battle-speed] > [data-battle-header] { grid-row: 1; }
[data-battle-speed] > [data-enemy-bar] { grid-row: 2; }
[data-battle-speed] > [data-battle-stage] { grid-row: 3; min-height: 0 !important; overflow: hidden !important; }
[data-battle-speed] > [data-battle-buffs] { grid-row: 4; }
[data-battle-speed] > [data-tactics-board-band] { grid-row: 5; padding-top: 2px !important; padding-bottom: 2px !important; }
[data-battle-speed] > [data-tactics-ex-intro] { grid-row: 6; }
[data-tactics-board-band] .grid.grid-cols-4, [data-tactics-debug-layout] { height: 112px !important; }
[data-tactics-debug-layout] { grid-template-columns: repeat(4,minmax(0,1fr)) !important; grid-template-rows: minmax(0,1fr) !important; }
[data-battle-speed] > [data-battle-hand] { grid-column: 2; grid-row: 1 / -1; height: auto !important; min-height: 0;
  border-top: 0 !important; border-left: 1px solid rgba(255,255,255,.14); overflow-x: hidden; overflow-y: auto; }
[data-battle-hand] > div:first-child { flex-wrap: wrap; row-gap: 4px; margin-bottom: 6px !important; }
[data-battle-hand] > div:first-child > span:first-child { flex: 0 0 100% !important; }
[data-battle-hand] > div:last-child { flex: 0 1 auto !important; flex-wrap: wrap !important; overflow: visible !important;
  align-content: flex-start; justify-content: center; row-gap: 6px; }
[data-battle-hand] > div:last-child > * { flex: 0 0 31% !important; max-width: 31% !important; height: 116px !important; }
[data-battle-float] { left: calc((100vw - ${BATTLE_LANDSCAPE_HAND_W}) / 2) !important; }
[data-battle-float-right] { left: auto !important; transform: none !important; }
[data-battle-float-right="8"] { right: calc(${BATTLE_LANDSCAPE_HAND_W} + 8px) !important; }
[data-battle-float-right="76"] { right: calc(${BATTLE_LANDSCAPE_HAND_W} + 76px) !important; }
}`;
//
// 【誰が攻撃を食らったか】
// 枠ごとに何が起きたか(tacticsSlotFx)を、浮かぶ数字だけでなく**枠そのもの**でも出す
// (2026-09-22 ユーザー指示「攻撃されたときに誰が攻撃されたかが分かりづらい
//  食らったモンスターにエフェクトなどがつくようにしたい」)。
// 色とアイコンはこの表だけに書き、出し方(フラッシュ・輪・縁・揺れ)は1か所にまとめる。
// 新しい種類を足すときは、ここへ1行足して kindOfTacticsSlotFx が返す名前を増やす。
const TACTICS_SLOT_FX_STYLE = Object.freeze({
  hit:     { rgb: '239,68,68',  ring: 'border-red-200',     edge: 'border-red-400' },
  guard:   { rgb: '16,185,129', ring: 'border-emerald-200', edge: 'border-emerald-300' },
  evade:   { rgb: '59,130,246', ring: 'border-sky-200',     edge: 'border-sky-300' },
  reflect: { rgb: '168,85,247', ring: 'border-purple-200',  edge: 'border-purple-300' },
});
// その枠で「いちばん強く伝えたいこと」を1つだけ選ぶ。重ねると何色なのか読めなくなる。
// ★順番に意味がある。かわした・返したは「食らっていない」ので先に見る。
//   ガードは「狙われたが受け止めた」ので、ダメージが通っていなければガード色
// 吹き出しの色づけだけを借りる(大きさ・影・背景・揺れは出す場所の側で決める)。
// ★addPopup の色指定は既存モードの「画面のまんなかに大きく出す」前提で text-4xl などが
//   入っている。枠の中へそのまま入れると1つで枠が埋まるので、色と太さ以外は落とす
const tacticsPopupTone = (color) => String(color || '').split(/\s+/)
  .filter(c => c && !/^(text-(xs|sm|base|lg|xl|\d+xl|\[[^\]]*\])|drop-shadow.*|animate-.*|bg-.*|p[xytblr]?-.*|italic)$/.test(c))
  .join(' ');
// 狙いの印(🎯)に出す数字。★枠の絵の列(幅70pxほど)の中で1行に収める
// (2026-09-23 ユーザー指示「内訳を小さく1行に。ダメージが5桁やそれ以上になることも想定して」)。
// limit 未満はそのまま、それ以上は「1.2万」「35万」「1.2億」のように縮める
const tacticsAimNum = (value, limit = 100000) => {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < limit) return String(n);
  const unit = n >= 1e8 ? [1e8, '億'] : [1e4, '万'];
  const v = n / unit[0];
  return `${v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v)}${unit[1]}`;
};
// 連撃の内訳。全部同じなら「27×3」、違えば「63〜65×3」(いちばん小さい〜大きい)。
// ★1発ずつ「63・63・65」と並べると、枠の右の列(幅100pxほど)でも5桁で入らない
//   (2026-09-24 ユーザー了承「内訳を短くしていい」)。1発ずつの数字は「次の行動」の札に出ている
// ★合計と合わせて18字をこえると枠の横幅でも入らないので、そのときは回数だけ(「×3」)にする
const tacticsAimParts = (parts, totalText = '') => {
  const list = (Array.isArray(parts) ? parts : []).map(v => Math.max(0, Math.floor(Number(v) || 0)));
  if (list.length <= 1) return '';
  const lo = Math.min(...list), hi = Math.max(...list);
  const text = lo === hi ? `${tacticsAimNum(lo, 10000)}×${list.length}` : `${tacticsAimNum(lo, 10000)}〜${tacticsAimNum(hi, 10000)}×${list.length}`;
  return String(totalText).length + text.length > 18 ? `×${list.length}` : text;
};
// 手札の技名を、カードの幅に合わせて1〜3行へ収める(2026-09-24 ユーザー指摘「技名がおさまってない」)。
// ★箱は高さ30pxで固定。11px のまま折り返すと「ホリゾンタル・スクエア」が3行になって上下が切れ、
//   「エッジもんた」は「エッジもん／た」と1字だけ次の行へ落ちていた。
//   6字までは1行、12字までは2行、それより長いときは3行に割り、1行の字数でカードの幅(100cqw)を
//   割った大きさまで字を小さくする(箱の左右の余白4pxと字の丸めのぶん、6px引いてから割る)。cqw が使えない端末では、この指定が捨てられて今までの 11px になる
// boxHeight を渡すと、その高さに行数ぶん収まる大きさでも頭打ちにする(背の低い画面で技名の欄が縮むため)
const handCardNameFit = (name, boxHeight) => {
  const n = [...String(name || '')].length || 1;
  const lines = n <= 6 ? 1 : n <= 12 ? 2 : 3;
  const perLine = Math.ceil(n / lines);
  const lh = lines === 3 ? 1.08 : 1.15;
  const byHeight = boxHeight ? `, calc(${boxHeight} / ${(lines * lh).toFixed(2)})` : '';
  return { fontSize: `min(${lines === 3 ? 10 : 11}px, calc((100cqw - 6px) / ${perLine})${byHeight})`, lineHeight: String(lh) };
};
// 手札のカードの中の段の高さ。★カードの高さは画面の高さで変わる(844pxで133px、667pxで111px)。
// 固定の px のままだと、背の低い画面では「⇄ 技変更」の帯を足したぶん(もとから4px)下へはみ出していた。
// 背の高い画面では今までと同じ大きさ(絵36px・技名30px)になるよう、上限を今までの値にしてある
// ★行動カードの絵(2026-10-15 社長「バトルカードの変更も進めて」)。公開の印 battleCardArt か、デバッグ設定の切り替えで出す。
//   切り替えは端末だけに持つデバッグ用の印(mh_debug_battle_card_art_v1)。公開の印が真になったら、切り替えに関係なく出る
const BATTLE_CARD_ART_DEBUG = (() => {
  const KEY = 'mh_debug_battle_card_art_v1';
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { on = false; }
  return {
    get on() { return on; },
    set(next) { on = !!next; try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {} return on; },
  };
})();
// 行動カードの見た目の選択(2026-10-16 社長「前のカードも選べる」)。設定 → バトル設定で「新しいカードの絵」(既定)と「前のカード」を選ぶ。
//   保存は新しいキー mh_battle_card_look_v1('art' / 'classic')だけ。無い・壊れているときは既定の 'art'。前のカードを選んだ人には、公開の印やデバッグの切り替えより優先して前のカードを出す
const BATTLE_CARD_LOOKS = Object.freeze([
  { id: 'art', label: '新しいカードの絵', note: '種類で色分けした枠' },
  { id: 'classic', label: '前のカード', note: '字が大きいシンプルな形' },
]);
const normalizeBattleCardLook = (v) => (v === 'classic' ? 'classic' : 'art');
const BATTLE_CARD_LOOK = (() => {
  const KEY = 'mh_battle_card_look_v1';
  let look = 'art';
  try { look = normalizeBattleCardLook(localStorage.getItem(KEY)); } catch (e) { look = 'art'; }
  return {
    get value() { return look; },
    set(next) { look = normalizeBattleCardLook(next); try { localStorage.setItem(KEY, look); } catch (e) {} return look; },
  };
})();
const battleCardArtOn = () => BATTLE_CARD_LOOK.value !== 'classic' && ((typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.battleCardArt === true) || BATTLE_CARD_ART_DEBUG.on);
// ★カード名の折り返し(2026-10-15 社長「言葉の切れ目で折って」「長い名前だけ3行を許す」)。
//   字は全部同じ大きさで、1行に入る名前(BATTLE_CARD_NAME_PER_LINE=6字ぶんまで)は1行、入らない名前は2行、2行に入らない名前だけ3行。
//   折ってよい所 … 字の種類が変わる所(カタカナ・ひらがな・漢字・英数)・単語の切れ目(Intl.Segmenter があれば)・下の上書き表の「|」。
//   小さい字・長音・句読点の前では折らない。「言葉の途中で折る数」がいちばん少なく、次に行数が少なく、次に長い行がいちばん短い折り方。
//   上書き表で「|」の無い名前は、その中では折らない。返り値は行の配列
const BATTLE_CARD_NAME_PER_LINE = 6;
const battleCardNameClass = (ch) => (/[\u30a0-\u30ff\u31f0-\u31ff\uff66-\uff9f]/.test(ch) ? 'kata'
  : /[\u3040-\u309f]/.test(ch) ? 'hira' : /[\u4e00-\u9fff\u3005\u3006]/.test(ch) ? 'kan' : /[0-9A-Za-z\uff10-\uff5a]/.test(ch) ? 'alnum' : 'other');
const BATTLE_CARD_NO_BREAK_BEFORE = /^[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶーｰ・、。！？!?…ゝゞヽヾ）」』】]/;
// 機械では言葉の切れ目が分からない名前(カタカナの複合語・ひらがなの続く語)だけ、折る位置を「|」で決めておく。
//   「|」の無い名前は1行。手札に出る名前を全部ためして決めた(tools/battle/card-art-check.js が全部の折り方を見る)
const BATTLE_CARD_NAME_BREAKS = Object.freeze({
  'ルミナスレイ': 'ルミナス|レイ', 'ナイトサンダー': 'ナイト|サンダー', 'エクリプスキッス': 'エクリプス|キッス', 'コンビネーション': 'コンビ|ネーション',
  'ドリルコンビネーション': 'ドリル|コンビ|ネーション', '大たおれこみ': '大|たおれこみ', '超たおれこみ': '超|たおれこみ',
  'アイスブレード': 'アイス|ブレード', 'アクアウェイブ': 'アクア|ウェイブ', 'スプラッシュ': 'スプラッシュ', 'ジングルベル': 'ジングル|ベル',
  'アクアゲイザー': 'アクア|ゲイザー', 'ぞうさんぴろぴろ鼻': 'ぞうさん|ぴろぴろ鼻', 'ハトのおとしもの': 'ハトの|おとしもの', '大きなおとしもの': '大きな|おとしもの',
  'グリンネーション': 'グリン|ネーション', '超モッチ砲2': '超モッチ砲2', '超モッチ砲3': '超モッチ砲3', '超モッチ砲ゴッド': '超モッチ砲|ゴッド',
  '超モッチ砲ブルー': '超モッチ砲|ブルー', '超炎モッチ砲ゴッド': '超炎モッチ砲|ゴッド', 'サイコキネシス': 'サイコ|キネシス', 'クロノキネシス': 'クロノ|キネシス',
  'かがやきいき': 'かがやきいき', 'マジワンツー': 'マジ|ワンツー', 'ギガサンダー': 'ギガ|サンダー', 'ギガライトニング': 'ギガ|ライトニング',
  'コズミッグバン': 'コズミッグ|バン', 'コズミックライブ': 'コズミック|ライブ', 'セイクリッドレイ': 'セイクリッド|レイ', 'アビスサンダー': 'アビス|サンダー',
  'ダークライトニング': 'ダーク|ライトニング', 'カオスコズミック': 'カオス|コズミック', 'エクリプスノヴァ': 'エクリプス|ノヴァ', 'ライトニング': 'ライトニング',
  '種マシンガン': '種|マシンガン', 'クリスマスツリー': 'クリスマス|ツリー', 'メテオドライブ': 'メテオ|ドライブ', 'ライジングレイヴ': 'ライジング|レイヴ',
  'ダークホウスト': 'ダーク|ホウスト', 'アサルトライジング': 'アサルト|ライジング', '絶影桜華乱舞': '絶影|桜華乱舞', '絶華緋閃・零桜': '絶華緋閃・|零桜',
  'スターバースト・ストリーム': 'スター|バースト・|ストリーム', 'アイスコフィン': 'アイス|コフィン', 'アクアブラスト': 'アクア|ブラスト',
  'メリークリスマス': 'メリー|クリスマス', 'オーシャンノヴァ': 'オーシャン|ノヴァ', 'メニーウィング': 'メニー|ウィング', 'メテオストーム': 'メテオ|ストーム',
  'エターナルアーク': 'エターナル|アーク', 'リボンウィング': 'リボン|ウィング', 'ナイトメアアーク': 'ナイトメア|アーク', 'ドラの毒膝地獄': 'ドラの|毒膝地獄',
  'かどみうむの計算': 'かどみうむの|計算', 'かどみうむの理論': 'かどみうむの|理論', 'かどみうむの叡智': 'かどみうむの|叡智',
  'みゃるの怪薬': 'みゃるの|怪薬', 'みゃるの禁薬': 'みゃるの|禁薬', "KUROMI'S5アタック": "KUROMI'S|5アタック",
  '白き誓い切なる願い': '白き誓い|切なる願い', '神光よ汚れを祓え': '神光よ|汚れを祓え', '祈れ輪廻の環よ': '祈れ|輪廻の環よ', '裁きの光よ下れ': '裁きの光よ|下れ',
  '今こそ真なる目醒め': '今こそ|真なる目醒め',
  // 機械では切れ目が分からないカタカナの複合語(2026-10-15 字を大きくして1行6字ぶんにしたとき、言葉の途中で折れた名前)
  'ピアノパラソル脳天撃': 'ピアノ|パラソル|脳天撃', 'メロディキャンディボム': 'メロディ|キャンディ|ボム', 'ナイトメアらっきょうボム': 'ナイトメア|らっきょう|ボム',
  'ディープキッス': 'ディープ|キッス', 'サンダービート': 'サンダー|ビート', 'アサルトダンス': 'アサルト|ダンス', 'ガッチョスラント': 'ガッチョ|スラント',
  'アクアウィップ': 'アクア|ウィップ', 'キャンディボム': 'キャンディ|ボム', 'シャドウレギオン': 'シャドウ|レギオン', 'デンプシーロール': 'デンプシー|ロール',
  'フォームガンマ': 'フォーム|ガンマ', 'リバースレイド': 'リバース|レイド', 'ソニックレイヴ': 'ソニック|レイヴ', 'アサルトレイド': 'アサルト|レイド',
  'アクシズバレット': 'アクシズ|バレット', 'ブラッディクロス': 'ブラッディ|クロス', 'ワンダーブレイズ': 'ワンダー|ブレイズ', 'パピヨンバースト': 'パピヨン|バースト',
  'パウンドメテオ': 'パウンド|メテオ', 'ホリゾンタル・スクエア': 'ホリゾンタル・|スクエア', 'グランドイリュージョン': 'グランド|イリュージョン',
  'ムーンサルトメロディー': 'ムーンサルト|メロディー', 'ライジングブースト': 'ライジング|ブースト', 'スウィートパレード': 'スウィート|パレード', 'マリーランドアーチ': 'マリーランド|アーチ',
  // イルミネ・ドリーミィ(2026-10-22・案の段階の技名)
  'ヴェノムエッジ': 'ヴェノム|エッジ', 'シールドバッシュ': 'シールド|バッシュ', 'モーニングスター': 'モーニング|スター', 'アサシンクロウ': 'アサシン|クロウ', 'アサルトアロー': 'アサルト|アロー', 'ブレードダンス': 'ブレード|ダンス', 'バスターソード': 'バスター|ソード', 'ドールバッシュ': 'ドール|バッシュ', 'キャットクロウ': 'キャット|クロウ', 'ドリームダンス': 'ドリーム|ダンス', 'パステルソード': 'パステル|ソード', 'エーテルアイス': 'エーテル|アイス', 'アルカナフレア': 'アルカナ|フレア', 'アルスマグナ': 'アルス|マグナ', 'ミラージュクロウ': 'ミラージュ|クロウ', 'クリムゾンノヴァ': 'クリムゾン|ノヴァ', 'ムーンライトヴェール': 'ムーンライト|ヴェール', 'ルミナスオーロラ': 'ルミナス|オーロラ', 'レクイエムエンド': 'レクイエム|エンド', 'ララバイノクターン': 'ララバイ|ノクターン', 'スウィートドリーム': 'スウィート|ドリーム', 'ドリーミィパレード': 'ドリーミィ|パレード', 'おもちゃの爆弾': 'おもちゃの|爆弾',
  '巨大雪だるま転がし': '巨大雪だるま|転がし', '熾天の剣よ降り立て': '熾天の剣よ|降り立て', '天の慈悲を示されよ': '天の慈悲を|示されよ', '聖夜の鐘を鳴響け': '聖夜の鐘を|鳴響け', '終焉に救いを与えよ': '終焉に|救いを与えよ', '永劫の贖いを全うせよ': '永劫の贖いを|全うせよ',
});
const battleCardNameBreakCache = new Map();
const battleCardNameLines = (name) => {
  const text = String(name || '');
  if (battleCardNameBreakCache.has(text)) return battleCardNameBreakCache.get(text);
  const chars = [...text], n = chars.length, per = BATTLE_CARD_NAME_PER_LINE;
  // 表にその名前そのものがあり、1行に入らない名前は、表の折り方をそのまま使う(1行に入る名前は1行)
  if (battleCardNameUnits(text) > per && Object.prototype.hasOwnProperty.call(BATTLE_CARD_NAME_BREAKS, text)) { const fixed = BATTLE_CARD_NAME_BREAKS[text].split('|'); battleCardNameBreakCache.set(text, fixed); return fixed; }
  const good = new Set();
  for (let k = 1; k < n; k += 1) {
    const a = battleCardNameClass(chars[k - 1]), b = battleCardNameClass(chars[k]);
    // 長音「ー」はカタカナとして続ける(カタカナ→ーは切れ目にしない)
    if (a !== b && !(chars[k] === 'ー' || chars[k - 1] === 'ー')) good.add(k);
  }
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      let at = 0;
      for (const seg of new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)) { at += [...seg.segment].length; if (at > 0 && at < n) good.add(at); }
    }
  } catch (e) { /* 使えない端末は字の種類だけで決める */ }
  // 上書き表: 名前の中に表の名前があれば、その「|」を切れ目にし、「|」の無い名前の内側は切れ目にしない
  for (const [word, broken] of Object.entries(BATTLE_CARD_NAME_BREAKS)) {
    const at = text.indexOf(word);
    if (at < 0) continue;
    const start = [...text.slice(0, at)].length, len = [...word].length;
    for (let q = start + 1; q < start + len; q += 1) good.delete(q);
    let p = start;
    for (const part of broken.split('|').slice(0, -1)) { p += [...part].length; good.add(p); }
  }
  const allowed = [];
  for (let k = 1; k < n; k += 1) if (!BATTLE_CARD_NO_BREAK_BEFORE.test(chars[k])) allowed.push(k);
  // 言葉の途中で折る数 → 行数 → 長い行 の順に小さい折り方を、3行までで探す(2行に入らない名前だけ、言葉の切れ目で3行にする)。どれも入らなければ、行数を気にせず長い行がいちばん短い折り方
  let best = null, loose = null;
  const better = (x, y) => !y || x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2])));
  const walk = (i, lines, mid) => {
    if (lines.length > 3) return;
    if (i === n) {
      const longest = Math.max(...lines.map(battleCardNameUnits));
      const key = [mid, lines.length, longest];
      if (longest <= per + 1e-9) { if (better(key, best && best.key)) best = { key, lines: [...lines] }; }
      else { const lk = [longest, mid, lines.length]; if (better(lk, loose && loose.key)) loose = { key: lk, lines: [...lines] }; }
      return;
    }
    for (const j of [...allowed.filter((k) => k > i), n]) {
      lines.push(chars.slice(i, j).join(''));
      walk(j, lines, mid + (j < n && !good.has(j) ? 1 : 0));
      lines.pop();
    }
  };
  walk(0, [], 0);
  // 言葉の切れ目だけで入らない名前(言葉を割れない数件)は、言葉の途中では折らず、言葉の切れ目だけで折って字をその名前だけ小さくする(battleCardNameFit)
  if (best && best.key[0] > 0) best = null;
  if (!best) { loose = null; const walkGood = (i, lines) => { if (lines.length > 3) return; if (i === n) { const longest = Math.max(...lines.map(battleCardNameUnits)); const lk = [longest, lines.length, 0]; if (better(lk, loose && loose.key)) loose = { key: lk, lines: [...lines] }; return; } for (const j of [...[...good].filter((k) => k > i && !BATTLE_CARD_NO_BREAK_BEFORE.test(chars[k])).sort((a, b) => a - b), n]) { lines.push(chars.slice(i, j).join('')); walkGood(j, lines); lines.pop(); } }; walkGood(0, []); }
  const out = best ? best.lines : (loose ? loose.lines : [text]);
  battleCardNameBreakCache.set(text, out);
  return out;
};
// 名前の字の大きさ(2026-10-15 社長「長い名前だけ3行を許す」→ 前の手札に近い大きさで全部そろえる)。
//   名前は「文字の置き場」(名前の欄の内側。CSS の padding で中の面の宝石より内側に決める)の中にだけ置く。
//   大きさは、1行6字ぶん(BATTLE_CARD_NAME_PER_LINE)が赤青緑紫の枠の置き場(カード幅の66%)にちょうど収まる大きさで、カードの幅に合わせて変わる
//   (手札が約72px幅なら約7.7px。手札では見た目を約1.1倍に拡大しているので約8.6px)。金の枠は置き場が広い(74%)ので --mh-name-ratio で同じ大きさにそろえる。
//   6字ぶんを超える行(言葉を割れない数件)だけ、その名前を小さくする。名前の欄は大きさの基準(container-type:size)なので cqw は置き場の幅。
//   高さが足りない欄(横持ちの3行など)では高さに合わせて縮む(下の飾り線の場所 --mh-rule-h は高さから先に引く)。英数は 0.62 字に数える
const BATTLE_CARD_NAME_LH = 1.1;
const battleCardNameUnits = (line) => [...String(line || '')].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.62 : 1), 0);
const battleCardNameFit = (name) => {
  const lines = battleCardNameLines(name);
  const longest = Math.max(BATTLE_CARD_NAME_PER_LINE, ...lines.map(battleCardNameUnits));
  const tall = (lines.length * BATTLE_CARD_NAME_LH).toFixed(2);
  return { fontSize: `max(5px, min(calc((100cqw * var(--mh-name-ratio, 1) - 1.5px) / ${longest.toFixed(2)}), calc((100cqh - var(--mh-rule-h, 6px)) / ${tall})))`, lineHeight: String(BATTLE_CARD_NAME_LH), whiteSpace: 'nowrap' };
};
const BATTLE_CARD_ROMAN = Object.freeze(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']);
// カード1枚の絵。{ frame, mark(技のマークの絵・無ければ null で今のアイコン), roman(段階の札・無ければ '') }
//   攻撃=赤・距離撃=青・守り=緑・支援=紫・固有技=金(社長の決定)。弱いガードは緑(守りの1段目のマーク・段階の札なし)・それ以外は紫
//   shape … 枠の丸の位置の型。'std'(4色)・'gold'(固有技の金。大きい丸が大きく少し下)
//   段階は表の何番目かで決める(攻撃は BASE_ATK_EVOLUTION の icon、守りは GUARD_EVOLUTION の name、距離撃は RANGE_EVOLUTION の名前)
// 名札・名前の飾り線の色は枠と同じ(赤・青・緑・紫・金)。枠の絵から引く
const battleCardArtOf = (c) => {
  const base = battleCardArtBaseOf(c);
  if (!base) return null;
  const F = BATTLE_CARD_ART.frames, P = BATTLE_CARD_ART.plates || {}, R = BATTLE_CARD_ART.rules || {};
  const color = Object.keys(F).find((k) => F[k] === base.frame) || 'purple';
  return { ...base, color, plate: P[color] || null, rule: R[color] || null };
};
const battleCardArtBaseOf = (c) => {
  if (!c || typeof BATTLE_CARD_ART === 'undefined') return null;
  const F = BATTLE_CARD_ART.frames;
  const lvlOf = (i) => (Number.isInteger(i) && i >= 0 ? i : null);
  if (c.type === 'atk') {
    const i = lvlOf(BASE_ATK_EVOLUTION.findIndex((e) => e.icon === c.icon));
    return { frame: F.red, mark: i == null ? null : BATTLE_CARD_ART.atk[i], roman: i == null ? '' : BATTLE_CARD_ROMAN[i], shape: 'std' };
  }
  if (c.type === 'range_atk') {
    const r = Number.isInteger(c.rangeIdx) ? c.rangeIdx : null;
    const i = lvlOf(RANGE_EVOLUTION.findIndex((e) => typeof c.name === 'string' && r != null && c.name === `${RANGE_LABELS[r]}${e.name}`));
    return { frame: F.blue, mark: r == null ? null : (BATTLE_CARD_ART.range[r] || null), roman: i == null ? '' : BATTLE_CARD_ROMAN[i], shape: 'std' };
  }
  if (c.type === 'guard') {
    const i = lvlOf(GUARD_EVOLUTION.findIndex((e) => e.name === c.name || e.icon === c.icon));
    return { frame: F.green, mark: i == null ? null : BATTLE_CARD_ART.guard[i], roman: i == null ? '' : BATTLE_CARD_ROMAN[i], shape: 'std' };
  }
  if (c.type === 'weak_guard') return { frame: F.green, mark: BATTLE_CARD_ART.guard[0], roman: '', shape: 'std' };
  // 固有技は金の枠(2026-10-15 社長の決定)。丸の位置と大きさがほかと違うので shape:'gold'(真ん中はその子の顔か固有技の絵=今のアイコン)
  if (c.type === 'unique') return { frame: F.gold || F.red, mark: null, roman: '', shape: F.gold ? 'gold' : 'std' };
  return { frame: F.purple, mark: null, roman: '', shape: 'std' };
};
// バトルが始まる前に、枠とマークを読み込んでおく(初めて出た瞬間のカクつきを防ぐ・社長の決めごと)。1回の起動で1回だけ
let battleCardArtPreloaded = false;
const preloadBattleCardArt = () => {
  if (battleCardArtPreloaded || typeof BATTLE_CARD_ART === 'undefined' || typeof Image === 'undefined') return;
  battleCardArtPreloaded = true;
  [...Object.values(BATTLE_CARD_ART.frames), ...BATTLE_CARD_ART.atk, ...BATTLE_CARD_ART.guard, ...BATTLE_CARD_ART.range, ...Object.values(BATTLE_CARD_ART.plates || {}), ...Object.values(BATTLE_CARD_ART.rules || {})]
    .forEach((src) => { try { const im = new Image(); im.decoding = 'async'; im.src = src; } catch (e) {} });
};
const HAND_CARD_FIT = Object.freeze({
  iconTop: 'clamp(2px, 0.7dvh, 6px)',
  icon: 'clamp(24px, 4.2dvh, 36px)',
  name: 'clamp(20px, 3.4dvh, 30px)',
  band: 'clamp(13px, 1.9dvh, 16px)',
  gutsPad: 'clamp(2px, 0.45dvh, 4px)',
  // 新しい盤面の「⇄技変更」(ガッツの段を宝石へ移したぶん、ボタンだけで押しやすい高さにする)
  // 技変更の文字(上)と種類の札(下)を1つの段に入れる
  skill: 'clamp(26px, 3.6dvh, 30px)',
  // 新しい盤面の技名の欄。種類の札が下の段へ移ったぶん広い
  nameRich: 'clamp(28px, 4.6dvh, 40px)',
});
// 枠に出す効果の光の種類(2026-09-24 ユーザー指示「支援系のアクションももう少しそれっぽく」)。
// その子の枠に出た吹き出しの文字から決める。効果ごとに addPopup が40か所以上あるので、1つずつ種類を
// 渡すより、ここで言葉から見分けるほうが漏れない。半減のお知らせなど、光らせないものは null
const tacticsAuraKindOf = (text = '', side = '') => {
  const t = String(text);
  if (/半減|AUTO停止|片手持ち：/.test(t)) return null;
  if (side === 'life' || /💚|回復|ドレイン|吸収|起き上がった/.test(t)) return 'heal';
  if (side === 'guts' || /⚡|ガッツ|消費0|消費半減|消費ガッツ/.test(t)) return 'guts';
  if (/防御|ガード|被ダメ|丈夫さ|軽減|反射|かばう/.test(t)) return 'shield';
  if (/攻撃|闘志|会心|連撃|連斬|ソードスキル|緋桜|威力/.test(t)) return 'power';
  return 'buff';
};
// 何も起きていない間、画面の動きを休ませるまでの時間(ミリ秒)。BattleScreen の data-fx-rest を参照
const TACTICS_FX_REST_MS = 5000;
// ==== バトルの重さの見張り(2026-09-28 ユーザー指示「モンビーみたいに重さチェックやその他点検ツールを取り入れて
// 軽くて見た目が良く出来る仕組みを作って」) ====
// モンヒロビートの「重いときは演出を自動で控えめに」(30-rhythm-play)と同じ数え方。rAF の間隔から
// 「描くのが間に合わなかったコマ」(いちばん短い間隔の1.8倍を超え、しかも20msを超えたもの・または50ms以上)を数え、
// 3秒のうち8%を超えたら画面の軽さを一段下げる。1秒以上あいた間(裏に回った・止まっていた)は数えない。
// ★下げるのは「軽め」まで。最軽量は並びごと変わるので、自分で選んだ人だけ。
// ★見張るのはタクティクス新画面で、一時停止していない間だけ。休んでいる間は rAF も回さない(スマホを休ませる)
const BATTLE_AUTO_LOAD_WINDOW_MS = 3000;
const BATTLE_AUTO_LOAD_MIN_FRAMES = 5;
const BATTLE_AUTO_LOAD_SLOW_RATIO = 0.08;
const BATTLE_AUTO_LOAD_FLOOR = 'LIGHT';
// 見張りを始めた直後(バトルの立ち上がり・軽さを下げた直後の描き直し)は、一瞬詰まるのがふつうなので数えない
const BATTLE_AUTO_LOAD_WARMUP_MS = 2000;
// 1コマが「遅い」か。rhythm と同じ線(一様に遅い端末は1.8倍では拾えないので、50ms 以上は常に遅い)
const battleSlowFrame = (gap, minGap) => (gap > Math.max(5, minGap) * 1.8 && gap > 20) || gap >= 50;
// 性能計測(デバッグ限定・既定OFF)。ONの記憶は専用キー mh_battle_perf_v1。
// **OFFのあいだは加算も配列追加も一切しない**(計測のために重くしない)。戦闘の計算・進行には一切関与しない。
// プレイヤーの通常プレイには出ないので、更新履歴・ヘルプには載せない
const BATTLE_PERF_KEY = 'mh_battle_perf_v1';
const BATTLE_PERF = (() => {
  const zero = () => ({ frames: 0, totalMs: 0, maxMs: 0, slow: 0, over50: 0, over100: 0, minGap: 1e9, longTasks: 0, longTaskMs: 0, autoSteps: [], since: 0 });
  let on = false, last = null, acc = zero(), observer = null;
  const watchLongTasks = () => {
    if (observer || typeof PerformanceObserver === 'undefined') return;
    try {
      observer = new PerformanceObserver((list) => { if (!on) return; for (const e of list.getEntries()) { acc.longTasks++; acc.longTaskMs += e.duration; } });
      observer.observe({ type: 'longtask', buffered: false });
    } catch { observer = null; }
  };
  const api = {
    get enabled() { return on; },
    setEnabled(next) {
      on = !!next; last = null; acc = zero();
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(BATTLE_PERF_KEY, on ? '1' : '0'); } catch {}
      if (on) watchLongTasks(); else if (observer) { try { observer.disconnect(); } catch {} observer = null; }
      return on;
    },
    restore() { try { if (typeof localStorage !== 'undefined') on = localStorage.getItem(BATTLE_PERF_KEY) === '1'; } catch {} if (on) watchLongTasks(); return on; },
    reset() { last = null; acc = zero(); },
    // 見張りの rAF から毎コマ1回だけ呼ぶ(計測用の rAF は増やさない)
    frame(nowMs) {
      if (!on) return;
      const t = Number(nowMs);
      if (!Number.isFinite(t)) return;
      if (!acc.since) acc.since = t;
      if (last !== null) {
        const dt = t - last;
        if (dt > 0 && dt < 1000) {
          acc.frames++; acc.totalMs += dt; if (dt > acc.maxMs) acc.maxMs = dt;
          if (dt >= 5 && dt < acc.minGap) acc.minGap = dt;
          if (battleSlowFrame(dt, acc.minGap)) acc.slow++;
          if (dt >= 50) acc.over50++;
          if (dt >= 100) acc.over100++;
        }
      }
      last = t;
    },
    // 見張りをやめた(休止・画面を離れた)ときは、次のコマとの間を数えない
    pause() { last = null; },
    // 自動で軽さを下げた記録(いつ・何から何へ・そのときの遅いコマの割合)
    autoStep(from, to, slow, frames) {
      if (!on) return;
      if (acc.autoSteps.length < 20) acc.autoSteps.push({ at: Math.round(typeof performance !== 'undefined' ? performance.now() : 0), from, to, slow, frames });
    },
    // いまの記録の要約(パネル表示・検査用)。infinite … ずっと動き続けているアニメーションの数
    snapshot() {
      if (!on) return null;
      let infinite = null;
      try { if (typeof document !== 'undefined' && document.getAnimations) infinite = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity).length; } catch {}
      const avg = acc.frames ? acc.totalMs / acc.frames : 0;
      return { frames: acc.frames, fps: avg ? Math.round(1000 / avg) : 0, avgMs: Math.round(avg * 10) / 10, maxMs: Math.round(acc.maxMs),
        slowPct: acc.frames ? Math.round(acc.slow / acc.frames * 1000) / 10 : 0, over50: acc.over50, over100: acc.over100,
        longTasks: acc.longTasks, longTaskMs: Math.round(acc.longTaskMs), infinite, autoSteps: acc.autoSteps.slice() };
    },
  };
  api.restore();
  return api;
})();
// タクティクスの敵ごとの動き方(新しい画面だけ)。値は 70-bootstrap の data-enemy-motion の CSS 名
// (2026-09-24 ユーザー指示「次はタクティクスの全モンスターも実装して」で10体すべてに広げた)
const TACTICS_ENEMY_MOTIONS = Object.freeze({
  Kawazumo: 'kawazumo',
  Pumpkin: 'pumpkin',   // 大王を倒したあとのレイドバトルの敵「ぱんぷきん」(enemy.raidJackPumpkin のときだけ。id は Jack のまま)
  Metalner: 'metalner',
  Inari: 'inari',
  Koinobori: 'koinobori',
  Delpiero: 'delpiero',
  Dokudoku: 'dokudoku',
  Lamia: 'lamia',
  Nyarlathotep: 'nyarlathotep',
  Splatter: 'splatter',
  AwakenedMoo: 'awakenedMoo',
  // イベント・レイドボス「ジャック」(ドクドクと同じネンドロ種。ぴょこぴょこ跳ねる)
  Jack: 'jack',
});
// 技ごとの動きの長さ(ミリ秒)。ここに無い技は今までどおり(通常攻撃 450 / 必殺技 1100)。
// 戦闘の待ち時間(60-app)もこの値を使うので、CSS の --em-dur / animation の長さと必ずそろえる。
// ★ムー(覚醒ムー)は攻撃の待ちが 900 で決まっているので、ここは通らない(CSS も 900 にしてある)
// ★必殺技は画面を暗くして大きく見せるぶん長い(2026-09-24 ユーザー指示「必殺技だけ特別扱い」)
const TACTICS_ENEMY_SKILL_MS_DEFAULT = Object.freeze({ rush: 750, pierce: 900, allout: 1000, special: 1500 });
// 覚醒ムーは技ごとに全画面の演出を見せる(2026-09-24 ユーザー指示「ムーはかなり派手な演出が必要」)
const TACTICS_MOO_SKILL_MS = Object.freeze({ normal: 1300, sweep: 1300, rush: 1500, pierce: 1500, special: 2200, allout: 2000 });
const tacticsEnemyMotionMs = (enemyId, skill, fallbackMs) => {
  const motion = enemyId ? TACTICS_ENEMY_MOTIONS[enemyId] : null;
  const ms = !motion ? null : motion === 'awakenedMoo' ? TACTICS_MOO_SKILL_MS[skill] : TACTICS_ENEMY_SKILL_MS_DEFAULT[skill];
  return Number.isFinite(ms) ? ms : fallbackMs;
};
// 体の動きのうち「当たる瞬間」が全体の何割のところにあるか(攻撃が味方に届く時刻・ムーの揺れの時刻)
const TACTICS_ENEMY_BODY_HIT = Object.freeze({
  jab: .5, lunge: .55, dash: .58, flurry: .7, spin: .8, windup: .68, swing: .58, leap: .7, press: .7, rise: .74, sway: .55,
});
const tacticsEnemyHitFrac = (enemyId, skill) => {
  const motion = enemyId ? TACTICS_ENEMY_MOTIONS[enemyId] : null;
  if (motion === 'kawazumo') return ({ normal: .52, sweep: .58, rush: .7, pierce: .68, special: .74, allout: .58 })[skill] || .6;
  const spec = motion && TACTICS_ENEMY_MOTION_SETS[motion] ? TACTICS_ENEMY_MOTION_SETS[motion].skills[skill] : null;
  return (spec && TACTICS_ENEMY_BODY_HIT[spec[0]]) || .6;
};
// カワズモー以外の敵の動きは、共通の部品(70-bootstrap の em◯◯)を敵ごとに組み合わせて作る。
//   idle … 待っているあいだの動き(data-em-idle)
//   skills[技] = [体の動き(data-em-body), 飾りの形(data-em-fx), 飛ばす絵文字, 絵文字の出し方(data-em-emo)]
//     体の動き: jab 突き / lunge 体当たり / dash 横へ踏み込む / flurry 連打 / spin 回転 / windup 溜めて突く /
//               swing 武器を振る / leap 跳んで落ちる / press のしかかる / rise 力を解き放つ / roar 吠える /
//               power 力をためる / stance 構える / heal 回復 / sway 揺れる
//     飾りの形: arc 弧 / slash 十字の斬り跡 / beam 光の柱 / widebeam 太い光線 / burst 光の放射 / ring 衝撃の輪 /
//               aura 立ちのぼる光 / sparkle 光の粒 / lock 狙いを定める輪(貫通技の構え)
//     絵文字の出し方: rise 浮かぶ / shoot こちらへ飛ぶ / rain 降る
// 色は 70-bootstrap の [data-enemy-motion="◯◯"] { --em-c } が持つ。技名は TACTICS_ENEMY_DATA(ユーザーが決めた名前)に合わせた
const TACTICS_ENEMY_MOTION_SETS = Object.freeze({
  // メタルナー(拳法ロボ): 浮いて揺れる。掌打・ビーム
  metalner: { idle:'hover', skills:{
    normal:['jab','burst'], sweep:['dash','arc'], rush:['flurry','burst'], pierce:['windup','beam'],
    special:['leap','ring','💥','shoot'], allout:['rise','widebeam'], roar:['roar','aura','☯️','rise'],
    regen:['heal','sparkle','🔧','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // イナリ(子ぎつね): ぴょこぴょこ跳ねる。肉球・歌・花
  inari: { idle:'hop', skills:{
    normal:['lunge','burst','🐾','shoot'], sweep:['dash','arc','🐾','shoot'], rush:['flurry',null,'🐾','shoot'], pierce:['windup','beam'],
    special:['spin','burst','💨','shoot'], allout:['spin','sparkle','🌺','rain'], roar:['sway','aura','🎤','rise'],
    regen:['heal','sparkle','💗','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // コイノボリ(鯉のぼり): 泳ぐように揺れる。体当たり・しっぽ・波
  koinobori: { idle:'swim', skills:{
    normal:['lunge','ring'], sweep:['dash','arc'], rush:['swing','arc'], pierce:['press','ring'],
    special:['leap','ring','🌊','shoot'], allout:['rise','aura','🌊','rain'], roar:['roar','burst'],
    regen:['sway','sparkle','💤','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // デルピエロ(鎌の騎士): 足踏みして構える。槍・十字の斬撃
  delpiero: { idle:'prance', skills:{
    normal:['swing','arc'], sweep:['dash','burst'], rush:['flurry','beam'], pierce:['windup','beam'],
    special:['swing','slash'], allout:['rise','burst'], roar:['roar','aura','⚡','rise'],
    regen:['heal','sparkle'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // ドクドク(ハートの手): どくんと脈打つ。張り手・投げキッス・ハート
  dokudoku: { idle:'pulse', skills:{
    normal:['jab','burst'], sweep:['sway',null,'💋','shoot'], rush:['flurry','burst'], pierce:['windup','arc'],
    special:['rise','aura','💀','rain'], allout:['press','ring','💧','rain'], roar:['roar','aura'],
    regen:['heal','sparkle','💗','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // ラミア(阿修羅): くねるように揺れる。拳・炎・雷
  lamia: { idle:'serpent', skills:{
    normal:['jab','burst'], sweep:['dash','arc'], rush:['flurry','slash'], pierce:['windup','beam'],
    special:['leap','ring','⚡','rain'], allout:['rise','aura','🔥','rain'], roar:['roar','aura'],
    regen:['heal','ring'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // ニャルラトホテプ(邪神): うごめく。魔眼・ダイス・真空の弾
  nyarlathotep: { idle:'writhe', skills:{
    normal:['jab','burst'], sweep:['sway','beam','👁️','shoot'], rush:['spin','slash'], pierce:['windup','beam'],
    special:['rise','aura','👁️','rise'], allout:['rise','ring','🌀','shoot'], roar:['roar','aura','🎲','rise'],
    regen:['heal','sparkle'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // スプラッター(斧の処刑人): 重く息をする。斧・影・血
  splatter: { idle:'menace', skills:{
    normal:['jab','burst'], sweep:['dash','arc'], rush:['spin','slash'], pierce:['windup','beam'],
    special:['swing','slash'], allout:['rise','aura','💀','rain'], roar:['roar','aura'],
    regen:['heal','sparkle','🩸','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // ジャック(カボチャの大王・イベントのレイドボス): ぴょこぴょこ跳ねる。技ごとの動きと飾り(docs/spec/RAID_BOSS_JACK.md)
  //   カボチャ張り手 … 腕を振り下ろす(両腕ポーズの絵に切り替わる) / めいどのトリート … 跳んで落ち、お菓子とカボチャが降る
  //   おばけキッス … 顔が前へ寄り、おばけが飛ぶ / ジャックラッシュ … 連打 / かぼちゃ延髄斬り … 回って斬り落とす
  //   ハロウィンナイト … 両腕を上げて夜の光を立ちのぼらせる(両腕ポーズ) / おばけパレード … 横へ駆け抜けるおばけの行列
  jack: { idle:'hop', skills:{
    normal:['swing','arc','🎃','shoot'], sweep:['lunge',null,'👻','shoot'], rush:['flurry','burst','🎃','shoot'], pierce:['spin','slash'],
    special:['leap','ring','🍬','rain'], allout:['dash','widebeam','👻','shoot'], roar:['rise','aura','🌙','rise'],
    regen:['heal','sparkle'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // ぱんぷきん(大王を倒したあとの小さなジャック・腕のない丸い絵): 技の名前はジャックのまま、動きだけ絵に合わせる。
  //   カボチャ張り手 … 腕が無いので、体ごと体当たりする(腕を振る動きと、ポーズ絵への切り替えはしない)
  //   そのほかは、跳ねる・回る・転がる・顔を寄せるなど、腕が無くてもできる動き
  pumpkin: { idle:'hop', skills:{
    normal:['lunge','burst','🎃','shoot'], sweep:['lunge',null,'👻','shoot'], rush:['flurry','burst','🎃','shoot'], pierce:['spin','slash'],
    special:['leap','ring','🍬','rain'], allout:['dash','widebeam','👻','shoot'], roar:['rise','aura','🌙','rise'],
    regen:['heal','sparkle'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
  // 覚醒ムー(竜): 待機は今までの浮遊のまま。技ごとの動きだけ付ける
  awakenedMoo: { idle:null, skills:{
    normal:['swing','slash'], sweep:['dash','arc'], rush:['flurry','burst'], pierce:['windup','beam'],
    special:['rise','burst','☄️','rain'], allout:['rise','aura','🌪️','rain'], roar:['roar','aura'],
    regen:['heal','sparkle','✨','rise'], charge:['power','aura'], pierceCharge:['stance','lock'] } },
});
// 敵ごとの「当たったときの形」と、飛ばすものの形(2026-09-24 ユーザー指示「技ごとの飾りを個性的に」「攻撃が味方に届く」)。
//   impact … 味方の枠の上に出る当たりの形(70-bootstrap の [data-impact="◯◯"])
//   mark   … 当たりの形の真ん中に押す絵文字 / shot … 飛ばす絵文字(技の組み合わせに shoot があればそちらが優先)
//   trail  … 飛ばし方(orb 光の玉 / laser 細い光線)。貫通撃は beam(太い光の柱)、間合い攻撃は wave(三日月)に決まっている
const TACTICS_ENEMY_STRIKE_LOOK = Object.freeze({
  kawazumo: { impact:'stamp', mark:'✋' },
  metalner: { impact:'hex', trail:'laser' },
  inari: { impact:'paw', mark:'🐾' },
  koinobori: { impact:'splash', mark:'💦' },
  delpiero: { impact:'xslash' },
  dokudoku: { impact:'goo', mark:'💜' },
  lamia: { impact:'flame', mark:'🔥' },
  nyarlathotep: { impact:'void' },
  splatter: { impact:'claw' },
  awakenedMoo: { impact:'nova' },
  jack: { impact:'stamp', mark:'🎃' },
  pumpkin: { impact:'stamp', mark:'🎃' },
});
const TACTICS_ENEMY_NO_STRIKE_SKILLS = Object.freeze(['roar','charge','pierceCharge','regen']);
// 覚醒ムーの全画面の演出で、技の名前を大きく出す技(2026-09-24 ユーザー指示「技名のカットイン」)
const TACTICS_MOO_CUTIN_SKILLS = Object.freeze(['normal','sweep','rush','pierce','special','allout','roar','regen']);
// ひび割れ(画面が割れる)を出す技
const TACTICS_MOO_CRACK_SKILLS = Object.freeze(['rush','pierce','special','allout','roar']);
// 画面のひび割れ。中心から伸びる折れ線を、決まった形で描く(毎回同じ形でよい。乱数にすると描き直しで形が変わる)
const TACTICS_CRACK_PATHS = Object.freeze([
  'M0 0 L40 -22 L78 -18 L120 -52 L170 -60', 'M0 0 L-36 -30 L-60 -80 L-104 -96', 'M0 0 L-50 12 L-96 4 L-150 30 L-190 22',
  'M0 0 L20 44 L10 92 L42 140', 'M0 0 L56 30 L90 74 L150 88', 'M0 0 L-24 50 L-70 70 L-90 120', 'M0 0 L8 -50 L-6 -96 L14 -150',
]);
// ==================== ボスの必殺技ムービー ====================
// (2026-09-25 ユーザー指示「敵モンスター必殺技アニメーション」「透過できないなら画面切り替えてでも全然あり」
//  「時間はそこそこ長くなってもいいから下手に短くしないでおけ」「設定でオンオフもつけて」)
// 敵データの specialMovie(mp4)を、必殺技のときだけ画面を切り替えて流す。流し終えたら戦闘画面へ戻り、
// そこで味方の枠に当たる(ダメージはそのあと。呼び出し元の 60-app が待つ)。
// ★動画の要素は1つだけ作って使い回す。その敵との戦いに入った時点で読み込みを始めておき、必殺技で同じものを流す。
//   毎回作り直すとスマホではそのたびに読み込み直しになり、頭が欠けたり黒い画面が続いたりする
// ★流せなかったとき(読み込めない・自動再生を止められた・画面が無い)は false を返す。
//   呼び出し元はそのときいつもの演出へ戻るので、進行が止まることはない
// ★ここは見せるだけ。計算・進行・保存には触れない
const BOSS_MOVIE_START_TIMEOUT_MS = 2500; // これまでに再生が始まらなければあきらめる(いつもの演出へ戻る)
const BOSS_MOVIE_MAX_MS = 15000;          // 途中で止まっても、これ以上は待たない
// ムービーごとの効果音(ムービーと同時に頭から鳴らす1本の音源)と、画面を揺らす時刻(再生位置のミリ秒)。
// 音も揺れも絵に合わせてある。キーは ?v= を外したパス(キャッシュキーは中身を差し替えるたびに変わる)。
// ★ムービー自体は音なし(iPhone は音ありの動画を自動で再生させてくれない)。音は効果音として別に鳴らすので、
//   効果音の音量設定がそのまま効く(2026-09-25 ユーザー指摘「効果音がださい」「溜めるゴォー、ブレスはボォー」で作り直した)
const BOSS_MOVIE_EXTRAS = Object.freeze({
  // 覚醒ムー「アポカリプス」: 咆哮 → 口に溜める「ゴォー」→ 光線の「ボォー」(3.3秒)→ 爆発(4.42秒)→ 地鳴り → うなり
  'movies/awakened-moo-apocalypse.mp4': Object.freeze({ sound: 'audio/se-awakened-moo-apocalypse.mp3', shakes: Object.freeze([3300, 4420]) }),
});
const bossMovieExtras = (src) => BOSS_MOVIE_EXTRAS[String(src || '').split('?')[0]] || null;
const bossMovieStore = { el: null, src: '', show: null };
const preloadBossMovie = (src) => {
  if (!src || typeof document === 'undefined') return;
  if (bossMovieStore.el && bossMovieStore.src === src) return;
  const el = document.createElement('video');
  // ★音なし・画面の中で再生(playsinline)にしておかないと、iPhone は自動で再生させてくれない
  el.muted = true; el.defaultMuted = true; el.playsInline = true;
  el.setAttribute('muted', ''); el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
  el.preload = 'auto';
  el.src = src;
  try { el.load(); } catch (e) { /* 読めなければ、流すときに false が返る */ }
  bossMovieStore.el = el; bossMovieStore.src = src;
  // 効果音も先に読んでおく(鳴らすときに読み込みを待つと、絵と音がずれる)
  const extras = bossMovieExtras(src);
  if (extras && extras.sound && Audio_.preloadSE) Audio_.preloadSE(extras.sound);
};
// 流し終えたら true、流せなかったら false で終わる
const playBossMovie = (src, info = {}) => new Promise((resolve) => {
  if (!src || typeof bossMovieStore.show !== 'function') { resolve(false); return; }
  preloadBossMovie(src);
  bossMovieStore.show({ src, info, done: resolve });
});
const BossMovieLayer = ({ shake = true }) => {
  const [req, setReq] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const holderRef = useRef(null);
  const finishRef = useRef(null);
  useEffect(() => {
    // 前のムービーが残っていれば、下の後片付け(finish(false))がその待ちを起こす
    bossMovieStore.show = (next) => setReq({ ...next, key: Date.now() });
    return () => {
      bossMovieStore.show = null;
      // 画面ごと閉じられたら、待っている側を必ず起こす
      if (finishRef.current) finishRef.current(false);
    };
  }, []);
  React.useLayoutEffect(() => {
    if (!req) return undefined;
    const el = bossMovieStore.el;
    const holder = holderRef.current;
    let settled = false, started = false, raf = 0, startWall = 0;
    const timers = [];
    const extras = bossMovieExtras(req.src);
    const shakes = ((extras && extras.shakes) || []).map((at) => ({ at, fired: false }));
    let sound = null; // 鳴らしている効果音(Audio_.playSeFile が返す { stop } を待つ Promise)
    const onPlaying = () => {
      if (started) return;
      started = true; startWall = Date.now();
      if (extras && extras.sound && Audio_.playSeFile) sound = Audio_.playSeFile(extras.sound);
      timers.push(setTimeout(() => finish(true), BOSS_MOVIE_MAX_MS));
      timers.push(setTimeout(() => setCanSkip(true), 900));
      // 揺れの合図を見るためだけのループ。合図が無いムービーでは回さず、全部出し終えたら止める
      // (以前は合図が無くても・出し終えてもムービーが終わるまで毎コマ回っていた)
      const tick = () => {
        raf = 0;
        if (settled) return;
        const pos = Number.isFinite(el.currentTime) ? el.currentTime * 1000 : Date.now() - startWall;
        shakes.forEach((c) => {
          if (c.fired || pos < c.at) return;
          c.fired = true;
          if (shake) setShakeKey((k) => k + 1);
        });
        if (shakes.some((c) => !c.fired)) raf = requestAnimationFrame(tick);
      };
      if (shakes.length) raf = requestAnimationFrame(tick);
    };
    // ★最後まで流れたときは、効果音の余韻をそのまま残す。途中で閉じたとき(スキップ・読めない・画面ごと閉じた)は音も消す
    const onEnded = () => finish(true, true);
    const onError = () => finish(started);
    const finish = (ok, reachedEnd = false) => {
      if (settled) return;
      settled = true;
      finishRef.current = null;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      if (sound && !reachedEnd) sound.then((h) => { if (h) h.stop(0.2); }).catch(() => {});
      if (el) {
        el.removeEventListener('playing', onPlaying);
        el.removeEventListener('ended', onEnded);
        el.removeEventListener('error', onError);
        try { el.pause(); } catch (e) { /* 止められなくても次に頭から流す */ }
      }
      setCanSkip(false);
      // ★次のムービーがもう入っていたら消さない(自分のぶんだけ閉じる)
      setReq((cur) => (cur === req ? null : cur));
      req.done(!!ok);
    };
    finishRef.current = finish;
    if (!el || !holder) { finish(false); return undefined; }
    holder.appendChild(el);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    try { el.currentTime = 0; } catch (e) { /* 読み込み前は頭から始まる */ }
    timers.push(setTimeout(() => { if (!started) finish(false); }, BOSS_MOVIE_START_TIMEOUT_MS));
    let playing;
    try { playing = el.play(); } catch (e) { finish(false); return undefined; }
    if (playing && typeof playing.catch === 'function') playing.catch(() => finish(false));
    return () => finish(false);
  }, [req]);
  if (!req) return null;
  const info = req.info || {};
  return ReactDOM.createPortal(
    <div data-boss-movie role="presentation" onClick={() => { if (canSkip && finishRef.current) finishRef.current(true); }}>
      {/* ★揺れは属性の a / b を切り替えて動きをかけ直す。key を変えると中の枠ごと作り直され、
          入れてある動画が画面から外れてしまう */}
      <div data-boss-movie-stage data-boss-movie-shake={shakeKey === 0 ? undefined : (shakeKey % 2 ? 'a' : 'b')}>
        {info.label && (
          <div data-boss-movie-title>
            {info.enemyName && <small>{info.enemyName}</small>}
            <b>{info.label}</b>
          </div>
        )}
        <div data-boss-movie-frame ref={holderRef}/>
      </div>
      <div data-boss-movie-skip aria-hidden={!canSkip} style={{ opacity: canSkip ? 1 : 0 }}>タップでスキップ</div>
    </div>,
    document.body
  );
};
// 敵の技の、画面全体に重ねる演出(body の直下へ出す)。攻撃が狙われた味方の枠まで飛んで当たる / 必殺技は画面を暗くする /
// 覚醒ムーは技名のカットイン・技ごとの全画面の演出・ひび割れも出す。
// ★位置は出す瞬間に1回だけ測る(敵の丸枠と味方の枠)。動きの途中で測り直すと、跳ねている絵の位置を拾ってしまう
// lite: 画面の軽さ「軽め」。飛ばすもの・画面を暗くする・覚醒ムーの全画面の演出を省き、当たりの光と技名だけにする
// ==== 敵の技の格上げ(2026-10-02 ユーザー指示「敵モンスターの攻撃を演出も強化して。これはタクティクスのみ」) ====
// 覚醒ムーは技ごとの全画面の演出を持っているので、それ以外の敵(9体)の大技へ足す。
//   技名の帯(連撃・貫通・必殺技・全体攻撃) / 当たる瞬間の閃光 / 全体攻撃の暗転 / 画面の揺れ(60-app) /
//   フィニッシュ(味方の枠の上に重なる絵。必殺技・全体攻撃は敵ごと、貫通は共通)
// フィニッシュの部品は固有技と同じ(24-battle-fx.jsx の SpecialFinish)。色は敵の色(--em-c)。
// d は当たる瞬間からの遅れ(ms。固有技の表と同じ作り方なので、呼び出し側が「当たる瞬間 - 250ms」を足す)
const TACTICS_ENEMY_BANNER_SKILLS = Object.freeze(['rush', 'pierce', 'special', 'allout']);
const TACTICS_ENEMY_FLASH_SKILLS = Object.freeze(['pierce', 'special', 'allout']);
const TACTICS_ENEMY_PIERCE_FINISH = Object.freeze([{t:'blade',a:0,len:360,w:8,d:240},{t:'col',w:30,h:420,d:260,sky:true},{t:'ring',d:300,r:3}]);
const TACTICS_ENEMY_FINISH = Object.freeze({
  // カワズモー(力士のカエル): 大回転落とし=地面を砕く衝撃 / 大投げたまや=花火
  kawazumo:     { special:[{t:'ring',d:300,r:4.2,flat:.38},{t:'bits',n:14,shape:'dust',dist:130,d:300},{t:'bits',n:8,shape:'star',dist:100,d:340}],
                  allout:[{t:'bits',n:18,shape:'star',dist:170,d:260},{t:'bits',n:12,shape:'spark',dist:110,d:340},{t:'col',w:120,h:420,d:240,sky:true,soft:true},{t:'ring',d:300,r:3.4}] },
  // メタルナー(拳法ロボ): 宙ポン拳=交差する掌打 / メタビーム=極太のビーム
  metalner:     { special:[{t:'blade',a:-42,len:340,w:10,d:240},{t:'blade',a:42,len:340,w:10,d:310},{t:'ring',d:340,r:3.6},{t:'bits',n:10,shape:'spark',dist:110,d:340}],
                  allout:[{t:'blade',a:0,len:420,w:18,d:240},{t:'col',w:60,h:440,d:260,sky:true},{t:'ring',d:300,r:3.8}] },
  // イナリ(子ぎつね): にゃんぷうき=葉の旋風 / ハワイにゃん=花
  inari:        { special:[{t:'bits',n:16,shape:'leaf',dist:140,d:280,spin:1},{t:'bits',n:10,shape:'leaf',dist:80,d:340,spin:-1},{t:'ring',d:300,r:3.2}],
                  allout:[{t:'bits',n:18,shape:'petal',dist:150,d:260,spin:1},{t:'bits',n:12,shape:'petal',dist:90,d:320,spin:-1},{t:'ring',d:300,r:3.4,flat:.45}] },
  // コイノボリ(鯉のぼり): キングウェーブ=大波 / 大津波=二重の大波
  koinobori:    { special:[{t:'wave',d:240},{t:'bits',n:12,shape:'drop',dist:140,d:340},{t:'ring',d:340,r:3.2,flat:.45}],
                  allout:[{t:'wave',d:220},{t:'wave',d:380},{t:'bits',n:16,shape:'drop',dist:130,d:300,fall:true},{t:'ring',d:420,r:4,flat:.45}] },
  // デルピエロ(鎌の騎士): ブラッディクロス=大きな十字の斬撃 / フォトンドライブ=光の星
  delpiero:     { special:[{t:'blade',a:-40,len:380,w:12,d:240},{t:'blade',a:40,len:380,w:12,d:320},{t:'col',w:40,h:440,d:380,sky:true},{t:'ring',d:380,r:3.8}],
                  allout:[{t:'bits',n:16,shape:'star',dist:150,d:280},{t:'blade',a:0,len:320,w:9,d:300},{t:'blade',a:90,len:320,w:9,d:300},{t:'ring',d:300,r:4}] },
  // ドクドク(ハートの手): めいどのみやげ=ハートと雫 / ようかい液=降りそそぐ液
  dokudoku:     { special:[{t:'bits',n:12,shape:'heart',dist:130,d:280},{t:'bits',n:10,shape:'drop',dist:100,d:330},{t:'ring',d:300,r:3.4}],
                  allout:[{t:'bits',n:18,shape:'drop',dist:130,d:260,fall:true},{t:'wave',d:300},{t:'ring',d:340,r:3.6,flat:.45}] },
  // ラミア(阿修羅): 帝釈崩天=三本の雷柱 / 大焦熱=炎の柱
  lamia:        { special:[{t:'col',w:44,h:440,d:240,sky:true,x:-54},{t:'col',w:56,h:480,d:280,sky:true},{t:'col',w:44,h:440,d:320,sky:true,x:54},{t:'ring',d:340,r:3.8},{t:'blade',a:0,len:300,w:7,d:340}],
                  allout:[{t:'col',w:56,h:380,d:260,flame:true,x:-52},{t:'col',w:66,h:440,d:240,flame:true},{t:'col',w:56,h:380,d:280,flame:true,x:52},{t:'bits',n:12,shape:'flame',dist:110,d:320,rise:true}] },
  // ニャルラトホテプ(邪神): 無貌の讃歌=回る魔法陣と光 / 真空魔空弾=魔法陣と十字
  nyarlathotep: { special:[{t:'ring',d:240,r:3.4,flat:.45,rune:true},{t:'bits',n:14,shape:'star',dist:140,d:300},{t:'col',w:120,h:440,d:300,sky:true,soft:true}],
                  allout:[{t:'ring',d:240,r:3.2,flat:.45,rune:true},{t:'blade',a:90,len:340,w:9,d:300},{t:'bits',n:12,shape:'spark',dist:120,d:300},{t:'bits',n:8,shape:'spark',dist:80,d:360}] },
  // ジャック(カボチャの大王・イベントのレイドボス): めいどのトリート=カボチャの火とお菓子の星が降る / おばけパレード=横切る光とおばけの行列
  jack:         { special:[{t:'bits',n:14,shape:'star',dist:140,d:280},{t:'bits',n:12,shape:'flame',dist:110,d:330,fall:true},{t:'ring',d:300,r:3.4}],
                  allout:[{t:'blade',a:0,len:420,w:16,d:240},{t:'bits',n:16,shape:'spark',dist:130,d:260},{t:'wave',d:300},{t:'ring',d:340,r:3.6,flat:.45}] },
  // ぱんぷきん: ジャックと同じ飾り(めいどのトリート=お菓子の星とカボチャの火 / おばけパレード=おばけの行列)
  pumpkin:      { special:[{t:'bits',n:14,shape:'star',dist:140,d:280},{t:'bits',n:12,shape:'flame',dist:110,d:330,fall:true},{t:'ring',d:300,r:3.4}],
                  allout:[{t:'blade',a:0,len:420,w:16,d:240},{t:'bits',n:16,shape:'spark',dist:130,d:260},{t:'wave',d:300},{t:'ring',d:340,r:3.6,flat:.45}] },
  // スプラッター(斧の処刑人): エクスキューション=巨大な斧の一閃と血しぶき / デスエナジー=赤い炎
  splatter:     { special:[{t:'blade',a:-58,len:440,w:16,d:240},{t:'col',w:44,h:440,d:320,sky:true},{t:'bits',n:12,shape:'drop',dist:130,d:340},{t:'ring',d:340,r:3.6}],
                  allout:[{t:'col',w:60,h:400,d:260,flame:true},{t:'bits',n:14,shape:'spark',dist:120,d:300},{t:'ring',d:300,r:3.8,flat:.45}] },
});
const TacticsEnemyStageFx = ({ fx, motion, isMoo, enemyId, skillLabel, lite = false }) => {
  const [geo, setGeo] = useState(null);
  React.useLayoutEffect(() => {
    if (!fx || !fx.skill || !motion) { setGeo(null); return; }
    const src = document.querySelector(isMoo ? '[data-moo-stage]' : '[data-enemy-ring]');
    if (!src) { setGeo(null); return; }
    const r = src.getBoundingClientRect();
    const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; };
    const slots = (Array.isArray(fx.targets) ? fx.targets : []).map((i) => {
      const el = document.querySelector(`[data-tactics-look] [data-slot-index="${i}"]`);
      return el ? { i, ...box(el) } : null;
    }).filter(Boolean);
    const all = [...document.querySelectorAll('[data-tactics-look] [data-slot-index]')].map(box);
    setGeo({ sx: r.left + r.width / 2, sy: r.top + r.height * (isMoo ? 0.42 : 0.5), sr: Math.min(r.width, r.height) / (isMoo ? 3 : 2), slots, all,
      vw: window.innerWidth || 390, vh: window.innerHeight || 844 });
  }, [fx, motion, isMoo]);
  if (!fx || !fx.skill || !motion || !geo) return null;
  const skill = fx.skill;
  const ms = Number.isFinite(fx.ms) && fx.ms > 0 ? fx.ms : tacticsEnemyMotionMs(enemyId, skill, 1000);
  // ★ムービーを流したあと(afterMovie)は、溜めも技名もムービーで見せ終えている。
  //   戦闘画面へ戻ったらすぐ味方の枠へ当てる
  const afterMovie = !!fx.afterMovie;
  const hit = afterMovie ? 0.12 : tacticsEnemyHitFrac(enemyId, skill);
  const look = TACTICS_ENEMY_STRIKE_LOOK[motion] || {};
  const spec = TACTICS_ENEMY_MOTION_SETS[motion] ? TACTICS_ENEMY_MOTION_SETS[motion].skills[skill] : null;
  const strikes = !TACTICS_ENEMY_NO_STRIKE_SKILLS.includes(skill);
  const hits = skill === 'rush' ? [hit - 0.4, hit - 0.2, hit] : [hit];
  // 覚醒ムーのドラゴンパンチは三日月ではなく、大きな拳そのものを飛ばす
  const trail = skill === 'pierce' ? 'beam' : (skill === 'sweep' && !isMoo) ? 'wave' : (look.trail || 'orb');
  const shot = spec && spec[3] === 'shoot' ? spec[2] : (isMoo && skill === 'sweep' ? '👊' : (look.shot || null));
  const big = skill === 'special' || skill === 'allout' || isMoo;
  const at = (frac) => `${Math.round(ms * Math.max(0, frac))}ms`;
  const { sx, sy, sr } = geo;
  return ReactDOM.createPortal(
    <div data-enemy-stage-fx data-enemy-motion={motion} data-stage-skill={skill} data-stage-moo={isMoo ? 'true' : undefined}
      className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 64000, '--em-dur': `${ms}ms`, '--sx': `${sx}px`, '--sy': `${sy}px` }}>
      {!lite && !afterMovie && (skill === 'special' || (isMoo && ['allout', 'charge', 'pierceCharge'].includes(skill)) || (!isMoo && skill === 'allout')) && (
        <div data-stage-dim style={{ background: `radial-gradient(circle at ${sx}px ${sy}px, transparent ${Math.round(sr * 1.15)}px, rgba(0,0,0,.74) ${Math.round(sr * 1.15 + 110)}px)` }}/>
      )}
      {strikes && geo.slots.map((t) => hits.map((h, k) => {
        const dx = t.x - sx, dy = t.y - sy;
        const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const from = Math.max(0, h - 0.22);
        return (
          <React.Fragment key={`${t.i}-${k}`}>
            {!lite && <i data-strike={trail} data-big={big ? 'true' : undefined} style={{ left: sx, top: sy, '--dx': `${dx}px`, '--dy': `${dy}px`, '--len': `${len}px`, '--ang': `${ang}deg`,
              animationDelay: at(from), animationDuration: at(h - from + 0.08) }}>{trail === 'orb' && shot ? shot : null}</i>}
            <i data-impact={look.impact || 'burst'} data-big={big ? 'true' : undefined} style={{ left: t.x, top: t.y, '--w': `${Math.round(Math.min(t.w, t.h * 1.6))}px`,
              animationDelay: at(h), animationDuration: `${Math.max(280, Math.round(ms * 0.36))}ms` }}>{look.mark || null}</i>
          </React.Fragment>
        );
      }))}
      {!isMoo && !lite && !afterMovie && TACTICS_ENEMY_BANNER_SKILLS.includes(skill) && skillLabel && (
        <div data-enemy-banner={skill}><div data-enemy-banner-band><span data-enemy-banner-tag>{skill === 'special' ? '必殺技' : skill === 'allout' ? '全体攻撃' : skill === 'pierce' ? '貫通' : '連撃'}</span><span data-enemy-banner-name style={{ fontSize:`${Math.max(18, Math.min(34, Math.floor(260 / Math.max(1, String(skillLabel).length))))}px` }}>{skillLabel}</span></div></div>
      )}
      {!isMoo && !lite && TACTICS_ENEMY_FLASH_SKILLS.includes(skill) && (
        <div data-enemy-flash style={{ animationDelay: at(hit) }}/>
      )}
      {!isMoo && !lite && strikes && (() => {
        const parts = skill === 'pierce' ? TACTICS_ENEMY_PIERCE_FINISH : ((TACTICS_ENEMY_FINISH[motion] || {})[skill] || null);
        if (!parts) return null;
        const hitMs = Math.round(ms * hit);
        return geo.slots.map((t) => (
          <div key={`fin-${t.i}`} className="spm spm--enemy" data-enemy-finish={`${motion}-${skill}`}
            style={{ '--spm-c1':'color-mix(in srgb, rgb(var(--em-c)) 38%, #fff)', '--spm-c2':'rgb(var(--em-c))', '--spm-tx':`${Math.round(t.x)}px`, '--spm-ty':`${Math.round(t.y)}px` }}>
            <SpecialFinish parts={parts} offset={Math.max(0, hitMs - 240)}/>
          </div>
        ));
      })()}
      {isMoo && !afterMovie && TACTICS_MOO_CUTIN_SKILLS.includes(skill) && skillLabel && (
        <div data-moo-cutin><div data-moo-cutin-band><span>{skillLabel}</span></div></div>
      )}
      {isMoo && !lite && skill === 'normal' && [0, 1, 2].map((k) => (
        <i key={k} data-moo-claw style={{ top: `${46 + k * 7}%`, animationDelay: at(0.5 + k * 0.04) }}/>
      ))}
      {isMoo && !lite && skill === 'rush' && geo.all.concat(geo.all).map((t, k) => (
        <i key={k} data-impact="nova" data-big="true" style={{ left: t.x + ((k * 37) % 60) - 30, top: t.y + ((k * 23) % 40) - 20, '--w': `${Math.round(t.w * 0.8)}px`,
          animationDelay: at(0.25 + k * 0.07), animationDuration: '380ms' }}/>
      ))}
      {isMoo && !lite && !afterMovie && skill === 'special' && [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
        <i key={k} data-moo-meteor style={{ left: `${8 + ((k * 29) % 90)}%`, animationDelay: at(0.18 + k * 0.07) }}>☄️</i>
      ))}
      {isMoo && !lite && skill === 'allout' && [0, 1, 2].map((k) => (
        <i key={k} data-moo-tornado style={{ top: `${44 + k * 14}%`, animationDelay: at(0.22 + k * 0.1) }}>🌪️</i>
      ))}
      {isMoo && !lite && skill === 'roar' && [0, 1, 2, 3, 4, 5].map((k) => (
        <i key={k} data-moo-bolt style={{ left: `${6 + ((k * 41) % 86)}%`, top: `${8 + ((k * 53) % 70)}%`, animationDelay: at(0.18 + k * 0.08) }}>⚡</i>
      ))}
      {isMoo && !lite && skill === 'regen' && <><i data-moo-heaven/>{[0, 1, 2, 3, 4, 5].map((k) => (
        <i key={k} data-moo-feather style={{ left: `${20 + k * 12}%`, animationDelay: at(0.1 + k * 0.08) }}>{k % 2 ? '✨' : '🪶'}</i>
      ))}</>}
      {isMoo && !lite && skill === 'charge' && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
        <i key={k} data-moo-gather style={{ '--gx': `${Math.cos(k * 0.63) * 200}px`, '--gy': `${Math.sin(k * 0.63) * 200}px`, animationDelay: at(k * 0.06) }}/>
      ))}
      {isMoo && !lite && skill === 'pierceCharge' && geo.all.map((t, k) => (
        <i key={k} data-moo-reticle style={{ left: t.x, top: t.y, animationDelay: at(0.1 + k * 0.08) }}/>
      ))}
      {isMoo && ['normal', 'rush', 'pierce', 'special', 'allout', 'roar'].includes(skill) && (
        <div data-moo-flash style={{ animationDelay: at(skill === 'special' && !afterMovie ? 0.78 : hit) }}/>
      )}
      {isMoo && !lite && TACTICS_MOO_CRACK_SKILLS.includes(skill) && (() => {
        const t = geo.slots[0] || geo.all[0] || { x: geo.vw / 2, y: geo.vh * 0.6 };
        return (
          <svg data-moo-crack width={geo.vw} height={geo.vh} viewBox={`0 0 ${geo.vw} ${geo.vh}`} style={{ animationDelay: at(skill === 'special' && !afterMovie ? 0.78 : hit) }}>
            <g transform={`translate(${t.x} ${t.y}) scale(${skill === 'special' || skill === 'allout' ? 1.6 : 1.1})`}>
              {TACTICS_CRACK_PATHS.map((d, k) => <path key={k} d={d}/>)}
            </g>
          </svg>
        );
      })()}
    </div>,
    document.body
  );
};
// 敵の上の文字のうち、ダメージの数字(与えた数・合計・反射・クロスカウンター)かどうか。
// それ以外(スタン・咆哮・再生・移動の予告など)は「効果」として、敵の足元の小さな札へ回す
const isEnemyDamagePopupText = (text) => /^(\d[\d,]*!*|合計\s|反射\s*\d|(?:クロス|フル|リベンジ)カウンター\s*\d)/.test(String(text == null ? '' : text));
// 札の文字の色は、もとの色の指定(text-◯◯-300 など)だけ残す。大きさの指定(text-xl など)は札の側で決める
const enemyFxChipTone = (color) => String(color || '').split(/\s+/)
  .filter(c => /^text-[a-z]+-\d{2,3}$/.test(c) || /^text-(white|black)$/.test(c)).join(' ') || 'text-white';
// ===== カードを「捨てる」エリア(タクティクス・2026-10-05 ユーザー案) =====
// カードをつかんだあいだ、味方のスロットの列を「アクション」、その上(敵側)を「捨てる」エリアとして薄く出す。
// 敵のエリアへ離すと、使わずに捨てて行動回数を1つ使い、味方全体のガッツが各自の最大の5%ずつ戻る。
// 範囲は画面の実際の位置(スロットの列の上端)で決める。判定(inTacticsDiscardZone)と表示で同じ関数を通す
const tacticsDiscardGeo = () => {
  if (typeof document === 'undefined') return null;
  const rects = [...document.querySelectorAll('[data-slot-index]')].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  if (rects.length === 0) return null;
  const slotTop = Math.min(...rects.map(r => r.top)) - 6;
  const slotBottom = Math.max(...rects.map(r => r.bottom)) + 6;
  const ring = document.querySelector('[data-enemy-ring],[data-moo-stage]');
  const ringTop = ring ? ring.getBoundingClientRect().top - 24 : 0;
  return { enemyTop: Math.max(0, Math.min(ringTop, slotTop - 40)), slotTop, slotBottom };
};
const inTacticsDiscardZone = (x, y) => {
  const g = tacticsDiscardGeo();
  return !!g && y >= g.enemyTop && y < g.slotTop;
};
// ★「マーク×数」(2026-10-12 社長の依頼)。味方の枠・敵の絵の隅に、貯まった数・重なった状態を常に出す。
//   counts … { kind: 数 }(kind は BATTLE_STACK_MARKS のキー)。絵柄・言い方は BATTLE_STACK_MARKS の1か所で差し替える。
//   side … 'ally' | 'enemy'。full … 満タンにする数(クッキー・黒音符の上限で光らせる)
const BattleStackMarks = ({ counts, side, full = 0, className = '' }) => {
  const items = battleStackMarkItems(counts);
  if (!items.length) return null;
  return (
    <div data-stack-marks={side} data-stack-many={items.length >= 3 ? 'true' : undefined} role="img" aria-label={items.map((it) => `${it.label}${it.count}${it.unit === 'T' ? 'ターン' : ''}`).join('、')} className={`mh-stack-marks pointer-events-none ${className}`}>
      {items.map((it) => (
        <span key={it.kind} data-stack-mark={it.kind} data-stack-count={it.count} data-stack-full={full > 0 && it.showZero && it.count >= full ? 'true' : undefined}
          data-stack-last={it.unit === 'T' && it.count === 1 ? 'true' : undefined} className="mh-stack-mark">
          {it.img ? <img src={it.img} alt="" draggable={false} /> : <i aria-hidden="true">{it.mark}</i>}<b>{it.unit === 'T' ? `${it.count}T` : `×${it.count}`}</b>
        </span>
      ))}
    </div>
  );
};
// ★バトル中にモンスターを押したときの「能力・かかっている効果」(2026-10-13 社長の依頼
//   「モンスターをタップすると能力含め詳細バフも見れるようにして」)。味方も敵も同じ形で出す。
//   値はすべて渡されたものをそのまま出す(味方: battleUnitStatusOf・強化の札・マーク×数、敵: battleEnemyStatus・enemyDebuffs)。
//   side … 'ally' | 'enemy'。chips … 強化の札(battleBuffChips の戻り値)。marks … マーク×数の数({ kind: 数 })
const BattleUnitDetailBody = ({ side, status, chips = [], marks = null, debuffs = [] }) => {
  if (!status) return null;
  const stat = (key, label, cls, value, sub) => (
    <div data-unit-stat={key} className="min-w-0 rounded-lg bg-black/40 px-2 py-1">
      <div className={`text-[9px] font-black ${cls}`}>{label}</div>
      <div className="text-[13px] font-mono font-black leading-tight text-white">{value}</div>
      {sub && <div className="text-[9px] font-bold leading-tight text-slate-400">{sub}</div>}
    </div>
  );
  const changed = (s) => s && s.now !== s.base;
  const statOf = (key, label, cls, s) => stat(key, label, cls,
    <span className={changed(s) ? (s.now > s.base ? 'text-emerald-200' : 'text-rose-200') : ''}>{s.now.toLocaleString()}</span>,
    `元の値 ${s.base.toLocaleString()}`);
  const row = (key, mark, label, value, note, tone = '') => (
    <li key={key} data-unit-effect={key} className={`rounded-lg border border-white/10 bg-black/40 px-2 py-1 ${tone}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[12px] font-black leading-snug">
        {mark != null && <span className="shrink-0">{mark}</span>}<span className="break-words">{label}</span>{value ? <span className="break-words text-white">{value}</span> : null}
      </div>
      {note ? <div className="text-[10px] font-bold leading-snug text-slate-300">{note}</div> : null}
    </li>
  );
  const list = (key, title, rows) => (
    <section data-unit-effects={key} className="mt-2">
      <div className="mb-1 text-[10px] font-black text-slate-400">{title}</div>
      {rows.length ? <ul className="space-y-1">{rows}</ul> : <p className="text-[11px] font-bold text-slate-500">ありません</p>}
    </section>
  );
  if (side === 'enemy') {
    return (
      <div data-unit-detail-body="enemy">
        <div className="grid grid-cols-2 gap-1.5">
          {stat('hp', 'ライフ', 'text-pink-400', `${status.hp.toLocaleString()} / ${status.maxHp.toLocaleString()}`)}
          {statOf('atk', '攻撃力', 'text-red-400', status.atk)}
        </div>
        {list('enemy', 'かかっている効果', (Array.isArray(debuffs) ? debuffs : []).map((d) => row(d.key, d.mark, d.label, d.value, d.note, d.tone)))}
      </div>
    );
  }
  // 数が0のもの(クッキー・黒音符の×0)は効いていないので、一覧には出さない(帯の札も0なら出さない。2026-10-13 窓口の指摘)
  const markRows = battleStackMarkItems(marks).filter((it) => it.count > 0).map((it) => row(`mark-${it.kind}`, it.img ? <img src={it.img} alt="" className="inline h-3.5 w-3.5 object-contain" /> : it.mark, it.label,
    it.unit === 'T' ? `あと${it.count}ターン` : `×${it.count}`, ''));
  const own = (chips || []).filter((c) => c.owner === status.slot);
  const team = (chips || []).filter((c) => c.owner == null);
  const lineRows = (status.lines || []).map((l) => row(l.key, null, l.label, l.value, l.note));
  const chipRow = (c) => row(c.key, c.mark, c.label, c.value, '', c.tone);
  const apt = status.aptPct;
  return (
    <div data-unit-detail-body="ally">
      <div className="grid grid-cols-2 gap-1.5">
        {stat('hp', 'ライフ', 'text-pink-400', `${status.hp.toLocaleString()} / ${status.maxHp.toLocaleString()}`, status.baseMaxHp !== status.maxHp ? `元の上限 ${status.baseMaxHp.toLocaleString()}` : '')}
        {stat('guts', 'ガッツ', 'text-amber-400', `${status.guts.toLocaleString()} / ${status.maxGuts.toLocaleString()}`, status.baseMaxGuts !== status.maxGuts ? `元の上限 ${status.baseMaxGuts.toLocaleString()}` : '')}
        {statOf('atk', 'ちから', 'text-red-400', status.atk)}
        {statOf('def', '丈夫さ', 'text-emerald-400', status.def)}
      </div>
      <div data-unit-stat="apt" className="mt-1 text-[10px] font-black text-cyan-300">この枠の間合い適性 {apt >= 0 ? '+' : ''}{apt}%</div>
      {status.tactics
        ? <>{list('own', 'この子にかかっている効果', [...markRows, ...lineRows, ...own.map(chipRow)])}{list('team', '味方全員にかかっている効果', team.map(chipRow))}</>
        : list('team', 'かかっている効果(パーティ全体)', [...markRows, ...lineRows, ...own.map(chipRow), ...team.map(chipRow)])}
    </div>
  );
};
// 詳細の窓(タクティクス以外の味方・敵)。タクティクスの味方は EX の窓の「能力・効果」の切り替えで同じ中身を出す
const BattleUnitDetailPanel = ({ side, status, chips, marks, debuffs, onClose }) => {
  if (!status) return null;
  return ReactDOM.createPortal((
    <div data-battle-unit-detail={side === 'enemy' ? 'enemy' : status.slot} role="dialog" aria-modal="true" aria-label={`${status.name}の詳細`}
      className="fixed inset-0 z-[70000] flex items-center justify-center bg-black/70 px-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }} onClick={onClose}>
      <div className={`w-full max-w-[340px] rounded-3xl border-2 bg-slate-900 px-4 py-3 shadow-2xl text-white ${side === 'enemy' ? 'border-red-400/60' : 'border-sky-400/60'}`} style={{ maxHeight: '100%', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {status.imgUrl && <img src={status.imgUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />}
          <div className="min-w-0">
            <div className="text-[10px] font-black text-slate-400">{side === 'enemy' ? '敵の詳細' : 'モンスターの詳細'}</div>
            <div className="break-words text-[16px] font-black leading-tight">{status.name}</div>
          </div>
        </div>
        {status.downed && <p className="mt-1 text-[11px] font-black text-emerald-300">ダウン中(ライフが上限まで戻ると立ち上がります)</p>}
        <div className="mt-2"><BattleUnitDetailBody side={side} status={status} chips={chips} marks={marks} debuffs={debuffs} /></div>
        <button type="button" data-battle-unit-detail-close onClick={onClose} className="mt-3 min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-800 text-[13px] font-black text-slate-200 active:scale-95">閉じる</button>
      </div>
    </div>
  ), document.body);
};
// ★モンスターごとの演出(2026-10-12 社長の決定)。絵柄は BATTLE_MONSTER_FX の1か所。
//   fx … { avoid, present:{ jackpot, kind }, swordStyle }(tacticsSlotCountersAt が作る)。imgSrc … 分身に使うその子の絵。
//   calm … 「待機中の動き：止める」のとき(動きを止めて形だけ出す。端末の「動きを減らす」は CSS で止める)
const BattleMonsterFx = ({ fx, imgSrc, monId, stacks = null, calm = false }) => {
  if (!fx && !stacks) return null;
  fx = fx || {};
  const T = BATTLE_MONSTER_FX;
  const n = (v, max) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
  const clones = n(fx.avoid, T.avoidClone.max);
  const pr = fx.present || null;
  const style = typeof fx.swordStyle === 'string' && T.swordStyle[fx.swordStyle] ? fx.swordStyle : null;
  // 区切り2(EXが効いているあいだ)
  const aura = fx.exEffect === 'statBoost' && T.aura[monId] ? T.aura[monId] : null;
  const gloves = fx.exEffect === 'counter' ? n(fx.counter, T.glove.max) : 0;
  const volt = fx.exEffect === 'stage' && fx.voltage ? fx.voltage : null;
  const after = fx.exEffect === 'dodgeCombo' ? n(fx.dodges, T.afterimage.max) : 0;
  const thunder = fx.exEffect === 'thunder' && fx.thunder ? fx.thunder : null;
  // 区切り3
  const scatter = fx.exEffect && T.scatter[monId] ? T.scatter[monId] : null;
  const leaves = n(fx.leafShield, T.leafShield.max);
  // 区切り4
  const overlay = fx.exEffect && T.overlay[monId] ? T.overlay[monId] : null;
  const film = !!fx.coverFilm, sprout = !!fx.sprout;
  // 区切り5。メロディー・クロミー・スプーキーは、枠の「マーク×数」と同じ数(stacks)から作る
  const box = fx.exEffect === 'pandoraBox' ? Math.max(1, Math.min(3, Math.floor(Number(fx.exTurns) || 3))) : 0;
  const ring = !!fx.springRing;
  const st = stacks || {};
  const pile = monId === 'Melody' && Number(st.cookie) > 0 ? n(Math.ceil(Number(st.cookie) / T.cookiePile.perMark), T.cookiePile.max) : 0;
  const staff = monId === 'Kuromy' && Number(st.note) > 0 ? n(Math.ceil(Number(st.note) / T.noteStaff.perMark), T.noteStaff.max) : 0;
  const coins = monId === 'Spooky' ? n((Number(st.fateAtk) || 0) + (Number(st.fateCombo) || 0), T.coinSpin.max) : 0;
  const stackFull = (monId === 'Melody' && Number(st.cookie) >= SWEET_STACK_MAX) || (monId === 'Kuromy' && Number(st.note) >= SWEET_STACK_MAX);
  if (!clones && !pr && !style && !aura && !gloves && !volt && !after && !thunder && !scatter && !leaves && !overlay && !film && !sprout && !box && !ring && !pile && !staff && !coins) return null;
  const fading = Number(fx.exTurns) === 1;
  return (
    <div data-monster-fx className={`mh-mfx pointer-events-none${calm ? ' is-calm' : ''}`} aria-hidden="true">
      {aura && <span data-mfx-aura={monId} className={`mh-mfx-aura${fading ? ' is-fading' : ''}`} style={{ '--mfx-c': aura.color }}><i>{aura.mark}</i></span>}
      {volt && <span data-mfx-spotlight={volt.value} className="mh-mfx-spot"
        style={{ '--mfx-c': T.spotlight.color, opacity: T.spotlight.minOpacity + (T.spotlight.maxOpacity - T.spotlight.minOpacity) * (volt.max > 0 ? Math.min(1, volt.value / volt.max) : 0) }}/>}
      {imgSrc && Array.from({ length: after }, (_, k) => (
        <img key={`a${k}`} data-mfx-afterimage={k} className={`mh-mfx-after a${k}`} src={imgSrc} alt="" draggable={false} style={{ '--mfx-c': T.afterimage.color }} />
      ))}
      {gloves > 0 && <span data-mfx-glove={gloves} className="mh-mfx-glove">{Array.from({ length: gloves }, (_, k) => <i key={k}>{T.glove.mark}</i>)}</span>}
      {thunder && (thunder.phase === 'wrap'
        ? <span data-mfx-thunder="wrap" className="mh-mfx-wrap" style={{ '--mfx-c': T.thunder.color }}><i>{T.thunder.mark}</i><i>{T.thunder.mark}</i></span>
        : n(thunder.charge, T.thunder.max) > 0 && <span data-mfx-thunder={n(thunder.charge, T.thunder.max)} className="mh-mfx-spark">{Array.from({ length: n(thunder.charge, T.thunder.max) }, (_, k) => <i key={k}>{T.thunder.mark}</i>)}</span>)}
      {imgSrc && Array.from({ length: clones }, (_, k) => (
        <img key={k} data-mfx-clone={k} className={`mh-mfx-clone c${k}`} src={imgSrc} alt="" draggable={false} style={{ opacity: T.avoidClone.opacity }} />
      ))}
      {pr && (
        <span data-mfx-present={pr.jackpot ? 'jackpot' : (pr.kind || 'on')} className={`mh-mfx-present${pr.jackpot ? ' is-jackpot' : ''}`}>
          {T.present.img ? <img src={T.present.img} alt="" draggable={false} /> : <i>{T.present.mark}</i>}
          <b>{pr.jackpot ? T.present.jackpotMark : (T.present.inner[pr.kind] || '')}</b>
        </span>
      )}
      {style && <span data-mfx-sword={style} className="mh-mfx-sword">{T.swordStyle[style]}</span>}
      {scatter && (scatter.kind === 'ring'
        ? <span data-mfx-scatter="ring" className="mh-mfx-ring" style={{ '--mfx-c': scatter.color }}/>
        : <span data-mfx-scatter={scatter.kind} className={`mh-mfx-scatter is-${scatter.kind}`}>{scatter.marks.map((m, k) => <i key={k} className={`s${k}`}>{m}</i>)}</span>)}
      {overlay && <span data-mfx-overlay={overlay.kind} className={`mh-mfx-ov is-${overlay.kind}`} style={{ '--mfx-c': overlay.color }}>{overlay.mark ? <i>{overlay.mark}</i> : null}</span>}
      {film && <span data-mfx-cover="film" className="mh-mfx-film" style={{ '--mfx-c': T.coverFilm.color }}><i>{T.coverFilm.mark}</i></span>}
      {sprout && <span data-mfx-sprout={T.sprout.n} className="mh-mfx-sprout">{Array.from({ length: T.sprout.n }, (_, k) => <i key={k}>{T.sprout.mark}</i>)}</span>}
      {ring && <span data-mfx-spring="ring" className="mh-mfx-spring" style={{ '--mfx-c': T.springRing.color }}/>}
      {box > 0 && <span data-mfx-pandora={box} className="mh-mfx-pbox"><i className="lid" style={{ transform: `rotate(${T.pandoraBox.angles[box] || 0}deg)` }}>{T.pandoraBox.lid}</i><i>{T.pandoraBox.mark}</i></span>}
      {pile > 0 && <span data-mfx-cookie-pile={pile} className={`mh-mfx-pile${stackFull ? ' is-full' : ''}`}>{Array.from({ length: pile }, (_, k) => <i key={k}>{T.cookiePile.mark}</i>)}</span>}
      {staff > 0 && <span data-mfx-note-staff={staff} className={`mh-mfx-staff${stackFull ? ' is-full' : ''}`}>{Array.from({ length: staff }, (_, k) => <i key={k} className={`n${k}`}>{T.noteStaff.mark}</i>)}</span>}
      {coins > 0 && <span data-mfx-coin={coins} className="mh-mfx-coin">{Array.from({ length: coins }, (_, k) => <i key={k}>{T.coinSpin.mark}</i>)}</span>}
      {leaves > 0 && <span data-mfx-leaf={leaves} className="mh-mfx-leaf">{Array.from({ length: leaves }, (_, k) => <i key={k}>{T.leafShield.mark}</i>)}</span>}
    </div>
  );
};
const TacticsDiscardZones = ({ full, used, limit }) => {
  const g = tacticsDiscardGeo();
  if (!g || typeof ReactDOM === 'undefined') return null;
  const base = { position: 'fixed', left: 8, right: 8, pointerEvents: 'none', zIndex: 69000, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 900, transition: 'background .12s, border-color .12s' };
  return ReactDOM.createPortal(<div data-discard-zones aria-hidden="true">
    <style>{'[data-discard-zone][data-hover="true"]{background:rgba(251,191,36,.30)!important;border-color:rgba(253,230,138,.95)!important}'}</style>
    <div data-discard-zone style={{ ...base, top: g.enemyTop, height: Math.max(0, g.slotTop - g.enemyTop), background: 'rgba(251,191,36,.10)', border: '2px dashed rgba(251,191,36,.55)', color: 'rgba(253,230,138,.9)', fontSize: 13, opacity: full ? 0.45 : 1 }}>
      <span>{full ? `行動回数がいっぱい(${used}/${limit})` : <>ここへ離すと捨てる<br /><span style={{ fontSize: 10 }}>行動回数を1つ使い、味方全体のガッツが最大の5%回復</span></>}</span>
    </div>
    <div style={{ ...base, top: g.slotTop, height: Math.max(0, g.slotBottom - g.slotTop), background: 'rgba(56,189,248,.07)', border: '2px dashed rgba(56,189,248,.45)', color: 'rgba(186,230,253,.55)', fontSize: 11, alignItems: 'flex-start', paddingTop: 2 }}>
      <span>アクション(味方へ置いて使う)</span>
    </div>
  </div>, document.body);
};
const kindOfTacticsSlotFx = (fx) => {
  if (!fx) return null;
  if (fx.evade) return 'evade';
  if (fx.reflect) return 'reflect';
  if (fx.dmg > 0) return 'hit';
  if (fx.guard) return 'guard';
  return null;
};
//
// MonsterHeroGame から切り出した20本目・最後の1本(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-13)。
// バトル画面そのもの(87千字)と、バトル中にだけ重なる演出4つ。
//
// 【この画面ならではの注意】
// ・A等級(docs/refactor/REGRESSION_RISK_MAP.md)。ランキングに影響しうるので、
//   **計算・保存・ターン進行はひとつも移していない**。ここにあるのは見せ方だけ
// ・オート進行・演出・ターンのタイマーはすべて MonsterHeroGame 側に残る。
//   画面へ移すと、画面のライフサイクルで途中の setTimeout が止まって進行不能になる
//   (この画面の中に残る setTimeout は、カードを置いたあと 0.5 秒で光を消す1つだけ)
// ・省エネ切替ボタンだけ、バトル画面の中でもういちど gameState==='BATTLE' を見ていた。
//   画面は gameState を知らない約束(ui/screen-parts-check)なので、
//   本体から battleScreenActive として渡している(綴りだけの違い)
// ★AIコピー(ソラシドのアシカ)の5つの遊びの札。縦は4人の列の右はし、横向き(背の低い画面)は列の下に置く(ジン部長の決め)。
//   4列(=間合い)の外に置いて、5つ目の間合いに見えないようにする。コピーがいないときは列の組み方を変えない(display:contents)
const CLASSIC_AI_COPY_CSS = `
[data-ai-copy-row]{display:flex;width:100%;gap:6px;align-items:stretch}
[data-ai-copy-row] > .grid{flex:1 1 0;min-width:0;width:auto}
[data-ai-copy-cell]{width:62px;flex:0 0 62px;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:2px;padding:3px 3px;border-radius:12px;border:1px solid rgba(52,211,153,.6);background:rgba(2,44,34,.55);position:relative}
[data-ai-copy-cell] [data-ai-copy-head]{display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;min-width:0}
[data-ai-copy-cell] [data-ai-copy-name]{width:100%;min-width:0;text-align:center;font-size:9px;line-height:10px;font-weight:900;color:#a7f3d0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:keep-all;overflow-wrap:anywhere}
@media (orientation: landscape) and (max-height: 520px){
  [data-ai-copy-row]{flex-direction:column;gap:3px}
  [data-ai-copy-row] > .grid{flex:0 0 auto;width:100%}
  [data-ai-copy-cell]{width:100%;flex:0 0 30px;height:30px;flex-direction:row;justify-content:flex-start;gap:6px;padding:0 6px;border-radius:8px;overflow:visible}
  [data-ai-copy-cell] [data-ai-copy-head]{width:auto;flex:0 0 auto;flex-direction:row;gap:4px}
  [data-ai-copy-cell] [data-ai-copy-name]{width:auto;flex:0 1 auto;max-width:110px;text-align:left;-webkit-line-clamp:1}
  [data-ai-copy-cell] [data-ai-copy-art]{flex:0 0 26px;width:26px;height:26px}
  [data-ai-copy-cell] [data-ai-copy-guts]{flex:0 0 92px;width:92px}
  [data-ai-copy-cell] [data-sorashido-next]{flex-direction:row;gap:6px;width:auto;flex:1 1 0;padding:0 6px;border-radius:6px}
  [data-ai-copy-cell] [data-sorashido-next] > b{-webkit-line-clamp:1}
}`;
// 演出の段階。60 から aiCopy.fx('appear'|'thinking'|'vanish')が来ればそれを使い、無ければ fallback(出る前 appear・出たら idle)
const aiCopyViewPhase = (copy, fallback) => (copy && ['appear', 'thinking', 'vanish'].includes(copy.fx) ? copy.fx : fallback);
const classicAiCopyLandscape = () => {
  try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches; }
  catch (e) { return false; }
};
// ★AIコピーの5列目の部品(2026-10-28 社長が案アに決めた)。タクティクス/レイドで空いたマスが無いとき・タクティクス旧の盤の外に出す。
//   5つの遊びの札(ClassicAiCopyCell)もこの部品にそろえる約束(ダイスくん)。src は元の子(枠の子か ALL_PLAYER_MONSTERS の1件)
//   AiCopyFace … 元の子の顔の右下に🤖の印 / AiCopyBody … 少し薄くした元の子の絵。コピーが打つ間(hit)は技の動きで動く
//   AiCopyLifeBar … ライフの数と棒(元の子の枠のライフの行と同じ字の大きさ)。hp が数のときだけ出す(5つの遊びのコピーはライフが無い)
const aiCopySrcOf = (copy, slots) => {
  if (!copy) return null;
  const fromSlot = Array.isArray(slots) ? slots[copy.srcSlot] : null;
  if (fromSlot && (!copy.srcMonsterId || fromSlot.id === copy.srcMonsterId)) return fromSlot;
  return (typeof ALL_PLAYER_MONSTERS !== 'undefined' && copy.srcMonsterId && ALL_PLAYER_MONSTERS[copy.srcMonsterId]) || fromSlot || null;
};
// ===== AIコピーの5人目の札で、本編(5つの遊び)とタクティクス/レイドの5列目が共通に使う部品(2026-10-28 社長の決め) =====
// 名前と形はレフェリーくんと決めた(AiCopyFace・AiCopyBody。ライフの AiCopyLifeBar はタクティクス側でレフェリーくんが足す)。
// src は元の子(slots[copy.srcSlot] か ALL_PLAYER_MONSTERS[copy.srcMonsterId])
// 元の子の顔に「🤖」の印。顔の絵が無ければ立ち絵、それも無ければ 🤖 だけ
function AiCopyFace({ src, size = 22 }) {
  const url = (src && (src.faceIconUrl || src.iconUrl || src.imgUrl)) || '';
  return (
    <span data-ai-copy-face className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" aria-hidden="true" draggable="false" className="h-full w-full rounded-full object-cover bg-black/30 ring-1 ring-emerald-300/70"/>
        : <span className="flex h-full w-full items-center justify-center rounded-full bg-black/30 text-[12px]">🤖</span>}
      {url && <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-emerald-900 ring-1 ring-emerald-300 leading-none"
        style={{ width: Math.round(size * 0.62), height: Math.round(size * 0.62), fontSize: Math.round(size * 0.45) }}>🤖</span>}
    </span>
  );
}
// 元の子の立ち絵を少し薄くしたコピーの絵。phase は SorashidoCopyFx の段階。hit のとき anim(attackAnim)の技モーションで動く
function AiCopyBody({ src, phase = 'idle', hit = false, anim = null, size = 44 }) {
  if (!src) return null;
  const mon = src;
  const hitStyle = hit && anim ? { animation: attackMotionAnimation(anim) } : null;
  return (
    <span data-ai-copy-art data-ai-copy-hit={hitStyle ? '1' : undefined} className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size, zIndex: hitStyle ? 80 : undefined }}>
      <span style={hitStyle ? { position: 'relative', display: 'block', ...hitStyle } : { display: 'block' }}>
        <SorashidoCopyFx phase={phase}>
          <span style={{ display: 'block', opacity: 0.6, filter: 'drop-shadow(0 0 2px rgba(52,211,153,.95))' }}>
            <DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={`${mon.masuName || mon.name || ''}のコピー`} masuColors={mon.colors} style={{ width: `${size}px`, height: `${size}px` }} className="object-contain"/>
          </span>
        </SorashidoCopyFx>
      </span>
    </span>
  );
}
function AiCopyLifeBar({ hp, maxHp }) {
  if (!Number.isFinite(Number(hp)) || !(Number(maxHp) > 0)) return null;
  const now = Math.max(0, Math.floor(Number(hp))), max = Math.floor(Number(maxHp));
  return (
    <span data-ai-copy-life={`${now}/${max}`} className="block w-full min-w-0">
      <span className="flex h-[11px] items-center justify-between gap-1 leading-none">
        <span className="shrink-0 whitespace-nowrap text-[8px] font-black text-pink-300 max-[359px]:hidden">ライフ</span>
        <span className="font-mono leading-none whitespace-nowrap"><span className="text-[11px] font-black text-white">{now}</span><span className="text-[8px] text-slate-400">/{max}</span></span>
      </span>
      <span className="mt-px block h-[3px] overflow-hidden rounded-full bg-black/60">
        <span className="block h-full w-full origin-left bg-gradient-to-r from-rose-500 to-pink-300" style={{ transform: `scaleX(${Math.min(1, now / max)})` }}/>
      </span>
    </span>
  );
}
// タクティクス/レイドの5列目。縦=盤の右の列(layout 'portrait')、横向きの背の低い画面=盤の下の帯(layout 'landscape')
function TacticsAiCopyColumn({ copy, src, phase, hit, anim, skill, standing, layout, onOpen }) {
  if (!copy) return null;
  const land = layout === 'landscape';
  const name = tacticsAiCopyName(copy);
  const canOpen = typeof onOpen === 'function' && phase !== 'vanish';
  const next = standing ? <SorashidoNextCardBadge card={copy.nextCard || null} layout={land ? 'landscape' : 'portrait'} turnsLeft={copy.turnsLeft}/>
    : <span className="text-center text-[9px] font-black leading-tight text-emerald-300">次のターンから</span>;
  return (
    <div data-tactics-ai-copy-column={layout} data-ai-copy-phase={phase} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined}
      aria-label={`${name}${canOpen ? '。押すと手札を見る' : ''}`} onClick={canOpen ? onOpen : undefined}
      onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      className={`relative min-w-0 rounded-xl border border-emerald-400/60 bg-emerald-950/55 text-emerald-50 ${canOpen ? 'cursor-pointer' : ''} ${land ? 'flex h-[46px] w-full items-center gap-2 px-2' : 'flex h-full w-[72px] max-[359px]:w-[60px] shrink-0 flex-col items-center justify-between gap-0.5 px-1 max-[359px]:px-0.5 py-1'}`}>
      {skill && <span data-tactics-ai-copy-skill className={`absolute z-[90] max-w-[140px] truncate rounded-lg border border-red-200 bg-red-700 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_2px_10px_rgba(0,0,0,.7)] ${land ? 'left-1/2 -top-3 -translate-x-1/2' : 'right-1 top-1/3'}`}>{skill}</span>}
      <span className={`flex min-w-0 items-center gap-1 ${land ? 'w-[92px] shrink-0' : 'w-full flex-col'}`}>
        <AiCopyFace src={src} size={land ? 20 : 22}/>
        <span className={`min-w-0 overflow-hidden whitespace-nowrap font-black leading-tight text-emerald-200 [container-type:inline-size] ${land ? 'flex-1' : 'w-full text-center'}`}>
          <span className="block" style={{ fontSize: `min(10px, calc(100cqw / ${[...name].length + 0.3}))` }}>{name}</span>
        </span>
      </span>
      <AiCopyBody src={src} phase={phase} hit={hit} anim={anim} size={land ? 40 : 46}/>
      <span className={land ? 'w-[96px] shrink-0' : 'w-full'}><AiCopyLifeBar hp={copy.hp} maxHp={copy.maxHp}/></span>
      {/* 幅320の画面は列を60pxに詰める(4人の枠のライフの字が枠からはみ出さないように)。次に使う札もその幅に縮める */}
      <span className={land ? 'min-w-0 flex-1' : 'flex w-full min-w-0 justify-center max-[359px]:[&>*]:max-w-full max-[359px]:[&>*]:w-full'}>{next}</span>
    </div>
  );
}
// コピーのガッツ。数(G 今/上限)と横棒。色と字はパーティの「Ally Guts」と同じ(本編はライフをパーティで持つので、コピーが出しているのはガッツだけ)
function AiCopyGutsMeter({ guts, maxGuts }) {
  const g = Math.max(0, Math.floor(Number(guts) || 0)), m = Math.max(0, Math.floor(Number(maxGuts) || 0));
  const pct = m > 0 ? Math.max(0, Math.min(100, (g / m) * 100)) : 0;
  return (
    <span data-ai-copy-guts={`${g}/${m}`} className="flex w-full min-w-0 flex-col gap-[2px]">
      <span className="flex items-end justify-between gap-1 leading-none"><span className="text-[9px] font-black text-amber-400">G</span>
        <span className="font-mono text-[11px] font-black tabular-nums leading-none text-amber-200">{g}/{m}</span></span>
      <span className="block h-[6px] w-full overflow-hidden rounded-full border border-white/5 bg-slate-900"><span className="block h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{ width: `${pct}%` }}/></span>
    </span>
  );
}
// hitAnim … コピーが打っているあいだの attackAnim(attackAnim.aiCopy のとき。無ければ null)
function ClassicAiCopyCell({ copy, turnCount, onOpen, mon = null, hitAnim = null }) {
  if (!copy) return null;
  const phase = aiCopyViewPhase(copy, isAiCopyOut(copy, turnCount) ? 'idle' : 'appear');
  // 消えていく0.7秒(phase==='vanish')は、ターン切れで数え上は「出ていない」になっても出ていたときの札のまま描く
  const out = phase === 'vanish' || isAiCopyOut(copy, turnCount);
  const canOpen = typeof onOpen === 'function' && phase !== 'vanish';
  const layout = classicAiCopyLandscape() ? 'landscape' : 'portrait';
  const guts = Math.max(0, Math.floor(Number(copy.guts) || 0)), maxGuts = Math.max(0, Math.floor(Number(copy.maxGuts) || 0));
  return (
    <div data-ai-copy-cell={out ? 'out' : 'waiting'} data-ai-copy-phase={phase} aria-label={`${tacticsAiCopyName(copy)}(5人目の味方)${canOpen ? '。押すと手札を見る' : ''}`}
      role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} style={canOpen ? { cursor: 'pointer' } : undefined}
      onClick={canOpen ? onOpen : undefined} onKeyDown={canOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}>
      <style>{CLASSIC_AI_COPY_CSS}</style>
      <span data-ai-copy-head><AiCopyFace src={mon} size={20}/><span data-ai-copy-name>{copy.name || '仲間'}<wbr/>のコピー</span></span>
      {mon ? <AiCopyBody src={mon} phase={phase} hit={!!hitAnim} anim={hitAnim} size={layout === 'landscape' ? 26 : 40}/>
        : <SorashidoCopyFx phase={phase}><img src={SORASHIDO_FACE_ICON} alt="" aria-hidden="true" className="h-7 w-7 rounded-full object-cover bg-black/30" draggable="false"/></SorashidoCopyFx>}
      {out
        ? <><AiCopyGutsMeter guts={guts} maxGuts={maxGuts}/>
            <SorashidoNextCardBadge card={copy.nextCard || null} layout={layout} turnsLeft={copy.turnsLeft}/></>
        : <span className="text-center text-[9px] font-black leading-tight text-emerald-300">次のターン<br/>から</span>}
    </div>
  );
}
function BattleScreen({
  battleOverlayOpen = false, applyTurnDamageReduction, attackAnim, autoBattle, autoBattleRef, autoRepeat, battleFxSettings, onBattleFxAutoStep, battleIntimidate,
  battleScenarioRef, battleScreenActive, battleScreenStyle, battleSoulMasus, battleSpeed, battleTutorial,
  battleTutorialAllowsEmergency, battleTutorialCardAllowed, battleTutorialCardKind,
  battleTutorialCardTarget, battleTutorialNeed, battleTutorialNeedCard, battleTutorialSpotClass,
  battleTutorialStep, cardAssignments, cardDragActiveRef, cardEffectMultiplier, cardLimit, makeCardHalveCounter,
  cardNeedsMonster, cycleActiveUniqueForSlot, cycleBattleAuto, cycleBattleSpeed, cycleEcoMode,
  debugBattle, difficulty, dismissQuickRhythmIntro, distTotalBonus, dragOverSlot, dragState,
  ecoBattleView, ecoMode, effectiveMaxGuts, effectiveMaxHp, enemy, enemyAttackAnim,
  enemyAttackFx, enemyDist, enemyIntent, enemyNextIntent, enemyRevivalUsed, enemySkillName,
  extremeDifficulty, extremeRun, extremeRunRef, focusedCard, getAttackPredictedDmg,
  getAvailableUniquesForSlot, getCardGuts, getDmg, getIncomingDamageBeforeTurnReduction,
  getMasuMon, getNextTurnBuff, getPermaBuff, getTurnBuff, getWaveBuff, guardCardWeight, guardFx, guardImpact,
  guardLevel, guardValueOf, tacticsSlotGuardValue, guts, hand, heroCardBonus, heroDist, hp, iceLockActive,
  iceLockPreparing, iceLockTurns, isAssistCard, isAttackCard, isBusy, isHeroSlotMon,
  kikiCardBonus, liteBattleView, mainHero, openHelp, ownedUniques, pendingCard, pendingCardGuts,
  popups, previewLocalBoosts, processTurn, quickRhythmIntroVisible, quickToRhythmButtonNode, quickToCardButtonNode,
  renderQuickRunBattleBand, runMode, safeDifficulty, score, selectedCardGuts, selectedCards,
  setCardAssignments, setDragState, setFocusedCard, setPendingCard, setShowAutoBgmPicker,
  setShowBattleLog, setShowDeckInfo, setShowEnemyInfo, setShowHeroInfo, setShowQuitConfirm,
  setShowSoulBattleEffects, setSkillPicker, setSlotSettle, slotMaxUses, slotSettle, slotSkill,
  slotUniqueChoice, slots, soulBattleParty, soulCoordinationCardBonus, suppressCardClickRef,
  tacticsCanAssign, tacticsCardBlock, enemyDebuffs, battleUnitStatusOf, battleEnemyStatus, enemyStackCounts, debugStackMarks, tacticsSlotCountersAt, discardCards, actionUsed, tacticsCardGenre, tacticsCardScope, tacticsSlotFx, tacticsUnits,
  tacticsExInfo, activateTacticsEx, tacticsExCutin, hamCounterFx, skipHamCounterFx, tacticsExTurnUsed, passTacticsTurn, tacticsCoverSlot, tacticsHate, tacticsHateOn, aiCopy, aiCopyHitting = false,
  tacticsExIntroVisible, dismissTacticsExIntro, tacticsPandoraForms, trickStartView, kyubiOrihimeStackMarks, sweetStackView, bowStackView, fateWheelView, tacticsShields, enemyConfuseTurns, luckBanners,
  teachingFx, totalTurnCount, turnCount, ultimateDistanceBreakLevels, ultraBattleView, enemyDefeating,
  unifiedSpecialDefense, useEmergency, wave,
}) {
  // 強化の札を「アイコン1行」と「数値つきの一覧」で切り替える(2026-09-20 ユーザー指摘)。
  // ★いくつ付いても高さが変わらないようにするための状態。ここが無いと、
  //   札が3行4行に伸びて敵の絵・緊急のボタン・与ダメの数字を押し出す
  const [buffDetail, setBuffDetail] = useState(false);
  // ★味方の枠ごとの「マーク×数」(2026-10-12 社長の依頼)。{ 枠の番号: { kind: 数 } }。
  //   数の出どころは下の強化の札と同じ(クッキー・黒音符・旋律・トリックスタート・運命・連撃パワー)。既存5モードの 'party' は勇者モンの枠
  // 強化の札の中身(2026-10-13: 帯とモンスターの詳細の2か所で使うので関数にまとめた。文面と色はここ1か所)
  const battleBuffChips = () => {
            const chips=[];
            // ★`icon` という名前は使わない。カードの絵は cardIconNode() を通す決まりがあり、
            //   card-icon-check.js が `c.icon` をそのまま描く書き方を禁じている
            const chip=(key,mark,label,value,tone,opts)=>{const o=opts||{};chips.push({key,mark,label,value,tone,short:o.short!=null?o.short:value,pulse:!!o.pulse,glow:o.glow||'',owner:Number.isInteger(o.owner)?o.owner:null});};
            // owner … その子だけに効く札の枠の番号(モンスターの詳細で「この子の効果」に分ける)。全員に効く札は null
            const ownerOf=(key)=>key==='party'?heroDist:Number(key);
            const atkPct=Math.floor((getPermaBuff('atkPct')+getPermaBuff('muaAtkPct'))*100);
            if(atkPct>0) chip('atk',<Sword size={9}/>,'攻撃力',`+${atkPct}%`,'text-red-500 border-red-500/50');
            const dmgCutPct=Math.floor(getPermaBuff('dmgCutPct')*100);
            if(dmgCutPct>0) chip('dmgCut',<Shield size={9}/>,'被ダメ',`-${dmgCutPct}%`,'text-emerald-500 border-emerald-500/50');
            const defPct=Math.floor(getPermaBuff('defPct')*100);
            if(defPct>0) chip('def',<Shield size={9}/>,'丈夫さ',`+${defPct}%`,'text-emerald-500 border-emerald-500/50');
            const muaHpPct=Math.floor(getPermaBuff('muaHpPct')*100);
            if(muaHpPct>0) chip('muaHp',<Heart size={9}/>,'ライフ',`+${muaHpPct}%`,'text-pink-500 border-pink-500/50');
            const muaGutsPct=Math.floor(getPermaBuff('muaGutsPct')*100);
            if(muaGutsPct>0) chip('muaGuts',<Zap size={9}/>,'ガッツ',`+${muaGutsPct}%`,'text-amber-500 border-amber-500/50');
            const critRate=Math.round(getPermaBuff('critRatePct')*100);
            if(critRate>0) chip('critRate',<Sparkles size={9}/>,'クリ率',`+${critRate}%`,'text-yellow-400 border-yellow-400/50');
            const critDmg=Math.round(getPermaBuff('critDmgPct')*100);
            if(critDmg>0) chip('critDmg',<Sparkles size={9}/>,'クリダメ',`+${critDmg}%`,'text-yellow-400 border-yellow-400/50');
            const comboDmg=Math.round(getPermaBuff('comboDmgPct')*100);
            if(comboDmg>0) chip('combo',<Sword size={9}/>,'連撃',`+${comboDmg}%`,'text-cyan-400 border-cyan-400/50');
            if(getPermaBuff('globalComboDmgPct')>0) chip('globalCombo',<Sword size={9}/>,'全体連撃',`+${Math.round(getPermaBuff('globalComboDmgPct')*100)}%`,'text-sky-300 border-sky-300/50');
            if(kikiCardBonus>0) chip('kikiCard',<PlusCircle size={9}/>,'カード上限',`+1（残り${Math.ceil(getPermaBuff('kikiCardBonusTurns'))}T）`,'text-violet-300 border-violet-300/50',{short:'+1'});
            // きゅうこの譜面(2026-10-22)。受けるダメージダウンの残りターン(タクティクスは使った子だけに効く)
            if(getPermaBuff('kyukoCutTurns')>0&&getPermaBuff('kyukoCutRate')>0) chip('kyukoCut',<Shield size={9}/>,'被ダメ',`-${Math.round(getPermaBuff('kyukoCutRate')*100)}%（残り${Math.ceil(getPermaBuff('kyukoCutTurns'))}T）`,'text-pink-300 border-pink-300/50',{short:`-${Math.round(getPermaBuff('kyukoCutRate')*100)}%`});
            // ソードスキル(剣士モッチー)。連撃パワーは3たまるごとに永久追加連撃へ変わるので、
            // 両方が見えないと進み具合が分からない
            if(getPermaBuff('kenshiComboPower')>0||getPermaBuff('kenshiExtraCombo')>0){
              const kenshiExtra=getPermaBuff('kenshiExtraCombo');
              chip('kenshi',<Sword size={9}/>,'連撃パワー',
                `${getPermaBuff('kenshiComboPower')}/${KENSHI_COMBO_POWER_MAX}${kenshiExtra>0?`・追加連撃 +${kenshiExtra}`:''}`,
                'text-violet-300 border-violet-300/50',{short:`${getPermaBuff('kenshiComboPower')}/${KENSHI_COMBO_POWER_MAX}`});
            }
            chip('autoHp',<Heart size={9}/>,'ライフ回復',`${Math.round(getPermaBuff('autoHpRecovery',0.1)*100)}%`,
              getPermaBuff('autoHpRecovery',0.1)>=0.1?'text-rose-400 border-rose-400/50':'text-red-400 border-red-400/50');
            chip('autoGuts',<Zap size={9}/>,'ガッツ回復',
              `${Math.round(applyIceRulerAutoGutsRecovery(Math.max(0,0.05+(getPermaBuff('autoHpRecovery',0.1)-0.1))+getPermaBuff('gutsRecoverPct'),mainHero?.id,iceLockActive,heroDist,enemyDist)*100)}%`,
              'text-amber-400 border-amber-400/50');
            // ポルツの待機。あと何回ぶん敵の攻撃で発動するかを出す(0になったら消える。得た効果は残る)
            if(getPermaBuff('poltzCharges')>0) chip('poltz',<Zap size={9}/>,BREEDER_EVO_NAMES.poltz[Math.max(0,Math.min(getPermaBuff('poltzTier'),2))],`×${Math.floor(getPermaBuff('poltzCharges'))}`,'text-lime-300 border-lime-400/50',{pulse:true});
            // トリックスタート(ゴースト・スプーキー)で積んだもの。WAVEのあいだだけ残る。
            //   既存5モードはパーティに1つ('party')、タクティクスは持っている子ごと(枠の番号)
            Object.entries(trickStartView||{}).forEach(([key,st])=>{
              const parts=[st?.atk>0?`ち+${st.atk*20}%`:null,st?.def>0?`丈+${st.def*20}%`:null,st?.regen>0?`回+${st.regen*5}%`:null].filter(Boolean);
              if(!parts.length) return;
              const who=key==='party'?'':(slots[Number(key)]?.name||'');
              chip(`trick${key}`,<Sparkles size={9}/>,`${who}トリック`,parts.join(' '),'text-violet-300 border-violet-400/50',{short:parts.join(' '),owner:ownerOf(key)});
            });
            // メロディーのクッキー・クロミーの黒音符(勇者特性)。ランのあいだ持ち越す。
            //   既存5モードはパーティに1つ('party')、タクティクスは持っている子ごと(枠の番号)。値は いまの数/上限 と効いている段階
            Object.entries(sweetStackView||{}).forEach(([key,n])=>{
              const ownerId=key==='party'?mainHero?.id:slots[Number(key)]?.id;
              const trait=sweetStackTraitOf(ownerId), count=sweetStackCountOf(n);
              if(!trait||count<=0) return;
              const who=key==='party'?'':(slots[Number(key)]?.name||'');
              chip(`sweet${key}`,<Sparkles size={9}/>,`${who}${trait.label}`,`${trait.icon}${count}/${SWEET_STACK_MAX} ${sweetStackEffectText(ownerId,count)}`,
                trait.kind==='cookie'?'text-pink-300 border-pink-400/50':'text-fuchsia-300 border-fuchsia-400/50',{short:`${trait.icon}${count}/${SWEET_STACK_MAX}`,owner:ownerOf(key),pulse:count>=SWEET_STACK_MAX,
                // ★クッキーが満タン(EXの使いどき)は、点滅だけだと目立たない。ピンクの光の縁取りも付ける(2026-10-09 ユーザー指示「クッキーが満タンで光る」)
                glow:trait.kind==='cookie'&&count>=SWEET_STACK_MAX?'mh-cookie-full':''});
            });
            // メロディ・ボゥの旋律(クロミーの固有技)で積んだ与ダメ。使った子の枠ごと。ランが終わるまで残る
            Object.entries(bowStackView||{}).forEach(([key,n])=>{
              const c=Math.max(0,Math.floor(Number(n)||0));
              if(c>0) chip(`bow${key}`,<Sword size={9}/>,`${slots[Number(key)]?.name||''}旋律`,`与ダメ+${c*5}%`,'text-fuchsia-300 border-fuchsia-400/50',{short:`+${c*5}%`,owner:ownerOf(key)});
            });
            // 運命のコイン・運命の輪(ゴースト・スプーキー)で積んだもの。ランが終わるまで残る(その子の攻撃だけに効く)
            {
              const fate=getPermaBuff('fateStacks',null);
              Object.keys(fate?.bySlot||{}).forEach(key=>{
                const st=fateSlotStacksOf(fate,key);
                const parts=[st.combo>0?`連撃+${st.combo*10}%`:null,st.atk>0?`ち+${st.atk*15}%`:null].filter(Boolean);
                if(parts.length) chip(`fate${key}`,<Star size={9}/>,`${slots[Number(key)]?.name||''}運命`,parts.join(' '),'text-amber-300 border-amber-400/50',{short:parts.join(' '),owner:ownerOf(key)});
              });
              if(fateCount(fate?.coinGuts)>0) chip('fateCoinGuts',<Zap size={9}/>,'運命のコイン消費',`+${fateCount(fate.coinGuts)*20}%`,'text-slate-300 border-slate-400/50');
            }
            // === ターン限定バフ（都度表示） ===
            if(getNextTurnBuff('melosoFullRecoveryMult',0)>0) chip('meloso',<Heart size={9}/>,'次ターン全回復','','text-rose-300 border-rose-400/50',{pulse:true});
            if(getTurnBuff('atkMult',1.0)>1) chip('boost',<Sparkles size={9}/>,'Boost',`x${getTurnBuff('atkMult',1.0).toFixed(1)}`,'text-red-500 border-red-500/50',{pulse:true});
            if(getTurnBuff('guaranteedCrit',false)) chip('critFix',<Target size={9}/>,'会心予約','','text-orange-400 border-orange-500/50',{pulse:true});
            if(getTurnBuff('zeroGuts',false)||getNextTurnBuff('zeroGuts',false)) chip('zeroGuts',<Star size={9}/>,'0消費中','','text-blue-400 border-blue-500/50',{pulse:true});
            if(getNextTurnBuff('reflect',false)) chip('reflectNext',<RefreshCcw size={9}/>,'次反射','','text-purple-400 border-purple-500/50',{pulse:true});
            if(getTurnBuff('reflect',false)) chip('reflectNow',<RefreshCcw size={9}/>,'反射待機','','text-purple-300 border-purple-400',{pulse:true});
            // 敵の咆哮(2026-09-20 ユーザー指摘「咆哮の効果が分からない」)。
            // ★ポップアップは一瞬で消えるので、いま何回かかっているかがどこにも出ていなかった。
            //   敵の攻撃そのものを上げる(元に戻らない)ので、札に出し続ける
            if(getNextTurnBuff('takenDamageMult',1.0)<1) chip('takenNext',<Shield size={9}/>,'次T被ダメ',`-${Math.round((1-getNextTurnBuff('takenDamageMult',1.0))*100)}%`,'text-pink-400 border-pink-500/50',{pulse:true});
            if(getTurnBuff('takenDamageMult',1.0)<1) chip('takenNow',<Shield size={9}/>,'被ダメ',`-${Math.round((1-getTurnBuff('takenDamageMult',1.0))*100)}%`,'text-pink-300 border-pink-400',{pulse:true});
            if(getNextTurnBuff('gutsCostMult',1.0)>1) chip('costNext',<Zap size={9}/>,'次ターン消費ガッツ',`+${Math.round((getNextTurnBuff('gutsCostMult',1.0)-1)*100)}%`,'text-amber-400 border-amber-500/50',{pulse:true});
            if(getTurnBuff('gutsCostMult',1.0)>1) chip('costNow',<Zap size={9}/>,'消費ガッツ',`+${Math.round((getTurnBuff('gutsCostMult',1.0)-1)*100)}%`,'text-amber-300 border-amber-400',{pulse:true});
            return chips;
  };
  const allyStackCounts = (() => {
    const out = {};
    const put = (i, kind, n, keepZero = false) => {
      if (!Number.isInteger(i) || i < 0) return;
      const c = Math.max(0, Math.floor(Number(n) || 0));
      if (c <= 0 && !keepZero) return;
      out[i] = { ...(out[i] || {}), [kind]: ((out[i] && out[i][kind]) || 0) + c };
    };
    const slotOfKey = (key) => (key === 'party' ? heroDist : Number(key));
    // クッキー・黒音符は、その特性の持ち主なら0個でも出す(既存5モードは勇者モン、タクティクスは持っている子の枠)
    if (Array.isArray(tacticsUnits)) slots.forEach((m, i) => { const t = sweetStackTraitOf(m?.id); if (t) put(i, t.kind === 'cookie' ? 'cookie' : 'note', 0, true); });
    else { const t = sweetStackTraitOf(mainHero?.id); if (t) put(heroDist, t.kind === 'cookie' ? 'cookie' : 'note', 0, true); }
    Object.entries(sweetStackView || {}).forEach(([key, n]) => {
      const i = slotOfKey(key), t = sweetStackTraitOf(key === 'party' ? mainHero?.id : slots[i]?.id);
      if (t) put(i, t.kind === 'cookie' ? 'cookie' : 'note', sweetStackCountOf(n), true);
    });
    Object.entries(bowStackView || {}).forEach(([key, n]) => put(Number(key), 'bow', n));
    Object.entries(trickStartView || {}).forEach(([key, st]) => { const i = slotOfKey(key); put(i, 'trickAtk', st?.atk); put(i, 'trickDef', st?.def); put(i, 'trickRegen', st?.regen); });
    const fate = getPermaBuff('fateStacks', null);
    Object.keys(fate?.bySlot || {}).forEach((key) => { const st = fateSlotStacksOf(fate, key); put(Number(key), 'fateCombo', st.combo); put(Number(key), 'fateAtk', st.atk); });
    if (getPermaBuff('kenshiComboPower') > 0) { const k = slots.findIndex((m) => m?.id === 'KenshiMocchi'); put(k >= 0 ? k : heroDist, 'kenshi', getPermaBuff('kenshiComboPower')); }
    // タクティクスのEXの残りターン・完全回避・根性の残り(2026-10-12 社長の追加依頼)
    if (typeof tacticsSlotCountersAt === 'function') slots.forEach((m, i) => { if (!m) return; const c = tacticsSlotCountersAt(i) || {}; put(i, 'exTurns', c.exTurns); put(i, 'avoid', c.avoid); put(i, 'konjo', c.konjo); });
    // キュービ・オリヒメ(煉獄・陽炎・狐火・逢瀬・星合・霊魂。2026-10-27)。数は 60-app の kyubiOrihimeStackMarks
    Object.entries(kyubiOrihimeStackMarks || {}).forEach(([i, c]) => Object.entries(c || {}).forEach(([kind, n]) => put(Number(i), kind, n)));
    if (debugStackMarks && debugStackMarks.ally) Object.entries(debugStackMarks.ally).forEach(([i, c]) => { out[Number(i)] = { ...(c || {}) }; });
    return out;
  })();
  // 敵のデバフの詳細(名前の横の簡易表示を押すと開く)
  const [enemyDebuffOpen, setEnemyDebuffOpen] = useState(false);
  // レイドバトル(A)のターンごとの強化の表示(2026-10-04・ユーザー指示「ターン毎の強化がもうちょいわかるような表示がほしい」)。
  // 敵のライフの下に「いまの強化」を1行で出し、タップで内訳を開く。強化が入ったターンは、真ん中の上に数秒だけ帯を出す。
  // 数字は 35-raid-jack.jsx の raidJackGrowthAt(戦闘本体と同じ定数)から出す。グランドスラム(B)は強化が無いので出さない
  const raidGrowthOn = runMode === BATTLE_MODE_RAID_JACK_A;
  const raidGrowth = raidGrowthOn ? raidJackGrowthAt(turnCount) : null;
  const [raidGrowthOpen, setRaidGrowthOpen] = useState(false);
  const [raidGrowthBanner, setRaidGrowthBanner] = useState(null);
  useEffect(() => {
    if (!raidGrowthOn || turnCount < 2) { setRaidGrowthBanner(null); return undefined; }
    setRaidGrowthBanner({ turn: turnCount, key: `${turnCount}-${Date.now()}` });
    const timer = setTimeout(() => setRaidGrowthBanner(null), 3200);
    return () => clearTimeout(timer);
  }, [raidGrowthOn, turnCount]);
  // 攻撃する子から敵までのずれ(24-battle-fx.jsx の measureAttackAim)。
  // ★描画の前(レイアウト直後)に測るので、最初のコマから敵の向きへ飛ぶ。見た目だけに使う
  const [attackAim, setAttackAim] = useState(null);
  React.useLayoutEffect(()=>{
    if(!attackAnim||ecoBattleView) return;
    const aim=measureAttackAim(attackAnim.slotIndex);
    setAttackAim(prev=>(prev&&aim&&prev.slotIndex===aim.slotIndex&&prev.dx===aim.dx&&prev.dy===aim.dy)?prev:aim);
  },[attackAnim,ecoBattleView]);
  // バトル中の設定メニュー(2026-09-22 ユーザー指示「BGMは右上に設定ボタンみたいの作って
  // そこにギブアップとかヘルプとかと一緒にまとめて」)。
  // ★ヘッダーに3つ並べていた入口(ヘルプ・あきらめる)とBGMを1つにまとめる。
  //   どれもバトル中に何度も押すものではないので、1枚めくる形にしても手が止まらない
  const [showBattleMenu, setShowBattleMenu] = useState(false);
  // ★タクティクス専用 EXスキルの詳細を開いている枠。距離枠をタップすると開く(開くだけで発動はしない)。
  //   中身は毎回 tacticsExInfo から引き直す(回数・使えるかは開いたあとも変わるため、開いた時点の値を持たない)
  const [exPanelSlot, setExPanelSlotRaw] = useState(null);
  // スタイル式のEX(ソード・コンバージョン)は「EXスキルを使用」のあとに選択肢を出す。開き直したら選ぶ前に戻す
  const [exChoosing, setExChoosing] = useState(false);
  // EX の窓の中の切り替え。'ex' … EXスキル / 'status' … 能力・かかっている効果(2026-10-13)。開くたびに EXスキルから
  const [exTab, setExTab] = useState('ex');
  const setExPanelSlot = (slot) => { setExChoosing(false); setExTab('ex'); setExPanelSlotRaw(slot); };
  // タクティクス以外の味方・敵を押したときの詳細。{ side:'ally', slot } | { side:'enemy' } | null
  const [unitDetail, setUnitDetail] = useState(null);
  const exPanel = exPanelSlot!=null&&tacticsExInfo ? tacticsExInfo(exPanelSlot) : null;
  // タクティクスの戦闘ロジックは旧/新UIで共通。ここでは表示だけを設定値で切り替える。
  // tacticsUnits の有無は「タクティクス戦か」の判定として維持し、CLASSICでは新UIを出さない。
  const tacticsNewLayout = Array.isArray(tacticsUnits) && normalizeBattleScreenStyle(battleScreenStyle) === 'TACTICS_NEW';
  // AIコピー(5つの遊び)の札。aiCopy は公開の印が偽なら null。タクティクスの札は盤の側(data-tactics-ai-copy)
  //   コピーの手札の窓は5つの遊びの札・タクティクスの札(data-tactics-ai-copy)の両方から開くので、ここに1つだけ置く。
  //   消えるとき(ターン切れ・WAVE の始めで aiCopy が null になったとき)は、直前の形を0.7秒だけ fx='vanish' で描いてから消す(60 は触らない)。
  //   公開の印が偽なら aiCopy はずっと null なので、どちらも何も出さない
  const [copyHandOpen, setCopyHandOpen] = useState(false);
  const [copyGhost, setCopyGhost] = useState(null);
  const copyPrevRef = useRef(null);
  useEffect(() => {
    if (aiCopy) { copyPrevRef.current = aiCopy; setCopyGhost(null); return undefined; }
    const prev = copyPrevRef.current;
    copyPrevRef.current = null;
    setCopyHandOpen(false);
    if (!prev) return undefined;
    setCopyGhost({ ...prev, fx: 'vanish' });
    const timer = setTimeout(() => setCopyGhost(null), 700);
    return () => clearTimeout(timer);
  }, [aiCopy]);
  const shownAiCopy = aiCopy || copyGhost;
  // タクティクス/レイドで空いたマスが無いとき(コピーが元の子に重なるとき)と、タクティクス旧の盤では、コピーを盤の外の5列目に出す
  const tacticsCopyOutside = !!(Array.isArray(tacticsUnits) && shownAiCopy && (normalizeBattleScreenStyle(battleScreenStyle) !== 'TACTICS_NEW'
    || shownAiCopy.stacked || (Array.isArray(slots) && slots.length > 0 && slots.every(Boolean))));
  const classicAiCopy = !Array.isArray(tacticsUnits) ? (shownAiCopy || null) : null;
  // 設定の「待機中の動き：止める」と「画面の揺れ：揺らさない」(見た目だけ。攻撃の演出と情報は消さない)
  const battleFx = normalizeBattleFxSettings(battleFxSettings);
  // 画面の軽さ(豪華/標準/軽め/最軽量)。最軽量は 60-app が liteBattleView(軽量表示)にしてから渡してくる。
  // 軽めは「待機中の動き：止める」と同じく、敵と味方の待機の動きを止める
  const fxLoad = battleFx.load;
  // 操作がないときの一時停止(バトル設定。既定は止めない)
  const fxRestEnabled = battleFx.restPause === 'ON';
  const idleMotionOff = battleFx.idleMotion === 'OFF' || fxLoad === 'LIGHT';
  const shakeOff = battleFx.shake === 'OFF';
  // 敵の攻撃(ためるを含む)を絵だけで動かす場面。移動とムーは今までどおり丸枠ごと
  const enemyImageOnlyAttack = tacticsNewLayout && !!enemyAttackAnim && !ecoBattleView && enemyAttackFx?.kind !== 'move' && !isMooBoss(enemy?.id);
  // 敵ごとの動き方(2026-09-24 ユーザー指示「敵のグラフィックを攻撃時にアニメーション化」「待機時間も動いてるように」
  // 「まずはカワズモーで」「タクティクスだけ」)。絵は1枚のまま、待機・攻撃・ためる・やられの動きを CSS で付ける。
  // ★ここに無い敵は今までどおり。足すときは TACTICS_ENEMY_MOTIONS に1行と、70-bootstrap の CSS を足す
  const enemyMotion = tacticsNewLayout && !ecoBattleView ? (TACTICS_ENEMY_MOTIONS[enemy?.raidJackPumpkin ? 'Pumpkin' : enemy?.id] || null) : null;
  // 必殺技ムービーを持つ敵との戦いに入ったら、読み込みを始めておく(流すのは 60-app が決める)。
  // ★設定で「流さない」にしている人・省エネの軽量表示では読まない(通信量を使わせない)
  const bossMovieSrc = battleFx.specialMovie === 'ON' && !ecoBattleView && typeof enemy?.specialMovie === 'string' ? enemy.specialMovie : null;
  useEffect(() => { if (bossMovieSrc) preloadBossMovie(bossMovieSrc); }, [bossMovieSrc]);
  // ★何も起きていない間は、画面の動きを一時停止する(2026-09-24 ユーザー指摘「発熱がすごい」「熱くなるとカクついて動かなくなる」)。
  //   待機中の飾り・敵と味方の待機の動きは、1つでも動いていると GPU が毎コマ画面を合成し直す(スマホが熱を持つ)。
  //   タップ・戦闘の進行が TACTICS_FX_REST_MS 無ければ data-fx-rest を立て、CSS が animation-play-state:paused にする。
  //   触る・何かが起きると、止まった場所からそのまま動き出す(はじめからやり直さない)
  const [fxRest, setFxRest] = useState(false);
  const fxRestTimerRef = useRef(null);
  const fxBusyRef = useRef(false);
  fxBusyRef.current = !!(isBusy || attackAnim || enemyAttackAnim || enemyAttackFx);
  const fxRestEnabledRef = useRef(fxRestEnabled);
  fxRestEnabledRef.current = fxRestEnabled;
  const wakeBattleFx = useCallback(() => {
    setFxRest(false);
    if (fxRestTimerRef.current) clearTimeout(fxRestTimerRef.current);
    // 設定で「止めない」のときは、タイマーそのものを置かない(再描画も起こさない)
    if (!fxRestEnabledRef.current) return;
    const arm = () => { fxRestTimerRef.current = setTimeout(() => { if (!fxRestEnabledRef.current) return; if (fxBusyRef.current) arm(); else setFxRest(true); }, TACTICS_FX_REST_MS); };
    arm();
  }, []);
  useEffect(() => { if (tacticsNewLayout) wakeBattleFx(); }, [tacticsNewLayout, fxRestEnabled, isBusy, attackAnim, enemyAttackAnim, enemyAttackFx, popups, enemy?.hp, enemyIntent, wakeBattleFx]);
  useEffect(() => {
    if (!tacticsNewLayout || typeof document === 'undefined') return undefined;
    const onTouch = () => wakeBattleFx();
    document.addEventListener('pointerdown', onTouch, true);
    document.addEventListener('keydown', onTouch, true);
    return () => {
      document.removeEventListener('pointerdown', onTouch, true);
      document.removeEventListener('keydown', onTouch, true);
      if (fxRestTimerRef.current) clearTimeout(fxRestTimerRef.current);
    };
  }, [tacticsNewLayout, wakeBattleFx]);
  // 重さの見張り(上の BATTLE_AUTO_LOAD_* を参照)。自動で下げるのは設定「重いときは自動で軽く」が ON のときだけ。
  // 性能計測(デバッグ)が ON なら、下げるものが無くても見張って数える
  const fxLoadIndex = BATTLE_FX_LOADS.indexOf(fxLoad);
  const autoLoadOn = tacticsNewLayout && !ecoBattleView && battleFx.autoLoad !== 'OFF' && typeof onBattleFxAutoStep === 'function'
    && fxLoadIndex >= 0 && fxLoadIndex < BATTLE_FX_LOADS.indexOf(BATTLE_AUTO_LOAD_FLOOR);
  const [perfOn] = useState(() => BATTLE_PERF.enabled);
  const watchFrames = tacticsNewLayout && !(fxRestEnabled && fxRest) && (autoLoadOn || perfOn);
  const autoLoadRef = useRef(null);
  autoLoadRef.current = autoLoadOn ? { from: fxLoad, to: BATTLE_FX_LOADS[fxLoadIndex + 1], step: onBattleFxAutoStep } : null;
  useEffect(() => {
    if (!watchFrames || typeof requestAnimationFrame !== 'function') return undefined;
    let raf = 0, begin = 0, stepped = false;
    const w = { last: 0, start: 0, frames: 0, slow: 0, minGap: 1e9 };
    const tick = (now) => {
      BATTLE_PERF.frame(now);
      const auto = autoLoadRef.current;
      if (auto && !stepped) {
        if (!begin) begin = now;
        const gap = w.last ? now - w.last : 0;
        w.last = now;
        if (now - begin >= BATTLE_AUTO_LOAD_WARMUP_MS) {
          if (!w.start) w.start = now;
          else if (gap > 0 && gap < 1000) { w.frames++; if (gap >= 5 && gap < w.minGap) w.minGap = gap; if (battleSlowFrame(gap, w.minGap)) w.slow++; }
          if (now - w.start >= BATTLE_AUTO_LOAD_WINDOW_MS) {
            if (w.frames >= BATTLE_AUTO_LOAD_MIN_FRAMES && w.slow / w.frames > BATTLE_AUTO_LOAD_SLOW_RATIO && auto.to) {
              // ★一段下げたら、この見張りはそこで終わる。軽さが変わると作り直され、立ち上がりの詰まりを数えずに見張り直す
              stepped = true;
              BATTLE_PERF.autoStep(auto.from, auto.to, w.slow, w.frames);
              auto.step(auto.to);
            }
            w.start = now; w.frames = 0; w.slow = 0;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); BATTLE_PERF.pause(); };
  }, [watchFrames, fxLoad]);
  // 性能計測のパネル(デバッグで ON にしたときだけ)。1秒ごとに要約を読み直す
  const [perfSnap, setPerfSnap] = useState(null);
  useEffect(() => {
    if (!perfOn || !tacticsNewLayout) return undefined;
    const id = setInterval(() => setPerfSnap(BATTLE_PERF.snapshot()), 1000);
    return () => clearInterval(id);
  }, [perfOn, tacticsNewLayout]);
  // いま動いている技(data-enemy-skill)。ムーは丸枠ではなく枠の外の大きな絵が動く
  const enemyIsMoo = isMooBoss(enemy?.id);
  const enemySkillNow = enemyMotion && enemyAttackFx?.skill
    && (enemyImageOnlyAttack || enemyAttackFx.kind === 'regen' || (enemyIsMoo && !!enemyAttackAnim)) ? enemyAttackFx.skill : null;
  // 共通の部品で動かす敵(カワズモー以外)の組み合わせ
  const emSet = enemyMotion ? (TACTICS_ENEMY_MOTION_SETS[enemyMotion] || null) : null;
  const emSpec = emSet && enemySkillNow ? (emSet.skills[enemySkillNow] || null) : null;
  // ジャックの両腕ポーズ絵は、腕が左右へ広がるぶん、同じ枠に収めると本体が幅の約49%(通常絵は約99%)。
  // 切り替わっても本体の大きさがそろうよう、ポーズは枠いっぱい、通常絵は半分(RAID_JACK_NORMAL_ART_SCALE)で描く(2026-10-04・ユーザー指示)。
  // 通常絵は枠の真ん中へ、ポーズ絵は本体が下寄りなので少し上へ寄せて、本体の位置もそろえる
  const JACK_NORMAL_BATTLE_STYLE = { width:`${RAID_JACK_NORMAL_ART_SCALE * 100}%`, height:`${RAID_JACK_NORMAL_ART_SCALE * 100}%`, marginLeft:`${(1 - RAID_JACK_NORMAL_ART_SCALE) * 50}%`, marginTop:`${(1 - RAID_JACK_NORMAL_ART_SCALE) * 50}%` };
  const JACK_POSE_BATTLE_STYLE = { width:'100%', height:'100%', marginTop:'-6%' };
  // 小さなぱんぷきんは、腕の無い丸い絵を、ジャックの通常絵より少し小さく真ん中へ置く(ポーズ絵なし)
  const PUMPKIN_BATTLE_STYLE = { width:`${RAID_JACK_PUMPKIN_ART_SCALE * 100}%`, height:`${RAID_JACK_PUMPKIN_ART_SCALE * 100}%`, marginLeft:`${(1 - RAID_JACK_PUMPKIN_ART_SCALE) * 50}%`, marginTop:`${(1 - RAID_JACK_PUMPKIN_ART_SCALE) * 50}%` };
  // ジャックは「腕を振る・両腕を上げる・必殺技」のとき、両腕を上げたポーズの絵に切り替わる
  // ジャックのオーラ: 段階(a1〜a5 / b1〜b5)の数字が大きいほど派手になる。見た目は CSS(data-jack-aura)
  const jackAuraTier = (enemy?.id === 'Jack' && !enemy.raidJackPumpkin) ? (Number(String(enemy.raidJackTier || '').slice(1)) || 0) : 0;
  const enemyBossImgSrc = (enemy?.id === 'Jack' && enemy.poseImgUrl && ['normal', 'roar', 'special'].includes(enemySkillNow)) ? enemy.poseImgUrl : enemy?.imgUrl;
  const emFxStyle = emSpec && emSpec[2] ? { '--em-e': JSON.stringify(emSpec[2]) } : undefined;
  const enemyHurtNow = !!(enemyMotion && attackAnim && !enemyAttackAnim);
  // 絵を明るく光らせる板(data-enemy-flash)。同じ絵を明るくした複製を重ね、濃さだけを変える。
  // ★切り抜き(mask)と重ね方(mix-blend-mode)は使わない。iPhone で切り抜きが外れると、光るたびに四角い板が出てしまう
  //   (2026-09-24 ユーザー報告「他にも絶対バグる要因あるからちゃんと見つけてなおして」)。
  //   ふだんは置かない(光るあいだだけ置く)ので、層も増えない
  const enemyFlashOn = !!(enemyMotion && enemy?.imgUrl && (enemySkillNow || enemyHurtNow));
  // ★ジャックは、本体の絵(通常絵/ポーズ絵)と同じ絵・同じ大きさの指定で重ねる。通常絵を枠いっぱいで重ねると、
  //   本体(通常絵は半分の大きさ・ポーズ絵は枠いっぱい)と大きさのちがう絵が攻撃のたびに混ざって見える(2026-10-04 ユーザー指摘)
  const enemyFlashIsJack = enemy?.id === 'Jack';
  const enemyJackArtStyle = enemy?.raidJackPumpkin ? PUMPKIN_BATTLE_STYLE : (enemyBossImgSrc !== enemy?.imgUrl ? JACK_POSE_BATTLE_STYLE : JACK_NORMAL_BATTLE_STYLE);
  const enemyFlashNode = enemyFlashOn ? <img data-enemy-flash src={enemyFlashIsJack ? enemyBossImgSrc : enemy.imgUrl} alt="" aria-hidden="true" draggable={false}
    style={enemyFlashIsJack ? enemyJackArtStyle : undefined}/> : null;
  // 技の実際の長さ(戦闘の速さを掛けたもの)。CSS の動きは --em-dur を見るので、2倍速・4倍速でも途中で切れない
  const emDurStyle = enemySkillNow && Number.isFinite(enemyAttackFx?.ms) && enemyAttackFx.ms > 0 ? { '--em-dur': `${enemyAttackFx.ms}ms` } : {};
  // ★いま狙われている枠(2026-09-21 ユーザー指摘「誰に攻撃か分からない」)。
  //   間合い攻撃は相手を1体決めず「予告した間合いに立っている子」へ当たるので、
  //   ほかの技と違って targetName を持たない。予告を見ても間合いしか分からなかった。
  // ★数え方は本番と同じ tacticsIntentTargets を通す。別に書くと、距離撃でずらしたときに
  //   予告と実際がずれる(「当たらないはずの枠が光る」)
  const rawAimedSlots = Array.isArray(tacticsUnits) && enemyIntent
    ? tacticsIntentTargets(enemyIntent, tacticsUnits, enemyDist) : [];
  // ★EX「みんなをかばう」が効いているターンは、狙いがかばう子へまとまる(本番と同じ coverTacticsTargets)。
  //   全体攻撃なら、本来当たるはずだった人数ぶんをその子が受ける
  const coverActive = Number.isInteger(tacticsCoverSlot) && rawAimedSlots.length > 0;
  const coverHitCount = coverActive ? rawAimedSlots.length : 1;
  const aimedSlots = coverActive ? [tacticsCoverSlot] : rawAimedSlots;
  const aimedName = (coverActive ? `${tacticsTargetName(tacticsUnits, tacticsCoverSlot)}（かばう）` : null)
    || enemyIntent?.targetName
    || (aimedSlots.length ? aimedSlots.map(idx => tacticsTargetName(tacticsUnits, idx)).join('・')
      : (enemyIntent?.variant === 'sweep' ? 'だれもいない' : ''));
  // 1体ぶんの「このターン減る量」。予告の吹き出しと、枠ごとの表示の両方がここを通る。
  // ★slotIdx を渡すと**その子の丈夫さ**と**その子へ置いたガード**で数える。
  //   全体攻撃は立っている全員に当たり、受ける量は丈夫さで1体ずつ変わるのに、
  //   吹き出しの1つの数字では誰がどれだけ減るのか分からなかった
  //   (2026-09-21 ユーザー依頼「全体攻撃はモンスターごとにダメージが変わるはずだから
  //   それを分かるようにして」)。ガードも枠ごとなのに全部まとめて数えていた。
  // ★slotIdx が null のときは今までどおりパーティの値(既存5モード)
  // ★予告と実行で数え方がずれると「ガードしたのに予定より減った」になるので、
  //   受け方は本番と同じ resolveTacticsGuardedHit を通す
  // ★ガードは枠ごとにまとめてから数える(2026-09-22 の新仕様)。全体ガードかどうかは
  //   「何体が別々に構えたか」で決まるので、1枠だけ見ても分からない。
  //   何枚目かの数え方はアプリ側(makeCardHalveCounter)が持つ。枠を絞るのは集計のときだけで、
  //   半減の数えは全カードを順に通す
  const plannedGuardBySlot = () => {
    const bySlot = {};
    const counter = makeCardHalveCounter();
    selectedCards.forEach(idx => {
      const card = hand[idx];
      const slotIdx = cardAssignments[idx] != null ? cardAssignments[idx] : null;
      const halved = counter.take(card, slotIdx);
      const w = guardCardWeight(card);
      if (!(w > 0) || slotIdx == null) return;
      const effect = cardEffectMultiplier(card, halved);
      const entry = bySlot[slotIdx] || (bySlot[slotIdx] = { flat: 0, mult: 0, weight: 0, cards: 0 });
      entry.flat += GUARD_EVOLUTION[guardLevel].flat * w * effect;
      entry.mult += GUARD_EVOLUTION[guardLevel].mult * w * effect;
      entry.weight += w;
      entry.cards += 1;
    });
    return bySlot;
  };
  // 上の2つ(ガードのまとめ・先に選んだカードの補正)は、1回の描画のなかでは入力が同じで
  // 返り値も読むだけなので、枠ごと・発ごとに作り直さず最初の1回を使い回す
  // ガードのバリアを構えているか。タクティクスは枠ごと(全体ガードで丈夫さぶんが付く子も含む・倒れた子は除く)、
  // 既存5モードはガードがパーティ全体なので、ガードのカードを選んでいれば全員の枠
  const partyGuardSelected = !Array.isArray(tacticsUnits) && selectedCards.some(idx => guardCardWeight(hand[idx]) > 0);
  const guardBarrierOnAt = (slotIdx) => {
    if (!Array.isArray(tacticsUnits)) return partyGuardSelected;
    const unit = tacticsUnits[slotIdx];
    if (!unit || !(Number(unit.hp) > 0)) return false;
    return tacticsSlotGuardValue(guardPlanOnce(), slotIdx) > 0;
  };
  let guardPlanOnceCache;
  const guardPlanOnce = () => (guardPlanOnceCache === undefined ? (guardPlanOnceCache = plannedGuardBySlot()) : guardPlanOnceCache);
  const previewBoostsOnceCache = new Map();
  const previewBoostsOnce = (excludeIdx) => {
    if (!previewBoostsOnceCache.has(excludeIdx)) previewBoostsOnceCache.set(excludeIdx, previewLocalBoosts(excludeIdx));
    return previewBoostsOnceCache.get(excludeIdx);
  };
  // 手札1枚ごとに「ほかに選んだカードのガッツ」を数えるので、選んだカードのガッツは描画ごとに1回だけ求める
  let selectedGutsListCache;
  const selectedGutsListOnce = () => (selectedGutsListCache || (selectedGutsListCache = selectedCards.map(idx => [idx, selectedCardGuts(idx)])));
  // 置ける枠かどうか(タクティクス)も、合計DMG欄と枠ごとの表示で同じ問いを2回していたので1回にする
  const canAssignOnceCache = new Map();
  const tacticsCanAssignOnce = (card, cardIndex, slotIdx) => {
    const key = `${cardIndex}:${slotIdx}`;
    const hit = canAssignOnceCache.get(key);
    if (hit && hit.card === card) return hit.answer;
    const answer = tacticsCanAssign(card, cardIndex, slotIdx);
    canAssignOnceCache.set(key, { card, answer });
    return answer;
  };
  // ★連撃は「1発ずつ」出す(2026-09-22 ユーザー指示「連撃ダメージ予測が合算分だから
  //   分かりにくい ガード入れても合算計算だし うまくバラバラでわかるようにしたい」)。
  //   受けたあとの表示と同じ splitTacticsHitAmounts を通すので、予告と実際で割り方がそろう。
  //   ガードで止めた発は通らないので、**通る発の数だけ**に割る(数字の数＝これから食らう回数)
  // 大樹の加護(ユグドラシル・メルホイップの固有技)は使ったターンから効くので、選んだ時点で予告にも掛ける。
  //   既存5モードはパーティ全体、タクティクスはその固有技を使う子の枠だけ(実際の計算と同じ分け方)
  const plannedLifeTreeMult = (slotIdx) => {
    const counter = makeCardHalveCounter();
    let mult = 1;
    selectedCards.forEach(idx => {
      const card = hand[idx];
      const owner = cardAssignments[idx] != null ? cardAssignments[idx] : null;
      const halved = counter.take(card, owner);
      if (!isLifeTreeGuardCard(card)) return;
      if (Array.isArray(tacticsUnits) && owner !== slotIdx) return;
      mult = lifeTreeGuardMult(cardEffectMultiplier(card, halved), card.monId);
    });
    return mult;
  };
  const plannedHitFor = (slotIdx) => {
    const none = { taken: 0, parts: [], raw: 0 };
    if (!enemyIntent) return none;
    // ★外れた間合い攻撃は予告の時点でも威力を落とす(実行と同じ tacticsSweepIntent を通す)。
    //   予告だけ1.2倍のままだと「予定より少なかった」になる
    const planIntent = Array.isArray(tacticsUnits) ? tacticsSweepIntent(enemyIntent, tacticsUnits, enemyDist) : enemyIntent;
    const raw = getIncomingDamageBeforeTurnReduction(planIntent, slotIdx);
    if (!(raw > 0)) return none;
    const hits = enemyIntent.variant === 'rush' ? Math.max(1, Math.floor(Number(enemyIntent.hits) || 1)) : 1;
    let guard = 0, guardHits = 1;
    // ★タクティクスは枠ごと。構えていない子も、全体ガードなら丈夫さぶんが付く。
    //   受け止めるヒット数は、その子へ何枚構えたかで決まる(2枚以上なら連撃の全部)
    if (Array.isArray(tacticsUnits) && slotIdx !== null) {
      const bySlot = guardPlanOnce();
      const own = bySlot[slotIdx] || { cards: 0 };
      guard = enemyIntent.variant === 'pierce' ? 0 : tacticsSlotGuardValue(bySlot, slotIdx);
      guardHits = tacticsGuardHits(own.cards, hits);
    } else {
      // 既存5モードは今までどおり、手札のガードをまとめて1つに数える
      let flat = 0, mult = 0;
      const counter = makeCardHalveCounter();
      selectedCards.forEach(idx => {
        const card = hand[idx];
        const halved = counter.take(card, cardAssignments[idx] != null ? cardAssignments[idx] : null);
        const w = guardCardWeight(card);
        if (!(w > 0)) return;
        const effect = cardEffectMultiplier(card, halved);
        flat += GUARD_EVOLUTION[guardLevel].flat * w * effect;
        mult += GUARD_EVOLUTION[guardLevel].mult * w * effect;
      });
      guard = enemyIntent.variant === 'pierce' ? 0 : guardValueOf(flat, mult, slotIdx);
    }
    const hit = resolveTacticsGuardedHit(raw, hits, guard, guardHits);
    // 大樹の加護を選んでいれば、ガードのあとの通る量へ使ったターンぶんを掛ける(実処理の applyImmediateTakenReduction と同じ順)。
    //   hit は毎回作り直される入れ物なので、ここで書き換えてよい
    if (hit.taken > 0) hit.taken *= plannedLifeTreeMult(slotIdx);
    const taken = applyTurnDamageReduction(hit.taken, slotIdx);
    if (!(taken > 0)) return { taken: 0, parts: [], raw };
    // ★発ごとの通る量をそのまま出す。ガードが効いた発は小さく、効いていない発は大きい。
    //   止まった発(0)は数字を出さないので、数字の数＝これから食らう回数
    // ★raw(軽減前の合計)も返す。連撃は1発ずつ並べると**合計がどこにも出ない**ので、
    //   「結局いくつ食らうのか」が読めなかった(2026-09-22 ユーザー指摘)
    return { taken, raw, parts: hits > 1 ? scaleTacticsHitAmounts((hit.amounts || []).filter(value => value > 0), taken) : [taken] };
  };
  // かばう子は、まとめて引き受けたぶん(人数ぶん)を受ける
  const plannedHitWithCover = (slotIdx) => {
    const hit = plannedHitFor(slotIdx);
    if (!coverActive || slotIdx !== tacticsCoverSlot || coverHitCount <= 1 || !(hit.taken > 0)) return hit;
    return { taken: hit.taken * coverHitCount, raw: hit.raw * coverHitCount,
      parts: Array.from({ length: coverHitCount }, () => hit.parts).flat() };
  };
  const plannedDamageFor = (slotIdx) => plannedHitWithCover(slotIdx).taken;
  // ★敵が次に何をするかの札(「3連撃！」など)。作りはここ1か所にして、置き場所だけ変える。
  //   ムーは丸枠の外、ほかの敵は丸枠の右上へ出すので、下の2か所から呼ぶ
  // ★貫通技準備もこの札で出す(2026-09-22 ユーザー指摘「必殺技のためると必殺準備が被って出てる。
  //   それって本来どっちかでいいはずだよね」)。それまでは貫通技準備だけ札から外し、画面まんなかの
  //   大きい警告に任せていたが、必殺技とためるは札と警告が二重に出て、重なってどちらも読めなかった。
  //   タクティクスはこの札にまとめ、まんなかの警告は札の無い既存5モードのためにそちらへ残した
  const enemyNoticeShown = !ecoBattleView&&!!enemy&&!!enemyIntent&&!isBusy&&!enemyAttackFx
    &&Array.isArray(tacticsUnits)&&!!enemyIntent.notice;
  const enemyNoticeCard = () => {
    // ★色・動き・光り方を効果で変える(2026-09-22 ユーザー指示「吹き出しを
    //   効果によって変えると見た目がいい」)。文字を読む前に、攻めてくるのか
    //   回復するのかが見分けられるようにする
    const noticeTone=enemyIntent.type==='SPECIAL'?'bg-fuchsia-600 border-fuchsia-200 text-white shadow-[0_0_14px_rgba(217,70,239,0.85)]'
      :enemyIntent.type==='CHARGE'?'bg-amber-500 border-amber-100 text-black shadow-[0_0_14px_rgba(251,191,36,0.85)]'
      :enemyIntent.type==='PIERCE_CHARGE'?'bg-rose-600 border-rose-200 text-white shadow-[0_0_14px_rgba(244,63,94,0.85)]'
      :enemyIntent.type==='MOVE'?'bg-cyan-600 border-cyan-100 text-white shadow-[0_0_12px_rgba(6,182,212,0.7)]'
      :enemyIntent.type==='ROAR'?'bg-orange-600 border-orange-100 text-white shadow-[0_0_14px_rgba(249,115,22,0.85)]'
      :enemyIntent.type==='REGEN'?'bg-emerald-600 border-emerald-100 text-white shadow-[0_0_14px_rgba(16,185,129,0.85)]'
      :enemyIntent.type==='WAIT'?'bg-slate-600 border-slate-200 text-white shadow-[0_2px_10px_rgba(0,0,0,0.9)]'
      // 乱心で「意味不明」(スプーキーのトリックコンフューズ)。敵は動けない
      :enemyIntent.type==='CONFUSED'?'bg-violet-600 border-violet-100 text-white shadow-[0_0_14px_rgba(139,92,246,0.85)]'
      :'bg-red-600 border-red-100 text-white shadow-[0_0_14px_rgba(239,68,68,0.85)]';
    // 動きも効果ごと。殴ってくる技は小刻みに震え、回復はふわっと浮き、
    // 攻撃力アップは左右に揺れ、ためるは膨らみ、様子見と移動は静かに明滅する
    const noticeAnim=enemyIntent.type==='REGEN'?'noticeHeal 1400ms ease-in-out infinite'
      :enemyIntent.type==='ROAR'?'noticeShout 900ms ease-in-out infinite'
      :enemyIntent.type==='CHARGE'?'noticeCharge 1100ms ease-in-out infinite'
      :(enemyIntent.type==='MOVE'||enemyIntent.type==='WAIT')?'noticeCalm 1600ms ease-in-out infinite'
      :'noticeHit 800ms ease-in-out infinite';
    return (
      <div data-enemy-notice={enemyIntent.notice} data-enemy-notice-anim={noticeAnim.split(' ')[0]}
        className={`max-w-[170px] truncate rounded-2xl border-2 px-2 py-0.5 font-black leading-tight flex items-center gap-1 ${noticeTone}`}
        style={{fontSize:'11px',animation:noticeAnim}}>
        {/* ★icon は必ず cardIconNode を通す。絵文字ならそのまま、画像なら <img> になる。
            素で置くと、あとで画像のアイコンを足したときに文字列がそのまま出る */}
        <span style={{fontSize:'12px'}} className="leading-none shrink-0">{cardIconNode(enemyIntent.icon,12)}</span>
        <span className="truncate">{enemyIntent.notice}！</span>
      </div>);
  };
  return (

      <div className="flex-1 flex flex-col h-full relative" data-battle-speed={battleSpeed} data-enemy-down={enemyDefeating?'true':undefined} data-eco-view={ultraBattleView?'ultra':liteBattleView?'lite':'off'} data-tactics-look={tacticsNewLayout?((liteBattleView||ecoBattleView||idleMotionOff)?'calm':'rich'):undefined} data-fx-rest={tacticsNewLayout&&fxRestEnabled&&fxRest?'true':undefined} data-fx-level={tacticsNewLayout?fxLoad:undefined} data-moo-front={tacticsNewLayout&&enemyIsMoo&&!enemyAttackAnim?'true':undefined} data-fx-auto={autoLoadOn?'watch':undefined}>
        <style>{BATTLE_LANDSCAPE_CSS}</style>
        {/* 性能計測(デバッグ限定)。デバッグ設定で ON にしたときだけ出る。触っても戦闘の邪魔をしないよう、指は素通りさせる */}
        {perfOn&&tacticsNewLayout&&perfSnap&&(
          <div data-battle-perf-panel className="pointer-events-none fixed left-1 z-[65000] rounded-md bg-black/75 px-1.5 py-1 text-[9px] font-bold leading-tight text-amber-100" style={{top:'calc(env(safe-area-inset-top) + 2px)'}}>
            <div>{perfSnap.fps}fps 平均{perfSnap.avgMs}ms 最長{perfSnap.maxMs}ms</div>
            <div>遅いコマ{perfSnap.slowPct}% 50ms超{perfSnap.over50} 100ms超{perfSnap.over100}</div>
            <div>長い処理{perfSnap.longTasks}回/{perfSnap.longTaskMs}ms 動き続け{perfSnap.infinite??'?'}</div>
            <div>軽さ {fxLoad}{autoLoadOn?'(見張り中)':''}{fxRestEnabled&&fxRest?' 休止中':''}</div>
            {perfSnap.autoSteps.map((st,i)=><div key={i}>自動 {st.from}→{st.to} {st.slow}/{st.frames}</div>)}
          </div>
        )}
        {/* 舞台の照明(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい。
            イメージ画みたいにかっこよくできないかな？」)。
            ★画像は足さない。スマホの通信量に直に効くうえ、敵ごとに背景を用意すると際限がない
              (docs/rules/ASSETS.md)。上からの光・床の照り返し・周辺減光の3枚だけで奥行きを作る。
            ★静止した塗りなので、描き直しも起きず省エネ表示でも負荷は変わらない。
            ★いちばん後ろ(z-0)。この上に載る帯はどれも bg-slate-950 で塗ってあるので、
              光が見えるのは敵のいる舞台だけになる */}
        <div data-battle-stage-bg aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{zIndex:0,
          background:[
            // 上からの光。敵の頭の高さを中心に、青白く落とす
            'radial-gradient(116% 62% at 50% 20%, rgba(96,124,206,.34) 0%, rgba(30,38,72,.30) 46%, rgba(0,0,0,0) 72%)',
            // 床の照り返し。間合いバーのあたりを薄く持ち上げて、立っている場所を感じさせる
            'radial-gradient(72% 26% at 50% 78%, rgba(88,116,196,.20) 0%, rgba(0,0,0,0) 100%)',
            // 周辺減光。四隅を落とすと、まんなかの敵に目が行く
            'radial-gradient(120% 86% at 50% 38%, rgba(0,0,0,0) 38%, rgba(3,5,12,.72) 100%)',
            'linear-gradient(180deg, #0a0e1e 0%, #070a16 62%, #05070f 100%)',
          ].join(',')}}/>
        {liteBattleView&&<div data-lite-eco-dimmer className="absolute inset-0 bg-black/20 pointer-events-none" style={{zIndex:89999}} aria-hidden="true"/>}
        <header data-battle-header className="h-[5%] min-h-[40px] shrink-0 bg-slate-900 px-1.5 flex items-center border-b border-white/5 z-[6500] overflow-hidden">
          <div className={`flex flex-1 min-w-0 items-center gap-0.5 overflow-hidden${battleTutorialSpotClass('waveInfo')}`}>{debugBattle&&<span className="text-[7px] font-black text-fuchsia-300 border border-fuchsia-500/40 rounded px-1 py-0.5 tracking-widest">DEBUG</span>}{!isRaidJackMode(runMode)&&<span className={`text-[8px] font-black bg-opacity-10 px-1 py-0.5 rounded border tracking-tight whitespace-nowrap ${difficulty==='Hard'?'text-red-400 bg-red-500 border-red-500':'text-indigo-400 bg-indigo-500 border-indigo-500'}`}>WAVE {wave}/10</span>}{/* 狭い幅ではモード名だけを縮め、ターン・スコアと右側の操作領域は動かさない。389以下は「…」で切らず「/」のあとで2行に(320 で「Beg…」。2026-10-27 ジン) */}<span className="min-w-0 overflow-hidden text-ellipsis text-[7px] font-black px-1 py-0.5 rounded border whitespace-nowrap max-[389px]:whitespace-normal max-[389px]:leading-tight" style={{color:battleModeInfo(runMode).color,borderColor:`${battleModeInfo(runMode).color}66`,backgroundColor:'rgba(0,0,0,.35)'}}>{extremeRun?`極限チャレンジ / ${extremeDifficulty}`:isRaidJackMode(runMode)?<><span className="whitespace-nowrap">{battleModeInfo(runMode).short}</span> / <span className="whitespace-nowrap">{enemy?.name||''}</span></>:<>{battleModeInfo(runMode).short} / {QUICK_DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}</>}</span></div>
          <div data-battle-metrics className="shrink-0 flex items-center gap-1 px-1 leading-none">
            <div data-battle-turn className="flex flex-col items-center justify-center whitespace-nowrap font-black text-blue-400"><span className="flex items-center gap-0.5 text-[10px] tracking-wide"><Timer size={7}/>TURN</span><span className="mt-0.5 text-[10px] font-mono">{turnCount}/20</span></div>
            {!isQuickMode(runMode)&&<div data-battle-score className="flex min-w-[64px] flex-col items-end justify-center whitespace-nowrap font-mono font-black text-amber-500"><span className="flex items-center gap-0.5 text-[10px] tracking-wide"><Award size={7}/>SCORE</span><span data-battle-score-value className="mt-0.5 text-[10px] tabular-nums">{score.toLocaleString()}</span></div>}
          </div>
          <div data-battle-controls className="flex shrink-0 items-center gap-0.5"><button type="button" disabled={!!battleTutorial||autoRepeat} onClick={cycleBattleSpeed} aria-label={battleTutorial?'バトルのれんしゅう中は1倍固定':autoRepeat?'∞周回中は4倍固定':`バトル速度、現在${battleSpeed}倍。タップで切り替え`} title={autoRepeat?'∞周回中は×4固定':undefined} className="mh-hit-expand-y relative shrink-0 min-w-[42px] h-[28px] px-1.5 rounded-lg border-2 font-black text-[11px] leading-none active:scale-90 disabled:cursor-not-allowed disabled:opacity-60" style={{color:'#fef3c7',borderColor:'#f59e0b',backgroundColor:'rgba(120,53,15,.72)',boxShadow:'0 0 9px rgba(245,158,11,.35)'}}>×{battleSpeed}{autoRepeat&&<span className="ml-0.5 text-[10px]">固定</span>}</button><button data-battle-menu-button type="button" onClick={()=>setShowBattleMenu(true)} aria-label="設定（BGM・ヘルプ・あきらめる）" title="設定" className="mh-hit-expand-y relative shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-slate-800 rounded text-slate-300 active:scale-90"><Settings size={15}/></button></div>
        </header>
        {/* ★簡易画面には relative z-10 が要る。バトルの背景(data-battle-stage-bg)は
              position:absolute の z-index:0 で、CSSでは「位置指定のある要素」が static より上に描かれる。
              ここを static のままにすると簡易画面がまるごと背景の下へ潜り、
              超省エネにした瞬間に画面が消える(2026-09-22・ユーザー報告
              「超省エネにしたときだけ画面がなくなる」)。通常のバトル画面のほうは、
              中の要素が個別に relative z-* を持っているので沈まない */}
        {ultraBattleView?(
          <div data-ultra-battle-view className="relative z-10 flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100">
            <div className="flex-1 min-h-0 px-2 py-1.5 flex flex-col gap-1.5 overflow-hidden">
              {enemy&&(
                <section className="rounded-xl border border-red-900/70 bg-slate-900/95 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black"><span className="min-w-0 truncate text-red-200">{enemy.name}</span><span className="flex shrink-0 items-center gap-1"><BattleStackMarks counts={enemyStackCounts} side="enemy" className="mh-stack-marks-enemy"/><span className="shrink-0 font-mono text-red-300">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span></span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-red-600" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`}}/></div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    {/* 超省エネは敵の絵を出さない(2026-10-01・ユーザー指示「もっと画面情報減らしてエコに」)。名前・ライフ・距離・技名の文字だけ */}
                    <div className="text-center"><div className="text-[10px] font-black text-slate-400">現在距離</div><div className={`mt-1 rounded-full border px-3 py-1 text-[11px] font-black ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}距離</div></div>
                  </div>
                  <div data-ultra-enemy-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-red-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{enemySkillName&&<div className="truncate text-[11px] font-black text-red-200">{enemySkillName.label}</div>}{popups.filter(p=>p.side==='enemy').map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
                </section>
              )}
              <section className="rounded-xl border border-indigo-900/70 bg-slate-900/95 px-2 py-1.5">
                <div data-ultra-ally-slots className="grid grid-cols-4 gap-1">{slots.map((s,i)=><div key={i} className={`flex h-[42px] min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border}`}><div className="w-full truncate text-[10px] font-black text-white">{s?.name||'---'}</div>{/* 超省エネも、貯まった数は「マーク×数」で距離の字の横に出す */}<div className="mt-1 flex max-w-full items-center justify-center gap-0.5 text-[10px] font-black"><span className="shrink-0">{RANGE_LABELS[i]}距離</span><BattleStackMarks counts={allyStackCounts[i]} side="ally" full={SWEET_STACK_MAX} className="mh-stack-marks-inline"/></div></div>)}</div>
                <div className="mt-1.5 space-y-1">
                  <div><div className="flex justify-between text-[10px] font-black text-pink-300"><span>味方のライフ</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-pink-500" style={{width:`${(hp/effectiveMaxHp)*100}%`}}/></div></div>
                  <div><div className="flex justify-between text-[10px] font-black text-amber-300"><span>ガッツ</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{width:`${(guts/effectiveMaxGuts)*100}%`}}/></div></div>
                </div>
                <div data-ultra-ally-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-indigo-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{slotSkill&&<div className="truncate text-[11px] font-black text-indigo-200">{slotSkill.name}</div>}{popups.filter(p=>['hero','life','guts'].includes(p.side)).map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
              </section>
              {/* 空いたところへ周回の積み上がりを出す(2026-09-07・ユーザー指示)。
                  ★中身は描くときに組み立てる(関数で呼ぶ)。上のほうで const にすると、
                    見込み報酬の計算がまだ定義されておらず ∞ にした瞬間に画面が落ちる */}
              {renderQuickRunBattleBand()}
            </div>
            <div className="shrink-0 border-t border-white/10 bg-slate-900 p-1">
              <div className="flex items-center justify-between gap-1 px-1">
                <div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-wider text-indigo-300">Action Cards</div><div className="truncate text-[9px] font-bold text-slate-300">AUTO∞で進行中</div></div>
                <button onClick={()=>setShowDeckInfo(true)} className="flex min-h-[32px] items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 text-[10px] font-black"><Layers size={9}/>VIEW</button>
                {/* 超省エネでも🎵の縦列は通常のバトル画面と同じ並びにする */}
                <div className="shrink-0 flex flex-col gap-0.5">
                  <button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="バトルBGMと音量を調整" title="BGM / 音量" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[10px] font-black leading-none">BGM</span></button>
                  {quickToRhythmButtonNode}
                </div>
                {/* MFバトルカードへの入口は、超省エネでは🎵の列に積まず隣に置く(縦に3つ積むと下の帯が高くなる) */}
                {quickToCardButtonNode}
                <div className="w-[44px] shrink-0 flex flex-col gap-0.5"><button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className="h-8 w-full rounded-lg border-2 border-fuchsia-300 bg-fuchsia-500 text-[10px] font-black leading-tight text-slate-950"><span className="block">AUTO</span><span className="block text-[10px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button><button type="button" onClick={cycleEcoMode} aria-label="省エネ 超" className="min-h-[24px] w-full rounded-md border border-lime-200 bg-lime-500 text-[10px] font-black leading-[9px] text-slate-950"><span className="block">省エネ</span><span className="block">超</span></button></div>
                <button disabled className="min-h-[44px] min-w-[84px] shrink-0 rounded-full border-2 border-black bg-slate-700 px-2 text-[11px] font-black uppercase text-slate-400 opacity-50"><Play fill="currentColor" size={12} className="inline mr-1"/>Action</button>
              </div>
            </div>
          </div>
        ):(<>
        {/* 累計ターンで動く倍率だけをここへ出す。静的なルールの全文は「ルール詳細」で読む。
            ULTIMATEとINFINITYのように同じ系統のルールを持つ難易度は、同じ表示を共有する */}
        {(()=>{
          const statusRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);
          const hasEnemyRate=extremeRuleNumber(statusRule,'enemyTurnRate')!=null;
          const hasDamageRate=extremeRuleNumber(statusRule,'damageTurnRate')!=null;
          if(!hasEnemyRate&&!hasDamageRate)return null;
          const elapsedTotalTurns=totalTurnCount+Math.max(0,turnCount-1);
          const enemyMultiplier=ultimateEnemyTurnMultiplier(totalTurnCount,statusRule);
          const damageMultiplier=extremeDamageTurnMultiplier(elapsedTotalTurns,statusRule,wave);
          const hasJoinRate=extremeRuleNumber(statusRule,'allyJoinPenaltyRate')!=null;
          // 段階(神威・黄昏)と不死の残り回数は難易度名で分岐せず、持っている難易度だけに出す
          const stageLabel=extremeWaveStageLabel(statusRule);
          const stagedEnemyMultiplier=extremeWaveEnemyMultiplier(statusRule,wave);
          const revivalTotal=extremeRevivalCount(statusRule,wave);
          return <div data-ultimate-battle-status={statusRule} className="shrink-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[10px] font-black leading-none text-purple-100">
            <span className="text-amber-300">{statusRule}{stageLabel?` ${stageLabel} Lv.${extremeWaveStageLevel(wave)}`:''}</span>{revivalTotal>0&&<span className="text-slate-200">不死 残り{Math.max(0,revivalTotal-enemyRevivalUsed)}回</span>}{hasEnemyRate&&<span>敵強化 +{compactPercent(enemyMultiplier*stagedEnemyMultiplier-1)}（WAVE開始時 累計{totalTurnCount}T）</span>}{hasDamageRate&&<span>与ダメ {compactPercent(damageMultiplier)}（現在 累計{elapsedTotalTurns}T）</span>}{hasJoinRate&&<span>加入B {compactPercent(ultimateAllyJoinMultiplier(elapsedTotalTurns,statusRule))}（現在）</span>}{extremeDistanceBreakRule(statusRule)&&<span>BREAK {ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]}Lv${level}`:null).filter(Boolean).join(' / ')||'未発生'}</span>}
          </div>;
        })()}
        {(()=>{const rule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);return [NIGHTMARE_SETTING.id,CHAOS_SETTING.id].includes(rule)&&<div data-extreme-battle-status={rule} className="shrink-0 grid grid-cols-4 items-center gap-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[10px] font-black leading-none text-purple-100"><span className="text-amber-300">{rule}</span>{extremeSpecialRuleLines(rule).map(([label,value])=><span key={label} className="text-center whitespace-nowrap">{label} {value}</span>)}</div>;})()}
        {enemy&&(
          <div data-enemy-bar className={`shrink-0 bg-slate-950/95 border-b border-red-900/40 px-4 py-1 z-[6400] shadow-[0_4px_12px_rgba(0,0,0,0.6)]${battleTutorialSpotClass('enemyBar')}`}>
            <div className="flex justify-between items-center text-[11px] font-black italic uppercase tracking-tighter mb-0.5">
              <span className={`flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 leading-none ${wave===10?'text-red-500 animate-pulse':'text-slate-200'}`}><Skull size={11} className="shrink-0"/>{/* 斜体の最後の字の傾きが truncate の枠で欠ける(「ディノ」の「ノ」)ので右に少し余白 */}<span className="max-w-[34vw] truncate pr-[3px]">{enemy.name}</span><span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] text-white font-bold border ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}</span>{Array.isArray(enemyDebuffs)&&enemyDebuffs.length>0&&<button type="button" data-enemy-debuffs={enemyDebuffs.length} aria-expanded={enemyDebuffOpen} aria-label={`敵の状態 ${enemyDebuffs.map(d=>`${d.label} ${d.value}`).join('、')}（押すと詳細）`} onClick={()=>setEnemyDebuffOpen(v=>!v)} className="mh-hit-expand relative shrink-0 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-1.5 py-0.5 text-[10px] not-italic font-black leading-none tracking-normal normal-case text-slate-100 active:scale-95">{enemyDebuffs.map(d=>(<span key={d.key} data-enemy-debuff={d.key} aria-label={`${d.label} ${d.value}`} className={`inline-flex items-center gap-px ${d.tone.split(' ')[0]}`}><span aria-hidden="true">{d.mark}</span>{d.short?<span className="font-mono">{d.short}</span>:null}</span>))}<span aria-hidden="true" className="text-slate-300">{enemyDebuffOpen?'▲':'▼'}</span></button>}</span>
              {/* ★敵に重なってかかっている状態(水牢・氷結・咆哮)を「マーク×数」で常に出す(2026-10-12 社長の依頼)。
                  敵の絵の隅は、技名の帯・次の行動の札と重なり、横持ちでは絵ごと隠れるので、どの画面でも見えるライフの帯の右端(数字の左)に置く */}
              <span className="flex shrink-0 items-center gap-1"><BattleStackMarks counts={enemyStackCounts} side="enemy" className="mh-stack-marks-enemy"/><span className="text-red-500 flex items-center gap-1 font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span></span>
            </div>
            {/* 敵のライフ(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
                ★細い線だったものを、ガラスの筒に色が入っているように見せる。
                  中身は上から下へ暗くなる縦のグラデーション、筒の上半分に白い照りを重ねる。
                ★太くしたのは4pxだけ。ここは敵の名前と同じ帯なので、伸ばすと舞台が縮む */}
            <div data-enemy-hpbar className="relative h-[14px] overflow-hidden rounded-full border-2 border-white/25 bg-slate-950" style={{boxShadow:'inset 0 2px 6px rgba(0,0,0,.85)'}}>
              {/* ★幅(width)ではなく横の縮み(scaleX)で減らす。幅を変えると1秒のあいだ毎コマ組み直しが起き、スマホでライフの減り方がかくつく
                  (2026-09-24 ユーザー指摘「敵のライフの減り方とかかくつき」) */}
              <div className="h-full w-full origin-left transition-transform duration-1000" style={{transform:`scaleX(${Math.min(1,Math.max(0,enemy.hp)/(enemy.maxHp||1))})`,backgroundImage:'linear-gradient(180deg,#fca5a5 0%,#ef4444 38%,#b91c1c 72%,#7f1d1d 100%)'}}></div>
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{background:'linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,0))'}}></div>
            </div>
            {/* 敵にかかっているデバフの詳細(2026-10-06 ユーザー指示「全部ウンディーネの絶氷の位置にまとめて、簡易表示して押したら詳細が見える」)。
                名前の横の簡易表示を押したときだけ開く。デバフが無くなったら、開いたままでも何も出さない */}
            {enemyDebuffOpen&&Array.isArray(enemyDebuffs)&&enemyDebuffs.length>0&&(
              <div data-enemy-debuff-detail className="mt-1 flex flex-col gap-0.5 rounded-lg border border-white/15 bg-black/60 px-2 py-1 not-italic normal-case tracking-normal">
                {enemyDebuffs.map(d=>(<div key={d.key} className="flex items-baseline gap-1.5 text-[11px] font-black leading-tight">
                  <span aria-hidden="true">{d.mark}</span><span className={`shrink-0 ${d.tone.split(' ')[0]}`}>{d.label}</span><span className="shrink-0 font-mono text-slate-100">{d.value}</span>{d.note?<span className="min-w-0 truncate text-[10px] font-bold text-slate-400">{d.note}</span>:null}
                </div>))}
              </div>
            )}
            {raidGrowth&&(
              <button type="button" data-raid-growth-chip onClick={()=>setRaidGrowthOpen(true)} aria-label="レイドバトルのターンごとの強化の内訳を開く"
                className="mt-1 flex w-full min-w-0 items-center gap-1.5 max-[359px]:gap-1 overflow-hidden whitespace-nowrap rounded-md border border-emerald-400/40 bg-emerald-950/50 px-1.5 max-[359px]:px-1 py-0.5 text-[9px] max-[359px]:text-[8px] font-black leading-tight text-emerald-100 active:scale-[.99]">
                <span className="shrink-0 text-emerald-300">⬆ 強化</span>
                <span className="shrink-0">全ステ <b className="text-emerald-200">+{raidGrowth.statPct}%</b></span>
                <span className="shrink-0 text-amber-200">技・アシカ {raidGrowth.levelUps}/{raidGrowth.levelUpMax}</span>
                <span className="min-w-0 flex-1 truncate text-right text-slate-300">{raidGrowth.nextLevelUpTurn?`次の技強化 ${raidGrowth.nextLevelUpTurn}ターン目`:'技強化は出そろった'}</span>
                <span className="shrink-0 text-slate-400">詳細›</span>
              </button>
            )}
          </div>
        )}
        {/* レイドバトルの強化が入ったターンの帯(数秒で消える。操作の邪魔をしない) */}
        {raidGrowth&&raidGrowthBanner&&(
          <div key={raidGrowthBanner.key} data-raid-growth-banner data-battle-float aria-live="polite" className="pointer-events-none fixed left-1/2 top-[17%] w-[min(92vw,360px)] rounded-2xl border-2 border-emerald-300/70 bg-slate-950/90 px-3 py-2 text-center" style={{zIndex:60000,transform:'translateX(-50%)',animation:'raidGrowthBanner 3.2s ease-out forwards'}}>
            <div className="text-[13px] font-black text-emerald-300">⬆ {raidGrowth.turn}ターン目 強化！</div>
            <div className="mt-0.5 text-[11px] font-black text-white">味方の全ステータス +{raidGrowth.stepPct}%<span className="text-slate-300">(ここまで合計 +{raidGrowth.statPct}%)</span></div>
            <div className="text-[10px] font-black text-sky-200">自動回復 ライフ{raidGrowth.lifeRate}%・ガッツ{raidGrowth.gutsRate}%</div>
            {raidGrowth.levelUpNow&&<div className="mt-0.5 text-[11px] font-black text-amber-300">固有技が{RAID_JACK_UNIQUE_LEVEL_STEP}段階{raidGrowth.teachingUpNow?'・アシカが1段階':''}アップ！({raidGrowth.levelUps}/{raidGrowth.levelUpMax}回目)</div>}
          </div>
        )}
        {raidGrowth&&raidGrowthOpen&&(
          <div data-raid-growth-detail className="fixed inset-0 flex items-center justify-center bg-black/70 px-4" style={{zIndex:80000}} role="dialog" aria-modal="true" aria-label="レイドバトルの強化" onClick={()=>setRaidGrowthOpen(false)}>
            <div className="w-full max-w-[340px] rounded-2xl border-2 border-emerald-300/60 bg-slate-950 p-3 text-slate-100" onClick={(e)=>e.stopPropagation()}>
              <div className="text-center text-[13px] font-black text-emerald-300">レイドバトルの強化(いま {raidGrowth.turn}/{RAID_JACK_TURNS}ターン目)</div>
              <dl className="mt-2 space-y-1.5 text-[11px]">
                <div className="rounded-lg bg-slate-900 px-2 py-1.5"><dt className="font-black text-emerald-200">全ステータス</dt><dd>2ターン目から、1ターンごとに味方全員が +{raidGrowth.stepPct}%(掛け算)。いまは<b className="text-white"> 合計 +{raidGrowth.statPct}%</b>。ライフ・ガッツの上限が増えたぶんは、いまの値にも足されます</dd></div>
                <div className="rounded-lg bg-slate-900 px-2 py-1.5"><dt className="font-black text-sky-200">自動回復</dt><dd>1ターンごとに +1.5%。いまは<b className="text-white"> ライフ {raidGrowth.lifeRate}%・ガッツ {raidGrowth.gutsRate}%</b></dd></div>
                <div className="rounded-lg bg-slate-900 px-2 py-1.5"><dt className="font-black text-amber-200">固有技・アシカ</dt><dd>{RAID_JACK_LEVEL_UP_TURNS.join('・')}ターン目に、編成全員の固有技が{RAID_JACK_UNIQUE_LEVEL_STEP}段階ずつアップ(アシカは{RAID_JACK_LEVEL_UP_TURNS.slice(0,RAID_JACK_TEACHING_MAX_LEVEL).join('・')}ターン目に1段階ずつ・最大{RAID_JACK_TEACHING_MAX_LEVEL}段階)。<b className="text-white"> {raidGrowth.levelUps}/{raidGrowth.levelUpMax}回</b>済み{raidGrowth.nextLevelUpTurn?`(次は${raidGrowth.nextLevelUpTurn}ターン目)`:'(これで最後)'}</dd></div>
                <div className="rounded-lg bg-slate-900 px-2 py-1.5"><dt className="font-black text-rose-200">EXスキル</dt><dd>持っている味方ごとに2回まで</dd></div>
              </dl>
              <button type="button" data-raid-growth-close onClick={()=>setRaidGrowthOpen(false)} className="mt-2 min-h-[40px] w-full rounded-xl border border-white/20 bg-slate-800 text-[12px] font-black text-white active:scale-95">閉じる</button>
            </div>
          </div>
        )}
        {/* 敵の舞台。中身は敵の絵ひとつだけなので真ん中に置く。
            強化の札が増えて舞台が絵より低くなったときは、safe が上そろえへ戻してくれる
            (中央のままだと上へスクロールできず、頭の「!」や技名が読めなくなる)。
            safe を知らないブラウザは宣言ごと捨てるので、クラスの justify-start が残る */}
        <main data-battle-stage className="flex-1 relative flex flex-col items-center justify-start pt-3 pb-1 px-2 overflow-x-visible overflow-y-auto min-h-0" style={{justifyContent:'safe center',...(enemyImageOnlyAttack?{overflow:'visible',zIndex:70}:{})}}>
          {/* 敵のまわりのボタンは左の1列にまとめる(2026-09-22 ユーザー指示
              「敵周りのボタンを整理したほうがいい。添付イメージ画像のように左にきれいに並べるなど」)。
              ★もとは左(ステータス・緊急)と右(解析・ログ・魂格効果)に分かれていて、敵の絵を両側から
                削っていた。片側へ寄せると**右がまるごと空く**ので、そこへ敵の行動予告を置ける。
              ★並びは今までの左の順(ステータス→緊急)を先に置き、右にあった2つをその下へ足す。
                指が覚えている場所をできるだけ動かさない。
              ★幅と高さはそろえるが、色は役割ごとに残す(青=勇者/緊急、赤=敵を見る、琥珀=記録)。
                全部同じ色にすると、とっさに押し分けられなくなる。
              ★**折り返さない。1列のまま。** 狭い端末で入り切らないぶんを2列へ回したことがあるが、
                2列目がモンスターの絵に重なった(2026-09-22 ユーザー指摘「2列折り返しで
                モンスターにかぶってるのは論外」)。絵に何かを重ねるのは無し。
                入らないのは舞台そのものが低いからなので、**直すのは画面の縦の使い方**であって、
                ボタンの並べ方ではない(行動予告を右へ出す・味方の段をまとめる、で縦を作る) */}
          {/* 敵のまわりの入口は、1列に積まず**舞台の四隅**へ置く(2026-09-22 ユーザー指示
              「解析ボタンを右欄に置けばいい」「ログは左上」「ステータスは左エリアの
              バフ帯の上に置くとかがよさそう」)。
              ★1列に積むと、舞台が低い端末で下のほうが表示から外れる。四隅なら舞台の高さが
                変わっても、上の2つは上に、下の2つは下に貼り付いたままになる。
              ★下の2つは舞台の下端(bottom-1)。舞台の外にある間合いバーや強化の札とは重ならない。
              ★右は上が「解析」、下が敵の行動予測。どちらも敵を読むためのものなので同じ側へ寄せた。
              ★幅と高さはそろえるが、色は役割ごとに残す(青=勇者、赤=敵を見る、琥珀=記録)。
                全部同じ色にすると、とっさに押し分けられなくなる */}
          {/* 背の低い画面(高さ640以下)は、舞台が低くて上の角と下の角のボタンがぶつかる(2026-10-20 改善部 M2)。
              そこでだけ「ログ」「ステータス」「解析」を絵文字だけの小さな丸にして、左上の1行へ並べる(名前は aria-label に残る)。
              右は「次の行動」の欄だけになるので重ならない。魂格効果(出るときだけ)は左下へ。
              丸は敵の絵(舞台の真ん中)の外に収まる幅にしてある。絵には重ねない決まり */}
          <button data-battle-log-button type="button" onClick={()=>setShowBattleLog(true)} aria-label="バトルの記録を見る" title="バトルの記録" className="absolute left-2 top-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95 [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7 [@media(max-height:640px)]:rounded-full [@media(max-height:640px)]:p-0" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><BookOpen size={17} className="text-amber-300"/><span className="text-[10px] font-black leading-none text-white [@media(max-height:640px)]:sr-only">ログ</span></button>
          <button onClick={()=>setShowHeroInfo(true)} aria-label="勇者モンのステータス" className={`absolute left-2 bottom-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95 [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7 [@media(max-height:640px)]:rounded-full [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:bottom-auto [@media(max-height:640px)]:top-1 [@media(max-height:640px)]:left-[40px]${battleTutorialSpotClass('heroStatus')}`} style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Crown size={17} className="text-indigo-300"/><span className="text-[10px] font-black leading-none text-white [@media(max-height:640px)]:sr-only">ステータス</span></button>
          <button onClick={()=>setShowEnemyInfo(true)} aria-label="敵を解析する" className="absolute right-2 top-1 z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95 [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7 [@media(max-height:640px)]:rounded-full [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:right-auto [@media(max-height:640px)]:left-[72px]" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Search size={17} className="text-red-300"/><span className="text-[10px] font-black leading-none text-white [@media(max-height:640px)]:sr-only">解析</span></button>
          {battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&<button data-soul-battle-effects-button type="button" onClick={()=>setShowSoulBattleEffects(true)} aria-label="魂格効果" className="absolute right-2 top-[56px] z-20 flex w-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/20 bg-slate-900/85 py-1.5 active:scale-95 [@media(max-height:640px)]:h-7 [@media(max-height:640px)]:w-7 [@media(max-height:640px)]:rounded-full [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:top-auto [@media(max-height:640px)]:bottom-1 [@media(max-height:640px)]:right-auto [@media(max-height:640px)]:left-2" style={{boxShadow:'0 4px 14px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.16)'}}><Sparkles size={17} className="text-sky-300"/><span className="text-[10px] font-black leading-none text-white [@media(max-height:640px)]:sr-only">魂格効果</span></button>}
          {/* 敵が次に何をしてくるかの札(2026-09-19・ユーザー指摘「敵の行動予測が見えない」)。
              ★置き場所は**敵の絵の右下**(2026-09-22 ユーザー指示「敵の行動予測は右下に出るほうが
                良くない？ ただバフ帯と被らないように」)。舞台の下端に貼るので、舞台の外にある
                強化の札とは重ならない。右の上には「解析」が居る。もとは絵の下に帯として出していたが、丸1本へ技名・連撃数・
                狙われた子・予想ダメージを詰め込んでいたので、長い技名だと溢れていた。
                行を分けると、読む順(何をしてくる→だれに→いくつ減る)がそのまま縦に並ぶ。
              ★帯をやめたぶん**画面の縦が25px空く**。間合いバーで使ったぶんをここで返す。
              ★絶対位置で置く。フローに置くと、絵が大きい場面で main(overflow-y-auto)の
                外へ押し出されて消える(2026-09-18 に出した不具合)。絶対位置なら押し出されない。
              ★data-enemy-intent は検査の手がかり。どの行動が予告されているかは抽選なので、
                画面の文字から探すと「今回はためるだった」で落ちる */}
          {enemy&&enemyIntent&&!isBusy&&(()=>{
            // ためる・待機・移動はダメージが無いので「予測」を出さない。
            // 出すと必ず0になり、ガードを構える判断の邪魔になる
            // 新モードは「狙われた子の丈夫さ」で受け、「その子が構えたガード」だけが効く。
            // ★targetSlot が無いモードでは今までどおりパーティの値で出る
            const aimedSlot=coverActive?tacticsCoverSlot:(Number.isInteger(enemyIntent.targetSlot)?enemyIntent.targetSlot:null);
            const rawDmg=getIncomingDamageBeforeTurnReduction(enemyIntent,aimedSlot);
            // ★数え方は plannedDamageFor に1か所だけ置く(枠ごとの表示と同じ関数を通す)。
            //   2か所に書くと、ガードの数え方を直したときに片方だけ古くなる
            const plannedHit=plannedHitWithCover(aimedSlot);
            const plannedDmg=plannedHit.taken;
            // 連撃は「129・130」と1発ずつ。1発の技は今までどおり数字ひとつ
            const plannedText=plannedHit.parts.join('・');
            // ★連撃は1発ずつ並べると合計がどこにも出ない(2026-09-22 ユーザー指摘「連撃ダメージで
            //   合計ダメージと軽減後の合計ダメージがないといくつくらうかわからない」)。
            //   ガードやターン軽減が効いていれば「軽減前→軽減後」で、効き目もそのまま読める
            const plannedTotalText=plannedHit.raw>plannedDmg?`${plannedHit.raw}→${plannedDmg}`:`${plannedDmg}`;
            // ★全体攻撃は受ける量が1体ずつ違う。1つの数字にまとめると、
            //   どの子がどれだけ減るのか分からなくなるので、吹き出しには出さず枠ごとに出す
            // かばっているターンは受けるのが1体だけなので、全体攻撃でも吹き出しに出せる
            const showPlannedInBubble=coverActive||!enemyIntent.targetsAll;
            // ★再生も「いくつ戻るか」を数字で出す(2026-09-22 ユーザー指示「敵の回復時で
            //   いくつ回復するかも数値を予測で出してほしい」)。ダメージだけ数字が出て、
            //   回復は「回復」としか出ないので、あと何ターンで削り切れるかが読めなかった。
            //   数えるのは tacticsRegenHealAmount ひとつだけ。実際に回復する量と同じ式を通す
            //   (満タンで頭打ちになるぶんは敵のライフしだいなので、ここは振り込む量を出す)
            const regenHeal=enemyIntent.type==='REGEN'?tacticsRegenHealAmount(enemy?.maxHp):0;
            const tone=enemyIntent.type==='SPECIAL'?'bg-fuchsia-950 border-fuchsia-500 text-fuchsia-300'
              :enemyIntent.type==='CHARGE'?'bg-amber-950 border-amber-500 text-amber-400'
              :enemyIntent.type==='PIERCE_CHARGE'?'bg-rose-950 border-rose-500 text-rose-300'
              :enemyIntent.type==='MOVE'?'bg-cyan-950 border-cyan-500/60 text-cyan-300'
              // ★再生だけは赤にしない。こちらが減るのではなく敵が戻る数字なので、
              //   右上の吹き出し(noticeHeal)と同じ緑にそろえて取り違えを防ぐ
              :enemyIntent.type==='REGEN'?'bg-emerald-950 border-emerald-500/60 text-emerald-300'
              :enemyIntent.type==='CONFUSED'?'bg-violet-950 border-violet-400/70 text-violet-200'
              :'bg-red-950 border-red-600/50 text-red-400';
            // 敵の絵のすぐ下へ置く(2026-09-18・ユーザー依頼)。mt-auto で下端へ押しやっていたため、
            // 絵と「次に何をしてくるか」のあいだに200pxほどの空きができ、視線が大きく動いていた。
            // 余りの高さは、この下のバフ帯の mt-auto がまとめて吸う。
            // ★ためるだけは、敵ごとの技名を持たないので label が「必殺技の準備をしている」という
            //   説明文になり、右上の吹き出しの「必殺技準備」を長く言い直しただけになっていた
            //   (2026-09-22 ユーザー指摘「他のにならってやると攻撃予測のとこをためるにして
            //   吹き出しを必殺技準備が正解なはず」)。ほかの行動にならって短い呼び名にそろえる。
            // ★貫通の構えは敵ごとに「◯◯の構え」という名前が付くので、label のままにする。
            // ★何連撃かはここへ書かない。右上の吹き出しが「3連撃！」と出す側で、
            //   両方に書くと同じことを2回言ううえ、札の幅(100px)で名前が2行に折り返す
            const intentTitle=enemyIntent.type==='CHARGE'&&enemyIntent.category?enemyIntent.category:enemyIntent.label;
            return (
              <div data-enemy-intent
                className={`absolute right-2 bottom-1 z-[45] w-[100px] rounded-xl border px-1.5 py-1 shadow-lg animate-pulse [@media(max-height:640px)]:grid [@media(max-height:640px)]:w-[112px] [@media(max-height:640px)]:grid-cols-[minmax(0,1fr)_auto] [@media(max-height:640px)]:items-center [@media(max-height:640px)]:gap-x-1 [@media(max-height:640px)]:py-0.5${battleTutorialSpotClass('enemyIntent')} ${focusedCard&&!tacticsNewLayout?'invisible':'visible'} ${tone}`}>
                {/* 背の低い画面(高さ640以下)は舞台が低いので、ダメージの数字を右の列へ移して3行ぶんの高さに収める(2026-10-20 改善部 M2) */}
                <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider opacity-80 [@media(max-height:640px)]:col-start-1"><Target size={9}/>次の行動</div>
                {/* 背の低い画面は1行。「カボチャ…」と切らず、札の幅に合わせて字を縮める(2026-10-27 レイドの見回り) */}
                <div className="mt-0.5 text-[11px] font-black leading-tight [@media(max-height:640px)]:col-start-1 [@media(max-height:640px)]:min-w-0 [@media(max-height:640px)]:overflow-hidden [@media(max-height:640px)]:whitespace-nowrap [@media(max-height:640px)]:[container-type:inline-size]"><span className="block [@media(max-height:640px)]:[font-size:var(--mh-intent-fit)]" style={{'--mh-intent-fit':`min(11px, calc(100cqw / ${[...String(intentTitle||'')].length+0.3}))`}}>{intentTitle}</span></div>
                {aimedName?<div className="mt-0.5 truncate text-[9px] font-bold leading-none opacity-90 [@media(max-height:640px)]:col-start-1">🎯{aimedName}</div>:null}
                {enemyIntent.type==='CONFUSED'?<div data-enemy-confused className="mt-0.5 text-[9px] font-bold leading-tight opacity-90">動けない・会心確定</div>:null}
                {rawDmg>0&&showPlannedInBubble&&plannedText?(
                  <div className="mt-1 rounded bg-black/55 px-1 py-1 text-center leading-none [@media(max-height:640px)]:col-start-2 [@media(max-height:640px)]:row-span-3 [@media(max-height:640px)]:row-start-1 [@media(max-height:640px)]:mt-0">
                    <div className="text-[12px] font-black tabular-nums">{plannedTotalText}</div>
                    {plannedHit.parts.length>1?<div className="mt-0.5 text-[9px] font-bold tabular-nums text-white/80">{plannedText}</div>:null}
                  </div>
                ):null}
                {regenHeal>0?(
                  <div data-enemy-regen-heal={regenHeal} className="mt-1 rounded bg-black/55 px-1 py-1 text-center leading-none [@media(max-height:640px)]:col-start-2 [@media(max-height:640px)]:row-span-3 [@media(max-height:640px)]:row-start-1 [@media(max-height:640px)]:mt-0">
                    <div className="text-[12px] font-black tabular-nums text-emerald-300">+{regenHeal}</div>
                    <div className="mt-0.5 text-[9px] font-bold leading-none text-emerald-200/80">敵が回復</div>
                  </div>
                ):null}
              </div>
            );
          })()}
          {turnCount===1&&battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&!isBusy&&<div data-soul-battle-start-summary className="absolute left-1/2 top-2 -translate-x-1/2 z-10 max-w-[62%] truncate rounded-full border border-sky-400/30 bg-sky-950/75 px-2 py-1 text-[10px] font-black text-sky-100 pointer-events-none">魂格効果 発動中{Math.round(soulBattleParty.damageReduction*10)/10>0?` ・鉄壁${(Math.round(soulBattleParty.damageReduction*10)/10)}%`:''}{unifiedSpecialDefense.rate>0?` ・特殊防御${(Math.round(unifiedSpecialDefense.rate*10)/10)}%`:''}{battleIntimidate>0?` ・威圧${(Math.round(battleIntimidate*10)/10)}%`:''}{soulCoordinationCardBonus>0?' ・カード+1':''}</div>}
          <div className="mt-1 relative flex flex-col items-center">
            {/* ★body の直下へ出す(ReactDOM.createPortal)。画面の揺れ(screenShake)は transform で作ってあり、
                transform の掛かった要素の中の position:fixed は、揺れているあいだだけ基準がその要素へ切り替わる。
                そのため敵の攻撃が当たった瞬間に技名の札が飛ぶように「ずれ」ていた(2026-09-24 ユーザー指摘
                「大回転落としとか技名表示がずれる」)。バトル中の設定メニューで一度直したのと同じ原因 */}
            {/* 敵の技の全画面の演出(攻撃が味方の枠まで届く・必殺技で暗くなる・覚醒ムーのカットインなど) */}
            {/* ボスの必殺技ムービー(画面を切り替えて流す)。流すかどうかは 60-app が playBossMovie で決める */}
            <BossMovieLayer shake={battleFx.shake!=='OFF'}/>
            {enemyMotion&&<TacticsEnemyStageFx fx={enemyAttackFx} motion={enemyMotion} isMoo={enemyIsMoo} enemyId={enemy?.raidJackPumpkin?'Pumpkin':enemy?.id} skillLabel={enemySkillName?.label||null} lite={fxLoad==='LIGHT'}/>}
            {/* ★覚醒ムーのカットインが出ている技は、上の小さな技名の札を出さない(同じ名前が2か所に出る) */}
            {enemySkillName&&!(enemyIsMoo&&emSet&&enemyAttackFx?.skill&&TACTICS_MOO_CUTIN_SKILLS.includes(enemyAttackFx.skill))&&ReactDOM.createPortal(
              <div data-battle-float className="fixed left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{top:'14%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className="px-4 py-1.5 rounded-xl font-black text-[13px] bg-red-700 border-2 border-red-200 text-white shadow-[0_2px_16px_rgba(0,0,0,0.9)] flex items-center gap-2"><span>{cardIconNode(enemySkillName.icon,16)}</span>{enemySkillName.label}</div>
              </div>,document.body
            )}
            {/* 運しだいで決まった結果の帯(運命のコイン・運命の輪・トリックスタート・乱心・眼力。2026-10-06 ユーザー指摘
                「ランダム効果のものが何が発動したかわからない」)。技名の札(上の14%)と重ならないよう、その下へ縦に並べる。
                押せる場所は塞がない。body へ出すのは技名の札と同じ理由(画面の揺れで位置がずれないように) */}
            {Array.isArray(luckBanners)&&luckBanners.length>0&&ReactDOM.createPortal(
              <div data-battle-luck-banners data-battle-float className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1.5" style={{top:'21%',zIndex:65001,width:'min(92vw, 360px)'}}>
                {luckBanners.map(b=>(<div key={b.id} data-battle-luck-banner={b.tone}
                  className={`w-full rounded-2xl border-2 px-3 py-1.5 text-center shadow-[0_4px_20px_rgba(0,0,0,.85)] ${b.tone==='bad'?'bg-slate-800/95 border-slate-300 text-slate-100':b.tone==='enemy'?'bg-violet-800/95 border-violet-200 text-white':'bg-amber-600/95 border-amber-100 text-white'}`}
                  style={{animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                  <div data-battle-luck-title className="text-[11px] font-black leading-tight opacity-90">{cardIconNode(b.icon,14)} {b.title}</div>
                  <div data-battle-luck-result className="mt-0.5 text-[15px] font-black leading-snug">{helpWrap(b.result)}</div>
                </div>))}
              </div>,document.body
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='SPECIAL'&&(
              <div data-battle-float className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 500ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(217,70,239,1)]">☠️</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-900 via-fuchsia-700 to-purple-900 border-2 border-fuchsia-300 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(217,70,239,0.9)]">必 殺 技</div>
              </div>
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='CHARGE'&&(
              <div data-battle-float className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 700ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(251,191,36,1)]">✨</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-900 via-amber-600 to-amber-900 border-2 border-amber-200 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(251,191,36,0.9)]">た め る</div>
              </div>
            )}
            {/* 貫通技準備。ためると同じ大きさで出す。ガードが効かない技が次に確定で来るので、
                「ガードを固めても無駄」と1ターン早く分かるようにする(2026-09-21 ユーザー指示)。
                色はためる(琥珀)と分けて、貫通撃と同じ赤系にする。
                ★呼び名は「貫通の構え」から変えた(2026-09-22 ユーザー指示「吹き出しは
                貫通技準備とかがいいかな？」)。予告の帯には敵ごとの技名(「◯◯の構え」)が
                出るので、そこへ種別の「構え」を重ねると同じ言葉が2つ並んで読みにくかった */}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&!Array.isArray(tacticsUnits)&&enemyIntent.type==='PIERCE_CHARGE'&&(
              <div data-battle-float className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 700ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(244,63,94,1)]">⚔️</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-rose-900 via-rose-600 to-rose-900 border-2 border-rose-200 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(244,63,94,0.9)]">貫 通 技 準 備</div>
              </div>
            )}
            {/* 移動の予告。いま出ている行動予告(通常攻撃など)と同時に、
                「その次のターンに間合いを変える」ことを敵のつぶやきとして見せる。
                出す間合いは enemyNextIntent.targetDist そのもので、繰り上げても抽選し直さないため、
                吹き出しに出た間合いへ必ず動く。
                【置き場所】丸枠(敵の円)の中には置かないこと。丸枠は transform を持つため
                独自の重ね順の島になり、いくらz-indexを上げても、枠の外へ巨大に描くムーの
                裏へ回ってしまう。必殺技の警告と同じこの階層に置くと前面に出る */}
            {/* ★敵の解析・ステータス・ログなどを上に開いているあいだは出さない(body の直下へ出すので、
                開いた画面の上に重なって残っていた。2026-10-26 ダメダシの見回り クラシック#2) */}
            {/* ★敵を倒したあと(結果の画面へ移るまで)も出さない。WAVE の合間に残って列の外へ出ていた(2026-10-27 セコンドくんの見回り) */}
            {enemy&&enemyNextIntent&&!isBusy&&!enemyAttackFx&&!battleOverlayOpen&&!enemyDefeating&&enemyNextIntent.type==='MOVE'&&ReactDOM.createPortal(
              // 画面ではなく遊ぶ列(最大600px)の右端に寄せる。left:50%から
              // 「列の半分ぶん右へ、自分の幅だけ左へ」動かすと、広い画面でも列の中に収まる
              // ★技名の札と同じ理由で body の直下へ出す(揺れの間に位置が飛ばないように)
              <div data-battle-float-right="8" className="fixed left-1/2 pointer-events-none" style={{top:'22%',transform:'translateX(calc(min(50vw, 300px) - 100% - 8px))',zIndex:65000}}>
                <div className="mh-enemy-move-hint">
                  <span aria-hidden="true">🏃</span>
                  <span>{RANGE_LABELS[enemyNextIntent.targetDist]}距離に移動しようとしている…？</span>
                </div>
              </div>,document.body
            )}
            {/* ★新しい盤面(2×2)では技名を枠の中へ出す(下の data-tactics-slot-popups)。
                この固定位置は4列に並んでいた前提で、2×2では別の枠の上に出ていた */}
            {!tacticsNewLayout&&(<>
            {/* AIコピーの技名は、コピーを盤の外の5列目に出しているあいだは5列目のほうに出す(元の子の上に出さない) */}
            {slotSkill&&ReactDOM.createPortal(slotSkill.aiCopy&&tacticsCopyOutside?null:
              <div className="fixed -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{left:`${12.5+slotSkill.slotIndex*25}%`,bottom:'30%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className={`px-3 py-1 rounded-xl font-black text-[12px] border-2 shadow-[0_2px_16px_rgba(0,0,0,0.9)] ${slotSkill.type==='unique'?'bg-purple-700 border-purple-200 text-white drop-shadow-[0_0_10px_rgba(217,70,239,0.9)]':slotSkill.type==='special'?'bg-amber-600 border-amber-200 text-white':'bg-red-700 border-red-200 text-white'}`}>{slotSkill.name}</div>
              </div>,document.body
            )}
            </>)}
            {/* ★ガードの「🛡 キーン!」とアシストカードの全画面演出は、2026-09-29 のユーザー選択で置き換えた。
                ガードは枠のバリア(GuardBarrier・guardImpact)、アシストカードはカットイン(TacticsExCutin の assist)で出す */}
            {isMooBoss(enemy?.id)&&enemy?.imgUrl&&(
              <div data-enemy-motion={enemyMotion||undefined} data-jack-aura={jackAuraTier||undefined} data-moo-stage={enemyMotion?'true':undefined} data-enemy-skill={enemySkillNow||undefined} data-em-body={emSpec?.[0]||undefined} data-em-fx={emSpec?.[1]||undefined} data-em-emo={emSpec?.[3]||undefined} data-enemy-hurt={enemyHurtNow?'true':undefined} className="fixed left-1/2 pointer-events-none flex items-center justify-center" style={{...emDurStyle,top:'30%',transform:'translate(-50%,-50%)',zIndex:focusedCard?5:30,width:'min(108vw,560px)',height:'min(108vw,560px)'}}>
                {/* ★技の動き・やられの動き・待機の威圧(data-em-body / data-enemy-hurt / data-moo-stage)は CSS が掛けるので、そのあいだは style の animation を外す(style が勝ってしまう) */}
                {emSet&&<i aria-hidden="true" data-em-fx-el style={emFxStyle}/>}
                {/* data-moo-body: 絵と光(後ろの光の輪・絵の形の光の板)をひとまとめにして、動きはこの箱に掛ける(光が絵について動く) */}
                <div data-moo-body={emSet?'true':undefined} className="relative w-full h-full">
                {emSet&&<i aria-hidden="true" data-enemy-glow/>}
                {jackAuraTier>0&&<JackAuraLayer tier={jackAuraTier}/>}
                {/* ★ふちをぼかすマスクは外した(2026-09-28 battle-fx-lint-check)。絵はもともと切り抜きで、マスクで薄くなっていたのは
                    翼の先など2%ほど。大きな絵のマスクはメモリが足りないと外れ、そのたびに描き直しで固まる原因になる */}
                <img src={enemyBossImgSrc} alt={enemy?.name||"ムー"} style={{width:'100%',height:'100%',...(enemy?.id==='Jack'?enemyJackArtStyle:null),animation:(liteBattleView||emSpec||enemyHurtNow||(emSet&&!enemyAttackAnim))?undefined:(enemyAttackAnim?(enemyAttackFx?.kind==='move'?'mooMoveSlide 1000ms ease-in-out forwards':enemyAttackFx?.kind==='charge'?'mooChargeGather 1100ms ease-in-out forwards':'mooAttackLunge 900ms ease-in-out forwards'):'mooFloat 3000ms ease-in-out infinite'),imageRendering:'auto'}} className={`relative z-[1] object-contain drop-shadow-[0_0_55px_rgba(168,85,247,0.95)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/>
                {emSet&&enemyFlashNode}
                </div>
              </div>
            )}
            {/* ムー攻撃時: 全画面の破壊的演出 */}
            {/* 技ごとの全画面の演出(TacticsEnemyStageFx)を出すムーは、この共通の演出を出さない(!emSet) */}
            {!ecoBattleView&&isMooBoss(enemy?.id)&&enemyAttackFx?.kind==='moo'&&!emSet&&(
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{zIndex:25}}>
                <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 34%, rgba(168,85,247,0.55) 0%, rgba(239,68,68,0.4) 30%, rgba(251,191,36,0.25) 48%, rgba(0,0,0,0) 70%)', animation:'auraPulse 450ms ease-out infinite'}}></div>
                <div className="absolute inset-0" style={{animation:'specialFlash 400ms ease-out infinite', background:'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.45) 0%, rgba(168,85,247,0.15) 35%, rgba(255,255,255,0) 60%)'}}></div>
                <div className="absolute" style={{top:'34%',left:'50%',transform:'translate(-50%,-50%)',width:'min(120vw,640px)',height:'min(120vw,640px)'}}>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute left-1/2 top-1/2 text-5xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-42vw)`, animation:'sparkFlicker 240ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-purple-300/80" style={{animation:'auraRing 500ms ease-out infinite'}}></div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-500/60" style={{animation:'auraRing 650ms ease-out 120ms infinite'}}></div>
                </div>
              </div>
            )}
            {/* ★ムーの札だけは丸枠(敵の円)の外へ出す。丸枠には間合いごとの光り方
                (RANGE_STYLES の drop-shadow ＝ CSSの filter)が掛かっていて、transform と同じく
                **独自の重ね順の島**を作る。島の中に置くと z-index をいくつ上げても、枠の外へ
                巨大に描くムーの立ち絵(z-30)の裏へ回ってしまう
                (2026-09-22 ユーザー指摘「吹き出しが裏に回ってる」。同じ原因で3回目)。
                必殺技の警告・移動の予告と同じこの階層＝丸枠の外なら前面に出る。
                寄せ先は画面の右端ではなく遊ぶ列(最大600px)の右端にして、広い画面でも列に収める */}
            {enemyNoticeShown&&isMooBoss(enemy?.id)&&(
              <div data-enemy-notice-moo data-battle-float-right="76" className="fixed left-1/2 pointer-events-none"
                style={{top:'max(112px,16dvh)',transform:'translateX(calc(min(50vw, 300px) - 100% - 76px))',zIndex:focusedCard?5:40}}>
                {enemyNoticeCard()}
              </div>
            )}
            {/* 行動予測ラベルはmain下部に移動 */}
            {/* ★新しい盤面では、攻撃・ためるの動きは丸枠ではなく**敵の絵だけ**に掛ける(2026-09-24 ユーザー指示
                「敵も攻撃時は距離枠じゃなくてモンスターだけ動かしたほうがいい」)。動きは data-enemy-attack を見て CSS が絵へ掛ける。
                移動(距離が変わる)は立ち位置ごと動く動きなので、今までどおり丸枠ごと動かす。ムーは作りが別なので対象外 */}
            {/* data-attack-target: 味方の攻撃モーションが狙う場所(measureAttackAim)。名前は変えない */}
            <div data-enemy-ring={enemyDist} data-enemy-tap-detail data-enemy-attack={enemyImageOnlyAttack?(enemyAttackFx?.kind==='charge'?'charge':'fly'):undefined} data-enemy-motion={enemyMotion||undefined} data-enemy-skill={!enemyIsMoo&&enemySkillNow||undefined} data-em-idle={!enemyIsMoo&&emSet?.idle||undefined} data-em-body={!enemyIsMoo&&emSpec?.[0]||undefined} data-em-fx={!enemyIsMoo&&emSpec?.[1]||undefined} data-em-emo={!enemyIsMoo&&emSpec?.[3]||undefined} data-enemy-hurt={!enemyIsMoo&&enemyHurtNow?'true':undefined} className={`rounded-full transition-all duration-500 border-4 relative bg-black/35 ${RANGE_STYLES[enemyDist].border} ${RANGE_STYLES[enemyDist].shadow} ${RANGE_STYLES[enemyDist].glow} shadow-[0_0_50px]`} data-attack-target onClick={()=>{ /* ★敵を押すと、能力とかかっている効果の詳細を開く(2026-10-13)。戦闘の動きの最中・オートのあいだ・練習中は開かない */ if(isBusy||autoBattle||battleTutorialStep!=null||!enemy) return; setUnitDetail({side:'enemy'}); }} style={{...emDurStyle,...(enemyAttackAnim&&!ecoBattleView&&!enemyImageOnlyAttack?{padding:'clamp(6px,1.5dvh,16px)',animation:(enemyAttackFx?.kind==='move'?(isMooBoss(enemy?.id)?'enemyMoveSlideMoo 1000ms ease-in-out forwards':'enemyMoveSlide 1000ms ease-in-out forwards'):enemyAttackFx?.kind==='charge'?'enemyChargeShake 1100ms ease-in-out forwards':'enemyAttackFly 450ms ease-in forwards'), ...(isMooBoss(enemy?.id)&&enemyAttackFx?.kind!=='move'?{top:'3dvh'}:{}),...(!isMooBoss(enemy?.id)&&enemyAttackFx?.kind!=='move'?{zIndex:9999}:{})}:{padding:'clamp(6px,1.5dvh,16px)',...(isMooBoss(enemy?.id)?{top:'3dvh'}:{})})}}>
              {/* 足元の影(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
                  丸枠の塗りを落としたぶん、影が無いと宙に浮いて見える。絵(z-[1])より下へ敷く。
                  ★丸枠は transform を持つので重ね順の島になる。この中に置けば絵の下に必ず入る */}
              {/* カワズモーの張り手の手のひら(2026-09-24 ユーザー指示「張り手ならそれっぽい動きに」)。
                  絵が1枚なので手は別に描く。ふだんは見えず、攻撃(data-enemy-attack="fly")のときだけ CSS が突き出す。
                  ★span にしない。「> span」は敵の絵を包む要素を指す決めごとで、span だと絵の動きが手にも当たる */}
              {/* data-kz-fx: 技ごとの飾り(かわずつきの弧・大回転の渦・たまやの花火・かえるのうたの音符)。::before / ::after を CSS が描く */}
              {enemyMotion==='kawazumo'&&<><i aria-hidden="true" data-kz-palm="l">✋</i><i aria-hidden="true" data-kz-palm="r">✋</i><i aria-hidden="true" data-kz-fx/></>}
              {/* data-em-fx-el: カワズモー以外の敵の技の飾り。::before が形(data-em-fx)、::after が絵文字(--em-e) */}
              {emSet&&!enemyIsMoo&&<i aria-hidden="true" data-em-fx-el style={emFxStyle}/>}
              {!ecoBattleView&&<div aria-hidden="true" data-enemy-shadow className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2" style={{bottom:'11%',width:'64%',height:'13%',borderRadius:'50%',background:'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.62) 0%, rgba(0,0,0,.28) 52%, rgba(0,0,0,0) 76%)'}}></div>}
              {enemy?.imgUrl?(isMooBoss(enemy?.id)?<div style={{width:'clamp(92px,16dvh,142px)',height:'clamp(86px,15dvh,132px)'}}/>:<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'clamp(92px,16dvh,142px)',height:'clamp(86px,15dvh,132px)'}}>{enemyMotion&&<i aria-hidden="true" data-enemy-glow/>}<img src={enemy.imgUrl} alt={enemy?.name} className={`relative z-[1] w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/>{enemyFlashNode}</span>):(<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''}><div style={{fontSize:'clamp(58px,10.5dvh,96px)',lineHeight:1}} className={`relative z-[1] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}>{enemy?.emoji}</div></span>)}
              {/* 味方の攻撃が敵に当たった瞬間の着弾(体当たり・突進・ザン/エイキの斬撃)。攻撃中だけ出る */}
              {!ecoBattleView&&attackAnim&&<AttackTargetFx anim={attackAnim} attackerId={slots[attackAnim.slotIndex]?.id}/>}
              <TacticsExCutin cutin={tacticsExCutin}/>
              {/* ハムのカウンター(クロス・フル・リベンジ)。フル・リベンジは画面を覆い、タップで飛ばせる */}
              <HamCounterFx fx={hamCounterFx} onSkip={skipHamCounterFx}/>
              {!ecoBattleView&&!liteBattleView&&slotSkill&&slotSkill.type==='unique'&&attackAnim&&<SpecialMoveFx slotSkill={slotSkill} attackAnim={attackAnim} mon={slots[slotSkill.slotIndex]} ownerId={slotSkill.ownerId}/>}
              {/* ラスボス・ムー: 丸枠内は台座オーラのみ（本体は枠外に巨大表示） */}
              {!ecoBattleView&&isMooBoss(enemy?.id)&&(
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible" style={{zIndex:1}}>
                  <div className="absolute -inset-8 rounded-full" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(139,0,139,0.32) 45%, rgba(0,0,0,0) 72%)', animation:'auraPulse 1500ms ease-in-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-2 border-purple-500/60" style={{animation:'idleAuraPulse 1700ms ease-in-out infinite'}}></div>
                </div>
              )}
              {/* Move: dash effect with motion marks */}
              {!ecoBattleView&&enemyAttackFx?.kind==='move'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-2 rounded-full border-4 border-cyan-300/80" style={{animation:'shockRing 600ms ease-out forwards'}}></div>
                  <div className="absolute -inset-5 rounded-full border-2 border-sky-400/50" style={{animation:'shockRing 600ms ease-out 100ms forwards'}}></div>
                  <div className="absolute text-5xl drop-shadow-[0_0_14px_rgba(34,211,238,1)]" style={{animation:'moveDash 700ms ease-in-out forwards'}}>💨</div>
                  <div className="absolute -top-3 text-4xl font-black text-cyan-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 600ms cubic-bezier(.2,1.4,.4,1) forwards'}}>🏃</div>
                </div>
              )}
              {/* Normal attack: surprised exclamation burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='normal'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center" style={{animation:'enemyExclaim 500ms ease-out forwards'}}>
                  <div className="absolute -top-3 -right-2 text-5xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 500ms cubic-bezier(.2,1.4,.4,1) forwards'}}>❗</div>
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-300/80" style={{animation:'shockRing 500ms ease-out forwards'}}></div>
                </div>
              )}
              {/* Special attack: crackling aura + lightning burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='special'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(239,68,68,0.45) 40%, rgba(168,85,247,0.25) 60%, rgba(0,0,0,0) 75%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-4 border-amber-300" style={{animation:'auraRing 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-8 rounded-full border-2 border-red-500/70" style={{animation:'auraRing 700ms ease-out 120ms infinite'}}></div>
                  <div className="absolute -inset-12 rounded-full border-2 border-purple-500/50" style={{animation:'auraRing 800ms ease-out 240ms infinite'}}></div>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute text-3xl" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'sparkFlicker 300ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute text-7xl drop-shadow-[0_0_24px_rgba(251,191,36,1)]" style={{animation:'specialThrob 500ms ease-in-out infinite'}}>🔥</div>
                  <div className="absolute inset-0 rounded-full" style={{animation:'specialFlash 600ms ease-out infinite', background:'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)'}}></div>
                </div>
              )}
              {/* MOO (last boss): catastrophic aura + lightning storm */}
              {/* IDLE telegraph (player's turn): show what the enemy is about to do. Hidden while an attack is actually firing. */}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='ATTACK'&&!Array.isArray(tacticsUnits)&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center">
                  <div className="absolute -top-2 -right-1 text-4xl font-black text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style={{animation:'idleExclaim 1100ms ease-in-out infinite'}}>❗</div>
                </div>
              )}
              {/* ★何をする技かを、敵の絵の右上へ出す(2026-09-22 ユーザー指示「右上に必殺技！
                  みたいに吹き出し出せばいい。3連撃！とか」)。タクティクスの敵は技に固有の名前が
                  付いているので、名前だけでは連撃なのか回復なのか覚えられない。
                  予告が出ているあいだずっと見えるようにする(❗はこの札に置き換える)。
                  ★ムーだけはここへ置けない(丸枠の外へ出してある。少し上の data-enemy-notice-moo) */}
              {enemyNoticeShown&&!isMooBoss(enemy?.id)&&(
                <div className="absolute inset-0 pointer-events-none z-[9000]">
                  <div className="absolute -top-3 -right-2">{enemyNoticeCard()}</div>
                </div>
              )}
              {/* ためている最中は、敵の周りにオーラが集まる */}
              {!ecoBattleView&&enemy&&enemyAttackFx?.kind==='charge'&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-6 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0.2) 45%, rgba(0,0,0,0) 70%)', animation:'auraPulse 700ms ease-out infinite'}}></div>
                  {[0,1,2,3,4,5,6,7].map(k=>(
                    <div key={k} className="absolute text-2xl" style={{'--deg':`${k*45}deg`, animation:`chargeGather 900ms ease-in ${k*70}ms infinite`}}>✨</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-amber-300/80" style={{animation:'auraRing 700ms ease-out infinite'}}></div>
                </div>
              )}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&(enemyIntent.type==='SPECIAL'||(isMooBoss(enemy?.id)&&enemyIntent.type==='ATTACK'))&&(()=>{
                // ためる(CHARGE)の予告にはこのオーラを出さない。必殺技の予告と同じ見た目になり、
                // 「準備なのか、いま撃たれるのか」が見分けられなくなるため
                const isSpecial = enemyIntent.type==='SPECIAL';
                // 通常技 = 赤系 / 必殺技(チャージ) = 紫＋金系 で明確に色分け
                return (
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  {isSpecial ? (
                    <>
                      {/* 全画面の危険ビネット(画面端が赤紫に脈動) */}
                      <div className="fixed inset-0 pointer-events-none" style={{position:'fixed',inset:0,zIndex:85000,background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(168,85,247,0.25) 72%, rgba(127,29,29,0.55) 100%)', animation:'specialDangerPulse 700ms ease-in-out infinite'}}></div>
                      {/* 拡大する衝撃波リング(複数) */}
                      <div className="absolute -inset-8 rounded-full border-4 border-fuchsia-400/80" style={{animation:'specialShockwave 1400ms ease-out infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-purple-300/70" style={{animation:'specialShockwave 1400ms ease-out 466ms infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-amber-300/60" style={{animation:'specialShockwave 1400ms ease-out 933ms infinite'}}></div>
                      {/* 内側の脈動オーラ */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(217,70,239,0.6) 0%, rgba(168,85,247,0.45) 38%, rgba(251,191,36,0.3) 62%, rgba(0,0,0,0) 82%)', animation:'specialWarnFlash 600ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-3 rounded-full border-[3px] border-fuchsia-300" style={{animation:'specialWarnFlash 600ms ease-in-out infinite', boxShadow:'0 0 30px rgba(217,70,239,0.9), inset 0 0 30px rgba(217,70,239,0.7)'}}></div>
                      {/* 回転する危険スパーク */}
                      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_12px_rgba(217,70,239,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'idleSpark 600ms ease-in-out infinite', animationDelay:`${deg*1.5}ms`}}>⚡</div>
                      ))}
                      {/* 必殺技バナーは敵コンテナ直下(fixed)に移動済み */}
                    </>
                  ) : (
                    <>
                      {/* 通常技: 赤系のシンプルな警告 */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(239,68,68,0.45) 0%, rgba(220,38,38,0.32) 42%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-4 rounded-full border-2 border-red-500/90" style={{animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-7 rounded-full border-2 border-orange-500/60" style={{animation:'idleAuraPulse 1300ms ease-in-out 120ms infinite'}}></div>
                      {[0,45,90,135,180,225,270,315].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-96px, -12dvh, -60px))`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                      <div className="absolute -top-3 text-3xl drop-shadow-[0_0_12px_rgba(239,68,68,1)]" style={{animation:'idleExclaim 900ms ease-in-out infinite'}}>❗</div>
                    </>
                  )}
                </div>
                );
              })()}
            </div>
            {getTurnBuff('stunEnemy',false)&&<div className="absolute inset-0 flex items-center justify-center text-3xl bg-indigo-500/20 rounded-full border-4 border-indigo-500 animate-pulse">💫</div>}
            {(() => {
    const enemyPopups=popups.filter(p=>p.side==='enemy'&&!p.fx);
    const enemyFxPopups=popups.filter(p=>p.side==='enemy'&&p.fx).slice(-3);
    const wrapEnemyPopups=!liteBattleView&&enemyPopups.length>4;
    const popupColumns=wrapEnemyPopups?Math.ceil(enemyPopups.length/4):1;
    const popupGridStyle=wrapEnemyPopups?{
      display:'grid',
      gridAutoFlow:'column',
      gridTemplateRows:'repeat(4, auto)',
      gridAutoColumns:'max-content',
      justifyContent:'center',
      alignContent:'start',
      columnGap:popupColumns>=3?'0px':'4px',
      rowGap:'2px',
      paddingTop:'4px'
    }:undefined;
    const compactPopupStyle=wrapEnemyPopups?{
      fontSize:popupColumns>=3?'clamp(1.4rem, 5.8vw, 1.85rem)':'clamp(1.75rem, 7.5vw, 2.25rem)',
      lineHeight:1.05,
      paddingLeft:'2px',
      paddingRight:'2px'
    }:undefined;
    // ★効果の小さな札は上の端へ1列に並べ、大きなダメージの数字はその下へ置く。縦の流れにするので重ならない
    //   (下の端へ置くと、盤面の上の縁に出る「合計DMG」の予測や味方の枠の裏に隠れた)
    return (
      <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-start pt-1 gap-0.5">
        {enemyFxPopups.length>0&&<div data-enemy-fx-chips className="flex flex-col items-center gap-0.5 px-2">
          {enemyFxPopups.map(p=>(<div key={p.id} data-enemy-fx-chip className={`max-w-full truncate rounded-full border border-white/25 bg-slate-950/85 px-2.5 py-0.5 text-[12px] font-black leading-tight shadow-[0_2px_8px_rgba(0,0,0,.7)] ${enemyFxChipTone(p.color)}`}>{p.text}</div>))}
        </div>}
        <div className={`${wrapEnemyPopups?'':'flex flex-col items-center justify-start gap-0.5'}`} style={popupGridStyle}>
          {enemyPopups.map(p=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} style={compactPopupStyle} className={`text-center ${p.color} font-black whitespace-nowrap px-4 ${liteBattleView?'rounded-lg border border-white/20 bg-slate-950/95 py-1 text-base':'drop-shadow-[0_0_15px_rgba(0,0,0,1)]'}`}>{p.text}</div>))}
        </div>
      </div>
    );
  })()}
          </div>
          {/* 技詳細パネルはmain外(画面直下)に移動して、ムー画像と同階層でz-index勝負させる */}
        </main>
        {/* 間合いバー(2026-09-22 ユーザー依頼「タクティクスバトルのUIレイアウトを良くしたい」)。
            ★このモードの核は「敵と自分がどの間合いにいるか」なのに、敵の間合いは名前の横のバッジ、
              味方の間合いは枠の下のラベルと、離れた2か所を見比べないと分からなかった。
            ★置き場所は敵の絵の下の空き。main(flex-1)が縮むぶんを使うので、画面の縦は1pxも増えない。
            ★列は下の味方の枠と同じ4分割にそろえる。真下の枠がその間合いの子になるので、
              線の上の位置と枠が目で結びつく。
            ★移動の予告が出ているときは、動く先を点線の印で同じ線の上に出す。
              「次のターンに間合いが変わる」が、吹き出しを読まなくても分かる */}
        {!tacticsNewLayout&&Array.isArray(tacticsUnits)&&enemy&&(()=>{
          const moveTo=enemyNextIntent&&enemyNextIntent.type==='MOVE'&&Number.isFinite(enemyNextIntent.targetDist)
            ?enemyNextIntent.targetDist:null;
          const here=Number.isFinite(enemyDist)?enemyDist:0;
          return (
            <div data-tactics-range-bar={here} data-tactics-range-move={moveTo!=null?String(moveTo):undefined}
              className={`shrink-0 w-full px-2 pt-1 pb-0.5 bg-slate-950 ${focusedCard?'invisible':'visible'}`}>
              <div className="relative grid grid-cols-4 gap-1">
                {/* 軸の線。印は各列の真ん中に立つので、線も列の中心から中心までで止める */}
                <div aria-hidden="true" className="pointer-events-none absolute top-[28px] h-[3px] rounded-full"
                  style={{left:'12.5%',right:'12.5%',background:'linear-gradient(to right,#ef4444,#eab308,#10b981,#3b82f6)',
                    boxShadow:'0 0 8px rgba(120,160,255,.45)'}}></div>
                {/* 両端の矢印。零から遠まで一本の軸が続いていることを示す(2026-09-22 ユーザー指示) */}
                <div aria-hidden="true" className="pointer-events-none absolute text-[11px] font-black leading-none text-red-400" style={{top:'24px',left:'calc(12.5% - 13px)'}}>◀</div>
                <div aria-hidden="true" className="pointer-events-none absolute text-[11px] font-black leading-none text-blue-400" style={{top:'24px',right:'calc(12.5% - 13px)'}}>▶</div>
                {[0,1,2,3].map(i=>{
                  const unit=tacticsUnits[i];
                  const there=!!unit&&!unit.downed;
                  const isHere=here===i;
                  const isMove=moveTo===i&&!isHere;
                  return (
                    <div key={i} data-tactics-range-cell={i} data-tactics-range-enemy={isHere?'true':undefined}
                      data-tactics-range-ally={there?'true':undefined}
                      className="relative flex flex-col items-center">
                      {/* 敵の顔。いまいる間合いは実線の枠、次に動く先は点線の枠で出す。
                          ★枠の色は間合いの色ではなく**赤で固定**する。間合いの色にすると、
                            すぐ下の味方の印と同じ色になり、どちらが敵か形でしか分からなくなる */}
                      <div className="relative h-[22px] flex items-end justify-center">
                        {(isHere||isMove)&&(
                          <div className={`flex items-center justify-center rounded-full border ${isHere
                            ?'h-[20px] w-[20px] border-red-400 bg-black/75 shadow-[0_0_8px_rgba(239,68,68,.65)]'
                            :'h-[18px] w-[18px] border-dashed border-cyan-400/70 bg-black/40 opacity-70'}`}>
                            {enemy.imgUrl
                              ?<img src={enemy.imgUrl} alt="" className="h-[14px] w-[14px] object-contain"/>
                              :<Skull size={11} className="text-red-300"/>}
                          </div>
                        )}
                        {/* 動く向きの矢印(2026-09-22 ユーザー指示「移動予告は矢印表記も足したいね」)。
                            ★点線の丸だけでは「予定」とは読めても、どちらから来るのかが分からなかった。
                            ★矢印は**来る側**の脇に出す。右へ動くなら丸の左に「→」が立つので、
                              いまいる間合いから移動先へ視線がそのまま流れる */}
                        {isMove&&(
                          <span aria-hidden="true"
                            className={`absolute bottom-[3px] animate-pulse text-[12px] font-black leading-none text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,.9)] ${moveTo>here?'right-full mr-[1px]':'left-full ml-[1px]'}`}>
                            {moveTo>here?'→':'←'}
                          </span>
                        )}
                      </div>
                      {/* 目盛り。立っている子がいる間合いは塗り、空き・倒れている間合いは抜きで出す */}
                      <div className={`mt-[3px] h-[8px] w-[8px] rotate-45 rounded-[1px] border ${there
                        ?`${RANGE_STYLES[i].border} ${RANGE_STYLES[i].labelBg}`
                        :'border-white/25 bg-slate-900'}`}></div>
                      {/* 間合いの名前。立っている子がいる間合いだけ塗りのバッジにする。
                          ★字の色を間合いの色にすると、零(赤)が敵の赤い光に埋もれて読めなかった。
                            下の枠のラベルと同じ「塗り＋白字」にそろえる */}
                      <span className={`mt-[2px] rounded px-1.5 text-[13px] font-black leading-[16px] ${there
                        ?`${RANGE_STYLES[i].labelBg} text-white shadow-[0_0_10px_rgba(0,0,0,.6)]`
                        :'text-slate-500'}`}>
                        {RANGE_LABELS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* 強化の札(2026-09-19・ユーザー指摘「バフデバフ欄が見にくくなってる」)。
            もとは敵のいる main の中に置いていたが、main は overflow-y-auto なので、
            強化が増えて札が2行3行になると表示の外へ押し出され、下の味方バーに隠れて読めなくなっていた。
            main の外へ出し、味方バーのすぐ上に置く。これで札が何行になっても必ず見える。 */}
          {(()=>{
            // 強化の札(2026-09-20 ユーザー指摘「バフ欄が増えてくると敵や緊急回復等が見えなくなる」)。
            // ★もとは flex-wrap で何行にも伸びていた。強化が10個を超えると札だけで3行4行になり、
            //   敵の絵・「緊急」のボタン・与ダメの数字が押し出されて読めなくなっていた。
            // ★ふだんは**アイコン1行**(横に溢れたら横スクロール)。数値は「詳細」を押したときだけ出す。
            //   どちらの見た目でも周りの高さは変わらないので、下の画面が動かない。
            // ★札を1つずつ書くのをやめ、いったん配列にしてから並べる。
            //   文面と色をここ1か所に置くと、2つの見た目がずれない。
            const chips=battleBuffChips();
            if(!chips.length) return null;
            return (
              <div data-battle-buffs={chips.length} data-battle-buffs-mode={buffDetail?'detail':'icon'}
                className={`shrink-0 w-full max-w-[360px] mx-auto px-2 bg-slate-950 relative z-[40] flex flex-col justify-center pt-1 pb-0.5 ${focusedCard&&!tacticsNewLayout?'invisible':'visible'}`}>
                {/* 「詳細」を開いたときに伸びてよいのは**3段まで**(2026-09-22 ユーザー指示
                    「最大3列ぐらいまで伸びてあとはスクロールでみれるようにして」)。
                    ★札は23px、2段目からの行送りは26px。3段 = 23 + 26×2 = 75px。
                      それより下はこの中で縦スクロールする(スクロールバーは mh-scroll の6px)。
                    ★伸びたぶんは敵の舞台が縮む。上限を切らないと、舞台の低い端末で絵が切れ、
                      左下のステータスが絵に重なる(実測: 375×667 で舞台が120pxまで潰れた)。
                    ★アイコン表示のほうは何個増えても1行のまま(横スクロール)なので、
                      ふだんは距離帯との位置関係が動かない */}
                <div className={`flex items-start gap-1 ${focusedCard&&tacticsNewLayout?'invisible':'visible'}`}>
                  {buffDetail?(
                    <div data-battle-buff-list className="flex-1 min-w-0 flex flex-wrap justify-center gap-1 overflow-y-auto mh-scroll" style={{maxHeight:'75px'}}>
                      {chips.map(c=>(<div key={c.key} className={`text-[11px] font-black bg-black/60 px-2 py-0.5 rounded border flex items-center gap-1 shadow-lg ${c.tone}${c.pulse?' animate-pulse':''}${c.glow?` ${c.glow}`:''}`}>{c.mark} {c.label}{c.value?` ${c.value}`:''}</div>))}
                    </div>
                  ):(
                    <div data-battle-buff-icons className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-hide">
                      {chips.map(c=>(<div key={c.key} aria-label={`${c.label}${c.value?` ${c.value}`:''}`} title={`${c.label}${c.value?` ${c.value}`:''}`} className={`shrink-0 text-[10px] font-black bg-black/60 px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 leading-none ${c.tone}${c.pulse?' animate-pulse':''}${c.glow?` ${c.glow}`:''}`}>{c.mark}{c.short?<span>{c.short}</span>:null}</div>))}
                    </div>
                  )}
                  <button type="button" data-battle-buff-toggle={buffDetail?'close':'open'} onClick={()=>setBuffDetail(v=>!v)}
                    aria-label={buffDetail?'強化の詳細を閉じる':`強化の詳細を見る（${chips.length}件）`}
                    className="mh-hit-expand relative shrink-0 min-h-[20px] px-1.5 rounded-full border border-white/25 bg-black/60 text-[9px] font-black leading-none text-slate-200 active:scale-90 flex items-center">
                    {buffDetail?'閉じる':`詳細 ${chips.length}`}
                  </button>
                </div>
          {(()=>{
            // Overall total damage across ALL monster slots, matching processTurn's global attack order.
            // Existing total = sum of already-assigned attack cards.
            // If a card is pending and validly assignable somewhere, also compute the projected new total.
            // committed (already assigned) attack cards in selection order
            // 2枚目以降のカードは効果半減。processTurnと同じく「アシストカード以外の枚数」で数える。
            // 保留中(タップしただけでまだ置いていない)カードは、まだ使っていないので枚数に数えない。
            // ここを数えてしまうと、1枚目なのに自分自身を2枚目とみなして半減表示になる。
            const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
            const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
            // ニコラオ・ゴーレム・モッチー/ミタラシ・ききは使ったターンからすぐ効くため、
            // 先に選んだカードぶんの補正を、あとに続くカードの予測へも反映する
            // (processTurnの実行順序と同じ数え方。localBoostFromCard/previewLocalBoosts参照)。
            const boosts=previewBoostsOnce(pendingIdx);
            let committedTotal=0; let guardFlat=0; let guardMult=0; const guardBySlot={};
            const committedCounter=makeCardHalveCounter();
            selectedCards.forEach(idx=>{
              if(idx===pendingIdx) return;
              const card=hand[idx]; const slotIdx=cardAssignments[idx];
              const halved=committedCounter.take(card,slotIdx!=null?slotIdx:null);
              const b=boosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
              if(slotIdx!=null&&isAttackCard(card)){const baseDmg=getDmg(card,slotIdx,slots[slotIdx],b.oryo,b.dmgMod,halved); committedTotal+=getAttackPredictedDmg(card,slots[slotIdx],baseDmg,b.combo,slotIdx,halved);}
              const gw=guardCardWeight(card);
              if(gw>0){ const e=cardEffectMultiplier(card,halved);
                const gf=GUARD_EVOLUTION[guardLevel].flat*gw*e, gm=GUARD_EVOLUTION[guardLevel].mult*gw*e;
                guardFlat+=gf; guardMult+=gm;
                // ★タクティクスは構えた子ごとに丈夫さが違う。枠ごとに分けて持っておき、
                //   合計は「枠ごとに出した軽減量の足し算」にする(平均で1回出すとずれる)
                if(slotIdx!=null){ const cur=guardBySlot[slotIdx]||{flat:0,mult:0,cards:0};
                  guardBySlot[slotIdx]={flat:cur.flat+gf,mult:cur.mult+gm,cards:(cur.cards||0)+1}; } }
            });
            // ★全体ガード(2体以上が別々に構えた)なら、構えていない子にも丈夫さぶんが付く。
            //   合計にもそれを含める(2026-09-22 の新仕様)
            const sumGuardBySlot=(extra=null)=>{
              const merged={};
              Object.entries(guardBySlot).forEach(([slot,g])=>{ merged[slot]={...g}; });
              if(extra&&extra.slot!=null){ const cur=merged[extra.slot]||{flat:0,mult:0,cards:0};
                merged[extra.slot]={flat:cur.flat+extra.flat,mult:cur.mult+extra.mult,cards:(cur.cards||0)+1}; }
              return (tacticsUnits||[]).reduce((sum,unit,slotIdx)=>
                (unit&&!unit.downed ? sum+tacticsSlotGuardValue(merged,slotIdx) : sum),0);
            };
            const committedGuard=Array.isArray(tacticsUnits)?sumGuardBySlot():guardValueOf(guardFlat,guardMult);
            // 保留カードがガードなら、置いたあとの合計軽減も出す
            const pendingGuardWeight=guardCardWeight(pendingCardObj);
            const pendingGuardHalved=pendingGuardWeight>0&&committedCounter.peek(pendingCardObj,pendingIdx!=null&&cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null);
            const pendingGuardEffect=cardEffectMultiplier(pendingCardObj,pendingGuardHalved);
            // 置く先が決まっている保留カードは、その子の丈夫さで足す(タクティクス)
            const pendingGuardSlot=pendingIdx!=null&&cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null;
            const projectedGuard=pendingGuardWeight>0
              ? (Array.isArray(tacticsUnits)
                ? sumGuardBySlot({slot:pendingGuardSlot,
                    flat:GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*pendingGuardEffect,
                    mult:GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*pendingGuardEffect})
                : guardValueOf(guardFlat+GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*pendingGuardEffect, guardMult+GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*pendingGuardEffect))
              : committedGuard;
            const pendingIsAtk=isAttackCard(pendingCardObj);
            // projected damage the pending card would add (as the next attack in order)
            let pendingAdd=0; let pendingValidSlot=null;
            if(pendingIsAtk){
              // find a slot it could legally hit (for unique: its own monster; else any occupied slot)
              for(let i=0;i<slots.length;i++){
                const s=slots[i]; if(!s) continue;
                // ★置ける枠かどうかは、盤面のタップ判定とまったく同じ答えを使う。
                //   自前で枚数を数えていたころは、ガードを1枚置いた子が
                //   「もう置けない子」に見えて、合計DMGの予測だけ別の子で出ていた
                const tacticsAnswer=tacticsCanAssign?tacticsCanAssignOnce(pendingCardObj,pendingIdx,i):null;
                if(tacticsAnswer===null||tacticsAnswer===undefined){
                  const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
                  const maxUses=slotMaxUses(s,i); if(assignedCount>=maxUses) continue;
                } else if(!tacticsAnswer) continue;
                if(pendingCardObj.type==='unique'&&pendingCardObj.ownerSlotIdx!==i) continue;
                pendingValidSlot=i; const pendingHalved=committedCounter.peek(pendingCardObj,i); const baseDmg=getDmg(pendingCardObj,i,s,boosts.forPending.oryo,boosts.forPending.dmgMod,pendingHalved); pendingAdd=getAttackPredictedDmg(pendingCardObj,s,baseDmg,boosts.forPending.combo,i,pendingHalved); break;
              }
            }
            const projectedTotal=committedTotal+pendingAdd;
            const showProjected=pendingIsAtk&&pendingValidSlot!=null&&pendingAdd>0;
            // 合計軽減は、ガードを置いたぶんの合計。2枚目以降のガードは半分で計算される。
            const showGuardProjected=pendingGuardWeight>0&&projectedGuard>committedGuard;
            const showDmg=committedTotal>0||showProjected;
            const showGuard=committedGuard>0||showGuardProjected;
            if(!showDmg&&!showGuard) return null;
            return(
              // ★浮かせない。ここは**流れの中の1行**として置く(2026-09-22 ユーザー指摘
              //   「表示が被ってて見えない」)。それまでは枠の上へ absolute・bottom:78% で
              //   浮かせていたので、味方の枠の高さが変わると枠の名前の上に乗っていた
              //   (タクティクスはパーティのライフ帯が無いぶん枠が上がるので、必ず重なる)。
              //   ★高さを持つのは出ているあいだだけ。空けておく場所は作らない(舞台が低い端末で
              //     いちばん困るのは敵の絵なので、使わないときは敵へ返す)
              //   ★2つは**横に並べて**折り返す。縦に積むと出た瞬間に舞台が46px縮む
              <div data-battle-total-preview data-tactics-preview-band={tacticsNewLayout?'buff-overlay':undefined} className={`${tacticsNewLayout?'absolute left-1/2 top-0 z-[65] w-max max-w-[78%] -translate-x-1/2 -translate-y-full pb-1':'mt-1 w-full'} flex ${tacticsNewLayout?'flex-col':'flex-wrap'} items-center justify-center gap-x-2 gap-y-0.5 pointer-events-none`}>
                {showDmg&&(
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-lg ${showProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-red-950/90 border-red-500/50'} backdrop-blur-sm`}>
                  <Sword size={11} className={showProjected?'text-yellow-400':'text-red-400'}/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">合計DMG</span>
                  {showProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedTotal}</span>
                      <span className="text-yellow-400">+{pendingAdd}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedTotal}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]">{committedTotal}</span>
                  )}
                </div>
                )}
                {showGuard&&(
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow-lg ${showGuardProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-emerald-950/90 border-emerald-500/50'} backdrop-blur-sm`}>
                  <Shield size={11} className={showGuardProjected?'text-yellow-400':'text-emerald-400'}/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">合計軽減</span>
                  {showGuardProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedGuard}</span>
                      <span className="text-yellow-400">+{projectedGuard-committedGuard}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedGuard}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">{committedGuard}</span>
                  )}
                </div>
                )}
              </div>
            );
          })()}
              </div>
            );
          })()}
        {/* ★盤面の上の縁に吹き出し(data-tactics-board-popups)が出ているあいだだけ、盤面を強化の札の帯(z-40)より前へ出す。
            z-10 のままだと、上へ積んだ「💊 緊急回復」などが帯の裏に回って薄くしか見えなかった(2026-09-24) */}
        {/* ★味方が攻撃しているあいだは、この段(z-10)を上のライフ・強化の札の段(z-40)より前へ出す
            (2026-09-24 ユーザー指摘「スネグーラチカも消えてる・ほかもあやしい」)。
            攻撃モーションは枠の外へ飛び出して敵まで届くので、z-10 のままだとライフの帯や強化の札の
            裏を通り、パンドラの分身・突進する子・斬り込む子がその間だけ隠れていた */}
        <div data-tactics-board-band className="shrink-0 py-1.5 px-2 border-y border-white/10 flex flex-col items-center justify-center gap-1 z-10 relative" style={{backgroundImage:'linear-gradient(180deg, rgba(14,19,38,.97) 0%, rgba(8,11,22,.98) 100%)',...((tacticsNewLayout&&popups.some(p=>['hero','life','guts'].includes(p.side)&&!Number.isInteger(p.slot)))?{zIndex:60}:(attackAnim&&!ecoBattleView)?{zIndex:6450}:{})}}>
          {/* ★新しい盤面(2×2)では、ここ(盤面のまんなか)へ出すと4枠の境目に乗り、
              どの子のライフも読めなくなっていた(2026-09-23 ユーザー指示「敵への効果は敵の辺り、
              味方への効果は対象の味方や使ったモンスター」)。
              誰の効果か決まっているもの(slot を持つもの)はその子の枠の中へ、
              誰のものでもないもの(合計・回避の名乗り・AUTO停止など)は盤面の**上の縁**へ出す。
              上へ積むので、何個出ても盤面には降りてこない */}
          {tacticsNewLayout?(
            <div data-tactics-board-popups className="absolute inset-x-0 bottom-full mb-1 flex flex-col items-center justify-end gap-0.5 pointer-events-none" style={{zIndex:200}}>
              {popups.filter(p=>['hero','life','guts'].includes(p.side)&&!Number.isInteger(p.slot)).slice(-3).map((p)=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined}
                className={`${tacticsPopupTone(p.color)} max-w-[92%] truncate whitespace-nowrap rounded-full border border-white/15 bg-slate-950/90 px-3 py-0.5 text-[15px] font-black leading-tight shadow-[0_4px_14px_rgba(0,0,0,.6)]`}
                style={{animation:liteBattleView?undefined:'tacticsPopupRise 240ms ease-out'}}>{p.text}</div>))}
            </div>
          ):(
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1" style={{zIndex:200}}>{popups.filter(p=>p.side==='hero').map((p)=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} className={`${p.color} font-black leading-tight px-2 py-0.5 rounded-lg ${liteBattleView?'border border-white/20 text-base':'drop-shadow-[0_2px_8px_rgba(0,0,0,1)]'}`} style={{backgroundColor:liteBattleView?'rgba(2,6,23,0.95)':'rgba(2,6,23,0.55)'}}>{p.text}</div>))}</div>
          )}
          {/* ライフ・ガッツのポップアップ(吸収・ガードの余り・回復カードなど)。
              ★1体ずつの帯は**カードの中へ入れた**(2026-09-22 ユーザー指摘「距離いれると縦が
                狭くなりすぎる」)。同じ4列が2段あるだけで枠1つぶんと余白を丸ごと使っていたため。
              ★帯を消すときに、出す場所ごと消してはいけない(2026-09-20 に一度やって、回復も
                ガードの余りもどこにも出なくなった)。入れ物だけここに残す */}
          {Array.isArray(tacticsUnits)?(
            <div data-tactics-party-popups className="absolute inset-x-0 top-0 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>
                {/* 新しい盤面では上の data-tactics-board-popups と枠の中へ出すので、ここは古い盤面だけ */}
                {!tacticsNewLayout&&popups.filter(p=>p.side==='life'||p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}
            </div>
          ):(
          <div className="w-full space-y-0.5 px-2 py-0.5 bg-black/40 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 relative"><Heart className="text-pink-500 shrink-0" size={12}/><div className="flex-1"><div className="flex items-end justify-between text-[9px] font-bold text-pink-400 uppercase tracking-wider"><span>Ally Life</span><span data-ally-life={`${hp}/${effectiveMaxHp}`} className="font-mono text-[11px] leading-none text-pink-200">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-pink-700 to-rose-400 transition-all duration-1000" style={{width:`${(hp/effectiveMaxHp)*100}%`,backgroundImage:'linear-gradient(to right, #be185d, #fb7185)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='life').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
            <div className="flex items-center gap-2 relative"><Zap className="text-amber-500 shrink-0" size={10}/><div className="flex-1"><div className="flex items-end justify-between text-[9px] font-bold text-amber-400 uppercase tracking-wider"><span>Ally Guts</span><span data-ally-guts={`${Math.floor(guts)}/${effectiveMaxGuts}`} className="font-mono text-[11px] leading-none text-amber-200">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{width:`${(guts/effectiveMaxGuts)*100}%`,backgroundImage:'linear-gradient(to right, #d97706, #fde047)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
          </div>
          )}
          {/* 味方の枠。高さは中身の合計で決まる(名前18 + 絵64 + ライフ/ガッツ + 距離ラベル20)。
              ★枠は overflow-visible なので、足りないと下へはみ出して手札の帯に食い込む。
                ライフ・ガッツをラベル付きで整列させたとき(2026-09-22)に実際はみ出した */}
          <div data-ai-copy-row={classicAiCopy&&!tacticsNewLayout?'':undefined} data-tactics-ai-copy-row={tacticsCopyOutside?'':undefined} className={classicAiCopy&&!tacticsNewLayout?'':tacticsCopyOutside?(tacticsNewLayout?'flex w-full items-stretch gap-1.5 [@media(orientation:landscape)_and_(max-height:520px)]:flex-col [@media(orientation:landscape)_and_(max-height:520px)]:gap-1':'flex w-full items-stretch gap-1.5'):'contents'}>
          <div data-tactics-debug-layout={tacticsNewLayout?'2x2':undefined} className={`grid ${tacticsNewLayout?'grid-cols-2 grid-rows-2 gap-1.5':'grid-cols-4 gap-2'} w-full relative ${tacticsCopyOutside?(tacticsNewLayout?'min-w-0 flex-1 [@media(orientation:landscape)_and_(max-height:520px)]:flex-none':'min-w-0 flex-1'):'shrink-0'}${battleTutorialSpotClass('battleSlots')}`} style={{height:tacticsNewLayout?'clamp(196px,23dvh,214px)':'clamp(152px,18dvh,168px)'}}>
            {slots.map((s,i)=>{
              // Count how many cards already assigned to this slot
              const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
              // 通常は1枠1枚。枚数+1の勇者特性(ハムの連続攻撃・剣士モッチーの二刀流)を持つ
              // 勇者モンが居ると、その本人のスロットだけ複数枚OK。
              // ききのカード上限+1が効いているときも、その+1ぶんはどのスロットへ重ねてよい
              const maxUses=slotMaxUses(s,i);
              const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
              // 保留中のカードはまだ使っていないので、「何枚目か」の枚数には数えない
              const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
              // Can this slot accept the pending card?
              // 新モードはこの子のライフ・ガッツ・倒れたかどうかを持つ(ほかのモードでは null)
              const tacticsUnit=Array.isArray(tacticsUnits)?(tacticsUnits[i]||null):null;
              // この枠のガードの状態。札の名前(全体ハイガード)と🛡のまとめが同じ答えを使えるよう、
              // ガードのまとめは枠ごとに1回だけ作ってここから配る
              const guardPlanBySlot=Array.isArray(tacticsUnits)?guardPlanOnce():null;
              const slotGuardCards=guardPlanBySlot?(guardPlanBySlot[i]?.cards||0):0;
              const slotRushGuard=slotGuardCards>=TACTICS_RUSH_GUARD_CARDS;
              const slotSpreadGuard=!!guardPlanBySlot&&isTacticsSpreadGuard(guardPlanBySlot);
              // ★このターン、この子に何が起きたか(食らった／受け止めた／かわした／返した)。
              //   浮かぶ数字だけでは、全体攻撃のときにどこを見ればよいのか目が追いつかない
              //   (2026-09-22 ユーザー指示「攻撃されたときに誰が攻撃されたかが分かりづらい」)
              const slotHitKind=kindOfTacticsSlotFx(tacticsSlotFx&&tacticsSlotFx[i]);
              // 揺れは省エネ表示では出さない(光と輪だけでも誰かは分かる)
              const slotHitShake=slotHitKind&&!ecoBattleView&&!shakeOff?{animation:'tacticsHitShake 420ms ease-in-out'}:null;
              // ★「その子だけに効く」バフは、かかっている子の枠へ印を出す(タクティクス)。
              //   画面上の帯(Boost・会心予約…)では誰にかかっているのか分からない。
              //   みゃるの薬と、固有技の効果(消費0・会心確定・贖罪・共鳴)がここに出る
              const slotBuffMarks=(()=>{
                if(!Array.isArray(tacticsUnits)) return [];
                const bySlot=getTurnBuff('bySlot',null);
                const marks=[];
                const atkMult=tacticsSlotRate(bySlot,i,'atkMult',1.0);
                if(atkMult>1) marks.push({text:`⚔×${atkMult.toFixed(1)}`,cls:'text-red-300'});
                if(tacticsSlotFlag(bySlot,i,'zeroGuts')) marks.push({text:'⚡0',cls:'text-blue-300'});
                if(tacticsSlotFlag(bySlot,i,'guaranteedCrit')) marks.push({text:'★会心',cls:'text-yellow-300'});
                const takenMult=tacticsSlotRate(bySlot,i,'takenDamageMult',1.0);
                if(takenMult<1) marks.push({text:`🛡-${Math.round((1-takenMult)*100)}%`,cls:'text-pink-300'});
                const costMult=tacticsSlotRate(bySlot,i,'gutsCostMult',1.0);
                if(costMult>1) marks.push({text:`⚡+${Math.round((costMult-1)*100)}%`,cls:'text-amber-300'});
                if(tacticsSlotTurns(bySlot,i,'pandoraResonanceTurns')>0) marks.push({text:'⚡½',cls:'text-cyan-300'});
                return marks;
              })();
              let canAssign=false;
              if(s && pendingCardObj){
                // 新モードは「その子が払えるか」で決まる。倒れた子へは回復カードだけ置ける。
                // ★null のときだけ今までどおりの判定を使う(既存モードはここを通る)
                const tacticsAnswer=tacticsCanAssign?tacticsCanAssignOnce(pendingCardObj,pendingIdx,i):null;
                if(tacticsAnswer===null||tacticsAnswer===undefined){
                  canAssign = assignedCount<maxUses;
                  if(pendingCardObj.type==='unique') canAssign = canAssign && (pendingCardObj.ownerSlotIdx===i);
                } else canAssign = tacticsAnswer;
              }
              // 選択順に「アシストカード以外」を数え、どのカードが2枚目以降(効果半減)かを出す。
              // 保留中のカードはまだ使っていないので数えない。
              // 保留中のカードは自分を数えず、「次に使う1枚」として半減かどうかを決める。
              // (数えてしまうと1枚目でも半減、除外しっぱなしだと2枚目でも全開の表示になる)
              const halvedByIdx={};
              {const counter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; const c=hand[idx]; const sl=cardAssignments[idx]!=null?cardAssignments[idx]:null; halvedByIdx[idx]=counter.take(c,sl); });
                if(pendingIdx!=null&&selectedCards.includes(pendingIdx)) halvedByIdx[pendingIdx]=counter.peek(hand[pendingIdx],cardAssignments[pendingIdx]!=null?cardAssignments[pendingIdx]:null);}
              // Preview damage:
              // - if a card is pending assignment, show what THIS card would do on this monster
              // - otherwise show the sum of damage from cards already assigned to this slot,
              //   using the GLOBAL attack order (2nd+ attack = half damage), matching processTurn
              // ニコラオ・ゴーレム・モッチー/ミタラシ・ききの同ターン即時効果を、
              // このスロットの予測にも反映する(合計DMG欄と同じpreviewLocalBoosts)。
              const slotBoosts=previewBoostsOnce(pendingIdx);
              let previewDmg=0; let isPendingPreview=false; let isPendingHalved=false; let previewSoulPct=0;
              // ★ガードも枠ごとに「この子へ置いたらいくら受け止められるか」を出す
              //   (2026-09-22 ユーザー指摘「ダメージは個別に見えるのにガード値は個別に
              //    分からない…ダメージと同じような仕様にして」)。
              //   受け止める量はその子の丈夫さで決まるので、置く先で変わる
              let previewGuard=0; let isPendingGuardHalved=false;
              if(s && pendingCardObj && canAssign && guardCardWeight(pendingCardObj)>0){
                const guardCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; guardCounter.take(hand[idx],cardAssignments[idx]!=null?cardAssignments[idx]:null); });
                isPendingGuardHalved=guardCounter.peek(pendingCardObj,i);
                const gw=guardCardWeight(pendingCardObj), ge=cardEffectMultiplier(pendingCardObj,isPendingGuardHalved);
                previewGuard=guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge,i);
              }
              if(s && pendingCardObj && canAssign && isAttackCard(pendingCardObj)){
                // 既に選んだぶんを数え、保留カードは「この枠へ置いた次の1枚」として扱う。
                // ★新モードは同じ子の2枚目だけ半減なので、置き先(i)で数え方が変わる
                const pendingCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; pendingCounter.take(hand[idx],cardAssignments[idx]!=null?cardAssignments[idx]:null); });
                const isSecondOrLater = pendingCounter.peek(pendingCardObj,i);
                const baseDmg=getDmg(pendingCardObj,i,s,slotBoosts.forPending.oryo,slotBoosts.forPending.dmgMod,isSecondOrLater);
                previewDmg=getAttackPredictedDmg(pendingCardObj,s,baseDmg,slotBoosts.forPending.combo,i,isSecondOrLater);
                previewSoulPct=soulTraitAttackProfile(s?.masuId?getMasuMon(s.masuId):null,pendingCardObj,i).damagePct;
                isPendingPreview=true; isPendingHalved=isSecondOrLater;
              } else if(s){
                // 選択順で「アシストカード以外」を数え、2枚目以降は半減として予測する
                const slotCounter=makeCardHalveCounter();
                selectedCards.forEach(idx=>{
                  if(idx===pendingIdx) return;
                  const card=hand[idx];
                  const halved=slotCounter.take(card,cardAssignments[idx]!=null?cardAssignments[idx]:null);
                  if(cardAssignments[idx]===i){
                    const b=slotBoosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
                    const baseDmg=getDmg(card,i,s,b.oryo,b.dmgMod,halved);
                    previewDmg+=getAttackPredictedDmg(card,s,baseDmg,b.combo,i,halved);
                  }
                });
              }
              // ★AIコピーが打つあいだは、元の子ではなくコピーの絵が動く。本編は aiCopyHitting(5人目の札)、
              //   タクティクス/レイドは attackAnim.aiCopy で、その枠に子がいる(=コピーは盤の外の5列目か重なり)ときは元の子を動かさない(2026-10-28 社長)
              const isAnimating = !ecoBattleView && attackAnim && attackAnim.slotIndex === i && !(classicAiCopy && aiCopyHitting) && !(attackAnim.aiCopy && s && Array.isArray(tacticsUnits));
              // 敵の位置へ向けるためのCSS変数。測れなかったときは :root の既定値(真上)で動く
              // 新しい盤面は枠が2段に並ぶ。攻撃中の子の枠だけ前へ出さないと、沈み込み・横滑りのときに
              // あとから描かれる隣や下の枠の裏へ絵が回る(古い盤面は枠ごと z-index:9999 で前へ出している)
              const attackAimStyle = isAnimating&&attackAim&&attackAim.slotIndex===i ? attackAimVars(attackAim.dx, attackAim.dy) : null;
              // ★絵の入れ物は絵と同じ大きさに固定する(2026-09-24 ユーザー指摘「ミーアの攻撃中、姿が消えてる」)。
              //   ミーア・水・聖光の攻撃演出は入れ物いっぱいに重ねる絶対配置なので、大きさを持たないと
              //   入れ物が0×0につぶれ、本体の絵が幅数pxまで押しつぶされてマイクも見えなくなっていた
              // 待機中の動き(翼の羽ばたき・しっぽ・花の揺れ・全体の浮き沈みなど。MonsterIdleArt)。
              // 軽量表示と、設定の「待機中の動き：止める」では今までどおり1枚の絵
              const slotArt = (img) => (!ecoBattleView&&!idleMotionOff ? <MonsterIdleArt baseId={s?.id} image={img}/> : img);
              // 体当たりだった初期モンスターは、種族ごとの攻撃(ThemedAttackMotion)で見せる。枠は飛ばさない
              const themedAttack = isAnimating ? themedAttackKindOf(attackAnim, s?.id) : null;
              const slotArtBox = {width:tacticsNewLayout?'58px':'64px', height:tacticsNewLayout?'58px':'64px', flexShrink:0};
              // このスロットに固有技カードが割り当てられているか（セット中は常時エフェクト）
              const hasUniqueSet = selectedCards.some(idx=>cardAssignments[idx]===i && hand[idx]?.type==='unique');
              // このスロットに表示する選択中カード: 攻撃系は割当先スロット、全体系(ガード/バフ/回復等)は全スロット
              const slotAssignedCards = selectedCards.filter(idx=>{
                const card=hand[idx]; if(!card) return false;
                if(cardNeedsMonster(card)) return cardAssignments[idx]===i;
                return true; // 全体系は全スロット
              }).map(idx=>({idx,card:hand[idx]}));
              const distanceBreakLevel=ultimateDistanceBreakLevels[i]||0;
              const distanceBroken=distanceBreakLevel>0;
              const distanceBreakPercent=100*(0.5**distanceBreakLevel);
              const distanceBreakRoman=['','I','II','III','IV'][distanceBreakLevel]||String(distanceBreakLevel);
              // ★この枠が狙われているか(2026-09-21 ユーザー指摘「誰に攻撃か分からない」)。
              //   名前だけでは4つの枠から自分で探すことになるので、枠のほうにも印を出す
              const slotAimed=aimedSlots.includes(i);
              // ★その子の予定ダメージ。全体攻撃は丈夫さで1体ずつ変わるので枠ごとに出す
              //   (2026-09-21 ユーザー依頼)。ガードを置けばその枠の数字だけが減る。
              //   ★連撃は1発ずつ並べると合計が読めない(2026-09-22 ユーザー指摘)ので、
              //     合計を先に出し、1発ずつの内訳を小さく添える
              const slotAimHit=slotAimed?plannedHitWithCover(i):null;
              // この子のEXスキル(タクティクスだけ。持っていなければ null)
              const slotExInfo=tacticsExInfo?tacticsExInfo(i):null;
              // 狙われる確率(%)。2026-10-22 社長「ヘイトは炎じゃなくて数値化したほうがいい」で、炎の段から数字に替えた。
              // 敵が狙いを決めるのと同じ重み(tacticsTargetChances → tacticsTargetWeights)で、生きている子だけで割る。倒れている子には出さない。
              // 印は「狙」の小さな字(予告の当たり先の🎯と紛れないように・狭い枠で名前を削りすぎないように)
              // ★AIコピー(ソラシドのアシカの5人目)が立っていれば、%はコピーも入れて割る(4体とコピーで合計100)。aiCopy は公開の印が偽のあいだ null
              const copyStanding=!!aiCopy&&isTacticsAiCopyStanding(aiCopy)&&aiCopy.spawnTurn<=turnCount;
              const chancesNow=s&&tacticsHateOn&&Array.isArray(tacticsHate)?tacticsTargetChancesWithCopy(tacticsUnits,tacticsHate,TACTICS_TARGET_LOW_HP_BIAS,copyStanding?aiCopy:null):null;
              const hatePct=chancesNow?chancesNow.slots[i]:null;
              // コピーは、コピーが立つマス(pos)の枠に出す(2026-10-27 部長: 見せ方は開発部の部品 24-sorashido-copy-view.jsx)。
              //   空いたマスなら元の子の絵を SorashidoCopyFx で包んで置く(出る前は appear・出たら idle)。重なるときは絵を出さず札だけ
              //   上に次に使う札(SorashidoNextCardBadge)、下にライフ・狙われる%の小さな札
              //   消える0.7秒は shownAiCopy(直前の形・fx='vanish')で描く。狙われる%などの数えは aiCopy のまま
              const tCopy=shownAiCopy;
              const tCopyPhase=aiCopyViewPhase(tCopy,copyStanding?'idle':'appear');
              const tCopyOut=copyStanding||tCopyPhase==='vanish';
              const copySrc=tCopy&&tCopy.pos===i?slots[tCopy.srcSlot]:null;
              const tCopyOnMon=!!s||!!(tCopy&&tCopy.stacked);
              const tCopyHit=!!(isAnimating&&attackAnim.aiCopy&&copySrc&&!tCopyOnMon);
              const copyChip=tacticsNewLayout&&!tacticsCopyOutside&&tCopy&&tCopy.pos===i?(<>
                {/* 枠は横に広い(縦の画面で約176×95)。空いたマスは「左に絵・右に次に使う札・下にライフ」と横に分けて、札で絵を隠さない。
                    子がいるマスに重なるときは、その子の絵・名前・ライフの行を隠さないよう、左下の絵の所に2行の小さな札だけを出す
                    (1行目 ♥ライフ・狙われる%、2行目 次に使うカード。ライフの行の字にかからない幅 40% に収める。くわしくは押して手札の窓で見る)。
                    横向きの背の低い画面は枠が縦長(約88×112)なので、空いたマスは「上に絵・下に次の札」、重なるときの札は右上(名前の段の下)へ移す。2026-10-27 セコンドくんの実画面の見回り */}
                {/* コピーが打つとき(60 の playAiCopyHit が attackAnim.aiCopy を約0.45秒出す)は、空いたマスのコピーの絵を元の子と同じ攻撃の動きで敵へ向けて動かす。
                    技名は下の枠の中の吹き出し(data-tactics-slot-skill)がそのまま出す。重なるときは元の子の絵が動くのでここでは動かさない */}
                {/* 2026-10-28 社長「AIにガッツはないの？ステータスがわかりにくい」: 空いたマスのコピーも、5列目と同じく
                    ライフ・ガッツを数と棒で、元の子の枠と同じくらい読める形にする(共通の部品 AiCopyLifeBar・AiCopyGutsMeter)。
                    縦(約176×95)は「左に薄い絵・右に次の札/ライフ/ガッツ」、横向きの背の低い画面(約88×112)は「上に絵・下に次の札/ライフ/ガッツ」 */}
                {copySrc&&!tCopyOnMon&&<div data-tactics-ai-copy-art={i} data-ai-copy-phase={tCopyPhase} data-tactics-ai-copy-hit={tCopyHit?'1':undefined} className={`absolute left-1 top-[26px] bottom-[18px] ${tCopyHit?'z-[80]':'z-[24]'} flex w-[60px] items-center justify-center pointer-events-none [@media(orientation:landscape)_and_(max-height:520px)]:right-1 [@media(orientation:landscape)_and_(max-height:520px)]:w-auto [@media(orientation:landscape)_and_(max-height:520px)]:top-[17px] [@media(orientation:landscape)_and_(max-height:520px)]:bottom-auto [@media(orientation:landscape)_and_(max-height:520px)]:h-[27px]`}>
                  <div style={tCopyHit?{position:'relative',animation:attackMotionAnimation(attackAnim),...(attackAimStyle||{})}:undefined}>
                    <AiCopyBody src={copySrc} phase={tCopyPhase} size={classicAiCopyLandscape()?34:50}/>
                  </div>
                </div>}
                {!tCopyOnMon&&<div data-tactics-ai-copy-stats={i} className={`absolute ${copySrc?'left-[66px]':'left-1'} right-1.5 top-[26px] bottom-[3px] z-[64] flex min-w-0 flex-col justify-between gap-0.5 pointer-events-none [@media(orientation:landscape)_and_(max-height:520px)]:left-1 [@media(orientation:landscape)_and_(max-height:520px)]:right-1 [@media(orientation:landscape)_and_(max-height:520px)]:top-[44px] [@media(orientation:landscape)_and_(max-height:520px)]:bottom-[21px] [@media(orientation:landscape)_and_(max-height:520px)]:gap-0`}>
                  <div data-tactics-ai-copy-next={i} className="flex min-w-0 justify-center">
                    <SorashidoNextCardBadge card={tCopyOut?tCopy.nextCard:null} turnsLeft={null} layout="landscape"/>
                  </div>
                  <AiCopyLifeBar hp={tCopy.hp} maxHp={tCopy.maxHp}/>
                  <AiCopyGutsMeter guts={tCopy.guts} maxGuts={tCopy.maxGuts}/>
                </div>}
                {/* 押すとコピーの手札の窓(BattleScreen の copyHandOpen)。枠のボタンへは伝えない */}
                <div data-tactics-ai-copy={i} data-tactics-ai-copy-out={tCopyOut?'1':'0'} role={aiCopy?'button':undefined} aria-label={aiCopy?'コピーの手札を見る':undefined}
                  onClick={aiCopy?(e)=>{e.stopPropagation();setCopyHandOpen(true);}:undefined}
                  className={`absolute left-1 bottom-1 z-[64] flex ${tCopyOnMon?'max-w-[40%] flex-col items-start gap-px tracking-tighter [@media(orientation:landscape)_and_(max-height:520px)]:left-auto [@media(orientation:landscape)_and_(max-height:520px)]:right-1 [@media(orientation:landscape)_and_(max-height:520px)]:bottom-auto [@media(orientation:landscape)_and_(max-height:520px)]:top-[38px] [@media(orientation:landscape)_and_(max-height:520px)]:max-w-[76%]':'w-[62px] max-w-[62px] items-center gap-0.5 tracking-tighter [@media(orientation:landscape)_and_(max-height:520px)]:w-[calc(100%-8px)] [@media(orientation:landscape)_and_(max-height:520px)]:max-w-[calc(100%-8px)] [@media(orientation:landscape)_and_(max-height:520px)]:bottom-0.5 [@media(orientation:landscape)_and_(max-height:520px)]:py-[2px]'} rounded bg-sky-900/90 px-1 py-px text-[8px] font-black leading-none text-sky-100 ring-1 ring-sky-300/70 whitespace-nowrap ${aiCopy?'pointer-events-auto cursor-pointer':'pointer-events-none'}`}>
                  <span className="flex max-w-full min-w-0 items-center gap-0.5">
                    <span className="min-w-0 truncate"><span className={tCopyOnMon?'max-[359px]:hidden [@media(orientation:landscape)_and_(max-height:520px)]:hidden':''}>🤖</span>{tCopyOut?(tCopyOnMon?<><span className="text-rose-300">♥</span><span className="tabular-nums">{tCopy.hp}</span></>:`あと${tCopy.turnsLeft}`):'次のターンから'}</span>
                    {copyStanding&&chancesNow&&Number.isInteger(chancesNow.copy)&&<span className="shrink-0 tabular-nums tracking-tighter text-rose-200"><span className={tCopyOnMon?'text-[6px] opacity-80':''}>狙</span>{chancesNow.copy}%</span>}
                  </span>
                  {tCopyOnMon&&tCopyOut&&<span data-tactics-ai-copy-next={i} className="block max-w-full min-w-0 truncate text-emerald-200">{tCopy.nextCard?(tCopy.nextCard.name||tCopy.nextCard.baseName||'考え中'):'考え中'}<span className="tabular-nums text-sky-200/90"> あと{tCopy.turnsLeft}</span></span>}
                </div>
              </>):null;
              const hateFlame=Number.isInteger(hatePct)?<span data-tactics-hate={i} data-tactics-hate-pct={hatePct} title="狙われる確率" className={`ml-0.5 shrink-0 rounded px-[2px] py-px text-[8px] font-black leading-none tracking-tighter tabular-nums ${hatePct>=50?'bg-red-950/80 text-red-200':hatePct>=30?'bg-orange-950/70 text-orange-200':'bg-black/50 text-slate-300'}`}><span className="text-[6px] opacity-80">狙</span>{hatePct}%</span>:null;
              // パンドラの箱: 効いているあいだは、悪魔と天使の2体を1つの枠に並べて出す(ライフ・ガッツ・距離・狙われ方は1体のまま)。
              // 待機アニメ(MonsterIdleArt)は本体の絵のパーツ用なので、2体のときは通さない。カードを切る間は、そのカードの側(1枚目=悪魔・2枚目以降=天使)が前に出て、もう片方は暗くなる。染色は本体用なので2体には掛けない
              const pandoraForm = s && s.id === 'Pandora' ? (tacticsPandoraForms && tacticsPandoraForms[i]) : null;
              const pandoraArt = (s && s.id === 'Pandora' && slotExInfo && slotExInfo.active && slotExInfo.def && slotExInfo.def.effect === 'pandoraBox') ? (() => {
                const ph = tacticsNewLayout ? 58 : 64, pw = Math.round(ph * 2 / 3);
                // 攻撃モーションは、いま攻撃している側(1枚目=悪魔・2枚目以降=天使)の1体にだけ掛ける。もう片方はその場に残る
                const fig = (url, form, left) => {
                  const front = pandoraForm === form, dim = !!pandoraForm && !front, attacker = front && isAnimating;
                  const imgNode = <img data-pandora-form={form} src={url} alt="" draggable={false} className="object-contain drop-shadow-md"
                    style={{ display: 'block', width: pw, height: ph, transform: front && !attacker ? 'scale(1.12)' : 'none', filter: dim ? 'brightness(.5)' : 'none', transition: 'transform .15s, filter .15s' }}/>;
                  const moving = !attacker ? imgNode
                    : (s.id === 'Pandora' && attackAnim.motion === 'pandoraDualThunder') ? <PandoraDualThunder image={imgNode}/>
                    : themedAttack ? <ThemedAttackMotion kind={themedAttack} lunge={attackAnim.charge === false} image={imgNode}/>
                    : imgNode;
                  const moveStyle = attacker ? { zIndex: 9999, animation: themedAttack ? undefined : attackMotionAnimation(attackAnim), ...attackAimStyle } : null;
                  return <span data-pandora-fig={form} style={{ position: 'absolute', bottom: 0, left, width: pw, height: ph, zIndex: front ? 3 : (form === 'angel' ? 2 : 1), ...moveStyle }}>{moving}</span>;
                };
                return <span data-pandora-pair className="relative inline-block" style={{ width: ph, height: ph }}>{fig(PANDORA_DEVIL_IMG, 'devil', 0)}{fig(PANDORA_ANGEL_IMG, 'angel', ph - pw)}</span>;
              })() : null;
              return(<button key={i} data-slot-index={i} data-slot-assignable={pendingCard!=null&&canAssign?'true':undefined} data-tactics-ex-on={slotExInfo&&slotExInfo.active&&slotExInfo.def?(slotExInfo.def.effect||'default'):undefined} data-tactics-aimed={slotAimed?'true':undefined} data-distance-broken={distanceBroken?'true':undefined} data-distance-break-level={distanceBroken?distanceBreakLevel:undefined} aria-label={`${RANGE_LABELS[i]}距離${distanceBroken?`（BREAK Lv${distanceBreakLevel}・与ダメージ${distanceBreakPercent}%）`:''}`} onClick={()=>{
                if(isBusy||autoBattleRef.current)return;
                if(pendingCard!=null && canAssign){
                  setCardAssignments(p=>({...p,[pendingCard]:i}));
                  setPendingCard(null);
                  setFocusedCard(null);
                  Audio_.se.card();
                  setSlotSettle(i);
                  setTimeout(()=>{ setSlotSettle(null); }, 500);
                } else if(pendingCard==null && !dragState?.active && tacticsExInfo && tacticsExInfo(i)){
                  // ★カードを置く途中でないときだけ、その子のEXスキルの詳細を開く(タクティクス専用)。
                  //   カードの置き先を選んでいるときのタップは、今までどおりカードの置き場所の操作にする
                  setExPanelSlot(i);
                  // 自分で開けたなら、使い方案内はもう要らない
                  if(tacticsExIntroVisible&&dismissTacticsExIntro) dismissTacticsExIntro();
                } else if(pendingCard==null && !dragState?.active && battleTutorialStep==null && typeof battleUnitStatusOf==='function' && battleUnitStatusOf(i)){
                  // ★EXを持たない子・タクティクス以外のモードは、カードを置く途中でないときのタップで能力と効果の詳細を開く(2026-10-13)
                  setUnitDetail({side:'ally',slot:i});
                }
              }} disabled={isBusy||autoBattle} className={`relative ${tacticsNewLayout?'rounded-[18px] border grid grid-cols-[40%_60%] grid-rows-[18px_minmax(0,1fr)] items-stretch bg-[linear-gradient(145deg,rgba(15,23,42,.88),rgba(5,10,24,.96))] backdrop-blur-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,.09),inset_0_0_18px_rgba(99,102,241,.035),0_7px_20px_rgba(0,0,0,.24)]':'rounded-2xl border-2 flex flex-col items-stretch'} overflow-visible transition-all ${RANGE_STYLES[i].slotGlow||''} ${tacticsNewLayout?'':RANGE_STYLES[i].bg} ${distanceBroken?'border-red-400':tacticsNewLayout?'border-white/[.10]':' '+RANGE_STYLES[i].border} ${(canAssign||(dragState?.active&&dragOverSlot===i))?'ring-2 ring-yellow-400 scale-105 z-10 shadow-lg animate-pulse':'opacity-100'} ${assignedCount>0?'ring-2 ring-indigo-500/80':''} ${tacticsNewLayout&&!s?'opacity-65 shadow-none border-white/[.06]':''} ${dragState?.active&&dragOverSlot===i?'ring-4 ring-green-400 scale-110':''} ${slotSettle===i?'ring-4 ring-white':''}`} style={{...((isAnimating&&!tacticsNewLayout?{zIndex:9999, animation:themedAttack?undefined:attackMotionAnimation(attackAnim), ...attackAimStyle}:(distanceBroken?{backgroundColor:distanceBreakLevel>=2?'rgb(12,2,5)':'rgb(24,5,25)',boxShadow:`inset 0 0 0 ${Math.min(4,distanceBreakLevel+1)}px rgba(248,113,113,.95), inset 0 0 ${28+distanceBreakLevel*8}px rgba(76,5,25,.98), 0 0 ${9+distanceBreakLevel*4}px rgba(220,38,38,.65)`,...(slotHitShake||{})}:(slotSettle===i?{animation:'slotSettle 400ms ease-out'}:(slotHitShake||undefined))))||{}), ...(isAnimating&&tacticsNewLayout?{zIndex:6500}:{})}}>
                {/* ★狙われている枠。カードを置ける黄色の輪・ドラッグ中の緑の輪と重ならないよう、
                    輪ではなく枠の内側の線で出す(BREAKと同じ出し方)。全体攻撃なら全員に付く */}
                {/* ★食らった子の枠そのものを光らせる。数字は一瞬で読み取れないので、
                    色と輪で「どこを見ればよいか」を先に伝える(2026-09-22 ユーザー指示
                    「食らったモンスターにエフェクトなどがつくようにしたい」)。
                    数字(z-[70])より下へ重ねて、数字が読めなくならないようにする */}
                {/* EXスキルを使った子の枠の光(カットインと同じ色。TacticsExCutin と同じ時間で消える) */}
                {/* アシストカード・緊急回復のカットインは、効き目が乗る枠をまとめて光らせる(slotIndexes) */}
                {tacticsExCutin&&(tacticsExCutin.slotIndex===i||(tacticsExCutin.slotIndexes||[]).includes(i))&&<span key={tacticsExCutin.key} data-tactics-ex-aura={tacticsExCutin.effect||'default'} className="ex-aura" aria-hidden="true"
                  style={{'--ex-c1':battleCutinThemeOf(tacticsExCutin).c1,'--ex-c2':battleCutinThemeOf(tacticsExCutin).c2,...(tacticsExCutin.ms?{animationDuration:`${tacticsExCutin.ms}ms`}:{})}}><i/><i/></span>}
                {/* ★貯まった数(クッキー・黒音符など)を「マーク×数」で常に出す(2026-10-12 社長の依頼)。タクティクスの枠は絵の左下、ほかのモードの縦長の枠は名前の帯のすぐ下(下の端は間合いの札がある) */}
                {/* ★クラシックなど縦長の枠は、下の縦積みの欄(data-tactics-slot-marks)の先頭へ入れる(予測ダメージ・置いたカードと重ならない。2026-10-13) */}
                {tacticsNewLayout&&<BattleStackMarks counts={allyStackCounts[i]} side="ally" full={SWEET_STACK_MAX} className="mh-stack-marks-ally"/>}
                {/* モンスターごとの演出(ゴーストの分身・スネグーラチカのプレゼント・剣士モッチーの型)。タクティクスの枠だけ・軽量表示では出さない */}
                {tacticsNewLayout&&!ecoBattleView&&!liteBattleView&&typeof tacticsSlotCountersAt==='function'&&<BattleMonsterFx fx={debugStackMarks&&debugStackMarks.fx&&debugStackMarks.fx[i]?debugStackMarks.fx[i]:tacticsSlotCountersAt(i)} imgSrc={s?.imgUrl} monId={s?.id} stacks={allyStackCounts[i]} calm={battleFx.idleMotion==='OFF'}/>}
                {slotHitKind&&(()=>{
                  const hitFx=TACTICS_SLOT_FX_STYLE[slotHitKind];
                  return(<div data-tactics-hit-fx={slotHitKind} className="absolute inset-0 z-[58] pointer-events-none overflow-visible">
                    <div className="absolute inset-0 rounded-xl" style={{background:`radial-gradient(circle at 50% 50%, rgba(${hitFx.rgb},0.65) 0%, rgba(${hitFx.rgb},0.3) 45%, rgba(0,0,0,0) 75%)`,animation:'tacticsHitFlash 520ms ease-out forwards'}}></div>
                    <div className={`absolute inset-0 rounded-xl border-2 ${hitFx.edge}`} style={{animation:'tacticsHitEdge 620ms ease-out forwards'}}></div>
                    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
                      <div className={`rounded-full border-2 ${hitFx.ring}`} style={{width:'44px',height:'44px',animation:'tacticsHitRing 520ms ease-out forwards'}}></div>
                      {/* 輪を少し遅らせて2枚重ねると「衝撃が広がる」感じが出る。省エネ表示では1枚だけ */}
                      {!ecoBattleView&&<div className={`absolute rounded-full border-2 ${hitFx.ring}`} style={{width:'44px',height:'44px',animation:'tacticsHitRing 520ms ease-out 110ms forwards'}}></div>}
                    </div>
                  </div>);
                })()}
                {/* ★このターン、この子に何が起きたか(2026-09-21 ユーザー指摘
                    「個別ダメージと全体ダメージで誰に何が起きてるか分かりにくい」)。
                    合計の数字は画面のまんなかに出したままなので、
                    「全体で何点減ったか」と「誰が減ったか」の両方が読める */}
                {/* ★名前の行のすぐ下の段。左に「こちらが出すぶん」(攻・守の予測)、右に「受けるぶん」(🎯)。
                    (2026-09-24 ユーザー指示「ダメージだけは1列分まるまる使って」「右寄せて数値が増えたら
                    枠いっぱいまで使える仕様。ただし左側の別の表示(味方攻撃等)との位置かぶりがないように」)
                    ★1本の flex の段に並べるので、🎯が伸びても左の札の手前で止まり、重ならない。
                      入り切らないときは🎯の内訳のほうから「…」で縮む(合計の数字は縮めない) */}
                {/* 狙われる確率(%)はこの段の左端に置く(名前の行に入れると、狭い端末で名前が「モッ…」まで縮む・2026-10-22) */}
                {tacticsNewLayout&&(previewDmg>0||previewGuard>0||slotAimHit||hateFlame)&&(<div data-tactics-slot-top-row className="absolute left-1 right-1.5 top-[20px] z-[63] flex h-[13px] items-center gap-1 pointer-events-none">
                  {hateFlame}
                  {(previewDmg>0||previewGuard>0)&&<div data-tactics-image-previews className="flex shrink-0 items-center gap-0.5">{previewDmg>0&&<span data-tactics-damage-preview={previewDmg} className={`rounded px-1 py-0.5 text-[8px] font-black leading-none shadow ring-1 ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'}`}>{isPendingPreview&&isPendingHalved?'½':''}攻{previewDmg}</span>}{previewGuard>0&&<span data-tactics-guard-preview={previewGuard} className="rounded bg-emerald-600 px-1 py-0.5 text-[8px] font-black leading-none text-white shadow ring-1 ring-emerald-200">{isPendingGuardHalved?'½':''}守{previewGuard}</span>}</div>}
                  <div className="flex min-w-0 flex-1 justify-end">{slotAimHit&&<span data-tactics-aimed-damage={slotAimHit.taken} data-tactics-aimed-parts={slotAimHit.parts.length>1?slotAimHit.parts.join('/'):undefined} className="inline-flex h-[13px] max-w-full min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap rounded border border-red-300 bg-red-950 px-1 text-[9px] font-black leading-none text-red-100 shadow"><span className="shrink-0">🎯{slotAimHit.taken>0?`-${tacticsAimNum(slotAimHit.taken)}`:''}</span>{slotAimHit.parts.length>1?<span className="min-w-0 truncate text-[7px] font-bold text-red-200/85">{tacticsAimParts(slotAimHit.parts,tacticsAimNum(slotAimHit.taken))}</span>:null}</span>}</div>
                </div>)}
                {copyChip}
                {/* 効果の光。吹き出しが出るたびに key が変わるので、同じ効果が続いても毎回光り直す。
                    緊急回復・回復カードの戻り(tacticsSlotFx の heal/guts)もここで光らせる */}
                {tacticsNewLayout&&(()=>{
                  const last=popups.filter(p=>p.slot===i&&p.side!=='enemy').slice(-1)[0];
                  const f=tacticsSlotFx&&tacticsSlotFx[i];
                  let kind=last?tacticsAuraKindOf(last.text,last.side):null, key=last?`p${last.id}`:null;
                  if(!kind&&f&&(f.heal>0||f.revive>0)){ kind='heal'; key=`fh${f.heal||0}-${f.revive||0}`; }
                  else if(!kind&&f&&f.guts>0){ kind='guts'; key=`fg${f.guts}`; }
                  return kind?<span key={key} aria-hidden="true" data-slot-aura={kind}/>:null;
                })()}
                {/* ★新しい盤面(2×2)では、このターンの出来事・技名・その子の効果の吹き出しを
                    **ライフ・ガッツの行より上**の1本の縦積みにまとめる(2026-09-23 ユーザー指示
                    「敵への効果は敵の辺り、味方への効果は対象の味方や使ったモンスター」)。
                    それまでは技名が4列前提の固定位置に、効果の吹き出しが盤面のまんなかに出ていて、
                    別の子の枠やライフの数字に乗っていた。覆ってよいのは絵と札だけ */}
                {(()=>{
                const slotFxEl=tacticsSlotFx&&tacticsSlotFx[i]&&(()=>{
                  const f=tacticsSlotFx[i];
                  const hitSpans=Array.isArray(f.hits)&&f.hits.length>1
                    ? f.hits.map((value,hitIndex)=><span key={hitIndex} className={`${tacticsNewLayout?'text-[14px]':'text-[15px]'} font-black text-pink-400 leading-none drop-shadow-[0_0_6px_rgba(0,0,0,.95)]`}>-{value}</span>)
                    : null;
                  return (<div data-tactics-slot-fx={i} className={`${tacticsNewLayout?'relative max-w-full':'absolute inset-x-0 top-1/2 -translate-y-1/2 z-[70]'} pointer-events-none flex flex-col items-center gap-0.5`}>
                    {f.evade?<span className="text-[11px] font-black text-blue-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">回避！</span>
                      :f.reflect?<span className="text-[11px] font-black text-purple-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">反射！</span>
                      :<>
                        {f.guard&&<span className="text-[11px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">🛡</span>}
                        {/* ★連撃は1ヒットずつ並べる(60が3ヒットなら 20/20/20)。
                            まとめて1つの数字にすると、3回殴られたことが読めない */}
                        {/* 新しい盤面は横へ並べる(縦に積むと3ヒットでライフの行まで届く) */}
                        {hitSpans
                          ? (tacticsNewLayout?<span className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">{hitSpans}</span>:hitSpans)
                          : (f.dmg>0&&<span className="text-[17px] font-black text-pink-400 drop-shadow-[0_0_6px_rgba(0,0,0,.95)]">-{f.dmg}</span>)}
                        {f.heal>0&&<span className="text-[11px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">💚 +{f.heal}</span>}
                        {f.guts>0&&<span className="text-[10px] font-black text-amber-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">⚡ +{f.guts}</span>}
                        {f.revive>0&&<span className="text-[12px] font-black text-teal-300 drop-shadow-[0_0_6px_rgba(0,0,0,.9)]">💤 +{f.revive}</span>}
                      </>}
                  </div>);
                })();
                if(!tacticsNewLayout) return slotFxEl;
                const skillHere=slotSkill&&slotSkill.slotIndex===i&&!(slotSkill.aiCopy&&tacticsCopyOutside)?slotSkill:null;
                // ライフの行より上に収まるのは2段まで。技名やこのターンの出来事が出ているときは
                // 吹き出しを最新の1つにする(3段にすると上が切れて読めなかった)。残りはログで読める
                const ownPopups=popups.filter(p=>p.slot===i&&p.side!=='enemy').slice((skillHere||slotFxEl)?-1:-2);
                if(!slotFxEl&&!skillHere&&!ownPopups.length) return null;
                return (<div data-tactics-slot-popups={i} className="absolute inset-x-1 top-[20px] bottom-[34px] z-[70] pointer-events-none flex flex-col items-center justify-end gap-0.5 overflow-hidden">
                  {skillHere&&<div data-tactics-slot-skill={i} className={`max-w-full truncate rounded-lg border px-2 py-0.5 text-[11px] font-black leading-tight shadow-[0_2px_10px_rgba(0,0,0,.7)] ${skillHere.type==='unique'?'bg-purple-700 border-purple-200 text-white':skillHere.type==='special'?'bg-amber-600 border-amber-200 text-white':'bg-red-700 border-red-200 text-white'}`}
                    style={{animation:liteBattleView?undefined:'tacticsPopupRise 220ms ease-out'}}>{skillHere.name}</div>}
                  {slotFxEl}
                  {ownPopups.map(p=>(<div key={p.id} className={`${tacticsPopupTone(p.color)} max-w-full truncate whitespace-nowrap rounded-full border border-white/15 bg-slate-950/90 px-2 py-0.5 text-[11px] font-black leading-tight shadow-[0_2px_10px_rgba(0,0,0,.6)]`}
                    style={{animation:liteBattleView?undefined:'tacticsPopupRise 240ms ease-out'}}>{p.text}</div>))}
                </div>);
                })()}
                {/* ★数字の札は下の「枠の中の札」へまとめてある。ここは輪だけ。
                    それまでは狙いの札だけ枠の側に absolute で浮かせていたので、
                    連撃で2行になると下の札(置いたカード・予想ダメージ)へ乗っていた
                    (2026-09-22 ユーザー指摘「表示が被ってて見えない」) */}
                {slotAimed&&<div data-tactics-aimed-ring className="absolute inset-[2px] rounded-lg border-2 border-red-400/80 pointer-events-none z-[44] animate-pulse" style={{boxShadow:'inset 0 0 10px rgba(239,68,68,.55)'}}></div>}
                {distanceBroken&&<>
                  <div className="absolute inset-0 rounded-lg pointer-events-none z-[15]" style={{background:`repeating-linear-gradient(${135+distanceBreakLevel*12}deg,rgba(0,0,0,.12) 0 ${Math.max(3,8-distanceBreakLevel)}px,rgba(127,29,29,${Math.min(.8,.28+distanceBreakLevel*.14)}) ${Math.max(4,9-distanceBreakLevel)}px ${Math.max(5,10-distanceBreakLevel)}px),radial-gradient(circle at 50% 40%,rgba(${distanceBreakLevel>=2?'69,10,10':'88,28,135'},.55),rgba(5,0,2,.9))`}}></div>
                  <div className="absolute inset-[2px] rounded-lg border border-red-300/80 pointer-events-none z-[45]" style={{boxShadow:'inset 0 0 12px rgba(239,68,68,.7)'}}></div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[65] whitespace-nowrap rounded-full border-2 border-red-200 bg-red-950 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,.9)]">{distanceBreakLevel===1?'⚠':'☠'} BREAK {distanceBreakRoman}｜与ダメ {distanceBreakPercent}%</div>
                  {!s&&<div className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none text-red-200/80"><span className="text-2xl font-black">⚠</span></div>}
                </>}
                {/* 名前の行。勇者モンには王冠を付ける。どれが勇者モンか分からないと
                    「勇者モン選択時だけ効く特性」が効いているのか判断できないため */}
                {/* 縁を回る光。回すのは中の大きな光の輪(transform)だけにして、塗りを毎コマ描き直さない(70-bootstrap の data-slot-ring) */}
                {tacticsNewLayout&&<i aria-hidden="true" data-slot-ring/>}
                <div data-slot-head={tacticsNewLayout?i:undefined} className={`${tacticsNewLayout?'col-span-2 row-start-1 h-[18px] justify-start gap-0.5 pr-1 backdrop-blur-sm':'h-[18px] justify-center'} shrink-0 flex items-center px-1 border-b z-20 ${isHeroSlotMon(s)?'bg-amber-400/10 border-amber-200/20':'bg-white/[.025] border-white/[.055]'}`}>{tacticsNewLayout&&<span className={`mr-1 shrink-0 rounded px-1 py-0.5 text-[8px] font-black leading-none ${RANGE_STYLES[i].labelBg}`}>{RANGE_LABELS[i]}</span>}{isHeroSlotMon(s)&&<Crown size={8} className="shrink-0 mr-0.5 text-amber-300"/>}<span className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap font-black uppercase leading-none [container-type:inline-size] ${tacticsNewLayout?'':'text-center'} ${isHeroSlotMon(s)?'text-amber-100':'text-white'}`}><span className="block" style={{fontSize:`min(10px, calc(100cqw / ${[...String(s?.name||'---')].length+0.3}))`}}>{s?.name||'---'}</span></span>{hateFlame&&!tacticsNewLayout&&hateFlame}{assignedCount>0&&!tacticsNewLayout&&<span className="ml-1 text-[10px] font-black text-indigo-300">×{assignedCount}</span>}{slotBuffMarks.map(mark=>(<span key={mark.text} data-tactics-slot-buff={mark.text} className={`ml-1 shrink-0 text-[8px] font-black leading-none ${mark.cls}`}>{mark.text}</span>))}{tacticsNewLayout&&slotExInfo&&(<span data-slot-head-right className="ml-auto flex shrink-0 items-center gap-0.5 pl-0.5">{slotExInfo&&(<span data-tactics-ex-mark={i} data-tactics-ex-state={slotExInfo.badge.text} className={`max-w-[80px] truncate rounded px-1 py-0.5 text-[8px] font-black leading-none ${slotExInfo.badge.active?'bg-fuchsia-600 text-white ring-1 ring-fuchsia-200':'bg-black/70 text-fuchsia-200 ring-1 ring-fuchsia-400/60'}`}>EX{slotExInfo.badge.text!=='EX'?` ${slotExInfo.badge.text}`:(slotExInfo.badge.uses!=null?`×${slotExInfo.badge.uses}`:'')}</span>)}</span>)}</div>
                {(()=>{const uOptions=getAvailableUniquesForSlot(s,ownedUniques,i); if(uOptions.length<2) return null; const curKey=activeSlotUniqueKey(slotUniqueChoice,i,s); const curIdx=Math.max(0,uOptions.findIndex(o=>o.key===curKey));
                  return(<div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); if(isBusy||autoBattleRef.current)return; cycleActiveUniqueForSlot(i);}} className={`${tacticsNewLayout?'absolute left-1 top-[20px]':'shrink-0'} z-20 flex items-center justify-center gap-0.5 bg-purple-700/90 border-b border-purple-300/50 py-0.5 active:scale-95${autoBattle?' opacity-40':''}`}>
                    <RefreshCcw size={7} className="text-white"/><span className="text-[10px] font-black text-white leading-none">固有技 {curIdx+1}/{uOptions.length}</span>
                  </div>);
                })()}
                <div data-tactics-attack-content={tacticsNewLayout?'content-only':undefined} className={`${tacticsNewLayout?'col-start-1 row-start-2 min-h-0':'flex-1'} flex flex-col items-center justify-center relative`}>
                  {slotSettle===i&&(
                    <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-visible">
                      <div className="absolute rounded-full border-4 border-cyan-300" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out forwards'}}></div>
                      <div className="absolute rounded-full border-2 border-white" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out 80ms forwards'}}></div>
                      <div className="absolute w-8 h-8 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-[0_0_16px_rgba(103,232,249,0.9)]" style={{animation:'setPop 500ms cubic-bezier(.2,1.5,.4,1) forwards'}}><Check size={18} className="text-white" strokeWidth={4}/></div>
                    </div>
                  )}
                  <div className={`absolute inset-0 rounded-[17px] ${RANGE_STYLES[i].slotBg} ${tacticsNewLayout?'opacity-[.07]':'opacity-20'} pointer-events-none`}></div>
                  {/* ★この枠のガードの「まとめ」(2026-09-22 の新仕様)。
                      2枚以上構えた枠は連撃ガードなので**合計値**を出す(ユーザー指示
                      「連撃ガード1987が良いんだけどガードタップ時は単体数値がいくつかは
                      わかるようにして」…カードごとの単体値は下の札にそのまま残る)。
                      ★全体ガードになったら**立っている子全員**に出す(2026-09-22 ユーザー指示
                      「全体ガードになったときは全味方モンスターに軽減値を出して」)。
                      構えた子も構えていない子も、その子の丈夫さで軽減量が違うため。
                      全体ガードでない1枚だけの枠は、カードの札と同じ数字になるので出さない。
                      ★空き枠・倒れた子には出ない(tacticsSlotGuardValue が0を返す) */}
                  {guardPlanBySlot&&(()=>{
                    if(!slotRushGuard&&!slotSpreadGuard) return null;
                    const gv=tacticsSlotGuardValue(guardPlanBySlot,i);
                    if(!(gv>0)) return null;
                    return <div data-tactics-guard-total={gv} data-tactics-guard-kind={slotRushGuard?'rush':'spread'}
                      className={`absolute ${tacticsNewLayout?'left-1 top-[35px]':'bottom-0.5 left-0.5'} z-[61] rounded border px-1 py-0.5 font-black leading-none pointer-events-none ${slotRushGuard?'border-amber-200 bg-amber-600/95 text-white':'border-sky-300/60 bg-sky-800/90 text-sky-50'}`}
                      style={{fontSize:'7px'}}>🛡 {slotRushGuard?'連撃ガード':'全体'} {gv}</div>;
                  })()}
                  {/* ★枠の中に出すものは、ぜんぶこの1本の縦積みに入れる(2026-09-22 ユーザー指摘
                      「表示が被ってて見えない」)。それまでは「置いたカードの札」「予想ダメージ」
                      「狙われている印」を別々に absolute で置き、上からの距離(top-0 / top-[18px] /
                      top-[21px])で避けていた。札が2枚になる・連撃で2行になると必ず重なる。
                      縦積みなら、いくつ増えても順番に下へ伸びるだけで重ならない。
                      ★絵の上には乗る。文字どうしが重ならなければ読めるので、
                        覆ってよいのは絵だけ、という切り分けにしている */}
                  {/* ★EXスキルの札も同じ縦積みの先頭に入れる。名前の行へ入れると名前が切れる
                      (2026-09-23 ユーザー指摘「名前が切れてる」)。二刀流／片手持ちのような「いまの状態」をここで出す */}
                  {(slotAssignedCards.length>0||previewDmg>0||previewGuard>0||slotAimHit||slotExInfo||(!tacticsNewLayout&&battleStackMarkItems(allyStackCounts[i]).length>0))&&(
                    <div data-tactics-slot-marks className={`${tacticsNewLayout?`absolute left-full w-[150%] overflow-hidden items-stretch justify-start px-1.5 ${(slotAimHit||previewDmg>0||previewGuard>0)?'top-[15px] h-[calc(100%-46px)]':'top-px h-[calc(100%-31px)]'}`:'absolute top-0 left-0 right-0 items-center px-0.5'} flex flex-col gap-px z-[60] pointer-events-none`}>
                      {/* ★置いたカードは2列×3段(2026-09-24 ユーザー指示「ダメージ予測を1番上に置いて、その下に2列3段」
                          「カード×4とかは確かにいらない」)。ガードやアシストカードを足すと1体に5枚まで置けるので、
                          1枚1段ではライフ・ガッツの行まで届いていた。高さはライフの行の上までに切ってある。
                          🎯は枠の横幅をまるごと使う上の段(data-tactics-slot-top-row)へ出す */}
                      {!tacticsNewLayout&&<BattleStackMarks counts={allyStackCounts[i]} side="ally" full={SWEET_STACK_MAX} className="mh-stack-marks-flow"/>}
                      {!tacticsNewLayout&&slotExInfo&&(<div data-tactics-ex-mark={i} data-tactics-ex-state={slotExInfo.badge.text}
                        className={`flex max-w-full items-center gap-0.5 rounded px-1 py-0.5 leading-none shadow ${slotExInfo.badge.active?'bg-fuchsia-600 text-white ring-1 ring-fuchsia-200':'bg-black/70 text-fuchsia-200 ring-1 ring-fuchsia-400/60'}`}>
                        <span style={{fontSize:'7px'}} className="shrink-0 font-black">EX{slotExInfo.badge.text==='EX'&&slotExInfo.badge.uses!=null?`×${slotExInfo.badge.uses}`:''}</span>
                        {slotExInfo.badge.text!=='EX'&&<span style={{fontSize:'8px'}} className="truncate min-w-0 font-black">{slotExInfo.badge.text}</span>}
                      </div>)}
                      {(()=>{const chipEls=slotAssignedCards.map(({idx,card})=>{
                        // ガードは軽減量をその場で出す。2枚目以降なら半分になった値をそのまま表示する
                        const gw=guardCardWeight(card), ge=cardEffectMultiplier(card,halvedByIdx[idx]);
                        const gv=gw>0?guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge,i):0;
                        // ★ガードが連撃・全体に変わったら、札に印を付ける(2026-09-22 ユーザー選択
                        //   「名前＋印に分ける」)。段階の名前は9つあり、後半は「ガード」が付かない
                        //   (金剛不壊・万象拒絶…)ので、名前そのものは変えずにとなりへ印を出す。
                        // ★全体ガードの枠は、軽減量を上の🛡が立っている子全員に出すので札には数字を重ねない。
                        //   連撃ガードの枠だけは1枚ずつの値が要る(合計は🛡に出るため)ので今までどおり
                        const guardMark=gw>0?(slotRushGuard?'連撃':(slotSpreadGuard?'全体':'')):'';
                        const spreadGuardCard=gw>0&&slotSpreadGuard&&!slotRushGuard;
                        return(
                        <div key={idx} className={`flex items-center gap-0.5 rounded w-full min-w-0 ${tacticsNewLayout?'h-[9px] justify-start overflow-hidden px-0.5':'px-1 justify-center'} ${cardNeedsMonster(card)?'bg-red-600/85':'bg-emerald-600/85'}`}>
                          <span style={{fontSize:'7px'}} className="leading-none shrink-0">{cardIconNode(card.icon,tacticsNewLayout?8:9,card.id)}</span>
                          {guardMark&&<span data-tactics-guard-mark={guardMark} style={{fontSize:'6px'}} className="shrink-0 rounded-sm border border-amber-200/70 bg-black/60 px-0.5 font-black leading-none text-amber-200">{guardMark}</span>}
                          <span style={{fontSize:'7px'}} className="font-black text-white leading-none truncate min-w-0">{halvedByIdx[idx]?'½':''}{card.name}</span>
                          {gv>0&&!spreadGuardCard&&<span style={{fontSize:'7px'}} className="font-black text-emerald-100 leading-none shrink-0">-{gv}</span>}
                        </div>
                        );
                      });
                      return tacticsNewLayout?(chipEls.length>0&&<div data-tactics-slot-chips={chipEls.length} className="grid w-full grid-cols-2 gap-px">{chipEls}</div>):chipEls;})()}
                      {/* 数字の段。左＝こちらが出すぶん、右＝相手から受けるぶん。
                          横に並べて場所を分けるので、両方出ても重ならない */}
                      {!tacticsNewLayout&&(previewDmg>0||previewGuard>0||slotAimHit)&&(
                        <div className="flex w-full flex-wrap items-start justify-between gap-0.5">
                          {/* ★枠は4つ並ぶので1つ87pxしかない。字を8pxまで落として、
                              出すぶんと受けるぶんが**横1行に収まる**ようにしてある。
                              入り切らなければ折り返すので、重なることはない */}
                          {previewGuard>0&&(<div data-tactics-guard-preview={previewGuard}
                            className="rounded bg-emerald-500 px-0.5 py-0.5 text-[8px] font-black leading-none text-black shadow ring-1 ring-emerald-100">{isPendingGuardHalved?'½':''}守{previewGuard}</div>)}
                          {previewDmg>0&&(<div data-tactics-damage-preview={previewDmg}
                            className={`rounded px-0.5 py-0.5 text-[8px] font-black leading-none shadow ring-1 ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'}`}>{isPendingPreview&&isPendingHalved?'½':''}攻{previewDmg}{isPendingPreview&&previewSoulPct>0&&<span data-soul-damage-preview className="ml-0.5 rounded bg-sky-950/80 px-0.5 text-[7px] text-sky-100">魂格+{previewSoulPct}%</span>}</div>)}
                          {slotAimHit&&(<div data-tactics-aimed-damage={slotAimHit.taken} data-tactics-aimed-parts={slotAimHit.parts.length>1?slotAimHit.parts.join('・'):undefined}
                            className="ml-auto flex flex-col items-center gap-0.5 rounded border border-red-300 bg-red-950 px-0.5 py-0.5 text-[8px] font-black leading-none text-red-100 shadow-[0_0_8px_rgba(239,68,68,.85)] animate-pulse"><span>🎯{slotAimHit.taken>0?`-${slotAimHit.taken}`:''}</span>{slotAimHit.parts.length>1&&<span className="text-[7px] font-bold text-red-200/90">{slotAimHit.parts.join('・')}</span>}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 固有技をセットした枠のオーラ。⚡は絵(飾り)なので data-decoration。
                      ★重ね順は文字より下(z-[5])にする。それまでは z-40 で、置いたカードの札や
                        間合いの補正の上を回っていた(2026-09-22 ユーザー指摘「表示が被ってて見えない」) */}
                  {!ecoBattleView&&hasUniqueSet&&(
                    <div data-decoration aria-hidden="true" className="absolute inset-0 pointer-events-none z-[5] flex items-center justify-center overflow-visible">
                      <div className="absolute inset-0 rounded-xl" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(99,102,241,0.28) 50%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-0.5 rounded-xl border-2 border-purple-400/80" style={{animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      {[0,90,180,270].map(deg=>(
                        <div key={deg} className="absolute text-base" style={{transform:`rotate(${deg}deg) translateY(-26px)`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                    </div>
                  )}
                  {/* 距離補正は0%でも出す(「補正が無い」ことも情報なので、枠ごとに常に見えるようにする) */}
                  {(()=>{const totalBonus=distTotalBonus(i); return(<div className={`absolute bottom-0.5 right-0.5 text-[11px] font-black leading-none flex items-center gap-0.5 bg-black/50 px-1 py-0.5 rounded border z-30 ${totalBonus>0?'text-cyan-300 border-cyan-400/30':totalBonus<0?'text-red-300 border-red-400/30':'text-slate-300 border-white/20'}`}><Sword size={5}/>{totalBonus>0?'+':''}{(totalBonus*100).toFixed(1)}%</div>);})()}
                  {/* ★新しい盤面では攻撃モーションを**絵だけ**に掛ける(2026-09-24 ユーザー選択「攻撃時に札を跳ねさせない」)。
                      それまでは絵のある左の列ごと動かしていたので、距離補正の札や置いたカードの札まで
                      大きくなって飛び、名前の行を隠していた。古い盤面は今までどおり枠ごと動かす */}
                  {/* 足元の魔法陣(新しい盤面の飾り)。絵と一緒に跳ねないよう、動く絵の外に置く */}
                  {tacticsNewLayout&&s&&<span aria-hidden="true" data-slot-circle/>}
                  <div data-tactics-attack-image={tacticsNewLayout?i:undefined} className="relative flex items-center justify-center" style={{...(s?slotArtBox:{}),...(isAnimating&&tacticsNewLayout&&!pandoraArt?{zIndex:9999,animation:themedAttack?undefined:attackMotionAnimation(attackAnim),...attackAimStyle}:{}),...(pandoraArt&&isAnimating?{zIndex:9999}:{})}}>{pandoraArt?pandoraArt:s?.imgUrl?(isAnimating&&s.id==='Pandora'&&attackAnim.motion==='pandoraDualThunder'
                    ?<PandoraDualThunder image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="object-contain drop-shadow-md"/>}/>
                    :isAnimating&&attackAnim.motion==='arkHolyRain'
                      ?<ArkHolyRainMotion
                        image={slotArt(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>)}
                        charging={attackAnim.charge===true}
                        empowered={attackAnim.charge===false}/>
                    :isAnimating&&attackAnim.motion==='waterBurst'
                      ?<WaterBurstMotion
                        image={slotArt(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>)}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                    :isAnimating&&attackAnim.motion==='miaSongNotes'
                      ?<MiaSongNotesMotion
                        image={slotArt(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>)}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                    :themedAttack
                      ?<ThemedAttackMotion kind={themedAttack} lunge={attackAnim.charge===false} image={slotArt(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>)}/>
                      :slotArt(<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:tacticsNewLayout?'58px':'64px',height:tacticsNewLayout?'58px':'64px'}} className="z-10 object-contain drop-shadow-md"/>)):(<span style={{fontSize:'40px'}} className="z-10 drop-shadow-md">{s?.emoji||''}</span>)}
                  {/* 剣士モッチーの二刀流の軌跡。エイキの桜と同じく攻撃中だけ重ねる。
                      ★動く絵の中に置く。新しい盤面は絵だけが敵へ飛ぶので、枠の側に置くと斬撃が枠に残って敵に届かない */}
                  {/* ガードのバリア(2026-09-29 ユーザー選択「案A バリア」)。構えているあいだは idle、敵の攻撃を受けたら
                      受け止めきった(block)・割れた(break)。画面を軽くする設定では出さない */}
                  {s&&!ecoBattleView&&(()=>{
                    const tier=guardBarrierTierOf(guardLevel);
                    const impact=guardImpact?.bySlot?.[i];
                    if(impact) return <GuardBarrier key={`gi-${guardImpact.key}`} tier={tier} state={impact}/>;
                    return !isBusy&&guardBarrierOnAt(i)?<GuardBarrier tier={tier} state="idle"/>:null;
                  })()}
                  {isAnimating&&attackAnim.twinBlade&&<KenshiTwinSlash/>}
                  {/* エイキの桜。攻撃モーションが出ているあいだだけ重ねる(常時アニメーションにしない) */}
                  {isAnimating&&attackAnim.sakura&&<EikiSakuraPetals/>}</div>
                  {/* 倒れた子。カードを置けないことが一目で分かるように覆う */}
                  {tacticsUnit&&tacticsUnit.downed&&(()=>{
                    const revivePct=tacticsUnit.maxHp>0?Math.floor((tacticsUnit.hp/tacticsUnit.maxHp)*100):0;
                    return(<div data-tactics-down-mark={i} data-tactics-revive={`${revivePct}`}
                      className="absolute inset-0 z-[62] flex flex-col items-center justify-center rounded-xl bg-black/70 pointer-events-none">
                      <span className="text-[11px] font-black tracking-[.2em] text-slate-200">ダウン</span>
                      {/* 「全快になったら復活」なので、あとどれだけかを出さないと回復を回す判断が立たない */}
                      <span className="text-[9px] font-black text-emerald-300 leading-tight">復活まで {100-revivePct}%</span>
                    </div>);
                  })()}
                </div>
                {/* ライフとガッツ(2026-09-22 ユーザー指摘「距離いれると縦が狭くなりすぎる」)。
                    ★もとは枠の上に**別の段**として4列並べていた。同じ4列が2段あるだけで、
                      枠1つぶん(55px)と余白を丸ごと使っていたので、カードの中へ入れて段を1つ減らした。
                    ★数字の大きさは前の段とほぼ同じ(10px)。小さくすると瀕死に気づけなくなるので、
                      縮めるのは**帯の高さと余白のほう**にする。
                    ★帯は必ずアニメーションさせる(ライフ duration-1000 / ガッツ duration-500)。
                      でないと回復もダメージも瞬間で増減して見える。
                    ★data-tactics-* は検査の手がかり。枠の位置が変わっても名前は変えない。
                    ★末尾の battleTutorialSpotClass('tacticsParty') は、タクティクスのれんしゅうで
                      「1体ずつのライフ」を説明するときに光らせる印。帯をカードへ入れたときに
                      落とすと、案内が何も指さないまま進む */}
                {tacticsUnit&&(()=>{
                  const hpPct=tacticsUnit.maxHp>0?Math.max(0,Math.min(100,(tacticsUnit.hp/tacticsUnit.maxHp)*100)):0;
                  const gutsPct=tacticsUnit.maxGuts>0?Math.max(0,Math.min(100,(tacticsUnit.guts/tacticsUnit.maxGuts)*100)):0;
                  return(
                    <div data-tactics-party-slot={i}
                      data-tactics-hp={`${tacticsUnit.hp}/${tacticsUnit.maxHp}`}
                      data-tactics-guts={`${tacticsUnit.guts}/${tacticsUnit.maxGuts}`}
                      data-tactics-downed={tacticsUnit.downed?'true':'false'}
                      className={`${tacticsNewLayout?`absolute right-0 bottom-[3px] w-[60%] min-w-0 border-l flex flex-col justify-end py-px px-2 gap-0 backdrop-blur-sm${tacticsCopyOutside?' max-[359px]:px-1 max-[359px]:w-[66%]':''}`:'shrink-0 border-t px-1'} z-20 border-white/[.06] bg-[linear-gradient(90deg,rgba(8,15,31,.86),rgba(15,23,42,.72))]${battleTutorialSpotClass('tacticsParty')}`}>
                      {/* ★「♥ 500 /500」と左右へ散らしていたのを、ラベルと数値の2つにそろえた
                          (2026-09-22 ユーザー指摘「カードも距離枠も全て安っぽくない？」)。
                          読む順が「何の値か → いくつか」で固定され、4枚並べたときに縦がそろう */}
                      <div className="flex h-[10px] items-center justify-between leading-none">
                        <span className="shrink-0 whitespace-nowrap text-[8px] [@media(orientation:landscape)_and_(max-height:520px)]:text-[7px] font-black tracking-wider [@media(orientation:landscape)_and_(max-height:520px)]:tracking-normal text-pink-300">ライフ</span>
                        <span className="font-mono leading-none">{/* ★ミルフィーシールド(ドリーミィのEX)の残り。ライフの数字の前に出す */}
                          {Array.isArray(tacticsShields)&&tacticsShields[i]>0&&<span data-tactics-shield={tacticsShields[i]} className="mr-1 text-[9px] font-black text-sky-200">🛡️{tacticsShields[i]}</span>}
                          <span className="text-[11px] font-black text-white">{tacticsUnit.hp}</span><span className="text-[8px] [@media(orientation:landscape)_and_(max-height:520px)]:text-[7px] text-slate-400">/{tacticsUnit.maxHp}</span></span>
                      </div>
                      <div className="relative h-[2px] overflow-hidden rounded-full bg-black/60" style={{boxShadow:'inset 0 1px 2px rgba(0,0,0,.9)'}}>
                        <div data-tactics-hp-bar className={`h-full w-full origin-left transition-transform duration-1000 ${tacticsUnit.downed?'bg-gradient-to-r from-emerald-500 to-teal-300':'bg-gradient-to-r from-rose-500 to-pink-300'}`} style={{transform:`scaleX(${Math.min(100,Math.max(0,hpPct))/100})`,boxShadow:'0 0 6px rgba(244,114,182,.55)'}}></div>
                        {/* シールドの残りを、ライフの棒の上へ水色の帯で重ねる(最大ライフに対する割合) */}
                        {Array.isArray(tacticsShields)&&tacticsShields[i]>0&&tacticsUnit.maxHp>0&&<div data-tactics-shield-bar className="absolute inset-y-0 left-0 bg-sky-300/80" style={{width:`${Math.min(100,tacticsShields[i]/tacticsUnit.maxHp*100)}%`,boxShadow:'0 0 6px rgba(125,211,252,.8)'}}></div>}
                      </div>
                      <div className="flex h-[10px] items-center justify-between leading-none">
                        <span className="shrink-0 whitespace-nowrap text-[8px] [@media(orientation:landscape)_and_(max-height:520px)]:text-[7px] font-black tracking-wider [@media(orientation:landscape)_and_(max-height:520px)]:tracking-normal text-amber-300">GUTS</span>
                        <span className="font-mono leading-none"><span className="text-[11px] font-black text-white">{tacticsUnit.guts}</span><span className="text-[8px] [@media(orientation:landscape)_and_(max-height:520px)]:text-[7px] text-slate-400">/{tacticsUnit.maxGuts}</span></span>
                      </div>
                      <div className="h-[2px] overflow-hidden rounded-full bg-black/60" style={{boxShadow:'inset 0 1px 2px rgba(0,0,0,.9)'}}>
                        <div data-tactics-guts-bar className="h-full w-full origin-left bg-gradient-to-r from-amber-500 to-yellow-300 transition-transform duration-500" style={{transform:`scaleX(${Math.min(100,Math.max(0,gutsPct))/100})`,boxShadow:'0 0 6px rgba(251,191,36,.55)'}}></div>
                      </div>
                    </div>
                  );
                })()}
                {!tacticsNewLayout&&<div className="h-[20px] shrink-0 ${RANGE_STYLES[i].labelBg} flex items-center justify-center border-t border-white/20 z-20"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">{RANGE_LABELS[i]}距離</span></div>}
              </button>);
            })}
          </div>
          {classicAiCopy&&!tacticsNewLayout&&<ClassicAiCopyCell copy={classicAiCopy} turnCount={turnCount} onOpen={()=>setCopyHandOpen(true)} mon={slots[classicAiCopy.srcSlot]||null}
            hitAnim={!ecoBattleView&&attackAnim&&aiCopyHitting?attackAnim:null}/>}
          {tacticsCopyOutside&&(()=>{
            // 盤の外の5列目(上の TacticsAiCopyColumn)。縦は盤の右、横向きの背の低い画面は盤の下。向きを変えても出し直さずに済むよう両方置いて CSS で切り替える
            const c=shownAiCopy;
            const standing=!!aiCopy&&isTacticsAiCopyStanding(aiCopy)&&aiCopy.spawnTurn<=turnCount;
            const phase=aiCopyViewPhase(c,standing?'idle':'appear');
            const hit=!!(aiCopy&&!ecoBattleView&&attackAnim&&attackAnim.aiCopy);
            const skill=aiCopy&&slotSkill&&slotSkill.aiCopy?slotSkill.name:null;
            const props={copy:c,src:aiCopySrcOf(c,slots),phase,hit,anim:attackAnim,skill,standing:standing||phase==='vanish',onOpen:aiCopy?()=>setCopyHandOpen(true):null};
            return (<>
              {/* タクティクス旧は枠が縦に長く盤の高さからはみ出すので、横向きでも盤の右に置く(下に置くと距離の札に重なった) */}
              <div className={`flex shrink-0 ${tacticsNewLayout?'[@media(orientation:landscape)_and_(max-height:520px)]:hidden':''}`}><TacticsAiCopyColumn {...props} layout="portrait"/></div>
              {tacticsNewLayout&&<div className="hidden shrink-0 [@media(orientation:landscape)_and_(max-height:520px)]:block"><TacticsAiCopyColumn {...props} layout="landscape"/></div>}
            </>);
          })()}
          {/* 手札の窓は body へ出す(横向きでは敵の段の札が枠の並びより上の重なりにあり、窓の上へ出てしまったため) */}
          {aiCopy&&copyHandOpen&&typeof document!=='undefined'&&ReactDOM.createPortal(<SorashidoCopyHandSheet open copyName={aiCopy.name||'仲間'} turnsLeft={aiCopy.turnsLeft}
            cards={Array.isArray(aiCopy.hand)?aiCopy.hand:[]} nextCard={aiCopy.nextCard||null} guts={aiCopy.guts} maxGuts={aiCopy.maxGuts} onClose={()=>setCopyHandOpen(false)}/>,document.body)}
          </div>
        </div>
        {/* タクティクスのEXスキルを持つ子がいる最初のバトルで1度だけ、距離枠から開けることを伝える
            ★縦が短い画面(640px以下)では、案内を盤の下側に重ねて出す。段として場所を取ると、縮められるのが敵の段だけなので
              320×568 で敵の絵が 16px までつぶれていた(2026-10-26 ダメダシの見回り タクティクス#1)。
              みゅあの説明が盤にかかるのは社長の決めごと(コメントはカードなどにかぶらせてよい)。下のモンビーの案内も同じ */}
        {tacticsExIntroVisible&&<div data-tactics-ex-intro className="relative shrink-0 border-t border-fuchsia-400/30 bg-slate-950/95 px-2 py-1 [@media(max-height:640px)]:h-0 [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:border-t-0">
          <div className="flex items-start gap-1 [@media(max-height:640px)]:absolute [@media(max-height:640px)]:inset-x-0 [@media(max-height:640px)]:bottom-0 [@media(max-height:640px)]:z-30 [@media(max-height:640px)]:border-t [@media(max-height:640px)]:border-fuchsia-400/30 [@media(max-height:640px)]:bg-slate-950/95 [@media(max-height:640px)]:px-2 [@media(max-height:640px)]:py-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="tacticsExIntro" compact/></div>
            <button type="button" onClick={dismissTacticsExIntro} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        {/* ∞周回にした最初の1回だけ、モンビーへ行けることを伝える(PR8) */}
        {quickRhythmIntroVisible&&<div data-quick-rhythm-intro className="relative shrink-0 border-t border-fuchsia-400/30 bg-slate-950/95 px-2 py-1 [@media(max-height:640px)]:h-0 [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:border-t-0">
          <div className="flex items-start gap-1 [@media(max-height:640px)]:absolute [@media(max-height:640px)]:inset-x-0 [@media(max-height:640px)]:bottom-0 [@media(max-height:640px)]:z-30 [@media(max-height:640px)]:border-t [@media(max-height:640px)]:border-fuchsia-400/30 [@media(max-height:640px)]:bg-slate-950/95 [@media(max-height:640px)]:px-2 [@media(max-height:640px)]:py-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="quickRhythmIntro" compact/></div>
            <button type="button" onClick={dismissQuickRhythmIntro} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        {/* 手札の帯(2026-09-22 ユーザー指示「全体的に安っぽい作りをなんとかしたい」)。
            まっ黒なべた塗りだったので、上から下へわずかに起こし、上端に細い光を引いて
            板が1枚手前にあるように見せる。塗りだけなので描き直しは起きない */}
        <div data-battle-hand className="shrink-0 p-1 flex flex-col relative border-t border-white/[.08] backdrop-blur-sm" style={{height:'clamp(172px,23dvh,196px)',
          backgroundImage:'linear-gradient(180deg, rgba(20,29,52,.94) 0%, rgba(12,18,34,.97) 52%, rgba(7,11,22,.99) 100%)',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.07), 0 -10px 28px rgba(0,0,0,.16)'}}>
          <div className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 flex justify-between px-2 items-center gap-1">
            {/* 勇者モンの特性で枚数が増えているときは、その分を王冠付きで出す。
                「勇者モンに選んだときだけ効く特性」が今効いていることを確かめられるようにする */}
            <span className={`flex-1 min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5${battleTutorialSpotClass('cardCount')}`}>{/* 幅の狭い画面では「ACTION / CARDS」と2行にして、右の VIEW に重ねない(320 で重なっていた。2026-10-27 ジン) */}<span className="whitespace-nowrap max-[389px]:whitespace-normal max-[389px]:leading-tight">Action Cards</span> <span className="shrink-0 bg-white/10 text-white px-2 py-0.5 rounded-full font-mono">{Array.isArray(tacticsUnits)?actionUsed:selectedCards.length}/{cardLimit}</span>{heroCardBonus>0&&<span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-300/40 text-amber-200 whitespace-nowrap"><Crown size={8}/>+{heroCardBonus}</span>}{kikiCardBonus>0&&<span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-300/40 text-violet-200 whitespace-nowrap">応援+1</span>}{soulCoordinationCardBonus>0&&<span data-soul-coordination-bonus className="shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-300/40 text-sky-200 whitespace-nowrap">魂格+1</span>}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button data-battle-view-button onClick={()=>setShowDeckInfo(true)} className={`flex h-8 items-center gap-0.5 px-2 bg-white/[.035] rounded-[10px] border border-white/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] active:scale-95${battleTutorialSpotClass('deckView')}`}><Layers size={9}/><span className="text-[10px]">VIEW</span></button>
              {/* 緊急回復(2026-09-22 ユーザー指示「緊急回復は手札側の効果だから位置を変えたい」)。
                  ★もとは敵の絵の左に置いていたが、あの列は「敵や自分を見る」入口を並べた場所。
                    緊急はその場で使う行動なので、カードと同じ操作の列へ移した。
                  ★AUTO の左に置く。実行(Action)のすぐ隣だと押し間違える */}
              
              <button onClick={useEmergency} disabled={isBusy||autoBattle||!battleTutorialAllowsEmergency} aria-label="緊急回復" title="緊急回復" className={`shrink-0 flex h-8 w-[44px] flex-col items-center justify-center rounded-[10px] border border-blue-300/55 bg-blue-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_10px_rgba(59,130,246,.12)] leading-none active:scale-90 disabled:opacity-25${battleTutorialSpotClass('emergency')}`}><Activity size={11} className="text-blue-300"/><span className="mt-0.5 text-[10px] font-black text-blue-50">緊急</span></button>
              {/* モンビーへの入口(クイックモードだけ)。音に関わる入口なので、この並びに残す */}
              <div className="shrink-0 flex flex-col gap-0.5">
                {quickToRhythmButtonNode}
                {/* MFバトルカードへの入口(周回を続けたまま)。モンビーの入口の下に積む */}
                {quickToCardButtonNode}
              </div>
              <div className="w-[44px] shrink-0 flex flex-col gap-0.5">
                <button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className={`h-8 w-full px-1 rounded-[10px] border font-black text-[10px] leading-tight active:scale-90 disabled:opacity-25 ${autoRepeat?'border-fuchsia-300 bg-fuchsia-500 text-slate-950 shadow-[0_0_12px_rgba(217,70,239,.65)]':autoBattle?'border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,.65)]':'border-white/[.12] bg-white/[.035] text-slate-300'}`}><span className="block">AUTO</span><span className="block text-[10px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button>
                {battleScreenActive&&isQuickMode(runMode)&&autoRepeat===true&&<button type="button" onClick={cycleEcoMode} aria-label={`省エネ ${ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}`} className={`min-h-[24px] w-full rounded-md border font-black text-[10px] leading-[9px] active:scale-90 ${ecoMode==='lite'?'border-emerald-300 bg-emerald-700 text-emerald-50':ecoMode==='ultra'?'border-lime-200 bg-lime-500 text-slate-950':'border-slate-500 bg-slate-700 text-slate-200'}`}><span className="block">省エネ</span><span className="block">{ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}</span></button>}
              </div>
              {(()=>{const allAttackAssigned=selectedCards.filter(idx=>cardNeedsMonster(hand[idx])).every(idx=>cardAssignments[idx]!=null); const discardCount=Array.isArray(tacticsUnits)&&discardCards?discardCards.length:0; const canAct=!autoBattle&&!isBusy&&(selectedCards.length+discardCount)>0&&pendingCard===null&&allAttackAssigned&&battleTutorialNeed!=='skillPicker'; // 押せないときは**理由**を出す(2026-09-18・ユーザー依頼「各コマンドをもっとよくしたい」)。
                // 灰色になるだけでは「何が足りなくて押せないのか」が分からず、
                // カードを選んだのに置き場所を決めていない、という取りこぼしに気づけなかった。
                // 押せるときの字は Action のまま(検査がこの字でボタンを押している)。
                const actionHint=canAct?null:(autoBattle||isBusy?null:(selectedCards.length+discardCount===0?'カードを選ぶ':(!allAttackAssigned?'置き場所を選ぶ':null)));
                // ★EXスキルを使ったターンは、カードを選ばずに敵の番へ進められる(タクティクス専用)。
                //   併用できないEXを使ったターンはカードを選べないので、ここが無いとターンを終えられない
                if(tacticsExTurnUsed&&passTacticsTurn&&selectedCards.length===0&&discardCount===0&&!autoBattle&&!isBusy&&pendingCard===null){
                  return(<button data-tactics-ex-pass onClick={()=>passTacticsTurn()} className={`min-h-[44px] min-w-[96px] shrink-0 px-2 sm:px-5 rounded-[14px] font-black text-[11px] sm:text-[13px] whitespace-nowrap active:scale-90 flex items-center justify-center gap-1 border-2 border-black tracking-wide transition-all${battleTutorialSpotClass('action')} bg-fuchsia-200 text-black shadow-[0_0_15px_rgba(232,121,249,0.45)]`}><Play fill="currentColor" size={12}/> ターンを進める</button>);
                }
                return(<button data-battle-action onClick={()=>processTurn()} disabled={!canAct} className={`min-h-[44px] min-w-[96px] shrink-0 px-2 sm:px-5 rounded-full font-black text-[11px] sm:text-[13px] whitespace-nowrap active:scale-90 flex items-center justify-center gap-1 border-2 border-black tracking-wide transition-all${actionHint?'':' uppercase'}${battleTutorialSpotClass('action')} ${canAct?'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]':(actionHint?'bg-slate-800 text-slate-300 border-white/20':'bg-slate-700 text-slate-500 opacity-50')}`}><Play fill="currentColor" size={12}/> {actionHint||'Action'}</button>);})()}
            </div>
          </div>
          {/* EXスキルを使ったせいで、このターンは手札がどれも使えないときの理由(2026-10-09 ユーザー指示「EX後のターンに理由を出す」)。
              札ごとの「EX使用」の印だけでは、なぜ手札が全部暗いのかが一目で分からなかった。手札の帯の上端に重ねて1行だけ出す */}
          {tacticsExTurnUsed&&passTacticsTurn&&selectedCards.length===0&&!autoBattle&&tacticsCardBlock&&hand.length>0&&(()=>{
            const blocks=hand.map((c,i)=>tacticsCardBlock(c,i));
            if(!blocks.every(b=>b&&!b.ok)||!blocks.some(b=>b.kind==='ex')) return null;
            return <div data-tactics-ex-turn-note className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-fuchsia-300/60 bg-slate-950/95 px-3 py-1 text-[10px] font-black text-fuchsia-100 shadow-lg">EXスキルを使ったので、このターンはカードを使えません →「ターンを進める」</div>;
          })()}
          {/* 使うカードが決まっている番は、その種類だけを光らせる(枠全体は光らせない) */}
          <div className={`flex-1 flex gap-1 overflow-x-auto items-stretch scrollbar-hide px-1 pb-1 justify-center${battleTutorialCardTarget?'':battleTutorialSpotClass('cards')}`}>
            {hand.map((c,i)=>{
              const isSel=selectedCards.includes(i);
              const assignedSlot=cardAssignments[i];
              const curGuts=assignedSlot!=null?getCardGuts(c,assignedSlot):getCardGuts(c,null);
              const requiredGuts=assignedSlot!=null?curGuts:pendingCardGuts(c);
              const remainingGuts=guts-selectedGutsListOnce().reduce((acc,[idx,g])=>acc+(idx===i?0:g),0);
              // 新モードは合計のガッツでは決まらない。「その子が払えるか」をアプリ側へ聞く。
              // null が返るモード(いままでの5つ)では、今までどおり合計で見る
              const cardBlock=tacticsCardBlock?tacticsCardBlock(c,i):null;
              const isSelectable=isSel||(cardBlock?cardBlock.ok:(remainingGuts>=requiredGuts&&selectedCards.length<cardLimit));
              const isPending=pendingCard===i;
              const assignedMon=assignedSlot!=null?slots[assignedSlot]:null;
              const isDragging=dragState?.active&&dragState?.cardIndex===i;
              // 練習で使わせたい種類以外は、つかむこと自体をさせない(選択も割り当ても起きない)
              const tutorialAllowed=battleTutorialCardAllowed(c);
              // 光らせるのは「いま触ってほしい種類」だけ。技変更の番は名前のところも光らせる
              const tutorialTargeted=!!battleTutorialCardTarget&&battleTutorialCardKind(c)===battleTutorialCardTarget;
              const cardArt=tacticsNewLayout&&battleCardArtOn()?battleCardArtOf(c):null;
              const handCardButton=(<button data-hand-card={i} data-card-art={cardArt?(cardArt.shape||'std'):undefined} data-card-plate={cardArt&&cardArt.plate?cardArt.color:undefined} data-dragging-card={isDragging?'true':undefined} data-card-cost={requiredGuts} data-card-type={c.type} data-card-usable={isSelectable?'true':'false'} data-card-block={cardBlock&&!cardBlock.ok?cardBlock.kind:undefined} onPointerDown={(e)=>{
                if(isBusy||autoBattleRef.current||!tutorialAllowed)return;
                const pt=e.touches?e.touches[0]:e;
                cardDragActiveRef.current=false;
                // 運ぶ間も手札と同じ大きさ・縦横比にする(2026-10-15 社長「移動するときにカードが潰れる」)。押した瞬間の大きさを覚えておく
                //   (絵のカードは見た目だけ拡大(CSS の scale)しているので、拡大を含まない元の大きさ offsetWidth/offsetHeight を使う)
                const el0=e.currentTarget, w0=el0&&el0.offsetWidth>0?el0.offsetWidth:null, h0=el0&&el0.offsetHeight>0?el0.offsetHeight:null;
                setDragState({cardIndex:i, x:pt.clientX, y:pt.clientY, active:false, card:c, w:w0, h:h0});
              }} style={{...(cardArt&&cardArt.plate?{'--mh-plate':`url("${cardArt.plate}")`}:{}),...(cardArt&&cardArt.rule?{'--mh-name-rule':`url("${cardArt.rule}")`}:{}),...(isDragging?{touchAction:'none',position:'fixed',left:dragState.x,top:dragState.y,transform:cardArt?'translate(-50%,-50%) rotate(-3deg) scale(1.2949,1.242)':'translate(-50%,-50%) rotate(-3deg) scale(1.15)',zIndex:70000,width:dragState.w?`${dragState.w}px`:'72px',...(dragState.h?{height:`${dragState.h}px`}:{}),pointerEvents:'none',transition:'none',filter:'drop-shadow(0 12px 18px rgba(0,0,0,0.65))'}:{touchAction:'none',boxShadow:tacticsNewLayout?`${(TYPE_INLINE_STYLE[c.type]||{}).borderColor?`0 -2px 10px ${(TYPE_INLINE_STYLE[c.type]||{}).borderColor}45, `:''}inset 0 1px 0 rgba(255,255,255,.08), 0 5px 12px rgba(0,0,0,.24)`:`${(TYPE_INLINE_STYLE[c.type]||{}).borderColor?`0 0 12px ${(TYPE_INLINE_STYLE[c.type]||{}).borderColor}70, `:''}inset 0 1px 0 rgba(255,255,255,.34), inset 0 -10px 16px rgba(0,0,0,.30), 0 4px 10px rgba(0,0,0,.5)`}),...(TYPE_INLINE_STYLE[c.type]||{})}} className={`relative w-full ${tacticsNewLayout?'rounded-[12px] border':'rounded-xl border-2'} p-1 flex flex-col items-center justify-between bg-gradient-to-b ${TYPE_COLORS[c.type]} ${isDragging?'ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]':isSel?'transition-all -translate-y-1.5 ring-2 ring-cyan-300 z-20 scale-[1.03] opacity-90 saturate-[0.95] shadow-[0_0_16px_rgba(103,232,249,0.45)]':'transition-all opacity-90'} ${isPending?'ring-4 ring-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.7)]':''} ${!isSelectable&&!isSel&&!isDragging?'grayscale opacity-50':''}${tutorialTargeted?' is-battle-tutorial-spot':''}${battleTutorialCardTarget&&!tutorialTargeted?' grayscale opacity-25':''}`}>
                {/* ★新しい盤面の手札の飾り(2026-09-24 ユーザー指示「カードの絵をもっと高級感というか、いいかんじに」)。
                    金の縁(回る光)・種類ごとの地の模様・ときどき横切る光の筋・左上の消費ガッツの宝石。
                    見た目は data-tactics-look の CSS(70-bootstrap)がまとめて持つ。★消費ガッツはこの宝石だけに出す
                    (下のガッツの段と二重になっていた・ユーザー指摘「消費ガッツが2つある」) */}
                {tacticsNewLayout&&!cardArt&&<><span aria-hidden="true" data-card-pattern={(tacticsCardGenre&&tacticsCardGenre(c))||''}/><span aria-hidden="true" data-card-shine/><span aria-hidden="true" data-card-frame/><span data-card-gem aria-label={`消費ガッツ ${curGuts}`}>{curGuts}</span></>}
                {/* 行動カードの絵: 枠(カード全体)・左上の小さい丸にガッツ・上の大きい丸に技のマークと段階の札(位置は枠の絵の穴に合わせた割合。index.html の .mh-card-art-*) */}
                {cardArt&&<><img aria-hidden="true" data-card-art-frame src={cardArt.frame} alt="" draggable={false} className="mh-card-art-frame"/><span data-card-gem data-card-art-gem aria-label={`消費ガッツ ${curGuts}`} className="mh-card-art-gem">{curGuts}</span>
                  {cardArt.mark&&<img aria-hidden="true" data-card-art-mark src={cardArt.mark} alt="" draggable={false} className="mh-card-art-mark"/>}
                  {!cardArt.mark&&<span aria-hidden="true" data-card-art-icon className="mh-card-art-icon">{cardIconNode(c.icon,26,c.id)}</span>}
                  {cardArt.roman&&<span data-card-art-roman={cardArt.roman} className="mh-card-art-roman">{cardArt.roman}</span>}</>}
                {discardCards&&discardCards.includes(i)&&(<div data-card-discard className="absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] bg-black/60 text-[12px] font-black text-amber-200">捨てる</div>)}
                {isSel&&!assignedMon&&(<div className={`absolute top-0.5 ${tacticsNewLayout?'right-0.5':'left-0.5'} z-30 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-lg`}><Check size={10} className="text-white" strokeWidth={4}/></div>)}
                {assignedMon&&(<div className="absolute top-0.5 right-0.5 z-30 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center overflow-hidden shadow-lg">{assignedMon.imgUrl?<img src={assignedMon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span className="text-[10px]">{assignedMon.emoji}</span>}</div>)}
                {/* 使うと🔥(狙われやすさ)がどれだけ上がるか(2026-10-19 社長「各カードにヘイト割合も書いたほうがわかりやすいかもね」)。段は TACTICS_HATE.cardFlames。
                    置いた子(固有技は持ち主)のタイプ・上書きまで掛ける。カードの下の端の真ん中に小さな帯で出す(右上は選んだ印・左上はガッツ) */}
                {tacticsHateOn&&(()=>{const lv=tacticsHateCardLevel(c,assignedMon?.id||(Number.isInteger(c.ownerSlotIdx)?slots[c.ownerSlotIdx]?.id:null)||null); return lv>0?(
                  <span data-card-hate={lv} aria-label={`使うと狙われやすさ ${TACTICS_HATE_LEVEL_LABELS[lv]}`} title={`使うと🔥 ${TACTICS_HATE_LEVEL_LABELS[lv]}`} className="pointer-events-none absolute bottom-[3px] left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full border border-orange-300/60 bg-black/70 px-1 py-px text-[8px] leading-[10px] tracking-[-0.15em] shadow-[0_0_6px_rgba(249,115,22,.55)]">{Array.from({length:lv},(_,k)=><span key={k} aria-hidden="true">🔥</span>)}</span>):null;})()}
                {/* ★data-decoration は「これは絵であって読むものではない」という目じるし。
                    使えないカードの赤い札(枚数上限など)をこの絵の上へわざと出すので、
                    文字の重なりを見る検査ではこの中身を数えない */}
                <div data-decoration className="flex shrink-0 items-center justify-center rounded-[11px] border border-white/[.16] bg-black/20" style={{marginTop:HAND_CARD_FIT.iconTop,width:HAND_CARD_FIT.icon,height:HAND_CARD_FIT.icon,boxShadow:'inset 0 1px 0 rgba(255,255,255,.25), inset 0 -4px 8px rgba(0,0,0,.35)'}}>{cardIconNode(c.icon,26,c.id)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5" style={{containerType:'inline-size'}}>{/* ★技名は押しても技の一覧を開かない(カードを選ぶだけ)。一覧はガッツの段の上の「⇄ 技変更」から開く
                    (2026-09-24 ユーザー指摘「技変更一覧が誤タップで反応しやすい」・場所はユーザー選択)。
                    それまでは技名の欄(カード幅×30px)がまるごと押し場所で、カードを選ぶつもりの指が当たっていた */}
                <div data-card-name className="text-[11px] font-black leading-[13px] w-full whitespace-normal flex items-center justify-center overflow-hidden px-0.5" style={{height:tacticsNewLayout?HAND_CARD_FIT.nameRich:HAND_CARD_FIT.name,...handCardNameFit(c.name,tacticsNewLayout?HAND_CARD_FIT.nameRich:HAND_CARD_FIT.name)}}>{cardArt?<span data-card-name-text style={battleCardNameFit(c.name)}>{battleCardNameLines(c.name).map((l,k)=>(<React.Fragment key={k}>{k>0&&<br/>}{l}</React.Fragment>))}</span>:c.name}</div>{(()=>{
                  // カードの表に「ジャンル」と「誰に効くか」を出す(仕様: BATTLE_NEW_MODE_PLAN.md 4.4
                  // 「単体効果と全体効果が分かるようにカード説明に表示するようにしたい」)。
                  // ★言葉はアプリ側の cardGenreLabel / cardScopeLabel から引く。カードをタップした
                  //   ときの説明が同じ関数を使っているので、表と中で言い方がずれない。
                  // ★攻撃は「攻撃・敵へ」ではなく「攻撃」だけにする。味方に効かないのは攻撃カードの
                  //   前提で、わざわざ言うと守り・支援の「単体／全体」が埋もれる
                  const genre=tacticsCardGenre?tacticsCardGenre(c):null;
                  const scope=tacticsCardScope?tacticsCardScope(c):null;
                  const text=genre?(scope&&scope!=='敵へ'?`${genre}・${scope}`:genre):'';
                  // 新しい盤面では下の段(技変更の枠の中・いちばん下)へ出すので、ここには出さない
                  if(tacticsNewLayout) return null;
                  return text?<div data-card-genre={genre} data-card-scope={scope||undefined} className="w-full truncate rounded-[5px] bg-black/30 px-0.5 text-[8px] font-black leading-[11px] text-white/85">{text}</div>:null;
                })()}{/* ★「⇄技変更」とガッツの段をまとめて1つのボタンにする(2026-09-24 ユーザー指示「どこを押せば反応するかを
                    見た目でわかるようにして」「ガッツ表示含む下部ラインをタップ領域にする」)。
                    帯だけだと高さ13〜16pxで押しにくく、どこまでが押し場所かも見えなかった。
                    明るい枠で囲んだ範囲がそのまま押せる範囲になる。攻撃以外のカードはガッツの段だけ(押しても技の一覧は出ない) */}
                {/* ★新しい盤面の下の段(2026-09-24 ユーザー指示「技変更の領域はそのままで文字だけ少し上にずらして、
                    カードタイプは1番下に統一」)。どのカードも同じ高さの段を持ち、いちばん下に種類の札をそろえて置く。
                    攻撃カードはこの段まるごとが「⇄技変更」の押し場所で、文字は上寄せ。
                    種類の札が名前の下から抜けたぶん、技名の欄(HAND_CARD_FIT.nameRich)を広くしてある */}
                {tacticsNewLayout?(()=>{
                  const genre=tacticsCardGenre?tacticsCardGenre(c):null;
                  const scope=tacticsCardScope?tacticsCardScope(c):null;
                  const text=genre?(scope&&scope!=='敵へ'?`${genre}・${scope}`:genre):'';
                  const label=text?<div data-card-genre={genre} data-card-scope={scope||undefined} className="w-full truncate rounded-[5px] bg-black/35 px-0.5 text-[8px] font-black leading-[11px] text-white/85">{text}</div>:null;
                  return ['atk','range_atk','unique'].includes(c.type)?(<div role="button" aria-label={`${c.name}の技を変える`} data-skill-change={i} onClick={(ev)=>{ev.stopPropagation(); if(isBusy||autoBattleRef.current||Date.now()<=suppressCardClickRef.current)return; setSkillPicker({handIndex:i});}}
                    style={{height:HAND_CARD_FIT.skill}} className={`flex w-full shrink-0 flex-col items-stretch justify-between gap-px rounded-[7px] border border-white/60 bg-white/[.14] p-[2px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_0_6px_rgba(255,255,255,.12)] active:scale-95 active:bg-white/30${battleTutorialNeedCard&&tutorialTargeted?' is-battle-tutorial-spot':''}`}>
                    {/* 「技変更」は言葉の途中で折らない(2026-10-21 窓口「技変 / 更と折れている」)。矢印と文字が別の部品で、文字のほうが縮んで折れていた */}<span className="flex items-center justify-center gap-0.5 whitespace-nowrap pt-px text-[9px] font-black leading-none"><span aria-hidden="true">⇄</span><span className="shrink-0">技変更</span></span>{label}</div>)
                    // 攻撃以外は同じ高さで、種類の札だけをいちばん下に置く(押しても何も起きない)
                    :(<div data-skill-change-spacer style={{height:HAND_CARD_FIT.skill}} className="flex w-full shrink-0 flex-col justify-end rounded-[7px] border border-transparent p-[2px] pointer-events-none">{label}</div>);
                })()
                :(['atk','range_atk','unique'].includes(c.type)?(<div role="button" aria-label={`${c.name}の技を変える`} data-skill-change={i} onClick={(ev)=>{ev.stopPropagation(); if(isBusy||autoBattleRef.current||Date.now()<=suppressCardClickRef.current)return; setSkillPicker({handIndex:i});}}
                  className={`flex w-full shrink-0 flex-col overflow-hidden rounded-[7px] border border-white/60 bg-white/[.12] shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_0_6px_rgba(255,255,255,.12)] active:scale-95 active:bg-white/30${battleTutorialNeedCard&&tutorialTargeted?' is-battle-tutorial-spot':''}`}>
                  <div style={{height:HAND_CARD_FIT.band}} className="flex shrink-0 items-center justify-center gap-0.5 whitespace-nowrap text-[9px] font-black leading-none text-white"><span aria-hidden="true">⇄</span><span className="shrink-0">技変更</span></div>
                  <div className="text-[10px] font-black bg-black/30 text-white rounded-[5px] flex items-center justify-center gap-0.5" style={{paddingTop:HAND_CARD_FIT.gutsPad,paddingBottom:HAND_CARD_FIT.gutsPad}}><Zap size={9}/>{curGuts}</div>
                </div>):<div className="text-[10px] font-black bg-black/30 text-white rounded-[6px] flex items-center justify-center gap-0.5" style={{paddingTop:HAND_CARD_FIT.gutsPad,paddingBottom:HAND_CARD_FIT.gutsPad}}><Zap size={9}/>{curGuts}</div>)}</div></button>);
              // ★引きずっているカードは、本物のカード1枚だけを画面の最上層(body の直下)へ出して指につける
              //   (2026-09-26 ユーザー指摘「上に持ってくと下からまたカードが出てくる」「ドラッグしてるカードの表示が古いやつのまま」)。
              //   手札の欄には backdrop-filter が掛かっていて、中に置いたまま position:fixed にすると
              //   基準が欄になってずれた位置にもう1枚見え、指が動くたびに欄のぼかしも描き直しになる。
              //   以前は古い見た目の写しを別に出していて、本物と写しの2枚を毎回描いていた。
              //   手札の飾り(金の縁・宝石など)は [data-tactics-look] の下でだけ効くので、同じ印を付けた箱で包む。
              //   body の直下なのは、画面の揺れ(transform)の影響を受けないようにするため
              return(<div key={c.uid} className="relative flex-1 min-w-0 max-w-[20%] flex">{isDragging&&Array.isArray(tacticsUnits)&&<TacticsDiscardZones full={actionUsed-(isSel?1:0)>=cardLimit} used={actionUsed} limit={cardLimit}/>}{isDragging?ReactDOM.createPortal(<div data-drag-card-layer data-tactics-look={tacticsNewLayout?((liteBattleView||ecoBattleView||idleMotionOff)?'calm':'rich'):undefined}>{handCardButton}</div>,document.body):handCardButton}{isDragging&&<div data-tactics-drag-card-placeholder className="absolute inset-0 z-10 pointer-events-none rounded-[12px] border border-white/25 bg-slate-900/95"/>}{/* ★使えない理由の赤い札は、絵(アイコン)の下の端にそろえて置く。新しい盤面では左上に消費ガッツの宝石があり、
                    カードの上の端(top-1)に置くと宝石の数字を隠していた(2026-09-27・文字の重なりの検査で見つけた) */}
              {cardBlock&&!cardBlock.ok&&cardBlock.short&&!isDragging&&(<div data-tactics-card-block={cardBlock.short} style={tacticsNewLayout?{top:`calc(4px + ${HAND_CARD_FIT.iconTop} + ${HAND_CARD_FIT.icon} - 15px)`}:undefined} className={`pointer-events-none absolute inset-x-0.5 ${tacticsNewLayout?'':'top-1'} z-30 rounded-md border border-rose-200 bg-rose-600 px-0.5 py-0.5 text-center text-[8px] font-black leading-tight text-white shadow-[0_2px_8px_rgba(0,0,0,.85)]`}>{cardBlock.short}</div>)}</div>);
            })}
          </div>
        </div>
        </>)}
        {/* バトル中の設定(2026-09-22 ユーザー指示「BGMは右上に設定ボタンみたいの作って
            そこにギブアップとかヘルプとかと一緒にまとめて」)。
            ★ヘッダーに入口を3つ並べると、WAVE名やモード名を押し出して読めなくなる。
              どれもバトル中に何度も押すものではないので、1枚めくる形にした。
            ★data-battle-quit / data-auto-bgm-button は検査の手がかり。
              置き場所が変わっても名前は変えない。
            ★背景を押しても閉じる。誤って開いたときに、指を上まで運ばずに戻れる */}
        {/* ★body の直下へ出す(ReactDOM.createPortal)。ここへ素直に置くと、画面の揺れで位置がずれる
              (2026-09-22・ユーザー報告「オートでオプション開くと行動によって位置ずれが起きる」)。
              揺れは transform で作ってあり、**transform の掛かった要素は中の position:fixed の
              基準になる**ため、揺れているあいだだけ viewport ではなく揺れる箱が基準になり、
              iPhoneのノッチ(safe-area)ぶん約47px下へ落ちていた。実測でも 52px → 103px とずれる */}
        {/* ★タクティクス専用 EXスキルの詳細(距離枠をタップすると開く)。
            ★開いただけでは発動しない。使うのは「EXスキルを使用」を押したときだけ。
            ★設定メニューと同じく body の直下へ出す(揺れの transform の中に置くと位置がずれる)。
            ★スマホ縦を先に考えて、画面の下から出す。押すボタンは親指の届く下側にまとめ、
              ホームインジケーターに掛からないよう safe-area のぶん下を空ける。背景を押しても閉じる */}
        {exPanel&&ReactDOM.createPortal((
          <div data-tactics-ex-panel={exPanel.slot} role="dialog" aria-modal="true" aria-label={`${exPanel.monName}のEXスキル`} className="fixed inset-0 z-[70000] flex items-center justify-center bg-black/70 px-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} onClick={()=>setExPanelSlot(null)}>
            {/* ★画面の真ん中に出す、ほかのダイアログと同じ大きさのカード(2026-09-23 ユーザー指摘「枠のサイズ感おかしくない？」)。
                下から出す形は横幅いっぱいで枠線が画面の端で切れ、下の余白もホームバーのぶんが二重に空いていた */}
            <div data-tactics-ex-card className="w-full max-w-[340px] rounded-3xl border-2 border-fuchsia-400/60 bg-slate-900 px-4 py-3 shadow-2xl text-white" style={{maxHeight:'100%',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
              {/* ★EXスキルと「能力・効果」の切り替え(2026-10-13 社長「モンスターをタップすると能力含め詳細バフも見れるように」)。
                  タップで開くのは今までどおりEXスキルの側。切り替えると、その子の能力・かかっている効果を出す */}
              <div data-unit-detail-tabs className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1">
                {[['ex','EXスキル'],['status','能力・効果']].map(([id,label])=>(
                  <button key={id} type="button" data-unit-detail-tab={id} aria-pressed={exTab===id} onClick={()=>setExTab(id)}
                    className={`min-h-[34px] rounded-lg text-[12px] font-black active:scale-95 ${exTab===id?'bg-fuchsia-600 text-white':'text-slate-300'}`}>{label}</button>
                ))}
              </div>
              {exTab==='status'?(
                <div data-tactics-unit-detail={exPanel.slot}>
                  <div className="mb-2 break-words text-[16px] font-black leading-tight">{exPanel.monName}</div>
                  {typeof battleUnitStatusOf==='function'&&<BattleUnitDetailBody side="ally" status={battleUnitStatusOf(exPanel.slot)} chips={battleBuffChips()} marks={allyStackCounts[exPanel.slot]}/>}
                  <button type="button" data-tactics-ex-close onClick={()=>setExPanelSlot(null)} className="mt-3 min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-800 text-[13px] font-black text-slate-200 active:scale-95">閉じる</button>
                </div>
              ):(<>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-fuchsia-600 px-1.5 py-0.5 text-[10px] font-black leading-none">EX</span>
                <span data-tactics-ex-mon className="min-w-0 truncate text-[12px] font-black text-slate-300">{exPanel.monName}</span>
                {!exPanel.implemented&&<span data-tactics-ex-dev className="ml-auto shrink-0 rounded-full border border-amber-300/60 bg-amber-900/60 px-2 py-0.5 text-[10px] font-black text-amber-100">開発中</span>}
              </div>
              <div data-tactics-ex-name className="mt-1 text-[18px] font-black leading-tight text-fuchsia-100">{exPanel.def.name}</div>
              {exPanel.stateText&&<span data-tactics-ex-state-pill={exPanel.stateText.kind} className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black leading-none ${exPanel.stateText.kind==='on'?'bg-fuchsia-600 text-white ring-1 ring-fuchsia-200':exPanel.stateText.kind==='ready'?'bg-emerald-700/70 text-emerald-100 ring-1 ring-emerald-300/60':'bg-slate-700 text-slate-300 ring-1 ring-white/10'}`}>{exPanel.stateText.text}</span>}
              <div data-tactics-ex-desc className="mt-1.5 text-[12px] font-bold text-slate-200"><ExDescText text={exPanel.def.desc}/></div>
              {!exPanel.implemented&&<p className="mt-1.5 rounded-lg border border-amber-300/40 bg-amber-950/50 px-2 py-1.5 text-[11px] font-bold leading-snug text-amber-100">効果はまだ入っていません。使うと回数と「他のカードと一緒に使えるか」の決まりだけが動きます。</p>}
              {(exPanel.remainText||exPanel.styleLabel||exPanel.active||(exPanel.statusLines||[]).length>0||(exPanel.stats&&exPanel.stats.changed))&&(
                // ★効いているあいだの状態は、ほかの決まりごと(回数・カード・効果時間)とは別の目立つ箱にまとめる(2026-10-06 ユーザー指示「効果中の見やすさ」)
                <dl data-tactics-ex-now className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border-2 border-fuchsia-400/60 bg-fuchsia-950/40 px-3 py-2 text-[12px] shadow-[0_0_12px_rgba(217,70,239,.25)]">
                  <dt className="col-span-2 text-[10px] font-black tracking-widest text-fuchsia-300">いまの効果</dt>
                {exPanel.remainText&&<><dt className="font-bold text-fuchsia-200/70">残り</dt><dd data-tactics-ex-remain className="font-black text-fuchsia-200">{exPanel.remainText}</dd></>}
                {exPanel.styleLabel&&<><dt className="font-bold text-fuchsia-200/70">いま</dt><dd data-tactics-ex-style className="font-black text-fuchsia-200">{exPanel.styleLabel}</dd></>}
                {(exPanel.statusLines||[]).map((t,i)=><React.Fragment key={i}><dt className="font-bold text-fuchsia-200/70">いまの状態</dt><dd data-tactics-ex-status className="font-black text-fuchsia-200">{t}</dd></React.Fragment>)}
                {exPanel.stats&&exPanel.stats.changed&&<><dt className="font-bold text-fuchsia-200/70">ちから／丈夫さ</dt><dd data-tactics-ex-stats className={`font-black ${exPanel.stats.changed?'text-fuchsia-200':'text-white'}`}>{exPanel.stats.atk}／{exPanel.stats.def}{exPanel.stats.changed?'（EXで変化中）':''}</dd></>}
                </dl>)}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px]">
                <dt className="font-bold text-slate-400">使える回数</dt>
                <dd data-tactics-ex-uses className="font-black text-white">{exPanel.remaining.unlimited?'無制限':`のこり ${exPanel.remaining.left} / ${exPanel.remaining.max}（${exPanel.def.usesPerWave?'このWAVE':'このラン'}）`}</dd>
                <dt className="font-bold text-slate-400">カード</dt>
                <dd data-tactics-ex-with-cards={exPanel.def.withCards?'yes':'no'} className="font-black text-white">{exPanel.def.withCards?'同じターンにこの子も通常カードを使える':'使ったターン、この子はカードを使えない（ほかの子は使える）'}</dd>
                {tacticsHateOn&&(()=>{const lv=tacticsHateExLevel(exPanel.def.effect,slots[exPanel.slot]?.id||null); return lv>0?<><dt className="font-bold text-slate-400">狙われやすさ</dt><dd data-tactics-ex-hate={lv} className="font-black text-orange-200">使うと{'🔥'.repeat(lv)} {TACTICS_HATE_LEVEL_LABELS[lv]}</dd></>:null;})()}
                {exPanel.durationText&&<><dt className="font-bold text-slate-400">効果時間</dt><dd className="font-black text-white">{exPanel.durationText}</dd></>}
                {exPanel.def.conditionText&&<><dt className="font-bold text-slate-400">条件</dt><dd className="font-black text-white">{exPanel.def.conditionText}</dd></>}
                {exPanel.stats&&!exPanel.stats.changed&&<><dt className="font-bold text-slate-400">ちから／丈夫さ</dt><dd data-tactics-ex-stats className="font-black text-white">{exPanel.stats.atk}／{exPanel.stats.def}</dd></>}
              </dl>
              {!exPanel.check.ok&&<p data-tactics-ex-why className="mt-2 text-[11px] font-bold leading-snug text-rose-200">{exPanel.check.reason}</p>}
              {exChoosing&&exPanel.targetOptions?(
                // ★味方を選んで使う(2026-10-03 ウンディーネの「生命の泉」)。自分も選べる。ダウン中の子は赤で出す
                <div data-tactics-ex-choices className="mt-3 flex flex-col gap-1.5">
                  <div className="text-[11px] font-black text-slate-300">だれに使う？</div>
                  {exPanel.targetOptions.map(t=>(
                    <button key={t.slot} type="button" data-tactics-ex-target={t.slot} data-tactics-ex-target-downed={t.downed?'yes':'no'} disabled={!exPanel.check.ok}
                      onClick={()=>{ if(activateTacticsEx&&activateTacticsEx(exPanel.slot,t.slot)) setExPanelSlot(null); }}
                      className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-left active:scale-95 ${t.downed?'border-rose-300 bg-rose-900/60 text-white':'border-fuchsia-300 bg-fuchsia-900/60 text-white'}`}>
                      <span className="block text-[13px] font-black">{t.name}{t.downed?'（ダウン中）':''}</span>
                      <span className="block text-[10px] font-bold leading-snug opacity-80">ライフ {t.hp.toLocaleString()} / {t.maxHp.toLocaleString()}</span>
                    </button>
                  ))}
                  <button type="button" data-tactics-ex-choice-back onClick={()=>setExChoosing(false)} className="min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[12px] font-black text-slate-200 active:scale-95">戻る</button>
                </div>
              ):exChoosing&&exPanel.styleOptions?(
                // ★スタイルを選ぶ(2026-09-25 ユーザー指示)。いまのスタイルは選べない
                <div data-tactics-ex-choices className="mt-3 flex flex-col gap-1.5">
                  <div className="text-[11px] font-black text-slate-300">どのスタイルにする？</div>
                  {exPanel.styleOptions.map(st=>(
                    <button key={st.id} type="button" data-tactics-ex-choice={st.id} disabled={st.current||!exPanel.check.ok}
                      onClick={()=>{ if(activateTacticsEx&&activateTacticsEx(exPanel.slot,st.id)) setExPanelSlot(null); }}
                      className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-left active:scale-95 ${st.current?'border-slate-600 bg-slate-800 text-slate-500':'border-fuchsia-300 bg-fuchsia-900/60 text-white'}`}>
                      <span className="block text-[13px] font-black">{st.label}{st.current?'（いまのスタイル）':''}</span>
                      <span className="block text-[10px] font-bold leading-snug opacity-80">{helpWrap(st.desc)}</span>
                    </button>
                  ))}
                  <button type="button" data-tactics-ex-choice-back onClick={()=>setExChoosing(false)} className="min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[12px] font-black text-slate-200 active:scale-95">戻る</button>
                </div>
              ):(
              <div className="mt-3 flex gap-2">
                <button type="button" data-tactics-ex-close onClick={()=>setExPanelSlot(null)} className="min-h-[44px] flex-1 rounded-xl border border-white/20 bg-slate-800 text-[13px] font-black text-slate-200 active:scale-95">閉じる</button>
                <button type="button" data-tactics-ex-use disabled={!exPanel.check.ok} onClick={()=>{ if(exPanel.styleOptions||exPanel.targetOptions){ setExChoosing(true); return; } if(activateTacticsEx&&activateTacticsEx(exPanel.slot)) setExPanelSlot(null); }} className={`min-h-[44px] flex-[2] rounded-xl border-2 text-[14px] font-black active:scale-95 ${exPanel.check.ok?'border-fuchsia-300 bg-fuchsia-600 text-white shadow-[0_0_14px_rgba(217,70,239,.5)]':'border-slate-600 bg-slate-800 text-slate-500'}`}>EXスキルを使用</button>
              </div>
              )}
              </>)}
            </div>
          </div>
        ), document.body)}
        {unitDetail&&(unitDetail.side==='enemy'
          ? <BattleUnitDetailPanel side="enemy" status={typeof battleEnemyStatus==='function'?battleEnemyStatus():null} debuffs={enemyDebuffs} onClose={()=>setUnitDetail(null)}/>
          : <BattleUnitDetailPanel side="ally" status={typeof battleUnitStatusOf==='function'?battleUnitStatusOf(unitDetail.slot):null} chips={battleBuffChips()} marks={allyStackCounts[unitDetail.slot]} onClose={()=>setUnitDetail(null)}/>)}
        {showBattleMenu&&ReactDOM.createPortal((
          <div className="fixed inset-0 z-[70000] flex items-start justify-end bg-black/70 p-2" onClick={()=>setShowBattleMenu(false)}>
            <div data-battle-menu className="mt-11 flex w-[190px] flex-col gap-1.5 rounded-2xl border border-white/20 bg-slate-900 p-2 shadow-2xl" onClick={e=>e.stopPropagation()}>
              <div className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">設定</div>
              <button data-auto-bgm-button type="button" onClick={()=>{setShowBattleMenu(false);setShowAutoBgmPicker(true);}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-indigo-400/50 bg-indigo-950/60 px-2 text-[12px] font-black text-indigo-100 active:scale-95"><span className="text-[14px] leading-none">🎵</span>BGM・音量</button>
              <button type="button" onClick={()=>{setShowBattleMenu(false);openHelp();}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-2 text-[12px] font-black text-emerald-100 active:scale-95"><HelpCircle size={14}/>ヘルプ</button>
              <button data-battle-quit type="button" disabled={!!battleTutorial} onClick={()=>{setShowBattleMenu(false);setShowQuitConfirm(true);}} className="flex min-h-[40px] items-center gap-2 rounded-lg border border-red-400/50 bg-red-950/60 px-2 text-[12px] font-black text-red-100 active:scale-95 disabled:opacity-30"><Flag size={14}/>あきらめる</button>
              <button type="button" onClick={()=>setShowBattleMenu(false)} className="min-h-[36px] rounded-lg border border-white/15 bg-slate-800 text-[11px] font-black text-slate-300 active:scale-95">閉じる</button>
            </div>
          </div>
        ), document.body)}
      </div>
    
  );
}

function UltimateDistanceBreakReveal({
  difficulty, extremeDifficulty, extremeRunRef, runMode, ultimateDistanceBreakLevels,
  ultimateDistanceBreakReveal,
}) {
  return (
<div data-ultimate-distance-break-reveal data-distance-break-overwrite={ultimateDistanceBreakReveal.level>=2?'true':undefined} className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:ultimateDistanceBreakReveal.level>=2?'radial-gradient(circle,rgba(69,10,10,.9),rgba(0,0,0,.99))':'radial-gradient(circle,rgba(127,29,29,.72),rgba(2,6,23,.97))'}} role="dialog" aria-modal="true" aria-label="距離弱体化発動">
    <div className={`w-full max-w-xs rounded-3xl border-2 border-red-300 px-5 py-7 ${ultimateDistanceBreakReveal.level>=2?'bg-black/95 shadow-[0_0_64px_rgba(220,38,38,.9)]':'bg-purple-950/95 shadow-[0_0_48px_rgba(239,68,68,.65)]'}`} style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-amber-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||ULTIMATE_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-red-100">{ultimateDistanceBreakReveal.level>=2?'DISTANCE BREAK OVERWRITE':'DISTANCE BREAK'}</div>
      <div className="mt-5 text-xl font-black text-white">{RANGE_LABELS[ultimateDistanceBreakReveal.distance]}距離 BREAK Lv{ultimateDistanceBreakReveal.level}</div>
      <div className="mt-2 rounded-xl border border-red-300/50 bg-black/40 py-2 text-sm font-black text-red-200">与ダメージ {100*(0.5**ultimateDistanceBreakReveal.level)}%</div>
      <div className="mt-4 border-t border-red-300/20 pt-3 text-[10px] text-purple-100"><span className="font-black text-slate-400">現在のBREAK：</span><br/><span className="font-black">{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</span></div>
    </div>
  </div>
  );
}

function EnemyRevivalReveal({
  difficulty, enemyRevivalReveal, extremeDifficulty, extremeRunRef, runMode,
}) {
  return (
<div data-extreme-revival-reveal className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:'radial-gradient(circle,rgba(51,65,85,.82),rgba(2,6,23,.98))'}} role="dialog" aria-modal="true" aria-label="死者の再起">
    <div className="w-full max-w-xs rounded-3xl border-2 border-slate-200 bg-slate-950/95 px-5 py-7 shadow-[0_0_56px_rgba(203,213,225,.7)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-slate-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||RAGNAROK_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-slate-100">DEAD RISING</div>
      <div className="mt-5 text-xl font-black text-white">死者の再起 {enemyRevivalReveal.revivalNumber}回目</div>
      <div className="mt-2 rounded-xl border border-slate-300/50 bg-black/40 py-2 text-sm font-black text-slate-200">ライフ半分で起き上がり、攻撃力+50%</div>
      <div className="mt-4 border-t border-slate-300/20 pt-3 text-[10px] text-slate-300"><span className="font-black text-slate-400">残りの再起：</span><span className="font-black">{enemyRevivalReveal.remaining}回</span></div>
    </div>
  </div>
  );
}

function ExtremeRuleOverlay({
  closeExtremeRule, difficulty, extremeDifficulty, extremeRunRef, runMode, totalTurnCount,
  ultimateDistanceBreakLevels,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-5" style={{zIndex:90500,background:'radial-gradient(circle,rgba(112,26,117,.58),rgba(2,6,23,.9))',paddingTop:'calc(1.25rem + env(safe-area-inset-top))',paddingBottom:'calc(1.25rem + env(safe-area-inset-bottom))'}} onClick={closeExtremeRule} role="dialog" aria-modal="true" aria-label="極限ルール発動">
    <div className="w-full max-w-xs max-h-full flex flex-col rounded-3xl border-2 border-fuchsia-300 bg-slate-950/95 px-5 py-6 text-center shadow-[0_0_42px_rgba(217,70,239,.65)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      {(()=>{const specialDifficulty=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);const groups=extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode));const breakRule=extremeDistanceBreakRule(specialDifficulty);return <>
        <div className="shrink-0 text-[11px] font-black tracking-[.12em] text-amber-300">⚠ {specialDifficulty} 特殊ルール</div>
        <div data-extreme-rule-intro={specialDifficulty} className="mt-3 min-h-0 flex-1 overflow-y-auto mh-scroll grid content-start gap-1.5 text-left">
          {groups.map(group=><div key={group.title} className="rounded-xl border border-fuchsia-400/25 bg-purple-950/55 px-2.5 py-1.5">
            <div className="text-[10px] font-black text-fuchsia-300">【{group.title}】</div>
            {group.lines.map(([label,value])=><div key={label} className="mt-0.5 grid grid-cols-[auto_1fr] items-start gap-2 text-[10px] font-bold leading-snug text-white"><span className="shrink-0 text-slate-300">{label}</span><b className="min-w-0 text-right">{value}</b></div>)}
          </div>)}
        </div>
        {breakRule&&<div className="mt-2 shrink-0 rounded-xl border border-amber-300/40 bg-black/45 px-3 py-2 text-left text-[10px] leading-relaxed text-slate-200">
          <div><span className="text-slate-400">現在の累計ターン：</span><b className="text-white">{totalTurnCount}</b></div>
          <div><span className="text-slate-400">現在のBREAK：</span><b className={ultimateDistanceBreakLevels.some(level=>level>0)?'text-red-200':'text-white'}>{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</b></div>
        </div>}
      </>;})()}
      <div className="mt-4 shrink-0 text-[10px] font-black tracking-widest text-fuchsia-200">タップしてバトル開始</div>
    </div>
  </div>
  );
}

function SoulBattleEffects({
  battleIntimidate, battleSoulMasus, setShowSoulBattleEffects, soulBattleParty,
  soulCoordinationCardBonus, unifiedSpecialDefense,
}) {
  return (
<div data-soul-battle-effects className="fixed inset-0 flex flex-col bg-slate-950 text-white" style={{position:'fixed',inset:0,zIndex:41000,paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-sky-400/20 px-4 pb-3">
      <div><div className="text-[10px] font-black tracking-[.25em] text-sky-400">SOUL RANK</div><h3 className="text-lg font-black text-sky-100">魂格効果</h3></div>
      <button type="button" onClick={()=>setShowSoulBattleEffects(false)} className="min-h-[44px] min-w-[64px] rounded-full bg-white/10 px-4 text-[11px] font-black active:scale-95">閉じる</button>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto mh-scroll px-4 py-3 space-y-3">
      <section className="rounded-2xl border border-sky-400/30 bg-sky-950/25 p-3">
        <div className="mb-2 text-[10px] font-black text-sky-200">パーティ効果</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">被ダメージ</span><b className="text-emerald-300">-{(Math.round(soulBattleParty.damageReduction*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">特殊防御率</span><b className="text-cyan-300">{(Math.round(unifiedSpecialDefense.rate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">回避 / 反射 / 吸収</span><b className="text-slate-100">{(Math.round(unifiedSpecialDefense.evasion*10)/10)} / {(Math.round(unifiedSpecialDefense.reflect*10)/10)} / {(Math.round(unifiedSpecialDefense.absorb*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">威圧</span><b className="text-violet-300">{(Math.round(battleIntimidate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">自動ガッツ回復</span><b className="text-amber-300">×{soulBattleParty.autoGutsMultiplier.toFixed(2)}</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">使えるカード</span><b className="text-sky-300">{soulCoordinationCardBonus>0?'+1':'変化なし'}</b></div>
        </div>
        {unifiedSpecialDefense.rate>0&&<div className="mt-2 text-[10px] leading-relaxed text-slate-400">特殊防御が発動した場合、回避・反射・吸収の比率から1つだけ発動します。</div>}
      </section>
      <section className="space-y-2">
        <div className="text-[10px] font-black text-sky-200">参加中マスモン</div>
        {battleSoulMasus.filter(m=>normalizeSoulRankStage(m.soulRankStage)>0).map(masu=>{
          const stage=normalizeSoulRankStage(masu.soulRankStage);
          const active=SOUL_TRAIT_DEFINITIONS.filter(t=>soulTraitLevel(masu,t.id)>0);
          const base=ALL_PLAYER_MONSTERS[masu.baseId];
          return <div key={masu.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2"><b className="truncate text-[11px]">{masu.name||base?.name||'マスモン'}</b><span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-950/50 px-2 py-1 text-[10px] font-black text-sky-200">魂格{['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][stage]}</span></div>
            {active.length>0?<div className="mt-2 flex flex-wrap gap-1">{active.map(t=><span key={t.id} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px]"><b className="text-slate-200">{t.name}</b> <span className="text-sky-300">{formatSoulTraitEffect(t,soulTraitEffectValue(masu,t.id))}</span></span>)}</div>:<div className="mt-2 text-[10px] text-slate-500">振り分け済みの魂格特性はありません。</div>}
          </div>;
        })}
      </section>
    </div>
  </div>
  );
}
