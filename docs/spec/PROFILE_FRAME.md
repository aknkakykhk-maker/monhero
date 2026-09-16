# プロフィールフレーム設計書

2026-09-15 にユーザーの依頼で実装した。ブリーダーアイコンの**外側**に重ねる飾り枠。

## 1. 何のためのものか

これまでプロフィールの見た目は「ブリーダーアイコン1枚」だけだった。そこへ**別レイヤーの飾り枠**を
足して、アイコンを変えずに見た目を変えられるようにする。

- **モンスターの絵そのものは加工しない。** 下層＝これまでのアイコン、上層＝フレーム、の2枚重ね
- 顔の位置調整（`MARKET_PROFILE_ICON_STYLES` の scale/x/y）は**そのまま**効く
- **ブリーダーアイコンとフレームは独立した設定。** 片方を変えても、もう片方は変わらない
- 既定は「フレームなし」。そのときの見た目は、この機能を入れる前とまったく同じ

## 2. 何があるか（`monster-hero/data/breeder.js`）

`PROFILE_FRAMES` が正本。1件は `{ id, name, kind, released, desc, className?, src? }`。

`none`（フレームなし）＋ **12色**。並び順は `PROFILE_FRAMES` のとおり。

`none` / `silver` / `gold` / `white` / `black` / `red` / `orange` / `green` / `aqua` / `blue` /
`purple` / `pink` / `rainbow`

すべて**画像を1枚も増やしていない**（`kind:'css'` で `conic-gradient` の輪を描く）。
一覧はヘルプへ手で書き写さず、`{ t:'data', id:'profileFrames' }` が実データから表を作る。

> **既存のidは消さない・変えない。** 選んでいる人がいるし、ランキングの記録
> （`profile_frame` 列）にも入っている（CLAUDE.md ⑦）。色を増やすときは並びへ足すだけにする。
> 2026-09-15 に `silver` / `gold` / `blue` / `pink` の4色から8色足して12色にしたときも、
> 既存の4つはそのまま残した。

### 2.0 輪の太さ（2026-09-15・ユーザー指摘「太すぎてかっこ悪い」）

太さは px で書かず、`inset` と `mask` の割合で決める。いまの値は

| | 値 |
| --- | --- |
| `.mh-profile-frame` の `inset` | `-5.5%` |
| `.mh-profile-frame-ring` のくり抜き | 内側 `86.5%` |
| 輪の太さ（アイコン幅に対して） | **7.5%** — 32pxで約2.4px / 80pxで約6.0px |
| アイコンにかぶさる量 | 半径の **4%** だけ（ほとんど隠さない） |

はじめは 13.7%（80pxで11px）あって太すぎた。`node tools/ranking/profile-frame-check.js` が
この3つ（太すぎない・小さくても見える・アイコンを隠さない）を数字で見張るので、
値を戻してしまったら気づける。

### 2.1 助手の仲良し度でもらえる枠（2026-09-16）

**助手1人につき3枚**。その助手との仲良し度が **Lv2 / Lv5 / Lv7** になると自動でもらえる。

| 助手 | Lv2 | Lv5 | Lv7 |
| --- | --- | --- | --- |
| みゅあ | `frame_mua_1` みゅあのリボン（0.669） | `frame_mua_2` みゅあのスターリース（0.604） | `frame_mua_3` みゅあといっしょ（0.591） |
| きき | `frame_kiki_ouen` きき・応援（0.755） | `frame_kiki_honki` きき・本気（0.698） | `frame_kiki_zenryoku` きき・全力全開（0.677） |
| ももすけ | `frame_momosuke_1` ももすけのリボン（0.737） | `frame_momosuke_2` ももすけのムーンリース（0.635） | `frame_momosuke_3` ももすけといっしょ（0.609） |

括弧内は `hole`。どの助手も、段階が上がるほど飾りが増え、**Lv7では本人が枠に入る**。

#### `released` と `unlock` はまったく別物 ★重要

| 書くもの | 意味 | false / 未設定のとき |
| --- | --- | --- |
| `released` | **描いてよいか** | 選択画面に出ない。**他人の記録に入っていても描かれない** |
| `unlock` | **自分が選べるか** | 条件なし＝最初から選べる |

**ここを一緒にすると「解放した人の枠が、他人のランキングで消える」。** もらえる枠は
すべて `released:true`（誰の画面でも描く）にしたうえで、`unlock` で自分が選べるかだけを分ける。

#### まだ配り方を決めていない枠（`released:false`）

| id | 名前 | 絵 | `hole` |
| --- | --- | --- | ---: |
| `frame_mocchi` | モッチー | `mocchi.png` | 0.656 |
| `frame_moo` | ムー | `moo.png` | 0.682 |
| `frame_suezo_beat` | スエゾービート | `suezo-beat.png` | 0.724 |

