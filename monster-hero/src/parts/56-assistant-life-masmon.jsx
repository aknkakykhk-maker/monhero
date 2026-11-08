// ==================== 助手ライフ: 助手のマスモン(一覧・編成・デッキ・好き苦手) ====================
// 2026-11-08 社長「助手にもマスモン一覧とか編成とかもプレイヤーと同じように存在すると面白い」
//   部屋のシートの「🐾 マスモン」から開く。助手が自分で育てている個体(1人3体・先頭1体)と、
//   MFバトルカードのデッキの型(マスモンとは別もの)、モンスターの好き・苦手・好きな色を見せる。
// 守ること:
//   - モンスターは実装済み(ALL_PLAYER_MONSTERS)だけ。表は masmon-plan.json が正本(下の印の間は道具が書く)
//   - プレイヤーのマスモン・染色・セーブ・ランキングには触らない。この部品は何も保存しない(成長は次の段階で新しいキー)
//   - 好き・苦手は反応の台詞とマスモン選びにだけ使う。強さ・スコア・ごほうびには効かせない
//   - 能力のゲージは見た目用(基礎値は ALL_PLAYER_MONSTERS を読むだけ・2026-11-08 バトル部ジンとすり合わせ)
// 案: docs/progress/assistant-peer/GROW-PLAN.md の 6 / 検査: tools/assistant/assistant-masmon-plan-check.js

