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
//      とたん一覧から消えた**。実際にエイキ・剣士モッチーがそうなっている
//
// この画面は ALL_PLAYER_MONSTERS を**そのまま全部**並べる。所持・解放・debugOnly を
// 一切見ないので、実装の前も後も同じように見られて、あとから消えることがない。
//
// 【作りは図鑑にそろえる】(2026-09-17・ユーザー指摘「攻撃モーションの枠が小さすぎてわからない /
//  全てにおいて作りがごちゃついててみにくい / 実際のゲームみたいにわかりやすくして」)
//
// はじめは1本の長いスクロールへ9つの節を縦に積んでいたため、字が小さく目当てに届かず、
// 攻撃モーションの枠も112pxしか無くて演出が枠の外へ出ていた。
// いまは**本物の図鑑とまったく同じ3画面立て**にしてある。
//
//   一覧(MONSTER_DEX 相当) → 詳細＋タブ(MONSTER_DEX_DETAIL 相当)
//                          → 攻撃アクション全画面(MONSTER_ATTACK_PREVIEW 相当)
//
// 演出は本番と同じ BattleAttackMotionPreview / attackMotionPreviewSequence を使い、
// この画面のためのモーションは作らない。字の大きさ・カード・タブも図鑑にそろえてある。
//
// 【「モンスター画像・染色確認」を吸収した】(2026-09-17・ユーザー指摘「似たようなのもあるし」)
//
// 2画面の中身が9割同じだった(背景の切り替え・本番の表示条件6枠・染色UI・攻撃モーションが、
// 配色指定まで同じコードで二重にあった)。あちら(MONSTER_IMAGE_DEBUG)にしか無かった4つ
//   ・部位ごとの切り分け(染色Nのみ)   ・ライガーの旧画像/高画質版/比較
//   ・一時マスクが当たっていることの表示  ・生URL(?v= 付き)
// をこの画面の「画像」「データ」タブへ移したうえで、あちらは消した。
// 攻撃モーションはあちらだけ独自の setTimeout 列で組み直していたぶん、
// パンドラの分身が再生できなかった。こちらへ寄せたことでそれも見られるようになっている。

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
  return [
    { label: '立ち絵', code: 'imgUrl', state: mon.imgUrl ? 'ok' : 'ng', value: bare(mon.imgUrl) || '未設定' },
    { label: '一覧アイコン', code: 'iconUrl', state: mon.iconUrl ? 'ok' : 'ng', value: bare(mon.iconUrl) || '未設定' },
    { label: '顔アイコン', code: 'faceIconUrl', state: mon.faceIconUrl ? (sameArt ? 'warn' : 'ok') : 'ng',
      value: bare(mon.faceIconUrl) || '未設定',
      note: sameArt ? '立ち絵と同じ絵。丸く抜くと全身が入るので、拡大・位置の調整(MARKET_PROFILE_ICON_STYLES)が要る' : '' },
    { label: '攻撃モーション', code: 'atkMotion', state: mon.atkMotion ? 'ok' : 'ng', value: mon.atkMotion || '未設定',
      note: mon.atkMotion === 'default' ? '共通の汎用モーション' : '' },
    { label: '絵文字', code: 'emoji', state: mon.emoji ? 'ok' : 'warn', value: mon.emoji || '未設定',
      note: mon.emoji ? '' : '絵が読めなかったときの代わりに出る' },
    { label: '通常攻撃名', code: 'HERO_ATK_NAMES', state: atkNames.length === 9 ? 'ok' : 'ng', value: `${atkNames.length} / 9 段階`,
      // getAtkSkillLevels が HERO_ATK_NAMES[id] || HERO_ATK_NAMES['Mocchi'] と落ちるので、
      // 書き忘れてもエラーにならず、モッチーの技名が静かに出てしまう
      note: atkNames.length === 9 ? '' : '書き忘れるとモッチーの技名が静かに表示される（エラーにならない）' },
    { label: '固有技の9段階名', code: 'unique.names', state: uniqueNames.length === 9 ? 'ok' : 'ng', value: `${uniqueNames.length} / 9 段階` },
    { label: '固有技の中身', code: 'unique', state: (mon.unique?.name && mon.unique?.effectDesc) ? 'ok' : 'ng',
      value: mon.unique?.name ? `${mon.unique.name}／倍率${mon.unique.baseMult}／消費${mon.unique.baseGuts}` : '未設定' },
    { label: '勇者特性', code: 'trait', state: (mon.trait && mon.traitDesc) ? 'ok' : 'ng', value: mon.trait || '未設定' },
    { label: '基礎能力', code: 'baseHp/Atk/Def/Guts',
      state: [mon.baseHp, mon.baseAtk, mon.baseDef, mon.baseGuts].every(v => Number.isFinite(v)) ? 'ok' : 'ng',
      value: `${mon.baseHp}／${mon.baseAtk}／${mon.baseDef}／${mon.baseGuts}` },
    { label: '供モン加算', code: 'plusStats',
      state: ['hp', 'atk', 'def', 'guts'].every(k => Number.isFinite(plus[k])) ? 'ok' : 'ng',
      value: `ライフ${plus.hp}／ちから${plus.atk}／丈夫さ${plus.def}／ガッツ${plus.guts}` },
    { label: '距離適性', code: 'distAptitude', state: apt.length === 4 ? 'ok' : 'ng',
      value: apt.length ? monsterCheckDistanceLabels().map((label, i) => `${label} ${apt[i]}`).join('／') : '未設定' },
    { label: '血統', code: 'MONSTER_LINEAGE_MAP', state: lineage.known ? 'ok' : 'ng',
      value: lineage.known ? `${lineage.main.name} × ${lineage.sub.name}（${monsterCategoryName(monsterCategoryOf(id))}）` : '未登録',
      note: lineage.known ? '' : 'data/lineages.js へ1行足す。tools/monster/lineage-dex-check.js が見張る' },
    { label: '図鑑の説明文', code: 'MONSTER_DEX_DESCRIPTIONS', state: dexText ? 'ok' : 'ng', value: dexText ? `${dexText.length}文字` : '未記入',
      note: dexText ? '' : '無いと図鑑に「調査中」と出る' },
    { label: '図鑑に並ぶか', code: 'debugOnly', state: mon.debugOnly ? 'warn' : 'ok',
      value: mon.debugOnly ? '出ない（debugOnly）' : '出る',
      note: mon.debugOnly ? '正式実装前。図鑑・RPG一覧・マスモン登録から外れている' : '' },
    { label: '入手方法', code: 'disc / STARTER', state: (starter || disc) ? 'ok' : 'ng',
      value: starter ? '初期解放' : disc ? `円盤石 ${disc.cost} ダイヤ` : '入手できない',
      note: (starter || disc) ? '' : 'BREEDER_MARKET_ITEMS へ type:\'disc\' の円盤石を足す' },
    // 初期解放の8種は、この決まりができる前からいるので商品を持っていない。そこは注意にしない
    { label: 'アイコン商品', code: "type:'icon'", state: (faceIcon || starter) ? 'ok' : 'warn',
      value: faceIcon ? `${faceIcon.name}（${faceIcon.cost}）` : starter ? '無し（初期解放は対象外）' : '無し',
      note: (faceIcon || starter) ? '' : '新モンスターは顔アイコンと円盤石を同時に足す決まり' },
    { label: '染色の部位数', code: 'MASU_COLOR_REGION_HUES', state: 'ok', value: `${dyeRegionCount(id)} 部位` },
    { label: '丸枠での収め方', code: 'MONSTER_ART_CONTAIN_IDS', state: 'ok',
      value: containFixed ? 'contain で収める' : '既定のまま',
      note: containFixed ? '' : '丸いアイコンで頭や足が切れるなら、ここへ足すと収まる' },
  ];
};

