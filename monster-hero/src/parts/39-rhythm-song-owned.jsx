// ===== モンヒロビート: 新曲をビートPで1曲ずつ買う仕組み(2026-11-13・台帳 2026-11-08「新曲の購入(ビートP500)の細部」) =====
//
// 決まり(社長):
//  ・今ある曲は無料。**有料の印を付けた曲だけ**買う(印 = 下の RHYTHM_SONG_PRICES に曲の id と値段を書くこと)。
//    2026-11-13 の時点では、どの曲にも印は付けない(本オープン後の LAMIA・サウダージ2曲・メガロバニア2曲も無料のまま)
//  ・買った曲は全難易度で遊べる。曲えらびとビートP交換所の「曲」の両方で買える。お試しは試し聴きだけ(買うまで演奏はできない)
//  ・マルチは持っていない人もその回だけ遊べて、記録も載る(ここでは何も止めない)。総合・週間ランキングにもふつうに入る
//  ・助手とのセッションは、無料の曲+持っている曲から選ぶ(rhythmSongPickable)
//  ・値段は RHYTHM_SONG_PRICES の1か所で変える
//  ・持っている曲は新しいキー mh_rhythm_owned_songs_v1(曲の id の配列)。データ引き継ぎは mh_ を全部写すので一緒に移る
//
// ★有料の曲の足し方は rhythm-song-add スキルの「有料の曲にするとき」。この表に1行足すだけで、画面・交換所・助手が従う
const RHYTHM_SONG_OWNED_KEY = 'mh_rhythm_owned_songs_v1';
const RHYTHM_SONG_DEFAULT_PRICE = 500;
// 有料の曲: { 曲の id: ビートP }。いまは1曲もない(無料のまま)
const RHYTHM_SONG_PRICES = Object.freeze({});

const rhythmSongPrice = (songId) => {
  const n = Math.floor(Number(RHYTHM_SONG_PRICES[String(songId || '')]));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const rhythmSongIsPaid = (songId) => rhythmSongPrice(songId) > 0;
// 持っている曲の保存値を、曲の id の配列に直す(無い・壊れている → 空。重複と文字でない値は捨てる)
const normalizeRhythmOwnedSongs = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((id) => typeof id === 'string' && id))];
};
// 買わないと遊べない曲か(有料の印があり、まだ持っていない)
const rhythmSongLocked = (songId, owned) => rhythmSongIsPaid(songId) && !normalizeRhythmOwnedSongs(owned).includes(String(songId || ''));
// 有料の曲の一覧(公開している曲の中から。交換所の「曲」と、買える曲の数に使う)
const rhythmPaidSongList = () => (typeof rhythmDemoSongs === 'function' && typeof RHYTHM_SONGS !== 'undefined' ? rhythmDemoSongs(RHYTHM_SONGS) : []).filter((song) => song && rhythmSongIsPaid(song.songId));

