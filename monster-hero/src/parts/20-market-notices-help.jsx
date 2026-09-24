// マーケットは1行に3商品ずつ並べる。4つだと幅360pxの端末で1枚76pxしか取れず、
// そのせいで商品名が9px・購入ボタンが30pxまで縮んでいた(2026-09-18)。3つなら1枚約103px。
const MARKET_GRID_CLASS = 'grid grid-cols-3 gap-2.5 pb-4';
// 商品アイコンの大きさ。円盤石は絵を見せたいのでいちばん大きく、
// ブリーダーアイコンやカード・アイテムは名前のほうが大事なので小さくする
const MARKET_ICON_SIZE = { disc: 'w-12 h-12', assist: 'w-10 h-10', icon: 'w-10 h-10', item: 'w-9 h-9' };
// 全身画像を使う一部のアイコンは、画像自体には手を加えず表示時だけ顔まわりへ寄せる。
// 帽子を残したまま顔が円の中央で大きく見えるよう、対象IDごとに拡大率と位置を固定する。
const MARKET_PROFILE_ICON_STYLES = {
  Tiger: { scale: 2.31, x: 3, y: 38 },
  // アーク。元PNGは顔そのものが右へ寄っている(目の中心が画像の58.3%＝右へ8.3%)。
  // 倍率だけを上げていたので「右に寄っている」と見えていた(2026-09-05・ユーザー指摘)。
  // x でそのぶんを打ち消す。元PNGは左右端まで描画が続くため、寄せたぶんを覆えるだけの
  // 倍率が要る(x=-8.3 なら s>=1.166。それ未満だと画像端の直線が枠内へ露出する)。
  // y は冠と光輪が上で切れないところまで下げた。
  ark_icon: { scale: 1.17, x: -8.3, y: 4 },
  kiki_icon: KIKI_FACE_ICON_ADJUSTMENT,
  snegurochka_icon: { scale: 4.28, x: 11, y: 111 },
  snegurochka_awakened_icon: { scale: 4.28, x: 9, y: 100 },
  // イブリース。1.42は「頭上のボールを枠の外へ出す」ために選んだ倍率だったが、
  // 顔に寄りすぎて角も上下も切れていた(2026-09-05・ユーザー指摘「近すぎる」)。
  // 角と光輪が丸ごと入るところまで引いた。ボールは元絵の一部なので出してよい。
  iblis_icon: { scale: 1.30, x: 0, y: -11 },
  // ウンディーネ・ヤオビクニの本人アイコンは、エイキ・剣士モッチーと同じく専用の顔クロップ
  // (UNDINE_FACE_ICON / YAOBIKUNI_FACE_ICON)を使うので、ここでの拡大・位置調整は要らない
  // (元から丸枠向けに切り出してある)。
  //
  // ⚠️ 2026-09-19、ここの倍率を 3.67→4.76 まで上げて顔を大きくしようとしたが実機で悪化した。
  // 立ち絵は尾ひれまで入っていて頭が小さく写っているので、倍率をいくら上げても
  // 「顔が小さい」か「耳が切れて何のキャラか分からない」のどちらかにしかならない。
  // 同じ人魚のスネグーラチカが良く見えていたのは、最初から顔クロップを持っていたから。
  // 倍率で解こうとせず、顔クロップを作るのが正解だった(tools/image/make-face-icons.js)。
  // なお見た目を変えるときは **実機と同じ40pxで描いて確かめる**こと。
  // 190pxの大きな丸で見ると、40pxでは潰れて消える耳や髪が「入っている」ように見える。
  mia_icon: { scale: 3.2, x: 0, y: 94 },
  // パンドラ。1.8では顔が小さく、ほかのアイコンより引いて見えた
  // (2026-09-05・ユーザー指摘「少し遠い」)。角と光輪が切れない範囲で寄せた。
  pandora_icon: { scale: 2.4, x: 0, y: 72 },
  // プラント。ほかのアイコンが枠の8〜10割を埋めているのに、ここだけ7割ほどしか
  // 埋まっておらず、1つだけ引いて見えた(2026-09-05・ユーザー指摘「全部見直して統一して」)。
  // 花の先が切れない範囲で寄せた。
  plant_icon: { scale: 1.25, x: 0, y: -3 },
  // みゅあ(アシストカードのアイコン)。顔が枠の中央より左に寄っていた。
  // 寄せたぶんを覆えるよう倍率も少しだけ上げている(x=2 なら s>=1.04)。
  mua: { scale: 1.06, x: 2, y: 4 },
  // --- 円盤石 ---
  // 円盤石は「円盤そのものを、どれも同じ大きさで真ん中に」出す。
  // 画像ごとに余白がまったく違い(正方形の絵は中身が97%、1536x1024の絵は幅の64%しかない)、
  // そのままだと同じ画面に大小の円盤が並ぶ。さらに「◯◯の円盤石」と
  // 「◯◯の円盤石アイコン」は同じ画像なのに調整が片方にしか無く、別物に見えていた。
  // ミーア・パンドラの円盤石には顔用の拡大値(s3.2 / s2.4)が付いており、
  // 円盤が枠からはみ出して顔だけが写っていた(2026-09-05・ユーザー指摘)。
  //
  // 下の値は tools/image/disc-icon-values.js が元画像から計算したもの。
  // 円盤の直径が枠の95%になり、円盤の中心が枠の中心へ来る。
  // 画像を差し替えたら、その道具を流し直してここへ貼り直す。
  Zan: { scale: 0.981, x: -0.4, y: -0.4 },
  Mitarashi: { scale: 1.022, x: 0, y: 0 },
  Ark: { scale: 0.957, x: 0, y: 0 },
  Iblis: { scale: 0.957, x: 0, y: 0 },
  Snegurochka: { scale: 1.487, x: 0.1, y: 1.4 },
  undine_disc_icon: { scale: 1.489, x: 0, y: 2.1 },
  Undine: { scale: 1.489, x: 0, y: 2.1 },
  yaobikuni_disc_icon: { scale: 1.518, x: 0, y: 2.3 },
  Yaobikuni: { scale: 1.518, x: 0, y: 2.3 },
  plant_disc_icon: { scale: 0.966, x: 0, y: 0.8 },
  Plant: { scale: 0.966, x: 0, y: 0.8 },
  mia_disc_icon: { scale: 0.993, x: 0.2, y: 1.6 },
  Mia: { scale: 0.993, x: 0.2, y: 1.6 },
  pandora_disc_icon: { scale: 0.955, x: 0.2, y: 0.8 },
  Pandora: { scale: 0.955, x: 0.2, y: 0.8 },
  eiki_disc_icon: { scale: 0.95, x: 0, y: 0.9 },
  Eiki: { scale: 0.95, x: 0, y: 0.9 },
  kenshi_mocchi_disc_icon: { scale: 0.95, x: 0, y: 0 },
  KenshiMocchi: { scale: 0.95, x: 0, y: 0 },
};
const DEFAULT_PROFILE_ICON_STYLE = Object.freeze({ scale:1, x:0, y:0 });
// 実際のプロフィール選択と調整Debugが共有するアイコン一覧。Debugだけの一覧は持たない。
// 同じid、またはキャッシュキーだけが異なる同じ画像は先に現れた1件へまとめる。
const breederIconOptions = ({ includeUnowned=false, ownedMarketIconIds=[] }={}) => {
  const owned = new Set(ownedMarketIconIds);
  const candidates = [
    ...STARTER_MONSTER_IDS.map(id=>{const monster=ALL_PLAYER_MONSTERS[id];return monster&&{id:monster.id,name:monster.name,src:monster.faceIconUrl||monster.iconUrl,source:'starter'};}),
    ...BREEDER_MARKET_ITEMS.filter(item=>item.type==='icon'&&(includeUnowned||owned.has(item.id))).map(item=>({id:item.id,name:item.name,src:item.icon,source:'market'})),
  ].filter(Boolean);
  const ids = new Set(), images = new Set();
  return candidates.filter(item=>{const image=String(item.src||'').split('?')[0];if(ids.has(item.id)||images.has(image))return false;ids.add(item.id);images.add(image);return true;});
};
const profileIconTransformStyle = iconAdjustmentTransformStyle;
const marketProfileIconStyle = (id) => profileIconTransformStyle(MARKET_PROFILE_ICON_STYLES[id]);
// 枠と画像を全画面で共有し、元画像全体を基準に同じ構図を再現する。
// object-cover で先に中央切り抜きせず、移動量が拡大率に影響されない順序で変形する。
const BreederIcon = ({ src, id, alt='', className='', roundedClass='rounded-full', adjustment }) => (
  <span className={`relative block overflow-hidden ${roundedClass} ${className}`}>
    <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain" style={adjustment?profileIconTransformStyle(adjustment):marketProfileIconStyle(id)}/>
  </span>
);
// ==================== プロフィールフレーム(2026-09-15) ====================
//
// 既存の BreederIcon は一切変えない。その**外側**へ別レイヤーとして枠だけを重ねる。
//   下層 … BreederIcon(これまでどおり円形に切り抜く。顔の位置調整もそのまま)
//   上層 … ProfileFrameLayer(円の外側まではみ出して描く。当たり判定は持たない)
// 画面ごとに枠の描き方を書かず、ここに1つだけ置く(HOME・プロフィール・ランキングで同じ構図)。
//
// ★大きさの指定(w-8 h-8 など)は**外側の span** へ付ける。内側は w-full h-full なので、
//   32pxでも80pxでも枠の太さが比例して変わり、小さいアイコンでもズレない。
// ★出してよいフレームかどうかは normalizeProfileFrameId だけが決める
//   (未公開の豪華フレームはここで 'none' に倒れるので、通常プレイヤーには出ない)。
const ProfileFrameLayer = ({ frameId }) => {
  const frame = profileFrameById(normalizeProfileFrameId(frameId));
  if (!frame || frame.kind === 'none') return null;
  // 画像フレームは透過PNGをそのまま重ねる。object-contain なので縦横比は変わらない。
  // 重ねる大きさと位置は絵ごとに違う(穴の大きさが違う)ので、profileFrameImageStyle が出す
  if (frame.kind === 'image') return (
    <img src={frame.src} alt="" aria-hidden="true" draggable={false}
      style={profileFrameImageStyle(frame)} className="mh-profile-frame mh-profile-frame-image"/>
  );
  return <span aria-hidden="true" className={`mh-profile-frame mh-profile-frame-ring ${frame.className||''}`}/>;
};
// ブリーダーアイコン＋プロフィールフレームの共通部品。
// frameId を渡さない(または 'none')ときは、これまでの BreederIcon と見た目が変わらない。
// badge は「アイコンと同じ円の中へ収めたい飾り」(プロフィールの鉛筆マークなど)。
// 内側の円でクリップされ、フレームだけがその外へ出る。
const ProfileAvatar = ({ src, id, frameId=null, alt='', className='', roundedClass='rounded-full', adjustment, fallback=null, badge=null }) => (
  <span className={`mh-profile-avatar ${className}`}>
    <span className={`relative flex h-full w-full items-center justify-center overflow-hidden ${roundedClass}`}>
      {src
        ? <BreederIcon src={src} id={id} adjustment={adjustment} alt={alt} roundedClass={roundedClass} className="w-full h-full"/>
        : fallback}
      {badge}
    </span>
    <ProfileFrameLayer frameId={frameId}/>
  </span>
);
// フレームを選んでいるか(もとから付いている縁を消すかどうかの判定に使う)
const hasProfileFrame = (frameId) => normalizeProfileFrameId(frameId) !== PROFILE_FRAME_NONE_ID;

