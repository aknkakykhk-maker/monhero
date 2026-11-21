// ===== モンヒロサクセスのトレーニング・修行の演出(2026-11-13 社長「トレーニングも修行も演出が入っていない」・参考動画の流れだけを取り入れる) =====
// 何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。押すと飛ばせる。「動きを減らす」設定では出さない(すぐ結果)
//   MsxTrainAct({ run, o, style, onDone }) … トレーニングの結果の字の前に、トレーニングしている場面(約1.3秒)。style: 'a' その場で動く / 'b' 集中線のカットイン
//   MsxShugyoStages({ run, o, line, onDone }) … 修行の結果の前に、助手の一言 →「STAGE 1 ◯◯&◯◯」→「STAGE 2 ◯◯&◯◯」(段ごとに景色が替わる・いっしょに修行した編成のモンスターの顔)

const MSX_ACT_MS = 2000;
// その動きをしているトレーニング(2026-11-14 社長「トレーニングも種類ごとに演出を作って」→ 見本の3種を見て OK・6種とも)
const MSX_ACT_MOVE = Object.freeze({ life: 1, pow: 1, wise: 1, hit: 1, eva: 1, tough: 1 });
// 修行の行き先ごとの動き(段1・段2)。strike 溜めて突進して斬る / slam 跳んで叩きつけ / spin 回って跳ぶ / float 浮かんで光る
const MSX_QSTAGE_MOVE = Object.freeze({ fire: ['strike', 'slam'], ice: ['slam', 'strike'], wind: ['spin', 'strike'], star: ['float', 'slam'] });
// 修行の段ごとの景色(背景の絵 + 色のかぶせ)
const MSX_QSTAGE_BG = Object.freeze({
  fire: [['forest_evening', 'rgba(255,90,20,.35)'], ['desert_oilfield', 'rgba(255,40,0,.38)']],
  ice: [['forest_morning', 'rgba(120,200,255,.35)'], ['forest_night', 'rgba(150,220,255,.4)']],
  wind: [['forest_deep', 'rgba(120,255,170,.25)'], ['desert_hall', 'rgba(200,255,220,.25)']],
  star: [['monhero_night', 'rgba(150,120,255,.3)'], ['dark_void', 'rgba(200,170,255,.3)']],
});
// 修行の行き先ごとの舞うもの
const MSX_QSTAGE_PT = Object.freeze({ fire: '🔥', ice: '❄️', wind: '🍃', star: '✨' });
// 演出の動きに合わせて鳴らす効果音(場面の id と、場面に入ってからのミリ秒)。音は表 data/success-sounds.js、鳴らす口は SuccessSound
const MSX_ACT_SE = Object.freeze({
  life: [150, 420, 690, 960, 1230, 1500].map((t) => ['actStep', t]),
  pow: [['actLeap', 380], ['actHit', 740]],
  wise: [150, 330, 510, 690, 870].map((t) => ['actBlock', t]).concat([['actIdea', 1100]]),
  hit: [['actThrow', 350], ['actHit', 740]],
  eva: [['actDodge', 250], ['actDodge', 900], ['actDodge', 1420]],
  tough: [['actDrop', 100], ['actGuard', 620]],
});
const MSX_QSTAGE_SE = Object.freeze({
  strike: [['qStage', 0], ['qCharge', 150], ['qStrike', 720]], slam: [['qStage', 0], ['qLeap', 450], ['qSlam', 780]],
  spin: [['qStage', 0], ['qLeap', 300], ['qStrike', 620], ['qStrike', 900]], float: [['qStage', 0], ['qCharge', 150], ['qShine', 760]],
});
// 鳴らして、場面が替わる・とばす(消える)と、まだ鳴っていない音を捨てる。消音・音量は SuccessSound(Audio_)側が見る
const msxUseTimedSe = (list, deps) => {
  React.useEffect(() => {
    if (!Array.isArray(list) || !list.length || typeof SuccessSound === 'undefined' || !SuccessSound.isActive()) return undefined;
    const ids = list.map(([id, ms]) => setTimeout(() => { try { SuccessSound.se(id); } catch (e) { /* 鳴らせなくても演出は続ける */ } }, Math.max(0, Number(ms) || 0)));
    return () => ids.forEach(clearTimeout);
  }, deps);
};
const msxActCalm = () => typeof msxFxCalm === 'function' && msxFxCalm();
// 修行の段の背景(行き先ごとの表 MSX_QSTAGE_BG の名前から作る。どれも story-bg の絵)
const msxQstageBgUrl = (name) => 'images/story-bg/' + String(name || 'forest_evening') + '.jpg';

