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
  {"id":"mua","team":[{"monster":"KenshiMocchi","nick":"もち隊長","lead":true,"why":"好き。剣を持ったモッチーがかっこかわいい","lv":24,"grow":"すばやさ型(ノリで決めた)","dye":{"colors":["pink_light@85","sky@65",null,"pink_light@70",null]}},{"monster":"MelWhip","nick":"ほいっぷちゃん","lead":false,"why":"好き。甘くてかわいい","lv":16,"grow":"ライフ型","dye":{"colors":[null,"pink_light@90",null,null,null]}},{"monster":"Iblis","nick":"イブちゃん","lead":false,"why":"好き。ちょっと悪そうなのがいい","lv":14,"grow":"攻撃型","dye":{"colors":["green_light@70",null,"orange@55"]}}],"extra":[{"monster":"Mocchi","nick":"もちまる","why":"剣士モッチーの仲間。まるくてかわいい","lv":12,"grow":"ライフ型","welcome":4,"dye":{"colors":["sky@35",null,null]}},{"monster":"Melody","nick":"メロりん","why":"メルホイップの仲間。歌うと一緒に踊ってくれる","lv":10,"grow":"ガッツ型","welcome":7,"dye":{"colors":["pink_light@90","pink@90","sky@90","orange@85","pink_light@90"]}}],"deck":{"name":"キラキラ速攻","plan":"軽いカードを早く並べて、先に押し切る。ノリで決めて、勝てたらはしゃぐ"},"likeMon":[{"monster":"KenshiMocchi","why":"剣を持ったモッチーがかっこかわいい"},{"monster":"MelWhip","why":"甘くてかわいい"},{"monster":"Iblis","why":"ちょっと悪そうなのがいい"}],"dislikeMon":[{"monster":"Ghost","why":"こわいのはまぢ無理"},{"monster":"Monol","why":"かたくて地味"},{"monster":"Golem","why":"ごつくて、ちょっとこわい"}],"favColors":[{"color":"pink_light","why":"ふんわりかわいい"},{"color":"sky","why":"さわやか"},{"color":"pink","why":"はっきりかわいい"}]},
  {"id":"kiki","team":[{"monster":"Golem","nick":"ごろべえ","lead":true,"why":"好き。ちからに振るのが楽しい","lv":26,"grow":"攻撃型(ちからに振る)","dye":{"colors":["pink@64","red@49",null]}},{"monster":"Eiki","nick":"エイキさん","lead":false,"why":"好き。きりっとして強い","lv":17,"grow":"攻撃型","dye":{"colors":[null,"pink@68",null]}},{"monster":"Zan","nick":"ざんざん","lead":false,"why":"好き。速くて鋭い","lv":15,"grow":"すばやさ型","dye":{"colors":["green@53",null,"orange@41"]}}],"extra":[{"monster":"Tiger","nick":"ガオ","why":"ちからが強くて頼もしい","lv":14,"grow":"攻撃型","welcome":4,"dye":{"colors":["red@35",null,null]}},{"monster":"Pandora","nick":"ボム","why":"一撃が重くてかっこいい","lv":11,"grow":"攻撃型","welcome":7,"dye":{"colors":["pink@90","pink_light@90","red@90","cyan@85","pink@90"]}}],"deck":{"name":"ずっしり火力","plan":"守って耐えて、ちからの高いモンスターで一撃。数字よりも火力を信じる"},"likeMon":[{"monster":"Golem","why":"ちからに振るのが楽しい"},{"monster":"Eiki","why":"きりっとして強い"},{"monster":"Zan","why":"速くて鋭い"}],"dislikeMon":[{"monster":"Oboro","why":"力が低くて物足りない"},{"monster":"Monol","why":"力が低くて物足りない"},{"monster":"Plant","why":"力が低くて物足りない"}],"favColors":[{"color":"pink","why":"いつものリボンの色"},{"color":"red","why":"火力の色"},{"color":"pink_light","why":"やさしい"}]},
  {"id":"momosuke","team":[{"monster":"Melody","nick":"メロちゃん","lead":true,"why":"好き。一緒に歌える","lv":22,"grow":"ガッツ型(ステージ映え)","dye":{"colors":["magenta@90","pink@73",null,"magenta@78",null]}},{"monster":"Yggdrasil","nick":"ユグっち","lead":false,"why":"好きなユグドラシル種","lv":15,"grow":"ライフ型","dye":{"colors":[null,"magenta@90",null]}},{"monster":"Dreamy","nick":"ゆめっち","lead":false,"why":"好き。ゆめかわ","lv":13,"grow":"すばやさ型","dye":{"colors":["green@78",null,"orange@62",null,"green@67"]}}],"extra":[{"monster":"MelWhip","nick":"ホイップ","why":"ユグドラシル種だから大好き","lv":12,"grow":"ライフ型","welcome":4,"dye":{"colors":["pink@35",null,null,null,null]}},{"monster":"Illumine","nick":"ライトさん","why":"ドリーミィの仲間。スポットライトみたい","lv":9,"grow":"ガッツ型","welcome":7,"dye":{"colors":["magenta@90","purple_light@90","pink@90","green@85","magenta@90"]}}],"deck":{"name":"ステージ・オン","plan":"派手なカードで盛り上げる。勝っても負けても見せ場を作る"},"likeMon":[{"monster":"Melody","why":"一緒に歌える"},{"lineage":"yggdrasil","why":"ユグドラシル種はぜんぶ好き"},{"monster":"Dreamy","why":"ゆめかわ"}],"dislikeMon":[{"monster":"Golem","why":"ゴリゴリで一緒に踊れない"},{"monster":"Tiger","why":"ゴリゴリでこわい"},{"monster":"Iblis","why":"ゴリゴリでこわい"}],"favColors":[{"color":"magenta","why":"ステージの色"},{"color":"pink","why":"かわいい担当"},{"color":"purple_light","why":"ゆめかわ"},{"color":"yellow","why":"スポットライト"}]},
  {"id":"dra","team":[{"monster":"Suezo","nick":"メダマ焼き","lead":true,"why":"好き。ギャグが通じる","lv":18,"grow":"ライフ型(のんびり)","dye":{"colors":["green@90","orange@73",null]}},{"monster":"Golem","nick":"ゴロ助","lead":false,"why":"好き。何でも強く育てられる","lv":20,"grow":"攻撃型","dye":{"colors":[null,"green@90",null]}},{"monster":"Oboro","nick":"おぼろん","lead":false,"why":"一緒に昼寝","lv":14,"grow":"防御型","dye":{"colors":["pink@78",null,"orange@62"]}}],"extra":[{"monster":"Plant","nick":"はっぱ","why":"ひなたの丘で一緒に昼寝","lv":11,"grow":"ライフ型","welcome":4,"dye":{"colors":["orange@35",null,null]}},{"monster":"Mitarashi","nick":"おだんご","why":"のんびりしてて気が合う","lv":10,"grow":"防御型","welcome":7,"dye":{"colors":["green@90","black@90","orange@90"]}}],"deck":{"name":"のんびり長期戦","plan":"あわてず守って、長い試合で少しずつ削る。説明しながら打つ"},"likeMon":[{"monster":"Suezo","why":"ギャグが通じる"},{"monster":"Golem","why":"どっしりして強い"}],"dislikeMon":[{"monster":"Ark","why":"まぶしくて昼寝できない"},{"lineage":"ark","why":"アーク種はぜんぶ苦手"}],"favColors":[{"color":"green","why":"ひなたの丘の草"},{"color":"orange","why":"茶色っぽくて落ち着く"},{"color":"black","why":"落ち着く"}]},
  {"id":"atsu","team":[{"monster":"KenshiMocchi","nick":"師匠","lead":true,"why":"好き。モッチー種は特別","lv":27,"grow":"攻撃型(朝の育成)","dye":{"colors":["red@90","black@73",null,"red@78",null]}},{"monster":"Zan","nick":"ザンくん","lead":false,"why":"好き。速くて強い","lv":19,"grow":"すばやさ型","dye":{"colors":[null,"red@90",null]}},{"monster":"Spooky","nick":"スプ","lead":false,"why":"好きなゴースト種","lv":16,"grow":"攻撃型","dye":{"colors":["cyan@78",null,"orange@62",null,"cyan@67"]}}],"extra":[{"monster":"Ghost","nick":"ゴースト番長","why":"ゴースト種は強くてかっこいい","lv":15,"grow":"攻撃型","welcome":4,"dye":{"colors":["black@35",null,null]}},{"monster":"Mocchi","nick":"モチ","why":"モッチー種は特別","lv":12,"grow":"攻撃型","welcome":7,"dye":{"colors":["red@90","red@90","black@90"]}}],"deck":{"name":"真っ向勝負","plan":"強いモンスターで正面から。小細工はしない。負けたらすぐ再戦"},"likeMon":[{"monster":"KenshiMocchi","why":"モッチー種は特別"},{"monster":"Zan","why":"速くて強い"},{"lineage":"ghost","why":"ゴースト種は強くてかっこいい"}],"dislikeMon":[],"favColors":[{"color":"red","why":"勝負の色"},{"color":"black","why":"締まって見える"}]},
  {"id":"kyuko","team":[{"monster":"Illumine","nick":"ともしび","lead":true,"why":"好き。灯りが夜の読書に合う","lv":21,"grow":"ガッツ型(夜ふかしで育成)","dye":{"colors":["red_light@64","white@49",null,"red_light@53",null]}},{"monster":"Dreamy","nick":"ゆめの","lead":false,"why":"好き。夢の話ができる","lv":15,"grow":"ガッツ型","dye":{"colors":[null,"red_light@68",null,null,null]}},{"monster":"Pixie","nick":"ぴぃ","lead":false,"why":"好きなピクシー種","lv":14,"grow":"すばやさ型","dye":{"colors":["cyan_light@53",null,"orange@41"]}}],"extra":[{"monster":"Mia","nick":"ミア","why":"ピクシー種。歌声で本がはかどる","lv":12,"grow":"すばやさ型","welcome":4,"dye":{"colors":["white@35",null,null]}},{"monster":"Pandora","nick":"パンドラさん","why":"ピクシー種。夜のお話が似合う","lv":10,"grow":"ガッツ型","welcome":7,"dye":{"colors":["red_light@90","orange_light@90","white@90","black@85","red_light@90"]}}],"deck":{"name":"夜の読み筋","plan":"相手の手を読んで、最後にひっくり返す。数字と直感の両方で決める"},"likeMon":[{"monster":"Illumine","why":"灯りが夜の読書に合う"},{"monster":"Dreamy","why":"夢の話ができる"},{"lineage":"pixie","why":"ピクシー種はかわいい"}],"dislikeMon":[{"monster":"Suezo","why":"じっと見られると落ち着かない"},{"monster":"Ham","why":"元気すぎてつかれる"},{"monster":"Eiki","why":"きびきびしすぎて本が読めない"}],"favColors":[{"color":"red_light","why":"髪の色"},{"color":"white","why":"服の色"},{"color":"orange_light","why":"目の色"}]},
  {"id":"sorashido","team":[{"monster":"Kyubi","nick":"コン太","lead":true,"why":"推し","lv":25,"grow":"すばやさ型(記録どおり)","dye":{"colors":["blue@64","sky@49",null,"blue@53",null]}},{"monster":"Orihime","nick":"ヒメ","lead":false,"why":"もう1人の推し","lv":18,"grow":"ガッツ型","dye":{"colors":[null,"blue@68",null,null,null]}},{"monster":"Monol","nick":"ソロバン","lead":false,"why":"計算と表づくり","lv":15,"grow":"防御型","dye":{"colors":["orange@53",null,"orange@41"]}}],"extra":[{"monster":"Ham","nick":"ハムスケ","why":"大声で場をかき回す。計算に入れやすい","lv":12,"grow":"すばやさ型","welcome":4,"dye":{"colors":["sky@35",null,null]}},{"monster":"Golem","nick":"ガンコ","why":"数字が安定していて計算しやすい","lv":11,"grow":"防御型","welcome":7,"dye":{"colors":["blue@90","white@90","sky@90"]}}],"deck":{"name":"計算ずく","plan":"記録から勝ち筋を決めて、その通りに打つ。表は毎晩書き直す"},"likeMon":[{"monster":"Kyubi","why":"推し"},{"monster":"Orihime","why":"もう1人の推し"}],"dislikeMon":[{"monster":"Spooky","why":"動きが読めない"},{"monster":"Mitarashi","why":"のんびりで試合が長い"},{"monster":"Undine","why":"気まぐれで計算が合わない"}],"favColors":[{"color":"blue","why":"着物の色"},{"color":"sky","why":"沖縄の海"},{"color":"white","why":"表の紙"}]},
  {"id":"erubin","team":[{"monster":"Ark","nick":"ノア","lead":true,"why":"好きなモンスター","lv":23,"grow":"防御型(みんなを守る)","dye":{"colors":["black@85","orange@65",null]}},{"monster":"Kuromy","nick":"よぞら","lead":false,"why":"強いのについ目がいく","lv":20,"grow":"攻撃型","dye":{"colors":[null,"black@90",null,null,null]}},{"monster":"Mia","nick":"つばさ","lead":false,"why":"強いのについ目がいく","lv":17,"grow":"すばやさ型","dye":{"colors":["white@70",null,"orange@55"]}}],"extra":[{"monster":"Iblis","nick":"ルシ","why":"アーク種。みんなを守る","lv":13,"grow":"防御型","welcome":4,"dye":{"colors":["orange@35",null,null]}},{"monster":"Yggdrasil","nick":"こかげ","why":"よぞらと同じ木の仲間","lv":9,"grow":"ライフ型","welcome":7,"dye":{"colors":["black@90","gray@90","orange@90"]}}],"deck":{"name":"みんなで守る","plan":"仲間を守るカードを多めに。ひとりも倒れさせないで勝つ"},"likeMon":[{"monster":"Ark","why":"好きなモンスター"},{"monster":"Kuromy","why":"強いのについ目がいく"},{"monster":"Mia","why":"強いのについ目がいく"}],"dislikeMon":[{"monster":"Zan","why":"せっかちで、ついていけない"},{"monster":"Yaobikuni","why":"ひんやりして少しこわい"},{"monster":"Ham","why":"にぎやかで、散歩が落ち着かない"}],"favColors":[{"color":"black","why":"いつもの服"},{"color":"orange","why":"茶色っぽくて落ち着く"},{"color":"gray","why":"落ち着いた色"}]},
];
// >>> ASSISTANT_MASMON_PLAN

