// ===== モンヒロビート: 新曲をビートPで1曲ずつ買う仕組み(2026-11-13・台帳 2026-11-08「新曲の購入(ビートP500)の細部」) =====
//
// 決まり(社長):
//  ・今ある曲は無料。**有料の印を付けた曲だけ**買う(印 = 下の RHYTHM_SONG_PRICES に曲の id と値段を書くこと)。
//    2026-11-13 の時点では、どの曲にも印は付けない(本オープン後の LAMIA・サウダージ2曲・メガロバニア2曲も無料のまま)
//  ・買った曲は全難易度で遊べる。short ver. がある曲は1回の購入で両方開く(RHYTHM_SONG_BUNDLE_OWNER)。曲えらびとビートP交換所の「曲」の両方で買える。お試しは試し聴きだけ(買うまで演奏はできない)
//  ・マルチは持っていない人もその回だけ遊べて、記録も載る(ここでは何も止めない)。総合・週間ランキングにもふつうに入る
//  ・助手とのセッションは、無料の曲+持っている曲から選ぶ(rhythmSongPickable)
//  ・値段は RHYTHM_SONG_PRICES の1か所で変える
//  ・持っている曲は新しいキー mh_rhythm_owned_songs_v1(曲の id の配列)。データ引き継ぎは mh_ を全部写すので一緒に移る
//
// ★有料の曲の足し方は rhythm-song-add スキルの「有料の曲にするとき」。この表に1行足すだけで、画面・交換所・助手が従う
const RHYTHM_SONG_OWNED_KEY = 'mh_rhythm_owned_songs_v1';
const RHYTHM_SONG_DEFAULT_PRICE = 500;
// 有料の曲: { 曲の id: ビートP }。2026-11-14 の新曲3つから(departure!・RPG・Midnight Studio。LAMIA・サウダージ・メガロバニアは無料のまま)
const RHYTHM_SONG_PRICES = Object.freeze({ departure: 500, rpg: 500, midnight_studio: 500 });
// 1曲の値段で、組の別の版(short ver.)もいっしょに遊べる(2026-11-14 社長「1曲500で両方ついてくる」)。{ 別の版の id: 買う曲の id }。
// 保存するのは買った曲(全編)の id だけ。別の版は、全編を持っていれば開く(保存の形は変えない)
const RHYTHM_SONG_BUNDLE_OWNER = Object.freeze({ departure_short: 'departure', rpg_short: 'rpg', midnight_studio_short: 'midnight_studio' });
const rhythmSongOwnerId = (songId) => { const id = String(songId || ''); return RHYTHM_SONG_BUNDLE_OWNER[id] || id; };
const rhythmSongHasBundle = (songId) => Object.values(RHYTHM_SONG_BUNDLE_OWNER).includes(rhythmSongOwnerId(songId));

const rhythmSongPrice = (songId) => {
  const n = Math.floor(Number(RHYTHM_SONG_PRICES[rhythmSongOwnerId(songId)]));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const rhythmSongIsPaid = (songId) => rhythmSongPrice(songId) > 0;
// 持っている曲の保存値を、曲の id の配列に直す(無い・壊れている → 空。重複と文字でない値は捨てる)
const normalizeRhythmOwnedSongs = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((id) => typeof id === 'string' && id))];
};
// 買わないと遊べない曲か(有料の印があり、まだ持っていない)
const rhythmSongLocked = (songId, owned) => rhythmSongIsPaid(songId) && !normalizeRhythmOwnedSongs(owned).includes(rhythmSongOwnerId(songId));
// 有料の曲の一覧(公開している曲の中から。交換所の「曲」と、買える曲の数に使う)
const rhythmPaidSongList = () => (typeof rhythmDemoSongs === 'function' && typeof RHYTHM_SONGS !== 'undefined' ? rhythmDemoSongs(RHYTHM_SONGS) : []).filter((song) => song && rhythmSongIsPaid(song.songId) && rhythmSongOwnerId(song.songId) === song.songId);

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
  const asked = String(songId || '');
  if (!asked || !(typeof RHYTHM_SONGS !== 'undefined' && RHYTHM_SONGS.some((song) => song && song.songId === asked))) return { ok: false, reason: 'unknown' };
  const id = rhythmSongOwnerId(asked);
  const price = rhythmSongPrice(id);
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

