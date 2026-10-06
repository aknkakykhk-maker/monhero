# レイドのランキング: バトル / モンヒロビート別・合計・1曲あたりの最大

2026-10-06・ユーザー指示「レイドのランキングをモンビーのダメージとバトルのダメージに分けて、合計ダメージも見れるようにして。さらに1曲あたり最大ダメージもほしい」。
**ステータス: 仕様確定(質問への回答で確認済み)・実装済み。サーバーのSQLはユーザーが実行する。**

## 決めたこと(ユーザーの回答)

| 項目 | 決めたこと |
| --- | --- |
| 区別のしかた | 表 `raid_jack_hits` へ列 `source`(`'battle'` / `'rhythm'`)を足す。SQL は `docs/sql/raid/RAID_JACK_SOURCE.sql`(ユーザーが実行・足すだけで既存データは消えない) |
| 見せ方 | ランキング画面(レイドバトルのタブ)に **「合計 / バトル / モンヒロビート」** の切り替えを足す。既存の「貢献・累計」「1戦の最大ダメージ」・難易度の切り替えと組み合わせられる |
| 1曲あたりの最大 | 「モンヒロビート」×「1戦の最大ダメージ」= **1回の演奏の最大ダメージ**の人ごとの最大値(「バトル」は1戦あたり) |
| 報酬 | 種類別の順位に**報酬は付けない**(順位報酬は従来どおり段階ごとの貢献ランキング) |

## 画面の組み合わせ

| 種類 | 貢献・累計(段階ボタン / 累計) | 1戦(1曲)の最大ダメージ(難易度ボタン) |
| --- | --- | --- |
| 合計 | 従来どおり(大王を倒したあとだけ「累計」) | 従来どおり(`raid_jack_max_hit_*`) |
| バトル | `source=battle` の段階別・全段階の合計 | `source=battle` の最大 |
| モンヒロビート | `source=rhythm` の段階別・全段階の合計 | `source=rhythm` の最大(**1曲あたり**) |

## サーバー

- 列 `source text not null default 'battle'`(check: battle / rhythm)。**SQL を当てる前に送られた記録はすべて 'battle' になる**(モンヒロビートの与ダメージは、公開から今までのぶんを区別できない)。
- ビュー `raid_jack_source_ranking`(event・kind・source・breeder 単位の合計・最大)、`raid_jack_source_by_tier`(さらに tier 単位)。
- アプリは SQL 適用前でも壊れない: 送信は、列が無いと分かったら列なしで送り直す(与ダメージを捨てない)。ランキングはビューが無い間「準備中」。

## 実装の場所

`36-raid-jack-api.jsx`(`sbSendRaidJackHit` の source・`sbFetchRaidJackSourceRanking` ほか)・`35-raid-jack.jsx`(`raidJackNormalizePending` が source を保つ)・`60-app.jsx`(モンヒロビート挑戦の hit に `source:'rhythm'`)・`79-screen-raid-jack.jsx`(`RaidJackRankingList`)。
検査: `tools/mode/raid-jack-api-check.js` / `raid-jack-reward-browser-check.js`。