助手とは無関係のモンスター柄。配り方が決まるまで未公開のまま置いてある。
`moo` はラスボス「ムー」の既存id（`ENEMY_MONSTERS.Moo`）に合わせてある。

### 2.1.1 もらう・持つ（`data/breeder.js`）

| 関数 | 何をするか |
| --- | --- |
| `profileFrameUnlock(frame)` | もらう条件（助手id・Lv）。条件なしなら `null` |
| `profileFrameOwned(id, owned)` | **いま選べるか**。条件なしの枠は常に true |
| `profileFramesForAssistant(id)` | その助手の枠を、もらえるLvの小さい順に |
| `profileFramesEarnedAt(id, lv, owned)` | そのLvで新しくもらえるidの一覧。**間のLvを飛ばしても取りこぼさない** |
| `nextProfileFrameForAssistant(id, lv, owned)` | 次にもらえる枠（全部持っていれば `null`） |

保存キーは **新設のみ**の `mh_profile_frame_owned_v1`（もらったidの配列）。
既存の `mh_*` は読みも書きも変えない（CLAUDE.md ⑦）。

**一度もらったら絶対に外さない。** 助手を切り替えても、あとから条件を変えても残す
（取り上げになるため）。だから「いまのLv」ではなく「もらった記録」を持つ。

### 2.1.2 配るところ（`60-app.jsx`）

- **仲良し度が上がった瞬間**（`addAssistantBondFor`）。★いま選んでいない助手でも配る。
  アシストカード経由でその助手の仲良し度が増える経路があるため
- **起動してセーブデータを読み終えたとき**。★この更新より前から仲良し度が高い人へ、
  その場でまとめて配る。追いつかせないと「Lv10なのに1枚も無い」になる

### 2.1.3 どう知るか

| どこ | 何が出るか |
| --- | --- |
| フレーム選択画面 | 未所持も**絵を見せて鍵だけ**付けて並べる。名前の下に「みゅあ Lv5」 |
| 同・鍵を押したとき | 「みゅあとの仲良し度 Lv5 でもらえます ／ いまは Lv3 ／ あと 620」 |
| プロフィールの仲良し度の下 | 「次にもらえる飾り枠」を1行（押すと選択画面へ） |
| もらった瞬間 | 助手が知らせる（`unlock_profile_frame_v1`） |
| ヘルプの表 | もらう条件を**実データから**出す（手で書き写さない） |

見せ方は 2026-09-16 にユーザーが選んだ（シルエットで隠さず、絵を見せて鍵だけ付ける）。

**お知らせは、もらうたびに出し直す。** 1つのidで既読にすると2枚目以降が永久に知らされないので、
知らせ済みは**枠ごと**に覚える（`mh_profile_frame_notice_v1`）。
ほかの案内（呼び方・種族チャレンジ）より後ろに回る作りはそのまま。
ききの3枚は同じ意匠を段階的に豪華にしたもので、**段階の呼び分けは教えカードの3段階
（`BREEDER_EVO_NAMES.kiki` の 応援 → 本気 → 全力全開）にそろえた**。

出す／出さないの判定は **`normalizeProfileFrameId` の1か所だけ**。ここが
知らないid・壊れた値・`released:false` のidを**すべて `'none'` へ倒す**ので、

- 選択画面に出ない（`releasedProfileFrames()` が公開済みだけを返す）
- 保存値に入っても「フレームなし」になる
- ランキングで他人の記録に入っていても描画されない

の3つが同時に成り立つ。**公開するときは `released:true` へ変えるだけでよい。**
見た目だけは DEBUG（設定 → ヘルプ → いちばん下の 💊 → 「プロフィールフレーム見た目確認」）で
確かめられる。そこは表示専用で、保存もしないし所持状態にも触らない。

説明（`desc`）は仮で、公開するときに整える。

### 2.2 画像の取り込み方

元絵は 1254×1254 の透過PNG（1.2〜1.9MB）。そのままは入れない（CLAUDE.md ⑥-2）。

- **384×384 へ縮小**して `sharp` の `png({palette:true, quality:92, effort:10})` で書き出す。
  6枚あわせて 281KB（元は 9.9MB）
- 384 なのは、いちばん大きく出るのがプロフィールの 80px で、枠はその約1.3倍、
  端末の3倍密度でも 310px に収まるから
- **切り取らない・引き伸ばさない。** 正方形のまま縮小するだけ（縦横比を変えない）
- `?v=` は手で書かない（`tools/stamp-version.js` が中身のハッシュから付ける）
- 起動時の読み込み（`index.html` の `SIZES`）には**入らない**。開いたときに初めて読む側にある

