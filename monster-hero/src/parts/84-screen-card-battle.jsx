// ==================== 画面: MFバトルカード ====================
// 紙の『モンスターファームバトルカード』を元にしたカードバトル。設計: docs/spec/CARD_BATTLE.md
// ルールの本体とコンピューターの考え方は 82-card-battle-core.jsx、助手のひとことは 83-card-battle-lines.jsx。
// この部品は画面と保存だけを持つ(ルールの計算はしない)。
//
// 画面(gameState。カードバトルの画面は全部 CARD_ で始める。5-3「裏でクイック∞周回」の決まり)
//   CARD_TOP    … トップ。はじめての人はスターター選び、コンピューター戦の相手えらび、結果もここ
//   CARD_BATTLE … 対戦
// ★いまはデバッグ設定からだけ入れる(HOME の入口は公開の区切りで足す。社長)
// ★保存は新しいキー mh_card_*(CARD_SAVE_KEYS)だけ。既存の mh_* には一切さわらない
// カードの絵(道具 tools/card/card-image-build.js が © を消して縮めたもの)。s=240×336(手札・場)/ l=480×672(詳しい画面)。フォルダごと使う
const CARD_IMAGE_SET = Object.freeze({ imageDir: 'images/card-battle' });
const CARD_IMG = (img, size = 's') => `${CARD_IMAGE_SET.imageDir}/${size}/${img}.jpg`;
// カードの裏面(2026-10-26 社長から届いた絵。images/card-battle/{s,l}/back.jpg・作り方は tools/art-sources/card-battle/card-back/README.md)
const CARD_BACK_IMG = (size = 's') => CARD_IMG('back', size);
const CARD_KIND_LABEL = Object.freeze({ pow: 'ちから', int: 'かしこさ', spe: '特殊', dge: '回避', blk: '防御', fld: '全体' });
const CARD_TYPE_LABEL = Object.freeze({ ground: '地上', air: '空中', water: '水中' });
const CARD_LEVEL_LABEL = Object.freeze({ easy: 'EASY', normal: 'NORMAL', hard: 'HARD', expert: 'EXPERT', master: 'MASTER' });
// 難易度の札の色(対戦の上の帯。2026-10-26)
const CARD_LEVEL_TONE = Object.freeze({
  easy: 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100', normal: 'border-sky-300/70 bg-sky-500/20 text-sky-100', hard: 'border-amber-300/70 bg-amber-500/20 text-amber-100',
  expert: 'border-rose-300/70 bg-rose-500/20 text-rose-100', master: 'border-fuchsia-300/80 bg-fuchsia-500/25 text-fuchsia-100', tutorial: 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100',
});
// 結果の画面の大きい見出し(2026-10-24 改善部の点検 V6「勝ち負けが左上の小さな見出しだけ」)。tone … win / lose / plain
// 結果の画面: もらったビートPを 0 から数え上げる(0.9秒。2026-10-26 改良の案 C・カゲあつくん 2)。動きを減らす設定なら、すぐ最後の数
const CardCountUp = ({ to = 0, ms = 900 }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const goal = Number.isFinite(Number(to)) ? Math.max(0, Math.round(Number(to))) : 0;
    if (!goal || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { setN(goal); return undefined; }
    const t0 = performance.now(); let raf = 0;
    const tick = (now) => { const k = Math.min(1, (now - t0) / ms); setN(Math.round(goal * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
};
// 勝った結果の画面の紙ふぶき(指の操作は通す)
const CardConfetti = ({ n = 28 }) => (
  <div aria-hidden="true" data-card-confetti className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
    {Array.from({ length: n }, (_, i) => (
      <i key={i} className="mh-card-confetti absolute top-0 block h-[14px] w-[8px] rounded-[2px]"
        style={{ left: `${(i * 37) % 100}%`, background: ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#f87171', '#ffffff'][i % 6], animationDelay: `${(i % 7) * 0.09}s`, '--cf-x': `${((i * 53) % 60) - 30}px`, '--cf-r': `${(i * 97) % 360}deg` }}/>
    ))}
  </div>
);
// 全体カードが場にあるあいだの、盤の背景(2026-10-26 社長「全体カードを使ったときは背景ごと変わるようにしたい」。改良の案 D のやり方B)。
//   字とモンスターが読めるように、どれも暗い色に、うすい模様を重ねる。表に無いカードは、カードの絵をぼかして暗くした背景にする(やり方A)
const CARD_FIELD_BG = Object.freeze({
  F115: 'repeating-linear-gradient(0deg, rgba(147,197,253,.07) 0 1px, transparent 1px 14px), linear-gradient(180deg, #0b1a3a, #0a1230 60%, #070b1f)',           // 冷静な判断: 静かな青・細い横線
  F116: 'repeating-linear-gradient(115deg, rgba(251,146,60,.10) 0 3px, transparent 3px 22px), radial-gradient(ellipse at 50% 100%, #7f1d1d, #2a0b0b 60%, #12060a)', // 壮絶な戦い: 赤・斜めの火の粉
  F117: 'repeating-radial-gradient(circle at 50% 50%, rgba(244,114,182,.08) 0 2px, transparent 2px 26px), radial-gradient(circle at 50% 50%, #5b1240, #2a0a24 60%, #12061a)', // 興奮のるつぼ: 赤紫・渦
  F118: 'radial-gradient(circle, rgba(253,224,240,.14) 1px, transparent 1.5px) 0 0 / 22px 22px, linear-gradient(180deg, #4a1638, #2a0d2a 60%, #140a1f)',       // ホリィの声援: 桃・小さな星
  F119: 'repeating-linear-gradient(90deg, rgba(253,186,116,.08) 0 2px, transparent 2px 30px), radial-gradient(ellipse at 50% 50%, #7c2d12, #2d1208 60%, #120a06)', // 必殺技の応酬: 橙・光の筋
  F120: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(250,204,21,.07) 0 10deg, rgba(168,85,247,.07) 10deg 20deg), linear-gradient(180deg, #2b1745, #1a1030 60%, #0d0a1f)', // 大混乱: 黄と紫・ぐるぐる
  F255: 'repeating-linear-gradient(45deg, rgba(253,224,71,.07) 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, rgba(253,224,71,.07) 0 1px, transparent 1px 18px), linear-gradient(180deg, #3d2c06, #241a06 60%, #110c05)', // 純血のプライド: 金・ひし形
  F256: 'repeating-linear-gradient(0deg, rgba(165,180,252,.06) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, rgba(165,180,252,.06) 0 1px, transparent 1px 24px), linear-gradient(180deg, #1e1b4b, #141238 60%, #0b0a24)', // 師匠のまなざし: 藍・うすい格子
  F257: 'repeating-linear-gradient(60deg, rgba(203,213,225,.07) 0 2px, transparent 2px 16px), repeating-linear-gradient(-60deg, rgba(203,213,225,.07) 0 2px, transparent 2px 16px), linear-gradient(180deg, #2e2840, #1d1a2c 60%, #100e1a)', // がんじがらめ: 灰紫・鎖の格子
  F258: 'repeating-linear-gradient(90deg, rgba(254,226,226,.06) 0 6px, transparent 6px 40px), linear-gradient(180deg, #2b2b33, #1c1c22 60%, #101014)',         // 必殺技の封印: 灰・お札の縦線
  F259: 'repeating-linear-gradient(110deg, rgba(186,230,253,.14) 0 2px, transparent 2px 14px), linear-gradient(180deg, #334155, #1e293b 60%, #0f172a)',        // 悪天候: 灰青・雨の筋
  F260: 'repeating-linear-gradient(100deg, rgba(251,146,60,.10) 0 6px, transparent 6px 26px), radial-gradient(ellipse at 50% 110%, rgba(249,115,22,.75), rgba(127,29,29,.6) 45%, #12060a 82%)', // 灼熱の地: 下から熱・立ちのぼる筋
  F261: 'radial-gradient(circle, rgba(253,224,71,.18) 1px, transparent 1.6px) 0 0 / 18px 18px, linear-gradient(180deg, #3a2f07, #221b06 60%, #110d05)',       // 飛び散る火花: 黄・点の火花
  F262: 'repeating-radial-gradient(circle at 50% 50%, rgba(196,181,253,.09) 0 2px, transparent 2px 22px), radial-gradient(circle at 50% 50%, #3b0764, #1e0838 60%, #0d0420)', // 空間のひずみ: 紫・輪
  F263: 'repeating-linear-gradient(0deg, rgba(253,230,138,.06) 0 10px, transparent 10px 44px), linear-gradient(180deg, #3b3020, #261f15 60%, #14100b)',       // 長期戦の予感: 砂色・ゆっくりした横の帯
});
const CardResultBanner = ({ title, sub, tone = 'win' }) => (
  <div data-card-result-banner={tone} className="mhms-in py-1 text-center">
    {/* 背の低い縦の画面(320×568 など)では小さくする。大きいままだと、もらったビートPが画面の下に隠れた(2026-10-27 通しの点検) */}
    <div className={`text-[44px] font-black italic leading-none tracking-wider [@media(orientation:portrait)_and_(max-height:600px)]:text-[34px] ${tone === 'win' ? 'text-amber-200' : tone === 'lose' ? 'text-slate-300' : 'text-sky-200'}`}
      style={{ textShadow: tone === 'win' ? '0 0 18px rgba(251,191,36,.65), 0 3px 0 #7c2d12' : '0 3px 0 #0f172a' }}>{title}</div>
    {sub && <div className="mt-1 text-[10px] font-black tracking-[0.3em] text-white/70 [@media(orientation:portrait)_and_(max-height:600px)]:hidden">{sub}</div>}
  </div>
);
// カードやモンスターの名前を1行に収める(2026-10-24 改善部の点検 V4「ぐるぐるアタッ/ク」「ストライクリパ/ー」)。
//   名前は1つの言葉なので折らない。長い名前だけ、入れ物の幅(cqw)に合わせて字を小さくする(size が上限・min が下限)
//   「ゴーレム(別絵キラ)」のような ( ) の付いた名前は、( ) から下の行へ分ける(名前の途中では折らない)
// 手札の名前を2行に折るとき(狭い画面・7文字以上)の切れ目。**2つの言葉の切れ目だけで折る**(2026-10-25 カゲあつくん
//   「フォー／メーション は1つの言葉の途中で割れている。1語のカタカナは割らない」)。
//   ① 「の」「・」の後ろ ② ひらがな・漢字とカタカナが切り替わる所(空中回転/アタック・きりもみ/アタック)
//   ③ カタカナだけの名前は、言葉の切れ目を機械では見分けられないので、下の表に書いた2語の名前だけ(ドラゴン/パンチ)。
//   表に無いカタカナの名前(フォーメーション・コンビネーション など1語)は割らずに、字を小さく・字の間を詰めて1行に収める
const CARD_NAME_KATAKANA_BREAKS = Object.freeze({
  'カララギマンゴー': 4, 'ファイアリバー': 4, 'フレイムビーム': 4, 'ファイアウェーブ': 4, 'パラボラビーム': 4, 'ロケットパンチ': 4,
  'レーザーブレード': 4, 'ファイナルソード': 5, 'バーストキャノン': 4, 'フェイスドリル': 4, 'ウィングカッター': 4, 'クローアタック': 3,
  'ドラゴンパンチ': 4, 'ドラゴンラッシュ': 4, 'ファイアブレス': 4, 'オイリーオイル': 4, 'タイムディレイ': 3, 'デススラッシュ': 2,
  'デスファイナル': 2, 'ニードルターン': 4, 'ファイナルボム': 5, 'サテラアタック': 3, 'メテオドライブ': 3, 'マインドフレア': 4,
  'ヒップアタック': 3, 'マッハトルネード': 3, 'デルタアタック': 3, 'スピンカッター': 3, 'ダブルチョップ': 3, 'ボディーブロー': 4,
  'ワンツーパンチ': 4, 'マシンガンパンチ': 5,
  'ピコピコハンマー': 4, 'ゴーストラッシュ': 4, // ゴースト(2026-10-27)
});
const cardNameScript = (c) => (/[ァ-ヴー]/.test(c) ? 'k' : /[ぁ-ゖ]/.test(c) ? 'h' : /[一-龯々]/.test(c) ? 'j' : 'o');
const cardNameSplit = (text) => {
  const ch = [...text];
  const cut = (i) => [ch.slice(0, i).join(''), ch.slice(i).join('')];
  if (CARD_NAME_KATAKANA_BREAKS[text]) return cut(CARD_NAME_KATAKANA_BREAKS[text]);
  // 「の」「・」の後ろをいちばん先に(ヒノトリの/復活。「ヒノトリ/の復活」にしない)。無ければ、ひらがな・漢字とカタカナの切り替わり。まんなかに近い所から
  const mid = ch.length / 2;
  const near = (list) => list.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
  const afterNo = [];
  const scriptTurn = [];
  for (let i = 1; i < ch.length; i++) {
    if (/[の・]/.test(ch[i - 1])) afterNo.push(i);
    else if (cardNameScript(ch[i - 1]) !== cardNameScript(ch[i]) && (cardNameScript(ch[i - 1]) === 'k' || cardNameScript(ch[i]) === 'k') && ch[i] !== 'の') scriptTurn.push(i);
  }
  if (afterNo.length) return cut(near(afterNo));
  if (scriptTurn.length) return cut(near(scriptTurn));
  return null; // 1語(割らない)
};
// twoLine … 手札の名前。箱が狭い(56px 以下・320幅や横画面の手札)ときだけ、長い名前(7文字以上)を言葉の切れ目で2行に折る。
//   1行のまま縮めると、いちばん小さい字(7px)でも入らず端が切れていた(2026-10-25 カゲあつくん「カララギマンゴ/ー」)。
//   切れ目の無い1語(フォーメーション など)は、字を小さく(5pxまで)・字の間を詰めて1行に収める(CSS の mh-nf-squeeze)。
//   倍率は 94(字の幅が広い等幅フォントでも入るように。104 だと IPAゴシックで 58・76px の箱から2〜4px はみ出した。2026-10-25)
//   狭いときは短い名前も2行ぶんの高さを取り、手札の絵の高さをそろえる(CSS の mh-nf-*。70-bootstrap.jsx)
const CardNameFit = ({ name, size = 10, min = 7, className = '', style = null, twoLine = false }) => {
  const text = String(name == null ? '' : name);
  const m = /^(.+?)([(（].+)$/.exec(text);
  const lines = m ? [m[1], m[2]] : [text];
  const long = twoLine && !m && [...text].length >= 7;
  const two = long ? cardNameSplit(text) : null;
  const squeeze = long && !two;
  const fit = (t) => `clamp(${squeeze ? 5 : min}px, ${((squeeze ? 94 : 96) / Math.max(1, [...t].length)).toFixed(1)}cqw, ${size}px)`;
  const row = (t, i) => <span key={i} className={`block overflow-hidden whitespace-nowrap text-center ${squeeze ? 'mh-nf-squeeze' : ''}`} style={{ fontSize: fit(t), textOverflow: 'clip' }}>{t}</span>;
  return (
    <span className={`block w-full ${className}`} style={{ containerType: 'inline-size', ...(style || {}) }}>
      <span className={twoLine ? `mh-nf-a block ${two ? 'mh-nf-hide' : ''}` : 'block'}>{lines.map(row)}</span>
      {two && <span data-card-name-two className="mh-nf-b">{two.map(row)}</span>}
    </span>
  );
};
// 相手の助手ごとの対戦の既定の曲(社長 台帳 #3438)。対人戦は ichika_battle(対人戦の区切りで使う)
// ききは綺季一閃のフル版(eiki_boss)。きゅうこの Toward the Stars はゲームに short 版しかないので、それを使う
//   曲の値は 82 の CARD_CPU_PLAYLIST_DEFAULT(助手と対戦の曲の並びの既定)に1か所で書いてある
const CARD_AI_BGM = Object.freeze(Object.fromEntries(Object.entries(CARD_CPU_PLAYLIST_DEFAULT).map(([who, list]) => [who, list[0]])));
const CARD_PVP_BGM = 'ichika_battle';
// 助手と対戦の曲の並び(2026-10-26): オプションで助手ごとに決めた1〜5曲。前の1曲えらび(mh_card_bgm_v1 の cpu)は使わない
const cardCpuPlaylistOf = (playlist, who) => {
  const list = playlist && playlist.assistants && Array.isArray(playlist.assistants[who]) ? playlist.assistants[who] : [];
  return list.length ? list : (CARD_AI_BGM[who] ? [CARD_AI_BGM[who]] : []);
};
const cardIsBgmTrack = (id) => typeof BGM_TRACKS !== 'undefined' && BGM_TRACKS.some((t) => t.id === id);
// モンスターの絵(5-3)。モンヒロにいる種族はいまのゲームの絵、いない16種族は社長から届いた立ち絵(#3437 でクラフトくんが取り込んだ)。
// 混血の15体は、立ち絵が届いた子から立ち絵にする(HYBRID_MONSTER_IMGS)。まだの子はカードの絵で代える(社長)
const CARD_SPECIES_ART = Object.freeze({ tiger: 'Tiger', golem: 'Golem', suezo: 'Suezo', pixie: 'Pixie', hare: 'Ham', mocchi: 'Mocchi', monol: 'Monol', plant: 'Plant', ghost: 'Ghost' });
const cardNewSpeciesArt = () => ({
  dino: typeof MF_DINO_IMG !== 'undefined' ? MF_DINO_IMG : null,
  gali: typeof MF_GALI_IMG !== 'undefined' ? MF_GALI_IMG : null,
  naga: typeof MF_NAGA_IMG !== 'undefined' ? MF_NAGA_IMG : null,
  dragon: typeof MF_DRAGON_IMG !== 'undefined' ? MF_DRAGON_IMG : null,
  henger: typeof MF_HENGER_IMG !== 'undefined' ? MF_HENGER_IMG : null,
  durahan: typeof MF_DURAHAN_IMG !== 'undefined' ? MF_DURAHAN_IMG : null,
  arrowhead: typeof MF_ARROWHEAD_IMG !== 'undefined' ? MF_ARROWHEAD_IMG : null,
  zilla: typeof MF_ZILLA_IMG !== 'undefined' ? MF_ZILLA_IMG : null,       // グジラは地上も水中も同じ立ち絵(社長)
  phoenix: typeof MF_PHOENIX_IMG !== 'undefined' ? MF_PHOENIX_IMG : null,
  joker: typeof MF_JOKER_IMG !== 'undefined' ? MF_JOKER_IMG : null,
  jell: typeof MF_JELL_IMG !== 'undefined' ? MF_JELL_IMG : null,
  mew: typeof MF_MEW_IMG !== 'undefined' ? MF_MEW_IMG : null,
  metalner: typeof MF_METALNER_IMG !== 'undefined' ? MF_METALNER_IMG : null,
  worm: typeof MF_WORM_IMG !== 'undefined' ? MF_WORM_IMG : null,
  centaur: typeof MF_CENTAUR_IMG !== 'undefined' ? MF_CENTAUR_IMG : null,
  colorpandora: typeof MF_COLORPANDORA_IMG !== 'undefined' ? MF_COLORPANDORA_IMG : null,
});
const cardMonArt = (mon) => {
  // 混血は、立ち絵が届いた子だけ立ち絵(クラフトくんの HYBRID_MONSTER_IMGS。番号から引く)。まだの子はカードの絵
  if (mon.main) return (typeof HYBRID_MONSTER_IMGS !== 'undefined' && HYBRID_MONSTER_IMGS && HYBRID_MONSTER_IMGS[mon.no]) || null;
  const id = CARD_SPECIES_ART[mon.species];
  const m = id && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[id] : null;
  if (m && m.imgUrl) return m.imgUrl;
  return cardNewSpeciesArt()[mon.species] || null;
};
const cardTodayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const cardCaption = (c) => (!c ? '' : c.kind === 'dge' ? '回避' : c.kind === 'blk' ? '防御' : c.kind === 'spe' ? '特殊' : c.kind === 'fld' ? '全体' : Number.isFinite(c.damage) ? `ダメージ${c.damage}` : '');   // 全体カードはダメージが無い(「ダメージnull」と出ていた)
// 場の子に今かかっている効果(2026-10-28 社長「こういう効果がかかってるやつがわからない バフとかデバフとか」・案A)。
//   ルールの項目を読むだけ。返す [{ key, short(札の言葉), left(「次」「あと2」など), text(窓の説明), tone, pill(札に出すか) }]
//   left … 上の帯の「ターン◯」は片方の番ごとに1つ進む。「あと2」はこの番を入れて2つの番のあいだ
const cardMonStatuses = (st, p, m) => {
  const mon = st && st.players[p] && st.players[p].mons[m];
  if (!mon || mon.ko) return [];
  const T = st.turn;
  const left = (until) => (until > T ? `あと${until - T + 1}` : 'この番');
  const out = [];
  const kindsJa = (ks) => (ks || []).map((k) => (k === 'pow' ? 'ちから' : k === 'int' ? 'かしこさ' : k)).join('・');
  if (mon.mult && Number.isFinite(mon.mult.turn) && mon.mult.turn >= T) out.push({ key: 'mult', short: `技×${mon.mult.n}`, left: mon.mult.turn > T ? '次' : 'この番', text: `${mon.mult.turn > T ? '次の番' : 'この番'}の${kindsJa(mon.mult.kinds)}技のダメージが${mon.mult.n}倍`, tone: 'up', pill: true });
  if (mon.charge) out.push({ key: 'charge', short: `ため×${mon.charge.n}`, left: '', text: `次の${kindsJa(mon.charge.kinds)}技のダメージが${mon.charge.n}倍(ダメージを受けると消える)`, tone: 'up', pill: true });
  if (Number.isFinite(mon.safeUntil) && mon.safeUntil >= T) out.push({ key: 'safe', short: '無敵', left: left(mon.safeUntil), text: 'ダメージを受けない', tone: 'guard', pill: true });
  if (Number.isFinite(mon.noGuardUntil) && mon.noGuardUntil >= T) out.push({ key: 'noGuard', short: '守れない', left: left(mon.noGuardUntil), text: '回避・防御のカードを出せない', tone: 'down', pill: true });
  if (Number.isFinite(mon.airUntil) && mon.airUntil >= T) out.push({ key: 'air', short: '空中', left: left(mon.airUntil), text: '持ちょうが空中(地上の子しか狙えない技は当たらない)', tone: 'type', pill: true });
  else if (Number.isFinite(mon.waterUntil) && mon.waterUntil >= T) out.push({ key: 'water', short: '水中', left: left(mon.waterUntil), text: '持ちょうが水中', tone: 'type', pill: true });
  (Array.isArray(st.taunts) ? st.taunts : []).filter((t) => t && t.by === p && t.m === m && t.turn >= T).forEach((t, i) => out.push({ key: `taunt${i}`, short: t.mode === 'not' ? 'ねらえない' : 'ねらい固定', left: left(t.turn), text: t.mode === 'not' ? '相手はこの子を狙えない' : '相手の攻撃は、この子しか狙えない', tone: 'aim', pill: true }));
  if (mon.cocoon) out.push({ key: 'cocoon', short: 'まゆ', left: '', text: '羽化のほかのカードは出せない', tone: 'down', pill: true });
  if (mon.stunTurn === T + (st.active === p ? 0 : 1)) out.push({ key: 'stun', short: '攻撃できない', left: st.active === p ? 'この番' : '次', text: `${st.active === p ? 'この番' : '次の番'}は攻撃できない`, tone: 'down', pill: false });
  return out;
};
const CARD_STATUS_TONE = { up: 'bg-rose-400 text-slate-950', down: 'bg-slate-300 text-slate-950', guard: 'bg-emerald-300 text-slate-950', type: 'bg-sky-300 text-slate-950', aim: 'bg-amber-300 text-slate-950' };
// 効果の一覧(「+2」を押したときの窓と、長押しの詳しい画面の下。対戦・観戦で同じ部品)
const CardStatusList = ({ list }) => (!list || !list.length ? null : (
  <div data-card-status-list className="space-y-1.5">
    {list.map((x) => (
      <div key={x.key} className="flex items-start gap-2">
        <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black ${CARD_STATUS_TONE[x.tone] || CARD_STATUS_TONE.down}`}>{x.short}{x.left ? ` ${x.left}` : ''}</span>
        <span className="min-w-0 text-[12px] font-bold leading-snug text-slate-200" style={JA_WRAP_STYLE}>{x.text}</span>
      </div>
    ))}
  </div>
));
const CardStatusSheet = ({ name, list, onClose }) => (
  <div data-card-status-sheet onClick={onClose} className="fixed inset-0 flex items-center justify-center bg-black/60 px-4" style={{ zIndex: MODAL_Z.dialog }}>
    <div className="w-full max-w-sm rounded-2xl border-2 border-amber-300/80 bg-slate-950/95 p-3 text-slate-100">
      <div className="mb-2 text-[15px] font-black" style={JA_WRAP_STYLE}>{name}にかかっている効果</div>
      <CardStatusList list={list}/>
      <div className="mt-2 text-right text-[10px] font-bold text-slate-400">タップで閉じる</div>
    </div>
  </div>
);
// 手札の番号の並びを、カードの名前(番号)の並びにする(同じ名前の組み合わせを1つにまとめる)
const cardHandNameKey = (hand, idx) => idx.map((i) => hand[i]).sort().join(',');
// 記録の1行の文。守り・回避で減った当たりは「(5 → 2)」を添える(82 が from・to を持たせる。古い記録には無いので、そのままの文)
const cardLogText = (l) => (!l ? '' : Number.isFinite(l.from) && Number.isFinite(l.to) ? `${l.text}(${l.from} → ${l.to})` : l.text);
// 守りの札を短く(守った子の上の印・「◯◯を使った」に出す。2026-10-27 社長・案A)
const cardGuardShort = (c) => {
  if (!c) return '';
  if (c.kind === 'dge') return '回避';
  const e = c.effects || [];
  const r = e.find((x) => x.t === 'reduce');
  if (r) return `防御 −${r.n}`;
  if (e.some((x) => x.t === 'reduceHalf')) return '防御 半分';
  if (e.some((x) => x.t === 'reduceAll')) return '防御 0';
  if (e.some((x) => x.t === 'reflect')) return 'はね返す';
  if (e.some((x) => x.t === 'endure')) return '根性';
  return c.name;
};
// 守りの番の「受けるダメージ 前 → 後」と「◯◯(防御 −3)を使った」(対戦・観戦・マルチで同じ部品。pv は 82 の cardGuardPreview)
//   tight … まんなかが狭いとき(320×568 の守りの番・stageFit が上がったとき)は1行にまとめる(2行だと記録の下が切れた)
const CardGuardPreview = ({ db, pv, compact = false, tight = false }) => {
  if (!pv || !pv.cards.length) return null;
  const names = pv.cards.map((no) => { const c = cardOf(db, no); return c ? `${c.name}(${cardGuardShort(c)})` : ''; }).filter(Boolean).join('・');
  if (tight) {
    return (
      <div data-card-guard-preview={pv.after === null ? 'moved' : `${pv.before}-${pv.after}`} className="whitespace-nowrap text-[12px] font-black leading-tight text-white">
        {pv.after !== null ? <>受ける <span className="text-rose-300 line-through decoration-2">{pv.before}</span> → <span className="text-[14px] text-emerald-300">{pv.after}</span></> : 'これで受ける'}
        <span className="ml-1 text-[10px] font-bold text-amber-200">{pv.cards.map((no) => cardGuardShort(cardOf(db, no))).join('・')}</span>
      </div>
    );
  }
  return (
    <div data-card-guard-preview={pv.after === null ? 'moved' : `${pv.before}-${pv.after}`} className="leading-tight">
      {pv.after !== null && <div className={`${compact ? 'text-[15px]' : 'text-[17px]'} font-black text-white`}>受けるダメージ <span className="text-rose-300 line-through decoration-2">{pv.before}</span> → <span className="text-[1.3em] text-emerald-300">{pv.after}</span></div>}
      <div className="text-[11px] font-bold text-amber-200" style={JA_WRAP_STYLE}>{names}を使った</div>
    </div>
  );
};
// 当たった瞬間の「🛡 防御！ 5 → 2」「💨 回避！ 5 → 0」(f は当たりの出来事。82 が base を付ける。base の無い古い出来事は出さない)
const cardHitResultOf = (f) => {
  if (!f || f.heal || f.self || f.reflect || !Number.isFinite(f.base)) return null;
  if ((f.evaded || f.guarded) && f.base !== f.dmg) return { kind: f.evaded ? 'evade' : 'guard', before: f.base, after: f.dmg };
  if (!f.evaded && !f.guarded && f.dmg > 0) return { kind: 'none' };
  return null;
};
const CardHitResult = ({ f, tiny = false }) => {
  const r = cardHitResultOf(f);
  if (!r) return null;
  if (r.kind === 'none') return <span data-card-hit-result="none" className="mh-card-guard-result pointer-events-none absolute left-1/2 top-[58%] z-[51] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-slate-200">守らなかった</span>;
  return (
    <span data-card-hit-result={r.kind} className={`mh-card-guard-result pointer-events-none absolute left-1/2 top-[-6px] z-[51] -translate-x-1/2 whitespace-nowrap rounded-xl border-2 bg-slate-950/85 px-1.5 text-center font-black leading-tight ${r.kind === 'evade' ? 'border-sky-300 text-sky-100' : 'border-amber-300 text-amber-100'} ${tiny ? 'text-[11px]' : 'text-[13px]'}`}>
      {r.kind === 'evade' ? '💨 回避！' : '🛡 防御！'}<br/><span className="text-rose-300 line-through decoration-2">{r.before}</span> → <span className={`${tiny ? 'text-[15px]' : 'text-[18px]'} text-white`}>{r.after}</span>
    </span>
  );
};
const cardUserLabel = (db, c) => {
  if (!c) return '';
  if (c.user === 'any') return '全モンスター';
  if (c.user === 'breeder') return 'ブリーダー';
  const m = Object.values(db.monsters).find((x) => x.species === c.user && !x.variant);
  return m ? `${m.name}専用` : c.user;
};
// 守りの番に使える回避・防御が無いとき、なぜ使えないかを短く出す(手札の守りのカードごとに、最初に引っかかった理由)
const cardGuardBlockReasons = (db, st) => {
  const pd = st.pending;
  if (!pd) return [];
  const q = pd.defender;
  const me = st.players[q];
  const t = pd.targets[pd.ti];
  const target = t ? st.players[t.p].mons[t.m] : null;
  const atk = cardOf(db, pd.main);
  const kindName = { pow: 'ちから技', int: 'かしこさ技' };
  const out = [];
  const guards = me.hand.map((no) => cardOf(db, no)).filter((c) => c && cardIsGuardKind(c.kind));
  if (!guards.length) return ['手札に回避・防御のカードがありません'];
  guards.forEach((c) => {
    const ev = cardEff(c, 'evade');
    const re = cardEff(c, 'reduce') || cardEff(c, 'reduceHalf') || cardEff(c, 'reduceAll') || cardEff(c, 'reflect');
    let why = null;
    if (!c.ready) why = `「${c.name}」は準備中`;
    else if ((st.forbid[q] || []).includes(c.kind)) why = `このターンは${c.kind === 'dge' ? '回避' : '防御'}を使えません`;
    else if (c.guts > me.guts.length) why = `「${c.name}」はガッツが足りません(あと${c.guts - me.guts.length})`;
    else if (cardHasEff(c, 'cover')) why = `「${c.name}」は味方が狙われたときに、別の子が使います`;
    else if (target && t.p === q && !cardUsableBy(c, target)) why = `「${c.name}」は${target.name}が使えるカードではありません`;
    else if (ev && cardHasEff(atk, 'noEvade')) why = `「${atk.name}」は回避できません`;
    else if (ev && !ev.kinds.includes(atk.kind)) why = `「${c.name}」は${ev.kinds.map((k) => kindName[k] || k).join('・')}にしか使えません`;
    else if (ev && ev.minGuts && pd.cost < ev.minGuts) why = `「${c.name}」はガッツ${ev.minGuts}以上の技にしか使えません`;
    else if (re && !re.kinds.includes(atk.kind)) why = `「${c.name}」は${re.kinds.map((k) => kindName[k] || k).join('・')}にしか使えません`;
    // 防御でマイナスされない技(技そのもの・渾身つき)には −N・半分・0 の防御は出せない(案A)。はね返す防御は別
    else if (!cardEff(c, 'reflect') && (cardEff(c, 'reduce') || cardEff(c, 'reduceHalf') || cardEff(c, 'reduceAll')) && (cardHasEff(atk, 'noBlockReduce') || (pd.flags || {}).attachNoBlockReduce)) why = `この攻撃は防御でダメージを減らせません`;
    if (why && !out.includes(why)) out.push(why);
  });
  return out.slice(0, 2);
};
const CARD_CPU = 1;
const CARD_DRAG_THRESHOLD = 10; // 指がこれだけ動いたら「運ぶ」(モンヒロバトルの DRAG_THRESHOLD と同じ)
const CARD_ME = 0;
const cardDeciderOf = (st) => (st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : cardDecider(st));

// 長押しで詳しい画面(どのカードでも。5-3)。指を離すまでに 450ms たったら長押し。
// 2回続けてタップ(CARD_DOUBLE_TAP_MS の内。モンヒロバトルの手札と同じ間・10-core)でも詳しい画面(2026-10-26 社長「ダブルタップでも見られるように」)。
//   press(no, onTap, opt) の opt:
//     double … false ならダブルタップを使わない(デッキ編成。1タップで入れる・続けて入れられるを残す。社長の決め)
//     undo   … 2回目が来たときに1回目を取り消す関数(取り消せる所だけ)
//   1回目のタップは待たずにすぐ動かす。同じ札の2回目が CARD_DOUBLE_TAP_MS の内に来たら詳しい画面。別の札なら、ふつうの次のタップ
//   (2026-10-27 部長ソランドくん: 1回目を 350ms 待つ作りだと、守りの番で反応が遅く、待つあいだに別の札を押すと1回目が消えていた)
//   iPhone の Safari がダブルタップで画面を拡大しないよう、押せるカードには data-card-press を付け、その印にだけ touch-action: manipulation を当てる
if (typeof document !== 'undefined' && document.head && !document.getElementById('mh-card-press-css')) {
  const el = document.createElement('style');
  el.id = 'mh-card-press-css';
  el.textContent = '[data-card-press]{touch-action:manipulation}';
  document.head.appendChild(el);
}
const useCardLongPress = (onLong, ms = 450) => {
  const timer = useRef(null);
  const fired = useRef(false);
  const last = useRef(null);    // 前のタップ { no, at }
  useEffect(() => () => clearTimeout(timer.current), []);
  return (no, onTap, opt = {}) => ({
    'data-card-press': true,
    onPointerDown: () => { fired.current = false; clearTimeout(timer.current); timer.current = setTimeout(() => { fired.current = true; last.current = null; onLong(no); }, ms); },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => {
      if (fired.current) { fired.current = false; return; }
      const now = Date.now();
      if (opt.double !== false && last.current && last.current.no === no && now - last.current.at < CARD_DOUBLE_TAP_MS) {
        last.current = null;
        if (opt.undo) opt.undo();
        onLong(no);
        return;
      }
      last.current = { no, at: now };
      if (onTap) onTap(e);
    },
  });
};

// ---- 公開前の予告の小窓(社長 2026-10-25「近日公開みたいな感じでホームに出して」) ----
// HOME の「近日公開」の札を押すと出る。絵と文は、更新履歴の予告の項目(assistantNotice の id で引く)と同じもの(書く場所を1つにする)。
// 中の画面へは入れない。何も保存しない
const CARD_TEASER_NOTICE_ID = 'update_notice_card_battle_soon_v1';
const CardBattleTeaser = ({ onClose }) => {
  const entry = (typeof CHANGELOG !== 'undefined' && Array.isArray(CHANGELOG) ? CHANGELOG : []).find((e) => e && e.assistantNotice && e.assistantNotice.id === CARD_TEASER_NOTICE_ID) || null;
  return (
    <div data-card-teaser role="dialog" aria-modal="true" aria-label="MFバトルカード 近日公開" onClick={onClose} className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4" style={{ zIndex: MODAL_Z.dialog, backgroundColor: 'rgba(2,6,23,0.88)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-3xl border-2 border-amber-300/80 bg-slate-950 p-3 text-white shadow-2xl landscape:max-w-[760px]">
        <div className="landscape:flex landscape:items-start landscape:gap-3">
          {entry && entry.image && <img src={entry.image} alt="MFバトルカード 近日公開" className="w-full rounded-2xl landscape:w-[46%] landscape:shrink-0"/>}
          <div className="min-w-0 landscape:flex-1">
            <div className="mt-2 flex items-center gap-2 landscape:mt-0">
              <b className="text-[18px] font-black">MFバトルカード</b>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-slate-950">近日公開</span>
            </div>
            <div className="mt-1.5 space-y-1">
              {(entry ? entry.items.filter((t) => !/HOMEに入口/.test(t)) : ['近日公開します。']).map((t, i) => <p key={i} className="text-[12px] font-bold leading-relaxed text-slate-200" style={JA_WRAP_STYLE}>{t.split(/(「[^」]+」)/).map((part, k) => (/^「[^」]+」$/.test(part) ? <span key={k} className="inline-block whitespace-nowrap">{part}</span> : <React.Fragment key={k}>{jaWrap(part)}</React.Fragment>))}</p>)}
            </div>
            <button type="button" data-card-teaser-close onClick={onClose} className="mh-button mh-button-primary mt-3 min-h-[48px] w-full rounded-2xl text-[14px] font-black active:scale-[.98]">閉じる</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- 結果の画面の、相手の助手のひとこと。決まった台詞をすぐ出し、対戦後のひとこと(AI)が届いたら差しかえる(83-card-battle-talk-ai.jsx) ----
// 結果の画面の「自分 vs 相手」の1行(2026-10-26 社長: 結果の画面にも自分のアイコンを)。
// 自分はプロフィールのアイコン+フレーム(60-app の renderMeIcon)、相手は助手の顔か、マルチの相手のアイコン。名前は「…」で切らず字を縮める
// 名前の欄は、字数に合わせて幅を分ける(同じ幅だと、長い名前だけ小さく縮んだ)
const CardResultVsName = ({ name }) => (
  <span className="block min-w-0" style={{ containerType: 'inline-size', flex: `${Math.max(2, [...String(name || '')].length)} 1 0` }}>
    <span className="block overflow-hidden whitespace-nowrap font-black leading-tight text-white" style={{ fontSize: `clamp(8px, ${(96 / Math.max(1, [...String(name || '')].length)).toFixed(1)}cqw, 13px)` }}>{name}</span>
  </span>
);
const CardResultVsRow = ({ meIcon = null, meName = 'あなた', foeNode = null, foeName = '', outcome = '' }) => (
  <div data-card-result-vs className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-900/70 px-2 py-1.5">
    <span data-card-result-me-icon aria-hidden="true" className="block h-8 w-8 shrink-0">{meIcon || <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-[18px]">🧑</span>}</span>
    <CardResultVsName name={meName}/>
    <span className="shrink-0 text-[12px] font-black italic text-amber-300">vs</span>
    <span aria-hidden="true" className="block h-8 w-8 shrink-0">{foeNode}</span>
    <CardResultVsName name={foeName}/>
    {outcome && <span data-card-result-vs-outcome className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-black ${outcome === '勝ち' ? 'bg-amber-300 text-slate-950' : 'bg-slate-700 text-slate-100'}`}>{outcome}</span>}
  </div>
);
const CardResultTalk = ({ a, lineScene, talkFacts }) => {
  const [line] = useState(() => cardPickLine(a.id, lineScene, null)); // 助手から見た勝ち負け
  const [ai, setAi] = useState(null);
  useEffect(() => {
    let alive = true;
    if (talkFacts && cardAiTalkOn()) void cardTalkFetch('after', { who: a.id, facts: talkFacts, samples: cardTalkSamples(a.id, lineScene) }).then((r) => { if (alive && r) setAi(r); });
    return () => { alive = false; };
  }, []);
  const text = ai ? ai.text : line ? line.text : '';
  const face = ai ? ai.face : line ? line.face : 'normal';
  return (
    <div data-card-result-talk={ai ? 'ai' : 'line'} className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
      <CardAssistantArt src={assistantFullImage(a, face)} alt={a.name} className="w-[46%]" style={{ height: 'min(220px, 28vh, max(110px, calc(var(--mh-vh) - 460px)))' }}/>
      <div className="mb-2 min-w-0 flex-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: a.accent, ...JA_WRAP_STYLE }}>{cardJaWrap(text)}</div>
    </div>
  );
};

// ---- 「助手と対戦」で、選んだ助手の戦い方の型と使うモンスター(2026-10-25 社長「攻撃型とかピクシーとかなになにを編成しやすいとか出して」) ----
// どれもデータ(CARD_AI_HABITS・CARD_AI_DECKS)から作る。癖の重みや勝率などの数字は出さない(見えない強さを明かさない)
const CARD_FOE_STYLES = Object.freeze({
  attack: { label: '攻撃型', note: 'ちから・かしこさの技で、どんどん攻める' },
  disrupt: { label: '邪魔型', note: 'ガッツを減らしたり、こちらのじゃまをする' },
  big: { label: '大技型', note: 'ガッツをためて、大きな技を打つ' },
  saveGuts: { label: 'ため型', note: 'ガッツをためてから動く' },
  keepGuard: { label: '守り型', note: '守りのカードを残して、固く戦う' },
  area: { label: '全体攻撃型', note: '全体攻撃で、まとめてダメージを与える' },
  finish: { label: 'とどめ型', note: '弱ったモンスターを、確実に倒しにくる' },
  balance: { label: 'バランス型', note: '場面に合わせて、まんべんなく戦う' },
});
// いちばん強い癖で型を決める。どの癖もほとんど同じ(いちばん強くても 1.2 まで)なら、バランス型
const cardFoeStyle = (who) => {
  const h = CARD_AI_HABITS[who];
  if (!h) return null;
  const [k, v] = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
  return v <= 1.2 ? CARD_FOE_STYLES.balance : (CARD_FOE_STYLES[k] || CARD_FOE_STYLES.balance);
};
// 強さごとの組み方の説明(82 の CARD_AI_BUILD と同じ決め。数字は出さない)
// 吹き出しを出しておく時間(字の数で決める。顔文字・記号も1字に数える)
// 大事な場面の台詞は、顔の大きいカットインで出す(2026-10-26 社長 OK の改良の案 B・カゲあつくん 5)。順番待ちと出しておく時間は、ふつうの吹き出しと同じ。
//   カットインは背が高いので、まんなかに重ねずに並びの中へ入れて、記録を下へ送る(重ねると最新の記録の行の上を隠した。2026-10-27 フキダシくん)。台詞の折り方は cardJaWrap(ほかのカードの吹き出しとそろえる)
const CARD_CUTIN_SCENES = Object.freeze(['myKo', 'theirKo', 'lastMine', 'lastTheirs', 'deckMine', 'deckTheirs']);
const cardBubbleMs = (text) => Math.min(7000, Math.max(3000, 1800 + 150 * [...String(text || '')].length));
// 結果の画面: 負け・投了で満額より減ったか(r は cardCpuReward の返り値。古い形・マルチの形には full が無いので出さない)
const cardResultCut = (r) => !!r && !r.short && Number.isFinite(r.full) && Number.isFinite(r.got) && r.got < r.full;
//   投了は「番の数で減った分」と「倒した数×10」の小さいほう(82 の cardCpuBasePoint)なので、効いたほうの理由を出す
const cardResultCutWhy = (outcome, r) => {
  const turns = `自分の番が${Number(r.ownTurns) || 0}回。${CARD_LOSE_FULL_TURNS}回で満額`;
  if (outcome !== 'surrender') return turns;
  const byKo = (Number(r.kos) || 0) * CARD_SURRENDER_POINT_PER_KO;
  return byKo < cardLoseScaled(r.full, r.ownTurns) ? `投了は、倒した相手のモンスター1体につき${CARD_SURRENDER_POINT_PER_KO}(倒したのは${Number(r.kos) || 0}体)` : turns;
};
const CARD_FOE_BUILD_NOTE = Object.freeze({
  //   遊ぶ人の目で書く(「組み方は雑」「型どおり」は作り手の言葉だった。2026-10-26 カゲあつくんの通しの点検)
  easy: '好きな子を中心に、のんびり組んでくる。気まぐれな子が混ざることも(カードは第1弾から)',
  normal: '好きな子と、戦い方に合う子で組んでくる。カードはざっくり選ぶ',
  hard: '戦い方に合う子とカードで、しっかり組んでくる(カードは第1弾から)',
  expert: '戦い方に合う子と、全部の弾の強いカードで、しっかり組んでくる',
  master: '全部の弾から本気で組んでくる。あなたのデッキを見て、モンスターを選び直すことも',
});
const CardFoeStyle = ({ db, who, level }) => {
  const style = cardFoeStyle(who);
  const recipe = CARD_AI_DECKS[who];
  if (!style || !recipe) return null;
  // 好きなモンスター(主血統で決める。82 の CARD_AI_FAVORITE)。名前と顔だけ出す(社長 2026-10-25「余計な文消しといて」)
  const favSpecies = CARD_AI_FAVORITE[who];
  const fav = Object.values(db.monsters).find((m) => m.species === favSpecies && !m.variant && String(m.wave) !== 'hybrid') || null;
  const lv = CARD_LEVEL_LABEL[level] || '';
  const upper = level === 'hard' || level === 'expert' || level === 'master';
  return (
    <div data-card-foe-style={who} className="space-y-1.5 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span data-card-foe-style-label className="shrink-0 rounded-full bg-amber-300 px-2.5 py-0.5 text-[12px] font-black text-slate-950">{style.label}</span>
        <span className="min-w-0 text-[11px] font-bold text-slate-200" style={JA_WRAP_STYLE}>{jaWrap(style.note)}</span>
      </div>
      {fav && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <small className="shrink-0 text-[10px] font-black text-slate-400">好きなモンスター</small>
          <span data-card-foe-mon={fav.no} className="flex shrink-0 items-center gap-1">
            <img src={cardMonArt(fav) || CARD_IMG(fav.img)} alt="" aria-hidden="true" className="h-8 w-8 rounded-md bg-white/10 object-contain"/>
            <b className="whitespace-nowrap text-[13px] font-black text-amber-100">{fav.name}</b>
          </span>
        </div>
      )}
      {upper && Array.isArray(recipe.prefer) && recipe.prefer.length > 0 && (
        <div data-card-foe-prefer className="text-[11px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
          <small className="mr-1 text-[10px] font-black text-slate-400">よく使うカード</small>
          {recipe.prefer.map((n, i) => <span key={n} className="inline-block whitespace-nowrap">{n}{i < recipe.prefer.length - 1 ? '・' : ''}</span>)}
        </div>
      )}
      <div data-card-foe-deck-note className="text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`${lv}: ${CARD_FOE_BUILD_NOTE[level] || ''}`)}</div>
    </div>
  );
};

// ---- 詳しい画面(大きな絵・名前・種類・ガッツ・使える子・番号・文)。どこをタップしても閉じる ----
const CardDetailModal = ({ db, no, onClose, status = null, statusName = '' }) => {
  const c = cardOf(db, no);
  const m = c ? null : cardMonsterOf(db, no);
  return (
    <div data-card-detail onClick={onClose} className="fixed inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6" style={{ zIndex: MODAL_Z.dialog, backgroundColor: 'rgba(2,6,23,0.94)' }} role="dialog" aria-label="カードの詳しい画面">
      <img src={CARD_IMG(c ? c.img : m ? m.img : no, 'l')} alt={c ? c.name : m ? m.name : ''} className="w-[min(78vw,300px)] rounded-xl shadow-2xl"/>
      {c && (
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/90 p-3 text-slate-100">
          <div className="text-lg font-black">{c.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-indigo-900 px-2 py-0.5">{CARD_KIND_LABEL[c.kind]}</span>
            <span className="rounded-md bg-amber-900 px-2 py-0.5">ガッツ{c.guts}</span>
            {c.damage !== null && c.damage !== undefined && <span className="rounded-md bg-rose-900 px-2 py-0.5">ダメージ{c.damage}</span>}
            <span className="rounded-md bg-slate-700 px-2 py-0.5">{cardUserLabel(db, c)}</span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">No.{c.no}</span>
          </div>
          {c.text && <p className="mt-2 text-[14px] font-bold leading-relaxed">{c.text}</p>}
          {c.note && <p data-card-detail-note className="mt-1.5 text-[12px] font-bold leading-relaxed text-sky-200" style={JA_LABEL_STYLE}>{jaWrap(c.note)}</p>}
          {!c.ready && <p className="mt-2 text-[12px] font-bold text-amber-300" style={JA_LABEL_STYLE}>{jaWrap('このカードは準備中です(まだデッキに入れられません)')}</p>}
        </div>
      )}
      {m && (
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/90 p-3 text-slate-100">
          <div className="text-lg font-black">{m.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-emerald-900 px-2 py-0.5">ライフ{m.life}</span>
            <span className="rounded-md bg-sky-900 px-2 py-0.5">{CARD_TYPE_LABEL[m.type]}</span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">No.{m.no}</span>
          </div>
          {m.dexOnly && <p data-card-dex-only className="mt-2 text-[12px] font-bold text-amber-300" style={JA_LABEL_STYLE}>{jaWrap('まだ手に入らないカードです(パックには入っていません)')}</p>}
        </div>
      )}
      {/* 対戦中の場の子を長押ししたときは、いまかかっている効果も並べる(案A) */}
      {m && status && status.length > 0 && (
        <div data-card-detail-status className="w-full max-w-sm rounded-2xl border border-amber-300/50 bg-slate-900/90 p-3 text-slate-100">
          <div className="mb-1.5 text-[13px] font-black text-amber-200" style={JA_WRAP_STYLE}>{statusName || m.name}にかかっている効果</div>
          <CardStatusList list={status}/>
        </div>
      )}
      <button type="button" onClick={onClose} className="mh-button mh-button-secondary min-h-[48px] w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 font-black">閉じる</button>
    </div>
  );
};

// ---- 捨て札の一覧(自分/相手のタブ・新しい順・1枚を長押しで詳しい画面) ----
const CardDiscardModal = ({ db, st, initial = CARD_ME, onDetail, onClose }) => {
  const [tab, setTab] = useState(initial);
  const press = useCardLongPress(onDetail);
  const list = st.players[tab].discard.slice().reverse();
  return (
    <ModalFrame label="捨て札" border="border-indigo-400/70" onClose={onClose}>
      <div data-card-discard className="mb-2 grid grid-cols-2 gap-2">
        {[CARD_ME, CARD_CPU].map((p) => (
          <button key={p} type="button" onClick={() => setTab(p)} className={`min-h-[44px] rounded-xl border text-[13px] font-black ${tab === p ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-slate-900 text-slate-300'}`}>
            {p === CARD_ME ? '自分の捨て札' : '相手の捨て札'}({st.players[p].discard.length})
          </button>
        ))}
      </div>
      <div className="grid max-h-[60vh] grid-cols-4 gap-1.5 overflow-y-auto">
        {list.length === 0 && <p className="col-span-4 py-6 text-center text-[13px] font-bold text-slate-400">まだありません</p>}
        {list.map((no, i) => { const c = cardOf(db, no); return (
          <div key={`${no}-${i}`} {...press(no)} className="flex flex-col items-center" style={{ containerType: 'inline-size' }}>
            <img src={CARD_IMG(c ? c.img : no)} alt={c ? c.name : no} loading="lazy" className="w-full rounded-md"/>
            <CardDiscardName name={c ? c.name : no}/>
          </div>
        ); })}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('カードを長押しすると詳しく見られます')}</p>
      <div className="mt-2"><ModalCloseButton onClick={onClose}/></div>
    </ModalFrame>
  );
};

// ---- 場のモンスター1体(カードの小さい絵・名前・ライフ・特徴・モンヒロの絵) ----
// ターンごとの記録(案C「記録を見る」)。新しいターンが上。ターンの名前は記録の kind:'turn' の行から
const CardTurnLogSheet = ({ st, meName, foeName, onClose }) => {
  const turns = [];
  for (const l of st.log) {
    if (!turns.length || turns[turns.length - 1].turn !== l.turn) turns.push({ turn: l.turn, head: '', lines: [] });
    const t = turns[turns.length - 1];
    if (l.kind === 'turn') t.head = l.text; else t.lines.push(cardLogText(l));
  }
  const list = turns.filter((t) => t.lines.length || t.head).reverse();
  return (
    <div data-card-log-sheet className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[80%] w-full max-w-md flex-col rounded-2xl border border-white/15 bg-slate-950 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-[15px] font-black text-amber-200">ターンの記録</div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto mh-scroll">
          {list.map((t) => (
            <div key={t.turn} data-card-log-turn={t.turn} className="rounded-xl border border-white/10 bg-white/5 p-2">
              <div data-card-fit className="text-[12px] font-black text-violet-200" style={JA_WRAP_STYLE}>{jaWrap(t.head || `ターン${t.turn}`)}</div>
              {t.lines.map((x, i) => <div key={i} data-card-fit className="text-[13px] font-bold leading-snug text-white" style={JA_WRAP_STYLE}>{jaWrap(x)}</div>)}
            </div>
          ))}
          {!list.length && <div className="text-[13px] font-bold text-slate-400">まだ記録がありません</div>}
        </div>
        <button type="button" onClick={onClose} className="mh-button mh-button-secondary mt-2 min-h-[44px] rounded-xl font-black">閉じる</button>
      </div>
    </div>
  );
};
// カードの画面の文の折り方。jaWrap(41)に任せたうえで、短いかぎかっこの言葉(「守らない」)と、道具が割ってしまう言葉(ひととおり)と、終わりの記号は折らない
// (320で「「守ら/ない」」「ひと/とおり」と折れた。QA 10・12)
// 「！w」「？♡」のような記号のかたまりは、手前の2字といっしょに包む(負けの結果で「！w」だけが次の行に落ちた。最後の見回り)
const CARD_KEEP_WORDS = /(「[^「」\s]{1,8}」|ひととおり[だ。]*|[^\s、。「」『』（）()]{2}[！？!?…‥〜～♡♪]+[wｗ笑]*|[^\s、。「」『』（）()]{2}[wｗ]+(?![A-Za-zＡ-Ｚａ-ｚ]))/;
const cardJaWrap = (text) => String(text ?? '').split(CARD_KEEP_WORDS).map((t, i) => (i % 2 === 1
  ? <span key={i} data-ja-keep style={{ whiteSpace: 'nowrap' }}>{t}</span>
  : <React.Fragment key={i}>{jaWrap(t)}</React.Fragment>));
// 場のモンスターの名前。「…」で切らずに収める(320で「メタル…」と切れていた。QA 8)。
// 字を少し小さく(10pxまで) → それでも入らなければ横をつめて1行に収める(2行にすると「ストライ/クリパー」と言葉の途中で割れる)
const CardMonName = ({ name, w }) => {
  const len = Math.max(1, String(name || '').length);
  const fs = Math.max(10, Math.min(12, Math.floor(w / len)));
  const k = Math.min(1, w / (len * fs));
  return <div data-card-mon-name className="whitespace-nowrap font-black leading-tight" style={{ fontSize: fs, transform: k < 1 ? `scaleX(${k})` : undefined, transformOrigin: 'left', width: k < 1 ? `${w / k}px` : undefined }}>{name}</div>;
};
// 捨て札の一覧の名前。「…」で切らない(「ライトニ…」と切れていた。QA 9)。言葉の切れ目がある名前(最後の/きらめき)はそこで折り、
// 切れ目の無いカタカナ1語(フレイムビーム)は、折ると「フレイムビ/ーム」になるので、カードの幅に合わせて字を小さくして1行に収める
const CardDiscardName = ({ name }) => {
  const one = !String(jaWrapPoints(name)).includes('\u200B');
  const len = Math.max(1, String(name).length);
  return (
    <span data-card-discard-name className="mt-0.5 w-full text-center font-bold leading-tight text-slate-200"
      style={one ? { fontSize: `min(10px, calc(100cqw / ${len + 0.5}))`, whiteSpace: 'nowrap' } : { fontSize: 10, ...JA_WRAP_STYLE }}>{one ? name : jaWrap(name)}</span>
  );
};
const CardMonSlot = ({ db, st, p, m, mark = null, fx = [], onTap, press, compact = false, tiny = false, wide = false, motion = null, calm = false, guardTag = '', onStatus = null, statusLock = false, onPressMon = null }) => {
  const mon = st.players[p].mons[m];
  const art = cardMonArt(mon);
  const ty = cardMonType(mon, st.turn);
  const opp = p === CARD_CPU;
  const pct = Math.max(0, Math.round((mon.life / mon.max) * 100));
  const stunned = mon.stunTurn === st.turn + (st.active === p ? 0 : 1) && !mon.ko;
  const pills = cardMonStatuses(st, p, m).filter((x) => x.pill);
  const pillMax = tiny ? 1 : 2; // 1行に収める(320×568 は1枚と「+◯」)
  const info = (
    <div className="flex items-center gap-1">
      {/* 倒れたら、倒れる動きのあとカードを裏返して暗くする(設計書 5-3)。小さい画面(tiny)はカードを小さく */}
      <span data-card-flip={mon.ko ? 'ko' : undefined} className={`relative block ${tiny ? 'h-[40px] w-[28px]' : 'h-[52px] w-[37px]'} shrink-0 ${mon.ko ? 'mh-card-flip' : ''}`}>
        <img src={CARD_IMG(cardMonsterOf(db, mon.no).img)} alt={mon.name} className={`mh-card-flip-face ${tiny ? 'h-[40px] w-[28px]' : 'h-[52px] w-[37px]'} rounded-[3px] object-cover shadow ${mon.ko ? 'grayscale opacity-40' : ''}`}/>
        {mon.ko && <span className="mh-card-flip-back" aria-hidden="true" style={{ backgroundImage: `url(${CARD_BACK_IMG()})`, backgroundSize: '100% 100%', border: 0 }}/>}
      </span>
      <div className={`${tiny ? 'w-[56px]' : 'w-[62px]'} min-w-0`}>
        <CardMonName name={mon.name} w={tiny ? 56 : 62}/>
        {/* 小さい画面(tiny)は、地上・空中の札をライフと同じ行へ(1行ぶん低くする) */}
        <div className="flex items-center gap-1 whitespace-nowrap text-[13px] font-black leading-tight">{mon.life}<span className="text-[10px] text-slate-400"> / {mon.max}</span>
          {tiny && <span className={`ml-auto rounded px-0.5 text-[9px] font-bold ${ty === 'air' ? 'bg-cyan-800' : ty === 'water' ? 'bg-blue-800' : 'bg-indigo-900'}`}>{CARD_TYPE_LABEL[ty]}</span>}</div>
        <div className="h-[6px] overflow-hidden rounded bg-slate-700"><div className={`h-full ${pct > 50 ? 'bg-emerald-400' : pct > 25 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }}/></div>
        {!tiny && <span className={`mt-0.5 inline-block rounded px-1 text-[10px] font-bold ${ty === 'air' ? 'bg-cyan-800' : ty === 'water' ? 'bg-blue-800' : 'bg-indigo-900'}`}>{CARD_TYPE_LABEL[ty]}</span>}
        {/* 「攻撃できない」は1行に収める(320で「攻撃でき/ない」と折れて場の背が伸び、下のボタンが画面の下で切れた。最後の見回り) */}
        {stunned && <span data-card-stunned className={`inline-block whitespace-nowrap rounded bg-rose-900 font-bold ${tiny ? 'px-0.5 text-[9px] leading-tight' : 'ml-0.5 px-1 text-[10px]'}`}>攻撃できない</span>}
      </div>
    </div>
  );
  // 動き(85-card-battle-motion.jsx): attack … SkillFxMotion で技の動き / hit 揺れ / dodge よける(残像) / jump 跳んでよける / guard 防ぐ(光の盾と数字) / KO は倒れたまま
  // 横画面(wide)は高さ390で上下2段を収めるので、絵をいちばん小さくする
  // 横画面は、まんなかが空いていたので、絵を大きくする(2026-10-27 ソランドくん「場のモンスターの絵と場のカードが小さい」)。
  //   高さは画面の高さから決める(40〜64px。844×390 で 64px・667×375 で 56px ほど。上下の帯とまんなかの 64px を引いた残りを2段で分ける)
  const wideArtH = 'clamp(40px, calc((var(--mh-vh, 100svh) - 262px) / 2), 64px)';
  const artSize = wide ? 'max-w-[88px]' : tiny ? 'max-h-[44px] max-w-[60px]' : compact ? 'max-h-[56px] max-w-[72px]' : 'max-h-[78px] max-w-[96px]';
  const imgEl = art
    ? <img src={art} alt="" style={wide ? { maxHeight: wideArtH } : undefined} className={`${artSize} object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,.6)] ${opp ? '-scale-x-100' : ''}`}/>
    : <img src={CARD_IMG(cardMonsterOf(db, mon.no).img)} alt="" className={`${tiny ? 'h-[42px]' : compact ? 'h-[54px]' : 'h-[74px]'} rounded-md object-cover`}/>;
  const mv = motion && !mon.ko ? motion : null;
  // calm … オプションの「画面の揺れ: 揺らさない」。受けたときは揺らさずに光るだけ
  const poseClass = mon.ko ? 'mh-card-ko' : mv && mv.type === 'hit' ? (calm ? 'mh-card-hit-calm' : 'mh-card-hit') : mv && mv.type === 'dodge' ? 'mh-card-dodge' : mv && mv.type === 'jump' ? 'mh-card-jump' : mv && mv.type === 'guard' ? 'mh-card-guard' : '';
  const artEl = (
    <div data-card-art={`${p}-${m}`} className={`relative flex ${wide ? '' : tiny ? 'h-[44px]' : compact ? 'h-[56px]' : 'h-[78px]'} w-full items-end justify-center`}
      style={{ ...(wide ? { height: wideArtH } : null), ...(mv && mv.type === 'attack' ? { '--atk-dx': `${mv.dx}px`, '--atk-dy': `${mv.dy}px`, zIndex: 40 } : null) }}>
      {mv && mv.type === 'attack' && mv.kind
        ? <SkillFxMotion key={mv.key} kind={mv.kind} image={imgEl}/>
        : <div key={mv ? mv.key : 'still'} data-card-pose={mon.ko ? 'ko' : mv ? mv.type : 'still'} className={`flex items-end justify-center ${poseClass}`}>{imgEl}</div>}
      {/* よけた: 元の場所に残像が残って消える / ジャンプでよけた: 上で止まって「空中」の印 */}
      {mv && mv.type === 'dodge' && <div key={`${mv.key}-a`} className="mh-card-afterimage" aria-hidden="true">{imgEl}</div>}
      {mv && mv.type === 'jump' && <span key={`${mv.key}-j`} data-card-air-mark className="mh-card-air-mark">空中</span>}
      {/* 当たった子は白く一瞬光る(2026-10-26 改良の案 B・カゲあつくん 7) */}
      {mv && mv.type === 'hit' && <span key={`${mv.key}-f`} data-card-hit-flash className="mh-card-hit-flash" aria-hidden="true"/>}
      {mv && mv.type === 'guard' && <span key={`${mv.key}-s`} className="mh-card-shield" aria-hidden="true"/>}
      {mv && mv.type === 'guard' && mv.label && <span key={`${mv.key}-n`} data-card-guard-num className="mh-card-guard-num">{mv.label}</span>}
      {/* 守りの番のあいだ、守った子の上に使った守りを出しておく(すぐ消えて使ったか分からなかった。2026-10-27 社長・案A) */}
      {guardTag && <span data-card-guard-tag className={`pointer-events-none absolute left-1/2 top-0 z-[45] -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black shadow ${/回避/.test(guardTag) ? 'bg-sky-300 text-slate-950 shadow-[0_0_12px_rgba(125,211,252,.8)]' : 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,.8)]'}`}>{/回避/.test(guardTag) ? '💨' : '🛡'} {guardTag}</span>}
      {mon.ko && <span className="absolute bottom-2 rounded bg-black/70 px-1.5 text-[12px] font-black text-slate-300">KO</span>}
      {fx.map((f) => (
        <span key={f.key} data-card-dmg-num={f.dmg > 0 ? f.dmg : undefined} className={`pointer-events-none absolute top-0 z-[50] font-black ${f.dmg > 0 ? `mh-card-dmg-pop ${tiny ? 'text-[34px]' : 'text-[42px]'} leading-none text-rose-500` : 'text-[30px] text-sky-200'}`} style={{ WebkitTextStroke: f.dmg > 0 ? '2px #fff' : '1px #0369a1', textShadow: f.dmg > 0 ? '0 4px 0 #7f1d1d, 0 0 18px rgba(239,68,68,.8)' : '0 0 10px rgba(248,113,113,.8)' }}>
          {f.dmg > 0 ? `−${f.dmg}` : f.heal ? `＋${f.heal}` : 'ミス'}
        </span>
      ))}
      {fx.map((f) => <CardHitResult key={`${f.key}-r`} f={f} tiny={tiny}/>)}
      {/* かかっている効果の札(案A)。絵の、名前側のふちに重ねる(枠の背を変えない。相手=上・自分=下)。入り切らない分は「+2」 */}
      {pills.length > 0 && (
        <div data-card-status={`${p}-${m}`} className={`absolute inset-x-0 ${opp ? 'top-0' : 'bottom-0'} z-[30] flex items-center justify-center gap-0.5 ${statusLock ? 'pointer-events-none' : ''}`}>
          {pills.slice(0, pillMax).map((x) => <span key={x.key} data-card-status-pill={x.key} className={`pointer-events-none whitespace-nowrap rounded-full px-1 text-[9px] font-black leading-[14px] shadow ${CARD_STATUS_TONE[x.tone] || CARD_STATUS_TONE.down}`}>{x.short}{x.left ? ` ${x.left}` : ''}</span>)}
          {pills.length > pillMax && (onStatus && !statusLock
            ? <button type="button" data-card-status-more onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onStatus(p, m); }} className="whitespace-nowrap rounded-full bg-slate-950/90 px-1.5 text-[9px] font-black leading-[14px] text-white ring-1 ring-white/50">+{pills.length - pillMax}</button>
            : <span data-card-status-more className="pointer-events-none whitespace-nowrap rounded-full bg-slate-950/90 px-1.5 text-[9px] font-black leading-[14px] text-white ring-1 ring-white/50">+{pills.length - pillMax}</span>)}
        </div>
      )}
    </div>
  );
  const ring = mark === 'drop' ? 'ring-4 ring-emerald-300 bg-emerald-400/15' : mark === 'target' ? 'ring-4 ring-rose-400' : mark === 'user' ? 'ring-4 ring-amber-300' : mark === 'acting' ? 'ring-2 ring-amber-300/80' : '';
  return (
    <div data-card-mon={`${p}-${m}`} {...(press ? (() => { const h = press(mon.no, onTap); return onPressMon ? { ...h, onPointerDown: (e) => { onPressMon(p, m); h.onPointerDown(e); } } : h; })() : { onClick: onTap })} className={`relative flex w-[31%] flex-col items-center rounded-xl p-0.5 ${ring}`} style={motion && motion.type === 'attack' ? { zIndex: 40 } : undefined}>
      {opp ? <>{info}{artEl}</> : <>{artEl}{info}</>}
    </div>
  );
};

// ---- ガッツの山へ飛ぶカード(1回ぶん)。g … { p, to(ガッツの札の位置), n(枚数), items[{ from, img(表の絵 か null=裏), delay }] } ----
//   still … 技の動き「出さない」のときは、飛ばさずに「+n」だけ出す
const CardGutsFlight = ({ g, still = false }) => {
  const [go, setGo] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true))); return () => cancelAnimationFrame(r); }, []);
  const w = 30, h = 42;
  const tx = g.to.x + g.to.w / 2 - w / 2, ty = g.to.y + g.to.h / 2 - h / 2;
  return (
    <>
      {!still && g.items.map((it, k) => {
        const fx = it.from.x + it.from.w / 2 - w / 2, fy = it.from.y + it.from.h / 2 - h / 2;
        return (
          <span key={k} data-card-guts-fly={g.p} className="absolute left-0 top-0 block overflow-hidden rounded-[4px] border border-amber-200/80 shadow-[0_4px_10px_rgba(0,0,0,.6)]"
            style={{ width: w, height: h, transform: `translate(${go ? tx : fx}px, ${go ? ty : fy}px) scale(${go ? 0.55 : 1})`, opacity: go ? 0.2 : 1,
              transition: `transform 480ms cubic-bezier(.5,0,.75,.4) ${it.delay}ms, opacity 480ms ease-in ${it.delay}ms`,
            }}>
            {/* 自分の手札は表の絵、相手の手札と山札の上は裏面の絵 */}
            <img src={it.img || CARD_BACK_IMG()} alt="" className="h-full w-full object-cover"/>
          </span>
        );
      })}
      <span data-card-guts-plus={g.p} className="absolute rounded-full bg-amber-400 px-1.5 py-0.5 text-[12px] font-black text-slate-950 shadow-lg"
        style={{ left: g.to.x + g.to.w - 6, top: g.to.y - 14, opacity: go ? 1 : 0, transition: `opacity 200ms ease-out ${still ? 0 : 420 + 90 * (g.n - 1)}ms` }}>+{g.n}</span>
    </>
  );
};

