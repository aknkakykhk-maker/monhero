// ===== モンヒロサクセス: 試合の画面 MonsucArena(2026-11-12 社長「モンサクは自分操作にして」) =====
// 社長「バトルはモンバトやバトルカードの画面をある程度流用して、距離とかうまく使ったほうがいい。攻撃アクションとかもそのまま使えるはず」。
//   ・場は横長。手前の子(A)が左・相手(B)が右に立ち、距離 零・近・中・遠 の4つの立ち位置で、実際に間が開いたり詰まったりする
//   ・技の動きは 24-battle-fx.jsx の SkillFxMotion・SKILL_MOTION_SETS をそのまま使う(新しい動きは作らない)。
//     モンヒロに同じ名前の技があればその子の動き、無ければカードバトルと同じ決まった動き(85 の cardMotionTiered)
//   ・受ける・防ぐ・よける・倒れるは、カードバトルの CSS(mh-card-hit / guard / dodge / ko)。止まっている間は待機アニメ(withMonsterIdleArt)
//   ・自分で操作する試合は、芯 createMatch を進める useMsxManualMatch と帯 MsxManualBar(56-monhero-success-manual.jsx)を下に差す。
//     手を選ぶ → 伸びた記録(自分の手 → 相手の手)を1行ずつ見せる → 見せ終わったら次の手番(見せている間、帯は押せない)
//   ・記録だけ渡されたとき(回3の結果・オート)は、同じ画面で記録を再生する
//   ・動きを減らす設定(端末の prefers-reduced-motion)では、技の動き・揺れ・間合いの移動を止め、1行の間も短くする
// 計算・保存には触れない(勝ち負けを onEnd で返すだけ)。公開の印 monheroSuccess の後ろで使う。
const MSA_GAP = [0.13, 0.32, 0.5, 0.68];            // 距離ごとの、2体の間(場の幅に対する割合)。零は触れ合うほど
const MSA_SPEEDS = Object.freeze([{ id: 'x1', label: '×1', f: 1 }, { id: 'x2', label: '×2', f: 0.55 }, { id: 'x4', label: '×4', f: 0.3 }]);
const MSA_CSS = `
.msa{display:flex;flex-direction:column;gap:6px}
.msa-stage{position:relative;height:clamp(200px,34vh,290px);border-radius:16px;overflow:hidden;background:#2a2147 center/cover no-repeat}
.msa-stage::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,38,.05),rgba(20,16,38,.5));pointer-events:none}
.msa-floor{position:absolute;left:4%;right:4%;bottom:30px;height:2px;background:linear-gradient(90deg,#fff0,#ffffff55 20%,#ffffff55 80%,#fff0);z-index:1}
.msa-spot{position:absolute;bottom:23px;width:16px;height:16px;margin-left:-8px;border-radius:50%;border:2px solid #ffffff40;background:#0f0b2280;z-index:1;transition:all .35s}
.msa-spot.on{border-color:#fde047;background:#fde04766;box-shadow:0 0 10px #fde047aa}
.msa-f{position:absolute;bottom:30px;width:96px;margin-left:-48px;height:120px;display:flex;align-items:flex-end;justify-content:center;z-index:3;transition:left .45s cubic-bezier(.3,.8,.4,1)}
.msa-f.act{z-index:6}
.msa-f img.msa-img{max-width:96px;max-height:112px;object-fit:contain;filter:drop-shadow(0 6px 5px rgba(0,0,0,.55))}
.msa-f .msa-flip{transform:scaleX(-1)}
.msa-f .msa-shadow{position:absolute;bottom:-5px;left:50%;width:62px;height:11px;margin-left:-31px;border-radius:50%;background:#0008;z-index:-1}
.msa-f.down img.msa-img{filter:grayscale(1) brightness(.6)}
.msa-dmg{position:absolute;z-index:8;top:24%;left:50%;width:130px;margin-left:-65px;text-align:center;font-size:30px;font-weight:900;color:#fde047;line-height:.95;text-shadow:0 2px 0 #b91c1c,0 0 8px #f97316;animation:msaPop .55s ease-out both;pointer-events:none}
.msa-dmg small{display:block;font-size:12px;color:#fff;margin-bottom:2px}
.msa-dmg.miss{color:#e2e8f0;font-size:20px;text-shadow:0 2px 0 #0f172a}
.msa-tag{position:absolute;z-index:8;top:-4px;left:50%;transform:translateX(-50%);white-space:nowrap;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#0f172acc;border:1px solid #fde04788;color:#fde68a;animation:msaPop .4s ease-out both}
.msa-charge{animation:msaCharge .7s ease-out both}
.msa-aura{position:absolute;left:50%;bottom:0;width:90px;height:90px;margin-left:-45px;border-radius:50%;background:radial-gradient(circle,#fde04788 0,#f9731644 45%,#f9731600 70%);animation:msaAura .7s ease-out both;z-index:-1;pointer-events:none}
.msa-sulk{animation:msaSulk .7s ease-in-out both}
.msa-step{animation:msaStep .45s ease-out both}
.msa-in{animation:msaIn .45s ease-out both}
.msa-dist{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;gap:5px;z-index:2}
.msa-dist span{font-size:11px;font-weight:900;padding:1px 9px;border-radius:99px;background:#0f0b2299;color:#94a3b8;transition:all .3s}
.msa-dist span.cur{background:#fde047;color:#422006}
.msa-round{position:absolute;left:8px;top:6px;z-index:2;font-size:11px;font-weight:900;color:#fde68a;background:#0f0b2299;border-radius:99px;padding:1px 8px}
.msa-say{min-height:22px;font-size:12.5px;font-weight:800;text-align:center;color:#fff}
.msa-tools{display:flex;gap:5px;align-items:center}
.msa-tools button{flex:1;min-height:34px;border-radius:10px;border:1px solid #4c4680;background:#2b2650;color:#fff;font-weight:900;font-size:12px}
.msa-tools button.on{background:#fde047;color:#422006;border-color:#fde047}
.msa-wait{font-size:11.5px;color:#cbd5e1;text-align:center}
@keyframes msaPop{0%{opacity:0;transform:translateY(10px) scale(.7)}35%{opacity:1;transform:translateY(-4px) scale(1.12)}100%{opacity:1;transform:translateY(-12px) scale(1)}}
@keyframes msaCharge{0%,100%{transform:none}30%{transform:translateY(4px) scale(1.05,.92)}60%{transform:translateY(-6px) scale(.97,1.06)}}
@keyframes msaAura{0%{opacity:0;transform:scale(.4)}40%{opacity:1}100%{opacity:0;transform:scale(1.5)}}
@keyframes msaSulk{0%,100%{transform:none}30%,70%{transform:rotate(-8deg) translateX(-4px)}}
@keyframes msaStep{0%{transform:none}45%{transform:translateY(-14px)}100%{transform:none}}
@keyframes msaIn{0%{opacity:0;transform:translateY(16px) scale(.8)}100%{opacity:1;transform:none}}
@media (max-height:420px) and (orientation:landscape){.msa-stage{height:180px}.msa-f{height:100px}.msa-f img.msa-img{max-height:92px}}
@media (prefers-reduced-motion: reduce){
  .msa *,.msa *::before,.msa *::after{animation:none!important;transition:none!important}
}
`;