// この1体に足りていない項目の数。一覧のバッジと見出しで使う
const monsterCheckNgCount = (mon) => monsterCheckImplRows(mon).filter(row => row.state === 'ng').length;

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
// カスタムカラーのモーダル(customColorPicker)が本体側にあり、そこから色を書き戻すため。
// 攻撃アクションの再生も、コマ送りのタイマーと世代管理を本体へ残してある
// (図鑑の MonsterAttackPreviewScreen と同じ作り。画面のライフサイクルで止めると演出が固まる)。
// 画面の中だけで完結するもの(いまどの画面か・タブ・検索語・背景)はここで持つ。
function MonsterCheckDebugScreen({
  masuMons = [], unlockedMonsterIds = [], selectedId, colors = [], attackPreview,
  artMode = 'new', temporaryDyeMasks = null, maskEditorOpened = false,
  getAtkSkillLevels, getUniqueSkillLevels,
  onSelect, onColorsChange, onCustomColor, onArtMode, onPlayPreview, onStopPreview, onBack, onOpenMaskEditor,
}) {
  const monsters = monsterCheckAllMonsters();
  const [view, setView] = useState('list');   // 'list' | 'detail' | 'motion'
  const [tab, setTab] = useState('check');    // 'check' | 'art' | 'stats' | 'skills' | 'data'
  const [query, setQuery] = useState('');
  const [bg, setBg] = useState('checker');
  const [brokenImages, setBrokenImages] = useState({});
  const [showRaw, setShowRaw] = useState(false);
  const swipeRef = useRef(null);

  const index = Math.max(0, monsters.findIndex(m => m.id === selectedId));
  const mon = monsters[index] || null;
  if (!mon) {
    return (
      <main data-monster-check-debug data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        <header className="flex items-center gap-2"><button aria-label="デバッグ設定へ戻る" onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-lg font-black italic text-emerald-300 uppercase tracking-widest">新モンスター確認</h2></header>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll"><p className="p-6 text-center text-[11px] font-bold text-slate-400">ALL_PLAYER_MONSTERS が読み込めていません。</p></div>
      </main>
    );
  }

  const ngCount = monsterCheckNgCount(mon);
  const atkMotion = mon.atkMotion || 'default';
  const playing = attackPreview?.monsterId === mon.id ? attackPreview : null;
  const regionCount = dyeRegionCount(mon.id);
  const dyeColors = Array.from({ length: regionCount }, (_, i) => colors[i] || null);
  const { main, sub } = monsterLineageOf(mon.id);
  const category = monsterCategoryOf(mon.id);
  const categoryClass = category === 'rare' ? 'bg-amber-600 text-white' : category === 'pure' ? 'bg-emerald-700 text-white' : 'bg-indigo-700 text-white';
  const market = monsterCheckMarketItems(mon);
  const owned = masuMons.filter(m => m && String(m.baseId) === String(mon.id)).length;
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

  const noteImageBroken = (url) => setBrokenImages(prev => (prev[url] ? prev : { ...prev, [url]: true }));
  // ライガーだけは、高画質版へ差し替える前の絵(ロールバック用)も残してある。
  // 「いまの本番」「旧画像」「並べて比較」を切り替えて見られるようにしておく
  const productionSources = { imgUrl: mon.imgUrl, iconUrl: mon.iconUrl, faceIconUrl: mon.faceIconUrl };
  const rollbackSources = (typeof TIGER_ROLLBACK_IMG !== 'undefined' && mon.id === 'Tiger')
    ? { imgUrl: TIGER_ROLLBACK_IMG, iconUrl: TIGER_ROLLBACK_ICON, faceIconUrl: TIGER_ROLLBACK_ICON }
    : null;
  const artSources = (rollbackSources && artMode === 'old') ? rollbackSources : productionSources;
  // 染色マスクを描いて「ゲームで試す」と、その種だけ一時的なマスクが当たる。
  // マスクは _temporaryDyeMasks 経由で DyedMonsterImage が勝手に見るので、ここでは印を出すだけでよい
  const temporaryMask = !!(temporaryDyeMasks && temporaryDyeMasks[mon.id]);
  const pickMonster = (id) => { onStopPreview(); onSelect(id); onColorsChange([]); setShowRaw(false); setTab('check'); setView('detail'); };
  const go = (delta) => { onStopPreview(); const next = monsters[(index + delta + monsters.length) % monsters.length]; if (!next) return; onSelect(next.id); onColorsChange([]); Audio_.se.tap(); };
  const dyedArt = (className = 'w-full h-full object-contain') =>
    <DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={mon.name} masuColors={dyeColors} draggable={false} className={className}/>;

  // ---------- ① 一覧。図鑑の一覧と同じ作りで、所持も解放も関係なく全種を並べる ----------
  if (view === 'list') {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja');
    const shown = monsters.filter(entry => !normalizedQuery
      || `${entry.name} ${entry.id} ${monsterLineageOf(entry.id).main.name}`.toLocaleLowerCase('ja').includes(normalizedQuery));
    const needsFix = monsters.filter(entry => monsterCheckNgCount(entry) > 0).length;
    return (
      <div data-monster-check-debug data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <button onClick={onBack} className="p-3 text-slate-400 active:scale-90" aria-label="デバッグ設定へ戻る"><ArrowLeft size={20}/></button>
          <h2 className="text-lg font-black italic text-emerald-300 uppercase tracking-widest">新モンスター確認</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 to-slate-950 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest shrink-0">確認できる種</span>
          <span className="text-[15px] font-mono font-black text-emerald-100 tabular-nums">{monsters.length}<span className="text-slate-400 text-[10px]"> 種（所持・解放に関係なく全部）</span></span>
        </div>
        <div className={`shrink-0 w-full max-w-md mx-auto mb-2 rounded-xl border px-3 py-2 text-[11px] font-black ${needsFix ? 'border-rose-500/50 bg-rose-950/30 text-rose-200' : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'}`}>
          {needsFix ? `⚠ ${needsFix}種に足りない項目があります` : '✓ 足りない項目のあるモンスターはいません'}
        </div>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="名前・内部ID・種族で検索"
          className="shrink-0 w-full max-w-md mx-auto mb-2 min-h-[46px] rounded-xl border border-white/10 bg-slate-900 px-3 text-[12px] font-black"/>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll w-full max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-2.5 pb-4">
            {shown.map(entry => {
              const entryNg = monsterCheckNgCount(entry);
              const entryOwned = masuMons.some(m => m && String(m.baseId) === String(entry.id));
              return (
                <button key={entry.id} type="button" data-monster-check-option={entry.id} aria-label={`${entry.name}を確認する`}
                  onClick={() => { Audio_.se.tap(); pickMonster(entry.id); }}
                  className={`w-full min-h-[128px] rounded-2xl border-2 p-2 flex flex-col items-center gap-1 active:scale-95 select-none ${entry.id === mon.id ? 'border-emerald-300 bg-emerald-900/50' : 'border-emerald-600/30 bg-gradient-to-b from-emerald-950/40 to-slate-900'}`}>
                  <DexMonsterIcon src={entry.iconUrl || entry.imgUrl || ''}/>
                  <div className="text-[11px] font-black truncate w-full text-center leading-tight text-emerald-50">{entry.name}</div>
                  <div className="text-[8px] font-black text-emerald-400/80 leading-tight truncate w-full text-center">{monsterLineageOf(entry.id).main.name}種</div>
                  <div className="text-[9px] font-black leading-tight">
                    {entry.debugOnly ? <span className="text-fuchsia-300">未実装</span>
                      : entryNg ? <span className="text-rose-300">要確認 {entryNg}</span>
                      : entryOwned ? <span className="text-cyan-300">所持中</span>
                      : <span className="text-slate-500">—</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {shown.length === 0 && <div className="py-6 text-center text-[11px] font-bold text-slate-400">一致するモンスターはいません。</div>}
        </div>
      </div>
    );
  }

  // ---------- ③ 攻撃アクション。図鑑の MONSTER_ATTACK_PREVIEW とまったく同じ舞台 ----------
  // 詳細の立ち絵の枠では、上へ飛ぶ音符や光が枠の外へ出て見えない。ここは縦を大きく取り、
  // 立ち絵を下寄りに置いて、上の余白へ演出が収まるようにする
  if (view === 'motion') {
    const kindButton = (kind, label) => (
      <button key={kind} type="button" data-monster-check-motion={kind} onClick={() => { Audio_.se.tap(); if (!playing) onPlayPreview(mon, kind, atkMotion); }} disabled={!!playing}
        className={`flex-1 min-w-0 min-h-[48px] rounded-2xl border-2 px-2 text-[12px] font-black active:scale-95 disabled:opacity-45 ${playing?.kind === kind ? 'border-cyan-200 bg-cyan-700 text-white' : 'border-cyan-400/50 bg-slate-900 text-cyan-100'}`}>
        {playing?.kind === kind ? '再生中…' : label}
      </button>
    );
    return (
      <main data-monster-check-debug data-mh-screen className="flex-1 flex flex-col h-full min-h-0" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        <div className="shrink-0 flex items-center gap-2 px-3">
          <button onClick={() => { onStopPreview(); setView('detail'); }} className="p-3 text-slate-400 active:scale-90" aria-label="詳細へ戻る"><ArrowLeft size={20}/></button>
          <div className="min-w-0">
            <small className="block text-[8px] font-black text-cyan-300 uppercase tracking-[0.2em]">Attack Action</small>
            <h2 className="truncate text-base font-black text-emerald-100">{mon.name}の攻撃アクション</h2>
          </div>
          <span className="ml-auto shrink-0 pr-1 text-[9px] font-mono font-black text-cyan-300/80">{atkMotion}</span>
        </div>
        <div data-monster-check-stage className="relative flex-1 min-h-0 overflow-hidden mx-3 mt-2 rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-slate-900 to-slate-950" style={bg === 'checker' ? undefined : bgStyle}>
          {/* 立ち絵も演出もまとめて少しだけ拡大する。演出の移動量はpx固定なので、
              ここを大きくしないと詳細の枠と同じ大きさのままになる */}
          <div data-monster-check-art className="absolute left-1/2" style={{ bottom: '11%', width: 'clamp(132px, 44vw, 184px)', height: 'clamp(132px, 44vw, 184px)', transform: 'translateX(-50%) scale(1.15)', transformOrigin: 'bottom center' }}>
            <BattleAttackMotionPreview image={dyedArt('h-full w-full object-contain')} anim={playing ? playing.anim : null} baseId={mon?.id}/>
          </div>
          <span className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-bold text-slate-500">バトルと同じ演出です（ダメージや性能は変わりません）</span>
        </div>
        <div className="shrink-0 px-3 pt-2">
          <div className="mx-auto flex w-full max-w-md gap-2">
            {kindButton('normal', '通常攻撃')}
            {kindButton('unique', '固有技')}
          </div>
        </div>
      </main>
    );
  }

  // ---------- ② 詳細。図鑑の MONSTER_DEX_DETAIL と同じ「上=立ち絵 / 下=カード＋タブ」 ----------
  const tabs = [['check', 'チェック'], ['art', '画像'], ['stats', '能力'], ['skills', '技'], ['data', 'データ']];
  // 図鑑と同じ行の出し方。長い値はラベルを上に置いて幅いっぱいを使う
  const row = (label, value, { block = false } = {}) => (
    block
      ? (
        <div key={label} className="border-b border-emerald-500/15 py-1.5 last:border-b-0">
          <span className="block text-[10px] font-black text-emerald-300/90">{label}</span>
          <span className="mt-1 block break-words text-[11px] font-bold leading-relaxed text-white">{value}</span>
        </div>
      )
      : (
        <div key={label} className="flex items-start justify-between gap-3 border-b border-emerald-500/15 py-1.5 last:border-b-0">
          <span className="shrink-0 text-[10px] font-black text-emerald-300/90">{label}</span>
          <span className="min-w-0 break-words text-[11px] font-bold text-white">{value}</span>
        </div>
      )
  );
  const skillPills = (list, accent) => (
    <div className="grid grid-cols-2 gap-1.5">
      {list.map(skill => (
        <div key={skill.lvl} className={`min-w-0 rounded-xl border px-2 py-1.5 ${accent}`}>
          <div className="flex min-w-0 items-center justify-between gap-1.5">
            <span className="min-w-0 truncate text-[10px] font-black text-white">{skill.name}</span>
            {/* 段階の数え方は図鑑と同じ(0始まり)。ここだけ1始まりにすると図鑑と食い違う */}
            <span className="shrink-0 text-[8px] font-mono font-black text-amber-300">Lv.{skill.lvl}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[8px] font-mono font-black text-slate-400">
            <span className="text-red-300">威力{skill.power}</span><span className="text-amber-300">消費G{skill.guts}</span><span className="text-yellow-300">会心{skill.crit}%</span>
          </div>
        </div>
      ))}
    </div>
  );
  // 1枚ぶんの枠。絵のURLと染色を指定できるようにしてあるので、「本番の表示条件」だけでなく
  // 「部位ごとの切り分け」「ライガーの新旧比較」も同じ部品で出せる。
  // 読み込みに失敗した絵は赤くして、「パスの綴り間違いで絵が出ない」を公開前に気づけるようにする
  const artBox = (label, src, palette, frameClass, fit, imgStyle, note) => {
    const broken = !!brokenImages[src];
    return (
      <section key={label} className="rounded-xl bg-black/30 p-2 text-center">
        <b className="block text-[10px] font-black text-cyan-200">{label}</b>
        {note && <small className="mb-1 block text-[8px] font-bold text-slate-400">{note}</small>}
        <div className={`${frameClass} overflow-hidden border ${broken ? 'border-rose-500' : 'border-white/20'}`} style={bgStyle}>
          {src
            ? <DyedMonsterImage baseId={mon.id} src={src} alt={label} masuColors={palette} className={`w-full h-full ${fit}`} style={{ ...monsterArtFitStyle(mon.id, undefined), ...(imgStyle || {}) }}/>
            : <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-rose-300">未設定</span>}
        </div>
        {/* 綴りを間違えた絵は、染色を通すと「何も出ない」だけで理由が分からない。
            同じURLを素の img でも1枚読ませて、失敗したことをここで言い切れるようにする */}
        {src && <img src={src} alt="" aria-hidden="true" className="hidden" onError={() => noteImageBroken(src)}/>}
        {broken && <small className="mt-1 block text-[9px] font-black text-rose-300">読み込めません</small>}
      </section>
    );
  };
  const artFrame = (label, sourceKey, frameClass, fit, imgStyle, note) =>
    artBox(label, artSources[sourceKey], dyeColors, frameClass, fit, imgStyle, note);
  const stateMark = (state) => state === 'ng' ? '✕' : state === 'warn' ? '△' : '✓';
  const stateClass = (state) => state === 'ng' ? 'text-rose-300' : state === 'warn' ? 'text-amber-300' : 'text-emerald-300';

  return (
    <div data-monster-check-debug data-mh-screen className="flex-1 flex flex-col h-full min-h-0" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
      <div className="flex shrink-0 items-center gap-2 px-3">
        <button onClick={() => { onStopPreview(); setView('list'); }} className="p-3 text-slate-400 active:scale-90" aria-label="一覧へ戻る"><ArrowLeft size={20}/></button>
        <h2 className="text-base font-black italic text-emerald-300 uppercase tracking-widest">新モンスター確認</h2>
        {temporaryMask&&<span className="ml-auto shrink-0 rounded-full bg-fuchsia-800 px-2 py-1 text-[9px] font-black text-white">一時マスク反映中</span>}
        <span className={`shrink-0 pr-1 text-[10px] font-mono font-black tabular-nums text-emerald-200/80 ${temporaryMask?'':'ml-auto'}`}>{index + 1} / {monsters.length}</span>
      </div>
      {/* 上半分: 立ち絵。左右のボタンと横スワイプで前後へ移る(図鑑と同じ) */}
      <div data-monster-check-hero className="relative flex shrink-0 items-center justify-center px-14" style={{ height: 'clamp(150px, 20dvh, 180px)' }}
        onTouchStart={e => { swipeRef.current = e.touches && e.touches[0] ? e.touches[0].clientX : null; }}
        onTouchEnd={e => { const from = swipeRef.current; swipeRef.current = null; if (from == null) return; const to = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : from; const dx = to - from; if (Math.abs(dx) >= 48) go(dx < 0 ? 1 : -1); }}>
        {dyedArt()}
        <button type="button" aria-label="前のモンスター" onClick={() => go(-1)} className="absolute left-1 top-1/2 flex w-11 min-h-[48px] -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400/40 bg-black/50 text-emerald-200 active:scale-90"><ChevronLeft size={22}/></button>
        <button type="button" aria-label="次のモンスター" onClick={() => go(1)} className="absolute right-1 top-1/2 flex w-11 min-h-[48px] -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400/40 bg-black/50 text-emerald-200 active:scale-90"><ChevronRight size={22}/></button>
      </div>
      {/* 攻撃アクションの入口。演出は上へ大きく飛ぶのでここでは再生せず、全画面の舞台へ移る */}
      <div className="flex shrink-0 justify-center px-3 pt-1">
        <button type="button" data-monster-check-open-motion onClick={() => { Audio_.se.tap(); onStopPreview(); setView('motion'); }}
          className="min-h-[40px] rounded-full border border-cyan-300/60 bg-slate-950/85 px-5 text-[11px] font-black text-cyan-100 shadow-lg active:scale-95">▶ 攻撃アクションを大きく見る</button>
      </div>
      {/* 下半分: 情報カード */}
      <div className="min-h-0 flex-1 px-3 pt-2">
        <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/50 to-slate-950 p-3">
          <div className="shrink-0 truncate text-center text-[17px] font-black text-emerald-100">{mon.name}</div>
          <div className="shrink-0 mt-2 grid items-center gap-1.5" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto minmax(0,1fr) auto' }}>
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-300">血統</span>
            <DexLineageChip lineage={main} iconUrl={lineageIconUrl(main)}/>
            <span className="shrink-0 text-center text-[12px] font-black text-emerald-300">×</span>
            <DexLineageChip lineage={sub} iconUrl={lineageIconUrl(sub)}/>
            <span className={`shrink-0 min-w-[42px] rounded-full px-1.5 py-1 text-center text-[9px] font-black ${categoryClass}`}>{monsterCategoryName(category)}</span>
          </div>
          <div className={`shrink-0 mt-2 rounded-xl border px-3 py-1.5 text-[11px] font-black ${ngCount ? 'border-rose-500/50 bg-rose-950/30 text-rose-200' : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'}`}>
            {ngCount ? `⚠ 足りない項目が ${ngCount} 件あります` : '✓ 足りない項目はありません'}
          </div>
          <div role="tablist" aria-label="確認する内容" className="shrink-0 mt-2 grid grid-cols-5 gap-1">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} data-monster-check-tab={id} onClick={() => { Audio_.se.tap(); setTab(id); }}
                className={`min-h-[40px] rounded-xl border px-0.5 text-[10px] font-black active:scale-95 ${tab === id ? 'border-emerald-300 bg-emerald-600 text-white' : 'border-emerald-500/30 bg-slate-900 text-emerald-200/80'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto mh-scroll pr-0.5">

            {tab === 'check' && (<div data-monster-check-tab-check className="space-y-1">
              <p className="mb-1 text-[9px] font-black leading-relaxed text-emerald-300/90">実データを見て、足りないものだけを機械的に出しています。</p>
              {monsterCheckImplRows(mon).map(row2 => (
                <div key={row2.label} className="rounded-xl bg-black/30 px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex shrink-0 items-center gap-1.5">
                      <b className={`text-[12px] font-black ${stateClass(row2.state)}`}>{stateMark(row2.state)}</b>
                      <span className="text-[11px] font-black text-white">{row2.label}</span>
                    </span>
                    <span className="min-w-0 break-all text-right text-[10px] font-bold text-slate-300">{row2.value}</span>
                  </div>
                  <div className="mt-0.5 pl-5 text-[8px] font-mono font-bold text-emerald-400/60">{row2.code}</div>
                  {row2.note && <p className="mt-1 pl-5 text-[9px] font-bold leading-relaxed text-amber-200/90">{row2.note}</p>}
                </div>
              ))}
            </div>)}

            {tab === 'art' && (<div data-monster-check-tab-art className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[['checker', '市松模様'], ['white', '白'], ['black', '黒']].map(([id, label]) => (
                  <button key={id} onClick={() => setBg(id)} className={`min-h-[40px] rounded-xl border text-[11px] font-black active:scale-95 ${bg === id ? 'ring-2 ring-cyan-400' : 'border-white/10'}`}
                    style={id === 'white' ? { background: '#fff', color: '#000' } : id === 'black' ? { background: '#000' } : { background: '#64748b' }}>{label}</button>
                ))}
              </div>
              {/* ライガーだけ、高画質版へ差し替える前の絵も残してある */}
              {rollbackSources&&<div className="grid grid-cols-3 gap-1">
                {[['new','いまの本番'],['old','旧画像（ロールバック用）'],['compare','並べて比較']].map(([id,label])=>(
                  <button key={id} data-monster-check-art-mode={id} onClick={()=>onArtMode(id)}
                    className={`min-h-[46px] rounded-xl border px-1 text-[9px] font-black active:scale-95 ${artMode===id?'border-amber-300 bg-amber-700 text-white':'border-white/10 bg-slate-900 text-slate-300'}`}>{label}</button>
                ))}
              </div>}
              {rollbackSources&&artMode==='compare'&&<div className="grid grid-cols-2 gap-2">
                {artBox('旧画像', rollbackSources.imgUrl, dyeColors, 'aspect-square', 'object-contain', null, '差し替える前')}
                {artBox('高画質版', productionSources.imgUrl, dyeColors, 'aspect-square', 'object-contain', null, 'いまの本番')}
              </div>}
              <div className="grid grid-cols-2 gap-2">
                {artFrame('バトル／立ち絵', 'imgUrl', 'aspect-square', 'object-contain', null, '本番 64px・角丸なし')}
                {artFrame('一覧／全身アイコン', 'iconUrl', 'aspect-square rounded-full', 'object-cover', null, '本番 48px・丸')}
                {artFrame('図鑑／大きな全身', 'imgUrl', 'h-36', 'object-contain', null, '本番 図鑑詳細の枠')}
                {artFrame('顔アイコン', 'faceIconUrl', 'aspect-square rounded-full', 'object-contain', profileIconStyle, '本番 プロフィール80px・丸')}
                {artFrame('プロフィール／選択', 'faceIconUrl', 'aspect-square rounded-2xl', 'object-contain', profileIconStyle, '本番 選択マス約59px・角丸')}
                {artFrame('小型／編成枠', 'imgUrl', 'aspect-square rounded-full', 'object-contain', null, '本番 40px・丸')}
              </div>
              <section className="rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/20 p-2.5">
                <h3 className="mb-2 text-[11px] font-black text-fuchsia-300">染色（{regionCount}部位・本番と共通）</h3>
                <DyeRegionColorControls baseId={mon.id} colors={dyeColors}
                  onChange={(idx, colorId) => { const next = Array.from({ length: regionCount }, (_, i) => dyeColors[i] || null); next[idx] = colorId; onColorsChange(next); }}
                  onCustom={(idx) => onCustomColor(idx, dyeColors[idx])}/>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => onColorsChange([])} className="min-h-[42px] rounded-xl bg-fuchsia-800 text-[10px] font-black">元の色へ戻す</button>
                  {/* マスクそのものを描いて直すのは専用の編集器。往復できるようにしておく */}
                  <button data-monster-check-open-mask onClick={() => { onStopPreview(); onOpenMaskEditor(); }} className="min-h-[42px] rounded-xl border border-cyan-400/60 bg-cyan-950 text-[10px] font-black text-cyan-100">染色マスクを編集する</button>
                </div>
              </section>
              {/* 部位ごとの切り分け。マスクが当たっているか(どこまでが①でどこからが②か)は
                  1部位ずつ塗って見るのがいちばん早い。ここでしか見られない */}
              <section data-monster-check-region className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/10 p-2.5">
                <h3 className="mb-2 text-[11px] font-black text-fuchsia-300">部位ごとの切り分け（{regionCount}部位）</h3>
                <div className="grid grid-cols-2 gap-2">
                  {artBox('元画像', artSources.imgUrl, [], 'aspect-square', 'object-contain', null, '染色なし')}
                  {artBox('合成後', artSources.imgUrl, dyeColors, 'aspect-square', 'object-contain', null, '全部位を重ねたもの')}
                  {Array.from({ length: regionCount }, (_, i) =>
                    artBox(`染色${i + 1}のみ`, artSources.imgUrl, dyeColors.map((c, j) => i === j ? c : null), 'aspect-square', 'object-contain', null, `${i + 1}番目の部位だけ`))}
                </div>
              </section>
            </div>)}

            {tab === 'stats' && (<div data-monster-check-tab-stats className="space-y-2">
              <div className="text-[9px] font-black text-emerald-300/90">その種の基礎能力と、全{monsters.length}種の中での位置</div>
              {monsterCheckStatRows(mon).map(stat => (
                <div key={stat.key} className="rounded-xl bg-black/30 px-2.5 py-2">
                  <div className="flex items-baseline justify-between text-[11px] font-black">
                    <span className="text-slate-200">{stat.label}</span>
                    <span className="text-white">{stat.value.toLocaleString()}<small className="ml-1.5 text-[9px] font-black text-amber-300">{stat.rank}位 / {stat.total}種</small></span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(Math.max(0, Math.min(1, stat.ratio)) * 100)}%` }}/>
                  </div>
                  <div className="mt-0.5 flex justify-between text-[8px] font-bold text-slate-500"><span>最小 {stat.min.toLocaleString()}</span><span>最大 {stat.max.toLocaleString()}</span></div>
                </div>
              ))}
              {/* 間合い適性の色は、図鑑・マスモン詳細・バトル画面と同じ決まりで塗る */}
              <div className="mb-1 mt-2 text-[9px] font-black text-emerald-300/90">間合い適性</div>
              <div className="grid grid-cols-4 gap-1.5">
                {RANGE_LABELS.map((label, i) => {
                  const grade = (mon.distAptitude && mon.distAptitude[i]) || 'C';
                  return (
                    <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-emerald-500/25 bg-black/30 py-1.5 text-center">
                      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black leading-none ${RANGE_STYLES[i].labelBg}`}>{label}</span>
                      <span className={`w-[86%] rounded-lg border py-0.5 text-[13px] font-mono font-black leading-none ${DIST_APTITUDE_COLOR[grade] || DIST_APTITUDE_COLOR.C}`}>{grade}</span>
                    </div>
                  );
                })}
              </div>
            </div>)}

            {tab === 'skills' && (<div data-monster-check-tab-skills className="space-y-2">
              {row('勇者特性', mon.trait || 'なし')}
              {row('特性の効果', mon.traitDesc || '特性なし', { block: true })}
              <div>
                <div className="mb-1 text-center text-[9px] font-black tracking-widest text-emerald-300/90">通常技</div>
                {skillPills(getAtkSkillLevels(mon), 'border-red-500/30 bg-red-950/25')}
              </div>
              <div>
                <div className="mb-1 text-center text-[9px] font-black tracking-widest text-emerald-300/90">固有技（進化段階）</div>
                {skillPills(getUniqueSkillLevels(mon), 'border-amber-500/40 bg-amber-950/30')}
                <div className="mt-1.5 break-words text-[10px] font-bold italic leading-relaxed text-slate-300">"{mon.unique?.effectDesc || ''}"</div>
              </div>
            </div>)}

            {tab === 'data' && (<div data-monster-check-tab-data className="space-y-2">
              {row('内部ID', mon.id)}
              {row('主血統 × 副血統', `${main.name} × ${sub.name}`)}
              {row('区分', monsterCategoryName(category))}
              {row('攻撃モーション', atkMotion)}
              {row('解放状態', starter ? '初期解放' : unlockedMonsterIds.includes(mon.id) ? '解放済み' : '未解放')}
              {row('所持している個体', `${owned} 体`)}
              {row('図鑑の説明', monsterDexDescription(mon.id), { block: true })}
              {row('円盤石（解放用）', market.disc ? `${market.disc.name}／${market.disc.cost} ダイヤ` : '無し')}
              {row('顔アイコン商品', market.faceIcon ? `${market.faceIcon.name}／${market.faceIcon.cost}` : '無し')}
              {row('円盤石アイコン商品', market.discIcon ? `${market.discIcon.name}／${market.discIcon.cost}` : '無し')}
              {/* キャッシュキー(?v=)まで見たいことがあるので、素のURLも出しておく */}
              <div data-monster-check-urls className="rounded-lg bg-black/40 p-2 text-[9px] leading-relaxed text-cyan-200 break-all">
                <div>imgUrl = {mon.imgUrl || '未設定'}</div>
                <div>iconUrl = {mon.iconUrl || '未設定'}</div>
                <div>faceIconUrl = {mon.faceIconUrl || '未設定'}</div>
              </div>
              <button onClick={() => setShowRaw(v => !v)} className="min-h-[42px] w-full rounded-xl bg-slate-800 text-[11px] font-black active:scale-95">{showRaw ? '生データを隠す' : '生データ（ALL_PLAYER_MONSTERS の中身）を見る'}</button>
              {showRaw && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/50 p-3 text-[9px] leading-relaxed text-cyan-200">{JSON.stringify(mon, null, 2)}</pre>}
            </div>)}

          </div>
        </div>
      </div>
    </div>
  );
}
