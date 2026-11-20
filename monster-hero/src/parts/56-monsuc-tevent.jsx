// ===== モンヒロサクセスの「トレーニングのあとの出来事」を1枚の場面で見せる(2026-11-13 社長「ターン後のイベントが下部にぽつんとで地味」) =====
// トレーニングの結果のあと、編成のモンスターとの出来事(芯の trainEvent: out.event = { who, story } か { who, lottery })があったときだけ挟む。
// 中身は芯がもう足し終えている(ここは見せるだけ・何も保存しない)。入り方は MSX_TEV_STYLE(社長の決めで 'b' カットイン。'a' 暗転 / 'c' 「EVENT」の帯 は案のときの形)
//   画面 MsxTrainEvent({ run, o, ctx, style }) … o = トレーニングの結果(run.out)。台詞は台本の cheer.base.ep<N>(お話)/ cheer.lot.<種類>(小さな出来事)

const MSX_TEV_STYLE = 'b'; // 社長の決め(2026-11-13): B カットイン(2体の顔と「◯◯との出来事!」の斜めの帯)
const MSX_TEV_LOT = Object.freeze({ self: 'drill', rest: 'rest', talk: 'chat', tip: 'tip', pal: 'friend', friend: 'friend' });
const MSX_TEV_LOT_NAME = Object.freeze({ self: 'いっしょに自主練', rest: 'ひと休み', talk: 'おしゃべり', tip: 'コツを教わる', pal: 'なかよし', friend: 'なかよし' });

// 変わったこと(芯の trainEvent と同じ中身を文にする)
const msxTevChanges = (s, o) => {
  const e = o && o.event; if (!e) return [];
  // 芯が動いた数(e.d)を持っているときは、言葉でなく実際の数で出す(2026-11-14 社長・r1114-098)。能力はゲージ(MsxStRow)が出すので、ここは能力以外
  if (e.d && typeof e.d === 'object') {
    const d = e.d; const out = []; const sg = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
    if (d.bond) out.push(`🤝 親密度 ${sg(d.bond)}`);
    if (d.hp) out.push(`❤️ 体力 ${sg(d.hp)}`);
    if (d.stress) out.push(`💢 ストレス ${sg(d.stress)}`);
    const SUC = msxSuc && msxSuc.SUC;
    if (e.story === 3) out.push(o.taught ? `⚔ 技「${(SUC.techsOf(s.species).find((t) => t.id === o.taught) || {}).name || '新しい技'}」を覚えた!` : '⚔ 技の熟練 +10');
    if (e.lottery === 'tip') out.push('💡 コツをつかんだ(次のトレーニングの大成功 +10%)');
    return out;
  }
  const SUC = msxSuc && msxSuc.SUC; const m = s.team[e.who]; const fk = m && Array.isArray(m.top) ? m.top[0] : null;
  const stat = fk && typeof MSX_STAT_NAME !== 'undefined' ? MSX_STAT_NAME[fk] : '能力';
  const out = [];
  if (e.story) {
    const st = SUC && SUC.STORY ? SUC.STORY[e.story - 1] : null;
    out.push(`🤝 親密度 +${st ? st.bond : 10}`);
    if (e.story === 1) out.push(`${stat} 小アップ`);
    else if (e.story === 2) { out.push(`${stat} 中アップ`); out.push('❤️ 体力 −10'); }
    else { out.push(`${stat} 中アップ`); out.push(o.taught ? `⚔ 技「${(SUC.techsOf(s.species).find((t) => t.id === o.taught) || {}).name || '新しい技'}」を覚えた!` : '⚔ 技の熟練 +10'); }
  } else {
    const k = e.lottery;
    if (k === 'self') { out.push(`${stat} 小アップ`); out.push('🤝 親密度 +5'); }
    else if (k === 'rest') out.push('❤️ 体力 +10');
    else if (k === 'talk') { out.push('💢 ストレス −10'); out.push('🤝 親密度 +5'); }
    else if (k === 'tip') out.push('💡 コツをつかんだ(次のトレーニングの大成功 +10%)');
    else out.push('🤝 親密度 +10');
  }
  return out;
};

// 編成の子の出来事(第1〜3話)の台本の役割。いちばん得意な能力で決める(Fable の点検 ①-16: ベースモンはどの種でも同じ1行だった)。
//   ちから=攻め・丈夫さ=守り・ライフ=癒し・かしこさ=支え・命中/回避=影。得意が分からない子は種の名前で散らす
const MSX_CHEER_TYPE = Object.freeze({ pow: 'attacker', tough: 'tank', life: 'healer', wise: 'supporter', hit: 'shadow', eva: 'shadow' });
const msxCheerType = (m) => {
  const top = m && Array.isArray(m.top) ? m.top[0] : null;
  if (top && MSX_CHEER_TYPE[top]) return MSX_CHEER_TYPE[top];
  const k = String((m && m.species) || ''); let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return ['attacker', 'tank', 'supporter', 'healer', 'shadow'][h % 5];
};

