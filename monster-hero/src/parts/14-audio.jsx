const Audio_ = (() => {
  let Tone = null, ready = false, loading = null, started = false;
  let reverb = null, seBus = null;
  let audioCtx = null, bgmGain = null, masterOut = null, analyser = null, analyserData = null;
  // 動画(お知らせの予告動画など)を再生しているあいだ、ゲームの音を出口(masterOut)で絞る(2026-11-02 社長「BGMを止めて公開」)。
  // 曲は止めずに音量だけ0にするので、再生を終える・一時停止する・枠を閉じると、いま鳴っている曲がそのまま戻る
  let videoHold = false;
  // AudioContextが「動いているつもりで止まっていないか」を見るための控え。
  // Androidでは state が running のままでも音が出なくなることがあり、state だけでは気づけない
  let ctxTimeMark = null, ctxRebuildCount = 0, toneLoadFailed = false;
  const buffers = new Map();
  const loadingBuffers = new Map();
  // 解いた音の大きさの数え(読み込み直しの記録に残す。メモリ不足の原因を探る手がかり)。
  //   decodedBytes … 起動してから解いた音の合計(手放して読み直した分も足していく) / decodedCount … 解いた回数
  let decodedBytes = 0, decodedCount = 0;
  const bufferBytes = (buffer) => { try { return Math.max(0, Math.floor(buffer.length * buffer.numberOfChannels * 4)); } catch (e) { return 0; } };
  // ★曲えらびの試聴と演奏で読んだ曲の音は、直近の数曲ぶんだけ持っておく(2026-09-27 の点検で見つけた)。
  //   解いた音は1曲で数十〜百MBあり、以前は一度読んだら二度と捨てなかったので、試聴しながら
  //   何曲も眺めるだけで数百MBに増え、iPhone ではメモリ不足で落ちる・発熱の原因になり得た。
  //   捨てても、次に読むときは通信のキャッシュが効くので、解き直すだけで済む。
  // ★場面のBGM(タイトル・ホーム・バトルなど)も同じ数え方に入れた(2026-10-10)。
  //   以前は「場面のBGMは持ち続ける」としていたが、バトルはWAVEや敵ごとに曲が変わり、長く周回するほど
  //   読んだ曲が増え続けた(クイックを2ウェーブ回すだけで3本→6本。1本は解くと約60MB)。
  //   iPhone の Safari がメモリ不足でタブを読み込み直し、「やっている最中に最初の画面へ戻る」ことがあった。
  //   いま鳴らしている曲・いまの場面の曲・演奏中の曲は捨てない(bufferInUse)。
  //   上限は、いまの場面+次の場面+少し前の2本ぶんで 4
  const SONG_BUFFER_KEEP = 4;
  const songBufferOrder = [];
  // ★場面のBGMを軽く持つ(2026-10-16 社長の決定「案1＋案2」・デバッグ設定の入/切で試す。既定は切)。
  //   きっかけ: 「クイックでオート無限を1時間ほどやっていたら、ホームに戻っていた」(iPhone のメモリ不足の読み込み直し)。
  //   ・案1 場面のBGMだけ、解いたあと 24kHz に落として元を捨てる(1本あたり約半分)
  //   ・案2 場面のBGMは「いま鳴っている1本＋直前(または次)の1本」だけ持つ
  //   鳴らし方(AudioBuffer を Web Audio で鳴らす)は変えない(#2991 の <audio> は iPhone で無音になったため使わない)。
  //   モンヒロビートの曲(演奏・試聴)と効果音は対象外。軽くした音は鍵に '#light' を付けて別に持つので、
  //   同じファイルを演奏で読むときは、ふつうの音として別に解く(演奏が軽い音を使うことはない)
  const BGM_LIGHT_KEY = 'mh_bgm_light_v1';
  const BGM_LIGHT_RATE = 24000, BGM_LIGHT_KEEP = 2, BGM_LIGHT_SUFFIX = '#light';
  const bgmLightOn = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(BGM_LIGHT_KEY) === 'on'; } catch (e) { return false; } };
  const sceneBufferKey = (src) => (bgmLightOn() ? src + BGM_LIGHT_SUFFIX : src);
  const lightOrder = [];
  // 解いた音を BGM_LIGHT_RATE で描き直す(OfflineAudioContext)。できない環境・失敗はそのままの音を返す
  const lightenBuffer = (buffer) => new Promise((resolve) => {
    let settled = false;
    const finish = (b) => { if (settled) return; settled = true; resolve(b && b.length ? b : buffer); };
    try {
      const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
      if (!OAC || !buffer || buffer.sampleRate <= BGM_LIGHT_RATE) { finish(buffer); return; }
      const length = Math.max(1, Math.round(buffer.duration * BGM_LIGHT_RATE));
      const off = new OAC(buffer.numberOfChannels, length, BGM_LIGHT_RATE);
      const src = off.createBufferSource();
      src.buffer = buffer; src.connect(off.destination); src.start(0);
      off.oncomplete = (e) => finish(e && e.renderedBuffer);
      const p = off.startRendering();
      if (p && p.then) p.then(finish, () => finish(buffer));
    } catch (e) { finish(buffer); }
  });
  // previewRequest は試聴の「この呼び出しが今も最新か」を見るための番号。
  // 通常BGM(bgmRequest)と同じ役目で、読み込みを待っているあいだに止められたり
  // 押し直されたりした古い呼び出しが、あとから音を鳴らし始めるのを防ぐ
  let bgmSource = null, bgmSourceKey = null, bgmRequest = 0, previewSource = null, previewKey = null, previewRequest = 0;
  let jingleSource = null, jingleTimer = null;
  // 1回だけ流す曲(MFバトルカードの助手と対戦の曲の並び。2026-10-26)。{ key, onEnd, onFail }
  //   この曲だけ繰り返さずに流し、最後まで流れ終わったときだけ onEnd を呼ぶ(止めた・別の曲にした・裏へ回ったときは呼ばない)。
  //   読み込めなかったときは onFail。ほかの曲を鳴らしたら外れる(ほかの画面の曲には効かない)
  let bgmOnce = null;
  let currentKey = null, bgmVolumePct = 0, seVolumePct = 0, pageHidden = false;
  // ボタンのタップ音だけの口(2026-11-24 r1119-164 社長「モンビーだけタップ音ならない」→ 案B)。
  //   モンヒロビートの画面・助手ライフの裏クイック中は、裏のバトルの音を消すために seBus を0にしている。
  //   タップ音もその seBus を通っていたので一緒に消えていた。タップ音だけはこの uiBus を通し、保存してある効果音の音量に従わせる
  //   (超省エネの0は呼ぶ側 60-app.jsx が渡す)。裏のバトルの音は今までどおり seBus のまま
  let uiBus = null, uiSeVolumePct = 0;
  let backgroundSeQuiet = false; // 裏の周回の効果音を止める印(下の setBackgroundSeQuiet)
  let enabled = false;
  // 音ゲーのBGM音量は、メインのBGM音量設定(対数カーブ・bgmGain)を経由させず独立させる。
  // ただし全体ミュート(タイトルの「音がオフです」)だけは共通で効かせる。
  // 稼働中のgainノードを覚えておき、ミュート切り替え時にまとめて反映する。
  const activeRhythmGains = new Set();
  // 演奏で鳴らしている曲の音(直近の曲を捨てるときに、鳴らしている最中のものは残すため)
  const rhythmBuffersInUse = new Set();
  const applyRhythmMute = () => { activeRhythmGains.forEach(entry => { entry.node.gain.value = enabled ? entry.raw : 0; }); };

  const load = () => {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res) => {
      if (typeof window !== 'undefined' && window.Tone) { Tone = window.Tone; res(); return; }
      if (typeof document === 'undefined') { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
      // 完全性検証(KI-009)。ハッシュは 2026-11-15 に実ファイルから求め、cdnjs 公式の SRI と一致を確認した。
      // 中身が差し替わっていたら読み込み失敗(s.onerror)として扱い、音が出ないだけで進行は止めない。
      s.integrity = 'sha384-c6Uo4N9c3SOEigMVzP6IshUG1wQ5uMp3xeoQFiHWAQ86joWdgyajkvopySyKy/Z6';
      s.crossOrigin = 'anonymous';
      s.onload = () => { Tone = window.Tone; res(); };
      s.onerror = () => { toneLoadFailed = true; res(); };
      document.head.appendChild(s);
    }).then(async () => {
      if (!Tone) { toneLoadFailed = true; return; }
      try {
        // ★内部の時計の目覚めを 1秒に20回 → 4回へ減らす(2026-09-24 ユーザー指摘「発熱がすごい」)。
        //   Tone の時計は効果音を鳴らしていないあいだもずっと本体を起こし続けていた。
        //   効果音は Tone.now() から直接鳴らしていて時計の予定表(Transport)を使わないので、音の出方は変わらない
        try { const toneCtx = Tone.getContext && Tone.getContext(); if (toneCtx && 'updateInterval' in toneCtx) toneCtx.updateInterval = 0.25; } catch (e) {}
        seBus = new Tone.Gain(_gainFromPct(seVolumePct)).toDestination();
        uiBus = new Tone.Gain(_gainFromPct(uiSeVolumePct)).toDestination();
        reverb = new Tone.Reverb({ decay: 2.4, wet: 0.22 }).connect(seBus);
        try { await reverb.ready; } catch (e) {}
        ready = true;
      } catch(e){}
    });
    return loading;
  };

  const ensure = async () => { await load(); if (Tone && !started) { try { await Tone.start(); started = true; } catch (e) {} } };

  const JINGLE_FILES = { victory: 'audio/jingle-victory.mp3' };

  // --- 音源のキャッシュキー ---------------------------------------------------
  // (2026-09-10・ユーザー指摘「禁断のレジスタンスまだ音小さい / ほんとに音量調整した？」)
  // 音量をそろえて mp3 を差し替えたのに、端末では**古い音のまま**だった。
  // 下の loadBuffer が fetch(url,{cache:'force-cache'}) で読むので、
  // 一度読んだURLは**期限に関係なくキャッシュが使われる**。URLが同じままだと、
  // 中身を入れ替えても新しい音源を取りに行かない。
  //
  // 画像は data/*.js の側で ?v=<中身のハッシュ> を付けている(stamp-version.js)。
  // 音源も同じ考え方にするが、**BGM_TRACKS の src は素のパスのままにする**。
  // src の文字列はいくつもの検査が丸ごと突き合わせているので、そこへキーを混ぜない。
  // かわりに、読むときだけこの表を引いてキーを足す。
  // 表は node tools/stamp-audio-keys.js が音源の中身から作り直す(build.js が毎回呼ぶ)。
  const AUDIO_CACHE_KEYS = {
// <audio-cache-keys>
    "audio/bgm-4u-hitasura.mp3": "f4fb42472438",
    "audio/bgm-against-my-own-shadow.mp3": "b43d691d4773",
    "audio/bgm-altar-world-tree-short.mp3": "45860ac8bd1d",
    "audio/bgm-altar-world-tree.mp3": "eeeeada93d95",
    "audio/bgm-amakakeru-tsubasa.mp3": "2b283f9e6aea",
    "audio/bgm-anima.mp3": "c81adf3d2fff",
    "audio/bgm-atsu-cup-theme.mp3": "e93502c4df76",
    "audio/bgm-battle-5-short.mp3": "7fc065210067",
    "audio/bgm-battle-5.mp3": "a911ffe142ba",
    "audio/bgm-battle-ichika.mp3": "ca746d1d2ba6",
    "audio/bgm-battle.mp3": "a1e6f8499e9e",
    "audio/bgm-beyond-the-same-sky-short.mp3": "fc0c43a87755",
    "audio/bgm-beyond-the-same-sky.mp3": "4719843e73e2",
    "audio/bgm-big-bridge-no-shitou.mp3": "a36d408f3389",
    "audio/bgm-black-shout.mp3": "03a627c682de",
    "audio/bgm-boss-ichika.mp3": "9c8bda857de7",
    "audio/bgm-boss.mp3": "a11bc8056d79",
    "audio/bgm-brand-new-sky.mp3": "b93b1a67de51",
    "audio/bgm-clear-ichika.mp3": "cf8bc41a228c",
    "audio/bgm-close-to-your-heart-alt.mp3": "86bbdc8872f1",
    "audio/bgm-close-to-your-heart.mp3": "990493074a91",
    "audio/bgm-crazy-party-night-full.mp3": "88a00b2a4fa0",
    "audio/bgm-crazy-party-night.mp3": "45e7252c400e",
    "audio/bgm-crossing-field.mp3": "1e2e7cc1d3d5",
    "audio/bgm-dear-santa-short.mp3": "5cc7bd38da68",
    "audio/bgm-dear-santa.mp3": "1d5245547349",
    "audio/bgm-departure-short.mp3": "d2dcbe5c72a8",
    "audio/bgm-departure.mp3": "ad4d5a6838c8",
    "audio/bgm-desert-crown.mp3": "1a440c813bbb",
    "audio/bgm-dr-wily-stage-1-okkussenman.mp3": "1653c82ce75e",
    "audio/bgm-dr-wily-stage-1.mp3": "80f1ad0c564c",
    "audio/bgm-dullahan-clockwork-alt.mp3": "9e934451770b",
    "audio/bgm-dullahan-clockwork.mp3": "b51e196625c4",
    "audio/bgm-dullahan-steel-ghost-alt.mp3": "1e9c04ccc1db",
    "audio/bgm-dullahan-steel-ghost.mp3": "dbb0da050ab4",
    "audio/bgm-dullahan.mp3": "c66388ff6c14",
    "audio/bgm-eiki-boss-beat.mp3": "1c3e0cb8b29f",
    "audio/bgm-eiki-boss-remix.mp3": "83093750c9ec",
    "audio/bgm-eiyuu-no-akashi-milktea.mp3": "af00bdf4ef24",
    "audio/bgm-eiyuu-no-akashi.mp3": "38f68104d031",
    "audio/bgm-emerald-rush.mp3": "7782e3520275",
    "audio/bgm-enhance.mp3": "eb0690d02d8a",
    "audio/bgm-erfolg-piano.mp3": "44aff91727e2",
    "audio/bgm-erfolg.mp3": "c5a0d9fddca4",
    "audio/bgm-evans.mp3": "37c5c9e21113",
    "audio/bgm-event-01.mp3": "c57069b5ad2f",
    "audio/bgm-event-02.mp3": "d572118c203e",
    "audio/bgm-freedom-dive.mp3": "34616b2fccd3",
    "audio/bgm-fusion.mp3": "6f0d4675789f",
    "audio/bgm-game-over.mp3": "d9fb75a7c827",
    "audio/bgm-gourmet-race-64.mp3": "8d110d3430e4",
    "audio/bgm-gourmet-race-dx.mp3": "cb6d19e5ff52",
    "audio/bgm-grievous-lady.mp3": "28bfeda8d534",
    "audio/bgm-haruka.mp3": "7a7164dbf152",
    "audio/bgm-home-2.mp3": "71bf51ba1f71",
    "audio/bgm-home-ichika.mp3": "29295336d1af",
    "audio/bgm-hopes-and-dreams-short.mp3": "a88b77ee4973",
    "audio/bgm-hopes-and-dreams.mp3": "e6202f9f8356",
    "audio/bgm-humanoid.mp3": "763466fbbf97",
    "audio/bgm-journey.mp3": "816f0cdab93e",
    "audio/bgm-kaze-ga-soyogu-basho.mp3": "e986277401a6",
    "audio/bgm-kiki-issen-short.mp3": "add607be5bec",
    "audio/bgm-kimimachi-loop.mp3": "1be296a6cdb3",
    "audio/bgm-kindan-no-resistance.mp3": "efca5c01d0b7",
    "audio/bgm-kiss-mystery-short.mp3": "104ce98f9f90",
    "audio/bgm-kiss-mystery.mp3": "4decd41ac6c2",
    "audio/bgm-lamia.mp3": "faaab8302652",
    "audio/bgm-light-player-short.mp3": "5d59fb7eb1fb",
    "audio/bgm-light-player.mp3": "c07830c2e774",
    "audio/bgm-makutsu-no-senritsu.mp3": "8db199451f0b",
    "audio/bgm-market.mp3": "a85ba65f90e7",
    "audio/bgm-megalovania-sans.mp3": "8317d65943b6",
    "audio/bgm-megalovania-smash.mp3": "038da79dd59e",
    "audio/bgm-menu.mp3": "a6aef603fd6a",
    "audio/bgm-midnight-studio-short.mp3": "936b28949b4a",
    "audio/bgm-midnight-studio.mp3": "51c39ff9dbbb",
    "audio/bgm-monster-hero-theme-alt.mp3": "6b4eb065c2e2",
    "audio/bgm-monster-hero-theme.mp3": "083a1d9db281",
    "audio/bgm-monster-short.mp3": "415b771e9bbf",
    "audio/bgm-monster.mp3": "6b190639c3fa",
    "audio/bgm-monsuc-cup.mp3": "4e4cf0ca4ae6",
    "audio/bgm-monsuc-lose.mp3": "eff2057aa49e",
    "audio/bgm-monsuc-menu.mp3": "7fdee580d090",
    "audio/bgm-monsuc-rest.mp3": "3bf37f96821c",
    "audio/bgm-monsuc-training.mp3": "9bfeb31fb38a",
    "audio/bgm-monsuc-win.mp3": "b708c1a263da",
    "audio/bgm-mou-hitotsu-no-sekai-e.mp3": "633ed0ee2501",
    "audio/bgm-nothing-without-you.mp3": "4cb261cf1cd9",
    "audio/bgm-only-my-railgun.mp3": "62fb741fe3f1",
    "audio/bgm-pandora-boss-beat.mp3": "b70636c619b2",
    "audio/bgm-pandora-boss-remix.mp3": "0faa4d713fdc",
    "audio/bgm-pandora-boss.mp3": "b6683818f250",
    "audio/bgm-pro-battle-01.mp3": "59a3a0fbfef1",
    "audio/bgm-pro-battle-02.mp3": "f572c81a9ef6",
    "audio/bgm-profile.mp3": "523789845ff1",
    "audio/bgm-rebellion-short.mp3": "92a340e95441",
    "audio/bgm-rebellion.mp3": "c16005aa72de",
    "audio/bgm-result.mp3": "c4dc9d2fb8a5",
    "audio/bgm-rising-hope.mp3": "5b56b8f9d099",
    "audio/bgm-rose-short.mp3": "fd5f8290037c",
    "audio/bgm-rose.mp3": "1a030e41df75",
    "audio/bgm-rpg-short.mp3": "7d4428d73d94",
    "audio/bgm-rpg.mp3": "36abe34289f9",
    "audio/bgm-sad-song-short.mp3": "2ff39f50eddd",
    "audio/bgm-sad-song.mp3": "47d16979bb90",
    "audio/bgm-saudade-short.mp3": "e7a88d84c06a",
    "audio/bgm-saudade.mp3": "5364f7be63a5",
    "audio/bgm-seasons-of-a-little-plaza.mp3": "b75ae2e2592d",
    "audio/bgm-senjou-no-shippuu.mp3": "dfcd5d833fec",
    "audio/bgm-sheriruth-proto.mp3": "a6f3c4e66746",
    "audio/bgm-sheriruth.mp3": "5044be9b5c0d",
    "audio/bgm-six-eternel-beat.mp3": "151f94091a34",
    "audio/bgm-six-eternel-remix-beat.mp3": "b1a024d5b16f",
    "audio/bgm-six-eternel-remix.mp3": "5f56c89739f8",
    "audio/bgm-six-eternel.mp3": "e26412179f3a",
    "audio/bgm-sparkling-pink-overture.mp3": "6e474b21b5d9",
    "audio/bgm-stay-with-me-short.mp3": "d836a069998d",
    "audio/bgm-the-city-beneath-the-comets.mp3": "900fda0dc05e",
    "audio/bgm-three-y-three-s.mp3": "904d75645164",
    "audio/bgm-title-theme.mp3": "8af0684e79e7",
    "audio/bgm-title.mp3": "b7bdc68bb0c0",
    "audio/bgm-toriko.mp3": "3870d26f6322",
    "audio/bgm-toward-the-stars-short.mp3": "88907da29e09",
    "audio/bgm-tsuki-ga-michiru-mae-ni-short.mp3": "fe27c9332589",
    "audio/bgm-tsuki-ga-michiru-mae-ni.mp3": "74eb2d433abd",
    "audio/bgm-walkure-short.mp3": "4ac3e2f2af3e",
    "audio/bgm-walkure.mp3": "c0643f725dff",
    "audio/bgm-winter-fall-short.mp3": "619d095a922a",
    "audio/bgm-winter-fall.mp3": "7ba38a0b2856",
    "audio/bgm-wrath-of-the-thorn-king.mp3": "d1ea326a4ee2",
    "audio/bgm-zenbu-hissatsuwaza.mp3": "5b91503c1743",
    "audio/jingle-victory.mp3": "689c9715a824",
    "audio/se-awakened-moo-apocalypse.mp3": "3ed18e30e8e7",
    "audio/se-xmas-novel-laugh.mp3": "3d471d7fc744",
    "audio/綺季一閃_～花雪に舞う詠姫～.mp3": "099d201c53b1",
// </audio-cache-keys>
  };
  // 表に無い音源はキーを付けない(取り違えて404にするより、キャッシュが残るほうがまだ軽い)
  const audioUrlWithKey = (url) => {
    const key = AUDIO_CACHE_KEYS[url];
    return key ? `${url}?v=${key}` : url;
  };
  const _gainFromPct = (pct) => pct <= 0 ? 0 : Math.pow(10, (-40 + (Math.min(100, pct) / 100) * 40) / 20);
  const _bgmGain = (pct) => pct <= 0 ? 0 : Math.pow(10, (-55 + (Math.min(100, pct) / 100) * 55) / 20) * 0.55;

  // HTMLAudioElementはiOSの消音スイッチを無視するため使用しない。mp3を取得・デコードし、
  // BGMもジングルもAudioBufferSourceNodeだけで出力する。
  //
  // 出口(destination)の手前に、素通しのgainと音量計(analyser)を1つだけ挟む。
  // 音は変えない。「コードの上では鳴らしているのに端末から聞こえない」を切り分けるため、
  // 実際に流れている波形の大きさを設定画面から見られるようにする
  const buildAudioGraph = (ctx) => {
    masterOut = ctx.createGain();
    masterOut.gain.value = videoHold ? 0 : 1;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    try { analyserData = new Float32Array(analyser.fftSize); } catch (e) { analyserData = null; }
    masterOut.connect(analyser);
    analyser.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = _bgmGain(bgmVolumePct);
    bgmGain.connect(masterOut);
  };
  const getAudioCtx = () => {
    if (audioCtx) return audioCtx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
      buildAudioGraph(audioCtx);
      ctxTimeMark = null;
      bindResumeOnGesture();
    } catch (e) { audioCtx = null; bgmGain = null; masterOut = null; analyser = null; analyserData = null; }
    return audioCtx;
  };
  // AudioContextは端末側の自動再生制限・省電力・他アプリの音声フォーカスで止められる。
  // 止まったまま start() しても無音になるだけなので、次のタップで必ず復帰させる。
  // タップはuser activationが有効な唯一の機会なので、ここでresume()を呼ぶ意味がある。
  //
  // ここから下は、AudioContext.currentTime が実時間どおりに進んでいるかを見る仕掛け。
  // Androidでは、出力先の切り替え(Bluetooth・イヤホン)・他アプリとの音の取り合い・省電力のあとに、
  // state は running のままなのに時計だけ止まり、何を鳴らしても無音になることがある。
  // この状態は resume() では戻らないので、state を見るだけでは永久に気づけない
  const ctxClockStalled = () => {
    const ctx = audioCtx;
    if (!ctx || ctx.state !== 'running') return false;
    const now = Date.now(), time = ctx.currentTime;
    if (!ctxTimeMark) { ctxTimeMark = { at: now, time }; return false; }
    const elapsed = now - ctxTimeMark.at;
    if (elapsed < 500) return false;
    const advanced = time - ctxTimeMark.time;
    ctxTimeMark = { at: now, time };
    return advanced < (elapsed / 1000) * 0.2;
  };
  let resumeOnGestureBound = false;
  let healOnGesture = false;   // 表へ戻ったあとの確かめで、出口が直らなかった印。次のタップで作り直す(r1115-205)
  const bindResumeOnGesture = () => {
    if (resumeOnGestureBound || typeof document === 'undefined') return;
    resumeOnGestureBound = true;
    const onGesture = () => {
      const ctx = audioCtx;
      if (!ctx) return;
      // 表へ戻ったあと、時計が止まっていた/起こせなかった出口は、このタップで作り直す(2026-11-15 r1115-205 社長「ゲームからタスク変えて戻ったら音が消えた」)。
      //   iOS は裏から戻ると出口が interrupted のまま、または running なのに時計が止まって無音になり、resume() では戻らないことがある
      if (healOnGesture && !activeRhythmGains.size && enabled && !pageHidden) { healOnGesture = false; rebuildAudioCtx(); return; }
      if (ctx.state === 'running') return;
      let done = null;
      try { done = ctx.resume(); } catch (e) {}
      let once = false;
      const after = () => {
        if (once) return; once = true;
        ctxTimeMark = null;
        // タップで起こしても動かない(iOS の interrupted のまま・resume が返ってこない)ときは、作り直す。演奏中の曲があるときは作り直さない(譜面とずれる)
        if (audioCtx === ctx && ctx.state !== 'running' && ctx.state !== 'closed' && !activeRhythmGains.size && enabled && !pageHidden) { rebuildAudioCtx(); return; }
        if (audioCtx && audioCtx.state === 'running' && enabled && !pageHidden && currentKey && !bgmSource && !jingleSource && !previewSource) playBGM(currentKey);
      };
      if (done && done.then) { done.then(after, after); setTimeout(after, 800); } else setTimeout(after, 0);
    };
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => {
      try { document.addEventListener(type, onGesture, { capture: true, passive: true }); } catch (e) { document.addEventListener(type, onGesture, true); }
    });
  };
  const resumeAudioCtxNoWait = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    return ctx;
  };
  const ensureAudioCtxRunning = async () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
    return ctx;
  };
  const decode = (ctx, data) => new Promise((resolve, reject) => {
    let settled = false;
    const ok = (value) => { if (!settled) { settled = true; resolve(value); } };
    const ng = (error) => { if (!settled) { settled = true; reject(error); } };
    try { const p = ctx.decodeAudioData(data, ok, ng); if (p && p.then) p.then(ok, ng); } catch (e) { ng(e); }
  });
  // いま鳴らしている音(BGM・試聴・演奏)と、いまの場面のBGMは捨てない
  const bufferInUse = (url) => {
    const buffer = buffers.get(url);
    if (!buffer) return false;
    if (bgmSource && bgmSource.buffer === buffer) return true;
    if (previewSource && previewSource.buffer === buffer) return true;
    if (rhythmBuffersInUse.has(buffer)) return true;
    const scene = currentKey ? resolveTrack(currentKey) : null;
    return !!(scene && (scene.src === url || scene.src + BGM_LIGHT_SUFFIX === url));
  };
  const rememberSongBuffer = (url) => {
    // 軽く持つ場面のBGMは別の列で数え、BGM_LIGHT_KEEP 本まで(案2)
    if (String(url).endsWith(BGM_LIGHT_SUFFIX)) {
      const li = lightOrder.indexOf(url);
      if (li >= 0) lightOrder.splice(li, 1);
      lightOrder.push(url);
      for (let i = 0; lightOrder.length > BGM_LIGHT_KEEP && i < lightOrder.length - 1;) {
        const old = lightOrder[i];
        if (bufferInUse(old)) { i++; continue; }
        lightOrder.splice(i, 1);
        buffers.delete(old);
      }
      return;
    }
    const at = songBufferOrder.indexOf(url);
    if (at >= 0) songBufferOrder.splice(at, 1);
    songBufferOrder.push(url);
    for (let i = 0; songBufferOrder.length > SONG_BUFFER_KEEP && i < songBufferOrder.length - 1;) {
      const old = songBufferOrder[i];
      if (bufferInUse(old)) { i++; continue; }
      songBufferOrder.splice(i, 1);
      buffers.delete(old);
    }
  };
  // key … 覚えておく鍵。ふつうは素のパス、場面のBGMを軽く持つときは末尾に '#light'(BGM_LIGHT_SUFFIX)
  // data … 取ってきた中身(ArrayBuffer)が手元にあれば渡す(長い曲かどうかを先に見るため、モンヒロビートが先に取る)。無ければ取りに行く
  const loadBuffer = (key, data = null) => {
    if (buffers.has(key)) return Promise.resolve(buffers.get(key));
    if (loadingBuffers.has(key)) return loadingBuffers.get(key);
    const ctx = getAudioCtx();
    if (!ctx || (!data && typeof fetch !== 'function')) return Promise.reject(new Error('Web Audio unavailable'));
    const light = String(key).endsWith(BGM_LIGHT_SUFFIX);
    const url = light ? String(key).slice(0, -BGM_LIGHT_SUFFIX.length) : key;
    // 覚えておく鍵は素のパス(url)のまま。取りに行くときだけキーを足す。
    // こうすると、キーが変わっても同じ曲を二重に持たない。
    // 長い曲(LONG_SONG_SEC より長い mp3)は丸ごと広げない(スマホのメモリで広げ切れない)。
    // 中身を取ってきた時点で見分けて断り、区切って鳴らす側(演奏は startRhythmTrack、BGM は startBgmLong)へ回す。
    // 先読み(preloadBGM・prepareBGM)が長い曲を丸ごと広げてしまうこともこれで無くなる(2026-11-23 r1119-134)
    const request = (data ? Promise.resolve(data) : (longSongBytes.has(url) ? Promise.resolve(null) : fetch(audioUrlWithKey(url), { cache: 'force-cache' }).then((res) => {
      if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
      return res.arrayBuffer();
    }))).then((bytes) => {
      const known = longSongBytes.get(url);
      if (known) throw longSongError(known);
      if (!data) { const entry = longEntryOf(url, new Uint8Array(bytes)); if (entry.long) throw longSongError(entry); }
      return decode(ctx, bytes);
    }).then((decoded) => { decodedBytes += bufferBytes(decoded); decodedCount += 1; return light ? lightenBuffer(decoded) : decoded; })
      .then((buffer) => { buffers.set(key, buffer); return buffer; })
      .finally(() => loadingBuffers.delete(key));
    loadingBuffers.set(key, request);
    return request;
  };
  const stopSource = (source) => { if (source) { try { source.onended = null; source.stop(); } catch (e) {} try { source.disconnect(); } catch (e) {} } };
  const stopJingles = () => { if (jingleTimer) clearTimeout(jingleTimer); jingleTimer = null; stopSource(jingleSource); jingleSource = null; };
  const stopOthers = () => { stopSource(bgmSource); bgmSource = null; bgmSourceKey = null; };
  const resolveTrack = key => BGM_TRACK_BY_ID[key] || BGM_TRACK_BY_KEY[key] || null;
  const safeTrackGain = track => Math.max(0, Math.min(1.25, Number.isFinite(track?.gain) ? track.gain : 1));
  // ★fadeToBGM で下げている途中でも、次の曲を鳴らすときは予定を消してから音量を戻す(0のまま止まらないように)
  const applyTrackGain = track => { if (bgmGain) { try { bgmGain.gain.cancelScheduledValues(0); } catch (e) {} bgmGain.gain.value = Math.min(1, _bgmGain(bgmVolumePct) * safeTrackGain(track)); } };

  const startBgmBuffer = (key, track, buffer, request) => {
    const ctx = getAudioCtx();
    if (!ctx || request !== bgmRequest || key !== currentKey || !enabled || bgmVolumePct <= 0 || pageHidden || jingleSource || previewSource) return;
    if (bgmSource && bgmSourceKey === key) return;
    stopOthers();
    const source = ctx.createBufferSource();
    applyTrackGain(track);
    const once = !!(bgmOnce && bgmOnce.key === key);
    source.buffer = buffer; source.loop = once ? false : track.loop !== false; source.connect(bgmGain);
    bgmSource = source; bgmSourceKey = key;
    // 止めるとき(stopSource)は onended を外してから止めるので、ここへ来るのは最後まで流れたときだけ
    source.onended = () => {
      if (bgmSource !== source) return;
      bgmSource = null; bgmSourceKey = null;
      const o = bgmOnce;
      if (once && o && o.key === key && currentKey === key) { bgmOnce = null; try { o.onEnd && o.onEnd(); } catch (e) {} }
    };
    try { source.start(0); } catch (e) { stopOthers(); return; }
    // 止まったままのAudioContextで鳴らしても無音のままになる。すぐに復帰を試す
    // (失敗しても、次のタップで bindResumeOnGesture が鳴らし直す)
    if (ctx.state !== 'running') resumeAudioCtxNoWait();
  };
  // 長い曲を BGM として流す(2026-11-23 r1119-134 社長「BGMも直す」)。演奏と同じく区切って広げて鳴らす。
  // bgmSource には、止め方(stopSource)が同じになる入れ物を入れる。音量・フェードはこれまでどおり bgmGain で掛かる。
  // 輪にする曲は、終わりの時刻ちょうどに頭の区切りを予約して、すき間なく頭へ戻る
  const startBgmLong = async (key, track, entry, request) => {
    const ctx = getAudioCtx();
    const stale = () => !ctx || ctx !== getAudioCtx() || request !== bgmRequest || key !== currentKey || !enabled || bgmVolumePct <= 0 || pageHidden || jingleSource || previewSource;
    if (stale() || (bgmSource && bgmSourceKey === key)) return;
    let long = null;
    try { long = await openLongSong(ctx, entry); } catch (e) { return; }
    if (stale() || (bgmSource && bgmSourceKey === key) || !bgmGain) { long.release(); return; }
    stopOthers();
    applyTrackGain(track);
    const once = !!(bgmOnce && bgmOnce.key === key);
    const holder = { buffer: null, longSong: long, onended: null, stop: () => long.release(), disconnect: () => {} };
    bgmSource = holder; bgmSourceKey = key;
    holder.onended = () => {
      if (bgmSource !== holder) return;
      bgmSource = null; bgmSourceKey = null;
      const o = bgmOnce;
      if (once && o && o.key === key && currentKey === key) { bgmOnce = null; try { o.onEnd && o.onEnd(); } catch (e) {} }
    };
    // __mhTestLongBgmFromSec … 検査(tools/audio/long-bgm-chunk-check.js)だけが置く。曲の途中から流して、輪の継ぎ目を待たずに測る
    const fromSec = typeof window !== 'undefined' && Number.isFinite(Number(window.__mhTestLongBgmFromSec)) ? Math.max(0, Math.min(long.duration - 0.5, Number(window.__mhTestLongBgmFromSec))) : 0;
    if (fromSec > 0) { try { await long.ready(fromSec); } catch (e) {} if (stale() || bgmSource !== holder) { if (bgmSource !== holder) long.release(); return; } }
    const t0 = long.playFrom(fromSec, bgmGain, () => { const f = holder.onended; if (f) f(); }, { loop: once ? false : track.loop !== false });
    if (t0 === false) { stopOthers(); return; }
    if (ctx.state !== 'running') resumeAudioCtxNoWait();
  };
  const playBGM = (key) => {
    const track = resolveTrack(key);
    if (!track) { const o = bgmOnce; if (o && o.key === key) { bgmOnce = null; try { o.onFail && o.onFail(); } catch (e) {} } return Promise.resolve(); }
    if (bgmOnce && bgmOnce.key !== track.id) bgmOnce = null;
    currentKey = track.id;
    const request = ++bgmRequest;
    if (bgmSourceKey && bgmSourceKey !== track.id) stopOthers();
    if (!enabled || bgmVolumePct <= 0 || pageHidden) { stopOthers(); stopJingles(); return Promise.resolve(); }
    resumeAudioCtxNoWait();
    // 起動タップ前にdecode済みなら、user activation中に同期的に再生開始する。
    const bufKey = sceneBufferKey(track.src);
    if (buffers.has(bufKey)) {
      startBgmBuffer(track.id, track, buffers.get(bufKey), request);
      rememberSongBuffer(bufKey);
      return Promise.resolve();
    }
    if (longSongBytes.has(track.src)) return startBgmLong(track.id, track, longSongBytes.get(track.src), request);
    return loadBuffer(bufKey).then((buffer) => { rememberSongBuffer(bufKey); startBgmBuffer(track.id, track, buffer, request); }).catch((e) => {
      if (e && e.longEntry) return startBgmLong(track.id, track, e.longEntry, request);
      // 1回だけ流す曲が読み込めなかったら、並びの次へ進めてもらう(この呼び出しが今も最新のときだけ。止めた後には呼ばない)
      const o = bgmOnce;
      if (o && o.key === track.id && request === bgmRequest && currentKey === track.id) { bgmOnce = null; try { o.onFail && o.onFail(); } catch (e) {} }
    });
  };
  // key を1回だけ流す曲にする(鳴らすのは playBGM)。null で外す。handlers … { onEnd(), onFail() }
  const setBgmOnce = (key, handlers = {}) => {
    const track = key ? resolveTrack(key) : null;
    bgmOnce = key ? { key: track ? track.id : key, onEnd: handlers.onEnd || null, onFail: handlers.onFail || null } : null;
  };
  // 今の曲を ms かけて小さくしてから、次の曲へ移す(2026-10-17 会話イベントの途中で曲を替える。社長「途中で変わるのいいね」)。
  // 鳴っていない・同じ曲のときは playBGM と同じ。下げているあいだに別の曲が決まったら、そちらを優先する
  let fadeRequest = 0;
  const fadeToBGM = (key, ms = 800) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve();
    const ctx = getAudioCtx();
    if (!ctx || !bgmGain || !bgmSource || bgmSourceKey === track.id || !enabled || pageHidden) return playBGM(key);
    const req = ++fadeRequest;
    const seconds = Math.max(0.05, (Number(ms) || 0) / 1000);
    try {
      const at = ctx.currentTime;
      bgmGain.gain.cancelScheduledValues(at);
      bgmGain.gain.setValueAtTime(bgmGain.gain.value, at);
      bgmGain.gain.linearRampToValueAtTime(0, at + seconds);
    } catch (e) { return playBGM(key); }
    currentKey = track.id;
    return new Promise((resolve) => setTimeout(() => {
      if (req !== fadeRequest || currentKey !== track.id) { resolve(); return; }
      resolve(playBGM(key));
    }, seconds * 1000));
  };
  // 番号を進めることで、読み込み待ちの古い試聴を無効にする(あとから鳴り出さない)
  const stopPreview = (resume = true) => { ++previewRequest; stopSource(previewSource); previewSource = null; previewKey = null; if (resume && currentKey) playBGM(currentKey); };
  const previewBGM = async key => {
    const track = resolveTrack(key); if (!track) return false;
    if (previewKey === track.id) { stopPreview(true); return false; }
    stopPreview(false); stopJingles(); stopOthers();
    // stopPreview が番号を進めたあとに受け取るので、この値はこの呼び出し専用。
    // 曲名だけで見張っていると、同じ曲を素早く押し直したときに古い呼び出しも
    // 条件を通ってしまい、音源が2つ鳴って片方が参照から外れる(誰も止められなくなる)。
    // 実際に「止めても鳴り続ける・アレンジを閉じても鳴り続ける」不具合になっていた
    const request = previewRequest;
    previewKey = track.id;
    // 通常BGM(playBGM)と同じく、タップが効いているうちに同期でresumeを始める。
    // 読み込みを待ってから初めてresumeすると、user activationが切れていて復帰できない端末がある
    resumeAudioCtxNoWait();
    try {
      // 長い曲は丸ごと広げず、区切って広げて輪にして流す(startBgmLong と同じ。2026-11-23 r1119-134)
      let buffer = null, longEntry = longSongBytes.get(track.src) || null;
      if (!longEntry) { try { buffer = await loadBuffer(track.src); rememberSongBuffer(track.src); } catch (e) { if (!e || !e.longEntry) throw e; longEntry = e.longEntry; } }
      if (request !== previewRequest || previewKey !== track.id || !enabled || pageHidden || bgmVolumePct <= 0) return false;
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return false;
      // ensureAudioCtxRunning も待つので、そのあいだに止められていないかもう一度見る
      if (request !== previewRequest) return false;
      let long = null;
      if (longEntry) { long = await openLongSong(ctx, longEntry); if (request !== previewRequest || ctx !== getAudioCtx() || !bgmGain) { long.release(); return false; } }
      applyTrackGain(track);
      let source;
      if (long) {
        source = { buffer: null, longSong: long, onended: null, stop: () => long.release(), disconnect: () => {} };
        previewSource = source;
        source.onended = () => { if (previewSource === source) stopPreview(true); };
        if (long.playFrom(0, bgmGain, () => { const f = source.onended; if (f) f(); }, { loop: track.loop !== false }) === false) { if (previewSource === source) { previewSource = null; previewKey = null; } return false; }
      } else {
        source = ctx.createBufferSource(); source.buffer = buffer; source.loop = track.loop !== false; source.connect(bgmGain); previewSource = source;
        source.onended = () => { if (previewSource === source) stopPreview(true); }; source.start(0);
      }
      // 止まったままのAudioContextで鳴らしても無音。もう一度だけ復帰を試し、
      // それでも動かなければ「鳴っている」と嘘をつかずに戻す(次のタップでやり直せる)
      if (ctx.state !== 'running') { await ensureAudioCtxRunning(); }
      // 復帰待ちのあいだに止められていたら、いま鳴らし始めたぶんを取り逃さず止める
      if (request !== previewRequest) { stopSource(source); if (previewSource === source) { previewSource = null; previewKey = null; } return false; }
      if (ctx.state !== 'running') { if (previewKey === track.id) stopPreview(false); return false; }
      return true;
    } catch (e) { if (request === previewRequest && previewKey === track.id) stopPreview(true); return false; }
  };
  const stopBGM = () => { currentKey = null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers(); };

  // BGMの出口を丸ごと作り直す。設定画面の「音を鳴らし直す」から呼ぶ。
  // 「running なのに時計が止まっている」「resume しても戻らない」状態は、
  // いまのAudioContextを捨てて新しく作る以外に戻す手がない(Androidで実際に起きる)。
  // 音ゲーの演奏中だけは作り直さない(鳴っている曲のハンドルが死に、譜面とずれるため)。
  const rebuildAudioCtx = async () => {
    if (activeRhythmGains.size) return false;
    const old = audioCtx, resumeKey = currentKey;
    ++bgmRequest; ++previewRequest;
    stopSource(bgmSource); bgmSource = null; bgmSourceKey = null;
    stopSource(previewSource); previewSource = null; previewKey = null;
    stopJingles();
    audioCtx = null; bgmGain = null; masterOut = null; analyser = null; analyserData = null; ctxTimeMark = null;
    // 音源(AudioBuffer)は作り直したcontextのサンプリングレートが違うと速さが変わってしまう。
    // 取り直しても通信キャッシュから読めるので、ここは安全側に倒して捨てる
    buffers.clear(); loadingBuffers.clear(); songBufferOrder.length = 0; rhythmBuffersInUse.clear();
    try { if (old && old.state !== 'closed') await old.close(); } catch (e) {}
    const ctx = getAudioCtx();
    if (!ctx) return false;
    ctxRebuildCount++;
    // 効果音(Tone)はTone自身のAudioContextで鳴っているので、ここでは触らない。
    // 止まっていることがあるので、起こすところだけやる
    if (Tone) { try { await Tone.start(); started = true; } catch (e) {} }
    try { await ctx.resume(); } catch (e) {}
    currentKey = resumeKey;
    if (enabled && resumeKey && !pageHidden) playBGM(resumeKey);
    return ctx.state === 'running';
  };
  // いま出口へ実際に流れている波形の大きさ(0〜1)。鳴っていなければ0。
  // 「アプリは鳴らしているのに端末から聞こえない」のか「そもそも鳴っていない」のかを分ける
  const outputLevel = () => {
    if (!analyser || !analyserData) return null;
    try {
      analyser.getFloatTimeDomainData(analyserData);
      let peak = 0;
      for (let i = 0; i < analyserData.length; i++) { const v = Math.abs(analyserData[i]); if (v > peak) peak = v; }
      return peak;
    } catch (e) { return null; }
  };
  // 効果音エンジン(Tone)を通さず、素のWeb Audioだけで短い音を鳴らす。
  // 「Toneが読めていないだけ」なのか「出口そのものが死んでいる」のかを分けるため
  const playTestTone = async () => {
    const ctx = await ensureAudioCtxRunning();
    if (!ctx || !masterOut) return false;
    try {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, at);
      osc.frequency.setValueAtTime(1320, at + 0.16);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.3, at + 0.02);
      gain.gain.linearRampToValueAtTime(0, at + 0.42);
      osc.connect(gain); gain.connect(masterOut);
      osc.start(at); osc.stop(at + 0.45);
      setTimeout(() => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} }, 900);
      return true;
    } catch (e) { return false; }
  };
  // ★長い曲は、音源を区切って順に広げて鳴らす(2026-11-23 r1119-125 社長「長い曲も鳴るように直す」)。
  //   きっかけ: ワルキューレの原曲(約11分32秒)をスマホで始めると「音源を再生できません」で0:00のまま。
  //   演奏の前に音源を丸ごと decodeAudioData で広げると、48kHz・2ch で約250MBになり、スマホのメモリで
  //   広げ切れずに失敗していた(Playwright でブラウザのメモリを 1.5〜1.8GB に絞ると、この曲だけ EncodingError。
  //   6分半の曲・ショート版は同じ条件で通る)。
  //   直し方: LONG_SONG_SEC より長い mp3 だけ、フレームの切れ目で約 LONG_CHUNK_SEC 秒ずつに区切り、
  //   鳴る少し前に広げて Web Audio の時刻どおりにつなげる。鳴り終えた区切りは捨てる(持つのは2〜3区切りぶん)。
  //   ・区切りは前後に LONG_PRE/POST_FRAMES フレーム余分に広げる(頭の数フレームは前のフレームの情報が無く崩れるため)
  //   ・区切りの頭が曲のどこに当たるかは、広げ方(ブラウザ)ごとにずれ方が決まっているので、最初に1回、
  //     曲の頭の区切りと短い試しの区切りの波形を突き合わせて測る(longAlignLag)。続く区切りも前の区切りと突き合わせて置く
  //   ・つなぎ目は LONG_FADE_SEC だけ重ねて入れ替える(同じ波形どうしなので音量は変わらない。音切れ・二重鳴りを出さない)
  //   ・曲の時刻(判定・譜面の進み)は丸ごとのときと同じ式(再生を始めた ctx の時刻と offset)で、区切りに関係なく進む
  //   これより短い曲は、これまでどおり丸ごと広げる(長さは mp3 のフレームの数から先に分かる)
  const LONG_SONG_SEC = 480, LONG_START_LEAD_SEC = 0.03, LONG_CHUNK_SEC = 20, LONG_PRE_FRAMES = 16, LONG_POST_FRAMES = 16, LONG_FADE_SEC = 0.02;
  // 長い曲の mp3 の中身(圧縮したまま。1曲で十数MB)。いちばん新しい1曲だけ持つ
  const longSongBytes = new Map();
  const MP3_BITRATE = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
  const MP3_RATE = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  const mp3FrameAt = (u8, i) => {
    if (i + 4 > u8.length || u8[i] !== 0xFF || (u8[i + 1] & 0xE0) !== 0xE0) return null;
    const ver = (u8[i + 1] >> 3) & 3, layer = (u8[i + 1] >> 1) & 3;
    if (ver === 1 || layer !== 1) return null;
    const bri = u8[i + 2] >> 4, sri = (u8[i + 2] >> 2) & 3, pad = (u8[i + 2] >> 1) & 1;
    if (bri === 0 || bri === 15 || sri === 3) return null;
    const sr = MP3_RATE[ver][sri], spf = ver === 3 ? 1152 : 576;
    return { len: Math.floor((spf / 8) * MP3_BITRATE[ver === 3 ? 1 : 2][bri] * 1000 / sr) + pad, sr, spf };
  };
  // mp3 のフレームの位置の一覧。mp3 でなければ null
  const parseMp3Frames = (u8) => {
    let i = 0;
    if (u8.length > 10 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) i = 10 + (((u8[6] & 127) << 21) | ((u8[7] & 127) << 14) | ((u8[8] & 127) << 7) | (u8[9] & 127)) + ((u8[5] & 0x10) ? 10 : 0);
    const offs = []; let sr = 0, spf = 0, end = i;
    while (i + 4 <= u8.length) {
      const f = mp3FrameAt(u8, i);
      if (f && f.len > 4 && (!sr || (f.sr === sr && f.spf === spf))) {
        const next = i + f.len;
        // 偽の同期を拾わない: 次のフレームの頭もそろっているか(最後は末尾・ID3v1 の 128 バイト)
        if (next <= u8.length && (next === u8.length || u8.length - next <= 128 || mp3FrameAt(u8, next))) { offs.push(i); sr = f.sr; spf = f.spf; end = next; i = next; continue; }
      }
      i++;
    }
    return offs.length ? { offsets: Uint32Array.from(offs), end, sr, spf } : null;
  };
  // 取ってきた中身が長い曲かを見分ける。長い曲なら中身を持っておく(いちばん新しい1曲だけ)
  const longEntryOf = (url, bytes) => {
    let map = null; try { map = parseMp3Frames(bytes); } catch (e) { map = null; }
    const long = !!(map && map.offsets.length * map.spf / map.sr > LONG_SONG_SEC);
    const entry = { url, bytes, map, long };
    if (long) { longSongBytes.clear(); longSongBytes.set(url, entry); }
    return entry;
  };
  // loadBuffer が長い曲を断るときの印(e.longEntry に中身)
  const longSongError = (entry) => { const e = new Error('long song: play in chunks'); e.longEntry = entry; return e; };
  const fetchSongBytes = async (url) => {
    const hit = longSongBytes.get(url); if (hit) return hit;
    const res = await fetch(audioUrlWithKey(url), { cache: 'force-cache' });
    if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
    return longEntryOf(url, new Uint8Array(await res.arrayBuffer()));
  };
  // 2つの音の波形を突き合わせ、b[j] が a[j+L] に当たる L(サンプル・小数)を探す。L0 の前後 R だけ見る
  // 作業用の配列は使い回す(2026-11-28 r1126-100「ワルキューレの原曲がかくつく」)。演奏中も約20秒ごとにつなぎ目を合わせるので、
  // そのたびに数百KBの配列を作って捨てると、ごみ集め(GC)を呼ぶ。中身は毎回すべて書き直すので、結果は前と同じ
  const longScratch = [];
  const scratchOf = (slot, len) => { let a = longScratch[slot]; if (!a || a.length < len) a = longScratch[slot] = new Float32Array(Math.max(len, a ? a.length : 0)); return a.length === len ? a : a.subarray(0, len); };
  const monoRange = (buf, from, len, slot = -1) => {
    const out = slot >= 0 ? scratchOf(slot, len) : new Float32Array(len), c0 = buf.getChannelData(0), c1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    for (let i = 0; i < len; i++) { const k = from + i; out[i] = k >= 0 && k < buf.length ? (c1 ? (c0[k] + c1[k]) * 0.5 : c0[k]) : 0; }
    return out;
  };
  const longAlignLag = (aBuf, bBuf, j0, len, L0, R = 3200) => {
    const D = 8; len -= len % D;
    const A = monoRange(aBuf, j0 + L0 - R - D, len + 2 * R + 2 * D, 0), B = monoRange(bBuf, j0, len, 1);
    const dec = (x, slot) => { const m = Math.floor(x.length / D), o = scratchOf(slot, m); for (let i = 0; i < m; i++) { let t = 0; for (let k = 0; k < D; k++) t += x[i * D + k]; o[i] = t; } return o; };
    const Ad = dec(A, 2), Bd = dec(B, 3), RD = R / D;
    let best = -Infinity, bestD = 0;
    for (let d = -RD; d <= RD; d++) { let t = 0; const o = d + RD + 1; for (let i = 0; i < Bd.length; i++) t += Ad[i + o] * Bd[i]; if (t > best) { best = t; bestD = d; } }
    const Lc = L0 + bestD * D, W = 12, len2 = Math.min(len, 8192), j1 = j0 + Math.floor((len - len2) / 2);
    const A2 = monoRange(aBuf, j1 + Lc - W, len2 + 2 * W, 4), B2 = monoRange(bBuf, j1, len2, 5);
    const sc = []; for (let L = -W; L <= W; L++) { let t = 0; for (let i = 0; i < len2; i++) t += A2[i + L + W] * B2[i]; sc.push(t); }
    let bi = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[bi]) bi = i;
    let frac = 0; if (bi > 0 && bi < sc.length - 1) { const den = sc[bi - 1] - 2 * sc[bi] + sc[bi + 1]; if (den < 0) frac = 0.5 * (sc[bi - 1] - sc[bi + 1]) / den; }
    let ea = 0, eb = 0; for (let i = 0; i < len2; i++) { const x = A2[i + bi]; ea += x * x; eb += B2[i] * B2[i]; }
    return { lag: Lc + (bi - W) + frac, corr: ea > 0 && eb > 0 ? sc[bi] / Math.sqrt(ea * eb) : 0, rms: Math.sqrt(eb / len2) };
  };
  const longAligned = (r) => r && r.corr >= 0.97 && r.rms > 1e-3;
  // 長い曲を区切って鳴らす仕組みを用意する。曲の頭の区切りと最後の区切りを広げて、長さと区切りの置き場所を決める
  const openLongSong = async (ctx, entry) => {
    const { bytes, map } = entry, n = map.offsets.length, fsec = map.spf / map.sr;
    const per = Math.max(64, Math.round(LONG_CHUNK_SEC / fsec));
    const bounds = [0]; for (let b = per; b < n - per / 4; b += per) bounds.push(b);
    const count = bounds.length;
    const byteRange = (k) => {
      const a = k === 0 ? 0 : map.offsets[Math.max(0, bounds[k] - LONG_PRE_FRAMES)];
      const e = k + 1 >= count ? bytes.length : (bounds[k + 1] + LONG_POST_FRAMES < n ? map.offsets[bounds[k + 1] + LONG_POST_FRAMES] : bytes.length);
      return [a, e];
    };
    let C = 0, aligned = false;
    const stats = { log: [], chunks: count, chunkSec: per * fsec, decoded: 0, seams: 0, seamMaxDevMs: 0, late: 0, failed: 0, probeCorr: 0 };
    const theoryStart = (k) => (k === 0 ? 0 : (bounds[k] - LONG_PRE_FRAMES) * fsec + C);
    const seamSec = (k) => bounds[k] * fsec + C;
    const chunks = new Map(), pending = new Map();
    const getChunk = (k) => {
      if (chunks.has(k)) return Promise.resolve(chunks.get(k));
      if (pending.has(k)) return pending.get(k);
      const [a, e] = byteRange(k);
      const p = decode(ctx, bytes.slice(a, e).buffer).then((buffer) => {
        stats.decoded++; decodedBytes += bufferBytes(buffer); decodedCount += 1;
        let startSec = theoryStart(k);
        // 前の区切りが手元にあれば、つなぎ目のまわりの波形を突き合わせて置き場所を確かめる
        const prev = chunks.get(k - 1);
        if (k > 0 && prev && aligned) {
          const r = buffer.sampleRate, s = seamSec(k);
          const m = longAlignLag(prev.buffer, buffer, Math.round((s - 0.2 - startSec) * r), Math.round(0.4 * r), Math.round((startSec - prev.startSec) * r), 960);
          if (longAligned(m)) { const got = prev.startSec + m.lag / r, dev = Math.abs(got - startSec); stats.seams++; stats.seamMaxDevMs = Math.max(stats.seamMaxDevMs, dev * 1000); if (dev < 0.02 && dev * r >= 0.5) startSec = got; }
        }
        const c = { buffer, startSec }; chunks.set(k, c); return c;
      }).finally(() => pending.delete(k));
      pending.set(k, p);
      return p;
    };
    const head = (await getChunk(0)).buffer, rate = head.sampleRate;
    // 2回目からは、前に測った値(同じサンプルレートのとき)を使う。BGM として何度も流し直すので
    const meta = entry.longMeta && entry.longMeta.rate === rate ? entry.longMeta : null;
    if (meta) { C = meta.C; aligned = meta.aligned; stats.probeCorr = meta.probeCorr; }
    // 区切りの頭のずれ方(C)を測る: 曲の頭の区切りの中で音のいちばん大きい所から短く広げ、頭の区切りと突き合わせる
    {
      const probeLen = 48, lo = LONG_PRE_FRAMES + 8, hi = Math.min(bounds[1] || n, n) - probeLen - 8;
      let bestP = -1, bestE = 0;
      for (let p = lo; p <= hi; p += Math.max(1, Math.round(1 / fsec))) {
        const from = Math.round(p * fsec * rate), seg = monoRange(head, from, Math.round(0.5 * rate), 6); let e = 0;
        for (let i = 0; i < seg.length; i += 4) e += seg[i] * seg[i];
        if (e > bestE) { bestE = e; bestP = p; }
      }
      if (bestP >= 0 && !meta) {
        try {
          const probe = await decode(ctx, bytes.slice(map.offsets[bestP], map.offsets[bestP + probeLen]).buffer);
          const m = longAlignLag(head, probe, Math.round(8 * fsec * rate), Math.round(Math.min(0.5, 30 * fsec) * rate), Math.round(bestP * fsec * rate));
          stats.probeCorr = Math.round(m.corr * 1000) / 1000;
          if (longAligned(m)) { const lag = Math.abs(m.lag - Math.round(m.lag)) < 0.25 ? Math.round(m.lag) : m.lag; C = lag / rate - bestP * fsec; aligned = true; }
        } catch (e) {}
      }
    }
    stats.offsetMs = Math.round(C * 10000) / 10;
    // 曲の長さ: 最後の区切りを広げて測る(持ち続けない)
    let duration = meta ? meta.duration : head.duration;
    if (!meta && count > 1) { const last = await decode(ctx, bytes.slice(...byteRange(count - 1)).buffer); stats.decoded++; duration = theoryStart(count - 1) + last.duration; }
    if (!meta) entry.longMeta = { rate, C, aligned, probeCorr: stats.probeCorr, duration };
    let session = 0, live = [], timer = null, play = null;
    const chunkIndexAt = (s) => { let k = 0; while (k + 1 < count && s >= seamSec(k + 1)) k++; return k; };
    const dropLive = (x) => { stopSource(x.src); try { x.gain.disconnect(); } catch (e) {} };
    const halt = () => { session++; if (timer) clearInterval(timer); timer = null; live.forEach(dropLive); live = []; play = null; };
    const scheduleChunk = (k, first) => {
      const c = chunks.get(k); if (!c || !play) return false;
      const g = ctx.createGain(), src = ctx.createBufferSource(), my = session;
      src.buffer = c.buffer; src.connect(g); g.connect(play.out);
      let fromSong = first ? play.o : seamSec(k) - LONG_FADE_SEC / 2;
      let when = play.t0 + (fromSong - play.o);
      // 広げるのが間に合わなかったとき(本来は起きない)は、いまの位置から入れる
      if (!first && when < ctx.currentTime) { stats.late++; fromSong += ctx.currentTime - when; when = ctx.currentTime; }
      // 入れる時刻は出口のサンプルの切れ目にそろえる(端数の時刻で入れると、区切りの音が 1 サンプル未満ずれて補間される)
      if (!first) { const wr = Math.round(when * ctx.sampleRate) / ctx.sampleRate; fromSong += wr - when; when = wr; }
      if (first) g.gain.value = 1;
      else {
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + LONG_FADE_SEC);
        const prev = live.find((x) => x.k === k - 1);
        if (prev) { prev.gain.gain.setValueAtTime(1, when); prev.gain.gain.linearRampToValueAtTime(0, when + LONG_FADE_SEC); try { prev.src.stop(when + LONG_FADE_SEC + 0.01); } catch (e) {} }
      }
      if (k === count - 1) src.onended = () => { if (my === session && play && !play.loopAt) { const done = play.onEnd; halt(); done(); } };
      src.start(when, Math.max(0, fromSong - c.startSec));
      stats.log.push({ k, first, marginMs: Math.round((when - ctx.currentTime) * 10000) / 10, devMs: Math.round((c.startSec - theoryStart(k)) * 1e5) / 100 }); if (stats.log.length > 8) stats.log.shift();
      live.push({ k, src, gain: g });
      return true;
    };
    const tick = () => {
      if (!play) return;
      const my = session, s = play.o + (ctx.currentTime - play.t0), cur = Math.max(chunkIndexAt(Math.max(s, play.o)), live.length ? live[0].k : 0), next = cur + 1;
      if (next < count && !live.some((x) => x.k === next)) {
        getChunk(next).then(() => { if (my === session && play && !live.some((x) => x.k === next) && live.some((x) => x.k === next - 1)) scheduleChunk(next, false); }).catch(() => { stats.failed++; });
      }
      // 輪にする(BGM): 最後の区切りが入ったら、曲の終わりの時刻ちょうどに頭の区切りを予約する(丸ごとの loop と同じく、終わりから頭へそのまま続ける)
      if (play.loop && !play.loopAt && cur === count - 1 && count > 1 && chunks.has(0)) {
        const lastLive = live.find((x) => x.k === count - 1);
        if (lastLive) {
          const endAt = Math.round((play.t0 + (duration - play.o)) * ctx.sampleRate) / ctx.sampleRate;
          if (endAt > ctx.currentTime) {
            const g = ctx.createGain(), src = ctx.createBufferSource();
            src.buffer = chunks.get(0).buffer; src.connect(g); g.connect(play.out); g.gain.value = 1;
            play.loopAt = endAt; lastLive.src.onended = null;
            try { lastLive.src.stop(endAt); } catch (e) {}
            src.start(endAt, 0); live.push({ k: 0, src, gain: g, loopNew: true });
            stats.loops = (stats.loops || 0) + 1;
          }
        }
      }
      // 頭へ戻った: 時刻の起点を頭に置き直し、前の周の区切りを捨てる
      if (play.loopAt && ctx.currentTime >= play.loopAt) {
        play.t0 = play.loopAt; play.o = 0; play.loopAt = null;
        live = live.filter((x) => { if (x.loopNew) { x.loopNew = false; return true; } dropLive(x); return false; });
        return;
      }
      live = live.filter((x) => { if (x.loopNew) return true; if (x.k < cur && s > seamSec(x.k + 1) + LONG_FADE_SEC + 0.2) { dropLive(x); return false; } return true; });
      for (const k of Array.from(chunks.keys())) if (k !== 0 && (k < cur || k > next) && !live.some((x) => x.k === k)) chunks.delete(k);
    };
    return {
      duration, head, stats: () => ({ ...stats, held: chunks.size }),
      ready: (o) => getChunk(chunkIndexAt(o)),
      // o 秒の位置から鳴らし始め、鳴り始める ctx の時刻を返す(曲の時刻の起点にする)。区切りがまだ広がっていなければ false。
      // 「いまの時刻」で入れると、ブラウザがその時刻をもう過ぎていて数ms〜十数ms遅れて鳴り始めることがある
      // (Chromium で seek のあとにたまに 512 サンプル遅れた)。続く区切りはこの起点から時刻を決めるので、
      // 少し先(LONG_START_LEAD_SEC)のサンプルの切れ目に予約して、起点と鳴り始めを必ず一致させる
      // opts.loop … 終わりまで鳴ったら、すき間なく頭へ戻って鳴り続ける(BGM)
      playFrom: (o, out, onEnd, opts = null) => {
        halt(); const k = chunkIndexAt(o); if (!chunks.has(k)) return false;
        const t0 = Math.ceil((ctx.currentTime + LONG_START_LEAD_SEC) * ctx.sampleRate) / ctx.sampleRate;
        play = { t0, o, out, onEnd, loop: !!(opts && opts.loop), loopAt: null }; scheduleChunk(k, true);
        timer = setInterval(tick, 250); tick(); return t0;
      },
      halt,
      release: () => { halt(); chunks.clear(); },
    };
  };
  // 音ゲーの時刻は AudioContext.currentTime と再生offsetだけを正本にする。
  // BufferSourceNodeは一度stopしたら再利用せず、再開のたびにoffsetから作り直す。
  // options.autoStart:false を渡すと「音源の用意だけして、まだ鳴らさない」。
  // 音ゲー本体は、画面が組み上がるのを待ってから start() で鳴らし始める
  // (先に鳴らすと、まだノーツを置けていない間に曲だけ進んでMISSが積み上がる)。
  const startRhythmTrack = async (key,rhythmVolumePct=100,options=null) => {
    const autoStart=options?.autoStart!==false;
    // 曲えらびの試聴だけ輪にする。演奏本体は1回で終わるのが正しいので既定は false のまま
    // (2026-09-07・ユーザー指示「曲選択時、曲が流れるが最後まで行くと
    //  そのまま終わって無音になる。ループするようにして」)。
    const loop=options?.loop===true;
    const track=resolveTrack(key); if(!track) return null;
    currentKey=null; ++bgmRequest; stopPreview(false); stopJingles(); stopOthers();
    resumeAudioCtxNoWait();
    try {
      // 長い曲(LONG_SONG_SEC より長い mp3)は丸ごと広げず、区切って鳴らす(openLongSong)。
      // すでに丸ごと広げてある曲(BGMで鳴らした等)はそれを使う。丸ごと広げるのに失敗した mp3 も、区切って鳴らしに回す
      let buffer=null,long=null,dctx=null;
      if(buffers.has(track.src)||loadingBuffers.has(track.src)||typeof fetch!=='function'){
        try{buffer=await loadBuffer(track.src);}
        catch(e){if(!e||!e.longEntry)throw e;dctx=getAudioCtx();if(!dctx)return null;long=await openLongSong(dctx,e.longEntry);}
      }
      else{
        const entry=await fetchSongBytes(track.src);dctx=getAudioCtx();
        if(!dctx)return null;
        if(entry.long)long=await openLongSong(dctx,entry);
        else{
          try{buffer=await loadBuffer(track.src,entry.map?entry.bytes.buffer.slice(0):entry.bytes.buffer);}
          catch(e){if(!entry.map)throw e;long=await openLongSong(dctx,entry);}
        }
      }
      const ctx=await ensureAudioCtxRunning();
      if(buffer)rememberSongBuffer(track.src);
      if(!ctx||(long&&ctx!==dctx)){if(long)long.release();return null;}
      if(buffer)rhythmBuffersInUse.add(buffer);
      const duration=buffer?buffer.duration:long.duration;
      // outputLatencySeconds … 音が耳へ届くまでの遅れ。曲を鳴らしはじめるたびに1回だけ測って固定する
      // (data/rhythm-mode.js の rhythmAudioOutputLatencyMs。鳴っている最中に読み直すと曲の時刻が飛ぶ)
      let source=null,startedAt=ctx.currentTime,offsetSeconds=0,playing=false,stopped=false,naturallyEnded=false,gainEntry=null,outputLatencySeconds=0;
      const dropGainEntry=()=>{if(gainEntry){activeRhythmGains.delete(gainEntry);gainEntry=null;}};
      // いま鳴らしている音を止める(区切って鳴らす曲は、区切りの音をまとめて止める)
      const haltSource=()=>{const old=source;source=null;stopSource(old);if(long)long.halt();};
      // 区切って鳴らす曲は、鳴らし始める位置の区切りを先に広げておく(丸ごとの曲は何もしない)
      const prepareAt=async(offset)=>{if(long){try{await long.ready(offset);}catch{}}};
      const startSource=offset=>{
        if(stopped||offset>=duration){naturallyEnded=true;return false;}
        const nextSource=ctx.createBufferSource(),rhythmGain=ctx.createGain();
        // 上限は RHYTHM_VOLUME_MAX(=200)ぶん。100までは今までとまったく同じ値。
        // ★100より上は曲の波形をそのまま持ち上げるので、音源のピーク(-1 dBTP)を
        //   超えるところから割れる。承知のうえで使う範囲として開けてある(2026-09-12)。
        const raw=Math.max(0,Math.min(RHYTHM_VOLUME_MAX/100,Number(rhythmVolumePct)/100))*safeTrackGain(track);
        dropGainEntry(); gainEntry={node:rhythmGain,raw}; activeRhythmGains.add(gainEntry);
        rhythmGain.gain.value=enabled?raw:0;
        // 音ゲー専用の音量なので、メインのBGM音量(bgmGain)は経由しない。
        // 全体ミュート(enabled)だけはactiveRhythmGains経由で共通に反映する。
        // 出口の手前(masterOut)だけは通す。音は変わらず、音量計で鳴っているか見られるようになる
        outputLatencySeconds=rhythmAudioOutputLatencyMs(ctx)/1000;
        if(long){
          rhythmGain.connect(masterOut||ctx.destination);
          // 曲の終わりまで鳴ったら、輪にする試聴は頭から鳴らし直す。演奏は終わりにする
          const t0=long.playFrom(offset,rhythmGain,()=>{if(!playing||stopped)return;if(loop){startSource(0);return;}playing=false;naturallyEnded=true;});
          if(t0===false){dropGainEntry();return false;}
          offsetSeconds=offset; startedAt=t0; playing=true;
          return true;
        }
        nextSource.buffer=buffer; nextSource.loop=loop; nextSource.connect(rhythmGain);rhythmGain.connect(masterOut||ctx.destination);
        source=nextSource; offsetSeconds=offset; startedAt=ctx.currentTime; playing=true;
        nextSource.onended=()=>{if(source===nextSource&&playing){playing=false;naturallyEnded=true;source=null;}};
        nextSource.start(0,offset); return true;
      };
      // 耳に届いている位置を返す。ctx.currentTime は「送り出した」時刻なので、出力遅延ぶん引く。
      // 引かないと、音に合わせて叩く人が必ずその分だけ遅れて判定される(MARVELOUSは±55ms)。
      // 見た目も判定も同じこの値から出ているので、ここ1か所でそろう。
      // 鳴らしはじめの遅延ぶんは Math.max(0,…) が 0 に留める(音が出る前にノーツが動き出さない)
      // 曲の頭の無音の長さ(ms)。mp3 の先頭の遅れがブラウザで違わないかを、診断で比べるために1回だけ測る
      const headMs=(()=>{try{const hb=buffer||long.head;const d=hb.getChannelData(0);const n=Math.min(d.length,Math.floor(hb.sampleRate*1.5));for(let i=0;i<n;i++){if(Math.abs(d[i])>.01)return Math.round(i/hb.sampleRate*1000);}return -1;}catch{return null;}})();
      const rawSongTimeSeconds=()=>Math.min(duration,Math.max(0,offsetSeconds+(playing?ctx.currentTime-startedAt-outputLatencySeconds:0)));
      // 曲の時計の元になる ctx.currentTime は、128サンプルごとの階段状に進む(約3〜20msの段)。同じ値が続くコマは、曲が止まって見える。
      // 直し方 smoothSongClock を入れた端末では、段の間を performance.now() でなめらかに埋める
      // (段の値へゆっくり寄せ、離れすぎたら段の値に戻す。入れていない端末では、これまでどおり段の値そのまま)。2026-10-07
      let smoothSong=0,smoothPerf=0;
      // 端末が申告する「いま耳に届いている位置」(getOutputTimestamp)と ctx.currentTime の差。0.5秒おきに測って中央値を診断へ残す。
      // 出力遅延の申告(outputLatency)が無い端末(Safari)で、補正が足りているかを見る手がかり。判定には使わない(2026-10-07)
      const tsLatSamples=[];let tsLatAt=0;
      const sampleTsLatency=()=>{
        if(typeof ctx.getOutputTimestamp!=='function'||typeof performance==='undefined')return;
        const p=performance.now();if(p-tsLatAt<500||tsLatSamples.length>=20)return;tsLatAt=p;
        try{const ts=ctx.getOutputTimestamp();const d=(ctx.currentTime-Number(ts&&ts.contextTime))*1000;if(Number.isFinite(d)&&d>=0&&d<=1000&&Number(ts.contextTime)>0)tsLatSamples.push(d);}catch{}
      };
      const tsLatMs=()=>{if(tsLatSamples.length<3)return null;const s=tsLatSamples.slice().sort((a,b)=>a-b);return Math.round(s[s.length>>1]);};
      const songTimeSeconds=()=>{
        const raw=rawSongTimeSeconds();
        if(playing)sampleTsLatency();
        if(!playing||!rhythmTouchFixOn('smoothSongClock')||typeof performance==='undefined'){smoothPerf=0;return raw;}
        const p=performance.now();
        if(!(smoothPerf>0)){smoothSong=raw;smoothPerf=p;return raw;}
        let next=smoothSong+(p-smoothPerf)/1000;
        if(Math.abs(raw-next)>.05)next=raw;else next+=(raw-next)*.15;
        smoothSong=Math.min(duration,Math.max(smoothSong,next));smoothPerf=p;
        return smoothSong;
      };
      // atMs … 曲の途中から鳴らす(観戦で、見ている画面の位置から流す。2026-11-15 r1115-190)。既定は頭から
      const atSeconds=Math.max(0,(Number(options?.atMs)||0)/1000);
      if(autoStart){const at=atSeconds<duration?atSeconds:0;await prepareAt(at);startSource(at);}
      return {
        // autoStart:false で用意したぶんを、頭から鳴らし始める。
        // すでに鳴っている・止めたあとなら何もしない(二重に鳴らさない)
        start:()=>{if(playing||stopped||naturallyEnded)return playing;return startSource(0);},
        started:()=>playing,
        songTimeMs:()=>songTimeSeconds()*1000,
        // 元の時計(なめらかにする前)。診断で「止まったコマ」を数えるためだけに使う(2026-11-11。画面・判定は songTimeMs のまま)
        rawSongTimeMs:()=>rawSongTimeSeconds()*1000,
        // 端末の音の事情(診断用)。出力遅延・基準遅延・getOutputTimestamp の有無・サンプルレート・曲の頭の無音
        info:()=>({outLatMs:Math.round(outputLatencySeconds*1000),baseLatMs:Math.round((Number(ctx.baseLatency)||0)*1000),hasTs:typeof ctx.getOutputTimestamp==='function',tsLatMs:tsLatMs(),rate:Math.round(Number(ctx.sampleRate)||0),headMs,...(long?{chunked:long.stats()}:{})}),
        durationMs:duration*1000,
        ended:()=>naturallyEnded||songTimeSeconds()>=duration,
        paused:()=>!playing&&!stopped&&!naturallyEnded,
        pause:()=>{if(!playing||stopped)return;offsetSeconds=songTimeSeconds();playing=false;haltSource();},
        resume:async()=>{if(playing||stopped||naturallyEnded)return playing;await ensureAudioCtxRunning();await prepareAt(offsetSeconds);if(playing||stopped||naturallyEnded)return playing;return startSource(offsetSeconds);},
        // 位置を ms へ移して鳴らし直す(観戦で画面とずれたときに合わせ直す。止めたあと・終わったあとは何もしない)
        seek:async(ms)=>{if(stopped)return false;const at=Math.max(0,(Number(ms)||0)/1000);if(at>=duration)return false;playing=false;naturallyEnded=false;haltSource();offsetSeconds=at;smoothPerf=0;await ensureAudioCtxRunning();await prepareAt(at);if(stopped||playing||offsetSeconds!==at)return playing;return startSource(at);},
        restart:async()=>{if(stopped)return false;playing=false;naturallyEnded=false;haltSource();offsetSeconds=0;await ensureAudioCtxRunning();await prepareAt(0);if(stopped||playing)return playing;return startSource(0);},
        // 譜面より音源のほうが長い曲を途中で終わらせるとき、最後の少しだけ音量を落とす。
        // (2026-09-06) デュラハンの2曲は音源がバトルのBGMと同じファイルなので切れない。
        // 何もしないと曲の途中でぶつっと止まるため、終わりの手前からなめらかに消す。
        // 全体ミュートの控え(raw)も0にしておく。ミュートを切り替えても音が戻らないようにするため。
        fadeOut:(ms)=>{
          if(stopped||!playing||!gainEntry)return false;
          const seconds=Math.max(.05,(Number(ms)||0)/1000);
          try{
            const node=gainEntry.node,at=ctx.currentTime;
            node.gain.cancelScheduledValues(at);
            node.gain.setValueAtTime(node.gain.value,at);
            node.gain.linearRampToValueAtTime(0,at+seconds);
            gainEntry.raw=0;
          }catch{return false;}
          return true;
        },
        stop:()=>{if(stopped)return;stopped=true;playing=false;const old=source;source=null;stopSource(old);dropGainEntry();if(long)long.release();if(buffer)rhythmBuffersInUse.delete(buffer);},
      };
    } catch(e){ return null; }
  };
  const preloadBGM = (key) => { const track = resolveTrack(key); if (!track) return; const bufKey = sceneBufferKey(track.src); loadBuffer(bufKey).then(() => rememberSongBuffer(bufKey)).catch(() => {}); };
  // 長い曲は丸ごと広げない(中身を取ってきたら用意できた扱い。鳴らすときに頭の区切りから広げる)
  const prepareBGM = (key, timeoutMs = 2000) => {
    const track = resolveTrack(key); if (!track) return Promise.resolve(false);
    const bufKey = sceneBufferKey(track.src);
    return Promise.race([loadBuffer(bufKey).then(() => { rememberSongBuffer(bufKey); return true; }).catch((e) => !!(e && e.longEntry)), new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
  };
  const prepareSE = (timeoutMs = 5000) => Promise.race([
    load().then(() => true).catch(() => false),
    new Promise((r) => setTimeout(() => r(false), timeoutMs)),
  ]);
  const playJingle = async (key) => {
    if (!enabled || bgmVolumePct <= 0 || pageHidden || !JINGLE_FILES[key]) return;
    const request = ++bgmRequest;
    try {
      const buffer = await loadBuffer(JINGLE_FILES[key]);
      if (request !== bgmRequest || !enabled || pageHidden) return;
      stopJingles(); stopOthers();
      const ctx = await ensureAudioCtxRunning(); if (!ctx) return;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(bgmGain); jingleSource = source;
      const backToBGM = () => { if (jingleSource !== source) return; stopJingles(); if (currentKey) playBGM(currentKey); };
      source.onended = backToBGM;
      source.start(0);
      jingleTimer = setTimeout(backToBGM, Math.ceil(buffer.duration * 1000) + 250);
    } catch (e) { if (currentKey) playBGM(currentKey); }
  };
  // 音源ファイルの効果音(ボスの必殺技ムービーの音など。2026-09-25)。
  // ★効果音の音量(seBus)を通すので、効果音の音量設定・オンオフがそのまま効く。
  //   読み込みは BGM と同じ loadBuffer(キャッシュキー付き・一度読めば持っておく)。
  //   Tone の再生器で鳴らす(BGM の出口とは別の音の世界なので、そのままつなげない)。
  //   止められるように { stop(秒) } を返す。鳴らせなかったら null
  const preloadSE = (src) => { if (enabled && src) loadBuffer(src).catch(() => {}); };
  // fg … 表の画面の音(事件簿の笑い声など)。裏の周回の効果音を止める印(backgroundSeQuiet)を見ない(fgSe と同じ考え・2026-11-27 r1126-072)
  const playSeFileOn = async (src, fg) => {
    // ボスの登場の音(バトルだけが使う)。MFバトルカードにいるあいだは裏の周回のものなので鳴らさない(下の setBackgroundSeQuiet)
    if (!enabled || !src || (backgroundSeQuiet && !fg)) return null;
    await ensure(); if (!Tone || !seBus) return null;
    let buffer = null;
    try { buffer = await loadBuffer(src); } catch (e) { return null; }
    if (!enabled || pageHidden) return null;
    try {
      const player = new Tone.Player(buffer).connect(seBus);
      let done = false;
      const dispose = () => { if (done) return; done = true; try { player.dispose(); } catch (e) {} };
      player.onstop = dispose;
      player.start();
      const stop = (fadeSec = 0.25) => {
        if (done) return;
        try { player.volume.rampTo(-60, fadeSec); } catch (e) {}
        setTimeout(() => { try { player.stop(); } catch (e) {} dispose(); }, Math.round(fadeSec * 1000) + 60);
      };
      return { stop };
    } catch (e) { return null; }
  };
  const playSeFile = (src) => playSeFileOn(src, false);
  const fgPlaySeFile = (src) => playSeFileOn(src, true);
  // 表へ戻ったら、出口の時計が実時間どおり進んでいるかを確かめる(2026-11-15 r1115-205)。0.4秒後に印を付け、さらに0.9秒後に比べる。
  //   止まっていたら作り直して鳴らし直す(演奏中の曲があるときは作り直さず、次のタップまで待つ)。起こせていなければ、次のタップで作り直す
  let returnHealTimer = null;
  const healAfterReturn = () => {
    if (returnHealTimer) clearTimeout(returnHealTimer);
    const step = (marked) => {
      returnHealTimer = setTimeout(() => {
        returnHealTimer = null;
        const ctx = audioCtx;
        if (pageHidden || !enabled || !ctx) return;
        if (ctx.state !== 'running') { healOnGesture = true; return; }
        if (!marked) { ctxTimeMark = null; ctxClockStalled(); step(true); return; }
        if (!ctxClockStalled()) return;
        if (activeRhythmGains.size) { healOnGesture = true; return; }
        rebuildAudioCtx();
      }, marked ? 900 : 400);
    };
    step(false);
  };
  const setPageHidden = (hidden) => { pageHidden = !!hidden; ctxTimeMark = null; if (pageHidden) { if (returnHealTimer) clearTimeout(returnHealTimer); returnHealTimer = null; ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); } else { if (currentKey) playBGM(currentKey); healAfterReturn(); } };
  const setEnabled = async (on) => { enabled = !!on; if (typeof window !== 'undefined') window.__mhAudioEnabled = enabled; applyRhythmMute(); if (!enabled) { ++bgmRequest; stopPreview(false); stopOthers(); stopJingles(); { const want = nvAmbWant; void nvAmbient('none'); nvAmbWant = want; } } else if (currentKey) playBGM(currentKey); await ensure(); if (enabled) nvAmbientResume(); };
  const isEnabled = () => enabled;
  // いま実際に鳴っている曲を、外(検査)から見るための口。
  // BGMは <audio> ではなく Web Audio (AudioBufferSourceNode) で鳴らしているので、
  // document.querySelectorAll('audio') では1つも見えない。
  // そのため起動まわりの検査(tools/boot/boot-check.js)が「鳴っていない」と誤判定していた
  // (2026-09-05)。プレイヤーの画面には何も出ないし、ゲームの動きも変えない。
  const debugPlayingTracks = () => {
    // 曲キーだけでなく、実際に鳴っている音のファイル名も返す。
    // 検査は「bgm-title で始まる」のようにファイル名で見たいため。
    const entry = (kind, key) => {
      const track = resolveTrack(key);
      const url = String(track?.url || track?.src || '');
      // name … 曲の名前(音量設定の「音が出ないとき」に出す。ファイル名ではプレイヤーに分からないため。2026-10-26)
      return { kind, key: String(key || ''), src: url.split('/').pop().split('?')[0], name: String(track?.name || '') };
    };
    const list = [];
    // 鳴らしているのは同時に1つ(BGM / 試聴 / ジングル のどれか)
    if (jingleSource) list.push(entry('jingle', currentKey));
    else if (previewSource) list.push(entry('preview', previewKey));
    else if (bgmSource) list.push(entry('bgm', bgmSourceKey));
    return { enabled, ctxState: (() => { try { return getAudioCtx()?.state || 'none'; } catch (e) { return 'none'; } })(), playing: list };
  };
  // 「その場面で本来どの曲が鳴るはずか」も外から引けるようにする。
  // 検査がファイル名を書き写すと、既定を変えたときに黙って落ちるため。
  const debugExpectedSrc = (scene) => {
    const track = resolveTrack(DEFAULT_BGM_ARRANGEMENT[scene]);
    const url = String(track?.url || track?.src || '');
    return url ? url.split('/').pop().split('?')[0] : null;
  };
  if (typeof window !== 'undefined') {
    try { window.__mhAudioDebug = debugPlayingTracks; window.__mhAudioExpectedSrc = debugExpectedSrc; } catch (e) {}
  }
  // 「音が出ない」を端末の上で切り分けるための一式(音量設定の「音が出ないとき」から見る)。
  // 画面から呼ぶだけの読み取りなので、ゲームの動きは変えない
  const diagnose = () => {
    const ctx = audioCtx;
    let toneState = 'none';
    if (Tone) { try { toneState = (Tone.getContext && Tone.getContext().state) || 'none'; } catch (e) { toneState = 'none'; } }
    return {
      enabled, pageHidden,
      bgmVolumePct, seVolumePct,
      // 持っている解いた音の数と、そのうち試聴・演奏で読んだ曲の数(直近 SONG_BUFFER_KEEP 曲まで)
      bufferCount: buffers.size, songBufferCount: songBufferOrder.length,
      // 場面のBGMを軽く持っているか(デバッグ設定)と、軽く持っている本数
      bgmLight: bgmLightOn(), lightBufferCount: lightOrder.length,
      lightRates: lightOrder.map(key => { const b = buffers.get(key); return b ? Math.round(b.sampleRate) : 0; }),
      // 持っている曲の名前(古い順)。同じ曲を手放しては読み直していないかを調べるための読み取り
      songBufferNames: songBufferOrder.map(url => String(url).split('/').pop()),
      // 持っている音の大きさ(MB)と、起動してから解いた合計(MB)・回数。同じ曲を手放しては読み直すと、後ろの2つだけが増え続ける
      keptAudioMB: Math.round([...buffers.values()].reduce((sum, b) => sum + bufferBytes(b), 0) / 1048576),
      decodedMB: Math.round(decodedBytes / 1048576), decodeCount: decodedCount,
      ctxState: ctx ? ctx.state : 'none',
      sampleRate: ctx ? Math.round(ctx.sampleRate) : 0,
      // getAudioCtx()を呼ばない(見ただけで出口を作らない)。作る前は判定しようがないので false。
      // 画面を隠しているあいだは時計も止まるので、そこは見ない(戻った直後の誤判定を防ぐ)
      stalled: ctx && !pageHidden ? ctxClockStalled() : false,
      rebuilds: ctxRebuildCount,
      toneLoaded: !!Tone, toneReady: ready, toneState, toneFailed: toneLoadFailed,
      level: outputLevel(),
      playing: debugPlayingTracks().playing,
    };
  };
  // 音が実際に出ているかを外(検査)から確かめるための口。
  // tools/audio/audio-output-check.js が、鳴らしてから音量計の値を読む。
  // プレイヤーの画面には何も出ないし、ゲームの動きも変えない
  if (typeof window !== 'undefined') {
    try { window.__mhAudioDiagnose = () => diagnose(); window.__mhAudioTestTone = () => playTestTone(); } catch (e) {}
  }
  // 設定画面の「音を鳴らし直す」。出口を作り直して、テスト音まで鳴らす
  const repair = async () => {
    if (!enabled) { enabled = true; if (typeof window !== 'undefined') window.__mhAudioEnabled = true; applyRhythmMute(); }
    const rebuilt = await rebuildAudioCtx();
    const ctx = await ensureAudioCtxRunning();
    const beeped = await playTestTone();
    return { rebuilt, beeped, running: !!ctx && ctx.state === 'running' };
  };
  const setUiSeVolume = (pct) => { uiSeVolumePct = pct; if (uiBus && Tone) { try { uiBus.gain.rampTo(_gainFromPct(pct), 0.05); } catch (e) {} } };
  const uiSeVolume = () => uiSeVolumePct; // 検査が「ボタンの音の口が0でないか」を見る口
  const setSeVolume = (pct) => { seVolumePct = pct; if (seBus && Tone) { try { seBus.gain.rampTo(_gainFromPct(pct), 0.05); } catch (e) {} } };
  const setBgmVolume = (pct) => { bgmVolumePct = pct; applyTrackGain(resolveTrack(previewKey || currentKey)); if (pct <= 0) { stopPreview(false); stopOthers(); } else if (enabled && currentKey && !previewKey) playBGM(currentKey); };
  const resumeIfNeeded = async () => { await ensureAudioCtxRunning(); if (Tone) { try { await Tone.start(); started = true; } catch (e) {} } if (enabled && currentKey && !bgmSource) playBGM(currentKey); if (enabled) nvAmbientResume(); };
  const unlock = async (playTestTone = false) => {
    if (!enabled) { enabled = true; if (typeof window !== 'undefined') window.__mhAudioEnabled = true; applyRhythmMute(); }
    // resume・決定SEはuser activationが残るイベント処理内で開始し、最初の再生前に待たない。
    const ctx = resumeAudioCtxNoWait();
    let toneStart = null;
    if (Tone) {
      try { toneStart = Tone.start(); if (toneStart?.catch) toneStart.catch(() => {}); } catch (e) {}
      if (playTestTone && ready && enabled && seVolumePct > 0) {
        try { const tb = new Tone.Synth({ oscillator:{type:'triangle'}, envelope:{attack:0.005,decay:0.15,sustain:0.1,release:0.2}, volume: -6 }).connect(seBus); const now = Tone.now(); tb.triggerAttackRelease('C5','8n', now); tb.triggerAttackRelease('G5','8n', now+0.12); setTimeout(()=>{ try{tb.dispose();}catch(e){} }, 800); } catch(e){}
      }
    }
    await Promise.all([ensureAudioCtxRunning(), toneStart || Promise.resolve(), load()]);
    started = !!Tone;
    if (currentKey) playBGM(currentKey);
    nvAmbientResume(); // 事件簿の環境音: 音が使えるようになる前に頼まれていた物を鳴らし始める(r1126-093 追記4)
    return !ctx || ctx.state === 'running';
  };
  const ensurePlaying = (key) => { if (enabled && key === currentKey && !bgmSource && !jingleSource) playBGM(key); };
  const isContextRunning = () => !!audioCtx && audioCtx.state === 'running';

  // 裏の周回の効果音を止める印(MFバトルカードの画面にいるあいだ。docs/spec/CARD_BATTLE.md 5-3「音」)。
  // カードもバトルも同じ se を使うので、音量(seBus)を0にするとカードの音まで消える。
  // そこで、se.* は印が立っているあいだ何もしない口にし、カードの画面は印を見ない fgSe.* から鳴らす。
  // 音量の保存値・seBus には触らない(手で変えた音量は上書きしない)。
  const setBackgroundSeQuiet = (on) => { backgroundSeQuiet = !!on; };
  const isBackgroundSeQuiet = () => backgroundSeQuiet; // 検査が「裏のバトルの音を止めているか」を見る口(ゲームの動きは変えない)
  const fgSe = {
    trainingDice: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t=Tone.now(); const n=new Tone.NoiseSynth({noise:{type:'brown'},envelope:{attack:.001,decay:.22,sustain:0},volume:-15}).connect(seBus); n.triggerAttackRelease('8n',t); setTimeout(()=>{try{n.dispose();}catch(e){}},500); },
    trainingDecide: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(seBus); s.triggerAttackRelease('C6','16n'); setTimeout(()=>{try{s.dispose();}catch(e){}},300); },
    trainingGood: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({volume:-14}).connect(reverb); s.triggerAttackRelease('E6','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},400); },
    trainingMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.001,decay:.05,sustain:0},volume:-16}).connect(seBus); s.triggerAttackRelease('G5','32n'); setTimeout(()=>{try{s.dispose();}catch(e){}},250); },
    trainingReward: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.003,decay:.15,sustain:0},volume:-12}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('C6','16n',t); s.triggerAttackRelease('E6','16n',t+.08); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingBad: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sawtooth'},envelope:{attack:.003,decay:.18,sustain:0},volume:-15}).connect(seBus); s.triggerAttackRelease('C3','8n'); setTimeout(()=>{try{s.dispose();}catch(e){}},500); },
    trainingTool: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:.003,decay:.2,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); ['G5','B5','D6'].forEach((n,i)=>s.triggerAttackRelease(n,'16n',t+i*.07)); setTimeout(()=>{try{s.dispose();}catch(e){}},600); },
    trainingGoal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.PolySynth(Tone.Synth,{volume:-15}).connect(reverb); s.triggerAttackRelease(['C5','E5','G5','C6'],'2n'); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    trainingFail: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const s=new Tone.Synth({oscillator:{type:'triangle'},envelope:{attack:.01,decay:.5,sustain:0},volume:-13}).connect(reverb); const t=Tone.now(); s.triggerAttackRelease('E4','4n',t); s.triggerAttackRelease('C4','2n',t+.25); setTimeout(()=>{try{s.dispose();}catch(e){}},1200); },
    attack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -4 }).connect(seBus); s.triggerAttackRelease('C2', '8n', t); const n = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -16 }).connect(seBus); n.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 500); },
    special: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const c = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.18, decay: 0.05, sustain: 0.3, release: 0.1 }, volume: -12 }).connect(reverb); c.triggerAttackRelease('C3', '8n.', t); try { c.frequency.rampTo('C4', 0.22, t); } catch (e) {} const bt = t + 0.26; const boom = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -2 }).connect(seBus); boom.triggerAttackRelease('C1', '4n', bt); const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0 }, volume: -12 }).connect(seBus); blast.triggerAttackRelease('8n', bt); const sh = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0.1, release: 0.2 }, volume: -8 }).connect(reverb); ['C5','G5','C6','E6','G6'].forEach((nn, i) => sh.triggerAttackRelease(nn, '32n', bt + i * 0.05)); setTimeout(() => { try { c.dispose(); boom.dispose(); blast.dispose(); sh.dispose(); } catch (e) {} }, 1400); },
    guard: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.18, release: 0.1 }, harmonicity: 5.1, modulationIndex: 16, resonance: 4000, octaves: 1.2, volume: -20 }).connect(seBus); s.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 500); },
    card: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.03 }, volume: -12 }).connect(seBus); s.triggerAttackRelease('E6', '32n', t); s.triggerAttackRelease('A6', '32n', t + 0.04); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 300); },
    crit: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.1, sustain: 0.1, release: 0.15 }, volume: -8 }).connect(reverb); ['C5','E5','G5','C6','E6'].forEach((n, i) => s.triggerAttackRelease(n, '32n', t + i * 0.04)); const b = new Tone.MembraneSynth({ volume: -6 }).connect(seBus); b.triggerAttackRelease('C2', '8n', t); setTimeout(() => { try { s.dispose(); b.dispose(); } catch (e) {} }, 700); },
    zanSlash: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const swish = (st) => { const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -18 }).connect(reverb); n.triggerAttackRelease('32n', st); const p = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 }, volume: -13 }).connect(reverb); p.triggerAttackRelease('C7', '32n', st); try { p.frequency.rampTo('G6', 0.1, st); } catch (e) {} setTimeout(() => { try { n.dispose(); p.dispose(); } catch (e) {} }, 350); }; swish(t); swish(t + 0.09); },
    heal: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -12 }).connect(reverb); ['G4','C5','E5','G5','C6'].forEach((n, i) => s.triggerAttackRelease(n, '16n', t + i * 0.07)); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 900); },
    // 経験値の数え上げの小さな音(2026-11-20 音の点検 F4)。ボタンの音(tap)と分けた、短く軽い粒。間を空けて鳴らすのは呼ぶ側(PlayerRankXpBar)
    xpTick: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }, volume: -20 }).connect(seBus); s.triggerAttackRelease('A6', '128n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); },
    tap: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -16 }).connect(seBus); s.triggerAttackRelease('C6', '64n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); },
    enemyAttack: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -3 }).connect(seBus); s.triggerAttackRelease('A1', '4n', t); const g = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: -12 }).connect(seBus); g.triggerAttackRelease('8n', t); setTimeout(() => { try { s.dispose(); g.dispose(); } catch (e) {} }, 700); },
    enemySpecial: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      // ① 溜め: 下降する不穏なうなり
      const charge = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.25, decay: 0.05, sustain: 0.4, release: 0.1 }, volume: -8 }).connect(seBus);
      charge.triggerAttackRelease('A2', '4n', t); try { charge.frequency.rampTo('A1', 0.4, t); } catch (e) {}
      // ② 大炸裂: 超低音ドゥーン + 金属的インパクト + ホワイトノイズ爆発
      const bt = t + 0.42;
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 8, envelope: { attack: 0.001, decay: 0.6, sustain: 0 }, volume: 2 }).connect(seBus);
      boom.triggerAttackRelease('C1', '2n', bt);
      const metal = new Tone.MetalSynth({ frequency: 120, envelope: { attack: 0.001, decay: 0.5, release: 0.2 }, harmonicity: 3.5, modulationIndex: 32, resonance: 3000, octaves: 1.5, volume: -10 }).connect(seBus);
      metal.triggerAttackRelease('16n', bt);
      const blast = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6 }).connect(seBus);
      blast.triggerAttackRelease('4n', bt);
      // ③ 不穏な残響: 不協和音(半音ぶつけ)
      const dread = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.6 }, volume: -16 }).connect(reverb);
      ['C2','C#2','G2'].forEach(n => dread.triggerAttackRelease(n, '2n', bt + 0.05));
      setTimeout(() => { try { charge.dispose(); boom.dispose(); metal.dispose(); blast.dispose(); dread.dispose(); } catch (e) {} }, 2000); },
    // 必殺技の準備(ためる)の音。上へ登っていくうなりと、集まっていくきらめきだけで、
    // 炸裂音は鳴らさない。必殺技そのものの音(enemySpecial)を使うと
    // 「準備しただけなのに撃たれた」ように聞こえてしまうため分けている
    enemyCharge: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      const hum = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.35, decay: 0.1, sustain: 0.5, release: 0.35 }, volume: -14 }).connect(seBus);
      hum.triggerAttackRelease('A1', '2n', t); try { hum.frequency.rampTo('A2', 0.85, t); } catch (e) {}
      const shimmer = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.1 }, volume: -18 }).connect(reverb);
      [[0.05,'E5'],[0.24,'G5'],[0.43,'B5'],[0.62,'E6'],[0.8,'B6']].forEach(([tt, n]) => shimmer.triggerAttackRelease(n, '16n', t + tt));
      setTimeout(() => { try { hum.dispose(); shimmer.dispose(); } catch (e) {} }, 1600); },
    enemyMove: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 }, volume: -14 }).connect(seBus); s.triggerAttackRelease('E4', '32n', t); s.triggerAttackRelease('B3', '16n', t + 0.06); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 400); },
    join: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.3, release: 0.4 }, volume: -10 }).connect(reverb); const t = Tone.now(); const seq = [[0,'E5','8n'],[0.15,'G5','8n'],[0.3,'C6','8n'],[0.45,'E6','4n'],[0.45,'C6','4n'],[0.45,'G5','4n'],[0.8,'D6','8n'],[0.95,'E6','4n'],[0.95,'C6','4n'],[0.95,'G5','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1800); },
    victory: async () => { if (!enabled) return; await ensure(); if (!Tone) return; stopOthers(null); currentKey = null; const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }, volume: -19 }).connect(reverb); const vb = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 }, volume: -19 }).connect(seBus); const t = Tone.now(); const seq = [[0,'C5','8n'],[0,'E5','8n'],[0,'G5','8n'],[0.18,'C5','8n'],[0.18,'E5','8n'],[0.18,'G5','8n'],[0.36,'C5','8n'],[0.36,'E5','8n'],[0.36,'G5','8n'],[0.54,'G5','4n'],[0.54,'C6','4n'],[0.54,'E6','4n'],[0.9,'F5','8n'],[0.9,'A5','8n'],[1.08,'G5','8n'],[1.08,'B5','8n'],[1.26,'C6','2n'],[1.26,'E6','2n'],[1.26,'G6','2n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); [[0,'C3'],[0.54,'C3'],[0.9,'F2'],[1.08,'G2'],[1.26,'C3']].forEach(([tt, n]) => vb.triggerAttackRelease(n, '4n', t + tt)); setTimeout(() => { try { v.dispose(); vb.dispose(); } catch (e) {} }, 2600); },
    levelUp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -12 }).connect(reverb); const seq = [[0,'C5','16n'],[0.08,'E5','16n'],[0.16,'G5','16n'],[0.24,'C6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const sp = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.4 }, volume: -16 }).connect(reverb); sp.triggerAttackRelease('C6', '2n', t + 0.24); setTimeout(() => { try { v.dispose(); sp.dispose(); } catch (e) {} }, 1200); },
    // ランクが上がったときのファンファーレ(2026-10-29 社長「毎回ファンファーレを鳴らす」)。曲は止めない(victory のように stopOthers をしない)。
    // rankFanfare … ふつうのランクアップ(短い)/ rankFanfareGrand … 帯が変わるとき(10・20・30・50。長く豪華)
    rankFanfare: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.35, release: 0.35 }, volume: -18 }).connect(reverb); [[0,'G4','16n'],[0.1,'C5','16n'],[0.2,'E5','16n']].forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); v.triggerAttackRelease(['C5','E5','G5','C6'], '4n', t + 0.32); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 1600); },
    rankFanfareGrand: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.6 }, volume: -18 }).connect(reverb); [[0,'C5','16n'],[0.09,'C5','16n'],[0.18,'C5','16n'],[0.3,'G4','8n'],[0.48,'A4','8n'],[0.66,'B4','8n']].forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); v.triggerAttackRelease(['C5','E5','G5','C6'], '2n', t + 0.84); const bell = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.8 }, volume: -14 }).connect(reverb); [[0.84,'C7'],[0.96,'G6'],[1.08,'E7']].forEach(([tt, n]) => bell.triggerAttackRelease(n, '8n', t + tt)); setTimeout(() => { try { v.dispose(); bell.dispose(); } catch (e) {} }, 3000); },
    // モンヒロサクセスの友情タッグのカットイン(2026-11-14 社長「友情タッグのときは、特別な演出や効果音を入れて」)。約1.2秒:
    // シュッと横切る風 → 2つの声が重なって上がる和音 → きらめくベルの「キラーン」
    // 2026-11-18 社長「友情タッグはSEも激しく」で、ベルの瞬間に低音の衝撃と砕ける音を重ね、ベルをもう1打(少し高く・小さく)足した
    friendTag: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now();
      const sw = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.04, decay: 0.22, sustain: 0 }, volume: -16 }).connect(seBus); sw.triggerAttackRelease('8n', t);
      const duo = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.2 }, volume: -13 }).connect(reverb);
      [[0.12, ['C5', 'E5']], [0.24, ['E5', 'G5']], [0.36, ['G5', 'C6']]].forEach(([tt, ns]) => duo.triggerAttackRelease(ns, '16n', t + tt));
      const riser = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.09, decay: 0.08, sustain: 0 }, volume: -19 }).connect(seBus); riser.triggerAttackRelease('16n', t + 0.38);
      const bell = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.3 }, volume: -11 }).connect(reverb);
      bell.triggerAttackRelease(['C6', 'E6', 'G6', 'C7'], '4n', t + 0.5);
      const boom = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.32, sustain: 0 }, volume: -7 }).connect(seBus); boom.triggerAttackRelease('C2', '8n', t + 0.5);
      const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.26, sustain: 0 }, volume: -15 }).connect(reverb); crash.triggerAttackRelease('8n', t + 0.5);
      const bell2 = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.25 }, volume: -14 }).connect(reverb);
      bell2.triggerAttackRelease(['E6', 'G6', 'C7', 'E7'], '8n', t + 0.68);
      setTimeout(() => { try { sw.dispose(); duo.dispose(); riser.dispose(); bell.dispose(); boom.dispose(); crash.dispose(); bell2.dispose(); } catch (e) {} }, 2200); },
    // 合体演出用: 上昇アルペジオ→(両者が重なるタイミングで)ベルの一撃+きらめき和音の「ピカーン」
    fusion: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.5 }, volume: -10 }).connect(reverb); const seq = [[0,'C5','8n'],[0.12,'E5','8n'],[0.24,'G5','8n'],[0.36,'C6','8n'],[0.48,'E6','4n']]; seq.forEach(([tt, n, d]) => v.triggerAttackRelease(n, d, t + tt)); const bt = t + 0.6; const bell = new Tone.MetalSynth({ frequency: 800, envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 5000, octaves: 1.5, volume: -14 }).connect(reverb); bell.triggerAttackRelease('16n', bt); const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.5 }, volume: -12 }).connect(reverb); ['C6','E6','G6','C7'].forEach((n, i) => sparkle.triggerAttackRelease(n, '8n', bt + i * 0.03)); setTimeout(() => { try { v.dispose(); bell.dispose(); sparkle.dispose(); } catch (e) {} }, 2200); },
    // ===== 事件簿(ミステリーノベル)の効果音(2026-11-28 社長「ところどころのSEをもっと雰囲気出して」・台帳 r1126-093 追記2) =====
    //   どれも小さく、低く暗い音。その場で合成する(音源ファイルなし・権利の心配なし)。効果音の音量(seBus)を通る
    //   nvTick … 柱時計のチク(high)/タク。選択肢を待つ間に繰り返す。BGM とぶつからないよう、とても小さく短い
    nvTick: async (high) => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: high ? 640 : 470, envelope: { attack: 0.001, decay: 0.035, release: 0.02 }, harmonicity: 3.1, modulationIndex: 10, resonance: high ? 3800 : 3000, octaves: 0.8, volume: -12 }).connect(seBus); s.triggerAttackRelease('64n', t); const k = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -20 }).connect(seBus); k.triggerAttackRelease(high ? 'C4' : 'G3', '64n', t); setTimeout(() => { try { s.dispose(); k.dispose(); } catch (e) {} }, 300); },
    //   nvCreak … 扉・床のきしみ「ギィ」(低いのこぎり波が、ゆっくり下がる)
    nvCreak: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter(1800, 'lowpass').connect(seBus); const s = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.7, sustain: 0, release: 0.2 }, volume: -8 }).connect(f); s.triggerAttackRelease('D4', '4n', t); try { s.frequency.rampTo('G3', 0.7, t); } catch (e) {} setTimeout(() => { try { s.dispose(); f.dispose(); } catch (e) {} }, 1400); },
    //   nvThud … 重い物の落ちる・ぶつかる「ゴッ」(遠くのこもった低音。enemyAttack より小さく遠い)
    nvThud: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.002, decay: 0.35, sustain: 0 }, volume: -6 }).connect(seBus); s.triggerAttackRelease('E2', '8n', t); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.15, sustain: 0 }, volume: -8 }).connect(seBus); n.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 800); },
    //   nvWind … 吹雪の風「ゴォォ……」(こもった雑音がふくらんで消える・2.5秒)
    nvWind: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter({ frequency: 700, type: 'bandpass', Q: 0.7 }).connect(seBus); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.9, decay: 0.4, sustain: 0.6, release: 1.2 }, volume: 0 }).connect(f); n.triggerAttackRelease(1.2, t); try { f.frequency.rampTo(1500, 0.9, t); f.frequency.rampTo(600, 1.4, t + 0.9); } catch (e) {} setTimeout(() => { try { n.dispose(); f.dispose(); } catch (e) {} }, 3200); },
    //   nvFire … 暖炉の薪がはぜる「パチ……パチ」(小さな粒がまばらに)
    nvFire: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter(1800, 'bandpass').connect(seBus); const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 }, volume: -8 }).connect(f); [0, 0.21, 0.37, 0.8, 1.05, 1.5].forEach((d) => n.triggerAttackRelease('64n', t + d)); setTimeout(() => { try { n.dispose(); f.dispose(); } catch (e) {} }, 2100); },
    //   nvRustle … 紙・封・布のこすれる「カサ」
    nvRustle: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter(2600, 'highpass').connect(seBus); const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.01, decay: 0.12, sustain: 0 }, volume: -14 }).connect(f); n.triggerAttackRelease('16n', t); n.triggerAttackRelease('32n', t + 0.14); setTimeout(() => { try { n.dispose(); f.dispose(); } catch (e) {} }, 600); },
    //   nvGlass … 窓ガラス・物の割れる「カシャ」(低めの金属の響き)
    nvGlass: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MetalSynth({ frequency: 260, envelope: { attack: 0.001, decay: 0.32, release: 0.1 }, harmonicity: 7.1, modulationIndex: 20, resonance: 3200, octaves: 1, volume: -12 }).connect(reverb); s.triggerAttackRelease('16n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 900); },
    //   nvDread … 不穏な一音(低い2音の半音のぶつかりが、ゆっくり消える)。声・悲鳴・倒れた人が見つかった所
    nvDread: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const v = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.35, decay: 0.6, sustain: 0.4, release: 1.6 }, volume: -10 }).connect(reverb); v.triggerAttackRelease(['C3', 'C#3', 'G3'], 1.1, t); setTimeout(() => { try { v.dispose(); } catch (e) {} }, 3600); },
    //   nvMusicBox … オルゴールの子守歌(高い音を、小さく、ゆっくり下がる短調の4音)
    nvMusicBox: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.6 }, volume: -14 }).connect(reverb); [[0, 'E5'], [0.42, 'D5'], [0.84, 'C5'], [1.4, 'A4']].forEach(([d, n]) => s.triggerAttackRelease(n, '4n', t + d)); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 3200); },
    //   r1126-093 追記3: 足音(nvStep)・駆ける足音(nvRun)・殴られる(nvHit)・倒れる(nvFall)・悲鳴の手前の息(nvGasp)・扉(nvDoor)・吹き込む風(nvGust)
    nvStep: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.002, decay: 0.09, sustain: 0 }, volume: -6 }).connect(seBus); const sf = new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 1.2 }).connect(seBus); const sc = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.05, sustain: 0 }, volume: -4 }).connect(sf); [0, 0.55, 1.1].forEach((d, i) => { s.triggerAttackRelease(i % 2 ? 'A2' : 'G2', '32n', t + d); sc.triggerAttackRelease('64n', t + d); }); setTimeout(() => { try { s.dispose(); sc.dispose(); sf.dispose(); } catch (e) {} }, 1700); },
    nvRun: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.002, decay: 0.07, sustain: 0 }, volume: -6 }).connect(seBus); const sf = new Tone.Filter({ frequency: 1500, type: 'bandpass', Q: 1.2 }).connect(seBus); const sc = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.002, decay: 0.05, sustain: 0 }, volume: -4 }).connect(sf); [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((d, i) => { s.triggerAttackRelease(i % 2 ? 'A2' : 'G2', '32n', t + d); sc.triggerAttackRelease('64n', t + d); }); setTimeout(() => { try { s.dispose(); sc.dispose(); sf.dispose(); } catch (e) {} }, 1500); },
    nvHit: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.015, octaves: 3, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -2 }).connect(seBus); s.triggerAttackRelease('C3', '16n', t); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: 2 }).connect(seBus); n.triggerAttackRelease('64n', t); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 600); },
    nvFall: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const s = new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 4, envelope: { attack: 0.003, decay: 0.5, sustain: 0 }, volume: -4 }).connect(seBus); s.triggerAttackRelease('D2', '4n', t); s.triggerAttackRelease('C2', '8n', t + 0.18); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0 }, volume: -2 }).connect(seBus); n.triggerAttackRelease('8n', t + 0.05); setTimeout(() => { try { s.dispose(); n.dispose(); } catch (e) {} }, 1200); },
    nvGasp: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter(1400, 'bandpass').connect(seBus); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.12, decay: 0.18, sustain: 0, release: 0.08 }, volume: 4 }).connect(f); n.triggerAttackRelease(0.16, t); try { f.frequency.rampTo(2200, 0.25, t); } catch (e) {} setTimeout(() => { try { n.dispose(); f.dispose(); } catch (e) {} }, 800); },
    nvDoor: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const m = new Tone.MetalSynth({ frequency: 180, envelope: { attack: 0.001, decay: 0.05, release: 0.02 }, harmonicity: 3.1, modulationIndex: 8, resonance: 2500, octaves: 0.5, volume: -14 }).connect(seBus); m.triggerAttackRelease('64n', t); const f = new Tone.Filter(1800, 'lowpass').connect(seBus); const s = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.05, decay: 0.45, sustain: 0, release: 0.15 }, volume: -10 }).connect(f); s.triggerAttackRelease('A3', '8n', t + 0.08); try { s.frequency.rampTo('E3', 0.45, t + 0.08); } catch (e) {} setTimeout(() => { try { m.dispose(); s.dispose(); f.dispose(); } catch (e) {} }, 1200); },
    nvGust: async () => { if (!enabled) return; await ensure(); if (!Tone) return; const t = Tone.now(); const f = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 0.7 }).connect(seBus); const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.25, decay: 0.5, sustain: 0.2, release: 0.6 }, volume: 2 }).connect(f); n.triggerAttackRelease(0.6, t); try { f.frequency.rampTo(2000, 0.3, t); f.frequency.rampTo(700, 0.9, t + 0.3); } catch (e) {} setTimeout(() => { try { n.dispose(); f.dispose(); } catch (e) {} }, 2000); },
  };
  // ===== 事件簿の環境音(ずっと小さく鳴る・r1126-093 追記3「BGM は静かか音無しにして SE で表現」) =====
  //   kind: 'wind'(外の風)/ 'blizzard'(吹雪)/ 'fire'(暖炉)/ 'clock'(柱時計のチク・タク)/ 'room'(部屋のかすかなすきま風)/ 'none'
  //   替えるときは前の音を 1.2 秒で小さくしてから捨て、新しい音を 1.5 秒で大きくする(つなぎ目なく替わる)。効果音の音量(seBus)を通る。
  //   同じ kind なら何もしない。続けて呼ばれても、いちばんあとの kind だけが鳴る(待っている間に替わった物は作らない)
  let nvAmb = { kind: 'none', stop: null };
  let nvAmbWant = 'none'; // 頼まれている環境音(音がまだ使えず鳴らせなかった物も覚えておき、nvAmbientResume で鳴らし直す)
  const nvAmbient = async (kindIn) => {
    const kind = kindIn || 'none';
    nvAmbWant = kind;
    if (kind === nvAmb.kind) return;
    const prev = nvAmb; const me = { kind, stop: null }; nvAmb = me;
    if (prev.stop) { try { prev.stop(); } catch (e) {} }
    if (kind === 'none') return;
    if (!enabled) { nvAmb = { kind: 'none', stop: null }; return; } // 音がまだ使えない: 鳴らせなかったので「鳴っていない」に戻す(あとで鳴らし直せるように)
    await ensure();
    if (nvAmb !== me) return;
    if (!Tone || !enabled) { nvAmb = { kind: 'none', stop: null }; return; }
    const nodes = []; const timers = [];
    try {
      const g = new Tone.Gain(0).connect(seBus); nodes.push(g);
      // 2026-11-28 r1126-093 追記4: 前の作りは -74〜-89dB と小さく、音の大半がスマホのスピーカーで出ない 300Hz より下だった(社長「無音になってる？」)。
      //   大きさを上げ、帯域を 400〜2000Hz 寄り(スピーカーで聞こえる高さ)へ移した。目安: 効果音の音量が初期値のとき、ボタンの音と同じくらいに聞こえる
      if (kind === 'wind' || kind === 'blizzard' || kind === 'room') {
        const n = new Tone.Noise(kind === 'room' ? 'brown' : 'pink'); n.volume.value = kind === 'blizzard' ? 4 : kind === 'wind' ? 1 : 2;
        const f = new Tone.Filter({ frequency: kind === 'blizzard' ? 900 : kind === 'wind' ? 650 : 450, type: 'bandpass', Q: 0.7 });
        const lfo = new Tone.LFO(kind === 'blizzard' ? 0.21 : kind === 'wind' ? 0.09 : 0.05, kind === 'blizzard' ? 450 : kind === 'wind' ? 380 : 320, kind === 'blizzard' ? 2000 : kind === 'wind' ? 1300 : 650);
        n.connect(f); f.connect(g); lfo.connect(f.frequency); n.start(); lfo.start(); nodes.push(n, f, lfo);
      }
      if (kind === 'fire') {
        const n = new Tone.Noise('brown'); n.volume.value = -2; const f = new Tone.Filter({ frequency: 420, type: 'bandpass', Q: 0.8 }); n.connect(f); f.connect(g); n.start(); nodes.push(n, f);
        const bp = new Tone.Filter(2400, 'bandpass').connect(g); const c = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 }, volume: -6 }).connect(bp); nodes.push(bp, c);
        const pop = () => { if (nvAmb !== me) return; if (enabled) { try { c.triggerAttackRelease('64n'); } catch (e) {} } timers.push(setTimeout(pop, 140 + Math.random() * 620)); };
        timers.push(setTimeout(pop, 300));
      }
      if (kind === 'clock') {
        const m = new Tone.MetalSynth({ frequency: 600, envelope: { attack: 0.001, decay: 0.05, release: 0.03 }, harmonicity: 3.1, modulationIndex: 12, resonance: 3600, octaves: 0.8, volume: -12 }).connect(g);
        const k = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -20 }).connect(g); nodes.push(m, k);
        let high = true;
        const tick = () => { if (nvAmb !== me || !enabled) return; try { m.frequency.value = high ? 640 : 470; m.triggerAttackRelease('64n'); k.triggerAttackRelease(high ? 'C4' : 'G3', '64n'); } catch (e) {} high = !high; };
        timers.push(setInterval(tick, 1000));
      }
      try { g.gain.rampTo(1, 1.5); } catch (e) { g.gain.value = 1; }
      me.stop = () => {
        timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
        try { g.gain.rampTo(0, 1.2); } catch (e) { g.gain.value = 0; }
        setTimeout(() => { nodes.forEach((x) => { try { if (x.stop) x.stop(); } catch (e) {} try { x.dispose(); } catch (e) {} }); }, 1400);
      };
    } catch (e) { nodes.forEach((x) => { try { x.dispose(); } catch (e2) {} }); if (nvAmb === me) nvAmb = { kind: 'none', stop: null }; }
  };
  const nvAmbientResume = () => { if (nvAmbWant !== 'none' && nvAmb.kind !== nvAmbWant) void nvAmbient(nvAmbWant); };
  // ボタンのタップ音(音は fgSe.tap と同じ。通る口だけが uiBus)。全体ミュート(enabled)には従う。裏のバトルの音を止める印は見ない
  const uiTap = async () => { if (!enabled) return; await ensure(); if (!Tone || !uiBus) return; const t = Tone.now(); const s = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }, volume: -16 }).connect(uiBus); s.triggerAttackRelease('C6', '64n', t); setTimeout(() => { try { s.dispose(); } catch (e) {} }, 200); };
  const se = Object.fromEntries(Object.entries(fgSe).map(([name, play]) => [name, (...args) => (backgroundSeQuiet ? Promise.resolve() : play(...args))]));

  const setVideoHold = (on) => {
    videoHold = !!on;
    if (!masterOut || !audioCtx) return;
    try {
      const at = audioCtx.currentTime;
      masterOut.gain.cancelScheduledValues(at);
      masterOut.gain.setValueAtTime(masterOut.gain.value, at);
      masterOut.gain.linearRampToValueAtTime(videoHold ? 0 : 1, at + 0.25);
    } catch (e) { masterOut.gain.value = videoHold ? 0 : 1; }
  };
  // お話の締め(終わりの札)のあいだ、BGM も効果音もゆっくり小さくする(2026-11-03 社長「最後のページが終わるとあっけない」)。
  //   on で 2.5秒かけて 0 へ、off で 0.25秒で元へ。予告動画の setVideoHold と同じ出口(masterOut)を使う
  const setStoryEndFade = (on) => {
    if (!masterOut || !audioCtx) return;
    try {
      const at = audioCtx.currentTime;
      masterOut.gain.cancelScheduledValues(at);
      masterOut.gain.setValueAtTime(masterOut.gain.value, at);
      masterOut.gain.linearRampToValueAtTime(on || videoHold ? 0 : 1, at + (on ? 2.5 : 0.25));
    } catch (e) { masterOut.gain.value = on || videoHold ? 0 : 1; }
  };
  // お話の始まり(題字の幕開け)では、音を 0 から 2秒かけて上げる(2026-11-04)。終わりの札(setStoryEndFade)と対
  const setStoryOpenFade = () => {
    if (!masterOut || !audioCtx || videoHold) return;
    try {
      const at = audioCtx.currentTime;
      masterOut.gain.cancelScheduledValues(at);
      masterOut.gain.setValueAtTime(0, at);
      masterOut.gain.linearRampToValueAtTime(1, at + 2);
    } catch (e) { masterOut.gain.value = 1; }
  };
  // お知らせ・ヘルプの動画にかける音量(2026-11-14 社長「予告動画の音が設定の音量と関係なく鳴る」)。
  // 動画は曲と同じ扱いにして、BGM の音量と同じ曲線(_gainFromPct)で返す。音を切っている・BGM が 0 なら 0
  const videoGain = () => (enabled && bgmVolumePct > 0 ? _gainFromPct(bgmVolumePct) : 0);
  return { nvAmbient, currentBgmKey: () => currentKey, isBackgroundSeQuiet, setVideoHold, videoGain, setStoryEndFade, setStoryOpenFade, playSeFile, fgPlaySeFile, preloadSE, playBGM, fadeToBGM, stopBGM, setBgmOnce, startRhythmTrack, previewBGM, stopPreview, setEnabled, isEnabled, setSeVolume, setUiSeVolume, uiSeVolume, uiTap, setBgmVolume, unlock, resumeIfNeeded, setPageHidden, preloadBGM, prepareBGM, prepareSE, playJingle, ensurePlaying, isContextRunning, diagnose, playTestTone, repair, se, fgSe, setBackgroundSeQuiet };
})();
