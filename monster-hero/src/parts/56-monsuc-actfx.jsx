// ===== モンヒロサクセスのトレーニング・修行の演出(2026-11-13 社長「トレーニングも修行も演出が入っていない」・参考動画の流れだけを取り入れる) =====
// 何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。押すと飛ばせる。「動きを減らす」設定では出さない(すぐ結果)
//   MsxTrainAct({ run, o, style, onDone }) … トレーニングの結果の字の前に、トレーニングしている場面(約1.3秒)。style: 'a' その場で動く / 'b' 集中線のカットイン
//   MsxShugyoStages({ run, o, line, onDone }) … 修行の結果の前に、助手の一言 →「STAGE 1 ◯◯&◯◯」→「STAGE 2 ◯◯&◯◯」(段ごとに景色が替わる・いっしょに修行した編成のモンスターの顔)

const MSX_ACT_MS = 1700;
// 修行の段ごとの景色(背景の絵 + 色のかぶせ)
const MSX_QSTAGE_BG = Object.freeze({
  fire: [['forest_evening', 'rgba(255,90,20,.35)'], ['desert_oilfield', 'rgba(255,40,0,.38)']],
  ice: [['forest_morning', 'rgba(120,200,255,.35)'], ['forest_night', 'rgba(150,220,255,.4)']],
  wind: [['forest_deep', 'rgba(120,255,170,.25)'], ['desert_hall', 'rgba(200,255,220,.25)']],
  star: [['monhero_night', 'rgba(150,120,255,.3)'], ['dark_void', 'rgba(200,170,255,.3)']],
});
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
  React.useEffect(() => { if (msxActCalm()) { finish(); return undefined; } const id = setTimeout(finish, MSX_ACT_MS); return () => clearTimeout(id); }, []);
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
  return (
    <div className={`msx-act t-${k} lv${lv}`} onClick={finish} data-msx-act={k} data-msx-act-lv={lv}>
      <span className={k === 'life' ? 'lines h' : 'lines'} aria-hidden="true"/>
      {front ? null : prop}
      <div className="me"><MsxMonArt run={run} className="mon" live/></div>
      {front ? prop : null}
      {lv === 5 ? <span className="flash5" aria-hidden="true"/> : null}
      <div className="ban"><small>{MSX_STAT_NAME[k]}のトレーニング <b>Lv.{lv}</b></small>{msxTrainIcon(k, lv)} {msxTrainName(k, lv)}!</div>
    </div>
  );
}

function MsxShugyoStages({ run, o, line, onDone }) {
  msxActEnsureCss();
  const SH = msxSuc && msxSuc.SUC ? msxSuc.SUC.SHUGYO : null;
  const course = SH && SH.courses ? SH.courses[o.course] : null;
  const stages = course && Array.isArray(course.stages) ? course.stages : [];
  const bgs = MSX_QSTAGE_BG[o.course] || MSX_QSTAGE_BG.fire;
  const [st, setSt] = React.useState(0); // 0 助手の一言 / 1 STAGE 1 / 2 STAGE 2
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => {
    if (msxActCalm()) { finish(); return undefined; }
    const ids = [setTimeout(() => setSt(1), 1000), setTimeout(() => setSt(2), 2300), setTimeout(finish, 3600)];
    return () => ids.forEach(clearTimeout);
  }, []);
  if (msxActCalm()) return null;
  const s = run.s;
  const say = line ? line('turn.drill.start', 'よし、集中していこう！') : { t: 'よし、集中していこう！' };
  const helpers = Array.isArray(o.stages) && o.stages[st - 1] ? o.stages[st - 1] : [];
  const pair = stages[st - 1] || [];
  const [bg, tint] = bgs[Math.max(0, st - 1)] || bgs[0];
  return (
    <div className={`msx-qst st${st}`} onClick={finish} data-msx-qstage={st}>
      <img key={`bg${st}`} className="bg" src={msxQstageBgUrl(bg)} alt=""/>
      <span className="tint" style={{ background: st ? tint : 'rgba(15,13,36,.55)' }}/>
      {st === 0 ? (<div className="say">
        {typeof msxFace === 'function' ? <img className="fc" src={msxFace(s.aid, 'excited')} alt=""/> : null}
        <div className="bub"><b>{course ? `${course.name}の修行` : '修行'}</b>{say && say.t}</div></div>) : (<>
        <div key={`ban${st}`} className="ban"><small>STAGE {st}</small>{pair.map((x) => `${MSX_STAT_ICON[x]} ${MSX_STAT_NAME[x]}`).join(' & ')}</div>
        <div key={`me${st}`} className="me"><MsxMonArt run={run} className="mon" live react={{ kind: 'great', id: `qs-${st}` }}/></div>
        {helpers.length ? <div className="faces">{helpers.map((i) => s.team[i]).filter(Boolean).map((m, j) => <img key={j} src={msxMonThumb(m.species)} alt=""/>)}<small>いっしょに修行</small></div> : null}
      </>)}
      <div className="skip">タップでとばす</div>
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
.msx .msx-qst.st0 .tint{mix-blend-mode:normal}
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
.msx .msx-qst .skip{position:absolute;right:10px;top:8px;font-size:10px;font-weight:800;color:#e2e8f0aa}
@keyframes msxQbg{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}
@keyframes msxQban{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.msx .msx-act,.msx .msx-qst{display:none}}
`;
let msxActCssDone = false;
const msxActEnsureCss = () => {
  if (msxActCssDone || typeof document === 'undefined') return;
  msxActCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-act-css', '1'); el.textContent = MSX_ACT_CSS; document.head.appendChild(el);
};
