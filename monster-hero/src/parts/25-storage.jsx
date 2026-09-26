const _memStore = {};
const hasWinStorage = () => typeof window !== 'undefined' && !!window.storage;
const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const k = '__mh_ls_test__'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
};

const storeGet = async (key, def, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.get(key, shared);
      return r && r.value !== undefined && r.value !== null ? JSON.parse(r.value) : def;
    }
  } catch { /* fall through */ }
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : def;
    }
  } catch { /* fall through to memory */ }
  return key in _memStore ? _memStore[key] : def;
};
// 初回プレイのプレビュー中だけ、保存を丸ごと止めるための鍵。★重要
// 画面ごとに「プレビューなら保存しない」を書き分ける方式だと、必ず書き忘れが出る
// (助手の選択・きき加入フラグ・村案内の既読・名前・アイコンは、それぞれ別の場所で保存している)。
// 保存の入口は storeSet ひとつなので、ここで止めれば経路を問わず取りこぼしがない。
// 読み込み(storeGet)は止めない。プレビュー中も本物のデータを見て画面を組み立てる。
let _storageWriteBlocked = false;
const setStorageWriteBlocked = (blocked) => { _storageWriteBlocked = !!blocked; };
const isStorageWriteBlocked = () => _storageWriteBlocked;
// ===== 保存が効いているかの見張り =====
// ★storeSet は書き込みの失敗を握りつぶすうえ、失敗しても _memStore には必ず書く。
//   そのため保存できなくなっても、そのセッションのあいだは読み戻せて画面は正常に見え、
//   落ちて読み込み直した瞬間に「最後に書けたところ」まで一斉に戻る
//   (2026-09-21・ユーザー報告「転生100回分戻るとかダイヤやプシュケーも戻ってるみたい」)。
//   ここで結果を控えておき、画面の側が気づいて止められるようにする。
//   ★控えるだけで、保存の中身も経路も変えない(storeSet の戻り値を見ていない呼び出しは今までどおり)。
let _storageWriteFailures = 0;      // 最後に成功してからの連続失敗数
let _storageLastError = '';         // 失敗したときの手がかり(QuotaExceededError など)
let _storageLastFailedKey = '';     // どのキーで失敗したか
let _storageLastOkAt = 0;           // 最後に書けた時刻
let _storageLargestWriteChars = 0;  // これまでに書けた1件の最大の長さ(次が書けるかを試す目安)
const noteStorageWriteOk = (chars) => {
  _storageWriteFailures = 0; _storageLastError = ''; _storageLastFailedKey = '';
  _storageLastOkAt = Date.now();
  if (chars > _storageLargestWriteChars) _storageLargestWriteChars = chars;
};
const noteStorageWriteFailure = (key, error) => {
  _storageWriteFailures += 1;
  _storageLastFailedKey = String(key || '');
  _storageLastError = String((error && (error.name || error.message)) || error || '');
};
const getStorageHealth = () => ({
  failures: _storageWriteFailures, lastError: _storageLastError,
  lastFailedKey: _storageLastFailedKey, lastOkAt: _storageLastOkAt,
  largestWriteChars: _storageLargestWriteChars,
});
const storeSet = async (key, val, shared=false) => {
  // メモリの控えにも書かない。ここへ残すと、プレビューを終えたあとも古い値が読めてしまう
  // (プレビュー中は「保存しないのが正しい」ので、失敗としては数えない)
  if (_storageWriteBlocked) return true;
  _memStore[key] = val;
  let raw = '';
  try { raw = JSON.stringify(val); } catch (e) { noteStorageWriteFailure(key, e); return false; }
  try {
    if (hasWinStorage()) { await window.storage.set(key, raw, shared); noteStorageWriteOk(raw.length); return true; }
  } catch (e) { noteStorageWriteFailure(key, e); }
  try {
    // ★hasLocalStorage() は毎回ためし書きをするので、いっぱいになるとここが false になる。
    //   そのときも「書けなかった」として数える(黙って通り過ぎない)
    if (hasLocalStorage()) { window.localStorage.setItem(key, raw); noteStorageWriteOk(raw.length); return true; }
    noteStorageWriteFailure(key, 'localStorage が使えません');
    return false;
  } catch (e) { noteStorageWriteFailure(key, e); return false; }
};
// 「次の1件が書けるか」を先に試す。書いてすぐ消すので、保存データは汚さない。
// ★mh_ で始めないのは、バックアップ(mh_ の全キーを書き出す)へ混ぜないため。
const STORAGE_PROBE_KEY = '__mh_ls_probe__';
const probeStorageWritable = () => {
  if (hasWinStorage()) return true;            // window.storage 側は実際の書き込みの成否で見る
  if (!hasLocalStorage()) return false;
  // ★上限を置く。1度でも大きいものを書けた端末だと、その2倍を試すことになり、
  //   整理したあとでも「書けない」と判定してしまう。見たいのは「次の1件が入る余裕」なので
  //   64KBで十分(いちばん大きいランキングの控えでも、整理後はこの範囲に収まる)
  const chars = Math.min(65536, Math.max(4096, _storageLargestWriteChars * 2));
  try {
    window.localStorage.setItem(STORAGE_PROBE_KEY, 'x'.repeat(chars));
    return true;
  } catch (e) {
    noteStorageWriteFailure(STORAGE_PROBE_KEY, e);
    return false;
  } finally {
    try { window.localStorage.removeItem(STORAGE_PROBE_KEY); } catch {}
  }
};
// いま保存データがどれだけの大きさかを数える(このゲームの mh_ で始まるキーだけ)。
// 上限はブラウザによって違い、iOSのSafariはおおよそ5MBで頭打ちになる。
const storageUsageReport = () => {
  if (!hasLocalStorage()) return null;
  const items = [];
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || key.indexOf('mh_') !== 0) continue;
      const chars = (window.localStorage.getItem(key) || '').length + key.length;
      total += chars;
      items.push({ key, chars });
    }
  } catch { return null; }
  items.sort((a, b) => b.chars - a.chars);
  return { total, items };
};
// ===== 演奏の既定を元へ戻す一度きりの移行(2026-09-24・ユーザー指示
//   「もしもとより操作性変わるならもとのやつをデフォルトに変えて」) =====
// 同じ日に「ライブ背景=派手」「描く回数=省電力」を既定にして出したが、実機で操作感が変わったと言われた。
// 既定を元(シンプル / 端末に合わせる)へ戻しても、オプションで一度「保存」した人は
// 当時の既定がそのまま保存値に入っているので、既定を変えただけでは戻らない。
// そこで**一度だけ**、保存値がその当時の既定と同じときに限って元の値へ置き換える。
// ★ほかの項目・ほかのキーには触らない。済んだら専用のフラグを立て、二度と走らせない(CLAUDE.md ⑦)。
const RHYTHM_PLAY_DEFAULTS_RESTORED_KEY = 'mh_rhythm_play_defaults_restored_v1';
const restoreRhythmPlayDefaultsOnce = async raw => {
  if(await storeGet(RHYTHM_PLAY_DEFAULTS_RESTORED_KEY,false,false)===true)return raw;
  let next=raw;
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
    const patch={};
    if(raw.stageEffect==='VIVID')patch.stageEffect='SIMPLE';
    if(raw.frameRateMode==='POWER_SAVE')patch.frameRateMode='DEVICE';
    if(Object.keys(patch).length){next={...raw,...patch};await storeSet(RHYTHM_SETTINGS_KEY,normalizeRhythmSettings(next),false);}
  }
  await storeSet(RHYTHM_PLAY_DEFAULTS_RESTORED_KEY,true,false);
  return next;
};
const saveRhythmSettings = async value => {
  const normalized=normalizeRhythmSettings(value); await storeSet(RHYTHM_SETTINGS_KEY,normalized,false); return normalized;
};
// モンスターノーツ用のマスモン設定は既存の音ゲー設定・BESTへ混ぜず、専用キーへ分けて保存する。
// 保存するのは「マスモンの個体IDの並び」だけで、手元にいるかどうかの確認はここでは行わない
// (マスモン一覧を読む前に保存し直しても、設定が消えないようにするため)。
const saveRhythmMonsterSlots = async value => {
  const normalized=sanitizeRhythmMonsterSlotIds(value); await storeSet(RHYTHM_MONSTER_SLOT_KEY,normalized,false); return normalized;
};
const saveRhythmBestRecord = async (records,songId,difficultyId,value) => {
  if(!RHYTHM_SONGS.some(song=>song.songId===songId)||!RHYTHM_DIFFICULTIES.some(item=>item.id===difficultyId)) return normalizeRhythmBestRecords(records);
  const normalized=normalizeRhythmBestRecords(records);
  normalized[songId][difficultyId]=normalizeRhythmBestRecord(value);
  await storeSet(RHYTHM_BEST_RECORDS_KEY,normalized,false); return normalized;
};
// イベントPは通常イベント共通の恒久残高。イベント終了では消さない。
const RHYTHM_EVENT_POINTS_KEY='mh_rhythm_event_points_v1';
const normalizeRhythmEventPoints=value=>{
  const n=Number(value);
  return Number.isFinite(n)?Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Math.floor(n))):0;
};
const loadRhythmEventPoints=async()=>normalizeRhythmEventPoints(await storeGet(RHYTHM_EVENT_POINTS_KEY,0,false));
const addRhythmEventPointsNow=async amount=>{
  const requested=normalizeRhythmEventPoints(amount);
  const before=await loadRhythmEventPoints();
  if(requested<=0)return {before,after:before,added:0};
  const after=Math.min(Number.MAX_SAFE_INTEGER,before+requested);
  const added=after-before;
  if(added>0)await storeSet(RHYTHM_EVENT_POINTS_KEY,after,false);
  return {before,after,added};
};
// ★「読む → 待つ → 足して書く」なので、待たずに2回続けて呼ぶと、2回とも同じ古い値を読み、
//   あとから書いたほうだけが残る。曲の終わりに本体のビートPとラッキーラッシュのおまけを続けて
//   足していて、本体のぶんが消えていた(2026-09-26 に見つけた。09-25 のラッキーラッシュ追加から)。
//   前の足し算が書き終わってから次を始める順番待ちにして、どこから呼んでも取りこぼさないようにする
let rhythmEventPointsQueue=Promise.resolve();
const addRhythmEventPoints=amount=>{
  const run=rhythmEventPointsQueue.then(()=>addRhythmEventPointsNow(amount));
  rhythmEventPointsQueue=run.catch(()=>{});
  return run;
};

const storeList = async (prefix, shared=false) => {
  try {
    if (hasWinStorage()) {
      const r = await window.storage.list(prefix, shared);
      return (r && r.keys) ? r.keys : [];
    }
  } catch {}
  try {
    if (hasLocalStorage()) {
      const keys = [];
      for (let i=0;i<window.localStorage.length;i++){ const k=window.localStorage.key(i); if(k&&k.startsWith(prefix)) keys.push(k); }
      return keys;
    }
  } catch {}
  return Object.keys(_memStore).filter(k => k.startsWith(prefix));
};
