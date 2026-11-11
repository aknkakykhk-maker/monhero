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
  let st = null; try { st = ASSISTANT_MASMON_STORE.state; } catch (_) { st = null; }
  // 引き直し(2026-11-08 社長 Q1A〜Q4A): draw(v:2)があればそれを読む。迎えたぶんが編成(先頭=勇者モン)、まだのぶんは「まだの枠」
  const d = st && st.draw && st.draw.v === ASSISTANT_MASMON_DRAW_V && Array.isArray(st.draw.made[id]) ? st.draw.made[id] : null;
  if (d && d.length) {
    // 迎えたマスモン = 勇者モン + これまでに迎えた draw の枠(書き換えない)+ 迎えるその時に選んだ枠(pick)。まだの枠は「？」(だれが来るかは迎えるときに決まる)
    const rows = assistantMasmonRowsOf(st, id);
    const row2 = (t) => ({ monster: t.monster, nick: t.nick, why: t.why, lv: t.lv, grow: t.grow, slot: t.slot, role: t.role, welcome: t.welcome, reason: t.reason || '', growMine: ((assistantMasmonMineOf(st, id).grow || {})[t.slot]) || null, dye: { colors: [...assistantMasmonDyeNowOf(st, id, t.slot, t.colors)] } });
    const had = new Set(rows.map(t => t.slot));
    const waiting = d.filter(t => !had.has(t.slot)).map(t => ({ slot: t.slot, welcome: t.welcome, monster: `__slot${t.slot}`, nick: '？？？', unknown: true }));
    const hs = assistantMasmonMineOf(st, id).hero; const hero = hs && rows.some(t => t.slot === hs) ? hs : 1; // 提案で勇者モンを交代していれば、その枠
    return { ...base, v2: true, team: rows.map(t => ({ ...row2(t), lead: t.slot === hero })), extra: waiting };
  }
  if (!Array.isArray(made) || made.length < 3) return base;
  const row = (t) => ({ monster: t.monster, nick: t.nick, why: t.why, lv: t.lv, grow: t.grow, slot: t.slot, dye: { colors: [...assistantMasmonDyeNowOf(st, id, t.slot, t.colors)] } });
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
// 引き直し(draw)の正規化: { v:2, at, made:{ [助手]: [{ slot:1〜8, monster, nick, lv, grow, why, role, welcome(仲良し度 Lv), colors, ai }] }, welcomed:{ [助手]:{ [モンスター]: 日付 } }, named, fav:{ [助手]: 好きな色の並び } }
const ASSISTANT_MASMON_DRAW_V = 2;
const ASSISTANT_MASMON_DRAW_MAX = 8;
const normalizeAssistantMasmonDraw = (raw) => {
  const out = { v: 0, at: '', made: {}, welcomed: {}, named: false, fav: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== ASSISTANT_MASMON_DRAW_V) return out;
  out.v = ASSISTANT_MASMON_DRAW_V; out.at = typeof raw.at === 'string' ? raw.at.slice(0, 10) : '';
  out.named = raw.named === true;
  const made = raw.made && typeof raw.made === 'object' && !Array.isArray(raw.made) ? raw.made : {};
  for (const [aid, list] of Object.entries(made)) {
    if (!assistantMasmonBasePlanOf(aid) || !Array.isArray(list)) continue;
    const rows = []; const slots = new Set(); const mons = new Set();
    for (const t of list.slice(0, ASSISTANT_MASMON_DRAW_MAX)) {
      if (!t || typeof t !== 'object') continue;
      const slot = Number(t.slot), lv = Number(t.lv), wl = Number(t.welcome);
      if (!Number.isInteger(slot) || slot < 1 || slot > ASSISTANT_MASMON_DRAW_MAX || slots.has(slot) || typeof t.monster !== 'string' || mons.has(t.monster)) continue;
      if (typeof t.nick !== 'string' || !t.nick || t.nick.length > 16 || !Number.isFinite(lv)) continue;
      const colors = Array.isArray(t.colors) ? t.colors.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_DYE_RE.test(c) ? c : null)) : [];
      slots.add(slot); mons.add(t.monster);
      rows.push({ slot, monster: t.monster, nick: t.nick, lv: Math.max(1, Math.min(99, Math.round(lv))), grow: typeof t.grow === 'string' ? t.grow.slice(0, 30) : '', why: typeof t.why === 'string' ? t.why.slice(0, 40) : '', role: typeof t.role === 'string' && ASSISTANT_MASMON_ROLE_NAME[t.role] ? t.role : '', welcome: Number.isInteger(wl) && wl >= 1 && wl <= 99 ? wl : slot * 2 - 1, colors, ai: t.ai === true });
    }
    if (rows.length && slots.has(1)) out.made[aid] = rows.sort((a, b) => a.slot - b.slot);
  }
  const w = raw.welcomed && typeof raw.welcomed === 'object' ? raw.welcomed : {};
  for (const [aid, mons] of Object.entries(w)) {
    if (!assistantMasmonBasePlanOf(aid) || !mons || typeof mons !== 'object' || Array.isArray(mons)) continue;
    const m = {}; for (const [mid, day] of Object.entries(mons)) if (typeof day === 'string' && day) m[mid] = day.slice(0, 10);
    out.welcomed[aid] = m;
  }
  if (raw.fav && typeof raw.fav === 'object') for (const [aid, sig] of Object.entries(raw.fav)) if (assistantMasmonBasePlanOf(aid) && typeof sig === 'string') out.fav[aid] = sig.slice(0, 120);
  return out;
};
// 迎えるその時に選んだマスモン: { [助手]: { [slot 2〜8]: { slot, monster, nick, lv, grow, why, role, welcome, colors, ai, reason, at } } }
//   reason は選んだわけ(ASSISTANT_MASMON_PICK_REASON のキー)。1つの枠に1回だけ書く(あれば二度選ばない)
const normalizeAssistantMasmonPick = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [aid, slots] of Object.entries(raw)) {
    if (!assistantMasmonBasePlanOf(aid) || !slots || typeof slots !== 'object' || Array.isArray(slots)) continue;
    const m = {}; const mons = new Set();
    for (const [k, t] of Object.entries(slots)) {
      const slot = Number(k);
      if (!Number.isInteger(slot) || slot < 1 || slot > ASSISTANT_MASMON_DRAW_MAX || !t || typeof t !== 'object') continue; // 1(勇者モン)は提案の入れ替えのときだけ
      const lv = Number(t.lv), wl = Number(t.welcome);
      if (typeof t.monster !== 'string' || mons.has(t.monster) || typeof t.nick !== 'string' || !t.nick || t.nick.length > 16 || !Number.isFinite(lv)) continue;
      mons.add(t.monster);
      m[slot] = { slot, monster: t.monster, nick: t.nick, lv: Math.max(1, Math.min(99, Math.round(lv))), grow: typeof t.grow === 'string' ? t.grow.slice(0, 30) : '', why: typeof t.why === 'string' ? t.why.slice(0, 40) : '',
        role: typeof t.role === 'string' && ASSISTANT_MASMON_ROLE_NAME[t.role] ? t.role : '', welcome: Number.isInteger(wl) && wl >= 1 && wl <= 99 ? wl : slot * 2 - 1,
        colors: Array.isArray(t.colors) ? t.colors.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_DYE_RE.test(c) ? c : null)) : [],
        ai: t.ai === true, reason: typeof t.reason === 'string' && (ASSISTANT_MASMON_PICK_REASON[t.reason] || t.reason === 'ask') ? t.reason : '', at: typeof t.at === 'string' ? t.at.slice(0, 10) : '' };
    }
    if (Object.keys(m).length) out[aid] = m;
  }
  return out;
};
// 提案の記録: [{ day, a, from, text(100字), res('yes'|'some'|'no'|'none'|'fail'), what }] 新しい60件まで
const ASSISTANT_MASMON_ASK_FROM = Object.freeze(['masmon', 'hero', 'welcome', 'deck']);
const normalizeAssistantMasmonAsked = (raw) => (Array.isArray(raw) ? raw.slice(-60) : []).filter(x => x && typeof x === 'object' && assistantMasmonBasePlanOf(x.a) && ASSISTANT_MASMON_ASK_FROM.includes(x.from) && typeof x.day === 'string')
  .map(x => ({ day: x.day.slice(0, 10), a: x.a, from: x.from, text: typeof x.text === 'string' ? x.text.slice(0, 100) : '', res: ['yes', 'some', 'no', 'none', 'fail'].includes(x.res) ? x.res : 'none', what: typeof x.what === 'string' ? x.what.slice(0, 60) : '', reply: typeof x.reply === 'string' ? x.reply.slice(0, 80) : '', counted: x.counted === true }));
