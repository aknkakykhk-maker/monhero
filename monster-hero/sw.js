// 事前ダウンロード(曲・画像を端末にためておく)の Service Worker。
// 説明の正本: docs/spec/ASSET_PREFETCH.md / 一覧: asset-manifest.json(tools/build-asset-manifest.js が作る)
//
// 【いちばん大事な決めごと】
// ・扱うのは asset-manifest.json に載っている音源と画像だけ。HTML・JS・CSS・JSON・version.json・
//   Supabase などには respondWith しない(ブラウザがふつうに取りに行く)。
//   だからゲーム本体の更新は、この SW があっても無くても今まで通り必ず新しい版が動く
// ・ためる鍵は「パス?v=<中身のハッシュ>」。中身が変われば鍵が変わるので、古い絵や音を返すことはない
// ・一覧が変わったら、一覧に無い・版の違う古いものを消す
// ・Range(範囲指定)つきの取得には手を出さない(<video> など。丸ごと返すと iPhone で再生できない)
// ・保存データ(localStorage)とランキングには一切触れない
'use strict';

const CACHE_NAME = 'mh-assets-v1';
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

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 名前の違う古い置き場(将来 v2 にしたときの v1 など)を消す
    for (const name of await caches.keys()) {
      if (name.startsWith('mh-assets-') && name !== CACHE_NAME && name !== META_CACHE) await caches.delete(name);
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
      for (const name of await caches.keys()) if (name.startsWith('mh-assets-')) await caches.delete(name);
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
