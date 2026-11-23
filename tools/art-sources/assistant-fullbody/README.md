# ここにあった全身絵の原本は移した(2026-11-23・台帳 r1119-128)

`received-v1/` の 48 枚は、キャラごとの置き場へ並べ直した。コードや資料にこのフォルダの名前が残っていたら、下を見る。

- いまも正本の原本 → `tools/art-sources/assistants/<キャラ>/<服>/fullbody/`(目録は各キャラの `CATALOG.md`)
- 旧版(作り直す前の絵) → 保管庫 `archive/old-art/assistant/<キャラ>/<服>/`(正本ではない。表は `archive/old-art/README.md`)
- その絵がどちらかを引く: `node tools/image/assistant-art-catalog.js --why <ファイル名の一部>`

**ここへ新しい絵を置かない。** 受け取った原本は `tools/art-sources/assistants/<キャラ>/<服>/` へ置き、
`tools/image/assistant-art-catalog.json` の正本に書いて `node tools/image/assistant-art-catalog.js` を回す。
