// MHB CHART ENGINE(モンヒロビート譜面エンジン)のリビジョン(chartRevision)。
//
// 【名前】(2026-09-26・ユーザー指示「このツール自体にちゃんとした名前をつけて、それにバージョン的なのをつけてほしい」)
// 自動譜面制作V3(解析 → 生成 → 自動修正 → 書き出し)をまとめて「MHB CHART ENGINE」と呼び、
// 譜面の作り方の世代を「Rev.7」のように書く(以前は「版7」と書いていた。数字はそのまま)。
// 表示は chartRevisionLabel(7) → 'MHB CHART ENGINE Rev.7'。曲の一覧・譜面のJSONの項目名 chartRevision と、
// そこに入る数字は変えない(書き換えると既存曲の作り方が変わる)。
// ファイル名の「v3」は生成器の作り直しの世代で、Rev. とは別の数え方。
//
// 【なぜ要るか】(2026-09-24)
// 運用ルール ⑩-2 で「生成器は強化してよいが、既存曲の生成結果(ノーツ数)は変えない」と決めている。
// これまでは「古い解析ファイルに無い項目が入口を閉じる」(bassSustains)ように、
// たまたま閉じられる形の強化しか入れられなかった。拾う音の選び方そのものを良くすると、
// 既存曲のノーツ数も少しずつ動いてしまう。
//
// そこで曲ごとに「どのリビジョンの作り方で作るか」を曲の一覧(rhythm-song-registry.json)へ持たせる。
//   ・書いていない曲(= 2026-09-24 までに入った曲)はRev.1。今までと1音も変わらない
//   ・解析器(rhythm-audio-analyze-v3.js)は、**まだ解析していない曲**を登録するときに最新リビジョンを書く
//     (新しく足す曲だけが、自動で新しい作り方になる)
//   ・既存曲を作り直すと決めたときは、その曲へ手で `"chartRevision": <リビジョン>` を書く
//   ・試しに別のリビジョンで作るだけなら、生成器へ `--chart-revision <リビジョン>` を渡す(一覧は書き換えない)
//
// リビジョンの中身(上のリビジョンは下のリビジョンを全部含む)
//   1 … 2026-09-24 までの作り方
//   2 … フレーズの写し。繰り返しの区切りでは、元の小節と同じ位置の音を拾い、
//        同じレーン(区切りの出現ごとに左右反転)へ置く(docs/spec/RHYTHM_CHART_DESIGN.md 3.1.19)
//        ＋ 押さえているHOLDが端に寄っていてクロス(指の交差)が置けないときは、HOLDを内側へ寄せて置く
//   3 … SLIDEの曲線(2026-09-26)。できあがった譜面のSLIDEの区間へ ease(in / out / inout)を付け、
//        向きが変わる点ではゆっくり止まり、同じ向きへ続く点では止まらずに流れる帯にする。
//        付けたあと本体と同じ式で「指が2本入らない重なり」を数え、新しく重なりを作ったSLIDEは直線に戻す。
//        ノーツ数は変わらない(帯の途中の通り道が変わるだけ)
//   4 … 横フリック(2026-09-26・ユーザー指示「横フリックはマスターから譜面にのるようにして」)。
//        **MASTERだけ**、FLICK に向き(flickDir: left / right)を付ける。次のノーツへ向かって払う向き、
//        次が近くに無ければ道の端に近いものだけ外向き。ノーツ数も位置も変わらない(向きが付くだけ)
//   5 … 6レーンの道(2026-09-26・ユーザー判断「全曲6レーンで作り直す」)。道が5レーン(サブレーン10本)から
//        6レーン(12本)になる。置き方の決めごとは同じで、使える幅だけが広がる。
//        できあがった譜面は laneCount:6 を持ち、本体の mhChart の4つ目にも 6 を書く。
//        Rev.4までの譜面は5レーンのまま作られ(1音も変わらない)、本体が道の真ん中へ寄せて使う(rhythmChartOnRoad)
//   6 … 音の性格でノーツの種類を決める(2026-09-26・ユーザー指摘「ただ適当にフリックとかを置くじゃなくて、
//        譜面にあわせてあった配置やノーツの種類があるとおもう」)。フリックは切れる音・歌の語尾・シンバルに、
//        同時押しはシンバル・大きな一発に、音の性格の点が高い順に置く(数は上限としてだけ使う)。
//        横フリックの向きは旋律の上がり下がりに合わせる。物差しは rhythm-sound-traits.js
//   7 … 音ゲーの作法(2026-09-26・ユーザー指示「よその作品の譜面知識や音ゲーとしての一般的知識は生成器にいれとてほしい」
//        「決めつけはしないであくまでも曲に合わせた作りを」)。作法の一覧(rhythm-chart-knowledge.js)が、
//        曲にその音の裏づけがあるときだけ選ばれやすさを少し足す。区切りの一発も強さの順に選ぶ
//   8 … 手の動きと繰り返しを揃える(2026-09-26・docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の段1)。
//        ・横フリックの向きを「次のノーツ → 来た向き → もう片方の指から離れる外向き」で決め、もう片方の指へ向かって
//          払う向きは付けない。旋律の上下では決めない(遊んだ感想「向きがバラバラ」。Rev.7 の公開曲で自然なのは25〜71%)。
//          自動修正(step7)がレーンを動かしたあとにも決め直す(rhythm-side-flick.js)
//        ・フレーズの写しで、元の小節の FLICK・同時押し・区切りの一発も揃える
//        ・6レーンの中央を 2 ではなく (LANES-1)/2 で数える(Rev.5〜7 は左へ半レーン偏っていた)
//        ・手のモデルが SLIDE の位置をゲーム本体と同じ座標(レーンの値＋0.5が中心)で測る
//   9 … 主役の追跡(2026-09-26・ROADMAP の段3・rhythm-chart-focus.js)。音の層の解析(<曲>-v3-layers.json)から小節ごとに
//        「ドラム / 歌・主旋律 / 混ざり」のどれを追うかを決め、追っている層に合う打点を拾う優先度で後押しする
//        (難易度によらず同じ後押し)。Rev.7 の作法 layer_follow は止める(同じことの簡易版なので二重に効く)
//   10 … 動きの使い回しを避ける(2026-09-26・ROADMAP の段4)。置いた結果のレーンの動きの並びが、直前8小節の
//        リズムの違う所と同じになる置き方に費用を足し、それしか置けない形なら次の候補の形も試す(写し・形の記憶は除く)
//   11 … 繰り返すたびの発展とラスサビ・主役に合わせた種類(2026-09-26・ROADMAP の段4)。3回目ごとの繰り返しとラスサビ
//        (最後の盛り上がりの区切りで、前に同じ名札の区切りがあるもの)も元の形を写し、その小節では締めの FLICK と拍の頭の同時押しを
//        選ばれやすくする(HARD以上)。ドラムを追う小節は同時押し、歌・主旋律を追う小節は FLICK、ドラムのフィルの締めは FLICK を
//        選ばれやすくする。どれも音の性格の点が0より大きい(裏づけのある)音にだけ効く
//   12 … 悪い区間だけ別の候補に替える(2026-09-26・ROADMAP の段5・rhythm-chart-v3-splice.js)。パイプラインが生成の直後に候補を数本作り、
//        曲の区切りごとに気になり点の少ない候補を継ぎ合わせる(同じ名札の区切りは同じ候補)。関門(押せない配置が無い・品質の6軸の合計が
//        下がらない・気になり点が減る)を通った難易度だけ。生成器そのものは Rev.11 と同じ
//   13 … 旋律の有無(2026-09-26・最初にもらった案の1)。旋律の音高がほとんど取れない小節(伴奏だけの間奏など)では、
//        主役の追跡で歌・主旋律を追いにくくする(解析ファイルの pitchCurve で、小節の中で音高が取れている割合が2割未満)
//   14 … 手と種類の仕上げ(2026-09-26)。終点フリックを音で選ぶ(語尾・切れる音)・HOLD の太さの形を伴奏の強さの変化で決める・
//        手のモデルが SLIDE の曲線どおりに動き親指の左右を区別する(自動修正が曲線の途中の近さも見る)・候補(--variant)が HARD でも分かれる
//   15〜 … 作法の重みを遊んだ感想(譜面メモ)から学び直したリビジョン。rhythm-chart-learn.js --write が
//        tools/mode/authoring/chart-knowledge-weights.json へ書き足すと、自動でここが最新リビジョンになる。
//        学び直しは「作り方の最新(CHART_REVISION_CODE_LATEST)と重みの最新の大きいほう＋1」を次の番号にする
//        (同じ番号が「作り方の改良」と「重みの学び直し」の2つの意味を持たないように)
'use strict';