// <<< ASSISTANT_MASMON_PLAN(tools/assistant/assistant-masmon-import.js が masmon-plan.json から書く。手で直さない)
const ASSISTANT_MASMON_PLAN = [
  {"id":"mua","team":[{"monster":"KenshiMocchi","nick":"もち隊長","lead":true,"why":"好き。剣を持ったモッチーがかっこかわいい","lv":24,"grow":"すばやさ型(ノリで決めた)","dye":{"colors":["pink_light","sky","pink","pink_light","sky"]}},{"monster":"MelWhip","nick":"ほいっぷちゃん","lead":false,"why":"好き。甘くてかわいい","lv":16,"grow":"ライフ型","dye":{"colors":["sky","pink","pink_light","sky","pink"]}},{"monster":"Iblis","nick":"イブちゃん","lead":false,"why":"好き。ちょっと悪そうなのがいい","lv":14,"grow":"攻撃型","dye":{"colors":["pink","pink_light","sky"]}}],"deck":{"name":"キラキラ速攻","plan":"軽いカードを早く並べて、先に押し切る。ノリで決めて、勝てたらはしゃぐ"},"likeMon":[{"monster":"KenshiMocchi","why":"剣を持ったモッチーがかっこかわいい"},{"monster":"MelWhip","why":"甘くてかわいい"},{"monster":"Iblis","why":"ちょっと悪そうなのがいい"}],"dislikeMon":[{"monster":"Ghost","why":"こわいのはまぢ無理"},{"monster":"Monol","why":"かたくて地味"},{"monster":"Golem","why":"ごつくて、ちょっとこわい"}],"favColors":[{"color":"pink_light","why":"ふんわりかわいい"},{"color":"sky","why":"さわやか"},{"color":"pink","why":"はっきりかわいい"}]},
  {"id":"kiki","team":[{"monster":"Golem","nick":"ごろべえ","lead":true,"why":"好き。ちからに振るのが楽しい","lv":26,"grow":"攻撃型(ちからに振る)","dye":{"colors":["pink","red","pink_light"]}},{"monster":"Eiki","nick":"エイキさん","lead":false,"why":"好き。きりっとして強い","lv":17,"grow":"攻撃型","dye":{"colors":["red","pink_light","pink"]}},{"monster":"Zan","nick":"ざんざん","lead":false,"why":"好き。速くて鋭い","lv":15,"grow":"すばやさ型","dye":{"colors":["pink_light","pink","red"]}}],"deck":{"name":"ずっしり火力","plan":"守って耐えて、ちからの高いモンスターで一撃。数字よりも火力を信じる"},"likeMon":[{"monster":"Golem","why":"ちからに振るのが楽しい"},{"monster":"Eiki","why":"きりっとして強い"},{"monster":"Zan","why":"速くて鋭い"}],"dislikeMon":[{"monster":"Oboro","why":"力が低くて物足りない"},{"monster":"Monol","why":"力が低くて物足りない"},{"monster":"Plant","why":"力が低くて物足りない"}],"favColors":[{"color":"pink","why":"いつものリボンの色"},{"color":"red","why":"火力の色"},{"color":"pink_light","why":"やさしい"}]},
  {"id":"momosuke","team":[{"monster":"Melody","nick":"メロちゃん","lead":true,"why":"好き。一緒に歌える","lv":22,"grow":"ガッツ型(ステージ映え)","dye":{"colors":["magenta","pink","purple_light","yellow","magenta"]}},{"monster":"Yggdrasil","nick":"ユグっち","lead":false,"why":"好きなユグドラシル種","lv":15,"grow":"ライフ型","dye":{"colors":["pink","purple_light","yellow"]}},{"monster":"Dreamy","nick":"ゆめっち","lead":false,"why":"好き。ゆめかわ","lv":13,"grow":"すばやさ型","dye":{"colors":["purple_light","yellow","magenta","pink","purple_light"]}}],"deck":{"name":"ステージ・オン","plan":"派手なカードで盛り上げる。勝っても負けても見せ場を作る"},"likeMon":[{"monster":"Melody","why":"一緒に歌える"},{"lineage":"yggdrasil","why":"ユグドラシル種はぜんぶ好き"},{"monster":"Dreamy","why":"ゆめかわ"}],"dislikeMon":[{"monster":"Golem","why":"ゴリゴリで一緒に踊れない"},{"monster":"Tiger","why":"ゴリゴリでこわい"},{"monster":"Iblis","why":"ゴリゴリでこわい"}],"favColors":[{"color":"magenta","why":"ステージの色"},{"color":"pink","why":"かわいい担当"},{"color":"purple_light","why":"ゆめかわ"},{"color":"yellow","why":"スポットライト"}]},
  {"id":"dra","team":[{"monster":"Suezo","nick":"メダマ焼き","lead":true,"why":"好き。ギャグが通じる","lv":18,"grow":"ライフ型(のんびり)","dye":{"colors":["green","orange","black"]}},{"monster":"Golem","nick":"ゴロ助","lead":false,"why":"好き。何でも強く育てられる","lv":20,"grow":"攻撃型","dye":{"colors":["orange","black","green"]}},{"monster":"Oboro","nick":"おぼろん","lead":false,"why":"一緒に昼寝","lv":14,"grow":"防御型","dye":{"colors":["black","green","orange"]}}],"deck":{"name":"のんびり長期戦","plan":"あわてず守って、長い試合で少しずつ削る。説明しながら打つ"},"likeMon":[{"monster":"Suezo","why":"ギャグが通じる"},{"monster":"Golem","why":"どっしりして強い"}],"dislikeMon":[{"monster":"Ark","why":"まぶしくて昼寝できない"},{"lineage":"ark","why":"アーク種はぜんぶ苦手"}],"favColors":[{"color":"green","why":"ひなたの丘の草"},{"color":"orange","why":"茶色(ゲームに茶色が無いので橙で代用)"},{"color":"black","why":"落ち着く"}]},
  {"id":"atsu","team":[{"monster":"KenshiMocchi","nick":"師匠","lead":true,"why":"好き。モッチー種は特別","lv":27,"grow":"攻撃型(朝の育成)","dye":{"colors":["red","black","red","black","red"]}},{"monster":"Zan","nick":"ザンくん","lead":false,"why":"好き。速くて強い","lv":19,"grow":"すばやさ型","dye":{"colors":["black","red","black"]}},{"monster":"Spooky","nick":"スプ","lead":false,"why":"好きなゴースト種","lv":16,"grow":"攻撃型","dye":{"colors":["red","black","red","black","red"]}}],"deck":{"name":"真っ向勝負","plan":"強いモンスターで正面から。小細工はしない。負けたらすぐ再戦"},"likeMon":[{"monster":"KenshiMocchi","why":"モッチー種は特別"},{"monster":"Zan","why":"速くて強い"},{"lineage":"ghost","why":"ゴースト種は強くてかっこいい"}],"dislikeMon":[],"favColors":[{"color":"red","why":"勝負の色"},{"color":"black","why":"締まって見える"}]},
  {"id":"kyuko","team":[{"monster":"Illumine","nick":"ともしび","lead":true,"why":"好き。灯りが夜の読書に合う","lv":21,"grow":"ガッツ型(夜ふかしで育成)","dye":{"colors":["red_light","white","orange_light","red_light","white"]}},{"monster":"Dreamy","nick":"ゆめの","lead":false,"why":"好き。夢の話ができる","lv":15,"grow":"ガッツ型","dye":{"colors":["white","orange_light","red_light","white","orange_light"]}},{"monster":"Pixie","nick":"ぴぃ","lead":false,"why":"好きなピクシー種","lv":14,"grow":"すばやさ型","dye":{"colors":["orange_light","red_light","white"]}}],"deck":{"name":"夜の読み筋","plan":"相手の手を読んで、最後にひっくり返す。数字と直感の両方で決める"},"likeMon":[{"monster":"Illumine","why":"灯りが夜の読書に合う"},{"monster":"Dreamy","why":"夢の話ができる"},{"lineage":"pixie","why":"ピクシー種はかわいい"}],"dislikeMon":[{"monster":"Suezo","why":"じっと見られると落ち着かない"},{"monster":"Ham","why":"元気すぎてつかれる"},{"monster":"Eiki","why":"きびきびしすぎて本が読めない"}],"favColors":[{"color":"red_light","why":"髪の色"},{"color":"white","why":"服の色"},{"color":"orange_light","why":"目の色"}]},
  {"id":"sorashido","team":[{"monster":"Kyubi","nick":"コン太","lead":true,"why":"推し","lv":25,"grow":"すばやさ型(記録どおり)","dye":{"colors":["blue","sky","white","blue","sky"]}},{"monster":"Orihime","nick":"ヒメ","lead":false,"why":"もう1人の推し","lv":18,"grow":"ガッツ型","dye":{"colors":["sky","white","blue","sky","white"]}},{"monster":"Monol","nick":"ソロバン","lead":false,"why":"計算と表づくり","lv":15,"grow":"防御型","dye":{"colors":["white","blue","sky"]}}],"deck":{"name":"計算ずく","plan":"記録から勝ち筋を決めて、その通りに打つ。表は毎晩書き直す"},"likeMon":[{"monster":"Kyubi","why":"推し"},{"monster":"Orihime","why":"もう1人の推し"}],"dislikeMon":[{"monster":"Spooky","why":"動きが読めない"},{"monster":"Mitarashi","why":"のんびりで試合が長い"},{"monster":"Undine","why":"気まぐれで計算が合わない"}],"favColors":[{"color":"blue","why":"着物の色"},{"color":"sky","why":"沖縄の海"},{"color":"white","why":"表の紙"}]},
  {"id":"erubin","team":[{"monster":"Ark","nick":"ノア","lead":true,"why":"好きなモンスター","lv":23,"grow":"防御型(みんなを守る)","dye":{"colors":["black","orange","gray"]}},{"monster":"Kuromy","nick":"よぞら","lead":false,"why":"強いのについ目がいく","lv":20,"grow":"攻撃型","dye":{"colors":["orange","gray","black","orange","gray"]}},{"monster":"Mia","nick":"つばさ","lead":false,"why":"強いのについ目がいく","lv":17,"grow":"すばやさ型","dye":{"colors":["gray","black","orange"]}}],"deck":{"name":"みんなで守る","plan":"仲間を守るカードを多めに。ひとりも倒れさせないで勝つ"},"likeMon":[{"monster":"Ark","why":"好きなモンスター"},{"monster":"Kuromy","why":"強いのについ目がいく"},{"monster":"Mia","why":"強いのについ目がいく"}],"dislikeMon":[{"monster":"Zan","why":"せっかちで、ついていけない"},{"monster":"Yaobikuni","why":"ひんやりして少しこわい"},{"monster":"Ham","why":"にぎやかで、散歩が落ち着かない"}],"favColors":[{"color":"black","why":"いつもの服"},{"color":"orange","why":"茶色(ゲームに茶色が無いので橙で代用)"},{"color":"gray","why":"落ち着いた色"}]},
];
// >>> ASSISTANT_MASMON_PLAN

