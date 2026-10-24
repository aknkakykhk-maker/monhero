// 助手とジャックの台詞を「全部」、言葉の切れ目で折る部品(jaWrap)で幅を変えて描き、崩れた折れ方が無いかを数える(2026-10-24)。
//
//   node tools/boot/ja-wrap-lines-check.js
//
// ja-wrap-check.js は実際の画面を開いて見るので、乱数で選ばれた台詞しか見られない(出た台詞しだいで落ちたり通ったりした)。
// ここでは台詞を全部並べ、狭い吹き出し(ジャックは場所が無いと 96px まで縮む)から広い吹き出しまで描く。
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
const fnSrc = ui.slice(ui.indexOf('const jaWrapPoints'), ui.indexOf('const jaWrap ='))
  .replace('const jaWrapPoints =', 'jaWrapPoints =').replace('const jaKeepWhole =', 'jaKeepWhole =');
check('部品 jaWrapPoints・jaKeepWhole を取り出せた', /jaWrapPoints =/.test(fnSrc) && /jaKeepWhole =/.test(fnSrc));
const jack = P('src/parts/38-raid-jack-home-lines.jsx');
const asst = P('data/assistants.js');
const texts = [...new Set([
  ...[...jack.matchAll(/'([^'\n]{8,})'/g)].map((m) => m[1]),
  ...[...asst.matchAll(/t:'([^'\n{}]{8,80})'/g)].map((m) => m[1]),
].filter((t) => /[ぁ-ん]/.test(t)))];
check('台詞を集められた', texts.length >= 500, `${texts.length}本`);

(async () => {
  // ほかのブラウザの検査(ja-wrap-check.js)と同じ起動の仕方
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><div id=r></div>');
  const res = await page.evaluate(({ fnSrc, texts }) => {
    let _jaSegmenter, jaWrapPoints, jaKeepWhole; eval(fnSrc);
    const tails = [], mids = [], soft = [];
    const range = document.createRange();
    for (const t of texts) for (let w = 90; w <= 300; w += 12) {
      // 吹き出しと同じ: 言葉の切れ目(印)で折り、行の長さをそろえる(JA_LABEL_STYLE)
      const d = document.createElement('div');
      d.style.cssText = `width:${w}px;font-size:11px;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance;font-family:sans-serif`;
      const pts = jaWrapPoints(t).split('​');
      const allowed = new Set(); let k = 0;
      pts.forEach((seg, i) => {
        if (i) d.appendChild(document.createElement('wbr'));
        const keep = (t) => { const s = document.createElement('span'); s.style.whiteSpace = 'nowrap'; s.textContent = t; d.appendChild(s); };
        // jaWrap と同じ包み方(短いかたまりは丸ごと、長いものは閉じかっこ・？・！とその前後の字だけ)
        if (jaKeepWhole(seg)) keep(seg);
        else if (/[」』？！?!][ぁ-ゖ]/.test(seg)) seg.split(/(.[」』？！?!][ぁ-ゖ]{1,3})/).forEach((t, k) => (k % 2 ? keep(t) : t && d.appendChild(document.createTextNode(t))));
        else d.appendChild(document.createTextNode(seg));
        k += seg.length; allowed.add(k);
      });
      document.getElementById('r').appendChild(d);
      const tops = []; let txt = '';
      const walk = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) for (let i = 0; i < n.textContent.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); tops.push(range.getBoundingClientRect().top); txt += n.textContent[i]; }
      let last = 0;
      for (let i = 1; i < tops.length; i++) {
        if (tops[i] - tops[i - 1] <= 4) continue;
        last = i;
        if (allowed.has(i) || /\s/.test(txt[i - 1])) continue;
        const at = `${w}px「${txt.slice(Math.max(0, i - 6), i)}／${txt.slice(i, i + 4)}」`;
        // 「～」の手前・顔文字の中(かっこの中に記号があるもの)は、ブラウザが印に関係なく折る
        if (/^[～〜]/.test(txt.slice(i)) || /[(（][^()（）]*$/.test(txt.slice(0, i))) soft.push(at); else mids.push(at);
      }
      const rest = txt.slice(last);
      const restLetters = (rest.match(/[ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9ｦ-ﾟ]/g) || []).length;
      const kaoOnly = /^\s*(?:ε-|[٩«ヾ＼])*[(（][^()（）]*[)）]/.test(rest);
      // 書き手が空白を入れた所(「ももぉ！ マジ！？」)で折れたのは、空白で折れるのが自然なので数えない
      if (last > 0 && restLetters <= 2 && !kaoOnly && !/\s/.test(txt[last - 1])) tails.push(`${w}px「${txt.slice(Math.max(0, last - 6), last)}／${rest}」`);
      d.remove();
    }
    return { tails, mids, soft };
  }, { fnSrc, texts });
  await browser.close();
  const show = (a) => a.slice(0, 6).join(' / ');
  if (process.env.SHOW_ALL) console.log([...res.tails, ...res.mids].join('\n'));
  check('最後の行に1〜2字だけ落ちた台詞が無い(幅90〜300px)', res.tails.length === 0, show(res.tails) || `${texts.length}本`);
  check('言葉の途中(印の無い所)で折れた台詞が無い', res.mids.length === 0, show(res.mids));
  // 2026-10-24 の時点で 3件(すべて90pxの顔文字の中)。増えたら部品を見直す
  check('「～」の手前・顔文字の中で折れたのは少ないまま(10件まで)', res.soft.length <= 10, `${res.soft.length}件 ${show(res.soft)}`);
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
