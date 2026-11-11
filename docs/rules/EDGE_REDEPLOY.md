# Edge Function(assistant-chat)の配り直し

2026-11-11 社長「トークンを無駄に使わない仕組み」(案E)。それまでは配り直しのたびに index.ts(約10KB)を
まるごと会話に乗せて送っていた。いまは**数行(約0.5KB)だけ**送る。

## 仕組み

- 本体は `supabase/functions/assistant-chat/serve.js`(Deno で動く部分)と `core.js`・`ranking.js`
- `index.ts` は「npm の部品2つを渡して `serve.js` の `start()` を呼ぶ」数行だけ
- 配るときは、`index.ts` の `"./serve.js"` を GitHub の固定の版
  `https://raw.githubusercontent.com/aknkakykhk-maker/monhero/<40桁のコミット>/supabase/functions/assistant-chat/serve.js` に替えた1ファイルを送る。
  `core.js`・`ranking.js` は `serve.js` からの相対の読み込みなので、同じ版から一緒に読まれる(送らない)
- **jsdelivr は使わない**(新しいコミットで 403 になる。2026-11-08 version 19)。ブランチ名・短いコミットも使わない

## 窓口が打つもの

部から「assistant-chat を配り直してほしい」と来たら(その変更が main に入ったあと):

```
git fetch origin main
node tools/ctx.js redeploy assistant-chat --verify
```

出てきた `project_id / name / entrypoint_path / verify_jwt / files` を、そのまま `deploy_edge_function` に渡す
(`--json` を付けると引数の形のまま出る)。**送るファイルは index.ts の1つだけ。**

道具が止めるもの: main に入っていない版 / 40桁でない版 / その版に serve.js が無い / 手元の index.ts がその版と違う /
(`--verify`)raw からまだ読めない。

## 配ったあと

1. 空の本文(`{}`)を本番のゲームの Origin から送り、**400 `bad_request`** が返ること(材料・core.js まで読めている印)
2. 台帳に1行(版の番号とコミット)

## うまく動かなかったとき(戻し方)

配ったあとに 400 が返らない・500 になるときは、前の形で配り直す:
`index.ts` に `serve.js` の中身をそのまま(`start()` の外へ出した形で)入れ、`core.js`・`ranking.js` は
`export * from 'https://raw.githubusercontent.com/…/<コミット>/…/core.js';` の1行ずつ(2026-11-11 までの v31 の形)。
本番 v31 の中身は `get_edge_function` で読める。

## 最初の1回だけ(2026-11-11 の時点)

本番 v31 は古い形(index.ts まるごと)。`serve.js` を入れた PR が main に入ったあと、上の手順で1回配ると新しい形になる。
中身は v31 と同じ(型の注釈を外しただけ。提案の1人の上限は v31 が 100 をじかに書いていたのを、`core.js` の
`SUGGEST_USER_LIMIT`(=100)から読む形にそろえた。値は同じ)。入口の検査: `node tools/assistant/edge-serve-check.js`

## ほかの関数

`card-tournament-run`・`card-assistant-talk`・`mission-daily-line`・`rhythm-anomaly-report` は、いまの配り方のまま。
同じ形にしたくなったら、`serve.js` に当たる本体を分けて `tools/assistant/edge-redeploy.js` の表(`FUNCTIONS`)に足す。
