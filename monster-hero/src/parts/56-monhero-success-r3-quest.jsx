// ===== モンヒロサクセス 回3: 修行(Q1 修行に出る → Q2 結果)=====
// 見本: docs/progress/player-raise/mock/png/v3-Q.png(v3-phone-Q1・Q2)
// ・1ターン使う・チケット1枚(芯の act({kind:'shugyo', course, techs}))。2段で能力2つずつ → 最後に技を覚える(選んだ技それぞれ・確率)
// ・技を2つ選ぶと超修行(2026-11-13 社長: 育成中2回まで・2つとも覚えることがある・率 +15・能力の上がりと疲れは2回分)。技ごとにランク(1〜5)と今の率を出す
// ・結果のあとはトレーニングと同じく叱る/褒める(回2の react の段)へ。保存は act のすぐあと(run.phase = 'react')なので、閉じても同じ所から続く
const MSX_R3_DIST = Object.freeze(['零', '近', '中', '遠']);
const MSX_R3_COURSE_BG = Object.freeze({ fire: 'forest_evening', ice: 'forest_morning', wind: 'forest_deep', star: 'monhero_night' });
const MSX_STAT_KEYS_R3 = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const MSX_R3_QCOL = Object.freeze(['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fb7185', '#facc15']); // 内訳の編成の子の色(段演出 MsxQfxRows と同じ並び)
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
  const [focusT, setFocusT] = useState(null); // 右の欄に出す技(最後に押したカード。2026-11-17 あっくん「技詳細もほしい」→ 2026-11-18 あっくん「タップで右に性能と入れ替え」)
  const [pvOpen, setPvOpen] = useState(false); // 上がる見込みパネルの開閉(既定は閉=見出しに要約だけ。1画面に収めるため。開けば合計+内訳チップ+倍率が全部出る)
  const [bdOpen, setBdOpen] = useState(false); // 結果の内訳パネルの開閉(既定は閉。開けば残るので後からでも見られる)
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
  // 体力が足りないと行けない(2026-11-15 社長 r1115-062)。修行と超修行で使う体力が違う(超修行は2回分)
  const hpOf = (sup) => (typeof SUC.shugyoHpOf === 'function' ? SUC.shugyoHpOf(s0, sup) : (SH.hp || 30) * (sup ? 2 : 1));
  const shortOf = (sup) => Math.max(0, hpOf(sup) - Math.round(Number(s0.hp) || 0));
  const superWhy = superLeft <= 0 ? 'この育成の超修行は使いきった' : tk0 < superTk ? `超修行はチケットが${superTk}枚いる` : shortOf(true) ? `超修行は体力が${hpOf(true)}いる。体力があと${shortOf(true)}足りない` : '';
  // 修行の内訳の表示(予告・結果で共用): 小数は1桁まで・整数はそのまま。顔は段演出(MsxQfxRows)と同じ出し方
  const shFmt = (n) => { const x = Math.round(Number(n) * 10) / 10; return Number.isInteger(x) ? String(x) : x.toFixed(1); };
  const shThumb = (m) => (m ? <MsxMonFace species={m.species} colors={m.colors}/> : null);
  const HACHI_PCT = Math.round((((SUC.GOOD || {}).shugyoGood || {}).shugyo || 0.2) * 100);
  // 倍率の1行: 出典(ハチマキ・修行効果アップ等) → 合算倍率を併記する。予告と結果で同じ形(値は途中で折れないよう塊ごとに nowrap)
  const mulLine = (mi, sup) => {
    if (!mi) return null;
    const src = [];
    if (mi.hachi) src.push(`修行のハチマキ +${HACHI_PCT}%`);
    if (mi.assist) src.push(`修行効果アップ +${shFmt(mi.assist)}%`);
    if (mi.waza) src.push(`技習得効果アップ +${shFmt(mi.waza)}%`);
    if (mi.kiai) src.push('修行の気合い ×1.2');
    const tail = [];
    if (mi.toku) tail.push(`特別効果アップ +${shFmt(mi.toku)} を足してから`);
    if (sup) tail.push('超修行で2回分');
    if (!src.length && !tail.length) return <span>倍率は かかっていません</span>;
    return (<span>倍率 {src.map((t, i) => <React.Fragment key={i}>{i ? '・' : ''}<span className="q-nw">{t}</span></React.Fragment>)}
      {src.length ? <> → <span className="q-nw">合わせて <b>×{(Math.round(mi.mul * 100) / 100).toFixed(2)}</b></span></> : <span className="q-nw">×1.00</span>}
      {tail.length ? <>（{tail.map((t, i) => <React.Fragment key={i}>{i ? '・' : ''}<span className="q-nw">{t}</span></React.Fragment>)}）</> : null}</span>);
  };
  const toggle = (id) => setWant((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length === 0 ? [id] : w.length === 1 && !superWhy ? [...w, id] : [id]));
  // 右の欄から枠を指定して入れる(入れ替え)。超修行ができないときは技1つだけなので、入れると今の技と入れ替わる
  const pickInto = (id, i) => setWant((w) => {
    const rest = w.filter((x) => x !== id);
    if (superWhy) return [id];
    if (i === 0) return [id, ...rest].slice(0, 2);
    return rest.length ? [rest[0], id] : [id];
  });
  const go = () => {
    const r = SUC.act(s0, { kind: 'shugyo', course, techs: want });
    if (!r.out.ok) return;
    const names = (r.out.learnedAll || (r.out.learned ? [r.out.learned] : [])).map((id) => (all.find((t) => t.id === id) || {}).name).filter(Boolean);
    const next = { ...run, s: r.state, phase: 'react', out: { ...r.out, parts: undefined, partsRaw: undefined, mulInfo: undefined, kind: 'shugyo' }, log: [...(run.log || []), { turn: s0.turn, t: `${r.out.super ? '超修行' : '修行'}(${(SH.courses[course] || {}).name || ''}): ${names.length ? names.map((n) => `「${n}」`).join('と') + 'を覚えた' : '能力が上がった'}` }].slice(-20) };
    setRun(next);
    setStOn(typeof MsxShugyoStages === 'function');
    setRes({ out: r.out, before: s0.stats, hp0: s0.hp, s: r.state });
  };

  // ---- 結果の前の段 ----
  if (res && stOn) {
    const s = res.s;
    const body = (<><MsxBand s={s} v={SUC.peek(s)} ev={SUC.evaluate(s)}/>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }}><MsxShugyoStages key={`qs-${s0.turn}`} run={{ ...run, s }} o={res.out} onDone={() => setStOn(false)}/></div></>);
    return <MsxR3Frame run={{ ...run, s }} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStOn(false)} data-msx-r3-qskip>⏩ 結果へ ▶</button></div>}/>;
  }
  // ---- 結果(Q2) ----
  if (res) {
    const o = res.out; const s = res.s; const gains = o.gain || {};
    const learned = o.learned ? all.find((t) => t.id === o.learned) : null;
    const learnedAll = (o.learnedAll || (o.learned ? [o.learned] : [])).map((id) => all.find((t) => t.id === id)).filter(Boolean);
    const missed = (o.tries || []).filter((t) => !t.hit).map((t) => (all.find((x) => x.id === t.id) || {}).name).filter(Boolean);
    const tries = (o.tries || []).map((x) => ({ ...x, t: all.find((y) => y.id === x.id) })).filter((x) => x.t);
    const stg = (SH.courses[o.course] || {}).stages || [];
    const helpers = Array.from(new Set((o.stages || []).flat()));
    void stg;
    const body = (<>
      {/* 体力の減りは帯の棒が前の値から縮んで見せる(2026-11-20 r1119-033 育-79: 文に書くだけで棒が動かなかった) */}
      <MsxBand s={s} v={SUC.peek(s)} ev={SUC.evaluate(s)} hpFrom={Number.isFinite(res.hp0) ? res.hp0 : null}/>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }}><img className="bg" src={`images/story-bg/${MSX_R3_COURSE_BG[o.course] || 'forest_evening'}.jpg`} alt=""/><div className="sh"/>{learned ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(16% - 5px)' }}/><MsxMonArt run={run} className="mon" noPeak style={{ bottom: '16%', height: '44%', ...(learned ? {} : { filter: 'grayscale(.25)' }) }}/>
        {/* 覚えた/覚えなかったをはっきり(2026-11-15 社長 r1115-063): 覚えた=金・覚えられなかった=灰・技を選ばなかった=修行終わり */}
        <div className={`v-stamp msx-pop ${learned ? '' : tries.length ? 'ng' : 'ok'}`} style={{ top: '5%', fontSize: learned ? 38 : tries.length ? 'min(30px, 8.4vw)' : 32 }} data-msx-r3-qstamp={learned ? 'hit' : tries.length ? 'miss' : 'none'}>{learned ? (missed.length ? '1つ覚えた!' : '技を覚えた!') : tries.length ? '覚えられなかった…' : '修行終わり!'}
          <small>{learnedAll.length > 1 ? `✨ ${learnedAll.map((x) => x.name).join('・')}` : learned ? `✨ ${learned.name}(${MSX_R3_DIST[Math.min(...(learned.dist || [1]))]}の間合い)` : tries.length ? `次は覚える率が +${SH.miss || 15}%` : '能力が上がった'}</small></div>
        {/* 上がった能力は下の能力の札の「+」の1か所だけ(2026-11-20 r1119-033 育-67・育-76: 場面の札・能力の札・下の文の3か所に出ていた)。
            場面には、いっしょに修行した編成の数だけを出す(下の文の「いっしょに修行した」は消した・育-68・育-77) */}
        {helpers.length ? <div className="v-chips" style={{ top: 'auto', bottom: 8 }}><span className="v-chip ylw" data-msx-r3-qhelp>👥 編成の{helpers.length}体が いっしょに修行した</span></div> : null}
      </div>
      {tries.length ? <div className="q-res" data-msx-r3-qres>{tries.map((x) => (
        <div key={x.id} className={`q-ri ${x.hit ? 'hit' : 'miss'}`} data-msx-r3-qri={x.hit ? 'hit' : 'miss'}>
          <span className="ti" aria-hidden="true"><MsxSkillArt t={x.t} uid={`qr${x.id}`}/></span>
          <span className="nm"><b>{x.t.name}</b><small>覚える率 {Math.round((x.rate || 0) * 100)}%</small></span>
          <span className="rs">{x.hit ? <b>覚えた!</b> : <><b>覚えられなかった</b><small>次は +{SH.miss || 15}%</small></>}</span>
        </div>))}</div> : null}
      {(o.partsRaw || o.mulInfo) ? (() => { const rawP = o.partsRaw || {}; const fitP = o.parts || {}; const bdRows = MSX_STAT_KEYS_R3.map((k) => { const rp = rawP[k] || { base: 0, team: [] }; const raw = rp.base + (rp.team || []).reduce((a, x) => a + x.v, 0); const g = gains[k] || 0; if (!(raw > 0) && !g) return null; return { k, rp, g }; }).filter(Boolean); const maxG = Math.max(1, ...bdRows.map((x) => x.g)); return (
      <div className="q-bd" data-msx-r3-qbd>
        <button type="button" className="q-bd-h q-tgl" onClick={() => setBdOpen(!bdOpen)} aria-expanded={bdOpen}>修行の内訳（行き先の分・編成の分・倍率）<span className="q-tgl-t">{bdOpen ? '閉じる ▴' : '開く ▾'}</span></button>
        {bdOpen ? <>{bdRows.map(({ k, rp, g }) => { const before = Math.round(Number((res.before || {})[k]) || 0); const after = Math.round(Number((s.stats || {})[k]) || 0); const segs = fitP[k] || []; return (
        <div className="q-bd-row" key={k}>
          <span className="q-bd-k">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span>
          <span className="q-bd-bar">{segs.map((x, n) => <i key={n} style={{ width: `${(x.v / maxG) * 100}%`, background: x.src === 'course' ? '#f59e0b' : MSX_R3_QCOL[x.i % MSX_R3_QCOL.length] }}/>)}</span>
          <span className="q-bd-v"><small>{msxFmt(before)}→</small><b>{msxFmt(after)}</b><em>+{g}</em></span>
          <span className="q-bd-parts">
            {rp.base > 0 ? <span className="q-bd-p course"><em>⛰️</em><b>+{shFmt(rp.base)}</b><small>行き先</small></span> : null}
            {(rp.team || []).map((x, n) => <span key={n} className="q-bd-p team">{shThumb((s.team || [])[x.i])}<b>+{shFmt(x.v)}</b><small>{['得意1', '得意2', '得意3'][x.top] || '得意'}</small></span>)}
            {g <= 0 ? <span className="q-bd-p none">もう上がりきっている</span> : null}
          </span>
        </div>); })}
        <div className="q-bd-mul msx-kp">{mulLine(o.mulInfo, o.super)}</div></> : null}
      </div>); })() : null}
      <MsxStRow who={s} stats={s.stats} ups={gains}/>
      <div className="v-log msx-kp"><span className="hd2">⚔ 修行のけっか</span><br/>
        {Object.keys(gains).length ? null : <>能力は上がらなかった<br/></>}
        体力が <b className="gd">{Math.max(0, res.hp0 - s.hp)}</b> 下がった
        {learnedAll.length ? <>/技{learnedAll.map((x, i) => <React.Fragment key={x.id}>{i ? 'と' : ''}「<b className="ga">{x.name}</b>」</React.Fragment>)}を覚えた!</> : null}
        {missed.length ? <>/{missed.join('・')}は覚えられなかった</> : null}
        {o.aptUp ? <><br/>📏 「{MSX_R3_DIST[o.aptUp.dist]}」の間合い適性が <b className="ga">{o.aptUp.grade}</b> に上がった!</> : null}</div>
    </>);
    // 技を覚えたら節目の演出(覚えた技の動き・押せばとばせる)
    const fx = learned && !fxDone && typeof MsxFxMoment === 'function'
      ? <MsxFxMoment kind="tech" title={learned.name} sub="技をおぼえた!" species={s.species} colors={run.colors} skill={{ kind: 'normal', name: learned.name }} onDone={() => setFxDone(true)}/> : null;
    return <MsxR3Frame run={{ ...run, s }} back="中断" onBack={onPause} body={<>{body}{fx}</>} foot={<div className="v-ft"><button type="button" className="go" onClick={onBack} data-msx-r3-qnext>次へ ▶</button></div>}/>;
  }

  // ---- 修行に出る(Q1)・案A(2026-11-14 社長が選んだ。参考 v3 20〜32秒・te-67・te-68) ----
  // ① 行き先(4つ)と、2段で上がる能力 → 技を覚える ② 覚えたい技の枠2つ(2つで超修行。札に覚える条件と「済」)
  // ③ 覚えられる技は左に間合いごとの4列の表(アイコン大きめ・技名は小さく)、押した技の性能と選ぶ/入れ替え・🔒の条件は右の欄に出す(2026-11-18 あっくん)
  const cur = SH.courses[course] || { stages: [] };
  // 間合いの見出しに、育てる子のその間合いの適性と、覚える率の増減(C が ±0・1段 5%。芯の techAptAdd と同じ数え方)(2026-11-15 社長 r1115-080)
  const aptG = typeof SUC.aptGradesOf === 'function' ? SUC.aptGradesOf(s0) : null; const GR = (SUC.DIST_UP && SUC.DIST_UP.grades) || [];
  const aptHead = aptG ? (d) => { const g = aptG[d] || SH.aptBase || 'C'; const i = GR.indexOf(g); const b = GR.indexOf(SH.aptBase || 'C'); return { g, add: i >= 0 && b >= 0 ? (i - b) * (SH.aptStep || 5) : 0 }; } : null;
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
  const grade = (k, v) => (typeof msaTechGrade === 'function' ? msaTechGrade(k, v) : '') || '−';
  // 技の詳しさの行(モンスター詳細の技の詳しさと同じ並び)。§3の詳しさ欄と、🔒の条件ポップアップで共用する
  const tdRows = (t) => (<>
    <span className="kv"><b>技種</b><span className="vv">{t.kind === 'wise' ? 'かしこさ' : 'ちから'}</span></span>
    <span className="kv"><b>消費ガッツ</b><span className="vv">{t.guts}</span></span>
    <span className="kv"><b>ダメージ</b><span className="gd">{grade('power', t.power)}</span></span>
    <span className="kv"><b>命中率</b><span className="gd">{grade('hit', t.hit)}</span></span>
    <span className="kv"><b>ガッツダウン</b><span className="gd">{grade('gd', t.gd)}</span></span>
    <span className="kv"><b>クリティカル率</b><span className="gd">{grade('crit', t.crit)}</span></span>
    {typeof msxTechMoveTxt === 'function' && msxTechMoveTxt(t) ? <span className="kv"><b>使ったあと</b><span className="vv">{msxTechMoveTxt(t)}</span></span> : null}
    {(s0.techs || []).includes(t.id) && typeof msxMasteryOf === 'function' ? (() => { const m = msxMasteryOf(s0.mastery, t.id); const b = typeof msxMasteryBoost === 'function' ? msxMasteryBoost(SUC, t.id, m) : null; return (<><span className="kv"><b>熟練</b><span className="vv">{m}/100</span></span><span className="kv"><b>熟練の効き目</b><span className="vv">{b ? `威力+${b.pow}%・命中+${b.hit}%` : 'まだ無し'}</span></span></>); })() : null}
  </>);
  const say = msxPh(want.length >= 2 ? '「2つで｜超修行!｜2つとも｜覚えることも｜あるよ。｜能力の上がりも｜疲れも｜2回分だからね」' : want.length === 1 ? (superWhy ? `「この技で｜いこう!｜(${superWhy}から、｜技は｜1つだけ)」` : '「いいね!｜もう1つ選ぶと｜超修行に｜なるよ」') : '「覚えたい技を｜1つ選んでね。｜2つ選ぶと｜超修行!｜選ばなくても｜能力は｜上がるよ」');
  const slot = (id) => {
    if (!id) return <div className="q-slot msx-kp" data-msx-r3-qslot="0">{want.length ? (superWhy ? `超修行は できない(${superWhy})` : '+ もう1つ選ぶと 🔥超修行') : '+ 下の緑の技のカードから 技を選ぶ'}</div>;
    const t = all.find((x) => x.id === id) || {};
    // 覚える率が上がる条件(加点・満たした1つにつき +5%): いま選んでいる技の組み合わせで数える(選んだ技の段の合計)
    const bc = typeof SUC.techBoostConds === 'function' ? SUC.techBoostConds(s0, t, want) : [];
    const rate = typeof SUC.techRate === 'function' ? SUC.techRate(s0, t, { course, super: isSuper, picks: want }) : (rateOf[id] || 0);
    const BC = { n: (c) => `覚えた技 ${c.need}つ以上`, pop: (c) => `人気 ${c.need}以上`, sum: (c) => `選んだ技の段の合計 ${c.need}以上` };
    return (<div className="q-slot on msx-kp" onClick={() => toggle(id)} data-msx-r3-qslot={id}>
      <small>{MSX_R3_DIST[Math.min(...(t.dist || [1]))]}・R{rankOf[id] || '-'}{typeof SUC.techAptAdd === 'function' ? ` ・適性 ${(() => { const a = SUC.techAptAdd(s0, t); return a ? `${a > 0 ? '+' : ''}${a}%` : '±0'; })()}` : ''}</small><div className="q-slot-nr"><b className="n">{t.name}</b><b className="r" data-msx-r3-qrate>{Math.round(rate * 100)}%</b></div>
      {bc.length ? <ul data-msx-r3-qconds>{bc.slice(0, 4).map((c, i) => <li key={`${c.type}${i}`} className={c.ok ? 'ok' : ''}><i>上乗せ</i><span>{(BC[c.type] || (() => ''))(c)}</span><em className={c.ok ? '' : 'no'}>{c.ok ? '済 +5%' : 'まだ'}</em></li>)}</ul> : <ul><li><i>条件</i>なし</li></ul>}
    </div>);
  };
  // 上がる見込み(予告): 芯の生内訳 shugyoPartsOf + 倍率 shugyoMulOf で、行き先を替えるたびに出し直す。最終見込みは act と同じ組み立て (①+② × mulB + toku) × mulA × (超修行なら 2)
  const pvParts = typeof SUC.shugyoPartsOf === 'function' ? SUC.shugyoPartsOf(s0, course) : null;
  const pvMul = typeof SUC.shugyoMulOf === 'function' ? SUC.shugyoMulOf(s0) : null;
  const pvRows = pvParts ? MSX_STAT_KEYS_R3.map((k) => { const p = pvParts[k] || { base: 0, team: [] }; const raw = p.base + (p.team || []).reduce((a, x) => a + x.v, 0); if (!(raw > 0)) return null; const exp = Math.round((raw * (pvMul ? pvMul.mulB : 1) + (pvMul ? pvMul.toku : 0)) * (pvMul ? pvMul.mulA : 1) * (isSuper ? 2 : 1)); return { k, p, exp }; }).filter(Boolean) : [];
  const pvTop = [...pvRows].sort((a, b) => b.exp - a.exp).slice(0, 2); // 閉じているときの要約(上がる量の多い順に2つ)
  const focusTech = focusT || all.find((x) => x.id === want[0]) || all[0] || null; // 右の欄に出す技(押した技 → 選んだ1つ目 → 表の1つ目)
  const body = (<>
    <MsxBand s={s0} v={v} ev={ev} use={hpOf(isSuper)}/>
    <div className="q-say"><img src={typeof msxFace === 'function' ? msxFace(s0.aid, 'happy') : msxBody(s0.aid, 'happy')} alt=""/><p className="msx-kp" data-msx-r3-qsay>{say}</p></div>
    <div className="q-sec"><h3><i>1</i>行き先<span className="tk">🎫 チケット {tickets}枚</span></h3>
      <div className="r3-bar q-dest">{courses.map((k) => <button type="button" key={k} className={`r3-chip ${k === course ? 'on' : ''}`} onClick={() => setCourse(k)} data-msx-r3-course={k}>{SH.courses[k].name}</button>)}</div>
      <div className="v-stg">{cur.stages.map((pair, i) => <React.Fragment key={i}><div><small>第{i + 1}段</small>{pair.map((k) => `${MSX_STAT_ICON[k]} ${MSX_STAT_NAME[k]}`).join(' & ')}</div><i>▶</i></React.Fragment>)}<div className="last"><small>さいごに</small>✨ 技を覚える</div></div>
      {pvRows.length ? <div className="q-pv" data-msx-r3-qpv>
        <button type="button" className="q-pv-h q-tgl" onClick={() => setPvOpen(!pvOpen)} aria-expanded={pvOpen}>📈 上がる見込み{isSuper ? '（🔥超修行・2回分）' : ''}{pvOpen ? null : <span className="q-pv-sum">{pvTop.map(({ k, exp }) => `${MSX_STAT_NAME[k]} +${exp}`).join('・')}{pvRows.length > 2 ? ` ほか${pvRows.length - 2}つ` : ''}</span>}<span className="q-tgl-t">{pvOpen ? '閉じる ▴' : '開く ▾'}</span></button>
        {pvOpen ? <><div className="q-pv-grid">{pvRows.map(({ k, p, exp }) => (<div className="q-pv-c" key={k}>
          <div className="q-pv-r1"><span className="q-pv-k">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span><b className="q-pv-t">+{exp}</b></div>
          <div className="q-pv-r2">
            {p.base > 0 ? <span className="q-pv-p course">⛰️<b>+{shFmt(p.base)}</b></span> : null}
            {(p.team || []).map((x, n) => <span key={n} className="q-pv-p team">{shThumb((s0.team || [])[x.i])}<b>+{shFmt(x.v)}</b><small>{['得意1', '得意2', '得意3'][x.top] || '得意'}</small></span>)}
          </div>
        </div>))}</div>
        {pvMul ? <div className="q-pv-mul msx-kp">{mulLine(pvMul, isSuper)}</div> : null}</> : null}
      </div> : null}
      {SUC.DIST_UP && SUC.DIST_UP.course && Number.isInteger(SUC.DIST_UP.course[course]) ? <div className="q-note msx-kp" data-msx-r3-qapt>📏 「{MSX_R3_DIST[SUC.DIST_UP.course[course]]}」の間合いの修行。ときどき、その間合い適性が1段上がる{typeof SUC.aptUpRoom === 'function' && !SUC.aptUpRoom(s0, SUC.DIST_UP.course[course], 'quest') ? '(この育成では、もう上がらない)' : ''}</div> : null}
    </div>
    <div className="q-sec"><h3><i>2</i>覚えたい技<span className="tk">2つで🔥超修行・残り{superLeft}回</span></h3>
      <div className="q-slots">{slot(want[0])}{slot(want[1])}</div>
      {isSuper ? <div className="q-note y msx-kp" data-msx-r3-super>🔥 超修行: チケット{superTk}枚・2つとも覚えることがある・覚える率 +{SH.superAdd || 15}%・能力の上がりと疲れは2回分</div> : null}
      {superWhy && want.length ? <div className="q-note msx-kp" data-msx-r3-superwhy>🔥 {superWhy}ので、技は1つだけ選べる(別の技を押すと入れ替わる)</div> : null}
    </div>
    <div className="q-sec q-list" data-msx-r3-techlist><h3><i>3</i>覚えられる技<span className="tk">タップで右に詳しさ・入れ替え</span></h3>
      {all.length ? <div className="q-twrap"><MsxTechGrid className="q" all={all} head={aptHead} cell={(alts, r, d, cellK) => {
        // 詳細の技の升目と同じ部品(2026-11-15 社長 r1115-040)。升の技: 覚えた技 → 選んだ技(その升の選び) → 並びの1つ目
        const gotOf = (x) => (s0.techs || []).includes(x.id);
        const pk = s0.techPick && typeof s0.techPick === 'object' ? s0.techPick[cellK] : null;
        const t = alts.find((x) => x.id === pk && !gotOf(x)) || alts.find(gotOf) || alts.find((x) => x.id === pk) || alts[0];
        const got = gotOf(t); const ok = rateOf[t.id] != null; const sel = want.includes(t.id);
        const cs = got || ok ? [] : condsOf(t); const ng = cs.find((x) => !x.ok);
        const state = sel ? 'sel' : got ? 'got' : ok ? 'ok' : 'lock';
        const rk = Math.max(1, Math.min(5, Number(t.rank) || 1));
        return (<button type="button" className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'} q-cell ${state}${got || ok || sel ? ' got' : ' tg-not'}${focusTech && focusTech.id === t.id ? ' foc' : ''}`} data-msx-r3-tech={t.id} data-msx-cell={cellK}
          aria-label={`${t.name}${got ? '(覚えた)' : sel ? '(選んだ)' : ok ? `(覚えられる ${Math.round(rateOf[t.id] * 100)}%)` : full ? '(技がいっぱい)' : ng ? `(${ng.short})` : '(条件あり)'}`}
          onClick={() => setFocusT(t)}>
          <span className="ti" aria-hidden="true"><MsxSkillArt t={t} uid={`q${r}${d}`}/></span><span className={`tg-rk rk${rk}`} aria-hidden="true">{rk}</span>
          {got && typeof msxMasteryOf === 'function' ? <span className="tg-ms" aria-hidden="true" data-msx-tech-ms={msxMasteryOf(s0.mastery, t.id)}><i style={{ width: `${msxMasteryOf(s0.mastery, t.id)}%` }}/></span> : null}{/* 覚えた技の熟練のゲージ(r1115-082) */}
          {got ? <span className="g qb" aria-hidden="true">済</span> : ok ? <span className="g qb" aria-hidden="true">{Math.round(rateOf[t.id] * 100)}%</span> : <span className="g qb" aria-hidden="true">🔒</span>}
          {alts.length > 1 ? <span className="tg-alt" aria-hidden="true" data-msx-alt={cellK} data-msx-alt-n={alts.length}>⇄{alts.length}</span> : null}{/* 同じマスに技が2つ以上ある印(r1115-146①)。押せない */}
          <span className="tg-nm" aria-hidden="true">{msxTechNm(t.name)}</span>{/* 技の名前帯(2026-11-17 あっくん「1画面でみにくい」。2026-11-18 表を全幅にして名前は折り返して全部出す) */}
        </button>);
      }}/>{(() => { const ft = focusTech; if (!ft) return null; const fGot = (s0.techs || []).includes(ft.id); const fSel = want.includes(ft.id); const fOk = rateOf[ft.id] != null; const fConds = fOk || fGot ? [] : condsOf(ft); return (
        <div className="q-td side msx-kp" data-msx-r3-qtd={ft.id}>
          <div className="q-td-nm"><b>{ft.name}</b><em>{fGot ? '覚えた' : fSel ? '選んだ' : fOk ? `覚えられる ${Math.round(rateOf[ft.id] * 100)}%` : '条件あり'}</em></div>
          <div className="q-td-rows">{tdRows(ft)}</div>
          {/* U-18: 覚える率が上がる条件(条件1〜4・満たすと「済」)。参考 te-67・68。数え方は選んだ枠と同じ techBoostConds(この技を選んだときの組み合わせ) */}
          {!fGot && fOk && typeof SUC.techBoostConds === 'function' ? (() => { const bc = SUC.techBoostConds(s0, ft, fSel ? want : [...want.slice(0, superWhy ? 0 : 1), ft.id]).slice(0, 4); const BC = { n: (c) => `覚えた技 ${c.need}つ以上`, pop: (c) => `人気 ${c.need}以上`, sum: (c) => `選んだ技の段の合計 ${c.need}以上` }; return bc.length ? (
            <ul className="q-td-conds" data-msx-r3-qtd-conds>{bc.map((c, i) => <li key={`${c.type}${i}`} className={c.ok ? 'ok' : ''}><i>条件{i + 1}</i><span>{(BC[c.type] || (() => ''))(c)}</span><em>{c.ok ? '済 +5%' : 'まだ'}</em></li>)}</ul>) : null; })() : null}
          {fGot ? null : fOk ? (
          <div className="q-td-act">
            {want[0] === ft.id ? <button type="button" className="off" onClick={() => toggle(ft.id)}>1つ目から外す</button>
              : <button type="button" onClick={() => pickInto(ft.id, 0)}>{superWhy && want.length ? 'この技に入れ替える' : '1つ目に入れる'}</button>}
            {!superWhy && want.length ? (want[1] === ft.id ? <button type="button" className="off" onClick={() => toggle(ft.id)}>2つ目から外す</button>
              : <button type="button" onClick={() => pickInto(ft.id, 1)}>2つ目に入れる</button>) : null}
          </div>) : (
          <div className="q-lock q-td-cond">
            {full ? <p>覚えられる技は {tkMax}つまで。いまは いっぱいです</p> : null}
            {fConds.map((c, i) => <div key={c.k} className={c.ok ? 'ok' : ''}><i>条件{i + 1}</i><span className="msx-kp">{c.long}</span><b>{c.ok ? '済' : 'まだ'}</b></div>)}
            {!full && fConds.length ? <p>条件を全て満たすと、緑の「覚えられる」になります</p> : null}
          </div>)}
        </div>); })()}</div> : <div className="q-note msx-kp">このモンスターの技の表がまだありません(能力だけ上がる)</div>}
      <div className="q-note msx-kp">ランクが高い技ほど覚えにくい。能力・忠誠度・人気がよく仕上がっているほど、行き先の旬の季節ほど覚えやすい。外した技は、その技だけ次から覚えやすくなる。{typeof msxBetaAidOk !== 'function' || msxBetaAidOk('dra') ? '助手がドラだと、さらに覚えやすい' : ''}</div>
    </div>
  </>);
  const hpShort = shortOf(isSuper);
  const foot = (<>
    {/* 「技を選ばなくても修行できます」は上の吹き出し「選ばなくても能力は上がるよ」と二重なのでやめた(2026-11-20 r1119-033 育-62・育-64) */}
    {hpShort ? <div className="q-hpng msx-kp" data-msx-r3-qhp>💔 {isSuper ? '超修行' : '修行'}は体力を {hpOf(isSuper)} 使う。体力があと <b>{hpShort}</b> 足りない(休む・遊ぶで回復)</div> : null}
    <div className="v-ft">{/* 戻るは左上の1つ(2026-11-20 r1119-013 ⑥ API 点検) */}<button type="button" className={`go${hpShort ? ' off' : ''}`} disabled={tickets <= 0 || hpShort > 0} onClick={go} data-msx-r3-shugyo>{hpShort ? `体力があと${hpShort}足りない` : <>{isSuper ? '🔥 超修行する' : '⚔ 修行する'}(🎫 {tickets} → {Math.max(0, tickets - (isSuper ? superTk : 1))})</>}</button></div></>);
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}
