// ===== 助手ライフ「助手たちの家」(段階1・2026-11-07 社長) =====
// 専用ページの真ん中は家の断面。8人それぞれの部屋があり、いる・いないが分かる(いる部屋は灯りと顔、出かけている部屋は灯りが消えて扉に行き先の札)。
// 案と止め絵: docs/progress/assistant-peer/LIFE-HOUSE-PLAN.md・ux/life-house-mock-*.jpg。家の絵は描き下ろしが届くまで図形で組む(注文書 HOUSE-ART-ORDER.md)
// HOME では、遊んでいる所の施設の横に顔だけを出す(AssistantLifeHomeFaces)。家と町にいる助手は施設「🏡 助手ライフ」の横
// 保存は足すだけ: 今日あったこと mh_assistant_life_diary_v1 / 入場を長く見せた日 mh_assistant_life_intro_v1
// 公開の印 assistantLife の後ろ。様子の仕組み・台本の引き方は 56-assistant-life.jsx

const ASSISTANT_LIFE_HOUSE_ORDER = Object.freeze(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
// 部屋の壁の色と家具(描き下ろしの絵が届くまでの仮。注文書の表と同じ)
const ASSISTANT_LIFE_ROOM_LOOK = Object.freeze({
  mua:       { wall: ['#fde4f0', '#f9c4dd'], furn: '🪞🎀🍰' },
  kiki:      { wall: ['#ece7ff', '#d6ccfb'], furn: '🫖📚🗿' },
  momosuke:  { wall: ['#ffe9d6', '#fdd0a8'], furn: '🎹🎧' },
  dra:       { wall: ['#e3f8e6', '#bfe9c7'], furn: '🛏️🍪' },
  atsu:      { wall: ['#ffe2e2', '#f8bcbc'], furn: '🥁🐉' },
  kyuko:     { wall: ['#e0f2fe', '#b9e0f8'], furn: '📚🎼' },
  sorashido: { wall: ['#fff8d6', '#f6e59a'], furn: '🃏🧮' },
  erubin:    { wall: ['#e8edf3', '#c9d3df'], furn: '⚔️🛡️' },
});
const ASSISTANT_LIFE_PLACE_ICON = Object.freeze({ home: '🏡', plaza: '⛲', cafe: '🍰', studio: '🎵', ranch: '🥚', cardroom: '🃏', library: '📚', market: '🛍️', hill: '🌄', garden: '🌷' });
// 出かけている先を、HOME のどの施設に出すか(していること → 施設)。家と町は「🏡 助手ライフ」
// 遊び場(段階2・LIFE-STAGE2-PLAN.md): 札・居場所・地図・場面の題では、ゲームの遊びの場所を施設の名前で出す(「🎵 モンヒロビートへ」)。
//   台本の穴 {place} の言葉(ASSISTANT_LIFE_PLACES)は変えない。今日あったことも今の言葉のまま
const ASSISTANT_LIFE_PLACE_SHOW = Object.freeze({ studio: 'モンヒロビート', cardroom: 'MFバトルカード', ranch: 'M/B管理' });
const assistantLifePlaceShow = (place) => ASSISTANT_LIFE_PLACE_SHOW[place] || ASSISTANT_LIFE_PLACES[place] || '';
const assistantLifeFacilityOf = (entry) => {
  if (!entry) return 'life';
  if (entry.doing === 'practice') return 'rhythm';
  if (entry.doing === 'cards' && entry.place === 'cardroom') return 'card';
  if (entry.doing === 'training') return 'management';
  if (entry.place === 'market') return 'market';
  return 'life';
};
// 時間帯の見た目(朝・昼・夕・夜)。ゲーム全体の「時間帯で雰囲気を変える」(ハナビの 44-time-of-day.jsx)とそろえる(2026-11-07 統括の決定)
//   区切りは社長の決定: 朝 5:00〜/昼 10:00〜/夕 16:00〜/夜 19:00〜4:59(日本時間)。助手の居場所が入れかわる6つの区切りとは別
//   <html data-mh-tod="morning|day|evening|night"> の印があればそれに従い、無ければ同じ区切りでここで決める
const ASSISTANT_LIFE_TOD_LOOK = Object.freeze({ morning: 'morning', day: 'noon', evening: 'evening', night: 'night' });
const assistantLifeTimeLook = (now = Date.now()) => {
  try { const tod = typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-mh-tod'); if (tod && ASSISTANT_LIFE_TOD_LOOK[tod]) return ASSISTANT_LIFE_TOD_LOOK[tod]; } catch {}
  const h = new Date(Number(now) + 9 * 3600000).getUTCHours();
  return h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'noon' : h >= 16 && h < 19 ? 'evening' : 'night';
};
// 窓の外・場面の背景(お話の背景の絵。広場と森は時間帯の絵がある)
const ASSISTANT_LIFE_VIEW = Object.freeze({
  morning: ['images/story-bg/monhero_plaza.jpg', 'images/story-bg/forest_morning.jpg'],
  noon:    ['images/story-bg/monhero_plaza.jpg', 'images/story-bg/forest_deep.jpg'],
  evening: ['images/story-bg/monhero_plaza_evening.jpg', 'images/story-bg/forest_evening.jpg'],
  night:   ['images/story-bg/monhero_night.jpg', 'images/story-bg/forest_night.jpg'],
});
const ASSISTANT_LIFE_BGM_TRACK = 'kaze_ga_soyogu'; // 助手ライフの曲(2026-11-07 社長: 今ある「風がそよぐ場所」)

// 寝ている助手の寝言・起こされた反応(2026-11-07 社長「寝てるのに話したら普通に会話した」)。台本はコトバ(kotoba-house.txt の sleep 行)
// <life-sleep-talks:begin>
// ここは tools/assistant/life-sleep-talks-import.js が書く(手で直さない。台本は docs/progress/assistant-peer/lines/kotoba-house.txt)。80本
const ASSISTANT_LIFE_SLEEP_TALKS = Object.freeze([
  { id:'life-sleep-mua-001', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'happy', t:'…むにゃ…プリン、もう1個だけぇ…' }] },
  { id:'life-sleep-mua-002', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'happy', t:'…んふふ…このコーデ、まぢ優勝…' }] },
  { id:'life-sleep-mua-003', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'normal', t:'…あと5分…いや、あと5曲…' }] },
  { id:'life-sleep-mua-004', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'happy', t:'…モッチー…ふわふわ…ぢゃん…' }] },
  { id:'life-sleep-mua-005', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'normal', t:'…{name}…いっしょに、広場いこ…' }] },
  { id:'life-sleep-mua-006', kind:'life-sleep', who:'mua', line:'talk', lv:null, lines:[{ who:'mua', e:'excited', t:'…フルコン…きた…！ …すぅ…' }] },
  { id:'life-sleep-kiki-001', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'normal', t:'…すぅ…火力は…ぜんぶ攻撃に…' }] },
  { id:'life-sleep-kiki-002', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'happy', t:'…お茶が…はいりましたよ…むにゃ' }] },
  { id:'life-sleep-kiki-003', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'normal', t:'…ゴーレムさん…今日も、かたいでつね…' }] },
  { id:'life-sleep-kiki-004', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'happy', t:'…{name}…おはようございまつ…すぅ' }] },
  { id:'life-sleep-kiki-005', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'normal', t:'…しおりは…ここに…はさんで…' }] },
  { id:'life-sleep-kiki-006', kind:'life-sleep', who:'kiki', line:'talk', lv:null, lines:[{ who:'kiki', e:'happy', t:'…ちから…全開…でつ…' }] },
  { id:'life-sleep-momosuke-001', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'happy', t:'…むにゃ…もも、センター…♡' }] },
  { id:'life-sleep-momosuke-002', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'normal', t:'…HELL…もう1回…' }] },
  { id:'life-sleep-momosuke-003', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'happy', t:'…メタルナー…ぴかぴか…w' }] },
  { id:'life-sleep-momosuke-004', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'normal', t:'…アンコール…ありがと…すぅ' }] },
  { id:'life-sleep-momosuke-005', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'happy', t:'…{name}…見ててね…♡' }] },
  { id:'life-sleep-momosuke-006', kind:'life-sleep', who:'momosuke', line:'talk', lv:null, lines:[{ who:'momosuke', e:'normal', t:'…ミス…ゼロ…！！ …すぅ' }] },
  { id:'life-sleep-dra-001', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'happy', t:'…ぐぅ…グジラ…でっかいな…' }] },
  { id:'life-sleep-dra-002', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'normal', t:'…ふとんが…むにゃ…' }] },
  { id:'life-sleep-dra-003', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'happy', t:'…アルミ缶の…上に…すぅ' }] },
  { id:'life-sleep-dra-004', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'normal', t:'…おで…まだ…食べられるぞ…' }] },
  { id:'life-sleep-dra-005', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'happy', t:'…{name}…膝…だいじょうぶか…' }] },
  { id:'life-sleep-dra-006', kind:'life-sleep', who:'dra', line:'talk', lv:null, lines:[{ who:'dra', e:'normal', t:'…あと10時間…寝かせてくれ…' }] },
  { id:'life-sleep-atsu-001', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'normal', t:'…ドラゴン…もう1周…！' }] },
  { id:'life-sleep-atsu-002', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'happy', t:'…勝った…笑 …すぅ…' }] },
  { id:'life-sleep-atsu-003', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'normal', t:'…とりあえず…突っこむ…' }] },
  { id:'life-sleep-atsu-004', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'normal', t:'…てか…ノーカン…だろ…' }] },
  { id:'life-sleep-atsu-005', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'happy', t:'…{name}…ナイス…！' }] },
  { id:'life-sleep-atsu-006', kind:'life-sleep', who:'atsu', line:'talk', lv:null, lines:[{ who:'atsu', e:'normal', t:'…朝練…6時…！' }] },
  { id:'life-sleep-kyuko-001', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'normal', t:'…むにゃ…その本、あと1章だけぇ…' }] },
  { id:'life-sleep-kyuko-002', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'happy', t:'…ニャー…ふかふかぁ…' }] },
  { id:'life-sleep-kyuko-003', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'normal', t:'…ぐぬぬぬ…あと1枚…' }] },
  { id:'life-sleep-kyuko-004', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'happy', t:'…ほい…ありがとん…すぅ' }] },
  { id:'life-sleep-kyuko-005', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'normal', t:'…だいたい…97点…' }] },
  { id:'life-sleep-kyuko-006', kind:'life-sleep', who:'kyuko', line:'talk', lv:null, lines:[{ who:'kyuko', e:'happy', t:'…{name}…イルミネ、きれいだねぇ…' }] },
  { id:'life-sleep-sorashido-001', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'…表の…3行目…ずれてる…' }] },
  { id:'life-sleep-sorashido-002', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'…うぉぉぉ…新記録…むにゃ' }] },
  { id:'life-sleep-sorashido-003', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'…なんくるないさ…すぅ…' }] },
  { id:'life-sleep-sorashido-004', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'…確率…でーじ…高い…' }] },
  { id:'life-sleep-sorashido-005', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'…攻略本…完成…だぜ…' }] },
  { id:'life-sleep-sorashido-006', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'…{name}…ちばりよー…' }] },
  { id:'life-sleep-erubin-001', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'normal', t:'…すぅ…デュラハン…いけ…' }] },
  { id:'life-sleep-erubin-002', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'happy', t:'…みんな…おやすみ…' }] },
  { id:'life-sleep-erubin-003', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'normal', t:'…もう1戦…いいね…' }] },
  { id:'life-sleep-erubin-004', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'happy', t:'…お茶…おいしいね…' }] },
  { id:'life-sleep-erubin-005', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'normal', t:'…ちがうよ…石油王じゃ…ないって…' }] },
  { id:'life-sleep-erubin-006', kind:'life-sleep', who:'erubin', line:'talk', lv:null, lines:[{ who:'erubin', e:'happy', t:'…{name}…今日も、ありがとう…' }] },
  { id:'life-sleep-mua-007', kind:'life-sleep', who:'mua', line:'woken', lv:'1-4', lines:[{ who:'mua', e:'surprise', t:'ふぇっ！？ {name}！？ …あ、寝ぐせ見ないで〜！' }] },
  { id:'life-sleep-mua-008', kind:'life-sleep', who:'mua', line:'woken', lv:'1-4', lines:[{ who:'mua', e:'troubled', t:'…ん…まだ朝？ あたし、朝ほんとに弱くて…ごめんね' }] },
  { id:'life-sleep-mua-009', kind:'life-sleep', who:'mua', line:'woken', lv:'5-10', lines:[{ who:'mua', e:'troubled', t:'んー…{name}…あと5分だけぇ…' }, { who:'mua', e:'happy', t:'…しょうがないなぁ、起きるぢゃん♪' }] },
  { id:'life-sleep-mua-010', kind:'life-sleep', who:'mua', line:'woken', lv:'5-10', lines:[{ who:'mua', e:'angry', t:'もう！ いい夢見てたのに〜！ …で、なに？ｗ' }] },
  { id:'life-sleep-kiki-007', kind:'life-sleep', who:'kiki', line:'woken', lv:'1-4', lines:[{ who:'kiki', e:'surprise', t:'…まあ、{name}。私、うとうとしていましたか' }, { who:'kiki', e:'happy', t:'お見苦しいところを。お茶でもいれまつね' }] },
  { id:'life-sleep-kiki-008', kind:'life-sleep', who:'kiki', line:'woken', lv:'1-4', lines:[{ who:'kiki', e:'normal', t:'…はい、起きまつ。早寝なので、少しぼんやりしていまつ' }] },
  { id:'life-sleep-kiki-009', kind:'life-sleep', who:'kiki', line:'woken', lv:'5-10', lines:[{ who:'kiki', e:'troubled', t:'…{name}…もう22時すぎでつよ…' }, { who:'kiki', e:'happy', t:'…でも、来てくれたのはうれしいでつ♪' }] },
  { id:'life-sleep-kiki-010', kind:'life-sleep', who:'kiki', line:'woken', lv:'5-10', lines:[{ who:'kiki', e:'happy', t:'…ふふ、起こされてしまいました。少しだけ、お話ししまつか' }] },
  { id:'life-sleep-momosuke-007', kind:'life-sleep', who:'momosuke', line:'woken', lv:'1-4', lines:[{ who:'momosuke', e:'surprise', t:'わっ！！ な、なに！？ もも寝てないよ！！' }] },
  { id:'life-sleep-momosuke-008', kind:'life-sleep', who:'momosuke', line:'woken', lv:'1-4', lines:[{ who:'momosuke', e:'troubled', t:'…ん…いま何時…？ 朝は、もも苦手なの…' }] },
  { id:'life-sleep-momosuke-009', kind:'life-sleep', who:'momosuke', line:'woken', lv:'5-10', lines:[{ who:'momosuke', e:'angry', t:'ちょっとー！！ 寝起きの顔見ないで！！' }, { who:'momosuke', e:'happy', t:'…まあ、{name}ならいっか♡' }] },
  { id:'life-sleep-momosuke-010', kind:'life-sleep', who:'momosuke', line:'woken', lv:'5-10', lines:[{ who:'momosuke', e:'troubled', t:'…むにゃ…起こすなら、おやつ持ってきてw' }] },
  { id:'life-sleep-dra-007', kind:'life-sleep', who:'dra', line:'woken', lv:'1-4', lines:[{ who:'dra', e:'surprise', t:'…ん、おお、{name}か。寝てたぞ' }] },
  { id:'life-sleep-dra-008', kind:'life-sleep', who:'dra', line:'woken', lv:'1-4', lines:[{ who:'dra', e:'troubled', t:'…すまん、もうちょっとだけ寝かせてくれるか…' }] },
  { id:'life-sleep-dra-009', kind:'life-sleep', who:'dra', line:'woken', lv:'5-10', lines:[{ who:'dra', e:'troubled', t:'…{name}…いま、いい夢だったんだがな…' }, { who:'dra', e:'happy', t:'まあ、起こされたなら起きるか' }] },
  { id:'life-sleep-dra-010', kind:'life-sleep', who:'dra', line:'woken', lv:'5-10', lines:[{ who:'dra', e:'normal', t:'…ぐぅ……はっ、起きてるぞ。目は閉じてるけどな' }] },
  { id:'life-sleep-atsu-007', kind:'life-sleep', who:'atsu', line:'woken', lv:'1-4', lines:[{ who:'atsu', e:'surprise', t:'…ん！？ あ、{name}か！ 寝てた笑' }] },
  { id:'life-sleep-atsu-008', kind:'life-sleep', who:'atsu', line:'woken', lv:'1-4', lines:[{ who:'atsu', e:'normal', t:'…おう…朝練の前に、もうちょい寝る…' }] },
  { id:'life-sleep-atsu-009', kind:'life-sleep', who:'atsu', line:'woken', lv:'5-10', lines:[{ who:'atsu', e:'troubled', t:'…{name}かよ… 夜は寝かせろって笑' }, { who:'atsu', e:'happy', t:'…まあいいや、起きた！ なんだ？' }] },
  { id:'life-sleep-atsu-010', kind:'life-sleep', who:'atsu', line:'woken', lv:'5-10', lines:[{ who:'atsu', e:'happy', t:'…ふぁ…起こしたなら、朝いっしょに走るぞ笑' }] },
  { id:'life-sleep-kyuko-007', kind:'life-sleep', who:'kyuko', line:'woken', lv:'1-4', lines:[{ who:'kyuko', e:'surprise', t:'…ぇ、あ、{name}…？ 寝ぼけてたぁ' }] },
  { id:'life-sleep-kyuko-008', kind:'life-sleep', who:'kyuko', line:'woken', lv:'1-4', lines:[{ who:'kyuko', e:'troubled', t:'…ん…朝はまだ、むりぃ…' }] },
  { id:'life-sleep-kyuko-009', kind:'life-sleep', who:'kyuko', line:'woken', lv:'5-10', lines:[{ who:'kyuko', e:'troubled', t:'…{name}ぉ…いま、本の夢見てたのにぃ' }, { who:'kyuko', e:'happy', t:'…ま、いっか。ほい、起きたよ笑' }] },
  { id:'life-sleep-kyuko-010', kind:'life-sleep', who:'kyuko', line:'woken', lv:'5-10', lines:[{ who:'kyuko', e:'normal', t:'…ぐぬぬぬ…起こされたぁ。ありがとん…なのかなぁ' }] },
  { id:'life-sleep-sorashido-007', kind:'life-sleep', who:'sorashido', line:'woken', lv:'1-4', lines:[{ who:'sorashido', e:'surprise', t:'…うぉっ！？ {name}か…寝ぼけてたぜ' }] },
  { id:'life-sleep-sorashido-008', kind:'life-sleep', who:'sorashido', line:'woken', lv:'1-4', lines:[{ who:'sorashido', e:'troubled', t:'…まだ10時前だろ…朝は弱いのさ…' }] },
  { id:'life-sleep-sorashido-009', kind:'life-sleep', who:'sorashido', line:'woken', lv:'5-10', lines:[{ who:'sorashido', e:'troubled', t:'…{name}…いま、表の夢の途中だったんだぜ…' }, { who:'sorashido', e:'happy', t:'…まあいいさ。起きたからには、計算するぜ' }] },
  { id:'life-sleep-sorashido-010', kind:'life-sleep', who:'sorashido', line:'woken', lv:'5-10', lines:[{ who:'sorashido', e:'happy', t:'…ふぁ…{name}の声なら、目ざましより効くさ' }] },
  { id:'life-sleep-erubin-007', kind:'life-sleep', who:'erubin', line:'woken', lv:'1-4', lines:[{ who:'erubin', e:'surprise', t:'…あ、{name}。ごめんね、寝てたみたい' }] },
  { id:'life-sleep-erubin-008', kind:'life-sleep', who:'erubin', line:'woken', lv:'1-4', lines:[{ who:'erubin', e:'normal', t:'…ん…どうしたの？ 何かあった？' }] },
  { id:'life-sleep-erubin-009', kind:'life-sleep', who:'erubin', line:'woken', lv:'5-10', lines:[{ who:'erubin', e:'troubled', t:'…{name}…もう23時すぎてるよ…' }, { who:'erubin', e:'happy', t:'…でも、顔見られてよかった。少しだけ話そっか' }] },
  { id:'life-sleep-erubin-010', kind:'life-sleep', who:'erubin', line:'woken', lv:'5-10', lines:[{ who:'erubin', e:'happy', t:'…ふぁ…起こされちゃった笑 どうしたの？' }] },
]);
// <life-sleep-talks:end>
// 寝ている助手に声をかけた/ようすを見た: 6割は寝言(1行)、4割は起こされた反応(仲良し度 Lv5 で言い方が変わる)。ようすを見るときは寝言だけ
const assistantLifePickSleepTalk = (id, { wake = true, bondLv = 1, place = 'home' } = {}) => {
  const all = (typeof ASSISTANT_LIFE_SLEEP_TALKS !== 'undefined' ? ASSISTANT_LIFE_SLEEP_TALKS : []).filter(t => t.who === id);
  const band = bondLv >= 5 ? '5-10' : '1-4';
  const talk = all.filter(t => t.line === 'talk'), woken = all.filter(t => t.line === 'woken' && (!t.lv || t.lv === band));
  const list = wake && woken.length && Math.random() < 0.4 ? woken : (talk.length ? talk : woken);
  if (!list.length) return null;
  const t = list[Math.floor(Math.random() * list.length)];
  return { ...t, pair: [id], lv: 1, scene: 'any', lifePlace: place, lifeDoing: 'sleep' };
};
// 場面に流す台本は、その場にいる助手が話すものだけ(いない助手の行は外す。残らなければ流さない)
const assistantLifeOnlyPresent = (talk, ids) => {
  if (!talk || !Array.isArray(talk.lines)) return talk;
  if (talk.lines.every(l => ids.includes(l.who))) return talk;
  const lines = talk.lines.filter(l => ids.includes(l.who));
  return lines.length ? { ...talk, lines } : null;
};

