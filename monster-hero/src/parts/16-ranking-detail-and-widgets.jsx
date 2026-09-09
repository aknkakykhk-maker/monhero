// ランキングの記録に載せる部位別の色を作る。
// colors は「何番目の部位か」を位置で表す配列なので、空きを詰めてはいけない。
// 詰めると ["青", 未設定, "青"] が ["青","青"] になり、2番目の部位まで染まって
// 3番目が元の色のまま残る(実際の染色と違う色でランキングに出る)。
// 部位数ぶんの長さに揃え、未設定は null で埋めて位置を保つ。
const rankingPartyColors = (baseId, colors) => {
  const raw = Array.isArray(colors) ? colors : [];
  return Array.from({ length: dyeRegionCount(baseId) }, (_, i) => raw[i] || null);
};
// ランキングの記録に載せる「マスモンの詳細」。編成の詳細から1体ずつ、育て方まで見られるようにする。
// 記録が重くならないよう、表示に必要な最小限だけを送る。技の中身はどの端末も同じデータを
// 持っているので、継承した固有技も元のモンスターIDとレベルだけ送り、見る側で組み立て直す
// (1体あたり数百バイト。以前ここへ画像を入れて読み込みが終わらなくなったことがあるため、
//  「同梱してあるもの(絵・技のデータ)は送らない」という方針を守る)。
// ===== 合体履歴 =====
// 実際に保存されているのは executeMasuFusion が積む
//   { subName, subBaseId, subBondLevel, xpGained, inherited, timestamp }
// の6項目だけ。ここではそれを表示できる形へそろえるだけで、無い項目は null のままにする
// (推測で埋めると「実際には残っていない履歴」を作ってしまう)。
// 継承した固有技そのものは履歴に持っていないが、継承したのは必ず相手の種の固有技なので、
// 主が持っている inheritedUniques から同じ種のものを探し、無ければ種の固有技を出す。
const normalizeFusionHistory = (masu) => {
  const raw = Array.isArray(masu?.fusionHistory) ? masu.fusionHistory : [];
  const inheritedList = Array.isArray(masu?.inheritedUniques) ? masu.inheritedUniques : [];
  const posNum = (v) => (Number.isFinite(Number(v)) && Number(v) > 0) ? Math.floor(Number(v)) : null;
  return raw.map((entry, index) => {
    const e = (entry && typeof entry === 'object') ? entry : {};
    const subBaseId = (typeof e.subBaseId === 'string' && ALL_PLAYER_MONSTERS[e.subBaseId]) ? e.subBaseId : null;
    const subName = (typeof e.subName === 'string' && e.subName.trim()) ? e.subName.trim() : null;
    const inherited = e.inherited === true;
    let inheritedUnique = null;
    if (inherited && subBaseId) {
      // 主が今も持っている継承技のうち、同じ種から来たもの。見つかればそのときの名前・Lvが分かる
      const owned = inheritedList.find(u => u && u.monId === subBaseId && (!subName || !u.sourceMasuName || u.sourceMasuName === subName))
        || inheritedList.find(u => u && u.monId === subBaseId);
      inheritedUnique = owned || ALL_PLAYER_MONSTERS[subBaseId]?.unique || null;
    }
    const subBondLevel = posNum(e.subBondLevel);
    const xpGained = posNum(e.xpGained);
    const timestamp = posNum(e.timestamp);
    return {
      order: index + 1,                 // 何回目の合体か(古いほうが1)
      subName, subBaseId,
      subBaseName: subBaseId ? ALL_PLAYER_MONSTERS[subBaseId].name : null,
      subBondLevel, xpGained, inherited, inheritedUnique, timestamp,
      // 中身のある履歴かどうか。合体回数しか残っていない古いランキング記録は
      // 「{}」が回数ぶん並ぶだけなので、それを架空の履歴として描かないための目印
      hasDetail: !!(subBaseId || subName || subBondLevel != null || xpGained != null || timestamp != null),
    };
  });
};
const fusionHistoryHasDetail = (list) => Array.isArray(list) && list.some(h => h && h.hasDetail);
// 記録に載せる合体履歴の上限。1件60バイト前後なので、ここを外すと4体ぶんで記録が一気に重くなる。
// 実際の合体回数は fusionCount にそのまま残すので、上限を超えても回数は正しく出せる
const RANKING_FUSION_MAX = 12;
// v1: 育て方(ステータス・間合い適性・固有技Lv)＋合体回数だけ
// v2: 記録時点の総合力(power)と、合体履歴の中身(fusion)を追加。v1の項目はそのまま残す
// v3: 転生回数、v4: 保存済みの転生育成ボーナスと合体継承回数を追加
// v5: 超越(transcended とその強化ぶん)を追加。
//     ここが抜けていたため、ランキング一覧は絆Lv.410なのに「詳細」を開くと
//     Lv.400/400 MAX になる、という食い違いが出ていた。レベル上限は
//     masuLevelCapLimit() が「超越済みなら500、未超越なら400」で決めるので、
//     記録から組み立て直した個体に超越の印が無いと未超越として400へ丸められる。
//     同じ理由で超越強化で振ったぶんのステータスも詳細に出ていなかった。
const RANKING_DETAIL_VERSION = 6;
const rankingMasuDetail = (masu) => {
  if (!masu) return null;
  const sp = masu.statPoints || {};
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const inherited = (Array.isArray(masu.inheritedUniques) ? masu.inheritedUniques : []).map((unique, index) => {
    const monId = unique && unique.monId;
    if (!monId) return null;
    return { monId, level: resolveInheritedUniqueLevel(masu, unique, index) };
  }).filter(Boolean);
  return {
    v: RANKING_DETAIL_VERSION,
    name: typeof masu.name === 'string' ? masu.name.slice(0, 24) : null,
    bondXp: num(masu.bondXp),
    rebirthCount: num(masu.rebirthCount),
    // 転生回数。詳細の上部サマリーで「転生 +N」を出すのに要る
    reincarnateCount: num(masu.reincarnateCount),
    reincarnateBonusPoints: ownReincarnateBonusPoints(masu),
    inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(masu),
    inheritedReincarnateCount: inheritedReincarnateCountOf(masu),
    levelCap: num(masu.levelCap) || null,
    // 超越(v5)。levelCap だけでは足りない。超越済みかどうかでレベル上限そのものが
    // 400/500 と変わるため、印が無いと Lv.400 へ丸められてしまう
    transcended: isTranscended(masu),
    transcendPoints: num(masu.transcendPoints),
    transcendStatPoints: normalizeTranscendStatPoints(masu.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(masu.transcendAptBoosts),
    // 魂格(v6)。未使用Pは保存せず、記録時の段階・全振り分け・使用済みPだけ固定する。
    soulRankStage: normalizeSoulRankStage(masu.soulRankStage),
    soulTraitLevels: normalizeSoulTraitLevels(masu.soulTraitLevels),
    soulSpentPoints: soulTraitSpentPoints(masu),
    statPoints: { hp: num(sp.hp), atk: num(sp.atk), def: num(sp.def), guts: num(sp.guts) },
    // 間合い適性は「グレードの文字」の配列(['C','M','C','C'] など)。数値ではないので
    // 数に直そうとすると全部0になり、ランキング側だけ全距離Cに見えてしまう
    distApt: Array.isArray(masu.distApt) ? masu.distApt.slice(0, 4).map(g => DIST_APTITUDE_GRADES.includes(g) ? g : 'C') : null,
    distAptPoints: num(masu.distAptPoints),
    uniqueLevel: num(masu.uniqueSkillLevels?.own),
    inherited,
    fusionCount: Array.isArray(masu.fusionHistory) ? masu.fusionHistory.length : 0,
    // 記録した時点の総合力。あとで種のバランスを変えても、過去の記録の数字が動かないようにする。
    // 計算は必ず共通の monsterPowerOf を通す(ランキング専用の式は作らない)
    power: (() => { const p = monsterPowerOf(mergeMasuIntoMon(masu)); return Number.isFinite(p) && p > 0 ? p : null; })(),
    // 合体履歴。技の中身・絵はどの端末も持っているので、相手の種のIDだけ送って見る側で組み立てる。
    // 空の項目は入れない(1件でも小さくするため)。新しいほうを残したいので後ろから切り出す
    fusion: normalizeFusionHistory(masu).filter(h => h.hasDetail).slice(-RANKING_FUSION_MAX).map(h => {
      const out = {};
      if (h.subBaseId) out.b = h.subBaseId;
      if (h.subName) out.n = h.subName.slice(0, 12);
      if (h.subBondLevel != null) out.l = h.subBondLevel;
      if (h.xpGained != null) out.x = h.xpGained;
      if (h.inherited) out.i = 1;
      if (h.timestamp != null) out.t = Math.floor(h.timestamp / 1000); // 秒で持つ(ミリ秒は要らない)
      return out;
    }),
  };
};
// 記録の詳細を、モンスター詳細の表示に使う「マスモン相当」の形へ戻す。
// 壊れた記録・知らないモンスターが入っていても落ちないよう、すべて既定値へ倒す。
const rankingDetailToMasu = (baseId, detail, colors) => {
  if (!detail || typeof detail !== 'object' || !baseId) return null;
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const sp = detail.statPoints || {};
  const uniqueSkillLevels = { own: num(detail.uniqueLevel) };
  const inheritedUniques = [];
  (Array.isArray(detail.inherited) ? detail.inherited : []).forEach((entry) => {
    const source = ALL_PLAYER_MONSTERS[entry && entry.monId]?.unique;
    if (!source) return; // 知らないモンスターの技は出せないので飛ばす(位置は詰めて数え直す)
    uniqueSkillLevels[`inh:${inheritedUniques.length}`] = num(entry.level);
    inheritedUniques.push({ ...source, monId: entry.monId, evoLevel: num(entry.level) });
  });
  return {
    id: null,
    baseId,
    name: (typeof detail.name === 'string' && detail.name.trim()) ? detail.name : (ALL_PLAYER_MONSTERS[baseId]?.name || 'マスモン'),
    bondXp: num(detail.bondXp),
    rebirthCount: num(detail.rebirthCount),
    // 転生回数はv3から。持っていない古い記録は0になる(転生していない扱い)
    reincarnateCount: num(detail.reincarnateCount),
    reincarnateBonusPoints: Number.isFinite(Number(detail.reincarnateBonusPoints)) ? num(detail.reincarnateBonusPoints) : totalReincarnatePoints(detail.reincarnateCount),
    inheritedReincarnateBonusPoints: num(detail.inheritedReincarnateBonusPoints),
    inheritedReincarnateCount: num(detail.inheritedReincarnateCount),
    levelCap: num(detail.levelCap) || INITIAL_MASU_LEVEL_CAP,
    // 超越はv5から。持っていない古い記録は未超越として読む(これまでと同じ見え方のまま)
    transcended: detail.transcended === true,
    transcendPoints: num(detail.transcendPoints),
    transcendStatPoints: normalizeTranscendStatPoints(detail.transcendStatPoints),
    transcendAptBoosts: normalizeTranscendAptBoosts(detail.transcendAptBoosts),
    // 魂格はv6から。旧記録は魂格なし・特性なしとして安全に読む。
    soulRankStage: normalizeSoulRankStage(detail.soulRankStage),
    soulTraitLevels: normalizeSoulTraitLevels(detail.soulTraitLevels),
    soulSpentPointsSnapshot: Number.isFinite(Number(detail.soulSpentPoints)) ? num(detail.soulSpentPoints) : 0,
    statPoints: { hp: num(sp.hp), atk: num(sp.atk), def: num(sp.def), guts: num(sp.guts) },
    // グレード以外(数値へ潰してしまった古い記録など)が入っていたら、その記録には
    // 間合い適性が残っていないものとして扱う。nullにしておけば血統本来の適性が出るので、
    // 「全距離C」という実際には存在しない姿を作り出さずに済む
    distApt: (Array.isArray(detail.distApt) && detail.distApt.length === 4 && detail.distApt.every(g => DIST_APTITUDE_GRADES.includes(g))) ? [...detail.distApt] : null,
    distAptPoints: num(detail.distAptPoints),
    uniqueSkillLevels,
    inheritedUniques,
    // 合体履歴。v2の記録には中身(fusion)が入っている。
    // 中身が無いv1の記録では「回数ぶんの空の項目」だけを置き、履歴の中身は作らない。
    // ここで適当な相手や日時を作ってしまうと、実際には残っていない履歴を見せることになる
    fusionHistory: (() => {
      const raw = Array.isArray(detail.fusion) ? detail.fusion : [];
      const restored = raw.map((e) => {
        if (!e || typeof e !== 'object') return {};
        const t = num(e.t);
        return {
          subName: typeof e.n === 'string' ? e.n : undefined,
          subBaseId: typeof e.b === 'string' ? e.b : undefined,
          subBondLevel: num(e.l) || undefined,
          xpGained: num(e.x) || undefined,
          inherited: e.i === 1 || e.i === true,
          timestamp: t ? t * 1000 : undefined,
        };
      });
      if (restored.length > 0) return restored;
      return Array.from({ length: num(detail.fusionCount) }, () => ({}));
    })(),
    // 記録に残っている合体回数。上限で切った記録でも「全何回か」はこちらで分かる
    fusionRecordedCount: num(detail.fusionCount),
    // 記録した時点の総合力。無い(v1)なら null。0は「総合力0」ではなく「記録が無い」なので入れない
    powerSnapshot: (Number.isFinite(Number(detail.power)) && Number(detail.power) > 0) ? Math.round(Number(detail.power)) : null,
    colors: Array.isArray(colors) ? colors : [],
  };
};
// 限界突破の★。並びと色は breakthroughStars が保存値(rebirthCount)から組み立てる
const renderBreakthroughStar = (star, key, props = {}) => star.image
  ? <img key={key} src={star.image} alt="" className="mh-rainbow-breakthrough-star" {...props}/>
  : <span key={key} style={breakthroughStarStyle(star)} {...props}>★</span>;
const RebirthStars = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  const stars = breakthroughStars(value);
  if (!stars.length) return null;
  const final = isFinalBreakthroughCount(value);
  return <span className={`mh-rebirth-stars ${className}`} aria-label={final ? `最終限界突破(${value}回)` : `限界突破${value}回`}>{stars.map((s,i)=>renderBreakthroughStar(s,i))}</span>;
};
const breakthroughDebugInfo = (count) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  const levelCap = breakthroughLevelCap(value);
  if (!value) return { levelCap, label:'★なし' };
  if (value > BREAKTHROUGH_MAX_COUNT) return { levelCap, label:`虹${value-BREAKTHROUGH_MAX_COUNT}+金${FINAL_BREAKTHROUGH_COUNT-value}`, multiplier:levelUpPointMultiplier(value) };
  return { levelCap, label:BREAKTHROUGH_STAR_TIERS[Math.floor((value - 1) / BREAKTHROUGH_STARS_PER_TIER)].label };
};
const BreakthroughStarDebugCard = ({ count, compact = false }) => {
  const info = breakthroughDebugInfo(count);
  return <article className={`min-w-0 rounded-xl border bg-slate-900/90 text-center ${compact?'border-amber-400/50 p-2':'border-white/10 p-3'}`} data-breakthrough-star-debug-count={count}>
    <b className="block text-[11px] text-white">{count}凸</b>
    <span className="block text-[8px] text-slate-400">上限Lv{info.levelCap}</span>
    {info.multiplier>1&&<span className="block text-[8px] font-black text-amber-300">LvUPボーナス×{info.multiplier}</span>}
    <span className="block text-[9px] font-black text-amber-200">{info.label}</span>
    <div className="mt-2 min-h-[12px] flex items-center justify-center"><RebirthStars count={count}/>{count===0&&<span className="text-[8px] text-slate-600">★なし</span>}</div>
  </article>;
};
// 転生の回数プレート。詳細画面など、回数を確認する場所だけで使う。
// モーション軽減設定。CSS側は @media(prefers-reduced-motion:reduce) で止めるが、
// JS側の演出の長さもここで短くする(読み取れない環境では通常どおり)。
const prefersReducedMotion = () => {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
};
// 超越済みであることを示す共通マーク。モンスターの絵(まるく切り抜いてある)に重ならないよう、
// 丸の外側になる右上の角へ置く。角は丸の外なので、染色した絵をマークが隠さない。
// 虹★・転生バッジは絵の下なので、そちらとも重ならない。
// 画像は増やさず、CSSのグラデーションと「超」の文字だけで作る。
const SOUL_RANK_BADGE_LABELS = Object.freeze(['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ']);
const TranscendenceBadge = ({ transcended = false, soulRankStage = 0, className = '', small = false }) => {
  const stage = normalizeSoulRankStage(soulRankStage);
  if (stage > 0) {
    const label = SOUL_RANK_BADGE_LABELS[stage];
    return <span className={`mh-soul-rank-badge is-stage-${stage}${small ? ' is-small' : ''} ${className}`} aria-label={`魂格${label}`}><b aria-hidden="true">{label}</b></span>;
  }
  if (!transcended) return null;
  return <span className={`mh-transcend-badge${small ? ' is-small' : ''} ${className}`} aria-label="超越済み"><b aria-hidden="true">超</b></span>;
};
const ReincarnateBadge = ({ count = 0, className = '' }) => {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (!value) return null;
  return <div className={`mh-reincarnate-badge ${className}`} aria-label={`転生${value}回`}>転生 ×{value}</div>;
};
// 一覧・詳細・HOME・演出で共有する魂格オーラ。
const SOUL_RANK_AURA_IMAGES = {
  1: 'images/effects/soul-rank-aura-blue.PNG',
  2: 'images/effects/soul-rank-aura-yellow.PNG',
  3: 'images/effects/soul-rank-aura-green.PNG',
  4: 'images/effects/soul-rank-aura-red.PNG',
  5: 'images/effects/soul-rank-aura-rainbow.PNG',
};
const SOUL_RANK_AURA_TONES = { 1:'blue', 2:'yellow', 3:'green', 4:'red', 5:'rainbow' };
const SoulRankAura = ({ soulRankStage = 0, className = '' }) => {
  const stage = normalizeSoulRankStage(soulRankStage);
  if (!stage) return null;
  const tone = SOUL_RANK_AURA_TONES[stage];
  const src = SOUL_RANK_AURA_IMAGES[stage];
  return <span className={`mh-reincarnate-aura is-${tone} ${className}`} aria-hidden="true">
    <span className="mh-reincarnate-flame is-back"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-flame is-main"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-flame is-foot"><img src={src} alt=""/></span>
    <span className="mh-reincarnate-sparks"/>
  </span>;
};
// HOME中央の安全領域だけを歩くマスモン。HOMEから外れるとコンポーネントごと破棄され、
// visibilitychangeでもタイマーを止めるため、画面遷移やバックグラウンド復帰で処理が重複しない。
const HomeWalkingMasumon = ({ masu, base, masuColors, index = 0, count = 1 }) => {
  // 個体ごとに開始位置と速度係数を固定し、再描画で動き方が跳ねないようにする。
  const laneCenter = count <= 1 ? 50 : 12 + (76 * index / Math.max(1, count - 1));
  const speedFactor = 0.9 + ((index * 17) % 5) * 0.045;
  const [motion, setMotion] = useState({ x: laneCenter, y: 24 + (index % 3) * 22, facing: index % 2 ? -1 : 1, walking: false, duration: 0 });
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const motionRef = useRef(motion);
  useEffect(() => {
    mountedRef.current = true;
    const clearMotionTimer = () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; } };
    const scheduleWalk = (delay = 550 + Math.random() * 1050 + index * 90) => {
      clearMotionTimer();
      timerRef.current = setTimeout(() => {
        if (!mountedRef.current || document.visibilityState === 'hidden') return;
        const current = motionRef.current;
        // 横方向は個体ごとの緩いレーンを持たせ、5体が同じ場所に居続けるのを避ける。
        const laneWidth = count <= 1 ? 84 : 30;
        const x = Math.max(6, Math.min(94, laneCenter + (Math.random() - 0.5) * laneWidth));
        const y = 10 + Math.random() * 80;
        const distance = Math.hypot(x - current.x, y - current.y);
        const duration = Math.max(2100, Math.min(4800, (1850 + distance * 32) * speedFactor));
        const next = { x, y, facing: x < current.x ? -1 : 1, walking: true, duration };
        motionRef.current = next;
        setMotion(next);
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          const stopped = { ...motionRef.current, walking: false };
          motionRef.current = stopped;
          setMotion(stopped);
          scheduleWalk(750 + Math.random() * 1750 + index * 110);
        }, duration);
      }, delay);
    };
    const onVisibilityChange = () => {
      clearMotionTimer();
      if (document.visibilityState === 'hidden') {
        const stopped = { ...motionRef.current, walking: false };
        motionRef.current = stopped;
        setMotion(stopped);
      } else scheduleWalk(350);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.visibilityState !== 'hidden') scheduleWalk();
    return () => { mountedRef.current = false; clearMotionTimer(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [masu.id, index, count]);
  return <div className={`mh-home-masumon ${motion.walking ? 'is-walking' : ''}`} style={{left:`${motion.x}%`,top:`${motion.y}%`,zIndex:Math.round(motion.y),transitionDuration:`${motion.duration}ms`}}>
    <div className="mh-home-masumon-bob" style={{transform:`scaleX(${motion.facing})`,isolation:'isolate'}}>
      <DyedMonsterImage baseId={masu.baseId} src={base.imgUrl || base.iconUrl} alt="" masuColors={masuColors} draggable={false}/>
      <ReincarnateAura count={masu.reincarnateCount} className="is-home"/>
      <RebirthStars count={masu.rebirthCount} className="mh-home-masumon-stars"/>
    </div>
  </div>;
};
// 染色もどきの「カスタム」色選択: 色相バー(1本)+彩度・明度パッド(正方形)で任意の色を選べる
// 自前のスペクトラムピッカー。端末のOS標準カラーピッカー(<input type="color">)はiOS/Android/PCで
// 見た目も操作感もバラバラで、アプリのテーマにも合わせられず自動テストもできないため使わず、
// 既存のVolumeSliderと同じくpointerdown/move/upでドラッグを自前実装している
const CustomColorPicker = ({ h, s, v, onChange }) => {
  const squareRef = useRef(null);
  const hueRef = useRef(null);
  const [dragTarget, setDragTarget] = useState(null); // 'square'|'hue'|null
  const updateFromSquare = (clientX, clientY) => {
    const el = squareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(h, ns, nv);
  };
  const updateFromHue = (clientX) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nh = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    onChange(nh, s, v);
  };
  useEffect(() => {
    if (!dragTarget) return;
    const onMove = (e) => { if (dragTarget === 'square') updateFromSquare(e.clientX, e.clientY); else updateFromHue(e.clientX); };
    const onUp = () => setDragTarget(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragTarget, h, s, v]);
  const [pr, pg, pb] = _hsvToRgb(h, s, v);
  const previewColor = `rgb(${pr},${pg},${pb})`;
  const [hr, hg, hb] = _hsvToRgb(h, 1, 1);
  const pureHueColor = `rgb(${hr},${hg},${hb})`;
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={squareRef}
        onPointerDown={(e) => { setDragTarget('square'); updateFromSquare(e.clientX, e.clientY); }}
        className="relative w-full aspect-square rounded-2xl cursor-pointer touch-none overflow-hidden border border-white/10"
        style={{ backgroundColor: pureHueColor, backgroundImage: 'linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0))' }}
      >
        <div
          className="absolute rounded-full border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: '20px', height: '20px', transform: 'translate(-50%,-50%)', backgroundColor: previewColor }}
        ></div>
      </div>
      <div
        ref={hueRef}
        onPointerDown={(e) => { setDragTarget('hue'); updateFromHue(e.clientX); }}
        className="relative w-full h-6 rounded-full cursor-pointer touch-none"
        style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
      >
        <div
          className="absolute top-1/2 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_6px_rgba(0,0,0,0.8)]"
          style={{ left: `${(h / 360) * 100}%`, width: '18px', height: '18px', transform: 'translate(-50%,-50%)' }}
        ></div>
      </div>
    </div>
  );
};
// SE/BGM音量調整用スライダー(0〜100、ドラッグ操作+微調整用の±ボタン)
const VolumeSlider = ({ label, icon, value, onChange, onInteractStart, gradient, thumbRing }) => {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const valueFromClientX = (clientX) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return value;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => onChange(valueFromClientX(e.clientX));
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);
  const startDrag = (e) => {
    onInteractStart && onInteractStart();
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  };
  const step = (delta) => { onInteractStart && onInteractStart(); onChange(Math.max(0, Math.min(100, value + delta))); };
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-9 shrink-0 flex flex-col items-center gap-0.5">
        <span className="text-xs leading-none">{icon}</span>
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none">{label}</span>
      </div>
      <button onClick={()=>step(-1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">−</button>
      <div ref={trackRef} onPointerDown={startDrag} className="relative flex-1 h-2 rounded-full bg-slate-800 border border-white/10 cursor-pointer touch-none">
        <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${gradient}`} style={{width:`${value}%`}}></div>
        <div className={`absolute top-1/2 rounded-full bg-white border-2 ${thumbRing} shadow-[0_0_6px_rgba(255,255,255,0.7)] transition-transform ${dragging?'scale-125':''}`} style={{left:`${value}%`, width:'14px', height:'14px', transform:'translate(-50%,-50%)'}}></div>
      </div>
      <button onClick={()=>step(1)} className="shrink-0 w-6 h-6 rounded-lg bg-slate-800 border border-white/10 text-slate-300 font-black text-xs active:scale-90 active:bg-slate-700 flex items-center justify-center select-none">＋</button>
      <span className="w-6 shrink-0 text-right text-[9px] font-mono font-black text-slate-300">{value}</span>
    </div>
  );
};
const DIST_APTITUDE_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15, 'S+': 1.175, SS: 1.2, 'SS+': 1.225, M: 1.25 };
const DIST_APTITUDE_COLOR = { S: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'S+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", SS: "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", 'SS+': "text-yellow-300 bg-yellow-950/60 border-yellow-400/50", M: "text-fuchsia-300 bg-gradient-to-br from-purple-950/70 to-pink-950/70 border-fuchsia-400/60", A: "text-red-400 bg-red-950/60 border-red-400/50", B: "text-pink-300 bg-pink-950/60 border-pink-400/50", C: "text-green-300 bg-green-950/60 border-green-400/50", D: "text-teal-300 bg-teal-950/60 border-teal-400/50", E: "text-cyan-300 bg-cyan-950/60 border-cyan-400/50", F: "text-purple-300 bg-purple-950/60 border-purple-400/50", G: "text-slate-400 bg-slate-800/60 border-slate-500/50" };
