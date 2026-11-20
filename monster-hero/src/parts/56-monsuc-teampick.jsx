// ===== モンヒロサクセス: 始めるときの編成の選ぶ画面(r1115-096・2026-11-15 社長) =====
// 参考: docs/reference/line-mf/team-select-2026-11-15/(01 デッキ選択・02 アシスト編成・03 アシストカード詳細・04 フレンドアシスト編成)。絵・名前・文は写さない
//   編成の画面(MsxStart の2段目)は6枠を大きく並べるだけ。枠を押すとここの全画面へ飛ぶ
//   MsxTeamPick   … 上に編成中の6体、下に持っている子(マスモンボックス・メモリアルモンスター・ベースモン)の大きな一覧。並べ替え・絞り込み・印。タップは選ぶだけ、詳細は下の「効果・詳細」ボタンから(MsxMonDetail。2026-11-18 社長の実機報告で長押し詳細を廃止)。決定で戻る
//   MsxFriendPick … フレンドの貸し出しの一覧。「アシスト重複」「編成不可」の印(いまの決まりで出せる所だけ)
//   MsxTeamEffects… 編成全体のアシスト効果の一覧
//   msxTeamAuto   … おまかせ(総合力の高い順に、マスモンボックス・メモリアルモンスターから6枠を埋める。フレンドのいる枠はそのまま)
// 編成の決まり(r1115-115 社長): 6枠のどこにも自分のモンスター・フレンドは最大1体(どの枠にも。入れなくてもよい)。保存の形は変えない(枠の値 { box } / { assist } / { base } / null のまま)
const MSX_TP_SORTS = Object.freeze([['power', '総合力'], ['lv', 'Lv'], ['name', '名前'], ['species', '種族'], ['new', '入手']]);
// 検索の比べ方: 全角・半角の違いを吸収(NFKC)して小文字で比べる。検索語・比べる文のどちらにも同じ正規化をかける
const msxNormQ = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase();
const msxMatchQ = (q, ...texts) => { const n = msxNormQ(q).trim(); if (!n) return true; return texts.some((t) => msxNormQ(t).includes(n)); };
// 選ぶ画面の共通の道具(検索・並び替え・逆順・候補の件数)。並び替え・逆順は渡したときだけ出す。件数は「候補 / 全体」で、所持総数と混同しない
// hideFull … 下に「所持数」が出ている画面では、絞り込んでいないときの件数を出さない(同じ数の二重・2026-11-20 r1119-033 育-09・育-11・育-52)
function MsxPickTools({ q, onQ, sorts = null, sort, onSort, rev, onRev, count, total, hideFull = false }) {
  return (
    <div className="msx-pt" data-msx-pick-tools>
      <input type="search" className="msx-pt-q" value={q} onChange={(e) => onQ(e.target.value)} placeholder="名前・種族で検索" aria-label="名前・種族で検索" data-msx-pt-q/>
      {sorts ? <label className="msx-pt-s"><select value={sort} onChange={(e) => onSort(e.target.value)} aria-label="並べ替え" data-msx-pt-sort>{sorts.map(([k, n]) => <option key={k} value={k}>並べ替え: {n}</option>)}</select></label> : null}
      {onRev ? <button type="button" className={`msx-pt-r${rev ? ' on' : ''}`} onClick={() => onRev(!rev)} aria-pressed={!!rev} data-msx-pt-rev>逆順</button> : null}
      {hideFull && (total == null || total === count) ? null : <span className="msx-pt-c" data-msx-pt-count>{count}{total != null && total !== count ? ` / ${total}` : ''}件</span>}
    </div>
  );
}
const msxTpAT = () => (typeof window !== 'undefined' && window.MONHERO_SUCCESS_ASSIST && window.MONHERO_SUCCESS_ASSIST.VERSION === 3 ? window.MONHERO_SUCCESS_ASSIST : null);
// 枠の値が同じ子を指しているか(auto のベースモンは空き扱い)
const msxTpSame = (a, b) => !!(a && b && !a.auto && !b.auto && ((a.box && a.box === b.box) || (a.assist && a.assist === b.assist) || (!a.box && !a.assist && !b.box && !b.assist && a.base && a.base === b.base)));
// アシスト効果の1つ分の効き目(比べる数)と文字
const msxTpAssistVal = (AT, a) => { try { return Number(AT.valueOf(a.id, AT.fromSaved(a) || a.lv)) || 0; } catch (e) { return 0; } };
const msxTpAssistText = (AT, a) => { try { return AT.valueText(a.id, AT.fromSaved(a) || a.lv); } catch (e) { return ''; } };
// 効果の説明(保存済みアシストから AT.describe で。効果量・条件・上限の注記 capNote まで表の文のまま。別の計算式は作らない)
const msxTpAssistDesc = (AT, a) => { try { const n = AT.fromSaved(a); return n > 0 ? AT.describe(a.id, n) : AT.valueText(a.id, n); } catch (e) { return ''; } };
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
// 共通の型(MonsucMonCard)へ渡す形。評価と総合力は、保存枠の子なら保存した grade・score(マスモンボックスの一覧と同じ数字。#6888 B-1)、
//   ベースモン・フレンドは芯の memberOf の段と総合力。得意な能力は memberOf の top(伸びが上がる能力)の上から2つ
const msxTpCardM = (rec, mem, species) => ({
  species: (rec && rec.species) || (mem && mem.species) || species,
  nick: rec ? (rec.nick || '') : (mem && mem.kind !== 'base' ? mem.name : ''),
  colors: (rec && rec.colors) || (mem && mem.colors) || [],
  awake: rec ? rec.awake : undefined,
  lv: rec ? rec.lv : mem && mem.kind !== 'base' ? mem.lv : null,
  grade: rec && rec.grade ? rec.grade : mem && mem.kind !== 'base' && mem.rank && mem.rank !== 'base' ? mem.rank : '',
  fav: mem && Array.isArray(mem.top) ? mem.top.slice(0, 2) : [],
});
const msxTpPow = (rec, mem) => (rec && Number.isFinite(rec.score) ? rec.score : mem && mem.kind !== 'base' && Number.isFinite(mem.power) ? mem.power : null);
// 伸びが上がる能力の短い字(札の下の数字の欄)。例「📖+4 🎯+3」
const msxTpBonusText = (mem) => (mem && Array.isArray(mem.top) ? mem.top.slice(0, 2).map((k) => `${MSX_STAT_ICON[k]}+${Math.round((mem.bonus && mem.bonus[k]) || 0)}%`).join(' ') : ''); // 単位の%を付ける(育-93・育-113)

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

