# iPhoneでの絆Lv・総合力ランキングのフレーム対応 実行順

> 🟢 **`BREEDER_PROFILE_APPLY.sql`（いまの見た目）もまだなら、2本を1つにまとめた
> [`PROFILE_LOOK_ALL_IPHONE_STEPS.md`](PROFILE_LOOK_ALL_IPHONE_STEPS.md) のほうが1回で済みます。**
> 中身は同じです。こちらは個別に当てたいときの手順です。

`public.bond_levels` へ `profile_frame` を1列だけ追加する作業です。**既存の行・列・RLS・ポリシー・権限には触りません**（`drop`・`delete`・`update` をしません）。

> **「Run and enable RLS」ではなく「Run without RLS」を選んでください。**
> Supabaseは `alter table` を機械的に「destructive」と判定して警告を出しますが、
> このSQLは列を足すだけで既存データを消しません。

## なぜ必要か

絆Lv・総合力ランキングだけは、ほかのランキングと違って **`rankings` ではなく `bond_levels` という専用テーブル**から読んでいます（1人×1個体で1行）。そのため `rankings` に `profile_frame` を足しただけでは、この2つに飾り枠が出ません。

同じ形の列を `bond_levels` にも足します。**絆Lv・総合力の順位や集計は何も変わりません。**

## 先に必要なSQL

`BOND_LEVELS_APPLY.sql`（テーブルそのもの）。無ければ先頭の点検でその場で止まります（何も変わりません）。

`rankings` 側の `PROFILE_FRAME_APPLY.sql` とは**独立**です。どちらが先でもかまいませんし、片方だけ当たっている状態でもアプリは正しく動きます（アプリはテーブルごとに「列があるか」を別々に覚えます）。

## 手順

1. **Safari で Supabase Dashboard を開く**
   SQL Editor → New query。
2. **いまの件数を控える**
   `select count(*) from public.bond_levels;` を Run して数字を残します。
3. **`PROFILE_FRAME_BOND_APPLY_TEST.sql` を実行**（末尾が `rollback;`）
   予行演習です。本番には何も残りません。**エラーが出たらここで止めて共有**してください。
4. **`PROFILE_FRAME_BOND_APPLY.sql` を実行**（末尾が `commit;`）
   まとめの表に `profile_frame 列 = text / YES`、件数が手順2と同じ、と出れば成功です。
5. **⚠️ ゲームを開き直す（いちばん忘れやすい）**
   **SQLを当てただけでは、いま開いているアプリには反映されません。**
   アプリは「列がまだ無い」と一度気づくと、**そのページを閉じるまでずっと**
   `profile_frame` を外して送り続けます。Safariならタブを閉じて開き直す／
   ホーム画面のアプリならタスクを切って起動し直してください。
   **更新のお知らせ（バナー）は出ません**（本体のファイルは変わっていないため）。
6. **フレームを選んで1回バトルを遊ぶ → バトルの「絆Lv」「総合力」タブを見る**
   自分の行に枠が出れば成功です。
7. **`PROFILE_FRAME_BOND_VERIFY.sql` を実行**（読み取りだけ）
   「`profile_frame` が入っている記録」と内訳が見られます。

## 覚えておくこと

- **過去の記録には出ません。** 列を足す前の行はNULL（＝フレームなし）のままです。
  ただし `bond_levels` は**同じ個体を1行で上書きし続ける**ので、その個体でもう一度遊べば枠が付きます
  （`rankings` と違って、古い行が残り続けることはありません）。
- 順位・絆Lv・総合力の計算は何も変えていません。

## うまくいかないとき

- **「public.bond_levels がありません」**
  先に `BOND_LEVELS_APPLY.sql` を適用してください。このSQLは何も変えずに止まっています。
- **適用したのに枠が出ない**
  まず手順5（**ゲームを開き直す**）をやったか確認してください。ここがいちばん多い原因です。
  それでも出なければ、ファイル末尾の `notify pgrst, 'reload schema';` まで実行できているか見てください。