const msaReduce = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
};

// 技 → SkillFxMotion の動きの名前。① モンヒロに同じ名前の技(SKILL_MOTION_SETS の通常技・固有技) ② カードバトルと同じ決まった動き
const msaMotionKind = (species, tech) => {
  if (!tech) return null;
  const has = (k) => (typeof skillFxSpecOf === 'function' && skillFxSpecOf(k) ? k : null);
  const names = typeof HERO_ATK_NAMES !== 'undefined' ? HERO_ATK_NAMES[species] : null;
  const set = typeof SKILL_MOTION_SETS !== 'undefined' ? SKILL_MOTION_SETS[species] : null;
  const i = Array.isArray(names) ? names.indexOf(tech.name) : -1;
  if (i >= 0 && set && set.normal && set.normal[i] && set.normal[i] !== SKM_SIG) { const k = has(`${species}-n${i}`); if (k) return k; }
  const u = typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[species] ? ALL_PLAYER_MONSTERS[species].unique : null;
  const ui = u && Array.isArray(u.names) ? u.names.indexOf(tech.name) : -1;
  if (ui >= 0 && set && set.unique && set.unique[ui] && set.unique[ui] !== SKM_SIG) { const k = has(`${species}-u${ui}`); if (k) return k; }
  const base = tech.kind === 'pow' ? 'cardBash' : 'cardOrb';
  const g = Number(tech.guts) || 0;
  const tier = g >= 40 ? 'L' : g >= 25 ? 'M' : 'S';
  return has(typeof cardMotionTiered === 'function' ? cardMotionTiered(base, tier) : base) || has(base);
};
const msaMotionMs = (kind) => {
  const sp = kind && typeof skillFxSpecOf === 'function' ? skillFxSpecOf(kind) : null;
  return { ms: (sp && sp.ms) || 650, hit: (sp && sp.hit) || 300 };
};

