# 曲えらびのジャケット 原本

ユーザーから届いた**加工前の**ジャケット画像を置く。ここはゲームから読み込まない。

モンヒロビートへ曲を入れるときに、ここから配信用の形へ落とす。

```
# 512×512 JPEG（fit:'cover' / quality:80 / mozjpeg）60〜90KB へ
node -e "require('/home/user/monhero/tools/node_modules/sharp')('tools/art-sources/song-art/◯◯.jpg')\
  .resize(512,512,{fit:'cover'}).jpeg({quality:80,mozjpeg:true}).toFile('monster-hero/images/song-art/◯◯.jpg')"
```

手順の正本: [`docs/rules/ASSETS.md`](../../../docs/rules/ASSETS.md) ⑥-2 と
`.claude/skills/rhythm-song-add/SKILL.md`。

| 曲 | 原本 | いまの使いみち |
| --- | --- | --- |
| 戦場の疾風 | `senjou-no-shippuu.jpg` | タクティクスバトルの通常戦BGM（モンヒロビートには未実装） |
| 魔窟の旋律 | `makutsu-no-senritsu.jpg` | タクティクスバトルのボス戦BGM（同上） |

> この2枚は2026-09-21にユーザーから「**今後モンビー実装用にジャケットも送っとく**」として
> 届いたもの。**いまは配信していない。** `monster-hero/images/song-art/` へ置くのは
> モンヒロビートへ曲を入れるときだけ（先に置くと `tools/image-asset-check.js` が
> 「どこからも参照されていない絵」として落とす）。
