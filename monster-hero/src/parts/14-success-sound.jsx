// =====================================================================
// モンヒロサクセスの音を鳴らす口(2026-11-12 開発部)
// 割り当て表は data/success-sounds.js。ここは「場面の id を渡すと、表どおりに曲と効果音を鳴らす」だけ。
// 画面(回2・回3)は SuccessSound.* か useSuccessSound を呼ぶ。Audio_ を直接触らない。
// 効果音は「意味」で鳴らす(SuccessSound.sfx('matchGo') など。意味の表は data/success-sounds.js の SUCCESS_SFX)。fgSe の名前を画面に書かない(2026-11-19 r1119 ①音)
//
// ★守っていること(tools/success/success-sound-check.js が見張る)
//   ・使う Audio_ は playBGM / stopBGM / fgSe / isEnabled / currentBgmKey / setBackgroundSeQuiet / ensurePlaying(いまの曲が止まっていたら鳴らし直すだけ)だけ。
//     音量(setSeVolume・setBgmVolume)・消音(setEnabled)・モンヒロビートの再生(startRhythmTrack)・1回だけ流す曲(setBgmOnce)には触らない
//   ・効果音は fgSe(表の画面の音)から鳴らす。音量・消音は Audio_ 側がそのまま効く
//   ・画面を離れる(leave / useSuccessSound の後片付け)と、待たせていた効果音を捨て、入る前に鳴っていた曲へ戻す
//   ・サクセスの画面にいるあいだ、裏の周回(クイック)のバトルの効果音は止める(setBackgroundSeQuiet)。
//     60-app.jsx の同じ印の effect に successScreenOpen も足すこと(回2・回3。足さないと別の画面の都合で印が外れる)
// =====================================================================
const SuccessSound = (() => {
  let active = false;      // 画面に入っていて、まだ離れていない
  let epoch = 0;           // 入り直すたびに進める。古い呼び出し(待たせた効果音)を捨てる
  let beforeKey = null;    // 入る前に鳴っていた曲(離れるときに戻す)
  let beforeQuiet = false; // 入る前の「裏の音を止める印」
  let curBgm = null;       // いまサクセスが流している曲
  let onceKey = null;      // 1回だけ流す曲(勝ち負けのジングル)を流し始めた曲と時刻。ジングルのあとへ曲をつなぐのに使う(r1115-091)
  let onceAt = 0;
  let laterTimer = null;   // ジングルが終わるのを待っている場面

  const audio = () => (typeof Audio_ !== 'undefined' ? Audio_ : null);
  const knownTrack = (id) => !!(id && typeof BGM_TRACK_BY_ID !== 'undefined' && BGM_TRACK_BY_ID[id]);
  const tableOk = () => typeof successSoundBgm === 'function' && typeof successSoundSe === 'function';
  const sceneOf = (id) => (typeof successSoundScene === 'function' ? successSoundScene(id) : null);

  // 画面に入る。入る前の曲と印を覚える。二重に入っても1回ぶんだけ覚える
  const enter = () => {
    const a = audio(); if (!a) return;
    if (active) return;
    active = true; epoch += 1; curBgm = null;
    try { beforeKey = a.currentBgmKey ? a.currentBgmKey() : null; } catch (e) { beforeKey = null; }
    try { beforeQuiet = a.isBackgroundSeQuiet ? !!a.isBackgroundSeQuiet() : false; if (a.setBackgroundSeQuiet) a.setBackgroundSeQuiet(true); } catch (e) {}
  };

  // 画面を離れる。待たせた効果音を捨て、印を元に戻し、サクセスが替えた曲だけ入る前の曲へ戻す
  const leave = () => {
    const a = audio();
    if (!active) return;
    active = false; epoch += 1; clearLater(); onceKey = null;
    if (!a) { curBgm = null; return; }
    try { if (a.setBackgroundSeQuiet) a.setBackgroundSeQuiet(beforeQuiet); } catch (e) {}
    const wasMine = curBgm !== null;
    curBgm = null;
    if (wasMine) {
      try {
        if (beforeKey && knownTrack(beforeKey)) a.playBGM(beforeKey);
        else a.stopBGM();
      } catch (e) {}
    }
    beforeKey = null;
  };

  // 場面の曲を流す(曲を替えない場面・同じ曲が鳴っているときは何もしない)。消音・音量0は Audio_.playBGM が見る
  const bgm = (sceneId, season) => {
    const a = audio(); if (!a || !active || !tableOk()) return null;
    const key = successSoundBgm(sceneId, season);
    if (!key || !knownTrack(key)) return null;
    // 覚えている曲と、実際に流れている曲(Audio_ の currentBgmKey)が食い違っていたら、同じ場面でも鳴らし直す(r1115-048)
    let now = key; try { now = a.currentBgmKey ? a.currentBgmKey() : key; } catch (e) {}
    if (key === curBgm && now === key) return key;
    curBgm = key;
    clearLater();
    const t = typeof BGM_TRACK_BY_ID !== 'undefined' ? BGM_TRACK_BY_ID[key] : null;
    if (t && t.loop === false) { onceKey = key; onceAt = Date.now(); } else { onceKey = null; }
    try { a.playBGM(key); } catch (e) {}
    return key;
  };
  const clearLater = () => { if (laterTimer) { clearTimeout(laterTimer); laterTimer = null; } };

  // 場面の曲が確かに鳴っているようにする(試合の曲の見張り。r1115-048)。違う曲なら鳴らし直し、同じ曲で止まっていれば(読み込みの失敗など)鳴らし直す。
  //   ジングルが鳴っているあいだは触らない(ジングルが終わると Audio_ がいまの曲=この曲へ戻す)
  const keep = (sceneId, season) => {
    const a = audio(); if (!a || !active || !tableOk()) return null;
    const key = successSoundBgm(sceneId, season);
    if (!key || !knownTrack(key)) return null;
    let now = null; try { now = a.currentBgmKey ? a.currentBgmKey() : null; } catch (e) {}
    curBgm = key;
    if (now !== key) { try { a.playBGM(key); } catch (e) {} return key; }
    try { if (a.ensurePlaying) a.ensurePlaying(key); } catch (e) {}
    return key;
  };

  // 効果音を1回鳴らす(fgSe の名前)。delayMs で待たせたあと、画面を離れていたら鳴らさない
  //   needActive … モンサクの画面に入っているときだけ鳴らす(場面の音)。sfx はモンサクの外(助手マスモン対戦の試合の部品)からも呼ぶので偽
  const fireSe = (name, delayMs, needActive) => {
    const a = audio(); if (!a) return null;
    if (needActive && !active) return null;
    if (!name || !a.fgSe || typeof a.fgSe[name] !== 'function') return null;
    const my = epoch; const wasActive = active;
    const fire = () => { if ((wasActive || needActive) && (!active || my !== epoch)) return; try { a.fgSe[name](); } catch (e) {} };
    const wait = Number(delayMs);
    if (Number.isFinite(wait) && wait > 0) { setTimeout(fire, Math.min(wait, 10000)); } else { fire(); }
    return name;
  };
  // 場面の効果音を1回鳴らす(場面の表の mean を意味の表で引く)
  const se = (sceneId, delayMs = 0) => {
    if (!tableOk()) return null;
    return fireSe(successSoundSe(sceneId), delayMs, true);
  };
  // 意味で効果音を1回鳴らす(SUCCESS_SFX の id)。モンサクの画面・部品はこれを使い、fgSe の名前を書かない
  const sfx = (meaning, delayMs = 0) => {
    if (typeof successSfxSe !== 'function') return null;
    return fireSe(successSfxSe(meaning), delayMs, false);
  };

  // 勝ち負けのジングルが鳴っている途中なら、鳴り終わってから場面に入る(エンディングの曲。r1115-091)。鳴っていなければすぐ入る
  // 戻り値は「この予約を取り消す関数」。画面が離れたら呼び出し側(useSuccessSceneAfterOnce の後片付け)がこれで予約を消す。
  // 自分のタイマーだけを消す(あとから別の予約に差し替わっていたら、そちらは消さない)
  const ONCE_MS = 7200; // ジングルの長さ(勝ち 6.9秒・負け 6.9秒)より少し長く
  const sceneAfterOnce = (sceneId, opts = null) => {
    if (!active) enter();
    clearLater();
    const a = audio();
    let now = null; try { now = a && a.currentBgmKey ? a.currentBgmKey() : null; } catch (e) {}
    const rest = onceKey && now === onceKey ? onceAt + ONCE_MS - Date.now() : 0;
    if (!(rest > 0)) { playScene(sceneId, opts, true); return () => {}; }
    // ジングルが鳴っているあいだに入った場面は、ジングルのあとに曲だけ替える(効果音はジングルと重ねない・点検 Q-1-6)
    const my = epoch;
    const timer = setTimeout(() => { if (laterTimer === timer) laterTimer = null; if (active && my === epoch) playScene(sceneId, opts, false); }, Math.min(rest, ONCE_MS));
    laterTimer = timer;
    return () => { if (laterTimer === timer) { clearTimeout(timer); laterTimer = null; } };
  };

  // 場面に入った合図(曲 + 効果音)。画面は場面が替わるたびにこれを1回呼ぶ
  // 場面が替わったら、ジングル後の予約はもう要らないので消す(古い画面のタイマーが移動先の曲を上書きしない)
  //   表で afterJingle の場面(期の区切り)は、ジングルが鳴っている途中なら sceneAfterOnce と同じに待つ
  const scene = (sceneId, opts = null) => {
    const sc = sceneOf(sceneId);
    if (sc && sc.afterJingle) { sceneAfterOnce(sceneId, opts); return; }
    playScene(sceneId, opts, true);
  };
  const playScene = (sceneId, opts, withSe) => {
    if (!active) enter();
    clearLater();
    const season = opts && opts.season;
    bgm(sceneId, season);
    if (withSe) se(sceneId, opts && opts.delayMs);
  };

  return { enter, leave, scene, sceneAfterOnce, bgm, keep, se, sfx, isActive: () => active };
})();

