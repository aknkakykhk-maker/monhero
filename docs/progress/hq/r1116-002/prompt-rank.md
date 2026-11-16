# 外部AIへの依頼文 ①ランキング(r1116-002)

↓ここから下をそのまま貼る

---

aknkakykhk-maker/monhero のモンヒロサクセスβで、引退後のランキング登録が失敗したときに残らない不具合を直してください。最新の main に同期し、リポジトリの CLAUDE.md(とくに ⑦ 保存データとランキングを壊さない)と docs/depts/dev.md の手順に従ってください。調べた結果と直し方は docs/progress/hq/r1116-002/plan.md の「① ランキング」の A〜H にあります。先に読み、その案のとおりに直してください。

決まっていること(変えない):
- 登録待ちは、新しいキー mh_monsuc_rank_pending_v1 に保存する。
  - 既存の mh_monsuc_rank_sent_v1・mh_monsuc_rank_queue_v1・mh_masmon_pvp_owner_key_v1 の名前と形は変えない。queue_v1 は消さない。
  - queue_v1 から写す移行は1回だけにする。印は mh_monsuc_rank_pending_migrated_v1。
- 鍵や ID が取れなくても、通信に失敗しても、アプリを閉じても、登録待ちが残ること。
  - 送り直しは、モンサクを開いたとき・引退の結果の画面・ランキング画面で行う(待たない・落ちない)。
  - サーバーの1分1回を守り、同じ育成は一度だけ載る(run_id)。
- 画面に出す文は plan.md のとおり。「登録しました(全体 ○位)」「登録待ちです。つながったら自動で送ります」「載せられませんでした」と、ランキング画面の上の「登録待ち ○件」。
  - 再送に成功したら、一覧と自分の順位を読み直す。
- サーバー(Supabase の表・関数・Edge Function)は触らない。SQL も流さない。

試験: tools/success/monsuc-rank-check.js に場面を足し、本物の 56-monsuc-rank.jsx と masmonPvpSelf を読み込んで確かめる。
- 正常に登録できる。
- 鍵の書き込みが一時的に失敗したあと、回復したら1件送れる。
- 通信が落ちたあと、回復したら送れる。
- 送る途中で止まり、再起動したあと送れる。
- 二重に送っても、載るのは1回だけ。
- 鍵の無い端末に保留があっても送れる。

最後に node tools/build.js と node tools/run-checks.js --changed を通してください。
- 更新履歴とヘルプも、.claude/skills/changelog-help-update/SKILL.md に従って直してください。日時は TZ=Asia/Tokyo の実時刻。
- 大きいファイル(src/game-system.jsx、*.compiled.js、src/parts/60-app.jsx、data/changelog.js の全文)は開かず、node tools/ctx.js read/find で必要な範囲だけ読んでください。
- 作業はブランチで行い、PR を作るところまで。マージはしない。
- 報告は短く: 直した箇所 / 試験の結果 / 未確認のこと。
