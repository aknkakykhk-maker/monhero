// ===== モンヒロサクセス 回3: 大会(受付 C1 → 組み合わせ表 B1 → バトルカード C2 → 1戦 → 勝ち B2 / 負け C4 → 賞品の段) =====
// 見本: docs/progress/player-raise/mock/png/v3-C.png・v3-B.png(v3-phone-C1〜C4・B1・B2)
// ・戦うのは1戦だけ(TOURNAMENT §15)。組み合わせ表は芯の bracketOf の演出
// ・試合は助手マスモン対戦の芯で回し、観戦は 56-assistant-masmon-battle-view.jsx の部品(AmbwPanel・ambwIsHighlight・AMBW_CSS)を使い回す
// ・スキップ(結果だけ)は、優勝したことのある大会だけ(SUC.canSkip)。中で試合は計算する
// ・負けたら砂時計(同じ相手)・虹の砂時計(相手を変える)でやり直せる(1回の育成で3回まで・settle の前に SUC.rematch)
// ・勝ち負けを付けたあと(settle)は、run.phase を 'battle' のまま run.out.r3 に「賞品の段」を持つ(中断しても同じ所から)。
//   優勝のごはんは ここでは出さない。権利(芯の mealReady / mealOpts)を育成に残し、ファーム(ホーム)で あげる(2026-11-17 社長)
function MsxR3Frame({ back = '戻る', onBack, run, right, body, foot }) {
  const s = run.s;
  return (
    <>
      <style>{MSX_R3_CSS}</style>
      <MsxHd back={back} onBack={onBack} sub={`${msxAidName(s.aid)}編`} right={right != null ? right : `💰 賞金 ${msxFmt(run.showPend && run.showPend.s ? run.showPend.s.fame : s.fame)}G`}/>
      <div className="v-body r3">{body}</div>
      {foot}
    </>
  );
}

