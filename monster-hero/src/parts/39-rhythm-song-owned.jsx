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
const RHYTHM_SONG_PRICES = Object.freeze({ departure: 500, rpg: 500, midnight_studio: 500, hopes_and_dreams: 500, sparkling_pink_overture: 500, seasons_of_a_little_plaza: 500, eiyuu_no_akashi: 500, gourmet_race_64: 500, dr_wily_stage_1: 500, erfolg: 500, amakakeru_tsubasa: 500, beyond_the_same_sky: 500, desert_crown: 500, walkure: 500 });
// 1曲の値段で、組の別の版(short ver.)もいっしょに遊べる(2026-11-14 社長「1曲500で両方ついてくる」)。{ 別の版の id: 買う曲の id }。
// 保存するのは買った曲(全編)の id だけ。別の版は、全編を持っていれば開く(保存の形は変えない)
// 2026-11-19 英雄の証も同じ形にそろえた(ミラクル☆ミルクティ版 → 戦闘版。交換所で2枚に分かれて出ていたのを1枚・500Pで両版に)
// 2026-11-19 Dr.WILY STAGE 1 も同じ形(おっくせんまん版 → 原曲。曲組500P・両版開放で、交換所では1枚のカードだけ出す)
const RHYTHM_SONG_BUNDLE_OWNER = Object.freeze({ departure_short: 'departure', rpg_short: 'rpg', midnight_studio_short: 'midnight_studio', hopes_and_dreams_short: 'hopes_and_dreams', gourmet_race_dx: 'gourmet_race_64', eiyuu_no_akashi_milktea: 'eiyuu_no_akashi', dr_wily_stage_1_okkussenman: 'dr_wily_stage_1', erfolg_piano: 'erfolg', beyond_the_same_sky_short: 'beyond_the_same_sky', walkure_short: 'walkure' });
const rhythmSongOwnerId = (songId) => { const id = String(songId || ''); return RHYTHM_SONG_BUNDLE_OWNER[id] || id; };
const rhythmSongHasBundle = (songId) => Object.values(RHYTHM_SONG_BUNDLE_OWNER).includes(rhythmSongOwnerId(songId));
// 購入で一緒に開く版の songId(持ち主自身は除く)。バンドルの表が正本
const rhythmSongBundleIds = (songId) => {
  const owner = rhythmSongOwnerId(songId);
  return Object.keys(RHYTHM_SONG_BUNDLE_OWNER).filter((id) => RHYTHM_SONG_BUNDLE_OWNER[id] === owner && id !== owner);
};
// 購入で一緒に開く版の名前(版の切り替えボタンの名前)。購入の案内文に使う
const rhythmSongBundleLabels = (songId) => rhythmSongBundleIds(songId)
  .map((id) => (typeof rhythmSongVersionLabel === 'function' ? rhythmSongVersionLabel(id) : '')).filter(Boolean);
// 購入で一緒に開く版も含めた曲データ(持ち主→版の順)。ジャケットが版ごとに違う曲で、買うときに全部の絵を見せるために使う
const rhythmSongBundleSongs = (songId) => {
  if (typeof RHYTHM_SONGS === 'undefined') return [];
  const owner = rhythmSongOwnerId(songId);
  return [owner, ...rhythmSongBundleIds(owner)].map((id) => RHYTHM_SONGS.find((song) => song && song.songId === id)).filter(Boolean);
};

