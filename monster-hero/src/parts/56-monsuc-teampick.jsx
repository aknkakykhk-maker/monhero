// ===== モンヒロサクセス: 始めるときの編成の選ぶ画面(r1115-096・2026-11-15 社長) =====
// 参考: docs/reference/line-mf/team-select-2026-11-15/(01 デッキ選択・02 アシスト編成・03 アシストカード詳細・04 フレンドアシスト編成)。絵・名前・文は写さない
//   編成の画面(MsxStart の2段目)は6枠を大きく並べるだけ。枠を押すとここの全画面へ飛ぶ
//   MsxTeamPick   … 上に編成中の6体、下に持っている子(マスモンボックス・メモリアルモンスター・ベースモン)の大きな一覧。並べ替え・絞り込み・印。長押しで詳細(MsxMonDetail)。決定で戻る
//   MsxFriendPick … フレンドの貸し出しの一覧。「アシスト重複」「編成不可」の印(いまの決まりで出せる所だけ)
//   MsxTeamEffects… 編成全体のアシスト効果の一覧
//   msxTeamAuto   … おまかせ(総合力の高い順に、マスモンボックス・メモリアルモンスターから6枠を埋める。フレンドのいる枠はそのまま)
// 編成の決まり(r1115-115 社長): 6枠のどこにも自分のモンスター・フレンドは最大1体(どの枠にも。入れなくてもよい)。保存の形は変えない(枠の値 { box } / { assist } / { base } / null のまま)
const MSX_TP_SORTS = Object.freeze([['power', '総合力'], ['lv', 'Lv'], ['species', '種族'], ['new', '入手']]);
const msxTpAT = () => (typeof window !== 'undefined' && window.MONHERO_SUCCESS_ASSIST && window.MONHERO_SUCCESS_ASSIST.VERSION === 3 ? window.MONHERO_SUCCESS_ASSIST : null);
// 枠の値が同じ子を指しているか(auto のベースモンは空き扱い)
const msxTpSame = (a, b) => !!(a && b && !a.auto && !b.auto && ((a.box && a.box === b.box) || (a.assist && a.assist === b.assist) || (!a.box && !a.assist && !b.box && !b.assist && a.base && a.base === b.base)));
// アシスト効果の1つ分の効き目(比べる数)と文字
const msxTpAssistVal = (AT, a) => { try { return Number(AT.valueOf(a.id, AT.fromSaved(a) || a.lv)) || 0; } catch (e) { return 0; } };
const msxTpAssistText = (AT, a) => { try { return AT.valueText(a.id, AT.fromSaved(a) || a.lv); } catch (e) { return ''; } };
// 編成で「一番大きい1つだけ」効く効果か(重なると重複になる物)。重なり方の決まりは表(data/monhero-success-assist.js)から読む(r1115-104・107)
//   表に ONE_ONLY(id の並び・Set・{id:true})があればそれ / CAP[id] に one:true があれば1つだけ・one の無い CAP[id] は足し合わせ(上限つき)
//   どちらも無ければ今までの決まり: いるだけ型・試合型は1つだけ(芯 stayLv・battleBuffs)
const msxTpOneOnly = (AT, id) => {
  const d = AT && AT.BY_ID ? AT.BY_ID[id] : null; if (!d) return false;
  const oo = AT.ONE_ONLY;
  if (oo) return Array.isArray(oo) ? oo.includes(id) : typeof oo.has === 'function' ? oo.has(id) : !!oo[id];
  const c = AT.CAP && AT.CAP[id]; if (c) return c.one === true;
  return d.type === 'stay' || d.type === 'battle';
};
// 1つだけ効く効果を、ほかのモンスターが同じかそれ以上持っていれば、その分は重複
const msxTpDupOf = (m, others) => {
  const AT = msxTpAT(); if (!AT || !m || !Array.isArray(m.assists)) return [];
  return m.assists.filter((a) => { if (!msxTpOneOnly(AT, a.id)) return false;
    const v = msxTpAssistVal(AT, a); return others.some((o) => o && Array.isArray(o.assists) && o.assists.some((b) => b.id === a.id && msxTpAssistVal(AT, b) >= v)); });
};
// 長押しで詳細・ふつうに押したら選ぶ(長押しのあとの「押した」は捨てる)
function msxTpPress(onTap, onLong) {
  let t = null; let long = false;
  const clear = () => { if (t) { clearTimeout(t); t = null; } };
  return {
    onPointerDown: () => { long = false; clear(); t = setTimeout(() => { long = true; t = null; onLong(); }, 450); },
    onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => { if (long) { long = false; return; } onTap(); },
  };
}
// おまかせ: 総合力の高い順に、空いている枠(フレンドのいる枠 skip を除く6枠)を埋める。足りない枠は空き(ベースモン)。返り値は新しい枠の並び
function msxTeamAuto(slots, raised, stock, SUC, box, own, assistData, skip = null) {
  const n = slots.slice(); while (n.length < 6) n.push(null);
  const pow = (slot) => { try { return SUC.memberOf(msxTeamSrc(slot, box, own, assistData)).power || 0; } catch (e) { return 0; } };
  const cand = [...raised.map((m) => ({ box: m.id })), ...stock.map((m) => ({ assist: m.id }))]
    .map((s) => ({ s, p: pow(s) })).sort((a, b) => b.p - a.p);
  let k = 0;
  for (let i = 0; i < 6; i += 1) { if (i === skip) { n[i] = null; continue; } n[i] = cand[k] ? cand[k].s : null; k += 1; }
  return n;
}

