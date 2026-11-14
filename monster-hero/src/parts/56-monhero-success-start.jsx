// ===== モンヒロサクセス: 始めるまでの6段(育てるモンスター → 編成 → 助手(シナリオ) → 持ちこみ → 名前と染色 → 確認) =====
// 見本: docs/progress/player-raise/mock/png/v3-S.png(S1〜S6)。計算は芯の memberOf / newRun を呼ぶだけ
// 品の名前の折り目: 「の」のあとと、カタカナ語の「ー」のあと(「縁結びの/お守り」「ブリーダー/ライセンス」)。狭い升目で言葉の途中で折れないように(2026-11-14)
// 折り目は「の」「!」のあとと、決まったカタカナの境目だけ(「ー のあと」で区切ると「トレー|ニング」でも折れた。2026-11-14 窓口)
const msxItemNameNode = (name) => String(name || '').split(/(?<=[の!！])(?=.)|(?<=ブリーダー)(?=ライセンス)|(?<=オイリー)(?=パック|オイル)|(?<=野菜)(?=ジュース)|(?<=スタミナ)(?=だんご)/).map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}{x}</React.Fragment>);
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
  { id: 'pack', name: 'オイリーパック', desc: 'オイリーオイル（大）2個と夏美草1個のセット', when: 'both', e: '🧴' },
  // 2026-11-13 社長「持ちこみに、育成中に使えるアイテムも足して」: 詰め合わせの中身を単品でも(芯の ITEMS にある物)
  { id: 'oil', name: 'オイリーオイル（小）', desc: '体力を上限の20%回復', when: 'both', e: '🫙' },
  { id: 'oilyoil', name: 'オイリーオイル（大）', desc: '体力を上限の40%回復', when: 'both', e: '🛢️' },
  { id: 'herb', name: '夏美草', desc: 'ストレスを20下げる', when: 'both', e: '🌱' },
  // 2026-11-13 社長 r1113-038: 覚醒の実・超覚醒の実(使うとその場で起きる。超覚醒の実は覚醒の実の完全な上位互換)
  { id: 'awakeFruit', name: '覚醒の実', desc: 'モンスターの力を引き出すといわれる果実', when: 'both', e: '✨' },
  { id: 'superAwakeFruit', name: '超覚醒の実', desc: 'モンスターの力をさらに引き出すといわれる果実', when: 'both', e: '🌈' },
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
  if (it.awake && S.AWAKE) {
    const A = S.AWAKE; const a1 = `覚醒(全能力 +${A.add[0]}・間合いの適性 ${A.apt[0]}段)`; const a2 = `超覚醒(全能力 +${A.add[1]}・間合いの適性 ${A.apt[1]}段)`;
    if (it.awake === 1) return `育成中に使うと、その場でかならず${a1}。覚醒ずみなら使えない`;
    return `いつ使っても、その場でかならず${a2}。覚醒していなければ、先に${a1}してから超覚醒まで進む(覚醒の実の分も入る)。適性が上がるのは覚醒と合わせて${A.aptMax}段まで`;
  }
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
// 説明は効き目だけ(2026-11-14 社長 r1114-111・113「疲れた体にぬるオイル。」のような前置きはやめる)。よいようすを付ける物は、ようすの名前を頭に付ける
const msxItemDesc = (id) => {
  const t = MSX_ITEM_BY_ID[id]; const fx = msxItemFx(id); if (!fx) return t ? t.desc : '';
  const S = typeof msxSuc !== 'undefined' && msxSuc ? msxSuc.SUC : null; const it = S && S.ITEMS ? S.ITEMS[id] : null; const g = it && it.good && S.GOOD ? S.GOOD[it.good] : null;
  return g ? `ようす「${g.name}」が付く: ${fx}` : fx;
};
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
const msxTeamSrc = (slot, box, own, assist) => {
  // メモリアルモンスター(合体の親・お別れしたモンスター。mh_monsuc_assist_v1)も、マスモンボックスの子と同じ形で編成に入る
  if (slot && slot.assist) { const a = ((assist && assist.mons) || []).find((x) => x.id === slot.assist); if (a) { const t = msxTeamSrc({ box: a.id }, { mons: [a] }, own); return { ...t, boxId: null, assistId: a.id }; } }
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
/* skill-icons:begin(tools/success/build-skill-icons.js が書く) */
const MSX_SKILL_ICONS = new Set([
'images/success/skill/sk-0001.png','images/success/skill/sk-0002.png','images/success/skill/sk-0003.png','images/success/skill/sk-0004.png','images/success/skill/sk-0005.png','images/success/skill/sk-0008.png','images/success/skill/sk-0009.png','images/success/skill/sk-0010.png','images/success/skill/sk-0015.png','images/success/skill/sk-0016.png','images/success/skill/sk-0017.png','images/success/skill/sk-0018.png','images/success/skill/sk-0023.png','images/success/skill/sk-0025.png','images/success/skill/sk-0026.png','images/success/skill/sk-0027.png','images/success/skill/sk-0028.png','images/success/skill/sk-0035.png','images/success/skill/sk-0036.png','images/success/skill/sk-0037.png','images/success/skill/sk-0039.png','images/success/skill/sk-0040.png','images/success/skill/sk-0041.png','images/success/skill/sk-0042.png','images/success/skill/sk-0043.png','images/success/skill/sk-0044.png','images/success/skill/sk-0045.png','images/success/skill/sk-0046.png','images/success/skill/sk-0047.png','images/success/skill/sk-0048.png','images/success/skill/sk-0049.png','images/success/skill/sk-0050.png','images/success/skill/sk-0051.png','images/success/skill/sk-0052.png','images/success/skill/sk-0053.png','images/success/skill/sk-0054.png','images/success/skill/sk-0055.png','images/success/skill/sk-0064.png','images/success/skill/sk-0065.png','images/success/skill/sk-0066.png','images/success/skill/sk-0067.png','images/success/skill/sk-0068.png','images/success/skill/sk-0069.png','images/success/skill/sk-0070.png','images/success/skill/sk-0071.png','images/success/skill/sk-0072.png','images/success/skill/sk-0073.png','images/success/skill/sk-0074.png','images/success/skill/sk-0075.png','images/success/skill/sk-0076.png','images/success/skill/sk-0077.png','images/success/skill/sk-0078.png','images/success/skill/sk-0079.png','images/success/skill/sk-0080.png','images/success/skill/sk-0082.png','images/success/skill/sk-0083.png','images/success/skill/sk-0084.png','images/success/skill/sk-0110.png','images/success/skill/sk-0111.png','images/success/skill/sk-0112.png','images/success/skill/sk-0113.png','images/success/skill/sk-0114.png','images/success/skill/sk-0115.png','images/success/skill/sk-0116.png','images/success/skill/sk-0117.png','images/success/skill/sk-0118.png','images/success/skill/sk-0119.png','images/success/skill/sk-0120.png','images/success/skill/sk-0121.png','images/success/skill/sk-0122.png','images/success/skill/sk-0123.png','images/success/skill/sk-0124.png','images/success/skill/sk-0125.png','images/success/skill/sk-0129.png','images/success/skill/sk-0258.png','images/success/skill/sk-0259.png','images/success/skill/sk-0260.png','images/success/skill/sk-0261.png','images/success/skill/sk-0262.png','images/success/skill/sk-0263.png','images/success/skill/sk-0264.png','images/success/skill/sk-0265.png','images/success/skill/sk-0266.png','images/success/skill/sk-0267.png','images/success/skill/sk-0268.png','images/success/skill/sk-0269.png','images/success/skill/sk-0270.png','images/success/skill/sk-0271.png','images/success/skill/sk-0272.png','images/success/skill/sk-0273.png','images/success/skill/sk-0274.png','images/success/skill/sk-0292.png','images/success/skill/sk-0293.png','images/success/skill/sk-0294.png','images/success/skill/sk-0295.png','images/success/skill/sk-0296.png','images/success/skill/sk-0297.png','images/success/skill/sk-0298.png','images/success/skill/sk-0299.png','images/success/skill/sk-0300.png','images/success/skill/sk-0301.png','images/success/skill/sk-0302.png','images/success/skill/sk-0303.png','images/success/skill/sk-0304.png','images/success/skill/sk-0305.png','images/success/skill/sk-0306.png','images/success/skill/sk-0307.png','images/success/skill/sk-0338.png','images/success/skill/sk-0339.png','images/success/skill/sk-0340.png','images/success/skill/sk-0341.png','images/success/skill/sk-0342.png','images/success/skill/sk-0343.png','images/success/skill/sk-0344.png','images/success/skill/sk-0345.png','images/success/skill/sk-0346.png','images/success/skill/sk-0347.png','images/success/skill/sk-0348.png','images/success/skill/sk-0349.png','images/success/skill/sk-0350.png','images/success/skill/sk-0351.png','images/success/skill/sk-0384.png','images/success/skill/sk-0385.png','images/success/skill/sk-0386.png','images/success/skill/sk-0387.png','images/success/skill/sk-0388.png','images/success/skill/sk-0389.png','images/success/skill/sk-0390.png','images/success/skill/sk-0391.png','images/success/skill/sk-0392.png','images/success/skill/sk-0393.png','images/success/skill/sk-0394.png','images/success/skill/sk-0395.png','images/success/skill/sk-0396.png','images/success/skill/sk-0397.png','images/success/skill/sk-0398.png','images/success/skill/sk-0399.png','images/success/skill/sk-0400.png','images/success/skill/sk-0401.png','images/success/skill/sk-0402.png','images/success/skill/sk-0403.png','images/success/skill/sk-0404.png','images/success/skill/sk-0405.png','images/success/skill/sk-0406.png','images/success/skill/sk-0407.png','images/success/skill/sk-0408.png','images/success/skill/sk-0409.png','images/success/skill/sk-0410.png','images/success/skill/sk-0411.png','images/success/skill/sk-0412.png','images/success/skill/sk-0413.png','images/success/skill/sk-0414.png','images/success/skill/sk-0415.png','images/success/skill/sk-0416.png','images/success/skill/sk-0446.png','images/success/skill/sk-0447.png','images/success/skill/sk-0448.png','images/success/skill/sk-0449.png','images/success/skill/sk-0450.png','images/success/skill/sk-0451.png','images/success/skill/sk-0452.png','images/success/skill/sk-0453.png','images/success/skill/sk-0454.png','images/success/skill/sk-0455.png','images/success/skill/sk-0456.png','images/success/skill/sk-0457.png','images/success/skill/sk-0458.png','images/success/skill/sk-0459.png','images/success/skill/sk-0460.png','images/success/skill/sk-0461.png','images/success/skill/sk-0462.png','images/success/skill/sk-0463.png','images/success/skill/sk-0464.png','images/success/skill/sk-0465.png','images/success/skill/sk-0466.png','images/success/skill/sk-0467.png','images/success/skill/sk-0468.png','images/success/skill/sk-0469.png','images/success/skill/sk-0470.png','images/success/skill/sk-0471.png','images/success/skill/sk-0472.png','images/success/skill/sk-0473.png','images/success/skill/sk-0474.png','images/success/skill/sk-0475.png','images/success/skill/sk-0476.png','images/success/skill/sk-0477.png','images/success/skill/sk-0478.png','images/success/skill/sk-0479.png','images/success/skill/sk-0480.png','images/success/skill/sk-0481.png','images/success/skill/sk-0482.png','images/success/skill/sk-0483.png','images/success/skill/sk-0484.png','images/success/skill/sk-0485.png','images/success/skill/sk-0486.png','images/success/skill/sk-0487.png','images/success/skill/sk-0488.png','images/success/skill/sk-0489.png','images/success/skill/sk-0490.png','images/success/skill/sk-0491.png','images/success/skill/sk-0496.png','images/success/skill/sk-0511.png','images/success/skill/sk-0512.png','images/success/skill/sk-0513.png','images/success/skill/sk-0514.png','images/success/skill/sk-0515.png','images/success/skill/sk-0516.png','images/success/skill/sk-0517.png','images/success/skill/sk-0518.png','images/success/skill/sk-0519.png','images/success/skill/sk-0520.png','images/success/skill/sk-0521.png','images/success/skill/sk-0522.png','images/success/skill/sk-0523.png','images/success/skill/sk-0524.png','images/success/skill/sk-0525.png','images/success/skill/sk-0526.png','images/success/skill/sk-0573.png','images/success/skill/sk-0574.png','images/success/skill/sk-0575.png','images/success/skill/sk-0576.png','images/success/skill/sk-0577.png','images/success/skill/sk-0578.png','images/success/skill/sk-0579.png','images/success/skill/sk-0580.png','images/success/skill/sk-0581.png','images/success/skill/sk-0582.png','images/success/skill/sk-0583.png','images/success/skill/sk-0584.png','images/success/skill/sk-0585.png','images/success/skill/sk-0586.png','images/success/skill/sk-0587.png','images/success/skill/sk-0588.png','images/success/skill/sk-0589.png','images/success/skill/sk-0590.png','images/success/skill/sk-0591.png','images/success/skill/sk-0592.png','images/success/skill/sk-0593.png','images/success/skill/sk-0594.png','images/success/skill/sk-0595.png','images/success/skill/sk-0596.png','images/success/skill/sk-0597.png','images/success/skill/sk-0598.png','images/success/skill/sk-0599.png','images/success/skill/sk-0742.png','images/success/skill/sk-0743.png','images/success/skill/sk-0744.png','images/success/skill/sk-0785.png','images/success/skill/sk-0787.png','images/success/skill/sk-0788.png','images/success/skill/sk-0797.png','images/success/skill/sk-0798.png','images/success/skill/sk-0799.png','images/success/skill/sk-0824.png']);
/* skill-icons:end */
// 技の升の絵(2026-11-14 社長「力で剣はいいね」「ランク帯で色を変えて」): ちから技=剣・かしこさ技=本の単色の形を、技のランク1〜5の色(銅・銀・金・紫・虹)で塗る。升の地の色(ちから=金・かしこさ=緑)は変えない。
//   升の地と同じ色にならないよう、形のまわりを暗い線で縁取る
const MSX_TG_RANK_COL = Object.freeze({ 1: ['#e9a46a', '#a95f27'], 2: ['#f4f7fb', '#aab4c2'], 3: ['#fff1a6', '#f2b705'], 4: ['#d9a8ff', '#8a3ffc'] });
const MSX_TG_RANK_NAME = Object.freeze({ 1: '銅', 2: '銀', 3: '金', 4: '紫', 5: '虹' });
// 技の絵(2026-11-15 社長 r1115-003「技の絵は資料の技アイコンへ」): 資料の絵がある技は images/success/skill/sk-####.png。
//   資料に無い技(オリジナルの子・オリジナル技)は、資料の絵にならった影絵(同じ灰色の枠・ちから技=黄・かしこさ技=緑の単色)を間合いごとの形で描く。
//   82×82 の元絵は右下に消費ガッツの数字が焼き込まれているので、升の右下の数字の札(.g)でかぶせる
const MSX_SHADOW_PATHS = Object.freeze({
  pow: [
    <g key="p0"><path d="M22 38h30a10 10 0 0 1 10 10v16a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10z"/><path d="M66 30l14-8-6 16 16 4-16 8 8 16-16-8z"/></g>,
    <g key="p1"><path d="M16 74Q40 14 82 20Q54 32 44 76z"/><path d="M30 82Q56 50 88 44Q66 62 56 84z"/></g>,
    <g key="p2"><path d="M26 28Q58 48 26 68" fill="none" strokeWidth="9" strokeLinecap="round"/><path d="M44 20Q86 48 44 76" fill="none" strokeWidth="9" strokeLinecap="round"/><circle cx="20" cy="48" r="8"/></g>,
    <g key="p3"><path d="M10 56h46V42l30 20-30 20V68H10z"/><path d="M14 36h30M20 90h30" fill="none" strokeWidth="6" strokeLinecap="round"/></g>,
  ],
  wise: [
    <g key="w0"><path d="M48 52C48 44 58 44 58 52C58 64 40 64 40 48C40 30 66 30 66 52C66 76 32 76 32 46C32 18 72 18 72 52" fill="none" strokeWidth="7" strokeLinecap="round"/></g>,
    <g key="w1"><path d="M56 10L26 54h20L36 86l34-48H50z"/></g>,
    <g key="w2"><circle cx="48" cy="48" r="30" fill="none" strokeWidth="6"/><path d="M48 22l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/></g>,
    <g key="w3"><circle cx="68" cy="30" r="13"/><path d="M60 40L12 86l24-30-16 8 34-32z"/></g>,
  ],
});
const msxSkillIconPath = (id) => ['images/success/skill', `${id}.png`].join('/'); // パスを部品で組む(画像の検査が ${} の入った文字を実在しない絵と読むため)
function MsxSkillArt({ t, uid = '' }) {
  if (t && MSX_SKILL_ICONS.has(msxSkillIconPath(t.id))) return <img className="tg-img" src={msxSkillIconPath(t.id)} alt="" draggable="false" loading="lazy"/>;
  const kind = t && t.kind === 'wise' ? 'wise' : 'pow'; const d = Math.max(0, Math.min(3, Math.min(...(t && Array.isArray(t.dist) && t.dist.length ? t.dist : [1]))));
  const gid = `tgs-${uid}${t ? t.id : ''}`; const fill = kind === 'wise' ? '#34c46a' : '#f5b81b'; const ink = kind === 'wise' ? '#14653a' : '#8a5a06';
  return (
    <svg className="tg-img tg-shadow" viewBox="0 0 96 96" aria-hidden="true" focusable="false" data-tg-shadow={`${kind}${d}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecebef"/><stop offset="1" stopColor="#c3c0c8"/></linearGradient></defs>
      <rect x="2" y="2" width="92" height="92" rx="8" fill={`url(#${gid})`} stroke="#8e8b95" strokeWidth="2"/>
      <path d="M2 70h92v16a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8z" fill="#00000014"/>
      <g fill={fill} stroke={fill === '#f5b81b' ? ink : ink} strokeWidth="3" strokeLinejoin="round" transform="translate(0 -4)">{MSX_SHADOW_PATHS[kind][d]}</g>
    </svg>
  );
}
const MSX_DIST_NAMES = ['零', '近', '中', '遠'];
const MSX_TG_COLS = Object.freeze([3, 2, 1, 0]); // 技の升目の列の並び(参考どおり左から 遠・中・近・零)
// まだ覚えていない技の覚え方(技表の learn: { start } / { by:修行の系統, st:{ 能力: 数 } })
// 例: 修行で覚える(かしこさ150以上・ガッチョの熟練25)。前の技の名前は同じ種の技表から引く(無ければ「前の技」)
const msxTechHow = (t, all = []) => {
  const L = t && t.learn; if (!L) return '修行で覚える';
  if (L.start) return 'はじめから';
  const st = L.st && typeof L.st === 'object' ? Object.entries(L.st).map(([k, v]) => `${MSX_STAT_NAME[k] || k}${v}以上`) : [];
  const nd = L.need && typeof L.need === 'object' ? Object.entries(L.need).map(([id, v]) => `${((Array.isArray(all) ? all : []).find((x) => x && x.id === id) || {}).name || '前の技'}の熟練${v}`) : [];
  const parts = [...st, ...nd];
  return parts.length ? `修行で覚える(${parts.join('・')})` : '修行で覚える';
};
const msxLineName = (id) => (id && typeof MONSTER_LINEAGES === 'object' && MONSTER_LINEAGES && MONSTER_LINEAGES[id] ? MONSTER_LINEAGES[id].name : '');
// モンスターの詳細(2026-11-14 社長の手本 monster-detail-basic の組み立て: 左上に絵・名前・総合力/右上に 基礎・特徴・適性/下に技の一覧と選んだ技の詳細)。
//   見るだけ。選ぶ画面の「くわしく」と、育成中の場面の「くわしく」で同じ部品を使う。絵・用語・見た目はうちの物
//   st 能力6つ / apt 素質の字(画面の呼び名。2026-11-14 社長「伸びは素質って表記にして」) / type 成長の型 / peak ピークの期 / grades 間合い適性 [零,近,中,遠] / known 覚えている技の id(無ければ はじめから使える技) / power・rank 総合力
const MSX_STAT_COLOR = Object.freeze({ life: '#facc15', pow: '#f87171', wise: '#4ade80', hit: '#f472b6', eva: '#60a5fa', tough: '#818cf8' });
// pick … 被った升で覚える技を選べるとき { sel: { 升: 技id }, locked: (升) => 覚えたあとで変えられないか, onPick: (升, 技id) => void }(無ければ見るだけ)
// head … 名前の横に置く物(マスモンボックスのハート・✏)/ more … 特徴のタブの下に足す行 [[見出し, 中身], …] / foot … 「とじる」の上に置くボタン(貸し出し・お別れ)/ grade … 総合力の横の評価(A2 など)
function MsxMonDetail({ species, name, art, st, apt, type, peak, grades, known, power, rank, sub, onClose, SUC, head = null, more = null, foot = null, grade: gradeLabel = null, pick = null }) {
  const [tab, setTab] = useState('base');
  const [pickCell, setPickCell] = useState(null); // 技を選ぶ窓を開いている升(pick があるときだけ)
  const line = typeof MONSTER_LINEAGE_MAP === 'object' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP[species] : null;
  const main = line ? msxLineName(line.main) : ''; const subL = line ? msxLineName(line.sub || line.main) : '';
  const dex = typeof MONSTER_DEX_DESCRIPTIONS === 'object' && MONSTER_DEX_DESCRIPTIONS && MONSTER_DEX_DESCRIPTIONS[species];
  const typeName = type != null && typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(type).name : '—';
  const all = typeof SUC.techsOf === 'function' ? SUC.techsOf(species).filter(Boolean) : [];
  // 「はじめから」の技は、覚えた技の一覧(known)に載っていなくても常に覚えている扱い(2026-11-14 スネグーラチカで「はじめから」なのに「まだ覚えていない」と出た食い違いの対策)
  const has = (t) => !!(t.learn && t.learn.start) || (Array.isArray(known) && known.includes(t.id));
  const list = all.slice().sort((x, y) => (has(y) - has(x)) || (Number(x.rank) || 0) - (Number(y.rank) || 0));
  // 升目は 間合い(4列)×ランク(上から 1〜5 の5段固定)で、1升に1技(2026-11-14 社長「段=ランク」「1升に1技」)。
  //   同じ間合い・同じランクに技が2つ以上ある升は、並びの1つ目(または選んだ技)を出し、右上に「⇄」(選べる印)を付ける。そのランクの技が無い升は ×
  const tgAt = (r, d) => all.filter((t) => (Number(t.rank) || 1) === r && Array.isArray(t.dist) && t.dist.includes(d));
  const tgLines = [1, 2, 3, 4, 5];
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
                {tgLines.map((r) => MSX_TG_COLS.map((d) => { const alts = tgAt(r, d); const cellK = `${r}-${d}`;
                  // 升に出す技: 覚えた技があればそれ → 選んだ技 → 並びの1つ目
                  const t = alts.find(has) || alts.find((x) => pick && pick.sel && pick.sel[cellK] === x.id) || alts[0];
                  if (!t) return <span key={`${r}-${d}`} className="no" aria-hidden="true">×</span>;
                  const got = has(t); const canAlt = !!pick && alts.length > 1;
                  // 技の種類で升の色を分ける(参考どおり ちから=金・かしこさ=緑)。覚えていない技も絵を出し、升の地を暗くして見分ける(2026-11-14 社長「鍵じゃなくて覚えてないやつも表示して色分けして」)。
                  // 覚える条件の数は升に出さず、押したときの右の「覚え方」に出す(社長「150とかその数字何?」→ 升目から消す)
                  return <button type="button" key={`${r}-${d}`} className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'}${got ? ' got' : ' tg-not'}${tech && tech.id === t.id ? ' on' : ''}`} data-msx-tech={t.id} data-msx-cell={cellK} aria-label={`${t.name}${got ? '' : '(まだ覚えていない)'}${canAlt ? '(選べる技が' + alts.length + 'つ)' : ''}`} onClick={() => setPickT(t.id)}>
                    <span className="ti" aria-hidden="true"><MsxSkillArt t={t} uid={`${r}${d}`}/></span><span className={`tg-rk rk${Math.max(1, Math.min(5, Number(t.rank) || 1))}`} aria-hidden="true">{Math.max(1, Math.min(5, Number(t.rank) || 1))}</span><span className="g">{t.guts}</span>{canAlt ? <span className="tg-alt" role="button" aria-label="覚える技を選ぶ" data-msx-alt={cellK} onClick={(e) => { e.stopPropagation(); setPickCell(cellK); }}>⇄</span> : null}</button>; }))}
              </div>
              {tech ? (<div className="msx-md-td">
                <div className="tn">{tech.name}{has(tech) ? null : <small className="msx-md-not">まだ覚えていない</small>}</div>
                <div className="msx-md-kv"><b>技種</b><span>{tech.kind === 'wise' ? 'かしこさ' : 'ちから'}</span></div>
                <div className="msx-md-kv"><b>消費ガッツ</b><span>{tech.guts}</span></div>
                <div className="msx-md-kv"><b>ダメージ</b><span className="gd">{grade('power', tech.power)}</span></div>
                <div className="msx-md-kv"><b>命中率</b><span className="gd">{grade('hit', tech.hit)}</span></div>
                <div className="msx-md-kv"><b>ガッツダウン</b><span className="gd">{grade('gd', tech.gd)}</span></div>
                <div className="msx-md-kv"><b>クリティカル率</b><span className="gd">{grade('crit', tech.crit)}</span></div>
                <div className="msx-md-kv msx-md-howrow"><b>覚え方</b><span>{has(tech) ? (Array.isArray(known) ? '覚えている' : 'はじめから') : (() => { const how = msxTechHow(tech, all); return how.startsWith('修行で覚える(') ? <>修行で覚える<small className="msx-md-how">{how.slice('修行で覚える'.length)}</small></> : how; })()}</span></div>
                {pick && tgAt(tech.rank, Math.min(...(tech.dist || [1]))).length > 1 ? <button type="button" className="msx-md-alt" data-msx-alt-open onClick={() => setPickCell(`${tech.rank}-${Math.min(...(tech.dist || [1]))}`)}>⇄ 覚える技を選ぶ</button> : null}
              </div>) : null}
            </div>
          </div>
        </div>
        {pick && pickCell ? (() => { const [pr, pd] = pickCell.split('-').map(Number); const alts = tgAt(pr, pd); const lock = !!pick.locked(pickCell); const cur = alts.find(has) || alts.find((x) => pick.sel && pick.sel[pickCell] === x.id) || alts[0];
          return (<div className="msx-ov msx-fade" data-msx-techpick onClick={(e) => { e.stopPropagation(); setPickCell(null); }}>
            <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
              <h3>覚える技を選ぶ</h3>
              <div className="msx-note msx-kp">{msxPh(`${MSX_DIST_NAMES[pd]}の間合い・ランク${pr}。｜${lock ? 'この升の技は｜もう覚えたので、｜選び直せません' : '選ばなかった技は、｜この升では｜覚えません。｜覚えるまでは｜選び直せます'}`)}</div>
              <div className="msx-dt-body">{alts.map((t) => { const on = cur && cur.id === t.id; const how = has(t) ? '覚えている' : msxTechHow(t, all); return (
                <button type="button" key={t.id} className={`msx-tp${on ? ' on' : ''}`} disabled={lock && !on} data-msx-techpick-opt={t.id} onClick={() => { if (!lock) { pick.onPick(pickCell, t.id); setPickT(t.id); setPickCell(null); } }}>
                  <span className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'}${has(t) ? ' got' : ' tg-not'}`}><span className="ti" aria-hidden="true"><MsxSkillArt t={t} uid="p"/></span></span>
                  <span className="tpb"><b>{t.name}</b><small>{t.kind === 'wise' ? 'かしこさ' : 'ちから'}・消費ガッツ {t.guts}</small>
                    <small className="tp-nb"><i>ダメージ {grade('power', t.power)}</i><i>命中率 {grade('hit', t.hit)}</i><i>クリティカル率 {grade('crit', t.crit)}</i></small><small className="tp-nb">{how.startsWith('修行で覚える(') ? <><i>修行で覚える</i><i>{how.slice('修行で覚える'.length)}</i></> : <i>{how}</i>}</small></span>
                  <span className="tpm">{on ? '✅ 選択中' : '選ぶ'}</span></button>); })}</div>
              <button type="button" className="msx-dt-close" data-msx-techpick-close onClick={() => setPickCell(null)}>閉じる</button>
            </div></div>); })() : null}
        {foot ? <div className="msx-md-foot">{foot}</div> : null}
        <button type="button" className="msx-dt-close" data-msx-detail-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

// 編成の1枠に入れるモンスターを選ぶ窓(ベースモン・保存枠の子)。2026-11-14 社長「編成ってベースモンからかマスモンからじゃないの?」
function MsxSlotPicker({ idx, cur, own, unlocked, raised, stock = [], teamBox, teamRaisedN, SUC, onPick, onClose }) {
  const thumb = { width: 34, height: 34, borderRadius: 9, objectFit: 'contain', background: '#0f172a' };
  const topTxt = (src) => { try { const m = SUC.memberOf(src); return m.top.slice(0, 2).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]}`).join(' '); } catch (e) { return ''; } };
  const boxFull = (Number.isFinite(teamRaisedN) ? teamRaisedN : teamBox.length) >= 5 && !(cur && (cur.box || cur.assist));
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
          {stock.length ? (<>
            <div className="msx-dt-cap" style={{ marginTop: 8 }}>メモリアルモンスター(育成には使えません)</div>
            {stock.map((m) => { const on = cur && cur.assist === m.id; return (
              <button type="button" key={m.id} className={`v-item${on ? ' sel' : ''}`} disabled={!on && boxFull} style={{ padding: '4px 8px', width: '100%' }} data-msx-pick-assist={m.id} onClick={() => onPick({ assist: m.id })}>
                <img src={msxMonThumb(m.species)} alt="" style={thumb}/>
                <div>{m.nick || msxMonName(m.species)} {m.rank ? <i className={msxRankCls(m.rank)}>{m.rank}</i> : null}<small>{msxMonName(m.species)}・メモモン</small></div>
                <span className="pr">{on ? '✅ この枠' : '入れる'}</span></button>); })}
          </>) : null}
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
  const stock = (data.assist && Array.isArray(data.assist.mons)) ? data.assist.mons : []; // メモリアルモンスター(育成には使えない・編成にだけ入る)
  const unraised = box.mons.filter((m) => !m.raised);
  const raised = box.mons.filter((m) => m.raised);
  const [step, setStep] = useState(0);
  const [scn, setScn] = useState(null); // ストーリー選択(56-monsuc-scenario.jsx)。null のあいだは選ぶ段を出す
  const [tab, setTab] = useState('base');
  const [look, setLook] = useState(null); // 持ちこみの段: 押した升目(持っていない物も)。下の説明の欄に出す(2026-11-14 社長「オイルって何?」)
  // 小さい画面・横では説明の欄が升目の下に隠れるので、押したら欄が見える所まで送る
  //   scrollIntoView は使わない(横も動かしてしまう。viewport-height-check)。縦にスクロールする親を内側から順に、欄が見える所まで動かす
  useEffect(() => {
    if (!look || typeof document === 'undefined') return;
    const el = document.querySelector('[data-msx-carry-look]'); if (!el) return;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY; if (!(oy === 'auto' || oy === 'scroll') || p.scrollHeight <= p.clientHeight + 1) continue;
      const r = el.getBoundingClientRect(); const pr = p.getBoundingClientRect();
      if (r.bottom > pr.bottom) p.scrollTop += Math.min(r.bottom - pr.bottom + 8, r.top - pr.top); else if (r.top < pr.top) p.scrollTop -= pr.top - r.top + 8;
    }
  }, [look]);
  const [pick, setPick] = useState(() => ({ base: unlocked[0] || 'Mocchi' }));
  const species = pick.box ? ((box.mons.find((m) => m.id === pick.box) || {}).species || 'Mocchi') : pick.base;
  // 編成: いつもの編成(meta.team)から、保存枠に残っている子だけ。空きはベースモン(育てるモンスターと同じ種 → 解放済みの種の順)
  // 編成の6枠: { box } 保存枠の子 / { base } 選んだベースモン / null 空き(育てる子と別の種のベースモンで埋める)。2026-11-14 社長「ベースモンも選べるように」
  const [teamSlotsSt, setTeamSlotsSt] = useState(() => {
    const own0 = unlocked[0] || 'Mocchi'; let nb = 0;
    const o = (meta.team || []).slice(0, 6).map((t) => {
      if (t && t.box && raised.some((m) => m.id === t.box) && nb < 5) { nb += 1; return { box: t.box }; }
      if (t && t.assist && stock.some((m) => m.id === t.assist) && nb < 5) { nb += 1; return { assist: t.assist }; }
      return t && t.base && unlocked.includes(t.base) && t.base !== own0 ? { base: t.base } : null;
    });
    while (o.length < 6) o.push(null);
    return o;
  });
  const [slotPick, setSlotPick] = useState(null); // ベースモン・保存枠の子を選ぶ窓を開いている枠の番号
  const [gatherOpen, setGatherOpen] = useState(false); // 集まりやすいトレーニングの表
  const teamBox = teamSlotsSt.filter((t) => t && t.box).map((t) => t.box);
  const teamAssist = teamSlotsSt.filter((t) => t && t.assist).map((t) => t.assist);
  const teamRaisedN = teamBox.length + teamAssist.length; // 6枠のうち、育てた子(マスモンボックス・アシスト用)は5体まで
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
  const members = useMemo(() => team.map((t) => { const src = t.friend ? t.friend : msxTeamSrc(t, box, species, data.assist); const m = SUC.memberOf(src); return { ...m, name: src.name, boxId: src.boxId || null, assistId: src.assistId || null, friend: t.friend ? t.friend.friend : null, auto: !!t.auto }; }), [team, box, SUC, species, data.assist]);
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
    onStart({ scn: typeof msxScenarioId === 'function' ? msxScenarioId(scn) : 'hero', species, techPick: tpSel, from: pick.box ? { box: pick.box } : { base: species }, team: team.map((t) => (t.friend ? t.friend : msxTeamSrc(t, box, species, data.assist))), teamSlots: team.filter((t) => !t.friend).map((t) => (t.box ? { box: t.box } : t.assist ? { assist: t.assist } : { base: t.base })), aid, aidBondLv: aidLv, items, nick: name, colors,
      friendId: friend && friend.friend ? friend.friend.id : null, baseFill: autoBases[0] || species });
  };

  const apt = msxAptOf(species);
  // はじめの能力・成長の型・ピーク・間合い適性(2026-11-14 社長「ステータスがわからない」「くじで決まるって表現がやだ」)
  const [detail, setDetail] = useState(false);
  // 被った升で覚える技の選び(新しいキー mh_monsuc_techpick_v1)。ベースモンは種族ごと・合体で生まれた子は箱の子ごとに持つ
  const [tpAll, setTpAll] = useState(null);
  useEffect(() => { let on = true; msxReadTechPick().then((t) => { if (on) setTpAll(t); }).catch(() => { if (on) setTpAll(msxNormTechPick(null)); }); return () => { on = false; }; }, []);
  const fromMon = pick.box ? box.mons.find((m) => m.id === pick.box) || null : null;
  // 合体で生まれた子は、合体のときに決めた名前(親と同じ種族なら親の名前)を最初から入れておく。ここで変えられる(2026-11-14 社長 r1114-126)
  useEffect(() => { setNick(fromMon && typeof fromMon.nick === 'string' ? fromMon.nick.slice(0, MSX_NAME_MAX) : ''); setNameErr(''); }, [pick.box]);
  const growType = fromMon && Number.isInteger(fromMon.gt) ? fromMon.gt : (typeof SUC.speciesType === 'function' ? SUC.speciesType(species) : null);
  const tpKind = fromMon ? 'mon' : 'base'; const tpKey = fromMon ? fromMon.id : species;
  const tpSel = typeof SUC.techPickNorm === 'function' ? SUC.techPickNorm(tpAll && tpAll[tpKind] ? tpAll[tpKind][tpKey] : null, species) : {};
  const onTechPick = async (cell, id) => { const next = { ...tpSel, [cell]: id }; try { setTpAll(await msxWriteTechPick(tpKind, tpKey, next)); } catch (e) { /* 書けなくても今回の育成には使う */ } setTpAll((cur) => { const c = cur || msxNormTechPick(null); return { ...c, [tpKind]: { ...c[tpKind], [tpKey]: next } }; }); };
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
      {detail && <MsxMonDetail pick={{ sel: tpSel, locked: () => false, onPick: onTechPick }} species={species} name={fromMon && fromMon.nick ? fromMon.nick : msxMonName(species)} sub={fromMon ? '合体で生まれたモンスター' : 'ベースモン'} st={startSt} apt={apt} type={growType} grades={preview.grades} peak={peakText} power={preview.power} rank={preview.rank} onClose={() => setDetail(false)} SUC={SUC}/>}
    </>);
    go = 'このモンスターにする ▶';
  } else if (step === 1) {
    // 保存枠の子は5体まで(6枠目はフレンドの枠)。入れるときは空き → ベースモンの枠の順に置く
    const toggleBox = (id) => setTeamSlotsSt((cur) => {
      const n = cur.slice(); const at = n.findIndex((t) => t && t.box === id);
      if (at >= 0) { n[at] = null; return n; }
      if (n.filter((t) => t && (t.box || t.assist)).length >= 5) return cur;
      let i = n.slice(0, 5).findIndex((t) => !t); if (i < 0) i = n.slice(0, 5).findIndex((t) => t && t.base); if (i < 0) return cur;
      n[i] = { box: id }; return n;
    });
    const toggleAssist = (id) => setTeamSlotsSt((cur) => {
      const n = cur.slice(); const at = n.findIndex((t) => t && t.assist === id);
      if (at >= 0) { n[at] = null; return n; }
      if (n.filter((t) => t && (t.box || t.assist)).length >= 5) return cur;
      let i = n.slice(0, 5).findIndex((t) => !t); if (i < 0) i = n.slice(0, 5).findIndex((t) => t && t.base); if (i < 0) return cur;
      n[i] = { assist: id }; return n;
    });
    const putSlot = (i, v) => setTeamSlotsSt((cur) => {
      const n = cur.slice();
      if (v && v.box) { const at = n.findIndex((t) => t && t.box === v.box); if (at >= 0) n[at] = null; if (n.filter((t) => t && (t.box || t.assist)).length >= 5 && !(n[i] && (n[i].box || n[i].assist))) return cur; }
      if (v && v.assist) { const at = n.findIndex((t) => t && t.assist === v.assist); if (at >= 0) n[at] = null; if (n.filter((t) => t && (t.box || t.assist)).length >= 5 && !(n[i] && (n[i].box || n[i].assist))) return cur; }
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
        <div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>マスモンボックスから選ぶ({teamRaisedN}/5)</div>
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
        {/* メモリアルモンスター(合体の親・お別れしたモンスター)。育成には使えない。ここでは編成にだけ入れられる(2026-11-14 社長) */}
        {stock.length ? (<>
          <div className="sub" style={{ color: '#a5b4fc', fontWeight: 900, marginTop: 8 }} data-msx-assist-head>メモリアルモンスターから選ぶ({stock.length}/100)</div>
          <div className="msx-note" style={{ marginTop: 2 }} data-msx-assist-note>育成には使えません。アシスト効果と得意な能力だけ効きます</div>
          {typeof MsxMmGrid === 'function' ? <MsxMmGrid mons={stock} mark={() => 'メモモン'} isOn={(m) => teamAssist.includes(m.id)} onPick={(m) => toggleAssist(m.id)} attrs={(m) => ({ 'data-msx-team-assist': m.id })}/> : null}
        </>) : null}
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
    if (slotPick != null) body = (<>{body}<MsxSlotPicker idx={slotPick} cur={team[slotPick]} own={species} unlocked={unlocked} raised={raised} stock={stock} teamBox={teamBox} teamRaisedN={teamRaisedN} SUC={SUC}
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
        <div className="row" style={{ marginTop: 'auto' }}><img className="fc" src={msxFace(aid, 'wink')} alt=""/><div className="bub f1">「{aid === 'atsu' ? 'よし、いっちょ仕上げてくか。よろしくな笑' : 'いっしょに ヒーローズファイナル めざそ! まぢで楽しいから!'}」</div></div>
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
          <button type="button" key={t.id} className={`${items.includes(t.id) ? 'in' : ''}${t.when === 'both' ? ' bo' : ''}${!has(t.id) && !items.includes(t.id) ? ' none' : ''}${look === t.id ? ' look' : ''}`} onClick={() => { setLook(t.id); toggle(t.id); }} data-msx-carry-item={t.id}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.e}</span><i>×{has(t.id)}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode(t.name.replace('ガロエ印の', ''))}</small>{items.includes(t.id) ? <u>✔</u> : null}
          </button>
        ))}
      </div>
      <div className="v-ileg"><span><b className="sw1"/>はじめる前に効く物</span><span><b className="sw2"/>育成中にも使える物(1ターン1個まで)</span></div>
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }} data-msx-carry-list>
        {look && MSX_ITEM_BY_ID[look] ? (() => { const t = MSX_ITEM_BY_ID[look]; const n = has(look); return (
          <div className="v-bsel" style={{ marginBottom: 6 }} data-msx-carry-look={look}><span className="e" style={{ fontSize: 30 }}>{t.e}</span><div style={{ minWidth: 0 }}>
            <b>{t.name}<span className="yel"> ×{n}</span></b>
            <small style={JA_WRAP_STYLE}>{jaWrap(msxItemDesc(look))}</small>
            <small style={{ ...JA_WRAP_STYLE, color: '#7dd3fc' }}>{jaWrap(t.when === 'before' ? 'いつ: 育成をはじめる前に効き、その育成のあいだ続く' : 'いつ: 育成中の自分のターンに使う(1ターン1個まで・ターンは進まない)')}</small>
            <small style={{ ...JA_WRAP_STYLE, color: '#fcd34d' }}>{jaWrap(n > 0 ? (items.includes(look) ? '持っていく物に入っている(もう一度押すと外す)' : items.length >= 2 ? '持っていけるのは2つまで(ほかを外すと選べる)' : '押すと持っていく物に入る') : '手に入れ方: マーケットのビートP交換所・助手ライフの拾い物や贈り物')}</small>
          </div></div>); })() : <div className="msx-note" style={{ marginBottom: 6 }}>升目を押すと、効き目と手に入れ方が出ます</div>}
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
