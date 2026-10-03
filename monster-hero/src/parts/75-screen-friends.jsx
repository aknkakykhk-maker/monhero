// ==== 画面: フレンド(gameState === 'FRIENDS') ====
//
// フレンド一覧・申請・追加(フレンドコード)・ブロック・フレンドのプロフィール閲覧を1画面に収める。
// 設計の正本: docs/spec/FRIENDS.md / 通信: 34-friends-api.jsx(Supabase の friend_codes / friend_links)。
//
// 【この画面の決めごと】
// ・保存データ(mh_*)には一切触れない。新しい保存キーも作らない。フレンドの正本はサーバー
// ・自分のブリーダーIDは ensureBreederId() で取る。IDが作れない端末(保存できない環境)は、
//   「この端末ではフレンドを使えません」と出す
// ・表がまだ無い環境(SQL未適用)は「準備中」。エラー扱いにしない
// ・タイマーは持たない(結果の文は次の操作まで出したままにする)
// ・フレンドを増やす入口は2つ。①フレンドコードの入力(この画面) ②ランキングの名前から(60-app 側のシート)
//   どちらも sbSendFriendRequest を通る。申請の状態の判断はそこだけが持つ
const FRIENDS_RESULT_TEXT = Object.freeze({
  sent: ['フレンド申請を送りました。承認されるとフレンドになります', 'ok'],
  accepted: ['フレンドになりました!', 'ok'],
  already: ['この人とはもうフレンドです', 'info'],
  pending: ['すでに申請しています。返事を待ちましょう', 'info'],
  self: ['自分自身にはフレンド申請できません', 'warn'],
  notfound: ['そのフレンドコードの人が見つかりません。コードを確かめてください', 'warn'],
  'blocked-by-me': ['この人はブロック中です。申請するには、先にブロックを解除してください', 'warn'],
  unavailable: ['この人には申請できませんでした', 'warn'],
  full: [`フレンドがいっぱいです(${FRIENDS_MAX}人まで)。だれかを解除すると申請できます`, 'warn'],
  'their-full': ['相手のフレンドがいっぱいで、いまは成立できませんでした', 'warn'],
  limit: [`申請中の人が多すぎます(${FRIENDS_PENDING_MAX}人まで)。返事を待つか、取り消してください`, 'warn'],
  gone: ['この申請はもう変わっていました。一覧を更新しました', 'info'],
  declined: ['申請を断りました', 'info'],
  blocked: ['ブロックしました', 'info'],
  unblocked: ['ブロックを解除しました', 'info'],
  cancelled: ['申請を取り消しました', 'info'],
  removed: ['フレンドを解除しました', 'info'],
  notready: ['フレンド機能はただいま準備中です', 'warn'],
  error: ['通信がうまくいきませんでした。少し待ってからもう一度ためしてください', 'warn'],
});
const FRIENDS_TONE_CLASS = Object.freeze({
  ok: 'border-emerald-400/60 bg-emerald-950/50 text-emerald-100',
  info: 'border-sky-400/50 bg-sky-950/40 text-sky-100',
  warn: 'border-amber-400/60 bg-amber-950/40 text-amber-100',
});