// いま、その助手がどこで誰と何をしているか(様子がその時間のものでなければ null)
const assistantLifeWhereOf = (life, id) => {
  if (!life) return null;
  const g = (life.groups || []).find(x => x.ids.includes(id));
  if (g) return { id, place: g.place, doing: g.doing, with: g.ids.filter(x => x !== id), group: g, reason: null };
  const s = (life.solo || {})[id];
  if (s) return { id, place: s.place, doing: s.doing, with: [], group: null, reason: s.reason || null };
  return null;
};
const assistantLifeCurrent = () => {
  if (!assistantLifeEnabled() || typeof ASSISTANT_LIFE_STORE === 'undefined') return null;
  const life = ASSISTANT_LIFE_STORE.state.life;
  return life && life.abs === assistantLifeSlotAt().abs ? life : null;
};
// いまモンヒロビートにいる助手(ビート部とのつなぎ口。「練習」している時間帯がモンビーにいる時間)
const assistantLifeAtBeat = (id) => { const w = assistantLifeWhereOf(assistantLifeCurrent(), id); return !!(w && w.doing === 'practice'); };
// いま寝ているか(読むだけ。ビート部の「寝ている助手を呼ぶ」・カード部が使う。2026-11-07 マモリと決めた)
const assistantLifeAsleep = (id) => { try { const w = assistantLifeWhereOf(assistantLifeCurrent(), id); return !!(w && w.doing === 'sleep'); } catch (_) { return false; } };
const assistantLifeBeatIds = () => ASSISTANT_LIFE_HOUSE_ORDER.filter(assistantLifeAtBeat);
// いまカード部屋でカード研究をしている助手(カード部とのつなぎ口。読むだけ。2026-11-07 社長「カード部屋にいる助手と対戦すると、ごほうび1.5倍」)。
//   印が偽・いまの時間の様子がまだ無いときは false/[]。図書室でのカード研究は入れない。組で来ていれば全員。
//   カード部は assistantLifeNow を呼ばない(様子を決め直して保存するため)。ごほうびは「対戦を始めた時点でいたか」で決める(カード部の案)
const assistantLifeAtCard = (id) => { try { const w = assistantLifeWhereOf(assistantLifeCurrent(), id); return !!(w && w.doing === 'cards' && w.place === 'cardroom'); } catch (_) { return false; } };
const assistantLifeCardIds = () => ASSISTANT_LIFE_HOUSE_ORDER.filter(assistantLifeAtCard);
// 家にいる組は、だれかひとりの部屋に集まる(家が好きな助手 → 並びの先)
const assistantLifeHostOf = (ids) => ids.find(id => ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].fav === 'home') || [...ids].sort((a, b) => ASSISTANT_LIFE_HOUSE_ORDER.indexOf(a) - ASSISTANT_LIFE_HOUSE_ORDER.indexOf(b))[0];

