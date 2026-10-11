# 窓口(統括部長モンヒロくん)の引き継ぎメモ

窓口の会話を交代するときに、前の窓口が書き換える1枚。新しい窓口は最初にこれを読む。

- 2026-10-11 23:40 版: 前の窓口 `session_01MC7KZtt5oyrsS32Hc57TXv`(【引き継ぎ済み】窓口 統括部長モンヒロくん(10/06〜10/11))→ 新しい窓口 `session_014GTmSNS2ae9tRr57k3zFjC`(窓口 統括部長モンヒロくん(10/11〜))へ。社長が「今夜両方始める」を選んだ(窓口の引っ越しと、ソロバンくんの毎晩 2:52 の再開)

## 窓口の仕事

- 社長の頼みを受けて中身を確かめ、部署へ `send_message` で振り、結果を日本語で社長へ返す。決まったことは `docs/playbot/HISTORY.md` に PR で残す
- 台帳 `docs/playbot/dashboard/ledger.json` を書き換えたら `node tools/playbot/ledger.js` と `node tools/playbot/president-room.js` で REQUESTS.md と社長室を作り直し、社長室の Artifact を出し直す
  - 社長室: https://claude.ai/artifact/DWfz9ngj3ybfvSUTHDd1YP(`docs/playbot/dashboard/president-room.html`)
  - 部署紹介: https://claude.ai/artifact/Yb1njCnwmyWJtHcpLHXiRi(`departments.json` → `node tools/playbot/department-profiles.js` → `departments.html`)
- 部署の一覧と会話の番号: `docs/playbot/SESSIONS.md`(ソロバンくんが毎晩読む)・`docs/playbot/ORG.md`・`tools/playbot/ROUTINE.md`

## 守ること(社長から言われたこと。詳しくは CLAUDE.md・docs/playbot/RULES.md・HISTORY.md)

- 日本語だけ。返事待ちは AskUserQuestion の選択式(2〜4個・おすすめを先頭に「(推奨)」)
- 謝らない(言い訳もしない)。許可の画面が出る操作の前に、何の許可かを日本語で先に書く
- 改修はコミット→プッシュ→PR→マージまで聞かずに進める。質問には答えて止まる(⑩)
- 決まりを選択肢として出さない・勝手に変えない(「ルールなんだから勝手にルール変えないで」)
- 見積もりは AI が実際に手を動かす時間。部署の見積もりは `docs/playbot/ESTIMATES.md` の実績と照らし、大きすぎれば突き返してから伝える(RULES 21)
- 見た目の確認は、実寸の静止画を1画面ずつ、前(左)/後(右)で並べて見せる(画像は SendUserFile で)
- 参考動画どおりに。ただし横持ちの両手親指で遊べること
- 重さは仕組みで直す。社長に実機で確かめさせず、bot と本番の記録で測る
- 保存データ・ランキングは壊さない(⑦)。Supabase は窓口だけが使う。読むだけでも、先に「データベースを読む許可」と書く。書き込みは社長の確認のあと。SQL を社長に流してもらうときは手順とそのままコピーできる SQL を出す
- HELL はデバッグ専用のまま(公開の印 RELEASE_FLAGS.rhythmHell は偽)。社長の OK まで公開しない
- 公開中の譜面は勝手に変えない(⑩-2)。直すときは released-chart-lock を理由つきで更新
- 会話をしまう(archive)のは社長の OK のあとだけ

## 動いている作業(10/11 23:40 時点)