// HOME本番と調整Debugで、丸枠・余白・画像の有無による代替表示まで同じ部品を使う。
// フレームを選んでいるときだけ、もともとの金色の縁を消す(枠が二重に見えないようにする)。
// 選んでいないとき(=フレームなし)は、これまでとまったく同じ見た目になる。
const HomeProfileIcon = ({ src, id, adjustment, frameId=null }) => {
  const framed = normalizeProfileFrameId(frameId) !== PROFILE_FRAME_NONE_ID;
  return (
    <div className={`mh-home-avatar${framed?' is-framed':''}`}>
      <ProfileAvatar src={src} id={id} frameId={frameId} adjustment={adjustment} alt="プロフィール画像" className="w-full h-full" fallback={<User size={24}/>}/>
    </div>
  );
};

// 図鑑一覧・血統チップ・立ち絵は本番とDEBUGで同じ収め方を使う。
const DexMonsterIcon = ({ src, alt='', hidden=false, lineage=false }) => (
  <span className={`${lineage?'w-7 h-7':'w-14 h-14'} rounded-full overflow-hidden border ${lineage?'border-amber-300/40':'border-amber-400/30'} shrink-0 bg-black/40 flex items-center justify-center`}>
    {src?<img src={src} alt={alt} draggable={false} data-dex-entry-icon={!lineage||undefined} data-dex-lineage-icon={lineage||undefined} className="w-full h-full object-contain" style={{padding:'10%',...(hidden?{filter:'brightness(0)',opacity:0.6}:{})}}/>:<span className="text-2xl">？</span>}
  </span>
);
const DexLineageChip = ({ lineage, iconUrl }) => (
  <span data-dex-lineage className="flex w-full items-center justify-center gap-1.5 min-w-0 rounded-full border border-amber-400/40 bg-black/40 pl-1 pr-2.5 py-1">
    {iconUrl?<DexMonsterIcon src={iconUrl} lineage/>:<span className="w-7 h-7 rounded-full bg-amber-900/60 border border-amber-300/30 flex items-center justify-center text-[9px] font-black text-amber-200 shrink-0">血</span>}
    <span className="text-[11px] font-black text-amber-100 truncate">{lineage.name}</span>
  </span>
);
// 立ち絵の <img> そのもの。待機アニメ(withMonsterIdleArt)は絵の要素を複製して重ねるので、
// 部品(DexMonsterArt)ではなくこの要素を渡す
const dexMonsterArtImage = (mon, alt, hidden=false) => (
  <DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={alt} masuColors={[]} draggable={false} className="w-full h-full object-contain" style={hidden?{filter:'brightness(0)',opacity:0.65}:undefined}/>
);
const DexMonsterArt = ({ mon, alt, hidden=false }) => mon.imgUrl
  ? dexMonsterArtImage(mon, alt, hidden)
  : <div className="text-6xl">{hidden?'？':mon.emoji}</div>;
