// ===== MFバトルカード: 戦術カード(ガンビット型)の中身(純粋な計算) =====
// 2026-10-29 社長: 戦術カードは FF12 のガンビットの形。1行 = 「条件カード ▶ 行動カード」。上の行から順に見て、
//   条件に当たった行の行動をする(当たらなければ次の行)。どれにも当たらなければ基本カードの型で打つ。
//   カードは4つの山(154枚): 条件98(どの枠でも使う)・基本15(大まかな型)・ブリーダー12(ブリーダーの手)・モンスター29(技の使い方・立ち回り)。
//   N91・R57・SR6・はじめに配る9枚。段ごとに1枚(ライフ90%〜10%・ガッツ1〜7 など)
//   枠: 基本(メイン1+サブ2)・ブリーダーの枠・モンスター1体ごとの枠(同じカードをどの子の枠にも入れられる)
//   案と表: docs/progress/card-deck-share/(ブランチ card-tactics-mock)
// ★この部品は pure(画面・保存を触らない)。82 の cardAiChooseAction が policy.gambit(枠)を持つときだけ cardTacticDecide を呼ぶ。
//   policy.gambit が無ければ何もしない(助手と対戦・マルチの助手の強さは変わらない)。
//   何も入れていないとき(0行・基本カードなし)の強さは社長の別案待ち(2026-10-29)。いまは今の打ち方のまま
//
// 行動の「いつ見るか」: attack(自分の攻撃を選ぶとき)/ guard(攻撃を受けたとき)/ guts(ガッツの番)
//   いまの場面に合わない行と、行動で出せる手が無い行は飛ばす。損しかない攻撃(点数0以下)も「出せる手が無い」として飛ばす
// 条件の「標的」: 当たった子を、そのまま行動の相手にする。foes … 相手の子の番号の組 / mine … 自分の子の番号の組(守るとき、狙われた子がこの中にいるか)