// 提案で決まった所: { [助手]: { names:{ [slot]: [前の名前…] }, parts:{ [slot]: [部位の番号…] }, hero: slot(0=いつもの勇者モン), wish: 迎えたい種類, deck: { face, name, plan, day } } }
const normalizeAssistantMasmonMine = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [aid, m] of Object.entries(raw)) {
    if (!assistantMasmonBasePlanOf(aid) || !m || typeof m !== 'object') continue;
    const o = { names: {}, parts: {}, hero: 0, wish: '', deck: null };
    if (m.names && typeof m.names === 'object') for (const [k, v] of Object.entries(m.names)) { const sl = Number(k); if (Number.isInteger(sl) && sl >= 1 && sl <= 8 && Array.isArray(v)) o.names[sl] = v.filter(n => typeof n === 'string' && n && n.length <= 16).slice(-8); }
    if (m.parts && typeof m.parts === 'object') for (const [k, v] of Object.entries(m.parts)) { const sl = Number(k); if (Number.isInteger(sl) && sl >= 1 && sl <= 8 && Array.isArray(v)) o.parts[sl] = [...new Set(v.filter(i => Number.isInteger(i) && i >= 0 && i < 8))]; }
    if (Number.isInteger(m.hero) && m.hero >= 1 && m.hero <= 8) o.hero = m.hero;
    if (typeof m.wish === 'string' && m.wish.length <= 24) o.wish = m.wish;
    o.wishSoft = m.wishSoft === true;
    // 入れ替える前にいたマスモン(消さずに残す): { [slot]: [{ monster, nick, lv, grow, why, role, welcome, colors, ai, at }] } 新しい8体まで
    // 全体のくせ(2026-11-09 社長「なまえの付け方のくせを提案して全マスモンに適用」): 名前のくせ・色のくせと、くせを当てる前の名前・色(やめたら戻す)
    o.nameStyle = m.nameStyle && typeof m.nameStyle === 'object' && typeof m.nameStyle.style === 'string' && m.nameStyle.style ? { style: m.nameStyle.style.slice(0, 40), day: typeof m.nameStyle.day === 'string' ? m.nameStyle.day.slice(0, 10) : '' } : null;
    o.colorStyle = m.colorStyle && typeof m.colorStyle === 'object' && Array.isArray(m.colorStyle.palette) && m.colorStyle.palette.length ? { style: typeof m.colorStyle.style === 'string' ? m.colorStyle.style.slice(0, 40) : '', palette: m.colorStyle.palette.filter(c => typeof c === 'string' && /^[a-z_]{2,16}$/.test(c)).slice(0, 3), day: typeof m.colorStyle.day === 'string' ? m.colorStyle.day.slice(0, 10) : '' } : null;
    o.nameStyleBefore = {}; if (m.nameStyleBefore && typeof m.nameStyleBefore === 'object') for (const [k, v] of Object.entries(m.nameStyleBefore)) { const sl = Number(k); if (Number.isInteger(sl) && sl >= 1 && sl <= 8 && typeof v === 'string' && v && v.length <= 16) o.nameStyleBefore[sl] = v; }
    o.colorStyleBefore = {}; if (m.colorStyleBefore && typeof m.colorStyleBefore === 'object') for (const [k, v] of Object.entries(m.colorStyleBefore)) { const sl = Number(k); if (Number.isInteger(sl) && sl >= 1 && sl <= 8 && Array.isArray(v)) o.colorStyleBefore[sl] = v.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_DYE_RE.test(c) ? c : null)); }
    // 育て方の提案(2026-11-09 社長「育て方も受ける」): { [slot]: { before: 前の育て方, kind, day, floor: 変えたときの能力ゲージ(0〜1) } }。ゲージはこの値より下げない
    o.grow = {}; if (m.grow && typeof m.grow === 'object') for (const [k, v] of Object.entries(m.grow)) { const sl = Number(k); if (!Number.isInteger(sl) || sl < 1 || sl > 8 || !v || typeof v !== 'object' || !['攻撃型', '防御型', 'ライフ型', 'ガッツ型', 'すばやさ型'].includes(v.kind) || typeof v.before !== 'string') continue; const fl = {}; for (const key of ['hp', 'atk', 'def', 'guts']) { const x = v.floor && Number(v.floor[key]); if (Number.isFinite(x)) fl[key] = Math.max(0, Math.min(1, x)); } o.grow[sl] = { before: v.before.slice(0, 30), kind: v.kind, day: typeof v.day === 'string' ? v.day.slice(0, 10) : '', floor: fl }; }
    o.former = {};
    if (m.former && typeof m.former === 'object') for (const [k, v] of Object.entries(m.former)) { const sl = Number(k); if (!Number.isInteger(sl) || sl < 1 || sl > 8 || !Array.isArray(v)) continue; const rows = v.filter(x => x && typeof x === 'object' && typeof x.monster === 'string' && typeof x.nick === 'string' && x.nick.length <= 16).slice(-8).map(x => ({ monster: x.monster, nick: x.nick, lv: Number.isFinite(x.lv) ? Math.max(1, Math.min(99, Math.round(x.lv))) : 10, grow: typeof x.grow === 'string' ? x.grow.slice(0, 30) : '', why: typeof x.why === 'string' ? x.why.slice(0, 40) : '', role: typeof x.role === 'string' ? x.role.slice(0, 12) : '', welcome: Number.isInteger(x.welcome) ? x.welcome : sl * 2 - 1, colors: Array.isArray(x.colors) ? x.colors.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_DYE_RE.test(c) ? c : null)) : [], ai: x.ai === true, at: typeof x.at === 'string' ? x.at.slice(0, 10) : '' })); if (rows.length) o.former[sl] = rows; }
    if (m.deck && typeof m.deck === 'object' && ['oshi', 'like', 'sugao'].includes(m.deck.face)) o.deck = { face: m.deck.face, name: typeof m.deck.name === 'string' ? m.deck.name.slice(0, 12) : '', plan: ['attack', 'guard', 'normal'].includes(m.deck.plan) ? m.deck.plan : '', day: typeof m.deck.day === 'string' ? m.deck.day.slice(0, 10) : '' };
    out[aid] = o;
  }
  return out;
};
const assistantMasmonMineOf = (st, aid) => (st && st.mine && st.mine[aid]) || { names: {}, parts: {}, hero: 0, wish: '', deck: null, former: {} };
const normalizeAssistantMasmonSave = (raw) => {
  const out = { v: 1, welcomed: {}, seed: '', made: {}, named: false, noticed: {}, dyes: {}, draw: normalizeAssistantMasmonDraw(null), pick: {}, pickNameDay: '', renamed2: {}, asked: [], mine: {}, nickFix1: false };
  if (raw && typeof raw === 'object') {
    out.nickFix1 = raw.nickFix1 === true; // 種類名になった迎えた子の名前を、助手が紹介した名前に戻した印(一度だけ・2026-11-11)
    if (typeof raw.seed === 'string' && /^[\w-]{4,60}$/.test(raw.seed)) out.seed = raw.seed;
    out.made = normalizeAssistantMasmonMade(raw.made);
    out.named = raw.named === true;
    out.dyes = normalizeAssistantMasmonDyes(raw.dyes);
    out.draw = normalizeAssistantMasmonDraw(raw.draw);
    out.pick = normalizeAssistantMasmonPick(raw.pick); // 迎えるその時に選んだマスモン(2026-11-08 社長「迎えるときに決める」)。draw は消さない
    out.pickNameDay = typeof raw.pickNameDay === 'string' ? raw.pickNameDay.slice(0, 10) : '';
    out.asked = normalizeAssistantMasmonAsked(raw.asked); // プレイヤーの提案の記録(2026-11-08 社長「こっちからアイディア出して誘導」)
    out.mine = normalizeAssistantMasmonMine(raw.mine); // 提案で決まった所(名前の前の名前・色を変えた部位・勇者モン・迎えたい種類・デッキの希望)
    if (raw.renamed2 && typeof raw.renamed2 === 'object') for (const [k, v] of Object.entries(raw.renamed2)) if (assistantMasmonBasePlanOf(k) && (v === 'new' || v === 'seen')) out.renamed2[k] = v; // 名前を付け直した知らせ(1回だけ) // 引き直し(版の印 v:2)。made・welcomed(前の版)は読めるまま残す // 染め方 v2 からの色(版の印つきで足していく。made の色は書き換えない)
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
// ---------- 染め方 v2(2026-11-08 社長「好き色はあるけどバリエーションをもっとだしてほしい」「もっと詳細に設定を作りこんで」) ----------
// 表は docs/progress/assistant-peer/DYE-DETAIL.md にも同じものを書いてある。
// ・made[].colors(v1)は書き換えない。v2 からの色は dyes[助手] に「版・理由・日付・季節」を付けて足していく(前の色は残る)
// ・色は今の染色の書き方だけを使う: プリセットの色id / 「custom:色相:彩度:明度」(明るい・暗い・くすんだ版)/ 末尾の「@濃さ」
// 色の版(tone): 同じ好きな色でも、明るさ・あざやかさで5通りに分ける
const ASSISTANT_MASMON_HUE = Object.freeze({ red: 355, orange: 28, yellow: 48, lime: 78, green: 135, teal: 168, cyan: 190, sky: 200, blue: 220, purple: 265, magenta: 300, pink: 330 });
const ASSISTANT_MASMON_TONE = Object.freeze({ pale: [18, 97, '淡い'], deep: [80, 42, '深い'], dull: [32, 60, 'くすんだ'], vivid: [95, 90, 'あざやかな'] });
const ASSISTANT_MASMON_TONE_ACHRO = Object.freeze({ // 白・黒・薄灰の版(色相が無いので明るさだけで分ける)
  black: { base: 'black', light: 'gray', pale: 'gray', deep: 'black', dull: 'custom:0:0:30', vivid: 'black' },
  white: { base: 'white', light: 'white', pale: 'white', deep: 'gray', dull: 'custom:30:8:85', vivid: 'white' },
  gray: { base: 'gray', light: 'white', pale: 'white', deep: 'custom:0:0:40', dull: 'gray', vivid: 'gray' },
});
const ASSISTANT_MASMON_ACHRO_NAME = Object.freeze({ 'custom:0:0:30': '炭色', 'custom:30:8:85': '生成り', 'custom:0:0:40': '濃い灰' });
const assistantMasmonBaseOf = (c) => String(c || '').split('@')[0].replace(/_light$/, '');
const assistantMasmonTone = (c, tone, jit = 0) => {
  const b = assistantMasmonBaseOf(c);
  if (ASSISTANT_MASMON_TONE_ACHRO[b]) return ASSISTANT_MASMON_TONE_ACHRO[b][tone] || b;
  if (!Number.isFinite(ASSISTANT_MASMON_HUE[b])) return null;
  if (tone === 'base') return b;
  if (tone === 'light') return `${b}_light`;
  const tv = ASSISTANT_MASMON_TONE[tone]; if (!tv) return b;
  return `custom:${(ASSISTANT_MASMON_HUE[b] + Math.round(jit) + 360) % 360}:${tv[0]}:${tv[1]}`;
};
// 色の名前(画面の「染めた色」用)。v2 の版は「淡い・深い・くすんだ・あざやかな」+色の名前
const assistantMasmonToneName = (c) => {
  const id = String(c || '').split('@')[0];
  if (ASSISTANT_MASMON_ACHRO_NAME[id]) return ASSISTANT_MASMON_ACHRO_NAME[id];
  const m = /^custom:(\d+):(\d+):(\d+)$/.exec(id);
  if (!m) return (typeof MASU_COLOR_LABELS !== 'undefined' && MASU_COLOR_LABELS[id]) || id;
  const h = Number(m[1]), s = Number(m[2]), v = Number(m[3]);
  let best = 'red', bd = 999;
  for (const [k, hh] of Object.entries(ASSISTANT_MASMON_HUE)) { const d = Math.min(Math.abs(h - hh), 360 - Math.abs(h - hh)); if (d < bd) { bd = d; best = k; } }
  const tone = Object.values(ASSISTANT_MASMON_TONE).find(t => t[0] === s && t[1] === v);
  const label = (typeof MASU_COLOR_LABELS !== 'undefined' && MASU_COLOR_LABELS[best]) || best;
  return tone ? `${tone[2]}${label}` : `${label}っぽい色`;
};

// ❶ 助手ごとの染め方のくせ(8人)
//   tones: 使う版の重み(base=そのまま/light=薄め/pale=淡い/deep=深い・暗い/dull=くすんだ/vivid=あざやか・つや)
//   avoid: 苦手で使わない色 / alpha: 濃さの幅(%)/ keep: 部位を元の色のまま残す割合 / parts: 染めがちな部位(wide=大きい所・accent=小さい差し色・mix=どちらも・even=決まった順)
//   grad: 部位ごとに同じ色の濃淡を並べる / gloss: つや(true=あざやかな版で光を残す・false=くすんだ版で光を抑える)
//   odd: 思いがけない色を混ぜる割合(ドラ)/ roles: 5体の染め方の候補(1体目は main。残りの4体はここからプレイヤーごとに選ぶ)
const ASSISTANT_MASMON_DYE_HABIT = Object.freeze({
  mua: { say: 'ふんわり明るい色をノリで重ねる。白と薄い色が好き', ref: 'ゲームの♪みゅあ♪の染め色(白・薄ピンク・赤・薄マゼンタ・薄空色。濃さはほぼそのまま)', extra: ['white', 'magenta_light', 'red'], tones: { light: 3, pale: 2, vivid: 2, base: 1 }, avoid: ['gray'], alpha: [65, 90], keep: 0.3, parts: 'mix', grad: true, gloss: true, odd: 0.1, roles: ['grad', 'accent', 'bold', 'contrast', 'season'] },
  kiki: { say: 'ピンクの濃淡を差し色に。落ち着いた色が多め', ref: 'ゲームの☆きき☆の染め色(薄ピンク・マゼンタ・ピンク)', extra: ['magenta'], tones: { light: 2, base: 2, dull: 2, deep: 1 }, avoid: ['yellow', 'lime', 'cyan'], alpha: [45, 70], keep: 0.6, parts: 'accent', grad: false, gloss: false, odd: 0, roles: ['accent', 'natural', 'grad', 'accent', 'contrast'] },
  momosuke: { say: 'ステージ映えする派手な色を全部の部位に。濃いめ', tones: { vivid: 3, base: 2, light: 1 }, avoid: ['gray', 'black'], alpha: [70, 90], keep: 0.1, parts: 'wide', grad: true, gloss: true, odd: 0.15, roles: ['bold', 'grad', 'contrast', 'season', 'bold'] },
  dra: { say: '大きい所をざっくり。ときどき思いがけない色にする(変な色の人)', tones: { base: 2, dull: 2, deep: 1, vivid: 1 }, avoid: [], alpha: [55, 90], keep: 0.2, parts: 'wide', grad: false, gloss: false, odd: 0.45, roles: ['odd', 'odd', 'natural', 'bold', 'contrast'] },
  atsu: { say: '勝負の赤と締めの黒。大きい所は濃く、差し色にピンクや白', ref: 'ゲームのあつの染め色(赤・黒が中心。ピンク・薄橙・白が差し色。濃さを下げるのは4回に1回くらい)', extra: ['pink', 'orange_light', 'white'], tones: { base: 3, deep: 2, vivid: 1 }, avoid: ['purple_light'], alpha: [75, 90], keep: 0.2, parts: 'wide', grad: false, gloss: true, odd: 0.1, roles: ['contrast', 'bold', 'accent', 'grad', 'contrast'] },
  kyuko: { say: '夜の灯りのような淡い色を小さい所に。元の色をよく残す', tones: { light: 3, pale: 3, dull: 1 }, avoid: ['lime', 'yellow', 'magenta'], alpha: [30, 55], keep: 0.6, parts: 'accent', grad: true, gloss: false, odd: 0, roles: ['natural', 'grad', 'accent', 'season', 'natural'] },
  sorashido: { say: '青の濃淡を決まった順に。濃さのばらつきが小さい', tones: { base: 2, light: 2, deep: 2 }, avoid: ['magenta', 'lime', 'pink'], alpha: [50, 62], keep: 0.4, parts: 'even', grad: true, gloss: false, odd: 0, roles: ['grad', 'accent', 'natural', 'contrast', 'grad'] },
  erubin: { say: '黒・茶・灰の落ち着いた色で全体をまとめる', tones: { dull: 3, deep: 2, base: 1 }, avoid: ['magenta', 'lime', 'yellow'], alpha: [50, 75], keep: 0.3, parts: 'wide', grad: false, gloss: false, odd: 0.05, roles: ['natural', 'accent', 'grad', 'season', 'bold'] },
});
const ASSISTANT_MASMON_ROLE_NAME = Object.freeze({ main: '好きな色が主役', accent: '差し色だけ', grad: '同じ色の濃淡', contrast: '反対色を差す', natural: '元の色に近い', bold: '全部の部位を思い切って', odd: '思いがけない色', season: '季節の色' });
// 季節の色(染め直しにも使う)。冬はクリスマスの赤も入る
const ASSISTANT_MASMON_SEASON = Object.freeze({ spring: ['pink_light', 'lime_light', 'yellow_light'], summer: ['sky', 'cyan', 'yellow'], autumn: ['orange', 'red', 'yellow'], winter: ['white', 'blue_light', 'red'] });
const ASSISTANT_MASMON_SEASON_NAME = Object.freeze({ spring: '春', summer: '夏', autumn: '秋', winter: '冬' });
const assistantMasmonSeasonKey = (day) => { // 'YYYY-MM-DD' → '2026-autumn'(1・2月は前の年の冬)
  const m = /^(\d{4})-(\d{2})/.exec(String(day || '')); if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]);
  const s = mo >= 3 && mo <= 5 ? 'spring' : mo >= 6 && mo <= 8 ? 'summer' : mo >= 9 && mo <= 11 ? 'autumn' : 'winter';
  return `${mo <= 2 ? y - 1 : y}-${s}`;
};
// 部位の意味と広さ(2026-11-08 キズナ4が部位を1つずつ染めて実測。広さは体に占める%で、重なりがあるので足して100にはならない)
//   印: face=顔・目・口(染めない)/ skin=顔を含む肌や体の地(淡く・55%まで)/ white=白い部位 / dark=黒っぽい部位 / clear=透ける・光る部位 / wide=広い部位
const ASSISTANT_MASMON_DYE_PARTS = Object.freeze({
  KenshiMocchi: [['肌', 'skin', 26], ['コート・ブーツ', 'wide dark', 54], ['髪', 'dark', 22], ['左の剣', '', 12], ['右の剣', '', 12]],
  MelWhip: [['イチゴ・赤い実', '', 10], ['服・スカート', '', 25], ['フリル', '', 16], ['ケーキ・クリーム', 'white', 42], ['髪', '', 14]],
  Iblis: [['白い毛', 'wide white', 43], ['紫のパーツ', '', 27], ['翼', 'dark', 14]],
  Mocchi: [['体', 'wide skin', 84], ['頭の葉', '', 12], ['口ばし', '', 10]],
  Ghost: [['帽子', 'dark', 41], ['体', 'wide white clear skin', 59], ['リボン', '', 6]],
  Monol: [['上', 'dark', 32], ['中', 'dark', 39], ['下', 'dark', 33]],
  Golem: [['頭・胴・脚', 'wide', 58], ['両腕', '', 42], ['足元の石', '', 11]],
  Eiki: [['髪・リボン', '', 37], ['刀・オーラ', 'clear', 33], ['鎧', 'wide', 77]],
  Zan: [['体', 'wide', 61], ['目', 'face', 4], ['腕の刃', '', 40]],
  Tiger: [['毛', 'wide', 58], ['胸元・おなか', 'white', 32], ['角', '', 10]],
  Pandora: [['靴下', '', 5], ['黒い服・翼', 'dark', 26], ['白い服・翼', 'white', 29], ['紫の髪', '', 8], ['白い髪', 'white', 9]],
  Oboro: [['花', 'wide', 48], ['茎・葉・足', '', 39], ['本体', 'white skin', 21]],
  Plant: [['花', 'wide', 50], ['葉・茎', '', 34], ['本体', 'white skin', 17]],
  Yggdrasil: [['髪・葉', '', 42], ['カエルの体', '', 38], ['角・杖・マント', '', 22]],
  Dreamy: [['体の毛', 'white skin', 22], ['雲', 'wide white', 54], ['縞の帽子', '', 12], ['玉の飾り', '', 11], ['ピンクと水色の飾り', '', 6]],
  Illumine: [['黒い体', 'dark skin', 38], ['後ろの髪', 'dark', 18], ['光る髪', 'wide clear', 54], ['金の飾り', '', 10], ['目と模様', 'face', 7]],
  Suezo: [['体', 'wide', 59], ['瞳', 'face', 25], ['口', '', 15]],
  Mitarashi: [['体', 'wide', 58], ['お腹・翼の金', '', 39], ['口元', 'face', 9]],
  Ark: [['体・翼', 'wide', 79], ['白い羽・紋章', 'white', 20], ['王冠・輪', '', 6]],
  Mia: [['髪', '', 16], ['服・ブーツ', '', 28], ['服の模様', '', 7]],
  Melody: [['傘の羊毛・玉', '', 23], ['帽子', '', 16], ['顔・体の白', 'white skin', 20], ['象の体', 'wide', 55], ['象の耳の内側', '', 23]],
  Spooky: [['帽子・服', 'wide', 47], ['手・しっぽ', 'white clear', 32], ['かぼちゃの顔', 'skin', 19], ['リボン・飾り', '', 15], ['しっぽの先の枝', '', 10]],
  Kuromy: [['傘のピンク・リボン', '', 27], ['傘のフリル', '', 22], ['黒い帽子・ケープ', 'dark', 24], ['上に乗った方の白', 'white', 20], ['下の生き物', 'wide', 55]],
  Snegurochka: [['髪・ヒレ', '', 40], ['帽子・衣装', '', 21], ['腕・おなか・尾', 'white skin', 36]],
  Undine: [['髪', '', 39], ['肌・尾', 'wide skin', 52], ['白い衣装', 'white', 13]],
  Yaobikuni: [['緑の髪・尾・上衣', 'wide', 67], ['ピンクの髪', '', 12], ['肌', 'white skin', 21]],
  Pixie: [['髪', '', 20], ['肌', 'white skin', 48], ['服・翼', '', 44]],
  Ham: [['体の毛', 'wide', 59], ['おなかの白', 'white', 34], ['耳の内側', '', 14]],
  Kyubi: [['髪', '', 25], ['しっぽ・耳の毛', 'white', 42], ['服の白・襟', 'white', 30], ['胸の紫・下駄', '', 16], ['手袋・脚', '', 19]],
  Orihime: [['髪・耳', '', 22], ['しっぽ・羽衣', 'wide white', 45], ['上の着物', '', 8], ['外の羽織', 'dark', 23], ['手袋・靴下', '', 11]],
});
// ❷ 部位ごとの決まり: assistantMasmonPartRule(下の ASSISTANT_MASMON_DYE_PARTS の印から)
//   face=顔・肌・目まわり → 染めない / white=白い部位 → 60%まで・暗い版と黒は使わない(灰色ににごる)
//   skin=顔を含む肌・体の地 → 55%まで・深い版とあざやかな版は使わない / dark=黒っぽい部位 → 70%まで・淡い版は55%まで(白っぽく浮く)/ clear=透ける・光る部位 → 50%まで / wide=広い部位(体の45%以上)→ 75%まで(陰影が消えない)
const assistantMasmonPartRule = (mon, i) => {
  const row = (ASSISTANT_MASMON_DYE_PARTS[mon] || [])[i];
  const tags = new Set(String(row ? row[1] : '').split(' ').filter(Boolean));
  const area = row && Number.isFinite(row[2]) ? row[2] / 100 : 0.3;
  let cap = 90;
  if (tags.has('wide')) cap = 75;
  if (tags.has('dark')) cap = Math.min(cap, 70);
  if (tags.has('white')) cap = Math.min(cap, 60);
  if (tags.has('clear')) cap = Math.min(cap, 50);
  if (tags.has('skin')) cap = Math.min(cap, 55);
  return { i, name: row ? row[0] : `部位${i + 1}`, keep: tags.has('face'), skin: tags.has('skin'), white: tags.has('white'), dark: tags.has('dark'), clear: tags.has('clear'), wide: tags.has('wide'), cap, area };
};
// ❹ 変な色の歯止め: 思いがけない色は1体に2か所まで・広い部位では60%まで/白い部位を暗くしない/
//   暗い部位以外に深い版は65%まで/染めた広さ×濃さの合計を 0.75(思い切った型は 0.9)までにして、元の絵の陰影と輪郭を残す/あざやかな反対色どうしを両方とも濃くしない
const assistantMasmonDyeLimit = (plan, role) => {
  let odd = 0;
  const list = [];
  for (const e of plan) {
    if (!e || !e.p || e.p.keep || !e.c) continue;
    if (e.odd) { if (odd >= 2) continue; odd += 1; }
    let tone = e.tone;
    const achro = !!ASSISTANT_MASMON_TONE_ACHRO[assistantMasmonBaseOf(e.c)];
    if (e.p.white && (tone === 'deep' || assistantMasmonBaseOf(e.c) === 'black')) { tone = 'light'; if (assistantMasmonBaseOf(e.c) === 'black') e.c = 'gray'; }
    if (e.p.skin && (tone === 'deep' || tone === 'vivid')) tone = 'light'; // 肌・顔を含む地は淡く(顔色が悪く見えない)
    let a = Math.round(e.a);
    if (e.p.dark && (tone === 'light' || tone === 'pale' || (achro && assistantMasmonBaseOf(e.c) === 'white'))) a = Math.min(a, 55);
    if (e.odd && e.p.wide) a = Math.min(a, 60);
    if (tone === 'deep' && !e.p.dark) a = Math.min(a, 65); // 明るい部位に深い版を濃くかけると濁る
    a = Math.max(20, Math.min(e.p.cap, a));
    const id = assistantMasmonTone(e.c, tone, e.jit || 0);
    if (!id) continue;
    const prev = list.findIndex(x => x.p.i === e.p.i); if (prev >= 0) list.splice(prev, 1);
    list.push({ ...e, tone, a, id });
  }
  const limit = role === 'bold' ? 0.9 : 0.75;
  for (let guard = 0; guard < 40; guard++) {
    const cov = list.reduce((s, x) => s + x.p.area * x.a / 100, 0);
    if (cov <= limit) break;
    const big = [...list].filter(x => x.a > 35).sort((x, y) => y.p.area * y.a - x.p.area * x.a)[0];
    if (!big) break; big.a -= 5;
  }
  const hueOf = (x) => { const m = /^custom:(\d+)/.exec(x.id); return m ? Number(m[1]) : ASSISTANT_MASMON_HUE[assistantMasmonBaseOf(x.id)]; };
  for (const x of list) for (const y of list) {
    if (x === y || x.tone !== 'vivid' || y.tone !== 'vivid' || x.a < 80 || y.a < 80) continue;
    const hx = hueOf(x), hy = hueOf(y); if (!Number.isFinite(hx) || !Number.isFinite(hy)) continue;
    const d = Math.min(Math.abs(hx - hy), 360 - Math.abs(hx - hy));
    if (d > 150) (x.p.area < y.p.area ? x : y).a = 65;
  }
  return list;
};
// ❸ 1体の染め方を作る(role は ASSISTANT_MASMON_ROLE_NAME のどれか。base を渡すと、その色の上に季節の色だけ足す)
const assistantMasmonDyeMake2 = (aid, p, monster, role, rnd, base = null) => {
  const H = ASSISTANT_MASMON_DYE_HABIT[aid] || ASSISTANT_MASMON_DYE_HABIT.mua;
  const n = assistantMasmonRegions(monster) || 3;
  const parts = Array.from({ length: n }, (_, i) => assistantMasmonPartRule(monster, i));
  const can = parts.filter(x => !x.keep);
  const out = base ? Array.from({ length: n }, (_, i) => base[i] || null) : Array(n).fill(null);
  if (!can.length) return out;
  const avoid = new Set(H.avoid);
  const okC = (c) => c && !avoid.has(c) && !avoid.has(assistantMasmonBaseOf(c));
  const fav0 = (p.favColors || []).map(x => x.color).filter(Boolean);
  let fav = fav0.filter(okC); if (!fav.length) fav = fav0.length ? fav0 : ['pink'];
  if (role !== 'main' && fav.length > 1) { const r0 = Math.floor(rnd() * fav.length); fav = [...fav.slice(r0), ...fav.slice(0, r0)]; }
  else if (fav.length > 1 && rnd() < 0.35) fav = [fav[1], fav[0], ...fav.slice(2)];
  const pool2 = [...fav, ...(H.extra || []).filter(c => okC(c) && !fav.includes(c))]; // 差し色・思い切った型は、プレイヤーの染め色を参考にした色も混ぜる
  const tw = Object.entries(H.tones); const tsum = tw.reduce((s, [, w]) => s + w, 0);
  const pickTone = () => { let r = rnd() * tsum; for (const [t, w] of tw) { r -= w; if (r < 0) return !H.gloss && t === 'vivid' ? 'base' : t; } return tw[0][0]; };
  const jit = () => (rnd() - 0.5) * 8;
  const al = (f = 1) => (H.alpha[0] + (H.alpha[1] - H.alpha[0]) * rnd()) * f;
  const wide = [...can].sort((a, b) => b.area - a.area), small = [...can].sort((a, b) => a.area - b.area);
  const orderOf = H.parts === 'even' ? can : null; // ソラシド: 部位の番号順に、決まった間隔で
  const opp = (c) => { const o = ASSISTANT_MASMON_OPP[assistantMasmonBaseOf(c)] || 'gray'; return okC(o) ? o : fav[fav.length - 1]; };
  const oddColor = () => { const hs = Object.keys(ASSISTANT_MASMON_HUE).filter(h => !fav.map(assistantMasmonBaseOf).includes(h) && okC(h)); return hs.length ? hs[Math.floor(rnd() * hs.length)] : opp(fav[0]); };
  const ladder = H.tones.deep ? ['deep', 'base', 'light', 'pale'] : ['base', 'light', 'pale', 'pale'];
  const plan = [];
  const put = (pp, c, tone, a, extra = {}) => { if (pp) plan.push({ p: pp, c, tone, a, jit: jit(), ...extra }); };
  const keepIt = () => rnd() < H.keep;
  const seq = orderOf || wide;
  switch (role) {
    case 'main':
      put(seq[0], fav[0], pickTone(), Math.max(al(1.05), 45));
      seq.slice(1).forEach((x, k) => { if (!keepIt()) put(x, fav[(k + 1) % fav.length], H.grad ? ladder[Math.min(k + 1, 3)] : pickTone(), al(0.9)); });
      break;
    case 'accent': {
      const cnt = small.length > 2 && rnd() < 0.5 ? 2 : 1;
      small.slice(0, cnt).forEach((x, k) => put(x, pool2[Math.floor(rnd() * pool2.length)] || fav[k % fav.length], pickTone(), Math.max(al(1.1), 55)));
      break; }
    case 'grad': {
      const use = seq.filter((x, k) => k < 2 || !keepIt());
      const gf = fav.find(c => !ASSISTANT_MASMON_TONE_ACHRO[assistantMasmonBaseOf(c)]) || fav[0]; // 濃淡は色のある好きな色で(白・黒だけだと灰色になる)
      use.forEach((x, k) => put(x, gf, ladder[Math.min(k, 3)], al(1 - k * 0.08)));
      break; }
    case 'contrast':
      put(wide[0], fav[0], pickTone(), al());
      if (small[0] && small[0] !== wide[0]) put(small[0], opp(fav[0]), H.gloss ? 'vivid' : 'base', Math.max(al(1.05), 60));
      break;
    case 'natural':
      put(wide[Math.floor(rnd() * Math.min(2, wide.length))], fav[Math.floor(rnd() * fav.length)], H.tones.deep && !H.tones.light ? 'dull' : 'light', 25 + rnd() * 15);
      break;
    case 'bold':
      seq.forEach((x, k) => put(x, k % 3 === 2 ? opp(fav[0]) : pool2[k % pool2.length], H.gloss ? (k % 2 ? 'base' : 'vivid') : pickTone(), Math.max(al(1.05), 75)));
      break;
    case 'odd':
      put(wide[0], oddColor(), rnd() < 0.5 ? 'vivid' : 'deep', al(), { odd: true });
      if (small[0] && small[0] !== wide[0]) put(small[0], rnd() < 0.5 ? oddColor() : fav[0], pickTone(), al(), { odd: rnd() < 0.6 });
      if (wide[1] && wide[1] !== small[0] && !keepIt()) put(wide[1], fav[0], pickTone(), al(0.9));
      break;
    case 'season': {
      const sk = String(base && base.__season || assistantMasmonSeasonKey(typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '')).split('-')[1] || 'autumn';
      const sc = (ASSISTANT_MASMON_SEASON[sk] || ASSISTANT_MASMON_SEASON.autumn).filter(okC);
      const c = sc.length ? sc[Math.floor(rnd() * sc.length)] : `${assistantMasmonBaseOf(fav[0])}`;
      put(small[0], c, pickTone(), Math.max(al(), 55));
      if (!base && wide[0] !== small[0] && !keepIt()) put(wide[0], fav[0], 'light', al(0.8));
      break; }
    default: put(wide[0], fav[0], pickTone(), al());
  }
  // 思いがけない色は、まだ染めていない部位にだけ差す(主役の色は上書きしない)
  const free = small.filter(x => !plan.some(e => e.p === x));
  if (role !== 'odd' && H.odd > 0 && rnd() < H.odd && free.length) put(free[0], oddColor(), 'vivid', al(), { odd: true });
  if (!plan.length) put(wide[0], fav[0], 'light', 40);
  for (const x of assistantMasmonDyeLimit(plan, role)) out[x.p.i] = x.a >= 100 ? x.id : `${x.id}@${x.a}`;
  return out;
};
// ❸ 変化: 引き直し(draw v:2)の顔ぶれに、記録を dyes[助手] へ足していく(前の色は消さない・同じものは二度足さない)
//   season=季節が変わったら1体だけ季節の色を差す(季節ごとに1回)/ like=好きな色の表が変わったら勇者モンを染め直す
//   はじめの色は引き直しのときに染め方 v2 で決めた draw.made[].colors(そこからの変化だけを記録する)
const ASSISTANT_MASMON_DYE_V = 2;
const ASSISTANT_MASMON_DYE_RE = /^([a-z_]{2,16}|custom:\d{1,3}:\d{1,3}:\d{1,3})(@(100|[1-9]\d))?$/;
const assistantMasmonFavSig = (p) => (p && p.favColors || []).map(x => x.color).join(',');
const normalizeAssistantMasmonDyes = (raw) => {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [aid, list] of Object.entries(raw)) {
    if (!assistantMasmonBasePlanOf(aid) || !Array.isArray(list)) continue;
    const rows = [];
    for (const e of list.slice(-40)) {
      if (!e || typeof e !== 'object' || e.d !== ASSISTANT_MASMON_DRAW_V || !['season', 'like', 'ask'].includes(e.why) || !e.slots || typeof e.slots !== 'object') continue;
      const slots = {};
      for (const [s, cs] of Object.entries(e.slots)) { const k = Number(s); if (Number.isInteger(k) && k >= 1 && k <= ASSISTANT_MASMON_DRAW_MAX && Array.isArray(cs)) slots[k] = cs.slice(0, 8).map(c => (typeof c === 'string' && ASSISTANT_MASMON_DYE_RE.test(c) ? c : null)); }
      const roles = {}; if (e.roles && typeof e.roles === 'object') for (const [s, r] of Object.entries(e.roles)) if (ASSISTANT_MASMON_ROLE_NAME[r]) roles[Number(s)] = r;
      rows.push({ v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: e.why, undo: e.undo === true, at: typeof e.at === 'string' ? e.at.slice(0, 10) : '', season: typeof e.season === 'string' ? e.season.slice(0, 16) : '', fav: typeof e.fav === 'string' ? e.fav.slice(0, 120) : '', roles, slots });
    }
    if (rows.length) out[aid] = rows;
  }
  return out;
};
// いまの色(記録の新しい順に、その枠を含む最初のもの。無ければ引き直しのときの色)
const assistantMasmonDyeNowOf = (state, aid, slot, fallback) => {
  const hist = state && state.dyes && state.dyes[aid];
  if (Array.isArray(hist)) for (let k = hist.length - 1; k >= 0; k--) { const cs = hist[k].slots && hist[k].slots[slot]; if (Array.isArray(cs)) return cs; }
  return fallback;
};
// その枠の染め直しの記録(新しい順): [{ why, at, season, role, colors, before }]
const assistantMasmonDyeLog = (aid, slot) => {
  const st = ASSISTANT_MASMON_STORE.state, hist = (st.dyes && st.dyes[aid]) || [];
  const row = assistantMasmonRowsOf(st, aid).find(t => t.slot === slot) || null;
  if (!row) return [];
  let before = row.colors;
  const out = [];
  for (const e of hist) { const cs = e.slots[slot]; if (!Array.isArray(cs)) continue; out.push({ why: e.why, undo: !!e.undo, at: e.at, season: e.season, role: e.roles[slot] || '', colors: cs, before }); before = cs; }
  return out.reverse();
};
const assistantMasmonDyeEnsure = (state, day) => {
  const season = assistantMasmonSeasonKey(day);
  if (!season || !state.draw || state.draw.v !== ASSISTANT_MASMON_DRAW_V) return state;
  const dyes = { ...(state.dyes || {}) }; let changed = false;
  for (const [aid, list] of Object.entries(state.draw.made || {})) {
    const p = assistantMasmonBasePlanOf(aid); if (!p || !Array.isArray(list) || !list.length) continue;
    const hist = Array.isArray(dyes[aid]) ? [...dyes[aid]] : [];
    const sig = assistantMasmonFavSig(p);
    const last = hist[hist.length - 1] || null;
    const lastSeason = last ? last.season : assistantMasmonSeasonKey(state.draw.at);
    const lastFav = (last && last.fav) || state.draw.fav[aid] || sig;
    const mine = assistantMasmonRowsOf(state, aid); // 迎えたマスモンだけ染め直す
    const cur = (t) => assistantMasmonDyeNowOf({ dyes: { [aid]: hist } }, aid, t.slot, t.colors);
    // プレイヤーの提案で決めた部位は、季節の色・好きな色の染め直しで上書きしない
    const keepMine = (t, cs) => { const own = assistantMasmonMineOf(state, aid).parts[t.slot] || []; if (!own.length) return cs; const was = cur(t); return cs.map((c, i) => (own.includes(i) ? (was[i] || null) : c)); };
    if (lastFav !== sig) {
      const lead = mine.find(t => t.slot === 1);
      if (lead) { const rnd = assistantMasmonRng(`${state.seed}|${aid}|like|${sig}`); hist.push({ v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'like', at: day, season, fav: sig, roles: { 1: 'main' }, slots: { 1: keepMine(lead, assistantMasmonDyeMake2(aid, p, lead.monster, 'main', rnd)) } }); changed = true; }
    } else if (lastSeason && lastSeason !== season && mine.length) {
      const rnd = assistantMasmonRng(`${state.seed}|${aid}|${season}`);
      const lastSeasonSlot = Number(Object.keys((([...hist].reverse().find(e => e.why === 'season')) || {}).slots || {})[0]);
      const pool = mine.length > 1 ? mine.filter(t => t.slot !== lastSeasonSlot) : mine;
      const t = pool[Math.floor(rnd() * pool.length)];
      const b = [...cur(t)]; b.__season = season;
      hist.push({ v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'season', at: day, season, fav: sig, roles: { [t.slot]: 'season' }, slots: { [t.slot]: keepMine(t, assistantMasmonDyeMake2(aid, p, t.monster, 'season', rnd, b)) } }); changed = true;
    }
    if (hist.length > 40) hist.splice(0, hist.length - 40);
    if (hist.length) dyes[aid] = hist;
  }
  return changed ? { ...state, dyes } : state;
};
// ---------- 引き直し(draw v:2)。2026-11-08 社長 Q1A・Q2A・Q3・Q4A ----------
// 候補を広げる: 好きなモンスター(表の編成・迎える・控え・likeMon)+その血統の仲間+足りなければ実装済みのほかのモンスター。
//   苦手なモンスターとその血統は入れない。勇者モン(1体目)は好きなモンスターから。8体の並びと名前・色・育ち方はプレイヤーごと(種はブリーダーID+「draw-v2」)
//   仲良し度 Lv1 で1体(勇者モン)、そこから Lv2 ごとに1体ずつ迎える(Lv3・5・7・9・11・13・15。最大8体)
const assistantMasmonWelcomeLv = (slot) => slot * 2 - 1;
const ASSISTANT_MASMON_GROW_KINDS = Object.freeze(['攻撃型', '防御型', 'ライフ型', 'ガッツ型', 'すばやさ型']);
const assistantMasmonDrawPool = (aid, p) => {
  const ok = (m) => typeof m === 'string' && !!assistantMasmonMon(m);
  const badMon = new Set(), badLin = new Set();
  for (const x of p.dislikeMon || []) { if (x.monster) { badMon.add(x.monster); const l = assistantMasmonLineage(x.monster); if (l) badLin.add(l); } if (x.lineage) badLin.add(x.lineage); }
  const fine = (m) => ok(m) && !badMon.has(m) && !badLin.has(assistantMasmonLineage(m));
  const likes = [], more = [], seen = new Set();
  const add = (list, t) => { if (t && fine(t.monster) && !seen.has(t.monster)) { seen.add(t.monster); list.push(t); } };
  for (const t of p.team || []) add(likes, t);
  for (const x of p.likeMon || []) if (x.monster) add(likes, { monster: x.monster, why: x.why });
  for (const t of [...(p.extra || []), ...(ASSISTANT_MASMON_POOL_MORE[aid] || [])]) add(more, t);
  const lins = new Set();
  for (const t of likes) { const l = assistantMasmonLineage(t.monster); if (l) lins.add(l); }
  for (const x of p.likeMon || []) if (x.lineage) lins.add(x.lineage);
  const all = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? Object.keys(ALL_PLAYER_MONSTERS) : [];
  for (const m of all) { const l = assistantMasmonLineage(m); if (l && lins.has(l)) add(more, { monster: m, why: `${assistantMasmonLineageName(l) || '好きな種類'}の仲間だから気になる` }); }
  const rest = []; for (const m of all) add(rest, { monster: m, why: '一緒にいると楽しい' });
  return { likes, more, rest };
};
const assistantMasmonDrawFor = (aid, seed) => {
  const p = assistantMasmonBasePlanOf(aid);
  if (!p) return null;
  const rnd = assistantMasmonRng(`${seed}|${aid}|draw-v${ASSISTANT_MASMON_DRAW_V}`);
  const { likes, more, rest } = assistantMasmonDrawPool(aid, p);
  if (!likes.length) return null;
  const lead = likes[Math.floor(rnd() * likes.length)];
  const picked = [lead];
  for (const t of [...assistantMasmonShuffle([...likes.filter(t => t !== lead), ...more], rnd), ...assistantMasmonShuffle(rest, rnd)]) { if (picked.length >= ASSISTANT_MASMON_DRAW_MAX) break; if (!picked.some(x => x.monster === t.monster)) picked.push(t); }
  const H = ASSISTANT_MASMON_DYE_HABIT[aid] || ASSISTANT_MASMON_DYE_HABIT.mua;
  const roles = ['main']; while (roles.length < picked.length) roles.push(...assistantMasmonShuffle(H.roles, rnd));
  return picked.map((t, i) => {
    const slot = i + 1, mon = assistantMasmonMon(t.monster);
    const lv0 = Number.isFinite(t.lv) ? t.lv : Math.max(5, 20 - slot * 2);
    const lv = Math.max(1, Math.min(30, lv0 + Math.round((rnd() - 0.5) * 6)));
    const grow = typeof t.grow === 'string' && t.grow ? t.grow : ASSISTANT_MASMON_GROW_KINDS[Math.floor(rnd() * ASSISTANT_MASMON_GROW_KINDS.length)];
    const nick = typeof t.nick === 'string' && t.nick ? t.nick : (mon && mon.name) || t.monster;
    return { slot, monster: t.monster, nick, lv, grow, why: t.why || '', role: roles[i], welcome: assistantMasmonWelcomeLv(slot), colors: assistantMasmonDyeMake2(aid, p, t.monster, roles[i], rnd), ai: false };
  });
};
// ---------- 迎えるその時に選ぶ(2026-11-08 社長「その時の性格や今後の関わり方でマスモンが変わる」→「迎えるときに決める」) ----------
// 材料: いまの助手の気分 / 仲良し度の段(よそいき↔本音)/ その日プレイヤーと一緒にしたこと(モンヒロビート・MFバトルカード・バトル・おしゃべり)/
//   贈った道具で分かった好みの数 / すでにいるマスモンとの釣り合い(同じ血統ばかりにしない・育ち方をそろえすぎない)。苦手なモンスターとその血統は入れない
// 選んだら pick に書く(その枠は1回だけ。開き直しても変わらない)
const ASSISTANT_MASMON_PLAY_TAGS = Object.freeze({
  rhythm: ['Melody', 'Illumine', 'Dreamy', 'Mia', 'Kuromy', 'MelWhip', 'Snegurochka', 'Pixie'],
  battle: ['Golem', 'Tiger', 'Zan', 'Eiki', 'KenshiMocchi', 'Kyubi', 'Ark', 'Iblis', 'Pandora'],
  card: ['Monol', 'Orihime', 'Spooky', 'Ghost', 'Suezo', 'Yggdrasil', 'Undine'],
  chat: ['Mocchi', 'Ham', 'Plant', 'Oboro', 'Mitarashi', 'Yaobikuni', 'Dreamy'],
});
const ASSISTANT_MASMON_MOOD_TAG = Object.freeze({ happy: 'like', lonely: 'chat', restless: 'rhythm', sulky: 'rest', sleepy: 'chat', eager: 'battle' });
// 選んだわけ(迎える場面の下の1行・くわしい画面)。助手の口調にはしない(だれが読んでもおかしくない言い方)
const ASSISTANT_MASMON_PICK_REASON = Object.freeze({
  rhythm: '最近いっしょにモンヒロビートをしているから', card: '最近いっしょにMFバトルカードをしているから', battle: '最近いっしょにバトルをしているから', chat: '最近よくおしゃべりしているから',
  gift: 'いろいろ贈ってもらったお礼に、好きなモンスターを',
  mood_happy: 'ごきげんな日に、好きなモンスターを', mood_lonely: 'さみしくて、そばにいてくれそうなモンスターを', mood_restless: 'そわそわして、いっしょに動けるモンスターを',
  mood_sulky: 'ちょっとすねて、いつもと違うモンスターを', mood_sleepy: 'ねむくて、のんびりしたモンスターを', mood_eager: 'やる気が出て、強そうなモンスターを',
  open: '仲良くなって、意外な好みを見せたくて', wish: 'あなたが「迎えてみたら？」と言っていたから', like: '前から好きだったモンスターだから', lineage: '好きなモンスターの仲間だから', balance: '編成の釣り合いを考えて',
});
const assistantMasmonPickContext = (aid, bondLv) => {
  const ctx = { lv: Number.isFinite(bondLv) ? bondLv : 1, mood: null, counts: {}, gifts: 0 };
  try { const l = typeof ASSISTANT_LIFE_STORE !== 'undefined' ? ASSISTANT_LIFE_STORE.state : null; if (l && l.life && l.life.moods && typeof l.life.moods[aid] === 'string') ctx.mood = l.life.moods[aid]; if (l && l.play && l.play.counts) ctx.counts = { ...l.play.counts }; } catch (_) {}
  try {
    const g = typeof ASSISTANT_LIFE_GIFT_STORE !== 'undefined' ? ASSISTANT_LIFE_GIFT_STORE.state : null;
    const known = g && g.likes && g.likes.known && g.likes.known[aid] ? Object.values(g.likes.known[aid]).filter(v => v === 'gift').length : 0;
    const solo = g && g.solo && g.solo.used ? Object.values(g.solo.used).filter(v => v === aid).length : 0;
    ctx.gifts = known + solo;
  } catch (_) {}
  return ctx;
};
const assistantMasmonChooseAt = (aid, slot, have, ctx, seed, day) => {
  const p = assistantMasmonBasePlanOf(aid);
  if (!p) return null;
  const rnd = assistantMasmonRng(`${seed}|${aid}|pick|${slot}|${day}|${ctx.mood || ''}`);
  const { likes, more, rest } = assistantMasmonDrawPool(aid, p);
  const haveMons = new Set(have.map(t => t.monster));
  const linCount = {}; for (const t of have) { const l = assistantMasmonLineage(t.monster); if (l) linCount[l] = (linCount[l] || 0) + 1; }
  const cands = [...likes.map(t => ({ t, src: 'like' })), ...more.map(t => ({ t, src: 'lineage' })), ...rest.map(t => ({ t, src: 'rest' }))].filter(c => !haveMons.has(c.t.monster));
  if (!cands.length) return null;
  const tagOf = (m) => Object.keys(ASSISTANT_MASMON_PLAY_TAGS).filter(k => ASSISTANT_MASMON_PLAY_TAGS[k].includes(m));
  let best = null;
  for (const c of cands) {
    const why = {}; const m = c.t.monster, tags = tagOf(m);
    let sc = c.src === 'like' ? 3 : c.src === 'lineage' ? 2 : 0.4;
    for (const k of ['rhythm', 'battle', 'card', 'chat']) { const n = Number(ctx.counts[k]) || 0; if (n > 0 && tags.includes(k)) { const v = Math.min(3, n * 0.6); sc += v; why[k] = v; } }
    const mt = ASSISTANT_MASMON_MOOD_TAG[ctx.mood];
    if (mt && ((mt === 'like' && c.src === 'like') || (mt === 'rest' && c.src !== 'like') || tags.includes(mt))) { sc += 1.5; why[`mood_${ctx.mood}`] = 1.5; }
    if (ctx.gifts > 0 && c.src === 'like') { const v = Math.min(2, ctx.gifts * 0.4); sc += v; why.gift = v; }
    if (ctx.lv >= 9 && c.src !== 'like') { sc += 1; why.open = 1; }
    if (ctx.wish && ctx.wish === m) { sc += ctx.wishBoost || 6; why.wish = 9; } // プレイヤーが「この種類を迎えてみたら?」と言ったもの
    const l = assistantMasmonLineage(m); if (l && (linCount[l] || 0) >= 2) sc *= 0.4;
    sc *= 0.6 + 0.8 * rnd();
    if (!best || sc > best.sc) best = { c, sc, why };
  }
  const top = Object.entries(best.why).sort((a, b) => b[1] - a[1])[0];
  const reason = top ? top[0] : best.c.src === 'like' ? 'like' : best.c.src === 'lineage' ? 'lineage' : 'balance';
  const kinds = new Set(have.map(t => assistantMasmonGrowKind(t.grow)));
  const miss = ASSISTANT_MASMON_GROW_KINDS.filter(k => !kinds.has(k));
  const grow = miss.length ? miss[Math.floor(rnd() * miss.length)] : ASSISTANT_MASMON_GROW_KINDS[Math.floor(rnd() * ASSISTANT_MASMON_GROW_KINDS.length)];
  const H = ASSISTANT_MASMON_DYE_HABIT[aid] || ASSISTANT_MASMON_DYE_HABIT.mua;
  const role = H.roles[Math.floor(rnd() * H.roles.length)];
  const mon = assistantMasmonMon(best.c.t.monster);
  return { slot, monster: best.c.t.monster, nick: typeof best.c.t.nick === 'string' && best.c.t.nick ? best.c.t.nick : (mon && mon.name) || best.c.t.monster,
    lv: Math.max(1, Math.min(30, 4 + Math.round(ctx.lv * 0.9) + Math.round((rnd() - 0.5) * 4))), grow, why: ASSISTANT_MASMON_PICK_REASON[reason], role, welcome: assistantMasmonWelcomeLv(slot),
    colors: assistantMasmonDyeMake2(aid, p, best.c.t.monster, role, rnd), ai: !!(typeof best.c.t.nick === 'string' && best.c.t.nick), reason, at: day }; // 表に名前がある子は、迎えるときに助手がその名前で紹介するので名前済み(あとから AI で付け直さない・2026-11-11 社長「助手がその名前を紹介してきた」)
};
// まだの枠のうち、仲良し度が届いた枠を、その場で選んで迎える(pick に書く・1回だけ)。迎えた行の配列を返す(場面は最後の1体)
const assistantMasmonWelcomeDue = async (aid, bondLv) => {
  await ASSISTANT_MASMON_STORE.load();
  const st = ASSISTANT_MASMON_STORE.state;
  if (!assistantMasmonDrawOn(aid, st) || !Number.isFinite(bondLv)) return [];
  const p = assistantMasmonPlanOf(aid);
  const due = (p.extra || []).filter(t => t.unknown && bondLv >= t.welcome);
  if (!due.length) return [];
  const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : new Date().toISOString().slice(0, 10);
  const ctx = assistantMasmonPickContext(aid, bondLv);
  const mine0 = assistantMasmonMineOf(st, aid); if (mine0.wish) { ctx.wish = mine0.wish; ctx.wishBoost = mine0.wishSoft ? 3 : 6; }
  const have = assistantMasmonRowsOf(st, aid);
  const picked = {};
  for (const t of due) { const r = assistantMasmonChooseAt(aid, t.slot, [...have, ...Object.values(picked)], ctx, st.seed, day); if (r) picked[t.slot] = r; }
  const list = Object.values(picked);
  if (!list.length) return [];
  const cur = ASSISTANT_MASMON_STORE.state;
  const mine = { ...((cur.pick && cur.pick[aid]) || {}) };
  for (const r of list) if (!mine[r.slot]) mine[r.slot] = r; // すでにある枠は書き換えない
  // 希望の種類を迎えたら、希望は消す
  const m0 = assistantMasmonMineOf(cur, aid); const gotWish = m0.wish && list.some(r => r.monster === m0.wish);
  const next = { ...cur, pick: { ...(cur.pick || {}), [aid]: mine }, ...(gotWish ? { mine: { ...(cur.mine || {}), [aid]: { ...m0, wish: '' } } } : {}) };
  ASSISTANT_MASMON_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
  const last = list[list.length - 1];
  try { if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${assistantLifeName(aid)}が新しいマスモン「${last.nick}」を迎えた`, [aid]); } catch (_) {}
  void assistantMasmonAskPickNames();
  return list;
};
// 迎えたマスモンの名前も、上の assistantMasmonAskNames が「AI の名前がまだのもの」をまとめて付ける
const assistantMasmonAskPickNames = () => assistantMasmonAskNames();
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
  // 引き直し(draw v:2)が無い助手のぶんだけ作る。前の版(made・welcomed)は書き換えずに残す。同じ版はあれば二度引かない
  const need = ASSISTANT_MASMON_PLAN.map(a => a.id).filter(id => !(cur.draw && cur.draw.v === ASSISTANT_MASMON_DRAW_V && cur.draw.made[id]));
  if (need.length) {
    let seed = cur.seed;
    if (!seed) {
      let bid = null; try { bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null; } catch (_) { bid = null; }
      seed = typeof bid === 'string' && /^[\w-]{4,60}$/.test(bid) ? bid : `r-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    }
    const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : new Date().toISOString().slice(0, 10);
    const st0 = ASSISTANT_MASMON_STORE.state;
    const d0 = st0.draw && st0.draw.v === ASSISTANT_MASMON_DRAW_V ? st0.draw : { v: ASSISTANT_MASMON_DRAW_V, at: day, made: {}, welcomed: {}, named: false, fav: {} };
    const draw = { ...d0, made: { ...d0.made }, welcomed: { ...d0.welcomed }, fav: { ...d0.fav } };
    for (const id of need) {
      const m = assistantMasmonDrawFor(id, seed);
      if (!m) continue;
      draw.made[id] = m;
      draw.welcomed[id] = { [m[0].monster]: day }; // 勇者モン(1体目)は仲良し度 Lv1 から一緒にいる
      draw.fav[id] = assistantMasmonFavSig(assistantMasmonBasePlanOf(id));
    }
    if (!draw.at) draw.at = day;
    const next = { ...st0, seed, draw };
    ASSISTANT_MASMON_STORE.set(next);
    try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
  }
  // 季節の染め直し・好きな色が変わったときの染め直し(足すだけ。同じ季節は二度足さない)
  try {
    const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '';
    const st = ASSISTANT_MASMON_STORE.state;
    const next = st.seed ? assistantMasmonDyeEnsure(st, day) : st;
    if (next !== st) { ASSISTANT_MASMON_STORE.set(next); try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {} }
  } catch (_) {}
  try { const st = ASSISTANT_MASMON_STORE.state; const next = assistantMasmonNickFix1(st); if (next !== st) { ASSISTANT_MASMON_STORE.set(next); try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {} } } catch (_) {}
  void assistantMasmonAskNames();
};
// 種類名か(どのモンスターの名前とも同じなら真)
const assistantMasmonIsMonName = (n) => { try { return typeof ALL_PLAYER_MONSTERS !== 'undefined' && Object.values(ALL_PLAYER_MONSTERS).some(m => m && m.name === n); } catch (_) { return false; } };
// 一度だけの直し(印 nickFix1): 迎えたときに助手が表の名前(例: センくん)で紹介したのに、そのあとの AI の名前付けで種類名(エイキ)になった子を、表の名前に戻す。
//   戻すのは「いまの名前が種類名そのもの」で「プレイヤーが提案で名前を変えていない」迎えた枠(pick)だけ。表に名前が無い・同じ助手のほかの子と重なるときは戻さない(あとで AI が付ける)
const assistantMasmonNickFix1 = (st) => {
  if (!st || st.nickFix1 || !st.draw || st.draw.v !== ASSISTANT_MASMON_DRAW_V) return st;
  const pick = { ...(st.pick || {}) };
  for (const aid of Object.keys(pick)) {
    const base = assistantMasmonBasePlanOf(aid); if (!base || !pick[aid]) continue;
    const pool = assistantMasmonDrawPool(aid, base); const all = [...pool.likes, ...pool.more, ...pool.rest];
    const mine = assistantMasmonMineOf(st, aid); const pk = { ...pick[aid] };
    for (const k of Object.keys(pk)) {
      const t = pk[k]; const mon = assistantMasmonMon(t.monster);
      if (!mon || t.nick !== mon.name || (mine.names[t.slot] || []).length) continue;
      const src = all.find(x => x.monster === t.monster && typeof x.nick === 'string' && x.nick);
      if (!src || assistantMasmonRowsOf({ ...st, pick: { ...pick, [aid]: pk } }, aid).some(y => y.nick === src.nick)) continue;
      pk[k] = { ...t, nick: src.nick, ai: true };
    }
    pick[aid] = pk;
  }
  return { ...st, pick, nickFix1: true };
};
// 名前を Claude API で(assistant-chat の kind:'masmon_names')。印 assistantMasmonNamesApi が偽・失敗のときは表の名前のまま
//   迎えたマスモン(勇者モン・draw で迎えた枠・pick)のうち、AI の名前がまだのものだけをまとめて1回。失敗・上限のときはその日はもう試さない(pickNameDay)
//   2026-11-08 社長「名前を変えてないのがあった」: 前は1回付けたら(draw.named)二度と試さなかったので、6〜8体目(受け口が5体までだった間)や
//   言葉の決まりで落ちた名前が表のままだった。いまは「まだのものだけ」を次に開いたときに付け直し、付け直したら1行だけ知らせる(renamed2)
//   2026-11-11 社長「名前を付けたのにエイキのまま」: 起動時の名付けが走っているあいだに迎えた子は、頼みが 'skip' で捨てられ、その日は名前が付かなかった。
//   走っている最中に頼まれたら覚えておき、終わったあともう1回だけ回す(新しく迎えた子もその場で名前が付く)
let _assistantMasmonNamesBusy = false, _assistantMasmonNamesAgain = false;
const assistantMasmonAskNames = async () => {
  if (_assistantMasmonNamesBusy) { _assistantMasmonNamesAgain = true; return 'skip'; }
  const r = await assistantMasmonAskNamesOnce();
  if (_assistantMasmonNamesAgain) { _assistantMasmonNamesAgain = false; if (r !== 'failed' && r !== 'tired') return assistantMasmonAskNamesOnce(); } // 失敗・上限の日はその日はもう試さない(前のまま)
  return r;
};
const assistantMasmonAskNamesOnce = async () => {
  const st = ASSISTANT_MASMON_STORE.state;
  const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '';
  if (!st.draw || st.draw.v !== ASSISTANT_MASMON_DRAW_V || _assistantMasmonNamesBusy || !day || st.pickNameDay === day) return 'skip';
  if (!(typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonNamesApi === true) || typeof ASSISTANT_CHAT_URL === 'undefined' || typeof SB_HEADERS === 'undefined') return 'skip';
  const items = Object.keys(st.draw.made).map(a => { const ns = assistantMasmonMineOf(st, a).nameStyle; return { a, s: assistantMasmonRowsOf(st, a).filter(t => !t.ai).map(t => { const m = assistantMasmonMon(t.monster); return { slot: t.slot, mon: m ? m.name : t.monster, why: t.why }; }), ...(ns ? { style: ns.style } : {}) }; }).filter(x => x.s.length); // プレイヤーが提案した名前のくせも添える
  if (!items.length) return 'skip';
  let bid = null; try { bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null; } catch (_) { bid = null; }
  if (!bid) return 'skip';
  _assistantMasmonNamesBusy = true;
  const markDay = () => { const c = ASSISTANT_MASMON_STORE.state; const n = { ...c, pickNameDay: day }; ASSISTANT_MASMON_STORE.set(n); try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, n, false); } catch (_) {} };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res = null;
    try { const r = await fetch(ASSISTANT_CHAT_URL, { method: 'POST', headers: SB_HEADERS, signal: controller.signal, body: JSON.stringify({ kind: 'masmon_names', breederId: bid, items }) }); res = r.ok ? await r.json() : null; } finally { clearTimeout(timer); }
    if (!res || res.ok !== true || !res.names || typeof res.names !== 'object') { markDay(); return res && res.kind === 'tired' ? 'tired' : 'failed'; }
    const cur = ASSISTANT_MASMON_STORE.state;
    if (!cur.draw || cur.draw.v !== ASSISTANT_MASMON_DRAW_V) return 'skip';
    const made = { ...cur.draw.made }, pick = { ...(cur.pick || {}) }, renamed2 = { ...(cur.renamed2 || {}) };
    for (const a of Object.keys(made)) {
      const got = res.names[a] && typeof res.names[a] === 'object' ? res.names[a] : {};
      const used = new Set(assistantMasmonRowsOf(cur, a).filter(t => t.ai).map(t => t.nick));
      let changed = false;
      const name = (t) => { if (t.ai) return t; const n = typeof got[t.slot] === 'string' ? got[t.slot].trim() : ''; const styled = !!assistantMasmonMineOf(cur, a).nameStyle; const ok = (styled ? assistantMasmonAskNameOk(n) : /^[ぁ-ゖァ-ヺー一-龠々・]{2,8}$/u.test(n)) && !used.has(n) && !assistantMasmonIsMonName(n); /* 種類名そのもの(例: エイキ)は名前にしない */ if (!ok) return t; used.add(n); changed = true; return { ...t, nick: n, ai: true }; };
      const pk = pick[a] ? { ...pick[a] } : null;
      const w = cur.draw.welcomed[a] || {};
      made[a] = made[a].map(t => (pk && pk[t.slot]) || !(t.slot === 1 || w[t.monster]) ? t : name(t));
      if (pk) { for (const k of Object.keys(pk)) pk[k] = name(pk[k]); pick[a] = pk; }
      if (changed && cur.draw.named) renamed2[a] = 'new'; // 付け直し(2回目から)のときだけ1行知らせる
    }
    const next = { ...cur, draw: { ...cur.draw, made, named: true }, pick, renamed2 };
    ASSISTANT_MASMON_STORE.set(next);
    try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
    return 'ok';
  } catch (_) { markDay(); return 'failed'; } finally { _assistantMasmonNamesBusy = false; }
};
// カード部(推し・好き・素顔のデッキ)が読む材料の口(2026-11-08 ルールくん・ソランドと決めた形)。読むだけ・何も保存しない
//   推し・好きは助手の表(はじめの好み)から読む。マスモンの引き直し・迎えでは変わらない(デッキの主役が急に入れかわらない)
//   → { core: 推しの血統 id, likes: [好きなモンスター id(実装済みだけ)], likeLineages: [ぜんぶ好きな血統 id], friendLv: 仲良し度, mood: いまの気分 id } か null
let _assistantLifeCardBonds = {};
const assistantLifeCardBondsMirror = (bonds) => { _assistantLifeCardBonds = bonds && typeof bonds === 'object' ? bonds : {}; };
const assistantLifeCardMaterial = (id) => {
  try {
    if (typeof assistantLifeEnabled === 'function' && !assistantLifeEnabled()) return null;
    const p = assistantMasmonBasePlanOf(id);
    if (!p) return null;
    const rows = Array.isArray(p.likeMon) ? p.likeMon : [];
    const likes = rows.map(x => x && x.monster).filter(m => typeof m === 'string' && assistantMasmonMon(m));
    const likeLineages = rows.map(x => x && x.lineage).filter(l => typeof l === 'string' && l);
    const first = rows[0] || null;
    const core = first ? (first.lineage || (first.monster ? assistantMasmonLineage(first.monster) : null)) : null;
    let friendLv = 0;
    try { const b = _assistantLifeCardBonds[id]; const pts = typeof normalizeAssistantBond === 'function' ? normalizeAssistantBond(b).points : null; const lv = Number.isFinite(pts) && typeof assistantBondLevelOf === 'function' ? assistantBondLevelOf(pts) : 0; friendLv = Number.isFinite(lv) ? lv : 0; } catch (_) { friendLv = 0; }
    let mood = null;
    try { const m = typeof ASSISTANT_LIFE_STORE !== 'undefined' && ASSISTANT_LIFE_STORE.state.life && ASSISTANT_LIFE_STORE.state.life.moods ? ASSISTANT_LIFE_STORE.state.life.moods[id] : null; mood = typeof m === 'string' && m ? m : null; } catch (_) { mood = null; }
    return { core: core || null, likes, likeLineages, friendLv, mood };
  } catch (_) { return null; }
};
// ---------- 助手に「提案する」(2026-11-08 社長「こっちからアイディア出して誘導できるように」 Q1B・Q2C・Q3A・Q4・Q5A) ----------
// プレイヤーが自由に書いた提案を AI(assistant-chat の kind:'masmon_suggest')が読み取り、ゲームが好き嫌いと仲良し度で「受ける・少し変える・断る」を決めて当てる。
//   読み取った中身は、送った候補(色・部位・種類・枠・デッキ)の中に丸めてある。顔まわりの部位は染めない。苦手なモンスターは迎えない(Lv10 以上なら「今回だけ」)
//   受けてもらえるのは助手1人に1日3回(断られた・読み取れなかった・つながらなかった分は数えない)。どれも「前に戻してもらう」ができる
//   保存は asked(提案の記録)・mine(提案で決まった所)を足すだけ。色は dyes に why:'ask' で足す(季節の染め直しはプレイヤーが決めた部位を上書きしない)
// 名前の確かめ(サーバと同じ考え。フレンドの家にも出るので、連絡先らしいもの・悪い言葉は当てない)
const assistantMasmonAskNameOk = (n) => {
  const t = String(n || '').trim(); if (!t || t.length > 12 || /[\u0000-\u001f\u007f<>{}`\\]/.test(t)) return false;
  const f = t.normalize('NFKC').toLowerCase();
  if ((f.match(/\d/g) || []).length >= 5 || /[@＠]|#\d|(^|[^a-z])id([^a-z]|$)|https?|www|\.(com|jp|net)/.test(f)) return false;
  // ことばの表はサーバ(assistant-chat core.js の SUGGEST_CONTACT_WORDS)と同じものをそろえて書く
  const words = ['line', 'ライン', 'らいん', 'insta', 'インスタ', 'いんすた', 'discord', 'ディスコ', 'でぃすこ', 'twitter', 'ツイッター', 'tiktok', 'ティックトック', 'youtube', 'ユーチューブ', 'ゆーちゅーぶ', 'snapchat', 'スナチャ', 'mail', 'メール', 'gmail', 'skype', 'kakao', 'カカオ', 'telegram', 'qrコード', 'http', 'www', '.com', '.jp', '.net'];
  const bare = f.replace(/[\s\u3000・。、,._\-~〜*＊!！?？♪☆★♡]/g, '');
  if (words.some(w => f.includes(w) || bare.includes(w.replace(/\./g, '')))) return false; // 伸ばす棒は抜かない(「メール」を「メル」にして「メルホイップ」を落とさない)
  return true;
};
// AI の返事が足りない種類だけ使う、助手ごとの用意した台詞(受ける/少し変える/断る/ふつうの返事)。ほかの種類の文は使い回さない
const ASSISTANT_MASMON_ASK_LINES = Object.freeze({
  mua: { yes: 'いいね♪ そうしてみる！まぢありがと〜', some: 'ちょっとだけ取り入れてみた！まぢいい感じかも', no: 'ん〜、それはちょっと違うかも…ごめんね！', talk: 'ん？どうしたいか、もうちょい教えて！', ng: 'その名前はちょっと付けられないかも…別の名前にしよ！', think: 'ん〜、ちょっと考えとくね！' },
  kiki: { yes: 'はい、そうしてみますね。ありがとうございます', some: '少しだけ取り入れてみました', no: '申し訳ありません、それは少し…ごめんなさい', talk: 'どうしたいか、もう少し教えていただけますか？', ng: 'その言葉は名前には使えないんです…別の名前はいかがですか？', think: '少し考えてみますね' },
  momosuke: { yes: 'いいね〜！ももがそうしちゃうよ♡', some: 'ちょっとだけ変えてみたよ〜♡', no: 'ん〜、それはももの好みじゃないかも〜ごめんね', talk: 'ん〜？どうしたいか、もうちょっと教えて♡', ng: 'その名前はつけられないの〜ごめんね、別のにしよ♡', think: 'ん〜、ちょっと考えとくね♡' },
  dra: { yes: 'おう、そうしてみるぞ。えへへ', some: 'ちょっとだけ変えてみたぞ', no: 'それはちょっとなあ…ごめんな', talk: 'ん？どうしたいのか、もうちょい教えてくれ', ng: 'その言葉は名前にできないぞ…別のにしてくれ', think: 'ちょっと考えとくぞ' },
  atsu: { yes: 'いいね、そうしてみるわ笑', some: 'ちょっとだけ取り入れてみたわ笑', no: 'それはちょっと違うかな笑 ごめんね(｡-人-｡)', talk: 'ん？どうしたいか教えて笑', ng: 'その名前は付けられないんだわ笑 別のにしよ', think: 'ちょっと考えとくわ笑' },
  kyuko: { yes: 'ほい、そうしてみるよぉ笑', some: 'ちょっとだけ変えてみたよぉ笑', no: 'それはちょっとなぁ…ごめんねぇ笑', talk: 'ん〜？どうしたいか教えてよぉ笑', ng: 'その名前は付けられないんだよぉ笑 別のにしよぉ', think: 'ちょっと考えとくよぉ笑' },
  sorashido: { yes: 'なるほど了解です！ そうしてみます笑', some: '少しだけ取り入れてみました・・・！', no: 'それは計算に合わないんです・・・すみません', talk: 'どうしたいか、もう少し教えてください・・・！', ng: 'その言葉は名前に使えないんです・・・別の名前でお願いします笑', think: '少し考えておきますね・・・！' },
  erubin: { yes: 'うん、そうしてみるね笑', some: 'ちょっとだけ取り入れてみたよ笑', no: 'それはちょっと…ごめんね🤔', talk: 'どうしたいか、もうちょっと教えてね🤔', ng: 'その名前は付けられないみたい…別のにしよ🤔', think: 'ちょっと考えとくね🤔' },
});
// ng(名前として通さない言葉)・think(受けたが今回は変えない)は、AI の返事を使わず用意した台詞だけ
const assistantMasmonAskLine = (aid, replies, kind) => (kind !== 'ng' && kind !== 'think' && replies && replies[kind]) || (ASSISTANT_MASMON_ASK_LINES[aid] || ASSISTANT_MASMON_ASK_LINES.mua)[kind];
const ASSISTANT_MASMON_ASK_PER_DAY = 10; // 2026-11-09 社長「1日の制限は10に増やして」(前は3)
const ASSISTANT_MASMON_ASK_HINT = Object.freeze({
  masmon: '名前や色、育て方など、このマスモンのことを自由に書いてみてください(例: 体を夕焼けっぽくしてみたら？/名前に♪を付けて/攻撃型に育ててみたら？/命中を鍛えて/休ませて/別のマスモンに変えてみたら？/みんなの名前をお菓子っぽくして)',
  hero: '勇者モンについて自由に書いてみてください(例: 勇者モンはミーアにしてみたら？/名前に♪を付けたら？/プラントに変えてみたら？)',
  welcome: '次に迎えてほしいマスモンを書いてみてください(例: 次はプラントを迎えてみたら？)',
  deck: 'MFバトルカードのデッキについて書いてみてください(例: 推しのデッキは守りで「まったり作戦」にしたら？)',
});
const ASSISTANT_MASMON_DECK_FACE = Object.freeze({ oshi: '推しのデッキ', like: '好きのデッキ', sugao: '素顔のデッキ' });
const ASSISTANT_MASMON_DECK_PLAN = Object.freeze({ attack: '攻め', guard: '守り', normal: 'ふつう' });
const _assistantMasmonBondNow = {}; // シートを開いたときの仲良し度(提案の受け方に使う)
const assistantMasmonSave = (next) => { ASSISTANT_MASMON_STORE.set(next); try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {} };
const assistantMasmonToday = () => (typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : new Date().toISOString().slice(0, 10));
const assistantMasmonAskUsed = (aid, st = ASSISTANT_MASMON_STORE.state) => { const d = assistantMasmonToday(); return (st.asked || []).filter(x => x.a === aid && x.day === d && x.counted).length; };
const assistantMasmonAskOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonSuggest === true && typeof ASSISTANT_CHAT_URL !== 'undefined' && typeof SB_HEADERS !== 'undefined';
const assistantMasmonColorIds = () => (typeof MASU_COLOR_LABELS !== 'undefined' ? Object.keys(MASU_COLOR_LABELS) : []);
// AI に渡す材料(名前・メモなどプレイヤーのことは入れない)
const assistantMasmonAskCtx = (aid, from, t, lv) => {
  const st = ASSISTANT_MASMON_STORE.state, p = assistantMasmonBasePlanOf(aid);
  const rows = assistantMasmonRowsOf(st, aid);
  const monName = (m) => (assistantMasmonMon(m) || {}).name || m;
  const ctx = { lv, colors: [], fav: (p.favColors || []).map(x => assistantMasmonColorName(x.color)), dislike: [], cands: [], team: rows.map(r => ({ slot: r.slot, nick: r.nick, mon: monName(r.monster) })), decks: Object.entries(ASSISTANT_MASMON_DECK_FACE).map(([face, name]) => ({ face, name })) };
  for (const x of p.dislikeMon || []) ctx.dislike.push(x.monster ? monName(x.monster) : `${assistantMasmonLineageName(x.lineage) || x.lineage}`);
  ctx.colors = assistantMasmonColorIds().map(id => ({ id, label: assistantMasmonColorName(id) })); // 色のくせはどこからでも言える
  if (t && (from === 'masmon' || from === 'hero')) { // くわしい画面と勇者モンの所は、そのマスモンの名前・色も変えられる
    const n = assistantMasmonRegions(t.monster) || 3;
    const now = assistantMasmonDyeNowOf(st, aid, t.slot, (rows.find(r => r.slot === t.slot) || {}).colors || []);
    ctx.mon = { slot: t.slot, name: monName(t.monster), nick: t.nick, grow: assistantMasmonGrowKind(t.grow), parts: Array.from({ length: n }, (_, i) => { const r = assistantMasmonPartRule(t.monster, i); return r.keep ? `${r.name}(染めない)` : r.name; }), now: Array.from({ length: n }, (_, i) => (now[i] ? assistantMasmonColorName(String(now[i]).split('@')[0]) : '元の色')) };
    ctx.colors = assistantMasmonColorIds().map(id => ({ id, label: assistantMasmonColorName(id) }));
  }
  { // 迎える・入れ替えの候補(どこから開いても、言われたことに合わせて受ける)
    const pool = assistantMasmonDrawPool(aid, p); const have = new Set(rows.map(r => r.monster));
    const bad = (p.dislikeMon || []).map(x => x.monster).filter(Boolean);
    ctx.cands = [...pool.likes, ...pool.more, ...pool.rest].map(x => x.monster).concat(bad).filter((m, i, a) => !have.has(m) && a.indexOf(m) === i && assistantMasmonMon(m)).map(m => ({ id: m, name: monName(m) }));
  }
  return ctx;
};
// 受け方(Q3A): 好きなもの → 受ける/どちらでもない → 仲良し度 Lv5 以上は受ける・それ未満は少し変える/苦手 → 断る(Lv10 以上なら今回だけ受ける)
const assistantMasmonAskJudge = (aid, r, lv) => {
  const p = assistantMasmonBasePlanOf(aid), H = ASSISTANT_MASMON_DYE_HABIT[aid] || ASSISTANT_MASMON_DYE_HABIT.mua;
  let taste = 'mid';
  if (r.kind === 'color' || r.kind === 'colorStyle') {
    if (r.kind === 'colorStyle') r = { ...r, colors: r.palette.map(c => ({ color: c })) };
    const fav = new Set([...(p.favColors || []).map(x => assistantMasmonBaseOf(x.color)), ...(H.extra || []).map(assistantMasmonBaseOf)]);
    const avoid = new Set((H.avoid || []).flatMap(c => [c, assistantMasmonBaseOf(c)]));
    const ts = r.colors.map(x => (avoid.has(x.color) || avoid.has(assistantMasmonBaseOf(x.color)) ? 'hate' : fav.has(assistantMasmonBaseOf(x.color)) ? 'like' : 'mid'));
    taste = ts.includes('hate') ? 'hate' : ts.every(x => x === 'like') ? 'like' : 'mid';
  } else if (r.kind === 'welcome' || r.kind === 'swap') {
    const lin = assistantMasmonLineage(r.monster);
    const bad = (p.dislikeMon || []).some(x => x.monster === r.monster || (x.lineage && x.lineage === lin) || (x.monster && lin && assistantMasmonLineage(x.monster) === lin));
    const good = (p.likeMon || []).some(x => x.monster === r.monster || (x.lineage && x.lineage === lin)) || (p.team || []).some(x => x.monster === r.monster);
    taste = bad ? 'hate' : good ? 'like' : 'mid';
  } else if (r.kind === 'train') { // 育成の相談: 「休ませて」はいつも受ける。鍛える能力は、自分の育成方針に合えば好き
    if (r.train === 'rest' || r.train === 'auto') taste = 'like';
    else { const row = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid).find(x => x.slot === r.slot0); taste = row && typeof AMG_POLICY !== 'undefined' && (AMG_POLICY[assistantMasmonGrowKind(row.grow)] || []).includes(r.train) ? 'like' : 'mid'; }
  } else if (r.kind === 'grow') { // 自分の編成でよく使う育て方は好き。それ以外はふつう(仲良し度 Lv2 から受ける)
    taste = (p.team || []).some(x => assistantMasmonGrowKind(x.grow) === r.grow) ? 'like' : 'mid';
  } else if (r.kind === 'hero') {
    const row = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid).find(x => x.slot === r.slot);
    taste = row && ((p.likeMon || []).some(x => x.monster === row.monster) || (p.team || []).some(x => x.monster === row.monster)) ? 'like' : 'mid';
  }
  if (taste === 'like') return 'yes';
  if (taste === 'hate') return lv >= 10 ? 'yes' : 'no';
  return lv >= 2 ? 'yes' : 'some'; // 2026-11-09 社長「そんなに厳しくしないで」: 好きでも苦手でもないものは、ほとんど受ける
};
// 当てる。{ changed, what, before, after } を返す(変えなかったら changed:false)
const assistantMasmonAskApply = (aid, r, outcome, t) => {
  const st = ASSISTANT_MASMON_STORE.state, day = assistantMasmonToday();
  const mine = { ...assistantMasmonMineOf(st, aid) }; mine.names = { ...mine.names }; mine.parts = { ...mine.parts };
  const withMine = (next) => ({ ...next, mine: { ...(next.mine || {}), [aid]: mine } });
  const monName = (m) => (assistantMasmonMon(m) || {}).name || m;
  if (outcome === 'no') return { changed: false, what: '' };
  if (r.kind === 'color' && t) {
    const p = assistantMasmonBasePlanOf(aid), H = ASSISTANT_MASMON_DYE_HABIT[aid] || ASSISTANT_MASMON_DYE_HABIT.mua;
    const before = [...assistantMasmonDyeNowOf(st, aid, t.slot, (assistantMasmonRowsOf(st, aid).find(x => x.slot === t.slot) || {}).colors || [])];
    const n = assistantMasmonRegions(t.monster) || 3; while (before.length < n) before.push(null);
    const want = (outcome === 'some' ? r.colors.slice(0, 1) : r.colors).map(x => ({ x, p: assistantMasmonPartRule(t.monster, x.part) })).filter(y => !y.p.keep);
    if (!want.length) return { changed: false, what: '' };
    const a = Math.round((H.alpha[0] + H.alpha[1]) / 2);
    const plan = want.map(({ x, p: pr }) => ({ p: pr, c: assistantMasmonBaseOf(x.color), tone: /_light$/.test(x.color) ? 'light' : 'base', a: Math.max(a, 60) }));
    const after = [...before];
    for (const y of assistantMasmonDyeLimit(plan, 'main')) after[y.p.i] = y.a >= 100 ? y.id : `${y.id}@${y.a}`;
    void p;
    const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(assistantMasmonBasePlanOf(aid)), roles: {}, slots: { [t.slot]: after } }];
    mine.parts[t.slot] = [...new Set([...(mine.parts[t.slot] || []), ...want.map(y => y.p.i)])];
    assistantMasmonSave(withMine({ ...st, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) } }));
    return { changed: true, what: want.map(y => `${y.p.name}を${assistantMasmonColorName(y.x.color)}`).join('・'), before, after, t };
  }
  if (r.kind === 'name' && t && outcome === 'yes' && assistantMasmonAskNameOk(r.name)) {
    const rows = assistantMasmonRowsOf(st, aid), row = rows.find(x => x.slot === t.slot);
    if (!row || row.nick === r.name || rows.some(x => x.nick === r.name)) return { changed: false, what: '' };
    mine.names[t.slot] = [...(mine.names[t.slot] || []), row.nick].slice(-8);
    const next = assistantMasmonSetNick(st, aid, t.slot, r.name);
    assistantMasmonSave(withMine(next));
    return { changed: true, what: `名前を「${r.name}」に` };
  }
  if (r.kind === 'train' && t && outcome === 'yes' && typeof amgAdvise === 'function') { // 育成の相談(育成基盤・公開の印 assistantMasmonGrow)
    if (!amgAdvise(aid, t.slot, r.train)) return { changed: false, what: '' };
    const label = (AMG_STATS.find(x => x[0] === r.train) || [])[1];
    return { changed: true, what: r.train === 'rest' ? '次の育成はお休みに' : r.train === 'auto' ? '育成をおまかせに' : `しばらく${label}を鍛える` };
  }
  if (r.kind === 'grow' && t && outcome === 'yes' && ASSISTANT_MASMON_GROW_KINDS.includes(r.grow)) {
    const row = assistantMasmonRowsOf(st, aid).find(x => x.slot === t.slot);
    if (!row || assistantMasmonGrowKind(row.grow) === r.grow) return { changed: false, what: '' };
    mine.grow = { ...(mine.grow || {}) };
    const prev = mine.grow[t.slot];
    const floor = assistantMasmonStats({ ...row, growMine: prev || null }) || {}; // いまのゲージ(前に提案で変えていれば、その下限も含む)を下限に残す
    mine.grow[t.slot] = { before: prev ? prev.before : row.grow, kind: r.grow, day, floor };
    assistantMasmonSave(withMine(assistantMasmonSetGrow(st, aid, t.slot, `${r.grow}(あなたの提案)`)));
    return { changed: true, what: `育て方を${r.grow}に`, before: assistantMasmonGrowKind(row.grow), after: r.grow };
  }
  if (r.kind === 'welcome') {
    if (assistantMasmonRowsOf(st, aid).some(x => x.monster === r.monster)) return { changed: false, what: '' };
    mine.wish = r.monster; mine.wishSoft = outcome === 'some';
    assistantMasmonSave(withMine(st));
    return { changed: true, what: `次に${monName(r.monster)}を迎えたい` };
  }
  if (r.kind === 'nameStyle' && outcome === 'yes') {
    // 名前のくせ: 一つずつ提案した名前(mine.names がある枠)はそのまま。前の名前は nameStyleBefore に残す(くせをやめたら戻す)
    const rows = assistantMasmonRowsOf(st, aid);
    let next = st, n = 0; mine.nameStyleBefore = { ...(mine.nameStyleBefore || {}) };
    for (const x of r.names) { const row = rows.find(y => y.slot === x.slot); if (!row || (mine.names[x.slot] || []).length || !assistantMasmonAskNameOk(x.n) || row.nick === x.n) continue; if (!mine.nameStyleBefore[x.slot]) mine.nameStyleBefore[x.slot] = row.nick; next = assistantMasmonSetNick(next, aid, x.slot, x.n); n++; }
    mine.nameStyle = { style: r.style, day };
    assistantMasmonSave(withMine(next));
    return { changed: true, what: `名前の付け方を「${r.style}」に${n ? `(${n}体)` : ''}` };
  }
  if (r.kind === 'nameStyleOff' && outcome === 'yes') {
    if (!mine.nameStyle) return { changed: false, what: '' };
    let next = st; const before = mine.nameStyleBefore || {};
    for (const [k, nick] of Object.entries(before)) { const sl = Number(k); if (!(mine.names[sl] || []).length && assistantMasmonRowsOf(st, aid).some(y => y.slot === sl)) next = assistantMasmonSetNick(next, aid, sl, nick); }
    mine.nameStyle = null; mine.nameStyleBefore = {};
    assistantMasmonSave(withMine(next));
    return { changed: true, what: '名前の付け方をいつもに戻す' };
  }
  if (r.kind === 'colorStyle' && outcome === 'yes') {
    // 色のくせ: 迎えたマスモン全部を、言われた色を好きな色の代わりにして染め直す。一つずつ選んだ部位(mine.parts)はそのまま。前の色は colorStyleBefore に残す
    const p = assistantMasmonBasePlanOf(aid), p2 = { ...p, favColors: r.palette.map(c => ({ color: c })) };
    const rows = assistantMasmonRowsOf(st, aid), slots = {};
    mine.colorStyleBefore = { ...(mine.colorStyleBefore || {}) };
    for (const row of rows) {
      const cur = [...assistantMasmonDyeNowOf(st, aid, row.slot, row.colors || [])];
      if (!mine.colorStyleBefore[row.slot]) mine.colorStyleBefore[row.slot] = cur;
      const rnd = assistantMasmonRng(`${st.seed}|${aid}|cstyle|${row.slot}|${r.palette.join()}|${day}`);
      const own = mine.parts[row.slot] || [];
      slots[row.slot] = assistantMasmonDyeMake2(aid, p2, row.monster, 'main', rnd).map((c, i) => (own.includes(i) ? (cur[i] || null) : c));
    }
    mine.colorStyle = { style: r.style, palette: r.palette, day };
    const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(p), roles: {}, slots }];
    assistantMasmonSave(withMine({ ...st, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) } }));
    return { changed: true, what: `色を「${r.style || r.palette.map(c => assistantMasmonColorName(c)).join('・')}」に(${rows.length}体)` };
  }
  if (r.kind === 'colorStyleOff' && outcome === 'yes') {
    if (!mine.colorStyle) return { changed: false, what: '' };
    const slots = {}; const rowsNow = assistantMasmonRowsOf(st, aid);
    for (const [k, cs] of Object.entries(mine.colorStyleBefore || {})) { const sl = Number(k), row = rowsNow.find(y => y.slot === sl); if (!row) continue; const cur = assistantMasmonDyeNowOf(st, aid, sl, row.colors || []), own = mine.parts[sl] || []; slots[sl] = cs.map((c, i) => (own.includes(i) ? (cur[i] || null) : c)); } // 一つずつ選んだ部位は今の色のまま
    mine.colorStyle = null; mine.colorStyleBefore = {};
    const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', undo: true, at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(assistantMasmonBasePlanOf(aid)), roles: {}, slots }];
    assistantMasmonSave(withMine({ ...st, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) } }));
    return { changed: true, what: '色をいつもの染め方に戻す' };
  }
  if (r.kind === 'swap' && t && outcome === 'yes') {
    // 入れ替え: 前のマスモンは mine.former に残す(名前・色・迎えた日)。新しいマスモンの名前は言われたもの、無ければ AI の名前付けに任せる。色は染め方 v2
    const rows = assistantMasmonRowsOf(st, aid), row = rows.find(x => x.slot === t.slot);
    if (!row || rows.some(x => x.monster === r.monster) || !assistantMasmonMon(r.monster)) return { changed: false, what: '' };
    const p = assistantMasmonBasePlanOf(aid);
    const colorsNow = assistantMasmonDyeNowOf(st, aid, t.slot, row.colors || []);
    mine.former = { ...(mine.former || {}) };
    mine.former[t.slot] = [...(mine.former[t.slot] || []), { monster: row.monster, nick: row.nick, lv: row.lv, grow: row.grow, why: row.why, role: row.role || '', welcome: row.welcome || t.slot * 2 - 1, colors: [...colorsNow], ai: !!row.ai, at: day }].slice(-8);
    delete mine.parts[t.slot]; delete mine.names[t.slot]; if (mine.grow) { mine.grow = { ...mine.grow }; delete mine.grow[t.slot]; }
    // 入れ替えた枠は、くせをやめたときの戻し先から外す(前のマスモンの名前・色が新しいマスモンに付かないように・ミハリ)
    mine.nameStyleBefore = { ...(mine.nameStyleBefore || {}) }; delete mine.nameStyleBefore[t.slot];
    mine.colorStyleBefore = { ...(mine.colorStyleBefore || {}) }; delete mine.colorStyleBefore[t.slot];
    const rnd = assistantMasmonRng(`${st.seed}|${aid}|swap|${t.slot}|${r.monster}|${day}`);
    const role = row.role && ASSISTANT_MASMON_ROLE_NAME[row.role] ? row.role : 'main';
    const nu = { slot: t.slot, monster: r.monster, nick: (r.name && assistantMasmonAskNameOk(r.name) ? r.name : '') || monName(r.monster), lv: row.lv, grow: row.grow, why: 'あなたの提案で迎えた', role, welcome: row.welcome || t.slot * 2 - 1, colors: assistantMasmonDyeMake2(aid, p, r.monster, role, rnd), ai: !!(r.name && assistantMasmonAskNameOk(r.name)), reason: 'ask', at: day };
    const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(p), roles: {}, slots: { [t.slot]: nu.colors } }];
    assistantMasmonSave(withMine({ ...st, pick: { ...(st.pick || {}), [aid]: { ...((st.pick && st.pick[aid]) || {}), [t.slot]: nu } }, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) } }));
    if (!r.name) void assistantMasmonAskNames();
    try { if (typeof amgTick === 'function') void amgTick(aid); } catch (_) {} // 入れ替えた子の育成(6能力)もその場で作る
    return { changed: true, what: `${row.nick}を${monName(r.monster)}に入れ替え` };
  }
  if (r.kind === 'hero' && outcome === 'yes') {
    const row = assistantMasmonRowsOf(st, aid).find(x => x.slot === r.slot);
    if (!row) return { changed: false, what: '' };
    mine.hero = r.slot === 1 ? 0 : r.slot;
    assistantMasmonSave(withMine(st));
    return { changed: true, what: `勇者モンを${row.nick}に` };
  }
  if (r.kind === 'deck') {
    mine.deck = { face: r.face, name: outcome === 'some' ? '' : r.deckName, plan: r.plan, day };
    if (!mine.deck.name && !mine.deck.plan) return { changed: false, what: '' };
    assistantMasmonSave(withMine(st));
    return { changed: true, what: `${ASSISTANT_MASMON_DECK_FACE[r.face]}を${[mine.deck.plan && ASSISTANT_MASMON_DECK_PLAN[mine.deck.plan], mine.deck.name && `「${mine.deck.name}」`].filter(Boolean).join('の')}に` };
  }
  return { changed: false, what: '' };
};
// 名前を書きかえる(迎えた枠は pick、そうでなければ draw の行)
const assistantMasmonSetGrow = (st, aid, slot, grow) => {
  const pk = st.pick && st.pick[aid] && st.pick[aid][slot];
  if (pk) return { ...st, pick: { ...st.pick, [aid]: { ...st.pick[aid], [slot]: { ...pk, grow } } } };
  const made = (st.draw.made[aid] || []).map(x => (x.slot === slot ? { ...x, grow } : x));
  return { ...st, draw: { ...st.draw, made: { ...st.draw.made, [aid]: made } } };
};
const assistantMasmonUndoGrow = (aid, slot) => {
  const st = ASSISTANT_MASMON_STORE.state, m = { ...assistantMasmonMineOf(st, aid) }; m.grow = { ...(m.grow || {}) };
  const g = m.grow[slot]; if (!g) return false;
  delete m.grow[slot];
  assistantMasmonSave({ ...assistantMasmonSetGrow(st, aid, slot, g.before), mine: { ...(st.mine || {}), [aid]: m } });
  return true;
};
const assistantMasmonSetNick = (st, aid, slot, nick) => {
  const pk = st.pick && st.pick[aid] && st.pick[aid][slot];
  if (pk) return { ...st, pick: { ...st.pick, [aid]: { ...st.pick[aid], [slot]: { ...pk, nick, ai: true } } } };
  const made = (st.draw.made[aid] || []).map(x => (x.slot === slot ? { ...x, nick, ai: true } : x));
  return { ...st, draw: { ...st.draw, made: { ...st.draw.made, [aid]: made } } };
};
// 提案を送る → { res: 'yes'|'some'|'no'|'none'|'fail'|'limit', line(助手の返事), note(ゲームの1行), what, before, after, t }
let _assistantMasmonAskBusy = false;
const assistantMasmonAsk = async (aid, from, text, t = null) => {
  const body = String(text || '').replace(/[\n\r]/g, ' ').trim().slice(0, 100);
  if (!body || _assistantMasmonAskBusy) return null;
  if (assistantMasmonAskUsed(aid) >= ASSISTANT_MASMON_ASK_PER_DAY) return { res: 'limit', note: `今日は${ASSISTANT_MASMON_ASK_PER_DAY}回受けてもらいました。また明日、提案してみてください` };
  const lv = Number.isFinite(_assistantMasmonBondNow[aid]) ? _assistantMasmonBondNow[aid] : 1;
  const record = (res, what = '', counted = false, reply = '') => { const c = ASSISTANT_MASMON_STORE.state; assistantMasmonSave({ ...c, asked: [...(c.asked || []), { day: assistantMasmonToday(), a: aid, from, text: body, res, what, reply: String(reply || '').slice(0, 80), counted }].slice(-60) }); };
  // 直前のやりとり(その助手への提案の新しい4回・古い順)。続きの言葉が通じるように渡す(2026-11-09 社長「なかなか会話が伝わらない」)
  const history = (ASSISTANT_MASMON_STORE.state.asked || []).filter(x => x.a === aid && x.text && x.res !== 'fail').slice(-4).map(x => ({ text: x.text, reply: x.reply || '' }));
  let bid = null; try { bid = typeof ensureBreederId === 'function' ? await ensureBreederId() : null; } catch (_) { bid = null; }
  if (!bid || !assistantMasmonAskOn()) { record('fail'); return { res: 'fail', note: 'いまは返事ができませんでした。少し時間をおいて試してみてください' }; }
  _assistantMasmonAskBusy = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res = null;
    try { const r = await fetch(ASSISTANT_CHAT_URL, { method: 'POST', headers: SB_HEADERS, signal: controller.signal, body: JSON.stringify({ kind: 'masmon_suggest', breederId: bid, a: aid, from, text: body, history, ctx: { ...assistantMasmonAskCtx(aid, from, t, lv), ...(t && typeof amgOn === 'function' && amgOn() ? { train: true } : {}) } }) }); res = r.ok ? await r.json() : null; } finally { clearTimeout(timer); }
    if (!res || res.ok !== true || !res.result) { record('fail'); return { res: 'fail', note: res && res.kind === 'tired' ? '今日はもう返事ができないみたいです。また明日、提案してみてください' : 'いまは返事ができませんでした。少し時間をおいて試してみてください' }; }
    const r = res.result;
    // 開いた所と違うものは当てない(例: 勇者モンの所から色を言われた)。くわしい画面からは名前と色だけ
    // どこから開いても、言われたことに合わせて受ける(2026-11-09 社長「とにかくもっと自由度」)。そのマスモンが要るもの(名前・色・入れ替え)だけ、マスモンが分かるときに限る
    const fits = ['welcome', 'hero', 'deck', 'nameStyle', 'nameStyleOff', 'colorStyle', 'colorStyleOff', ...(t ? ['name', 'color', 'grow', 'swap'] : []), ...(t && typeof amgOn === 'function' && amgOn() ? ['train'] : [])];
    // 変えることが読み取れない・ここでは変えられないものでも、エラーにせず助手がふつうに返事をする(何も変えない・回数は減らない)
    // 名前として通さない言葉だった(2026-11-09 社長「全然聞いてくれない」): 「分からない」にせず、その助手の口調で付けられないと言う(回数は減らない)
    if (r.kind === 'none' && r.blocked === 'name') { const ng = assistantMasmonAskLine(aid, r.replies, 'ng'); record('no', '', false, ng); return { res: 'no', line: ng, note: 'その言葉は名前に使えません。ほかの名前なら提案できます(回数は減りません)' }; }
    if (r.kind === 'none' || !fits.includes(r.kind)) { const talk = assistantMasmonAskLine(aid, r.replies, 'talk'); record('none', '', false, talk); return { res: 'none', line: talk, note: '' }; }
    const outcome = assistantMasmonAskJudge(aid, t ? { ...r, slot0: t.slot } : r, lv);
    const done = assistantMasmonAskApply(aid, r, outcome, t);
    const res2 = outcome === 'no' ? 'no' : done.changed ? outcome : 'some';
    const line = assistantMasmonAskLine(aid, r.replies, outcome === 'no' ? 'no' : done.changed ? (outcome === 'yes' ? 'yes' : 'some') : 'think');
    record(res2, done.what || '', done.changed, line);
    return { res: res2, line, what: done.what, before: done.before, after: done.after, t: done.t, note: done.changed ? '' : (outcome === 'no' ? '断られても、今日の回数は減りません' : '今回は考えておく、とのことでした(回数は減りません)') };
  } catch (_) { record('fail'); return { res: 'fail', note: 'いまは返事ができませんでした。少し時間をおいて試してみてください' }; } finally { _assistantMasmonAskBusy = false; }
};
// 前に戻してもらう(AI は使わない・回数は減らない)
const assistantMasmonUndoColor = (aid, slot) => {
  const log = assistantMasmonDyeLog(aid, slot)[0];
  if (!log || log.why !== 'ask' || log.undo) return false;
  const st = ASSISTANT_MASMON_STORE.state, day = assistantMasmonToday();
  const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', undo: true, at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(assistantMasmonBasePlanOf(aid)), roles: {}, slots: { [slot]: [...log.before] } }];
  const m = { ...assistantMasmonMineOf(st, aid) }; m.parts = { ...m.parts };
  const back = assistantMasmonDyeLog(aid, slot); if (!back.slice(1).some(e => e.why === 'ask' && !e.undo)) delete m.parts[slot]; // ひとつ前もプレイヤーの色でなければ、季節の色を差してよい部位に戻す
  assistantMasmonSave({ ...st, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) }, mine: { ...(st.mine || {}), [aid]: m } });
  return true;
};
const assistantMasmonUndoName = (aid, slot) => {
  const st = ASSISTANT_MASMON_STORE.state, m = { ...assistantMasmonMineOf(st, aid) }; m.names = { ...m.names };
  const prev = [...(m.names[slot] || [])]; const nick = prev.pop();
  if (!nick) return false;
  m.names[slot] = prev;
  assistantMasmonSave({ ...assistantMasmonSetNick(st, aid, slot, nick), mine: { ...(st.mine || {}), [aid]: m } });
  return true;
};
const assistantMasmonUndoSwap = (aid, slot) => {
  const st = ASSISTANT_MASMON_STORE.state, m = { ...assistantMasmonMineOf(st, aid) };
  m.former = { ...(m.former || {}) };
  const list = [...(m.former[slot] || [])]; const prev = list.pop();
  if (!prev) return false;
  m.former[slot] = list; m.parts = { ...m.parts }; delete m.parts[slot]; m.names = { ...m.names }; delete m.names[slot]; if (m.grow) { m.grow = { ...m.grow }; delete m.grow[slot]; }
  m.nameStyleBefore = { ...(m.nameStyleBefore || {}) }; delete m.nameStyleBefore[slot]; m.colorStyleBefore = { ...(m.colorStyleBefore || {}) }; delete m.colorStyleBefore[slot];
  const day = assistantMasmonToday();
  const back = { slot, monster: prev.monster, nick: prev.nick, lv: prev.lv, grow: prev.grow, why: prev.why, role: prev.role, welcome: prev.welcome, colors: [...prev.colors], ai: prev.ai, reason: 'ask', at: day };
  const hist = [...((st.dyes && st.dyes[aid]) || []), { v: ASSISTANT_MASMON_DYE_V, d: ASSISTANT_MASMON_DRAW_V, why: 'ask', undo: true, at: day, season: assistantMasmonSeasonKey(day), fav: assistantMasmonFavSig(assistantMasmonBasePlanOf(aid)), roles: {}, slots: { [slot]: [...prev.colors] } }];
  assistantMasmonSave({ ...st, pick: { ...(st.pick || {}), [aid]: { ...((st.pick && st.pick[aid]) || {}), [slot]: back } }, dyes: { ...(st.dyes || {}), [aid]: hist.slice(-40) }, mine: { ...(st.mine || {}), [aid]: m } });
  return true;
};
const assistantMasmonUndoMine = (aid, key) => {
  const st = ASSISTANT_MASMON_STORE.state, m = { ...assistantMasmonMineOf(st, aid) };
  if (key === 'hero') m.hero = 0; else if (key === 'wish') { m.wish = ''; m.wishSoft = false; } else if (key === 'deck') m.deck = null; else return false;
  assistantMasmonSave({ ...st, mine: { ...(st.mine || {}), [aid]: m } });
  return true;
};
// カード部(推し・好き・素顔のデッキ)が読む口: プレイヤーがデッキに提案して受けてもらった希望 { face, name, plan, day } か null。読むだけ
const assistantLifeDeckWish = (id) => { try { const d = assistantMasmonMineOf(ASSISTANT_MASMON_STORE.state, id).deck; return d ? { ...d } : null; } catch (_) { return null; } };
// フレンドの家の控えに写す口(オトズレ3): その人のマスモン [{ monster, nick, colors, lead }](先頭が先・編成3体+迎えた控え)
const assistantLifeMasmonTeamOf = (id) => {
  try {
    const p = assistantMasmonPlanOf(id);
    if (!p) return [];
    return [...assistantMasmonTeam(p), ...assistantMasmonBench(p)].map(t => ({ monster: t.monster, nick: t.nick, colors: [...((t.dye && t.dye.colors) || [])], lead: !!t.lead }));
  } catch (_) { return []; }
};
// フレンドに見せる形(オトズレのフレンドの家・2026-11-12)。読むだけ・何も保存しない。迎えた子だけを送り、まだの枠は数だけ
// stats は育成の6能力(印が偽・まだ無いときは null)。思い出・今日の記録・疲れ・ストレスは送らない
const assistantLifeMasmonShareOf = (id) => {
  try {
    const p = assistantMasmonPlanOf(id);
    if (!p) return { list: [], waiting: 0 };
    const growOn = typeof amgOn === 'function' && amgOn() && typeof amgEntryOf === 'function';
    const statsOf = (t) => {
      if (!growOn) return null;
      const e = amgEntryOf(id, t);
      if (!e || !e.st) return null;
      const o = {};
      for (const k of ['life', 'pow', 'wise', 'hit', 'eva', 'tough']) { const v = Number(e.st[k]); if (!Number.isFinite(v)) return null; o[k] = Math.round(v); }
      return o;
    };
    const list = [...assistantMasmonTeam(p), ...assistantMasmonBench(p)].map(t => ({
      monster: t.monster, nick: t.nick, colors: [...((t.dye && t.dye.colors) || [])], lead: !!t.lead,
      slot: Number.isInteger(t.slot) ? t.slot : 0, lv: Number.isFinite(Number(t.lv)) ? Number(t.lv) : 1,
      grow: typeof assistantMasmonGrowKind === 'function' ? assistantMasmonGrowKind(t.grow) : String(t.grow || ''),
      growMine: t.growMine && typeof t.growMine.kind === 'string' ? t.growMine.kind : '',
      stats: statsOf(t), why: typeof t.why === 'string' ? t.why : '',
    }));
    const waiting = Array.isArray(p.extra) ? p.extra.filter(t => t && t.unknown).length : 0;
    return { list, waiting };
  } catch (_) { return { list: [], waiting: 0 }; }
};
const useAssistantMasmonSave = () => {
  const [st, setSt] = React.useState(ASSISTANT_MASMON_STORE.state);
  React.useEffect(() => { ASSISTANT_MASMON_STORE.subs.add(setSt); void ASSISTANT_MASMON_STORE.load(); return () => { ASSISTANT_MASMON_STORE.subs.delete(setSt); }; }, []);
  return st;
};
const assistantMasmonDrawOn = (aid, st = ASSISTANT_MASMON_STORE.state) => !!(st && st.draw && st.draw.v === ASSISTANT_MASMON_DRAW_V && Array.isArray(st.draw.made[aid]));
// 迎えたマスモンの行(slot の順): 勇者モン・draw で迎えた枠・pick で選んだ枠
const assistantMasmonRowsOf = (st, aid) => {
  const d = st && st.draw && st.draw.v === ASSISTANT_MASMON_DRAW_V && Array.isArray(st.draw.made[aid]) ? st.draw.made[aid] : [];
  const w = (st && st.draw && st.draw.welcomed[aid]) || {}, pk = (st && st.pick && st.pick[aid]) || {};
  const out = [];
  for (const t of d) { if (pk[t.slot]) out.push(pk[t.slot]); else if (t.slot === 1 || w[t.monster]) out.push(t); }
  return out;
};
const assistantMasmonWelcomed = (aid, st = ASSISTANT_MASMON_STORE.state) => (assistantMasmonDrawOn(aid, st) ? st.draw.welcomed[aid] : st && st.welcomed && st.welcomed[aid]) || {};
// 迎えたぶんだけの控え(2026-11-08 社長の選び B: 5体まで・仲良し度が上がると迎える)
const assistantMasmonBench = (p, st = ASSISTANT_MASMON_STORE.state) => (p && Array.isArray(p.extra) ? p.extra.filter(t => assistantMasmonMonOk(t) && assistantMasmonWelcomed(p.id, st)[t.monster]).map(t => ({ ...t, bench: true })) : []);
// まだ迎えていない・仲良し度が届いた最初の1体
const assistantMasmonToWelcome = (p, bondLv, st = ASSISTANT_MASMON_STORE.state) => {
  if (!p || !Array.isArray(p.extra) || !Number.isFinite(bondLv)) return null;
  const done = assistantMasmonWelcomed(p.id, st);
  return p.extra.find(t => assistantMasmonMonOk(t) && !done[t.monster] && Number.isFinite(t.welcome) && bondLv >= t.welcome) || null;
};
const assistantMasmonWelcome = async (aid, t, quiet = false) => {
  await ASSISTANT_MASMON_STORE.load();
  const cur = ASSISTANT_MASMON_STORE.state;
  if (assistantMasmonWelcomed(aid, cur)[t.monster]) return false; // 二度は迎えない
  const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : new Date().toISOString().slice(0, 10);
  const w2 = { ...assistantMasmonWelcomed(aid, cur), [t.monster]: day };
  const next = assistantMasmonDrawOn(aid, cur) ? { ...cur, draw: { ...cur.draw, welcomed: { ...cur.draw.welcomed, [aid]: w2 } } } : { ...cur, welcomed: { ...cur.welcomed, [aid]: w2 } };
  ASSISTANT_MASMON_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
  if (!quiet) try { if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${assistantLifeName(aid)}が新しいマスモン「${t.nick}」を迎えた`, [aid]); } catch (_) {}
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
  sorashido: '{name}、新しい仲間が来ましたよー！ {mon}の「{nick}」、表にも足しておきますね笑',
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
  sorashido: '{name}、マスモンたちに新しい名前を付けました・・・！ 見てください笑',
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
// 種族(血統)の行に出す代表の絵(2026-11-11 社長「ゴースト種の所に絵が無い」): 血統の代表(monId)。いなければその血統が主のいちばん初めのモンスター。どちらも無ければ null(🧬のまま)
const assistantMasmonLineageRep = (lin) => {
  try {
    if (!lin || typeof ALL_PLAYER_MONSTERS === 'undefined') return null;
    const id = typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[lin] ? MONSTER_LINEAGES[lin].monId : '';
    if (id && ALL_PLAYER_MONSTERS[id]) return ALL_PLAYER_MONSTERS[id];
    const k = Object.keys(ALL_PLAYER_MONSTERS).find(m => assistantMasmonLineage(m) === lin);
    return k ? ALL_PLAYER_MONSTERS[k] : null;
  } catch (_) { return null; }
};
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
    const fl = t.growMine && t.growMine.floor && t.growMine.floor[k]; if (Number.isFinite(fl)) out[k] = Math.max(out[k], fl); // 育て方を変えても、それまでに伸びた分は下げない
  }
  return out;
};
const assistantMasmonSwatch = (c) => (typeof MASU_COLOR_SWATCH !== 'undefined' && MASU_COLOR_SWATCH[c]) || (typeof getColorSwatchHex === 'function' && /^custom:/.test(String(c)) ? getColorSwatchHex(c) : '#94a3b8');
const assistantMasmonColorName = (c) => assistantMasmonToneName(c);
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
const assistantMasmonWaiting = (p, st = ASSISTANT_MASMON_STORE.state) => (p && Array.isArray(p.extra) ? p.extra.filter(t => t.unknown || (assistantMasmonMonOk(t) && !assistantMasmonWelcomed(p.id, st)[t.monster])) : []);
function AssistantMasmonWaitCard({ t, land = false, small = false }) {
  const m = t.unknown ? null : assistantMasmonMon(t.monster);
  if (!m && !t.unknown) return null;
  const size = small ? (land ? 60 : 84) : 78;
  // まだの枠: だれが来るかは迎えるときに決まるので、影ではなく「？」だけ
  const pic = m
    ? <div className="mhm-pic" style={{ width: size, height: size }}><img src={m.imgUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) opacity(.55)' }}/></div>
    : <div className="mhm-pic grid place-items-center" style={{ width: size, height: size }} data-assistant-masmon-unknown><span className="font-black text-slate-500" style={{ fontSize: Math.round(size * 0.5) }}>？</span></div>;
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
        <p className="text-[11px] font-bold leading-snug text-sky-200" style={{ wordBreak: 'auto-phrase' }}>🔒 仲良し度 Lv{t.welcome} になると、新しいマスモンを迎えます{t.unknown ? '(だれが来るかは、そのときの様子で決まります)' : ''}</p>
      </div>
    </div>);
}

