// ===== モンヒロサクセス: 自分で操作するバトル(手番ごとに手を選ぶ帯)=====
// 2026-11-12 社長「モンサクは自分操作にして」(台帳 #5751)・「ガッツを消費して戦う。ターンごとに攻撃したり防御したり移動したりガッツ回復したり」。
// 計算は芯 ASSISTANT_MASMON_BATTLE.createMatch(docs/spec/ASSISTANT_MASMON_BATTLE.md「自分で操作する試合」)。
// ここは画面の部品だけ: 試合を進める useMsxManualMatch と、4つの見出し(攻撃・防御・移動・ガッツ回復)+交代の帯 MsxManualBar。
// 観戦の画面(ambwFramesOf・AmbwPanel)は m.log をそのまま読める。保存は「種+手の列(choices)」だけで足りる(replay で同じ所まで進む)。
// 公開の印 monheroSuccess(偽)の後ろで使う。この部品は単独では画面に出ない。
const MSX_MANUAL_DIST = ['零', '近', '中', '遠'];
const MSX_MANUAL_CSS = `
.msxm{background:#1e1a36;border:1px solid #f472b6aa;border-radius:14px;padding:9px;margin-top:8px;color:#fff;font-weight:700}
.msxm-top{display:flex;align-items:center;gap:8px;font-size:12px;color:#f9a8d4}
.msxm-top b{color:#fff}
.msxm-g{flex:1;height:8px;border-radius:8px;background:#334155;overflow:hidden}.msxm-g i{display:block;height:100%;background:linear-gradient(90deg,#fde047,#facc15)}
.msxm-sec{margin-top:8px}
.msxm-h{font-size:11.5px;color:#cbd5e1;margin-bottom:4px}
.msxm-row{display:flex;flex-wrap:wrap;gap:6px}
.msxm-btn{flex:1 1 46%;min-height:44px;border-radius:11px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:13px;padding:6px 8px;text-align:left;line-height:1.25}
.msxm-btn small{display:block;font-size:10.5px;color:#cbd5e1;font-weight:700}
.msxm-btn:disabled{opacity:.38}
.msxm-btn.hint{border-color:#fde047;box-shadow:0 0 0 1px #fde04766 inset}
.msxm-btn.atk{background:#3a2448;border-color:#f472b6aa}
.msxm-none{font-size:11px;color:#94a3b8}
.msxm-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px}
.msxm-auto{border-radius:99px;border:1px solid #64748b;background:#0f172a;color:#e2e8f0;font-size:12px;padding:6px 14px;font-weight:900}
.msxm-swap{font-size:11px}
`;

// 試合を作る(手の列があれば、その所まで進めた試合)。芯が無い・古いときは null
const msxManualOpen = (engine, input, choices) => {
  if (!engine || typeof engine.createMatch !== 'function' || !input) return null;
  try {
    const inp = { ...input, control: { A: 'human' } };
    if (Array.isArray(choices) && choices.length && typeof engine.replay === 'function') {
      const r = engine.replay(inp, choices);
      return r && r.match ? r.match : null;   // 途中で合わない手があっても、合う所までは進んでいる
    }
    return engine.createMatch(inp);
  } catch (e) { return null; }
};

