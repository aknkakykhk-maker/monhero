// 公開前の機能は、ヘルプの項目も更新履歴のお知らせも書き上げたうえで隠しておく。
// data/*.js は game-system.jsx より先に読み込まれるので公開フラグを見られない。
// そこで data 側には releaseFlag という名札だけを書き、出す・出さないの判断はここでまとめて行う。
// 公開するときは SPECIES_CHALLENGE_PUBLIC_RELEASE を true にするだけで、
// ヘルプ・更新履歴・助手の告知が同時に出る(片方だけ先に出てしまうことがない)
// モンヒロビートは2026-09-05のプレオープンで公開した(ユーザー指示)。
// これを true にしたことで、HOMEの「準備中」がプレオープンの導線に変わり、
// ヘルプの項目・更新履歴・助手の告知も同時に出るようになっている
const RHYTHM_MODE_PUBLIC_RELEASE = true;
// クイック∞周回とモンビーの連携(docs/spec/QUICK_RHYTHM_LINK.md)。
// 裏で周回が続くところまでは動くが、周回の進捗表示・モンビーからの開始・
// 演奏中ぶんの追いつきがまだ無いので、遊ぶ人には案内しない。
// ★出来上がってからここを true にする(2026-09-06・ユーザー指示「出来てからにして」)。
// true にすれば、ヘルプの項目・更新履歴・助手の告知が同時に出る
// 2026-09-07・ユーザー指示「公開フラグは出してok」。実機でひととおり確認してもらったうえで公開。
// これが true になると、ヘルプの項目・更新履歴・みゅあの告知・画面のなかの使い方案内が
// 同時に出る(片方だけ先に出ることが起きないよう、4つとも同じフラグで出入りする)。
const QUICK_RHYTHM_LINK_PUBLIC_RELEASE = true;
// モンヒロビートのノーツを canvas 1枚へ描く方式(発熱対策・docs/spec/RHYTHM_MODE.md)。
// false のあいだは従来の要素(DOM)で描き、デバッグ画面の「ノーツの描き方」で上書きしたときだけ canvas になる。
// 実機で「冷ました状態で最初の1分・交互に」比べて問題が無ければ true にする。true にすると更新履歴・ヘルプの項目が出る。
// 2026-09-08・実機で比べてもらい、マスモンの絵が残る・失敗した HOLD/SLIDE が消える・触った FLICK の帯が残る、を直したうえで
// ユーザー「問題なし」→ 公開。デバッグ画面の「ノーツの描き方」で「要素」を選べば従来の描き方へ戻せる。
const RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE = true;
// モンヒロビートのマルチ(同じ曲でスコア対決)。曲えらびの「対戦」ボタンの出し入れ
const RHYTHM_MULTI_PUBLIC_RELEASE = true;
// フレンド機能(フレンドコード・申請・プロフィール閲覧)。docs/spec/FRIENDS.md
// ★Supabase の friend_codes / friend_links を使うので、docs/sql/friends/FRIENDS_APPLY.sql を
//   適用するまでは中身が出せない。適用して画面を確かめてから true にする。
//   false のあいだは入口もヘルプ・更新履歴・助手の告知もまとめて隠す(画面そのものも開けない)。
const FRIENDS_PUBLIC_RELEASE = true;
// イベント・レイドボス「ジャック」(docs/spec/RAID_BOSS_JACK.md)。
// ★共有HPと累計ダメージはSupabaseの新しい表を使うので、docs/sql/raid/RAID_JACK_APPLY.sql を適用して
//   画面を確かめるまでは false。false のあいだは入口・ヘルプ・更新履歴・助手の告知もまとめて隠す。
// ★2026-10-05・ユーザー指示「10/5 4:00公開」で true にした。ただし RELEASE_FLAGS.raidJack は、下で開始日時(RAID_JACK_EVENT.startAt)になるまで偽を返す。
//   先に配信しても、入口・ヘルプ・更新履歴・お話・回想は4:00ちょうどまで出ない(見るたびに数え直す getter)
// ジャックの開始日時。RELEASE_FLAGS.raidJack の判定は、更新履歴や助手の告知を作るとき(このファイルが読み込まれるとき)にも
// 呼ばれる。そのとき RAID_JACK_EVENT(35-raid-jack.jsx・あとに読み込まれる)はまだ無く、触ると例外になって「いつも偽」になり、
// 開始を過ぎても更新履歴に出なかった(2026-10-05・ユーザー指摘「もう公開してるのに更新情報に出てない」)。
// 開始日時はここにも置く(35-raid-jack.jsx の RAID_JACK_EVENT.startAt と同じ値。食い違いは tools/mode/raid-jack-check.js が見る)。
const RAID_JACK_START_AT = '2026-10-05T04:00:00+09:00';
const RAID_JACK_PUBLIC_RELEASE = true;
// レイドバトルの「モンヒロビートで挑戦する」(2026-10-06)。ダメージの仕様が固まるまで一時止めていた(ユーザー指示)が、仕様の確定・実装・サブストーリー(ドラのビート)の用意ができたので、
// 2026-10-06 にユーザーの「出して」で公開した。偽にすると、レイド画面のボタン・サブストーリー・更新履歴・ヘルプの説明が出なくなる(デバッグの強制表示では、確認のためボタンだけ出る)
const RAID_JACK_RHYTHM_PUBLIC_RELEASE = true;
// モンヒロビートの「総合」ランキング(全曲合算・docs/spec/RHYTHM_RANKING.md §3)。
// ★集計はSupabase側のビュー(rhythm_total_rankings)が行うので、
//   docs/sql/rankings/RHYTHM_TOTAL_APPLY.sql を適用するまで中身が出せない。
//   false のあいだはタブそのものを出さず、ヘルプ・更新履歴・助手の告知もまとめて隠す。
//   こうしておかないと「説明だけ先に出る」ことになる(CLAUDE.md ⑤)。実際に一度そうしてしまった
//   (2026-09-11・ユーザー指摘「総合ランキングがまだできてないのにお知らせでできたみたいに書かれてる」)。
//   SQLを適用して RHYTHM_TOTAL_VERIFY.sql で上位が並ぶことを確かめたら true にする。
//   true にするときは、ヘルプの助手のひとことも「総合」に触れた文へ変える
//   (tools/mode/rhythm-total-ranking-check.js が見張る)。
// 2026-09-11・ユーザーが RHYTHM_TOTAL_APPLY.sql を適用し、13人・1位16,485,177点が並ぶことを
// 確かめたうえで公開。タブ・ヘルプ・更新履歴・助手の告知がここで同時に出る。
const RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE = true;
// モンヒロビートの「週間ランキング」(docs/spec/RHYTHM_RANKING.md §6。フェーズ3)。
// ★期間の窓(rhythm_week_window)と期間×対象曲の集計(rhythm_event_song_bests /
//   rhythm_event_totals)はSupabase側に置くので、
//   docs/sql/rankings/RHYTHM_EVENT_APPLY.sql を適用するまで中身が出せない。
//   false のあいだはイベントタブも曲えらびの案内も出さず、ヘルプ・更新履歴・助手の告知も
//   まとめて隠す。総合ランキングのときに一度「まだ遊べないのにお知らせだけ出た」を
//   やってしまっているので、同じことを繰り返さない(CLAUDE.md ⑤)。
//   SQLを適用して RHYTHM_EVENT_VERIFY.sql で今週の窓と順位が並ぶことを確かめたら true にする。
// 2026-09-11・ユーザーが RHYTHM_EVENT_APPLY.sql を適用し、今週の窓が
// 2026-09-07 05:00(月) 〜 2026-09-14 05:00(月) で並ぶことを確かめたうえで公開。
// イベントタブ・曲えらびの案内・ヘルプ・更新履歴・助手の告知がここで同時に出る。
const RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE = true;
// ビートPはSTEP4で正式公開。獲得はこのフラグに加えて期間限定イベント開催中だけに限定し、
// 常設の交換所・ヘルプ・更新履歴・助手告知を同じタイミングで公開する。
const RHYTHM_EVENT_POINTS_PUBLIC_RELEASE = true;
// モンヒロビート本オープン(2026-11-07 社長「本オープンに記念は差し替えたい」「とりあえずまずは全て準備できてから」)。
// 真にすると、同時に次が切り替わる(偽のあいだは今までどおりプレオープン記念のまま):
//   ・新しく始める人へのプレゼント → 「モンヒロビート本オープン記念」(大盛り)。NEW_PLAYER_CAMPAIGN_GIFT_GRAND
//   ・すでに遊んでいる人全員へ1回だけ「本オープン記念ギフト」(ダイヤ1,000万ほか)。GRAND_OPEN_ALL_GIFT
//   ・ヘルプの新規キャンペーンの話題・更新履歴(releaseFlag:'rhythmGrandOpen')
// 2026-11-08 社長「まず告知をして明日の10時ぐらいにやりたい」→ 本オープンは 2026-11-09(月)10:00 JST。
//   時刻で切り替える(人が印を立てに行かなくても開く)。RELEASE_FLAGS.rhythmGrandOpen は、この印が真で、かつ開始時刻を過ぎたときだけ真。
//   見るたびに時刻と比べるので、開いたままの端末でも HOME のお話は切り替わる。更新履歴・助手の告知・ギフトは起動したときに決まる(開き直したときに出る)
const RHYTHM_GRAND_OPEN_RELEASE = true;
const RHYTHM_GRAND_OPEN_START_AT = '2026-11-09T10:00:00+09:00';
// 本オープンの予告(2026-11-07 社長「ホームで流してから本オープン。その前に予告の告知あり」)。
// 真にすると、予告の更新情報・助手の告知・HOME で1回だけ流す予告のお話(rhythm_grand_open_teaser)が出る。
// 本オープン(上)を真にしたあとは、予告のお話は HOME では流さない(回想には残る)。日にちが決まって社長が「予告を出す」と言うまで偽
// 2026-11-08 社長「この文で」(本オープンは 11/9 10:00)
const RHYTHM_GRAND_OPEN_TEASER_RELEASE = true;
// 裏クイックを、ゲームのどこにいても回す(2026-11-11 社長。台帳「クイックの裏周回を、ゲームを開いたら自動で始まり、どの画面でも裏で回る形にする。M/B管理と神殿では休む」)。
//   偽にすると、今までどおり モンヒロビート・MFバトルカード・助手ライフ の上でだけ回る(HOME へ戻ると周回は終わる)。
//   方針と決めごとは docs/progress/quick-run-anywhere/PLAN.md
const QUICK_RUN_ANYWHERE_RELEASE = true;
// ★tacticsBattle は「β公開のあいだも開く枠」。ヘルプは、β版で遊べる人にも要る
//   (tactics は本公開だけ。両方を1つのフラグにすると、本公開前の告知まで出てしまう)
// ★rhythmHell … 難易度 HELL(空中のノーツ SKY TAP・SKY SLIDE)。社長の OK まで偽(HISTORY 10/11 02:05「HELL はデバッグで色々見てから」)。
//   いまこの印の後ろにあるのは HELL のお話「空まで届くビート」(回想・BGM設定の枠)。HELL を公開するときに真にし、
//   ヘルプの HELL の項目・更新履歴・お話を流すきっかけ(案A: その曲の MASTER クリアで開く)を同じ回で入れる
// ★assistantChat … 助手とおしゃべり(2026-10-14 公開。社長が本番のデバッグで試して OK)。
//   HOMEの「おしゃべり」・仲良し度の行動 chat のヘルプ表示・更新履歴・お話「話せるようになった日」がこの印で一緒に出る
const RELEASE_FLAGS = { speciesChallenge: SPECIES_CHALLENGE_PUBLIC_RELEASE, tactics: TACTICS_MODE_PUBLIC_RELEASE,
  rhythmHell: true,
  // レイド・タクティクスプロ(ベースモンだけの回)の1回ごとの記録(raid_battle_logs・tactics_pro_logs)を送る(2026-10-21 社長「仕組みは作って」)。
  //   2026-10-22 窓口が表を2つとも作って確かめた(docs/sql/battle-log/BATTLE_LOGS_APPLY.sql)ので真にした。設計は docs/spec/BATTLE_LOG.md
  //   偽にすると何も送らず、タクティクスプロは入れ物も作らない(26-supabase.jsx)
  battleLog: true,
  // 行動カードの絵(枠4色・技のマーク・段階の札)。社長が今のカードと見比べて決めるまで偽(2026-10-15)。
  //   見比べはデバッグ設定の「行動カードの絵」の切り替えで(BATTLE_CARD_ART_DEBUG・71-screen-battle.jsx)
  battleCardArt: true,
  assistantChat: true,
  // おしゃべりでランキングの上位と自分の順位を答える(2026-10-21 社長の決定)。中継役を出し直したあと、2026-10-21 社長「実装していいよ」で真にした。
  //   ヘルプの説明と更新履歴はこの印で出る
  assistantChatRanking: true,
  // ふだんの吹き出しを1日1回まとめて作る(2026-10-14)。2026-10-14 社長「もう公開していいよ」→真にした(56-assistant-chat.jsx)
  assistantDailyLines: true,
  // 5人目の助手あつ(2026-10-22 社長の決定)。社長がお話の全文を読んで「公開ok」→真にした(2026-10-22)。
  //   偽のあいだは、助手の一覧・加入のお話・回想・ヘルプの項目に出ない(data/assistants.js の ASSISTANT_RELEASE_FLAGS)
  assistantAtsu: true,
  // 6人目の助手きゅうこ(2026-10-22 社長の決定)。新モンスターのイルミネ・ドリーミィも出る加入のお話を社長が全文読んで OK を出したら、3つ同時に真にする。
  //   偽のあいだは、助手の一覧・加入のお話・回想・マーケットのカード「きゅうこ」に出ない(data/assistants.js の ASSISTANT_RELEASE_FLAGS・data/breeder.js の kyukoCardOnSale)
  assistantKyuko: true,
  // 助手どうしのつながり(2026-11-07 社長「ガッツリ作りこんで」)。ペアの仲良し度・台本版の掛け合い・プロフィールの関係図(56-assistant-peer.jsx)。
  //   偽にすると、仲良し度は上がらず、掛け合いも関係図も出ない(おしゃべりで渡すほかの助手のメモ=段階1 はこの印に関係なく送る)
  assistantPeer: true,
  // 助手どうしの掛け合いの API 版(kind:'peer_talks')。中継役(assistant-chat)を窓口が配り、表 assistant_peer_talk_usage を作ってから
  //   マージする(2026-11-07 社長「この文で公開」・窓口の段取り)。偽にすると頼まず、台本版(ASSISTANT_PEER_TALKS)だけで流れる
  assistantPeerApi: true,
  // 会話で決まる呼び方・助手へのあだ名(2026-11-08 社長・docs/progress/assistant-peer/AI-TALK-PLAN.md)。中継役(assistant-chat の call/nick 欄)を
  //   窓口が配り、社長が更新履歴の文に「この文で」と言ってから真にする。偽のあいだは、カード・Lv6 の問いかけ・あだ名が出ず、呼び方は今までどおり
  //   (保存してある呼び方 mh_assistant_callname_v1 は偽でも読む。プロフィールの入力欄で決めたものは偽でもそこへ入る)
  assistantCallname: true,
  // 助手どうしの作り直し「助手たちの今」(2026-11-07 社長。設計 docs/progress/assistant-peer/LIFE-PLAN.md)。1人ずつが気分としたいことで
  //   だれと過ごすかを決める仕組み・にぎわい(遊んだ量で4段)・専用の画面。全部そろって社長が「この文で公開」と言ったら真にする。
  //   偽のあいだは、にぎわいを数えず、助手どうしの仲良くなり方も今のまま(56-assistant-life.jsx)
  assistantLife: true,
  // 助手ライフの家具(段階B・2026-11-08 社長 GIFT-PLAN.md)。交換所の「家具」・部屋に置く・贈ったときの反応。社長の「この文で」が出るまで偽
  assistantLifeFurniture: true, // 2026-11-08 社長「この文で」
  assistantLifeRoomEdit: true, // 助手の部屋の模様替え(家具を指で動かす・大きさ・向き・色・前後・おまかせ)。2026-11-11 社長「この形で進める」「この文で」・ミハリ最終確認 OK(56-assistant-life-roomedit.jsx)
  // 助手1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md ❶B ❷A ❸A ❹A ❺A)。台詞・止め絵・更新履歴の「この文で」・ミハリの確認のあとで真にする
  assistantLifeSolo: true, // 2026-11-08 社長「この文で公開」
  assistantLifeTopHouse: true, // 助手ライフを開いた最初に家の断面図(8部屋を横4×2段)・出かけ先の丸・得の帯の「今日・次」を▼にたたむ。2026-11-11 社長「この形で」(案A)。更新履歴「この文で」(社長)・ミハリ3・Fable の最終確認のあと真(56-assistant-life-house.jsx)
  assistantLifeDailyScene: true, // できごとを小さな場面に(2人の掛け合い→2択→返事・ときどき珍しいできごと)。台詞はココロ3(ひとこと96・場面6・珍しい6)(56-assistant-life-ux.jsx)
  // 助手ライフのフレンドの家との行き来(2026-11-08 社長・助手部オトズレ。設計 docs/progress/assistant-peer/FRIEND-VISIT-PLAN.md)。
  //   表 assistant_life_friend_* を流し、画面を撮って確かめ、社長の「この文で」が出たら真にする。偽のあいだは通信もしない(56-assistant-life-friend.jsx)
  assistantLifeFriend: true, // 2026-11-08 社長「この文で」・表を流した(窓口)
  alfMasmonShareSend: true, // 2026-11-12 社長「この文で」・ミハリ最終確認の4件を直してから真にした(#5596)。 フレンドの家で助手のマスモンをくわしく見せる(送る側・56-assistant-life-friend-masmon-share)。表 alf_masmon_share を窓口が流したあと、ミハリの確認を経て真にする(オトズレ)
  assistantLifeFriendBond: true, // 2026-11-11 社長「この文で」・表 assistant_life_friend_likes は窓口が流した・最終確認とミハリ3の確認のあと(フレンドの家の友情とスタンプ・今日の見どころとすてき・お気に入りの棚・お客さん帳。56-assistant-life-friend-bond)
  // その場面の台詞を Claude API で1日1回まとめて作る(assistant-chat の kind:'friend_scenes')。中継役を配ってから真にする。偽・thin・off・失敗のときは台本だけ
  // 助手のマスモンの名前を Claude API で1人1回まとめて付ける(assistant-chat の kind:'masmon_names'・2026-11-08 社長の選び ❷B)。
  //   窓口が中継役を配ったのを確かめてから真にする。偽・失敗のあいだは表の名前のまま(56-assistant-life-masmon.jsx)
  assistantMasmonBattleBeta: true, // 2026-11-11 助手マスモンの対戦 β その1(端末の中の対戦・ミセカタ2)。社長「この文で」・ミハリと Fable の最終確認のあと真にした(本番の関数の通しは省く・社長の決め)
  assistantMasmonBattlePvp: true, // 2026-11-11 助手マスモンの対戦 β その2(フレンド対戦+ランキング)。タイセンの表と関数(masmon-pvp)が本番に入ったあと真にした(本番の通しは省く・社長の決め 2026-11-11)
  assistantLifeBody: true, // 2026-11-12 社長「この文で」・ミハリの最終確認の直し(#5575・#5597)とキズナ #5594 のあと公開。 助手の疲れ・ストレス・けが・病気と🏥病院(56-assistant-life-body.jsx・ナカヨシ)。社長の選択(窓口経由)のあと、ミハリと窓口の最終確認で真にする
  assistantLifePlan: true, // 2026-11-11 助手の行き先の予定(📅 今日の予定表・ナカヨシ19・台帳 #5301)。止め絵と更新履歴の「この文で」・ミハリ・Fable の確認のあと真にする
  assistantMasmonTrain: true, // 2026-11-11 助手のマスモンの修行と助手の成長(仕様書の第②段階・シュギョウ)。2026-11-11 ミハリの最終確認と直した所の確認(ミハリ3)が OK・更新履歴とヘルプは社長「この文で」で公開
  assistantMasmonCheer: true, // 2026-11-11 モンヒロバトルにいる助手の 👀 修行を見る・📣 応援する・一人修行の伸び(シュギョウ2)。ミハリ3 OK・地図の窓 #5448・更新履歴とヘルプは社長「この文で」で公開
  assistantMasmonRanchTicket: true, // 2026-11-12 社長「この文で公開」・masmon-pvp 版4(DAILY_GROWTH_CAP 40)を配り終えてから真にした。2026-11-11 M/B管理にいる助手のマスモンにトレーニングチケット/重トレーニングチケットを使ってあげる(ボクジョウ)。真にすると今の「次の育成が1.2倍」は止まる。ミハリの確認と Fable の最終確認のあと、更新履歴とヘルプと一緒に真にする
  assistantMasmonPlan: true, // 2026-11-12 ミハリ5 OK・窓口の最終確認のあと公開。 育成ノート(助手のマスモンを計画して育てる・けが/病気/家出/サボり・56-assistant-life-masmon-plan.jsx・キズナ)。保存 mh_assistant_masmon_plan_v1・mh_assistant_masmon_cond_v1。gate → ミハリ → 窓口の最終確認のあと、更新履歴とヘルプと一緒に真にする
  assistantMasmonSleep: true, // 2026-11-12 公開(社長「この文で」・ミハリ fable 確認済み・真にしたら偽へ戻さない)。2026-11-12 助手のマスモンの冬眠(育てた中身を保ったまま眠らせ、あとで起こす・56-assistant-life-masmon-sleep.jsx・キズナ)。保存 mh_assistant_masmon_sleep_v1。育成ノートの印も真のときだけ動く。ミハリ → 窓口の確認のあと真にする
  assistantMasmonBond: true, // 2026-11-12 助手のマスモンの総合力とランク・忠誠度・人気・育成方針と叱る/褒める・年齢と寿命・成長の型・育ちの速さ×3(56-assistant-life-masmon-bond.jsx・キズナ・案 masmon-plan/POWER.md 第3版)。保存 mh_assistant_masmon_bond_v1。真にするのは masmon-pvp の配り直し(DAILY_GROWTH_CAP 200)・止め絵と更新履歴の「この文で」・ミハリ・Fable の確認のあと
  monheroSuccess: false, // 2026-11-12 モンヒロサクセス(プレイヤー側のターン制の育成)。まず合体の部品(56-monsuc-fuse.jsx)が使う。保存 mh_monsuc_*。案 docs/progress/player-raise/PLAN.md。ミハリ → 窓口 → 最終確認のあと真にする
  assistantMasmonFuse: true, // 2026-11-12 公開(社長「この文で」・ミハリ fable 確認済み・真にしたら偽へ戻さない)。2026-11-12 冬眠中の助手のマスモンどうしの合体(56-assistant-life-masmon-sleep.jsx・キズナ・案 masmon-plan/FUSE.md 第2版)。保存 mh_assistant_masmon_fuse_v1。冬眠の印も真のときだけ動く。ミハリ → 窓口の確認のあと真にする
  assistantMasmonSuggest: true, // 2026-11-09 助手のマスモン・デッキに「提案する」(キズナ4)。assistant-chat v24 と SQL 202611080003 を窓口が配り、本番で kind:'masmon_suggest' を1回呼んで返事が来るのを確かめた。カード部の受け手 #5126 と一緒に公開
  assistantMasmonGrow: true, // 2026-11-11 助手のマスモンの育成基盤(社長の仕様書の第①段階・キズナ4)。6能力・1日3回の自主育成・関わるほど強くなる。社長「この文で公開」。相談(鍛えて・休ませて)の読み取りは assistant-chat の配り直しのあとから
  assistantMasmonNamesApi: true, // 2026-11-08 assistant-chat v22(窓口が配った)を本番の形で1回呼んで名前が返るのを確かめた(キズナ3)
  assistantLifeFriendApi: true, // 2026-11-08 assistant-chat v17(窓口が配った)を端末の形で1回呼んで確かめた。スイッチが thin/off のあいだは頼まない
  // モンヒロビートの助手とのセッション(2026-11-07 社長の決定・ビート部マモリ)。全部そろって社長の「この文で」が出るまで偽
  rhythmAssistantSession: true, // 2026-11-07 社長「この文で公開」
  // 7人目の助手ソラシド(2026-10-27 社長の決定)。絵・お話・お知らせがそろって、社長が「公開」と言ったら真にする。
  //   偽のあいだは、助手の一覧・おしゃべり・選ぶ画面に出ない(data/assistants.js の ASSISTANT_RELEASE_FLAGS)。
  //   MFバトルカードの相手えらび・マルチ・観戦・記録・曲の並びにも出ない(82 の cardFoeReleased)
  assistantSorashido: true,
  // えるびん(8人目・2026-11-05)。社長が出来上がりを確かめて「オッケー」を出すまで偽のまま(お話・選ぶ画面・おしゃべりに出ない)
  assistantErubin: true,
  // 助手紹介(2026-11-11 社長・ナカヨシ18。56-assistant-life-profile.jsx)。ミハリの確認と窓口の最終確認が済んで、社長が「公開」と言ったら真にする。偽のあいだは助手ライフの下のタブに「📖 紹介」が出ない
  assistantLifeProfile: true, // 2026-11-11 社長「この文で」・ミハリ3と最終確認 OK で公開
  // 助手の解放(2026-11-11 社長・設計 docs/progress/assistant-unlock/DESIGN.md・18-assistant-partner.jsx)。
  //   偽のあいだは、はじめての人も今までどおり全員を選べる(助手えらびで mode:'earn' を書かない・案内の文も出さない)。
  //   すでに遊んでいる人の「全員が助手」(mode:'all')の一度きりの判定は、偽のあいだも書く(公開の前から遊んでいた人を守る)。
  //   ミハリの確認と Fable の最終確認のあと、窓口が真にする
  assistantPartnerUnlock: true, // 2026-11-11 Fable の最終確認のあと公開(窓口)
  // MFバトルカード(2026-10-24〜作っている途中。設計 docs/spec/CARD_BATTLE.md 7-3)。社長がお話と画面を見て「公開」と言ったら真にする。
  //   偽のあいだは、公開のお話(card_battle_intro_2026)・HOME の入口・マーケットのMFバトルカードの欄・更新履歴・ヘルプに出ない(デバッグ設定からだけ入れる)
  cardBattle: true, // 2026-10-26 社長「公開する」
  // MFバトルカードの助手のおしゃべり(AI)(2026-10-25 社長が3つとも選んだ)。中継役 card-assistant-talk を窓口が出して、社長が「公開」と言ったら真にする。
  //   偽のあいだは、デバッグ端末だけが呼べる(83-card-battle-talk-ai.jsx の cardTalkOpen)。オプションの入/切もデバッグ端末だけに出る
  cardAssistantTalk: true, // 2026-10-26 社長「公開する」
  // ミッションの助手の1日1行の案内(2026-11-08 社長 ③A「この文で」)。中継役 mission-daily-line を呼ぶ。届かないときは決まった台詞(52-mission-daily-line.jsx)
  missionDailyLine: true,
  // 育つ助手の型で、助手と対戦のデッキを組む(2026-11-08 社長・カード部ルールくん)。84 の cardGrowStyleOn が読む
  //   偽のあいだは型を渡さない(助手部の口 assistantLifeCardStyle があっても、今のデッキとまったく同じ)。真にするのは AI で組む本体と更新履歴・ヘルプを出すとき
  cardGrowStyle: true, // 2026-11-08 社長「この文で公開」(助手の3つのデッキ)
  tacticsBattle: TACTICS_MODE_PUBLIC_RELEASE || TACTICS_BETA_PRO_RELEASE,
  // タクティクスのヘイト(🔥)とモンスターのタイプ表記。2026-10-18 社長「ヘイトシステムは実装していいよ」で公開。
  //   数字は 32-tactics-units.jsx の TACTICS_HATE / MONSTER_TYPES。お話「タクティクスバトル ～4人のタイプ～」(tactics_types)もこの印で出る
  tacticsHate: true,
  // タクティクスのEXスキル。遊べる入口(β版を含む)があって、EXの公開フラグも立っているときだけ
  tacticsExSkills: (TACTICS_MODE_PUBLIC_RELEASE || TACTICS_BETA_PRO_RELEASE) && TACTICS_EX_SKILLS_RELEASE, rhythmMode:RHYTHM_MODE_PUBLIC_RELEASE, get rhythmGrandOpen() { try { return RHYTHM_GRAND_OPEN_RELEASE === true && Date.now() >= Date.parse(RHYTHM_GRAND_OPEN_START_AT); } catch (e) { return false; } }, rhythmGrandOpenTeaser:RHYTHM_GRAND_OPEN_TEASER_RELEASE, rhythmMulti:RHYTHM_MULTI_PUBLIC_RELEASE, friends:FRIENDS_PUBLIC_RELEASE, raidJackRhythm: RAID_JACK_RHYTHM_PUBLIC_RELEASE, get raidJack() { try { return RAID_JACK_PUBLIC_RELEASE === true && Date.now() >= Date.parse(RAID_JACK_START_AT); } catch (e) { return false; } }, quickRhythmLink:QUICK_RHYTHM_LINK_PUBLIC_RELEASE, rhythmCanvasNotes:RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE, rhythmTotalRanking:RHYTHM_TOTAL_RANKING_PUBLIC_RELEASE, rhythmWeeklyRanking:RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE, rhythmEventPoints:RHYTHM_EVENT_POINTS_PUBLIC_RELEASE };
