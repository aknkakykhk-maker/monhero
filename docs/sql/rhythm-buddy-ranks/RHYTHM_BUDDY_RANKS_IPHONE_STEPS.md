# iPhoneでのマスモンランキング用テーブル追加 実行順

`public.rhythm_buddy_ranks` を新しく1つ追加する作業です。**既存の `rankings` と `bond_levels` には触りません**
(DROP・DELETE・ALTER・RLS/権限の変更をしません)。

> Supabase の SQL Editor は、ファイル全体を実行すると「最後の1文」の結果しか表示しません。
> そのため3本とも、**最後の1文が「まとめ」**になっています。1回 Run して出た表を見るだけで確認できます。

## なぜ追加するのか

マスモン1体ごとの「ビートLv」と「難易度ごとの最高スコア」を、ゲームの「ランキング」→「マスモンランキング」に並べるためです。
`rhythm_buddy_ranks` は **1人 × 1マスモンで必ず1行**になるので、記録が増えても人が消えず、並べ替えもDB側で終わります。

## 手順

1. Safari で Supabase Dashboard を開く。プロジェクトを選び、左のメニューから **SQL Editor** → **New query**。
2. **`RHYTHM_BUDDY_RANKS_APPLY_TEST.sql`** を実行(末尾が `rollback;`。**何も保存されない予行演習**)。赤いエラーが出なければ次へ。
3. **`RHYTHM_BUDDY_RANKS_APPLY.sql`** を実行(末尾が `commit;`)。同じ安全確認を通ったうえで保存されます。
4. **`RHYTHM_BUDDY_RANKS_VERIFY.sql`** を実行(読み取り専用)。まとめの表で次を確認します。
   - `テーブル` が `1`、`主キー` が `PRIMARY KEY (user_name, individual_id)`
   - `RLS` が `有効`、`ポリシー` が `insert` / `select` / `update` の3つ
   - `権限` に **DELETE が無い**
   - `rankings の件数`・`bond_levels の件数` が、手順2〜3の前と同じ
5. ゲームでマルチの部屋にマスモンを呼んで1回遊ぶ(または、育ったマスモンがいる状態でゲームを開く)と、数秒後に行が増えます。
   もう一度 VERIFY を実行して、`rhythm_buddy_ranks の件数` が増え、`ビートLv上位5件` に並ぶことを確認します。

## 成功判定

- 既存 `rankings` と `bond_levels` の件数が適用前後で同じ。
- `rhythm_buddy_ranks` が主キー `(user_name, individual_id)` で作られ、ポリシーは select / insert / update の3つだけ。
- ゲームの「ランキング」→「マスモンランキング」が「準備中」ではなく、一覧(または「まだ記録がありません」)になる。

## エラー時

テスト・実適用とも `begin;`〜 の途中でエラーが出ると、何も保存されません。エラー文をそのまま共有してください。
適用後に取り消したいときは、次の1文だけで元に戻ります(既存データには影響しません)。

```sql
drop table if exists public.rhythm_buddy_ranks;
notify pgrst, 'reload schema';
```