const assistantMasmonPlanOf = (id) => ASSISTANT_MASMON_PLAN.find(a => a && a.id === id) || null;
const assistantMasmonMon = (mid) => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[mid]) || null;
const assistantMasmonLineage = (mid) => { try { const l = typeof monsterLineageOf === 'function' ? monsterLineageOf(mid) : null; return (l && l.main) || null; } catch (_) { return null; } };
const assistantMasmonLineageName = (lin) => (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[lin] ? MONSTER_LINEAGES[lin].name : '');
// 好き・苦手の1行の表示名(血統なら「○○種」)
const assistantMasmonTasteName = (x) => {
  if (!x) return '';
  if (x.lineage) { const n = assistantMasmonLineageName(x.lineage); return n ? `${n}種` : ''; }
  const m = assistantMasmonMon(x.monster); return m ? m.name : '';
};
// 好き → その血統(主血統)にも少し広がる(剣士モッチーが好き → モッチー種もやや好き)。同じ名前になる所は出さない
const assistantMasmonSpread = (x) => {
  if (!x || !x.monster) return '';
  const lin = assistantMasmonLineage(x.monster), n = assistantMasmonLineageName(lin);
  const m = assistantMasmonMon(x.monster);
  return n && m && n !== m.name ? `${n}種` : '';
};