// 1行を見せる長さ(ミリ秒・×1)。技は動きの長さ+数字を読む間
const msaStepMs = (e, team, reduce) => {
  if (!e) return 300;
  if (reduce) return e.ev === 'tech' ? 900 : e.ev === 'start' || e.ev === 'enter' ? 250 : 650;
  if (e.ev === 'tech') { const m = (team && team.members && team.members[e.i]) || {}; return msaMotionMs(msaMotionKind(m.species, { name: e.name, kind: e.kind, guts: e.guts })).ms + 520; }
  return { start: 700, enter: 350, move: 650, guard: 750, charge: 800, swap: 700, ko: 1100, end: 600 }[e.ev] || 500;
};

// 実況の1行
const msaSay = (e, nm) => {
  if (!e) return '';
  if (e.ev === 'tech') return e.hit ? `${nm(e.side, e.i)}の ${e.name}!${e.crit ? ' 会心の一撃!' : e.guarded ? ' …ガードされた' : ''}` : `${nm(e.side, e.i)}の ${e.name} … よけられた`;
  if (e.ev === 'move') return `${nm(e.side, e.i)}が ${AMBW_DIST[e.to] || ''}の間合いへ`;
  if (e.ev === 'charge') return e.why === 'sulk' ? `${nm(e.side, e.i)}は そっぽを向いた…` : `${nm(e.side, e.i)}は ガッツをためた`;
  if (e.ev === 'guard') return `${nm(e.side, e.i)}は 身を守った`;
  if (e.ev === 'swap') return `${nm(e.side, e.i)}に 交代!`;
  if (e.ev === 'ko') return `${e.name} は たおれた`;
  if (e.ev === 'start') return '試合開始!';
  return '';
};

// ---- 場の1体 ----
function MsaFighter({ side, member, x, e, foeX, hpNow, reduce, idleOk }) {
  const sp = member ? member.species : '';
  const src = mscMonImg(sp);
  const img = <img className={`msa-img ${side === 'A' ? 'msa-flip' : ''}`} src={src} alt={member ? member.name : ''} draggable={false}/>;
  const down = hpNow <= 0;
  const me = e && e.side === side;
  const foe = e && e.side && e.side !== side;
  const tech = e && e.ev === 'tech';
  let body = null; let cls = ''; const extra = [];
  let style = { left: `${x * 100}%` };
  if (tech && me && !reduce) {
    // 攻める: 相手の位置まで(--atk-dx)。モンヒロのバトルと同じ動き
    const kind = msaMotionKind(sp, { name: e.name, kind: e.kind, guts: e.guts });
    if (kind) {
      const w = foeX.w; const dx = (foeX.x - x) * w;
      style = { ...style, ...(typeof attackAimVars === 'function' ? attackAimVars(dx, -8) : { '--atk-dx': `${Math.round(dx)}px`, '--atk-dy': '-8px' }) };
      body = <SkillFxMotion key={`m-${e.k}`} kind={kind} image={img}/>;
    }
  }
  if (tech && foe) {
    const hit = msaMotionMs(msaMotionKind(e.atkSp, { name: e.name, kind: e.kind, guts: e.guts })).hit;
    const delay = reduce ? 0 : hit;
    const pose = !e.hit ? 'mh-card-dodge' : e.guarded ? 'mh-card-guard' : 'mh-card-hit';
    body = <div key={`p-${e.k}`} className={`flex items-end justify-center ${pose}`} style={{ animationDelay: `${delay}ms` }}>{img}</div>;
    if (e.guarded && e.hit) extra.push(<span key="s" className="mh-card-shield" aria-hidden="true" style={{ animationDelay: `${delay}ms` }}/>);
    extra.push(e.hit
      ? <div key={`d-${e.k}`} className="msa-dmg" data-msa-dmg={e.dmg} style={{ animationDelay: `${delay}ms` }}>{e.crit ? <small>会心!</small> : e.guarded ? <small>ガード!</small> : null}−{e.dmg}</div>
      : <div key={`d-${e.k}`} className="msa-dmg miss" style={{ animationDelay: `${delay}ms` }}>よけた!</div>);
  }
  if (me && e.ev === 'guard') { cls = 'mh-card-guard'; extra.push(<span key="s" className="mh-card-shield" aria-hidden="true"/>); }
  if (me && e.ev === 'charge') {
    if (e.why === 'sulk') { cls = 'msa-sulk'; extra.push(<span key="t" className="msa-tag">そっぽ…</span>); }
    else { cls = 'msa-charge'; extra.push(<span key="a" className="msa-aura" aria-hidden="true"/>, <span key="t" className="msa-tag">ガッツ +</span>); }
  }
  if (me && e.ev === 'move') cls = 'msa-step';
  if (me && (e.ev === 'swap' || e.ev === 'enter')) cls = 'msa-in';
  if (down) cls = e && e.ev === 'ko' && e.side === side ? 'mh-card-ko' : '';
  if (!body) {
    const still = !cls && !down && idleOk && !reduce && typeof withMonsterIdleArt === 'function' ? withMonsterIdleArt(sp, img) : img;
    body = <div key={`b-${e ? e.k : 0}-${cls}`} className={`flex items-end justify-center ${cls}`}>{still}</div>;
  }
  return (
    <div className={`msa-f ${down ? 'down' : ''} ${tech && me ? 'act' : ''}`} style={style} data-msa-fighter={side}>
      <span className="msa-shadow" aria-hidden="true"/>
      {body}
      {extra}
    </div>
  );
}