// ---- カードの表 ----
// sec … 表の区分 / g … 種類(段をまとめた物。画面の表の1行) / v … 段 / r … レア / start … はじめに配る
const CARD_TACTIC_LIFE = [90, 80, 70, 60, 50, 40, 30, 20, 10];
const cardTacticFine = (fine) => (v) => (fine.includes(v) ? 'R' : 'N'); // 粗い段はN・間の細かい段はR
const CARD_TACTIC_GROUPS = Object.freeze([
  // ---------- 条件 ----------
  { id: 'any', cat: 'cond', sec: '標的', name: 'いつでも', tiers: [['', 'N']], start: [''], desc: 'いつも当たる' },
  { id: 'ko', cat: 'cond', sec: '標的', name: '倒せる相手', tiers: [['', 'N']], start: [''], desc: '出せる技で倒せる相手を標的にする' },
  { id: 'lowest', cat: 'cond', sec: '標的', name: 'いちばんライフの低い相手', tiers: [['', 'N']], desc: '残りライフがいちばん少ない子' },
  { id: 'highest', cat: 'cond', sec: '標的', name: 'いちばんライフの高い相手', tiers: [['', 'N']], desc: '残りライフがいちばん多い子' },
  { id: 'strongest', cat: 'cond', sec: '標的', name: 'いちばん攻撃の強い相手', tiers: [['', 'R']], desc: 'その子が使える技の最大ダメージで見積もる(手札は見ない)' },
  { id: 'attacker', cat: 'cond', sec: '標的', name: '前の番に攻撃してきた相手', tiers: [['', 'R']], desc: '直前の相手の番に攻撃してきた子' },
  { id: 'leader', cat: 'cond', sec: '標的', name: '相手のリーダー', tiers: [['', 'R']], desc: '相手が1体目に置いた子' },
  { id: 'type', cat: 'cond', sec: '標的', name: '◯の相手', tiers: [['地上', 'N'], ['空中', 'N'], ['水中', 'N']], desc: 'その特徴の子' },
  { id: 'blood', cat: 'cond', sec: '標的', name: '◯の相手', tiers: [['純血', 'N'], ['混血', 'N']], desc: 'その血の子' },
  { id: 'species', cat: 'cond', sec: '標的', name: '種族を決めた相手', tiers: [['', 'R']], desc: '組むときに種族を1つ選ぶ(1枚で全種族)' },
  { id: 'foeLife', cat: 'cond', sec: 'ライフ', name: '相手のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), start: [50], desc: 'その割合以下の相手の子を標的にする' },
  { id: 'myLife', cat: 'cond', sec: 'ライフ', name: '自分のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), desc: 'その割合以下の自分の子がいる(守る相手にする)' },
  { id: 'myGuts', cat: 'cond', sec: 'ガッツ', name: '自分のガッツ◯以上', tiers: [1, 2, 3, 4, 5, 6, 7].map((v) => [v, cardTacticFine([2, 4, 6])(v)]), start: [3], desc: '自分のガッツがその数以上' },
  { id: 'foeGutsLe', cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以下', tiers: [0, 1, 2, 3, 4].map((v) => [v, cardTacticFine([1, 3])(v)]), desc: '相手のガッツがその数以下' },
  { id: 'foeGutsGe', cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以上', tiers: [3, 4, 5, 6, 7].map((v) => [v, cardTacticFine([4, 6])(v)]), desc: '相手のガッツがその数以上(大技に備える)' },
  { id: 'myHand', cat: 'cond', sec: '手札・山札', name: '自分の手札◯枚以上', tiers: [2, 3, 4, 5].map((v) => [v, cardTacticFine([2, 4])(v)]), desc: '自分の手札がその数以上' },
  { id: 'foeHandGe', cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以上', tiers: [2, 3, 4, 5].map((v) => [v, cardTacticFine([2, 4])(v)]), desc: '相手の手札がその数以上' },
  { id: 'foeHandLe', cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以下', tiers: [0, 1, 2].map((v) => [v, cardTacticFine([1])(v)]), desc: '相手の手札がその数以下' },
  { id: 'myDeck', cat: 'cond', sec: '手札・山札', name: '自分の山札◯枚以下', tiers: [30, 20, 10, 5].map((v) => [v, cardTacticFine([20, 5])(v)]), desc: '自分の山札がその数以下' },
  { id: 'foeDeck', cat: 'cond', sec: '手札・山札', name: '相手の山札◯枚以下', tiers: [30, 20, 10, 5].map((v) => [v, cardTacticFine([20, 5])(v)]), desc: '相手の山札がその数以下' },
  { id: 'guardN', cat: 'cond', sec: '手札の中身', name: '手札に守り札◯枚以上', tiers: [1, 2, 3].map((v) => [v, cardTacticFine([3])(v)]), desc: '回避・防御の札がその数以上' },
  { id: 'guardKind', cat: 'cond', sec: '手札の中身', name: '手札に◯がある', tiers: [['回避', 'N'], ['防御', 'N']], desc: 'その種類の守り札がある' },
  { id: 'bigInHand', cat: 'cond', sec: '手札の中身', name: '手札に大技がある', tiers: [['', 'N']], desc: 'ガッツ4以上の攻撃の札がある' },
  { id: 'areaInHand', cat: 'cond', sec: '手札の中身', name: '手札に全体攻撃がある', tiers: [['', 'R']], desc: '全員に当たる技がある' },
  { id: 'breederInHand', cat: 'cond', sec: '手札の中身', name: '手札にブリーダーのカードがある', tiers: [['', 'N']], desc: 'ブリーダーのカードがある' },
  { id: 'turnLe', cat: 'cond', sec: '番', name: '◯番目まで', tiers: [1, 2, 3, 5].map((v) => [v, cardTacticFine([2])(v)]), desc: '自分の番がその回数まで' },
  { id: 'turnGe', cat: 'cond', sec: '番', name: '◯番目から', tiers: [5, 8, 10, 15].map((v) => [v, cardTacticFine([10])(v)]), desc: '自分の番がその回数から' },
  { id: 'myAlive', cat: 'cond', sec: '場', name: '自分の場が◯体', tiers: [[1, 'R'], [2, 'N'], [3, 'N']], desc: '自分の場に残っている数' },
  { id: 'foeAlive', cat: 'cond', sec: '場', name: '相手の場が◯体', tiers: [[1, 'R'], [2, 'N'], [3, 'N']], desc: '相手の場に残っている数' },
  { id: 'koDiff', cat: 'cond', sec: '場', name: '倒した数で◯ている', tiers: [['勝っ', 'N'], ['負け', 'N']], desc: '倒した数と倒された数をくらべる' },
  { id: 'foeStun', cat: 'cond', sec: '状態', name: '攻撃できない相手', tiers: [['', 'R']], desc: '封じられて次の番に攻撃できない相手の子' },
  { id: 'myStun', cat: 'cond', sec: '状態', name: '攻撃できない味方', tiers: [['', 'N']], desc: '封じられている自分の子がいる' },
  { id: 'foeCharge', cat: 'cond', sec: '状態', name: '溜めている相手', tiers: [['', 'R']], desc: '次の技が何倍にもなる相手の子' },
  { id: 'foeAir', cat: 'cond', sec: '状態', name: '空中に上がった相手', tiers: [['', 'N']], desc: 'いま空中になっている子(もとは地上・水中)' },
  { id: 'field', cat: 'cond', sec: '状態', name: '場に◯全体カードがある', tiers: [['自分の', 'N'], ['相手の', 'N']], desc: 'だれが出した全体カードが場にあるか' },
  { id: 'foeBig', cat: 'cond', sec: '状態', name: '相手が大技を構えている', tiers: [['', 'SR']], desc: '相手のガッツと使える技から、大技を撃てそうと見積もる' },
  // ---------- 基本カード(大まかな型。基本の枠: メイン1・サブ2) ----------
  { id: 'tBalance', cat: 'base', sec: '基本', name: 'バランス型', tiers: [['', 'N']], start: [''], habit: 'kyuko', desc: 'くせの少ない打ち方(きゅこの型)' },
  { id: 'tAttack', cat: 'base', sec: '基本', name: '攻め型', tiers: [['', 'N']], habit: 'mua', desc: 'ためずに攻める(みゅあの型)' },
  { id: 'tGuard', cat: 'base', sec: '基本', name: '守り型', tiers: [['', 'N']], habit: 'dra', desc: '守り札を残して堅く守る(ドラの型)' },
  { id: 'tSave', cat: 'base', sec: '基本', name: '溜め型', tiers: [['', 'N']], habit: 'kiki', desc: 'ガッツをためて大技(ききの型)' },
  { id: 'tDisrupt', cat: 'base', sec: '基本', name: '崩し型', tiers: [['', 'N']], habit: 'momosuke', desc: '相手の手を崩す(ももすけの型)' },
  { id: 'tBig', cat: 'base', sec: '基本', name: '大技型', tiers: [['', 'R']], mul: { big: 1.6 }, desc: 'ダメージの大きい技を選ぶ' },
  { id: 'tArea', cat: 'base', sec: '基本', name: '全体型', tiers: [['', 'R']], mul: { area: 1.6 }, desc: '全体攻撃・全体カードを選ぶ' },
  { id: 'tFinish', cat: 'base', sec: '基本', name: '仕留め型', tiers: [['', 'R']], mul: { finish: 1.6 }, desc: 'あと少しで倒せる子を先に狙う' },
  { id: 'tRush', cat: 'base', sec: '基本', name: '速攻型', tiers: [['', 'R']], mul: { attack: 1.6, big: 0.7 }, desc: '軽い技で手数を出す' },
  { id: 'tSteady', cat: 'base', sec: '基本', name: '堅実型', tiers: [['', 'R']], mul: { keepGuard: 1.3, saveGuts: 1.3, attack: 0.8 }, desc: '守りとガッツを残して、無理をしない' },
  { id: 'tJam', cat: 'base', sec: '基本', name: 'かく乱守り型', tiers: [['', 'R']], mul: { disrupt: 1.3, keepGuard: 1.3 }, desc: '崩しながら守る' },
  { id: 'tCalm', cat: 'base', sec: '基本', name: '慎重型', tiers: [['', 'R']], calm: true, desc: '極端な打ち方をせず、損得で冷静に打つ(ほかの型の効きを半分に)' },
  { id: 'tFlex', cat: 'base', sec: '基本', name: '臨機応変型', tiers: [['', 'SR']], habit: 'atsu', desc: '場を見て、とどめ・全体・守り・攻めを切り替える(あつの型)' },
  { id: 'tMill', cat: 'base', sec: '基本', name: '持久型', tiers: [['', 'SR']], habit: 'sorashido', desc: '長引かせて、相手の山札切れで勝つ(ソラシドの型)' },
  { id: 'tReckless', cat: 'base', sec: '基本', name: '捨て身型', tiers: [['', 'SR']], mul: { keepGuard: 0.5, finish: 1.3 }, desc: '守らずに受けて、そのぶん倒しに行く' },
  // ---------- 行動(ブリーダーカード・モンスターカード) ----------
  { id: 'atk', cat: 'monster', sec: '攻撃', phase: 'attack', name: '攻める', tiers: [['', 'N']], start: [''], desc: '点数がいちばん高い攻撃' },
  { id: 'kind', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯の技を出す', tiers: [['ちから', 'N'], ['かしこさ', 'N'], ['特殊', 'N']], desc: 'その種類の技を出す' },
  { id: 'cost', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['軽い技(ガッツ0〜1)', 'N'], ['中くらいの技(2〜3)', 'N'], ['大技(4以上)', 'N']], start: ['大技(4以上)'], desc: '払うガッツで選ぶ' },
  { id: 'reach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['全体攻撃', 'R'], ['単体攻撃', 'N']], desc: '全員に当たる技か、1体に当てる技か' },
  { id: 'eff', cat: 'monster', sec: '攻撃', phase: 'attack', name: '「◯」の技を出す', tiers: [['回避されない', 'N'], ['攻撃できなくする', 'R'], ['ガッツを減らす', 'N'], ['吸い取る', 'N'], ['2回攻撃', 'R']], desc: 'その効き目のついた技を出す' },
  { id: 'attach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '付ける札を使う', tiers: [['', 'R']], desc: '技に付ける札をいっしょに出す' },
  { id: 'breeder', cat: 'breeder', sec: 'ブリーダー', phase: 'attack', name: 'ブリーダーのカード(◯)', tiers: [['攻撃', 'N'], ['守り', 'N'], ['引く・手札', 'N'], ['回復', 'N']], desc: 'その種類のブリーダーのカードを出す(守り … 攻撃できないを消す・倒れた子を戻す)' },
  { id: 'fieldCard', cat: 'breeder', sec: 'ブリーダー', phase: 'attack', name: '全体カードを出す', tiers: [['', 'R']], desc: '場に残る全体カードを出す' },
  { id: 'disrupt', cat: 'monster', sec: '崩す', phase: 'attack', name: '崩し: ◯', tiers: [['手札を捨てさせる', 'R'], ['山札を削る', 'R'], ['ガッツを減らす', 'R'], ['番を飛ばす', 'SR']], desc: '相手の手を崩す札を出す' },
  { id: 'guard', cat: 'monster', sec: '守り', phase: 'guard', name: '守る', tiers: [['', 'N']], start: [''], desc: '攻撃を受けたら守り札で守る' },
  { id: 'guardFirst', cat: 'monster', sec: '守り', phase: 'guard', name: '◯を先に使う', tiers: [['回避', 'N'], ['防御', 'N']], desc: '守るとき、その種類の札で守る' },
  { id: 'guardOver', cat: 'monster', sec: '守り', phase: 'guard', name: 'ダメージ◯以上だけ守る', tiers: [[3, 'N'], [5, 'N'], [7, 'R']], desc: 'その数より小さい攻撃は守らない' },
  { id: 'guardDie', cat: 'monster', sec: '守り', phase: 'guard', name: '倒されるときだけ守る', tiers: [['', 'R']], desc: '受けたら倒れるときだけ守る' },
  { id: 'cover', cat: 'monster', sec: '守り', phase: 'guard', name: '味方をかばう', tiers: [['', 'R']], desc: 'かばう札で、味方への攻撃を受ける' },
  { id: 'noGuard', cat: 'monster', sec: '守り', phase: 'guard', name: '守らない', tiers: [['', 'R']], desc: '守り札を使わず受ける(札を残す)' },
  { id: 'save', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツをためる', tiers: [['', 'N']], start: [''], desc: '手札を多めにガッツへ回す' },
  { id: 'gutsN', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツを◯枚だけ置く', tiers: [[0, 'N'], [1, 'N'], [2, 'N']], desc: 'ガッツの番に置く数を決める' },
  { id: 'keepGuard', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: '守り札を残して置く', tiers: [['', 'R']], desc: '回避・防御はガッツにしない' },
  { id: 'stop', cat: 'breeder', sec: '流れ', phase: 'attack', name: '攻撃を止める', tiers: [['', 'N']], desc: 'この番の攻撃をここで終える' },
  { id: 'charge', cat: 'monster', sec: '流れ', phase: 'attack', name: '溜め技を使う', tiers: [['', 'R']], desc: '次の技を何倍にする札を先に使う' },
  { id: 'ace', cat: 'breeder', sec: '特別', phase: 'attack', name: '切り札を出す', tiers: [['', 'SR']], desc: '登録した切り札を、手にあれば先に出す' },
]);
// カードのid は「種類.段」(段の無いカードは種類だけ)。保存(mh_card_tactics_v1)にこのまま書くので、変えない
const cardTacticCardId = (g, v) => (v === '' ? g.id : `${g.id}.${v}`);
const CARD_TACTIC_CARDS = Object.freeze(CARD_TACTIC_GROUPS.flatMap((g) => g.tiers.map(([v, r]) => Object.freeze({
  id: cardTacticCardId(g, v), g: g.id, cat: g.cat, sec: g.sec, phase: g.phase || null, v,
  name: v === '' ? g.name : g.name.replace('◯', String(v)), r, start: (g.start || []).includes(v), desc: g.desc,
}))));
const CARD_TACTIC_BY_ID = Object.freeze(Object.fromEntries(CARD_TACTIC_CARDS.map((c) => [c.id, c])));
const CARD_TACTIC_START = Object.freeze(CARD_TACTIC_CARDS.filter((c) => c.start).map((c) => c.id));
const cardTacticOf = (id) => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(CARD_TACTIC_BY_ID, id) ? CARD_TACTIC_BY_ID[id] : null);

// 枠の形(2026-10-29 社長: 基本カードはメイン1+サブ2・ブリーダーの枠・モンスター1体ごとの枠)
//   { base:[メイン, サブ1, サブ2](カードidか null), breeder:[行], mons:[[行],[行],[行]] }(mons は場の左・真ん中・右の子)
//   行 … { c: 条件カード, a: 行動カード, on, sp(「種族を決めた相手」のときの種族) }。ブリーダーの枠にはブリーダーカード、モンスターの枠にはモンスターカードだけ
//   数の上限: 基本3・ブリーダー3行・モンスター5行(開いている数はレベルで決まる。96 の cardLevelFrames)
const CARD_TACTIC_FRAME_MAX = Object.freeze({ base: 3, breeder: 3, mon: 5 });
const cardTacticNormalizeRows = (raw, cat, max) => (Array.isArray(raw) ? raw : []).map((r) => {
  if (!r || typeof r !== 'object') return null;
  const c = cardTacticOf(r.c), a = cardTacticOf(r.a);
  if (!c || !a || c.cat !== 'cond' || a.cat !== cat) return null;
  const row = { c: c.id, a: a.id, on: r.on !== false };
  if (c.g === 'species') { if (typeof r.sp !== 'string' || !r.sp) return null; row.sp = r.sp.slice(0, 32); }
  return row;
}).filter(Boolean).slice(0, max);
const cardTacticNormalizeFrames = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const base = [0, 1, 2].map((i) => { const c = cardTacticOf(Array.isArray(r.base) ? r.base[i] : null); return c && c.cat === 'base' ? c.id : null; });
  const mons = [0, 1, 2].map((i) => cardTacticNormalizeRows(Array.isArray(r.mons) ? r.mons[i] : null, 'monster', CARD_TACTIC_FRAME_MAX.mon));
  return { base, breeder: cardTacticNormalizeRows(r.breeder, 'breeder', CARD_TACTIC_FRAME_MAX.breeder), mons };
};
// 入れたカードの数(基本カード+ON の行)。賢さに数える
const cardTacticFilled = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  return f.base.filter(Boolean).length + f.breeder.filter((x) => x.on).length + f.mons.reduce((a, rows) => a + rows.filter((x) => x.on).length, 0);
};

// ---- 基本カードの型 → くせ ----
// メインはそのまま、サブは倍率の上げ下げを3分の1ずつ効かせる(2026-10-29 社長「メイン1+サブ2」・ツナグ案)。上限は ×2・下限は ×0.3
//   慎重型 … ほかの型の効きを半分に(サブなら6分の1減らす)/ 臨機応変型・持久型 … メインならいつも、サブなら3回に1回の番
const CARD_TACTIC_DIMS = Object.freeze(['attack', 'keepGuard', 'saveGuts', 'big', 'disrupt', 'area', 'finish']);
const CARD_TACTIC_SUB_W = 1 / 3;
const cardTacticPresetOf = (card) => {
  const g = CARD_TACTIC_GROUPS.find((x) => x.id === card.g) || {};
  if (g.habit) return { ...(CARD_AI_HABITS[g.habit] || {}) };
  if (g.mul) return { ...g.mul };
  return {};
};
const cardTacticHabitOf = (base, st = null, p = 0) => {
  const list = (Array.isArray(base) ? base : []).map((id, i) => ({ c: cardTacticOf(id), w: i === 0 ? 1 : CARD_TACTIC_SUB_W })).filter((x) => x.c && x.c.cat === 'base');
  if (!list.length) return null;
  const h = Object.fromEntries(CARD_TACTIC_DIMS.map((d) => [d, 1]));
  list.forEach(({ c, w }) => { const pre = cardTacticPresetOf(c); CARD_TACTIC_DIMS.forEach((d) => { if (Number.isFinite(pre[d])) h[d] *= 1 + (pre[d] - 1) * w; }); });
  const calm = list.filter((x) => x.c.g === 'tCalm').reduce((a, x) => a * (1 - 0.5 * x.w), 1);
  CARD_TACTIC_DIMS.forEach((d) => { h[d] = Math.min(2, Math.max(0.3, 1 + (h[d] - 1) * calm)); });
  const turn = st ? cardTacticOwnTurn(st, p) : 0;
  const some = (g) => list.some((x) => x.c.g === g && (x.w === 1 || turn % 3 === 0));
  if (some('tFlex')) h.flex = true;
  const mill = list.filter((x) => x.c.g === 'tMill').reduce((a, x) => a + x.w, 0);
  if (mill) h.mill = Math.min(1, mill);
  return h;
};

// ---- 場を見る ----
const cardTacticOwnTurn = (st, p) => Math.max(0, Math.floor((st.turn + (p === st.first ? 1 : 0)) / 2));
const cardTacticAlive = (pl) => pl.mons.map((m, i) => (m.ko ? -1 : i)).filter((i) => i >= 0);
// その子が使える攻撃の札の最大ダメージ(カードの表から。手札は見ない)
const cardTacticMaxDamage = (db, mon) => {
  let best = 0;
  Object.values((db && db.cards) || {}).forEach((c) => { if (c && cardIsAttackKind(c.kind) && cardUsableBy(c, mon)) best = Math.max(best, c.damage || 0); });
  return best;
};
const cardTacticBigCost = 4;
const cardTacticIsBig = (st, c) => !!c && cardIsAttackKind(c.kind) && cardFieldCostOf(st, c.guts || 0) >= cardTacticBigCost;

// 条件を見る。当たらなければ null、当たれば { foes, mine }(標的が無い条件は両方 null)
const cardTacticCond = (db, st, p, card, row) => {
  const me = st.players[p], opp = st.players[cardOther(p)];
  const foesAlive = cardTacticAlive(opp), mineAlive = cardTacticAlive(me);
  const hit = (ok) => (ok ? { foes: null, mine: null } : null);
  const foes = (list) => (list.length ? { foes: list, mine: null } : null);
  const mine = (list) => (list.length ? { foes: null, mine: list } : null);
  const v = card.v;
  const hand = me.hand.map((n) => cardOf(db, n)).filter(Boolean);
  const guts = me.guts.length;
  switch (card.g) {
    case 'any': return hit(true);
    case 'ko': {
      const ready = hand.filter((c) => cardIsAttackKind(c.kind) && c.kind !== 'spe' && cardFieldCostOf(st, c.guts || 0) <= guts && me.mons.some((m) => !m.ko && cardUsableBy(c, m)));
      return foes(foesAlive.filter((j) => ready.some((c) => (c.damage || 0) >= opp.mons[j].life)));
    }
    case 'lowest': case 'highest': {
      if (!foesAlive.length) return null;
      const pickV = card.g === 'lowest' ? Math.min(...foesAlive.map((j) => opp.mons[j].life)) : Math.max(...foesAlive.map((j) => opp.mons[j].life));
      return foes(foesAlive.filter((j) => opp.mons[j].life === pickV));
    }
    case 'strongest': {
      if (!foesAlive.length) return null;
      const dm = foesAlive.map((j) => ({ j, d: cardTacticMaxDamage(db, opp.mons[j]) }));
      const top = Math.max(...dm.map((x) => x.d));
      return foes(dm.filter((x) => x.d === top).map((x) => x.j));
    }
    case 'attacker': return foes(foesAlive.filter((j) => (opp.mons[j].attacks || 0) > 0)); // 相手の子の攻撃の数は、相手の番のはじめに 0 に戻る(自分の番の間は前の番の数)
    case 'leader': return foes(foesAlive.filter((j) => j === 0));
    case 'type': { const t = { 地上: 'ground', 空中: 'air', 水中: 'water' }[v]; return foes(foesAlive.filter((j) => cardMonType(opp.mons[j], st.turn) === t)); }
    case 'blood': return foes(foesAlive.filter((j) => (v === '純血' ? cardIsPureMon(opp.mons[j]) : !cardIsPureMon(opp.mons[j]))));
    case 'species': return foes(foesAlive.filter((j) => row && row.sp && (opp.mons[j].species === row.sp || opp.mons[j].main === row.sp)));
    case 'foeLife': return foes(foesAlive.filter((j) => opp.mons[j].life * 100 <= opp.mons[j].max * v));
    case 'myLife': return mine(mineAlive.filter((i) => me.mons[i].life * 100 <= me.mons[i].max * v));
    case 'myGuts': return hit(guts >= v);
    case 'foeGutsLe': return hit(opp.guts.length <= v);
    case 'foeGutsGe': return hit(opp.guts.length >= v);
    case 'myHand': return hit(me.hand.length >= v);
    case 'foeHandGe': return hit(opp.hand.length >= v);
    case 'foeHandLe': return hit(opp.hand.length <= v);
    case 'myDeck': return hit(me.deck.length <= v);
    case 'foeDeck': return hit(opp.deck.length <= v);
    case 'guardN': return hit(hand.filter((c) => cardIsGuardKind(c.kind)).length >= v);
    case 'guardKind': return hit(hand.some((c) => c.kind === (v === '回避' ? 'dge' : 'blk')));
    case 'bigInHand': return hit(hand.some((c) => cardTacticIsBig(st, c)));
    case 'areaInHand': return hit(hand.some((c) => cardIsAttackKind(c.kind) && cardHasEff(c, 'area')));
    case 'breederInHand': return hit(hand.some((c) => c.user === 'breeder'));
    case 'turnLe': return hit(cardTacticOwnTurn(st, p) <= v);
    case 'turnGe': return hit(cardTacticOwnTurn(st, p) >= v);
    case 'myAlive': return hit(mineAlive.length === v);
    case 'foeAlive': return hit(foesAlive.length === v);
    case 'koDiff': { const took = opp.mons.filter((m) => m.ko).length, lost = me.mons.filter((m) => m.ko).length; return hit(v === '勝っ' ? took > lost : lost > took); }
    case 'foeStun': return foes(foesAlive.filter((j) => opp.mons[j].stunTurn > st.turn));
    case 'myStun': return mine(mineAlive.filter((i) => me.mons[i].stunTurn >= st.turn));
    case 'foeCharge': return foes(foesAlive.filter((j) => { const m = opp.mons[j]; return !!m.charge || !!(m.mult && m.mult.turn > st.turn); }));
    case 'foeAir': return foes(foesAlive.filter((j) => { const m = opp.mons[j]; return m.type !== 'air' && cardMonType(m, st.turn) === 'air'; }));
    case 'field': return hit(!!st.field && (v === '自分の' ? st.field.p === p : st.field.p !== p));
    case 'foeBig': {
      // 相手の場の子が使える大技(ガッツ4以上)のうち、いまの相手のガッツで払えるものがある
      const g = opp.guts.length;
      if (g < cardTacticBigCost || !opp.hand.length) return null;
      return hit(Object.values(db.cards || {}).some((c) => cardTacticIsBig(st, c) && cardFieldCostOf(st, c.guts || 0) <= g + 1 && foesAlive.some((j) => cardUsableBy(c, opp.mons[j]))));
    }
    default: return null;
  }
};

// ---- 行動 ----
// 攻撃の手が、その行動に合うか(o … 攻撃の候補。main … 主の札)
const CARD_TACTIC_EFF = Object.freeze({
  回避されない: ['noEvade'], 攻撃できなくする: ['stunOnHit', 'stunTarget', 'stunAllEnemies'], ガッツを減らす: ['gutsLossOnHit', 'oppGutsLoss'],
  吸い取る: ['drain'], '2回攻撃': ['extraAttack', 'extraAttackTarget', 'unlimitedAttacks'],
});
const CARD_TACTIC_BREEDER = Object.freeze({
  攻撃: (c) => (c.damage || 0) > 0 || ['stunTarget', 'oppGutsLoss', 'extraAttackTarget', 'gutsZeroBoth'].some((t) => cardHasEff(c, t)),
  守り: (c) => ['unstunTarget', 'revive'].some((t) => cardHasEff(c, t)),
  '引く・手札': (c) => ['draw', 'choose', 'refresh', 'rush', 'deckToGuts', 'gutsToDeckShuffle'].some((t) => cardHasEff(c, t)),
  回復: (c) => cardHasEff(c, 'heal'),
});
const CARD_TACTIC_DISRUPT = Object.freeze({
  手札を捨てさせる: ['discardOpp', 'peekPick', 'discardBothHands', 'oppHandToDeckBottom'], 山札を削る: ['millOpp', 'fieldMill'],
  ガッツを減らす: ['oppGutsLoss', 'gutsLossOnHit', 'gutsZeroBoth'], 番を飛ばす: ['skipTurn'],
});
const cardTacticAttackFits = (db, st, act, o) => {
  const me = st.players[st.active];
  const main = cardOf(db, me.hand[o.hand[0]]);
  if (!main) return false;
  const cards = o.hand.map((i) => cardOf(db, me.hand[i])).filter(Boolean);
  const v = act.v;
  switch (act.g) {
    case 'atk': return o.type === 'attack' || (o.type === 'breeder' && (main.damage || 0) > 0);
    case 'kind': return o.type === 'attack' && main.kind === { ちから: 'pow', かしこさ: 'int', 特殊: 'spe' }[v];
    case 'cost': { if (o.type !== 'attack') return false; const g = cardActionCost(db, st, st.active, me.hand, o.hand); return v.startsWith('軽い') ? g <= 1 : v.startsWith('中') ? g >= 2 && g <= 3 : g >= cardTacticBigCost; }
    case 'reach': return o.type === 'attack' && (v === '全体攻撃' ? cardHasEff(main, 'area') : !cardHasEff(main, 'area'));
    case 'eff': return cards.some((c) => (CARD_TACTIC_EFF[v] || []).some((t) => cardHasEff(c, t)));
    case 'attach': return o.hand.length > 1 && cards.slice(1).some((c) => cardHasEff(c, 'attach'));
    case 'breeder': return o.type === 'breeder' && main.kind !== 'fld' && !!CARD_TACTIC_BREEDER[v] && CARD_TACTIC_BREEDER[v](main);
    case 'fieldCard': return main.kind === 'fld';
    case 'disrupt': return cards.some((c) => (CARD_TACTIC_DISRUPT[v] || []).some((t) => cardHasEff(c, t)));
    case 'charge': return cards.some((c) => ['charge', 'rage', 'nextTurnMult'].some((t) => cardHasEff(c, t)));
    default: return false;
  }
};
// 標的が決まっているとき、その手がその子に向いているか(全体攻撃・狙いの無い手は、標的の子が相手の場にいれば向いているとみる)
const cardTacticAimsAt = (st, o, foes) => {
  if (!foes) return true;
  const op = cardOther(st.active);
  if (o.target && o.target.p === op) return foes.includes(o.target.m);
  if (Array.isArray(o.split)) return foes.some((j) => (o.split[j] || 0) > 0);
  return !o.target;
};
// 行の行動を1つ見る。{ act } … その手 / null … この行は出せる手が無い(次の行へ)
//   attack … mi が数ならその子の手だけ(モンスターの枠)。null ならブリーダーの手(ブリーダーの枠)
const cardTacticRowAct = (db, st, policy, phase, row, aim, ctx) => {
  const act = cardTacticOf(row.a);
  const p = phase === 'guard' ? st.pending.defender : st.active;
  if (act.phase !== 'all' && act.phase !== phase) return null;
  if (act.g === 'ace') {
    const aces = Array.isArray(policy.aces) ? policy.aces : [];
    if (!aces.length || phase !== 'attack') return null;
    const best = ctx.scored().find((x) => x.s > 0 && x.o.hand.some((i) => aces.includes(st.players[p].hand[i])) && cardTacticAimsAt(st, x.o, aim.foes));
    return best ? { act: cardAiFillBind(db, st, best.o, policy) } : null;
  }
  if (phase === 'attack') {
    if (act.g === 'stop') return { act: { type: 'endAttacks' } };
    const mine = (o) => (ctx.mi === null ? o.type === 'breeder' || (cardOf(db, st.players[p].hand[o.hand[0]]) || {}).kind === 'fld' : o.type === 'attack' && o.mon === ctx.mi);
    const best = ctx.scored().find((x) => x.s > 0 && mine(x.o) && cardTacticAttackFits(db, st, act, x.o) && cardTacticAimsAt(st, x.o, aim.foes));
    return best ? { act: cardAiFillBind(db, st, best.o, policy) } : null;
  }
  if (phase === 'guard') {
    const pd = st.pending;
    const tgt = pd.targets[pd.ti];
    if (aim.mine && !(tgt && tgt.p === p && aim.mine.includes(tgt.m))) return null; // 守る相手が決まっていて、狙われたのがその子でない
    const dmg = cardAiIncomingDamage(db, st);
    const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
    const kindOf = (o) => (cardOf(db, st.players[p].hand[o.hand]) || {}).kind;
    if (act.g === 'noGuard') return { act: { type: 'pass' } };
    if (act.g === 'guardOver' && dmg < act.v) return { act: { type: 'pass' } };
    if (act.g === 'guardDie' && !(target && target.life <= dmg)) return { act: { type: 'pass' } };
    const only = act.g === 'guardFirst' ? (o) => kindOf(o) === (act.v === '回避' ? 'dge' : 'blk')
      : act.g === 'cover' ? (o) => { const c = cardOf(db, st.players[p].hand[o.hand]); return !!c && ['cover', 'shield', 'redirect'].some((t) => cardHasEff(c, t)); }
        : null;
    const g = cardAiChooseGuard(db, st, policy, () => 0, { force: true, only });
    return g.type !== 'pass' ? { act: g } : null;
  }
  if (phase === 'guts') {
    if (act.g === 'save') return { act: cardAiChooseGuts(db, st, { ...policy, habit: { ...(policy.habit || {}), saveGuts: Math.max(1.6, (policy.habit || {}).saveGuts || 1) } }) };
    if (act.g === 'gutsN') return { act: cardAiChooseGuts(db, st, policy, { count: act.v }) };
    if (act.g === 'keepGuard') return { act: cardAiChooseGuts(db, st, policy, { keepGuards: true }) };
  }
  return null;
};

// 枠を順に見て、最初に当たった行の手を返す。{ act } … その手 / { policy } … 基本カードの型で、ふつうに打つ / null … 今のまま
//   攻撃の番: 左の子の枠 → 真ん中 → 右 → ブリーダーの枠 / 守るとき: 狙われた子の枠 / ガッツの番: ブリーダーの枠。どれにも当たらなければ基本カードの型
const cardTacticDecide = (db, st, policy) => {
  const frames = cardTacticNormalizeFrames(policy && policy.gambit);
  if (st.winner !== null) return null;
  const phase = st.pending ? 'guard' : st.phase === 'guts' ? 'guts' : st.phase === 'main' ? 'attack' : null;
  if (!phase) return null;
  const p = phase === 'guard' ? st.pending.defender : st.active;
  const habit = cardTacticHabitOf(frames.base, st, p);
  const pol = habit ? { ...policy, habit } : policy;
  let scored = null;
  const ctx = { mi: null, scored: () => { if (!scored) scored = cardAiAttackScored(db, st, cardAiAttackChoices(db, st, pol), pol); return scored; } };
  const order = [];
  if (phase === 'attack') { [0, 1, 2].forEach((mi) => order.push({ rows: frames.mons[mi], mi })); order.push({ rows: frames.breeder, mi: null }); }
  if (phase === 'guard') { const t = st.pending.targets[st.pending.ti]; if (t && t.p === p) order.push({ rows: frames.mons[t.m] || [], mi: t.m }); }
  if (phase === 'guts') order.push({ rows: frames.breeder, mi: null });
  for (const fr of order) {
    if (phase === 'attack' && fr.mi !== null && st.players[p].mons[fr.mi] && st.players[p].mons[fr.mi].ko) continue;
    for (const row of fr.rows) {
      if (!row.on) continue;
      const aim = cardTacticCond(db, st, p, cardTacticOf(row.c), row);
      if (!aim) continue;
      ctx.mi = fr.mi;
      const got = cardTacticRowAct(db, st, pol, phase, row, aim, ctx);
      if (got) return got;
    }
  }
  return habit ? { policy: pol } : null;
};
