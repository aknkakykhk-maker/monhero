// 事前ダウンロード(曲・画像を端末にためておく)の Service Worker。
// 説明の正本: docs/spec/ASSET_PREFETCH.md / 一覧: asset-manifest.json(tools/build-asset-manifest.js が作る)
//
// 【いちばん大事な決めごと】
// ・扱うのは asset-manifest.json に載っている音源・画像と、ゲーム本体・データの JS・CSS(pack:'core')だけ。
//   HTML(index.html)・JSON・version.json・Supabase などには respondWith しない(ブラウザがふつうに取りに行く)
// ・本体・データの JS・CSS は、URL の ?v= が一覧の版とぴったり同じときだけ返す(置き場 mh-code-v1)。
//   どの版を読むかを決めるのは毎回ネットから来る index.html なので、新しい版を出せば URL が変わり、必ず新しい版が動く。
//   &retry= の付いた取得(index.html の読み込み直し)は素通し。止め札は CODE_CACHE_OFF(true にして出せば素通しになり置き場も消す)
// ・ためる鍵は「パス?v=<中身のハッシュ>」。中身が変われば鍵が変わるので、古い絵や音を返すことはない
// ・一覧が変わったら、一覧に無い・版の違う古いものを消す
// ・Range(範囲指定)つきの取得には手を出さない(<video> など。丸ごと返すと iPhone で再生できない)
// ・保存データ(localStorage)とランキングには一切触れない
'use strict';

const CACHE_NAME = 'mh-assets-v1';
// 本体・データの JS・CSS の置き場(2026-10-27 社長「本体とデータもダウンロードに入れる」)。画像・音源とは分けて、止め札で置き場ごと消せるようにする
const CODE_CACHE = 'mh-code-v1';
// 止め札。本体・データをためる仕組みで困ったら、この1行を true にして公開する(次に開いたときから素通しになり、mh-code-v1 を消す)
const CODE_CACHE_OFF = false;
const CODE_PATH_RE = /^(game-system\.compiled\.js|tailwind\.css|data\/[a-z0-9_\/.-]+\.js|vendor\/[a-z0-9_.-]+\.js)$/i;
const META_CACHE = 'mh-assets-meta-v1';
const META_KEY = 'manifest.json';
const SCOPE = self.registration.scope; // 例: https://…/monhero/monster-hero/

let manifest = null;        // { id, files: { path: { v, size, pack } } }
let manifestReady = null;   // 読み込み中の Promise(ナビゲーションのたびに作り直す)
let disabled = false;       // 設定で切にされた(外れるまでのあいだ、何もためず何も返さない)

const relPath = (url) => (url.href.startsWith(SCOPE) ? decodeURIComponent(url.pathname.slice(new URL(SCOPE).pathname.length)) : null);
const cacheKey = (path, v) => `${SCOPE}${encodeURI(path)}?v=${v}`;

async function loadStoredManifest() {
  try {
    const meta = await caches.open(META_CACHE);
    const res = await meta.match(META_KEY);
    if (res) manifest = await res.json();
  } catch (e) { /* 読めなければ一覧なしとして扱う(=何もしない) */ }
  return manifest;
}