const CHART_ENGINE_NAME='MHB CHART ENGINE';
const chartRevisionLabel=revision=>`${CHART_ENGINE_NAME} Rev.${revision}`;
const CHART_REVISION_LEGACY=1;
// 作り方(コード)を改良した最新のリビジョン。改良を足したらここを上げる
const CHART_REVISION_CODE_LATEST=14;
// 最新リビジョンは、作法の重みを書き足したリビジョンまで自動で上がる(学び直すたびに新しいリビジョンになる)
const {latestKnowledgeRevision}=require('./rhythm-chart-knowledge.js');
const CHART_REVISION_LATEST=Math.max(CHART_REVISION_CODE_LATEST,latestKnowledgeRevision());
// リビジョンごとの道のレーン数。Rev.5から6レーン
const CHART_LANE_COUNT_LEGACY=5;
const CHART_SIX_LANE_REVISION=5;
const laneCountForRevision=revision=>Number(revision)>=CHART_SIX_LANE_REVISION?6:CHART_LANE_COUNT_LEGACY;
// 譜面(生成器・自動修正が書き出すJSON)のレーン数。書いていなければ5レーン時代のもの
const laneCountOfChart=chart=>{
  const value=Number(chart&&chart.laneCount);
  return value===5||value===6?value:CHART_LANE_COUNT_LEGACY;
};