// ---- 6つの拍(r1119-034・案 docs/progress/scenario/monsuc-event-flow/README.md) ----
//   1 入り(帯が滑り込む・自動)→ 2 場面(育成中の子だけ・間をとる・自動)→ 3 見せ場(編成の子が出てくる・地の文)
//   → 4 台詞(助手の名札つきのひとこと)→ 5 結果が弾ける(自動)→ 6 つづく。「飛ばす」は結果だけを1枚で出す(-1)
//   拍の位置は呼ぶ側(MsxPlay)が持つ(足元のボタンと分け合うため)。保存はしない(続きから開くと拍1から)
// 結果の拍の一言(数字は弾けと札が出すので、文はきっかけだけ)
const MSX_TEV_RES = Object.freeze({ self: (n) => `${n}といっしょに、夢中で体を動かした。`, rest: (n) => `${n}とゆっくり休んで、元気が出た。`, talk: (n) => `${n}とたくさん話して、気持ちが軽くなった。`, tip: (n) => `${n}に教わったコツが、体に入ってきた。`, pal: (n) => `${n}と、ますます なかよくなった。`, friend: (n) => `${n}と、ますます なかよくなった。` });
const MSX_TEV_WAIT = Object.freeze({ in: 1300, scene: 900 });
// 1つの窓は2行・30字まで。長い文は「。」などの区切りで窓を分ける
const msxTevSplit = (t) => {
  const s = String(t || '').trim(); if (!s) return [];
  const parts = s.match(/[^。！？!?…]+[。！？!?…]*[」』）)]?/g) || [s];
  const out = []; let cur = '';
  for (const p of parts) { if (cur && (cur + p).length > 30 && !(p.length < 10 && (cur + p).length <= 44)) { out.push(cur); cur = p; } else cur += p; }
  if (cur) out.push(cur);
  return out;
};
// 台本の行(地の文・助手)を拍に並べる。呼ぶ側の足元も同じ並びを使う
const msxTevSteps = (run, o, ctx) => {
  const s = run.s; const e = o.event; const m = s.team[e.who];
  const name = typeof msxMemberName === 'function' ? msxMemberName(m) : '編成のモンスター';
  const se = msxSuc && msxSuc.script; const c = { ...ctx, cheer: name };
  // 助手の台本は共通の台本より後ろに読まれるので、選択肢の札より後ろ(after)に並ぶ。地の文は前(lines)だけ・台詞は両方から
  const take = (ev) => ({ narr: (ev.lines || []).filter((r) => r && r.t && r.who === 'narr'), talk: [...(ev.lines || []), ...(ev.after || [])].filter((r) => r && r.t && r.who !== 'narr') });
  let got = { narr: [], talk: [] };
  try {
    if (e.story && se && typeof se.event === 'function') {
      got = take(se.event(`cheer.${msxCheerType(m)}.ep${e.story}`, c));
      if (!got.narr.length) got = take(se.event(`cheer.base.ep${e.story}`, c));
    } else if (se && typeof se.event === 'function') got = take(se.event(`cheer.lot.${MSX_TEV_LOT[e.lottery] || 'friend'}`, c));
  } catch (er) { got = { narr: [], talk: [] }; }
  const narr = got.narr; const talk = got.talk;
  if (!narr.length) narr.push({ who: 'narr', t: `${name}と、すこし特別な時間をすごした。` });
  const steps = e.story ? [{ b: 1 }, { b: 2 }] : [{ b: 1 }]; // 小さな出来事は間をとらない
  narr.forEach((r) => msxTevSplit(r.t).forEach((t) => steps.push({ b: 3, who: 'narr', t })));
  talk.forEach((r) => msxTevSplit(r.t).forEach((t) => steps.push({ b: 4, who: r.who, e: r.e, t })));
  // 結果は1つずつ: 能力(と体力・ストレスなど)→ 親密度
  const pops = msxTevPops(s, o); const bFrom = e.d && Number.isFinite(e.d.bondFrom) ? e.d.bondFrom : s.bond[e.who];
  if (pops.length) steps.push({ b: 5 });
  if (bFrom !== s.bond[e.who]) steps.push({ b: 5, k: 'bond' });
  if (!pops.length && bFrom === s.bond[e.who]) steps.push({ b: 5 });
  if (msxTevNextText(run, o)) steps.push({ b: 6 });
  return steps;
};
// 弾けさせる結果(親密度はハートの棒が受け持つので入れない)
const msxTevPops = (s, o) => {
  const e = o.event; const d = e.d && typeof e.d === 'object' ? e.d : null; const out = [];
  if (d && d.stat && Number(d.up) > 0) out.push({ k: 'st', t: `${MSX_STAT_NAME[d.stat] || '能力'} +${d.up}` });
  const fromTo = (now, dv, max) => (Number.isFinite(now) && Number.isFinite(dv) && dv ? `(${Math.max(0, Math.min(max, Math.round(now - dv)))}→${Math.round(now)})` : '');
  msxTevChanges(s, o).filter((t) => !/親密度/.test(t)).forEach((t) => {
    const tx = t.replace(/^[^ぁ-んァ-ヶ一-龠A-Za-z0-9]+\s*/, '');
    const sub = d && /^体力/.test(tx) ? fromTo(s.hp, d.hp, s.hpMax) : d && /^ストレス/.test(tx) ? fromTo(s.stress, d.stress, 100) : '';
    // 体力・ストレスは、親密度と同じ「棒つきの箱」で前から後へ動かす(上の帯は畳んでいるので、ここが持ち場)
    const g = d && /^体力/.test(tx) && d.hp ? { lb: '体力', to: s.hp, from: s.hp - d.hp, max: s.hpMax } : d && /^ストレス/.test(tx) && d.stress ? { lb: 'ストレス', to: s.stress, from: s.stress - d.stress, max: 100 } : null;
    out.push({ k: /−/.test(t) && !/ストレス/.test(t) ? 'dn' : /ストレス|体力/.test(tx) ? 'gd' : 'up', t: tx, sub, g });
  });
  return out;
};

