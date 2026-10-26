// 助手とジャックの台詞を「全部」、言葉の切れ目で折る部品(jaWrap)で幅を変えて描き、崩れた折れ方が無いかを数える(2026-10-24)。
//
//   node tools/boot/ja-wrap-lines-check.js
//
// ja-wrap-check.js は実際の画面を開いて見るので、乱数で選ばれた台詞しか見られない(出た台詞しだいで落ちたり通ったりした)。
// ここでは台詞を全部並べ、狭い吹き出しから広い吹き出しまで描く。吹き出しはいちばん狭くて 144px(本文は左右の余白と枠を引いて約120px。狭い画面は字10pxで136px。
// 2026-10-24 窓口・カゲあつくん「言葉の途中で折れないように」で 96px から広げた。120px だと「いってらっしゃい〜」の9字が1行に入らなかった)なので、本文の幅120px から数える。
//   ・最後の行に1〜2字だけ落ちた(「であるぞ／！」「いってらっしゃ／い〜」)。顔文字だけの行は数えない
//   ・言葉の途中で折れた(印 <wbr> の無い所で折れた)。「～」の手前と顔文字の中はブラウザが折るので、別に数えて上限だけ見る
// 部品の中身(jaWrapPoints・jaKeepWhole)は 41-screen-ui.jsx からそのまま取り出して使う
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero', f), 'utf8');
let failed = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const ui = P('src/parts/41-screen-ui.jsx');
const fnSrc = ui.slice(ui.indexOf('const JA_WRAP_LINE'), ui.indexOf('const jaWrap ='))
  .replace('const JA_WRAP_TIGHT =', 'JA_WRAP_TIGHT =').replace('const jaWrapPieces =', 'jaWrapPieces =')
  .replace('const JA_PARTICLE_END =', 'JA_PARTICLE_END =')
  .replace('const JA_WRAP_LINE =', 'JA_WRAP_LINE =')
  .replace('const jaWrapPoints =', 'jaWrapPoints =').replace('const jaKeepWhole =', 'jaKeepWhole =');