| 部署 | 中身 | 状態 |
| --- | --- | --- |
| 修理部 ドライバーくん | 発熱の手当て(r2610111850heat)。叩いた光の canvas 版を 2D でも既定に(社長 OK 済み)→ ②DOM の書き換え削減 → ③重い飾り → ④残りの GPU 化(箱・星は HELL の見た目と相談) | 作業中 |
| ビート部 テンポくん | 全曲・全難易度の「押しても取れないノーツ」の洗い出し(社長「他にもこういうのがないか」)。10/12 2:00 からは全曲 EXPERT 以上のタップ位置の確認(予約 trig_01E2AjPwkuR8jzkQKmPRL8bB・朝に窓口へ要約が届く) | 作業中・予定 |
| ビート部 マクアケくん | ①横持ちのジャケットを高さの54%に戻して文字を詰める(#2784 で入った可能性あり・報告待ち)②空中の道の案E(社長のイメージ「地上のレーンを空中用に立体的にもう1本」)③boot/event-replay-check の直し | 作業中 |
| ビート部 カゲくん | rhythm-debug-short-check の「リスタート」と rhythm-ranking-check の送信の項目(main でも落ちる)。ランキング側の不具合なら直す前に窓口へ | 作業中 |
| ビート部 リバースくん | Grievous Lady HELL(デバッグ)の仕上げ済み。次の指示待ち | 待ち |
| ビート部 オンプくん | Sheriruth HELL(デバッグ)の仕上げ済み。次の指示待ち | 待ち |
| 修理部 ストックくん | 事前ダウンロードは公開済み。次の指示待ち | 待ち |

## 社長の返事・確認を待っているもの

- HELL 2曲のレベル(Sheriruth 54・Grievous Lady 60 は仮)。社長「両方デバッグしてみたときにまた数値の調整はすると思う」
- HELL の交差の長押しの遊び心地(Sheriruth 1:16〜1:24 の3か所・Grievous Lady 0:14・1:07・2:14 の3か所)
- 空中の道の案E の静止画が届いたら選んでもらう(既定は「なし」のまま)
- 作業ブランチ2本(claude/sky-look-design・claude/rhythm-hell)を社長が GitHub の画面で消す(この環境からは消せない)

## 予約(Routine)

- `trig_01E2AjPwkuR8jzkQKmPRL8bB` 10/12 2:00 JST: テンポくんの会話へ「全曲 EXPERT 以上のタップ位置の確認」。依頼文の報告先は SESSIONS.md の窓口
- `trig_017XWi79YrfafB6vykxnKtKv` 毎晩 2:52 JST: 経理部ソロバンくん(新しい会話で SESSIONS.md を読み、長い会話の交代と報告)
- 10/14 10:00 JST: GPU の既定化(#2765)の前後を本番の記録で比べる(新しい窓口が自分の会話に send_later で予約し直すこと。SQL は下)

```sql
select stats->'frame'->>'draw' as draw, count(*) as plays,
 percentile_cont(0.5) within group (order by (stats->'frame'->>'avg')::float) as frame_avg,
 percentile_cont(0.5) within group (order by (stats->'frame'->>'tickAvg')::float) as tick_avg,
 sum((stats->'frame'->>'over34')::int)::float/nullif(sum((stats->'frame'->>'n')::int),0) as over34_rate,
 percentile_cont(0.5) within group (order by (stats->'frame'->'early'->>'avg')::float) as early_avg,
 percentile_cont(0.5) within group (order by (stats->'frame'->'late'->>'avg')::float) as late_avg,
 sum(coalesce((stats->'frame'->>'fallback')::int,0)) as fallbacks,
 sum(coalesce((stats->'frame'->>'bandFallback')::int,0)) as band_fallbacks
from public.rhythm_touch_diagnostics
where platform='ios' and stats ? 'frame' and created_at > now() - interval '7 days'
group by 1 order by plays desc;
```

前=draw 'webgl'・後=draw 'gpu'。20回以上たまっていれば比べ、後の over34_rate・late_avg が悪い/fallbacks が多ければドライバーくんに既定を戻すよう頼む。あわせて演奏前の準備(#2752)の startOver50・startMax・prepWaitMs も読む。

## 後回しの頼み

- 全曲にジャンルを付ける(r2610111259genre。先にジャンルの分け方を社長に聞く)
- ランキングの検査8本・バトルの検査10本・判定の帯3本は保留(docs/playbot/RANKING_CHECKS_PENDING.md)
- 「正しく離したのに MISS」は、プレイの記録がたまってから見直す

## 気をつけること(今回の会話で分かったこと)

- 部署への send_message は、相手が長い作業の途中だと次の区切りまで読まれない(2時間遅れて届いたことがある)。急ぎは priority "next"
- 部署が使用量の上限で止まったまま再開しないことがある。報告が来ない部署は list_events で確かめ、止まっていたら再開を頼む
- 部署はほかの PR を番号の決めつけでマージしないこと(リバースくんが #2760 を誤ってマージした)
- 社長室に載っていない今日の PR が多い。president-room.js の「要確認」を見て、社長に見せるものは台帳へ