// モンサクの画面の内側(育成中・修行・大会・引退など)で使う入り口。sceneId が替わるたびに場面の曲と効果音を鳴らすだけで、
// 消えても後片付け(leave)はしない。後片付けはモンサクの画面全体(MonheroSuccessScreen)の useSuccessSound の1か所だけ。
// 内側で useSuccessSound を使うと、その画面を出るたびに入る前の曲へ一度戻ってから鳴り直し、育成中の曲が途切れる(2026-11-14 社長)
//   useSuccessScene(sceneId, { season, delayMs }) … sceneId が null のあいだは何もしない(いまの曲のまま)
const useSuccessScene = (sceneId, opts = null) => {
  const season = opts && opts.season;
  const delayMs = opts && opts.delayMs;
  useEffect(() => {
    if (!sceneId) return undefined;
    SuccessSound.scene(sceneId, { season, delayMs });
    return undefined;
  }, [sceneId, season]);
};
// useSuccessScene と同じだが、勝ち負けのジングルが鳴っている途中なら鳴り終わってから曲を替える(エンディング。r1115-091)
// 画面が消えたら、sceneAfterOnce の返す取消関数で予約を取り消す(離れた画面の遅延再生が残らない)
const useSuccessSceneAfterOnce = (sceneId, opts = null) => {
  const season = opts && opts.season;
  useEffect(() => {
    if (!sceneId) return undefined;
    return SuccessSound.sceneAfterOnce(sceneId, { season });
  }, [sceneId, season]);
};
// 画面の中で使う入り口。sceneId が替わるたびに鳴らし、画面を離れる(消える)と後片付けする。
//   useSuccessSound(sceneId, { season, delayMs, on })  … on が false のあいだは何もしない(既定は true)
const useSuccessSound = (sceneId, opts = null) => {
  const on = !opts || opts.on !== false;
  const season = opts && opts.season;
  const delayMs = opts && opts.delayMs;
  useEffect(() => {
    if (!on || !sceneId) return undefined;
    SuccessSound.scene(sceneId, { season, delayMs });
    return undefined;
  }, [on, sceneId, season]);
  useEffect(() => {
    if (!on) return undefined;
    return () => { SuccessSound.leave(); };
  }, [on]);
};
