// ===== モンヒロサクセス(育成の画面・回2)の土台: 公開の印・計算の芯と台本の読み込み・保存・台詞 =====
// 計画: docs/progress/player-raise/PLAN.md(§1・§9・§10)。画面は 56-monhero-success-start.jsx / 56-monhero-success-main.jsx
// ★公開の印 RELEASE_FLAGS.monheroSuccess は偽のまま。入口はデバッグ設定だけ(MonheroSuccessDebugEntry)。
// ★計算は data/monhero-success.js(計算の芯・別の会話のクラフトが受け持つ)の create() を呼ぶだけ。ここで伸びの式は書かない。
//   芯と台本エンジン(data/monhero-success-script-engine.js・キズナ)は index.html では読まず、この画面を開いたときにだけ読む。
//   台本の中身(共通 + 選んだ助手の分)は、エンジンの load(助手) が必要になったときに読む。
// ★保存は新しいキー3つだけ(CLAUDE.md ⑦・PLAN §9)。既存のキー(mh_unlocked_monsters・助手の仲良し度など)は読むだけ。
//   読み込みは必ず msxNorm* を通す。壊れていたら「途中の育成なし・保存枠は空」として扱い、元の値は消さない(上書きは新しく始めたときだけ)。
const MSX_KEYS = Object.freeze({ run: 'mh_monsuc_run_v1', box: 'mh_monsuc_box_v1', meta: 'mh_monsuc_meta_v1' });
const MSX_CORE_SRC = 'data/monhero-success.js';
// 題字ロゴ(社長の原本 logo-a を横800×320・減色PNG にした写し・2026-11-14)。お話「モンヒロサクセス 第1話」の幕開けでも使う(写しは1つ)
const MSX_LOGO_ART = 'images/success/logo-monhero-success.png';
const MSX_ASSIST_SRC = 'data/monhero-success-assist.js'; // アシスト能力の表(第2版・段1〜5)。芯に渡す(2026-11-12)
const MSX_SCRIPT_SRC = 'data/monhero-success-script-engine.js'; // 台本エンジン(window.MONHERO_SUCCESS_SCRIPT_ENGINE)
const MSX_EVENTS_SRC = 'data/monhero-success-events.js'; // ランダムイベントの部品(芯が create のときに window.MONHERO_SUCCESS_EVENTS を拾う)
const MSX_SCENES_SRC = 'data/success-scenes.js'; // 住む場所の景色(季節×時間)・大会の会場・修行の景色。window に successHomeScene などを置く
const MSX_ARC_SRC = 'data/monhero-success-arc.js'; // 助手1人分のストーリーの表(固有イベント・頂への道の相手えらび・お祝い。2026-11-13)。芯が create のときに拾う
const MSX_REGULARS_SRC = 'data/monhero-success-regulars.js'; // 大会の常連の表(const だけの形なので typeof で見る)
const MSX_ISSA_ART = 'images/success/issa-hakase.png';
// シナリオ(助手)。台本があるのは みゅあ・あつ(第1弾)。ほかは準備中。β版で選べるのはみゅあだけ(56-monsuc-beta.jsx の MSX_BETA_AIDS)
const MSX_SCENARIOS = Object.freeze([
  { aid: 'mua', no: 1, title: 'いっしょに、てっぺんへ!', lead: '明るく元気なムードメーカーと、笑いながら頂点をめざす物語。はじめての育成におすすめ', tag: 'やさしい',
    perk: '遊ぶ・休むでストレスが 1.3倍 減る。褒めたときの忠誠 +1', eps: ['はじめての おでかけ', 'はげまし合う夜', 'ふたりの約束'] },
  { aid: 'atsu', no: 2, title: '仕上げて、勝ちに行く', lead: '面倒見のいい兄貴分と、コツコツ仕上げて大会をとりにいく物語', tag: 'ふつう',
    perk: 'トレーニングの組み合わせが あつ流(ちから → ライフ・回避 など)', eps: ['はじめての特訓', '雨の日の作戦会議', '仕上げの約束'] },
]);
const MSX_SOON_AIDS = Object.freeze(['kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin']);
const MSX_STAT_ICON = Object.freeze({ life: '❤️', pow: '💪', wise: '🧠', hit: '🎯', eva: '💨', tough: '🛡️' });
const MSX_STAT_NAME = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
// トレーニングの名前(2026-11-13 社長「トレごとに特色を」。うちのオリジナル)と、その場面の小物
const MSX_TRAIN_NAME = Object.freeze({ life: '坂道ダッシュ', pow: '丸太割り', wise: '積み木パズル', hit: '的当て', eva: '落ち葉よけ', tough: '岩受け止め' });
const MSX_TRAIN_ICON = Object.freeze({ life: '🏃', pow: '🪵', wise: '🧩', hit: '🎯', eva: '🍂', tough: '🪨' });
// トレーニングLv(1〜5)ごとの名前と見出しの絵(2026-11-13 社長「トレーニング名はレベルごとに名前を変えて」。段が上がるほど大きく・強そうに)
const MSX_TRAIN_LV = Object.freeze({
  life: [['坂道ダッシュ', '🏃'], ['丘越えダッシュ', '🏃'], ['山道かけ登り', '⛰️'], ['雪山かけ登り', '🏔️'], ['火山かけ登り', '🌋']],
  pow: [['丸太割り', '🪵'], ['大丸太割り', '🪵'], ['岩割り', '🪨'], ['大岩くだき', '🪨'], ['鉄球くだき', '⚫']],
  wise: [['積み木パズル', '🧱'], ['絵合わせパズル', '🧩'], ['迷路ときあかし', '🌀'], ['星図よみ', '✨'], ['古文書ときあかし', '📜']],
  hit: [['的当て', '🎯'], ['遠くの的当て', '🎯'], ['動く的当て', '🎯'], ['三つ的当て', '🎯'], ['流星の的当て', '🌠']],
  eva: [['落ち葉よけ', '🍂'], ['木の実よけ', '🌰'], ['雪玉よけ', '❄️'], ['落石よけ', '🪨'], ['流れ星よけ', '🌠']],
  tough: [['岩受け止め', '🪨'], ['大岩受け止め', '🪨'], ['滝打たれ', '💧'], ['落石受け止め', '🪨'], ['隕石受け止め', '☄️']],
});
const msxTrainLvAt = (lv) => Math.max(1, Math.min(5, Math.round(Number(lv)) || 1));
const msxTrainName = (stat, lv) => { const t = MSX_TRAIN_LV[stat]; return t ? t[msxTrainLvAt(lv) - 1][0] : ''; };
// 札で2行に折るとき、言葉の途中で折らない(「火山|かけ登り」のように、うしろの動きの言葉の前でだけ折る)
const MSX_TRAIN_TAIL = Object.freeze(['ときあかし', 'ダッシュ', 'かけ登り', '受け止め', 'パズル', 'くだき', '的当て', '打たれ', '割り', 'よけ', 'よみ']);
const msxTrainNameParts = (stat, lv) => { const n = msxTrainName(stat, lv); const t = MSX_TRAIN_TAIL.find((x) => n.endsWith(x) && n.length > x.length); return t ? [n.slice(0, n.length - t.length), t] : [n]; };
const msxTrainIcon = (stat, lv) => { const t = MSX_TRAIN_LV[stat]; return t ? t[msxTrainLvAt(lv) - 1][1] : '💪'; };
const MSX_STATS = Object.freeze(['life', 'pow', 'wise', 'hit', 'eva', 'tough']);
const MSX_BOX_CAP0 = 30;

