# 助手画像 正本管理システム (リポジトリ側スキル)

助手画像 (全身・立ち絵・バスト・顔アイコン) を扱うときは、`tools/assistant-image-registry/` の台帳と道具を使う。要点だけここに置き、詳細は同フォルダの `README.md` が正本。

## 守ること

- 正本の判断は台帳 `tools/assistant-image-registry/registry.json` (最新 main から `build_registry.py` で再生成) で行う。過去の会話・キャッシュ・一時フォルダの画像を正本にしない。
- 生成・切り出しの前に参照元の SHA-256 を台帳と照合する。一致しなければ開始しない。同名でもハッシュが違えば別世代。
- 正本を更新したら、依存する派生 (立ち絵・顔アイコン) の鮮度を台帳で確認する。`stale` の派生を最新として提示・実装しない。
- 顔アイコンは再描画せず、承認済み全身絵から `make_face_icons.py` で自動切り出しする (ランドマークと画角仕様は台帳側ファイルが正本)。
- 提示・実装前に `verify.py candidates` の機械検証を通す (旧世代混入・再提出・重複・透過・寸法規格)。目視確認 (衣装・表情・指・縁) は比較シート `make_sheet.py` で分けて行う。
- 承認状態は `approvals.json`、参照元記録は `provenance.json` が保持する。記録が無い組の承認状態は `unknown` で、勝手に承認扱いにしない。
- 既存の `tools/image/assistant-art-catalog.json` (原本の宣言) とは役割分担: あちらは原本、こちらは個々のファイルのハッシュ・承認・鮮度。
- 新規 GitHub Actions は作らない。公開素材の変更・削除は承認された作業の範囲でのみ。

## 縁を原本のままにする(2026-11-28 r1126-095 追記2・社長「新着替えでまた同じ現象。実装の仕方が悪い」)

- 透け方は原本の物を Lanczos で広げて使い、AI 拡大(`tools/image/upscale-anime/upscale.py`)は色だけ。
  原本の縁を削る・ぼかす・内側の色で塗り直す掃除はしない(「なめらかにする」「ぼかして馴染ませる」加工は縁にも中身にも入れない)。
  全身は `tools/assistant/life-fullbody-art.py` が `tools/assistant/art_edge.py` を通して作る(新しい服は `LEGACY_CLEAN` に足さない)。
  入れたら `node tools/assistant/art-edge-check.js`(原本と比べて白い縁取り・外の線の消え・ギザギザ・ぼやけが悪ければ落ちる。`run-checks.js --changed` が選ぶ)
- 道具の掃除が外の黒い線を肌色で塗って白い縁取りを作った前例: #8044(止め絵 `docs/progress/assistant-art/edge-fix-2026-11-28/`)