// ---------- 今日あったこと(家の掲示板・部屋を押したとき) ----------
const ASSISTANT_LIFE_DIARY_KEY = 'mh_assistant_life_diary_v1';
const ASSISTANT_LIFE_DIARY_MAX = 40;
const normalizeAssistantLifeDiary = (v) => {
  const raw = v && typeof v === 'object' ? v : {};
  const items = Array.isArray(raw.items) ? raw.items.filter(x => x && typeof x.text === 'string').map(x => ({
    t: typeof x.t === 'string' ? x.t : '', text: x.text.slice(0, 80), ids: Array.isArray(x.ids) ? x.ids.filter(i => typeof i === 'string') : [], kind: typeof x.kind === 'string' ? x.kind : 'note',
  })) : [];
  return { day: typeof raw.day === 'string' ? raw.day : null, items: items.slice(-ASSISTANT_LIFE_DIARY_MAX), slots: Array.isArray(raw.slots) ? raw.slots.filter(Number.isFinite).slice(-6) : [] };
};
const ASSISTANT_LIFE_DIARY = {
  state: normalizeAssistantLifeDiary(null), loaded: false, loading: null, listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    if (!this.loading) this.loading = (async () => { try { this.state = normalizeAssistantLifeDiary(await storeGet(ASSISTANT_LIFE_DIARY_KEY, null, false)); } catch {} this.loaded = true; this.emit(); return this.state; })();
    return this.loading;
  },
};
const assistantLifeClock = (now = Date.now()) => { const d = new Date(Number(now) + 9 * 3600000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const assistantLifeDiaryAdd = async (text, ids = [], { kind = 'note', now = Date.now(), slotAbs = null } = {}) => {
  if (!assistantLifeEnabled() || !text) return;
  await ASSISTANT_LIFE_DIARY.load();
  const day = assistantLifeDayKey(now);
  const cur = ASSISTANT_LIFE_DIARY.state.day === day ? ASSISTANT_LIFE_DIARY.state : { day, items: [], slots: [] };
  if (slotAbs != null && cur.slots.includes(slotAbs)) return;
  const items = [...cur.items, { t: assistantLifeClock(now), text: String(text).slice(0, 80), ids, kind }].slice(-ASSISTANT_LIFE_DIARY_MAX);
  ASSISTANT_LIFE_DIARY.state = { day, items, slots: slotAbs != null ? [...cur.slots, slotAbs].slice(-6) : cur.slots };
  ASSISTANT_LIFE_DIARY.emit();
  try { storeSet(ASSISTANT_LIFE_DIARY_KEY, ASSISTANT_LIFE_DIARY.state, false); } catch {}
};
const assistantLifeName = (id) => (typeof assistantById === 'function' && assistantById(id) ? assistantById(id).name : id);
// 一緒にいる全員の名前(2026-11-07 社長「3人でも4人でも同時に遊んでるならそう書く」)。並びは家の並び。max を超えたら「ほか◯人」
const assistantLifeGroupNames = (ids, max = 4) => {
  const list = [...ids].sort((a, b) => ASSISTANT_LIFE_HOUSE_ORDER.indexOf(a) - ASSISTANT_LIFE_HOUSE_ORDER.indexOf(b)).map(assistantLifeName);
  return list.length > max ? `${list.slice(0, max - 1).join('・')} ほか${list.length - max + 1}人` : list.join('・');
};
// 時間が変わって様子が決まったら、組の過ごし方を書く(同じ時間は1回だけ)
// 画面に出す時間帯の言葉(朝・昼・夕・夜)。見出しの札・HOME と同じ区切りにそろえる(居場所の入れかわりの6つの区切りとは別。2026-11-07 ミハリ L8・ハナビ)
const assistantLifeTodLabel = (now = Date.now()) => {
  try { if (typeof timeOfDayLabelAt === 'function') return timeOfDayLabelAt(now); } catch (_) {}
  return { morning: '朝', noon: '昼', evening: '夕', night: '夜' }[assistantLifeTimeLook(now)];
};
const assistantLifeDiaryOnSlot = (life, slot, now = Date.now()) => {
  const gs = (life.groups || []).slice(0, 3);
  if (!gs.length) return;
  const text = gs.map(g => `${g.ids.map(assistantLifeName).join('・')} ${ASSISTANT_LIFE_PLACES[g.place]}で${ASSISTANT_LIFE_DOINGS[g.doing].label}`).join(' / ');
  void assistantLifeDiaryAdd(`${assistantLifeTodLabel(now)}: ${text}`, gs.flatMap(g => g.ids), { kind: 'slot', now, slotAbs: slot.abs });
};
// モンヒロビートの助手とのセッション(ビート部とのつなぎ口)。向きは「ビート部が呼ぶ」:
//   1曲終えて助手が育ったら、ビート部が assistantLifeOnSessionLive(ev) を呼ぶ(ev = { assistantId, partnerIds, songId, levelUp, level, duo, at })
//   家の部屋から「一緒にモンビー」を押したら、ビート部が入れておいた ASSISTANT_LIFE_LINKS.beatInvite(助手id) を呼ぶ(無ければボタンを出さない)
const ASSISTANT_LIFE_LINKS = { beatInvite: null };
// 寝ている助手を呼んだ結果(ビート部が typeof で確かめて呼ぶ)。来てくれたら今日あったことに残し、夜に誘って遊んだに数える
const assistantLifeOnWoken = (ev) => {
  if (!ev || !ev.assistantId || !ASSISTANT_LIFE_PREFS[ev.assistantId]) return;
  if (!ev.came) return; // 断られたときは残さない(何もなかったのと同じ)
  assistantLifeRhythmPlay(ev.assistantId, ev.at || Date.now());
  void assistantLifeDiaryAdd(`${assistantLifeName(ev.assistantId)} 起こされてモンヒロビートへ`, [ev.assistantId], { kind: 'woken' });
};
// カード部屋の助手と対戦した(カード部が typeof で確かめて、対戦が終わったら呼ぶ)。ev = { assistantId, won, at }
//   今日あったことに1件・生活のリズムの「誘って遊んだ」に数える。勝ち負けで文を変える
const assistantLifeOnCardMatch = (ev) => {
  if (!ev || !ev.assistantId || !ASSISTANT_LIFE_PREFS[ev.assistantId]) return;
  assistantLifeRhythmPlay(ev.assistantId, ev.at || Date.now());
  void assistantLifeDiaryAdd(`${assistantLifeName(ev.assistantId)}とカード部屋で対戦して${ev.won ? '勝った' : '負けた'}`, [ev.assistantId], { kind: 'card', now: ev.at || Date.now() });
};
const assistantLifeOnSessionLive = (ev) => {
  if (!ev || !ev.assistantId) return;
  const ids = [ev.assistantId, ...((ev.partnerIds || []).filter(x => x !== ev.assistantId))];
  const who = ids.map(assistantLifeName).join('・');
  for (const id of ids) assistantLifeRhythmPlay(id, ev.at || Date.now());
  void assistantLifeDiaryAdd(`${who} セッション${ev.duo ? '(デュオ)' : ''}${ev.levelUp && ev.level ? ` → 🎵Lv${ev.level}` : ''}`, ids, { kind: 'session' });
};
const useAssistantLifeDiary = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_DIARY.state);
  React.useEffect(() => { ASSISTANT_LIFE_DIARY.listeners.add(setSt); ASSISTANT_LIFE_DIARY.load().then(setSt).catch(() => {}); return () => { ASSISTANT_LIFE_DIARY.listeners.delete(setSt); }; }, []);
  return st.day === assistantLifeDayKey() ? st : { ...st, items: [] };
};
// セッションLv(ビート部の値を読むだけ)
const assistantLifeSessionInfo = (id) => {
  try {
    if (typeof RHYTHM_ASSIST_SESSION_STORE === 'undefined' || typeof rhythmAssistSessionLevel !== 'function') return null;
    const st = RHYTHM_ASSIST_SESSION_STORE.get();
    const lv = rhythmAssistSessionLevel(st, id);
    const mon = typeof rhythmAssistSessionMon === 'function' ? rhythmAssistSessionMon(st, id) : null;
    return { level: lv, lives: mon && Number.isFinite(mon.lives) ? mon.lives : 0 };
  } catch { return null; }
};

// ---------- 入場の演出(毎回。その日の最初は長く・2回目からは短く。タップで飛ばせる) ----------
const ASSISTANT_LIFE_INTRO_KEY = 'mh_assistant_life_intro_v1';