// ---- 公開の印(偽のあいだはデバッグの入口から開いたときだけ) ----
let msxDebugOpened = false;
const msxReleased = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.monheroSuccess === true;
const msxOn = () => msxReleased() || msxDebugOpened;

// ---- 計算の芯と台本の読み込み(1回だけ) ----
const msxLoadScript = (src, globalName) => new Promise((res) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') { res(null); return; }
  if (window[globalName]) { res(window[globalName]); return; }
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => res(window[globalName] || null);
  s.onerror = () => res(null);
  document.head.appendChild(s);
});
// const を置くだけのファイル(window に載らない)。読み終わったら check() で確かめる。2度読まない
const msxLoadConstScript = (src, check) => new Promise((res) => {
  if (check()) { res(true); return; }
  if (typeof document === 'undefined') { res(false); return; }
  const s = document.createElement('script'); s.src = src;
  s.onload = () => res(check()); s.onerror = () => res(false);
  document.head.appendChild(s);
});
// 常連の表は開いたときに読む別ファイルの const なので、名前を直に書かず、読み終わってから大域の名前で引く
const msxGlobalConst = (name) => { try { return new Function(`return typeof ${name} !== 'undefined' ? ${name} : null;`)(); } catch (e) { return null; } };
const msxRegularsOk = () => !!msxGlobalConst('MONSUC_REGULARS') && !!msxGlobalConst('MONSUC_REGULAR_CUPS');
let msxLoading = null;
let msxSuc = null;
const msxLoad = () => {
  if (msxSuc) return Promise.resolve(msxSuc);
  if (!msxLoading) {
    msxLoading = Promise.all([msxLoadScript(MSX_CORE_SRC, 'MONHERO_SUCCESS'), msxLoadScript(MSX_SCRIPT_SRC, 'MONHERO_SUCCESS_SCRIPT_ENGINE'), msxLoadConstScript(MSX_REGULARS_SRC, msxRegularsOk), msxLoadScript(MSX_SCENES_SRC, 'successHomeScene'), msxLoadScript(MSX_EVENTS_SRC, 'MONHERO_SUCCESS_EVENTS'), msxLoadScript(MSX_ASSIST_SRC, 'MONHERO_SUCCESS_ASSIST'), msxLoadScript(MSX_ARC_SRC, 'MONHERO_SUCCESS_ARC')]).then(([core, script, regOk]) => {
      if (!core || typeof core.create !== 'function') { msxLoading = null; return null; }
      if (typeof MASMON_CALC === 'undefined' || typeof AMG_APT === 'undefined' || typeof AMG_INIT === 'undefined') { msxLoading = null; return null; }
      try {
        // 大会名・相手の名前・技に要る表も渡す(無ければ芯が既定で動く)
        const SUC = core.create({
          calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT,
          techs: typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null,
          types: typeof MONSTER_TYPE_OF !== 'undefined' ? MONSTER_TYPE_OF : null,
          monsters: typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : null,
          lineage: typeof MONSTER_LINEAGE_MAP !== 'undefined' ? MONSTER_LINEAGE_MAP : null, // 血統(同じ血統の子のおすそわけ ev.team.kin。読むだけ)
          regulars: regOk ? msxGlobalConst('MONSUC_REGULARS') : null, cupNames: regOk ? msxGlobalConst('MONSUC_REGULAR_CUPS') : null,
          assist: typeof window !== 'undefined' ? window.MONHERO_SUCCESS_ASSIST || null : null, // 第2版の表(無ければ芯は第1版で動く)
          arc: typeof window !== 'undefined' ? window.MONHERO_SUCCESS_ARC || null : null, // 助手1人分のストーリー(無ければ固有イベントなし・相手えらびは今までの並び)
        });
        msxSuc = { core, SUC, script: script || null };
        return msxSuc;
      } catch (e) { msxLoading = null; return null; }
    });
  }
  return msxLoading;
};

