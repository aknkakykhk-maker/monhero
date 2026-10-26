// ===== MFバトルカード: 対戦開始の画面と、デッキ名の自動づけ(2026-10-26 社長の案。台帳 2026-10-26) =====
// 対戦の画面(84 の CardBattleBoard)に入る直前に、VS の形で2〜3秒出す。タップで飛ばせる。
//   助手と対戦 … 相手の助手の立ち絵・ひとこと(助手ごと・難易度ごと)・デッキ名・3体 ／ こちらのデッキ名・3体
//   練習試合   … みゅあで短く(ひとことは1つ・デッキ名は出さない)
//   マルチ     … 相手の名前・アイコン・相手がデッキ編成で付けた名前・3体(古い版の相手はデッキ名なし)
// 自動で名前を付けるのは相手の助手のデッキだけ。その試合の中身(同じ血統・全体攻撃や守りなどの型・技の種類・好きな子)と助手の性格から作る。
// こちらとマルチの相手は、デッキ編成で付けた名前をそのまま出す(2026-10-26 社長「自分側のデッキ名は自分で決められたよね？それを出す感じで」)。
// 言葉の部品とひとことは社長が「この案で」「この文で」と決めたもの(2026-10-26)。勝手に増やさない。
// ★見た目だけで、対戦の中身(場・乱数・保存)には一切さわらない

// しめ(助手の性格)。毎試合この中から選び、前の試合と同じものは避ける
const CARD_DECK_NAME_TAILS = Object.freeze({
  mua: ['まっしぐら隊', '全力ダッシュ団', 'ガンガン突撃隊', '先手必勝隊'],
  momosuke: ['いじわる劇場', 'ちくちく作戦', 'こまらせ隊', 'ずるっこ団'],
  kiki: ['ため撃ち砲台', 'どっかん計画', '大技まつり', 'じっくり砲'],
  kyuko: ['先読みの陣', 'お見通し作戦', '読み筋デッキ', 'ガッツ勘定隊'],
  dra: ['カウンター要塞', 'はね返し城', '鉄壁ガード団', 'ねばり腰の砦'],
  atsu: ['まとめてドーン組', '一掃カーニバル', '全体ぶっぱ隊', '総なめ軍団'],
});
// 長すぎるときは MASTER の「本気の」を省く(320幅の札で2行に収まる長さ)
const CARD_DECK_NAME_MAX = 18;
// 型の決め方(デッキ50枚のうちの枚数で見る)。助手の組むデッキを助手ごとに100回組んで数え、どれかに偏らない値にした(2026-10-26)。
//   守りは助手ごとにほぼ決まった枚数(みゅあ13〜ドラ21)、力の技は賢さの技の3〜26倍ある
const CARD_DECK_STYLE = Object.freeze({ area: 4, guard: 19, heal: 4, powOverInt: 12, intMaxRatio: 2.5 });
// 対戦開始のひとこと(助手ごと・難易度ごと。e は表情)
const CARD_VS_LINES = Object.freeze({
  mua: {
    easy: { e: 'happy', t: 'きょうはゆるっと遊ぼ♪ でも攻めるのはやめないよ！' },
    normal: { e: 'wink', t: '先に攻めたもん勝ちぢゃん！ いっくよー！' },
    hard: { e: 'excited', t: 'まぢでガンガンいくから、ついてきてね！' },
    expert: { e: 'excited', t: '全部の弾から選んだ子たちだよ！ 本気ダッシュぢゃん！' },
    master: { e: 'wink', t: 'いちばん強い組み合わせで来たよ。止めてみなよ？' },
  },
  momosuke: {
    easy: { e: 'happy', t: 'ももと遊んでくれるの？ やさしくしてあげよっかな〜w' },
    normal: { e: 'wink', t: 'いじわるの準備、できてるよ？♡' },
    hard: { e: 'happy', t: 'ちくちくいくからね。泣いても知らないよ〜w' },
    expert: { e: 'wink', t: 'とっておきの意地悪、ぜんぶ持ってきたよ♡' },
    master: { e: 'excited', t: '本気のもも、見せてあげる。逃げちゃだめだよ？' },
  },
  kiki: {
    easy: { e: 'happy', t: 'のんびりいきまつね。大技はちょっとだけ♪' },
    normal: { e: 'happy', t: 'じっくりためて、大きいのを当てまつ！' },
    hard: { e: 'excited', t: 'ガッツ、たっぷりためてきまちた。どっかんいきまつよ(˘ω˘)9' },
    expert: { e: 'excited', t: '全部の弾から大技を集めまちた。覚悟してくだちゃい！' },
    master: { e: 'wink', t: 'いちばん強いききで、お相手しまつね。' },
  },
  kyuko: {
    easy: { e: 'happy', t: '気楽にいこうねぇ。数えるのは、ほどほどに笑' },
    normal: { e: 'happy', t: 'ガッツと手札の数え合い、始めよっかw' },
    hard: { e: 'wink', t: '三手先まで、もう見えてるよ笑' },
    expert: { e: 'excited', t: '全部の弾から読み筋を組んできたよw' },
    master: { e: 'wink', t: 'きみのデッキも見て組み直したよ。読み合い、しよっか' },
  },
  dra: {
    easy: { e: 'happy', t: '気楽にいこうな。おでは守ってるだけだよ' },
    normal: { e: 'happy', t: 'まずは守りを固めるとこからだな' },
    hard: { e: 'excited', t: '打ってこい。全部はね返してやるよ' },
    expert: { e: 'excited', t: '全部の弾から一番かたい守りを持ってきた' },
    master: { e: 'wink', t: '本気の要塞だ。崩せるもんなら崩してみな' },
  },
  atsu: {
    easy: { e: 'happy', t: 'ゆるくいこうぜ笑 全体攻撃はちょっとだけな' },
    normal: { e: 'excited', t: 'まとめて吹っ飛ばすぞ！ 楽しもうぜ笑' },
    hard: { e: 'excited', t: '全員まとめていくからな。覚悟しとけよ笑' },
    expert: { e: 'excited', t: '全部の弾から全体攻撃を集めてきた！' },
    master: { e: 'wink', t: '本気のあつだ。一気に終わらせるぞ！' },
  },
});
// 練習試合のひとこと(みゅあ)
const CARD_VS_TUTORIAL_LINE = Object.freeze({ e: 'happy', t: '練習だよ！ ゆっくりいこ♪' });
// 出している長さ(ミリ秒)。タップで飛ばせる
const CARD_VS_MS = Object.freeze({ assistant: 2600, pvp: 2600, tutorial: 1300 });

