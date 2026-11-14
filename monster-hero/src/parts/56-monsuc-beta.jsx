// ===== モンヒロサクセスのβ版(2026-11-13 社長「みゅあだけ解放・β版の始まりの話とチュートリアルを入れる」・台帳 #5964・#5977) =====
// 台本: docs/progress/player-raise/script/beta-mua.js(キズナ・社長「このまま入れる」)。場面:
//   scn.mua.beta.open … はじめて開いたとき(2択)/ scn.mua.beta.firstend … はじめての育成を終えてホームへ戻ったとき
//   tut.lock … 準備中の助手を押したとき(毎回)/ tut.<場面> … 最初の1回だけのみゅあの説明(MSX_BETA_TUT)
// 保存: 新しいキー mh_monsuc_beta_v1 = { v:1, seen:{ 場面の名前: 1 } }(育成をまたぐ・足すだけ。ほかのキーは触らない)
//   読み込みは msxBetaNorm を通す。書けなくても遊びは止めない(次に開いたときにもう一度出るだけ)。
// 公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。公開の印 monheroSuccess はここでは開けない。

const MSX_BETA_KEY = 'mh_monsuc_beta_v1';
// β版で選べる助手(ほかは「準備中」)
const MSX_BETA_AIDS = Object.freeze(['mua']);
const msxBetaAidOk = (aid) => MSX_BETA_AIDS.includes(aid);
// 最初の1回だけ出す説明の名前(台本の tut.<名前>)と、β版の話(scn.mua.beta.<名前>)
const MSX_BETA_TUT = Object.freeze(['scn', 'prep', 'turn', 'train', 'result', 'rest', 'shugyo', 'cup', 'rank', 'meal', 'match', 'rematch', 'event', 'awake', 'retire']);
const MSX_BETA_STORY = Object.freeze(['open', 'firstend', 'start']); // start … 育成の始まりの場面を1回見た(2回目から「とばす」を出す。56-monsuc-intro.jsx)
const msxBetaScene = (k) => (MSX_BETA_STORY.includes(k) ? `scn.mua.beta.${k}` : `tut.${k}`);
const msxBetaKnown = (k) => MSX_BETA_TUT.includes(k) || MSX_BETA_STORY.includes(k);
const msxBetaNorm = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const src = o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen) ? o.seen : {};
  const seen = {}; Object.keys(src).forEach((k) => { if (msxBetaKnown(k) && src[k]) seen[k] = 1; });
  return { v: 1, seen };
};
let msxBetaCache = null; let msxBetaLoading = null; const msxBetaSubs = new Set();
const msxBetaNotify = () => msxBetaSubs.forEach((f) => { try { f((n) => n + 1); } catch (e) { /* 消えた画面 */ } });
const msxBetaLoad = () => {
  if (msxBetaLoading) return msxBetaLoading;
  msxBetaLoading = Promise.resolve(typeof storeGet === 'function' ? storeGet(MSX_BETA_KEY, null) : null)
    .catch(() => null).then((raw) => { msxBetaCache = msxBetaNorm(raw); msxBetaNotify(); return msxBetaCache; });
  return msxBetaLoading;
};
const msxBetaSeen = (k) => !!(msxBetaCache && msxBetaCache.seen[k]);
const msxBetaMark = (k) => {
  if (!msxBetaKnown(k)) return;
  if (!msxBetaCache) { msxBetaLoad().then(() => msxBetaMark(k)); return; }
  if (msxBetaCache.seen[k]) return;
  msxBetaCache = { v: 1, seen: { ...msxBetaCache.seen, [k]: 1 } };
  try { if (typeof storeSet === 'function') Promise.resolve(storeSet(MSX_BETA_KEY, msxBetaCache)).catch(() => {}); } catch (e) { /* 書けなくても遊びは止めない */ }
  msxBetaNotify();
};
// 読み終わったら描き直す(画面を開いた直後はまだ読めていない)
const useMsxBeta = () => {
  const [, setTick] = useState(0);
  useEffect(() => { msxBetaSubs.add(setTick); msxBetaLoad(); return () => { msxBetaSubs.delete(setTick); }; }, []);
  return msxBetaCache;
};

