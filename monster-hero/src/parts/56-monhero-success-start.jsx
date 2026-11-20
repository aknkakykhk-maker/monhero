// ===== モンヒロサクセス: 始めるまでの6段(育てるモンスター → 編成 → 助手(シナリオ) → 持ちこみ → 名前と染色 → 確認) =====
// 見本: docs/progress/player-raise/mock/png/v3-S.png(S1〜S6)。計算は芯の memberOf / newRun を呼ぶだけ
// 品の名前の折り目: 「の」のあとと、カタカナ語の「ー」のあと(「縁結びの/お守り」「ブリーダー/ライセンス」)。狭い升目で言葉の途中で折れないように(2026-11-14)
// 折り目は「の」「!」のあとと、決まったカタカナの境目だけ(「ー のあと」で区切ると「トレー|ニング」でも折れた。2026-11-14 窓口)
const msxItemNameNode = (name) => String(name || '').split(/(?<=[の!！])(?=.)|(?<=ブリーダー)(?=ライセンス)|(?<=オイリー)(?=パック|オイル)|(?<=野菜)(?=ジュース)|(?<=スタミナ)(?=だんご)|(?<=キビ)(?=ダンゴ)|(?<=.)(?=（)/).map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}{x}</React.Fragment>); /* 「（大盛）」など括弧書きの前でも割れるようにして、閉じ括弧だけが次の行に落ちないようにする(2026-11-17 社長「文字列が悪い」) */
const MSX_STEP_NAMES = Object.freeze(['育てるモンスター', '編成', '助手', '持ちこみ', '名前と染色', '確認']);
// 持ちこみ12種(ITEMS-REF.md・名前と効き目は参考のまま・博士はイッサ博士)。before = はじめる前に効く / both = 育成中にも使える
const MSX_ITEMS = Object.freeze([
  { id: 'guide', name: '博士の導き書', desc: 'イッサ博士の大事な書類。1度、イッサ博士が現れる', when: 'before', e: '📘' },
  { id: 'loupe', name: '博士のルーペ', desc: 'イッサ博士のお気に入り。イッサ博士の実験が成功する', when: 'both', e: '🔍' },
  { id: 'band', name: '出会いのミサンガ', desc: '交流を増やすミサンガ。ようす「イベントメーカー」が付く', when: 'before', e: '🧶' },
  { id: 'mag', name: '週刊!トレーニング', desc: 'ハウツー雑誌。ようす「トレーニング得意」が付く', when: 'before', e: '📰' },
  { id: 'hachi', name: '修行のハチマキ', desc: '気合いが入るハチマキ。ようす「修行得意」が付く', when: 'before', e: '🎗️' },
  { id: 'omamori', name: '縁結びのお守り', desc: '良縁に恵まれるお守り。ようす「スターの素質○」が付く', when: 'before', e: '🧧' },
  { id: 'dango', name: 'モモのキビダンゴ', desc: '食べるとスタミナがつく。体力の最大値が 初めから上がる', when: 'before', e: '🍡' },
  { id: 'grass', name: '受け継ぎ草', desc: '伝授でいい結果が出る草。ようす「受け継ぐ魂」が付く', when: 'before', e: '🌿' },
  { id: 'juice', name: 'ガロエ印の野菜ジュース', desc: '体力を完全に回復する', when: 'both', e: '🥤' },
  { id: 'powder', name: '悪様散', desc: '悪いようすを治して、体力を回復する', when: 'both', e: '💊' },
  { id: 'license', name: 'ブリーダーライセンス', desc: '忠誠度が一定数 上がる', when: 'both', e: '🪪' },
  { id: 'pack', name: 'オイリーパック', desc: '持ちこむと中身がそのまま持ち物に入る。オイリーオイル（大）2個と夏美草1個のセット', when: 'both', e: '🧴' },
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
  if (it.popTurn) return `使ったターンだけ、人気の上がり ×${S.POP_TURN_MULT || 1.5}`;
  if (it.issaForce) return 'イッサ博士が1度かならず来る';
  if (it.issaSure) return 'その回の博士の実験がかならず成功';
  if (it.hpMax) return `体力の上限 +${it.hpMax}`;
  if (it.hpFull) return '体力を上限まで回復';
  if (it.cure) return `悪いようす(サボりグセ・どんよりなど)を治し、体力を上限の${pc(it.hp || 0)}回復`;
  if (it.loyal) return `忠誠度 +${it.loyal}`;
  if (it.ama || it.fear) return `甘え度 +${it.ama || 0}・恐れ度 +${it.fear || 0}(忠誠度 +${(it.ama || 0) + (it.fear || 0)})`;
  if (it.gives) { const g = it.gives; return `持ちこむと中身が初めから持ち物に入る(開けなくてよい): ${Object.keys(g).map((k) => `${(S.ITEMS[k] && S.ITEMS[k].name) || k}${g[k]}個(${msxItemFx(k)})`).join('・')}`; }
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
  if (slot && slot.box) { const m = box.mons.find((x) => x.id === slot.box); if (m) return { kind: 'raised', species: m.species, name: m.nick || msxMonName(m.species), stats: m.st, loy: m.loy, pop: m.pop, lv: m.lv, masteries: m.masteries, techs: m.techs, aptUp: m.aptUp, aptBase: m.aptBase, aptAwake: m.aptAwake, assists: m.assists, colors: m.colors, boxId: m.id }; }
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
      {/* 「中断」は1つ前へ戻るのではなく、育成をいったんやめる(続きから遊べる)ボタンなので、戻るの矢印を付けない(2026-11-20 r1119-013 ⑥ API 点検) */}
      <button type="button" className="bk" data-mh-back onClick={onBack}>{back === '中断' ? '⏸ 中断' : `← ${back}`}</button>
      {/* 育成中などシナリオ名(sub)があるときは、題は「みゅあ編」だけにする(2026-11-15 社長。字の大きい設定でも切れない) */}
      {sub && title === '🌱 モンヒロサクセス' ? <span className="ti" data-msx-hd-sc>{sub}</span>
        : <span className="ti">{title}{title === '🌱 モンヒロサクセス' && typeof MsxBetaMark === 'function' ? <MsxBetaMark/> : null}{sub ? <small>{sub}</small> : null}</span>}
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
'images/success/skill/sk-0001.png','images/success/skill/sk-0002.png','images/success/skill/sk-0003.png','images/success/skill/sk-0004.png','images/success/skill/sk-0005.png','images/success/skill/sk-0008.png','images/success/skill/sk-0009.png','images/success/skill/sk-0010.png','images/success/skill/sk-0015.png','images/success/skill/sk-0016.png','images/success/skill/sk-0017.png','images/success/skill/sk-0018.png','images/success/skill/sk-0023.png','images/success/skill/sk-0025.png','images/success/skill/sk-0026.png','images/success/skill/sk-0027.png','images/success/skill/sk-0028.png','images/success/skill/sk-0035.png','images/success/skill/sk-0036.png','images/success/skill/sk-0037.png','images/success/skill/sk-0039.png','images/success/skill/sk-0040.png','images/success/skill/sk-0041.png','images/success/skill/sk-0042.png','images/success/skill/sk-0043.png','images/success/skill/sk-0044.png','images/success/skill/sk-0045.png','images/success/skill/sk-0046.png','images/success/skill/sk-0047.png','images/success/skill/sk-0048.png','images/success/skill/sk-0049.png','images/success/skill/sk-0050.png','images/success/skill/sk-0051.png','images/success/skill/sk-0052.png','images/success/skill/sk-0053.png','images/success/skill/sk-0054.png','images/success/skill/sk-0055.png','images/success/skill/sk-0064.png','images/success/skill/sk-0065.png','images/success/skill/sk-0066.png','images/success/skill/sk-0067.png','images/success/skill/sk-0068.png','images/success/skill/sk-0069.png','images/success/skill/sk-0070.png','images/success/skill/sk-0071.png','images/success/skill/sk-0072.png','images/success/skill/sk-0073.png','images/success/skill/sk-0074.png','images/success/skill/sk-0075.png','images/success/skill/sk-0076.png','images/success/skill/sk-0077.png','images/success/skill/sk-0078.png','images/success/skill/sk-0079.png','images/success/skill/sk-0080.png','images/success/skill/sk-0082.png','images/success/skill/sk-0083.png','images/success/skill/sk-0084.png','images/success/skill/sk-0110.png','images/success/skill/sk-0111.png','images/success/skill/sk-0112.png','images/success/skill/sk-0113.png','images/success/skill/sk-0114.png','images/success/skill/sk-0115.png','images/success/skill/sk-0116.png','images/success/skill/sk-0117.png','images/success/skill/sk-0118.png','images/success/skill/sk-0119.png','images/success/skill/sk-0120.png','images/success/skill/sk-0121.png','images/success/skill/sk-0122.png','images/success/skill/sk-0123.png','images/success/skill/sk-0124.png','images/success/skill/sk-0125.png','images/success/skill/sk-0129.png','images/success/skill/sk-0258.png','images/success/skill/sk-0259.png','images/success/skill/sk-0260.png','images/success/skill/sk-0261.png','images/success/skill/sk-0262.png','images/success/skill/sk-0263.png','images/success/skill/sk-0264.png','images/success/skill/sk-0265.png','images/success/skill/sk-0266.png','images/success/skill/sk-0267.png','images/success/skill/sk-0268.png','images/success/skill/sk-0269.png','images/success/skill/sk-0270.png','images/success/skill/sk-0271.png','images/success/skill/sk-0272.png','images/success/skill/sk-0273.png','images/success/skill/sk-0274.png','images/success/skill/sk-0292.png','images/success/skill/sk-0293.png','images/success/skill/sk-0294.png','images/success/skill/sk-0295.png','images/success/skill/sk-0296.png','images/success/skill/sk-0297.png','images/success/skill/sk-0298.png','images/success/skill/sk-0299.png','images/success/skill/sk-0300.png','images/success/skill/sk-0301.png','images/success/skill/sk-0302.png','images/success/skill/sk-0303.png','images/success/skill/sk-0304.png','images/success/skill/sk-0305.png','images/success/skill/sk-0306.png','images/success/skill/sk-0307.png','images/success/skill/sk-0338.png','images/success/skill/sk-0339.png','images/success/skill/sk-0340.png','images/success/skill/sk-0341.png','images/success/skill/sk-0342.png','images/success/skill/sk-0343.png','images/success/skill/sk-0344.png','images/success/skill/sk-0345.png','images/success/skill/sk-0346.png','images/success/skill/sk-0347.png','images/success/skill/sk-0348.png','images/success/skill/sk-0349.png','images/success/skill/sk-0350.png','images/success/skill/sk-0351.png','images/success/skill/sk-0384.png','images/success/skill/sk-0385.png','images/success/skill/sk-0386.png','images/success/skill/sk-0387.png','images/success/skill/sk-0388.png','images/success/skill/sk-0389.png','images/success/skill/sk-0390.png','images/success/skill/sk-0391.png','images/success/skill/sk-0392.png','images/success/skill/sk-0393.png','images/success/skill/sk-0394.png','images/success/skill/sk-0395.png','images/success/skill/sk-0396.png','images/success/skill/sk-0397.png','images/success/skill/sk-0398.png','images/success/skill/sk-0399.png','images/success/skill/sk-0400.png','images/success/skill/sk-0401.png','images/success/skill/sk-0402.png','images/success/skill/sk-0403.png','images/success/skill/sk-0404.png','images/success/skill/sk-0405.png','images/success/skill/sk-0406.png','images/success/skill/sk-0407.png','images/success/skill/sk-0408.png','images/success/skill/sk-0409.png','images/success/skill/sk-0410.png','images/success/skill/sk-0411.png','images/success/skill/sk-0412.png','images/success/skill/sk-0413.png','images/success/skill/sk-0414.png','images/success/skill/sk-0415.png','images/success/skill/sk-0416.png','images/success/skill/sk-0446.png','images/success/skill/sk-0447.png','images/success/skill/sk-0448.png','images/success/skill/sk-0449.png','images/success/skill/sk-0450.png','images/success/skill/sk-0451.png','images/success/skill/sk-0452.png','images/success/skill/sk-0453.png','images/success/skill/sk-0454.png','images/success/skill/sk-0455.png','images/success/skill/sk-0456.png','images/success/skill/sk-0457.png','images/success/skill/sk-0458.png','images/success/skill/sk-0459.png','images/success/skill/sk-0460.png','images/success/skill/sk-0461.png','images/success/skill/sk-0462.png','images/success/skill/sk-0463.png','images/success/skill/sk-0464.png','images/success/skill/sk-0465.png','images/success/skill/sk-0466.png','images/success/skill/sk-0467.png','images/success/skill/sk-0468.png','images/success/skill/sk-0469.png','images/success/skill/sk-0470.png','images/success/skill/sk-0471.png','images/success/skill/sk-0472.png','images/success/skill/sk-0473.png','images/success/skill/sk-0474.png','images/success/skill/sk-0475.png','images/success/skill/sk-0476.png','images/success/skill/sk-0477.png','images/success/skill/sk-0478.png','images/success/skill/sk-0479.png','images/success/skill/sk-0480.png','images/success/skill/sk-0481.png','images/success/skill/sk-0482.png','images/success/skill/sk-0483.png','images/success/skill/sk-0484.png','images/success/skill/sk-0485.png','images/success/skill/sk-0486.png','images/success/skill/sk-0487.png','images/success/skill/sk-0488.png','images/success/skill/sk-0489.png','images/success/skill/sk-0490.png','images/success/skill/sk-0491.png','images/success/skill/sk-0496.png','images/success/skill/sk-0511.png','images/success/skill/sk-0512.png','images/success/skill/sk-0513.png','images/success/skill/sk-0514.png','images/success/skill/sk-0515.png','images/success/skill/sk-0516.png','images/success/skill/sk-0517.png','images/success/skill/sk-0518.png','images/success/skill/sk-0519.png','images/success/skill/sk-0520.png','images/success/skill/sk-0521.png','images/success/skill/sk-0522.png','images/success/skill/sk-0523.png','images/success/skill/sk-0524.png','images/success/skill/sk-0525.png','images/success/skill/sk-0526.png','images/success/skill/sk-0573.png','images/success/skill/sk-0574.png','images/success/skill/sk-0575.png','images/success/skill/sk-0576.png','images/success/skill/sk-0577.png','images/success/skill/sk-0578.png','images/success/skill/sk-0579.png','images/success/skill/sk-0580.png','images/success/skill/sk-0581.png','images/success/skill/sk-0582.png','images/success/skill/sk-0583.png','images/success/skill/sk-0584.png','images/success/skill/sk-0585.png','images/success/skill/sk-0586.png','images/success/skill/sk-0587.png','images/success/skill/sk-0588.png','images/success/skill/sk-0589.png','images/success/skill/sk-0590.png','images/success/skill/sk-0591.png','images/success/skill/sk-0592.png','images/success/skill/sk-0593.png','images/success/skill/sk-0594.png','images/success/skill/sk-0595.png','images/success/skill/sk-0596.png','images/success/skill/sk-0597.png','images/success/skill/sk-0598.png','images/success/skill/sk-0599.png','images/success/skill/sk-0742.png','images/success/skill/sk-0743.png','images/success/skill/sk-0744.png','images/success/skill/sk-0785.png','images/success/skill/sk-0787.png','images/success/skill/sk-0788.png','images/success/skill/sk-0797.png','images/success/skill/sk-0798.png','images/success/skill/sk-0799.png','images/success/skill/sk-0824.png','images/success/skill/eiki_o01.png','images/success/skill/eiki_o02.png','images/success/skill/eiki_o03.png','images/success/skill/eiki_o04.png','images/success/skill/eiki_o05.png','images/success/skill/eiki_o06.png','images/success/skill/eiki_o07.png','images/success/skill/eiki_o08.png','images/success/skill/eiki_o09.png','images/success/skill/eiki_o10.png','images/success/skill/eiki_o11.png','images/success/skill/eiki_o12.png','images/success/skill/eiki_o13.png','images/success/skill/eiki_o14.png','images/success/skill/eiki_o15.png','images/success/skill/eiki_o16.png','images/success/skill/eiki_o17.png','images/success/skill/eiki_o18.png','images/success/skill/kenshimocchi_o01.png','images/success/skill/kenshimocchi_o02.png','images/success/skill/kenshimocchi_o03.png','images/success/skill/kenshimocchi_o04.png','images/success/skill/kenshimocchi_o05.png','images/success/skill/kenshimocchi_o06.png','images/success/skill/kenshimocchi_o07.png','images/success/skill/kenshimocchi_o08.png','images/success/skill/kenshimocchi_o09.png','images/success/skill/kenshimocchi_o10.png','images/success/skill/kenshimocchi_o11.png','images/success/skill/kenshimocchi_o12.png','images/success/skill/kenshimocchi_o13.png','images/success/skill/kenshimocchi_o14.png','images/success/skill/kenshimocchi_o15.png','images/success/skill/kenshimocchi_o16.png','images/success/skill/kenshimocchi_o17.png','images/success/skill/kenshimocchi_o18.png','images/success/skill/kuromy_o01.png','images/success/skill/kuromy_o02.png','images/success/skill/kuromy_o03.png','images/success/skill/kuromy_o04.png','images/success/skill/kuromy_o05.png','images/success/skill/kuromy_o06.png','images/success/skill/kuromy_o07.png','images/success/skill/kuromy_o08.png','images/success/skill/kuromy_o09.png','images/success/skill/kuromy_o10.png','images/success/skill/kuromy_o11.png','images/success/skill/kuromy_o12.png','images/success/skill/kuromy_o13.png','images/success/skill/kuromy_o14.png','images/success/skill/kuromy_o15.png','images/success/skill/kuromy_o16.png','images/success/skill/kuromy_o17.png','images/success/skill/kuromy_o18.png','images/success/skill/kuromy_o19.png','images/success/skill/kuromy_o20.png','images/success/skill/melody_o01.png','images/success/skill/melody_o02.png','images/success/skill/melody_o03.png','images/success/skill/melody_o04.png','images/success/skill/melody_o05.png','images/success/skill/melody_o06.png','images/success/skill/melody_o07.png','images/success/skill/melody_o08.png','images/success/skill/melody_o09.png','images/success/skill/melody_o10.png','images/success/skill/melody_o11.png','images/success/skill/melody_o12.png','images/success/skill/melody_o13.png','images/success/skill/melody_o14.png','images/success/skill/melody_o15.png','images/success/skill/melody_o16.png','images/success/skill/melody_o17.png','images/success/skill/melody_o18.png','images/success/skill/melody_o19.png','images/success/skill/melody_o20.png','images/success/skill/pandora_o01.png','images/success/skill/pandora_o02.png','images/success/skill/pandora_o03.png','images/success/skill/pandora_o04.png','images/success/skill/pandora_o05.png','images/success/skill/pandora_o06.png','images/success/skill/pandora_o07.png','images/success/skill/pandora_o08.png','images/success/skill/pandora_o09.png','images/success/skill/pandora_o10.png','images/success/skill/pandora_o11.png','images/success/skill/pandora_o12.png','images/success/skill/pandora_o13.png','images/success/skill/pandora_o14.png','images/success/skill/pandora_o15.png','images/success/skill/pandora_o16.png','images/success/skill/pandora_o17.png','images/success/skill/pandora_o18.png','images/success/skill/pandora_o19.png','images/success/skill/pandora_o20.png','images/success/skill/pandora_o21.png','images/success/skill/pandora_o22.png','images/success/skill/pandora_o23.png','images/success/skill/pandora_o24.png','images/success/skill/pandora_o25.png','images/success/skill/pandora_o26.png']);
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
// 技の升目の枠(2026-11-15 社長 r1115-040: 修行の「覚えられる技」も詳細の技の升目と同じ仕組み・見た目に)。
//   上の列見出し(遠・中・近・零)と、段=ランク1〜5×間合いの升を並べる。升の中身は cell(alts, r, d, cellK) が返す(詳細は技の絵+ガッツ、修行は技の絵+率)。そのランクの技が無い升は×
// head(d) … 見出しに添える間合い適性 { g: 'A', add: 10 }(2026-11-15 社長 r1115-080)。g だけなら適性の字だけ・add があれば修行の率の増減も出す
// 技の名前を言葉の切れ目(「・」と空白のあと)だけで折る(2026-11-15 社長 r1115-156①「スターバースト・ストリー/ム」が NG)。CSS の keep-all と組で使う
const msxTechNm = (name) => String(name == null ? '' : name).replace(/([・ 　])/g, '$1\u200b');
// 使ったあとに間合いが動く技(資料の moveTo)の説明(r1115-156②)。近づく向きは自分が動く・遠ざかる向きは相手を飛ばす
const msxTechMoveTxt = (t) => {
  if (!t || t.moveTo == null || !Number.isInteger(t.moveTo)) return '';
  const to = MSX_DIST_NAMES[t.moveTo] || '';
  const from = Array.isArray(t.dist) && t.dist.length ? Math.min(...t.dist) : t.moveTo;
  return t.moveTo > from ? `相手を\u200b${to}へ\u200b飛ばす` : `${to}へ\u200b移る`;
};
function MsxTechGrid({ all, cell, className, head }) {
  const at = (r, d) => all.filter((t) => (Number(t.rank) || 1) === r && Array.isArray(t.dist) && t.dist.includes(d));
  return (
    <div className={`msx-md-tg${className ? ` ${className}` : ''}`}>
      {MSX_TG_COLS.map((d) => { const h = typeof head === 'function' ? head(d) : null;
        return <span key={`h${d}`} className={`tgh d${d}${h ? ' apt' : ''}`} data-msx-tg-head={d}>{h ? <span className="tgn">{MSX_DIST_NAMES[d]}{h.g ? <b className="tga">{h.g}</b> : null}</span> : MSX_DIST_NAMES[d]}
          {h && Number.isFinite(h.add) ? <em className={`tgp${h.add > 0 ? ' tgp-up' : h.add < 0 ? ' tgp-dn' : ''}`}>{h.add > 0 ? `+${h.add}` : h.add < 0 ? `${h.add}` : '±0'}%</em> : null}</span>; })}
      {[1, 2, 3, 4, 5].map((r) => MSX_TG_COLS.map((d) => { const alts = at(r, d); const k = `${r}-${d}`;
        return alts.length ? <React.Fragment key={k}>{cell(alts, r, d, k)}</React.Fragment> : <span key={k} className="no" aria-hidden="true">×</span>; }))}
    </div>
  );
}
// 技の熟練(0〜100 の整数)と、その熟練の効き目(芯の techBoostOf と同じ数を %で。0 のときは null)。r1115-082
const msxMasteryOf = (mastery, id) => Math.max(0, Math.min(100, Math.round(Number(mastery && mastery[id]) || 0)));
const msxMasteryBoost = (SUC, id, m) => {
  if (!(m > 0) || !SUC || typeof SUC.techBoostOf !== 'function') return null;
  try { const o = SUC.techBoostOf({ techs: [id], mastery: { [id]: m } })[id]; if (!o) return null; const pc = (v) => Math.round((Number(v) || 0) * 1000) / 10; return { pow: pc(o.pow), hit: pc(o.hit) }; } catch (e) { return null; }
};
// まだ覚えていない技の覚え方(技表の learn: { start } / { by:修行の系統, st:{ 能力: 数 } })
// 例: 修行で覚える(かしこさ150以上・ガッチョの熟練25)。前の技の名前は同じ種の技表から引く(無ければ「前の技」)
const msxTechHow = (t, all = []) => {
  const L = t && t.learn; if (!L) return '修行で覚える';
  if (L.start) return '初めから';
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
// 能力の値の段(ランク字)。色の約束は参考どおり全画面共通(S+・S=金 / A+・A=赤 / B=桃 / C=緑 / D=水色 / E=青 / F=紫 / G=灰 / 1000以上は M=紫)。
//   段の切り方は、モンサクの能力の上限が通常999(上限アップで超過あり)という分布に合わせた決め(モンサク通し点検 中-2・中-3)
const msxStatRankOf = (v) => { const n = Number(v) || 0; if (n >= 1200) return 'M'; if (n >= 1000) return 'S+'; if (n >= 950) return 'S'; if (n >= 900) return 'A+'; if (n >= 800) return 'A'; if (n >= 650) return 'B'; if (n >= 500) return 'C'; if (n >= 350) return 'D'; if (n >= 200) return 'E'; if (n >= 100) return 'F'; return 'G'; };
const msxStatRankCls = (v) => `msx-srk r${msxStatRankOf(v).replace('+', 'p')}`;
// pick … 被った升で覚える技を選べるとき { sel: { 升: 技id }, locked: (升) => 覚えたあとで変えられないか, onPick: (升, 技id) => void }(無ければ見るだけ)
// head … 名前の横に置く物(マスモンボックスのハート・✏)/ more … 特徴のタブの下に足す行 [[見出し, 中身], …] / foot … 「とじる」の上に置くボタン(貸し出し・お別れ)/ grade … 総合力の横の評価(A2 など)
// mastery … 覚えた技の熟練 { 技id: 0〜100 }(2026-11-15 社長 r1115-082「技の熟練度ってそもそもどこにあるの？」)。渡したときだけ、升に小さなゲージ・右の欄に熟練と効き目を出す
function MsxMonDetail({ species, name, art, st, apt, type, peak, grades, known, power, rank, sub, onClose, SUC, head = null, more = null, foot = null, grade: gradeLabel = null, pick = null, mastery = null, assists = null, info = null, initialTab = null, supportSummary = null, cap = null, initialTech = null }) {
  const [tab, setTab] = useState('base');
  const [btab, setBtab] = useState(() => (initialTab === 'assist' && Array.isArray(assists) && assists.length ? 'assist' : 'tech')); // 下の段のタブ: 技 / アシスト / 育成情報(出せる情報があるときだけタブを出す・r1115-095)。initialTab='assist' でアシストから開く(編成の効果確認)
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
  const [pickT, setPickT] = useState(() => { const ini = initialTech ? all.find((t) => t.id === initialTech) : null; return (ini || all.find(has) || all[0] || {}).id || null; }); // initialTech: 能力画面の技名から開いたとき、その技から見せる(Issue #6807 UI-4)
  const tech = all.find((t) => t.id === pickT) || list[0] || null;
  const grade = (k, v) => (typeof msaTechGrade === 'function' ? msaTechGrade(k, v) : '') || '−';
  const msOf = (id) => (mastery && typeof mastery === 'object' ? msxMasteryOf(mastery, id) : null); // 熟練(渡されていなければ null = 出さない)
  // 上限は、育成のメイン画面の能力カード(MsxStRow)と同じ算出元: 芯の statCapOf に、育成開始時に決まる上限(s.cap)を
  // 呼ぶ側から cap で渡してもらう。渡されない画面(ボックス・ベースモン・ランキングなど)は、その子の育成ごとの上限が
  // 手元に無いので 999 が下限になる(能力の上限アップ r1115-103)。そのうえで、表示の上限は実際の値より小さくしない:
  // 値まで育った以上その値までは上限があったはずで、値より小さい上限を出すと「2111/999」のように値が上限を
  // 超えた矛盾した表示になる(2026-11-18 実機報告・ランキング詳細)。cap がある画面では値は上限以下なので変わらない
  const capBase = (k) => (SUC && typeof SUC.statCapOf === 'function' ? SUC.statCapOf({ cap }, k) : (cap && Number.isFinite(cap[k]) ? Math.max(999, cap[k]) : 999));
  const capK = (k) => Math.max(capBase(k), Number(st && st[k]) || 0);
  const TOP = [['base', '基礎'], ['feat', '特徴'], ['apt', '適性']];
  return (
    <div className="msx-ov msx-fade" data-msx-detail onClick={onClose}>
      <div className="msx-sheet msx-dt msx-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="msx-md-ti">モンスターの詳細</h3>
        <div className="msx-md-scroll">
          <div className="msx-md-top">
            <div className="msx-md-art">
              {/* 名前を付けていない子は「スネグーラチカ / Lv.3・スネグーラチカ」と同じ名前が2行になっていたので、下の行の種の名前を落とす(2026-11-20 r1119-033 育-41) */}
              <div className="nm">{head ? <span className="msx-md-head">{head}</span> : null}<span className="nmx">{name || msxMonName(species)}</span>{(() => { const nm0 = name || msxMonName(species); const sb = sub && typeof sub === 'string' && sub.endsWith(`・${nm0}`) ? sub.slice(0, -(nm0.length + 1)) : sub; return sb ? <small>{sb}</small> : null; })()}</div>
              {art || <img src={msxMonImg(species)} alt=""/>}
              {power != null ? <div className="pw"><small>総合力</small><b>{msxFmt(power)}</b>{rank ? <i className={msxRankCls(rank)}>{rank}</i> : null}{gradeLabel ? <i className="msx-md-grade">{gradeLabel}</i> : null}</div> : null}
            </div>
            <div className="msx-md-panel">
              <div className="msx-md-tabs">{TOP.map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} data-msx-detail-tab={k} onClick={() => setTab(k)}>{n}</button>)}</div>
              {tab === 'base' ? (<div className="msx-md-box"><div className="cap">能力<span>素質</span></div>
                {MSX_STATS.map((k, i) => { const v = Number(st[k]) || 0; const cp = capK(k); const over = Math.max(0, v - cp); return (
                  <div key={k} className="msx-md-st"><span className="n">{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</span>
                    <span className="v"><b>{st[k]}<small data-msx-stat-cap={k} style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginLeft: 2 }}>/{cp}</small></b><span className={`g${over ? ' ov' : ''}`}><i style={{ width: `${Math.max(2, Math.min(100, v / cp * 100))}%`, background: MSX_STAT_COLOR[k] }}/>{over ? <b className="ov" data-msx-stat-over={over} style={{ width: `${Math.min(100, over / cp * 100)}%` }}/> : null}</span></span>
                    <span className={`a${apt[i] > 'B' ? ' lo' : ''}`}>{apt[i]}</span></div>
                ); })}</div>) : null}
              {tab === 'feat' ? (<div className="msx-md-box">
                <div className="msx-md-kv"><b>成長の型</b><span className="yel">{typeName}</span></div>
                <div className="msx-md-kv"><b>伸びどき</b><span>{peak || '—'}</span></div>
                <div className="msx-md-kv"><b>血統</b><span>{main ? `${main}${subL && subL !== main ? ` × ${subL}` : '(純血)'}` : '—'}</span></div>
                {false && Array.isArray(more) ? more.filter(Boolean).map(([k, v], i) => <div key={`m${i}`} className="msx-md-kv"><b>{k}</b><span>{v}</span></div>) : null}
                <div className="msx-md-dex">{dex || 'このモンスターの図鑑は調査中'}</div></div>) : null}
              {tab === 'apt' ? (<div className="msx-md-box"><div className="cap">間合い適性</div>
                <div className="msx-dt-dist">{MSX_DIST_NAMES.map((d, i) => <div key={d}><span>{d}</span><b>{grades ? grades[i] : '—'}</b></div>)}</div>
                <div className="msx-note" style={{ marginTop: 4 }}>適性が高い間合いほど、その間合いの技がよく当たる</div></div>) : null}
            </div>
          </div>
          {/* 技の欄(2026-11-14 社長「今なんの技を覚えてるかわかんない」→ 参考 monster-detail-basic の形): 左から 遠・中・近・零 の4列の升目+右に技の詳細。
              升の中は技の絵と右下に消費ガッツ。覚えていない技は暗い升に錠、出ない枠は×。升を押すと右に詳細。参考の「移動間合い・技能力・連動能力」はこのゲームに無いので出さない */}
          {supportSummary ? <div className="msx-md-box msx-md-sup" data-msx-detail-support>{supportSummary}</div> : null}
          {(() => {
            const AT = typeof window !== 'undefined' && window.MONHERO_SUCCESS_ASSIST && window.MONHERO_SUCCESS_ASSIST.VERSION === 3 ? window.MONHERO_SUCCESS_ASSIST : null;
            const infoRows = Array.isArray(info) ? info.filter(Boolean) : [];
            const hasA = Array.isArray(assists) && !!AT; const hasI = infoRows.length > 0;
            if (!hasA && !hasI) return null;
            const BT = [['tech', '技'], hasA ? ['assist', 'アシスト'] : null, hasI ? ['info', '育成情報'] : null].filter(Boolean);
            const got = hasA ? assists.filter((a) => a && AT.BY_ID[a.id]).map((a) => ({ a: AT.BY_ID[a.id], n: AT.fromSaved(a) })).filter((x) => x.n > 0) : [];
            return (<div className="msx-md-btabs" data-msx-detail-btabs>
              <div className="msx-md-tabs" style={{ gridTemplateColumns: `repeat(${BT.length},1fr)` }}>{BT.map(([k, n]) => <button type="button" key={k} className={btab === k ? 'on' : ''} data-msx-detail-btab={k} onClick={() => setBtab(k)}>{n}</button>)}</div>
              {btab === 'assist' ? (<div className="msx-md-box msx-md-as" data-msx-detail-assist>
                <div className="cap">取ったアシスト効果<span data-msx-assist-count>{got.length} / {AT.MAX_KINDS}種類</span></div>
                {got.length ? got.map(({ a, n }) => (typeof MsxAssistCard === 'function' ? <MsxAssistCard key={a.id} a={a} n={n}/> : null))
                  : <div className="msx-note" data-msx-assist-none style={{ padding: 8 }}>アシスト効果はまだありません</div>}</div>) : null}
              {btab === 'info' ? (<div className="msx-md-box" data-msx-detail-info>{infoRows.map(([k, v], i) => <div key={`i${i}`} className="msx-md-kv"><b>{k}</b><span>{v}</span></div>)}</div>) : null}
            </div>);
          })()}
          <div className="msx-md-bot" data-msx-detail-techs style={btab !== 'tech' && (Array.isArray(assists) || (Array.isArray(info) && info.some(Boolean))) ? { display: 'none' } : undefined}>
            <div className="msx-md-cap">技<small>{Array.isArray(known) ? '覚えた技' : '初めから使える技'} {all.filter(has).length}/{all.length}</small></div>
            {/* 升目の見方(2026-11-20 r1119-033 育-165・育-184: 列の「零」・升の数字・左下の丸に説明が無かった) */}
            <div className="msx-md-leg" data-msx-detail-legend>列は技の届く間合い(零 = くっついた距離)・升の数字は技のランク・暗い升はまだ覚えていない技{mastery ? '・左下の丸は熟練' : ''}</div>
            <div className="msx-md-tw">
              <MsxTechGrid all={all} head={grades ? (d) => ({ g: grades[d] }) : null} cell={(alts, r, d, cellK) => {
                  // 升に出す技: 覚えた技(はじめからの技を含む)があればそれ → 選んだ技 → 並びの1つ目。
                  //   選んだ未習得の技を先に出すと、その升のはじめからの技が隠れて「初めから使える技 N」の数と
                  //   光る升の数が食い違う(2026-11-18 実機報告: 剣士モッチーの 1-2 の升。エアリアルもっちゃんが
                  //   もちき・リープを選んだ途端に見えなくなった)。選んだ技は ⇄ の窓で「選択中」と分かる
                  const t = alts.find(has) || alts.find((x) => pick && pick.sel && pick.sel[cellK] === x.id) || alts[0];
                  const got = has(t); const canAlt = !!pick && alts.length > 1;
                  // 技の種類で升の色を分ける(参考どおり ちから=金・かしこさ=緑)。覚えていない技も絵を出し、升の地を暗くして見分ける(2026-11-14 社長「鍵じゃなくて覚えてないやつも表示して色分けして」)。
                  // 覚える条件の数は升に出さず、押したときの右の「覚え方」に出す(社長「150とかその数字何?」→ 升目から消す)
                  return <button type="button" key={`${r}-${d}`} className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'}${got ? ' got' : ' tg-not'}${tech && tech.id === t.id ? ' on' : ''}`} data-msx-tech={t.id} data-msx-cell={cellK} aria-label={`${t.name}${got ? '' : '(まだ覚えていない)'}${canAlt ? '(選べる技が' + alts.length + 'つ)' : ''}`} onClick={(e) => { setPickT(t.id); const box = e.currentTarget.closest('[data-msx-detail-techs]'); setTimeout(() => { const td = box && box.querySelector('.msx-md-td'); const sc = box && box.closest('.msx-md-scroll'); if (!td || !sc) return; const a = td.getBoundingClientRect(); const c = sc.getBoundingClientRect(); if (a.bottom > c.bottom + 4) sc.scrollBy({ top: Math.round(a.bottom - c.bottom + 4) }); }, 30); }}>
                    <span className="ti" aria-hidden="true"><MsxSkillArt t={t} uid={`${r}${d}`}/></span><span className="tnm" aria-hidden="true">{msxTechNm(t.name)}</span><span className={`tg-rk rk${Math.max(1, Math.min(5, Number(t.rank) || 1))}`} aria-hidden="true">{Math.max(1, Math.min(5, Number(t.rank) || 1))}</span>{/* 消費ガッツは右の欄の1か所だけ(升の右下の数と二重だった・2026-11-20 r1119-033 M1D) */}{got && msOf(t.id) != null ? <span className="tg-ms" aria-hidden="true" data-msx-tech-ms={msOf(t.id)}><i style={{ width: `${msOf(t.id)}%` }}/></span> : null}{canAlt ? <span className="tg-alt" aria-hidden="true" data-msx-alt={cellK} data-msx-alt-n={alts.length}>⇄{alts.length}</span> : null}</button>;
                }}/>
              {tech ? (<div className="msx-md-td">
                <div className="tn">{msxTechNm(tech.name)}{has(tech) ? null : <small className="msx-md-not">まだ覚えていない</small>}</div>
                {/* 選び替えは技名のすぐ下に置く(説明の列の下だと枠で切れて見えなかった。点検 2026-11 TP3) */}
                {pick && tgAt(tech.rank, Math.min(...(tech.dist || [1]))).length > 1 ? <button type="button" className="msx-md-alt top" data-msx-alt-open onClick={() => setPickCell(`${tech.rank}-${Math.min(...(tech.dist || [1]))}`)}>⇄ 覚える技を選ぶ</button> : null}
                <div className="msx-md-kv"><b>技種</b><span>{tech.kind === 'wise' ? 'かしこさ' : 'ちから'}</span></div>
                <div className="msx-md-kv"><b>消費ガッツ</b><span>{tech.guts}</span></div>
                <div className="msx-md-kv"><b>ダメージ</b><span className="gd">{grade('power', tech.power)}</span></div>
                <div className="msx-md-kv"><b>命中率</b><span className="gd">{grade('hit', tech.hit)}</span></div>
                <div className="msx-md-kv"><b>ガッツダウン</b><span className="gd">{grade('gd', tech.gd)}</span></div>
                <div className="msx-md-kv"><b>クリティカル率</b><span className="gd">{grade('crit', tech.crit)}</span></div>
                {msxTechMoveTxt(tech) ? <div className="msx-md-kv" data-msx-tech-move><b>使ったあと</b><span className="msx-kp">{msxTechMoveTxt(tech)}</span></div> : null}
                {has(tech) && msOf(tech.id) != null ? (() => { const m = msOf(tech.id); const b = msxMasteryBoost(SUC, tech.id, m); return (<>
                  <div className="msx-md-kv msx-md-ms" data-msx-detail-ms={m}><b>熟練</b><span className="msx-ms-v"><b>{m}</b><small>/100</small></span></div>
                  <div className="msx-md-kv"><b>熟練の効き目</b><span className="msx-ms-ef">{b ? <><i>威力+{b.pow}%</i><i>命中+{b.hit}%</i></> : 'まだ無し'}</span></div></>); })() : null}
                <div className="msx-md-kv msx-md-howrow"><b>覚え方</b><span>{has(tech) ? (Array.isArray(known) ? '覚えている' : '初めから') : (() => { const how = msxTechHow(tech, all); return how.startsWith('修行で覚える(') ? <>修行で覚える<small className="msx-md-how">{how.slice('修行で覚える'.length)}</small></> : how; })()}</span></div>
              </div>) : null}
            </div>
          </div>
        </div>
        {pick && pickCell ? (() => { const [pr, pd] = pickCell.split('-').map(Number); const alts = tgAt(pr, pd); const lock = !!pick.locked(pickCell); const cur = alts.find((x) => pick.sel && pick.sel[pickCell] === x.id) || alts.find(has) || alts[0];
          return (<div className="msx-ov msx-fade msx-ov-deep" data-msx-techpick onClick={(e) => { e.stopPropagation(); setPickCell(null); }}>
            <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
              <h3>覚える技を選ぶ</h3>
              <div className="msx-note msx-kp">{msxPh(`${MSX_DIST_NAMES[pd]}の間合い・ランク${pr}。｜いま選んでいる技が｜修行で覚える｜候補になります。｜選ばなかった技は｜候補に出ませんが、｜あとから｜選び直して｜覚えることも｜できます。｜前に覚えた技と｜その熟練は｜そのまま残ります`)}</div>
              <div className="msx-dt-body">{alts.map((t) => { const on = cur && cur.id === t.id; const how = has(t) ? '覚えている' : msxTechHow(t, all); return (
                <button type="button" key={t.id} className={`msx-tpk${on ? ' on' : ''}`} data-msx-techpick-opt={t.id} onClick={() => { pick.onPick(pickCell, t.id); setPickT(t.id); setPickCell(null); }}>
                  <span className={`tc ${t.kind === 'wise' ? 'wise' : 'pow'}${has(t) ? ' got' : ' tg-not'}`} data-msx-techpick-icon><span className="ti" aria-hidden="true"><MsxSkillArt t={t} uid="p"/></span><span className={`tg-rk rk${Math.max(1, Math.min(5, Number(t.rank) || 1))}`} aria-hidden="true">{Math.max(1, Math.min(5, Number(t.rank) || 1))}</span></span>
                  <span className="tpb"><b>{msxTechNm(t.name)}</b><small>{t.kind === 'wise' ? 'かしこさ' : 'ちから'}・消費ガッツ {t.guts}</small>
                    <small className="tp-nb" data-msx-techpick-grades><i>ダメージ {grade('power', t.power)}</i><i>命中率 {grade('hit', t.hit)}</i><i>ガッツダウン {grade('gd', t.gd)}</i><i>クリティカル率 {grade('crit', t.crit)}</i></small>{msxTechMoveTxt(t) ? <small className="tp-nb"><i>使ったあと {msxTechMoveTxt(t)}</i></small> : null}<small className="tp-nb">{how.startsWith('修行で覚える(') ? <><i>修行で覚える</i><i>{how.slice('修行で覚える'.length)}</i></> : <i>{how}</i>}</small></span>
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
  const boxFull = false; // r1115-115: 自分のモンスターは6枠のどこにも入る(数の上限は枠の数だけ)
  return (
    <div className="msx-ov msx-fade" data-msx-slot-picker onClick={onClose}>
      <div className="msx-sheet msx-dt" onClick={(e) => e.stopPropagation()}>
        <h3>{idx + 1}枠目に入れるモンスター</h3>
        <div className="msx-dt-body">
          <div className="msx-dt-cap">ベースモン</div>
          <div className="msx-pick-grid">{unlocked.map((sp) => { const on = cur && !cur.box && cur.base === sp && !cur.auto; return (
            <button type="button" key={sp} className={`msx-pick${on ? ' on' : ''}`} data-msx-pick-base={sp} onClick={() => onPick({ base: sp })}>
              <MsxMonFace species={sp} alt=""/><b>{msxMonName(sp)}</b><small style={JA_LABEL_STYLE}>{sp === own ? jaWrap('育てるモンスターと同じ種') : topTxt({ kind: 'base', species: sp })}</small></button>); })}</div>
          <div className="msx-dt-cap" style={{ marginTop: 8 }}>マスモンボックスのモンスター</div>
          {raised.length ? raised.map((m) => { const on = cur && cur.box === m.id; const used = !on && teamBox.includes(m.id); return (
            <button type="button" key={m.id} className={`v-item${on ? ' sel' : ''}`} disabled={!on && boxFull && !used} style={{ padding: '4px 8px', width: '100%' }} onClick={() => onPick({ box: m.id })}>
              <MsxMonFace species={m.species} colors={m.colors} style={thumb}/>
              <div>{m.nick || msxMonName(m.species)} {m.rank ? <i className={msxRankCls(m.rank)}>{m.rank}</i> : null}<small>{msxMonName(m.species)}{used ? '・ほかの枠から移す' : ''}</small></div>
              <span className="pr">{on ? '✅ この枠' : '入れる'}</span></button>); })
            : <div className="msx-note">まだいません。育て終えたモンスターが入ります</div>}
          {stock.length ? (<>
            <div className="msx-dt-cap" style={{ marginTop: 8 }}>メモリアルモンスター(育成には使えません)</div>
            {stock.map((m) => { const on = cur && cur.assist === m.id; return (
              <button type="button" key={m.id} className={`v-item${on ? ' sel' : ''}`} disabled={!on && boxFull} style={{ padding: '4px 8px', width: '100%' }} data-msx-pick-assist={m.id} onClick={() => onPick({ assist: m.id })}>
                <MsxMonFace species={m.species} colors={m.colors} style={thumb}/>
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
                  <div key={i} className="msx-gt-mon"><MsxMonFace species={m.species} colors={m.colors}/><span className="nm">{m.name}</span>
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

// 育てる子を選ぶ段(r1119 ⑦): 伸びやすさ(素質 A〜E)の字の色の段。A=金 / B=緑 / C=白 / D・E=灰
const msxAptCls = (g) => (g === 'A' ? 'hi' : g === 'B' ? 'md' : g === 'C' ? 'mid' : 'lo');
// 「ピーク ミドル期」では伝わらない(社長)ので、育成のどのあたりでいちばん伸びるかを言葉で添える
const MSX_PERIOD_WHEN = Object.freeze({ 'デビュー期': 'はじめ', 'ジュニア期': '前半', 'ミドル期': '中ごろ', 'プロ期': '後半', '最後の期': '終わりごろ' });
const msxPeakWords = (peak) => {
  const ps = String(peak || '').split('〜');
  const w = ps.map((p) => MSX_PERIOD_WHEN[p]).filter(Boolean);
  return [peak, `(育成の${w.length > 1 && w[0] !== w[1] ? `${w[0]}〜${w[1]}` : w[0] || '中ごろ'})`, 'に', '一番', '伸びる']; // 言葉の途中で折れないよう、かたまりごとに折らない札にする
};
function MsxStart({ data, SUC, onCancel, onStart, bondLvOf, callNameOf, onOpenShop }) {
  const { box, meta, unlocked } = data;
  const stock = (data.assist && Array.isArray(data.assist.mons)) ? data.assist.mons : []; // メモリアルモンスター(育成には使えない・編成にだけ入る)
  const unraised = box.mons.filter((m) => !m.raised);
  const raised = box.mons.filter((m) => m.raised);
  const [step, setStep] = useState(0);
  const [scn, setScn] = useState(null); // ストーリー選択(56-monsuc-scenario.jsx)。null のあいだは選ぶ段を出す
  const [tab, setTab] = useState('base');
  const [pickQ, setPickQ] = useState(''); // 育てる子を選ぶ段の検索・並び替え(表示だけ。選んだ子は id で持つ)
  const [pickSort, setPickSort] = useState('std');
  const [pickRev, setPickRev] = useState(false);
  const [showAll, setShowAll] = useState(false); // 持ちこみの段: 持っていない物も升目に出す(既定は畳む・Q-3-6)
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
    // r1115-115(社長): 自分のモンスターは6枠のどこにも入る(前は5体まで)。古い保存(5体+ベースモン)もそのまま読める
    const own0 = unlocked[0] || 'Mocchi'; const seen = new Set();
    const o = (meta.team || []).slice(0, 6).map((t) => {
      if (t && t.box && raised.some((m) => m.id === t.box) && !seen.has(`b${t.box}`)) { seen.add(`b${t.box}`); return { box: t.box }; }
      if (t && t.assist && stock.some((m) => m.id === t.assist) && !seen.has(`a${t.assist}`)) { seen.add(`a${t.assist}`); return { assist: t.assist }; }
      return t && t.base && unlocked.includes(t.base) && t.base !== own0 ? { base: t.base } : null;
    });
    while (o.length < 6) o.push(null);
    return o;
  });
  const [slotPick, setSlotPick] = useState(null); // ベースモン・保存枠の子を選ぶ窓を開いている枠の番号
  const [gatherOpen, setGatherOpen] = useState(false); // 集まりやすいトレーニングの表
  const [friendOpen, setFriendOpen] = useState(false); // フレンドの貸し出しの一覧を開いている枠の番号(r1115-096・115)。false で閉じる
  const [effectsOpen, setEffectsOpen] = useState(false); // 編成の効果一覧(r1115-096)
  const teamBox = teamSlotsSt.filter((t) => t && t.box).map((t) => t.box);
  const teamAssist = teamSlotsSt.filter((t) => t && t.assist).map((t) => t.assist);
  const teamRaisedN = teamBox.length + teamAssist.length; // 6枠のうち、育てた子(マスモンボックス・アシスト用)の数
  // フレンドから借りた子(回5・オトズレの部品 monsucLendMember の写し)。r1115-115: どの枠にも入る・最大1体(入れなくてもよい)。friendAt = 入っている枠
  const [friend, setFriend] = useState(null);
  const [friendAt, setFriendAt] = useState(5);
  const [lendList, setLendList] = useState(null); // null | 'loading' | { ok, rows, reason }
  const autoBases = useMemo(() => { const o = unlocked.filter((id) => id !== species); return o.length ? o : [species]; }, [unlocked, species]);
  const team = useMemo(() => {
    let ai = 0;
    return teamSlotsSt.slice(0, 6).map((t, i) => (friend && i === friendAt ? { friend } : t || { base: autoBases[(ai++) % autoBases.length], auto: true }));
  }, [teamSlotsSt, autoBases, friend, friendAt]);
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
  const lastBase = useRef(null); // 合体のタブへ替える前に選んでいたベースモン(タブを戻したとき元に戻す)
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
  const scene = (style, inner, sm) => (
    <div className={`v-scene${sm ? ' sm' : ''}`}>
      <img className="bg" src={msxSceneBg(1).bg} alt=""/><div className="sh"/>
      <div className="gr" style={{ bottom: `calc(${style.mb} - 5px)` }}/>
      {colors.some(Boolean) && typeof DyedMonsterImage === 'function'
        ? <span className="mon" style={{ bottom: style.mb, height: style.h }}><DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>
        : <img className="mon" src={msxMonImg(species)} alt="" style={{ bottom: style.mb, height: style.h }}/>}
      {inner}
    </div>
  );

  if (scn == null && typeof MsxScenarioSelect === 'function') return <MsxScenarioSelect value={scn} ctx={betaCtx} onBack={onCancel} onNext={(id) => { setScn(id); setStep(0); }}/>;
  let p1few = false; // 1段目で一覧が少ない(下の選んだ子の欄を大きく)
  let body = null; let go = null; let full = null; let ftPre = null; // ftPre … 下の帯で主のボタンの左に並べるボタン(縦に積まない。MONSUC_UI.md §8) // full … 全画面で出す選ぶ画面(r1115-096。編成の画面の代わりに出す)
  if (step === 0) {
    const listAll = tab === 'base' ? unlocked.map((id) => ({ key: id, sp: id, nm: msxMonName(id), on: !pick.box && pick.base === id, pick: { base: id } }))
      : unraised.map((m) => ({ key: m.id, sp: m.species, nm: m.nick || msxMonName(m.species), colors: Array.isArray(m.colors) ? m.colors : null, awake: m.awake || 0, on: pick.box === m.id, pick: { box: m.id } }));
    const listF = pickQ.trim() && typeof msxMatchQ === 'function' ? listAll.filter((x) => msxMatchQ(pickQ, x.nm, msxMonName(x.sp))) : listAll;
    const listS = pickSort === 'name' ? listF.slice().sort((a, b) => String(a.nm).localeCompare(String(b.nm), 'ja')) : pickSort === 'species' ? listF.slice().sort((a, b) => String(msxMonName(a.sp)).localeCompare(String(msxMonName(b.sp)), 'ja')) : listF;
    const list = pickRev ? listS.slice().reverse() : listS;
    const few = listAll.length <= 12 && !pickQ; p1few = few; // 少ないうちは検索と並び替えを畳み、空いた分を選んだ子の絵に回す(Q-3-4) // 写しだけを並べ替える(元の並び・保存データは変えない)
    body = (<>
      <div className="v-p1main">
      <div className="v-h">だれを育てる?<small>ベースモンか、合体で生まれた未育成のモンスターから1体</small></div>
      <div className="v-p1bar">
      <div className="v-tabs">
        <button type="button" className={tab === 'base' ? 'on' : ''} onClick={() => { setTab('base'); if (pick.box && unlocked.length) setPick({ base: unlocked.includes(lastBase.current) ? lastBase.current : unlocked[0] }); }}>🌱 ベースモン {unlocked.length}</button>
        <button type="button" className={tab === 'fuse' ? 'on' : ''} data-msx-tab-fuse onClick={() => { setTab('fuse'); if (!pick.box && unraised.length) { lastBase.current = pick.base || lastBase.current; setPick({ box: unraised[0].id }); } }}>🧬 合体<i className="v-p1lg">で生まれたモンスター</i> {unraised.length}</button>
      </div>
      {typeof MsxPickTools === 'function' && !few ? <MsxPickTools q={pickQ} onQ={setPickQ} sorts={[['std', '標準'], ['name', '名前'], ['species', '種族']]} sort={pickSort} onSort={setPickSort} rev={pickRev} onRev={setPickRev} count={list.length} total={listAll.length}/> : null}
      </div>
      <div className="v-gridw" data-msx-pick-list>
        {/* 札は④の共通の型(MonsucMonCard の小・MonsucCardGrid の5列。docs/spec/MONSUC_UI.md の 8)。独自の大きさの顔アイコンは作らない */}
        {list.length ? (typeof MonsucMonCard === 'function' ? (
          <MonsucCardGrid size="s">
            {list.map((x) => <MonsucMonCard key={x.key} size="s" m={{ species: x.sp, nick: x.nm, colors: x.colors || null, awake: x.awake || 0 }} on={x.on} onClick={() => setPick(x.pick)} attrs={{ 'data-msx-pick-mon': x.sp, 'aria-label': x.nm, 'aria-pressed': x.on }}/>)}
          </MonsucCardGrid>
        ) : null) : <span className="msx-note">{listAll.length ? '検索に当てはまるモンスターがいません' : 'まだいません(合体はこれから作ります)'}</span>}
      </div>
      </div>
      {/* 選んだ子(r1119 ⑦ 社長「見た目悪い」): 草原の帯と詳細の箱で画面の半分を取っていたのをやめ、左に立ち絵・右に能力の棒と伸びやすさの字の1枚にまとめる。
          参考 monster-detail-basic(左に立ち絵・右に能力の値と棒と段の字)。「選んだ回数」の札は何のためか分からないので出さない */}
      <div className="v-card sel v-p1sel" data-msx-start-sel>
        <div className="v-p1art">
          <img className="bg" src={msxSceneBg(1).bg} alt=""/>
          {colors.some(Boolean) && typeof DyedMonsterImage === 'function'
            ? <span className="mon"><DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>
            : <img className="mon" src={msxMonImg(species)} alt=""/>}
        </div>
        <div className="v-p1info">
          <div className="v-p1hd"><b className="nm">{fromMon && fromMon.nick ? fromMon.nick : msxMonName(species)}</b><button type="button" className="msx-dt-more" data-msx-detail-open onClick={() => setDetail(true)}>🔍 詳しく</button></div>
          <div className="v-p1grow" data-msx-start-type><span className="k">成長の型</span><b className="yel">{growName}</b>{peakText ? <span className="v">{msxPeakWords(peakText).map((w, i) => <span key={i} className="w">{w}</span>)}</span> : null}</div>
          <div className="v-p1st" data-msx-start-stats>{MSX_STATS.map((k, i) => { const v = Number(startSt[k]) || 0; const top = Math.max(300, ...MSX_STATS.map((q) => Number(startSt[q]) || 0)); return (
            <div key={k} className="r"><span className="n">{MSX_STAT_NAME[k]}</span><b>{v}</b><i className={`g g${msxAptCls(apt[i])}`} title="伸びやすさ">{apt[i]}</i><span className="bar"><span style={{ width: `${Math.max(4, Math.min(100, (v / top) * 100))}%`, background: MSX_STAT_COLOR && MSX_STAT_COLOR[k] ? MSX_STAT_COLOR[k] : '#94a3b8' }}/></span></div>); })}</div>
          <div className="v-p1note">右の字は<b>伸びやすさ</b>(A が一番伸びる → E)</div>
        </div>
      </div>
      {detail && <MsxMonDetail pick={{ sel: tpSel, locked: () => false, onPick: onTechPick }} species={species} name={fromMon && fromMon.nick ? fromMon.nick : msxMonName(species)} sub={fromMon ? '合体で生まれたモンスター' : 'ベースモン'} st={startSt} apt={apt} type={growType} grades={preview.grades} peak={peakText} power={preview.power} rank={preview.rank} onClose={() => setDetail(false)} SUC={SUC}/>}
    </>);
    go = 'このモンスターにする ▶';
  } else if (step === 1) {
    // r1115-115: 自分のモンスターは6枠のどこにも入る(同じ子は1枠だけ・ほかの枠にいれば移す)。フレンドのいる枠へ自分の子を入れたら、フレンドは外れる
    const putSlot = (i, v) => {
      if (friend && i === friendAt) { setFriend(null); }
      setTeamSlotsSt((cur) => {
        const n = cur.slice();
        if (v && v.box) { const at = n.findIndex((t) => t && t.box === v.box); if (at >= 0) n[at] = null; }
        if (v && v.assist) { const at = n.findIndex((t) => t && t.assist === v.assist); if (at >= 0) n[at] = null; }
        n[i] = v; return n;
      });
    };
    const putFriend = (i, m) => {
      if (!m) { setFriend(null); return; }
      setFriend(m); setFriendAt(i); setTeamSlotsSt((cur) => { const n = cur.slice(); n[i] = null; return n; });
    };
    const lendOn = typeof MsxFriendPick === 'function' && typeof monsucLendFriends === 'function';
    // r1115-096(社長): 編成の画面は6枠を大きく並べるだけ。枠を押すと選ぶ画面(全画面 MsxTeamPick)へ。フレンドのいる枠はフレンドの貸し出しの一覧(MsxFriendPick)へ
    //   r1115-115(社長): 6枠のどこにも自分のモンスター・フレンドは最大1体(どの枠にも。入れなくてもよい)。選ぶ画面の「🤝 フレンド」タブから一覧へ
    const openSlot = (i) => (friend && i === friendAt && lendOn ? setFriendOpen(i) : setSlotPick(i));
    const sameBond = members.every((m) => m.bond0 === members[0].bond0 && m.tag === members[0].tag);
    body = (<>
      {/* 説明は短く・言葉の途中で折らない(2026-11-14 社長「文字のはみ出し」) */}
      <div className="v-h">編成の6体<small style={typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined}>{(typeof jaWrap === 'function' ? jaWrap : (t) => t)('6枠のどこにも自分のモンスターを入れられ、フレンドは1体まで。強いモンスターほどよく伸びる')}</small></div>
      {/* ④段2(社長の実機の指摘): 点線の箱と同じ文の繰り返しをやめ、共通の型の札(中)を3列×2段。札ごとに違う物だけを札に出す
          (左上=伸びが上がる能力・右上=評価・下の帯=役)。どの枠も同じ親密度・タッグは下に1か所だけ */}
      <div className="msx-team6 msx-team6c" data-msx-team6><MonsucCardGrid size="m">
        {members.map((m, i) => { const rec = m.boxId && box && Array.isArray(box.mons) ? box.mons.find((x) => x.id === m.boxId) : m.assistId && data.assist && Array.isArray(data.assist.mons) ? data.assist.mons.find((x) => x.id === m.assistId) : null;
          const role = m.friend ? { text: 'フレンド', kind: 'friend' } : m.kind === 'base' ? { text: 'ベースモン', kind: 'base' } : m.assistId ? { text: 'メモモン', kind: 'memo' } : { text: 'マスモン', kind: 'box' };
          return (<div key={i} className="msx-t6w">
            <MonsucMonCard m={{ ...msxTpCardM(rec, m, m.species), fav: [] }} size="m" tag={role} num={msxTpBonusText(m)} onClick={() => openSlot(i)} attrs={{ 'aria-label': `${i + 1}枠目 ${m.name}(押して変える)`, 'data-msx-slot': i, ...(m.assistId ? { 'data-msx-team-slot-assist': m.assistId } : {}), ...(m.boxId ? { 'data-msx-team-slot-box': m.boxId } : {}) }}/>
            {!sameBond ? <small className="msx-t6b">親密度 {m.bond0}・{'\u200b'}タッグ +{m.tag}%</small> : null}
          </div>); })}
      </MonsucCardGrid></div>
      <div className="msx-note msx-sl-legend" data-msx-slot-legend>{sameBond ? `どの枠も 初めの親密度 ${members[0].bond0}・友情タッグ +${members[0].tag}%。` : ''}カードの下は、そのモンスターといっしょにトレーニングしたときに伸びが上がる能力と割合(%)。カードを押すと入れ替え</div>
      <button type="button" className="v-card msx-heat-btn" data-msx-gather-open onClick={() => setGatherOpen(true)}><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>この編成が集まりやすいトレーニング<span className="msx-dt-sm"> 押すと表 ▶</span></div>
        <div className="v-heat">{MSX_STATS.map((k, i) => <div key={k} className={heat[i] >= 3 ? 'x3' : heat[i] === 2 ? 'x2' : ''}><span className="hi" aria-hidden="true">{msxTrainIcon(k, 1)}</span>{MSX_STAT_NAME[k]}<b>{heat[i]}体</b></div>)}</div></button>
    </>);
    ftPre = (<>
      <button type="button" disabled={!(raised.length || stock.length) || typeof msxTeamAuto !== 'function'} onClick={() => setTeamSlotsSt((cur) => msxTeamAuto(cur, raised, stock, SUC, box, species, data.assist, friend ? friendAt : null))} data-msx-team-auto>おまかせ</button>
      <button type="button" disabled={typeof MsxTeamEffects !== 'function'} onClick={() => setEffectsOpen(true)} data-msx-team-effects-open>効果一覧</button>
    </>);
    go = 'この編成でいく ▶';
    if (slotPick != null && typeof MsxTeamPick === 'function') full = (<MsxTeamPick idx={slotPick} slots={teamSlotsSt} members={members} own={species} unlocked={unlocked} raised={raised} stock={stock} SUC={SUC} box={box} assistData={data.assist}
      friendAt={friend ? friendAt : null} onFriend={lendOn ? () => { const i = slotPick; setSlotPick(null); setFriendOpen(i); } : null}
      onDone={(v) => { putSlot(slotPick, v); setSlotPick(null); }} onClose={() => setSlotPick(null)}/>);
    else if (slotPick != null) body = (<>{body}<MsxSlotPicker idx={slotPick} cur={team[slotPick]} own={species} unlocked={unlocked} raised={raised} stock={stock} teamBox={teamBox} teamRaisedN={teamRaisedN} SUC={SUC}
      onPick={(v) => { putSlot(slotPick, v); setSlotPick(null); }} onClose={() => setSlotPick(null)}/></>);
    if (friendOpen !== false && friendOpen != null) full = (<MsxFriendPick idx={friendOpen} friendAt={friend ? friendAt : null} lendList={lendList} onLoad={openLend} friend={friend} members={members} SUC={SUC}
      onPick={(m) => { putFriend(friendOpen, m); setFriendOpen(false); }} onOwn={() => { const i = friendOpen; setFriendOpen(false); setSlotPick(i); }} onClose={() => setFriendOpen(false)}/>);
    if (effectsOpen) body = (<>{body}<MsxTeamEffects members={members} onClose={() => setEffectsOpen(false)}/></>);
    if (gatherOpen) body = (<>{body}<MsxGatherTable members={members} SUC={SUC} onClose={() => setGatherOpen(false)}/></>);
  } else if (step === 2) {
    const combo = SUC.TRAIN_COMBO && SUC.TRAIN_COMBO[aid];
    body = (<>
      <div className="v-h">どの助手と育てる?<small>助手ごとに、筋書き・出来事・トレーニングの組み合わせが変わる</small></div>
      <div className="v-faces">
        {MSX_SCENARIOS.filter((x) => msxAidOpen(x.aid)).map((x) => <button type="button" key={x.aid} className={aid === x.aid ? 'on' : ''} onClick={() => setAid(x.aid)}><img src={msxFace(x.aid)} alt={msxAidName(x.aid)}/></button>)}
        {/* 準備中の助手は7人の黒い影を並べず、1枚にまとめる(Q-3-8)。押すとみゅあの一言(tut.lock) */}
        {(() => { const soon = [...MSX_SCENARIOS.filter((x) => !msxAidOpen(x.aid)).map((x) => x.aid), ...MSX_SOON_AIDS]; return soon.length ? (
          <span className="lk soon v-soon1" role="button" tabIndex={0} aria-label="ほかの助手は準備中" data-msx-soon={soon[0]} onClick={() => setLockTalk((n) => n + 1)}>
            <span className="fs">{soon.slice(0, 3).map((a) => <img key={a} src={msxFace(a)} alt=""/>)}</span><b>ほかの助手 {soon.length}人は準備中</b>
          </span>) : null; })()}
      </div>
      <div className="v-card sel" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div className="v-sc"><div className="pic"><img src={msxBody(aid, 'happy')} alt=""/></div><div className="tx">
          <h4><small>{msxAidName(aid)}編</small>{sc.title}</h4>
          <div style={{ marginTop: 4 }}>{sc.lead}</div>
          <div style={{ marginTop: 5 }}><span className="chip on">{sc.tag}</span> <span className="chip p">仲良し度 Lv{aidLv}</span></div></div></div>
        <div className="v-kv"><b>助手の効き</b><span>{sc.perk}</span></div>
        {combo && <div className="v-kv"><b>トレーニングの組み合わせ</b><div className="v-combo" data-msx-train-combo>{MSX_STATS.map((k) => <div key={k} className="v-combo-r"><span className="v-ctag main" style={{ borderColor: MSX_STAT_COLOR[k], color: MSX_STAT_COLOR[k], background: `${MSX_STAT_COLOR[k]}1f` }}>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</span><span className="v-combo-a">→</span>{combo[k].map((c) => <span key={c} className="v-ctag" style={{ color: MSX_STAT_COLOR[c] }}>+{MSX_STAT_ICON[c]}{MSX_STAT_NAME[c]}</span>)}</div>)}</div></div>}
        <div className="v-kv"><b>初めの親密度</b><span>{Math.min((SUC.BOND && SUC.BOND.aidStartMax) || 40, aidLv * ((SUC.BOND && SUC.BOND.aidPerLv) || 4))}(仲良し度 Lv{aidLv})。助手もトレーニングに来て、タッグになる</span></div>
        <div className="v-eps">{sc.eps.map((t, i) => <div key={i}><b>{i + 1}話</b>{t}</div>)}<div className="lk"><b>4話</b>🔒 ？？？</div></div>
        <div className="row" style={{ marginTop: 'auto' }}><img className="fc" src={msxFace(aid, 'wink')} alt=""/><div className="bub f1">「{aid === 'atsu' ? 'よし、いっちょ仕上げてくか。よろしくな笑' : 'いっしょに ヒーローズファイナル めざそ! まぢで楽しいから!'}」</div></div>
      </div>
    </>);
    go = `${msxAidName(aid)}編にする ▶`; // 「始める」は 6/6 の「育成を始める」だけに使う(押しても育成は始まらないため)
  } else if (step === 3) {
    const has = (id) => (meta.items && meta.items[id]) || 0;
    const toggle = (id) => setItems((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 || has(id) <= 0 ? cur : [...cur, id]));
    const coreItems = (id) => !!(SUC.ITEMS && SUC.ITEMS[id]);
    const ownN = MSX_ITEMS.filter((t) => has(t.id) > 0 || items.includes(t.id)).length;
    body = (<>
      <div className="v-h">持ちこみ(2つまで)<small>手に入れた物を、育成に持っていける。持っていかなくてもよい</small></div>
      <div className="v-bag">{[0, 1].map((i) => items[i] ? <div key={i} className="in"><span style={{ fontSize: 24 }}>{MSX_ITEM_BY_ID[items[i]].e}</span><small>{MSX_ITEM_BY_ID[items[i]].name}</small></div> : <div key={i}>＋<small style={{ color: '#94a3b8' }}>空き</small></div>)}</div>
      {/* 持っていない物の灰色の札を並べない(Q-3-6)。持っている物・選んだ物だけを升目に出し、持っていない物は畳む。交換所へはその場で行ける(Muse id48) */}
      {!ownN ? <div className="v-card v-nobring" data-msx-carry-none>まだ持ちこめる物がありません。<b>ビートP交換所</b>で手に入れると、ここで選べます(持っていかなくても始められます)</div> : null}
      {onOpenShop ? <button type="button" className="v-shopgo" onClick={onOpenShop} data-msx-carry-shop-open>🛒 ビートP交換所で手に入れる</button> : null}
      <div className="v-igrid">
        {MSX_ITEMS.filter((t) => showAll || has(t.id) > 0 || items.includes(t.id)).map((t) => (
          <button type="button" key={t.id} className={`${items.includes(t.id) ? 'in' : ''}${t.when === 'both' ? ' bo' : ''}${!has(t.id) && !items.includes(t.id) ? ' none' : ''}${look === t.id ? ' look' : ''}`} onClick={() => { setLook(t.id); toggle(t.id); }} data-msx-carry-item={t.id}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.e}</span><i>×{has(t.id)}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode(t.name)}</small>{items.includes(t.id) ? <u>✔</u> : null}
          </button>
        ))}
      </div>
      {MSX_ITEMS.length > ownN ? <button type="button" className="v-allgo" onClick={() => setShowAll((v) => !v)} aria-pressed={showAll} data-msx-carry-all>{showAll ? '▲ 持っていない物を隠す' : `▼ 持っていない物も見る(${MSX_ITEMS.length - ownN}個)`}</button> : null}
      <div className="v-ileg"><span><b className="sw1"/>始める前に効く物</span><span><b className="sw2"/>育成中にも使える物(1ターン1個まで)</span></div>
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }} data-msx-carry-list>
        {look && MSX_ITEM_BY_ID[look] ? (() => { const t = MSX_ITEM_BY_ID[look]; const n = has(look); return (
          <div className="v-bsel" style={{ marginBottom: 6 }} data-msx-carry-look={look}><span className="e" style={{ fontSize: 30 }}>{t.e}</span><div style={{ minWidth: 0 }}>
            <b>{t.name}<span className="yel"> ×{n}</span></b>
            <small style={JA_WRAP_STYLE}>{jaWrap(msxItemDesc(look))}</small>
            <small style={{ ...JA_WRAP_STYLE, color: '#7dd3fc' }}>{jaWrap(t.when === 'before' ? 'いつ: 育成を始める前に効き、その育成のあいだ続く' : look === 'pack' ? 'いつ: 持ちこんだ時点で中身が持ち物に入っている。中身は育成中の自分のターンに使う(1ターン1個まで・ターンは進まない)' : 'いつ: 育成中の自分のターンに使う(1ターン1個まで・ターンは進まない)')}</small>
            <small style={{ ...JA_WRAP_STYLE, color: '#fcd34d' }}>{jaWrap(n > 0 ? (items.includes(look) ? '持っていく物に入っている(もう一度押すと外す)' : items.length >= 2 ? '持っていけるのは2つまで(ほかを外すと選べる)' : '押すと持っていく物に入る') : '手に入れ方: マーケットのビートP交換所・助手ライフの拾い物や贈り物')}</small>
          </div></div>); })() : <div className="msx-note" style={{ marginBottom: 6 }}>升目を押すと、効き目と手に入れ方が出ます</div>}
        {items.map((id) => <div key={id} className="v-item sel"><span style={{ fontSize: 22 }}>{MSX_ITEM_BY_ID[id].e}</span><div>{MSX_ITEM_BY_ID[id].name}<small>{msxItemDesc(id)}</small></div><span className="pr">✅ 持っていく・あと{has(id) - 1}</span></div>)}
        {/* 持っている物の効き目も下に並べる(下を空けない。docs/spec/MONSUC_UI.md の 1) */}
        {MSX_ITEMS.filter((t) => has(t.id) > 0 && !items.includes(t.id)).map((t) => <div key={t.id} className="v-item" style={{ opacity: .85 }}><span style={{ fontSize: 22 }}>{t.e}</span><div>{t.name}<small>{msxItemDesc(t.id)}</small></div><span className="pr" style={{ color: '#cbd5e1' }}>×{has(t.id)}</span></div>)}
        {items.some((id) => !coreItems(id)) && <div className="msx-note" style={{ marginTop: 6 }}>まだ効き目が入っていない物があります(その物は持っていっても数は減りません)</div>}
      </div>
    </>);
    go = '次へ ▶';
  } else if (step === 4) {
    const onDye = (idx, colorId) => setColors((cur) => { const n = cur.slice(); while (n.length <= idx) n.push(null); n[idx] = colorId; return n; });
    const onCustom = (idx) => { const p = typeof _parseCustomColorId === 'function' ? _parseCustomColorId(colors[idx]) : null; const h = p ? (p.h + 40) % 360 : 200; if (typeof _encodeCustomColorId === 'function') onDye(idx, _encodeCustomColorId(h, 0.7, 0.85)); };
    body = (<>
      <div className="v-h">名前と染色<small>あとからいつでも変えられる</small></div>
      {scene({ mb: '14%', h: '72%' }, <div className="v-chips"><span className="v-chip">成長の型: {growName}</span></div>)}
      <div className="v-lmain">
      <label className="v-inp" style={{ display: 'flex' }}>
        <input type="text" value={nick} maxLength={MSX_NAME_MAX} placeholder={msxMonName(species).slice(0, MSX_NAME_MAX)} onChange={(e) => { setNick(e.target.value.slice(0, MSX_NAME_MAX)); setNameErr(''); }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#1e1b4b', font: 'inherit', fontSize: 16 }}/>
        <small>{(nick || '').length} / {MSX_NAME_MAX}文字</small>
      </label>
      {nameErr && <div className="msx-note" style={{ color: '#fca5a5' }}>{nameErr}</div>}
      <div className="v-card" style={{ maxHeight: '34%', overflowY: 'auto' }}>
        {typeof DyeRegionColorControls === 'function' ? <DyeRegionColorControls baseId={species} colors={colors} onChange={onDye} onCustom={onCustom} big tone="yellow" names={typeof ASSISTANT_MASMON_DYE_PARTS !== 'undefined' && ASSISTANT_MASMON_DYE_PARTS[species] ? ASSISTANT_MASMON_DYE_PARTS[species].map((x) => x[0]) : null}/> : <div className="msx-note">染色はこの端末では使えません</div>}
      </div>
      </div>
    </>);
    go = '次へ ▶';
  } else {
    // 初めの能力に足す分: 芯の newRun と同じ計算(編成の6体それぞれの、いちばん高い能力 ÷ 25 を、その能力に足す。受け継ぎ草を持ちこむと ×2)。
    //   2/6 の札の「📖+4」などはトレーニングの効き(%)で、別の物(r1120 窓口: 6/6 の数字が 2/6 の札と合わないように見えた)
    const startMul = items.some((id) => SUC.ITEMS && SUC.ITEMS[id] && SUC.ITEMS[id].good === 'uketsugu') ? ((SUC.GOOD && SUC.GOOD.uketsugu && SUC.GOOD.uketsugu.start) || 2) : 1;
    const startAdd = {}; members.forEach((m) => { if (m.startAdd && m.startAdd.v > 0) startAdd[m.startAdd.stat] = (startAdd[m.startAdd.stat] || 0) + m.startAdd.v * startMul; });
    const name = nick || msxMonName(species).slice(0, MSX_NAME_MAX);
    // 能力の上限アップ(r1115-103): 編成で 999 より上がる能力だけ出す
    const capUp = typeof SUC.capOfTeam === 'function' ? Object.entries(SUC.capOfTeam(members)).filter(([, v]) => v > 999) : [];
    body = (<>
      <div className="v-h">これで 始める?<small>全46ターン・1回 約8〜15分。いつでも中断して続きから</small></div>
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg(1).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '36%', bottom: 'calc(16% - 5px)' }}/>
        {colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? <span className="mon" style={{ left: '36%', bottom: '16%', height: '62%' }}><DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>
          : <img className="mon" src={msxMonImg(species)} alt="" style={{ left: '36%', bottom: '16%', height: '62%' }}/>}
        <span className="v-nm" style={{ left: '36%', bottom: 6 }}>{name}{name !== msxMonName(species) ? <small>{msxMonName(species)}</small> : null}</span>
        <img src={msxBody(aid, 'happy')} alt="" style={{ position: 'absolute', right: '-4%', bottom: 0, width: '50%', height: '78%', objectFit: 'contain', objectPosition: 'right bottom' }}/>
      </div>
      <div className="v-lmain">
      {/* 編成は④の共通の型の札(小)で6体を1列に並べ、名前まで読めるようにする(点検 2026-11: 約22pxの顔だけで、だれで育てるのか分からなかった) */}
      <div className="v-sum v-s6team" data-msx-s6-team>
        <div className="v-s6hd"><span className="k">編成</span><button type="button" className="v-edhit" onClick={() => setStep(1)}><span className="ed">変える</span></button></div>
        {typeof MonsucMonCard === 'function' ? (
          <MonsucCardGrid size="s">{members.map((m, i) => <MonsucMonCard key={i} size="s" m={{ species: m.species, nick: m.name || null, colors: m.colors || null, grade: m.rank && m.rank !== 'base' ? m.rank : '' }} tag={m.friend ? { text: 'フレンド', kind: 'friend' } : null}/>)}</MonsucCardGrid>
        ) : null}
      </div>
      {typeof msxScenarioOf === 'function' ? <button type="button" className="v-sum" onClick={() => setScn(null)}><span className="k">ストーリー</span><span>{msxScenarioOf(scn).name}</span><span className="ed">変える</span></button> : null}
      <button type="button" className="v-sum" onClick={() => setStep(2)}><span className="k">助手</span><span>{msxAidName(aid)}</span>{/* 題はストーリーの行の1つだけ(再点検 msx-S6: 題が2つ並んでいた) */}<span className="ed">変える</span></button>
      <button type="button" className="v-sum" onClick={() => setStep(3)}><span className="k">持ちこみ</span><span style={JA_LABEL_STYLE}>{jaWrap(items.length ? items.map((id) => `${MSX_ITEM_BY_ID[id].e}${MSX_ITEM_BY_ID[id].name}`).join('・') : 'なし')}</span><span className="ed">変える</span></button>
      {/* 何に何を足すのかを言葉で(「初めの上乗せ」だけでは伝わらなかった) */}
      <div className="v-sum v-s6add" data-msx-s6-add><span className="k">初めの能力に足す分</span><span>{Object.keys(startAdd).length ? <>{Object.entries(startAdd).map(([k, v]) => `${MSX_STAT_NAME[k]} +${v}`).join('・')}<small className="v-sumsub">{`編成の6体それぞれの、一番高い能力の 1/25 を、その能力に足します${startMul > 1 ? `(受け継ぎ草で ×${startMul})` : ""}`}</small>
        {/* どの子から何が来たかの内訳(API 点検: 式だけでは分からない)。押すと開く */}
        <details className="v-s6det"><summary>内訳を見る</summary>{members.map((m, i) => (m.startAdd && m.startAdd.v > 0 ? <span key={i} className="v-s6row"><b>{m.name || msxMonName(m.species)}</b>{`${MSX_STAT_NAME[m.startAdd.stat]} +${m.startAdd.v * startMul}`}</span> : null))}</details></> : '編成のモンスターからの足し分はありません'}</span></div>
      {capUp.length ? <div className="v-sum" data-msx-start-cap><span className="k">能力の上限</span><span>{capUp.map(([k, v]) => `${MSX_STAT_NAME[k]} ${v.toLocaleString()}`).join('・')}</span></div> : null}
      <button type="button" className="v-big" onClick={start}>🌱 育成を始める</button>
      </div>
    </>);
  }
  if (full) return full;
  return (
    <>
      {/* 出口は見出しの左上だけにそろえる(戻る系ボタン統一・2026-11-18 社長決定)。下の帯にも同じ
          戻るがあったのを廃止し、言葉も段によらず「戻る」に固定する(同じ back() なのに言葉だけ
          変わっていた)。step=0 の戻り先はシナリオ選択(無ければサクセスの入口)で、意味は一貫して「戻る」 */}
      {/* いまの段は下の段の帯(MsxSteps)の1か所だけ(右上の「2 / 6」と二重だった・育-92) */}
      <MsxHd back="戻る" onBack={back}/>
      {/* 中身が画面より長い段(持ちこみ・確認・低い画面)は本体ごと縦に流す(st)。指定が無いと中身が下の帯の後ろへはみ出し、
          最後まで読めず触れなかった(r1119 社長の実機「スライドできない・裏と表になってる」)。p1/one/lg3 は段ごとの並べ方(r1119 ⑦) */}
      <div className={`v-body st${step === 0 ? ` p1${p1few ? ' few' : ''}` : step === 2 || step === 3 ? ' one' : step >= 4 ? ' lg3' : ''}`}>
        <MsxSteps n={step}/>
        {body}
      </div>
      {go && <div className={`v-ft${ftPre ? ' msx-ft3' : ''}`}>{ftPre}<button type="button" className="go" onClick={next}>{go}</button></div>}
      {typeof MsxBetaTalk === 'function' ? (lockTalk ? <MsxBetaTalk key={`lock${lockTalk}`} keys={['lock']} always ctx={betaCtx} onDone={() => setLockTalk(0)}/> : (slotPick != null || gatherOpen || friendOpen !== false || effectsOpen ? null : <MsxBetaTalk keys={[step === 0 ? 'prep' : step === 1 ? 'team' : step === 3 ? 'bring' : null]} ctx={betaCtx}/>)) : null /* 窓を開いている間は説明を出さない。前に出す窓は1枚だけ(API 点検 msx-S2E) */}
    </>
  );
}