// ---- 受付(C1): 今月の大会の札。出ると1ターン使う(芯の act({kind:'cup'})) ----
const msxR3WhyText = (e, s) => {
  if (!e || e.ok) return '';
  if (e.why === 'stat') { const nm = e.stat2 ? `${MSX_STAT_NAME[e.stat]}か${MSX_STAT_NAME[e.stat2]}` : (MSX_STAT_NAME[e.stat] || '能力'); return `${nm}が ${msxFmt(e.need)} 以上 要る`; }
  if (e.why === 'chain') return '1つ下の星で優勝すると出られる';
  if (e.why === 'dist') return 'その間合いの適性が C 以上 要る';
  if (e.why === 'type') return 'タイプが合わない';
  if (e.why === 'techs') return `技を ${e.need}つ以上 覚えていると出られる`;
  if (e.why === 'cond') return '体調が悪いと出られない';
  if (e.why === 'loyal') return `忠誠が ${e.need} 以上 要る`;
  if (e.why === 'fame') return `これまでの賞金の合計が ${msxFmt(e.need)}G 以上で出られる(いま ${msxFmt(s.fameTotal)}G)`;
  if (e.why === 'rank') return `賞金の段が ${e.needName} 以上で出られる(${msxFmt(e.needG)}G・いま ${msxFmt(s.fameTotal)}G)`;
  if (e.why === 'won') return `${e.wonName} 優勝で出られる`;
  return '出られない';
};
// 勝ったときにもらうアイテム(芯の cupItemsOf。得意の能力・間合いはいまの育成から決まる)
const msxR3CupItems = (SUC, c, s) => { try { const o = s && typeof SUC.cupItemsOf === 'function' ? SUC.cupItemsOf(s, c.sys, c.star) : {}; return Object.entries(o || {}).map(([k, n]) => `${(SUC.ITEMS[k] || {}).name || k} ×${n}`); } catch (e) { return []; } };
const msxR3CupReward = (SUC, c, s, skipPts) => {
  const ex = SUC.EX_BY_SYS ? SUC.EX_BY_SYS[c.sys] : null;
  if (ex) { // 大会の第2版: その大会が持つごほうび
    const rw = ex.rw || {}; const o = [];
    if (rw.all) o.push(`全能力 +${rw.all}`);
    if (rw.stat) Object.entries(rw.stat).forEach(([k, v]) => o.push(`${MSX_STAT_NAME[k]} +${v}`));
    if (rw.hpMax) o.push(`体力の最大値 +${rw.hpMax}`);
    if (rw.loy) o.push(`忠誠度 +${rw.loy}`);
    if (rw.pts && !skipPts) o.push(`能力ポイント +${rw.pts}${c.rival ? `(ライバルに勝つと +${Math.round(rw.pts * 1.5)})` : ''}`);
    if (rw.pop) o.push(`人気 +${rw.pop}`);
    o.push(...msxR3CupItems(SUC, c, s));
    if (Number.isInteger(rw.apt)) o.push('その間合いの適性が1段上がる');
    if (ex.four) o.push('四大大会');
    return o.length ? o.join('・') : '賞金と修行チケット';
  }
  const R = SUC.CUP_SYS ? (SUC.CUP_SYS[c.sys] || {}) : {};
  const out = [];
  const pts = (SUC.CUP_REWARD && SUC.CUP_REWARD.pts ? SUC.CUP_REWARD.pts : { 1: 30, 2: 60, 3: 90, 4: 120 })[c.star]; const pop = { 2: 2, 3: 4, 4: 8 }[c.star]; const up = ((SUC.CUP_REWARD || {}).statUp || { 1: 4, 2: 8, 3: 12 })[c.star];
  if (pts && !skipPts) out.push(`能力ポイント +${pts}${c.rival ? `(ライバルに勝つと +${Math.round(pts * 1.5)})` : ''}`);
  if (pop) out.push(`人気 +${pop}`);
  if (R.stat && up) out.push(`${MSX_STAT_NAME[R.stat]} +${up}`);
  if (c.star >= 4) out.push('全能力 +4');
  out.push(...msxR3CupItems(SUC, c, s));
  if (c.scenario) out.push(c.sys === 'scerubin' ? `忠誠度 +5・次のごはんの効き目 ×${(SUC.MEAL_WATCH_MULT || 1.5)}` : 'シナリオのごほうび'); // えるびんの見守りの大会(2026-11-14 社長)
  return out.length ? out.join('・') : '賞金と修行チケット';
};
// 大会の賞品を絵つきの升目にする(確認の窓)。賞金は先頭
const msxR3Prizes = (SUC, c) => {
  const smile = Number(c.prizeMax) > Number(c.prize); // 笑顔の大会: 機嫌がよいほど多い(r1115-207 N1。芯の settle と同じ ×1.0〜1.3)
  const out = [{ id: 'g', e: '💰', name: smile ? `賞金 ${msxFmt(c.prize)}〜${msxFmt(c.prizeMax)}G` : `賞金 ${msxFmt(c.prize)}G`, desc: smile ? `勝つともらえる賞金。機嫌がよいほど多くなる(最大 ${msxFmt(c.prizeMax)}G)。ごはんや買い物に使える` : '勝つともらえる賞金。ごはんや買い物に使える(負けても ★★ 以上は一部もらえる)' }];
  const ex = SUC.EX_BY_SYS ? SUC.EX_BY_SYS[c.sys] : null;
  if (ex && ex.rw && ex.rw.bag) Object.entries(ex.rw.bag).forEach(([k, n]) => { const it = typeof msxItemView === 'function' ? msxItemView(k) : { name: k, e: '🎁', desc: '' }; out.push({ id: k, e: it.e, img: it.img || null, name: `${it.name} ×${n}`, desc: it.desc, rare: true }); });
  // 修行チケットは賞金ランクアップの分だけ(優勝チケットは全廃・ランクアップは全段 +1 に統一。2026-11-17 仕様是正)
  out.push({ id: 'tk', e: '🎫', name: '修行チケット', desc: '賞金ランクが上がると1段ごとに +1(負けても獲得賞金の合計で上がる)' });
  const bpz = msxR3BeatPrize(SUC, c.prize); if (bpz) out.push(bpz);
  // 能力ポイントはいつも専用の札(デビュー戦・ヒーローズ戦と見え方をそろえる。r1115-202 L6)
  const ptsN = ex ? Number((ex.rw || {}).pts) : Number(((SUC.CUP_REWARD && SUC.CUP_REWARD.pts) || { 1: 30, 2: 60, 3: 90, 4: 120 })[c.star]);
  const rvPts = SUC.RIVAL && Number(SUC.RIVAL.pts) > 0 ? Number(SUC.RIVAL.pts) : 1.5;
  if (Number.isFinite(ptsN) && ptsN > 0) out.push({ id: 'pts', e: '🔷', name: `能力ポイント +${ptsN}`, desc: `勝つと能力ポイントがもらえる。「能力」の画面で、好きな能力に振り分けられる${c.rival ? `(ライバルに勝つと +${Math.round(ptsN * 1.5)})` : ''}`, pt: true });
  if (c.rival) { // ライバルの大会: 勝ったときの上乗せも札で見せる(r1115-207 N4。芯の settle と同じ RIVAL の値)
    const rvAll = SUC.RIVAL && Number(SUC.RIVAL.all) > 0 ? Number(SUC.RIVAL.all) : 12; const rvDesc = `ライバルに勝つと、この大会の能力ポイントが ×${rvPts}・全能力 +${rvAll}・称号「${(SUC.RIVAL && SUC.RIVAL.title) || 'ライバルに勝った'}」`;
    if (Number.isFinite(ptsN) && ptsN > 0) out.push({ id: 'rvpts', e: '⚔️', name: `ライバルに｜勝つと｜能力ポイント +${Math.round(ptsN * rvPts)}`, desc: rvDesc, rare: true, pt: true });
    out.push({ id: 'rv', e: '⚔️', name: `ライバルに｜勝つと｜全能力 +${rvAll}`, desc: rvDesc, rare: true, pt: true });
  }
  const rw = msxR3CupReward(SUC, c, undefined, true); if (rw && rw !== '賞金と修行チケット') out.push({ id: 'rw', e: ex && ex.four ? '🏆' : '✨', name: 'ごほうび', desc: rw, rare: !!(ex && (ex.four || ex.hard)), pt: true });
  return out;
};
// ビートPの札(2026-11-14 社長: 参考の賞品のコイン → うちではビートP)。優勝すると本編のビートPに足される
const msxR3BeatPrize = (SUC, g) => { const n = typeof SUC.beatOfPrize === 'function' ? SUC.beatOfPrize(g) : 0; return n ? { id: 'bp', e: '🎵', name: `ビートP +${msxFmt(n)}`, desc: `優勝すると、｜本編のビートP｜(モンヒロビートのポイント)に｜${msxFmt(n)}P 足されます。｜ビートP交換所で｜使えます`, pt: true } : null; };
// 言葉の切れ目で折る(2026-11-14 社長「言葉の途中で折れる」): 文の中の「｜」を折ってよい所(幅0の空白)にする。
//   字の札には className="msx-kp"(word-break:keep-all)を付け、｜と句読点のところでだけ折れるようにする
const msxPh = (str) => String(str == null ? '' : str).replace(/｜/g, '\u200b');
// 参加確認の獲得物(2026-11-14 社長): 賞金は上の1行。その下に、アイテム(左)→ 能力・ポイント系(右)の順で全部が一度に見える升目。押すと詳細の小窓
// 賞品の札の名前。「能力ポイント +120」のように数で終わる物は、見出しと数を別の行にし、数は折らない(r1115-201: 幅320 で「+12 ⏎ 0」と割れた)
const MsxR3PrizeName = ({ name }) => {
  const m = /^(.*?)[\s\u00a0]*([+＋][0-9,]+)$/.exec(String(name || ''));
  if (!m || !m[1]) return <small className="msx-kp">{msxPh(name)}</small>;
  return <small className="msx-kp">{msxPh(m[1])}<b style={{ display: 'block', whiteSpace: 'nowrap', font: 'inherit' }}>{m[2]}</b></small>;
};
const MsxR3PrizeBox = ({ prizes, onPick }) => {
  const gold = prizes.find((x) => x.id === 'g');
  const rest = prizes.filter((x) => x.id !== 'g').sort((a, b) => (a.pt ? 1 : 0) - (b.pt ? 1 : 0));
  return (<>
    {gold ? <button type="button" className="pzg" onClick={() => onPick(gold)} data-msx-r3-prize="g"><i>賞金</i><b>{gold.name.replace(/^賞金 /, '')}</b></button> : null}
    {rest.length ? <><div className="sub">賞品</div>
      <div className="pz">{rest.map((x) => <button type="button" key={x.id} className={`${x.rare ? 'rare' : ''}${x.pt ? ' pt' : ''}`} onClick={() => onPick(x)} data-msx-r3-prize={x.id}><span>{typeof msxItemIco === 'function' ? msxItemIco(x) : x.e}</span><MsxR3PrizeName name={x.name}/></button>)}</div></> : null}
  </>);
};
const MSX_R3_FC_CLASS = Object.freeze({ easy: 'fc-e', good: 'fc-g', even: 'fc-v', hard: 'fc-h', none: 'fc-n' });
function MsxR3Cup({ run, setRun, v, ev, onBack, onActed }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const P = SUC.periodOf(s.turn);
  // 月の切り替え: いまの月と、同じ期のこの先の月(見るだけ。出られるのはいまの月)
  const lastTurn = Math.min(SUC.TOTAL_TURNS || 46, s.turn + (P.key === 'final' ? 0 : Math.max(0, P.left - 1)));
  const [vt, setVt] = useState(s.turn);
  const now = vt === s.turn;
  const cupsNow = Array.isArray(v.cups) ? v.cups : [];
  const cups = now ? cupsNow : (typeof SUC.cupsOf === 'function' ? SUC.cupsOf({ ...s, turn: vt }) : []);
  const [pick, setPick] = useState(() => { const c = cupsNow.find((x) => x.entry && x.entry.ok); return c ? c.id : null; });
  const [win, setWin] = useState(null); // 確認の窓の大会 id
  const [prz, setPrz] = useState(null); // 賞品の詳細
  const cur = cupsNow.find((c) => c.id === pick) || null;
  // 予想(Fable の点検①-7): 今月の大会は、実際の試合の式で40回まわした勝ち数から出す(芯が読めるまでと先の月は、いままでの能力の合計の比)
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [tablesOk, setTablesOk] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([engine ? Promise.resolve(engine) : msxR3LoadEngine(), msxR3LoadTables()]).then(([e]) => { if (!alive) return; setTablesOk(true); if (e) setEngine(e); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const oddsBy = useMemo(() => {
    const out = {};
    if (!engine || !tablesOk || typeof monsucOdds !== 'function') return out;
    cupsNow.forEach((c) => {
      if (!c.entry || !c.entry.ok) return;
      try {
        const f = msxR3Fight(engine, SUC, { ...run, s: { ...s, battle: { kind: 'cup', id: c.id, sys: c.sys, star: c.star, rival: c.rival || null, round: 0 } } });
        const o = f && f.input ? monsucOdds(engine, f.input) : null; if (o) out[c.id] = o;
      } catch (_) { /* 予想が出せないときは、いままでの予想 */ }
    });
    return out;
  }, [engine, tablesOk, s.turn, s.stats, s.techs, cupsNow.length]);
  const go = (skip) => {
    if (!cur || !cur.entry || !cur.entry.ok) return;
    const r = SUC.act(s, { kind: 'cup', id: cur.id });
    if (!r.out.ok) return;
    const next = { ...run, s: r.state, out: null, r3skip: skip ? true : undefined, log: [...(run.log || []), { turn: s.turn, t: `${msxR3CupName(cur.sys, cur.name)}に出た` }].slice(-20) };
    onActed(next);
  };
  const toForced = P.key === 'final' ? null : P.left;
  const cal = msxCalendar(s.turn); const calV = msxCalendar(vt);
  useMsxR3Lines(s.aid);
  // 受付(月の大会を選ぶ)のあいだは育成中の曲のまま(2026-11-14 社長)。大会の曲 cupPre は組み合わせ表に入ってから(MsxR3Battle)
  useEffect(() => { if (typeof SuccessSound !== 'undefined') SuccessSound.se('cupEntry'); }, []);
  const nOk = cupsNow.filter((c) => c.entry && c.entry.ok).length;
  // 受付のひとこと: 「上の星が開いた」の台本(turn.cup.open)は毎月は合わないので使わない。出られる数に合わせて、月ごとに言い回しを替える(2026-11-14 点検 ①-14: 毎回同じ台詞)
  const openTexts = nOk ? [
    `「今月は ${nOk}つ 出られるよ! 出ると1ターン使うから、トレーニングとどっちにするか考えてね」`,
    `「出られる大会が ${nOk}つ あるよ。賞品もチェックしてみて!」`,
    `「${cur ? msxR3CupName(cur.sys, cur.name) : '大会'}、気になるね。体力は大丈夫?」`,
    `「大会は1ターン使うよ。調子がいいなら行ってみよ!」`,
  ] : P.key === 'final' ? ['「最後の期は、ヒーローズファイナルだけだよ。それまではトレーニングや修行で仕上げよう!」'] : ['「今月は出られる大会がないみたい。トレーニングでじっくり力をつけよ!」', '「出られる大会が今月は無いよ。次の月の予定も見てみてね」'];
  const openLine = { t: msxR3Q(openTexts[Math.abs(Number(s.turn) || 0) % openTexts.length]), e: null };
  const rankStep = typeof SUC.rankStepOf === 'function' ? SUC.rankStepOf(s) : 0; const rank = rankStep ? { name: SUC.rankNameOf(rankStep) } : null; // 賞金ランク9段(2026-11-14・r1115-085 で参考の9段)
  const kindOf = (c) => (c.scenario ? 'シナリオ' : (c.ex || c.grade) ? (MSX_R3_CUP_GRADE[c.grade] || '') : (SUC.CUP_SYS[c.sys] || {}).stat ? '自慢' : (SUC.CUP_SYS[c.sys] || {}).dist !== undefined ? '間合い' : (SUC.CUP_SYS[c.sys] || {}).type ? 'タイプ' : ['spring', 'summer', 'autumn', 'winter'].includes(c.sys) ? '四季' : 'ふつう');
  const wc = win ? cups.find((c) => c.id === win) : null;
  const wcOk = !!(wc && now && wc.entry && wc.entry.ok);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene low" style={{ flex: '0 0 auto', minHeight: 128 }}><img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/><div className="sh"/>
      <img className="rcv-myua" src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', left: '-2%', bottom: '-98%', height: '190%', width: 'auto', maxWidth: 'none' }}/>
      <div className="v-ev-h"><small>{cal.year}年目 {cal.month}月・{v.period.name}</small>🏆 大会の受付</div>
      <div className="v-ibub" style={{ left: '38%', top: 'auto', bottom: 8 }}>{openLine.t}</div>
    </div>
    <div className="v-cupbar" data-msx-r3-fame><span>いまの賞金</span><b>{msxFmt(s.fame)}<small>G</small></b>{rank ? <i>賞金の段 {rank.name}</i> : null}</div>
    <div className="v-cupmon">
      <button type="button" className="ar" disabled={vt <= s.turn} onClick={() => setVt((t) => Math.max(s.turn, t - 1))} aria-label="前の月">◀</button>
      <b>{calV.year}年目 {calV.month}月{now ? <small className="now">今月</small> : <small>予定</small>}</b>
      <button type="button" className="ar" disabled={vt >= lastTurn} onClick={() => setVt((t) => Math.min(lastTurn, t + 1))} aria-label="次の月" data-msx-r3-next-month>▶</button>
    </div>
    <div className="v-cups">
      {cups.length ? cups.map((c) => {
        const ok = now && c.entry && c.entry.ok;
        const fc = (now && oddsBy[c.id]) || (typeof SUC.forecastOf === 'function' ? SUC.forecastOf(s, c) : null);
        const cls = `${!(c.entry && c.entry.ok) ? 'ng' : now && c.id === pick ? 'sel' : c.rival ? 'rv' : c.done ? 'won' : ''}${c.ex ? ` ex g-${c.grade || 'gold'}` : c.grade ? ` g-${c.grade}` : ''}${c.hard ? ' hard' : ''}${now ? '' : ' later'}`;
        return (
          <button type="button" key={c.id} className={`v-cup v-cup2 ${cls}`} onClick={() => { if (ok) setPick(c.id); setWin(c.id); }} data-msx-r3-cup={c.id}>
            <div className="lg"><span className="e">{c.scenario ? '📖' : (MSX_R3_CUP_ICON[c.sys] || '🏆')}</span>{fc ? <span className={`fcst ${MSX_R3_FC_CLASS[fc.key] || ''}`}>{fc.key === 'none' ? 'ほぼ無理' : fc.label}</span> : null}</div>
            {/* 読む順は 大会名 → 出場可否・条件 → ライバル → 報酬(2026-11-16 UI改修) */}
            <div className="tx">
              <b>{c.scenario ? c.name : msxR3CupName(c.sys, c.name)}</b>
              <div className="hd"><span className="gr2">{kindOf(c)}</span><span className="cs">{msxR3Stars(c.star)}</span>{c.done ? <span className="dn">優勝済</span> : null}</div>
              {!(c.entry && c.entry.ok) ? <span className="why">✖ {msxR3WhyText(c.entry, s)}</span> : <span className="ok">出場できます</span>}
              {c.rival ? <span className="rvl"><MsxRivalOwnerIcon rival={c.rival} size={20}/><MsxRivalThumb rival={c.rival}/><b>ライバル {c.rival.name}</b>{c.rival.breeder ? <small>{msxBreederLabel(c.rival.breeder, c.rival.kind)}</small> : null}</span> : null}
              <span className="g">{Number(c.prizeMax) > Number(c.prize) ? <><small>最大</small>{msxFmt(c.prizeMax)}</> : msxFmt(c.prize)}<small>G</small></span>
            </div>
            {c.rival ? <span className="rvb">能力ポイント1.5倍</span> : null}
          </button>);
      }) : <div className="msx-note">{P.key === 'final' ? '最後の期は、ヒーローズファイナルだけです' : now ? '今月の大会はありません' : 'この月の大会はありません'}</div>}
    </div>
    <div className="v-card" style={{ padding: '5px 9px' }}><div className="v-kv" style={{ margin: 0 }}><b>出ると</b><span>1戦だけ・1ターン使う・体力は減りません・勝つと賞金と賞品。{toForced ? <span className="yel">{' 期末の大会まで '}<span style={{ whiteSpace: 'nowrap' }}>{`あと${toForced}ターン`}</span></span> : null}</span></div></div>
    {wc ? (
      <div className="v-cupwin" onClick={() => { setWin(null); setPrz(null); }} data-msx-r3-cupwin>
        <div className="in" onClick={(e) => e.stopPropagation()}>
          <div className="h">大会参加確認</div>
          <div className={`sign g-${wc.grade || 'n'}`}><span className="e">{wc.scenario ? '📖' : (MSX_R3_CUP_ICON[wc.sys] || '🏆')}</span><b>{wc.scenario ? wc.name : msxR3CupName(wc.sys, wc.name)}</b><small>{kindOf(wc)} {msxR3Stars(wc.star)}</small></div>
          {wc.rival ? <div className="rvl" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12, fontWeight: 900, color: '#be123c' }}><MsxRivalOwnerIcon rival={wc.rival} size={22}/><MsxRivalThumb rival={wc.rival} size={22} imgStyle={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', objectPosition: '50% 20%' }}/><span>ライバル: {wc.rival.name}{wc.rival.breeder ? `(${msxBreederLabel(wc.rival.breeder, wc.rival.kind)})` : ''}</span></div> : null}
          <div className="sub">獲得物</div>
          <MsxR3PrizeBox prizes={msxR3Prizes(SUC, wc)} onPick={setPrz}/>
          {wcOk ? <div className="q">この大会に参加しますか?</div> : <div className="q ng">{now ? `この大会には出られません(${msxR3WhyText(wc.entry, s)})` : 'この大会は、その月になると出られます'}</div>}
          <div className="bt">{wcOk ? <><button type="button" onClick={() => setWin(null)}>キャンセル</button><button type="button" className="go" onClick={() => { setPick(wc.id); setWin(null); if (cur && cur.id === wc.id) go(false); else { const r = SUC.act(s, { kind: 'cup', id: wc.id }); if (r.out.ok) onActed({ ...run, s: r.state, out: null, log: [...(run.log || []), { turn: s.turn, t: `${msxR3CupName(wc.sys, wc.name)}に出た` }].slice(-20) }); } }} data-msx-r3-yes>はい</button></> : <button type="button" onClick={() => setWin(null)} data-msx-r3-close>閉じる</button>}</div>
          {prz ? <div className="det" onClick={() => setPrz(null)}><div className="dbox" onClick={(e) => e.stopPropagation()}><div className="e">{typeof msxItemIco === 'function' ? msxItemIco(prz) : prz.e}</div><b>{msxPh(prz.name)}</b><p className="msx-kp">{msxPh(prz.desc)}</p>{SUC.ITEMS && SUC.ITEMS[prz.id] ? <div className="own" data-msx-r3-prize-own={prz.id}><i>所持数</i><span>{(s.bag && s.bag[prz.id]) || 0}</span></div> : null}<button type="button" onClick={() => setPrz(null)}>閉じる</button></div></div> : null}
        </div>
      </div>) : null}
  </>);
  const foot = (
    <div className="v-ft">
      <button type="button" onClick={onBack}>← 戻る</button>
      <button type="button" className={cur && cur.done && cur.entry.ok ? 'on' : 'off'} disabled={!(cur && cur.done && cur.entry.ok)} onClick={() => go(true)} data-msx-r3-skip>⏩ スキップ</button>
      <button type="button" className="go" disabled={!(cur && cur.entry && cur.entry.ok)} onClick={() => { setVt(s.turn); setWin(cur.id); }} data-msx-r3-enter>{cur ? '出場 ▶' : '大会を選ぶ'}</button>
    </div>
  );
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}

// ---- 観戦(助手マスモン対戦の観戦の部品を使い回す) ----
function MsxR3Watch({ fight, onDone }) {
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('hl');
  const log = fight.r.log; const len = log.length;
  useEffect(() => {
    if (pos >= len - 1) { const t = setTimeout(() => onDone(), 900); return () => clearTimeout(t); }
    const sp = AMBW_SPEEDS.find((x) => x.id === speed) || AMBW_SPEEDS[0];
    const msxR3Step = () => {
      let n = pos + 1;
      if (speed === 'hl') while (n < len - 1 && !ambwIsHighlight(log[n], fight.maxHp)) n++;
      setPos(n);
    };
    const t = setTimeout(msxR3Step, sp.ms);
    return () => clearTimeout(t);
  }, [pos, speed]);
  const e = log[pos] || {}; const f = fight.frames[pos] || fight.frames[0]; const foeSide = e.side === 'A' ? 'B' : 'A';
  const fighter = (side) => {
    const team = side === 'A' ? fight.teamA : fight.teamB; const m = team.members[f.act[side]] || team.members[0];
    return (
      <div key={`${side}-${pos}`} className={`ambw-f ${f.hp[side][f.act[side]] <= 0 ? 'down' : ''} ${e.side === side && e.ev === 'tech' ? `ambw-lunge${side}` : ''} ${e.ev === 'tech' && foeSide === side && e.hit ? 'ambw-hit' : ''}`}>
        <img className={side === 'A' ? 'ambw-flip' : ''} src={msxMonImg(m.species)} alt=""/><em>{m.name}</em>
        {e.ev === 'tech' && foeSide === side && (e.hit ? <div className="ambw-dmg">−{e.dmg}</div> : <div className="ambw-dmg miss">はずれ</div>)}
      </div>);
  };
  return (
    <div className="r3-watch" data-msx-r3-watch>
      <style>{AMBW_CSS}</style>
      {/* 横画面では左に対戦の場を残し、右の HP・技・操作だけがスクロールする(2026-11-16 UI改修)。
          縦画面では並び順(相手の札→場→自分の札→操作)を CSS の order で今までどおりに戻す */}
      <div className="r3-watch-side">
        <AmbwPanel side="B" team={fight.teamB} frame={f} maxHp={fight.maxHp} moves={fight.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false}/>
        <AmbwPanel side="A" team={fight.teamA} frame={f} maxHp={fight.maxHp} moves={fight.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine/>
        <div className="ambw-ctl">
          {AMBW_SPEEDS.filter((x) => x.id === 'hl' || x.id === 'x2').map((x) => <button type="button" key={x.id} className={speed === x.id ? 'ambw-btn' : 'ambw-btn2'} onClick={() => setSpeed(x.id)}>{x.label}</button>)}
          <button type="button" className="ambw-btn2" data-msx-r3-towatch-end onClick={() => onDone()}>⏭ 結果へ</button>
        </div>
      </div>
      <div className="ambw-ring">
        <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: [6, 44, 92, 146][f.d] || 44 }}/>{fighter('B')}</div>
        <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
        {e.ev === 'tech' && <div key={`c-${pos}`} className={`ambw-cut ${e.kind} ${e.side === 'B' ? 'B' : ''}`}><small>{e.kind === 'pow' ? '🏋️ ちから技' : '📖 かしこさ技'}</small><b>{e.name}</b></div>}
      </div>
    </div>
  );
}