// ---- 対戦の盤面 ----
// onProgress … 場が進むたびに呼ぶ(途中で閉じた対戦の印を書き直す。84 の CardBattleScreen の cpuOpenProgress)
// onActLog … 当てた手を (決めた人, 手) で知らせる(助手と対戦のリプレイの記録。93-card-replay.jsx)
const CardBattleBoard = ({ db, game, onFinish, onProgress = null, quickRun = null, meProfile = null, meIcon = null, onActLog = null }) => {
  // 演出の設定(オプション)。はやい … 相手が考える時間と、決着から結果までを短くする
  const settings = normalizeCardSettings(game.settings);
  // 対戦中の設定(オプション・社長 2026-10-25)。既定はどれも足す前の動きと同じ。練習試合は game.settings を持たないので既定のまま
  const pace = CARD_THINK_PACE[settings.think] || 1;
  const pressMs = CARD_PRESS_MS[settings.press] || 450;
  // 確かめの窓は、人が遊んでいるときだけ。練習試合・動きの見本・マルチの検査の自動操作(window.__mhCardPvpAuto)では出さない(ブレイブくんとの決め)
  const confirmOn = (key) => settings[key] === 'ON' && !game.tutorial && !game.demo && !(typeof window !== 'undefined' && window.__mhCardPvpAuto);
  // マルチ対戦(91-card-battle-multi.jsx)では、相手は助手ではなくブリーダー。名前とアイコンだけを出す
  // 過去の対戦を見る(93-card-replay.jsx): game.replay … { states:[1手ごとの場], stop, turns, foe, kind }。手は受け付けず、場を差し替えて見せるだけ
  //   マルチの試合は、相手の名前とアイコンの出し方だけマルチと同じにする(通信・持ち時間・自動の手は pvpLive で止める)
  const replay = game.replay || null;
  // マルチ対戦の観戦(94-card-spectate.jsx): game.watch … { top:{ name, icon, frame }(上の人), bottom:{ name }(下の人), attach(受け口) → はずす関数 }。
  //   手は受け付けず、届いた「当てたあとの場」を、マルチの相手の手と同じ道(step)で見せる。2人とも手札は裏。決着しても結果の画面へは進まない
  const watch = game.watch || null;
  const pvp = game.pvp || (replay && replay.kind === 'pvp' ? replay.foe : null) || (watch ? watch.top : null);
  const pvpLive = pvp && !replay && !watch;
  // 下の人の呼び名(ふだんは「あなた」。観戦では下の人の名前)
  const meName = watch ? watch.bottom.name : 'あなた';
  const [watchEnd, setWatchEnd] = useState(null); // 観戦: 届いた決着の言葉 { winner(0=下・1=上・null), head, sub }
  const [watchEyes, setWatchEyes] = useState(0);   // 観戦: いま見ている人の数
  const [watchEndHide, setWatchEndHide] = useState(false); // 観戦: 決着の帯を閉じて盤面を見る
  const [replayAt, setReplayAt] = useState(0);
  const who = pvp ? { id: 'pvp', name: pvp.name, accent: '#38bdf8' } : (ASSISTANTS.find((a) => a.id === game.who) || ASSISTANTS[0]);
  const policy = useMemo(() => cardAiPolicy(game.who, game.level, { sameBlood: !!game.cpuSameBlood }), [game.who, game.level, game.cpuSameBlood]);
  const [st, setSt] = useState(game.st);
  useEffect(() => { if (onProgress) onProgress(st); }, [st]);
  const [sel, setSel] = useState(null);      // 攻撃: { hand, mon, set } / 守り: { hand }
  const [picks, setPicks] = useState([]);    // ガッツへ・捨てる・始める前のガッツで選んだ手札
  const [fx, setFx] = useState([]);          // ダメージの数字
  const [bubble, setBubble] = useState(null);
  const [face, setFace] = useState('normal');
  const [detail, setDetail] = useState(null);
  const [statusSheet, setStatusSheet] = useState(null); // 「+2」を押して開いた効果の窓 { p, m }
  const monPressed = useRef(null); // いちばん最後に押した場の子(長押しの詳しい画面に、その子の効果を並べる)
  const [discard, setDiscard] = useState(null);
  const [hint, setHint] = useState('');
  const [quit, setQuit] = useState(false);
  const [action, setAction] = useState(null);   // まんなかに出す、いま使った技
  // 相手のターンを分かりやすく(2026-10-25 社長「ターン毎に何をしたかわかりにくい。特に相手」→ 案A・B・C を全部)
  //   A … 番が替わるときの帯 turnBanner { key, me } / 技の帯の「相手/自分」の札(action.side)
  //   B … 相手が出すカードを、効果の前にまんなかに大きく見せる bigCard { key, cards, who }
  //   C … 自分の番の始めに「相手のターンにしたこと」 turnSummary { key, turn, lines } と、ターンごとの記録 logSheet
  const [turnBanner, setTurnBanner] = useState(null);
  const [bigCard, setBigCard] = useState(null);
  const [turnSummary, setTurnSummary] = useState(null);
  // まとめは、まず小さな1行(まんなかの下)で知らせ、押したら開く(毎回まんなかに大きく開くと、相手のライフに重なってテンポも落ちた。2026-10-26 カゲあつくんの通しの点検)
  const [sumOpen, setSumOpen] = useState(false);
  useEffect(() => { setSumOpen(false); }, [turnSummary && turnSummary.key]);
  const [logSheet, setLogSheet] = useState(false);
  const [downBand, setDownBand] = useState(null); // 倒れたときの「◯◯ ダウン！ / 残り◯体」の帯 { key, p, names, left }(改良の案 B)
  const [breederFx, setBreederFx] = useState(null); // ブリーダーのカードを使ったとき、まんなかの端に出す顔 { p, key }
  const [beams, setBeams] = useState([]);
  const lastGuard = useRef({}); // 'p-m' → 守りのカードを出したときの控え { jump, label, at }           // はね返したときの光線 [{ key, x, y, len, deg }](画面の位置)
  const [drag, setDrag] = useState(null);       // 運んでいる手札 { i, no, x, y, active }
  const [dropOver, setDropOver] = useState(null); // 指の下の置ける所('p-m' か 'guts')
  const dragRef = useRef(null);
  useEffect(() => () => { if (dragRef.current) clearTimeout(dragRef.current.timer); }, []);   // 指を置いたまま画面を離れたら、長押しも止める
  const ghostRef = useRef(null);
  // 練習試合(チュートリアル・86-card-tutorial.jsx)。tutI … いまの段 / tutQ … これから出す台詞 / tutSay … ドラの説明の窓に出している台詞
  const tutorial = game.tutorial === true;
  const [tutI, setTutI] = useState(0);
  const [tutQ, setTutQ] = useState(() => (tutorial ? CARD_TUTORIAL_STAGES[0].lines.slice() : []));
  const [tutSay, setTutSay] = useState(null);
  const tutWrong = useRef(0);
  const tutStage = tutorial ? CARD_TUTORIAL_STAGES[Math.min(tutI, CARD_TUTORIAL_STAGES.length - 1)] : null;
  const [motions, setMotions] = useState({});   // 場の子の動き { 'p-m': { type, kind, dx, dy, key } }
  const motionTimers = useRef([]);
  const actionMissed = useRef(null); // 吹き出しで隠れたまま消えた技の札(下の bubbleOverAction のところで出し直す)
  useEffect(() => () => motionTimers.current.forEach(clearTimeout), []);
  const playMotion = (id, mv, ms) => {
    setMotions((cur) => ({ ...cur, [id]: mv }));
    motionTimers.current.push(setTimeout(() => setMotions((cur) => (cur[id] && cur[id].key === mv.key ? (({ [id]: _, ...rest }) => rest)(cur) : cur)), ms));
  };
  // 背の低い画面(iPhone SE など)では、絵と手札を少し小さくして、まんなかの場所を残す
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerHeight < 760);
  // もっと小さい画面(幅 360 未満の 320 幅・高さ 620 未満)。名前と札を1行に縮め、絵と手札の字も小さくする(2026-10-24 改善部の点検 V1)
  //   練習試合は、ドラの説明の窓が手札の上に場所を取るので、背の低い画面(compact)のときも小さい段にする(SE で「守らない」が下に押し出された)
  const [tinyScreen, setTiny] = useState(() => typeof window !== 'undefined' && (window.innerWidth < 360 || window.innerHeight < 620));
  const tiny = tinyScreen || (compact && !!tutorial);
  useEffect(() => { const on = () => { setCompact(window.innerHeight < 760); setTiny(window.innerWidth < 360 || window.innerHeight < 620); }; window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  // 横画面か(④)。盤の箱の縦横で見る(端末が縦のまま絵を回して横に見せているときも、箱は横長になる)
  const boardRef = useRef(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const on = () => setWide(el.clientWidth > el.clientHeight * 1.3);
    on();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(on) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', on);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', on); };
  }, []);
  const lastLine = useRef({});
  const spoke = useRef({ turn: -1, n: 0 });
  // 助手の吹き出し(2026-10-27 社長「助手のコメント見たいのにすぐ流れる。とくに開始のとき」):
  //   ・出しておく時間は字の数で決める(1字 0.15秒+1.8秒。最低 3秒・最大 7秒。日本語を読む速さの目安 1秒に7字ほどに、目を移す間を足した)
  //   ・出ているあいだに次の台詞が来たら、押しのけずに順番待ち(3つまで。あふれたら古い待ちから捨てる)
  //   ・技や守りが出ても消さない。カードの大写しのあいだは見えないので、時間を止める
  //   ・押すと次の台詞へ(無ければ消える)。遊ぶ人の操作は止めない
  const bubbleRef = useRef(null);
  // 自分が守りを選んでいるあいだは、吹き出しを出さない(時間も止める。上の札・まんなかの攻撃カードと重なった。2026-10-27 カゲあつくん)
  const guarding = !!(st.pending && st.pending.defender === CARD_ME && !tutorial);
  const bubbleQ = useRef([]);
  const bubbleLeft = useRef({});   // 大写しで止めたときの残り時間 { key: ms }
  const showBubble = (b) => {
    if (bubbleRef.current) { bubbleQ.current = [...bubbleQ.current, b].slice(-3); return; }
    bubbleRef.current = b; if (b.face) setFace(b.face); setBubble(b);
  };
  const nextBubble = () => {
    const b = bubbleQ.current.shift() || null;
    bubbleRef.current = b; if (b && b.face) setFace(b.face); setBubble(b);
  };
  const finished = useRef(false);
  // 助手のおしゃべり(AI・83-card-battle-talk-ai.jsx): この試合で山場を聞いた回数と、それぞれの側がリードされたことがあるか(逆転の判定)
  const talk = useRef({ n: 0, behind: [false, false] });
  const press = useCardLongPress((no) => setDetail(no), pressMs);
  const paused = !!detail || !!discard || quit;

  // ai … 山場なら { scene(AIに伝える場面), next(操作のあとの状態) }。決まった台詞を出したまま、間に合ったときだけAIのひとことに差しかえる
  const say = (scene, ai = null) => {
    if (!scene || pvp || settings.bubble === 'OFF') return;
    const turn = st.turn;
    if (spoke.current.turn !== turn) spoke.current = { turn, n: 0 };
    if (spoke.current.n >= (CARD_BUBBLE_PER_TURN[settings.bubble] ?? CARD_LINE_PER_TURN) && scene !== 'win' && scene !== 'lose') return;
    const line = cardPickLine(game.who, scene, lastLine.current);
    if (!line) return;
    spoke.current.n += 1;
    lastLine.current = { ...lastLine.current, [scene]: line.index };
    setFace(line.face);
    const key = `${Date.now()}-${scene}`;
    const cut = !game.demo && (CARD_CUTIN_SCENES.includes(scene) || !!(ai && /^comeback/.test(ai.scene || '')));
    showBubble({ text: line.text, key, face: line.face, cut });
    if (ai && !game.demo && !tutorial && CARD_TALK_MOMENTS.includes(ai.scene) && talk.current.n < CARD_TALK_MOMENT_PER_GAME && cardAiTalkOn()) {
      talk.current.n += 1;
      void cardTalkFetch('moment', { who: game.who, facts: cardTalkMomentFacts(db, ai.next, CARD_CPU, ai.scene), samples: cardTalkSamples(game.who, scene) }).then((r) => {
        if (!r) return;
        // 出ている台詞ならその場で、待っている台詞なら待ちの中で差しかえる
        bubbleQ.current = bubbleQ.current.map((b) => (b.key === key ? { ...b, text: r.text, face: r.face } : b));
        if (bubbleRef.current && bubbleRef.current.key === key) { bubbleRef.current = { ...bubbleRef.current, text: r.text, face: r.face }; setBubble(bubbleRef.current); setFace(r.face); }
      });
    }
  };
  useEffect(() => { if (!tutorial) say('start'); }, []);
  // 出しておく時間。大写しのカード・番の札が出ているあいだは止め、消えたら残りから数え直す。練習試合はみゅあの台詞の流れ(下)が決める
  useEffect(() => {
    // ダウンの帯のあいだも隠れて読めないので止める(倒れた瞬間の台詞が帯の下で約1秒減っていた。2026-10-27 フキダシくん)
    if (!bubble || tutorial || bigCard || turnBanner || downBand || guarding) return undefined;   // 番の札のあいだも見えないので止める(ブレイブくんの #番の札)
    const key = bubble.key;
    const ms = bubbleLeft.current[key] ?? cardBubbleMs(bubble.text);
    const at = Date.now();
    const t = setTimeout(nextBubble, ms);
    return () => { clearTimeout(t); bubbleLeft.current = { [key]: Math.max(800, ms - (Date.now() - at)) }; };
  }, [bubble && bubble.key, !!bigCard, !!turnBanner, !!downBand, guarding]);
  // 練習試合: 段が変わったら、その段の台詞を出す。みゅあの台詞は吹き出しに出して、少ししたら次へ。ドラの台詞は説明の窓に出す
  useEffect(() => { if (tutorial && tutStage) setTutQ(tutStage.lines.slice()); }, [tutI]);
  useEffect(() => {
    if (!tutorial || !tutQ.length) return undefined;
    const head = tutQ[0];
    if (head[0] === 'M') {
      const tf = CARD_TUTORIAL_FACE[head] || 'happy';
      setFace(tf);
      setBubble({ text: CARD_TUTORIAL_LINES[head], key: `t-${head}-${Date.now()}`, face: tf });
      const t = setTimeout(() => { setBubble(null); setTutQ((q) => q.slice(1)); }, 2100);
      return () => clearTimeout(t);
    }
    setTutSay(head);
    return undefined;
  }, [tutQ]);

  // 操作を1つ進める(だめな操作は何もしない)
  const tutAllow = (act) => !tutorial || (!tutStage.next && tutQ.length <= 1 && (!tutQ.length || tutQ[0][0] === 'D') && cardTutorialAllow(db, tutStage.id, st, act));
  const tutWrongSay = () => { const id = CARD_TUTORIAL_WRONG[tutWrong.current % CARD_TUTORIAL_WRONG.length]; tutWrong.current += 1; setHint(CARD_TUTORIAL_LINES[id]); };
  // forced … マルチ対戦で、届いた相手の手をこちらで当てた次の場(91 の cardPvpApplyRemote)。動きと音は同じように出す
  // 行動の前のカード大写し(2026-10-26 社長「敵も味方も、まずそのカードを真ん中に大きく出して、それから行動の演出」)。
  //   1枚 0.7秒ほど(「短め」0.5秒・考える時間の速さで少し伸び縮み)・タップで先へ。技の動き「出さない」なら出さない
  //   then … 大写しが消えたら行う手(助手と対戦の自分の手・相手の手)。マルチは試合を待たせないので then を持たず、効き目と同時に出す
  const bigTimer = useRef(null);
  const bigThen = useRef(null);
  useEffect(() => () => { clearTimeout(bigTimer.current); bigThen.current = null; }, []);   // 画面を離れたら、消えたあとの1手(bigThen)も打たない
  const bigMs = settings.motion === 'OFF' ? 0 : Math.round((settings.motion === 'SHORT' ? 500 : 700) * Math.min(1.2, Math.max(0.6, pace)));
  const finishBig = () => {
    clearTimeout(bigTimer.current);
    setBigCard(null);
    const f = bigThen.current; bigThen.current = null;
    if (f) f();
  };
  const showBigCard = (cards, by, ms = bigMs, side = 'foe', then = null) => {
    const key = `big-${Date.now()}`;
    clearTimeout(bigTimer.current);
    bigThen.current = then;
    setBigCard({ key, cards: cards.slice(0, 3), who: by, side });
    bigTimer.current = setTimeout(() => { setBigCard((cur) => (cur && cur.key === key ? null : cur)); const f = bigThen.current; bigThen.current = null; if (f) f(); }, ms);
  };
  // その手で出すカード(技・ブリーダー・全体カードは hand の並び、守りは1枚、おいのりは hand の並び)
  const cardsOfAct = (s0, p, act) => {
    const hand = s0.players[p].hand;
    if (!act) return [];
    if (act.type === 'guard') return Number.isInteger(act.hand) && hand[act.hand] ? [hand[act.hand]] : [];
    if (['attack', 'breeder', 'pray'].includes(act.type) && Array.isArray(act.hand)) return act.hand.map((i) => hand[i]).filter((no) => no && no !== CARD_PVP_HIDDEN);
    return [];
  };
  // ガッツになったカードが、手札(か山札の上)からガッツの山へ飛ぶ動き(2026-10-26 社長「何枚ガッツへ行ったか見えるように」)。表示だけで、試合は待たせない
  const [gutsFly, setGutsFly] = useState([]);
  const flyGuts = (s0, s1, act) => {
    const rectOf = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
    const out = [];
    [CARD_ME, CARD_CPU].forEach((p) => {
      const d = s1.players[p].guts.length - s0.players[p].guts.length;
      if (d <= 0) return;
      const to = rectOf(`[data-card-guts-of="${p}"]`);
      if (!to) return;
      const fromHand = s0.players[p].hand.length - s1.players[p].hand.length >= d && act && ['guts', 'setupGuts'].includes(act.type);
      const items = [];
      for (let k = 0; k < d; k++) {
        const idx = fromHand && Array.isArray(act.hand) ? act.hand[k] : -1;
        const from = (p === CARD_ME && fromHand && rectOf(`[data-card-hand-card="${idx}"]`)) || rectOf(fromHand ? `[data-card-hand-of="${p}"]` : `[data-card-deck-of="${p}"]`) || to;
        // 自分の手札は表のまま(絵)、相手の手札と山札の上は裏のまま
        const no = p === CARD_ME && fromHand && idx >= 0 ? s0.players[p].hand[idx] : null;
        items.push({ from, img: no && cardOf(db, no) ? CARD_IMG(cardOf(db, no).img) : null, delay: k * 90 });
      }
      out.push({ key: `gf-${p}-${s1.log.length}-${Date.now()}`, p, to, n: d, items });
    });
    if (!out.length) return;
    setGutsFly((cur) => [...cur, ...out]);
    const life = 650 + 90 * Math.max(...out.map((o) => o.n)) + 500;
    motionTimers.current.push(setTimeout(() => setGutsFly((cur) => cur.filter((g) => !out.some((o) => o.key === g.key))), life));
  };
  const step = (act, forced = null, shown = false) => {
    if (!forced && tutorial && cardDeciderOf(st) === CARD_ME && !tutAllow(act)) { tutWrongSay(); return false; }
    // 助手と対戦の自分の手: 先にカードを大きく出して、消えたら当てる(当てられる手かは先に確かめる。練習試合・見本は出さない)
    if (!forced && !shown && !pvp && !tutorial && !game.demo && bigMs > 0 && cardDeciderOf(st) === CARD_ME) {
      const cards = cardsOfAct(st, CARD_ME, act);
      if (cards.length && cardApplyAction(db, st, act)) { showBigCard(cards, 'あなた', bigMs, 'me', () => step(act, null, true)); return true; }
    }
    const next = forced || cardApplyAction(db, st, act);
    if (!next) return false;
    if (onActLog && !forced && !replay) onActLog(cardDeciderOf(st), act);
    if (pvpLive && !forced) CARD_PVP.local(st, act, next);
    flyGuts(st, next, act);
    // マルチ: 自分の手も相手の手も、効き目と同時に大きく出す(待たせない)
    if (pvp && bigMs > 0) {
      // 観戦は、2人の手がどちらも届く(forced)。出した人はその手の前の場で決める
      const p0 = watch ? cardDeciderOf(st) : forced ? CARD_CPU : CARD_ME;
      const shownCards = forced ? (next.events || []).filter((e) => (e.t === 'use' || e.t === 'guard') && e.p === p0).flatMap((e) => (e.t === 'use' ? e.cards : [e.card])) : cardsOfAct(st, CARD_ME, act);
      if (shownCards.length) showBigCard(shownCards, p0 === CARD_ME ? meName : who.name, bigMs, p0 === CARD_ME ? 'me' : 'foe');
    }
    stRef.current = next;
    const evs = next.events || [];
    // 技や守りが出ても、吹き出しは消さない(読む前に流れた。2026-10-27 社長)。時間と順番は showBubble が決める
    const hits = evs.filter((e) => e.t === 'hit' || e.t === 'heal').map((e, i) => ({ ...e, key: `${next.log.length}-${i}-${Date.now()}`, heal: e.t === 'heal' ? e.n : 0, dmg: e.t === 'hit' ? e.dmg : 0 }));
    if (hits.length) {
      if (settings.damageNum !== 'OFF') setFx(hits); // ダメージの数字(オプション)。出さなくても音とライフは今までどおり
      motionTimers.current.push(setTimeout(() => setFx((cur) => cur.filter((f) => !hits.some((h) => h.key === f.key))), hits.some((h) => cardHitResultOf(h) && cardHitResultOf(h).kind !== 'none') ? 1600 : 1000)); // 「防御！ 5 → 2」は読めるように長く
      if (hits.some((h) => h.dmg >= 3)) Audio_.fgSe.crit(); else if (hits.some((h) => h.dmg > 0)) Audio_.fgSe.attack(); else if (hits.some((h) => h.heal)) Audio_.fgSe.heal(); else Audio_.fgSe.guard();
    } else if (evs.some((e) => e.t === 'use')) Audio_.fgSe.card();
    // 倒れた子がいたら、まんなかに赤い帯「◯◯ ダウン！ / 残り◯体」(1秒ほど・タップで消える)。決着した時は勝ち負けの演出に任せる。練習試合はドラの窓と重ねない
    const kos = evs.filter((e) => e.t === 'ko');
    if (kos.length && next.winner === null && !tutorial) {
      const p0 = kos[0].p;
      const key = `down-${next.log.length}-${Date.now()}`;
      setDownBand({ key, p: p0, names: kos.filter((e) => e.p === p0).map((e) => next.players[p0].mons[e.m].name), left: next.players[p0].mons.filter((x) => !x.ko).length });
      motionTimers.current.push(setTimeout(() => setDownBand((cur) => (cur && cur.key === key ? null : cur)), Math.max(700, Math.round(1100 * pace))));
    }
    // 技の動き: 攻撃した子が狙った子へ向かって動く(位置は画面で測る。全員に当たる技は相手の真ん中へ)
    const centerOf = (id) => { const el = document.querySelector(`[data-card-art="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    // 技の動き(オプション): ふつう … 全部 / 短め … 攻める側の動きを省く / 出さない … 動きを出さない。
    // ★動きの完了は待たない(マルチで相手の手が続けて届いても、届いた順にそのまま当てる。ブレイブくんとの決め)
    const motionOn = settings.motion !== 'OFF';
    evs.filter((e) => e.t === 'use' && e.mon >= 0 && settings.motion === 'FULL').forEach((e, n) => {
      const mon = next.players[e.p].mons[e.mon];
      const kind = cardMotionKindOf(db, e.cards[0], mon);
      if (!kind) return;
      const from = centerOf(`${e.p}-${e.mon}`);
      // 相手を狙わない特殊技(自分や味方にかけるもの)は、その場で光る
      const c0 = cardOf(db, e.cards[0]);
      const inPlace = !!c0 && c0.kind === 'spe' && (!e.target || e.target.p === e.p);
      const to = inPlace ? from : e.target ? centerOf(`${e.target.p}-${e.target.m}`) : centerOf(`${1 - e.p}-1`);
      if (!from || !to) return;
      const key = `${next.log.length}-${n}-${Date.now()}`;
      playMotion(`${e.p}-${e.mon}`, { type: 'attack', kind, dx: Math.round(to.x - from.x), dy: Math.round(to.y - from.y), key }, cardMotionMs(kind) + 80);
    });
    // ブリーダーのカード: モンスターは動かさず、まんなかの端に使った側の助手・ブリーダーの顔を出す(設計書 5-4)
    const breederUse = motionOn && evs.find((e) => e.t === 'use' && cardIsBreederCard(db, e.cards[0]));
    if (breederUse) {
      const key = `b${next.log.length}-${Date.now()}`;
      setBreederFx({ p: breederUse.p, key });
      motionTimers.current.push(setTimeout(() => setBreederFx((cur) => (cur && cur.key === key ? null : cur)), 1700));
    }
    // はね返した: 防いだ子から攻撃した子へ光線(少し遅らせて、盾のあとに出す)
    const back = motionOn && evs.find((e) => e.t === 'hit' && e.reflect);
    const shield = back && evs.find((e) => e.t === 'hit' && !e.reflect && e.guarded);
    if (back && shield) {
      const a = centerOf(`${shield.p}-${shield.m}`); const b = centerOf(`${back.p}-${back.m}`);
      if (a && b) {
        const key = `r${next.log.length}-${Date.now()}`;
        const beam = { key, x: a.x, y: a.y, len: Math.round(Math.hypot(b.x - a.x, b.y - a.y)), deg: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
        motionTimers.current.push(setTimeout(() => setBeams((cur) => [...cur, beam]), 260));
        motionTimers.current.push(setTimeout(() => setBeams((cur) => cur.filter((x) => x.key !== key)), 1100));
      }
    }
    // 受ける・よける・防ぐ
    // ★守りのカードを出した手と、当たりが決まる手は別のことがある。よけ方(ジャンプ)・盾の数字は、守りのカードを出したときの控えから引く
    evs.filter((e) => e.t === 'guard').forEach((e) => { const c = cardOf(db, e.card); lastGuard.current[`${e.p}-${e.mon}`] = { jump: cardDodgeIsJump(c), label: c && c.kind !== 'dge' ? cardGuardLabel(c) : '', at: Date.now() }; });
    evs.filter((e) => e.t === 'hit').forEach((e, n) => {
      let type = e.evaded && !e.dmg ? 'dodge' : e.guarded && !e.dmg ? 'guard' : e.dmg > 0 ? 'hit' : (e.evaded ? 'dodge' : null);
      const g = lastGuard.current[`${e.p}-${e.m}`];
      const recent = g && Date.now() - g.at < 20000;
      if (type === 'dodge' && recent && g.jump) type = 'jump';
      if (type && motionOn) playMotion(`${e.p}-${e.m}`, { type, label: type === 'guard' && recent ? g.label : '', key: `h${next.log.length}-${n}-${Date.now()}` }, type === 'jump' ? 920 : 720);
    });
    evs.filter((e) => e.t === 'guard').forEach((e, n) => {
      const c = cardOf(db, e.card);
      const type = c && c.kind === 'dge' ? (cardDodgeIsJump(c) ? 'jump' : 'dodge') : 'guard';
      if (motionOn) playMotion(`${e.p}-${e.mon}`, { type, label: type === 'guard' ? cardGuardLabel(c) : '', key: `g${next.log.length}-${n}-${Date.now()}` }, type === 'jump' ? 920 : 720);
    });
    const use = evs.find((e) => e.t === 'use');
    if (use) {
      const key = `${next.log.length}-${Date.now()}`;
      const ul = cardUseWho(db, next, use.p, use.mon, use.cards[0]); // 書き方は記録と同じ(82 の cardUseText)
      setAction({ key, cards: use.cards, who: ul.by ? `${ul.who}(${ul.by}で)` : ul.who, side: use.p === CARD_ME ? 'me' : 'foe' });
      // 相手の技の札は、次の技か番の替わり目まで残す(すぐ消えて効果が分からなかった。2026-10-27 社長・案A)。自分の技は2.2秒
      if (use.p === CARD_ME) motionTimers.current.push(setTimeout(() => setAction((cur) => (cur && cur.key === key ? null : cur)), 2200));
    }
    else if (evs.some((e) => e.t === 'guard')) Audio_.fgSe.guard();
    if (tutorial && cardTutorialDone(tutStage.id, st, next)) setTutI((i) => i + 1);
    const scene = tutorial ? null : cardLineSceneOf(db, st, next, CARD_CPU);
    // 逆転(リードの向きが変わった)は、AIに伝える場面だけを替える(決まった台詞はいまの場面のまま)
    const flip = tutorial ? null : cardTalkComebackScene(st, next, CARD_CPU);
    [0, 1].forEach((p) => { if (cardTalkLead(next, p) < 0) talk.current.behind[p] = true; });
    setSt(next); setSel(null); setPicks([]); setHint('');
    // 決着した手では、場面の台詞(「あと1体」など)を出さない。勝ち負けの演出と結果の台詞に任せる(勝ったのに「あと1体」と出た。2026-10-27 ソランドくん)
    if (scene && next.winner === null) say(scene, { scene: flip || scene, next });
    return true;
  };

  // コンピューターの番(守りの番・始める前・捨てる番も)。詳しい画面や捨て札を見ているあいだは待つ
  useEffect(() => {
    if (st.winner !== null || paused || game.demo || pvp || replay) return undefined;
    if (tutorial && !cardTutorialCpu(db, tutStage.id, st)) return undefined;
    if (cardDeciderOf(st) !== CARD_CPU) return undefined;
    const wait = Math.round((st.pending ? 950 : st.phase === 'guts' ? 600 : 900) * pace); // 守りの番は、技の動きを見せ切ってから
    const t = setTimeout(() => {
      const act = tutorial ? cardTutorialCpu(db, tutStage.id, st) : cardAiChooseAction(db, st, policy);
      if (!act) return; // 練習試合のみゅあは、段が来るまで待つ
      const go = () => { if (!step(act)) step(st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] }); };
      // 案B: 技・守り・ブリーダー・全体カード・おいのりは、効果の前にまんなかに大きく見せる(練習試合では出さない)。消えたら(タップでも)当てる
      const shown = !tutorial && bigMs > 0 ? cardsOfAct(st, CARD_CPU, act) : [];
      if (!shown.length) { go(); return; }
      showBigCard(shown, who.name, bigMs, 'foe', go);
    }, wait);
    return () => { clearTimeout(t); };
  }, [st, paused, tutI]);

  // 案A: 番が替わったら、まんなかに「◯◯のターン」の帯を少し出す(「はやい」ほど短い)
  // 案C: 自分の番になったら、ひとつ前のターン(相手の番)に起きたことをまとめて出す(練習試合・見本では出さない)
  const turnSeen = useRef(null);
  useEffect(() => {
    // 見返しでは出さない。上の帯と下の帯が「いま見せている手を打ったときの番」を出しているので、
    // 「この手のあとに始まる番」の帯がまんなかに出ると食い違って見えた(2026-10-27 ナガメくんの見回り)
    if (replay) return undefined;
    if (st.phase === 'setup' || st.winner !== null || st.turn < 1) return undefined;
    const id = `${st.turn}-${st.active}`;
    if (turnSeen.current === id) return undefined;
    turnSeen.current = id;
    const key = `turn-${id}-${Date.now()}`;
    const meNow = st.active === CARD_ME;
    setTurnBanner({ key, me: meNow, name: meNow ? meName : who.name });
    if (meNow && !replay && !watch && !game.demo && Audio_.fgSe.card) Audio_.fgSe.card(); // 自分の番が来た音(今ある「カード」の短い音。改良の案 A)
    // 前の番の技の帯が、番の帯のうしろに残って重なっていた。自分の番が始まるときの相手の技の札は、番の帯が消えたあとも
    //   自分が何か操作するまで残す(2026-10-27 社長・案A「相手がカードを使ったときにカードがすぐ消えて効果がわからない」)
    setAction((cur) => (meNow && cur && cur.side === 'foe' ? cur : null));
    actionMissed.current = null; // 吹き出しで隠れた技の札も、次の番へは持ち越さない
    // 番の知らせは0.8秒ほど(「はやい」ほど短い。タップでも消える)。2026-10-26 ソラシドさん「どっちのターンか分かりにくい」
    const bannerMs = Math.max(500, Math.round(800 * pace));
    const t = setTimeout(() => setTurnBanner((cur) => (cur && cur.key === key ? null : cur)), bannerMs);
    // ひとつ前の番のまとめは、番の知らせが消えてから出す(重ねない)
    let t2 = null;
    if (meNow && !tutorial && !game.demo && !replay && !watch) {
      const lines = st.log.filter((l) => l.turn === st.turn - 1 && l.kind !== 'turn').map((l) => cardLogText(l)).slice(-8);
      setTurnSummary(null);
      if (lines.length) t2 = setTimeout(() => setTurnSummary({ key: `sum-${id}`, turn: st.turn - 1, lines }), bannerMs);
    } else setTurnSummary(null);
    return () => { clearTimeout(t); if (t2) clearTimeout(t2); };
  }, [st.turn, st.active, st.phase]);
  // まとめは、自分が何かしたら(手札を選ぶ・カードを出す)閉じる
  //   手札を運び始めたとき(運んだ先にまとめが重なる)と、しばらくたったときも閉じる
  useEffect(() => { if (turnSummary && (sel || picks.length || drag)) setTurnSummary(null); }, [sel, picks.length, drag]);
  // 相手の技の札も、自分が何か操作したら閉じる(案A)
  useEffect(() => { if (sel || picks.length || drag) setAction((cur) => (cur && cur.side === 'foe' ? null : cur)); }, [sel, picks.length, drag]);
  useEffect(() => {
    if (!turnSummary || sumOpen) return undefined;
    const t = setTimeout(() => setTurnSummary((cur) => (cur && cur.key === turnSummary.key ? null : cur)), Math.max(3500, turnSummary.lines.length * 1200));
    return () => clearTimeout(t);
  }, [turnSummary && turnSummary.key, sumOpen]);

  // マルチ対戦: 届いた相手の手を当てる・相手の捨て札の並びを本物にする・相手の投了や抜けたで終える(91 の CARD_PVP)
  const stRef = useRef(st);
  stRef.current = st;
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!pvpLive) return undefined;
    return CARD_PVP.attach({
      onAct: (msg) => { const next = cardPvpApplyRemote(db, stRef.current, msg); if (next) stepRef.current(null, next); return next; },
      onDiscard: (list) => setSt((cur) => { const n = cardPvpPatchDiscard(db, cur, list); stRef.current = n; return n; }),
      onForceEnd: (outcome) => { if (finished.current) return; finished.current = true; onFinish({ outcome, st: stRef.current }); },
      onChat: (text) => { showBubble({ text, key: `chat-${Date.now()}`, face: 'normal' }); },
    });
  }, []);
  // 観戦: 届いた場を見せる。quiet … 途中から見始めた・まとめて届いたとき(動きを出さずに、その場へ飛ぶ)
  useEffect(() => {
    if (!watch || typeof watch.attach !== 'function') return undefined;
    return watch.attach({
      onState: (next, quiet) => {
        if (!next) return;
        if (quiet) { stRef.current = next; setSt(next); setAction(null); setBigCard(null); setFx([]); return; }
        stepRef.current(null, next);
      },
      onPatch: (next) => { if (next) { stRef.current = next; setSt(next); } }, // 捨て札の並びが本物になっただけ(動きは出さない)
      onEnd: (end) => setWatchEnd(end || null),
      onEyes: (n) => setWatchEyes(Number.isInteger(n) ? n : 0),
    });
  }, []);
  useCardPvpAuto(db, pvpLive, st, step, paused); // 検査のときだけ自分の番を自動で打つ(91。ふだんは何もしない)
  const pvpClock = useCardPvpClock(pvpLive, st, step); // マルチ対戦の持ち時間(91)。マルチでないときは何もしない
  // 動きの見本(デバッグ): 決まった順に1手ずつ進める
  const demoAt = useRef(0);
  useEffect(() => {
    if (!game.demo || paused) return undefined;
    const t = setTimeout(() => {
      const demoStep = game.demo.steps[demoAt.current];
      if (!demoStep) return;
      demoAt.current += 1;
      const act = cardMotionDemoAction(db, st, demoStep);
      if (act) step(act);
    }, demoAt.current === 0 ? 1400 : 1700);
    return () => clearTimeout(t);
  }, [st, paused]);
  // 勝ち負けが決まったら、少し見せてから結果へ。そのあいだ盤の上に「WIN!」「LOSE」を大きく出す(2026-10-26 社長 OK の改良の案 C)。画面をタップすると、すぐ結果へ
  const endNow = useRef(null);
  // 勝ち負けの演出が出ているか。出ているあいだは、吹き出し・カットイン・ダメージの数字・まんなかの記録を消して、演出だけにする(重なって見えた。2026-10-27 ソランドくん)
  const endFx = st.winner !== null && !tutorial && !replay && !watch;
  useEffect(() => {
    if (st.winner === null || finished.current || tutorial || replay || watch) return undefined; // 練習試合は、ドラの締めの台詞のあと「次へ」で終わる
    finished.current = true;
    const go = () => { clearTimeout(t); endNow.current = null; onFinish({ outcome: st.winner === CARD_ME ? 'win' : 'lose', st, comeback: !!talk.current.behind[st.winner] }); };
    const t = setTimeout(go, CARD_RESULT_WAIT_MS[settings.resultWait] || 2200);
    // 出てすぐ(0.6秒)のタップは受けない(とどめのあとに続けて押した指で、勝ちの画面を見ないまま結果へ飛んでいた)
    const at = Date.now();
    endNow.current = () => { if (Date.now() - at >= 600) go(); };
    if (st.winner === CARD_ME && !game.demo && Audio_.fgSe.victory) Audio_.fgSe.victory();
    return () => { clearTimeout(t); endNow.current = null; };
  }, [st.winner]);

  const me = st.players[CARD_ME];
  const opp = st.players[CARD_CPU];
  const decider = cardDeciderOf(st);
  const myTurn = !replay && !watch && st.winner === null && decider === CARD_ME;
  // どちらの番か(守りの場面でも、番の持ち主は st.active)。場のふち・上の帯の色に使う
  const turnMe = st.active === CARD_ME;
  // 上の帯の番。見返しでは「いま見せている手を打ったときの場」で数える(下の帯と同じ。1手目は「はじまり」のまま。2026-10-27 カゲあつくんの見直し)
  const headSt = replay && replayAt > 0 ? replay.states[replayAt - 1] : st;
  const headMe = headSt.active === CARD_ME;
  // 見返しでは助手の吹き出しを出さない(まんなかの記録の箱に重なって読めなかった。2026-10-27 カゲあつくんの見直し)
  useEffect(() => { if (replay && bubble) setBubble(null); }, [bubble && bubble.key]);
  const turnLive = st.winner === null && st.phase !== 'setup' && st.turn >= 1;
  const mode = !myTurn ? 'wait'
    : st.pendingPray ? 'pray'
    : st.pendingReveal ? 'reveal'
    : st.pendingChoice ? 'choose'
    : st.pendingDiscard ? 'discard'
    : st.phase === 'setup' ? 'setup'
    : st.pending ? 'guard'
    : st.phase === 'main' ? 'attack'
    : st.phase === 'guts' ? 'guts' : 'wait';
  // 付けても何も変わらない札を付けた手(ガッツ0の札にジョイのサポートなど)は、組み合わせのボタンにも運ぶ先にも出さない
  //   (社長の答え 案A＋B・2026-10-27。決め方は助手と同じ cardAttachUseless。ルールでは出せる手のまま)
  const attackOpts = mode === 'attack' ? cardAttackOptions(db, st).filter((o) => tutAllow(o) && !cardAttachUseless(db, st, o)) : [];
  // おいのりの窓(相手が全体カードを出した瞬間): おいのりを持っていなければ、少しおいて自動で「使わない」
  const prayUse = mode === 'pray' ? cardPrayOptions(db, st).find((o) => o.hand) || null : null;
  const prayKey = mode === 'pray' && !prayUse ? `${st.turn}-${st.log.length}` : '';
  useEffect(() => {
    if (!prayKey) return undefined;
    const t = setTimeout(() => step({ type: 'pray' }), Math.round(500 * pace));
    return () => clearTimeout(t);
  }, [prayKey]);
  // 長期戦の予感(全体カード): ガッツの段でガッツにできる枚数
  const gutsMax = (cardFieldEff(st, 'fieldGutsMax') || {}).n || 99;
  // 見せる段(相手の死神の力): こちらは選ぶことが無いので、少し見せてから自動で進める
  const revealKey = mode === 'reveal' ? `${st.turn}-${st.log.length}` : '';
  useEffect(() => {
    if (!revealKey) return undefined;
    const t = setTimeout(() => step({ type: 'reveal' }), Math.round(900 * pace));
    return () => clearTimeout(t);
  }, [revealKey]);
  // 選ぶ段の候補(捨て札・手札・相手の手札の、何枚目か)
  const choice = mode === 'choose' ? (() => {
    const ch = st.pendingChoice;
    const list = ch.src === 'oppHand' ? st.players[CARD_CPU].hand : ch.src === 'hand' ? me.hand : me.discard;
    const title = { toHand: '手札に加えるカードを選ぶ', toDeckBottom: '山札の一番下へ戻すカードを選ぶ', toDeckShuffleDraw: '山札に戻すカードを選ぶ', discardDraw2: '捨てるカードを選ぶ', oppDiscard: '相手に捨てさせるカードを選ぶ' }[ch.then] || 'カードを選ぶ';
    return { title, from: (cardOf(db, ch.card) || {}).name || '', items: ch.cands.map((i) => ({ i, no: list[i], c: cardOf(db, list[i]) })) };
  })() : null;
  const guardOpts = mode === 'guard' ? cardGuardOptions(db, st).filter(tutAllow) : [];
  // 守れるカードが1枚も無いときは、自動で「守らない」にする(オプションの「自動パス」。練習試合と見本では使わない)
  //   守れない理由の一言(data-card-guard-why)を少し見せてから進む
  const autoPassKey = mode === 'guard' && settings.autoPass && !tutorial && !game.demo && !guardOpts.length && st.pending && !st.pending.evaded ? `${st.turn}-${JSON.stringify(st.pending.attack || st.pending)}` : '';
  useEffect(() => {
    if (!autoPassKey) return undefined;
    const t = setTimeout(() => step({ type: 'pass' }), Math.round(1100 * pace));
    return () => clearTimeout(t);
  }, [autoPassKey]);

  // 選んだカードから、残りの選び方(使う子・組み合わせ・狙う相手)を絞る
  const selOpts = sel && mode === 'attack' ? attackOpts.filter((o) => o.hand.includes(sel.hand)) : [];
  const selMons = [...new Set(selOpts.map((o) => (o.mon === undefined ? -1 : o.mon)))];
  const monChosen = sel && (sel.mon !== undefined ? sel.mon : selMons.length === 1 ? selMons[0] : undefined);
  const byMon = monChosen === undefined ? [] : selOpts.filter((o) => (o.mon === undefined ? -1 : o.mon) === monChosen);
  // 同じ名前の並びになる組み合わせは1つにまとめる(急襲が2枚あると、同じボタンが2つ並んで見分けがつかなかった。2026-10-28 社長)。
  //   同じ名前の札は、手札の番号の小さいほうを使う
  const setsAll = [...new Set(byMon.map((o) => JSON.stringify(o.hand)))].sort((a, b) => JSON.parse(b).length - JSON.parse(a).length || JSON.parse(a).reduce((x, y) => x + y, 0) - JSON.parse(b).reduce((x, y) => x + y, 0));
  const sets = setsAll.filter((s0, k) => setsAll.findIndex((s1) => cardHandNameKey(me.hand, JSON.parse(s1)) === cardHandNameKey(me.hand, JSON.parse(s0))) === k);
  // 組み合わせを選んでいないときは、押した札1枚だけ(付ける札は、組み合わせのボタンを押したときだけ付く。運ぶときとそろえる)。
  //   前はいちばん枚数の多い組み合わせが先に選ばれ、付けたつもりが無いのに付いた(2026-10-27 社長の報告: カララギマンゴーにジョイのサポート)。
  //   1枚では出せない札(付ける札を押したとき・組で出す札)は、組み合わせのボタンを押すまで何も選ばない(「組み合わせを選んでね」)。
  //   前はいちばん枚数の多い組が選ばれて「＋急襲」まで勝手に付いた(2026-10-28 社長「組み合わせる系が勝手に選ばれるのが使いにくい」・案C)。
  //   選べる組が1つしかないときは、迷いが無いのでそれを選ぶ
  const setAlone = sel ? JSON.stringify([sel.hand]) : null;
  const setChosen = sel && sets.length ? (sel.set && sets.includes(sel.set) ? sel.set : sets.includes(setAlone) ? setAlone : sets.length === 1 ? sets[0] : null) : null;
  const setPending = !!(sel && monChosen !== undefined && sets.length > 1 && !setChosen);
  const finalOpts = byMon.filter((o) => JSON.stringify(o.hand) === setChosen);
  const needTarget = finalOpts.some((o) => o.target);

  // ---- 技を使う前・ターン終了の確かめ(オプション。既定は確かめない) ----
  // ★マルチ対戦では、窓を出しているあいだも持ち時間は止まらない。場が変わったら(時間切れの自動の手・相手の手が届いた・自分の手)窓は閉じる。
  //   閉じずに古い「はい」が残ると、時間切れのあとに古い手を送って2台の場がずれる(ブレイブくんとの決め)。押したときにも、その手がまだ出せるかを確かめ直す
  const [confirm, setConfirm] = useState(null); // { kind: 'use' | 'end', act, label }
  // 影縛り(名指しの要る札)を付けた手は、名指しする守りの札を先に選ぶ。場が変わったら閉じる(確かめの窓と同じ)
  const [bindAsk, setBindAsk] = useState(null); // 名指しを待っている手
  const [splitAsk, setSplitAsk] = useState(null); // ショットガン: 割り振りの候補(手の並び)
  const [tossAsk, setTossAsk] = useState(null); // カード投げ: { base: 狙いまで決めた手, picks: 捨てる手札の番号 }
  useEffect(() => { setConfirm(null); setBindAsk(null); setSplitAsk(null); setTossAsk(null); }, [st]);
  // 名指しをやめたら、選んでいた手札も外す(残っていると、次に押したとき選び外しになって分かりにくい)
  const bindCancel = () => { setBindAsk(null); setSel(null); setHint(''); };
  const askUse = (o, tossDone) => {
    if (o && Array.isArray(o.toss) && !tossDone) { setTossAsk({ base: o, picks: [] }); return; } // カード投げ: 先に捨てる手札を選ぶ
    if (o && Array.isArray(o.hand) && !o.bind && o.hand.some((i) => cardHasEff(cardOf(db, me.hand[i]), 'attachBind'))) { setBindAsk(o); return; }
    if (!confirmOn('confirmUse')) { step(o); return; }
    const c = cardOf(db, me.hand[o.hand[0]]);
    const tm = o.target ? st.players[o.target.p].mons[o.target.m] : null;
    setConfirm({ kind: 'use', act: o, label: `「${c ? c.name : ''}」を${tm ? `${tm.name}に` : ''}使いますか？` });
  };
  const askEnd = (act) => {
    if (!confirmOn('confirmEnd')) { step(act); return; }
    setConfirm({ kind: 'end', act, label: act.hand && act.hand.length ? `${act.hand.length}枚をガッツにして、ターンを終わりますか？` : 'ガッツにしないで、ターンを終わりますか？' });
  };
  const confirmYes = () => {
    const cf = confirm;
    setConfirm(null);
    if (!cf) return;
    if (cf.kind === 'use') { const { bind: _bind, ...bare } = cf.act; if (!cardAttackOptions(db, st).some((o) => JSON.stringify(o) === JSON.stringify(bare))) return; }
    if (cf.kind === 'end' && (st.phase !== 'guts' || cardDeciderOf(st) !== CARD_ME || st.pending)) return;
    step(cf.act);
  };
  // ガッツにするカードのおすすめ(オプション): 自分のガッツの番になったら、思考(いちばん強い段・迷いなし)が選ぶカードを先に選んでおく。選び直せる
  const gutsAdvisor = useMemo(() => cardAiPolicy('kyuko', 'master'), []);
  const gutsPickKey = settings.gutsPick === 'ON' && mode === 'guts' && myTurn && !tutorial && !game.demo ? `${st.turn}` : '';
  useEffect(() => {
    if (!gutsPickKey) return;
    try { const a = cardAiChooseGuts(db, st, gutsAdvisor); if (a && Array.isArray(a.hand) && a.hand.length) setPicks(a.hand.filter((i) => i >= 0 && i < me.hand.length)); } catch (_) { /* おすすめが出せなくても、自分で選べばよい */ }
  }, [gutsPickKey]);
  // 手札の並べ方(オプション): 見た目の順だけを変える。選ぶ・運ぶ・送る手は、いつも st の手札の番号(i)のまま(マルチで相手に別のカードが出ないように)
  const handOrder = (() => {
    const idx = me.hand.map((_, i) => i);
    if (settings.handSort !== 'KIND') return idx;
    const rank = (i) => { const c = cardOf(db, me.hand[i]); return c ? (c.user === 'breeder' ? 9 : (CARD_KIND_ORDER[c.kind] ?? 8)) : 10; };
    return idx.sort((a, b) => rank(a) - rank(b) || a - b);
  })();
  const handLarge = settings.handText === 'LARGE' && !tiny;
  // 手札の小さい段は縦の画面だけ(横画面は右の列の幅に余裕がある。2026-10-27 ソランドくん「手札のカードも小さい」)
  const handTiny = tiny && !wide; // 手札の字を大きく(狭い画面では、ふつうのまま)
  const tapHand = (i) => {
    Audio_.fgSe.tap();
    if (tutorial && myTurn && (!cardTutorialHandOk(tutStage.id, st, i) || tutStage.next || tutQ.length > 1)) { tutWrongSay(); return; }
    if (mode === 'guts' || mode === 'setup' || mode === 'discard') {
      const max = mode === 'setup' ? CARD_BATTLE_SETUP_GUTS_MAX : mode === 'discard' ? st.pendingDiscard.n : gutsMax;
      setPicks((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= max ? cur : [...cur, i]));
      return;
    }
    if (mode === 'guard') {
      const os = guardOpts.filter((o) => o.hand === i);
      if (!os.length) { setHint('このカードでは守れません'); return; }
      // 隠れる(移す先 to がある守り)は、移す先の味方を選ぶ
      const picks2 = [...new Set(os.map((o) => (o.to !== undefined ? `t${o.to}` : `m${o.mon}`)))];
      if (picks2.length === 1) { step(os[0]); return; }
      setSel({ hand: i }); setHint(os.some((o) => o.to !== undefined) ? '目標を移す味方をタップ' : 'かばう子をタップ');
      return;
    }
    if (mode !== 'attack') return;
    if (sel && sel.hand === i) { setSel(null); setHint(''); return; }
    const os = attackOpts.filter((o) => o.hand.includes(i));
    const c = cardOf(db, me.hand[i]);
    if (!os.length) {
      setHint(!c ? '' : cardIsGuardKind(c.kind) ? '回避・防御は、相手に攻撃されたときに使います'
        : !c.ready ? 'このカードは準備中です'
        : c.guts > me.guts.length ? `ガッツが足りません(あと${c.guts - me.guts.length})` : 'いまは使えません(使える子がいない・もう攻撃した など)');
      setSel(null);
      return;
    }
    setSel({ hand: i });
    setHint('');
  };
  const tapMon = (p, m) => {
    if (mode === 'guard' && sel) {
      const o = guardOpts.find((x) => x.hand === sel.hand && p === CARD_ME && (x.to !== undefined ? x.to === m : x.mon === m));
      if (o) step(o);
      return;
    }
    if (mode !== 'attack' || !sel) return;
    if (monChosen === undefined) {
      if (p === CARD_ME && selMons.includes(m)) { Audio_.fgSe.tap(); setSel({ ...sel, mon: m }); }
      return;
    }
    const o = finalOpts.find((x) => x.target && x.target.p === p && x.target.m === m);
    if (o) askUse(o);
  };
  const markOf = (p, m) => {
    if (drag && drag.active) return dropOver === `${p}-${m}` ? 'drop' : null; // 運んでいるあいだは、置ける所の上だけ光らせる
    if (mode === 'attack' && sel) {
      if (monChosen === undefined) return p === CARD_ME && selMons.includes(m) ? 'user' : null;
      if (p === CARD_ME && m === monChosen) return 'acting';
      if (finalOpts.some((o) => o.target && o.target.p === p && o.target.m === m)) return 'target';
    }
    if (mode === 'guard' && sel && p === CARD_ME && guardOpts.some((o) => o.hand === sel.hand && (o.to !== undefined ? o.to === m : o.mon === m))) return 'user';
    if (st.pending) {
      const t = st.pending.targets[st.pending.ti];
      if (t && t.p === p && t.m === m) return 'target';
      if (st.pending.attacker === p && st.pending.mon === m) return 'acting';
    }
    return null;
  };
  const handUsable = (i) => {
    if (mode === 'attack') return attackOpts.some((o) => o.hand.includes(i));
    if (mode === 'guard') return guardOpts.some((o) => o.hand === i);
    return mode === 'guts' || mode === 'setup' || mode === 'discard';
  };

  // ---- 手札を指で運ぶ(社長 台帳 #3473「モンバトみたいに長押しで持ってく」)。手本はモンヒロバトル(60-app.jsx の dragState)----
  // 指が CARD_DRAG_THRESHOLD 動いたら運ぶ。動かさずに長押ししたときだけ詳しい画面。動かさずに離したらタップ(いままでどおり)
  //   技 … 狙う相手のモンスターへ / ガッツにする(と始める前のガッツ)… ガッツの置き場へ / 守り … 狙われた自分のモンスターへ
  // 運んでいるカードは body 直下の箱に1枚だけ出し、位置は直接動かす(手札の欄の中で動かすと iPhone でずれて2枚に見えた・60-app.jsx の注意)
  // 運んだ札 i が1枚では出せないとき、その子で出せる組み合わせ(名前の並び)が1つだけなら運んで出せる
  const cardDropComboOk = (o, i) => {
    const mo = (x) => (x.mon === undefined ? -1 : x.mon);
    if (attackOpts.some((x) => mo(x) === mo(o) && x.hand.length === 1 && x.hand[0] === i)) return true;
    return new Set(attackOpts.filter((x) => mo(x) === mo(o) && x.hand.includes(i)).map((x) => cardHandNameKey(me.hand, x.hand))).size <= 1;
  };
  const dropTargetsOf = (i) => {
    const out = {};
    if (mode === 'attack') {
      // 選んでいる組み合わせ(画面の札で選んだパターン)にこの札が入っていれば、運んだときもその組み合わせだけで出す。
      //   前は、置き先ごとにいちばん枚数の多い組み合わせを選んでいて、パターンを選んでも運ぶと全部付いて出ていた(2026-10-27 ソラシドさんの報告)
      const chosen = sel && setChosen && JSON.parse(setChosen).includes(i) ? finalOpts : null;
      const os = chosen || attackOpts.filter((o) => o.hand[0] === i).concat(attackOpts.filter((o) => o.hand[0] !== i && o.hand.includes(i)));
      os.forEach((o) => {
        const keys = o.target ? [`${o.target.p}-${o.target.m}`] : [...opp.mons.map((x, m) => (x.ko ? null : `${CARD_CPU}-${m}`)).filter(Boolean), ...(o.mon >= 0 ? [`${CARD_ME}-${o.mon}`] : [])];
        // 選んでいないときは、運んだ札1枚だけで出せればそれ(組み合わせの札は見えていないので、付けたつもりが無いのに付かないように)。
        //   1枚では出せない札(付ける札・組で出す札)は、いちばん枚数の多い組み合わせ(前からの既定)。2026-10-27 部長と決めた
        const alone = (x) => !chosen && x.hand.length === 1 && x.hand[0] === i;
        // 1枚では出せない札は、名前の違う組み合わせが2つ以上あれば、運んでも出さない(画面で組み合わせを選んでから。タップとそろえる。案C)
        if (!chosen && !alone(o) && !cardDropComboOk(o, i)) return;
        keys.forEach((k) => { if (!out[k] || (!alone(out[k]) && (alone(o) || o.hand.length > out[k].hand.length))) out[k] = o; });
      });
    }
    // 隠れる(移す先 to がある守り)は、移す先の味方が置き先(タップで移す先を選ぶのとそろえる。前は狙われた子へ置くと、移す先を選べなかった。2026-10-27 総点検)
    if (mode === 'guard') guardOpts.filter((o) => o.hand === i).forEach((o) => { out[`${CARD_ME}-${o.to !== undefined ? o.to : o.mon}`] = o; });
    if ((mode === 'guts' || mode === 'setup') && !picks.includes(i)) {
      const max = mode === 'setup' ? CARD_BATTLE_SETUP_GUTS_MAX : gutsMax;
      if (picks.length < max && (!tutorial || cardTutorialHandOk(tutStage.id, st, i))) out.guts = 'pick';
    }
    return out;
  };
  const dropKeyAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.closest('[data-card-guts-drop]')) return 'guts';
    const mon = el.closest('[data-card-mon]');
    return mon ? mon.getAttribute('data-card-mon') : null;
  };
  // 手札を2回続けてタップ(CARD_DOUBLE_TAP_MS の内)したら、詳しい画面(社長 2026-10-26)。
  //   1回目は待たずにすぐ動かし(守りの番も)、同じ札の2回目が来たら1回目の前の選び方へ戻して詳しい画面。別の札ならふつうの次のタップ
  const handTap = useRef({ last: null });
  const tapHandOrDouble = (i, no) => {
    const h = handTap.current;
    const now = Date.now();
    if (h.last && h.last.i === i && h.last.no === no && now - h.last.at < CARD_DOUBLE_TAP_MS) {
      const before = h.last.before;
      h.last = null;
      if (before) { setSel(before.sel); setPicks(before.picks); setHint(before.hint); }
      setDetail(no);
      return;
    }
    h.last = { i, no, at: now, before: { sel, picks, hint } };
    tapHand(i);
  };
  // 運んで出した手でも、タップと同じく「選ぶ」段を飛ばさない(2026-10-27 総点検。前は最初の候補のまま出ていた)
  //   使う子が2体以上 … 使う子を選ぶ案内 / ショットガンの割り振り・合体の2体 … 選ぶ画面 / 変形 … 空中・地上のボタン(その札を選んだ形にする)
  const dropUse = (t) => {
    const monKey = (o) => (o.mon === undefined ? -1 : o.mon);
    // 使える子が2体以上いる札を、使う子を選ばずに運んだら、出さずにその札を選んだ形で止める(社長の答え・ソランド判断 案B。思った子と違う子で出ないように)
    const users = [...new Set(attackOpts.filter((o) => o.hand[0] === t.hand[0]).map(monKey))];
    if (users.length > 1 && !(sel && t.hand.includes(sel.hand) && monChosen !== undefined)) { setSel({ hand: t.hand[0] }); setHint('使う子をタップしてください'); return; }
    const same = attackOpts.filter((o) => JSON.stringify(o.hand) === JSON.stringify(t.hand) && monKey(o) === monKey(t));
    if (t.split || t.fuse) { setSplitAsk(same.filter((o) => o.split || o.fuse)); return; }
    if (t.form) { setSel({ hand: t.hand[0], mon: monKey(t), set: JSON.stringify(t.hand) }); setHint('空中か地上かを選んでください'); return; }
    askUse(t);
  };
  const handDown = (e, i, no) => {
    if (e.button !== undefined && e.button !== 0) return;
    // 手札を運ぶ操作を使わない(オプション)ときは、置ける所を作らない(タップと長押しだけ)
    const d = { i, no, sx: e.clientX, sy: e.clientY, active: false, long: false, targets: myTurn && settings.drag !== 'OFF' ? dropTargetsOf(i) : {} };
    dragRef.current = d;
    clearTimeout(d.timer);
    d.timer = setTimeout(() => { if (!d.active) { d.long = true; setDetail(no); } }, pressMs);
    const onMove = (ev) => {
      const moved = Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy);
      if (!d.active && moved >= CARD_DRAG_THRESHOLD && !d.long && Object.keys(d.targets).length) {
        d.active = true;
        clearTimeout(d.timer);
        setDrag({ i, no, x: ev.clientX, y: ev.clientY, active: true });
      }
      if (!d.active) { if (moved >= CARD_DRAG_THRESHOLD) clearTimeout(d.timer); return; }
      if (ghostRef.current) { ghostRef.current.style.left = `${ev.clientX}px`; ghostRef.current.style.top = `${ev.clientY}px`; }
      const k = dropKeyAt(ev.clientX, ev.clientY);
      const over = k && d.targets[k] ? k : null;
      if (over !== d.over) { d.over = over; setDropOver(over); }
      if (ev.cancelable) ev.preventDefault();
    };
    const onUp = (ev) => {
      clearTimeout(d.timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dragRef.current = null;
      if (d.active) {
        const k = ev.type === 'pointercancel' ? null : dropKeyAt(ev.clientX, ev.clientY);
        const t = k ? d.targets[k] : null;
        setDrag(null); setDropOver(null);
        if (t === 'pick') { Audio_.fgSe.tap(); setPicks((cur) => (cur.includes(i) ? cur : [...cur, i])); }
        else if (t && mode === 'attack') dropUse(t);
        else if (t) step(t);
        return;
      }
      if (d.long || ev.type === 'pointercancel') return;
      if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < CARD_DRAG_THRESHOLD) tapHandOrDouble(i, no);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // まんなかの「いま起きたこと」(新しい2行)。守りの番は、何が来ているかを出す
  const pd = st.pending;
  const pendingText = pd ? (() => {
    const t = pd.targets[pd.ti];
    const tm = t ? st.players[t.p].mons[t.m] : null;
    return `${cardUseText(db, st, pd.attacker, pd.mon, [pd.main])}が${tm ? tm.name : ''}に！(ダメージ${pd.base * pd.mult})`;
  })() : null;
  // 守りの番の「受けるダメージ 前 → 後」(自分が守るときも相手が守るときも。82 の cardGuardPreview。2026-10-27 社長・案A)
  const guardPv = pd ? cardGuardPreview(db, st) : null;
  const guardUsed = !!(guardPv && guardPv.cards.length);
  const guardTagOf = (p, m) => {
    if (!guardUsed) return '';
    const t = pd.targets[pd.ti];
    return t && t.p === p && t.m === m ? guardPv.cards.map((no) => cardGuardShort(cardOf(db, no))).join('・') : '';
  };
  // 自分が守る番に受けている攻撃カード(相手が守る番・練習試合は出さない)
  const guardAtk = pd && pd.defender === CARD_ME && !tutorial ? cardOf(db, pd.main) : null;
  const logLines = st.log.filter((l) => l.kind !== 'turn').slice(-3);
  // まんなかに入り切らないときの詰め方(2026-10-25 社長の実機「コメントが切れてる」。iPhone の字は行が高く、上下が切れた)。
  //   0 … ふつう / 1 … 記録は新しい1行だけ / 2 … 技の帯の絵を省く / 3 … 技の帯を隠す。吹き出しと記録の最後の1行は必ず残す。
  //   中身が変わるたびに 0 から測り直す(描く前に測るので、ちらつかない)
  const stageRef = useRef(null);
  const [stageFit, setStageFit] = useState(0);
  // 盤全体に入り切らないときの詰め方(2026-10-26 統括部長「下のボタンが、たまに下が少し切れる」。320×568 でホームバーの余白があると、
  //   下の帯が盤の外へ 8〜24px 出ていた)。いちばん下の帯の下のはしが盤の外なら、1段ずつ詰める。
  //   0 … ふつう / 1 … まんなかの最小の高さを 64→40px / 2 … 手札のカードを少し小さく・上の持ち上げ分を詰める。段や画面の大きさが変わったら 0 から測り直す
  //   リプレイは相手の手札の列と再生の帯のぶん高いので、さらに 3 … 手札の字を省く / 4 … 手札をもう少し小さく まで詰める(2026-10-27 社長の実機で下の操作が切れた)
  const [boardFit, setBoardFit] = useState(0);
  const [boardFitKey, setBoardFitKey] = useState(0);
  useEffect(() => { const on = () => setBoardFitKey((k) => k + 1); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  // 吹き出しをまんなかの流れの中に置くとき(上に重ねない)= 顔の大きいカットイン。入り切らなければ stageFit が詰める。
  //   隠れているあいだ(守りを選ぶ・番の帯・ダウンの帯・大写し・決着)は場所を取らない(844×390 の守りで、見えないカットインが記録を押し出した)
  const bubbleHidden = !!(bigCard || turnBanner || downBand || guarding || endFx);
  const bubbleInFlow = !!(bubble && !replay && bubble.cut && !bubbleHidden);
  // 小さい縦の画面と横の画面では、上に重ねたふつうの吹き出しが技の札を隠す(320×568 は上半分・844×390 は丸ごと。2026-10-27 フキダシくん)。
  //   吹き出しが出ているあいだは技の札を出さない(何の技かは記録の1行に出ている。台詞が消えれば札が出る)
  const bubbleOverAction = !!((tiny || wide) && bubble && !bubble.cut && !replay && !tutorial);
  // 吹き出しで隠れたまま消えた技の札は、吹き出しが消えたあと1.2秒だけ出し直す(横の画面では台詞の間がほとんど無く、
  //   相手の技の1行が一度も見えなかった。2026-10-27 フキダシくんの測り直し・ソランドくん「相手が何をしたか分かるのは大事」)。
  //   番の帯・ダウンの帯・守りを選ぶ間・決着のときは出し直さない。次の技が来たら、そちらに替わる
  //   ダウンの帯(手前)の後ろで札が読めなかったときも同じ(倒した技が分からなかった。フキダシくん)
  const actionHidden = bubbleOverAction || !!downBand;
  useEffect(() => { if (action && actionHidden) actionMissed.current = action; else if (action) actionMissed.current = null; }, [action && action.key, actionHidden]);
  useEffect(() => {
    if (actionHidden || action || !actionMissed.current) return;
    const miss = actionMissed.current; actionMissed.current = null;
    if (turnBanner || guarding || endFx || bigCard) return;
    const key = `${miss.key}-again`;
    setAction({ ...miss, key });
    const again = setTimeout(() => setAction((cur) => (cur && cur.key === key ? null : cur)), 1200);
    motionTimers.current.push(again);
  }, [actionHidden]);
  const stageKey = `${bubble ? bubble.key : ''}|${action ? action.key : ''}|${st.log.length}|${pendingText || ''}|${tutorial ? 1 : 0}`;
  React.useLayoutEffect(() => { setStageFit(0); }, [stageKey]);
  React.useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || stageFit >= 3) return;
    if (el.scrollHeight > el.clientHeight + 1) setStageFit((f) => Math.min(3, f + 1));
  });
  // 横と縦が切りかわったときも測り直す(はじめは縦の並びで測って詰めたまま、横の並びで手札が小さく残っていた)
  React.useLayoutEffect(() => { setBoardFit(0); }, [mode, boardFitKey, wide]);
  // リプレイは場が止まっていて描き直しが起きないので、カードの絵が読み込まれて高さが増えたら測り直す(読み込みの前に測ると「入り切る」と出ていた)
  const [, setBoardFitTick] = useState(0);
  useEffect(() => {
    const b = boardRef.current;
    if (!(replay || watch) || !b) return undefined;   // 観戦も、縦の短い端末で下が切れやすいので同じに測り直す(2026-10-27 部長)
    const on = (e) => { if (e.target && e.target.tagName === 'IMG') setBoardFitTick((t) => t + 1); };
    b.addEventListener('load', on, true);
    return () => b.removeEventListener('load', on, true);
  }, [!!replay, !!watch]);
  React.useLayoutEffect(() => {
    const b = boardRef.current;
    const f = b && b.querySelector('[data-card-footer]');
    const fitMax = replay || watch ? 4 : 2;
    if (!f || boardFit >= fitMax) return;
    if (f.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom + 0.5) setBoardFit((x) => Math.min(fitMax, x + 1));
  });

  // リプレイの相手の手札(表)。縦の画面で入り切らないときは小さくする(boardFit 2 から)
  const replayFoeHand = replay ? (
    <div data-card-replay-foe-hand className={`flex shrink-0 items-center justify-center gap-1 px-2 ${wide ? 'mb-auto pt-2' : 'pb-0.5'}`}>
      {wide && <span className="shrink-0 text-[11px] font-bold text-slate-300">相手の手札</span>}
      {st.players[CARD_CPU].hand.map((no, i) => { const c = cardOf(db, no); return (
        <button key={`${no}-${i}`} type="button" data-card-replay-foe-card={i} onClick={() => c && setDetail(no)} className={`${wide ? 'w-[34px]' : tiny || boardFit >= 2 ? 'w-[26px]' : 'w-[38px]'} shrink-0`}>
          <img src={c ? CARD_IMG(c.img) : CARD_BACK_IMG()} alt={c ? c.name : ''} draggable={false} className="w-full rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,.35)]"/>
        </button>
      ); })}
    </div>
  ) : null;
  const strip = (p) => {
    const pl = st.players[p];
    return (
      <div className={`flex items-center whitespace-nowrap font-bold ${tiny ? 'gap-1 text-[10px]' : 'gap-1.5 text-[11px]'}`}>
        {p === CARD_CPU && !replay && <span data-card-hand-of={p} className="flex">{pl.hand.map((_, i) => <img key={i} src={CARD_BACK_IMG()} alt="" className="-ml-1 h-[18px] w-[13px] rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,.35)] first:ml-0"/>)}</span>}
        <span data-card-deck-of={p} className={`rounded-md border border-white/20 bg-white/10 ${tiny ? 'px-1' : 'px-1.5'} py-0.5`}>山札 {pl.deck.length}</span>
        <span data-card-guts-of={p} {...(p === CARD_ME ? { 'data-card-guts-drop': true } : {})} className={`flex items-center gap-0.5 rounded-md border ${tiny ? 'px-1' : 'px-1.5'} py-0.5 text-amber-100 ${p === CARD_ME && dropOver === 'guts' ? 'border-emerald-300 bg-emerald-400/30 ring-4 ring-emerald-300' : 'border-amber-300/40 bg-amber-500/10'}`}>ガッツ {pl.guts.length}</span>
        <button type="button" onClick={() => setDiscard({ tab: p })} className={`rounded-md border border-white/20 bg-white/10 ${tiny ? 'px-1' : 'px-1.5'} py-0.5`}>捨て札 {pl.discard.length}</button>
      </div>
    );
  };

  // 練習試合で、いま教えている所(光らせる手札・押せるボタン)。ほかのボタンは押せない(暗くする)
  const tutFocus = (() => {
    if (!tutorial) return { hand: [], button: null };
    if (tutStage.next || tutQ.length > 1 || (tutQ[0] && tutQ[0][0] === 'M') || !myTurn) return { hand: [], button: null };
    const okAct = (act) => cardTutorialAllow(db, tutStage.id, st, act);
    const hand = me.hand.map((_, i) => i).filter((i) => cardTutorialHandOk(tutStage.id, st, i) && !picks.includes(i));
    if (mode === 'attack') {
      if (okAct({ type: 'endAttacks' })) return { hand: [], button: 'end' };
      return { hand: sel ? [] : hand.filter((i) => attackOpts.some((o) => o.hand.includes(i))), button: null };
    }
    if (mode === 'guts') {
      if (tutStage.id === 'guts') return { hand: picks.length >= 2 ? [] : hand, button: picks.length ? 'turn' : null };
      return { hand: [], button: 'turn' };
    }
    if (mode === 'guard') return st.pending && st.pending.evaded ? { hand: [], button: 'pass' } : { hand: hand.filter((i) => guardOpts.some((o) => o.hand === i)), button: null };
    return { hand: [], button: null };
  })();
  const tutBtn = (key) => (tutorial ? (tutFocus.button === key ? ' animate-pulse ring-4 ring-emerald-300' : '') : '');
  const tutOff = (key) => tutorial && tutFocus.button !== key;
  // リプレイ: 1手ごとの場へ差し替える(選びかけ・大写し・技の帯は消す)
  const replaySeek = (n) => {
    if (!replay) return;
    const k = Math.max(0, Math.min(replay.states.length - 1, n));
    setReplayAt(k); setSel(null); setPicks([]); setBigCard(null); setAction(null); setTurnSummary(null);
    setSt(replay.states[k]);
  };
  const footer = (() => {
    const btn = 'mh-button min-h-[44px] flex-1 rounded-xl text-[14px] font-black active:scale-[.98] disabled:opacity-40';
    // 観戦: 押す所は「観戦をやめる」だけ。いまだれが何を考えているかを名前で出す
    if (watch) {
      const over = st.winner !== null || !!watchEnd;
      const nm = (p) => (p === CARD_ME ? meName : who.name);
      const say = over ? '' : decider === st.active ? `${nm(decider)}の番…` : `${nm(decider)}が守りを考えています…`;
      return (<>
        {say && <div data-card-watch-say className="flex min-w-0 flex-1 items-center justify-center truncate text-[13px] font-bold text-slate-300">{say}</div>}
        <button type="button" data-card-watch-leave className={`${btn} ${over ? 'mh-button-primary' : 'border border-white/20 bg-slate-800'}`} onClick={() => onFinish({ outcome: 'watchExit', st })}>{over ? '観戦の一覧へ戻る' : '観戦をやめる'}</button>
      </>);
    }
    // 勝ち負けの演出が出ているあいだは、下の字を出さない(演出の「タップで次へ」と重なった。2026-10-27 ソランドくん)。高さは残す
    if (st.winner !== null && !tutorial) return <div className="flex-1 text-center text-[15px] font-black text-amber-200">{endFx ? '\u00a0' : st.winner === CARD_ME ? '勝ち！' : '負け…'}</div>;
    if (tutorial && (st.winner !== null || tutStage.next)) return <div className="flex-1 text-center text-[13px] font-bold text-slate-300">ドラの説明を読んで「次へ」</div>;
    // 自分の番に相手が守りを選んでいるあいだは「◯◯の番」と言わない(上のヘッダーと食い違っていた。案A)
    if (mode === 'wait') return <div className="flex-1 text-center text-[13px] font-bold text-slate-300">{st.active === CARD_ME ? `${who.name}が守りを考えています…` : `${who.name}の番…`}</div>;
    if (mode === 'setup') return <button type="button" className={`${btn} mh-button-primary`} onClick={() => step({ type: 'setupGuts', hand: picks })}>{picks.length ? `${picks.length}枚をガッツにして始める` : 'ガッツにしないで始める'}</button>;
    if (mode === 'reveal') return <div className="flex-1 text-center text-[13px] font-bold text-slate-300">相手に手札を見せています…</div>;
    if (mode === 'pray') return <div className="flex-1 text-center text-[13px] font-bold text-amber-200">{prayUse ? 'おいのりを使うか選んでください' : '相手が全体カードを出しました'}</div>;
    if (mode === 'choose') return <div className="flex-1 text-center text-[13px] font-bold text-amber-200">カードを1枚選んでください</div>;
    if (mode === 'discard') return <button type="button" disabled={picks.length !== st.pendingDiscard.n} className={`${btn} mh-button-danger`} onClick={() => step({ type: 'discard', hand: picks })}>{`${st.pendingDiscard.n}枚えらんで捨てる`}</button>;
    if (mode === 'guard') return <button type="button" disabled={tutOff('pass')} className={`${btn} border border-white/20 bg-slate-800${tutBtn('pass')}`} onClick={() => step({ type: 'pass' })}>{tutorial && st.pending && st.pending.evaded ? 'これで守る' : guardUsed ? (guardPv.after !== null ? `これで受ける(${guardPv.after}ダメージ)` : 'これで受ける') : '守らない'}</button>;
    // ガッツの段から攻撃に戻る(出せるときだけ。灼熱の地でダメージが出た番などは cardCanBackToAttack が false。社長の答え 2026-10-27)
    //   練習試合(手順どおりに進める)と見返しでは出さない
    if (mode === 'guts') return (<>
      {myTurn && !tutorial && !replay && cardCanBackToAttack(st) && <button type="button" data-card-back-attack className={`${btn} border border-violet-300/60 bg-violet-900`} onClick={() => step({ type: 'backToAttack' })}>← 攻撃に戻る</button>}
      <button type="button" disabled={tutOff('turn')} className={`${btn} bg-gradient-to-b from-orange-400 to-orange-600${tutBtn('turn')}`} onClick={() => askEnd({ type: 'guts', hand: picks })}>{picks.length ? `${picks.length}枚をガッツにしてターン終了` : 'ガッツにしないでターン終了'}</button>
    </>);
    const useBtn = sel && monChosen !== undefined && finalOpts.length && !needTarget;
    return (<>
      {/* ショットガン: 割り振りを選ぶ窓 / 変形・トランスフォーム: 空中か地上かを選んで使う */}
      {useBtn && finalOpts.some((o) => o.split || o.fuse) ? <button type="button" data-card-split-open className={`${btn} mh-button-primary`} onClick={() => setSplitAsk(finalOpts)}>{finalOpts.some((o) => o.fuse) ? '合体の組を選ぶ' : '割り振りを選ぶ'}</button>
        : useBtn && finalOpts.some((o) => o.form) ? ['air', 'ground'].map((f) => { const o = finalOpts.find((x) => x.form === f); return o ? <button key={f} type="button" data-card-form={f} className={`${btn} mh-button-primary`} onClick={() => askUse(o)}>{f === 'air' ? '空中にして使う' : '地上にして使う'}</button> : null; })
        : useBtn ? <button type="button" className={`${btn} mh-button-primary`} onClick={() => askUse(finalOpts[0])}>使う</button> : null}
      <button type="button" disabled={tutOff('end')} className={`${btn} border border-violet-300/60 bg-violet-900${tutBtn('end')}`} onClick={() => step({ type: 'endAttacks' })}>攻撃おわり → ガッツへ</button>
    </>);
  })();
  // 黄色の案内は1行に収まる短い文に(長くて2行になり、手札を押し下げていた。2026-10-26 改良の案 E・カゲあつくん 8)。運ぶ操作の話はヘルプへ
  const guide = tutorial && (tutStage.next || tutQ.length > 1) ? '' : mode === 'attack' ? (sel ? (monChosen === undefined ? '使う子をタップ' : setPending ? '組み合わせを選んでね' : needTarget ? '狙う相手をタップ' : '「使う」をタップ') : attackOpts.length ? '技をタップ → 相手をタップ' : '使える技がありません →「攻撃おわり」でガッツへ')
    : mode === 'guard' ? (guardOpts.length ? '明るいカードで守れます' : '使える回避・防御はありません')
    : mode === 'guts' ? (gutsMax < 99 ? `ガッツにするカードをタップ(長期戦の予感: ${gutsMax}枚まで)` : 'ガッツにするカードをタップ(何枚でも)')
    : mode === 'setup' ? '後攻: 始める前に2枚までガッツにできます'
    : mode === 'discard' ? `捨てるカードを${st.pendingDiscard ? st.pendingDiscard.n : 0}枚タップ` : '';

  // 練習試合: ドラの説明の窓(縦の画面は自分のモンスターの列の上・横の画面は右の列。下の return で置く)
  const tutorBox = tutorial && tutSay ? (() => {
          const dra = ASSISTANTS.find((a) => a.id === 'dra');
          const head = tutQ[0];
          const showNext = tutStage.next ? (!head || head[0] === 'D') : (head && head[0] === 'D' && tutQ.length > 1);
          const onNext = () => {
            Audio_.fgSe.tap();
            setHint('');
            if (tutQ.length > 1) { setTutQ((q) => q.slice(1)); return; }
            if (tutStage.onNext === 'finish') { finished.current = true; onFinish({ outcome: 'tutorialDone', st }); return; }
            if (tutStage.onNext) setSt((cur) => cardTutorialMutate(db, cur, tutStage.onNext));
            setTutI((i) => i + 1);
          };
          // 縦の画面: 自分のモンスターの列の上に重ねて出す(場所を取らない。下のボタンが画面の外へ押し出されていた・2026-10-26 社長の実機)。
          //   窓の文字の上は指の操作を下(自分のモンスター)へ通し、「次へ」だけ押せる。横の画面は右の列に今までどおり並べる
          //   重なりは 45(技を出す子の動き 40 より上・ダメージの数字 50 と大きいカード 55 より下)
          return (
            <div className={wide ? 'contents' : 'pointer-events-none relative z-[45] h-0 shrink-0'}>
            <div data-card-tutor={tutStage.id} className={`${wide ? 'relative mb-1 shrink-0' : 'absolute inset-x-0 bottom-1'} z-[45] mx-2 flex items-start gap-2 rounded-2xl border-2 border-emerald-300/80 bg-slate-950/95 px-2 py-1.5 shadow-lg`}>
              {dra && <img src={assistantFaceImage(dra, 'happy')} alt="ドラ" className="h-[36px] w-[36px] shrink-0 rounded-lg object-cover object-top"/>}
              <div className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-emerald-50" style={JA_WRAP_STYLE}><b className="mr-1 text-[11px] text-emerald-300">ドラ</b>{jaWrap(CARD_TUTORIAL_LINES[tutSay === 'D10' && st.pending && st.pending.evaded ? 'D10b' : tutSay])}{hint && <span data-card-tutor-hint className="mt-0.5 block text-[11px] text-amber-200">{jaWrap(hint)}</span>}</div>
              {showNext && <button type="button" data-card-tutor-next onClick={onNext} className="pointer-events-auto shrink-0 self-center animate-pulse rounded-xl bg-emerald-400 px-3 py-2 text-[13px] font-black text-slate-950 ring-4 ring-emerald-300/70 active:scale-95">次へ</button>}
            </div>
            </div>
          );
  })() : null;
  return (
    <div ref={boardRef} data-mh-screen data-card-battle data-card-mode={mode} data-card-wide={wide ? 'true' : undefined} className="relative isolate flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 50% 45%,#3b2a6b 0%,#1b1438 55%,#0d0a1f 100%)' }}>
      {/* 全体カードが場にあるあいだの背景(盤のいちばん後ろ。別の全体カードが出たら変わり、無くなったら元の紫に戻る) */}
      {st.field && cardOf(db, st.field.no) && (
        <span key={st.field.no} aria-hidden="true" data-card-field-bg={st.field.no} className="mh-card-field-bg pointer-events-none absolute inset-0 -z-10"
          style={CARD_FIELD_BG[st.field.no] ? { background: CARD_FIELD_BG[st.field.no] } : { inset: '-30px', backgroundImage: `url(${CARD_IMG(cardOf(db, st.field.no).img)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px) saturate(1.2) brightness(.4)' }}/>
      )}
      <div data-card-head className={`flex ${compact ? 'min-h-[36px]' : 'min-h-[44px]'} shrink-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 bg-black/35 px-2 py-0.5`}>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* 観戦では出さない(下の「観戦をやめる」と2つ並んでいた。2026-10-27 部長) */}
          {!watch && <button type="button" data-card-quit data-card-replay-exit={replay ? '' : undefined} onClick={() => (replay ? onFinish({ outcome: 'replayExit', st }) : setQuit(true))} className="rounded-lg border border-white/20 px-2 py-1 text-[12px] font-black text-slate-200">{replay ? 'とじる' : tutorial ? '飛ばす' : '投了'}</button>}
          {pvpLive && <CardPvpChat/>}
          {!tutorial && <button type="button" data-card-log-open onClick={() => setLogSheet(true)} className="rounded-lg border border-white/20 px-2 py-1 text-[12px] font-black text-slate-200" aria-label="ターンの記録を見る">記録</button>}
        </div>
        {/* 上の帯(2026-10-26 社長「上のタブが色々切れてる。難易度の表示もほしい」): 対戦中は題を出さず、難易度の札にする(練習試合は「練習」・マルチは持ち時間)。
            右のターンの表示は2行まで折り返し、どの幅でも切らない。
            マルチで左の札(持ち時間・👀 観戦・⚔ 周回)が増えて右に7字ぶんも残らないときは、ターンの表示だけ2段目へ下ろす(社長 2026-10-27「右上が切れてる」)。長い名前は … で縮める */}
        {watch ? <span data-card-watch-badge className={`shrink-0 whitespace-nowrap rounded-md border border-violet-300/60 bg-violet-500/20 px-1.5 py-0.5 ${tiny ? 'text-[10px]' : 'text-[11px]'} font-black text-violet-100`}>観戦{watchEyes ? ` 👀${watchEyes}` : ''}</span>
          : replay ? <span data-card-replay-badge className={`shrink-0 whitespace-nowrap rounded-md border border-sky-300/60 bg-sky-500/20 px-1.5 py-0.5 ${tiny ? 'text-[10px]' : 'text-[11px]'} font-black text-sky-100`}>リプレイ</span>
          : pvp ? <CardPvpStatus clock={pvpClock}/> : <span data-card-level-badge={tutorial ? 'tutorial' : game.level} className={`shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 ${tiny ? 'text-[10px]' : 'text-[11px]'} font-black tracking-wide ${CARD_LEVEL_TONE[tutorial ? 'tutorial' : game.level] || CARD_LEVEL_TONE.easy}`}>{tutorial ? '練習' : (CARD_LEVEL_LABEL[game.level] || '')}</span>}
        <span data-card-head-right className="flex min-w-[7.5em] flex-1 items-center justify-end gap-1.5">
          {/* 裏のクイック∞周回(設計書 5-3)。対戦中は帯もポップアップも出さず、ここに小さく「⚔ ◯周目」だけ。止まったら赤くする */}
          {quickRun && <span data-card-battle-quick-run={quickRun.stopped ? 'stopped' : 'live'} aria-label={quickRun.stopped ? '裏のクイック周回は止まっています' : `裏のクイック周回 ${quickRun.loops}周目`} className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-black ${quickRun.stopped ? 'border-rose-400/70 bg-rose-950/60 text-rose-200' : 'border-fuchsia-300/50 bg-slate-950/60 text-fuchsia-100'}`}>⚔ {quickRun.loops}周目</span>}
          {/* 自分の番は目立つ金色の札、相手の番は落ち着いた色(2026-10-26 ソラシドさん「どっちのターンか分かりにくい」) */}
          <span data-card-head-turn data-card-head-turn-me={headMe ? '1' : undefined} className={`min-w-0 text-right ${tiny ? 'text-[11px]' : 'text-[12px]'} font-bold leading-tight text-violet-200`} style={JA_WRAP_STYLE}>{headSt.phase === 'setup' && replay ? <span className="whitespace-nowrap">はじまり</span> : <><span className="whitespace-nowrap">ターン {Math.max(1, headSt.turn)}</span> ・ <span className={`inline-block max-w-full truncate whitespace-nowrap align-bottom ${headMe ? 'rounded-md bg-amber-300 px-1.5 py-0.5 font-black text-slate-950' : 'text-slate-400'}`}>{headMe ? `${meName}の番` : `${who.name}の番`}</span></>}</span>
        </span>
      </div>
      {/* 横画面(④): 左に「相手の帯〜自分の帯」、右に「案内〜手札〜下のボタン」。縦のときは2つの箱を display:contents にして、今までと同じ縦の並び */}
      <div data-card-wide-row className={wide ? 'flex min-h-0 flex-1 flex-row' : 'contents'}>
      <div data-card-field className={wide ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'contents'}>
      {pvpLive && <CardPvpSignal clock={pvpClock}/>}
      {/* 相手の帯(隠さない) */}
      <div className={`flex ${tiny ? 'h-[36px]' : compact ? 'h-[42px]' : 'h-[50px]'} shrink-0 items-center gap-2 px-2`}>
        {pvp ? <span data-card-pvp-foe className={`block ${tiny ? 'h-[34px] w-[34px]' : 'h-[42px] w-[42px]'} shrink-0`}><CardPvpAvatar icon={pvp.icon} frame={pvp.frame} className="h-full w-full"/></span>
          : <img src={assistantFaceImage(who, face)} alt={who.name} className={`${tiny ? 'h-[34px] w-[34px]' : 'h-[42px] w-[42px]'} rounded-xl border-2 bg-black object-cover object-top`} style={{ borderColor: who.accent }}/>}
        <div className={`min-w-0 text-[13px] font-black leading-tight ${pvp ? 'max-w-[34%] truncate whitespace-nowrap' : 'shrink-0 whitespace-nowrap'}`}>{who.name}<small className="block text-[10px] font-bold text-rose-200">{pvp ? 'マルチ対戦' : CARD_LEVEL_LABEL[game.level] || '助手と対戦'}</small></div>
        <div className="ml-auto">{strip(CARD_CPU)}</div>
      </div>
      {/* リプレイでは相手の手札も表で見せる(終わったあとなので。2026-10-27 社長)。押すと詳しい画面 */}
      {/* 横の画面は右の列の上に出す(左の列に入れると、自分の名前と山札の帯が下へはみ出した。2026-10-27 社長「色々切れてて見れなかった」) */}
      {replay && !wide && replayFoeHand}
      {/* 吹き出し(帯の下・相手のモンスターの上。指の操作は下へ通す) */}
      {/* 相手の番のあいだは、相手の場のふちを赤く光らせる(大きさは変えない。2026-10-26 ソラシドさん) */}
      {/* 場の床: 相手の場は冷たい色・自分の場はあったかい色(境目が分かるように。2026-10-26 社長 OK の改良の案 A・カゲあつくん 10) */}
      <div data-card-side-active={turnLive && !turnMe ? 'foe' : undefined} data-card-floor="foe" className={`flex shrink-0 items-start justify-around rounded-2xl px-1 transition-shadow ${turnLive && !turnMe ? 'shadow-[inset_0_0_0_2px_rgba(251,113,133,.75),0_0_16px_rgba(251,113,133,.35)]' : ''}`} style={{ background: 'linear-gradient(180deg, rgba(30,64,175,0) 0%, rgba(30,64,175,.28) 100%)' }}>
        {opp.mons.map((_, m) => <CardMonSlot key={m} db={db} st={st} p={CARD_CPU} m={m} mark={markOf(CARD_CPU, m)} guardTag={guardTagOf(CARD_CPU, m)} statusLock={(mode === 'attack' || mode === 'guard') && !!sel} onStatus={(sp, sm) => { Audio_.fgSe.tap(); setStatusSheet({ p: sp, m: sm }); }} onPressMon={(sp, sm) => { monPressed.current = { p: sp, m: sm }; }} fx={endFx ? [] : fx.filter((f) => f.p === CARD_CPU && f.m === m)} onTap={() => tapMon(CARD_CPU, m)} press={press} compact={compact} tiny={tiny} wide={wide} calm={settings.shake === 'OFF'} motion={motions[`1-${m}`] || null}/>)}
      </div>
      {/* まんなか: 技の動き(アクション)と、起きたことの記録(ログ)の場所。相手の場と自分の場をここで上下に分ける(社長 2026-10-24)
          ★次の区切りの技ごとの動きも、この data-card-stage の中で見せる */}
      {/* 入り切らないときも上から並べる(safe center)。吹き出しの上が切れないように */}
      <div ref={stageRef} data-card-stage data-card-stage-fit={stageFit} className={`relative flex ${boardFit >= 1 ? 'min-h-[40px]' : 'min-h-[64px]'} flex-1 flex-col items-center justify-center ${wide ? 'gap-1 py-0.5' : 'gap-1.5 py-1'} overflow-hidden px-3`} style={{ justifyContent: 'safe center' }}>
        {/* 案A: 番が替わったときの帯は、盤全体の真ん中へ移した(下の data-card-turn-banner。2026-10-26 ソラシドさん) */}
        {/* 相手の助手の吹き出し。出ているあいだは、まんなかの上に重ねて出す(場を押し下げない。2026-10-26 社長)。押すと次の台詞へ進む(練習試合は指の操作を下へ通す)。
            カードの大写しのあいだは隠す(大写しの両はしから字がはみ出して見えた。見回り2回目の新4。閉じればまた見える)
            番の知らせ(「あなたの番」の大きな札)のあいだも隠す(横画面で札が台詞に重なって読めなかった。2026-10-26 カゲあつくんの見回り。札が消えたら出る)
            顔は台詞の表情(data/assistants.js の8つの表情の顔の絵) */}
        {bubble && !replay && (
          <div key={bubble.key} data-card-bubble data-card-bubble-face={bubble.face || face} data-card-bubble-ms={tutorial ? undefined : cardBubbleMs(bubble.text)} onClick={tutorial ? undefined : nextBubble} data-card-bubble-cut={bubble.cut ? '1' : undefined} className={`${bubbleHidden ? 'invisible ' : ''}${tutorial ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'} ${bubbleInFlow ? 'relative shrink-0' : 'absolute inset-x-2 top-0.5'} z-[8] mx-auto flex items-center gap-1.5 ${bubble.cut
              ? `mh-card-cutin w-full max-w-[calc(100%-16px)] flex-row-reverse rounded-2xl border-[3px] bg-slate-950/95 ${tiny ? 'px-1.5 py-0.5 text-[12px] leading-tight' : 'px-2 py-1 text-[15px] leading-snug'} font-black text-white shadow-[0_6px_18px_rgba(0,0,0,.6)]`
              : `w-fit max-w-[calc(100%-16px)] rounded-2xl border-[3px] bg-white px-1.5 py-0.5 ${compact ? 'text-[12px]' : 'text-[13px]'} font-extrabold leading-snug text-[#1f1333] shadow-lg`}`} style={{ borderColor: who.accent, ...JA_WRAP_STYLE }}>
            {/* マルチの相手は人なので、助手の顔ではなく相手のアイコン(助手の顔の絵を引いて、空の白い枠が出ていた) */}
            {pvp ? <span data-card-bubble-pvp-icon className={`block ${tiny ? 'h-[26px] w-[26px]' : 'h-[32px] w-[32px]'} shrink-0`}><CardPvpAvatar icon={pvp.icon} frame={pvp.frame} className="h-full w-full"/></span>
              : <img src={assistantFaceImage(who, bubble.face || face)} alt="" className={`${bubble.cut ? (tiny || stageFit >= 2 ? 'h-[38px] w-[38px] border-2' : compact ? 'h-[54px] w-[54px] border-[3px]' : 'h-[68px] w-[68px] border-[3px]') + ' border-white bg-black' : tiny ? 'h-[26px] w-[26px]' : 'h-[32px] w-[32px]'} shrink-0 rounded-lg object-cover object-top`}/>}
            <span className="min-w-0 flex-1"><span className={bubble.cut ? 'block text-[11px] tracking-wider' : 'mr-1 text-[11px]'} style={{ color: who.accent }}>{who.name}{bubble.cut ? ' ★' : ''}</span><span style={JA_WRAP_STYLE}>{cardJaWrap(bubble.text)}</span></span>
          </div>
        )}
        {/* まんなかの線とうすい「VS」は、まんなかと同じ大きさの枠に入れる。はみ出した分がまんなかの高さに数えられて、
            低い画面(横 72px)では stageFit がいつも最後まで詰め、技の帯の札が毎回消えていた(2026-10-27 ⑲) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent"/>
          <span data-card-vs-mark className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[56px] font-black italic leading-none text-white/[.06]">VS</span>
        </div>
        {/* ブリーダーのカード: 使った側の助手・ブリーダーの顔を、まんなかの端に光らせて出す(相手は右上・自分は左下。設計書 5-4) */}
        {breederFx && (
          <div key={breederFx.key} data-card-breeder-fx={breederFx.p === CARD_ME ? 'me' : 'foe'} aria-hidden="true"
            className={`mh-card-breeder pointer-events-none absolute z-[3] grid h-[46px] w-[46px] place-items-center overflow-hidden rounded-2xl border-2 bg-black ${breederFx.p === CARD_ME ? 'bottom-1 left-2 border-amber-300' : 'right-2 top-1'}`}
            style={breederFx.p === CARD_ME ? undefined : { borderColor: who.accent }}>
            {breederFx.p === CARD_ME
              ? (meProfile && meProfile.icon ? cardIconNode(meProfile.icon, 34) : <span className="text-[26px]">🧑</span>)
              : pvp ? <CardPvpAvatar icon={pvp.icon} frame={pvp.frame} className="h-full w-full"/> : <img src={assistantFaceImage(who, 'happy')} alt="" className="h-full w-full object-cover object-top"/>}
          </div>
        )}
        {action && !endFx && !turnBanner && stageFit < 3 && !bubbleOverAction && !(turnSummary && sumOpen) && !guardAtk && (   /* 守りを選ぶあいだは、下の攻撃カードの箱1つにまとめる(同じ技を2回出さない) */
          <div key={action.key} data-card-action data-card-action-side={action.side} className={`relative z-[1] flex items-center gap-2 rounded-2xl border-2 bg-black/55 px-2 ${action.side === 'foe' ? 'border-rose-400/80' : 'border-amber-300/70'} ${compact ? "py-0.5" : "py-1"} shadow-lg`}>
            {/* 案A: どちらが使った技か(相手=赤・自分=金) */}
            <span data-card-fit className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-black ${action.side === 'foe' ? 'bg-rose-500 text-white' : 'bg-amber-300 text-slate-950'}`}>{action.side === 'foe' ? (watch ? who.name : '相手') : (watch ? meName : '自分')}</span>
            {!compact && stageFit < 2 && action.cards.slice(0, 3).map((no, i) => { const c = cardOf(db, no); return c ? <img key={i} src={CARD_IMG(c.img)} alt={c.name} className={`${compact ? 'h-[40px] w-[29px]' : 'h-[64px] w-[46px]'} rounded-[4px] object-cover shadow`}/> : null; })}
            {/* 小さい段は1行(だれ「技」)にして、まんなかの高さに収める(2段だと上が切れた。カゲあつくんの確認 2026-10-25)。
                横の画面もまんなかが 72px ほどしかなく、2行だと記録と合わせて入らず札が毎回消えていた(2026-10-27 ⑲)ので1行 */}
            <div className={`${tiny || wide ? 'whitespace-nowrap text-[12px]' : 'text-[13px]'} font-black leading-tight`}>{action.who}<span className={tiny || wide ? 'text-[13px] text-amber-200' : 'block text-[15px] text-amber-200'}>「{action.cards.map((n) => (cardOf(db, n) || {}).name).join('＋')}」</span></div>
          </div>
        )}
        {/* 場の全体カード(両方に効く)。タップで詳しい画面。名前は切らずに折り返す */}
        {st.field && cardOf(db, st.field.no) && (
          <button type="button" data-card-env={st.field.no} data-card-env-side={st.field.p === CARD_ME ? 'me' : 'foe'} onClick={() => setDetail(st.field.no)}
            className="relative z-[1] flex max-w-full items-center gap-1.5 rounded-xl border-2 border-emerald-300/80 bg-emerald-950/80 px-2 py-0.5 text-left active:scale-[.98]">
            <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-400 px-1 py-0.5 text-[10px] font-black text-emerald-950">全体</span>
            <span className="min-w-0 text-[12px] font-black leading-tight text-emerald-50" style={JA_WRAP_STYLE}>{cardOf(db, st.field.no).name}<small className="ml-1 text-[10px] font-bold text-emerald-200">({st.field.p === CARD_ME ? '自分' : '相手'}が出した)</small></span>
          </button>
        )}
        {/* 案C: 相手の番のまとめの1行。押すと開く(開いた窓は下の data-card-turn-summary) */}
        {turnSummary && !sumOpen && !bigCard && (
          <button type="button" key={turnSummary.key} data-card-turn-summary-chip onClick={() => { Audio_.fgSe.tap(); setSumOpen(true); }}
            className="absolute bottom-1 left-1/2 z-[7] flex max-w-[92%] -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-rose-300/70 bg-slate-950/90 px-2.5 py-0.5 text-[11px] font-black text-rose-100 shadow active:scale-95">
            <span className="min-w-0 truncate">{`${who.name}のターンにしたこと(${turnSummary.lines.length})`}</span><span className="shrink-0 text-rose-300">▸ 見る</span>
          </button>
        )}
        {/* 番の帯・カードの大写しが出ているあいだは、記録の字を消す(後ろに透けて読みにくかった・大写しのカードの両はしからはみ出して見えた。QA 7・見回り2回目の新4) */}
        {/* 顔の大きいカットインは、まんなか(横 72px・小さい縦 89px ほど)に記録といっしょには入り切らない(2026-10-27 デッキくん ⑲ 記録の下が 11〜22px 切れる)。
            詰めの段が最後(3)まで行っても入らないときは、カットインのあいだだけ記録を出さない(倒れたことはダウンの帯が知らせる。台詞が消えれば戻る) */}
        {!(stageFit >= 3 && bubbleInFlow) && (
        <div data-card-log className={`relative ${guardAtk ? 'z-[41] bg-slate-950/95' : 'z-[1] bg-black/45'} max-w-full rounded-xl border border-white/15 px-3 py-1 text-center ${compact ? 'text-[13px]' : 'text-[14px]'} font-bold leading-snug ${turnBanner || bigCard || downBand || endFx ? 'invisible' : ''}`} style={JA_WRAP_STYLE}>
          {/* 守りを選ぶあいだは、いま受けている相手の攻撃カード(絵・名前・ダメージ・効果)を出す。押すと詳しい画面(2026-10-26 ソラシドさん) */}
          {pendingText && (guardAtk
            ? <button type="button" data-card-guard-attack={guardAtk.no} {...press(guardAtk.no, () => setDetail(guardAtk.no))} className="flex w-full max-w-[360px] items-center gap-2 text-left active:scale-[.98]">
              {/* まんなかに入り切らないときは、効果の文を1行に → 効果の文を省く → 絵を省く(stageFit。320×568 で下が切れた) */}
              {stageFit < 3 && <img src={CARD_IMG(guardAtk.img)} alt={guardAtk.name} className={`${tiny || stageFit >= 2 ? 'h-[36px]' : 'h-[52px]'} aspect-[5/7] shrink-0 rounded-[4px] object-cover shadow`}/>}
              <span className="min-w-0 flex-1">
                <span className="block text-rose-200">{pendingText}</span>
                {guardAtk.text && stageFit < 2 && <span data-card-guard-attack-text className={`${tiny || stageFit >= 1 ? 'line-clamp-1' : 'line-clamp-2'} block text-[11px] leading-snug text-slate-200`}>{guardAtk.text}</span>}
              </span>
            </button>
            : <div className="text-rose-200">{pendingText}</div>)}
          {pendingText && <CardGuardPreview db={db} pv={guardPv} compact={compact || stageFit >= 1} tight={tiny || stageFit >= 2}/>}
          {(pendingText ? [] : (compact || tutorial || stageFit >= 1) ? logLines.slice(stageFit >= 1 || action || bubble || tutorial ? -1 : -2) : logLines.slice(bubble && action ? -2 : -3)).map((l, i, arr) => <div key={i} data-card-log-kind={l.kind || undefined} className={`${i === arr.length - 1 && !pendingText ? '' : 'text-[11px] text-violet-200'} ${l.kind === 'ko' ? '!text-rose-300 font-black' : l.kind === 'hit' && /ダメージ/.test(l.text) ? '!text-rose-200' : ''}`}>{cardLogText(l)}</div>)}
        </div>
        )}
      </div>
      {/* 自分の番のあいだは、自分の場のふちを金色に光らせる */}
      {/* 練習試合のドラの窓(縦の画面)。自分のモンスターの列の上に、まんなかへ重ねて出す。
          手札のすぐ上だと、自分のモンスターの名前とライフ・自分の帯にかぶった(2026-10-26 カゲあつくんの通しの点検) */}
      {!wide && tutorBox}
      <div data-card-side-active={turnLive && turnMe ? 'me' : undefined} data-card-floor="me" className={`flex shrink-0 items-end justify-around rounded-2xl px-1 transition-shadow ${turnLive && turnMe ? 'shadow-[inset_0_0_0_2px_rgba(252,211,77,.8),0_0_16px_rgba(252,211,77,.35)]' : ''}`} style={{ background: 'linear-gradient(0deg, rgba(180,83,9,0) 0%, rgba(180,83,9,.28) 100%)' }}>
        {me.mons.map((_, m) => <CardMonSlot key={m} db={db} st={st} p={CARD_ME} m={m} mark={markOf(CARD_ME, m)} guardTag={guardTagOf(CARD_ME, m)} statusLock={(mode === 'attack' || mode === 'guard') && !!sel} onStatus={(sp, sm) => { Audio_.fgSe.tap(); setStatusSheet({ p: sp, m: sm }); }} onPressMon={(sp, sm) => { monPressed.current = { p: sp, m: sm }; }} fx={endFx ? [] : fx.filter((f) => f.p === CARD_ME && f.m === m)} onTap={() => tapMon(CARD_ME, m)} press={press} compact={compact} tiny={tiny} wide={wide} calm={settings.shake === 'OFF'} motion={motions[`0-${m}`] || null}/>)}
      </div>
      {/* 自分の帯: 自分のアイコン(プロフィールのアイコン+フレーム。ランキングと同じ部品)と名前を、山札・ガッツ・捨て札の左に
          (2026-10-26 社長「バトル中とかに自分のアイコンとかも出るようにしたいね」)。行の高さは変えない(アイコンは行の高さに縮める)。名前は「…」で切らず字を縮める */}
      <div data-card-me-head className="flex shrink-0 items-center gap-1.5 px-2 py-1">
        <span data-card-me-icon aria-hidden="true" className="relative block h-[22px] w-[22px] shrink-0">
          <span className="absolute left-0 top-0 block h-8 w-8 origin-top-left" style={{ transform: `scale(${22 / 32})` }}>
            {meIcon || <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-[18px]">{meProfile && meProfile.icon ? cardIconNode(meProfile.icon, 22) : '🧑'}</span>}
          </span>
        </span>
        <span className="block min-w-0 flex-1" style={{ containerType: 'inline-size' }}>
          <span data-card-me-name className="block overflow-hidden whitespace-nowrap font-black leading-tight text-white" style={{ fontSize: `clamp(8px, ${(96 / Math.max(1, [...String((meProfile && meProfile.name) || 'あなた')].length)).toFixed(1)}cqw, 12px)` }}>{(meProfile && meProfile.name) || 'あなた'}</span>
        </span>
        {strip(CARD_ME)}
      </div>
      </div>
      <div data-card-side className={wide ? 'flex min-h-0 w-[42%] max-w-[420px] shrink-0 flex-col justify-end overflow-y-auto border-l border-white/10 bg-black/20' : 'contents'}>
        {/* 練習試合: ドラの説明の窓(横の画面)。右の列の手札のすぐ上に、中身の高さぶん場所を取って出す。縦の画面は自分のモンスターの列の上(tutorBox) */}
      {wide && tutorBox}
      {wide && replayFoeHand}
      {/* 練習試合で、いまタップ(か運ぶ)カードの上に出す案内 */}
      {tutorial && tutFocus.hand.length > 0 && <div data-card-tutor-arrow className="mx-auto mb-1 shrink-0 animate-bounce rounded-lg bg-emerald-300 px-2 py-0.5 text-[12px] font-black text-slate-900" style={JA_LABEL_STYLE}>👇 {jaWrap(mode === 'guts' ? 'タップでガッツに(ガッツへ運んでもOK)' : mode === 'guard' ? 'タップで守る(狙われた子へ運んでもOK)' : 'タップ → 相手をタップ(相手へ運んでもOK)')}</div>}
      {/* 守れるカードが無いときは、下の理由の1行だけにする(「使える回避・防御はありません」と2回言っていた。2026-10-27 カゲあつくん) */}
      {guide && !tutorial && !(mode === 'guard' && !guardOpts.length && !hint) && <div className="mx-auto mb-1 shrink-0 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900" style={JA_LABEL_STYLE}>{jaWrap(hint || guide)}</div>}
      {/* 練習試合で回避を選んだあと(あとは「これで守る」で決めるだけ)。前は「手札に回避・防御のカードがありません」と出て、次に押す所が分かりにくかった(2026-10-26 巡回 → 社長が文をOK) */}
      {mode === 'guard' && tutorial && st.pending && st.pending.evaded && <div data-card-tutor-guard-done className="mx-auto mb-1 shrink-0 rounded-lg bg-emerald-300 px-2 py-0.5 text-[12px] font-black text-slate-900" style={JA_LABEL_STYLE}>{jaWrap('「これで守る」を押してください')}</div>}
      {mode === 'guard' && !guardOpts.length && !(tutorial && st.pending && st.pending.evaded) && (
        <div data-card-guard-why className={`mx-auto mb-1 max-w-[94%] shrink-0 text-center ${tiny ? 'truncate whitespace-nowrap text-[10px]' : 'text-[11px]'} font-bold leading-snug text-slate-300`} style={tiny ? undefined : JA_WRAP_STYLE}>{cardGuardBlockReasons(db, st).join(' / ')}</div>
      )}
      {!guide && !tutorial && hint && <div className="mx-auto mb-1 shrink-0 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900" style={JA_LABEL_STYLE}>{jaWrap(hint)}</div>}
      {mode === 'attack' && sel && monChosen !== undefined && sets.length > 1 && (
        <div className="mb-1 flex shrink-0 flex-wrap justify-center gap-1 px-2">
          {/* 押した札は省いて、付ける札だけを「＋◯◯」で出す。少ない組から並べ、1行に収める(320×568 で2行に折れて「使う」が画面の下で切れた。2026-10-28 案C) */}
          {sets.slice().reverse().map((s) => <button key={s} type="button" data-card-set={s} onClick={() => setSel({ ...sel, mon: monChosen, set: s })} className={`whitespace-nowrap rounded-lg border font-black ${tiny ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-[12px]'} ${s === setChosen ? 'border-amber-300 bg-amber-500/25' : 'border-white/20 bg-slate-800'}`}>{JSON.parse(s).filter((i) => i !== sel.hand).length ? JSON.parse(s).filter((i) => i !== sel.hand).map((i) => `＋${cardOf(db, me.hand[i]).name}`).join('') : `${cardOf(db, me.hand[sel.hand]).name}だけ`}</button>)}
        </div>
      )}
      {/* 選んだ手札は上へ少し持ち上がる。その分の高さ(pt-2)を手札の箱の中に取っておき、上の案内の帯に重ならないようにする(2026-10-24 改善部の点検 V3) */}
      {/* 相手の番で、自分が守る場面でないあいだは、手札を少し暗くする(2026-10-26 ソラシドさん) */}
      {/* 観戦: 下の人の手札も裏の札で、枚数だけ(中身は観戦の知らせに流れない) */}
      {watch ? (
        <div data-card-hand data-card-watch-hand={CARD_ME} className="flex shrink-0 items-center justify-center gap-2 px-1 pb-1 pt-1" aria-label={`手札${me.hand.length}枚`}>
          <div className="flex -space-x-4">{me.hand.slice(0, 8).map((_, i) => <img key={i} src={CARD_BACK_IMG()} alt="" className={`${tiny || boardFit >= 2 ? (boardFit >= 3 ? 'h-[28px] w-[20px]' : 'h-[40px] w-[28px]') : 'h-[56px] w-[40px]'} rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,.35)]`}/>)}</div>
          <span className="text-[11px] font-bold text-slate-300">手札 {me.hand.length}枚</span>
        </div>
      ) : (<>
      <div data-card-hand data-card-hand-dim={mode === 'wait' ? '1' : undefined} data-card-board-fit={boardFit || undefined} className={`flex shrink-0 items-end justify-center gap-1 px-1 pb-1 ${boardFit >= 2 ? 'pt-1' : 'pt-2'} transition-[opacity,filter] ${mode === 'wait' ? 'opacity-60 saturate-[.6]' : ''}`}>
        {handOrder.map((i) => {
          const no = me.hand[i];
          const c = cardOf(db, no);
          const on = handUsable(i);
          const up = (sel && sel.hand === i) || picks.includes(i) || (setChosen && JSON.parse(setChosen).includes(i));
          return (
            <div key={`${no}-${i}`} data-card-hand-card={i} data-card-press onPointerDown={(e) => handDown(e, i, no)} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} className={`flex w-[19%] ${wide ? 'max-w-[72px]' : handTiny ? (boardFit >= 2 ? 'max-w-[42px]' : 'max-w-[50px]') : compact ? 'max-w-[58px]' : 'max-w-[76px]'} flex-col items-center transition-transform ${replay && boardFit >= 4 ? '!max-w-[38px]' : ''} ${up ? '-translate-y-2' : ''} ${myTurn && !on && !tutorial ? 'opacity-45' : ''} ${tutorial && myTurn && !tutFocus.hand.includes(i) && !picks.includes(i) && !(sel && sel.hand === i) ? 'opacity-40' : ''} ${tutorial && tutFocus.hand.includes(i) ? 'animate-pulse rounded-[7px] ring-4 ring-emerald-300' : ''} ${drag && drag.i === i ? 'opacity-30' : ''}`} data-card-tutor-focus={tutorial && tutFocus.hand.includes(i) ? true : undefined}>
              <img src={CARD_IMG(c ? c.img : no)} alt={c ? c.name : no} draggable={false} style={{ WebkitUserDrag: 'none' }} className={`w-full rounded-[5px] shadow-[0_3px_6px_#000] ${up ? 'outline outline-[3px] outline-amber-300' : ''}`}/>
              {/* 小さい段(tiny)は名前が2行になることがあるので、字の行間と上下の余白を詰めて、下のボタンを画面に残す(320×568 の守りの番) */}
              {!(replay && boardFit >= 3) && <div className={`mt-0.5 w-full rounded-md bg-black/60 ${handTiny ? 'py-px' : 'py-0.5'} text-center leading-tight`}>
                <CardNameFit name={c ? c.name : no} size={handLarge ? (compact ? 12 : 13) : compact ? 10 : 11} className="font-bold leading-tight" twoLine/>
                {handTiny ? <>
                  <CardNameFit name={`ガッツ${c ? c.guts : '-'}`} size={10} className="font-extrabold leading-[1.1] text-amber-200"/>
                  <CardNameFit name={cardCaption(c)} size={10} className="font-extrabold leading-[1.1] text-amber-200"/>
                </> : compact ? <>
                  <span className={`block ${handLarge ? 'text-[12px]' : 'text-[10px]'} font-extrabold leading-tight text-amber-200`}>ガッツ{c ? c.guts : '-'}</span>
                  <span className={`block whitespace-nowrap ${handLarge ? 'text-[12px]' : 'text-[10px]'} font-extrabold leading-tight text-amber-200`}>{cardCaption(c)}</span>
                </> : <>
                  <span className={`block ${handLarge ? 'text-[13px]' : 'text-[11px]'} font-extrabold text-amber-200`}>ガッツ{c ? c.guts : '-'}</span>
                  <span className={`block ${handLarge ? 'text-[13px]' : 'text-[11px]'} font-extrabold text-amber-200`}>{cardCaption(c)}</span>
                </>}
              </div>}
            </div>
          );
        })}
      </div>
      </>)}
      {/* 画面の下の安全域(ホームバーの所)は、体(body)がもう余白に取っている。ここでも取ると二重になり、
          下の帯が高くなっていた(2026-10-26 統括部長「下のボタンが少し切れる」)。ここは 8px だけ。入り切らないときの詰め方は boardFit */}
      <div data-card-footer className="flex shrink-0 gap-2 px-2.5 pb-2 pt-1">
        {replay ? <CardReplayBar replay={replay} at={replayAt} onSeek={replaySeek} tight={boardFit >= 1}/> : footer}
      </div>
      </div>
      </div>
      {drag && drag.active && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal(
        <div data-drag-card-layer className="pointer-events-none fixed inset-0" style={{ zIndex: MODAL_Z.dialog - 1 }}>
          <img ref={ghostRef} data-dragging-card src={CARD_IMG((cardOf(db, drag.no) || {}).img || drag.no)} alt="" className="fixed w-[76px] -translate-x-1/2 -translate-y-[70%] rotate-[-4deg] rounded-[5px] shadow-[0_8px_18px_rgba(0,0,0,.7)]" style={{ left: drag.x, top: drag.y }}/>
        </div>, document.body)}
      {/* はね返した光線(画面の位置で引く。運ぶカードと同じく body の上に出す) */}
      {beams.length > 0 && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal(
        <div data-card-beam-layer className="pointer-events-none fixed inset-0" style={{ zIndex: MODAL_Z.dialog - 2 }}>
          {beams.map((b) => <span key={b.key} data-card-beam className="mh-card-beam" style={{ left: b.x, top: b.y, width: b.len, transform: `rotate(${b.deg}deg)` }}/>)}
        </div>, document.body)}
      {/* ガッツになったカードが飛ぶ動き(body の上に出す。指の操作は通す) */}
      {gutsFly.length > 0 && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal(
        <div data-card-guts-fly-layer className="pointer-events-none fixed inset-0" style={{ zIndex: MODAL_Z.dialog - 3 }}>
          {gutsFly.map((g) => <CardGutsFlight key={g.key} g={g} still={settings.motion === 'OFF'}/>)}
        </div>, document.body)}
      {detail && (() => { const pm = monPressed.current; const mn = pm && st.players[pm.p] && st.players[pm.p].mons[pm.m]; const ok = !!(mn && mn.no === detail); return <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)} status={ok ? cardMonStatuses(st, pm.p, pm.m) : null} statusName={ok ? mn.name : ''}/>; })()}
      {statusSheet && st.players[statusSheet.p] && st.players[statusSheet.p].mons[statusSheet.m] && <CardStatusSheet name={st.players[statusSheet.p].mons[statusSheet.m].name} list={cardMonStatuses(st, statusSheet.p, statusSheet.m)} onClose={() => setStatusSheet(null)}/>}
      {/* 案B: 出すカードを、効果の前にまんなかに大きく見せる(敵も味方も)。出ているあいだは画面のどこをタップしても先へ進む */}
      {bigCard && (
        <div key={`${bigCard.key}-tap`} data-card-big-skip role="button" aria-label="先へ進む" onClick={finishBig} className="absolute inset-0 z-[54]"/>
      )}
      {bigCard && (
        <div key={bigCard.key} data-card-big={bigCard.side} onClick={finishBig} className="mh-card-big absolute inset-x-0 top-1/2 z-[55] flex -translate-y-1/2 flex-col items-center gap-1.5 px-4">
          <div className="flex items-end justify-center gap-1.5">
            {bigCard.cards.map((no, i) => { const c = cardOf(db, no); return c ? <img key={i} src={CARD_IMG(c.img, 'l')} alt={c.name} className={`rounded-[8px] border-[3px] ${bigCard.side === 'me' ? 'border-amber-300' : 'border-rose-400'} object-cover shadow-[0_8px_24px_rgba(0,0,0,.7)]`} style={{ height: `min(${bigCard.cards.length > 1 ? 30 : 38}vh, 300px)`, aspectRatio: '5 / 7' }}/> : null; })}
          </div>
          <div data-card-fit className="max-w-full rounded-xl border border-rose-300/60 bg-black/80 px-3 py-1 text-center text-[14px] font-black leading-snug text-white" style={JA_WRAP_STYLE}>
            {!watch && <span className={`mr-1 rounded px-1 text-[11px] ${bigCard.side === 'me' ? 'bg-amber-300 text-slate-950' : 'bg-rose-500'}`}>{bigCard.side === 'me' ? '自分' : '相手'}</span>}{bigCard.who}「{bigCard.cards.map((n) => (cardOf(db, n) || {}).name).join('＋')}」
          </div>
          {/* 全体カードは、場に残って両方に効くので、効き目も出す(改良の案 D) */}
          {bigCard.cards.length === 1 && (cardOf(db, bigCard.cards[0]) || {}).kind === 'fld' && (
            <div data-card-big-field className="max-w-[92%] rounded-xl border border-emerald-300/60 bg-emerald-950/90 px-3 py-1 text-center text-[12px] font-bold leading-snug text-emerald-50" style={JA_WRAP_STYLE}>
              <span className="mr-1 rounded bg-emerald-400 px-1 text-[10px] font-black text-emerald-950">全体カード</span>{jaWrap(cardOf(db, bigCard.cards[0]).text || '')}
            </div>
          )}
        </div>
      )}
      {/* 案C: 自分の番の始めに、相手のターンにしたこと(タップで閉じる・カードを選ぶと閉じる) */}
      {/* 番が替わったとき、盤全体の真ん中に大きく「あなたの番」「◯◯の番」(0.8秒ほど・字の札をタップでも消える。大写しが出ているあいだは出さない)。
          2026-10-26 ソラシドさん「どっちのターンか分かりにくい」。指の操作は札の外では下へ通す(すぐ手札を選べる) */}
      {/* 勝った・負けた瞬間(改良の案 C・カゲあつくん 1)。勝ちは光の筋と紙ふぶき、負けはやさしく。タップで結果へ */}
      {/* 観戦の決着(2026-10-27 社長「観戦だと投了したら終わったのがわからない」)。だれがどう負けて、だれが勝ったかを名前で。押すと消える */}
      {watch && (watchEnd || st.winner !== null) && !watchEndHide && (() => {
        const w0 = watchEnd ? watchEnd.winner : st.winner;
        const head = watchEnd && watchEnd.head ? watchEnd.head : w0 === null || w0 === undefined ? '対戦が終わりました' : `${w0 === CARD_ME ? meName : who.name}さんの勝ち！`;
        const sub = watchEnd && watchEnd.sub ? watchEnd.sub : '決着がつきました';
        return (
          <div data-card-watch-over={w0 === null || w0 === undefined ? 'none' : w0} data-card-watch-over-how={(watchEnd && watchEnd.how) || ''} role="button" aria-label="決着の帯を閉じる" onClick={() => setWatchEndHide(true)}
            className="mh-card-end absolute inset-0 z-[58] flex cursor-pointer flex-col items-center justify-center bg-slate-950/70 px-4">
            <span className="text-[11px] font-black tracking-widest text-amber-200/80">決着</span>
            <span data-card-watch-over-sub className="mt-1 text-center text-[15px] font-black text-white" style={JA_WRAP_STYLE}>{jaWrap(sub)}</span>
            <b data-card-watch-over-head className="mt-1 block text-center text-[28px] font-black leading-tight text-amber-200 [text-shadow:0_3px_0_#7c2d12]" style={JA_WRAP_STYLE}>{jaWrap(head)}</b>
            <span className="absolute bottom-5 text-[12px] font-bold text-white/70">タップで盤面を見る</span>
          </div>
        );
      })()}
      {endFx && (
        <div data-card-end-fx={st.winner === CARD_ME ? 'win' : 'lose'} role="button" aria-label="結果へ進む" onClick={() => { if (endNow.current) endNow.current(); }}
          className={`mh-card-end absolute inset-0 z-[58] flex cursor-pointer flex-col items-center justify-center overflow-hidden ${st.winner === CARD_ME ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(120,53,15,.35),rgba(2,6,23,.78))]' : 'bg-slate-900/70'}`}>
          {st.winner === CARD_ME && <span aria-hidden="true" className="mh-card-end-rays pointer-events-none absolute left-1/2 top-[44%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"/>}
          {st.winner === CARD_ME && <CardConfetti/>}
          <b data-card-end-title className={`mh-card-end-title relative block font-black italic leading-none ${st.winner === CARD_ME ? 'text-amber-200 [-webkit-text-stroke:2px_#7c2d12] [text-shadow:0_6px_0_#7c2d12,0_0_40px_rgba(251,191,36,.9)]' : 'text-slate-300 [text-shadow:0_4px_0_#0f172a]'}`}
            style={{ fontSize: st.winner === CARD_ME ? 'clamp(64px, 22vw, 96px)' : 'clamp(44px, 15vw, 64px)' }}>{st.winner === CARD_ME ? 'WIN!' : 'LOSE'}</b>
          <span className={`relative mt-2 rounded-xl bg-slate-950/70 px-4 py-1 text-center text-[15px] font-black [text-shadow:0_2px_4px_rgba(0,0,0,.8)] ${st.winner === CARD_ME ? 'text-white' : 'text-slate-300'}`} style={JA_LABEL_STYLE}>{st.winner === CARD_ME ? `${who.name}に勝った！` : 'おしかった！ もう一回いってみよう'}</span>
          <span className="absolute bottom-5 text-[12px] font-bold text-white/70">タップで次へ</span>
        </div>
      )}
      {/* 倒れたときの帯(改良の案 B・カゲあつくん 4・9)。番の帯より下・指の操作は帯の外では下へ通す。
          出ているあいだは、まんなかの記録の字を消す(倒れたときの説明の文の上に帯の字が重なって読めなかった。2026-10-27 ソランドくん)。帯が消えると記録が見える */}
      {downBand && !bigCard && !turnBanner && (
        <div key={downBand.key} data-card-down-band={downBand.p === CARD_ME ? 'me' : 'foe'} className="pointer-events-none absolute inset-0 z-[52] flex items-center justify-center"
          style={wide ? { right: 'calc(min(42%, 420px) + 8px)' } : undefined}>
          <button type="button" data-card-fit onClick={() => setDownBand(null)}
            className="mh-card-down-band pointer-events-auto flex w-full flex-col items-center bg-[linear-gradient(90deg,transparent,rgba(185,28,28,.95)_15%,rgba(185,28,28,.95)_85%,transparent)] py-1.5 text-white">
            <span data-card-down-name className="max-w-full px-4 font-black leading-tight tracking-wide" style={{ fontSize: 'clamp(20px, 6.5vw, 28px)', ...JA_LABEL_STYLE }}>{downBand.names.join('・')} ダウン！</span>
            <span className="text-[12px] font-bold tracking-wider text-rose-100">{watch ? `${downBand.p === CARD_ME ? meName : who.name}さん` : downBand.p === CARD_ME ? 'あなた' : '相手'}のモンスター 残り{downBand.left}体</span>
          </button>
        </div>
      )}
      {/* 練習試合でドラの窓が出ているあいだは、番の札を出さない(縦の画面は窓が真ん中寄りにあり、札が窓と「次へ」に重なった) */}
      {turnBanner && !bigCard && !(tutorial && tutSay) && (
        <div key={turnBanner.key} data-card-turn-banner={turnBanner.me ? 'me' : 'foe'} aria-live="polite" className="pointer-events-none absolute inset-0 z-[53] flex items-center justify-center"
          // 横の画面も画面全体(ふちの光りが盤と手札の境で切れて見えた。2026-10-27 ソランドくん)。練習試合はドラの窓が出ているあいだ札を出さないので、「次へ」にはかからない
          >
          {/* 画面のふちを光らせる(自分=金・相手=青)。相手の番は全体を少し暗く */}
          <span aria-hidden="true" data-card-turn-edge className={`mh-card-turn-edge absolute inset-0 ${turnBanner.me ? 'shadow-[inset_0_0_0_3px_rgba(252,211,77,.9),inset_0_0_40px_rgba(251,191,36,.55)]' : 'bg-slate-950/30 shadow-[inset_0_0_0_3px_rgba(96,165,250,.8),inset_0_0_40px_rgba(59,130,246,.45)]'}`}/>
          {/* 横いっぱいの帯が左からさっと入って、右へ抜ける(2026-10-26 社長 OK の改良の案 A・カゲあつくん 3)。帯をタップで消える */}
          <button type="button" data-card-fit onClick={() => setTurnBanner(null)}
            className={`mh-card-turn-sweep pointer-events-auto relative flex w-full flex-col items-center py-2 text-white ${turnBanner.me ? 'bg-[linear-gradient(90deg,rgba(251,191,36,0),rgba(251,191,36,.96)_12%,rgba(234,88,12,.96)_88%,rgba(234,88,12,0))] shadow-[0_0_30px_rgba(251,191,36,.6)]' : 'bg-[linear-gradient(90deg,rgba(30,64,175,0),rgba(30,64,175,.96)_12%,rgba(190,18,60,.96)_88%,rgba(190,18,60,0))] shadow-[0_0_30px_rgba(96,165,250,.5)]'}`}>
            <span aria-hidden="true" className="text-[11px] font-black tracking-[.4em] text-white/85">{watch ? 'TURN' : turnBanner.me ? 'YOUR TURN' : 'ENEMY TURN'}</span>
            <span data-card-turn-name className="max-w-full px-4 font-black leading-tight tracking-wider [text-shadow:0_3px_0_rgba(0,0,0,.35)]" style={{ fontSize: 'clamp(24px, 8vw, 36px)', ...JA_LABEL_STYLE }}>{turnBanner.me && !watch ? 'あなたのターン' : `${turnBanner.name}のターン`}</span>
          </button>
        </div>
      )}
      {turnSummary && sumOpen && !bigCard && (
        <button type="button" key={turnSummary.key} data-card-turn-summary onClick={() => setTurnSummary(null)}
          // 横の画面は、左の盤のまんなかへ小さく出す(右の手札にかからない。もとは盤の上の段と案内に大きく重なった。QA 2)
          className={`mh-card-big absolute z-[54] overflow-y-auto rounded-2xl border-2 border-rose-300/80 bg-slate-950/95 text-left shadow-2xl ${wide ? 'left-2 top-[34%] max-h-[42%] p-2' : 'inset-x-3 top-[18%] mx-auto max-h-[56%] max-w-md p-3'}`}
          style={wide ? { right: 'calc(min(42%, 420px) + 8px)' } : undefined}>
          <div data-card-fit className="text-[14px] font-black text-rose-200" style={JA_WRAP_STYLE}>{jaWrap(`${who.name}のターンにしたこと`)}</div>
          <ol className="mt-1 space-y-0.5">{turnSummary.lines.map((t, i) => <li key={i} data-card-fit className="text-[13px] font-bold leading-snug text-white" style={JA_WRAP_STYLE}>{i + 1}. {jaWrap(t)}</li>)}</ol>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-400">タップで閉じる</span>
            <span role="button" data-card-log-open onClick={(e) => { e.stopPropagation(); setTurnSummary(null); setLogSheet(true); }} className="whitespace-nowrap rounded-lg bg-violet-700 px-2.5 py-1 text-[12px] font-black text-white">記録を見る</span>
          </div>
        </button>
      )}
      {logSheet && <CardTurnLogSheet st={st} meName="あなた" foeName={who.name} onClose={() => setLogSheet(false)}/>}
      {discard && <CardDiscardModal db={db} st={st} initial={discard.tab} onDetail={(no) => setDetail(no)} onClose={() => setDiscard(null)}/>}
      {bindAsk && (
        <div data-card-bind-pick className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3" onClick={bindCancel}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-3 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-black" style={JA_LABEL_STYLE}>{jaWrap('影縛り: 使えなくする守りのカードを選ぶ')}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('同じ名前のカードは全部、この技に使えなくなります。赤いのは、狙った子が使える守りです')}</div>
            <div className="mt-2 grid max-h-[50vh] grid-cols-2 gap-1.5 overflow-y-auto">
              {(() => {
                // 狙った子が使える守りを先に(光らせる)。ほかの名前もそのあとに並べる(名指しはどの守りの名前でもよい)
                const tm = bindAsk.target ? st.players[bindAsk.target.p].mons[bindAsk.target.m] : null;
                const can = new Set(Object.values(db.cards).filter((c) => c.ready && cardIsGuardKind(c.kind) && tm && cardUsableBy(c, tm)).map((c) => c.name));
                const all = cardBindNames(db);
                return [...all.filter((x) => can.has(x)), ...all.filter((x) => !can.has(x))].map((name) => ({ name, can: can.has(name) }));
              })().map(({ name, can }) => (
                <button key={name} type="button" data-card-bind-name={name} data-card-bind-usable={can ? '1' : '0'} className={`min-h-[40px] rounded-xl px-2 text-[13px] font-black text-white active:scale-95 ${can ? 'bg-rose-700 ring-1 ring-rose-300' : 'bg-slate-700'}`}
                  onClick={() => { const o = { ...bindAsk, bind: name }; setBindAsk(null); askUse(o); }}>{name}</button>
              ))}
            </div>
            <button type="button" className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-800 text-[13px] font-black text-slate-200" onClick={bindCancel}>やめる</button>
          </div>
        </div>
      )}
      {tossAsk && (() => {
        const base = tossAsk.base;
        const main = cardOf(db, me.hand[base.hand[0]]);
        const n = tossAsk.picks.length;
        const want = JSON.stringify(tossAsk.picks.slice().sort((a, b) => a - b));
        const pick = cardAttackOptions(db, st).find((x) => x.mon === base.mon && JSON.stringify(x.hand) === JSON.stringify(base.hand) && JSON.stringify(x.target) === JSON.stringify(base.target) && JSON.stringify(x.toss) === want);
        const toggle = (i) => setTossAsk((cur) => (cur ? { ...cur, picks: cur.picks.includes(i) ? cur.picks.filter((x) => x !== i) : [...cur.picks, i] } : cur));
        return (
          <div data-card-toss-pick className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3" onClick={() => setTossAsk(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-3 text-slate-100" onClick={(e) => e.stopPropagation()}>
              <div className="text-[15px] font-black" style={JA_LABEL_STYLE}>{jaWrap(`「${main ? main.name : ''}」で捨てる手札を選ぶ`)}</div>
              <p className="mt-1 text-[12px] font-bold leading-snug text-amber-200" style={JA_WRAP_STYLE}>{jaWrap('捨てた枚数だけ、ダメージが増えます(0枚でも使えます)')}</p>
              <div className="mt-2 grid max-h-[50vh] gap-1.5 overflow-y-auto">
                {handOrder.filter((i) => !base.hand.includes(i)).map((i) => {
                  const c = cardOf(db, me.hand[i]);
                  const on = tossAsk.picks.includes(i);
                  return (
                    <button key={i} type="button" data-card-toss={i} aria-pressed={on} onClick={() => toggle(i)}
                      className={`min-h-[44px] rounded-xl px-2 text-left text-[14px] font-black active:scale-[.98] ${on ? 'bg-rose-600 text-white ring-2 ring-rose-300' : 'bg-slate-700 text-white'}`} style={JA_WRAP_STYLE}>
                      {on ? '✓ ' : ''}{c ? c.name : '?'}
                    </button>
                  );
                })}
              </div>
              <button type="button" data-card-toss-go disabled={!pick} className="mt-2 min-h-[44px] w-full rounded-xl text-[14px] font-black mh-button-primary disabled:opacity-40"
                onClick={() => { setTossAsk(null); if (pick) askUse(pick, true); }}>{n ? `${n}枚捨てて使う(ダメージ+${n})` : '捨てずに使う'}</button>
              <button type="button" className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-800 text-[13px] font-black text-slate-200" onClick={() => setTossAsk(null)}>やめる</button>
            </div>
          </div>
        );
      })()}
      {splitAsk && (
        <div data-card-split-pick className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3" onClick={() => setSplitAsk(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-3 text-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-black" style={JA_LABEL_STYLE}>{jaWrap(splitAsk.some((o) => o.fuse) ? '合体する2体を選ぶ(左がメイン・右がサブ)' : 'ダメージの割り振りを選ぶ')}</div>
            <div className="mt-2 grid max-h-[55vh] gap-1.5 overflow-y-auto">
              {splitAsk.map((o) => (
                <button key={JSON.stringify(o.split || o.fuse)} type="button" data-card-split={o.split ? o.split.join('-') : `${o.fuse.a}-${o.fuse.b}`} onClick={() => { setSplitAsk(null); askUse(o); }}
                  className="min-h-[44px] rounded-xl bg-slate-700 px-2 text-left text-[14px] font-black text-white active:scale-[.98]">
                  {o.fuse ? `${me.mons[o.fuse.a].name}＋${me.mons[o.fuse.b].name} → ${(cardMonsterOf(db, o.fuse.no) || {}).name || ''}` : o.split.map((x, j) => (x > 0 ? `${st.players[CARD_CPU].mons[j].name} ${x}` : null)).filter(Boolean).join('・')}
                </button>
              ))}
            </div>
            <button type="button" className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-800 text-[13px] font-black text-slate-200" onClick={() => setSplitAsk(null)}>やめる</button>
          </div>
        </div>
      )}
      {mode === 'pray' && prayUse && !bigCard && (() => {
        const fc = cardOf(db, st.pendingPray.no);
        return (
          <div data-card-pray className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-3 text-slate-100">
              <div className="text-[15px] font-black" style={JA_LABEL_STYLE}>{jaWrap(`相手が全体カード「${fc ? fc.name : ''}」を出しました`)}</div>
              {fc && <button type="button" onClick={() => setDetail(fc.no)} className="mt-1 block w-full rounded-xl bg-slate-800 px-2 py-1.5 text-left text-[12px] font-bold leading-snug text-slate-200" style={JA_WRAP_STYLE}>{fc.text}</button>}
              <p className="mt-2 text-[12px] font-bold leading-snug text-amber-200" style={JA_WRAP_STYLE}>{jaWrap('「おいのり」を使うと、この全体カードは効かずに捨て札へ行きます')}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" data-card-pray-use onClick={() => step(prayUse)} className="mh-button mh-button-primary min-h-[48px] rounded-xl text-[14px] font-black">おいのりを使う</button>
                <button type="button" data-card-pray-pass onClick={() => step({ type: 'pray' })} className="mh-button min-h-[48px] rounded-xl border border-white/20 bg-slate-800 text-[14px] font-black">使わない</button>
              </div>
            </div>
          </div>
        );
      })()}
      {choice && (
        <div data-card-choose className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-3 text-slate-100">
            <div className="text-[15px] font-black" style={JA_LABEL_STYLE}>{jaWrap(`${choice.from ? `${choice.from}: ` : ''}${choice.title}`)}</div>
            <div className="mt-2 grid max-h-[55vh] gap-1.5 overflow-y-auto">
              {choice.items.map(({ i, no, c }) => (
                <button key={`${i}-${no}`} type="button" data-card-choose-item={i} onClick={() => step({ type: 'choose', pick: i })}
                  className="flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-700 px-2 py-1.5 text-left active:scale-[.98]">
                  <span className="shrink-0 rounded-md bg-indigo-900 px-1.5 py-0.5 text-[11px] font-black">{c ? CARD_KIND_LABEL[c.kind] : '？'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-black text-white">{c ? c.name : 'カード'}</span>
                    {c && <span className="block text-[11px] font-bold text-slate-300">{`ガッツ${c.guts}${c.damage !== null && c.damage !== undefined ? `・ダメージ${c.damage}` : ''}`}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {confirm && <ConfirmSheet title={confirm.label} message={confirm.kind === 'use' ? 'オプションで確かめないようにもできます' : ''} confirmLabel={confirm.kind === 'use' ? '使う' : '終わる'} onCancel={() => setConfirm(null)} onConfirm={confirmYes}/>}
      {quit && !tutorial && <ConfirmSheet title="投了しますか？" message={pvp ? '投了すると負けになります' : '投了すると負けになります(ビートPとクイック周回は、倒した相手のモンスターの数に応じて少しだけ)'} confirmLabel="投了する" danger onCancel={() => setQuit(false)} onConfirm={() => { setQuit(false); finished.current = true; if (pvp) CARD_PVP.surrender(); onFinish({ outcome: 'surrender', st }); }}/>}
      {quit && tutorial && <ConfirmSheet title="チュートリアルを飛ばしますか？" message={'ルールの画面からいつでもできます'} confirmLabel="飛ばす" onCancel={() => setQuit(false)} onConfirm={() => { setQuit(false); finished.current = true; onFinish({ outcome: 'tutorialSkip', st }); }}/>}
    </div>
  );
};

// ---- トップ・スターター選び・相手えらび・結果 ----
// 助手の全身絵を、描かれている所(透明でない所)の範囲で枠に合わせて出す。足元を枠の下・まんなかにそろえる
//   ★絵によって周りの透明な余白がちがい(着替えの絵など)、object-contain のままだと小さく左下に出る子がいた(2026-10-24 カゲあつくん)
const CARD_ART_BOX_CACHE = {};
const cardArtBox = (src) => new Promise((resolve) => {
  if (CARD_ART_BOX_CACHE[src]) { resolve(CARD_ART_BOX_CACHE[src]); return; }
  const img = new Image();
  img.onload = () => {
    try {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const k = Math.min(1, 256 / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data;
      // 列・行ごとに透明でない点を数え、3点以上ある所だけを範囲にする(絵の端にぽつんと残った点で範囲が広がらないように)
      const col = new Array(w).fill(0), row = new Array(h).fill(0);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { col[x] += 1; row[y] += 1; }
      const MIN = 3;
      let x0 = col.findIndex((n) => n >= MIN), y0 = row.findIndex((n) => n >= MIN);
      let x1 = w - 1 - [...col].reverse().findIndex((n) => n >= MIN), y1 = h - 1 - [...row].reverse().findIndex((n) => n >= MIN);
      if (x0 < 0 || y0 < 0) { x1 = -1; }
      const box = x1 < 0 ? { nw, nh, x: 0, y: 0, w: nw, h: nh } : { nw, nh, x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
      CARD_ART_BOX_CACHE[src] = box; resolve(box);
    } catch (_) { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = src;
});
// 測ってある立ち絵の輪郭(透明な余白を除いた範囲)。canvas で調べられない端末でも枠に合わせるため(2026-10-26 社長「みゅあだけ小さい」)。
//   キーは `${imagePrefix}_${表情}`、値は [絵の幅, 絵の高さ, x, y, 幅, 高さ]。標準の服の絵だけ(着替えの絵には当てない)。
//   絵の大きさ(はじめの2つ)が実際の絵と合うときだけ使う。表は tools/card/card-art-box-build.js が測って書く(cardArtBox と同じ決まり)
const CARD_ART_KNOWN_BOX = Object.freeze({
  // <card-art-known-box> ここから下は tools/card/card-art-box-build.js が書く(手で直さない)
  atsu_angry: [768, 1024, 0, 2, 768, 1022],
  atsu_crying: [768, 1024, 0, 4, 768, 1020],
  atsu_excited: [768, 1024, 0, 4, 768, 1020],
  atsu_happy: [768, 1024, 0, 0, 768, 1024],
  atsu_normal: [768, 1024, 0, 5, 768, 1019],
  atsu_surprise: [768, 1024, 0, 0, 768, 1024],
  atsu_troubled: [768, 1024, 0, 3, 768, 1021],
  atsu_wink: [768, 1024, 0, 14, 768, 1010],
  dra_angry: [384, 384, 44, 39, 299, 278],
  dra_crying: [384, 384, 47, 45, 291, 269],
  dra_excited: [384, 384, 46, 46, 292, 269],
  dra_happy: [384, 384, 28, 40, 312, 276],
  dra_normal: [384, 384, 45, 42, 293, 273],
  dra_surprise: [384, 384, 25, 39, 313, 278],
  dra_troubled: [384, 384, 45, 43, 294, 272],
  dra_wink: [384, 384, 49, 43, 286, 270],
  kiki_angry: [1536, 1024, 481, 10, 573, 1014],
  kiki_crying: [1536, 1024, 480, 15, 572, 1009],
  kiki_excited: [1536, 1024, 495, 12, 556, 1012],
  kiki_happy: [1536, 1024, 486, 14, 573, 1010],
  kiki_normal: [1536, 1024, 476, 17, 603, 1007],
  kiki_surprise: [1536, 1024, 478, 11, 583, 1013],
  kiki_troubled: [1536, 1024, 480, 9, 577, 1015],
  kiki_wink: [1536, 1024, 490, 7, 569, 1017],
  kyuko_angry: [384, 512, 0, 0, 384, 508],
  kyuko_crying: [384, 512, 4, 0, 380, 507],
  kyuko_excited: [384, 512, 0, 0, 384, 508],
  kyuko_happy: [384, 512, 3, 7, 381, 505],
  kyuko_normal: [384, 512, 0, 6, 377, 506],
  kyuko_surprise: [384, 512, 4, 6, 375, 506],
  kyuko_troubled: [384, 512, 0, 2, 384, 506],
  kyuko_wink: [384, 512, 0, 6, 375, 502],
  momosuke_angry: [512, 512, 12, 3, 497, 509],
  momosuke_crying: [512, 512, 25, 2, 468, 510],
  momosuke_excited: [512, 512, 10, 6, 502, 506],
  momosuke_happy: [512, 512, 28, 14, 475, 498],
  momosuke_normal: [512, 512, 25, 9, 478, 503],
  momosuke_surprise: [512, 512, 18, 7, 486, 505],
  momosuke_troubled: [512, 512, 32, 9, 459, 503],
  momosuke_wink: [512, 512, 0, 7, 512, 505],
  myua_angry: [1536, 1024, 306, 27, 907, 997],
  myua_crying: [1536, 1024, 332, 19, 839, 1005],
  myua_excited: [1536, 1024, 245, 15, 948, 1009],
  myua_happy: [1536, 1024, 360, 26, 783, 998],
  myua_normal: [1536, 1024, 396, 26, 715, 998],
  myua_surprise: [1536, 1024, 325, 27, 852, 997],
  myua_troubled: [1536, 1024, 323, 15, 866, 1009],
  myua_wink: [1536, 1024, 379, 28, 760, 996],
  sorashido_angry: [384, 512, 0, 0, 384, 512],
  sorashido_crying: [384, 512, 0, 0, 384, 512],
  sorashido_excited: [384, 512, 0, 3, 384, 509],
  sorashido_happy: [384, 512, 0, 0, 384, 512],
  sorashido_normal: [384, 512, 0, 0, 384, 512],
  sorashido_surprise: [384, 512, 0, 2, 384, 510],
  sorashido_troubled: [384, 512, 0, 0, 384, 512],
  sorashido_wink: [384, 512, 0, 2, 384, 510],
  // </card-art-known-box>
});
const cardArtBoxOf = (v) => (Array.isArray(v) && v.length === 6 ? { nw: v[0], nh: v[1], x: v[2], y: v[3], w: v[4], h: v[5] } : null);
// その助手の標準の服の絵のときだけ、測ってある輪郭を返す(着替え・まだ大きい絵の無い助手は null)
const cardArtKnownBox = (who, expression, src) => {
  if (!who || !who.imagePrefix || !who.imageDir || typeof assistantExpressionName !== 'function') return null;
  const ex = assistantExpressionName(who, expression);
  return src === `${who.imageDir}/${who.imagePrefix}_${ex}.PNG` ? cardArtBoxOf(CARD_ART_KNOWN_BOX[`${who.imagePrefix}_${ex}`]) : null;
};
// 絵の場所から、どの助手のどの表情の標準の絵かを見つけて、測ってある輪郭を返す(呼ぶ側で指定しなくてよい)
const cardArtKnownBoxBySrc = (src) => {
  if (typeof src !== 'string' || typeof ASSISTANTS === 'undefined' || !Array.isArray(ASSISTANTS)) return null;
  for (const who of ASSISTANTS) {
    const head = who && who.imageDir && who.imagePrefix ? `${who.imageDir}/${who.imagePrefix}_` : '';
    if (head && src.startsWith(head) && src.endsWith('.PNG')) return cardArtKnownBox(who, src.slice(head.length, -4), src);
  }
  return null;
};
// 測ってある輪郭が、読み込んだ絵の大きさと合うか(絵が差し替わっていたら使わない)
const cardArtKnownBoxFor = (src, known) => new Promise((resolve) => {
  if (!known) { resolve(null); return; }
  const img = new Image();
  img.onload = () => resolve(img.naturalWidth === known.nw && img.naturalHeight === known.nh ? known : null);
  img.onerror = () => resolve(null);
  img.src = src;
});
// knownBox … 測ってある輪郭(cardArtKnownBox)。渡さなくても、標準の服の絵なら絵の場所から引く(cardArtKnownBoxBySrc)。あれば canvas で調べずに使う
// 枠の大きさが決まったとき・変わったとき(画面の向き・大きさ)も ResizeObserver で合わせ直す(最初に 0 だと合わせないままだった)
const CardAssistantArt = ({ src, alt, className = '', style = null, knownBox = null }) => {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    let alive = true;
    setBox(null);
    void cardArtKnownBoxFor(src, knownBox || cardArtKnownBoxBySrc(src)).then((known) => (known ? { ...known, known: true } : cardArtBox(src))).then((b) => { if (alive) setBox(b || null); });
    return () => { alive = false; };
  }, [src]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize((cur) => (cur.w === el.clientWidth && cur.h === el.clientHeight ? cur : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = (() => {
    const W = size.w, H = size.h;
    if (!box || !W || !H) return null;
    const sc = Math.min(H / box.h, W / box.w);
    return { width: box.nw * sc, left: W / 2 - (box.x + box.w / 2) * sc, top: H - (box.y + box.h) * sc, artH: Math.round(box.h * sc), artW: Math.round(box.w * sc) };
  })();
  return (
    <div ref={ref} data-card-assistant-art data-card-art-known={box && box.known ? '1' : undefined} data-card-art-h={fit ? fit.artH : undefined} data-card-art-w={fit ? fit.artW : undefined} className={`relative shrink-0 overflow-hidden ${className}`} style={style || undefined}>
      {fit
        ? <img src={src} alt={alt} draggable={false} className="absolute max-w-none" style={{ width: `${fit.width}px`, left: `${fit.left}px`, top: `${fit.top}px` }}/>
        : <img src={src} alt={alt} draggable={false} className="h-full w-full object-contain object-bottom"/>}
    </div>
  );
};

// 助手と対戦の曲の並びを直す行(オプション。2026-10-26)。list … 曲idの並び(1〜5)。onChange(新しい並び) … 直すたびに呼ぶ(保存するかは呼ぶ側)
// 同じ曲は選べない(ほかの行で使っている曲は一覧に出さない)。1曲だけのときは外せない(0曲にしない)
const CardPlaylistRows = ({ list, onChange, bgmPreview, tag }) => {
  const tracks = typeof BGM_TRACKS !== 'undefined' ? BGM_TRACKS : [];
  const choices = (keep) => tracks.filter((t) => t.id === keep || !list.includes(t.id));
  const selectClass = 'min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-2 py-2 text-xs text-white';
  return (
    <div data-card-playlist-rows={tag} data-card-playlist-count={list.length}>
      <ol className="mt-1 space-y-1.5">
        {list.map((id, i) => (
          <li key={`${i}-${id}`} data-card-playlist-row={id} className="flex items-center gap-1.5">
            <span className="w-4 shrink-0 text-center text-[11px] font-black text-slate-400">{i + 1}</span>
            <select data-card-playlist-change={i} aria-label={`${i + 1}曲目を変える`} value={id} className={selectClass}
              onChange={(e) => { const next = [...list]; next[i] = e.target.value; onChange(next); }}>
              {choices(id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {bgmPreview && <button type="button" data-card-playlist-preview={id} onClick={() => bgmPreview.toggle(id)} className="min-h-[44px] min-w-[52px] shrink-0 rounded-xl bg-indigo-700 px-2 text-xs font-black">{bgmPreview.playing === id ? '停止' : '試聴'}</button>}
            <button type="button" data-card-playlist-remove={i} aria-label={`${i + 1}曲目を外す`} disabled={list.length <= 1} onClick={() => onChange(list.filter((_, k) => k !== i))}
              className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl px-1 text-xs font-black ${list.length <= 1 ? 'bg-slate-800 text-slate-600' : 'bg-rose-800/80 text-white'}`}>外す</button>
          </li>
        ))}
      </ol>
      {list.length < CARD_PLAYLIST_MAX
        ? <select data-card-playlist-add aria-label="曲を足す" value="" className={`mt-1.5 w-full ${selectClass}`} onChange={(e) => { if (e.target.value) onChange([...list, e.target.value]); }}>
            <option value="">{`＋ 曲を足す(あと${CARD_PLAYLIST_MAX - list.length}曲)`}</option>
            {choices(null).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        : <p data-card-playlist-full className="mt-1.5 text-[10px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap(`入れられるのは${CARD_PLAYLIST_MAX}曲までです`)}</p>}
    </div>
  );
};

// onQuickLoops(loops) … 1戦ぶんをクイック周回の周回クリアとして配る(60-app の awardCardQuickLoops。裏で回していればその周回へ、いなければ AUTO設定のクイックへ)。配れたら配った中身、配れなければ null
// quickRun … 裏のクイック∞周回のようす({ live, loops, stopped, xp, gold, info }。60-app の cardQuickRunView)。周回をしていなければ null。対戦中は盤のヘッダーに「⚔ ◯周目」だけ出す
// onOpenMarket … マーケットの「MFバトルカード」の売り場へ(60-app)
// topAssistant … トップに出す助手の立ち絵とひとこと({ id, name, accent, image, text }。60-app が場面 cardTop から選ぶ)
// rank … ランキング({ send: 送ってよいか, profile: { name, icon, frame }, renderBreederIcon })。送るのは公開後のふつうの対戦だけ
// bgmPreview … オプションの BGM の試聴({ toggle(曲id), stop(), playing: 鳴らしている曲id }。60-app の BGM アレンジと同じもの)。オプションを閉じたら止める
// onBgm(曲id か 曲idの並び) … 鳴らす曲。助手と対戦だけ並び(2曲以上なら 60-app が全部を1回ずつシャッフルで流す)
// バトルカードのトップの上の帯(60-app の renderCardQuickRunStrip)の「詳細」を押したときの窓(2026-10-26 社長「横の経験値とかを詳細ボタンの中に入れればいいよ」)。
// 数は帯・対戦の盤と同じ所(60-app の cardQuickRunView)から読む。描くのは 60-app(帯と同じ所)
// quickRun … { live, loops, stopped, xp, gold, difficulty, info:{ wave, reason } } か null(一度も回していない)
const CardQuickRunDetail = ({ quickRun, autoReady, autoDifficulty, todayLoops = 0, onClose }) => {
  const live = !!quickRun && !quickRun.stopped;
  const row = (label, value, tone = 'text-white') => (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[11px] font-black text-slate-400">{label}</span>
      <span className={`min-w-0 text-right text-[13px] font-black ${tone}`} style={JA_LABEL_STYLE}>{typeof value === 'string' ? jaWrap(value) : value}</span>
    </div>
  );
  const wave = quickRun && quickRun.info && quickRun.info.wave;
  return (
    <div data-card-quick-detail className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 landscape:py-2" role="dialog" aria-modal="true" aria-label="クイック周回" onClick={onClose}>
      <div className="w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-fuchsia-400/60 bg-slate-900 p-4 text-white shadow-2xl landscape:p-3" style={{ maxHeight: 'calc(100% - 8px)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xl">⚔</span>
          <b className="flex-1 text-[16px] font-black">クイック周回</b>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${!quickRun ? 'border-white/20 text-slate-300' : live ? 'border-fuchsia-300/50 text-fuchsia-100' : 'border-rose-400/70 text-rose-200'}`}>{!quickRun ? '回していません' : live ? `${quickRun.loops}周目` : '止まっています'}</span>
        </div>
        <div className="mt-2 rounded-2xl bg-black/30 px-3 py-1">
          {row('いまのようす', !quickRun ? 'いまは回していません' : live ? `回しています(WAVE ${wave || 1}/10)` : '止まっています', live ? 'text-fuchsia-100' : !quickRun ? 'text-slate-300' : 'text-rose-200')}
          {quickRun && !live && quickRun.info && quickRun.info.reason && row('止まった理由', quickRun.info.reason, 'text-rose-200')}
          {row('難易度', (quickRun && quickRun.difficulty) || autoDifficulty || 'AUTO設定でまだ決まっていません', (quickRun && quickRun.difficulty) || autoDifficulty ? 'text-white' : 'text-amber-200')}
          {quickRun && row('何周目', `${quickRun.loops}周目`)}
          {quickRun && row('この周回でふえたダイヤ', `+${(quickRun.gold || 0).toLocaleString()}`, 'text-emerald-200')}
          {quickRun && row('この周回でふえた経験値', `+${(quickRun.xp || 0).toLocaleString()}`, 'text-emerald-200')}
          {row('今日バトルカードで足した周回', `${(todayLoops || 0).toLocaleString()}周ぶん`, 'text-sky-100')}
        </div>
        <p className="mt-2 text-[11px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(autoReady || quickRun
          ? '助手と対戦・マルチで戦うと、その分がクイック周回として足されます。裏で回しているときは、いまの周回が進みます。'
          : 'AUTO設定で、勇者モン・配置距離・難易度の3つを決めると、戦った分がクイック周回として足されます。')}</p>
        <button type="button" data-card-quick-detail-close onClick={onClose} className="mh-button mt-3 min-h-[44px] w-full rounded-2xl border border-white/15 bg-slate-800 text-[14px] font-black text-white active:scale-[.98]">閉じる</button>
      </div>
    </div>
  );
};
// ---- 途中で閉じた助手との対戦(2026-10-26 社長「負け扱いにする」) ----
// 助手と対戦を始めたときに印(新しいキー mh_card_cpu_open_v1)を書き、ふつうに終わったら結果と同じ取引で消す。
// 次に開いたとき、印が残っていて beat(対戦の画面が生きていた時刻)が古ければ、投了と同じ計算で数え、同じ取引で印を消す(二重に数えない)。
// beat が新しいあいだは、ほかのタブで対戦中とみて数えない
const CARD_CPU_OPEN_KEY = 'mh_card_cpu_open_v1';
const CARD_CPU_OPEN_BEAT_MS = 5000;
const CARD_CPU_OPEN_STALE_MS = 15000;
const cardNormalizeCpuOpen = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (typeof v.id !== 'string' || !v.id || typeof v.who !== 'string' || !CARD_LEVEL_ORDER.includes(v.level)) return null;
  const n = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  const f = v.facts && typeof v.facts === 'object' ? v.facts : {};
  return { id: v.id, who: v.who, level: v.level, rankable: v.rankable === true, at: n(v.at), beat: n(v.beat), facts: { ownTurns: n(f.ownTurns), kos: n(f.kos) } };
};
const CardBattleScreen = ({ screen, onNavigate, onExit, exitLabel = '戻る', seenStoryIds = [], debug = false, onBgm, onQuickLoops, onOpenMarket, topAssistant = null, rank = null, bgmPreview = null, quickRun = null, quickAutoReady = false, onSettings = null }) => {
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  const [save, setSave] = useState(null);
  const [view, setView] = useState('top');
  // オプションの「助手と対戦」の曲の並び: 直している助手と、全員へ写すときの下書き({ list, confirm })
  const [plWho, setPlWho] = useState(null);
  const [plCopy, setPlCopy] = useState(null);
  // 試聴は、オプションを閉じたら・この画面を出たら止める(試聴の曲がほかの画面に残らない)
  const bgmPreviewRef = useRef(bgmPreview);
  bgmPreviewRef.current = bgmPreview;
  const stopBgmPreview = () => { const p = bgmPreviewRef.current; if (p && p.playing && p.stop) p.stop(); };
  useEffect(() => { if (view !== 'options') { stopBgmPreview(); setPlCopy(null); } }, [view]);
  useEffect(() => () => stopBgmPreview(), []);
  // ほかの画面の招待の知らせで「参加する」を押してきたら、マルチの入口を開く(入口が合言葉の部屋へ入る。91 の CARD_PVP_JOIN)
  useEffect(() => { const go = (c) => { if (c) setView('pvp'); }; go(CARD_PVP_JOIN.peek()); return CARD_PVP_JOIN.on(go); }, []);
  const [kitPick, setKitPick] = useState(null);
  const [kitView, setKitView] = useState(null); // スターター選びで「中身を見る」を開いているキット
  const [starterOpen, setStarterOpen] = useState(null); // はじめのスターターを開ける画面に渡す並び(cardStarterOpenResult)
  const [foe, setFoe] = useState({ who: 'mua', level: 'easy' });
  const [game, setGame] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [detail, setDetail] = useState(null);
  const [demoWho, setDemoWho] = useState('mua');
  const [editDeck, setEditDeck] = useState(null);
  const [packDemo, setPackDemo] = useState(null); // デバッグの「パックを開ける見本」 // デッキ編成で組んでいるデッキ // デバッグの「結果の見本」の相手
  const press = useCardLongPress((no) => setDetail(no));
  // トップの助手の「立ち絵/コメント」の出し入れ(モンヒロビート・モンヒロバトルの入口と同じ札。保存は mh_card_top_assist_v1。無い・壊れていたら両方ON)
  const [assist, setAssist] = useState({ modeSelectArt: true, modeSelectComment: true });
  useEffect(() => {
    let alive = true;
    storeGet(CARD_SAVE_KEYS.topAssist, null).then((v) => { if (alive && v && typeof v === 'object' && !Array.isArray(v)) setAssist({ modeSelectArt: v.modeSelectArt !== false, modeSelectComment: v.modeSelectComment !== false }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // 助手のおしゃべり(AI)の入/切(保存は mh_card_ai_talk_v1。無い・壊れていたら入)。出すのは呼べる端末だけ(公開の印か、デバッグ端末)
  const [aiTalk, setAiTalk] = useState(cardAiTalkState.on);
  useEffect(() => { let alive = true; void cardLoadAiTalk().then((v) => { if (alive) setAiTalk(v.on); }); return () => { alive = false; }; }, []);
  const toggleAiTalk = () => { const next = !aiTalk; setAiTalk(next); void cardSaveAiTalk(next); };
  const toggleAssist = (key) => {
    if (key !== 'modeSelectArt' && key !== 'modeSelectComment') return;
    const next = { ...assist, [key]: assist[key] === false };
    setAssist(next);
    void storeSet(CARD_SAVE_KEYS.topAssist, next).catch(() => {});
  };

  const load = async () => {
    const K = CARD_SAVE_KEYS;
    // 前のカードポイントの残りを、ビートPへ1回だけ移す(印つき。82 の cardMigratePointsOnce)。失敗しても遊びは止めない
    try { await cardMigratePointsOnce(storeGet, storeSet, saveStoredValuesOrRollback); } catch (_) { /* 次に開いたときにやり直す */ }
    const [collection, decks, point, starter, daily, record, unlocked, tutorial, bgm, settings, cpuPlaylist] = await Promise.all([
      storeGet(K.collection, null), storeGet(K.decks, null), storeGet(CARD_POINT_STORE_KEY, 0, false), storeGet(K.starter, null),
      storeGet(K.daily, null), storeGet(K.record, null), storeGet(K.cpuUnlocked, null), storeGet(K.tutorial, null),
      storeGet(K.bgm, null), storeGet(K.settings, null), storeGet(K.cpuPlaylist, null),
    ]);
    const next = {
      collection: cardNormalizeCollection(collection), decks: cardNormalizeDecks(decks), point: cardNormalizePoint(point),
      starter: cardNormalizeStarter(starter), daily: cardNormalizeDaily(daily, cardTodayJst()), record: cardNormalizeRecord(record),
      // 解放は、記録(勝ち数・最近の対戦)から開いているはずの強さも足す(82 の cardUnlockedWithRecord。保存は書き換えない)
      unlocked: cardUnlockedWithRecord(unlocked, record), tutorial: cardNormalizeTutorial(tutorial),
      bgm: normalizeCardBgm(bgm, cardIsBgmTrack), settings: normalizeCardSettings(settings),
      cpuPlaylist: cardNormalizeCpuPlaylist(cpuPlaylist, cardIsBgmTrack),
    };
    setSave(next);
    if (onSettings) onSettings(next.settings);
    if (!next.starter) setView('starter');
    return next;
  };
  useEffect(() => { void load(); }, []);
  // トップ画面(結果・デッキ編成なども)の曲。対戦の画面へ入るときは、それぞれの曲に替える
  const topBgm = save && save.bgm ? save.bgm.top : null;
  useEffect(() => { if (screen === 'CARD_TOP' && topBgm && onBgm) onBgm(topBgm); }, [screen, topBgm]);
  // 対戦の画面から外へ出たら(戻るなど)、トップに戻す
  // アプリの中の戻るなどで助手との対戦を抜けたら、その場で投了として数える(途中で閉じた対戦と同じ。印があるときだけ)
  useEffect(() => {
    if (screen === 'CARD_TOP' && game && !result) {
      if (openIdRef.current === game.key) void settleOpenCpu({ force: true });
      setGame(null);
    }
  }, [screen]);

  // 対戦の結果を書く直前に、その日の数・記録・解放を保存から読み直す(2026-10-26 社長「ハード解放したのに、いつのまにか消えてた」)。
  //   この画面は開いたときに1回だけ読んだ中身(save)を持ち続けるので、同じ端末でゲームを2つ開いていたり、
  //   解放の前から開きっぱなしの画面で勝ったりすると、古い中身で解放・記録を上書きしていた。読み直した値の上に足す
  //   解放は、読み直した値・手元の値・記録から開いているはずの強さを合わせる(閉じる向きには変えない)
  //   raw … 読んだそのままの値(失敗したときに戻す値)
  const freshCardSave = async () => {
    const K = CARD_SAVE_KEYS;
    let raw = { daily: save.daily, record: save.record, unlocked: save.unlocked };
    try {
      const [d, r, u] = await Promise.all([storeGet(K.daily, null), storeGet(K.record, null), storeGet(K.cpuUnlocked, null)]);
      raw = { daily: d, record: r, unlocked: u };
    } catch (_) { /* 読めなければ手元の値で続ける */ }
    const record = cardNormalizeRecord(cardIsPlainObject(raw.record) ? raw.record : save.record);
    const u0 = cardNormalizeCpuUnlocked(raw.unlocked);
    const merged = Object.fromEntries(Object.keys(u0).map((lv) => [lv, u0[lv] || save.unlocked[lv] === true]));
    return { daily: cardNormalizeDaily(raw.daily === null ? save.daily : raw.daily, cardTodayJst()), record, unlocked: cardUnlockedWithRecord(merged, record), raw };
  };

  // 保存はまとめて1つの取引で(失敗したら全部戻す)
  // ポイントはビートP(CARD_POINT_STORE_KEY)。モンヒロビートでも増えるので、書く直前に読み直し、この画面で足した分(差)だけを足す
  // befores … 失敗したときに戻す値(読み直した値)。無い項目は手元の save の値に戻す
  // extra … 同じ取引で書くほかのキー([{ key, next, before }]。途中で閉じた対戦の印 mh_card_cpu_open_v1 を消すときなど)
  const persist = async (patch, befores = {}, extra = []) => {
    const K = CARD_SAVE_KEYS;
    let fixed = patch;
    let pointBefore = null;
    if ('point' in patch) {
      pointBefore = await storeGet(CARD_POINT_STORE_KEY, 0, false);
      fixed = { ...patch, point: Math.max(0, cardNormalizePoint(pointBefore) + (cardNormalizePoint(patch.point) - save.point)) };
    }
    const entries = Object.entries(fixed).map(([k, next]) => (k === 'point'
      ? { key: CARD_POINT_STORE_KEY, next, before: pointBefore }
      : { key: K[k], next, before: k in befores ? befores[k] : save[k] === undefined ? null : save[k] })).concat(extra);
    const ok = await saveStoredValuesOrRollback(entries, storeGet, storeSet);
    if (ok) setSave((cur) => ({ ...cur, ...fixed }));
    if (ok && patch.settings && onSettings) onSettings(patch.settings); // 周回の自動(quickAutoStart)は 60-app が見る
    return ok;
  };

  // 途中で閉じた助手との対戦を、投了として数える(印 mh_card_cpu_open_v1。上の CARD_CPU_OPEN_KEY の説明)。
  // force … この画面で対戦を抜けたとき(beat を待たずに数える)。数えたら { reward, loops } を返す
  const openIdRef = useRef(null); // この画面で書いた印の試合の鍵(書けなかったら null。そのときは終わりに印を見ない)
  const settleOpenCpu = async ({ force = false, skipId = null } = {}) => {
    let raw = null;
    try { raw = await storeGet(CARD_CPU_OPEN_KEY, null); } catch (_) { return null; }
    const open = cardNormalizeCpuOpen(raw);
    if (!open) { if (raw !== null) await storeSet(CARD_CPU_OPEN_KEY, null).catch(() => {}); return null; } // 壊れた印は消すだけ
    if (open.id === skipId) return null;
    if (!force && Date.now() - open.beat < CARD_CPU_OPEN_STALE_MS) return null; // ほかのタブで対戦中
    const fresh = await freshCardSave();
    const reward = cardCpuReward(fresh.daily, open.level, 'surrender', open.facts);
    const loops = cardCpuLoops(open.level, 'surrender', open.facts);
    const nextRecord = cardRecordAfter(fresh.record, { who: open.who, level: open.level, outcome: 'surrender', at: Date.now(), rankable: open.rankable });
    // 記録をくわしく(90 の mh_card_record_detail_v1): 助手ごとの投了だけ足す(デッキ・技は分からない)
    const detailEntry = await cardRecordDetailEntry(fresh.record, (d) => cardRecordDetailAfter(d, { who: open.who, level: open.level, outcome: 'surrender', turns: open.facts && open.facts.ownTurns, today: cardTodayJst() }));
    const ok = await persist({ point: save.point + reward.total, daily: reward.daily, record: nextRecord }, fresh.raw, [{ key: CARD_CPU_OPEN_KEY, next: null, before: raw }, detailEntry]);
    if (!ok) return null;
    if (openIdRef.current === open.id) openIdRef.current = null;
    if (open.rankable && rank && rank.send) void cardRankSync(db, { record: nextRecord, collection: save.collection, profile: rank.profile });
    let quick = null;
    if (loops > 0 && onQuickLoops) { try { quick = await onQuickLoops(loops); } catch (_) { quick = null; } }
    if (quick) await persist({ daily: { ...reward.daily, quickLoops: (reward.daily.quickLoops || 0) + loops } }, { daily: reward.daily }, [await cardRecordDetailEntry(nextRecord, (d) => ({ ...d, quick: d.quick + loops }))]);
    setNotice(`前回の対戦は途中で終わったので、投了として数えました${reward.total > 0 ? `(ビートP +${reward.total.toLocaleString()})` : ''}`);
    return { reward, loops };
  };
  // 印を書く(first … 始めたとき)。対戦中は、番が進んだら facts を、CARD_CPU_OPEN_BEAT_MS ごとに beat を書き直す
  const openRef = useRef(null);
  const cpuLogRef = useRef(null);
  // 助手と対戦の手の一覧(リプレイの記録・93)。始めたときに作り、盤面から手が届くたびに足す。検査の差しかえた始まり(__mhCardScene)は取らない
  const cpuLogAct = (by, act) => { const log = cpuLogRef.current; if (log && log.acts.length < CARD_REPLAY_ACTS_MAX) log.acts.push({ by, act: JSON.parse(JSON.stringify(act)) }); };
  const writeCpuOpen = async (open, first = false) => {
    if (!first && (!openRef.current || openRef.current.id !== open.id || openIdRef.current !== open.id)) return;
    openRef.current = open;
    try {
      await storeSet(CARD_CPU_OPEN_KEY, open);
      if (first) openIdRef.current = open.id;
    } catch (_) { if (first) openIdRef.current = null; }
  };
  const cpuOpenProgress = (st) => {
    const cur = openRef.current;
    if (!cur || !game || cur.id !== game.key) return;
    const facts = cardResultFacts(st, CARD_ME);
    if (facts.ownTurns === cur.facts.ownTurns && facts.kos === cur.facts.kos) return;
    void writeCpuOpen({ ...cur, facts, beat: Date.now() });
  };
  useEffect(() => {
    if (screen !== 'CARD_BATTLE' || !game || game.tutorial || game.pvp || game.demo) return undefined;
    const t = setInterval(() => { const cur = openRef.current; if (cur && cur.id === game.key) void writeCpuOpen({ ...cur, beat: Date.now() }); }, CARD_CPU_OPEN_BEAT_MS);
    return () => clearInterval(t);
  }, [screen, game ? game.key : '']);
  // 開いたときに1回。トップにいるあいだも、ほかのタブの対戦が止まったかを見る
  const settledOnce = useRef(false);
  useEffect(() => {
    if (!save || !db || settledOnce.current) return;
    settledOnce.current = true;
    void settleOpenCpu();
  }, [save]);
  useEffect(() => {
    if (!save || !db || screen !== 'CARD_TOP') return undefined;
    const t = setInterval(() => { void settleOpenCpu({ skipId: openIdRef.current }); }, CARD_CPU_OPEN_STALE_MS);
    return () => clearInterval(t);
  }, [save ? 1 : 0, screen]);

  // 過去の対戦を見る(93-card-replay.jsx)。id … 試合の番号。back … とじたあとに戻る画面(view)
  const openReplay = async (id, back = 'top') => {
    const rec = await cardReplayGet(id);
    const g = rec && db ? cardReplayGameOf(db, rec) : null;
    if (!g) { setNotice('この対戦は見られません(記録が見つかりませんでした)'); return; }
    setGame({ ...g, settings: save ? save.settings : undefined, replay: { ...g.replay, back } });
    onNavigate('CARD_BATTLE');
  };
  if (!db) return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="MFバトルカード" onBack={onExit}/><ScreenEmpty emoji="🃏" lines={['カードのデータを読み込めませんでした']}/></div>;
  if (!save) return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="MFバトルカード" onBack={onExit}/><ScreenEmpty emoji="⏳" lines={['読み込み中…']}/></div>;

  if (screen === 'CARD_BATTLE' && game) {
    // 対戦開始の画面(83-card-battle-vs.jsx)。出し終わるかタップしたら、対戦の画面へ(場はもう作ってあり、見せるだけ)
    if (game.intro) return <CardVsIntro key={`vs-${game.key}`} db={db} intro={game.intro} meIcon={rank && typeof rank.renderMeIcon === 'function' ? rank.renderMeIcon() : null} onDone={() => setGame((g) => (g && g.key === game.key ? { ...g, intro: null } : g))}/>;
    return <CardBattleBoard key={game.key} db={db} game={game} onProgress={cpuOpenProgress} onActLog={cpuLogRef.current && cpuLogRef.current.id === game.key ? cpuLogAct : null} meProfile={rank && rank.profile} meIcon={rank && typeof rank.renderMeIcon === 'function' ? rank.renderMeIcon() : null} quickRun={quickRun ? { loops: quickRun.loops, stopped: quickRun.stopped } : null} onFinish={async ({ outcome, st, comeback = false }) => {
      // 過去の対戦を見る(93): 何も保存しない。開いた画面へ戻すだけ(1手ごとの場を持ったままにしない)
      if (game.replay) {
        const back = game.replay.back || 'top';
        setGame(null);
        onNavigate('CARD_TOP');
        setView(back);
        return;
      }
      // マルチ対戦: 封を開けて確かめるのは 91 の CARD_PVP。結果は部屋の画面に出す(報酬は区切り2)
      if (game.pvp) {
        CARD_PVP.finish(outcome, st);
        onBgm && onBgm(save.bgm.top);
        onNavigate('CARD_TOP');
        setView('pvp');
        return;
      }
      // デバッグの「技の動きの見本」(game.demo)は、終わっても・投了しても何も保存しない(ボタンに「保存しない」と書いてある)。トップへ戻すだけ
      if (game.demo) {
        onBgm && onBgm(save.bgm.top);
        onNavigate('CARD_TOP');
        setView('top');
        return;
      }
      if (game.tutorial) {
        // 練習試合: 終えた・飛ばしたの印と、はじめて最後までやったときだけビートP 100(1日の上限とは別)
        const fin = cardTutorialFinish(save.tutorial, outcome === 'tutorialDone' ? 'done' : 'skip', Date.now());
        const ok = await persist({ tutorial: fin.tutorial, point: save.point + fin.reward });
        setResult({ tutorial: true, done: outcome === 'tutorialDone', reward: ok ? fin.reward : 0, saved: ok });
        onBgm && onBgm(save.bgm.top);
        onNavigate('CARD_TOP');
        setView('result');
        return;
      }
      // 途中で閉じた対戦の印(CARD_CPU_OPEN_KEY)。この画面で書いた印なら、結果と同じ取引で消す。
      // もう無い(ほかのタブで投了として数えた)ときは、二重に数えない
      const openExtra = [];
      if (openIdRef.current === game.key) {
        let raw = null;
        try { raw = await storeGet(CARD_CPU_OPEN_KEY, null); } catch (_) { raw = null; }
        const open = cardNormalizeCpuOpen(raw);
        if (!open || open.id !== game.key) {
          openIdRef.current = null; openRef.current = null;
          setNotice('この対戦は、ほかの画面で投了として数えました');
          onBgm && onBgm(save.bgm.top);
          onNavigate('CARD_TOP');
          setView('top');
          return;
        }
        openExtra.push({ key: CARD_CPU_OPEN_KEY, next: null, before: raw });
      }
      // 自分の番の数・倒した数で決める(かかった時間は見ない)。案A・台帳 #3484
      const facts = cardResultFacts(st, CARD_ME);
      const fresh = await freshCardSave();
      const reward = cardCpuReward(fresh.daily, game.level, outcome, facts);
      const loops = cardCpuLoops(game.level, outcome, facts);
      // ランキングに数えるのは、公開後に、デバッグでない人がふつうの入口から戦ったぶんだけ(rank.send。60-app が決める)
      const rankable = !!(rank && rank.send) && !debug;
      const nextRecord = cardRecordAfter(fresh.record, { who: game.who, level: game.level, outcome, at: Date.now(), rankable });
      const nextUnlocked = outcome === 'win' ? cardUnlockAfterWin(fresh.unlocked, game.level) : fresh.unlocked;
      const opened = CARD_LEVEL_ORDER.find((lv) => nextUnlocked[lv] && !fresh.unlocked[lv]) || null;
      // 過去の対戦を見る(93): この試合の手の一覧。先に作っておき、保存は結果を書いたあと(使った技を数えるのにも使う)
      const log = cpuLogRef.current;
      const replayRec = log && log.id === game.key ? cardReplayFromCpu(db, { id: `c${log.id}`, at: Date.now(), myDeck: log.decks[0], cpuDeck: log.decks[1], seed: log.seed, first: log.first, history: log.acts,
        foe: { name: log.foeName, who: game.who, deckName: log.deckName }, outcome, reason: '', level: game.level }) : null;
      if (log && log.id === game.key) cpuLogRef.current = null;
      // 記録をくわしく(90 の mh_card_record_detail_v1。見本の対戦は数えない)。デッキ・場の3体・使った技も足す
      const usedDeck = save.decks.decks.find((d) => d.id === save.decks.active) || null;
      const usedMons = log && log.decks[0] ? log.decks[0].monsters : ((st && st.players && st.players[CARD_ME] && st.players[CARD_ME].mons) || []).map((m) => m.no);
      const detailEntry = game.demo ? null : await cardRecordDetailEntry(fresh.record, (d) => cardRecordDetailAfter(d, { who: game.who, level: game.level, outcome, turns: facts.ownTurns,
        deck: usedDeck ? { id: usedDeck.id, name: usedDeck.name } : null, mons: usedMons, moves: cardRecordMovesOf(db, replayRec), today: cardTodayJst() }));
      const ok = await persist({ point: save.point + reward.total, daily: reward.daily, record: nextRecord, unlocked: nextUnlocked }, fresh.raw, detailEntry ? [...openExtra, detailEntry] : openExtra);
      if (ok && openExtra.length) { openIdRef.current = null; openRef.current = null; }
      if (ok && rankable) void cardRankSync(db, { record: nextRecord, collection: save.collection, profile: rank.profile });
      // 助手の服の解放(data/breeder.js。2026-10-27 社長「バトルカードでみゅあのマスターに勝つと解放」)。どの相手・難易度で解放するかは breeder.js が決める。
      // 勝ちの記録を保存できたあとに、別に保存する(こちらが書けなくても勝ちの記録は落とさない。次に開いたとき、
      // 記録の MASTER の勝ちから解放し直せる)。デバッグの対戦は呼ばない(見本・練習試合は上で抜けている)
      if (ok && outcome === 'win' && !debug) {
        try {
          const unlockEntry = assistantCostumeUnlockEntry(await storeGet(ASSISTANT_COSTUME_UNLOCKED_KEY, null), { who: game.who, level: game.level, outcome });
          if (unlockEntry && await storeSet(unlockEntry.key, unlockEntry.next)) addAssistantCostumeUnlockedNow(unlockEntry.next);
        } catch (_) { /* 解放の保存に失敗しても、対戦の結果はそのまま出す */ }
      }
      // クイック周回ぶん: 周回クリア扱いにするのは、ビートと同じく、AUTO設定のクイックの難易度を通したことがある人だけ(配る側が決める)
      let quick = null;
      if (loops > 0 && onQuickLoops) { try { quick = await onQuickLoops(loops); } catch (_) { quick = null; } }
      // 足せた周の数を、その日の数へ足す(トップの周回の札の詳細「今日バトルカードで足した周回」)
      if (ok && quick) await persist({ daily: { ...reward.daily, quickLoops: (reward.daily.quickLoops || 0) + loops } }, { daily: reward.daily }, [await cardRecordDetailEntry(nextRecord, (d) => ({ ...d, quick: d.quick + loops }))]);
      // 対戦後のひとこと(AI)の材料。見本の対戦・マルチは聞かない
      const talkFacts = !game.demo && !game.pvp ? cardTalkAfterFacts(db, st, { cpu: CARD_CPU, outcome, level: game.level, comeback }) : null;
      // 過去の対戦を見る(93): この試合の手の一覧を端末に取っておく。保存できたら結果の画面に「この対戦を見る」
      let replayId = null;
      if (replayRec && await cardReplaySave(replayRec)) replayId = replayRec.id;
      setResult({ outcome, reward, opened, saved: ok, who: game.who, level: game.level, loops, quick, facts, talk: talkFacts, replay: replayId });
      onBgm && onBgm(save.bgm.top);
      onNavigate('CARD_TOP');
      setView('result');
    }}/>;
  }

  const allAssistants = typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : [];
  const foes = (debug ? allAssistants.filter((a) => cardFoeReleased(a.id)) : assistantsUnlockedFrom(seenStoryIds)).filter((a) => CARD_AI_HABITS[a.id]);
  const activeDeck = save.decks.decks.find((d) => d.id === save.decks.active) || save.decks.decks[0] || null;
  const deckIssues = activeDeck ? [...cardDeckProblems(db, activeDeck), ...cardDeckOwnProblems(db, activeDeck, save.collection)] : ['デッキがありません'];
  const btn = 'mh-button min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40';
  // 対戦開始の画面に出す、こちらの名前と、場の3体(0=こちら・1=相手)
  const myName = (rank && rank.profile && rank.profile.name) || 'あなた';
  const vsMons = (st, side) => ((st && st.players && st.players[side] && st.players[side].mons) || []).map((m) => m.no);

  // 練習試合(チュートリアル)を始める。相手はみゅあ・デッキはドラが貸す(選んだスターターとは別)
  const startTutorial = () => {
    setResult(null);
    const tst = cardTutorialGame(db);
    const mua = allAssistants.find((a) => a.id === 'mua');
    // 練習試合はみゅあで短く(ひとことは1つ・デッキ名は出さない。2026-10-26 社長 案A)
    const intro = { mode: 'tutorial', foe: { who: 'mua', name: mua ? mua.name : 'みゅあ', line: CARD_VS_TUTORIAL_LINE, monsters: vsMons(tst, CARD_CPU) }, me: { name: '練習試合', monsters: vsMons(tst, CARD_ME) } };
    setGame({ key: `tutorial-${Date.now()}`, st: tst, who: 'mua', level: 'easy', tutorial: true, intro });
    onBgm && onBgm(CARD_AI_BGM.mua); // 練習試合は、みゅあの曲(#3634 の前と同じ)
    onNavigate('CARD_BATTLE');
  };
  const startBattle = (pick = foe) => {
    if (!activeDeck || deckIssues.length) { setNotice(deckIssues.join('・')); return; }
    // 毎試合、好きなモンスター ベスト4から3体を選んで組み直す(MASTER はこちらのデッキも見る)
    const cpuDeck = cardAiBuildDeck(db, pick.who, pick.level, Math.random, { playerDeck: activeDeck });
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const first = Math.random() < 0.5 ? CARD_ME : CARD_CPU;
    const assistant = allAssistants.find((a) => a.id === pick.who);
    let st = cardCreateGame(db, { decks: [{ monsters: activeDeck.monsters, cards: activeDeck.cards }, cpuDeck], names: ['あなた', assistant ? assistant.name : 'あいて'], seed, first });
    // 検査のときだけ: 始まりの場を決めた形に差しかえる(window.__mhCardScene が関数のときだけ。ふだんの遊びでは無い)
    if (typeof window !== 'undefined' && typeof window.__mhCardScene === 'function') { try { st = window.__mhCardScene(cardClone(st)) || st; } catch (_) { /* 差しかえに失敗したら、ふつうの始まりのまま */ } }
    setResult(null);
    // 対戦開始の画面: 相手の助手のひとこと(助手ごと・難易度ごと)と、組んだ中身から付けたデッキ名
    const intro = { mode: 'assistant',
      foe: { who: pick.who, name: assistant ? assistant.name : 'あいて', line: (CARD_VS_LINES[pick.who] || {})[pick.level] || null, deckName: cardAssistantDeckName(db, cpuDeck, pick.who, pick.level), monsters: vsMons(st, CARD_CPU) },
      me: { name: myName, deckName: activeDeck.name || null, monsters: vsMons(st, CARD_ME) } };
    setGame({ key: `${seed}`, st, who: pick.who, level: pick.level, settings: save.settings, intro, cpuSameBlood: !!cpuDeck.sameBlood });
    const scene = typeof window !== 'undefined' && typeof window.__mhCardScene === 'function';
    cpuLogRef.current = scene ? null : { id: `${seed}`, seed, first, decks: [{ monsters: activeDeck.monsters, cards: activeDeck.cards }, cpuDeck], foeName: intro.foe.name, deckName: intro.foe.deckName || null, acts: [] };
    // 途中で閉じたときに投了として数えるための印(CARD_CPU_OPEN_KEY)。書けなかったら、終わりにも印を見ない
    void writeCpuOpen({ id: `${seed}`, who: pick.who, level: pick.level, rankable: !!(rank && rank.send) && !debug, at: Date.now(), beat: Date.now(), facts: cardResultFacts(st, CARD_ME) }, true);
    // 対戦の BGM: オプションで曲を決めていればその曲、「おまかせ」なら相手の助手に合わせる
    onBgm && onBgm(cardCpuPlaylistOf(save.cpuPlaylist, pick.who)); // 並びは対戦を始めるたびにシャッフルし直す(60-app)
    onNavigate('CARD_BATTLE');
  };

  // ---- はじめのスターターを開ける(パックと同じ画面。閉じたら、練習試合がまだなら練習試合へ) ----
  if (view === 'starter-open' && starterOpen) {
    const needTutorial = !save.tutorial.done && !save.tutorial.skipped;
    return <CardPackOpen db={db} result={{ ...starterOpen, doneLabel: needTutorial ? '練習試合へ' : 'トップへ戻る' }} onDone={() => { setStarterOpen(null); setView('top'); if (needTutorial) startTutorial(); }}/>;
  }

  // ---- スターター選び(一度きり) ----
  if (view === 'starter') {
    const kits = Object.values(db.starters);
    const pick = kitPick ? db.starters[kitPick] : null;
    return (
      <div data-mh-screen data-card-top="starter" className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="スターターをえらぶ" accent="text-amber-200" onBack={save.starter ? () => setView('top') : onExit} note="最初の1つは無料。えらばなかった2つは、あとでビートPで買えます"/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {kits.map((k) => (
            // 「中身を見る」で、選ぶ前に入っているカードを確かめられる(2026-10-27 社長「最初にやるときにスターターパックの中身が分からない」案A)
            <div key={k.id} className="relative">
              <button type="button" data-card-kit={k.id} onClick={() => { Audio_.fgSe.tap(); setKitPick(k.id); }} className={`w-full rounded-2xl border-2 p-2 text-left ${kitPick === k.id ? 'border-amber-300 bg-amber-500/15' : 'border-white/10 bg-slate-900/70'}`}>
                <div className="pr-[84px] text-[15px] font-black text-white">{k.name}</div>
                <div className="mt-1 flex gap-1.5">{k.monsters.map((no) => <img key={no} src={CARD_IMG(cardMonsterOf(db, no).img)} alt={cardMonsterOf(db, no).name} className="w-[27%] rounded-md"/>)}</div>
                <div className="mt-1 text-[12px] font-bold text-slate-300">{k.monsters.map((no) => cardMonsterOf(db, no).name).join('・')} と技カード50枚</div>
              </button>
              <button type="button" data-card-kit-contents={k.id} onClick={() => { Audio_.fgSe.tap(); setKitView(k); }} className="absolute right-2 top-2 min-h-[30px] rounded-lg border border-sky-300/60 bg-sky-900/70 px-2 text-[11px] font-black text-sky-100 active:scale-95">中身を見る</button>
            </div>
          ))}
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" disabled={!pick} className={`${btn} mh-button-primary`} onClick={async () => {
            const g = cardGrantStarter(db, save, kitPick, Date.now());
            if (!g) { setNotice('スターターはもう受け取っています'); setView('top'); return; }
            const before = save.collection;
            const ok = await persist(g);
            setNotice(ok ? `「${pick.name}」を受け取りました。ビートP${CARD_STARTER_POINT}もいっしょに！` : '保存できませんでした。もう一度お試しください');
            // 受け取ったら、ブースターパックと同じ画面で開けて中身を見せてから練習試合へ(2026-10-27 社長「最初に手に入れたときも」)。
            //   ここを通るのは、まだスターターを持っていない人だけ(cardGrantStarter が2回目を断る)なので、もう持っている人には出ない
            if (ok) { setStarterOpen(cardStarterOpenResult(db, kitPick, before, false)); setView('starter-open'); }
          }}>{pick ? `「${pick.name}」にする` : 'キットをえらんでください'}</button>
        </div>
        {kitView && <CardStarterContents db={db} kit={kitView} collection={false} onClose={() => setKitView(null)}/>}
      </div>
    );
  }

  // ---- 相手えらび(助手・難易度) ----
  // 対戦の選び方(社長 台帳 #3495「コンピューター戦って表示がやだ」): 助手と対戦/マルチ対戦(できるまで準備中・押せない)
  if (view === 'mode') {
    // トップと同じ作り(舞台の背景・色つきの大きい札)にそろえる。札の中に、戦える助手の顔を並べる(2026-10-24 改善部の点検 V8「下半分が空く」)
    return (
      <div data-mh-screen data-card-top="mode" className="mhms-stage relative flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 text-white">
        <RhythmModeSelectStage notes={false}/>
        <div className="relative z-10"><ScreenHead title="対戦" accent="text-amber-200" onBack={() => setView('top')} note="だれと戦うかをえらびます"/></div>
        <div className={`${SCREEN_LIST_CLASS} relative z-[1] flex flex-col justify-center space-y-3 pb-4`}>
          <button type="button" data-card-mode-assistant className="mhms-card mhms-in flex min-h-[150px] w-full flex-col items-start justify-center gap-2 bg-gradient-to-br from-orange-200 via-orange-400 to-rose-500 px-4 py-3 text-left text-slate-950 active:scale-[.98]" onClick={() => { Audio_.fgSe.tap(); setView('foe'); }}>
            {/* 札の透かしの英字は、トップ・モンヒロビートと同じ置き方(端で切れて見えるのも同じ作り) */}
            <span aria-hidden="true" className="mhms-mark">ASSISTANT</span>
            <span className="relative flex items-center gap-2"><span aria-hidden="true" className="text-3xl leading-none">⚔️</span><span><b className="block text-[22px] font-black italic leading-tight">助手と対戦</b><small className="block text-[11px] font-black text-slate-900/80">助手のみんなと戦う・強さは5段</small></span></span>
            {/* 顔は、もう会っている助手だけ(まだ会っていない助手が見えるとネタバレ。デバッグでも同じ) */}
            <span aria-hidden="true" className="relative flex -space-x-2">{assistantsUnlockedFrom(seenStoryIds).filter((x) => CARD_AI_HABITS[x.id]).map((x) => <img key={x.id} src={assistantFaceImage(x, 'normal')} alt="" className="h-10 w-10 rounded-full border-2 border-white/80 bg-slate-900 object-cover object-top shadow"/>)}</span>
          </button>
          {/* マルチ対戦(91-card-battle-multi.jsx)。MFバトルカードの公開の印と同じ日に開く(cardPvpOpen・社長 案A)。それまではデバッグ設定から入ったときだけ押せる */}
          <button type="button" data-card-mode-multi disabled={!(debug || cardPvpOpen())} onClick={() => { Audio_.fgSe.tap(); setView('pvp'); }} className="mhms-card mhms-in flex min-h-[150px] w-full flex-col items-start justify-center gap-2 bg-gradient-to-br from-sky-200 via-sky-400 to-indigo-500 px-4 py-3 text-left text-slate-950 active:scale-[.98] disabled:opacity-50" style={{ animationDelay: '60ms' }}>
            <span aria-hidden="true" className="mhms-mark">MULTI</span>
            <span className="relative flex items-center gap-2"><span aria-hidden="true" className="text-3xl leading-none">🎮</span><span><b className="block text-[22px] font-black italic leading-tight">マルチ対戦</b><small className="block text-[11px] font-black text-slate-900/80">ブリーダーどうしで戦う</small></span></span>
            {!cardPvpOpen() && <span className="relative rounded-full bg-slate-950/70 px-2 py-0.5 text-[11px] font-black text-white">{debug ? 'つくっている途中(デバッグ)' : '準備中'}</span>}
          </button>
        </div>
      </div>
    );
  }
  if (view === 'pvp') {
    // 報酬(区切り2・台帳 #119 の対人戦。1日の上限なし): ビートP・その日の数・記録(pvp の勝ち負け)・クイック周回
    // その日はじめての勝ちの +50 は、助手と対戦と同じ印(daily.firstWin)を使う。どちらで勝っても合わせて1日1回(2026-10-26 社長)
    // 91 の結果の画面は point をそのまま「もらったビートP」に出すので、+50 を足した合計を返す(bonus は内訳)
    // ★クイック周回のあとの書き直しにも firstWin を入れる(抜けていて、印が消えて1日に何度も +50 になっていた。2026-10-27 総点検)
    const pvpReward = async (r) => {
      const base = cardPvpReward(r.reward, r.facts);
      // 書く直前に読み直す(助手と対戦と同じ。古い中身で記録・その日の数を上書きしない)
      const fresh = await freshCardSave();
      const daily = fresh.daily;
      const record = fresh.record;
      const win = r.outcome === 'win';
      const bonus = r.reward === 'win' && base.point > 0 && !daily.firstWin ? CARD_FIRST_WIN_BONUS : 0;
      const got = { ...base, point: base.point + bonus, bonus };
      const ok = await persist({ point: save.point + got.point, daily: { ...daily, pvpPoint: daily.pvpPoint + got.point, firstWin: daily.firstWin || bonus > 0 },
        record: { ...record, pvp: { win: record.pvp.win + (win ? 1 : 0), lose: record.pvp.lose + (win ? 0 : 1) } } }, fresh.raw);
      let quick = null;
      if (ok && got.loops > 0 && onQuickLoops) { try { quick = await onQuickLoops(got.loops); } catch (_) { quick = null; } }
      if (ok && quick) await persist({ daily: { ...daily, pvpPoint: daily.pvpPoint + got.point, firstWin: daily.firstWin || bonus > 0, quickLoops: (daily.quickLoops || 0) + got.loops } }, { daily: { ...daily, pvpPoint: daily.pvpPoint + got.point, firstWin: daily.firstWin || bonus > 0 } },
        [await cardRecordDetailEntry(record, (d) => ({ ...d, quick: d.quick + got.loops }))]);
      return { ...got, saved: ok, quick };
    };
    return <CardPvpLobby onOpenReplay={(id) => { void openReplay(id, 'pvp'); }} replayHas={cardReplayHas} meIcon={rank && typeof rank.renderMeIcon === 'function' ? rank.renderMeIcon() : null} meFrame={(rank && rank.profile && rank.profile.frame) || null} deck={activeDeck} deckIssues={deckIssues} onBack={() => setView('mode')} onReward={pvpReward} assistant={topAssistant} point={save.point} onAssistant={() => setView('foe')} rankSend={!!(rank && rank.send) && !debug} onStart={(g) => {
      setResult(null);
      // 対戦開始の画面: 相手の名前・アイコン・相手がデッキ編成で付けたデッキ名(古い版の相手は送ってこないので出さない)
      const pv = g.pvp || {};
      const intro = { mode: 'pvp', foe: { name: pv.name || 'あいて', icon: pv.icon || '🙂', frame: pv.frame || null, deckName: pv.deckName || null, monsters: vsMons(g.st, CARD_CPU) },
        me: { name: myName, deckName: (activeDeck && activeDeck.name) || null, monsters: vsMons(g.st, CARD_ME) } };
      setGame({ ...g, settings: save.settings, intro });
      onBgm && onBgm(save.bgm.pvp || null);
      onNavigate('CARD_BATTLE');
    }}/>;
  }
  if (view === 'foe') {
    const a = allAssistants.find((x) => x.id === foe.who) || foes[0];
    const line = a ? cardPickLine(a.id, 'challenge', null, () => 0.0) : null;
    return (
      <div data-mh-screen data-card-top="foe" className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="助手と対戦" accent="text-amber-200" onBack={() => setView('mode')} note="相手の助手と強さをえらびます"/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {/* 7人(ソラシドの印が立ったとき)は縦4列(4人＋3人)・横7列。6人まではいまの縦3列・横6列のまま(2026-10-27 社長の答え・ソランド部長)。
              7列は横の小さい画面(568×320)で名前の字が小さくなりすぎた(5.9px)ので、すき間と札の内側を詰めて、いまの6列と同じくらいにする */}
          <div data-card-foe-grid={foes.length >= 7 ? 7 : 6} className={`grid ${foes.length >= 7 ? 'grid-cols-4 gap-1.5 landscape:grid-cols-7 landscape:gap-1' : 'grid-cols-3 gap-1.5 landscape:grid-cols-6'}`}>
            {foes.map((x) => (
              <button key={x.id} type="button" data-card-foe={x.id} onClick={() => { Audio_.fgSe.tap(); setFoe((f) => ({ ...f, who: x.id })); }} className={`relative flex flex-col items-center rounded-xl border-2 ${foes.length >= 7 ? 'p-1 landscape:p-0.5' : 'p-1'} ${foe.who === x.id ? 'bg-white/10' : 'border-white/10 bg-slate-900/70'}`} style={foe.who === x.id ? { borderColor: x.accent } : undefined}>
                <img src={assistantFaceImage(x, 'normal')} alt={x.name} className="h-[52px] w-[52px] rounded-lg object-cover object-top landscape:h-[34px] landscape:w-[34px]"/>
                {/* 名前は折らない。横の小さい画面(568×320)では札が細く「みゅ/あ」「もも/すけ」と折れたので、入らなければ字を小さくする(2026-10-26 ソランドくん) */}
                <span className="block w-full" style={{ containerType: 'inline-size' }}><span data-card-foe-name className="block whitespace-nowrap text-center font-black" style={{ fontSize: `min(13px, calc(100cqw / ${[...x.name].length + 0.3}))` }}>{x.name}</span></span>
                {save.record.beaten[x.id] && <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 text-[10px] font-black text-slate-900">勝</span>}
              </button>
            ))}
          </div>
          {/* 強さのボタンは助手の顔のすぐ下(紹介の欄が長いと、下の「対戦する」の帯に潜っていた。2026-10-25 社長の実機) */}
          {/* 見出しの部品(ScreenSectionLabel)の注記は9pxで小さすぎた(見回り #16)。ほかの画面は変えず、ここだけ11pxで書く */}
          <div className="flex items-baseline gap-2 px-0.5 pt-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">強さ</span>
            <span className="text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>勝つと次の強さが開きます</span>
          </div>
          {/* 鍵が付いているときは、どの強さで勝てば開くかを1行で出す(EASY で勝っても HARD は開かない。2026-10-26 社長が迷った) */}
          {(() => {
            const lock = debug ? null : CARD_LEVEL_ORDER.find((lv) => !cardLevelOpen(save.unlocked, lv));
            const prev = lock ? CARD_LEVEL_ORDER[CARD_LEVEL_ORDER.indexOf(lock) - 1] : null;
            return lock && prev ? <p data-card-level-hint={lock} className="px-0.5 text-[11px] font-bold text-amber-200/90" style={JA_LABEL_STYLE}>{jaWrap(`🔒 ${CARD_LEVEL_LABEL[lock]} は ${CARD_LEVEL_LABEL[prev]} で勝つと開きます`)}</p> : null;
          })()}
          <div className="grid grid-cols-5 gap-1">
            {CARD_LEVEL_ORDER.map((lv) => {
              const open = cardLevelOpen(save.unlocked, lv) || debug;
              return (
                <button key={lv} type="button" data-card-level={lv} disabled={!open} onClick={() => { Audio_.fgSe.tap(); setFoe((f) => ({ ...f, level: lv })); }} className={`min-h-[52px] rounded-xl border-2 text-[11px] font-black ${foe.level === lv ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-white/10 bg-slate-900 text-slate-200'} disabled:opacity-35`}>
                  {CARD_LEVEL_LABEL[lv]}<span className="block text-[10px] text-amber-200">{open ? `勝ち${CARD_AI_LEVELS[lv].point}` : '🔒'}</span>
                </button>
              );
            })}
          </div>
          {debug && <p className="text-[11px] font-bold text-slate-400">(デバッグ: まだ開いていない強さも選べます。開いた印は勝ったときだけ付きます)</p>}
          {/* 横の画面は、紹介と型の欄を左右に並べる(縦に積むと強さのボタンが下へ出た。landscape-screens-check) */}
          <div className="space-y-2 landscape:grid landscape:grid-cols-2 landscape:items-stretch landscape:gap-2 landscape:space-y-0">
          {a && (
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2 landscape:items-center">
              {/* 背の低い画面(SE)では絵を低くして、下の「あなたのデッキ」の欄まで1画面に入れる(2026-10-24 改善部の点検 V2) */}
              {/* 横画面: 前は絵を外していた(2026-10-25 カゲあつくん「EASY〜が下で切れている」)が、この欄は右の欄と同じ高さに伸びるので、
                  上が空白になっていた(2026-10-26 巡回)。強さのボタンはこの欄より上にあるので、欄の高さに収まる大きさで出す。
                  高さは縦の画面では今までどおり 17vh(縦長では 17vh が 28vmin より大きい)。横の画面だけ 28vmin まで大きくなる */}
              <CardAssistantArt src={assistantFullImage(a, 'wink')} alt={a.name} className="w-[42%]" style={{ height: 'min(150px, max(17vh, 28vmin))' }}/>
              <div className="min-w-0 flex-1 pb-2">
                <div className="text-[11px] font-bold text-slate-400">{a.tagline}</div>
                <div className="mt-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: a.accent, ...JA_WRAP_STYLE }}>{line ? cardJaWrap(line.text) : ''}</div>
              </div>
            </div>
          )}
          {a && <CardFoeStyle db={db} who={a.id} level={foe.level}/>}
          </div>
          {notice && <p className="text-[12px] font-bold text-amber-200" style={JA_LABEL_STYLE}>{jaWrap(notice)}</p>}
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          {/* プレイヤーが対戦に使うデッキ。「使うデッキ」だと相手の助手のデッキと読まれた(2026-10-26 社長)ので「あなたの」と書く。助手のデッキは上の欄(好きな子・よく使うカード)
              「対戦する」のすぐ上に固定する。上の一覧の終わりに置いていたら、375×667 で「対戦する」の帯の下に隠れ、だれのデッキで戦うか見ないまま押せた(2026-10-26 ソランドくん) */}
          <div data-card-foe-mydeck className="mb-1.5 px-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 text-[12px] font-bold text-slate-300">
              <span style={JA_LABEL_STYLE}>あなたのデッキ: <b className="text-white">{activeDeck ? activeDeck.name : 'なし'}</b></span>
              {!save.daily.firstWin && <span className="text-[11px] text-slate-400" style={JA_LABEL_STYLE}>{cardRuleLine('《今日はじめての勝ちで +50》')}</span>}
            </div>
            {deckIssues.length > 0 && <div className="mt-0.5 text-[12px] font-bold text-rose-300" style={JA_WRAP_STYLE}>{jaWrap(deckIssues.join('・'))}</div>}
          </div>
          <button type="button" data-card-start className={`${btn} mh-button-primary`} disabled={!a || deckIssues.length > 0} onClick={() => startBattle(foe)}>対戦する</button>
        </div>
      </div>
    );
  }

  // ---- 結果 ----
  // デッキ編成(87-card-deck-edit.jsx)。保存はここで mh_card_decks_v1 へまとめて入れる
  if (view === 'deckEdit' && editDeck) {
    return <CardDeckEditor key={editDeck.id} db={db} collection={save.collection} deck={editDeck} advisor={topAssistant} onCancel={() => { setEditDeck(null); setView('decks'); }} onSave={async (d) => {
      const ok = await persist({ decks: cardDecksPut(save.decks, d) });
      setNotice(ok ? `「${d.name}」を保存しました` : '保存できませんでした');
      setEditDeck(null); setView('decks');
    }}/>;
  }
  if (view === 'packArt') {
    return (
      <div data-mh-screen data-card-pack-art-list className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="パックの絵(見本)" accent="text-amber-200" onBack={() => setView('top')} note="弾ごとに色を変えて、その弾で出るモンスターを並べた"/>
        <div className={`${SCREEN_LIST_CLASS} pb-4`}>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">{CARD_PACKS.map((pk) => <div key={pk.id} className="flex flex-col items-center"><CardPackArt db={db} pack={pk} width={114}/><span className="mt-1 text-[12px] font-black text-white">{pk.name}</span></div>)}</div>
        </div>
      </div>
    );
  }
  if (view === 'packOpen' && packDemo) return <CardPackOpen key={`demo-${packDemo.packs.length}`} db={db} result={packDemo} onDone={() => { setPackDemo(null); setView('top'); }}/>;
  if (view === 'dex') return <CardDex db={db} collection={save.collection} onBack={() => setView('top')}/>;
  if (view === 'rules') return <CardRules onBack={() => setView('top')} onTutorial={() => startTutorial()}/>;
  if (view === 'decks') {
    return (
      <>
        <CardDeckList db={db} collection={save.collection} decks={save.decks} onBack={() => { setNotice(''); setView('top'); }}
          onEdit={(d) => { setNotice(''); setEditDeck(d); setView('deckEdit'); }}
          onPut={async (d) => { const ok = await persist({ decks: cardDecksPut(save.decks, d) }); setNotice(ok ? `「${d.name}」を作りました` : '保存できませんでした'); }}
          onRemove={async (id) => { const ok = await persist({ decks: cardDecksRemove(save.decks, id) }); setNotice(ok ? 'デッキを消しました' : '保存できませんでした'); }}
          onActive={async (id) => { const ok = await persist({ decks: { ...save.decks, active: id } }); setNotice(ok ? '対戦に使うデッキを変えました' : '保存できませんでした'); }}/>
        {notice && <div data-card-deck-toast className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit rounded-full bg-slate-950/95 px-4 py-2 text-[13px] font-black text-amber-200 shadow-lg" style={JA_LABEL_STYLE}>{jaWrap(notice)}</div>}
      </>
    );
  }

  if (view === 'result' && result && result.tutorial) {
    return (
      <div data-mh-screen data-card-top="result" data-card-outcome={result.done ? 'tutorialDone' : 'tutorialSkip'} className={SCREEN_SHELL_CLASS}>
        <ScreenHead title={result.done ? '練習試合クリア！' : '練習試合を飛ばしました'} accent="text-amber-200" onBack={() => setView('top')}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {/* 練習試合のクリアにも、見出しと先生(ドラ)の絵を出す(文字だけだった・V6) */}
          {result.done && <CardResultBanner title="クリア！" sub="TUTORIAL CLEAR" tone="win"/>}
          {(() => { const dra = allAssistants.find((x) => x.id === 'dra'); return dra ? (
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <CardAssistantArt src={assistantFullImage(dra, result.done ? 'happy' : 'normal')} alt={dra.name} className="w-[42%]" style={{ height: 'min(180px, 24vh)' }}/>
              <div className="mb-2 min-w-0 flex-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: dra.accent, ...JA_WRAP_STYLE }}>{cardJaWrap(result.done ? 'よくやったな。これで決まりはひととおりだ。あとは対戦で慣れていこう' : 'またいつでも練習しような。トップの「ルール」から、また練習試合できるぞ')}</div>
            </div>
          ) : null; })()}
          <div className={SCREEN_PANEL_CLASS}>
            {result.done && result.reward > 0 && <div className="text-[15px] font-black text-amber-200">ビートP {result.reward}</div>}
            <div className="mt-1 text-[12px] font-bold text-slate-300" style={JA_LABEL_STYLE}>{jaWrap(result.done ? '引く・ガッツ・守り・攻撃・山札切れの5つを覚えました。いろんな相手と戦ってみましょう' : 'トップの「練習試合」から、いつでもできます')}</div>
            <div className="mt-1 text-[12px] font-bold text-slate-300">いまのビートP: {save.point}</div>
            {!result.saved && <div className="mt-1 text-[12px] font-bold text-rose-300">保存できませんでした</div>}
          </div>
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" className={`${btn} mh-button-primary`} onClick={() => setView('top')}>トップへ</button>
        </div>
      </div>
    );
  }
  if (view === 'result' && result) {
    const a = allAssistants.find((x) => x.id === result.who);
    const win = result.outcome === 'win';
    const r = result.reward;
    return (
      <div data-mh-screen data-card-top="result" data-card-outcome={result.outcome} data-card-gain={result.demo ? undefined : r.total} className={SCREEN_SHELL_CLASS}>
        {win && <CardConfetti/>}
        <ScreenHead title={win ? '勝ち！' : result.outcome === 'surrender' ? '投了' : '負け…'} accent={win ? 'text-amber-200' : 'text-slate-300'} onBack={() => setView('top')}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          <CardResultBanner title={win ? '勝ち！' : result.outcome === 'surrender' ? '投了' : '負け…'} sub={win ? 'YOU WIN' : result.outcome === 'surrender' ? 'SURRENDER' : 'YOU LOSE'} tone={win ? 'win' : 'lose'}/>
          {a && <CardResultTalk a={a} lineScene={win ? 'lose' : 'win'} talkFacts={result.talk}/>}
          {a && <CardResultVsRow meIcon={rank && typeof rank.renderMeIcon === 'function' ? rank.renderMeIcon() : null} meName={(rank && rank.profile && rank.profile.name) || 'あなた'}
            foeNode={<img src={assistantFaceImage(a, 'normal')} alt="" className="h-8 w-8 rounded-lg border-2 bg-black object-cover object-top" style={{ borderColor: a.accent }}/>} foeName={a.name} outcome={win ? '勝ち' : result.outcome === 'surrender' ? '投了' : '負け'}/>}
          <div className={SCREEN_PANEL_CLASS}>
            {/* もらったビートPは大きく数え上げる(下の行が本当の数。数え上げは飾り) */}
            {!result.demo && r.total > 0 && <div data-card-gain-count className="mb-1 text-center text-[32px] font-black leading-none text-amber-200 [text-shadow:0_0_16px_rgba(251,191,36,.55)]">+<CardCountUp to={r.total}/><span className="ml-1 text-[14px]">ビートP</span></div>}
            <div className="text-[13px] font-black text-amber-200">もらったビートP: {r.total}</div>
            <div className="mt-1 text-[12px] font-bold text-slate-300">{CARD_LEVEL_LABEL[result.level]}の{win ? '勝ち' : result.outcome === 'lose' ? '負け' : '投了'}: {cardResultCut(r) ? `${r.full} → ${r.got}` : r.got}</div>
            {cardResultCut(r) && <div data-card-result-cut className="text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap(cardResultCutWhy(result.outcome, r))}</div>}
            {r.bonus > 0 && <div className="text-[12px] font-bold text-slate-300">今日はじめての勝ち: +{r.bonus}</div>}
            {r.short && <div className="mt-1 text-[11px] font-bold text-slate-500" style={JA_LABEL_STYLE}>{jaWrap('自分の番を3回やる前に終わったので、ビートPとクイック周回は入りません')}</div>}
            {!r.short && result.loops > 0 && result.quick && (
              <div data-card-quick-loops={result.quick ? result.loops : 0} className="mt-2 rounded-xl border border-sky-300/40 bg-sky-500/10 px-2 py-1.5">
                {result.quick && <>
                    <div className="text-[13px] font-black text-sky-200">クイック周回 {result.loops}周ぶん</div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>裏のクイック周回({(result.quick.quickDifficulty && String(quickDifficultySetting(result.quick.quickDifficulty)?.label || '').toUpperCase()) || 'AUTO設定'})が{result.loops}周ぶん進みました</div>
                    {result.quick.live && Number(result.quick.toLoop) > Number(result.quick.fromLoop) && <div data-card-quick-loops-range className="mt-0.5 text-[11px] font-bold text-sky-100">{result.quick.fromLoop}周目 → {result.quick.toLoop}周目</div>}
                  </>}
              </div>
            )}
            <div className="mt-1 text-[12px] font-bold text-slate-300">いまのビートP: {save.point}</div>
            {result.opened && <div className="mt-1 text-[13px] font-black text-emerald-300">{CARD_LEVEL_LABEL[result.opened]}が選べるようになりました！</div>}
            {!result.saved && <div className="mt-1 text-[12px] font-bold text-rose-300" style={JA_LABEL_STYLE}>{jaWrap('保存できませんでした(ビートPは増えていません)')}</div>}
            {result.demo && <div className="mt-1 text-[11px] font-bold text-slate-400">(デバッグの見本です。何も保存していません)</div>}
          </div>
        </div>
        <div className={`${SCREEN_FOOTER_CLASS} grid grid-cols-2 gap-2`}>
          {result.replay && <button type="button" data-card-result-replay className={`${btn} mh-button-secondary col-span-2 border border-sky-300/40 bg-slate-800`} onClick={() => { Audio_.fgSe.tap(); void openReplay(result.replay, 'result'); }}>この対戦を見る</button>}
          <button type="button" className={`${btn} mh-button-primary`} onClick={() => { const again = { who: result.who, level: result.level }; setFoe(again); startBattle(again); }}>もう一度</button>
          <button type="button" className={`${btn} mh-button-secondary border border-white/20 bg-slate-800`} onClick={() => setView('foe')}>相手をえらぶ</button>
        </div>
      </div>
    );
  }

  // ---- 記録 ----
  // 過去の対戦の一覧(93-card-replay.jsx。2026-10-27 社長「記録にも残してそこからみれるように」)
  if (view === 'replays') return <CardReplayList onOpen={(id) => { void openReplay(id, 'replays'); }} onBack={() => setView('record')}/>;
  // マルチの履歴(92-card-pvp-history.jsx)。記録の「マルチ」から開く
  if (view === 'pvpHistory' && typeof CardPvpHistory === 'function') return <CardPvpHistory onBack={() => setView('record')} onOpenReplay={(id) => { void openReplay(id, 'pvpHistory'); }} replayHas={cardReplayHas} meIcon={rank && typeof rank.renderMeIcon === 'function' ? rank.renderMeIcon() : null} meName={myName}/>;
  // 記録(90-card-rank.jsx の CardRecordScreen。2026-10-27 社長「全体」「助手ごと」「マルチ」)
  if (view === 'record') return <CardRecordScreen db={db} save={save} foes={foes} levelLabel={CARD_LEVEL_LABEL} onBack={() => setView('top')} onOpenReplays={() => setView('replays')} onOpenPvpHistory={typeof CardPvpHistory === 'function' ? () => setView('pvpHistory') : null}/>;
  // ---- オプション(BGM・演出) ----
  if (view === 'options') {
    // 裏のクイック周回の自動(社長 2026-10-25「モンヒロビートと同じように」)。編成は AUTO設定の「モンヒロビート中に回すクイック周回」と同じものを使う
    // 助手と対戦の曲の並び(2026-10-26 社長の依頼)。助手ごとに1〜5曲。直すたびにその場で保存する(開いただけでは保存しない)
    const plWhoList = foes.length ? foes : allAssistants.filter((a) => CARD_CPU_PLAYLIST_DEFAULT[a.id] && cardFoeReleased(a.id));
    const plCur = plWhoList.some((a) => a.id === plWho) ? plWho : (plWhoList[0] && plWhoList[0].id);
    const plSave = (assistants) => { void persist({ cpuPlaylist: cardNormalizeCpuPlaylist({ v: 1, assistants }, cardIsBgmTrack) }); };
    const plList = cardCpuPlaylistOf(save.cpuPlaylist, plCur);
    const plIsDefault = plList.length === 1 && plList[0] === CARD_AI_BGM[plCur];
    const plCurName = ((plWhoList.find((a) => a.id === plCur) || {}).name) || '';
    const cpuPlaylistPanel = (
          <div data-card-playlist className="mt-3 border-t border-white/10 pt-2.5">
            <b className="block text-[12px] font-black text-slate-200">助手と対戦</b>
            <p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('助手1人につき5曲まで選べます。対戦中は、選んだ曲を毎回ちがう順番で、続けて流します')}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {plWhoList.map((a) => (
                <button key={a.id} type="button" data-card-playlist-who={a.id} aria-pressed={a.id === plCur} onClick={() => { Audio_.fgSe.tap(); setPlWho(a.id); }}
                  className={`min-h-[40px] min-w-0 rounded-xl border px-1 text-[11px] font-black ${a.id === plCur ? 'border-amber-300 bg-amber-600/85 text-white' : 'border-white/15 bg-slate-900/75 text-slate-200'}`}>
                  {jaWrap(a.name)}<small className="ml-0.5 text-[10px] opacity-80">{cardCpuPlaylistOf(save.cpuPlaylist, a.id).length}曲</small>
                </button>
              ))}
            </div>
            {plCur && (
              <div data-card-playlist-edit={plCur} className="mt-2">
                <CardPlaylistRows tag="who" list={plList} bgmPreview={bgmPreview} onChange={(next) => plSave({ ...save.cpuPlaylist.assistants, [plCur]: next })}/>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button type="button" data-card-playlist-reset disabled={plIsDefault} onClick={() => plSave({ ...save.cpuPlaylist.assistants, [plCur]: [...CARD_CPU_PLAYLIST_DEFAULT[plCur]] })}
                    className={`min-h-[44px] rounded-xl px-1 text-[11px] font-black ${plIsDefault ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 text-white'}`}>{jaWrap('はじめの曲に戻す')}</button>
                  <button type="button" data-card-playlist-copy-open onClick={() => { Audio_.fgSe.tap(); setPlCopy({ list: [...plList], confirm: false, from: plCurName }); }}
                    className="min-h-[44px] rounded-xl bg-indigo-800 px-1 text-[11px] font-black text-white">{jaWrap(`${plCurName}の曲を全員に写す`)}</button>
                </div>
              </div>
            )}
            {plCopy && (
              <div data-card-playlist-copy className="mt-2.5 rounded-xl border border-indigo-300/40 bg-indigo-950/60 p-2.5">
                <b className="block text-[12px] font-black text-white">{jaWrap(`${plCopy.from}の曲を全員に写す`)}</b>
                <p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(`はじめは${plCopy.from}の曲が入っています。ここで1〜5曲に直してから、助手みんなの曲にできます。あとから助手を選んで直せます`)}</p>
                <CardPlaylistRows tag="copy" list={plCopy.list} bgmPreview={bgmPreview} onChange={(next) => setPlCopy({ ...plCopy, list: next, confirm: false })}/>
                {plCopy.confirm
                  ? <div data-card-playlist-copy-confirm className="mt-2">
                      <p className="text-[11px] font-black leading-snug text-amber-200" style={JA_WRAP_STYLE}>{jaWrap('助手みんなの曲が、この曲に置き換わります。よろしいですか?')}</p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button type="button" data-card-playlist-copy-cancel onClick={() => setPlCopy(null)} className="min-h-[44px] rounded-xl bg-slate-700 text-[12px] font-black text-white">やめる</button>
                        <button type="button" data-card-playlist-copy-ok onClick={() => { const list = [...plCopy.list]; plSave(Object.fromEntries(Object.keys(CARD_CPU_PLAYLIST_DEFAULT).filter((who) => cardFoeReleased(who)).map((who) => [who, list]))); setPlCopy(null); }}
                          className="min-h-[44px] rounded-xl bg-amber-500 text-[12px] font-black text-slate-900">置き換える</button>
                      </div>
                    </div>
                  : <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button type="button" data-card-playlist-copy-cancel onClick={() => setPlCopy(null)} className="min-h-[44px] rounded-xl bg-slate-700 text-[12px] font-black text-white">やめる</button>
                      <button type="button" data-card-playlist-copy-go onClick={() => setPlCopy({ ...plCopy, confirm: true })} className="min-h-[44px] rounded-xl bg-indigo-600 text-[12px] font-black text-white">{jaWrap('全員に写す')}</button>
                    </div>}
              </div>
            )}
          </div>
    );
    const bgmPanel = (
          <div data-card-options-bgm className={SCREEN_PANEL_CLASS}>
            <div className="text-[13px] font-black text-white">音</div>
            <b className="mt-2 block text-[12px] font-black text-slate-200">対戦のBGM</b>
            {[['top', 'トップ画面'], ['pvp', 'マルチ対戦']].map(([k, label]) => (
              <label key={k} className="mt-2 block text-left">
                <span className="text-[11px] font-black text-slate-300">{label}{k === 'pvp' && !(typeof cardPvpOpen === 'function' && cardPvpOpen()) ? '(準備中)' : ''}</span>
                <div className="mt-1 flex gap-2">
                  <select data-card-bgm-select={k} aria-label={`${label}のBGM`} value={save.bgm[k]} onChange={(e) => { void persist({ bgm: normalizeCardBgm({ ...save.bgm, [k]: e.target.value }, cardIsBgmTrack) }); }}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-2 py-2 text-xs text-white">
                    {(typeof BGM_TRACKS !== 'undefined' ? BGM_TRACKS : []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.id === CARD_BGM_DEFAULT[k] ? '(はじめの曲)' : ''}</option>)}
                  </select>
                  {bgmPreview && <button type="button" data-card-bgm-preview={k} onClick={() => bgmPreview.toggle(save.bgm[k])} className="min-h-[44px] min-w-[58px] shrink-0 rounded-xl bg-indigo-700 px-2 text-xs font-black">{bgmPreview.playing === save.bgm[k] ? '停止' : '試聴'}</button>}
                </div>
              </label>
            ))}
            {cpuPlaylistPanel}
            <p data-card-options-se className="mt-1 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('音の大きさは、ゲーム全体の設定の「音量」で変えられます')}</p>
          </div>
    );
    // 対戦の BGM(社長「バトルと同じように自分で決められる」)。いまの BGM アレンジと同じ、曲の一覧から選んで試聴できる形(上の bgmPanel)
    const quickAutoPanel = (
          <div data-card-options-quick data-card-setting="quickAutoStart" className="mt-2.5 border-t border-white/10 pt-2.5">
            <b className="block text-[12px] font-black text-slate-200">裏のクイック周回</b>
            <div className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-slate-200" style={JA_LABEL_STYLE}>{jaWrap('MFバトルカードを開いたら自動で始める')}</span>
              <button type="button" data-card-quick-auto aria-pressed={save.settings.quickAutoStart} onClick={() => { Audio_.fgSe.tap(); void persist({ settings: { ...save.settings, quickAutoStart: !save.settings.quickAutoStart } }); }}
                className={`min-h-[36px] shrink-0 rounded-full border px-3 text-[11px] font-black ${save.settings.quickAutoStart ? 'border-emerald-300 bg-emerald-700/85 text-white' : 'border-white/25 bg-slate-900/75 text-slate-200'}`}>{save.settings.quickAutoStart ? 'ON' : 'OFF'}</button>
            </div>
            <p className="mt-1.5 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('ONにすると、MFバトルカードを開いたときに、裏でクイックの∞周回を始めます。負けたときは、少しおいて1周目から始め直します。編成は、AUTO設定の「モンヒロビート中に回すクイック周回」と同じです')}</p>
            {!quickAutoReady && <p data-card-quick-auto-needs className="mt-1 text-[10px] font-bold leading-snug text-amber-200" style={JA_WRAP_STYLE}>{jaWrap('AUTO設定で、勇者モン・配置距離・難易度の3つを決めると使えます')}</p>}
          </div>
    );
    return (
      <div data-mh-screen data-card-options className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="オプション" accent="text-amber-200" onBack={() => setView('top')} note="MFバトルカード"/>
        {/* 一覧の外は、横画面では左の列に積まれる(左が見出しだけで空いていた。2026-10-27 ツナグくんの見回り)。縦では今までどおり一覧の上 */}
        <div data-card-options-side className="mb-2 shrink-0 space-y-2">
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[13px] font-black text-white">トップの助手</div>
            <div className="mt-1.5 flex justify-end"><ModeSelectAssistToggles assistant={topAssistant} showArt={assist.modeSelectArt} showComment={assist.modeSelectComment} onToggle={toggleAssist} cls="" withLabel/></div>
          </div>
          {/* 項目の目次(横画面だけ)。押すと右の一覧の箱だけをその項目へ動かす(scrollIntoView は画面ごと動かすことがあるので使わない。viewport-height-check) */}
          <div data-card-options-toc className={`${SCREEN_PANEL_CLASS} hidden landscape:block`}>
            <div className="text-[11px] font-bold text-slate-400">項目</div>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {[...(cardTalkOpen() ? [['おしゃべり', '[data-card-ai-talk-panel]']] : []), ...CARD_SETTING_GROUPS.map((g) => [g.title, `[data-card-setting-group="${g.title}"]`]), ['音', '[data-card-options-bgm]']].map(([label, sel]) => (
                <button key={label} type="button" data-card-options-jump={label} onClick={() => { Audio_.fgSe.tap(); const box = document.querySelector('[data-card-options] .mh-scroll'); const el = box && box.querySelector(sel); if (el) box.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 4), behavior: 'smooth' }); }}
                  className="min-h-[34px] min-w-0 rounded-lg border border-white/15 bg-slate-800/80 px-1 text-[11px] font-black text-slate-100">{jaWrap(label)}</button>
              ))}
            </div>
          </div>
        </div>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {cardTalkOpen() && (
            <div data-card-ai-talk-panel className={SCREEN_PANEL_CLASS}>
              <div className="flex items-center gap-2">
                <b className="min-w-0 flex-1 text-[13px] font-black text-white">助手のおしゃべり(AI)</b>
                <button type="button" data-card-ai-talk aria-pressed={aiTalk} onClick={() => { Audio_.fgSe.tap(); toggleAiTalk(); }}
                  className={`min-h-[36px] shrink-0 rounded-full border px-3 text-[11px] font-black ${aiTalk ? 'border-emerald-300 bg-emerald-700/85 text-white' : 'border-white/25 bg-slate-900/75 text-slate-200'}`}>{aiTalk ? 'ON' : 'OFF'}</button>
              </div>
              <p className="mt-1.5 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('ONにすると、対戦のあと・対戦の山場・デッキ相談で、助手がその場に合わせたひとことを話します。うまく届かないときは、いつものセリフになります')}</p>
            </div>
          )}
          {/* 対戦中の設定(社長 2026-10-25「オプションでバトル中の設定関係を各種作って」)。並べ方・名前はモンヒロバトルの「バトルの見た目」と同じ形(題・説明・選択肢の名前と一言)。
              設定の中身は 82 の CARD_SETTING_GROUPS。保存は mh_card_settings_v1 に足した項目(前からの人は既定値で補う) */}
          {CARD_SETTING_GROUPS.map((g) => (
            <React.Fragment key={g.title}>
            {/* 音(対戦のBGM)は「自動」と「表示」のあいだ(窓口の案の並び) */}
            {g.title === '表示' && bgmPanel}
            <div data-card-setting-group={g.title} className={SCREEN_PANEL_CLASS}>
              <div className="text-[13px] font-black text-white">{g.title}</div>
              {g.items.map((item) => {
                const cur = item.bool ? (save.settings[item.key] ? 'ON' : 'OFF') : save.settings[item.key];
                return (
                  <div key={item.key} data-card-setting={item.key} className="mt-2.5 border-t border-white/10 pt-2.5">
                    <b className="block text-[12px] font-black text-slate-200">{item.title}{item.only === 'cpu' && <small className="ml-1 text-[10px] font-bold text-slate-400">(助手と対戦)</small>}</b>
                    <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400" style={JA_WRAP_STYLE}>{cardJaWrap(item.desc)}</p>
                    <div className={`mt-2 grid gap-1.5 ${item.options.length >= 5 ? 'grid-cols-5' : item.options.length === 4 ? 'grid-cols-4' : item.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {item.options.map((o) => (
                        <button key={o.id} type="button" data-card-setting-option={o.id} aria-pressed={cur === o.id}
                          onClick={() => { Audio_.fgSe.tap(); void persist({ settings: normalizeCardSettings({ ...save.settings, [item.key]: item.bool ? o.id === 'ON' : o.id }) }); }}
                          className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl px-0.5 py-1 text-[11px] font-black leading-tight active:scale-95 ${cur === o.id ? 'border border-amber-300 bg-amber-500/30 text-amber-50' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
                          <span className="block whitespace-pre-line text-center">{o.label}</span>
                          <small className="mt-0.5 block text-center text-[9px] font-bold leading-tight opacity-80">{o.note}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {g.title === '自動' && quickAutoPanel}
            </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
  // ---- ランキング ----
  if (view === 'ranking') {
    return <CardRankingBoard onBack={() => setView('top')} renderBreederIcon={rank && rank.renderBreederIcon} selfName={(rank && rank.profile && rank.profile.name) || ''} record={save.record} dex={cardDexCounts(db, save.collection)} sendOn={!!(rank && rank.send) && !debug}
      syncArgs={rank && rank.profile ? { db, record: save.record, collection: save.collection, profile: rank.profile } : null}/>;
  }

  // ---- トップ(モンヒロビートのモードえらび・モンヒロバトルの入口と同じ作り。社長 台帳 #3513) ----
  //   上: 英字の小見出しと題 / まんなか: 助手の大きい立ち絵と吹き出し / その下: 色つきの大きい札 2×2 / いちばん下: 小さいボタンの列
  // 吹き出しの文は言葉の切れ目で折る(「どこまでいく/かな」のように折れないように)
  // 台詞は文字のまま渡す(入口の吹き出し ModeSelectAssistantPanel が jaWrap で折る。前は折った部品を渡し、「[object Object]」と出た。2026-10-27)
  const topAssistantShown = topAssistant;
  const assistShown = !!topAssistant && (assist.modeSelectArt || assist.modeSelectComment);
  const go = (v) => () => { Audio_.fgSe.tap(); setNotice(''); setView(v); };
  const bigCards = [
    { key: 'cpu', attr: { 'data-card-cpu': '' }, label: '対戦', sub: '助手と対戦・マルチ対戦', mark: 'BATTLE', ico: '⚔️', grad: 'from-orange-200 via-orange-400 to-rose-500', disabled: !activeDeck, onClick: go('mode') },
    { key: 'decks', attr: { 'data-card-decks': '' }, label: 'デッキ編成', sub: 'デッキを組む・えらぶ', mark: 'DECK', ico: '🃏', grad: 'from-yellow-200 via-amber-300 to-orange-400', onClick: go('decks') },
    { key: 'market', attr: { 'data-card-market-open': '' }, label: 'マーケット', sub: 'パック・スターターキット', mark: 'MARKET', ico: '🛒', grad: 'from-sky-200 via-sky-400 to-blue-500', onClick: () => { Audio_.fgSe.tap(); setNotice(''); onOpenMarket && onOpenMarket(); } },
    { key: 'ranking', attr: { 'data-card-ranking-open': '' }, label: 'ランキング', sub: '勝ち数・連勝・図鑑', mark: 'RANKING', ico: '🏆', grad: 'from-lime-200 via-emerald-300 to-teal-500', onClick: go('ranking') },
  ];
  const smallButtons = [
    { key: 'dex', attr: { 'data-card-dex-open': '' }, label: 'カード図鑑', ico: '📖', tone: 'text-sky-100', onClick: go('dex') },
    // 練習試合のやり直しは、ルールの画面の中(ドラの D20「ルールの画面から、いつでもこの練習試合をやり直せる」)
    { key: 'rules', attr: { 'data-card-rules-open': '' }, label: 'ルール', sub: '練習試合', ico: '📘', tone: 'text-emerald-100', onClick: go('rules') },
    { key: 'record', attr: { 'data-card-record-open': '' }, label: '記録', ico: '📊', tone: 'text-amber-100', onClick: go('record') },
    { key: 'options', attr: { 'data-card-options-open': '' }, label: 'オプション', sub: 'BGM・演出', ico: '⚙️', tone: 'text-fuchsia-100', onClick: go('options') },
  ];
  return (
    <div data-mh-screen data-card-top="top" className="mhms-stage relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white">
      <RhythmModeSelectStage notes={false}/>
      <header className="relative z-10 flex shrink-0 items-center gap-1.5 border-b border-fuchsia-300/20 bg-slate-950/55 px-2 py-1 backdrop-blur-sm">
        <button type="button" aria-label={exitLabel} onClick={onExit} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-lg font-black text-slate-300 active:scale-90">←</button>
        <div className="min-w-0 flex-1 leading-none">
          <small className="block truncate text-[8px] font-black tracking-[0.2em] text-fuchsia-300">MF BATTLE CARD ・ TOP</small>
          <b className="mhms-title block truncate text-lg font-black leading-tight tracking-wider">MFバトルカード</b>
          <small className="block truncate text-[9px] font-black text-slate-300/90">{debug ? 'デバッグ専用(まだ公開していません)' : 'カードで助手と対戦しよう'}</small>
        </div>
        <span data-card-point-pill className="shrink-0 rounded-full border border-amber-300/50 bg-slate-950/70 px-2.5 py-1 text-[11px] font-black text-amber-100"><span aria-hidden="true">🎟️</span> <span data-card-point>{save.point}</span></span>
      </header>
      <div className={`relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto landscape:flex-row landscape:overflow-hidden ${assistShown && assist.modeSelectArt ? '' : 'portrait:justify-center'}`}>
        <ModeSelectAssistantPanel assistant={topAssistantShown} showArt={assist.modeSelectArt} showComment={assist.modeSelectComment} onToggle={toggleAssist}/>
        <div data-card-top-menu className="shrink-0 space-y-2 p-3 landscape:flex landscape:min-h-0 landscape:flex-1 landscape:shrink landscape:flex-col landscape:overflow-y-auto landscape:py-2 landscape:[&>*:first-child]:mt-auto landscape:[&>*:last-child]:mb-auto [@media(orientation:landscape)_and_(max-height:360px)]:space-y-1.5">
          {!assistShown && topAssistant && <ModeSelectAssistToggles assistant={topAssistant} showArt={assist.modeSelectArt} showComment={assist.modeSelectComment} onToggle={toggleAssist} cls="justify-end" withLabel/>}
          {/* 横の画面は、はみ出すときは上から並べる(justify-center だと上の段が送っても見えない所へ出た。2026-10-25 ダメダシくん)。背の低い横画面ではボタンを詰める */}
          {/* いまのデッキ(小さく。押すとデッキ編成へ) */}
          {activeDeck && (
            <button type="button" data-card-active-deck onClick={go('decks')} className="mhms-glass mhms-in flex w-full min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5 text-left active:scale-[.98] [@media(orientation:landscape)_and_(max-height:360px)]:py-1">
              <small className="shrink-0 text-[10px] font-black text-slate-400">いまのデッキ</small>
              <b className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{activeDeck.name}</b>
              <span aria-hidden="true" className="flex shrink-0 -space-x-2">{activeDeck.monsters.map((no) => { const m = cardMonsterOf(db, no); return m ? <img key={no} src={CARD_IMG(m.img)} alt="" className="h-8 w-6 [@media(orientation:landscape)_and_(max-height:360px)]:h-6 [@media(orientation:landscape)_and_(max-height:360px)]:w-[18px] rounded-[3px] border border-white/40 object-cover"/> : null; })}</span>
            </button>
          )}
          {/* 横の背の低い画面(高さ420まで)では1行に縮める(2行だと下のボタンが画面の外へ押し出される。667×375 の点検) */}
          {notice && <p data-card-top-notice className={`text-[12px] font-bold text-amber-200 [@media(orientation:landscape)_and_(max-height:420px)]:truncate [@media(orientation:landscape)_and_(max-height:420px)]:text-[11px] [@media(orientation:landscape)_and_(max-height:420px)]:leading-snug`} style={JA_LABEL_STYLE} title={notice}>{jaWrap(notice)}</p>}
          <div data-card-top-cards className="grid grid-cols-2 gap-2">
            {bigCards.map((c, idx) => (
              <button key={c.key} type="button" {...c.attr} disabled={!!c.disabled} onClick={c.onClick}
                className={`mhms-card mhms-in flex min-h-[84px] min-w-0 flex-col items-start justify-center gap-1 bg-gradient-to-br ${c.grad} px-3 text-left text-slate-950 active:scale-[.97] disabled:opacity-50 landscape:min-h-[76px] [@media(orientation:landscape)_and_(max-height:360px)]:min-h-[58px] [@media(orientation:landscape)_and_(max-height:330px)]:min-h-[46px] [@media(orientation:landscape)_and_(max-height:360px)]:gap-0`} style={{ animationDelay: `${0.05 + idx * 0.06}s` }}>
                <span aria-hidden="true" className="mhms-mark">{c.mark}</span>
                <span aria-hidden="true" className="mhms-ico relative text-3xl leading-none [@media(orientation:landscape)_and_(max-height:330px)]:hidden">{c.ico}</span>
                <span className="relative min-w-0"><b className="block text-[18px] font-black italic leading-tight">{c.label}</b><small className="block text-[10px] font-black leading-tight text-slate-900/80">{c.sub}</small></span>
              </button>
            ))}
          </div>
          <div data-card-top-shortcuts className="mhms-in grid grid-cols-4 gap-1.5" style={{ animationDelay: '.28s' }}>
            {smallButtons.map((b) => (
              <button key={b.key} type="button" {...b.attr} onClick={b.onClick} className={`mhms-glass flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 leading-none active:scale-95 [@media(orientation:landscape)_and_(max-height:360px)]:min-h-[40px] [@media(orientation:landscape)_and_(max-height:360px)]:flex-row [@media(orientation:landscape)_and_(max-height:360px)]:gap-1 ${b.tone}`}>
                <span aria-hidden="true" className="text-lg">{b.ico}</span><b className="text-[11px] font-black">{b.label}</b>{b.sub && <small className="text-[9px] font-black text-slate-300/90 [@media(orientation:landscape)_and_(max-height:360px)]:hidden">{b.sub}</small>}
              </button>
            ))}
          </div>
        {debug && (
          <div className={`${SCREEN_PANEL_FLAT_CLASS} space-y-1`}>
            {/* 結果の画面の見本(NORMAL の勝ち・自分の番8回・2体倒した)。クイック周回が入るとき/入らないとき。保存は何もしない */}
            {/* パックの絵と開ける演出の見本(社長 台帳 #3503。保存はしない) */}
            <div className="grid grid-cols-2 gap-1">
              <button type="button" data-card-pack-art-demo className="mh-button mh-button-secondary min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[11px] font-black" onClick={() => { Audio_.fgSe.tap(); setView('packArt'); }}>パックの絵の見本</button>
              <button type="button" data-card-pack-open-demo className="mh-button mh-button-secondary min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[11px] font-black" onClick={() => {
                // 第1弾(p1)を2パック。1パック目の最後のモンスターの枠は別絵キラ、2パック目はキラ(演出を見るため)
                const a = cardOpenPack(db, 'p1', { collection: {}, pity: {} }, Math.random);
                const b = cardOpenPack(db, 'p1', { collection: a.collection, pity: {} }, Math.random);
                const alt = Object.values(db.monsters).find((m) => cardPackIdOf(db, m.no) === 'p1' && /別絵/.test(m.variant || ''));
                const kira = Object.values(db.monsters).find((m) => cardPackIdOf(db, m.no) === 'p1' && m.variant === 'キラ');
                a.cards[a.cards.length - 1] = { no: alt.no, slot: 'mon', rarity: 'alt', dup: false, point: 0 };
                b.cards[b.cards.length - 1] = { no: kira.no, slot: 'mon', rarity: 'kira', dup: false, point: 0 };
                setPackDemo({ packId: 'p1', packs: [a.cards, b.cards], dupPoint: 0, cost: 0, demo: true });
                setView('packOpen');
              }}>パックを開ける見本</button>
            </div>
            <select data-card-result-demo-who value={demoWho} onChange={(e) => setDemoWho(e.target.value)} className="w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1 text-[12px] font-bold text-white">
              {allAssistants.filter((x) => CARD_AI_HABITS[x.id] && cardFoeReleased(x.id)).map((x) => <option key={x.id} value={x.id}>見本の相手: {x.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-1">
              {[['in', '結果の見本(周回が入る)'], ['out', '結果の見本(入らない)']].map(([k, label]) => (
                <button key={k} type="button" data-card-result-demo={k} className="mh-button mh-button-secondary min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[11px] font-black" onClick={() => {
                  const facts = { ownTurns: 8, kos: 2 };
                  const reward = cardCpuReward(cardNormalizeDaily(null, cardTodayJst()), 'normal', 'win', facts);
                  setResult({ demo: true, outcome: 'win', reward, opened: null, saved: true, who: demoWho, level: 'normal', loops: cardCpuLoops('normal', 'win', facts), quick: k === 'in' ? { quickDifficulty: 'Normal' } : null, facts });
                  setView('result');
                }}>{label}</button>
              ))}
            </div>
            <div className="text-[11px] font-bold text-slate-400">デバッグ: カードバトルの記録(mh_card_* の新しいキーだけ)</div>
            <button type="button" data-card-motion-demo className="mh-button mh-button-secondary min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-800 text-[12px] font-black" onClick={() => {
              // 技の動きの見本(決まった順に自動で進む。保存は何もしない)
              const demo = cardMotionDemo(db);
              setResult(null);
              setGame({ key: `demo-${Date.now()}`, st: demo.st, who: 'mua', level: 'easy', demo: { steps: demo.steps } });
              onBgm && onBgm(CARD_AI_BGM.mua);
              onNavigate('CARD_BATTLE');
            }}>技の動きの見本を流す(保存しない)</button>
            <button type="button" className="mh-button mh-button-danger min-h-[44px] w-full rounded-xl text-[12px] font-black" onClick={() => setConfirmReset(true)}>カードバトルの記録を消して、スターター選びからやり直す</button>
          </div>
        )}
        </div>
      </div>
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
      {confirmReset && <ConfirmSheet title="カードバトルの記録を消しますか？" message={'持っているカード・デッキ・ビートP・戦績・スターターの印を消します。\nほかのモードの保存データには触れません。'} confirmLabel="消す" danger onCancel={() => setConfirmReset(false)} onConfirm={async () => {
        setConfirmReset(false);
        await Promise.all(Object.values(CARD_SAVE_KEYS).map((k) => storeSet(k, null)));
        setNotice('');
        await load();
      }}/>}
    </div>
  );
};
