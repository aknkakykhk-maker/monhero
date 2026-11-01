# モンヒロビート「軽さ・演出」を1つずつ選べるようにする(作業メモ)

2026-11-01 社長「演出量とか背景を別に細かく設定したい」。窓口(統括部長)経由。案と止め絵は
`claude/tempo-options-plan` の `docs/progress/options-plan/`。社長の決定:

- 演出量・ライブ背景がまとめて出し入れしているものを、1つずつ選べるようにする(判定文字の高さ・残像は今回は入れない)
- 各項目に「おまかせ」(既定)。おまかせ = いまの演出量・軽量モード・ライブ背景・各スイッチどおり(見た目は1つも変わらない)
- おまかせ以外を選んだ項目は、演出量「最小」・軽量モードのときも選んだとおりにする
- 画面: 「まとめて決める」(演出量・軽量モード・重いときは自動で控えめ)の下に組ごと。縦は ▶ で開く、横は左に組の一覧・右に中身。軽/中/重の札。横で段の多い項目は1列
- 保存: 既存の設定は名前も値も変えない。設定(rhythm settings)に `fx` を1つ足し、その中に項目ごとの値。無い人・壊れた値は全部「おまかせ」

## 仕組み

- `RHYTHM_FX_ITEMS`(13-bgm-and-rhythm-settings.jsx): 項目の一覧(キー・組・名前・重さ・選べる値)
- `normalizeRhythmFx(raw)`: どの値も一覧に無ければ `AUTO`
- `rhythmFxLevel(settings,key)` / `rhythmFxLight(settings,key)`: CSS 用の「演出量の段」と「軽量モードかどうか」の組。
  AUTO はいまの演出量・軽量モードそのまま。出す/強/大 は `NORMAL`・軽量でない、出さない/なし は `MINIMAL`・軽量
- 演奏画面(画面全体とプレイエリア)に `data-fx-<項目>` と `data-fx-<項目>-lw` を付け、CSS の `[data-rhythm-effect=…]` `[data-rhythm-lightweight="true"]` のうち
  その項目の要素を止めている規則だけを付け替える(おまかせなら同じ値の組が入るので見た目は同じ)。1つの値にまとめると、
  軽量モードのときに演出量の段の規則が効かなくなって見た目が変わるので、2つに分けている

## 進み具合
- [x] 設定の器・正規化・解決の関数(rhythmFxPick/Level/Light/On/Attrs/RenderOptions/StageLevel/StageStyle/ArtSize・rhythmJudgeScaleStyle)
- [x] CSS の付け替え(index.html 11規則・rhythm-mode.js 4規則。data-fx-<項目> と data-fx-<項目>-lw の2つ組)。レーンの区切り線は rhythm-lane-svg.js
- [x] JS の付け替え(背景 WebGL/CSS・道の演出3つ・ノーツの描き手 glowLevel/hitLevel/hitScale/motionFlick/motionSlide・100コンボ・フルコンボ・判定文字の大きさ・最小/軽量の分かれ道で出すを選んだ項目)
- [x] オプション画面(縦・横)
- [x] 止め絵(枝 claude/tempo-fx-detail-shots)・更新履歴とヘルプの文案 → 窓口へ送った(2026-11-01)
- [ ] 社長の「この文で」→ 更新履歴・ヘルプを入れてマージ
