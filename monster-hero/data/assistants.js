// ==================== 助手(ナビゲーター) ====================
// 助手は「いまこの画面で何ができるか」を短いセリフで教えてくれるキャラクター。
// 吹き出しをタップすると詳しい説明が開く。
//
// 【設計の方針】
// 名前・画像・セリフをすべてこのファイルのデータにまとめ、画面側は
// <AssistantBubble .../> を1つ置くだけで済むようにしている。
// 助手を増やす・画像を差し替える・セリフを直す、のどれもこのファイルだけで完結する。
//
// 【助手を増やすとき】
//   ASSISTANTS に1件足す。画像は data/images や data/breeder.js の定数をそのまま渡す。
//   専用の立ち絵ができたら image: の値を差し替えるだけでよい(画面側の変更は不要)。
//
// 【ほかの画面へ広げるとき】★今後 HOME・神殿・マーケット・M/B管理・バトル・設定・
//   ランキング・イベント案内・ギフト・ミッション・チュートリアルで使う想定
//   ① ASSISTANT_SCENES に場面を1つ足す
//        home: { short:'ここではHOMEの機能を説明するよ♪', help:'home/roster' }
//   ② その画面のJSXに1行置く
//        <AssistantBubble scene="home"/>
//   これだけで、吹き出し・キャラ画像・タップで開く詳細がすべて同じ見た目で動く。
//   詳細は help(ヘルプの項目をそのまま出す)か detail(自前の文章)のどちらでも書ける。

// 画像が用意できていない助手はこれを使う(絵文字で代用される)
const ASSISTANT_NO_IMAGE = null;

const ASSISTANTS = [
  {
    id: 'mua',
    name: 'みゅあ',
    role: 'ヘルプ担当',
    // いまはブリーダーの顔アイコンを仮に使っている。専用の立ち絵ができたら
    // ここを新しい画像定数に差し替えるだけでよい(index.htmlでbreeder.jsの後に読む)
    image: (typeof MUA_FACE_ICON !== 'undefined' && MUA_FACE_ICON) || ASSISTANT_NO_IMAGE,
    emoji: '💖',        // 画像が無いときの代わり
    accent: '#f472b6',  // 吹き出しの縁・名前・ボタンの色
    greeting: 'なにか困ってる？ みゅあが説明するよ♪',
  },
];
const DEFAULT_ASSISTANT_ID = 'mua';

// 場面(scene) → 助手のセリフ。画面側は <AssistantBubble scene="キー"/> で呼ぶ。
//   assistantId … だれが話すか(省略すると DEFAULT_ASSISTANT_ID)
//   short       … 吹き出しに出す短いひとこと
//   detail      … タップで開く詳しい説明(文字列の配列)
//   help        … 'カテゴリid/項目id'。detail の代わりに、ヘルプ本文をそのまま詳細として開く
const ASSISTANT_SCENES = {
  // ヘルプのカテゴリ一覧で話す内容
  helpTop: {
    short: 'ようこそ！知りたいことのカテゴリを選んでね。',
    detail: [
      'このヘルプは「カテゴリ → 項目 → 説明」の3段階になっているよ。',
      'まずは下のカテゴリから、気になるものをタップしてね。次に項目を選ぶと、詳しい説明が出るよ。',
      'わたしの吹き出しは、開いているページごとに内容が変わるんだ。タップすると、そのページの詳しい説明をここに出せるよ♪',
      '右上のわたしのボタンで、吹き出しを閉じたり出したりできるよ。',
    ],
  },
};

const findAssistant = (id) => ASSISTANTS.find(a => a.id === id)
  || ASSISTANTS.find(a => a.id === DEFAULT_ASSISTANT_ID)
  || ASSISTANTS[0]
  || null;
const findAssistantScene = (key) => (key && ASSISTANT_SCENES[key]) || null;