// releaseFlag = そのフラグが立つまで出さない。unreleasedFlag = そのフラグが立ったら出さない。
// 逆向きの名札が要るのは「準備中です」の案内で、公開したあとも残っていると
// 遊べているのに準備中の項目が並ぶ(ヘルプのモンヒロビートで実際にそうなっていた・2026-09-06)。
const releasedForPlayers = (item) => !item
  || ((!item.releaseFlag || RELEASE_FLAGS[item.releaseFlag] === true)
    && (!item.unreleasedFlag || RELEASE_FLAGS[item.unreleasedFlag] !== true));
const CHANGELOG_TYPES = ['update', 'issue'];
// 日付やBUILD_DATEではなく、内容から作った安定IDでお知らせを識別する。同じID・同じ本文は
// ビルドし直しても未読へ戻らず、本文を変更した場合だけ新しい項目として扱う。
// ★idTitle は、題を書き直した項目の元の題(2026-10-27 社長「題の頭に遊びの名前を付けない」で頭を外した239件)。
//   id は元の題から作り続ける。題から作り直すと、読んだ人の既読(mh_changelog_seen_ids_*)が外れて全部 NEW に戻る。
const changelogEntryId = entry => {
  // ★fixedId は、出したあとで本文を直した項目の元の既読の印(2026-11-06 社長「モンスターのことを『子』って表現するのやめて」で直した110件)。
  //   本文から作り直すと、読んだ人の既読が外れて NEW に戻るため、元の印をそのまま使う
  if (typeof entry.fixedId === 'string' && entry.fixedId) return entry.fixedId;
  const source = entry.id || [entry.type, entry.idTitle || entry.title, ...(entry.items || [])].join('\u001f');
  let hash = 2166136261;
  for (let i=0;i<source.length;i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${entry.type || 'notice'}-${(hash >>> 0).toString(36)}`;
};
// 開発中の作業メモ(dev:true)は、どちらのタブにも出さない。
// releaseFlag だけで隠していたころは、公開フラグを true にした瞬間に公開前の作業メモが
// まとめて更新情報へ並んでしまい、プレイヤーには「見たこともない画面の不具合が直った話」が
// 延々と続いて見えていた(2026-09-05・ユーザー指摘でモンヒロビートの80件を dev:true にした)。
// 記録自体は data/changelog.js に残し、出す・出さないだけをここで決める。
// ★時刻になってから出しはじめる項目(visibleFrom)。
// releaseFlag は真偽値なので「9/11の15時になったら出す」が書けない。そのため、
// 週末ゲリラ杯を先に公開へ乗せた時点(13:40)で、お知らせ一覧に
// 「週末ゲリラ杯を開催します」が並んでしまった(2026-09-11・ユーザー指摘「お知らせに出ちゃってる」)。
// 助手の告知だけは assistantNotice の notifyFrom で止めていたが、一覧そのものは素通しだった。
// 判定は読み込んだときに1回だけ行う。開いたままの端末では次に開き直したときに出る
// (助手の告知もイベント会話も起動時に決まるので、そこにそろえてある)。
// 書き間違いで項目が永久に消えることがないよう、読めない値のときは出す側へ倒す(CLAUDE.md ⑦)。
const changelogVisibleNow = (entry, nowMs) => {
  if (!entry || typeof entry.visibleFrom !== 'string') return true;
  const from = Date.parse(entry.visibleFrom);
  if (!Number.isFinite(from)) return true;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  return now >= from;
};
const changelogForPlayers = (entry, nowMs) => !!entry && entry.dev !== true && releasedForPlayers(entry) && changelogVisibleNow(entry, nowMs);
// ★並び順は「日付の新しい順」をここで決める。data/changelog.js の書いてある順には頼らない。
//   別のファイル(data/rhythm-step3-release.js)が起動時に CHANGELOG.unshift で古い項目を
//   先頭へ差し込むため、書いてある順のままだと 2026-09-04 の項目が最新として並んでいた
//   (2026-09-07・ユーザー指摘「更新履歴の時間とか並ぶ順番がおかしい」)。
//   日付は "YYYY-MM-DD HH:MM" の固定書式なので、文字列のまま比べれば時刻まで正しく並ぶ。
//   日付が無い・壊れている項目は最後へ回す(消さない・CLAUDE.md ⑦)。
const changelogSortKey = (entry) => (typeof entry?.date === 'string' ? entry.date : '');
// ★filter へ changelogForPlayers を関数のまま渡さないこと。filter は第2引数へ添字を渡すので、
//   nowMs が 0,1,2… に化けて visibleFrom の項目が永久に出なくなる。必ず下の形で呼ぶ。
const CHANGELOG_READ_AT_MS = Date.now();
const CHANGELOG_ENTRIES = (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).filter(entry => changelogForPlayers(entry, CHANGELOG_READ_AT_MS))
  .map(entry => Object.freeze({...entry,id:changelogEntryId(entry)}))
  .slice()
  .sort((a, b) => (changelogSortKey(b) > changelogSortKey(a) ? 1 : changelogSortKey(b) < changelogSortKey(a) ? -1 : 0));
// 更新履歴から作る助手の告知も、隠している項目のぶんは出さない
// (data/assistants.js は公開フラグも dev も見られないため、ここで落とす)
// ★時刻待ちの項目(visibleFrom)は、ここでは隠さない。
//   この集合は読み込んだときに1回だけ作るので、開始より前に起動した端末では
//   その時刻になっても告知を永久に出せなくなる
//   (2026-09-11・ユーザー指摘「やってる最中の人が見れてないらしい」の正体)。
//   告知を出す期間は assistantNotice の notifyFrom / notifyUntil が見るたびに数える。
//   ここで隠すのは「作業メモ(dev)」と「まだ公開していない機能(releaseFlag)」だけ。
const HIDDEN_UPDATE_NOTICE_IDS = new Set((typeof CHANGELOG !== 'undefined' ? CHANGELOG : [])
  .filter(entry => !(entry && entry.dev !== true && releasedForPlayers(entry))
    && typeof entry?.assistantNotice?.id === 'string')
  .map(entry => entry.assistantNotice.id.trim()));
// どのタブへ出すかを決める。
// 「不具合情報」は不具合の話をまとめる場所なので、調査中(issue)だけでなく
// 直したもの(fix)もここへ出す。「更新情報」は新機能・改善・マーケットだけになる
// (2026-09-05・ユーザー指摘「上にタブがあるから不具合修正とかは右にして」)。
// 以前は type がタブ名と完全一致するものだけを出していたため、fix / feature / market と
// 書いた項目がどちらのタブにも出ず、更新履歴に載せたつもりで載っていなかった。
// 種別を新しく足しても消えないよう、下の CHANGELOG_ISSUE_TAB_TYPES 以外は必ず更新情報へ拾う
// ★一度きりの補正に使う保存キー(新しく足したもの。既存キーは触らない・CLAUDE.md ⑦)。
// 週末ゲリラ杯を公開へ乗せてから visibleFrom を足すまでの15分間(2026-09-11 13:33〜13:48)、
// まだ始まっていないイベントの項目が一覧に並んでいた。そのあいだに一覧を開いた端末では
// 既読になってしまい、15:00に出し直したときNEWが付かない
// (2026-09-11・ユーザー指摘「イベント来たけどお知らせにNEWがついてない」)。
const CHANGELOG_TIMED_SEEN_FIX_KEY = 'mh_changelog_timed_seen_fix_v1';
const CHANGELOG_ISSUE_TAB_TYPES = Object.freeze(['issue', 'fix']);
const changelogEntriesOfTab = (tab) => CHANGELOG_ENTRIES.filter(entry => CHANGELOG_ISSUE_TAB_TYPES.includes(entry.type) === (tab === 'issue'));
// ===== 更新情報の「話題」ごとのまとめ =====
// ちょこちょこした更新が1行ずつ積み上がり、過去の項目がすぐ画面の外へ流れていた
// (2026-09-13・ユーザー指摘「同じような内容は同じとこにまとめて詳細で詳しく出るようにして /
//  過去のやつが一瞬で見えなくなる」)。
// 同じ日の同じ話題を1行にまとめ、開いたときにその中身を全部出す。
// 682件が130行ほどになり、1画面でさかのぼれる日数が大きく増える。
//
// ★話題は entry.group があればそれを使い、無ければタイトルと本文から見当をつける。
//   すでにある682件へ手で group を書き足すのは現実的でないため。
//   見当は「どの見出しの下に並べるか」を決めるだけで、記録そのものには一切触らない。
//   外れても害は「見出しが違う」だけなので、迷ったら その他 へ落とす。
// ★新しく書く項目は group を書いておけば、見当に頼らず確実にそこへ入る。
const CHANGELOG_GROUPS = Object.freeze([
  // モンヒロサクセスのお知らせ(2026-11-12 社長「更新情報が新モンスターになってる」)。予告の本文の「新しいモンスターとして育て直し」で
  // 新モンスターへ入っていた。名前そのもので拾い、新モンスターより上に置く(見当は上から順に決まるため)
  { id:'success',   label:'モンヒロサクセス', emoji:'🌱', match:/モンヒロサクセス/ },
  // 新しいモンスター・新しい血統のお知らせ(2026-09-28・ユーザー指示「新モンスターは新モンスターとか新血統とか
  // そういうタブにして」)。ビートP交換所で先行公開するお知らせがモンヒロビートの下に入っていた。
  // 見当は「新モンスター」「新しい仲間」「新血統」のような言葉だけにとどめる(「円盤石」まで入れると
  // 値段の見直しや絵の調整まで引っ張られる)。確実に入れたい項目は group:'monster' と書く。
  // 一番上に置くのは、見当が上から順に決まるため(「新しい仲間…ビートP」をモンヒロビートより先に拾う)
  { id:'monster',   label:'新モンスター',   emoji:'🐣', match:/新モンスター|新しいモンスター|新しい仲間|新血統/ },
  // MFバトルカードのお知らせ(2026-10-25 社長「お知らせで新コンテンツとバトルのとかはMFバトルカードにして」)。
  // 「カード」「バトル」の言葉で ⚔ バトル へ入っていた。バトルより上に置き、名前そのもので拾う(これから先のお知らせも入る)
  { id:'cardBattle', label:'MFバトルカード', emoji:'🃏', match:/MFバトルカード/ },
  { id:'rhythm',    label:'モンヒロビート', emoji:'🎵', match:/モンヒロビート|モンビー|音ゲー|譜面|ノーツ|レーン|コンボ|判定|新曲|曲えらび|演奏|リズム/ },
  { id:'masu',      label:'マスモンの育成', emoji:'💜', match:/マスモン|強化|転生|限界突破|超越|魂格|合体|絆|トレーニング|育成|再生|染色|ブリーダー|オート強化/ },
  { id:'battle',    label:'バトル',         emoji:'⚔', match:/バトル|WAVE|難易度|勇者モン|供モン|カード|AUTO|クイック|極限|種族チャレンジ|スキップ|敵/ },
  { id:'items',     label:'アイテム・マーケット', emoji:'🎁', match:/マーケット|アイテム|ギフト|チケット|ダイヤ|ログインボーナス|ミッション|プシュケー/ },
  { id:'ranking',   label:'ランキング',     emoji:'🏆', match:/ランキング/ },
  { id:'assistant', label:'助手',           emoji:'🎀', match:/助手|みゅあ|きき|ももすけ/ },
  { id:'ui',        label:'画面・操作',     emoji:'🖥', match:/画面|表示|ボタン|レイアウト|ヘルプ|設定|HOME|更新情報|お知らせ|バナー|図鑑/ },
  { id:'other',     label:'その他',         emoji:'✦', match:null },
]);
const CHANGELOG_GROUP_BY_ID = Object.freeze(Object.fromEntries(CHANGELOG_GROUPS.map(group => [group.id, group])));
const changelogGroupInfo = (id) => CHANGELOG_GROUP_BY_ID[id] || CHANGELOG_GROUP_BY_ID.other;
// ★見当をつけるときは、まずタイトルだけで探す。本文まで一度に混ぜると、
//   ついでに触れただけの言葉へ引っ張られる。実際に
//   「新しいバージョンのお知らせを…選べるようにしました」が、本文に「演奏中は出さない」と
//   書いてあるだけでモンヒロビート扱いになっていた。
//   タイトルで決まらないときだけ、本文の先頭を見る(長い本文ほど関係ない語が増えるので先頭だけ)。
const changelogGroupMatch = (text) => {
  if (!text) return null;
  const hit = CHANGELOG_GROUPS.find(group => group.match && group.match.test(text));
  return hit ? hit.id : null;
};
const changelogGroupIdOf = (entry) => {
  const written = typeof entry?.group === 'string' ? entry.group.trim() : '';
  if (written && CHANGELOG_GROUP_BY_ID[written]) return written;
  const byTitle = changelogGroupMatch(String(entry?.title || ''));
  if (byTitle) return byTitle;
  const body = (Array.isArray(entry?.items) ? entry.items.join(' ') : '').slice(0, 200);
  return changelogGroupMatch(body) || 'other';
};
// 日付(降順)→話題 の順にまとめる。並び順は渡された配列のまま(呼び出し側で日付降順に並べてある)。
// 戻り値: [{ key, day, groupId, label, emoji, entries }]
// ★1つの話題に1件しかない日も、行の形はそろえる(数だけ「1件」になる)。
//   件数で形を変えると、その日だけ見え方が変わって「まとまっている」ことが伝わらない。
const groupChangelogEntries = (entries) => {
  const rows = [];
  const index = new Map();
  (Array.isArray(entries) ? entries : []).forEach(entry => {
    const day = typeof entry?.date === 'string' ? entry.date.slice(0, 10) : '';
    const groupId = changelogGroupIdOf(entry);
    const key = `${day}::${groupId}`;
    let row = index.get(key);
    if (!row) {
      const info = changelogGroupInfo(groupId);
      row = { key, day, groupId, label:info.label, emoji:info.emoji, entries:[] };
      index.set(key, row);
      rows.push(row);
    }
    row.entries.push(entry);
  });
  return rows;
};
// 更新履歴の画面は、開いているあいだ描き直すたびに全件をまとめ直していた。
// CHANGELOG_ENTRIES は読み込み時に決まって変わらないので、タブごとに1回だけまとめて使い回す
// (読むだけ。まとめた行を後から書き換えないこと)
const _changelogRowsByTab = new Map();
const changelogRowsOfTab = (tab) => {
  const key = tab === 'issue' ? 'issue' : 'update';
  if (!_changelogRowsByTab.has(key)) _changelogRowsByTab.set(key, groupChangelogEntries(changelogEntriesOfTab(key)));
  return _changelogRowsByTab.get(key);
};
// 既読の判定に使う「いま存在するすべてのID」。
// タブの振り分けを変えると、既読にしたIDが別のタブへ移る。タブごとのID一覧で
// ふるいにかけると移った先で未読へ戻ってしまうため、こちらで残す・捨てるを決める
const CHANGELOG_ALL_IDS = new Set(CHANGELOG_ENTRIES.map(entry => entry.id));
// 更新情報の「種類」の見せ方。データには前から type があったのに画面へ出しておらず、
// 不具合を直したのか新しく何かが増えたのかが読んでも分からなかった
// (2026-09-05・ユーザー指摘「直近の更新情報が不具合修正との区別がついてない」)。
// 文字とセットの色で、一覧を流し読みしても種類が分かるようにする。
const CHANGELOG_TYPE_LABELS = Object.freeze({
  fix:     { label:'不具合修正', tone:'fix' },
  feature: { label:'新機能',     tone:'feature' },
  update:  { label:'改善',       tone:'update' },
  market:  { label:'マーケット', tone:'market' },
  issue:   { label:'調査中',     tone:'issue' },
  // 2026-09-17 に足した。data/changelog.js は前から mode / content も使っていたのに
  // ここに無く、changelogTypeOf の既定へ落ちて「改善」と表示されていた
  // (クイックモードの「INFINITY」「GOD」追加が「改善」になっていた)。
  // content は新曲・新しい助手のような「新しい遊び」に付くので、公開のたびに起きる。
  mode:    { label:'新モード',   tone:'mode' },
  content: { label:'新コンテンツ', tone:'content' },
  // 2026-09-17 に足した。期間限定イベントの開催・閉幕は「改善」でも「新コンテンツ」でもない。
  // 第1回・第2回とも update(=改善) と表示されていた(ユーザー指摘)。
  // イベントは今後も繰り返し開くので、一覧で見分けられるよう専用の種別にする。
  event:   { label:'イベント',   tone:'event' },
});
const changelogTypeOf = (entry) => CHANGELOG_TYPE_LABELS[entry?.type] || CHANGELOG_TYPE_LABELS.update;
// 期間限定イベントのお知らせが、いま開催中か(一覧の項目に「開催中」の札を出す)。
// 助手の告知の期間(notifyFrom〜notifyUntil)を見る。描くたびに数え直す(CLAUDE.md ⑥-4)
const changelogEventLive = (entry, nowMs = Date.now()) => {
  // イベント以外でも、pinTop:{ until } を書いた項目は、出はじめ(visibleFrom)から until まで一番上に固定する
  // (2026-11-09 社長「(本オープン記念のお知らせを)上部に固定も」。周回5倍の期間が終わったら外れる)
  if (entry && entry.pinTop && typeof entry.pinTop === 'object' && entry.type !== 'event') {
    const pinFrom = Date.parse(entry.visibleFrom || '');
    const pinEnd = Date.parse(entry.pinTop.until || '');
    return Number.isFinite(pinEnd) && nowMs < pinEnd && (!Number.isFinite(pinFrom) || nowMs >= pinFrom);
  }
  const notice = entry && entry.type === 'event' ? entry.assistantNotice : null;
  if (!notice || !notice.notifyUntil) return false;
  const from = Date.parse(notice.notifyFrom || entry.visibleFrom || '');
  const until = Date.parse(notice.notifyUntil);
  // pinUntil を書いた項目(開催前の予告など)は、その時刻からは上に固定しない。開始のお知らせと札が2つ並ばないように(2026-11-03 社長「パンドライベントの予告が2つある」)
  const pinUntil = Date.parse(entry.pinUntil || '');
  if (Number.isFinite(pinUntil) && nowMs >= pinUntil) return false;
  return Number.isFinite(until) && nowMs < until && (!Number.isFinite(from) || nowMs >= from);
};

// 更新履歴のエントリに書いた外部リンク(link:{url,label})を、出してよい形だけ通す。
// 【なぜ絞るか】(2026-09-14・よそのゲームの曲を入れたときの案内用に足した)
// ここはデータ(data/changelog.js)から来た文字列をそのまま href へ入れる場所なので、
//   ・https だけ通す(javascript: や data: を弾く。書き間違いでも動かないようにする)
//   ・見た目だけ https に見える文字列を弾く(URL で解釈できないものは出さない)
// 呼ぶ側は target="_blank" と rel="noopener noreferrer" を必ず付ける。
const changelogSafeLink = (link) => {
  const url = (link && typeof link.url === 'string') ? link.url.trim() : '';
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch { return ''; }
};
const CHANGELOG_IDS_BY_TYPE = Object.fromEntries(CHANGELOG_TYPES.map(type => [type, changelogEntriesOfTab(type).map(entry => entry.id)]));
// 一覧の並べかえに使えるキー。画面の選択肢(MONSTER_SORT_OPTIONS)と必ず同じ顔ぶれにする。
// 片方にだけ足すと、画面では選べるのに保存だけ弾かれて、開き直すと元に戻る
// (実際に「総合力」がここへ足されておらず、選んでも次に開くと血統順へ戻っていた)。
// tools/monster/monster-list-filter-check.js が両者の一致を見張る。
const MONSTER_LIST_SORT_KEYS = ['base', 'masu', 'lineage', 'bond', 'power', 'name', 'active', 'fused', 'reborn'];
const DEFAULT_MONSTER_LIST_SETTINGS = { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', lineage: 'all', display: { base: true, masu: true, fused: true, active: true, reborn: true } };
const DEFAULT_FUSION_SORT_SETTINGS = { version: 1, sortKey: 'bond', sortDir: 'desc' };
const DEFAULT_DONATION_SORT_SETTINGS = { version: 1, sortKey: 'bondXp', sortDir: 'desc' };
const normalizeMonsterListSettings = (value) => {
  const displayKeys = ['base', 'masu', 'fused', 'active', 'reborn'];
  if (!value || value.version !== 1 || !MONSTER_LIST_SORT_KEYS.includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir) || !['sort', 'lineage', 'display'].includes(value.modalTab) || !value.display) return DEFAULT_MONSTER_LIST_SETTINGS;
  // 種族(主血統)のしぼりこみは後から足した項目。持っていない既存の保存値は「すべて」で補う。
  // 版を上げると保存ごと既定へ戻って並べかえ・表示設定まで失われるので、版は1のままにする
  const lineage = typeof value.lineage === 'string' && (value.lineage === 'all' || (typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES[value.lineage]))
    ? value.lineage : 'all';
  return { version: 1, modalTab: value.modalTab, sortKey: value.sortKey, sortDir: value.sortDir, lineage, display: Object.fromEntries(displayKeys.map(key => [key, typeof value.display[key] === 'boolean' ? value.display[key] : DEFAULT_MONSTER_LIST_SETTINGS.display[key]])) };
};
const normalizeFusionSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bond', 'lineage', 'name', 'fused'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_FUSION_SORT_SETTINGS;
  return { version: 1, sortKey: value.sortKey, sortDir: value.sortDir };
};
const normalizeDonationSortSettings = (value) => {
  if (!value || value.version !== 1 || !['bondXp', 'bond', 'power', 'name', 'lineage', 'newest', 'active'].includes(value.sortKey) || !['asc', 'desc'].includes(value.sortDir)) return DEFAULT_DONATION_SORT_SETTINGS;
  return value;
};
// 不具合情報タブに出す状態バッジの見た目
const CHANGELOG_STATUS = {
  fixed:         { label: '修正済み', cls: 'bg-emerald-900/70 text-emerald-300 border-emerald-500/50' },
  investigating: { label: '調査中',   cls: 'bg-amber-900/70 text-amber-300 border-amber-500/50' },
  known:         { label: '判明済み', cls: 'bg-slate-800 text-slate-300 border-slate-500/50' },
};
// 音量の既定値(まだ音量を保存していない端末だけに効く。保存した値はそのまま読む)。初期状態は「音がオン」。
// 2026-10-18 社長の判断「控えめの値に上げる」で 1 → 30。1 だとほとんど聞こえなかった(効果音 約-40dB・BGM 約-54dB)。
// 30 は効果音 約-28dB・BGM 約-38dB(14-audio.jsx の _gainFromPct / _bgmGain)で、いきなり大きな音にはならない。
// ミュートの解除(toggleQuickMute)は音量の値を変えず、保存している音量のまま鳴らし直す
const DEFAULT_VOLUME = 30;
// ログインボーナスは毎日、既存の報酬に加えてスキップチケット・序を1枚配る。
// 4日目の「100」はもともとブリーダー経験値のつもりだったが、
// 報酬の種類をブリーダーポイント(pt)にしていたため、使い道のないptが大量に配られていた。
// ptはマーケットのアイコン(1個1pt・全部で20種ほど)にしか使わないので、まとめて配らない
const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 },             { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },               { type:'skipTicketJo', amount:1 }],
  [{ type:'trainingTicket', amount:5 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'breederXp', amount:200 },           { type:'skipTicketJo', amount:1 }],
  [{ type:'uniqueSkillResetTicket', amount:1 },{ type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:2000 }, { type:'rainbowPsyche', amount:10 }, { type:'skipTicketJo', amount:1 }],
  // 7日目にセッション券(2026-10-07・docs/spec/RHYTHM_BUDDY.md)。アイテムのidをそのまま持つ報酬(gameItem)で配る
  [{ type:'bondPointReset', amount:1 }, { type:'trainingTicketLarge', amount:1 }, { type:'skipTicketJo', amount:1 }, { type:'gameItem', itemId:'session_ticket', amount:2 }],
];
// cardPackTicket … MFバトルカードのカードパック券(2026-11-08 ミッションの作り直し)。受け取ると mh_card_tactics_v1 の tickets へ足す(カードランクのごほうびと同じ入れ物)。
//   ★この表は1行のまま(検査 tools/mode/rhythm-reward-gift-check.js が1行で切り出す)
const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーP', breederXp:'ブリーダー経験値', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットの書', uniqueSkillResetTicket:'スキルポイントリセット券', rainbowPsyche:'虹のプシュケー', rainbowTranscendFruit:'虹の超越の実', trainingTicket:'トレーニングチケット', trainingTicketLarge:'重トレーニングチケット', skipTicketJo:'スキップチケット・序', skipTicketHa:'スキップチケット・破', skipTicketKyu:'スキップチケット・急', beatPoint:'ビートP', cardPackTicket:'カードパック券' };
const LOGIN_BONUS_DEFAULT = { currentDay:1, lastGrantedPeriod:null, totalLoginDays:0 };
// 日本時間へ直した後に4時間戻した暦日を期間キーにする。03:59と04:00は別の日、
// 04:00から翌03:59までは同じ日として扱える、比較・保存しやすい YYYY-MM-DD 形式。
const loginBonusPeriodKey = (now=Date.now()) => new Date(Number(now) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
// ---------- ゲームの「今日」(日本時間・朝4時区切り) ----------
// 2026-11-07 社長「てかぜんぶ4時に統一して」。1日で数える物は、これで「今日」を決める(loginBonusPeriodKey と同じ値)。
//   jstDayKey4(now) … 'YYYY-MM-DD'。04:00 から翌03:59 までが同じ日
//   jstDayCarry(saved, today) … 切り替えの夜の持ち越し。前は0時区切りだった物は、0:00〜4:00 に「次の日」の日付で保存されている。
//     保存された日がちょうど today の次の日なら、その日を今日として扱う(受け取り済みのまま・書くときもその日付のまま)。
//     4:00 になると today がその日に追いつくので、二重取りも取り逃しも起きない。それ以外は today
//   ★どちらもキーの名前・形は変えない。区切り方の検査は tools/boot/day-boundary-check.js
const jstDayKey4 = (now=Date.now()) => new Date(Number(now) + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const jstDayCarry = (saved, today) => {
  if (typeof saved !== 'string' || typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saved)) return today;
  const t = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(t) && saved === new Date(t + 86400000).toISOString().slice(0, 10) ? saved : today;
};
// ---------- 2026-11-07 の一度きりの戻し(社長「今日の分は全員リセット」) ----------
//   4時そろえの切り替えの夜に0時区切りで書いた「11/7」が、4:00 を過ぎても今日の分として残ったので、11/7 のあいだに1回だけ前の日の日付へ戻す。
//   items … [キー, その値の中で日付を持つ所]。'' は値そのものが日付の文字列(マス助言)。日付だけを '2026-11-06' にし、ほかは触らない
const DAY_RESET_20261107_FLAG = 'mh_day_reset_20261107_v1';
const DAY_RESET_20261107_ITEMS = Object.freeze([
  ['mh_card_daily_v1', 'day'],        // バトルカードの毎日の分(助手と対戦のごほうび・その日のポイント)
  ['mh_card_level_v1', 'day'],        // バトルカードのレベルの「その日はじめての勝ち」
  ['mh_rhythm_rank_v1', 'day'],       // モンヒロビートのランクの「その日はじめての1曲」
  ['mh_daily_masu_advice_date_v1', ''], // 毎日のマス助言
]);
const dayReset20261107Value = (v, field) => {
  if (field === '') return v === '2026-11-07' ? '2026-11-06' : null;
  if (!v || typeof v !== 'object' || Array.isArray(v) || v[field] !== '2026-11-07') return null;
  return { ...v, [field]: '2026-11-06' };
};
const runDayReset20261107 = async ({ storeGet, storeSet, now = Date.now() }) => {
  try {
    if (jstDayKey4(now) !== '2026-11-07') return 0;
    if (await storeGet(DAY_RESET_20261107_FLAG, false, false)) return 0;
    await storeSet(DAY_RESET_20261107_FLAG, true, false);   // 先に立てる(途中で止まっても二重に戻さない)
    let n = 0;
    for (const [key, field] of DAY_RESET_20261107_ITEMS) {
      const next = dayReset20261107Value(await storeGet(key, null, false), field);
      if (next !== null) { await storeSet(key, next, false); n += 1; }
    }
    return n;
  } catch (_) { return 0; }
};
// ---------- どの助手と一緒に遊ぶか ----------
// 助手は「みゅあ」「きき」から選ぶ。どちらも最初から解放されていて、解放条件は無い。
//
// 【既存プレイヤーの互換】★重要
// この保存キーが無い人は、これまでどおり「みゅあ」を選んでいる扱いにする。
// 助手選択の画面も出さない(いままで遊んできた人に選び直しを迫らない)。
const ASSISTANT_SELECTED_KEY = 'mh_assistant_selected_v1';
// ききが増える前から遊んでいた人へ、1回だけ見せる加入の会話。
// 「フラグが無い人＝既存プレイヤー」ではない(新しく始めた人も持っていない)ので、
// 既にオンボーディングを終えている(mh_onboarded)ことと合わせて判定する。
// 新しく始めた人は助手選択を通った時点で見たことにして、あとから誤って流れないようにする。
const KIKI_INTRO_SEEN_KEY = 'mh_kiki_intro_seen_v1';
// ももすけ登場の会話。ききのときと同じ考え方で、
//   ・すでに遊んでいた人 … アップデート後の初回HOMEで1回だけ流す。見終わるとももすけを選べるようになる
//   ・新しく始めた人     … 最初の助手選択でももすけを選べるので、この会話は流さない(その場で見たことにする)
// 本編を待たずにプロフィールの回想から見た場合も、最後まで見たらこのキーを立てる
// (＝解放され、あとから本編で重ねて流れない)。
const MOMOSUKE_INTRO_SEEN_KEY = 'mh_momosuke_intro_seen_v1';
// タクティクスバトルの導入会話を見たか。β公開してから1度だけ流すための判定に使う。
// ★新しいキーを足すだけ。既存の mh_*_intro_seen_v1 は一切触らない(CLAUDE.md ⑦)
const TACTICS_INTRO_SEEN_KEY = 'mh_tactics_intro_seen_v1';
// 難易度 HELL のお話「空まで届くビート」を見たか(2026-10-11・新しいキー。既存のキーには触らない・CLAUDE.md ⑦)。
// デバッグから見たぶんは立てない。HELL の公開(RELEASE_FLAGS.rhythmHell)までは読みにも行かない
const RHYTHM_HELL_STORY_SEEN_KEY = 'mh_rhythm_hell_story_seen_v1';
const RHYTHM_HELL_STORY_ID = 'rhythm_hell_story';
// デバッグの「公開の印が真だったら」で見たぶんは、本番のキーとは別の新しいキーに書く
// (デバッグ画面は誰でも開けるので、試した人が公開のときにお話を見そびれないように)
const RHYTHM_HELL_STORY_SEEN_PREVIEW_KEY = 'mh_rhythm_hell_story_seen_preview_proto';
const rhythmHellStorySeenKey = () => (typeof rhythmHellReleased === 'function' && rhythmHellReleased()) ? RHYTHM_HELL_STORY_SEEN_KEY : RHYTHM_HELL_STORY_SEEN_PREVIEW_KEY;
// HELL が初めて開いたとき(その曲の MASTER を初めてクリアしたとき)の、お話「空まで届くビート」の流し方(2026-10-12・社長の決定 案A)。
//   'release'      … HELL を公開した日に全員へ。公開後に HOME へ着いたとき、まだ見ていなければ1回だけ(MASTER のクリアとは関係なし)
//                    (2026-10-12 社長の決定「HELL を公開した日に全員へ」。これが既定)
//   'after-result' … その曲の MASTER を初めてクリアした結果画面を閉じたらすぐ、お話 → 説明(RhythmHellGuide)
//   'home'         … その曲の MASTER を初めてクリアしたあと、次に HOME へ着いたとき
//   'none'         … 流さない(回想からだけ見られる)
// 一度見たら(飛ばしても)次からは出ない。既読は mh_rhythm_hell_story_seen_v1(公開前は誰も書けないので、公開の日はまっさら)。
// デバッグの「公開の印が真だったら」で見たぶんは別のキー(RHYTHM_HELL_STORY_SEEN_PREVIEW_KEY)。ここを書き換えるだけで流し方が変わる
const RHYTHM_HELL_STORY_TRIGGER = 'release';
// 助手とおしゃべりのお話「話せるようになった日」(2026-10-14・新しいキー。既存のキーには触らない・CLAUDE.md ⑦)。
// 公開(RELEASE_FLAGS.assistantChat)のあとの最初の HOME で1回だけ流す。デバッグから見たぶんは立てない
const ASSISTANT_CHAT_STORY_SEEN_KEY = 'mh_story_assistant_chat_seen_v1';
const ASSISTANT_CHAT_STORY_ID = 'assistant_chat_story';
// あつの加入のお話(2026-10-22)。id は data/assistants.js の ASSISTANT_UNLOCK_STORIES.atsu と同じ
const ATSU_JOIN_STORY_ID = 'atsu_join_2026_10_22';
// きゅうこの加入のお話(2026-10-22)。id は data/assistants.js の EVENT_REPLAYS と data/breeder.js の KYUKO_JOIN_STORY_ID_FOR_SHOP と同じ
const KYUKO_JOIN_STORY_ID = 'kyuko_join_2026_10_22';
// ソラシドの加入のお話(2026-10-27)。id は data/assistants.js の EVENT_REPLAYS と同じ
const SORASHIDO_JOIN_STORY_ID = 'sorashido_join_2026_10_27';
// えるびんの加入のお話(2026-11-05・公開の印 assistantErubin)
const ERUBIN_JOIN_STORY_ID = 'erubin_join_2026_11';
// レジェンドブリーダーへの招待状(2026-11-05 社長)。ブリーダーレベル1000(LEGEND_BREEDER_PASS_LEVEL)に届いた人の HOME で一度だけ流す。
// 見た印は新しいキー(既存のキーには触らない・CLAUDE.md ⑦)。最後まで見ても飛ばしても立つ。立っている人だけ、ビートP交換所の3つの交換が優待パス還元になる
const LEGEND_BREEDER_PASS_STORY_ID = 'legend_breeder_pass_2026_11';
const LEGEND_BREEDER_PASS_SEEN_KEY = 'mh_beat_shop_vip_letter_seen_v1';
// ヘルプの本文のうち、その端末で条件を満たした人だけに見せるもの(本文のかたまりの playerFlag・2026-11-05)。
// releaseFlag は全員いっしょの公開の印で、読み込みのときに一度だけ絞り込む。こちらは描くたびに見る(本体が印を読んだら書きかえる)
const HELP_PLAYER_FLAGS = { legendBreederPass: false };
const helpPlayerFlagOn = (name) => !!name && HELP_PLAYER_FLAGS[name] === true;
// 個人杯のお話(2026-10-31)。id は data/assistants.js の EVENT_REPLAYS・CARD_CUP_STORY_ID_FOR_SPLIT と同じ
const CARD_CUP_STORY_ID = 'card_cup_2026_10_31';
// モンヒロビート本オープンの予告のお話と、本オープンのお話(2026-11-07)。id は data/assistants.js の EVENT_REPLAYS と同じ。
// 見たかは、ほかのイベントのお話と同じく mh_rhythm_event_story_v1 の id の並びに足す(新しいキーは作らない)
const RHYTHM_GRAND_OPEN_TEASER_STORY_ID = 'rhythm_grand_open_teaser';
const RHYTHM_GRAND_OPEN_STORY_ID = 'rhythm_grand_open';
// ソラシドの加入のお話を見終えたら、沖縄のおみやげとして 10,000ビートPをギフトで1回だけ届ける(2026-10-27 社長)。
// ★届けたかは新しいキー mh_sorashido_gift_v1 に持つ(ギフトの一覧は古いものから消えるので、それだけでは二重を防げない・CLAUDE.md ⑦)。
// ★イベント回想で見直しても届かない(見た印は最初の1回だけ立ち、届けた印もある)
const SORASHIDO_GIFT_KEY = 'mh_sorashido_gift_v1';
const SORASHIDO_GIFT_BEAT_POINTS = 10000;
const sorashidoJoinGift = () => ({
  id: 'sorashido_join_gift_2026_10_27',
  title: 'ソラシドの沖縄のおみやげ',
  source: 'assistantStory',
  rewards: [{ type: 'beatPoint', amount: SORASHIDO_GIFT_BEAT_POINTS }],
});
// 助手4人がタイプを教えるお話「タクティクスバトル ～4人のタイプ～」(2026-10-18・新しいキー。既存のキーには触らない・CLAUDE.md ⑦)。
// ヘイトとタイプの公開(RELEASE_FLAGS.tacticsHate)のあと、タクティクスバトルの導入のお話を見た人にだけ、最初の HOME で1回流す。デバッグから見たぶんは立てない
const TACTICS_TYPES_STORY_SEEN_KEY = 'mh_story_tactics_types_seen_v1';
const TACTICS_TYPES_STORY_ID = 'tactics_types';
// MFバトルカードのはじまり(2026-10-24・新しいキー。既存のキーには触らない・CLAUDE.md ⑦)。
// 公開(RELEASE_FLAGS.cardBattle)のあとの最初の HOME で1回だけ流す。見た(飛ばしても)ら HOME の入口が出る。デバッグ・回想から見たぶんは立てない
const CARD_BATTLE_INTRO_STORY_SEEN_KEY = 'mh_story_card_battle_seen_v1';
// はじめて遊ぶ人の印(2026-10-27 社長「はじめて遊ぶ人のお話は、続けて流すのを1本まで」)。はじめての案内を通る人にだけ true を書く。
// true の人は、HOME に着くたびにお話を1本だけ流す(残りは HOME を離れて戻ったときに1本ずつ)。前から遊んでいる人には付けない
const STORY_ONE_AT_A_TIME_KEY = 'mh_story_one_at_a_time_v1';
// はじめて遊ぶ人が、最初の本番のバトルを終えたときの印(新しいキー・一度付いたら消さない)。付くまでイベントのお話は自動で流さない(2026-11-11 案3)
const FIRST_BATTLE_DONE_KEY = 'mh_first_battle_done_v1';
// HOME の「つぎにやること」の進み具合(2026-11-11 案4)。はじめての人だけ。数(0=ギフト 1=バトル 2=ミッション 3=終わり)を書き、減らさない・消さない
const FIRST_STEPS_KEY = 'mh_first_steps_v1';
const CARD_BATTLE_INTRO_STORY_ID = 'card_battle_intro_2026';
const normalizeAssistantId = (value) => (typeof assistantIdOrDefault === 'function')
  ? assistantIdOrDefault(typeof value === 'string' ? value : null)
  : ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua');

// ---------- 助手との仲良し度(親密度) ----------
// 遊ぶほど助手と打ち解けていく。段階と呼び方・セリフは data/assistants.js が持ち、
// ここは「どれだけ貯まったか」を数えて端末に残すだけ。
//
// 既存の保存キーには一切触れず、新しいキーへ分けて持つ。読み込みは必ず normalize を
// 通すので、値が無い・壊れている場合もLv1から始まるだけで、ほかのデータには影響しない。
// 放置しても減らない(久しぶりに開いた人が冷たくされないようにするため)。
//
// 【助手ごとに完全に分ける】★重要
// みゅあとききの仲良し度は別のキーへ保存し、片方を進めてももう片方は変わらない。
// みゅあのぶんは今までのキーをそのまま使い続ける(既存プレイヤーの進捗を守るため)。
// 助手を増やしたときは mh_assistant_bond_<id>_v1 が自動で割り当たる。
const ASSISTANT_BOND_KEY = 'mh_assistant_bond_v1';
const assistantBondKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_BOND_KEY : `mh_assistant_bond_${id}_v1`;
};
// そのアシストカードが助手本人のカードなら、その助手のIDを返す(違えばnull)。★重要
// アシストカードのIDと助手のIDは同じ綴り('mua'/'kiki')なので、そのまま本人へ結び付く。
// カード名の文字列で見ると、進化で名前が変わったとき(みゅあの愛→深愛→慈愛)に外れるため、
// 必ずIDで判定する。助手を増やしてもカードIDを合わせておけば、ここは書き換え不要
const assistantIdOfAssistCard = (cardId) => {
  const id = String(cardId == null ? '' : cardId);
  const list = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
  // ★公開の印が立つまでの助手(あつ・2026-10-22)には結び付けない。カード「あつの挑発」は前からあるので、
  //   結び付けると公開前に「あつ」の仲良し度が貯まり、ごほうびのギフトまで届いてしまう(assistantReleased・data/assistants.js)
  if (typeof assistantReleased === 'function' && !assistantReleased(id)) return null;
  return list.some(a => a && a.id === id) ? id : null;
};
// 呼び方の上書きも助手ごとに分ける。みゅあのぶんは今までのキーのまま
const ASSISTANT_CALL_STYLE_KEY = 'mh_assistant_call_style';
const assistantCallStyleKeyFor = (assistantId) => {
  const id = normalizeAssistantId(assistantId);
  return id === ((typeof DEFAULT_ASSISTANT_ID !== 'undefined' && DEFAULT_ASSISTANT_ID) || 'mua')
    ? ASSISTANT_CALL_STYLE_KEY : `mh_assistant_call_style_${id}`;
};
const ASSISTANT_BOND_EMPTY = { points: 0, day: null, daily: {}, dailyTotal: 0 };
const normalizeAssistantBond = (value) => {
  const raw = (value && typeof value === 'object') ? value : {};
  const daily = {};
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [k, v] of Object.entries(raw.daily)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n > 0) daily[k] = n;
    }
  }
  return {
    points: Math.max(0, Math.floor(Number(raw.points) || 0)),
    day: typeof raw.day === 'string' ? raw.day : null,
    daily,
    dailyTotal: Math.max(0, Math.floor(Number(raw.dailyTotal) || 0)),
  };
};
// 行動に応じて仲良し度を増やした結果を返す(渡された値は変えない)。
// 日付が変わっていれば、その日の集計だけをリセットする(貯まった量はそのまま)
// amount … 1回ぶんを呼ぶ側が決めるとき(助手ライフの道具・好みで変わる)。その行動の1回ぶん(action.amount)は超えない
const gainAssistantBond = (state, actionKey, now = Date.now(), amount = null) => {
  const cur = normalizeAssistantBond(state);
  const actions = (typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS) || {};
  const action = actions[actionKey];
  const day = loginBonusPeriodKey(now);
  const sameDay = cur.day === day;
  const daily = sameDay ? { ...cur.daily } : {};
  const dailyTotal = sameDay ? cur.dailyTotal : 0;
  if (!action) return { changed: false, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  const used = Math.max(0, Math.floor(Number(daily[actionKey]) || 0));
  const totalMax = (typeof ASSISTANT_BOND_DAILY_MAX !== 'undefined' && ASSISTANT_BOND_DAILY_MAX) || 30;
  // 「1回ぶん」「その行動の1日ぶん」「1日の合計」の3つのうち、いちばん小さいところで止める
  const base = Math.max(0, Math.floor(Number(action.amount) || 0));
  const once = Number.isFinite(amount) ? Math.min(Math.max(0, Math.floor(amount)), base) : base;
  const gain = Math.min(
    once,
    Math.max(0, Math.floor(Number(action.dailyMax) || 0) - used),
    Math.max(0, totalMax - dailyTotal),
  );
  if (gain <= 0) return { changed: !sameDay, state: { ...cur, day, daily, dailyTotal }, gained: 0 };
  daily[actionKey] = used + gain;
  return { changed: true, state: { points: cur.points + gain, day, daily, dailyTotal: dailyTotal + gain }, gained: gain };
};
const assistantBondLevelOf = (points) => (typeof assistantBondLevel === 'function') ? assistantBondLevel(points) : 1;

// ---------- 仲良し度のLvごとのごほうび(2026-10-21) ----------
// Lvを越えたら、助手ごとに各Lv1回ずつギフトで届ける(量は ASSISTANT_BOND_LEVEL_REWARDS)。
// 届けた印は2つ(どちらも { 助手のid: [Lv, ...] }・CLAUDE.md ⑦)
//   mh_assistant_bond_rewards_v1 … 最初の量(ASSISTANT_BOND_LEVEL_REWARDS_V1・Lv22/25/28/30だけ)を届けた印。★意味は変えない・もう書かない
//   mh_assistant_bond_rewards_v2 … 今の量を届けた印。v1 の印がある節目は、今の量との差のぶんだけを「追加ぶん」で届けて、この印を付ける
// ★ギフトは受け取ったあと一覧から消えることがあるので、ギフトのidだけでなく印で二重を防ぐ
const ASSISTANT_BOND_REWARDS_KEY = 'mh_assistant_bond_rewards_v1';
const ASSISTANT_BOND_REWARDS_V2_KEY = 'mh_assistant_bond_rewards_v2';
const normalizeAssistantBondRewardsDelivered = (value) => {
  const raw = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const out = {};
  for (const [id, levels] of Object.entries(raw)) {
    if (!Array.isArray(levels)) continue;
    const list = [...new Set(levels.map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    if (list.length) out[id] = list;
  }
  return out;
};
// 最初の量のギフトのid(#3241)。今の量は _v2、差のぶんは _topup
const assistantBondRewardGiftId = (assistantId, level) => `gift_assistant_bond_${assistantId}_lv${level}`;
const assistantBondRewardV2GiftId = (assistantId, level, topup = false) => `gift_assistant_bond_v2_${assistantId}_lv${level}${topup ? '_topup' : ''}`;
// 今の量から、もう渡した量を引いた残り(品ごと)。もう渡した量のほうが多い品は0にする(取り上げない)
const assistantBondRewardRemainder = (next, given) => {
  const keyOf = (r) => `${r && r.type}:${(r && r.itemId) || ''}`;
  const had = {};
  for (const r of (Array.isArray(given) ? given : [])) had[keyOf(r)] = (had[keyOf(r)] || 0) + Math.max(0, Math.floor(Number(r && r.amount) || 0));
  return (Array.isArray(next) ? next : [])
    .map(r => ({ ...r, amount: Math.max(0, Math.floor(Number(r.amount) || 0) - (had[keyOf(r)] || 0)) }))
    .filter(r => r.amount > 0);
};
// まだ届けていないLvのぶんをギフトへ足した結果を返す(渡された値は変えない)。
//   delivered: v1 の印(読むだけ) / deliveredV2: v2 の印 / levels: { 助手のid: いまのLv }
// 戻り値の changed が true のときだけ、gifts と deliveredV2 を一緒に保存する
const buildAssistantBondRewardGrant = ({ gifts, delivered, deliveredV2, levels, now = Date.now() } = {}) => {
  const table = (typeof ASSISTANT_BOND_LEVEL_REWARDS !== 'undefined' && ASSISTANT_BOND_LEVEL_REWARDS) || {};
  const tableV1 = (typeof ASSISTANT_BOND_LEVEL_REWARDS_V1 !== 'undefined' && ASSISTANT_BOND_LEVEL_REWARDS_V1) || {};
  const milestones = Object.keys(table).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const list = (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS)) ? ASSISTANTS : [];
  let nextGifts = Array.isArray(gifts) ? gifts : [];
  const v1 = normalizeAssistantBondRewardsDelivered(delivered);
  const nextDelivered = normalizeAssistantBondRewardsDelivered(deliveredV2);
  const granted = [];
  let changed = false;
  for (const who of list) {
    const id = who && who.id;
    if (!id) continue;
    const level = Math.floor(Number(levels && levels[id]) || 0);
    for (const lv of milestones) {
      if (lv > level || (nextDelivered[id] || []).includes(lv)) continue;
      // 最初の量をもう受け取っている(印がある・ギフトが残っている)なら、差のぶんだけ
      const topup = !!tableV1[lv] && ((v1[id] || []).includes(lv) || nextGifts.some(g => g && g.id === assistantBondRewardGiftId(id, lv)));
      const rewards = topup ? assistantBondRewardRemainder(table[lv], tableV1[lv]) : table[lv].map(r => ({ ...r }));
      const mark = () => { nextDelivered[id] = [...(nextDelivered[id] || []), lv].sort((a, b) => a - b); changed = true; };
      if (!rewards.length) { mark(); continue; }
      const gift = {
        id: assistantBondRewardV2GiftId(id, lv, topup),
        source: 'assistantBond',
        title: topup ? `${who.name}との仲良し度 Lv${lv} のごほうび(追加ぶん)` : `${who.name}との仲良し度 Lv${lv} のごほうび`,
        description: topup
          ? `ごほうびの量が増えたので、前に受け取ったぶんとの差をお届けします。`
          : `${who.name}との仲良し度が Lv${lv} になりました。いつもありがとう！`,
        rewards,
      };
      const already = nextGifts.some(g => g && g.id === gift.id);
      const grant = grantGiftOnce(nextGifts, gift, now);
      // 中身が読めない(古い版で品物が無いなど)ときは印を付けず、次に読めたときに届ける
      if (!grant.granted && !already) continue;
      if (grant.granted) { nextGifts = grant.gifts; granted.push({ assistantId:id, level:lv, topup }); }
      mark();
    }
  }
  return { changed, gifts:nextGifts, deliveredV2:nextDelivered, granted };
};

const normalizeLoginBonus = (value) => ({
  currentDay: Number.isInteger(value?.currentDay) && value.currentDay >= 1 && value.currentDay <= 7 ? value.currentDay : 1,
  lastGrantedPeriod: typeof value?.lastGrantedPeriod === 'string' ? value.lastGrantedPeriod : null,
  totalLoginDays: Math.max(0, Math.floor(Number(value?.totalLoginDays) || 0)),
});
const grantLoginBonus = (loginBonus, gifts, now=Date.now()) => {
  const state = normalizeLoginBonus(loginBonus);
  const period = loginBonusPeriodKey(now);
  // 同一期間に加え、端末時計が前回より過去へ戻った場合も配布しない。
  if (state.lastGrantedPeriod && period <= state.lastGrantedPeriod) return { granted:false, loginBonus:state, gifts:Array.isArray(gifts)?gifts:[] };
  const day = state.currentDay;
  const createdAt = new Date(now).toISOString();
  const gift = { id:`gift_login_${period}`, source:'loginBonus', title:`ログインボーナス ${day}日目`, description:'ログインボーナスです。', rewards:LOGIN_BONUS_REWARDS[day-1].map(r=>({...r})), createdAt, expiresAt:new Date(Number(now)+30*24*60*60*1000).toISOString(), claimedAt:null };
  const list = Array.isArray(gifts) ? gifts : [];
  // 期間由来の固定IDでも重複を防ぐ。既に存在する場合は進捗だけを勝手に進めない。
  if (list.some(item=>item?.id===gift.id)) return { granted:false, loginBonus:{...state,lastGrantedPeriod:period}, gifts:list };
  return { granted:true, day, gift, gifts:[gift,...list], loginBonus:{ currentDay:day===7?1:day+1, lastGrantedPeriod:period, totalLoginDays:state.totalLoginDays+1 } };
};
// 不具合のお詫びとして、起動時に1度だけギフトボックスへ送る配布物。
// 受け取り方は通常のギフトと同じ(期限内に「受け取る」を押す)。
// idが既にギフト一覧にあれば配らないので、受取済み・未受取のどちらでも二重には届かない。
// 追加するときは新しいidで足す。過去の項目は消さない(消すと再配布されてしまうため)。
const COMPENSATION_GIFTS = [
  {
    id: 'gift_compensation_20260731_battle',
    title: 'お詫びのしるし',
    description: 'バトルが進行できなくなる不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'diamond', amount:1000 },
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260801_points',
    title: 'お詫びのしるし',
    description: 'ログインボーナスの報酬が、ブリーダー経験値ではなくブリーダーポイントになっていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketJo', amount:1 },
      { type:'skipTicketHa', amount:1 },
      { type:'skipTicketKyu', amount:1 },
    ],
  },
  {
    id: 'gift_compensation_20260823_skip',
    title: 'お詫びのしるし',
    description: 'クイックモードの報酬方針を「プシュケー優先」「ダイヤ優先」にしたままスキップすると、経験値も絆経験値も入らないままチケットだけ減っていた不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'skipTicketKyu', amount:5 },
    ],
  },
  {
    id: 'gift_compensation_20260807_dye',
    title: 'お詫びのしるし',
    description: 'アークの染色で、色が入らなかったり濃く出すぎたりしていた不具合のお詫びです。染めなおしにお使いください。ご迷惑をおかけしました。',
    rewards: [
      { type:'dyeMock', amount:5 },
    ],
  },
];
// 【一度きりの付け替え】ログインボーナス4日目の「100」は、もともとブリーダー経験値の
// つもりだったのに、報酬の種類をブリーダーポイント(pt)にしていたため使い道のないptが
// 大量に配られていた。すでに受け取ってしまったぶんを「経験値が入っていた」形へ寄せる。
//
//   ・受け取り済みのログインボーナスのギフトから、ptで配ってしまった量を数える
//   ・その量だけptを減らし(持っている以上には減らさない)、同じ量の経験値を足す
//   ・専用のフラグ(mh_login_pt_to_xp_v1)を持たせ、二度は行わない
const LOGIN_PT_TO_XP_KEY = 'mh_login_pt_to_xp_v1';
const MISTAKEN_LOGIN_PT = 100;   // ログインボーナス4日目で配ってしまっていた量
const mistakenLoginPoints = (gifts) => (Array.isArray(gifts) ? gifts : [])
  .filter(g => g?.source === 'loginBonus' && g.claimedAt && Array.isArray(g.rewards))
  .reduce((sum, g) => sum + g.rewards
    .filter(r => r?.type === 'breederPoint' && Math.floor(Number(r.amount)) === MISTAKEN_LOGIN_PT)
    .reduce((a, r) => a + Math.floor(Number(r.amount)), 0), 0);
// 付け替えた結果を返す(渡された値は変えない)。
// ptは持っている以上には減らさず、経験値は配られるはずだった量をそのまま足す
const applyLoginPointFix = (points, xp, gifts) => {
  const wrong = mistakenLoginPoints(gifts);
  const nowPoints = Math.max(0, Math.floor(Number(points) || 0));
  const nowXp = Math.max(0, Math.floor(Number(xp) || 0));
  if (wrong <= 0) return { changed:false, points:nowPoints, xp:nowXp, moved:0 };
  const moved = Math.min(wrong, nowPoints);
  return { changed:true, points:nowPoints - moved, xp:nowXp + wrong, moved, granted:wrong };
};

// ===== 受け取り済みのギフトを積もらせない =====
// ★受け取り済みは消す仕組みが無く、8月からの全部が残っていた
//   (2026-09-21・書き出したセーブの実測で mh_gifts は331件122,271文字。
//    うち328件・129,500文字が受け取り済みで、ミッション報酬が274件を占めていた)。
//   保存データが localStorage の上限へ近づくと、**ダイヤ1つの保存すら効かなくなる**ため、
//   受け取り済みの控えは新しいものだけ残す。報酬はすでに配り終えているので、
//   消えるのは「受取済み」タブに並ぶ記録だけ。
// ★ログインボーナスと補償は消さない。一度きりの付け替え(mistakenLoginPoints)が
//   受け取り済みのログインボーナスを数えており、消すと数え直せなくなる。
const GIFT_HISTORY_LIMIT = 50;
const GIFT_HISTORY_KEEP_SOURCES = Object.freeze(['loginBonus', 'compensation']);
const giftHistoryPrunable = (gift) => !!gift?.claimedAt && !GIFT_HISTORY_KEEP_SOURCES.includes(gift?.source);
const pruneGiftHistory = (gifts, limit = GIFT_HISTORY_LIMIT) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const prunable = list.filter(giftHistoryPrunable);
  if (prunable.length <= limit) return list;
  const claimedAtOf = (gift) => Date.parse(gift?.claimedAt || '') || 0;
  const keep = new Set(prunable.slice().sort((a, b) => claimedAtOf(b) - claimedAtOf(a)).slice(0, limit));
  return list.filter(gift => !giftHistoryPrunable(gift) || keep.has(gift));
};

// ===== はじめての人には、7〜8月の不具合のお詫びを配らない(2026-10-09・社長の選択) =====
// お詫びは、その時期に遊んでいた人だけのもの。これからはじめる人は不具合に遭っていないので、
// 最初のギフトボックスにお詫びが4通並ぶのをやめ、同じ中身の合計を「プレオープン記念」へ足す。
// ・配らなかったidは COMPENSATION_WAIVED_KEY(新しいキー)へ控える。控えが無いと、はじめての設定を終えた次の起動で
//   「idが無い」とみなして配ってしまう。既存の保存キーは変えず、既にギフトにあるidは控えに入れない(取り上げない)
// ・控えるのは下のidだけ。これから足すお詫び(新しいid)は、はじめての人にも普通に届く
const COMPENSATION_WAIVED_KEY = 'mh_compensation_waived_v1';
const NEW_PLAYER_WAIVED_COMPENSATION_IDS = Object.freeze([
  'gift_compensation_20260731_battle',
  'gift_compensation_20260801_points',
  'gift_compensation_20260823_skip',
  'gift_compensation_20260807_dye',
]);
const normalizeWaivedCompensationIds = (value) => (Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && id))] : []);
// 配らないと決めたお詫びのうち、まだギフトボックスに無いもの(=控えに足すもの)
const compensationIdsToWaive = (gifts, waivedIds) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const waived = normalizeWaivedCompensationIds(waivedIds);
  return NEW_PLAYER_WAIVED_COMPENSATION_IDS.filter(id => !waived.includes(id) && !list.some(item => item?.id === id));
};
// 控えたお詫びのうち、ギフトボックスに無いものの報酬を、種類ごとに合計する(プレオープン記念へ足す分)
const waivedCompensationRewards = (gifts, waivedIds) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const waived = normalizeWaivedCompensationIds(waivedIds);
  const totals = new Map();
  COMPENSATION_GIFTS
    .filter(def => NEW_PLAYER_WAIVED_COMPENSATION_IDS.includes(def.id) && waived.includes(def.id) && !list.some(item => item?.id === def.id))
    .forEach(def => def.rewards.forEach(r => totals.set(r.type, (totals.get(r.type) || 0) + Math.floor(Number(r.amount) || 0))));
  return [...totals.entries()].map(([type, amount]) => ({ type, amount }));
};
const grantCompensationGifts = (gifts, now=Date.now(), waivedIds=[]) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const waived = normalizeWaivedCompensationIds(waivedIds);
  const missing = COMPENSATION_GIFTS.filter(def => !waived.includes(def.id) && !list.some(item => item?.id === def.id));
  if (missing.length === 0) return { granted:false, gifts:list };
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(Number(now) + 30*24*60*60*1000).toISOString();
  const added = missing.map(def => ({ ...def, source:'compensation', rewards:def.rewards.map(r=>({...r})), createdAt, expiresAt, claimedAt:null }));
  return { granted:true, gifts:[...added, ...list] };
};

// ===== その人だけに届くお詫び(2026-09-21) =====
//
// 不具合の影響が特定の人にだけ出たときのための配布。全員へ配る COMPENSATION_GIFTS とは
// 別に、タイトル画面に出している PLAYER ID(mh_player_id)が一致した端末にだけ届ける。
//
// 【なぜIDを見て配るか】セーブデータは端末の中にしかなく、こちらから送り込む手段がない。
// ゲーム側で「自分が対象か」を確かめて、自分のギフトボックスへ入れてもらう形にする。
// 【限界】対象IDはソースに書くので、端末の保存値を書き換えれば対象外の人でも受け取れる。
// 金額が大きいものを配るときは承知のうえで使うこと(2026-09-21・ユーザー了解済み)。
// 【期限は付けない】受け取りそこねると取り返しがつかないので expiresAt を書かない。
// 【項目は消さない】消すと、まだ受け取っていない端末へ再び配られてしまう。
// 【IDは端末ごと】機種変すると別IDになり届かなくなる。届いたかは本人に確かめる。
const PLAYER_COMPENSATION_GIFTS = [
  {
    id: 'gift_player_compensation_20260921_rebirth_xp',
    // 【読み違いに注意】3文字目は 0(ゼロ)ではなく O(大文字のオー)。タイトル画面の
    // 等幅フォントはゼロに斜線が入るので、その有無で見分ける(2026-09-21に取り違えて配れなかった)
    playerIds: ['MH-O65J-BWBP'],
    title: 'お詫びのしるし',
    description: '転生200回ぶんの経験値が失われる不具合のお詫びです。ご迷惑をおかけしました。',
    rewards: [
      { type:'diamond', amount:200000000 },
    ],
  },
];
// PLAYER ID は大文字の決まった形で作っているが、読み違いを避けるため前後の空白と
// 大小の違いは吸収して見比べる。値が無い・文字列でないときは空文字にする(=対象外)。
const normalizePlayerIdForGift = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');
// 対象のPLAYER IDと一致したときだけ、まだ届いていないお詫びをギフト一覧の先頭へ足す。
// idが既にあれば足さないので、受取済み・未受取のどちらでも二重には届かない。
const grantPlayerCompensationGifts = (gifts, playerId, now=Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  const id = normalizePlayerIdForGift(playerId);
  if (!id) return { granted:false, gifts:list };
  const missing = PLAYER_COMPENSATION_GIFTS.filter(def =>
    (Array.isArray(def.playerIds) ? def.playerIds : []).some(target => normalizePlayerIdForGift(target) === id)
    && !list.some(item => item?.id === def.id));
  if (missing.length === 0) return { granted:false, gifts:list };
  const createdAt = new Date(now).toISOString();
  // playerIds は配る相手を決めるためだけのもの。保存するギフトには持たせない
  const added = missing.map(({ playerIds, ...def }) => ({ ...def, source:'compensation', rewards:def.rewards.map(r=>({...r})), createdAt, claimedAt:null }));
  return { granted:true, gifts:[...added, ...list] };
};
// ---------- モンヒロビート プレオープン記念 新規プレイヤーキャンペーン ----------
// 今回のアップデート以降にはじめてMonster Heroを始めた人へ、1回だけ配る。
// すでに遊んでいた人には配らない(これが最重要。ここを間違えると全員へ配ってしまう)。
//
// 【新規かどうかの見分け方】
// 「キャンペーンの保存キーを持っていない」だけで決めてはいけない。新しく始めた人も
// 既存の人も、アップデート直後はどちらも持っていないため。既存の判定(mh_onboarded)で
// 「はじめての設定をこれから通る人」だけを対象にする。実際の発行は、その設定を
// 終えた瞬間(finishOnboarding)にだけ行う。
//
// 【二重に配らないための決まり】
// 配布済みフラグ(CAMPAIGN_KEY)だけに頼らず、ギフト側に同じidが無いかも必ず見る。
// ギフトを足したあとフラグを保存する前に閉じられても、次に開いたときidで気づける。
// idは固定。ランダムに作らないこと(作ると毎回「まだ無い」と判断してしまう)。
//
// 【受取期限】
// ユーザーからの指定が無いので付けない(expiresAtを書かない＝期限なし)。
const NEW_PLAYER_CAMPAIGN_ENABLED = true;   // 後からOFFにできるようにしておく
const NEW_PLAYER_CAMPAIGN_KEY = 'mh_monhiro_beat_preopen_new_player_campaign_v1';
const NEW_PLAYER_CAMPAIGN_GIFT = Object.freeze({
  id: 'monhiro_beat_preopen_new_player_v1',
  title: 'モンヒロビート プレオープン記念',
  description: '新規プレイヤーキャンペーンのプレゼントです。モンヒロビートのプレオープンを記念して、はじめた方へお贈りします。',
  rewards: [
    { type:'diamond', amount:100000 },
    { type:'rainbowPsyche', amount:100 },
  ],
});
// 本オープン記念(2026-11-07 社長「大盛り」)。RHYTHM_GRAND_OPEN_RELEASE が真のあいだ、上の代わりに配る。
// 配らなかったお詫び(ダイヤ1,000・スキップ序2/破2/急7・染色もどき5)を足した合計が
// ダイヤ150,000・虹のプシュケー150・スキップ序3/破3/急10・セッション券10・性格のたね3・染色もどき5 になるようにしてある。
// 配った印(NEW_PLAYER_CAMPAIGN_KEY)は同じものを使う(プレオープン記念をもらった人には届かない)
const NEW_PLAYER_CAMPAIGN_GIFT_GRAND = Object.freeze({
  id: 'monhiro_beat_grand_open_new_player_v1',
  title: 'モンヒロビート 本オープン記念',
  description: '新規プレイヤーキャンペーンのプレゼントです。モンヒロビートの本オープンを記念して、はじめた方へお贈りします。',
  rewards: [
    { type:'diamond', amount:149000 },
    { type:'rainbowPsyche', amount:150 },
    { type:'skipTicketJo', amount:1 },
    { type:'skipTicketHa', amount:1 },
    { type:'skipTicketKyu', amount:3 },
    { type:'gameItem', itemId:'session_ticket', amount:10 },
    { type:'gameItem', itemId:'buddy_trait_seed', amount:3 },
  ],
});
// 本オープンの印を読む。検査はこのあたりだけを切り出して動かすので、印が見えなくても落ちないよう typeof で守る(見えなければ偽)
// 2026-11-08: 開始時刻(RHYTHM_GRAND_OPEN_START_AT)を過ぎてから真。now を渡すと、その時刻で見る(検査用)
const rhythmGrandOpenReleased = (now = Date.now()) => { try { return typeof RHYTHM_GRAND_OPEN_RELEASE !== 'undefined' && RHYTHM_GRAND_OPEN_RELEASE === true
  && typeof RHYTHM_GRAND_OPEN_START_AT !== 'undefined' && Number(now) >= Date.parse(RHYTHM_GRAND_OPEN_START_AT); } catch (e) { return false; } };
const newPlayerCampaignGiftDef = () => (rhythmGrandOpenReleased() ? NEW_PLAYER_CAMPAIGN_GIFT_GRAND : NEW_PLAYER_CAMPAIGN_GIFT);
// ギフト一覧へ1件足す。すでに同じidがあれば何もしない(何度呼んでも増えない)
// extraRewards … 配らなかったお詫びの合計(waivedCompensationRewards)。同じ種類は数を足し、新しい種類は並べる
const grantNewPlayerCampaignGift = (gifts, now=Date.now(), extraRewards=[]) => {
  const list = Array.isArray(gifts) ? gifts : [];
  if (!NEW_PLAYER_CAMPAIGN_ENABLED) return { granted:false, gifts:list };
  const def = newPlayerCampaignGiftDef();
  // プレオープン記念と本オープン記念のどちらかが届いていれば、もう足さない
  if (list.some(item => item?.id === NEW_PLAYER_CAMPAIGN_GIFT.id || item?.id === NEW_PLAYER_CAMPAIGN_GIFT_GRAND.id)) return { granted:false, gifts:list };
  const rewards = def.rewards.map(r=>({...r}));
  (Array.isArray(extraRewards) ? extraRewards : []).forEach(extra => {
    const amount = Math.floor(Number(extra?.amount) || 0);
    if (!extra?.type || amount <= 0) return;
    // アイテムをidで持つ報酬(gameItem)には足さない(お詫びに gameItem は無いが、混ざらないように)
    const same = extra.type === 'gameItem' ? null : rewards.find(r => r.type === extra.type && !r.itemId);
    if (same) same.amount += amount; else rewards.push({ type:extra.type, amount });
  });
  const gift = {
    ...def,
    source: 'campaign',
    rewards,
    createdAt: new Date(now).toISOString(),
    claimedAt: null,
  };
  return { granted:true, gifts:[gift, ...list] };
};

// ===== 本オープン記念ギフト(すでに遊んでいる人全員へ1回だけ・2026-11-07 社長「推奨でダイヤは1000万」) =====
// RHYTHM_GRAND_OPEN_RELEASE が真になってから、起動したときに1回だけギフトボックスへ足す。
// 【二重に配らない】新しいキー GRAND_OPEN_ALL_GIFT_KEY と、ギフト側の同じidの両方を見る(idは固定)。
// 【新しく始めた人には配らない】本オープン記念の新規プレゼントを配ったときに、同じキーを立てる(新規の大盛りと重ねない)。
// 【受取期限なし】受け取りそこねると取り返しがつかないので expiresAt を書かない
const GRAND_OPEN_ALL_GIFT_KEY = 'mh_rhythm_grand_open_gift_v1';
const GRAND_OPEN_ALL_GIFT = Object.freeze({
  id: 'monhiro_beat_grand_open_all_v1',
  title: 'モンヒロビート 本オープン記念',
  description: 'モンヒロビートの本オープンを記念して、遊んでくださっている皆さんへお贈りします。いつもありがとうございます。',
  rewards: [
    { type:'diamond', amount:10000000 },
    { type:'rainbowPsyche', amount:150 },
    { type:'skipTicketJo', amount:3 },
    { type:'skipTicketHa', amount:3 },
    { type:'skipTicketKyu', amount:10 },
    { type:'dyeMock', amount:5 },
    { type:'gameItem', itemId:'session_ticket', amount:10 },
    { type:'gameItem', itemId:'buddy_trait_seed', amount:3 },
  ],
});
// 配るか(戻り値 { granted, gifts })。done は GRAND_OPEN_ALL_GIFT_KEY の値。onboarded は はじめての設定を終えているか
const grantGrandOpenAllGift = (gifts, { done = false, onboarded = false } = {}, now = Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  if (!rhythmGrandOpenReleased() || done === true || onboarded !== true) return { granted:false, gifts:list };
  if (list.some(item => item?.id === GRAND_OPEN_ALL_GIFT.id || item?.id === NEW_PLAYER_CAMPAIGN_GIFT_GRAND.id)) return { granted:false, gifts:list };
  const gift = { ...GRAND_OPEN_ALL_GIFT, source:'campaign', rewards:GRAND_OPEN_ALL_GIFT.rewards.map(r=>({...r})), createdAt:new Date(now).toISOString(), claimedAt:null };
  return { granted:true, gifts:[gift, ...list] };
};

// ===== ゲーム内アイテムをそのまま入れられるギフト(2026-09-14) =====
//
// 2026-09-14・ユーザー指摘「イベント報酬が直接アイテム欄に入ってた / ギフト経由して」。
// モンヒロビートの報酬(超越の実の種族ぶん・勇者の証・勇者の証片)をギフトで届けたいが、
// 種族の数だけ GIFT_REWARD_LABELS へ書き足すと、モンスターが増えるたびに書き漏らす。
// そこで**アイテムのidをそのまま持つ1種類**を足した。名前は実データから引くので、
// ここにアイテム名を書き写さない。
//
// ★既存のギフト(diamond / rainbowPsyche など)の形は何も変えていない。
//   古い保存(mh_gifts)はそのまま読めるし、書き方も今までどおりでよい(CLAUDE.md ⑦)。
const GIFT_ITEM_REWARD_TYPE = 'gameItem';
// プロフィールフレームを届ける報酬(2026-10-20・ハロウィン・妖)。{ type:'profileFrame', frameId } で、数は1枚に決まっている。
// 受け取ると mh_profile_frame_owned_v1 へ足す(ほかの手に入れ方と同じ入れ物)。知らない・未公開の枠のときはギフトごと無効にする。
// ★この種類を知らない古い版では「受け取れないギフト」として残るだけで、ほかのギフトや保存は壊れない
const GIFT_FRAME_REWARD_TYPE = 'profileFrame';
const giftFrameRewardInfo = (frameId) => {
  const frame = typeof profileFrameById === 'function' ? profileFrameById(frameId) : null;
  return frame && frame.released === true ? frame : null;
};
// そのidのアイテムの名前と絵文字。知らないidでは null を返し、ギフトごと無効にする
// (知らないものを黙って配らない)
const giftItemRewardInfo = (itemId) => {
  const id = typeof itemId === 'string' ? itemId : '';
  if (!id) return null;
  if (typeof HERO_PROOF_ITEM !== 'undefined' && id === HERO_PROOF_ITEM.id) return HERO_PROOF_ITEM;
  if (typeof HERO_PROOF_SHARD_ITEM !== 'undefined' && id === HERO_PROOF_SHARD_ITEM.id) return HERO_PROOF_SHARD_ITEM;
  if (typeof RAINBOW_TRANSCEND_FRUIT_ITEM !== 'undefined' && id === RAINBOW_TRANSCEND_FRUIT_ITEM.id) return RAINBOW_TRANSCEND_FRUIT_ITEM;
  if (typeof SOUL_CRYSTAL_ITEM !== 'undefined' && id === SOUL_CRYSTAL_ITEM.id) return SOUL_CRYSTAL_ITEM;
  if (typeof speciesTranscendFruitItems === 'function') {
    const found = Object.values(speciesTranscendFruitItems()).find(item => item && item.id === id);
    if (found) return found;
  }
  const market = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [];
  return market.find(item => item && item.type === 'item' && item.id === id) || null;
};
// ギフト一覧へ1件足す。すでに同じidがあれば何もしない(二重に配らない・CLAUDE.md ⑦)。
// 報酬の中身は normalizeGiftRewards を通せる形でなければ足さない(壊れたギフトを残さない)
const grantGiftOnce = (gifts, gift, now = Date.now()) => {
  const list = Array.isArray(gifts) ? gifts : [];
  if (!gift || typeof gift.id !== 'string' || !gift.id) return { granted:false, gifts:list };
  if (list.some(item => item?.id === gift.id)) return { granted:false, gifts:list };
  const next = { ...gift, createdAt:new Date(now).toISOString(), claimedAt:null };
  if (!normalizeGiftRewards(next)) return { granted:false, gifts:list };
  return { granted:true, gifts:[next, ...list] };
};

const normalizeGiftRewards = (gift) => {
  if (!gift || !Array.isArray(gift.rewards) || gift.rewards.length === 0) return null;
  const supported = Object.keys(GIFT_REWARD_LABELS);
  const rewards = gift.rewards.map(r => (r?.type === GIFT_ITEM_REWARD_TYPE
    ? { type:GIFT_ITEM_REWARD_TYPE, itemId:(typeof r?.itemId === 'string' ? r.itemId : ''), amount:Math.floor(Number(r?.amount)) }
    : r?.type === GIFT_FRAME_REWARD_TYPE
      ? { type:GIFT_FRAME_REWARD_TYPE, frameId:(typeof r?.frameId === 'string' ? r.frameId : ''), amount:1 }
      : { type:r?.type, amount:Math.floor(Number(r?.amount)) }));
  return rewards.every(r => (r.type === GIFT_ITEM_REWARD_TYPE ? !!giftItemRewardInfo(r.itemId)
    : r.type === GIFT_FRAME_REWARD_TYPE ? !!giftFrameRewardInfo(r.frameId) : supported.includes(r.type))
    && Number.isFinite(r.amount) && r.amount > 0) ? rewards : null;
};
// 受取期限。expiresAt を書いていないギフトは「期限なし(ずっと受け取れる)」として扱う。
// ログインボーナス・お詫び・ミッションの3つは必ず30日の期限を入れているので、
// ここを通る既存のギフトの扱いは何も変わらない。
// 値が入っていて読めない(壊れている)ときは、これまでどおり期限切れのままにする
const giftIsExpired = (gift, now=Date.now()) => {
  if (!gift) return true;
  if (gift.expiresAt == null) return false;
  const at = Date.parse(gift.expiresAt);
  return !Number.isFinite(at) || at <= Number(now);
};
// 「今すぐ受け取れるギフト」。未受取・期限内・報酬が有効、の3つを満たすもの。
// HOMEの通知バッジ・ギフト画面のバッジ・「すべて受け取る」が同じ判定を使う
const giftIsClaimable = (gift, now=Date.now()) => !!gift && !gift.claimedAt && !giftIsExpired(gift, now) && !!normalizeGiftRewards(gift);
const giftClaimableCount = (gifts, now=Date.now()) => (Array.isArray(gifts) ? gifts : []).filter(g => giftIsClaimable(g, now)).length;
// 受け取ったギフトの報酬を、種類(品物は品物ごと)に合計する。「手に入れたもの」の窓に出す。
// 読むだけで、保存や所持数には触れない。まとめて受け取ったときも1つの一覧になる
const summarizeClaimedGiftRewards = (gifts) => {
  const totals = new Map();
  (Array.isArray(gifts) ? gifts : []).forEach(gift => {
    (normalizeGiftRewards(gift) || []).forEach(reward => {
      const key = reward.type === GIFT_ITEM_REWARD_TYPE ? `${reward.type}:${reward.itemId}` : reward.type === GIFT_FRAME_REWARD_TYPE ? `${reward.type}:${reward.frameId}` : reward.type;
      const prev = totals.get(key);
      totals.set(key, prev ? { ...prev, amount:prev.amount + reward.amount } : { ...reward });
    });
  });
  return [...totals.values()];
};
const buildGiftClaim = (gift, balances, now=Date.now()) => {
  if (!gift || gift.claimedAt || giftIsExpired(gift, now)) return { ok:false, reason:gift?.claimedAt?'claimed':'expired' };
  const rewards = normalizeGiftRewards(gift);
  if (!rewards) return { ok:false, reason:'invalidReward' };
  const next = { gold:Math.max(0,Number(balances?.gold)||0), breederPoints:Math.max(0,Number(balances?.breederPoints)||0), breederXp:Math.max(0,Number(balances?.breederXp)||0), ownedItems:{...(balances?.ownedItems||{})},
    // フレームの報酬があるときだけ使う(持っていなければ足す。持っていれば何もしない)
    ownedProfileFrames:Array.isArray(balances?.ownedProfileFrames)?[...balances.ownedProfileFrames]:[],
    // ビートP(2026-10-27 ソラシドのおみやげ)。受け取る側が保存から読んだ残高を渡す
    beatPoints:Math.max(0,Math.floor(Number(balances?.beatPoints))||0),
    // カードパック券(2026-11-08)。受け取る側が保存(mh_card_tactics_v1 の tickets)から読んだ枚数を渡す
    cardPackTickets:Math.max(0,Math.floor(Number(balances?.cardPackTickets))||0) };
  // 虹の超越の実は既存の RAINBOW_TRANSCEND_FRUIT_ITEM_ID と同じ保存ID。
  const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', uniqueSkillResetTicket:'unique_skill_reset_ticket', rainbowPsyche:'rainbow_psyche', rainbowTranscendFruit:'transcend_fruit_rainbow', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l', skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu' };
  rewards.forEach(({type,itemId,frameId,amount})=>{ if(type===GIFT_FRAME_REWARD_TYPE){ if(!next.ownedProfileFrames.includes(frameId)) next.ownedProfileFrames.push(frameId); return; } if(type==='diamond') next.gold+=amount; else if(type==='breederPoint') next.breederPoints+=amount; else if(type==='breederXp') next.breederXp+=amount; else if(type==='beatPoint') next.beatPoints+=amount; else if(type==='cardPackTicket') next.cardPackTickets+=amount; else { const id=type===GIFT_ITEM_REWARD_TYPE?itemId:itemIds[type]; next.ownedItems[id]=(next.ownedItems[id]||0)+amount; } });
  return { ok:true, balances:next, gift:{...gift,claimedAt:new Date(now).toISOString()} };
};
const giftRewardText = (reward) => {
  if (reward && reward.type === GIFT_FRAME_REWARD_TYPE) {
    const frame = giftFrameRewardInfo(reward.frameId);
    return `🖼️ プロフィールフレーム「${frame ? frame.name : reward.frameId}」`;
  }
  if (reward && reward.type === GIFT_ITEM_REWARD_TYPE) {
    const info = giftItemRewardInfo(reward.itemId);
    const name = info ? `${info.emoji ? `${info.emoji} ` : ''}${info.name}` : reward.itemId;
    return `${name} ×${Number(reward.amount).toLocaleString()}`;
  }
  return `${GIFT_REWARD_LABELS[reward.type] || reward.type} ×${Number(reward.amount).toLocaleString()}`;
};
const giftTitleDisplay = (gift) => {
  const fallback = '名称なしギフト';
  const title = typeof gift?.title === 'string' && gift.title.trim() ? gift.title.trim() : fallback;
  if (gift?.source === 'compensation') return { label:'お詫び', title };
  if (gift?.source === 'campaign') return { label:'キャンペーン', title };
  // モンヒロビートのイベント・週間ランキングの報酬(2026-09-14)
  if (gift?.source === 'rhythmEvent') return { label:'ランキング報酬', title };
  // イベント・レイドボス「ジャック」の報酬(2026-10-04)
  if (gift?.source === 'raidJack') return { label:'ジャック報酬', title };
  // 助手の仲良し度の節目のごほうび(2026-10-21)
  if (gift?.source === 'assistantBond') return { label:'仲良し度', title };
  // 助手のお話のおみやげ(2026-10-27 ソラシド)
  if (gift?.source === 'assistantStory') return { label:'おみやげ', title };
  // MFバトルカード個人杯のごほうび・返却(2026-10-31・99-card-cup-prize)
  if (gift?.source === 'cardCup') return { label:'個人杯', title };
  if (gift?.source !== 'mission') return { label:null, title };
  const missionTitle = title.replace(/^ミッション報酬[「『]?/, '').replace(/[」』]$/, '').trim();
  return { label:'ミッション', title:missionTitle || title };
};
const missionDailyPeriod = loginBonusPeriodKey;
// --- 遊んだ時間 ---
// 新しい保存キーへ足すだけで、既存の保存(mh_*)には一切触らない。
// 画面が見えているあいだだけ数える(裏に回している時間・端末を置いている時間は遊んでいないため)。
// 数え始めた日(since)も一緒に持つ。既存プレイヤーは0から始まるので、
// 「いつからの記録か」が分からないと短すぎると誤解されてしまう。
const PLAYTIME_KEY = 'mh_playtime_v1';
const PLAYTIME_TICK_MS = 15000;        // 数える間隔
const PLAYTIME_SAVE_MS = 60000;        // 保存する間隔(数えるたびに保存すると書き込みが多すぎる)
const PLAYTIME_MAX_STEP_MS = 60000;    // 1回で足してよい上限。スリープ復帰などで飛んだぶんは数えない
// 日の区切りは朝4時(jstDayKey4 と同じ。2026-11-07 から。前は0時)。切り出して検査されるので式はここに持つ
const playtimeDayKey = (now=Date.now()) => new Date(Number(now)+5*60*60*1000).toISOString().slice(0,10);
const PLAYTIME_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// 切り替えの夜の持ち越し(jstDayCarry と同じ)。0時区切りのころに0:00〜4:00で書いた「次の日」が残っていれば、その日のまま数える(遊んだ日数を二重に足さない)
const playtimeDayOf = (savedDay, now=Date.now()) => { const day = playtimeDayKey(now); return savedDay === playtimeDayKey(Number(now) + 86400000) ? savedDay : day; };
const playtimeDayValue = (value) => typeof value === 'string' && PLAYTIME_DAY_PATTERN.test(value) ? value : null;
const playtimeSpan = (value) => {
  const ms = Number(value?.ms);
  return { day: playtimeDayValue(value?.day), ms: Number.isFinite(ms) && ms >= 0 ? ms : 0 };
};
// 保存値が無い・壊れている場合も必ず既定へ落とす(型を確かめてから使う)。
// days / today / longest は後から足した項目なので、それらを持たない古い保存を読んでも
// 既定で埋まり、それまでの合計(totalMs)と数え始めた日(since)はそのまま引き継がれる。
const normalizePlaytime = (value) => {
  const totalMs = Number(value?.totalMs);
  const days = Number(value?.days);
  return {
    totalMs: Number.isFinite(totalMs) && totalMs >= 0 ? totalMs : 0,
    since: playtimeDayValue(value?.since),
    days: Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0,
    today: playtimeSpan(value?.today),      // 今日のぶん
    longest: playtimeSpan(value?.longest),  // いちばん長く遊んだ日
  };
};
// 経過したぶんを足す。日をまたいだら「今日」を0へ戻して遊んだ日数を1増やす。
// 純粋な関数にしてあるので、日またぎの動きを検査でそのまま確かめられる。
const advancePlaytime = (current, deltaMs, now=Date.now()) => {
  const base = normalizePlaytime(current);
  const delta = Number(deltaMs);
  if (!(Number.isFinite(delta) && delta > 0)) return base;
  const day = playtimeDayOf(base.today.day, now);
  const sameDay = base.today.day === day;
  const todayMs = (sameDay ? base.today.ms : 0) + delta;
  return {
    totalMs: base.totalMs + delta,
    since: base.since || day,
    // 同じ日のあいだは増やさない。初日(dayが無い状態)は1日目として数える
    days: sameDay ? Math.max(1, base.days) : base.days + 1,
    today: { day, ms: todayMs },
    longest: todayMs > base.longest.ms ? { day, ms: todayMs } : base.longest,
  };
};
// 表示用。前に遊んだのが昨日以前なら、今日はまだ0分として出す
// (プロフィールを開いた時点ではまだ加算が走っていないことがあるため)
const playtimeTodayMs = (value, now=Date.now()) => {
  const base = normalizePlaytime(value);
  return base.today.day === playtimeDayOf(base.today.day, now) ? base.today.ms : 0;
};
// --- 端末ごとのプレイ時間(2026-10-06) ---
// ユーザー報告「プレイ時間が短くなるバグ」。プレイ時間(mh_playtime_v1)は端末の中だけで数え、
// フレンドの表(friend_profiles)は1人1行を「最後に送った端末」の値で上書きしていた。
// しかもデータ引き継ぎでブリーダーIDもプレイ時間もコピーされるので、2台で遊ぶと
// 「あまり使っていない端末で開いたとたんに短くなる」。ユーザーの選択は「2台の合計を出す」。
// そこで端末ごとに次の2つを持ち、フレンドの表とは別の表(friend_playtime_devices)へ端末ごとに送る。
//   baseMs … この仕組みが入った時点でその端末が持っていたプレイ時間(引き継ぎでコピーされた昔のぶんを含む)
//   ownMs  … そのあとこの端末で遊んだぶんだけ
// 合計 = (端末たちの baseMs のうち一番大きいもの) ＋ (全端末の ownMs の和)。
// 昔のぶんは引き継ぎで同じものが何台にもコピーされているので、足さずに1つだけ数える。
// ★保存キーは mh_ で始めない。データ引き継ぎ(バックアップ)は mh_ のキーだけを写すので、
//   端末のIDと「この端末で遊んだぶん」が別の端末へコピーされない(コピーされると二重に数えてしまう)。
const PLAYTIME_DEVICE_KEY = 'mhdev_playtime_device_v1';
const PLAYTIME_DEVICE_ID_RE = /^[a-z0-9]{12,40}$/;
const normalizePlaytimeDevice = (value) => {
  if (!value || typeof value !== 'object' || !PLAYTIME_DEVICE_ID_RE.test(String(value.deviceId || ''))) return null;
  const ms = (x) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? n : 0; };
  return { deviceId: String(value.deviceId), baseMs: ms(value.baseMs), ownMs: ms(value.ownMs), since: playtimeDayValue(value.since) };
};
const newPlaytimeDeviceId = () => {
  let id = '';
  try {
    const bytes = new Uint8Array(12);
    globalThis.crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
  } catch (error) { id = ''; }
  while (id.length < 20) id += Math.random().toString(36).slice(2);
  return id.slice(0, 24);
};
// 保存先(localStorage)は呼ぶ側から渡す(この部品は画面・保存を外から掴まない決まり)
const loadPlaytimeDevice = (storage) => {
  try { return normalizePlaytimeDevice(JSON.parse(storage.getItem(PLAYTIME_DEVICE_KEY) || 'null')); }
  catch (error) { return null; }
};
const savePlaytimeDevice = (storage, value) => {
  const device = normalizePlaytimeDevice(value);
  if (!device) return false;
  try {
    storage.setItem(PLAYTIME_DEVICE_KEY, JSON.stringify({ ...device, baseMs: Math.round(device.baseMs), ownMs: Math.round(device.ownMs) }));
    return true;
  } catch (error) { return false; }
};
// サーバーの端末ごとの行(秒)から、その人の合計を出す。行が無ければ null(呼ぶ側は今までの値を使う)
const combineDevicePlaytime = (rows) => {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && typeof row === 'object');
  if (!list.length) return null;
  const sec = (x) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };
  const base = list.reduce((max, row) => Math.max(max, sec(row.base_seconds)), 0);
  const own = list.reduce((sum, row) => sum + sec(row.own_seconds), 0);
  const days = list.map((row) => playtimeDayValue(row.started_on)).filter(Boolean).sort();
  return { seconds: base + own, startedOn: days[0] || null, devices: list.length };
};
const formatPlaytime = (ms) => {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}時間${String(minutes).padStart(2, '0')}分`;
  if (minutes > 0) return `${minutes}分`;
  return '1分未満';
};
const missionWeeklyPeriod = (now=Date.now()) => { const d=new Date(Number(now)+5*60*60*1000); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-((day+6)%7)); return d.toISOString().slice(0,10); };
const missionMonthlyPeriod = (now=Date.now()) => new Date(Number(now)+5*60*60*1000).toISOString().slice(0,7);
const MISSION_WEEK_ROTATION_EPOCH = '2026-08-24';
const missionPeriodWeekday = (now=Date.now()) => new Date(`${missionDailyPeriod(now)}T00:00:00Z`).getUTCDay();
// 週替わり・月替わりの順番。n は並びの数(週替わりのミッションは7つ、助手の道具は5つ)
const missionWeekRotationIndex = (now=Date.now(), n=MISSION_WEEKLY_ROTATION_COUNT) => {
  const periodMs=Date.parse(`${missionWeeklyPeriod(now)}T00:00:00Z`), epochMs=Date.parse(`${MISSION_WEEK_ROTATION_EPOCH}T00:00:00Z`);
  const index=Math.floor((periodMs-epochMs)/(7*24*60*60*1000));
  return ((index%n)+n)%n;
};
const MISSION_MONTH_ROTATION_EPOCH = '2026-11';
const missionMonthRotationIndex = (now=Date.now(), n=12) => {
  const [y,m]=missionMonthlyPeriod(now).split('-').map(Number), [ey,em]=MISSION_MONTH_ROTATION_EPOCH.split('-').map(Number);
  const index=(y-ey)*12+(m-em);
  return ((index%n)+n)%n;
};
// ★ミッションの作り直し(2026-11-08 社長「この文で」・docs/progress/mission-renewal/PLAN.md 第3版)。
//   ・モンヒロビート・MFバトルカード・助手とのふれあい・フレンドの家も進む。遊びを決めた項目には「またはバトル」の別の道(alt)を付けた
//     (2026-09-26 の「モンヒロビートは入れない」はこれで変えた)
//   ・ダイヤは今までの各項目の10倍。ビートP・カードパック券・助手へのおやつと道具・性格のたね・家具も届く
//   ・報酬の数はこの表だけで決める(助手の1行の案内を作る AI には決めさせない)
//   ★既存のミッションidは受取履歴(sentDaily など)と固定ギフトidに使われているので、同じ意味の項目は
//     idを変えない。新しい項目だけ新しいidを使う(CLAUDE.md ⑦)
//   ★公開してすぐ切り替える(社長 ④B)。切り替えた日・週・月だけの数え方は、印 mh_mission_renew_v1 に置いた期間で見分ける(下の missionInSwitch)
// ★以前の見直し(2026-09-26): チャレンジ・プロ・種族チャレンジ・極限チャレンジは、クラシックとタクティクスのどちらでも同じ項目が進む
const MISSION_BATTLE_BOTH = '（クラシック・タクティクスどちらでも）';
// 'gameItem' は GIFT_ITEM_REWARD_TYPE と同じ値。ここだけを切り出して読む検査でも動くよう、文字で書く
const missionItemReward = (itemId, amount) => ({ type:'gameItem', itemId, amount });
// 行の頭に出す遊びの印
const MISSION_TAG_ANY = '⚔️🎵🃏', MISSION_TAG_BATTLE = '⚔️', MISSION_TAG_BEAT = '🎵 または ⚔️', MISSION_TAG_CARD = '🃏 または ⚔️', MISSION_TAG_ASSIST = '🏡', MISSION_TAG_FRIEND = '🤝';
// 曜日のおやつ(助手と1回ふれあう)。日=0 … 土=6
const MISSION_DAILY_ASSIST_ITEMS = Object.freeze(['peer_tea','peer_onigiri','peer_tea','peer_flower','peer_cake','peer_gift','peer_onigiri']);
// 週替わりの道具(助手と5日ふれあう)。ケーキ→パズル→イヤホン→チェキ→スリーブ
const MISSION_WEEKLY_ASSIST_ITEMS = Object.freeze(['peer_cake','peer_puzzle','peer_earphone','peer_cheki','peer_sleeve']);
// 月替わりの家具(マンスリーコンプリート)。2026-11 がふかふかソファ。並びは助手ライフの家具(ASSISTANT_LIFE_FURNITURE)と同じ
const MISSION_MONTHLY_FURNITURE = Object.freeze(['furn_sofa','furn_bear','furn_plant','furn_record','furn_nyacushion','furn_starpic','furn_trophy','furn_bookshelf','furn_heartmirror','furn_lantern','furn_mirrorball','furn_windbell']);
const DAILY_ROTATION_MISSIONS = Object.freeze({
  1:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_BEAT,condition:'モンヒロビートを1曲クリアする(またはバトルを1回クリア)',key:'beatClears',alt:{key:'battleClears',target:1},target:1,rewards:[{type:'beatPoint',amount:150}]},
  2:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_CARD,condition:'MFバトルカードで1回勝つ(またはバトルを1回クリア)',key:'cardWins',alt:{key:'battleClears',target:1},target:1,rewards:[{type:'cardPackTicket',amount:1}]},
  3:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_BATTLE,condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'diamond',amount:3000}]},
  4:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_BATTLE,condition:`プロモードを1回クリアする${MISSION_BATTLE_BOTH}`,key:'proClears',target:1,rewards:[missionItemReward('hero_proof_shard',2)]},
  5:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_BATTLE,condition:`種族チャレンジを1回クリアする${MISSION_BATTLE_BOTH}`,key:'speciesClears',target:1,rewards:[{type:'rainbowPsyche',amount:15}]},
  6:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使う',key:'itemUses',target:1,rewards:[{type:'dyeMock',amount:2}]},
  0:{id:'daily_rotation',name:'本日のミッション',tag:MISSION_TAG_FRIEND,condition:'フレンドの家へ行く(または助手と1回ふれあう)',key:'friendVisits',alt:{key:'assistantTouches',target:1},target:1,rewards:[missionItemReward('session_ticket',1)]},
});
// 週替わり(7つ)。マーケット3回・アイテム5個は、切り替えの次の週から週替わりの中へ移した(idはそのまま)。
// ★並びは切り替えの週(2026-11-02 の週)が今までと同じ「種族チャレンジ3回」になるようにしてある
const WEEKLY_ROTATION_MISSIONS = Object.freeze([
  {id:'weekly_rotation',name:'今週のミッション',tag:MISSION_TAG_BATTLE,condition:`プロモードを3回クリアする${MISSION_BATTLE_BOTH}`,key:'proClears',target:3,rewards:[missionItemReward('hero_proof_shard',3)]},
  {id:'weekly_rotation',name:'今週のミッション',tag:MISSION_TAG_BATTLE,condition:'極限チャレンジを1回クリアする（未解放ならクイックモードを10回クリア）',key:'extremeOrQuick',target:1,rewards:[{type:'rainbowPsyche',amount:30}]},
  {id:'weekly_market',name:'今週のミッション',condition:'マーケットで3回買う',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:2}]},
  {id:'weekly_rotation',name:'今週のミッション',tag:MISSION_TAG_BATTLE,condition:`種族チャレンジを3回クリアする${MISSION_BATTLE_BOTH}`,key:'speciesClears',target:3,rewards:[{type:'trainingTicketLarge',amount:2}]},
  {id:'weekly_rotation',name:'今週のミッション',tag:MISSION_TAG_FRIEND,condition:'フレンドの家へ3回行く',key:'friendVisits',target:3,rewards:[missionItemReward('peer_token',1)]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'アイテムを10個使う',key:'itemUses',target:10,rewards:[{type:'bondPointReset',amount:1}]},
  {id:'weekly_daily_claims',name:'今週のミッション',condition:'アイテムを5個使う',key:'itemUses',target:5,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
]);
const MISSION_WEEKLY_ROTATION_COUNT = WEEKLY_ROTATION_MISSIONS.length;
// 切り替えの週・月だけ残す、前の項目(PLAN.md ④)
const MISSION_SWITCH_KEPT = Object.freeze({
  weekly: Object.freeze([
    {id:'weekly_market',name:'マーケット常連',condition:'マーケットで3回買う',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:2}]},
    {id:'weekly_daily_claims',name:'アイテム活用',condition:'アイテムを5個使う',key:'itemUses',target:5,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  ]),
  monthly: Object.freeze([
    {id:'monthly_market',name:'マーケット月間',condition:'マーケットで10回買い物する',key:'marketTrades',target:10,rewards:[{type:'dyeMock',amount:5}]},
    {id:'monthly_mode_runs',name:'モードプレイヤー',condition:'どのモードでも合わせて30回遊ぶ',key:'modeRuns',target:30,rewards:[{type:'bondPointReset',amount:2}]},
  ]),
});
// 切り替える前のコンプリートの目安(切り替えた日・週・月は、今までと新しいののうち少ないほうで達成)
const MISSION_SWITCH_OLD_COMPLETE = Object.freeze({ daily:4, weekly:6, monthly:8 });
// ---- 切り替えの印(mh_mission_renew_v1) ----
// { at: 切り替えた時刻(ミリ秒), daily, weekly, monthly: そのときの期間 }。一度だけ書く(書いたあとは読むだけ)。
// 印の期間と今の期間が同じあいだだけ「切り替えの数え方」をする。次の期間からは印があっても何もしない(持ち越さない)
const MISSION_RENEW_KEY = 'mh_mission_renew_v1';
let missionRenewMark = null;
const normalizeMissionRenewMark = (v) => (v && typeof v === 'object' && !Array.isArray(v)
  && typeof v.daily === 'string' && typeof v.weekly === 'string' && typeof v.monthly === 'string'
  ? { at:Number.isFinite(Number(v.at)) ? Number(v.at) : 0, daily:v.daily, weekly:v.weekly, monthly:v.monthly } : null);
