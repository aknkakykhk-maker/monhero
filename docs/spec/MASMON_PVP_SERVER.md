# 助手のマスモンのフレンド対戦(非同期PvP・第④段階)のサーバ

2026-11-11 タイセン。仕様書 [`ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md`](../progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md) §10、
案 [`masmon-battle/PLAN.md`](../progress/assistant-peer/masmon-battle/PLAN.md) 3章。決めごとの正本は [`PRESIDENT_DECISIONS.md`](../rules/PRESIDENT_DECISIONS.md)(2026-11-11)。
計算の本体はタタカイの [`ASSISTANT_MASMON_BATTLE.md`](ASSISTANT_MASMON_BATTLE.md)。**ゲームの画面はまだ無い(公開の印は偽)。**

## 決まっていること(社長)

- フレンド対戦は**助手の編成どうし**だけ(プレイヤー自身のマスモンは、それ用の仕組みを作ってから)
- ランキングは「**育成値そのまま**(raw)」と「**公平**(fair・能力をそろえる)」の2区分。**既存のランキングに混ぜない新しい表**
- 不正対策は「**上限の見張り**」から: 登録のときに 日数 × 1日の成長上限(関わった最大=1日20)・能力の合計・技の習得条件 ではじく
- **対戦はサーバだけが回す。結果を端末から送らない**

## 置き場所

| 置き場所 | 中身 |
| --- | --- |
| `supabase/migrations/202611110001_masmon_pvp.sql` | 表・RLS・関数(足すだけ・何度流しても同じ) |
| `supabase/functions/masmon-pvp/index.ts` | 入口。npm の部品を渡して `serve.js` の `start()` を呼ぶ数行だけ(配り直しの形・[`EDGE_REDEPLOY.md`](../rules/EDGE_REDEPLOY.md)) |
| `supabase/functions/masmon-pvp/serve.js` | Deno で動く部分。表の読み書き・種・CORS |
| `supabase/functions/masmon-pvp/core.js` | 中身(登録の見張り・挑む・公平の区分)。数字はここの先頭だけで変える |
| `supabase/functions/masmon-pvp/engine.js` | 計算の本体と技データの**写し**(`tools/masmon-battle/build-masmon-pvp-bundle.js` が `node tools/build.js` のたびに作る。手で直さない) |
| `monster-hero/src/parts/56-assistant-masmon-pvp.jsx` | 端末の口(画面は持たない。画面はミセカタ)。`masmonPvpRegister`・`masmonPvpChallenge`・`masmonPvpUnregister`・`masmonPvpRatings`・`masmonPvpFriends`。鍵 `mh_masmon_pvp_owner_key_v1`。公開の印 `assistantMasmonBattlePvp` |
| `tools/masmon-battle/masmon-pvp-check.js` | 検査(偽物の表で動かす。写しの鮮度・端末と同じ指紋・見張り・流れ・SQL が足すだけか) |

## 表

| 表 | 1行 | 端末(anon)から |
| --- | --- | --- |
| `masmon_pvp_owners` | 1人。持ち主の鍵の指紋(md5) | 読めない |
| `masmon_pvp_entries` | (人・助手)。登録編成(見張りを通ったものだけ) | 読める(`active` の行・鍵なし) |
| `masmon_pvp_anchors` | (人・助手・1体)。初めて登録したときの能力・合計・Lv・日 | 読めない |
| `masmon_pvp_matches` | 1試合。種・計算に渡した編成・勝ち負け・指紋・点の増減 | 読める |
| `masmon_pvp_ratings` | (区分・人・助手)。点(Elo・はじめ1500)・最高・勝敗 | 読める(ランキング画面はここを `rating` の順に読む) |
| `masmon_pvp_usage` | (日・人)。挑んだ回数 | 読めない |
| `masmon_pvp_weekly`(view) | (週・区分・人・助手)。ランキングに数えた試合の点の増減と勝敗の合計。週は月曜4:00(JST)始まり | 読める |

**書けるのはサーバの関数(service_role)だけ。** 端末には insert・update・delete と書く関数の実行権を渡さない(検査 G と、手元の Postgres で確かめた)。
既存の表(rankings・friend_links など)には書かない。`friend_links` は「承認済みのフレンドか」を**読むだけ**。

## サーバの関数 `masmon-pvp`(POST・JSON)

| action | 送るもの | すること |
| --- | --- | --- |
| `register` | owner・key・assistant・name・icon・team `{tactics, members:[{slot, species, name, lv, stats}]}` | 形と上限を見て、通れば登録(登録し直しも同じ) |
| `unregister` | owner・key・assistant | 登録をやめる(行は残す) |
| `challenge` | owner・key・assistant・opp_owner・opp_assistant・division(`raw`/`fair`)・size(1〜3。既定3) | フレンドか・両方登録済みか・回数を見て、**サーバが種を作って回し**、記録とランキングを書いて返す |

`challenge` の返り: `match = { id, division, size, rated, seed, version, teamA, teamB, winner, reason, rounds, digest, a:{delta, rating}, b:{…}, remaining }`。
端末は `simulate({ seed, catalog, teamA, teamB })` を同じ計算で回して見返す(観戦)。`digest` が合わなければ「版がちがう」と出す(`version` を見る)。
**端末が送った winner・seed・digest は読まない**(検査 F)。

### 持ち主の鍵

