---
name: changelog-help-update
description: Update the in-game changelog (更新履歴), the help pages (ヘルプ/攻略情報局) and the assistant's one-time notice (みゅあの告知) after ANY gameplay-visible change to モンスターヒーロー. Use this right after finishing a feature, fix, new market item, new screen, new assistant line, or new song — i.e. whenever the user says 更新履歴 / お知らせ / ヘルプ / 告知 / changelog, and as the last step of every 改修 before committing. Covers the exact entry shape, the JST real-clock rule, where to insert, which of the 3 notice types is allowed, when NOT to write anything (debug-only / tool-only changes), and the checks that guard it.
---

# 更新履歴・ヘルプ・助手の告知を更新する

CLAUDE.md ⑤ の実務版。**プレイヤーに見える変更をしたら、コミット前に必ずここを通す。**
更新履歴は「書き忘れても画面はふつうに動いてしまう」ので、気づけるのは検査だけ。

## 0. そもそも書くのか

| 変えたもの | 更新履歴 | ヘルプ | 助手の告知 |
| --- | --- | --- | --- |
| 機能の追加・変更・不具合修正（プレイヤーに見える） | ○ | ○ | 大きい追加のときだけ |
| マーケットに商品が並んだ | ○ | 自動（`{t:'data'}`） | ○ `type:'market'` |
| 新曲・新モード・新難易度・新しい助手 | ○ | 自動 | ○ `type:'content'` / `'mode'` |
| 見た目の改善・並び替え・絵の追加・小さな機能・不具合修正 | ○ | 該当項目があれば | **付けない** |
| `DEBUG_SETTINGS` 配下だけの変更・デバッグ画面 | **書かない** | 不要 | 不要 |
| 譜面生成ツールの強化（既存曲の譜面が1音も変わらない） | **書かない** | 不要 | 不要 |
| ドキュメント・スキル・検査ツールだけの変更 | **書かない** | 不要 | 不要 |

迷ったら「公開初日に遊ぶ人がこれを読んで意味が分かるか」で決める。

## 0-2. プレイヤー向けの文にする（作業報告にしない）

2026-09-18にユーザーが指摘した（「更新情報はよくあーいう形になってるから、今後はプレイヤー向けに出すようにして」）。
**更新履歴は作業報告ではない。** 遊ぶ人が読んで「自分にとって何が変わるか」が分かる文にする。

**書かないもの**

| 書かない | 例 | どう書くか |
| --- | --- | --- |
| ゲームの外の数え方 | 「全60場面へ3本ずつ」「1,691本から2,095本」 | 「同じ画面を開いても前と違うことを言うようになります」 |
| 開発工程の語 | 「検査を追加しました」「キャッシュキー」「内部的に」 | 「同じ間違いが二度と起きないようにしました」 |
| 作業の都合 | 「さきほど」「今回はそのままです」「見送っていた」 | 書かない（あとから嘘になる） |
| 数を誇るタイトル | 「セリフを400本以上追加しました」 | 「助手が同じことを言う回数を減らしました」 |

**やること**

- **タイトルは「何が良くなったか」。** 遊んでいて気づく変化で書く
- **同じ日の同じ出来事は1件にまとめる。** 作業を2回に分けたのは作り手の都合
- **不具合の修正は `type:'fix'` で分ける。** 「増やしました」の中に「出ていなかったものが出るようになりました」を混ぜない
- 数字を書くのは、**プレイヤーが判断に使う数字のときだけ**（報酬の個数・必要ポイント・難易度の倍率・曲のレベルとノーツ数など）

`node tools/changelog/player-words-check.js`（必須検査に入っている）が、上の3種類を機械で拾う。
「同じ日に2件へ割れていないか」は中身を読まないと判断できないので検査していない。**そこは自分で見る。**

## 1. 時刻は必ず実時刻を取る

```bash
TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'
```

