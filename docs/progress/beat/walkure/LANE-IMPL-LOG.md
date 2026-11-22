# ワルキューレ本実装レーン 作業ログ（2026-11-22）

根拠: 社長決定 r1119-090（上限表は実績に合わせて緩める／settleLevelSwitches は曲PRに同梱／本実装を公開まで進める／公開前に gate）。
担当範囲: ローカル実装＋ブランチへのソースのみコミット＋測定・回帰・gate 記録＋PR説明文下書き。PR作成・マージはメイン。

## 節目ログ

- 2026-11-22 13:03 レーン開始。正本（HANDOFF / IMPLEMENT-NOTES / prep REPORT・HELL-SELECT・STEP6-FIX・FAST-HELL-COMPARE）を読了。
- worktree `~/workspace/monhero-wt-walkure` を origin/main(0f79c911) から作成、ブランチ `claude/walkure-song-add`。tools の npm install 済み。
- 資産コピー完了: 音源2（monster-hero/audio/）・ジャケット（images/song-art/walkure.jpg）・原音源2（tools/art-sources/song-audio/walkure{,_short}/）・authoring 28ファイル。
- 手順1（下準備の反映）完了: charts-fixed-local の3ファイル（原曲EXPERT/MASTER・ショートEXPERT）を authoring へ反映。他の fixed は charts/ と完全一致、差分は対象3ファイルのみを確認。
- registry に walkure / walkure_short を追加（chartRevision 40・sha は実ファイルと一致を確認）。
- 新上限の再確認: fast-compare/results.json（公開HELL 80譜面）から帯ごと最大値を再計算 → Lv<45:37（mou_hitotsu_no_sekai_e）/ 45-54:46（kiki_issen）/ 55-64:32（erfolg）/ ≥65:25（freedom_dive）。社長提示と一致。
- 手順2・3（hell-mix 移植＋上限表）完了: settleLevelSwitches を作業コピーから本物へ移植（mixBest の precision/通常の両経路に opt-in フック・CLI フラグ/ログ/書き込みガード・exports）。LEVEL_SWITCH_ALLOW（37/46/32/25・根拠コメント付き）を rhythm-hell-mix.js に定義し、CLI の集計行に上限を併記。SONGS に walkure（variant0・phrases ground,L,ground,R・levelSettle:true）と walkure_short（variant2）を追加。
- 単体テスト: prep/test-levelsettle.js を tools/mode/rhythm-hell-mix-levelsettle-test.js として配置（参照先だけ本物へ変更）→ 7ケース17項目 全件合格。
- 回帰確認（フラグ無し）: 変更前（git HEAD 版）と移植後で mixBest を A/B。sheriruth・against_my_own_shadow の通常経路と precision 強制経路の両方で、ノーツ列ハッシュ・内訳・段変え・settle・precision の全指標が完全一致。
- 手順4完了: tools/mode/CLAUDE.md に settleLevelSwitches の決まりを1行追加。
- 注意点（公式測定の前に判明）: 見当付け P2（scout・mix単体）では帯の中が1件残っていた（原曲 variant 0 の既知分 99.22s）。公式測定（mixBest・引き出しあり）でどう出るかを確認する。
- 登録まわりを実装しコミット: rhythm-mode.js の入れ物・登録一式（scaffold を実ファイルのアンカーに合わせて適用）、runtime-notes 2行、BGM_TRACKS 2行、有料の表（walkure:500・walkure_short はバンドル所有者 walkure）。コミット df68e6db。
- **公式測定（手順5）実施・ここで停止**（2026-11-22 14:16〜15:27・約72分、`node tools/mode/rhythm-hell-mix.js --song walkure`・--write なし。全出力は `hell-official-measure.log`）:
  - 結果: **Lv.61**／モンスター4 ✓／水平クロス0 ✓／押せない0 ✓（横持ち・地上シミュとも）／見分けにくい所0 ✓
  - 段変え: settleSwitches で 32→17、**settleLevelSwitches で 22→16**（下ろした5・残り内訳 スライド起因9／下ろせなかったタップ7／その他0）。最終 **16件 ≤ 新上限32（Lv61・帯55-64）で上限内**。ただし見当付け P2 の「6件」にはならなかった（公式 mixBest は引き出し R3/R4 を使用し energyBias 1 を選ぶため、mix 単体・引き出し無しの scout と着地が違う。空タップ113・スライド75）
  - **帯の中 1件（99.22s・半レーン幅1が絡む）✗** — variant 0 の既知分が公式でも残った。道具自身が「書いたあと rhythm-chart-hand-rules-check.js が NG にする」と出力。選定条件（帯の中0）を満たさない
  - → 手順5の停止条件（6件にならない／他条件で落ちる）に該当するため、**パイプライン --release 以降は進めず停止**。判断待ち事項: ①段変え16件（新上限内）を「選ぶ」でよいか（社長決定の文面は仕上げ後6件が前提）②帯の中1件（99.22s）の扱い（局所修正の可否・variant変更・引き出し無しでの再測定など）
  - 未実施: パイプライン --release（両版）／HELL --write（両版）／レベル表 --write／songClimax／expert-master-order-check／hand-rules-check／run-checks／changelog／gate／PR-DRAFT。ブランチは登録までコミット済みで再開可能な状態。
