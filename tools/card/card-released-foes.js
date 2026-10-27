// MFバトルカードの検査で「公開の印が立っている助手」だけを回すための部品(2026-10-27・カード部ナガメくん)。
//   助手の公開の印は data/assistants.js の ASSISTANT_RELEASE_FLAGS(助手id → 印の名前)と、
//   17-release-changelog-login-missions.jsx の RELEASE_FLAGS(印の名前 → 真偽)にある。node の検査では両方を読み込まないので、ここで本物のファイルから読む。
//   印の無い助手は公開済み。印が `true` と書かれているときだけ公開(画面の assistantReleased と同じ決まり)。
//   打ち方・デッキの表に仮の値で足した助手(ソラシドなど)を、印が立つまで強さの検査に入れないために使う
//
//   const { cardFoeOpenInRepo } = require('./card-released-foes');
//   Object.keys(E.CARD_AI_HABITS).filter(cardFoeOpenInRepo)
const fs = require('fs'), path = require('path');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
let cache = null;
const load = () => {
  if (cache) return cache;
  const as = fs.readFileSync(path.join(GAME, 'data', 'assistants.js'), 'utf8');
  const m = as.match(/const ASSISTANT_RELEASE_FLAGS = Object\.freeze\(\{([^}]*)\}\)/);
  if (!m) throw new Error('data/assistants.js に ASSISTANT_RELEASE_FLAGS が見つからない');
  const flags = {};
  for (const [, id, name] of m[1].matchAll(/(\w+)\s*:\s*'(\w+)'/g)) flags[id] = name;
  const rel = fs.readFileSync(path.join(GAME, 'src', 'parts', '17-release-changelog-login-missions.jsx'), 'utf8');
  const on = {};
  for (const name of Object.values(flags)) {
    const v = rel.match(new RegExp(`^\\s*${name}\\s*:\\s*([^,\\n]+)`, 'm'));
    if (!v) throw new Error(`RELEASE_FLAGS に ${name} が見つからない`);
    on[name] = v[1].trim() === 'true';
  }
  cache = { flags, on };
  return cache;
};
const cardFoeOpenInRepo = (who) => { const { flags, on } = load(); return !flags[who] || on[flags[who]] === true; };
module.exports = { cardFoeOpenInRepo, cardFoeReleaseFlags: () => ({ ...load().flags }) };
