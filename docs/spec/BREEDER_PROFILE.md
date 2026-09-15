# ランキングに出す「いまの見た目」設計書

2026-09-16 にユーザーの依頼で実装した（「アイコンとフレームは更新時じゃなくて常に設定してるやつが
ランキングに出るようにできないの？」）。名前も同じ扱いにした（同日、ユーザーが「2」＝名前も含める を選択）。

## 1. 何が問題だったか

ランキングは **1プレイ＝1行**で、その瞬間の名前・アイコン・フレームを記録へ写している。
そのため、あとから見た目を変えても**過去に出した行は古いまま**だった。

記録そのものを書き換えるのは危ない（CLAUDE.md ⑦）ので、**表示に使う見た目だけ**を
別の小さな表から引くことにした。

## 2. しくみ

```
public.breeder_profiles   … 1人1行。breeder_id が主キー
  breeder_id / user_name / icon / profile_frame / updated_at
```

- **記録（`rankings` / `bond_levels`）は1行も書き換えない。** 順位・スコア・集計にも一切関わらない
- 1人1行なので、遊ぶたびに行が増えることはない
- 消す権限（DELETE）は与えていない

### 2.1 いつ書くか

- **見た目を変えたその場**（名前・アイコン・フレームのどれか）→ 遊ばなくてもランキングの見え方が変わる
- **記録を送ったとき**（バトル・モンヒロビート）→ 設定を一度も変えていない人も登録される

どれも `publishBreederProfile()` を通る。次のときは何もしない。

- 「見るだけ」のプレビュー中（`onboardingPreview`）… 本物の見た目を書き換えないため
- ブリーダーIDが作れない端末 … 誰の行か決められないため（記録の値で今までどおり出る）

失敗しても進行は止めない（次に変えたときか、次に遊んだときに送り直される）。

### 2.2 いつ読むか

`ensureBreederProfiles()` が、ランキングを取りにいく5つの入口
（`sbFetchRankings` / `sbFetchBondLevels` / `sbFetchRhythmRankings` /
`sbFetchRhythmTotalRankings` / `sbFetchRhythmEventRows`）の先頭で呼ばれる。
**60秒は読み直さない**ので、ランキングを開くたびに増えることはない。
失敗しても投げない（見た目が古いままになるだけで、順位は出る）。

### 2.3 どう引き当てるか（`applyLatestBreederProfile`）

**ここだけが差し替えを決める。画面ごとには書かない。**

| 順 | 引き方 | 当たる場合 |
| --- | --- | --- |
| ① | **ブリーダーID** | 記録に `breeder_id` が入っている（2026-09-11以降）。**改名していても当たる** |
| ② | **名前** | IDの無い古い記録。ただし**その名前の人が1人だけ**のとき限定 |
| ③ | — | 見つからなければ、記録に写した値のまま |

②で同名の別人を弾くのは、他人の見た目を出さないため
（全曲合算の `rhythm_identity_map` と同じ考え方・[`RHYTHM_RANKING.md`](RHYTHM_RANKING.md) §4.4）。

★①のために、記録を取るときに `breeder_id` も受け取る（`rankingSelectWithBreederId`）。
名前だけに頼ると、**名前を変えた人が自分の記録に当たらなくなる**。

### 2.4 どこに効くか

エントリを作る7つの関数すべてが `applyLatestBreederProfile` を通るので、**画面側は1行も変えていない**。

`toEntry`（バトルのスコア・ブリーダーLv）/ `bondLevelRowToEntry`（絆Lv・総合力）/
`rhythmRankingEntryFromRow`（モンビー曲別）/ `rhythmTotalRankingEntryFromRow`（全曲合算）/
`rhythmWeekTotalEntryFromRow`（週間）/ `rhythmEventSongEntryFromRow`・`rhythmEventTotalEntryFromRow`（イベント）

## 3. 残っている限界

- **IDの無い古い記録で、しかも改名した人**は当たらない。記録の名前と今の名前が違うため。
  その行は記録に写した値のまま出る
- **同じ名前の人が2人以上いる名前**も当てない（②の規則）。誰が当てはまるかは
  `BREEDER_PROFILE_VERIFY.sql` の「同じ名前が2人以上いる名前」で分かる
- `bond_levels` には `breeder_id` が無いので、絆Lv・総合力は**②の名前でしか引けない**。
  必要になったらあちらへもIDの列を足す

## 4. 適用

`docs/sql/rankings/BREEDER_PROFILE_APPLY.sql`
（予行演習 `_TEST`、確認 `_VERIFY`、手順 `BREEDER_PROFILE_IPHONE_STEPS.md`）。

既存のテーブルには一切触らない。表がまだ無い環境では、アプリは「まだ準備中」として
そのセッションでは以後さわらない（記録に写した値で今までどおり出る）ので、
SQLの適用とアプリの公開はどちらが先でもよい。

## 5. 検査

```
node tools/ranking/breeder-profile-check.js           # 引き当ての規則・記録を書き換えていないこと
node tools/ranking/breeder-profile-browser-check.js   # 実ブラウザで4つの場合分け
node tools/ranking/profile-frame-sql-check.js         # PostgreSQL があるときだけ
```

実ブラウザの検査は、記録にはすべて**昔の見た目**を入れ、プロフィール表だけに**いまの見た目**を置いて、
§2.3 の①②③と「同名は当てない」が正しく分かれることを見る。
