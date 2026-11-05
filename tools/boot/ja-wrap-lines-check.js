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
// 1〜2字だけの行の上限(2026-11-06。直す前は言葉のかけら31件・文節75件。かけらは22件まで減った。文節は123件に増えた)。増えたら 41-screen-ui.jsx の jaKeepKanaRuns を見直す
const JA_SHORT_FRAGMENT_LIMIT = 22;
const JA_SHORT_PHRASE_LIMIT = 123;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

// 2026-11-06 社長「改行で言葉が割れる。言っても言っても直らない、仕組みにして」(えるびん「すっかりは／まってるんだよね笑」)。
//   語の一覧に頼らず、「ひらがなの続き(ひらがな・小さい字・長音)が1行(10字)に入るのに、その途中で折れた行」と「1〜2字だけの行」(最後の行に限らない)を数える。
//   台詞はカードバトル(83-card-battle-lines・83-card-battle-vs・86-card-tutorial)も足し、カードの吹き出しの幅(iPhone SE〜Pro Max)でも描く。
//   node tools/boot/ja-wrap-lines-check.js --compare origin/main   # その版の部品でも数えて、直す前と後を並べる
const { execSync } = require('child_process');
const argv = process.argv.slice(2);
const compareRef = argv.includes('--compare') ? argv[argv.indexOf('--compare') + 1] : null;
const cut = (ui) => ui.slice(ui.indexOf('const JA_WRAP_LINE'), ui.indexOf('const jaWrap ='))
  .replace('const JA_WRAP_TIGHT =', 'JA_WRAP_TIGHT =').replace('const jaWrapPieces =', 'jaWrapPieces =')
  .replace('const JA_PARTICLE_END =', 'JA_PARTICLE_END =')
  .replace('const JA_WRAP_LINE =', 'JA_WRAP_LINE =')
  .replace('const jaWrapPoints =', 'jaWrapPoints =').replace('const jaKeepWhole =', 'jaKeepWhole =');
