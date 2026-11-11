# 確認の段数(ミハリの確認が要る変更・要らない変更)

2026-11-11 社長「トークンを無駄に使わない仕組み」「開発品質は落としたくない」(案D)。
それまでは小さな直しにも、部の検査 → ミハリ(検査部)→ 窓口、と同じ確認を何段も重ねていた。

## 決まり

**ミハリの確認が要るのは、①保存データ ②ランキング・Supabase ③新機能 に関わる変更だけ。**
それ以外(表示のずれ・文言・絵の差し替え・検査や資料だけ)は、部の `node tools/run-checks.js --changed` が通れば公開してよい。

検査は減らさない。`run-checks.js --changed` はこれまでどおり全部通す(減らしたのは「人の目の段数」だけ)。

## 判定は機械がする

```
node tools/ctx.js gate              いまの変更(origin/main との差 + 未コミットの分)を判定
node tools/ctx.js gate --base <版>  その版との差で判定(ミハリが見る範囲を確かめるとき)
```

`node tools/run-checks.js --changed` の最後にも同じ判定が出る(打ち忘れない)。

| 「要る」になるもの | 何を見ているか |
| --- | --- |
| 保存データ | `25-storage.jsx`・`mhsave-backup.js` を変えた / 新しい保存キー(`mh_…`)が増えた / 保存キーを使う行がすべて消えた / 保存を消す・移す行(`localStorage.removeItem`・`_migrated_v…`)に触れた |
| ランキング・Supabase | `supabase/migrations/`・`docs/sql/`(SQL)を変えた / 本体で `.rpc(`・`.insert(`・`.upsert(`・`submit…Score` などの送り方の行に触れた |
| Edge Function | `supabase/functions/` を変えた(★下の「Edge Function だけのとき」) |
| 新機能 | 新しい部品(`src/parts/*.jsx`)を足した / 公開の印を真にした / 更新履歴に3行以上足した |

迷う変更は「要る」に倒してある(壊すと戻せないため)。道具が「要らない」と出しても、部が不安なら窓口へ頼んでよい。

## 「要る」と出たら

1. 部: マージの**前**に窓口へ知らせる(PR の番号と、gate の出力)
2. 窓口: ミハリへ渡す。確認のモデルは gate の出力のとおり
   (新しい画面・公開の印 → `claude-fable-5-2` で最終確認1回 / 保存データ・ランキング → `claude-opus-5-5` / 更新履歴だけ → `claude-sonnet-5-5`。[`MODEL_ROUTING.md`](MODEL_ROUTING.md))
3. ミハリ: 見るだけ(直さない)。見る所は [`docs/depts/kensa.md`](../depts/kensa.md)。OK なら部がマージする

### Edge Function だけのとき

`supabase/functions/` を変えても、**マージしただけでは本番は変わらない**(本番は、配ったときの固定の版を読んでいる)。
gate は「要る(配り直しのとき。マージは進めてよい)」と出す。部はマージして、窓口へ配り直しを頼む。
窓口が配り([`EDGE_REDEPLOY.md`](EDGE_REDEPLOY.md))、配ったあとに本番で確かめる(400 `bad_request` と、変えた機能の通し)。
ゲーム本体も一緒に変えていて保存データ・ランキング・新機能に当たるなら、ふつうの「要る」(マージの前)になる。

## 「要らない」と出たら

部の検査が通りしだい、聞かずに公開する(CLAUDE.md ②③)。ミハリ・窓口の確認を待たない。報告は公開のあとに1通。