function MsxTrainAct({ run, o, onDone }) {
  msxActEnsureCss();
  const k = o && o.card && MSX_TRAIN_LV[o.card.stat] ? o.card.stat : 'pow';
  // 行動の前のトレーニングLv(Lvアップした回は上がる前の段で見せる)
  const lv = msxTrainLvAt(o && Number.isFinite(o.trainLv) ? o.trainLv - (o.lvUp ? 1 : 0) : 1);
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => { if (msxActCalm()) { finish(); return undefined; } const id = setTimeout(finish, typeof msxTfxMs === 'function' ? msxTfxMs(o) : MSX_ACT_MS); return () => clearTimeout(id); }, []);
  msxUseTimedSe(msxActCalm() ? [] : (MSX_ACT_SE[k] || []).concat(lv === 5 ? [['actFlash', 600]] : []), []);
  if (msxActCalm()) return null;
  const n = (c) => Array.from({ length: c }, (_, i) => i);
  // トレーニングごと・段ごとの小物(絵は使わず CSS と絵文字で描く。段が上がるほど大きく・多く)
  let prop = null;
  if (k === 'pow') {
    prop = lv <= 2 ? <div className="pr logs">{n(lv === 1 ? 3 : 4).map((i) => <i key={i} style={{ '--i': i }}><b/></i>)}<em className="boom">💥</em></div>
      : <div className={`pr hard v${lv}`}><i className="obj">{lv === 5 ? '' : '🪨'}</i>{lv === 4 ? <i className="obj b">🪨</i> : null}<em className="boom">💥</em>{n(lv + 2).map((i) => <em key={i} className="chip" style={{ '--a': `${i * (360 / (lv + 2))}deg` }}/>)}</div>;
  } else if (k === 'tough') {
    prop = lv === 3 ? <div className="pr fall"><span className="water"/>{n(6).map((i) => <i key={i} className="drop" style={{ '--i': i }}>💧</i>)}</div>
      : <div className={`pr rock v${lv}`}>{n(lv === 4 ? 3 : 1).map((i) => <i key={i} style={{ '--i': i }}>{lv === 5 ? '☄️' : '🪨'}</i>)}<em className="ring"/></div>;
  } else if (k === 'hit') {
    prop = <div className={`pr tgt v${lv}`}>{n(lv === 4 ? 3 : 1).map((i) => <i key={i} className="t" style={lv === 4 ? { top: `${14 + i * 20}%`, right: `${i === 1 ? 20 : 5}%` } : undefined}/>)}{n(lv === 4 ? 3 : 1).map((i) => <em key={i} className="shot" style={{ '--i': i }}>{lv === 5 ? '🌠' : '⭐'}</em>)}<em className="boom">💥</em></div>;
  } else if (k === 'eva') {
    const it = [['🍂', '🍃'], ['🌰', '🍂'], ['❄️', '⚪'], ['🪨', '🪨'], ['🌠', '✨']][lv - 1];
    prop = <div className={`pr leaves v${lv}`}>{n(6 + lv * 2).map((i) => <i key={i} style={{ '--i': i }}>{it[i % 2]}</i>)}</div>;
  } else if (k === 'wise') {
    prop = lv === 1 ? <div className="pr blocks">{n(5).map((i) => <i key={i} style={{ '--i': i }}/>)}<em className="idea">💡</em></div>
      : <div className={`pr think v${lv}`}><span className="board">{lv === 2 ? n(4).map((i) => <i key={i} style={{ '--i': i, left: `${8 + (i % 2) * 46}%`, top: `${10 + Math.floor(i / 2) * 42}%` }}>🧩</i>) : lv === 3 ? <b className="maze"/> : lv === 4 ? n(7).map((i) => <i key={i} className="star" style={{ '--i': i, left: `${8 + i * 12}%`, top: `${[20, 58, 34, 72, 26, 52, 40][i]}%` }}>✦</i>) : <i className="scroll">📜</i>}</span><em className="idea">💡</em></div>;
  } else {
    prop = <div className={`pr run v${lv}`}><span className="land"/>{lv >= 4 ? n(8).map((i) => <i key={`f${i}`} className="fx" style={{ '--i': i }}>{lv === 5 ? '🔥' : '❄️'}</i>) : null}{n(3).map((i) => <i key={i} style={{ '--i': i }}>💨</i>)}</div>;
  }
  const front = k === 'tough' || k === 'eva';
  const mv = !!MSX_ACT_MOVE[k];
  // 友情タッグ・大成功・重なりの決めの演出(56-monsuc-trainfx.jsx・r1115-067〜069)。色替えと揺れの class
  const tfx = typeof msxTfxActProps === 'function' ? msxTfxActProps(o) : { cls: '', style: undefined };
  return (
    <div className={`msx-act t-${k} lv${lv}${mv ? ' mv-on' : ''}${o && o.card && Array.isArray(o.card.tags) && o.card.tags.length ? ' tagx' : ''}${tfx.cls}`} style={tfx.style} onClick={finish} data-msx-act={k} data-msx-act-lv={lv}>
      <span className={k === 'life' ? 'lines h' : 'lines'} aria-hidden="true"/>
      {mv && k === 'life' ? <span className="road" aria-hidden="true"/> : null}
      {typeof MsxActCrew === 'function' ? <MsxActCrew run={run} o={o}/> : null}
      {front ? null : prop}
      {mv && k === 'eva' ? [2, 1].map((g) => <div key={g} className={`me gh g${g}`} aria-hidden="true"><div className="mv"><MsxMonArt run={run} className="mon" noPeak/></div></div>) : null}
      <div className="me">{mv ? <div className="mv"><MsxMonArt run={run} className="mon" live noPeak/>{k === 'life' ? <i className="sweat">💦</i> : null}</div> : <MsxMonArt run={run} className="mon" live noPeak/>}</div>
      {front ? prop : null}
      {lv === 5 ? <span className="flash5" aria-hidden="true"/> : null}
      {typeof MsxTrainFinish === 'function' ? <MsxTrainFinish run={run} o={o}/> : null}
      <div className="ban"><small>{MSX_STAT_NAME[k]}のトレーニング <b>Lv.{lv}</b></small>{msxTrainIcon(k, lv)} {msxTrainName(k, lv)}!</div>
    </div>
  );
}

