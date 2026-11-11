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
const ASSISTANT_LIFE_PLACE_ICON = Object.freeze({ home: '🏡', plaza: '⛲', cafe: '🍰', studio: '🎵', ranch: '🥚', cardroom: '🃏', library: '📚', market: '🛍️', hill: '🌄', garden: '🌷', temple: '✨', battle: '⚔️' });
// 出かけている先を、HOME のどの施設に出すか(していること → 施設)。家と町は「🏡 助手ライフ」
// 遊び場(段階2・LIFE-STAGE2-PLAN.md): 札・居場所・地図・場面の題では、ゲームの遊びの場所を施設の名前で出す(「🎵 モンヒロビートへ」)。
//   台本の穴 {place} の言葉(ASSISTANT_LIFE_PLACES)は変えない。今日あったことも今の言葉のまま
const ASSISTANT_LIFE_PLACE_SHOW = Object.freeze({ studio: 'モンヒロビート', cardroom: 'MFバトルカード', ranch: 'M/B管理', temple: '神殿', battle: 'モンヒロバトル', home: 'みんなの家' }); // 家は HOME の札「助手ライフ みんなの家」とそろえる(地図)
const assistantLifePlaceShow = (place) => ASSISTANT_LIFE_PLACE_SHOW[place] || ASSISTANT_LIFE_PLACES[place] || '';
// 場所 → HOME の札(地図 56-assistant-life-map.jsx と同じ表。HOME の顔と地図の全身が同じ時刻に同じ場所に出る・2026-11-08 社長「矛盾のない作り」)。
//   町だけの場所(図書室・おやつ屋さん・ひなたの丘・中庭・広場)と家は「🏡 助手ライフ」
const ASSISTANT_LIFE_SPOT_FAC = Object.freeze({ studio: 'rhythm', cardroom: 'card', ranch: 'management', market: 'market', temple: 'temple', battle: 'battle', home: 'life' });
const assistantLifeFacilityOf = (entry) => (entry && ASSISTANT_LIFE_SPOT_FAC[entry.place]) || 'life';
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
  { id:'life-sleep-sorashido-001', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'・・・表の・・・3行目・・・ずれてる・・・' }] },
  { id:'life-sleep-sorashido-002', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'・・・うぉぉぉ・・・新記録・・・むにゃ' }] },
  { id:'life-sleep-sorashido-003', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'・・・なんくるないさ・・・すぅ・・・' }] },
  { id:'life-sleep-sorashido-004', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'・・・確率・・・でーじ・・・高い・・・' }] },
  { id:'life-sleep-sorashido-005', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'normal', t:'・・・攻略本・・・完成・・・です・・・' }] },
  { id:'life-sleep-sorashido-006', kind:'life-sleep', who:'sorashido', line:'talk', lv:null, lines:[{ who:'sorashido', e:'happy', t:'・・・{name}・・・ちばりよー・・・' }] },
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
  { id:'life-sleep-sorashido-007', kind:'life-sleep', who:'sorashido', line:'woken', lv:'1-4', lines:[{ who:'sorashido', e:'surprise', t:'・・・はっ！？ {name}ですか・・・寝ぼけてました' }] },
  { id:'life-sleep-sorashido-008', kind:'life-sleep', who:'sorashido', line:'woken', lv:'1-4', lines:[{ who:'sorashido', e:'troubled', t:'・・・まだ10時前ですよね・・・朝は弱いんです・・・' }] },
  { id:'life-sleep-sorashido-009', kind:'life-sleep', who:'sorashido', line:'woken', lv:'5-10', lines:[{ who:'sorashido', e:'troubled', t:'・・・{name}・・・いま、表の夢の途中だったんですよ・・・' }, { who:'sorashido', e:'happy', t:'・・・まあいいです。起きたからには、計算しますねー' }] },
  { id:'life-sleep-sorashido-010', kind:'life-sleep', who:'sorashido', line:'woken', lv:'5-10', lines:[{ who:'sorashido', e:'happy', t:'・・・ふぁ・・・{name}の声なら、目ざましより効きますね笑' }] },
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
  // 顔の並び(pair)も、その場にいる人だけにする(けんか中の「距離をおく」で、いない相手の顔と名前が出ていた・2026-11-08 ミハリ)
  const pair = Array.isArray(talk.pair) && talk.pair.some(x => !ids.includes(x)) ? talk.pair.filter(x => ids.includes(x)) : talk.pair;
  const narrowed = pair !== talk.pair ? { ...talk, pair: pair.length ? pair : [...ids] } : talk;
  if (talk.lines.every(l => ids.includes(l.who))) return narrowed;
  const lines = talk.lines.filter(l => ids.includes(l.who));
  return lines.length ? { ...narrowed, lines } : null;
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
// いまモンヒロバトルにいる助手(読むだけ。助手のマスモンの修行は、助手がここにいる回に行う・2026-11-11 社長「MB管理とモンバトは別」)。
//   印が偽・いまの時間の様子がまだ無いときは false/[]。組で来ていれば全員
const assistantLifeAtBattle = (id) => { try { const w = assistantLifeWhereOf(assistantLifeCurrent(), id); return !!(w && w.doing === 'battle' && w.place === 'battle'); } catch (_) { return false; } };
const assistantLifeBattleIds = () => ASSISTANT_LIFE_HOUSE_ORDER.filter(assistantLifeAtBattle);
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
  // 場所の言い方は HOME の札・地図・家の出かけ札とそろえる(assistantLifePlaceShow・2026-11-08 社長の地図 A)
  const text = gs.map(g => `${g.ids.map(assistantLifeName).join('・')} ${assistantLifePlaceShow(g.place)}で${ASSISTANT_LIFE_DOINGS[g.doing].label}`).join(' / ');
  void assistantLifeDiaryAdd(`${assistantLifeTodLabel(now)}: ${text}`, gs.flatMap(g => g.ids), { kind: 'slot', now, slotAbs: slot.abs });
};
// モンヒロビートの助手とのセッション(ビート部とのつなぎ口)。向きは「ビート部が呼ぶ」:
//   1曲終えて助手が育ったら、ビート部が assistantLifeOnSessionLive(ev) を呼ぶ(ev = { assistantId, partnerIds, songId, levelUp, level, duo, at })
//   家の部屋から「一緒にモンビー」を押したら、ビート部が入れておいた ASSISTANT_LIFE_LINKS.beatInvite(助手id) を呼ぶ(無ければボタンを出さない)
// カード部が入れておく ASSISTANT_LIFE_LINKS.cardInvite(助手id)(84 の cardLifeSetApp)。カード部屋にいる助手の部屋で「🃏 カード部屋で対戦する」を押すと呼ぶ(無ければボタンを出さない)
// chatWith(id, { asleep, follow }) … その助手とのおしゃべりを、助手ライフの上に開く(本体 60-app.jsx が入れる・2026-11-08 社長 ❼〜❿ 助手部ココロ)
// chatFollowLine(id) … 声をかけたあとの続きのカードのひとこと { kind:'ask'|'offer'|'plain', text, value? }(呼び方の話の日・社長 ❾)
//   公開の印 assistantCallname が偽のあいだは null のまま(部屋に「おしゃべりする」も続きのカードも出ない)
// goPlace … HOME が入れておく { ranch, temple, market } の開き方(「いま行くと得なこと」から施設へ行く。HOME の札と同じ動き)
const ASSISTANT_LIFE_LINKS = { beatInvite: null, cardInvite: null, chatWith: null, chatFollowLine: null, goPlace: null, masmonTrainBoost: null, marketPerkToday: null };
// いまカード部屋にいる助手(段階2の読むだけの口 assistantLifeCardIds。無い・こわれているときはだれもいない)
const assistantLifeHouseCardIds = () => {
  try { const v = typeof assistantLifeCardIds === 'function' ? assistantLifeCardIds() : []; return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
};
// カード部屋の 1.5倍を、この時間帯で使い切った助手か(カード部 84 の cardLifeRewardSpent。2026-11-08 社長 Q2 A)。
//   使い切ったら { next: 次の時間帯の始まりの時 }、まだなら null。居場所(カード部屋にいる)は変えず、HOME の顔と地図には「済」の印(AssistantLifeSpentMark)・「UP」からは外す・部屋のボタンを灰色にする
const assistantLifeCardSpent = (id) => { try { return typeof cardLifeRewardSpent === 'function' ? cardLifeRewardSpent(id) : null; } catch { return null; } };
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
  void assistantLifeDiaryAdd(`${assistantLifeName(ev.assistantId)}とMFバトルカードで対戦して${ev.won ? '勝った' : '負けた'}`, [ev.assistantId], { kind: 'card', now: ev.at || Date.now() });
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
.mhl-quick{display:flex;align-items:center;gap:5px;border-radius:999px;padding:3px 4px 3px 9px;border:1px solid #fbbf2488;background:rgba(15,23,42,.78);font-size:10.5px;font-weight:900;color:#fde68a}.mhl-quick b{color:#fff}.mhl-quick button{min-height:26px;border-radius:999px;padding:0 9px;background:#334155;color:#e2e8f0;font-size:10.5px;font-weight:900;border:1px solid #64748b}.mhl-quick.is-start{padding:3px 10px;min-height:30px;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#fff;border-color:#fde68a}
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
.mhl-room .bb{position:absolute;right:4px;z-index:5;max-width:88%;overflow:hidden;white-space:normal;line-height:1.2;text-align:center;font-size:9.5px;font-weight:900;background:#fff;color:#1e293b;border-radius:9px;padding:1px 6px;box-shadow:0 2px 5px #0007}
.mhl-room .off{position:absolute;inset:0;z-index:3;background:rgba(6,9,24,.5)}
.mhl-room .lamp{position:absolute;inset:0;z-index:3;background:radial-gradient(circle at 60% 40%,rgba(255,214,140,.45),transparent 70%);mix-blend-mode:screen;pointer-events:none}
.mhl-room .tag{position:absolute;left:3px;right:3px;top:2px;z-index:6;text-align:left;padding:0 5px 1px;border-radius:6px;background:linear-gradient(#fef3c7,#fde68a);color:#422006;border:1.5px solid #b45309;box-shadow:0 2px 4px #0008}
.mhl-room .tag small{display:block;height:19px;font-size:8.5px;line-height:19px;font-weight:800;color:#7c2d12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mhl-room .tag b{display:block;font-size:10px;line-height:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mhl-room .tag i{display:none;font-style:normal}
.mhl-room[data-assistant-life-room-tag="1"] .pl{z-index:7}.mhl-room[data-assistant-life-room-tag="1"] .lv{top:38px}
[data-assistant-life-land="1"] .mhl-room .tag{top:22px;padding:0 4px}[data-assistant-life-land="1"] .mhl-room .tag b{font-size:9px;line-height:11px}[data-assistant-life-land="1"] .mhl-room .tag small{display:none}[data-assistant-life-land="1"] .mhl-room .tag i{display:inline}[data-assistant-life-land="1"] .mhl-room .tag[data-assistant-life-room-tag-mark="1"] small{display:block;margin-left:0!important;height:11px;font-size:9px;line-height:11px}[data-assistant-life-land="1"] .mhl-room .tag[data-assistant-life-room-tag-mark="1"] b{display:none}
[data-assistant-life-land="1"] .mhl-room[data-assistant-life-room-tag="1"] .lv{left:auto;right:3px;top:5px}
.mhl-room[data-assistant-life-room-v2="1"] .tag{background:linear-gradient(#e2e8f0e6,#cbd5e1e6);color:#1e293b;border:1.5px solid #64748b;box-shadow:0 1px 3px #0006}
.mhl-room[data-assistant-life-room-v2="1"] .tag small{font-size:10.5px;color:#334155}.mhl-room[data-assistant-life-room-v2="1"] .tag b{font-size:10.5px;line-height:13px}
[data-assistant-life-land="1"] .mhl-room[data-assistant-life-room-v2="1"] .tag b{font-size:10.5px;line-height:13px}[data-assistant-life-land="1"] .mhl-room[data-assistant-life-room-v2="1"] .tag[data-assistant-life-room-tag-mark="1"] small{font-size:10.5px;height:13px;line-height:13px}
.mhl-room .meet{position:absolute;top:5px;z-index:7;font-size:10.5px;line-height:15px;font-weight:900;padding:0 6px;border-radius:8px;background:#16a34a;color:#fff;border:1px solid #bbf7d0;box-shadow:0 0 8px #4ade80aa;white-space:nowrap}
.mhl-room .meet.zz{background:#4338ca;border-color:#c7d2fe;box-shadow:none}
.mhl-room[data-assistant-life-room-v2="1"][data-assistant-life-room-in=""] .w,.mhl-room[data-assistant-life-room-v2="1"][data-assistant-life-room-in=""] .fu{filter:saturate(.55)}
.mhl-room[data-assistant-life-room-v2="1"]:not([data-assistant-life-room-in=""]){box-shadow:0 0 0 2px #86efac,0 0 10px #4ade8088;z-index:1}
.mhl-room .lock{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:rgba(15,23,42,.78);font-size:11px;font-weight:900;color:#cbd5e1}
.mhl-liv{position:absolute;overflow:hidden;border-radius:3px;background:linear-gradient(#f3e3c4,#e7cfa2)}
.mhl-board{position:absolute;left:8px;top:6px;bottom:6px;border-radius:5px;background:#c08a52;border:3px solid #7c4a22;padding:3px 6px;overflow:hidden;display:flex;flex-direction:column;flex-wrap:wrap;align-content:flex-start;justify-content:flex-start;column-gap:24px}
.mhl-board>*{width:100%;flex:none}
[data-assistant-life-land="1"] .mhl-board{top:3px;bottom:3px;padding:2px 6px}
.mhl-board-more{margin-left:auto;flex:none;border-radius:999px;background:#fffbeb;color:#7c4a22;font-size:8.5px;font-weight:900;line-height:1;padding:2px 5px;white-space:nowrap}
.mhl-board b{display:block;font-size:9.5px;color:#fff}.mhl-board p{font-size:9px;font-weight:800;line-height:1.25;color:#1e293b;background:#fffbeb;border-radius:3px;padding:1px 4px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mhl-door{position:absolute;bottom:0;width:38px;border-radius:18px 18px 0 0;background:linear-gradient(#8b5a2b,#6b4423);border:2px solid #3b2412}
.mhl-find{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:900;padding:6px 10px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#db2777);border:1.5px solid #fff9;box-shadow:0 4px 12px #0009}
.mhl-tile{position:relative;display:block;min-height:58px;border-radius:12px;padding:6px 6px 4px;text-align:left;clip-path:polygon(0 0,88% 0,100% 20%,100% 100%,0 100%);overflow:hidden;box-shadow:inset 0 -4px 0 #0003;color:#fff}
.mhl-tile:active{transform:scale(.97)}@media (prefers-reduced-motion:no-preference){.mhl-glow{animation:mhl-glow 1.3s ease-in-out infinite}}@keyframes mhl-glow{0%,100%{filter:brightness(1);transform:scale(1)}50%{filter:brightness(1.7) saturate(1.3);transform:scale(1.05)}}.mhl-tile:disabled{opacity:.55}
.mhl-tile i{font-style:normal;font-size:17px;display:block;line-height:1}.mhl-tile b{display:block;font-size:12px;font-weight:900;margin-top:2px;text-shadow:0 1px 2px #0007;white-space:nowrap}
.mhl-tile small{display:block;font-size:9px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mhl-tile em{position:absolute;right:6px;top:4px;font-style:normal;font-size:9px;font-weight:900;background:#0f172acc;border-radius:999px;padding:0 5px}
.mhl-watch{background:linear-gradient(135deg,#fb7185,#f59e0b)}.mhl-call{background:linear-gradient(135deg,#38bdf8,#6366f1)}.mhl-give{background:linear-gradient(135deg,#34d399,#16a34a)}.mhl-beat{background:linear-gradient(135deg,#a855f7,#ec4899)}.mhl-card{background:linear-gradient(90deg,#fde68a,#fbbf24,#f59e0b);color:#1e1b4b}.mhl-card-up{margin-left:6px;border-radius:999px;background:#1e1b4b;color:#fde68a;padding:1px 7px;font-size:11px}
.mhl-icons{display:flex;gap:6px}.mhl-icons button{flex:1;min-height:48px;border-radius:12px;background:rgba(30,41,59,.9);border:1px solid #ffffff2a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#e2e8f0}
.mhl-icons button.on{background:linear-gradient(#f472b633,#f472b611);border-color:#f9a8d4;color:#fff}.mhl-icons button i{font-style:normal;font-size:17px;line-height:1.1}
.mhl-sheet{position:absolute;left:0;right:0;bottom:0;z-index:20;max-height:86%;overflow-y:auto;border-radius:22px 22px 0 0;background:linear-gradient(#1e1b4b,#0b1020 40%);border-top:2px solid #f9a8d4;box-shadow:0 -10px 30px #000a;padding:12px 14px calc(14px + env(safe-area-inset-bottom))}
.mhl-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #ffffff1a;font-size:12px;font-weight:800}
.mhl-row .k{width:78px;flex:none;color:#cbd5e1;font-size:10.5px}
.mhl-btn{min-height:44px;border-radius:12px;font-size:12px;font-weight:900;color:#fff}.mhl-btn:disabled{opacity:.45}
/* 背の低い横(🔄横 667×375 など)では、部屋のシートの下に止めたボタンの段が画面を占めて、見出しの下の行を隠していた(2026-11-08 ミハリ)。ボタンを少し低くする */
@media (orientation:landscape) and (max-height:420px){[data-assistant-life-room-acts] .mhl-btn{min-height:34px;font-size:11.5px}[data-assistant-life-room-acts]{gap:5px}}
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
// 出かけ札の上の行に入るだけの名前(字の数で数える)。入らない分は「ほか◯人」。text は assistantLifeGroupNames の形(「A・B・C」か「A・B ほか2人」)
const assistantLifeTagNames = (text, budget) => {
  const m = String(text || '').match(/^(.*?)(?: ほか(\d+)人)?$/);
  const list = String(m[1] || '').split('・').filter(Boolean);
  let rest = Number(m[2]) || 0;
  const len = (a, r) => [...a.join('・')].length + (r ? [...` ほか${r}人`].length : 0);
  const out = [...list];
  while (out.length > 1 && len(out, rest) > budget) { out.pop(); rest++; }
  return `${out.join('・')}${rest ? ` ほか${rest}人` : ''}`;
};
// other … よその家(フレンドの家)を描くとき { put }。自分のセッションの Lv は出さず、家具は控えの置き方で描く(56-assistant-life-friend.jsx)
function AssistantLifeRoom({ id, met, look, x, y, w, h, state, onOpen, idx, other = null, v2 = false }) {
  const L = ASSISTANT_LIFE_ROOM_LOOK[id];
  const view = ASSISTANT_LIFE_VIEW[look][idx % 2];
  const night = look === 'night';
  const ppl = state && state.in ? state.in : null;
  const sess = other ? null : assistantLifeSessionInfo(id);
  return (
    <button type="button" className="mhl-room" data-assistant-life-room={id} data-assistant-life-room-in={ppl ? ppl.join(',') : ''} data-assistant-life-room-tag={state && state.tag ? '1' : '0'} data-assistant-life-room-v2={v2 ? '1' : '0'}
      style={{ left: x, top: y, width: w, height: h }} onClick={() => met && onOpen(id)} aria-label={`${assistantLifeName(id)}の部屋`}>
      <div className="w" style={{ background: `linear-gradient(${L.wall[0]},${L.wall[1]})`, filter: night ? (ppl ? 'brightness(.92)' : 'brightness(.55)') : undefined }}/>
      <div className="win"><img src={view} alt="" loading="lazy" style={{ objectPosition: `${(idx % 3) * 40}% 60%` }}/></div>
      <span className="pl">{met ? assistantLifeName(id) : '？'}</span>
      {/* 町の人(助手になる前・56-assistant-life-partner.jsx)は名札の下に小さく。押すと部屋ではなく小窓 */}
      {v2 && met && !other && typeof assistantLifePartnerOk === 'function' && !assistantLifePartnerOk(id) && <span className="absolute z-[3] rounded-full bg-slate-700/95 px-1.5 text-[9.5px] font-black leading-[15px] text-slate-100" style={{ left: 4, top: 24 }} data-assistant-life-room-town={id}>町の人</span>}
      {/* 新UI: いま部屋にいて会える助手の部屋に印(留守の部屋と見分ける・2026-11-11 改善案3) */}
      {v2 && met && ppl && ppl.includes(id) && <span className={`meet${state.sleep ? ' zz' : ''}`} data-assistant-life-room-meet={id} style={w >= 150 ? { left: [...assistantLifeName(id)].length * 10 + 24 } : { right: 3 }}>{w >= 150 ? (state.sleep ? '💤 おやすみ中' : '● いま会える') : (state.sleep ? '💤' : [...assistantLifeName(id)].length >= 4 ? '●' : '会える')}</span>}
      {met && sess && sess.level > 1 && <span className="lv" data-assistant-life-room-session={sess.level}>🎵Lv{sess.level}</span>}
      <span className="fu" aria-hidden="true">{L.furn}</span><div className="fl"/>
      {typeof AssistantLifeRoomFurn === 'function' && <AssistantLifeRoomFurn id={id} put={other ? other.put || {} : null} w={w} h={h} faces={ppl ? ppl.length : 0} baseCount={[...String(L.furn || '')].filter(c => /\p{Extended_Pictographic}/u.test(c)).length}/>}
      {ppl && !state.sleep && (look === 'night' || look === 'evening') && <div className="lamp"/>}
      {ppl && state.sleep && <div className="off" style={{ background: night ? 'rgba(3,5,16,.6)' : 'rgba(30,27,75,.35)' }}/>}
      {!ppl && met && <div className="off" style={night ? { background: 'rgba(3,5,16,.72)' } : undefined}/>}
      {ppl && <div className="pp">{ppl.map(pid => { const who = assistantById(pid); return who ? (
        <span key={pid} className={state.lonely && pid === id ? 'lonely' : state.after ? 'after' : ''} data-assistant-life-room-face={pid} style={{ position: 'relative', ...(v2 && !other && typeof assistantLifePartnerOk === 'function' && !assistantLifePartnerOk(pid) ? { filter: 'grayscale(.55) brightness(.85)' } : {}) }}><AssistantFace who={who} size={Math.round(Math.min(40, h * .44))} accent={who.accent}/>
          {/* 寝ているときは目を閉じた形を重ねる(2026-11-11 社長「目を開けっぱなしの人がいる」・顔の枠の線2pxの内側)。部屋の「寝ている」印で決める(フレンドの家も同じ) */}
          {met && typeof AssistantLifeSleepEyes === 'function' && state.sleep && (() => { const sz = Math.round(Math.min(40, h * .44)) - 4; return <AssistantLifeSleepEyes pid={pid} src={assistantFaceSrc(who, null)} w={sz} h={sz} style={{ left: 2, top: 2 }}/>; })()}</span>) : null; })}</div>}
      {ppl && state.bub && <span className="bb" data-assistant-life-room-bub style={{ bottom: Math.round(Math.min(40, h * .44)) + 14, fontSize: w < 150 ? 8.5 : undefined }}>{[].concat(state.lonely && !state.sleep && !state.after && w < 150 ? ['💭 さみしいな…'] : state.bub).map((x, i) => <React.Fragment key={i}>{i ? <wbr/> : null}<span className="whitespace-nowrap" data-assistant-life-chunk>{x}</span></React.Fragment>)}</span>}
      {typeof AssistantLifeRelRoomLayer === 'function' && <AssistantLifeRelRoomLayer state={state} h={h}/>}
      {/* 出かけ札は床にかけない(2026-11-08 社長: 助手のマスモンが部屋の床を歩く。キズナ2)。縦は名札の右に2行(行き先/一緒の全員の名前・ひとりなら何をしているか・けんかや仲直りの印)、
          横は名札の下に1行(行き先・人数・印)。どちらも部屋の上から 36px までに収める */}
      {met && !other && typeof AssistantMasmonRoomPet === 'function' && <AssistantMasmonRoomPet id={id} h={h} life={typeof assistantLifeCurrent === 'function' ? assistantLifeCurrent() : null}/>}
      {state && state.tag && (() => { const t = state.tag; const mark = !!t[1] && /^(💢|🤝)/u.test(t[1]); const n = Number((String(t[1] || '').match(/^(\d+)人で/) || [])[1]) || 0;
        // 縦: 上の行(名札の右)に一緒の全員の名前か、ひとりなら何をしているか・印。下の行(札の幅いっぱい)に行き先。名前は札に入る数まで(残りは「ほか◯人」)
        const ml = [...assistantLifeName(id)].length * 10 + 20; // 名札の幅(字10px+余白)。上の行はその右から
        const names = t[2] ? assistantLifeTagNames(t[2], Math.floor((w - 6 - ml - 10) / (v2 ? 10.8 : 8.8))) : null;
        const short = [...String(t[0])].length <= 9; // 横は1行。行き先が長いときは人数を付けない(「…」で切らない)
        return <span className="tag" data-assistant-life-room-away={id} data-assistant-life-room-tag-mark={mark ? '1' : '0'}>
          {mark || !names ? <small data-assistant-life-room-what style={{ marginLeft: ml }}>{t[1]}</small> : <small data-assistant-life-room-with style={{ marginLeft: ml }}><AssistantLifeNames text={names}/></small>}
          <b>{v2 && w >= 150 ? <span data-assistant-life-room-out className="mr-1 rounded bg-slate-600 px-1 text-white">留守</span> : null}{t[0]}<i data-assistant-life-room-tag-short>{n > 1 && short ? `・${n}人` : ''}{mark ? ` ${[...t[1]][0]}` : ''}</i></b></span>; })()}
      {!met && <span className="lock">{other ? 'まだいない' : 'まだ会っていない'}</span>}
    </button>);
}

// 家(縦: 4階×2部屋 / 横: 2段×4部屋)。部屋・居間・屋根裏の位置は注文書 HOUSE-ART-ORDER.md と同じ並び
// hname・other … よその家(フレンドの家)を描くとき。other は { [助手]: { put } }(56-assistant-life-friend.jsx)
function AssistantLifeHouseArt({ width, land, look, rooms, metSet, onOpen, diary, pop, onBoard, life = null, peerSt = null, hname = '🏡 助手の家', other = null, v2 = false }) {
  const wall = 6, cols = land ? 4 : 2, rows = land ? 2 : 4;
  const rw = (width - wall * (cols + 1)) / cols;
  const rh = land ? Math.round(rw * 0.74) : Math.round(rw * 0.5);
  const lh = land ? 62 : 78, roofH = land ? 44 : 64;
  const bodyH = wall + rows * (rh + wall) + lh + wall, ly = wall + rows * (rh + wall);
  const night = look === 'night';
  const items = (diary.items || []).slice(-3).reverse();
  const total = (diary.items || []).length;
  // 掲示板に入りきった件の数を測る(入らない件は見えない右の列へ回る .mhl-board)。残りは見出しに「ほか◯件」(2026-11-08 社長「切れてここまでしかみれない」)
  const boardRef = React.useRef(null);
  const [shownN, setShownN] = React.useState(items.length);
  React.useLayoutEffect(() => {
    const el = boardRef.current; if (!el) return;
    const w = el.clientWidth;
    const n = [...el.querySelectorAll('[data-assistant-life-board-item]')].filter(p => p.offsetLeft + 1 < w).length;
    if (n !== shownN) setShownN(n);
  });
  const restN = Math.max(0, total - Math.min(shownN, items.length));
  return (
    <div className={`mhl-house${pop ? ' mhl-pop' : ''}`} data-assistant-life-house style={{ width, height: roofH + bodyH }}>
      <div className="mhl-chim" style={{ left: width * .72, top: roofH * .05, height: roofH * .6 }}/>
      <div className="mhl-roof" style={{ height: roofH }}/>
      {/* 屋根裏の🔒は、何か分からないので出さない(屋根裏ができたら出す。2026-11-07 ミハリ L11) */}
      <span className="mhl-hname" data-assistant-life-hname style={{ top: roofH - 22 }}>{hname}</span>
      <div className="mhl-frame" style={{ top: roofH, height: bodyH }}>
        {ASSISTANT_LIFE_HOUSE_ORDER.map((id, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          return <AssistantLifeRoom key={id} id={id} idx={i + r} met={metSet.has(id)} look={look} x={wall + c * (rw + wall)} y={wall + r * (rh + wall)} w={rw} h={rh} state={rooms[id]} onOpen={onOpen} v2={v2 && !other} other={other ? (other[id] || {}) : null}/>;
        })}
        <div className="mhl-liv" data-assistant-life-living style={{ left: wall, top: ly, width: width - 2 * wall, height: lh, filter: night ? 'brightness(.62)' : undefined }}>
          <button type="button" ref={boardRef} className="mhl-board text-left" data-assistant-life-board onClick={onBoard} style={{ width: Math.min(width * (land ? .42 : .52), 240) }} aria-label="今日あったことを全部見る">
            <b className="flex items-center gap-1">📌 今日あったこと{items.length > 0 && <span className="mhl-board-more" data-assistant-life-board-more={restN}>{restN > 0 ? `ほか${restN}件 ›` : '全部 ›'}</span>}</b>
            {items.length ? items.slice(0, land ? 1 : 2).map((x, i) => <p key={i} data-assistant-life-board-item><AssistantLifeChunks text={`${x.t} ${assistantLifeBoardShort(x.text, land ? 2 : 1)}`}/></p>) : <p>👀 見守ると ここに残ります</p>}
          </button>
          <div className="mhl-door" style={{ left: width * (land ? .62 : .66), height: lh - 14 }}/>
          <span className="absolute text-[24px]" style={{ left: width * (land ? .62 : .66) + 46, bottom: 6 }} aria-hidden="true">🛋️</span>
          <span className="absolute right-2 top-1 text-[9px] font-black text-amber-900">みんなの居間</span>
          {night && <span className="absolute text-[18px]" style={{ right: 40, bottom: 6 }} aria-hidden="true">🔥</span>}
          {!other && typeof AssistantLifeRelLiving === 'function' && <AssistantLifeRelLiving life={life} peerSt={peerSt} width={width} lh={lh} land={land}/>}
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
        rooms[id] = { in: [host, ...ids.filter(x => x !== host)], lonely, sleep: w.doing === 'sleep', bub: w.doing === 'sleep' ? ['💤 おやすみ中'] : lonely ? ['💭 だれか', '来ないかな…'] : ids.length > 1 ? ['部屋で', `${ids.length}人で`, doing.label] : ['部屋で', doing.label] };
        // 段階C(2026-11-08 社長 ❶A ❷A): 好きな家具を置いた部屋にひとりでいるときは家具の吹き出し/遊びに来た助手と家具の掛け合いがあれば「◯◯の話をしてる」
        if (w.doing !== 'sleep' && !lonely) {
          const visit = ids.length > 1 && typeof assistantLifeFurnVisitOf === 'function' ? assistantLifeFurnVisitOf(host, ids) : null;
          const use = ids.length === 1 && typeof assistantLifeFurnUseBub === 'function' ? assistantLifeFurnUseBub(host) : null;
          if (visit) rooms[id] = { ...rooms[id], bub: assistantLifeFurnVisitBub(visit) || rooms[id].bub, furnVisit: visit.id };
          else if (use) rooms[id] = { ...rooms[id], bub: use.bub, furnUse: use.key };
        }
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
      rooms[id] = rooms[id].in ? { ...rooms[id], after: true, bub: [`💢 ${assistantLifeName(other)}と`, '言い合いのあと'] } : { ...rooms[id], tag: [rooms[id].tag[0], mark, rooms[id].tag[2] || null] };
    }
  }
  // 扉を閉める・居間で離れて座る・仲直りの札・やきもち(56-assistant-life-rel.jsx)
  if (typeof assistantLifeRelDecorateRooms === 'function') { try { assistantLifeRelDecorateRooms(rooms, life, peer); } catch {} }
  // フレンドの家へ遊びに行っている助手の札「🏘 〇〇さんの家へ」(56-assistant-life-friend.jsx。印が偽なら何もしない)
  if (typeof assistantLifeFriendDecorateRooms === 'function') { try { assistantLifeFriendDecorateRooms(rooms); } catch {} }
  return rooms;
};

// 部屋を押したとき(その助手のこと・その場でできること)
function AssistantLifeRoomSheet({ id, life, peerSt, bondLevelOf, diary, onClose, onPeek, onInvite, onWatch, onGive, onBeat, onCard, canGive, slot, land = false, onMediate = null, roomState = null, furnItems = null, onGiveFurn = null, openFurn = false, onFurnTalk = null, onMasmon = null, onChat = null, follow = null, onFollowDone = null, onGiveSolo = null, canGiveSolo = false, returnToMap = false, uiV2 = false }) {
  const [furnOpen, setFurnOpen] = React.useState(!!openFurn);
  const [layoutOpen, setLayoutOpen] = React.useState(false); // 模様替え(56-assistant-life-roomedit.jsx・公開の印 assistantLifeRoomEdit)
  const layoutOn = typeof assistantLifeRoomEditEnabled === 'function' && assistantLifeRoomEditEnabled();
  const soloOn = typeof assistantLifeSoloOn === 'function' && assistantLifeSoloOn() && !!onGiveSolo;
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
  const slotDef = Number.isFinite(slot.to) ? slot : ASSISTANT_LIFE_SLOTS[slot.i]; // 12区切り: 次の移動までの時刻は区切り(slot.to)
  const groupNames = w && w.group ? assistantLifeGroupNames(w.group.ids, 8) : null;
  const groupText = w && w.group ? '' : ' ・ ひとり';
  const where = !w ? '🏡 部屋で過ごしている' : home ? `🏡 部屋で${doing}${groupText}` : `${ASSISTANT_LIFE_PLACE_ICON[w.place] || '🚶'} ${assistantLifePlaceShow(w.place)}で${doing}${groupText}`;
  // 部屋を大きく見る(2026-11-08 社長 案A・56-assistant-life-roomview.jsx): 上(横は左)に大きな部屋、下(横は右)に今までの中身。
  //   いちばん前のボタンは「← 家へ」(閉じる)。縦は下へ送ると中身、横は右の欄が中身
  const scrollRef = React.useRef(null);
  const sheetRef = React.useRef(null);
  const toSheet = () => { try { const box = scrollRef.current, el = sheetRef.current; if (box && el) box.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' }); } catch (_) {} };
  const people = !w ? [id] : home ? (w.group ? w.group.ids.filter(x => ASSISTANT_LIFE_PREFS[x]) : [id]) : [];
  const sleepIds = people.filter(x => { const e = assistantLifeWhereOf(life, x); return e && e.doing === 'sleep'; });
  const friendAway = typeof assistantLifeFriendAwayOf === 'function' && !!assistantLifeFriendAwayOf(id);
  const away = home ? null : friendAway ? { title: '🏘 フレンドの家へ', sub: '' } : { title: `${ASSISTANT_LIFE_PLACE_ICON[w.place] || '🚶'} ${assistantLifePlaceShow(w.place)}へ`, sub: `${w.group ? `${assistantLifeGroupNames(w.group.ids.filter(x => x !== id), 3)}と一緒 ・ ` : ''}${slotDef ? `${slotDef.to % 24}時まで` : ''}` };
  const rvFurn = typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled() && typeof assistantLifeRoomOf === 'function'
    ? Object.entries(assistantLifeRoomOf(id).put || {}).filter(([, k]) => k).map(([slot, k]) => { const f = assistantLifeFurnOf(k); return f ? { slot, key: k, emoji: f.emoji, name: f.name } : null; }).filter(Boolean) : [];
  const rvTeam = typeof assistantLifeRoomMasmons === 'function' ? assistantLifeRoomMasmons(id, life) : [];
  const rvAct = (k, label, cls, fn, dis = false) => <button key={k} type="button" data-assistant-life-roomview-act={k} disabled={dis} onClick={fn} className={`rounded-xl px-1 py-2 min-h-[44px] text-[12px] font-black text-white shadow active:scale-95 disabled:opacity-40 ${cls}`}>{label}</button>;
  const rvDock = land || uiV2 ? null : (
    <div className="grid grid-cols-3 gap-1.5" data-assistant-life-roomview-dock>
      {rvAct('sheet', home ? '👀 ようす' : '👀 くわしく', 'bg-gradient-to-br from-rose-400 to-amber-500', toSheet)}
      {rvAct('chat', asleep ? '💤 起こす' : '💬 おしゃべり', 'bg-gradient-to-br from-sky-400 to-indigo-500', () => (onChat ? onChat(id, null) : toSheet()), !onChat && !home)}
      {rvAct('give', '🎁 贈る', 'bg-pink-600', () => { if (soloOn && canGiveSolo) onGiveSolo(id, w && w.group ? w.group.ids : [id]); else if (w && w.group && canGive) onGive(w.group); else toSheet(); })}
      {rvAct('furn', '🪑 家具', 'bg-orange-600', () => setFurnOpen(true), !(typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled() && onGiveFurn))}
      {rvAct('masmon', `🐾 マスモン ${rvTeam.length || ''}`.trim(), 'bg-teal-600', () => (onMasmon ? onMasmon(id) : toSheet()), !onMasmon)}
      {rvAct('beat', atBeat ? '🎵 会いに行く' : '🎵 ビート', 'bg-gradient-to-br from-violet-500 to-pink-500', () => onBeat(id), typeof ASSISTANT_LIFE_LINKS.beatInvite !== 'function')}
    </div>);
  // 横で狭い画面(667 など)は、右の中身の欄を半分まで広げる(説明が言葉の途中で折れて、下のボタンの段に隠れた・2026-11-08 ミハリ)
  const rvSheetW = land && typeof window !== 'undefined' && window.innerWidth < 760 ? '50%' : '42%';
  const rvScene = typeof AssistantLifeRoomScene === 'function' ? (
    <AssistantLifeRoomScene id={id} look={typeof assistantLifeTimeLook === 'function' ? assistantLifeTimeLook() : 'noon'} land={land} people={people} sleepIds={sleepIds} away={away} team={rvTeam} furn={rvFurn}
      bubble={follow && follow.text ? follow.text : ''} title={`${who.name}の部屋`} sub={`${lv != null ? `💗 仲良し度 Lv${lv} ・ ` : ''}${where}`}
      onPerson={() => toSheet()} onMasmon={onMasmon ? () => onMasmon(id) : null} dock={rvDock} padLeft={78} layoutWho={layoutOn ? id : null}/>) : null;
  const followCard = (follow && onChat && (
            <div className="col-span-2 rounded-2xl border-2 border-pink-300 bg-slate-950/95 px-3 py-2" data-assistant-life-room-follow={follow.kind}>
              {/* 言葉の切れ目で折る(かぎかっこだけが1行に割れないよう、名前と台詞をひとつの文として折る・ミハリ 2026-11-08) */}
              <p className={`${land ? 'text-[11px]' : 'text-[12px]'} font-bold leading-snug text-pink-50`} style={JA_WRAP_STYLE}>{jaWrap(`${who.name}「${follow.text}」`)}</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <button type="button" className="mhl-btn bg-pink-500" data-assistant-life-room-follow-chat onClick={() => onChat(id, follow)}>💬 おしゃべりする</button>
                <button type="button" className="mhl-btn bg-slate-700" data-assistant-life-room-follow-bye onClick={() => onFollowDone && onFollowDone()}>またね</button>
              </div>
            </div>));
  // 新UI(2026-11-11 社長 STEP1・56-assistant-life-ux.jsx): 「その助手とできること」を1列に。縦も横も同じ並び。行ごとに押すと上がるもの
  const cardSpent = typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function' && onCard && !asleep && assistantLifeHouseCardIds().includes(id) ? assistantLifeCardSpent(id) : null;
  const canCardNow = typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function' && onCard && !asleep && assistantLifeHouseCardIds().includes(id);
  const furnOn = typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled() && !!onGiveFurn;
  const beatRow = typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function' && <AssistantLifeDoRow k="beat" icon="🎵" label={asleep ? '起こしてモンヒロビートに誘う' : atBeat ? 'モンヒロビートで会う' : 'モンヒロビートに誘う'} sub={atBeat && beatFree ? 'いまモンヒロビートにいるので、券なしで一緒に遊べる' : '一緒に演奏する(セッション券を使う)'} gain={atBeat && beatFree ? '券なし' : ''} on={() => onBeat(id)}/>;
  const cardRow = canCardNow && <AssistantLifeDoRow k={cardSpent ? 'card-spent' : 'card'} icon="🃏" label="MFバトルカードで対戦する" sub="カード部屋にいる助手と対戦すると、ごほうびアップ" gain={`ごほうび ${typeof CARD_LIFE_UP_LABEL !== 'undefined' ? CARD_LIFE_UP_LABEL : 'アップ'}`} on={() => onCard(id)} disabled={!!cardSpent} why={cardSpent ? (typeof cardLifeSpentText === 'function' ? cardLifeSpentText(cardSpent) : 'ごほうびアップは使い切りました') : ''}/>;
  // その場所ならではの得がある行(カード部屋での対戦・ビートで券なし)は、いちばん上に
  const hotBeat = !!(atBeat && beatFree && !asleep), hotCard = !!(canCardNow && !cardSpent);
  const doList = uiV2 && typeof AssistantLifeDoRow === 'function' ? (
    <div data-assistant-life-room-do-list>
      {typeof AssistantLifeBondRoad === 'function' && <AssistantLifeBondRoad id={id} points={typeof assistantLifeBondPointsOf === 'function' ? assistantLifeBondPointsOf(id) : null} level={lv} land={land}/>}
      <p className="mt-3 text-[12px] font-black text-amber-200">{who.name}とできること</p>
      {follow && onChat && followCard}
      {hotCard && cardRow}
      {hotBeat && beatRow}
      {onChat && !follow && <AssistantLifeDoRow k="chat" icon={asleep ? '💤' : '💬'} label={asleep ? '起こしておしゃべりする' : 'おしゃべりする'} sub="話すと仲良し度が少し上がる(1日の上限あり)" gain="💗 +" on={() => onChat(id, null)}/>}
      {soloOn && <AssistantLifeDoRow k="give-solo" icon="🎁" label={w && w.group ? `${who.name}だけに贈る` : `${who.name}に贈る`} sub="好きなものは 1.5倍・苦手なものは半分" gain="💗 +" on={() => onGiveSolo(id, w && w.group ? w.group.ids : [id])} disabled={!canGiveSolo} why="今日はもう贈れません"/>}
      {w && w.group && <AssistantLifeDoRow k="give" icon="🎁" label={soloOn ? `${w.group.ids.length}人に贈る` : '贈る'} sub="一緒にいる組に贈る" gain={<>🤝 友情Lv +<br/>💗 +</>} on={() => onGive(w.group)} disabled={!canGive} why="今日はもう贈れません"/>}
      {w && w.group
        ? <AssistantLifeDoRow k="watch" icon="👀" label={home ? '見守る' : '見守りに行く'} sub="組のおしゃべりを見る(同じ組は時間帯に1回)" gain={<>🤝 友情Lv +<br/>💗 +</>} on={() => onWatch(w.group)} disabled={!canWatch} why="この時間帯はもう見守りました"/>
        : <AssistantLifeDoRow k="peek" icon="👀" label="ようすを見る" sub="ひとりごとや、あなたへのひとこと(時間帯に1回)" on={() => onPeek(id)} disabled={!canWatch} why="この時間帯はもう見ました"/>}
      {(!w || !w.group || soloOn) && <AssistantLifeDoRow k="invite" icon="📣" label={asleep ? 'そっと声をかける' : '声をかける'} sub="さみしそうなときは、次の時間にだれかのところへ行く" on={() => onInvite(id)} disabled={!!(w && w.reason === 'distance')} why="いまは遠くにいて声が届きません"/>}
      {!hotBeat && beatRow}
      {!hotCard && cardRow}
      <AssistantLifeDoRow k="masmon" icon="🐾" label={`${who.name}のマスモン${rvTeam.length ? ` ${rvTeam.length}体` : ''}`} sub="育ち方・編成を見る" on={onMasmon ? () => onMasmon(id) : null} why="まだ見られません"/>
      {(() => { // 助手マスモン対戦β(ミセカタ2・マスモン部の口。RowInfo が null・口が無いときは出さない・2026-11-11 ナカヨシ13の引き継ぎ)
        let bi = null; try { bi = typeof assistantMasmonBattleRowInfo === 'function' ? assistantMasmonBattleRowInfo(id) : null; } catch (_) { bi = null; }
        if (!bi || !(typeof assistantMasmonBattleOpen === 'function')) return null;
        return <AssistantLifeDoRow k="masmon-battle" icon="⚔" label={bi.label || 'マスモンで対戦(β)'} sub={bi.sub || ''} gain={bi.gain || ''} on={() => { try { assistantMasmonBattleOpen({ assistantId: id, from: 'room' }); } catch (_) {} }} disabled={!!bi.disabled} why={bi.why || ''}/>;
      })()}
      {furnOn && <AssistantLifeDoRow k="furn" icon="🪑" label="部屋の家具" sub={`置いてある家具 ${rvFurn.length}個`} on={() => setFurnOpen(true)}/>}
      <p className="mt-3 text-[11px] font-black text-slate-300">くわしく</p>
    </div>) : null;
  return (
    <div className="absolute inset-0" style={{ zIndex: 25 }} data-assistant-life-room-sheet={id}>
      <button type="button" aria-label={returnToMap ? '地図へ戻る' : '家へ戻る'} data-assistant-life-roomview-close onClick={onClose} className="absolute z-[40] min-h-[44px] rounded-xl border border-pink-300/60 bg-slate-950/85 px-2.5 py-1.5 text-[12px] font-black text-pink-100 active:scale-95"
        style={{ left: 'calc(10px + env(safe-area-inset-left))', top: land ? 6 : 'calc(8px + env(safe-area-inset-top))' }}>{returnToMap ? '← 地図へ' : '← 家へ'}</button>
      {land ? (rvScene && <div className="absolute inset-y-0 left-0 bg-[#0b1020]" style={{ width: rvSheetW === '42%' ? '58%' : '50%' }}>{rvScene}</div>) : null}
      <div ref={scrollRef} className={land ? 'contents' : 'absolute inset-0 overflow-y-auto overflow-x-hidden bg-[#0b1020]'} data-assistant-life-roomview-scroll>
      {/* 縦の部屋の高さは幅に合わせる(画面いっぱいだと上が大きく空いた・2026-11-08 社長「画面変」)。すぐ下に中身が見え始める */}
      {!land && rvScene && <div style={{ height: uiV2 ? 'min(46vh, 112vw)' : 'min(calc(100% - 52px), max(470px, 132vw))' }}>{rvScene}</div>}
      <div ref={sheetRef} className="mhl-sheet" style={land ? { left: 'auto', width: rvSheetW, top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px', borderTop: 0, borderLeft: '2px solid #f9a8d4', paddingTop: 10 } : { position: 'relative', maxHeight: 'none', zIndex: 1 }}>
        {/* 新UIは部屋の絵の上に名前が出ているので、同じ題を2度出さない */}
        {!uiV2 && <p className="mhl-en">ROOM · {String(who.id).toUpperCase()}</p>}
        {!uiV2 && <p className="text-[21px] font-black">{who.name}の部屋</p>}
        <p className="mt-1 max-w-[62%] text-[12px] font-bold" style={{ wordBreak: 'auto-phrase', ...(land ? { maxWidth: 'none' } : {}) }} data-assistant-life-room-where>{where}{groupNames && <> ・ {w.group.ids.length}人(<AssistantLifeNames text={groupNames}/>)</>}</p>
        {!home && <p className="text-[11px] font-bold text-violet-200">⏱ {slotDef ? `${slotDef.to % 24}時まで` : ''}いる</p>}
        {(() => { const sh = assistantLifeRhythmShiftOn(((ASSISTANT_LIFE_STORE.state.rhythm || {})[id]), assistantLifeDayKey()); const rh = ASSISTANT_LIFE_RHYTHM[id]; return <p className="text-[10.5px] font-bold text-sky-200" data-assistant-life-room-rhythm={assistantLifeRhythmLabel(sh)}>🕰 生活のリズム: {rh ? rh.label : ''}{Math.abs(sh) >= 0.3 ? `(いまは ${assistantLifeRhythmLabel(sh)})` : ''}</p>; })()}
        {asleep ? <p className="text-[11px] font-bold text-indigo-200" data-assistant-life-room-asleep>💤 ぐっすり寝ている</p> : (w && w.reason === 'lonely') ? <p className="text-[11px] font-bold text-amber-200">💭 さみしそう(だれか来てほしい)</p> : mood ? <p className="text-[11px] font-bold text-pink-200">気分: {mood}</p> : null}
        {typeof AssistantLifeRelSheetRow === 'function' && <AssistantLifeRelSheetRow id={id} state={roomState} peerSt={peerSt} onMediate={onMediate}/>}
        {doList}
        <div className={uiV2 ? 'mt-1' : land ? 'mt-2' : 'mt-8'}>
          {lv != null && !uiV2 && <div className="mhl-row"><span className="k">💗 仲良し度</span><b>Lv{lv}</b></div>}
          <div className="mhl-row"><span className="k">🤝 友情Lv</span><span className="flex flex-wrap gap-x-3 text-[11px]">{friends.map(f => <span key={f.id}>{assistantLifeName(f.id)} <b className={f.lv >= 5 ? 'text-pink-300' : f.lv >= 3 ? 'text-amber-300' : ''}>Lv{f.lv}</b></span>)}</span></div>
          {typeof AssistantLifeGiftLikesRow === 'function' && <AssistantLifeGiftLikesRow id={id} compact={land}/>}
          {typeof AssistantMasmonRoomRow === 'function' && <AssistantMasmonRoomRow id={id} onOpen={onMasmon}/>}
          {/* 1人に贈ったチェキ(❸A)。その助手ひとりの1枚 */}
          {soloOn && typeof AssistantLifeChekiRow === 'function' && <AssistantLifeChekiRow pair={[id]}/>}
          {sess && <div className="mhl-row" data-assistant-life-room-session-row><span className="k">🎵 セッション</span><b>セッションLv{sess.level}</b><span className="ml-auto text-[10px] text-slate-300">一緒に {sess.lives}回</span></div>}
          <div className="py-1.5"><p className="text-[10.5px] font-black text-slate-300">今日あったこと</p>
            {items.length ? items.map((x, i) => <p key={i} className="text-[11px] font-bold text-slate-100"><b className="mr-1.5 text-amber-200">{x.t}</b><AssistantLifeChunks text={x.text}/></p>) : <p className="text-[11px] text-slate-400">まだありません</p>}
          </div>
        </div>
        {/* 横は狭いので、ボタンをシートの下に止めて、いつも全部見えるようにする(2026-11-08 窓口) */}
        <div className="mt-2 grid grid-cols-2 gap-1.5" data-assistant-life-room-acts style={land && !uiV2 ? { position: 'sticky', bottom: -10, zIndex: 6, background: '#0b1020', paddingTop: 6, paddingBottom: 6, marginBottom: -4, boxShadow: '0 -14px 12px #0b1020' } : undefined}>
          {/* 声をかけたあとの続き(2026-11-08 社長 ❼A・❾A)。ボタンの段のいちばん上(横はボタンの段が下に止まるので、段の外だと隠れる) */}
          {!uiV2 && followCard}
          {!uiV2 && (<>
          {w && w.group
            ? <button type="button" className="mhl-btn mhl-watch" data-assistant-life-room-act="watch" disabled={!canWatch} onClick={() => onWatch(w.group)}>{canWatch ? (home ? '👀 見守る' : '👀 見守りに行く') : (uiV2 ? '今日は見守り済み' : '見守りました')}</button>
            : <button type="button" className="mhl-btn mhl-watch" data-assistant-life-room-act="peek" disabled={!canWatch} onClick={() => onPeek(id)}>{canWatch ? '👀 ようすを見る' : (uiV2 ? '今日は確認済み' : '見た')}</button>}
          {/* 助手1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md ❺A): 一緒にいる助手にも声をかけられる。贈るは「2人に」と「◯◯だけに」に分ける */}
          {(!w || !w.group || soloOn) && <button type="button" className="mhl-btn mhl-call" data-assistant-life-room-act="invite" disabled={w && w.reason === 'distance'} onClick={() => onInvite(id)}>{asleep ? '💤 そっと声をかける' : '💬 声をかける'}</button>}
          {w && w.group && <button type="button" className="mhl-btn mhl-give" data-assistant-life-room-act="give" disabled={!canGive} onClick={() => onGive(w.group)}>{soloOn ? '🎁 2人に贈る' : '🎁 贈る'}</button>}
          {soloOn && <button type="button" className={`mhl-btn mhl-give ${w && w.group ? '' : 'col-span-2'}`} data-assistant-life-room-act="give-solo" disabled={!canGiveSolo} onClick={() => onGiveSolo(id, w && w.group ? w.group.ids : [id])}
            style={{ background: 'linear-gradient(90deg,#db2777,#be185d)' }}>{w && w.group ? `🎁 ${who.name}だけに贈る` : `🎁 ${who.name}に贈る`}</button>}
          {/* その助手とおしゃべり(社長 ❼A・寝ていれば起こして ❽B)。選んでいない助手とも話せる */}
          {/* 続きのカードが出ているあいだは、同じことをするボタンを2つ並べない(ミハリ 2026-11-08) */}
          {onChat && !follow && <button type="button" className="mhl-btn mhl-call col-span-2" data-assistant-life-room-act="chat" onClick={() => onChat(id, null)}>{asleep ? (uiV2 ? `💤 ${who.name}を起こしておしゃべり` : '💤 起こしておしゃべり') : (uiV2 ? `💬 ${who.name}とおしゃべりする` : '💬 おしゃべりする')}</button>}
          {typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function' && (
            <button type="button" className="mhl-btn mhl-beat col-span-2" data-assistant-life-room-act="beat" onClick={() => onBeat(id)}>{asleep ? '🎵 起こしてモンヒロビートに誘う' : atBeat && beatFree ? <>🎵 会いに行く<em className="ml-1 rounded-full bg-amber-300 px-1.5 text-[10px] not-italic text-amber-950" data-assistant-life-room-free>券なし</em></> : (uiV2 ? `🎵 ${who.name}とモンヒロビート` : '🎵 一緒にモンヒロビート')}</button>)}
          {/* 部屋の家具(段階B・2026-11-08 社長): 贈る・置く・しまう */}
          {typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled() && onGiveFurn && (
            <button type="button" className="mhl-btn col-span-2 bg-gradient-to-r from-amber-500 to-orange-600" data-assistant-life-room-act="furn" onClick={() => setFurnOpen(true)}>🪑 部屋の家具</button>)}
          {/* カード部屋にいる助手と対戦すると、ごほうび 1.5倍(2026-11-07 社長・カード部)。カード部屋にいるときだけ出す(寝ているときは出さない) */}
          {/*   この時間帯で使い切ったら、灰色の押せないボタンに(言い方はカード部の cardLifeSpentText。2026-11-08 社長 Q2 A) */}
          {typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function' && onCard && !asleep && assistantLifeHouseCardIds().includes(id) && (assistantLifeCardSpent(id)
            ? <button type="button" disabled className="mhl-btn col-span-2 cursor-not-allowed bg-slate-600 text-slate-200 opacity-80" data-assistant-life-room-act="card-spent">{typeof cardLifeSpentText === 'function' ? cardLifeSpentText(assistantLifeCardSpent(id)) : '🃏 ごほうびアップは使い切りました'}</button>
            : <button type="button" className="mhl-btn mhl-card col-span-2" data-assistant-life-room-act="card" onClick={() => onCard(id)}>🃏 カード部屋で対戦する <span className="mhl-card-up">ごほうびアップ</span></button>)}
          </>)}
          {/* はっきり分かる閉じるボタン(家具のシートと同じ形。2026-11-08 窓口)。横はボタンの段ごと下に止まるので、いつも見える */}
          <button type="button" data-assistant-life-room-close data-mhl-sheet-close onClick={onClose} className="col-span-2 min-h-[44px] w-full rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">閉じる</button>
        </div>
      </div>
      </div>
      {furnOpen && typeof AssistantLifeFurnSheet === 'function' && <AssistantLifeFurnSheet id={id} furnItems={furnItems || {}} onGiveFurn={onGiveFurn} land={land}
        onClose={() => setFurnOpen(false)} onTalk={(talk, text) => { setFurnOpen(false); if (onFurnTalk) onFurnTalk(talk, text); }} onLayout={layoutOn ? () => { setFurnOpen(false); setLayoutOpen(true); } : null}/>}
      {layoutOpen && layoutOn && typeof AssistantLifeRoomEditor === 'function' && <AssistantLifeRoomEditor id={id} land={land} onClose={() => setLayoutOpen(false)}
        room={{ look: typeof assistantLifeTimeLook === 'function' ? assistantLifeTimeLook() : 'noon', people, sleepIds, away, team: rvTeam }}/>}
    </div>);
}

// 場面の立ち絵(2026-11-08 社長「サイズバランスが悪いのはわざと？」: 絵ごとに余白と縦横の比がちがい、ききが小さく・きゅうこが大きく出ていた)。
//   絵の描かれている範囲(透明でない所)を一度だけ測り、見た目の高さ(頭の上〜絵の下)を場面の高さの fig にそろえる。
//   下は絵の下の端を、場面の下から 22%(横で低い画面は台詞の窓の上 150px)の床にそろえる(2026-11-08 ミハリ: 横で顔が台詞の窓の裏に隠れた)。左右は描かれている範囲の真ん中を cx にそろえる。衣装の絵でも同じ。測れないうちは今までの出し方
const ASSISTANT_LIFE_STAND_BOX = new Map();
const assistantLifeStandBox = (src) => new Promise((res) => {
  if (ASSISTANT_LIFE_STAND_BOX.has(src)) { res(ASSISTANT_LIFE_STAND_BOX.get(src)); return; }
  const im = new Image();
  im.onload = () => {
    // 測れないとき(iPhone で canvas が使えない・上限を超えて真っ白になるなど)も、絵の縦横の比だけは本物を使う。
    //   仮の比で細長く伸びて見えていた(2026-11-09 社長「画面バグってる」)
    const whole = im.naturalWidth && im.naturalHeight ? { t: 0, b: 1, l: 0, r: 1, ar: im.naturalWidth / im.naturalHeight } : null;
    let c = null;
    try {
      const W = 96, H = Math.max(1, Math.round(96 * im.naturalHeight / im.naturalWidth));
      c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      let t = H, b = -1, l = W, r = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
      const box = b < 0 ? whole : { t: t / H, b: (b + 1) / H, l: l / W, r: (r + 1) / W, ar: im.naturalWidth / im.naturalHeight };
      ASSISTANT_LIFE_STAND_BOX.set(src, box); res(box);
    } catch (_) { ASSISTANT_LIFE_STAND_BOX.set(src, whole); res(whole); }
    if (c) { c.width = 0; c.height = 0; } // iPhone は canvas のメモリの上限が厳しい。測り終えたらすぐ放す
  };
  im.onerror = () => { ASSISTANT_LIFE_STAND_BOX.set(src, null); res(null); };
  im.src = src;
});
// ===== 立ち絵の大きさと切る位置(共通の表と関数・2026-11-08 社長「この仕組みは他の立ち絵にも使えそうだね」) =====
// ほかの画面(部屋を大きく見る画面・HOME・モンヒロビートなど)からも、名前で読んで使える。使い方は docs/progress/assistant-peer/gifts/stagec/STAND-MEASURE.md の「共通の表と関数」
//   ASSISTANT_LIFE_STAND_FACE(手で置いた顔の点と m・fit)/ASSISTANT_LIFE_STAND_EC/ASSISTANT_LIFE_STAND_FACE_LEN/ASSISTANT_LIFE_STAND_CUT
//   assistantLifeStandFace(pid, src) … その絵の顔の点(表に無い絵はふつうの形)
//   assistantLifeStandRule({ face, box, F, topY, cx }) … 1人ぶんの置き場所(px)。box は assistantLifeStandBox(src) の見えている体の範囲
// 立ち絵の見た目の大きさをそろえる(2026-11-08 社長「立ち絵サイズのバランスや配置の仕方があんまりよくない」「実際の見た目ではかって」)
//   8人の絵は全身ではなく上半身で、どこで切れているかが絵ごとに違う。透けていない画素の範囲(見えている体)の中で、目と顎の高さを測った表
//   (docs/progress/assistant-peer/gifts/stagec/STAND-MEASURE.md)。「目から顎まで」を全員同じ長さにして、頭の大きさをそろえる
//   eye・chin … 見えている体の上を0・下を1とした目・顎の高さ / head … 顔だけの絵(ドラ)。頭ひとつぶんの大きさで床に置く
const ASSISTANT_LIFE_STAND_FACE = Object.freeze({
  mua: { top: 0.145, eye: 0.3275, chin: 0.425, m: 0.724 }, kiki: { top: 0.195, eye: 0.46, chin: 0.595, m: 0.847 }, momosuke: { top: 0.075, eye: 0.3925, chin: 0.535, m: 1.022 },
  dra: { head: true, top: 0.10, eye: 0.46, m: 2.017 }, atsu: { top: 0.09, eye: 0.31, chin: 0.435, m: 0.895 }, kyuko: { top: 0.01, eye: 0.40, chin: 0.56, m: 1.040, fit: 0.95 },
  sorashido: { top: 0.015, eye: 0.345, chin: 0.55, m: 1.248 }, erubin: { top: 0.01, eye: 0.2325, chin: 0.46, m: 1.224 },
});
//   2026-11-08 社長「顔のサイズがまだあってない」「ちゃんとはかってるの？」: 絵を見て手で点を置き直した(測り絵 gifts/stagec/marks.png・STAND-MEASURE.md の4回目)
//   top … 頭のてっぺん(髪の上端。うさ耳・リボン・羽・王冠などの飾りは含めない)/eye … 目の線(目を閉じた絵はまぶたの線)/chin … 顎の先(見えている体の上を0・下を1)
//   m … 顔の大きさ。「目の線から顎の先」と「頬の幅」を、それぞれ7人の平均で割って2つを平均したもの。見えている体の高さは m に反比例させる(顔がそろう)
//   ドラは顔だけの絵なので、7人の頭の高さ(てっぺんから顎)の平均とドラの頭の高さがそろう m
//   fit … 測ったうえで、並び絵を見た社長の指示で少しだけ変えた大きさ(きゅうこ ×0.95「きゅうこが少しでかいね」)。無ければ 1
// 目から顎の長さの平均(見えている体の高さに対する割合)。m=1 の人の「目から顎」が F になる
const ASSISTANT_LIFE_STAND_EC = 0.1639;
// 顔1個の長さ(頭のてっぺんから顎まで。7人の平均)を、目から顎の何倍か。2026-11-08 社長「顔のサイズを基準に縮尺合わせて上下で切る位置決めればそれなりに合う」:
//   全員を、頭のてっぺんの上は顔0.55個ぶん(うさ耳・リボンが切れない所)・下はてっぺんから顔1.8個ぶん(顎から約0.8個。上半身の絵がいちばん短いソラシドでも絵が届く所)で切り、
//   同じ高さの枠に入れる(下の 顔0.45個ぶんで消していく)
const ASSISTANT_LIFE_STAND_FACE_LEN = 2.63;
const ASSISTANT_LIFE_STAND_CUT = Object.freeze({ above: 0.55, below: 1.8, fade: 0.45 });
// 着替えの絵の顔の点(2026-11-11 社長「助手の立ち絵も見直して、使う場面全部でうまく表示させるようにして」)。
//   それまで着替えの絵にも ふだんの服の点を当てていて、帽子や羽のぶん顔が小さく・ずれて出ていた(相手と顔の大きさが 1.4倍ちがった)。
//   キーは絵の置き場所の名前(助手の絵のフォルダの中の、服ごとのフォルダ名)。測り方は上の表と同じ(見えている体の上を0・下を1。top は帽子・耳・頭布の飾りを除いた頭のてっぺん)。
//   above … 頭のてっぺんの上を、顔の何個ぶんまで見せるか(魔女の帽子・大きなうさ耳が切れないように。無ければ ASSISTANT_LIFE_STAND_CUT.above)
//   m は、同じ助手の ふだんの服の m に「目から顎」の長さの比を掛けたもの(同じ顔なので、頬の幅も同じ比で変わる)。測り絵: docs/progress/assistant-art/
const ASSISTANT_LIFE_STAND_FACE_OUTFIT = Object.freeze({
  halloween: { mua: { top: 0.2, eye: 0.358, chin: 0.433, m: 0.557, above: 0.85 }, kiki: { top: 0.217, eye: 0.412, chin: 0.498, m: 0.54, above: 0.95 }, momosuke: { top: 0.065, eye: 0.39, chin: 0.508, m: 0.846 } },
  'card-master': { mua: { top: 0.09, eye: 0.22, chin: 0.295, m: 0.55 } },
  sekiyuou: { erubin: { top: 0.02, eye: 0.225, chin: 0.47, m: 1.25 } },
});
// 絵の置き場所から、着替えの名前を引く(ふだんの服は null)
const assistantLifeStandOutfitOf = (src) => { const m = /\/assistant\/([a-z0-9-]+)\/[a-z]+_[a-z]+\.png/i.exec(String(src || '')); return m && m[1] !== 'face' && m[1] !== 'temp' ? m[1] : null; };
// 着替えなど表に無い絵は、8人のふつうの形で見る
const assistantLifeStandFace = (pid, src) => {
  const who = typeof assistantById === 'function' ? assistantById(pid) : null;
  const own = who && who.imagePrefix && String(src || '').includes(`/${who.imagePrefix}_`);
  const outfit = own ? assistantLifeStandOutfitOf(src) : null;
  if (outfit) return (ASSISTANT_LIFE_STAND_FACE_OUTFIT[outfit] && ASSISTANT_LIFE_STAND_FACE_OUTFIT[outfit][pid]) || { top: 0.05, eye: 0.33, chin: 0.47, m: 1 };
  return (own && ASSISTANT_LIFE_STAND_FACE[pid]) || { top: 0.05, eye: 0.33, chin: 0.47, m: 1 };
};
// 見えている体の高さ(px)。F … m=1 の人の「目から顎」の長さ(px)。顔の大きさがそろう
const assistantLifeStandVisH = (face, F) => (F / (ASSISTANT_LIFE_STAND_EC * ((face && face.m) || 1))) * ((face && face.fit) || 1);
// 1人ぶんの置き場所(px)。topY … 頭のてっぺんをそろえる高さ/cx … 体の真ん中の横の位置
//   返す値: top・height・width・left(絵の箱)/clip [上, 下](clip-path の inset に使う)/fade [始, 終](絵の高さに対する割合。mask の linear-gradient に使う。顔だけの絵は null)
//   frameTop・frameBottom(上下で切る枠)/visTop・visBottom(見えている体)/U(顔1個の長さ)
const assistantLifeStandRule = ({ face, box, F, topY, cx = 0 }) => {
  if (!face || !box || !(F > 0)) return null;
  const vh = assistantLifeStandVisH(face, F), ih = vh / (box.b - box.t), iw = ih * box.ar;
  const visTop = topY - (face.top || 0) * vh, imgTop = visTop - box.t * ih;
  const U = F * ASSISTANT_LIFE_STAND_FACE_LEN;
  const frameTop = topY - (face.above || ASSISTANT_LIFE_STAND_CUT.above) * U, frameBottom = topY + ASSISTANT_LIFE_STAND_CUT.below * U;
  const clip = [Math.max(0, frameTop - imgTop), Math.max(0, imgTop + ih - frameBottom)];
  const fade = face.head ? null : [Math.max(0, (frameBottom - ASSISTANT_LIFE_STAND_CUT.fade * U - imgTop) / ih), Math.min(1, (frameBottom - imgTop) / ih)];
  return { top: imgTop, height: ih, width: iw, left: cx - ((box.l + box.r) / 2) * iw, clip, fade, frameTop, frameBottom, visTop, visBottom: visTop + vh, U };
};
// 場面の大きさ(W×H px)と、並ぶ人の絵の見えている範囲から、1人ずつの置き場所を決める(px)
//   ・目から顎までの長さ F を全員同じに。F は人数で決める高さの割合と、1人の見えている幅が受け持ちの幅を大きく超えない長さの小さいほう
//   ・頭のてっぺんの高さをそろえ、目が縦は場面の上から4割あたり・横は3割5分あたりに来るように置く(2026-11-08 社長「画面の下に小さく固まり、上半分が空いている」)
//   ・体の下のほうは、なめらかに消す(上半身で切れている絵の切れ目が宙に浮いて見えない)
const assistantLifeStandLayout = (items, W, H) => {
  const n = items.length;
  if (!n || !W || !H || items.some(x => !x.box)) return null;
  const sw = (W * 0.92) / n;
  const fh = H * ({ 1: 0.085, 2: 0.075, 3: 0.064, 4: 0.055 }[Math.min(4, n)]);
  const visH = (x, F) => assistantLifeStandVisH(x.face, F);
  const visW = (x, F) => visH(x, F) * (x.box.r - x.box.l) * x.box.ar / (x.box.b - x.box.t);
  let F = fh;
  for (const x of items) { const w1 = visW(x, 1); if (w1 > 0) F = Math.min(F, (sw * 1.08) / w1); }
  // 頭のてっぺんの高さ: 目の高さの平均が、縦は場面の上から4割・横は3割5分に来るところ
  const eyeOff = items.reduce((a, x) => a + ((x.face.eye || 0.4) - (x.face.top || 0)) * visH(x, F), 0) / n;
  const topY = H * (W > H ? 0.36 : 0.42) - eyeOff;
  return items.map((x, i) => {
    const cx = W * 0.04 + sw * (i + 0.5);
    return { ...assistantLifeStandRule({ face: x.face, box: x.box, F, topY, cx }), cx, face: F };
  });
};
function AssistantLifeStands({ ids, sleepIds = [] }) {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const srcs = ids.map(pid => { const who = assistantById(pid); return who ? assistantFullImage(who, sleepIds.includes(pid) ? 'normal' : 'happy') : null; });
  const [boxes, setBoxes] = React.useState(() => srcs.map(s => (s ? ASSISTANT_LIFE_STAND_BOX.get(s) || null : null)));
  const key = srcs.join('|');
  React.useEffect(() => { let alive = true; Promise.all(srcs.map(s => (s ? assistantLifeStandBox(s) : Promise.resolve(null)))).then(b => { if (alive) setBoxes(b); }); return () => { alive = false; }; }, [key]);
  React.useLayoutEffect(() => {
    const el = ref.current && ref.current.parentElement;
    if (!el) return undefined;
    const f = () => setSize(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    f();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(f) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', f);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', f); };
  }, []);
  const items = ids.map((pid, i) => ({ pid, src: srcs[i], box: boxes[i], face: assistantLifeStandFace(pid, srcs[i]) })).filter(x => x.src);
  const lay = assistantLifeStandLayout(items, size.w, size.h);
  return (<><span ref={ref} hidden/>{items.map((x, i) => {
    const zz = sleepIds.includes(x.pid);
    const filter = zz ? 'brightness(.45) saturate(.6) drop-shadow(0 6px 12px #0008)' : undefined;
    const p = lay && lay[i];
    return (<React.Fragment key={x.pid}>
      <img className="st" data-assistant-life-scene-stand={x.pid} data-assistant-life-scene-sleep={zz ? '1' : '0'} src={x.src} alt=""
        data-assistant-life-scene-face={p ? Math.round(p.face) : ''} data-assistant-life-scene-vis={p ? `${Math.round(p.visTop)},${Math.round(p.visBottom)}` : ''}
        style={p ? { left: p.left, top: p.top, height: p.height, width: p.width, maxWidth: 'none', bottom: 'auto', objectFit: 'fill', filter,
          clipPath: `inset(${p.clip[0].toFixed(1)}px 0 ${p.clip[1].toFixed(1)}px 0)`,
          ...(p.fade ? { WebkitMaskImage: `linear-gradient(to bottom,#000 ${(p.fade[0] * 100).toFixed(1)}%,transparent ${(p.fade[1] * 100).toFixed(1)}%)`, maskImage: `linear-gradient(to bottom,#000 ${(p.fade[0] * 100).toFixed(1)}%,transparent ${(p.fade[1] * 100).toFixed(1)}%)` } : {}) } : { opacity: 0, height: '50%', filter }}/>
      {zz && p && typeof AssistantLifeSleepEyes === 'function' && <AssistantLifeSleepEyes pid={x.pid} src={x.src} w={p.width} h={p.height} style={{ left: p.left, top: p.top, filter, zIndex: 1 }}/>}
      {zz && p && <span className="absolute text-[34px]" style={{ left: p.cx + 20, top: Math.max(40, p.visTop) }} aria-hidden="true">💤</span>}
    </React.Fragment>); })}</>);
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
      <AssistantLifeStands ids={ids} sleepIds={scene.sleep || []}/>
      <div className="mhl-hdr absolute inset-x-0 top-0" style={{ paddingTop: 'calc(8px + env(safe-area-inset-top))' }}>
        <div className="flex items-start gap-2">
          <button type="button" data-assistant-life-scene-back onClick={() => { if (peer && peer.talking && typeof ASSISTANT_PEER_STORE !== 'undefined') ASSISTANT_PEER_STORE.set({ stopTalkAt: Date.now() }); onClose(); }} aria-label="家へ戻る" className="h-9 w-9 text-[18px] text-slate-100">←</button>
          <div className="min-w-0 flex-1"><p className="mhl-en">{scene.place && scene.place !== 'home' ? String(scene.place).toUpperCase() : 'ROOM'}</p>{/* アイコンは字の塗り(背景を字の形で切り抜く)の外に置く。中に入れると絵文字まで切り抜かれ、iPhone で白い四角になった(2026-11-08 社長) */}<p className="flex items-center gap-1.5" data-assistant-life-scene-title><span aria-hidden="true" data-assistant-life-scene-icon className="text-[19px] leading-none">{ASSISTANT_LIFE_PLACE_ICON[scene.place] || '🏡'}</span><span className="mhl-ti" style={{ fontSize: 19 }}>{placeName}</span></p></div>
        </div>
        {ids.length >= 3 && <p data-assistant-life-scene-group className="mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'linear-gradient(90deg,#0ea5e9,#a855f7)' }}>👥 {ids.length}人で ・ <AssistantLifeNames text={assistantLifeGroupNames(ids, 8)}/></p>}
        {hint && ids.length === 2 && <p className="mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: 'linear-gradient(90deg,#db2777,#a855f7)' }}>🤝 {ids.slice(0, 2).map(assistantLifeName).join('・')} 友情Lv{hint.lv}{stage ? ` ${assistantPeerStageName(stage)}` : ''}</p>}
      </div>
      {done && (
        <div className="absolute inset-x-3 flex gap-1.5" style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }} data-assistant-life-scene-done>
          {ids.length >= 2 && <button type="button" className="mhl-btn mhl-give flex-1" disabled={!canGive} onClick={() => onGive(ids)}>🎁 贈る</button>}
          <button type="button" className="mhl-btn flex-1 bg-slate-700" onClick={onClose}>🏡 家へ戻る</button>
        </div>)}
    </div>);
}

// ---------- 専用ページ ----------
// 見えている画面の幅・高さ。🔄横(モンヒロビートの「横」で、端末は縦のまま器を回す)のときは、回した器の幅・高さ
//   (window の幅・高さは端末の縦のままなので、それで決めると縦の形のまま器の真ん中に縮んだ。2026-11-08 ジン)
const assistantLifeViewSize = () => {
  if (typeof window === 'undefined') return { w: 390, h: 844, rot: false };
  const rot = typeof RHYTHM_VIEW_ROTATION === 'object' && !!RHYTHM_VIEW_ROTATION && typeof RHYTHM_VIEW_ROTATION.active === 'function' && RHYTHM_VIEW_ROTATION.active();
  return rot ? { w: window.innerHeight, h: window.innerWidth, rot: true } : { w: window.innerWidth, h: window.innerHeight, rot: false };
};
// 大きさが変わったら描き直す。resize・orientationchange と 🔄横の切り替えの知らせで測り、iPhone が回転のあと大きさを
// 遅れて直す分は 0.1・0.3・0.8秒あとにも測り直す(2026-11-11 カルク: もとは 0.5秒ごとにずっと見ていた。🔄横の切り替えも resize を鳴らす)
const useAssistantLifeViewSize = () => {
  const [size, setSize] = React.useState(assistantLifeViewSize);
  React.useEffect(() => {
    const f = () => setSize(prev => { const n = assistantLifeViewSize(); return (n.w === prev.w && n.h === prev.h && n.rot === prev.rot) ? prev : n; });
    let ts = [];
    const g = () => { f(); ts.forEach(clearTimeout); ts = [100, 300, 800].map(ms => setTimeout(f, ms)); };
    window.addEventListener('resize', g); window.addEventListener('orientationchange', g);
    const off = typeof RHYTHM_VIEW_ROTATION === 'object' && RHYTHM_VIEW_ROTATION && typeof RHYTHM_VIEW_ROTATION.subscribe === 'function' ? RHYTHM_VIEW_ROTATION.subscribe(g) : null;
    f();
    return () => { window.removeEventListener('resize', g); window.removeEventListener('orientationchange', g); if (off) off(); ts.forEach(clearTimeout); };
  }, []);
  return size;
};
const useAssistantLifeLand = () => { const v = useAssistantLifeViewSize(); return v.w > v.h && v.h < 600; };
// 裏クイックの札(2026-11-08 社長「助手ライフ画面でも裏クイックほしい」)。中身はバトル部(ジン)が 60-app から渡す:
//   quickRun … null(一度も回していない)か { live, loops, stopped, difficulty, xp, gold, canStart }/onQuickRunStop()/onQuickRunStart()
//   回っているときは「⚡ 裏クイック ◯周目」と「止める」、止まっていて始められるときは「▶ 裏クイック」。数え方はカードの札と同じ(loops をそのまま)
function AssistantLifeQuickChip({ quickRun, onStop, onStart, land }) {
  if (!quickRun || typeof quickRun !== 'object') return null;
  // 「◯周目」は loops をそのまま(1周目から 1。MFバトルカードの札 84-screen-card-battle と同じ数え方)
  const loops = Number.isFinite(Number(quickRun.loops)) ? Math.max(1, Math.floor(Number(quickRun.loops))) : 1;
  // 印はバトル部(セコンド)の検査とそろえる: 外枠 data-assistant-life-quick-run=live|stopped/始める data-assistant-life-quick-start/止める data-assistant-life-quick-stop
  if (quickRun.live) {
    return (
      <div className="mhl-quick shrink-0 self-center" data-assistant-life-quick="live" data-assistant-life-quick-run="live" data-assistant-life-quick-loop={loops}>
        <span className="whitespace-nowrap">⚡ 裏クイック <b>{loops}周目</b></span>
        {onStop && <button type="button" data-assistant-life-quick-stop onClick={onStop} aria-label="裏クイックを止める">止める</button>}
      </div>);
  }
  // 止めたあと・自動で始めるが切・負けて始め直すまでのあいだだけ「▶ 裏クイック」(助手ライフを開くとふだんは自動で始まる。2026-11-08 社長)
  if (quickRun.canStart && onStart) {
    return (
      <div className="shrink-0 self-center" data-assistant-life-quick="start" data-assistant-life-quick-run="stopped">
        <button type="button" className="mhl-quick is-start" data-assistant-life-quick-start onClick={onStart} aria-label="裏クイックを始める"><span className="whitespace-nowrap">▶ 裏クイック</span></button>
      </div>);
  }
  return null;
}
function AssistantLifeHouse({ metIds, onReplay, peerItems = null, onUseItem = null, bondLevelOf = null, furnItems = null, onGiveFurn = null, onGiveSolo = null, quickRun = null, onQuickRunStop = null, onQuickRunStart = null, quickRunStrip = null }) {
  const st = useAssistantLifeNow(metIds);
  const diary = useAssistantLifeDiary();
  const peerSt = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
  const land = useAssistantLifeLand();
  // フレンドの家との行き来(部屋の札・5つ目のアイコン)が変わったら描き直す(56-assistant-life-friend.jsx。部品はいつもある)
  if (typeof useAssistantLifeFriendState === 'function') useAssistantLifeFriendState();
  const [tab, setTab] = React.useState('house');
  // 新UIが既定(2026-11-11)。保存 mh_assistant_life_ui_v2 が false の人だけ前の画面。保存は消さない・ここでは書かない
  const [uiV2, setUiV2] = React.useState(() => assistantLifeUiV2Of(assistantLifeUiV2Last));
  const [giftItemsOpen, setGiftItemsOpen] = React.useState(false); // 贈るシートの中の「道具の一覧」を開いているか(ふだんは畳む)
  const [giftOpen, setGiftOpen] = React.useState(false); // 新UI: 「🎁 贈る」のシート(だれに贈るか+持っている道具)
  const [callPicker, setCallPicker] = React.useState(false);
  const [lifeStatusExpanded, setLifeStatusExpanded] = React.useState(false);
  // 初めて開いた人への1枚(56-assistant-life-guide.jsx)。「見た」の印は新しいキー1つ。読めるまで(null)は出さない
  const [guideSeen, setGuideSeen] = React.useState(null);
  const [guideOpen, setGuideOpen] = React.useState(false);
  React.useEffect(() => { let alive = true; Promise.resolve(storeGet(ASSISTANT_LIFE_GUIDE_KEY, false, false)).then(v => { if (alive) setGuideSeen(v === true); }).catch(() => { if (alive) setGuideSeen(true); }); return () => { alive = false; }; }, []);
  const markGuideSeen = () => { setGuideSeen(true); setGuideOpen(false); try { void storeSet(ASSISTANT_LIFE_GUIDE_KEY, true, false); } catch {} };
  const [mapFocusPlace, setMapFocusPlace] = React.useState(null);
  const [mapFocusAssistantId, setMapFocusAssistantId] = React.useState(null);
  React.useEffect(() => { let alive = true; Promise.resolve(storeGet('mh_assistant_life_ui_v2', null, false)).then(v => { assistantLifeUiV2Last = v === true || v === false ? v : null; if (alive) setUiV2(assistantLifeUiV2Of(v)); }).catch(() => {}); return () => { alive = false; }; }, [!!(st.open && st.loaded)]); // 開くたびに読み直す(設定の「助手ライフの画面」で切り替えた分)
  const [roomId, setRoomId] = React.useState(st.focus || null);
  // 町の人(助手になる前の助手・56-assistant-life-partner.jsx)の部屋は開かず、小窓に替える。どこから開こうとしても(地図・家・札・道のり)ここで止める
  React.useEffect(() => { if (roomId && typeof assistantLifeTownPersonGuard === 'function' && assistantLifeTownPersonGuard(roomId)) setRoomId(null); }, [roomId]);
  // フレンドに見せる「いまの状態」に、家の中のどこにいるかを知らせる(34-friends-api・2026-11-08 案A)。閉じたら消す
  React.useEffect(() => {
    if (typeof friendsSetLifeSpot !== 'function') return;
    if (uiV2 && tab === 'items') return; // 新UIに道具のタブは無い(すぐ家+贈るシートへ戻す)。一瞬の「道具」は知らせない
    friendsSetLifeSpot(({ house: 'h', where: 'w', friends: 'f', items: 'i', visit: 'p' })[tab] || 'h', tab === 'house' && roomId ? String(roomId) : '');
  }, [tab, roomId, uiV2]);
  React.useEffect(() => () => { if (typeof friendsSetLifeSpot === 'function') friendsSetLifeSpot(''); }, []);
  const [scene, setScene] = React.useState(null);
  // 声をかけたあとの続きのカード(2026-11-08 社長 ❼A)。掛け合いが閉じたら、同じ部屋のシートを開き直して出す
  const [follow, setFollow] = React.useState(null);
  const followAfterRef = React.useRef(null);
  const [note, setNote] = React.useState('');
  const [give, setGive] = React.useState(null);
  const [masmonId, setMasmonId] = React.useState(null); // 🐾 助手のマスモン(56-assistant-life-masmon.jsx)
  const [intro, setIntro] = React.useState(null); // 'long' | 'short' | null
  const [boardOpen, setBoardOpen] = React.useState(false); // 今日あったことを全部
  const vw = useAssistantLifeViewSize().w; // 🔄横では回した器の幅
  // 入場: その日の最初は長く(1.2秒)、2回目からは短く(0.4秒)
  //   この部品はゲームの起動時から置かれていて、閉じているあいだは何も描かない。開くたびに決める(起動時に1回だけ決めていたので、
  //   開いたときには演出が終わっていて出なかった・2026-11-08 オクリモノ3が見つけた assistant-life-browser-check ⑩)
  const openNow = !!(st.open && st.loaded);
  React.useEffect(() => {
    if (!openNow) { setIntro(null); return undefined; }
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
  }, [openNow]);
  React.useEffect(() => { if (typeof assistantLifeRelTick === 'function') { try { void assistantLifeRelTick(); } catch {} } if (typeof ASSISTANT_LIFE_REL_STORE !== 'undefined') void ASSISTANT_LIFE_REL_STORE.load().then(() => { try { ASSISTANT_LIFE_STORE.emit(); } catch {} }); }, []); // 前の日からのけんかは朝4時までに仲直り(rel.jsx)
  React.useEffect(() => { if (roomId) setNote(''); }, [roomId]); // 別の部屋を開いたら前の一言を消す(ミハリ L13)
  React.useEffect(() => { if (st.focus) { setRoomId(st.focus); ASSISTANT_LIFE_STORE.set({ focus: null }); } }, [st.focus]);
  // 交換所から戻ったとき: 道具タブ(家具ならその助手の部屋と家具のシート)を開く(56-assistant-life-gifts.jsx の assistantLifeOpenShop)
  const [furnBack, setFurnBack] = React.useState(null);
  React.useEffect(() => { const b = ASSISTANT_LIFE_STORE.state.shopBack; if (!b) return; ASSISTANT_LIFE_STORE.set({ shopBack: null });
    setTab(b.tab || 'items'); if (b.room) { setRoomId(b.room); if (b.furn) setFurnBack(b.room); } }, []);
  // 新UIには道具のタブが無い。道具タブを開こうとしたら、家に戻して「🎁 贈る」のシートを開く(交換所から戻ったときなど)
  React.useEffect(() => { if (uiV2 && tab === 'items') { setTab('house'); if (!roomId) { setGiftItemsOpen(true); setGiftOpen(true); } } }, [uiV2, tab]);
  if (!assistantLifeEnabled() || !st.loaded || !st.open) return null;
  const life = st.life || {};
  const ids = (metIds || []).filter(id => ASSISTANT_LIFE_PREFS[id]);
  const metSet = new Set(ids);
  // 関われる助手か(旧UIでも同じ。今遊んでいる人は全員 true。町の人は、声をかける・贈る・引き合わせる・道のりの一覧から外す。見守る・掛け合いはそのまま)
  const partnerOk = (pid) => typeof assistantLifePartnerOk !== 'function' || assistantLifePartnerOk(pid);
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
  // 新UIだけ: サブ画面では家へ戻り、家では従来どおり助手ライフを閉じる。
  const backFromUiV2 = () => { if (uiV2 && tab !== 'house') { setRoomId(null); setCallPicker(false); setTab('house'); return; } close(); };
  // 掛け合いを、家を閉じずに場面で流す
  const showFollow = () => {
    const id = followAfterRef.current; followAfterRef.current = null;
    if (!id || typeof ASSISTANT_LIFE_LINKS.chatFollowLine !== 'function') return;
    let f = null; try { f = ASSISTANT_LIFE_LINKS.chatFollowLine(id); } catch { f = null; }
    if (!f || !f.text) return;
    setRoomId(id); setFollow({ ...f, id });
  };
  const playTalk = (talk, ctx) => {
    if (!talk) return;
    // 場面の立ち絵は、実際に話す助手と必ずそろえる(組の人+台本で話す人。いない助手が話す台本を流しても、その助手の絵が出る)
    const speakers = [...new Set((talk.lines || []).map(l => l && l.who).filter(Boolean))];
    const sceneIds = [...new Set([...((ctx && ctx.ids) || []), ...speakers])];
    const sleepIds = ctx && ctx.sleep ? (ctx.ids || []) : [];
    setRoomId(null); setNote(''); // 前の一言を残さない(ミハリ L13)
    setScene({ ids: sceneIds, place: (ctx && ctx.place) || 'home', key: `${talk.id}-${Date.now()}`, sleep: sleepIds });
    if (onReplay) onReplay(talk);
    // 道具を贈った掛け合いは「贈った」だけを残す(見守ったとは書かない・2026-11-08 ミハリ)
    if (sceneIds.length >= 2 && !(ctx && ctx.gift)) void assistantLifeDiaryAdd(`${sceneIds.map(nameOf).join('・')}の様子を見守った`, sceneIds, { kind: 'watch' });
  };
  const watch = async (g) => { const talk = await assistantLifeWatch(g); if (!talk) { setNote('この組の掛け合いは、いまは見られません'); return; } playTalk(talk, { ids: g.ids, place: g.place }); };
  const peek = (id) => {
    const key = `solo:${id}`;
    if ((life.watched || []).includes(key)) return;
    const w = assistantLifeWhereOf(life, id);
    const sleeping = !!(w && w.doing === 'sleep');
    // 寝ているときは寝言(起こさない)。起きているときは、その助手だけが話す台本(距離をおく行も、いない相手の行は外す)
    const relSolo = !sleeping && typeof assistantLifeRelSoloTalk === 'function' ? assistantLifeRelSoloTalk(id, rooms[id]) : null; // やきもち中なら、その気持ちの一言(rel.jsx)
    const talk = sleeping ? assistantLifePickSleepTalk(id, { wake: false, place: w.place }) : (relSolo || assistantLifeOnlyPresent(assistantLifePickSoloTalk(id, life), [id]));
    if (!talk) { setNote(`${nameOf(id)}は、いまは静かに過ごしています`); return; }
    ASSISTANT_LIFE_STORE.set({ life: { ...life, watched: [...(life.watched || []), key] } });
    assistantLifeSaveLife(); if (!sleeping) assistantLifeMarkSeen(talk);
    playTalk(talk, { ids: [id], place: w ? w.place : 'home', sleep: sleeping });
  };
  const invite = async (id) => {
    // その助手が {name} に話す台本だけ(ほかの助手が出る台本は使わない・2026-11-07 社長の指摘)。寝ていれば寝言か起こされた反応
    const w = assistantLifeWhereOf(life, id);
    const sleeping = !!(w && w.doing === 'sleep');
    const relSolo = !sleeping && typeof assistantLifeRelSoloTalk === 'function' ? assistantLifeRelSoloTalk(id, rooms[id]) : null; // やきもち中なら、その気持ちの一言(rel.jsx)
    const talk = sleeping ? assistantLifePickSleepTalk(id, { wake: true, bondLv: typeof bondLevelOf === 'function' ? bondLevelOf(id) : 1, place: w.place }) : (relSolo || assistantLifePickCallTalk(id, life));
    if (!(await assistantLifeNudge('invite', id))) return;
    // 掛け合いが閉じたら、この部屋に戻って続きのカードを出す(起きている助手だけ・おしゃべりの口があるときだけ)
    followAfterRef.current = (!sleeping && typeof ASSISTANT_LIFE_LINKS.chatFollowLine === 'function') ? id : null;
    if (talk) { if (!sleeping) assistantLifeMarkSeen(talk); playTalk(talk, { ids: [id], place: w ? w.place : 'home', sleep: sleeping }); }
    else if (followAfterRef.current) showFollow();
    setNote(sleeping ? `${nameOf(id)}は寝ています。次の時間に、起きてだれかのところへ行きます` : `${nameOf(id)}に声をかけました。次の時間に、だれかのところへ行きます`);
  };
  // {name}が取り持つ(けんか中の2人を、その場で仲直りさせる。56-assistant-life-rel.jsx)
  const mediate = async (id) => {
    const talk = typeof assistantLifeRelMediate === 'function' ? await assistantLifeRelMediate(id) : null;
    if (!talk) { setNote('いまは取り持てません'); return; }
    const g = (life.groups || []).find(x => talk.pair.every(p => x.ids.includes(p)));
    playTalk(talk, { ids: talk.pair, place: g ? g.place : 'home' });
  };
  // 贈る(2人に贈る道具10種類・2026-11-08)。確かめは 56-assistant-life-gifts.jsx の AssistantLifeGiftSheet
  const canGive = !!(peerItems && onUseItem);
  const itemInfos = assistantLifeItemInfos();
  const haveOf = (kind) => (peerItems && Number(peerItems[kind])) || 0;
  const usedOf = (kind) => !!(typeof assistantLifeGiftReason === 'function' && assistantLifeGiftReason(kind, peerSt, 1));
  // 1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md)。印 assistantLifeSolo の後ろ
  const soloOn = typeof assistantLifeSoloOn === 'function' && assistantLifeSoloOn() && !!onGiveSolo;
  const soloLeft = soloOn ? assistantLifeSoloLeft() : 0;
  const openGiveSolo = (who, ids, pickKind = null) => {
    if (!soloOn || !who) return;
    const usable = assistantLifeSoloKinds().filter(g => haveOf(g.kind) > 0 && !assistantLifeSoloReason(g.kind, peerSt, haveOf(g.kind)));
    const kind = pickKind || (usable[0] || assistantLifeSoloKinds()[0] || {}).kind;
    const list = Array.isArray(ids) && ids.length ? ids : [who];
    const ps = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) ps.push([list[i], list[j]]);
    setRoomId(null); setScene(null); setNote('');
    setGive({ ids: list, pair: ps[0] || null, solo: who, kind });
  };
  const openGive = (gids, pickKind = null) => {
    const list = Array.isArray(gids) ? gids : (gids && gids.ids) || [];
    if (list.length === 1 && soloOn) { openGiveSolo(list[0], list, pickKind); return; }
    if (list.length < 2) return;
    const kind = pickKind || itemInfos.find(x => haveOf(x.kind) > 0 && !usedOf(x.kind))?.kind || 'gift';
    const ps = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) ps.push([list[i], list[j]]);
    const best = ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).near) || ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).after) || ps[0];
    setRoomId(null); setScene(null); setNote('');
    setGive({ ids: list, pair: list.length === 2 ? [...list] : best, kind });
  };
  // opts.bought … 買って贈る(2026-11-08)で買った品。贈れなかったときは持ち物に残ることを添える
  // 道具タブの「🛒 ◯P で買って贈る」(2026-11-08)。その道具を選んだ贈るシートを、いま一緒にいる2人(1人用ならいる助手)で開く。
  //   シートで相手を選び、シートの「買って贈る」から確かめの窓へ。開ける相手がいなければ交換所の入口のまま
  const buyTarget = (solo) => {
    const groups = (life.groups || []).map(g => (g.ids || []).filter(id => ids.includes(id))).filter(g => g.length >= (solo ? 1 : 2));
    return groups[0] || (solo && ids.length ? [ids[0]] : null);
  };
  const openBuy = (kind, solo) => { const g = buyTarget(solo); if (!g) return; if (solo) openGiveSolo(g[0], g, kind); else openGive(g, kind); };
  const doGive = async (opts = null) => {
    const keptText = opts && opts.bought ? `。買った${opts.bought.name}は持ち物に残っています` : '';
    if (give && give.solo && soloOn) {
      const who = give.solo, kind = give.kind;
      const talk = await onGiveSolo(who, kind);
      const info = assistantLifeItemInfo(kind);
      setGive(null);
      if (!talk) { setNote(`${info ? info.name : '道具'}は、いまは贈れません(1人には1日3回・同じ道具は1日1回・持っている数を見てください)${keptText}`); return; }
      const w = assistantLifeWhereOf(life, who);
      const likeText = talk.like === 'like' ? ' ・ 💗 好きなもの！' : talk.like === 'bad' ? ' ・ 💧 ちょっと苦手…' : '';
      playTalk(talk, { ids: [who], place: w ? w.place : 'home', gift: true }); // 場面を流すと帯が消えるので、帯はそのあと(家具と同じ)
      setNote(`${nameOf(who)}に${info ? `${info.emoji} ${info.name}` : ''}を贈った。💗 仲良し度 +${talk.amount}${likeText}`);
      return;
    }
    if (!give || !give.pair) return;
    const talk = await onUseItem(give.kind, give.pair);
    const info = assistantLifeItemInfo(give.kind);
    if (!talk) { setNote(`${info.name}は、いまは贈れません(同じ道具は1日1回・合わせて1日3回・持っている数を見てください)${keptText}`); setGive(null); return; }
    const g = (life.groups || []).find(x => give.pair.every(id => x.ids.includes(id)));
    setGive(null);
    void assistantLifeDiaryAdd(`${give.pair.map(nameOf).join('と')}に${info.name}を贈った`, give.pair, { kind: 'give' });
    playTalk(talk, { ids: give.pair, place: g ? g.place : 'home', gift: true });
  };
  // おしゃべり(2026-11-08 社長 ❼〜❿)。助手ライフは閉じずに上に開くので、閉じると同じ部屋のシートに戻る。
  //   寝ていれば起こして話す(今日あったことに残し、生活のリズムの「誘って遊んだ」に数える)
  const chatOn = typeof ASSISTANT_LIFE_LINKS.chatWith === 'function';
  const chat = (id, f) => {
    try {
      if (typeof ASSISTANT_LIFE_LINKS.chatWith !== 'function') return;
      const w = assistantLifeWhereOf(life, id);
      const asleep = !!(w && w.doing === 'sleep');
      if (asleep) { assistantLifeRhythmPlay(id, Date.now()); void assistantLifeDiaryAdd(`${assistantLifeName(id)} 起こされておしゃべり`, [id], { kind: 'woken' }); }
      setFollow(null);
      ASSISTANT_LIFE_LINKS.chatWith(id, { asleep, follow: f || null });
    } catch {}
  };
  const beat = (id) => { try { if (typeof ASSISTANT_LIFE_LINKS.beatInvite === 'function') { close(); ASSISTANT_LIFE_LINKS.beatInvite(id); } } catch {} };
  const card = (id) => { try { if (typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function') { close(); ASSISTANT_LIFE_LINKS.cardInvite(id); } } catch {} };
  // 今日やれること
  const unwatched = (life.groups || []).filter(g => !(life.watched || []).includes(assistantLifeGroupKey(g)));
  // フレンドの家へ行っている助手には声をかけられない(2026-11-08 ミハリ。56-assistant-life-friend.jsx)
  const awayFriend = (id) => typeof assistantLifeFriendAwayOf === 'function' && !!assistantLifeFriendAwayOf(id);
  const lonely = Object.entries(life.solo || {}).find(([id, s]) => s.reason === 'lonely' && !awayFriend(id) && partnerOk(id));
  const beatIds = ids.filter(id => { const w = assistantLifeWhereOf(life, id); return w && w.doing === 'practice'; });
  const itemsLeft = Math.min(typeof assistantLifeGiftLeft === 'function' ? assistantLifeGiftLeft(peerSt) : 0, itemInfos.filter(x => !usedOf(x.kind) && haveOf(x.kind) > 0).length);
  const soloInfos = soloOn ? assistantLifeSoloDefs().map(g => assistantLifeItemInfo(g.kind)).filter(Boolean) : [];
  const itemsHave = [...itemInfos, ...soloInfos].reduce((n, x) => n + haveOf(x.kind), 0);
  const giveGroup = (life.groups || [])[0];
  // ひとりの助手しかいない時間も、1人に贈れる(❶B: 1人には別に1日3回)
  const giveSoloId = soloOn ? (Object.keys(life.solo || {}).find(id => !awayFriend(id)) || (giveGroup && giveGroup.ids[0]) || null) : null;
  const pad = 12;
  const houseW = land ? Math.min(560, Math.round(vw * 0.64) - pad * 2) : Math.min(380, vw - pad * 2);
  const tiles = (
    <div className={land ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5'} data-assistant-life-today>
      <button type="button" className={`mhl-tile mhl-watch flex-1${uiV2 && guideSeen === false && unwatched.length ? ' mhl-glow' : ''}`} data-assistant-life-today-act="watch" disabled={watchLeft <= 0 || !unwatched.length} onClick={() => { if (guideSeen === false) markGuideSeen(); if (unwatched[0]) watch(unwatched[0]); }}>
        {/* 1日の上限はなくした(2026-11-08 社長)。いま見守れる組の数を出す */}
        <em data-assistant-life-today-watch-now={unwatched.length}>{unwatched.length ? `今 ${unwatched.length}組` : 'いまは無し'}</em><i>👀</i><b>見守る</b><small data-assistant-life-today-gain="watch">{uiV2 ? (unwatched.length ? (guideSeen === false ? '👆 まずはここ' : '🤝💗 アップ') : (life.watched || []).length ? '✓ 済み・次の時間帯に' : '次の時間帯に') : (unwatched.length ? '時間帯ごとに1回' : '次の時間帯に')}</small></button>
      <button type="button" className="mhl-tile mhl-call flex-1" data-assistant-life-today-act="call" disabled={!Object.keys(life.solo || {}).filter(id => !awayFriend(id) && partnerOk(id)).length} onClick={() => { if (uiV2) { setCallPicker(true); return; } const id = lonely ? lonely[0] : Object.keys(life.solo || {}).filter(id => !awayFriend(id) && partnerOk(id))[0]; if (id) setRoomId(id); }}>
        <em>無料</em><i>💬</i><b>声をかける</b><small data-assistant-life-today-sub>{lonely ? `💭 ${nameOf(lonely[0])}` : 'ひとりの助手に'}</small></button>
      <button type="button" className="mhl-tile mhl-give flex-1" data-assistant-life-today-act="give" disabled={!uiV2 && (!canGive || (!giveGroup && !giveSoloId))} onClick={() => { if (uiV2) { setGiftItemsOpen(false); setGiftOpen(true); return; } if (itemsLeft > 0 && giveGroup) openGive(giveGroup.ids); else if (soloLeft > 0 && giveSoloId) openGiveSolo(giveSoloId, giveGroup && giveGroup.ids.includes(giveSoloId) ? giveGroup.ids : [giveSoloId]); else setTab('items'); }}>
        <em>{soloOn ? itemsLeft + soloLeft : itemsLeft}回</em><i>🎁</i><b>贈る</b><small data-assistant-life-today-gain="give">{!uiV2 ? `道具 ${itemsHave}個` : (soloOn ? itemsLeft + soloLeft : itemsLeft) <= 0 ? '✓ 今日は贈った' : itemsHave > 0 ? `🤝💗 アップ・${itemsHave}個` : '道具0個・買える'}</small></button>
      <button type="button" className="mhl-tile mhl-beat flex-1" data-assistant-life-today-act="beat" onClick={() => { if (beatIds[0]) setRoomId(beatIds[0]); }} disabled={!beatIds.length}>
        <i>🎵</i><b>モンヒロビート</b><small>{beatIds.length ? `${beatIds.length}人 ・ 券なし` : 'いまはだれも'}</small></button>
    </div>);
  const icons = (
    <div className="mhl-icons" role="tablist" data-assistant-life-icons>
      {(uiV2 ? assistantLifeUiV2Tabs() : [['house', '🏡', '家'], ['where', '📋', '居場所'], ['friends', '🤝', '友情'], ['items', '🎒', '道具'], ...(typeof alfEnabled === 'function' && alfEnabled() ? [['visit', '🏘', 'フレンド']] : [])]).map(([k, ic, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} data-assistant-life-icon={k} className={tab === k ? 'on' : ''} onClick={() => { if (uiV2) { setMapFocusPlace(null); setMapFocusAssistantId(null); setGiftOpen(false); } setTab(k); setRoomId(null); }}><i>{ic}</i>{label}</button>))}
    </div>);
  const header = (
    <div className="mhl-hdr" style={{ paddingTop: land ? 6 : 'calc(8px + env(safe-area-inset-top))' }}>
      {/* 入らないとき(🔄横 667 の狭い欄)は、時計の札が次の行の右端へ回る(切れない・2026-11-08 ミハリ) */}
      <div className="flex flex-wrap items-start gap-x-2">
        <button type="button" data-assistant-life-close onClick={uiV2 ? backFromUiV2 : close} aria-label={uiV2 && tab !== 'house' ? '家へ戻る' : '閉じる'} className={uiV2 ? 'min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-[19px] text-slate-100 active:bg-white/10' : 'h-9 w-8 shrink-0 text-[19px] text-slate-100'}>←</button>
        {/* 英字の小見出しは狭い横(🔄横 667)で縮んで省略する(時計の札を押し出さない・2026-11-08 ミハリ) */}
        <div className="min-w-0 shrink overflow-hidden" data-assistant-life-title><p className="mhl-en truncate whitespace-nowrap" style={land ? { letterSpacing: '.06em', fontSize: 8 } : undefined}>ASSISTANT LIFE · {tab === 'where' ? 'WHERE' : tab === 'friends' ? 'FRIENDS' : tab === 'items' ? 'ITEMS' : tab === 'visit' ? 'VISIT' : tab === 'profile' ? 'PROFILE' : 'HOUSE'}</p><p className="mhl-ti whitespace-nowrap" style={land ? { fontSize: 18 } : undefined}>助手ライフ</p></div>
        <div className="min-w-0 flex-1"/>
        {/* 新UI/旧UIの切替は設定の「助手ライフの画面」へ(2026-11-11 社長。AssistantLifeUiSettingRow) */}
        {/* いまの時刻の札(ハナビの共通部品 44-time-of-day.jsx。設定の「いまの時刻を出す」が切なら出ない) */}
        {/* 裏クイック: 60-app がほかのモードと同じ帯(quickRunStrip)を渡すときは帯を見出しの下に出し、この小さな札は出さない(2026-11-08 社長「他のモードと同じような表示に」) */}
        {!quickRunStrip && <AssistantLifeQuickChip quickRun={quickRun} onStop={onQuickRunStop} onStart={onQuickRunStart} land={land}/>}
        {typeof TimeOfDayClock === 'function' && <div className="ml-auto shrink-0 self-center" data-assistant-life-clock-box><TimeOfDayClock/></div>}
      </div>
      {/* 時間帯と、みんなが動くまで(題を切らないよう2段目に。2026-11-07 社長「文字列も気をつけて」) */}
      <p className="mt-0.5 text-[10px] font-bold text-slate-200" data-assistant-life-clock>{assistantLifeTodLabel()} ・ <span data-assistant-life-next-slot className="whitespace-nowrap">{assistantLifeNextSlotText().replace(/みんなが動きます$/, 'みんなが動く')}</span></p>
      <div className="mt-1 flex items-center gap-1.5" data-assistant-life-tier={tier.id} title={ASSISTANT_LIFE_TIER_NOTES[tier.id]}>
        {uiV2 ? <button type="button" className="mhl-chip" data-assistant-life-tier-help aria-label="にぎわいの説明" onClick={() => setNote(`🎉 にぎわい「${tier.label}」: 今日 🤝 友情Lv の上がり方が ×${tier.mult}。モンヒロビート・バトル・MFバトルカード・見守るで遊ぶほど上がります${next ? `(あと ${next.min - play.points} で「${next.label}」×${next.mult})` : ''}。朝4時に戻ります`)} style={{ minHeight: 32, padding: '0 10px' }}>🎉 {tier.label} ×{tier.mult} <span aria-hidden="true">ⓘ</span></button> : <span className="mhl-chip">🎉 {tier.label} ×{tier.mult}</span>}
        <span className="mhl-bar" aria-hidden="true"><i style={{ width: `${next ? Math.min(100, Math.round(100 * (play.points - tier.min) / (next.min - tier.min))) : 100}%` }}/></span>
        <span className="whitespace-nowrap text-[9.5px] font-bold text-slate-200">{next ? `${next.label}まで ${next.min - play.points}` : 'いちばん上'}</span>
      </div>
    </div>);
  const findBtn = <button type="button" className="mhl-find" data-assistant-life-find onClick={() => { if (uiV2) { setMapFocusPlace(null); setMapFocusAssistantId(null); } setTab('where'); }}>📋 みんなの居場所 ›</button>;
  // 新UIのみ: 家の部屋札と同じ居場所データを参照する。未登場の助手は表示しない。
  const lifeStatusList = uiV2 ? (
    <section className="mx-3 mb-2 rounded-2xl border border-white/20 bg-slate-950/85 p-2 text-white" data-assistant-life-v2-status>
      <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left" aria-expanded={lifeStatusExpanded} onClick={() => setLifeStatusExpanded(v => !v)}>
        <span className="text-[13px] font-black">🏡 みんなの今 <span className="text-[10px] font-bold text-slate-300">（{ids.length}人）</span></span>
        <span className="text-[11px] font-bold text-amber-200">{lifeStatusExpanded ? '閉じる ▲' : '一覧を見る ▼'}</span>
      </button>
      {lifeStatusExpanded && <div className="max-h-[220px] space-y-1 overflow-y-auto overscroll-contain" data-assistant-life-v2-status-list>
        {ASSISTANT_LIFE_HOUSE_ORDER.filter(id => metSet.has(id)).map(id => {
          const w = assistantLifeWhereOf(life, id);
          const groupIds = w && w.group && Array.isArray(w.group.ids) ? w.group.ids : [];
          const peers = groupIds.filter(x => x !== id && metSet.has(x));
          const mapPlace = w && ASSISTANT_LIFE_MAP_ORDER.includes(w.place) ? w.place : 'home';
          const place = w ? assistantLifePlaceShow(w.place) : '家';
          const doing = w ? (ASSISTANT_LIFE_DOINGS[w.doing] || {}).label : '';
          return <div key={id} data-assistant-life-v2-status-id={id} className="flex min-h-[44px] w-full items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-1">
            <button type="button" className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 text-left active:bg-white/15" onClick={() => setRoomId(id)}>
              <span className="min-w-0 shrink-0 text-[12px] font-black">{nameOf(id)}</span>
              <span className="min-w-0 truncate text-right text-[10px] text-slate-200">{place}{doing ? ` ・ ${doing}` : ''}{peers.length ? ` ・ ${peers.map(nameOf).join('・')}と一緒` : ''}</span>
            </button>
            <button type="button" aria-label={`${nameOf(id)}の居場所を地図で見る`} className="min-h-[44px] shrink-0 rounded-lg border border-sky-300/50 px-2 text-[11px] font-bold text-sky-100 active:bg-white/15" onClick={() => { setMapFocusPlace(mapPlace); setMapFocusAssistantId(id); setTab('where'); }}>地図 ›</button>
          </div>;
        })}
      </div>}
    </section>
  ) : null;
  const houseView = (
    <div className="relative pt-1">
      {uiV2 && typeof AssistantLifeFirstGuide === 'function' && (guideSeen === false || guideOpen) && <AssistantLifeFirstGuide land={land} canWatch={!!unwatched.length} onClose={markGuideSeen} onWatch={() => { markGuideSeen(); if (unwatched[0]) watch(unwatched[0]); }}/>}
      {uiV2 && typeof AssistantLifeBenefitBoard === 'function' && <AssistantLifeBenefitBoard life={life} ids={ids} nameOf={nameOf} land={land} onGo={(fn) => { try { close(); fn(); } catch {} }}
        watchNow={unwatched.length} watchDone={(life.watched || []).length > 0} giveLeft={soloOn ? itemsLeft + soloLeft : itemsLeft}
        onWatch={() => { if (unwatched[0]) watch(unwatched[0]); }} onGive={() => { setGiftItemsOpen(false); setGiftOpen(true); }} onRoad={() => setTab('friends')} onGuide={() => setGuideOpen(true)}/>}
      {uiV2 && typeof AssistantLifeDailyCard === 'function' && <AssistantLifeDailyCard ids={ids} nameOf={nameOf} land={land}/>}
      <div className={land ? 'mb-1 flex justify-start' : 'mb-1 flex justify-end'} style={{ paddingInline: pad }}>{uiV2 ? null : findBtn}</div>
      <AssistantLifeHouseArt width={houseW} land={land} look={look} rooms={rooms} metSet={metSet} onOpen={setRoomId} diary={diary} pop={!!intro} onBoard={() => setBoardOpen(true)} life={life} peerSt={peerSt} v2={uiV2}/>
      {lifeStatusList}
    </div>);
  // 道具の一覧(2026-11-11 オクリモノ4・案7: 行は 56-assistant-life-gifts.jsx の AssistantLifeItemRow。1つの道具を2行に・説明は下の「？」に畳む)
  const itemsBody = (
      <div className="px-3 pb-3 pt-1" data-assistant-life-items>
        <p className="inline-block rounded-xl bg-slate-950/85 px-2 py-0.5 text-[13px] font-black text-amber-200">🤝 2人に贈る道具 <span className="text-[11px] text-slate-200">今日あと {typeof assistantLifeGiftLeft === 'function' ? assistantLifeGiftLeft(peerSt) : 0}回</span></p>
        {typeof AssistantLifeItemRow === 'function' && itemInfos.map(x => (
          <AssistantLifeItemRow key={x.kind} x={x} have={haveOf(x.kind)} used={usedOf(x.kind)} action={<>
            {haveOf(x.kind) <= 0 && (canGive && buyTarget(false) && typeof assistantLifeCanBuy === 'function' && assistantLifeCanBuy(x)
              ? <button type="button" data-assistant-life-item-buy={x.kind} onClick={() => openBuy(x.kind, false)} className="min-h-[44px] shrink-0 rounded-xl border border-violet-300/80 bg-violet-600 px-2 text-[11px] font-black leading-tight text-white active:scale-[.97]">🛒 {x.cost}P<br/>で買って贈る</button>
              : typeof AssistantLifeShopButton === 'function' && <AssistantLifeShopButton tab="item" small label={`🛒 ${x.cost != null ? `${x.cost}P` : '交換所'}`}/>)}</>}/>))}
        {soloOn && soloInfos.length > 0 && (<>
          <p className="mt-3 inline-block rounded-xl bg-slate-950/85 px-2 py-0.5 text-[13px] font-black text-pink-200" data-assistant-life-items-solo>💗 1人に贈る道具 <span className="text-[11px] text-slate-200">今日あと {soloLeft}回</span></p>
          {soloOn && <p className="mt-1 rounded-xl bg-slate-950/85 px-2 py-1 text-[11px] font-bold leading-snug text-slate-200">上の10種類も1人に贈れます(上がるのは仲良し度だけ)。下の4種類は1人用です</p>}
          {typeof AssistantLifeItemRow === 'function' && soloInfos.map(x => (
            <AssistantLifeItemRow key={x.kind} x={x} solo have={haveOf(x.kind)} used={typeof assistantLifeSoloReason === 'function' && haveOf(x.kind) > 0 && !!assistantLifeSoloReason(x.kind, peerSt, 1)} action={<>
              {haveOf(x.kind) <= 0 && (buyTarget(true) && typeof assistantLifeCanBuy === 'function' && assistantLifeCanBuy(x)
              ? <button type="button" data-assistant-life-item-buy={x.kind} onClick={() => openBuy(x.kind, true)} className="min-h-[44px] shrink-0 rounded-xl border border-violet-300/80 bg-violet-600 px-2 text-[11px] font-black leading-tight text-white active:scale-[.97]">🛒 {x.cost}P<br/>で買って贈る</button>
              : typeof AssistantLifeShopButton === 'function' && <AssistantLifeShopButton tab="item" small label={`🛒 ${x.cost != null ? `${x.cost}P` : '交換所'}`}/>)}</>}/>))}
        </>)}
        {typeof AssistantLifeItemsHelp === 'function' && <AssistantLifeItemsHelp solo={soloOn}/>}
        {typeof AssistantLifeShopButton === 'function' && <div className="mt-2"><AssistantLifeShopButton tab="item"/></div>}
      </div>);
  const tabBody = tab === 'house' ? houseView
    : tab === 'where' ? null // 地図は画面いっぱい(下の whereView)
    : tab === 'visit' && typeof AssistantLifeFriendPage === 'function' ? <AssistantLifeFriendPage life={life}/>
    : tab === 'profile' && typeof AssistantLifeProfilePage === 'function' ? <AssistantLifeProfilePage metIds={metIds} bondLevelOf={bondLevelOf} land={land} onMasmon={setMasmonId}/> // 📖 紹介(56-assistant-life-profile.jsx)
    : tab === 'friends' ? (<div className="px-3 pb-3 pt-1">{uiV2 && typeof AssistantLifeRewardRoad === 'function' && <AssistantLifeRewardRoad ids={ids.filter(partnerOk)} peerSt={peerSt} nameOf={nameOf} onRoom={setRoomId}/>}{uiV2 && typeof AssistantLifeIntroduceCard === 'function' && <AssistantLifeIntroduceCard ids={ids.filter(partnerOk)} life={life}/>}{typeof AssistantPeerMap === 'function' && <AssistantPeerMap metIds={metIds} onReplay={(t) => playTalk(t, null)} peerItems={peerItems} onUseItem={onUseItem} v2={uiV2} onGivePair={canGive ? (pair) => openGive(pair) : null}/>}</div>)
    : itemsBody;
  return (
    <div className="mhl-root" style={{ zIndex: 9000 }} data-assistant-life-screen data-assistant-life-look={look} data-assistant-life-land={land ? '1' : '0'}>
      <AssistantLifeHouseStyle/>
      {typeof AssistantLifeRelStyle === 'function' && <AssistantLifeRelStyle/>}
      <div className="mhl-page" style={{ maxWidth: land || tab === 'where' ? 'none' : 480 }}>
        <div className={`mhl-sky t-${look}`}/>
        <div className="mhl-wood" style={{ backgroundImage: `url(${ASSISTANT_LIFE_VIEW[look][1]})` }}/>
        {/* 📋 居場所: HOME の画面そのものを地図に(画面いっぱい・56-assistant-life-map.jsx)。下に今までの一覧・見出し・アイコンの列 */}
        {tab === 'where' ? (
          <AssistantLifeTownMap life={life} ids={ids} land={land} initialPlace={uiV2 ? mapFocusPlace : null} initialAssistantId={uiV2 ? mapFocusAssistantId : null} onBack={() => { if (uiV2) { setMapFocusPlace(null); setMapFocusAssistantId(null); } setTab('house'); }} onPick={(id) => { if (uiV2) { setMapFocusPlace(null); setMapFocusAssistantId(null); } setTab('house'); setRoomId(id); }} onView={uiV2 ? (id) => setRoomId(id) : null} onBeat={beat} onCard={card} nav={uiV2 ? icons : null}
            list={uiV2 ? null : <>
              {header}
              {note && <p data-assistant-life-note className="mx-3 mb-1 rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 text-[11px] font-bold text-sky-100">{note}</p>}
              <div className="px-3 pb-2"><AssistantLifeScreenBody metIds={metIds} onReplay={playTalk} peerItems={peerItems} onUseItem={onUseItem} embedded/></div>
              <div className="px-3" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>{icons}</div>
            </>}/>
        ) : land ? (
          <div className="relative z-[2] flex h-full min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
            <div className="mhl-body" style={{ flex: '0 0 64%' }}>{tabBody}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-gradient-to-b from-[#1a0f2e] to-[#0b1020] px-2.5 pb-2">
              {header}
              {quickRunStrip && <div className="shrink-0" data-assistant-life-quick-strip>{quickRunStrip}</div>}
              {note && <p data-assistant-life-note className="rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1 text-[10.5px] font-bold text-sky-100">{note}</p>}
              {tiles}
              {icons}
            </div>
          </div>
        ) : (<>
          {header}
          {quickRunStrip && <div className="relative z-[3] shrink-0" data-assistant-life-quick-strip>{quickRunStrip}</div>}
          <div className="mhl-body">
            {note && <p data-assistant-life-note className="mx-3 mb-1 rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 text-[11px] font-bold text-sky-100">{note}</p>}
            {tabBody}
          </div>
          <div className="relative z-[3] bg-gradient-to-t from-[#0b1020] via-[#0b1020ee] to-transparent px-3 pt-1.5" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
            {tab === 'house' && <><p className="mb-1 flex justify-between text-[10px] font-black text-slate-200">今日やれること<span className="font-bold text-slate-400">朝4時に戻る</span></p>{tiles}</>}
            <div className="mt-1.5">{icons}</div>
          </div>
        </>)}
        {callPicker && uiV2 && <div className="absolute inset-0 z-[22] flex items-end justify-center bg-black/60" data-assistant-life-call-picker><div className="w-full max-w-[480px] rounded-t-2xl border-t-2 border-sky-300 bg-slate-900 p-4" style={{paddingBottom:'calc(16px + env(safe-area-inset-bottom))'}}><div className="mb-3 flex items-center justify-between"><b>💬 声をかける助手を選ぶ</b><button type="button" className="min-h-[44px] px-3" onClick={() => setCallPicker(false)}>閉じる ✕</button></div><div className="max-h-[46vh] overflow-y-auto">{Object.keys(life.solo || {}).filter(id => !awayFriend(id) && partnerOk(id)).map(id => <button type="button" key={id} className="mb-2 flex min-h-[48px] w-full items-center justify-between rounded-xl border border-white/20 bg-slate-800 px-3 text-left" onClick={() => { setCallPicker(false); setRoomId(id); }}><span>{nameOf(id)}</span><span className="text-xs text-slate-300">{life.solo[id]?.reason === 'lonely' ? '💭 さみしそう・声をかけよう' : 'ひとりで過ごしている'} ›</span></button>)}</div><p className="mt-1 text-[11px] font-bold leading-snug text-slate-300" data-assistant-life-call-hint>💭 さみしそうな助手は、声をかけると次の時間にだれかの所へ行きます(🤝 友情Lv が育つきっかけ)</p></div></div>}
        {uiV2 && tab === 'where' && note && !roomId && <p data-assistant-life-note className="absolute inset-x-3 z-[9] rounded-xl border border-sky-300/40 bg-slate-950/95 px-2 py-1.5 text-[11.5px] font-bold text-sky-100" style={{ bottom: 'calc(44px + env(safe-area-inset-bottom))' }}>{note}</p>}
        {giftOpen && uiV2 && !roomId && !give && (
          <div className="absolute inset-0" style={{ zIndex: 21 }} data-assistant-life-gift-sheet>
            <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={() => setGiftOpen(false)}/>
            <div className="mhl-sheet" style={land ? { left: 'auto', width: '56%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px' } : undefined}>
              <div className="flex items-center justify-between gap-2"><p className="text-[18px] font-black">🎁 贈る</p><button type="button" data-assistant-life-gift-sheet-close data-mhl-sheet-close onClick={() => setGiftOpen(false)} className="min-h-[44px] rounded-xl border border-slate-500 px-3 text-[12px] font-black text-slate-200 active:scale-[.98]">閉じる ✕</button></div>
              {typeof AssistantLifeGiveWho === 'function' && <AssistantLifeGiveWho groups={(life.groups || []).map(g => ({ ...g, ids: (g.ids || []).filter(id => metSet.has(id)) })).filter(g => g.ids.length >= 2 && g.ids.every(partnerOk))} soloIds={ASSISTANT_LIFE_HOUSE_ORDER.filter(id => metSet.has(id) && !awayFriend(id) && partnerOk(id))} pairLeft={typeof assistantLifeGiftLeft === 'function' ? assistantLifeGiftLeft(peerSt) : 0} soloLeft={soloLeft} canPair={canGive} soloOn={soloOn}
                onPair={(g) => { setGiftOpen(false); openGive(g.ids); }} onSolo={(id) => { setGiftOpen(false); const g = (life.groups || []).find(x => (x.ids || []).includes(id)); openGiveSolo(id, g ? g.ids : [id]); }}/>}
              <button type="button" data-assistant-life-gift-items-toggle aria-expanded={giftItemsOpen} onClick={() => setGiftItemsOpen(v => !v)} className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-white/20 bg-white/5 px-3 text-left text-[13px] font-black text-white active:scale-[.98]"><span>📦 道具の一覧 <span className="text-[11px] font-bold text-slate-300">持っている {itemsHave}個・手に入れ方</span></span><span className="text-[11px] font-bold text-amber-200">{giftItemsOpen ? '閉じる ▲' : '見る ▼'}</span></button>
              {giftItemsOpen && <div className="-mx-3">{itemsBody}</div>}
            </div>
          </div>)}
        {roomId && partnerOk(roomId) && <AssistantLifeRoomSheet key={roomId} id={roomId} uiV2={uiV2} returnToMap={uiV2 && tab === 'where'} openFurn={furnBack === roomId} onGiveSolo={soloOn ? openGiveSolo : null} canGiveSolo={soloOn && soloLeft > 0} life={life} peerSt={peerSt} bondLevelOf={bondLevelOf} diary={diary} slot={slot} furnItems={furnItems} onGiveFurn={onGiveFurn} onFurnTalk={(talk, text) => { playTalk(talk, { ids: [talk.pair[0]], place: 'home', gift: true }); setNote(text); }} canGive={canGive && itemsLeft > 0}
          land={land} onClose={() => { setRoomId(null); setFollow(null); setFurnBack(null); }} onPeek={peek} onInvite={invite} onWatch={watch} onGive={(g) => openGive(g.ids)} onBeat={beat} onCard={card} onMediate={mediate} roomState={rooms[roomId]} onMasmon={setMasmonId}
          onChat={chatOn ? chat : null} follow={follow && follow.id === roomId ? follow : null} onFollowDone={() => setFollow(null)}/>}
        {masmonId && typeof AssistantMasmonSheet === 'function' && <AssistantMasmonSheet id={masmonId} land={land} bondLv={typeof bondLevelOf === 'function' ? bondLevelOf(masmonId) : null} onClose={() => setMasmonId(null)}/>}
        {typeof AssistantLifeTownPersonCard === 'function' && <AssistantLifeTownPersonCard life={life} land={land}/>}
        {boardOpen && (
          <div className="absolute inset-0" style={{ zIndex: 25 }} data-assistant-life-diary>
            <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={() => setBoardOpen(false)}/>
            <div className="mhl-sheet" style={land ? { left: 'auto', width: '42%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px' } : undefined}>
              <p className="mhl-en">TODAY</p><p className="text-[18px] font-black">📌 今日あったこと</p><p className="text-[10.5px] font-bold text-slate-400" data-assistant-life-diary-count>全部で{(diary.items || []).length}件・新しい順</p>
              {(diary.items || []).length ? [...diary.items].reverse().map((x, i) => <p key={i} className="mt-1.5 text-[12px] font-bold leading-snug text-slate-100"><b className="mr-1.5 text-amber-200">{x.t}</b><AssistantLifeChunks text={x.text}/></p>) : <div className="mt-2" data-assistant-life-diary-empty><p className="text-[12px] font-bold leading-snug text-slate-300">まだ何もありません。👀 見守る・💬 声をかける・🎁 贈る をすると、その日のできごとがここに残ります(朝4時に新しい1日)</p>{uiV2 && unwatched[0] && <button type="button" data-assistant-life-diary-watch onClick={() => { setBoardOpen(false); watch(unwatched[0]); }} className="mt-2 min-h-[44px] w-full rounded-xl border border-orange-300/60 bg-orange-500/20 text-[13px] font-black text-orange-100 active:scale-[.98]">👀 いまいる組を見守る(🤝💗 アップ)</button>}</div>}
              <button type="button" data-assistant-life-diary-close data-mhl-sheet-close onClick={() => setBoardOpen(false)} className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">閉じる</button>
            </div>
          </div>)}
        {scene && <AssistantLifeScene key={scene.key} scene={scene} look={look} canGive={canGive && itemsLeft > 0} onClose={() => { setScene(null); showFollow(); }} onGive={openGive}/>}
        {intro && (
          <button type="button" className="mhl-intro" data-assistant-life-intro={intro} onClick={() => setIntro(null)} aria-label="とばす">
            {intro === 'long' && <div className="absolute inset-0 grid place-items-center" style={{ animation: 'mhlFade .3s ease-in .9s both' }}>
              <div className="text-center" style={{ animation: 'mhlIntroTitle .5s ease-out both' }}><p className="mhl-en">ASSISTANT LIFE</p><p className="mhl-ti" style={{ fontSize: 30 }}>助手ライフ</p></div></div>}
            <div className="door" style={{ left: 0, animation: `mhlDoorL ${intro === 'long' ? '.5s' : '.35s'} ease-in ${intro === 'long' ? '.35s' : '0s'} both` }}/>
            <div className="door" style={{ right: 0, animation: `mhlDoorR ${intro === 'long' ? '.5s' : '.35s'} ease-in ${intro === 'long' ? '.35s' : '0s'} both` }}/>
          </button>)}
      </div>
      {give && <AssistantLifeGiftSheet give={give} setGive={setGive} life={life} peerSt={peerSt} haveOf={haveOf} nameOf={nameOf} onGive={doGive}/>}
    </div>);
}

// 📋 みんなの居場所の地図は 56-assistant-life-map.jsx(案A: HOME の画面そのものを地図に・2026-11-08 社長)

// 「ごほうび済み」の印(カード部屋の 1.5倍を使い切った助手。HOME の顔と地図の全身で同じ形・2026-11-08 社長「HOMEも地図も出す」)
// 左下に置く(HOME の顔は右どなりの顔が少し重なるので、右下だと隠れる)
function AssistantLifeSpentMark({ size = 20 }) {
  const d = Math.max(10, Math.round(size * 0.6));
  return <span aria-hidden="true" data-assistant-life-spent-mark className="pointer-events-none absolute z-[1] grid place-items-center rounded-full bg-slate-100 font-black text-slate-900 shadow" style={{ left: -3, bottom: 0, width: d, height: d, fontSize: Math.max(7, Math.round(d * 0.72)), lineHeight: 1, boxShadow: '0 0 0 1px #0b1020' }}>済</span>;
}
// ---------- HOME: 遊んでいる所の施設の下に顔だけ(2026-11-07 社長「もっと小さくしてコンテンツの下において」) ----------
// 施設の札のすぐ下に、小さい顔を横1列で並べる。全員出す(上限で切らない)。札やほかのボタンに重ならないよう、
// 下にある札までのすき間を測って顔の大きさを決める(20〜12px)。1列に並びきらないときは、札の幅より外へ伸ばす(左の列は右へ・右の列は左へ)
// HOME(main)の札だけを見る(地図も同じ class の札を持つため)。神殿も地図と同じく顔を出す(2026-11-08 地図 A)
const ASSISTANT_LIFE_FACILITY_SEL = Object.freeze({ rhythm: 'main.mh-home-scene .mh-home-facility.rhythm', card: 'main.mh-home-scene .mh-home-card-battle', management: 'main.mh-home-scene .mh-home-facility.management', temple: 'main.mh-home-scene .mh-home-facility.temple', market: 'main.mh-home-scene .mh-home-facility.market', battle: 'main.mh-home-scene .mh-home-facility.battle', life: 'main.mh-home-scene .mh-home-facility.life' });
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
    // カード部屋の 1.5倍を使い切った助手も顔は出し、「済」の印を付ける(2026-11-08 社長「HOMEも地図も出す」。前の「外す」(Q2 A・#5073)を改めた)。押すと部屋で次の時間帯が分かる
    if (!rects[f]) f = 'life';
    if (!rects[f]) continue;
    (by[f] = by[f] || []).push(id);
  }
  // カード部屋にいる助手と対戦するとごほうびアップ(カード部の口があるときだけ)。MFバトルカードの札の横の顔の並びに小さく「UP」
  const cardUp = typeof ASSISTANT_LIFE_LINKS.cardInvite === 'function' && assistantLifeHouseCardIds().some(id => (by.card || []).includes(id) && !assistantLifeCardSpent(id)); // 「UP」は、まだごほうびが上がる助手がいるときだけ
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
      const upW = f === 'card' && cardUp ? Math.round(size * 1.25) + 2 : 0;
      const rowW = size + (list.length - 1) * step + 6 + upW;
      const left = side ? (r.right ? r.x - rowW - 4 : r.x + r.w + 4) : (r.right ? Math.max(4, r.x + r.w - rowW) : r.x);
      const top = side ? r.y + r.h / 2 - size / 2 : r.y + r.h + 1;
      return (
        <div key={f} data-assistant-life-home-faces={f} data-assistant-life-home-face-size={size} data-assistant-life-home-face-side={side ? '1' : '0'} className="pointer-events-none fixed" style={{ zIndex: 40, left, top, width: rowW }}>
          <div className="pointer-events-auto flex items-center rounded-full bg-slate-950/70 px-[3px] shadow">
            {list.map((id, i) => { const who = assistantById(id); if (!who) return null; const w = assistantLifeWhereOf(life, id); const lonely = w && w.reason === 'lonely';
              const spent = f === 'card' && !!assistantLifeCardSpent(id);
              return (
                <button key={id} type="button" data-assistant-life-home-face={id} data-assistant-life-home-face-spent={spent ? '1' : undefined} aria-label={`${who.name}のようす${spent ? '(対戦のごほうび済み)' : ''}`} onClick={() => { ASSISTANT_LIFE_STORE.set({ open: true, focus: id }); }}
                  className="relative shrink-0 rounded-full active:scale-90" style={{ marginLeft: i ? -4 : 0, boxShadow: lonely ? '0 0 0 1.5px #fbbf24,0 0 6px #fbbf24' : after.has(id) ? '0 0 0 1.5px #7dd3fc' : '0 0 0 1.5px #fff' }}>
                  <span className="block" style={spent ? { filter: 'grayscale(.6) brightness(.8)' } : undefined}><AssistantFace who={who} size={size} accent={who.accent}/></span>
                  {spent && <AssistantLifeSpentMark size={size}/>}
                  {/* 押しやすいように、見た目より広く押せる */}
                  <span aria-hidden="true" className="absolute -inset-1.5"/>
                </button>); })}
            {upW > 0 && <span data-assistant-life-home-card-up className="pointer-events-none shrink-0 rounded-full bg-amber-300 font-black text-slate-950" style={{ marginLeft: 2, fontSize: Math.max(8, Math.round(size * 0.48)), lineHeight: `${Math.max(10, size - 4)}px`, padding: '0 3px' }}>UP</span>}
          </div>
        </div>); })}
    {rects.life && typeof AssistantLifeFriendHomeBadge === 'function' && <AssistantLifeFriendHomeBadge rect={rects.life}/>}
  </>);
}
