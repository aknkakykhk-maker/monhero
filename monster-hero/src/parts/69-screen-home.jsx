// ==== 画面: HOME(村の広場)とそこに重なる案内 ====
//
// MonsterHeroGame から切り出した19本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-12)。
// 村の広場そのものと、HOME にだけ出るかぶせもの3つ(ききの加入・ももすけの登場・
// アップデートの案内)。
//
// 【この画面ならではの注意】
// ・HOME は**配置の検査がある唯一の画面**。触ったら必ず `node tools/home-layout-check.js` を通す。
//   助手(みゅあ)の吹き出し・施設のボタン・はじめての案内が同じ場所に重なるため、
//   ここだけは実際のブラウザで位置を測って確かめている
// ・施設へ入る7つの行き先は props(onOpen*)で受け取る。画面は行き先の名前を持たない
// ・かぶせもの3つは「HOME にいて、チュートリアルが終わっていて、前の会話が片付いていたら」
//   という順番で出る。その条件は MonsterHeroGame 側に残し、ここは中身だけを持つ
// イベント開催中の角バッジ(2026-09-11・ユーザー指示
// 「右上とか左上とか専用バッジを付けるようにして」「そこそこ派手目に / キラキラ強調されてるような」)。
//
// ★この機能ぶんのCSSは、ここで <style> を置いて閉じる。70-bootstrap.jsx の大きなCSSへ
//   書き足したときは、1行に複数の規則が並ぶ場所へ入って @media の内側になり、
//   文書へ一度も読み込まれなかった(実ブラウザで 0件 / 全1161規則)。
//   さらに消すときに同じ行の続きまで巻き込んで、横画面の配置を壊した。
//   ここへ閉じておけば、ほかのCSSを壊しようがない。
// ★位置は超越バッジ・魂格バッジと同じ「角へ少しはみ出す」置き方にそろえる。
// ★動きを減らす設定の人には光らせない(prefers-reduced-motion)。
// ★位置と見た目は style で直に持たせる。配置の検査(home-layout-check.js)は
//   このCSSを読み込まないので、クラスだけに頼ると検査の中で「ただの文字」になり、
//   ボタンが横に広がって施設の位置がずれてしまう(実際に落ちた)。
//   クラスのほうは「光り方・動き」だけを足す係にする。
const HOME_EVENT_BADGE_STYLE = Object.freeze({
  position:'absolute', top:'-10px', right:'-9px', zIndex:8,
  display:'block', overflow:'hidden', padding:'2px 7px',
  border:'1px solid #fff3c4', borderRadius:'999px',
  background:'linear-gradient(135deg,#f59e0b,#fde047 45%,#f97316)',
  color:'#4a1d00', fontSize:'8px', fontWeight:1000, fontStyle:'normal',
  lineHeight:1.6, whiteSpace:'nowrap', textShadow:'0 1px 0 #fff8', pointerEvents:'none',
  boxShadow:'0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80',
});
const HOME_EVENT_BADGE_CSS = `
.mh-home-event-badge{animation:mhHomeEventBadgePulse 1.6s ease-in-out infinite}
.mh-home-event-badge::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;
  background:linear-gradient(100deg,#fff0,#ffffffcc,#fff0);
  animation:mhHomeEventBadgeShine 2.4s ease-in-out infinite}
@keyframes mhHomeEventBadgePulse{
  0%,100%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80;transform:scale(1)}
  50%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 16px #fde047,0 0 30px #f59e0bcc;transform:scale(1.06)}}
@keyframes mhHomeEventBadgeShine{0%{left:-60%}55%{left:120%}100%{left:120%}}
@media(prefers-reduced-motion:reduce){
  .mh-home-event-badge{animation:none;transform:none}
  .mh-home-event-badge::after{display:none}}
`;
// ★イベント・レイドボス「ジャック」(docs/spec/RAID_BOSS_JACK.md)。開催中だけ、HOMEの真ん中でぴょこぴょこ跳ねる。
//   タップでレイド画面を開く。近くに、いま挑める段階の共有HPバーを出す。ときどき両腕を上げたポーズに変わる(HPとは連動しない)。
// ★位置・大きさ・見た目は style で直に持たせ、クラスは「動き」だけを足す係にする(配置の検査はこのCSSを読まないため)。
// ★CSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、配置の検査が数える要素の数がずれる。
// ★動きを減らす設定の人には跳ねさせない(prefers-reduced-motion)。
const HOME_RAID_JACK_CSS = `
.mh-home-raid-jack-img{animation:mhRaidJackHop 1.15s cubic-bezier(.3,.1,.4,1) infinite;transform-origin:50% 100%}
.mh-home-raid-jack-shadow{animation:mhRaidJackShadow 1.15s cubic-bezier(.3,.1,.4,1) infinite}
@keyframes mhRaidJackHop{
  0%,100%{transform:translateY(0) scale(1.06,.92)}
  18%{transform:translateY(0) scale(.96,1.06)}
  50%{transform:translateY(-16px) scale(1,1) rotate(-2deg)}
  82%{transform:translateY(0) scale(1.05,.94) rotate(1deg)}}
@keyframes mhRaidJackShadow{0%,100%{transform:scaleX(1.05);opacity:.5}50%{transform:scaleX(.7);opacity:.3}}
@media(prefers-reduced-motion:reduce){.mh-home-raid-jack-img,.mh-home-raid-jack-shadow{animation:none}}
`;
// ★重なり順は施設(.mh-home-facilities の z-index:3)より前の 4(2026-10-11・社長の実機の指摘)。
//   施設は建物ぶんの透明な押し場所を持つので、2のままだと右に置いた吹き出しが神殿・マーケットの押し場所の下になり、
//   「▶ つぎ」を押すと施設が開いていた。枠そのものは押せなくして(pointerEvents:none)、吹き出しとジャック本体だけを押せるようにする
//   (枠の余白で施設の押し場所をふさがない)。上の帯・みゅあ・ギフトなど(z-index:5)よりは後ろのまま
const HOME_RAID_JACK_WRAP_STYLE = Object.freeze({
  position:'absolute', left:'50%', top:'44%', transform:'translate(-50%,-50%)', zIndex:4, pointerEvents:'none',
  width:'44%', maxWidth:'190px', minWidth:'120px',
});
// ★炎(オーラ)だけは、施設(z-index:3)より後ろの 2 に分けて描く(2026-10-13・社長「またレイドボスのオーラが各施設に重なってる」)。
//   10/07(#2299)に炎を施設の後ろへ回したが、10/11 に吹き出しを押せるようにするためジャック全体を 4 へ上げたとき、
//   中にある炎も一緒に施設の札・みゅあの吹き出しの前へ出てしまった。ジャック本体と吹き出しは 4 のまま(押せる)、炎は別の層。
//   炎の層には本体と同じ形の見えない枠を置き、炎の位置・大きさは本体の中にあったときと同じにする
const HOME_RAID_JACK_AURA_WRAP_STYLE = Object.freeze({ ...HOME_RAID_JACK_WRAP_STYLE, zIndex:2 });
const HOME_RAID_JACK_AURA_BOX_STYLE = Object.freeze({ display:'flex', flexDirection:'column', alignItems:'center', width:'100%', visibility:'hidden' });
const HOME_RAID_JACK_BUTTON_STYLE = Object.freeze({
  display:'flex', flexDirection:'column', alignItems:'center', width:'100%',
  background:'transparent', border:'0', padding:'0', cursor:'pointer', pointerEvents:'auto',
});
// ★ジャックのひとこと(吹き出し)の置き場所を、その端末の画面で測って決める(2026-10-10・社長の実機の指摘)。
//   iPhone縦では「M/B管理」「神殿」のボタンの下へ吹き出しがもぐって文の頭が隠れ、横では上の帯の裏へ隠れていた。
//   HOMEのボタンの位置は端末ごとに違うので、決め打ちの位置ではどこかで必ず重なる。
//   そこで「ボタン・みゅあの吹き出し・画面の端」を障害物として測り、重ならない場所と幅を順に試す:
//     頭の上で、広い幅から順に、左右へずらし、少しずつ下げて頭の4分の3まで重ねる。帯(〜があらわれた！・共有HP)には乗せない。
//     以前は頭の右・左にも置いたが、狭い画面で帯を隠した(2026-10-24 窓口「iPhone 13 と同じように、かぼちゃの上に」)
//   札・帯にかかる所、かぼちゃの顔を隠す所には置かない。置ける所が無いときは出さない。
//   ボタン側は動かさない(押せる場所を変えない)。
//   head … ジャック本体の絵の箱(跳ねる前の位置) / band … 帯の箱 / obstacles … 避ける箱 / measure(width) … その幅での吹き出しの高さ
// 広い順に試すので、入るならこれまでどおり広いほうになる。いちばん狭くて 144px(2026-10-24 窓口・カゲあつくん「言葉の途中で折れないように」。
// 以前は狭い画面(幅320)でジャックの横へ置くとき用に 104・96 まであったが、1行に8字ほどしか入らず「いってらっ／しゃい」と折れた。
// 144px なら本文が約120pxで、太字の11pxが10字入る(jaWrap は言葉のかたまりを10字までに分ける。41-screen-ui.jsx の JA_WRAP_LINE)。
// 台詞を全部描いて確かめる検査は tools/boot/ja-wrap-lines-check.js
const HOME_RAID_SAY_WIDTHS = Object.freeze([184, 168, 152, 144]);
// 上の幅がどれも置けないときだけ、字を10pxにした 136px、字9pxにした 120px(本文は約96px。10字の言葉のかたまりが1行に入る)も使う。
// 幅320や 360×640 では、みゅあの吹き出しと M/B管理・神殿の札のすき間が狭く、それより広いとかぼちゃの上に置けなかった(2026-10-24)
const HOME_RAID_SAY_SMALL_WIDTHS = Object.freeze([136, 120]);
const HOME_RAID_SAY_INLINE_NEXT = 130; // これより狭い吹き出しは字9pxにし、「▶ つぎ」を下の枠線の上に乗せて1行減らす
const homeRaidSayFont = (width) => (width < HOME_RAID_SAY_INLINE_NEXT ? 9 : width < 144 ? 10 : 11);
// 幅360未満の画面では、帯の「ジャック大王があらわれた！」を字9pxにして1行に収める
const HOME_RAID_SAY_NARROW_VW = 360;
const HOME_RAID_SAY_HOP = 18; // 跳ねる高さ(mhRaidJackHop の16px)+ゆとり。頭の上に置くときは、跳ねても頭がしっぽにかからない
// かぼちゃの目の高さ(絵の箱の上から45%)。吹き出しは、しっぽの先まで、目より HOME_RAID_SAY_FACE_GAP だけ上に置く
// (2026-10-24 窓口「320 で大王の吹き出しがかぼちゃの顔を隠している」。跳ねる16pxの半分のゆとり)
const HOME_RAID_SAY_FACE = 0.45;
const HOME_RAID_SAY_FACE_GAP = 8;
const homeRaidSayPlace = ({ head, band = null, obstacles, vw, vh, measure, top = 0 }) => {
  const widths = [...HOME_RAID_SAY_WIDTHS, ...HOME_RAID_SAY_SMALL_WIDTHS];
  const pad = 4, edge = 6, tail = 9;
  const hit = (r, o, p = 0) => { const w = Math.min(r.right, o.right + p) - Math.max(r.left, o.left - p), h = Math.min(r.bottom, o.bottom + p) - Math.max(r.top, o.top - p); return w > 0 && h > 0 ? w * h : 0; };
  const faceTop = head.top + (head.bottom - head.top) * HOME_RAID_SAY_FACE - HOME_RAID_SAY_FACE_GAP;
  // 置いてよいのは、画面の中で、札(ボタン)・みゅあの吹き出し・帯(〜があらわれた！・共有HP)のどれにもかからず、かぼちゃの顔を隠さない所だけ。
  // 札にかけて置くのはやめた(2026-10-24 窓口「M/B管理の札にかぶり『モンスター・編』で切れている。置ける場所がなければ出さない扱いで構わない」)
  const fits = (r) => {
    if (r.left < edge || r.top < top + edge || r.right > vw - edge || r.bottom > vh - edge) return false;
    if (r.bottom + tail > faceTop) return false;
    if (band && hit({ ...r, bottom: r.bottom + tail }, band, 2)) return false;
    return obstacles.every((o) => !hit(r, o, pad));
  };
  const clampX = (x, w) => Math.max(edge, Math.min(vw - edge - w, x));
  const cx = (head.left + head.right) / 2;
  // いつも頭の上に置く。横へ置くのはやめた(2026-10-24 窓口「狭い画面でも iPhone 13 と同じように、かぼちゃの上に」)。
  // 広い幅から順に、真上(跳ねても頭がしっぽにかからない高さ)から6pxずつ下げ(顔の上まで)、それぞれで左右へ6pxずつ(48pxまで)ずらして、札とのすき間を探す
  const tries = [];
  for (const w of widths) {
    const h = measure(w);
    const from = head.top - HOME_RAID_SAY_HOP - h, to = faceTop - tail - h;
    for (let y = from; y <= Math.max(from, to); y += 6) {
      tries.push({ side: 'top', left: clampX(cx - w / 2, w), top: y, width: w, height: h });
      for (let dx = 6; dx <= 48; dx += 6) for (const sign of [1, -1]) tries.push({ side: 'top', left: clampX(cx - w / 2 + sign * dx, w), top: y, width: w, height: h });
      // 札の端にそろえた位置も試す(幅320は M/B管理と神殿のすき間がちょうど吹き出しの幅ほどで、6pxずつでは当たらない)
      for (const o of obstacles) for (const left of [o.right + pad, o.left - pad - w]) if (Math.abs(left + w / 2 - cx) <= 60) tries.push({ side: 'top', left: clampX(left, w), top: y, width: w, height: h });
    }
  }
  for (const t of tries) if (fits({ left: t.left, top: t.top, right: t.left + t.width, bottom: t.top + t.height })) return { ...t, clear: true };
  // 置ける所が無いときは、吹き出しを出さない(幅320で、みゅあ・ジャックの台詞が長いとき)。ジャックを押せばレイド画面へ行けるのは同じ。
  // みゅあの台詞・ジャックの台詞が変われば、測り直して出す
  return tries.length ? { ...tries[0], clear: false, hidden: true } : null;
};
const homeRaidSayObstacles = (wrap) => {
  if (typeof document === 'undefined') return [];
  const vw = window.innerWidth, vh = window.innerHeight, out = [];
  document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
    if (wrap && wrap.contains(el)) return;
    // HOMEの施設(M/B管理・神殿・マーケットなど)は、建物ぶんの透明な押し場所の中に「見える札」(> span)を置いた作り。
    // 押し場所ごと避けると真ん中に置き場所が残らないので、見える札だけを避ける(押せる範囲は変えない)
    const face = el.classList.contains('mh-home-facility') ? (el.querySelector(':scope > span') || el) : el;
    const r = face.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return;
    if (r.width * r.height > vw * vh * 0.4) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
    out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  });
  return out;
};
const HomeRaidJack = ({ eventId, onOpen }) => {
  // 前回取れた段階の合計から描き始める(36-raid-jack-api.jsx の raidJackTotalsCache)。読み込みが終わるまでの間を「男爵・ライフ満タン」にしない
  const [totals, setTotalsState] = React.useState(() => raidJackCachedTotals(eventId));
  const setTotals = (t) => { raidJackRememberTotals(eventId, t); setTotalsState((prev) => (t || prev === undefined ? t : prev)); };
  // ひとこと(吹き出し)。押すと次のセリフへ。最初の1つは開くたびに変わる
  const [lineNo, setLineNo] = React.useState(() => Math.floor(Math.random() * 1000));
  const [pose, setPose] = React.useState(false);
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-home-raid-jack-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-home-raid-jack-css'; tag.textContent = HOME_RAID_JACK_CSS; document.head.appendChild(tag);
  }, []);
  React.useEffect(() => {
    let alive = true;
    // 通信が弱くて送れなかった与ダメージが端末に残っていれば、ここで送り直す(空なら通信しない)。本番のイベントだけ
    const flush = async () => { if (eventId !== RAID_JACK_EVENT.id) return; try { const id = await ensureBreederId(); await raidJackFlushStoredPending(id, eventId); } catch (e) { /* 次に開いたときに送り直す */ } };
    const load = async () => { await flush(); const t = await sbFetchRaidJackTierTotals(eventId); if (alive) setTotals(t); };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [eventId]);
  // 吹き出しの置き場所(homeRaidSayPlace)。null のあいだは、これまでどおりジャックの上へ置く
  const wrapRef = React.useRef(null);
  const sayRef = React.useRef(null);
  const [sayPlace, setSayPlace] = React.useState(null);
  const sayInline = !!(sayPlace && sayPlace.width < HOME_RAID_SAY_INLINE_NEXT);
  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const place = () => {
      const wrap = wrapRef.current, say = sayRef.current;
      const art = wrap && wrap.querySelector('[data-home-raid-jack] [data-jack-aura], [data-home-raid-jack] [data-home-raid-pumpkin]');
      const img = art && art.querySelector('img.mh-home-raid-jack-img');
      if (!wrap || !say || !art || !img) return;
      // 跳ねている途中の位置ではなく、置かれている位置で測る(img の transform を含まない offset から出す)
      const ar = art.getBoundingClientRect();
      const head = { left: ar.left + img.offsetLeft, top: ar.top + img.offsetTop, right: ar.left + img.offsetLeft + img.offsetWidth, bottom: ar.top + img.offsetTop + img.offsetHeight };
      if (head.right - head.left < 2) return;
      const keep = say.style.width;
      const keepFont = say.style.fontSize;
      const nextInline = say.querySelector('[data-say-next-inline]'), nextRow = say.querySelector('[data-say-next-row]');
      const keepNext = [nextInline && nextInline.style.display, nextRow && nextRow.style.display];
      const measure = (w) => {
        say.style.width = `${w}px`; say.style.fontSize = `${homeRaidSayFont(w)}px`;
        if (nextInline && nextRow) { const inl = w < HOME_RAID_SAY_INLINE_NEXT; nextInline.style.display = inl ? 'block' : 'none'; nextRow.style.display = inl ? 'none' : 'block'; }
        return say.offsetHeight;
      };
      const bandEl = wrap.querySelector('[data-home-raid-jack] [data-home-raid-jack-title]');
      const br = bandEl && bandEl.parentElement.getBoundingClientRect();
      const next = homeRaidSayPlace({ head, band: br ? { left: br.left, top: br.top, right: br.right, bottom: br.bottom } : null, obstacles: homeRaidSayObstacles(wrap), vw: window.innerWidth, vh: window.innerHeight, measure });
      say.style.width = keep; say.style.fontSize = keepFont;
      if (nextInline && nextRow) { nextInline.style.display = keepNext[0]; nextRow.style.display = keepNext[1]; }
      if (!next) return;
      const wr = wrap.getBoundingClientRect();
      const rel = { side: next.side, hidden: !!next.hidden, left: Math.round(next.left - wr.left), top: Math.round(next.top - wr.top), width: next.width,
        tail: Math.round(Math.max(14, Math.min(next.width - 14, (head.left + head.right) / 2 - next.left))) };
      setSayPlace((prev) => (prev && prev.side === rel.side && prev.hidden === rel.hidden && prev.left === rel.left && prev.top === rel.top && prev.width === rel.width && prev.tail === rel.tail ? prev : rel));
    };
    place();
    // ボタンの並び・みゅあの吹き出しの長さは、読み込みやセリフで後から変わる。軽い測り直しをときどき回す
    const timers = [setTimeout(place, 120), setTimeout(place, 700)];
    const id = setInterval(place, 1500);
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    // みゅあの吹き出しが伸び縮みすると、札(M/B管理・神殿)も動く(--mh-home-assistant-bottom)。札が動き終わってから測り直す
    const mua = document.querySelector('.mh-home-assistant');
    const ro = (mua && typeof ResizeObserver !== 'undefined') ? new ResizeObserver(() => timers.push(setTimeout(place, 60))) : null;
    if (ro) ro.observe(mua);
    return () => { if (ro) ro.disconnect(); timers.forEach(clearTimeout); clearInterval(id); window.removeEventListener('resize', place); window.removeEventListener('orientationchange', place); };
  }, [lineNo, totals]);
  // ときどき両腕ポーズ(約7秒に1回、1.4秒だけ)
  React.useEffect(() => {
    let alive = true; let timer = null;
    const loop = () => { timer = setTimeout(() => { if (!alive) return; setPose(true); timer = setTimeout(() => { if (!alive) return; setPose(false); loop(); }, 1400); }, 5600); };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  // 初めて読み込み中(まだ一度も合計が取れていない)あいだは、段階もライフも分からないので描かない
  if (totals === undefined) return null;
  // いま挑める段階 = まだ共有HPが残っている最初の段階。全部倒していたら「討伐おめでとう」
  const tiers = RAID_JACK_A_TIERS;
  const totalOf = (i) => (totals && totals.a && totals.a[i + 1] ? totals.a[i + 1].total : 0);
  // 大王が倒されたか(段階5の合計がライフ以上)で決める。倒されたあとは、小さなぱんぷきんが遊びに来る
  const allDone = raidJackBossDown(totals);
  const currentIndex = allDone ? -1 : (totals ? tiers.findIndex((t, i) => totalOf(i) < t.hp) : 0);
  const tier = tiers[Math.max(0, allDone ? tiers.length - 1 : currentIndex)];
  const left = allDone ? 0 : Math.max(0, tier.hp - totalOf(Math.max(0, currentIndex)));
  const rate = tier.hp > 0 ? Math.max(0, Math.min(1, left / tier.hp)) : 0;
  // いま話せるセリフ: 段階(爵位)の話し方 × 残りライフの場面。大王を倒したあとはぱんぷきん(場面なし)
  const speechLines = raidJackHomeLines(tier.id, rate, allDone);
  const speech = speechLines[lineNo % speechLines.length];
  const speechAccent = allDone ? '#fdba74' : '#fb923c';
  const tierNo = Number(String(tier.id).slice(1)) || 0;
  // 影と段階・HPの札。本体と、炎の層の見えない枠(高さをそろえるため)の両方で使う
  const shadowEl = <span className="mh-home-raid-jack-shadow" aria-hidden="true" style={{ display:'block', width:'70%', height:'8px', marginTop:'-6px', borderRadius:'50%', background:'#0008', filter:'blur(3px)' }} />;
  const labelEl = (
      <span style={{ display:'block', width:'100%', marginTop:'6px', padding:'3px 6px', borderRadius:'10px', border:'1px solid #fdba74aa', background:'#1c0a02d9', color:'#ffedd5', fontSize:'10px', fontWeight:900, textAlign:'center', lineHeight:1.3 }}>
        {/* 「〜が」のあとだけで折る(2026-10-20 窓口「ジャック大王があらわれ／た！」と言葉の途中で折れていた)。
            keep-all で字の間では折らず、<wbr/> の所だけで折る。それでも入らないときだけ anywhere で折る。
            幅360未満の画面は字を9pxにして1行に収める(2026-10-24 窓口「幅320で『ジャック大王／あらわれた』と折れている」) */}
        <span data-home-raid-jack-title style={{ display:'block', ...JA_WRAP_STYLE, ...(typeof window !== 'undefined' && window.innerWidth < HOME_RAID_SAY_NARROW_VW ? { fontSize:'9px' } : {}) }}>{allDone ? <>{RAID_JACK_PUMPKIN.name}が<wbr/>遊びに来た！</> : <>{tier.name}が<wbr/>あらわれた！</>}</span>
        {allDone ? <span data-home-raid-pumpkin-note style={{ display:'block', marginTop:'2px', fontSize:'8px', opacity:.9, ...JA_LABEL_STYLE }}>{jaWrap('ジャックを倒した！あそんでダメージを競おう')}</span> : <>
        <span style={{ display:'block', height:'7px', marginTop:'3px', borderRadius:'999px', overflow:'hidden', background:'#000a', border:'1px solid #fff3' }} role="progressbar" aria-valuemin={0} aria-valuemax={tier.hp} aria-valuenow={left}>
          <span style={{ display:'block', height:'100%', width:`${rate * 100}%`, background:'#f97316' }} />
        </span>
        {totals === null ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>準備中</span>
          : totals === undefined ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>…</span>
          : <span style={{ display:'block', fontSize:'8px', opacity:.85 }}>共有HP {left.toLocaleString()}</span>}
        </>}
      </span>
  );
  return (
    <>
    {/* 炎(オーラ)の層。施設の札・みゅあの吹き出し・上の帯より後ろ(HOME_RAID_JACK_AURA_WRAP_STYLE)。
        HOMEのジャックは小さいので、オーラは絵より大きな枠へ広げて描く(段階が上がるほど大きく) */}
    {!allDone && <div aria-hidden="true" data-home-raid-aura-wrap style={HOME_RAID_JACK_AURA_WRAP_STYLE}>
      <div style={HOME_RAID_JACK_AURA_BOX_STYLE}>
        <span data-jack-aura={tierNo || undefined} style={{ position:'relative', display:'block', width:'100%', aspectRatio:'1024 / 640' }}>
          <span style={{ position:'absolute', pointerEvents:'none', visibility:'visible', inset:`${-20 - tierNo * 8}% ${-10 - tierNo * 5}% -6%` }}>
            <JackAuraLayer tier={tierNo} />
          </span>
        </span>
        {shadowEl}
        {labelEl}
      </div>
    </div>}
    <div ref={wrapRef} data-home-raid-jack-wrap style={HOME_RAID_JACK_WRAP_STYLE}>
    {/* ひとこと。ジャックの上に出る吹き出し。押すと次のセリフへ(ジャック本体を押すとレイド画面) */}
    <button type="button" ref={sayRef} key={`say${lineNo}`} data-home-raid-say data-story-pop="1" data-say-side={sayPlace ? sayPlace.side : 'top'} data-say-hidden={sayPlace && sayPlace.hidden ? 'true' : undefined} aria-hidden={sayPlace && sayPlace.hidden ? 'true' : undefined} onClick={() => setLineNo((n) => n + 1)} aria-label="ジャックのひとこと(押すと次のセリフ)"
      style={{ position:'absolute', ...(sayPlace ? { left:sayPlace.left, top:sayPlace.top, width:sayPlace.width } : { left:'50%', bottom:'100%', marginLeft:-92, marginBottom:'4px', width:184 }),
        padding:'6px 10px', borderRadius:'14px', boxSizing:'border-box',
        border:`2px solid ${speechAccent}`, background:'#1c0a02ee', color:'#ffedd5', fontSize:`${homeRaidSayFont(sayPlace ? sayPlace.width : 184)}px`, fontWeight:900, lineHeight:1.45, textAlign:'left', cursor:'pointer',
        boxShadow:`0 0 12px ${speechAccent}66`, animation:'storyPop .25s ease-out both', zIndex:2, pointerEvents:(sayPlace && sayPlace.hidden) ? 'none' : 'auto',
        ...(sayPlace && sayPlace.hidden ? { visibility:'hidden' } : {}) }}>
      {/* 狭い幅(横へ置いたとき)でも「聞こえるの／う」と言葉の途中で折らず、行の長さをならす(2026-10-21) */}
      {/* いちばん狭い120pxのときは「▶ つぎ」を下の枠線の上に乗せ、行を使わない(幅320で、かぼちゃの顔を隠さないため。2026-10-24) */}
      <span data-home-raid-say-text style={{ display:'block', ...JA_LABEL_STYLE }}>{jaWrap(speech)}</span>
      <span aria-hidden="true" data-say-next-inline style={{ display:sayInline ? 'block' : 'none', position:'absolute', right:'10px', bottom:'-6px', padding:'0 4px', borderRadius:'4px', background:'#1c0a02', color:'#ffedd5', fontSize:'8px', lineHeight:'10px', whiteSpace:'nowrap' }}>▶ つぎ</span>
      <span aria-hidden="true" data-say-next-row style={{ display:sayInline ? 'none' : 'block', textAlign:'right', fontSize:'8px', opacity:.7 }}>▶ つぎ</span>
      {/* しっぽはジャックのほうへ向ける(上に置いたら下向き、右に置いたら左向き、左に置いたら右向き) */}
      {(!sayPlace || sayPlace.side === 'top') && <span aria-hidden="true" style={{ position:'absolute', left:sayPlace ? sayPlace.tail : '50%', bottom:-9, marginLeft:-8, width:0, height:0, borderLeft:'8px solid transparent', borderRight:'8px solid transparent', borderTop:`9px solid ${speechAccent}` }} />}
    </button>
    <button type="button" data-home-raid-jack onClick={onOpen} aria-label={allDone ? `${RAID_JACK_PUMPKIN.name}が遊びに来た！タップでレイド画面を開く` : `${tier.name}があらわれた！タップでレイド画面を開く`} style={HOME_RAID_JACK_BUTTON_STYLE}>
      {/* 通常絵とポーズ絵を重ねて、切り替えは透明度だけで行う(先に両方読み込める・切り替えで枠の高さが変わらない)。
          ポーズ絵は腕が左右に広がるぶん本体が幅の約半分になるので、通常絵を半分の大きさ(RAID_JACK_NORMAL_ART_SCALE)で描いて本体の大きさをそろえる。
          どちらも足もと(本体の下端)をそろえて置く */}
      <span data-jack-aura={allDone ? undefined : (Number(String(tier.id).slice(1)) || undefined)} data-home-raid-pumpkin={allDone ? 'true' : undefined} style={{ position:'relative', display:'block', width:'100%', aspectRatio:'1024 / 640' }}>
        {/* 段階が進むほど派手になるオーラは、施設より後ろの別の層(下の data-home-raid-aura-wrap)で描く */}
        {/* 大王を倒したあとは、小さなぱんぷきんが遊びに来る(オーラ・ポーズ絵なし。跳ねる動きは同じ) */}
        {allDone ? <img className="mh-home-raid-jack-img" src={PUMPKIN_ICON_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_PUMPKIN_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_PUMPKIN_ART_SCALE * 100}%`, height:'auto', filter:'drop-shadow(0 6px 10px #000a)', pointerEvents:'none' }} /> : <>
        <img className="mh-home-raid-jack-img" src={JACK_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_NORMAL_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_NORMAL_ART_SCALE * 100}%`, height:'auto', opacity:pose ? 0 : 1, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        <img className="mh-home-raid-jack-img" src={JACK_POSE_IMG} alt="" draggable={false} aria-hidden="true"
          style={{ position:'absolute', left:0, bottom:'-6%', width:'100%', height:'auto', opacity:pose ? 1 : 0, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        </>}
      </span>
      {shadowEl}
      {labelEl}
    </button>
    </div>
    </>
  );
};
// HOME 右上の枠(ダイヤ・ブリーダーP)を、桁が多いときだけ広げる幅(px)。ふだんの桁数では 0 で、見た目は今のまま。
// 数の字は 10px で1文字およそ 6.4px。枠の中で数に使える幅はダイヤが 50px・ブリーダーP が 29px(幅152pxのとき)なので、
// 足りないぶんだけ最大 24px 広げ、それでも入らないぶんは字を小さくする(70-bootstrap.jsx の --wal-room)。
// tools/home-layout-check.js がこの1行を取り出して同じ計算で測る
// 「億」「兆」のような全角の字は数字より広いので、2.5字ぶんとして数える(N5・2026-10-21)。数字とカンマだけのときは今までと同じ
const homeWalletGrowPx=(goldText,bpText)=>{const w=t=>[...String(t)].reduce((n,c)=>n+(c.charCodeAt(0)>0x7f?2.5:1),0);return Math.min(24,Math.max(0,Math.ceil(w(goldText)*6.4-50),Math.ceil(w(bpText)*6.4-29)));};
function HomeScreen({
  assistantBondUp, friendRequestCount = 0, breederIcon, breederLevel, breederName, breederPoints, gifts, gold,
  hasUnreadChangelog, homeBackgroundReady, homeArt, homePastureMasumons, masuMons, missions,
  onOpenBattle, onOpenManagement, onOpenMarket, onOpenProfile, onOpenRhythm, onOpenSettings,
  onOpenTemple, openChangelog, openGiftBox, openMissions, profileFrameId, resolveIconUrl, spotClass,
  raidJackVisible = false, raidJackEventId, onOpenRaidJack,
  // 助手とおしゃべり(2026-10-14)。公開の印 assistantChat が立つまでは null(ボタンを出さない)
  onOpenAssistantChat = null,
  // MFバトルカードの入口(案A・左の列のいちばん下)。公開の印 cardBattle が立ち、公開のお話を見た人だけ(60-app.jsx が決める)
  cardBattleVisible = false, onOpenCardBattle = null, cardBattleTeaser = false, onOpenCardTeaser = null,
}) {
  // 背景の絵は「HOMEの枠が横長かどうか」で選ぶ。画面の向きでは決めない。
  // パソコンは画面が横長でも、HOMEは幅600の縦長の列に収まるので、横長の絵を出すと村の真ん中だけが大きく写り、
  // 施設ボタンが建物と合わなくなる。枠の大きさは自前で回しているとき(横持ちの描き方)も回す前の値なので、そのまま使える
  const homeSceneRef=React.useRef(null);
  const [homeSceneWide,setHomeSceneWide]=React.useState(false);
  React.useEffect(()=>{
    const el=homeSceneRef.current;
    if(!el)return undefined;
    const measure=()=>{const w=el.clientWidth,h=el.clientHeight;if(w>0&&h>0)setHomeSceneWide(w/h>1.2);};
    measure();
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
    const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();
  },[]);
  // みゅあの吹き出しの下端(場面の上から何px)を CSS の --mh-home-assistant-bottom へ渡す。台詞は切らずに全部出すので、
  // 長い台詞で伸びたぶんだけ M/B管理・神殿の札を下げる(2026-10-24 窓口「幅320で『ついてるから大丈夫！…』と切れている」)。
  // 回して描いているときも狂わないよう、画面上の位置ではなく offset で測る
  React.useEffect(()=>{
    const scene=homeSceneRef.current;const box=scene&&scene.querySelector('.mh-home-assistant');
    if(!scene||!box)return undefined;
    const measure=()=>{const b=box.offsetTop+box.offsetHeight;if(b>0)scene.style.setProperty('--mh-home-assistant-bottom',`${Math.ceil(b)}px`);};
    measure();
    if(typeof ResizeObserver==='undefined'){const id=setInterval(measure,1000);return()=>clearInterval(id);}
    const ro=new ResizeObserver(measure);ro.observe(box);ro.observe(scene);return()=>ro.disconnect();
  },[]);
  const homeBackgroundSrc=homeArtSrc(homeArt,homeSceneWide);
  const homeBackgroundWide=homeArtIsWide(homeArt,homeSceneWide);
  // ★バッジのCSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、
  //   配置の検査(home-layout-check.js)が施設の位置を測るときに数がずれる。
  //   head なら画面の中身に影響しない。
  React.useEffect(()=>{
    if(typeof document==='undefined')return;
    if(document.getElementById('mh-home-event-badge-css'))return;
    const tag=document.createElement('style');
    tag.id='mh-home-event-badge-css';
    tag.textContent=HOME_EVENT_BADGE_CSS;
    document.head.appendChild(tag);
  },[]);
  // 開催中のキャンペーンのうち、HOMEの札・バナー(banner)を持つもの(ハロウィン・ナイト)。描くたびに数え直す
  const homeEventCampaign=(()=>{
    if(typeof RELEASE_FLAGS==='undefined'||!RELEASE_FLAGS||RELEASE_FLAGS.rhythmEventPoints!==true||typeof rhythmEventPointCampaignAt!=='function')return null;
    const campaign=rhythmEventPointCampaignAt(Date.now());
    return campaign&&campaign.banner?campaign:null;
  })();
  // モンヒロビートのイベントを開催しているか。描くたびに数え直す(上の★のとおり)
  const homeRhythmEventOpen=(()=>{
    const released=(typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS&&RELEASE_FLAGS.rhythmWeeklyRanking===true);
    if(!released||typeof rhythmLimitedEventAt!=='function')return false;
    return !!rhythmLimitedEventAt(Date.now());
  })();
  return (

      <main ref={homeSceneRef} className="mh-home-scene" aria-label="村の広場">
        {/* 背景は設定の「ホーム画面アレンジ」で選んだ絵。HOMEの枠が横長なら横長の絵を画面いっぱいに出す(is-wide) */}
        <picture className={`mh-home-background ${homeBackgroundReady?'is-ready':''} ${homeBackgroundWide?'is-wide':''}`} aria-hidden="true"><img className="mh-home-backdrop" src={homeBackgroundSrc} alt=""/><img className="mh-home-main" src={homeBackgroundSrc} alt=""/></picture>
        <div className="mh-home-masumon-layer" aria-hidden="true">{homePastureMasumons.map((masu,index)=><HomeWalkingMasumon key={masu.id} masu={masu} base={ALL_PLAYER_MONSTERS[masu.baseId]} masuColors={getMasuColors(masu)} index={index} count={homePastureMasumons.length}/>)}</div>
        {/* 設定を光らせるときは、上の帯ごと暗幕より前に出す(帯が z-index を持っていて中だけ前に出せないため) */}
        {raidJackVisible&&<HomeRaidJack eventId={raidJackEventId} onOpen={onOpenRaidJack}/>}
        <header className={`mh-home-status${spotClass('settings')}`}>
          <button type="button" className="mh-home-player relative" onClick={onOpenProfile} aria-label="プロフィールを開く">
            <HomeProfileIcon src={resolveIconUrl(breederIcon)} id={breederIcon} frameId={profileFrameId}/>
            <div className="mh-home-player-copy"><strong>{breederName}</strong><span>ブリーダー Lv.{breederLevel.level}</span><div className="mh-home-xp"><i style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></i></div><small>{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</small></div>
            <ChevronRight className="mh-home-profile-arrow" size={15}/>
            {Number(friendRequestCount)>0&&<span data-home-friend-badge aria-label={`フレンド申請が${Number(friendRequestCount)}件届いています`} className="absolute -right-1 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[12px] font-black text-white shadow-lg">{Math.min(99,Number(friendRequestCount))}</span>}
          </button>
          {/* ダイヤ・ブリーダーP は桁が増えても折り返さず1行のまま(2026-10-13 社長「8桁で『ダイヤ』が縦に折れて枠が伸びた」)。
              桁が多いときだけ枠を少し広げ(homeWalletGrowPx)、それでも入らないぶんは文字数(--len)に合わせて字を小さくする(70-bootstrap.jsx の --wal-room) */}
          {/* 9桁(1億)からは「67.3億」のように縮めて出す(N5)。押すと細かい数が出る(CompactCount) */}
          <section className="mh-home-wallet" style={{'--wal-grow':`${homeWalletGrowPx(compactCount(gold),compactCount(breederPoints))}px`}}>
            <div><Gem size={14}/><CompactCount value={gold} style={{'--len':String(compactCount(gold)).length}}/><small>ダイヤ</small></div><div><Coins size={14}/><CompactCount value={breederPoints} style={{'--len':String(compactCount(breederPoints)).length}}/><small>ブリーダーP</small></div>
            <button onClick={onOpenSettings} className={`mh-home-settings${spotClass('settings')}`} aria-label="設定"><Settings size={20}/><span>設定</span></button>
          </section>
        </header>
        <nav className="mh-home-facilities" aria-label="拠点施設">
          {/* 看板の下に小さく1行(2026-10-09 ユーザー選択。G7「呼び名が分かりにくい」→ 呼び名は変えず、入口に何のことかを足す) */}
          <button className={`mh-home-facility management${spotClass('management')}`} onClick={onOpenManagement} aria-label="M/B管理"><span><Layers size={18}/><b className="mh-home-facility-label">M/B管理<small>モンスター・編成</small></b></span></button>
          <button className={`mh-home-facility temple${spotClass('temple')}`} onClick={onOpenTemple} aria-label="神殿"><span><Sparkles size={18}/>神殿</span></button>
          <button className={`mh-home-facility market${spotClass('market')}`} onClick={onOpenMarket} aria-label="マーケット"><span><ShoppingBag size={17}/>マーケット</span></button>
          {/* 修行の施設をやめ、その場所を音ゲー「モンヒロビート」に譲った(2026-09-03にユーザーが決定、
              2026-09-04に正式名称を「モンスタービート」から「モンヒロビート」へ変更)。
              公開フラグが立つまでは修行と同じように「準備中」の案内だけを出し、本編からは遊べない。
              中身はデバッグ画面の「音ゲー体験版」から確認できる */}
          {/* ★イベント開催中は、その遊びのボタンに札を出す(2026-09-11・ユーザー指示
              「イベント開催中は対応してるコンテンツボタンのとこにイベント開催中みたいなのがほしい」)。
              HOMEを開いた時点で「いま何かやっている」と分かるようにする。
              ★期間の判定は描くたびに行う(読み込み時に1回だけ決めると、開きっぱなしの端末で
                古いままになる・CLAUDE.md ⑥-4)。開催していなければ何も出ない。
              ★いまのイベントはモンヒロビートの曲だけを対象にするので、札もここだけ。
                ほかの遊びを対象にするイベントを作るときは、そのボタンにも同じ em を足す */}
          <button className="mh-home-facility rhythm" onClick={onOpenRhythm} aria-label={RHYTHM_MODE_PUBLIC_RELEASE?"モンヒロビート":"モンヒロビート（準備中）"}><span>🎵 モンヒロビート{!RHYTHM_MODE_PUBLIC_RELEASE&&<small>準備中</small>}{homeRhythmEventOpen&&<em data-home-event-badge className="mh-home-event-badge" style={HOME_EVENT_BADGE_STYLE}>✨開催中✨</em>}</span></button>
          {/* 2026-09-20 ユーザー指示で正式名称を「モンヒロバトル」にした。
              モンヒロビートと同じく、字が長くても略さずそのまま入れる(CLAUDE.md ⑤) */}
          <button className={`mh-home-facility battle${spotClass('battle')}`} onClick={onOpenBattle} aria-label="モンヒロバトル"><span><Sword size={25}/>モンヒロバトル</span></button>
        </nav>
        <button onClick={openMissions} className={`mh-home-mission${spotClass('reward')}`}><List size={16}/>ミッション
          {missionClaimableCount(normalizeMissions(missions))>0&&<em>{missionClaimableCount(normalizeMissions(missions))}</em>}
        </button>
        <button onClick={openGiftBox} className={`mh-home-gift${spotClass('reward')}`}><Package size={16}/>ギフト
          {giftClaimableCount(gifts)>0&&<em>{giftClaimableCount(gifts)}</em>}
        </button>
        <button onClick={openChangelog} className="mh-home-update"><RefreshCcw size={15}/>更新履歴{hasUnreadChangelog&&<em className="mh-unread-badge" aria-label="未読あり">!</em>}</button>
        {/* 期間限定イベントのバナー(2026-10-04)。押すと更新履歴(イベントの詳細)を開く。ゲーム全体のイベントなので、特定の遊びのボタンには付けない。縦持ちの左下(モンヒロバトルのすぐ上)。右側のボタン列・上の吹き出しとかぶらない場所。横持ちでは出さない */}
        {homeEventCampaign&&<button type="button" data-home-event-banner className="mh-home-event-banner" onClick={openChangelog} aria-label={`${homeEventCampaign.banner.title} ${homeEventCampaign.banner.sub}`}>
          <b>{homeEventCampaign.banner.emoji} {homeEventCampaign.banner.title}</b><small>{homeEventCampaign.banner.sub}</small>
        </button>}
        {/* MFバトルカード(社長が決めた案A: 左の列のいちばん下・ハロウィン・ナイトの札の下。札が無いときは1段上がる) */}
        {cardBattleVisible&&typeof onOpenCardBattle==='function'&&<button type="button" data-home-card-battle className={`mh-home-card-battle${homeEventCampaign?'':' raised'}`} onClick={onOpenCardBattle} aria-label="MFバトルカード"><span>🃏 MFバトルカード</span></button>}
        {/* 公開前の予告(社長 2026-10-25「近日公開みたいな感じでホームに出して」)。同じ場所に「近日公開」の札を付けて出し、押すと予告の小窓。中には入れない。
            公開の印(RELEASE_FLAGS.cardBattle)を立てると、60-app がこちらを下ろして上のふつうの入口に切り替える */}
        {!cardBattleVisible&&cardBattleTeaser&&typeof onOpenCardTeaser==='function'&&<button type="button" data-home-card-battle-teaser className={`mh-home-card-battle soon${homeEventCampaign?'':' raised'}`} onClick={onOpenCardTeaser} aria-label="MFバトルカード 近日公開"><span>🃏 MFバトルカード<small>近日公開</small></span></button>}
        {/* 仲良し度が上がった直後だけ、みゅあがそのことに触れる(HOMEを離れると元に戻る) */}
        <div className={`mh-home-assistant${spotClass('assistant')}`}><AssistantBubble scene="home" condition={assistantBondUp?'bondUp':(masuMons.length===0?'firstRun':null)} compact footerSpace={typeof onOpenAssistantChat==='function'?70:0}/>
          {/* ★おしゃべりのボタンは、吹き出しの下の行(「タップで詳しく」の左の空き)へ重ねる(2026-10-16)。吹き出しの下へ1段足すと
              吹き出しが高くなり、横持ちでは施設の札「M/B管理」、小さい画面ではジャックの吹き出しにかぶって押せなくなっていた
              (raid-jack-home-say-tap-check)。吹き出しの中身はボタン(詳しい説明を開く)なので、入れ子にせず上に重ねる。左は顔(48px)+すき間(8px)+吹き出しの内側。吹き出しには footerSpace で、下の行の左にボタンの幅ぶんの空きを取らせる */}
          {typeof onOpenAssistantChat==='function'&&<button type="button" data-home-assistant-chat onClick={onOpenAssistantChat} className="absolute bottom-[6px] z-10 rounded-full border border-pink-300/70 bg-pink-500/85 px-1.5 py-px text-[9px] font-black leading-tight text-white shadow active:scale-95" style={{left:'64px'}}>💬 おしゃべり</button>}
        </div>
      </main>
    
  );
}

function KikiIntroOverlay({
  kikiIntroStep, markKikiIntroSeen, setKikiIntroStep,
}) {

    const script=(typeof ASSISTANT_KIKI_INTRO!=='undefined'&&ASSISTANT_KIKI_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(kikiIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    // 顔を並べるのは、この台本に出てくる助手だけ。
    // 全員を並べると、まだ登場していない助手までここに映ってしまう
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markKikiIntroSeen(); else setKikiIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ききが助手に加わりました">
      {/* どこを押しても次へ進む。最後の1回で見たことにする */}
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-300">あたらしい助手</p>
        {/* 2人を並べて出し、いま話しているほうを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?84:64} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1" style={bubbleWrapStyle()}>{bubbleWrap(line.t)}</span>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold tabular-nums text-slate-300">
          {step+1} / {script.length}
        </p>
        {/* スキップ(2026-10-10・改善部の提案K2「あたらしい助手の紹介が10ページでスキップが無い」とユーザー指示)。
            飛ばしても、最後まで見たときと同じ markKikiIntroSeen を通る(見たことになり、次の起動で出ない。回想からいつでも見直せる) */}
        <div className={`relative mt-3 grid ${last?'grid-cols-1':'grid-cols-[1fr_2fr]'} gap-2`} style={{pointerEvents:'auto'}}>
          {!last&&<button type="button" onClick={(e)=>{e.stopPropagation();markKikiIntroSeen();}} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]">スキップ</button>}
          <button type="button" onClick={(e)=>{e.stopPropagation();next();}} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950 active:scale-[.98]">{last?'閉じる':'次へ'}</button>
        </div>
      </div>
    </div>);
  
}

function MomosukeIntroOverlay({
  markMomosukeIntroSeen, momosukeIntroStep, setMomosukeIntroStep,
}) {

    const script=(typeof ASSISTANT_MOMOSUKE_INTRO!=='undefined'&&ASSISTANT_MOMOSUKE_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(momosukeIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markMomosukeIntroSeen(); else setMomosukeIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ももすけが助手に加わりました">
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-300 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-200">あたらしい助手</p>
        {/* 3人を並べて、いま話しているひとりを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?76:56} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1" style={bubbleWrapStyle()}>{bubbleWrap(line.t)}</span>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold tabular-nums text-slate-300">{step+1} / {script.length}</p>
        {/* スキップ(2026-10-07・モンヒロくんの報告とユーザー指示)。39場面あり、イベントのお話のように飛ばせなかった。
            飛ばしても見たことになり、回想(EVENT_REPLAYS の momosuke_intro)からいつでも見直せる */}
        <div className={`relative mt-3 grid ${last?'grid-cols-1':'grid-cols-[1fr_2fr]'} gap-2`} style={{pointerEvents:'auto'}}>
          {!last&&<button type="button" onClick={(e)=>{e.stopPropagation();markMomosukeIntroSeen();}} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]">スキップ</button>}
          <button type="button" onClick={(e)=>{e.stopPropagation();next();}} className="min-h-[50px] rounded-2xl bg-pink-400 text-sm font-black text-slate-950 active:scale-[.98]">{last?'閉じる':'次へ'}</button>
        </div>
      </div>
    </div>);
  
}

// フレンド申請が届いているときの、助手の知らせ(HOMEに来たときだけ)。
// 選んでいる助手の口調で一言。「見にいく」でフレンド画面へ、「あとで」で閉じる(閉じるだけで申請は消えない)
const FRIEND_NOTICE_LINES = Object.freeze({
  mua: (who) => `${who}からフレンド申請が届いてるよ♪ 見にいってみよう！`,
  kiki: (who) => `${who}からフレンド申請が届いてまつよ。見にいきまつか？`,
  momosuke: (who) => `${who}からフレンド申請が来てるよw 見にいこ？`,
  dra: (who) => `${who}からフレンド申請が来てるわ。見にいくか`,
  atsu: (who) => `${who}からフレンド申請来てるよ。とりあえず見にいこ`,
  kyuko: (who) => `ほい！ ${who}からフレンド申請来てるよぉ。見にいこ笑`,
  sorashido: (who) => `おっ、${who}からフレンド申請来てる！ 見にいこ笑`,
});
function HomeFriendRequestNotice({ activeAssistant, count, names, onOpen, onLater }) {
  const who = activeAssistant;
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  const label = list.length === 0 ? `${count}人`
    : count > list.length ? `${list.join('さん・')}さんたち` : `${list.join('さん・')}さん`;
  const line = (FRIEND_NOTICE_LINES[who && who.id] || FRIEND_NOTICE_LINES.mua)(label);
  return (
    <div data-friend-request-notice className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:75000,backgroundColor:'rgba(2,6,23,.80)'}} role="dialog" aria-modal="true" aria-label="フレンド申請のお知らせ">
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 border-rose-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h2 className="mb-2 text-center text-base font-black text-rose-200">フレンド申請が届いています</h2>
        <div className="flex items-end gap-2">
          {who&&<AssistantFace who={who} size={76} accent={who.accent} expression="happy"/>}
          <div className="flex-1 rounded-2xl border-2 border-rose-400 bg-slate-900 p-3 text-[13px] font-bold leading-relaxed text-white" style={bubbleWrapStyle()}>{bubbleWrap(line)}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" data-friend-notice-later onClick={onLater} className="min-h-[50px] rounded-2xl border border-white/20 bg-slate-800 text-sm font-black text-slate-200 active:scale-95">あとで</button>
          <button type="button" data-friend-notice-open onClick={onOpen} className="min-h-[50px] rounded-2xl bg-rose-500 text-sm font-black text-white active:scale-95">見にいく</button>
        </div>
      </div>
    </div>);
}

// 起動時のお知らせが2件以上たまっているとき、見出しの一覧を1枚だけ出す(2026-10-10・ユーザー指示「起動時のお知らせを1枚にまとめる」)。
// 読みたい件だけ「くわしく」で開く(開いた件は今までどおりのページ送り)。「あとで読む」はその場の全件を既読にする(更新履歴にはいつでも残る)
function HomeUpdateGuideBundle({ activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, selectedAssistantId, updateGuideQueue, openUpdateGuideDetail, dismissUpdateGuideAll }) {
const who=activeAssistant;
const headline=n=>{const pages=(typeof assistantNoticePagesFor==='function')?assistantNoticePagesFor(n,who&&who.id):(Array.isArray(n.pages)?n.pages:[]);const first=pages[0];const text=(typeof assistantNoticePageText==='function')?assistantNoticePageText(first):String(first||'');return assistantSpeakText(text,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId);};
return(
  <div data-update-guide-bundle className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label="新しいお知らせの一覧">
    <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(env(safe-area-inset-bottom) + 16px)'}}>
      <div className="flex items-center gap-2"><AssistantFace who={who} size={56} accent={who.accent} expression="happy"/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 p-2.5 text-sm font-bold text-white">新しいお知らせが{updateGuideQueue.length}件あるよ♪ 読みたいものだけ「くわしく」で開いてね。</div></div>
      <div className="mt-3 space-y-2">{updateGuideQueue.map(n=><div key={n.id} data-update-guide-bundle-item={n.id} className="flex items-center gap-2 rounded-2xl border border-pink-400/40 bg-slate-900/80 p-2.5">
        <div className="min-w-0 flex-1"><div className="text-[13px] font-black leading-snug text-pink-200">{n.title}</div><div className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{headline(n)}</div></div>
        <button type="button" onClick={()=>openUpdateGuideDetail(n.id)} className="min-h-[44px] shrink-0 rounded-xl bg-pink-500 px-3 text-xs font-black text-slate-950">くわしく</button>
      </div>)}</div>
      <button type="button" data-update-guide-bundle-later onClick={dismissUpdateGuideAll} className="mt-4 min-h-[50px] w-full rounded-2xl bg-slate-700 text-sm font-black text-white">あとで読む</button>
      <p className="mt-2 text-center text-[10px] font-bold text-slate-500">更新履歴からいつでも読めます</p>
    </div>
  </div>);
}
function HomeUpdateGuideOverlay({
  activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, finishUpdateGuide,
  selectedAssistantId, setUpdateGuidePage, updateGuidePage, updateGuideQueue,
  updateGuideDetail, openUpdateGuideDetail, dismissUpdateGuideAll,
}) {
if(updateGuideQueue.length>=2&&!updateGuideDetail&&!updateGuideQueue[0].debugPreview)
  return <HomeUpdateGuideBundle activeAssistant={activeAssistant} assistantBondLevelNow={assistantBondLevelNow} assistantCallStyle={assistantCallStyle} breederName={breederName} selectedAssistantId={selectedAssistantId} updateGuideQueue={updateGuideQueue} openUpdateGuideDetail={openUpdateGuideDetail} dismissUpdateGuideAll={dismissUpdateGuideAll}/>;
const notice=updateGuideQueue[0];const who=activeAssistant;
// ★選んでいる助手が自分の口調で話す(2026-09-11・ユーザー指示)。
//   その助手のセリフが用意されていない告知は、今までどおり更新履歴の本文をそのまま読む。
//   1ページは文字列でも { e, t } でも書ける(既存の告知は文字列のまま動く)
const pages=(typeof assistantNoticePagesFor==='function')
  ?assistantNoticePagesFor(notice,who&&who.id)
  :(Array.isArray(notice.pages)&&notice.pages.length?notice.pages:['新しいアップデートがあるよ♪']);
const page=Math.min(updateGuidePage,pages.length-1);const last=page===pages.length-1;
const pageText=(typeof assistantNoticePageText==='function')?assistantNoticePageText(pages[page]):String(pages[page]||'');
const pageExpression=(typeof assistantNoticePageExpression==='function')
  ?assistantNoticePageExpression(pages[page],notice.expression||'happy')
  :(notice.expression||'happy');
return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label={notice.title}>
      <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        {notice.debugOnly&&<div className="mb-2 rounded-lg bg-fuchsia-700 px-2 py-1 text-center text-[9px] font-black text-white">DEBUG・通常ログインでは表示されません</div>}
        {/* 告知画像(イベントなど)。あるときだけ、いちばん上に大きく出す。
            画面の高さを食いすぎないよう上限を付ける(正方形の絵でも説明が読める位置に残る)。
            読めなかったら黙って消す(壊れた画像のアイコンを残さない) */}
        {notice.image&&<img data-update-notice-image src={notice.image} alt={`${notice.title}のお知らせ`}
          onError={e=>{e.currentTarget.style.display='none';}} decoding="async"
          className="mb-3 w-full max-h-[42vh] rounded-2xl border border-pink-400/50 object-contain"/>}
        <h2 className="mb-1 text-center text-base font-black text-pink-200">{notice.title}</h2><p className="mb-3 text-center text-[10px] font-bold text-slate-400">{page+1} / {pages.length}</p>
        <div className="flex items-end gap-2"><AssistantFace who={who} size={76} accent={who.accent} expression={pageExpression}/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 px-3 py-3 text-[13px] font-bold leading-relaxed text-white" style={bubbleWrapStyle()}>{bubbleWrap(assistantSpeakText(pageText,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId))}</div></div>
        {!last?<button onClick={()=>setUpdateGuidePage(page+1)} className="mt-4 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950">次へ</button>:<div className={`mt-4 grid ${notice.destination?'grid-cols-2':'grid-cols-1'} gap-2`}>{notice.destination&&<button onClick={()=>finishUpdateGuide(notice.destination)} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950">{notice.buttonLabel||'見に行く'}</button>}<button onClick={()=>finishUpdateGuide()} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white">{notice.destination?'あとで':'閉じる'}</button></div>}
      </div>
    </div>);
}