const assistantMasmonBasePlanOf = (id) => ASSISTANT_MASMON_PLAN.find(a => a && a.id === id) || null;
// プレイヤーごとのマスモン(2026-11-08 社長の選び ❶B): 保存した made があれば、表の team・extra をそれに差し替えて見せる(表は作る前の控え)
const assistantMasmonPlanOf = (id) => {
  const base = assistantMasmonBasePlanOf(id);
  if (!base) return null;
  let made = null; try { made = typeof ASSISTANT_MASMON_STORE !== 'undefined' && ASSISTANT_MASMON_STORE.state.made ? ASSISTANT_MASMON_STORE.state.made[id] : null; } catch (_) { made = null; }
  if (!Array.isArray(made) || made.length < 3) return base;
  const row = (t) => ({ monster: t.monster, nick: t.nick, why: t.why, lv: t.lv, grow: t.grow, dye: { colors: [...t.colors] } });
  return { ...base, team: made.filter(t => t.slot <= 3).map(t => ({ ...row(t), lead: t.slot === 1 })), extra: made.filter(t => t.slot >= 4).map(t => ({ ...row(t), welcome: t.slot === 4 ? 4 : 7 })) };
};
const assistantMasmonMonOk = (t) => !!(t && typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[t.monster]);
// 編成の3体(先頭が先)と、控え(2026-11-08 社長「空いてる枠にほかのますもんもふやす」で足した extra)
const assistantMasmonTeam = (p) => (p ? [...p.team].sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0)).filter(assistantMasmonMonOk) : []);
// 迎えた記録(新しいキー。今の3体の記録には触らない): { v:1, welcomed: { [助手id]: { [モンスターid]: 'YYYY-MM-DD' } } }
const ASSISTANT_MASMON_KEY = 'mh_assistant_life_masmon_v1';
const ASSISTANT_MASMON_COLOR_RE = /^[a-z_]{2,16}(@(100|[1-9]\d))?$/;
const normalizeAssistantMasmonMade = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [aid, list] of Object.entries(raw)) {
    if (!assistantMasmonBasePlanOf(aid) || !Array.isArray(list)) continue;
    const rows = []; const slots = new Set(); const mons = new Set();
    for (const t of list.slice(0, 5)) {
      if (!t || typeof t !== 'object') continue;
      const slot = Number(t.slot), lv = Number(t.lv);
      if (!Number.isInteger(slot) || slot < 1 || slot > 5 || slots.has(slot) || typeof t.monster !== 'string' || mons.has(t.monster)) continue;
      if (typeof t.nick !== 'string' || !t.nick || t.nick.length > 16 || !Number.isFinite(lv)) continue;
      const colors = Array.isArray(t.colors) ? t.colors.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_COLOR_RE.test(c) ? c : null)) : [];
      slots.add(slot); mons.add(t.monster);
      rows.push({ slot, monster: t.monster, nick: t.nick, lv: Math.max(1, Math.min(99, Math.round(lv))), grow: typeof t.grow === 'string' ? t.grow.slice(0, 30) : '', why: typeof t.why === 'string' ? t.why.slice(0, 40) : '', colors, ai: t.ai === true });
    }
    if (rows.length >= 3 && slots.has(1)) out[aid] = rows.sort((a, b) => a.slot - b.slot);
  }
  return out;
};
const normalizeAssistantMasmonSave = (raw) => {
  const out = { v: 1, welcomed: {}, seed: '', made: {}, named: false, noticed: {} };
  if (raw && typeof raw === 'object') {
    if (typeof raw.seed === 'string' && /^[\w-]{4,60}$/.test(raw.seed)) out.seed = raw.seed;
    out.made = normalizeAssistantMasmonMade(raw.made);
    out.named = raw.named === true;
    if (raw.noticed && typeof raw.noticed === 'object') for (const [k, v] of Object.entries(raw.noticed)) if (v === true && assistantMasmonBasePlanOf(k)) out.noticed[k] = true;
  }
  const w = raw && typeof raw === 'object' && raw.welcomed && typeof raw.welcomed === 'object' ? raw.welcomed : {};
  for (const [aid, mons] of Object.entries(w)) {
    if (!mons || typeof mons !== 'object' || Array.isArray(mons)) continue;
    const m = {}; for (const [mid, day] of Object.entries(mons)) if (typeof day === 'string' && day) m[mid] = day;
    out.welcomed[aid] = m;
  }
  return out;
};
const ASSISTANT_MASMON_STORE = { state: normalizeAssistantMasmonSave(null), loaded: false, subs: new Set(),
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  async load() {
    if (this.loaded) return this.state;
    let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_KEY, null, false) : null; } catch (_) {}
    this.loaded = true; this.set(normalizeAssistantMasmonSave(raw));
    try { await assistantMasmonEnsureMade(); } catch (_) {}
    return this.state;
  } };