// 組み合わせ表(2026-11-14 社長「トーナメントの表示がおかしい。最初に1回戦が動く演出がない。バトルは決勝の一戦だけ」・参考 taikai-bracket.png・v2 84〜90秒・v4 48〜52秒)
//   8体・自分はいちばん上(橙)・番号は人気順(1〜8)・1番人気の王者は反対の山。開いたら 1回戦→準決勝 が自動で進む:
//   勝った側へ線が赤く伸び、負けた側は暗くなる(自分も演出で勝ち上がる)。解説のひとこと。SKIP で飛ばせる。戦うのは決勝の1戦だけ
//   線は行の高さ RH から px で引く(行と線がずれない)。芯の bracketOf: entrants・rounds[1回戦の勝ち4・準決勝の勝ち2]・final[自分, 相手]・pop
function MsxR3Bracket({ run, s, v, ev, b, name, opp, foeName, skip, debug, settle, result, toCard, onPause }) {
  const br = msxSuc.SUC.bracketOf(s) || { entrants: [], rounds: [[], []], final: [0, 4], pop: [] };
  const E = br.entrants; const r1 = br.rounds[0] || []; const r2 = br.rounds[1] || []; const fi = (br.final && br.final[1]) || 4;
  const [stage, setStage] = useState(0); // 0=開いた直後 1=1回戦のあと 2=準決勝のあと 3=決勝の前
  useEffect(() => {
    const ts = [setTimeout(() => setStage(1), 1200), setTimeout(() => setStage(2), 3000), setTimeout(() => setStage(3), 4800)];
    return () => ts.forEach(clearTimeout);
  }, []);
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 844));
  useEffect(() => { const f = () => setVh(window.innerHeight); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const RH = Math.max(34, Math.min(50, Math.floor((vh - 500) / 8))); // 行の高さ(下に大きな空きを残さない)
  const no = br.pop && br.pop.length === E.length ? br.pop : E.map((_, i) => i + 1);
  const nm = (e) => (e.you ? run.nick : (e.name || msxMonName(e.species)));
  const out = (i) => (stage >= 1 && !r1.includes(i)) || (stage >= 2 && r1.includes(i) && !r2.includes(i));
  const X = [0, 16, 32, 48, 64]; const yOf = (i) => i * RH + RH / 2;
  const m1 = [0, 1, 2, 3].map((k) => (yOf(2 * k) + yOf(2 * k + 1)) / 2); const m2 = [0, 1].map((j) => (m1[2 * j] + m1[2 * j + 1]) / 2); const m3 = (m2[0] + m2[1]) / 2;
  const pair = (a, c, lv) => `M${X[lv]} ${a}H${X[lv + 1]}M${X[lv]} ${c}H${X[lv + 1]}M${X[lv + 1]} ${a}V${c}`;
  const base = [0, 1, 2, 3].map((k) => pair(yOf(2 * k), yOf(2 * k + 1), 0)).join('') + pair(m1[0], m1[1], 1) + pair(m1[2], m1[3], 1) + pair(m2[0], m2[1], 2) + `M${X[3]} ${m3}H${X[4]}`;
  const wins = [];
  if (stage >= 1) r1.forEach((w, k) => wins.push({ d: `M${X[0]} ${yOf(w)}H${X[1]}V${m1[k]}`, key: `a${k}` }));
  if (stage >= 2) r2.forEach((w, j) => wins.push({ d: `M${X[1]} ${m1[2 * j + (w === r1[2 * j] ? 0 : 1)]}H${X[2]}V${m2[j]}`, key: `b${j}` }));
  if (stage >= 3) [0, 1].forEach((j) => wins.push({ d: `M${X[2]} ${m2[j]}H${X[3]}`, key: `c${j}` })); // 決勝の前は入口で止める(優勝の札へは決勝のあと)
  // 解説のひとこと(段ごと)
  const top = E[no.indexOf(1)] || E[0]; const upsets = r1.filter((w) => w !== 0 && w !== fi && no[w] >= 5);
  const foeNo = no[fi];
  const lines = [
    top && top.you ? <>「<b>1番人気は {run.nick}!</b> まずは 1回戦から 見ていこう」</> : <>「<b>1番人気は {top && top.champ ? '王者の ' : ''}{top ? nm(top) : ''}!</b> {run.nick}の1回戦は これからだよ」</>,
    upsets.length ? <>「<b>大穴! {nm(E[upsets[0]])}</b> が 勝ち上がったぞ! {run.nick}も 1回戦を 勝ち上がり!」</> : <>「1回戦が おわったよ。<b>{run.nick}</b>は 順当に 勝ち上がり!」</>,
    foeNo >= 4 ? <>「<b>大穴! {foeName}</b> 決勝まで きたぞ! {run.nick}は 準決勝も 勝って 決勝へ!」</> : <>「準決勝も おわったよ。<b>{run.nick}</b>は 決勝へ! 反対の山からは <b>{foeName}</b>」</>,
  ];
  const finalLine = (() => { const l = msxR3Line('turn.cup.before', run, { cup: name, rival: opp.rival ? foeName : '' }, ''); return l.t ? l.t : null; })()
    || (opp.rival ? <>「決勝の相手は <b>ライバルの {foeName}</b>! 勝てば 能力ポイントが1.5倍!」</> : opp.champ ? <>「決勝の相手は <b>王者の {foeName}</b>! {opp.note || '強敵だよ'}。胸を借りるつもりでいこう!」</> : <>「決勝の相手は <b>{foeName}</b>。{opp.note || 'しっかり見ていこう'}!」</>);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-bk1"><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="tt">{name}{b.retry ? `(再挑戦 ${b.retry}回目)` : ''}</div></div>
    <div className="v-bkc" data-msx-r3-bracket={stage}>
      <div className="rows">{E.map((x, i) => {
        const k = x.you ? 'me' : x.rival ? 'rv' : x.champ ? 'ch' : '';
        return (<div key={i} className={`v-br ${k}${i === 0 || i === fi ? ' mine' : ''}${out(i) ? ' out' : ''}`} style={{ height: RH }} data-msx-r3-brrow={i}><b className="no">{no[i]}</b>
          <span className="nm">{nm(x)}{x.champ ? <em className="mk ch">👑王者</em> : null}{x.rival ? <em className="mk rv">ライバル</em> : null}{x.you ? <em className="mk me">あなた</em> : null}</span>
          <i className="cn"/><span className="fc2"><MsxRivalThumb rival={x} size={26}/></span></div>);
      })}</div>
      <div className="rt" style={{ height: RH * 8 }}><svg className="v-brl" width="64" height={RH * 8} viewBox={`0 0 64 ${RH * 8}`}><path className="bs" d={base}/>{wins.map((w) => <path key={w.key} className="wl" d={w.d} pathLength="1"/>)}</svg><div className="win"><span>🏆</span><b>優勝</b></div></div>
    </div>
    <div className="v-bnt"><b>決勝は {run.nick} VS {foeName}</b>。<span>ほかの試合の結果は、見せるだけの演出です(戦うのは決勝の1戦だけ)</span></div>
    <div className="v-ann"><div className="pic"><img src={msxFace(s.aid, 'excited')} alt=""/><span>解説</span></div>
      <div className="tx">{stage >= 3 ? finalLine : lines[stage]}</div>
      {stage < 3 ? <button type="button" className="sk" onClick={() => setStage(3)} data-msx-r3-bsk>SKIP ▸▸</button> : null}</div>
  </>);
  const foot = debug ? (
    <div className="v-ft">
      <button type="button" onClick={() => settle(false)}>負けたことにする</button>
      <button type="button" className="on" onClick={() => settle(true)} data-msx-r3-dbgwin>勝ったことにする(デバッグ)</button>
      <button type="button" className="go" onClick={toCard} data-msx-r3-tocard>⚔ 決勝へ ▶</button>
    </div>
  ) : (
    <div className="v-ft">
      {skip ? <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bskip>⏩ スキップ(結果だけ)</button> : <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bresult>⏩ 結果だけ見る</button>}
      <button type="button" className="go" onClick={toCard} data-msx-r3-tocard>⚔ 決勝へ ▶</button>
    </div>
  );
  return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
}