// イベントのあいだだけ無料の曲(2026-11-23 花の女3人のイベント・社長「開催中は無料、終わったらビートPで買う」)。
//   data/rhythm-event.js の rhythmEventFreeSongUntilMs が無料の終わる時刻を返す曲は、その時刻までは0(無料)、
//   それからは表に値段が無くても RHYTHM_SONG_DEFAULT_PRICE。★時刻は呼ばれるたびに数え直す(CLAUDE.md ⑥-4)
const rhythmSongFreeUntilMs = (songId) => {
  const ms = typeof rhythmEventFreeSongUntilMs === 'function' ? rhythmEventFreeSongUntilMs(rhythmSongOwnerId(songId)) : null;
  return Number.isFinite(ms) ? ms : null;
};
const rhythmSongPrice = (songId, nowMs = Date.now()) => {
  const freeUntil = rhythmSongFreeUntilMs(songId);
  if (freeUntil !== null && Number(nowMs) < freeUntil) return 0;
  const listed = RHYTHM_SONG_PRICES[rhythmSongOwnerId(songId)];
  const n = Math.floor(Number(listed === undefined && freeUntil !== null ? RHYTHM_SONG_DEFAULT_PRICE : listed));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const rhythmSongIsPaid = (songId) => rhythmSongPrice(songId) > 0;
// 持っている曲の保存値を、曲の id の配列に直す(無い・壊れている → 空。重複と文字でない値は捨てる)
// バンドルの版の id は、読み込むときに持ち主の id へ寄せる。版が後からバンドル化された曲
// (2026-11-19 英雄の証のミラクル☆ミルクティ版)を版だけ買っていた人も、持ち主ごと持っている
// ことにするための読み替えで、保存の形そのものは変えない(読み替えは冪等。次に買ったときに保存値も寄る)
const normalizeRhythmOwnedSongs = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((id) => typeof id === 'string' && id).map((id) => rhythmSongOwnerId(id)))];
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
  // ジャケットを重ねて見せる札で、どちらの版が手前か(札の曲 id → 手前の版の曲 id)。未指定なら持ち主の版が手前
  const [frontBySong, setFrontBySong] = React.useState({});
  // 売り場を離れる(タブを替える・交換所を出る)と、試し聴きを止めて元の BGM へ戻す
  // 試し聴きはモンヒロビートで遊ぶときと同じ鳴らし方(音ゲー設定の BGM 音量・曲ごとの音量合わせ)。2026-11-22 社長「試聴の音が遊ぶときの音量と違う」
  const handleRef = React.useRef(null), resumeKeyRef = React.useRef(null), reqRef = React.useRef(0);
  const stopListen = () => {
    ++reqRef.current;
    const h = handleRef.current; handleRef.current = null;
    if (h) { try { h.stop(); } catch (_) { /* 止まっている */ } }
    const key = resumeKeyRef.current; resumeKeyRef.current = null;
    if (key) { try { Audio_.playBGM(key); } catch (_) { /* 音が無い環境 */ } }
  };
  React.useEffect(() => () => { try { stopListen(); Audio_.stopPreview(); } catch (_) { /* 音が無い環境 */ } }, []);
  if (!songs.length) return null;
  const toggleListen = async (song) => {
    try {
      if (playingId === song.songId) { stopListen(); setPlayingId(''); return; }
      const hadHandle = !!handleRef.current;
      // 試し聴きの途中(読み込み中の連打も含む)なら、最初に覚えた元のBGMを引き継ぐ
      const prevKey = resumeKeyRef.current || (Audio_.currentBgmKey ? Audio_.currentBgmKey() : null);
      if (hadHandle) { const h = handleRef.current; handleRef.current = null; try { h.stop(); } catch (_) { /* 止まっている */ } }
      const req = ++reqRef.current;
      resumeKeyRef.current = prevKey || null;
      await Audio_.unlock();
      // 保存済みの音ゲー設定を読むだけ(書き換えない)。無い・壊れているときは既定値
      const saved = normalizeRhythmSettings(await storeGet(RHYTHM_SETTINGS_KEY, DEFAULT_RHYTHM_SETTINGS, false));
      const audio = await Audio_.startRhythmTrack(song.bgmTrackId, saved.bgmVolume, { loop: true });
      if (req !== reqRef.current || !audio) {
        if (audio) { try { audio.stop(); } catch (_) { /* 止まっている */ } }
        if (req === reqRef.current) { const key = resumeKeyRef.current; resumeKeyRef.current = null; if (key) Audio_.playBGM(key); setPlayingId(''); }
        return;
      }
      handleRef.current = audio;
      setPlayingId(song.songId);
    } catch (_) { setPlayingId(''); }
  };
  const anyBundle = songs.some((song) => rhythmSongHasBundle(song.songId));
  return <>
    {/* 文は、言葉のまとまりごとに折れるようにする(語の途中・「short ver.」の途中で折れない) */}
    <p data-rhythm-song-shop-note className="col-span-full -mt-1 text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      <span className="inline-block">買うと、その曲を全部の難易度で遊べます。</span>{' '}
      {anyBundle && [...new Set(songs.flatMap((song) => rhythmSongBundleLabels(song.songId)))].map((label, i, arr) => <span key={label} className="inline-block">{i < arr.length - 1 ? `${label}、` : `${label} も一緒に遊べます。`}</span>)}{' '}
      <span className="inline-block">みんなで対戦なら、</span><span className="inline-block">持っていなくてもその回だけ遊べます</span>
    </p>
    {songs.map((song) => {
      const price = rhythmSongPrice(song.songId);
      const has = owned.includes(song.songId);
      const src = typeof rhythmSongArtSrc === 'function' ? rhythmSongArtSrc(song) : '';
      const meta = rhythmSongShopMeta(song);
      const bundle = rhythmSongHasBundle(song.songId);
      const item = { id: `song_${song.songId}`, name: rhythmSongFullName(song), emoji: '🎵', icon: src || undefined, type: 'song', currency: 'beatPoint', cost: price, desc: bundle ? `新曲(全難易度・${rhythmSongBundleLabels(song.songId).join('・')} もセット)` : '新曲(全難易度で遊べます)' };
      const offer = { id: `song_${song.songId}`, kind: 'song', songId: song.songId, cost: price };
      const canBuy = !has && points >= price && !busy && !disabled;
      const listening = playingId === song.songId;
      // 版ごとのジャケット(持ち主→版の順)。絵が版ごとに違う札だけ、重ね表示の対象にする
      const bundleArts = rhythmSongBundleSongs(song.songId)
        .map((entry) => ({ entry, artSrc: typeof rhythmSongArtSrc === 'function' ? rhythmSongArtSrc(entry) : '' }))
        .filter((x) => x.artSrc);
      const multiJacket = bundleArts.length >= 2 && new Set(bundleArts.map((x) => x.artSrc.split('?')[0])).size >= 2;
      const frontEntry = multiJacket ? (bundleArts.find((x) => x.entry.songId === (frontBySong[song.songId] || song.songId)) || bundleArts[0]) : null;
      const backEntry = multiJacket ? bundleArts.find((x) => x.entry.songId !== frontEntry.entry.songId) : null;
      // 重ね表示の札は曲組の名前を出し、どちらの版が手前かはジャケット下の版名で見分ける
      const cardName = multiJacket ? (song.displayName || item.name) : item.name;
      return <div key={song.songId} data-rhythm-song-offer={song.songId}
        className={`relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-2 ${has ? 'border-emerald-500/60 bg-emerald-900/30' : 'border-white/10 bg-slate-900'}`}>
        {multiJacket ? (() => {
          // ジャケットが版ごとに違う曲は、2枚をずらして重ねて大きく見せる(2026-11-19 あっくん指示)。
          // 後ろは手前より少し大きく、右下にはみ出して見える。後ろは斜めに傾けて重ねる(あっくん追加指示)。
          // 札のタップで手前と後ろが入れ替わり、入れ替わった後も後ろになった方が斜めになる。
          // 拡大は手前のジャケットの虫めがねだけから(タップと競合させない)。絵が同じ版しかない曲は今までどおり1枚
          // タップの範囲は、ジャケットの重なりと下の「⇄ 版名」の行まで含める(2026-11-19 あっくん実機報告
          // 「小さすぎて押しづらすぎる」)。目印の行も押せる所に入れて、狙う場所を広くする
          const frontItem = { ...item, id: `song_${frontEntry.entry.songId}`, name: rhythmSongFullName(frontEntry.entry), icon: frontEntry.artSrc };
          const frontLabel = typeof rhythmSongVersionLabel === 'function' ? (rhythmSongVersionLabel(frontEntry.entry.songId) || '原曲') : '';
          const swapFront = () => setFrontBySong((prev) => ({ ...prev, [song.songId]: backEntry.entry.songId }));
          return <div className="w-full cursor-pointer" role="button" tabIndex={0} data-rhythm-song-jacket-stack={song.songId}
            aria-label={`${cardName}のジャケット入れ替え(いま手前は${frontLabel})`}
            onClick={swapFront} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); swapFront(); } }}>
            <div className="relative w-full">
              <div className="absolute bottom-0 right-0 w-[86%] brightness-[0.7]" style={{ transform: 'rotate(8deg)' }}>
                <div className="[container-type:inline-size]">
                  {typeof RhythmSongArt === 'function' ? <RhythmSongArt song={backEntry.entry} large /> : null}
                </div>
              </div>
              <div className="relative z-10 mb-[10%] w-[76%]">
                <div className="rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.55)] [container-type:inline-size]">
                  {typeof RhythmSongArt === 'function' ? <RhythmSongArt song={frontEntry.entry} large /> : null}
                </div>
                {onZoomIcon && <button type="button" data-rhythm-song-art-zoom
                  onClick={(e) => { e.stopPropagation(); onZoomIcon(frontItem); }}
                  aria-label={`${frontItem.name}のジャケットを大きく見る`}
                  className="absolute bottom-1 right-1 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/70 text-base leading-none shadow">🔍</button>}
              </div>
            </div>
            {/* 手前の版名。長い版名(ミラクル☆ミルクティ版)は、札の幅に合わせて字を縮めて1行に収める。
                字は以前(最大9px)より大きくし、幅が足りない長い版名だけ自動で縮む(2026-11-19 押しづらさの直し)。
                置き場所は札の余白(p-2)の分まで広げて測る。長い版名が札の縁で切れないようにするためで、
                札の padding を変えたらここの広げ幅も合わせること。行の高さは字を大きくしても札が伸びないよう
                詰めてある(伸びると同じ段の他の札の中に大きな空きができて、売り場の検査で落ちる) */}
            <div className="-ml-2 w-[calc(100%+1rem)] [container-type:inline-size]">
              <span className="mt-0.5 block whitespace-nowrap text-center font-black leading-[1.1] text-slate-300"
                style={{ fontSize: typeof rhythmTitleFitSize === 'function' ? rhythmTitleFitSize(`⇄ ${frontLabel}`, 12, 8) : 12 }}>{`⇄ ${frontLabel}`}</span>
            </div>
          </div>;
        })() : (
          <div className="w-full [container-type:inline-size]">
            {typeof RhythmSongArt === 'function'
              ? <RhythmSongArt song={song} large onZoom={src && onZoomIcon ? () => onZoomIcon(item) : null} />
              : null}
          </div>
        )}
        {/* 曲名は題名と副題を別のかたまりで描き、折れるのは境目だけにする(RhythmSongName)。
            幅に合わせて字を縮め(11px→8px)、それでも入らないときだけ境目で2行にする。
            重ね表示の札の表示名は曲組の名前(cardName)なので、測る文字列も cardName にそろえ、
            版名はジャケット下で見分ける決まりどおり曲名には副題を付けない */}
        <div className="w-full [container-type:inline-size]">
          <b data-rhythm-song-offer-name className="block w-full text-center font-black leading-tight text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere', fontSize: typeof rhythmTitleFitSize === 'function' ? rhythmTitleFitSize(cardName, 11, 8) : undefined }}>{multiJacket ? cardName : (typeof RhythmSongName === 'function' ? <RhythmSongName song={song}/> : cardName)}</b>
        </div>
        <small data-rhythm-song-offer-meta className="w-full text-center text-[9px] font-bold leading-tight text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
          {meta.creator && <span className="block">{meta.creator}</span>}
          <span className="block">{[meta.length, meta.levels].filter(Boolean).join(' ／ ')}</span>
          {bundle && <span className="block text-lime-300">{multiJacket
            ? `${bundleArts.map((x) => (typeof rhythmSongVersionLabel === 'function' ? rhythmSongVersionLabel(x.entry.songId) : '') || '原曲').join('・')} セット`
            : `${rhythmSongBundleLabels(song.songId).join('・')} つき`}</span>}
        </small>
        {/* 試し聴きと値段(所持済み)は、札の下にひとまとめにそろえる。作者の行が折れる・「short ver. つき」の有無で札ごとにずれない(r1115-162) */}
        <div data-rhythm-song-offer-foot className="mt-auto flex w-full flex-col items-center gap-1">
        <button type="button" data-rhythm-song-listen={song.songId} onClick={() => toggleListen(song)} aria-pressed={listening}
          aria-label={`${item.name}を試し聴き${listening ? '(止める)' : ''}`}
          className={`mh-hit-expand relative min-h-[32px] w-full rounded-lg border px-1 text-[11px] font-black active:scale-95 ${listening ? 'border-lime-300/70 bg-lime-500/25 text-lime-100' : 'border-white/20 bg-white/10 text-white'}`}>
          {listening ? '■ とめる' : '▶ 試し聴き'}
        </button>
        <div className="flex min-h-[44px] w-full items-center justify-center pt-1">
          {has
            ? <div className="whitespace-nowrap rounded-full bg-emerald-950/50 px-2 py-1 text-[10px] font-black text-emerald-400">所持済み</div>
            : <button type="button" data-rhythm-song-buy={song.songId} onClick={() => openSheet({ item, confirm: () => (onExchange ? onExchange(offer, 1) : false) })} disabled={!canBuy}
              aria-label={`${item.name}を${price}ビートPで交換`}
              className={`mh-button mh-button-primary flex min-h-[44px] w-full max-w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 text-[11px] font-black ${canBuy ? 'bg-violet-500 text-white active:scale-95' : 'bg-slate-800 text-slate-500'}`}>
              <span aria-hidden="true">🎟️</span><span>{price.toLocaleString()}</span>
            </button>}
        </div>
        </div>
      </div>;
    })}
  </>;
}
