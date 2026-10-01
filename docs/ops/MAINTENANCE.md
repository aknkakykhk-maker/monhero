# 定期メンテナンス(点検)の運用

更新を重ねるうちに積み重なる不具合・ごみ・肥大を、早めに見つけるための仕組み。
**点検は見つけて報告するだけ。直すかどうかは人(と Claude)が決める。** 保存データ・譜面・公開物には触らない。

## 使い方

```
node tools/maintenance.js                  週次: 全領域の検査(重い4本だけ除く)+衛生チェック。約53分
node tools/maintenance.js --full           月次: 全検査(548本)を1本も除かない+深い衛生チェック。約1時間10分
node tools/maintenance.js --quick          手早い点検: 必須+CI+文書の検査+衛生チェック。1〜2分
node tools/maintenance.js --hygiene-only   衛生チェックだけ(数秒)
node tools/maintenance.js --write          結果を docs/ops/maintenance/latest.md へ書く
node tools/maintenance.js --update-baseline  大きさの基準値を取り直す(整理した直後に)
```

事前に `cd tools && npm ci` で依存を入れる。**`--omit=optional` を付けない**
(`react` `react-dom` `canvas` `playwright` が任意依存で、省くと約半数の検査が環境エラーのNGか SKIP になる)。

週次が飛ばす検査は `docs/ops/maintenance/monthly-only.txt`(1本100秒超の4本)。
時間は2026-10-01の実測。検査が大きく増えたら全検査を測り直して作り直す。

## 何を見るか

| 種類 | 内容 | NG になる? |
| --- | --- | --- |
| 検査 | `run-checks.js` の全領域(バトル・音ゲー・保存データ・ヘルプ・表示など)。週次は重い4本を除く | NG |
| ワークフロー | `.github/workflows/` が規定の2つだけか(AGENTS.md) | NG |
| 肥大 | 大きいファイル・画像/音源フォルダが基準値(`baseline.json`)から15%超増えたか | 注意(⚠️) |
| 孤立画像 | どこにも名前が出てこない画像の候補。動的パスは拾えないので参考 | 参考(ℹ️) |
| ブランチ | リモートの作業ブランチが10本を超えていないか | 注意(⚠️) |

## 回す頻度

- **週2回(水・日の午前3:07)**: 週次点検。❌ が出たら原因を見る。
- **月1回(月の最初の回)**: `--full`。実ブラウザ検査(playwright)が使える環境で回す。孤立画像の全件も出る。
- **大きな整理のあと**: `--update-baseline` で基準値を取り直し、基準値のコミットと同じPRで通す。

定期実行は GitHub Actions へ足さない(AGENTS.md「ワークフローは2つだけ」)。
Claude Code の定期実行(スケジュール)から `node tools/maintenance.js --write` を呼び、
❌ があれば原因を調べて報告する形で回す。
