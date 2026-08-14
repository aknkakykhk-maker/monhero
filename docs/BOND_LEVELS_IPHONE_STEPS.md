# iPhoneでの絆Lvランキング用テーブル追加 実行順

`public.bond_levels` を新しく1つ追加する作業です。**既存の `rankings` には触りません**（DROP・DELETE・ALTER・RLS/権限の変更をしません）。各SQLは新しいクエリにファイル全体を貼り付けて実行します。エラーが出た工程では次へ進まず、結果を保存して共有してください。

> **Supabase の SQL Editor は、ファイル全体を実行すると「最後の1文」の結果しか表示しません。**
> そのため4本とも、**最後の1文が「まとめ」**になっています。確認したい値はすべてそこに縦に並ぶので、
> 1回 Run して出てきた表をスクリーンショットするだけで大丈夫です。個別の結果を見たいときだけ、
> その文を選択して Run してください。

## なぜ追加するのか

絆Lvは編成（`party`）のJSONの中に入っているため、**DB側で「絆Lvの高い順」に並べられません**。そのため新着順に120行だけ取ってアプリ側で開いて集計しており、よく遊ぶ人の記録で枠が埋まると、しばらく遊んでいない人が一覧から丸ごと消えます（ブリーダーLvで2度起きたのと同じ構造の問題）。

`bond_levels` は **1人 × 1個体で必ず1行**になるので、記録が何回増えても人が消えません。並べ替えもDB側で完結し、取得は1回・数十KBで済みます（いまは1行が約2.2KBあり、枠を広げると数MB級になります）。

## 手順

1. **Safari で Supabase Dashboard を開く**
   プロジェクト `zrzevudkbgtxlbvmuziy` を選び、左のメニューから **SQL Editor** → **New query**。
2. **`BOND_LEVELS_AUDIT.sql` を実行**（読み取り専用）
   最後に出る「まとめ」の表で、**`bond_levels が既に在るか` が `0`（判定が「OK: 空いている」）**であることを必ず確認します。1以上なら同名の何かが既にあるので、そこで停止してください。
3. **まとめの表をスクリーンショット**
   とくに **`rankings の件数`** は適用後に比べるので必ず残します。保存できなければ次へ進みません。
4. **`BOND_LEVELS_APPLY_TEST.sql` を実行**（末尾が `rollback;`）
   実適用と同じSQLを一度通す予行演習です。**この実行では何も保存されません**。成功すると、追加予定のカラム一覧・索引（`is_valid` と `is_ready` が `true`）・ポリシー3件が表示されます。
5. **エラーがないことを確認**
   赤いエラー表示が無いことを確認します。エラーが出たらそこで停止し、実適用へ進みません。
6. **`BOND_LEVELS_APPLY.sql` を実行**（末尾が `commit;`）
   同じ安全確認を通ったうえで変更を保存します。最後に `notify pgrst, 'reload schema';` が走り、Data APIが新しいテーブルを認識します。
7. **`BOND_LEVELS_VERIFY.sql` を実行**（読み取り専用）
   最後の「まとめ」の表で、次をすべて確認します。
   - `テーブル` が `1`
   - `主キー` が `PRIMARY KEY (user_name, individual_id)`
   - `索引(valid/ready)` が3つとも `true/true`
   - `RLS` が `有効`
   - `ポリシー` が `insert` / `select` / `update` の3つ
   - `権限` に **DELETE が無い**（`INSERT` / `SELECT` / `UPDATE` だけ）
   - `updated_atのトリガー` が `bond_levels_set_updated_at`
   - `rankings の件数` が手順3と同じ
   - `bond_levels の件数` は `0`（この時点では空で正常）
8. **ここまでの結果を共有**
   問題がなければ、アプリ側を新テーブル対応にする作業（担当: Claude）へ進みます。
9. **アプリ公開後にもう一度 `BOND_LEVELS_VERIFY.sql`**
   ゲームを1周してから実行し、まとめの `bond_levels の件数` が増え、`絆Lv上位5件` に自分の記録が並ぶことを確認します。

## 成功判定

- 既存 `rankings` の件数・RLS・ポリシー・権限が適用前後で同じ。
- `bond_levels` が主キー `(user_name, individual_id)` で作られている。
- 索引2つが妥当（`is_valid` / `is_ready` とも `true`）。
- ポリシーは `select` / `insert` / `update` の3つだけで、`delete` は誰にも許可されていない。
- ゲームを1周すると `bond_levels` に行が増える。

