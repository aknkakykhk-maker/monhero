# 引き継ぎメモ: 開発部 モンヒロサクセスの計算の芯(2026-11-12・クラフトくん)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。
`node tools/ctx.js decisions dev`・`node tools/ctx.js decisions masmon` で台帳の「モンヒロサクセス」の行も見る(社長の方針: 返事を待たずにおすすめで進め、報告に「おすすめで進めた点」を並べる。⑦・gate・SQL は窓口、は今までどおり)。

## 受け持ち

- 計算の芯 `monster-hero/data/monhero-success.js`(画面なし・index.html から読まない・印なし。`MONHERO_SUCCESS.create(deps)` で使う)
- 試算 `tools/success/success-sim.js`(`--calibrate` で大会の相手の基準を自動で求める)・検査 `tools/success/monhero-success-check.js`・`success-sim-check.js`・読み込み口 `tools/success/load.js`
- 結果のまとめ `docs/progress/player-raise/SIM-R1.md`。仕様の正本は PLAN.md・ASSIST.md・TOURNAMENT.md・EVENTS.md・RANKING.md(同じフォルダ)

## 公開した PR(すべて main 済み)

#5658 回1の芯 / #5700 修行・ごはん・訓練1種類と訓練Lv・砂時計・持ちこみ・ランキング設計 / #5714 大会1戦・月の大会・常連と王者・ライバル・preview/restore / #5721 常連の表を data 側へ・シナリオの大会8人分・助手の連続イベント / #5744 特別な1話を対戦の芯の buffs で渡す・restore の不具合2つ
**いま検査中**: ブランチ `claude/monsuc-grade`(ライバルのごほうびを全能力+12・評価の番号 `gradeOf`・ひらめきのアシスト5つ・表の見張りの見方)。run-checks が通ったら PR→マージ(まだなら次の会話でやる)

## 芯の入口(画面=回2のクラフト session_0113GBaE5uZqMp8ndFaWVPaZ が使う)

newRun / peek(cards 6札・cups・shugyo・story) / act({kind:'train'|'shugyo'|'rest'|'play'|'clinic'|'cup'|'retry'|'cond'}) / react / issa / endTurn / opponents(1体) / bracketOf / settle(true|false) / rematch・canRematch(砂時計2種) / canSkip / meal / useItem / storyDue・storyStep / storyEnd / markSpecial / battleBuffs / preview / restore / evaluate / gradeOf。
**入口を変えたら回2へ send_message で知らせる約束**。deps は calc・apt・init(助手マスモン)・techs・types・monsters・regulars・cupNames(load.js の depsFor)。

## ほかの会話との分担

- ランダムイベント約50種: 開発部 session_0113GBaCrAJJ54smMiwCTpzm が `monster-hero/data/monhero-success-events.js` を作り、芯は数か所だけ手を入れる(グレードの PR が main に入ったあと取り込んで合わせる)
- 称号・アシストの表・記録帳: session_0113GBaEeZM1ntBnt7dSpxRX(`data/monhero-success-assist.js`・`-titles.js`・`-record.js`)。芯の ASSISTS の数字を変えたら表も直す(`tools/success/monhero-success-tables-check.js` が止める)
- 中断・再開の見張り: session_0113GBaF8YM95AWArFUpDVmt(`success-run-check.js`)。restore の不具合A・B は #5744 で直した(KNOWN から外すよう連絡済み)
- 台本(常連の名前・お話): キズナ。対戦の芯の buffs: キズナ(#5722)

## 残り・次にやること

1. `claude/monsuc-grade` を公開し、回2・称号の会話・RELEASE-DRAFT(session_0113GBaAqPrLwFzuZrKsM4gK)へ数字を知らせる(ライバル: 全能力+12・賞金×1.5・チケット+1・称号/評価: 助手マスモンのランク表+500ごとの番号 `gradeOf(power)` → {rank, step, label, toNext}/試算の中央値の評価: 編成なし C3・B 6体 B2・M 6体 A2・M 6体+アシスト A6)
2. 試算の作戦はまだ月の大会に「ライバルの札だけ」出る。自慢・間合いの大会に出る作戦も足すと、能力ポイントやチケットの量が見られる
3. 技の素質(まれなごほうび)・間合い適性のごほうび・制覇・夏の 👑 の称号は芯にまだない(称号の表には id がある)
4. 試合中のけが 0%(ソラシドの特別な1話)は、大会の試合でけがを起こさないので今は何もしていない