// MFバトルカードのデッキの型(カード部ソランドとすり合わせ・助手とのフリー対戦だけ)。相談で変わるのは次の段階
const ASSISTANT_MASMON_CARD_STYLE = Object.freeze({ mua: 'attack', kiki: 'attack', momosuke: 'normal', dra: 'guard', atsu: 'attack', kyuko: 'normal', sorashido: 'normal', erubin: 'guard' });
const assistantLifeCardStyle = (id) => {
  try { if (typeof assistantLifeEnabled === 'function' && !assistantLifeEnabled()) return null; } catch (_) { return null; }
  return ASSISTANT_MASMON_CARD_STYLE[id] || null;
};
// ココロ(AI のおしゃべり)が読む口: いまの好き・苦手を表示名で(2026-11-08 ココロとすり合わせ)。
//   changed は「好き嫌いが変わる」(GROW-PLAN 8)が入ってから埋まる。いまは空
const assistantLifeTasteOf = (id) => {
  try { if (typeof assistantLifeEnabled === 'function' && !assistantLifeEnabled()) return null; } catch (_) { return null; }
  const p = assistantMasmonPlanOf(id);
  if (!p) return null;
  const names = (xs) => [...new Set((xs || []).map(assistantMasmonTasteName).filter(Boolean))].slice(0, 5);
  return { likes: names(p.likeMon), dislikes: names(p.dislikeMon), changed: [] };
};

// 能力のゲージ(見た目用)。プレイヤーと同じ4つ。基礎値 × Lv の伸び × 育ち方
const ASSISTANT_MASMON_GROW_BIAS = Object.freeze({
  '攻撃型': { atk: 1.18 }, '防御型': { def: 1.18 }, 'ガッツ型': { guts: 1.18 }, 'ライフ型': { hp: 1.18 }, 'すばやさ型': { atk: 1.08, guts: 1.08 },
});
const ASSISTANT_MASMON_STAT_CAP = Object.freeze({ hp: 2200, atk: 560, def: 560, guts: 420 });
const ASSISTANT_MASMON_STAT_LABEL = Object.freeze([['hp', 'ライフ'], ['atk', '攻撃'], ['def', '防御'], ['guts', 'ガッツ']]);
const assistantMasmonGrowKind = (grow) => String(grow || '').split('(')[0];
const assistantMasmonStats = (t) => {
  const m = assistantMasmonMon(t && t.monster);
  if (!m) return null;
  const lv = Number.isFinite(t.lv) ? Math.max(1, t.lv) : 1;
  const bias = ASSISTANT_MASMON_GROW_BIAS[assistantMasmonGrowKind(t.grow)] || {};
  const base = { hp: m.baseHp, atk: m.baseAtk, def: m.baseDef, guts: m.baseGuts };
  const out = {};
  for (const [k] of ASSISTANT_MASMON_STAT_LABEL) {
    const b = Number.isFinite(base[k]) ? base[k] : 0;
    out[k] = Math.min(1, (b * (1 + (lv - 1) * 0.04) * (bias[k] || 1)) / ASSISTANT_MASMON_STAT_CAP[k]);
  }
  return out;
};
const assistantMasmonSwatch = (c) => (typeof MASU_COLOR_SWATCH !== 'undefined' && MASU_COLOR_SWATCH[c]) || '#94a3b8';
const assistantMasmonColorName = (c) => (typeof MASU_COLOR_LABELS !== 'undefined' && MASU_COLOR_LABELS[c]) || c;
const assistantMasmonRegions = (mid) => (typeof MASU_COLOR_REGION_HUES !== 'undefined' && Array.isArray(MASU_COLOR_REGION_HUES[mid]) ? MASU_COLOR_REGION_HUES[mid].length : 0);

