# 引き継ぎメモ: 開発部 モンヒロサクセス 回3(大会・修行・引退・保存枠)(2026-11-12)

次の会話は、CLAUDE.md → `docs/depts/dev.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## いまの状態

- 回3は main に入った: #5764(本体)・#5776(大会の見せ方をバトル部の部品へ・アシスト第2版・音と演出)・#5781(保存枠の子の名前と染色をあとから変える)
- 公開の印 `monheroSuccess` は偽のまま(入口はデバッグの「🌱 モンヒロサクセス(試す)」だけ)。更新履歴・ヘルプはまだ書いていない(公開のとき)

## 部品(src/parts/)

| ファイル | 中身 |
| --- | --- |
| `56-monhero-success-r3-css.jsx` | 見た目 `MSX_R3_CSS`(`.msx .r3` の中だけ) |
| `56-monhero-success-r3-store.jsx` | 試合を回す `msxR3Fight`(返り値に `input`)・大会の名前・評価 `msxR3Grade`(芯の `gradeOf`)・保存枠へ `msxR3Retire`・お別れ `msxR3Farewell`・名前と染色 `msxR3EditMon`・ランキングの口(`monsucRankSubmit`)・台詞(台本エンジン)・称号/アシスト/記録帳の表の読み込み |
| `56-monhero-success-r3-cup.jsx` | 受付 C1・大会 `MsxR3Battle`(見せ方は `MonsucCupShow`、勝ち負けの記録・砂時計・ごはん C3・次の段は回3)。デバッグのときだけ「勝ったことにする」 |
| `56-monhero-success-r3-quest.jsx` | 修行 Q1・Q2 |
| `56-monhero-success-r3-retire.jsx` | 引退 E0・E3・E1・E2(アシスト第2版の7つの場面のタブ・段1〜5)・ゲームオーバー G1・保存枠の一覧 `MsxR3Box`(お別れ・貸し出し・合体の入口・名前と染色)・入口 `MsxR3` |

回2(`56-monhero-success-main.jsx`)の `MsxPlay` が `MsxR3`(kind: battle / over / cup / shugyo)を呼ぶ。`phase === 'battle'` はいつも回3へ(賞品とごはんの段は s.battle が空のまま続くため)。

## 保存(⑦・足すだけ)

- `mh_monsuc_box_v1` に引退した子を1体ずつ(同じ id は足さない・いっぱいなら入れない)。名前と染色はその子の `nick`・`colors` だけ書き換える
- `mh_monsuc_meta_v1` に `wonCups`・`retired`・`best`
- `mh_monsuc_record_v1`(記録帳)に1件。読めない値は `mh_monsuc_box_v1_broken`・`mh_monsuc_meta_v1_broken` へ写す

## 決まったこと(この会話で)

- 評価は11段(G〜M)+500ごとの番号(芯の `gradeOf`・A2 など)
- 大会の相手の人気/忠誠: 期の基準 デビュー 10/60・ジュニア 20/65・ミドル 35/70・プロ 50/75・最後 65/80、王者 +20/+15・ライバル +10/+5、±5
- ゲームオーバーの子は保存枠・思い出に残さない(窓口)
- 試合の計算は回3の `msxR3Fight` が正、見せ方はバトル部の `MonsucCupShow`

## 残り

- **自分で操作する試合**(バトル部 `MonsucArena` #5780・担当 session_0113GBaCf2aQGBhHSx7XhuhH): `fight` の返り値の `input` を読む形で合意済み。入ったら回3の流れで動くか確かめる
- **引退のときの助手の仲良し度の加算(最大3)**: 保留(台帳の宿題)。案は「新しいキー mh_monsuc_aid_bond_pending_v1 に加算待ちと引退の id を貯め、助手ライフ側が読むときに1回だけ足す」。作るなら助手ライフ部と一緒に
- 公開のとき: 更新履歴・ヘルプ・助手の告知(`changelog-help-update` スキル)

## 確かめの道具

- `node tools/success/success-r3-shoot.js`(23場面・`SHOT_DIR=<フォルダ>` で撮る)
- `node tools/success/success-screen-browser-check.js`(回2の画面。大会はデバッグの「勝ったことにする」で進む)
- main のままでも出ている NG(回3と無関係): `ui/screen-effects-check.js`(setTimeout の表 162/160)・`ui/screen-parts-check.js`(51-home-screen-guide.jsx)・`battle/battle-menu-browser-check.js`(WAVE10 の行のクリックが案内の帯に遮られる)