// ---------- プレイヤーごとに違うマスモン(2026-11-08 社長の選び ❶B 先頭もプレイヤーごと ❷B 名前は Claude API で1人1回) ----------
// 候補: 表の編成3体・迎える2体に、好きなモンスターとその血統・性格に合う「控え」を足したもの(苦手とその血統は入れない・実装済みだけ)。
//   先頭(slot 1)は「好き」の3体(表の編成)から。2〜5体目は残りの候補から。1人1回だけ決めて mh_assistant_life_masmon_v1 の made に保存(あとで表を直しても変えない)
const ASSISTANT_MASMON_POOL_MORE = Object.freeze({
  mua: [{ monster: 'Pixie', nick: 'ぴくぴく', why: 'キラキラしててかわいい', lv: 9, grow: 'すばやさ型' }],
  kiki: [{ monster: 'Ghost', nick: 'ゴーくん', why: 'ふわふわなのに力持ち', lv: 9, grow: '攻撃型' }],
  momosuke: [{ monster: 'Kuromy', nick: 'クロちゃん', why: 'ユグドラシル種。ステージ衣装みたい', lv: 10, grow: 'ガッツ型' }],
  dra: [{ monster: 'Monol', nick: 'くろいた', why: '黒くて落ち着く。どっしり', lv: 8, grow: '防御型' }],
  atsu: [{ monster: 'Eiki', nick: 'センくん', why: 'ザンの仲間。速くて強い', lv: 11, grow: 'すばやさ型' }],
  kyuko: [{ monster: 'Snegurochka', nick: 'ゆきの', why: '静かで、夜の読書のおともに', lv: 8, grow: 'ガッツ型' }],
  sorashido: [{ monster: 'Eiki', nick: 'サクラ', why: '手の内がはっきりしていて読みやすい', lv: 9, grow: '攻撃型' }],
  erubin: [{ monster: 'Orihime', nick: 'ほしの', why: '強いのについ目がいく', lv: 10, grow: 'ガッツ型' }],
});
// 決まった種からの乱数(同じ種なら何度でも同じ並び)
const assistantMasmonRng = (seedText) => { let h = 2166136261; for (const ch of String(seedText)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } let x = h >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
const assistantMasmonShuffle = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 染め方(たたき台 masmon-life/dye-vary.js の5つの型をゲームへ移したもの。型の順・好きな色の順・濃さの少しの差がプレイヤーごと)
const ASSISTANT_MASMON_OPP = Object.freeze({ red: 'cyan', orange: 'blue', yellow: 'purple', lime: 'magenta', green: 'pink', teal: 'red', cyan: 'red', sky: 'orange', blue: 'orange', purple: 'yellow', magenta: 'green', pink: 'green', black: 'white', white: 'black', gray: 'black' });
const ASSISTANT_MASMON_TEMPER = Object.freeze({ kiki: 'quiet', kyuko: 'quiet', sorashido: 'quiet', mua: 'mid', erubin: 'mid', momosuke: 'bold', atsu: 'bold', dra: 'bold' });
const assistantMasmonDyeMake = (aid, p, monster, style, rnd) => {
  const opp = (c) => { const light = c.endsWith('_light'); const o = ASSISTANT_MASMON_OPP[c.replace('_light', '')] || 'gray'; return light && !['black', 'white', 'gray'].includes(o) ? `${o}_light` : o; };
  const fav0 = (p.favColors || []).map(x => x.color).filter(Boolean);
  const fav = fav0.length ? (rnd() < 0.5 ? fav0 : [...fav0.slice(1), fav0[0]]) : ['pink'];
  const f = (i) => fav[i % fav.length];
  const t = ASSISTANT_MASMON_TEMPER[aid] || 'mid';
  const k = (base) => { let a = base; if (t === 'quiet' && style !== 5) a *= 0.75; if (t === 'bold' && style !== 4) a = Math.min(90, a * 1.12); a += Math.round((rnd() - 0.5) * 10); return Math.max(20, Math.min(90, Math.round(a))); };
  const at = (c, a) => (c ? `${c}@${a}` : null);
  const tpl = {
    1: [at(f(0), k(85)), at(f(1), k(65)), null, at(f(0), k(70)), null],
    2: [null, at(f(0), k(90)), null, null, null],
    3: [at(opp(f(0)), k(70)), null, at('orange', k(55)), null, at(opp(f(0)), k(60))],
    4: [at(f(1), 35), null, null, null, null],
    5: [at(f(0), 90), at(f(2) || opp(f(0)), 90), at(f(1), 90), at(opp(f(1)), 85), at(f(0), 90)],
  }[style];
  const regions = typeof MASU_COLOR_REGION_HUES !== 'undefined' && Array.isArray(MASU_COLOR_REGION_HUES[monster]) ? MASU_COLOR_REGION_HUES[monster].length : 3;
  const cols = tpl.slice(0, regions); while (cols.length < regions) cols.push(null);
  if (!cols.some(Boolean)) cols[0] = tpl.find(Boolean);
  return cols;
};
// 1人の助手ぶん(最大5体)を決める
const assistantMasmonMakeFor = (aid, seed) => {
  const p = assistantMasmonBasePlanOf(aid);
  if (!p) return null;
  const rnd = assistantMasmonRng(`${seed}|${aid}|masmon-v1`);
  const ok = (t) => assistantMasmonMonOk(t);
  const likes = p.team.filter(ok);
  const rest = [...(p.extra || []), ...(ASSISTANT_MASMON_POOL_MORE[aid] || [])].filter(ok);
  if (!likes.length) return null;
  const lead = likes[Math.floor(rnd() * likes.length)];
  const others = assistantMasmonShuffle([...likes.filter(t => t !== lead), ...rest], rnd);
  const picked = [lead]; const mons = new Set([lead.monster]);
  for (const t of others) { if (picked.length >= 5) break; if (!mons.has(t.monster)) { picked.push(t); mons.add(t.monster); } }
  const styles = [1, ...assistantMasmonShuffle([2, 3, 4, 5], rnd)];
  return picked.map((t, i) => {
    const lv0 = Number.isFinite(t.lv) ? t.lv : 10;
    const lv = Math.max(1, i === 0 ? lv0 + Math.round((rnd() - 0.5) * 6) : Math.min(lv0 + Math.round((rnd() - 0.5) * 6), 30));
    return { slot: i + 1, monster: t.monster, nick: t.nick, lv, grow: t.grow || '', why: t.why || '', colors: assistantMasmonDyeMake(aid, p, t.monster, styles[i], rnd), ai: false };
  });
};
// 足りない助手のぶんだけ作って保存する(すでにある人の分は変えない)。種はブリーダーID、無ければ1回だけ作った乱数
const assistantMasmonEnsureMade = async () => {
  const cur = ASSISTANT_MASMON_STORE.state;
  const need = ASSISTANT_MASMON_PLAN.map(a => a.id).filter(id => !cur.made[id]);
  if (need.length) {
    let seed = cur.seed;
    if (!seed) {
      let bid = null; try { bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null; } catch (_) { bid = null; }
      seed = typeof bid === 'string' && /^[\w-]{4,60}$/.test(bid) ? bid : `r-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    }
    const made = { ...cur.made };
    for (const id of need) { const m = assistantMasmonMakeFor(id, seed); if (m) made[id] = m; }
    const next = { ...ASSISTANT_MASMON_STORE.state, seed, made };
    ASSISTANT_MASMON_STORE.set(next);
    try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
  }
  void assistantMasmonAskNames();
};
// 名前を Claude API で1人1回(assistant-chat の kind:'masmon_names')。印 assistantMasmonNamesApi が偽・失敗のときは表の名前のまま
let _assistantMasmonNamesBusy = false;
const assistantMasmonAskNames = async () => {
  const st = ASSISTANT_MASMON_STORE.state;
  if (st.named || _assistantMasmonNamesBusy) return 'skip';
  if (!(typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonNamesApi === true) || typeof ASSISTANT_CHAT_URL === 'undefined' || typeof SB_HEADERS === 'undefined') return 'skip';
  const items = Object.entries(st.made).map(([a, list]) => ({ a, s: list.map(t => { const m = assistantMasmonMon(t.monster); return { slot: t.slot, mon: m ? m.name : t.monster, why: t.why }; }) }));
  if (!items.length) return 'skip';
  let bid = null; try { bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null; } catch (_) { bid = null; }
  if (!bid) return 'skip';
  _assistantMasmonNamesBusy = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res = null;
    try {
      const r = await fetch(ASSISTANT_CHAT_URL, { method: 'POST', headers: SB_HEADERS, signal: controller.signal, body: JSON.stringify({ kind: 'masmon_names', breederId: bid, items }) });
      res = r.ok ? await r.json() : null;
    } finally { clearTimeout(timer); }
    if (!res || res.ok !== true || !res.names || typeof res.names !== 'object') return res && res.kind === 'tired' ? 'tired' : 'failed';
    const cur = ASSISTANT_MASMON_STORE.state;
    const made = {};
    for (const [a, list] of Object.entries(cur.made)) {
      const got = res.names[a] && typeof res.names[a] === 'object' ? res.names[a] : {};
      const usedNames = new Set();
      made[a] = list.map(t => { const n = typeof got[t.slot] === 'string' ? got[t.slot].trim() : ''; const okName = /^[ぁ-ゖァ-ヺー一-龠々・]{2,8}$/u.test(n) && !usedNames.has(n); if (okName) usedNames.add(n); return okName ? { ...t, nick: n, ai: true } : t; });
    }
    const next = { ...cur, made, named: true };
    ASSISTANT_MASMON_STORE.set(next);
    try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
    return 'ok';
  } catch (_) { return 'failed'; } finally { _assistantMasmonNamesBusy = false; }
};
// フレンドの家の控えに写す口(オトズレ3): その人のマスモン [{ monster, nick, colors, lead }](先頭が先・編成3体+迎えた控え)
const assistantLifeMasmonTeamOf = (id) => {
  try {
    const p = assistantMasmonPlanOf(id);
    if (!p) return [];
    return [...assistantMasmonTeam(p), ...assistantMasmonBench(p)].map(t => ({ monster: t.monster, nick: t.nick, colors: [...((t.dye && t.dye.colors) || [])], lead: !!t.lead }));
  } catch (_) { return []; }
};
const useAssistantMasmonSave = () => {
  const [st, setSt] = React.useState(ASSISTANT_MASMON_STORE.state);
  React.useEffect(() => { ASSISTANT_MASMON_STORE.subs.add(setSt); void ASSISTANT_MASMON_STORE.load(); return () => { ASSISTANT_MASMON_STORE.subs.delete(setSt); }; }, []);
  return st;
};
const assistantMasmonWelcomed = (aid, st = ASSISTANT_MASMON_STORE.state) => (st && st.welcomed && st.welcomed[aid]) || {};
// 迎えたぶんだけの控え(2026-11-08 社長の選び B: 5体まで・仲良し度が上がると迎える)
const assistantMasmonBench = (p, st = ASSISTANT_MASMON_STORE.state) => (p && Array.isArray(p.extra) ? p.extra.filter(t => assistantMasmonMonOk(t) && assistantMasmonWelcomed(p.id, st)[t.monster]).map(t => ({ ...t, bench: true })) : []);
// まだ迎えていない・仲良し度が届いた最初の1体
const assistantMasmonToWelcome = (p, bondLv, st = ASSISTANT_MASMON_STORE.state) => {
  if (!p || !Array.isArray(p.extra) || !Number.isFinite(bondLv)) return null;
  const done = assistantMasmonWelcomed(p.id, st);
  return p.extra.find(t => assistantMasmonMonOk(t) && !done[t.monster] && Number.isFinite(t.welcome) && bondLv >= t.welcome) || null;
};
const assistantMasmonWelcome = async (aid, t) => {
  await ASSISTANT_MASMON_STORE.load();
  const cur = ASSISTANT_MASMON_STORE.state;
  if (assistantMasmonWelcomed(aid, cur)[t.monster]) return false; // 二度は迎えない
  const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : new Date().toISOString().slice(0, 10);
  const next = { ...cur, welcomed: { ...cur.welcomed, [aid]: { ...assistantMasmonWelcomed(aid, cur), [t.monster]: day } } };
  ASSISTANT_MASMON_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
  try { if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${assistantLifeName(aid)}が新しいマスモン「${t.nick}」を迎えた`, [aid]); } catch (_) {}
  return true;
};
// 迎える場面のひとこと(案。{name} はプレイヤーの呼び名・{mon} はモンスター名・{nick} はニックネーム)
// 迎える場面のひとこと(2026-11-08 コトバ・ツムギ。社長の「この文で」待ち)。{name}=呼び方/{mon}=種類名/{nick}=名前(人ごとに違うので、特定のモンスターに寄せない)
const ASSISTANT_MASMON_WELCOME_LINES = Object.freeze({
  mua: '{name}、見て見てー！ 新しいマスモン迎えたの✨ {mon}の「{nick}」！ よろしくね♪',
  kiki: '{name}、新しいマスモンをお迎えしました。{mon}の「{nick}」でつ。よろしくお願いしまつ♪',
  momosuke: '{name}〜！！ ももの新しい仲間、{mon}の「{nick}」だよ♡ いっしょにステージ立とうね！！',
  dra: 'おう、{name}。新しいマスモンが来たぞ。{mon}の「{nick}」だ。のんびり育てていくからな',
  atsu: '{name}！ 新しい仲間が来た笑 {mon}の「{nick}」、よろしく頼む！',
  kyuko: 'ほい、{name}。新しいマスモン迎えたよ〜。{mon}の「{nick}」、仲良くしてねぇ',
  sorashido: 'うぉぉぉ！{name}、新しい仲間だぜ・・・！ {mon}の「{nick}」、表にも足しとくな笑',
  erubin: '{name}、新しい仲間を迎えたよ。{mon}の「{nick}」。仲良くしてくれるとうれしいな',
});
// 名前を付け直したあとの1回だけ(同じくコトバ・ツムギ。社長の「この文で」待ち)
const ASSISTANT_MASMON_RENAMED_LINES = Object.freeze({
  mua: '{name}、マスモンたちに新しい名前つけたの！ 見てみてー✨',
  kiki: '{name}、マスモンたちに新しいお名前を付けました。見てくださいな♪',
  momosuke: '{name}！！ マスモンみんなに新しい名前つけたよ♡ 見て見て！！',
  dra: '{name}、マスモンたちに新しい名前を付けたぞ。見てやってくれ',
  atsu: '{name}、マスモンたちに新しい名前付けた笑 見てって！',
  kyuko: 'ほい、{name}。マスモンたちに新しい名前付けたよ〜。見てみてねぇ',
  sorashido: '{name}、マスモンたちに新しい名前を付けたぜ・・・！ 見てくれ笑',
  erubin: '{name}、マスモンたちに新しい名前を付けたんだ。見てくれるかな',
});
const assistantMasmonRenamedLine = (aid) => { const call = typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(aid) : 'あなた'; return String(ASSISTANT_MASMON_RENAMED_LINES[aid] || '{name}、マスモンたちに新しい名前を付けたよ').split('{name}').join(call); };
const assistantMasmonWelcomeLine = (aid, t) => {
  const m = assistantMasmonMon(t.monster);
  const call = typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(aid) : 'あなた';
  return String(ASSISTANT_MASMON_WELCOME_LINES[aid] || '{name}、新しいマスモンを迎えたよ。{mon}の「{nick}」').split('{name}').join(call).split('{mon}').join(m ? m.name : '').split('{nick}').join(t.nick);
};
const assistantMasmonAll = (p) => [...assistantMasmonTeam(p), ...assistantMasmonBench(p)];
const assistantMasmonMon = (mid) => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[mid]) || null;
const assistantMasmonLineage = (mid) => { try { const l = typeof monsterLineageOf === 'function' ? monsterLineageOf(mid) : null; const m = l && l.main; return (m && typeof m === 'object' ? m.id : m) || null; } catch (_) { return null; } };
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