// 「つづく」の文(その1・その2のあとだけ)。2行目で言葉を折らないよう、改行の場所を決めて返す
const msxTevNextText = (run, o) => {
  const s = run.s; const e = o.event; const m = s.team[e.who];
  const ST = msxSuc && msxSuc.SUC && msxSuc.SUC.STORY;
  if (!e.story || e.story >= 3 || !ST || !ST[e.story]) return '';
  const name = typeof msxMemberName === 'function' ? msxMemberName(m) : '編成のモンスター';
  return s.bond[e.who] >= ST[e.story].need ? `その${e.story + 1}は、${name}がいる\nトレーニングをまた選んだとき` : `その${e.story + 1}は、${name}との\n親密度が ${ST[e.story].need} になったら`;
};

// 体力・ストレスの棒つきの箱(前の値から後の値へ動く)
function MsxTevGauge({ g, t, delay = 0, kind = '', children = null }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), delay * 1000 + 250); return () => clearTimeout(id); }, []);
  const v = on ? g.to : g.from; const max = Math.max(1, g.max);
  return <div className={`tev-gauge${kind ? ` ${kind}` : ''}`} style={{ animationDelay: `${delay}s` }} data-msx-tev-gauge={kind || g.lb}>
    <span>{t}</span><i><b style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }}/></i><em><small>{Math.round(g.from)} → </small>{Math.round(v)}<small>/{Math.round(max)}</small></em>{on ? children : null}</div>;
}

function MsxTevMini({ s, v }) {
  const cal = typeof msxCalendar === 'function' ? msxCalendar(s.turn) : null;
  return <div className="tev-mini" data-msx-tev-mini><b>{v && v.period ? v.period.name : ''}</b>{cal ? <span>{cal.year}年目 {cal.month}月</span> : null}<span>体力 {Math.max(0, Math.round(s.hp))}/{Math.max(1, Math.round(s.hpMax))}</span></div>;
}

