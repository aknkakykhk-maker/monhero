# 染色マスクの正解見本

染色(部位ごとの塗り分け)が崩れていないかを画素単位で比べるための、**検査専用**の見本 PNG。
ゲームからは一切読み込まない。

| ファイル | 使うところ |
| --- | --- |
| `undine-dye-mask.PNG` | `node tools/image/undine-dye-mask-check.js` の正解見本(256x384) |
| `yaobikuni-dye-mask.PNG` | ヤオビクニの差し替え前の原本。今の検査は配信中の `yaobikuni-dye-mask2.PNG` を使うため、比較・巻き戻し用に保管しているだけ |

見本はデバッグ画面の「染色マスクエディタ」から書き出した PNG を、そのままここへ置く。
配信フォルダ(`monster-hero/images/`)には置かないこと — 理由は `../README.md` を参照。
