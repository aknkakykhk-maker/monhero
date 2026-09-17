// ==================== 新モンスター確認(デバッグ専用) ====================
// 「モンスターを1体足したとき、確認すべきものがここだけで全部見られる」画面。
// 入口はデバッグ設定(DEBUG_SETTINGS)だけで、通常プレイには一切出さない。
// 保存・付与・ランキングへは一切触れない(表示だけ)。
//
// 【なぜ要るか】(2026-09-17・ユーザー指摘「新モンスター実装用に全て確認出来る画面も必要 /
//  今は見れないものが多い / あと実装したら消えちゃうのも良くない」)
//
// 既存の「モンスター画像・染色確認」(MONSTER_IMAGE_DEBUG)は、表示の候補を
// **所持しているマスモン(個体)**から作っていた。そのため次の2つが起きていた。
//
//   ① 所持していないモンスターは1体も見られない。確認のためだけに円盤石を買う必要があった
//   ② 正式実装前は debugOnly で所持を経ずに差し込んでいたが、**実装して debugOnly を外した
//      とたん一覧から消えた**。実際にエイキがそうなっている(いまは debugOnly のモンスターが
//      1体も無いので、あの差し込みは何も足していない)
//
// この画面は ALL_PLAYER_MONSTERS を**そのまま全部**並べる。所持・解放・debugOnly を
// 一切見ないので、実装の前も後も同じように見られて、あとから消えることがない。
//
// 【見られるもの】画像(本番と同じ収め方)・染色・攻撃モーション・能力値と他種との比較・
// 距離適性・勇者特性・固有技9段階・通常攻撃9段階・血統と区分・図鑑説明・マーケットの商品・
// そして「実装チェック」(足りていない項目を機械的に見つける)。

// 攻撃モーションの再生にかかる時間。バトル画面と同じ値を使う
const MONSTER_CHECK_MOTION_MS = (atkMotion) => {
  if (atkMotion === 'arkHolyRain') return ARK_HOLY_RAIN_MOTION_MS;
  if (atkMotion === 'miaSongNotes') return MIA_SONG_NOTES_MOTION_MS;
  if (atkMotion === 'waterBurst') return WATER_BURST_MOTION_MS;
  if (atkMotion === 'floatStab') return 700;
  return 500;
};

// 距離の並び。distAptitude は [零, 近, 中, 遠] の順で持っている。
// 本番と同じ RANGE_LABELS から作るので、間合いの呼び方を変えてもここだけ古くならない
const monsterCheckDistanceLabels = () => RANGE_LABELS.map(label => `${label}距離`);

// この画面が確認の対象にするモンスター。
// **所持も解放も debugOnly も見ない**。ALL_PLAYER_MONSTERS にあるものは必ず並べる。
// 並びは図鑑と同じ「主血統(種族)ごと」にしておくと、同じ種族が隣り合って見比べやすい。
// dexMonsterList() は debugOnly を落とすので、落ちたぶんを後ろへ足して取りこぼしを無くす。
const monsterCheckAllMonsters = () => {
  if (typeof ALL_PLAYER_MONSTERS === 'undefined') return [];
  const ordered = dexMonsterList();
  const seen = new Set(ordered.map(mon => mon.id));
  const rest = Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon && mon.id && !seen.has(mon.id));
  return [...ordered, ...rest];
};

// マーケットの商品を引く。円盤石(type:'disc')は解放用でidがモンスターidと一致する決まり。
// 顔アイコン(type:'icon')はidが別なので、絵のパスで引き当てる(?v= は外して比べる)
const monsterCheckMarketItems = (mon) => {
  const items = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [];
  const bare = (url) => String(url || '').split('?')[0];
  const disc = items.find(item => item?.type === 'disc' && item.id === mon?.id) || null;
  const faceIcon = mon?.faceIconUrl
    ? items.find(item => item?.type === 'icon' && bare(item.icon) === bare(mon.faceIconUrl)) || null
    : null;
  const discIcon = disc
    ? items.find(item => item?.type === 'icon' && bare(item.icon) === bare(disc.icon)) || null
    : null;
  return { disc, faceIcon, discIcon };
};

