# 助手の立ち絵・顔に元の背景の黒い残り(r1126-105・2026-11-28)

社長(モンヒロビートのモード選び・iPhone 縦)「背景透過できてない」。ききのツインテールの立ち絵の髪の外側に、元の背景の黒い塊・黒い縁が残っていた。

## 原因

- 全身画 `fullbody/kiki_twintail__*.png` は抜き直して黒い残りが無くなっていたが、立ち絵 `stand-twintail/kiki_*.png` は前の全身画(黒い残りあり)から切ったままだった
  (`node tools/assistant/life-stand-stale-check.js` が「切り出し直し忘れ」と出していた)
- 胸像 `twintail/kiki_*.PNG`(お話などで出る絵)は、前の全身画そのもので、同じ黒い残りがある

## 直したもの

| PR | 中身 |
| --- | --- |
| 1つ目 | 立ち絵 `stand-twintail/kiki_*.png` 8枚を、直した全身画から `life-stand-from-fullbody.py` で切り直した(点は前の全身画 `twintail/kiki_normal.PNG` と重ね合わせて移した)。顔アイコン `twintail/face/` は承認済み(r1119-153 追記5)で黒い残りも無いので触らない。比べ絵: `kiki-twintail-stand-before-after.png`(上2段=直す前・下2段=直した後、白と暗い背景) |
| 2つ目 | 胸像 `twintail/kiki_*.PNG` 9枚を、直した全身画を `tools/image/upscale-anime` で1.4倍(前の胸像と同じくらいの解像度)に上げ、体のまわり11画素の余白で切り直した(色で抜かない・PNG のまま)。前の「わくわく」「びっくり」は縦に潰れていたのも正しい形に戻る。比べ絵: `kiki-twintail-bust-before-after.png` |

## 洗い出し(道具 `tools/assistant/life-stand-dark-rim-check.py`)

- 絵の外側から数画素以内の、線画より太い暗い所を数え、上位を白・暗い背景の止め絵で目で見た(黒い髪・黒い服・ドラの太い線も数に入るので、数字だけでは決めない)
- 立ち絵(stand-*)・顔(face)・服のフォルダの胸像・全身画の全部(806枚。stand-santa・santa は別の会話が作り直し中なので見ただけで触らない)
- 黒い塊の残りが見つかったのは、ききのツインテール(立ち絵・胸像)だけ

## 黒い残りとは別に見つかったもの(直していない・窓口へ)

- `life-stand-stale-check.js` が、えるびんの石油王・ももすけのハロウィンも「全身画が立ち絵より新しい(切り出し直し忘れ)」と出す。止め絵では黒い残りは無い
- 古い胸像のうち、背景ごと入っている物がある(透過していない): 助手の直下の `kyuko_*.PNG`・`myua_*.PNG`、`halloween/myua_*.PNG`、`card-master/myua_*.PNG`。前からこの形で、黒い残りの話とは別
