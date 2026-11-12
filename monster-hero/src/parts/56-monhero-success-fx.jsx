// ===== モンヒロサクセス: 育てる子が「生きている」ように見える演出(回2・回3の画面から呼ぶ部品) =====
// 2026-11-12 窓口の依頼。絵は1枚のPNGのまま、今ある待機アニメのリグ(24-battle-fx.jsx の withMonsterIdleArt)に、
// 気分の姿勢・ときどきのしぐさ・季節と時間の光・ふきだしの声(mon.js の {cry})を重ねる。
//
// 呼び方(画面の側は、置き場所の大きさだけ決めて渡す。正方形の箱は中で作る):
//   <MsxLiveMon species="Mocchi" colors={run.colors} mood="joy" season="spring" time="昼"
//               react={{ kind:'great', id: 1 }} onReactEnd={() => …} seed={run.id}/>
//     mood  … 気分8つ joy/hype/calm/tired/sulky/sad/surprise/clingy。様子の5段や「うつ」は msxFxMoodOf() で直す
//     react … 1回きりの反応。id が変わるたびに1回だけ動く。kind は MSXFX_REACT の名前
//             (great 大成功で跳ねる/ok 成功で頷く/fail 失敗でしょんぼり/sab サボりでそっぽ/
//              scold 叱られて縮む/scoldBad 合っていない叱り方でふてくされ/praise 褒められて甘える)
//   <MsxFxMoment kind="lvup" title="ちから Lv3" sub="訓練の効果が上がった" onDone={…}/>
//     節目の短い演出。kind: lvup 訓練Lvアップ/tech 修行の技を覚えた/win 大会に勝った/lose 大会に負けた/
//     over ゲームオーバー/retire 引退。親は position:relative の画面(.msx)。画面いっぱいに重なる
//     pose  … しぐさを出したままにする(止め絵・見本用)
//   <MsxSceneLight season time/> … 背景の上に重ねる季節と時間の光(押せない・動かない)
//
// 決まり: 演出は1.2秒まで・押せばとばせる・端末の「動きを減らす」(または calm)では動かさず止まった姿で出す。
// ふきだしの声は台本エンジン(別の会話で作る monsucMonLine)があればそれを、無ければ読み込んである台本 mon.js
// (回2の msxSuc.script.mon)、それも無ければ下の仮の声から選ぶ。保存はしない。公開の印も見ない(呼ぶ画面が見る)。

const MSXFX_MOODS = Object.freeze(['joy', 'hype', 'calm', 'tired', 'sulky', 'sad', 'surprise', 'clingy']);
const MSXFX_MOOD_ALIAS = Object.freeze({
  // ターンのはじめの様子(5段)と、気になる様子
  great: 'hype', good: 'joy', normal: 'calm', tired: 'tired', worn: 'tired', stress: 'sulky', utsu: 'sad', sabori: 'sulky',
  // ことばで来たとき
  ごきげん: 'joy', ふつう: 'calm', 疲れ: 'tired', ふてくされ: 'sulky', うつ: 'sad',
});
const msxFxMoodOf = (m) => (MSXFX_MOODS.includes(m) ? m : (MSXFX_MOOD_ALIAS[m] || 'calm'));

// 1回きりの反応: 動き(cls)と、ふきだしの声の気分(mon.js の「場面ごとの気分の目安」に合わせる)と、飛ぶ印
const MSXFX_REACT = Object.freeze({
  great: { cls: 'jump', mood: 'hype', fx: 'spark' },
  ok: { cls: 'nod', mood: 'joy', fx: 'note' },
  fail: { cls: 'droop', mood: 'sad', fx: 'drop' },
  sab: { cls: 'away', mood: 'calm', fx: 'zzz' },
  scold: { cls: 'shrink', mood: 'sad', fx: 'sweat' },
  scoldBad: { cls: 'away', mood: 'sulky', fx: 'puff' },
  praise: { cls: 'snuggle', mood: 'clingy', fx: 'heart' },
  peak: { cls: 'jump', mood: 'surprise', fx: 'spark' },
});
// ときどきのしぐさ(気分ごと)。だいたい7秒に1回
const MSXFX_GESTURE = Object.freeze({
  joy: { cls: 'hop', fx: 'note' }, hype: { cls: 'hop2', fx: 'spark' }, calm: { cls: 'look', fx: '' },
  tired: { cls: 'yawn', fx: 'zzz' }, sulky: { cls: 'huff', fx: 'puff' }, sad: { cls: 'shiver', fx: 'drop' },
  surprise: { cls: 'jolt', fx: 'bang' }, clingy: { cls: 'lean', fx: 'heart' },
});
const MSXFX_FX_CHAR = Object.freeze({ spark: '✦', note: '♪', drop: '💧', zzz: 'z', sweat: '💦', puff: '💢', heart: '♡', bang: '！' });