// ---- 正規化(壊れていても落ちない・知らない値は既定) ----
const msxIsObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const msxNum = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const msxStr = (v, max = 40, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const msxColors = (v) => (Array.isArray(v) ? v.slice(0, 6).map((c) => (typeof c === 'string' && c.length <= 40 ? c : null)) : []);
// 途中の育成。core の状態 s をそのまま持つ。芯に restore があればそれを通す(無ければ形だけ確かめる)
const msxNormRun = (raw, SUC) => {
  if (!msxIsObj(raw) || raw.v !== 1 || !msxIsObj(raw.s)) return null;
  let s = raw.s;
  // 賞金の桁を上げる前(印 fameV が芯の FAME_V と違う)の途中の育成は、芯が賞金を ×FAME_SCALE する。期のはじめの控え ki の賞金にも同じ倍率を掛けてそろえる
  const kiFameMul = SUC && Number.isFinite(SUC.FAME_SCALE) && SUC.FAME_V != null && raw.s.fameV !== SUC.FAME_V ? SUC.FAME_SCALE : 1;
  if (SUC && typeof SUC.restore === 'function') { try { s = SUC.restore(s); } catch (e) { s = null; } if (!s) return null; }
  else {
    const okStats = msxIsObj(s.stats) && MSX_STATS.every((k) => Number.isFinite(s.stats[k]));
    const okTeam = Array.isArray(s.team) && s.team.length === 6 && Array.isArray(s.bond) && s.bond.length === 6;
    if (s.v !== 1 || !Number.isFinite(s.turn) || s.turn < 1 || !okStats || !okTeam || !Number.isFinite(s.hp) || !Number.isFinite(s.hpMax)) return null;
    if (SUC && Array.isArray(SUC.speciesList) && !SUC.speciesList.includes(s.species)) return null;
  }
  return {
    v: 1, id: msxStr(raw.id, 64, s.id), s,
    scn: typeof msxScenarioId === 'function' ? msxScenarioId(raw.scn) : 'hero', // シナリオ(2026-11-14 足した項目。無い保存は ヒーローへの道)
    nick: msxStr(raw.nick, 8) || '', colors: msxColors(raw.colors),
    from: msxIsObj(raw.from) && typeof raw.from.box === 'string' ? { box: raw.from.box.slice(0, 64) } : { base: msxStr(raw.from && raw.from.base, 24, s.species) },
    items: Array.isArray(raw.items) ? raw.items.filter((x) => typeof x === 'string').slice(0, 2) : [],
    used: msxNum(raw.used, 0), // 持ち物を使ったターン(1ターン1個まで)
    phase: ['main', 'result', 'react', 'issa', 'battle', 'turn', 'over', 'event', 'story', 'awake', 'tevent'].includes(raw.phase) ? raw.phase : 'main',
    out: msxIsObj(raw.out) ? raw.out : null, // 直前の結果(中断して戻ったときに結果の画面から続ける)
    log: Array.isArray(raw.log) ? raw.log.filter(msxIsObj).slice(-20) : [],
    startAt: msxNum(raw.startAt, 0),
    // ビートP(2026-11-14 足した項目): 本編へ渡した量・育成が終わったときの分を足したか。無い保存は 0 / false
    beatSent: msxNum(raw.beatSent, 0), beatEnd: raw.beatEnd === true,
    // 期のはじめの控え(期の区切りの演出で増えた分を出す。2026-11-13 足した項目・無い保存は null のまま)
    ki: msxIsObj(raw.ki) && Number.isInteger(raw.ki.p) && Number.isFinite(raw.ki.fame) && Number.isFinite(raw.ki.power) ? { p: Math.max(0, Math.min(9, raw.ki.p)), fame: Math.round(Math.min(1e7, raw.ki.fame * kiFameMul)), power: raw.ki.power } : null,
  };
};
// 技表の第2版(2026-11-13): 古い技 id を新しい id へ読み替える(表に canon が無ければそのまま)。techs と mast は同じ並びなので、
//   2つの古い技が1つの新しい技に当たるときは1つにまとめ、熟練は大きい方を残す。保存そのものは書き換えない
const msxTechCanon = (id) => { try { return typeof ASSISTANT_MASMON_TECHS !== 'undefined' && ASSISTANT_MASMON_TECHS && typeof ASSISTANT_MASMON_TECHS.canon === 'function' ? ASSISTANT_MASMON_TECHS.canon(id) : id; } catch (e) { return id; } };
const msxCanonTechs = (techs, mast) => {
  const ids = []; const ms = [];
  (Array.isArray(techs) ? techs : []).forEach((id0, i) => {
    if (typeof id0 !== 'string') return;
    const id = msxTechCanon(id0); const m = Array.isArray(mast) && Number.isFinite(Number(mast[i])) ? Number(mast[i]) : null;
    const at = ids.indexOf(id);
    if (at < 0) { ids.push(id); ms.push(m); } else if (m != null && (ms[at] == null || m > ms[at])) ms[at] = m;
  });
  return { techs: ids.slice(0, 99), mast: ms.slice(0, 99).map((m) => (m == null ? 0 : m)) };
};
const msxNormBoxMon = (m) => {
  if (!msxIsObj(m) || typeof m.id !== 'string' || typeof m.species !== 'string') return null;
  const st = {}; MSX_STATS.forEach((k) => { st[k] = Math.max(0, Math.min(999, Math.round(msxNum(m.st && m.st[k], 0)))); });
  // 回3・合体・レンタルが足す項目(gen・techs・mast・gt・fav・titles・paid・parents ほか)も消さずに持つ(...m)
  const tm = msxCanonTechs(m.techs, m.mast); // 技の上限 8 はなくした・古い技 id は読み替える(2026-11-13)
  return {
    ...m,
    gen: Math.max(1, Math.min(999, Math.floor(msxNum(m.gen, 1)))), techs: tm.techs,
    mast: tm.mast, fav: Array.isArray(m.fav) ? m.fav.filter((k) => MSX_STATS.includes(k)).slice(0, 3) : [],
    titles: Array.isArray(m.titles) ? m.titles.filter((x) => typeof x === 'string').slice(0, 64) : [],
    id: m.id.slice(0, 64), species: m.species.slice(0, 24), nick: msxStr(m.nick, 8), colors: msxColors(m.colors),
    st, loy: Math.max(0, Math.min(100, msxNum(m.loy, 0))), pop: Math.max(0, Math.min(100, msxNum(m.pop, 0))), lv: Math.max(1, Math.min(99, msxNum(m.lv, 1))),
    rank: msxStr(m.rank, 4, ''), score: msxNum(m.score, 0), raised: m.raised !== false,
    assists: Array.isArray(m.assists) ? m.assists.filter(msxIsObj).slice(0, 8) : [], masteries: tm.mast, // assists は第3版で8種類まで(古い子は4つ・形はそのまま。読み替えは芯の memberOf)
    coach: msxStr(m.coach, 16), endAt: msxNum(m.endAt, 0),
    aptUp: [0, 1, 2, 3].map((i) => Math.max(0, Math.min(11, Math.round(msxNum(Array.isArray(m.aptUp) ? m.aptUp[i] : 0, 0))))),
    aptBase: [0, 1, 2, 3].map((i) => Math.max(0, Math.min(11, Math.round(msxNum(Array.isArray(m.aptBase) ? m.aptBase[i] : 0, 0))))),
    awake: Math.max(0, Math.min(2, Math.round(msxNum(m.awake, 0)))), // 覚醒の印(無いマスモンは 0)
    aptAwake: [0, 1, 2, 3].map((i) => Math.max(0, Math.min(3, Math.round(msxNum(Array.isArray(m.aptAwake) ? m.aptAwake[i] : 0, 0))))), // 覚醒で上げた間合い適性(無いマスモンは 0) // 合体で継いだ間合い適性(無いマスモンは 0) // 育成中に上げた間合い適性(無いマスモンは 0)
  };
};
const msxNormBox = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const mons = (Array.isArray(o.mons) ? o.mons : []).map(msxNormBoxMon).filter(Boolean);
  return { ...o, v: 1, cap: Math.max(MSX_BOX_CAP0, Math.min(60, msxNum(o.cap, MSX_BOX_CAP0))), mons, memory: Array.isArray(o.memory) ? o.memory.filter(msxIsObj).slice(-100) : [] };
};
const MSX_ITEM_IDS = Object.freeze(['guide', 'loupe', 'band', 'mag', 'hachi', 'omamori', 'dango', 'grass', 'juice', 'powder', 'license', 'pack', 'oil', 'oilyoil', 'herb', 'hourglass', 'hourglass2', 'ticket']);
const msxNormMeta = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const items = {}; const src = msxIsObj(o.items) ? o.items : {};
  MSX_ITEM_IDS.forEach((k) => { const n = Math.floor(msxNum(src[k], 0)); if (n > 0) items[k] = Math.min(999, n); });
  const team = (Array.isArray(o.team) ? o.team : []).slice(0, 6).map((t) => (msxIsObj(t) && typeof t.box === 'string' ? { box: t.box.slice(0, 64) } : msxIsObj(t) && typeof t.base === 'string' ? { base: t.base.slice(0, 24) } : null));
  return {
    ...o, // 回3が足す retired(引退の回数)などを消さずに持つ
    v: 1, best: msxIsObj(o.best) ? o.best : {}, titles: Array.isArray(o.titles) ? o.titles.filter((x) => typeof x === 'string').slice(0, 200) : [],
    seen: msxIsObj(o.seen) ? o.seen : {}, team, lend: typeof o.lend === 'string' ? o.lend.slice(0, 64) : null,
    gift: msxIsObj(o.gift) ? { day: msxStr(o.gift.day, 12), n: msxNum(o.gift.n, 0) } : { day: '', n: 0 },
    items, runs: Math.max(0, Math.floor(msxNum(o.runs, 0))), picked: msxIsObj(o.picked) ? o.picked : {},
    wonCups: Array.isArray(o.wonCups) ? o.wonCups.filter((x) => typeof x === 'string').slice(0, 500) : [], // 優勝ずみの大会(回3が書く・スキップ用)
  };
};

