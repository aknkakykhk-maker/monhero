# Fable の点検 ①-11・12・15・16 の止め絵(main に当て直したあと)

撮影: `SHOT_TUT=1 SHOT_ONLY=T1,K1 SHOT_SIZES=base,s320 node tools/success/success-shoot.js`(ほかの絵は枝の元の撮り)

| 点検 | 内容 | 止め絵のどこで見るか |
| --- | --- | --- |
| ①-12 説明の窓は動きが止まってから | トレーニングを選ぶ画面を開くと、動きが止まった所で みゅあの説明が1つだけ出る | `main-T1.png`(幅390)・`main-T1-s320.png`(幅320)の下の窓「トレーニングは6つ。…」 |
| ①-11 演出中は上の帯に結果を先に見せない | 「〜をする」の演出のあいだは押す前の値、結果の画面で変わった値 | `band-K1-act-vs-K3-result.png`(左が演出中・右が結果) |
| ①-15 編成の子の出来事を得意な能力の台本で | 出来事の台詞は cheer.<役割>.epN があればそれ、なければ共通 | 台本 `data/monhero-success-script-mua.js`・`tut-*.png` |
| ①-16 台詞も助手の親密度の段で | 受付・試合・結果の台詞が親密度に合わせた言い方(ていねい語/タメ口) | `SE.say` に bond を渡す(`msxCurBondLv`・保存はしない) |

検査: run-checks --changed 450本・NG 0。ミハリ10 OK(gate の「要る」は msxCurBondLv の誤判定)。