// 図鑑の立ち絵に待機アニメを重ねたもの(バトルと同じ MonsterIdleArt)。持たない子・まだ出会っていない子は今までの絵。
// 待機アニメは正方形の箱の中で軸を合わせるので、正方形の箱(fill)に入れて渡す。
// 動かすかどうかは図鑑のページのボタン(motion。useDexIdleMotion)だけで決める。止めたら1枚の絵
const DexMonsterIdleArt = ({ mon, alt, motion = true }) => (motion && mon.imgUrl && monsterIdleRigOf(mon.id))
  ? <span data-dex-idle-art className="relative block h-full aspect-square max-w-full">{withMonsterIdleArt(mon.id, dexMonsterArtImage(mon, alt), {fill:true, own:true})}</span>
  : <DexMonsterArt mon={mon} alt={alt}/>;
const MarketProductIcon = ({ item, onZoom, disabled=false }) => {
  const content=item.icon?(item.type==='icon'?<BreederIcon src={item.icon} id={item.id} alt={item.name} className="w-full h-full"/>:item.type==='assist'&&ASSIST_CARD_ICON_STYLES[item.id]?<AssistCardIcon icon={item.icon} cardId={item.id} className="w-full h-full"/>:<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>):<span className="text-xl">{item.emoji}</span>;
  const cls=`${MARKET_ICON_SIZE[item.type]||'w-10 h-10'} rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30 ${disabled?'':'active:scale-90'}`;
  return onZoom?<button type="button" onClick={onZoom} aria-label={`${item.name}を大きく見る`} className={cls}>{content}</button>:<div className={cls}>{content}</div>;
};
// 「詳細」チップ。商品カードとマーケット画面の計4か所へ同じ形が写されていて、
// 8pxの字・実高さ15pxで、いちばん押す回数が多いのにいちばん小さいボタンになっていた。
// 中身の行は高さ22pxに固定してあるので、そこへ収まる範囲でいっぱいまで大きくする。
const MarketDetailChip = ({ label, onClick }) => (
  <button type="button" onClick={onClick} aria-label={label}
    className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-indigo-500/40 bg-indigo-950/50 px-2 py-1 text-[10px] font-black leading-none text-indigo-300 active:scale-95"><BookOpen size={10}/>詳細</button>
);
// 商品名の折り返し(2026-09-18・ユーザー指摘「商品名の行ズレがださい」)。
// カードの幅では2行になる名前があるが、ブラウザは日本語の語の切れ目を知らないので
// 「トレーニン／グチケット」「スキップチ／ケット・序」のように語の途中で切っていた。
// カタカナの複合語でよく使う後ろ半分の前に「ここで折り返してよい」印(U+200B)を入れて教える。
//   トレーニング|チケット   スキップ|チケット   絆ポイント|リセットの書   アシスト|カード「きき」
//   イブリースの|円盤石   おりょうの|アイコン
//   (「イブリースの円盤／石」「おりょうのアイコ／ン」と最後の1文字が落ちていた)
// ★入れるのは画面へ出す文字だけ。item.name そのものは変えないので、読み上げラベル・詳細・
//   検索・保存はこれまでどおり(U+200B は幅0で、コピーしても見た目に出ない)。
// ★語の頭に印が来ても害はない(行の先頭では折り返しの機会にならない)。
const MARKET_NAME_WRAP_WORDS = Object.freeze(['チケット', 'カード', 'リセット', 'ショップ', 'ボーナス', 'プシュケー', '円盤石', 'アイコン']);
const marketNameForWrap = (name) => MARKET_NAME_WRAP_WORDS.reduce(
  (text, word) => text.split(word).join(`​${word}`), String(name || ''));
// ★印は文字(U+200B)のままDOMへ置かず、<wbr> に変えてから描く。
//   U+200B は幅0でも**文字として残る**ので、画面の文字を拾う検査やブラウザの検索で
//   「ウンディーネのアイコン」が見つからなくなる(2026-09-18に monster/mermaid-browser-check.js が
//   実際に落ちた。商品はちゃんと並んでいるのに「無い」と言われた)。
//   <wbr> は「ここで折り返してよい」だけを表し、innerText には現れない。
const marketNameNodes = (name) => marketNameForWrap(name).split('​')
  .map((seg, index) => <React.Fragment key={index}>{index>0&&<wbr/>}{seg}</React.Fragment>);