// 技表の第2版(古い技 id → 新しい id)が入って初めて読むとき、1回だけ元の保存を新しいキーへそのまま写す(CLAUDE.md ⑦。元のキーは書き換えない)
//   写すのは古い技 id を含むときだけ。印 mh_monsuc_tech2_migrated_v1 で二度は写さない。写せなくても読み込みは止めない
const MSX_TECH2_FLAG = 'mh_monsuc_tech2_migrated_v1';
const msxTech2Backup = async (run, box) => {
  try {
    const T = typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null;
    if (!T || typeof T.canon !== 'function' || !T.idmap) return false;
    if (await storeGet(MSX_TECH2_FLAG, null)) return false;
    const old = (ids) => Array.isArray(ids) && ids.some((id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(T.idmap, id));
    const runOld = msxIsObj(run) && msxIsObj(run.s) && (old(run.s.techs) || (msxIsObj(run.s.mastery) && old(Object.keys(run.s.mastery))));
    const boxOld = msxIsObj(box) && Array.isArray(box.mons) && box.mons.some((m) => msxIsObj(m) && old(m.techs));
    if (runOld) await storeSet(MSX_KEYS.run + '_pre_tech2', run);
    if (boxOld) await storeSet(MSX_KEYS.box + '_pre_tech2', box);
    await storeSet(MSX_TECH2_FLAG, { at: Date.now(), run: !!runOld, box: !!boxOld });
    return true;
  } catch (e) { return false; }
};
const msxReadAll = async (SUC) => {
  const [run, box, meta, unlocked] = await Promise.all([
    storeGet(MSX_KEYS.run, null), storeGet(MSX_KEYS.box, null), storeGet(MSX_KEYS.meta, null), storeGet('mh_unlocked_monsters', null),
  ]);
  await msxTech2Backup(run, box);
  const all = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS : {};
  const list = SUC && Array.isArray(SUC.speciesList) ? SUC.speciesList : Object.keys(all);
  const un = (Array.isArray(unlocked) ? unlocked : []).filter((id) => typeof id === 'string' && all[id] && list.includes(id));
  return { run: msxNormRun(run, SUC), box: msxNormBox(box), meta: msxNormMeta(meta), unlocked: un.length ? Array.from(new Set(un)) : list.filter((id) => all[id]).slice(0, 1) };
};
// ---- ビートP(2026-11-14 社長「大会の賞品のコインは、うちではビートP」) ----
// 芯が大会の優勝のたびに s.beatEarned を増やす。本編のビートP(mh_rhythm_event_points_v1・既存のキーにそのまま足す)へは、
// 途中の育成に「本編へ渡した量」run.beatSent を持ち、保存されている途中の育成の beatSent との差だけを、途中の育成と同じ取引で足す。
// → 同じ大会の分を二重に足さない(読み直し・保存の重なり・別のタブでも、保存されている値と比べるので1回だけ)/片方だけ書かれない
const msxBeatMark = (run) => {
  const e = Number(run && run.s && run.s.beatEarned); const sent = Number(run && run.beatSent);
  if (!Number.isFinite(e) || e <= 0) return run;
  return Math.floor(e) > (Number.isFinite(sent) ? Math.floor(sent) : 0) ? { ...run, beatSent: Math.floor(e) } : run;
};
let msxSaveChain = Promise.resolve();
const msxSaveRunNow = async (run, noPay) => {
  const sent = Number.isFinite(Number(run && run.beatSent)) ? Math.max(0, Math.floor(Number(run.beatSent))) : 0;
  if (noPay || !sent || typeof saveStoredValuesOrRollback !== 'function' || typeof loadRhythmEventPoints !== 'function' || typeof RHYTHM_EVENT_POINTS_KEY === 'undefined') return storeSet(MSX_KEYS.run, run);
  const stored = await storeGet(MSX_KEYS.run, null);
  // 渡した量があるのに、保存済みの途中の育成が無い/別の育成(2026-11-14 ミハリ8): ほかのタブで引退・やめたあとの古い画面からの保存。
  //   払わず、書きもしない(全額をもう一度足したり、消した育成を書き戻したりしない)。正しい流れでは育成を始めたときに beatSent 0 で保存済み
  if (!stored || !run || stored.id !== run.id) return false;
  const storedSent = Number.isFinite(Number(stored.beatSent)) ? Math.max(0, Math.floor(Number(stored.beatSent))) : 0;
  const add = sent - storedSent;
  if (add <= 0) return storeSet(MSX_KEYS.run, run);
  const before = await loadRhythmEventPoints();
  return saveStoredValuesOrRollback([
    { key: RHYTHM_EVENT_POINTS_KEY, before, next: Math.min(Number.MAX_SAFE_INTEGER, before + add) },
    { key: MSX_KEYS.run, before: stored, next: run },
  ], storeGet, storeSet);
};
// 保存は順に1つずつ(前の保存が終わってから次を書く。差の計算が重ならないように)
// noPay … デバッグの入口からの育成(2026-11-14 窓口: 社長の本当の財布がテストで増えないように)。渡した量の印だけ進め、財布には足さない
const msxSaveRun = (run, noPay) => { msxSaveChain = msxSaveChain.then(() => msxSaveRunNow(run, noPay)).catch(() => false); return msxSaveChain; };
// 途中の育成を消す(やめる・引退)も同じ順に並べる(先に頼んだ保存が、消したあとに書き戻さないように)
const msxClearRun = () => { msxSaveChain = msxSaveChain.then(() => storeSet(MSX_KEYS.run, null)).catch(() => false); return msxSaveChain; };
const msxSaveMeta = (meta) => storeSet(MSX_KEYS.meta, meta);

// ---- 表示に使う小物 ----
const msxMon = (id) => (typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS && ALL_PLAYER_MONSTERS[id]) || null;
const msxMonName = (id) => { const m = msxMon(id); return m ? m.name : id; };
const msxMonImg = (id) => { const m = msxMon(id); return m ? m.imgUrl : ''; };
const msxMonThumb = (id) => { const m = msxMon(id); return m ? (m.faceIconUrl || m.iconUrl || m.imgUrl) : ''; };
const msxWho = (aid) => (typeof assistantById === 'function' ? assistantById(aid) : null);
const msxFace = (aid, ex = 'normal') => { const w = msxWho(aid); return w && typeof assistantFaceImage === 'function' ? assistantFaceImage(w, ex) : ''; };
const msxBody = (aid, ex = 'happy') => { const w = msxWho(aid); return w && typeof assistantFullImage === 'function' ? (assistantFullImage(w, ex) || msxFace(aid, ex)) : msxFace(aid, ex); };
const msxAidName = (aid) => { const w = msxWho(aid); return w ? w.name : aid; };
const msxFmt = (n) => Math.round(msxNum(n, 0)).toLocaleString('ja-JP');
// ターン → 年と月(デビュー期は1年目の8月から・1ターン=1か月)・季節
const msxCalendar = (turn) => {
  const k = 7 + Math.max(0, turn - 1);
  const month = (k % 12) + 1; const year = 1 + Math.floor(k / 12);
  const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  return { year, month, season };
};
const MSX_SEASON = Object.freeze({ spring: '🌸 春', summer: '🌻 夏', autumn: '🍁 秋', winter: '⛄ 冬' });
// 景色は季節と時間で替わる(社長の決め: 季節 = 月・時間 = ターン)。時間は ターンごとに 昼 → 夕方 → 夜 と進む。
// 景色の表(data/success-scenes.js)が読めなければ、今ある町の背景で代わりにする
const MSX_TIMES = Object.freeze([['day', '昼'], ['evening', '夕方'], ['night', '夜']]);
const MSX_OLD_BG = Object.freeze({ day: 'images/story-bg/monhero_plaza.jpg', evening: 'images/story-bg/monhero_plaza_evening.jpg', night: 'images/story-bg/monhero_night.jpg' });
const msxSceneBg = (turn = 1) => {
  const t = Math.max(1, Math.round(msxNum(turn, 1)));
  const [time, label] = MSX_TIMES[(t - 1) % 3];
  const cal = msxCalendar(t);
  const pick = typeof window !== 'undefined' && typeof window.successHomeScene === 'function' ? window.successHomeScene(cal.season, time) : null;
  return { bg: pick && pick.image ? pick.image : MSX_OLD_BG[time], time: label, season: cal.season };
};
// 大会の会場(debut / cup / hero / summit)
const msxVenueBg = (venue) => { const f = typeof window !== 'undefined' && typeof window.successSceneById === 'function' ? window.successSceneById(`venue-${venue}`) : null; return f && f.image ? f.image : 'images/story-bg/monhero_town.jpg'; };
const MSX_RANK_ORDER = Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'M']);
const msxRankCls = (r) => `rk r${String(r || 'G').replace(/\+/g, '')}`;

