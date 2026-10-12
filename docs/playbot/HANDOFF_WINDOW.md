# 窓口(統括部長モンヒロくん)の引き継ぎメモ

窓口の会話を交代するときに、前の窓口が書き換える1枚。新しい窓口は最初にこれを読む。

- 2026-10-11 23:40 版: 前の窓口 `session_01MC7KZtt5oyrsS32Hc57TXv`(【引き継ぎ済み】窓口 統括部長モンヒロくん(10/06〜10/11))→ 新しい窓口 `session_014GTmSNS2ae9tRr57k3zFjC`(窓口 統括部長モンヒロくん(10/11〜))へ。社長が「今夜両方始める」を選んだ(窓口の引っ越しと、ソロバンくんの毎晩 2:52 の再開)
- 2026-10-13 02:55 版: 今の窓口 `session_014GTmSNS2ae9tRr57k3zFjC` の会話が 64万を超えた(毎晩の見張り)。社長に交代を相談中。交代するときは、新しい窓口がこの版から始める

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

## 動いている作業(10/13 02:55 時点)

- 毎晩の見張りで 60万超え: オンプくん 76万・ガードくん 78万・ブレイブくん 63万 → 引き継ぎメモ(HANDOFF_ONPU / HANDOFF_GUARD / HANDOFF_BATTLE.md)を頼んだ。届いたら create_session(source_url 付き)で新しい会話を立て、SESSIONS.md・ORG.md・ROUTINE.md・departments.json の番号を PR で差し替える。止まっている研究所ハカセくん 69万・改善部ダメダシくん 67万は、再開するときに交代
- 40万超えの候補: テンポくん 46万・マップくん 57万・カゲくん 51万・アリーナくん 49万・ピンセットくん 43万
- HELL(デバッグ専用のまま): 3曲(Sheriruth Lv.54・Grievous Lady Lv.60・風がそよぐ場所 Lv.23・空中の割増し 1.2)。手の決まりの引っかかり 0件。既定: 案A 入(#2889)/柱の光 入・奥まで(#2887・#2891)/空中のタップ 深い赤・縁を薄く(#2890)/右手の空中の長押しは桃・左手は青/上フリックはピンクのまま。光のはしのはみ出しは #2891 で直した
- 全難易度: マスモンのノーツ 金の板(#2888)/ノーツの黒い枠 端と中で同じ(#2878)/ライフ0の赤いふちはノーツの奥(#2879)/判定の文字の大きさ 一度で(#2855)
- バトル: マーク×数(#2851・#2856)と 26体の演出(#2862〜#2871)は公開済み
- 譜面の道具: 古い版を外して最新(Rev.30)だけ(#2861)。手の決まりの物差しと検査(#2846・#2872)
- 検査: 1秒未満の 361本を毎回回す(#2854)。前から落ちていた検査は振り分けて直した(#2860・#2863 ほか)

## 社長の返事・確認を待っているもの

- 読み込み直し: 次に起きたら 設定→🔊音量設定→「🔧 音が出ないとき」の一番下を「記録をコピー」して送ってもらう(#2844)。届いたら音の持ち方 A/B/C を社長に聞く
- 柱の光は試作の枠の記録が送られない(0行)。HELL の公開後に RHYTHM_HEAT_HANDOFF.md 末尾の SELECT で入/切を見直す
- HISTORY に未記録の決定: 10/12 夜〜21:00 の決定(上の「既定」の行)を HISTORY.md に足す

## 予約(Routine)

- `trig_016cQ4QcbjceMVQKQaSuJzix` 毎週月曜 8:53 JST: 窓口の会話へ「週報」
- `trig_01FuvY3248Vri3HqfvBmct78` 毎晩 2:52 JST: 窓口の会話へ「毎晩の会話の見張り」(旧ソロバンくん。旧 trig_017XWi79YrfafB6vykxnKtKv は止めた)
- `trig_01USf7YmdA5gftzJW2JHzYCT` 10/14 10:00 JST: GPU の既定化の前後比べ(この会話へ)
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