// サポート情報(その子が編成にいることの基本値)。数え方は芯の memberOf / gatherChanceOf のまま。基本値と分かるように出し、実際の効果は条件で変わることを添える
function msxTpSupport(mem, SUC) {
  if (!mem) return null;
  const ch = typeof SUC.gatherChanceOf === 'function' ? (() => { try { return SUC.gatherChanceOf(mem); } catch (e) { return {}; } })() : {};
  return (<>
    <div className="cap">サポート情報<span>基本値</span></div>
    <div className="msx-md-kv"><b>親密度(はじめ)</b><span>{mem.bond0}</span></div>
    <div className="msx-md-kv"><b>友情タッグの強さ</b><span>+{Math.round(Number(mem.tag) || 0)}%</span></div>
    <div className="msx-md-kv"><b>得意率</b><span>{Math.round((Number(mem.fav) || 0) * 100)}%</span></div>
    {(Array.isArray(mem.top) ? mem.top : []).slice(0, 3).map((k) => (
      <div key={k} className="msx-md-kv"><b>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</b><span>{ch[k] != null ? `集合率 ${Math.round(ch[k] * 100)}%・` : ''}伸び +{Math.round((mem.bonus && mem.bonus[k]) || 0)}%</span></div>
    ))}
    <div className="msx-note">基本値です。実際の効果は発動条件などで変わります</div>
  </>);
}

// 詳細(長押し・「効果・詳細」ボタン)。部品は MsxMonDetail をそのまま使う(中は触らない)
//   保存済みアシストを渡してアシストのタブから開き、サポート情報(基本値)を技・アシストの手前に出す。開閉で選択・編成は変えない
function MsxTpDetail({ it, SUC, onClose }) {
  const [more, setMore] = useState(false); // 「技・素質」で今までの詳細(MsxMonDetail)を重ねて開く
  if (!it || typeof MsxMonDetail !== 'function') return null;
  // r1119-011: 先にアシモン専用の見せ方(アシスト詳細)。技・素質はそこから
  if (!more && it.mem && typeof MsxAssistDetail === 'function') {
    const m0 = it.rec;
    const fr = it.kind === 'friend';
    return <MsxAssistDetail rec={m0} mem={it.mem} kind={it.kind} name={fr ? it.name : m0 ? (m0.nick || msxMonName(m0.species)) : msxMonName(it.species)}
      sub={fr ? `${it.friendName}さん・Lv.${Math.round(Number(it.mem.lv) || 1)}` : m0 ? `Lv.${Math.round(Number(m0.lv) || 1)}・${msxMonName(m0.species)}` : 'ベースモン'}
      dropped={fr ? it.dropped || 0 : 0} droppedNames={fr ? it.droppedNames || [] : []} onMore={() => setMore(true)} onClose={onClose}/>;
  }
  if (it.kind === 'friend' && it.mem) { // フレンドの技・素質(今までの詳細の中身のまま)
    const mem = it.mem; const fm = it.m || {};
    const fst = MSX_STATS.reduce((o, k) => ({ ...o, [k]: Math.round((mem.stats && mem.stats[k]) || 0) }), {});
    const fgrades = typeof SUC.aptGradesOf === 'function' ? (() => { try { return SUC.aptGradesOf(mem); } catch (e) { return null; } })() : null;
    return <MsxMonDetail species={mem.species} name={it.name} sub={`${it.friendName}さん・Lv.${mem.lv}・${msxMonName(mem.species)}`}
      art={Array.isArray(mem.colors) && mem.colors.some(Boolean) && typeof DyedMonsterImage === 'function' ? <DyedMonsterImage baseId={mem.species} src={msxMonImg(mem.species)} masuColors={mem.colors} alt="" draggable={false}/> : null}
      st={fst} apt={msxAptOf(mem.species)} type={fm.type != null ? fm.type : null} grades={fgrades}
      known={Array.isArray(mem.techs) ? mem.techs : []} power={mem.power} rank={mem.rank} SUC={SUC} onClose={onClose}
      assists={Array.isArray(mem.assists) && mem.assists.length ? mem.assists : null} initialTab={null} supportSummary={null}/>;
  }
  const m = it.rec;
  const assists = it.mem && Array.isArray(it.mem.assists) && it.mem.assists.length ? it.mem.assists : (m && Array.isArray(m.assists) && m.assists.length ? m.assists : null);
  const support = it.mem ? msxTpSupport(it.mem, SUC) : null;
  if (!m) { // ベースモン
    const sp = it.species;
    const st = typeof SUC.initStats === 'function' ? SUC.initStats(sp) : {};
    const gt = typeof SUC.speciesType === 'function' ? SUC.speciesType(sp) : null;
    const pv = typeof msxStartPreview === 'function' ? (() => { try { return msxStartPreview(SUC, sp, gt, null, st); } catch (e) { return {}; } })() : {};
    return <MsxMonDetail species={sp} name={msxMonName(sp)} sub="ベースモン" st={st} apt={msxAptOf(sp)} type={gt} grades={pv.grades || null} peak={pv.peak} SUC={SUC} onClose={onClose} supportSummary={support}/>;
  }
  const st = MSX_STATS.reduce((o, k) => ({ ...o, [k]: Math.round((m.st && m.st[k]) || 0) }), {});
  const grades = typeof SUC.aptGradesOf === 'function' ? (() => { try { return SUC.aptGradesOf(m); } catch (e) { return null; } })() : null;
  return <MsxMonDetail species={m.species} name={m.nick || msxMonName(m.species)} sub={`Lv.${Math.round(Number(m.lv) || 1)}・${msxMonName(m.species)}${it.kind === 'memo' ? '・メモモン' : ''}`}
    art={typeof MsxMmArt === 'function' ? <MsxMmArt m={m} size="100%"/> : null} st={st} apt={msxAptOf(m.species)} type={m.gt} grades={grades}
    known={Array.isArray(m.techs) ? m.techs : []} power={it.mem ? it.mem.power : null} rank={m.grade ? null : m.rank} grade={m.grade} SUC={SUC} onClose={onClose}
    assists={assists} initialTab={assists ? 'assist' : null} supportSummary={support}/>;
}

