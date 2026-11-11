# 引き継ぎメモ: 検査部ケンサ(検査の整理)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/kensa.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## 済んだこと(すべて main)

- #5261 検査の整理: `--changed` を「検査が読んでいるファイル」で選ぶ(`tools/run-checks-deps.js`)・既定で4組同時・上限60・
  選び方の見張り `tools/run-checks-select-check.js`・棚卸し [`docs/ops/checks/INVENTORY.md`](../../ops/checks/INVENTORY.md)・
  `home-layout-check.js` を本物の画面で測る形へ・`tools/shared-serve.js`(単独で回すと :8899 を立てる)・#4568 の再発防止
- #5192 助手ライフの検査2本の待ち方 / #5252 更新履歴の並び / #5253 harness-exit-check(#5218 の setInterval に unref)

## 残りの仕事

- 落ちたままの検査21本は、持ち主の5部へ直し方の案つきで送り済み(一覧は INVENTORY.md「今回落ちた検査」)。
  返事待ち。振り分けを窓口へ頼んだのは2件: 公開前の助手が一覧に出る形(56-assistant-masmon-battle-view.jsx:244・60-app.jsx:9085)、
  時刻表示の窓の回転(44-time-of-day.jsx:165・#5148)
- 棚卸しの取り直し: `node tools/run-checks.js --area all --parallel 4 --json <出力>` → `node tools/checks-inventory.js --json <出力>`
  (2時間を超えるとバックグラウンドの上限で止まる。止まってもログの `[組N] 状態 秒 名前` の行から集計できる)

## 手で書く所

- やってはいけないこと: 全部の検査を回しているあいだにブランチを切り替えない(別の版のファイルで回って結果が混ざった)。
  本体の生成物を一時的に書き換えて確かめるときも、全部の検査が回っていないときにする
- 検査を消すのは「同じことを別の検査が確実に見ている」ときだけ。今回は0本(似ている組は全部見た)