// 動きを減らす設定(端末の設定。助手マスモンの部品と同じ見方)
const msxFxCalm = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
const msxFxHash = (s) => { let h = 2166136261; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- 季節と時間の光 ----
// time は '朝'/'昼'/'夕方'/'夜'(回2の msxSceneBg().time と同じことば)。無ければ端末の時計
const msxFxTimeNow = () => { let h = 12; try { h = new Date().getHours(); } catch (_) {} return h >= 5 && h < 9 ? '朝' : h >= 9 && h < 16 ? '昼' : h >= 16 && h < 19 ? '夕方' : '夜'; };
const MSXFX_TIME_LIGHT = Object.freeze({
  朝: { sky: 'linear-gradient(180deg,#fff7d633 0,#ffe4b522 50%,#0000 100%)', mon: 'brightness(1.04) saturate(1.02)', rim: '#fff3c4' },
  昼: { sky: 'linear-gradient(180deg,#ffffff1a 0,#0000 60%)', mon: 'none', rim: '#ffffff' },
  夕方: { sky: 'linear-gradient(180deg,#ff9f4338 0,#f9731626 55%,#7c2d1222 100%)', mon: 'sepia(.18) saturate(1.1) brightness(.98) hue-rotate(-6deg)', rim: '#fdba74' },
  夜: { sky: 'linear-gradient(180deg,#1e1b4b66 0,#312e8144 55%,#0f0d2455 100%)', mon: 'brightness(.82) saturate(.85) hue-rotate(8deg)', rim: '#a5b4fc' },
});
const MSXFX_SEASON_LIGHT = Object.freeze({
  spring: 'radial-gradient(120% 70% at 20% 0,#f9a8d42e 0,#0000 60%)',
  summer: 'radial-gradient(120% 70% at 80% 0,#fde0473a 0,#0000 60%)',
  autumn: 'radial-gradient(120% 70% at 50% 0,#fb923c33 0,#0000 60%)',
  winter: 'radial-gradient(120% 70% at 50% 0,#bae6fd38 0,#0000 60%)',
});
const msxFxLight = (season, time) => {
  const t = MSXFX_TIME_LIGHT[time] || MSXFX_TIME_LIGHT[msxFxTimeNow()];
  const s = MSXFX_SEASON_LIGHT[season] || '';
  return { overlay: [s, t.sky].filter(Boolean).join(','), mon: t.mon, rim: t.rim };
};
function MsxSceneLight({ season, time }) {
  msxFxEnsureCss();
  return <div className="msxfx-light" aria-hidden="true" style={{ background: msxFxLight(season, time).overlay }}/>;
}

// ---- ふきだしの声 ----
// 台本エンジンができるまでの仮の声(mon.js の共通の声から各気分2本)。鳴き声も無い種は「きゅ」
const MSXFX_VOICE_FALLBACK = Object.freeze({
  joy: ['{cry}♪', '{cry}〜♪'], hype: ['{cry}ーーっ！！', '{cry}！{cry}！{cry}！'], calm: ['{cry}', '{cry}？'],
  tired: ['ぜぇ…ぜぇ…', '{cry}…'], sulky: ['むぅ…', '{cry}っ！ ぷいっ'], sad: ['{cry}…', 'しょぼ…'],
  surprise: ['{cry}！？', '！？'], clingy: ['{cry}〜', '{cry}…♡'],
});
const msxFxScriptRows = () => {
  try { if (typeof msxSuc !== 'undefined' && msxSuc && msxSuc.script && Array.isArray(msxSuc.script.mon)) return msxSuc.script.mon; } catch (_) {}
  try { if (typeof MONSUC_SCRIPT_MON !== 'undefined' && Array.isArray(MONSUC_SCRIPT_MON)) return MONSUC_SCRIPT_MON; } catch (_) {}
  return null;
};
const msxFxCry = (species) => {
  const rows = msxFxScriptRows(); const id = `mon.cry.${String(species || '').toLowerCase()}`;
  const r = rows && rows.find((x) => x && x.id === id);
  return r && typeof r.t === 'string' ? r.t : 'きゅ';
};
const msxFxVoice = (species, mood, seed = '') => {
  const m = msxFxMoodOf(mood);
  try { if (typeof monsucMonLine === 'function') { const r = monsucMonLine({ species, mood: m, seed }); if (r && typeof r === 'string') return r; if (r && typeof r.t === 'string') return r.t; } } catch (_) {}
  const rows = msxFxScriptRows();
  const pool = rows ? rows.filter((x) => x && typeof x.id === 'string' && x.id.startsWith(`mon.mood.${m}.`)).map((x) => x.t) : [];
  const list = pool.length ? pool : MSXFX_VOICE_FALLBACK[m];
  const t = list[msxFxHash(`${seed}|${m}`) % list.length];
  const cry = msxFxCry(species);
  return String(t).replace(/\{cry\}/g, cry);
};

// ---- 育てる子(待機アニメ+気分+しぐさ+反応+ふきだし) ----
function MsxLiveMon({ species, colors, mood = 'calm', season, time, react, onReactEnd, seed = '', voice = true, calm, pose = false, className = '', style, alt = '' }) {
  msxFxEnsureCss();
  const still = calm === true || msxFxCalm();
  const m = msxFxMoodOf(mood);
  const mon = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS[species] : null;
  // pose: しぐさを出したままにする(止め絵・見本用。ふだんの画面では使わない)
  const [act, setAct] = React.useState(() => (pose ? { cls: MSXFX_GESTURE[m].cls, fx: MSXFX_GESTURE[m].fx, say: voice ? msxFxVoice(species, m, `${seed}|pose`) : '', n: 'pose' } : null)); // { cls, fx, say, n }
  const timers = React.useRef([]);
  const actRef = React.useRef(null); actRef.current = act;
  const endRef = React.useRef(onReactEnd); endRef.current = onReactEnd;
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (f, ms) => { timers.current.push(setTimeout(f, ms)); };
  React.useEffect(() => clear, []);
  // 1回きりの反応(id が変わるたび)
  const reactKey = react && react.kind ? `${react.kind}:${react.id != null ? react.id : ''}` : '';
  React.useEffect(() => {
    if (!reactKey) return;
    const R = MSXFX_REACT[react.kind]; if (!R) return;
    clear();
    const say = voice ? msxFxVoice(species, R.mood, `${seed}|${reactKey}`) : '';
    setAct({ cls: R.cls, fx: R.fx, say, n: reactKey, react: true });
    later(() => { setAct(null); if (endRef.current) endRef.current(); }, still ? 700 : 1200);
  }, [reactKey]);
  // ときどきのしぐさ(反応の最中はしない)。止める設定ではしない
  React.useEffect(() => {
    if (still || pose) return undefined;
    let n = 0; const base = 6200 + (msxFxHash(`${seed}|${species}`) % 2400);
    const iv = setInterval(() => {
      n++;
      if (actRef.current && actRef.current.react) return;
      const G = MSXFX_GESTURE[m]; const key = `g${n}`;
      const say = voice && n % 2 === 1 ? msxFxVoice(species, m, `${seed}|${key}`) : '';
      setAct({ cls: G.cls, fx: G.fx, say, n: key });
      later(() => setAct((c) => (c && c.n === key ? null : c)), 1200);
    }, base);
    return () => clearInterval(iv);
  }, [m, still, pose, species, seed, voice]);
  const skip = () => { if (!act) return; const wasReact = act.react; clear(); setAct(null); if (wasReact && endRef.current) endRef.current(); };
  const L = msxFxLight(season, time);
  const img = mon && mon.imgUrl
    ? (typeof DyedMonsterImage === 'function'
      ? <DyedMonsterImage baseId={species} src={mon.imgUrl} alt={alt} masuColors={Array.isArray(colors) ? colors : []} draggable={false} className="w-full h-full object-contain" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
      : <img src={mon.imgUrl} alt={alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>)
    : <span className="msxfx-emoji">{(mon && mon.emoji) || '❔'}</span>;
  const art = !still && typeof withMonsterIdleArt === 'function' ? withMonsterIdleArt(species, img, { fill: true, own: true }) : img;
  const fxCh = act && act.fx ? MSXFX_FX_CHAR[act.fx] : '';
  return (
    <div className={`msxfx-live${still ? ' msxfx-calm' : ''} ${className}`} style={style} data-msxfx-mood={m} data-msxfx-act={act ? act.cls : ''} onClick={act ? skip : undefined}>
      <div className="msxfx-shadow" aria-hidden="true"/>
      <div className={`msxfx-pose msxfx-m-${m}`}>
        <div key={act ? act.n : 'idle'} className={`msxfx-act${act ? ` msxfx-a-${act.cls}` : ''}`}>
          <div className="msxfx-tint" style={{ filter: `${L.mon === 'none' ? '' : L.mon} drop-shadow(0 6px 5px #0008)`.trim(), '--msxfx-rim': L.rim }}>{art}</div>
        </div>
      </div>
      {fxCh ? <div key={`fx-${act.n}`} className={`msxfx-fx msxfx-fx-${act.fx}`} aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} style={{ '--i': i }}>{fxCh}</i>)}</div> : null}
      {act && act.say ? <div key={`b-${act.n}`} className="msxfx-bub">{act.say}</div> : null}
    </div>
  );
}