const missionRenewMarkAt = (now=Date.now()) => ({ at:Number(now), daily:missionDailyPeriod(now), weekly:missionWeeklyPeriod(now), monthly:missionMonthlyPeriod(now) });
const setMissionRenewMark = (v) => { missionRenewMark = normalizeMissionRenewMark(v); return missionRenewMark; };
const missionPeriodOf = (type, now=Date.now()) => (type === 'daily' ? missionDailyPeriod(now) : type === 'weekly' ? missionWeeklyPeriod(now) : missionMonthlyPeriod(now));
const missionInSwitch = (type, now=Date.now(), mark=missionRenewMark) => !!mark && mark[type] === missionPeriodOf(type, now);
// 通常の項目に、切り替えの期間だけ前の項目を足し、コンプリートの目安を決める(同じidは二度並べない)
const missionWithComplete = (type, normal, complete, now) => {
  const inSwitch = missionInSwitch(type, now);
  const list = [...normal];
  if (inSwitch) (MISSION_SWITCH_KEPT[type] || []).forEach(m => { if (!list.some(x => x.id === m.id)) list.push({ ...m }); });
  const target = inSwitch ? Math.min(complete.target, MISSION_SWITCH_OLD_COMPLETE[type]) : complete.target;
  const label = type === 'daily' ? 'デイリー' : type === 'weekly' ? 'ウィークリー' : 'マンスリー';
  const when = type === 'daily' ? '日' : type === 'weekly' ? '週' : '月';
  return [...list, { ...complete, target, condition:`通常${label}${list.length}個のうち${target}個を達成する${inSwitch ? `(切り替えの${when}だけ)` : ''}` }];
};
const missionDailyDefinitions = (now=Date.now()) => missionWithComplete('daily', [
  {id:'daily_login',name:'今日もMonster Hero！',condition:'その期間中にログインする',key:'login',target:1,rewards:[{type:'diamond',amount:2000}]},
  {id:'daily_battles',name:'好きな遊びを3回',tag:MISSION_TAG_ANY,condition:'バトル・モンヒロビート1曲・カード1戦のどれでも',key:'anyPlays',target:3,rewards:[{type:'beatPoint',amount:50}]},
  // 旧 daily_wins のIDは受取履歴互換のため維持。条件はチャレンジモードのクリア(タクティクスも含む)
  {id:'daily_wins',name:'デイリーチャレンジ',tag:MISSION_TAG_BATTLE,condition:`チャレンジモードを1回クリアする${MISSION_BATTLE_BOTH}`,key:'challengeClears',target:1,rewards:[{type:'rainbowPsyche',amount:10}]},
  {id:'daily_enhance',name:'モンスター育成',condition:'モンスターを1回強化する',key:'enhances',target:1,rewards:[{type:'diamond',amount:3000}]},
  {id:'daily_assistant',name:'助手とふれあう',tag:MISSION_TAG_ASSIST,condition:'助手と1回ふれあう(助手ライフで誘う・会う・渡す/おしゃべり/フレンドの家 のどれか)',key:'assistantTouches',target:1,rewards:[missionItemReward(MISSION_DAILY_ASSIST_ITEMS[missionPeriodWeekday(now)],1)]},
  {...DAILY_ROTATION_MISSIONS[missionPeriodWeekday(now)]},
], {id:'daily_complete',name:'デイリーコンプリート',key:'complete',target:5,rewards:[{type:'diamond',amount:5000},{type:'beatPoint',amount:100},{type:'skipTicketHa',amount:1},missionItemReward('session_ticket',1)],complete:true}, now);
const missionWeeklyDefinitions = (now=Date.now()) => missionWithComplete('weekly', [
  {id:'weekly_logins',name:'継続は力なり',condition:'5日ログインする(同じ日は1回)',key:'loginDays',target:5,rewards:[{type:'diamond',amount:10000}]},
  {id:'weekly_battles',name:'好きな遊び週間',tag:MISSION_TAG_ANY,condition:'好きな遊びを20回(バトル・モンヒロビート1曲・カード1戦のどれでも)',key:'anyPlays',target:20,rewards:[{type:'diamond',amount:10000},{type:'beatPoint',amount:500}]},
  {id:'weekly_enhance',name:'育成週間',condition:'モンスターを10回強化する',key:'enhances',target:10,rewards:[{type:'trainingTicketLarge',amount:3}]},
  // 旧 weekly_wins のIDをクイック枠へ再利用し、同期間の二重受取を防ぐ。
  {id:'weekly_wins',name:'クイック育成',tag:MISSION_TAG_BATTLE,condition:'クイックモードを5回クリアする',key:'quickClears',target:5,rewards:[{type:'rainbowPsyche',amount:50}]},
  // 旧IDは受取履歴互換のため維持。条件はチャレンジモードのクリア(タクティクスも含む)
  {id:'weekly_donations',name:'チャレンジャー',tag:MISSION_TAG_BATTLE,condition:`チャレンジモードを3回クリアする${MISSION_BATTLE_BOTH}`,key:'challengeClears',target:3,rewards:[missionItemReward('hero_proof_shard',3)]},
  {id:'weekly_beat',name:'モンヒロビート週間',tag:MISSION_TAG_BEAT,condition:'モンヒロビートを10曲遊ぶ(またはバトルを10回)',key:'beatPlays',alt:{key:'battles',target:10},target:10,rewards:[{type:'beatPoint',amount:500}]},
  {id:'weekly_card',name:'カード週間',tag:MISSION_TAG_CARD,condition:'MFバトルカードで5回勝つ(またはバトルで10回勝つ)',key:'cardWins',alt:{key:'wins',target:10},target:5,rewards:[{type:'cardPackTicket',amount:2}]},
  {id:'weekly_assistant',name:'ふれあい週間',tag:MISSION_TAG_ASSIST,condition:'助手と5日ふれあう(同じ日は1回)',key:'assistantDays',target:5,rewards:[missionItemReward(MISSION_WEEKLY_ASSIST_ITEMS[missionWeekRotationIndex(now, MISSION_WEEKLY_ASSIST_ITEMS.length)],1)]},
  {...WEEKLY_ROTATION_MISSIONS[missionWeekRotationIndex(now)]},
], {id:'weekly_complete',name:'ウィークリーコンプリート',key:'complete',target:7,rewards:[{type:'diamond',amount:30000},{type:'beatPoint',amount:1000},{type:'rainbowPsyche',amount:50},missionItemReward('hero_proof_shard',5),{type:'skipTicketKyu',amount:1},missionItemReward('session_ticket',3)],complete:true}, now);
const missionMonthlyDefinitions = (now=Date.now()) => missionWithComplete('monthly', [
  {id:'monthly_logins',name:'月間ログイン',condition:'20日ログインする(同じ日は1回)',key:'loginDays',target:20,rewards:[{type:'diamond',amount:50000}]},
  {id:'monthly_battles',name:'月間プレイ',tag:MISSION_TAG_ANY,condition:'好きな遊びを100回(バトル・モンヒロビート1曲・カード1戦のどれでも)',key:'anyPlays',target:100,rewards:[{type:'rainbowPsyche',amount:100}]},
  {id:'monthly_wins',name:'月間勝利',tag:MISSION_TAG_ANY,condition:'好きな遊びで200回勝つ(バトル・カードの勝ち・モンヒロビートのクリア)',key:'anyWins',target:200,rewards:[{type:'trainingTicketLarge',amount:10}]},
  {id:'monthly_daily_completes',name:'デイリーマスター',condition:'デイリーコンプリートを20回達成する',key:'dailyCompletes',target:20,rewards:[{type:'diamond',amount:50000}]},
  {id:'monthly_weekly_completes',name:'ウィークリーマスター',condition:'ウィークリーコンプリートを3回達成する',key:'weeklyCompletes',target:3,rewards:[{type:'rainbowPsyche',amount:200}]},
  {id:'monthly_quick_runs',name:'クイック月間',tag:MISSION_TAG_BATTLE,condition:'クイックモードを20回遊ぶ',key:'quickRuns',target:20,rewards:[{type:'skipTicketKyu',amount:2}]},
  {id:'monthly_challenge_runs',name:'チャレンジ月間',tag:MISSION_TAG_BATTLE,condition:`チャレンジモードを10回プレイする${MISSION_BATTLE_BOTH}`,key:'challengeRuns',target:10,rewards:[{type:'rainbowPsyche',amount:100}]},
  {id:'monthly_pro_clears',name:'プロ月間',tag:MISSION_TAG_BATTLE,condition:`プロモードを10回クリアする${MISSION_BATTLE_BOTH}`,key:'proClears',target:10,rewards:[missionItemReward('hero_proof_shard',10)]},
  {id:'monthly_enhances',name:'育成月間',condition:'モンスターを30回強化する',key:'enhances',target:30,rewards:[{type:'uniqueSkillResetTicket',amount:2}]},
  {id:'monthly_beat',name:'モンヒロビート月間',tag:MISSION_TAG_BEAT,condition:'モンヒロビートを50曲遊ぶ(またはバトルを50回)',key:'beatPlays',alt:{key:'battles',target:50},target:50,rewards:[{type:'beatPoint',amount:2000}]},
  {id:'monthly_card',name:'カード月間',tag:MISSION_TAG_CARD,condition:'MFバトルカードで20回勝つ(またはバトルで50回勝つ)',key:'cardWins',alt:{key:'wins',target:50},target:20,rewards:[{type:'cardPackTicket',amount:5}]},
  {id:'monthly_assistant',name:'ふれあい月間',tag:MISSION_TAG_ASSIST,condition:'助手と20日ふれあう(同じ日は1回)',key:'assistantDays',target:20,rewards:[missionItemReward('buddy_trait_seed',1)]},
], {id:'monthly_complete',name:'マンスリーコンプリート',key:'complete',target:9,rewards:[{type:'diamond',amount:100000},{type:'beatPoint',amount:3000},{type:'rainbowPsyche',amount:300},{type:'rainbowTranscendFruit',amount:1},missionItemReward('skip_ticket_kiwami',1),missionItemReward('session_ticket',10),missionItemReward(MISSION_MONTHLY_FURNITURE[missionMonthRotationIndex(now, MISSION_MONTHLY_FURNITURE.length)],1)],complete:true}, now);
// 日次・週次はJST期間に応じてローテーションするため、参照時に現在の定義を返す。
const MISSION_DEFS = {
  get daily(){ return missionDailyDefinitions(); },
  get weekly(){ return missionWeeklyDefinitions(); },
  get monthly(){ return missionMonthlyDefinitions(); },
};
// ★数える項目は足すだけ(2026-11-08 に beatPlays〜friendVisits を足した)。足りない古い保存は0で読む
const emptyMissionCounts = () => ({login:0,battles:0,wins:0,enhances:0,dailyClaims:0,dailyCompletes:0,weeklyCompletes:0,marketTrades:0,donations:0,challengeRuns:0,quickRuns:0,modeRuns:0,challengeClears:0,quickClears:0,proClears:0,extremeClears:0,itemUses:0,speciesClears:0,
  beatPlays:0,beatClears:0,cardPlays:0,cardWins:0,assistantTouches:0,friendVisits:0});
