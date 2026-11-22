# r1119-114 助手の紹介の入口を家のタブの上に置く(止め絵と突き合わせ表)

撮り方: `node tools/assistant/life-house-typed-shoot.js --out docs/progress/assistant-life/r1119-114-profile --notch`
(切り欠きあり: 縦 上47px・下34px / 横 左右47px・下21px。15:00 固定・偽のデータ)。型の測り(字の4段・はみ出し・主なボタン)は全部 OK(`measure.json`)。

| 大きさ | 家(📖 紹介のボタン) | 紹介の一覧 | 1人の紹介 | 家の下まで送った |
| --- | --- | --- | --- | --- |
| 縦 390×844 | [tate-house](tate-house.png) | [tate-profile](tate-profile.png) | [tate-profile-one](tate-profile-one.png) | [tate-house-bottom](tate-house-bottom.png) |
| 小さい縦 320×568 | [s320-house](s320-house.png) | [s320-profile](s320-profile.png) | [s320-profile-one](s320-profile-one.png) | [s320-house-bottom](s320-house-bottom.png) |
| 横 844×390 | [yoko-house](yoko-house.png) | [yoko-profile](yoko-profile.png) | [yoko-profile-one](yoko-profile-one.png) | [yoko-house-bottom](yoko-house-bottom.png) |
| PC 1280×800 | [pc-house](pc-house.png) | [pc-profile](pc-profile.png) | [pc-profile-one](pc-profile-one.png) | [pc-house-bottom](pc-house-bottom.png) |

## 突き合わせ表

| 決めごと(台帳の行) | 止め絵のどこで満たすか |
| --- | --- |
| r1119-114 家のタブの上のほうに「📖 紹介」(目立つが邪魔にならない所) | `*-house.png` 右上。「💗 次のごほうび」の札の右に同じ高さの白いボタン。家の絵・主なボタン「👀 見る」は動かない(横・PC は右の列の先頭) |
| r1119-114 押すと前と同じ助手全員の一覧(図鑑のような並び) | `*-profile.png`。前の「📖 紹介」のタブと同じ部品(AssistantLifeProfilePage)。会った助手 8/8・顔・名前・ひとこと・💗 Lv・NEW の印 |
| r1119-114 選ぶとその助手の紹介 | `*-profile-one.png`(みゅあ)。前と同じ紹介の窓 |
| r1119-114 閉じる・戻るで家に戻る | 一覧の右上の「✕」と、一覧のいちばん下の「🏡 家に戻る」(道具が押して一覧が閉じるのを確かめた)。1人の紹介は「← 戻る」で一覧へ |
| r1119-114 下のタブは今の5つのまま | どの絵も 家・町・友情・フレンド・マスモン |
| r1119-114「もっと」の「📖 ◯◯のこと」は残す・旧UIは触らない | マスモンのタブ・旧UIの画面のコードは変えていない |
| r1119-114 保存のキーを増やさない・変えない | 新しいキーなし。既読の印は前と同じ `mh_assistant_life_profile_seen_v1` を一覧の部品がそのまま使う。窓を開いたかは保存しない |
| r1119-098 切り欠き(上の帯が時刻・電波に重ならない) | 縦の絵は上47px を空けて「← 戻る」の帯。横は左右47px の内側 |
| 型の字の4段(11/13/16/20px) | ボタンの「紹介」13px。一覧の中も新UIの窓のときだけ 16/11px にそろえた(旧UI・フレンドの家の一覧は前のまま) |
| 画面の文は漢字で(戻る・閉じる) | 「🏡 家に戻る」「✕(閉じる)」 |
