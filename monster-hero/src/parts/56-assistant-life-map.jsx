// ===== 助手ライフ「📋 みんなの居場所」の地図(案A・2026-11-08 社長「推奨でいいけどもっと矛盾のない作りとわかりやすく」) =====
// HOME の画面そのものを地図にする。絵・札の部品・札の位置は HOME と同じもの(同じ class なので、HOME の配置を直せば地図も直る)。
//   ・地図の大きさは HOME の画面(main.mh-home-scene)と同じ。HOME が位置合わせに使う値(--mh-home-*)も写す → 札の位置が HOME と1対1
//   ・施設と結びつく場所(モンヒロビート・MFバトルカード・M/B管理・神殿・マーケット・助手ライフ=みんなの家)は HOME の札そのもの
//   ・HOME に札の無い町の場所(図書室・おやつ屋さん・ひなたの丘・中庭・広場)は、同じ形の小さめの札を絵の中の「その建物・その場所」に
//   ・助手は札の上(入らなければ下・横)に小さな全身で立ち、名前としていることの短い札を付ける。5人からは重ねて「◯◯ほか◯人」
//   ・いない場所は薄く。場所を押すと、そこにいる助手とできることのシート(閉じるボタン付き)
//   ・居場所の言い方(HOME の顔・家の出かけ札・地図・今日あったこと)は assistantLifeSpotOf / assistantLifePlaceShow の1か所から
// 案と止め絵: docs/progress/assistant-peer/LIFE-MAP-PLAN.md。検査 tools/assistant/assistant-life-map-check.js
// 何も保存しない

// 場所ごとの HOME の札(fac)。町だけの場所は HOME では「🏡 助手ライフ」の札の下に顔が出る(assistantLifeFacilityOf と同じ表)
const ASSISTANT_LIFE_MAP_ORDER = Object.freeze(['ranch', 'temple', 'market', 'battle', 'home', 'studio', 'cardroom', 'hill', 'library', 'cafe', 'garden', 'plaza']);
const ASSISTANT_LIFE_MAP_TOWN_ONLY = Object.freeze(['hill', 'library', 'cafe', 'garden', 'plaza']);
// 🏥 病院(56-assistant-life-body.jsx)は印 assistantLifeBody が真のときだけ地図に足す(偽のあいだは札も人もシートも出さない・ミハリ5)
const assistantLifeMapClinicOn = () => { try { return typeof assistantLifeBodyOn === 'function' && assistantLifeBodyOn(); } catch (_) { return false; } };
const assistantLifeMapOrderNow = () => (assistantLifeMapClinicOn() ? [...ASSISTANT_LIFE_MAP_ORDER, 'clinic'] : ASSISTANT_LIFE_MAP_ORDER);
const assistantLifeMapTownOnlyNow = () => (assistantLifeMapClinicOn() ? [...ASSISTANT_LIFE_MAP_TOWN_ONLY, 'clinic'] : ASSISTANT_LIFE_MAP_TOWN_ONLY);
// 町だけの場所の札を置く所(絵の幅・高さに対する割合。札の真ん中)。絵ごとに建物の位置がちがうので、絵ごとに持つ
//   classic … 村の広場(941×1672)/ halloween … ハロウィン(縦)/ halloweenWide … ハロウィン(横長)
//   図書室=金の塔/おやつ屋さん=右上の青い屋根の石の家/ひなたの丘=湖と滝/中庭=泉と屋台のあいだの芝生/広場=方位の印
const ASSISTANT_LIFE_MAP_TOWN = Object.freeze({
  classic:       { hill: [0.47, 0.115], library: [0.72, 0.205], cafe: [0.9, 0.29], garden: [0.8, 0.44], plaza: [0.5, 0.465], clinic: [0.62, 0.56] },
  halloween:     { hill: [0.5, 0.085], library: [0.7, 0.2], cafe: [0.9, 0.27], garden: [0.82, 0.45], plaza: [0.5, 0.465], clinic: [0.62, 0.56] },
  halloweenWide: { hill: [0.5, 0.17], library: [0.62, 0.27], cafe: [0.84, 0.22], garden: [0.76, 0.4], plaza: [0.47, 0.54], clinic: [0.84, 0.62] },
});
const assistantLifeMapArtOf = (src) => /halloween-wide/.test(String(src || '')) ? 'halloweenWide' : /halloween/.test(String(src || '')) ? 'halloween' : 'classic';
// していることの短い印(地図の名札の頭に付ける)
const ASSISTANT_LIFE_DOING_ICON = Object.freeze({ snack: '🍰', practice: '🎵', training: '🥚', cards: '🃏', walk: '🚶', idle: '💭', sleep: '💤', read: '📖', battle: '⚔️', checkup: '🏥' });
// 場所を押したときの一言(できること)。数字・ネタバレは書かない
const ASSISTANT_LIFE_MAP_ABOUT = Object.freeze({
  home: '家で過ごしている助手。部屋をのぞいて、声をかけられます',
  studio: 'モンヒロビートで練習している助手。いる助手とは、券なしで一緒に遊べます',
  cardroom: 'MFバトルカードの研究をしている助手。いる助手と対戦すると、ごほうびが上がります',
  ranch: 'M/B管理でモンスターを育てている助手',
  temple: '神殿にいる助手',
  battle: 'モンヒロバトルで戦っている助手。いる助手は、マスモンを連れて修行をしています',
  market: 'マーケットにいる助手',
  library: '図書室で本を読んだり、カードを研究したりしている助手',
  cafe: 'おやつ屋さんでおやつを食べている助手',
  hill: 'ひなたの丘でのんびりしている助手',
  garden: '中庭で過ごしている助手',
  plaza: '広場を散歩している助手',
  clinic: '病院で診てもらっている助手。けがや病気が早く治ります',
});
// HOME の札の名前(地図のシートに「HOME の◯◯の札」と出す)
const ASSISTANT_LIFE_MAP_FAC_NAME = Object.freeze({ management: 'M/B管理', temple: '神殿', market: 'マーケット', battle: 'モンヒロバトル', life: '助手ライフ', rhythm: 'モンヒロビート', card: 'MFバトルカード' });
const assistantLifeMapSpotWord = (place) => `${ASSISTANT_LIFE_PLACE_ICON[place] || '📍'} ${place === 'home' ? 'みんなの家' : assistantLifePlaceShow(place)}`;

