// MFバトルカードのカードのデータ(monster-hero/data/card-battle-cards.js)を、元のカードの書き写し(cards.json)から作る。
//
// 【なぜ道具にするか】(設計: docs/spec/CARD_BATTLE.md 2-1・2-3)
// カードは社長から届いた順に増える(いま392枚)。手で配信用のデータへ書き写すと、数字の写し間違いと
// 「文の効果を作り忘れたカードがパックに出る」が起きる。書き写しは cards.json の1か所だけにして、
// ここで機械的に作り直す。ゲームはカードの画像から読み取らない。動きは全部この表の数字と効果から決まる。
//
// 効果(effects)は、カードの文を決まった部品に当てたもの。部品の意味は 82-card-battle-core.jsx の上に書いてある。
//   ・文が無いカード(ただの攻撃・防御)はそのまま使える
//   ・文があるカードは、下の EFFECTS に部品を書いたものだけ使える(ready:true)
//   ・部品を書いていないカードは ready:false(準備中)。パック・デッキ・コンピューターに出さない
// 使い方: node tools/card/card-data-build.js        データを書き出す
//         node tools/card/card-data-build.js --check  書き出さずに、いまのデータと食い違いがないかだけ見る
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const OUT = path.join(ROOT, 'monster-hero', 'data', 'card-battle-cards.js');

// フォルダ → 種族の id。id はゲームの中の呼び名(画面には name を出す)
const SPECIES = [
  ['tiger', 'tiger', 'ライガー'], ['gali', 'gali', 'ガリ'], ['golem', 'golem', 'ゴーレム'], ['suezo', 'suezo', 'スエゾー'],
  ['pixie', 'pixie', 'ピクシー'], ['dino', 'dino', 'ディノ'], ['naga', 'naga', 'ナーガ'], ['hare', 'hare', 'ハム'],
  ['mocchi', 'mocchi', 'モッチー'], ['phoenix', 'phoenix', 'ヒノトリ'], ['jell', 'jell', 'ゲル'], ['monol', 'monol', 'モノリス'],
  ['henger', 'henger', 'ヘンガー'], ['mew', 'mew', 'ニャー'], ['plant', 'plant', 'プラント'], ['worm', 'worm', 'ワーム'],
  ['dragon', 'dragon', 'ドラゴン'], ['zilla', 'zilla', 'グジラ'], ['metalner', 'metalner', 'メタルナー'], ['joker', 'joker', 'ジョーカー'],
  ['arrowhead', 'arrowhead', 'アローヘッド'], ['centaur', 'centaur', 'ケンタロウス'], ['colorpandora', 'colorpandora', 'コロペンドラ'],
  ['durahan', 'durahan', 'デュラハン'],
];
const SPECIES_BY_NAME = Object.fromEntries(SPECIES.map(([, id, name]) => [name, id]));
// 弾(台帳 #3413)。番号の離れた技(357〜)は第4弾。全モンスター・ブリーダーは番号で分ける(推定)
const WAVE_OF_SPECIES = {
  tiger: 1, gali: 1, golem: 1, suezo: 1, pixie: 1, dino: 1, naga: 1, hare: 1, mocchi: 1,
  monol: 2, henger: 2, plant: 2, dragon: 2, phoenix: 2,

  jell: 3, mew: 3, worm: 3, zilla: 3,
  // デュラハン(2026-10-24 #3421 で届いた)。legendcup の抜粋で第3弾と分かっていた(設計書 4-2)
  durahan: 3,
  metalner: 4, joker: 4, arrowhead: 4, centaur: 4, colorpandora: 4,
};
const waveOfNo = (no) => (no <= 128 ? 1 : no <= 260 ? 2 : no <= 280 ? 3 : 4);
const KIND = { 'ちから': 'pow', 'かしこさ': 'int', '特殊': 'spe', '回避': 'dge', '防御': 'blk' };
const TYPE = { '地上': 'ground', '空中': 'air', '水中': 'water' };

