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

| id | 名前 | kind | released | 見た目 |
| --- | --- | --- | --- | --- |
| `none` | フレームなし | `none` | true | 何も重ねない（＝これまでの見た目） |
| `silver` | シルバー | `css` | true | 銀の輪 |
| `gold` | ゴールド | `css` | true | 金の輪 |
| `blue` | ブルー | `css` | true | 青の輪 |
| `pink` | ピンク | `css` | true | 桃色の輪 |

最初の5つは**画像を1枚も増やしていない**（`kind:'css'` で `conic-gradient` の輪を描く）。
一覧はヘルプへ手で書き写さず、`{ t:'data', id:'profileFrames' }` が実データから表を作る。

### 2.1 未公開フレーム（`released:false`）

豪華フレームのような「入手方法が決まるまで出さないもの」は `released:false` で登録する。
`kind:'image'` の場合、`src` は `monster-hero/images/profile-frames/` 以下の透過PNGのパス
（base64にしない。`?v=` は `tools/stamp-version.js` が中身のハッシュから付ける）。

出す／出さないの判定は **`normalizeProfileFrameId` の1か所だけ**。ここが
知らないid・壊れた値・`released:false` のidを**すべて `'none'` へ倒す**ので、

- 選択画面に出ない（`releasedProfileFrames()` が公開済みだけを返す）
- 保存値に入っても「フレームなし」になる
- ランキングで他人の記録に入っていても描画されない

の3つが同時に成り立つ。**公開するときは `released:true` へ変えるだけでよい。**
見た目だけは DEBUG（`DEBUG_SETTINGS` の「プロフィールフレーム見た目確認」）から確かめられる。
そこは表示専用で、保存もしないし所持状態にも触らない。

> **2026-09-15 時点で、未公開の豪華フレームは0件。** 依頼にあった透過PNGは
> このセッションの作業ディレクトリに届いていなかったため、画像を保存していない。
> 画像が届いたら `images/profile-frames/` へ置き、`PROFILE_FRAMES` へ
> `released:false` の1行を足す（コードの変更はそれだけ）。

## 3. 描き方（`20-market-notices-help.jsx` / CSSは `70-bootstrap.jsx`）

画面ごとに別実装しない。共通部品は2つだけ。

```jsx
<ProfileFrameLayer frameId={…}/>   // 枠だけ。円の外側まで描く
<ProfileAvatar src={…} id={…} frameId={…} className="w-8 h-8"/>  // 下層＋上層をまとめたもの
```

- 既存の `BreederIcon` は**変えていない**。`ProfileAvatar` がその外側に枠を足すだけ
- **大きさの指定（`w-8 h-8` など）は外側へ**付ける。内側は `w-full h-full`
- 枠の太さは `inset:-7%` と `mask: radial-gradient(closest-side, …)` の**割合**で決まるので、
  ランキングの 32px でもプロフィールの 80px でも同じ見え方になる（実測：32px で約2.2px、
  48px で約3.4px はみ出す）
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

> 絆Lv・総合力ランキングは `bond_levels` テーブルから読むことがあり、そこには
> フレームの列を足していない。その行は「フレームなし」で出る（[`RHYTHM_RANKING.md`](RHYTHM_RANKING.md) §8.9）。

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

## 7. 検査

```
node tools/ranking/profile-frame-check.js
```

未公開フレームが漏れないこと、共通部品を全画面が通ること、図鑑・マーケットに付かないこと、
列が無い環境でもスコアが必ず保存されること（実際に送信関数を動かす）、
順位・スコアの決め方が変わっていないことを見る。

## 8. これから決めること（未実装）

豪華フレームの**公開のしかた**は何も決めていない。次のどれも実装していない。

- マーケット販売 / ビートP交換 / イベント報酬 / ランキング報酬
- 解放条件 / 価格 / レアリティ / 期間限定

決まったら、`PROFILE_FRAMES` の `released` を切り替えるのに加えて
「所持しているか」を持つ仕組み（新しい保存キー）が要る。いまは所持の概念そのものが無く、
公開済みのフレームは全員が使える状態になっている。
