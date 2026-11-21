# ゲーム全体の見た目 API 点検(モンサク・モンヒロビート・助手ライフ以外)2026-11-21

- r1119-046 / 検査部(ミハリ) / 2026-11-21 09:41 JST / 基準 main `52f238e7`
- **監査だけ。ゲームのコードは1つも変えていない。** 直すかどうか・どの部が直すかは窓口が決める
- 撮り方: `tools/browser/visual-shoot.js`(ボット用のまっさらなブラウザ・「しばらく遊んでいる人」の種・にせの Supabase。本番の保存・ランキングへは何も送っていない。デバッグの合言葉は使っていない)。撮るときに `ui-measure.js` で大きさの釣り合いを測った
- API: 送る口 `tools/analysis/gateway-client.js`(analysis-gateway・kind ui-check・claude-opus-5-5・バッチ)。指示書は社長の目線 `tools/browser/prompts/monsuc-ui-check.md` を全画面向けに言い換え、HOME の見やすさ(r1119-050)の項を足し、共通の `common-balance.md` を続けた物([`system-prompt.md`](system-prompt.md))。測る検査の高・中は「機械の見つけ物」として一緒に送り、API が本物か空振りかを判定した
- **使った額 $1.55**(見積り $3.08・予算の目安 $15)

## 1. 回した量

| 項目 | 値 |
|---|---|
| 場面 | 41(HOME まわり10・マーケット2・カードバトル9・タクティクス3・図鑑(M/B管理)9・設定7・ヘルプ1) |
| 大きさ | 縦 390×844 / 横 844×390 / PC 1280×800 |
| 止め絵 | 122枚(41×3 のうち クイックの対戦中@PC だけ入れなかった。前回 visual-all-2026-11 と同じ道具の側の件) |
| API の頼み | 11本(まとまりごと・1本 最大6場面×3枚)。読めなかった返事 0 |
| 結果 | **276件(高 120・中 115・低 41)**。全件を画面ごとの表に載せた(上位だけにしていない・r1119-039) |

## 2. 画面ごとの結果(全件と直し方の案は各ページ)

| まとまり | 場面 | 高 | 中 | 低 | ページ |
|---|---|---|---|---|---|
| HOME まわり | 10 | 25 | 23 | 10 | [screens/home.md](screens/home.md) |
| マーケット | 2 | 6 | 10 | 3 | [screens/market.md](screens/market.md) |
| カードバトル(+共通3件) | 9 | 28(+1) | 23(+1) | 4(+1) | [screens/battle.md](screens/battle.md) |
| タクティクス | 3 | 17 | 10 | 3 | [screens/tactics.md](screens/tactics.md) |
| 図鑑(M/B管理) | 9 | 21 | 25 | 7 | [screens/mb.md](screens/mb.md) |
| 設定 | 7 | 17 | 16 | 7 | [screens/settings.md](screens/settings.md) |
| ヘルプ | 1 | 5 | 7 | 6 | [screens/help.md](screens/help.md) |

場面ごと(API の件数と、測る検査の高・中の件数):