**出た値をそのまま `date` に書く。** `21:00` `20:40` のようなきりのいい連番を自分で決めない。
過去に2回やらかしている（1回目は日付が2日先、2回目は日付は合っていて時刻だけ未来）。
`changelog-order-check.js` が**gitのコミット時刻と1時間以上ずれていないか**まで見るので、
先に書いて後からコミットすると落ちる。書いたらその日のうちにコミットする。

## 2. 更新履歴に1件足す

`monster-hero/data/changelog.js` の **`const CHANGELOG = [` の直後（＝配列の先頭）** へ足す。

```bash
node tools/where.js --text "const CHANGELOG = ["   # 行番号を出す
head -80 monster-hero/data/changelog.js            # 先頭だけ読む（全文は0.5MBある。開かない）
```

```js
const CHANGELOG = [
  {
    date: "2026-09-16 18:05", type:'update', title:'〜できるようになりました', status:'new',
    items:[
      'なにが変わったか。プレイヤーの言葉で、1文ずつ。',
      '条件・上限・例外があるなら、ここに書く。',
    ],
  },
```

| キー | 必須 | 中身 |
| --- | --- | --- |
| `date` | ○ | `"YYYY-MM-DD HH:MM"`（JST実時刻。①のとおり） |
| `type` | ○ | `update`（機能追加・変更） / `fix`（不具合修正） / `issue`（不具合情報タブへ出る） / `market` / `mode` / `content` / `feature` |
| `title` | ○ | 一覧に出る1行。**正式名称で書く**（音ゲーは「モンヒロビート」。略称「モンビー」はキャラの会話だけ） |
| `status` | ○ | `'new'`（NEWマーク） |
| `items` | ○ | 本文の配列。**空にしない**（空だと告知が作られない） |
| `group` | 任意 | `rhythm` / `masu` / `battle` / `items` / `ranking` / `assistant` / `ui` / `other`。**書かなければタイトルと本文から自動で見当が付く**ので、見当が外れるときだけ書く |
| `assistantNotice` | 大きい追加のみ | ③を見る |
| `image` | 新曲のとき必須 | `'images/song-art/◯◯.jpg'`。`?v=` は手で書かない |
| `link` | 任意 | `{url,label}`。**https だけ通る**（`changelogSafeLink`） |
| `releaseFlag` | 任意 | 公開フラグ名。本番へ出るまで更新履歴にも告知にも出ない |
| `dev` | 任意 | `true` にすると**どちらのタブにも出ない**。プレイヤーがまだ触っていない機能の作業メモ用 |
| `visibleFrom` | 任意 | `'2026-09-11T15:00:00+09:00'`。この時刻まで一覧に出さない |

`type` と表示タブの関係：`issue` だけが「不具合情報」タブ、それ以外は全部「更新情報」タブ。

## 3. 助手の告知（大きい追加のときだけ）

更新履歴のエントリへ1行足すだけ。助手が一度だけ知らせて、行き先のボタンを出す。

```js
    assistantNotice:{ id:'update_notice_◯◯_v1', type:'content' },
```

- `type` は**3つだけ**。`market`（マーケットに商品が並んだ／ボタン「マーケットを見る」）/
  `mode`（バトルの新モード・新難易度／ボタン「バトルへ行く」）/
  `content`（新曲・新しい助手・新しい育成システム・キャンペーンなどの新しい遊び）。
  以前の `feature` は廃止。3つ以外を書くと告知にならない
- `id` は `update_notice_◯◯_v1` の形。**既存のidは使い回さない**（見た人には二度と出ない）
- 本文は `items` がそのまま読み上げられる。`image` を書いてあれば**告知にも同じ絵が出る**（2か所に書かない）
- 期間で出し入れするなら `notifyFrom` / `notifyUntil` を `assistantNotice` の中へ。
  **`visibleFrom` と `notifyFrom` は同じ時刻にそろえる**（一覧と告知が同時に出はじめる）
- 助手ごとの口調で話させたいときだけ、`data/assistants.js` の
  `ASSISTANT_UPDATE_NOTICE_SCRIPTS[告知id][助手id] = [{e:表情, t:セリフ}, …]` を足す。
  書かなければ `items` をそのまま読む（既存の告知は何も変わらない）。
  呼び方の決めごと：**みゅあ・ももすけは「モンビー」、ききは「モンヒロビート」**