// ココロの受け口(56-assistant-chat.jsx の入れ物)へ渡す。onTalk は「好き嫌いが変わる」を作るときに足す
if (typeof ASSISTANT_CHAT_TASTE_HOOKS === 'object' && ASSISTANT_CHAT_TASTE_HOOKS) { ASSISTANT_CHAT_TASTE_HOOKS.of = assistantLifeTasteOf; }

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

// まだ迎えていない枠(影の姿と、迎える仲良し度)。空いた枠を埋めつつ、迎えるのを楽しみにできるように
const assistantMasmonWaiting = (p, st = ASSISTANT_MASMON_STORE.state) => (p && Array.isArray(p.extra) ? p.extra.filter(t => assistantMasmonMonOk(t) && !assistantMasmonWelcomed(p.id, st)[t.monster]) : []);
function AssistantMasmonWaitCard({ t, land = false, small = false }) {
  const m = assistantMasmonMon(t.monster);
  if (!m) return null;
  const size = small ? (land ? 60 : 84) : 78;
  const pic = <div className="mhm-pic" style={{ width: size, height: size }}><img src={m.imgUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) opacity(.55)' }}/></div>;
  if (small) return (
    <div className="text-center" data-assistant-masmon-wait={t.monster}>
      <div className="mhm-stage">{pic}</div>
      <p className="mt-0.5 text-[11px] font-black text-slate-300">？？？</p>
      <p className="text-[9.5px] font-bold text-sky-200">仲良し度 Lv{t.welcome}</p>
    </div>);
  return (
    <div className="mhm-card flex items-center gap-2.5" style={{ borderStyle: 'dashed' }} data-assistant-masmon-wait={t.monster}>
      {pic}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black text-slate-300">？？？</p>
        <p className="text-[11px] font-bold leading-snug text-sky-200" style={{ wordBreak: 'auto-phrase' }}>🔒 仲良し度 Lv{t.welcome} になると、新しいマスモンを迎えます</p>
      </div>
    </div>);
}

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
      {cs.map((c, i) => { const b = c ? String(c).split('@')[0] : null; const al = c && String(c).includes('@') ? Number(String(c).split('@')[1]) / 100 : 1; return b
        ? <i key={i} title={assistantMasmonColorName(b)} className="inline-block h-[9px] w-[9px] rounded-full border border-white/40" style={{ background: assistantMasmonSwatch(b), opacity: Math.max(.35, al) }}/>
        : <i key={i} title="元の色" className="inline-block h-[9px] w-[9px] rounded-full border border-dashed border-white/60"/>; })}
      {n > 0 && <small className="ml-0.5 text-[9px] font-bold text-slate-400">{n}枠</small>}
    </span>);
}

