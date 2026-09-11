# iPhoneでの週間ランキング用の期間の窓・集計関数の作成 実行順

モンビーの「週間ランキング」を出すための、**読み取り専用の期間の窓（ビュー1枚）と集計関数2つ**を作る作業です。**既存の `rankings` の行・列・RLS・ポリシー・権限には触りません**（DROP・DELETE・UPDATE・ALTERをしません）。

足すのは次だけです。

- 読み取り専用のビュー1枚（`rhythm_week_window`。今週の始まり・終わり）
- 読み取り専用の関数2つ（`rhythm_event_song_bests` / `rhythm_event_totals`）
- `rankings` のモンビー行だけを見る索引1つ（期間で絞るため）

> **先に `RHYTHM_TOTAL_APPLY.sql`（全曲合算のビュー）を適用しておいてください。**
> ここで作る関数は、そちらで作った `rhythm_identified_scores` の上に乗ります。
> 適用されていないときは、実行しても**何も保存されずに止まります**（そう出ます）。

> **Supabase の SQL Editor は、ファイル全体を実行すると「最後の1文」の結果しか表示しません。**
> そのため3本とも、**最後の1文が「まとめ」**になっています。1回 Run して出てきた表を
> スクリーンショットするだけで大丈夫です。

> **「Run and enable RLS」ではなく「Run without RLS」を選んでください。**
> ビューと関数を作るだけで、既存データには何もしません。

## なぜサーバー側に置くのか

週間ランキングは「その週のあいだに出した記録だけ」で競います。**どこからどこまでが今週か**を端末の時計で決めると、時計を進めるだけで別の週の順位が見えてしまいます。そこで週の区切り（毎週月曜 5:00 JST）は**サーバー側の `rhythm_week_window` を正本**にします。

集計も同じ理由に加えて、通信量のためにサーバー側で行います。端末が受け取るのは**部門ごとに上位50人ぶんの数十行だけ**です。曲が増えても通信量は変わりません。

なお、**どの3曲を対象にするかはアプリ側の静的データ**（`monster-hero/data/rhythm-event.js`）が決めます。SQL側は「期間×対象曲の集計」までを汎用に返すだけなので、**対象曲を変えるのにSQLを触る必要はありません**。

## 手順

1. **Safari で Supabase Dashboard を開く**
   プロジェクト `zrzevudkbgtxlbvmuziy` を選び、左のメニューから **SQL Editor** → **New query**。
2. **`RHYTHM_EVENT_APPLY_TEST.sql` を実行**（末尾が `rollback;`）
   実適用と同じSQLを一度通す予行演習です。**この実行では何も保存されません**。
3. **まとめの表を確認**
   - `今週の始まり(JST)` が**月曜の 05:00**（`(Mon)` と出ます）
   - `今週の終わり(JST)` がその7日後の月曜 05:00
   - `作ったビュー` に `rhythm_week_window`、`RLSをすり抜けない設定` が `=on`
   - `作った関数` に `rhythm_event_song_bests, rhythm_event_totals`
   - `足した索引` に `rankings_rhythm_created_at_idx`
   - `rankings の件数` が今までと同じ、`RLS` が `有効`、`権限` が今までと同じ
   赤いエラー表示が無いことも確認します。エラーが出たらそこで停止し、実適用へ進みません。
4. **`RHYTHM_EVENT_APPLY.sql` を実行**（末尾が `commit;`）
   同じ安全確認を通ったうえで保存します。最後に `notify pgrst, 'reload schema';` が走り、
   Data APIが新しいビューと関数を認識します。
5. **`RHYTHM_EVENT_VERIFY.sql` を実行**（読み取り専用）
   `今週の始まり` が月曜 5:00 で、`上位3人(今週の総合)` に名前と点が並んでいれば成功です。
   （その週にまだ誰も遊んでいなければ `なし` になります。それでも失敗ではありません）
6. **できたことを伝えてください**
   アプリ側の公開フラグ `RHYTHM_WEEKLY_RANKING_PUBLIC_RELEASE` を `true` にして公開します。
   それまではイベントタブも曲えらびの案内も出ません（説明だけ先に出ないようにするためです）。

## うまくいかないときは

| 表示 | 意味 | どうするか |
| --- | --- | --- |
| `public.rhythm_identified_scores がありません` | 全曲合算のビューがまだ | 止まっています。先に `RHYTHM_TOTAL_APPLY.sql` を適用してください |
| `PostgreSQL 15以上が必要です` | `security_invoker` が使えない古いDB | 止まっています。知らせてください（別の作り方にします） |
| `週の始まりが月曜になっていません` | 週の区切りの計算がずれている | 止まっています。知らせてください（こちらで直します） |
| `anon から週間ランキングが読めません` | `rankings` にSELECTのポリシーが無い | 止まっています。**この検査がいちばん大事**です（管理画面では見えるのにアプリでは空、という状態を防ぎます） |
| `rankings の件数が変化しました` | 実行中に他から書き込みがあった | 何も保存されずに止まります。少し待って手順2からやり直してください |

## 元に戻したくなったら

ビューと関数を消しても、`rankings` の記録には何の影響もありません。

```sql
-- 必要になったときだけ。実行前に必ず相談すること
drop function if exists public.rhythm_event_totals(text[], timestamptz, timestamptz);
drop function if exists public.rhythm_event_song_bests(text[], timestamptz, timestamptz);
drop view if exists public.rhythm_week_window;
-- 索引はそのままでも害はない
```

## 曲を週間の集計から外したくなったら

全曲合算と同じ除外テーブルを見ています（`RHYTHM_TOTAL_EXCLUDE.sql`）。

```sql
insert into public.rhythm_ranking_song_exclusions (song_id, reason)
values ('外したい曲のsongId', '理由をここに書く');
```

その曲が集計から外れるだけで、**記録そのものは消えません**。戻したくなったらこの行を消します。