## エラー時

- 手順4（`rollback;` の予行演習）でエラーが出た場合は、そのまま停止します。**トランザクションは保存されていません。**
- 手順6の実適用でエラーが出た場合も、`begin;` 〜 `commit;` の途中で止まるため保存されません。エラー文をそのまま共有してください。
- 適用後に取り消したい場合は、次の1文だけで元に戻ります。**既存データには影響しません。**

```sql
drop table public.bond_levels;
```

Supabase の管理者接続情報はリポジトリに保存しません。SQL Editor を操作できない場合は「未適用」と記録し、適用済みとは報告しません。

## 事前検証（済み）

PostgreSQL 16 のローカル環境に、Supabaseと同じ前提（`anon` / `authenticated` ロール、RLS付きの `rankings`、既存データ5件）を用意し、この4本のSQLをそのまま流して確認済みです。

- `BOND_LEVELS_AUDIT.sql` … エラーなく「まとめ」の表が出る
- `BOND_LEVELS_APPLY_TEST.sql` … 最後に `ROLLBACK` され、`bond_levels` は**残らない**（0件）
- `BOND_LEVELS_APPLY.sql` … `COMMIT` → `NOTIFY` まで通り、主キー・索引2つ・ポリシー3つが作られる
- `BOND_LEVELS_VERIFY.sql` … 期待どおりの結果。`rankings` の件数・ポリシー・権限は適用前と同一
- **2回流しても安全**（`if not exists` で守っているため、既存データは消えない）
- アプリと同じ `anon` の立場で upsert を試し、同じ個体は**何度書いても1行のまま**、絆Lvは最新値で上書き（転生で下がる場合も追従）
- `updated_at` はトリガーで書き込みのたびに更新される
- `anon` からの `DELETE` は `permission denied for table bond_levels` で**拒否される**

## 覚えておきたいこと

- **ブリーダー名を変えると別人として並びます。** `user_name` を鍵にしているためで、いまのランキングと同じ挙動です。
- **公開キーで誰でも書き込める状態になります。** これは既存の `rankings` とまったく同じ信頼レベルで、新たなリスクではありません。より厳しくするなら認証の導入が必要です。
- **転生すると絆Lvは下がります。** そのため「高い方を残す」ではなく最新値で上書きします（いまの状態を映すため）。
- 削除の権限は誰にも与えません。消えたら復旧できないためです。

## このあとのアプリ側の作業（すべて完了）

1. ✅ プレイ終了時、いまの `rankings` への送信に加えて `bond_levels` へ upsert する
   （`POST /rest/v1/bond_levels?on_conflict=user_name,individual_id` ＋ `Prefer: resolution=merge-duplicates`）
2. ✅ 絆Lvランキングの取得を `bond_levels` の1回取得へ切り替える
3. ✅ **しばらくは新旧併用**にする。テーブルは最初空なので、`bond_levels` に記録がある人はそちらを使い、無い人は今までどおり `rankings` から集計して表示する
4. ✅ 併せて、絆Lvランキングにも「詳細 ›」ボタンを追加する（`detail` を持たない古い記録は押せない状態にする）

### 適用の記録

2026-08-14、iPhoneのSupabase SQL Editorから `BOND_LEVELS_APPLY_TEST.sql` → `BOND_LEVELS_APPLY.sql` → `BOND_LEVELS_VERIFY.sql` の順に実行し、適用済み。`rankings` の件数は前後とも504で変化なし。

適用の過程で、Supabaseがテーブル作成時に `anon` / `authenticated` へ全権限（DELETEを含む）を自動付与することが分かったため、`grant` の前に `revoke all` を入れる修正を加えている。最初の予行演習では権限に `anon:DELETE` が出ていたが、修正後は `INSERT` / `SELECT` / `UPDATE` の3つだけになることを確認済み。

### 検査

- `node tools/bond-levels-table-check.js` … Supabaseをスタブした実ブラウザで、テーブルあり／無しの両方と「詳細 ›」の挙動を確認する
- `node tools/bond-levels-schema-match-check.js` … アプリが送るリクエストの形（列名・`on_conflict`・`Prefer`）と、このディレクトリの `BOND_LEVELS_APPLY.sql` が食い違っていないかを突き合わせる。スタブでは列名の打ち間違いを検出できないため、`bond_levels` に削除の権限が無い（消せない）ことを踏まえて機械的に止める