// HOME の画面の大きさ・位置合わせの値・絵を読む(HOME が無いとき・🔄横で回しているときは、この画面の大きさと既定の絵)
const assistantLifeMapReadHome = () => {
  const out = { w: window.innerWidth, h: window.innerHeight, vars: {}, src: 'data/images/home-background.jpg', wide: false, card: 'mh-home-card-battle raised', fromHome: false };
  try {
    const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active();
    const scene = document.querySelector('main.mh-home-scene');
    if (!scene) return out;
    const img = scene.querySelector('.mh-home-background img.mh-home-main');
    if (img && img.getAttribute('src')) { out.src = img.getAttribute('src'); out.wide = !!scene.querySelector('.mh-home-background.is-wide'); }
    const card = scene.querySelector('.mh-home-card-battle');
    if (card) out.card = [...card.classList].filter(c => c !== 'is-tutorial-spot').join(' ');
    if (rot || !scene.offsetWidth || !scene.offsetHeight) return out;
    out.w = scene.offsetWidth; out.h = scene.offsetHeight; out.fromHome = true;
    for (let i = 0; i < scene.style.length; i++) { const k = scene.style[i]; if (/^--mh-home-/.test(k)) out.vars[k] = scene.style.getPropertyValue(k); }
  } catch (_) {}
  return out;
};

// 小さな全身(絵の描かれている範囲を測って、見た目の高さを h にそろえる。胸から上の絵は下をぼかす)
function AssistantLifeMapFig({ who, h, sleep, spent = false }) {
  // 寝ている助手は、社長の寝顔の絵があればそれ(assistantLifeSleepSrc・2026-11-11 社長「絵をそのまま使う」)
  const src0 = assistantFullImage(who, sleep ? 'normal' : 'happy'), src = sleep && typeof assistantLifeSleepSrc === 'function' ? assistantLifeSleepSrc(who && who.id, src0) : src0;
  const [box, setBox] = React.useState(() => ASSISTANT_LIFE_STAND_BOX.get(src) || null);
  // 測り終えるまでは見せない(仮の形は顔でそろえる決まりを通らず、一瞬だけ顔が小さく出ていた・2026-11-11 ミヤスサ点検 ③)。測れなかった絵(読み込みの失敗)は仮の形のまま見せる
  const [ready, setReady] = React.useState(() => ASSISTANT_LIFE_STAND_BOX.has(src));
  React.useEffect(() => { let alive = true; setReady(ASSISTANT_LIFE_STAND_BOX.has(src)); assistantLifeStandBox(src).then(b => { if (alive) { setBox(b); setReady(true); } }); return () => { alive = false; }; }, [src]);
  // 測り終えるまでの仮の形。絵は object-fit:contain なので、仮の比が違っても縦横に伸びない(2026-11-09 社長「画面バグってる」)
  const b = box || { t: 0, b: 1, l: 0, r: 1, ar: 0.6 };
  // 大きさは「見えている体の高さ」ではなく顔でそろえる(2026-11-11 社長「助手の立ち絵も見直して」: 高さでそろえると、体の長い絵=みゅあ・きき・あつ の顔が 4px、
  //   顔だけの絵=ドラ が 11px と 2.8倍ちがい、羽や耳のある絵は左右も切れていた)。場面の立ち絵と同じ表(assistantLifeStandFace)と決まり(assistantLifeStandRule)を使う:
  //   頭(てっぺんから顎)が箱の高さの半分・頭のてっぺんは上から 25%(うさ耳が入る。魔女の帽子・大きな耳の着替え=above のある絵は 38% まで下げる)・胸から下は箱の下でぼかして消す。測れないうちは今までの出し方
  const face = typeof assistantLifeStandFace === 'function' ? assistantLifeStandFace(who && who.id, src) : null;
  const rule = box && face && typeof assistantLifeStandRule === 'function' ? assistantLifeStandRule({ face, box, F: (h * 0.5) / ASSISTANT_LIFE_STAND_FACE_LEN, topY: h * Math.max(0.25, Math.min(0.38, (face.above || 0) * 0.4)), cx: 0 }) : null;
  const ih = rule ? rule.height : h / Math.max(0.2, b.b - b.t), iw = rule ? rule.width : ih * (b.ar || 0.6);
  const w = Math.round(Math.min((b.r - b.l) * iw, h * 0.78));
  const cx = ((b.l + b.r) / 2) * iw;
  const top = rule ? rule.top : -b.t * ih;
  const mask = 'linear-gradient(#000 74%,transparent)';
  // 印(💤・ごほうび済み)は、下をぼかした絵の外側に重ねる(ぼかしに消されない)
  return (
    <span className="relative block shrink-0" style={{ width: w, height: h, visibility: ready ? undefined : 'hidden' }}>
      <span className="absolute inset-0 overflow-hidden" style={{ WebkitMaskImage: mask, maskImage: mask }} data-assistant-life-map-fig>
        <img src={src} alt="" draggable={false} style={{ position: 'absolute', height: ih, width: iw, maxWidth: 'none', objectFit: 'contain', top, left: w / 2 - cx, filter: sleep ? 'brightness(.62) saturate(.7)' : 'drop-shadow(0 2px 3px #0009)' }}/>
        {/* 寝ているときは目を閉じた形を重ねる(2026-11-11 社長「目を開けっぱなしの人がいる」) */}
        {sleep && typeof AssistantLifeSleepEyes === 'function' && <AssistantLifeSleepEyes pid={who && who.id} src={src} w={iw} h={ih} style={{ left: w / 2 - cx, top, filter: 'brightness(.62) saturate(.7)' }}/>}
      </span>
      {sleep && <span className="absolute right-0 top-0 text-[10px]" aria-hidden="true">💤</span>}
      {spent && typeof AssistantLifeSpentMark === 'function' && <AssistantLifeSpentMark size={Math.round(h * 0.5)}/>}
    </span>);
}