### 2.3 重ねる位置（`hole` と `profileFrameImageStyle`）

絵ごとに**穴（中央の透明な円）の大きさが違う**ので、1つのCSSではそろわない。
`hole`（穴の直径 ÷ 画像の幅）をデータに持たせ、そこから大きさと位置を計算する。

```
枠の箱の幅 ÷ アイコンの幅 = PROFILE_FRAME_HOLE_FIT / hole        (= 0.98 / hole)
```

`PROFILE_FRAME_HOLE_FIT = 0.98` は「アイコンをほとんど隠さず、境目だけ少し重ねる」値。
**6枚まとめて寄り引きしたくなったら、ここだけ変える。**

- ★`width` / `height` を必ず書く。`<img>` は `inset` だけでは広がらず、さらに Tailwind の
  `img{max-width:100%}` でアイコンと同じ大きさに抑えられる（2026-09-15 に実際にそうなった）。
  `maxWidth:'none'` も一緒に外す
- `hole` が読めないときは 1.32 倍へ倒す（絵は出るが位置はそろわない）
- `node tools/ranking/profile-frame-check.js` が**実際のPNGを測って** `hole` と突き合わせる。
  絵を差し替えて穴の大きさが変わったら、そこで気づける

## 3. 描き方（`20-market-notices-help.jsx` / CSSは `70-bootstrap.jsx`）

画面ごとに別実装しない。共通部品は2つだけ。

```jsx
<ProfileFrameLayer frameId={…}/>   // 枠だけ。円の外側まで描く
<ProfileAvatar src={…} id={…} frameId={…} className="w-8 h-8"/>  // 下層＋上層をまとめたもの
```

- 既存の `BreederIcon` は**変えていない**。`ProfileAvatar` がその外側に枠を足すだけ
- **大きさの指定（`w-8 h-8` など）は外側へ**付ける。内側は `w-full h-full`
- 枠の太さは `inset:-5.5%` と `mask: radial-gradient(closest-side, …)` の**割合**で決まるので、
  ランキングの 32px でもプロフィールの 80px でも同じ見え方になる（実測：32px で 1.75px、
  80px で 4.4px はみ出す）
- `pointer-events:none`。枠がボタンのタップを食べない
- 外側は `overflow:visible`。**フレーム側を切らない**（内側のクリップは `ProfileAvatar` が持つ）
- `badge`（プロフィールの鉛筆マークなど）は内側の円に入り、これまでどおりクリップされる
- 画像フレームは `object-fit:contain`。**透過PNGの縦横比を変えない**
- フレームを選んでいるときは、HOME左上とプロフィールの**もとから付いている縁を消す**
  （`is-framed` / `hasProfileFrame`）。枠が二重に見えないようにするため

## 4. 出る場所・出ない場所

**出る**

- HOME左上のプロフィールアイコン
- プロフィール画面のアイコン
- アイコン選択画面の「いまの見た目」、フレーム選択画面のプレビュー
- 全国ランキングすべて（`rankingBreederIcon` を通る画面がすべて対象）
  … バトルのスコア／ブリーダーLv／絆Lv／総合力、モンヒロビートの曲別／全曲合算／週間／
  イベント／ランキング履歴。**他のブリーダーが選んだフレームも出る**

**出ない**

- モンスター図鑑、マーケットの商品画像、円盤石、通常のモンスターアイコン

> 絆Lv・総合力ランキングだけは `rankings` ではなく専用テーブル `bond_levels`（1人×1個体で1行）
> から読む。2026-09-15 にそちらへも同じ `profile_frame` 列を足した（[`RHYTHM_RANKING.md`](RHYTHM_RANKING.md) §8.10）。
> 「列があるか」はテーブルごとに別々に覚えるので、片方だけSQLを当てた状態でも取り違えない。

## 5. 保存（`mh_profile_frame_v1`）

- **新しいキーを1つ足すだけ。** 既存の `mh_breeder_icon` は読みも書きも変えていない（CLAUDE.md ⑦）
- 値は文字列のid。既定は `'none'`
- 読み込みは必ず `normalizeProfileFrameId` を通す。項目が無い既存プレイヤー・壊れた値・
  知らないid・未公開のidは**すべて「フレームなし」**になる
- 選んだその場で反映して保存する（`selectProfileFrame`）。保存に失敗しても表示は変わり、
  ゲームの進行は止めない

## 6. ランキングへの保存

`rankings` へ NULL許容の `profile_frame` 列を1つ足す。詳細と適用手順は
[`RHYTHM_RANKING.md`](RHYTHM_RANKING.md) §8.9 と
[`../sql/rankings/PROFILE_FRAME_IPHONE_STEPS.md`](../sql/rankings/PROFILE_FRAME_IPHONE_STEPS.md)。

