// 助手がモンヒロバトルにいるときにできること: 👀 修行を見る・📣 応援する(2026-11-11 シュギョウ2・台帳 #5350)
//   設計と止め絵: docs/progress/assistant-peer/masmon-train/cheer/PLAN.md
//   社長の答え(窓口経由 2026-11-11): 応援は 1回 熟練+1・💗+5・1日3回/練習の相手はフレンドのマスモン → 自分の別のマスモン → 一人(一人は修行の伸び ×0.5)/
//   修行を見ても応援と同じ得(見ると応援を合わせて1日3回・移動1回に1回)
//   公開の印 RELEASE_FLAGS.assistantMasmonCheer が偽のあいだ、口はすべて null / 何もしない(修行の結果も今のまま)
//   保存は新しいキー mh_assistant_masmon_cheer_v1 だけ。修行の保存(mh_assistant_masmon_train_v1)へは熟練を足すだけ(amgtSave の守りを通す)
const ASSISTANT_MASMON_CHEER_KEY = 'mh_assistant_masmon_cheer_v1';
// 数字はここだけ
const AMGC_NUM = Object.freeze({
  mastery: 1, // 1回の熟練(いちばん最近に修行したマスモンの、いちばん低い技1つ)
  bond: 5, // 1回の 💗 仲良し度(data/assistants.js の lifeCheer。1日の上限もそちら)
  perDay: 3, // 見る・応援を合わせて、助手1人の1日の回数
  soloMult: 0.5, // 一人で修行したときの伸び(練習相手がいない。社長が ×0.5 を選んだ・部の推奨は ×0.7)
  friendDays: 7, // フレンドの登録編成を見つけた日から、相手ありとみなす日数
});
const amgcOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonCheer === true && typeof amgtOn === 'function' && amgtOn();
const amgcOkAid = (aid) => typeof aid === 'string' && /^[a-z]{2,12}$/.test(aid);
const amgcInt = (v, d, lo, hi) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : d);
// 形: { v:1, day: { [助手]: { d: 日, n: 今日の回数, s: [得をもらった生活の回 abs] } }, fr: フレンドの登録編成を見つけた日(-1 は無し) }
const normalizeAssistantMasmonCheer = (raw) => {
  const out = { v: 1, day: {}, fr: -1 };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.day && typeof raw.day === 'object' && !Array.isArray(raw.day)) for (const [aid, x] of Object.entries(raw.day)) {
    if (!amgcOkAid(aid) || !x || typeof x !== 'object') continue;
    out.day[aid] = { d: amgcInt(x.d, -1, -1, 1e7), n: amgcInt(x.n, 0, 0, 99), s: [...new Set((Array.isArray(x.s) ? x.s : []).filter(n => Number.isInteger(n) && n >= 0))].slice(-12) };
  }
  out.fr = amgcInt(raw.fr, -1, -1, 1e7);
  return out;
};
const AMGC_STORE = { state: normalizeAssistantMasmonCheer(null), loaded: false, subs: new Set(),
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    this._p = this._p || (async () => {
      let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_CHEER_KEY, null, false) : null; } catch (_) {}
      this.loaded = true; this.set(normalizeAssistantMasmonCheer(raw)); return this.state;
    })();
    return this._p;
  } };
// 読み込む前は書かない(空の既定値で前の記録を上書きしない)
const amgcSave = (next) => {
  if (!AMGC_STORE.loaded) return false;
  AMGC_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_CHEER_KEY, next, false); } catch (_) {}
  return true;
};
if (typeof window !== 'undefined') setTimeout(() => { try { if (amgcOn()) AMGC_STORE.load(); } catch (_) {} }, 0);