// ---- 台詞(台本エンジン MONHERO_SUCCESS_SCRIPT_ENGINE から1本。並びは育成の id + 場面で決まり、ターンでずれる) ----
// msxScriptLoad(助手) … 共通 + その助手の台本を読む(2回目からはすぐ)。読み終わるまで台詞は null(画面は代わりの一言を出す)
const msxScriptLoad = (aid) => { const se = msxSuc && msxSuc.script; return se && typeof se.load === 'function' ? se.load(aid).catch(() => false) : Promise.resolve(false); };
const msxPickLine = (ctx, scene, opt = {}) => {
  const se = msxSuc && msxSuc.script; if (!se || typeof se.say !== 'function') return null;
  const c = { ...ctx, bond: opt.bondLv != null ? opt.bondLv : ctx.bond };
  try {
    if (opt.who === '*') return se.say(scene, c, { who: 'narr', salt: opt.salt }) || se.say(scene, c, { salt: opt.salt });
    return se.say(scene, c, { who: opt.who, salt: opt.salt });
  } catch (e) { return null; }
};
const msxFill = (t, ctx) => { const se = msxSuc && msxSuc.script; return se && typeof se.fill === 'function' ? se.fill(t, ctx) : String(t || ''); };
// ターンのはじめの様子(数字は言わない)。場面の決め方はエンジンの SCENE.start
const msxStartScene = (s) => { const se = msxSuc && msxSuc.script; return se && se.SCENE && typeof se.SCENE.start === 'function' ? se.SCENE.start(s) : 'turn.start.normal'; };