// 修行の段の演出(2026-11-15 社長 r1115-060 で作り込み): 助手の一言 → STAGE 1・2(行き先で決まる2つの能力。行き先の分と
// いっしょに修行した子の分が、顔から数字が飛んでゲージが伸びる)→ 編成のおかげ(行き先の外の能力。編成で変わる)→ 技のくじ(率と当たり外れ)。
// 内訳は芯の o.parts(shugyoPartsFit・合計は実際に上がった数)。タップでいつでも結果へ
const MSX_QFX_COLORS = Object.freeze(['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fb7185', '#facc15']);
const MSX_QFX_MS = Object.freeze({ say: 1000, stage: 2600, team: 2400, lot: 2800 });
function MsxQfxRows({ run, o, keys }) {
  const s = run.s; const P = o.parts || {}; const gain = o.gain || {};
  const rows = keys.filter((k) => gain[k] > 0);
  const maxG = Math.max(1, ...rows.map((k) => gain[k]));
  if (!rows.length) return <div className="qg"><div className="qg-none">この段の能力は、もう上がりきっている</div></div>;
  let d = 0; // 1つずつ順に飛ばす(段の中の通し番号)
  return (<div className="qg" data-msx-qg>
    {rows.map((k) => { const parts = P[k] || [{ src: 'course', v: gain[k] }]; const after = Math.round((s.stats || {})[k] || 0); const before = after - gain[k];
      let acc = 0; const d0 = d; d += parts.length;
      return (<div key={k} className="qg-row" data-msx-qg-row={k}>
        <span className="qg-k">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span>
        <span className="qg-bar"><i className="qg-base"/>{parts.map((x, n) => { const w = (x.v / maxG) * 42; const l = 52 + acc; acc += w;
          return <i key={n} className="qg-seg" style={{ left: `${l}%`, width: `${w}%`, background: x.src === 'course' ? '#f59e0b' : MSX_QFX_COLORS[x.i % MSX_QFX_COLORS.length], '--d': `${0.35 + (d0 + n) * 0.3}s` }}/>; })}</span>
        <span className="qg-v"><small>{msxFmt(before)}</small><b style={{ '--d': `${0.45 + (d0 + parts.length - 1) * 0.3}s` }}>→{msxFmt(after)}</b></span>
        <span className="qg-parts">{parts.map((x, n) => { const m = x.src === 'team' ? (s.team || [])[x.i] : null;
          return (<span key={n} className={`qg-p ${x.src}`} style={{ '--d': `${0.3 + (d0 + n) * 0.3}s`, '--c': x.src === 'course' ? '#f59e0b' : MSX_QFX_COLORS[x.i % MSX_QFX_COLORS.length] }} data-msx-qg-part={x.src}>
            {m ? <MsxMonFace species={m.species} colors={m.colors}/> : <em>⛰️</em>}<b>+{x.v}</b>{m ? <small>{typeof msxMemberName === 'function' ? msxMemberName(m) : '編成'}</small> : <small>行き先</small>}
            <i className="fly" aria-hidden="true">+{x.v}</i></span>); })}</span>
      </div>); })}
  </div>);
}
function MsxShugyoStages({ run, o, line, onDone }) {
  msxActEnsureCss();
  const SUC = msxSuc && msxSuc.SUC ? msxSuc.SUC : {};
  const SH = SUC.SHUGYO || null;
  const course = SH && SH.courses ? SH.courses[o.course] : null;
  const stages = course && Array.isArray(course.stages) ? course.stages : [];
  const bgs = MSX_QSTAGE_BG[o.course] || MSX_QSTAGE_BG.fire;
  const inCourse = stages.flat();
  const teamOnly = Object.keys(o.gain || {}).filter((k) => !inCourse.includes(k) && o.gain[k] > 0);
  const all = typeof SUC.techsOf === 'function' ? SUC.techsOf(run.s.species) : [];
  const tries = (o.tries || []).map((x) => ({ ...x, t: all.find((y) => y.id === x.id) })).filter((x) => x.t);
  // 段の並び: 0 助手の一言 / 1・2 STAGE / 'team' 編成のおかげ(行き先の外が上がったときだけ)/ 'lot' 技のくじ(技を選んだときだけ)
  const seq = [0, ...stages.map((_, i) => i + 1), ...(teamOnly.length ? ['team'] : []), ...(tries.length ? ['lot'] : [])];
  const [n, setN] = React.useState(0); const st = seq[n];
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => {
    if (msxActCalm()) { finish(); return undefined; }
    let t = 0; const ids = seq.map((x, i) => { t += x === 0 ? MSX_QFX_MS.say : x === 'team' ? MSX_QFX_MS.team : x === 'lot' ? MSX_QFX_MS.lot : MSX_QFX_MS.stage; return setTimeout(() => (i === seq.length - 1 ? finish() : setN(i + 1)), t); });
    return () => ids.forEach(clearTimeout);
  }, []);
  const mvs = MSX_QSTAGE_MOVE[o.course] || MSX_QSTAGE_MOVE.fire;
  const num = typeof st === 'number' ? st : 0;
  const qmv = num ? mvs[num - 1] : null;
  msxUseTimedSe(msxActCalm() || !qmv ? [] : MSX_QSTAGE_SE[qmv] || [], [n]);
  if (msxActCalm()) return null;
  const s = run.s;
  const say = line ? line('turn.drill.start', 'よし、集中していこう！') : { t: 'よし、集中していこう！' };
  const pair = num ? stages[num - 1] || [] : [];
  const [bg, tint] = bgs[Math.max(0, Math.min(bgs.length - 1, (num || stages.length) - 1))] || bgs[0];
  const sup = !!o.super;
  return (
    <div className={`msx-qst qs${typeof st === 'number' ? st : 'x'} c-${o.course || 'fire'}${st === 'team' ? ' st-team' : ''}${st === 'lot' ? ' st-lot' : ''}`} onClick={finish} data-msx-qstage={st}>
      <img key={`bg${num}`} className="bg" src={msxQstageBgUrl(bg)} alt=""/>
      <span className="tint" style={{ background: st === 0 ? 'rgba(15,13,36,.55)' : tint }}/>
      {st === 0 ? (<div className="say">
        {typeof msxFace === 'function' ? <img className="fc" src={msxFace(s.aid, 'excited')} alt=""/> : null}
        <div className="bub"><b>{course ? `${course.name}の修行${sup ? '(超修行)' : ''}` : '修行'}</b>{say && say.t}
          <span className="plan">{stages.map((p, i) => `第${i + 1}段 ${p.map((x) => MSX_STAT_NAME[x]).join('&')}`).join(' → ')}{tries.length ? ' → 技を覚える' : ''}</span></div></div>)
      : typeof st === 'number' ? (<>
        <div key={`ban${n}`} className="ban q2"><small>STAGE {num}</small>{pair.map((x) => `${MSX_STAT_ICON[x]} ${MSX_STAT_NAME[x]}`).join(' & ')}
          <em>{course ? `${course.name}で鍛える2つの能力` : '行き先で鍛える2つの能力'}{sup ? '(超修行は2回分)' : ''}</em></div>
        <div key={`pt${n}`} className="pts" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--i': i }}>{MSX_QSTAGE_PT[o.course] || '✨'}</i>)}</div>
        <div key={`me${n}`} className={`me q-${qmv}`}><span className="aura" aria-hidden="true"/><MsxMonArt run={run} className="mon" live noPeak/></div>
        {qmv === 'float' ? null : <span key={`sl${n}`} className={`slash ${qmv === 'slam' ? 's2' : 's1'}${qmv === 'spin' ? ' sp' : ''}`} aria-hidden="true"/>}
        <span key={`fl${n}`} className="qflash" aria-hidden="true"/>
        <MsxQfxRows key={`qg${n}`} run={run} o={o} keys={pair}/>
        <div className="qg-cap">⛰️ 行き先の分 + 👥 編成のモンスターの得意の分</div>
      </>) : st === 'team' ? (<>
        <div key="banT" className="ban q2"><small>BONUS</small>👥 編成のおかげ<em>いっしょに修行したモンスターの得意な能力も上がる</em></div>
        <div key="meT" className="me q-float"><span className="aura" aria-hidden="true"/><MsxMonArt run={run} className="mon" live noPeak/></div>
        <MsxQfxRows key="qgT" run={run} o={o} keys={teamOnly}/>
        <div className="qg-cap">編成を替えると、ここで上がる能力と数が変わる</div>
      </>) : (<>
        <div key="banL" className="ban q2"><small>LAST</small>✨ 技を覚える<em>{sup ? '超修行: 2つとも覚えることがある' : '選んだ技の覚える率で抽選'}</em></div>
        <div key="meL" className="me q-float"><span className="aura" aria-hidden="true"/><MsxMonArt run={run} className="mon" live noPeak/></div>
        <div className="qlot" data-msx-qlot>{tries.map((x, i) => { const r = Math.round((x.rate || 0) * 100); const stop = x.hit ? Math.max(3, r * 0.45) : Math.min(97, r + (100 - r) * 0.5);
          return (<div key={x.id} className={`ql ${x.hit ? 'hit' : 'miss'}`} style={{ '--d': `${0.2 + i * 0.5}s`, '--stop': `${stop}%` }} data-msx-qlot-row={x.hit ? 'hit' : 'miss'}>
            <span className="ti" aria-hidden="true"><MsxSkillArt t={x.t} uid={`ql${x.id}`}/></span>
            <span className="nm"><b>{x.t.name}</b><small>覚える率 {r}%</small></span>
            <span className="lb"><i className="zone" style={{ width: `${r}%` }}/><i className="ndl"/></span>
            <span className="rs">{x.hit ? '覚えた!' : '覚えられなかった'}</span>
          </div>); })}</div>
      </>)}
      <div className="skip">タップで結果へ</div>
    </div>
  );
}