// 編成タブ(引き直しのあと・2026-11-08 社長 Q4A): モンヒロバトルと同じ考え方。8体の編成から勇者モンを1体連れて行き、道中で3体を仲間にして4体で戦う
//   勇者モン(1体目)と、その理由のひとこと/編成の8枠(まだの枠は影と🔒・迎える仲良し度)/道中で仲間にしやすい3体(勇者モン以外で Lv の高い順)
const assistantMasmonAllies = (team) => [...team].filter(t => !t.lead).sort((a, b) => (b.lv - a.lv) || (a.slot - b.slot)).slice(0, 3);
function AssistantMasmonFormation({ who, team, waiting, land = false, onOpen, onAsk = null }) {
  const st0 = useAssistantMasmonSave();
  const heroMine = assistantMasmonMineOf(st0, who.id).hero;
  const lead = team.find(t => t.lead) || team[0];
  const allies = assistantMasmonAllies(team);
  const slots = [...team.map(t => ({ t, ok: true })), ...waiting.map(t => ({ t, ok: false }))].sort((a, b) => (a.t.slot || 0) - (b.t.slot || 0)).slice(0, ASSISTANT_MASMON_DRAW_MAX);
  const cell = land ? 52 : 68;
  const heroCard = lead && (
    <button type="button" className="mhm-card flex w-full items-center gap-2.5 text-left" data-assistant-masmon-hero={lead.monster} onClick={() => onOpen(lead)}>
      <div className="mhm-stage shrink-0"><AssistantMasmonPic t={lead} size={land ? 84 : 112}/></div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-amber-300">⚔ 勇者モン</p>
        <p className="truncate text-[16px] font-black text-white">{lead.nick}</p>
        <p className="truncate text-[10.5px] font-bold text-amber-200">Lv.{lead.lv} ・ {assistantMasmonGrowKind(lead.grow)}</p>
        <p className="mt-1 text-[11px] font-bold leading-snug text-slate-100" style={{ wordBreak: 'auto-phrase' }} data-assistant-masmon-hero-why>💬 {who.name}「勇者モンは{lead.nick}。{lead.why}」</p>
      </div>
    </button>);
  const allyCard = (
    <div className="mhm-card" data-assistant-masmon-allies>
      <p className="text-[10px] font-black text-slate-400">道中で仲間にしやすい3体</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map(i => { const t = allies[i]; return t
          ? <button key={t.monster} type="button" className="text-center" data-assistant-masmon-ally={t.monster} onClick={() => onOpen(t)}><div className="mhm-stage"><AssistantMasmonPic t={t} size={land ? cell : 84}/></div><p className="mt-0.5 truncate text-[10.5px] font-black text-white">{t.nick}</p><p className="truncate text-[9px] font-bold text-amber-200">Lv.{t.lv}</p></button>
          : <div key={`e${i}`} className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/20 text-[9.5px] font-bold text-slate-500" style={{ minHeight: cell + 30 }}>まだ</div>; })}
      </div>
    </div>);
  const formCard = (
    <div className="mhm-card" data-assistant-masmon-formation>
      <p className="flex items-baseline justify-between text-[10px] font-black text-slate-400"><span>編成</span><span className="text-amber-200">{team.length}/{ASSISTANT_MASMON_DRAW_MAX}</span></p>
      <div className="mt-1 grid grid-cols-4 gap-1.5">
        {slots.map(({ t, ok }) => ok
          ? <button key={t.monster} type="button" className="relative text-center" data-assistant-masmon-team={t.monster} onClick={() => onOpen(t)}>
              {t.lead && <em className="mhm-lead absolute left-0 top-0 z-[1]" style={{ fontSize: 8.5 }}>勇者</em>}
              <div className="mhm-stage"><AssistantMasmonPic t={t} size={cell}/></div>
              <p className="mt-0.5 truncate text-[10px] font-black text-white">{t.nick}</p>
            </button>
          : (() => { const m = t.unknown ? null : assistantMasmonMon(t.monster); return (
            <div key={t.monster} className="text-center" data-assistant-masmon-wait={t.monster}>
              <div className="mhm-stage"><div className="mhm-pic grid place-items-center" style={{ width: cell, height: cell }}>{m ? <img src={m.imgUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) opacity(.55)' }}/> : <span className="font-black text-slate-500" style={{ fontSize: Math.round(cell * 0.5) }} data-assistant-masmon-unknown>？</span>}</div></div>
              <p className="mt-0.5 truncate text-[9.5px] font-bold text-sky-200">🔒 Lv{t.welcome}</p>
            </div>); })())}
      </div>
    </div>);
  return (<>
    <div className={`grid gap-2 ${land ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <div className="flex flex-col gap-2">{heroCard}
        {onAsk && assistantMasmonAskOn() && <div className="flex flex-wrap items-center gap-2" data-assistant-masmon-hero-ask>
          <button type="button" className="mhl-btn px-3 text-[11.5px]" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)' }} onClick={() => onAsk('hero')} data-assistant-masmon-ask-open="hero">💡 勇者モンについて提案する</button>
          {heroMine > 0 && <button type="button" className="mhl-btn bg-slate-700 px-3 text-[11px]" onClick={() => assistantMasmonUndoMine(who.id, 'hero')} data-assistant-masmon-undo="hero">いつもの勇者モンに戻してもらう</button>}
        </div>}
        {allyCard}</div>
      {formCard}
    </div>
    <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400" style={{ wordBreak: 'auto-phrase' }}>⚔ モンヒロバトルと同じく、8体の編成から勇者モンを1体連れて行き、道中で3体を仲間にして4体で戦います。編成は{who.name}が決めています。仲良し度が Lv2 上がるごとに、新しいマスモンを迎えます。</p>
  </>);
}

// デッキのタブの下: 「デッキに提案する」と、受けてもらった希望(カード部の口 assistantLifeDeckWish が読む)
function AssistantMasmonDeckAsk({ who, onAsk }) {
  const st = useAssistantMasmonSave();
  if (!assistantMasmonAskOn()) return null;
  const d = assistantMasmonMineOf(st, who.id).deck;
  return (
    <div className="mhm-card mt-2" data-assistant-masmon-deck-ask>
      <button type="button" className="mhl-btn px-3 text-[11.5px]" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)' }} onClick={onAsk} data-assistant-masmon-ask-open="deck">💡 デッキに提案する</button>
      {d && <p className="mt-1 text-[10.5px] font-bold text-sky-200">あなたの提案: {ASSISTANT_MASMON_DECK_FACE[d.face]}{d.plan ? `・${ASSISTANT_MASMON_DECK_PLAN[d.plan]}` : ''}{d.name ? `・「${d.name}」` : ''}(次に組み直すときに使います) <button type="button" className="ml-1 underline" onClick={() => assistantMasmonUndoMine(who.id, 'deck')} data-assistant-masmon-undo="deck">取り消す</button></p>}
    </div>);
}
// 提案のシート(自由に書いて送る → 助手の返事・変わった所)。印 assistantMasmonSuggest が偽のときは開くボタン自体を出さない
// initialText: 文をあらかじめ入れて開く(対戦の振り返りの「💡 ◯◯を鍛えてと提案する」から・ミセカタ 11-11)。送るのはプレイヤーが押したとき
function AssistantMasmonAskSheet({ who, from, t = null, land = false, onClose, initialText = '' }) {
  const [text, setText] = React.useState(typeof initialText === 'string' ? initialText.slice(0, 100) : '');
  const [busy, setBusy] = React.useState(false);
  const [out, setOut] = React.useState(null);
  useAssistantMasmonSave();
  const left = Math.max(0, ASSISTANT_MASMON_ASK_PER_DAY - assistantMasmonAskUsed(who.id));
  const send = async () => { if (busy || !text.trim()) return; setBusy(true); try { const r = await assistantMasmonAsk(who.id, from, text, t); setOut(r); if (r && (r.res === 'yes' || r.res === 'some')) setText(''); } finally { setBusy(false); } };
  const title = from === 'masmon' && t ? `${t.nick}について` : from === 'hero' ? '勇者モンについて' : from === 'welcome' ? '次に迎えるマスモンについて' : 'デッキについて';
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ zIndex: 36 }} data-assistant-masmon-ask={from}>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/75" onClick={onClose}/>
      <div className={`mhm-card relative mx-3 ${land ? 'w-[min(94%,640px)]' : 'w-[min(94%,420px)]'}`} style={{ background: 'linear-gradient(180deg,#2a1d55,#0b1020)', borderColor: '#f9a8d4', maxHeight: '92%', overflowY: 'auto' }}>
        <p className="mhl-en">SUGGEST</p>
        <p className="text-[16px] font-black text-amber-200">💡 {who.name}に提案する</p>
        <p className="text-[11px] font-bold text-slate-300">{title}</p>
        <p className="mt-1.5 text-[10.5px] font-bold leading-snug text-slate-400" style={{ wordBreak: 'auto-phrase' }}>{ASSISTANT_MASMON_ASK_HINT[from]}</p>
        <textarea className="mt-1.5 w-full rounded-xl border border-white/20 bg-slate-950/70 p-2 text-[13px] font-bold text-white" rows={land ? 2 : 3} maxLength={100} value={text} onChange={e => setText(e.target.value)} placeholder="ここに書く(100字まで)" data-assistant-masmon-ask-text/>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-bold text-sky-200" data-assistant-masmon-ask-left>今日あと {left}回 受けてもらえます</p>
          <button type="button" className="mhl-btn shrink-0 px-4" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)', opacity: busy || !text.trim() || !left ? 0.5 : 1 }} disabled={busy || !text.trim() || !left} onClick={send} data-assistant-masmon-ask-send>{busy ? '考え中…' : '伝える'}</button>
        </div>
        {out && (
          <div className="mt-2" data-assistant-masmon-ask-result={out.res}>
            {out.line && <div className="flex items-start gap-2 text-left">
              {typeof AssistantFace === 'function' && <span className="shrink-0"><AssistantFace who={who} size={38} accent={who.accent}/></span>}
              <p className="rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-bold leading-snug text-slate-800" style={{ wordBreak: 'auto-phrase' }} data-assistant-masmon-ask-line>{out.line}</p>
            </div>}
            {out.what && <p className="mt-1 text-[11px] font-black text-amber-200" data-assistant-masmon-ask-what>✅ {out.what}</p>}
            {out.before && out.t && <div className="mt-1 flex items-center justify-center gap-2">
              <div className="mhm-stage"><AssistantMasmonPic t={{ ...out.t, dye: { colors: out.before } }} size={land ? 70 : 84}/></div><span className="text-[18px] text-slate-300">→</span><div className="mhm-stage"><AssistantMasmonPic t={{ ...out.t, dye: { colors: out.after } }} size={land ? 70 : 84}/></div>
            </div>}
            {out.note && <p className="mt-1 text-[10.5px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'auto-phrase' }}>{out.note}</p>}
          </div>)}
        <button type="button" className="mhl-btn mt-2 w-full bg-slate-700" data-mhl-sheet-close onClick={onClose}>閉じる</button>
      </div>
    </div>);
}
// いまの全体のくせ(名前・色)と「やめてもらう」(AI は使わない・回数は減らない)
function AssistantMasmonStyleRow({ who }) {
  const st = useAssistantMasmonSave();
  if (!assistantMasmonAskOn()) return null;
  const m = assistantMasmonMineOf(st, who.id);
  if (!m.nameStyle && !m.colorStyle) return null;
  const off = (kind) => { assistantMasmonAskApply(who.id, { kind }, 'yes', null); };
  return (
    <div className="mhm-card mt-2 flex flex-col gap-1" data-assistant-masmon-style>
      {m.nameStyle && <p className="text-[10.5px] font-bold text-sky-200">✏️ 名前の付け方のくせ: 「{m.nameStyle.style}」 <button type="button" className="ml-1 underline" onClick={() => off('nameStyleOff')} data-assistant-masmon-undo="nameStyle">やめてもらう</button></p>}
      {m.colorStyle && <p className="text-[10.5px] font-bold text-sky-200">🎨 色のくせ: 「{m.colorStyle.style || m.colorStyle.palette.map(c => assistantMasmonColorName(c)).join('・')}」 <button type="button" className="ml-1 underline" onClick={() => off('colorStyleOff')} data-assistant-masmon-undo="colorStyle">やめてもらう</button></p>}
    </div>);
}
// 「次に迎えてほしい」の1行(まだの枠があるときだけ)
function AssistantMasmonWishRow({ who, onAsk }) {
  const st = useAssistantMasmonSave();
  if (!assistantMasmonAskOn()) return null;
  const wish = assistantMasmonMineOf(st, who.id).wish;
  return (
    <div className="mhm-card mt-2 flex flex-wrap items-center gap-2" data-assistant-masmon-wish>
      <button type="button" className="mhl-btn px-3 text-[11.5px]" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)' }} onClick={() => onAsk('welcome')} data-assistant-masmon-ask-open="welcome">💡 次に迎えてほしいマスモンを伝える</button>
      {wish && <p className="text-[10.5px] font-bold text-sky-200">希望: {(assistantMasmonMon(wish) || {}).name || wish} <button type="button" className="ml-1 underline" onClick={() => assistantMasmonUndoMine(who.id, 'wish')} data-assistant-masmon-undo="wish">取り消す</button></p>}
    </div>);
}

const ASSISTANT_MASMON_TABS = Object.freeze([['mons', '🐾 マスモン'], ['team', '⚔ 編成'], ['deck', '🃏 デッキ'], ['taste', '💗 好み']]);

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

function AssistantMasmonRow({ t, land = false, onOpen = null, aid = '', amg = null }) {
  const ge = aid && typeof amgOn === 'function' && amgOn() ? amgEntryOf(aid, t, amg || AMG_STORE.state) : null; // 育成基盤: 6能力の小さいゲージ
  const m = assistantMasmonMon(t.monster);
  const st = assistantMasmonStats(t);
  if (!m || !st) return null;
  return (
    <button type="button" className="mhm-card flex w-full gap-2.5 text-left" data-assistant-masmon-row={t.monster} onClick={() => onOpen && onOpen(t)}>
      <AssistantMasmonPic t={t} size={78}/>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-black leading-tight text-white"><span className="break-all">{t.nick}</span>{t.lead && <em className="mhm-lead">勇者モン</em>}{t.bench && <em className="mhm-lead mhm-bench">控え</em>}</p>
        {land
          ? <><p className="flex flex-wrap gap-x-1 text-[10.5px] font-bold leading-tight text-slate-300"><span className="break-all">{m.name}</span><span className="whitespace-nowrap">・ Lv.{t.lv}</span></p><p className="text-[10px]"><AssistantMasmonDots t={t}/></p></>
          : <p className="truncate text-[10.5px] font-bold text-slate-300">{m.name} ・ Lv.{t.lv} <AssistantMasmonDots t={t}/></p>}
        <p className="text-[11px] font-black leading-tight text-amber-200">📈 {t.grow}</p>
        {ge ? <div className="mt-0.5"><AmgStatBars e={ge} small cols={land ? 1 : 2}/></div> : (
        <div className={`mt-0.5 grid gap-x-3 gap-y-0.5 ${land ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-300"><span className="w-[34px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(st[k] * 100)}%` }}/></span></div>))}
        </div>)}
      </div>
    </button>);
}

function AssistantMasmonSheet({ id, land = false, onClose, bondLv = null }) {
  const amgSt = typeof useAmgState === 'function' ? useAmgState() : null; // 育成基盤(公開の印 assistantMasmonGrow)
  React.useEffect(() => { if (typeof amgTick === 'function') void amgTick(id); }, [id]);
  const [tab, setTab] = React.useState('mons');
  const [detail, setDetail] = React.useState(null); // 押したマスモン(詳細画面)
  const save = useAssistantMasmonSave();
  const [welcome, setWelcome] = React.useState(null); // 迎える場面
  const [ask, setAsk] = React.useState(null); // 提案のシート { from, t }
  if (Number.isFinite(Number(bondLv))) _assistantMasmonBondNow[id] = Number(bondLv);
  const [renamed, setRenamed] = React.useState(false); // 名前を付け直したあとの1回だけの1行
  React.useEffect(() => {
    let alive = true;
    (async () => {
      await ASSISTANT_MASMON_STORE.load();
      // 仲良し度が届いているぶんは全部その場で迎える(引き直しで Lv の高い人も)。場面は最後の1体だけ(2026-11-08 社長 Q3)
      const p0 = assistantMasmonPlanOf(id), lv = Number(bondLv);
      if (p0 && p0.v2) {
        // まだの枠は、迎えるその時に1体を選ぶ(2026-11-08 社長「迎えるときに決める」)
        const got = await assistantMasmonWelcomeDue(id, lv);
        // 迎えた子の育成(6能力)もその場で作る(2026-11-11 社長: 新しく来たエイキだけ「ライフ・攻撃・防御・ガッツ」の古い棒だった。開いた瞬間にしか作っていなかった)
        if (got.length && typeof amgTick === 'function') { try { await amgTick(id); } catch (_) {} }
        if (got.length && alive) setWelcome(got[got.length - 1]);
      } else {
        const due = p0 && Number.isFinite(lv) ? (p0.extra || []).filter(t => assistantMasmonMonOk(t) && Number.isFinite(t.welcome) && lv >= t.welcome && !assistantMasmonWelcomed(id)[t.monster]) : [];
        let last = null;
        for (let i = 0; i < due.length; i++) { if (await assistantMasmonWelcome(id, due[i], i < due.length - 1)) last = due[i]; } // 日記は最後の1体だけ
        if (last && alive) setWelcome(last);
      }
      // 名前を付け直したあと、その助手のシートを初めて開いたときだけ1行(二度出さない・新しいキーの noticed)
      const st = ASSISTANT_MASMON_STORE.state;
      if (assistantMasmonDrawOn(id, st) && st.renamed2[id] === 'new' && alive) {
        setRenamed(true);
        const next = { ...st, renamed2: { ...st.renamed2, [id]: 'seen' } };
        ASSISTANT_MASMON_STORE.set(next);
        try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_KEY, next, false); } catch (_) {}
      } else if (!assistantMasmonDrawOn(id, st) && st.named && !st.noticed[id] && alive) {
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
  const waitSorted = waiting.slice().sort((a, b) => (a.welcome || 0) - (b.welcome || 0)), waitNext = waitSorted[0] || null, waitRest = waitSorted.slice(1); // 🔒の枠は次の1体だけ大きく、残りは1行(通し点検の改善案9)
  const fav = tab === 'deck' ? assistantMasmonFavCard(id) : null;
  let body = null;
  if (tab === 'mons') {
    body = (<>
      {renamed && <p className="mhm-card mb-2 text-[11.5px] font-bold leading-snug text-slate-100" data-assistant-masmon-renamed>{who.name}「{assistantMasmonRenamedLine(id)}」</p>}
      {waitNext && <p className="mhm-card mb-2 text-[12px] font-black text-pink-100" data-assistant-masmon-next-lv>💗 {Number.isFinite(bondLv) && waitNext.welcome > bondLv ? `あと仲良し度 ${waitNext.welcome - bondLv} Lv で、次のマスモンを迎えます` : `仲良し度 Lv${waitNext.welcome} で、次のマスモンを迎えます`}</p>}
      <div className={land ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>{all.map(t => <AssistantMasmonRow key={t.monster} t={t} land={land} onOpen={setDetail} aid={id} amg={amgSt}/>)}{waitNext && <AssistantMasmonWaitCard key={waitNext.monster} t={waitNext} land={land}/>}</div>
      {waitRest.length > 0 && <p className="mt-2 rounded-xl border border-dashed border-slate-600 px-3 py-2 text-[11px] font-bold text-slate-400" data-assistant-masmon-wait-rest={waitRest.length}>🔒 ほかに {waitRest.length} 体(仲良し度 {waitRest.map(t => `Lv${t.welcome}`).join('・')} で迎えます)</p>}
      {p.v2 && <AssistantMasmonStyleRow who={who}/>}
      {p.v2 && waiting.length > 0 && <AssistantMasmonWishRow who={who} onAsk={(from) => setAsk({ from })}/>}
      <p className="mt-2 text-[10.5px] font-bold leading-snug text-slate-400">🐾 {who.name}が自分で育てて、自分の好きな色に染めているマスモンです。押すと詳しく見られます。</p>
    </>);
  } else if (tab === 'team' && p.v2) {
    body = <AssistantMasmonFormation who={who} team={team} waiting={waiting} land={land} onOpen={setDetail} onAsk={(from) => setAsk({ from, t: from === 'hero' ? (team.find(x => x.lead) || team[0]) : null })}/>;
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
    body = <><AssistantMasmonDeckTab id={id} land={land}/><AssistantMasmonDeckAsk who={who} onAsk={() => setAsk({ from: 'deck' })}/></>;
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
      const m = x.monster ? assistantMasmonMon(x.monster) : x.lineage ? assistantMasmonLineageRep(x.lineage) : null;
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
      {detail && <AssistantMasmonDetail who={who} p={p} t={detail} land={land} onClose={() => setDetail(null)} onAsk={(t) => setAsk({ from: 'masmon', t })}/>}
      {ask && <AssistantMasmonAskSheet who={who} from={ask.from} t={ask.t || null} land={land} onClose={() => setAsk(null)}/>}
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
            {welcome.reason && ASSISTANT_MASMON_PICK_REASON[welcome.reason] && <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-sky-200" style={{ wordBreak: 'auto-phrase' }} data-assistant-masmon-welcome-reason>💭 選んだわけ: {ASSISTANT_MASMON_PICK_REASON[welcome.reason]}</p>}
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
function AssistantMasmonDetail({ who, p, t, land = false, onClose, onAsk = null }) {
  const m = assistantMasmonMon(t.monster), st = assistantMasmonStats(t);
  const amgSt = typeof useAmgState === 'function' ? useAmgState() : null;
  const ge = typeof amgOn === 'function' && amgOn() ? amgEntryOf(who.id, t, amgSt || AMG_STORE.state) : null; // 育成基盤(公開の印 assistantMasmonGrow)
  if (!m || !st) return null;
  const n = assistantMasmonRegions(t.monster);
  const cols = ((t.dye && t.dye.colors) || []).slice(0, n || 5);
  const like = assistantMasmonLikeText(who, p, t);
  const skills = assistantMasmonSkills(t);
  const kind = assistantMasmonGrowKind(t.grow);
  const role = t.lead ? (p && p.v2 ? '勇者モン' : '先頭') : t.bench ? '控え' : '編成';
  const pic = <AssistantMasmonPic t={t} size={land ? 190 : 210}/>;
  const info = (<>
    {ge ? <AmgGrowCard who={who} t={t} e={ge} kindText={ASSISTANT_MASMON_GROW_TEXT[kind] || ''} growMine={t.growMine}/> : (<>
    <div className="mhm-card" data-assistant-masmon-detail-stats>
      <p className="text-[10px] font-black text-slate-400">能力</p>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        {ASSISTANT_MASMON_STAT_LABEL.map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-200"><span className="w-[38px] shrink-0">{label}</span><span className="mhm-bar"><i style={{ width: `${Math.round(st[k] * 100)}%` }}/></span></div>))}
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-amber-200">📈 {t.grow}</p>
      {t.growMine && <p className="text-[10.5px] font-bold text-sky-200" data-assistant-masmon-grow-mine>🌱 育て方: {t.growMine.kind}({t.growMine.day ? `${t.growMine.day.slice(5).replace('-', '/')} ` : ''}あなたの提案)</p>}
      {ASSISTANT_MASMON_GROW_TEXT[kind] && <p className="text-[10.5px] font-bold text-slate-300">{ASSISTANT_MASMON_GROW_TEXT[kind]}</p>}
    </div>
    </>)}
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
            <small className="text-slate-400">{assistantMasmonPartRule(t.monster, i).name}</small>{b ? `${assistantMasmonColorName(b)}${al < 100 ? `(うすめ ${al}%)` : ''}` : '元の色'}
          </span>); })}
      </div>
      {(() => {
        const e = who && who.id && Number.isInteger(t.slot) ? assistantMasmonDyeLog(who.id, t.slot)[0] : null;
        if (!e) return null;
        const why = e.why === 'season' ? `${ASSISTANT_MASMON_SEASON_NAME[String(e.season).split('-')[1]] || '季節'}の色に染め直しました` : e.why === 'like' ? '好きな色が変わって、染め直しました' : e.why === 'ask' ? (e.undo ? '前の色に戻しました' : 'あなたの提案で染め直しました') : '染め方を見直しました';
        const before = (e.before || []).slice(0, n || 5);
        return (
          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-300" data-assistant-masmon-dye-log={e.why}>
            <span>🎨 {e.at ? `${e.at.slice(5).replace('-', '/')} ` : ''}{why}{ASSISTANT_MASMON_ROLE_NAME[e.role] ? `(${ASSISTANT_MASMON_ROLE_NAME[e.role]})` : ''}</span>
            <span className="inline-flex items-center gap-[3px] text-slate-400">前の色{before.map((c, i) => c
              ? <i key={i} title={assistantMasmonColorName(String(c).split('@')[0])} className="inline-block h-[8px] w-[8px] rounded-full border border-white/40" style={{ background: assistantMasmonSwatch(String(c).split('@')[0]) }}/>
              : <i key={i} title="元の色" className="inline-block h-[8px] w-[8px] rounded-full border border-dashed border-white/50"/>)}</span>
          </p>);
      })()}
    </div>
    {onAsk && assistantMasmonAskOn() && Number.isInteger(t.slot) && (() => {
      const st = ASSISTANT_MASMON_STORE.state;
      const l0 = assistantMasmonDyeLog(who.id, t.slot)[0] || {}; const lastAsk = l0.why === 'ask' && !l0.undo; // 戻したあとは、もう出さない
      const prevName = (assistantMasmonMineOf(st, who.id).names[t.slot] || []).slice(-1)[0];
      const prevMon = ((assistantMasmonMineOf(st, who.id).former || {})[t.slot] || []).slice(-1)[0];
      return (
        <div className="mhm-card mt-2 flex flex-wrap items-center gap-2" data-assistant-masmon-detail-ask>
          <button type="button" className="mhl-btn px-3 text-[11.5px]" style={{ background: 'linear-gradient(90deg,#f472b6,#fb923c)' }} onClick={() => onAsk(t)} data-assistant-masmon-ask-open="masmon">💡 {who.name}に提案する(名前・色・育て方)</button>
          {lastAsk && <button type="button" className="mhl-btn bg-slate-700 px-3 text-[11px]" onClick={() => { assistantMasmonUndoColor(who.id, t.slot); onClose(); }} data-assistant-masmon-undo="color">🎨 前の色に戻してもらう</button>}
          {t.growMine && <button type="button" className="mhl-btn bg-slate-700 px-3 text-[11px]" onClick={() => { assistantMasmonUndoGrow(who.id, t.slot); onClose(); }} data-assistant-masmon-undo="grow">🌱 前の育て方「{assistantMasmonGrowKind(t.growMine.before)}」に戻してもらう</button>}
          {prevName && <button type="button" className="mhl-btn bg-slate-700 px-3 text-[11px]" onClick={() => { assistantMasmonUndoName(who.id, t.slot); onClose(); }} data-assistant-masmon-undo="name">前の名前「{prevName}」に戻してもらう</button>}
          {prevMon && <button type="button" className="mhl-btn bg-slate-700 px-3 text-[11px]" onClick={() => { assistantMasmonUndoSwap(who.id, t.slot); onClose(); }} data-assistant-masmon-undo="swap">前のマスモン「{prevMon.nick}」に戻してもらう</button>}
        </div>);
    })()}
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
          <button type="button" className="mhl-btn shrink-0 bg-slate-700 px-3" data-assistant-masmon-detail-close data-mhl-sheet-close onClick={onClose}>閉じる</button>
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
  //   (2026-11-11 カルク: 歩きは left ではなく transform で動かす。left だと歩くあいだ毎コマ配置の計算と描き直しが起き、助手ライフを開いているだけで重かった。見た目は同じ)
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
      style={{ ...ASSISTANT_MASMON_PET_STYLE, ...(show ? { left: 0, top: plan.y, width: size, height: size, transform: `translateX(${at.x}px)`, transition: at.moving ? `transform ${at.ms}ms linear` : 'none' } : { left: 0, top: 0, width: 1, height: 1, visibility: 'hidden' }) }} aria-hidden="true">
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
    {faceOn && (() => {
      // これまでのデッキ(カード部の口 83 の cardAiDeckChoices の past。組み直して名前が変わる前のデッキ。10個まで)。押すと中身を下に出す
      let past = [];
      try { past = typeof cardAiDeckChoices === 'function' ? cardAiDeckChoices(id).filter(c => c.past) : []; } catch (_) { past = []; }
      if (!past.length) return null;
      return (
        <div data-assistant-masmon-deck-past className="mt-2">
          <p className="text-[10.5px] font-black text-slate-400">これまでのデッキ</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {past.map(c => (
              <button key={c.id} type="button" data-assistant-masmon-deck-past-item={c.id} aria-pressed={sid === c.id} onClick={() => { if (typeof Audio_ !== 'undefined') Audio_.fgSe.tap(); setSid(c.id); }}
                className={`rounded-lg border px-2 py-1 text-[11px] font-black ${sid === c.id ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-white/15 bg-slate-800 text-slate-200'}`}>
                {c.name}{typeof cardAiDeckPeriodText === 'function' && <small className="ml-1 text-[9.5px] font-bold opacity-80">{cardAiDeckPeriodText(c.from, c.to)}</small>}
              </button>))}
          </div>
        </div>);
    })()}
    <div className="mt-2" data-assistant-masmon-deck-view={sid}><CardAssistantDeckView who={id} styleId={sid} land={land}/></div>
  </>);
}