// 進め方のフック。input が変わったら作り直す(key で渡す)
function useMsxManualMatch(engine, input, choices, key) {
  const [match, setMatch] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { setMatch(msxManualOpen(engine, input, choices)); setTick(0); }, [engine, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((c) => {
    if (!match) return false;
    const r = match.choose(c);
    if (r && r.ok) setTick((t) => t + 1);
    return !!(r && r.ok);
  }, [match]);
  const toAuto = useCallback(() => { if (!match) return; match.auto('A'); setTick((t) => t + 1); }, [match]);
  const log = match ? match.log.slice() : [];
  return { match, tick, log, pending: match ? match.pending() : null, done: !!(match && match.done()), result: match ? match.result() : null,
    choices: match ? match.choices() : [], pick, toAuto };
}

// 手を選ぶ帯。opt = match.pending()。busy の間(相手の手を見せている間)は押せない
function MsxManualBar({ opt, onPick, onAuto, busy }) {
  if (!opt) return null;
  const isHint = (c) => !!(opt.hint && opt.hint.type === c.type && (c.key == null || opt.hint.key === c.key) && (c.step == null || opt.hint.step === c.step) && (c.to == null || opt.hint.to === c.to));
  const go = (c) => { if (!busy && onPick) onPick(c); };
  if (opt.kind === 'enter') {
    return (
      <div className="msxm" data-msxm="enter"><style>{MSX_MANUAL_CSS}</style>
        <div className="msxm-h">次に出すモンスターを選んでください</div>
        <div className="msxm-row">{opt.enter.map((x) => (
          <button key={x.to} type="button" className="msxm-btn" disabled={!x.ok || busy} onClick={() => go({ type: 'enter', to: x.to })}>
            {x.name}<small>ライフ {x.hp}/{x.maxHp}</small>
          </button>
        ))}</div>
      </div>
    );
  }
  const reach = opt.tech.filter((t) => t.reach);
  return (
    <div className="msxm" data-msxm="act"><style>{MSX_MANUAL_CSS}</style>
      <div className="msxm-top">
        <span>あなたの番</span>
        <b>間合い {MSX_MANUAL_DIST[opt.dist]}</b>
        <div className="msxm-g"><i style={{ width: `${Math.max(0, Math.min(100, opt.guts))}%` }}/></div>
        <b>ガッツ {Math.round(opt.guts)}</b>
      </div>
      <div className="msxm-sec">
        <div className="msxm-h">⚔ 攻撃</div>
        {reach.length ? (
          <div className="msxm-row">{reach.map((t) => (
            <button key={t.key} type="button" className={`msxm-btn atk ${isHint(t) ? 'hint' : ''}`} disabled={!t.ok || busy} data-msxm-tech={t.key} onClick={() => go({ type: 'tech', key: t.key })}>
              {t.kind === 'pow' ? '💪' : '🧠'}{t.name}
              <small>{t.ok ? `ガッツ${t.guts}・命中${Math.round(t.p)}%` : `ガッツ${t.guts}(あと${t.need})`}</small>
            </button>
          ))}</div>
        ) : <div className="msxm-none">この間合いでは届く技がありません</div>}
      </div>
      <div className="msxm-sec">
        <div className="msxm-h">🛡 防御・↔ 移動・💪 ガッツ回復</div>
        <div className="msxm-row">
          <button type="button" className={`msxm-btn ${isHint(opt.guard) ? 'hint' : ''}`} disabled={busy} onClick={() => go({ type: 'guard' })}>🛡 ガード<small>受けるダメージを減らす</small></button>
          <button type="button" className={`msxm-btn ${isHint(opt.charge) ? 'hint' : ''}`} disabled={!opt.charge.ok || busy} onClick={() => go({ type: 'charge' })}>💪 ためる<small>{opt.charge.ok ? 'ガッツを大きく回復' : 'ガッツは満タン'}</small></button>
          {opt.move.map((mv) => (
            <button key={mv.step} type="button" className={`msxm-btn ${isHint(mv) ? 'hint' : ''}`} disabled={!mv.ok || busy} onClick={() => go({ type: 'move', step: mv.step })}>
              {mv.step < 0 ? '◀ 前へ' : '後ろへ ▶'}<small>{mv.ok ? `→ ${MSX_MANUAL_DIST[mv.to]}` : 'これ以上は行けない'}</small>
            </button>
          ))}
        </div>
      </div>
      {opt.swap.length ? (
        <div className="msxm-sec">
          <div className="msxm-h">🔁 交代{opt.swapWait > 0 ? `(あと${opt.swapWait}手番)` : ''}</div>
          <div className="msxm-row">{opt.swap.map((s) => (
            <button key={s.to} type="button" className={`msxm-btn msxm-swap ${isHint(s) ? 'hint' : ''}`} disabled={!s.ok || busy} onClick={() => go({ type: 'swap', to: s.to })}>
              {s.name}<small>ライフ {s.hp}/{s.maxHp}</small>
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="msxm-foot">
        <span className="msxm-none">{opt.hint ? '黄色のふちは助手のおすすめ' : ''}</span>
        {onAuto ? <button type="button" className="msxm-auto" onClick={() => !busy && onAuto()}>オートにする</button> : null}
      </div>
    </div>
  );
}