// ---- 試合のまわり ----
// ヒーローズファイナルの途中の戦(1回戦・準決勝)は「勝ち抜け!」。優勝はふつうの大会と決勝だけ(r1115-202 M9)
const msxR3WinWord = (kind, round) => { const n = msxSuc && msxSuc.SUC && Array.isArray(msxSuc.SUC.SUMMIT) ? msxSuc.SUC.SUMMIT.length : 3; return kind === 'summit' && Number.isInteger(round) && round < n - 1 ? '勝ち抜け!' : '優勝!'; };
const msxR3Diff = (a, b) => {
  const d = { apt: [0, 1, 2, 3].filter((i) => ((b.aptUp || [])[i] || 0) > ((a.aptUp || [])[i] || 0)), fame: b.fame - a.fame, pts: b.pts - a.pts, tickets: b.tickets - a.tickets, pop: b.pop - a.pop, stats: {}, titles: (b.titles || []).filter((t) => !(a.titles || []).includes(t)), sand: ((b.items || {}).sand || 0) - ((a.items || {}).sand || 0) };
  MSX_STATS.forEach((k) => { const g = b.stats[k] - a.stats[k]; if (g) d.stats[k] = g; });
  d.beat = Math.max(0, (Number(b.beatEarned) || 0) - (Number(a.beatEarned) || 0)); // ビートP(本編へ足される)
  const loyOf = (x) => Math.max(0, Math.min(100, (Number(x.ama) || 0) + (Number(x.fear) || 0))); d.loy = loyOf(b) - loyOf(a); // 忠誠度(参加の確認の「ごほうび」・r1115-202 M15)
  d.rankFrom = Number(a.fameRank) || 0; d.rankTo = Number(b.fameRank) || 0; // 賞金ランク(2026-11-14)
  d.fameGain = Math.max(0, (Number(b.fameTotal) || 0) - (Number(a.fameTotal) || 0)); // 賞金の合計の増え(ピラミッドの上の +◯G・r1115-081)
  d.items = {}; Object.keys(b.bag || {}).forEach((k) => { const g = (Number((b.bag || {})[k]) || 0) - (Number((a.bag || {})[k]) || 0); if (g > 0) d.items[k] = g; }); // 大会の獲得アイテム
  return d;
};
// 賞品の行(優勝の画面・バトル部の MonsucCupWin の rows にも渡す)
const msxR3RankName = (step) => { const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; return S && typeof S.rankNameOf === 'function' ? S.rankNameOf(step) : String(step); };
// 賞金ランクのピラミッド(2026-11-15 r1115-081: 参考 te-178・178b の形)。下が広く上が細い三角に段の名前、帯は右端まで続き、
//   段の境目の金額は帯の中の右。上に賞金の合計を大きく(今回の増え +◯G を添える)。いまの段の左に KEEP / UP!(▶)。
//   step … いまの段(0〜9)/ up … 上がったとき / total … 賞金の合計(fameTotal)/ gain … 今回の増え
const MSX_R3_RANK_COL = [ // 下の段から [三角の中, 帯]
  ['#c9f1fb', '#6fb8c9'], ['#86e3a0', '#2f9e5a'], ['#ff8a4c', '#c2410c'], ['#9cc8f2', '#4b7aa8'], ['#ffe066', '#c99a06'],
  ['#d9a6ff', '#7c4dbd'], ['#ff6b7f', '#b4233c'], ['#3fc1c9', '#1d6f75'], ['#a77be0', '#4a2577'],
];
const MSX_R3_RANK_CSS = `
.msx-rk{margin:4px 10px 0;padding:7px 8px 8px;border-radius:12px;background:#0f172acc;container-type:inline-size}
.msx-rk .rk-tot{display:flex;align-items:baseline;justify-content:center;gap:6px;flex-wrap:wrap;line-height:1.1}
.msx-rk .rk-tot b{font-size:clamp(20px,7.5cqw,30px);font-weight:900;color:#fff7d6;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.msx-rk .rk-tot i{font-style:normal;font-size:clamp(11px,3.6cqw,14px);font-weight:900;color:#fb923c;white-space:nowrap}
.msx-rk .rk-hd{display:flex;align-items:center;gap:8px;margin:2px 0 4px;font-size:11px;font-weight:800;color:#fde68a}
.msx-rk .rk-hd:before,.msx-rk .rk-hd:after{content:'';flex:1 1 0;height:1px;background:#fde68a66}
.msx-rk .rk-row{position:relative;height:20px;margin-top:1px}
.msx-rk .rk-bar{position:absolute;top:0;bottom:0;right:0}
.msx-rk .rk-tri{position:absolute;top:0;bottom:0}
.msx-rk .rk-nm{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;transform:translateX(-50%);white-space:nowrap;font-size:10.5px;font-weight:900;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000,0 1px 2px #000}
.msx-rk .rk-amt{position:absolute;top:0;bottom:0;right:6px;display:flex;align-items:center;font-size:10.5px;font-weight:900;color:#fff;text-shadow:0 1px 2px #0009;white-space:nowrap;font-variant-numeric:tabular-nums}
.msx-rk .rk-row.off .rk-bar,.msx-rk .rk-row.off .rk-tri{filter:saturate(.45) brightness(.72)}
.msx-rk .rk-row.off .rk-amt{color:#cbd5e1}
.msx-rk .rk-row.me .rk-bar{box-shadow:inset 0 0 0 2px #fff}
.msx-rk .rk-tag{position:absolute;top:2px;bottom:2px;left:0;display:flex;align-items:center;justify-content:center;padding:0 9px 0 6px;border-radius:5px 0 0 5px;clip-path:polygon(0 0,calc(100% - 7px) 0,100% 50%,calc(100% - 7px) 100%,0 100%);font-size:9.5px;font-weight:900;letter-spacing:.04em;color:#fff;background:#4caf50}
.msx-rk .rk-tag.up{background:#ef4444;color:#fff7d6}
`;
function MsxR3RankPyramid({ step, up, total, gain }) {
  const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; const R = S && S.FAME_RANK ? S.FAME_RANK : []; if (!R.length) return null;
  const N = R.length;
  const cond = (x) => (x.cond === 'debut' ? 'デビュー戦出場' : x.cond === 'win' ? '1勝' : `${msxFmt(x.min)}G`);
  const CX = 39; const HALF = 33; // 三角の真ん中(%)と、いちばん下の段の半分の幅(%)。左の 8% に KEEP・UP! の札
  const t = Number(total); const g = Number(gain);
  return (<div className="msx-rk" data-msx-r3-rank data-msx-r3-rank-step={step}>
    <style>{MSX_R3_RANK_CSS}</style>
    {Number.isFinite(t) ? <div className="rk-tot" data-msx-r3-rank-total><b>{msxFmt(Math.max(0, t))}G</b>{Number.isFinite(g) && g > 0 ? <i>(+{msxFmt(g)}G)</i> : null}</div> : null}
    <div className="rk-hd">賞金ランク</div>
    {R.map((x, i) => i).reverse().map((i) => {
      const x = R[i]; const me = i + 1 === step; const k = N - i; // 上から k 段目(1 が頂)
      const hwB = (HALF * k) / N; const hwT = (HALF * (k - 1)) / N; // この段の下・上の半分の幅
      const col = MSX_R3_RANK_COL[i] || MSX_R3_RANK_COL[MSX_R3_RANK_COL.length - 1];
      const triL = CX - hwB; const triW = hwB * 2; const cut = triW > 0 ? ((hwB - hwT) / triW) * 100 : 50;
      return (<div key={i} className={`rk-row${i + 1 <= step ? '' : ' off'}${me ? ' me' : ''}`} data-msx-r3-rank-row={i + 1}>
        <span className="rk-bar" style={{ left: `${CX + hwT}%`, background: `linear-gradient(90deg, ${col[1]}, ${col[1]}dd)` }}/>
        <span className="rk-tri" style={{ left: `${triL}%`, width: `${triW}%`, background: `linear-gradient(180deg, #ffffff66, ${col[0]} 45%, ${col[0]})`, clipPath: `polygon(${cut}% 0, ${100 - cut}% 0, 100% 100%, 0 100%)` }}/>
        <span className="rk-nm" style={{ left: `${CX}%` }}>{x.name}</span>
        <span className="rk-amt">{cond(x)}</span>
        {me ? <span className={`rk-tag${up ? ' up' : ''}`} style={{ left: `${Math.max(0, triL - 15)}%` }} data-msx-r3-rank-tag={up ? 'up' : 'keep'}>{up ? 'UP!' : 'KEEP'}</span> : null}
      </div>);
    })}
  </div>);
}
// 大会の結果の能力アップ・人気(r1115-054 社長): 文だけでなく、画面のゲージ・数字が動く札(56-monsuc-gaugefx.jsx)で出す
const msxR3GainItems = (d, s) => {
  const o = [];
  if (d.pop) o.push({ k: 'pop', e: '⭐', name: '人気', from: s.pop - d.pop, to: s.pop, max: 100 });
  Object.entries(d.stats || {}).forEach(([k, g]) => { if (g) o.push({ k, e: MSX_STAT_ICON[k], name: MSX_STAT_NAME[k], from: s.stats[k] - g, to: s.stats[k], max: 999 }); });
  return o;
};
const msxR3PrizeRows = (d, s, rival) => {
  const rows = [];
  if (d.rankTo > d.rankFrom) rows.push(['🏆', '賞金ランク', `${msxR3RankName(d.rankFrom || 0)} → ${msxR3RankName(d.rankTo)}`, 'new', 'UP']);
  else if (d.rankTo > 0) rows.push(['🏆', '賞金ランク', `${msxR3RankName(d.rankTo)}(KEEP)`, '', '']);
  (d.titles || []).forEach((t) => rows.push(['🏅', '称号', `「${typeof msxR3TitleName === 'function' ? msxR3TitleName(t) : t}」を手に入れた!`, 'new', 'NEW']));
  (d.apt || []).forEach((i) => rows.push(['📏', '間合い適性', `「${['零', '近', '中', '遠'][i]}」の間合い適性が1段上がった!`, 'new', 'UP']));
  // 能力・忠誠度・人気の上がり(参加の確認の「ごほうび」に書いた物も、結果の一覧に出す・r1115-202 M15)
  const stUp = MSX_STATS.filter((k) => (d.stats || {})[k] > 0).map((k) => `${MSX_STAT_NAME[k]} +${d.stats[k]}`);
  if (stUp.length) rows.push(['💪', '能力', stUp.join('・'), '', '']);
  if (d.loy > 0) rows.push(['🤝', '忠誠度', `+${d.loy}`, '', '']);
  if (d.pop > 0) rows.push(['⭐', '人気', `+${d.pop}`, '', '']);
  if (d.pts) rows.push(['🔷', '能力ポイント', `+${d.pts}(いま ${s.pts})${rival ? '・ライバルに勝って ×1.5' : ''}`, '', '']);
  if (d.tickets) rows.push(['🎫', '修行チケット', `+${d.tickets}(${s.tickets - d.tickets}枚 → ${s.tickets}枚)`, '', '']);
  if (d.fame) rows.push(['💰', '賞金', `+${msxFmt(d.fame)}G(所持 ${msxFmt(s.fame - d.fame)}G → ${msxFmt(s.fame)}G)`, '', '']);
  if (d.beat) rows.push(['🎵', 'ビートP', `+${msxFmt(d.beat)}(本編のビートPに足されます)`, 'new', 'GET']);
  if (d.sand) rows.push(['⏳', '時渡りの砂時計', `+${d.sand}`, '', '']);
  Object.entries(d.items || {}).forEach(([k, n]) => { const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; const it = S && S.ITEMS ? S.ITEMS[k] : null; rows.push([typeof msxItemView === 'function' && typeof msxItemIco === 'function' ? msxItemIco(msxItemView(k)) : ((typeof MSX_EXTRA_ITEM !== 'undefined' && MSX_EXTRA_ITEM[k] && MSX_EXTRA_ITEM[k].e) || '🎁'), it ? it.name : k, `×${n}(この育成の中で使える)`, 'new', 'GET']); });
  return rows;
};
// 大会の入り(2026-11-14 社長「参考資料どおりに」・参考 te-33): 組み合わせ表の前に、会場の景色に大会の紋章と名前を大きく出す。
// 紋章・ロゴの絵はまだ無いので、格の色の六角の紋章(印の字)+大会名の大きな字で代わりにする。約2.4秒で進む・押せばすぐ進む。何も保存しない
// 期末の大会・最後の大会は、この前に「当日のメイン(能力と大会だけ)→ 受付に1つだけ → 参加の確認」を挟む(MsxR3PreDesk・MsxPlay)
const MSX_R3_INTRO_MS = 2400;
const MSX_R3_INTRO_CSS = `
.msx-cupin{position:relative;flex:1 1 0;min-height:max(260px,calc(var(--mh-vh) - 100px));border-radius:16px;overflow:hidden;cursor:pointer;background:#1e1b4b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.msx-cupin .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:msxCupinBg 2.6s ease-out both}
.msx-cupin .sh{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(15,13,36,.05),rgba(15,13,36,.6))}
.msx-cupin .crest{position:relative;width:min(46vw,190px);aspect-ratio:1/1.08;display:grid;place-items:center;animation:msxCupinCrest .6s cubic-bezier(.2,1.4,.4,1) .1s both;filter:drop-shadow(0 6px 10px rgba(0,0,0,.55))}
.msx-cupin .crest::before,.msx-cupin .crest::after{content:"";position:absolute;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.msx-cupin .crest::before{inset:0;background:var(--c1,#e2e8f0)}
.msx-cupin .crest::after{inset:9%;background:var(--c2,#64748b)}
.msx-cupin .crest .e{position:relative;z-index:1;font-size:min(20vw,84px);line-height:1;filter:drop-shadow(0 3px 0 rgba(0,0,0,.35))}
.msx-cupin .crest.t-debut{--c1:#bbf7d0;--c2:linear-gradient(160deg,#22c55e,#15803d)}
.msx-cupin .crest.t-s1{--c1:#e2e8f0;--c2:linear-gradient(160deg,#94a3b8,#475569)}
.msx-cupin .crest.t-s2{--c1:#e0f2fe;--c2:linear-gradient(160deg,#7dd3fc,#2563eb)}
.msx-cupin .crest.t-s3{--c1:#fed7aa;--c2:linear-gradient(160deg,#fb923c,#b45309)}
.msx-cupin .crest.t-s4,.msx-cupin .crest.t-final{--c1:#fef08a;--c2:linear-gradient(160deg,#facc15,#a16207)}
.msx-cupin .logo{position:relative;text-align:center;padding:0 12px;animation:msxCupinLogo .5s ease-out .45s both}
.msx-cupin .logo small{display:inline-block;font-size:12px;font-weight:900;color:#1e1b4b;background:#fde68a;border-radius:99px;padding:2px 12px;margin-bottom:4px;letter-spacing:.06em}
.msx-cupin .logo b{display:block;font-size:min(9vw,34px);font-weight:900;color:#fff;line-height:1.15;-webkit-text-stroke:2px #1e293b;paint-order:stroke fill;text-shadow:0 3px 0 #1e293b,0 0 18px rgba(255,255,255,.55);word-break:keep-all;overflow-wrap:anywhere}
@keyframes msxCupinBg{from{transform:scale(1.12)}to{transform:none}}
@keyframes msxCupinCrest{from{opacity:0;transform:scale(.4) rotate(-12deg)}to{opacity:1;transform:none}}
@keyframes msxCupinLogo{from{opacity:0;transform:translateY(12px) scale(.92)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.msx-cupin .bg,.msx-cupin .crest,.msx-cupin .logo{animation:none}}
`;
// 紋章の色(格): デビュー戦=緑・★=銀・★★=青・★★★=銅・👑と最後の大会=金
const msxR3CrestTier = (b) => (!b ? 's1' : b.kind === 'debut' ? 'debut' : b.kind === 'summit' ? 'final' : b.kind === 'cup' ? `s${Math.max(1, Math.min(4, b.star || 1))}` : `s${Math.max(1, Math.min(4, ((msxSuc.SUC.FORCED || {})[b.kind] || {}).star || 2))}`);
function MsxR3CupIntro({ b, title, onGo }) {
  const done = useRef(false);
  const go = () => { if (done.current) return; done.current = true; onGo(); };
  useEffect(() => { const id = setTimeout(go, MSX_R3_INTRO_MS); return () => clearTimeout(id); }, []);
  const venue = typeof MSC_VENUE_IMG !== 'undefined' ? (MSC_VENUE_IMG[b.kind] || MSC_VENUE_IMG.cup) : '';
  const label = b.kind === 'cup' ? '今月の大会' : b.kind === 'summit' ? 'ヒーローズファイナル' : b.kind === 'debut' ? 'デビュー戦' : '期末の大会';
  return (<>
    <style>{MSX_R3_INTRO_CSS}</style>
    <div className="msx-cupin" onClick={go} data-msx-r3-cupintro={b.kind}>
      {venue ? <img className="bg" src={venue} alt=""/> : null}<span className="sh"/>
      <div className={`crest t-${msxR3CrestTier(b)}`}><span className="e">{msxR3BattleIcon(b)}</span></div>
      <div className="logo"><small>{label}</small><b>{title}</b></div>
    </div>
  </>);
}

