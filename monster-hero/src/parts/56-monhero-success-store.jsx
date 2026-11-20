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
const MSX_ARC_SRC = 'data/monhero-success-arc.js'; // 助手1人分のストーリーの表(固有イベント・ヒーローズファイナルの相手えらび・お祝い。2026-11-13)。芯が create のときに拾う
const MSX_REGULARS_SRC = 'data/monhero-success-regulars.js'; // 大会の常連の表(const だけの形なので typeof で見る)
const MSX_ISSA_ART = 'images/success/issa-hakase.png';
// シナリオ(助手)。台本があるのは みゅあ・あつ(第1弾)。ほかは準備中。β版で選べるのはみゅあだけ(56-monsuc-beta.jsx の MSX_BETA_AIDS)
const MSX_SCENARIOS = Object.freeze([
  { aid: 'mua', no: 1, title: 'いっしょに、ヒーローズファイナルへ!', lead: '明るく元気なムードメーカーと、笑いながらヒーローズファイナルの優勝を目指す物語。初めての育成におすすめ', tag: 'やさしい',
    perk: '遊ぶ・休むで減るストレスが1.3倍になる。褒めたときに上がる甘え度が+1', eps: ['はじめての おでかけ', 'はげまし合う夜', 'ふたりの約束'] },
  { aid: 'atsu', no: 2, title: '仕上げて、勝ちに行く', lead: '面倒見のいい兄貴分と、コツコツ仕上げて大会をとりにいく物語', tag: 'ふつう',
    perk: 'トレーニングの組み合わせが あつ流(ちから → ライフ・回避 など)', eps: ['はじめての特訓', '雨の日の作戦会議', '仕上げの約束'] },
]);
const MSX_SOON_AIDS = Object.freeze(['kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin']);
const MSX_STAT_ICON = Object.freeze({ life: '❤️', pow: '🏋️', wise: '📖', hit: '🎯', eva: '👣', tough: '🛡️' });
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
// マスモンボックスに入れられる数(2026-11-14 社長「とりあえず100」。前は はじめ30・引退10回ごとに+5・最大60)。保存の形 mh_monsuc_box_v1 は変えない(cap の値が 100 になるだけ)
const MSX_BOX_CAP0 = 100;
const MSX_BOX_CAP_MAX = 100;

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
// ---- 能力の上限アップ(2026-11-15 r1115-103): 999 を超えた能力の控え ----
//   途中の育成: 新しいキー mh_monsuc_run_over_v1 に { id, cap, over }(上限と、999 を超えた分)。古い版で開くと芯の restore が cap を落として 999 に丸めるので、
//   新しい版で読むとき、同じ育成なら cap と超えた分を戻す(キーを分けたので古い版は触らない)。
//   ボックスの子: st は本当の値(99,999 まで)、stOver に 999 を超えた分の控え(読み込みは ...m で残すので、古い版が st を 999 に丸めても戻せる)
const MSX_RUN_OVER_KEY = 'mh_monsuc_run_over_v1';
const MSX_STAT_ABS = 99999; // 壊れた値を断るための形の見張り(ゲームの天井ではない)
const msxRunOverOf = (run) => {
  const s = msxIsObj(run) && msxIsObj(run.s) ? run.s : null; if (!s || !msxIsObj(s.cap) || !msxIsObj(s.stats) || typeof s.id !== 'string') return null;
  const over = {}; MSX_STATS.forEach((k) => { const v = Math.round(msxNum(s.stats[k], 0)); if (v > 999) over[k] = Math.min(MSX_STAT_ABS - 999, v - 999); });
  const cap = {}; MSX_STATS.forEach((k) => { cap[k] = Math.max(999, Math.min(MSX_STAT_ABS, Math.floor(msxNum(s.cap[k], 999)))); });
  return { id: s.id, cap, over };
};
const msxRunOverMerge = (raw, ov) => {
  if (!msxIsObj(raw) || !msxIsObj(raw.s) || !msxIsObj(ov) || ov.id !== raw.s.id || !msxIsObj(ov.cap)) return raw;
  const s = { ...raw.s }; if (!msxIsObj(s.cap)) s.cap = ov.cap;
  if (msxIsObj(s.stats) && msxIsObj(ov.over)) { const st = { ...s.stats }; MSX_STATS.forEach((k) => { const o = Math.round(msxNum(ov.over[k], 0)); const v = msxNum(st[k], 0); if (o > 0 && v >= 999 && v < 999 + o) st[k] = 999 + o; }); s.stats = st; }
  return { ...raw, s };
};
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
    phase: ['main', 'result', 'react', 'issa', 'battle', 'turn', 'over', 'event', 'story', 'awake', 'tevent', 'birth', 'begin', 'intro'].includes(raw.phase) ? raw.phase : 'main', // begin・intro(育成の始まりの場面)も戻す(r1115-171 c: 再読み込みで導入と初回の処理が飛ばない)
    out: msxIsObj(raw.out) ? raw.out : null, // 直前の結果(中断して戻ったときに結果の画面から続ける)
    log: Array.isArray(raw.log) ? raw.log.filter(msxIsObj).slice(-20) : [],
    startAt: msxNum(raw.startAt, 0),
    // ビートP(2026-11-14 足した項目): 本編へ渡した量・育成が終わったときの分を足したか。無い保存は 0 / false
    beatSent: msxNum(raw.beatSent, 0), beatEnd: raw.beatEnd === true,
    // 大会の結果の画面で先に保存した決着(r1115-202 M1・足した項目)。同じ育成・同じターン・大会中のときだけ読む。無い・合わない保存は持たない
    ...(() => {
      const p = raw.showPend; if (!msxIsObj(p) || !msxIsObj(p.s) || p.turn !== s.turn || !s.battle) return {};
      let ps = p.s; if (SUC && typeof SUC.restore === 'function') { try { ps = SUC.restore(ps); } catch (e) { ps = null; } }
      if (!ps || ps.id !== s.id) return {};
      return { showPend: { s: ps, won: p.won === true, turn: s.turn, opp: msxIsObj(p.opp) ? p.opp : null, gameover: p.gameover === true } };
    })(),
    rev: msxNum(raw.rev, 0), // 保存の版番号(r1115-200 3b・足した項目)。保存のたびに +1。無い保存は 0
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
  const st = {}; const stOver = {}; MSX_STATS.forEach((k) => {
    let v = Math.max(0, Math.min(MSX_STAT_ABS, Math.round(msxNum(m.st && m.st[k], 0))));
    const o = Math.round(msxNum(m.stOver && m.stOver[k], 0)); if (o > 0 && v >= 999 && v < 999 + o) v = Math.min(MSX_STAT_ABS, 999 + o); // 古い版が 999 に丸めた分を戻す
    st[k] = v; if (v > 999) stOver[k] = v - 999;
  });
  // 回3・合体・レンタルが足す項目(gen・techs・mast・gt・fav・titles・paid・parents ほか)も消さずに持つ(...m)
  const tm = msxCanonTechs(m.techs, m.mast); // 技の上限 8 はなくした・古い技 id は読み替える(2026-11-13)
  return {
    ...m,
    gen: Math.max(1, Math.min(999, Math.floor(msxNum(m.gen, 1)))), techs: tm.techs,
    mast: tm.mast, fav: Array.isArray(m.fav) ? m.fav.filter((k) => MSX_STATS.includes(k)).slice(0, 3) : [],
    titles: Array.isArray(m.titles) ? m.titles.filter((x) => typeof x === 'string').slice(0, 64) : [],
    id: m.id.slice(0, 64), species: m.species.slice(0, 24), nick: msxStr(m.nick, 8), colors: msxColors(m.colors),
    st, stOver: Object.keys(stOver).length ? stOver : undefined, loy: Math.max(0, Math.min(100, msxNum(m.loy, 0))), pop: Math.max(0, Math.min(100, msxNum(m.pop, 0))), lv: Math.max(1, Math.min(99, msxNum(m.lv, 1))),
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
  return { ...o, v: 1, cap: Math.max(MSX_BOX_CAP0, Math.min(MSX_BOX_CAP_MAX, msxNum(o.cap, MSX_BOX_CAP0))), mons, memory: Array.isArray(o.memory) ? o.memory.filter(msxIsObj).slice(-100) : [] };
};
// ---- アシスト用の置き場(2026-11-14 社長「合体とかお別れするときに編成アシスト用には使える機能をつけてほしい。100ぐらいは保存可能」・r1114-124) ----
//   合体の親にした子・お別れした子を、消さずに残す。育成(育てる子)には使えない。編成(アシストの枠・6体)に入れると、その子のアシスト効果と得意な能力が効く。
//   新しいキー mh_monsuc_assist_v1 = { v:1, cap:100, mons:[ マスモンボックスの子をそのまま写したもの + keep:{ from:'fuse'|'farewell', at } ] }。
//   マスモンボックス mh_monsuc_box_v1 の形・既存のキーは変えない。別枠で数える(マスモンボックスの上限には入らない)。読めない値は _broken へ写して空で始める
const MSX_ASSIST_KEY = 'mh_monsuc_assist_v1';
const MSX_ASSIST_CAP = 100;
const msxNormAssist = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const seen = new Set(); const mons = [];
  (Array.isArray(o.mons) ? o.mons : []).forEach((x) => {
    const m = msxNormBoxMon(x); if (!m || seen.has(m.id) || mons.length >= MSX_ASSIST_CAP) return;
    seen.add(m.id); mons.push({ ...m, keep: msxIsObj(x.keep) ? { from: x.keep.from === 'fuse' ? 'fuse' : 'farewell', at: Math.floor(msxNum(x.keep.at, 0)) } : { from: 'farewell', at: 0 } });
  });
  return { v: 1, cap: MSX_ASSIST_CAP, mons };
};
// ---- 技の升の選び(2026-11-14 社長 r1114-128・131) ----
//   新しいキー mh_monsuc_techpick_v1 = { v:1, base:{ 種族: { 升: 技id } }, mon:{ マスモンボックスの子のid: { 升: 技id } } }。升 = `${ランク}-${間合い}`。
//   育成を始めるときに、その種族(または合体で生まれた子)の分を育成の状態 techPick へ写す(芯 data/monhero-success.js の techPick)。既存のキーは変えない。
//   読めない値は _broken へ写して空で始める。項目が無い・壊れた升は「並びの1つ目」(芯の techPickNorm と同じ)
const MSX_PICK_KEY = 'mh_monsuc_techpick_v1';
const msxNormPickMap = (raw) => { const o = {}; if (!msxIsObj(raw)) return o; Object.keys(raw).slice(0, 32).forEach((c) => { if (/^[1-5]-[0-3]$/.test(c) && typeof raw[c] === 'string' && raw[c].length <= 48) o[c] = raw[c]; }); return o; };
const msxNormTechPick = (raw) => {
  const o = msxIsObj(raw) ? raw : {}; const base = {}; const mon = {};
  if (msxIsObj(o.base)) Object.keys(o.base).slice(0, 64).forEach((k) => { if (k.length <= 32) base[k] = msxNormPickMap(o.base[k]); });
  if (msxIsObj(o.mon)) Object.keys(o.mon).slice(0, 300).forEach((k) => { if (k.length <= 64) mon[k] = msxNormPickMap(o.mon[k]); });
  return { v: 1, base, mon };
};
const msxReadTechPick = async () => {
  let raw = null; try { raw = await storeGet(MSX_PICK_KEY, null); } catch (e) { raw = null; }
  if (raw != null && !msxIsObj(raw)) { try { await storeSet(MSX_PICK_KEY + '_broken', raw); } catch (e) {} }
  return msxNormTechPick(raw);
};
// kind … 'base'(ベースモン・key は種族) / 'mon'(合体で生まれた子・key は箱の子の id)。書いた結果の全体を返す
const msxWriteTechPick = async (kind, key, map) => {
  const cur = await msxReadTechPick(); const out = { ...cur, [kind]: { ...cur[kind], [key]: msxNormPickMap(map) } };
  try { await storeSet(MSX_PICK_KEY, out); } catch (e) { return cur; }
  return out;
};
const msxReadAssist = async () => {
  let raw = null; try { raw = await storeGet(MSX_ASSIST_KEY, null); } catch (e) { raw = null; }
  if (raw != null && (!msxIsObj(raw) || !Array.isArray(raw.mons))) { try { await storeSet(MSX_ASSIST_KEY + '_broken', raw); } catch (e) {} }
  return msxNormAssist(raw);
};
// 残す: 入る分だけ入れる(同じ id は足さない・いっぱいなら入れない)。返り値 { kept, full, left, assist }
const msxAssistKeep = async (mons, from) => {
  const cur = await msxReadAssist();
  const list = (Array.isArray(mons) ? mons : []).filter((m) => msxIsObj(m) && typeof m.id === 'string');
  let kept = 0; let full = 0; const next = cur.mons.slice();
  list.forEach((m) => {
    if (next.some((x) => x.id === m.id)) return;
    if (next.length >= MSX_ASSIST_CAP) { full += 1; return; }
    const c = msxNormBoxMon(JSON.parse(JSON.stringify(m))); if (!c) return;
    next.push({ ...c, keep: { from: from === 'fuse' ? 'fuse' : 'farewell', at: Date.now() } }); kept += 1;
  });
  const out = { v: 1, cap: MSX_ASSIST_CAP, mons: next };
  if (kept > 0) { try { await storeSet(MSX_ASSIST_KEY, out); } catch (e) { return { kept: 0, full, left: MSX_ASSIST_CAP - cur.mons.length, assist: cur }; } }
  return { kept, full, left: MSX_ASSIST_CAP - out.mons.length, assist: out };
};
// 外す(置き場から消す)
const msxAssistRemove = async (ids) => {
  const cur = await msxReadAssist(); const drop = new Set(Array.isArray(ids) ? ids : []);
  const out = { ...cur, mons: cur.mons.filter((m) => !drop.has(m.id)) };
  await storeSet(MSX_ASSIST_KEY, out); return out;
};
const MSX_ITEM_IDS = Object.freeze(['guide', 'loupe', 'band', 'mag', 'hachi', 'omamori', 'dango', 'grass', 'juice', 'powder', 'license', 'pack', 'oil', 'oilyoil', 'herb', 'hourglass', 'hourglass2', 'ticket', 'awakeFruit', 'superAwakeFruit']); // 覚醒の実・超覚醒の実(2026-11-14 #6147)は足すだけ
const msxNormMeta = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const items = {}; const src = msxIsObj(o.items) ? o.items : {};
  MSX_ITEM_IDS.forEach((k) => { const n = Math.floor(msxNum(src[k], 0)); if (n > 0) items[k] = Math.min(999, n); });
  const team = (Array.isArray(o.team) ? o.team : []).slice(0, 6).map((t) => (msxIsObj(t) && typeof t.box === 'string' ? { box: t.box.slice(0, 64) } : msxIsObj(t) && typeof t.assist === 'string' ? { assist: t.assist.slice(0, 64) } : msxIsObj(t) && typeof t.base === 'string' ? { base: t.base.slice(0, 24) } : null));
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
  const [run0, box, meta, unlocked, assistRaw, runOver] = await Promise.all([
    storeGet(MSX_KEYS.run, null), storeGet(MSX_KEYS.box, null), storeGet(MSX_KEYS.meta, null), storeGet('mh_unlocked_monsters', null), storeGet(MSX_ASSIST_KEY, null).catch(() => null),
    storeGet(MSX_RUN_OVER_KEY, null).catch(() => null),
  ]);
  const run = msxRunOverMerge(run0, runOver); // 能力の上限アップの控えを戻す(同じ育成のときだけ)
  await msxTech2Backup(run, box);
  const all = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS : {};
  const list = SUC && Array.isArray(SUC.speciesList) ? SUC.speciesList : Object.keys(all);
  const un = (Array.isArray(unlocked) ? unlocked : []).filter((id) => typeof id === 'string' && all[id] && list.includes(id));
  return { run: msxNormRun(run, SUC), box: msxNormBox(box), assist: msxNormAssist(assistRaw), meta: msxNormMeta(meta), unlocked: un.length ? Array.from(new Set(un)) : list.filter((id) => all[id]).slice(0, 1) };
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
// 終わった育成(やめた・引退・ゲームオーバー)の id(r1115-171 b・新しいキー・足すだけ)。消したあとの古い画面からの保存で育成を書き戻さないために、新しい50件だけ持つ
const MSX_RUN_GONE_KEY = 'mh_monsuc_run_gone_v1';
const msxRunGoneList = async () => { try { const v = await storeGet(MSX_RUN_GONE_KEY, null); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-50) : []; } catch (_) { return []; } };
const msxRunTurn = (r) => { const t = Number(r && r.s && r.s.turn); return Number.isFinite(t) ? t : 0; };
const msxRunSent = (r) => (Number.isFinite(Number(r && r.beatSent)) ? Math.max(0, Math.floor(Number(r.beatSent))) : 0);
// 保存してある途中の育成より古い保存か(r1115-171 b)。古い画面・別のタブ・保存の順の逆転から来た保存は書かない(払いもしない)
//   別の育成: 保存の方があとに始めた育成なら古い / 保存が無い: 終わった育成の id なら古い / 同じ育成: ターンが前・渡した量が少ない・終わりの分を足す前なら古い
const msxRunIsStale = async (run, stored) => {
  if (!run || typeof run.id !== 'string') return true;
  if (!stored || typeof stored !== 'object') return (await msxRunGoneList()).includes(run.id);
  if (stored.id !== run.id) return Number(run.startAt || 0) <= Number(stored.startAt || 0) || (await msxRunGoneList()).includes(run.id);
  if (msxRunTurn(run) < msxRunTurn(stored)) return true;
  if (msxRunSent(run) < msxRunSent(stored)) return true;
  if (stored.beatEnd === true && run.beatEnd !== true) return true;
  // 保存の版番号(r1115-200 3b): 保存されている版が自分の版以上なら、ほかの画面(別のタブ・古い大会画面)が先に進めている。同じターン・同じビートPでも巻き戻さない
  //   版の無い保存(古い版のアプリ)は比べない
  const rv = Number(run.rev); const sv = Number(stored.rev);
  if (Number.isFinite(rv) && Number.isFinite(sv) && sv > 0 && rv <= sv) return true;
  return false;
};
const msxSaveRunNow = async (run, noPay) => {
  const stored = await storeGet(MSX_KEYS.run, null);
  if (await msxRunIsStale(run, stored)) return 'stale'; // 書かない(r1115-200 3b: 画面は読み直す。文字なので true とは別に扱う)
  const ov = msxRunOverOf(run); if (ov) { try { await storeSet(MSX_RUN_OVER_KEY, ov); } catch (_) {} } // 上限アップの控え(上限のある育成だけ)
  const sent = msxRunSent(run);
  if (noPay || !sent || typeof saveStoredValuesOrRollback !== 'function' || typeof loadRhythmEventPoints !== 'function' || typeof RHYTHM_EVENT_POINTS_KEY === 'undefined') return storeSet(MSX_KEYS.run, run);
  // 渡した量があるのに、保存済みの途中の育成が無い/別の育成(2026-11-14 ミハリ8): ほかのタブで引退・やめたあとの古い画面からの保存。
  //   払わず、書きもしない(全額をもう一度足したり、消した育成を書き戻したりしない)。正しい流れでは育成を始めたときに beatSent 0 で保存済み
  if (!stored || stored.id !== run.id) return false;
  const add = sent - msxRunSent(stored); // 上の確かめで 0 以上(保存より少ない量で書き戻さない → 次の保存で払い直さない)
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
//   消す前に、その育成の id を「終わった育成」へ足す(r1115-171 b)。
//   r1115-200: ①id を渡したら、保存されている育成がその id のときだけ消す(古い画面から新しい育成を消さない。違えば 'other')
//   ②「終わった育成」の記録が書けなければ消さずに false(消したのに記録が無いと、古い画面の保存で育成が戻る)。画面は再試行する
//   true … 消した/もう無い・'other' … 別の育成なので消さない・false … 書けなかった
const msxClearRun = (id) => {
  msxSaveChain = msxSaveChain.then(async () => {
    const cur = await storeGet(MSX_KEYS.run, null);
    if (!cur) return true;
    if (typeof id === 'string' && cur.id !== id) return 'other';
    if (typeof cur.id === 'string') {
      const raw = await storeGet(MSX_RUN_GONE_KEY, null); // 読めない(例外)ときは記録を作り直さない(ほかの id を落とさない)→ 下の catch で false
      const g = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').slice(-50) : [];
      if (!g.includes(cur.id) && (await storeSet(MSX_RUN_GONE_KEY, [...g, cur.id].slice(-50))) === false) return false;
    }
    return storeSet(MSX_KEYS.run, null);
  }).catch(() => false);
  return msxSaveChain;
};
// 育成を始める(r1115-200 1): 持ちこみの消費(meta)と途中の育成(run)を1つの取引で書く。どちらかが書けなければ両方を元へ戻して false
//   (育成だけ書けずにアイテムが消える・消費だけ書けずにタダで持ちこむ を起こさない)。保存の順の列に並べる
const msxStartRunSave = (run, meta) => {
  msxSaveChain = msxSaveChain.then(async () => {
    const [runBefore, metaBefore] = await Promise.all([storeGet(MSX_KEYS.run, null), storeGet(MSX_KEYS.meta, null)]);
    if (typeof saveStoredValuesOrRollback !== 'function') {
      if ((await storeSet(MSX_KEYS.run, run)) === false) return false;
      if ((await storeSet(MSX_KEYS.meta, meta)) === false) { await storeSet(MSX_KEYS.run, runBefore); return false; }
      return true;
    }
    return saveStoredValuesOrRollback([
      { key: MSX_KEYS.meta, before: metaBefore, next: meta },
      { key: MSX_KEYS.run, before: runBefore, next: run },
    ], storeGet, storeSet);
  }).catch(() => false);
  return msxSaveChain;
};
// 並べた保存がぜんぶ終わるのを待つ(中断してホームで読み直す前に。r1115-171 c: 保存中の5ターン目より先に4ターン目を読まない)
const msxSaveWait = () => msxSaveChain.then(() => true, () => true);
const msxSaveMeta = (meta) => storeSet(MSX_KEYS.meta, meta);

// ---- 表示に使う小物 ----
const msxMon = (id) => (typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS && ALL_PLAYER_MONSTERS[id]) || null;
const msxMonName = (id) => { const m = msxMon(id); return m ? m.name : id; };
const msxMonImg = (id) => { const m = msxMon(id); return m ? m.imgUrl : ''; };
const msxMonThumb = (id) => { const m = msxMon(id); return m ? (m.faceIconUrl || m.iconUrl || m.imgUrl) : ''; };
// 顔アイコンの表示(切り取り方式。2026-11-18)。(染めた)全身絵から顔を切り取って出す MonsterFaceImage へ、
// 種と色だけ渡すための薄い包み。範囲が無い種・部品が無いときは、今までの出し方
// (染色ありは全身の染め絵、無染色は専用顔アイコン)と同じになる
const MsxMonFace = ({ species, colors, className, style, alt = '' }) => (
  typeof MonsterFaceImage === 'function'
    ? <MonsterFaceImage baseId={species} src={msxMonImg(species)} faceSrc={msxMonThumb(species)} masuColors={Array.isArray(colors) ? colors : null} alt={alt} className={className} style={style} draggable={false}/>
    : (Array.isArray(colors) && colors.some(Boolean) && typeof DyedMonsterImage === 'function'
      ? <DyedMonsterImage baseId={species} src={msxMonImg(species)} masuColors={colors} alt={alt} className={className} style={style} draggable={false}/>
      : <img src={msxMonThumb(species)} alt={alt} className={className} style={style} draggable={false}/>)
);
const msxWho = (aid) => (typeof assistantById === 'function' ? assistantById(aid) : null);
const msxFace = (aid, ex = 'normal') => { const w = msxWho(aid); return w && typeof assistantFaceImage === 'function' ? assistantFaceImage(w, ex) : ''; };
// ---- ライバルの持ち主アイコン(2026-11-16 社長: ライバルはモンスターだけでなく持ち主のアイコンとセットで出す) ----
// フレンドのプロフィールアイコンの引き方は、本体のランキングと同じ(モンスターの顔か、マーケットのアイコン商品)
const msxBreederIconSrc = (icon) => {
  if (!icon) return null;
  const mon = typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS[icon] : null;
  if (mon && mon.iconUrl) return mon.faceIconUrl || mon.iconUrl;
  const items = typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : [];
  const item = items.find((m) => m && m.id === icon && m.type === 'icon');
  return item ? item.icon : null;
};
// rival は { kind:'aid'|'friend', id(個体の印), icon, profileFrame }。助手は印から助手 id を読んで顔アイコン、フレンドはプロフィールアイコン
function msxBreederLabel(name, kind) {
  if (kind === 'aid') return '［助手］' + name;
  if (kind === 'friend') return '［プレイヤー］' + name;
  return name;
}
function MsxRivalOwnerIcon({ rival, size = 22 }) {
  if (!rival) return null;
  if (rival.kind === 'aid') {
    const aid = typeof rival.id === 'string' ? rival.id.split(':')[1] : null;
    const src = aid ? msxFace(aid) : '';
    return src ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} /> : null;
  }
  if (typeof ProfileAvatar === 'function') return <ProfileAvatar src={msxBreederIconSrc(rival.icon)} id={rival.icon || null} frameId={rival.profileFrame || null} fit small className="shrink-0" style={{ width: size, height: size }} fallback={<span className="flex h-full w-full items-center justify-center rounded-full bg-slate-800 text-xs">👤</span>} />;
  return null;
}
// ライバルのモンスターの小さい丸い絵(大会カード・優勝カード・組み合わせ表など)。染めた色(rival.colors)があれば染めた絵で出す(2026-11-18 染色の反映漏れの修正)。
//   色が無ければ今までどおりの顔アイコン(imgStyle は、その場所で元の img に付いていた style)。
//   DyedMonsterImage は包む要素を返すので、丸の大きさはこちらで持つ
function MsxRivalThumb({ rival, size = 20, imgStyle }) {
  const sp = rival && rival.species;
  const colors = rival && rival.colors;
  // 切り取り方式の種は、丸い枠の中で顔切り取りを出す(染めた色も全身絵から焼くので必ず合う)
  if (sp && typeof MonsterFaceImage === 'function' && typeof MONSTER_FACE_CROP !== 'undefined' && MONSTER_FACE_CROP[sp]) {
    return <span style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'inline-block', background: '#1e1a36', verticalAlign: 'middle' }}><MonsterFaceImage baseId={sp} src={msxMonImg(sp)} faceSrc={msxMonThumb(sp)} masuColors={Array.isArray(colors) ? colors : null} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/></span>;
  }
  if (sp && Array.isArray(colors) && colors.some(Boolean) && typeof DyedMonsterImage === 'function') {
    return <span style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'inline-block', background: '#1e1a36', verticalAlign: 'middle' }}><DyedMonsterImage baseId={sp} src={msxMonThumb(sp)} masuColors={colors} alt="" draggable={false} style={{ width: '100%', height: '100%' }}/></span>;
  }
  return <img src={msxMonThumb(sp)} alt="" style={imgStyle}/>;
}
// 対戦相手(芯の opponents)から、持ち主アイコンを出すためのライバル情報を作る。候補が残っていればアイコンまで、無ければ印だけ
const msxRivalFaceOf = (rivals, opp) => {
  if (!opp || !opp.rival) return null;
  const cand = Array.isArray(rivals) ? rivals.find((r) => r && ((opp.rivalId && r.id === opp.rivalId) || (!opp.rivalId && r.name === opp.name))) : null;
  return cand || { kind: opp.rivalKind || null, id: opp.rivalId || null };
};
const msxBody = (aid, ex = 'happy') => { const w = msxWho(aid); return w && typeof assistantFullImage === 'function' ? (assistantFullImage(w, ex) || msxFace(aid, ex)) : msxFace(aid, ex); };
const msxAidName = (aid) => { const w = msxWho(aid); return w ? w.name : aid; };
// この育成のライバル(芯 SUC.newRun の rivals。r1115-202 社長「出るように直す」・TOURNAMENT.md §8b)
//   自分の助手(いっしょに育てる助手のほか)の助手ライフのマスモン(先頭の子)と、フレンドが貸し出している子から最大8体。
//   読めない・無い分は飛ばす(1体も無ければ [] のまま。芯はライバル抜きで進む)。フレンドの読み込みは待ちすぎない
const MSX_RIVAL_WAIT_MS = 4000;
const msxRivalsBuild = async (SUC, aid) => {
  const ok = (sp) => !!(SUC && Array.isArray(SUC.speciesList) && SUC.speciesList.includes(sp));
  const out = [];
  try {
    const ids = typeof ALF_IDS !== 'undefined' && Array.isArray(ALF_IDS) ? ALF_IDS : [];
    for (const id of ids) {
      if (id === aid || out.length >= 5 || typeof assistantLifeMasmonShareOf !== 'function') continue;
      const r = assistantLifeMasmonShareOf(id);
      const t = r && Array.isArray(r.list) ? (r.list.find((x) => x && x.lead && ok(x.monster)) || r.list.find((x) => x && ok(x.monster))) : null;
      if (!t) continue;
      const nick = typeof t.nick === 'string' && t.nick.trim() ? [...t.nick.trim()].slice(0, 12).join('') : msxMonName(t.monster);
      // 個体の印(所有者の種類・所有者・枠・種)。同名の別の子と取り違えないため、芯は名前でなくこの印で引く(r1116-002)
      const slot = Number.isInteger(t.slot) ? t.slot : 0;
      // 能力: 共有に無いとき(育成の公開印が偽で共有が能力を落とすとき)は、育成の入れ物から元の能力をそのまま使う
      let stats = t.stats && typeof t.stats === 'object' ? t.stats : null;
      if (!stats && typeof amgEntryOf === 'function') { try { const e = amgEntryOf(id, t); if (e && e.st && typeof e.st === 'object') stats = e.st; } catch (_) { /* 読めなければ能力なしで続ける */ } }
      // 覚えた技と熟練(芯が第2版の技へ読み替えて、熟練の高い順に使う)
      let techs = null; let mastery = null;
      if (typeof amgtBattleOf === 'function') { try { const bt = amgtBattleOf(id, t, t.lv); if (bt && Array.isArray(bt.techs) && bt.techs.length) { techs = bt.techs.filter((x) => typeof x === 'string').slice(0, 16); if (techs.length && bt.mastery && typeof bt.mastery === 'object') mastery = Object.fromEntries(techs.map((x) => [x, Math.max(0, Math.min(100, Math.round(Number(bt.mastery[x]) || 0)))])); } } catch (_) { /* 読めなければ技なしで続ける */ } }
      // 元の能力の合計(999 に丸められる前の数え。芯の強さ補正の材料・r1116-002)
      const rawSum = stats ? ['life', 'pow', 'wise', 'hit', 'eva', 'tough'].reduce((a, k) => a + (Number.isFinite(Number(stats[k])) ? Number(stats[k]) : 0), 0) : null;
      out.push({ name: nick, breeder: msxAidName(id), kind: 'aid', species: t.monster, id: `aid:${id}:${slot}:${t.monster}`, ...(stats ? { stats, rawSum: Math.round(rawSum) } : {}), ...(techs && techs.length ? { techs, mastery: mastery || {} } : {}), ...(Array.isArray(t.colors) && t.colors.some(Boolean) ? { colors: t.colors } : {}) }); // 染めた色(共有の並びが持っている。見せるためだけ)
    }
  } catch (_) { /* 助手の分が読めなくても続ける */ }
  try {
    if (typeof monsucLendFriends === 'function' && typeof monsucLendMember === 'function') {
      const r = await Promise.race([monsucLendFriends(), new Promise((res) => setTimeout(() => res(null), MSX_RIVAL_WAIT_MS))]);
      const rows = r && r.ok && Array.isArray(r.rows) ? r.rows : [];
      for (const row of rows) {
        if (out.length >= 8) break;
        const m = monsucLendMember(row, SUC);
        if (!m || !ok(m.species)) continue;
        const rawSumF = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'].reduce((a, k) => a + (Number.isFinite(Number(m.stats[k])) ? Number(m.stats[k]) : 0), 0);
        // 持ち主のアイコン(大会カード・対戦前で顔とセットで出すためだけに引き継ぐ。名簿の行が持っている)
        out.push({ name: m.name || msxMonName(m.species), breeder: m.friend && m.friend.name ? String(m.friend.name).slice(0, 24) : null, kind: 'friend', species: m.species, stats: m.stats, rawSum: Math.round(rawSumF), id: `friend:${m.friend && m.friend.id ? m.friend.id : ''}:0:${m.species}`, ...(row.icon ? { icon: row.icon } : {}), ...(row.profileFrame ? { profileFrame: row.profileFrame } : {}), ...(Array.isArray(m.colors) && m.colors.some(Boolean) ? { colors: m.colors } : {}) }); // 個体の印(フレンドは1人1体なので枠は0)と元の合計(r1116-002)。染めた色は貸し出しの子が持っている(見せるためだけ)
      }
    }
  } catch (_) { /* フレンドの分が読めなくても続ける */ }
  return out.slice(0, 8);
};
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
// ---- イベントの見出しの共通の型(r1119-009 段2・docs/progress/monsuc-event-story-design/README.md 4-1) ----
//   1行目 = 種類の帯(色が種類で決まる)+ 連続物の番号 / 2行目 = 題。どの画面のイベントも、この部品で見出しを出す
const MSX_EV_KIND = Object.freeze({ story: 'メインストーリー', days: '日々', team: '編成のモンスターのイベント', ikusei: '育成イベント', cup: '大会イベント', issa: '大きな賭け' });
function MsxEvHead({ kind = 'ikusei', label, title, className = '', style }) {
  const k = MSX_EV_KIND[kind] ? kind : 'ikusei';
  const lb = label || MSX_EV_KIND[k];
  return <div className={`v-ev-h k-${k}${className ? ` ${className}` : ''}`} style={style} data-msx-ev-kind={k}>{lb && lb !== title ? <small>{lb}</small> : null}{title}</div>;
}
// 連続物の「つづく」の1行(話の終わりに出す)
function MsxEvNext({ text }) {
  // 2行になる文は左そろえ・言葉の途中で折らない(2026-11-20 社長「トレーニン/グ」「中央そろえはおかしい」)
  return text ? <div className="msx-ev-next" data-msx-ev-next><b>つづく ▶</b><span style={JA_WRAP_STYLE}>{jaWrap(text)}</span></div> : null;
}
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