// 「実装できているか」を機械的に見る。画面はどれが欠けても普通に開いてしまうので、
// 目で見て気づくのではなく一覧で出す。ok=揃っている / warn=意図的なこともある /
// ng=足りない(必ず直す)
const monsterCheckImplRows = (mon) => {
  if (!mon) return [];
  const id = mon.id;
  const bare = (url) => String(url || '').split('?')[0];
  const atkNames = (typeof HERO_ATK_NAMES !== 'undefined' && HERO_ATK_NAMES[id]) || [];
  const uniqueNames = mon.unique?.names || [];
  const lineage = monsterLineageOf(id);
  const dexText = (typeof MONSTER_DEX_DESCRIPTIONS !== 'undefined' && MONSTER_DEX_DESCRIPTIONS?.[id]) || '';
  const { disc, faceIcon } = monsterCheckMarketItems(mon);
  const starter = (typeof STARTER_MONSTER_IDS !== 'undefined' && STARTER_MONSTER_IDS.includes(id));
  const plus = mon.plusStats || {};
  const apt = Array.isArray(mon.distAptitude) ? mon.distAptitude : [];
  const containFixed = (typeof MONSTER_ART_CONTAIN_IDS !== 'undefined' && MONSTER_ART_CONTAIN_IDS.includes(id));
  const sameArt = bare(mon.faceIconUrl) === bare(mon.imgUrl);
  const rows = [
    { label: '立ち絵 imgUrl', state: mon.imgUrl ? 'ok' : 'ng', value: bare(mon.imgUrl) || '未設定' },
    { label: '一覧アイコン iconUrl', state: mon.iconUrl ? 'ok' : 'ng', value: bare(mon.iconUrl) || '未設定' },
    { label: '顔アイコン faceIconUrl', state: mon.faceIconUrl ? (sameArt ? 'warn' : 'ok') : 'ng',
      value: bare(mon.faceIconUrl) || '未設定',
      note: sameArt ? '立ち絵と同じ絵。丸く抜くと全身が入るので、拡大・位置の調整(MARKET_PROFILE_ICON_STYLES)が要る' : '' },
    { label: '攻撃モーション atkMotion', state: mon.atkMotion ? 'ok' : 'ng', value: mon.atkMotion || '未設定',
      note: mon.atkMotion === 'default' ? '共通の汎用モーション' : '' },
    { label: '絵文字 emoji', state: mon.emoji ? 'ok' : 'warn', value: mon.emoji || '未設定',
      note: mon.emoji ? '' : '絵が読めなかったときの代わりに出る' },
    { label: '通常攻撃名 HERO_ATK_NAMES', state: atkNames.length === 9 ? 'ok' : 'ng', value: `${atkNames.length} / 9 段階`,
      // getAtkSkillLevels が HERO_ATK_NAMES[id] || HERO_ATK_NAMES['Mocchi'] と落ちるので、
      // 書き忘れてもエラーにならず、モッチーの技名が静かに出てしまう
      note: atkNames.length === 9 ? '' : '書き忘れるとモッチーの技名が静かに表示される（エラーにならない）' },
    { label: '固有技の9段階名', state: uniqueNames.length === 9 ? 'ok' : 'ng', value: `${uniqueNames.length} / 9 段階` },
    { label: '固有技の中身', state: (mon.unique?.name && mon.unique?.effectDesc) ? 'ok' : 'ng',
      value: mon.unique?.name ? `${mon.unique.name}／倍率${mon.unique.baseMult}／消費${mon.unique.baseGuts}` : '未設定' },
    { label: '勇者特性 trait', state: (mon.trait && mon.traitDesc) ? 'ok' : 'ng',
      value: mon.trait ? `${mon.trait}` : '未設定' },
    { label: '基礎能力 baseHp/Atk/Def/Guts',
      state: [mon.baseHp, mon.baseAtk, mon.baseDef, mon.baseGuts].every(v => Number.isFinite(v)) ? 'ok' : 'ng',
      value: `${mon.baseHp}／${mon.baseAtk}／${mon.baseDef}／${mon.baseGuts}` },
    { label: '供モン加算 plusStats',
      state: ['hp', 'atk', 'def', 'guts'].every(k => Number.isFinite(plus[k])) ? 'ok' : 'ng',
      value: `ライフ${plus.hp}／ちから${plus.atk}／丈夫さ${plus.def}／ガッツ${plus.guts}` },
    { label: '距離適性 distAptitude', state: apt.length === 4 ? 'ok' : 'ng',
      value: apt.length ? monsterCheckDistanceLabels().map((label, i) => `${label} ${apt[i]}`).join('／') : '未設定' },
    { label: '血統 MONSTER_LINEAGE_MAP', state: lineage.known ? 'ok' : 'ng',
      value: lineage.known ? `${lineage.main.name} × ${lineage.sub.name}（${monsterCategoryName(monsterCategoryOf(id))}）` : '未登録',
      note: lineage.known ? '' : 'data/lineages.js へ1行足す。tools/monster/lineage-dex-check.js が見張る' },
    { label: '図鑑の説明文', state: dexText ? 'ok' : 'ng', value: dexText ? `${dexText.length}文字` : '未記入',
      note: dexText ? '' : 'MONSTER_DEX_DESCRIPTIONS が無いと図鑑に「調査中」と出る' },
    { label: '図鑑に並ぶか', state: mon.debugOnly ? 'warn' : 'ok',
      value: mon.debugOnly ? '出ない（debugOnly）' : '出る',
      note: mon.debugOnly ? '正式実装前。図鑑・RPG一覧・マスモン登録から外れている' : '' },
    { label: '入手方法', state: (starter || disc) ? 'ok' : 'ng',
      value: starter ? '初期解放（STARTER_MONSTER_IDS）' : disc ? `円盤石 ${disc.cost} ダイヤ` : '入手できない',
      note: (starter || disc) ? '' : 'BREEDER_MARKET_ITEMS へ type:\'disc\' の円盤石を足す' },
    // 初期解放の8種は、この決まりができる前からいるので商品を持っていない。そこは注意にしない
    { label: 'プロフィールアイコン商品', state: (faceIcon || starter) ? 'ok' : 'warn',
      value: faceIcon ? `${faceIcon.name}（${faceIcon.cost} ダイヤ）` : starter ? '無し（初期解放の8種は対象外）' : '無し',
      note: (faceIcon || starter) ? '' : '新モンスターは顔アイコン(type:\'icon\')と円盤石を同時に足す決まり' },
    { label: '染色の部位数', state: 'ok', value: `${dyeRegionCount(id)} 部位` },
    { label: '縦長立ち絵の丸枠対策', state: 'ok',
      value: containFixed ? 'MONSTER_ART_CONTAIN_IDS に入っている' : '対象外',
      note: containFixed ? '' : '丸いアイコンで頭や足が切れるなら、ここへ足すと contain で収まる' },
  ];
  return rows;
};

