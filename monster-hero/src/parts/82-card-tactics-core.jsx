// ===== MFバトルカード: 戦術カード(ガンビット型)の中身(純粋な計算) =====
// 2026-10-29 社長: 戦術カードは FF12 のガンビットの形。1行 = 「条件カード ▶ 行動カード」。上の行から順に見て、
//   条件に当たった行の行動をする(当たらなければ次の行)。どれにも当たらなければ基本カードの型で打つ。
//   カードは4つの山(246枚): 条件132(どの枠でも使う)・基本20(大まかな型。中身は docs/progress/card-deck-share/base-cards-20.md)・ブリーダー38・モンスター56。
//   N146・R86・SR14・はじめに配る10枚。段ごとに1枚(ライフ90%〜10%・ガッツ1〜7 など)
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
  { id: 'myHandLe', cat: 'cond', sec: 'ブリーダー向き', name: '自分の手札◯枚以下', tiers: [0, 1, 2].map((v) => [v, 'N']), desc: '自分の手札がその数以下' },
  { id: 'breederN', cat: 'cond', sec: 'ブリーダー向き', name: '手札にブリーダーのカード2枚以上', tiers: [['', 'R']], desc: 'ブリーダーのカードが2枚以上ある' },
  { id: 'breederUnused', cat: 'cond', sec: 'ブリーダー向き', name: 'この番まだブリーダーのカードを使っていない', tiers: [['', 'N']], desc: 'この番に、まだブリーダーのカードを出していない' },
  { id: 'myGutsLe', cat: 'cond', sec: 'ブリーダー向き', name: '自分のガッツ◯以下', tiers: [0, 1, 2, 3].map((v) => [v, 'N']), desc: '自分のガッツがその数以下' },
  { id: 'myDiscard', cat: 'cond', sec: 'ブリーダー向き', name: '捨て札◯枚以上', tiers: [[10, 'N'], [20, 'R']], desc: '自分の捨て札がその数以上' },
  { id: 'myKo', cat: 'cond', sec: 'ブリーダー向き', name: '倒れた味方がいる', tiers: [['', 'N']], desc: '自分の子が1体でも倒れている' },
  { id: 'noField', cat: 'cond', sec: 'ブリーダー向き', name: '場に全体カードが無い', tiers: [['', 'N']], desc: 'どちらの全体カードも場に無い' },
  { id: 'selfLife', cat: 'cond', sec: 'このモンスター', name: 'この子のライフ◯%以下', tiers: CARD_TACTIC_LIFE.map((v) => [v, cardTacticFine([80, 60, 40, 20])(v)]), desc: 'その枠の子のライフがその割合以下(モンスターの枠だけ)' },
  { id: 'selfFresh', cat: 'cond', sec: 'このモンスター', name: 'この子がまだ攻撃していない', tiers: [['', 'N']], desc: 'この番に、その枠の子がまだ攻撃していない' },
  { id: 'selfType', cat: 'cond', sec: 'このモンスター', name: 'この子が◯', tiers: [['地上', 'N'], ['空中', 'N'], ['水中', 'N']], desc: 'その枠の子のいまの特徴' },
  { id: 'selfStun', cat: 'cond', sec: 'このモンスター', name: 'この子が攻撃できない', tiers: [['', 'N']], desc: 'その枠の子が封じられている' },
  { id: 'selfAdv', cat: 'cond', sec: 'このモンスター', name: 'この子が有利な相手がいる', tiers: [['', 'R']], desc: 'その枠の子の手札の技が倍になる相手がいる(その相手を標的にする)' },
  { id: 'incoming', cat: 'cond', sec: '守るとき', name: '受けるダメージ◯以上', tiers: [[3, 'N'], [5, 'N'], [7, 'N'], [10, 'R']], desc: '受ける攻撃の見込みがその数以上(守るときだけ)' },
  { id: 'incomingKo', cat: 'cond', sec: '守るとき', name: '受けると倒れる', tiers: [['', 'N']], desc: '守らないと倒れる攻撃(守るときだけ)' },
  { id: 'incomingArea', cat: 'cond', sec: '守るとき', name: '全体攻撃を受けた', tiers: [['', 'R']], desc: '全員に当たる攻撃を受けている(守るときだけ)' },
  // ---------- 基本カード(大まかな型。基本の枠: メイン1・サブ2) ----------
  { id: 'tBalance', cat: 'base', sec: '基本', name: 'バランス型', tiers: [['', 'N']], start: [''], habit: 'kyuko', desc: 'くせの少ない打ち方(きゅこの型)' },
  { id: 'tAttack', cat: 'base', sec: '基本', name: '攻め型', tiers: [['', 'N']], habit: 'mua', knob: { guardDieOnly: true }, desc: 'ためずに攻める(みゅあの型)' },
  { id: 'tGuard', cat: 'base', sec: '基本', name: '守り型', tiers: [['', 'N']], habit: 'dra', knob: { guardAll: true }, desc: '守り札を残して堅く守る(ドラの型)' },
  { id: 'tSave', cat: 'base', sec: '基本', name: '溜め型', tiers: [['', 'N']], habit: 'kiki', desc: 'ガッツをためて大技(ききの型)' },
  { id: 'tDisrupt', cat: 'base', sec: '基本', name: '崩し型', tiers: [['', 'N']], habit: 'momosuke', desc: '相手の手を崩す(ももすけの型)' },
  { id: 'tBig', cat: 'base', sec: '基本', name: '大技型', tiers: [['', 'R']], mul: { big: 1.6 }, desc: 'ダメージの大きい技を選ぶ' },
  { id: 'tArea', cat: 'base', sec: '基本', name: '全体型', tiers: [['', 'R']], mul: { area: 1.6 }, knob: { areaMin2: true }, desc: '全体攻撃・全体カードを選ぶ' },
  { id: 'tFinish', cat: 'base', sec: '基本', name: '仕留め型', tiers: [['', 'R']], mul: { finish: 1.6 }, desc: 'あと少しで倒せる子を先に狙う' },
  { id: 'tRush', cat: 'base', sec: '基本', name: '速攻型', tiers: [['', 'R']], mul: { attack: 1.6, big: 0.7 }, knob: { light: true }, desc: '軽い技で手数を出す' },
  { id: 'tSteady', cat: 'base', sec: '基本', name: '堅実型', tiers: [['', 'R']], mul: { keepGuard: 1.3, saveGuts: 1.3, attack: 0.8 }, knob: { safe: true }, desc: '守りとガッツを残して、無理をしない' },
  { id: 'tJam', cat: 'base', sec: '基本', name: 'かく乱守り型', tiers: [['', 'R']], mul: { disrupt: 1.3, keepGuard: 1.3 }, desc: '崩しながら守る' },
  { id: 'tCalm', cat: 'base', sec: '基本', name: '慎重型', tiers: [['', 'R']], calm: true, desc: '極端な打ち方をせず、損得で冷静に打つ(ほかの型の効きを半分に)' },
  { id: 'tFlex', cat: 'base', sec: '基本', name: '臨機応変型', tiers: [['', 'SR']], habit: 'atsu', desc: '場を見て、とどめ・全体・守り・攻めを切り替える(あつの型)' },
  { id: 'tMill', cat: 'base', sec: '基本', name: '持久型', tiers: [['', 'SR']], habit: 'sorashido', desc: '長引かせて、相手の山札切れで勝つ(ソラシドの型)' },
  { id: 'tReckless', cat: 'base', sec: '基本', name: '捨て身型', tiers: [['', 'SR']], mul: { keepGuard: 0.5, finish: 1.3 }, knob: { noGuardUnlessFinish: true }, desc: '守らずに受けて、そのぶん倒しに行く' },
  { id: 'tHand', cat: 'base', sec: '基本', name: '手札温存型', tiers: [['', 'R']], knob: { keepHand: 2 }, desc: '手札を2枚以上残して、次の番に備える' },
  { id: 'tDeck', cat: 'base', sec: '基本', name: '山札節約型', tiers: [['', 'R']], knob: { noDraw: true }, desc: '引く札・山札を減らす札を控え、山札を切らさない' },
  { id: 'tFocus', cat: 'base', sec: '基本', name: '一点集中型', tiers: [['', 'R']], knob: { focus: true }, desc: '同じ相手を倒れるまで狙い続ける' },
  { id: 'tSpread', cat: 'base', sec: '基本', name: '分散型', tiers: [['', 'SR']], mul: { area: 1.4 }, knob: { spread: true }, desc: '全員を少しずつ削り、最後にまとめて倒す' },
  { id: 'tComeback', cat: 'base', sec: '基本', name: '逆転型', tiers: [['', 'SR']], knob: { comeback: true }, desc: '勝っているあいだは堅く、負けたら捨て身で攻める' },
  // ---------- 行動(ブリーダーカード・モンスターカード) ----------
  { id: 'atk', cat: 'monster', sec: '攻撃', phase: 'attack', name: '攻める', tiers: [['', 'N']], start: [''], desc: '点数がいちばん高い攻撃' },
  { id: 'kind', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯の技を出す', tiers: [['ちから', 'N'], ['かしこさ', 'N'], ['特殊', 'N']], desc: 'その種類の技を出す' },
  { id: 'cost', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['軽い技(ガッツ0〜1)', 'N'], ['中くらいの技(2〜3)', 'N'], ['大技(4以上)', 'N']], start: ['大技(4以上)'], desc: '払うガッツで選ぶ' },
  { id: 'reach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '◯を出す', tiers: [['全体攻撃', 'R'], ['単体攻撃', 'N']], desc: '全員に当たる技か、1体に当てる技か' },
  { id: 'eff', cat: 'monster', sec: '攻撃', phase: 'attack', name: '「◯」の技を出す', tiers: [['回避されない', 'N'], ['攻撃できなくする', 'R'], ['ガッツを減らす', 'N'], ['吸い取る', 'N'], ['2回攻撃', 'R'], ['防御で減らない', 'N'], ['回避されても半分', 'N'], ['種族に強い', 'N'], ['ダメージを割り振る', 'R'], ['2枚同時', 'N'], ['手札に戻る', 'N'], ['カード投げ', 'SR']], desc: 'その効き目のついた技を出す' },
  { id: 'attach', cat: 'monster', sec: '攻撃', phase: 'attack', name: '付ける札を使う', tiers: [['', 'R']], desc: '技に付ける札をいっしょに出す' },
  { id: 'attachKind', cat: 'monster', sec: '攻撃', phase: 'attack', name: '付ける札: ◯', tiers: [['ダメージを上げる', 'N'], ['回避させない', 'R'], ['ガッツを軽くする', 'N']], desc: 'その効き目の付ける札を、技にいっしょに出す' },
  { id: 'spe', cat: 'monster', sec: '特殊技', phase: 'attack', name: '特殊技: ◯', tiers: [['味方を回復', 'N'], ['引く', 'N'], ['空中になる', 'N'], ['安全になる', 'R'], ['まゆと羽化', 'R'], ['のりうつる', 'SR']], desc: 'その効き目の特殊技を出す' },
  { id: 'stance', cat: 'monster', sec: '立ち回り', phase: 'attack', name: '立ち回り: ◯', tiers: [['この子から攻める', 'N'], ['この子は攻撃しない', 'N'], ['ライフの多い子が先に', 'R'], ['ライフの少ない子は温存', 'R'], ['攻撃は1回だけ', 'N'], ['何回でも攻める', 'SR']], desc: 'その子の前に出る・下がるを決める' },
  { id: 'bEff', cat: 'breeder', sec: 'ブリーダーのカード', phase: 'attack', name: 'ブリーダー: ◯', tiers: [['回復する', 'N'], ['倒れた子を戻す', 'R'], ['攻撃できないを消す', 'N'], ['相手を攻撃できなくする', 'R'], ['相手のガッツを減らす', 'N'], ['両方のガッツを0にする', 'SR'],
    ['山札からガッツへ', 'N'], ['カードを引く', 'N'], ['捨て札から拾う', 'N'], ['手札を引き直す', 'N'], ['もう1回攻撃させる', 'R'], ['合体する', 'SR'], ['付ける札をただにする', 'N'], ['守りを名指しで封じる', 'R'], ['捨て札を山札に戻す', 'N'], ['小さく攻撃する', 'N']], desc: 'その効き目のブリーダーのカードを出す' },
  { id: 'fieldCard', cat: 'breeder', sec: 'ブリーダー', phase: 'attack', name: '全体カードを出す', tiers: [['', 'R']], desc: '場に残る全体カードを出す' },
  { id: 'fieldKind', cat: 'breeder', sec: '全体カード', phase: 'attack', name: '全体カード: ◯', tiers: [['ダメージを足す', 'N'], ['払うガッツを変える', 'N'], ['大きいダメージを封じる', 'R'], ['山札を削る', 'N'], ['純血のプライド', 'N'], ['技の種類を封じる', 'SR'],
    ['持ちょうを変える', 'R'], ['じわじわ減らす', 'N'], ['ガッツの上限', 'N'], ['出すと引く', 'N']], desc: 'その種類の全体カードを場に出す' },
  { id: 'disrupt', cat: 'monster', sec: '崩す', phase: 'attack', name: '崩し: ◯', tiers: [['手札を捨てさせる', 'R'], ['山札を削る', 'R'], ['ガッツを減らす', 'R'], ['番を飛ばす', 'SR']], desc: '相手の手を崩す札を出す' },
  { id: 'guard', cat: 'monster', sec: '守り', phase: 'guard', name: '守る', tiers: [['', 'N']], start: [''], desc: '攻撃を受けたら守り札で守る' },
  { id: 'guardFirst', cat: 'monster', sec: '守り', phase: 'guard', name: '◯を先に使う', tiers: [['回避', 'N'], ['防御', 'N'], ['はね返す守り', 'R'], ['半分にする守り', 'R']], desc: '守るとき、その種類の札で守る' },
  { id: 'guardOver', cat: 'monster', sec: '守り', phase: 'guard', name: 'ダメージ◯以上だけ守る', tiers: [[3, 'N'], [5, 'N'], [7, 'R'], [10, 'R']], desc: 'その数より小さい攻撃は守らない' },
  { id: 'guardDie', cat: 'monster', sec: '守り', phase: 'guard', name: '倒されるときだけ守る', tiers: [['', 'R']], desc: '受けたら倒れるときだけ守る' },
  { id: 'cover', cat: 'monster', sec: '守り', phase: 'guard', name: '味方をかばう', tiers: [['', 'R']], desc: 'かばう札で、味方への攻撃を受ける' },
  { id: 'noGuard', cat: 'monster', sec: '守り', phase: 'guard', name: '守らない', tiers: [['', 'R']], desc: '守り札を使わず受ける(札を残す)' },
  { id: 'save', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツをためる', tiers: [['', 'N']], start: [''], desc: '手札を多めにガッツへ回す' },
  { id: 'gutsN', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: 'ガッツを◯枚だけ置く', tiers: [[0, 'N'], [1, 'N'], [2, 'N'], [3, 'N']], desc: 'ガッツの番に置く数を決める' },
  { id: 'keepGuard', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: '守り札を残して置く', tiers: [['', 'R']], desc: '回避・防御はガッツにしない' },
  { id: 'gutsOrder', cat: 'breeder', sec: 'ガッツ', phase: 'guts', name: '◯から置く', tiers: [['重い札', 'N'], ['使えない札', 'N']], desc: 'ガッツにする札の順を決める' },
  { id: 'stop', cat: 'breeder', sec: '流れ', phase: 'attack', name: '攻撃を止める', tiers: [['', 'N']], start: [''], desc: 'この番の攻撃をここで終える' },
  { id: 'charge', cat: 'monster', sec: '流れ', phase: 'attack', name: '溜め技を使う', tiers: [['', 'R']], desc: '次の技を何倍にする札を先に使う' },
  { id: 'chargeKind', cat: 'monster', sec: '流れ', phase: 'attack', name: '溜め: ◯', tiers: [['怒り', 'R'], ['次の番の技を倍', 'R']], desc: 'その溜めの札を先に使う' },
  { id: 'ace', cat: 'breeder', sec: '特別', phase: 'attack', name: '切り札を出す', tiers: [['', 'SR']], desc: '登録した切り札を、手にあれば先に出す' },
  { id: 'holdBreeder', cat: 'breeder', sec: '流れ', phase: 'attack', name: 'ブリーダーのカードを温存する', tiers: [['', 'N']], desc: 'この番はブリーダーのカードを出さない(当たればそれ以外で打つ)' },
]);
// 名前と効果の文(2026-10-30 社長「そもそも戦術カードの効果がわからない。カード名と効果を明確化して」→ 246枚の一覧に「この形で」)。
//   効果は、このファイルの判定(cardTacticCond・cardTacticAttackFits・cardTacticRowAct・cardTacticHabitOf/KnobsOf)の動きどおりに書く。
//   判定を変えたら、ここの文も必ず合わせる。カードの id(保存に書く)は変えない。種類ごとに (段) => [名前, 効果]
const CARD_TACTIC_TEXT = Object.freeze({
// ---- 条件(〜なら) ----
any:()=>['いつでも','いつでも当てはまる。組み合わせた手を、出せるときはいつも出す'],
ko:()=>['倒せる相手がいる','手札の攻撃の技(特殊技は除く)で、いまのガッツで出せて、ダメージが残りライフ以上になる相手のモンスターがいるとき。その相手を狙う'],
lowest:()=>['ライフがいちばん少ない相手','相手の場で、残りライフ(数)がいちばん少ない相手を狙う'],
highest:()=>['ライフがいちばん多い相手','相手の場で、残りライフ(数)がいちばん多い相手を狙う'],
strongest:()=>['攻撃がいちばん強い相手','相手のモンスターのうち、使える技の最大ダメージがいちばん大きい相手を狙う(手札は見ない)'],
attacker:()=>['前のターンに攻撃してきた相手','直前の相手のターンに攻撃してきた相手のモンスターを狙う'],
leader:()=>['相手のリーダー','相手が1体目(左)に置いたモンスターが残っていれば、それを狙う'],
type:(v)=>[`${v}の相手`,`いま${v}にいる相手のモンスターを狙う`],
blood:(v)=>[`${v}の相手`,`${v}のモンスターの相手を狙う`],
species:()=>['決めた種族の相手','組むときに選んだ種族の相手のモンスター(混血はもとの種族でも当たる)を狙う'],
foeLife:(v)=>[`相手のライフ${v}%以下`,`残りライフが最大の${v}%以下になっている相手のモンスターがいるとき。その相手を狙う`],
myLife:(v)=>[`味方のライフ${v}%以下`,`残りライフが最大の${v}%以下の自分のモンスターがいるとき。守る手と組むと、そのモンスターが狙われたときだけ守る`],
myGuts:(v)=>[`自分のガッツ${v}以上`,`自分のガッツが${v}以上のとき`],
foeGutsLe:(v)=>[`相手のガッツ${v}以下`,`相手のガッツが${v}以下のとき`],
foeGutsGe:(v)=>[`相手のガッツ${v}以上`,`相手のガッツが${v}以上のとき(大技に備える)`],
myHand:(v)=>[`自分の手札${v}枚以上`,`自分の手札が${v}枚以上のとき`],
foeHandGe:(v)=>[`相手の手札${v}枚以上`,`相手の手札が${v}枚以上のとき`],
foeHandLe:(v)=>[`相手の手札${v}枚以下`,`相手の手札が${v}枚以下のとき`],
myDeck:(v)=>[`自分の山札${v}枚以下`,`自分の山札の残りが${v}枚以下のとき`],
foeDeck:(v)=>[`相手の山札${v}枚以下`,`相手の山札の残りが${v}枚以下のとき`],
guardN:(v)=>[`手札に守り札${v}枚以上`,`手札に回避・防御の札が合わせて${v}枚以上あるとき`],
guardKind:(v)=>[`手札に${v}の札がある`,`手札に${v}の札が1枚以上あるとき`],
bigInHand:()=>['手札に大技がある','手札に、払うガッツが4以上の攻撃の札があるとき'],
areaInHand:()=>['手札に全体攻撃がある','手札に、相手の全員に当たる攻撃の札があるとき'],
breederInHand:()=>['手札にブリーダーのカードがある','手札にブリーダーのカードが1枚以上あるとき'],
turnLe:(v)=>[`自分の${v}ターン目まで`,`自分のターンが${v}回目までのとき(自分のはじめのターンが1回目)`],
turnGe:(v)=>[`自分の${v}ターン目から`,`自分のターンが${v}回目以降のとき`],
myAlive:(v)=>[`味方が残り${v}体`,`倒れていない自分のモンスターがちょうど${v}体のとき`],
foeAlive:(v)=>[`相手が残り${v}体`,`倒れていない相手のモンスターがちょうど${v}体のとき`],
koDiff:(v)=>[v==='勝っ'?'倒した数で勝っている':'倒した数で負けている',v==='勝っ'?'倒した相手の数が、倒された味方の数より多いとき':'倒された味方の数が、倒した相手の数より多いとき'],
foeStun:()=>['攻撃できない相手','封じられていて、相手の次のターンに攻撃できない相手のモンスターを狙う'],
myStun:()=>['攻撃できない味方がいる','封じられて攻撃できない自分のモンスターがいるとき'],
foeCharge:()=>['溜めている相手','溜め技を使って、次の技のダメージが何倍にもなる相手のモンスターを狙う'],
foeAir:()=>['空中に上がった相手','もとは地上・水中なのに、いま空中になっている相手のモンスターを狙う'],
field:(v)=>[`場に${v}全体カードがある`,`場に、${v==='自分の'?'自分':'相手'}が出した全体カードが残っているとき`],
foeBig:()=>['相手が大技を撃てそう','相手のガッツが4以上で手札があり、相手のモンスターが使える大技(払うガッツ4以上)をいまのガッツ+1で払えるとき'],
myHandLe:(v)=>[`自分の手札${v}枚以下`,`自分の手札が${v}枚以下のとき`],
breederN:()=>['手札にブリーダーのカード2枚以上','手札にブリーダーのカードが2枚以上あるとき'],
breederUnused:()=>['このターンまだブリーダーのカードを出していない','このターンに、まだブリーダーのカードを出していないとき'],
myGutsLe:(v)=>[`自分のガッツ${v}以下`,`自分のガッツが${v}以下のとき`],
myDiscard:(v)=>[`自分の捨て札${v}枚以上`,`自分の捨て札が${v}枚以上のとき`],
myKo:()=>['倒れた味方がいる','自分のモンスターが1体でも倒れているとき'],
noField:()=>['場に全体カードが無い','どちらの全体カードも場に無いとき'],
selfLife:(v)=>[`このモンスターのライフ${v}%以下`,`このカードを入れたモンスターの残りライフが最大の${v}%以下のとき(モンスターの手に入れたときだけ当たる)`],
selfFresh:()=>['このモンスターがこのターンまだ攻撃していない','このカードを入れたモンスターが、このターンにまだ攻撃していないとき(モンスターの手だけ)'],
selfType:(v)=>[`このモンスターがいま${v}`,`このカードを入れたモンスターが、いま${v}にいるとき(モンスターの手だけ)`],
selfStun:()=>['このモンスターが攻撃できない','このカードを入れたモンスターが封じられて攻撃できないとき(モンスターの手だけ)'],
selfAdv:()=>['このモンスターが得意な相手','このカードを入れたモンスターが出せる手札の技に、相手の特徴(地上・空中・水中)でダメージが倍になるものがあるとき。その相手を狙う(モンスターの手だけ)'],
incoming:(v)=>[`受けるダメージ${v}以上`,`攻撃を受けたとき、受けるダメージの見込みが${v}以上なら(守るときだけ見る)`],
incomingKo:()=>['受けると倒れる','攻撃を受けたとき、守らないと倒れるなら(守るときだけ見る)'],
incomingArea:()=>['全体攻撃を受けた','受けた攻撃が、全員に当たる攻撃なら(守るときだけ見る)'],
// ---- 基本カード(どの手にも当てはまらないときの打ち方) ----
tBalance:()=>['バランス型','攻め・守り・ガッツ・大技・崩し・全体を同じくらいに見て、損得のいちばん良い手を打つ。とどめだけ少し優先'],
tAttack:()=>['攻め型','攻撃を多めに出し(1.5倍重く)、ガッツはためず守り札も残さない。守るのは、受けると倒れるときだけ'],
tGuard:()=>['守り型','守り札を残す(1.5倍重く)・攻撃は控えめ(0.7倍)。攻撃を受けたら、守れるときはいつも守る'],
tSave:()=>['溜め型','ガッツを多めにためて(1.6倍)、大技を優先する(1.8倍)'],
tDisrupt:()=>['崩し型','相手の手札・山札・ガッツを減らす札を優先する(1.8倍)'],
tBig:()=>['大技型','ダメージの大きい技を優先する(1.6倍)'],
tArea:()=>['全体型','全員に当たる攻撃・全体カードを優先する(1.6倍)。相手が1体だけのときは全体攻撃を出さない'],
tFinish:()=>['仕留め型','あと少しで倒せる相手への攻撃を優先する(1.6倍)'],
tRush:()=>['速攻型','攻撃を多めに(1.6倍)・大技は控えめ(0.7倍)。払うガッツが2以上の技は出さない。守るときもガッツ1以下の守り札だけ使う'],
tSteady:()=>['堅実型','守り札とガッツを残し(1.3倍)、攻撃は控えめ(0.8倍)。自分も傷つく技は出さない'],
tJam:()=>['かく乱守り型','崩す札(1.3倍)と、守り札を残すこと(1.3倍)を両方重くする'],
tCalm:()=>['慎重型','いっしょに入れた基本カードの重みを半分に弱めて、極端な打ち方をしない'],
tFlex:()=>['臨機応変型','ターンごとに場を見て、とどめ・全体攻撃・守り・攻めのどれか1つを強くする'],
tMill:()=>['持久型','相手の山札を削る・相手に引かせる・ガッツを山札へ戻す札を重くして、相手の山札切れで勝ちを狙う'],
tReckless:()=>['捨て身型','守り札を残さず(0.5倍)、とどめを優先(1.3倍)。受けると倒れるとき以外は守らない'],
tHand:()=>['手札温存型','出したあとに手札が2枚以上残る手だけを出す。ガッツを置くときも手札を2枚残して置く'],
tDeck:()=>['山札節約型','カードを引く・山札からガッツへ・手札を引き直す・相手に引かせる札は出さない'],
tFocus:()=>['一点集中型','ライフの割合がいちばん低い相手への攻撃を優先して、倒れるまで同じ相手を狙う'],
tSpread:()=>['分散型','全体攻撃を重くし(1.4倍)、ライフがいちばん多い相手への攻撃を優先する'],
tComeback:()=>['逆転型','倒された数で負けている、または味方のライフの合計が半分以下なら捨て身(守り0.5倍・とどめ・大技・全体1.3倍)。それ以外は堅く(守り・ガッツ1.2倍)'],
// ---- モンスターカード(この子の手) ----
atk:()=>['いちばん得な攻撃','このモンスターが出せる攻撃のうち、点数(ダメージ・とどめ・ガッツの損得)がいちばん高い手を出す'],
kind:(v)=>[`${v}の技で攻撃`,`このモンスターの${v}の技のうち、点数がいちばん高い手を出す`],
cost:(v)=>{const n=v.startsWith('軽い')?'0〜1':v.startsWith('中')?'2〜3':'4以上';const nm=v.startsWith('軽い')?'軽い技':v.startsWith('中')?'中くらいの技':'大技';return [`${nm}で攻撃`,`このモンスターの技のうち、払うガッツが${n}の技で、点数がいちばん高い手を出す`];},
reach:(v)=>[v==='全体攻撃'?'全体攻撃で攻撃':'1体だけに攻撃',v==='全体攻撃'?'このモンスターの、相手の全員に当たる技のうち、点数がいちばん高い手を出す':'このモンスターの、1体だけに当てる技のうち、点数がいちばん高い手を出す'],
eff:(v)=>{const d={回避されない:'相手が回避できない技',攻撃できなくする:'当たると相手を攻撃できなくする技',ガッツを減らす:'当たると相手のガッツを減らす技',吸い取る:'相手のライフを吸い取って回復する技','2回攻撃':'もう1回攻撃できるようになる技',防御で減らない:'防御されてもダメージが減らない技',回避されても半分:'回避されても半分のダメージが入る技',種族に強い:'特定の特徴の相手に倍のダメージの技',ダメージを割り振る:'ダメージを相手の何体かに割り振る技','2枚同時':'2枚組でいっしょに出す技',手札に戻る:'当たると手札に戻ってくる技',カード投げ:'カードを投げてダメージを足す技'}[v];return [`「${v}」の技で攻撃`,`このモンスターの、${d}のうち、点数がいちばん高い手を出す`];},
attach:()=>['付ける札といっしょに攻撃','技に付ける札をいっしょに出す手のうち、点数がいちばん高い手を出す'],
attachKind:(v)=>[`付ける札(${v})といっしょに攻撃`,`「${v}」付ける札をいっしょに出す手のうち、点数がいちばん高い手を出す`],
spe:(v)=>{const d={味方を回復:'味方のライフを回復する',引く:'カードを引く',空中になる:'空中に上がる',安全になる:'次の攻撃を受けなくなる',まゆと羽化:'まゆになる・羽化する',のりうつる:'相手にのりうつる'}[v];return [`特殊技で${d}`,`このモンスターの特殊技のうち、${d}技を出す`];},
stance:(v)=>({この子から攻める:['このモンスターが攻める','当てはまったら、このモンスターの攻撃で点数がいちばん高い手を出す'],この子は攻撃しない:['このモンスターは攻撃しない','当てはまったら、このターンはこのモンスターに攻撃させない(このあとの手・基本カードの打ち方でも出さない)'],ライフの多い子が先に:['いちばん元気なら攻める','このモンスターが味方でいちばんライフが多いときだけ、このモンスターの攻撃で点数がいちばん高い手を出す'],ライフの少ない子は温存:['いちばん弱っていたら休む','味方が2体以上いて、このモンスターのライフがいちばん少ないとき、このターンは攻撃させない'],攻撃は1回だけ:['攻撃は1回だけ','このターンにまだ攻撃していなければ攻撃する。1回攻撃したら、このターンはもう攻撃させない'],何回でも攻める:['何回でも攻める','点数が少し低い手でも攻撃を出して、このモンスターの攻撃を続ける']})[v],
disrupt:(v)=>({手札を捨てさせる:['相手の手札を捨てさせる','相手の手札を捨てさせる・山札の下へ戻す札を含む手を出す'],山札を削る:['相手の山札を削る','相手の山札を削る札を含む手を出す'],ガッツを減らす:['相手のガッツを減らす','相手のガッツを減らす・0にする札を含む手を出す'],番を飛ばす:['相手のターンを飛ばす','相手の次のターンを飛ばす札を含む手を出す']})[v],
guard:()=>['守る','このモンスターが攻撃を受けたら、手札の守り札でいちばん良い守り方をする'],
guardFirst:(v)=>[`${v}で守る`,`このモンスターが攻撃を受けたら、${v==='回避'||v==='防御'?v+'の札':'「'+v+'」の札'}だけで守る(無ければ次の手を見る)`],
guardOver:(v)=>[`ダメージ${v}以上だけ守る`,`このモンスターが攻撃を受けたとき、受けるダメージの見込みが${v}より小さければ守らずに受ける。${v}以上なら守る`],
guardDie:()=>['倒れるときだけ守る','このモンスターが攻撃を受けたとき、受けても倒れなければ守らずに受ける。倒れるときだけ守る'],
cover:()=>['かばう札で守る','このモンスターが攻撃を受けたら、かばう・身代わりの札で守る'],
noGuard:()=>['守らない','このモンスターが攻撃を受けても、守り札を使わずに受ける(札を残す)'],
charge:()=>['溜め技を使う','次の技のダメージを何倍にする札(溜め・怒り・次のターンの技を倍)を含む手を出す'],
chargeKind:(v)=>((w)=>[`溜め(${w})を使う`,`「${w}」の溜めの札を含む手を出す`])(v==='次の番の技を倍'?'次のターンの技を倍':v), // 段の値(保存に書く)は「次の番の技を倍」のまま。見せる言葉だけ「ターン」(2026-10-30 社長)
// ---- ブリーダーカード ----
bEff:(v)=>{const d={回復する:'味方を回復する',倒れた子を戻す:'倒れたモンスターを場に戻す',攻撃できないを消す:'味方の「攻撃できない」を消す',相手を攻撃できなくする:'相手のモンスターを攻撃できなくする',相手のガッツを減らす:'相手のガッツを減らす',両方のガッツを0にする:'両方のガッツを0にする',山札からガッツへ:'山札からガッツを増やす',カードを引く:'カードを引く',捨て札から拾う:'捨て札からカードを拾う',手札を引き直す:'手札を引き直す',もう1回攻撃させる:'味方にもう1回攻撃させる',合体する:'モンスターを合体させる',付ける札をただにする:'付ける札の払うガッツを0にする',守りを名指しで封じる:'相手の守りを名指しで封じる',捨て札を山札に戻す:'ガッツを山札に戻して切り直す',小さく攻撃する:'ダメージのあるブリーダーのカードで攻撃する'}[v];return [`ブリーダー: ${d}`,`手札のブリーダーのカードのうち、${d}カードを出す`];},
fieldCard:()=>['全体カードを出す','手札の全体カード(場に残るカード)を出す'],
fieldKind:(v)=>[`全体カード: ${v}`,`手札の全体カードのうち、「${v}」の全体カードを場に出す`],
save:()=>['ガッツを多めにためる','ガッツを置くときに、ふだんより多くの手札をガッツに置く'],
gutsN:(v)=>[`ガッツを${v}枚置く`,`ガッツを置くときに、手札から${v}枚だけガッツに置く`],
keepGuard:()=>['守り札は置かない','ガッツを置くときに、回避・防御の札はガッツに置かない'],
gutsOrder:(v)=>[v==='重い札'?'重い札からガッツに置く':'使えない札からガッツに置く',v==='重い札'?'ガッツに置く枚数はふだんどおり。払うガッツの大きい札から先に置く':'ガッツに置く枚数はふだんどおり。場のモンスターが使えない札から先に置く'],
stop:()=>['このターンの攻撃をやめる','当てはまったら、このターンの攻撃をここで終える'],
ace:()=>['切り札を出す','登録で選んだ切り札が手札にあれば、それを含む手を先に出す'],
holdBreeder:()=>['ブリーダーのカードを温存','当てはまったら、このターンはブリーダーのカード(全体カードも)を出さない。ほかの手はそのまま'],
});
const cardTacticTextOf = (g, v) => {
  const t = CARD_TACTIC_TEXT[g.id] ? CARD_TACTIC_TEXT[g.id](v) : null;
  return t ? { name: t[0], desc: t[1] } : { name: v === '' ? g.name : g.name.replace('◯', String(v)), desc: g.desc };
};
// カードのid は「種類.段」(段の無いカードは種類だけ)。保存(mh_card_tactics_v1)にこのまま書くので、変えない
const cardTacticCardId = (g, v) => (v === '' ? g.id : `${g.id}.${v}`);
const CARD_TACTIC_CARDS = Object.freeze(CARD_TACTIC_GROUPS.flatMap((g) => g.tiers.map(([v, r]) => Object.freeze({
  id: cardTacticCardId(g, v), g: g.id, cat: g.cat, sec: g.sec, phase: g.phase || null, v,
  ...cardTacticTextOf(g, v), r, start: (g.start || []).includes(v),
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

// ---- 賢さ(2026-10-29 社長の物差し)----
// 基本カードの枚数が上限、ON の行の数でそこまで上がる。1枚 … EASY/NORMAL/HARD、2枚 … NORMAL/HARD/EXPERT、3枚 … HARD/EXPERT/MASTER
//   行 0〜3 / 4〜9 / 10以上。基本カードも行も無ければ 'random'(出せる手からランダム)。基本カード無しで行だけなら EASY
const CARD_TACTIC_SMART = Object.freeze(['easy', 'normal', 'hard', 'expert', 'master']);
// ---- 賢さに数えないセット(2026-10-29 社長 案A「ちゃんと効くカードだけ数える」) ----
//   ・場面が合わない … 守るときだけの条件(受けるダメージ・受けると倒れる・全体攻撃を受けた)を守り以外の手と組んだ /
//                    「この子の◯◯」の条件をブリーダーの枠に入れた(その子がいないので当たらない)
//   ・同じもの … 同じ条件と手(と種族)の組み合わせは、いくつセットしても1つと数える(3体の枠へのコピーも)
//   ・ほとんど当たらない … 試合で当たる割合が2%に届かない条件(助手どうし42試合で測った。2026-10-29 ルールくん)。
//                        全体カード・有利な相手のように、自分のデッキ次第で当たり方が変わる条件は入れない
const CARD_TACTIC_GUARD_ONLY_CONDS = Object.freeze(['incoming', 'incomingKo', 'incomingArea']);
const CARD_TACTIC_SELF_CONDS = Object.freeze(['selfLife', 'selfFresh', 'selfType', 'selfStun', 'selfAdv']);
const CARD_TACTIC_RARE_CONDS = Object.freeze(['turnGe.15', 'myLife.10', 'foeLife.10', 'selfLife.10', 'selfStun', 'myStun', 'foeStun', 'foeCharge', 'foeAir', 'incomingArea']);
// 枠ごとのセットに、数えない理由を付ける(数えるものは null)。{ breeder:[理由|null], mons:[[理由|null]×行]×3 }。組む画面の小さい文字にも使う
const cardTacticUncounted = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const seen = new Set();
  const why = (row, where) => {
    if (!row.on) return null;
    const c = cardTacticOf(row.c), a = cardTacticOf(row.a);
    if (!c || !a) return '場面が合わない';
    if (CARD_TACTIC_GUARD_ONLY_CONDS.includes(c.g) && a.phase !== 'guard') return '場面が合わない';
    if (where === 'breeder' && CARD_TACTIC_SELF_CONDS.includes(c.g)) return '場面が合わない';
    if (CARD_TACTIC_RARE_CONDS.includes(c.id)) return 'ほとんど当たらない';
    const key = `${row.c}|${row.a}|${row.sp || ''}`;
    if (seen.has(key)) return '同じものが入っている';
    seen.add(key);
    return null;
  };
  return { breeder: f.breeder.map((r) => why(r, 'breeder')), mons: f.mons.map((rows) => rows.map((r) => why(r, 'mon'))) };
};
// 賢さに数えるセットの数(ON で、数えない理由が無いもの)
const cardTacticCountedRows = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const u = cardTacticUncounted(f);
  return f.breeder.filter((r, i) => r.on && !u.breeder[i]).length + f.mons.reduce((a, rows, mi) => a + rows.filter((r, i) => r.on && !u.mons[mi][i]).length, 0);
};
const cardTacticSmartLevel = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const base = f.base.filter(Boolean).length;
  const rows = cardTacticCountedRows(f);
  // でたらめ(出せる手からランダム)は、何もセットしていないときだけ(数えないセットだけでも、でたらめにはしない)
  const any = f.breeder.some((x) => x.on) || f.mons.some((r) => r.some((x) => x.on));
  if (!base && !any) return 'random';
  if (!base) return 'easy';
  return CARD_TACTIC_SMART[(base - 1) + (rows >= 10 ? 2 : rows >= 4 ? 1 : 0)];
};
// みんなのデッキの登録に載せる短い形(表の tactics は 2000 バイトまで)。{ b:[基本], r:[[c,a,on,sp?]], m:[[[…]]×3] }
const cardTacticPackFrames = (frames) => {
  const f = cardTacticNormalizeFrames(frames);
  const row = (x) => (x.sp ? [x.c, x.a, x.on ? 1 : 0, x.sp] : [x.c, x.a, x.on ? 1 : 0]);
  return { b: f.base, r: f.breeder.map(row), m: f.mons.map((rows) => rows.map(row)) };
};
const cardTacticUnpackFrames = (v) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const row = (x) => (Array.isArray(x) ? { c: x[0], a: x[1], on: x[2] !== 0, ...(typeof x[3] === 'string' ? { sp: x[3] } : {}) } : null);
  return cardTacticNormalizeFrames({ base: r.b, breeder: (Array.isArray(r.r) ? r.r : []).map(row), mons: (Array.isArray(r.m) ? r.m : []).map((rows) => (Array.isArray(rows) ? rows.map(row) : [])) });
};
// 何も入れていないデッキ(賢さ 'random'): 出せる手からランダム(社長「設定しないとめちゃくちゃ弱い」)
const cardTacticRandomAct = (db, st, policy, rand = Math.random) => {
  if (st.pending) return rand() < 0.5 ? { type: 'pass' } : cardAiChooseGuard(db, st, policy, rand, { force: true, only: () => rand() < 0.5 });
  if (st.phase === 'guts') { const hand = st.players[st.active].hand; return { type: 'guts', hand: hand.map((_, i) => i).filter(() => rand() < 0.4).slice(0, cardAiGutsCap(st.players[st.active])) }; }
  const opts = cardAiAttackChoices(db, st, policy);
  if (!opts.length || rand() < 0.2) return { type: 'endAttacks' };
  return cardAiFillBind(db, st, opts[Math.floor(rand() * opts.length)], policy);
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
// mainHabit … 助手の EXPERT・MASTER(cardAiPolicy の gambitKeepMain): メインの型は今のくせ(強さごとの調整ずみ)をそのまま使い、サブだけを足す
//   when … 助手の EXPERT・MASTER: サブごとの「効く場面」(CARD_AI_TACTIC_WHEN の名前)。その場面では、サブを3分の1でなく丸ごと効かせる
const cardTacticHabitOf = (base, st = null, p = 0, mainHabit = null, when = null) => {
  const subW = (i) => (st && Array.isArray(when) && typeof when[i] === 'string' && typeof cardAiTacticWhenHit === 'function' && cardAiTacticWhenHit(when[i], st, p) ? 1 : CARD_TACTIC_SUB_W);
  const list = (Array.isArray(base) ? base : []).map((id, i) => ({ c: cardTacticOf(id), w: i === 0 ? 1 : subW(i), main: i === 0 })).filter((x) => x.c && x.c.cat === 'base');
  if (!list.length) return null;
  const h = Object.fromEntries(CARD_TACTIC_DIMS.map((d) => [d, mainHabit && Number.isFinite(mainHabit[d]) ? mainHabit[d] : 1]));
  if (mainHabit && mainHabit.flex) h.flex = true;
  if (mainHabit && mainHabit.mill) h.mill = mainHabit.mill;
  list.forEach(({ c, w, main }) => { if (mainHabit && main) return; const pre = cardTacticPresetOf(c); CARD_TACTIC_DIMS.forEach((d) => { if (Number.isFinite(pre[d])) h[d] *= 1 + (pre[d] - 1) * w; }); });
  const calm = list.filter((x) => x.c.g === 'tCalm').reduce((a, x) => a * (1 - 0.5 * x.w), 1);
  CARD_TACTIC_DIMS.forEach((d) => { h[d] = Math.min(2, Math.max(0.3, 1 + (h[d] - 1) * calm)); });
  const turn = st ? cardTacticOwnTurn(st, p) : 0;
  const some = (g) => list.some((x) => x.c.g === g && (x.w === 1 || turn % 3 === 0));
  if (some('tFlex')) h.flex = true;
  const mill = list.filter((x) => x.c.g === 'tMill').reduce((a, x) => a + x.w, 0);
  if (mill) h.mill = Math.min(1, Math.max(h.mill || 0, mill));
  // 逆転型: 倒された数で負けている・ライフの合計が半分以下なら捨て身(守り×0.5・とどめ・大技・全体×1.3)、それまでは堅く(守り・ガッツ×1.2)
  const back = list.find((x) => x.c.g === 'tComeback');
  if (back && st) {
    const me = st.players[p], op = st.players[cardOther(p)];
    const life = me.mons.reduce((a, m) => a + Math.max(0, m.life), 0), max = me.mons.reduce((a, m) => a + m.max, 0);
    const losing = me.mons.filter((m) => m.ko).length > op.mons.filter((m) => m.ko).length || life * 2 <= max;
    const k = (x) => 1 + (x - 1) * back.w;
    if (losing) { h.keepGuard *= k(0.5); h.finish *= k(1.3); h.big *= k(1.3); h.area *= k(1.3); } else { h.keepGuard *= k(1.2); h.saveGuts *= k(1.2); }
  }
  return h;
};
// 基本カードの細かいくせ(knob)。メインはいつも、サブは3回に1回の番(臨機応変型・持久型と同じ)
//   skipMain … 助手の EXPERT・MASTER: メインの型は今の打ち方のままなので、メインの細かいくせは足さない
//   (足すと、みゅあ(攻め型: 倒れるときだけ守る)が MASTER 50→28%・ドラ(守り型: いつも守る)が EXPERT 53→39% に落ちた。2026-10-29 60戦で測った)
const cardTacticKnobsOf = (base, st = null, p = 0, skipMain = false) => {
  const turn = st ? cardTacticOwnTurn(st, p) : 0;
  const out = {};
  (Array.isArray(base) ? base : []).forEach((id, i) => {
    const c = cardTacticOf(id);
    if (!c || c.cat !== 'base' || (i > 0 && turn % 3 !== 0) || (i === 0 && skipMain)) return;
    const g = CARD_TACTIC_GROUPS.find((x) => x.id === c.g) || {};
    Object.assign(out, g.knob || {});
  });
  return out;
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
// fctx … { mi(その枠の子の番号。ブリーダーの枠は null), phase }
const cardTacticCond = (db, st, p, card, row, fctx = {}) => {
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
    case 'myHandLe': return hit(me.hand.length <= v);
    case 'breederN': return hit(hand.filter((c) => c.user === 'breeder').length >= 2);
    case 'breederUnused': return hit(!me.breederUsed);
    case 'myGutsLe': return hit(guts <= v);
    case 'myDiscard': return hit(me.discard.length >= v);
    case 'myKo': return hit(me.mons.some((m) => m.ko));
    case 'noField': return hit(!st.field);
    case 'selfLife': case 'selfFresh': case 'selfType': case 'selfStun': case 'selfAdv': {
      const mi = fctx.mi;
      const m = Number.isInteger(mi) ? me.mons[mi] : null;
      if (!m || m.ko) return null;
      if (card.g === 'selfLife') return hit(m.life * 100 <= m.max * v);
      if (card.g === 'selfFresh') return hit(!(m.attacks > 0));
      if (card.g === 'selfType') return hit(cardMonType(m, st.turn) === { 地上: 'ground', 空中: 'air', 水中: 'water' }[v]);
      if (card.g === 'selfStun') return hit(m.stunTurn >= st.turn);
      // 有利な相手: この子が使える手札の技に、その相手の特徴で倍になるもの(multVs)がある
      return foes(foesAlive.filter((j) => hand.some((c) => cardUsableBy(c, m) && (c.effects || []).some((e) => e && e.t === 'multVs' && e.type === cardMonType(opp.mons[j], st.turn)))));
    }
    case 'incoming': case 'incomingKo': case 'incomingArea': {
      if (!st.pending || st.pending.defender !== p) return null;
      const dmg = cardAiIncomingDamage(db, st);
      const pd = st.pending, tgt = pd.targets[pd.ti];
      const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
      if (card.g === 'incoming') return hit(dmg >= v);
      if (card.g === 'incomingKo') return hit(!!target && target.life <= dmg);
      return hit(cardHasEff(cardOf(db, pd.main), 'area'));
    }
    default: return null;
  }
};

// ---- 行動 ----
// 攻撃の手が、その行動に合うか(o … 攻撃の候補。main … 主の札)
const CARD_TACTIC_EFF = Object.freeze({
  回避されない: ['noEvade'], 攻撃できなくする: ['stunOnHit', 'stunTarget', 'stunAllEnemies'], ガッツを減らす: ['gutsLossOnHit', 'oppGutsLoss'],
  吸い取る: ['drain'], '2回攻撃': ['extraAttack', 'extraAttackTarget', 'unlimitedAttacks'], 防御で減らない: ['noBlockReduce'], 回避されても半分: ['halfOnEvade'],
  種族に強い: ['multVs'], ダメージを割り振る: ['split'], '2枚同時': ['pair', 'combo', 'requires'], 手札に戻る: ['returnOnHit'], カード投げ: ['tossBonus'],
});
// ブリーダーのカードの効き目ごと(小さく攻撃する はダメージのある札)
const CARD_TACTIC_BEFF = Object.freeze({
  回復する: ['heal'], 倒れた子を戻す: ['revive'], 攻撃できないを消す: ['unstunTarget'], 相手を攻撃できなくする: ['stunTarget'], 相手のガッツを減らす: ['oppGutsLoss'],
  両方のガッツを0にする: ['gutsZeroBoth'], 山札からガッツへ: ['rush', 'deckToGuts'], カードを引く: ['draw'], 捨て札から拾う: ['choose'], 手札を引き直す: ['refresh'],
  もう1回攻撃させる: ['extraAttackTarget'], 合体する: ['fuse'], 付ける札をただにする: ['attachFree'], 守りを名指しで封じる: ['attachBind'], 捨て札を山札に戻す: ['gutsToDeckShuffle'],
});
const CARD_TACTIC_FIELD = Object.freeze({
  ダメージを足す: 'fieldDmg', 払うガッツを変える: 'fieldCost', 大きいダメージを封じる: 'fieldBanDmg', 山札を削る: 'fieldMill', 純血のプライド: 'fieldPurePride',
  技の種類を封じる: 'fieldBanKind', 持ちょうを変える: 'fieldType', じわじわ減らす: 'fieldBurn', ガッツの上限: 'fieldGutsMax', 出すと引く: 'fieldDrawOnPlay',
});
const CARD_TACTIC_ATTACH = Object.freeze({ ダメージを上げる: ['attachMult', 'attachAdd'], 回避させない: ['attachNoEvade', 'attachNoGuard', 'attachNoBlockReduce'], ガッツを軽くする: ['attachCost', 'attachCostHalf', 'attachFree'] });
const CARD_TACTIC_SPE = Object.freeze({ 味方を回復: ['heal'], 引く: ['draw'], 空中になる: ['form', 'becomeAir'], 安全になる: ['safe'], まゆと羽化: ['cocoon', 'emerge'], のりうつる: ['possess'] });
const CARD_TACTIC_CHARGE = Object.freeze({ 怒り: ['rage'], 次の番の技を倍: ['nextTurnMult'] });
const CARD_TACTIC_GUARD_EFF = Object.freeze({ はね返す守り: ['reflect'], 半分にする守り: ['reduceHalf'] });
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
    case 'bEff': {
      const br = cards.filter((c) => c.user === 'breeder' && c.kind !== 'fld');
      if (v === '小さく攻撃する') return o.type === 'breeder' && (main.damage || 0) > 0;
      return br.some((c) => (CARD_TACTIC_BEFF[v] || []).some((t) => cardHasEff(c, t)));
    }
    case 'fieldCard': return main.kind === 'fld';
    case 'fieldKind': return main.kind === 'fld' && cardHasEff(main, CARD_TACTIC_FIELD[v]);
    case 'attachKind': return o.hand.length > 1 && cards.slice(1).some((c) => (CARD_TACTIC_ATTACH[v] || []).some((t) => cardHasEff(c, t)));
    case 'spe': return o.type === 'attack' && main.kind === 'spe' && (CARD_TACTIC_SPE[v] || []).some((t) => cardHasEff(main, t));
    case 'chargeKind': return cards.some((c) => (CARD_TACTIC_CHARGE[v] || []).some((t) => cardHasEff(c, t)));
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
//   ctx.mi … 数ならその子の手だけ(モンスターの枠)。null ならブリーダーの手(ブリーダーの枠)
//   ctx.skip … 攻撃させない子(立ち回り)/ ctx.noBreeder … この番はブリーダーのカードを出さない。どちらも、このあとの行と基本カードの型にも効く
const cardTacticRowAct = (db, st, policy, phase, row, aim, ctx) => {
  const act = cardTacticOf(row.a);
  const p = phase === 'guard' ? st.pending.defender : st.active;
  if (act.phase !== 'all' && act.phase !== phase) return null;
  const me = st.players[p];
  const usable = (o) => !(o.type === 'attack' && ctx.skip.has(o.mon)) && !(ctx.noBreeder && (o.type === 'breeder' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder')));
  const pickBest = (fits, floor = 0) => {
    const best = ctx.scored().find((x) => x.s > floor && usable(x.o) && fits(x.o) && cardTacticAimsAt(st, x.o, aim.foes));
    return best ? { act: cardAiFillBind(db, st, best.o, policy) } : null;
  };
  if (act.g === 'ace') {
    const aces = Array.isArray(policy.aces) ? policy.aces : [];
    if (!aces.length || phase !== 'attack') return null;
    return pickBest((o) => o.hand.some((i) => aces.includes(me.hand[i])));
  }
  if (phase === 'attack') {
    if (act.g === 'stop') return { act: { type: 'endAttacks' } };
    if (act.g === 'holdBreeder') { ctx.noBreeder = true; return null; }
    const mine = (o) => (ctx.mi === null ? o.type === 'breeder' || (cardOf(db, me.hand[o.hand[0]]) || {}).kind === 'fld' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder') : o.type === 'attack' && o.mon === ctx.mi);
    if (act.g === 'stance') {
      const mi = ctx.mi;
      const m = Number.isInteger(mi) ? me.mons[mi] : null;
      if (!m) return null;
      const alive = me.mons.filter((x) => !x.ko);
      const v = act.v;
      if (v === 'この子は攻撃しない') { ctx.skip.add(mi); return null; }
      if (v === 'ライフの少ない子は温存') { if (alive.length > 1 && m.life === Math.min(...alive.map((x) => x.life))) ctx.skip.add(mi); return null; }
      if (v === '攻撃は1回だけ') { if (m.attacks > 0) { ctx.skip.add(mi); return null; } return pickBest(mine); }
      if (v === 'ライフの多い子が先に') return m.life === Math.max(...alive.map((x) => x.life)) ? pickBest(mine) : null;
      if (v === '何回でも攻める') return pickBest(mine, -1); // 点数が少し低い手でも出す
      return pickBest(mine); // この子から攻める
    }
    return pickBest((o) => mine(o) && cardTacticAttackFits(db, st, act, o));
  }
  if (phase === 'guard') {
    const pd = st.pending;
    const tgt = pd.targets[pd.ti];
    if (aim.mine && !(tgt && tgt.p === p && aim.mine.includes(tgt.m))) return null; // 守る相手が決まっていて、狙われたのがその子でない
    const dmg = cardAiIncomingDamage(db, st);
    const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
    const cardOfOpt = (o) => cardOf(db, me.hand[o.hand]) || {};
    if (act.g === 'noGuard') return { act: { type: 'pass' } };
    if (act.g === 'guardOver' && dmg < act.v) return { act: { type: 'pass' } };
    if (act.g === 'guardDie' && !(target && target.life <= dmg)) return { act: { type: 'pass' } };
    const only = act.g === 'guardFirst' ? (o) => (act.v === '回避' ? cardOfOpt(o).kind === 'dge' : act.v === '防御' ? cardOfOpt(o).kind === 'blk' : (CARD_TACTIC_GUARD_EFF[act.v] || []).some((t) => cardHasEff(cardOfOpt(o), t)))
      : act.g === 'cover' ? (o) => ['cover', 'shield', 'redirect'].some((t) => cardHasEff(cardOfOpt(o), t))
        : null;
    const g = cardAiChooseGuard(db, st, policy, () => 0, { force: true, only });
    return g.type !== 'pass' ? { act: g } : null;
  }
  if (phase === 'guts') {
    if (act.g === 'save') return { act: cardAiChooseGuts(db, st, { ...policy, habit: { ...(policy.habit || {}), saveGuts: Math.max(1.6, (policy.habit || {}).saveGuts || 1) } }) };
    if (act.g === 'gutsN') return { act: cardAiChooseGuts(db, st, policy, { count: act.v }) };
    if (act.g === 'keepGuard') return { act: cardAiChooseGuts(db, st, policy, { keepGuards: true }) };
    if (act.g === 'gutsOrder') {
      // 置く枚数はふつうのとおり。どの札から置くかだけを変える(重い札/使えない札から)
      const n = cardAiChooseGuts(db, st, policy).hand.length;
      const dead = (c) => !c || (c.user !== 'breeder' && !me.mons.some((m) => !m.ko && cardUsableBy(c, m)));
      const order = me.hand.map((no, i) => ({ i, c: cardOf(db, no) })).sort((x, y) => (act.v === '重い札' ? ((y.c || {}).guts || 0) - ((x.c || {}).guts || 0) : (dead(y.c) ? 1 : 0) - (dead(x.c) ? 1 : 0)) || x.i - y.i);
      return { act: { type: 'guts', hand: order.slice(0, n).map((x) => x.i) } };
    }
  }
  return null;
};

// 基本カードの細かいくせで、攻撃の手を選び直す(どの行にも当たらないとき)。くせが無ければ null(ふつうに打つ)
const cardTacticBaseAttack = (db, st, policy, knobs, ctx) => {
  const p = st.active, me = st.players[p], opp = st.players[cardOther(p)];
  const effs = (o) => o.hand.flatMap((i) => ((cardOf(db, me.hand[i]) || {}).effects || []).map((e) => e && e.t));
  const foes = opp.mons.map((m, j) => ({ m, j })).filter((x) => !x.m.ko);
  const lowest = foes.length ? foes.slice().sort((a, b) => a.m.life / a.m.max - b.m.life / b.m.max)[0].j : -1;
  const highest = foes.length ? foes.slice().sort((a, b) => b.m.life - a.m.life)[0].j : -1;
  const list = ctx.scored().filter((x) => {
    const o = x.o;
    if (o.type === 'attack' && ctx.skip.has(o.mon)) return false;
    if (ctx.noBreeder && (o.type === 'breeder' || o.hand.some((i) => (cardOf(db, me.hand[i]) || {}).user === 'breeder'))) return false;
    const e = effs(o);
    if (knobs.light && o.type === 'attack' && cardActionCost(db, st, p, me.hand, o.hand) > 1) return false;
    if (knobs.safe && e.some((t) => /^selfDamage|^attachSelfIfHit$|^selfHurt$/.test(t))) return false;
    if (knobs.noDraw && e.some((t) => ['draw', 'rush', 'deckToGuts', 'refresh', 'oppDraw'].includes(t))) return false;
    if (knobs.keepHand && me.hand.length - o.hand.length < knobs.keepHand) return false;
    if (knobs.areaMin2 && foes.length < 2 && e.includes('area')) return false;
    return true;
  }).map((x) => {
    const t = x.o.target && x.o.target.p !== p ? x.o.target.m : -1;
    return { ...x, s: x.s + (knobs.focus && t === lowest ? 1.5 : 0) + (knobs.spread && t === highest ? 1 : 0) };
  }).sort((a, b) => b.s - a.s);
  if (!list.length || list[0].s <= 0.3) return { act: { type: 'endAttacks' } };
  return { act: cardAiFillBind(db, st, list[0].o, policy) };
};

// 枠を順に見て、最初に当たった行の手を返す。{ act } … その手 / { policy } … 基本カードの型で、ふつうに打つ / null … 今のまま
//   攻撃の番: 左の子の枠 → 真ん中 → 右 → ブリーダーの枠 / 守るとき: 狙われた子の枠 / ガッツの番: ブリーダーの枠。どれにも当たらなければ基本カードの型
const cardTacticDecide = (db, st, policy) => {
  const frames = cardTacticNormalizeFrames(policy && policy.gambit);
  if (st.winner !== null) return null;
  const phase = st.pending ? 'guard' : st.phase === 'guts' ? 'guts' : st.phase === 'main' ? 'attack' : null;
  if (!phase) return null;
  if (policy.gambitRandom && cardTacticSmartLevel(frames) === 'random') return { act: cardTacticRandomAct(db, st, policy) };
  const p = phase === 'guard' ? st.pending.defender : st.active;
  const habit = cardTacticHabitOf(frames.base, st, p, policy.gambitKeepMain ? policy.habit : null, policy.gambitWhen || null);
  const knobs = cardTacticKnobsOf(frames.base, st, p, !!policy.gambitKeepMain);
  const pol = habit ? { ...policy, habit } : policy;
  let scored = null;
  const ctx = { mi: null, skip: new Set(), noBreeder: false, scored: () => { if (!scored) scored = cardAiAttackScored(db, st, cardAiAttackChoices(db, st, pol), pol); return scored; } };
  const order = [];
  if (phase === 'attack') { [0, 1, 2].forEach((mi) => order.push({ rows: frames.mons[mi], mi })); order.push({ rows: frames.breeder, mi: null }); }
  if (phase === 'guard') { const t = st.pending.targets[st.pending.ti]; if (t && t.p === p) order.push({ rows: frames.mons[t.m] || [], mi: t.m }); }
  if (phase === 'guts') order.push({ rows: frames.breeder, mi: null });
  for (const fr of order) {
    if (phase === 'attack' && fr.mi !== null && st.players[p].mons[fr.mi] && st.players[p].mons[fr.mi].ko) continue;
    for (const row of fr.rows) {
      if (!row.on) continue;
      const aim = cardTacticCond(db, st, p, cardTacticOf(row.c), row, { mi: fr.mi, phase });
      if (!aim) continue;
      ctx.mi = fr.mi;
      const got = cardTacticRowAct(db, st, pol, phase, row, aim, ctx);
      if (got) return got;
    }
  }
  // どの行にも当たらない: 基本カードの型で打つ(細かいくせ・立ち回りで外した子・温存したブリーダーのカードも守る)
  if (phase === 'attack' && (ctx.skip.size || ctx.noBreeder || ['light', 'safe', 'noDraw', 'keepHand', 'focus', 'spread', 'areaMin2'].some((k) => knobs[k]))) return cardTacticBaseAttack(db, st, pol, knobs, ctx);
  if (phase === 'guard') {
    const pd = st.pending, tgt = pd.targets[pd.ti];
    const target = tgt ? st.players[tgt.p].mons[pd.cover !== null && pd.cover !== undefined ? pd.cover : tgt.m] : null;
    const dies = !!target && target.life <= cardAiIncomingDamage(db, st);
    if (knobs.noGuardUnlessFinish && !dies) return { act: { type: 'pass' } };
    if (knobs.guardDieOnly) { if (!dies) return { act: { type: 'pass' } }; const g = cardAiChooseGuard(db, st, pol, () => 0, { force: true }); return { act: g }; }
    if (knobs.guardAll) { const g = cardAiChooseGuard(db, st, pol, () => 0, { force: true, only: knobs.light ? (o) => ((cardOf(db, st.players[p].hand[o.hand]) || {}).guts || 0) <= 1 : null }); if (g.type !== 'pass') return { act: g }; }
    if (knobs.light) { const g = cardAiChooseGuard(db, st, pol, () => 0.5, { only: (o) => ((cardOf(db, st.players[p].hand[o.hand]) || {}).guts || 0) <= 1 }); return { act: g }; }
  }
  if (phase === 'guts' && knobs.keepHand) {
    const g = cardAiChooseGuts(db, st, pol);
    const room = Math.max(0, st.players[p].hand.length - knobs.keepHand);
    return { act: { ...g, hand: g.hand.slice(0, room) } };
  }
  return habit ? { policy: pol } : null;
};

// ---- 助手と対戦の基本カード(2026-10-29 社長: EASY〜HARD は1枚・EXPERT は2枚・MASTER は3枚。枚数が増えるほど型が混ざって賢くなる) ----
//   メインはその助手の今の型(くせは今の値と強さごとの調整のまま。cardAiPolicy の gambitKeepMain)。2枚目・3枚目はツナグ案を、勝率を測って決めた
//   EASY〜HARD は1枚(=今の型だけ)なので、今の打ち方のまま(gambit を持たせない)
const CARD_AI_TACTIC_BASE = Object.freeze({
  mua: ['tAttack', 'tFinish', 'tBig'],
  momosuke: ['tDisrupt', 'tJam', 'tCalm'],
  kiki: ['tSave', 'tBig', 'tSteady'],
  kyuko: ['tBalance', 'tCalm', 'tFinish'],
  dra: ['tGuard', 'tSteady', 'tMill'],
  atsu: ['tFlex', 'tArea', 'tSteady'],
  sorashido: ['tMill', 'tDisrupt', 'tGuard'],
});
const CARD_AI_TACTIC_COUNT = Object.freeze({ expert: 2, master: 3 });
// 2枚目・3枚目が丸ごと効く場面(2026-10-29 社長 案B「型が混ざったことが、遊ぶ人に分かる程度に」)。ほかの場面では3分の1
const CARD_AI_TACTIC_WHEN = Object.freeze({
  mua: [null, 'foeLow', 'gutsFull'],         // 弱った子がいれば仕留め・ガッツが多ければ大技
  momosuke: [null, 'lowLife', 'ahead'],      // 押されたら崩しながら守る・勝っていたら慎重に
  kiki: [null, 'gutsFull', null],            // ガッツが多ければ大技(堅実型は3分の1のまま。押されたときに丸ごと効かせると MASTER 42→39%)
  kyuko: [null, 'behind', 'foeLow'],         // 負けていたら慎重に・弱った子がいれば仕留め
  dra: [null, 'lowLife', 'foeDeckLow'],      // 押されたら堅く・相手の山札が減ったら持久戦
  atsu: [null, 'foeFull', 'lowLife'],        // 相手が3体そろっていれば全体・押されたら堅く
  sorashido: [null, 'foeHandFull', 'lowLife'], // 相手の手札が多ければ崩す・押されたら守る
});
const cardAiTacticWhenHit = (name, st, p) => {
  const me = st.players[p], op = st.players[cardOther(p)];
  const alive = (pl) => pl.mons.filter((m) => !m.ko);
  const life = (pl) => alive(pl).reduce((a, m) => a + Math.max(0, m.life), 0), max = (pl) => pl.mons.reduce((a, m) => a + m.max, 0);
  const kos = (pl) => pl.mons.filter((m) => m.ko).length;
  if (name === 'foeLow') return alive(op).some((m) => m.life * 10 <= m.max * 3);
  if (name === 'gutsFull') return me.guts.length >= 5;
  if (name === 'lowLife') return life(me) * 2 <= max(me);
  if (name === 'ahead') return kos(op) > kos(me);
  if (name === 'behind') return kos(me) > kos(op);
  if (name === 'foeDeckLow') return op.deck.length <= 15;
  if (name === 'foeFull') return alive(op).length >= 3;
  if (name === 'foeHandFull') return op.hand.length >= 4;
  return false;
};
// 2枚目・3枚目の型を、はっきり見える手にする行(3体の枠どれにも入れる。EXPERT は2枚目の行・MASTER は3枚目の行も)。
//   行は上から見て、当たったら(その手が出せれば)その手を出す。出せなければ、ふだんの打ち方
const CARD_AI_TACTIC_ROWS = Object.freeze({
  mua: [[{ c: 'myGuts.5', a: 'cost.大技(4以上)' }], [{ c: 'foeAlive.1', a: 'cost.大技(4以上)' }]],
  momosuke: [[{ c: 'foeHandGe.4', a: 'disrupt.手札を捨てさせる' }], [{ c: 'incomingKo', a: 'guard' }]],
  kiki: [[{ c: 'myGuts.7', a: 'cost.大技(4以上)' }], [{ c: 'incomingKo', a: 'guard' }]],
  kyuko: [[{ c: 'koDiff.負け', a: 'guard' }], [{ c: 'ko', a: 'atk' }]],
  dra: [[{ c: 'incoming.3', a: 'guard' }], [{ c: 'foeDeck.5', a: 'disrupt.山札を削る' }]],
  atsu: [[{ c: 'foeAlive.3', a: 'reach.全体攻撃' }], [{ c: 'myLife.50', a: 'guard' }]],
  sorashido: [[{ c: 'foeDeck.20', a: 'disrupt.山札を削る' }], [{ c: 'incoming.5', a: 'guard' }]],
});
const cardAiTacticGambit = (who, levelId) => {
  const n = CARD_AI_TACTIC_COUNT[levelId];
  const list = CARD_AI_TACTIC_BASE[who];
  if (!n || !list) return null;
  const rows = (CARD_AI_TACTIC_ROWS[who] || []).slice(0, n - 1).flat().map((r) => ({ ...r, on: true }));
  return { base: [0, 1, 2].map((i) => (i < n ? list[i] || null : null)), breeder: [], mons: [rows, rows, rows] };
};