// 場所の窓の1行(顔・名前・だれと何をしているか・できること)。町の地図の窓と、モンヒロバトルの選択画面(AssistantLifeBattleHall)の両方で使う
//   close … ボタンを押したあとに窓を閉じる/onRoom … 「部屋へ」/cheerMsg・setCheerMsg … 応援の知らせ(親が持つ)
function AssistantLifeMapRow({ id, place, town = false, life, selected = false, cheerMsg = null, setCheerMsg = () => {}, close = () => {}, onRoom = null, onBeat = null, onCard = null }) {
    const a = assistantById(id); if (!a) return null;
    const w = assistantLifeWhereOf(life, id); const d = w && ASSISTANT_LIFE_DOINGS[w.doing];
    const withNames = w && w.with && w.with.length ? `${w.with.map(assistantLifeName).join('・')}と` : 'ひとりで';
    const spent = place === 'cardroom' && typeof assistantLifeCardSpent === 'function' ? assistantLifeCardSpent(id) : null; // { next } か null
    // モンヒロバトルの助手: きょうの修行の1行と「👀 修行を見る・📣 応援する・⚔ 対戦(β)」(シュギョウ2の口。印 assistantMasmonCheer が偽なら null で何も出さない)
    let ti = null; if (place === 'battle') { try { ti = typeof assistantMasmonTrainRowInfo === 'function' ? assistantMasmonTrainRowInfo(id) : null; } catch (_) { ti = null; } }
    let bi = null; if (place === 'battle') { try { bi = typeof assistantMasmonBattleRowInfo === 'function' && typeof assistantMasmonBattleOpen === 'function' ? assistantMasmonBattleRowInfo(id) : null; } catch (_) { bi = null; } }
    const battleBtn = bi && <button type="button" disabled={!!bi.disabled} title={bi.disabled ? (bi.why || '') : (bi.sub || '')} data-assistant-life-map-act="masmon-battle" onClick={() => { close(); try { assistantMasmonBattleOpen({ assistantId: id, from: 'place' }); } catch (_) {} }} className="rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 min-h-[44px] px-2 py-1 text-[12px] font-black text-white active:scale-95 disabled:opacity-50" style={JA_LABEL_STYLE}>{jaWrap(String(bi.label || '⚔ マスモンで対戦(β)').replace('で対戦', 'で\u200B対戦'))}</button>;
    // モンヒロサクセス(β)の入口(2026-11-14 社長・印 monheroSuccess が偽なら null)。モンヒロバトルにいる助手の札にだけ
    let si = null; if (place === 'battle') { try { si = typeof assistantLifeSuccessRowInfo === 'function' ? assistantLifeSuccessRowInfo(id) : null; } catch (_) { si = null; } }
    const successBtn = si && <button type="button" title={si.sub} data-assistant-life-map-act="monhero-success" onClick={() => { close(); try { assistantLifeSuccessOpen({ assistantId: id, from: 'place' }); } catch (_) {} }} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-lime-600 min-h-[44px] px-2 py-1 text-[12px] font-black text-white active:scale-95"><span style={JA_LABEL_STYLE}>{jaWrap(si.label)}</span><span className="block text-[10px] font-bold text-emerald-50" style={JA_LABEL_STYLE}>{jaWrap(si.sub)}</span></button>;
    const tiLine = ti && (ti.today ? `🥋 ${ti.today.nick}・${ti.today.kind}${ti.today.learned ? ` NEW ${ti.today.learned}を覚えた` : ''}${ti.today.main ? ` ・ ${ti.today.main} 熟練 +${ti.today.gain}` : ''}` : '🥋 今日はまだ修行していません');
    return (
      <div key={id} className={`mt-2 flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-900/85 p-2 ${selected ? "border-sky-300 ring-2 ring-sky-300/70" : "border-white/10"}`} data-assistant-life-map-sheet-selected={selected ? "1" : undefined} data-assistant-life-map-sheet-who={id} data-assistant-life-map-sheet-at={place}>
        <span className="shrink-0" style={typeof assistantLifePartnerOk === 'function' && !assistantLifePartnerOk(id) ? { filter: 'grayscale(.55) brightness(.85)' } : undefined}><AssistantFace who={a} size={36} accent={a.accent}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black text-white" style={JA_WRAP_STYLE}>{a.name}{spent && <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[9.5px] font-black text-slate-900" data-assistant-life-map-sheet-spent>済 ごほうび済み</span>}</p>
          <p className="text-[10.5px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{town ? jaWrap(`${assistantLifeMapSpotWord(place)}で `) : ''}{w && ASSISTANT_LIFE_DOING_ICON[w.doing]} {jaWrap(`${withNames}${d ? d.label : '過ごしている'}${w && w.reason === 'lonely' ? '(さみしそう)' : ''}`)}</p>
          {place === 'ranch' && (() => { let x = null; try { x = typeof assistantMasmonRanchRowInfo === 'function' ? assistantMasmonRanchRowInfo(id) : null; } catch (_) { x = null; } return x ? <p className="text-[10.5px] font-bold text-lime-200" style={JA_WRAP_STYLE} data-assistant-life-map-ranch-ask>{jaWrap(x.used && x.last && x.last.rows[0] ? `✓ ${x.last.nick} ${amgrStatName(x.last.rows[0].k)} ${x.last.rows[0].from} → ${x.last.rows[0].to}` : `「${typeof assistantMasmonRanchAskText === 'function' ? assistantMasmonRanchAskText(id, x.ask, x.abs) : `${x.ask.nick}の${x.ask.stat}を鍛えたいな`}」`)}</p> : null; })()}
          {tiLine && <p className="text-[10.5px] font-bold text-emerald-200" style={JA_WRAP_STYLE} data-assistant-life-map-train-line={id}>{jaWrap(tiLine)}</p>}
          {spent && <p className="text-[10.5px] font-bold text-amber-200" style={JA_WRAP_STYLE} data-assistant-life-map-sheet-next>{jaWrap(typeof cardLifeSpentText === 'function' ? cardLifeSpentText(spent) : '🃏 ごほうびアップは次の時間帯から')}</p>}
        </div>
        {typeof assistantLifePartnerOk === 'function' && !assistantLifePartnerOk(id) ? (
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" data-assistant-life-map-act="town" onClick={() => { close(); if (typeof assistantLifeShowTownPerson === 'function') assistantLifeShowTownPerson(id); }} className="rounded-xl border border-slate-400/60 min-h-[44px] px-3 py-1 text-[12px] font-black text-slate-100 active:scale-95">🔒 町の人 ›</button>
        </div>) : (
        <div className="flex shrink-0 flex-col gap-1">
          {place === 'studio' && typeof onBeat === 'function' && typeof ASSISTANT_LIFE_LINKS !== 'undefined' && typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function' && <button type="button" data-assistant-life-map-act="beat" onClick={() => { close(); onBeat(id); }} className="rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 min-h-[44px] px-3 py-1 text-[12px] font-black text-white active:scale-95">🎵 一緒に遊ぶ</button>}
          {place === 'cardroom' && !spent && typeof onCard === 'function' && typeof ASSISTANT_LIFE_LINKS !== 'undefined' && typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function' && <button type="button" data-assistant-life-map-act="card" onClick={() => { close(); onCard(id); }} className="rounded-xl bg-gradient-to-r from-blue-700 to-violet-700 min-h-[44px] px-3 py-1 text-[12px] font-black text-white active:scale-95">🃏 対戦する</button>}
          {place === 'ranch' && (() => { // M/B管理: 助手のマスモンにチケットを使ってあげる(ボクジョウ・印 assistantMasmonRanchTicket が偽なら null で出さない・2026-11-11)
            let info = null; try { info = typeof assistantMasmonRanchRowInfo === 'function' ? assistantMasmonRanchRowInfo(id) : null; } catch (_) { info = null; }
            if (!info || typeof assistantMasmonRanchOpen !== 'function') return null;
            return <button type="button" disabled={info.used} title={`${info.ask.nick}の${info.ask.stat}を鍛えたい`} data-assistant-life-map-act="ranch-ticket" onClick={() => { close(); try { assistantMasmonRanchOpen(id); } catch (_) {} }} className={`rounded-xl min-h-[44px] px-3 py-1 text-[12px] font-black active:scale-95 ${info.used ? 'border border-slate-500/60 text-slate-300' : 'bg-gradient-to-r from-emerald-600 to-lime-600 text-white'}`}>{info.used ? '✓ チケット済み' : '🎫 チケットを使う'}</button>;
          })()}
          {place === 'battle' && !ti && battleBtn}
          <button type="button" data-assistant-life-map-act="room" onClick={() => { if (typeof onRoom === 'function') onRoom(id); }} className="rounded-xl border border-pink-300/60 min-h-[44px] px-3 py-1 text-[12px] font-black text-pink-100 active:scale-95">🏡 部屋へ ›</button>
        </div>)}
        {ti && (
          <div className="grid w-full gap-1" style={{ gridTemplateColumns: battleBtn ? '1fr 1fr 1fr' : '1fr 1fr' }} data-assistant-life-map-train-acts={id}>
            <button type="button" data-assistant-life-map-act="train-watch" onClick={() => { try { assistantMasmonTrainWatchOpen(id); } catch (_) {} }} className="rounded-xl bg-sky-700 min-h-[44px] px-1 py-1 text-[12px] font-black text-white active:scale-95" style={JA_LABEL_STYLE}>{jaWrap('👀 修行を見る')}</button>
            <button type="button" data-assistant-life-map-act="cheer" disabled={!ti.canCheer} title={ti.why || ''} onClick={() => { let r = null; try { r = assistantMasmonCheer(id); } catch (_) { r = null; } setCheerMsg(r && r.ok ? { id, text: `📣 ${r.nick} ${r.tech} 熟練 +1・💗 +${r.bond}` } : { id, text: (r && r.why) || ti.why || '' }); }} className="rounded-xl bg-emerald-700 min-h-[44px] px-1 py-1 text-[12px] font-black leading-tight text-white active:scale-95 disabled:opacity-50" style={JA_LABEL_STYLE}>{jaWrap('📣 応援する')}<span className="block text-[10px] font-bold">今日{ti.perDay - ti.left}/{ti.perDay}</span></button>
            {battleBtn}
          </div>)}
        {successBtn}
        {ti && !ti.canCheer && ti.why && <p className="w-full text-[10.5px] font-bold text-slate-300" data-assistant-life-map-cheer-why={id} style={JA_WRAP_STYLE}>{jaWrap(ti.why)}</p>}
        {cheerMsg && cheerMsg.id === id && cheerMsg.text && <p className="w-full rounded-lg bg-emerald-900/70 px-2 py-1 text-[11px] font-black text-emerald-100" data-assistant-life-map-cheer-msg={id} style={JA_WRAP_STYLE}>{jaWrap(cheerMsg.text)}</p>}
      </div>);
  }

// モンヒロバトルの選択画面に出す「いまここにいる助手」(2026-11-14 社長・台帳 #6150)。HOME の「モンヒロバトル」の札の下に顔が出ている助手を、
//   選択画面の中にも出し、町の窓と同じ部品(AssistantLifeMapRow)で 👀 修行を見る・📣 応援する・⚔ マスモンで対戦(β)・🏡 部屋へ ができる。
//   いないとき・助手ライフが開いているときは何も出さない(今のまま)
function AssistantLifeBattleHall({ metIds }) {
  const st = useAssistantLifeNow(metIds);
  const [cheerMsg, setCheerMsg] = React.useState(null);
  const [, redraw] = React.useState(0);
  // 助手のマスモンと応援の保存は、助手ライフを開いたときに読まれる。選択画面だけ開いた人でも修行・応援・対戦が出せるよう、ここでも読む(読み終わるたびに描き直す)
  React.useEffect(() => {
    const stores = [typeof ASSISTANT_MASMON_STORE !== 'undefined' ? ASSISTANT_MASMON_STORE : null, typeof AMGC_STORE !== 'undefined' ? AMGC_STORE : null].filter(Boolean);
    const f = () => redraw(n => n + 1);
    for (const x of stores) { try { x.subs.add(f); if (!x.loaded && typeof x.load === 'function') void x.load().then(f).catch(() => {}); } catch (_) {} }
    return () => { for (const x of stores) { try { x.subs.delete(f); } catch (_) {} } };
  }, []);
  if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled() || !st.loaded || st.open) return null;
  const life = st.life;
  if (!life || life.abs !== assistantLifeSlotAt().abs) return null;
  const met = new Set((metIds || []).filter(id => ASSISTANT_LIFE_PREFS[id]));
  const ids = ASSISTANT_LIFE_HOUSE_ORDER.filter(id => { if (!met.has(id)) return false; const w = assistantLifeWhereOf(life, id); return !!w && w.place === 'battle'; });
  if (!ids.length) return null;
  return (
    <section data-assistant-life-battle-hall={ids.length} className="mhms-glass rounded-2xl border border-amber-300/50 bg-slate-950/70 p-2 text-white">
      {typeof AssistantMasmonTrainWatchHost === 'function' && <AssistantMasmonTrainWatchHost/>}
      <p className="text-[12px] font-black text-amber-200" style={JA_WRAP_STYLE}>{jaWrap('🏡 いまモンヒロバトルにいる助手')}</p>
      {ids.map(id => (
        <AssistantLifeMapRow key={id} id={id} place="battle" life={life} cheerMsg={cheerMsg} setCheerMsg={setCheerMsg}
          onRoom={(rid) => { try { ASSISTANT_LIFE_STORE.set({ open: true, focus: rid }); } catch (_) {} }}/>))}
    </section>);
}