// 好きなカード(カード部の表 CARD_AI_FAVORITE の種類)の絵。カードの表が無ければ出さない
const assistantMasmonFavCard = (id) => {
  try {
    const sp = typeof CARD_AI_FAVORITE !== 'undefined' ? CARD_AI_FAVORITE[id] : null;
    const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
    if (!sp || !db || !db.monsters) return null;
    const m = Object.values(db.monsters).find(x => x && x.species === sp && !x.variant);
    return m && typeof CARD_IMG === 'function' ? { name: m.name, src: CARD_IMG(m.img, 'l') } : null;
  } catch (_) { return null; }
};
// デッキのカードの並びは、カード部の読むだけの口 cardAssistantDeckPreview が main に入ってからつなぐ(2026-11-08 ソランドとすり合わせ済み)

const ASSISTANT_MASMON_TABS = Object.freeze([['mons', '🐾 マスモン'], ['team', '⚔ 編成'], ['deck', '🃏 デッキ'], ['taste', '💗 好き・苦手']]);

function AssistantMasmonPic({ t, size }) {
  const m = assistantMasmonMon(t.monster);
  if (!m) return null;
  const box = { width: size, height: size };
  return (
    <div className="mhm-pic" style={box}>
      {typeof DyedMonsterImage === 'function'
        ? <DyedMonsterImage baseId={t.monster} src={m.imgUrl} masuColors={t.dye && t.dye.colors} alt={m.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        : <img src={m.imgUrl} alt={m.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>}
    </div>);
}

function AssistantMasmonDots({ t }) {
  const n = assistantMasmonRegions(t.monster);
  const cs = ((t.dye && t.dye.colors) || []).slice(0, n || 5);
  return (
    <span className="inline-flex items-center gap-[3px] align-middle" data-assistant-masmon-dye={cs.join(',')}>
      {cs.map((c, i) => <i key={i} title={assistantMasmonColorName(c)} className="inline-block h-[9px] w-[9px] rounded-full border border-white/40" style={{ background: assistantMasmonSwatch(c) }}/>)}
      {n > 0 && <small className="ml-0.5 text-[9px] font-bold text-slate-400">{n}枠</small>}
    </span>);
}

function AssistantMasmonRow({ t, land = false }) {
  const m = assistantMasmonMon(t.monster);
  const st = assistantMasmonStats(t);
  if (!m || !st) return null;
  return (
    <div className="mhm-card flex gap-2.5" data-assistant-masmon-row={t.monster}>
      <AssistantMasmonPic t={t} size={78}/>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-black text-white">{t.nick}{t.lead && <em className="mhm-lead ml-1.5">先頭</em>}</p>
        <p className="truncate text-[10.5px] font-bold text-slate-300">{m.name} ・ Lv.{t.lv} <AssistantMasmonDots t={t}/></p>
        <p className="truncate text-[11px] font-black text-amber-200">📈 {t.grow}</p>
        <div className={`mt-0.5 grid gap-x-3 gap-y-0.5 ${land ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-300"><span className="w-[34px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(st[k] * 100)}%` }}/></span></div>))}
        </div>
      </div>
    </div>);
}

