// 改善部の見直し・その2(docs/playbot/reports/2026-10-20/kaizen-2.md)の画面の直しが、戻っていないかを見張る。
//
//   node tools/boot/kaizen2-layout-check.js
//
// 実際の画面で測るのは ja-wrap-check.js(言葉の途中の折り返し)と home-layout-check.js(HOME の吹き出し)。
// ここは、ボットでないと開けない画面(アシストカードの継承・結果・マルチの部屋)の直しを、作りの文字で確かめる。
//   M3 言葉の切れ目で折る: 継承・強化の題名・説明・カードの効果・選んだカードの段の説明、結果の「刻み」の説明。MAX COMBO は1行
//   M5 マルチの部屋: 縦向きは下の欄を枠のすぐ下へ(mt-auto を横向きだけに)・高さの上限 70%・名前は2行まで・制限時間の札を狭い画面で詰める
//   M6 結果: その難易度の満点に対する出来(満点の◯%)を小さく出す。ランクの決め方(rhythmRankForScore)は変えない
//   M7 HOME: 幅360未満で吹き出しの文を2行まで
//   M8 結果: 幅360未満で判定の表と MAX COMBO を詰める・下の帯の上に「▼ ビートP・ライブログ」の印
//   M9 曲えらび: 幅360未満で「並べ替え：」「ジャンル：」を外して値だけ
//   M10 ギフト: 札の地を不透明にして、ハロウィンのかぼちゃが字の上に透けないようにする
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const ui = P('41-screen-ui.jsx');
check('M3 言葉の切れ目で折る部品(jaWrap・JA_WRAP_STYLE)がある。印は文字(U+200B)のまま置かず <wbr> で描く(コピーに混ざらない)', /const jaWrap = \(text\) =>/.test(ui)
  && ui.includes("return s.split('\\u200B').map((seg, i) => <React.Fragment key={i}>{i > 0 && <wbr/>}{seg}</React.Fragment>);") && /Intl\.Segmenter\('ja', \{ granularity: 'word' \}\)/.test(ui)
  && /const JA_WRAP_STYLE = Object\.freeze\(\{ wordBreak: 'keep-all', overflowWrap: 'anywhere'/.test(ui));
// 2026-10-21: 印は禁則より強いので、「！」「、」「…」小さい字の前・「「」の後ろ・空白の前後には入れない(「きたわい／！」と折れた)
{
  let got = '', ok = false;
  try {
    const src = ui.slice(ui.indexOf('let _jaSegmenter;'), ui.indexOf('\n};\n', ui.indexOf('const jaWrapPoints = (text) =>')) + 3);
    const jaWrap = new Function(`${src}\nreturn jaWrapPoints;`)();
    got = jaWrap('楽しくなってきたわい！ ほんとうじゃぞ！「よし」…っ');
    ok = !/\u200B[！、…」っ\s]/.test(got) && !/[「\s]\u200B/.test(got) && got.includes('\u200B');
  } catch (e) { got = String(e); }
  check('jaWrap は行の頭に来てはいけない字の前・「「」の後ろ・空白の前後に印を入れない', ok, got.replace(/\u200B/g, '|'));
}
const pick = P('67-screen-pick.jsx');
check('M3 アシストカードの継承・強化の題名と説明は言葉の切れ目で折る', pick.includes("{jaWrap('アシストカードの継承・強化')}") && pick.includes("{jaWrap('1枚選んで、新しく覚えるか、持っているカードを強化します')}"));
check('M3 カードの効果(3行まで)と、選んだカードの段の説明も言葉の切れ目で折る', pick.includes('...JA_WRAP_STYLE}}>{jaWrap(shownDesc)}') && pick.includes('style={JA_WRAP_STYLE}>{jaWrap(info.desc)}'));
const play = P('30-rhythm-play.jsx');
check('M3 結果の「刻み」の説明は言葉の切れ目で折る', play.includes("{jaWrap('ホールド・スライドの刻みもコンボに数えます')}"));
check('M3 MAX COMBO は1行のまま(狭い画面は字の間を詰める)', /whitespace-nowrap text-\[10px\] font-black tracking-\[\.2em\] max-\[359px\]:tracking-\[\.06em\][^>]*>MAX COMBO</.test(play));

const home = P('69-screen-home.jsx');
check('HOME: ジャックの吹き出しは、狭い画面で横へ置いて札の下へ逃がせる(104・96の幅と、横で下げる候補がある)・セリフは言葉の切れ目で折る',
  home.includes('HOME_RAID_SAY_WIDTHS = Object.freeze([184, 168, 152, 136, 120, 104, 96])') && home.includes('for (let y = from + 6; y <= to; y += 6) tries.push({ side, left, top: y')
  && home.includes('<span data-home-raid-say-text style={{ display:\'block\', ...JA_LABEL_STYLE }}>{jaWrap(speech)}</span>'));

// N5(2026-10-21 改善部の見直し・その3): 大きな所持数は9桁(1億)から縮めて出す。保存値は変えない・押すと細かい数
{
  let got = '', ok = false;
  try {
    const src = ui.slice(ui.indexOf('const compactCount = '), ui.indexOf('\n};\n', ui.indexOf('const compactCount = ')) + 3);
    const f = new Function(`${src}\nreturn compactCount;`)();
    const cases = [[99999999, '99,999,999'], [100000000, '1億'], [123456790, '1.23億'], [6736760000, '67.3億'], [999999999999, '9,999億'], [1234567890123, '1.23兆']];
    got = cases.map(([n, want]) => `${f(n)}${f(n) === want ? '' : `(期待${want})`}`).join(' ');
    ok = cases.every(([n, want]) => f(n) === want);
  } catch (e) { got = String(e); }
  check('N5 大きな所持数の縮め方(8桁まではそのまま・端は切り捨て)', ok, got);
}
check('N5 HOME の財布・プロフィールの所持数・マーケットの入口の札は縮めた数で出す(押すと細かい数)',
  home.includes("<CompactCount value={gold} style=") && home.includes("<CompactCount value={breederPoints} style=")
  && P('56-screen-profile.jsx').includes('<CompactCount value={gold} className=') && P('55-screen-breeder-market.jsx').includes('value:compactCount(gold),'));

const multi = P('77-screen-rhythm-multi.jsx');
check('M5 マルチの部屋: 縦向きは下の欄を枠のすぐ下へ(mt-auto は横向きだけ)・高さの上限 70%',
  multi.includes('<div className="max-h-[70%] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-950/90 p-2 landscape:mt-auto landscape:grid landscape:max-h-[58%]'));
check('M5 マルチの部屋: 大きい札の名前は2行まで', multi.includes("${tall ? 'line-clamp-2 break-all text-[11px] landscape:text-sm' : 'truncate text-[10px]'}"));
check('M5 選曲の制限時間の札は狭い画面で詰める(「なし」が次の行へ落ちない)', multi.includes('max-[359px]:min-w-[44px] max-[359px]:px-1.5'));

check('M6 結果に、その難易度の満点に対する出来(満点の◯%)を出す', /data-rhythm-result-achievement[^>]*>満点の\{Math\.min\(100,Math\.floor\(view\.score\/Number\(difficulty\.maxScore\)\*100\)\)\}%/.test(play));
check('M6 ランクの決め方は変えない(rhythmRankForScore のまま)', play.includes('rank=rhythmRankForScore(view.score)'));

const html = fs.readFileSync(path.join(ROOT, 'monster-hero/index.html'), 'utf8');
// 2026-10-21: #3222 のマージで index.html のこの3行が消えていた(生成物と同じく main 側を採ったため)。消えたら止める
check('文の最後の1〜2字だけ落とさない CSS(画面全体 pretty・助手の吹き出し balance・演奏中は外す)が index.html にある',
  html.includes('.mh-app { text-wrap: pretty; }') && html.includes('.mh-app [data-bubble-text] { text-wrap: balance; }') && html.includes('[data-rhythm-play-area], [data-rhythm-play-area] * { text-wrap: wrap; }'));
const assistant = P('21-assistant.jsx');
check('M7 HOME: 幅360未満で吹き出しの文を2行まで', assistant.includes('<span data-bubble-text ') && html.includes('@media (max-width: 359px) { .mh-home-assistant [data-bubble-text] { display: -webkit-box; -webkit-line-clamp: 2;'));

check('M8 結果: 幅360未満で判定の表と MAX COMBO を詰める', play.includes('max-[359px]:gap-y-0 max-[359px]:py-1.5 max-[359px]:text-[13px]') && play.includes('max-[359px]:text-[28px]'));
check('M8 結果: 下の帯の上に、続きがあるあいだだけ「▼ ビートP・ライブログ」の印', /const RhythmResultMoreHint=\(\{label\}\)=>/.test(play) && play.includes('<RhythmResultMoreHint label=')
  && /box\.scrollHeight-box\.scrollTop-box\.clientHeight>24/.test(play));

const rhythmScreens = P('29-rhythm-screens.jsx');
check('M9 曲えらび: 幅360未満で「並べ替え：」「ジャンル：」を外して値だけ', (rhythmScreens.match(/font-black max-\[359px\]:hidden landscape:text-\[9px\] landscape:text-slate-400">(並べ替え|ジャンル)/g) || []).length === 2);

const gift = P('53-screen-gift-box.jsx');
check('M10 ギフト: 札の地は不透明(かぼちゃが字の上に透けない)', gift.includes("bg-[#111329] border-white/10") && gift.includes("bg-[#250a1e] border-red-500/60") && gift.includes("bg-[#131630] border-cyan-400/60")
  && !/mh-gift-card rounded-2xl border \$\{g\.claimedAt\?'bg-slate-900\/70/.test(gift));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