// ---------- 見た目(CSS) ----------
const ASSISTANT_LIFE_HOUSE_CSS = `
.mhl-root{position:fixed;inset:0;display:flex;justify-content:center;background:#05030f}
.mhl-page{position:relative;display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;color:#fff}
.mhl-sky{position:absolute;inset:0}
.mhl-sky.t-noon{background:linear-gradient(#7cc4f5,#cdeafe 60%,#e6f6d8)}.mhl-sky.t-morning{background:linear-gradient(#f9c6c9,#fde7c8 55%,#e8f3dc)}
.mhl-sky.t-evening{background:linear-gradient(#5b2a6e,#e8775a 50%,#f6c98b)}.mhl-sky.t-night{background:linear-gradient(#070b24,#1b2452 60%,#22305e)}
.mhl-wood{position:absolute;left:0;right:0;bottom:0;height:52%;background-size:cover;background-position:center bottom;opacity:.75}
.mhl-hdr{position:relative;z-index:5;padding:8px 12px 6px;background:linear-gradient(180deg,#140b2ef2,#140b2ecc 75%,#140b2e00)}
.mhl-en{font-size:9px;letter-spacing:.18em;font-weight:900;color:#f9a8d4}
.mhl-ti{font-size:22px;font-weight:900;line-height:1.05;background:linear-gradient(90deg,#fff,#fbcfe8 60%,#fde68a);-webkit-background-clip:text;background-clip:text;color:transparent}
.mhl-clock{border-radius:12px;padding:3px 8px;border:1px solid #ffffff33;background:rgba(15,23,42,.72);text-align:right}
.mhl-chip{display:inline-flex;align-items:center;gap:3px;background:linear-gradient(90deg,#be185d,#f59e0b);padding:1px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap}
.mhl-bar{flex:1;height:7px;border-radius:9px;background:#ffffff1f;overflow:hidden}.mhl-bar>i{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fbbf24)}
.mhl-body{position:relative;z-index:2;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
.mhl-house{position:relative;margin:0 auto}
.mhl-roof{position:absolute;left:-8px;right:-8px;top:0;clip-path:polygon(50% 0,100% 100%,0 100%);background:repeating-linear-gradient(0deg,#7a2e1e 0 7px,#5e2216 7px 9px);box-shadow:inset 0 -6px 0 #3b140c}
.mhl-chim{position:absolute;width:20px;background:#6b4a3a;border:2px solid #3b2a20}
.mhl-attic{position:absolute;left:50%;transform:translateX(-50%);width:40px;height:40px;border-radius:50%;border:4px solid #e8c37a;background:#1e293b;display:grid;place-items:center;font-size:14px}
.mhl-hname{position:absolute;z-index:3;left:50%;transform:translateX(-50%);font-size:11px;font-weight:900;padding:1px 10px;border-radius:8px;background:linear-gradient(#5b3a1e,#3b2412);border:1.5px solid #e8c37a;color:#fff3d6;white-space:nowrap}
.mhl-frame{position:absolute;left:0;right:0;background:#6b4423;border-radius:4px;box-shadow:0 10px 24px #0008}
.mhl-room{position:absolute;overflow:hidden;border-radius:3px;padding:0;border:0;text-align:left;cursor:pointer}
.mhl-room:active{filter:brightness(1.12)}
.mhl-room .w{position:absolute;inset:0}
.mhl-room .fl{position:absolute;left:0;right:0;bottom:0;height:13px;background:repeating-linear-gradient(90deg,#b07a4a 0 22px,#9a6a3e 22px 24px)}
.mhl-room .win{position:absolute;right:6px;top:6px;width:27%;height:36%;border:3px solid #f5e6c8;border-radius:3px;overflow:hidden;background:#000}
.mhl-room .win img{width:100%;height:100%;object-fit:cover}
.mhl-room .win:before,.mhl-room .win:after{content:"";position:absolute;top:0;bottom:0;width:22%;background:linear-gradient(90deg,#f9a8d4cc,#f472b688);z-index:1}
.mhl-room .win:before{left:0}.mhl-room .win:after{right:0;transform:scaleX(-1)}
.mhl-room .pl{position:absolute;left:5px;top:5px;z-index:3;font-size:10px;font-weight:900;padding:0 6px;border-radius:6px;background:#fffbeb;color:#422006;border:1px solid #d6b37a}
.mhl-room .lv{position:absolute;left:5px;top:22px;z-index:3;font-size:9px;font-weight:900;padding:0 4px;border-radius:5px;background:#312e81;color:#fde68a;border:1px solid #fde68a88}
.mhl-room .fu{position:absolute;left:5px;bottom:9px;z-index:2;font-size:19px;letter-spacing:1px}
.mhl-room .pp{position:absolute;bottom:9px;right:10%;z-index:4;display:flex}
.mhl-room .pp>span{border-radius:50%;box-shadow:0 2px 6px #0008}.mhl-room .pp>span+span{margin-left:-10px}
.mhl-room .pp .lonely{box-shadow:0 0 0 2.5px #fbbf24,0 0 10px #fbbf24}.mhl-room .pp .after{box-shadow:0 0 0 2.5px #7dd3fc}
.mhl-room .bb{position:absolute;right:4px;z-index:5;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9.5px;font-weight:900;background:#fff;color:#1e293b;border-radius:9px;padding:1px 6px;box-shadow:0 2px 5px #0007}
.mhl-room .off{position:absolute;inset:0;z-index:3;background:rgba(6,9,24,.5)}
.mhl-room .lamp{position:absolute;inset:0;z-index:3;background:radial-gradient(circle at 60% 40%,rgba(255,214,140,.45),transparent 70%);mix-blend-mode:screen;pointer-events:none}
.mhl-room .tag{position:absolute;left:50%;top:50%;z-index:6;transform:translate(-50%,-38%) rotate(-3deg);max-width:92%;text-align:center;padding:3px 8px 4px;border-radius:7px;background:linear-gradient(#fef3c7,#fde68a);color:#422006;border:1.5px solid #b45309;box-shadow:0 3px 6px #0009}
.mhl-room .tag b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mhl-room .tag small[data-assistant-life-room-with]{white-space:normal;line-height:1.15}[data-assistant-life-land="1"] .mhl-room .tag{padding:2px 5px 3px}[data-assistant-life-land="1"] .mhl-room .tag b{font-size:9.5px}[data-assistant-life-land="1"] .mhl-room .tag small{font-size:8px}.mhl-room .tag small{display:block;font-size:9px;font-weight:800;color:#7c2d12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mhl-room .lock{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:rgba(15,23,42,.78);font-size:11px;font-weight:900;color:#cbd5e1}
.mhl-liv{position:absolute;overflow:hidden;border-radius:3px;background:linear-gradient(#f3e3c4,#e7cfa2)}
.mhl-board{position:absolute;left:8px;top:6px;bottom:6px;border-radius:5px;background:#c08a52;border:3px solid #7c4a22;padding:3px 6px;overflow:hidden}
.mhl-board b{display:block;font-size:9.5px;color:#fff}.mhl-board p{font-size:9px;font-weight:800;line-height:1.25;color:#1e293b;background:#fffbeb;border-radius:3px;padding:1px 4px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mhl-door{position:absolute;bottom:0;width:38px;border-radius:18px 18px 0 0;background:linear-gradient(#8b5a2b,#6b4423);border:2px solid #3b2412}
.mhl-find{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:900;padding:6px 10px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#db2777);border:1.5px solid #fff9;box-shadow:0 4px 12px #0009}
.mhl-tile{position:relative;display:block;min-height:58px;border-radius:12px;padding:6px 6px 4px;text-align:left;clip-path:polygon(0 0,88% 0,100% 20%,100% 100%,0 100%);overflow:hidden;box-shadow:inset 0 -4px 0 #0003;color:#fff}
.mhl-tile:active{transform:scale(.97)}.mhl-tile:disabled{opacity:.55}
.mhl-tile i{font-style:normal;font-size:17px;display:block;line-height:1}.mhl-tile b{display:block;font-size:12px;font-weight:900;margin-top:2px;text-shadow:0 1px 2px #0007;white-space:nowrap}
.mhl-tile small{display:block;font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mhl-tile em{position:absolute;right:6px;top:4px;font-style:normal;font-size:9px;font-weight:900;background:#0f172acc;border-radius:999px;padding:0 5px}
.mhl-watch{background:linear-gradient(135deg,#fb7185,#f59e0b)}.mhl-call{background:linear-gradient(135deg,#38bdf8,#6366f1)}.mhl-give{background:linear-gradient(135deg,#34d399,#16a34a)}.mhl-beat{background:linear-gradient(135deg,#a855f7,#ec4899)}
.mhl-icons{display:flex;gap:6px}.mhl-icons button{flex:1;min-height:48px;border-radius:12px;background:rgba(30,41,59,.9);border:1px solid #ffffff2a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#e2e8f0}
.mhl-icons button.on{background:linear-gradient(#f472b633,#f472b611);border-color:#f9a8d4;color:#fff}.mhl-icons button i{font-style:normal;font-size:17px;line-height:1.1}
.mhl-sheet{position:absolute;left:0;right:0;bottom:0;z-index:20;max-height:86%;overflow-y:auto;border-radius:22px 22px 0 0;background:linear-gradient(#1e1b4b,#0b1020 40%);border-top:2px solid #f9a8d4;box-shadow:0 -10px 30px #000a;padding:12px 14px calc(14px + env(safe-area-inset-bottom))}
.mhl-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #ffffff1a;font-size:12px;font-weight:800}
.mhl-row .k{width:78px;flex:none;color:#cbd5e1;font-size:10.5px}
.mhl-btn{min-height:44px;border-radius:12px;font-size:12px;font-weight:900;color:#fff}.mhl-btn:disabled{opacity:.45}
.mhl-scene{position:absolute;inset:0;z-index:30;overflow:hidden;background:#000}
.mhl-scene .bg{position:absolute;inset:0;background-size:cover;background-position:center}
.mhl-scene .st{position:absolute;bottom:0;object-fit:contain;object-position:bottom;filter:drop-shadow(0 6px 12px #0008)}
@keyframes mhlIntroTitle{0%{opacity:0;transform:scale(.9)}30%{opacity:1;transform:scale(1)}100%{opacity:1}}
@keyframes mhlDoorL{from{transform:translateX(0)}to{transform:translateX(-102%)}}
@keyframes mhlDoorR{from{transform:translateX(0)}to{transform:translateX(102%)}}
@keyframes mhlPop{0%{transform:scale(0)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes mhlFade{from{opacity:1}to{opacity:0}}
.mhl-intro{position:absolute;inset:0;z-index:40;pointer-events:auto}
.mhl-intro .door{position:absolute;top:0;bottom:0;width:50.5%;background:repeating-linear-gradient(0deg,#f5e6c8 0 12px,#e8d3a8 12px 14px);box-shadow:inset 0 0 0 4px #6b4423}
.mhl-pop .pp>span{animation:mhlPop .35s ease-out both}
@media (prefers-reduced-motion:reduce){.mhl-intro{display:none}.mhl-pop .pp>span{animation:none}}
`;

function AssistantLifeHouseStyle() { return <style>{ASSISTANT_LIFE_HOUSE_CSS}</style>; }
// 名前の並び(「ドラ・ソラシド・えるびん」)。折り返すときは名前の途中で折らない(2026-11-07 社長「文字列も気をつけて」)
function AssistantLifeNames({ text }) {
  const parts = String(text || '').split('・');
  return <>{parts.map((n, i) => <React.Fragment key={i}>{i ? '・' : ''}<span data-assistant-life-name className="whitespace-nowrap">{n}</span>{i < parts.length - 1 ? <wbr/> : null}</React.Fragment>)}</>;
}

// 掲示板の1行(「07:30 朝: あつ・ソラシド 図書室でカード研究 / …」)。まとまりの途中で折らない(2026-11-07 ミハリ 残り①「カード研/究」「ド/ラ」)。
//   空白で区切ったまとまりを nowrap にし、名前は「・」、場所としていることは「〇〇で」のあとで折れてよい
function AssistantLifeChunks({ text }) {
  const out = [];
  String(text || '').split(' ').forEach((tok, i) => {
    if (i) out.push(' ');
    const m = tok.match(/^(.+?で)(.+)$/);
    const subs = tok.includes('・') ? tok.split('・').map((x, k, a) => (k < a.length - 1 ? `${x}・` : x)) : (m && [...Object.values(ASSISTANT_LIFE_PLACES), ...Object.values(ASSISTANT_LIFE_PLACE_SHOW)].includes(m[1].slice(0, -1)) ? [m[1], m[2]] : [tok]);
    subs.forEach((x, k) => { if (k) out.push(<wbr key={`w${i}-${k}`}/>); out.push(<span key={`c${i}-${k}`} data-assistant-life-chunk className="whitespace-nowrap">{x}</span>); });
  });
  return <>{out}</>;
}

// 掲示板は2行まで: 縦は1組・横は2組までと「ほか◯組」(全部は押した先の一覧で読む)
const assistantLifeBoardShort = (text, max = 2) => { const ps = String(text || '').split(' / '); return ps.length > max ? `${ps.slice(0, max).join(' / ')} ほか${ps.length - max}組` : String(text || ''); };
// 部屋1つ
function AssistantLifeRoom({ id, met, look, x, y, w, h, state, onOpen, idx }) {
  const L = ASSISTANT_LIFE_ROOM_LOOK[id];
  const view = ASSISTANT_LIFE_VIEW[look][idx % 2];
  const night = look === 'night';
  const ppl = state && state.in ? state.in : null;
  const sess = assistantLifeSessionInfo(id);
  return (
    <button type="button" className="mhl-room" data-assistant-life-room={id} data-assistant-life-room-in={ppl ? ppl.join(',') : ''} data-assistant-life-room-tag={state && state.tag ? '1' : '0'}
      style={{ left: x, top: y, width: w, height: h }} onClick={() => met && onOpen(id)} aria-label={`${assistantLifeName(id)}の部屋`}>
      <div className="w" style={{ background: `linear-gradient(${L.wall[0]},${L.wall[1]})`, filter: night ? (ppl ? 'brightness(.92)' : 'brightness(.55)') : undefined }}/>
      <div className="win"><img src={view} alt="" loading="lazy" style={{ objectPosition: `${(idx % 3) * 40}% 60%` }}/></div>
      <span className="pl">{met ? assistantLifeName(id) : '？'}</span>
      {met && sess && sess.level > 1 && <span className="lv" data-assistant-life-room-session={sess.level}>🎵Lv{sess.level}</span>}
      <span className="fu" aria-hidden="true">{L.furn}</span><div className="fl"/>
      {ppl && !state.sleep && (look === 'night' || look === 'evening') && <div className="lamp"/>}
      {ppl && state.sleep && <div className="off" style={{ background: night ? 'rgba(3,5,16,.6)' : 'rgba(30,27,75,.35)' }}/>}
      {!ppl && met && <div className="off" style={night ? { background: 'rgba(3,5,16,.72)' } : undefined}/>}
      {ppl && <div className="pp">{ppl.map(pid => { const who = assistantById(pid); return who ? (
        <span key={pid} className={state.lonely && pid === id ? 'lonely' : state.after ? 'after' : ''} data-assistant-life-room-face={pid}><AssistantFace who={who} size={Math.round(Math.min(40, h * .44))} accent={who.accent}/></span>) : null; })}</div>}
      {ppl && state.bub && <span className="bb" style={{ bottom: Math.round(Math.min(40, h * .44)) + 14 }}>{state.bub}</span>}
      {state && state.tag && <span className="tag" data-assistant-life-room-away={id}><b>{state.tag[0]}</b><small>{state.tag[1]}</small>{state.tag[2] && <small data-assistant-life-room-with><AssistantLifeNames text={state.tag[2]}/></small>}</span>}
      {!met && <span className="lock">まだ会っていない</span>}
    </button>);
}

