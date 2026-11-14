// ===== モンヒロサクセスの育成の始まりの場面(2026-11-14 社長「始まったときに最初にシナリオ固有のイベントも流して」・案A・r1114-100) =====
// 流れ: 育成を始める(円盤石から生まれる演出)→ この場面 → 1ターン目。毎回の育成で流す。2回目からは「とばす」で飛ばせる。
// 台本: docs/progress/player-raise/script/start-<助手>.js の scn.<助手>.start.*(選択肢なし)。台本が無い助手は何も出さずに1ターン目へ。
// 保存: 「1回見た」の印だけ、β版のキー mh_monsuc_beta_v1 の seen.start に足す(56-monsuc-beta.jsx の msxBetaMark)。育成の保存の形は変えない
//   (phase 'intro' は保存の読み込みで main に戻るので、途中で読み直したときは場面を飛ばして1ターン目から)。

const msxIntroScene = (aid) => `scn.${aid}.start`;

function MsxRunIntro({ run, ctx, onDone }) {
  const s = run.s;
  if (typeof useMsxBeta === 'function') useMsxBeta(); // 「1回見た」の印を読み終わったら描き直す
  const [loaded, setLoaded] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => { let alive = true; Promise.resolve(typeof msxScriptLoad === 'function' ? msxScriptLoad(s.aid) : null).catch(() => null).then(() => { if (alive) setLoaded(true); }); return () => { alive = false; }; }, [s.aid]);
  const se = msxSuc && msxSuc.script;
  let ev = null;
  try { ev = loaded && se && typeof se.event === 'function' ? se.event(msxIntroScene(s.aid), { ...ctx, aid: s.aid }) : null; } catch (e) { ev = null; }
  const lines = ev && Array.isArray(ev.lines) ? ev.lines : [];
  const seenBefore = typeof msxBetaSeen === 'function' && msxBetaSeen('start');
  const finish = () => { if (typeof msxBetaMark === 'function') msxBetaMark('start'); onDone(); };
  // 台本が無いシナリオ(準備中の助手など)は、場面を出さずに1ターン目へ
  useEffect(() => { if (loaded && !lines.length) onDone(); }, [loaded, lines.length]);
  if (!loaded || !lines.length) return <><style>{MSX_INTRO_CSS}</style><div className="v-body"/></>;
  const n = Math.min(i, lines.length - 1);
  const l = lines[n];
  const last = n + 1 >= lines.length;
  const who = l.who === 'narr' ? null : l.who === 'mon' ? run.nick : msxAidName(l.who);
  const next = () => { if (last) finish(); else setI(n + 1); };
  return (<>
    <style>{MSX_INTRO_CSS}</style>
    <div className="v-body msx-intro-body">
      <div className="v-scene msx-intro" style={{ flex: '1 1 0' }} onClick={next} data-msx-intro={n}>
        <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '30%', bottom: 'calc(30% - 5px)' }}/>
        <MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '30%', height: '28%' }} live/>
        <img className="msx-intro-aid" src={msxBody(s.aid, l.who === s.aid ? (l.e || 'happy') : 'happy')} alt=""/>
        <div className="v-ev-h"><small>メインのお話</small>{msxAidName(s.aid)}編のはじまり</div>
        <div className="v-talk msx-intro-talk">{who ? <><span className="who">{who}</span>{`「${l.t}」`}</> : l.t}<small className="pg">{n + 1}/{lines.length}</small></div>
      </div>
    </div>
    <div className="v-ft">
      {seenBefore ? <button type="button" onClick={finish} data-msx-intro-skip>⏩ 飛ばす</button> : null}
      <button type="button" className="go" onClick={next} data-msx-intro-next>{last ? '育成をはじめる ▶' : '次へ ▶'}</button>
    </div>
  </>);
}


const MSX_INTRO_CSS = `
.msx .msx-intro{cursor:pointer}
/* 横画面: ほかの画面の2列の並べ方を使わず、場面を画面いっぱいに。文の窓は右下 */
.msx.land .v-body.msx-intro-body{display:flex;flex-direction:column}
.msx.land .msx-intro{flex:1 1 auto;min-height:0}
.msx.land .msx-intro-talk{left:auto;width:52%}
.msx.land .msx-intro-aid{right:auto;left:48%;width:30%;height:88%;bottom:0}
.msx.land .msx-intro .mon{height:60%!important;bottom:12%!important;left:24%!important}
.msx.land .msx-intro .gr{left:24%!important;bottom:calc(12% - 5px)!important}
.msx .msx-intro-aid{position:absolute;right:-6%;bottom:16%;height:66%;width:62%;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 6px 4px #0008)}
.msx .msx-intro-talk{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;word-break:auto-phrase}
.msx .msx-intro-talk .pg{display:block;text-align:right;font-size:10px;color:#64748b;margin-top:2px}
`;
