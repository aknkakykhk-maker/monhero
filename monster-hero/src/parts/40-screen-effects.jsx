// ==== 画面ライフサイクル: タイマー・リスナーの登録簿(useScreenEffects) ====
//
// 【なぜ要るか】
// MonsterHeroGame の setTimeout は 62 箇所ある。画面を切り出していくと「画面を離れたのに
// タイマーだけ生き残る」が必ず起きるので、登録簿を1つ置いて後始末をまとめる
// (docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-1)。
//
// 【いちばん大事な決めごと: 一律で止めない】
// 「画面を離れたらタイマーを全部止める」は危険。62 箇所のうち 31 箇所は
// 「処理中フラグ(rebirthProcessingRef など)を false へ戻す」「WAVE リザルトへ進める」
// 「await している Promise を resolve する」といった、**止めると操作不能になるもの**だった。
// そこで、タイマーは種別を宣言してから登録する。
//
//   'screen'   … 画面専用。画面(scope)を離れたら止めてよい。演出の後始末・位置の測定・プレビュー
//   'progress' … 進行。止めてはいけない。フラグ戻し・次の画面へ進む・保存・掃除・await の resolve
//
// 種別ごとの内訳は docs/refactor/SCREEN_EFFECTS_MAP.md が正本で、
// tools/ui/screen-effects-check.js がその表と本体を突き合わせている。
//
// 【既定は「止めない」側】
// 種別を書き忘れた呼び出しは 'progress' として扱う。既定を 'screen'(止める)にすると、
// 書き忘れがそのまま「フラグが立ったまま操作できない」に化ける。分からないときは止めない。
//
// 【interval / raf / listen は常に画面専用】
// 放っておくと永久に走り続ける・参照を掴んだままになるものなので、種別は取らない。
// 画面をまたいで動き続けるもの(プレイ時間の計測・バージョン確認・起動経路)は、
// 画面に紐づかないのでこの登録簿には載せず、今までどおりアプリ全体の useEffect で扱う。

const SCREEN_EFFECT_SCOPES = { SCREEN: 'screen', PROGRESS: 'progress' };
// 画面(gameState)を渡さずに使ったときの入れ物。画面ごとに区切らない使い方のため
const SCREEN_EFFECTS_DEFAULT_SCOPE = '__app__';