function AssistantMasmonSheet({ id, land = false, onClose }) {
  const [tab, setTab] = React.useState('mons');
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  const p = assistantMasmonPlanOf(id);
  if (!who || !p) return null;
  const team = [...p.team].sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0)).filter(t => assistantMasmonMon(t.monster));
  const fav = tab === 'deck' ? assistantMasmonFavCard(id) : null;
  let body = null;
  if (tab === 'mons') {
    body = (<>
      <div className={land ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>{team.map(t => <AssistantMasmonRow key={t.monster} t={t} land={land}/>)}</div>
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">🐾 {who.name}が自分で育てて、自分の好きな色に染めているマスモンです。</p>
    </>);
  } else if (tab === 'team') {
    body = (<>
      <div className="grid grid-cols-3 gap-2">
        {team.map(t => (
          <div key={t.monster} className="mhm-card relative text-center" data-assistant-masmon-team={t.monster}>
            {t.lead && <em className="mhm-lead absolute left-1.5 top-1.5 z-[1]">先頭</em>}
            <div className="mhm-stage"><AssistantMasmonPic t={t} size={land ? 104 : 92}/></div>
            <p className="mt-1 truncate text-[13px] font-black text-white">{t.nick}</p>
            <p className="truncate text-[10px] font-bold text-amber-200">Lv.{t.lv} ・ {assistantMasmonGrowKind(t.grow)}</p>
          </div>))}
      </div>
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">⚔ 編成は{who.name}が決めています。</p>
    </>);
  } else if (tab === 'deck') {
    body = (<>
      <div className="mhm-card" data-assistant-masmon-deck>
        <p className="text-[10px] font-black text-slate-400">MFバトルカードのデッキの型</p>
        <p className="text-[18px] font-black text-amber-200">🃏 {p.deck.name}</p>
        <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-slate-100">{p.deck.plan}</p>
      </div>
      {fav && (
        <div className="mhm-card mt-2 flex items-center gap-3" data-assistant-masmon-fav-card>
          <img src={fav.src} alt={fav.name} draggable={false} className="w-[74px] shrink-0 rounded-md shadow"/>
          <p className="text-[11.5px] font-bold leading-snug text-slate-100">好きなカード: <b className="text-white">{fav.name}</b></p>
        </div>)}
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">🃏 MFバトルカードのデッキは、マスモンとは別に組んでいます。</p>
    </>);
  } else {
    const line = (x, kind) => {
      const name = assistantMasmonTasteName(x);
      if (!name) return null;
      const m = x.monster ? assistantMasmonMon(x.monster) : null;
      const spread = kind === 'like' ? assistantMasmonSpread(x) : '';
      return (
        <div key={`${kind}-${x.monster || x.lineage}`} className="flex items-center gap-2 py-1" data-assistant-masmon-taste={`${kind}:${x.monster || x.lineage}`}>
          {m ? <img src={m.iconUrl || m.imgUrl} alt="" draggable={false} className="h-[34px] w-[34px] shrink-0 rounded-full bg-slate-500 object-contain"/> : <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-slate-800 text-[15px]">🧬</span>}
          <p className="min-w-0 text-[11.5px] font-bold leading-snug text-slate-100"><b className="text-white">{name}</b> … {x.why}{spread && <small className="block text-[10px] text-slate-400">{spread}も少し{kind === 'like' ? '好き' : '苦手'}</small>}</p>
        </div>);
    };
    body = (<div className={land ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
      <div className="mhm-card"><p className="text-[12px] font-black text-pink-300">💗 好き</p>{p.likeMon.map(x => line(x, 'like'))}</div>
      <div className="mhm-card"><p className="text-[12px] font-black text-sky-300">💦 苦手</p>{p.dislikeMon.length ? p.dislikeMon.map(x => line(x, 'dislike')) : <p className="py-1 text-[11.5px] font-bold text-slate-300">苦手なモンスターはいない</p>}</div>
      <div className="mhm-card"><p className="text-[12px] font-black text-amber-200">🎨 好きな色</p>
        {p.favColors.map(c => (
          <div key={c.color} className="flex items-center gap-2 py-1" data-assistant-masmon-color={c.color}>
            <i className="inline-block h-[22px] w-[22px] shrink-0 rounded-full border-2 border-white/50" style={{ background: assistantMasmonSwatch(c.color) }}/>
            <p className="text-[11.5px] font-bold text-slate-100"><b className="text-white">{assistantMasmonColorName(c.color)}</b> … {c.why}</p>
          </div>))}
      </div>
    </div>);
  }
  return (
    <div className="absolute inset-0" style={{ zIndex: 30 }} data-assistant-masmon-sheet={id} data-assistant-masmon-tab={tab}>
      <style>{ASSISTANT_MASMON_CSS}</style>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/70" onClick={onClose}/>
      <div className={`mhm-panel ${land ? 'is-land' : ''}`}>
        <div className="flex items-center gap-2">
          {typeof AssistantFace === 'function' && <span className="shrink-0 rounded-full ring-2 ring-pink-300"><AssistantFace who={who} size={38} accent={who.accent}/></span>}
          <div className="min-w-0 flex-1"><p className="mhl-en">MASMON · {String(who.id).toUpperCase()}</p><p className="truncate text-[19px] font-black text-white">{who.name}のマスモン</p></div>
          <button type="button" className="mhl-btn shrink-0 bg-slate-700 px-3" data-assistant-masmon-close onClick={onClose}>閉じる</button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1" role="tablist">
          {ASSISTANT_MASMON_TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`mhm-tab ${tab === k ? 'on' : ''}`} data-assistant-masmon-tab-btn={k} onClick={() => setTab(k)}>{label}</button>))}
        </div>
        <div className="mhm-body mt-2">{body}</div>
      </div>
    </div>);
}

