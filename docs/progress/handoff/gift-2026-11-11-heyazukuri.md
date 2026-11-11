# 引き継ぎメモ: ヘヤヅクリ(助手ライフの家具の模様替え)(2026-11-11)

次の会話は、CLAUDE.md → `docs/depts/gift.md`・`docs/depts/assistant-life.md` → `node tools/ctx.js decisions gift` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。

## 済んだこと

- **模様替えを公開した**(PR #5364・2026-11-11 20:03・公開の印 `assistantLifeRoomEdit` オン)。部屋 →「🪑 家具」→「🛠 模様替え」。
  指でつまんで動かす・指2本のピンチと大/小・左右を返す・回す・色あい/明るさ/あざやかさ・前へ/後ろへ・助手の前/後ろ・しまう/出す・「◯◯におまかせ」・もとに戻す
- 本体: `monster-hero/src/parts/56-assistant-life-roomedit.jsx`。差し込み: `56-assistant-life-roomview.jsx`(AssistantLifeRoomScene の layoutWho・layoutItems・layoutEdit)・
  `56-assistant-life-house.jsx`(AssistantLifeRoomSheet の layoutOpen)・`56-assistant-life-gifts.jsx`(AssistantLifeFurnSheet の onLayout・isPut・movePut、AssistantLifeRoomFurn の分かれ道)
- 保存: `mh_assistant_life_room_layout_v1`(並び)・`mh_assistant_life_room_layout_migrated_v1`(一度きりの写し)。`mh_assistant_life_room_v1` は読むだけ。形は `docs/spec/SAVE_DATA.md`
- 検査: `node tools/assistant/assistant-life-roomedit-browser-check.js`(`--shots` で止め絵)。`assistant-life-furn-browser-check.js` は古い置き方(put で描く道)を、ページの中で印をオフにして確かめる
- 資料: `docs/progress/assistant-life/ROOM-LAYOUT-PLAN.md`(案・試作・止め絵)・`ROOM-LAYOUT-PREP.md`(8種類の案・おまかせの型・保存の形)

## 次の仕事: 家具を8種類足す(社長「この案で」・台帳 2026-11-11)

中身は `ROOM-LAYOUT-PREP.md` の1(名前・絵文字・置く所・値段・好き/苦手の表)のまま。絵は絵文字。

1. `data/assistants.js` の `ASSISTANT_LIFE_FURNITURE` に8つ(key・itemId `furn_<key>`・slot)。`ASSISTANT_LIFE_FURN_LIKES` に好き/苦手を足す
2. 持ち物 `data/breeder.js` の `BREEDER_MARKET_ITEMS`(`furn_*` の並びの後ろ)と、交換所 `data/rhythm-event.js` の `RHYTHM_EVENT_POINT_SHOP_OFFERS`(家具の段・値段)へ8つ。今の12種類と同じ書き方
3. `56-assistant-life-gifts.jsx` の `ASSISTANT_LIFE_FURN_SHORT`(短い名前)に8つ。`56-assistant-life-roomedit.jsx` の `ASSISTANT_LIFE_LAYOUT_SEATS`(おまかせの席)は1か所5席まで。
   床が 5+4=9、壁 4+2=6、天井 3+2=5 になるので、**床と壁の席を足す**(足りない分は押し入れへ行く作り)。席は家具・助手・窓・マスモンに重ならない所を止め絵で確かめる
4. 台詞: 贈ったとき 8人×8種類と、好きな家具の吹き出し8つを**ココロ2(session_0113GBaDyFxewdSnk2XfiCxF)へ依頼済み**。JSON は窓口へ届き、窓口から渡される。
   入れ先は `ASSISTANT_LIFE_FURN_LINES`(形 `{ [助手]: { [key]: [{ like, lines: [{ e, t }] }] } }`)と `ASSISTANT_LIFE_FURNUSE_LINES`。入れたら `assistant-line-owner-check.js`・`boot/ja-wrap-lines-check.js`
5. 新しい家具の「置く所」の「小物・窓辺にも」は、いまの作りでは意味を持たない(どこにでも置ける)。slot は 床/壁/天井 だけ決めればよい
6. 更新履歴・ヘルプ(ヘルプの「12種類」を直す。`{t:'data'}` にできるなら替える)。**文案を窓口へ**(社長の「この文で」が要る)。値段と保存に関わるので**マージ前にミハリ3へ**(窓口が立てる)
7. フレンドの家の控えは1人 6000字まで。1人あたり20個を超えそうなら**トモダチ(session_0113GBaBARbQkE73ayCg7oJX)へ知らせる**(今回は最大20個で、ちょうど境目。知らせる)

## 返事待ち・頼んであること

- ココロ2: 上の台詞(窓口経由で届く)
- トモダチ: フレンドの家で新しい並びを見せる配線(口は main にある: `assistantLifeLayoutPack`・`assistantLifeLayoutUnpack`・Scene と AssistantLifeRoomFurn の `layoutItems`。着手はトモダチの今の直しのあと・SQL は要らない)
- 窓口: 本番で模様替えを見た結果(直しが来たらこの部で直す)

## はまった所・やってはいけないこと

- **広い検査を回している最中に build しない・データを書き足さない**(結果が混ざる。事前ダウンロードの検査が NG になった)。`run-checks.js --changed` は未コミットの変更しか見ないので、枝ぜんたいは `--changed --base origin/main`(約30〜50分。裏で回し、出力はファイルへ。`| tail` だと途中が見えない)
- **更新履歴の日時は「その項目を最初にコミットした時刻」と比べられる。** 公開の印つきで先に書いた項目は、公開のとき枝を最新の main から作り直して1つにまとめる(`git merge --squash`)と今の時刻で通る
- 部品の引数に `scene` という名前を使うと、中の `'noon'` が助手の場面の見張り(assistant-check)に当たる
- 強制プッシュ(`--force-with-lease`)は止められる。マージ済みの枝は使い回さず、新しい名前の枝を最新の main から作る
- 新しい部品を足したら `tools/team/depts.json` の files(→ `node tools/team/dept-guide.js --write`)と `docs/spec/SAVE_DATA.md`(保存キー)へ足す
- 家具のシートの検査は、助手ライフを開く段でたまに落ちる(タイミング)。回し直して通れば中身の不具合ではない
- 模様替えの並びを読む前(`ASSISTANT_LIFE_LAYOUT_STORE.loaded` が偽)には保存しない作り。ここを外すと、保存してある並びを空で上書きする
- `card/card-battle-browser-check.js` ⑧ は main でも NG(カード部へ伝達済み・この部の仕事ではない)

## 配り直し・SQL で窓口に頼んだまま済んでいないもの

なし(Supabase には触れていない)
