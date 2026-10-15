# 守り部 部長ガードくん の引き継ぎ(2026-10-13 未明)

前の会話: session_01X1m4SRfy1rxcJemHM8n5PU(会話の長さが78万を超えたので窓口の依頼で交代)。
新しい会話は窓口が立てる。決まりは RULES.md・CLAUDE.md のとおり。報告先は **いまの窓口 session_014GTmSNS2ae9tRr57k3zFjC**(前の窓口 session_01MC7KZtt5oyrsS32Hc57TXv は引き継ぎ済み)。

## いまの状態
- 手を付けている作業は無い。main はきれい。作業ブランチ `claude/guard-trial` は main と同じにしてある
- 最後に公開したもの: #2844(読み込み直しの記録に、音のデータの大きさを足した)
- 動くのは **社長の依頼を窓口が中継した分だけ**。自主的な作業・定期の点検は止めてある

## 持っている作業

### 1. iPhone で「勝手に読み込み直される」件の調べ(待ち)
- 遊んでいる最中の読み込み直しは、JS 側の漏れではなかった(25分の soak: 画面の部品・タイマー・Blob に増え続けるものは無し)
- 疑わしいのは **音のデータ**。曲1本を解いた AudioBuffer は約45〜60MB。曲は4本まで持つ(`SONG_BUFFER_KEEP=4`)ので約180〜240MB。5曲を回すと持ち替えが止まらず、25分で70回・合計3.2GB を解く
- #2844 で端末に記録するようにした(社長の iPhone が次に落ちたとき読める):
  - 見る場所: タイトル → 設定 → 🔊音量設定 →「🔧 音が出ないとき」→ いちばん下「前回までの読み込み直し」。「記録をコピー」で貼れる
  - 読み方: (a) 「音を解いた合計」「回数」が大きい → 持ち替えの繰り返し(案 A/B)。(b) 「音のデータ」の MB が大きい → 1本が重い(案 C)。(c) どちらも小さい → 音以外が原因
- **2026-10-15 社長の決定(案 A/B/C の代わり・修理部ドライバーくんが作った)**: ① 音が消えているあいだ(超省エネの自動消音・本人の消音・BGM音量0)は BGM を1本も解かず、持っているぶんは捨てる ② 場面のBGMはまるごと解かず、`<audio>` で流しながら鳴らす(MediaElementSource で bgmGain へ。`14-audio.jsx` の「流しながら鳴らす」)。モンヒロビートの演奏・試聴・ジングル・効果音は解いた音のまま
  - きっかけ: プレイヤー「クイックでオート無限やってたら、また気付いたらホームに戻ってた」(iPhone・1時間ほど)
  - 測り(`tools/memory-soak.js --mode auto --repeat`・Chromium): 前 25分で音は解いた12本 539MB・持っている4本 / 後 5分で解いた0本 0MB(ブラウザ全体は同じころで 2050〜2090MB → 1850MB)
  - iPhone で見る点: ループの継ぎ目・場面の切り替え・消音→鳴らす・画面の暗転から戻る・消音スイッチ(iOS 17 より前は `<audio>` が消音スイッチを無視するおそれ)
- (以下は決定の前に書いたもの)音の持ち方の案 A/B/C は、社長が記録を見てから決める。窓口か社長の決定が来るまで作らない
  - A: 持つ本数や順番を変えて、次の曲を先に解く量を減らす / B: 回す曲のあいだで持ち替えを減らす / C: 32kHz で解いて1本を軽くする(見積は窓口へ送る前に自分の手で動く時間で出す)
- 道具: `tools/memory-soak.js`(`quick`/`auto`/`rhythm`/`idle`。CDP のメモリ・音の数・canvas/blob を出す)、`tools/boot/reload-log-check.js`、`tools/audio/song-buffer-limit-check.js`

### 2. ランキング領域で main に残っている落ちている検査 8本(止め)
- 社長の決定「今は止めておく」。新曲・モンヒロビートが落ち着いてから
- 一覧・当たり・進め方: `docs/playbot/RANKING_CHECKS_PENDING.md`(他部の落ちている検査も追記してある)
- 再開は社長の指示があったときだけ。検査を外す・甘くするのは無し

### 3. main で落ちているが自分の変更ではないもの(報告済み)
`masu/fusion-rebirth-check` / `masu/masu-lock-check` / `mode/rhythm-chart-v2-step6-check`。直す指示は来ていない

## 守っている決まり(窓口・社長から)
- 会話は日本語のみ(Stop フックが英語を止める)。待つ判断は `AskUserQuestion`
- **Supabase は直接触らない**(SELECT も)。目的・列・SELECT 文を窓口へ送り、窓口が流す。SQL を社長に流してもらうときは手順とコピーできる本文を返答に出す
- 危ない操作(SQL・公開・削除・設定・送信)の前に、日本語で1〜2行(何のために・何をするか・読むだけか書き込みか・取り消せるか)
- 見込みは **AI の手を動かす時間**(RULES 21。既知の小さい直し 5〜15分、画面の組み込み 約20分)
- セーブデータは壊さない(⑦: 新しいキーを足す・既定値で補う)。ランキングに触れない
- 時刻は `TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M'`(UTC と取り違えない)
- 更新履歴・ヘルプはプレイヤー向けの言葉で、新しい順に先頭へ

## よく使う道具と検査
- 入口: `node tools/ctx.js brief` / `rules <語>` / `find` / `read` / `refs` / `diff`。大きいファイル(`game-system.jsx`・`60-app.jsx`・`changelog.js` など)は開かない
- 検査: `node tools/run-checks.js --area ci|boot|audio|changelog|assistant|masu|required`(コミット後は `--changed` が空になるので `--area`)。コミット前に `node tools/build.js`
- 手順(1作業ごと): main から枝 → 直す → build → 検査 → コミット → push → PR → マージ(MCP の `mcp__github__*`。切れていたら ToolSearch で読み込む) → `git checkout -B claude/guard-trial origin/main` → `git branch -u origin/main` → `git push origin claude/guard-trial`
- マージのコンフリクト: 生成物(`game-system.jsx`・`.compiled.js`・`index.html`・`tailwind.css`・`version.json`・`10-core.jsx`)は `--theirs` で取って `node tools/build.js` し直す
- 台帳 `docs/playbot/dashboard/ledger.json` は **正規表現で行を置き換える**(json.dump で書き直すと数千行の差になる)
- ローカルサーバー: `python3 tools/serve.py 8899`(つながらなければ立て直す)
- 落とし穴: `pkill -f <自分のコマンドに含まれる語>` は自分のシェルまで止める。プロセス番号で止める

## 次の会話が最初に読むもの
1. この紙 → `docs/playbot/RULES.md` → `docs/playbot/history/guard.md`(10/10 以降)
2. `docs/playbot/RANKING_CHECKS_PENDING.md`(止めてある8本)
3. `node tools/ctx.js brief` で状態を確かめ、窓口の最初の指示を待つ