// 能力値を他の種と見比べる。1体だけ見ても高いのか低いのか分からないため、
// 全種の中の順位と、最小〜最大のどのあたりかを帯で出す
const monsterCheckStatRows = (mon) => {
  const all = monsterCheckAllMonsters();
  const defs = [
    ['ライフ', 'baseHp', m => m.baseHp],
    ['ちから', 'baseAtk', m => m.baseAtk],
    ['丈夫さ', 'baseDef', m => m.baseDef],
    ['ガッツ', 'baseGuts', m => m.baseGuts],
    ['合流ライフ', 'plus.hp', m => m.plusStats?.hp],
    ['合流ちから', 'plus.atk', m => m.plusStats?.atk],
    ['合流丈夫さ', 'plus.def', m => m.plusStats?.def],
    ['合流ガッツ', 'plus.guts', m => m.plusStats?.guts],
  ];
  return defs.map(([label, key, pick]) => {
    const values = all.map(pick).filter(Number.isFinite);
    const value = Number(pick(mon)) || 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    // 同じ値の種がいるときは同順位。降順で「上から何番目か」
    const rank = values.filter(v => v > value).length + 1;
    const ratio = max > min ? (value - min) / (max - min) : 1;
    return { label, key, value, min, max, rank, total: values.length, ratio };
  });
};

