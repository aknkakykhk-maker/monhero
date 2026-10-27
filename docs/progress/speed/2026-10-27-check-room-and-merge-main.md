# 作りかけの控え: run-checks の「部屋」と merge-main の短縮(速さ部ハヤテくん・2026-10-27)

部長の指示(社長「動く作業を絞る」)で、ここで止めた。PR にはしていない。続きをする人のための控え。

## 1. run-checks を同時に回しても番号を取り合わない(「部屋」)

### ねらい
作業ツリーを2つ並べて `run-checks.js` を同時に回すと、ブラウザの検査が 8899・8977 など決め打ちの番号を取り合い、
時間切れや「ページが開けない」で誤って NG になる。決め打ちの検査は約200本あり、1本ずつ直すのは重い。

### できている所(ブランチ `speed/check-ports-room`・プッシュ済み・マージしていない)
- `tools/run-checks.js`: Linux では、番号を使う検査(ブラウザ・配信)を1本ずつ「自分だけのネットワークの部屋」
  (`unshare -rnpf --kill-child`・network namespace)の中で回す。部屋の中の localhost は外と別物
  - 部屋の中の lo は Python の ioctl で上げる(この入れ物には `ip` が無い)
  - 共有の配信(:8899)が要る検査は、部屋の中に専用の serve.py を立てる(`--parallel` の組でも)
  - 部屋の pid 1 は sh。検査が終わると部屋ごと閉じ、配信・Chromium の残りは外に残らない。時間切れは SIGKILL
    (unshare は SIGTERM では止まらないため。SIGKILL で中まで止まるのは確かめた)
  - 部屋を作れない環境(GitHub Actions・Mac)は黙って今までどおり。`--no-room` で使わない
  - 番号を使わない検査(CI の `--area always` など)は部屋に入れない(今までと同じ)
  - 外につながる前提の検査は `ROOM_OUTSIDE` に並べて外で回し、ほかの run-checks と鍵(`/tmp/mh-run-checks-outside.lock`)で順番待ち
- `tools/README.md`・`docs/rules/BUILD_CHECKS.md` に使い方を1〜2行

### 確かめた所
- 外で 8899・8977 をふさいだまま、部屋の中で render-error-check・boot-check が通る(部屋なしだと EADDRINUSE で落ちる)
- 作業ツリー2つで `--changed`(403本)を同時に回し、番号の取り合いによる NG は 0
- 部屋の中では外(本番の Supabase など)へ通信できない。通信を止めていないブラウザ検査は約147本あるが、
  上の403本で部屋のせいで結果が変わったのは `card/card-battle-browser-check.js` だけ → `ROOM_OUTSIDE` に入れた
  (なお、この検査はいまの main では部屋なしでも落ちる。カード部へ連絡済み)

### 続きに要ること
1. 全部の検査(`--area all --parallel 5`)を部屋で回した結果: **747本中 NG 16本**。部屋のせいか、もともと落ちる物かはまだ分けていない。
   この16本を `node tools/run-checks.js --no-room --script <名前>` で外でも回し、外では通る物だけを `ROOM_OUTSIDE` に足す
   - battle/moo-notice-visibility-check.js・battle/stack-marks-overlap-browser-check.js・battle/unit-detail-browser-check.js
   - card/card-battle-browser-check.js・card/card-battle-settings-browser-check.js・card/card-bind-browser-check.js
   - image/art-content-box-check.js・masu/soul-rank-step2-check.js・mode/difficulty-item-check.js
   - mode/portrait-layout-landscape-check.js・mode/rhythm-gpu-band-check.js・mode/rhythm-hit-effect-check.js
   - mode/rhythm-small-screen-layout-check.js・monster/melody-kuromy-browser-check.js
   - text/japanese-linebreak-check.js・ui/screen-effects-check.js
   (5組を同時に回したので、CPU の取り合いで遅くなって落ちた物も混ざりうる。1本ずつ回して見る)
2. そのあと作業ツリー2つで `--changed` を同時に回し、誤った NG 0 を確かめて PR(道具だけ・更新履歴なし)
3. 別件(ガードくんへ渡し済み): ブラウザ検査の多くが本番の Supabase を読みに行っている

## 2. merge-main.js の短縮と、生成物のぶつかりの自動解決

### 手を付けた所
読んだだけで、変更はしていない。

### 分かったこと
- 最後に `build.js`(作り直し)を回したあと、続けて `build.js --check` を回している。`--check` は本体の変換
  (game-system.jsx → compiled)を丸ごとやり直して比べるので、作り直した直後に同じ変換を2回している。
  ここを省けば、取り込みの時間のうち変換1回ぶん(数十秒〜1分ほど。まだ測っていない)が減る見込み

### 続きに要ること
1. `build.js` と `build.js --check` と git の取り込みの時間を測る(ほかの検査を回していない時に)
2. merge-main の中では `--check` の変換の比べを省く(作り直した直後なので同じ)。ぶつかりの印・更新履歴の確かめは残す
3. 部長の頼み: index.html の読み込み番号・asset-manifest.json・tailwind.css のぶつかりを、main 側を取って作り直す形で自動で解く
   (index.html は #3904 で数値の行だけ自動で解く形になっている。asset-manifest.json と tailwind.css は生成物の一覧 GENERATED に入っているかを確かめる)
