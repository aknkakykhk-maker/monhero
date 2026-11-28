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
| 3つ目 | えるびんの石油王の立ち絵 `stand-sekiyuou/erubin_*.png` 8枚を今の全身画から切り直した(切り出し直し忘れ)。測ったときの古い全身画が残っていないので、点(頭の布のてっぺん・目・顎)は今の全身画で測り直した。顔アイコンは承認済みなので触らない。比べ絵: `erubin-sekiyuou-stand-before-after.png`。モード選びの枠では前より顔が大きく写る(数字の 0.90 倍は顎の目印を直したための見かけの差) |
| 4つ目 | 背景ごと入っていて透過していなかった古い胸像32枚(助手の直下の `myua_*.PNG`・`kyuko_*.PNG`、`halloween/myua_*.PNG`、`card-master/myua_*.PNG`)を、今の全身画 `fullbody/<名前>__<表情>.png` から透明のまま切り直した(色で抜かない・PNG のまま・元と同じ縦横比と大きさ。みゅあは頭から体の6割、きゅうこは元と同じ胸から上)。比べ絵: `bust-myua-before-after.png`・`bust-halloween-myua-before-after.png`・`bust-card-master-myua-before-after.png`・`bust-kyuko-before-after.png` |
| 5つ目 | ももすけのハロウィン: 社長の答え(18:45)「作り直す」。全身画の「ふつう」`fullbody/momosuke_halloween__normal.png`(469×899・古い小さい世代)を upscale-anime で約2.22倍にし、ほかの7表情と同じ高さ2000・上下13画素の余白にそろえてから、立ち絵 `stand-halloween/momosuke_*.png` 8枚を切り直した(点は前の「ふつう」と重ね合わせて移した)。顔アイコンは承認済みなので触らない。比べ絵: `momosuke-halloween-stand-before-after.png` |

## 洗い出し(道具 `tools/assistant/life-stand-dark-rim-check.py`)

- 絵の外側から数画素以内の、線画より太い暗い所を数え、上位を白・暗い背景の止め絵で目で見た(黒い髪・黒い服・ドラの太い線も数に入るので、数字だけでは決めない)
- 立ち絵(stand-*)・顔(face)・服のフォルダの胸像・全身画の全部(806枚。stand-santa・santa は別の会話が作り直し中なので見ただけで触らない)
- 黒い塊の残りが見つかったのは、ききのツインテール(立ち絵・胸像)だけ

## 黒い残りとは別に見つかったもの(直していない・窓口へ)

- ももすけのハロウィンの「切り出し直し忘れ」は5つ目で直した(全身画の「ふつう」を作り直してから切り直し)
- 背景ごと入っていた古い胸像は4つ目で直した
- `tools/image/art-content-box-check.js` は main でも NG(表が今の絵と合っていない)。作り直すとクリスマスの服など関係の無い絵の行まで大きく書き換わるので、今回は触っていない
