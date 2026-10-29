# ヘルヘイムの次の難易度(9番目の極限)の案

2026-10-29 セコンドくん(バトル部)。社長「モンバトで最高難易度のヘルヘイムのクリア者が出たから次の難易度を作りたい」。
**案だけ(まだ作らない)**。コードを読んで書いた。数字はすべて仮。

## いまの並び(極限チャレンジ)

`19-difficulties-and-rules.jsx` の `ALL_EXTREME_DIFFICULTIES`。

| 段 | 名前 | power | xp | gold | psyche | WAVE | 解放 | 段階のルール(2WAVEごとに Lv1→5) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | GOD(ゴッド) | 100 | 60 | 40 | 100 | 10 | INFINITY | 神威: 敵ライフ/攻撃 +15%/Lv |
| 7 | RAGNAROK(ラグナロク) | 200 | 80 | 60 | 130 | 10 | GOD | 黄昏: +20%/Lv・W5/W10のボスが起き上がる |
| 8 | HELHEIM(ヘルヘイム) | 230 | 100 | 80 | 160 | 10 | RAGNAROK | 冥府: +30%/Lv・味方の最大ライフ −5%/Lv・ボス復活 W3/5/7/9/10・敵ライフ10倍・W9デュラハン上乗せ・距離強化が毎WAVE薄れる |

score はどれも 20。極限の段階ルールは `EXTREME_WAVE_STAGES` に1行足すと、実効倍率・与ダメ・BREAK・表示まで同じ道を通る作り(難易度名で分けない)。

## ① 名前の候補(北欧神話の流れ GOD → RAGNAROK → HELHEIM の次)

| 候補 | 読み | 意味と流れ | よい所 / 気になる所 |
| --- | --- | --- | --- |
| **NIFLHEIM(推し)** | ニヴルヘイム | 霧と氷の国。ヘル(冥府)のさらに下、世界のいちばん底 | 「ヘルヘイムの次」が自然。カタカナ6字で読みやすい。ルール案A(霧氷)と絵が合う |
| MUSPELHEIM | ムスペルヘイム | 炎の国。ラグナロクで世界を焼き尽くす炎の巨人の国 | 冥府(緑)のあとに炎(赤)で色が分けやすい。ルール案B(業火)と合う。7字でやや長い |
| GINNUNGAGAP | ギンヌンガガプ | 世界が生まれる前の「大いなる裂け目」(始まりの虚無) | 「終わりの先に始まりへ戻る」で最終段らしい。ルール案C(虚無)と合う。7字・読みにくい |

- ユグドラシルはモンスター名と重なるので外した。ヴァルハラ(英雄の館)は「ごほうびの場所」なので最難関の名前には向かない

## ② 特殊ルールの方向(どれもヘルヘイムのルールの上に足す)

強くするだけでなく、1つ「新しい手ごたえ」を入れる。ヘルヘイムをクリアした編成(上位は強化済みの勇者モン+相性の供モン)でも、工夫が要るものにする。

### 案A「霧氷」(NIFLHEIM と合う): 先が読めない
- **霧**: 2WAVEごとに霧が深まり、Lv3から敵の「次の行動」の予告の数字が隠れる(技の種類は見える)。Lv5は1ターンおきに行動の種類も隠れる
- **氷**: 毎ターン手札の1枚が凍り、そのターンは使えない(次のターンに解ける)。凍る札はランダム
- 手ごたえ: 予告を見てガード・距離を合わせる遊び方を崩し、ガードの厚さや「凍ってもいい手札の組み方」で備える
- 手が付く範囲: 予告の表示(`enemyIntent` の出し方)と手札の札の「使えない」印(タクティクスの EX にカードを止める仕組み `cardLock` がある)を使う。新しい画面は要らない

### 案B「業火」(MUSPELHEIM と合う): 時間との勝負
- **業火**: 毎ターン終わりに、味方のライフが上限の◯%燃える(Lv1 2% → Lv5 6%)。自動回復より少し上回る
- **消火**: そのターンに与えたダメージが敵のライフの◯%を超えると、燃える量が半分になる
- 手ごたえ: 守って長引かせる遊び方が効かず、短いターンで押し切る編成・カードの順番が要る
- 手が付く範囲: ターン終わりの自動回復の所(冥府の「最大ライフを削る」と同じ場所)に1行足す形