function AssistantMasmonRow({ t, land = false, onOpen = null }) {
  const m = assistantMasmonMon(t.monster);
  const st = assistantMasmonStats(t);
  if (!m || !st) return null;
  return (
    <button type="button" className="mhm-card flex w-full gap-2.5 text-left" data-assistant-masmon-row={t.monster} onClick={() => onOpen && onOpen(t)}>
      <AssistantMasmonPic t={t} size={78}/>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-black leading-tight text-white"><span className="break-all">{t.nick}</span>{t.lead && <em className="mhm-lead">先頭</em>}{t.bench && <em className="mhm-lead mhm-bench">控え</em>}</p>
        {land
          ? <><p className="flex flex-wrap gap-x-1 text-[10.5px] font-bold leading-tight text-slate-300"><span className="break-all">{m.name}</span><span className="whitespace-nowrap">・ Lv.{t.lv}</span></p><p className="text-[10px]"><AssistantMasmonDots t={t}/></p></>
          : <p className="truncate text-[10.5px] font-bold text-slate-300">{m.name} ・ Lv.{t.lv} <AssistantMasmonDots t={t}/></p>}
        <p className="text-[11px] font-black leading-tight text-amber-200">📈 {t.grow}</p>
        <div className={`mt-0.5 grid gap-x-3 gap-y-0.5 ${land ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-300"><span className="w-[34px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(st[k] * 100)}%` }}/></span></div>))}
        </div>
      </div>
    </button>);
}