// ---- HOMEの入口「モンヒロサクセス β」(2026-11-13 社長「HOMEにβの札」→ 2026-11-17 ホーム一新でドック上段のカードに)。公開の印 monheroSuccess が真のときだけ出る ----
// 置き場所: HOME のドック上段の先頭のセル(69-screen-home.jsx の HomeScreen が successEntry として置く)。セルとして流れる形にし、
// 位置はドック側に任せる。見た目はここに閉じる(HOMEの CSS は触らない)
const MSX_HOME_CSS = `
.mh-home-success{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 3px 6px;border:2px solid #f9a8d4dd;border-radius:16px;background:linear-gradient(135deg,#831843ee,#4c1d95ee);color:#fff;text-shadow:0 2px 4px #000;box-shadow:0 3px 10px #0007;touch-action:manipulation}
.mh-home-success:active{transform:scale(.95)}
.mh-home-success .pic{display:block;width:100%;max-width:104px;aspect-ratio:1;border-radius:11px;overflow:hidden}
.mh-home-success .pic img{display:block;width:100%;height:100%;object-fit:cover}
.mh-home-success .txt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:100%;height:calc(9.5px*1.15 + 1px + 9px*1.1)}
.mh-home-success .nm{font-size:9.5px;font-weight:1000;line-height:1.15;white-space:nowrap}
.mh-home-success .sb{font-size:9px;font-weight:800;color:#fbcfe8;line-height:1.1;white-space:nowrap}
.mh-home-success .rb{position:absolute;right:-6px;top:-9px;z-index:1;font-style:normal;font-size:10px;font-weight:900;color:#422006;background:linear-gradient(90deg,#fde047,#fbbf24);border-radius:6px;padding:1px 7px;box-shadow:0 2px 4px #0008;transform:rotate(4deg);white-space:nowrap}
@media(max-width:380px){.mh-home-success .nm{font-size:8.5px}.mh-home-success .txt{height:calc(8.5px*1.15 + 1px + 9px*1.1)}}
@media(max-width:350px){.mh-home-success .nm{font-size:7.5px}.mh-home-success .txt{height:calc(7.5px*1.15 + 1px + 9px*1.1)}}
@media(orientation:landscape) and (max-height:600px){.mh-home-success .nm{font-size:8.5px}.mh-home-success .txt{height:calc(8.5px*1.15 + 1px + 9px*1.1)}}
@media(orientation:landscape) and (max-height:600px) and (max-width:700px){.mh-home-success .nm{font-size:7.5px}.mh-home-success .txt{height:calc(7.5px*1.15 + 1px + 9px*1.1)}}
@media(orientation:landscape) and (max-height:600px) and (max-width:600px){.mh-home-success .nm{font-size:7px}.mh-home-success .txt{height:calc(7px*1.15 + 1px + 9px*1.1)}}
@container (min-width:700px) and (min-height:560px){.mh-home-success{gap:2px;padding:7px 5px 8px;border-radius:18px;max-width:128px}.mh-home-success .pic{max-width:120px;border-radius:13px}.mh-home-success .txt{gap:2px;height:calc(8.5px*1.15 + 2px + 9px*1.1)}.mh-home-success .nm{font-size:8.5px}.mh-home-success .sb{font-size:9px}}
@container (min-width:950px) and (min-height:560px){.mh-home-success .nm{font-size:10.5px}.mh-home-success .sb{font-size:10px}.mh-home-success .txt{height:calc(10.5px*1.15 + 2px + 10px*1.1)}}
`;
function MonheroSuccessHomeEntry({ callNameOf, bondLvOf, onOpenChange }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { if (onOpenChange) onOpenChange(open); } catch (e) {} }, [open]);
  if (!msxReleased()) return null;
  return (
    <>
      <style>{MSX_HOME_CSS}</style>
      <button type="button" className="mh-home-success" data-home-monhero-success onClick={() => setOpen(true)} aria-label="モンヒロサクセス β">
        {/* リボン「β版 開幕！」は公開の日の文(2026-11-14 ココロ・窓口経由 #6116 を r1115-206 で取り込み直し)。
            βの表示はリボン1つだけ(2026-11-16 UI改修: 中の β と二重になっていた)。名前はフルネーム「モンヒロサクセス」+下の言葉「育成」
            (ホーム略称「サクセス」は 2026-11-17 の一新で一時使ったが、同日のあっくん追加指示でフルネームへ戻した) */}
        <i className="rb" aria-hidden="true">β版 開幕！</i>
        <span className="pic"><img src="images/home/facility-success.webp" alt="" draggable={false}/></span>
        <span className="txt"><span className="nm">モンヒロサクセス</span><span className="sb">育成</span></span>
      </button>
      <MonheroSuccessFarmMeal entryOpen={open}/>
      {open && <MonheroSuccessScreen onClose={() => setOpen(false)} callNameOf={callNameOf} bondLvOf={bondLvOf}/>}
    </>
  );
}

