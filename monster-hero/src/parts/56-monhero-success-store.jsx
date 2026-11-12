// ===== モンヒロサクセス(育成の画面・回2)の土台: 公開の印・計算の芯と台本の読み込み・保存・台詞 =====
// 計画: docs/progress/player-raise/PLAN.md(§1・§9・§10)。画面は 56-monhero-success-start.jsx / 56-monhero-success-main.jsx
// ★公開の印 RELEASE_FLAGS.monheroSuccess は偽のまま。入口はデバッグ設定だけ(MonheroSuccessDebugEntry)。
// ★計算は data/monhero-success.js(計算の芯・別の会話のクラフトが受け持つ)の create() を呼ぶだけ。ここで伸びの式は書かない。
//   芯と台本(data/monhero-success-script.js)は index.html では読まず、この画面を開いたときにだけ読む。
// ★保存は新しいキー3つだけ(CLAUDE.md ⑦・PLAN §9)。既存のキー(mh_unlocked_monsters・助手の仲良し度など)は読むだけ。
//   読み込みは必ず msxNorm* を通す。壊れていたら「途中の育成なし・保存枠は空」として扱い、元の値は消さない(上書きは新しく始めたときだけ)。
const MSX_KEYS = Object.freeze({ run: 'mh_monsuc_run_v1', box: 'mh_monsuc_box_v1', meta: 'mh_monsuc_meta_v1' });
const MSX_CORE_SRC = 'data/monhero-success.js';
const MSX_SCRIPT_SRC = 'data/monhero-success-script.js';
const MSX_REGULARS_SRC = 'data/monhero-success-regulars.js'; // 大会の常連の表(const だけの形なので typeof で見る)
const MSX_ISSA_ART = 'images/success/issa-hakase.png';
// シナリオ(助手)。台本があるのは みゅあ・あつ(第1弾)。ほかは準備中
const MSX_SCENARIOS = Object.freeze([
  { aid: 'mua', no: 1, title: 'いっしょに、てっぺんへ!', lead: '明るく元気なムードメーカーと、笑いながら頂点をめざす物語。はじめての育成におすすめ', tag: 'やさしい',
    perk: '遊ぶ・休むでストレスが 1.3倍 減る。褒めたときの忠誠 +1', eps: ['はじめての おでかけ', 'はげまし合う夜', 'ふたりの約束'] },
  { aid: 'atsu', no: 2, title: '仕上げて、勝ちに行く', lead: '面倒見のいい兄貴分と、コツコツ仕上げて大会をとりにいく物語', tag: 'ふつう',
    perk: '訓練の組み合わせが あつ流(ちから → ライフ・回避 など)', eps: ['はじめての特訓', '雨の日の作戦会議', '仕上げの約束'] },
]);
const MSX_SOON_AIDS = Object.freeze(['kiki', 'momosuke', 'dra', 'kyuko', 'sorashido', 'erubin']);
const MSX_STAT_ICON = Object.freeze({ life: '❤️', pow: '💪', wise: '🧠', hit: '🎯', eva: '💨', tough: '🛡️' });
const MSX_STAT_NAME = Object.freeze({ life: 'ライフ', pow: 'ちから', wise: 'かしこさ', hit: '命中', eva: '回避', tough: '丈夫さ' });
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
const msxRegularsOk = () => typeof MONSUC_REGULARS !== 'undefined' && typeof MONSUC_REGULAR_CUPS !== 'undefined';
let msxLoading = null;
let msxSuc = null;
const msxLoad = () => {
  if (msxSuc) return Promise.resolve(msxSuc);
  if (!msxLoading) {
    msxLoading = Promise.all([msxLoadScript(MSX_CORE_SRC, 'MONHERO_SUCCESS'), msxLoadScript(MSX_SCRIPT_SRC, 'MONHERO_SUCCESS_SCRIPT'), msxLoadConstScript(MSX_REGULARS_SRC, msxRegularsOk)]).then(([core, script, regOk]) => {
      if (!core || typeof core.create !== 'function') { msxLoading = null; return null; }
      if (typeof MASMON_CALC === 'undefined' || typeof AMG_APT === 'undefined' || typeof AMG_INIT === 'undefined') { msxLoading = null; return null; }
      try {
        // 大会名・相手の名前・技に要る表も渡す(無ければ芯が既定で動く)
        const SUC = core.create({
          calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT,
          techs: typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null,
          types: typeof MONSTER_TYPE_OF !== 'undefined' ? MONSTER_TYPE_OF : null,
          monsters: typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : null,
          regulars: regOk && typeof MONSUC_REGULARS !== 'undefined' ? MONSUC_REGULARS : null, cupNames: regOk && typeof MONSUC_REGULAR_CUPS !== 'undefined' ? MONSUC_REGULAR_CUPS : null,
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
  if (SUC && typeof SUC.restore === 'function') { try { s = SUC.restore(s); } catch (e) { s = null; } if (!s) return null; }
  else {
    const okStats = msxIsObj(s.stats) && MSX_STATS.every((k) => Number.isFinite(s.stats[k]));
    const okTeam = Array.isArray(s.team) && s.team.length === 6 && Array.isArray(s.bond) && s.bond.length === 6;
    if (s.v !== 1 || !Number.isFinite(s.turn) || s.turn < 1 || !okStats || !okTeam || !Number.isFinite(s.hp) || !Number.isFinite(s.hpMax)) return null;
    if (SUC && Array.isArray(SUC.speciesList) && !SUC.speciesList.includes(s.species)) return null;
  }
  return {
    v: 1, id: msxStr(raw.id, 64, s.id), s,
    nick: msxStr(raw.nick, 8) || '', colors: msxColors(raw.colors),
    from: msxIsObj(raw.from) && typeof raw.from.box === 'string' ? { box: raw.from.box.slice(0, 64) } : { base: msxStr(raw.from && raw.from.base, 24, s.species) },
    items: Array.isArray(raw.items) ? raw.items.filter((x) => typeof x === 'string').slice(0, 2) : [],
    used: msxNum(raw.used, 0), // 持ち物を使ったターン(1ターン1個まで)
    phase: ['main', 'result', 'react', 'issa', 'battle', 'turn', 'over'].includes(raw.phase) ? raw.phase : 'main',
    out: msxIsObj(raw.out) ? raw.out : null, // 直前の結果(中断して戻ったときに結果の画面から続ける)
    log: Array.isArray(raw.log) ? raw.log.filter(msxIsObj).slice(-20) : [],
    startAt: msxNum(raw.startAt, 0),
  };
};
const msxNormBoxMon = (m) => {
  if (!msxIsObj(m) || typeof m.id !== 'string' || typeof m.species !== 'string') return null;
  const st = {}; MSX_STATS.forEach((k) => { st[k] = Math.max(0, Math.min(999, Math.round(msxNum(m.st && m.st[k], 0)))); });
  return {
    id: m.id.slice(0, 64), species: m.species.slice(0, 24), nick: msxStr(m.nick, 8), colors: msxColors(m.colors),
    st, loy: Math.max(0, Math.min(100, msxNum(m.loy, 0))), pop: Math.max(0, Math.min(100, msxNum(m.pop, 0))), lv: Math.max(1, Math.min(99, msxNum(m.lv, 1))),
    rank: msxStr(m.rank, 4, ''), score: msxNum(m.score, 0), raised: m.raised !== false,
    assists: Array.isArray(m.assists) ? m.assists.filter(msxIsObj).slice(0, 4) : [], masteries: Array.isArray(m.mast) ? m.mast.filter(Number.isFinite).slice(0, 8) : [],
    coach: msxStr(m.coach, 16), endAt: msxNum(m.endAt, 0),
  };
};
const msxNormBox = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const mons = (Array.isArray(o.mons) ? o.mons : []).map(msxNormBoxMon).filter(Boolean);
  return { v: 1, cap: Math.max(MSX_BOX_CAP0, Math.min(60, msxNum(o.cap, MSX_BOX_CAP0))), mons, memory: Array.isArray(o.memory) ? o.memory.filter(msxIsObj).slice(-100) : [] };
};
const MSX_ITEM_IDS = Object.freeze(['guide', 'loupe', 'band', 'mag', 'hachi', 'omamori', 'dango', 'grass', 'juice', 'powder', 'license', 'pack', 'hourglass', 'hourglass2', 'ticket']);
const msxNormMeta = (raw) => {
  const o = msxIsObj(raw) ? raw : {};
  const items = {}; const src = msxIsObj(o.items) ? o.items : {};
  MSX_ITEM_IDS.forEach((k) => { const n = Math.floor(msxNum(src[k], 0)); if (n > 0) items[k] = Math.min(999, n); });
  const team = (Array.isArray(o.team) ? o.team : []).slice(0, 6).map((t) => (msxIsObj(t) && typeof t.box === 'string' ? { box: t.box.slice(0, 64) } : msxIsObj(t) && typeof t.base === 'string' ? { base: t.base.slice(0, 24) } : null));
  return {
    v: 1, best: msxIsObj(o.best) ? o.best : {}, titles: Array.isArray(o.titles) ? o.titles.filter((x) => typeof x === 'string').slice(0, 200) : [],
    seen: msxIsObj(o.seen) ? o.seen : {}, team, lend: typeof o.lend === 'string' ? o.lend.slice(0, 64) : null,
    gift: msxIsObj(o.gift) ? { day: msxStr(o.gift.day, 12), n: msxNum(o.gift.n, 0) } : { day: '', n: 0 },
    items, runs: Math.max(0, Math.floor(msxNum(o.runs, 0))), picked: msxIsObj(o.picked) ? o.picked : {},
    wonCups: Array.isArray(o.wonCups) ? o.wonCups.filter((x) => typeof x === 'string').slice(0, 500) : [], // 優勝ずみの大会(回3が書く・スキップ用)
  };
};

const msxReadAll = async (SUC) => {
  const [run, box, meta, unlocked] = await Promise.all([
    storeGet(MSX_KEYS.run, null), storeGet(MSX_KEYS.box, null), storeGet(MSX_KEYS.meta, null), storeGet('mh_unlocked_monsters', null),
  ]);
  const all = typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS ? ALL_PLAYER_MONSTERS : {};
  const list = SUC && Array.isArray(SUC.speciesList) ? SUC.speciesList : Object.keys(all);
  const un = (Array.isArray(unlocked) ? unlocked : []).filter((id) => typeof id === 'string' && all[id] && list.includes(id));
  return { run: msxNormRun(run, SUC), box: msxNormBox(box), meta: msxNormMeta(meta), unlocked: un.length ? Array.from(new Set(un)) : list.filter((id) => all[id]).slice(0, 1) };
};
const msxSaveRun = (run) => storeSet(MSX_KEYS.run, run);
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
// 景色は季節と時間で替わる(社長 2026-11-12)。時間は端末の時計
const msxSceneBg = () => {
  let h = 12; try { h = new Date().getHours(); } catch (e) {}
  if (h >= 5 && h < 16) return { bg: 'images/story-bg/monhero_plaza.jpg', time: '昼' };
  if (h >= 16 && h < 19) return { bg: 'images/story-bg/monhero_plaza_evening.jpg', time: '夕方' };
  return { bg: 'images/story-bg/monhero_night.jpg', time: '夜' };
};
const MSX_RANK_ORDER = Object.freeze(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'M']);
const msxRankCls = (r) => `rk r${String(r || 'G').replace(/\+/g, '')}`;

// ---- 台詞(台本から1本。同じ場面に2本以上あれば、育成の id + ターン + 場面 で決まった1本) ----
const msxPickLine = (ctx, scene, opt = {}) => {
  const sc = msxSuc && msxSuc.script; if (!sc) return null;
  const aid = opt.who || ctx.aid;
  const pools = [];
  if (opt.bondLv != null && opt.bondLv <= 2 && Array.isArray(sc.turnBond12)) pools.push(sc.turnBond12);
  pools.push(sc.turn, sc.issa, sc.mon, sc.cheer, sc.random, sc.scenario);
  let rows = [];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    rows = pool.filter((r) => r && typeof r.id === 'string' && r.id.slice(0, r.id.lastIndexOf('.')) === scene && (aid === '*' || r.who === aid));
    if (rows.length) break;
  }
  if (!rows.length) return null;
  const rng = msxSuc.core.rngOf(ctx.id || 'run', ctx.turn || 0, 'line', scene, opt.salt || '');
  const r = rows[Math.floor(rng() * rows.length)];
  return { ...r, t: msxFill(r.t, ctx) };
};
const msxFill = (t, ctx) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => {
  if (k === 'name') return ctx.callName || 'きみ';
  if (k === 'mon') return ctx.mon || 'この子';
  if (k === 'cheer') return ctx.cheer || '編成の子';
  if (k === 'cheer2') return ctx.cheer2 || '編成の子';
  if (k === 'stat') return ctx.stat || '能力';
  if (k === 'train') return ctx.train || '訓練';
  if (k === 'tech') return ctx.tech || '技';
  if (k === 'cup') return ctx.cup || '大会';
  if (k === 'cry') { const sc = msxSuc && msxSuc.script; const c = sc && Array.isArray(sc.mon) ? sc.mon.find((r) => r.id === `mon.cry.${ctx.species}`) : null; return c ? c.t : '…'; }
  return '';
});
// ターンのはじめの様子(数字は言わない)
const msxStartScene = (s) => {
  if (!s) return 'turn.start.normal';
  const r = s.hpMax > 0 ? s.hp / s.hpMax : 0;
  if (r < 0.25) return 'turn.start.worn';
  if (s.stress >= 60) return 'turn.start.stress';
  if (r < 0.45) return 'turn.start.tired';
  if (r >= 0.85 && s.stress < 20) return 'turn.start.great';
  if (r >= 0.65) return 'turn.start.good';
  return 'turn.start.normal';
};

// ---- デバッグ設定からの入口(公開の印が偽のあいだの試し口)。60-app.jsx のデバッグの「⭐ よく使う」に置く ----
// callNameOf(aid) / bondLvOf(aid) は本体から渡す(プレイヤーの呼び方と助手の仲良し度 Lv)
function MonheroSuccessDebugEntry({ callNameOf, bondLvOf }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-debug-monhero-success onClick={() => { msxDebugOpened = true; setOpen(true); }}
        className="w-full min-h-[58px] rounded-2xl border-2 border-pink-400/60 bg-pink-950/40 text-pink-50 px-3 py-2 text-left text-[12px] font-black active:scale-95">
        🌱 モンヒロサクセス(試す)
        <small className="mt-0.5 block text-[9px] font-bold leading-relaxed text-pink-200/80">公開前の育成の画面(回2)。大会・修行・引退・合体の中身はまだ準備中。保存は新しいキー(mh_monsuc_*)だけ</small>
      </button>
      {open && <MonheroSuccessScreen onClose={() => setOpen(false)} callNameOf={callNameOf} bondLvOf={bondLvOf} debug/>}
    </>
  );
}