### 案C「虚無」(GINNUNGAGAP と合う): 頼り切っている物が消える
- **虚無**: WAVE の始めに、いちばん大きい永続の強化(攻撃力・連撃・会心など、強化の札のうち1つ)が、そのWAVEだけ0になる。どれが消えたかは札に出す
- 手ごたえ: 1つの強化に寄せた育て方だけでは押し切れず、強化を散らす・WAVE ごとに戦い方を変える工夫が要る
- 手が付く範囲: 強化の札(`battleBuffChips`)と、その値の読み出し(`getPermaBuff`)の所に「このWAVEは0」を挟む。効果の札(#4206・#4214)で、消えた強化をはっきり見せられる

おすすめ: **A(霧氷)**。予告と手札というゲームの中心に新しい読み合いができ、数字を上げるだけのヘルヘイムと手ごたえが変わる。B は短く押し切る編成が決まると単調になりやすく、C は育成の楽しさを削る印象を与えやすい。

## ③ 数値の案

| 項目 | 案 | 考え方 |
| --- | --- | --- |
| power | 260 | GOD 100 → RAGNAROK 200 → HELHEIM 230 の伸び(+30)に合わせる。ルールで難しくするので数字の跳ね上げは控えめ |
| score | 20 | 極限は全部 20 |
| xp / gold / psyche | 120 / 100 / 190 | どれも HELHEIM から +20 / +20 / +30(これまでの刻みのまま) |
| WAVE 数 | 10 | ほかの極限と同じ |
| 段階ルール | 冥府と同じ刻み(2WAVEごとに Lv1→5)で、敵ライフ/攻撃 +35%/Lv | 冥府(+30%/Lv)の一つ上 |
| ボス復活・敵ライフ10倍・距離強化の薄れ | ヘルヘイムを引き継ぐ | 「ヘルヘイムの上に1つ足す」がわかりやすい |
| 解放条件 | `unlockRequirement:'HELHEIM'`(HELHEIM を1回以上クリア) | ほかの段と同じ書き方 |
| ランキング | `rankingId:'ExtremeNIFLHEIM'`・`recordId:'NIFLHEIM'` を**新しく足す** | 既存の mh_* の鍵と Supabase の表(`rankings`)の形は変えない。新しい difficulty の値で行が増えるだけ |
| 種族チャレンジ | 初クリアのごほうび(`SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS`)に `NIFLHEIM:120` | 新しい極限を足すと、種族チャレンジの段にも1つ増える作り(`SPECIES_CHALLENGE_DIFFICULTY_IDS`)。外したい場合はそこから抜く |

作るときに足す所(見積もり): `19-difficulties-and-rules.jsx` に設定1つ・段階ルール1つ・ルール詳細の文・色(`EXTREME_DIFFICULTY_THEMES`)。ランキングのタブは `isExtremeDifficultyId` で自動で極限側に入る。新しいルール(案A)の本体は 60-app.jsx の予告の出し方と手札の所。更新履歴・ヘルプも要る。

## ④ ヘルヘイムのクリア者を読む SQL(読むだけ・SELECT のみ)

表は `rankings`(`26-supabase.jsx` の送信 `/rest/v1/rankings`、`60-app.jsx` の `submitLocalScore` の行)。
列: `difficulty`(ヘルヘイムは `ExtremeHELHEIM`)・`user_name`・`hero`(勇者モンの名前)・`party`(JSON の配列。1人ずつ `role`('hero'|'ally')・`id`・`name` など)・`score`・`turns`(**クリアしたときだけ入る**)・`reached_wave`・`level`・`created_at`。

```sql
-- ① ヘルヘイムのクリア者の人数と、クリアの回数
select count(distinct user_name) as clear_players, count(*) as clear_runs
from rankings
where difficulty = 'ExtremeHELHEIM' and turns is not null;

-- ② クリアした人ごとの、いちばん良い記録と編成(勇者モン・パーティ)
select distinct on (user_name)
  user_name, score, turns, hero,
  (select string_agg(p->>'name', '・' order by (p->>'role') desc) from jsonb_array_elements(party) as p) as party_names,
  created_at
from rankings
where difficulty = 'ExtremeHELHEIM' and turns is not null
order by user_name, score desc, created_at asc;

-- ③ クリアした編成で多い勇者モン・供モン(人数の多い順)
select p->>'role' as role, p->>'name' as monster, count(distinct user_name) as players
from rankings, jsonb_array_elements(party) as p
where difficulty = 'ExtremeHELHEIM' and turns is not null
group by 1, 2
order by 1, 3 desc;
```

- `party` が JSON でなく文字列で入っている場合は `party::jsonb` にする
- 書き換え・消す SQL は入っていない(読むだけ)