- フレームなしのときは**列ごと付けない**（既存の記録と同じく NULL のまま）
- 列がまだ無い環境では、送るときも出すときも**その列だけ外して**やり直す。
  SQLの適用とアプリの公開はどちらが先でもよい
- **順位・スコア・集計方法は何も変えていない**

### 6.1 `total_score` の型（2026-09-15・予行演習が止まった）

本番で `PROFILE_FRAME_APPLY_TEST.sql` を流したら、こう言われて止まった。

```
ERROR: 42P16: cannot change data type of view column "total_score" from numeric to bigint
```

**リポジトリのSQLに書いてある姿と、本番のビューの姿がずれていた**のが原因。

1. `RHYTHM_TOTAL_APPLY.sql` は `sum(b.score)::bigint as total_score` と書いている
2. そのころ `rankings.score` は `int4` で、`sum(int4)` はもともと `bigint`。
   つまりこの `::bigint` は**何も変換していない**ので、PostgreSQL は保存する定義から取り除く
3. あとで `RANKINGS_SCORE_BIGINT_APPLY.sql` が `score` を `bigint` へ広げた。
   このSQLはビューを `pg_get_viewdef`（＝いま動いている定義）で作り直すため、
   戻ってきた定義には `::bigint` が無い
4. `score` が `bigint` になった今、`sum(bigint)` は **`numeric`**。
   本番の `total_score` は numeric になっていた
5. `create or replace view` は列の型を変えられないので、`bigint` に戻そうとして止まった

**直し方**: このSQLでは `sum(b.score)::numeric` と明示して、本番と同じ型で作り直す。
集計の値は変わらない（合計は整数のまま）。念のため先頭の点検で現在の型を見て、
numeric でなければ「どこをどう書き換えればよいか」を日本語で言って止まるようにした。

> **教訓**: `pg_get_viewdef` で作り直された後のビューは、リポジトリのSQLと字面が違うことがある。
> 既存のビューを `create or replace` するSQLを書くときは、
> **本番の列の型を先に確かめる**か、下の `profile-frame-sql-check.js` のように
> 本番と同じ順でSQLを流した環境で試す。

## 7. 検査

```
node tools/ranking/profile-frame-check.js
node tools/ranking/profile-frame-sql-check.js   # PostgreSQL があるときだけ
```

`profile-frame-sql-check.js` は、本番と同じ順番でSQLを流した使い捨てのデータベースを作り
（`RHYTHM_TOTAL_APPLY` → … → `RANKINGS_SCORE_BIGINT_APPLY` まで）、そのうえで
`PROFILE_FRAME_APPLY_TEST` → `APPLY` → `VERIFY` を通す。§6.1 のずれもここで再現しているので、
同じことが起きたら気づける。PostgreSQL が無い環境では SKIP する。

未公開フレームが漏れないこと、共通部品を全画面が通ること、図鑑・マーケットに付かないこと、
列が無い環境でもスコアが必ず保存されること（実際に送信関数を動かす）、
順位・スコアの決め方が変わっていないことを見る。

## 8. これから決めること（未実装）

**助手の枠（9枚）は 2026-09-16 に公開した**（§2.1）。残っているのは次だけ。

- モンスター柄の3枚（モッチー・ムー・スエゾービート）の配り方。
  マーケット販売 / ビートP交換 / イベント報酬 / ミッション / 図鑑 など、何も決めていない
- 決まったら `released:true` にして、`unlock` に条件を書く。
  いまの `unlock` は助手の仲良し度だけを見る形なので、別の条件を足すときは
  `profileFrameUnlock` と `profileFramesEarnedAt` を種類で分ける

### 8.1 小さいアイコンでの大きさ（公開前に決める）

豪華フレームは、いまの合わせ方（`PROFILE_FRAME_HOLE_FIT = 0.98` ＝ アイコンを隠さない）だと
**アイコンの幅の1.30〜1.49倍**になる。プロフィール（80px）では気持ちよく収まるが、
ランキングの32pxでは左右へ5〜8pxずつはみ出し、順位の数字や名前と重なる。

公開するときに、次のどれかを決める。

1. `PROFILE_FRAME_HOLE_FIT` を下げる（枠がアイコンへ深くかぶさる。顔が隠れる）
2. ランキングだけアイコンを小さくして、枠込みで32pxの枠内に収める
3. ランキングでは画像フレームを出さない（CSSの輪だけにする）

いまは未公開なので、どれも実装していない。DEBUG の一覧は3列・上下広めにして重なりを避けている。