// 部屋のシートの1行(先頭のマスモンとほかの数)。押すとシートを開く
function AssistantMasmonRoomRow({ id, onOpen }) {
  const p = assistantMasmonPlanOf(id);
  if (!p || typeof onOpen !== 'function') return null;
  const lead = p.team.find(t => t.lead) || p.team[0];
  const m = lead && assistantMasmonMon(lead.monster);
  if (!m) return null;
  return (
    <button type="button" className="mhl-row w-full text-left" data-assistant-life-room-masmon onClick={() => onOpen(id)}>
      <span className="k">🐾 マスモン</span>
      <span className="min-w-0 truncate text-[11px] font-bold"><b>{lead.nick}</b>({m.name} Lv.{lead.lv}) ほか{Math.max(0, p.team.length - 1)}体</span>
      <span className="ml-auto pl-1 text-[12px] font-black text-pink-300">›</span>
    </button>);
}

const ASSISTANT_MASMON_CSS = `
.mhm-panel{position:absolute;left:0;right:0;bottom:0;top:5%;display:flex;flex-direction:column;background:linear-gradient(180deg,#1f1640,#0b1020 70%);border-top:2px solid #f9a8d4;border-radius:22px 22px 0 0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));color:#fff}
.mhm-panel.is-land{top:0;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));border:2px solid #f9a8d4;border-bottom:0;padding:8px 14px 8px}
.mhm-body{flex:1;min-height:0;overflow-y:auto;padding:2px 2px 6px}
.mhm-tab{border-radius:999px;background:#1e293b;padding:6px 2px;font-size:11px;font-weight:900;color:#cbd5e1;white-space:nowrap}
.mhm-tab.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.mhm-card{border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.85);border-radius:14px;padding:8px 10px}
.mhm-pic{flex-shrink:0;border-radius:10px;background:radial-gradient(circle at 50% 40%,#94a3b8,#475569);overflow:hidden;margin:0 auto}
.mhm-stage{display:flex;justify-content:center}
.mhm-lead{font-style:normal;border-radius:999px;background:#f472b6;padding:0 6px;font-size:9.5px;font-weight:900;color:#fff;vertical-align:middle}
.mhm-bar{position:relative;flex:1;height:5px;border-radius:99px;background:#334155;overflow:hidden}
.mhm-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#f97316)}
`;