// 曲の一覧の1件からリビジョンを読む。無い・壊れている・範囲外ならRev.1(今までの作り方)。
const chartRevisionOf=entry=>{
  const value=Number(entry&&entry.chartRevision);
  if(!Number.isInteger(value)||value<CHART_REVISION_LEGACY||value>CHART_REVISION_LATEST)return CHART_REVISION_LEGACY;
  return value;
};

// 解析器が曲の一覧へ書くときに付けるリビジョン。
//   ・すでにリビジョンが書いてある … そのまま(人が決めたリビジョンを解析のやり直しで消さない)
//   ・一度でも解析した曲(audioSha256 がある) … 付けない(= Rev.1。既存曲を黙って新しい作り方にしない)
//   ・まだ解析していない曲(音源のパスだけ手で足した直後など) … 最新リビジョン
const chartRevisionForRegistry=previousEntry=>{
  if(previousEntry&&previousEntry.chartRevision!=null)return {chartRevision:previousEntry.chartRevision};
  if(previousEntry&&typeof previousEntry.audioSha256==='string'&&previousEntry.audioSha256)return {};
  return {chartRevision:CHART_REVISION_LATEST};
};

// 譜面のリビジョンごとの、手のモデルの読み方(rhythm-hand-model.js の setHandModelFlags へ渡す)。
//   Rev.8〜 SLIDE の位置をゲーム本体と同じ座標で読む / Rev.14〜 SLIDE の曲線どおりに動かす・親指の左右を区別する
const handModelFlagsForRevision=revision=>({runtimeSlideLanes:revision>=8,slideEase:revision>=14,handSides:revision>=14});
module.exports={handModelFlagsForRevision,CHART_ENGINE_NAME,chartRevisionLabel,CHART_REVISION_LEGACY,CHART_REVISION_CODE_LATEST,CHART_REVISION_LATEST,chartRevisionOf,chartRevisionForRegistry,
  CHART_LANE_COUNT_LEGACY,CHART_SIX_LANE_REVISION,laneCountForRevision,laneCountOfChart};
