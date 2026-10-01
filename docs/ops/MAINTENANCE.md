# 定期メンテナンス(点検)の運用

更新を重ねるうちに積み重なる不具合・ごみ・肥大を、早めに見つけるための仕組み。
**点検は見つけて報告するだけ。直すかどうかは人(と Claude)が決める。** 保存データ・譜面・公開物には触らない。

## 使い方

```
node tools/maintenance.js                  週次: 必須検査+CI検査+文書検査+衛生チェック(1〜2分)
node tools/maintenance.js --full           月次: 全領域の検査+衛生チェック(30分以上)
node tools/maintenance.js --hygiene-only   衛生チェックだけ(数秒)
node tools/maintenance.js --write          結果を docs/ops/maintenance/latest.md へ書く
node tools/maintenance.js --update-baseline  大きさの基準値を取り直す(整理した直後に)
```

事前に `cd tools && npm ci --omit=optional` で依存を入れておく(入っていないと検査が環境エラーでNGになる)。

## 何を見るか

| 種類 | 内容 | NG になる? |
| --- | --- | --- |
| 検査 | `run-checks.js` の `required` / `ci` / `docs`(月次は全領域) | NG |
| ワークフロー | `.github/workflows/` が規定の2つだけか(AGENTS.md) | NG |
| 肥大 | 大きいファイル・画像/音源フォルダが基準値(`baseline.json`)から15%超増えたか | 注意(⚠️) |
| 孤立画像 | どこにも名前が出てこない画像の候補。動的パスは拾えないので参考 | 参考(ℹ️) |
| ブランチ | リモートの作業ブランチが10本を超えていないか | 注意(⚠️) |

## 回す頻度

- **週1回**: 週次点検。❌ が出たら、その週のうちに原因を見る。
- **月1回**: `--full`。実ブラウザ検査(playwright)が使える環境で回す。
- **大きな整理のあと**: `--update-baseline` で基準値を取り直し、基準値のコミットと同じPRで通す。

定期実行は GitHub Actions へ足さない(AGENTS.md「ワークフローは2つだけ」)。
Claude Code の定期実行(スケジュール)から `node tools/maintenance.js --write` を呼び、
❌ があれば原因を調べて報告する形で回す。
