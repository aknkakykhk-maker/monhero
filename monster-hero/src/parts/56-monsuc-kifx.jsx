// ===== モンヒロサクセスの期の区切りの演出(2026-11-13 窓口の頼み・参考画像 40・41・112・113・173・176 の流れだけを取り入れる) =====
// 新しい期の1ターン目のターンの区切りで、ふだんの「◯月」の画面の前に1回だけ出す。押すと次の段・とばすで終わり
//   段 0「第◯章 終了/◯◯期」の大きな字・子が大きく立つ(覚醒なら気をまとう)・下に獲得賞金と総合力(期のはじめからの増えた分)
//   段 1「NEXT あと◯ターン」と期のはしご(終わった期 ✓・次 ▶・最上段は最後の大会「頂への道」で金色)
// ki = 期のはじめの控え { p, fame, power }(run.ki・無ければ増えた分を出さない)。何も保存しない(控えの書きかえは呼ぶ側)
// 「動きを減らす」設定では動かさず、段は押して進める
const MSX_KI_CHAPTER = Object.freeze(['第一章', '第二章', '第三章', '第四章', '最終章']);
const MSX_KI_MS = Object.freeze([2600, 2600]);
const msxKiCalm = () => typeof msxFxCalm === 'function' && msxFxCalm();

function MsxKiShow({ run, v, ev, ki, onDone }) {
  msxKiEnsureCss();
  const calm = msxKiCalm();
  const P = msxSuc.core.PERIODS;
  const now = v.period.index; const prev = Math.max(0, now - 1);
  const [st, setSt] = React.useState(0);
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  const step = () => { if (st >= 1) finish(); else setSt(1); };
  React.useEffect(() => {
    if (calm) return undefined;
    const id = setTimeout(step, MSX_KI_MS[st] || 2600);
    return () => clearTimeout(id);
  }, [st]);
  // 段ごとの音(2026-11-14。「第◯章 終了」の音と曲は場面の音 kiShow が鳴らす)
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(st === 1 ? [['kiNext', 0]] : [], [st]);
  const s = run.s;
  const fame = Number.isFinite(s.fameTotal) ? s.fameTotal : 0;
  const has = ki && ki.p === prev && Number.isFinite(ki.fame) && Number.isFinite(ki.power);
  const dFame = has ? fame - ki.fame : null; const dPow = has ? ev.power - ki.power : null;
  const isFinal = P[now] && P[now].key === 'final';
  // 次の段までのターン: ふつうの期は期の長さ・最後の期は頂への道(3ターン目から)まで
  const left = isFinal ? 2 : v.period.left;
  const sign = (n) => (n >= 0 ? `+${msxFmt(n)}` : `−${msxFmt(-n)}`);
  // はしご: 上から 頂への道(金)→ プロ期 → … → デビュー期
  const rungs = P.map((p, i) => ({ i, name: p.key === 'final' ? '頂への道' : p.name, gold: p.key === 'final', state: i < now ? 'done' : i === now ? 'next' : 'later' })).reverse();
  return (
    <div className={`v-scene msx-ki st${st}`} style={{ flex: '1 1 0' }} onClick={step} data-msx-ki={st}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <span className="msx-ki-dim" aria-hidden="true"/>
      {s.awake ? <span className={`msx-ki-aura k${s.awake}`} aria-hidden="true"/> : null}
      <MsxMonArt run={run} className="mon msx-ki-mon" style={st === 0 ? { bottom: '25%', height: '52%' } : { bottom: '2%', height: '62%' }} live/>
      {st === 0 ? (<>
        <div className="msx-ki-ttl" key="t0"><b>{MSX_KI_CHAPTER[prev]} 終了</b><span>{P[prev].name}</span></div>
        <div className="msx-ki-sum" key="s0">
          <div className="h">獲得賞金</div>
          <div className="v-num r"><b>{msxFmt(fame)}<small>G</small>{dFame != null ? <em className={dFame < 0 ? 'dn' : ''}>{sign(dFame)}G</em> : null}</b></div>
          <div className="h">総合力</div>
          <div className="v-num r"><b>{msxFmt(ev.power)}{dPow != null ? <em className={dPow < 0 ? 'dn' : ''}>{sign(dPow)}</em> : null}</b></div>
        </div>
      </>) : (<>
        <div className="msx-ki-next" key="t1"><small>NEXT</small><div><span>あと</span><b>{left}</b><span className="tn">ターン</span></div></div>
        <div className="msx-ki-lad" key="l1">
          {rungs.map((r, j) => (<React.Fragment key={r.i}>
            {j ? <i className="up" aria-hidden="true">▲</i> : null}
            <div className={`rg ${r.state}${r.gold ? ' gold' : ''}`} style={{ '--j': rungs.length - 1 - j }}>
              <span className="mk">{r.state === 'done' ? '✓' : r.state === 'next' ? '▶' : ''}</span>{r.name}
            </div>
          </React.Fragment>))}
        </div>
      </>)}
      <div className="msx-ki-tap">TAP</div>
    </div>
  );
}

