# 台詞の注文: 助手1人に贈る(2026-11-08 オクリモノ2 → コトバ・ツムギ)

社長の言葉: 「贈るってのは2人に送られるの？個別にはないの？」「好き嫌いがあるのにそもそも個別にあげれないのおかしいね。そのへんもつじつまあわせてね」
案: `../SOLO-GIFT-PLAN.md`(社長の選択: ❶B ❷A ❸A ❹A ❺A。1人用4種類と好みは案のとおり)。
読むもの: `ORDER-GIFT.md`(前の注文。守ることは同じ)・`../VOICE.md`・`FEELINGS.md`・`RELATIONS.md`・`../../../rules/CALL_NAMES.md`

## 守ること(前の注文と同じ)

- プレイヤーは `{name}`(「ブリーダー」と直に書かない)。**今回は2人ではないので `{c}` は使わない**(一緒にいる相手の名前を出さない)
- 助手・モンスターを「子」と呼ばない。恋愛にしない。えるびんは実在の方の私生活に触れない
- 苦手でも嫌がらない・突き返さない。「気持ちはうれしい」「どう使えば…」くらい。{name} を責めない
- VOICE.md のくせ(みゅあ「ぢゃん・まぢ」、あつの文末の笑・顔文字・記号、ドラは関西弁にしない など)を守る
- 1行は60字まで。表情は `normal happy wink surprise troubled angry crying excited`
- 2人に贈ったときの台詞(`gift`)とは別に書く。1人だけに、自分のために選んでもらった、という場面

## 品物の id と好み

2人にも贈れる道具(10種類。1人に贈ったときも好みは同じ):
basket 🧺おやつバスケット / misanga 🤝おそろいのミサンガ / cake 🍰はんぶんこケーキ / onigiri 🍙ほかほかおにぎり / tea 🫖午後のティーセット /
earphone 🎧かたみみイヤホン / puzzle 🧩ふたりで解くパズル / sleeve 🃏おそろいスリーブ / cheki 📸思い出チェキ / flower 🌷ちいさな花束

1人用の道具(4種類・新しい): letter ✉️手書きの手紙 / candy 🍬ひとつぶキャンディ / keyholder 🔑キーホルダー / omamori 🧿小さなおまもり

| 助手 | 好き(10種類) | 苦手(10種類) | 好き(1人用) | 苦手(1人用) |
| --- | --- | --- | --- | --- |
| mua | misanga cake cheki | puzzle sleeve | keyholder | omamori |
| kiki | tea puzzle flower | onigiri earphone | letter | candy |
| momosuke | cake earphone cheki | tea puzzle | candy | omamori |
| dra | basket cake onigiri | puzzle flower | candy | letter |
| atsu | misanga onigiri earphone | tea flower | omamori | letter |
| kyuko | tea earphone puzzle | basket cheki | letter | keyholder |
| sorashido | onigiri puzzle sleeve | tea flower | keyholder | letter |
| erubin | tea sleeve flower | cake earphone | letter | candy |

ほかは、ふつう(mid)。

- 「おそろい」「はんぶんこ」「ふたりで」「かたみみ」の道具を1人でもらったときは、「だれとおそろいにしよう」「{name}とはんぶんこする？」のように、1人でもらったことに触れてよい
- 📸 思い出チェキを1人でもらうと、思い出アルバムにその助手ひとりの1枚が入る(「ひとりで撮ってもらうの、ちょっと照れる」など)

## 書き方(1行1本)

```
solo mua item=keyholder like=like | excited え、あたしだけに？ {name}、これまぢでかわいいぢゃん♪
solo kiki item=candy like=bad | troubled あら…甘いのは少しだけ、にしておきまつね。気持ちはうれしいでつ
solo dra item=misanga like=mid | happy おそろいのミサンガ…{name}とおそろいにする？ えへへ
hint kiki item=letter | wink 手書きの文字って、いいでつよね。{name}の字、見てみたいでつ
```

- `solo` … 助手1人に道具を贈ったときの、その人の1行。like= は上の表の好みと必ず合わせる(like/mid/bad)
- `hint` … 仲良し度の段が上がったときに、**1人用の好きなもの1つ**をそれとなく教える1行(10種類の hint は前の注文で書いてもらってある)

## 本数と担当

| 種類 | 本数 | コトバ | ツムギ |
| --- | --- | --- | --- |
| solo(8人×14種類×2本) | 224 | mua kiki momosuke dra(112) | atsu kyuko sorashido erubin(112) |
| hint(8人×1人用の好き1つ) | 8 | mua kiki momosuke dra(4) | atsu kyuko sorashido erubin(4) |
| 合計 | 232 | 116 | 116 |

置き場所: コトバ `kotoba-solo.txt`・ツムギ `tsumugi-solo.txt`(このフォルダ)。
ブランチ `claude/solo-gift-lines`(main から作る)にプッシュして、オクリモノ2(session_0113GBaEceGDjFsoUwaccjnh)へ知らせてください。PR・マージはオクリモノ2がします。