// 「2026-09-01」→「2026年9月1日」
const friendsDayText = (day) => {
  const m = typeof day === 'string' ? day.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : '';
};
// requestCount … 届いている申請の件数(あれば最初に「申請」のタブを開く)
// onIncomingCount … 読み込み直したあと、届いている申請の数を知らせる(HOME・プロフィールのバッジを合わせるため)
// onOpenMonsterDetail … 好きなモンスターの詳細を開く(ランキングの詳細と同じ画面)
function FriendsScreen({ resolveIconUrl, target = null, requestCount = 0, onBack, onTargetHandled, onIncomingCount, onOpenMonsterDetail }) {
  const [tab, setTab] = React.useState(Number(requestCount) > 0 ? 'requests' : 'friends');
  const [phase, setPhase] = React.useState('loading');   // loading / ready / notready / noid / error
  const [selfId, setSelfId] = React.useState('');
  const [myCode, setMyCode] = React.useState('');
  const [groups, setGroups] = React.useState({ friends: [], incoming: [], outgoing: [], blocked: [] });
  const [profiles, setProfiles] = React.useState({});
  const [summaries, setSummaries] = React.useState({});     // フレンドに見せる情報(いまの場所・プレイ時間・最高絆Lvなど)
  const [codeInput, setCodeInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(null);      // { text, tone }
  const [selected, setSelected] = React.useState(null);  // フレンドのプロフィールを開いているとき { otherId, ... }
  const [summary, setSummary] = React.useState({ status: 'idle', entry: null });
  const [confirm, setConfirm] = React.useState(null);    // { kind: 'remove'|'block', otherId }
  // 申請の相手。ランキングから来たときは breederId が入っている。招待リンクから来たときは code だけなので、読み込みのあとで引き当てる
  const [targetAsk, setTargetAsk] = React.useState(target && target.breederId ? target : null);
  const [notes, setNotes] = React.useState({});             // フレンドごとのメモ(自分だけ・端末だけに覚える。12文字まで)
  const [noteEdit, setNoteEdit] = React.useState(null);     // { id, text }(メモを書き換え中)
  const [recent, setRecent] = React.useState([]);           // 最近いっしょに遊んだ人(みんなで対戦で同じ部屋にいた人。端末だけに覚える)
  const [myBest, setMyBest] = React.useState(null);         // 自分のモンヒロビートの記録(スコア勝負で比べるため。読むだけ)
  const [favorites, setFavorites] = React.useState([]);   // お気に入りのフレンド(端末だけに覚える。サーバーには送らない)
  const [query, setQuery] = React.useState('');
  const [profileTab, setProfileTab] = React.useState('overview');   // フレンドのプロフィールの中のタブ(概要 / バトル / 曲 / 集めたもの)
  const aliveRef = React.useRef(true);
  React.useEffect(() => () => { aliveRef.current = false; }, []);
  React.useEffect(() => {
    let cancelled = false;
    Promise.resolve(storeGet(FRIEND_FAVORITES_KEY, [], false)).then((saved) => {
      if (!cancelled && aliveRef.current) setFavorites(friendsNormalizeFavorites(saved));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const savedNotes = friendsNormalizeNotes(await storeGet(FRIEND_NOTES_KEY, {}, false));
        const savedRecent = friendsNormalizeRecent(await storeGet(FRIEND_RECENT_KEY, [], false));
        const best = normalizeRhythmBestRecords(await storeGet(RHYTHM_BEST_RECORDS_KEY, {}, false));
        if (cancelled || !aliveRef.current) return;
        setNotes(savedNotes); setRecent(savedRecent); setMyBest(best);
        // 最近遊んだ人の最新の名前・アイコンも読んでおく(読めなければ、覚えていた名前のまま出す)
        const found = await sbFetchFriendProfiles(savedRecent.map((e) => e.id));
        if (!cancelled && aliveRef.current) setProfiles((prev) => ({ ...found, ...prev }));
      } catch (error) { /* 読めなくても、一覧そのものは出す */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const saveNote = (id, text) => {
    const clean = friendsCleanNote(text);
    const next = { ...notes };
    if (clean) next[id] = clean; else delete next[id];
    setNotes(next);
    setNoteEdit(null);
    Promise.resolve(storeSet(FRIEND_NOTES_KEY, friendsNormalizeNotes(next), false)).catch(() => {});
  };
  // 招待リンクから来たとき(?friend=コード): コードの持ち主を引き当てて、申請の確認を出す
  React.useEffect(() => {
    if (!target || !target.code || target.breederId || phase !== 'ready' || !selfId) return undefined;
    let cancelled = false;
    (async () => {
      let id = null;
      try { id = await sbFindBreederIdByCode(target.code); } catch (error) { if (!cancelled) say(error && error.notReady ? 'notready' : 'error'); }
      if (cancelled || !aliveRef.current) return;
      if (typeof onTargetHandled === 'function') onTargetHandled();
      if (!id) { say('notfound'); setTab('add'); return; }
      if (id === selfId) { say('self'); setTab('add'); return; }
      const look = await sbFetchFriendProfiles([id]);
      if (!cancelled && aliveRef.current) setTargetAsk({ breederId: id, userName: (look[id] || {}).userName || '名無しのブリーダー' });
    })();
    return () => { cancelled = true; };
  }, [phase, selfId]);
  const toggleFavorite = (id) => {
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : friendsNormalizeFavorites([id, ...favorites]);
    setFavorites(next);
    Promise.resolve(storeSet(FRIEND_FAVORITES_KEY, next, false)).catch(() => {});
  };

  const say = (key) => {
    const pair = FRIENDS_RESULT_TEXT[key] || FRIENDS_RESULT_TEXT.error;
    setNotice({ text: pair[0], tone: pair[1] });
  };
  // 一覧と相手の見た目を読み直す。送った・返した直後にも呼ぶ
  const reload = React.useCallback(async (idOverride) => {
    const id = idOverride || selfId;
    if (!id) return;
    try {
      const rows = await sbFetchFriendLinks(id);
      const next = friendsGroup(id, rows);
      const ids = [...next.friends, ...next.incoming, ...next.outgoing, ...next.blocked].map((view) => view.otherId);
      const [found, foundSummaries] = await Promise.all([
        sbFetchFriendProfiles(ids),
        sbFetchFriendSummaries(next.friends.map((view) => view.otherId)),
      ]);
      if (!aliveRef.current) return;
      setGroups(next);
      setProfiles((prev) => ({ ...prev, ...found }));
      setSummaries((prev) => ({ ...prev, ...foundSummaries }));
      if (typeof onIncomingCount === 'function') onIncomingCount(next.incoming.length);
      setPhase('ready');
    } catch (error) {
      if (!aliveRef.current) return;
      if (error && error.notReady) setPhase('notready');
      else { console.error('[friends]', error && error.message ? error.message : error); setPhase('error'); }
    }
  }, [selfId]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await ensureBreederId();
      if (cancelled || !aliveRef.current) return;
      if (!id) { setPhase('noid'); return; }
      setSelfId(id);
      try {
        const code = await sbEnsureFriendCode(id);
        if (!cancelled && aliveRef.current && code) setMyCode(code);
      } catch (error) {
        if (error && error.notReady) { if (!cancelled && aliveRef.current) setPhase('notready'); return; }
        console.error('[friends]', error && error.message ? error.message : error);
      }
      if (!cancelled) await reload(id);
    })();
    return () => { cancelled = true; };
  }, []);

  const lookOf = (id) => profiles[id] || { userName: '名無しのブリーダー', icon: null, profileFrame: PROFILE_FRAME_NONE_ID, lastSeenAt: 0 };
  const avatar = (id, sizeClass, emojiClass = 'text-base') => {
    const look = lookOf(id);
    const url = resolveIconUrl ? resolveIconUrl(look.icon) : null;
    return url
      ? <ProfileAvatar src={url} id={look.icon} frameId={look.profileFrame} className={`${sizeClass} shrink-0`}/>
      : <ProfileAvatar frameId={look.profileFrame} className={`${sizeClass} shrink-0`}
          fallback={<span className={`flex h-full w-full items-center justify-center rounded-full bg-slate-800 ${emojiClass}`}>👤</span>}/>;
  };
  const run = async (task, { thenReload = true } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await task();
      if (!aliveRef.current) return;
      say(result);
      if (thenReload) await reload();
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  };
  const sendByCode = () => run(async () => {
    const code = friendsNormalizeCode(codeInput);
    if (!code) return 'notfound';
    if (code === myCode) return 'self';
    let found = null;
    try { found = await sbFindBreederIdByCode(code); } catch (error) {
      return error && error.notReady ? 'notready' : 'error';
    }
    if (!found) return 'notfound';
    const result = await sbSendFriendRequest(selfId, found);
    if (result === 'sent' || result === 'accepted') setCodeInput('');
    return result;
  });
  const sendToTarget = () => run(async () => {
    const id = targetAsk && targetAsk.breederId;
    setTargetAsk(null);
    if (typeof onTargetHandled === 'function') onTargetHandled();
    return sbSendFriendRequest(selfId, id);
  });
  const respond = (otherId, action) => run(() => sbRespondFriendRequest(selfId, otherId, action));
  const cancelRequest = (otherId) => run(() => sbCancelFriendRequest(selfId, otherId));
  const unblock = (otherId) => run(() => sbUnblockFriendUser(selfId, otherId));
  const doConfirmed = () => {
    const ask = confirm;
    setConfirm(null);
    if (!ask) return;
    setSelected(null);
    run(() => (ask.kind === 'remove' ? sbRemoveFriend(selfId, ask.otherId) : sbBlockFriendUser(selfId, ask.otherId)));
  };
  const openProfile = async (view) => {
    setSelected(view);
    setProfileTab('overview');
    setSummary({ status: 'loading', entry: null });
    const entry = await sbFetchFriendRhythmSummary(view.otherId);
    if (aliveRef.current) setSummary({ status: 'done', entry });
  };
  // 招待リンク(開くだけでフレンド申請の確認が出る)。共有の窓が使えない端末では、リンクをコピーする
  const inviteLink = () => friendsInviteLink(typeof window !== 'undefined' ? window.location.href : '', myCode);
  const shareLink = async () => {
    const url = inviteLink();
    if (!url) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title: 'モンスターヒーロー', text: 'フレンドになろう！ このリンクを開くと申請できるよ', url }); return; }
      await navigator.clipboard.writeText(url);
      setNotice({ text: '招待リンクをコピーしました。LINEなどに貼って送ってください', tone: 'ok' });
    } catch (error) {
      if (error && error.name === 'AbortError') return;   // 共有をやめたときは何も言わない
      setNotice({ text: 'リンクを共有できませんでした。コードを伝えてください', tone: 'warn' });
    }
  };
  const requestRecent = (id) => run(() => sbSendFriendRequest(selfId, id));
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setNotice({ text: 'フレンドコードをコピーしました', tone: 'ok' });
    } catch (error) {
      setNotice({ text: 'コピーできませんでした。コードを見ながら伝えてください', tone: 'warn' });
    }
  };

  const now = Date.now();
  const tabs = [
    { id: 'friends', label: `フレンド ${groups.friends.length}/${FRIENDS_MAX}` },
    { id: 'requests', label: '申請', badge: groups.incoming.length },
    { id: 'add', label: '追加' },
  ];
  const btn = 'min-h-[44px] rounded-xl border text-[11px] font-black active:scale-95 disabled:opacity-40';
  const noticeBox = notice && (
    <div role="status" className={`mb-2 shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold leading-relaxed ${FRIENDS_TONE_CLASS[notice.tone] || FRIENDS_TONE_CLASS.info}`}>{notice.text}</div>
  );

  // ---- 状態が整っていないとき ----
  if (phase !== 'ready') {
    const lines = phase === 'loading' ? ['フレンドを読み込んでいます…']
      : phase === 'notready' ? ['フレンド機能はただいま準備中です', 'しばらくしてからもう一度ひらいてください']
      : phase === 'noid' ? ['この端末ではフレンドを使えません', 'セーブデータを保存できる状態でひらいてください']
      : ['フレンドを読み込めませんでした', '通信を確かめて、もう一度ひらいてください'];
    return (
      <div data-mh-screen data-friends-phase={phase} className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="フレンド" accent="text-pink-300" onBack={onBack} backLabel="プロフィールへ戻る"/>
        <ScreenEmpty emoji={phase === 'loading' ? '⏳' : '🤝'} lines={lines}
          action={phase === 'error' ? <button type="button" onClick={() => { setPhase('loading'); reload(); }} className={`${btn} w-full border-white/20 bg-slate-800 text-slate-200`}>もう一度読み込む</button> : null}/>
      </div>
    );
  }

  // ---- フレンドのプロフィール ----
  if (selected) {
    const look = lookOf(selected.otherId);
    const entry = summary.entry;
    return (
      <div data-mh-screen data-friends-profile className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="フレンドのプロフィール" accent="text-pink-300" onBack={() => setSelected(null)} backLabel="フレンド一覧へ戻る"/>
        <div className={`${SCREEN_LIST_CLASS} pb-4`}>
          {noticeBox}
          {(() => {
            const sum = summaries[selected.otherId] || null;
            const seen = friendsPresenceText(sum ? sum.place : null, Math.max(sum ? sum.updatedAt : 0, look.lastSeenAt || 0), now);
            const monName = (id) => (id && ALL_PLAYER_MONSTERS[id] ? ALL_PLAYER_MONSTERS[id].name : '');
            const fav = sum && sum.favorite ? sum.favorite : null;
            const favBase = fav ? ALL_PLAYER_MONSTERS[fav.monsterId] : null;
            const favFace = favBase ? friendsFaceIconOf(fav.monsterId) : null;
            const stat = (label, value, sub, color) => (
              <div className="min-w-0"><dt className="text-[9px] font-bold text-slate-400">{label}</dt>
                <dd className={`truncate text-sm font-black ${color}`}>{value}</dd>
                {sub ? <dd className="truncate text-[9px] font-bold text-slate-500">{sub}</dd> : null}</div>);
            return (<>
              <div className={`${SCREEN_PANEL_CLASS} flex flex-col items-center gap-2 py-5 text-center`}>
                {avatar(selected.otherId, 'h-20 w-20', 'text-4xl')}
                <b className="max-w-full truncate text-lg font-black text-white">{look.userName}</b>
                <span data-friend-presence={seen.online ? 'online' : 'offline'} className={`text-[11px] font-black ${seen.online ? 'text-emerald-300' : 'text-slate-400'}`}>{seen.online ? '● ' : ''}{seen.text}</span>
                {sum && sum.message ? <p data-friend-message className="max-w-full break-words rounded-xl bg-black/30 px-3 py-1.5 text-[12px] font-bold leading-snug text-pink-100">「{sum.message}」</p> : null}
                {noteEdit && noteEdit.id === selected.otherId ? (
                  <div data-friend-note-form className="flex w-full max-w-[280px] gap-1">
                    <input type="text" data-friend-note-input value={noteEdit.text} maxLength={FRIEND_NOTE_MAX} autoComplete="off" spellCheck={false} aria-label="フレンドのメモ"
                      onChange={(event) => setNoteEdit({ id: noteEdit.id, text: event.target.value })} placeholder="あだ名・メモ"
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 text-center text-[13px] font-bold text-white placeholder:text-slate-600"/>
                    <button type="button" data-friend-note-save onClick={() => saveNote(noteEdit.id, noteEdit.text)} className={`${btn} shrink-0 px-3 border-emerald-400/60 bg-emerald-500/20 text-emerald-100`}>保存</button>
                    <button type="button" aria-label="メモをやめる" onClick={() => setNoteEdit(null)} className={`${btn} shrink-0 px-3 border-white/20 bg-slate-800 text-slate-200`}>×</button>
                  </div>
                ) : (
                  <button type="button" data-friend-note-edit onClick={() => setNoteEdit({ id: selected.otherId, text: notes[selected.otherId] || '' })}
                    className="max-w-full truncate rounded-full border border-amber-400/40 bg-amber-950/30 px-3 py-1 text-[11px] font-black text-amber-200 active:scale-95">📝 {notes[selected.otherId] || 'メモを書く（自分だけに見えます）'}</button>
                )}
              </div>
              <ScreenTabs className="mt-3" value={profileTab} onChange={setProfileTab} items={[
                { id: 'overview', label: '概要' }, { id: 'battle', label: 'バトル' }, { id: 'songs', label: '曲のベスト' }, { id: 'collection', label: '集めたもの' }]}/>
              {profileTab === 'overview' && (<>
              <div className="mt-1"><ScreenSectionLabel>遊んだ記録</ScreenSectionLabel></div>
              <div className={`${SCREEN_PANEL_FLAT_CLASS} mt-1`}>
                {!sum && <p className="text-[11px] font-bold text-slate-400">この人はまだ記録を公開していません（ゲームを開き直すと出ます）</p>}
                {sum && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    {stat('プレイ時間', sum.playSeconds != null ? friendsPlaytimeText(sum.playSeconds) : '—', null, 'text-sky-200')}
                    {stat('遊びはじめ', friendsDayText(sum.startedOn) || '—', sum.startedOn ? 'プレイ時間の記録が始まった日' : null, 'text-sky-200')}
                    {stat('最高絆Lv', sum.bestBond != null ? `Lv.${sum.bestBond}` : '—', monName(sum.bestBondMon), 'text-pink-200')}
                    {stat('最高総合力', sum.bestPower != null ? Number(sum.bestPower).toLocaleString() : '—', monName(sum.bestPowerMon), 'text-amber-200')}
                  </dl>
                )}
              </div>
              <div className="mt-3"><ScreenSectionLabel>モンヒロビートの記録</ScreenSectionLabel></div>
              <div className={`${SCREEN_PANEL_FLAT_CLASS} mt-1`}>
                {summary.status === 'loading' && <p className="text-[11px] font-bold text-slate-400">読み込んでいます…</p>}
                {summary.status === 'done' && !entry && <p className="text-[11px] font-bold text-slate-400">まだ記録がありません</p>}
                {entry && (
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div><dt className="text-[9px] font-bold text-slate-400">ブリーダーLv.</dt><dd className="text-sm font-black text-indigo-200">{entry.level > 0 ? entry.level : '—'}</dd></div>
                    <div><dt className="text-[9px] font-bold text-slate-400">合計スコア</dt><dd className="text-sm font-black text-amber-200">{Number(entry.totalScore).toLocaleString()}</dd></div>
                    <div><dt className="text-[9px] font-bold text-slate-400">遊んだ曲数</dt><dd className="text-sm font-black text-pink-200">{entry.songCount}曲</dd></div>
                  </dl>
                )}
              </div>
              <div className="mt-3"><ScreenSectionLabel>好きなモンスター</ScreenSectionLabel></div>
              <div data-friend-favorite className={`${SCREEN_PANEL_FLAT_CLASS} mt-1 flex items-center gap-3`}>
                {!favBase && <p className="text-[11px] font-bold text-slate-400">まだ選んでいません</p>}
                {favBase && (<>
                  {favFace ? <ProfileAvatar src={favFace.src} id={favFace.id} className="h-14 w-14 shrink-0"/> : <span className="flex h-14 w-14 shrink-0 items-center justify-center text-3xl">❓</span>}
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-black text-white">{fav.name || favBase.name}</b>
                    <small className="block text-[10px] font-bold text-pink-300">絆Lv.{Number(fav.bondLevel) || '—'}{fav.power ? `　総合力 ${Number(fav.power).toLocaleString()}` : ''}</small>
                  </div>
                  {fav.detail && typeof onOpenMonsterDetail === 'function' && (
                    <button type="button" data-friend-favorite-detail onClick={() => onOpenMonsterDetail({ baseId: fav.monsterId, monsterId: fav.monsterId, name: fav.name || favBase.name, bondLevel: Number(fav.bondLevel) || 0, detail: fav.detail, colors: Array.isArray(fav.colors) ? fav.colors : [] })}
                      className={`${btn} shrink-0 px-3 border-indigo-400/60 bg-indigo-500/20 text-indigo-100`}>詳細 ›</button>
                  )}
                </>)}
              </div>
              </>)}
              {profileTab !== 'overview' && !(sum && sum.records) && (
                <div className={`${SCREEN_PANEL_FLAT_CLASS} mt-2`} data-friend-records-missing>
                  <p className="text-[11px] font-bold leading-relaxed text-slate-400">この人の記録のまとめは、まだ見られません。相手がゲームを開き直すと出ます。</p>
                </div>
              )}
              {profileTab === 'battle' && sum && sum.records && (() => {
                const labels = friendsBattleModeLabels();
                const rows = sum.records.battle.filter((e) => labels[e.id]);
                return (
                  <div data-friend-battle className="mt-2 flex flex-col gap-2">
                    {rows.length === 0 && <p className="px-1 py-4 text-center text-[11px] font-bold text-slate-500">まだバトルの記録がありません</p>}
                    {rows.map((e) => (
                      <div key={e.id} className={`${SCREEN_PANEL_FLAT_CLASS} flex items-center gap-2`}>
                        <span className="text-xl" aria-hidden="true">{labels[e.id].emoji}</span>
                        <b className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{labels[e.id].label}</b>
                        <strong className="shrink-0 text-[13px] font-black text-amber-200">{e.k === 'w' ? `WAVE ${e.v.toLocaleString()}` : `${e.v.toLocaleString()} pt`}</strong>
                      </div>))}
                    <p className="px-1 text-[10px] font-bold text-slate-500">モードごとの、いちばん良い記録です。</p>
                  </div>);
              })()}
              {profileTab === 'songs' && sum && sum.records && (() => {
                const flagText = ['', 'フルコンボ', 'オールエクセレント', 'オールマーベラス'];
                const cmp = friendsCompareScores(sum.records.rhythm.songs, myBest);
                const songs = cmp.map((e) => ({ e, song: RHYTHM_SONGS.find((x) => x.songId === e.s) })).filter((x) => x.song);
                const wins = songs.filter((x) => x.e.result === 'win').length;
                const loses = songs.filter((x) => x.e.result === 'lose').length;
                const draws = songs.filter((x) => x.e.result === 'draw').length;
                const resultStyle = { win: 'bg-emerald-500/25 text-emerald-200', lose: 'bg-rose-500/25 text-rose-200', draw: 'bg-sky-500/25 text-sky-200', none: 'bg-slate-700/60 text-slate-300' };
                return (
                  <div data-friend-songs className="mt-2 flex flex-col gap-2">
                    <p className="px-1 text-[10px] font-black text-slate-400">遊んだ曲 {sum.records.rhythm.played}曲（スコアの高い順に{FRIEND_RECORD_SONG_MAX}曲まで）</p>
                    {songs.length > 0 && (
                      <div data-friend-versus className={`${SCREEN_PANEL_FLAT_CLASS} text-center`}>
                        <small className="block text-[9px] font-bold text-slate-400">スコア勝負（同じ曲・同じ難易度で、自分と比べます）</small>
                        <b className="text-[14px] font-black text-white"><span className="text-emerald-300">{wins}勝</span>　<span className="text-rose-300">{loses}敗</span>{draws > 0 ? <span className="text-sky-300">　{draws}分</span> : null}</b>
                      </div>
                    )}
                    {songs.length === 0 && <p className="px-1 py-4 text-center text-[11px] font-bold text-slate-500">まだ曲の記録がありません</p>}
                    {songs.map(({ e, song }) => (
                      <div key={e.s} className={`${SCREEN_PANEL_FLAT_CLASS} flex items-center gap-2`}>
                        <div className="min-w-0 flex-1">
                          <b className="block truncate text-[12px] font-black text-white">{rhythmSongFullName(song)}</b>
                          <small className="block text-[9px] font-bold text-slate-400">{e.d}{e.f > 0 ? `　★${flagText[e.f]}` : ''}</small>
                        </div>
                        <div className="shrink-0 text-right">
                          <strong className="block text-[13px] font-black tabular-nums text-pink-200">{e.sc.toLocaleString()}</strong>
                          <small data-friend-versus-row={e.result} className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-black ${resultStyle[e.result]}`}>
                            {e.result === 'none' ? 'まだ遊んでいません' : e.result === 'win' ? `自分 ${e.mine.toLocaleString()}　勝ち +${e.diff.toLocaleString()}` : e.result === 'lose' ? `自分 ${e.mine.toLocaleString()}　あと${(-e.diff).toLocaleString()}点` : `自分 ${e.mine.toLocaleString()}　同点`}
                          </small>
                        </div>
                      </div>))}
                    <p className="px-1 text-[10px] font-bold text-slate-500">曲ごとに、相手が遊んだいちばん上の難易度の記録です。自分の同じ難易度の記録と比べています。</p>
                  </div>);
              })()}
              {profileTab === 'collection' && sum && sum.records && (() => {
                const c = sum.records.collection;
                const cell = (label, value, color) => (
                  <div className={`${SCREEN_PANEL_FLAT_CLASS} text-center`}><dt className="text-[9px] font-bold text-slate-400">{label}</dt><dd className={`text-base font-black ${color}`}>{value}</dd></div>);
                return (
                  <dl data-friend-collection className="mt-2 grid grid-cols-2 gap-2">
                    {cell('マスモン', `${c.masu}体`, 'text-pink-200')}
                    {cell('図鑑', c.dexTotal > 0 ? `${c.dex} / ${c.dexTotal}` : `${c.dex}`, 'text-sky-200')}
                    {cell('超越した子', `${c.transcended}体`, 'text-amber-200')}
                    {cell('転生した子', `${c.reincarnated}体`, 'text-emerald-200')}
                    {cell('アイコン', `${c.icons}個`, 'text-indigo-200')}
                    {cell('フレーム', `${c.frames}個`, 'text-indigo-200')}
                  </dl>);
              })()}
            </>);
          })()}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'remove', otherId: selected.otherId })} className={`${btn} border-white/20 bg-slate-800 text-slate-200`}>フレンドを解除</button>
            <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'block', otherId: selected.otherId })} className={`${btn} border-rose-400/50 bg-rose-950/40 text-rose-200`}>ブロックする</button>
          </div>
        </div>
        {confirm && (
          <ConfirmSheet
            title={confirm.kind === 'remove' ? `${look.userName}さんとのフレンドを解除しますか?` : `${look.userName}さんをブロックしますか?`}
            message={confirm.kind === 'remove' ? '解除しても、あとからもう一度申請できます。' : 'ブロックすると、フレンドが解除され、相手からの申請も届かなくなります。申請の画面からいつでも解除できます。'}
            confirmLabel={confirm.kind === 'remove' ? '解除する' : 'ブロックする'} danger
            onConfirm={doConfirmed} onCancel={() => setConfirm(null)}/>
        )}
      </div>
    );
  }

  // ---- 一覧(3つのタブ) ----
  // フレンドの一覧(お気に入り → ログイン中 → 最近開いた順。名前で絞り込める)
  const arranged = friendsArrangeList({ views: groups.friends, looks: profiles, summaries, favorites, query, nowMs: now, notes });
  const onlineCount = arranged.filter((row) => row.online).length;
  const person = (view, right, extra = null) => {
    const look = lookOf(view.otherId);
    return (
      <div key={view.otherId} {...(extra || {})} className={`${SCREEN_PANEL_FLAT_CLASS} flex items-center gap-2 ${extra ? 'cursor-pointer active:scale-[.99]' : ''}`}>
        {avatar(view.otherId, 'h-10 w-10')}
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[12px] font-black text-white">{look.userName}</b>
          {notes[view.otherId] ? <small data-friend-note-label className="block truncate text-[9px] font-bold text-amber-200">📝 {notes[view.otherId]}</small> : null}
          {(() => {
            const sum = summaries[view.otherId];
            const seen = friendsPresenceText(sum ? sum.place : null, Math.max(sum ? sum.updatedAt : 0, look.lastSeenAt || 0), now);
            return <span data-friend-presence={seen.online ? 'online' : 'offline'} className={`block truncate text-[9px] font-bold ${seen.online ? 'text-emerald-300' : 'text-slate-400'}`}>{seen.online ? '● ' : ''}{seen.text}</span>;
          })()}
        </div>
        {right}
      </div>
    );
  };
  return (
    <div data-mh-screen data-friends-phase="ready" className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="フレンド" accent="text-pink-300" onBack={onBack} backLabel="プロフィールへ戻る"/>
      <div className="mb-2 shrink-0"><AssistantBubble scene="friends" compact/></div>
      <ScreenTabs items={tabs} value={tab} onChange={(id) => { setTab(id); setNotice(null); }}/>
      <div className={`${SCREEN_LIST_CLASS} pb-4`}>
        {noticeBox}
        {tab === 'friends' && (groups.friends.length === 0
          ? <ScreenEmpty emoji="🤝" lines={['まだフレンドがいません', '「追加」から、フレンドコードで申請してみましょう']}
              action={<button type="button" onClick={() => setTab('add')} className={`${btn} w-full border-pink-400/60 bg-pink-500/20 text-pink-100`}>フレンドを追加する</button>}/>
          : <div className="flex flex-col gap-2">
              {groups.friends.length >= 6 && (
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value.slice(0, 20))} data-friend-search
                  placeholder="名前でさがす" aria-label="フレンドを名前でさがす" autoComplete="off" spellCheck={false}
                  className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[13px] font-bold text-white placeholder:text-slate-500"/>
              )}
              <p data-friend-online-count className="px-1 text-[10px] font-black text-slate-400">
                {onlineCount > 0 ? <span className="text-emerald-300">● ログイン中 {onlineCount}人</span> : 'ログイン中の人はいません'}
                <span className="ml-2 text-slate-500">／ ★でお気に入り(上に並びます)</span>
              </p>
              {arranged.length === 0 && <p className="px-1 py-6 text-center text-[11px] font-bold text-slate-500">「{query}」に当てはまるフレンドはいません</p>}
              {arranged.map((row) => person(row.view, (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" data-friend-star={row.favorite ? 'on' : 'off'} aria-pressed={row.favorite} aria-label={row.favorite ? 'お気に入りをやめる' : 'お気に入りにする'}
                    onClick={(event) => { event.stopPropagation(); toggleFavorite(row.view.otherId); }}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border text-lg active:scale-90 ${row.favorite ? 'border-amber-400/70 bg-amber-500/20 text-amber-300' : 'border-white/15 bg-black/30 text-slate-500'}`}>{row.favorite ? '★' : '☆'}</button>
                  <span aria-hidden="true" className="text-slate-500">›</span>
                </div>),
                { role: 'button', tabIndex: 0, 'data-friend-row': row.view.otherId, onClick: () => openProfile(row.view),
                  onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfile(row.view); } } }))}
            </div>)}
        {tab === 'requests' && (
          <div className="flex flex-col gap-3">
            <div>
              <ScreenSectionLabel>届いている申請</ScreenSectionLabel>
              {groups.incoming.length === 0
                ? <p className="px-1 py-2 text-[11px] font-bold text-slate-500">届いている申請はありません</p>
                : <div className="mt-1 flex flex-col gap-2">{groups.incoming.map((view) => person(view,
                    <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={busy} onClick={() => respond(view.otherId, 'accept')} className={`${btn} px-3 border-emerald-400/60 bg-emerald-500/20 text-emerald-100`}>承認</button>
                      <button type="button" disabled={busy} onClick={() => respond(view.otherId, 'decline')} className={`${btn} px-3 border-white/20 bg-slate-800 text-slate-200`}>断る</button>
                      <button type="button" disabled={busy} onClick={() => respond(view.otherId, 'block')} className={`${btn} px-2 border-rose-400/50 bg-rose-950/40 text-rose-200`}>ブロック</button>
                    </div>))}</div>}
            </div>
            <div>
              <ScreenSectionLabel>送った申請</ScreenSectionLabel>
              {groups.outgoing.length === 0
                ? <p className="px-1 py-2 text-[11px] font-bold text-slate-500">返事を待っている申請はありません</p>
                : <div className="mt-1 flex flex-col gap-2">{groups.outgoing.map((view) => person(view,
                    <button type="button" disabled={busy} onClick={() => cancelRequest(view.otherId)} className={`${btn} shrink-0 px-3 border-white/20 bg-slate-800 text-slate-200`}>取り消す</button>))}</div>}
            </div>
            {groups.blocked.length > 0 && (
              <div>
                <ScreenSectionLabel>ブロック中</ScreenSectionLabel>
                <div className="mt-1 flex flex-col gap-2">{groups.blocked.map((view) => person(view,
                  <button type="button" disabled={busy} onClick={() => unblock(view.otherId)} className={`${btn} shrink-0 px-3 border-white/20 bg-slate-800 text-slate-200`}>解除する</button>))}</div>
              </div>
            )}
          </div>
        )}
        {tab === 'add' && (
          <div className="flex flex-col gap-3">
            <div className={SCREEN_PANEL_CLASS}>
              <ScreenSectionLabel>あなたのフレンドコード</ScreenSectionLabel>
              <p data-friend-code className="my-2 text-center text-3xl font-black tracking-widest text-pink-200">{myCode ? friendsFormatCode(myCode) : '— — — —'}</p>
              <button type="button" disabled={!myCode} onClick={copyCode} className={`${btn} w-full border-pink-400/60 bg-pink-500/20 text-pink-100`}>コードをコピー</button>
              <button type="button" data-friend-share-link disabled={!myCode} onClick={shareLink} className={`${btn} mt-2 w-full border-sky-400/60 bg-sky-500/20 text-sky-100`}>招待リンクを送る（LINEなど）</button>
              <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">このコードを友だちに伝えると、友だちから申請してもらえます。コードは変わりません。</p>
            </div>
            <div className={SCREEN_PANEL_CLASS}>
              <ScreenSectionLabel>コードで申請する</ScreenSectionLabel>
              <input type="text" value={codeInput} onChange={(event) => setCodeInput(event.target.value.slice(0, 16))}
                inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                placeholder="友だちのフレンドコード" aria-label="友だちのフレンドコード"
                className="mt-2 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/40 px-3 text-center text-base font-black tracking-widest text-white placeholder:text-slate-600"/>
              <button type="button" disabled={busy || !friendsNormalizeCode(codeInput)} onClick={sendByCode} className={`${btn} mt-2 w-full border-emerald-400/60 bg-emerald-500/20 text-emerald-100`}>フレンド申請を送る</button>
              <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">ランキングの名前をタップしても、その人に申請できます。</p>
            </div>
            {(() => {
              const related = new Set([...groups.friends, ...groups.incoming, ...groups.outgoing, ...groups.blocked].map((view) => view.otherId));
              const candidates = recent.filter((e) => e.id !== selfId && !related.has(e.id)).slice(0, 10);
              if (candidates.length === 0) return null;
              return (
                <div data-friend-recent className={SCREEN_PANEL_CLASS}>
                  <ScreenSectionLabel>最近いっしょに遊んだ人</ScreenSectionLabel>
                  <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">みんなで対戦で同じ部屋にいた人です。気が合ったら、申請してみましょう。</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {candidates.map((e) => {
                      const look = profiles[e.id];
                      return (
                        <div key={e.id} data-friend-recent-row={e.id} className={`${SCREEN_PANEL_FLAT_CLASS} flex items-center gap-2`}>
                          {avatar(e.id, 'h-9 w-9')}
                          <b className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{(look && look.userName) || e.name}</b>
                          <button type="button" disabled={busy} onClick={() => requestRecent(e.id)} className={`${btn} shrink-0 px-3 border-emerald-400/60 bg-emerald-500/20 text-emerald-100`}>申請</button>
                        </div>);
                    })}
                  </div>
                </div>);
            })()}
          </div>
        )}
      </div>
      {targetAsk && (
        <ConfirmSheet title={`${targetAsk.userName || '名無しのブリーダー'}さんにフレンド申請しますか?`}
          message="相手が承認すると、フレンドになります。" confirmLabel="申請する"
          onConfirm={sendToTarget} onCancel={() => { setTargetAsk(null); if (typeof onTargetHandled === 'function') onTargetHandled(); }}/>
      )}
    </div>
  );
}