// 一覧を取り直す。変わっていたら保存し、古いものを消す
async function refreshManifest() {
  let next = null;
  try {
    const res = await fetch(`${SCOPE}asset-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) next = await res.json();
  } catch (e) { /* 通信できないときは手元の一覧のまま */ }
  if (!next || !next.files || typeof next.id !== 'string') return manifest || loadStoredManifest();
  const changed = !manifest || manifest.id !== next.id;
  manifest = next;
  if (changed) {
    try {
      const meta = await caches.open(META_CACHE);
      await meta.put(META_KEY, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }));
    } catch (e) { /* 保存できなくても、この起動のあいだは使える */ }
    await pruneCache();
    await pruneCode();
  }
  return manifest;
}

// 一覧に無いもの・版の違うものを消す
async function pruneCache() {
  if (!manifest) return 0;
  let removed = 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const req of await cache.keys()) {
      const url = new URL(req.url);
      const path = relPath(url);
      const entry = path && manifest.files[path];
      if (!entry || url.searchParams.get('v') !== entry.v) { await cache.delete(req); removed++; }
    }
  } catch (e) { /* 次の機会に消す */ }
  return removed;
}

// 本体・データの置き場から、一覧に無い・版の違うものを消す
async function pruneCode() {
  if (!manifest) return 0;
  let removed = 0;
  try {
    if (!(await caches.has(CODE_CACHE))) return 0;
    const cache = await caches.open(CODE_CACHE);
    for (const req of await cache.keys()) {
      const url = new URL(req.url);
      const path = relPath(url);
      const entry = path && manifest.files[path];
      if (CODE_CACHE_OFF || !entry || entry.pack !== 'core' || url.searchParams.get('v') !== entry.v) { await cache.delete(req); removed++; }
    }
  } catch (e) { /* 次の機会に消す */ }
  return removed;
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 名前の違う古い置き場(将来 v2 にしたときの v1 など)を消す
    for (const name of await caches.keys()) {
      if (name.startsWith('mh-assets-') && name !== CACHE_NAME && name !== META_CACHE) await caches.delete(name);
      if (name.startsWith('mh-code-') && (name !== CODE_CACHE || CODE_CACHE_OFF)) await caches.delete(name);
    }
    manifestReady = refreshManifest();
    await manifestReady;
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'mh-asset-refresh') {
    manifestReady = refreshManifest();
    event.waitUntil(manifestReady.then(() => event.source && event.source.postMessage({ type: 'mh-asset-manifest', id: manifest && manifest.id })));
  } else if (data.type === 'mh-asset-disable') {
    disabled = true;
    event.waitUntil((async () => {
      for (const name of await caches.keys()) if (name.startsWith('mh-assets-') || name.startsWith('mh-code-')) await caches.delete(name);
      if (event.source) event.source.postMessage({ type: 'mh-asset-disabled' });
    })());
  } else if (data.type === 'mh-asset-prune') {
    event.waitUntil(pruneCache());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // ページを開くたびに一覧を取り直す。ページ本体の応答には手を出さない(respondWith しない)
  if (req.mode === 'navigate') {
    manifestReady = refreshManifest();
    event.waitUntil(manifestReady);
    return;
  }
  if (req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = relPath(url);
  // 本体・データの JS・CSS: ?v= 付き・retry なしのときだけ(版の無い取得・読み込み直しは素通し)
  if (path && CODE_PATH_RE.test(path)) {
    if (disabled || CODE_CACHE_OFF || !url.searchParams.get('v') || url.searchParams.has('retry')) return;
    event.respondWith(serveCode(event, req, url, path));
    return;
  }
  if (disabled || !path || !/^(audio|images|data\/images)\/.+\.(mp3|png|jpe?g|webp)$/i.test(path)) return;
  event.respondWith(serveAsset(event, req, url, path));
});

async function serveAsset(event, req, url, path) {
  if (!manifest) await (manifestReady || (manifestReady = loadStoredManifest().then(m => m || refreshManifest())));
  const v = url.searchParams.get('v');
  // ?v= の無い取得は、開いたばかりのページの一覧がそろうまで待ってから判断する(古い一覧で古い絵を返さない)
  if (!v && manifestReady) { try { await manifestReady; } catch (e) {} }
  const entry = manifest && manifest.files[path];
  // 一覧に無い・版が一覧と違う → ためない。ふつうに取りに行く
  if (!entry || (v && v !== entry.v)) return fetch(req);
  const key = cacheKey(path, entry.v);
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch (e) { cache = null; }
  // 版つきの URL で取りに行く(GitHub Pages は ?v= を無視して同じファイルを返し、ブラウザの古いキャッシュには当たらない)
  const res = await fetch(v ? req : new Request(key, { credentials: 'same-origin' }));
  // 事前ダウンロードの画面が自分でためる取得(x-mh-prefetch)は、ここでは二重にためない
  if (cache && res.ok && res.status === 200 && res.type === 'basic' && !req.headers.has('x-mh-prefetch')) {
    // ためるのは返したあと(待ってから返すと、絵や音が出るのが遅れる)
    event.waitUntil((disabled ? Promise.resolve() : cache.put(key, res.clone())).catch(() => { /* 容量いっぱいなどは、ためずに返すだけ */ }));
  }
  return res;
}


// 本体・データの JS・CSS を返す。URL の版が一覧とぴったり同じときだけ、ためた物を返す・ためる
async function serveCode(event, req, url, path) {
  if (!manifest) { try { await (manifestReady || (manifestReady = loadStoredManifest().then(m => m || refreshManifest()))); } catch (e) {} }
  const v = url.searchParams.get('v');
  const key = cacheKey(path, v);
  const sameAs = (m) => { const e = m && m.files[path]; return !!(e && e.pack === 'core' && e.v === v); };
  let cache = null;
  if (sameAs(manifest)) {
    try {
      cache = await caches.open(CODE_CACHE);
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch (e) { cache = null; }
  }
  const res = await fetch(req);
  if (!res.ok || res.status !== 200 || res.type !== 'basic') return res;
  // ためるのは返したあと。新しい版を出した直後は手元の一覧が古いことがあるので、ページを開いたときの一覧の取り直しを待ってから決める。
  // 一覧の版とぴったり同じで、中身の大きさも一覧と同じときだけためる(途中で切れた物をためない)
  const copy = res.clone();
  event.waitUntil((async () => {
    try {
      if (!sameAs(manifest) && manifestReady) await manifestReady;
      if (disabled || CODE_CACHE_OFF || !sameAs(manifest)) return;
      const body = await copy.blob();
      if (body.size !== manifest.files[path].size) return;
      const c = cache || await caches.open(CODE_CACHE);
      // 見出しは種類だけ写す(content-encoding などを写すと、もう元に戻した中身を読み違える端末がある)
      await c.put(key, new Response(body, { status: 200, headers: { 'Content-Type': copy.headers.get('Content-Type') || (path.endsWith('.css') ? 'text/css' : 'text/javascript') } }));
    } catch (e) { /* 容量いっぱいなどは、ためずに返すだけ */ }
  })());
  return res;
}