// ---- 文 → 効果の部品 ----
// 1文ずつ当てる。全部の文が当たったカードだけ使える(1文でも当たらなければ準備中)。
// 部品の名前と中身は 82-card-battle-core.jsx の CARD_EFFECT_DOC と同じ
const both = ['pow', 'int'];
const SENTENCE_RULES = [
  [/^この技は回避されても、半分のダメージを与える。$/, () => ({ t: 'halfOnEvade' })],
  [/^この技は回避されない。$/, () => ({ t: 'noEvade' })],
  [/^この技でダメージを受けたモンスターは次のターン攻撃できない。$/, () => ({ t: 'stunOnHit' })],
  [/^この技を受けたモンスターは、次のターン攻撃できない。$/, () => ({ t: 'stunOnHit' })],
  [/^この技が回避されなかった場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamageIfHit', n: +m[1] })],
  [/^その技が回避されなかった場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamageIfHit', n: +m[1] })],
  [/^この技が回避された場合、自分は(\d+)ダメージを受ける。$/, (m) => ({ t: 'selfDamageIfEvaded', n: +m[1] })],
  [/^この技を使用した場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamage', n: +m[1] })],
  [/^この技でダメージを与えた場合、相手ブリーダーはガッツを(\d+)減らす。$/, (m) => ({ t: 'gutsLossOnHit', n: +m[1] })],
  [/^この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。$/, () => ({ t: 'gutsLossOnHit', n: 'all' })],
  [/^この技は防御によってダメージをマイナスされない。$/, () => ({ t: 'noBlockReduce' })],
  [/^この技は全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies' })],
  [/^この技は空中にいる全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies', only: 'air' })],
  [/^この技は地上にいる全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies', only: 'ground' })],
  [/^この技は自分以外の全ての地上にいるモンスターにダメージを与える。$/, () => ({ t: 'area', who: 'others', only: 'ground' })],
  [/^この技は自分以外の全ての(?:地上にいる)?モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'others' })],
  [/^この技は空中にいるモンスターには、?ダメージを与えられない。$/, () => ({ t: 'cannotHit', type: 'air' })],
  [/^この技は地上にいるモンスターにしかダメージを与えられない。$/, () => ({ t: 'onlyHit', type: 'ground' })],
  [/^この技は空中にいるモンスターには(\d+)倍のダメージを与える。$/, (m) => ({ t: 'multVs', type: 'air', n: +m[1] })],
  [/^この技は地上にいるモンスターには(\d+)倍のダメージを与える。$/, (m) => ({ t: 'multVs', type: 'ground', n: +m[1] })],
  [/^この技で与えたダメージ分、自分のライフを回復する。$/, () => ({ t: 'drain' })],
  [/^「(.+?)」(?:「(.+?)」)?は同一ターンに連続して使用できる。$/, (m) => ({ t: 'chain', names: [m[1], m[2]].filter(Boolean) })],
  [/^(\d+)以上のガッツを消費する、ちから技かかしこさ技を回避する。$/, (m) => ({ t: 'evade', kinds: both, minGuts: +m[1] })],
  [/^ちから技か、かしこさ技を回避する。$/, () => ({ t: 'evade', kinds: both })],
  [/^ちから技を回避する。$/, () => ({ t: 'evade', kinds: ['pow'] })],
  [/^かしこさ技を回避する。$/, () => ({ t: 'evade', kinds: ['int'] })],
  [/^ちから技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: ['pow'], n: +m[1] })],
  [/^かしこさ技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: ['int'], n: +m[1] })],
  [/^この技は自分のライフが(\d+)以下の時に使用できる。$/, (m) => ({ t: 'useWhen', lifeMax: +m[1] })],
  [/^ちから技か、かしこさ技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: both, n: +m[1] })],
  [/^ちから技で受けるダメージの半分\(切り捨て\)をマイナスする。$/, () => ({ t: 'reduceHalf', kinds: ['pow'] })],
  [/^ちから技で与えられるダメージを0にする。$/, () => ({ t: 'reduceAll', kinds: ['pow'] })],
  [/^自分の山札からカードを(\d+)枚引く。$/, (m) => ({ t: 'draw', n: +m[1] })],
  [/^相手の手札の内容を見る。$/, () => ({ t: 'peekHand' })],
  [/^相手の手札を(\d+)枚捨てさせる。$/, (m) => ({ t: 'discardOpp', n: +m[1] })],
  [/^(\d+)体の味方モンスターのライフを(\d+)回復する。$/, (m) => ({ t: 'heal', n: +m[2] })],
  [/^このターン、相手モンスターは回避技を使用できない。$/, () => ({ t: 'forbidThisTurn', kinds: ['dge'] })],
  [/^このターン、相手モンスターは防御技を使用できない。$/, () => ({ t: 'forbidThisTurn', kinds: ['blk'] })],
  [/^かしこさ技によって与えられるダメージを使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['int'], frac: 1 })],
  [/^ちから技によって与えられるダメージを使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['pow'], frac: 1 })],
  [/^ちから技で受けるダメージの半分\(切り捨て\)を技を使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['pow'], frac: 0.5, keep: true })],
  [/^特別な効果は(?:全て無視する|反射しない)。$/, () => null],
  [/^味方モンスターへの1回分のダメージを、自分のダメージにする。$/, () => ({ t: 'cover' })],
  [/^この技でモンスターのライフを0にしてはならない。$/, () => ({ t: 'nonLethal' })],
  // 準備中の83枚(台帳 #141)・区切り1
  [/^次の自分の(ちから|かしこさ)技1回のダメージを(\d+)倍する。$/, (m) => ({ t: 'charge', kinds: [KIND[m[1]]], n: +m[2] })],
  [/^この効果はダメージを受けると終了する。$/, () => null],
  [/^自分のガッツを全て失う。$/, () => ({ t: 'selfGutsAll' })],
];
// 1文に分けられない・言い回しが1枚だけのカードは、番号で部品を書く(文の全体をここで引き受ける)
const BY_NO = {
  // ライガーの右爪・左爪・ツノ: 同時に使う種類の数でダメージが変わる
  1: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  2: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  3: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  // ライガーのジャンプ: ちから技を回避。次の自分のターンのちから技2倍・それまで空中
  12: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: ['pow'], n: 2 }, { t: 'becomeAir' }],
  // 底力: ライフ2以下の子の技に付ける(技を使う前に)。その技のダメージ2倍
  110: [{ t: 'attach', when: { lifeMax: 2 } }, { t: 'attachMult', n: 2 }],
  // デュラハンの精神集中: 次のターン(相手の番)が終わるまで、相手にガッツを減らされない
  245: [{ t: 'gutsGuard' }],
  // デュラハンの静の構え: 次の自分のかしこさ技1回を2倍。ダメージを受けたら消える
  246: [{ t: 'charge', kinds: ['int'], n: 2 }],
  // ピクシーの舞い上がる: ジャンプと同じ(ちから技を回避。次の自分のターンのちから技2倍・それまで空中)
  60: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: ['pow'], n: 2 }, { t: 'becomeAir' }],
  // ドラゴンの飛び上がる: ちから技を回避。次の自分のターンのちから技・かしこさ技2倍・それまで空中
  236: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: both, n: 2 }, { t: 'becomeAir' }],
  // ---- 区切り2: 技と同時に使う札(attach。when は付けられる技の条件。部品の意味は 82 の上) ----
  121: [{ t: 'attach', when: { kinds: both } }, { t: 'attachAdd', n: 2 }], // クリティカル
  124: [{ t: 'attach', when: { kinds: both, deckEmpty: true } }, { t: 'attachMult', n: 3 }], // 劇的な幕切れ
  330: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachMult', n: 2 }, { t: 'attachSelfIfHit', n: 2 }], // 捨て身
  345: [{ t: 'attach', when: { kinds: both, lifeMax: 2 } }, { t: 'attachAdd', n: 2 }], // 必死
  343: [{ t: 'attach', when: { kinds: both } }, { t: 'attachCost', n: 1 }], // 団結
  347: [{ t: 'attach', when: { area: true } }, { t: 'attachCostHalf' }], // 急襲
  274: [{ t: 'attach', when: { kinds: both } }, { t: 'attachNoZeroGuard' }], // 集中
  349: [{ t: 'attach', when: { kinds: both } }, { t: 'attachNoGuardIfGuarded' }], // 挟み撃ち
  366: [{ t: 'attach', when: { kinds: both } }, { t: 'attachBind' }], // 影縛り(ブリーダー)
  362: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoBlockReduce' }], // 渾身
  363: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoGuard' }], // 瞬殺
  346: [{ t: 'attach', when: { kinds: both, pure: true } }, { t: 'attachNoEvadeHybrid' }], // 純血のスピード
  276: [{ t: 'attach', when: { breederMaxGuts: 3 } }, { t: 'attachFree' }], // ジョイのサポート(ブリーダーのカードに付ける)
  342: [{ t: 'freeSpeThisTurn' }], // 友情の証(付けずに出す特殊技)
  9: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoEvade' }], // 電光石火
  70: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoEvade' }], // 跳躍
  209: [{ t: 'attach', when: { kinds: both } }, { t: 'attachCost', n: 2 }], // 光合成
  // ---- 区切り3: もう1回攻撃・攻撃できない・狙いの縛り(部品の意味は 82 の上) ----
  250: [{ t: 'useWhenAllies', n: 1 }, { t: 'extraAttack', n: 1 }], // 孤軍奮闘
  254: [{ t: 'extraAttackTarget', n: 1 }], // オイリーオイル(もう攻撃した味方に)
  351: [{ t: 'unstunTarget' }], // 夏美草(攻撃できない印のある味方に)
  234: [{ t: 'liftTarget' }, { t: 'extraAttack', n: 1 }], // ほうり上げる
  294: [{ t: 'unlimitedAttacks' }], // タイムディレイ
  83: [{ t: 'unlimitedAttacks' }], // 死亡遊戯
  197: [{ t: 'breederUnlimited' }], // うたうニャ
  46: [{ t: 'taunt', mode: 'only' }], // 挑発
  365: [{ t: 'taunt', mode: 'only' }], // レロレロ
  57: [{ t: 'taunt', mode: 'not' }], // 魅了
  269: [{ t: 'taunt', mode: 'only', noArea: true }], // たちはだかる
  10: [{ t: 'stunAllEnemies' }], // 吠え
  273: [{ t: 'stunTarget' }], // 吹き飛ばし
  47: [{ t: 'skipTurn' }], // 歌う
  251: [{ t: 'rage' }], // 怒り
  // ---- 区切り4: 山札・手札・捨て札・ガッツを動かす(choose は選ぶ段。src … discard/hand、then … 選んだ札の行き先) ----
  114: [{ t: 'rush', n: 5 }], // 突進(そのターンの最初のカード。ほかのカードを出せなくなる)
  122: [{ t: 'choose', src: 'hand', then: 'toDeckShuffleDraw' }], // 最後の切札
  125: [{ t: 'lastWish' }], // 後は頼んだ
  126: [{ t: 'gutsZeroBoth' }], // 戦意喪失
  127: [{ t: 'useWhenAllies', n: 1 }, { t: 'deckToGuts' }], // 最後のきらめき
  137: [{ t: 'choose', src: 'discard', then: 'toDeckBottom' }], // 伝説のちから
  149: [{ t: 'oppHandToDeckBottom' }, { t: 'oppDraw', n: 4 }], // ハテナマーク
  186: [{ t: 'choose', src: 'discard', filter: { kind: 'dge', usable: true }, then: 'toHand' }], // 回避プログラム
  252: [{ t: 'gutsToDeckShuffle' }], // 時間稼ぎ
  253: [{ t: 'selfHurt', n: 1 }, { t: 'draw', n: 1 }], // 冬虫散(味方1体)
  278: [{ t: 'oppGutsLoss', n: 1 }], // 泣き真似
  279: [{ t: 'refresh' }], // リフレッシュ
  303: [{ t: 'choose', src: 'discard', filter: { attack: true, usable: true }, then: 'toHand' }], // 悪夢
  304: [{ t: 'peekPick' }], // 死神の力(相手が手札を見せる → こちらが選んで捨てさせる)
  306: [{ t: 'millOpp', n: 3 }], // 大鎌
  364: [{ t: 'discardBothHands' }], // 超大声
  22: [{ t: 'choose', src: 'discard', then: 'toHand' }], // 作戦の指示
  94: [{ t: 'choose', src: 'hand', then: 'discardDraw2' }], // 素早い計算
  // ---- 区切り5: 守りの新しい形・持ちょうを変える ----
  107: [{ t: 'redirect' }], // 隠れる(目標を自分から他の味方へ。守る人が選ぶ)
  111: [{ t: 'endure', kinds: both }], // 根性(残りのライフ以上のダメージでも、ライフ1で残る)
  123: [{ t: 'evadeAll' }], // みんな下がれ(全員に当たる技を全員が回避)
  163: [{ t: 'shield' }], // 盾になる(1回の攻撃で味方が受けるダメージを全部この子が)
  275: [{ t: 'noGutsLoss' }], // 我慢
  270: [{ t: 'liftAllies' }], // 吹き上げる(狙われていなくても出せる。自分以外の味方を、次のターン終了まで空中に)
  318: [{ t: 'waterAll' }], // ひきずりこむ(狙われていなくても出せる。このターン、味方を全員水中に)
  198: [{ t: 'safe' }], // ぬいぐるみ(次の自分の番まで、どこからのダメージも0)
  249: [{ t: 'takeMult', kinds: ['pow'], n: 2 }, { t: 'nextTurnMult', kinds: ['pow'], n: 3 }], // 肉を切らせて
  185: [{ t: 'form' }, { t: 'draw', n: 1 }], // 変形(空中か地上かを選ぶ)
  293: [{ t: 'form' }, { t: 'draw', n: 1 }], // トランスフォーム
};