// ---- HOMEの入口「モンヒロサクセス β」の札(2026-11-13 社長「HOMEにβの札」)。公開の印 monheroSuccess が真のときだけ出る ----
// 置き場所: 縦持ちは左の列の「MFバトルカード」の札のすぐ下(その札が上がる・下がるのに合わせる)、横持ちはその札の右。
// 69-screen-home.jsx の HomeScreen へ 60-app.jsx が successEntry として渡す。見た目はここに閉じる(HOMEの CSS は触らない)
const MSX_HOME_CSS = `
.mh-home-success{position:absolute;z-index:5;left:9px;bottom:calc(min(calc(33% - 40px),calc(44.75% - 126px)) - 60px);padding:0;translate:0 var(--mh-home-left-push,0px)}
.mh-home-scene:has(.mh-home-card-battle.raised) .mh-home-success{bottom:calc(min(calc(33% + 4px),calc(44.75% - 82px)) - 60px)}
.mh-home-scene:has(.mh-home-card-battle.below-tour) .mh-home-success{bottom:calc(min(calc(33% - 84px),calc(44.75% - 170px)) - 60px)}
.mh-home-success>span{display:flex;align-items:center;gap:4px;padding:8px 12px;border:1.5px solid #f9a8d4dd;border-radius:13px;background:linear-gradient(135deg,#831843ee,#4c1d95ee);color:#fff;font-size:12px;font-weight:900;line-height:1.2;box-shadow:0 3px 10px #0007;white-space:nowrap}
.mh-home-success b.beta{margin-left:2px;padding:1px 6px;border-radius:6px;background:#f472b6;color:#fff;font-size:11px;line-height:1.4}
.mh-home-success:active>span{transform:scale(.96)}
@media (orientation:landscape){.mh-home-success,.mh-home-scene:has(.mh-home-card-battle.raised) .mh-home-success,.mh-home-scene:has(.mh-home-card-battle.below-tour) .mh-home-success{left:146px;bottom:12px}
.mh-home-scene:has(.mh-home-facility.life) .mh-home-success{bottom:32px}}
`;
function MonheroSuccessHomeEntry({ callNameOf, bondLvOf, onOpenChange }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { if (onOpenChange) onOpenChange(open); } catch (e) {} }, [open]);
  if (!msxReleased()) return null;
  return (
    <>
      <style>{MSX_HOME_CSS}</style>
      <button type="button" className="mh-home-success" data-home-monhero-success onClick={() => setOpen(true)} aria-label="モンヒロサクセス β">
        <span><span aria-hidden="true">🌱</span>モンヒロサクセス<b className="beta">β</b></span>
      </button>
      {open && <MonheroSuccessScreen onClose={() => setOpen(false)} callNameOf={callNameOf} bondLvOf={bondLvOf}/>}
    </>
  );
}