// 家(縦: 4階×2部屋 / 横: 2段×4部屋)。部屋・居間・屋根裏の位置は注文書 HOUSE-ART-ORDER.md と同じ並び
function AssistantLifeHouseArt({ width, land, look, rooms, metSet, onOpen, diary, pop, onBoard }) {
  const wall = 6, cols = land ? 4 : 2, rows = land ? 2 : 4;
  const rw = (width - wall * (cols + 1)) / cols;
  const rh = land ? Math.round(rw * 0.74) : Math.round(rw * 0.5);
  const lh = land ? 62 : 78, roofH = land ? 44 : 64;
  const bodyH = wall + rows * (rh + wall) + lh + wall, ly = wall + rows * (rh + wall);
  const night = look === 'night';
  const items = (diary.items || []).slice(-3).reverse();
  return (
    <div className={`mhl-house${pop ? ' mhl-pop' : ''}`} data-assistant-life-house style={{ width, height: roofH + bodyH }}>
      <div className="mhl-chim" style={{ left: width * .72, top: roofH * .05, height: roofH * .6 }}/>
      <div className="mhl-roof" style={{ height: roofH }}/>
      {/* 屋根裏の🔒は、何か分からないので出さない(屋根裏ができたら出す。2026-11-07 ミハリ L11) */}
      <span className="mhl-hname" data-assistant-life-hname style={{ top: roofH - 22 }}>🏡 助手の家</span>
      <div className="mhl-frame" style={{ top: roofH, height: bodyH }}>
        {ASSISTANT_LIFE_HOUSE_ORDER.map((id, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          return <AssistantLifeRoom key={id} id={id} idx={i + r} met={metSet.has(id)} look={look} x={wall + c * (rw + wall)} y={wall + r * (rh + wall)} w={rw} h={rh} state={rooms[id]} onOpen={onOpen}/>;
        })}
        <div className="mhl-liv" data-assistant-life-living style={{ left: wall, top: ly, width: width - 2 * wall, height: lh, filter: night ? 'brightness(.62)' : undefined }}>
          <button type="button" className="mhl-board text-left" data-assistant-life-board onClick={onBoard} style={{ width: Math.min(width * (land ? .42 : .52), 240) }} aria-label="今日あったことを全部見る">
            <b>📌 今日あったこと{items.length ? ' ›' : ''}</b>
            {items.length ? items.slice(0, land ? 1 : 2).map((x, i) => <p key={i} data-assistant-life-board-item><AssistantLifeChunks text={`${x.t} ${assistantLifeBoardShort(x.text, land ? 2 : 1)}`}/></p>) : <p>まだ何もありません</p>}
          </button>
          <div className="mhl-door" style={{ left: width * (land ? .62 : .66), height: lh - 14 }}/>
          <span className="absolute text-[24px]" style={{ left: width * (land ? .62 : .66) + 46, bottom: 6 }} aria-hidden="true">🛋️</span>
          <span className="absolute right-2 top-1 text-[9px] font-black text-amber-900">みんなの居間</span>
          {night && <span className="absolute text-[18px]" style={{ right: 40, bottom: 6 }} aria-hidden="true">🔥</span>}
        </div>
      </div>
    </div>);
}

// 部屋ごとの見え方(いる人・出かけている札)を、いまの様子から作る
const assistantLifeRoomsOf = (life, metIds) => {
  const rooms = {};
  const peer = typeof ASSISTANT_PEER_STORE !== 'undefined' ? ASSISTANT_PEER_STORE.state : null;
  for (const id of ASSISTANT_LIFE_HOUSE_ORDER) {
    if (!metIds.includes(id)) { rooms[id] = null; continue; }
    const w = assistantLifeWhereOf(life, id);
    if (!w) { rooms[id] = { in: [id], bub: '' }; continue; }
    const doing = ASSISTANT_LIFE_DOINGS[w.doing] || { label: '' };
    if (w.place === 'home') {
      const ids = w.group ? w.group.ids : [id];
      const host = w.group ? assistantLifeHostOf(ids) : id;
      if (host === id) {
        const lonely = w.reason === 'lonely';
        rooms[id] = { in: [host, ...ids.filter(x => x !== host)], lonely, sleep: w.doing === 'sleep', bub: w.doing === 'sleep' ? '💤 おやすみ中' : lonely ? '💭 だれか来ないかな…' : ids.length > 1 ? `部屋で${ids.length}人で${doing.label}` : `部屋で${doing.label}` };
      } else rooms[id] = { tag: [`🚪 ${assistantLifeName(host)}の部屋へ`, `${ids.length}人で ${doing.label}`, assistantLifeGroupNames(ids, 4)] };
      continue;
    }
    // 組で出かけているときは、どの部屋の札にも同じ全員の名前(「3人で ドラ・ソラシド・えるびん」)
    const sub = w.group ? `${w.group.ids.length}人で ${doing.label}` : `ひとりで ${doing.label}`;
    rooms[id] = { tag: [`${ASSISTANT_LIFE_PLACE_ICON[w.place] || '🚶'} ${assistantLifePlaceShow(w.place)}へ`, sub, w.group ? assistantLifeGroupNames(w.group.ids, 4) : null] };
  }
  // 言い合いのあとの2人(水色の縁と「💢 ◯◯と言い合いのあと」。2026-11-07 社長「喧嘩とか仲直りとか人間じみたのもどんどん」)
  const q = peer && peer.quarrel && peer.quarrel.pending;
  if (q && q.pair) {
    const pair = String(q.pair).split('-');
    for (const id of pair) {
      const other = pair.find(x => x !== id);
      if (!rooms[id] || !other) continue;
      const mark = `💢 ${assistantLifeName(other)}と言い合いのあと`;
      rooms[id] = rooms[id].in ? { ...rooms[id], after: true, bub: mark } : { ...rooms[id], tag: [rooms[id].tag[0], mark, rooms[id].tag[2] || null] };
    }
  }
  return rooms;
};

// 部屋を押したとき(その助手のこと・その場でできること)
function AssistantLifeRoomSheet({ id, life, peerSt, bondLevelOf, diary, onClose, onPeek, onInvite, onWatch, onGive, onBeat, canGive, slot, land = false }) {
  const who = assistantById(id);
  if (!who) return null;
  const w = assistantLifeWhereOf(life, id);
  const home = !w || w.place === 'home';
  const doing = w ? (ASSISTANT_LIFE_DOINGS[w.doing] || { label: '' }).label : '';
  const mood = ASSISTANT_LIFE_MOODS[(life && life.moods || {})[id]] || '';
  const lv = typeof bondLevelOf === 'function' ? bondLevelOf(id) : null;
  const friends = ASSISTANT_LIFE_HOUSE_ORDER.filter(x => x !== id).map(x => ({ id: x, lv: typeof assistantPeerLevel === 'function' ? assistantPeerLevel(peerSt, id, x) : 1 }))
    .sort((a, b) => b.lv - a.lv).slice(0, 3);
  const sess = assistantLifeSessionInfo(id);
  const items = (diary.items || []).filter(x => (x.ids || []).includes(id)).slice(-3);
  const watched = (life && life.watched) || [];
  const groupKey = w && w.group ? assistantLifeGroupKey(w.group) : null;
  const canWatch = groupKey ? !watched.includes(groupKey) : !watched.includes(`solo:${id}`);
  const atBeat = w && w.doing === 'practice';
  // モンヒロビートに出かけているあいだは券なし(ビート部の rhythmAssistSessionVisitFree が正本。無ければ券なしと書かない)
  const beatFree = !!atBeat && typeof rhythmAssistSessionVisitFree === 'function' && (() => { try { return rhythmAssistSessionVisitFree(id) === true; } catch (_) { return false; } })();
  const asleep = !!(w && w.doing === 'sleep'); // 寝ている助手には、起こすと分かる言葉にする(2026-11-07 ミハリ L1)
  const slotDef = ASSISTANT_LIFE_SLOTS[slot.i];
  const groupNames = w && w.group ? assistantLifeGroupNames(w.group.ids, 8) : null;
  const groupText = w && w.group ? '' : ' ・ ひとり';
  const where = !w ? '🏡 部屋で過ごしている' : home ? `🏡 部屋で${doing}${groupText}` : `${ASSISTANT_LIFE_PLACE_ICON[w.place] || '🚶'} ${assistantLifePlaceShow(w.place)}で${doing}${groupText}`;
  return (
    <div className="absolute inset-0" style={{ zIndex: 25 }} data-assistant-life-room-sheet={id}>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '42%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px', borderTop: 0, borderLeft: '2px solid #f9a8d4', paddingTop: 10 } : undefined}>
        <img src={assistantFullImage(who, w && w.reason === 'lonely' ? 'troubled' : 'happy')} alt="" className={`pointer-events-none absolute right-0 top-0 object-contain object-right-top opacity-95 ${land ? 'h-[96px] w-[96px]' : 'h-[150px] w-[150px]'}`}/>
        <p className="mhl-en">ROOM · {String(who.id).toUpperCase()}</p>
        <p className="text-[21px] font-black">{who.name}の部屋</p>
        <p className="mt-1 max-w-[62%] text-[12px] font-bold" data-assistant-life-room-where>{where}{groupNames && <> ・ {w.group.ids.length}人(<AssistantLifeNames text={groupNames}/>)</>}</p>
        {!home && <p className="text-[11px] font-bold text-violet-200">⏱ {slotDef ? `${slotDef.to % 24}時まで` : ''}いる</p>}
        {(() => { const sh = assistantLifeRhythmShiftOn(((ASSISTANT_LIFE_STORE.state.rhythm || {})[id]), assistantLifeDayKey()); const rh = ASSISTANT_LIFE_RHYTHM[id]; return <p className="text-[10.5px] font-bold text-sky-200" data-assistant-life-room-rhythm={assistantLifeRhythmLabel(sh)}>🕰 生活のリズム: {rh ? rh.label : ''}{Math.abs(sh) >= 0.3 ? `(いまは ${assistantLifeRhythmLabel(sh)})` : ''}</p>; })()}
        {asleep ? <p className="text-[11px] font-bold text-indigo-200" data-assistant-life-room-asleep>💤 ぐっすり寝ている</p> : (w && w.reason === 'lonely') ? <p className="text-[11px] font-bold text-amber-200">💭 さみしそう(だれか来てほしい)</p> : mood ? <p className="text-[11px] font-bold text-pink-200">気分: {mood}</p> : null}
        <div className={land ? 'mt-2' : 'mt-8'}>
          {lv != null && <div className="mhl-row"><span className="k">💗 仲良し度</span><b>Lv{lv}</b></div>}
          <div className="mhl-row"><span className="k">🤝 友情Lv</span><span className="flex flex-wrap gap-x-3 text-[11px]">{friends.map(f => <span key={f.id}>{assistantLifeName(f.id)} <b className={f.lv >= 5 ? 'text-pink-300' : f.lv >= 3 ? 'text-amber-300' : ''}>Lv{f.lv}</b></span>)}</span></div>
          {sess && <div className="mhl-row" data-assistant-life-room-session-row><span className="k">🎵 セッション</span><b>セッションLv{sess.level}</b><span className="ml-auto text-[10px] text-slate-300">一緒に {sess.lives}回</span></div>}
          <div className="py-1.5"><p className="text-[10.5px] font-black text-slate-300">今日あったこと</p>
            {items.length ? items.map((x, i) => <p key={i} className="text-[11px] font-bold text-slate-100"><b className="mr-1.5 text-amber-200">{x.t}</b><AssistantLifeChunks text={x.text}/></p>) : <p className="text-[11px] text-slate-400">まだありません</p>}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {w && w.group
            ? <button type="button" className="mhl-btn mhl-watch" data-assistant-life-room-act="watch" disabled={!canWatch} onClick={() => onWatch(w.group)}>{canWatch ? (home ? '👀 見守る' : '👀 見守りに行く') : '見守りました'}</button>
            : <button type="button" className="mhl-btn mhl-watch" data-assistant-life-room-act="peek" disabled={!canWatch} onClick={() => onPeek(id)}>{canWatch ? '👀 ようすを見る' : '見た'}</button>}
          {!w || !w.group
            ? <button type="button" className="mhl-btn mhl-call" data-assistant-life-room-act="invite" disabled={w && w.reason === 'distance'} onClick={() => onInvite(id)}>{asleep ? '💤 そっと声をかける' : '💬 声をかける'}</button>
            : <button type="button" className="mhl-btn mhl-give" data-assistant-life-room-act="give" disabled={!canGive} onClick={() => onGive(w.group)}>🧺 渡す</button>}
          {typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function' && (
            <button type="button" className="mhl-btn mhl-beat col-span-2" data-assistant-life-room-act="beat" onClick={() => onBeat(id)}>{asleep ? '🎵 起こしてモンヒロビートに誘う' : atBeat && beatFree ? <>🎵 会いに行く<em className="ml-1 rounded-full bg-amber-300 px-1.5 text-[10px] not-italic text-amber-950" data-assistant-life-room-free>券なし</em></> : '🎵 一緒にモンヒロビート'}</button>)}
        </div>
      </div>
    </div>);
}