// カードの詳しい画面に足す一言。文の読み方を決めた札だけ(2026-10-25 社長「推奨どおり」。一覧: docs/progress/card-battle/pending-83/README.md)
const NOTE_BY_NO = {
  9: '技に付けて一緒に出します(攻撃の1回には数えません)',
  70: '技に付けて一緒に出します(攻撃の1回には数えません)',
  209: '技に付けて一緒に出します(攻撃の1回には数えません)',
  342: '出した子の攻撃1回に数えます。そのターン、ほかの味方の特殊技は0ガッツで出せます',
  363: '回避も防御も出せません',
  366: '回避・防御のカードを名前で名指しします。同じ名前のカードは全部使えません',
  46: '相手は次の番、この子を狙う技しか出せません(全員に当たる技は出せます)',
  365: '相手は次の番、この子を狙う技しか出せません(全員に当たる技は出せます)',
  57: '相手は次の番、この子に当たる技を出せません(全員に当たる技も出せません)',
  269: '相手は次の番、この子を狙う技しか出せません(全員に当たる技も出せません)',
  10: '技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます',
  273: '技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます',
  47: '相手の次の番は、引く・攻撃・ガッツ置きが全部なくなります',
  83: 'その子は、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)',
  294: 'その子は、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)',
  351: '「攻撃できない」を消します。もう攻撃した子には使えません',
  251: '次の番のちから技・かしこさ技が2倍になります',
  114: 'そのターンは、ほかの技・ブリーダーのカードを出せません(ガッツ置きはできます)',
  125: '捨て札の新しいほうから、残りライフの枚数をガッツにします',
  253: 'ライフ1の子にも使えて、その子はKOになります',
  126: '精神集中をしている相手のガッツは減りません。自分のガッツは必ず0になります',
  107: '目標を移す先は、守る人が倒れていない味方から選びます。移した先の子は、もう守れません',
  111: '残りのライフ以上のダメージでも、ライフ1で残ります',
  163: '全員に当たる技なら、味方のぶんを全部この子が受けます。1体を狙う技なら、かばいます',
  198: '相手の技・はね返し・全員に当たる技・自分の技の反動も0にします',
  185: '空中か地上かを選びます。次に変わるまで、ずっとそのままです',
  293: '空中か地上かを選びます。次に変わるまで、ずっとそのままです',
};
const splitSentences = (text) => (text || '').split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
const effectsOf = (no, text) => {
  if (BY_NO[no]) return { ready: true, effects: BY_NO[no] };
  const sents = splitSentences(text);
  const effects = [];
  for (const s of sents) {
    const rule = SENTENCE_RULES.find(([re]) => re.test(s));
    if (!rule) return { ready: false, effects: [], missing: s };
    const e = rule[1](s.match(rule[0]));
    if (e) effects.push(e);
  }
  return { ready: true, effects };
};