const ASSISTANT_MASMON_CSS = `
.mhm-panel{position:absolute;left:0;right:0;bottom:0;top:5%;display:flex;flex-direction:column;background:linear-gradient(180deg,#1f1640,#0b1020 70%);border-top:2px solid #f9a8d4;border-radius:22px 22px 0 0;padding:12px 14px calc(12px + env(safe-area-inset-bottom));color:#fff}
.mhm-panel.is-land{top:0;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));border:2px solid #f9a8d4;border-bottom:0;padding:8px 14px 8px}
.mhm-body{flex:1;min-height:0;overflow-y:auto;padding:2px 2px 6px}
.mhm-tab{min-height:44px;border-radius:999px;background:#1e293b;padding:6px 2px;font-size:11px;font-weight:900;color:#cbd5e1;white-space:nowrap}
.mhm-tab.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff}
.mhm-card{border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.85);border-radius:14px;padding:8px 10px}
.mhm-pic{flex-shrink:0;border-radius:10px;background:radial-gradient(circle at 50% 40%,#94a3b8,#475569);overflow:hidden;margin:0 auto}
.mhm-stage{display:flex;justify-content:center}
.mhm-lead.mhm-bench{background:#38bdf8}
.mhm-lead{font-style:normal;border-radius:999px;background:#f472b6;padding:0 6px;font-size:9.5px;font-weight:900;color:#fff;vertical-align:middle}
.mhm-bar{position:relative;flex:1;height:5px;border-radius:99px;background:#334155;overflow:hidden}
.mhm-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#f97316)}
`;