check('部品 jaWrapPoints・jaKeepWhole・jaWrapPieces を取り出せた', /jaWrapPoints =/.test(fnSrc) && /jaKeepWhole =/.test(fnSrc) && /jaWrapPieces =/.test(fnSrc));
const jack = P('src/parts/38-raid-jack-home-lines.jsx');
const asst = P('data/assistants.js');
// 助手の台詞は200字まで集める。HOME の吹き出しは台詞を切らずに全部出すようになったので、長い台詞(「…着替えて遊んでね♪」)も見る(2026-10-24)
const texts = [...new Set([
  ...[...jack.matchAll(/'([^'\n]{8,})'/g)].map((m) => m[1]),
  ...[...asst.matchAll(/t:'([^'\n{}]{8,200})'/g)].map((m) => m[1]),
].filter((t) => /[ぁ-ん]/.test(t)))];
check('台詞を集められた', texts.length >= 500, `${texts.length}本`);
// お話(HOME で流れるお話・回想・助手の加入など)の台詞。お話の画面は字が大きく(13px・客の吹き出しは14px)幅も広いので、別の幅でも描く。
// お話は端末の状態(ほかのお話を見たか)で出たり出なかったりするので、画面を開く ja-wrap-check.js では毎回は見られない(2026-10-24 窓口)
const storyTexts = [...new Set([...asst.matchAll(/who:'[^']+',\s*e:'[^']*',\s*t:'([^'\n{}]{8,200})'/g)].map((m) => m[1]))];
check('お話の台詞を集められた', storyTexts.length >= 300, `${storyTexts.length}本`);

(async () => {
  // ほかのブラウザの検査(ja-wrap-check.js)と同じ起動の仕方
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><div id=r></div>');
  const res = await page.evaluate(({ fnSrc, texts, storyTexts }) => {
    let _jaSegmenter, jaWrapPoints, jaKeepWhole, JA_PARTICLE_END, JA_WRAP_TIGHT, jaWrapPieces, JA_WRAP_LINE; eval(fnSrc);
    const tails = [], mids = [], soft = [], overflow = [];
    const range = document.createRange();
    // 本文の幅と字の大きさ。ふつうは字11px で120px(吹き出し144px)から、狭い画面(幅360未満)は字10px で112px(吹き出し136px)
    const sizes = [[96, 9], [112, 10], ...Array.from({ length: 16 }, (_, i) => [120 + i * 12, 11])];
    // お話の下の枠(13px)は本文が約250〜370px、客の吹き出し(14px)は約200〜310px
    const storySizes = [[200, 14], [248, 14], [296, 14], [252, 13], [284, 13], [316, 13], [348, 13], [372, 13]];
    const jobs = [...texts.flatMap((t) => sizes.map((z) => [t, ...z])), ...storyTexts.flatMap((t) => storySizes.map((z) => [t, ...z]))];
    for (const [t, w, fs] of jobs) {
      // 吹き出しと同じ: 言葉の切れ目(印)で折り、行の長さをそろえる(JA_LABEL_STYLE)
      const d = document.createElement('div');
      d.style.cssText = `width:${w}px;font-size:${fs}px;font-weight:900;line-height:1.45;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance;font-family:sans-serif`;
      const pts = jaWrapPoints(t).split('​');
      const allowed = new Set(); let k = 0;
      pts.forEach((seg, i) => {
        if (i && !/^\s/.test(seg)) d.appendChild(document.createElement('wbr')); // jaWrap と同じ(空白で始まるかたまりの手前には置かない)
        // jaWrap と同じ包み方(jaWrapPieces)
        for (const [t, kp] of jaWrapPieces(seg)) {
          if (kp) { const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.textContent = t; d.appendChild(sp); } else d.appendChild(document.createTextNode(t));
        }
        k += seg.length; allowed.add(k);
      });
      document.getElementById('r').appendChild(d);
      // 本文が吹き出しの幅からはみ出していないか(折らない枠が長すぎると、字が枠の外へ出る)
      if (d.scrollWidth > d.clientWidth + 1) overflow.push(`${w}px「${t.slice(0, 16)}」`);
      const tops = []; let txt = '';
      const walk = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) for (let i = 0; i < n.textContent.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); tops.push(range.getBoundingClientRect().top); txt += n.textContent[i]; }
      let last = 0;
      for (let i = 1; i < tops.length; i++) {
        if (tops[i] - tops[i - 1] <= 4) continue;
        last = i;
        // 空白の前後と閉じかっこのあと(「「ドラシル」／だってさ」)は、日本語として折ってよい所
        if (allowed.has(i) || /\s/.test(txt[i - 1]) || /\s/.test(txt[i] || '') || /[」』]/.test(txt[i - 1])) continue;
        const at = `${w}px「${txt.slice(Math.max(0, i - 6), i)}／${txt.slice(i, i + 4)}」`;
        // 「～」の手前・顔文字の中(かっこの中に記号があるもの)は、ブラウザが印に関係なく折る
        if (/^[～〜]/.test(txt.slice(i)) || /[(（][^()（）]*$/.test(txt.slice(0, i))) soft.push(at); else mids.push(at);
      }
      const rest = txt.slice(last);
      const restLetters = (rest.match(/[ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9ｦ-ﾟ]/g) || []).length;
      // 最後の行が顔文字だけ・記号と顔文字だけ(「♪♪ ٩(´ᵕ`)۶」)なら語尾ではないので数えない
      const kaoOnly = /^\s*[♪♫☆★✨♡]*\s*(?:ε-|[٩«ヾ＼ｦ-ﾟ])*[(（][^()（）]*[)）]/.test(rest);
      // 書き手が空白を入れた所(「ももぉ！ マジ！？」)で折れたのは、空白で折れるのが自然なので数えない
      // 漢字で始まる最後の行(「押す。」)は語尾ではなく言葉なので数えない
      if (last > 0 && restLetters <= 2 && !kaoOnly && !/\s/.test(txt[last - 1]) && !/^[一-龯]/.test(rest)) tails.push(`${w}px「${txt.slice(Math.max(0, last - 6), last)}／${rest}」`);
      d.remove();
    }
    return { tails, mids, soft, overflow };
  }, { fnSrc, texts, storyTexts });
  await browser.close();
  const show = (a) => a.slice(0, 6).join(' / ');
  if (process.env.SHOW_ALL) console.log([...res.tails, ...res.mids].join('\n'));
  check('最後の行に1〜2字だけ落ちた台詞が無い(字11pxで本文120〜300px・字10pxで112px・字9pxで96px・お話は13〜14pxで200〜372px)', res.tails.length === 0, show(res.tails) || `${texts.length}本`);
  check('言葉の途中(印の無い所)で折れた台詞が無い', res.mids.length === 0, show(res.mids));
  check('本文が吹き出しの幅からはみ出さない', res.overflow.length === 0, show(res.overflow));
  // 2026-10-24 の時点で 3件(すべて90pxの顔文字の中)。増えたら部品を見直す
  check('「～」の手前・顔文字の中で折れたのは少ないまま(10件まで)', res.soft.length <= 10, `${res.soft.length}件 ${show(res.soft)}`);
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