const MSX_ACT_CSS = `
.msx .msx-act .ban small b{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:#fde047;color:#7c2d12;font-size:11px;font-style:normal}
.msx .msx-act.lv3 .ban{background:linear-gradient(90deg,transparent,#1e3a8acc 18%,#1e3a8acc 82%,transparent);-webkit-text-stroke-color:#1e3a8a;text-shadow:0 3px 0 #1e3a8a}
.msx .msx-act.lv4 .ban{background:linear-gradient(90deg,transparent,#6d28d9cc 18%,#6d28d9cc 82%,transparent);-webkit-text-stroke-color:#4c1d95;text-shadow:0 3px 0 #4c1d95,0 0 14px #c4b5fd}
.msx .msx-act.lv5 .ban{background:linear-gradient(90deg,transparent,#b45309dd 15%,#f59e0bdd 50%,#b45309dd 85%,transparent);color:#fff7c2;-webkit-text-stroke-color:#7c2d12;text-shadow:0 3px 0 #7c2d12,0 0 18px #fde047}
.msx .msx-act.lv4 .lines,.msx .msx-act.lv5 .lines{background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(255,255,255,.7) 0 1.6deg,transparent 1.6deg 7deg)}
.msx .msx-act.lv5 .lines:not(.h){background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(253,224,71,.8) 0 1.6deg,transparent 1.6deg 7deg)}
.msx .msx-act .flash5{position:absolute;inset:0;z-index:5;pointer-events:none;background:radial-gradient(circle at 50% 50%,#fff,#fde04700 60%);opacity:0;animation:msxActFlash .5s ease-out .6s both}
.msx .msx-act .hard .obj{position:absolute;left:4%;bottom:18%;font-style:normal;font-size:110px;line-height:1;animation:msxActCrack .45s ease-in .7s both}
.msx .msx-act .hard.v4 .obj{font-size:130px}.msx .msx-act .hard.v4 .obj.b{left:22%;bottom:30%;font-size:90px}
.msx .msx-act .hard.v5 .obj{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#94a3b8,#334155 45%,#0f172a 80%);box-shadow:0 8px 12px #0009,inset -8px -10px 0 #0006}
.msx .msx-act .hard .boom{left:22%;top:30%;font-size:70px;animation:msxActHit .5s ease-out .55s both}
.msx .msx-act .hard.v5 .boom{font-size:96px}
.msx .msx-act .hard .chip{left:20%;top:50%;width:10px;height:10px;border-radius:2px;background:#d6d3d1;box-shadow:0 0 0 1px #57534e;animation:msxActChip .6s ease-out .6s both}
.msx .msx-act .hard.v5 .chip{background:#64748b;box-shadow:0 0 6px #fde047}
.msx .msx-act .rock.v2 i{font-size:170px}
.msx .msx-act .rock.v4 i{font-size:90px;left:calc(28% + var(--i) * 22%);animation-delay:calc(.05s + var(--i) * .12s)}
.msx .msx-act .rock.v5 i{font-size:150px;filter:drop-shadow(0 0 14px #f97316) drop-shadow(0 0 30px #fde047)}
.msx .msx-act .fall .water{position:absolute;left:30%;right:30%;top:0;bottom:30%;background:repeating-linear-gradient(90deg,#bae6fdcc 0 6px,#38bdf8aa 6px 14px,#e0f2fecc 14px 18px);opacity:.85;animation:msxActWater .25s linear infinite;-webkit-mask:linear-gradient(180deg,#000 70%,transparent);mask:linear-gradient(180deg,#000 70%,transparent)}
.msx .msx-act .fall .drop{position:absolute;font-style:normal;font-size:24px;left:calc(26% + var(--i) * 9%);top:52%;animation:msxActPuff2 .6s ease-out infinite;animation-delay:calc(var(--i) * .1s)}
.msx .msx-act .tgt.v2 .t{transform:scale(.7);right:3%;top:24%}
.msx .msx-act .tgt.v3 .t{animation:msxActMove .7s ease-in-out infinite alternate}
.msx .msx-act .tgt .t{position:absolute;right:6%;top:30%;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,#dc2626 0 12%,#fff 12% 26%,#dc2626 26% 40%,#fff 40% 55%,#dc2626 55% 70%,#fff 70%);border:3px solid #7f1d1d;box-shadow:0 6px 0 #0006}
.msx .msx-act .tgt.v4 .t{width:64px;height:64px}
.msx .msx-act .tgt.v5 .t{background:radial-gradient(circle,#f59e0b 0 12%,#fff7c2 12% 26%,#f59e0b 26% 40%,#fff7c2 40% 55%,#f59e0b 55% 70%,#fff7c2 70%);border-color:#92400e;box-shadow:0 0 18px #fde047}
.msx .msx-act .tgt.v4 .shot{animation-delay:calc(.3s + var(--i) * .12s)}
.msx .msx-act .tgt.v5 .shot{font-size:44px;filter:drop-shadow(0 0 10px #fde047)}
.msx .msx-act .leaves.v3 i,.msx .msx-act .leaves.v4 i{font-size:26px}
.msx .msx-act .leaves.v5 i{filter:drop-shadow(0 0 8px #fde047)}
.msx .msx-act .think .board{position:absolute;left:4%;bottom:16%;width:38%;height:44%;border-radius:12px;background:#1e1b4bcc;border:2px solid #a5b4fc;box-shadow:0 0 16px #818cf855;animation:msxActBlock .3s ease-out .1s both}
.msx .msx-act .think .board i{position:absolute;font-style:normal;font-size:34px;animation:msxActBlock .28s cubic-bezier(.3,1.5,.6,1) both;animation-delay:calc(.3s + var(--i) * .16s)}
.msx .msx-act .think .maze{position:absolute;inset:12%;border:3px solid #fde68a;background:repeating-linear-gradient(90deg,transparent 0 14px,#fde68a 14px 17px),repeating-linear-gradient(0deg,transparent 0 22px,#fde68a 22px 25px);-webkit-mask:linear-gradient(90deg,#000 0 40%,transparent 40% 48%,#000 48%);mask:linear-gradient(90deg,#000 0 40%,transparent 40% 48%,#000 48%);animation:msxActOn .05s linear .3s both}
.msx .msx-act .think .star{color:#fde047;font-size:22px!important;text-shadow:0 0 8px #fde047}
.msx .msx-act .think .scroll{left:14%!important;top:14%!important;font-size:80px!important;filter:drop-shadow(0 0 14px #fde047)}
.msx .msx-act .think .idea{left:56%;top:12%;font-size:46px;animation:msxActHit .6s ease-out 1.1s both}
.msx .msx-act .run .land{position:absolute;left:-10%;right:-10%;bottom:0;height:22%;border-radius:50% 50% 0 0;background:#4d7c0f;opacity:.0}
.msx .msx-act .run.v2 .land{opacity:.8;height:34%;background:radial-gradient(ellipse 70% 100% at 30% 100%,#65a30d 60%,transparent 61%)}
.msx .msx-act .run.v3 .land{opacity:.8;height:30%;border-radius:0;background:linear-gradient(160deg,transparent 40%,#78716c 40%)}
.msx .msx-act .run.v4 .land{opacity:.9;height:30%;border-radius:0;background:linear-gradient(160deg,transparent 40%,#f1f5f9 40%)}
.msx .msx-act .run.v5 .land{opacity:.9;height:32%;border-radius:0;background:linear-gradient(160deg,transparent 40%,#7f1d1d 40%,#b91c1c)}
.msx .msx-act.t-life.lv4{background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.12),rgba(30,58,138,.6))}
.msx .msx-act.t-life.lv5{background:radial-gradient(circle at 50% 55%,rgba(255,200,120,.1),rgba(127,29,29,.7))}
.msx .msx-act .run .fx{position:absolute;font-style:normal;font-size:20px;left:calc(var(--i) * 13%);top:-8%;animation:msxActLeaf 1.2s linear both;animation-delay:calc(var(--i) * .1s)}
.msx .msx-act .run.v5 .fx{top:auto;bottom:-6%;animation-name:msxActRise}
@keyframes msxActFlash{0%{opacity:0}30%{opacity:.85}100%{opacity:0}}
@keyframes msxActCrack{0%{transform:none}30%{transform:translateX(-4px) rotate(-3deg)}100%{opacity:0;transform:scale(1.15) rotate(8deg);filter:brightness(1.6)}}
@keyframes msxActChip{from{opacity:1;transform:none}to{opacity:0;transform:rotate(var(--a)) translateY(-80px)}}
@keyframes msxActWater{to{background-position:0 18px}}
@keyframes msxActPuff2{0%{opacity:0;transform:none}30%{opacity:1}100%{opacity:0;transform:translate(calc((var(--i) - 2.5) * 14px),40px)}}
@keyframes msxActMove{from{transform:translateY(-30px)}to{transform:translateY(40px)}}
@keyframes msxActRise{from{transform:translate(0,0)}to{transform:translate(-20px,-640px)}}
.msx .msx-act{position:absolute;inset:0;z-index:8;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.05),rgba(10,8,30,.72))}
.msx .msx-act .lines{position:absolute;inset:-20%;background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(255,255,255,.5) 0 1.2deg,transparent 1.2deg 9deg);-webkit-mask:radial-gradient(circle at 50% 55%,transparent 26%,#000 48%);mask:radial-gradient(circle at 50% 55%,transparent 26%,#000 48%);animation:msxActLines .35s linear infinite}
.msx .msx-act .lines.h{inset:0;background:repeating-linear-gradient(180deg,transparent 0 13px,rgba(255,255,255,.45) 13px 15px,transparent 15px 31px);-webkit-mask:linear-gradient(90deg,#000,transparent 30%,transparent 70%,#000);mask:linear-gradient(90deg,#000,transparent 30%,transparent 70%,#000);animation:msxActRunL .25s linear infinite}
.msx .msx-act .me{position:absolute;inset:0;z-index:2}
.msx .msx-act .me .mon{left:50%;bottom:12%;height:56%}
.msx .msx-act .ban{position:absolute;left:0;right:0;bottom:4%;z-index:6;text-align:center;font-size:28px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 3px 0 #7c2d12;background:linear-gradient(90deg,transparent,#7c2d12cc 18%,#7c2d12cc 82%,transparent);padding:2px 0 4px;animation:msxActBan .4s cubic-bezier(.2,1.4,.4,1) both}
.msx .msx-act .ban small{display:block;font-size:12px;font-style:normal;-webkit-text-stroke:0;text-shadow:0 1px 0 #000;color:#fde68a}
.msx .msx-act .pr{position:absolute;inset:0;z-index:3;pointer-events:none}
.msx .msx-act .pr em{position:absolute;font-style:normal}
.msx .msx-act.t-pow .me{animation:msxActLunge .7s cubic-bezier(.3,1.4,.5,1) .3s both}
.msx .msx-act.t-pow .me .mon{left:70%}
.msx .msx-act .logs{left:3%;right:auto;width:33%;top:auto;bottom:16%;height:50%;display:flex;gap:4px;align-items:flex-end}
.msx .msx-act .logs i{position:relative;flex:1;height:100%;border-radius:6px;background:repeating-linear-gradient(90deg,#b45309 0 3px,#d97706 3px 9px,#c2410c 9px 11px);border:2px solid #78350f;box-shadow:inset 0 0 0 2px #f59e0b55;animation:msxActLog .6s ease-in .75s both;--dx:calc((var(--i) - 1) * 40px)}
.msx .msx-act .logs i b{position:absolute;left:10%;right:10%;top:20%;bottom:20%;opacity:0;background:linear-gradient(115deg,transparent 46%,#1c0a00 47% 50%,transparent 51%),linear-gradient(65deg,transparent 46%,#1c0a00 47% 50%,transparent 51%);animation:msxActOn .05s linear .55s both}
.msx .msx-act .logs .boom{left:70%;top:24%;font-size:56px;animation:msxActHit .5s ease-out .52s both}
.msx .msx-act.t-tough .me{animation:msxActSquash .5s ease-out .55s both}
.msx .msx-act .rock i{position:absolute;left:50%;top:6%;font-style:normal;font-size:130px;line-height:1;transform:translateX(-50%);animation:msxActDrop .55s cubic-bezier(.5,0,1,.6) .1s both;filter:drop-shadow(0 8px 6px #0008)}
.msx .msx-act .rock .ring{left:50%;top:22%;width:60%;height:14%;margin-left:-30%;border:4px solid #fde68a;border-radius:50%;opacity:0;animation:msxActRing .5s ease-out .62s both}
.msx .msx-act.t-tough .lines{animation:msxActLines .35s linear infinite,msxActShake .3s linear .62s 1}
.msx .msx-act.t-hit .me .mon{left:32%}
.msx .msx-act .tgt .shot{left:36%;top:46%;font-size:34px;animation:msxActShot .4s cubic-bezier(.4,0,.8,.6) .35s both}
.msx .msx-act .tgt .boom{right:9%;top:32%;font-size:48px;animation:msxActHit .5s ease-out .74s both}
.msx .msx-act.t-eva .me{animation:msxActDodge .9s ease-in-out .2s both}
.msx .msx-act .leaves i{position:absolute;font-style:normal;font-size:30px;top:-12%;left:calc(4% + var(--i) * 12%);animation:msxActLeaf 1.1s linear both;animation-delay:calc(var(--i) * .09s)}
.msx .msx-act.t-wise .me .mon{left:64%}
.msx .msx-act .blocks i{position:absolute;left:12%;width:52px;height:40px;border-radius:6px;border:2px solid #0006;bottom:calc(14% + var(--i) * 40px);background:hsl(calc(var(--i) * 62 + 10),85%,60%);box-shadow:inset 0 -6px 0 #0002;animation:msxActBlock .28s cubic-bezier(.3,1.5,.6,1) both;animation-delay:calc(.15s + var(--i) * .18s)}
.msx .msx-act .blocks .idea{left:56%;top:12%;font-size:46px;animation:msxActHit .6s ease-out 1.1s both}
.msx .msx-act.t-life .me{animation:msxActBob .22s ease-in-out infinite alternate}
.msx .msx-act .run i{position:absolute;font-style:normal;font-size:34px;left:56%;bottom:12%;animation:msxActPuff .5s linear infinite;animation-delay:calc(var(--i) * .17s)}
@keyframes msxActLines{to{transform:rotate(9deg)}}
@keyframes msxActRunL{to{background-position:0 31px}}
@keyframes msxActOn{to{opacity:1}}
@keyframes msxActHit{0%{opacity:0;transform:scale(.3)}35%{opacity:1;transform:scale(1.35)}100%{opacity:0;transform:scale(1.1)}}
@keyframes msxActLunge{0%{transform:none}35%{transform:translateX(-22%)}60%{transform:translateX(-18%)}100%{transform:translateX(-6%)}}
@keyframes msxActLog{to{opacity:0;transform:translate(var(--dx),40px) rotate(calc((var(--i) - 1) * 35deg))}}
@keyframes msxActDrop{from{transform:translate(-50%,-140%)}to{transform:translate(-50%,0)}}
@keyframes msxActSquash{0%{transform:none}30%{transform:translateY(4%) scaleY(.92)}100%{transform:none}}
@keyframes msxActRing{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
@keyframes msxActShake{25%{transform:translate(-6px,3px)}50%{transform:translate(6px,-3px)}75%{transform:translate(-3px,2px)}}
@keyframes msxActShot{from{transform:none;opacity:1}to{transform:translate(170px,-24px) rotate(360deg);opacity:.9}}
@keyframes msxActTgt{0%{transform:none}40%{transform:scale(1.15)}100%{transform:none}}
@keyframes msxActDodge{0%,100%{transform:none}25%{transform:translateX(-18%)}55%{transform:translateX(16%)}80%{transform:translateX(-8%)}}
@keyframes msxActLeaf{from{transform:translate(0,0) rotate(0)}to{transform:translate(70px,620px) rotate(320deg)}}
@keyframes msxActBlock{from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:none}}
@keyframes msxActBob{from{transform:translateY(0)}to{transform:translateY(-3%)}}
@keyframes msxActPuff{0%{opacity:0;transform:translateX(0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateX(-170px) scale(1.3)}}
@keyframes msxActBan{from{opacity:0;transform:translateY(-14px) scale(.8)}to{opacity:1;transform:none}}
.msx .msx-qst{position:absolute;inset:0;z-index:9;overflow:hidden;cursor:pointer;background:#0f0d24}
.msx .msx-qst .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:msxQbg .5s ease-out both}
.msx .msx-qst .tint{position:absolute;inset:0;mix-blend-mode:multiply}
.msx .msx-qst.qs0 .tint{mix-blend-mode:normal}
.msx .msx-qst .say{position:absolute;left:12px;right:12px;bottom:18%;display:flex;gap:8px;align-items:flex-end;animation:msxActBan .4s ease-out both}
.msx .msx-qst .say .fc{width:64px;height:64px;border-radius:50%;border:3px solid #fff;object-fit:cover;background:#fff}
.msx .msx-qst .say .bub{flex:1;background:#fffdf5;color:#1e1b4b;border:2px solid #fb923c;border-radius:14px;padding:8px 12px;font-size:13px;font-weight:800;line-height:1.5;text-align:left}
.msx .msx-qst .say .bub b{display:block;color:#c2410c;font-size:12px}
.msx .msx-qst .ban{position:absolute;left:0;right:0;top:10%;text-align:center;font-size:20px;font-weight:900;color:#fff;-webkit-text-stroke:2px #1e1b4b;paint-order:stroke fill;text-shadow:0 3px 0 #1e1b4b;background:linear-gradient(90deg,transparent,#0f0d24cc 15%,#0f0d24cc 85%,transparent);padding:6px 0;animation:msxQban .45s cubic-bezier(.2,1.2,.3,1) both}
.msx .msx-qst .ban small{display:block;font-size:30px;font-style:italic;letter-spacing:.12em;color:#fde047;-webkit-text-stroke:2px #92400e}
.msx .msx-qst .me{position:absolute;inset:0}
.msx .msx-qst .me .mon{left:50%;bottom:18%;height:40%}
.msx .msx-qst .faces{position:absolute;left:0;right:0;bottom:6%;display:flex;justify-content:center;align-items:center;gap:6px}
.msx .msx-qst .faces img{width:40px;height:40px;border-radius:50%;background:#fff;border:2px solid #fde047;object-fit:contain;animation:msxActBan .4s ease-out both}
.msx .msx-qst .faces small{font-size:11px;font-weight:900;color:#fff;text-shadow:0 1px 2px #000}
.msx .msx-qst .say .bub .plan{display:block;margin-top:4px;font-size:11px;color:#9a3412}
.msx .msx-qst .ban.q2{top:3%;font-size:16px;padding:3px 0 5px}.msx .msx-qst .ban.q2 small{font-size:22px}.msx .msx-qst .ban.q2 em{display:block;font-style:normal;font-size:11px;-webkit-text-stroke:0;text-shadow:0 1px 2px #000;color:#fde68a;margin-top:2px}
.msx .msx-qst:not(.qs0) .me .mon{bottom:47%;height:27%}
.msx .msx-qst .qg{position:absolute;left:8px;right:8px;bottom:22px;display:grid;gap:5px;z-index:4}
.msx .msx-qst .qg-none{background:#0f172add;border-radius:10px;padding:8px;color:#e2e8f0;font-size:12px;font-weight:800;text-align:center}
.msx .msx-qst .qg-row{display:grid;grid-template-columns:76px minmax(0,1fr) 74px;grid-template-areas:"k bar v" "p p p";align-items:center;column-gap:6px;row-gap:3px;background:#0f172ad9;border:1px solid #475569;border-radius:12px;padding:5px 8px;animation:msxActBan .3s ease-out both}
.msx .msx-qst .qg-k{grid-area:k;font-size:12px;font-weight:900;color:#fff;white-space:nowrap}
.msx .msx-qst .qg-bar{grid-area:bar;position:relative;height:12px;border-radius:99px;background:#1e293b;border:1px solid #64748b;overflow:hidden}
.msx .msx-qst .qg-base{position:absolute;left:0;top:0;bottom:0;width:52%;background:linear-gradient(90deg,#64748b,#94a3b8)}
.msx .msx-qst .qg-seg{position:absolute;top:0;bottom:0;transform-origin:0 50%;transform:scaleX(0);animation:msxQgGrow .3s ease-out var(--d) both;box-shadow:inset -1px 0 0 #0006}
.msx .msx-qst .qg-v{grid-area:v;text-align:right;white-space:nowrap;font-weight:900;color:#fff}.msx .msx-qst .qg-v small{font-size:10.5px;color:#cbd5e1}.msx .msx-qst .qg-v b{display:inline-block;font-size:15px;color:#fde047;animation:msxQgPop .35s cubic-bezier(.3,1.6,.6,1) var(--d) both}
.msx .msx-qst .qg-parts{grid-area:p;display:flex;flex-wrap:wrap;gap:4px}
.msx .msx-qst .qg-p{position:relative;display:inline-flex;align-items:center;gap:3px;padding:1px 6px 1px 2px;border-radius:99px;background:#1e293b;border:1.5px solid var(--c);animation:msxQgIn .3s ease-out var(--d) both}
.msx .msx-qst .qg-p img{width:22px;height:22px;border-radius:50%;background:#fff;object-fit:contain}.msx .msx-qst .qg-p em{font-style:normal;font-size:15px;width:22px;text-align:center}
.msx .msx-qst .qg-p b{font-size:12.5px;font-weight:900;color:var(--c)}.msx .msx-qst .qg-p small{font-size:9.5px;font-weight:800;color:#cbd5e1}
.msx .msx-qst .qg-p .fly{position:absolute;left:auto;right:-6px;top:-18px;font-style:normal;font-size:16px;font-weight:900;color:var(--c);text-shadow:0 1px 0 #000,0 0 6px #000;pointer-events:none;opacity:0;animation:msxQgFly .7s ease-out var(--d) both}
.msx .msx-qst .qg-cap{position:absolute;left:8px;right:8px;bottom:8px;text-align:center;font-size:11.5px;font-weight:800;color:#f8fafc;text-shadow:0 1px 2px #000;z-index:4;background:#0b0920a6;border-radius:8px;padding:3px 6px}
.msx .msx-qst .qlot{position:absolute;left:8px;right:8px;bottom:24px;display:grid;gap:6px;z-index:4}
.msx .msx-qst .ql{display:grid;grid-template-columns:40px minmax(0,1fr) auto;grid-template-areas:"ti nm rs" "lb lb lb";column-gap:8px;row-gap:5px;align-items:center;background:#0f172ae6;border:2px solid #64748b;border-radius:12px;padding:6px 9px;animation:msxActBan .3s ease-out var(--d) both}
.msx .msx-qst .ql .ti{grid-area:ti;width:40px;height:40px;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#1e293b}.msx .msx-qst .ql .ti svg,.msx .msx-qst .ql .ti img{width:100%;height:100%}
.msx .msx-qst .ql .nm{grid-area:nm;display:grid;min-width:0}.msx .msx-qst .ql .nm b{font-size:14px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.msx .msx-qst .ql .nm small{font-size:11px;font-weight:800;color:#86efac}
.msx .msx-qst .ql .lb{grid-area:lb;position:relative;height:14px;border-radius:99px;background:#7f1d1d;border:1px solid #94a3b8;overflow:hidden}
.msx .msx-qst .ql .lb .zone{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#16a34a,#4ade80)}
.msx .msx-qst .ql .lb .ndl{position:absolute;top:-2px;bottom:-2px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff;left:var(--stop);animation:msxQlSweep 1.2s cubic-bezier(.2,.7,.3,1) var(--d) both}
.msx .msx-qst .ql .rs{grid-area:rs;font-size:14px;font-weight:900;white-space:nowrap;opacity:0;animation:msxQgPop .4s cubic-bezier(.3,1.6,.6,1) calc(var(--d) + 1.3s) both}
.msx .msx-qst .ql.hit .rs{color:#fde047;font-size:18px;text-shadow:0 0 8px #f59e0b}.msx .msx-qst .ql.miss .rs{color:#cbd5e1}
.msx .msx-qst .ql.hit{animation:msxActBan .3s ease-out var(--d) both,msxQlWin .5s ease-out calc(var(--d) + 1.3s) both}
@media (max-height:700px){.msx .msx-qst .ban.q2{font-size:14px;padding:2px 0 3px}.msx .msx-qst .ban.q2 small{font-size:17px}.msx .msx-qst .ban.q2 em{font-size:10px;margin-top:0}
  .msx .msx-qst .qg{gap:3px;bottom:18px}.msx .msx-qst .qg-row{padding:3px 7px;row-gap:2px}.msx .msx-qst .qg-p img{width:18px;height:18px}.msx .msx-qst .qg-p b{font-size:11.5px}.msx .msx-qst .qg-p small{display:none}
  .msx .msx-qst .qg-cap{bottom:6px;font-size:10.5px}.msx .msx-qst .qlot{bottom:18px;gap:4px}.msx .msx-qst .ql{padding:4px 8px;row-gap:3px}.msx .msx-qst .skip{display:none}}
@keyframes msxQgGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes msxQgPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes msxQgIn{from{opacity:0;transform:translateY(8px) scale(.8)}to{opacity:1;transform:none}}
@keyframes msxQgFly{0%{opacity:0;transform:translateY(6px)}25%{opacity:1}100%{opacity:0;transform:translateY(-30px)}}
@keyframes msxQlSweep{0%{left:0}35%{left:100%}70%{left:20%}100%{left:var(--stop)}}
@keyframes msxQlWin{from{border-color:#64748b;box-shadow:none}to{border-color:#facc15;box-shadow:0 0 16px #facc15aa}}
.msx .msx-qst .skip{display:none} /* 修行は下の「結果へ」ボタン1つで進む(題の帯に重なって読めず、同じ働きが2つあった。育-186) */
@keyframes msxQbg{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}
@keyframes msxQban{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
/* ---- その動きをしているトレーニング(mv-on)・修行の技の動き(2026-11-14) ---- */
.msx .msx-act.mv-on .me{animation:none}
.msx .msx-act .mv{position:absolute;inset:0}
.msx .v-scene:has(.msx-act) .msx-peakfx,.msx .v-scene:has(.msx-qst) .msx-peakfx{display:none}
.msx .msx-act.t-life .mv{transform-origin:50% 88%;animation:msxMvRun .26s ease-in-out infinite alternate}
.msx .msx-act.t-life .mv .sweat{position:absolute;left:58%;bottom:60%;font-style:normal;font-size:26px;animation:msxMvSweat .5s ease-out .9s both}
.msx .msx-act .road{position:absolute;left:-30%;right:-30%;bottom:-6%;height:26%;z-index:1;transform:rotate(-7deg);background:repeating-linear-gradient(90deg,#65a30d 0 36px,#4d7c0f 36px 42px);box-shadow:0 -4px 0 #a3e635aa;animation:msxMvRoad .3s linear infinite}
.msx .msx-act.lv3 .road{background:repeating-linear-gradient(90deg,#78716c 0 36px,#57534e 36px 42px);box-shadow:0 -4px 0 #d6d3d1aa}
.msx .msx-act.lv4 .road{background:repeating-linear-gradient(90deg,#f1f5f9 0 36px,#cbd5e1 36px 42px);box-shadow:0 -4px 0 #fff}
.msx .msx-act.lv5 .road{background:repeating-linear-gradient(90deg,#b91c1c 0 36px,#7f1d1d 36px 42px);box-shadow:0 -4px 0 #f97316,0 -10px 18px #f9731688}
.msx .msx-act.t-life.mv-on .run .land{display:none}
.msx .msx-act.t-pow .mv{transform-origin:70% 88%;animation:msxMvChop 1.3s cubic-bezier(.35,.1,.3,1) .1s both}
.msx .msx-act.t-pow.mv-on{animation:msxActShake .3s linear .78s 1}
.msx .msx-act.t-pow.mv-on .logs .boom,.msx .msx-act.t-pow.mv-on .hard .boom{animation-delay:.74s}
.msx .msx-act.t-pow.mv-on .logs i{animation-delay:.84s}
.msx .msx-act.t-pow.mv-on .logs i b{animation-delay:.74s}
.msx .msx-act.t-pow.mv-on .hard .obj{animation-delay:.84s}
.msx .msx-act.t-pow.mv-on .hard .chip{animation-delay:.8s}
.msx .msx-act.t-eva .mv{transform-origin:50% 88%;animation:msxMvDodge 1.7s ease-in-out .1s both}
.msx .msx-act.t-eva .gh{opacity:.32;filter:saturate(.3) brightness(1.4)}
.msx .msx-act.t-eva .gh.g1 .mv{animation-delay:.16s}
.msx .msx-act.t-eva .gh.g2 .mv{animation-delay:.22s;opacity:.6}
.msx .msx-act.t-hit .mv{transform-origin:32% 88%;animation:msxMvThrow 1.4s ease-out .02s both}
.msx .msx-act.t-tough .mv{transform-origin:50% 88%;animation:msxMvBrace 1.5s ease-out 0s both}
.msx .msx-act.t-wise .mv{transform-origin:64% 88%;animation:msxMvThink 1.6s ease-in-out 0s both}
.msx .msx-act.t-tough.mv-on .lines{animation:msxActLines .35s linear infinite,msxActShake .3s linear .62s 1}
@keyframes msxMvThrow{0%{transform:none}15%{transform:translate(-4%,1%) rotate(10deg) scale(.96,1.04)}25%{transform:translate(8%,0) rotate(-12deg) scale(1.06,.94)}40%{transform:translate(6%,0) rotate(-6deg)}55%{transform:translate(4%,-9%) rotate(0)}66%{transform:translate(4%,0) scale(1.04,.95)}100%{transform:translate(2%,0)}}
@keyframes msxMvBrace{0%{transform:none}25%{transform:scale(1.06,.92)}41%{transform:translateY(4%) scale(1.16,.78)}48%{transform:translate(-2%,4%) scale(1.14,.8)}55%{transform:translate(2%,4%) scale(1.14,.8)}62%{transform:translateY(3%) scale(1.12,.84)}78%{transform:translateY(-5%) scale(.95,1.07)}100%{transform:none}}
@keyframes msxMvThink{0%{transform:none}12%{transform:rotate(-6deg)}24%{transform:rotate(5deg)}36%{transform:rotate(-6deg)}48%{transform:rotate(5deg)}60%{transform:translateX(-3%)}68%{transform:translate(-3%,2%) scale(1.05,.92)}76%{transform:translate(-3%,-16%) scale(.96,1.05)}86%{transform:translate(-3%,0) scale(1.04,.95)}100%{transform:translateX(-2%)}}
@keyframes msxMvRun{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-7%) rotate(-11deg) scaleX(.97)}}
@keyframes msxMvRoad{to{background-position:-42px 0}}
@keyframes msxMvSweat{0%{opacity:0;transform:none}30%{opacity:1}100%{opacity:0;transform:translate(26px,-30px)}}
@keyframes msxMvChop{0%{transform:none}22%{transform:translateY(3%) scale(1.05,.88)}42%{transform:translate(-26%,-36%) rotate(-18deg)}50%{transform:translate(-36%,-6%) rotate(10deg)}55%{transform:translate(-36%,0) rotate(8deg) scale(1.1,.86)}75%{transform:translate(-33%,0) rotate(0) scale(1)}86%{transform:translate(-33%,-6%)}100%{transform:translate(-30%,0)}}
@keyframes msxMvDodge{0%{transform:none}12%{transform:translateX(-22%) rotate(-10deg)}24%{transform:translate(-22%,-20%) rotate(-4deg)}36%{transform:translateX(-4%)}50%{transform:translateX(20%) rotate(9deg) scale(1.06,.82)}64%{transform:translate(12%,-16%) rotate(4deg)}78%{transform:translateX(-14%) rotate(-8deg)}90%{transform:translateX(0) scale(1.04,.92)}100%{transform:none}}
.msx .msx-qst .pts{position:absolute;inset:0;pointer-events:none}
.msx .msx-qst .pts i{position:absolute;font-style:normal;font-size:22px;left:calc(var(--i) * 8.5%);bottom:-8%;animation:msxQup 1.3s linear both;animation-delay:calc(var(--i) * .07s)}
.msx .msx-qst.c-ice .pts i{bottom:auto;top:-8%;animation-name:msxQdown}
.msx .msx-qst.c-wind .pts i{left:-10%;bottom:calc(10% + var(--i) * 7%);animation-name:msxQside}
.msx .msx-qst.c-star .pts i{bottom:calc(8% + (var(--i) * 37 % 80) * 1%);animation-name:msxQtw}
.msx .msx-qst .me .aura{position:absolute;left:50%;bottom:16%;width:60%;height:46%;margin-left:-30%;border-radius:50%;background:radial-gradient(circle,#fde04799,#f9731655 45%,transparent 70%);opacity:0;animation:msxQaura 1.2s ease-out both}
.msx .msx-qst.c-ice .me .aura{background:radial-gradient(circle,#e0f2fecc,#38bdf866 45%,transparent 70%)}
.msx .msx-qst.c-wind .me .aura{background:radial-gradient(circle,#dcfce7cc,#4ade8066 45%,transparent 70%)}
.msx .msx-qst.c-star .me .aura{background:radial-gradient(circle,#f5f3ffcc,#a78bfa77 45%,transparent 70%)}
.msx .msx-qst .me.q-strike{transform-origin:50% 82%;animation:msxQstrike 1.2s cubic-bezier(.4,.1,.3,1) .15s both}
.msx .msx-qst .me.q-slam{transform-origin:50% 82%;animation:msxQslam 1.2s cubic-bezier(.4,.1,.3,1) .15s both}
.msx .msx-qst .me.q-spin{transform-origin:50% 82%;animation:msxQspin 1.1s ease-in-out .15s both}
.msx .msx-qst .me.q-float{transform-origin:50% 82%;animation:msxQfloat 1.2s ease-in-out .1s both}
.msx .msx-qst .me.q-float .aura{animation-duration:1.4s;width:80%;margin-left:-40%}
.msx .msx-qst .slash.sp{animation-delay:.6s}
.msx .msx-qst.c-wind .slash{background:linear-gradient(90deg,transparent,#fff 30%,#86efac 60%,transparent);box-shadow:0 0 16px #4ade80}
.msx .msx-qst.c-star .slash.s2{border-color:#e9d5ff;box-shadow:0 0 20px #a78bfa,inset 0 0 14px #f5f3ff}
@keyframes msxQspin{0%{transform:none}20%{transform:translateY(3%) scale(1.04,.9)}40%{transform:translateY(-26%) scaleX(-1)}55%{transform:translateY(-30%) scaleX(1)}70%{transform:translateY(-18%) scaleX(-1)}85%{transform:translateY(0) scaleX(1) scale(1.06,.92)}100%{transform:none}}
@keyframes msxQfloat{0%{transform:none}35%{transform:translateY(-10%)}55%{transform:translateY(-12%) scale(1.04)}62%{transform:translateY(-12%) scale(1.1);filter:brightness(1.6)}80%{transform:translateY(-6%);filter:none}100%{transform:none}}
.msx .msx-qst .slash{position:absolute;left:8%;top:38%;width:70%;height:12px;border-radius:50%;background:linear-gradient(90deg,transparent,#fff 30%,#fde047 60%,transparent);box-shadow:0 0 16px #fde047;transform:rotate(-24deg) scaleX(0);transform-origin:100% 50%;opacity:0;animation:msxQslash .35s ease-out .72s both}
.msx .msx-qst .slash.s2{left:15%;top:auto;bottom:16%;width:70%;height:22%;border-radius:50%;background:none;border:5px solid #fde047;box-shadow:0 0 20px #f97316,inset 0 0 14px #fde047;transform:scale(.2);transform-origin:50% 50%;animation:msxQring .45s ease-out .78s both}
.msx .msx-qst.c-ice .slash{background:linear-gradient(90deg,transparent,#fff 30%,#7dd3fc 60%,transparent);box-shadow:0 0 16px #38bdf8}
.msx .msx-qst.c-ice .slash.s2{background:none;border-color:#bae6fd;box-shadow:0 0 20px #38bdf8,inset 0 0 14px #e0f2fe}
.msx .msx-qst .qflash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 60%,#fff,#fff0 65%);opacity:0;animation:msxActFlash .45s ease-out .76s both}
.msx .msx-qst.qs1 .ban,.msx .msx-qst.qs2 .ban,.msx .msx-qst.qsx .ban{z-index:3}
@keyframes msxQup{0%{opacity:0;transform:none}15%{opacity:1}100%{opacity:0;transform:translate(calc((var(--i) - 6) * 4px),-420px) scale(1.3)}}
@keyframes msxQdown{0%{opacity:0;transform:none}15%{opacity:1}100%{opacity:0;transform:translate(-40px,420px) rotate(200deg)}}
@keyframes msxQside{0%{opacity:0;transform:none}15%{opacity:1}100%{opacity:0;transform:translate(520px,-40px) rotate(300deg)}}
@keyframes msxQtw{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.3)}}
@keyframes msxQaura{0%{opacity:0;transform:scale(.6)}40%{opacity:1;transform:scale(1.1)}55%{opacity:.4}100%{opacity:0;transform:scale(1.4)}}
@keyframes msxQstrike{0%{transform:none}30%{transform:translate(4%,2%) scale(.94,1.04)}36%{transform:translate(-2%,2%) scale(.94,1.04)}42%{transform:translate(3%,2%) scale(.94,1.04)}52%{transform:translate(-30%,0) skewX(10deg)}62%{transform:translate(-34%,0)}82%{transform:translate(-12%,0)}100%{transform:none}}
@keyframes msxQslam{0%{transform:none}25%{transform:translateY(3%) scale(1.06,.88)}45%{transform:translateY(-30%) rotate(-12deg)}58%{transform:translateY(-34%) rotate(10deg)}66%{transform:translateY(0) scale(1.1,.86)}80%{transform:translateY(-4%)}100%{transform:none}}
@keyframes msxQslash{0%{opacity:0;transform:rotate(-24deg) scaleX(0)}40%{opacity:1;transform:rotate(-24deg) scaleX(1)}100%{opacity:0;transform:rotate(-24deg) scaleX(1.1)}}
@keyframes msxQring{0%{opacity:1;transform:scale(.2)}100%{opacity:0;transform:scale(1.5)}}
@media (prefers-reduced-motion: reduce){.msx .msx-act,.msx .msx-qst{display:none}}
`;
let msxActCssDone = false;
const msxActEnsureCss = () => {
  if (msxActCssDone || typeof document === 'undefined') return;
  msxActCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-act-css', '1'); el.textContent = MSX_ACT_CSS; document.head.appendChild(el);
};
