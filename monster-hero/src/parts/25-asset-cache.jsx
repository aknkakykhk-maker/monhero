// ==== 事前ダウンロード(ASSET_CACHE) ====
//
// 曲や画像を前もって端末へためておく仕組みのページ側(2026-10-11 社長依頼「よくゲームにある事前ダウンロード」)。
// 説明の正本は docs/spec/ASSET_PREFETCH.md。Service Worker 本体は monster-hero/sw.js、
// 一覧(ファイルごとの版の印)は monster-hero/asset-manifest.json(tools/build-asset-manifest.js がビルドで作る)。
//
// 【決めごと】
// ・ためる置き場は Cache Storage の 'mh-assets-v1' だけ。鍵は「パス?v=<中身のハッシュ>」なので、
//   中身が変わったファイルは別の鍵になり、古い絵や音は出ない。一覧から消えた・版の違うものは SW が消す
// ・保存データ(mh_*)・ランキングには触れない。この仕組みの記憶は専用キー mh_asset_prefetch_v1 だけ
//   (入/切・自動の前もって落とし・最近選んだ曲)。読めない・壊れているときは既定値に戻す
// ・既定は入(ASSET_CACHE_DEFAULT_ENABLED)。DEBUG MENU の切り替えで切にすると SW を外し、ためたものも消す
// ・演奏前の準備中・演奏中は、自動の前もって落としを止める(修理部ドライバーくんの印
//   window.__mhSongPrepBusy / __mhSongPlaying と mh:song-prep-* / mh:song-play-* を見る)
const ASSET_CACHE_KEY = 'mh_asset_prefetch_v1';
const ASSET_CACHE_NAME = 'mh-assets-v1';
const ASSET_CACHE_META = 'mh-assets-meta-v1';
// 2026-10-11 社長の了承で既定を入にした(「既定『する』で公開」)。保存値が無い人(既存・新規とも)は入・自動ダウンロードも「する」。
// 一度「しない」を選んだ人(auto:false)や、デバッグで切にした人(enabled:false)の保存値はそのまま使う(normalizeAssetCacheSettings)
const ASSET_CACHE_DEFAULT_ENABLED = true;
// 設定の「ダウンロード」に並べるまとまり。容量は一覧(asset-manifest.json)から出す
const ASSET_PACKS = [
  { id: 'beat', icon: '🎵', label: 'モンヒロビート', desc: '全曲の音源とジャケット' },
  { id: 'battle', icon: '⚔️', label: 'バトル', desc: 'バトル・HOMEのBGM、モンスター・敵・演出・助手の画像' },
  // MFバトルカードのカードの絵(小さい版と大きい版。2026-10-25 社長)。公開の印(RELEASE_FLAGS.cardBattle)が立つまでは、
  // デバッグ端末にだけ見せる。遊ぶ人には出さず、「全部」にも自動ダウンロードにも入れない(assetPackOpen)。公開した日から自動で入る
  { id: 'card', icon: '🃏', label: 'バトルカード', desc: 'MFバトルカードのカードの絵', gate: 'cardBattle' },
  { id: 'all', icon: '📦', label: '全部', desc: 'モンヒロビートとバトルの両方' },
];
// まとまりを出してよいか(公開の印か、デバッグの合言葉が合った端末か。印は読むだけ)
const assetPackOpen = (pack) => {
  if (!pack || !pack.gate) return true;
  try { if (typeof EVENT_REPLAY_RELEASE_FLAGS !== 'undefined' && EVENT_REPLAY_RELEASE_FLAGS[pack.gate]) return true; } catch (e) {}
  try { return typeof localStorage !== 'undefined' && typeof DEBUG_UNLOCK_KEY !== 'undefined' && localStorage.getItem(DEBUG_UNLOCK_KEY) === '1'; } catch (e) { return false; }
};
const assetPackOfId = (id) => ASSET_PACKS.find((p) => p.id === id) || null;
// 設定の「ダウンロード」に並べるまとまり(出してよいものだけ)。「全部」の説明も、バトルカードを出すときは3つにする
const assetPacksShown = () => {
  const cardOpen = assetPackOpen(assetPackOfId('card'));
  return ASSET_PACKS.filter(assetPackOpen).map((p) => (p.id === 'all' && cardOpen ? { ...p, desc: 'モンヒロビート・バトル・バトルカードの全部' } : p));
};
// 自動ダウンロードで、よく使う画像のあとに落とすカードの絵(小さい版だけ。大きい版は詳しい画面を開いたときに取る)
const ASSET_CARD_AUTO_PREFIX = 'images/card-battle/s/';
// 自動の前もって落としで、まず落とす「よく使う画面の画像」(背景・タイトル・画面の部品・顔アイコン)
const ASSET_CORE_PREFIXES = ['data/images/', 'images/ui/', 'images/monster-icons/'];
// 自動の前もって落としで1回の起動に落とす上限(バイト)。モバイル回線では少なく、わからない端末(iPhone)は控えめに
const ASSET_AUTO_BUDGET = { cellular: 8 * 1024 * 1024, unknown: 30 * 1024 * 1024, wifi: 200 * 1024 * 1024 };
const ASSET_RECENT_SONG_LIMIT = 12;

