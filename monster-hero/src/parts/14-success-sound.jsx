// =====================================================================
// モンヒロサクセスの音を鳴らす口(2026-11-12 開発部)
// 割り当て表は data/success-sounds.js。ここは「場面の id を渡すと、表どおりに曲と効果音を鳴らす」だけ。
// 画面(回2・回3)は SuccessSound.* か useSuccessSound を呼ぶ。Audio_ を直接触らない。
//
// ★守っていること(tools/success/success-sound-check.js が見張る)
//   ・使う Audio_ は playBGM / stopBGM / fgSe / isEnabled / currentBgmKey / setBackgroundSeQuiet だけ。
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

  const audio = () => (typeof Audio_ !== 'undefined' ? Audio_ : null);
  const knownTrack = (id) => !!(id && typeof BGM_TRACK_BY_ID !== 'undefined' && BGM_TRACK_BY_ID[id]);
  const tableOk = () => typeof successSoundBgm === 'function' && typeof successSoundSe === 'function';

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
    active = false; epoch += 1;
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
    if (key === curBgm) return key;
    curBgm = key;
    try { a.playBGM(key); } catch (e) {}
    return key;
  };

  // 場面の効果音を1回鳴らす。delayMs で待たせたあと、画面を離れていたら鳴らさない
  const se = (sceneId, delayMs = 0) => {
    const a = audio(); if (!a || !active || !tableOk()) return null;
    const name = successSoundSe(sceneId);
    if (!name || !a.fgSe || typeof a.fgSe[name] !== 'function') return null;
    const my = epoch;
    const fire = () => { if (!active || my !== epoch) return; try { a.fgSe[name](); } catch (e) {} };
    const wait = Number(delayMs);
    if (Number.isFinite(wait) && wait > 0) { setTimeout(fire, Math.min(wait, 10000)); } else { fire(); }
    return name;
  };

  // 場面に入った合図(曲 + 効果音)。画面は場面が替わるたびにこれを1回呼ぶ
  const scene = (sceneId, opts = null) => {
    if (!active) enter();
    const season = opts && opts.season;
    bgm(sceneId, season);
    se(sceneId, opts && opts.delayMs);
  };

  return { enter, leave, scene, bgm, se, isActive: () => active };
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