> ⚠️ 時刻で出し入れするものに、**読み込み時に1回だけ決まる値を使わない**。
> 開始前に起動して開きっぱなしの端末では、その答えが永久に残る。
> `enabled` がまさにそれなので、期間の判定は `notifyFrom` / `notifyUntil` に任せる。

## 4. 前に書いたお知らせも直す

**新しい項目を足すだけで終わらせない。** 更新履歴の `items` は
そのまま助手の告知の本文になるので、放っておくと助手が古い数字を読み上げる。

- 譜面を作り直した・レベルやノーツ数が変わった → 前に書いた項目の数字も直す
- 仕様が変わった → その機能を説明している過去の項目を直す

`node tools/changelog/song-numbers-check.js` が曲のレベルとノーツ数を実データと突き合わせる
（「Lv.11→9」のように変化を書いている行は対象外）。

## 5. ヘルプを更新する

`monster-hero/data/help.js`（1797行。`grep -n` → `sed -n` で必要なところだけ読む）。

1. **該当するトピックの本文を書き直す。** 無ければ新しく作る
2. **画面（`gameState`）を増やしたら `HELP_SCREEN_COVERAGE` にも足す**（`help.js` 末尾付近）
3. **一覧になるものは手で書き写さない。** `{ t:'data', id:'…' }` を使う。使えるid：

   ```
   assistantBond assistantBondActions assistants difficulties extremeDifficulties
   items levelUpPointMultipliers loginBonus masuCosts missionsDaily missionsMonthly
   missionsWeekly monsterLineages monsterPower profileFrames psycheRewards
   rhythmDemoSongLevels rhythmDemoSongList rhythmDifficultyRanks rhythmDifficultySpread
   rhythmEventPlayBonus rhythmMonsterAbilities rhythmSongArtwork rhythmWeeklyRewards
   skipTickets speciesChallengeLineages speciesChallengeRewards teachings
   ```

   実データから表が作られるので、**新曲・新アイテム・新フレームはヘルプを触らなくても自動で載る**。
   足りないidを増やすときは `game-system.jsx` の `helpDataRows(id)` 側（＝`src/parts/*.jsx`）へ足す
4. **新しいトピックには `assistant`（助手のひとこと）を必ず1つ付ける**
5. **既存の `id` は変えない**（ヘルプ内のリンクと「前回見ていた場所」の保存が指している）
6. 本文のブロックは `p` / `note` / `list` / `steps` / `kv` / `data` の6種類

## 6. 大きい追加は「画面のなかでの案内」もセットで

ヘルプと更新履歴は**探しに行った人しか読まない**。別の画面へ移る・裏で動き続ける・
ある条件のときだけ止まる、といった気づけない仕組みを足したときは、公開と同時に画面の中でも伝える。

- `data/assistants.js` の `ASSISTANT_SCENES` へ場面を1つ足し、`<AssistantBubble scene="…"/>` を置く
- セリフは `addAssistantLinePack({ id, lines })` で束にして足す（`ASSISTANT_SCENES` を直接書き換えない）
- 一度きりの案内には**新しい** `mh_◯◯_seen_v1` を作る。既存の保存キーは触らない（CLAUDE.md ⑦）
- 公開フラグを持つ機能なら、案内も**同じフラグ**で出し入れする
- 対象は助手の告知と同じ基準で、**大きい追加のときだけ**

## 7. 検査

```bash
cd tools && npm install && cd ..        # 最初に1回だけ。無いと @babel/core が見つからず検査が落ちる
node tools/run-checks.js --area required 2>&1 | tail -20
```

`required` の14本に、このスキルが関わる7本が入っている（`help-coverage` `help-guide`
`help-render` `assistant-check` `assistant-bond` `boot/market-notice`
`assistant/assistant-update-notice` ほか）。それに加えて、触った内容に応じて次を回す。

