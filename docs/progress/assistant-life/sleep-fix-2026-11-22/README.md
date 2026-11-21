# 寝顔の直し(2026-11-22 社長「助手ライフの助手の寝顔の表示方法変えた？かなりひどいことになってるよ」「サイズ感も合ってないよ」)

- 原因: 部屋のベッドで寝顔の絵を縮める決まり(2026-11-15 r1115-005「見えている部分の高さが顔2つぶんを超える絵は縮めて枕に収める」)は、胸から上の寝顔の絵のための物。11/20 に入った**全身の寝顔の絵**(きき『ツインテール』748×2818・きゅうこ『冬の装い』388×1440)では、つま先まで「見えている部分」に数えてしまい、頭がとても小さく縮んで枕の左上に浮いていた。段7(#7100)の家の作り替えとは関係しない(部屋の部品は別)
- 直し: `56-assistant-life-roomview.jsx` の `AssistantLifeRoomBed`。縦が横の2.2倍より長い全身の絵には縮める決まりを当てない(胸から上の絵は今までどおり)
- 止め絵(縦 390×844・深夜2時・偽のデータ): [before-after-390.png](before-after-390.png)(前: ツインテールのきき / 後: きき・きゅうこ(冬)・みゅあ(カードマスター)・ももすけ)。幅320: [after-kiki-twintail-320.png](after-kiki-twintail-320.png)
- 撮り直し: `node tools/assistant/life-house-typed-shoot.js --phone --hour 2 --rooms kiki,kyuko --worn kiki:kiki_twintail_v1,kyuko:kyuko_winter_v1`
- 大きさの釣り合い: 直した後の頭・枕・布団・ベッドの大きさは、11/15 に社長が見た形([../sleep-face-2026-11-15/after-sleep-8people.png](../sleep-face-2026-11-15/after-sleep-8people.png))と同じ。ベッド・布団そのものの大きさを変えるかは別に決める