// 詳細(長押し)。部品は MsxMonDetail をそのまま使う(中は触らない)
function MsxTpDetail({ it, SUC, onClose }) {
  if (!it || typeof MsxMonDetail !== 'function') return null;
  const m = it.rec;
  if (!m) { // ベースモン
    const sp = it.species;
    const st = typeof SUC.initStats === 'function' ? SUC.initStats(sp) : {};
    const gt = typeof SUC.speciesType === 'function' ? SUC.speciesType(sp) : null;
    const pv = typeof msxStartPreview === 'function' ? (() => { try { return msxStartPreview(SUC, sp, gt, null, st); } catch (e) { return {}; } })() : {};
    return <MsxMonDetail species={sp} name={msxMonName(sp)} sub="ベースモン" st={st} apt={msxAptOf(sp)} type={gt} grades={pv.grades || null} peak={pv.peak} SUC={SUC} onClose={onClose}/>;
  }
  const st = MSX_STATS.reduce((o, k) => ({ ...o, [k]: Math.round((m.st && m.st[k]) || 0) }), {});
  const grades = typeof SUC.aptGradesOf === 'function' ? (() => { try { return SUC.aptGradesOf(m); } catch (e) { return null; } })() : null;
  return <MsxMonDetail species={m.species} name={m.nick || msxMonName(m.species)} sub={`Lv.${Math.round(Number(m.lv) || 1)}・${msxMonName(m.species)}${it.kind === 'memo' ? '・メモモン' : ''}`}
    art={typeof MsxMmArt === 'function' ? <MsxMmArt m={m} size="100%"/> : null} st={st} apt={msxAptOf(m.species)} type={m.gt} grades={grades}
    known={Array.isArray(m.techs) ? m.techs : []} power={it.mem ? it.mem.power : null} rank={m.grade ? null : m.rank} grade={m.grade} SUC={SUC} onClose={onClose}/>;
}