const readJson = (dir) => JSON.parse(fs.readFileSync(path.join(SRC, dir, 'cards.json'), 'utf8'));

const build = () => {
  const cards = {};
  const monsters = {};
  const notReady = [];
  const add = (card) => {
    if (cards[card.no]) throw new Error(`番号がだぶっている: ${card.no}`);
    cards[card.no] = card;
  };
  for (const [dir, id, name] of SPECIES) {
    const j = readJson(dir);
    for (const m of j.monster) {
      monsters[m.no] = { no: m.no, species: id, name, type: TYPE[m.type], life: m.life, variant: m.variant || null, wave: (m.no === 'C-031R' || m.no === 'C-031RS') ? 4 : WAVE_OF_SPECIES[id], img: m.img.replace(/\.jpg$/, '') };
    }
    for (const s of j.skills) {
      const no = Number(s.no);
      const eff = effectsOf(no, s.text);
      if (!eff.ready) notReady.push(`${s.no} ${s.name}: ${eff.missing}`);
      add({ no: s.no, name: s.name, kind: KIND[s.kind], damage: Number.isFinite(s.damage) ? s.damage : null, guts: s.guts,
        text: s.text || '', user: id, wave: no >= 357 ? 4 : WAVE_OF_SPECIES[id], ready: eff.ready, effects: eff.effects, img: s.no, ...(NOTE_BY_NO[no] ? { note: NOTE_BY_NO[no] } : {}) });
    }
  }
  for (const [dir, cat] of [['any-monster', 'any'], ['breeder', 'breeder']]) {
    const j = readJson(dir);
    for (const s of j.skills) {
      const no = Number(s.no);
      const eff = effectsOf(no, s.text);
      if (!eff.ready) notReady.push(`${s.no} ${s.name}: ${eff.missing}`);
      add({ no: s.no, name: s.name, kind: KIND[s.kind], damage: Number.isFinite(s.damage) ? s.damage : null, guts: s.guts,
        text: s.text || '', user: cat, wave: waveOfNo(no), ready: eff.ready, effects: eff.effects, img: s.no, ...(NOTE_BY_NO[no] ? { note: NOTE_BY_NO[no] } : {}) });
    }
  }
  const hy = readJson('hybrid');
  for (const m of hy.monster) {
    if (m.excluded) continue;
    monsters[m.no] = { no: m.no, species: `hybrid:${m.no}`, name: m.name, type: TYPE[m.type], life: m.life, variant: null,
      main: SPECIES_BY_NAME[m.main] || m.main, sub: SPECIES_BY_NAME[m.sub] || m.sub, wave: 'hybrid', img: m.img.replace(/\.jpg$/, ''),
      // メインの種族の技が届いていない子は準備中(設計書 4-2。デュラハンは 2026-10-24 に届いた)
      ready: !!SPECIES_BY_NAME[m.main] };
  }
  // スターター(元の表どおり。頭突き → 頭つき はカードの文字に合わせる)
  const dl = JSON.parse(fs.readFileSync(path.join(SRC, 'starter-decklists', 'decklists.json'), 'utf8'));
  const byName = (user, name) => Object.values(cards).find((c) => c.user === user && c.name === name);
  const starters = {};
  for (const [kitId, kit] of Object.entries(dl)) {
    if (kitId === 'note') continue;
    const list = [];
    for (const [grp, entries] of Object.entries(kit.cards)) {
      const user = grp === '全モンスター' ? 'any' : grp === 'ブリーダー' ? 'breeder' : SPECIES_BY_NAME[grp];
      for (const [nm, count] of Object.entries(entries)) {
        const c = byName(user, nm === '頭突き' ? '頭つき' : nm);
        if (!c) throw new Error(`スターターのカードが見つからない: ${kitId} ${grp} ${nm}`);
        for (let i = 0; i < count; i++) list.push(c.no);
      }
    }
    const mons = kit.monsters.map((nm) => Object.values(monsters).find((m) => m.name === nm && !m.variant).no);
    // 箱の名前(台帳: 黄色のキットは「一発逆転ミラクルチーム」・2026-10-24 社長が一発必殺を取り消し)
    const name = kitId === 'miracle' ? '一発逆転ミラクルチーム' : kit.name;
    starters[kitId] = { id: kitId, name, monsters: mons, cards: list };
  }
  for (const [id, kit] of Object.entries(starters)) {
    if (kit.cards.length !== 50) throw new Error(`スターター ${id} が50枚でない: ${kit.cards.length}`);
    const nr = kit.cards.filter((no) => !cards[no].ready);
    if (nr.length) throw new Error(`スターター ${id} に準備中のカードがある: ${[...new Set(nr)].join(' ')}`);
  }
  return { cards, monsters, starters, notReady };
};