// ---- 試合の画面 ----
//   input … 芯 createMatch に渡す入力(simulate と同じ形)。あれば自分で操作する
//   watch … { r, teamA, teamB }(記録だけ。オートの結果を見せる)
//   onEnd(won, { choices, auto }) … 決着を見せ終わったら1回だけ
function MonsucArena({ s, info, engine, input, watch, onEnd }) {
  const reduce = useMemo(() => msaReduce(), []);
  const manual = Boolean(input && engine && typeof engine.createMatch === 'function');
  const mm = useMsxManualMatch(manual ? engine : null, manual ? input : null, null, info.seed);
  const log = manual ? mm.log : (watch && watch.r && Array.isArray(watch.r.log) ? watch.r.log : []);
  const teams = manual ? { A: input.teamA, B: input.teamB } : { A: watch && watch.teamA, B: watch && watch.teamB };
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('x1');
  const [auto, setAuto] = useState(!manual);
  const [ended, setEnded] = useState(false);
  const [stageW, setStageW] = useState(340);
  const stageRef = useRef(null);
  const endRef = useRef(false);
  useEffect(() => {
    const el = stageRef.current; if (!el) return undefined;
    const fit = () => setStageW(el.clientWidth || 340);
    fit();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  const frames = useMemo(() => (log.length ? ambwFramesOf(log) : []), [log.length, manual ? mm.tick : 0]);
  const last = log.length - 1;
  const done = manual ? mm.done : log.length > 0;
  const result = manual ? mm.result : (watch && watch.r) || null;
  const busy = pos < last;
  // 1行ずつ進める。追いついたら、手番を待つ(自分操作)か、決着を見せる
  useEffect(() => {
    if (!log.length || ended) return undefined;
    if (pos < last) {
      const cur = log[pos] || {};
      const sp = MSA_SPEEDS.find(x => x.id === speed) || MSA_SPEEDS[0];
      const t = setTimeout(() => setPos(p => Math.min(last, p + 1)), Math.round(msaStepMs(cur, teams[cur.side], reduce) * sp.f));
      return () => clearTimeout(t);
    }
    if (done) { const t = setTimeout(() => setEnded(true), reduce ? 300 : 900); return () => clearTimeout(t); }
    return undefined;
  }, [pos, last, speed, done, ended]);
  const won = Boolean(result && result.winner === 'A');
  // 手を選ぶ帯が出たら、帯が見える所まで入れ物(縦にだけ動く)を送る(横向きでは場の下に隠れるため)。横へは動かさない
  const barRef = useRef(null);
  const barOn = Boolean(manual && !auto && pos >= last && !ended && mm.pending);
  useEffect(() => {
    const el = barRef.current; if (!barOn || !el) return;
    const box = el.closest ? el.closest('[data-msc-root]') : null; if (!box) return;
    const r = el.getBoundingClientRect(); const b = box.getBoundingClientRect();
    const over = r.bottom - b.bottom + 8;
    if (over > 0) box.scrollTop += Math.min(over, Math.max(0, r.top - b.top - 8));
  }, [barOn, pos]);
  useEffect(() => {
    if (!ended || endRef.current) return undefined;
    const t = setTimeout(() => { if (endRef.current) return; endRef.current = true; if (onEnd) onEnd(won, { choices: manual ? mm.choices : null, auto, result }); }, 1500);
    return () => clearTimeout(t);
  }, [ended]);
  if (!log.length) return <div className="msc-wrap"><p className="msc-note" style={{ textAlign: 'center', marginTop: 40 }}>試合の準備をしています…</p></div>;
  const f = frames[Math.min(pos, frames.length - 1)] || frames[0];
  const e0 = log[pos] || {};
  const st = log[0] || {};
  const maxHp = { A: st.aHp || [], B: st.bHp || [] };
  const memberOf = (side, i) => { const t = teams[side]; const ms = (t && t.members) || []; return ms[Number.isFinite(i) ? i : f.act[side]] || ms[0] || null; };
  const nm = (side, i) => { const m = memberOf(side, i); return (m && m.name) || ''; };
  const e = { ...e0, k: pos, atkSp: e0.side ? (memberOf(e0.side, e0.i) || {}).species : '' };
  const gap = MSA_GAP[f.d] != null ? MSA_GAP[f.d] : MSA_GAP[1];
  const xA = 0.5 - gap / 2; const xB = 0.5 + gap / 2;
  const spots = MSA_GAP.map(g => [0.5 - g / 2, 0.5 + g / 2]);
  const hpOf = (side) => (f.hp[side] || [])[f.act[side]];
  const pick = (c) => { if (busy || !manual) return; if (mm.pick(c)) setPos(p => p + 1); }; // 選んだ手の行からすぐ見せる
  const goAuto = () => { if (!manual) return; mm.toAuto(); setAuto(true); setSpeed('x2'); };
  const skip = () => { if (manual && !done) return; setPos(last); };
  const showBar = Boolean(manual && !auto && !busy && !ended && mm.pending);
  return (
    <div className="msc-wrap msa" data-msc-match data-msa-pos={pos} data-msa-mode={manual ? (auto ? 'auto' : 'manual') : 'watch'}>
      <style>{MSA_CSS}</style>
      <div className="msc-top"><b>{info.title} {MSC_STARS(info.star)}</b></div>
      <MscPanel side="B" team={teams.B} frame={f} maxHp={maxHp} info={info} s={s}/>
      <div className="msa-stage" ref={stageRef} style={{ backgroundImage: `url(${MSC_VENUE_IMG[info.venue] || MSC_VENUE_IMG.cup})` }}>
        <div className="msa-round">ラウンド {f.r || 1}</div>
        <div className="msa-floor" aria-hidden="true"/>
        {spots.map(([a, b], d) => <React.Fragment key={d}><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${a * 100}%` }}/><i className={`msa-spot ${d === f.d ? 'on' : ''}`} style={{ left: `${b * 100}%` }}/></React.Fragment>)}
        <MsaFighter side="A" member={memberOf('A')} x={xA} e={e} foeX={{ x: xB, w: stageW }} hpNow={hpOf('A')} reduce={reduce} idleOk/>
        <MsaFighter side="B" member={memberOf('B')} x={xB} e={e} foeX={{ x: xA, w: stageW }} hpNow={hpOf('B')} reduce={reduce} idleOk/>
        <div className="msa-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
        {e.ev === 'tech' && <div key={`c-${pos}`} className={`ambw-cut ${e.kind} ${e.side === 'B' ? 'B' : ''}`} style={{ zIndex: 7 }}><small>{e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}</small><b>{e.name}</b></div>}
        {ended && <div className={`msc-end ${won ? 'w' : 'l'}`} data-msc-end={won ? 'win' : 'lose'} style={{ zIndex: 9 }}>{won ? '勝ち!' : '負け…'}</div>}
      </div>
      <MscPanel side="A" team={teams.A} frame={f} maxHp={maxHp} info={info} s={s} buffed={Boolean(info.buffs)}/>
      <div className="msa-say" data-msa-say>{msaSay(e, nm)}</div>
      <div ref={barRef}>{showBar ? <MsxManualBar opt={mm.pending} onPick={pick} onAuto={goAuto} busy={busy}/> : null}</div>
      {manual && !auto && busy && !ended ? <div className="msa-wait">{e.side === 'B' ? '相手の番…' : '\u00a0'}</div> : null}
      {(!manual || auto) && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => setSpeed(x.id)}>{x.label}</button>)}
          <button type="button" data-msc-skip onClick={skip}>⏭ とばす</button>
        </div>
      ) : null}
      {manual && !auto && !ended ? (
        <div className="msa-tools">
          {MSA_SPEEDS.slice(0, 2).map(x => <button key={x.id} type="button" className={speed === x.id ? 'on' : ''} onClick={() => setSpeed(x.id)}>見せる速さ {x.label}</button>)}
        </div>
      ) : null}
    </div>
  );
}