// 地図の本体(家の「📋 居場所」のタブ。画面いっぱい・下に今までの一覧)
function AssistantLifeTownMap({ life, ids, onPick, onView = null, onBeat = null, onCard = null, onGo = null, onBack, list = null, nav = null, land = false, initialPlace = null, initialAssistantId = null, initialKey = 0 }) {
  const [home, setHome] = React.useState(() => assistantLifeMapReadHome());
  const [sheet, setSheet] = React.useState(() => initialPlace && assistantLifeMapOrderNow().includes(initialPlace) ? initialPlace : null);
  // 開いたままの地図へ、外から「この場所の窓を」と来たとき(部屋の「いま行くと得」の 行く › など)も窓を出す
  React.useEffect(() => { if (initialKey && initialPlace && assistantLifeMapOrderNow().includes(initialPlace)) setSheet(initialPlace); }, [initialKey]);
  const [cheerMsg, setCheerMsg] = React.useState(null); // 📣 応援したときの短い知らせ { id, text }(シュギョウ2の口 assistantMasmonCheer)
  const sceneRef = React.useRef(null);
  const listRef = React.useRef(null);
  // HOME の値は、HOME の吹き出しが変わると動く。ときどき読み直す(変わったときだけ描き直す)
  React.useEffect(() => {
    const re = () => setHome(prev => { const n = assistantLifeMapReadHome(); return JSON.stringify(prev) === JSON.stringify(n) ? prev : n; });
    const t = setInterval(re, 1000);
    window.addEventListener('resize', re);
    return () => { clearInterval(t); window.removeEventListener('resize', re); };
  }, []);
  // いまどこに誰がいるか(場所 → 助手)。並びは家の部屋の順
  const at = {};
  for (const id of ASSISTANT_LIFE_HOUSE_ORDER) {
    if (!ids.includes(id)) continue;
    const w = assistantLifeWhereOf(life, id);
    const p = w && ASSISTANT_LIFE_PLACE_ICON[w.place] ? w.place : 'home';
    (at[p] = at[p] || []).push(id);
  }
  const art = assistantLifeMapArtOf(home.src);
  const small = home.h < 500;
  const figH = home.h < 360 ? 30 : small ? 34 : 42; // 背の低い横(568×320)はもう一回り小さく
  // 札と人の置き場所を決める(描いたあとに測る。DOM に直接書くので、描き直しは起きない)
  React.useLayoutEffect(() => {
    const S = sceneRef.current; if (!S) return undefined;
    const place = () => {
      const sr = S.getBoundingClientRect();
      const rel = (r) => ({ left: r.left - sr.left, top: r.top - sr.top, right: r.right - sr.left, bottom: r.bottom - sr.top, width: r.width, height: r.height });
      const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const bar = S.querySelector('[data-assistant-life-map-bar]');
      const topMin = bar ? rel(bar.getBoundingClientRect()).bottom + 2 : 2;
      const hint = S.querySelector('[data-assistant-life-map-hint]');
      const obs = [];
      if (hint) obs.push(rel(hint.getBoundingClientRect()));
      // HOME の札(押す所の見えている箱)
      const tagOf = (el) => (el.classList.contains('mh-home-facility') ? (el.querySelector(':scope > span') || el) : el);
      for (const el of S.querySelectorAll('[data-assistant-life-map-place]')) { if (el.hasAttribute('data-assistant-life-map-town')) continue; obs.push(rel(tagOf(el).getBoundingClientRect())); }
      const W = S.clientWidth, H = S.clientHeight;
      const inside = (q) => q.left >= 3 && q.right <= W - 3 && q.top >= topMin && q.bottom <= H - 3;
      const best = (cands) => cands.find(q => inside(q) && obs.every(o => !hit(q, o))) || cands.filter(inside).sort((a, b) => obs.reduce((s, o) => s + area(a, o), 0) - obs.reduce((s, o) => s + area(b, o), 0))[0] || cands[0];
      const free = (q) => inside(q) && obs.every(o => !hit(q, o));
      const setScale = (c, sc) => { c.style.transformOrigin = '0 0'; c.style.transform = sc === 1 ? '' : `scale(${sc})`; };
      const put = (el, l, t) => { el.style.left = `${Math.round(l)}px`; el.style.top = `${Math.round(t)}px`; el.style.visibility = ''; };
      const img = S.querySelector('.mh-home-background img.mh-home-main');
      let ib = null;
      if (img && img.naturalWidth) {
        const r = rel(img.getBoundingClientRect()), nw = img.naturalWidth, nh = img.naturalHeight;
        const k = getComputedStyle(img).objectFit === 'cover' ? Math.max(r.width / nw, r.height / nh) : Math.min(r.width / nw, r.height / nh);
        ib = { x: r.left + (r.width - nw * k) / 2, y: r.top + (r.height - nh * k) / 2, w: nw * k, h: nh * k };
      }
      // 町だけの場所の建物の上(札を置きたい所)。施設の人の並びは、ここをなるべく避ける(神殿の人がおやつ屋さんの建物をふさいでいた)
      const soft = [];
      if (ib) for (const el of S.querySelectorAll('[data-assistant-life-map-town]')) { const pos = (ASSISTANT_LIFE_MAP_TOWN[art] || ASSISTANT_LIFE_MAP_TOWN.classic)[el.getAttribute('data-assistant-life-map-place')]; if (!pos) continue;
        const x = ib.x + ib.w * pos[0], y = ib.y + ib.h * pos[1], w = el.offsetWidth / 2 + 4, h = el.offsetHeight / 2 + 4; soft.push({ left: x - w, right: x + w, top: y - h, bottom: y + h }); }
      // ① HOME の札(動かない)の人の並び: 札の上 → 下 → 横。どこにも入らないときは、並びを小さくして(0.8 → 0.66 倍)置き直す
      for (const c of S.querySelectorAll('[data-assistant-life-map-crowd]')) {
        const k = c.getAttribute('data-assistant-life-map-crowd');
        const anchor = S.querySelector(`[data-assistant-life-map-place="${k}"]`); if (!anchor || anchor.hasAttribute('data-assistant-life-map-town')) continue;
        const a = rel(tagOf(anchor).getBoundingClientRect());
        let q = null;
        for (const sc of [1, 0.8, 0.66]) {
          const w = c.offsetWidth * sc, h = c.offsetHeight * sc, cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2;
          const box = (l, t) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });
          const clampX = (l) => Math.max(3, Math.min(W - 3 - w, l));
          const cands = [];
          for (const s of [0, -24, 24, -48, 48, -72, 72, -96, 96]) { cands.push(box(clampX(cx - w / 2 + s), a.top - h - 1)); cands.push(box(clampX(cx - w / 2 + s), a.bottom + 1)); }
          for (const s of [0, -16, 16, -32, 32, -48, 48]) { cands.push(box(a.right + 2, cy - h / 2 + s)); cands.push(box(a.left - w - 2, cy - h / 2 + s)); }
          q = cands.find(x => free(x) && soft.every(o => !hit(x, o))) || best(cands); setScale(c, sc);
          if (free(q)) break;
        }
        put(c, q.left, q.top); obs.push(q);
      }
      // ② 町だけの場所: 絵の中の建物の上に、札と人の並び(札の上)をひとまとめにして、いちばん近い空いている所へ。人のいる場所から先に
      const towns = [...S.querySelectorAll('[data-assistant-life-map-town]')].map(el => ({ el, k: el.getAttribute('data-assistant-life-map-place') }))
        .map(t => ({ ...t, c: S.querySelector(`[data-assistant-life-map-crowd="${t.k}"]`) })).sort((x, y) => (y.c ? 1 : 0) - (x.c ? 1 : 0));
      for (const { el, k, c } of towns) {
        const pos = (ASSISTANT_LIFE_MAP_TOWN[art] || ASSISTANT_LIFE_MAP_TOWN.classic)[k];
        if (!ib || !pos) { el.style.visibility = 'hidden'; if (c) c.style.visibility = 'hidden'; continue; }
        let got = null;
        // 入らないときは、札と人をいっしょに小さくする(0.85 → 0.72 倍。人だけはさらに 0.8 倍まで)。それでも入らなければ、少し遠く(170px まで)を探す
        for (const [ts, cs, far] of c ? [[1, 1, 120], [1, 0.8, 120], [0.85, 0.66, 120], [0.72, 0.6, 120], [0.85, 0.66, 168]] : [[1, 1, 120], [0.85, 1, 120], [0.72, 1, 120], [0.85, 1, 168]]) {
          const tw = el.offsetWidth * ts, th = el.offsetHeight * ts;
          const cw = c ? c.offsetWidth * cs : 0, ch = c ? c.offsetHeight * cs + 1 : 0;
          const w = Math.max(tw, cw), h = th + ch;
          // 札の真ん中を建物に合わせる(人はその上)
          const x0 = ib.x + ib.w * pos[0] - w / 2, y0 = ib.y + ib.h * pos[1] - th / 2 - ch;
          const cands = [];
          for (let d = 0; d <= far; d += 6) for (const [dx, dy] of d ? [[0, -d], [0, d], [-d, 0], [d, 0], [-d, -d], [d, -d], [-d, d], [d, d]] : [[0, 0]]) cands.push({ left: x0 + dx, top: y0 + dy, right: x0 + dx + w, bottom: y0 + dy + h, width: w, height: h });
          const q = best(cands);
          got = { q, ts, cs, tw, th, cw, ch, w };
          if (free(q)) break;
        }
        const { q, ts, cs, tw, th, cw, ch, w } = got;
        if (c) { setScale(c, cs); put(c, q.left + (w - cw) / 2, q.top); obs.push({ left: q.left + (w - cw) / 2, top: q.top, right: q.left + (w + cw) / 2, bottom: q.top + ch - 1 }); }
        const tl = q.left + (w - tw) / 2, tt = q.top + ch;
        setScale(el, ts); put(el, tl, tt); obs.push({ left: tl, top: tt, right: tl + tw, bottom: tt + th });
      }
    };
    place();
    const img = S.querySelector('.mh-home-background img.mh-home-main');
    if (img && !img.complete) img.addEventListener('load', place, { once: true });
    // 全身の絵は測り終わると幅が変わる。少しあとにもう一度
    const t = setTimeout(place, 350);
    return () => { clearTimeout(t); if (img) img.removeEventListener('load', place); };
  });
  const sceneStyle = { position: 'relative', flex: 'none', width: home.w, height: home.h, margin: '0 auto', ...home.vars };
  // 得の印(2026-11-11 ナカヨシ12の改善案5。判定は「いま行くと得なこと」と同じ assistantLifePerkAt。ナカヨシ10が main に入れるまでは出さない)
  const PERK_WORD = { studio: '券なし', cardroom: `×${typeof CARD_LIFE_UP_LABEL !== 'undefined' ? String(CARD_LIFE_UP_LABEL).replace(/倍$/, '') : '1.375'}` }; // カードの倍率は部屋・帯・カード画面と同じ字(2026-11-11 ミヤスサ点検 ③ 地図だけ ×1.5 だった)
  const perkOf = (place) => { try { return typeof assistantLifePerkAt === 'function' && assistantLifePerkAt(place, life, ids) === true; } catch (_) { return false; } };
  const perkMark = (place) => (perkOf(place) ? <i aria-hidden="true" data-assistant-life-map-perk={place} className="pointer-events-none absolute -right-1 -top-2.5 z-[2] rounded-full bg-amber-300 px-1.5 text-[10px] font-black not-italic leading-[14px] text-slate-900 shadow">{PERK_WORD[place] || '得'}</i> : null);
  const facBtn = (place, cls, aria, inner) => {
    const n = (at[place] || []).length;
    return <button key={place} type="button" className={`mh-home-facility ${cls}`} aria-label={`${aria}(${n ? `${n}人` : 'だれもいない'})`} data-assistant-life-map-place={place} data-assistant-life-map-empty={n ? '0' : '1'} style={n ? undefined : { opacity: 0.55, filter: 'saturate(.5)' }} onClick={() => setSheet(place)}>{inner}{perkMark(place)}</button>;
  };
  const cardN = (at.cardroom || []).length;
  const spentOf = (id, place) => place === 'cardroom' && typeof assistantLifeCardSpent === 'function' && !!assistantLifeCardSpent(id);
  const crowd = (place) => {
    const who = at[place] || []; if (!who.length) return null;
    const many = who.length > 4;
    return (
      <div key={`c-${place}`} className="absolute z-[6] flex items-end" style={{ visibility: 'hidden', left: 0, top: 0 }} data-assistant-life-map-crowd={place}>
        {many ? (
          <div className="flex flex-col items-center">
            <div className="flex items-end">{who.map((id, i) => { const a = assistantById(id); if (!a) return null; const w = assistantLifeWhereOf(life, id);
              return <button key={id} type="button" aria-label={`${a.name}の部屋`} data-assistant-life-map-who={id} onClick={() => setSheet(place)} style={{ marginLeft: i ? -Math.round(figH * 0.42) : 0 }}><AssistantLifeMapFig who={a} h={figH} sleep={!!(w && w.doing === 'sleep')} spent={spentOf(id, place)}/></button>; })}</div>
            <span className="mhl-map-name" data-assistant-life-map-name>{`${assistantLifeName(who[0])}ほか${who.length - 1}人`}</span>
          </div>
        ) : who.map(id => { const a = assistantById(id); if (!a) return null; const w = assistantLifeWhereOf(life, id); const d = w && ASSISTANT_LIFE_DOINGS[w.doing];
          return (
            <button key={id} type="button" aria-label={`${a.name}・${d ? d.label : ''}${spentOf(id, place) ? '(対戦のごほうび済み)' : ''}`} data-assistant-life-map-who={id} data-assistant-life-map-spent={spentOf(id, place) ? '1' : undefined} onClick={() => setSheet(place)} className="flex flex-col items-center px-[1px]">
              {(() => { const town = typeof assistantLifePartnerOk === 'function' && !assistantLifePartnerOk(id); return (<>
              <span className="block" style={town ? { filter: 'grayscale(.55) brightness(.85)' } : undefined} data-assistant-life-map-town={town ? id : undefined}><AssistantLifeMapFig who={a} h={figH} sleep={!!(w && w.doing === 'sleep')} spent={spentOf(id, place)}/></span>
              <span className="mhl-map-name" data-assistant-life-map-name>{typeof assistantLifeBodyCondShort === 'function' && assistantLifeBodyCondShort(id) ? assistantLifeBodyBadge(id) : w && ASSISTANT_LIFE_DOING_ICON[w.doing]}{a.name}{town ? '・町の人' : ''}</span></>); })()}
            </button>); })}
      </div>);
  };
  const sheetPlace = sheet;
  const sheetWho = sheetPlace ? (at[sheetPlace] || []) : [];
  const fac = sheetPlace ? assistantLifeFacilityOf({ place: sheetPlace }) : null;
  const sheetTown = sheetPlace === 'home' ? assistantLifeMapTownOnlyNow().flatMap(p => (at[p] || []).map(id => [id, p])) : [];
  // シートの1行(顔・名前・だれと何をしているか・できること)。town … 町の場所の人を家の札のシートに並べるとき(場所の名前も出す)
  const row = (id, place, town) => (
    <AssistantLifeMapRow key={id} id={id} place={place} town={town} life={life} selected={initialAssistantId === id} cheerMsg={cheerMsg} setCheerMsg={setCheerMsg} close={() => setSheet(null)}
      onRoom={(rid) => { if (typeof onView === 'function') onView(rid); else { setSheet(null); onPick(rid); } }} onBeat={onBeat} onCard={onCard}/>);
  return (
    <div className="absolute inset-0 z-[4] overflow-y-auto overflow-x-hidden bg-[#0b1020]" data-assistant-life-where data-assistant-life-map-art={art}>
      {typeof AssistantMasmonRanchHost === 'function' && <AssistantMasmonRanchHost/>}
      {typeof AssistantMasmonTrainWatchHost === 'function' && <AssistantMasmonTrainWatchHost/>}
      <style>{`.mhl-map-town{position:absolute;z-index:4;padding:0;border:0;background:transparent;color:#fff}
.mhl-map-town>span{display:flex;align-items:center;gap:4px;white-space:nowrap;min-height:${home.h >= 700 ? 44 : home.h >= 600 ? 34 : 0}px;padding:4px ${home.h >= 600 ? 11 : 9}px;border:2px solid #ffe6a7a8;border-radius:12px;background:#10211df2;box-shadow:0 3px 10px #0009;font-size:12px;font-weight:900;line-height:1.15;text-shadow:0 2px 4px #000}
.mhl-map-town[data-assistant-life-map-empty="1"]>span{opacity:.6;border-color:#94a3b8aa;background:#0f172ad9}
.mhl-map-name{display:block;margin-top:-1px;white-space:nowrap;border-radius:7px;background:#0b1020e6;padding:0 4px;font-size:${home.h >= 700 ? 11 : 10}px;font-weight:900;line-height:${small ? 13 : home.h >= 700 ? 15 : 14}px;color:#fff;box-shadow:0 1px 3px #0008}
[data-assistant-life-map] .mh-home-facility:active>span,.mhl-map-town:active>span{transform:scale(.94)}`}</style>
      {/* 地図の枠は少なくとも画面の高さ。HOME の場面が画面より低い端末(上下に帯がある iPhone など)で、
          下の一覧の見出しが地図の下にのぞいて切れて見えていた(2026-11-09 社長「画面バグってる」) */}
      <div className="relative" style={{ minHeight: '100%' }} data-assistant-life-map-fill>
      <div ref={sceneRef} className={`mh-home-scene${home.wide ? ' is-wide' : ''}`} style={sceneStyle} data-assistant-life-map data-assistant-life-map-from-home={home.fromHome ? '1' : '0'}>
        <picture className={`mh-home-background is-ready${home.wide ? ' is-wide' : ''}`} aria-hidden="true"><img className="mh-home-backdrop" src={home.src} alt=""/><img className="mh-home-main" src={home.src} alt=""/></picture>
        {/* HOME と同じ札(同じ class・同じ中身)。押すと、そこにいる助手とできること。下の案内は、HOME の下にあるモンヒロバトルの札と重ならないよう札の上に置く(2026-11-11) */}
        <nav className="mh-home-facilities" aria-label="町の場所">
          {facBtn('ranch', 'management', 'M/B管理', <span><Layers size={18}/><b className="mh-home-facility-label">M/B管理<small>モンスター・編成</small></b></span>)}
          {facBtn('temple', 'temple', '神殿', <span><Sparkles size={18}/>神殿</span>)}
          {facBtn('market', 'market', 'マーケット', <span><ShoppingBag size={17}/>マーケット</span>)}
          {facBtn('battle', 'battle', 'モンヒロバトル', <span><Sword size={25}/>モンヒロバトル</span>)}
          {facBtn('home', 'life', '助手ライフ みんなの家', <span><span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>🏡</span><b className="mh-home-facility-label">助手ライフ<small>みんなの家</small></b></span>)}
          {facBtn('studio', 'rhythm', 'モンヒロビート', <span>🎵 モンヒロビート</span>)}
        </nav>
        <button type="button" className={home.card} aria-label={`MFバトルカード(${cardN ? `${cardN}人` : 'だれもいない'})`} data-assistant-life-map-place="cardroom" data-assistant-life-map-empty={cardN ? '0' : '1'} style={cardN ? undefined : { opacity: 0.55, filter: 'saturate(.5)' }} onClick={() => setSheet('cardroom')}><span>🃏 MFバトルカード</span>{perkMark('cardroom')}</button>
        {/* HOME に札の無い町の場所 */}
        {assistantLifeMapTownOnlyNow().map(p => { const n = (at[p] || []).length; return (
          <button key={p} type="button" className="mhl-map-town" style={{ visibility: 'hidden', left: 0, top: 0 }} aria-label={`${assistantLifePlaceShow(p)}(${n ? `${n}人` : 'だれもいない'})`} data-assistant-life-map-place={p} data-assistant-life-map-town data-assistant-life-map-empty={n ? '0' : '1'} onClick={() => setSheet(p)}>
            <span>{ASSISTANT_LIFE_PLACE_ICON[p]} {assistantLifePlaceShow(p)}</span></button>); })}
        {assistantLifeMapOrderNow().map(crowd)}
        {/* 上の帯: 家へ戻る・題・時間帯・一覧へ */}
        <div className="absolute inset-x-0 top-0 z-[8] flex items-center gap-2 bg-gradient-to-b from-[#0b1020f2] via-[#0b1020d9] to-transparent px-2 pb-3" style={{ paddingTop: land ? 6 : 'calc(6px + env(safe-area-inset-top))', paddingLeft: 'calc(8px + env(safe-area-inset-left))', paddingRight: 'calc(8px + env(safe-area-inset-right))' }} data-assistant-life-map-bar>
          {/* 新UI(nav あり): 「家へ」と「一覧」の代わりに、ほかの画面と同じ4つのタブ(家・町・きずな・フレンド) */}
          {nav ? <div className="shrink-0" style={{ width: land ? 250 : 216 }} data-assistant-life-map-nav>{nav}</div>
            : <button type="button" data-assistant-life-map-back onClick={onBack} className="shrink-0 rounded-xl border border-pink-300/60 bg-slate-950/85 px-2.5 py-1.5 text-[12px] font-black text-pink-100 active:scale-95">🏡 家へ</button>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black leading-tight text-white" style={{ textShadow: '0 2px 4px #000' }}>{nav ? '🗺 町' : '📋 みんなの居場所'}</p>
            <p className="truncate text-[10px] font-bold text-slate-200" data-assistant-life-map-time>{assistantLifeTodLabel()} ・ {assistantLifeNextSlotText().replace(/みんなが動きます$/, 'みんなが動く')}</p>
          </div>
          {list && <button type="button" data-assistant-life-map-list onClick={() => { try { const l = listRef.current, box = l && l.parentElement; if (box) box.scrollTo({ top: l.offsetTop, behavior: 'smooth' }); } catch (_) {} }} className="shrink-0 rounded-xl border border-slate-500/70 bg-slate-950/85 px-2.5 py-1.5 text-[11px] font-black text-slate-100 active:scale-95">📃 一覧 ↓</button>}
        </div>
        <p className="pointer-events-none absolute left-1/2 z-[7] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/85 px-3 py-1 text-[10.5px] font-bold text-slate-100" style={{ top: land ? 54 : 'calc(60px + env(safe-area-inset-top))' }} data-assistant-life-map-hint>場所を押すと、いる助手と「いま行くと得」が見られます</p>{/* 下にあるとモンヒロバトルの札にかぶっていた(2026-11-11 ミヤスサ点検 ⑥)。上のタブのすぐ下へ */}
      </div>
      </div>
      {list && <div ref={listRef} className="relative bg-[#0b1020]" data-assistant-life-map-below>{list}</div>}
      {sheetPlace && (
        <div className="fixed inset-0" style={{ zIndex: 30 }} data-assistant-life-map-sheet={sheetPlace}>
          <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={() => setSheet(null)}/>
          <div className="mhl-sheet" style={land ? { left: 'auto', width: '42%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px', borderTop: 0, borderLeft: '2px solid #f9a8d4', paddingTop: 10 } : undefined}>
            <p className="mhl-en">WHERE · {String(sheetPlace).toUpperCase()}</p>
            <p className="text-[18px] font-black" data-assistant-life-map-sheet-title>{assistantLifeMapSpotWord(sheetPlace)}</p>
            <p className="text-[10.5px] font-bold text-slate-300" style={JA_WRAP_STYLE} data-assistant-life-map-sheet-home>{jaWrap(assistantLifeMapTownOnlyNow().includes(sheetPlace) ? `町の場所。HOME では「🏡 助手ライフ」の札の下に顔が出ます` : `HOME の「${ASSISTANT_LIFE_MAP_FAC_NAME[fac]}」の札${sheetPlace === 'home' ? '(家と町にいる助手の顔もここ)' : ''}`)}</p>
            <p className="mt-1 text-[11.5px] font-bold leading-snug text-slate-100" style={JA_WRAP_STYLE}>{sheetPlace === 'cardroom' && typeof CARD_LIFE_UP_LABEL !== 'undefined' ? <>{jaWrap('MFバトルカードの研究をしている助手。いる助手と対戦すると、')}<span className="whitespace-nowrap">ごほうび {CARD_LIFE_UP_LABEL}</span></> : jaWrap(ASSISTANT_LIFE_MAP_ABOUT[sheetPlace])}</p>
            {typeof AssistantLifePlacePerk === 'function' && sheetWho.length > 0 && <AssistantLifePlacePerk life={life} ids={sheetWho} place={sheetPlace} land={land} onGo={onGo ? (fn) => { setSheet(null); onGo(fn); } : null}/>}
            {sheetWho.length ? sheetWho.map(id => row(id, sheetPlace, false)) : <p className="mt-2 rounded-xl bg-slate-900/85 px-2 py-2 text-[12px] font-bold text-slate-300" data-assistant-life-map-sheet-none style={JA_WRAP_STYLE}>いまはだれもいません</p>}
            {/* 行き先の予定(入口①。印 assistantLifePlan が偽・予定に入れられない場所・今日の移動が残っていないときは出さない) */}
            {typeof assistantLifePlanOn === 'function' && assistantLifePlanOn() && ASSISTANT_LIFE_PLAN_PLACES.includes(sheetPlace) && assistantLifePlanSlotsLeft().length > 0 && (
              <button type="button" data-assistant-life-map-plan={sheetPlace} onClick={() => assistantLifePlanOpen({ place: sheetPlace })}
                className="mt-2 flex min-h-[44px] w-full items-center gap-1.5 rounded-xl border border-dashed border-sky-300/80 bg-slate-900/85 px-2 text-left">
                <span className="min-w-0 flex-1 text-[12px] font-black leading-snug text-white" style={JA_WRAP_STYLE}>{jaWrap(`📍 次の移動(${assistantLifeSlotOfAbs(assistantLifePlanSlotsLeft()[0]).from}時)で、ここへ来てもらう`)}<span className="block text-[10.5px] font-bold text-emerald-300">{jaWrap('助手を選ぶ → たいてい来てくれます')}</span></span>
                <span className="shrink-0 rounded-xl bg-amber-400 px-2 py-1 text-[11.5px] font-black text-slate-900">選ぶ</span>
              </button>)}
            {/* 家の札には、町の場所にいる助手も並べる(HOME の「助手ライフ」の札の下の顔と同じ顔ぶれになる) */}
            {sheetTown.length > 0 && (<>
              <p className="mt-3 text-[11px] font-black text-amber-200" data-assistant-life-map-sheet-town style={JA_WRAP_STYLE}>{jaWrap('📍 町にいる助手(HOME ではこの札の下に顔が出ます)')}</p>
              {sheetTown.map(([id, p]) => row(id, p, true))}
            </>)}
            <button type="button" data-assistant-life-map-sheet-close data-mhl-sheet-close onClick={() => setSheet(null)} className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">閉じる</button>
          </div>
        </div>)}
    </div>);
}