const MarketProductCard = ({ item, owned=false, comingSoon=false, detail=null, middle=null, onDetail, onZoom, onBuy, canBuy=false, disabled=false }) => {
  const usesGold=item.type==='disc'||item.type==='assist'||item.type==='item';
  const usesPsyche=item.currency==='psyche';
  const usesHeroProof=item.currency==='heroProof';
  const usesHeroProofShard=item.currency==='heroProofShard';
  const priceLabel=usesHeroProofShard?`勇者の証片${item.cost}個`:usesHeroProof?`勇者の証${item.cost}個`:usesPsyche?`${item.cost}プシュケー`:usesGold?`${item.cost}ダイヤ`:`${item.cost}pt`;
  return <div className={`rounded-2xl border p-2 flex flex-col items-center gap-1 ${owned?'bg-emerald-900/30 border-emerald-500/60':comingSoon?'bg-slate-900/60 border-white/10':'bg-slate-900 border-white/10'}`}>
    <MarketProductIcon item={item} onZoom={onZoom} disabled={disabled}/>
    {/* 商品名(2026-09-18・ユーザー指摘「商品名の行ズレがださい」)。
        ★縦は**上寄せ**にする。中央寄せだと、1行で収まる品(魂格再編の書・染色もどき)だけが
          枠の真ん中へ降りてきて、2行の品の1行目と高さがそろわなかった。
        ★word-break:keep-all で「どの文字の間でも折ってよい」をやめ、marketNameForWrap が
          入れた印(U+200B)の位置だけで折るようにする。既定のままだと日本語は文字単位で
          折れるので、幅ぴったりのときに最後の1文字だけが2行目へ落ちていた
          (「トレーニングチケッ/ト」「アシストカード「き/き」」)。
          text-wrap:balance も試したが、行の長さをならす方を優先して「トレーニン/グチケット」に
          なるため使わない。印が無く1行に入りきらない名前だけ overflow-wrap:anywhere で折る。 */}
    <div className={`w-full flex items-start justify-center text-center text-[11px] font-black leading-tight ${comingSoon?'text-slate-400':'text-white'}`} style={{minHeight:'36px',wordBreak:'keep-all',overflowWrap:'anywhere'}}>{marketNameNodes(item.name)}</div>
    <div className="w-full flex items-center justify-center gap-1" style={{height:'22px'}}>{middle||detail&&!comingSoon?<>{middle}{!middle&&<MarketDetailChip label={`${item.name}の詳細を見る`} onClick={onDetail}/>}</>:null}</div>
    <div className="w-full flex items-center justify-center mt-auto pt-2">{comingSoon?<div className="text-[10px] font-black text-slate-400 bg-slate-800/60 px-2 py-1 rounded-full whitespace-nowrap">近日追加</div>:owned?<div className="text-[10px] font-black text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded-full whitespace-nowrap">所持済み</div>:<button onClick={onBuy} disabled={disabled||!canBuy} aria-label={`${item.name}${disabled?'（デバッグのため購入不可）':`を${priceLabel}で${usesHeroProof||usesHeroProofShard?'交換':'購入'}`}`} className={`mh-button mh-button-primary text-[11px] font-black px-2 min-h-[44px] w-full max-w-full rounded-xl flex items-center justify-center gap-1 whitespace-nowrap ${disabled||!canBuy?'bg-slate-800 text-slate-500':usesPsyche?'bg-fuchsia-600 text-white active:scale-95':'bg-amber-500 text-black active:scale-95'}`}>{usesHeroProofShard?<><span aria-hidden="true">🎖️</span><span className="text-[10px]">証片 ×{item.cost.toLocaleString()}</span></>:usesHeroProof?<><span aria-hidden="true">🏅</span><span className="text-[10px]">勇者の証 ×{item.cost.toLocaleString()}</span></>:usesPsyche?<><span aria-hidden="true">🌈</span><span>{item.cost.toLocaleString()}</span></>:<>{usesGold?<Gem size={11} className="shrink-0"/>:<Coins size={11} className="shrink-0"/>}<span>{item.cost.toLocaleString()}</span></>}</button>}</div>
  </div>;
};

// 表示を待たせず、ブラウザキャッシュとデコードだけを少しずつ先へ進める画像キュー。
// URLそのものをキーにして、Reactの再描画や複数の優先グループに同じ画像が含まれても1回だけ取得する。
const imagePreloadQueue = (() => {
  const queued = new Set();
  const pending = [];
  let active = 0;
  let scheduled = false;
  const MAX_CONCURRENT = 2;
  const scheduleIdle = (callback) => {
    if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(callback, { timeout: 500 });
    return window.setTimeout(() => callback({ didTimeout:true, timeRemaining:()=>0 }), 32);
  };
  const run = () => {
    scheduled = false;
    while (active < MAX_CONCURRENT && pending.length) {
      const url = pending.shift();
      active += 1;
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.onload = null;
        image.onerror = null;
        active -= 1;
        requestRun();
      };
      image.onload = () => {
        if (typeof image.decode === 'function') image.decode().catch(()=>{}).then(finish);
        else finish();
      };
      image.onerror = finish;
      image.src = url;
      if (image.complete) image.onload();
    }
  };
  const requestRun = () => {
    if (scheduled || active >= MAX_CONCURRENT || !pending.length) return;
    scheduled = true;
    scheduleIdle(run);
  };
  return {
    add(urls, { urgent=false }={}) {
      const additions = [];
      (Array.isArray(urls) ? urls : [urls]).forEach(url => {
        if (typeof url !== 'string' || !url || queued.has(url)) return;
        queued.add(url);
        additions.push(url);
      });
      if (urgent) pending.unshift(...additions);
      else pending.push(...additions);
      requestRun();
    },
  };
})();

// 初回チュートリアルを見たかどうか。既存の保存キーには触らず、新しいキーへ分けて持つ
const TUTORIAL_SEEN_KEY = 'mh_tutorial_seen_v1';
// バトルの練習を完了した状態と、初回案内を一度表示した状態は別々に保存する。
// 未定義の既存セーブはどちらも false として扱うため、後方互換性を保てる。
const BATTLE_TUTORIAL_SEEN_KEY = 'mh_battle_tutorial_seen_v1';
const BATTLE_TUTORIAL_GUIDE_SHOWN_KEY = 'mh_battle_tutorial_guide_shown_v1';
// モンビー(モンヒロビート)のチュートリアルを見たかどうか。既存のキーには触らず新しく足す。
// 値が無い既存セーブは「まだ見ていない」として扱うので、後方互換のまま初回案内が出る。
const RHYTHM_TUTORIAL_SEEN_KEY = 'mh_rhythm_tutorial_seen_v1';
// マスモンが少ないプレイヤー向けの日次案内。端末の暦日を値として保存し、
// 既存セーブにキーが無い場合は未表示として安全に扱う。
const DAILY_MASU_ADVICE_KEY = 'mh_daily_masu_advice_date_v1';
const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1';
// 案内の「行き先」。更新の案内と解放の案内が同じ言葉(market / battle …)を使えるよう、
// 対応表はここ1か所だけに置く
// 「新しく増えたよ」の更新の案内と、「あなたはもう遊べるよ」の解放の案内は、
// 公開した日にどちらも条件を満たすことがある。同じ内容を2回続けて出さないよう、
// 更新の案内を読み終えた時点で解放条件を満たしていれば、解放の案内は読んだことにする。
// (公開したあとに条件を満たした人へは、これまでどおり解放の案内が出る)
const UPDATE_NOTICE_COVERS_UNLOCK = Object.freeze({ update_notice_species_challenge_v1:'unlock_species_challenge_v1' });
const NOTICE_DESTINATIONS = { market:'BREEDER_MARKET', battle:'BATTLE_MODE_SELECT', training:'TRAINING_INFO' };
const noticeDestinationState = (destination) => NOTICE_DESTINATIONS[destination]
  || (typeof destination === 'string' && /^[A-Z][A-Z0-9_]*$/.test(destination) ? destination : null);
