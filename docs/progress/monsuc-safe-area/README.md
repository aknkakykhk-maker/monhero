# モンサクの窓と iPhone の上の帯(safe-area)・2026-11-20 窓口 M4

止め絵は縦 390×844。上の黒い帯は iPhone の切り欠き・時計の帯(47px)を再現した物(撮るときに `.msx-wrap` の上の余白を 47px にして撮った)。
左が直す前・右が直した後。

- `S2FD-before-after.jpg` フレンドの詳細 / `M1D-before-after.jpg` 育成中の詳細 / `M3-before-after.jpg` 持ち物
- どれも直す前から帯にかかっていない。外枠 `.msx-wrap` が `env(safe-area-inset-top)` の分を空けていて、窓はその内側に出るため
- M4 の測り(tools/browser/ui-measure.js)は、窓の位置を決める箱までしか safe-area を探さないので、外枠の余白を見落としている
- 直したのは、外枠の余白を通らない「画面に固定した窓」(`.msx .v-body>.msx-ov`)だけ。上下に safe-area の分を空ける