const amgcToday = (now = Date.now()) => amgtSlotDay(amgtSlotOf(now));
const amgcRowsOf = (aid) => {
  try { return typeof assistantMasmonRowsOf === 'function' && typeof ASSISTANT_MASMON_STORE !== 'undefined' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid).filter(t => t && typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[t.monster]) : []; } catch (_) { return []; }
};
// 解放前の助手には関われない(カイホウ assistantPartnerOkNow。無いあいだ・今の人は常に関われる)
const amgcPartnerOk = (aid) => { try { return typeof assistantPartnerOkNow === 'function' ? assistantPartnerOkNow(aid) !== false : true; } catch (_) { return true; } };
const amgcLife = () => (typeof ASSISTANT_LIFE_STORE !== 'undefined' && ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.life) || null;
const amgcAtBattle = (aid, life = amgcLife()) => {
  try { const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, aid) : null; return !!(w && w.place === AMGT_PLACE); } catch (_) { return false; }
};

// ---------- 練習の相手(社長: フレンドのマスモン → 自分の別のマスモン → 一人) ----------
// 修行は通信せずに回るので、「フレンド」は 👀 で見たときに登録編成を見つけた日を覚えておく(amgcNoteFriend)
const amgcSparOf = (aid, now = Date.now()) => {
  const fr = AMGC_STORE.state.fr;
  if (fr >= 0 && amgcToday(now) - fr < AMGC_NUM.friendDays) return 'friend';
  if (amgcRowsOf(aid).length >= 2) return 'own';
  return 'solo';
};
// 修行の伸びの掛け算(修行の amgtDo から呼ぶ)。印が偽なら 1
const amgcSparMult = (aid) => { try { return amgcOn() && AMGC_STORE.loaded && amgcSparOf(aid) === 'solo' ? AMGC_NUM.soloMult : 1; } catch (_) { return 1; } };
const amgcNoteFriend = (found, now = Date.now()) => {
  if (!found || !AMGC_STORE.loaded) return;
  const d = amgcToday(now); if (AMGC_STORE.state.fr === d) return;
  amgcSave({ ...AMGC_STORE.state, fr: d });
};

// ---------- いちばん最近の修行 ----------
// { row, key, me, log(そのときの1回), today }。修行が1回も無ければ null
const amgcLastShugyo = (aid, now = Date.now()) => {
  const rows = amgcRowsOf(aid); const mons = (AMGT_STORE.state.mons || {})[aid] || {};
  let best = null;
  for (const row of rows) {
    const me = mons[amgtKeyOf(row)]; const x = me && me.log[me.log.length - 1];
    if (x && (!best || x.s > best.log.s)) best = { row, key: amgtKeyOf(row), me, log: x };
  }
  if (best) best.today = amgtSlotDay(best.log.s) === amgcToday(now);
  return best;
};
const amgcTechName = (monster, id) => ((AMGT_SENSE.find(x => x[0] === id) || [])[1]) || ((amgtTechsOf(monster).find(t => t.id === id) || {}).name) || '';

// ---------- 地図の窓の1行(ナカヨシ19が place==='battle' の行で呼ぶ) ----------
// 印が偽・マスモンがいない → null(ボタンも「きょうの修行」の行も出さない)
const assistantMasmonTrainRowInfo = (aid, now = Date.now()) => {
  if (!amgcOn() || !amgcOkAid(aid) || !amgcPartnerOk(aid)) return null;
  const rows = amgcRowsOf(aid); if (!rows.length) return null;
  const last = amgcLastShugyo(aid, now);
  let today = null;
  if (last && last.today) {
    const g = last.log.g || {}; const mainId = Object.keys(g).sort((a, b) => g[b] - g[a])[0];
    today = { nick: last.row.nick || '', monster: last.row.monster, kind: (AMGT_KINDS[last.log.k] || {}).name || '', act: (AMGT_KINDS[last.log.k] || {}).act || '',
      learned: last.log.l ? amgcTechName(last.row.monster, last.log.l) : '', main: mainId ? amgcTechName(last.row.monster, mainId) : '', gain: mainId ? g[mainId] : 0, fail: !!last.log.f };
  }
  const st = AMGC_STORE.state.day[aid]; const d = amgcToday(now);
  const used = st && st.d === d ? st.n : 0; const life = amgcLife();
  const thisMove = !!(st && st.d === d && life && Number.isInteger(life.abs) && st.s.includes(life.abs));
  const left = Math.max(0, AMGC_NUM.perDay - used);
  const why = !AMGC_STORE.loaded ? '読み込み中です' : !amgcAtBattle(aid, life) ? 'モンヒロバトルにいるときにできます' : left <= 0 ? '今日はもう応援しました(朝4時に戻ります)' : thisMove ? '次の時間帯にまた応援できます' : null;
  return { today, last: last ? { nick: last.row.nick || '', today: last.today } : null, left, perDay: AMGC_NUM.perDay, canCheer: !why, why, spar: amgcSparOf(aid, now) };
};