// 端末の持っている曲(読んだ値を覚えておき、買ったら画面へ知らせる)
const RHYTHM_SONG_OWNED = (() => {
  let list = [];
  let loading = null;
  const subs = new Set();
  const emit = () => subs.forEach((fn) => { try { fn(list); } catch (_) { /* 画面が消えたあと */ } });
  const api = {
    get: () => list,
    replace(next) { list = normalizeRhythmOwnedSongs(next); emit(); },
    // 保存から読み直す。同時に呼ばれたら1回にまとめる。読めなかったら今の値のまま
    reload() {
      if (!loading) {
        loading = Promise.resolve().then(() => storeGet(RHYTHM_SONG_OWNED_KEY, [], false))
          .then((v) => { list = normalizeRhythmOwnedSongs(v); emit(); })
          .catch(() => {})
          .then(() => { loading = null; return list; });
      }
      return loading;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  return api;
})();
// 画面から持っている曲を読む。開いたときに保存から読み直す(買ったら自動で描き直される)
const useRhythmOwnedSongs = () => {
  const [owned, setOwned] = React.useState(() => RHYTHM_SONG_OWNED.get());
  React.useEffect(() => {
    const off = RHYTHM_SONG_OWNED.subscribe(setOwned);
    RHYTHM_SONG_OWNED.reload();
    return off;
  }, []);
  return owned;
};
// 助手が選べる曲(無料の曲+持っている曲)。絞った結果が空になるときは、元のままにする(曲が選べなくならないように)
const rhythmSongPickable = (songIds) => {
  const ids = Array.isArray(songIds) ? songIds : [];
  const owned = RHYTHM_SONG_OWNED.get();
  const kept = ids.filter((id) => !rhythmSongLocked(id, owned));
  return kept.length ? kept : ids;
};

// 曲を買う(曲えらびと交換所の両方から呼ぶ)。
// ★保存されている値を読み直してから計算し、ビートPと持っている曲を1つの取引で保存する(失敗したら両方戻す)
// 戻り値 { ok, reason: 'unknown'|'free'|'owned'|'points'|'save', eventPoints, cost }
const rhythmSongBuy = async (songId) => {
  const id = String(songId || '');
  const price = rhythmSongPrice(id);
  if (!id || !(typeof RHYTHM_SONGS !== 'undefined' && RHYTHM_SONGS.some((song) => song && song.songId === id))) return { ok: false, reason: 'unknown' };
  if (!price) return { ok: false, reason: 'free' };
  const beforePoints = await loadRhythmEventPoints();
  const stored = await storeGet(RHYTHM_SONG_OWNED_KEY, [], false);
  const cur = normalizeRhythmOwnedSongs(stored);
  if (cur.includes(id)) return { ok: false, reason: 'owned', eventPoints: beforePoints };
  if (!(beforePoints >= price)) return { ok: false, reason: 'points', eventPoints: beforePoints, cost: price };
  const next = [...cur, id];
  const nextPoints = beforePoints - price;
  const saved = await saveStoredValuesOrRollback([
    { key: RHYTHM_EVENT_POINTS_KEY, before: beforePoints, next: nextPoints },
    { key: RHYTHM_SONG_OWNED_KEY, before: stored, next },
  ], storeGet, storeSet);
  if (!saved) return { ok: false, reason: 'save', eventPoints: beforePoints };
  RHYTHM_SONG_OWNED.replace(next);
  return { ok: true, eventPoints: nextPoints, cost: price };
};
const rhythmSongBuyReasonText = (reason) => (reason === 'points' ? 'ビートPが足りません。'
  : reason === 'owned' ? 'この曲はもう持っています。'
    : reason === 'save' ? '買うのを保存できませんでした。ビートPと持っている曲は変わっていません。'
      : '買えませんでした。');

// ビートP交換所の「曲」の売り場に並べる札(曲の絵・名前・値段)。有料の曲が1曲もなければ何も並ばない(タブも出ない)
function RhythmSongShopList({ points = 0, busy = false, disabled = false, openSheet, onExchange, onZoomIcon = null }) {
  const owned = useRhythmOwnedSongs();
  const songs = rhythmPaidSongList();
  if (!songs.length) return null;
  return <>
    <p data-rhythm-song-shop-note className="col-span-full -mt-1 text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      買うと、その曲を全部の難易度で遊べます。みんなで対戦なら、持っていなくてもその回だけ遊べます
    </p>
    {songs.map((song) => {
      const price = rhythmSongPrice(song.songId);
      const has = owned.includes(song.songId);
      const src = typeof rhythmSongArtSrc === 'function' ? rhythmSongArtSrc(song) : '';
      const item = { id: `song_${song.songId}`, name: rhythmSongFullName(song), emoji: '🎵', icon: src || undefined, type: 'song', currency: 'beatPoint', cost: price, desc: '新曲(全難易度で遊べます)' };
      const offer = { id: `song_${song.songId}`, kind: 'song', songId: song.songId, cost: price };
      return <MarketProductCard key={song.songId} dataAttrs={{ 'data-rhythm-song-offer': song.songId }}
        item={item} owned={has} comingSoon={false}
        canBuy={!has && points >= price && !busy}
        disabled={disabled}
        onZoom={() => onZoomIcon && src && onZoomIcon(item)}
        onBuy={() => openSheet({ item, confirm: () => (onExchange ? onExchange(offer, 1) : false) })}
      />;
    })}
  </>;
}