// 種族(血統)の名前。混血は主血統で数える
const cardLineageOf = (m) => (m && (m.main || m.species)) || null;
const cardLineageName = (db, species) => {
  const list = Object.values((db && db.monsters) || {});
  const m = list.find((x) => x && x.species === species && !x.main && !x.variant) || list.find((x) => x && x.species === species);
  return m ? m.name : '';
};
// デッキの中身を数える(デッキ名の材料)
const cardDeckFacts = (db, deck) => {
  const mons = ((deck && deck.monsters) || []).map((no) => cardMonsterOf(db, no)).filter(Boolean);
  const lineCount = {};
  mons.forEach((m) => { const l = cardLineageOf(m); if (l) lineCount[l] = (lineCount[l] || 0) + 1; });
  const topLine = Object.entries(lineCount).sort((a, b) => b[1] - a[1])[0] || null;
  const cards = ((deck && deck.cards) || []).map((no) => cardOf(db, no)).filter(Boolean);
  const has = (c, t) => Array.isArray(c.effects) && c.effects.some((e) => e && e.t === t);
  return {
    mons,
    sameLine: topLine && topLine[1] >= 2 ? { species: topLine[0], n: topLine[1] } : null,
    area: cards.filter((c) => has(c, 'area')).length,
    guard: cards.filter((c) => c.kind === 'blk' || c.kind === 'dge').length,
    heal: cards.filter((c) => has(c, 'heal') || has(c, 'revive')).length,
    pow: cards.filter((c) => c.kind === 'pow').length,
    int: cards.filter((c) => c.kind === 'int').length,
  };
};
// まんなか。opts.favorite … 好きな子の種族(助手) / opts.preferFavorite … 型より好きな子を先にする(半分の試合)
const cardDeckNameMiddle = (db, facts, { favorite = null, preferFavorite = false } = {}) => {
  if (facts.sameLine && facts.sameLine.n >= 3) return `${cardLineageName(db, facts.sameLine.species)}一家`;
  if (facts.sameLine) return `${cardLineageName(db, facts.sameLine.species)}コンビ`;
  const favName = favorite && facts.mons.some((m) => cardLineageOf(m) === favorite) ? cardLineageName(db, favorite) : '';
  if (preferFavorite && favName) return favName;
  if (facts.area >= CARD_DECK_STYLE.area) return 'まとめて';
  if (facts.guard >= CARD_DECK_STYLE.guard) return 'カチコチ';
  if (facts.heal >= CARD_DECK_STYLE.heal) return 'しぶとい';
  if (facts.pow > 0 && facts.pow >= facts.int * CARD_DECK_STYLE.powOverInt) return 'パワー';
  if (facts.int > 0 && facts.pow <= facts.int * CARD_DECK_STYLE.intMaxRatio) return 'かしこ';
  if (favName) return favName;
  return facts.mons[0] ? cardLineageName(db, cardLineageOf(facts.mons[0])) : '';
};
// まんなかとしめに同じ言葉が入っていないか(2字以上つづけて同じ所があれば重なりとみる。「まとめて」と「まとめてドーン組」など)
const cardDeckWordsOverlap = (x, y) => {
  const a = String(x || ''), b = String(y || '');
  for (let i = 0; i + 2 <= a.length; i++) if (b.includes(a.slice(i, i + 2))) return true;
  return false;
};
// まんなか・しめを、重ならないように選ぶ(2026-10-26 窓口「あつのまとめてまとめてドーン組」)。
//   ① 重ならないしめがあれば、その中から選ぶ(前の試合と同じしめは避ける)
//   ② どのしめとも重なるなら、まんなかを好きな子の名前(いなければ1体目の血統)にかえて選び直す
const cardDeckNamePick = (db, facts, who, { favorite = null, preferFavorite = false, last = null, rnd = Math.random } = {}) => {
  const tails = CARD_DECK_NAME_TAILS[who] || CARD_DECK_NAME_TAILS.kyuko;
  const choose = (middle) => {
    const ok = tails.filter((t) => !cardDeckWordsOverlap(middle, t));
    const pool = ok.length > 1 ? ok.filter((t) => t !== last) : ok;
    return pool.length ? pool[Math.floor(rnd() * pool.length) % pool.length] : null;
  };
  let middle = cardDeckNameMiddle(db, facts, { favorite, preferFavorite });
  let tail = choose(middle);
  if (!tail) {
    const fav = favorite && facts.mons.some((m) => cardLineageOf(m) === favorite) ? cardLineageName(db, favorite) : '';
    middle = fav || (facts.mons[0] ? cardLineageName(db, cardLineageOf(facts.mons[0])) : '');
    tail = choose(middle) || tails[0];
  }
  return { middle, tail };
};
// 前の試合のしめ(助手ごと。同じ名前ばかりにならないように。保存はしない)
const cardDeckNameLastTail = {};
// 助手のデッキ名。例「みゅあのモッチーまっしぐら隊」「ドラの本気のカチコチカウンター要塞」
const cardAssistantDeckName = (db, deck, who, level, rnd = Math.random) => {
  const a = typeof ASSISTANTS !== 'undefined' ? ASSISTANTS.find((x) => x.id === who) : null;
  const owner = a ? a.name : 'あいて';
  const favorite = typeof CARD_AI_FAVORITE !== 'undefined' ? CARD_AI_FAVORITE[who] : null;
  const { middle, tail } = cardDeckNamePick(db, cardDeckFacts(db, deck), who, { favorite, preferFavorite: rnd() < 0.5, last: cardDeckNameLastTail[who], rnd });
  cardDeckNameLastTail[who] = tail;
  const plain = `${owner}の${middle}${tail}`;
  if (level !== 'master') return plain;
  const strong = `${owner}の本気の${middle}${tail}`;
  return strong.length <= CARD_DECK_NAME_MAX ? strong : plain;
};
// 画面。intro = { mode:'assistant'|'tutorial'|'pvp', foe:{ name, who?, icon?, line?, deckName?, monsters:[番号] }, me:{ name, icon?, deckName?, monsters } }
const CARD_VS_CSS = `
@keyframes mhVsFoeIn { from { transform: translateX(60%); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes mhVsMonFoe { 0% { transform: translateX(140%) scale(.6); opacity: 0 } 70% { transform: translateX(-6%) scale(1.06); opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes mhVsMonMe { 0% { transform: translateX(-140%) scale(.6); opacity: 0 } 70% { transform: translateX(6%) scale(1.06); opacity: 1 } 100% { transform: none; opacity: 1 } }
@keyframes mhVsPop { 0% { transform: scale(2.4); opacity: 0 } 60% { transform: scale(.9); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes mhVsFade { from { opacity: 0 } to { opacity: 1 } }
.mh-vs-foe { animation: mhVsFoeIn .38s cubic-bezier(.2,.9,.3,1.2) both }
.mh-vs-mon-foe { animation: mhVsMonFoe .34s ease-out both }
.mh-vs-mon-me { animation: mhVsMonMe .34s ease-out both }
.mh-vs-pop { animation: mhVsPop .36s ease-out both }
.mh-vs-fade { animation: mhVsFade .3s ease-out both }
@media (prefers-reduced-motion: reduce) { .mh-vs-foe, .mh-vs-mon-foe, .mh-vs-mon-me, .mh-vs-pop, .mh-vs-fade { animation-duration: .01s } }
`;
const CardVsMonsters = ({ db, monsters, side, start, step }) => (
  <div className="flex w-full items-end justify-center gap-1.5">
    {(monsters || []).slice(0, 3).map((no, i) => {
      const m = cardMonsterOf(db, no);
      if (!m) return null;
      const art = cardMonArt(m);
      return (
        <div key={`${no}-${i}`} data-card-vs-mon={no} className={`${side === 'foe' ? 'mh-vs-mon-foe' : 'mh-vs-mon-me'} flex min-w-0 flex-1 flex-col items-center`} style={{ animationDelay: `${start + i * step}ms`, maxWidth: 140 }}>
          <img src={art || CARD_IMG(m.img)} alt={m.name} draggable={false} className={`${art ? 'object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,.7)]' : 'rounded-md object-cover'} w-full`} style={{ aspectRatio: art ? '1 / 1' : '63 / 88', maxHeight: 'min(19vh, 140px)' }}/>
          <span className="mt-0.5 w-full truncate text-center text-[10px] font-black text-white" style={{ textShadow: '0 1px 2px #000' }}>{m.name}</span>
        </div>
      );
    })}
  </div>
);
// 長い名前(デッキ編成で付けた名前は20字まで)は字を小さくして2行まで折り返す。切らない
const CardVsDeckName = ({ text, tone }) => text ? (
  <div data-card-vs-deck-name className={`mh-vs-fade max-w-full rounded-2xl px-3 py-0.5 text-center font-black leading-tight ${String(text).length > 16 ? 'text-[11px]' : 'text-[13px]'} ${tone === 'foe' ? 'bg-rose-950/80 text-rose-100' : 'bg-sky-950/80 text-sky-100'}`} style={{ ...JA_LABEL_STYLE, animationDelay: tone === 'foe' ? '450ms' : '1250ms' }}>{jaWrap(text)}</div>
) : null;
const CardVsIntro = ({ db, intro, onDone }) => {
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone && onDone(); };
  const ms = CARD_VS_MS[intro.mode] || CARD_VS_MS.assistant;
  useEffect(() => { const t = setTimeout(finish, ms); return () => clearTimeout(t); }, []);
  const foe = intro.foe || {};
  const me = intro.me || {};
  const who = foe.who && typeof ASSISTANTS !== 'undefined' ? ASSISTANTS.find((x) => x.id === foe.who) : null;
  const short = intro.mode === 'tutorial';
  const step = short ? 90 : 170;
  return (
    <div data-mh-screen data-card-vs={intro.mode} role="button" tabIndex={0} aria-label="対戦開始(タップで始める)" onClick={() => { Audio_.fgSe.tap(); finish(); }}
      className="relative flex h-full min-h-0 flex-1 cursor-pointer select-none flex-col overflow-hidden text-white"
      style={{ background: 'linear-gradient(170deg, #4c0519 0%, #1e1b4b 48%, #0c4a6e 100%)' }}>
      <style>{CARD_VS_CSS}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.18) 0 2px, transparent 2px 22px)' }}/>
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col justify-center landscape:flex-row-reverse">
        {/* 相手(上・横向きでは右) */}
        <div data-card-vs-side="foe" className="flex min-h-0 flex-col items-center justify-end gap-1.5 px-3 pb-2 pt-3 landscape:flex-1 landscape:justify-center">
          <div className="flex w-full max-w-[420px] items-end gap-2">
            <div className="mh-vs-foe shrink-0" style={{ width: 'min(34vw, 30vh, 150px)' }}>
              {who
                ? <img src={assistantFullImage(who, (foe.line && foe.line.e) || 'happy')} alt={who.name} draggable={false} className="w-full object-contain object-bottom" style={{ aspectRatio: '3 / 4' }}/>
                : <span className="flex aspect-square w-full items-center justify-center rounded-full bg-slate-900/70 leading-none" style={{ fontSize: 'min(16vw, 15vh, 72px)' }}>{typeof cardIconNode === 'function' ? cardIconNode(foe.icon || '🙂', 72) : '🙂'}</span>}
            </div>
            <div className="mh-vs-fade min-w-0 flex-1 pb-1" style={{ animationDelay: '250ms' }}>
              <b className="block text-[16px] font-black leading-tight" style={JA_LABEL_STYLE}>{foe.name || 'あいて'}</b>
              {foe.line && foe.line.t && <p data-card-vs-line className="mt-1 rounded-2xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[12px] font-bold leading-snug text-slate-900" style={JA_WRAP_STYLE}>{helpWrap(foe.line.t)}</p>}
            </div>
          </div>
          <CardVsDeckName text={foe.deckName} tone="foe"/>
          <CardVsMonsters db={db} monsters={foe.monsters} side="foe" start={short ? 200 : 500} step={step}/>
        </div>
        <div aria-hidden="true" data-card-vs-mark className="mh-vs-pop flex shrink-0 items-center justify-center py-1 text-[44px] font-black italic leading-none text-amber-300 landscape:px-2" style={{ animationDelay: short ? '400ms' : '1000ms', WebkitTextStroke: '2px #7c2d12', textShadow: '0 4px 0 rgba(0,0,0,.45)' }}>VS</div>
        {/* こちら(下・横向きでは左) */}
        <div data-card-vs-side="me" className="flex min-h-0 flex-col items-center justify-start gap-1.5 px-3 pb-3 pt-2 landscape:flex-1 landscape:justify-center">
          <CardVsMonsters db={db} monsters={me.monsters} side="me" start={short ? 500 : 1100} step={step}/>
          <CardVsDeckName text={me.deckName} tone="me"/>
          <b className="mh-vs-fade text-[14px] font-black" style={{ ...JA_LABEL_STYLE, animationDelay: short ? '600ms' : '1200ms' }}>{me.name || 'あなた'}</b>
        </div>
      </div>
      <p className="relative z-[1] shrink-0 pb-2 text-center text-[10px] font-bold text-white/60">タップで始める</p>
    </div>
  );
};