// ---------- 📣 応援する(👀 で見たときも同じ得・合わせて1日3回・移動1回に1回) ----------
// 返り: { ok:true, nick, tech, from, to, bond } か { ok:false, why }
const assistantMasmonCheer = (aid, via = 'cheer', now = Date.now()) => {
  const info = assistantMasmonTrainRowInfo(aid, now);
  if (!info) return { ok: false, why: 'off' };
  if (!info.canCheer) return { ok: false, why: info.why };
  if (!AMGT_STORE.loaded) return { ok: false, why: '読み込み中です' };
  const life = amgcLife(); if (!life || !Number.isInteger(life.abs)) return { ok: false, why: '読み込み中です' };
  const rows = amgcRowsOf(aid);
  const last = amgcLastShugyo(aid, now);
  const row = (last && last.today ? last.row : null) || rows.slice().sort((a, b) => a.slot - b.slot)[0];
  const e = typeof amgEntryOf === 'function' ? amgEntryOf(aid, row) : null;
  const { next, me } = amgtEnsure(AMGT_STORE.state, aid, row, e);
  const tid = me.learn.slice().sort((a, b) => (me.m[a] || 0) - (me.m[b] || 0) || a.localeCompare(b))[0];
  let from = 0, to = 0;
  if (tid) { from = me.m[tid] || 0; to = Math.min(100, from + AMGC_NUM.mastery); me.m[tid] = to; }
  if (amgtSave(next) === false) return { ok: false, why: '読み込み中です' }; // 保存待ちのあいだは undefined が返る(書けている)
  const d = amgcToday(now); const st0 = AMGC_STORE.state.day[aid];
  const st = st0 && st0.d === d ? st0 : { d, n: 0, s: [] };
  amgcSave({ ...AMGC_STORE.state, day: { ...AMGC_STORE.state.day, [aid]: { d, n: st.n + 1, s: [...st.s, life.abs].slice(-12) } } });
  try { if (typeof assistantLifeAddBondWithFx === 'function') assistantLifeAddBondWithFx(aid, 'lifeCheer', AMGC_NUM.bond); } catch (_) {}
  return { ok: true, via, nick: row.nick || '', tech: tid ? amgcTechName(row.monster, tid) : '', from, to, bond: AMGC_NUM.bond, left: Math.max(0, AMGC_NUM.perDay - st.n - 1) };
};

