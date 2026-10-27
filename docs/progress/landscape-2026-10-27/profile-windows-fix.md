# プロフィールの窓(ストックくん向け)の直し案 — 横向きで一覧が見えない・窓の上が切れる

## 1. 共通の窓 PickerSheet(monster-hero/src/parts/42-picker-sheet.jsx)
アイコンを選ぶ・プロフィールフレーム・助手の着替えは、すべてこの部品。横向きの低い画面(高さ520px以下)で、
注釈・「いまの」の札を隠し、見出し・検索・閉じるを小さくして一覧に高さを回す。667×375 で、フレームの一覧が
「1段の半分」から「2段」見えるようになった(写真 images/picker-sheets-*.jpg)。

下の指定を、各行の class の最後に足す(V = `[@media(orientation:landscape)_and_(max-height:520px)]:`)。

- ヘッダー枠 `shrink-0 px-4 pb-2 pt-4` → `+ V pb-1 + V pt-2`
- 見出し h3 `text-lg` → `+ V text-base`
- 注釈 p → `+ V hidden`
- 「いまの」の札 `data-picker-preview` → `+ V hidden`
- 検索 input → `+ V mt-1.5 + V min-h-[36px]`
- チップの列 → `+ V mt-1`
- 閉じるの枠 `pt-2` → `+ V pt-1`、閉じるボタン → `+ V min-h-[40px] + V py-2`

## 2. ModalFrame(41-screen-ui.jsx)
中身が画面より高い横向きで、窓の上が画面の外へ切れて届かなくなる(例: 助手の仲良し度「ごほうび一覧」、667×375)。
`items-center` の中央寄せが原因。外枠を `items-start`、窓に `my-auto` を足す(中央寄せは保ったまま、はみ出したときは上から読める)。
