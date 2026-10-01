# 定期メンテナンス点検 2026-10-01 10:12 JST

点検の種類: 週次(必須+CI+文書)

## 検査
- 合計 55 本 / OK 52 / NG 2 / TIMEOUT 0 / SKIP 1 / MISSING 0 / 68秒
- SKIP は 1 本(playwright / canvas が無い環境では実ブラウザ検査を飛ばします)
- ❌ NG: `help-render-check.js`
  -   requireStack: [ '/home/user/monhero/tools/help-render-check.js' ]
  - }
  - 
  - Node.js v22.22.0
- ❌ NG: `mode/rhythm-mode-note-se-check.js`
  - ✓ 作り置きのあと大きさをそろえる
  - ✓ 曲えらび・演奏の画面を開いたときに作り置きする
  - 
  - 1件のNGがあります

## 衛生チェック
- ℹ️ どこからも名前が出てこない画像の候補 179 枚(動的なパスは拾えないため、消す前に確認): assistant/dra_angry.PNG, assistant/dra_crying.PNG, assistant/dra_excited.PNG, assistant/dra_happy.PNG, assistant/dra_normal.PNG, assistant/dra_surprise.PNG, assistant/dra_troubled.PNG, assistant/dra_wink.PNG …
- 約束の破れ・急な肥大は見つかりませんでした

## 大きさ
- monster-hero/src/parts/60-app.jsx: 1.57MB
- monster-hero/data/rhythm-mode.js: 1.64MB
- monster-hero/data/changelog.js: 1.00MB
- monster-hero/game-system.compiled.js: 3.74MB
- docs/spec/RHYTHM_MODE.md: 0.53MB
- CLAUDE.md: 0.02MB
- monster-hero/images/: 28.70MB
- monster-hero/audio/: 109.26MB
- monster-hero/movies/: 2.93MB

## 総合

❌ 対応が要るものがあります(上の ❌)
