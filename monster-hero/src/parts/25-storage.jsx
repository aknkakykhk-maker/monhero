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
const storeSet = async (key, val, shared=false) => {
  // メモリの控えにも書かない。ここへ残すと、プレビューを終えたあとも古い値が読めてしまう
  if (_storageWriteBlocked) return;
  _memStore[key] = val;
  try {
    if (hasWinStorage()) { await window.storage.set(key, JSON.stringify(val), shared); return; }
  } catch {}
  try {
    if (hasLocalStorage()) { window.localStorage.setItem(key, JSON.stringify(val)); }
  } catch {}
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