function AssistantMasmonSheet({ id, land = false, onClose, bondLv = null }) {
  const [tab, setTab] = React.useState('mons');
  const [detail, setDetail] = React.useState(null); // 押したマスモン(詳細画面)
  const save = useAssistantMasmonSave();
  const [welcome, setWelcome] = React.useState(null); // 迎える場面
  const [renamed, setRenamed] = React.useState(false); // 名前を付け直したあとの1回だけの1行
  React.useEffect(() => {
    let alive = true;
    (async () => {
      await ASSISTANT_MASMON_STORE.load();
      const p0 = assistantMasmonPlanOf(id), t = assistantMasmonToWelcome(p0, Number(bondLv));
      if (t && await assistantMasmonWelcome(id, t) && alive) setWelcome(t);
      // 名前を付け直したあと、その助手のシートを初めて開いたときだけ1行(二度出さない・新しいキーの noticed)
      const st = ASSISTANT_MASMON_STORE.state;
      if (st.named && !st.noticed[id] && alive) {
        setRenamed(true);
        const next = { ...st, noticed: { ...st.noticed, [id]: true } };
        ASSISTANT_MASMON_STORE.set(next);
        try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
      }
    })();
    return () => { alive = false; };
  }, [id, bondLv]);
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  const p = assistantMasmonPlanOf(id);
  if (!who || !p) return null;
  const team = assistantMasmonTeam(p), bench = assistantMasmonBench(p, save), all = [...team, ...bench], waiting = assistantMasmonWaiting(p, save);
  const fav = tab === 'deck' ? assistantMasmonFavCard(id) : null;
  let body = null;
  if (tab === 'mons') {
    body = (<>
      {renamed && <p className="mhm-card mb-2 text-[11.5px] font-bold leading-snug text-slate-100" data-assistant-masmon-renamed>{who.name}「{assistantMasmonRenamedLine(id)}」</p>}
      <div className={land ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>{all.map(t => <AssistantMasmonRow key={t.monster} t={t} land={land} onOpen={setDetail}/>)}{waiting.map(t => <AssistantMasmonWaitCard key={t.monster} t={t} land={land}/>)}</div>
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">🐾 {who.name}が自分で育てて、自分の好きな色に染めているマスモンです。押すと詳しく見られます。</p>
    </>);
  } else if (tab === 'team') {
    body = (<>
      <div className="grid grid-cols-3 gap-2">
        {team.map(t => (
          <button type="button" key={t.monster} className="mhm-card relative flex flex-col items-stretch text-center" style={{ justifyContent: 'flex-start' }} data-assistant-masmon-team={t.monster} onClick={() => setDetail(t)}>
            {t.lead && <em className="mhm-lead absolute left-1.5 top-1.5 z-[1]">先頭</em>}
            <div className="mhm-stage"><AssistantMasmonPic t={t} size={land ? 104 : 104}/></div>
            <p className="mt-1 truncate text-[13px] font-black text-white">{t.nick}</p>
            <p className="truncate text-[10px] font-bold text-amber-200">Lv.{t.lv} ・ {assistantMasmonGrowKind(t.grow)}</p>
            {!land && <p className="mt-0.5 text-[9.5px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'auto-phrase', minHeight: '2.6em' }}>⚔ {assistantMasmonSkills(t).slice(-2).join('・')}</p>}
            {!land && (() => { const st = assistantMasmonStats(t) || {}; return <div className="mt-1 grid gap-0.5">{ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => <div key={k} className="flex items-center gap-1 text-[8.5px] font-bold text-slate-400"><span className="w-[26px] shrink-0 text-left">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round((st[k] || 0) * 100)}%` }}/></span></div>)}</div>; })()}
          </button>))}
      </div>
      {(() => {
        const kinds = team.map(t => assistantMasmonGrowKind(t.grow));
        const atk = kinds.filter(k => k === '攻撃型' || k === 'すばやさ型').length, def = kinds.filter(k => k === '防御型' || k === 'ライフ型').length;
        const style = atk >= 2 ? '⚔ 攻め' : def >= 2 ? '🛡 守り' : '⚖ バランス';
        const sum = { hp: 0, atk: 0, def: 0, guts: 0 };
        for (const t of team) { const st = assistantMasmonStats(t) || {}; for (const k of Object.keys(sum)) sum[k] += (st[k] || 0) / Math.max(1, team.length); }
        const lead = team[0];
        return (
          <div className={`mt-2 grid gap-2 ${land ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="mhm-card" data-assistant-masmon-team-info>
              <p className="text-[10px] font-black text-slate-400">編成の型</p>
              <p className="text-[16px] font-black text-amber-200">{style}</p>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
                  <div key={k} className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-300"><span className="w-[34px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(sum[k] * 100)}%` }}/></span></div>))}
              </div>
              {lead && <p className="mt-1.5 text-[11px] font-bold leading-snug text-slate-100" style={{ wordBreak: 'auto-phrase' }}>💬 {who.name}「先頭は{lead.nick}。{lead.why}」</p>}
            </div>
            {(bench.length > 0 || waiting.length > 0) && (
              <div className="mhm-card" data-assistant-masmon-bench>
                <p className="text-[10px] font-black text-slate-400">控え</p>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  {bench.map(t => (
                    <button key={t.monster} type="button" className="text-center" data-assistant-masmon-bench-mon={t.monster} onClick={() => setDetail(t)}>
                      <div className="mhm-stage"><AssistantMasmonPic t={t} size={land ? 60 : 84}/></div>
                      <p className="mt-0.5 truncate text-[11px] font-black text-white">{t.nick}</p>
                      <p className="truncate text-[9.5px] font-bold text-amber-200">Lv.{t.lv}</p>
                    </button>))}
                  {waiting.map(t => <AssistantMasmonWaitCard key={t.monster} t={t} land={land} small/>)}
                </div>
              </div>)}
          </div>);
      })()}
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">⚔ 編成は{who.name}が決めています。押すと詳しく見られます。</p>
    </>);
  } else if (tab === 'deck' && assistantMasmonDeckTabOn()) {
    body = <AssistantMasmonDeckTab id={id} land={land}/>;
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
          {m ? <img src={m.imgUrl} alt="" draggable={false} className="h-[56px] w-[56px] shrink-0 rounded-xl bg-slate-600/70 object-contain"/> : <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-xl bg-slate-800 text-[20px]">🧬</span>}
          <p className="min-w-0 text-[11.5px] font-bold leading-snug text-slate-100" style={{ wordBreak: 'auto-phrase' }}><b className="text-white">{name}</b> … {x.why}{spread && <small className="block text-[10px] text-slate-400">{spread}も少し{kind === 'like' ? '好き' : '苦手'}</small>}</p>
        </div>);
    };
    const merge = (xs) => {
      const lins = new Set((xs || []).filter(x => x.lineage).map(x => x.lineage));
      const folded = (xs || []).filter(x => x.monster && lins.has(assistantMasmonLineage(x.monster)) && assistantMasmonSpread(x) === '');
      return (xs || []).filter(x => !folded.includes(x)).map(x => { const f = x.lineage && folded.find(y => assistantMasmonLineage(y.monster) === x.lineage); return f ? { ...x, why: f.why } : x; });
    };
    const likes = merge(p.likeMon), dislikes = merge(p.dislikeMon);
    body = (<div className={land ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>
      <div className="mhm-card"><p className="text-[12px] font-black text-pink-300">💗 好き</p>{likes.map(x => line(x, 'like'))}</div>
      <div className="mhm-card"><p className="text-[12px] font-black text-sky-300">💦 苦手</p>{dislikes.length ? dislikes.map(x => line(x, 'dislike')) : <p className="py-1 text-[11.5px] font-bold text-slate-300">苦手なモンスターはいない</p>}</div>
      <div className={`mhm-card ${land ? 'col-span-3' : ''}`} data-assistant-masmon-taste-mons><p className="text-[12px] font-black text-violet-200">🐾 持っているマスモンと好み</p>
        <div className={`mt-1 grid gap-1.5 ${land ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {all.map(t => { const rel = assistantMasmonLikeText(who, p, t); return (
            <button key={t.monster} type="button" className="text-center" onClick={() => setDetail(t)} data-assistant-masmon-taste-mon={t.monster}>
              <div className="mhm-stage"><AssistantMasmonPic t={t} size={land ? 46 : 54}/></div>
              <p className="truncate text-[10.5px] font-black text-white">{t.nick}</p>
              <p className="text-[9px] font-bold leading-tight text-pink-200">{rel ? `💗 ${rel.replace(`${who.name}の`, '')}` : 'ふつう'}</p>
            </button>); })}
        </div>
      </div>
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
          <button type="button" className="mhl-btn shrink-0 bg-slate-700 px-3" data-assistant-masmon-close data-mhl-sheet-close onClick={onClose}>閉じる</button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1" role="tablist">
          {ASSISTANT_MASMON_TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`mhm-tab ${tab === k ? 'on' : ''}`} data-assistant-masmon-tab-btn={k} onClick={() => setTab(k)}>{label}</button>))}
        </div>
        <div className="mhm-body mt-2">{body}</div>
      </div>
      {detail && <AssistantMasmonDetail who={who} p={p} t={detail} land={land} onClose={() => setDetail(null)}/>}
      {welcome && (
        <div className="absolute inset-0 grid place-items-center" style={{ zIndex: 34 }} data-assistant-masmon-welcome={welcome.monster}>
          <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/75" onClick={() => setWelcome(null)}/>
          <div className="mhm-card relative mx-4 w-[min(92%,420px)] text-center" style={{ background: 'linear-gradient(180deg,#2a1d55,#0b1020)', borderColor: '#f9a8d4' }}>
            <p className="mhl-en">NEW MASMON</p>
            <p className="text-[17px] font-black text-amber-200">🎉 新しいマスモンを迎えました</p>
            <div className="mhm-stage mt-1"><AssistantMasmonPic t={welcome} size={land ? 120 : 170}/></div>
            <p className="mt-1 text-[16px] font-black text-white">{welcome.nick}<span className="ml-1.5 text-[11px] text-slate-300">{(assistantMasmonMon(welcome.monster) || {}).name} ・ Lv.{welcome.lv}</span></p>
            <div className="mt-2 flex items-start gap-2 text-left">
              {typeof AssistantFace === 'function' && <span className="shrink-0"><AssistantFace who={who} size={40} accent={who.accent}/></span>}
              <p className="rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-bold leading-snug text-slate-800" style={{ wordBreak: 'auto-phrase' }} data-assistant-masmon-welcome-line>{assistantMasmonWelcomeLine(id, welcome)}</p>
            </div>
            <button type="button" className="mhl-btn mt-3 w-full" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)' }} data-assistant-masmon-welcome-ok onClick={() => { setWelcome(null); setTab('mons'); }}>よろしくね</button>
          </div>
        </div>)}
    </div>);
}

// 育ち方のひとこと(性格)。数字には効かせない
const ASSISTANT_MASMON_GROW_TEXT = Object.freeze({
  '攻撃型': 'ちからを伸ばして、一撃で決めるのが得意', '防御型': 'じょうぶさを伸ばして、仲間の前に立つのが得意', 'ガッツ型': 'ガッツを伸ばして、技をたくさん出すのが得意',
  'ライフ型': 'ライフを伸ばして、長い試合でも倒れない', 'すばやさ型': '動きが速く、先に手を出すのが得意',
});
// 好き嫌いとの関係(そのモンスターが好き/好きな血統の仲間)
const assistantMasmonLikeText = (who, p, t) => {
  if (!p || !t) return '';
  const like = (p.likeMon || []);
  if (like.some(x => x.monster === t.monster)) return `${who.name}の好きなモンスター`;
  const lin = assistantMasmonLineage(t.monster), ln = assistantMasmonLineageName(lin);
  if (like.some(x => x.lineage && x.lineage === lin)) return `${who.name}の好きな${ln}種`;
  const near = like.find(x => x.monster && assistantMasmonLineage(x.monster) === lin);
  if (near && ln) return `${who.name}の好きな${assistantMasmonTasteName(near)}と同じ${ln}種`;
  return '';
};
// 技: 育つと増える(Lv 5ごとに1つ・9つまで)。名前は勇者の技の表(HERO_ATK_NAMES)
const assistantMasmonSkills = (t) => {
  const names = typeof HERO_ATK_NAMES !== 'undefined' && Array.isArray(HERO_ATK_NAMES[t.monster]) ? HERO_ATK_NAMES[t.monster] : [];
  return names.slice(0, Math.max(1, Math.min(names.length, 1 + Math.floor((Number(t.lv) || 1) / 5))));
};

// マスモンの詳細(見るだけ。プレイヤーのマスモン詳細に近い形)
function AssistantMasmonDetail({ who, p, t, land = false, onClose }) {
  const m = assistantMasmonMon(t.monster), st = assistantMasmonStats(t);
  if (!m || !st) return null;
  const n = assistantMasmonRegions(t.monster);
  const cols = ((t.dye && t.dye.colors) || []).slice(0, n || 5);
  const like = assistantMasmonLikeText(who, p, t);
  const skills = assistantMasmonSkills(t);
  const kind = assistantMasmonGrowKind(t.grow);
  const role = t.lead ? '先頭' : t.bench ? '控え' : '編成';
  const pic = <AssistantMasmonPic t={t} size={land ? 190 : 210}/>;
  const info = (<>
    <div className="mhm-card" data-assistant-masmon-detail-stats>
      <p className="text-[10px] font-black text-slate-400">能力</p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[38px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(st[k] * 100)}%` }}/></span></div>))}
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-amber-200">📈 {t.grow}</p>
      {ASSISTANT_MASMON_GROW_TEXT[kind] && <p className="text-[10.5px] font-bold text-slate-300">{ASSISTANT_MASMON_GROW_TEXT[kind]}</p>}
    </div>
    <div className="mhm-card mt-2" data-assistant-masmon-detail-skills>
      <p className="text-[10px] font-black text-slate-400">技(育つと増える)</p>
      <p className="mt-0.5 text-[11.5px] font-bold leading-relaxed text-white" style={{ wordBreak: 'auto-phrase' }}>{skills.join(' ・ ')}</p>
    </div>
    <div className="mhm-card mt-2" data-assistant-masmon-detail-dye>
      <p className="text-[10px] font-black text-slate-400">染めた色({n}か所)</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {cols.map((c, i) => { const b = c ? String(c).split('@')[0] : null; const al = c && String(c).includes('@') ? Number(String(c).split('@')[1]) : 100; return (
          <span key={i} className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-100">
            {b ? <i className="inline-block h-[12px] w-[12px] rounded-full border border-white/50" style={{ background: assistantMasmonSwatch(b), opacity: Math.max(.35, al / 100) }}/> : <i className="inline-block h-[12px] w-[12px] rounded-full border border-dashed border-white/70"/>}
            {b ? `${assistantMasmonColorName(b)}${al < 100 ? `(うすめ ${al}%)` : ''}` : '元の色'}
          </span>); })}
      </div>
    </div>
    <div className="mhm-card mt-2" data-assistant-masmon-detail-talk>
      {like && <p className="text-[11px] font-black text-pink-300">💗 {like}</p>}
      <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-slate-100" style={{ wordBreak: 'auto-phrase' }}>💬 {who.name}「{t.why}」</p>
      <p className="mt-1 text-[10px] font-bold text-slate-400">📝 思い出は、助手ライフの「今日あったこと」から増えていきます</p>
    </div>
  </>);
  return (
    <div className="absolute inset-0" style={{ zIndex: 32 }} data-assistant-masmon-detail={t.monster}>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/70" onClick={onClose}/>
      <div className={`mhm-panel ${land ? 'is-land' : ''}`} style={{ top: land ? 0 : '3%' }}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1"><p className="mhl-en">MASMON · {String(who.id).toUpperCase()}</p>
            <p className="truncate text-[19px] font-black text-white">{t.nick}<em className={`mhm-lead ml-1.5 ${t.bench ? 'mhm-bench' : ''}`}>{role}</em></p>
            <p className="truncate text-[11px] font-bold text-slate-300">{m.name} ・ Lv.{t.lv} ・ {who.name}のマスモン</p></div>
          <button type="button" className="mhl-btn shrink-0 bg-slate-700 px-3" data-assistant-masmon-detail-close onClick={onClose}>もどる</button>
        </div>
        <div className="mhm-body mt-2">
          {land
            ? <div className="flex gap-3"><div className="mhm-card flex shrink-0 items-center">{pic}</div><div className="min-w-0 flex-1">{info}</div></div>
            : <><div className="mhm-card flex justify-center">{pic}</div><div className="mt-2">{info}</div></>}
        </div>
      </div>
    </div>);
}

// 部屋のシートの1行(先頭のマスモンとほかの数)。押すとシートを開く
function AssistantMasmonRoomRow({ id, onOpen }) {
  const save = useAssistantMasmonSave(); // フックは早めに抜ける前に呼ぶ(呼ぶ順番を毎回同じにする)
  const p = assistantMasmonPlanOf(id);
  if (!p || typeof onOpen !== 'function') return null;
  const lead = p.team.find(t => t.lead) || p.team[0];
  const m = lead && assistantMasmonMon(lead.monster);
  if (!m) return null;
  let now = ''; try { now = assistantMasmonNowText(id, typeof assistantLifeCurrent === 'function' ? assistantLifeCurrent() : null); } catch (_) {}
  return (
    <button type="button" className="mhl-row w-full text-left" data-assistant-life-room-masmon onClick={() => onOpen(id)}>
      <span className="k">🐾 マスモン</span>
      <span className="min-w-0 text-[11px] font-bold"><span className="block truncate"><b>{lead.nick}</b>({m.name} Lv.{lead.lv}) ほか{Math.max(0, assistantMasmonTeam(p).length + assistantMasmonBench(p, save).length - 1)}体</span>
        {now && <span className="block text-[10px] text-sky-200" data-assistant-life-room-masmon-now>🐾 いま: {now}</span>}</span>
      <span className="ml-auto pl-1 text-[12px] font-black text-pink-300">›</span>
    </button>);
}

// ---------- 部屋にいるマスモン(2026-11-08 社長「助手のマスモンも部屋にいたりどこかにいたり」・選び ❶A ❷A ❸B) ----------
// ❶ 部屋に出すのは1体。3体のうち、その日の当番(先頭から日ごとに交代)
// ❷ 助手が出かけているときは、時間の区切りごとに半分くらい一緒に出かけ、残りは部屋で留守番
// ❸ 地図・居場所タブには出さない(部屋と部屋のシートだけ)
// 数字には効かせない・何も保存しない(当番も留守番も日付と時間の区切りから決まる)
const assistantMasmonHash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const assistantMasmonDuty = (id, day = (typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '')) => {
  const p = assistantMasmonPlanOf(id);
  if (!p) return null;
  const all = assistantMasmonAll(p); // 当番は控えも含めて回す
  if (!all.length) return null;
  return all[assistantMasmonHash(`${day}|${id}`) % all.length];
};
// オトズレ2(フレンドの家の控え)が読む口: その日の当番 { monster, nick, colors }
const assistantLifeMasmonLead = (id) => {
  try { if (typeof assistantLifeEnabled === 'function' && !assistantLifeEnabled()) return null; } catch (_) { return null; }
  const t = assistantMasmonDuty(id);
  return t ? { monster: t.monster, nick: t.nick, colors: [...((t.dye && t.dye.colors) || [])] } : null;
};
// いまマスモンがどこにいるか: 'with'(助手のそば・部屋)/'stay'(留守番)/'out'(助手と一緒に出かけた)
const assistantMasmonWhere = (id, life) => {
  const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, id) : null;
  if (!w || w.place === 'home') return { kind: 'with', w };
  const abs = life && Number.isFinite(life.abs) ? life.abs : 0;
  return { kind: assistantMasmonHash(`${abs}|${id}|go`) % 2 === 0 ? 'out' : 'stay', w };
};
const ASSISTANT_MASMON_DOING_MARK = Object.freeze({ sleep: '💤', practice: '♪', snack: '🍡', read: '📖', cards: '🃏', walk: '♪' });

// 部屋の見た目は、家の画面でシートの CSS が読まれていないので、その場で書く
const ASSISTANT_MASMON_PET_STYLE = Object.freeze({ position: 'absolute', zIndex: 4, pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.45))' });
const ASSISTANT_MASMON_PET_MARK = Object.freeze({ position: 'absolute', right: -2, top: -3, whiteSpace: 'nowrap', lineHeight: '12px', fontWeight: 900, background: 'rgba(255,255,255,.92)', color: '#7c2d12', borderRadius: 999, padding: '0 2px' });
// 部屋のマスモンの大きさ(2026-11-08 社長の選び A: どの部屋でも助手の顔の丸と見合う同じ大きさ)。顔の丸は Math.min(40, h*.44)
// 低い部屋(iPhone SE/8 の横など)では、出かけ札の帯(上から37px)・床・印のはみ出しを引いた高さまで縮める(どの部屋も同じ高さなので、大きさはそろう)。
//   16px より小さくなる部屋(568×320 など)では出さない(歩く区間が見つからないので出ない)
const assistantMasmonPetSize = (h) => Math.round(Math.min(40, h * .44, h - 37 - 9 - 3));
const ASSISTANT_MASMON_PET_FLOOR = 9;      // 床の板の高さ(.fl と同じ)
const ASSISTANT_MASMON_PET_MW = 2, ASSISTANT_MASMON_PET_MH = 3; // 印が絵からはみ出すぶん(右・上)
const ASSISTANT_MASMON_PET_HIT = '.tag,.pp,.bb,.pl,.lv,.lock,[data-assistant-life-rel-door],[data-assistant-life-rel-mend],[data-assistant-life-rel-sit]';
const assistantMasmonReducedMotion = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
// 部屋の床の帯で、重なってはいけない物に当たらない x の区間(歩ける所)と、その中の止まってよい所(家具の上を除く)を測る
const assistantMasmonFloorPlan = (room, size) => {
  const rr = room.getBoundingClientRect();
  const rect = (q) => q.getBoundingClientRect();
  const obs = [...room.querySelectorAll(ASSISTANT_MASMON_PET_HIT)].map(rect).filter(r => r.width > 0 && r.height > 0);
  const furn = [...room.querySelectorAll('.fu')].map(rect).filter(r => r.width > 0);
  const top = rr.bottom - ASSISTANT_MASMON_PET_FLOOR - size - ASSISTANT_MASMON_PET_MH, bot = rr.bottom - ASSISTANT_MASMON_PET_FLOOR + 1;
  const hitAt = (x, list) => { const l = rr.left + x, r = l + size + ASSISTANT_MASMON_PET_MW; return list.some(q => Math.min(r, q.right) - Math.max(l, q.left) > 0 && Math.min(bot, q.bottom) - Math.max(top, q.top) > 0); };
  const runs = []; let st = null;
  const maxX = Math.floor(rr.width - size - ASSISTANT_MASMON_PET_MW - 3);
  for (let x = 3; x <= maxX; x++) {
    const ok = !hitAt(x, obs);
    if (ok && st == null) st = x;
    if ((!ok || x === maxX) && st != null) { const end = ok ? x : x - 1; if (end >= st) runs.push([st, end]); st = null; }
  }
  runs.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
  const run = runs[0] || null;
  if (!run) return null;
  const stops = []; for (let x = run[0]; x <= run[1]; x++) if (!hitAt(x, furn)) stops.push(x);
  return { run, stops: stops.length ? stops : [run[0], run[1]], y: rr.height - ASSISTANT_MASMON_PET_FLOOR - size };
};

// 部屋の中(社長の選び A+歩く): どの部屋でも同じ大きさで床に立ち、床の空いている区間だけを左右に歩く。
//   ときどき止まって様子の印を出す(歩いているあいだは出さない)。家具の上には止まらない(通るだけ)。
//   床の帯が空いていない部屋では出さない(札の位置はナカヨシ8が床を空ける)。動きを減らす設定の人には止まった姿
function AssistantMasmonRoomPet({ id, h, life }) {
  useAssistantMasmonSave(); // 家を開いたときに保存(プレイヤーごとのマスモン)を読む。読み終わったら描き直す
  const ref = React.useRef(null);
  const [plan, setPlan] = React.useState(null);  // { run, stops, y } | false
  const [at, setAt] = React.useState(null);      // { x, moving, dir, ms }
  const [tick, setTick] = React.useState(0);
  const t = assistantMasmonDuty(id);
  const where = assistantMasmonWhere(id, life);
  const size = assistantMasmonPetSize(h);
  const key = `${id}|${t ? t.monster : ''}|${where.kind}|${h}`;
  // 家が入場の動きの途中だと測り違えるので、少し待って測り直す。画面の大きさが変わったときも測り直す
  React.useEffect(() => {
    const re = () => setTick(n => n + 1);
    const ts = [setTimeout(re, 450), setTimeout(re, 1300)];
    window.addEventListener('resize', re);
    return () => { ts.forEach(clearTimeout); window.removeEventListener('resize', re); };
  }, [key]);
  React.useLayoutEffect(() => {
    const el = ref.current, room = el && el.closest('.mhl-room');
    if (!room) return;
    const fp = assistantMasmonFloorPlan(room, size);
    setPlan(fp || false);
    if (fp) setAt(prev => {
      const x = prev && fp.stops.includes(prev.x) ? prev.x : fp.stops[assistantMasmonHash(`${id}|start`) % fp.stops.length];
      return { x, moving: false, dir: 1, ms: 0 };
    });
  }, [key, tick, size]);
  // 歩く: 止まる(3〜6秒・印を出す)→ 止まってよい所のどこかへ歩く(1秒に14px くらい)
  React.useEffect(() => {
    if (!plan || !at || assistantMasmonReducedMotion()) return undefined;
    let alive = true, timer = null;
    const step = () => {
      if (!alive) return;
      setAt(prev => {
        if (!prev) return prev;
        if (prev.moving) { timer = setTimeout(step, 3000 + Math.random() * 3000); return { ...prev, moving: false }; }
        const far = plan.stops.filter(x => Math.abs(x - prev.x) >= 12);
        if (!far.length) { timer = setTimeout(step, 5000); return prev; }
        const x = far[Math.floor(Math.random() * far.length)];
        const ms = Math.round(Math.abs(x - prev.x) / 14 * 1000);
        timer = setTimeout(step, ms + 50);
        return { x, moving: true, dir: x > prev.x ? 1 : -1, ms };
      });
    };
    timer = setTimeout(step, 2500 + Math.random() * 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [plan]);
  if (!t || where.kind === 'out' || size < 16) return null;
  const mon = assistantMasmonMon(t.monster);
  if (!mon) return null;
  const mark = where.kind === 'stay' ? '🏠' : (where.w && ASSISTANT_MASMON_DOING_MARK[where.w.doing]) || '✨';
  const show = plan && at;
  return (
    <span ref={ref} className="mhm-pet" data-assistant-life-room-masmon-pet={t.monster} data-assistant-life-room-masmon-where={where.kind}
      data-assistant-life-room-masmon-walk={plan ? `${plan.run[0]}-${plan.run[1]}` : ''} data-assistant-life-room-masmon-moving={show && at.moving ? '1' : '0'}
      style={{ ...ASSISTANT_MASMON_PET_STYLE, ...(show ? { left: at.x, top: plan.y, width: size, height: size, transition: at.moving ? `left ${at.ms}ms linear` : 'none' } : { left: 0, top: 0, width: 1, height: 1, visibility: 'hidden' }) }} aria-hidden="true">
      {show && <>
        <span style={{ display: 'block', width: '100%', height: '100%', transform: at.dir < 0 ? 'scaleX(-1)' : 'none', animation: at.moving ? 'mhmPetHop .5s ease-in-out infinite' : 'none' }}>
          {typeof DyedMonsterImage === 'function'
            ? <DyedMonsterImage baseId={t.monster} src={mon.imgUrl} masuColors={t.dye && t.dye.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            : <img src={mon.imgUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>}
        </span>
        {!at.moving && <b title={where.kind === 'stay' ? 'るすばん' : undefined} style={{ ...ASSISTANT_MASMON_PET_MARK, fontSize: size < 30 ? 8 : 10 }}>{mark}</b>}
        <style>{'@keyframes mhmPetHop{0%,100%{translate:0 0}50%{translate:0 -2px}}'}</style>
      </>}
    </span>);
}

// 部屋のシートの「🐾 いま」(どこにいるか)
const assistantMasmonNowText = (id, life) => {
  const t = assistantMasmonDuty(id);
  if (!t) return '';
  const where = assistantMasmonWhere(id, life);
  const name = typeof assistantLifeName === 'function' ? assistantLifeName(id) : id;
  if (where.kind === 'stay') return `${t.nick}は部屋でるすばん中`;
  if (where.kind === 'out') { const pl = where.w && typeof assistantLifePlaceShow === 'function' ? assistantLifePlaceShow(where.w.place) : ''; return pl ? `${t.nick}は${name}と一緒に${pl}` : `${t.nick}は${name}と一緒にお出かけ中`; }
  return where.w && where.w.doing === 'sleep' ? `${t.nick}は${name}のそばで眠っている` : `${t.nick}は部屋で${name}のそばにいる`;
};

// ---------- 部屋の🃏デッキのタブ: カード部の3つのデッキ(2026-11-08 社長「部屋の🃏デッキのタブが出るまで、3つのデッキの公開ごと待つ」) ----------
// 印 cardGrowStyle(84 の cardGrowStyleOn)が偽のあいだは、今のタブ(型の名前と方針)のまま。真になったら、
//   上に切りかえ3つ(攻め/守り/ふつう・その助手がいちばん出す型に「よく使う」)→ 中身はカード部ツナグの部品 CardAssistantDeckView(87)
//   開いたときに cardAiDeckMarkMet(会った助手だけ AI で組み直す)と cardLoadAiRecipe(AI の名前・方針を読む)を呼ぶ。待たない
const ASSISTANT_MASMON_DECK_STYLES = Object.freeze([['attack', '攻め'], ['guard', '守り'], ['normal', 'ふつう']]);
// 2026-11-08 推し・好き・素顔に作り直し(カード部ルールくん)。カード部の口(83 の cardAssistantFacePreview)があれば顔の3つ、無ければ今の型の3つ
//   「よく使う」は今の気分・仲良し度に合う顔(83 の cardAiDeckMainFace。分からなければ印を出さない)
const ASSISTANT_MASMON_DECK_FACES = Object.freeze([['oshi', '推し'], ['suki', '好き'], ['sugao', '素顔']]);
const assistantMasmonDeckFaceOn = () => typeof cardAssistantFacePreview === 'function';
const assistantMasmonDeckTabOn = () => { try { return typeof cardGrowStyleOn === 'function' && cardGrowStyleOn() && typeof CardAssistantDeckView === 'function'; } catch (_) { return false; } };
function AssistantMasmonDeckTab({ id, land = false }) {
  const faceOn = assistantMasmonDeckFaceOn();
  const tabs = faceOn ? ASSISTANT_MASMON_DECK_FACES : ASSISTANT_MASMON_DECK_STYLES;
  let mainFace = null;
  try { mainFace = faceOn && typeof cardAiDeckMainFace === 'function' ? cardAiDeckMainFace(id) : null; } catch (_) { mainFace = null; }
  const fav = faceOn ? mainFace : (ASSISTANT_MASMON_CARD_STYLE[id] || 'normal');
  const [sid, setSid] = React.useState(fav || tabs[0][0]);
  const [, setLoaded] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    try { if (typeof cardAiDeckMarkMet === 'function') void Promise.resolve(cardAiDeckMarkMet(id)).catch(() => {}); } catch (_) {}
    try { if (typeof cardLoadAiRecipe === 'function') void Promise.resolve(cardLoadAiRecipe()).then(() => { if (alive) setLoaded(n => n + 1); }).catch(() => {}); } catch (_) {}
    return () => { alive = false; };
  }, [id]);
  return (<>
    <div data-assistant-masmon-deck-styles className="grid grid-cols-3 gap-1.5">
      {tabs.map(([s, label]) => (
        <button key={s} type="button" data-assistant-masmon-deck-style={s} aria-pressed={sid === s} onClick={() => { if (typeof Audio_ !== 'undefined') Audio_.fgSe.tap(); setSid(s); }}
          className={`flex min-h-[40px] items-center justify-center gap-1 rounded-xl border px-1 py-1 text-[13px] font-black ${sid === s ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-white/15 bg-slate-800 text-slate-200'}`}>
          {label}{s === fav && <em data-assistant-masmon-deck-fav className="whitespace-nowrap rounded-full bg-emerald-400 px-1.5 py-px text-[9px] font-black not-italic text-emerald-950">よく使う</em>}
        </button>))}
    </div>
    <div className="mt-2" data-assistant-masmon-deck-view={sid}><CardAssistantDeckView who={id} styleId={sid} land={land}/></div>
  </>);
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
.mhm-lead.mhm-bench{background:#38bdf8}
.mhm-lead{font-style:normal;border-radius:999px;background:#f472b6;padding:0 6px;font-size:9.5px;font-weight:900;color:#fff;vertical-align:middle}
.mhm-bar{position:relative;flex:1;height:5px;border-radius:99px;background:#334155;overflow:hidden}
.mhm-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#f97316)}
`;