// ---- デバッグ設定からの入口(公開の印が偽のあいだの試し口)。60-app.jsx のデバッグの「⭐ よく使う」に置く ----
// callNameOf(aid) / bondLvOf(aid) は本体から渡す(プレイヤーの呼び方と助手の仲良し度 Lv)
function MonheroSuccessDebugEntry({ callNameOf, bondLvOf, onOpenChange }) {
  const [open, setOpen] = useState(false);
  // 開いているあいだを本体へ知らせる(裏の周回のバトルの効果音を止めるため・60-app.jsx の successScreenOpen)
  useEffect(() => { try { if (onOpenChange) onOpenChange(open); } catch (e) {} }, [open]);
  return (
    <>
      <button type="button" data-debug-monhero-success onClick={() => { msxDebugOpened = true; setOpen(true); }}
        className="w-full min-h-[58px] rounded-2xl border-2 border-pink-400/60 bg-pink-950/40 text-pink-50 px-3 py-2 text-left text-[12px] font-black active:scale-95">
        🌱 モンヒロサクセス β(試す)
        <small className="mt-0.5 block text-[9px] font-bold leading-relaxed text-pink-200/80">公開前の育成の画面(回2)。大会・修行・引退・合体の中身はまだ準備中。保存は新しいキー(mh_monsuc_*)だけ</small>
      </button>
      {open && <MonheroSuccessScreen onClose={() => setOpen(false)} callNameOf={callNameOf} bondLvOf={bondLvOf} debug/>}
    </>
  );
}