// ---------- 👀 修行を見る(練習試合を短く。保存しない・得は応援と同じで1回) ----------
const AMGC_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach(f => { try { f(v); } catch (_) {} }); } };
const assistantMasmonTrainWatchOpen = (aid) => { if (!amgcOn() || !amgcOkAid(aid) || !amgcPartnerOk(aid) || !amgcRowsOf(aid).length) return false; AMGC_HOST.set({ assistantId: aid, at: Date.now() }); return true; };
// 地図の中に1つだけ置く入れ物(ナカヨシ19)
function AssistantMasmonTrainWatchHost() {
  const [open, setOpen] = useState(AMGC_HOST.open);
  // 入れ物が消えるとき(画面を閉じた・タブを替えた)は「開いている」も消す。残ると、次に地図を開いたとき練習試合が勝手に始まっていた
  //   (2026-11-12 社長「助手のオート対戦が気付いたらはじまってた」)
  useEffect(() => { const f = (v) => setOpen(v); AMGC_HOST.subs.add(f); return () => { AMGC_HOST.subs.delete(f); if (!AMGC_HOST.subs.size) AMGC_HOST.open = null; }; }, []);
  if (!open) return null;
  return <AssistantMasmonTrainWatch key={open.at} assistantId={open.assistantId} onClose={() => AMGC_HOST.set(null)}/>;
}
// 相手のチーム。friend … masmonPvpFriends の登録編成(印 assistantMasmonBattlePvp が偽なら空)
const amgcFoeOf = async (engine, aid, mineKey) => {
  try {
    if (typeof masmonPvpFriends === 'function' && typeof masmonPvpEntriesOf === 'function') {
      const r = await masmonPvpFriends();
      const f = r && r.ok ? r.friends.find(x => x.registered) : null;
      if (f) {
        amgcNoteFriend(true);
        const rows = await masmonPvpEntriesOf([f.friendId]); const t = rows && rows[0] && rows[0].team;
        const m = t && Array.isArray(t.members) ? t.members[0] : null;
        if (m) return { kind: 'friend', label: `${f.name || 'フレンド'}の${m.name || ''}`, team: { assistantId: rows[0].assistant_id, tactics: Number.isFinite(t.tactics) ? t.tactics : 40, members: [m] } };
      }
    }
  } catch (_) {}
  const others = ambbUnitsOf(engine, aid, amgcRowsOf(aid).filter(r => amgtKeyOf(r) !== mineKey)).sort((a, b) => b.total - a.total);
  if (others[0]) return { kind: 'own', label: others[0].row.nick || '', team: { assistantId: aid, tactics: ambbTacticsOf(aid, [others[0].row]), members: [others[0].unit] } };
  return { kind: 'solo', label: '', team: null };
};
function AssistantMasmonTrainWatch({ assistantId, onClose }) {
  const aid = assistantId;
  const who = (typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === aid)) || null;
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [battle, setBattle] = useState(null); // { r, frames, maxHp, moves, teamA, teamB, foe } / { solo:true, techs }
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('hl');
  const [done, setDone] = useState(false);
  const [gift, setGift] = useState(null);
  const [failed, setFailed] = useState(false);
  const last = amgcLastShugyo(aid);
  const row = last ? last.row : amgcRowsOf(aid).slice().sort((a, b) => a.slot - b.slot)[0];
  useEffect(() => {
    let alive = true;
    if (!engine && typeof ambwLoadEngine === 'function') ambwLoadEngine().then((e) => { if (!alive) return; if (e) setEngine(e); else setFailed(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!engine || !row || battle) return undefined;
    let alive = true;
    (async () => {
      try { if (typeof amgTick === 'function') await amgTick(aid); } catch (_) {} // 育成のまだの回を先に決める(ミセカタ2の注意)
      let catalog = null; try { catalog = engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() }); } catch (_) {}
      const mine = ambbUnitsOf(engine, aid, [row])[0];
      if (!catalog || !mine) { if (alive) setFailed(true); return; }
      const foe = await amgcFoeOf(engine, aid, amgtKeyOf(row));
      if (!alive) return;
      const teamA = { assistantId: aid, tactics: ambbTacticsOf(aid, [row]), members: [mine.unit] };
      if (!foe.team) { const T = amgtTechsOf(row.monster); const own = (mine.unit.techs || []).map(x => (typeof x === 'string' ? T.find(t => t.id === x) : x)).filter(Boolean); setBattle({ solo: true, teamA, techs: (own.length ? own : T.filter(t => t.learn && t.learn.start)).slice(0, 4) }); return; }
      const seed = `amgc-${aid}-${last ? last.log.s : 0}`; // 同じ修行なら何度見ても同じ試合
      let r; try { r = engine.simulate({ seed, catalog, teamA, teamB: foe.team, balance: 'A', trace: true }); } catch (_) { setFailed(true); return; }
      const st = r.log[0] || {};
      setBattle({ r, frames: ambwFramesOf(r.log), maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] }, teamA, teamB: foe.team, foe });
    })();
    return () => { alive = false; };
  }, [engine]);
  // 再生(βと同じ進め方。短く見せるので ★見せ場だけ から始める)
  const len = battle ? (battle.solo ? battle.techs.length + 1 : battle.r.log.length) : 0;
  useEffect(() => {
    if (!battle || done) return undefined;
    if (pos >= len - 1) { const t = setTimeout(() => setDone(true), 800); return () => clearTimeout(t); }
    const sp = AMBW_SPEEDS.find(s => s.id === speed) || AMBW_SPEEDS[0];
    const t = setTimeout(() => {
      let n = pos + 1;
      if (!battle.solo && speed === 'hl') while (n < len - 1 && !ambwIsHighlight(battle.r.log[n], battle.maxHp)) n++;
      setPos(n);
    }, sp.ms);
    return () => clearTimeout(t);
  }, [battle, pos, speed, done]);
  const info = assistantMasmonTrainRowInfo(aid);
  // 見終えたら応援と同じ得(社長「応援と同じで」)。できない時間帯なら何もしない
  useEffect(() => { if (done && !gift) setGift(assistantMasmonCheer(aid, 'watch')); }, [done]);
  const g = last ? last.log.g || {} : {};
  const gains = Object.entries(g).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const me = last ? last.me : null;
  const ring = () => {
    if (failed) return <p className="ambw-small" style={{ padding: 24, textAlign: 'center' }}>練習試合を読み込めませんでした。もう一度開いてください</p>;
    if (!battle) return <p className="ambw-small" style={{ padding: 24, textAlign: 'center' }} data-amgc-loading>練習の相手をさがしています…</p>;
    if (battle.solo) {
      const tch = battle.techs[Math.min(pos, battle.techs.length - 1)] || {};
      return (
        <div className="ambw-ring" data-amgc-solo>
          <div className="ambw-stage"><div key={`a-${pos}`} className="ambw-f ambw-lungeA"><img className="ambw-flip" src={ALL_PLAYER_MONSTERS[row.monster].imgUrl} alt=""/><em>{row.nick}</em></div><div className="ambw-gap" style={{ width: 44 }}/>
            <div className="ambw-f" data-amgc-shadow><img src={ALL_PLAYER_MONSTERS[row.monster].imgUrl} alt="" style={{ filter: 'brightness(.15) drop-shadow(0 0 6px #a78bfa)' }}/><em>かげ</em></div></div>
          {tch.name && <div key={`s-${pos}`} className={`ambw-cut ${tch.kind || 'pow'}`}><small>ひとりで型の稽古</small><b>{tch.name}</b></div>}
        </div>);
    }
    const e = battle.r.log[pos] || {}; const f = battle.frames[pos]; const foeSide = e.side === 'A' ? 'B' : 'A';
    const fighter = (side) => {
      const team = side === 'A' ? battle.teamA : battle.teamB; const m = team.members[f.act[side]] || team.members[0];
      return (
        <div key={`${side}-${pos}`} className={`ambw-f ${f.hp[side][f.act[side]] <= 0 ? 'down' : ''} ${e.side === side && e.ev === 'tech' ? `ambw-lunge${side}` : ''} ${e.ev === 'tech' && foeSide === side && e.hit ? 'ambw-hit' : ''}`}>
          <img className={side === 'A' ? 'ambw-flip' : ''} src={(ALL_PLAYER_MONSTERS[m.species] || {}).imgUrl} alt=""/><em>{m.name}</em>
          {e.ev === 'tech' && foeSide === side && (e.hit ? <div className="ambw-dmg">−{e.dmg}</div> : <div className="ambw-dmg miss">はずれ</div>)}
        </div>);
    };
    return (
      <>
        <AmbwPanel side="B" team={battle.teamB} frame={f} maxHp={battle.maxHp} moves={battle.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false}/>
        <div className="ambw-ring">
          <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: [6, 44, 92, 146][f.d] || 44 }}/>{fighter('B')}</div>
          <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
          {e.ev === 'tech' && <div key={`c-${pos}`} className={`ambw-cut ${e.kind} ${e.side === 'B' ? 'B' : ''}`}><small>{e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}</small><b>{e.name}</b></div>}
        </div>
        <AmbwPanel side="A" team={battle.teamA} frame={f} maxHp={battle.maxHp} moves={battle.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine/>
      </>);
  };
  return (
    <div className="ambw-root" style={{ position: 'fixed', inset: 0, zIndex: 9000, overflowY: 'auto', background: 'linear-gradient(180deg,#221a44,#141026 40%)', color: '#fff', padding: 'calc(10px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left))' }} data-amgc-watch>
      <style>{AMBW_CSS}</style>
      <div className="ambw-row" style={{ marginBottom: 8 }}>
        <button className="ambw-btn2" data-amgc-close onClick={onClose}>← 戻る</button>
        <b style={{ flex: 1, fontSize: 15, color: '#a5f3fc' }}>👀 {who ? who.name : ''}の修行</b>
        <span className="ambw-small" data-amgc-foe={battle ? (battle.solo ? 'solo' : battle.foe.kind) : ''}>{battle ? (battle.solo ? 'ひとりで稽古' : battle.foe.kind === 'friend' ? `練習試合 vs ${battle.foe.label}` : `練習試合 vs ${battle.foe.label}`) : '練習試合'}</span>
      </div>
      {ring()}
      <div className="ambw-ctl">
        {AMBW_SPEEDS.filter(s => s.id === 'hl' || s.id === 'x2').map(s => <button key={s.id} className={speed === s.id ? 'ambw-btn' : 'ambw-btn2'} onClick={() => setSpeed(s.id)}>{s.label}</button>)}
        <button className="ambw-btn2" data-amgc-skip onClick={() => { setPos(Math.max(0, len - 1)); setDone(true); }}>⏭ 結果へ</button>
      </div>
      {battle && !battle.solo && battle.foe && battle.foe.kind === 'friend' && <p className="ambw-small" style={{ textAlign: 'center' }}>フレンドが練習相手です(編成を見つけてから7日間は、この相手として数えます)</p>}
      {battle && battle.solo && <p className="ambw-small" style={{ textAlign: 'center' }}>いまはひとりで稽古中なので、修行の伸びが半分になります。👀で見るか、マスモンをもう1体迎えると相手ができます(フレンドが相手になるのは、編成を見つけてから7日間です)</p>}
      <div className="ambw-card" data-amgc-result>
        <b style={{ color: '#fde68a' }}>🥋 {last ? (last.today ? 'きょうの修行' : '前回の修行') : 'まだ修行していません'}{last ? ` ${row.nick}(${(AMGT_KINDS[last.log.k] || {}).name || ''})` : ''}</b>
        {last && last.log.l && <p data-amgc-learned style={{ margin: '4px 0 0', fontWeight: 800 }}><span style={{ background: '#fbbf24', color: '#111', borderRadius: 6, padding: '0 4px', fontSize: 10 }}>NEW</span> {amgcTechName(row.monster, last.log.l)} を覚えた</p>}
        {gains.map(([k, n]) => { const to = me ? me.m[k] || 0 : 0; return <p key={k} data-amgc-gain={k} style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 800 }}>{amgcTechName(row.monster, k)} {Math.max(0, to - n)}→{to}(+{n}・{amgtRankOf(to)})</p>; })}
        {gift && gift.ok && <p data-amgc-gift style={{ margin: '6px 0 0', color: '#fdba74', fontWeight: 900 }}>{who ? who.name : ''}「見に来てくれてうれしいです！」 🥋 {gift.nick} {gift.tech} 熟練 +{gift.to - gift.from} ・ 💗 +{gift.bond}</p>}
        {done && gift && !gift.ok && info && info.why && <p className="ambw-small" style={{ marginTop: 6 }} data-amgc-nogift>{info.why}</p>}
      </div>
    </div>
  );
}
