const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトル画面で「どれが勇者モンか」「勇者特性が今効いているか」が分かるかを確認する。
//
// マスモンには自由に名前を付けられるため、名前と見た目だけでは種類を判別できない。
// そのせいで「ハムを勇者モンにしたのに同時使用枚数が増えない」という取り違えが起きた
// (実際は別の種が勇者モンだった)。同じ勘違いが起きないよう、次を機械的に見る。
//   ① 勇者モンの判定が1か所にまとまっている
//   ② バトル画面のモンスター枠に王冠の目印が出る
//   ③ 勇者特性で増えた同時使用枚数が、計算と表示で同じ出どころを使っている
//   ④ ヘルプにも王冠と「👑+1」の説明がある
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiledRaw = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const compiled = compiledRaw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- ① 勇者モンの判定 ---
check('勇者モンの判定を1か所にまとめている',
  has('const isHeroSlotMon = (mon) => !!(mon && mainHero && mon.id === mainHero.id);'));
check('名前ではなく種idで見分けている',
  !has('mon.name === mainHero.name') && !has('mon.masuName === mainHero.masuName'));

// --- ② バトル画面の目印 ---
check('モンスター枠に王冠を出す',
  has('{isHeroSlotMon(s)&&<Crown size={8} className="shrink-0 mr-0.5 text-amber-300"/>}'));
check('勇者モンの名前欄だけ色を変える',
  has("${isHeroSlotMon(s)?'bg-amber-500/25 border-amber-300/50':'bg-black/60 border-white/10'}")
    && has("${isHeroSlotMon(s)?'text-amber-100':'text-white'}"));
check('配信用JSにも王冠が入っている', compiled.includes('isHeroSlotMon'),
  compiled.includes('isHeroSlotMon') ? '' : 'ビルドし直してください');

// --- ③ 同時使用枚数の加算 ---
check('勇者特性の加算を1か所で決めている',
  has("const heroCardBonus = useMemo(() => heroCardBonusOf(mainHero?.id), [mainHero]);"));
// 対象の種は一覧で持つ。同じ効果(ハムの「連続攻撃」・剣士モッチーの「二刀流」)を
// 種ごとの分岐でコピーすると、増えるたびに手動とAUTOで食い違う元になる
check('加算する種を一覧で持っている(種ごとの分岐にしていない)',
  has("const HERO_CARD_BONUS_MONSTER_IDS = Object.freeze(['Ham', 'KenshiMocchi']);")
  && has("const heroCardBonusOf = (heroId) => (HERO_CARD_BONUS_MONSTER_IDS.includes(heroId) ? 1 : 0);"));
check('枚数の計算がその値を使う',
  // きき加入後は、ききの枚数ボーナスも同じ場所で足す
  has('limit += heroCardBonus + kikiCardBonus;') && has('}, [effectiveMaxGuts, slots, heroCardBonus, kikiCardBonus]);'));
check('計算と別に条件を書き足していない',
  !has("if (mainHero?.id === 'Ham') limit += 1;") && !has("if (mainHero?.id === 'KenshiMocchi') limit += 1;"));
check('増えていることを画面にも出す',
  // バッジは横並びの中で潰れないよう shrink-0 が付いた
  has('{heroCardBonus>0&&<span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-300/40 text-amber-200 whitespace-nowrap"><Crown size={8}/>+{heroCardBonus}</span>}'));

// --- ④ ヘルプ ---
check('ヘルプに王冠の説明がある',
  helpSrc.includes('どれが勇者モンかを見分ける') && helpSrc.includes('王冠のマークが付きます'));
check('ヘルプに「👑+1」の説明がある',
  helpSrc.includes('増えているかを見分ける') && helpSrc.includes('👑+1'));
check('供モンでは増えないことを書いている',
  helpSrc.includes('供モンとして合流しているだけでは増えません'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