// ---- 節目の短い演出 ----
const MSXFX_MOMENT = Object.freeze({
  lvup: { icon: '⬆️', head: '訓練Lvアップ！', tone: 'gold' },
  tech: { icon: '📜', head: '技を覚えた！', tone: 'sky' },
  win: { icon: '🏆', head: '優勝！', tone: 'gold' },
  lose: { icon: '…', head: '負けてしまった', tone: 'gray' },
  over: { icon: '🌧️', head: 'ゲームオーバー', tone: 'gray' },
  retire: { icon: '🌸', head: '引退', tone: 'pink' },
});
function MsxFxMoment({ kind, title, sub, species, colors, onDone, calm }) {
  msxFxEnsureCss();
  const still = calm === true || msxFxCalm();
  const K = MSXFX_MOMENT[kind] || MSXFX_MOMENT.lvup;
  const doneRef = React.useRef(onDone); doneRef.current = onDone;
  const fired = React.useRef(false);
  const finish = () => { if (fired.current) return; fired.current = true; if (doneRef.current) doneRef.current(); };
  React.useEffect(() => { const t = setTimeout(finish, 1200); return () => clearTimeout(t); }, []);
  const mood = kind === 'win' ? 'great' : kind === 'lvup' || kind === 'tech' ? 'ok' : kind === 'retire' ? 'praise' : 'fail';
  return (
    <div className={`msxfx-moment msxfx-t-${K.tone} msxfx-k-${kind}${still ? ' msxfx-calm' : ''}`} onClick={finish} role="button" aria-label="とばす" data-msxfx-moment={kind}>
      <div className="msxfx-rays" aria-hidden="true"/>
      {kind === 'win' || kind === 'lvup' || kind === 'tech' ? <div className="msxfx-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i }}/>)}</div> : null}
      {kind === 'lose' || kind === 'over' ? <div className="msxfx-rain" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--i': i }}/>)}</div> : null}
      {species ? <div className="msxfx-mmon"><MsxLiveMon species={species} colors={colors} mood={MSXFX_REACT[mood].mood} react={{ kind: mood, id: kind }} voice={false} calm={still}/></div> : null}
      <div className="msxfx-plate">
        <div className="msxfx-icon">{K.icon}</div>
        <div className="msxfx-head">{K.head}</div>
        {title ? <div className="msxfx-title">{title}</div> : null}
        {sub ? <div className="msxfx-sub">{sub}</div> : null}
      </div>
      <div className="msxfx-skip">タップでとばす</div>
    </div>
  );
}

// ---- 見た目(アニメの名前は msxfx- を頭に付ける) ----
const MSXFX_CSS = `
.msxfx-light{position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;z-index:1}
.msxfx-live{position:relative;height:100%;aspect-ratio:1/1;max-width:100%;margin:0 auto;-webkit-tap-highlight-color:transparent}
.msxfx-shadow{position:absolute;left:22%;right:22%;bottom:3%;height:7%;border-radius:50%;background:radial-gradient(closest-side,#0008,#0000)}
.msxfx-pose,.msxfx-act,.msxfx-tint{position:absolute;inset:0;transform-origin:50% 92%}
.msxfx-tint>*{display:block;width:100%;height:100%}
.msxfx-emoji{display:flex!important;align-items:center;justify-content:center;font-size:64px}
/* 気分の姿勢(ずっと) */
.msxfx-m-joy{animation:msxfx-bob 1.6s ease-in-out infinite}
.msxfx-m-hype{animation:msxfx-bob .8s ease-in-out infinite}
.msxfx-m-tired{transform:translateY(4%) scaleY(.95);filter:saturate(.85)}
.msxfx-m-sulky{transform:scaleX(-1) rotate(-3deg)}
.msxfx-m-sad{transform:translateY(5%) scale(.95) rotate(-2deg);filter:saturate(.7) brightness(.92)}
.msxfx-m-surprise{transform:translateY(-2%) scale(1.02)}
.msxfx-m-clingy{transform:rotate(4deg) translateX(-3%)}
/* しぐさと反応(1.2秒まで) */
.msxfx-a-hop{animation:msxfx-hop .6s ease-out 1}
.msxfx-a-hop2{animation:msxfx-hop .45s ease-out 2}
.msxfx-a-look{animation:msxfx-look 1.1s ease-in-out 1}
.msxfx-a-yawn{animation:msxfx-yawn 1.1s ease-in-out 1}
.msxfx-a-huff{animation:msxfx-huff .5s ease-in-out 2}
.msxfx-a-shiver{animation:msxfx-shiver .12s linear 6}
.msxfx-a-jolt{animation:msxfx-jolt .5s cubic-bezier(.2,1.6,.4,1) 1}
.msxfx-a-lean{animation:msxfx-lean 1.1s ease-in-out 1}
.msxfx-a-jump{animation:msxfx-jump 1s cubic-bezier(.3,1.4,.5,1) 1}
.msxfx-a-nod{animation:msxfx-nod .5s ease-in-out 2}
.msxfx-a-droop{animation:msxfx-droop 1.1s ease-out 1 forwards}
.msxfx-a-away{animation:msxfx-away 1.1s ease-in-out 1 forwards}
.msxfx-a-shrink{animation:msxfx-shrink 1.1s ease-out 1 forwards}
.msxfx-a-snuggle{animation:msxfx-snuggle 1.1s ease-in-out 1}
@keyframes msxfx-bob{0%,100%{translate:0 0}50%{translate:0 -2.5%}}
@keyframes msxfx-hop{0%,100%{transform:translateY(0) scale(1)}15%{transform:translateY(0) scale(1.06,.92)}50%{transform:translateY(-14%) scale(.96,1.05)}85%{transform:translateY(0) scale(1.05,.95)}}
@keyframes msxfx-look{0%,100%{transform:none}25%,45%{transform:scaleX(-1)}70%{transform:rotate(-6deg)}}
@keyframes msxfx-yawn{0%,100%{transform:none}40%,60%{transform:scale(1.03,1.06) rotate(-3deg)}80%{transform:translateY(3%) scaleY(.96)}}
@keyframes msxfx-huff{0%,100%{transform:none}50%{transform:scale(1.06,.96) translateX(3%)}}
@keyframes msxfx-shiver{0%,100%{transform:translateX(0)}50%{transform:translateX(-1.5%)}}
@keyframes msxfx-jolt{0%{transform:none}40%{transform:translateY(-12%) scale(1.08)}100%{transform:none}}
@keyframes msxfx-lean{0%,100%{transform:none}40%,70%{transform:rotate(-9deg) translateX(-6%)}}
@keyframes msxfx-jump{0%{transform:none}12%{transform:scale(1.12,.86)}40%{transform:translateY(-26%) scale(.92,1.1) rotate(-6deg)}62%{transform:translateY(0) scale(1.1,.9)}78%{transform:translateY(-6%)}100%{transform:none}}
@keyframes msxfx-nod{0%,100%{transform:none}45%{transform:rotate(8deg) scaleY(.95)}}
@keyframes msxfx-droop{0%{transform:none;filter:none}35%{transform:translateY(6%) scale(.96) rotate(-5deg)}100%{transform:translateY(8%) scale(.94) rotate(-7deg);filter:saturate(.55) brightness(.85)}}
@keyframes msxfx-away{0%{transform:none}30%{transform:scaleX(.05)}55%,100%{transform:scaleX(-1) rotate(-4deg) translateY(2%)}}
@keyframes msxfx-shrink{0%{transform:none}20%{transform:translateY(-4%) scale(1.04)}45%,100%{transform:translateY(6%) scale(.88,.86)}}
@keyframes msxfx-snuggle{0%,100%{transform:none}25%{transform:rotate(-8deg) translateX(-4%)}50%{transform:rotate(6deg) translateX(3%) translateY(-6%)}75%{transform:rotate(-5deg)}}
/* 飛ぶ印 */
.msxfx-fx{position:absolute;left:50%;top:14%;width:0;height:0;pointer-events:none;z-index:2}
.msxfx-fx i{position:absolute;font-style:normal;font-weight:900;font-size:22px;color:#fde047;text-shadow:0 1px 3px #0009;opacity:0;animation:msxfx-float 1.1s ease-out forwards;animation-delay:calc(var(--i)*.12s);left:calc((var(--i) - 1)*34px)}
.msxfx-fx-heart i{color:#f472b6}.msxfx-fx-note i{color:#7dd3fc}.msxfx-fx-zzz i{color:#c7d2fe;font-size:18px}.msxfx-fx-puff i,.msxfx-fx-bang i{color:#fb7185}
@keyframes msxfx-float{0%{opacity:0;transform:translateY(10px) scale(.6)}25%{opacity:1;transform:translateY(-4px) scale(1.1)}100%{opacity:0;transform:translateY(-34px) scale(1)}}
/* ふきだし */
.msxfx-bub{position:absolute;left:50%;top:-2%;transform:translateX(-50%);z-index:3;background:#fff;color:#1e1b4b;font-weight:900;font-size:13px;line-height:1.3;
  padding:5px 11px;border-radius:14px;white-space:nowrap;max-width:180%;overflow:hidden;text-overflow:ellipsis;box-shadow:0 3px 8px #0006;
  animation:msxfx-bub 1.7s ease-out forwards;pointer-events:none}
.msxfx-bub:after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-bottom:0;border-top-color:#fff}
@keyframes msxfx-bub{0%{opacity:0;transform:translateX(-50%) translateY(6px) scale(.8)}12%{opacity:1;transform:translateX(-50%) scale(1.05)}20%{transform:translateX(-50%) scale(1)}85%{opacity:1}100%{opacity:0}}
/* 節目 */
.msxfx-moment{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;overflow:hidden;
  background:radial-gradient(circle at 50% 45%,#2b2457ee 0,#0f0d24f2 70%);animation:msxfx-in .18s ease-out;cursor:pointer}
.msxfx-t-gray{background:radial-gradient(circle at 50% 45%,#2a2f3df0 0,#0b0d14f5 70%)}
.msxfx-t-pink{background:radial-gradient(circle at 50% 40%,#5b2a4bee 0,#130d24f4 72%)}
.msxfx-rays{position:absolute;left:50%;top:42%;width:170vmax;height:170vmax;margin:-85vmax 0 0 -85vmax;opacity:.35;
  background:repeating-conic-gradient(#fde04755 0 8deg,#0000 8deg 22deg);animation:msxfx-spin 6s linear infinite;pointer-events:none}
.msxfx-t-sky .msxfx-rays{background:repeating-conic-gradient(#7dd3fc55 0 8deg,#0000 8deg 22deg)}
.msxfx-t-pink .msxfx-rays{background:repeating-conic-gradient(#f9a8d444 0 10deg,#0000 10deg 26deg)}
.msxfx-t-gray .msxfx-rays{display:none}
.msxfx-mmon{position:relative;height:min(34vh,190px);aspect-ratio:1/1}
.msxfx-k-over .msxfx-mmon,.msxfx-k-lose .msxfx-mmon{filter:grayscale(.6) brightness(.8)}
.msxfx-k-retire .msxfx-mmon{animation:msxfx-rise 1.2s ease-out forwards}
.msxfx-plate{position:relative;text-align:center;color:#fff;animation:msxfx-pop .35s cubic-bezier(.2,1.5,.4,1)}
.msxfx-icon{font-size:30px;line-height:1}
.msxfx-head{font-size:22px;font-weight:900;letter-spacing:.04em;text-shadow:0 2px 0 #0008}
.msxfx-t-gold .msxfx-head{color:#fde047}.msxfx-t-sky .msxfx-head{color:#7dd3fc}.msxfx-t-pink .msxfx-head{color:#f9a8d4}.msxfx-t-gray .msxfx-head{color:#cbd5e1}
.msxfx-title{margin-top:4px;font-size:16px;font-weight:900;padding:4px 14px;border-radius:99px;background:#ffffff1f;display:inline-block;max-width:86vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msxfx-sub{margin-top:4px;font-size:12px;color:#cbd5e1;font-weight:700;max-width:86vw}
.msxfx-skip{position:absolute;bottom:14px;right:14px;font-size:11px;color:#94a3b8;font-weight:700}
.msxfx-confetti i{position:absolute;left:50%;top:44%;width:7px;height:11px;border-radius:2px;background:#fde047;opacity:0;
  animation:msxfx-conf 1.1s ease-out forwards;animation-delay:calc(var(--i)*.02s);--a:calc(var(--i)*30deg)}
.msxfx-confetti i:nth-child(3n){background:#f472b6}.msxfx-confetti i:nth-child(3n+1){background:#7dd3fc}
@keyframes msxfx-conf{0%{opacity:1;transform:rotate(var(--a)) translateY(0)}100%{opacity:0;transform:rotate(var(--a)) translateY(-150px) rotate(220deg)}}
.msxfx-rain i{position:absolute;top:-20%;left:calc(var(--i)*10% + 4%);width:2px;height:40px;background:linear-gradient(#94a3b800,#94a3b8aa);
  animation:msxfx-rain .7s linear infinite;animation-delay:calc(var(--i)*-.07s)}
@keyframes msxfx-rain{to{transform:translateY(140vh)}}
@keyframes msxfx-spin{to{transform:rotate(360deg)}}
@keyframes msxfx-in{from{opacity:0}to{opacity:1}}
@keyframes msxfx-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes msxfx-rise{0%{transform:none;opacity:1}100%{transform:translateY(-8%);opacity:.85;filter:brightness(1.25) drop-shadow(0 0 14px #fbcfe8)}}
/* 動きを減らす: 止まった姿で出す(印とふきだしは出たまま) */
.msxfx-calm,.msxfx-calm *{animation:none!important;transition:none!important}
.msxfx-calm .msxfx-fx i{opacity:1;transform:translateY(-14px)}
.msxfx-calm .msxfx-confetti,.msxfx-calm .msxfx-rain{display:none}
@media (prefers-reduced-motion:reduce){.msxfx-live *,.msxfx-moment *{animation:none!important}.msxfx-fx i{opacity:1}}
`;
let msxFxCssDone = false;
function msxFxEnsureCss() {
  if (msxFxCssDone || typeof document === 'undefined') return;
  try {
    if (!document.getElementById('msxfx-css')) { const el = document.createElement('style'); el.id = 'msxfx-css'; el.textContent = MSXFX_CSS; document.head.appendChild(el); }
    msxFxCssDone = true;
  } catch (_) { /* 見た目だけなので落とさない */ }
}