// 札の下の帯に並べるアシスト効果の印(4つまで+残りの数)。フレンドと自分の子で同じ形(2026-11-20 社長「アシスト能力が見えない」)
const msxTpAssistIcons = (AT, mem) => { const as = AT && mem && Array.isArray(mem.assists) ? mem.assists.filter((a) => a && AT.BY_ID[a.id]) : [];
  return as.length ? <span className="msx-fp-as" data-msx-card-assists={as.length}>{as.slice(0, 4).map((a) => <i key={a.id}>{cardIconNode(AT.BY_ID[a.id].icon, 13)}</i>)}{as.length > 4 ? <small>+{as.length - 4}</small> : null}</span> : null; };

// 選ぶ画面(全画面)。idx … 押した枠 / slots … いまの6枠(null は空き) / members … 編成の6体(芯の memberOf の結果)
function MsxTeamPick({ idx, slots, members, own, unlocked, raised, stock, SUC, box, assistData, friendAt = null, onFriend = null, onDone, onClose }) {
  const [tab, setTab] = useState(raised.length ? 'box' : stock.length ? 'memo' : 'base');
  const [sort, setSort] = useState('power');
  const [q, setQ] = useState(''); // 名前・種族の検索(表示だけの絞り込み。選択は個体で持つので、隠れても外れない)
  const [rev, setRev] = useState(false); // 逆順
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
    const f0 = only === 'all' ? l : l.filter((x) => x.mem && Array.isArray(x.mem.top) && x.mem.top.slice(0, 2).includes(only));
    const f = q.trim() ? f0.filter((x) => msxMatchQ(q, x.rec ? (x.rec.nick || '') : '', msxMonName(x.species))) : f0;
    const by = {
      power: (a, b) => ((b.mem && b.mem.power) || 0) - ((a.mem && a.mem.power) || 0) || a.i - b.i,
      lv: (a, b) => ((b.mem && b.mem.lv) || 0) - ((a.mem && a.mem.lv) || 0) || a.i - b.i,
      name: (a, b) => String((a.rec && a.rec.nick) || msxMonName(a.species)).localeCompare(String((b.rec && b.rec.nick) || msxMonName(b.species)), 'ja') || a.i - b.i,
      species: (a, b) => String(msxMonName(a.species)).localeCompare(String(msxMonName(b.species)), 'ja') || a.i - b.i,
      new: (a, b) => (a.kind === 'base' ? a.i - b.i : b.i - a.i),
    }[sort];
    const sorted = f.sort(by); // f はこの場で作った並びだけ。元の並び・保存データは並べ替えない
    return rev ? sorted.reverse() : sorted;
  }, [lists, tab, sort, only, q, rev]);
  // 選んでいる候補の詳細用(いまのタブの並びにあればそれ、無ければ全タブから探して mem を付け直す。詳細 MsxTpDetail がそのまま使う)
  const candItem = cand ? (items.find((x) => msxTpSame(x.slot, cand)) || [...lists.box, ...lists.memo, ...lists.base].map((x) => ({ ...x, mem: memOf(x.slot) })).find((x) => msxTpSame(x.slot, cand)) || null) : null;
  // いまの枠に選んでいる物を入れたときの6枠(上の段・印に使う)
  const view = slots.map((s, i) => (i === idx ? cand : msxTpSame(s, cand) ? null : s)); // ほかの枠から移す子は、元の枠を空けて見せる(決定で putSlot が同じように動かす)
  const raisedN = view.filter((s) => s && (s.box || s.assist)).length;
  const otherIdx = (slot) => view.findIndex((s, i) => i !== idx && msxTpSame(s, slot));
  const markOf = (x) => {
    if (msxTpSame(cand, x.slot)) return null;
    const at = otherIdx(x.slot);
    if (at >= 0) return { t: `編成中(${at + 1}枠目)`, c: 'in' };
    if (x.species === own) return { t: '育てる種と同じ', n: '育てる種', c: 'own' };
    if (members.some((m, i) => i !== idx && m && m.species === x.species)) return { t: '同じ種類', n: '同じ種類', c: 'sp' };
    return null;
  };
  const recOf = (slot) => (slot && slot.box ? raised.find((m) => m.id === slot.box) : slot && slot.assist ? stock.find((m) => m.id === slot.assist) : null) || null;
  const tabs = [['box', 'マスモンボックス', raised.length], ['memo', 'メモリアル', stock.length], ['base', 'ベースモン', unlocked.length]].filter(([k, , n]) => k !== 'memo' || n);
  const frOf = (i) => i === friendAt && i !== idx && members[i] && members[i].friend; // その枠にフレンドがいる(押した枠は選び直すので数えない)
  const curName = (s, i) => { if (frOf(i)) return members[i].name; const m = s ? memOf(s) : null; return m ? m.name : 'おまかせ'; };
  return (
    <div className="msx-ov msx-fade msx-tp-ov" data-msx-team-pick={idx}>
      <div className="msx-tp">
        {/* 戻るはほかの画面と同じ左上の「← 戻る」1つ(下の帯は「外す」「決定」だけ。r1119-033 窓-45・53) */}
        <div className="msx-tp-hd"><button type="button" className="bk" onClick={onClose} data-mh-back data-msx-tp-back>← 戻る</button><b>{idx + 1}枠目を選ぶ</b><small>{tab === 'base' ? '選んで「効果・詳細」で中身を見る' : `自分のモンスター ${raisedN}/6体`}</small></div>
        <div className="msx-tp-team" data-msx-tp-team>{view.map((s, i) => { const fr = frOf(i); const mm = fr ? members[i] : s ? memOf(s) : null; const rec = s && !fr ? recOf(s) : null; return (
          <div key={i} className={`msx-tp-tm${i === idx ? ' on' : ''}${s || fr ? '' : ' em'}`} aria-label={fr ? 'フレンド' : curName(s, i)}>
            <MonsucMonCard m={mm ? msxTpCardM(rec, mm) : null} size="s" empty={String(i + 1)} on={i === idx && !!mm}/>{fr ? <b className="fr">🤝</b> : null}</div>); })}</div>
        <div className="msx-tp-tabs" data-msx-tp-tabs>{tabs.map(([k, name, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-msx-tp-tab={k}>{name}<small>{n}</small></button>)}
          {onFriend ? <button type="button" className="fr" onClick={onFriend} data-msx-tp-tab="friend">🤝 フレンド<small>{friendAt != null && friendAt !== idx ? `${friendAt + 1}枠目にいる` : '1体まで'}</small></button> : null}</div>
        <div className="msx-tp-bar">
          <MsxPickTools q={q} onQ={setQ} sorts={MSX_TP_SORTS} sort={sort} onSort={setSort} rev={rev} onRev={setRev} count={items.length} total={lists[tab].length}/>
          <label className="msx-tp-sel"><select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="得意な能力で絞る" data-msx-tp-only><option value="all">得意: 全て</option>{MSX_STATS.map((k) => <option key={k} value={k}>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</option>)}</select></label>
        </div>
        {/* 札の帯「同じ種類」「育てる種」の意味(選べないのか分からなかった・育-89) */}
        {items.some((x) => { const mk = markOf(x); return mk && mk.c !== 'in'; }) ? <div className="msx-tp-note msx-kp" data-msx-tp-marknote>「同じ種類」は編成にもういる種類、{'\u200b'}「育てる種」は育てるモンスターと同じ種類の印です。{'\u200b'}どちらも入れられます</div> : null}
        {tab === 'memo' ? <div className="msx-tp-note" data-msx-assist-head>メモリアルモンスターは育成には使えません。アシスト効果と得意な能力だけ効きます</div> : null}
        <div className="msx-tp-list" data-msx-tp-list>
          {items.length ? <MonsucCardGrid size="s">{items.map((x) => { const mk = markOf(x); const on = msxTpSame(cand, x.slot); const m = x.mem; const at = mk && mk.c === 'in' ? otherIdx(x.slot) : -1; const pw = msxTpPow(x.rec, m); return (
            <MonsucMonCard key={x.key} m={msxTpCardM(x.rec, m, x.species)} size="s" on={on} slot={on ? idx + 1 : at >= 0 ? at + 1 : null} note={(mk && mk.c !== 'in') || msxTpAssistIcons(msxTpAT(), m) ? <>{mk && mk.c !== 'in' ? <b className="msx-fp-dup">{mk.n}</b> : null}{msxTpAssistIcons(msxTpAT(), m)}</> : null}
              num={x.kind === 'base' ? msxTpBonusText(m) : pw != null ? msxFmt(pw) : ''}
              attrs={{ 'data-msx-tp-item': x.key, ...(x.kind === 'base' ? { 'data-msx-pick-base': x.species } : {}) }}
              onClick={() => setCand(on ? null : x.slot)}/>); })}</MonsucCardGrid>
            : <div className="msx-tp-none">{tab === 'box' && !raised.length ? 'マスモンボックスはまだ空です。育て終えたモンスターが入ります' : q.trim() ? '検索に当てはまるモンスターがいません' : '当てはまるモンスターがいません'}</div>}
        </div>
        <div className="v-ft msx-tp-ft">
          <button type="button" onClick={() => setCand(null)} disabled={!cand} className={cand ? '' : 'off'} data-msx-tp-clear>外す</button>
          {candItem ? <button type="button" onClick={() => setLook(candItem)} data-msx-tp-detail={candItem.key}>効果・詳細</button> : null}
          <button type="button" className="go" onClick={() => onDone(cand)} data-msx-tp-ok>決定</button>
        </div>
      </div>
      {look ? <MsxTpDetail it={look} SUC={SUC} onClose={() => setLook(null)}/> : null}
    </div>
  );
}

// フレンドの貸し出しの一覧(全画面)。参考04
function MsxFriendPick({ idx = 5, friendAt = null, lendList, onLoad, friend, members, SUC, onPick, onOwn, onClose }) {
  // 2026-11-20 社長「フレンドの所はいじってない? 同じ作りにできないの?」: 自分のモンスターを選ぶ画面(MsxTeamPick)と同じ作りにする。
  //   上に編成の6枠・タブ(フレンドのタブが選ばれた形)・検索の段・同じ札(MonsucMonCard)の並び・下の 戻る/外す/効果・詳細/決定。
  //   札の下の帯に、その子のアシスト効果の印を並べる。詳細は自分の子と同じ MsxTpDetail(アシスト詳細 → 技・素質)を通す
  const [only, setOnly] = useState('all');
  const [look, setLook] = useState(null); // 借りる前の詳細(開閉で借用状態は変えない)
  const [fq, setFq] = useState(''); // 名前・種族の検索(表示だけの絞り込み)
  const [fsort, setFsort] = useState('power');
  const [frev, setFrev] = useState(false);
  const curId = friend && friend.friend ? friend.friend.id : null;
  const [cand, setCand] = useState(curId); // 選んでいるフレンド(決定で借りる)
  useEffect(() => { if (lendList === null && typeof onLoad === 'function') onLoad(); }, []);
  const AT = msxTpAT();
  const others = members.filter((m, i) => m && !m.friend && i !== idx);
  const rows = lendList && lendList !== 'loading' && lendList.ok ? lendList.rows : [];
  const list0 = rows.map((row) => { let m = null; try { m = typeof monsucLendMember === 'function' ? monsucLendMember(row, SUC) : null; } catch (e) { m = null; }
    const mem = m ? (() => { try { return SUC.memberOf(m); } catch (e) { return null; } })() : null;
    // 貸し出しに入っていたのに、端末の確かめ(能力に比べて大きすぎる)で外れたアシスト効果の数
    const sent = row.lend && Array.isArray(row.lend.assists) ? row.lend.assists.length : 0;
    const dropped = Math.max(0, sent - (m && Array.isArray(m.assists) ? m.assists.length : 0));
    const droppedNames = dropped && row.lend && Array.isArray(row.lend.assists) ? row.lend.assists.map((a) => (a && msxTpAT() && msxTpAT().BY_ID[a.id] ? msxTpAT().BY_ID[a.id].name : null)).filter(Boolean) : [];
    return { row, m, mem, dropped, droppedNames, dup: mem ? msxTpDupOf(mem, others) : [] }; })
    .filter((x) => only === 'all' || (x.mem && Array.isArray(x.mem.top) && x.mem.top.slice(0, 2).includes(only)));
  const listF = fq.trim() ? list0.filter((x) => msxMatchQ(fq, (x.row.lend && x.row.lend.name) || (x.m && x.m.name) || '', msxMonName(x.m ? x.m.species : (x.row.lend && x.row.lend.species)))) : list0;
  const fby = {
    power: (a, b) => ((b.mem && b.mem.power) || -1) - ((a.mem && a.mem.power) || -1),
    lv: (a, b) => ((b.mem && b.mem.lv) || -1) - ((a.mem && a.mem.lv) || -1),
    name: (a, b) => String((a.row.lend && a.row.lend.name) || (a.m && a.m.name) || '').localeCompare(String((b.row.lend && b.row.lend.name) || (b.m && b.m.name) || ''), 'ja'),
  }[fsort];
  const list = listF.slice().sort(fby); // 写しを並べ替える(元の並びは変えない)
  if (frev) list.reverse();
  const candX = cand ? list0.find((x) => x.row.friendId === cand) || null : null;
  const asIcons = (mem) => msxTpAssistIcons(AT, mem);
  const seenOf = (row) => { const t = row.lastSeenAt && typeof friendsLastSeenText === 'function' ? friendsLastSeenText(row.lastSeenAt, Date.now()) : null; if (t) return t;
    const d = row.lend && row.lend.updatedAt ? Math.floor(Math.max(0, Date.now() - row.lend.updatedAt) / 86400000) : null; return d != null ? `貸し出し更新 ${d === 0 ? '今日' : `${d}日前`}` : ''; };
  const anyMark = list.some((x) => x.dup.length || !x.m);
  return (
    <div className="msx-ov msx-fade msx-tp-ov" data-msx-friend-pick>
      <div className="msx-tp">
        <div className="msx-tp-hd"><button type="button" className="bk" onClick={onClose} data-mh-back data-msx-fp-back>← 戻る</button><b>{idx + 1}枠目を選ぶ</b><small>{rows.length ? `貸し出し中のフレンド ${rows.length}人` : 'フレンドのモンスター'}</small></div>
        <div className="msx-tp-team" data-msx-tp-team>{members.map((mm, i) => (
          <div key={i} className={`msx-tp-tm${i === idx ? ' on' : ''}${mm ? '' : ' em'}`}><MonsucMonCard m={mm ? msxTpCardM(null, mm) : null} size="s" empty={String(i + 1)} on={i === idx && !!mm}/>{mm && mm.friend ? <b className="fr">🤝</b> : null}</div>))}</div>
        <div className="msx-tp-tabs" data-msx-tp-tabs>
          <button type="button" onClick={onOwn} data-msx-fp-own>自分のモンスター<small>ボックス・ベースモン</small></button>
          <button type="button" className="fr on" data-msx-tp-tab="friend">🤝 フレンド<small>{friendAt != null && friendAt !== idx ? `${friendAt + 1}枠目にいる` : '1体まで'}</small></button></div>
        {lendList && lendList !== 'loading' && lendList.ok ? <div className="msx-tp-bar"><MsxPickTools q={fq} onQ={setFq} sorts={[['power', '総合力'], ['lv', 'Lv'], ['name', '名前']]} sort={fsort} onSort={setFsort} rev={frev} onRev={setFrev} count={list.length} total={rows.length}/>
          <label className="msx-tp-sel"><select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="得意な能力で絞る" data-msx-fp-only><option value="all">得意: 全て</option>{MSX_STATS.map((k) => <option key={k} value={k}>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</option>)}</select></label></div> : null}
        {friendAt != null && friendAt !== idx ? <div className="msx-tp-note" data-msx-fp-move>フレンドは1体まで。選ぶと、{friendAt + 1}枠目のフレンドがこの枠へ移ります</div> : null}
        {anyMark ? <div className="msx-tp-note" data-msx-fp-marknote>「重複」… 1体だけ効く効果が、編成のほかのモンスターと重なっている</div> : null}
        <div className="msx-tp-list" data-msx-fp-list>
          {lendList === null || lendList === 'loading' ? <div className="msx-tp-none">探しています…</div>
            : !lendList.ok ? <div className="msx-tp-none">{typeof monsucLendReasonText === 'function' ? monsucLendReasonText(lendList.reason) : '今は借りられません'}</div>
            : !list.length ? <div className="msx-tp-none">{rows.length ? (fq.trim() ? '検索に当てはまるモンスターがいません' : '当てはまるモンスターがいません') : '貸し出しているフレンドはいません'}</div>
            : <MonsucCardGrid size="s">{list.map(({ row, m, mem, dup }) => { const on = cand === row.friendId; const sp = m ? m.species : row.lend && row.lend.species;
              const cm = mem ? { ...msxTpCardM(null, mem, sp), nick: (row.lend && row.lend.name) || (m && m.name) || '' } : { species: sp, nick: (row.lend && row.lend.name) || '' };
              return (<MonsucMonCard key={row.friendId} m={sp ? cm : null} size="s" on={on} slot={on ? idx + 1 : null} lock={m ? null : '編成不可'}
                note={m ? <>{dup.length ? <b className="msx-fp-dup" data-msx-fp-dup>重複</b> : null}{asIcons(mem)}</> : null}
                num={mem ? msxFmt(mem.power) : ''}
                attrs={{ 'data-msx-fp-row': row.friendId }} onClick={m ? () => setCand(on ? null : row.friendId) : null}/>); })}</MonsucCardGrid>}
        </div>
        {candX ? <div className="msx-tp-note" data-msx-fp-who>{candX.row.name || 'フレンド'}さんの{(candX.row.lend && candX.row.lend.name) || ''}{seenOf(candX.row) ? `・${seenOf(candX.row)}` : ''}</div> : null}
        <div className="v-ft msx-tp-ft">
          <button type="button" onClick={() => setCand(null)} disabled={!cand} className={cand ? '' : 'off'} data-msx-fp-clear>外す</button>
          {candX && candX.m && candX.mem ? <button type="button" onClick={() => setLook(candX)} data-msx-fp-detail={candX.row.friendId}>効果・詳細</button> : null}
          <button type="button" className="go" onClick={() => { if (!cand) { if (curId) onPick(null); else onClose(); return; } if (cand === curId) { onClose(); return; } if (candX && candX.m) onPick(candX.m); }} data-msx-fp-ok>決定</button>
        </div>
      </div>
      {look ? <MsxTpDetail it={{ kind: 'friend', rec: null, species: look.m.species, mem: look.mem, name: (look.row.lend && look.row.lend.name) || look.m.name, friendName: look.row.name || 'フレンド', dropped: look.dropped, droppedNames: look.droppedNames, m: look.m }} SUC={SUC} onClose={() => setLook(null)}/> : null}
    </div>
  );
}

// 編成全体のアシスト効果の一覧(④段2・2026-11-20 社長の実機の指摘で作り直し)
//   上に「編成の合計」の表: 効果ごとに1行(アイコン・名前・合計と上限のゲージ・効いている子の顔)。行を押すと説明と1体ずつの値が開く。
//   「効果ごと/モンスターごと」の切り替え。合計の数え方は芯と同じ: 1つだけ効く効果(msxTpOneOnly)はいちばん大きい1体、それ以外は足し合わせ。
//   上限は表(CAP)の v。組(group)の上限は、同じ組の効果を合わせた合計で見る。言葉は画面の用語(型の名前・「重複」は出さない)
const msxEfNum = (AT, id, x) => { const a = AT.BY_ID[id]; return a && a.k === 'mul' && a.u === '倍' ? (x - 1) * 100 : x; };
const msxEfText = (AT, id, x) => {
  const a = AT.BY_ID[id]; if (!a) return '';
  if (a.k === 'on') return 'あり';
  const n = Math.round(x * 100) / 100; const t = AT.valueText(id, 1);
  return /[0-9]/.test(t) ? t.replace(/[0-9]+(\.[0-9]+)?/, String(n)) : `+${n}`;
};
// 行に常に出す1行の説明(何に・どれだけ。育-02)。足し合わせの効果は編成の合計の値で書く(開いた説明と行の数字が食い違わない・育-04)。上限の一言は下の行に出すので付けない
const msxEfSentence = (AT, id, total, n, one) => {
  const a = AT.BY_ID[id]; if (!a) return '';
  const note = typeof AT.capNote === 'function' ? AT.capNote(id) : '';
  const strip = (t) => (note && t.endsWith(note) ? t.slice(0, t.length - note.length) : t);
  if (one || /\{start\}|\{mv\}/.test(String(a.text || ''))) return strip(AT.describe(id, n));
  const f = (v) => String(Math.round(v * 100) / 100);
  const vt = a.k === 'cnt' && a.cu === 'Lv' ? `+${f(total)}` : a.k === 'rate' || a.k === 'hard' ? `+${f(total)}%` : a.k === 'rateDown' ? `−${f(total)}%` : a.k ? msxEfText(AT, id, total) : f(total);
  return String(a.text || '').replace('{v}', `\u0001${vt}\u0001`);
};
// 文の中の数字は折り返さない(「+13%」だけが次の行に落ちていた)。\u0001 で囲んだ所を1かたまりにする
const msxEfSentenceNode = (t) => String(t).split('\u0001').map((x, i) => (i % 2 ? <b key={i} className="nw">{x}</b> : x));
function MsxTeamEffects({ members, onClose }) {
  const AT = msxTpAT();
  const [view, setView] = useState('eff');
  const [open, setOpen] = useState(null);
  const groups = {};
  members.forEach((m, mi) => (m && Array.isArray(m.assists) ? m.assists : []).forEach((a) => {
    const d = AT && AT.BY_ID[a.id]; if (!d) return;
    (groups[a.id] = groups[a.id] || { d, rows: [] }).rows.push({ mi, name: m.name, n: AT.fromSaved(a) || a.lv, v: msxTpAssistVal(AT, a), text: msxTpAssistText(AT, a) });
  }));
  const list = Object.keys(groups).map((id) => {
    const g = groups[id]; const one = msxTpOneOnly(AT, id);
    const best = Math.max(...g.rows.map((r) => r.v));
    let used = false; const rows = g.rows.slice().sort((x, y) => y.v - x.v).map((r) => { const live = !one || (!used && r.v === best && (used = true)); return { ...r, live }; });
    const total = one ? msxEfNum(AT, id, best) : rows.reduce((t, r) => t + msxEfNum(AT, id, r.v), 0);
    return { id, d: g.d, one, rows, total };
  }).sort((x, y) => y.rows.length - x.rows.length || String(x.d.name).localeCompare(String(y.d.name), 'ja'));
  const capOf = (id) => { const c = AT && AT.CAP ? AT.CAP[id] : null; return c && Number.isFinite(c.v) ? c : null; };
  const groupTotal = (grp) => list.filter((e) => { const c = capOf(e.id); return c && c.group === grp; }).reduce((t, e) => t + e.total, 0);
  const face = (mi, dim) => { const m = members[mi]; return <span key={mi} className={`msx-ef-fc${dim ? ' dim' : ''}`}><MsxMonFace species={m.species} colors={m.colors}/></span>; };
  return (
    <div className="msx-ov msx-fade" data-msx-team-effects role="dialog" aria-modal="true" onClick={onClose}>
      <div className="msx-sheet msx-dt msx-ef" onClick={(e) => e.stopPropagation()}>
        <h3>編成の効果<small>{list.length}種類</small></h3>
        <div className="msx-ef-tabs" role="tablist">{[['eff', '効果ごと'], ['mon', 'モンスターごと']].map(([k, n]) => <button type="button" key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)} data-msx-ef-view={k}>{n}</button>)}</div>
        <div className="msx-dt-body">
          {view === 'eff' ? (list.length ? <>
            <div className="msx-ef-how"><span>数字は編成の合計(上限まで効く)</span><span><b className="one">1体だけ</b> 一番大きい1体の分だけ効く</span><span>行を押すと1体ずつの値</span></div>
            {(() => { const seenGrp = {}; return list.map((e) => { const c = capOf(e.id); const grpFirst = !!(c && c.group && !seenGrp[c.group] && (seenGrp[c.group] = true)); const tot = c && c.group ? groupTotal(c.group) : e.total; const pct = c ? Math.min(100, tot / c.v * 100) : null; const u = AT.BY_ID[e.id] && AT.BY_ID[e.id].u === '%' ? '%' : ''; const on = open === e.id; return (
              <div key={e.id} className={`msx-ef-row${on ? ' on' : ''}${c && c.group ? ' grp' : ''}`}>
                <button type="button" className="msx-ef-hd" onClick={() => setOpen(on ? null : e.id)} aria-expanded={on} data-msx-effect={e.id} data-msx-assist-type={e.d.type || ''}>
                  <span className="ic">{cardIconNode(e.d.icon, 18)}</span>
                  <span className="tx"><b className="nm">{e.d.name}{e.one ? <i className="one">1体だけ</i> : null}</b>
                    <small className="ds" data-msx-effect-desc>{msxEfSentenceNode(msxEfSentence(AT, e.id, e.total, e.rows[0].n, e.one))}</small>
                    {/* 上限の行: 組(左の橙の線)は最初の行にだけ合計と上限を書き、ほかの行は分け合うことだけ書く(同じ行が2枚に出ていた) */}
                    {c || !e.one ? <small className="cap">{c ? (c.group ? (grpFirst ? <><span>橙の線の5つを合わせて {Math.round(tot * 100) / 100}{u}</span><span>(上限{c.v}{u})</span></> : <span>上限は橙の線の行と分け合う</span>) : `上限 ${c.v}${u}`) : '何体ぶんでも足し合わせ'}</small> : null}</span>
                  <span className="fcs">{e.rows.slice(0, 4).map((r) => face(r.mi, !r.live))}{e.rows.length > 4 ? <small>+{e.rows.length - 4}</small> : null}</span>
                </button>
                {on ? <div className="msx-ef-ex" data-msx-effect-ex={e.id}>
                  {(() => { const nt = typeof AT.capNote === 'function' ? AT.capNote(e.id) : ''; return nt ? <p className="capn">上限: {nt.replace(/^[(（]|[)）]$/g, '')}</p> : null; })()}
                  {/体力/.test(msxEfSentence(AT, e.id, e.total, e.rows[0].n, e.one)) ? <p className="capn">体力 … トレーニングで減り、休むと戻る(6つの能力のライフとは別)</p> : null}
                  {e.rows.map((r, i) => <div key={i} className={`msx-ef-mon${r.live ? '' : ' dim'}`}>{face(r.mi, !r.live)}<span className="nm">{r.name}</span><span className="v">{r.text}{r.live ? '' : '(効かない: ほかのモンスターの方が大きい)'}</span></div>)}
                </div> : null}
              </div>); }); })()}
          </> : <div className="msx-gt-none">編成にアシスト効果を持つモンスターがいません。育て終えたモンスターが持っています</div>)
          : members.map((m, mi) => { const own = list.filter((e) => e.rows.some((r) => r.mi === mi)); return (
            <div key={mi} className="msx-ef-mrow" data-msx-ef-mon={mi}>
              <div className="hd">{face(mi, false)}<b>{m.name}</b><small>{m.friend ? 'フレンド' : m.kind === 'base' ? 'ベースモン' : m.assistId ? 'メモモン' : 'マスモン'}・親密度 {m.bond0}・タッグ +{m.tag}%</small></div>
              <div className="chips">{own.length ? own.map((e) => { const r = e.rows.find((x) => x.mi === mi); const lv = r.live ? null : e.rows.find((x) => x.live); return <span key={e.id} className={r.live ? '' : 'dim'} data-msx-ef-chip-off={r.live ? undefined : e.id}>{cardIconNode(e.d.icon, 13)} {e.d.name} <b>{r.text}</b>{lv ? <small className="why">効かない(大きい方だけ効く)</small> : null}</span>; }) : <span className="none">アシスト効果なし(伸びが上がる能力: {(Array.isArray(m.top) ? m.top.slice(0, 2) : []).map((k) => `${MSX_STAT_NAME[k]} +${Math.round((m.bonus && m.bonus[k]) || 0)}%`).join('・')})</span>}</div>
            </div>); })}
        </div>
        <button type="button" className="msx-dt-close" data-msx-effects-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