const UPDATE_NOTICE_LOGIN_LIMIT = 3;
const normalizeSeenUpdateNoticeIds = value => [...new Set((Array.isArray(value) ? value : [])
  .filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
// ★期間で出し入れする告知(notifyFrom / notifyUntil)は、見るたびに数え直す。
//   notice.enabled は読み込んだときの1回きりの答えなので、開きっぱなしの端末では
//   開始時刻をまたいでも false のままになり、イベントの告知が永久に出なかった
//   (2026-09-11・ユーザー指摘「やってる最中の人が見れてないらしい」)。
//   期間を書いていない告知は今までどおり enabled をそのまま見る。
const updateNoticeOpenNow = (notice, nowMs) => {
  if (!notice) return false;
  if (notice.notifyFrom == null && notice.notifyUntil == null) return notice.enabled === true;
  return (typeof assistantNoticeWithinPeriod === 'function')
    ? assistantNoticeWithinPeriod(notice, Number.isFinite(nowMs) ? nowMs : Date.now())
    : notice.enabled === true;
};
const availableUpdateNotices = ({ debug=false, nowMs=null }={}) =>
  (((typeof ASSISTANT_UPDATE_NOTICES !== 'undefined' && ASSISTANT_UPDATE_NOTICES) || [])
    .filter(notice => notice && updateNoticeOpenNow(notice, nowMs) && typeof notice.id === 'string'
      && !HIDDEN_UPDATE_NOTICE_IDS.has(notice.id)
      && (debug ? notice.debugOnly === true : notice.debugOnly !== true)));
const planUpdateNoticesForLogin = (notices, seenIds) => {
  const seen = normalizeSeenUpdateNoticeIds(seenIds);
  const unseen = (Array.isArray(notices) ? notices : []).filter(notice => !seen.includes(notice.id));
  return {
    queue: unseen.slice(0, UPDATE_NOTICE_LOGIN_LIMIT),
    seen: normalizeSeenUpdateNoticeIds([...seen, ...unseen.slice(UPDATE_NOTICE_LOGIN_LIMIT).map(notice => notice.id)]),
  };
};
const localCalendarDate = (now = new Date()) => {
  const d = now instanceof Date ? now : new Date(now);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

// 画面へ出す曲名。副題(subtitle)まで入れて1つの名前にする。
// displayName だけを出していたため、曲えらびもプレイ中も副題が落ちていた
// (「Stay With Me」「綺季一閃」だけが出て ～Locked Fate～ ～花雪に舞う詠姫～ が消えていた)。
// ヘルプの曲一覧は前から副題まで出していたので、画面とヘルプで名前が食い違っていた
const rhythmSongFullName = song => (song && song.subtitle)
  ? `${song.displayName} ${song.subtitle}`
  : (song ? song.displayName : '');
// マスモンの能力は主血統で決まる(§4.5)。画面とヘルプで使う「効果の一文」を実データから作る。
// ここへ効果を手で書き写すと、値を変えたときに文章だけ古いまま残る。
// ヘルプの表(helpDataRows の rhythmMonsterAbilities)より前に置く。
// あとに置くと、ヘルプを開いた瞬間に「初期化前の変数を参照した」で真っ白になる
// (2026-09-05・rhythmSongFullName で同じことをやってしまった)。
const rhythmAbilityEffectText=ability=>{
  if(!ability)return '';
  if(ability.id==='GENKI')return `取るとライフが +${ability.lifeGain}`;
  if(ability.id==='MUTEKI')return `${Math.round(ability.durationMs/1000)}秒のあいだライフが減らない`;
  if(ability.id==='GAMAN')return `${Math.round(ability.durationMs/1000)}秒のあいだライフの減りが${Math.round((1-ability.reduceRate)*100)}%小さくなる`;
  if(ability.id==='KONJO')return `倒れたときに一度だけライフ${ability.reviveLife}で復活（持っているときにもう一度取るとライフ +${ability.stockLifeGain}）`;
  return '';
};
const helpDataRows = (id) => {
  const marketItems = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [];
  const skipIds = new Set(Object.values(SKIP_TICKETS));
  switch (id) {
    case 'difficulties':
      return Object.values(DIFFICULTY_SETTINGS).map(s => [s.label, `敵×${s.power} ／ スコア×${s.score} ／ ダイヤ×${s.gold}`]);
    // タクティクスバトルの敵の技(2026-09-21)。種別と倍率と受け方を実データから作る。
    // ★技の名前は敵ごとに違う(10体×8技)ので、ここに出すのは**種別**。
    //   倍率を調整したときにヘルプが古いままにならないよう、行を書き写さない
    // ★2列目は短くする。長い説明(condition)をそのまま入れると画面で省略され、
    //   「表のとおりに描けているか」を見る help-render-check が落ちる
    case 'tacticsEnemyActions':
      return (typeof TACTICS_ACTION_DEFINITIONS !== 'undefined' ? TACTICS_ACTION_DEFINITIONS : [])
        .filter(action => action.type !== 'WAIT' && action.type !== 'MOVE')
        .map(action => [action.category,
          action.multiplier > 0
            ? `威力 ×${action.multiplier}${action.hits > 1 ? `（${action.hits}ヒット）` : ''}`
            : 'ダメージなし']);
    // タクティクスのEXスキル(2026-09-23)。持っている子・名前・回数・カードとの併用・効果時間を定義から作る。
    // ★EXを足したときにヘルプが古いままにならないよう、行を書き写さない。2列目は短く(help-render-check)
    case 'tacticsExSkills':
      return Object.keys((typeof TACTICS_EX_SKILLS !== 'undefined' && TACTICS_EX_SKILLS) || {}).map(monId => {
        const def = tacticsExDefOf(monId);
        const monName = ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[monId]) || {}).name || monId;
        const duration = { turn:'そのターン', wave:'そのWAVE', toggle:'切り替え' }[def.duration] || '';
        return [`${monName}「${def.name}」`,
          `${def.unlimited ? '無制限' : `1ラン${def.maxUses}回`} ／ ${def.withCards ? 'カードと併用可' : 'その子はカード不可'} ／ ${duration}`];
      });
    // プロモードのランぶんに入るクイック周回数(2026-09-21)。
    // 難易度ごとの重さ(power)と同じ式から作るので、難易度を調整したときも自動で追随する
    // (ヘルプへ9行書き写すと、必ずどこかが古いままになる)
    case 'proQuickLoops':
      return Object.values(DIFFICULTY_SETTINGS).map(s => [s.label,
        `10WAVE完走 ${proRunQuickLoops(10, s.power)}周 ／ WAVE5まで ${proRunQuickLoops(5, s.power)}周`]);
    // モンスターの血統一覧。ヘルプへ手で書き写すと、モンスターを足したときに古いままになる
    case 'monsterLineages':
      return dexMonsterList().map(mon => {
        const { main, sub } = monsterLineageOf(mon.id);
        return [mon.name, `${main.name} × ${sub.name}（${monsterCategoryName(monsterCategoryOf(mon.id))}）`];
      });
    // 週間ランキングの順位報酬。1〜10位を実データ(式)から作る
    // (ヘルプへ10行書き写すと、幅を変えたときに古いままになる)
    case 'rhythmWeeklyRewards':
      return Array.from({ length: RHYTHM_WEEKLY_REWARD_RANKS }, (_, index) => {
        const reward = rhythmWeeklyRewardForRank(index + 1);
        return [`${index + 1}位`,
          `${HERO_PROOF_SHARD_ITEM.emoji} ${HERO_PROOF_SHARD_ITEM.name}×${reward.count}`
          + ` ／ 💗 虹のプシュケー×${reward.psyche.toLocaleString()}`
          + ` ／ 💎 ダイヤ×${reward.gold.toLocaleString()}`];
      });
    // イベントの回数ボーナス。難易度ごとの割合を実データから出す
    // (ヘルプへ手で書き写すと、割合を変えたときに古いままになる)
    case 'rhythmEventPlayBonus':
      return RHYTHM_DEMO_DIFFICULTY_IDS.map(id =>
        [RHYTHM_DEMO_DIFFICULTY_LABELS[id]?.name || id, rhythmEventPlayBonusPercentText(id)]);
    // 極限チャレンジの難易度。閲覧可能な準備中難易度も倍率は実データから出す
    case 'extremeDifficulties':
      return PUBLIC_EXTREME_DIFFICULTIES.map(s => [s.label, s.available
        ? `敵×${s.power} ／ スコア×${s.score} ／ 経験値×${s.xp} ／ ダイヤ×${s.gold} ／ 虹のプシュケー ${s.psyche}個`
        : '？？？（未実装）']);
    // 種族チャレンジで選べる種族と、その種族で連れていけるモンスターの数。
    // モンスターを足すと自動で増えるので、ヘルプへ手で書き写さない
    case 'speciesChallengeLineages':
      return speciesChallengeLineages().map(lineage => {
        const members = dexMonsterList().filter(mon => monsterLineageOf(mon.id).main.id === lineage.id);
        const allyMax = Math.max(0, members.length - 1);
        return [`${lineage.name}種`, `${members.map(mon => mon.name).join('・')}（勇者モン1体＋供モン最大${allyMax}体）`];
      });
    // 種族チャレンジの難易度と、その難易度をはじめてクリアしたときにもらえる超越の実の数
    case 'speciesChallengeRewards':
      return SPECIES_CHALLENGE_DIFFICULTY_IDS.map(id => {
        const setting = DIFFICULTY_SETTINGS[id] || EXTREME_DIFFICULTIES.find(s => s.id === id);
        return [setting?.label || id, `初回クリアで 超越の実 ×${speciesChallengeFirstClearReward(id)}`];
      });
    // 限界突破の回数で変わる「レベルアップ1回ぶんの強化ポイント」。
    // 段の数や倍率を変えてもヘルプが古くならないよう、実データから作る
    case 'levelUpPointMultipliers': {
      return [
        [`Lv.1 → ${ENHANCE_POINT_DOUBLE_LEVEL}`, 'レベルアップ1回につき 強化ポイント 1'],
        [`Lv.${ENHANCE_POINT_DOUBLE_LEVEL} → ${ENHANCE_POINT_TRIPLE_LEVEL}（虹★4）`, 'レベルアップ1回につき 強化ポイント 2'],
        [`Lv.${ENHANCE_POINT_TRIPLE_LEVEL} → ${MAX_MASU_LEVEL_CAP}（虹★5）`, 'レベルアップ1回につき 強化ポイント 3'],
      ];
    }
    case 'teachings':
      return ((typeof TEACHING_CARDS !== 'undefined' && TEACHING_CARDS) || []).map(card => [card.baseName, `${card.desc}（消費ガッツ ${card.guts}）`]);
    case 'skipTickets':
      return marketItems.filter(item => skipIds.has(item.id))
        .map(item => [item.name, `${DIFFICULTY_SETTINGS[item.skipDifficulty]?.label || item.skipDifficulty} で使える ／ マーケット ${item.cost.toLocaleString()}ダイヤ`]);
    case 'items':
      // マーケットで売らないアイテム(虹のプシュケー)は値段の代わりに入手方法を出す
      return marketItems.filter(item => item.type === 'item' && !skipIds.has(item.id))
        .map(item => [item.name, `${item.shop === false ? 'マーケットでは買えない' : `${item.cost.toLocaleString()}ダイヤ`} ／ ${item.desc || ''}`]);
    // クリアでもらえる虹のプシュケー。難易度と個数は実データからそのまま作る
    case 'psycheRewards':
      return Object.entries(DIFFICULTY_SETTINGS)
        .map(([key, setting]) => [setting.label, `クリアで ${clearPsycheReward(key)} 個`]);
    case 'loginBonus':
      return ((typeof LOGIN_BONUS_REWARDS !== 'undefined' && LOGIN_BONUS_REWARDS) || [])
        .map((rewards, i) => [`${i + 1}日目`, rewards.map(giftRewardText).join(' ／ ')]);
    // 合体・転生の消費ダイヤ。単価を変えたときにヘルプだけ古くなることがないよう、
    // 実際に使っている定数からそのまま表を作る
    case 'masuCosts':
      return [
        ['再生', `初回無料・2回目以降 ${REGENERATION_COST} ダイヤ`],
        ['合体（技継承なし）', '0 ダイヤ'],
        ['合体（技継承あり）', `${FUSION_INHERIT_COST} ダイヤ`],
        ['限界突破', `絆Lv × ${REBIRTH_COST_PER_LEVEL} ダイヤ`],
        ['転生', `絆Lv × ${REBIRTH_COST_PER_LEVEL} ダイヤ`],
        ['寄付', 'かからない（逆に累計絆経験値と同じ数のダイヤを受け取れる）'],
      ];
    // みゅあとの仲良し度。段階も増える行動も data/assistants.js の実データから作るので、
    // 値を変えたときにヘルプだけ古くなることがない
    // 助手ごとに段階の名前も呼び方も違うので、両方を同じ表へ並べる。
    // 必要な仲良し度(need)はどの助手も同じなので、Lvを1行にまとめられる
    case 'assistantBond': {
      const callUnlockLv = (typeof ASSISTANT_CALL_STYLE_UNLOCK_LEVEL !== 'undefined' && ASSISTANT_CALL_STYLE_UNLOCK_LEVEL) || 6;
      const list = (typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.length) ? ASSISTANT_LIST : [];
      const base = (typeof ASSISTANT_BOND_LEVELS !== 'undefined' && ASSISTANT_BOND_LEVELS) || [];
      return base.map(s => {
        const per = list.map(who => {
          const stage = (typeof assistantBondStageByLevel === 'function') ? assistantBondStageByLevel(s.level, who.id) : s;
          const call = s.level >= callUnlockLv ? '自由に設定' : String(stage.call).replace('{name}', 'あなたの名前');
          return `${who.name}「${stage.title}」呼び方 ${call}`;
        }).join(' ／ ');
        return [`Lv.${s.level}`, `${s.need} から ／ ${per}`];
      });
    }
    // プロフィールフレームの一覧。フレームを足したらヘルプへも自動で載る
    // (手で書き写すと、増やしたときに古いままになる)。未公開のものはここに出さない
    case 'profileFrames':
      // もらう条件も実データから出す(ヘルプへ手で書き写すと、Lvを変えたときに古くなる)
      return ((typeof releasedProfileFrames === 'function' ? releasedProfileFrames() : []) || [])
        .map(frame => {
          const unlock = (typeof profileFrameUnlock === 'function') ? profileFrameUnlock(frame) : null;
          const who = unlock && typeof assistantById === 'function' ? assistantById(unlock.assistantId) : null;
          const how = unlock ? `${(who && who.name) || ''}との仲良し度 Lv${unlock.bondLevel}でもらえます。` : 'はじめから選べます。';
          return [frame.name, `${how}${frame.desc ? ` ${frame.desc}` : ''}`];
        });
    // 助手の一覧。名前と性格の違いを実データから出す
    case 'assistants':
      return ((typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST) || [])
        .map(who => [who.name, `${who.tagline || ''}${who.intro ? ` ／ ${who.intro}` : ''}`]);
    case 'monsterPower':
      // 総合力の内訳は、実際の計算に使っている定数から作る(ヘルプへ数字を手で書き写さない)
      return [
        ['ライフ 1', `+${MONSTER_POWER_STAT_WEIGHT.hp}`],
        ['ちから 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.atk * 100) / 100}（強化P1つ=ちから+${STAT_POINT_GAIN.atk} で +10）`],
        ['丈夫さ 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.def * 100) / 100}（強化P1つ=丈夫さ+${STAT_POINT_GAIN.def} で +10）`],
        ['ガッツ 1', `+${Math.round(MONSTER_POWER_STAT_WEIGHT.guts * 100) / 100}（強化P1つ=ガッツ+${STAT_POINT_GAIN.guts} で +10）`],
        ['間合い適性', DIST_APTITUDE_GRADES.slice().reverse().map(g => `${g} ${MONSTER_POWER_APTITUDE[g] > 0 ? '+' : ''}${MONSTER_POWER_APTITUDE[g]}`).join(' ／ ') + '（4距離すべてを合計）'],
        ['固有技を1つ持つ', `+${MONSTER_POWER_UNIQUE_OWNED}（Lv0でも付く。継承した固有技も同じ）`],
        ['固有技の強化Lv 1段階', `+${Math.round(MONSTER_POWER_UNIQUE_PER_LEVEL * 100) / 100}（3段階でちょうど+200）`],
      ];
    case 'assistantBondActions':
      return Object.values((typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS) || {})
        .map(x => [x.label, `1回 +${x.amount} ／ 1日 ${x.dailyMax} まで`]);
    // 音ゲーの難易度ごとの満点と、その満点で届く上限ランク。ランクのしきい値(RHYTHM_RANKS)を
    // 直接ヘルプへ手で書き写すと、しきい値を調整するたびヘルプだけ古くなるため、
    // rhythmRankForScoreへ各難易度のmaxScoreをそのまま渡して実データから表を作る
    case 'rhythmDifficultyRanks':
      return (typeof RHYTHM_DIFFICULTIES !== 'undefined' ? RHYTHM_DIFFICULTIES : []).map(d =>
        [d.id, `満点 ${d.maxScore.toLocaleString()}点 → 上限ランク ${rhythmRankForScore(d.maxScore)}`]);
    // 体験版で遊べる難易度と、そのレベル・ノーツ数。ヘルプへ手で書き写すと、
    // 譜面を作り直すたびに数字だけ古くなるため、実データからそのまま表にする
    case 'rhythmDemoSongLevels': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const song = typeof rhythmDemoSong !== 'undefined' ? rhythmDemoSong(songs) : null;
      if (!song) return [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      const labels = typeof RHYTHM_DEMO_DIFFICULTY_LABELS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_LABELS : {};
      return ids.map(id => {
        const chart = song.difficulties[id];
        if (!chart) return null;
        const note = (labels[id] && labels[id].note) || '';
        return [(labels[id] && labels[id].name) || id,
          `Lv.${chart.level} ／ ${chart.totalNotes}ノーツ${note ? ` ／ ${note}` : ''}`];
      }).filter(Boolean);
    }
    // 先行公開の曲(RHYTHM_DEMO_SONG_IDS)。手で書き写すと曲を足したときに古くなるので、
    // 実データから曲名・難易度の数・レベルの幅・長さを作る。
    case 'rhythmDemoSongList': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      return list.map(song => {
        const charts = ids.map(id => song.difficulties[id]).filter(chart => chart && chart.notes && chart.notes.length > 0);
        if (!charts.length) return null;
        const levels = charts.map(chart => Number(chart.level) || 0);
        const length = typeof rhythmSongLengthLabel !== 'undefined' ? rhythmSongLengthLabel(song, charts[0]) : '';
        const name = rhythmSongFullName(song);
        return [name,
          `Lv.${Math.min(...levels)}〜${Math.max(...levels)} ／ ${charts.length}難易度${length ? ` ／ ${length}` : ''}`];
      }).filter(Boolean);
    }
    // 難易度ごとに「いちばんやさしい曲」と「いちばん難しい曲」がどれだけ離れているか。
    // 「同じEASYでもLv.5〜8」のようにヘルプへ手で書くと、曲を足すたびにヘルプだけ古くなる
    // (実際にそうなった)。実データのレベル表から幅を作る
    case 'rhythmDifficultySpread': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const ids = typeof RHYTHM_DEMO_DIFFICULTY_IDS !== 'undefined' ? RHYTHM_DEMO_DIFFICULTY_IDS : [];
      return ids.map(id => {
        const entries = list.map(song => ({ song, chart: song.difficulties[id] }))
          .filter(entry => entry.chart && entry.chart.notes && entry.chart.notes.length > 0
            && Number.isFinite(Number(entry.chart.level)) && Number(entry.chart.level) > 0);
        if (!entries.length) return null;
        const levels = entries.map(entry => Number(entry.chart.level));
        const low = entries[levels.indexOf(Math.min(...levels))];
        const high = entries[levels.indexOf(Math.max(...levels))];
        return [id, `Lv.${Math.min(...levels)}〜${Math.max(...levels)}`
          + `（やさしい順の先頭: ${rhythmSongFullName(low.song)} ／ いちばん重い: ${rhythmSongFullName(high.song)}）`];
      }).filter(Boolean);
    }
    // 曲えらびの四角い枠に絵が出るかどうか。ヘルプへ「いまはこの4曲」と手で書くと、
    // 絵を1つ足すたびにヘルプだけ古くなる(実際にそうなった)。実データの artwork から表にする
    case 'rhythmSongArtwork': {
      const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
      const list = typeof rhythmDemoSongs !== 'undefined' ? rhythmDemoSongs(songs) : [];
      const artOf = song => typeof rhythmSongArtSrc !== 'undefined' ? rhythmSongArtSrc(song)
        : (song && typeof song.artwork === 'string' ? song.artwork : '');
      // 同じ絵を2曲以上で使っているときは、その旨も出す(いまは風がそよぐ場所とClose To Your Heart)
      const uses = new Map();
      list.forEach(song => { const src = artOf(song); if (src) uses.set(src, (uses.get(src) || 0) + 1); });
      return list.map(song => {
        const src = artOf(song);
        return [rhythmSongFullName(song),
          src ? (uses.get(src) > 1 ? '絵あり（ほかの曲と同じ絵）' : '絵あり') : '色タイルに曲名の頭文字'];
      });
    }
    // モンスターノーツの能力。効果の数値(ライフ+500・6秒・15秒…)をヘルプへ書き写すと、
    // 値を変えたときにヘルプだけ古いまま残るため、実データから表にする
    case 'rhythmMonsterAbilities': {
      const abilities = typeof RHYTHM_MONSTER_ABILITIES !== 'undefined' ? RHYTHM_MONSTER_ABILITIES : {};
      const byLineage = typeof RHYTHM_MONSTER_ABILITY_BY_LINEAGE !== 'undefined' ? RHYTHM_MONSTER_ABILITY_BY_LINEAGE : {};
      return Object.values(abilities).map(ability => {
        const lineages = Object.entries(byLineage).filter(([, id]) => id === ability.id)
          .map(([lineageId]) => lineageById(lineageId).name);
        return [ability.name, `${rhythmAbilityEffectText(ability)}（主血統: ${lineages.join(' / ')}）`];
      });
    }
    case 'missionsDaily':
    case 'missionsWeekly':
    case 'missionsMonthly': {
      const type = id === 'missionsDaily' ? 'daily' : id === 'missionsWeekly' ? 'weekly' : 'monthly';
      const defs = ((typeof MISSION_DEFS !== 'undefined' && MISSION_DEFS) || {})[type] || [];
      return defs.map(m => [m.name, `${m.condition} → ${m.rewards.map(giftRewardText).join(' ／ ')}`]);
    }
    default:
      return [];
  }
};
// 表の上に出す見出し(何の表かを分かるようにする)
const HELP_DATA_TITLES = {
  difficulties: '難易度と倍率',
  tacticsEnemyActions: 'タクティクスバトルの敵が使う技',
  tacticsExSkills: 'タクティクスバトルのEXスキル',
  proQuickLoops: 'プロモードで入るクイック周回数',
  extremeDifficulties: '極限チャレンジの難易度',
  rhythmEventPlayBonus: 'イベントの回数ボーナス（1回あたり）',
  rhythmWeeklyRewards: '週間ランキングの順位報酬',
  levelUpPointMultipliers: 'レベルアップでもらえる強化ポイント',
  speciesChallengeLineages: '種族チャレンジで選べる種族',
  speciesChallengeRewards: '種族チャレンジの難易度と初回クリア報酬',
  teachings: 'ブリーダーの教え',
  skipTickets: 'スキップチケットの種類',
  items: 'アイテム一覧',
  loginBonus: '7日間のログインボーナス',
  missionsDaily: 'デイリーミッション',
  missionsWeekly: 'ウィークリーミッション',
  missionsMonthly: 'マンスリーミッション',
  masuCosts: '神殿でかかるダイヤ',
  assistants: '助手の種類',
  profileFrames: '選べるプロフィールフレーム',
  assistantBond: '仲良し度の段階と呼び方',
  assistantBondActions: '仲良し度が増える行動',
  monsterPower: '総合力の内訳',
  monsterLineages: 'モンスターの血統一覧',
  psycheRewards: '難易度ごとにもらえる虹のプシュケー',
  rhythmDifficultyRanks: '音ゲーの難易度ごとの満点と上限ランク',
  rhythmDemoSongLevels: '体験版で遊べる難易度とレベル',
  rhythmDemoSongList: '先行公開している曲',
  rhythmDifficultySpread: '同じ難易度でも曲でどれだけ違うか',
  rhythmSongArtwork: '曲えらびに絵が出る曲',
  rhythmMonsterAbilities: 'モンスターノーツで出る能力',
};
