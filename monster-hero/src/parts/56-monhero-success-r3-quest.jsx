// ===== モンヒロサクセス 回3: 修行(Q1 修行に出る → Q2 結果)=====
// 見本: docs/progress/player-raise/mock/png/v3-Q.png(v3-phone-Q1・Q2)
// ・1ターン使う・チケット1枚(芯の act({kind:'shugyo', course, techs}))。2段で能力2つずつ → 最後に技のくじ(選んだ技それぞれ)
// ・技を2つ選ぶと超修行(2026-11-13 社長: 育成中2回まで・2つとも覚えることがある・率 +15・能力の上がりと疲れは2回分)。技ごとにランク(1〜5)と今の率を出す
// ・結果のあとは訓練と同じく叱る/褒める(回2の react の段)へ。保存は act のすぐあと(run.phase = 'react')なので、閉じても同じ所から続く
const MSX_R3_DIST = Object.freeze(['零', '近', '中', '遠']);
const MSX_R3_COURSE_BG = Object.freeze({ fire: 'forest_evening', ice: 'forest_morning', wind: 'forest_deep', star: 'monhero_night' });
function MsxR3Shugyo({ run, setRun, v, ev, onBack, onPause }) {
  const { SUC } = msxSuc;
  const s0 = run.s;
  const SH = SUC.SHUGYO || { courses: {}, pick: 2, hp: 30 };
  const courses = Object.keys(SH.courses || {});
  const [course, setCourse] = useState(courses[0] || 'fire');
  const [want, setWant] = useState([]);
  const [res, setRes] = useState(null); // { out, before, after }
  const [fxDone, setFxDone] = useState(false);
  useSuccessSound('ascetic', { season: msxCalendar(s0.turn).season });
  const all = typeof SUC.techsOf === 'function' ? SUC.techsOf(s0.species) : [];
  const superLeft = typeof SUC.superLeft === 'function' ? SUC.superLeft(s0) : 0;
  const isSuper = want.length >= 2;
  // 率は行き先(旬)で変わるので、選んでいる行き先で出し直す。2つ選んだら超修行の率
  const list = typeof SUC.learnable === 'function' ? SUC.learnable(s0, course) : ((v.shugyo && v.shugyo.techs) || []);
  const rateOf = {}; const rankOf = {}; list.forEach((t) => { rateOf[t.id] = isSuper && t.superRate != null ? t.superRate : t.rate; rankOf[t.id] = t.rank; });
  const tickets = (v.shugyo && v.shugyo.tickets) || s0.tickets || 0;
  // 1つ目はそのまま。2つ目は超修行の残りがあるときだけ(無ければ入れ替え)
  const superTk = SH.superTickets || 2; const tk0 = (v.shugyo && v.shugyo.tickets) || s0.tickets || 0;
  const superWhy = superLeft <= 0 ? 'この育成の超修行は使いきった' : tk0 < superTk ? `超修行はチケットが${superTk}枚いる` : '';
  const toggle = (id) => setWant((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length === 0 ? [id] : w.length === 1 && !superWhy ? [...w, id] : [id]));
  const go = () => {
    const r = SUC.act(s0, { kind: 'shugyo', course, techs: want });
    if (!r.out.ok) return;
    const names = (r.out.learnedAll || (r.out.learned ? [r.out.learned] : [])).map((id) => (all.find((t) => t.id === id) || {}).name).filter(Boolean);
    const next = { ...run, s: r.state, phase: 'react', out: { ...r.out, kind: 'shugyo' }, log: [...(run.log || []), { turn: s0.turn, t: `${r.out.super ? '超修行' : '修行'}(${(SH.courses[course] || {}).name || ''}): ${names.length ? names.map((n) => `「${n}」`).join('と') + 'を覚えた' : '能力が上がった'}` }].slice(-20) };
    setRun(next);
    setRes({ out: r.out, before: s0.stats, hp0: s0.hp, s: r.state });
  };

  // ---- 結果(Q2) ----
  if (res) {
    const o = res.out; const s = res.s; const gains = o.gain || {};
    const learned = o.learned ? all.find((t) => t.id === o.learned) : null;
    const learnedAll = (o.learnedAll || (o.learned ? [o.learned] : [])).map((id) => all.find((t) => t.id === id)).filter(Boolean);
    const missed = (o.tries || []).filter((t) => !t.hit).map((t) => (all.find((x) => x.id === t.id) || {}).name).filter(Boolean);
    const stg = (SH.courses[o.course] || {}).stages || [];
    const helpers = Array.from(new Set((o.stages || []).flat()));
    const R = MSX_RES[o.result] || MSX_RES.ok;
    const body = (<>
      <MsxBand s={s} v={SUC.peek(s)} ev={SUC.evaluate(s)}/>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }}><img className="bg" src={`images/story-bg/${MSX_R3_COURSE_BG[o.course] || 'forest_evening'}.jpg`} alt=""/><div className="sh"/>{learned ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(16% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '16%', height: '44%', ...(learned ? {} : { filter: 'grayscale(.25)' }) }}/>
        <div className={`v-stamp msx-pop ${learned ? '' : R.cls}`} style={{ top: '5%', fontSize: learned ? 38 : 32 }}>{learned ? '技をおぼえた!' : o.result === 'sab' ? 'サボった…' : o.result === 'fail' ? '修行は失敗…' : '修行おわり!'}
          <small>{learnedAll.length > 1 ? `✨ ${learnedAll.map((x) => x.name).join('・')}` : learned ? `✨ ${learned.name}(${MSX_R3_DIST[Math.min(...(learned.dist || [1]))]}い間合い)` : R.word}</small></div>
        <div className="v-chips" style={{ top: 'auto', bottom: 8 }}>
          {stg.map((pair, i) => <span key={i} className="v-chip">第{i + 1}段 {pair.map((k) => `${MSX_STAT_ICON[k]}${gains[k] ? `+${gains[k]}` : '±0'}`).join(' ')}</span>)}
          {helpers.length ? <span className="v-chip ylw">👥 編成のおかげ ×{helpers.length}体</span> : null}
        </div>
      </div>
      <MsxStRow stats={s.stats} ups={gains}/>
      <div className="v-log"><span className="hd2">⚔ 修行のけっか({R.word})</span><br/>
        {Object.keys(gains).length ? Object.entries(gains).map(([k, g], i) => <span key={k}>{i ? '・' : ''}{MSX_STAT_NAME[k]} <b className="gu">+{g}</b></span>) : '能力は上がらなかった'}
        {helpers.length ? <>(編成のモンスター <b className="ga">{helpers.length}体</b> がいっしょに修行した)</> : null}<br/>
        体力が <b className="gd">{Math.max(0, res.hp0 - s.hp)}</b> 下がった
        {learnedAll.length ? <>/技{learnedAll.map((x, i) => <React.Fragment key={x.id}>{i ? 'と' : ''}「<b className="ga">{x.name}</b>」</React.Fragment>)}を覚えた!</> : null}
        {missed.length ? <>/{missed.join('・')}は覚えられなかった</> : null}
        {o.aptUp ? <><br/>📏 「{MSX_R3_DIST[o.aptUp.dist]}」の間合い適性が <b className="ga">{o.aptUp.grade}</b> に上がった!</> : null}</div>
      {!learned && want.length ? <div className="v-card" style={{ borderColor: '#94a3b8', padding: '6px 9px' }}><div className="sub"><b style={{ color: '#cbd5e1' }}>おしい…</b> <span className="yel">次の修行で、えらんだ技の覚える率が上がる</span>(⬆)</div></div> : null}
    </>);
    // 技を覚えたら節目の演出(覚えた技の動き・押せばとばせる)
    const fx = learned && !fxDone && typeof MsxFxMoment === 'function'
      ? <MsxFxMoment kind="tech" title={learned.name} sub="技をおぼえた!" species={s.species} colors={run.colors} skill={{ kind: 'normal', name: learned.name }} onDone={() => setFxDone(true)}/> : null;
    return <MsxR3Frame run={{ ...run, s }} back="中断" onBack={onPause} body={<>{body}{fx}</>} foot={<div className="v-ft"><button type="button" className="go" onClick={onBack} data-msx-r3-qnext>つぎへ ▶(叱る/褒める)</button></div>}/>;
  }

  // ---- 修行に出る(Q1) ----
  const cur = SH.courses[course] || { stages: [] };
  // 技が多くても選びやすいように: 間合いごとに、覚えられる技(ランクの低い順)→ まだの技 → 覚えた技の順に2列で並べる
  const tkOrder = (t) => ((s0.techs || []).includes(t.id) ? 2 : rateOf[t.id] != null ? 0 : 1) * 10 + (rankOf[t.id] || 5);
  const groups = MSX_R3_DIST.map((dn, d) => ({ dn, list: all.filter((t) => Math.min(...(Array.isArray(t.dist) && t.dist.length ? t.dist : [1])) === d).sort((x, y) => tkOrder(x) - tkOrder(y)) }));
  const body = (<>
    <MsxBand s={s0} v={v} ev={ev} use={(SH.hp || 30) * (isSuper ? 2 : 1)}/>
    <div className="v-scene low" style={{ flex: '0 0 auto', minHeight: 140 }}><img className="bg" src={`images/story-bg/${MSX_R3_COURSE_BG[course] || 'forest_deep'}.jpg`} alt=""/><div className="sh"/>
      <img src={msxBody(s0.aid, 'happy')} alt="" style={{ position: 'absolute', left: '-2%', bottom: '-98%', height: '190%' }}/>
      <div className="v-ev-h"><small>🎫 チケット {tickets}枚(修行1枚・超修行{superTk}枚)</small>⚔ 修行に出る</div>
      <div className="v-ibub" style={{ left: '40%', top: 'auto', bottom: 10 }}>「修行は<b>2段</b>! 能力が上がって、最後に<b>技を覚える</b>チャンスだよ。覚えたい技を1つか2つ選んでね。2つなら<b>超修行</b>!」</div>
    </div>
    <div className="r3-bar">{courses.map((k) => <button type="button" key={k} className={`r3-chip ${k === course ? 'on' : ''}`} onClick={() => setCourse(k)} data-msx-r3-course={k}>{SH.courses[k].name}</button>)}</div>
    <div className="v-stg">{cur.stages.map((pair, i) => <React.Fragment key={i}><div><small>第{i + 1}段・{cur.name}</small>{pair.map((k) => `${MSX_STAT_ICON[k]} ${MSX_STAT_NAME[k]}`).join(' & ')}</div><i>▶</i></React.Fragment>)}<div className="last"><small>さいごに</small>✨ 技のくじ</div></div>
    {SUC.DIST_UP && SUC.DIST_UP.course && Number.isInteger(SUC.DIST_UP.course[course]) ? <div className="sub" style={{ fontSize: 11, color: '#cbd5e1', padding: '0 4px' }} data-msx-r3-qapt>📏 {cur.name}は「{MSX_R3_DIST[SUC.DIST_UP.course[course]]}」の間合いの修行。ときどき、その間合い適性が1段上がる{typeof SUC.aptUpRoom === 'function' && !SUC.aptUpRoom(s0, SUC.DIST_UP.course[course], 'quest') ? '(この育成では、もう上がらない)' : ''}</div> : null}
    <div className="v-card pk" style={{ padding: '6px 8px' }}><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>えらんだ技(1つ = 修行/2つ = 🔥超修行 のこり{superLeft}回・🎫{superTk}枚)</div>
      {superWhy && want.length ? <div className="sub" style={{ fontSize: 11, color: '#cbd5e1' }} data-msx-r3-superwhy>🔥 {superWhy}ので、技は1つだけ選べる(別の技を押すと入れ替わる)</div> : null}
      {isSuper ? <div className="sub" style={{ fontSize: 11, color: '#fde047' }} data-msx-r3-super>🔥 超修行: チケット{superTk}枚・2つとも覚えることがある・覚える率 +{SH.superAdd || 15}%・能力の上がりと疲れは2回分</div> : null}
      <div className="v-pick2">{want.length ? want.map((id) => { const t = all.find((x) => x.id === id) || {}; return <div key={id} className="on" onClick={() => toggle(id)}><small>{MSX_R3_DIST[Math.min(...(t.dist || [1]))]}・ランク{rankOf[id] || '-'}</small>{t.name}<b>{Math.round((rateOf[id] || 0) * 100)}%</b></div>; }) : <div className="none">技をえらばなくても、能力は上がる</div>}</div></div>
    <div className="v-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', padding: '4px 8px 6px' }} data-msx-r3-techlist>
      <div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>覚えられる技(間合いごと・ランク・覚える率)</div>
      {all.length ? groups.filter((g) => g.list.length).map((g) => (
        <div key={g.dn} className="v-tk" style={{ alignItems: 'flex-start' }}><i>{g.dn}</i><div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>{g.list.map((t) => {
          const got = (s0.techs || []).includes(t.id); const ok = rateOf[t.id] != null;
          return <span key={t.id} className={got ? 'got' : want.includes(t.id) ? 'sel' : ''} onClick={() => (ok && !got ? toggle(t.id) : null)} style={{ opacity: got || ok ? 1 : 0.45 }} data-msx-r3-tech={t.id}>{ok && !got && rankOf[t.id] ? <small style={{ fontSize: 9, opacity: 0.8, marginRight: 2 }}>R{rankOf[t.id]}</small> : null}{t.name}<b>{got ? '覚えた' : ok ? `${Math.round(rateOf[t.id] * 100)}%` : 'まだ'}</b></span>;
        })}</div></div>)) : <div className="sub">このモンスターの技の表がまだありません(能力だけ上がる)</div>}
      <div className="sub">ランクが高い技ほど覚えにくい。能力・忠誠度・人気がよく仕上がっているほど、行き先の旬の季節ほど覚えやすい。外した技は、その技だけ次から覚えやすくなる。助手がドラだと、さらに覚えやすい</div>
    </div>
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={onBack}>← もどる</button><button type="button" className="go" disabled={tickets <= 0} onClick={go} data-msx-r3-shugyo>{isSuper ? '🔥 超修行する' : '⚔ 修行する'}(🎫 {tickets} → {Math.max(0, tickets - (isSuper ? superTk : 1))})</button></div>;
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}