function MsxTrainEvent({ run, o, ctx, at = 0, go = null, onNext = null, style = MSX_TEV_STYLE }) {
  msxTevEnsureCss();
  const s = run.s; const e = o.event; const m = s.team[e.who];
  const name = typeof msxMemberName === 'function' ? msxMemberName(m) : '編成のモンスター';
  const title = e.story ? `${name}との出来事` : `${name}と${MSX_TEV_LOT_NAME[e.lottery] || '小さな出来事'}`;
  const steps = React.useMemo(() => msxTevSteps(run, o, ctx), [s.turn, e.who, e.story, e.lottery]);
  // 見せ場の驚き(「!!」と画面の揺れ)は、地の文が驚きの場面のときだけ(台本の動きの印は次の段で足す)
  const firstNarr = steps.find((x) => x.b === 3); const surprise = !!(e.story && firstNarr && /[!！?？]|気づ|いつの間/.test(firstNarr.t));
  const sum = at < 0;
  const i = sum ? steps.length - 1 : Math.max(0, Math.min(steps.length - 1, at));
  const st = steps[i]; const b = sum ? 7 : st.b;
  const calm = typeof msxFxCalm === 'function' && msxFxCalm();
  const pops = msxTevPops(s, o);
  const bondNow = s.bond[e.who];
  const bondFrom = e.d && Number.isFinite(e.d.bondFrom) ? e.d.bondFrom : bondNow;
  const bondUp = bondNow !== bondFrom || (e.d && e.d.bond);
  const bk = !sum && st.k === 'bond'; // 結果の2つ目(親密度)の拍
  const bondAt = 500; // 拍に入って 0.5 秒でハートが満ちる
  const [bondOn, setBondOn] = useState(false);
  const next = () => { if (!go) return; if (i < steps.length - 1 && !sum) go(i + 1); else if (onNext) onNext(); };
  // 待ちの長い拍(入り・場面・結果)は自動で次へ
  useEffect(() => {
    setBondOn(calm || sum || b > 5);
    if (sum) return undefined;
    const ids = [];
    if (b === 1) ids.push(setTimeout(next, calm ? 300 : MSX_TEV_WAIT.in));
    if (b === 2) ids.push(setTimeout(next, MSX_TEV_WAIT.scene));
    if (b === 5) { if (bk) ids.push(setTimeout(() => setBondOn(true), calm ? 0 : bondAt)); if (i < lastI) ids.push(setTimeout(next, bk ? 2400 : 600 + pops.length * 700 + 900)); }
    return () => ids.forEach(clearTimeout);
  }, [i, sum]);
  msxUseTimedSe(sum ? [] : b === 1 ? [['actTag', 0]] : surprise && b === 3 && steps[i - 1] && steps[i - 1].b === 2 ? [['actIdea', 80]] : b === 5 ? (bk ? [['itemBond', bondAt]] : pops.map((p, k) => ['actTagSpark', 300 + k * 700])) : [], [i, sum]);
  const bondShow = (b >= 5 && bondOn) || sum ? bondNow : bondFrom;
  const ups = e.d && e.d.up > 0 && e.d.stat ? { [e.d.stat]: e.d.up } : null;
  const shown = b >= 5 ? s.stats : (ups ? { ...s.stats, [e.d.stat]: s.stats[e.d.stat] - e.d.up } : s.stats);
  const palOn = b >= 3; const pair = b >= 3;
  const nx = msxTevNextText(run, o);
  const lastI = steps.length - 1;
  const talk = st && (st.b === 3 || st.b === 4) && !sum ? st : null;
  const aidWho = talk && talk.who !== 'narr' && talk.who !== 'mon' ? talk.who : null;
  const palImg = m ? (m.colors && m.colors.some && m.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
    ? <DyedMonsterImage baseId={m.species} src={msxMonImg(m.species)} masuColors={m.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
    : <img src={msxMonImg(m.species)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>) : null;
  return (<>
    <div className={`v-scene msx-tev s-${style} tb${b}${bk ? ' bondb' : ''}${surprise ? ' wow' : ''}${calm ? ' calm' : ''}`} style={{ flex: '1 1 0' }} data-msx-tev={style} data-msx-tev-beat={sum ? 'sum' : b} onClick={sum ? undefined : next}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <div className={`tev-who me${pair ? ' pair' : ''}`}><div className="gr"/><MsxMonArt run={run} className="tev-art" style={{}} live/>{surprise && b === 3 && steps[i - 1] && steps[i - 1].b === 2 ? <span className="tev-bang" aria-hidden="true">!!</span> : null}{b === 2 && surprise ? <span className="tev-q" aria-hidden="true">?</span> : null}</div>
      {m ? <div className={`tev-who pal${palOn ? ' on' : ''}${talk && /影/.test(talk.t) ? ' tsh' : ''}${surprise && b === 3 && steps[i - 1] && steps[i - 1].b === 2 ? ' back' : ''}${b === 6 ? ' bye' : ''}${b === 4 ? ' wag' : ''}`}><div className="gr"/><div className="tev-art">{palImg}</div></div> : null}
      {pair && b !== 6 ? <><span className="tev-nm me">{run.nick || ''}</span>{m ? <span className={`tev-nm pal${talk && /影/.test(talk.t) ? ' dim' : ''}`}>{name}</span> : null}</> : null}
      {b === 5 && !bk && !calm ? <div className="tev-dust" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} style={{ animationDelay: `${k * 0.07}s`, top: `${44 + (k % 3) * 6}%` }}/>)}</div> : null}
      {b >= 2 ? <MsxEvHead kind="team" label={e.story ? `編成のモンスターのイベント その${e.story}` : undefined} title={title}/> : null}
      {b === 5 && bk && bondUp ? <div className="tev-pops" data-msx-tev-bond-row><MsxTevGauge g={{ lb: '親密度', from: bondFrom, to: bondNow, max: 100 }} t={`💗 ${name}との親密度 ${bondNow - bondFrom > 0 ? '+' : ''}${bondNow - bondFrom}`} kind={`bd${bondNow >= 100 ? ' max' : ''}`} delay={0.2}>{bondNow >= 100 ? <><strong className="mx">MAX!</strong><small className="cap">これ以上は上がりません</small></> : null}</MsxTevGauge></div> : null}
      {b === 5 && bk && !calm ? <div className="tev-hearts" aria-hidden="true">{[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ left: `${36 + k * 7}%`, animationDelay: `${0.5 + k * 0.12}s` }}>♥</i>)}</div> : null}
      {b === 5 && !bk ? <div className="tev-pops" data-msx-tev-pops>{pops.map((p, k) => (p.g
        ? <MsxTevGauge key={k} g={p.g} t={p.t} kind={/ストレス/.test(p.g.lb) ? 'st' : 'hp'} delay={0.3 + k * 0.7}/>
        : <b key={k} className={`tev-pop ${p.k}`} style={{ animationDelay: `${0.3 + k * 0.7}s` }}>{p.t}{p.sub ? <small>{p.sub}</small> : null}</b>))}</div> : null}
      {talk ? <div className={`v-talk tev-talk${aidWho ? ' say' : ' narr'}`} style={JA_LABEL_STYLE} key={i} data-msx-tev-talk={aidWho ? 'say' : 'narr'}>
        {aidWho ? <><img className="fc" src={msxFace(aidWho, talk.e || 'happy')} alt=""/><span className="who">{msxAidName(aidWho)}</span></> : null}
        <div>{jaWrap(talk.t)}</div>
        {go ? <span className="tev-tap" aria-hidden="true">▼</span> : null}
      </div> : null}
      {b === 5 ? <div className="v-talk tev-talk narr" style={JA_LABEL_STYLE} key={`res${i}`} data-msx-tev-talk="res"><div>{jaWrap(bk ? (bondNow >= 100 ? `${name}と、すっかり なかよしになった!` : `${name}との距離が、ぐっと縮まった。`) : (MSX_TEV_RES[e.story ? 'self' : e.lottery] || MSX_TEV_RES.self)(name))}</div></div> : null}
      {b === 6 && nx ? <div className="tev-next" data-msx-ev-next><b>つづく</b><span style={JA_WRAP_STYLE}>{nx.split('\n').map((t, k) => <React.Fragment key={k}>{k ? <br/> : null}{jaWrap(t)}</React.Fragment>)}</span></div> : null}
      {sum ? <div className="tev-sum" data-msx-tev-sum>
        {bondUp ? <div className="r bd">💗 {name}との親密度{bondNow >= 100 ? ' MAX!' : ` +${bondNow - bondFrom}`}<small style={{ display: 'block' }}>{bondFrom} → {bondNow}{bondNow >= 100 ? '(これ以上は上がりません)' : ''}</small></div> : null}
        {pops.map((p, k) => <div key={k} className={`r ${p.k}`}>{p.t}{p.sub ? <small> {p.sub}</small> : p.k === 'st' && ups ? <small> ({s.stats[e.d.stat] - e.d.up} → {s.stats[e.d.stat]})</small> : null}</div>)}
        {nx ? <div className="nx"><b>つづく</b><span style={JA_WRAP_STYLE}>{nx.split('\n').map((t, k) => <React.Fragment key={k}>{k ? <br/> : null}{jaWrap(t)}</React.Fragment>)}</span></div> : null}</div> : null}
      {style === 'b' && b === 1 ? <div className="tev-in-b" aria-hidden="true"><div className="band">{typeof MsxMonFace === 'function' ? <MsxMonFace species={s.species} colors={run.colors}/> : <img src={msxMonThumb(s.species)} alt=""/>}<b>{title}!</b>{m && typeof MsxMonFace === 'function' ? <MsxMonFace species={m.species} colors={m.colors}/> : <img src={m ? msxMonThumb(m.species) : ''} alt=""/>}</div></div> : null}
    </div>
    {ups ? <MsxStRow who={s} stats={shown} ups={b >= 5 && !sum ? ups : null}/> : null}
  </>);
}

