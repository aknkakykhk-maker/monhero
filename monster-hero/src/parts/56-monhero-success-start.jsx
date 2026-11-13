// ===== モンヒロサクセス: 始めるまでの6段(育てるモンスター → 編成 → 助手(シナリオ) → 持ちこみ → 名前と染色 → 確認) =====
// 見本: docs/progress/player-raise/mock/png/v3-S.png(S1〜S6)。計算は芯の memberOf / newRun を呼ぶだけ
const MSX_STEP_NAMES = Object.freeze(['育てるモンスター', '編成', '助手', '持ちこみ', '名前と染色', '確認']);
// 持ちこみ12種(ITEMS-REF.md・名前と効き目は参考のまま・博士はイッサ博士)。before = はじめる前に効く / both = 育成中にも使える
const MSX_ITEMS = Object.freeze([
  { id: 'guide', name: '博士の導き書', desc: 'イッサ博士の大事な書類。1度、イッサ博士が現れる', when: 'before', e: '📘' },
  { id: 'loupe', name: '博士のルーペ', desc: 'イッサ博士のお気に入り。イッサ博士の実験が成功する', when: 'both', e: '🔍' },
  { id: 'band', name: '出会いのミサンガ', desc: '交流を増やすミサンガ。ようす「イベントメーカー」が付く', when: 'before', e: '🧶' },
  { id: 'mag', name: '週刊!トレーニング', desc: 'ハウツー雑誌。ようす「トレーニング得意」が付く', when: 'before', e: '📰' },
  { id: 'hachi', name: '修行のハチマキ', desc: '気合いが入るハチマキ。ようす「修行得意」が付く', when: 'before', e: '🎗️' },
  { id: 'omamori', name: '縁結びのお守り', desc: '良縁に恵まれるお守り。ようす「スターの素質○」が付く', when: 'before', e: '🧧' },
  { id: 'dango', name: 'モモのキビダンゴ', desc: '食べるとスタミナがつく。体力の最大値が はじめから上がる', when: 'before', e: '🍡' },
  { id: 'grass', name: 'うけつぎ草', desc: '伝授でいい結果が出る草。ようす「うけつぐ魂」が付く', when: 'before', e: '🌿' },
  { id: 'juice', name: 'ガロエ印の野菜ジュース', desc: '体力を完全に回復する', when: 'both', e: '🥤' },
  { id: 'powder', name: '悪様散', desc: '悪いようすを治して、体力を回復する', when: 'both', e: '💊' },
  { id: 'license', name: 'ブリーダーライセンス', desc: '忠誠度が一定数 上がる', when: 'both', e: '🪪' },
  { id: 'pack', name: 'オイリーパック', desc: 'オイル2個と薬草の詰め合わせ', when: 'both', e: '🧴' },
]);
const MSX_ITEM_BY_ID = Object.freeze(Object.fromEntries(MSX_ITEMS.map((t) => [t.id, t])));
const MSX_NAME_MAX = 8;
// 名前の見張り(助手のあだ名と同じ言葉の決まりを使う)。通らなければ null
const msxNameGuard = (raw) => {
  const t = String(raw == null ? '' : raw).normalize('NFKC').trim();
  if (!t || /\s|[<>{}\[\]\\`"]/.test(t) || t.length > MSX_NAME_MAX) return null;
  if (typeof ASSISTANT_CALLNAME_BANNED_RE !== 'undefined' && ASSISTANT_CALLNAME_BANNED_RE.test(t)) return null;
  if (typeof ASSISTANT_CALLNAME_PERSONAL_RE !== 'undefined' && ASSISTANT_CALLNAME_PERSONAL_RE.test(t)) return null;
  return t;
};
const msxAptOf = (sp) => { const a = typeof AMG_APT !== 'undefined' && AMG_APT && typeof AMG_APT[sp] === 'string' && AMG_APT[sp].length === 6 ? AMG_APT[sp] : 'CCCCCC'; return a.split(''); };
// 編成の1体の元 → 芯の memberOf に渡す形
const msxTeamSrc = (slot, box) => {
  if (slot && slot.box) { const m = box.mons.find((x) => x.id === slot.box); if (m) return { kind: 'raised', species: m.species, name: m.nick || msxMonName(m.species), stats: m.st, loy: m.loy, pop: m.pop, lv: m.lv, masteries: m.masteries, assists: m.assists, boxId: m.id }; }
  const sp = slot && slot.base ? slot.base : 'Mocchi';
  return { kind: 'base', species: sp, name: msxMonName(sp) };
};

function MsxSteps({ n }) {
  return (
    <div className="v-steps">
      {MSX_STEP_NAMES.map((s, i) => (
        <React.Fragment key={s}>{i ? <u/> : null}<span className={i < n ? 'ok' : i === n ? 'on' : ''}>{i < n ? '✓' : i === n ? `${i + 1} ${s}` : i + 1}</span></React.Fragment>
      ))}
    </div>
  );
}
function MsxHd({ back, onBack, title = '🌱 モンヒロサクセス', sub, right }) {
  return (
    <div className="v-hd">
      <button type="button" className="bk" onClick={onBack}>← {back}</button>
      <span className="ti">{title}{sub ? <small>{sub}</small> : null}</span>
      {right != null && <span className="rt">{right}</span>}
    </div>
  );
}

function MsxStart({ data, SUC, onCancel, onStart, bondLvOf, callNameOf }) {
  const { box, meta, unlocked } = data;
  const unraised = box.mons.filter((m) => !m.raised);
  const raised = box.mons.filter((m) => m.raised);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('base');
  const [pick, setPick] = useState(() => ({ base: unlocked[0] || 'Mocchi' }));
  const species = pick.box ? ((box.mons.find((m) => m.id === pick.box) || {}).species || 'Mocchi') : pick.base;
  // 編成: いつもの編成(meta.team)から、保存枠に残っている子だけ。空きはベースモン(育てるモンスターと同じ種 → 解放済みの種の順)
  const [teamBox, setTeamBox] = useState(() => (meta.team || []).filter((t) => t && t.box && raised.some((m) => m.id === t.box)).map((t) => t.box).slice(0, 5));
  // フレンドから借りた子(回5・オトズレの部品 monsucLendMember の写し)。6枠目に入る
  const [friend, setFriend] = useState(null);
  const [lendList, setLendList] = useState(null); // null | 'loading' | { ok, rows, reason }
  const team = useMemo(() => {
    const list = teamBox.map((id) => ({ box: id }));
    const bases = [species, ...unlocked.filter((id) => id !== species)];
    const room = friend ? 5 : 6;
    let bi = 0; while (list.length < room) { list.push({ base: bases[bi % bases.length] || species }); bi += 1; }
    if (friend) list.push({ friend });
    return list;
  }, [teamBox, species, unlocked, friend]);
  const members = useMemo(() => team.map((t) => { const src = t.friend ? t.friend : msxTeamSrc(t, box); const m = SUC.memberOf(src); return { ...m, name: src.name, boxId: src.boxId || null, friend: t.friend ? t.friend.friend : null }; }), [team, box, SUC]);
  const openLend = async () => {
    if (typeof monsucLendFriends !== 'function') return;
    setLendList('loading');
    try { const r = await monsucLendFriends(); setLendList(r && typeof r === 'object' ? r : { ok: false, reason: 'server', rows: [] }); } catch (e) { setLendList({ ok: false, reason: 'network', rows: [] }); }
  };
  const [aid, setAid] = useState('mua');
  const [items, setItems] = useState([]);
  const [nick, setNick] = useState('');
  const [colors, setColors] = useState([]);
  const [nameErr, setNameErr] = useState('');
  const aidLv = Math.max(1, Math.min(10, Number(bondLvOf && bondLvOf(aid)) || 1));
  const sc = MSX_SCENARIOS.find((x) => x.aid === aid) || MSX_SCENARIOS[0];

  const next = () => setStep((n) => Math.min(5, n + 1));
  const back = () => (step === 0 ? onCancel() : setStep((n) => n - 1));
  const start = () => {
    const name = msxNameGuard(nick || msxMonName(species).slice(0, MSX_NAME_MAX));
    if (!name) { setStep(4); setNameErr('その名前は使えません。ほかの名前にしてね'); return; }
    onStart({ species, from: pick.box ? { box: pick.box } : { base: species }, team: team.map((t) => (t.friend ? t.friend : msxTeamSrc(t, box))), teamSlots: team.filter((t) => !t.friend), aid, aidBondLv: aidLv, items, nick: name, colors,
      friendId: friend && friend.friend ? friend.friend.id : null, baseFill: [species, ...unlocked.filter((id) => id !== species)][5 % Math.max(1, unlocked.length)] || species });
  };

  const apt = msxAptOf(species);
  const heat = MSX_STATS.map((k) => members.filter((m) => Array.isArray(m.top) && m.top.includes(k)).length);
  const scene = (style, inner) => (
    <div className="v-scene" style={{ flex: '1 1 0' }}>
      <img className="bg" src={msxSceneBg(1).bg} alt=""/><div className="sh"/>
      <div className="gr" style={{ bottom: `calc(${style.mb} - 5px)` }}/>
      {colors.some(Boolean) && typeof DyedMonsterImage === 'function'
        ? <span className="mon" style={{ bottom: style.mb, height: style.h }}><DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>
        : <img className="mon" src={msxMonImg(species)} alt="" style={{ bottom: style.mb, height: style.h }}/>}
      {inner}
    </div>
  );

  let body = null; let go = null;
  if (step === 0) {
    const list = tab === 'base' ? unlocked.map((id) => ({ key: id, sp: id, on: !pick.box && pick.base === id, pick: { base: id } }))
      : unraised.map((m) => ({ key: m.id, sp: m.species, on: pick.box === m.id, pick: { box: m.id } }));
    const picked = meta.picked && meta.picked[species];
    body = (<>
      <div className="v-h">だれを育てる?<small>ベースモンか、合体で生まれた未育成のモンスターから1体</small></div>
      <div className="v-tabs">
        <button type="button" className={tab === 'base' ? 'on' : ''} onClick={() => setTab('base')}>🌱 ベースモン {unlocked.length}</button>
        <button type="button" className={tab === 'fuse' ? 'on' : ''} onClick={() => setTab('fuse')}>🧬 合体で生まれたモンスター {unraised.length}</button>
      </div>
      <div className="v-grid6" style={{ maxHeight: 148, overflowY: 'auto' }}>
        {list.length ? list.map((x) => <button type="button" key={x.key} className={x.on ? 'on' : ''} onClick={() => setPick(x.pick)}><img src={msxMonThumb(x.sp)} alt={msxMonName(x.sp)}/></button>)
          : <span className="msx-note" style={{ gridColumn: '1 / -1' }}>まだいません(合体はこれから作ります)</span>}
      </div>
      {scene({ mb: '12%', h: '62%' }, <div className="v-chips"><span className="v-chip ylw">{msxMonName(species)}</span>{picked ? <span className="v-chip">えらんだ回数 {picked}回</span> : null}</div>)}
      <div className="v-card sel">
        <div className="h1">{msxMonName(species)}</div>
        <div className="v-kv"><b>成長の型</b><span>はじめるとくじで決まる <span className="yel">(早熟〜晩成)</span></span></div>
        <div className="sub" style={{ marginTop: 6, color: '#f9a8d4', fontWeight: 900 }}>伸びやすさ(素質)</div>
        <div className="v-apt">{MSX_STATS.map((k, i) => <div key={k} className={apt[i] > 'B' ? 'lo' : ''}>{MSX_STAT_NAME[k]}<b>{apt[i]}</b></div>)}</div>
      </div>
    </>);
    go = 'このモンスターにする ▶';
  } else if (step === 1) {
    const toggleBox = (id) => setTeamBox((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 5 ? cur : [...cur, id]));
    body = (<>
      <div className="v-h">編成の6体<small>保存枠から5体まで+フレンドから1体。強いモンスターほど訓練がよく伸びる</small></div>
      <div className="v-slots">
        {members.map((m, i) => (
          <div key={i} className={`v-sl${m.kind === 'base' ? ' base' : ''}${m.friend ? ' fr' : ''}`}>
            <span className={`v-pf lg r${m.rank === 'base' ? 'G' : m.rank}${m.kind === 'base' ? ' base' : ''}`}>{(() => { const img = <img src={msxMonThumb(m.species)} alt=""/>; const bm = m.boxId && box && Array.isArray(box.mons) ? box.mons.find((x) => x.id === m.boxId) : null; return bm && bm.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(bm.awake)} small>{img}</MsxKira> : img; })()}</span>
            {m.name} {m.kind !== 'base' && <i className={msxRankCls(m.rank)}>{m.rank}</i>}
            <div className="t3">{m.top.slice(0, 2).map((k) => `${MSX_STAT_NAME[k]}${Math.round(m.bonus[k] || 0)}%`).join(' ')}</div>
            <div className="bs">親密度{m.bond0}・タッグ+{m.tag}%</div>
            <div className="ic">{m.kind === 'base' ? 'ベースモン' : m.friend ? `借: ${m.friend.name || 'フレンド'}` : ''}</div>
          </div>
        ))}
      </div>
      <div className="v-card"><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>この編成が集まりやすい訓練</div>
        <div className="v-heat">{MSX_STATS.map((k, i) => <div key={k} className={heat[i] >= 3 ? 'x3' : heat[i] === 2 ? 'x2' : ''}>{MSX_STAT_NAME[k]}<b>{heat[i]}体</b></div>)}</div></div>
      <div className="v-card" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
        <div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>保存枠から選ぶ({teamBox.length}/5)</div>
        {raised.length ? raised.map((m) => (
          <button type="button" key={m.id} className={`v-item${teamBox.includes(m.id) ? ' sel' : ''}`} style={{ padding: '4px 8px', width: '100%' }} onClick={() => toggleBox(m.id)}>
            {m.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(m.awake)} small><img src={msxMonThumb(m.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/></MsxKira>
              : <img src={msxMonThumb(m.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/>}
            <div>{m.nick || msxMonName(m.species)} {m.rank ? <i className={msxRankCls(m.rank)}>{m.rank}</i> : null}<small>{msxMonName(m.species)}{m.awake ? (m.awake >= 2 ? '・超覚醒' : '・覚醒') : ''}</small></div>
            <span className="pr">{teamBox.includes(m.id) ? '✅ 入れている' : '入れる'}</span>
          </button>
        )) : <div className="msx-note" style={{ marginTop: 4 }}>保存枠はまだ空です。育て終えたモンスターがここに入ります(いまは空いた枠をベースモンで埋めます)</div>}
        <div className="sub" style={{ color: '#7dd3fc', fontWeight: 900, marginTop: 8 }}>🤝 フレンドから借りる(1体){typeof monsucLendFriends !== 'function' ? <span className="msx-soon">準備中</span> : null}</div>
        {typeof monsucLendFriends === 'function' ? (<>
          {friend ? <button type="button" className="v-item sel" style={{ padding: '4px 8px', width: '100%' }} onClick={() => setFriend(null)}>
            <img src={msxMonThumb(friend.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/>
            <div>{(friend.friend && friend.friend.name) || 'フレンド'} の {friend.name}<small>{msxMonName(friend.species)}</small></div><span className="pr">✅ 借りている(外す)</span></button> : null}
          {lendList === null ? <button type="button" className="msx-btn sub" onClick={openLend}>貸してくれるモンスターを見る</button>
            : lendList === 'loading' ? <div className="msx-note">さがしています…</div>
            : !lendList.ok ? <div className="msx-note">{typeof monsucLendReasonText === 'function' ? monsucLendReasonText(lendList.reason) : '今は借りられません'}</div>
            : !lendList.rows.length ? <div className="msx-note">貸し出しているフレンドはいません</div>
            : lendList.rows.map((row) => { const m = monsucLendMember(row, SUC); if (!m) return null; const on = friend && friend.friend && friend.friend.id === row.friendId; return (
              <button type="button" key={row.friendId} className={`v-item${on ? ' sel' : ''}`} style={{ padding: '4px 8px', width: '100%' }} onClick={() => setFriend(on ? null : m)}>
                <img src={msxMonThumb(m.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/>
                <div>{row.name} の {m.name}<small>{msxMonName(m.species)}</small></div><span className="pr">{on ? '✅ 借りている' : '借りる'}</span></button>); })}
        </>) : null}
      </div>
    </>);
    go = 'この編成でいく ▶';
  } else if (step === 2) {
    const combo = SUC.TRAIN_COMBO && SUC.TRAIN_COMBO[aid];
    body = (<>
      <div className="v-h">だれの物語で育てる?<small>助手ごとに、筋書き・出来事・訓練の組み合わせが変わる</small></div>
      <div className="v-faces">
        {MSX_SCENARIOS.map((x) => <button type="button" key={x.aid} className={aid === x.aid ? 'on' : ''} onClick={() => setAid(x.aid)}><img src={msxFace(x.aid)} alt={msxAidName(x.aid)}/></button>)}
        {MSX_SOON_AIDS.map((a) => <span key={a} className="lk"><img src={msxFace(a)} alt=""/></span>)}
      </div>
      <div className="v-card sel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div className="v-sc"><div className="pic"><img src={msxBody(aid, 'happy')} alt=""/></div><div className="tx">
          <h4><small>シナリオ {sc.no}・{msxAidName(aid)}編</small>{sc.title}</h4>
          <div style={{ marginTop: 4 }}>{sc.lead}</div>
          <div style={{ marginTop: 5 }}><span className="chip on">{sc.tag}</span> <span className="chip p">仲良し度 Lv{aidLv}</span></div></div></div>
        <div className="v-kv"><b>助手の効き</b><span>{sc.perk}</span></div>
        {combo && <div className="v-kv"><b>訓練の組み合わせ</b><span>{MSX_STATS.slice(0, 3).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]} → +${combo[k].map((c) => MSX_STAT_ICON[c]).join('+')}`).join(' / ')} …</span></div>}
        <div className="v-kv"><b>はじめの親密度</b><span>{Math.min(100, aidLv * ((SUC.BOND && SUC.BOND.aidPerLv) || 8))}(仲良し度 Lv{aidLv})。助手も訓練に来て、タッグになる</span></div>
        <div className="v-eps">{sc.eps.map((t, i) => <div key={i}><b>{i + 1}話</b>{t}</div>)}<div className="lk"><b>4話</b>🔒 ？？？</div></div>
        <div className="row" style={{ marginTop: 'auto' }}><img className="fc" src={msxFace(aid, 'wink')} alt=""/><div className="bub f1">「{aid === 'atsu' ? 'よし、いっちょ仕上げてくか。よろしくな笑' : 'いっしょに てっぺん めざそ! まぢで楽しいから!'}」</div></div>
      </div>
    </>);
    go = `${msxAidName(aid)}編ではじめる ▶`;
  } else if (step === 3) {
    const has = (id) => (meta.items && meta.items[id]) || 0;
    const toggle = (id) => setItems((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 || has(id) <= 0 ? cur : [...cur, id]));
    const coreItems = (id) => !!(SUC.ITEMS && SUC.ITEMS[id]);
    body = (<>
      <div className="v-h">持ちこみ(2つまで)<small>名声で手に入れた物を、育成に持っていける。持っていかなくてもよい</small></div>
      <div className="v-bag">{[0, 1].map((i) => items[i] ? <div key={i} className="in"><span style={{ fontSize: 24 }}>{MSX_ITEM_BY_ID[items[i]].e}</span><small>{MSX_ITEM_BY_ID[items[i]].name}</small></div> : <div key={i}>＋<small style={{ color: '#94a3b8' }}>空き</small></div>)}</div>
      <div className="v-igrid">
        {MSX_ITEMS.map((t) => (
          <button type="button" key={t.id} className={`${items.includes(t.id) ? 'in' : ''}${t.when === 'both' ? ' bo' : ''}`} onClick={() => toggle(t.id)} disabled={!has(t.id) && !items.includes(t.id)}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.e}</span><i>×{has(t.id)}</i><small>{t.name.replace('ガロエ印の', '')}</small>{items.includes(t.id) ? <u>✔</u> : null}
          </button>
        ))}
      </div>
      <div className="v-ileg"><span><b className="sw1"/>はじめる前に効く物</span><span><b className="sw2"/>育成中にも使える物(1ターン1個まで)</span></div>
      <div className="msx-scroll">
        {items.map((id) => <div key={id} className="v-item sel"><span style={{ fontSize: 22 }}>{MSX_ITEM_BY_ID[id].e}</span><div>{MSX_ITEM_BY_ID[id].name}<small>{MSX_ITEM_BY_ID[id].desc}</small></div><span className="pr">✅ 持っていく・あと{has(id) - 1}</span></div>)}
        {items.some((id) => !coreItems(id)) && <div className="msx-note" style={{ marginTop: 6 }}>まだ効き目が入っていない物があります(その物は持っていっても数は減りません)</div>}
      </div>
    </>);
    go = 'これでいく ▶';
  } else if (step === 4) {
    const onDye = (idx, colorId) => setColors((cur) => { const n = cur.slice(); while (n.length <= idx) n.push(null); n[idx] = colorId; return n; });
    const onCustom = (idx) => { const p = typeof _parseCustomColorId === 'function' ? _parseCustomColorId(colors[idx]) : null; const h = p ? (p.h + 40) % 360 : 200; if (typeof _encodeCustomColorId === 'function') onDye(idx, _encodeCustomColorId(h, 0.7, 0.85)); };
    body = (<>
      <div className="v-h">名前と染色<small>あとからいつでも変えられる</small></div>
      {scene({ mb: '14%', h: '72%' }, <div className="v-chips"><span className="v-chip">成長の型: はじめるとくじで決まる</span></div>)}
      <label className="v-inp" style={{ display: 'flex' }}>
        <input type="text" value={nick} maxLength={MSX_NAME_MAX} placeholder={msxMonName(species).slice(0, MSX_NAME_MAX)} onChange={(e) => { setNick(e.target.value.slice(0, MSX_NAME_MAX)); setNameErr(''); }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#1e1b4b', font: 'inherit', fontSize: 16 }}/>
        <small>{(nick || '').length} / {MSX_NAME_MAX}文字</small>
      </label>
      {nameErr && <div className="msx-note" style={{ color: '#fca5a5' }}>{nameErr}</div>}
      <div className="v-card" style={{ maxHeight: '34%', overflowY: 'auto' }}>
        {typeof DyeRegionColorControls === 'function' ? <DyeRegionColorControls baseId={species} colors={colors} onChange={onDye} onCustom={onCustom} big names={typeof ASSISTANT_MASMON_DYE_PARTS !== 'undefined' && ASSISTANT_MASMON_DYE_PARTS[species] ? ASSISTANT_MASMON_DYE_PARTS[species].map((x) => x[0]) : null}/> : <div className="msx-note">染色はこの端末では使えません</div>}
      </div>
    </>);
    go = 'これで決める ▶';
  } else {
    const startAdd = {}; members.forEach((m) => { if (m.startAdd && m.startAdd.v > 0) startAdd[m.startAdd.stat] = (startAdd[m.startAdd.stat] || 0) + m.startAdd.v; });
    const name = nick || msxMonName(species).slice(0, MSX_NAME_MAX);
    body = (<>
      <div className="v-h">これで はじめる?<small>全46ターン・1回 約8〜15分。いつでも中断して続きから</small></div>
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg(1).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '36%', bottom: 'calc(16% - 5px)' }}/>
        {colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? <span className="mon" style={{ left: '36%', bottom: '16%', height: '62%' }}><DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>
          : <img className="mon" src={msxMonImg(species)} alt="" style={{ left: '36%', bottom: '16%', height: '62%' }}/>}
        <span className="v-nm" style={{ left: '36%', bottom: 6 }}>{name}<small>{msxMonName(species)}</small></span>
        <img src={msxBody(aid, 'happy')} alt="" style={{ position: 'absolute', right: '-4%', bottom: 0, width: '50%', height: '78%', objectFit: 'contain', objectPosition: 'right bottom' }}/>
      </div>
      <button type="button" className="v-sum" onClick={() => setStep(1)}><span className="k">編成</span>{members.map((m, i) => <span key={i} className={`v-pf sm r${m.rank === 'base' ? 'G' : m.rank}${m.kind === 'base' ? ' base' : ''}`}><img src={msxMonThumb(m.species)} alt=""/></span>)}<span className="ed">変える</span></button>
      <button type="button" className="v-sum" onClick={() => setStep(2)}><span className="k">助手</span><span>{msxAidName(aid)}編「{sc.title}」</span><span className="ed">変える</span></button>
      <button type="button" className="v-sum" onClick={() => setStep(3)}><span className="k">持ちこみ</span><span>{items.length ? items.map((id) => `${MSX_ITEM_BY_ID[id].e}${MSX_ITEM_BY_ID[id].name}`).join('・') : 'なし'}</span><span className="ed">変える</span></button>
      <div className="v-sum"><span className="k">はじめの上乗せ</span><span>{Object.keys(startAdd).length ? `編成から ${Object.entries(startAdd).map(([k, v]) => `${MSX_STAT_NAME[k]} +${v}`).join('・')}` : '編成からの上乗せなし'}</span></div>
      <button type="button" className="v-big" onClick={start}>🌱 育成をはじめる</button>
    </>);
  }
  return (
    <>
      <MsxHd back={step ? 'もどる' : 'やめる'} onBack={back} right={`${step + 1} / 6`}/>
      <div className="v-body">
        <MsxSteps n={step}/>
        {body}
      </div>
      {go && <div className="v-ft"><button type="button" onClick={back}>{step ? '← もどる' : '← やめる'}</button><button type="button" className="go" onClick={next}>{go}</button></div>}
    </>
  );
}
