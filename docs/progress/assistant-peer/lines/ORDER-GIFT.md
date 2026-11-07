# 台詞の注文: 道具・家具のプレゼント(2026-11-08 オクリモノ → コトバ・ツムギ)

社長の言葉: 「道具もバリエーション増やして好き嫌いが出たりほしい。あとは家具とかそういうのもプレゼントできたらいいね」
案: `../GIFT-PLAN.md`(社長の選択: ❶〜❹・❻ A、❺ B。好みの表はこのままで OK)。読むもの: `../VOICE.md`・`FEELINGS.md`・`RELATIONS.md`・`../../../rules/CALL_NAMES.md`

## 守ること

- プレイヤーは `{name}`(「ブリーダー」と直に書かない)。相手の助手は `{c}`。助手・モンスターを「子」と呼ばない
- 苦手でも嫌がらない・突き返さない。「気持ちはうれしい」「どう使えば…」くらい。{name} を責めない
- 恋愛にしない。えるびんは実在の方の私生活に触れない。VOICE.md のくせ(みゅあ「ぢゃん・まぢ」、あつの文末の笑・記号、ドラは関西弁にしない など)を守る
- 1行は60字まで。表情は `normal happy wink surprise troubled angry crying excited`

## 品物の id と好み(この表のとおりに書く)

道具(2人に贈る): basket 🧺おやつバスケット / misanga 🤝おそろいのミサンガ / cake 🍰はんぶんこケーキ / onigiri 🍙ほかほかおにぎり / tea 🫖午後のティーセット / earphone 🎧かたみみイヤホン / puzzle 🧩ふたりで解くパズル / sleeve 🃏おそろいスリーブ / cheki 📸思い出チェキ / flower 🌷ちいさな花束

| 助手 | 好き | 苦手 | ほかはふつう |
| --- | --- | --- | --- |
| mua | misanga cake cheki | puzzle sleeve | |
| kiki | tea puzzle flower | onigiri earphone | |
| momosuke | cake earphone cheki | tea puzzle | |
| dra | basket cake onigiri | puzzle flower | |
| atsu | misanga onigiri earphone | tea flower | |
| kyuko | tea earphone puzzle | basket cheki | |
| sorashido | onigiri puzzle sleeve | tea flower | |
| erubin | tea sleeve flower | cake earphone | |

家具(1人に贈る・部屋に置く): sofa 🛋️ふかふかソファ / bear 🧸くまのぬいぐるみ / plant 🪴観葉植物 / record 📻レコードプレーヤー / nyacushion 🐈ニャーのクッション / starpic 🖼️星空の絵 / trophy 🏆トロフィー棚 / bookshelf 📚小さな本棚 / heartmirror 🪞ハートの鏡 / lantern 🏮星のランタン / mirrorball 🪩ミラーボール / windbell 🎐風鈴

| 助手 | 好き | 苦手 |
| --- | --- | --- |
| mua | bear heartmirror mirrorball | bookshelf |
| kiki | plant bookshelf windbell | mirrorball |
| momosuke | record heartmirror mirrorball | plant |
| dra | sofa bear nyacushion | trophy |
| atsu | sofa record trophy | heartmirror |
| kyuko | nyacushion starpic bookshelf | mirrorball |
| sorashido | starpic trophy lantern | bear |
| erubin | plant lantern windbell | mirrorball |

## 書き方(1行1本)

```
gift mua item=cake like=like | excited え、ケーキ！？ {name}わかってるぢゃん♪ {c}、はんぶんこしよ！
gift kiki item=onigiri like=bad | troubled まあ…おにぎりでつか。{c}、半分もらってくれまつ？
hint mua item=cake | wink 最近ね〜、ケーキの気分なんだよね〜。{name}、覚えといて♪
furn dra item=sofa like=like | excited おお、ソファ！ 今日からここがおでの昼寝場所だな、えへへ
furnuse dra item=sofa | ソファでごろごろ中…
visitfurn kiki mua item=heartmirror | kiki surprise {c}の部屋、鏡が増えてまつね | mua happy でしょ♪ {name}がくれたの！
```

- `gift` … 2人に道具を贈ったときの、その人の1行(相手は `{c}`)。like= はこの表の好みと必ず合わせる(like/mid/bad)
- `hint` … 仲良し度の段が上がったときに、好きなもの1つをそれとなく教える1行(品物の名前を言っても、ぼかしてもよい)
- `furn` … 家具を自分の部屋にもらったときの1〜2行
- `furnuse` … 好きな家具を置いた部屋にいるときの吹き出し(20字まで・表情なし)
- `visitfurn` … 遊びに来た助手が、部屋の主の家具に触れる2〜3行の掛け合い

## 本数と担当

| 種類 | 本数 | コトバ | ツムギ | 段階 |
| --- | --- | --- | --- | --- |
| gift(8人×10種類×2本) | 160 | mua kiki momosuke dra(80) | atsu kyuko sorashido erubin(80) | **A(先に)** |
| hint(8人×好きなもの6つ=道具3+家具3) | 48 | 48 | | **A(先に)** |
| furn(8人×12種類) | 96 | mua kiki momosuke dra(48) | atsu kyuko sorashido erubin(48) | B |
| furnuse(8人×好きな家具3つ) | 24 | | 24 | B |
| visitfurn | 40 | | 40 | C |
| 合計 | 368 | 176 | 192 | |

置き場所: コトバ `kotoba-gift.txt`・ツムギ `tsumugi-gift.txt`(このフォルダ)。**gift と hint を先に**出してください(段階Aで使う)。