const render = ({ cards, monsters, starters }) => {
  const body = { version: 1, cards, monsters, starters };
  return `// MFバトルカードのカードのデータ。tools/card/card-data-build.js が tools/art-sources/card-battle/*/cards.json から作る。
// ★手で書き換えない(書き写しの元は cards.json。効果の部品は card-data-build.js)。設計: docs/spec/CARD_BATTLE.md
const CARD_BATTLE_DATA = ${JSON.stringify(body)};
`;
};

if (require.main === module) {
  const built = build();
  const text = render(built);
  const readyCount = Object.values(built.cards).filter((c) => c.ready).length;
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.log('NG: card-battle-cards.js が cards.json から作り直したものと違う(node tools/card/card-data-build.js で作り直す)'); process.exit(1); }
    console.log(`OK: card-battle-cards.js は最新(技 ${Object.keys(built.cards).length} 枚のうち使える ${readyCount} 枚・モンスター ${Object.keys(built.monsters).length} 枚)`);
  } else {
    fs.writeFileSync(OUT, text);
    console.log(`書き出し: ${path.relative(ROOT, OUT)}(${(text.length / 1024).toFixed(0)}KB。技 ${Object.keys(built.cards).length} 枚のうち使える ${readyCount} 枚・モンスター ${Object.keys(built.monsters).length} 枚・スターター ${Object.keys(built.starters).length} つ)`);
    if (process.argv.includes('--list-missing')) for (const l of built.notReady) console.log(`  準備中: ${l}`);
  }
}

module.exports = { build, effectsOf, SENTENCE_RULES };
