// ガンビット型 戦術カード(細かく刻んだ版)。段ごとに1枚。表と絵をこの1か所から作る
// tiers: [段の文字, レア] / how: now=今の部品で見られる・new=新しく数える(小)・est=見積もりで作る / start: はじめに配る段
const T = (list, nRule) => list.map((v, i) => [v, nRule(v, i)]);
const coarse = (fine) => (v) => (fine.includes(v) ? 'R' : 'N');   // 粗い段はN・細かい段はR
const LIFE = [90, 80, 70, 60, 50, 40, 30, 20, 10];
const lifeR = coarse([80, 60, 40, 20]);
const G = [
  // ---------- 条件(標的つき=その子を狙う・守る相手にする) ----------
  { cat: 'cond', sec: '標的', name: 'いつでも', tiers: [['', 'N']], how: 'now', start: [''], desc: 'いつも当たる' },
  { cat: 'cond', sec: '標的', name: '倒せる相手', tiers: [['', 'N']], how: 'now', start: [''], desc: '出せる技で倒せる相手を標的にする' },
  { cat: 'cond', sec: '標的', name: 'いちばんライフの低い相手', tiers: [['', 'N']], how: 'new', desc: '残りライフがいちばん少ない子' },
  { cat: 'cond', sec: '標的', name: 'いちばんライフの高い相手', tiers: [['', 'N']], how: 'new', desc: '残りライフがいちばん多い子' },
  { cat: 'cond', sec: '標的', name: 'いちばん攻撃の強い相手', tiers: [['', 'R']], how: 'est', desc: 'その子が使える技の最大ダメージで見積もる(手札は見ない)' },
  { cat: 'cond', sec: '標的', name: '前の番に攻撃してきた相手', tiers: [['', 'R']], how: 'new', desc: '直前の相手の番に攻撃してきた子' },
  { cat: 'cond', sec: '標的', name: '相手のリーダー', tiers: [['', 'R']], how: 'new', desc: '相手が1体目に置いた子(勇者モンの代わり)' },
  { cat: 'cond', sec: '標的', name: '◯の相手', tiers: T(['地上', '空中', '水中'], () => 'N'), how: 'now', desc: 'その特徴の子' },
  { cat: 'cond', sec: '標的', name: '◯の相手', tiers: T(['純血', '混血'], () => 'N'), how: 'now', desc: 'その血の子' },
  { cat: 'cond', sec: '標的', name: '種族を決めた相手', tiers: [['', 'R']], how: 'now', desc: '組むときに種族を1つ選ぶ(1枚で全種族)' },
  { cat: 'cond', sec: 'ライフ', name: '相手のライフ◯%以下', tiers: T(LIFE, lifeR), how: 'new', start: ['50'], desc: 'その割合以下の相手の子を標的にする' },
  { cat: 'cond', sec: 'ライフ', name: '自分のライフ◯%以下', tiers: T(LIFE, lifeR), how: 'new', desc: 'その割合以下の自分の子がいる(守る相手にする)' },
  { cat: 'cond', sec: 'ガッツ', name: '自分のガッツ◯以上', tiers: T([1, 2, 3, 4, 5, 6, 7], coarse([2, 4, 6])), how: 'now', start: ['3'], desc: '自分のガッツがその数以上' },
  { cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以下', tiers: T([0, 1, 2, 3, 4], coarse([1, 3])), how: 'now', desc: '相手のガッツがその数以下' },
  { cat: 'cond', sec: 'ガッツ', name: '相手のガッツ◯以上', tiers: T([3, 4, 5, 6, 7], coarse([4, 6])), how: 'now', desc: '相手のガッツがその数以上(大技に備える)' },
  { cat: 'cond', sec: '手札・山札', name: '自分の手札◯枚以上', tiers: T([2, 3, 4, 5], coarse([2, 4])), how: 'now', desc: '自分の手札がその数以上' },
  { cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以上', tiers: T([2, 3, 4, 5], coarse([2, 4])), how: 'now', desc: '相手の手札がその数以上' },
  { cat: 'cond', sec: '手札・山札', name: '相手の手札◯枚以下', tiers: T([0, 1, 2], coarse([1])), how: 'now', desc: '相手の手札がその数以下' },
  { cat: 'cond', sec: '手札・山札', name: '自分の山札◯枚以下', tiers: T([30, 20, 10, 5], coarse([20, 5])), how: 'now', desc: '自分の山札がその数以下' },
  { cat: 'cond', sec: '手札・山札', name: '相手の山札◯枚以下', tiers: T([30, 20, 10, 5], coarse([20, 5])), how: 'now', desc: '相手の山札がその数以下' },
  { cat: 'cond', sec: '手札の中身', name: '手札に守り札◯枚以上', tiers: T([1, 2, 3], coarse([3])), how: 'now', desc: '回避・防御の札がその数以上' },
  { cat: 'cond', sec: '手札の中身', name: '手札に◯がある', tiers: T(['回避', '防御'], () => 'N'), how: 'now', desc: 'その種類の守り札がある' },
  { cat: 'cond', sec: '手札の中身', name: '手札に大技がある', tiers: [['', 'N']], how: 'now', desc: 'ガッツ4以上の攻撃の札がある' },
  { cat: 'cond', sec: '手札の中身', name: '手札に全体攻撃がある', tiers: [['', 'R']], how: 'now', desc: '全員に当たる技がある' },
  { cat: 'cond', sec: '手札の中身', name: '手札にブリーダーのカードがある', tiers: [['', 'N']], how: 'now', desc: 'ブリーダーのカードがある' },
  { cat: 'cond', sec: '番', name: '◯番目まで', tiers: T([1, 2, 3, 5], coarse([2])), how: 'now', desc: '自分の番がその回数まで' },
  { cat: 'cond', sec: '番', name: '◯番目から', tiers: T([5, 8, 10, 15], coarse([10])), how: 'now', desc: '自分の番がその回数から' },
  { cat: 'cond', sec: '場', name: '自分の場が◯体', tiers: T([1, 2, 3], (v) => (v === 1 ? 'R' : 'N')), how: 'now', desc: '自分の場に残っている数' },
  { cat: 'cond', sec: '場', name: '相手の場が◯体', tiers: T([1, 2, 3], (v) => (v === 1 ? 'R' : 'N')), how: 'now', desc: '相手の場に残っている数' },
  { cat: 'cond', sec: '場', name: '倒した数で◯ている', tiers: T(['勝っ', '負け'], () => 'N'), how: 'now', desc: '倒した数と倒された数をくらべる' },
  { cat: 'cond', sec: '状態', name: '攻撃できない相手', tiers: [['', 'R']], how: 'now', desc: '封じられて次の番に攻撃できない相手の子' },
  { cat: 'cond', sec: '状態', name: '攻撃できない味方', tiers: [['', 'N']], how: 'now', desc: '封じられている自分の子がいる' },
  { cat: 'cond', sec: '状態', name: '溜めている相手', tiers: [['', 'R']], how: 'now', desc: '次の技が何倍にもなる相手の子(相手の予告の代わり)' },
  { cat: 'cond', sec: '状態', name: '空中に上がった相手', tiers: [['', 'N']], how: 'now', desc: 'この番だけ空中になっている子' },
  { cat: 'cond', sec: '状態', name: '場に◯全体カードがある', tiers: T(['自分の', '相手の'], () => 'N'), how: 'now', desc: 'だれが出した全体カードが場にあるか' },
  { cat: 'cond', sec: '状態', name: '相手が大技を構えている', tiers: [['', 'SR']], how: 'est', desc: '相手のガッツと残りの山札から、大技を撃てそうと見積もる' },
  // ---------- 行動 ----------
  { cat: 'act', sec: '攻撃', name: '攻める', tiers: [['', 'N']], how: 'now', start: [''], phase: '攻撃', desc: '点数がいちばん高い攻撃' },
  { cat: 'act', sec: '攻撃', name: '◯の技を出す', tiers: T(['ちから', 'かしこさ', '特殊'], () => 'N'), how: 'now', phase: '攻撃', desc: 'その種類の技を出す' },
  { cat: 'act', sec: '攻撃', name: '◯を出す', tiers: T(['軽い技(ガッツ0〜1)', '中くらいの技(2〜3)', '大技(4以上)'], () => 'N'), how: 'now', start: ['大技(4以上)'], phase: '攻撃', desc: '払うガッツで選ぶ' },
  { cat: 'act', sec: '攻撃', name: '◯を出す', tiers: T(['全体攻撃', '単体攻撃'], (v) => (v === '全体攻撃' ? 'R' : 'N')), how: 'now', phase: '攻撃', desc: '全員に当たる技か、1体に当てる技か' },
  { cat: 'act', sec: '攻撃', name: '「◯」の技を出す', tiers: T(['回避されない', '攻撃できなくする', 'ガッツを減らす', '吸い取る', '2回攻撃'], (v) => (v === '2回攻撃' || v === '攻撃できなくする' ? 'R' : 'N')), how: 'now', phase: '攻撃', desc: 'その効き目のついた技を出す' },
  { cat: 'act', sec: '攻撃', name: '付ける札を使う', tiers: [['', 'R']], how: 'now', phase: '攻撃', desc: '技に付ける札をいっしょに出す' },
  { cat: 'act', sec: 'ブリーダー', name: 'ブリーダーのカード(◯)', tiers: T(['攻撃', '守り', '引く・手札', '回復'], () => 'N'), how: 'now', phase: '攻撃', desc: 'その種類のブリーダーのカードを出す' },
  { cat: 'act', sec: 'ブリーダー', name: '全体カードを出す', tiers: [['', 'R']], how: 'now', phase: '攻撃', desc: '場に残る全体カードを出す' },
  { cat: 'act', sec: '崩す', name: '崩し: ◯', tiers: T(['手札を捨てさせる', '山札を削る', 'ガッツを減らす', '番を飛ばす'], (v) => (v === '番を飛ばす' ? 'SR' : 'R')), how: 'now', phase: '攻撃', desc: '相手の手を崩す札を出す' },
  { cat: 'act', sec: '守り', name: '守る', tiers: [['', 'N']], how: 'now', start: [''], phase: '守り', desc: '攻撃を受けたら守り札で守る' },
  { cat: 'act', sec: '守り', name: '◯を先に使う', tiers: T(['回避', '防御'], () => 'N'), how: 'new', phase: '守り', desc: '守るとき、どちらの札を先に使うか' },
  { cat: 'act', sec: '守り', name: 'ダメージ◯以上だけ守る', tiers: T([3, 5, 7], coarse([7])), how: 'now', phase: '守り', desc: 'その数より小さい攻撃は守らない' },
  { cat: 'act', sec: '守り', name: '倒されるときだけ守る', tiers: [['', 'R']], how: 'now', phase: '守り', desc: '受けたら倒れるときだけ守る' },
  { cat: 'act', sec: '守り', name: '味方をかばう', tiers: [['', 'R']], how: 'now', phase: '守り', desc: 'かばう札で、標的の味方への攻撃を受ける' },
  { cat: 'act', sec: '守り', name: '守らない', tiers: [['', 'R']], how: 'now', phase: '守り', desc: '守り札を使わず受ける(札を残す)' },
  { cat: 'act', sec: 'ガッツ', name: 'ガッツをためる', tiers: [['', 'N']], how: 'now', start: [''], phase: 'ガッツ', desc: '手札を多めにガッツへ回す' },
  { cat: 'act', sec: 'ガッツ', name: 'ガッツを◯枚だけ置く', tiers: T([0, 1, 2], () => 'N'), how: 'now', phase: 'ガッツ', desc: 'ガッツの番に置く数を決める' },
  { cat: 'act', sec: 'ガッツ', name: '守り札を残して置く', tiers: [['', 'R']], how: 'now', phase: 'ガッツ', desc: '回避・防御はガッツにしない' },
  { cat: 'act', sec: '流れ', name: '攻撃を止める', tiers: [['', 'N']], how: 'now', phase: '攻撃', desc: 'この番の攻撃をここで終える' },
  { cat: 'act', sec: '流れ', name: '溜め技を使う', tiers: [['', 'R']], how: 'now', phase: '攻撃', desc: '次の技を何倍にする札を先に使う' },
  { cat: 'act', sec: '特別', name: '切り札を出す', tiers: [['', 'SR']], how: 'now', phase: 'すべて', desc: '登録した切り札を、手にあれば先に出す' },
  { cat: 'act', sec: '特別', name: '臨機応変', tiers: [['', 'SR']], how: 'now', phase: 'すべて', desc: '場を見て、とどめ・全体・守り・攻めを切り替える(あつの型)' },
  { cat: 'act', sec: '特別', name: '山札切れを待つ', tiers: [['', 'SR']], how: 'now', phase: 'すべて', desc: '長引かせて、相手の山札切れで勝つ(ソラシドの型)' },
  { cat: 'act', sec: '特別', name: '捨て身', tiers: [['', 'SR']], how: 'now', phase: 'すべて', desc: '守らずに受けて、そのぶん倒しに行く' },
];
const label = (g, v) => (v === '' ? g.name : g.name.replace('◯', v));
const cards = G.flatMap((g) => g.tiers.map(([v, r]) => ({ cat: g.cat, sec: g.sec, group: g.name, v: String(v), name: label(g, String(v)), rare: r, how: g.how, phase: g.phase, start: (g.start || []).includes(String(v)) })));
if (typeof module !== 'undefined') module.exports = { G, cards, label };
if (require.main === module) {
  const c = (f) => cards.filter(f).length;
  console.log('合計', cards.length, '条件', c((x) => x.cat === 'cond'), '行動', c((x) => x.cat === 'act'));
  for (const r of ['N', 'R', 'SR']) console.log(r, c((x) => x.rare === r), '条件', c((x) => x.rare === r && x.cat === 'cond'), '行動', c((x) => x.rare === r && x.cat === 'act'));
  console.log('はじめ', cards.filter((x) => x.start).map((x) => x.name).join('・'));
  console.log(cards.map((x) => x.name).join(' / '));
}