// ---- みゅあの説明の重ね窓 ----
// keys: 出す候補の名前(上から順に、まだ見ていない最初の1つ)。false・null は飛ばす。always: 見た印を見ずに毎回出す(tut.lock)
// ctx: 台本エンジンの差しこみ(callName・mon・bond)。onDone: 閉じたとき
function MsxBetaTalk({ keys, ctx = {}, always = false, onDone }) {
  const beta = useMsxBeta();
  const k = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).find((x) => always || (beta && !beta.seen[x])) || null;
  const [loaded, setLoaded] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null); // 2択で選んだ記号
  useEffect(() => { let alive = true; if (typeof msxScriptLoad === 'function') msxScriptLoad('mua').then(() => { if (alive) setLoaded(true); }); return () => { alive = false; }; }, []);
  useEffect(() => { setI(0); setPicked(null); }, [k]);
  if (!k || (!always && !beta) || !loaded) return null;
  const se = msxSuc && msxSuc.script;
  const c = { ...ctx, aid: 'mua' };
  const evOf = (sc) => { try { return se && typeof se.event === 'function' ? se.event(sc, c) : null; } catch (e) { return null; } };
  const main = evOf(msxBetaScene(k));
  if (!main || !main.lines || !main.lines.length) return null;
  const tail = picked ? evOf(`${msxBetaScene(k)}.${picked}`) : null;
  const lines = main.lines.concat(tail ? tail.lines : [], main.after || []);
  const choices = Array.isArray(main.choices) ? main.choices : [];
  const atChoice = !picked && choices.length > 0 && i >= main.lines.length - 1;
  const l = lines[Math.min(i, lines.length - 1)];
  const close = () => { if (!always) msxBetaMark(k); if (onDone) onDone(k); };
  const next = () => { if (i + 1 >= lines.length) close(); else setI(i + 1); };
  const choose = (cc) => { setPicked(cc); setI(main.lines.length); };
  const narr = l.who === 'narr';
  return (
    <div className="msx-ov msx-fade msx-beta-ov" data-msx-beta={k} onClick={atChoice ? undefined : next}>
      <div className="msx-beta-card" onClick={(e) => { e.stopPropagation(); if (!atChoice) next(); }}>
        <div className="msx-beta-tag">{MSX_BETA_STORY.includes(k) ? 'β版のお話' : 'みゅあの説明'}</div>
        {narr ? <div className="msx-beta-narr">{l.t}</div> : (
          <div className="msx-beta-say"><img className="fc" src={msxFace('mua', l.e || 'happy')} alt=""/><div className="bub"><span className="who">みゅあ</span>{l.t}</div></div>
        )}
        {atChoice ? (
          <div className="msx-beta-opts">{choices.map((ch) => <button type="button" key={ch.c} className="msx-btn go" onClick={(e) => { e.stopPropagation(); choose(ch.c); }}>{ch.t}</button>)}</div>
        ) : <div className="msx-beta-nx">{i + 1 >= lines.length ? '閉じる ▶' : '次へ ▶'}<small>{Math.min(i, lines.length - 1) + 1}/{lines.length}</small></div>}
      </div>
    </div>
  );
}

// タイトルの横の「β」
function MsxBetaMark() { return <span className="msx-beta-mk" data-msx-beta-mark>β</span>; }

const MSX_BETA_CSS = `
.msx .msx-beta-mk{display:inline-block;margin-left:5px;padding:0 6px;border-radius:6px;background:#f472b6;color:#fff;font-size:11px;font-weight:900;line-height:17px;vertical-align:2px;letter-spacing:0}
.msx .msx-beta-ov{z-index:60;align-items:flex-end;padding:14px 12px 22px}
.msx .msx-beta-card{width:100%;max-width:420px;background:#1e1b3a;border:2px solid #f9a8d4;border-radius:14px;padding:10px 12px 8px;box-shadow:0 6px 24px #0008;cursor:pointer}
.msx .msx-beta-tag{display:inline-block;font-size:10px;font-weight:900;color:#1e1b3a;background:#f9a8d4;border-radius:5px;padding:1px 7px;margin-bottom:6px}
.msx .msx-beta-say{display:flex;gap:8px;align-items:flex-start}
.msx .msx-beta-say .fc{width:52px;height:52px;border-radius:50%;object-fit:cover;background:#fff2;flex:0 0 auto}
.msx .msx-beta-say .bub{flex:1 1 0;font-size:13px;font-weight:700;line-height:1.6;text-align:left}
.msx .msx-beta-say .who{display:block;font-size:10px;color:#f9a8d4;font-weight:900}
.msx .msx-beta-narr{font-size:13px;line-height:1.7;color:#e9e5ff;text-align:left;padding:4px 2px}
.msx .msx-beta-nx{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:6px;font-size:12px;font-weight:900;color:#fde68a}
.msx .msx-beta-nx small{color:#a5a3c8;font-weight:700;font-size:12px}
.msx .msx-beta-opts{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.msx .msx-beta-opts .msx-btn{text-align:center}
.msx .v-faces .lk.soon{position:relative}
.msx .v-faces .lk.soon b{position:absolute;left:0;right:0;bottom:-3px;font-size:10px;color:#fde68a;text-align:center;font-weight:900}
`;
