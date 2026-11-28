// ---- 分岐の地図「聖夜の見取り図」(台帳 r1126-102・追記1) ----
//  事件簿の上の段の「地図」から開く。章・分かれ道(行動の選択・推理の問い・名指し)・エンドを、台本から機械で並べる。
//  読んだ所は明るく、まだの所は「？？？」で形だけ見せる(題は読むまで伏せる・r1126-094 追記3)。エンドは見た物だけ名前を出す。
//  通った分かれ道は「↺」から、その問いの直前の状態(手がかり帳・登場人物パネル・フラグ・派)で読み直せる。
//  状態は mh_xmas_novel_route_v1(79-xmas-novel-engine.jsx の xmasNovelRoute*)。この部品は読むだけで、保存は呼ぶ側がする
const XMAS_NOVEL_MAP_CSS = `
.mh-nvm { position: absolute; inset: 0; z-index: 12; display: flex; flex-direction: column; color: #eef3ff; font-family: inherit; animation: mh-nv-fade .2s ease both;
  background: radial-gradient(ellipse at 50% -10%, rgba(232,200,115,.18), transparent 55%),
    linear-gradient(rgba(120,150,220,.07) 1px, transparent 1px) 0 0/22px 22px,
    linear-gradient(90deg, rgba(120,150,220,.07) 1px, transparent 1px) 0 0/22px 22px,
    linear-gradient(#0b1430, #101b3d 60%, #0b1430); }
.mh-nvm-head { flex: none; padding: calc(max(10px, env(safe-area-inset-top)) + 2px) 16px 8px; background: linear-gradient(#0b1430 75%, rgba(11,20,48,0)); }
.mh-nvm-ttl { display: flex; align-items: center; gap: 8px; }
.mh-nvm-ttl h2 { font-size: 19px; font-weight: 900; color: #e8c873; letter-spacing: .06em; }
.mh-nvm-x { margin-left: auto; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #b8913a; color: #e8c873; display: grid; place-items: center; font-weight: 900; }
.mh-nvm-row { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.mh-nvm-tab { flex: 1; min-width: 0; text-align: center; padding: 6px 0; border-radius: 999px; font-size: 13px; font-weight: 900; border: 1px solid #b8913a; color: #e8c873; }
.mh-nvm-tab[data-on] { background: linear-gradient(#e8c873, #b8913a); color: #2a1a05; }
.mh-nvm-ends { flex: none; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: rgba(200,50,60,.25); border: 1px solid rgba(232,120,120,.6); white-space: nowrap; }
.mh-nvm-back { display: block; width: 100%; margin-top: 8px; padding: 7px 0; border-radius: 10px; font-size: 13px; font-weight: 900; color: #fff; background: rgba(200,50,60,.55); border: 1px solid #f0a0a0; }
.mh-nvm-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; font-size: 10px; color: #9fb0d8; }
.mh-nvm-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0 16px calc(max(16px, env(safe-area-inset-bottom)) + 12px); }
.mh-nvm-it { position: relative; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 0 4px 52px; }
.mh-nvm-it::before { content: ""; position: absolute; left: 30px; top: 0; bottom: 0; width: 4px; border-radius: 2px; background: linear-gradient(#e8c873, #b8913a); box-shadow: 0 0 8px rgba(232,200,115,.45); }
.mh-nvm-it[data-dark]::before { background: repeating-linear-gradient(#2b3658 0 8px, transparent 8px 14px); box-shadow: none; }
.mh-nvm-door { position: absolute; left: 0; width: 64px; height: 38px; border-radius: 19px 19px 4px 4px; background: linear-gradient(#6b4423, #3e2612); border: 2px solid #e8c873; display: grid; place-items: center; font-size: 11px; font-weight: 900; color: #e8c873; box-shadow: 0 0 12px rgba(232,200,115,.4); z-index: 1; }
.mh-nvm-it[data-dark] .mh-nvm-door { background: #1a2342; border-color: #3a4670; color: #5d6a90; box-shadow: none; }
.mh-nvm-chap { padding-left: 76px; min-height: 50px; margin-top: 6px; }
.mh-nvm-cname { font-size: 15px; font-weight: 900; line-height: 1.3; }
.mh-nvm-it[data-dark] .mh-nvm-cname { color: #5d6a90; }
.mh-nvm-mk { position: absolute; left: 18px; width: 28px; height: 28px; display: grid; place-items: center; font-size: 12px; font-weight: 900; z-index: 1; }
.mh-nvm-mk[data-k="action"] { transform: rotate(45deg) scale(.86); background: #7a1f28; border: 2px solid #f0a0a0; border-radius: 4px; }
.mh-nvm-mk[data-k="action"] > span { transform: rotate(-45deg); }
.mh-nvm-mk[data-k="present"] { border-radius: 50%; background: #173a2a; border: 2px solid #8fd6a8; }
.mh-nvm-mk[data-k="person"] { border-radius: 6px; background: #3a2a5a; border: 2px solid #c7b2ff; }
.mh-nvm-it[data-dark] .mh-nvm-mk { background: #1a2342; border-color: #3a4670; color: #5d6a90; }
.mh-nvm-it[data-now] .mh-nvm-mk { box-shadow: 0 0 0 3px #fff, 0 0 16px 4px rgba(255,90,90,.9); }
.mh-nvm-lab { min-width: 0; flex: 1; font-size: 12.5px; font-weight: 800; line-height: 1.35; }
.mh-nvm-lab small { display: block; font-size: 10.5px; font-weight: 600; color: #9fb0d8; }
.mh-nvm-it[data-dark] .mh-nvm-lab { color: #5d6a90; }
.mh-nvm-it[data-dark] .mh-nvm-lab small { color: #3f4b70; }
.mh-nvm-redo { flex: none; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #b8913a; color: #e8c873; background: rgba(232,200,115,.08); display: grid; place-items: center; font-size: 15px; font-weight: 900; }
.mh-nvm-now { flex: none; padding: 3px 8px; font-size: 10px; font-weight: 900; color: #fff; background: #c8323c; border-radius: 3px; box-shadow: 0 0 0 2px #fff, 0 0 14px rgba(255,80,80,.9); white-space: nowrap; }
.mh-nvm-ends-list { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; flex: none; max-width: 52%; }
.mh-nvm-orn { position: relative; min-width: 96px; max-width: 150px; padding: 5px 8px 5px 24px; border-radius: 13px; font-size: 10.5px; font-weight: 800; line-height: 1.3; background: linear-gradient(135deg, #8a1c26, #4a0f15); border: 1px solid #f0a0a0; color: #ffe9e9; }
.mh-nvm-orn::before { content: ""; position: absolute; left: 7px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffd2d2, #c8323c 60%, #6a1018); box-shadow: 0 0 6px rgba(255,120,120,.8); }
.mh-nvm-orn small { display: block; font-size: 9.5px; font-weight: 600; color: #f7c2c2; }
.mh-nvm-orn[data-good] { background: linear-gradient(135deg, #7a5a14, #3d2c08); border-color: #e8c873; }
.mh-nvm-orn[data-good]::before { background: radial-gradient(circle at 35% 30%, #fff3c0, #e8c873 60%, #7a5a14); }
.mh-nvm-orn[data-unseen] { background: #151d38; border-color: #3a4670; color: #5d6a90; }
.mh-nvm-orn[data-unseen]::before { background: #2a3456; box-shadow: none; }
.mh-nvm-orn[data-unseen] small { color: #3f4b70; }
.mh-nvm-lane { margin: 14px 0 0; padding: 4px 10px; border-left: 3px solid #b8913a; font-size: 11px; font-weight: 900; color: #e8c873; letter-spacing: .08em; }
.mh-nvm-lane[data-dark] { border-left-color: #3a4670; color: #5d6a90; }
.mh-nvm-foot { margin-top: 16px; padding: 10px 12px; border-radius: 12px; border: 1px solid #3a4670; font-size: 11px; color: #9fb0d8; line-height: 1.6; background: rgba(20,33,74,.6); }
.mh-nvm-sheet { position: absolute; inset: 0; z-index: 2; display: flex; align-items: flex-end; background: rgba(5,8,20,.55); }
.mh-nvm-panel { width: 100%; padding: 16px 16px calc(max(16px, env(safe-area-inset-bottom)) + 6px); border-radius: 18px 18px 0 0; background: linear-gradient(#18244d, #0d1634); border-top: 2px solid #e8c873; box-shadow: 0 -10px 30px rgba(0,0,0,.5); }
.mh-nvm-panel h3 { font-size: 15px; font-weight: 900; color: #e8c873; }
.mh-nvm-q { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: rgba(120,20,30,.35); box-shadow: 0 0 0 1px rgba(232,120,120,.6); font-size: 13px; font-weight: 800; line-height: 1.5; }
.mh-nvm-panel ul { margin-top: 10px; font-size: 12px; line-height: 1.7; color: #d9e2ff; }
.mh-nvm-btn { display: block; width: 100%; margin-top: 10px; padding: 12px 0; text-align: center; border-radius: 12px; font-weight: 900; font-size: 15px; }
.mh-nvm-btn[data-main] { background: linear-gradient(#e8c873, #b8913a); color: #2a1a05; }
.mh-nvm-btn[data-sub] { border: 1px solid #b8913a; color: #e8c873; }
@media (orientation: landscape) and (max-height: 500px) { .mh-nvm-body, .mh-nvm-head { padding-left: max(16px, env(safe-area-inset-left)); padding-right: max(16px, env(safe-area-inset-right)); } .mh-nvm-panel { max-width: 560px; margin: 0 auto; border-radius: 18px 18px 0 0; } }
`;
const XMAS_NOVEL_MAP_SIDES = [{ v: 1, label: 'あつ派' }, { v: 2, label: 'ソラシド派' }];
// 地図の並び: 本筋(序章〜第7章)→ 1回目の推理のあとの2つの道 → 過去編
const XMAS_NOVEL_MAP_LANES = [
  { id: 'main', chapters: ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'] },
  { id: 'late', name: '当てられなかった道', chapters: ['C10', 'C11'] },
  { id: 'true', name: '真相への道', chapters: ['C8', 'C9'] },
];
let xmasNovelMapModelCache = null;
// 台本から、章ごとの分かれ道とその先のエンドを並べる(台本が同じなら作り直さない)
const xmasNovelMapModel = (script) => {
  if (xmasNovelMapModelCache && xmasNovelMapModelCache.script === script) return xmasNovelMapModelCache.model;
  const scenes = xmasNovelScenes(script);
  const order = {}; scenes.forEach((s, i) => { order[s.id] = i; });
  const laneChapters = new Set(XMAS_NOVEL_MAP_LANES.flatMap((l) => l.chapters));
  const endInfo = {};
  scenes.forEach((s) => { if (s.ending && s.ending.id && !endInfo[s.ending.id]) endInfo[s.ending.id] = s.ending; });
  const endsOf = (q, chId) => {
    const tos = [];
    (q.options || []).forEach((o) => { if (o && o.to) tos.push(o.to); });
    Object.values(q.route || {}).forEach((t) => { if (typeof t === 'string') tos.push(t); });
    const out = [];
    tos.forEach((to) => {
      const sc = xmasNovelSceneById(script, to);
      if (!sc || (sc.chapter !== chId && laneChapters.has(sc.chapter))) return; // ほかの章へ続く道(真相・後半)は、地図の道で見せる。強制バッド・おまけ(章 END)は札で
      const e = xmasNovelEndingAhead(script, to);
      if (e && !out.includes(e)) out.push(e);
    });
    return out;
  };
  const chapters = {};
  xmasNovelChapters(script).forEach((ch) => {
    const scs = scenes.filter((s) => s.chapter === ch.id && !(s.ending && s.ending.id));
    const nodes = [];
    scs.forEach((s) => (s.rows || []).forEach((r, idx) => {
      if (r && r.t === 'q') nodes.push({ id: r.id, q: r, scene: s.id, idx, pos: order[s.id] * 10000 + idx, ends: endsOf(r, ch.id) });
    }));
    chapters[ch.id] = { ch, scenes: scs.map((s) => s.id), keys: new Set(scs.flatMap((s) => (s.rows || []).filter((r) => r && r.k).map((r) => r.k))), nodes };
  });
  const model = { chapters, order, endInfo, endTotal: Object.keys(endInfo).length };
  xmasNovelMapModelCache = { script, model };
  return model;
};
const xmasNovelMapNum = (label) => { const m = String(label || '').match(/[①-⑨]/); return m ? m[0] : ''; };

const XmasNovelMap = ({ script, save, route, playerName, onRedo, onBack, onClose }) => {
  const model = xmasNovelMapModel(script);
  const curSide = save && save.cur && save.cur.flags && Number.isFinite(save.cur.flags.f_A1) ? save.cur.flags.f_A1 : 0;
  const [side, setSide] = useState(curSide === 2 ? 2 : 1);
  const [pick, setPick] = useState(null);
  const read = useMemo(() => new Set((save && save.read) || []), [save]);
  const endings = (save && save.endings) || [];
  const at = (route && route.at) || {};
  const keyOf = (id) => `${id}|${id === 'A1' ? 0 : side}`;
  const nodeLit = (n) => !!at[keyOf(n.id)] || (!!n.q.k && read.has(n.q.k) && (n.id === 'A1' || curSide === side));
  const chEntered = (c) => [...c.keys].some((k) => read.has(k));
  const chLit = (c) => {
    if (!c || !chEntered(c)) return false;
    if (c.ch.id === 'C0' || c.ch.id === 'C1' || curSide === side) return true;
    return c.nodes.some(nodeLit) || Object.keys(at).some((k) => k.endsWith(`|${side}`) && c.scenes.includes(at[k].scene));
  };
  // 今いる所: 続きの場所のある章の、続きの位置より後で一番近い分かれ道(無ければ章の札)
  const now = (() => {
    const cur = save && save.cur;
    if (!cur || (curSide && curSide !== side)) return null;
    const sc = xmasNovelSceneById(script, cur.scene);
    if (!sc || !model.chapters[sc.chapter]) return null;
    const p = (model.order[sc.id] || 0) * 10000 + (Number(cur.idx) || 0);
    const n = model.chapters[sc.chapter].nodes.find((x) => x.pos >= p);
    return n ? { node: n.id } : { chapter: sc.chapter };
  })();
  const seenCount = Object.keys(model.endInfo).filter((e) => endings.includes(e)).length;
  const pickedSnap = pick ? at[keyOf(pick.id)] : null;
  const pickedCh = pick ? model.chapters[xmasNovelSceneById(script, pick.scene) ? xmasNovelSceneById(script, pick.scene).chapter : ''] : null;

  const endCard = (e) => {
    const info = model.endInfo[e] || {};
    const seen = endings.includes(e);
    const good = info.kind === 'good' || info.kind === 'normal' || info.kind === 'extra';
    return (
      <div key={e} className="mh-nvm-orn" data-xmas-novel-map-end={e} data-unseen={seen ? undefined : ''} data-good={seen && good ? '' : undefined}>
        {seen ? xmasNovelWrap(info.name || '') : '？？？'}<small>{seen ? (info.label || 'エンド') : '未見のエンド'}</small>
      </div>
    );
  };
  const chapterItem = (c) => {
    const lit = chLit(c);
    const label = xmasNovelChapterLabel(c.ch) || c.ch.label || '';
    const title = lit ? xmasNovelChapterTitle(script, c.ch, save.read) : '？？？';
    const isNow = now && now.chapter === c.ch.id;
    return (
      <div key={`ch-${c.ch.id}`} className="mh-nvm-it mh-nvm-chap" data-xmas-novel-map-chapter={c.ch.id} data-dark={lit ? undefined : ''}>
        <div className="mh-nvm-door">{lit ? label : (c.ch.past ? '🔒' : c.ch.no === 0 ? '序章' : '第？章')}</div>
        <div className="mh-nvm-cname">{xmasNovelWrap(title)}</div>
        {isNow && <span className="mh-nvm-now" data-xmas-novel-map-now>いまここ</span>}
      </div>
    );
  };
  const nodeItem = (n) => {
    const lit = nodeLit(n);
    const isNow = now && now.node === n.id;
    const canRedo = !!at[keyOf(n.id)];
    const q = n.q;
    const first = save && save.first && save.first[n.id];
    const sub = !lit ? 'まだ読んでいない' : isNow ? '考え中' : q.kind === 'present' && first ? (first.f ? '一発で正解' : '外して仲間が拾った') : n.id === 'A1' ? (side === 2 ? 'ソラシド派' : 'あつ派') : '';
    const kind = n.id === 'A1' ? 'person' : q.kind; // 派を選ぶ所は名指しの印
    const mark = kind === 'action' ? '◆' : kind === 'present' ? (xmasNovelMapNum(q.label) || '？') : '✦';
    return (
      <div key={`q-${n.id}`} className="mh-nvm-it" data-xmas-novel-map-node={n.id} data-dark={lit ? undefined : ''} data-now={isNow ? '' : undefined}>
        <div className="mh-nvm-mk" data-k={kind}><span>{lit ? mark : '？'}</span></div>
        <div className="mh-nvm-lab">{lit ? xmasNovelWrap(q.label || '分かれ道') : '？？？'}{sub ? <small>{sub}</small> : null}</div>
        {isNow && <span className="mh-nvm-now" data-xmas-novel-map-now>いまここ</span>}
        {canRedo && !isNow && <button type="button" className="mh-nvm-redo" data-xmas-novel-map-redo={n.id} aria-label="ここから読み直す" onClick={() => setPick(n)}>↺</button>}
        {n.ends.length > 0 && <div className="mh-nvm-ends-list">{n.ends.map(endCard)}</div>}
      </div>
    );
  };
  const laneLit = (lane) => lane.chapters.some((id) => model.chapters[id] && chLit(model.chapters[id]));
  const past = xmasNovelChapters(script).find((c) => c.past);
  const pastOpen = endings.includes('END-G');

  return (
    <div className="mh-nvm" data-xmas-novel-map onClick={(e) => e.stopPropagation()}>
      <style>{XMAS_NOVEL_MAP_CSS}</style>
      <div className="mh-nvm-head">
        <div className="mh-nvm-ttl"><h2 className="mh-nv-serif">聖夜の見取り図</h2><span className="text-[11px] text-slate-400">分岐の地図</span>
          <button type="button" className="mh-nvm-x" data-xmas-novel-map-close aria-label="閉じる" onClick={onClose}>✕</button></div>
        <div className="mh-nvm-row">
          {XMAS_NOVEL_MAP_SIDES.map((s) => <button type="button" key={s.v} className="mh-nvm-tab" data-xmas-novel-map-side={s.v} data-on={side === s.v ? '' : undefined} onClick={() => setSide(s.v)}>{s.label}</button>)}
          <div className="mh-nvm-ends" data-xmas-novel-map-count>エンド {seenCount}/{model.endTotal}</div>
        </div>
        {route && route.back && <button type="button" className="mh-nvm-back" data-xmas-novel-map-back onClick={onBack}>読み直す前の続きへ戻る</button>}
        <div className="mh-nvm-legend"><span>◆ 行動の選択</span><span>① 推理の問い</span><span>✦ 名指し</span><span>● エンド</span><span>↺ ここから読み直す</span></div>
      </div>
      <div className="mh-nvm-body">
        {XMAS_NOVEL_MAP_LANES.map((lane) => (
          <div key={lane.id} data-xmas-novel-map-lane={lane.id}>
            {lane.name && <div className="mh-nvm-lane" data-dark={laneLit(lane) ? undefined : ''}>{laneLit(lane) ? lane.name : '？？？へ続く道'}</div>}
            {lane.chapters.map((id) => model.chapters[id]).filter(Boolean).map((c) => [chapterItem(c), ...c.nodes.map(nodeItem)])}
          </div>
        ))}
        {past && (
          <div className="mh-nvm-it mh-nvm-chap" data-xmas-novel-map-chapter={past.id} data-dark={pastOpen ? undefined : ''}>
            <div className="mh-nvm-door">{pastOpen ? xmasNovelChapterLabel(past) : '🔒'}</div>
            <div className="mh-nvm-cname">{pastOpen ? past.title : '？？？'}</div>
          </div>
        )}
        <div className="mh-nvm-foot">明るい所は読んだ所。↺ を押すと、その分かれ道の直前から読み直せます(手がかり帳・登場人物パネル・選んだ派も、その時のまま)。一発で当てた記録と見たエンドは消えません。</div>
      </div>
      {pick && pickedSnap && (
        <div className="mh-nvm-sheet" onClick={() => setPick(null)}>
          <div className="mh-nvm-panel" data-xmas-novel-map-sheet={pick.id} onClick={(e) => e.stopPropagation()}>
            <h3 className="mh-nv-serif">{pickedCh ? `${xmasNovelChapterLabel(pickedCh.ch)}　${xmasNovelChapterTitle(script, pickedCh.ch, save.read)}` : ''} ― {pick.q.label || '分かれ道'}</h3>
            <div className="mh-nvm-q">{xmasNovelWrap(xmasNovelFill(pick.q.x, playerName))}</div>
            <ul>
              <li>・手がかり帳: {(pickedSnap.clues || []).length}個(その時のまま)</li>
              <li>・登場人物パネル・選んだ派も、その時のまま</li>
              <li>・一発で当てた記録・見たエンドは消えません</li>
            </ul>
            <button type="button" className="mh-nvm-btn" data-main="" data-xmas-novel-map-go onClick={() => { const c = pickedSnap; setPick(null); onRedo && onRedo(c); }}>ここから読み直す</button>
            <button type="button" className="mh-nvm-btn" data-sub="" onClick={() => setPick(null)}>やめる</button>
            <div className="mt-2 text-[10.5px] leading-relaxed text-slate-400">いまの続きは残ります。地図の「読み直す前の続きへ戻る」で、いつでも戻れます。</div>
          </div>
        </div>
      )}
    </div>
  );
};