// ---- 期末の大会・最後の大会の受付(参考 te-31・te-32・te-174・te-175・te-177) ----
// 当日のメインで「大会(本番)」を押すと開く。受付に並ぶのはその大会1つだけ。札を押す/「出場」で参加の確認 →「はい」で大会の入りへ。
// 芯の battle(endTurn が立てた期末の大会)はもう決まっているので、ここでは何も保存しない(キャンセルしても当日のメインへ戻るだけ)
const msxR3ForcedPrizes = (SUC, b) => {
  const F = b.kind === 'summit' ? null : (SUC.FORCED || {})[b.kind] || {};
  const P = SUC.PRIZE || {};
  const g = b.kind === 'summit' ? (Array.isArray(P.summit) ? P.summit[b.round] : 0) : P[b.kind];
  const out = [];
  if (Number.isFinite(g) && g > 0) out.push({ id: 'g', e: '💰', name: `賞金 ${msxFmt(g)}G`, desc: '勝つともらえる賞金' });
  if (b.kind === 'summit' && Number.isFinite(SUC.SUMMIT_PTS) && SUC.SUMMIT_PTS > 0) out.push({ id: 'pts', e: '🔷', name: `能力｜ポイント\u00a0+${SUC.SUMMIT_PTS}`, desc: '勝つと能力ポイントがもらえる(1回戦・準決勝・決勝のそれぞれ)。「能力」の画面で、好きな能力に振り分けられる', pt: true }); // r1115-201
  if (F) {
    if (F.all) out.push({ id: 'all', e: '✨', name: `全能力 +${F.all}`, desc: '勝つと6つの能力(ライフ・ちから・かしこさ・命中・回避・丈夫さ)が全て上がる', pt: true });
    if (F.pts) out.push({ id: 'pts', e: '🔷', name: `能力｜ポイント\u00a0+${F.pts}`, desc: '勝つと能力ポイントがもらえる。「能力」の画面で、好きな能力に振り分けられる', pt: true });
    if (F.pop) out.push({ id: 'pop', e: '⭐', name: `人気 +${F.pop}`, desc: '勝つと人気が上がる', pt: true });
    if (F.title) out.push({ id: 'ttl', e: '🏅', name: '称号', desc: `勝つと称号「${typeof msxR3TitleName === 'function' ? msxR3TitleName(F.title) : F.title}」`, rare: true });
  }
  out.push({ id: 'tk', e: '🎫', name: '修行チケット', desc: '賞金ランクが上がると1段ごとに +1(負けても獲得賞金の合計で上がる)' });
  const bpz = msxR3BeatPrize(SUC, g); if (bpz) out.push(bpz);
  return out;
};
function MsxR3PreDesk({ run, v, ev, onBack, onGo, onPause }) {
  const { SUC } = msxSuc;
  const s = run.s; const b = s.battle;
  const [win, setWin] = useState(false);
  const [prz, setPrz] = useState(null);
  useMsxR3Lines(s.aid);
  useEffect(() => { if (typeof SuccessSound !== 'undefined') SuccessSound.se('cupEntry'); }, []);
  if (!b) return null;
  const name = msxR3BattleName(SUC, b);
  const star = b.kind === 'summit' ? 4 : ((SUC.FORCED || {})[b.kind] || {}).star || 1;
  const grade = b.kind === 'summit' ? 'ヒーローズファイナル' : b.kind === 'debut' ? 'デビュー戦' : '期末の大会';
  const prizes = msxR3ForcedPrizes(SUC, b);
  const gold = prizes[0] && prizes[0].id === 'g' ? prizes[0].name.replace('賞金 ', '') : '';
  const cal = msxCalendar(s.turn);
  const openLine = { t: msxPh(`「いらっしゃいませ!｜今日は｜${name}｜の日です。｜準備ができたら、｜出場して｜くださいね」`) };
  const rankStep = typeof SUC.rankStepOf === 'function' ? SUC.rankStepOf(s) : 0; const rank = rankStep ? { name: SUC.rankNameOf(rankStep) } : null;
  const icon = msxR3BattleIcon(b);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene" style={{ flex: '1 1 0', minHeight: 200 }} data-msx-r3-pre-scene><img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/><div className="sh"/>
      <img src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', left: '-4%', bottom: 0, height: '96%', maxWidth: '62%', objectFit: 'contain', objectPosition: 'bottom' }}/>
      <div className="v-ev-h"><small>{cal.year}年目 {cal.month}月・{v.period.name}</small>🏆 大会の受付</div>
      <div className="v-ibub msx-kp" style={{ left: '44%', right: 10, top: 'auto', bottom: 12, fontSize: 13 }}>{openLine.t}</div>
    </div>
    <div className="v-cupbar" data-msx-r3-fame><span>いまの賞金</span><b>{msxFmt(s.fame)}<small>G</small></b>{rank ? <i>賞金の段 {rank.name}</i> : null}</div>
    <div className="v-cupmon"><span className="ar" aria-hidden="true" style={{ visibility: 'hidden' }}/><b>{cal.year}年目 {cal.month}月<small className="now">当日</small></b><span className="ar" aria-hidden="true" style={{ visibility: 'hidden' }}/></div>
    <div className="v-cups one">
      <button type="button" className={`v-cup v-cup2 sel ex g-${star >= 4 ? 'gold' : 'n'}`} style={{ minHeight: 84 }} onClick={() => setWin(true)} data-msx-r3-pre-card={b.kind}>
        <div className="lg"><span className="e">{icon}</span><span className="fcst fc-h">本番</span></div>
        <div className="tx">
          <div className="hd"><span className="gr2">{grade}</span><span className="cs">{msxR3Stars(star)}</span></div>
          <b>{name}</b>
          {gold ? <span className="g">{gold.replace('G', '')}<small>G</small></span> : null}
        </div>
      </button>
    </div>
    <div className="v-card" style={{ padding: '5px 9px' }}><div className="v-kv" style={{ margin: 0 }}><b>今日は</b><span className="msx-kp">{msxPh(`${grade}の日。｜トレーニングは｜できない。｜出場すると｜組み合わせ表へ｜進む`)}</span></div></div>
    {win ? (
      <div className="v-cupwin" onClick={() => { setWin(false); setPrz(null); }} data-msx-r3-cupwin>
        <div className="in" onClick={(e) => e.stopPropagation()}>
          <div className="h">大会参加確認</div>
          <div className={`sign g-${star >= 4 ? 'gold' : 'n'}`}><span className="e">{icon}</span><b>{name}</b><small>{grade} {msxR3Stars(star)}</small></div>
          <div className="sub">獲得物</div>
          <MsxR3PrizeBox prizes={prizes} onPick={setPrz}/>
          <div className="q">この大会に参加しますか?</div>
          <div className="bt"><button type="button" onClick={() => setWin(false)} data-msx-r3-pre-cancel>キャンセル</button><button type="button" className="go" onClick={onGo} data-msx-r3-yes>はい</button></div>
          {prz ? <div className="det" onClick={() => setPrz(null)}><div className="dbox" onClick={(e) => e.stopPropagation()}><div className="e">{typeof msxItemIco === 'function' ? msxItemIco(prz) : prz.e}</div><b>{msxPh(prz.name)}</b><p className="msx-kp">{msxPh(prz.desc)}</p>{SUC.ITEMS && SUC.ITEMS[prz.id] ? <div className="own" data-msx-r3-prize-own={prz.id}><i>所持数</i><span>{(s.bag && s.bag[prz.id]) || 0}</span></div> : null}<button type="button" onClick={() => setPrz(null)}>閉じる</button></div></div> : null}
        </div>
      </div>) : null}
  </>);
  const foot = (
    <div className="v-ft">
      <button type="button" onClick={onBack}>← 戻る</button>
      <button type="button" className="go" onClick={() => setWin(true)} data-msx-r3-enter>出場 ▶</button>
    </div>
  );
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}
function MsxR3Battle({ run, setRun, v, ev, ctx, bondLv, onPause, debug }) {
  const { SUC } = msxSuc;
  const s = run.s; const b = s.battle; const st3 = run.out && run.out.r3 ? run.out.r3 : null; // 勝ち負けを付けたあとの段
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [failed, setFailed] = useState(false);
  const [tables, setTables] = useState(false);
  const showOn = typeof MonsucCupShow === 'function' && !debug; // バトル部の「見せる」部品があれば、組み合わせ表〜優勝/負けはそちら
  const [step, setStep] = useState(() => (run.r3skip && !showOn ? 'auto' : 'bracket'));
  const pendRef = useRef(null);
  const [tab, setTab] = useState('st');
  useMsxR3Lines(s.aid);
  // 大会の曲(2026-11-14 社長の曲・ビート部の表): 組み合わせ表と札=cupPre / 試合=cupMatch / 決着の表示=cupWin・cupLose(ジングル1回) → 決着の段は cupAfter(下の effect)
  //   バトル部の見せる部品(MonsucCupShow)は段を onPhase で知らせてくる。部品が無いときは、ここの step で決める
  const [showPh, setShowPh] = useState('bracket');
  // 知らせの段を見終えた大会(この画面のあいだだけ。やり直し・もう一度では出さない)
  const [introSeen, setIntroSeen] = useState(null);
  // デバッグの「勝ったことにする」→「決勝へ」の流れでも、札(card)からあとは見せる部品が出る。その段も見る(2026-11-15 r1115-048 デバッグの流れで試合の曲に替わらなかった)
  const showView = showOn || (!!debug && typeof MonsucCupShow === 'function' && (step === 'card' || step === 'watch'));
  const cupSound = showView ? (showPh === 'win' ? 'cupWin' : showPh === 'lose' ? 'cupLose' : showPh === 'cutin' || showPh === 'match' ? 'cupMatch' : 'cupPre')
    : step === 'lost' ? 'cupLose' : step === 'bracket' || step === 'card' ? 'cupPre' : 'cupMatch';
  useSuccessScene(st3 ? null : cupSound, { season: msxCalendar(s.turn).season });
  // 決着が付いたあと(ごほうび・昇級の段): 勝敗ジングルは1回だけ鳴らし、鳴り終わったら大会の曲(cupAfter)をループさせる(無音にしない)
  //   決着の印が替わるたびに1回だけ。開き直して決着の段から始まるときは印を済ませておき、ジングルを鳴らさず曲をすぐ流す
  const settledKey = st3 ? `${st3.won ? 'cupWin' : 'cupLose'}:${st3.from}` : null;
  const settledRef = useRef(settledKey);
  useEffect(() => {
    if (!st3 || typeof SuccessSound === 'undefined') return undefined;
    if (settledRef.current !== settledKey) { settledRef.current = settledKey; SuccessSound.scene(st3.won ? 'cupWin' : 'cupLose'); }
    return SuccessSound.sceneAfterOnce('cupAfter', { season: msxCalendar(s.turn).season });
  }, [settledKey]);
  // 試合のあいだは、試合の曲が確かに鳴っているかを見張り、違えば鳴らし直す(読み込みの失敗・ジングルのあと・中断からの再開でも試合の曲へ。r1115-048)
  useEffect(() => {
    if (cupSound !== 'cupMatch' || typeof SuccessSound === 'undefined' || typeof SuccessSound.keep !== 'function') return undefined;
    const season = msxCalendar(s.turn).season;
    const t = setInterval(() => SuccessSound.keep('cupMatch', season), 1500);
    return () => clearInterval(t);
  }, [cupSound]);
  useEffect(() => {
    let alive = true;
    // 試合型のアシストの表を読み終えてから試合を作る(読む前と後で同じ試合の結果が変わらないように)
    Promise.all([engine ? Promise.resolve(engine) : msxR3LoadEngine(), msxR3LoadTables()]).then(([e]) => { if (!alive) return; setTables(true); if (e) setEngine(e); else setFailed(true); });
    return () => { alive = false; };
  }, []);
  const fight = useMemo(() => (engine && tables && b ? msxR3Fight(engine, SUC, run) : null), [engine, tables, b && b.kind, b && b.again, b && b.reroll, b && b.round, b && b.retry, s.turn]);
  const name = b ? msxR3BattleName(SUC, b) : st3 ? st3.name : '';
  // 負けでも、ごほうび(準優勝の賞金・チケット・ビートPなど)をもらったら見せる(r1115-202 M6)
  const msxR3HasPrize = (d) => !!d && ((d.fame || 0) > 0 || (d.tickets || 0) > 0 || (d.beat || 0) > 0 || (d.pts || 0) > 0 || (d.sand || 0) > 0 || Object.keys(d.items || {}).length > 0 || (d.titles || []).length > 0);
  const runNoPend = () => { const o = { ...run }; delete o.showPend; return o; };
  // 勝ち負けを付ける(負けのときは、やり直さないと決めたあと)
  const settle = (won) => {
    const before = s; const r = SUC.settle(s, won, fight && fight.use);
    const d = msxR3Diff(before, r.state);
    const out = { r3: { stage: won || msxR3HasPrize(d) ? 'prize' : d.rankTo > d.rankFrom ? 'rank' : 'result', won, name, icon: msxR3BattleIcon(b), kind: b ? b.kind : null, round: b ? b.round : null, d, foe: fight ? fight.opp : null, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: before.turn, gameover: !!r.out.gameover } };
    setRun({ ...runNoPend(), s: r.state, phase: 'battle', out, r3skip: undefined, arcAfter: msxArcAfterOf(SUC, s, b, won, fight && fight.opp) || undefined, log: [...(run.log || []), { turn: before.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20) });
    setStep('bracket');
  };
  // 見せる部品の流れ: settle(won) で勝ち負けを付けて賞品の行を返し、「次へ」(onNext)で次の段へ
  //   (run.s を先に替えると見せる部品が作り直されるので、s はそのまま。決着は run.showPend に入れて先に保存する。
  //    結果の画面で閉じても、開き直したら保存した決着から続ける。同じ試合をやり直さない・r1115-202 M1)
  const commitSettle = ({ r, d, won, before, opp }) => {
    const foe = opp !== undefined ? opp : fight ? fight.opp : null;
    const s2 = r.state; const log = [...(run.log || []), { turn: before.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20);
    const arcAfter = msxArcAfterOf(SUC, before, b, won, foe) || undefined; // ヒーローズファイナルの試合のあとの掛け合い
    const rankUp = d && d.rankTo > d.rankFrom; // 賞金ランクが上がったら、ピラミッドの段を1枚はさむ(2026-11-14)
    const prizeLost = !won && msxR3HasPrize(d); // 負けて準優勝のごほうびをもらった(M6): 賞品の段で見せる
    const r3 = { won, name, icon: msxR3BattleIcon(b), kind: b ? b.kind : null, round: b ? b.round : null, d, foe, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: before.turn, gameover: !!(r.out && r.out.gameover) };
    if (prizeLost) { setRun({ ...runNoPend(), s: s2, phase: 'battle', r3skip: undefined, arcAfter, log, out: { r3: { ...r3, stage: 'prize' } } }); return; }
    if (rankUp) { setRun({ ...runNoPend(), s: s2, phase: 'battle', r3skip: undefined, arcAfter, log, out: { r3: { ...r3, stage: 'rank' } } }); return; }
    const base = { ...runNoPend(), s: s2, r3skip: undefined, arcAfter, log, out: null };
    if (s2.battle) setRun({ ...base, phase: 'battle' }); else if (s2.over) setRun({ ...base, phase: 'over' }); else setRun({ ...base, phase: 'turn', out: { from: before.turn } });
  };
  const settleShow = (won, use) => {
    const before = s; const r = SUC.settle(s, won, use || (fight && fight.use)); /* use: 自分で操作した試合なら、その試合の技ごとの使った回数 */
    const d = msxR3Diff(before, r.state); const opp = fight ? fight.opp : null;
    pendRef.current = { r, d, won, before, opp };
    setRun({ ...run, showPend: { s: r.state, won: !!won, turn: before.turn, opp, gameover: !!(r.out && r.out.gameover) } }); // 決着を先に保存(s は替えない)
    return { rows: msxR3PrizeRows(d, r.state).map(([i, k, vv, c]) => ({ i, k, v: vv, big: c === 'new' })), prize: d.fame, tickets: d.tickets };
  };
  // 保存した決着(開き直したとき)から、続きの段を作る
  const pendOfRun = () => { const p = run.showPend; return p && p.s ? { r: { state: p.s, out: { gameover: !!p.gameover } }, d: msxR3Diff(s, p.s), won: !!p.won, before: s, opp: p.opp || null } : null; };
  const nextShow = () => { const p = pendRef.current || pendOfRun(); if (!p) return; pendRef.current = null; commitSettle(p); };
  // 結果の画面で閉じて開き直した: 試合からやり直さず、保存した決着の結果(賞品の段)から続ける
  useEffect(() => {
    if (pendRef.current || !run.showPend) return;
    const p = pendOfRun(); if (!p) return;
    const won = p.won; const hasPrize = msxR3HasPrize(p.d);
    if (won || hasPrize) {
      const r3 = { stage: 'prize', won, name, icon: msxR3BattleIcon(b), kind: b ? b.kind : null, round: b ? b.round : null, d: p.d, foe: p.opp, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: s.turn, gameover: !!p.r.out.gameover };
      setRun({ ...runNoPend(), s: p.r.state, phase: 'battle', r3skip: undefined, arcAfter: msxArcAfterOf(SUC, s, b, won, p.opp) || undefined, log: [...(run.log || []), { turn: s.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20), out: { r3 } });
    } else commitSettle(p);
  }, []);
  const rematchWith = (item) => { const r = SUC.rematch(s, item); if (!r.out.ok) return; setRun({ ...run, s: r.state, log: [...(run.log || []), { turn: s.turn, t: `${item === 'rainbow' ? '虹の時渡りの砂時計' : '時渡りの砂時計'}でやり直した` }].slice(-20) }); setStep('card'); };
  // 次へ(精算のあと): 続けて強制大会 → もう一度 / 終わり → 引退 / ふつう → ターンが進む
  const finish = (s2) => {
    const fromTurn = st3 ? st3.from : s.turn;
    if (s2.battle) setRun({ ...run, s: s2, phase: 'battle', out: null });
    else if (s2.over) setRun({ ...run, s: s2, phase: 'over', out: null });
    else setRun({ ...run, s: s2, phase: 'turn', out: { from: fromTurn } });
  };
  const result = () => { if (!fight) return; if (fight.won) settle(true); else setStep('lost'); };
  useEffect(() => { if (step === 'auto' && fight && !showOn) result(); }, [step, fight]);
  const actx = ctx || { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick, species: s.species };
  // ヒーローズファイナル: 試合のあとの掛け合い(56-monhero-success-arc.jsx)。賞品・ごはんの前に出す
  if (run.arcAfter) return <MsxArcAfter run={run} v={v} ev={ev} onPause={onPause} ctx={actx} bondLv={bondLv || 1} after={run.arcAfter} onDone={() => setRun({ ...run, arcAfter: undefined })}/>;

  // ---- 勝ち負けを付けたあと: 賞品(B2)の段。優勝のごはんは ここでは出さない(ファームで あげる) ----
  if (st3) { // 期末の月に大会へ出て勝つと、続けて強制大会が立つ(s.battle がある)。賞品を先に見せてから次の1戦へ
    const d = st3.d || {};
    if (st3.stage === 'rank') { // 賞金ランク UP!(参考のピラミッド)
      const body = (<>
        <MsxBand s={s} v={v} ev={ev}/>
        <div className="v-scene" style={{ flex: '1 1 0', minHeight: 120 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
          <div className="v-stamp msx-pop" style={{ top: '8%', fontSize: 34 }}>ランク UP!<small>{msxR3RankName(d.rankFrom || 0)} → {msxR3RankName(d.rankTo)}・🎫 修行チケット +{SUC && typeof SUC.rankTicketsOf === 'function' ? SUC.rankTicketsOf(d.rankFrom || 0, d.rankTo || 0) : (d.rankTo || 0) - (d.rankFrom || 0)}</small></div></div>
        <MsxR3RankPyramid step={d.rankTo || 0} up total={s.fameTotal} gain={d.fameGain}/>
      </>);
      return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)} data-msx-r3-next>次へ ▶</button></div>}/>;
    }
    if (st3.stage === 'prize') {
      const rows = msxR3PrizeRows(d, s, st3.rival);
      const body = (<>
        <MsxBand s={s} v={v} ev={ev}/>
        <div className="v-scene" style={{ flex: '1 1 0', minHeight: 150 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
          <div className="gr" style={{ bottom: 'calc(30% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '30%', height: '40%' }}/>
          <div className={`v-stamp msx-pop${st3.won ? '' : ' ng'}`} style={{ top: '4%', fontSize: st3.won ? 42 : 34 }} data-msx-r3-prize-stamp={st3.won ? 'win' : 'second'}>{st3.won ? msxR3WinWord(st3.kind, st3.round) : '準優勝'}<small>{cardIconNode(st3.icon, 16)} {st3.name}{st3.won && st3.foe && st3.foe.name ? `・1戦: ${st3.foe.name} に勝った` : ''}</small></div>
          {st3.rival && st3.won ? <div className="v-rvw">{st3.foe ? <MsxRivalThumb rival={st3.foe} size={22}/> : null}ライバルの {st3.rivalName} に 勝った!<b>能力ポイント1.5倍</b></div> : null}
          <div className="v-trophy">{st3.won ? '🏆' : '🥈'}</div></div>
        <MsxR3RankPyramid step={d.rankTo || 0} up={d.rankTo > d.rankFrom} total={s.fameTotal} gain={d.fameGain}/>
        <div className="v-prz">{rows.length ? rows.map(([e, n, t, c, nw], i) => <div key={i} className={c}><span className="e">{e}</span><b>{n}</b><span className="t">{t}</span>{nw ? <i>{nw}</i> : null}</div>) : <div><span className="e">🏆</span><b>{st3.won ? msxR3WinWord(st3.kind, st3.round).replace('!', '') : '準優勝'}</b><span className="t">よくがんばった!</span></div>}</div>
        {typeof MsxGaugeFx === 'function' ? <MsxGaugeFx key={`cupgfx-${s.turn}`} items={msxR3GainItems(d, s)}/> : null}
        {!st3.won ? <MsxSay aid={s.aid} ex="normal" text="「くやしいけど、準優勝のごほうびはもらえたよ。つぎは いちばん上をめざそ!」"/> : (() => { const l = msxR3Line('turn.cup.win', run, { cup: st3.name, rival: st3.rivalName || '' }, st3.rival ? '「ライバルに勝ったから、能力ポイントが いつもの1.5倍! ごほうびのごはんは、ファームに帰ってから あげよう!」' : '「やったね! ごほうびのごはんは、ファームに帰ってから あげよう!」'); return <MsxSay aid={s.aid} ex={l.e || 'excited'} text={l.t}/>; })()}
        {st3.won && s.mealReady && !s.over ? <div className="msx-note" data-msx-r3-mealwait style={{ textAlign: 'center' }}>🍽 ごほうびのごはんは、ファーム（ホーム）で待っているよ</div> : null}
      </>);
      return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)} data-msx-r3-next>次へ ▶</button></div>}/>;
    }
    // 結果の場面(負けて ごほうびも ランクも無いとき)。優勝のごはんは ここでは出さない:
    //   権利(芯の s.mealReady / s.mealOpts)は育成に残ったまま、ファーム(ホーム)で あげる(2026-11-17 社長「ファームに戻ってから。音楽もファームの音楽」)。
    //   古い保存で ごはんの段(stage 'meal')にいた育成も ここに出て、「次へ」で進める(権利は そのまま残る)
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className={`v-scene ${st3.won ? '' : 'dk'}`} style={{ flex: '1 1 0', minHeight: 260 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>{st3.won ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(40% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '40%', height: '34%', ...(st3.won ? {} : { filter: 'grayscale(.5) drop-shadow(0 8px 5px #0009)' }) }}/>
        <div className={`v-stamp ${st3.won ? '' : 'ng'}`} style={{ top: '4%', fontSize: st3.won ? 42 : 34 }}>{st3.won ? '優勝!' : '負けた…'}<small>{cardIconNode(st3.icon, 16)} {st3.name}{d.fame ? `・賞金 💰${msxFmt(d.fame)}` : ''}</small></div>
        {!st3.won && !s.over ? (
          // 2026-11-13 社長: 負けたらごはんはなし。画面は出さず、助手の慰めの一言だけ
          <div className="v-meal" data-msx-r3-lostnote><div className="row"><img className="fc" src={msxFace(s.aid, 'troubled')} alt=""/><div className="bub f1">{msxR3Line('turn.cup.lose', run, { cup: st3.name }, '「おつかれさま。負けちゃったけど、ここまでよくがんばったよ。次、いこ!」').t}</div></div></div>
        ) : null}
      </div>
    </>);
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)} data-msx-r3-next>次へ ▶</button></div>}/>;
  }
  if (!b) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">大会の中身を読めませんでした</div>} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)}>次へ ▶</button></div>}/>;

  // ---- 読み込み ----
  if (failed) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">試合を読み込めませんでした。電波のよい所で、もう一度開いてください</div>} foot={<div className="v-ft"><button type="button" onClick={onPause}>← 中断</button></div>}/>;
  if (!fight) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note" data-msx-r3-loading>大会の準備をしています…</div>} foot={null}/>;
  const opp = fight.opp;
  // ヒーローズファイナル: 試合の前に、助手が相手を選ぶ(1戦ごとに1回。やり直しでは出さない)
  const pickKey = b.kind === 'summit' ? `${s.turn}:${b.round}` : null;
  if (pickKey && msxArcHas(SUC, s.aid) && run.arcPick !== pickKey) return <MsxArcPick run={run} v={v} ev={ev} onPause={onPause} ctx={actx} bondLv={bondLv || 1} opp={opp} round={b.round} onDone={() => setRun({ ...run, arcPick: pickKey })}/>;
  const skip = typeof SUC.canSkip === 'function' && SUC.canSkip(s);
  const foeName = opp.name || msxMonName(opp.species);

  // ---- 大会の入り(紋章と大会名。組み合わせ表の前に1回)。大会の曲 cupPre はここから ----
  const introKey = `${s.turn}|${b.kind}|${b.round || 0}`;
  if (!st3 && step === 'bracket' && introSeen !== introKey && !run.r3skip) {
    const title = b.kind === 'cup' ? msxR3CupName(b.sys, b.name) : name;
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<MsxR3CupIntro key={introKey} b={b} title={title} onGo={() => setIntroSeen(introKey)}/>}
      foot={<div className="v-ft"><button type="button" className="go" onClick={() => setIntroSeen(introKey)} data-msx-r3-cupintro-go>SKIP ▸▸</button></div>}/>;
  }
  // ---- バトル部の見せる部品(組み合わせ表・バトルカード・カットイン・観戦・優勝/負け)。試合の計算と勝ち負けの記録は回3 ----
  // デバッグで開いたときも、「⚔ 1戦へ」からはバトル部の部品の試合(手動が基本・染めた色・モンスターの名前の札)を通す(2026-11-14 社長「バトルがオートだった」・Fable の点検)。
  //   組み合わせ表(このあとの「勝ったことにする」などの確かめのボタン)だけは回3のまま
  const showDbg = debug && typeof MonsucCupShow === 'function' && (step === 'card' || step === 'watch');
  if (showOn || showDbg) {
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={
      <MonsucCupShow startAt={showDbg ? 'card' : undefined} suc={SUC} s={s} me={{ name: run.nick || msxMonName(s.species), colors: Array.isArray(run.colors) ? run.colors : null }} title={b.kind === 'cup' ? msxR3CupName(b.sys, b.name) : name} opp={{ loy: opp.loy, pop: opp.pop }}
        fight={() => fight} settle={settleShow} onRematch={rematchWith} onNext={nextShow} onClose={onPause} onPhase={setShowPh}/>} foot={null}/>;
  }
  // ---- 負けた(C4): やり直す/あきらめる ----
  if (step === 'lost') {
    const left = (SUC.REMATCH ? SUC.REMATCH.max : 3) - (s.rematchUsed || 0);
    const has = (k) => (s.items && s.items[k]) || 0;
    const re = rematchWith;
    const debutLeft = b.kind === 'debut' ? Math.max(0, 3 - (s.debutLoss || 0) - 1) : null;
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene dk" style={{ flex: '1 1 0', minHeight: 300 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
        <div className="gr" style={{ bottom: 'calc(44% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '44%', height: '30%', filter: 'grayscale(.5) drop-shadow(0 8px 5px #0009)', transform: 'translateX(-50%) rotate(-8deg)' }}/>
        <div className="v-stamp ng" style={{ top: '5%' }}>負けた…<small>{msxR3BattleIcon(b)} {name} {foeName} に負けた</small></div>
        <div className="v-meal" style={{ borderColor: '#7dd3fc', boxShadow: '0 0 18px #38bdf866' }}>
          <div className="t">時をもどして、やり直す?<small>やり直せるのは 1回の育成で3回まで・<b style={{ color: '#fde047' }}>残り {left} / 3</b></small></div>
          <div className="v-rm3">
            <button type="button" className="re" disabled={!SUC.canRematch(s, 'sand')} style={{ opacity: SUC.canRematch(s, 'sand') ? 1 : 0.45 }} onClick={() => re('sand')} data-msx-r3-sand>
              <img src="images/success/items/hourglass.png" alt="" style={{ width: 30, height: 30 }}/><div>時渡りの砂時計で やり直す<small>同じ相手ともう一度(持っている ×{has('sand')})</small></div></button>
            <button type="button" className="nj" disabled={!SUC.canRematch(s, 'rainbow')} style={{ opacity: SUC.canRematch(s, 'rainbow') ? 1 : 0.45 }} onClick={() => re('rainbow')} data-msx-r3-rainbow>
              <img src="images/success/items/hourglass-rainbow.png" alt="" style={{ width: 30, height: 30 }}/><div>虹の砂時計で 相手を変えて やり直す<small>ちがう相手と戦える(持っている ×{has('rainbow')})</small></div></button>
            <button type="button" className="gv" onClick={() => settle(false)} data-msx-r3-giveup>あきらめる<small>{b.kind === 'debut' ? `デビュー戦の負け ${(s.debutLoss || 0) + 1} / 3${debutLeft === 0 ? '(育成はここまで)' : ''}` : b.kind === 'summit' ? 'ヒーローズファイナルはここまで(引退へ)' : '準優勝のごほうびをもらう'}</small></button>
          </div>
          <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, 'troubled')} alt=""/><div className="bub f1">{msxR3Line('turn.cup.lose', run, { cup: name, rival: b.rival ? b.rival.name : '' }, '「おしかった! もう1回いく?」').t}</div></div>
        </div>
      </div>
      {typeof MsxBetaTalk === 'function' ? <MsxBetaTalk keys={['rematch']} ctx={{ ...actx, bond: bondLv || 1 }}/> : null}
    </>);
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><span className="v-wait">えらんでね</span></div>}/>;
  }

  // ---- 観戦 ----
  if (step === 'watch') {
    const body = (<>
      <div className="v-ev-h" style={{ position: 'relative', marginTop: 6 }}><small>{name}</small>⚔ {run.nick} VS {foeName}</div>
      <MsxR3Watch fight={fight} onDone={result}/>
    </>);
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={null}/>;
  }

  // ---- バトルカード(C2): 能力の比べ ----
  if (step === 'card') {
    const loyA = SUC.loyalOf(s);
    const rowsSt = MSX_STATS.map((k) => [k, `${MSX_STAT_ICON[k]} ${MSX_STAT_NAME[k]}`, s.stats[k], opp.stats[k]]);
    const better = MSX_STATS.filter((k) => s.stats[k] >= opp.stats[k]).map((k) => MSX_STAT_NAME[k]);
    const distA = typeof SUC.aptGradesOf === 'function' ? SUC.aptGradesOf(s) : (msxMon(s.species) || {}).distAptitude || []; const distB = (msxMon(opp.species) || {}).distAptitude || [];
    const lvA = (g) => ({ M: 3, 'SS+': 3, SS: 3, 'S+': 3, S: 3, A: 3, B: 2, C: 1 }[g] || 0);
    const techA = (Array.isArray(s.techs) ? s.techs : []).map((id) => { const t = (SUC.techsOf(s.species) || []).find((x) => x.id === id); return t ? t.name : null; }).filter(Boolean);
    // 相手の技は、実際の試合(msxR3Fight)と同じ決め方で出す: techIds があれば種の技表で実在する物だけ → 無ければ種の技表の先頭から個数ぶん(最低1つ・無指定は2つ)。
    //   決め方が試合とズレると「見た技と違う技で戦う」事故になるので、r3-store の msxR3Fight と突き合わせて同じにする
    const oppTechTable = typeof SUC.techsOf === 'function' ? (SUC.techsOf(opp.species) || []) : [];
    const oppTechIds0 = Array.isArray(opp.techIds) && opp.techIds.length ? opp.techIds.filter((id) => oppTechTable.some((t) => t.id === id)) : [];
    const oppTechIds = oppTechIds0.length ? oppTechIds0 : oppTechTable.slice(0, Math.max(1, opp.techs || 2)).map((t) => t.id);
    const oppTechs = oppTechIds.map((id) => oppTechTable.find((t) => t.id === id)).filter(Boolean);
    const techDistText = (t) => (Array.isArray(t.dist) ? t.dist.map((d) => (typeof MSX_DIST_NAMES !== 'undefined' ? MSX_DIST_NAMES : ['零', '近', '中', '遠'])[d] || '').filter(Boolean).join('・') : '');
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-bcs"><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
        <div className="ttl">{name} ・ 1戦</div>
        {s.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(s.awake)} src={msxMonImg(s.species)} className="ml"><img src={msxMonImg(s.species)} alt="" style={{ height: '100%', objectFit: 'contain' }}/></MsxKira> : <img className="ml" src={msxMonImg(s.species)} alt=""/>}<img className="mr" src={msxMonImg(opp.species)} alt=""/><div className="vsw">VS</div>
        <div className="nb l"><b>{run.nick}</b><small><i className={msxRankCls(ev.rank)}>{ev.rank}</i> {msxFmt(ev.power)}</small></div>
        <div className="nb r"><b>{foeName}</b><small>{opp.champ ? '👑王者' : opp.rival ? 'ライバル' : msxMonName(opp.species)}</small></div></div>
      <div className="v-tabs t3">{[['st', 'ステータス'], ['tech', '技'], ['etc', '能力']].map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} style={{ textAlign: 'center', background: tab === k ? '#3b2f0b' : '#1e1a36', border: `1.5px solid ${tab === k ? '#fde047' : '#475569'}`, borderRadius: 99, padding: 4, fontSize: 12, fontWeight: 900, color: tab === k ? '#fde047' : '#cbd5e1' }}>{n}</button>)}</div>
      <div className="v-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {tab === 'st' ? <>
          {rowsSt.map(([k, n, a, c]) => <div key={n} className="v-vs1"><b className={a >= c ? 'w' : ''}>{a}{typeof msxStatRankOf === 'function' ? <i className={msxStatRankCls(a)}>{msxStatRankOf(a)}</i> : null}</b><i className="l" style={{ '--bc': typeof MSX_STAT_COLOR !== 'undefined' ? MSX_STAT_COLOR[k] : undefined }}><u style={{ width: `${a / 10}%` }}/></i><span>{n}</span><i className="r" style={{ '--bc': typeof MSX_STAT_COLOR !== 'undefined' ? MSX_STAT_COLOR[k] : undefined }}><u style={{ width: `${c / 10}%` }}/></i><b className={c > a ? 'w' : ''}>{typeof msxStatRankOf === 'function' ? <i className={msxStatRankCls(c)}>{msxStatRankOf(c)}</i> : null}{c}</b></div>)}
          <div className="v-vs1"><b className={s.pop >= (opp.pop || 0) ? 'w' : ''}>{s.pop}</b><i className="l p"><u style={{ width: `${s.pop}%` }}/></i><span>⭐ 人気</span><i className="r p"><u style={{ width: `${opp.pop || 0}%` }}/></i><b className={(opp.pop || 0) > s.pop ? 'w' : ''}>{Number.isFinite(opp.pop) ? opp.pop : '—'}</b></div>
          <div className="v-vs1"><b className={loyA >= (opp.loy || 0) ? 'w' : ''}>{loyA}</b><i className="l p"><u style={{ width: `${loyA}%` }}/></i><span>🤝 忠誠</span><i className="r p"><u style={{ width: `${opp.loy || 0}%` }}/></i><b className={(opp.loy || 0) > loyA ? 'w' : ''}>{Number.isFinite(opp.loy) ? opp.loy : '—'}</b></div>
          <div className="v-dist"><div>{['零', '近', '中', '遠'].map((dn, i) => <i key={dn} className={`a${lvA(distA[i])}`}>{dn}</i>)}</div><span>間合いの適性</span><div>{[3, 2, 1, 0].map((i) => <i key={i} className={`a${lvA(distB[i])}`}>{['零', '近', '中', '遠'][i]}</i>)}</div></div>
        </> : tab === 'tech' ? <>
          <div className="v-kv"><b>{run.nick}</b><span>{techA.length ? techA.join('・') : '初めから使える技'}</span></div>
          <div className="v-kv" data-msx-r3-opp-techs={oppTechIds.join(',')}><b>{foeName}</b><span>{oppTechs.length ? oppTechs.map((t) => `${t.name}(${techDistText(t)}・${t.kind === 'wise' ? 'かしこさ' : 'ちから'}・ガッツ${t.guts})`).join('、') : `技 ${opp.techs}つ`}・熟練 {opp.mastery}</span></div>
        </> : <>
          <div className="v-kv"><b>総合力</b><span>{msxFmt(ev.power)}(ランク {ev.rank})</span></div>
          <div className="v-kv"><b>相手の能力の合計</b><span>{msxFmt(opp.sum)}・あなた {msxFmt(MSX_STATS.reduce((a, k) => a + s.stats[k], 0))}</span></div>
          {opp.note ? <div className="v-kv"><b>うわさ</b><span>{opp.note}</span></div> : null}
        </>}
      </div>
      <div className="v-hint"><img src={msxFace(s.aid, 'excited')} alt=""/>{better.length ? <span>{better.length >= MSX_STATS.length ? '能力は全部' : better.slice(0, 2).join('と')}は勝ってる! <em>落ち着いて</em>いこう!</span> : <span>相手は強いよ… <em>ねばって</em>いこう!</span>}</div>
    </>);
    const foot = <div className="v-ft"><button type="button" className="on" style={{ flex: 1.2 }} onClick={result} data-msx-r3-result>結果だけ見る</button><button type="button" className="go" style={{ flex: 1.2 }} onClick={() => setStep('watch')} data-msx-r3-ready>準備完了 ▶</button></div>;
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
  }

  // ---- 組み合わせ表(B1)。1回戦→準決勝が自動で進む演出。戦うのは決勝の1戦だけ(MsxR3Bracket) ----
  return <MsxR3Bracket run={run} s={s} v={v} ev={ev} b={b} name={name} opp={opp} foeName={foeName} skip={skip} debug={debug} settle={settle} result={result} toCard={() => setStep('card')} onPause={onPause}/>;
}