const normalizeAssetCacheSettings = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    // 入/切は、本人が切り替えたとき(enabledChosen:true)だけ保存値を使う。
    // 既定が切だったころ(2026-10-11 #2739〜#2743)に、曲を選んだだけで enabled:false が書かれていた端末がある。
    // それは本人の選択ではないので、印の無い enabled は読まずに既定で読む(読み方を変えるだけで、保存値は書き換えない)
    enabled: src.enabledChosen === true && typeof src.enabled === 'boolean' ? src.enabled : ASSET_CACHE_DEFAULT_ENABLED,
    enabledChosen: src.enabledChosen === true,
    auto: typeof src.auto === 'boolean' ? src.auto : true,
    songs: Array.isArray(src.songs) ? src.songs.filter(s => typeof s === 'string' && s).slice(0, ASSET_RECENT_SONG_LIMIT) : [],
  };
};

const ASSET_CACHE = (() => {
  let settings = normalizeAssetCacheSettings(null);
  let manifest = null, manifestPromise = null;
  let job = null;               // まとまりのダウンロード中: { packId, total, done, bytesTotal, bytesDone, failed, cancel, error }
  let status = { packs: {}, usage: null, quota: null, persisted: null, supported: false, checkedAt: 0 };
  const listeners = new Set();
  const emit = () => { for (const fn of [...listeners]) { try { fn(); } catch (e) {} } };
  const supported = () => typeof window !== 'undefined' && typeof window.caches !== 'undefined'
    && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext !== false
    && /^https?:$/.test(window.location.protocol);
  const save = () => { try { localStorage.setItem(ASSET_CACHE_KEY, JSON.stringify(settings)); } catch (e) {} };
  const keyOf = (path, v) => `${path}?v=${v}`;
  const absKey = (path, v) => new URL(keyOf(encodeURI(path), v), window.location.href).href;
  const stripVersion = (src) => String(src || '').split('?')[0];

  const ensureManifest = () => {
    if (manifest) return Promise.resolve(manifest);
    if (!manifestPromise) {
      const build = (typeof window !== 'undefined' && window.__mhGameBuild) || Date.now();
      manifestPromise = fetch(`asset-manifest.json?v=${build}`)
        .then(res => (res.ok ? res.json() : null))
        .then(json => { manifest = json && json.files && typeof json.id === 'string' ? json : null; manifestPromise = null; return manifest; })
        .catch(() => { manifestPromise = null; return null; });
    }
    return manifestPromise;
  };
  // 「全部」には、出してよいまとまりのものだけを入れる(公開前のバトルカードは入れない)
  const filesOfPack = (m, packId) => Object.entries(m.files).filter(([, f]) => (packId === 'all' ? assetPackOpen(assetPackOfId(f.pack)) : f.pack === packId));

  // 端末にあるもの(版も一覧と同じもの)を数え直す
  const refreshStatus = async () => {
    status = { ...status, supported: supported() };
    if (!status.supported) { emit(); return status; }
    const m = await ensureManifest();
    const have = new Set();
    try {
      // window.caches.open は無ければ空の置き場を作ってしまうので、あるときだけ開く
      if (!(await window.caches.has(ASSET_CACHE_NAME))) throw new Error('none');
      const cache = await window.caches.open(ASSET_CACHE_NAME);
      for (const req of await cache.keys()) {
        const url = new URL(req.url);
        const path = decodeURIComponent(url.pathname.slice(new URL('./', window.location.href).pathname.length));
        have.add(`${path}?v=${url.searchParams.get('v')}`);
      }
    } catch (e) {}
    const packs = {};
    if (m) {
      for (const p of ASSET_PACKS) {
        const files = filesOfPack(m, p.id);
        let count = 0, bytes = 0, haveCount = 0, haveBytes = 0;
        for (const [path, f] of files) {
          count++; bytes += f.size;
          if (have.has(keyOf(path, f.v))) { haveCount++; haveBytes += f.size; }
        }
        packs[p.id] = { count, bytes, haveCount, haveBytes };
      }
    }
    let usage = null, quota = null, persisted = null;
    try { if (navigator.storage && navigator.storage.estimate) ({ usage = null, quota = null } = await navigator.storage.estimate()); } catch (e) {}
    try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch (e) {}
    status = { ...status, packs, usage, quota, persisted, checkedAt: Date.now(), manifestId: m && m.id };
    emit();
    return status;
  };

  const register = async () => {
    if (!supported()) return false;
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      try { reg.update().catch(() => {}); } catch (e) {}
      return true;
    } catch (e) { return false; }
  };
  // 切にしたとき: SW を外し、ためたものを消す(保存データ・ランキングには触れない)
  const unregister = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // 外しても、このページを閉じるまでは SW が動き続ける。先に「何もためない」にしてもらう
    try {
      const ctl = navigator.serviceWorker.controller;
      if (ctl) {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 2000);
          const onMsg = (e) => { if (e.data && e.data.type === 'mh-asset-disabled') { clearTimeout(timer); navigator.serviceWorker.removeEventListener('message', onMsg); resolve(); } };
          navigator.serviceWorker.addEventListener('message', onMsg);
          ctl.postMessage({ type: 'mh-asset-disable' });
        });
      }
    } catch (e) {}
    try {
      for (const reg of await navigator.serviceWorker.getRegistrations()) {
        const sw = reg.active || reg.waiting || reg.installing;
        if (sw && /\/sw\.js(\?|$)/.test(sw.scriptURL)) await reg.unregister();
      }
    } catch (e) {}
    try { await window.caches.delete(ASSET_CACHE_NAME); await window.caches.delete(ASSET_CACHE_META); } catch (e) {}
  };

  // ---- まとまりのダウンロード ----
  const download = async (packId) => {
    if (job || !settings.enabled || !supported() || !ASSET_PACKS.some(p => p.id === packId && assetPackOpen(p))) return false;
    // 最初の await より前に job を置く(2つ同時に始めると、進み具合を取り合う)
    const j = job = { packId, preparing: true, total: 0, done: 0, bytesTotal: 0, bytesDone: 0, failed: 0, cancel: false, error: null };
    emit();
    const m = await ensureManifest();
    if (!m || j.cancel) { if (job === j) job = null; emit(); return false; }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    const cache = await window.caches.open(ASSET_CACHE_NAME);
    const files = filesOfPack(m, packId);
    const todo = [];
    for (const [path, f] of files) { if (!(await cache.match(absKey(path, f.v)))) todo.push([path, f]); }
    Object.assign(j, { preparing: false, total: todo.length, bytesTotal: todo.reduce((s, [, f]) => s + f.size, 0) });
    emit();
    let next = 0, lastRecount = Date.now();
    const worker = async () => {
      while (!j.cancel && !j.error && next < todo.length) {
        const [path, f] = todo[next++];
        try {
          const res = await fetch(keyOf(encodeURI(path), f.v), { headers: { 'x-mh-prefetch': '1' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          await cache.put(absKey(path, f.v), res);
          j.bytesDone += f.size;
        } catch (e) {
          if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))) j.error = 'quota';
          else j.failed++;
        }
        j.done++;
        emit();
        // ほかのまとまり(全部など)と使っている容量の表示も、2秒ごとに数え直す
        if (Date.now() - lastRecount > 2000) { lastRecount = Date.now(); refreshStatus(); }
      }
    };
    // 3本ずつ並べて取る(多すぎると、遊んでいる画面の読み込みが詰まる)
    await Promise.all([worker(), worker(), worker()]);
    if (job === j) job = null;
    await refreshStatus();
    return !j.cancel && !j.error && !j.failed;
  };
  const cancel = () => { if (job) { job.cancel = true; emit(); } };
  const remove = async (packId) => {
    if (!supported()) return;
    if (job) cancel();
    const m = await ensureManifest();
    try {
      const cache = await window.caches.open(ASSET_CACHE_NAME);
      if (packId === 'all' || !m) {
        for (const req of await cache.keys()) await cache.delete(req);
      } else {
        for (const [path, f] of filesOfPack(m, packId)) await cache.delete(absKey(path, f.v));
      }
    } catch (e) {}
    await refreshStatus();
  };

  // ---- 自動の前もって落とし ----
  const autoQueue = [];
  const autoQueued = new Set();
  let autoTimer = null, autoBusy = false, autoSpent = 0;
  const songBusy = () => !!(window.__mhSongPrepBusy || window.__mhSongPlaying);
  const connectionKind = () => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return 'unknown';
    if (c.saveData) return 'off';
    if (c.effectiveType === 'slow-2g' || c.effectiveType === '2g') return 'off';
    if (c.type === 'cellular') return 'cellular';
    if (c.type === 'wifi' || c.type === 'ethernet') return 'wifi';
    return 'unknown';
  };
  const scheduleAuto = (ms) => {
    if (autoTimer) return;
    autoTimer = setTimeout(() => { autoTimer = null; pumpAuto(); }, ms);
  };
  const pumpAuto = async () => {
    if (autoBusy || !settings.enabled || !settings.auto || !supported() || !autoQueue.length) return;
    // 遊びのじゃまをしない: まとめてダウンロード中・演奏の準備中・演奏中・画面が裏のときは待つ
    if (job || songBusy() || document.hidden) { scheduleAuto(5000); return; }
    const kind = connectionKind();
    if (kind === 'off') return;
    const budget = ASSET_AUTO_BUDGET[kind] || ASSET_AUTO_BUDGET.unknown;
    const m = await ensureManifest();
    if (!m) return;
    autoBusy = true;
    try {
      const cache = await window.caches.open(ASSET_CACHE_NAME);
      while (autoQueue.length && !job && !songBusy() && !document.hidden) {
        const path = autoQueue.shift();
        const f = m.files[path];
        if (!f) continue;
        if (await cache.match(absKey(path, f.v))) continue;
        if (autoSpent + f.size > budget) { autoQueue.length = 0; break; }
        try {
          const res = await fetch(keyOf(encodeURI(path), f.v), { headers: { 'x-mh-prefetch': '1' } });
          if (res.ok) { await cache.put(absKey(path, f.v), res); autoSpent += f.size; }
        } catch (e) { break; }
        // 1つずつ、間をあけて取る(通信を占有しない)
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {}
    autoBusy = false;
    if (autoQueue.length) scheduleAuto(5000);
  };
  const enqueue = (paths, front = false) => {
    const fresh = paths.filter(p => p && !autoQueued.has(p));
    for (const p of fresh) autoQueued.add(p);
    if (front) autoQueue.unshift(...fresh); else autoQueue.push(...fresh);
    if (fresh.length) scheduleAuto(1500);
  };
  const songPaths = (songId) => {
    const songs = typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : [];
    const song = songs.find(s => s && s.songId === songId);
    if (!song) return [];
    const track = typeof BGM_TRACK_BY_ID !== 'undefined' ? BGM_TRACK_BY_ID[song.bgmTrackId] : null;
    return [track && track.src, stripVersion(song.artwork)].filter(Boolean);
  };
  // 曲えらびで選んだ曲・遊んだ曲を覚えて、前もって落とす
  const noteSong = (songId, { front = true } = {}) => {
    if (typeof songId !== 'string' || !songId) return;
    const paths = songPaths(songId);
    if (!paths.length) return;
    if (settings.songs[0] !== songId) {
      settings = { ...settings, songs: [songId, ...settings.songs.filter(s => s !== songId)].slice(0, ASSET_RECENT_SONG_LIMIT) };
      save();
    }
    if (settings.enabled && settings.auto) enqueue(paths, front);
  };
  const startAuto = async () => {
    if (!settings.enabled || !settings.auto) return;
    const m = await ensureManifest();
    if (!m) return;
    enqueue(Object.keys(m.files).filter(p => ASSET_CORE_PREFIXES.some(pre => p.startsWith(pre))));
    for (const songId of settings.songs) enqueue(songPaths(songId));
    // カードの絵(小さい版)は、バトルカードのまとまりを出してよいときだけ(公開前の遊ぶ人の端末では落とさない)
    if (assetPackOpen(assetPackOfId('card'))) enqueue(Object.keys(m.files).filter(p => p.startsWith(ASSET_CARD_AUTO_PREFIX)));
  };

  let listening = false;
  const listen = () => {
    if (listening || typeof window === 'undefined') return;
    listening = true;
    window.addEventListener('mh:song-prep-start', (e) => { const id = e && e.detail && e.detail.songId; if (id) noteSong(id, { front: false }); });
    const resume = () => scheduleAuto(3000);
    window.addEventListener('mh:song-prep-end', resume);
    window.addEventListener('mh:song-play-end', resume);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  };

  return {
    get enabled() { return settings.enabled; },
    get auto() { return settings.auto; },
    get job() { return job; },
    get status() { return status; },
    get supported() { return supported(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // 起動時に1回呼ぶ(70-bootstrap 相当の場所から)
    restore() {
      try { settings = normalizeAssetCacheSettings(JSON.parse(localStorage.getItem(ASSET_CACHE_KEY) || 'null')); } catch (e) { settings = normalizeAssetCacheSettings(null); }
      if (!supported()) return settings.enabled;
      listen();
      if (settings.enabled) { register(); setTimeout(startAuto, 8000); }
      return settings.enabled;
    },
    async setEnabled(next) {
      settings = { ...settings, enabled: !!next, enabledChosen: true };
      save();
      if (settings.enabled) { listen(); await register(); startAuto(); } else { cancel(); autoQueue.length = 0; autoQueued.clear(); await unregister(); }
      await refreshStatus();
      return settings.enabled;
    },
    setAuto(next) {
      settings = { ...settings, auto: !!next };
      save();
      if (settings.auto) startAuto(); else { autoQueue.length = 0; autoQueued.clear(); }
      emit();
      return settings.auto;
    },
    refreshStatus, download, cancel, remove, noteSong,
  };
})();

// 画面から状態を見るためのフック。開いているあいだだけ数え直す
function useAssetCacheState() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const off = ASSET_CACHE.subscribe(() => setTick(t => t + 1));
    ASSET_CACHE.refreshStatus();
    return off;
  }, []);
  return ASSET_CACHE;
}

const formatAssetMB = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0MB';
  const mb = n / 1024 / 1024;
  return mb >= 10 ? `${Math.round(mb)}MB` : `${mb.toFixed(1)}MB`;
};

// 起動時に記憶を読み、入なら SW を登録する(BATTLE_PERF と同じく、読み込んだ時点で1回だけ)
ASSET_CACHE.restore();
