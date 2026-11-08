
## 作った(2026-11-08 夜・枝 claude/nakayoshi9-roomview2・未公開)
- 部品 `56-assistant-life-roomview.jsx`(AssistantLifeRoomScene・AssistantLifeRoomFigure・AssistantLifeRoomFront・assistantLifeRoomMasmons)。部屋のシート(AssistantLifeRoomSheet)の上(横は左 58%)に置き、下(横は右)は今までの中身のまま(ボタン・印は変えていないので、他部署の検査はそのまま通る)
- いちばん前のボタンは「← 家へ」(data-assistant-life-roomview-close・閉じる)。縦は札の段6つ(data-assistant-life-roomview-act)
- 左上の暗い所を押して閉じていた検査2本(solo・buygive)は「← 家へ」を押す形に直した
- 検査 `tools/assistant/assistant-life-roomview-check.js`(縦3・横2・タブレット × ひとり/2人/寝ている/留守)。止め絵 roomview/real-*.png・real-tate.jpg・real-yoko.jpg
- フレンドの家はオトズレ3へ部品の渡し方を送った(すり合わせ待ち)
