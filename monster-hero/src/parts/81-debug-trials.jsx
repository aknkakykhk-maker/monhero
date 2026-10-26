// ===== 確認待ちの試作(デバッグ設定のいちばん上・2026-10-16 社長「新しいのを確認するのも分かりやすくしないと探すのが大変すぎる」) =====
// 社長に iPhone で確かめてほしい試作だけを、デバッグ設定を開いてすぐの所に並べる。
// ★試作を足すときは DEBUG_TRIALS に1行足すだけ。並び・NEW の印・入/切のボタン・いまの状態は下の部品が作る。
//   ・added … 足した日(JST・'YYYY-MM-DD')。新しいものほど上
//   ・key / on … 入/切を覚える localStorage のキーと「入」の値(切はキーを消す)。試作の本体が読むキーと同じにする
//   ・title / note / when … 名前・何が変わるか1行・いつから効くか
// ★確認が済んで既定に入れたら、その行を消す(一覧から外す)。キーそのものは本体の決まりのとおり残す(SAVE_DATA.md)。
// NEW の印は「まだ一度も入/切を押していない試作」に付く(押した試作は mh_debug_trials_seen_v1 に覚える)。
// デバッグ専用(更新履歴・ヘルプに載せない)。判定・セーブデータの中身には触らない
const DEBUG_TRIALS = [
  // 2026-10-27 モンスターノーツのかくつきの犯人さがし。1曲の中のモンスターノーツごとに演出を1つずつ止め、止めた物を記録(stats.mon の i.ab)に控える。
  // 同じキーの値 '1' と '2'。どちらも見た目と音だけで、判定・スコア・ライフ・能力の効き目は変わらない
  { id: 'rhythm_mon_ab1', added: '2026-10-27', area: 'モンヒロビート', key: 'mh_rhythm_mon_ab_v1', on: '1',
    title: '🎵 モンスターノーツのかくつき調べ(1)',
    note: 'モンスターノーツを取ったときの演出を、1回目は跳ね・2回目は能力名・3回目は光の輪だけ出さず、4回目はいつもどおりにします。マスモン4体で遊ぶと、どの回にかくついたかが記録に残ります',
    when: '次の演奏から' },
  { id: 'rhythm_mon_ab2', added: '2026-10-27', area: 'モンヒロビート', key: 'mh_rhythm_mon_ab_v1', on: '2',
    title: '🎵 モンスターノーツのかくつき調べ(2)',
    note: 'モンスターノーツを取ったときの演出を、1回目は金色の光・2回目は音・3回目はカットインだけ出さず、4回目は全部出しません。マスモン4体で遊ぶと、どの回にかくついたかが記録に残ります',
    when: '次の演奏から' },
  // 2026-10-16 社長「モンスターノーツでかくつくの直ってない」。見た目は変わらない。入と切で同じ曲を1回ずつ遊ぶと、記録(stats.mon)で比べられる
  { id: 'rhythm_mon_layers', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_mon_layers_v1', on: 'on',
    title: '🎵 モンスターノーツのかくつきの手当て',
    note: 'モンスターノーツを取ったときに大きくなる両サイドのマスモンと光の輪を、曲の前から用意しておきます(見た目は変わりません)。入と切で同じ曲を1回ずつ遊ぶと、どちらがかくつかないかを記録で比べられます',
    when: '次の演奏から' },
  { id: 'bgm_light', added: '2026-10-16', area: '音', key: 'mh_bgm_light_v1', on: 'on',
    title: '🔊 場面のBGMを軽く持つ',
    note: 'タイトル・ホーム・バトルなどの BGM を軽くして(少しこもることがあります)、持つ曲を2本までにします。長く遊んだときのメモリ不足の手当てです。モンヒロビートの曲・効果音は変わりません',
    when: '次に BGM が切り替わったときから' },
  { id: 'rhythm_floor3d', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_floor3d_proto_v1', on: 'on',
    title: '🎵 床と空中の見た目',
    note: '地上のノーツを道の床に平たく貼り付け、空中のノーツを厚みのある箱にして床に影を落とします。判定の位置・時刻・指の扱いは変わりません',
    when: '次の演奏から' },
  // 試作2(同じキーの別の値。入れると試作1は切になる・切はどちらもキーを消す)
  { id: 'rhythm_floor3d2', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_floor3d_proto_v1', on: 'on2',
    title: '🎵 床と空中の見た目(試作2)',
    note: '色を抜いても高さで見分けられるように、空中のノーツの真下の床に濃い影と白い導線を出し、箱を宙に立てます。空中スライドは床の影と帯の下の薄い幕で浮いたリボンにします。判定は変わりません',
    when: '次の演奏から' },
  // 試作3(2026-10-16 社長「全然だめだね。もっと立体感出せないの？」)。同じキーの値 on3
  { id: 'rhythm_floor3d3', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_floor3d_proto_v1', on: 'on3',
    title: '🎵 床と空中の見た目(試作3・立体)',
    note: '空中の層を道と同じ遠近のガラスの床として見せ、道の両端に床と空中をつなぐ柱を立てます。空中のノーツは厚い立方体、空中スライドは厚みのある管に。床にはっきりした影。色・判定は変わりません',
    when: '次の演奏から' },
  // 案3の2段目(2026-10-16)。同じキーの値 c3b。道の遠近と押す場所の計算を一緒に替える
  { id: 'rhythm_floor3d_c3b', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_floor3d_proto_v1', on: 'c3b',
    title: '🎵 空中の見た目(案3+カメラを寝かせる)',
    note: '案3の見た目に加えて、カメラを寝かせて道を奥へ深くします(遠くのノーツは小さく、手前で速く近づきます)。押す場所も同じ計算でそろって変わるので、見た目と押す場所はずれません。判定の時刻・色は変わりません',
    when: '次の演奏から' },
  // 案3の1段目(2026-10-16 社長「案3までやる」)。同じキーの値 c3。2段目(カメラを寝かせる)はこのあと
  { id: 'rhythm_floor3d_c3', added: '2026-10-16', area: 'モンヒロビート', key: 'mh_rhythm_floor3d_proto_v1', on: 'c3',
    title: '🎵 空中の見た目(案3・明るい板と光の帯)',
    note: '空中のタップを明るく薄い板と光る縁に、空中スライドを白い芯から手の色がにじむ半透明の光の帯にします(参考動画の見やすさに寄せた見た目)。地上と道は今のまま。色・判定は変わりません',
    when: '次の演奏から' },
  // 段階A(値 a3d)は 2026-10-17 に普通の設定「空中のノーツの見た目」へ移した(RHYTHM_SKY_NOTE_LOOK)ので、ここから外した
];
const DEBUG_TRIALS_SEEN_KEY = 'mh_debug_trials_seen_v1';
// タクティクスのヘイト・モンスターのタイプ表記(表と式は 32-tactics-units.jsx)。2026-10-18 に公開し、試作の一覧から外した。
// いまは公開の印 RELEASE_FLAGS.tacticsHate だけで決まる(試作のときのキー mh_tactics_hate_proto_v1 / mh_monster_type_proto_v1 は読まない・消さない)
const tacticsHateProtoOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.tacticsHate === true;
const monsterTypeProtoOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.tacticsHate === true;
const debugTrialRead = (trial) => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(trial.key) === trial.on; } catch (e) { return false; } };
const debugTrialWrite = (trial, on) => { try { if (on) localStorage.setItem(trial.key, trial.on); else localStorage.removeItem(trial.key); } catch (e) {} return debugTrialRead(trial); };
const debugTrialsSeen = () => { try { const v = JSON.parse(localStorage.getItem(DEBUG_TRIALS_SEEN_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
const debugTrialsMarkSeen = (id) => { try { const seen = debugTrialsSeen(); if (!seen.includes(id)) localStorage.setItem(DEBUG_TRIALS_SEEN_KEY, JSON.stringify([...seen, id].slice(-100))); } catch (e) {} };
// まだ押していない(NEW)ものを上、そのあと足した日の新しい順
const debugTrialsOrdered = (seen) => DEBUG_TRIALS.map((t, i) => ({ t, i, fresh: !seen.includes(t.id) }))
  .sort((a, b) => (Number(b.fresh) - Number(a.fresh)) || String(b.t.added).localeCompare(String(a.t.added)) || (a.i - b.i)).map((x) => ({ ...x.t, fresh: x.fresh }));

// onChange … 入/切を押したあとに呼ぶ(本体の画面が同じキーを覚えている state を読み直すため)
function DebugTrialsPanel({ onChange }) {
  const [, setTick] = useState(0);
  const seen = debugTrialsSeen();
  const list = debugTrialsOrdered(seen);
  if (!list.length) return null;
  const toggle = (trial, on) => { debugTrialWrite(trial, on); debugTrialsMarkSeen(trial.id); setTick((n) => n + 1); try { if (onChange) onChange(trial, on); } catch (e) {} };
  return (
    <section data-debug-trials className="rounded-2xl border-2 border-lime-400/60 bg-lime-950/30 p-3">
      <h3 className="text-[12px] font-black text-lime-200">🧪 確認待ちの試作<small className="ml-1 text-[9px] font-bold text-lime-100/70">({list.length})</small></h3>
      <p className="mt-0.5 text-[9px] font-bold leading-relaxed text-lime-100/75">iPhone で確かめてほしい試作です。「入」にして遊び、気になる所があれば「切」で元に戻せます。新しいものほど上に出ます。</p>
      <div className="mt-2 space-y-2">
        {list.map((trial) => {
          const on = debugTrialRead(trial);
          return (
            <div key={trial.id} data-debug-trial={trial.id} data-debug-trial-on={on ? '1' : '0'} data-debug-trial-new={trial.fresh ? '1' : undefined} className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <b className="block text-[12px] font-black text-white">{trial.fresh && <span data-debug-trial-new-badge className="mr-1 rounded bg-rose-500 px-1 py-px align-middle text-[8px] font-black text-white">NEW</span>}{trial.title}</b>
                  <small className="mt-0.5 block text-[9px] font-bold text-slate-400">{trial.area}・{trial.added}・{trial.when}</small>
                </div>
                <span data-debug-trial-state className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${on ? 'bg-lime-400 text-slate-900' : 'bg-slate-700 text-slate-200'}`}>いま {on ? '入' : '切'}</span>
              </div>
              <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-300">{trial.note}</p>
              <div className="mt-2 flex gap-2">
                {[[true, '入'], [false, '切']].map(([value, label]) => (
                  <button key={label} type="button" data-debug-trial-set={value ? 'on' : 'off'} aria-pressed={on === value} onClick={() => toggle(trial, value)}
                    className={`min-h-[40px] flex-1 rounded-xl text-[12px] font-black active:scale-95 ${on === value ? 'bg-lime-400 text-slate-900' : 'border border-white/20 bg-slate-900 text-slate-200'}`}>{label}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