```bash
node tools/boot/changelog-order-check.js              # 日時・書式・並び・コミット時刻とのズレ（毎回）
node tools/changelog/dev-entry-check.js               # 作業メモが更新情報に並んでいないか（毎回）
node tools/changelog/type-badge-check.js              # 不具合と新機能が見分けられるか
node tools/changelog/changelog-group-check.js         # 話題ごとのまとめ
node tools/changelog/collapsed-detail-check.js        # 一覧→詳細の開き方（実ブラウザ）
node tools/changelog/song-numbers-check.js            # 曲のレベル・ノーツ数（④）
node tools/changelog/song-art-notice-check.js         # 新曲のお知らせにジャケットが付いているか
node tools/changelog/external-link-check.js           # link を書いたとき
```

**落ちたら検査側を緩めない。** これは「ヘルプ・更新履歴の更新漏れ」を見つけるためのものなので、
ヘルプや更新履歴のほうを直す。

### NG の読み方

| 出るもの | 直すところ |
| --- | --- |
| `help-coverage-check` が画面名を名指し | その `gameState` を `HELP_SCREEN_COVERAGE` へ足す |
| `help-coverage-check` がデータの取りこぼしを名指し | ヘルプのそのトピックを `{t:'data'}` に替える |
| `help-guide-check` が数値の食い違い | 手で書いた数値が古い。`{t:'data'}` にするか直す |
| `changelog-order-check` が「未来の日時」 | ①をやり直す。実時刻を取って書き直す |
| `changelog-order-check` が「コミット時刻とずれ」 | 書いてから時間が空いた。時刻を取り直して書き直す |
| `market-notice-check` | 商品を足したのに `assistantNotice` が無い |
| `assistant-update-notice-check` | `type` が3種以外／`id` の形が違う／使い回している |
| `song-numbers-check` | 過去の項目の数字が古い（④） |

## 8. 公開まで

CLAUDE.md ②③のとおり、**確認を取らずに最後まで進める**。

```bash
node tools/build.js                      # 忘れると変更が反映されない
node tools/run-checks.js --area required 2>&1 | tail -20
git add -A && git commit
git fetch origin main                    # ★PRを作る直前に取り込む（コンフリクトはほぼこれで防げる）
git push -u origin <branch>
# PR作成 → squash merge → git fetch origin main && git reset --hard origin/main
```

## 実際に踏んだ落とし穴

### 更新履歴のマージで、main の項目を消す
新しい項目は**先頭に足す**規則なので、同じ場所を別のPRも触っている。コンフリクトしたら
**どちらの項目も残す**（日時の降順に並べ直す）。片方を捨てると、mainへ入っていたお知らせが消える。

### 助手が古い数字を読み上げる
`items` がそのまま告知の本文になることを忘れて、新しい項目だけ足した。④のとおり前の項目も直す。

### 並び順を書いた順に頼る
画面に出る並び順は `CHANGELOG_ENTRIES` が**日付の降順に並べ替えて**決めている。
さらに `data/rhythm-step3-release.js` が起動時に `CHANGELOG.unshift` で古い項目を先頭へ
差し込むため、書いてある順の先頭が古いままに見えることがある。**そこは触らない。**

### お知らせに、ほかの曲の Lv. を並べる
「これまでの最高は EASY Lv.10／…」と比較を書いたら、どちらがこの曲の難易度か分からなくなった。
**書いてよい Lv. はその曲のものだけ。** 上下を伝えたいなら数字を出さずに書く。

### レベルとノーツ数を1行に詰める
`EASY Lv.14（376ノーツ）／…` は折り返した画面で数字が追えない。
`レベルは EASY Lv.◯ ／ … です。` と `ノーツ数は ◯ ／ … です。` の**2行に分ける**。

### 略称で書く
画面に出る名前は**正式名称**。「モンビー」を使ってよいのはキャラクターが愛称として呼ぶ会話だけ。
ボタンの幅が足りないときは、字を小さくするか折り返して正式名称のまま入れる。
