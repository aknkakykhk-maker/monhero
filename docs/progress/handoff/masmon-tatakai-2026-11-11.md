# 引き継ぎメモ: マスモン部タタカイ(助手のマスモンのオートバトルの計算)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/masmon.md` → `docs/spec/ASSISTANT_MASMON_BATTLE.md` → このメモ、の順に読んで始める。

## 入ったもの(すべて main・プレイヤーには何も見えない=index.html で読み込まない)

| PR | 中身 |
| --- | --- |
| #5190 | 計算の芯 第1版(純粋な計算・助手AI・検査・数千戦の集計) |
| #5215 | VERSION 2: 技を MF のように一新(シュギョウの技表 `assistant-masmon-techs.js`)・熟練「中」・能力の差のつまみ A/B/C・観戦の記録(p・ti・aMoves・ga/gb・why) |
| #5286 | VERSION 3: 作戦 `team.plan`(attack/guard/range/big)と交代の早さ `team.swapPace`(early/late)を名前で受け、計算側の表で倍率。重みは範囲で切る |

- 本体 `monster-hero/data/assistant-masmon-battle.js` / 検査 `tools/masmon-battle/masmon-battle-check.js` / 集計 `tools/masmon-battle/masmon-battle-sim.js`
- 計算を変えたら `VERSION` を上げ、タイセン(サーバ)とミセカタ(観戦)へ知らせる

## 待っていること

- 社長が観戦して能力の差の効き方 A/B/C を決める(いまは A)。決まったら `simulate` の既定を変える(窓口から連絡が来る)
- 助手バトルβの取りまとめはミセカタ。計算側への頼みが来たら足す

## 相手

- 窓口 モンヒロくん session_014GTmSNS2ae9tRr57k3zFjC / 観戦 ミセカタ session_0113GBaCjxVX5rJ8Kj4Rb9NC・ミセカタ2 session_0113GBaD5ZD1BPTaHBr6AYFv
- サーバ タイセン session_0113GBaBcit1kAwtDnqtf29a / 技表・修行 シュギョウ session_0113GBaCSV1op4kFLvpgAnwy / 育成 キズナ4 session_0113GBaDEMHLBbz91WnkdCrP

## 気をつけること

- legendcup.com・www.gamecity.ne.jp はこの環境から開けない(MF の式そのものは未確認。appmedia の技の幅だけ参考)
- `run-checks.js --changed` で boot/ja-wrap-word・kaizen2-layout・market-item-quantity-purchase・new-player-stories-browser・onboarding-required の5本は、11/11 夕方の main でも NG(この部と無関係)
- `tools/node_modules` が無い環境では `cd tools && npm install` を先に