// 選ぶ画面(全画面)。idx … 押した枠 / slots … いまの6枠(null は空き) / members … 編成の6体(芯の memberOf の結果)
function MsxTeamPick({ idx, slots, members, own, unlocked, raised, stock, SUC, box, assistData, friendAt = null, onFriend = null, onDone, onClose }) {
  const [tab, setTab] = useState(raised.length ? 'box' : stock.length ? 'memo' : 'base');
  const [sort, setSort] = useState('power');
  const [only, setOnly] = useState('all'); // 得意な能力で絞る
  const [cand, setCand] = useState(slots[idx] || null);
  const [look, setLook] = useState(null);
  const memOf = (slot) => { try { return SUC.memberOf(msxTeamSrc(slot, box, own, assistData)); } catch (e) { return null; } };
  const lists = useMemo(() => ({
    box: raised.map((m, i) => ({ key: m.id, kind: 'box', i, rec: m, species: m.species, slot: { box: m.id } })),
    memo: stock.map((m, i) => ({ key: m.id, kind: 'memo', i, rec: m, species: m.species, slot: { assist: m.id } })),
    base: unlocked.map((sp, i) => ({ key: sp, kind: 'base', i, rec: null, species: sp, slot: { base: sp } })),
  }), [raised, stock, unlocked]);
  const items = useMemo(() => {
    const l = lists[tab].map((x) => ({ ...x, mem: memOf(x.slot) }));
    const f = only === 'all' ? l : l.filter((x) => x.mem && Array.isArray(x.mem.top) && x.mem.top.slice(0, 2).includes(only));
    const by = {
      power: (a, b) => ((b.mem && b.mem.power) || 0) - ((a.mem && a.mem.power) || 0) || a.i - b.i,
      lv: (a, b) => ((b.mem && b.mem.lv) || 0) - ((a.mem && a.mem.lv) || 0) || a.i - b.i,
      species: (a, b) => String(msxMonName(a.species)).localeCompare(String(msxMonName(b.species)), 'ja') || a.i - b.i,
      new: (a, b) => (a.kind === 'base' ? a.i - b.i : b.i - a.i),
    }[sort];
    return f.sort(by);
  }, [lists, tab, sort, only]);
  // いまの枠に選んでいる物を入れたときの6枠(上の段・印に使う)
  const view = slots.map((s, i) => (i === idx ? cand : msxTpSame(s, cand) ? null : s)); // ほかの枠から移す子は、元の枠を空けて見せる(決定で putSlot が同じように動かす)
  const raisedN = view.filter((s) => s && (s.box || s.assist)).length;
  const otherIdx = (slot) => view.findIndex((s, i) => i !== idx && msxTpSame(s, slot));
  const markOf = (x) => {
    if (msxTpSame(cand, x.slot)) return null;
    const at = otherIdx(x.slot);
    if (at >= 0) return { t: `編成中(${at + 1}枠目)`, c: 'in' };
    if (x.species === own) return { t: '育てる種と同じ', c: 'own' };
    if (members.some((m, i) => i !== idx && m && m.species === x.species)) return { t: '同じ種類', c: 'sp' };
    return null;
  };
  const tabs = [['box', 'マスモンボックス', raised.length], ['memo', 'メモリアル', stock.length], ['base', 'ベースモン', unlocked.length]].filter(([k, , n]) => k !== 'memo' || n);
  const frOf = (i) => i === friendAt && i !== idx && members[i] && members[i].friend; // その枠にフレンドがいる(押した枠は選び直すので数えない)
  const curName = (s, i) => { if (frOf(i)) return members[i].name; const m = s ? memOf(s) : null; return m ? m.name : 'おまかせ'; };
  return (
    <div className="msx-ov msx-fade msx-tp-ov" data-msx-team-pick={idx}>
      <div className="msx-tp">
        <div className="msx-tp-hd"><b>{idx + 1}枠目を選ぶ</b><small>長押しで詳しく</small></div>
        <div className="msx-tp-team" data-msx-tp-team>{view.map((s, i) => { const fr = frOf(i); const sp = fr ? members[i].species : s ? (memOf(s) || {}).species : null; return (
          <div key={i} className={`msx-tp-tm${i === idx ? ' on' : ''}${s ? '' : ' em'}`}>
            <span className="fc" aria-label={fr ? 'フレンド' : curName(s, i)}>{sp ? <img src={msxMonThumb(sp)} alt=""/> : <i>{i + 1}</i>}{fr ? <b className="fr">🤝</b> : null}</span></div>); })}</div>
        <div className="msx-tp-tabs" data-msx-tp-tabs>{tabs.map(([k, name, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-msx-tp-tab={k}>{name}<small>{n}</small></button>)}
          {onFriend ? <button type="button" className="fr" onClick={onFriend} data-msx-tp-tab="friend">🤝 フレンド<small>{friendAt != null && friendAt !== idx ? `${friendAt + 1}枠目にいる` : '1体まで'}</small></button> : null}</div>
        <div className="msx-tp-bar">
          <label className="msx-tp-sel"><span>並べ替え</span><select value={sort} onChange={(e) => setSort(e.target.value)} data-msx-tp-sort>{MSX_TP_SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <label className="msx-tp-sel"><span>得意</span><select value={only} onChange={(e) => setOnly(e.target.value)} data-msx-tp-only><option value="all">全て</option>{MSX_STATS.map((k) => <option key={k} value={k}>{MSX_STAT_NAME[k]}</option>)}</select></label>
          <span className="msx-tp-cnt">{tab === 'base' ? '' : `自分 ${raisedN}/6体`}</span>
        </div>
        {tab === 'memo' ? <div className="msx-tp-note" data-msx-assist-head>メモリアルモンスターは育成には使えません。アシスト効果と得意な能力だけ効きます</div> : null}
        <div className="msx-tp-list" data-msx-tp-list>
          {items.length ? items.map((x) => { const mk = markOf(x); const on = msxTpSame(cand, x.slot); const m = x.mem; return (
            <button type="button" key={x.key} className={`msx-tp-c${on ? ' on' : ''}${mk && mk.lock ? ' lk' : ''}`} data-msx-tp-item={x.key} {...(x.kind === 'base' ? { 'data-msx-pick-base': x.species } : {})}
              {...msxTpPress(() => { if (!(mk && mk.lock)) setCand(on ? null : x.slot); }, () => setLook(x))}>
              <span className="fc">{x.rec && typeof MsxMmArt === 'function' ? <MsxMmArt m={x.rec} size="100%" thumb/> : <img src={msxMonThumb(x.species)} alt=""/>}</span>
              {m && m.kind !== 'base' && m.rank ? <i className={`rk ${msxRankCls(m.rank)}`}>{m.rank}</i> : null}
              {on ? <i className="ck" aria-hidden="true">✓</i> : null}
              {mk ? <i className={`mk ${mk.c}`}>{mk.t}</i> : null}
              <b className="nm">{x.rec ? (x.rec.nick || msxMonName(x.species)) : msxMonName(x.species)}</b>
              <span className="tp">{m ? m.top.slice(0, 2).map((k) => <span key={k}>{`${MSX_STAT_ICON[k]}+${Math.round(m.bonus[k] || 0)}%`}</span>) : null}</span>
              <span className="lv">{x.kind === 'base' ? 'ベースモン' : m ? `Lv.${m.lv}・${msxFmt(m.power || 0)}` : ''}</span>
            </button>); })
            : <div className="msx-tp-none">{tab === 'box' ? (raised.length ? '当てはまるモンスターがいません' : 'マスモンボックスはまだ空です。育て終えたモンスターが入ります') : '当てはまるモンスターがいません'}</div>}
        </div>
        <div className="v-ft msx-tp-ft">
          <button type="button" onClick={onClose} data-msx-tp-back>戻る</button>
          <button type="button" onClick={() => setCand(null)} disabled={!cand} className={cand ? '' : 'off'} data-msx-tp-clear>外す</button>
          <button type="button" className="go" onClick={() => onDone(cand)} data-msx-tp-ok>決定</button>
        </div>
      </div>
      {look ? <MsxTpDetail it={look} SUC={SUC} onClose={() => setLook(null)}/> : null}
    </div>
  );
}

// フレンドの貸し出しの一覧(全画面)。参考04
function MsxFriendPick({ idx = 5, friendAt = null, lendList, onLoad, friend, members, SUC, onPick, onOwn, onClose }) {
  const [only, setOnly] = useState('all');
  useEffect(() => { if (lendList === null && typeof onLoad === 'function') onLoad(); }, []);
  const others = members.filter((m) => m && !m.friend);
  const rows = lendList && lendList !== 'loading' && lendList.ok ? lendList.rows : [];
  const list = rows.map((row) => { let m = null; try { m = typeof monsucLendMember === 'function' ? monsucLendMember(row, SUC) : null; } catch (e) { m = null; }
    const mem = m ? (() => { try { return SUC.memberOf(m); } catch (e) { return null; } })() : null;
    return { row, m, mem, dup: mem ? msxTpDupOf(mem, others) : [] }; })
    .filter((x) => only === 'all' || (x.mem && x.mem.top[0] === only));
  return (
    <div className="msx-ov msx-fade msx-tp-ov" data-msx-friend-pick>
      <div className="msx-tp">
        <div className="msx-tp-hd"><b>🤝 フレンドから借りる(1体まで)</b><small>{idx + 1}枠目に入ります</small></div>
        {friendAt != null && friendAt !== idx ? <div className="msx-tp-note" data-msx-fp-move>フレンドは1体まで。選ぶと、{friendAt + 1}枠目のフレンドがこの枠へ移ります</div> : null}
        <div className="msx-tp-chips" data-msx-fp-only>{[['all', '全て'], ...MSX_STATS.map((k) => [k, `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]}`])].map(([k, n]) => <button type="button" key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{n}</button>)}</div>
        <div className="msx-tp-list one" data-msx-fp-list>
          {lendList === null || lendList === 'loading' ? <div className="msx-tp-none">探しています…</div>
            : !lendList.ok ? <div className="msx-tp-none">{typeof monsucLendReasonText === 'function' ? monsucLendReasonText(lendList.reason) : '今は借りられません'}</div>
            : !list.length ? <div className="msx-tp-none">{rows.length ? '当てはまるモンスターがいません' : '貸し出しているフレンドはいません'}</div>
            : list.map(({ row, m, mem, dup }) => { const on = !!(m && friend && friend.friend && friend.friend.id === row.friendId); const name = (row.lend && row.lend.name) || (m && m.name) || ''; const sp = m ? m.species : row.lend && row.lend.species; return (
              <button type="button" key={row.friendId} className={`msx-fp-r${on ? ' on' : ''}${m ? '' : ' lk'}`} disabled={!m} data-msx-fp-row={row.friendId} onClick={() => onPick(on ? null : m)}>
                <span className="fc">{sp ? <img src={msxMonThumb(sp)} alt=""/> : null}{mem && mem.rank && mem.kind !== 'base' ? <i className={`rk ${msxRankCls(mem.rank)}`}>{mem.rank}</i> : null}</span>
                <span className="tx"><small>{row.name || 'フレンド'}</small><b>{name}</b>
                  <span className="tp">{mem ? mem.top.slice(0, 2).map((k) => <span key={k}>{`${MSX_STAT_ICON[k]}+${Math.round(mem.bonus[k] || 0)}%`}</span>) : null}</span></span>
                <span className="st">
                  {on ? <i className="mk in">借りている</i> : null}
                  {!m ? <i className="mk lk" data-msx-fp-ng>編成不可</i> : null}
                  {dup.length ? <i className="mk dup" data-msx-fp-dup title={dup.map((a) => (msxTpAT() && msxTpAT().BY_ID[a.id] ? msxTpAT().BY_ID[a.id].name : a.id)).join('・')}>アシスト重複</i> : null}
                </span>
              </button>); })}
        </div>
        <div className="msx-tp-note">「アシスト重複」… 編成で一番大きい1つだけ効くアシスト効果を、編成のほかのモンスターが同じかそれより大きく持っている。「編成不可」… 借りられない形のモンスター</div>
        <div className="v-ft msx-tp-ft">
          <button type="button" onClick={onClose} data-msx-fp-back>戻る</button>
          <button type="button" onClick={onOwn} data-msx-fp-own>自分のモンスターにする</button>
        </div>
      </div>
    </div>
  );
}

// 編成全体のアシスト効果の一覧
function MsxTeamEffects({ members, onClose }) {
  const AT = msxTpAT();
  const groups = {};
  members.forEach((m, mi) => (m && Array.isArray(m.assists) ? m.assists : []).forEach((a) => {
    const d = AT && AT.BY_ID[a.id]; if (!d) return;
    (groups[a.id] = groups[a.id] || { d, rows: [] }).rows.push({ mi, name: m.name, v: msxTpAssistVal(AT, a), text: msxTpAssistText(AT, a) });
  }));
  const list = Object.keys(groups).map((id) => groups[id]);
  return (
    <div className="msx-ov msx-fade" data-msx-team-effects onClick={onClose}>
      <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
        <h3>効果一覧(アシスト効果 {list.length}種類)</h3>
        <div className="msx-note">重なって効く効果と、編成で一番大きい1つだけ効く効果があります。1つだけ効く効果で小さい方は「重複(効かない)」と出ます</div>
        <div className="msx-dt-body">
          {list.length ? list.map(({ d, rows }) => { const one = msxTpOneOnly(AT, d.id); const best = one ? Math.max(...rows.map((r) => r.v)) : null; let used = false; return (
            <div key={d.id} className="msx-gt-row" data-msx-effect={d.id}>
              <div className="hd"><span className="ic">{cardIconNode(d.icon, 16)}</span><b>{d.name}</b><span className="st">{AT.TYPE_NAME[d.type] || ''}型</span><span className="n">{rows.length}体</span></div>
              {rows.map((r, i) => { const live = !one || (!used && r.v === best && (used = true)); return (
                <div key={i} className="msx-gt-mon"><img src={msxMonThumb(members[r.mi].species)} alt=""/><span className="nm">{r.name}</span><span className="v">{r.text}{live ? '' : '・重複(効かない)'}</span></div>); })}
            </div>); })
            : <div className="msx-gt-none">編成にアシスト効果を持つモンスターがいません。育て終えたモンスターが持っています</div>}
        </div>
        <button type="button" className="msx-dt-close" data-msx-effects-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