| 場面 | id | 高 | 中 | 低 | 測る(高・中) |
|---|---|---|---|---|---|
| [HOME](screens/home.md) | home | 3 | 6 | 0 | 7 |
| [更新履歴](screens/home.md) | home-changelog | 1 | 0 | 0 | 7 |
| [助手のメニュー(HOME)](screens/home.md) | home-assistant-menu | 1 | 1 | 1 | 11 |
| [助手の説明(HOME)](screens/home.md) | home-assistant-help | 5 | 1 | 1 | 9 |
| [プロフィール](screens/home.md) | profile | 2 | 4 | 0 | 4 |
| [プロフィール → イベント回想(まとまりを開いた所)](screens/home.md) | replay-list | 2 | 1 | 1 | 4 |
| [イベント回想 → お話の締め(終わり)](screens/home.md) | replay-end | 5 | 0 | 1 | 5 |
| [ミッション](screens/home.md) | mission | 3 | 6 | 2 | 6 |
| [ギフト](screens/home.md) | gift | 2 | 2 | 3 | 6 |
| [神殿](screens/home.md) | temple | 1 | 2 | 1 | 4 |
| [マーケット](screens/market.md) | market | 1 | 5 | 1 | 12 |
| [ダイヤショップ](screens/market.md) | market-diamond | 5 | 5 | 2 | 7 |
| [モンヒロバトル(仕組みを選ぶ)](screens/battle.md) | battle-menu | 2 | 1 | 1 | 8 |
| [クラシックバトルの詳しいルール](screens/battle.md) | battle-rule | 0 | 1 | 0 | 8 |
| [クラシック(モード選択)](screens/battle.md) | battle-classic | 3 | 0 | 2 | 12 |
| [クイックモード(難易度)](screens/battle.md) | battle-quick | 3 | 2 | 0 | 10 |
| [ランキング](screens/battle.md) | battle-ranking | 1 | 2 | 0 | 7 |
| [勇者モンを選ぶ](screens/battle.md) | battle-hero | 4 | 5 | 0 | 4 |
| [クラシックの対戦中](screens/battle.md) | battle-play | 11 | 8 | 0 | 7 |
| [クイックの対戦中](screens/battle.md) | battle-play-quick | 0 | 0 | 1 | 6 |
| [MFバトルカード](screens/battle.md) | card-top | 4 | 4 | 0 | 1 |
| [タクティクス(モード選択)](screens/tactics.md) | tactics-mode | 3 | 2 | 1 | 12 |
| [タクティクスプロ(難易度)](screens/tactics.md) | tactics-diff | 7 | 4 | 1 | 12 |
| [タクティクスプロの対戦中](screens/tactics.md) | tactics-play | 7 | 4 | 1 | 8 |
| [M/B管理](screens/mb.md) | mb | 1 | 5 | 0 | 4 |
| [ベースモン一覧](screens/mb.md) | mb-base | 3 | 2 | 0 | 6 |
| [マスモン一覧(バトル)](screens/mb.md) | mb-master | 2 | 0 | 0 | 10 |
| [マスモン一覧(モンヒロビート)](screens/mb.md) | mb-master-beat | 2 | 2 | 0 | 8 |
| [モンスター図鑑](screens/mb.md) | mb-dex | 2 | 3 | 1 | 7 |
| [モンスター編成](screens/mb.md) | mb-party | 3 | 4 | 0 | 8 |
| [放牧設定](screens/mb.md) | mb-ranch | 3 | 3 | 3 | 10 |
| [AUTO設定](screens/mb.md) | mb-auto | 4 | 3 | 2 | 3 |
| [アシストカード](screens/mb.md) | mb-assist | 1 | 3 | 1 | 11 |
| [設定](screens/settings.md) | settings | 2 | 7 | 3 | 5 |
| [バトル設定](screens/settings.md) | settings-battle | 2 | 4 | 0 | 4 |
| [音量設定](screens/settings.md) | settings-sound | 1 | 0 | 0 | 5 |
| [BGMアレンジ](screens/settings.md) | settings-bgm | 0 | 0 | 0 | 5 |
| [タイトル画像アレンジ](screens/settings.md) | settings-title | 4 | 1 | 1 | 4 |
| [ホーム画面アレンジ](screens/settings.md) | settings-home | 2 | 0 | 1 | 2 |
| [画面テーマ](screens/settings.md) | settings-theme | 6 | 4 | 2 | 2 |
| [ヘルプ(モンヒロバトルから)](screens/help.md) | help | 5 | 7 | 6 | 8 |

観点の内訳(指示書の番号): 13 大きさの釣り合い 74 / 12 重なり・色・小さい押す所・誤字 39 / 5 ほかとそろっていない 25 / 8 同じ情報の二重 25 / 3 押して見られるか 21 / 1 サイズ感と統一感 20 / 6 分からない言葉 20 / 9 文の組み方 19 / 4 閉じる・戻る 11 / 10 説明と効き目 11 / 2 名前が読めるか 7 / 7 能力の言葉 3 / 11 流れ 1

## 3. HOME の見やすさ(r1119-050)

HOME 本体の高3件・中6件(詳しくは [screens/home.md](screens/home.md))。社長が気にしている点はどれも出た。

- 縦で画面のまん中 320×380px(38%)が町の背景だけ。助手は左上の小さな丸い顔で、モードの札は下に押し込まれている → まん中に助手の立ち絵と吹き出し、よく遊ぶ札を大きく上へ(高)
- 8つのモードの札が全部同じ大きさで、最初に何を押すか分からない。副題の有る無しもばらばら → 遊ぶ物(サクセス・バトル・カード対戦)を大きな札、管理系(M/B管理・神殿・マーケット)を小さな段に(高)
- 助手と話すのに、吹き出し →「おしゃべりする」の2回押し。「タップでメニュー」が何のメニューか分からない → 押し所を1つに(高・r1119-050 の決定どおり)
- 助手の説明の窓: 右上の小さい「閉じる」と下の大きい「閉じる」の二重 / HOME の札の助手の顔の束(+4 など)が暗幕と窓より手前に出て本文に重なる(高)/ HOME で開いたのに中身が M/B管理の AUTO の細かい話(高)
- PC: 吹き出しが横幅 660px 近くあって短い台詞のあとが大きく空く(高)

## 4. 画面をまたいで出た傾向(直すなら1か所でまとめて効く物)

