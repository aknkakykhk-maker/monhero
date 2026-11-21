# 試合の画面を1つの部品にまとめる(段3b〜3d)の設計の案

r1119-021 段3b〜3d・r1119-061(社長「今の会話で続ける」)。開発部 クラフトくん・2026-11-21。**作るのは、下の「決めてほしいこと」の答えのあと。**

## いまの形

| 画面 | ファイル | 並べ方 |
| --- | --- | --- |
| モンサクの大会の試合 | 56-monhero-success-arena.jsx `MonsucArena` | 見出し → 相手の技の枠 → 場 → 実況1行 → 自分の技の枠・手動の操作 → 道具の段(速さ・オート・背景)。CSS は `.msc-wrap.msa` |
| 助手マスモン対戦β | 56-assistant-masmon-battle-beta.jsx(観戦の段 `[data-ambb-watch]`) | 相手の技の枠 → 場 → 自分の技の枠/手動の操作 → **実況の数行の記録と助手の「なぜ」** → 見返しの帯(✖) → 操作(もう一度・見返す・速さ)。CSS は `[data-ambb-watch]` の別の並べ方 |
| 修行を見る(助手ライフ) | 56-assistant-life-masmon-cheer.jsx | 場(`MsaStage`)だけ。技の枠なし・見るだけ |
| モンサク r3 の観戦 | 56-monhero-success-r3-cup.jsx `MsxR3Watch` | 古い形(`AmbwPanel`×2・`ambw-ring`)。大会の見せる部品(MonsucCupShow)が出ないときの残り |
| 古い試作の観戦 | 56-assistant-masmon-battle-view.jsx `AssistantMasmonBattleWatch` | 古い形。デバッグ設定の「助手マスモンの対戦を見る(試作)」からだけ開く |

子の部品(`MsaStage`・`MsaDistCards`・`MsxManualBar`・`MsaTechSheet`)はすでに同じ物を使っている。違うのは**並べ方と、それを決める CSS が2か所にある**こと。

## 作る物(段3b)

`MsaMatchView`(56-monhero-success-arena.jsx): 試合の画面の並べ方だけを持つ部品。

```
<MsaMatchView
  head={見出しの行}                 … モンサク: 大会名 / 助手対戦: 対戦の名前・控え
  foe={{ items, rep, dist, guts, hitAt, lastMove, danger, onOpen }}   … 相手の技の枠(2行・r1119-061)
  stage={<MsaStage …/>}            … 場(大きさ・間合いは r1119-061 の値)
  say={実況の欄}                    … 下の「決めてほしいこと ①」
  mine={{ … }} または null          … 自分の技の枠(見るだけの画面は null)
  controls={手動の操作の帯}          … MsxManualBar look="c"
  tools={道具の段}                  … 下の「決めてほしいこと ②」
  overlay={窓・始まり・決着の演出}   … 技の窓・判定・始まり・決着(どの画面も上に重ねるだけ)
/>
```

- CSS は `.msa-mv` の1か所にまとめる(縦: 上から相手の枠・場・実況・自分の枠・操作・道具。PC: 今のモンサクの形)。`.msc-wrap.msa` と `[data-ambb-watch]` の並べ方の CSS は消す
- 助手対戦だけの物(3体と交代・作戦・じゅんび・振り返り・ランキング・見返しの帯)は外側に残す
- 計算と保存キー(`mh_assistant_masmon_battle_v1` など)は触らない
- 検査を1本足す: 試合を見せる画面がどれも `MsaMatchView` で描かれていること・試合の画面で `AmbwPanel` を使っていないこと

## 段3c(見るだけの画面と古い形)

- 修行を見る: `MsaMatchView` で `mine` なし・`controls` なし。相手の技の枠は出す/出さないを下の ③ で決める
- `MsxR3Watch`: 大会の見せる部品が出ない場合の残り。通る道があるかを確かめ、無ければ消す。あれば `MsaMatchView` に載せる
- `AssistantMasmonBattleWatch`(デバッグだけの古い試作): 下の ④

## 段3d(決着の音を1系統に)

- 音の表(`SUCCESS_SFX`・`SuccessSound.sfx`)で決着の音を鳴らし、`msaSe` の直接の音の名前を意味の id に置き換える
- `success-sound-check` の PENDING(arena の行)を消す
- 音の中身(どの音が鳴るか)は変えない。置き換えだけ

## 決めてほしいこと

1. **実況の欄**: 助手対戦βは数行の記録と助手の「なぜ」、モンサクは1行。
   - **A(推奨)**: どちらも1行にそろえ、助手対戦の「なぜ」は1行の下の吹き出しで残す。数行の記録は「見返す」で見る(場が高くなる)
   - B: 助手対戦だけ数行の記録を残す(並べ方は同じ部品、欄の中身だけ違う)
2. **道具の段**: モンサクは「一時停止・×1・×2・オート・背景」、助手対戦は「もう一度・見返す・速さ」。
   - **A(推奨)**: 道具の段の形(丸いボタンの並び)はモンサクの形にそろえ、ボタンの中身は画面ごと
   - B: 今のまま画面ごと
3. **修行を見るの相手の技の枠**: **A(推奨)** 出さない(見るだけの画面なので場を大きく) / B 出す
4. **デバッグだけの古い試作 `AssistantMasmonBattleWatch`**: **A(推奨)** 消す(デバッグ設定の行と検査 `assistant-masmon-battle-view-check.js` も消す) / B 残す

## 進め方

- 3b(部品と、モンサク・助手対戦の2画面)→ 3c → 3d の順に、1つずつ PR にする
- どれも見た目が変わる所は、今と並べた止め絵(縦 390×844・幅320)を付ける。助手対戦の画面は助手部の受け持ちなので、3b の PR は窓口にも見てもらう
