# iPhoneでの全曲合算ランキング用ビューの作成 実行順

モンビーの「ブリーダー別 全曲合算ランキング」を出すための、**読み取り専用の集計ビュー**を作る作業です。**既存の `rankings` の行・列・RLS・ポリシー・権限には触りません**（DROP・DELETE・UPDATE・ALTERをしません）。

足すのは次だけです。

- 読み取り専用のビュー5枚
- 除外テーブル1つ（平常時は空。曲を下げることになったときだけ使う）
- `rankings` のモンビー行だけを見る索引2つ

> **Supabase の SQL Editor は、ファイル全体を実行すると「最後の1文」の結果しか表示しません。**
> そのため3本とも、**最後の1文が「まとめ」**になっています。1回 Run して出てきた表を
> スクリーンショットするだけで大丈夫です。

> **「Run and enable RLS」ではなく「Run without RLS」を選んでください。**
> ビューを作るだけで、既存データには何もしません。

## なぜビューを作るのか

合算ランキングは「その人の曲ごとのベストを、全曲ぶん足した合計」で競います。これを端末側で計算しようとすると、**全曲・全難易度の記録を端末が全部ダウンロードする**ことになり、記録が増えるほど「読み込みが終わらない」状態に近づきます（2026年7月に実際に起きています）。

サーバー側で合計まで済ませてしまえば、端末が受け取るのは**上位50人ぶんの数十行だけ**です。曲が何曲増えても通信量は変わりません。

## 手順

1. **Safari で Supabase Dashboard を開く**
   プロジェクト `zrzevudkbgtxlbvmuziy` を選び、左のメニューから **SQL Editor** → **New query**。
2. **`RHYTHM_TOTAL_APPLY_TEST.sql` を実行**（末尾が `rollback;`）
   実適用と同じSQLを一度通す予行演習です。**この実行では何も保存されません**。
3. **まとめの表を確認**
   - `作ったビュー` に5枚すべて（`rhythm_identified_scores, rhythm_identity_map, rhythm_scores, rhythm_song_bests, rhythm_total_rankings`）
   - `RLSをすり抜けない設定` が**5枚とも `=on`**
   - `足した索引` に2つ
   - `rankings の件数` が今までと同じ、`RLS` が `有効`、`権限` が今までと同じ
   - `合算に載るブリーダー数` が1以上（記録がある人数）
   赤いエラー表示が無いことも確認します。エラーが出たらそこで停止し、実適用へ進みません。
4. **`RHYTHM_TOTAL_APPLY.sql` を実行**（末尾が `commit;`）
   同じ安全確認を通ったうえで保存します。最後に `notify pgrst, 'reload schema';` が走り、
   Data APIが新しいビューを認識します。
5. **`RHYTHM_TOTAL_VERIFY.sql` を実行**（読み取り専用）
   `上位3人` に実際の名前と合計点が並んでいれば成功です。

## うまくいかないときは

| 表示 | 意味 | どうするか |
| --- | --- | --- |
| `PostgreSQL 15以上が必要です` | `security_invoker` が使えない古いDB | 止まっています。知らせてください（別の作り方にします） |
| `ビューと同じ名前のテーブルが既にあります` | 名前がぶつかっている | 止まっています。名前を確認してから相談してください |
| `anon から合算ランキングが読めません` | `rankings` にSELECTのポリシーが無い | 止まっています。**この検査がいちばん大事**です（管理画面では見えるのにアプリでは空、という状態を防ぎます） |
| `rankings の件数が変化しました` | 実行中に他から書き込みがあった | 何も保存されずに止まります。少し待って手順2からやり直してください |

## 元に戻したくなったら

ビューを消しても、`rankings` の記録には何の影響もありません。

```sql
-- 必要になったときだけ。実行前に必ず相談すること
drop view if exists public.rhythm_total_rankings;
drop view if exists public.rhythm_song_bests;
drop view if exists public.rhythm_identified_scores;
drop view if exists public.rhythm_identity_map;
drop view if exists public.rhythm_scores;
-- 索引と除外テーブルはそのままでも害はない
```

## 曲を合算から外したくなったら

```sql
insert into public.rhythm_ranking_song_exclusions (song_id, reason)
values ('外したい曲のsongId', '理由をここに書く');
```

その曲が合計から外れるだけで、**記録そのものは消えません**。戻したくなったらこの行を消します。