// ビートP交換所の「曲」の売り場に並べる札(曲の絵・名前・作者と長さ・Lv.の幅・試し聴き・値段)。有料の曲が1曲もなければ何も並ばない(タブも出ない)
// 2026-11-14 社長「ジャケットがアップで見れない。視聴ができない」: 絵を大きくして押すと拡大・試し聴きのボタンを付け、札の空きに作者・長さ・難易度の幅を入れた。
// 試し聴きは、オプションの「BGM試聴」と同じ Audio_.previewBGM(BGM は止まり、止めると元の BGM に戻る・音量は BGM の音量)
const rhythmSongShopMeta = (song) => {
  const charts = song && song.difficulties ? Object.values(song.difficulties) : [];
  const hell = typeof RHYTHM_HELL_CHARTS !== 'undefined' && song ? RHYTHM_HELL_CHARTS[song.songId] : null;
  const levels = [...charts, hell].map((c) => Number(c && c.level)).filter((n) => Number.isFinite(n) && n > 0);
  const track = typeof BGM_TRACK_BY_ID !== 'undefined' && song ? BGM_TRACK_BY_ID[song.bgmTrackId] : null;
  const first = charts.find((c) => c && Number(c.durationMs) > 0) || null;
  return {
    creator: track && typeof track.creator === 'string' ? track.creator : '',
    length: typeof rhythmSongLengthLabel === 'function' ? rhythmSongLengthLabel(song, first) : '',
    levels: levels.length ? (Math.min(...levels) === Math.max(...levels) ? `Lv.${levels[0]}` : `Lv.${Math.min(...levels)}〜${Math.max(...levels)}`) : '',
  };
};
function RhythmSongShopList({ points = 0, busy = false, disabled = false, openSheet, onExchange, onZoomIcon = null }) {
  const owned = useRhythmOwnedSongs();
  const songs = rhythmPaidSongList();
  const [playingId, setPlayingId] = React.useState('');
  // 売り場を離れる(タブを替える・交換所を出る)と、試し聴きを止めて元の BGM へ戻す
  React.useEffect(() => () => { try { Audio_.stopPreview(); } catch (_) { /* 音が無い環境 */ } }, []);
  if (!songs.length) return null;
  const toggleListen = async (song) => {
    try {
      await Audio_.unlock();
      const started = await Audio_.previewBGM(song.bgmTrackId);
      setPlayingId(started ? song.songId : '');
    } catch (_) { setPlayingId(''); }
  };
  const anyBundle = songs.some((song) => rhythmSongHasBundle(song.songId));
  return <>
    {/* 文は、言葉のまとまりごとに折れるようにする(語の途中・「short ver.」の途中で折れない) */}
    <p data-rhythm-song-shop-note className="col-span-full -mt-1 text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      <span className="inline-block">買うと、その曲を全部の難易度で遊べます。</span>{' '}
      {anyBundle && <><span className="inline-block">short ver. も一緒に遊べます。</span>{' '}</>}
      <span className="inline-block">みんなで対戦なら、</span><span className="inline-block">持っていなくてもその回だけ遊べます</span>
    </p>
    {songs.map((song) => {
      const price = rhythmSongPrice(song.songId);
      const has = owned.includes(song.songId);
      const src = typeof rhythmSongArtSrc === 'function' ? rhythmSongArtSrc(song) : '';
      const meta = rhythmSongShopMeta(song);
      const bundle = rhythmSongHasBundle(song.songId);
      const item = { id: `song_${song.songId}`, name: rhythmSongFullName(song), emoji: '🎵', icon: src || undefined, type: 'song', currency: 'beatPoint', cost: price, desc: bundle ? '新曲(全難易度・short ver. もセット)' : '新曲(全難易度で遊べます)' };
      const offer = { id: `song_${song.songId}`, kind: 'song', songId: song.songId, cost: price };
      const canBuy = !has && points >= price && !busy && !disabled;
      const listening = playingId === song.songId;
      return <div key={song.songId} data-rhythm-song-offer={song.songId}
        className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-2 ${has ? 'border-emerald-500/60 bg-emerald-900/30' : 'border-white/10 bg-slate-900'}`}>
        <div className="w-full [container-type:inline-size]">
          {typeof RhythmSongArt === 'function'
            ? <RhythmSongArt song={song} large onZoom={src && onZoomIcon ? () => onZoomIcon(item) : null} />
            : null}
        </div>
        <b data-rhythm-song-offer-name className="w-full text-center text-[11px] font-black leading-tight text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{item.name}</b>
        <small data-rhythm-song-offer-meta className="w-full text-center text-[9px] font-bold leading-tight text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
          {meta.creator && <span className="block">{meta.creator}</span>}
          <span className="block">{[meta.length, meta.levels].filter(Boolean).join(' ／ ')}</span>
          {bundle && <span className="block text-lime-300">short ver. つき</span>}
        </small>
        <button type="button" data-rhythm-song-listen={song.songId} onClick={() => toggleListen(song)} aria-pressed={listening}
          aria-label={`${item.name}を試し聴き${listening ? '(止める)' : ''}`}
          className={`mh-hit-expand relative min-h-[32px] w-full rounded-lg border px-1 text-[11px] font-black active:scale-95 ${listening ? 'border-lime-300/70 bg-lime-500/25 text-lime-100' : 'border-white/20 bg-white/10 text-white'}`}>
          {listening ? '■ とめる' : '▶ 試し聴き'}
        </button>
        <div className="mt-auto flex w-full items-center justify-center pt-1">
          {has
            ? <div className="whitespace-nowrap rounded-full bg-emerald-950/50 px-2 py-1 text-[10px] font-black text-emerald-400">所持済み</div>
            : <button type="button" data-rhythm-song-buy={song.songId} onClick={() => openSheet({ item, confirm: () => (onExchange ? onExchange(offer, 1) : false) })} disabled={!canBuy}
              aria-label={`${item.name}を${price}ビートPで交換`}
              className={`mh-button mh-button-primary flex min-h-[44px] w-full max-w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 text-[11px] font-black ${canBuy ? 'bg-violet-500 text-white active:scale-95' : 'bg-slate-800 text-slate-500'}`}>
              <span aria-hidden="true">🎟️</span><span>{price.toLocaleString()}</span>
            </button>}
        </div>
      </div>;
    })}
  </>;
}
