// ===== モンヒロサクセス 回3: 修行(Q1 修行に出る → Q2 結果)=====
// 見本: docs/progress/player-raise/mock/png/v3-Q.png(v3-phone-Q1・Q2)
// ・1ターン使う・チケット1枚(芯の act({kind:'shugyo', course, techs}))。2段で能力2つずつ → 最後に技を覚える(選んだ技それぞれ・確率)
// ・技を2つ選ぶと超修行(2026-11-13 社長: 育成中2回まで・2つとも覚えることがある・率 +15・能力の上がりと疲れは2回分)。技ごとにランク(1〜5)と今の率を出す
// ・結果のあとはトレーニングと同じく叱る/褒める(回2の react の段)へ。保存は act のすぐあと(run.phase = 'react')なので、閉じても同じ所から続く
const MSX_R3_DIST = Object.freeze(['零', '近', '中', '遠']);
const MSX_R3_COURSE_BG = Object.freeze({ fire: 'forest_evening', ice: 'forest_morning', wind: 'forest_deep', star: 'monhero_night' });
const MSX_STAT_KEYS_R3 = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
function MsxR3Shugyo({ run, setRun, v, ev, onBack, onPause }) {
  const { SUC } = msxSuc;
  const s0 = run.s;
  const SH = SUC.SHUGYO || { courses: {}, pick: 2, hp: 30 };
  const courses = Object.keys(SH.courses || {});
  const [course, setCourse] = useState(courses[0] || 'fire');
  const [want, setWant] = useState([]);
  const [res, setRes] = useState(null); // { out, before, after }
  const [fxDone, setFxDone] = useState(false);
  // 結果の前の段(助手の一言 → STAGE 1 → STAGE 2。56-monsuc-actfx.jsx)。押した直後だけ・保存しない
  const [stOn, setStOn] = useState(false);
  const [lockT, setLockT] = useState(null); // 🔒の札の条件をくわしく(選ぶ画面)
  // 行き先・技を選ぶあいだは育成中の曲のまま。「修行する」を押して修行の段が始まってから修行の曲(2026-11-14 社長)
  useSuccessScene(res ? 'ascetic' : null, { season: msxCalendar(s0.turn).season });
  // 段のあと、結果の字が出たときに 覚えた/覚えなかった の音(2026-11-14 社長「修行の結果にも SE を」)
  const qRes = res && !stOn ? ((res.out.learnedAll && res.out.learnedAll.length) || res.out.learned ? 'qLearn' : 'qMiss') : null;
  useEffect(() => { if (qRes && typeof SuccessSound !== 'undefined') SuccessSound.se(qRes, 150); }, [qRes]);
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
    setStOn(typeof MsxShugyoStages === 'function');
    setRes({ out: r.out, before: s0.stats, hp0: s0.hp, s: r.state });
  };

  // ---- 結果の前の段 ----
  if (res && stOn) {
    const s = res.s;
    const body = (<><MsxBand s={s} v={SUC.peek(s)} ev={SUC.evaluate(s)}/>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }}><MsxShugyoStages key={`qs-${s0.turn}`} run={{ ...run, s }} o={res.out} onDone={() => setStOn(false)}/></div></>);
    return <MsxR3Frame run={{ ...run, s }} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStOn(false)} data-msx-r3-qskip>⏩ 結果へ</button></div>}/>;
  }
  // ---- 結果(Q2) ----
  if (res) {
    const o = res.out; const s = res.s; const gains = o.gain || {};
    const learned = o.learned ? all.find((t) => t.id === o.learned) : null;
    const learnedAll = (o.learnedAll || (o.learned ? [o.learned] : [])).map((id) => all.find((t) => t.id === id)).filter(Boolean);
    const missed = (o.tries || []).filter((t) => !t.hit).map((t) => (all.find((x) => x.id === t.id) || {}).name).filter(Boolean);
    const stg = (SH.courses[o.course] || {}).stages || [];
    const helpers = Array.from(new Set((o.stages || []).flat()));
    void stg;
    const body = (<>
      <MsxBand s={s} v={SUC.peek(s)} ev={SUC.evaluate(s)}/>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }}><img className="bg" src={`images/story-bg/${MSX_R3_COURSE_BG[o.course] || 'forest_evening'}.jpg`} alt=""/><div className="sh"/>{learned ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(16% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '16%', height: '44%', ...(learned ? {} : { filter: 'grayscale(.25)' }) }}/>
        <div className={`v-stamp msx-pop ${learned ? '' : 'ok'}`} style={{ top: '5%', fontSize: learned ? 38 : 32 }}>{learned ? '技をおぼえた!' : '修行おわり!'}
          <small>{learnedAll.length > 1 ? `✨ ${learnedAll.map((x) => x.name).join('・')}` : learned ? `✨ ${learned.name}(${MSX_R3_DIST[Math.min(...(learned.dist || [1]))]}い間合い)` : '技は覚えられなかった'}</small></div>
        <div className="v-chips" style={{ top: 'auto', bottom: 8 }}>
          {/* 2026-11-14 社長: 修行は決まった数値で上がる(行き先の基礎+編成の得意)。上がった能力を全部出す */}
          <span className="v-chip">{MSX_STAT_KEYS_R3.filter((k) => gains[k]).map((k) => `${MSX_STAT_ICON[k]}+${gains[k]}`).join(' ') || '±0'}</span>
          {helpers.length ? <span className="v-chip ylw">👥 編成のおかげ ×{helpers.length}体</span> : null}
        </div>
      </div>
      <MsxStRow who={s} stats={s.stats} ups={gains}/>
      <div className="v-log"><span className="hd2">⚔ 修行のけっか</span><br/>
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

  // ---- 修行に出る(Q1)・案A(2026-11-14 社長が選んだ。参考 v3 20〜32秒・te-67・te-68) ----
  // ① 行き先(4つ)と、2段で上がる能力 → 技を覚える ② 覚えたい技の枠2つ(2つで超修行。札に覚える条件と「済」)
  // ③ 覚えられる技を間合いごとの4列の札で(率・覚えた・🔒と覚えられる条件)。🔒の札を押すと条件をくわしく
  const cur = SH.courses[course] || { stages: [] };
  const tkMax = SUC.TECH_MAX || 99; const full = (s0.techs || []).length >= tkMax;
  const techName = (id) => (all.find((x) => x.id === id) || {}).name || id;
  // 覚えられる条件(芯の canLearn と同じ: t.learn.st = 能力の下限・t.learn.need = 前の技の熟練の下限)。ok は満たしているか
  const condsOf = (t) => {
    const L = (t && t.learn) || {}; const out = [];
    if (L.start) return out;
    Object.entries(L.st || {}).forEach(([k, n]) => out.push({ k: `st-${k}`, short: `${MSX_STAT_NAME[k] || k} ${msxFmt(n)}で`, long: msxPh(`${MSX_STAT_ICON[k] || ''} ${MSX_STAT_NAME[k] || k}が｜${msxFmt(n)} 以上｜(いま ${msxFmt(Math.round((s0.stats || {})[k] || 0))})`), ok: ((s0.stats || {})[k] || 0) >= n }));
    Object.entries(L.need || {}).forEach(([id, n]) => out.push({ k: `nd-${id}`, short: `${techName(id)} 熟練${n}で`, long: msxPh(`「${techName(id)}」の熟練が｜${n} 以上｜${(s0.techs || []).includes(id) ? `(いま ${(s0.mastery || {})[id] || 0})` : '(まだ覚えていない)'}`), ok: ((s0.mastery || {})[id] || 0) >= n }));
    return out;
  };
  const cols = MSX_R3_DIST.map((dn, d) => ({ dn, list: all.filter((t) => Math.min(...(Array.isArray(t.dist) && t.dist.length ? t.dist : [1])) === d).sort((x, y) => ((rankOf[x.id] || (x.rank || 5)) - (rankOf[y.id] || (y.rank || 5)))) }));
  const say = msxPh(want.length >= 2 ? '「2つで｜超修行!｜2つとも｜覚えることも｜あるよ。｜能力の上がりも｜疲れも｜2回分だからね」' : want.length === 1 ? (superWhy ? `「この技で｜いこう!｜(${superWhy}から、｜技は｜1つだけ)」` : '「いいね!｜もう1つ選ぶと｜超修行に｜なるよ」') : '「覚えたい技を｜1つ選んでね。｜2つ選ぶと｜超修行!｜選ばなくても｜能力は｜上がるよ」');
  const slot = (id) => {
    if (!id) return <div className="q-slot msx-kp" data-msx-r3-qslot="0">{want.length ? (superWhy ? `超修行は できない(${superWhy})` : '+ もう1つ選ぶと 🔥超修行') : '+ 下の緑の札から 技をえらぶ'}</div>;
    const t = all.find((x) => x.id === id) || {}; const cs = condsOf(t);
    return (<div className="q-slot on msx-kp" onClick={() => toggle(id)} data-msx-r3-qslot={id}>
      <small>{MSX_R3_DIST[Math.min(...(t.dist || [1]))]}・R{rankOf[id] || '-'}</small><b className="n">{t.name}</b><b className="r">{Math.round((rateOf[id] || 0) * 100)}%</b>
      {cs.length ? <ul>{cs.slice(0, 4).map((c, i) => <li key={c.k}><i>条件{i + 1}</i>{c.short.replace(/で$/, ' 以上')}<em>済</em></li>)}</ul> : <ul><li><i>条件</i>なし</li></ul>}
    </div>);
  };
  const body = (<>
    <MsxBand s={s0} v={v} ev={ev} use={(SH.hp || 30) * (isSuper ? 2 : 1)}/>
    <div className="q-say"><img src={typeof msxFace === 'function' ? msxFace(s0.aid, 'happy') : msxBody(s0.aid, 'happy')} alt=""/><p className="msx-kp" data-msx-r3-qsay>{say}</p></div>
    <div className="q-sec"><h3><i>1</i>行き先<span className="tk">🎫 チケット {tickets}枚</span></h3>
      <div className="r3-bar q-dest">{courses.map((k) => <button type="button" key={k} className={`r3-chip ${k === course ? 'on' : ''}`} onClick={() => setCourse(k)} data-msx-r3-course={k}>{SH.courses[k].name}</button>)}</div>
      <div className="v-stg">{cur.stages.map((pair, i) => <React.Fragment key={i}><div><small>第{i + 1}段</small>{pair.map((k) => `${MSX_STAT_ICON[k]} ${MSX_STAT_NAME[k]}`).join(' & ')}</div><i>▶</i></React.Fragment>)}<div className="last"><small>さいごに</small>✨ 技を覚える</div></div>
      {SUC.DIST_UP && SUC.DIST_UP.course && Number.isInteger(SUC.DIST_UP.course[course]) ? <div className="q-note msx-kp" data-msx-r3-qapt>📏 「{MSX_R3_DIST[SUC.DIST_UP.course[course]]}」の間合いの修行。ときどき、その間合い適性が1段上がる{typeof SUC.aptUpRoom === 'function' && !SUC.aptUpRoom(s0, SUC.DIST_UP.course[course], 'quest') ? '(この育成では、もう上がらない)' : ''}</div> : null}
    </div>
    <div className="q-sec"><h3><i>2</i>覚えたい技<span className="tk">2つで🔥超修行・のこり{superLeft}回</span></h3>
      <div className="q-slots">{slot(want[0])}{slot(want[1])}</div>
      {isSuper ? <div className="q-note y msx-kp" data-msx-r3-super>🔥 超修行: チケット{superTk}枚・2つとも覚えることがある・覚える率 +{SH.superAdd || 15}%・能力の上がりと疲れは2回分</div> : null}
      {superWhy && want.length ? <div className="q-note msx-kp" data-msx-r3-superwhy>🔥 {superWhy}ので、技は1つだけ選べる(別の技を押すと入れ替わる)</div> : null}
    </div>
    <div className="q-sec q-list" data-msx-r3-techlist><h3><i>3</i>覚えられる技<span className="tk">緑の札をタップ</span></h3>
      {all.length ? <div className="q-grid">{cols.map((c) => (
        <div key={c.dn} className="q-col"><h4>{c.dn}</h4>{c.list.map((t) => {
          const got = (s0.techs || []).includes(t.id); const ok = rateOf[t.id] != null; const sel = want.includes(t.id);
          const cs = got || ok ? [] : condsOf(t); const ng = cs.find((x) => !x.ok);
          return (<button type="button" key={t.id} className={`q-card ${sel ? 'sel' : got ? 'got' : ok ? 'ok' : 'lock'}`} onClick={() => (ok && !got ? toggle(t.id) : !got ? setLockT(t) : null)} data-msx-r3-tech={t.id}>
            <span className="nm msx-kp">{t.name}</span><span className="rk">R{rankOf[t.id] || t.rank || '-'}</span>
            {got ? <span className="p g">覚えた</span> : ok ? <span className="p">{Math.round(rateOf[t.id] * 100)}%</span> : <span className="lk msx-kp">🔒 {full ? '技がいっぱい' : ng ? ng.short : '条件あり'}</span>}
          </button>);
        })}</div>))}</div> : <div className="q-note msx-kp">このモンスターの技の表がまだありません(能力だけ上がる)</div>}
      <div className="q-note msx-kp">ランクが高い技ほど覚えにくい。能力・忠誠度・人気がよく仕上がっているほど、行き先の旬の季節ほど覚えやすい。外した技は、その技だけ次から覚えやすくなる。助手がドラだと、さらに覚えやすい</div>
    </div>
    {lockT ? (
      <div className="v-cupwin" onClick={() => setLockT(null)} data-msx-r3-qlock>
        <div className="in" onClick={(e) => e.stopPropagation()}>
          <div className="h">🔒 {lockT.name}</div>
          <div className="q-lock">{full ? <p>覚えられる技は {tkMax}つまで。いまは いっぱいです</p> : null}
            {condsOf(lockT).map((c, i) => <div key={c.k} className={c.ok ? 'ok' : ''}><i>条件{i + 1}</i><span className="msx-kp">{c.long}</span><b>{c.ok ? '済' : 'まだ'}</b></div>)}
            {!full && condsOf(lockT).length ? <p>条件をすべて満たすと、緑の「覚えられる」札になります</p> : null}</div>
          <div className="bt"><button type="button" onClick={() => setLockT(null)}>とじる</button></div>
        </div>
      </div>) : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={onBack}>← もどる</button><button type="button" className="go" disabled={tickets <= 0} onClick={go} data-msx-r3-shugyo>{isSuper ? '🔥 超修行する' : '⚔ 修行する'}(🎫 {tickets} → {Math.max(0, tickets - (isSuper ? superTk : 1))})</button></div>;
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}