// React に依存しない本体。host にタイマーの実装を渡せるので、そのまま検査から動かせる
// (tools/ui/screen-effects-check.js が偽のタイマーを入れて振る舞いを確かめている)
function createScreenEffectsRegistry(host) {
  const env = host || (typeof window !== 'undefined' ? window : globalThis);
  const pick = (name, fallback) => {
    const fn = env && env[name];
    if (typeof fn !== 'function') return fallback;
    return (...args) => fn.apply(env, args);
  };
  const _setTimeout = pick('setTimeout', (fn, ms) => setTimeout(fn, ms));
  const _clearTimeout = pick('clearTimeout', (id) => clearTimeout(id));
  const _setInterval = pick('setInterval', (fn, ms) => setInterval(fn, ms));
  const _clearInterval = pick('clearInterval', (id) => clearInterval(id));
  const _raf = pick('requestAnimationFrame', (cb) => _setTimeout(() => cb(Date.now()), 16));
  const _cancelRaf = pick('cancelAnimationFrame', (id) => _clearTimeout(id));

  let nextId = 1;
  let currentScope = SCREEN_EFFECTS_DEFAULT_SCOPE;
  const live = new Map();   // id -> { scope, kind, stop }
  const tokens = new Map(); // scope -> Set<token>

  const report = (message) => {
    try { if (typeof window !== 'undefined' && window.__mhErr) window.__mhErr('[screen-effects] ' + message); } catch (e) {}
  };
  const normalizeScope = (scope) => {
    if (scope === SCREEN_EFFECT_SCOPES.SCREEN) return SCREEN_EFFECT_SCOPES.SCREEN;
    if (scope === SCREEN_EFFECT_SCOPES.PROGRESS) return SCREEN_EFFECT_SCOPES.PROGRESS;
    // 綴り違いを黙って「止める」側へ倒すと、進行フラグが戻らないまま操作不能になる。
    // 分からないときは必ず「止めない」側へ倒し、開発中だけ記録に残して気づけるようにする
    if (scope !== undefined && scope !== null) report('種別が不正: ' + String(scope) + ' → progress として扱う');
    return SCREEN_EFFECT_SCOPES.PROGRESS;
  };
  // 先に番号を配ってから止め方を差し込む。こうしておくと、待ち時間0で即座に呼ばれる作りの
  // タイマーを渡されても「発火し終えたものが登録簿に残る」ことがない
  const add = (scope, kind) => {
    const id = nextId++;
    live.set(id, { scope, kind, stop: () => {} });
    return id;
  };
  const setStop = (id, stop) => { const entry = live.get(id); if (entry) entry.stop = stop; };

  // 画面専用か進行かを宣言して登録する。返り値は cancel に渡せる番号
  const timeout = (fn, ms, scope) => {
    const id = add(currentScope, normalizeScope(scope));
    const handle = _setTimeout(() => { live.delete(id); fn(); }, ms);
    setStop(id, () => _clearTimeout(handle));
    return id;
  };
  const interval = (fn, ms) => {
    const id = add(currentScope, SCREEN_EFFECT_SCOPES.SCREEN);
    const handle = _setInterval(fn, ms);
    setStop(id, () => _clearInterval(handle));
    return id;
  };
  const raf = (fn) => {
    const id = add(currentScope, SCREEN_EFFECT_SCOPES.SCREEN);
    const handle = _raf((t) => { live.delete(id); fn(t); });
    setStop(id, () => _cancelRaf(handle));
    return id;
  };
  const listen = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== 'function') return 0;
    const scopeKey = currentScope;
    target.addEventListener(type, handler, options);
    const id = add(scopeKey, SCREEN_EFFECT_SCOPES.SCREEN);
    setStop(id, () => { try { target.removeEventListener(type, handler, options); } catch (e) {} });
    return id;
  };
  // 長い async の中断点。await のあとに token.alive を見れば「まだこの画面か」が分かる。
  // 進行そのものを止めてはいけない処理(processTurn など)は、見るかどうかを呼び出し側が決める
  const token = () => {
    const scopeKey = currentScope;
    const t = { alive: true, scope: scopeKey };
    if (!tokens.has(scopeKey)) tokens.set(scopeKey, new Set());
    tokens.get(scopeKey).add(t);
    return t;
  };
  const cancel = (id) => {
    const entry = live.get(id);
    if (!entry) return false;
    live.delete(id);
    try { entry.stop(); } catch (e) {}
    return true;
  };

  // 画面を離れたときの後始末。画面専用だけを止め、進行は登録簿から手を離すだけで走らせ続ける
  const releaseScope = (scopeKey) => {
    const key = scopeKey === undefined || scopeKey === null ? currentScope : String(scopeKey);
    let stopped = 0, kept = 0;
    Array.from(live.keys()).forEach((id) => {
      const entry = live.get(id);
      if (!entry || entry.scope !== key) return;
      live.delete(id);
      if (entry.kind === SCREEN_EFFECT_SCOPES.SCREEN) { stopped++; try { entry.stop(); } catch (e) {} }
      else kept++;
    });
    const set = tokens.get(key);
    if (set) { set.forEach((t) => { t.alive = false; }); tokens.delete(key); }
    return { stopped, kept };
  };
  const releaseAll = () => {
    const keys = new Set();
    live.forEach((entry) => keys.add(entry.scope));
    tokens.forEach((_set, key) => keys.add(key));
    let stopped = 0, kept = 0;
    keys.forEach((key) => { const r = releaseScope(key); stopped += r.stopped; kept += r.kept; });
    return { stopped, kept };
  };
  const stats = () => {
    let screen = 0, progress = 0, tokenCount = 0;
    live.forEach((entry) => { if (entry.kind === SCREEN_EFFECT_SCOPES.SCREEN) screen++; else progress++; });
    tokens.forEach((set) => { tokenCount += set.size; });
    return { scope: currentScope, screen, progress, tokens: tokenCount, total: live.size };
  };
  const setCurrentScope = (key) => {
    currentScope = (key === undefined || key === null) ? SCREEN_EFFECTS_DEFAULT_SCOPE : String(key);
    return currentScope;
  };

  // 画面へ渡す口。毎回同じオブジェクトなので useCallback の依存に入れても作り直しにならない。
  // releaseScope / releaseAll は入れない(画面が自分で全部止めると他の画面の進行まで巻き込む)
  const api = { timeout, interval, raf, listen, token, cancel, stats, get scope() { return currentScope; } };
  return { api, setCurrentScope, releaseScope, releaseAll, stats, timeout, interval, raf, listen, token, cancel };
}

// 画面(gameState)に紐づけて使う。scopeKey が変わった時点で、その画面の
// 「画面専用」だけが止まる。省略するとコンポーネントの生存期間がそのまま1つの区切りになる
function useScreenEffects(scopeKey) {
  const key = (scopeKey === undefined || scopeKey === null) ? SCREEN_EFFECTS_DEFAULT_SCOPE : String(scopeKey);
  const registryRef = useRef(null);
  if (!registryRef.current) registryRef.current = createScreenEffectsRegistry();
  const registry = registryRef.current;
  // 描画のたびに「いまの画面」を入れておく。effect の後始末は次の画面が描かれたあとに走るので、
  // ここで入れ替えないと、新しい画面が登録したものが古い画面のぶんとして片付けられてしまう
  registry.setCurrentScope(key);
  useEffect(() => {
    registry.setCurrentScope(key);
    return () => { registry.releaseScope(key); };
  }, [key]);
  // 画面そのものが外れるとき(アンマウント)は、残っている画面専用を全部止める
  useEffect(() => () => { registry.releaseAll(); }, []);
  return registry.api;
}