const MSX_TEV_CSS = `
.msx .msx-tev{cursor:pointer;-webkit-tap-highlight-color:transparent}
.msx .msx-tev .sh{transition:background .5s}
.msx .msx-tev.tb1 .sh{background:#000d}
.msx .msx-tev.tb6 .sh{background:linear-gradient(180deg,#0006,#000a)}
.msx .msx-tev .tev-who{position:absolute;bottom:24%;height:40%;aspect-ratio:1;transform:translateX(-50%);transition:left .6s cubic-bezier(.3,1,.4,1),height .6s,opacity .5s,filter .5s;z-index:2}
.msx .msx-tev.tb1 .tev-who{opacity:0}
.msx .msx-tev .tev-who.me{left:50%}
.msx .msx-tev .tev-who.me.pair{left:29%;height:33%}
.msx .msx-tev .tev-who.pal{left:31%;height:35%;opacity:0;filter:brightness(0);z-index:1}
.msx .msx-tev .tev-who.pal.on{left:71%;opacity:1;filter:none}
.msx .msx-tev .tev-who.pal.on.back{left:52%;z-index:1}
.msx .msx-tev .tev-who.pal.bye{left:76%}
.msx .msx-tev .tev-who .tev-art{position:absolute;inset:0;display:block;width:100%;height:100%;filter:drop-shadow(0 8px 5px #0009)}
.msx .msx-tev .tev-who.pal .tev-art{transform:scaleX(-1)}
.msx .msx-tev .tev-who.pal.bye .tev-art{transform:none}
.msx .msx-tev .tev-who .gr{left:50%;bottom:-3%;width:70%;height:10%}
.msx .msx-tev.tb2 .tev-who.me{animation:tevWob 1.1s ease-in-out infinite}
@keyframes tevWob{0%,100%{rotate:-3deg}50%{rotate:3deg}}
.msx .msx-tev .tev-q{position:absolute;right:4%;top:-4%;font-size:26px;font-weight:900;color:#e0e7ff;-webkit-text-stroke:2px #312e81;paint-order:stroke fill;animation:tevBang .5s .3s cubic-bezier(.2,1.6,.4,1) both}
.msx .msx-tev .tev-bang{position:absolute;right:0;top:-8%;font-size:36px;font-weight:900;font-style:italic;color:#fde047;-webkit-text-stroke:3px #7c2d12;paint-order:stroke fill;animation:tevBang .5s cubic-bezier(.2,1.6,.4,1) both}
@keyframes tevBang{from{opacity:0;scale:.3}to{opacity:1;scale:1}}
.msx .msx-tev.wow.tb3{animation:tevShake .42s .1s ease-out both}
@keyframes tevShake{0%,100%{translate:0}20%{translate:-6px 2px}40%{translate:5px -2px}60%{translate:-3px 1px}80%{translate:2px 0}}
.msx .msx-tev.wow.tb3 .tev-who.me .tev-art{animation:tevHop .5s .1s ease-out both}
@keyframes tevHop{0%,100%{translate:0}40%{translate:0 -18%}}
.msx .msx-tev .tev-who.pal.wag{animation:tevWag .9s ease-in-out 2}
@keyframes tevWag{0%,100%{rotate:0deg}25%{rotate:-5deg}75%{rotate:5deg}}
.msx .msx-tev .tev-talk{bottom:8px;z-index:4;min-height:54px;animation:tevUp .3s ease-out both}
.msx .msx-tev .tev-talk.narr{background:#0f0d24eb;color:#f8fafc;border:1px solid #a5b4fc66;padding:10px 26px 10px 14px;font-size:13.5px;line-height:1.65}
.msx .msx-tev .tev-talk.say{padding:14px 26px 10px 64px;font-size:13.5px;line-height:1.65}
.msx .msx-tev .tev-talk.say .who{left:64px}
.msx .msx-tev .tev-talk .fc{position:absolute;left:8px;bottom:8px;width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:top;background:#fde68a;border:2px solid #fb923c}
.msx .msx-tev .tev-tap{position:absolute;right:10px;bottom:6px;font-size:10px;color:#fb923c;animation:tevTap 1s ease-in-out infinite}
.msx .msx-tev .tev-talk.narr .tev-tap{color:#a5b4fc}
@keyframes tevTap{0%,100%{translate:0;opacity:.5}50%{translate:0 3px;opacity:1}}
@keyframes tevUp{from{opacity:0;translate:0 10px}to{opacity:1;translate:0}}
.msx .msx-tev .tev-bond{position:absolute;left:8px;right:8px;top:50px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:#fbcfe8;background:#0f0d24d9;border-radius:999px;padding:4px 10px;z-index:3;animation:tevUp .3s ease-out both}
.msx .msx-tev .tev-bond i{flex:1;height:8px;border-radius:6px;background:#334155;overflow:hidden}
.msx .msx-tev .tev-bond i b{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fb7185);transition:width .9s ease-out}
.msx .msx-tev .tev-bond em{font-style:normal;color:#fff;font-size:12px}
.msx .msx-tev .tev-bond em small{font-size:10px;color:#fbcfe8}
.msx .msx-tev .tev-bond.max{box-shadow:0 0 0 2px #fde047,0 0 16px #f472b6}
.msx .msx-tev .tev-bond .mx{color:#fde047;font-size:12px;font-style:italic;animation:tevBang .45s cubic-bezier(.2,1.6,.4,1) both}
.msx .msx-tev .tev-pops{position:absolute;left:0;right:0;top:24%;display:flex;flex-direction:column;align-items:center;gap:4px;z-index:5;pointer-events:none}
.msx .msx-tev .tev-pop{max-width:92%;text-align:center;line-height:1.2;font-size:21px;font-weight:900;color:#fff;-webkit-text-stroke:3px #9d174d;paint-order:stroke fill;text-shadow:0 0 14px #f9a8d4;animation:tevPop .6s cubic-bezier(.2,1.6,.4,1) both}
.msx .msx-tev .tev-pop small{display:block;font-size:14px;font-style:normal;-webkit-text-stroke-width:2px}
.msx .msx-tev .tev-bond em small.dl{color:#fde047;font-size:11px}
.msx .msx-tev .tev-bond.big em small.dl{font-size:17px}
.msx .msx-tev .tev-sum .r small{font-size:12px;color:#cbd5e1}
.msx .msx-tev .tev-sum .nx{display:flex;gap:8px;align-items:baseline}
.msx .msx-tev .tev-pop.st{animation:tevPop .6s cubic-bezier(.2,1.6,.4,1) both,tevToRow .7s 1.5s ease-in forwards;font-size:38px;font-style:italic;color:#fef08a;-webkit-text-stroke-color:#a16207;text-shadow:0 0 18px #fde047}
.msx .msx-tev .tev-pop.gd{-webkit-text-stroke-color:#0f766e;text-shadow:0 0 14px #5eead4}
.msx .msx-tev .tev-who.pal.on.tsh{opacity:.45}
.msx .msx-tev .tev-bond.big{top:58px;left:12%;right:12%;flex-wrap:wrap;justify-content:center;padding:10px 14px;border-radius:16px;font-size:13px;background:#1f0f2ee6;border:2px solid #f472b6}
.msx .msx-tev .tev-bond.big i{flex:1 1 100%;height:12px}
.msx .msx-tev .tev-bond.big em{font-size:18px}
.msx .msx-tev .tev-bond.big .cap{flex:1 1 100%;text-align:center;font-size:11px;color:#e9d5ff;font-weight:800}
.msx .msx-tev .tev-bond.big .mx{font-size:22px}
.msx .msx-tev .tev-sum .r.bd{color:#fbcfe8;font-size:19px}
.msx .msx-tev .tev-pop.dn{-webkit-text-stroke-color:#1e3a8a;text-shadow:none}
@keyframes tevToRow{to{opacity:0;scale:.35;translate:0 260px}}
@keyframes tevPop{0%{opacity:0;scale:.2;translate:0 30px}60%{opacity:1;scale:1.15}100%{opacity:1;scale:1;translate:0}}
.msx .msx-tev .tev-dust{position:absolute;inset:0;z-index:3;pointer-events:none}
.msx .msx-tev .tev-dust i{position:absolute;left:70%;width:9px;height:9px;border-radius:50%;background:#fef9c3;box-shadow:0 0 10px #fde047,0 0 4px #fff;animation:tevDust .75s ease-in both}
@keyframes tevDust{0%{left:70%;opacity:0}20%{opacity:1}100%{left:30%;opacity:0;scale:.4}}
.msx .msx-tev .tev-pops:has(.tev-gauge){top:56px}
.msx .msx-tev .tev-gauge{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;width:78%;padding:10px 14px;border-radius:16px;background:#0f0d24eb;border:2px solid #5eead4;color:#fff;font-weight:900;animation:tevPop .6s cubic-bezier(.2,1.6,.4,1) both}
.msx .msx-tev .tev-gauge>span{flex:1 1 100%;text-align:center;font-size:19px;color:#f1f5f9}
.msx .msx-tev .tev-gauge i{flex:1;height:12px;border-radius:8px;background:#334155;overflow:hidden}
.msx .msx-tev .tev-gauge i b{display:block;height:100%;background:linear-gradient(90deg,#2dd4bf,#5eead4);transition:width .9s ease-out}
.msx .msx-tev .tev-gauge.st i b{background:linear-gradient(90deg,#a78bfa,#c084fc)}
.msx .msx-tev .tev-gauge.bd{border-color:#f472b6}
.msx .msx-tev .tev-gauge.bd i b{background:linear-gradient(90deg,#f472b6,#fb7185)}
.msx .msx-tev .tev-gauge.bd.max{box-shadow:0 0 0 2px #fde047,0 0 18px #f472b6}
.msx .msx-tev .tev-gauge em{font-style:normal;font-size:18px;white-space:nowrap}
.msx .msx-tev .tev-gauge em small{font-size:12px;color:#cbd5e1}
.msx .msx-tev .tev-gauge .mx{flex:1 1 100%;text-align:center;color:#fde047;font-size:22px;font-style:italic;animation:tevBang .45s cubic-bezier(.2,1.6,.4,1) both}
.msx .msx-tev .tev-gauge .cap{flex:1 1 100%;text-align:center;font-size:11px;color:#e9d5ff;font-weight:800}
.msx .msx-tev .tev-hearts{position:absolute;inset:0;z-index:3;pointer-events:none}
.msx .msx-tev .tev-hearts i{position:absolute;bottom:52%;font-style:normal;font-size:22px;color:#f472b6;text-shadow:0 0 8px #fff;animation:tevHeart 1.4s ease-out both}
@keyframes tevHeart{0%{opacity:0;translate:0 20px;scale:.5}30%{opacity:1;scale:1.1}100%{opacity:0;translate:0 -70px;scale:1}}
.msx .msx-tev.bondb .tev-who .tev-art{animation:tevHop .5s .5s ease-out 2 both}
.msx .msx-tev .tev-nm{position:absolute;bottom:calc(24% - 28px);transform:translateX(-50%);z-index:3;padding:2px 11px;border-radius:999px;background:#fffdf5;color:#1e1b4b;border:2px solid #fb923c;font-size:12px;font-weight:900;white-space:nowrap;transition:left .6s cubic-bezier(.3,1,.4,1),opacity .5s;animation:tevUp .4s .3s ease-out both}
.msx .msx-tev .tev-nm.me{left:29%}
.msx .msx-tev .tev-nm.pal{left:71%;border-color:#a78bfa}
.msx .msx-tev .tev-nm.dim{opacity:.45}
.msx .msx-tev .tev-next{position:absolute;left:8px;right:8px;bottom:8px;z-index:4;padding:8px 12px;border-radius:10px;background:#0f0d24d9;color:#e2e8f0;font-size:12.5px;font-weight:800;line-height:1.55;display:flex;gap:8px;align-items:baseline;text-align:left;animation:tevUp .5s ease-out both}
.msx .msx-tev .tev-next b{color:#fdba74;white-space:nowrap;font-size:12px}
.msx .msx-tev .tev-sum{position:absolute;left:8px;right:8px;top:58px;z-index:5;background:#0f0d24eb;border:1px solid #f472b6;border-radius:14px;padding:12px 14px;color:#fff;display:flex;flex-direction:column;gap:6px;text-align:center;cursor:default}
.msx .msx-tev .tev-sum .h{font-size:12.5px;color:#fbcfe8;font-weight:900}
.msx .msx-tev .tev-sum .r{font-size:17px;font-weight:900}
.msx .msx-tev .tev-sum .r.st{color:#fef08a;font-size:22px}
.msx .msx-tev .tev-sum .r.dn{color:#93c5fd}
.msx .msx-tev .tev-sum .nx{margin-top:2px;font-size:11.5px;font-weight:800;color:#cbd5e1;text-align:left;line-height:1.5}
.msx .msx-tev .tev-sum .nx b{color:#fdba74}
.msx .tev-mini{flex:none;display:flex;gap:10px;align-items:center;margin-top:5px;padding:3px 12px;border-radius:999px;background:#1d1740;border:1px solid #3b3566;font-size:11px;font-weight:800;color:#cbd5e1}
.msx .tev-mini b{color:#fff}
.msx .tev-in-b{position:absolute;inset:0;z-index:6;pointer-events:none;display:flex;align-items:center;animation:tevBfade 1.4s ease-in both}
.msx .tev-in-b .band{width:120%;margin-left:-10%;transform:skewY(-6deg);display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 0;background:linear-gradient(90deg,#db2777,#f472b6 30%,#fbcfe8 50%,#f472b6 70%,#db2777);box-shadow:0 0 0 3px #fff,0 0 30px #f472b6;animation:tevBand 1.4s cubic-bezier(.2,.9,.3,1) both}
.msx .tev-in-b .band img{width:54px;height:54px;border-radius:50%;background:#fff;border:3px solid #fff;object-fit:contain}
.msx .tev-in-b .band b{font-size:20px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #9d174d;paint-order:stroke fill;white-space:nowrap}
@keyframes tevBand{0%{transform:skewY(-6deg) translateX(110%)}25%,75%{transform:skewY(-6deg) translateX(0)}100%{transform:skewY(-6deg) translateX(-110%)}}
@keyframes tevBfade{0%,80%{opacity:1}100%{opacity:0}}
.msx .msx-tev.calm,.msx .msx-tev.calm *{animation:none!important;transition:none!important}
.msx .msx-tev.calm .tev-in-b{display:none}
@media (prefers-reduced-motion: reduce){.msx .tev-in-b{display:none}.msx .msx-tev,.msx .msx-tev *{animation:none!important}}
`;
let msxTevCssDone = false;
const msxTevEnsureCss = () => {
  if (msxTevCssDone || typeof document === 'undefined') return;
  msxTevCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-tev-css', '1'); el.textContent = MSX_TEV_CSS; document.head.appendChild(el);
};