1. **PC は中央 600px の列だけで左右 680px が黒い**(カードバトル・タクティクス・ヘルプ・図鑑ほか)。字も札もスマホのまま。PC の組み方を決めるのが先(共通・高)
2. **横で「左の列が空いて右の列が切れる」**(プロフィール・神殿・マーケット・MFバトルカード・設定・バトル設定・M/B管理・AUTO設定・図鑑)。左は見出しと吹き出しだけで 26〜38% が空き、右の一覧は下で切れて「続きがある」ことも分からない。横の2列の割り振りを共通の型で直すと一度に片付く
3. **横で窓が下にはみ出して「決定」が見えない**(タイトル画像アレンジ・ホーム画面アレンジ・画面テーマ・クイックの難易度の「この難易度で挑戦」・モンスター編成の「決定」)。決める手段が見えない=遊べない側の高
4. **閉じる手段が無い・二重**: タイトル画像アレンジ・画面テーマの窓に ✕ も「やめる」も無い / 助手の説明・イベント回想・回想の締めで閉じる・戻るが2つ
5. **同じ数字の二重**: 「編成中 8/8」と「決定(8/8)」、「図鑑登録数 8/86」と「入手済み 8/86」、ミッションのタブの赤い2と「全て受け取る (2)」、ギフトの「受取可」と「受け取る」、倍率「×0.25」「×0.38」が1枚の札に2〜3回
6. **大きな「0 pt」「WAVE 0」がモード名より目立つ**(クラシック・クイック・タクティクスプロ)。初めての人には大きな0だけが見える
7. **札に選ぶ決め手が出ていない**(ダイヤショップの円盤石・勇者モン・MFバトルカードのキット・モンスター編成・手札)。1枚ずつ「詳細」を開かないと比べられない
8. **空のときの下の大きな空き**(マスモン一覧 53〜62%・放牧設定・ランキング 61%・アシストカード 59%)。次に何をすればよいかのボタンも無い
9. **言葉の途中の折り返し**(設定の説明文・タイトル画像アレンジ・バトル設定・AUTO設定・ミッション・タクティクスの助手の吹き出し「EX / スキル」・助手の説明「∞ / 周回」)。設定の画面に多い
10. **対戦中**: 左上の「チャレンジ / Normal」が 7px で読めない / 4つの距離の枠のうち3つが「---」の空き枠で中段を占める / 敵の次の行動が2か所 / 手札に威力・距離が出ていない

## 5. 要確認(撮影の側か画面の側か、まだ切り分けていない)

次の4場面は、押す手順は通ったのに、止め絵が目当ての画面が開く前のまま(HOME・設定の一覧・モンヒロバトル)だった。API も「開いていない恐れ」と書いている。
ゲームで押しても開かないのか、撮影の待ち時間・押す相手の側の問題かは、実機かローカルで1回押して確かめる必要がある(この点検では切り分けていない)。
この4場面の API の見つけ物は、写っている親の画面(HOME・設定・モンヒロバトル)についての物として読む。

| 場面 | 写っていた物 |
|---|---|
| 更新履歴(home-changelog) | ふつうの HOME |
| 音量設定(settings-sound) | 設定の一覧 |
| BGMアレンジ(settings-bgm) | 設定の一覧 |
| ヘルプ(モンヒロバトルから)(help) | モンヒロバトル(仕組みを選ぶ) |

ほかに: クイックの対戦中@PC は撮影の道具が入れなかった(前回と同じ)。

## 6. ファイル

| ファイル | 中身 |
|---|---|
| [`screens/*.md`](screens/) | 画面ごとの全件(優先度・大きさ・何が悪いか・直し方の案・観点・受け持ちの手がかり・機械の判定)と、測る検査の生の見つけ物(高・中) |
| [`all-findings.json`](all-findings.json) | API の全276件(sid = 場面の id) |
| [`system-prompt.md`](system-prompt.md) | API に渡した指示書(社長の目線の全画面版 + HOME の見やすさ + 共通の釣り合い) |
| [`manifest.json`](manifest.json) | どの頼みにどの場面を入れたか・見積り |
| [`tools/api-all.js`](tools/api-all.js)・[`tools/report.js`](tools/report.js) | この点検で使った送る台本と表を作る台本(写し。tools/ には足していない) |

止め絵(122枚)はリポジトリに入れていない。撮り直しは次のとおり(約7分):

```
node tools/build.js
node tools/browser/visual-shoot.js --only <上の41の id を , で> --sizes tate,yoko,pc --out <撮影の結果>
node docs/progress/kensa/visual-all-api-2026-11-21/tools/api-all.js <撮影の結果> <置き場>            # 見積りだけ
ANALYSIS_GATEWAY_TOKEN=proxy node .../api-all.js <撮影の結果> <置き場> --send                         # バッチで送る
ANALYSIS_GATEWAY_TOKEN=proxy node .../api-all.js <撮影の結果> <置き場> --fetch                        # 受け取る
```
