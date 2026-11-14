// ===== モンヒロサクセス: 始めるまでの6段(育てるモンスター → 編成 → 助手(シナリオ) → 持ちこみ → 名前と染色 → 確認) =====
// 見本: docs/progress/player-raise/mock/png/v3-S.png(S1〜S6)。計算は芯の memberOf / newRun を呼ぶだけ
// 品の名前の折り目: 「の」のあとと、カタカナ語の「ー」のあと(「縁結びの/お守り」「ブリーダー/ライセンス」)。狭い升目で言葉の途中で折れないように(2026-11-14)
const msxItemNameNode = (name) => String(name || '').split(/(?<=の)|(?<=ー)(?=[ァ-ヶ])/).map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}{x}</React.Fragment>);
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
  // 2026-11-13 社長「持ちこみに、育成中に使えるアイテムも足して」: 詰め合わせの中身を単品でも(芯の ITEMS にある物)
  { id: 'oil', name: 'オイル', desc: '疲れた体にぬるオイル', when: 'both', e: '🫙' },
  { id: 'oilyoil', name: 'オイリーオイル', desc: 'たっぷり効く大きいオイル', when: 'both', e: '🛢️' },
  { id: 'herb', name: '薬草', desc: '気持ちが落ち着く草', when: 'both', e: '🌱' },
]);
// 効き目の数値(2026-11-13 社長「効果が内部の数値でわからないものがある」)。芯の ITEMS・GOOD・BOND から作る(数字を写さない)
const msxItemFx = (id) => {
  const S = typeof msxSuc !== 'undefined' && msxSuc ? msxSuc.SUC : null; const it = S && S.ITEMS ? S.ITEMS[id] : null; if (!it) return '';
  const G = S.GOOD || {}; const pc = (v) => `${Math.round(v * 100)}%`;
  if (it.good === 'eventMaker' && G.eventMaker) { const b = (S.BOND && S.BOND.eventRate) || 0.5; return `編成のモンスターとの出来事 ${pc(b)}→${pc(b + G.eventMaker.eventRate)}`; }
  if (it.good === 'trainGood' && G.trainGood) return `トレーニングの伸び +${pc(G.trainGood.train)}`;
  if (it.good === 'shugyoGood' && G.shugyoGood) return `修行の伸び +${pc(G.shugyoGood.shugyo)}・技を覚える率 +${G.shugyoGood.techRate}`;
  if (it.good === 'star' && G.star) return `人気の上がり ×${G.star.pop}・親密度の上がり ×${G.star.bond}`;
  if (it.good === 'uketsugu' && G.uketsugu) { const st = Array.isArray(S.STORY) ? S.STORY : [{}, { p: 0.7 }, { p: 0.5 }]; const up = G.uketsugu.story; return `編成のモンスターとの連続の話が進みやすくなる(2話目 ${pc(st[1].p)}→${pc(Math.min(1, st[1].p + up))}・3話目 ${pc(st[2].p)}→${pc(Math.min(1, st[2].p + up))})。3話目の伝授で、そのモンスターの得意な能力の上がりが${G.uketsugu.teach}倍${G.uketsugu.start ? `。編成から受け継ぐはじめの能力も${G.uketsugu.start}倍(例: ちから500のモンスターなら +${Math.floor(500 / 25)}→+${Math.floor(500 / 25) * G.uketsugu.start})` : ''}`; }
  if (it.issaForce) return 'イッサ博士が1度かならず来る';
  if (it.issaSure) return 'その回の博士の実験がかならず成功';
  if (it.hpMax) return `体力の上限 +${it.hpMax}`;
  if (it.hpFull) return '体力を上限まで回復';
  if (it.cure) return `悪いようす(サボり癖・うつなど)を治し、体力を上限の${pc(it.hp || 0)}回復`;
  if (it.loyal) return `忠誠度 +${it.loyal}`;
  if (it.ama || it.fear) return `甘え度 +${it.ama || 0}・恐れ度 +${it.fear || 0}(忠誠度 +${(it.ama || 0) + (it.fear || 0)})`;
  if (it.gives) { const g = it.gives; return Object.keys(g).map((k) => `${(S.ITEMS[k] && S.ITEMS[k].name) || k}${g[k]}個(${msxItemFx(k)})`).join('・'); }
  if (it.hp) return `体力を上限の${pc(it.hp)}回復`;
  if (it.stress) return `ストレス ${it.stress}`;
  return '';
};
const msxItemDesc = (id) => { const t = MSX_ITEM_BY_ID[id]; const fx = msxItemFx(id); return `${t ? t.desc : ''}${fx ? `。効き目: ${fx}` : ''}`; };
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
const msxTeamSrc = (slot, box, own) => {
  if (slot && slot.box) { const m = box.mons.find((x) => x.id === slot.box); if (m) return { kind: 'raised', species: m.species, name: m.nick || msxMonName(m.species), stats: m.st, loy: m.loy, pop: m.pop, lv: m.lv, masteries: m.masteries, techs: m.techs, aptUp: m.aptUp, aptBase: m.aptBase, aptAwake: m.aptAwake, assists: m.assists, boxId: m.id }; }
  const sp = slot && slot.base ? slot.base : 'Mocchi';
  // 育てる子と同じ種のベースモンは「(ベースモン)」をつけ、育てる子と取り違えない(2026-11-14)
  return { kind: 'base', species: sp, name: sp === own ? `${msxMonName(sp)}(ベースモン)` : msxMonName(sp) };
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
      <span className="ti">{title}{title === '🌱 モンヒロサクセス' && typeof MsxBetaMark === 'function' ? <MsxBetaMark/> : null}{sub ? <small>{sub}</small> : null}</span>
      {right != null && <span className="rt">{right}</span>}
    </div>
  );
}