// 選んでいるモンスターと染色の色は MonsterHeroGame 側に持たせて props で受ける。
// カスタムカラーのモーダル(customColorPicker)が本体側にあり、そこから色を書き戻すため
// (「保存を伴うモーダルは本体に残す」という parts の決めごとに合わせてある)。
// 画面の中だけで完結する見た目の状態(検索語・背景・再生中・生データの開閉)はここで持つ。
function MonsterCheckDebugScreen({ masuMons = [], unlockedMonsterIds = [], selectedId, colors = [], onSelect, onColorsChange, onCustomColor, onBack, onOpenImageDebug }) {
  const monsters = monsterCheckAllMonsters();
  const [query, setQuery] = useState('');
  const [bg, setBg] = useState('checker');
  const [motion, setMotion] = useState(null);
  const [brokenImages, setBrokenImages] = useState({});
  const [showRaw, setShowRaw] = useState(false);

  const mon = monsters.find(m => m.id === selectedId) || monsters[0] || null;
  if (!mon) {
    return (
      <main data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        <header className="flex items-center gap-2"><button aria-label="デバッグ設定へ戻る" onClick={onBack} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-sm font-black">新モンスター確認</h2></header>
        <p className="p-6 text-center text-[11px] text-slate-400">ALL_PLAYER_MONSTERS が読み込めていません。</p>
      </main>
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase('ja');
  const listed = monsters.filter(entry => !normalizedQuery
    || `${entry.name} ${entry.id} ${monsterLineageOf(entry.id).main.name}`.toLocaleLowerCase('ja').includes(normalizedQuery));
  const regionCount = dyeRegionCount(mon.id);
  const dyeColors = Array.from({ length: regionCount }, (_, i) => colors[i] || null);
  const atkMotion = mon.atkMotion || 'default';
  // パンドラの分身(pandoraDualThunder)は枠を動かすのではなく専用の部品が要るため、ここでは再生しない
  const motionSupported = atkMotion !== 'default' && atkMotion !== 'pandoraDualThunder';
  const isDashMotion = atkMotion === 'zanCombo' || atkMotion === 'eikiSakuraCombo' || atkMotion === 'kenshiTwinBlade';
  const atkNames = (typeof HERO_ATK_NAMES !== 'undefined' && HERO_ATK_NAMES[mon.id]) || [];
  const uniqueNames = mon.unique?.names || [];
  const lineage = monsterLineageOf(mon.id);
  const market = monsterCheckMarketItems(mon);
  const implRows = monsterCheckImplRows(mon);
  const statRows = monsterCheckStatRows(mon);
  const ngCount = implRows.filter(row => row.state === 'ng').length;
  const warnCount = implRows.filter(row => row.state === 'warn').length;
  const owned = masuMons.filter(m => m && String(m.baseId) === String(mon.id)).length;
  const unlocked = unlockedMonsterIds.includes(mon.id);
  const starter = (typeof STARTER_MONSTER_IDS !== 'undefined' && STARTER_MONSTER_IDS.includes(mon.id));
  // プロフィールアイコンは本番(BreederIcon)で拡大・位置の調整が掛かる。これを通さないと
  // 顔アイコンが立ち絵そのままのモンスターだけ、確認画面のほうが本番と別物に見えてしまう
  const profileIconStyle = marketProfileIconStyle(
    (breederIconOptions({ includeUnowned: true }).find(o => String(o.src || '').split('?')[0] === String(mon.faceIconUrl || '').split('?')[0]) || {}).id);
  const bgStyle = bg === 'white' ? { background: '#fff' }
    : bg === 'black' ? { background: '#000' }
    : { backgroundColor: '#cbd5e1',
        backgroundImage: 'linear-gradient(45deg,#64748b 25%,transparent 25%),linear-gradient(-45deg,#64748b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#64748b 75%),linear-gradient(-45deg,transparent 75%,#64748b 75%)',
        backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' };

  const pickMonster = (id) => { onSelect(id); onColorsChange([]); setMotion(null); setShowRaw(false); };
  const noteImageBroken = (url) => setBrokenImages(prev => (prev[url] ? prev : { ...prev, [url]: true }));

  const playMotion = async () => {
    if (!motionSupported || motion) return;
    setMotion({ charge: true });
    await wait(650);
    if (isDashMotion) {
      const isTwin = atkMotion === 'kenshiTwinBlade';
      setMotion({ zanCombo: !isTwin, twinBlade: isTwin, sakura: atkMotion === 'eikiSakuraCombo' });
      await wait(atkMotion === 'eikiSakuraCombo' ? 500 : (isTwin ? 560 : 320));
    } else {
      setMotion({ charge: false, motion: atkMotion, sakura: false });
      await wait(MONSTER_CHECK_MOTION_MS(atkMotion));
    }
    setMotion(null);
  };

  // 本番と同じ収め方・同じ染色で1枚出す。読み込みに失敗した絵は赤くして、
  // 「パスの綴り間違いで絵が出ない」を公開前に気づけるようにする
  const artFrame = (label, sourceKey, frameClass, fit, imgStyle, note) => {
    const src = mon[sourceKey];
    const broken = !!brokenImages[src];
    return (
      <section key={label} className="rounded-xl bg-black/30 p-2 text-center">
        <b className="block mb-1 text-[9px] text-cyan-200">{label}</b>
        {note && <small className="mb-1 block text-[7px] font-normal text-slate-400">{note}</small>}
        <div className={`${frameClass} overflow-hidden border ${broken ? 'border-rose-500' : 'border-white/20'}`} style={bgStyle}>
          {src
            ? <DyedMonsterImage baseId={mon.id} src={src} alt={label} masuColors={dyeColors} className={`w-full h-full ${fit}`} style={{ ...monsterArtFitStyle(mon.id, undefined), ...(imgStyle || {}) }}/>
            : <span className="flex h-full w-full items-center justify-center text-[8px] font-black text-rose-300">未設定</span>}
        </div>
        {/* 綴りを間違えた絵は、染色を通すと「何も出ない」だけで理由が分からない。
            同じURLを素の img でも1枚読ませて、失敗したことをここで言い切れるようにする */}
        {src && <img src={src} alt="" aria-hidden="true" className="hidden" onError={() => noteImageBroken(src)}/>}
        {broken && <small className="mt-1 block text-[8px] font-black text-rose-300">読み込めません</small>}
      </section>
    );
  };

  const stateMark = (state) => state === 'ng' ? '✕' : state === 'warn' ? '△' : '✓';
  const stateClass = (state) => state === 'ng' ? 'text-rose-300' : state === 'warn' ? 'text-amber-300' : 'text-emerald-300';

  return (
    <main data-monster-check-debug data-mh-screen className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 p-3"
      style={{ paddingTop: 'calc(.75rem + env(safe-area-inset-top))', paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
      <header className="mb-2 flex shrink-0 items-center gap-2">
        <button aria-label="デバッグ設定へ戻る" onClick={onBack} className="p-3 text-slate-400"><ArrowLeft size={20}/></button>
        <div>
          <small className="text-[8px] font-black text-emerald-300">DEBUG・全{monsters.length}種を所持や解放に関係なく表示／保存しません</small>
          <h2 className="text-sm font-black">新モンスター確認</h2>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-3 pb-3">
        {/* ① どのモンスターを見るか。所持も解放も関係なく全部並べる */}
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[10px] font-black text-emerald-300">① モンスターをえらぶ</h3>
            <small className="text-[8px] text-slate-400">全{monsters.length}種・表示{listed.length}種</small>
          </div>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="名前・内部ID・種族で検索"
            className="mb-2 w-full min-h-[44px] rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-black"/>
          <div className="grid grid-cols-3 gap-1.5">
            {!listed.length && <p className="col-span-3 py-4 text-center text-[10px] text-slate-400">一致するモンスターはいません。</p>}
            {listed.map(entry => {
              const isSel = entry.id === mon.id;
              const entryOwned = masuMons.some(m => m && String(m.baseId) === String(entry.id));
              const entryNg = monsterCheckImplRows(entry).filter(row => row.state === 'ng').length;
              return (
                <button key={entry.id} data-monster-check-option={entry.id} onClick={() => pickMonster(entry.id)}
                  className={`min-h-[76px] rounded-xl p-1 text-[8px] font-black ${isSel ? 'border-2 border-emerald-300 bg-emerald-900 text-emerald-50' : 'border border-white/10 bg-slate-900 text-slate-400'}`}>
                  <span className="mx-auto block h-9 w-9 overflow-hidden rounded-full bg-black/30">
                    {entry.iconUrl && <img src={entry.iconUrl} alt="" className="h-full w-full object-cover" style={monsterArtFitStyle(entry.id, undefined)}/>}
                  </span>
                  <b className="mt-1 block truncate">{entry.name}</b>
                  <small className="block truncate text-[7px] opacity-80">{monsterLineageOf(entry.id).main.name}種</small>
                  <small className="block text-[7px]">
                    {entry.debugOnly ? <span className="text-fuchsia-300">未実装</span>
                      : entryNg ? <span className="text-rose-300">要確認{entryNg}</span>
                      : entryOwned ? <span className="text-cyan-300">所持中</span>
                      : <span className="text-slate-500">—</span>}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        {/* ② 実装チェック。画面はどれが欠けても開いてしまうので、機械的に一覧で出す */}
        <section className={`rounded-2xl border-2 p-3 ${ngCount ? 'border-rose-500/60 bg-rose-950/20' : 'border-emerald-500/50 bg-emerald-950/20'}`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[10px] font-black text-white">② 実装チェック（{mon.name}）</h3>
            <small className={`text-[9px] font-black ${ngCount ? 'text-rose-300' : 'text-emerald-300'}`}>
              {ngCount ? `足りない ${ngCount} 件` : '足りない項目はありません'}{warnCount ? `／注意 ${warnCount} 件` : ''}
            </small>
          </div>
          <div className="space-y-1">
            {implRows.map(row => (
              <div key={row.label} className="rounded-lg bg-black/30 px-2 py-1.5 text-[9px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <b className={`shrink-0 font-black ${stateClass(row.state)}`}>{stateMark(row.state)}</b>
                  <span className="shrink-0 font-black text-slate-300">{row.label}</span>
                  <span className="ml-auto break-all text-right text-slate-400">{row.value}</span>
                </div>
                {row.note && <p className="mt-0.5 pl-5 text-[8px] text-amber-200/80">{row.note}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ③ 本番と同じ見え方。背景を変えて、縁の処理や切れ方まで見る */}
        <section className="rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-3">
          <h3 className="mb-2 text-[10px] font-black text-cyan-300">③ 実際の表示条件</h3>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {[['checker', '市松模様'], ['white', '白'], ['black', '黒']].map(([id, label]) => (
              <button key={id} onClick={() => setBg(id)} className={`min-h-[40px] rounded-xl text-[10px] font-black border ${bg === id ? 'ring-2 ring-cyan-400' : 'border-white/10'}`}
                style={id === 'white' ? { background: '#fff', color: '#000' } : id === 'black' ? { background: '#000' } : { background: '#64748b' }}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {artFrame('バトル／立ち絵', 'imgUrl', 'aspect-square', 'object-contain', null, '本番 64px・角丸なし')}
            {artFrame('一覧／全身アイコン', 'iconUrl', 'aspect-square rounded-full', 'object-cover', null, '本番 48px・丸')}
            {artFrame('図鑑／大きな全身', 'imgUrl', 'h-40', 'object-contain', null, '本番 図鑑詳細の横長枠')}
            {artFrame('顔アイコン', 'faceIconUrl', 'aspect-square rounded-full', 'object-contain', profileIconStyle, '本番 プロフィール80px・丸')}
            {artFrame('プロフィール／選択', 'faceIconUrl', 'aspect-square rounded-2xl', 'object-contain', profileIconStyle, '本番 選択マス約59px・角丸')}
            {artFrame('小型／編成枠', 'imgUrl', 'aspect-square rounded-full', 'object-contain', null, '本番 40px・丸')}
          </div>
        </section>

        {/* ④ 染色。本番と同じ部品を使うので、部位の分かれ方がそのまま分かる */}
        <section className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/20 p-3">
          <h3 className="mb-2 text-[10px] font-black text-fuchsia-300">④ 染色（{regionCount}部位・本番と共通）</h3>
          <DyeRegionColorControls baseId={mon.id} colors={dyeColors}
            onChange={(idx, colorId) => { const next = Array.from({ length: regionCount }, (_, i) => dyeColors[i] || null); next[idx] = colorId; onColorsChange(next); }}
            onCustom={(idx) => onCustomColor(idx, dyeColors[idx])}/>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => onColorsChange([])} className="min-h-[40px] rounded-xl bg-fuchsia-800 text-[9px] font-black">元の色へ戻す</button>
            {/* 部位ごとの切り分け・マスクの当たり方・ライガーの新旧比較は、専用の画面のほうが詳しい */}
            <button data-monster-check-open-image onClick={() => onOpenImageDebug(mon.id)} className="min-h-[40px] rounded-xl border border-cyan-400/60 bg-cyan-950 text-[9px] font-black text-cyan-100">染色をくわしく見る</button>
          </div>
        </section>

        {/* ⑤ 攻撃モーション。バトル画面と同じ関数・同じCSSでその場で再生する */}
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3">
          <h3 className="mb-1 text-[10px] font-black text-cyan-300">⑤ 攻撃モーション（atkMotion: {atkMotion}）</h3>
          {motionSupported
            ? <>
              <p className="mb-2 text-[8px] leading-relaxed text-slate-400">本番のバトル画面と同じ関数・同じCSSで再生する。連撃の巻き添えヒットは無いのでこの1回だけ動く。</p>
              <div className={`mx-auto h-28 w-28 ${(atkMotion === 'waterBurst' || atkMotion === 'arkHolyRain' || atkMotion === 'miaSongNotes') ? 'overflow-visible' : 'overflow-hidden'} rounded-xl border border-white/20`} style={bgStyle}>
                <div className="relative h-full w-full" style={{ isolation: 'isolate', animation: attackMotionAnimation(motion) }}>
                  {motion?.motion === 'arkHolyRain'
                    ? <ArkHolyRainMotion image={<DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt="攻撃モーション確認" masuColors={dyeColors} className="h-full w-full object-contain"/>} charging={motion?.charge === true} empowered={motion?.charge === false}/>
                    : motion?.motion === 'waterBurst'
                      ? <WaterBurstMotion image={<DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt="攻撃モーション確認" masuColors={dyeColors} className="h-full w-full object-contain"/>} lunge={motion?.charge === false} charging={motion?.charge === true}/>
                      : motion?.motion === 'miaSongNotes'
                        ? <MiaSongNotesMotion image={<DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt="攻撃モーション確認" masuColors={dyeColors} className="h-full w-full object-contain"/>} lunge={motion?.charge === false} charging={motion?.charge === true}/>
                        : <>
                          <DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt="攻撃モーション確認" masuColors={dyeColors} className="h-full w-full object-contain"/>
                          {motion?.sakura && <EikiSakuraPetals/>}
                          {motion?.twinBlade && <KenshiTwinSlash/>}
                        </>}
                </div>
              </div>
              <button data-monster-check-motion onClick={playMotion} disabled={!!motion} className="mt-2 min-h-[42px] w-full rounded-xl bg-cyan-700 text-[10px] font-black disabled:opacity-40">{motion ? '再生中…' : '攻撃モーションを再生'}</button>
            </>
            : <p className="text-[9px] leading-relaxed text-slate-400">{atkMotion === 'default' ? '共通の汎用モーション(attackFly / specialLunge)を使う。専用モーションはありません。' : 'このモーションは専用の部品が要るため、ここでは再生できません（バトル画面で確認する）。'}</p>}
        </section>

        {/* ⑥ 能力値。1体だけ見ても高低が分からないので、全種の中の位置を帯で出す */}
        <section className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-3">
          <h3 className="mb-2 text-[10px] font-black text-amber-300">⑥ 能力値（全{monsters.length}種の中の位置）</h3>
          <div className="space-y-1.5">
            {statRows.map(row => (
              <div key={row.key} className="rounded-lg bg-black/30 px-2 py-1.5">
                <div className="flex items-baseline justify-between text-[9px] font-black">
                  <span className="text-slate-300">{row.label}</span>
                  <span className="text-white">{row.value.toLocaleString()}<small className="ml-1 text-[8px] font-black text-amber-300">{row.rank}位 / {row.total}種</small></span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(Math.max(0, Math.min(1, row.ratio)) * 100)}%` }}/>
                </div>
                <div className="mt-0.5 flex justify-between text-[7px] text-slate-500"><span>最小 {row.min.toLocaleString()}</span><span>最大 {row.max.toLocaleString()}</span></div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-lg bg-black/30 p-2">
            <b className="block text-[9px] font-black text-amber-300">距離適性</b>
            <div className="mt-1 grid grid-cols-4 gap-1 text-center">
              {monsterCheckDistanceLabels().map((label, i) => (
                <div key={label} className="rounded-lg bg-slate-900 py-1">
                  <small className="block text-[7px] text-slate-400">{label}</small>
                  <b className="block text-[13px] font-black text-white">{mon.distAptitude?.[i] || '—'}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ⑦ 技。9段階ぶんの名前は書き写しの取りこぼしが起きやすいので全部出す */}
        <section className="rounded-2xl border border-indigo-500/40 bg-indigo-950/20 p-3">
          <h3 className="mb-2 text-[10px] font-black text-indigo-300">⑦ 特性と技</h3>
          <div className="space-y-1 text-[9px] leading-relaxed">
            <div className="rounded-lg bg-black/30 p-2">
              <b className="block text-white">勇者特性：{mon.trait || '未設定'}</b>
              <p className="mt-0.5 text-slate-300">{mon.traitDesc || '未設定'}</p>
            </div>
            <div className="rounded-lg bg-black/30 p-2">
              <b className="block text-white">固有技：{mon.unique?.name || '未設定'}</b>
              <p className="mt-0.5 text-slate-400">ダメージ倍率 {mon.unique?.baseMult ?? '—'}／消費ガッツ {mon.unique?.baseGuts ?? '—'}</p>
              <p className="mt-0.5 text-slate-300">{mon.unique?.effectDesc || '未設定'}</p>
            </div>
            <div className="rounded-lg bg-black/30 p-2">
              <b className="block text-white">固有技の9段階（{uniqueNames.length}件）</b>
              <ol className="mt-1 space-y-0.5 text-slate-300">{uniqueNames.map((name, i) => <li key={`${name}-${i}`}>Lv.{i + 1}　{name}</li>)}</ol>
            </div>
            <div className="rounded-lg bg-black/30 p-2">
              <b className="block text-white">通常攻撃の9段階（{atkNames.length}件）</b>
              <ol className="mt-1 space-y-0.5 text-slate-300">{atkNames.map((name, i) => <li key={`${name}-${i}`}>Lv.{i + 1}　{name}</li>)}</ol>
            </div>
          </div>
        </section>

        {/* ⑧ 血統・図鑑・マーケット。足し忘れると画面はふつうに開いたまま欠ける */}
        <section className="rounded-2xl border border-violet-500/40 bg-violet-950/20 p-3">
          <h3 className="mb-2 text-[10px] font-black text-violet-300">⑧ 血統・図鑑・マーケット</h3>
          <div className="space-y-1 text-[9px] leading-relaxed">
            <div className="rounded-lg bg-black/30 p-2 text-slate-300">
              <div className="flex justify-between"><span>主血統 × 副血統</span><b className="text-white">{lineage.main.name} × {lineage.sub.name}</b></div>
              <div className="flex justify-between"><span>区分</span><b className="text-white">{monsterCategoryName(monsterCategoryOf(mon.id))}</b></div>
              <div className="flex justify-between"><span>解放状態</span><b className="text-white">{starter ? '初期解放' : unlocked ? '解放済み' : '未解放'}／所持 {owned} 体</b></div>
            </div>
            <div className="rounded-lg bg-black/30 p-2">
              <b className="block text-white">図鑑の説明</b>
              <p className="mt-0.5 text-slate-300">{monsterDexDescription(mon.id)}</p>
            </div>
            <div className="rounded-lg bg-black/30 p-2 text-slate-300">
              <b className="block text-white">マーケットの商品</b>
              <div className="mt-0.5 flex justify-between"><span>円盤石（解放用）</span><b className="text-white">{market.disc ? `${market.disc.name}／${market.disc.cost} ダイヤ` : '無し'}</b></div>
              <div className="flex justify-between"><span>顔アイコン</span><b className="text-white">{market.faceIcon ? `${market.faceIcon.name}／${market.faceIcon.cost} ダイヤ` : '無し'}</b></div>
              <div className="flex justify-between"><span>円盤石アイコン</span><b className="text-white">{market.discIcon ? `${market.discIcon.name}／${market.discIcon.cost} ダイヤ` : '無し'}</b></div>
            </div>
          </div>
        </section>

        {/* ⑨ 生データ。実装中に「いま何が入っているか」をそのまま見たいことがある */}
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
          <button onClick={() => setShowRaw(v => !v)} className="min-h-[40px] w-full rounded-xl bg-slate-800 text-[10px] font-black">{showRaw ? '生データを隠す' : '⑨ 生データ（ALL_PLAYER_MONSTERS の中身）を見る'}</button>
          {showRaw && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/50 p-3 text-[8px] leading-relaxed text-cyan-200">{JSON.stringify(mon, null, 2)}</pre>}
        </section>
      </div>
    </main>
  );
}