// 場面(見守る・ようすを見る・渡す の掛け合いを、その場所の背景と立ち絵で流す)
const assistantLifeSceneBg = (place, look) => {
  const v = ASSISTANT_LIFE_VIEW[look];
  if (place === 'plaza') return { src: v[0] };
  if (place === 'hill' || place === 'garden') return { src: v[1] };
  if (place === 'cafe' || place === 'market') return { src: 'images/story-bg/monhero_town.jpg', tint: look };
  // 絵の無い所は、HOME の町の絵のその建物を大きく切り抜いて使う(あとで絵を差し替えるだけで入る)
  const pos = { studio: '20% 18%', ranch: '8% 38%', cardroom: '50% 86%', library: '82% 24%' }[place];
  if (pos) return { src: 'data/images/home-background.jpg', pos, zoom: true, tint: look };
  return null;
};
const assistantLifeTodOn = () => { try { return !!document.documentElement.getAttribute('data-mh-tod'); } catch (_) { return false; } };
const ASSISTANT_LIFE_TINT = Object.freeze({ morning: 'linear-gradient(180deg,rgba(255,190,190,.25),transparent 60%)', noon: 'none', evening: 'linear-gradient(180deg,rgba(255,120,80,.35),rgba(110,50,90,.35))', night: 'linear-gradient(180deg,rgba(10,15,50,.6),rgba(10,15,50,.5))' });
function AssistantLifeScene({ scene, look, onClose, onGive, canGive }) {
  const peer = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
  const [started, setStarted] = React.useState(false);
  React.useEffect(() => { if (peer && peer.talking) setStarted(true); }, [peer && peer.talking]);
  const done = started && peer && !peer.talking;
  const ids = (scene.ids || []).slice(0, 4);
  const bg = scene.place === 'home' || !scene.place ? null : assistantLifeSceneBg(scene.place, look);
  const host = scene.place === 'home' ? assistantLifeHostOf(ids) : null;
  const room = host ? ASSISTANT_LIFE_ROOM_LOOK[host] : null;
  const hint = ids.length >= 2 && typeof assistantLifePairHint === 'function' && peer ? assistantLifePairHint(peer, ASSISTANT_LIFE_STORE.state.life, ids[0], ids[1]) : null;
  const stage = hint && typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS.find(s => s.level === hint.lv) : null;
  const placeName = scene.place === 'home' ? `${assistantLifeName(host)}の部屋` : assistantLifePlaceShow(scene.place);
  return (
    <div className="mhl-scene" data-assistant-life-scene={scene.place || 'home'}>
      {bg ? <div className="bg" style={{ backgroundImage: `url(${bg.src})`, backgroundPosition: bg.pos || 'center', backgroundSize: bg.zoom ? '260%' : 'cover', filter: bg.zoom ? 'blur(2px)' : undefined }}/>
        : <div className="bg" style={{ background: room ? `linear-gradient(${room.wall[0]},${room.wall[1]})` : '#1e1b4b' }}>
            <div className="absolute inset-x-0 bottom-0 h-[24%]" style={{ background: 'repeating-linear-gradient(90deg,#b07a4a 0 46px,#9a6a3e 46px 50px)' }}/>
            <div className="absolute right-[8%] top-[16%] h-[20%] w-[34%] overflow-hidden rounded border-[5px] border-[#f5e6c8]"><img src={ASSISTANT_LIFE_VIEW[look][1]} alt="" className="h-full w-full object-cover"/></div>
            {room && <span className="absolute bottom-[24%] left-3 text-[46px] opacity-90" aria-hidden="true">{room.furn}</span>}
          </div>}
      {/* 時間帯の色は HOME と同じ重ね(ハナビの TimeOfDayTint)。時間帯の設定が切なら、この場面だけの色(2026-11-07 ミハリ L14) */}
      {bg && bg.tint && (assistantLifeTodOn() && typeof TimeOfDayTint === 'function'
        ? <TimeOfDayTint/>
        : <div className="absolute inset-0" style={{ background: ASSISTANT_LIFE_TINT[bg.tint] }}/>)}
      {!bg && look === 'night' && <div className="absolute inset-0" style={{ background: 'rgba(10,15,50,.35)' }}/>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 45%,rgba(10,6,30,.7) 85%)' }}/>
      {ids.map((pid, i) => { const who = assistantById(pid); if (!who) return null; const n = ids.length; const cx = n === 1 ? 50 : n === 2 ? (i ? 66 : 34) : n === 3 ? [22, 50, 78][i] : [16, 38, 62, 84][i];
        const zz = (scene.sleep || []).includes(pid);
        return <React.Fragment key={pid}><img className="st" data-assistant-life-scene-stand={pid} data-assistant-life-scene-sleep={zz ? '1' : '0'} src={assistantFullImage(who, zz ? 'normal' : 'happy')} alt="" style={{ left: `${cx}%`, transform: 'translateX(-50%)', height: n >= 4 ? '50%' : '58%', width: n === 1 ? '90%' : n >= 4 ? '46%' : '70%', bottom: '22%', filter: zz ? 'brightness(.45) saturate(.6) drop-shadow(0 6px 12px #0008)' : undefined }}/>
          {zz && <span className="absolute text-[34px]" style={{ left: `${cx + 8}%`, top: '30%' }} aria-hidden="true">💤</span>}</React.Fragment>; })}
      <div className="mhl-hdr absolute inset-x-0 top-0" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
        <div className="flex items-start gap-2">
          <button type="button" data-assistant-life-scene-back onClick={onClose} aria-label="家へ戻る" className="h-9 w-9 text-[18px] text-slate-100">←</button>
          <div className="min-w-0 flex-1"><p className="mhl-en">{scene.place && scene.place !== 'home' ? String(scene.place).toUpperCase() : 'ROOM'}</p><p className="mhl-ti" style={{ fontSize: 19 }}>{ASSISTANT_LIFE_PLACE_ICON[scene.place] || '🏡'} {placeName}</p></div>
        </div>
        {ids.length >= 3 && <p data-assistant-life-scene-group className="mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }}>👥 {ids.length}人で ・ <AssistantLifeNames text={assistantLifeGroupNames(ids, 8)}/></p>}
        {hint && ids.length === 2 && <p className="mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'linear-gradient(90deg,#db2777,#a855f7)' }}>🤝 {ids.slice(0, 2).map(assistantLifeName).join('・')} 友情Lv{hint.lv}{stage ? ` ${assistantPeerStageName(stage)}` : ''}</p>}
      </div>
      {done && (
        <div className="absolute inset-x-3 flex gap-1.5" style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }} data-assistant-life-scene-done>
          {ids.length >= 2 && <button type="button" className="mhl-btn mhl-give flex-1" disabled={!canGive} onClick={() => onGive(ids)}>🧺 渡す</button>}
          <button type="button" className="mhl-btn flex-1 bg-slate-700" onClick={onClose}>🏡 家へ戻る</button>
        </div>)}
    </div>);
}