// 始める前の見通し: ピークの時期(期の名前)と間合い適性の段。仮の育成を1つ作って芯に聞く(保存しない)
const msxStartPreview = (SUC, species, type, aptBase, startSt) => {
  const out = { peak: '', grades: null, power: null, rank: null };
  try {
    if (typeof SUC.newRun !== 'function') return out;
    const s = SUC.newRun({ id: 'peek', species, ...(Number.isInteger(type) ? { type } : {}), ...(Array.isArray(aptBase) ? { aptBase } : {}) });
    const pk = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : null;
    if (pk && Number.isInteger(pk.from) && typeof SUC.periodOf === 'function') {
      const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name;
      out.peak = a === b ? a : `${a}〜${b}`;
    }
    if (typeof SUC.aptGradesOf === 'function') out.grades = SUC.aptGradesOf(s);
    if (typeof SUC.evaluate === 'function') { const e = SUC.evaluate({ ...s, stats: startSt || (typeof SUC.initStats === 'function' ? SUC.initStats(species) : s.stats) }); out.power = e.power; out.rank = e.rank; }
  } catch (e) { /* 見通しが出せなくても選ぶ画面は動く */ }
  return out;
};
const MSX_DIST_NAMES = ['零', '近', '中', '遠'];
const MSX_TG_COLS = Object.freeze([3, 2, 1, 0]); // 技の升目の列の並び(参考どおり左から 遠・中・近・零)
// まだ覚えていない技の覚え方(技表の learn: { start } / { by:修行の系統, st:{ 能力: 数 } })
const msxTechHow = (t) => {
  const L = t && t.learn; if (!L) return '修行で覚える';
  if (L.start) return 'はじめから';
  const need = L.st && typeof L.st === 'object' ? Object.entries(L.st).map(([k, v]) => `${MSX_STAT_NAME[k] || k}${v}`).join('・') : '';
  return need ? `修行で覚える(${need}で)` : '修行で覚える';
};
const msxLineName = (id) => (id && typeof MONSTER_LINEAGES === 'object' && MONSTER_LINEAGES && MONSTER_LINEAGES[id] ? MONSTER_LINEAGES[id].name : '');
// モンスターの詳細(2026-11-14 社長の手本 monster-detail-basic の組み立て: 左上に絵・名前・総合力/右上に 基礎・特徴・適性/下に技の一覧と選んだ技の詳細)。
//   見るだけ。選ぶ画面の「くわしく」と、育成中の場面の「くわしく」で同じ部品を使う。絵・用語・見た目はうちの物
//   st 能力6つ / apt 素質の字(画面の呼び名。2026-11-14 社長「伸びは素質って表記にして」) / type 成長の型 / peak ピークの期 / grades 間合い適性 [零,近,中,遠] / known 覚えている技の id(無ければ はじめから使える技) / power・rank 総合力
const MSX_STAT_COLOR = Object.freeze({ life: '#facc15', pow: '#f87171', wise: '#4ade80', hit: '#f472b6', eva: '#60a5fa', tough: '#818cf8' });
// head … 名前の横に置く物(マスモンボックスのハート・✏)/ more … 特徴のタブの下に足す行 [[見出し, 中身], …] / foot … 「とじる」の上に置くボタン(貸し出し・お別れ)/ grade … 総合力の横の評価(A2 など)
function MsxMonDetail({ species, name, art, st, apt, type, peak, grades, known, power, rank, sub, onClose, SUC, head = null, more = null, foot = null, grade: gradeLabel = null }) {
  const [tab, setTab] = useState('base');
  const line = typeof MONSTER_LINEAGE_MAP === 'object' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP[species] : null;
  const main = line ? msxLineName(line.main) : ''; const subL = line ? msxLineName(line.sub || line.main) : '';
  const dex = typeof MONSTER_DEX_DESCRIPTIONS === 'object' && MONSTER_DEX_DESCRIPTIONS && MONSTER_DEX_DESCRIPTIONS[species];
  const typeName = type != null && typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(type).name : '—';
  const all = typeof SUC.techsOf === 'function' ? SUC.techsOf(species).filter(Boolean) : [];
  const has = (t) => (Array.isArray(known) ? known.includes(t.id) : !!(t.learn && t.learn.start));
  const list = all.slice().sort((x, y) => (has(y) - has(x)) || (Number(x.rank) || 0) - (Number(y.rank) || 0));
  // 間合いごとの列(1つの技が2つの間合いに出ることもある)。覚えた技を上に、そのあとは段の低い順
  const tgCols = [0, 1, 2, 3].map((d) => list.filter((t) => Array.isArray(t.dist) && t.dist.includes(d)));
  const tgRows = Math.max(3, ...tgCols.map((c) => c.length));
  const [pickT, setPickT] = useState(() => (all.find(has) || all[0] || {}).id || null);
  const tech = all.find((t) => t.id === pickT) || list[0] || null;
  const grade = (k, v) => (typeof msaTechGrade === 'function' ? msaTechGrade(k, v) : '') || '−';
  const maxSt = Math.max(300, ...MSX_STATS.map((k) => Number(st[k]) || 0));
  const TOP = [['base', '基礎'], ['feat', '特徴'], ['apt', '適性']];
  return (
    <div className="msx-ov msx-fade" data-msx-detail onClick={onClose}>
      <div className="msx-sheet msx-dt msx-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="msx-md-ti">モンスターの詳細</h3>
        <div className="msx-md-scroll">
          <div className="msx-md-top">
            <div className="msx-md-art">
              <div className="nm">{head ? <span className="msx-md-head">{head}</span> : null}{name || msxMonName(species)}{sub ? <small>{sub}</small> : null}</div>
              {art || <img src={msxMonImg(species)} alt=""/>}
              {power != null ? <div className="pw"><small>総合力</small><b>{msxFmt(power)}</b>{rank ? <i className={msxRankCls(rank)}>{rank}</i> : null}{gradeLabel ? <i className="msx-md-grade">{gradeLabel}</i> : null}</div> : null}
            </div>
            <div className="msx-md-panel">
              <div className="msx-md-tabs">{TOP.map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} data-msx-detail-tab={k} onClick={() => setTab(k)}>{n}</button>)}</div>
              {tab === 'base' ? (<div className="msx-md-box"><div className="cap">能力<span>素質</span></div>
                {MSX_STATS.map((k, i) => (
                  <div key={k} className="msx-md-st"><span className="n">{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</span>
                    <span className="v"><b>{st[k]}</b><span className="g"><i style={{ width: `${Math.max(2, Math.min(100, (Number(st[k]) || 0) / maxSt * 100))}%`, background: MSX_STAT_COLOR[k] }}/></span></span>
                    <span className={`a${apt[i] > 'B' ? ' lo' : ''}`}>{apt[i]}</span></div>
                ))}</div>) : null}
              {tab === 'feat' ? (<div className="msx-md-box">
                <div className="msx-md-kv"><b>成長の型</b><span className="yel">{typeName}</span></div>
                <div className="msx-md-kv"><b>伸びどき</b><span>{peak || '—'}</span></div>
                <div className="msx-md-kv"><b>血統</b><span>{main ? `${main}${subL && subL !== main ? ` × ${subL}` : '(純血)'}` : '—'}</span></div>
                {Array.isArray(more) ? more.filter(Boolean).map(([k, v], i) => <div key={`m${i}`} className="msx-md-kv"><b>{k}</b><span>{v}</span></div>) : null}
                <div className="msx-md-dex">{dex || 'このモンスターの図鑑は調査中'}</div></div>) : null}
              {tab === 'apt' ? (<div className="msx-md-box"><div className="cap">間合い適性</div>
                <div className="msx-dt-dist">{MSX_DIST_NAMES.map((d, i) => <div key={d}><span>{d}</span><b>{grades ? grades[i] : '—'}</b></div>)}</div>
                <div className="msx-note" style={{ marginTop: 4 }}>適性が高い間合いほど、その間合いの技がよく当たる</div></div>) : null}
            </div>
          </div>
          {/* 技の欄(2026-11-14 社長「今なんの技を覚えてるかわかんない」→ 参考 monster-detail-basic の形): 左から 遠・中・近・零 の4列の升目+右に技の詳細。
              升の中は技の絵と右下に消費ガッツ。覚えていない技は暗い升に錠、出ない枠は×。升を押すと右に詳細。参考の「移動間合い・技能力・連動能力」はこのゲームに無いので出さない */}
          <div className="msx-md-bot" data-msx-detail-techs>
            <div className="msx-md-cap">技<small>{Array.isArray(known) ? '覚えた技' : 'はじめから使える技'} {all.filter(has).length}/{all.length}</small></div>
            <div className="msx-md-tw">
              <div className="msx-md-tg">
                {MSX_TG_COLS.map((d) => <span key={`h${d}`} className={`tgh d${d}`}>{MSX_DIST_NAMES[d]}</span>)}
                {Array.from({ length: tgRows }).map((_, r) => MSX_TG_COLS.map((d) => { const t = tgCols[d][r];
                  if (!t) return <span key={`${r}-${d}`} className="no" aria-hidden="true">×</span>;
                  const got = has(t);
                  // 技の種類で升の色を分ける(参考どおり ちから=金・かしこさ=緑)。覚えていない技も絵を出し、暗くくすませて左上に必要な数(2026-11-14 社長「鍵じゃなくて覚えてないやつも表示して色分けして」)
                  const need = !got && t.learn && t.learn.st && typeof t.learn.st === 'object' ? Object.values(t.learn.st)[0] : null;
                  return <button type="button" key={`${r}-${d}`} className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'}${got ? ' got' : ' lk'}${tech && tech.id === t.id ? ' on' : ''}`} data-msx-tech={t.id} aria-label={`${t.name}${got ? '' : '(まだ覚えていない)'}`} onClick={() => setPickT(t.id)}>
                    <span className="ti" aria-hidden="true">{t.kind === 'wise' ? '🧠' : '💪'}</span>{need != null ? <span className="nd">{need}</span> : null}<span className="g">{t.guts}</span></button>; }))}
              </div>
              {tech ? (<div className="msx-md-td">
                <div className="tn">{tech.name}{has(tech) ? null : <small className="msx-md-not">まだ覚えていない</small>}</div>
                <div className="msx-md-kv"><b>技種</b><span>{tech.kind === 'wise' ? 'かしこさ' : 'ちから'}</span></div>
                <div className="msx-md-kv"><b>消費ガッツ</b><span>{tech.guts}</span></div>
                <div className="msx-md-kv"><b>ダメージ</b><span className="gd">{grade('power', tech.power)}</span></div>
                <div className="msx-md-kv"><b>命中率</b><span className="gd">{grade('hit', tech.hit)}</span></div>
                <div className="msx-md-kv"><b>ガッツダウン</b><span className="gd">{grade('gd', tech.gd)}</span></div>
                <div className="msx-md-kv"><b>クリティカル率</b><span className="gd">{grade('crit', tech.crit)}</span></div>
                <div className="msx-md-kv"><b>覚え方</b><span>{has(tech) ? (Array.isArray(known) ? '覚えている' : 'はじめから') : msxTechHow(tech)}</span></div>
              </div>) : null}
            </div>
          </div>
        </div>
        {foot ? <div className="msx-md-foot">{foot}</div> : null}
        <button type="button" className="msx-dt-close" data-msx-detail-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

// 編成の1枠に入れるモンスターを選ぶ窓(ベースモン・保存枠の子)。2026-11-14 社長「編成ってベースモンからかマスモンからじゃないの?」
function MsxSlotPicker({ idx, cur, own, unlocked, raised, teamBox, SUC, onPick, onClose }) {
  const thumb = { width: 34, height: 34, borderRadius: 9, objectFit: 'contain', background: '#0f172a' };
  const topTxt = (src) => { try { const m = SUC.memberOf(src); return m.top.slice(0, 2).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]}`).join(' '); } catch (e) { return ''; } };
  const boxFull = teamBox.length >= 5 && !(cur && cur.box);
  return (
    <div className="msx-ov msx-fade" data-msx-slot-picker onClick={onClose}>
      <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
        <h3>{idx + 1}枠目に入れるモンスター</h3>
        <div className="msx-dt-body">
          <div className="msx-dt-cap">ベースモン</div>
          <div className="msx-pick-grid">{unlocked.map((sp) => { const on = cur && !cur.box && cur.base === sp && !cur.auto; return (
            <button type="button" key={sp} className={`msx-pick${on ? ' on' : ''}`} data-msx-pick-base={sp} onClick={() => onPick({ base: sp })}>
              <img src={msxMonThumb(sp)} alt=""/><b>{msxMonName(sp)}</b><small style={JA_LABEL_STYLE}>{sp === own ? jaWrap('育てるモンスターと同じ種') : topTxt({ kind: 'base', species: sp })}</small></button>); })}</div>
          <div className="msx-dt-cap" style={{ marginTop: 8 }}>マスモンボックスのモンスター(5体まで)</div>
          {raised.length ? raised.map((m) => { const on = cur && cur.box === m.id; const used = !on && teamBox.includes(m.id); return (
            <button type="button" key={m.id} className={`v-item${on ? ' sel' : ''}`} disabled={!on && boxFull && !used} style={{ padding: '4px 8px', width: '100%' }} onClick={() => onPick({ box: m.id })}>
              <img src={msxMonThumb(m.species)} alt="" style={thumb}/>
              <div>{m.nick || msxMonName(m.species)} {m.rank ? <i className={msxRankCls(m.rank)}>{m.rank}</i> : null}<small>{msxMonName(m.species)}{used ? '・ほかの枠から移す' : ''}</small></div>
              <span className="pr">{on ? '✅ この枠' : '入れる'}</span></button>); })
            : <div className="msx-note">まだいません。育て終えたモンスターが入ります</div>}
        </div>
        <button type="button" className="msx-dt-close" data-msx-slot-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
// この編成が集まりやすいトレーニングの表(2026-11-14 社長「押したら表を出す形に。文字とアイコンを両方」)。来やすさ・効き目は芯の数字
function MsxGatherTable({ members, SUC, onClose }) {
  const RANK = ['1位', '2位', '3位'];
  return (
    <div className="msx-ov msx-fade" data-msx-gather onClick={onClose}>
      <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
        <h3>集まりやすいトレーニング</h3>
        <div className="msx-note">編成のモンスターは、得意な能力(1位〜3位)のトレーニングに来やすい。来ると、そのトレーニングの伸びが上がる</div>
        <div className="msx-dt-body">
          {MSX_STATS.map((k) => {
            const rows = members.map((m) => ({ m, j: Array.isArray(m.top) ? m.top.indexOf(k) : -1 })).filter((x) => x.j >= 0 && x.j < 3).sort((a, b) => a.j - b.j);
            return (
              <div key={k} className="msx-gt-row" data-msx-gather-row={k}>
                <div className="hd"><span className="ic">{msxTrainIcon(k, 1)}</span><b>{msxTrainName(k, 1)}</b><span className="st">{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</span><span className="n">{rows.length}体</span></div>
                {rows.length ? rows.map(({ m, j }, i) => { const ch = typeof SUC.gatherChanceOf === 'function' ? SUC.gatherChanceOf(m)[k] : null; return (
                  <div key={i} className="msx-gt-mon"><img src={msxMonThumb(m.species)} alt=""/><span className="nm">{m.name}</span>
                    <span className="v">得意{RANK[j]}{ch != null ? `・来やすさ${Math.round(ch * 100)}%` : ''}・伸び+{Math.round(m.bonus[k] || 0)}%</span></div>); })
                  : <div className="msx-gt-none">集まりやすいモンスターなし</div>}
              </div>
            );
          })}
        </div>
        <button type="button" className="msx-dt-close" data-msx-gather-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

function MsxStart({ data, SUC, onCancel, onStart, bondLvOf, callNameOf }) {
  const { box, meta, unlocked } = data;
  const unraised = box.mons.filter((m) => !m.raised);
  const raised = box.mons.filter((m) => m.raised);
  const [step, setStep] = useState(0);
  const [scn, setScn] = useState(null); // ストーリー選択(56-monsuc-scenario.jsx)。null のあいだは選ぶ段を出す
  const [tab, setTab] = useState('base');
  const [pick, setPick] = useState(() => ({ base: unlocked[0] || 'Mocchi' }));
  const species = pick.box ? ((box.mons.find((m) => m.id === pick.box) || {}).species || 'Mocchi') : pick.base;
  // 編成: いつもの編成(meta.team)から、保存枠に残っている子だけ。空きはベースモン(育てるモンスターと同じ種 → 解放済みの種の順)
  // 編成の6枠: { box } 保存枠の子 / { base } 選んだベースモン / null 空き(育てる子と別の種のベースモンで埋める)。2026-11-14 社長「ベースモンも選べるように」
  const [teamSlotsSt, setTeamSlotsSt] = useState(() => {
    const own0 = unlocked[0] || 'Mocchi'; let nb = 0;
    const o = (meta.team || []).slice(0, 6).map((t) => {
      if (t && t.box && raised.some((m) => m.id === t.box) && nb < 5) { nb += 1; return { box: t.box }; }
      return t && t.base && unlocked.includes(t.base) && t.base !== own0 ? { base: t.base } : null;
    });
    while (o.length < 6) o.push(null);
    return o;
  });
  const [slotPick, setSlotPick] = useState(null); // ベースモン・保存枠の子を選ぶ窓を開いている枠の番号
  const [gatherOpen, setGatherOpen] = useState(false); // 集まりやすいトレーニングの表
  const teamBox = teamSlotsSt.filter((t) => t && t.box).map((t) => t.box);
  // フレンドから借りた子(回5・オトズレの部品 monsucLendMember の写し)。6枠目に入る
  const [friend, setFriend] = useState(null);
  const [lendList, setLendList] = useState(null); // null | 'loading' | { ok, rows, reason }
  const autoBases = useMemo(() => { const o = unlocked.filter((id) => id !== species); return o.length ? o : [species]; }, [unlocked, species]);
  const team = useMemo(() => {
    const room = friend ? 5 : 6; let ai = 0;
    const list = teamSlotsSt.slice(0, room).map((t) => t || { base: autoBases[(ai++) % autoBases.length], auto: true });
    if (friend) list.push({ friend });
    return list;
  }, [teamSlotsSt, autoBases, friend]);
  const members = useMemo(() => team.map((t) => { const src = t.friend ? t.friend : msxTeamSrc(t, box, species); const m = SUC.memberOf(src); return { ...m, name: src.name, boxId: src.boxId || null, friend: t.friend ? t.friend.friend : null, auto: !!t.auto }; }), [team, box, SUC, species]);
  const openLend = async () => {
    if (typeof monsucLendFriends !== 'function') return;
    setLendList('loading');
    try { const r = await monsucLendFriends(); setLendList(r && typeof r === 'object' ? r : { ok: false, reason: 'server', rows: [] }); } catch (e) { setLendList({ ok: false, reason: 'network', rows: [] }); }
  };
  const [aid, setAid] = useState('mua');
  // β版(56-monsuc-beta.jsx): 選べる助手はみゅあだけ。準備中の助手を押すとみゅあの一言(tut.lock)
  const msxAidOpen = (a) => typeof msxBetaAidOk !== 'function' || msxBetaAidOk(a);
  const [lockTalk, setLockTalk] = useState(0);
  const betaCtx = { callName: callNameOf ? callNameOf('mua') : '', bond: Math.max(1, Number(bondLvOf && bondLvOf('mua')) || 1), mon: msxMonName(species) };
  const [items, setItems] = useState([]);
  const [nick, setNick] = useState('');
  const [colors, setColors] = useState([]);
  const [nameErr, setNameErr] = useState('');
  const aidLv = Math.max(1, Math.min(10, Number(bondLvOf && bondLvOf(aid)) || 1));
  const sc = MSX_SCENARIOS.find((x) => x.aid === aid) || MSX_SCENARIOS[0];

  const next = () => setStep((n) => Math.min(5, n + 1));
  const back = () => (step === 0 ? (typeof MsxScenarioSelect === 'function' ? setScn(null) : onCancel()) : setStep((n) => n - 1));
  const start = () => {
    const name = msxNameGuard(nick || msxMonName(species).slice(0, MSX_NAME_MAX));
    if (!name) { setStep(4); setNameErr('その名前は使えません。ほかの名前にしてね'); return; }
    onStart({ scn: typeof msxScenarioId === 'function' ? msxScenarioId(scn) : 'hero', species, from: pick.box ? { box: pick.box } : { base: species }, team: team.map((t) => (t.friend ? t.friend : msxTeamSrc(t, box, species))), teamSlots: team.filter((t) => !t.friend).map((t) => (t.box ? { box: t.box } : { base: t.base })), aid, aidBondLv: aidLv, items, nick: name, colors,
      friendId: friend && friend.friend ? friend.friend.id : null, baseFill: autoBases[0] || species });
  };

  const apt = msxAptOf(species);
  // はじめの能力・成長の型・ピーク・間合い適性(2026-11-14 社長「ステータスがわからない」「くじで決まるって表現がやだ」)
  const [detail, setDetail] = useState(false);
  const fromMon = pick.box ? box.mons.find((m) => m.id === pick.box) || null : null;
  const growType = fromMon && Number.isInteger(fromMon.gt) ? fromMon.gt : (typeof SUC.speciesType === 'function' ? SUC.speciesType(species) : null);
  const growName = growType != null && typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(growType).name : '—';
  // 合体で生まれたモンスターは、合体で受け継いだ上乗せ込みの能力から始まる(芯の newRun の startSt と同じ)
  const startSt = useMemo(() => (fromMon && fromMon.st && typeof fromMon.st === 'object' && typeof SUC.normStats === 'function' ? SUC.normStats(fromMon.st, species) : typeof SUC.initStats === 'function' ? SUC.initStats(species) : {}), [SUC, species, fromMon]);
  const preview = useMemo(() => msxStartPreview(SUC, species, growType, fromMon && fromMon.aptBase, startSt), [SUC, species, growType, fromMon, startSt]);
  const peakText = preview.peak;
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

  if (scn == null && typeof MsxScenarioSelect === 'function') return <MsxScenarioSelect value={scn} ctx={betaCtx} onBack={onCancel} onNext={(id) => { setScn(id); setStep(0); }}/>;
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
        <div className="msx-dt-hd"><div className="h1">{msxMonName(species)}</div><button type="button" className="msx-dt-more" data-msx-detail-open onClick={() => setDetail(true)}>🔍 くわしく</button></div>
        <div className="v-kv" data-msx-start-type><b>成長の型</b><span><span className="yel">{growName}</span>{peakText ? <span className="msx-dt-sm"> ピーク {peakText}</span> : null}</span></div>
        <div className="sub" style={{ marginTop: 6, color: '#f9a8d4', fontWeight: 900 }}>はじめの能力<span className="msx-dt-sm">(小さい字は素質)</span></div>
        <div className="msx-st6" data-msx-start-stats>{MSX_STATS.map((k, i) => <div key={k}><span className="n">{MSX_STAT_NAME[k]}</span><b>{startSt[k]}</b><i className={apt[i] > 'B' ? 'lo' : ''}>素質 {apt[i]}</i></div>)}</div>
      </div>
      {detail && <MsxMonDetail species={species} name={fromMon && fromMon.nick ? fromMon.nick : msxMonName(species)} sub={fromMon ? '合体で生まれたモンスター' : 'ベースモン'} st={startSt} apt={apt} type={growType} grades={preview.grades} peak={peakText} power={preview.power} rank={preview.rank} onClose={() => setDetail(false)} SUC={SUC}/>}
    </>);
    go = 'このモンスターにする ▶';
  } else if (step === 1) {
    // 保存枠の子は5体まで(6枠目はフレンドの枠)。入れるときは空き → ベースモンの枠の順に置く
    const toggleBox = (id) => setTeamSlotsSt((cur) => {
      const n = cur.slice(); const at = n.findIndex((t) => t && t.box === id);
      if (at >= 0) { n[at] = null; return n; }
      if (n.filter((t) => t && t.box).length >= 5) return cur;
      let i = n.slice(0, 5).findIndex((t) => !t); if (i < 0) i = n.slice(0, 5).findIndex((t) => t && t.base); if (i < 0) return cur;
      n[i] = { box: id }; return n;
    });
    const putSlot = (i, v) => setTeamSlotsSt((cur) => {
      const n = cur.slice();
      if (v && v.box) { const at = n.findIndex((t) => t && t.box === v.box); if (at >= 0) n[at] = null; if (n.filter((t) => t && t.box).length >= 5 && !(n[i] && n[i].box)) return cur; }
      n[i] = v; return n;
    });
    body = (<>
      {/* 説明は短く・言葉の途中で折らない(2026-11-14 社長「文字のはみ出し」) */}
      <div className="v-h">編成の6体<small style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{(typeof jaWrap === 'function' ? jaWrap : (t) => t)('枠を押して選ぶ(マスモンボックスから5体まで・フレンドから1体)。強いモンスターほどよく伸びる')}</small></div>
      <div className="v-slots">
        {members.map((m, i) => (
          <div key={i} className={`v-sl${m.kind === 'base' ? ' base' : ''}${m.friend ? ' fr' : ''}${m.friend ? '' : ' msx-slot-tap'}`} data-msx-slot={i} {...(m.friend ? {} : { role: 'button', tabIndex: 0, onClick: () => setSlotPick(i), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') setSlotPick(i); } })}>
            <span className={`v-pf lg r${m.rank === 'base' ? 'G' : m.rank}${m.kind === 'base' ? ' base' : ''}`}>{(() => { const img = <img src={msxMonThumb(m.species)} alt=""/>; const bm = m.boxId && box && Array.isArray(box.mons) ? box.mons.find((x) => x.id === m.boxId) : null; return bm && bm.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(bm.awake)} small>{img}</MsxKira> : img; })()}</span>
            {m.name} {m.kind !== 'base' && <i className={msxRankCls(m.rank)}>{m.rank}</i>}
            {/* 1項目ずつ途中で折らない(幅320で「🧠かしこさ4% 🎯命中4%」が札の外へ切れていた。2026-11-14 社長「編成の文字のはみ出し」) */}
            <div className="t3">{m.top.slice(0, 2).map((k) => <span key={k}>{`${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]} +${Math.round(m.bonus[k] || 0)}%`}</span>)}</div>
            <div className="bs"><span>親密度 {m.bond0}</span><span>タッグ +{m.tag}%</span></div>
            <div className="ic">{m.kind === 'base' ? (m.auto ? 'ベースモン・✎選ぶ' : 'ベースモン・✎変える') : m.friend ? `借: ${m.friend.name || 'フレンド'}` : '✎変える'}</div>
          </div>
        ))}
      </div>
      <div className="msx-note msx-sl-legend" data-msx-slot-legend>札の見方: 「+4%」はその能力のトレーニングの伸びが上がる分・親密度ははじめの値・タッグは友情タッグのときの伸び</div>
      <button type="button" className="v-card msx-heat-btn" data-msx-gather-open onClick={() => setGatherOpen(true)}><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>この編成が集まりやすいトレーニング<span className="msx-dt-sm"> 押すと表 ▶</span></div>
        <div className="v-heat">{MSX_STATS.map((k, i) => <div key={k} className={heat[i] >= 3 ? 'x3' : heat[i] === 2 ? 'x2' : ''}><span className="hi" aria-hidden="true">{msxTrainIcon(k, 1)}</span>{MSX_STAT_NAME[k]}<b>{heat[i]}体</b></div>)}</div></button>
      <div className="v-card" style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto' }}>
        <div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>マスモンボックスから選ぶ({teamBox.length}/5)</div>
        {/* マスモンを並べる所は、マスモンボックスと同じ顔の升目(ボックス式。2026-11-14 社長) */}
        {raised.length && typeof MsxMmGrid === 'function' ? <MsxMmGrid mons={raised} isOn={(m) => teamBox.includes(m.id)} onPick={(m) => toggleBox(m.id)} attrs={(m) => ({ 'data-msx-team-box': m.id })}/>
          : raised.length ? raised.map((m) => (
          <button type="button" key={m.id} className={`v-item${teamBox.includes(m.id) ? ' sel' : ''}`} style={{ padding: '4px 8px', width: '100%' }} onClick={() => toggleBox(m.id)}>
            {m.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(m.awake)} small><img src={msxMonThumb(m.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/></MsxKira>
              : <img src={msxMonThumb(m.species)} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: 'contain', background: '#0f172a' }}/>}
            <div>{m.nick || msxMonName(m.species)} {m.rank ? <i className={msxRankCls(m.rank)}>{m.rank}</i> : null}<small>{msxMonName(m.species)}{m.awake ? (m.awake >= 2 ? '・超覚醒' : '・覚醒') : ''}</small></div>
            <span className="pr">{teamBox.includes(m.id) ? '✅ 入れている' : '入れる'}</span>
          </button>
        )) : <div className="msx-note" style={{ marginTop: 4 }}>マスモンボックスはまだ空です。上の枠を押すと、入れるベースモンを選べます。育て終えたモンスターは、ここに入ります</div>}
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
    if (slotPick != null) body = (<>{body}<MsxSlotPicker idx={slotPick} cur={team[slotPick]} own={species} unlocked={unlocked} raised={raised} teamBox={teamBox} SUC={SUC}
      onPick={(v) => { putSlot(slotPick, v); setSlotPick(null); }} onClose={() => setSlotPick(null)}/></>);
    if (gatherOpen) body = (<>{body}<MsxGatherTable members={members} SUC={SUC} onClose={() => setGatherOpen(false)}/></>);
  } else if (step === 2) {
    const combo = SUC.TRAIN_COMBO && SUC.TRAIN_COMBO[aid];
    body = (<>
      <div className="v-h">だれの物語で育てる?<small>助手ごとに、筋書き・出来事・トレーニングの組み合わせが変わる</small></div>
      <div className="v-faces">
        {MSX_SCENARIOS.filter((x) => msxAidOpen(x.aid)).map((x) => <button type="button" key={x.aid} className={aid === x.aid ? 'on' : ''} onClick={() => setAid(x.aid)}><img src={msxFace(x.aid)} alt={msxAidName(x.aid)}/></button>)}
        {[...MSX_SCENARIOS.filter((x) => !msxAidOpen(x.aid)).map((x) => x.aid), ...MSX_SOON_AIDS].map((a) => <span key={a} className="lk soon" role="button" tabIndex={0} aria-label={`${msxAidName(a)}(準備中)`} data-msx-soon={a} onClick={() => setLockTalk((n) => n + 1)}><img src={msxFace(a)} alt=""/><b>準備中</b></span>)}
      </div>
      <div className="v-card sel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div className="v-sc"><div className="pic"><img src={msxBody(aid, 'happy')} alt=""/></div><div className="tx">
          <h4><small>シナリオ {sc.no}・{msxAidName(aid)}編</small>{sc.title}</h4>
          <div style={{ marginTop: 4 }}>{sc.lead}</div>
          <div style={{ marginTop: 5 }}><span className="chip on">{sc.tag}</span> <span className="chip p">仲良し度 Lv{aidLv}</span></div></div></div>
        <div className="v-kv"><b>助手の効き</b><span>{sc.perk}</span></div>
        {combo && <div className="v-kv"><b>トレーニングの組み合わせ</b><span>{MSX_STATS.slice(0, 3).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]} → +${combo[k].map((c) => MSX_STAT_ICON[c]).join('+')}`).join(' / ')} …</span></div>}
        <div className="v-kv"><b>はじめの親密度</b><span>{Math.min((SUC.BOND && SUC.BOND.aidStartMax) || 40, aidLv * ((SUC.BOND && SUC.BOND.aidPerLv) || 4))}(仲良し度 Lv{aidLv})。助手もトレーニングに来て、タッグになる</span></div>
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
      <div className="v-h">持ちこみ(2つまで)<small>手に入れた物を、育成に持っていける。持っていかなくてもよい</small></div>
      <div className="v-bag">{[0, 1].map((i) => items[i] ? <div key={i} className="in"><span style={{ fontSize: 24 }}>{MSX_ITEM_BY_ID[items[i]].e}</span><small>{MSX_ITEM_BY_ID[items[i]].name}</small></div> : <div key={i}>＋<small style={{ color: '#94a3b8' }}>空き</small></div>)}</div>
      <div className="v-igrid">
        {MSX_ITEMS.map((t) => (
          <button type="button" key={t.id} className={`${items.includes(t.id) ? 'in' : ''}${t.when === 'both' ? ' bo' : ''}`} onClick={() => toggle(t.id)} disabled={!has(t.id) && !items.includes(t.id)}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.e}</span><i>×{has(t.id)}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode(t.name.replace('ガロエ印の', ''))}</small>{items.includes(t.id) ? <u>✔</u> : null}
          </button>
        ))}
      </div>
      <div className="v-ileg"><span><b className="sw1"/>はじめる前に効く物</span><span><b className="sw2"/>育成中にも使える物(1ターン1個まで)</span></div>
      <div className="msx-scroll" style={{ flex: '1 1 0' }}>
        {items.map((id) => <div key={id} className="v-item sel"><span style={{ fontSize: 22 }}>{MSX_ITEM_BY_ID[id].e}</span><div>{MSX_ITEM_BY_ID[id].name}<small>{msxItemDesc(id)}</small></div><span className="pr">✅ 持っていく・あと{has(id) - 1}</span></div>)}
        {/* 持っている物の効き目も下に並べる(下を空けない。docs/spec/MONSUC_UI.md の 1) */}
        {MSX_ITEMS.filter((t) => has(t.id) > 0 && !items.includes(t.id)).map((t) => <div key={t.id} className="v-item" style={{ opacity: .85 }}><span style={{ fontSize: 22 }}>{t.e}</span><div>{t.name}<small>{msxItemDesc(t.id)}</small></div><span className="pr" style={{ color: '#cbd5e1' }}>×{has(t.id)}</span></div>)}
        {items.some((id) => !coreItems(id)) && <div className="msx-note" style={{ marginTop: 6 }}>まだ効き目が入っていない物があります(その物は持っていっても数は減りません)</div>}
      </div>
    </>);
    go = 'これでいく ▶';
  } else if (step === 4) {
    const onDye = (idx, colorId) => setColors((cur) => { const n = cur.slice(); while (n.length <= idx) n.push(null); n[idx] = colorId; return n; });
    const onCustom = (idx) => { const p = typeof _parseCustomColorId === 'function' ? _parseCustomColorId(colors[idx]) : null; const h = p ? (p.h + 40) % 360 : 200; if (typeof _encodeCustomColorId === 'function') onDye(idx, _encodeCustomColorId(h, 0.7, 0.85)); };
    body = (<>
      <div className="v-h">名前と染色<small>あとからいつでも変えられる</small></div>
      {scene({ mb: '14%', h: '72%' }, <div className="v-chips"><span className="v-chip">成長の型: {growName}</span></div>)}
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
      {typeof msxScenarioOf === 'function' ? <button type="button" className="v-sum" onClick={() => setScn(null)}><span className="k">シナリオ</span><span>{msxScenarioOf(scn).name}</span><span className="ed">変える</span></button> : null}
      <button type="button" className="v-sum" onClick={() => setStep(2)}><span className="k">助手</span><span>{msxAidName(aid)}編「{sc.title}」</span><span className="ed">変える</span></button>
      <button type="button" className="v-sum" onClick={() => setStep(3)}><span className="k">持ちこみ</span><span style={JA_LABEL_STYLE}>{jaWrap(items.length ? items.map((id) => `${MSX_ITEM_BY_ID[id].e}${MSX_ITEM_BY_ID[id].name}`).join('・') : 'なし')}</span><span className="ed">変える</span></button>
      <div className="v-sum"><span className="k">はじめの上乗せ</span><span>{Object.keys(startAdd).length ? `編成から ${Object.entries(startAdd).map(([k, v]) => `${MSX_STAT_NAME[k]} +${v}`).join('・')}` : '編成からの上乗せなし'}</span></div>
      <button type="button" className="v-big" onClick={start}>🌱 育成をはじめる</button>
    </>);
  }
  return (
    <>
      <MsxHd back={step ? '戻る' : 'やめる'} onBack={back} right={`${step + 1} / 6`}/>
      <div className="v-body">
        <MsxSteps n={step}/>
        {body}
      </div>
      {go && <div className="v-ft"><button type="button" onClick={back}>{step ? '← 戻る' : '← やめる'}</button><button type="button" className="go" onClick={next}>{go}</button></div>}
      {typeof MsxBetaTalk === 'function' ? (lockTalk ? <MsxBetaTalk key={`lock${lockTalk}`} keys={['lock']} always ctx={betaCtx} onDone={() => setLockTalk(0)}/> : <MsxBetaTalk keys={['prep']} ctx={betaCtx}/>) : null}
    </>
  );
}