/* ===== ファームで あげる 優勝のごほうび(2026-11-17 社長「ご褒美はファームに戻ってからあげるほうがしっくりくる。音楽もファームの音楽」) =====
   大会で優勝した ごはんの権利は、育成の芯(s.mealReady / s.mealOpts)に残っている。モンサクを閉じている間(=ファーム)に
   権利があれば、ホームの下から パネルを出す。あげる/あげない の選択と効き目は、大会の場だった頃と全く同じ(芯の meal / mealSkip)。
   保持の決まり(芯の既存の動きのまま。新しい保存項目は足さない): 育成で次の行動を取る・次の大会が精算される・育成が終わる、のどれかで権利は消える。
   あげた直後は、変わった分を ゲージの演出(MsxGaugeFx)で見せる(2026-11-17 社長「ご褒美あげたときにステの変動演出がなかった」)。
   音楽はファームのまま: ここでは SuccessSound を一切呼ばない(モンサクを閉じると ファームの曲へ戻る仕組みが既にある)。
   見た目は MSX_CSS(.msx の中)に閉じ、枠だけ ここの CSS で足す(HOMEの CSS は触らない) */
const MSX_HOME_MEAL_CSS = `
.mh-home-meal{position:fixed;inset:0;z-index:1300;background:rgba(8,5,18,.66);display:flex;align-items:flex-end;justify-content:center}
.mh-home-meal .msx{position:relative;width:100%;max-width:430px;height:auto;max-height:94dvh;overflow-y:auto;container-type:normal;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#2a1e56,#151130);box-shadow:0 -6px 30px #000a}
.mh-home-meal .v-meal{position:static;left:auto;right:auto;bottom:auto;background:transparent;border:none;box-shadow:none;padding:10px 10px 6px}
`;
function MonheroSuccessFarmMeal({ entryOpen }) {
  const [data, setData] = useState(null); // ファームにいるときの読み直し結果(msxReadAll)
  const [pickKey, setPickKey] = useState(null);
  const [result, setResult] = useState(null); // あげた/あげなかった直後の見せ方 { key, before, after, skipped }
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState(false); // 「あとで」で この訪問だけ隠す(権利は残る。モンサクを開いて閉じる・開き直すと また出る)
  useEffect(() => { // モンサクを開いたら隠す。閉じたら(ファームに戻ったら)読み直す
    if (entryOpen) { setData(null); setPickKey(null); setResult(null); setDeferred(false); return undefined; }
    let live = true;
    (async () => {
      const L = await msxLoad().catch(() => null);
      if (!live || !L) return;
      const d = await msxReadAll(L.SUC).catch(() => null);
      if (live && d) setData(d);
    })();
    return () => { live = false; };
  }, [entryOpen]);
  const SUC = msxSuc && msxSuc.SUC ? msxSuc.SUC : null;
  const run = data && data.run ? data.run : null;
  const s = run && run.s ? run.s : null;
  if (entryOpen || !SUC || !run || !s) return null;
  if (!result && (deferred || !(s.mealReady && !s.over))) return null;
  const M = SUC.MEALS || {};
  const nm = run.nick || (typeof msxMonName === 'function' ? msxMonName(s.species) : s.species);
  // 並ぶ3品と効き目(大会の場だった頃と全く同じ作り: 芯の meal を試しに呼んで、本物の増え方を出す)
  const keys = typeof SUC.mealOpts === 'function' ? SUC.mealOpts(s) : Object.keys(M);
  const can = (k) => s.mealReady && !s.over && !!M[k] && keys.includes(k);
  const tryMeal = (k) => { try { const r = SUC.meal(s, k); return r && r.out && r.out.ok ? r.state : null; } catch (e) { return null; } };
  const loyOf = (x) => Math.max(0, Math.min(100, (Number(x.ama) || 0) + (Number(x.fear) || 0)));
  const effOf = (k) => {
    const m = M[k]; const t = tryMeal(k); if (!m || !t) return null;
    const hp = t.hp - s.hp; const ama = (Number(t.ama) || 0) - (Number(s.ama) || 0); const fear = (Number(t.fear) || 0) - (Number(s.fear) || 0);
    const st = m.stat ? (t.stats[m.stat] || 0) - (s.stats[m.stat] || 0) : 0; const pop = (Number(t.pop) || 0) - (Number(s.pop) || 0); const pts = (Number(t.pts) || 0) - (Number(s.pts) || 0);
    return { m, hp, ama, fear, st, pop, pts, loy0: loyOf(s), loy1: loyOf(t) };
  };
  const fx = (k) => {
    const e = effOf(k); if (!e) return '';
    const hp = e.hp > 0 ? `体力+${e.hp}` : '体力 満タン';
    const ly = [e.m.ama ? (e.ama > 0 ? `甘え+${e.ama}` : '甘え 上限') : '', e.m.fear ? (e.fear > 0 ? `恐れ+${e.fear}` : '恐れ 上限') : ''].filter(Boolean).join('・');
    if (e.m.gives) return '持ち物に入る';
    if (e.m.stat) return [`${MSX_STAT_NAME[e.m.stat]}+${e.st}`, ly, e.m.hp ? hp : ''].filter(Boolean).join('・');
    if (e.m.pop || e.m.pts) return [`人気+${e.pop}`, `能力P+${e.pts}`, ly, hp].filter(Boolean).join('・');
    return [ly, e.m.hp ? hp : ''].filter(Boolean).join('・');
  };
  const fxLong = (k) => {
    const e = effOf(k); if (!e) return '';
    const hp = e.hp > 0 ? `体力を上限の${Math.round(e.m.hp * 100)}%回復(+${e.hp}・いま ${s.hp}→${s.hp + e.hp} / ${s.hpMax})` : `体力はもう満タン(上限 ${s.hpMax})`;
    if (e.m.gives) { const it = SUC.ITEMS && SUC.ITEMS[e.m.gives]; return `持ち物に「${(it && it.name) || e.m.gives}」が1つ入る(使ったターンだけ、人気の上がり ×${SUC.POP_TURN_MULT || 1.5})`; }
    const parts = e.m.hp ? [hp] : [];
    if (e.m.stat) parts.push(`${MSX_STAT_NAME[e.m.stat]} +${e.st}(${s.stats[e.m.stat]}→${s.stats[e.m.stat] + e.st})`);
    if (e.m.fear || e.m.ama) { const ls = [e.m.ama ? (e.ama > 0 ? `甘え度 +${e.ama}` : '甘え度はもう上限(50)') : '', e.m.fear ? (e.fear > 0 ? `恐れ度 +${e.fear}` : '恐れ度はもう上限(50)') : ''].filter(Boolean).join('・'); parts.push(`${ls}(忠誠度 ${e.loy0}→${e.loy1})`); }
    if (e.m.pop) parts.push(`人気 +${e.pop}(${s.pop}→${s.pop + e.pop})`);
    if (e.m.pts) parts.push(`能力ポイント +${e.pts}`);
    return parts.join('・');
  };
  const MEAL_ICON = { vitamin: '🐍', gochiso: '🍰', f_life: '🍓', f_pow: '🍍', f_wise: '🍏', f_hit: '🥗', f_eva: '🧃', f_tough: '🥫', prune: '⭐' };
  const LY = SUC.LOYAL || {}; const RT = SUC.RATE || {};
  const loyNote = `忠誠度が高いほど、トレーニングの伸びが上がる(${LY.capBoost || 60}で最大 ×${1 + (LY.capBoost || 60) / 100})。80以上で大成功が少し出やすい(+${Math.round((RT.greatLoyal80 || 0.03) * 100)}%)`;
  // あげた/あげなかった結果の保存(版番号を進めて書く。ほかの画面が先に進めていたら読み直して出し直す)
  const saveMealResult = async (nextS, res) => {
    const next = { ...run, s: nextS, rev: (Number(run.rev) || 0) + 1 };
    const saved = await msxSaveRun(next);
    if (saved === 'stale') {
      const L = await msxLoad().catch(() => null);
      const d = L ? await msxReadAll(L.SUC).catch(() => null) : null;
      if (d) setData(d);
      return;
    }
    setData({ ...data, run: next });
    setResult(res);
  };
  const give = async () => {
    if (busy || !pickKey || !can(pickKey)) return;
    const r = SUC.meal(s, pickKey);
    if (!r || !r.out || !r.out.ok) return;
    setBusy(true);
    await saveMealResult(r.state, { key: pickKey, before: s, after: r.state, skipped: false });
    setBusy(false);
  };
  const skipMeal = async () => {
    if (busy || typeof SUC.mealSkip !== 'function') return;
    const r = SUC.mealSkip(s);
    if (!r || !r.out || !r.out.ok) return;
    setBusy(true);
    await saveMealResult(r.state, { key: null, before: s, after: r.state, skipped: true });
    setBusy(false);
  };
  // あげた直後の変動の札(芯の前後の差から作る。MsxGaugeFx が ゲージと数字を動かして見せる)
  const gainItems = (before, after) => {
    const items = [];
    if ((after.hp || 0) !== (before.hp || 0)) items.push({ k: 'hp', e: '💗', name: '体力', from: before.hp || 0, to: after.hp || 0, max: after.hpMax || before.hpMax || 100 });
    MSX_STATS.forEach((k) => { const f = (before.stats || {})[k] || 0; const t = (after.stats || {})[k] || 0; if (t !== f) items.push({ k, e: MSX_STAT_ICON[k], name: MSX_STAT_NAME[k], from: f, to: t, max: 999 }); });
    if ((after.ama || 0) !== (before.ama || 0)) items.push({ k: 'ama', e: '💞', name: '甘え度', from: before.ama || 0, to: after.ama || 0, max: 50 });
    if ((after.fear || 0) !== (before.fear || 0)) items.push({ k: 'fear', e: '😨', name: '恐れ度', from: before.fear || 0, to: after.fear || 0, max: 50 });
    if ((after.pop || 0) !== (before.pop || 0)) items.push({ k: 'pop', e: '⭐', name: '人気', from: before.pop || 0, to: after.pop || 0, max: 100 });
    if ((after.pts || 0) !== (before.pts || 0)) items.push({ k: 'pts', e: '🔷', name: '能力ポイント', from: before.pts || 0, to: after.pts || 0, max: Math.max(after.pts || 0, 1) });
    return items;
  };
  const bagNote = (before, after) => {
    const g = Object.keys(after.bag || {}).find((k) => ((after.bag || {})[k] || 0) > ((before.bag || {})[k] || 0));
    if (!g) return '';
    const it = SUC.ITEMS && SUC.ITEMS[g];
    return `持ち物に「${(it && it.name) || g}」が入ったよ`;
  };
  if (result) {
    const items = gainItems(result.before, result.after);
    const bag = bagNote(result.before, result.after);
    return (
      <div className="mh-home-meal" data-mh-home-meal>
        <style>{MSX_CSS}</style>
        <style>{MSX_HOME_MEAL_CSS}</style>
        <div className="msx">
          <div className="v-meal" data-mh-home-meal-result>
            <div className="t">{result.skipped ? '🍽 今日は あげなかった' : `🍽 ${M[result.key] ? M[result.key].name : 'ごはん'}を あげたよ!`}<small>{result.skipped ? `恐れ度 +${SUC.MEAL_SKIP_FEAR || 1}` : '変わった分は これだよ'}</small></div>
            {typeof MsxGaugeFx === 'function' ? <MsxGaugeFx key={`farmmeal-${result.before.turn}-${result.skipped ? 'skip' : result.key}`} items={items} title="ごはんの効き目"/> : null}
            {!items.length ? <div className="msx-note" style={{ textAlign: 'center', marginTop: 6 }}>数字は もう上限いっぱいで、変わらなかったよ</div> : null}
            {bag ? <div className="msx-note" style={{ textAlign: 'center', marginTop: 6 }}>🎁 {bag}</div> : null}
            <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, result.skipped ? 'normal' : 'happy')} alt=""/><div className="bub f1">{result.skipped ? '「また次の優勝で、ごほうびを あげよう!」' : '「おいしそうに 食べてるよ! よく がんばったね」'}</div></div>
          </div>
          <div className="v-ft"><button type="button" className="go" onClick={() => setResult(null)} data-mh-home-meal-close>閉じる</button></div>
        </div>
      </div>
    );
  }
  return (
    <div className="mh-home-meal" data-mh-home-meal>
      <style>{MSX_CSS}</style>
      <style>{MSX_HOME_MEAL_CSS}</style>
      <div className="msx">
        <div className="v-meal">
          <div className="t">🍽 がんばったごほうびに、ごはんをあげよう<small>優勝したときだけ あげられる(今日の3品から1回・ただ){s.freeMeal === true ? `・見守りで効き目 ×${SUC.MEAL_WATCH_MULT || 1.5}` : ''}</small></div>
          <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, 'excited')} alt=""/><div className="bub f1" style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>{['「優勝', 'おめでとう!', 'ファームに', '帰ってきたから、', 'ごほうびの', 'ごはんだよ」'].map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}<span style={{ whiteSpace: 'nowrap' }}>{x}</span></React.Fragment>)}</div></div>
          <div className="ms">{keys.map((k) => (
            <button type="button" key={k} className={`v-ml ${pickKey === k ? 'sel' : ''}`} disabled={!can(k) || busy} onClick={() => setPickKey(k)} style={{ opacity: can(k) ? 1 : 0.45 }} data-mh-home-meal-pick={k}>
              <div className="e">{MEAL_ICON[k] || '🍙'}</div><b style={{ wordBreak: 'keep-all', overflowWrap: 'normal' }}>{String(M[k].name).split(/(?=（)/).map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}<span style={{ whiteSpace: 'nowrap' }}>{x}</span></React.Fragment>)}</b><small data-mh-home-meal-fx={k}>{fx(k).split('・').map((x, i) => <React.Fragment key={i}>{i > 0 ? <>・<wbr/></> : null}<span style={{ whiteSpace: 'nowrap' }}>{x}</span></React.Fragment>)}</small></button>))}</div>
          <div className="msx-note" data-mh-home-meal-detail style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, textAlign: 'left', color: '#fde68a', ...(typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : {}) }}>{pickKey && M[pickKey] ? `${M[pickKey].name}: ${fxLong(pickKey)}`.split(/(?<=[・:])/).map((x, i) => <React.Fragment key={i}>{i > 0 ? <wbr/> : null}{typeof jaWrap === 'function' ? jaWrap(x) : x}</React.Fragment>) : 'ごはんを押すと、詳しい効き目が出ます'}</div>
          <div className="msx-note" data-mh-home-meal-loynote style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.5, textAlign: 'left' }}>💡 {loyNote}</div>
        </div>
        <div className="v-ft"><button type="button" disabled={busy} onClick={() => setDeferred(true)} data-mh-home-meal-later style={{ flex: '0.55' }}>あとで</button><button type="button" disabled={busy} onClick={skipMeal} data-mh-home-meal-skip style={{ flex: '1.25', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.15 }}><span>あげずに 終わる</span><span style={{ fontSize: 9.5, opacity: 0.85 }}>恐れ度 +{SUC.MEAL_SKIP_FEAR || 1}</span></button><button type="button" className="go" disabled={busy || !(pickKey && can(pickKey))} onClick={give} data-mh-home-meal-give>{pickKey && can(pickKey) ? `${M[pickKey].name}をあげる` : 'ごはんを選んでね'}</button></div>
      </div>
    </div>
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