const ui = P('src/parts/41-screen-ui.jsx');
const fnSrc = cut(ui);
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
// MFバトルカードの台詞(相手の助手のひとこと・対戦の前後・遊び方の説明)。《》は名前の飾りなので外す
const cardTexts = [...new Set(['src/parts/83-card-battle-lines.jsx', 'src/parts/83-card-battle-vs.jsx', 'src/parts/86-card-tutorial.jsx']
  .flatMap((f) => [...P(f).matchAll(/'([^'\n{}]{8,200})'/g)].map((m) => m[1].replace(/[《》]/g, '')))
  .filter((t) => /[ぁ-ん]/.test(t) && !/^[\w.\-/ ]+$/.test(t)))];
check('カードバトルの台詞を集められた', cardTexts.length >= 200, `${cardTexts.length}本`);

(async () => {
  // ほかのブラウザの検査(ja-wrap-check.js)と同じ起動の仕方
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><div id=r></div>');
  const run = (fnSrc) => page.evaluate(({ fnSrc, texts, storyTexts, cardTexts }) => {
    let _jaSegmenter, jaWrapPoints, jaKeepWhole, JA_PARTICLE_END, JA_WRAP_TIGHT, jaWrapPieces, JA_WRAP_LINE; eval(fnSrc);
    const tails = [], mids = [], soft = [], overflow = [], kanaMids = [], shortLines = [];
    const range = document.createRange();
    // 本文の幅と字の大きさ。ふつうは字11px で120px(吹き出し144px)から、狭い画面(幅360未満)は字10px で112px(吹き出し136px)
    const sizes = [[96, 9], [112, 10], ...Array.from({ length: 16 }, (_, i) => [120 + i * 12, 11])];
    // お話の下の枠(13px)は本文が約250〜370px、客の吹き出し(14px)は約200〜310px
    const storySizes = [[200, 14], [248, 14], [296, 14], [252, 13], [284, 13], [316, 13], [348, 13], [372, 13]];
    // カードバトルの吹き出し: 対戦の前(フリー対戦・字13px)は本文が約160〜280px、対戦中・TOP(字12〜13px)は約200〜380px(iPhone SE 375 〜 Pro Max 430)
    const cardSizes = [[160, 13], [200, 13], [240, 13], [280, 13], [200, 12], [250, 12], [300, 12], [340, 13], [380, 13]];
    const jobs = [...texts.flatMap((t) => sizes.map((z) => [t, ...z])), ...storyTexts.flatMap((t) => storySizes.map((z) => [t, ...z])),
      ...cardTexts.flatMap((t) => cardSizes.map((z) => [t, ...z]))];
    // ひらがなの続き(ひらがな・小さい字・長音)。続きが1行(JA_WRAP_LINE)に入るのに、その途中で折れたら数える
    const KANA = /[ぁ-ゖゝゞー]/;
    // 長音「ー」はひらがなのあと(すごーい)だけ続きに入れる(「ブリーダー」の「ー」は入れない)
    const isKana = (txt, i) => /[ぁ-ゖゝゞ]/.test(txt[i] || '') || (txt[i] === 'ー' && i > 0 && isKana(txt, i - 1));
    const runLen = (txt, i) => {
      let a = i, b = i; while (a > 0 && isKana(txt, a - 1)) a--; while (b < txt.length && isKana(txt, b)) b++;
      // 続きの手前の漢字・カタカナ(「控え|めにしてくれるから」の「控え」)は送り仮名で続きとつながっていて、そこでは折れないので合わせて数える
      //   (漢字のあいだの送り仮名1字「押し切る」の「し」も、くっついた言葉なので越えて数える)
      while (a > 0 && (/[一-龯々ァ-ヶ]/.test(txt[a - 1]) || (/[ぁ-ゖ]/.test(txt[a - 1]) && /[一-龯々]/.test(txt[a - 2] || '') && /[一-龯々]/.test(txt[a] || '')))) a--;
      // 漢字の頭の「お・ご」(お願い・ご褒美)も、そこでは折れないので合わせて数える
      if (a > 0 && /[おご]/.test(txt[a - 1]) && /[一-龯]/.test(txt[a] || '')) a--;
      while (a > 0 && /[「『（(]/.test(txt[a - 1])) a--; while (b < txt.length && /[、。！？!?…‥」』）)〜～♪♡✨・笑ｗwW\uFE0F\uD800-\uDFFF]/.test(txt[b])) b++;
      // 文の終わりに1〜2字だけ残る語尾(「……かわいいだな。うん」の「うん」)は、部品が手前とつなぐので合わせて数える
      if ((txt.slice(b).match(/[ぁ-ゖァ-ヶ一-龯A-Za-z0-9]/g) || []).length <= 2) b = txt.length;
      return b - a;
    };
    // 文の組み立てで切れ目になる所(語の一覧ではなく、文法の形): 「て・で」のあと(して／くれる)・「から・けど」などのあと(だから／いい)・
    //   「お・ご」の手前(よろしく／お願い)・1字の助詞の手前。部品(41-screen-ui.jsx の jaKeepKanaRuns)が長いかたまりを分けるのに使うのと同じ
    const gramBreak = (txt, i) => {
      const b = txt.slice(0, i), n = txt[i];
      return (/て$/.test(b) && /^[^るたはぁぃぅぇぉっゃゅょー]/.test(n) && !/^も(?:[いうよ、。！？!?…]|$)/.test(txt.slice(i, i + 2)))
        // 1字の助詞の手前(すっかり／はまって・取り返し／がつかない)。言葉は割れない(割れるのは助詞のあと「すっかりは／まって」)
        // 英字・数字・カタカナ・閉じかっこのすぐあとの1字の助詞のあと(SLIDEは／なぞる・ノーツに／なって・「HELL」に／まとめて)。部品の sureParticle と同じ
        || (/[A-Za-z0-9０-９ァ-ヶー」』）)][はがをにもへとでの]$/.test(b))
        //   漢字のあとも、「は」(昨日は／まって)のほかは助詞だと言い切れる(未受取が／ある・試合を／やり直す)
        || (/[一-龯々][がをにもへとでの]$/.test(b))
        || (/^[はがをにもへのとや]/.test(n) && /[ぁ-ゖー]{2}$/.test(b) && !/[はがをにもへ]$/.test(b)) || (/で$/.test(b) && /^[^すしきもはるぁぃぅぇぉっゃゅょー]/.test(n))
        || /(?:から|まで|けど|ので|のに|ても|でも|には|では|とは|って|たら|れば|ながら|けれど|より|だけ|ほど|など)$/.test(b)
        || (/^[おご]/.test(n) && /[ぁ-ゖ一-龯]/.test(txt[i + 1] || ''));
    };
    const LETTER = /[ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9ｦ-ﾟ]/g;
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
        // 1〜2字だけの行(最後の行は下の tails で数える)。顔文字だけ・空白で区切った所は数えない
        if (last > 0) {
          const line = txt.slice(last, i);
          if ((line.match(LETTER) || []).length <= 2 && !/[(（]/.test(line) && !/\s/.test(txt[last - 1]) && !/\s$/.test(line)) shortLines.push(`${w}px「${txt.slice(Math.max(0, last - 4), last)}／${line}／${txt.slice(i, i + 3)}」`);
        }
        // 「1行に入る」は、続きと、その前後の離せない記号(あとの「、。！？……」・前の「「」)を合わせて、その幅の1行の字数に入ること
        if (isKana(txt, i - 1) && isKana(txt, i) && !gramBreak(txt, i) && runLen(txt, i) <= Math.min(JA_WRAP_LINE, Math.floor(w / fs))) kanaMids.push(`${w}px「${txt.slice(Math.max(0, i - 6), i)}／${txt.slice(i, i + 5)}」`);
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
    return { tails, mids, soft, overflow, kanaMids, shortLines };
  }, { fnSrc, texts, storyTexts, cardTexts });
  const res = await run(fnSrc);
  if (compareRef) {
    const before = await run(cut(execSync(`git show ${compareRef}:monster-hero/src/parts/41-screen-ui.jsx`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })));
    for (const k of ['kanaMids', 'shortLines', 'tails', 'mids', 'overflow', 'soft']) console.log(`前→後 ${k}: ${before[k].length} → ${res[k].length}`);
    if (process.env.SHOW_BEFORE) console.log(before[process.env.SHOW_BEFORE].map((x) => 'BEFORE ' + x).join('\n'));
  }
  await browser.close();
  const show = (a) => a.slice(0, 6).join(' / ');
  if (process.env.SHOW_ALL) console.log([...res.tails, ...res.mids, ...res.kanaMids, ...res.shortLines].join('\n'));
  check('最後の行に1〜2字だけ落ちた台詞が無い(字11pxで本文120〜300px・字10pxで112px・字9pxで96px・お話は13〜14pxで200〜372px)', res.tails.length === 0, show(res.tails) || `${texts.length}本`);
  check('言葉の途中(印の無い所)で折れた台詞が無い', res.mids.length === 0, show(res.mids));
  check('ひらがなの続きが1行に入るのに、その途中で折れた行が無い(語の一覧に頼らない。「すっかりは／まってる」)', res.kanaMids.length === 0, `${res.kanaMids.length}件 ${show(res.kanaMids)}`);
  // 1〜2字だけの行(最後の行のほか)。2026-11-06 の時点で、どれも幅160px未満の狭い吹き出し(字9〜11px・1行10字ほど)だけで、お話・カードの幅では0件。
  //   句読点で終わる短い文節(「今は、」「来よ。」)が、前の行にも次の長いかたまりにも並べずに1行になるもの。
  //   続きの途中で折らない決まり(迷ったら折らない)と引き換えなので、ここは数を増やさない上限で見る(直す前 106件)
  const phraseOnly = (x) => /／[^／]*[、。…‥？！!?]／/.test(x);
  const fragments = res.shortLines.filter((x) => !phraseOnly(x)), phrases = res.shortLines.filter(phraseOnly);
  check(`1〜2字だけの言葉のかけらの行(句読点で終わらないもの)が上限(${JA_SHORT_FRAGMENT_LIMIT}件)以下`, fragments.length <= JA_SHORT_FRAGMENT_LIMIT, `${fragments.length}件 ${show(fragments)}`);
  check(`句読点で終わる1〜2字の文節だけの行が上限(${JA_SHORT_PHRASE_LIMIT}件)以下`, phrases.length <= JA_SHORT_PHRASE_LIMIT, `${phrases.length}件 ${show(phrases)}`);
  check('本文が吹き出しの幅からはみ出さない', res.overflow.length === 0, show(res.overflow));
  // 2026-10-24 の時点で 3件(すべて90pxの顔文字の中)。増えたら部品を見直す
  check('「～」の手前・顔文字の中で折れたのは少ないまま(10件まで)', res.soft.length <= 10, `${res.soft.length}件 ${show(res.soft)}`);
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