const missionDayList = (same, v) => (same && Array.isArray(v) ? v.filter(d => typeof d === 'string') : []);
const normalizeMissions = (value,now=Date.now()) => {
  const dailyPeriod=missionDailyPeriod(now), weeklyPeriod=missionWeeklyPeriod(now), monthlyPeriod=missionMonthlyPeriod(now), old=value&&typeof value==='object'?value:{};
  const dailySame=old.dailyPeriod===dailyPeriod, weeklySame=old.weeklyPeriod===weeklyPeriod, monthlySame=old.monthlyPeriod===monthlyPeriod;
  const counts=(same,v)=>{ const base=emptyMissionCounts(); if(!same||!v||typeof v!=='object')return base; const o={...base,...v}; Object.keys(base).forEach(k=>{ const n=Number(o[k]); o[k]=Number.isFinite(n)&&n>0?n:0; }); return o; };
  const state={version:2,dailyPeriod,weeklyPeriod,monthlyPeriod,daily:counts(dailySame,old.daily),weekly:counts(weeklySame,old.weekly),monthly:counts(monthlySame,old.monthly),sentDaily:dailySame&&Array.isArray(old.sentDaily)?old.sentDaily:[],sentWeekly:weeklySame&&Array.isArray(old.sentWeekly)?old.sentWeekly:[],sentMonthly:monthlySame&&Array.isArray(old.sentMonthly)?old.sentMonthly:[],weeklyLoginDays:missionDayList(weeklySame,old.weeklyLoginDays),monthlyLoginDays:missionDayList(monthlySame,old.monthlyLoginDays),monthlyDailyCompletePeriods:missionDayList(monthlySame,old.monthlyDailyCompletePeriods),monthlyWeeklyCompletePeriods:missionDayList(monthlySame,old.monthlyWeeklyCompletePeriods),
    // 助手とふれあった日(2026-11-08 に足した。同じ日は1回)
    weeklyAssistantDays:missionDayList(weeklySame,old.weeklyAssistantDays),monthlyAssistantDays:missionDayList(monthlySame,old.monthlyAssistantDays)};
  // 月途中の初導入や月替わりでは、導入前・前月中に既に終わっていた現在期間の
  // コンプリートを遡及加算しない。期間IDだけ記録し、次の新しい期間から数える。
  if(!monthlySame){
    const completed=(type)=>{ const defs=missionDefsAt(type,now), c=defs.find(m=>m.complete); return !!c&&missionValue(state,type,c,defs)>=c.target; };
    if(dailySame&&completed('daily'))state.monthlyDailyCompletePeriods=[dailyPeriod];
    if(weeklySame&&completed('weekly'))state.monthlyWeeklyCompletePeriods=[weeklyPeriod];
  }
  return state;
};
const missionDefsAt = (type, now=Date.now()) => (type === 'daily' ? missionDailyDefinitions(now) : type === 'weekly' ? missionWeeklyDefinitions(now) : missionMonthlyDefinitions(now));
// 数の読み方。遊びをまとめた数(anyPlays など)はここで足し合わせる(保存には足した数を書かない)
const missionCountOf = (state, type, key) => {
  const c = (state && state[type]) || {};
  const n = (k) => { const v = Number(c[k]); return Number.isFinite(v) && v > 0 ? v : 0; };
  if (key === 'loginDays') return ((type === 'monthly' ? state.monthlyLoginDays : state.weeklyLoginDays) || []).length;
  if (key === 'assistantDays') return ((type === 'monthly' ? state.monthlyAssistantDays : state.weeklyAssistantDays) || []).length;
  // 好きな遊び: バトル(1戦)・モンヒロビート(1曲)・MFバトルカード(1戦)
  if (key === 'anyPlays') return n('battles') + n('beatPlays') + n('cardPlays');
  // 好きな遊びの勝ち: バトルの勝ち・カードの勝ち・モンヒロビートのクリア
  if (key === 'anyWins') return n('wins') + n('cardWins') + n('beatClears');
  // バトルのクリア(チャレンジ・クイック・プロ・種族チャレンジ・極限チャレンジのどれでも)
  if (key === 'battleClears') return n('challengeClears') + n('quickClears') + n('proClears') + n('speciesClears') + n('extremeClears');
  return n(key);
};
const missionValue = (state,type,mission,defs=null) => {
  if(mission.complete){ const normal=(defs||MISSION_DEFS[type]).filter(m=>!m.complete); return normal.filter(m=>missionValue(state,type,m)>=m.target).length; }
  // 旧仕様で同じIDの報酬を受取済みなら、新条件へ変わった同じ期間でも達成済みとして扱う。
  const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly;
  if(Array.isArray(sent)&&sent.includes(mission.id)) return mission.target;
  if(type==='weekly'&&mission.key==='extremeOrQuick') return ((Number(state.weekly?.extremeClears)||0)>=1||(Number(state.weekly?.quickClears)||0)>=10)?1:0;
  const own=missionCountOf(state,type,mission.key);
  // 「またはバトル」の別の道。別の道の進みを、この項目の目標の大きさに直して、多いほうを使う
  if(mission.alt&&Number(mission.alt.target)>0){ const alt=missionCountOf(state,type,mission.alt.key); return Math.max(own,Math.floor(alt*mission.target/mission.alt.target)); }
  return own;
};
// 家具の報酬は、持っている(まだ贈っていない)か、助手みんなに贈り終えていれば、交換所と同じ値うちのビートPに替えて届ける(2026-11-08 社長)。
// room … 助手ライフの部屋(mh_assistant_life_room_v1 を normalizeAssistantLifeRoom した形)。読めなければ持ち物だけで決める
const missionFurnitureSwap = (itemId, ownedItems, room) => {
  if (typeof itemId !== 'string' || !itemId.startsWith('furn_')) return null;
  const offer = (typeof RHYTHM_EVENT_POINT_SHOP_OFFERS !== 'undefined' ? RHYTHM_EVENT_POINT_SHOP_OFFERS : []).find(o => o && o.itemId === itemId);
  const cost = offer && Number.isFinite(offer.cost) && offer.cost > 0 ? offer.cost : 0;
  if (!cost) return null;
  const owned = ownedItems && typeof ownedItems === 'object' ? Number(ownedItems[itemId]) : 0;
  const ids = typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' && Array.isArray(ASSISTANT_LIFE_HOUSE_ORDER) ? ASSISTANT_LIFE_HOUSE_ORDER : [];
  const key = itemId.slice(5);
  const allGot = !!room && typeof room === 'object' && ids.length > 0 && ids.every(who => room[who] && room[who].got && room[who].got[key]);
  return (Number.isFinite(owned) && owned > 0) || allGot ? { type:'beatPoint', amount:cost } : null;
};
const missionRewardsFor = (rewards, { ownedItems = null, room = null } = {}) => (Array.isArray(rewards) ? rewards : []).map(r => {
  const swap = r && r.type === 'gameItem' ? missionFurnitureSwap(r.itemId, ownedItems, room) : null;
  return swap ? { ...swap, amount:swap.amount * Math.max(1, Math.floor(Number(r.amount) || 1)), swappedFrom:r.itemId } : { ...r };
});
const missionClaimableList = (state,type) => { const sent=type==='daily'?state.sentDaily:type==='weekly'?state.sentWeekly:state.sentMonthly; return MISSION_DEFS[type].filter(m=>missionValue(state,type,m)>=m.target && !sent.includes(m.id)); };
const missionClaimableCount = state => ['daily','weekly','monthly'].reduce((sum,type)=>sum+missionClaimableList(state,type).length,0);
const missionNextReset = (type,now=Date.now()) => { const shifted=new Date(Number(now)+5*60*60*1000); shifted.setUTCHours(0,0,0,0); if(type==='monthly')shifted.setUTCMonth(shifted.getUTCMonth()+1,1);else shifted.setUTCDate(shifted.getUTCDate()+(type==='daily'?1:7-((shifted.getUTCDay()+6)%7))); return shifted.getTime()-5*60*60*1000; };
const reconcileMonthlyMissionCompletions = (value,now=Date.now()) => {
  // 定義は渡された時刻のもの(日替わり・週替わりが今の期間とそろうように)
  const dailyDefs=missionDefsAt('daily',now), weeklyDefs=missionDefsAt('weekly',now);
  const state=normalizeMissions(value,now), dailyComplete=dailyDefs.find(m=>m.complete), weeklyComplete=weeklyDefs.find(m=>m.complete);
  if(dailyComplete&&missionValue(state,'daily',dailyComplete,dailyDefs)>=dailyComplete.target&&!state.monthlyDailyCompletePeriods.includes(state.dailyPeriod)){
    state.monthlyDailyCompletePeriods=[...state.monthlyDailyCompletePeriods,state.dailyPeriod];
    state.monthly.dailyCompletes=(Number(state.monthly.dailyCompletes)||0)+1;
  }
  if(weeklyComplete&&missionValue(state,'weekly',weeklyComplete,weeklyDefs)>=weeklyComplete.target&&!state.monthlyWeeklyCompletePeriods.includes(state.weeklyPeriod)){
    state.monthlyWeeklyCompletePeriods=[...state.monthlyWeeklyCompletePeriods,state.weeklyPeriod];
    state.monthly.weeklyCompletes=(Number(state.monthly.weeklyCompletes)||0)+1;
  }
  return state;
};
