# 使っていない絵・音の保管場所(配信しない)

ゲームのどこからも使っていないと確かめた絵・音・データを、消さずにここへ移して残している
(2026-11-21 社長の頼み r1119-063・r1119-064)。

- **配信されない。** GitHub Pages に載るのは `index.html` と `monster-hero/` だけ
  (`.github/workflows/compiled-check.yml` の「Stage the GitHub Pages site」)。ここはリポジトリ直下なので載らない
- 下の道筋は元の場所をそのまま残している。`archive/unused-assets/monster-hero/images/...` の元は `monster-hero/images/...`
- 移した物と理由は下の表。ここに入れるのは、次の2つの両方で「使っていない」となった物だけ
  1. 静的: コード・データ・CSS・HTML に道筋もファイル名も出てこず、名前を組み立てる規則(助手の絵・カードの絵・全身絵など)に照らしても作られない
  2. 動かして: 撮影の道具(`tools/browser/visual-shoot.js` ほか)で主な画面を開いたとき、読み込まれた物の記録に出てこない

## 使っていない物の探し方(道具)

```
node tools/image/unused-images.js             要約だけ画面に出し、一覧を docs/progress/dev/r1123-008/unused-images.md に書く
node tools/image/unused-images.js --why <語>  その画像の判定と理由
node tools/image/unused-images.js --selftest  道具の自己点検
```

道具は上の 1(静的)だけを見る。画像は動かさない。「使っていない候補」に出た物を、2(動かして)でも確かめてからここへ移す。
「要確認」に出た物は残す(2026-11-22 r1123-008)。

## 戻し方

```
git mv archive/unused-assets/monster-hero/<道筋> monster-hero/<道筋>
node tools/build.js
node tools/image-asset-check.js
```

戻したあとは、使う所(データ・コード)に道筋を書いてから公開する。

## 移した物

| 元の道筋(monster-hero/ の下) | 大きさ | 使っていない理由 |
| --- | --- | --- |
| `images/card-battle/s/C060C.jpg` | 18.7KB | ファンアートのカード。原本の表(`tools/art-sources/card-battle/hybrid/cards.json`)で `excluded`(社長の決めで入れない・台帳 #3413)。カードの表 `data/card-battle-cards.js` の `img` にも番号にも無い |
| `images/card-battle/l/C060C.jpg` | 51.5KB | 同上(大きい版) |
| `images/assistant/fullbody/sorashido_sleep.png` | 414.7KB | 全身絵は `<名前>.png` か `<名前>__<表情>.png`(`data/assistants.js` の `assistantFullBodyImageOf`)。寝顔(sleep)は全身絵の表情に無いので、この名前は作られない |