// ---------- 専用ページ ----------
const useAssistantLifeLand = () => {
  const get = () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerHeight < 600;
  const [land, setLand] = React.useState(get);
  React.useEffect(() => { const f = () => setLand(get()); window.addEventListener('resize', f); window.addEventListener('orientationchange', f); return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); }; }, []);
  return land;
};
function AssistantLifeHouse({ metIds, onReplay, peerItems = null, onUseItem = null, bondLevelOf = null }) {
  const st = useAssistantLifeNow(metIds);
  const diary = useAssistantLifeDiary();
  const peerSt = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
  const land = useAssistantLifeLand();
  const [tab, setTab] = React.useState('house');
  const [roomId, setRoomId] = React.useState(st.focus || null);
  const [scene, setScene] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [give, setGive] = React.useState(null);
  const [intro, setIntro] = React.useState(null); // 'long' | 'short' | null
  const [boardOpen, setBoardOpen] = React.useState(false); // 今日あったことを全部
  const [vw, setVw] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth : 390));
  React.useEffect(() => { const f = () => setVw(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  // 入場: その日の最初は長く(1.2秒)、2回目からは短く(0.4秒)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      let last = null; try { last = await storeGet(ASSISTANT_LIFE_INTRO_KEY, null, false); } catch {}
      const day = assistantLifeDayKey();
      if (!alive) return;
      const kind = last === day ? 'short' : 'long';
      setIntro(kind);
      if (kind === 'long') { try { storeSet(ASSISTANT_LIFE_INTRO_KEY, day, false); } catch {} }
      setTimeout(() => { if (alive) setIntro(null); }, kind === 'long' ? 1200 : 400);
    })();
    return () => { alive = false; };
  }, []);
  React.useEffect(() => { if (roomId) setNote(''); }, [roomId]); // 別の部屋を開いたら前の一言を消す(ミハリ L13)
  React.useEffect(() => { if (st.focus) { setRoomId(st.focus); ASSISTANT_LIFE_STORE.set({ focus: null }); } }, [st.focus]);
  if (!assistantLifeEnabled() || !st.loaded || !st.open) return null;
  const life = st.life || {};
  const ids = (metIds || []).filter(id => ASSISTANT_LIFE_PREFS[id]);
  const metSet = new Set(ids);
  const slot = assistantLifeSlotAt();
  const look = assistantLifeTimeLook();
  const day = assistantLifeDayKey();
  const play = assistantLifePlayForDay(st.play, day);
  const tier = assistantLifeTierOf(play.points);
  const next = ASSISTANT_LIFE_TIERS[assistantLifeTierIndex(tier) + 1] || null;
  const watchLeft = assistantLifeWatchLeft(st.play, day);
  const rooms = assistantLifeRoomsOf(life, ids);
  const nameOf = assistantLifeName;
  const close = () => { setScene(null); assistantLifeCloseScreen(); };
  // 掛け合いを、家を閉じずに場面で流す
  const playTalk = (talk, ctx) => {
    if (!talk) return;
    // 場面の立ち絵は、実際に話す助手と必ずそろえる(組の人+台本で話す人。いない助手が話す台本を流しても、その助手の絵が出る)
    const speakers = [...new Set((talk.lines || []).map(l => l && l.who).filter(Boolean))];
    const sceneIds = [...new Set([...((ctx && ctx.ids) || []), ...speakers])];
    const sleepIds = ctx && ctx.sleep ? (ctx.ids || []) : [];
    setRoomId(null); setNote(''); // 前の一言を残さない(ミハリ L13)
    setScene({ ids: sceneIds, place: (ctx && ctx.place) || 'home', key: `${talk.id}-${Date.now()}`, sleep: sleepIds });
    if (onReplay) onReplay(talk);
    if (sceneIds.length >= 2) void assistantLifeDiaryAdd(`${sceneIds.map(nameOf).join('・')}の様子を見守った`, sceneIds, { kind: 'watch' });
  };
  const watch = async (g) => { const talk = await assistantLifeWatch(g); if (!talk) { setNote('この組の掛け合いは、いまは見られません'); return; } playTalk(talk, { ids: g.ids, place: g.place }); };
  const peek = (id) => {
    const key = `solo:${id}`;
    if ((life.watched || []).includes(key)) return;
    const w = assistantLifeWhereOf(life, id);
    const sleeping = !!(w && w.doing === 'sleep');
    // 寝ているときは寝言(起こさない)。起きているときは、その助手だけが話す台本(距離をおく行も、いない相手の行は外す)
    const talk = sleeping ? assistantLifePickSleepTalk(id, { wake: false, place: w.place }) : assistantLifeOnlyPresent(assistantLifePickSoloTalk(id, life), [id]);
    if (!talk) { setNote(`${nameOf(id)}は、いまは静かに過ごしています`); return; }
    ASSISTANT_LIFE_STORE.set({ life: { ...life, watched: [...(life.watched || []), key] } });
    assistantLifeSaveLife(); if (!sleeping) assistantLifeMarkSeen(talk);
    playTalk(talk, { ids: [id], place: w ? w.place : 'home', sleep: sleeping });
  };
  const invite = async (id) => {
    // その助手が {name} に話す台本だけ(ほかの助手が出る台本は使わない・2026-11-07 社長の指摘)。寝ていれば寝言か起こされた反応
    const w = assistantLifeWhereOf(life, id);
    const sleeping = !!(w && w.doing === 'sleep');
    const talk = sleeping ? assistantLifePickSleepTalk(id, { wake: true, bondLv: typeof bondLevelOf === 'function' ? bondLevelOf(id) : 1, place: w.place }) : assistantLifePickCallTalk(id, life);
    if (!(await assistantLifeNudge('invite', id))) return;
    if (talk) { if (!sleeping) assistantLifeMarkSeen(talk); playTalk(talk, { ids: [id], place: w ? w.place : 'home', sleep: sleeping }); }
    setNote(sleeping ? `${nameOf(id)}は寝ています。次の時間に、起きてだれかのところへ行きます` : `${nameOf(id)}に声をかけました。次の時間に、だれかのところへ行きます`);
  };
  // 渡す(2人にあげる道具)。前の画面と同じ確かめ(AssistantLifeGiveSheet)
  const canGive = !!(peerItems && onUseItem);
  const itemInfos = ASSISTANT_LIFE_ITEM_KINDS.map(k => assistantLifeItemInfo(k.kind));
  const haveOf = (kind) => (peerItems && Number(peerItems[kind])) || 0;
  const usedOf = (kind) => !!(peerSt && typeof assistantPeerItemUsedToday === 'function' && assistantPeerItemUsedToday(peerSt, kind));
  const openGive = (gids) => {
    const list = Array.isArray(gids) ? gids : (gids && gids.ids) || [];
    if (list.length < 2) return;
    const kind = itemInfos.find(x => haveOf(x.kind) > 0 && !usedOf(x.kind))?.kind || 'gift';
    const ps = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) ps.push([list[i], list[j]]);
    const best = ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).near) || ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).after) || ps[0];
    setRoomId(null); setScene(null); setNote('');
    setGive({ ids: list, pair: list.length === 2 ? [...list] : best, kind });
  };
  const doGive = async () => {
    if (!give || !give.pair) return;
    const talk = await onUseItem(give.kind, give.pair);
    const info = assistantLifeItemInfo(give.kind);
    if (!talk) { setNote(`${info.name}は、いまは渡せません(1日1回・持っている数を見てください)`); setGive(null); return; }
    const g = (life.groups || []).find(x => give.pair.every(id => x.ids.includes(id)));
    setGive(null);
    void assistantLifeDiaryAdd(`${give.pair.map(nameOf).join('と')}に${info.name}を渡した`, give.pair, { kind: 'give' });
    playTalk(talk, { ids: give.pair, place: g ? g.place : 'home' });
  };
  const beat = (id) => { try { if (typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function') { close(); ASSISTANT_LIFE_LINKS.beatInvite(id); } } catch {} };
  // 今日やれること
  const unwatched = (life.groups || []).filter(g => !(life.watched || []).includes(assistantLifeGroupKey(g)));
  const lonely = Object.entries(life.solo || {}).find(([, s]) => s.reason === 'lonely');
  const beatIds = ids.filter(id => { const w = assistantLifeWhereOf(life, id); return w && w.doing === 'practice'; });
  const itemsLeft = itemInfos.reduce((n, x) => n + (usedOf(x.kind) ? 0 : Math.min(1, haveOf(x.kind))), 0);
  const giveGroup = (life.groups || [])[0];
  const pad = 12;
  const houseW = land ? Math.min(560, Math.round(vw * 0.64) - pad * 2) : Math.min(380, vw - pad * 2);
  const tiles = (
    <div className={land ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5'} data-assistant-life-today>
      <button type="button" className="mhl-tile mhl-watch flex-1" data-assistant-life-today-act="watch" disabled={watchLeft <= 0 || !unwatched.length} onClick={() => unwatched[0] && watch(unwatched[0])}>
        <em>あと{watchLeft}</em><i>👀</i><b>見守る</b><small>{unwatched.length ? `${unwatched.length}か所` : 'いまは無し'}</small></button>
      <button type="button" className="mhl-tile mhl-call flex-1" data-assistant-life-today-act="call" disabled={!Object.keys(life.solo || {}).length} onClick={() => { const id = lonely ? lonely[0] : Object.keys(life.solo || {})[0]; if (id) setRoomId(id); }}>
        <em>無料</em><i>💬</i><b>声をかける</b><small data-assistant-life-today-sub>{lonely ? `💭 ${nameOf(lonely[0])}` : 'ひとりの助手に'}</small></button>
      <button type="button" className="mhl-tile mhl-give flex-1" data-assistant-life-today-act="give" disabled={!canGive || !giveGroup} onClick={() => { if (itemsLeft > 0 && giveGroup) openGive(giveGroup.ids); else setTab('items'); }}>
        <em>{itemsLeft}回</em><i>🧺</i><b>渡す</b><small>{itemInfos.map(x => `${x.emoji}${haveOf(x.kind)}`).join(' ')}</small></button>
      <button type="button" className="mhl-tile mhl-beat flex-1" data-assistant-life-today-act="beat" onClick={() => { if (beatIds[0]) setRoomId(beatIds[0]); }} disabled={!beatIds.length}>
        <i>🎵</i><b>モンヒロビート</b><small>{beatIds.length ? `${beatIds.length}人 ・ 券なし` : 'いまはだれも'}</small></button>
    </div>);
  const icons = (
    <div className="mhl-icons" role="tablist" data-assistant-life-icons>
      {[['house', '🏡', '家'], ['where', '📋', '居場所'], ['friends', '🤝', '友情'], ['items', '🎒', '道具']].map(([k, ic, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} data-assistant-life-icon={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setRoomId(null); }}><i>{ic}</i>{label}</button>))}
    </div>);
  const header = (
    <div className="mhl-hdr" style={{ paddingTop: land ? 6 : 'calc(8px + env(safe-area-inset-top))' }}>
      <div className="flex items-start gap-2">
        <button type="button" data-assistant-life-close onClick={close} aria-label="閉じる" className="h-9 w-8 shrink-0 text-[19px] text-slate-100">←</button>
        <div className="min-w-0 shrink-0" data-assistant-life-title><p className="mhl-en whitespace-nowrap" style={land ? { letterSpacing: '.06em', fontSize: 8 } : undefined}>ASSISTANT LIFE · {tab === 'where' ? 'WHERE' : tab === 'friends' ? 'FRIENDS' : tab === 'items' ? 'ITEMS' : 'HOUSE'}</p><p className="mhl-ti whitespace-nowrap" style={land ? { fontSize: 18 } : undefined}>助手ライフ</p></div>
        <div className="min-w-0 flex-1"/>
        {/* いまの時刻の札(ハナビの共通部品 44-time-of-day.jsx。設定の「いまの時刻を出す」が切なら出ない) */}
        {typeof TimeOfDayClock === 'function' && <div className="shrink-0 self-center"><TimeOfDayClock/></div>}
      </div>
      {/* 時間帯と、みんなが動くまで(題を切らないよう2段目に。2026-11-07 社長「文字列も気をつけて」) */}
      <p className="mt-0.5 text-[10px] font-bold text-slate-200" data-assistant-life-clock>{assistantLifeTodLabel()} ・ <span data-assistant-life-next-slot className="whitespace-nowrap">{assistantLifeNextSlotText().replace(/みんなが動きます$/, 'みんなが動く')}</span></p>
      <div className="mt-1 flex items-center gap-1.5" data-assistant-life-tier={tier.id} title={ASSISTANT_LIFE_TIER_NOTES[tier.id]}>
        <span className="mhl-chip">🎉 {tier.label} ×{tier.mult}</span>
        <span className="mhl-bar" aria-hidden="true"><i style={{ width: `${next ? Math.min(100, Math.round(100 * (play.points - tier.min) / (next.min - tier.min))) : 100}%` }}/></span>
        <span className="whitespace-nowrap text-[9.5px] font-bold text-slate-200">{next ? `${next.label}まで ${next.min - play.points}` : 'いちばん上'}</span>
      </div>
    </div>);
  const findBtn = <button type="button" className="mhl-find" data-assistant-life-find onClick={() => setTab('where')}>📋 みんなの居場所 ›</button>;
  const houseView = (
    <div className="relative pt-1">
      <div className={land ? 'mb-1 flex justify-start' : 'mb-1 flex justify-end'} style={{ paddingInline: pad }}>{findBtn}</div>
      <AssistantLifeHouseArt width={houseW} land={land} look={look} rooms={rooms} metSet={metSet} onOpen={setRoomId} diary={diary} pop={!!intro} onBoard={() => setBoardOpen(true)}/>
    </div>);
  const tabBody = tab === 'house' ? houseView
    : tab === 'where' ? (
      <div className="px-3 pb-3" data-assistant-life-where>
        <AssistantLifeTownMap life={life} ids={ids} look={look} onPick={(id) => { setTab('house'); setRoomId(id); }}/>
        <AssistantLifeScreenBody metIds={metIds} onReplay={playTalk} peerItems={peerItems} onUseItem={onUseItem} embedded/>
      </div>)
    : tab === 'friends' ? (<div className="px-3 pb-3 pt-1">{typeof AssistantPeerMap === 'function' && <AssistantPeerMap metIds={metIds} onReplay={(t) => playTalk(t, null)} peerItems={peerItems} onUseItem={onUseItem}/>}</div>)
    : (
      <div className="px-3 pb-3 pt-1" data-assistant-life-items>
        <p className="text-[13px] font-black text-amber-200">🎒 2人にあげる道具</p>
        {itemInfos.map(x => (
          <div key={x.kind} data-assistant-life-item={x.kind} className="mt-2 flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-slate-900/85 p-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-[26px]" aria-hidden="true">{x.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black text-white">{x.name} <span className="text-[10px] text-slate-400">持っている {haveOf(x.kind)}個 ・ 今日あと{usedOf(x.kind) ? 0 : 1}回</span></p>
              <p className="text-[10.5px] leading-snug text-slate-300">{x.what.split('。')[0]}。<span className="text-orange-300">🤝 友情Lv +{x.peerAmt}</span>・2人との<span className="text-pink-200">💗 仲良し度 +{x.playerAmt}</span></p>
            </div>
          </div>))}
        <p className="mt-2 text-[10.5px] leading-snug text-slate-400">手に入れる: モンヒロビートの「ビートP交換所」({itemInfos.map(x => `${x.emoji}${x.cost != null ? `${x.cost}P` : ''}`).join('・')})。渡す: 部屋や場面の「🧺 渡す」。声をかける・見守るは無料です</p>
      </div>);
  return (
    <div className="mhl-root" style={{ zIndex: 9000 }} data-assistant-life-screen data-assistant-life-look={look} data-assistant-life-land={land ? '1' : '0'}>
      <AssistantLifeHouseStyle/>
      <div className="mhl-page" style={{ maxWidth: land ? 'none' : 480 }}>
        <div className={`mhl-sky t-${look}`}/>
        <div className="mhl-wood" style={{ backgroundImage: `url(${ASSISTANT_LIFE_VIEW[look][1]})` }}/>
        {land ? (
          <div className="relative z-[2] flex h-full min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
            <div className="mhl-body" style={{ flex: '0 0 64%' }}>{tabBody}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-gradient-to-b from-[#1a0f2e] to-[#0b1020] px-2.5 pb-2">
              {header}
              {note && <p data-assistant-life-note className="rounded-xl bg-sky-400/15 px-2 py-1 text-[10.5px] font-bold text-sky-100">{note}</p>}
              {tiles}
              {icons}
            </div>
          </div>
        ) : (<>
          {header}
          <div className="mhl-body">
            {note && <p data-assistant-life-note className="mx-3 mb-1 rounded-xl bg-sky-400/15 px-2 py-1.5 text-[11px] font-bold text-sky-100">{note}</p>}
            {tabBody}
          </div>
          <div className="relative z-[3] bg-gradient-to-t from-[#0b1020] via-[#0b1020ee] to-transparent px-3 pt-1.5" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            {tab === 'house' && <><p className="mb-1 flex justify-between text-[10px] font-black text-slate-200">今日やれること<span className="font-bold text-slate-400">朝4時に戻る</span></p>{tiles}</>}
            <div className="mt-1.5">{icons}</div>
          </div>
        </>)}
        {roomId && <AssistantLifeRoomSheet id={roomId} life={life} peerSt={peerSt} bondLevelOf={bondLevelOf} diary={diary} slot={slot} canGive={canGive && itemsLeft > 0}
          land={land} onClose={() => setRoomId(null)} onPeek={peek} onInvite={invite} onWatch={watch} onGive={(g) => openGive(g.ids)} onBeat={beat}/>}
        {boardOpen && (
          <div className="absolute inset-0" style={{ zIndex: 25 }} data-assistant-life-diary>
            <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={() => setBoardOpen(false)}/>
            <div className="mhl-sheet" style={land ? { left: 'auto', width: '42%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px' } : undefined}>
              <p className="mhl-en">TODAY</p><p className="text-[18px] font-black">📌 今日あったこと</p>
              {(diary.items || []).length ? [...diary.items].reverse().map((x, i) => <p key={i} className="mt-1.5 text-[12px] font-bold leading-snug text-slate-100"><b className="mr-1.5 text-amber-200">{x.t}</b><AssistantLifeChunks text={x.text}/></p>) : <p className="mt-2 text-[12px] text-slate-400">まだ何もありません</p>}
              <button type="button" className="mhl-btn mt-3 w-full bg-slate-700" onClick={() => setBoardOpen(false)}>閉じる</button>
            </div>
          </div>)}
        {scene && <AssistantLifeScene key={scene.key} scene={scene} look={look} canGive={canGive && itemsLeft > 0} onClose={() => setScene(null)} onGive={openGive}/>}
        {intro && (
          <button type="button" className="mhl-intro" data-assistant-life-intro={intro} onClick={() => setIntro(null)} aria-label="とばす">
            {intro === 'long' && <div className="absolute inset-0 grid place-items-center" style={{ animation: 'mhlFade .3s ease-in .9s both' }}>
              <div className="text-center" style={{ animation: 'mhlIntroTitle .5s ease-out both' }}><p className="mhl-en">ASSISTANT LIFE</p><p className="mhl-ti" style={{ fontSize: 30 }}>助手ライフ</p></div></div>}
            <div className="door" style={{ left: 0, animation: `mhlDoorL ${intro === 'long' ? '.5s' : '.35s'} ease-in ${intro === 'long' ? '.35s' : '0s'} both` }}/>
            <div className="door" style={{ right: 0, animation: `mhlDoorR ${intro === 'long' ? '.5s' : '.35s'} ease-in ${intro === 'long' ? '.35s' : '0s'} both` }}/>
          </button>)}
      </div>
      {give && <AssistantLifeGiveSheet give={give} setGive={setGive} life={life} peerSt={peerSt} itemInfos={itemInfos} haveOf={haveOf} usedOf={usedOf} nameOf={nameOf} onGive={doGive}/>}
    </div>);
}

// 📋 みんなの居場所の地図(HOME の町の絵の上に顔の丸)
// 町の絵(941×1672)の y 120〜1560 を見せる。場所の札は建物の下に置く(2026-11-07 社長「場所ごとの名称はあってる？」で建物と合わせ直した)
//   育成場=青い屋根の大きな建物と柵/図書室=金の塔/練習スタジオ=その右の青い屋根の石の家/中庭=光る泉/広場=方位の印/
//   おやつ屋さん=赤い屋根の家/マーケット=しましまの屋台/カード部屋=闘技場/ひなたの丘=滝の上/助手の家=左下の林(絵に家が無いので印だけ)
const ASSISTANT_LIFE_MAP_CROP = Object.freeze({ y0: 120, h: 1440 });
const ASSISTANT_LIFE_MAP_POS = Object.freeze({
  ranch: [23.4, 30.6], library: [69.1, 22.9], studio: [83.5, 27.8], garden: [69.1, 33.3], plaza: [51.0, 48.6],
  cafe: [14.9, 61.8], market: [85.0, 64.6], home: [9.6, 78.5], cardroom: [49.9, 91.7], hill: [80.8, 5.6],
});
function AssistantLifeTownMap({ life, ids, look, onPick }) {
  const at = {};
  for (const id of ids) { const w = assistantLifeWhereOf(life, id); const p = w ? w.place : 'home'; (at[p] = at[p] || []).push(id); }
  // 札と顔が地図のふちで切れないよう、描いたあとにはみ出した分だけ内側へずらす(丘は上・家は左のふち。2026-11-07 ミハリ L7①)
  const mapRef = useRef(null);
  React.useLayoutEffect(() => {
    const fit = () => {
      const m = mapRef.current; if (!m) return;
      const mr = m.getBoundingClientRect();
      for (const el of m.querySelectorAll('[data-assistant-life-map-place]')) {
        el.style.translate = '';
        const r = el.getBoundingClientRect();
        const dx = r.left < mr.left + 3 ? mr.left + 3 - r.left : r.right > mr.right - 3 ? mr.right - 3 - r.right : 0;
        const dy = r.top < mr.top + 3 ? mr.top + 3 - r.top : r.bottom > mr.bottom - 3 ? mr.bottom - 3 - r.bottom : 0;
        if (dx || dy) el.style.translate = `${dx}px ${dy}px`;
      }
      // 顔の丸が、となりの場所の札に重なるとき(中庭の顔と練習スタジオの札。2026-11-07 ミハリ 残り②): 顔のいない側(札だけ)を、
      //   上・下・左・右のうちほかの札にも地図のふちにもかからない、いちばん近い所へ逃がす
      const els = [...m.querySelectorAll('[data-assistant-life-map-place]')];
      const hit = (r, q) => Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1;
      const tr = (el) => (el.style.translate || '0px 0px').split(' ').map(v => parseFloat(v) || 0).concat([0]).slice(0, 2);
      for (const a of els) {
        if (!a.querySelector('button')) continue;
        for (const b of els) {
          if (a === b || b.querySelector('button')) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          if (!hit(ra, rb)) continue;
          const [x0, y0] = tr(b);
          const cands = [[0, ra.top - rb.bottom - 2], [0, ra.bottom - rb.top + 2], [ra.left - rb.right - 2, 0], [ra.right - rb.left + 2, 0]].sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1]));
          const free = cands.find(([dx, dy]) => {
            const q = { left: rb.left + dx, right: rb.right + dx, top: rb.top + dy, bottom: rb.bottom + dy };
            if (q.left < mr.left + 3 || q.right > mr.right - 3 || q.top < mr.top + 3 || q.bottom > mr.bottom - 3) return false;
            return els.every(o => o === b || !hit(q, o.getBoundingClientRect()));
          }) || cands[0];
          b.style.translate = `${x0 + free[0]}px ${y0 + free[1]}px`;
        }
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
  const tod = assistantLifeTodOn() && typeof TimeOfDayTint === 'function';
  const filter = { morning: 'saturate(.85) brightness(1.05) sepia(.18)', noon: 'none', evening: 'saturate(1.1) brightness(.85) sepia(.35) hue-rotate(-12deg)', night: 'brightness(.45) saturate(.7)' }[look];
  return (
    <div className="relative mb-2 overflow-hidden rounded-2xl border border-white/15" ref={mapRef} style={{ aspectRatio: `941 / ${ASSISTANT_LIFE_MAP_CROP.h}` }} data-assistant-life-map>
      <img src="data/images/home-background.jpg" alt="" className="absolute left-0 top-0 w-full" style={{ filter: tod ? 'none' : filter, transform: `translateY(-${(100 * ASSISTANT_LIFE_MAP_CROP.y0 / 1672).toFixed(2)}%)` }}/>
      {tod && <TimeOfDayTint/>}{/* 時間帯の色は HOME と同じ重ね(夜も地図が昼の明るさだった。ミハリ L7③・ハナビ) */}
      {Object.entries(ASSISTANT_LIFE_MAP_POS).map(([place, [x, y]]) => { const who = at[place] || []; return (
        <div key={place} className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center" style={{ left: `${x}%`, top: `${y}%` }} data-assistant-life-map-place={place}>
          {who.length > 0 && <span className="flex rounded-full border border-white/40 bg-slate-950/70 px-1 py-0.5">{who.map(id => { const a = assistantById(id); return a ? <button key={id} type="button" onClick={() => onPick(id)} className="-ml-1.5 first:ml-0 rounded-full"><AssistantFace who={a} size={24} accent={a.accent}/></button> : null; })}</span>}
          <span className={`mt-0.5 whitespace-nowrap rounded-md border px-1.5 text-[9.5px] font-black ${who.length ? 'border-amber-300 bg-amber-950/90 text-amber-50' : 'border-slate-500/60 bg-slate-950/70 text-slate-300'}`}>{ASSISTANT_LIFE_PLACE_ICON[place]} {place === 'home' ? '助手の家' : assistantLifePlaceShow(place)}</span>
        </div>); })}
    </div>);
}

// ---------- HOME: 遊んでいる所の施設の下に顔だけ(2026-11-07 社長「もっと小さくしてコンテンツの下において」) ----------
// 施設の札のすぐ下に、小さい顔を横1列で並べる。全員出す(上限で切らない)。札やほかのボタンに重ならないよう、
// 下にある札までのすき間を測って顔の大きさを決める(20〜12px)。1列に並びきらないときは、札の幅より外へ伸ばす(左の列は右へ・右の列は左へ)
const ASSISTANT_LIFE_FACILITY_SEL = Object.freeze({ rhythm: '.mh-home-facility.rhythm', card: '.mh-home-card-battle', management: '.mh-home-facility.management', market: '.mh-home-facility.market', life: '.mh-home-facility.life' });
const ASSISTANT_LIFE_HOME_OBSTACLES = '.mh-home-facility,.mh-home-card-battle,.mh-home-event-banner,.mh-home-tour-banner,.mh-home-mission,.mh-home-gift,.mh-home-event-badge,.mh-home-assistant';
function AssistantLifeHomeFaces({ metIds }) {
  const st = useAssistantLifeNow(metIds);
  const [rects, setRects] = React.useState({});
  React.useEffect(() => {
    if (!assistantLifeEnabled()) return undefined;
    const measure = () => {
      const o = {};
      // 🔄横(端末は縦のまま、器を90度回して描く)では、画面の座標ではなく器の中の座標で測る。顔の列も器の中に置かれるため
      //   (2026-11-07 本番で、🔄横の顔が札と関係ない所に出ていた)
      const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active();
      const rectOf = (el) => (rot ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect());
      const vw = rot ? window.innerHeight : window.innerWidth, vh = rot ? window.innerWidth : window.innerHeight;
      const obs = [...document.querySelectorAll(ASSISTANT_LIFE_HOME_OBSTACLES)].filter(el => el.offsetParent).map(el => ({ el, r: rectOf(el) }));
      for (const [k, sel] of Object.entries(ASSISTANT_LIFE_FACILITY_SEL)) {
        const el = document.querySelector(sel);
        if (!el || !el.offsetParent) continue;
        const r = rectOf(el);
        // 札の下にある、横に重なるものまでのすき間(顔の列は札の幅+140px まで伸びうるので、その幅で見る)
        const right = r.left + r.width / 2 > vw / 2;
        const x0 = right ? r.right - Math.max(r.width, 140) : r.left, x1 = right ? r.right : r.left + Math.max(r.width, 140);
        let gap = vh - r.bottom;
        for (const b of obs) { if (b.el === el || b.el.contains(el) || el.contains(b.el)) continue; if (b.r.top >= r.bottom - 2 && b.r.right > x0 && b.r.left < x1) gap = Math.min(gap, b.r.top - r.bottom); }
        o[k] = { x: r.left, y: r.top, w: r.width, h: r.height, gap: Math.round(gap), right };
      }
      setRects(prev => (JSON.stringify(prev) === JSON.stringify(o) ? prev : o));
    };
    measure();
    const t = setInterval(measure, 700);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, []);
  if (!assistantLifeEnabled() || !st.loaded || st.open) return null;
  const life = st.life;
  if (!life || life.abs !== assistantLifeSlotAt().abs) return null;
  const ids = (metIds || []).filter(id => ASSISTANT_LIFE_PREFS[id]);
  const by = {};
  for (const id of ASSISTANT_LIFE_HOUSE_ORDER) {
    if (!ids.includes(id)) continue;
    let f = assistantLifeFacilityOf(assistantLifeWhereOf(life, id));
    if (!rects[f]) f = 'life';
    if (!rects[f]) continue;
    (by[f] = by[f] || []).push(id);
  }
  const peer = typeof ASSISTANT_PEER_STORE !== 'undefined' ? ASSISTANT_PEER_STORE.state : null;
  const q = peer && peer.quarrel && peer.quarrel.pending;
  const after = new Set(q && q.pair ? String(q.pair).split('-') : []);
  return (<>
    {Object.entries(by).map(([f, list]) => {
      const r = rects[f];
      // 顔は必ず札(名前)の下(2026-11-07 社長「アイコンってコンテンツ名の下に表示じゃなかったっけ？」。横へ逃がす形はやめた)。
      //   すき間は札の並び(70-bootstrap.jsx)であけてある。足りないときは顔を小さくする(12px まで)
      const side = false;
      const size = Math.max(12, Math.min(20, r.gap - 3));
      const step = size - 4; // 少し重ねる
      const rowW = size + (list.length - 1) * step + 6;
      const left = side ? (r.right ? r.x - rowW - 4 : r.x + r.w + 4) : (r.right ? Math.max(4, r.x + r.w - rowW) : r.x);
      const top = side ? r.y + r.h / 2 - size / 2 : r.y + r.h + 1;
      return (
        <div key={f} data-assistant-life-home-faces={f} data-assistant-life-home-face-size={size} data-assistant-life-home-face-side={side ? '1' : '0'} className="pointer-events-none fixed" style={{ zIndex: 40, left, top, width: rowW }}>
          <div className="pointer-events-auto flex items-center rounded-full bg-slate-950/70 px-[3px] shadow">
            {list.map((id, i) => { const who = assistantById(id); if (!who) return null; const w = assistantLifeWhereOf(life, id); const lonely = w && w.reason === 'lonely';
              return (
                <button key={id} type="button" data-assistant-life-home-face={id} aria-label={`${who.name}のようす`} onClick={() => { ASSISTANT_LIFE_STORE.set({ open: true, focus: id }); }}
                  className="relative shrink-0 rounded-full active:scale-90" style={{ marginLeft: i ? -4 : 0, boxShadow: lonely ? '0 0 0 1.5px #fbbf24,0 0 6px #fbbf24' : after.has(id) ? '0 0 0 1.5px #7dd3fc' : '0 0 0 1.5px #fff' }}>
                  <AssistantFace who={who} size={size} accent={who.accent}/>
                  {/* 押しやすいように、見た目より広く押せる */}
                  <span aria-hidden="true" className="absolute -inset-1.5"/>
                </button>); })}
          </div>
        </div>); })}
  </>);
}