ブリーダーIDは人に見えるので、番号だけで他人の登録を書きかえられないように、端末が作る長い文字列(24〜128字。新しいキー `mh_masmon_pvp_owner_key_v1` の予定)を
初めての登録で覚え、2回目からは同じ鍵を求める(MFバトルカードの登録デッキと同じ考え方)。表には md5 の指紋だけ。

## 上限の見張り(登録のとき)

数字は `core.js` の先頭。**仮** と書いたものは、遊んでから直す。

| 見るもの | きまり |
| --- | --- |
| 種 | 実装済みのモンスター(技データの写しにいる種)だけ |
| Lv | 育成の Lv(1〜99)。初めての登録は 30 + 2 ×(育成を始めた日からの日数+1)まで、そのあとは初めの値から1日2つまで |
| 能力 | 0〜999 の整数。6つとも要る |
| 名前 | 1〜12字。URL・メール・4けた以上の数字ははじく |
| 体数・枠 | 1〜3体。枠 0〜7 で重ならない |
| **初めて登録する1体** | 1つの能力 ≦ 初めの上限(ライフ・ちから・丈夫さ 600/かしこさ・命中・回避 400)+ 20 ×(育成を始めた日からの日数+1)、合計 ≦ 3000(仮)+ 同じ |
| **2回目から**(同じ枠・同じ種) | 1つの能力も合計も ≦ 初めて登録したときの値 + 20 ×(その日からの日数+1)。基準は動かさない(何度登録し直しても上限は増えない) |
| 作戦(plan)・交代の早さ(swapPace) | 無くてよい。計算の表(PLANS・SWAP_PACES)にある名前だけ。数値の style は受けない(計算の第3版) |
| 覚えた技・熟練 | その種の技表の技だけ・重ならない・習得条件(能力の下限・前の技の熟練)を満たす。熟練は覚えた技と guard・dist・swap だけ・0〜100 |
| 戦術経験 | 初めの登録 ≦ 20(仮)+ 5 ×(育成を始めた日からの日数+1)、そのあとは初めの値 + 5(仮)×(日数+1) |

- 日は朝4:00(JST)で区切る(ほかの回数の表と同じ)。「育成を始めた日」は `GROW_EPOCH`(いまは 2026-11-11 の仮。育成の公開日に合わせて直す)
- 能力が下がるのは通す。入れ替えた別の種は別の1体として数える(`枠:種`)
- 守れないこと: 上限ぎりぎりまでの書きかえ。「公平」の区分は能力をそろえるので、ここで十分守れる。盛り上がったら案 B(育成の記録をサーバで再現)を足す

## 対戦とランキング

- 公平の区分: 1体ずつ6能力の合計を 2400(仮)にそろえる(比はそのまま・999 を超えない)。Lv も 30 にそろえる。戦術経験・作戦・交代の早さ・覚えた技・熟練はそのまま(戦い方で勝負)
- 試合の行に 計算の版(engine_version)・技表の版(tech_version)・能力の差の効き方(balance。社長が観戦して決めるまで A)を残す
- 体数 size は先頭から。**ランキングに数えるのは 3対3 だけ**。1対1・2対2 は記録だけ(練習)
- 同じ2人の試合をランキングに数えるのは**1日3回まで**(どちらが挑んでも合わせて。仮)。それを超えた試合は記録だけ
- 点は Elo(K=32)。挑まれた側も動く。1人1日に挑めるのは20回(仮。`MASMON_PVP_CHALLENGE_DAILY_LIMIT=0` で止まる)
- 1試合の計算は平均 0.3ms・最大 5ms(3対3 を300戦)。サーバの CPU の決まり(1回2秒)に十分収まる

## 公開の手順(窓口)

1. SQL: `supabase/migrations/202611110001_masmon_pvp.sql` を流す(足すだけ・何度流しても同じ)。手元の Postgres 16 で2回流し、関数を動かして確かめ済み
2. 関数: このPRが main に入ったあと `git fetch origin main` → `node tools/ctx.js redeploy masmon-pvp --verify`。出てきた引数をそのまま `deploy_edge_function` に渡す(送るのは数行の index.ts だけ。serve.js・core.js・engine.js は GitHub の固定の版から読まれる)。**verify_jwt は外す**。Secrets は増えない
3. 確かめ: 空の本文(`{}`)を本番のゲームの Origin から送り、400 `bad_request` が返ること/下の「確かめる SQL」(読むだけ)
4. ゲームの画面は公開の印が偽なので、1〜3 を先にしても、プレイヤーには何も変わらない

### 確かめる SQL(読むだけ)

```sql
select table_name from information_schema.tables where table_schema = 'public' and table_name like 'masmon_pvp_%' order by 1;
select proname from pg_proc where proname like 'masmon_pvp_%' order by 1;
select tablename, policyname from pg_policies where tablename like 'masmon_pvp_%' order by 1, 2;
```

## まだのこと(次の区切り)

- ゲームの画面(じゅんび・観戦・振り返り・ランキング)はミセカタ(βの取りまとめ)が作り、端末の口(56-assistant-masmon-pvp.jsx)を呼ぶ。置き場所はナカヨシ9に合わせる。
  β その1 は端末の中の対戦だけ、β その2 でフレンド対戦とランキング(公開の印 `assistantMasmonBattlePvp`)
- 公開前に止め絵と更新履歴の案を窓口へ
- リーグ(週ごと)・大会・報酬は社長に聞いてから