const MSX_KI_CSS = `
.msx .msx-ki{cursor:pointer;overflow:hidden}
.msx .msx-ki-dim{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(15,13,36,.35),rgba(15,13,36,0) 30%,rgba(15,13,36,0) 60%,rgba(15,13,36,.55))}
.msx .msx-ki.st1 .msx-ki-dim{background:rgba(15,13,36,.55)}
.msx .msx-ki .msx-ki-mon{z-index:2;transition:bottom .4s,height .4s}
.msx .msx-ki.st1 .msx-ki-mon{opacity:.45;filter:blur(1px)}
.msx .msx-ki-aura{position:absolute;left:50%;bottom:20%;width:86%;height:66%;transform:translateX(-50%);z-index:1;border-radius:50%;background:radial-gradient(ellipse at 50% 60%,rgba(253,224,71,.55),rgba(251,146,60,.25) 45%,transparent 70%);animation:msxKiAura 1.2s ease-in-out infinite alternate;pointer-events:none}
.msx .msx-ki-aura.k2{background:radial-gradient(ellipse at 50% 60%,rgba(244,114,182,.55),rgba(96,165,250,.3) 45%,transparent 70%)}
.msx .msx-ki-ttl{position:absolute;left:0;right:0;top:5%;z-index:4;text-align:center;animation:msxKiDrop .45s cubic-bezier(.2,1.3,.4,1) both}
.msx .msx-ki-ttl b{display:inline-block;font-size:40px;font-weight:900;letter-spacing:.06em;line-height:1.1;color:#fde047;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 4px 0 #7c2d12,0 0 18px #fb923c88;padding:2px 14px;border-radius:10px;background:linear-gradient(180deg,#fff7c288,#f59e0b33);border:2px solid #fde68a}
.msx .msx-ki-ttl span{display:block;margin:6px auto 0;width:78%;font-size:15px;font-weight:900;color:#fff;background:linear-gradient(90deg,transparent,#0f0d24dd 15%,#0f0d24dd 85%,transparent);padding:3px 0}
.msx .msx-ki-sum{position:absolute;left:10px;right:10px;bottom:10px;z-index:4;background:#0f0d24e6;border:1.5px solid #64748b;border-radius:12px;padding:6px 14px 8px;animation:msxKiUp .45s ease-out .35s both}
.msx .msx-ki-sum .h{font-size:11px;font-weight:900;color:#e2e8f0;text-align:center;display:flex;align-items:center;gap:8px}
.msx .msx-ki-sum .h::before,.msx .msx-ki-sum .h::after{content:'';flex:1;border-top:1px dashed #94a3b8}
.msx .msx-ki-sum .r{margin:1px 0 3px}
.msx .msx-ki-sum .r>b{font-size:26px;color:#fff}
.msx .msx-ki-sum .r>b>em{font-size:15px}
.msx .msx-ki-sum small{font-size:.6em;margin-left:2px}
.msx .msx-ki-next{position:absolute;left:0;right:0;top:4%;z-index:4;text-align:center;color:#fde047;font-weight:900;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 4px 0 #7c2d12;animation:msxKiDrop .45s cubic-bezier(.2,1.3,.4,1) both}
.msx .msx-ki-next small{display:block;font-size:34px;font-style:italic;letter-spacing:.08em;line-height:1}
.msx .msx-ki .msx-ki-next div{display:flex;justify-content:center;align-items:baseline;gap:8px;font-size:22px;line-height:1.1;margin-top:2px}
.msx .msx-ki .msx-ki-next div b{display:block;flex:none;width:auto;min-width:max-content;font-size:64px;line-height:1;letter-spacing:0;margin:0}
.msx .msx-ki .msx-ki-next div span{flex:none;white-space:nowrap}
/* 場面が低いとき(幅320で大きい文字など)は NEXT の字を一段小さくして、下のはしごにかからないようにする */
.msx .v-scene.msx-ki{container-type:size}
@container (max-height:330px){.msx .msx-ki .msx-ki-next small{font-size:24px}.msx .msx-ki .msx-ki-next div{font-size:17px}.msx .msx-ki .msx-ki-next div b{font-size:44px}}
.msx .msx-ki .msx-ki-next div span.tn{margin-left:10px}
.msx .msx-ki-lad{position:absolute;left:0;right:0;top:36%;z-index:4;display:flex;flex-direction:column;align-items:center;gap:1px}
.msx .msx-ki-lad .up{font-style:normal;font-size:10px;line-height:10px;color:#e2e8f0aa}
.msx .msx-ki-lad .rg{position:relative;width:62%;min-height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#e2e8f0;background:#334155e6;border:1.5px solid #64748b;border-radius:8px;text-align:center;animation:msxKiUp .35s ease-out both;animation-delay:calc(.15s + var(--j) * .08s)}
.msx .msx-ki-lad .rg .mk{position:absolute;left:10px;font-size:14px;color:#f87171}
.msx .msx-ki-lad .rg.done{opacity:.85}
.msx .msx-ki-lad .rg.next{background:#e0f2fe;color:#0f172a;border-color:#7dd3fc;box-shadow:0 0 12px #7dd3fc}
.msx .msx-ki-lad .rg.next .mk{left:-18px;color:#fde047;text-shadow:0 0 6px #000}
.msx .msx-ki-lad .rg.gold{min-height:36px;background:linear-gradient(180deg,#fde68a,#d97706);color:#3b1d05;border-color:#fef3c7;box-shadow:0 0 14px #fbbf2499}
.msx .msx-ki-lad .rg.gold.next{box-shadow:0 0 18px #fde047,0 0 4px #fff}
.msx .msx-ki-tap{position:absolute;right:10px;bottom:4px;z-index:5;font-size:11px;font-weight:900;color:#e2e8f0aa;letter-spacing:.1em}
.msx .msx-ki.st0 .msx-ki-tap{bottom:auto;top:6px}
@keyframes msxKiDrop{from{opacity:0;transform:translateY(-18px) scale(.85)}to{opacity:1;transform:none}}
@keyframes msxKiUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes msxKiAura{from{opacity:.6;transform:translateX(-50%) scale(.96)}to{opacity:1;transform:translateX(-50%) scale(1.04)}}
@media (prefers-reduced-motion: reduce){.msx .msx-ki *{animation:none!important;transition:none!important}}
`;
let msxKiCssDone = false;
const msxKiEnsureCss = () => {
  if (msxKiCssDone || typeof document === 'undefined') return;
  msxKiCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-ki-css', '1'); el.textContent = MSX_KI_CSS; document.head.appendChild(el);
};
