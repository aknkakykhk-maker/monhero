#!/usr/bin/env node
// 事件簿(クリスマスのミステリーノベル)の文を「全部」、実際の画面と同じ見た目(XMAS_NOVEL_CSS)で描き、改行が言葉の途中で起きていないかを数える(台帳 r1126-071)。
//
//   node tools/novel/xmas-novel-wrap-check.js            直したあとの折れ方(XmasNovelWrap)で数える。言葉の途中で折れた行が1つでもあれば NG
//   node tools/novel/xmas-novel-wrap-check.js --before   直す前の折れ方(1文字ずつ折る)でも数えて、並べる
//   NV_WRAP_VERBOSE=1 を付けると、折れた所を全部出す
//
// 見る文: 台本(79-xmas-novel-script.jsx)の全場面の全行(本編・幕間・過去編・全エンド・強制バッド・名指しエンド・おまけ・序章。あつ派・ソラシド派の両方の行)
//   地の文の帯・台詞(しぐさの前置き+「」の中)・音の行(大きい音+小さい説明)・手がかりを書きとめた行・手がかりの札の説明・手がかり帳・
//   人の札の文・問い・選択肢・ログ・章の札・題の札・エンドの札とエンドヒストリーの題
// 幅: 縦(390×844)・横(844×390)・タブレット(820×1180)。画面と同じ CSS を入れ、同じ枠の中に置く
// 言葉の途中とみなす所(部品の決めた折り目とは別に、ここで独立に見る):
//   ・道具(Intl.Segmenter)の言葉の切れ目でない所(「コー／ト」「い／く」)
//   ・名前・手がかりの名前・かぎかっこの中の短い名前・日時・数と単位・「……」の中(「黒いサン／タ」「「二通目の招待状」を書／きとめた」は道具の切れ目でもあるので、こちらで見る)
//   ・行の頭に来てはいけない字(、。」）…ー 小さい字)で始まる行・「（ で終わる行
//   ・ひらがなの言葉の途中(「書／きとめた」「染みこんでい／く」。助詞・「て」のあとなど文の組み立ての切れ目は除く)
//   ・枠からはみ出した文
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
// 本体の部品は名前だけで読む(run-checks --changed が「このファイルを名指しで読む検査」として選ぶ。台本を足したときにも回る)
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const argv = process.argv.slice(2);
const BEFORE = argv.includes('--before');
const VERBOSE = !!process.env.NV_WRAP_VERBOSE;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 部品(41-screen-ui.jsx の jaWrapPoints まわり)を取り出す。ja-wrap-lines-check.js と同じ切り出し方
const ui = P('41-screen-ui.jsx');
const uiSrc = ui.slice(ui.indexOf('let _jaSegmenter'), ui.indexOf('const jaWrap ='));
const nv = P('79-screen-xmas-novel.jsx');
const A = '// ==== 改行の位置(台帳 r1126-071)ここから', B = '// ==== 改行の位置ここまで ====';
const nvSrc = nv.includes(A) && nv.includes(B) ? nv.slice(nv.indexOf(A), nv.indexOf(B)) : '';
check('事件簿の改行の部品(XmasNovelWrap の前段)を取り出せた', /xmasNovelWrapPlan =/.test(nvSrc));
const cssM = nv.match(/const XMAS_NOVEL_CSS = `([\s\S]*?)`;/);
check('事件簿の見た目(XMAS_NOVEL_CSS)を取り出せた', !!cssM);
const scriptSrc = P('79-xmas-novel-script.jsx');
const engine = P('79-xmas-novel-engine.jsx');
const castM = engine.match(/const XMAS_NOVEL_CAST = Object\.freeze\(\[[\s\S]*?\]\);/);
const S = new Function(`${scriptSrc}\nreturn XMAS_NOVEL_SCRIPT;`)();
const PLAYER = 'ブリーダー';
const fill = (t) => String(t || '').replace(/\{name\}/g, PLAYER);

// 文を集める。kind は報告の分け方(地の文・台詞)、place は置く枠
const jobs = [];
const add = (place, kind, text, where) => { if (text && String(text).trim()) jobs.push({ place, kind, text: String(text), where }); };
const splitLead = (s) => { const m = String(s || '').match(/^[(（][^)）]*[)）]/); return m ? [m[0], s.slice(m[0].length)] : ['', String(s || '')]; };
const splitSe = (s) => { const i = String(s || '').search(/[(（]/); return i < 0 ? [String(s || ''), ''] : [s.slice(0, i), s.slice(i + 1).replace(/[)）]\s*$/, '')]; };
for (const sc of S.scenes) {
  if (sc.ending && sc.ending.name) { add('endcard', '題', `「${sc.ending.name}」`, `${sc.id} エンドの札`); add('history', '題', `「${sc.ending.name}」`, `${sc.id} エンドヒストリー`); }
  for (const r of sc.rows || []) {
    const at = `${sc.id}:${r.id}`;
    const fx = Array.isArray(r.fx) ? r.fx : [];
    if (r.t === 'band') {
      if (fx.includes('se')) { const [snd, note] = splitSe(r.x); add('se-sound', '音の行', snd, at); add('se-note', '音の行', note, at); }
      else if (fx.includes('letter')) add('band', '地の文', String(r.x).replace(/／/g, '　'), at);
      else add('band', '地の文', fill(r.x), at);
      if (fx.includes('title') || fx.includes('chapter')) add('titlecard', '題', fill(r.x), `${at} 題の札`);
    } else if (r.t === 'line') {
      const x = fill(r.x);
      const [lead, body] = splitLead(x);
      if (!body.trim()) add('lead-only', 'ト書き', x, at);
      else { if (lead) add('lead', 'ト書き', lead, at); add('say', '台詞', `「${body}」`, at); }
      add('log', r.w || r.n ? '台詞' : '地の文', x, `${at} ログ`);
    } else if (r.t === 'clue') {
      add('band', '地の文', `手がかり帳に「${r.clue}」を書きとめた`, at);
      add('got', '手がかり', r.x, `${at} 手がかりの札`);
      add('book', '手がかり', r.x, `${at} 手がかり帳`);
    } else if (r.t === 'panel') add('band', '地の文', r.x || (r.stamp ? '……' : '登場人物'), at);
    else if (r.t === 'q') {
      add('band', '選択肢', fill(r.x), at);
      add(r.kind === 'action' ? 'question' : 'qbox', '選択肢', fill(r.x), `${at} 問い`);
      for (const o of r.options || []) add('choice', '選択肢', fill(o.x), `${at} 選択肢`);
      for (const o of r.extra || []) add('choice', '選択肢', fill(o.x), `${at} 選択肢`);
    }
  }
}
for (const c of S.chapters || []) if (c.title) add('chaptercard', '題', c.title, `${c.id} 章の札`);
// 名前の札(話し手の名前。台本の w の人と、名前だけの話し手 n)
const castNames = castM ? new Function(`${castM[0]}\nreturn XMAS_NOVEL_CAST;`)().map((x) => x.name) : [];
for (const n of new Set([...castNames, ...S.scenes.flatMap((sc) => (sc.rows || []).map((r) => r.n).filter(Boolean))])) add('nametag', '名前の札', n, `名前の札 ${n}`);
check('台本の文を集められた', jobs.length > 2000, `${jobs.length}本(縦・横でそれぞれ描く)`);

// ① 幅によらない点検: 部品が「折ってよい」とした所を全部、ブラウザを使わずに同じ決まりで見る(どの画面の幅でも、折れうる所はここだけ)
{
  const XMAS_NOVEL_CAST_ = castM ? new Function(`${castM[0]}\nreturn XMAS_NOVEL_CAST;`)() : [];
  const api = new Function('XMAS_NOVEL_SCRIPT', 'XMAS_NOVEL_CAST', `${uiSrc}\n${nvSrc}\nreturn { xmasNovelWrapPlan, xmasNovelKeepWords, XMAS_NOVEL_KEEP_RES, xmasNovelGramBreak, xmasNovelIsKana, xmasNovelWidth, xmasNovelBracketFits };`)(S, XMAS_NOVEL_CAST_);
  const seg = new Intl.Segmenter('ja', { granularity: 'word' });
  const P1 = /^(?:の|は|が|を|に|へ|と|で|も|や|から|まで|より)$/;
  const bad = []; let points = 0;
  for (const j of jobs) {
    const max = ['endcard', 'titlecard', 'chaptercard'].includes(j.place) ? 10 : undefined;
    const plan = api.xmasNovelWrapPlan(j.text, max);
    const s = plan.map((p) => p.t).join('');
    if (s !== j.text) { bad.push(`${j.where}: 字が変わった`); continue; }
    const segs = [...seg.segment(s)], edges = new Set([0, s.length]); segs.forEach((x) => { edges.add(x.index); edges.add(x.index + x.segment.length); });
    const spans = [];
    for (const re of api.XMAS_NOVEL_KEEP_RES) for (const m of s.matchAll(re)) if (!/^[「『【]/.test(m[0]) || api.xmasNovelBracketFits(s, m, max || 18)) spans.push([m.index, m.index + m[0].length]);
    for (const w of api.xmasNovelKeepWords()) if ([...w].length <= (max || 18)) for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) spans.push([i, i + w.length]);
    let pos = 0;
    plan.forEach((p, k) => {
      if (k > 0 && !p.space && !plan[k - 1].space) {
        points++;
        const i = pos, b = s.slice(0, i), a = s.slice(i), why = [];
        if (!edges.has(i)) why.push('言葉の途中');
        if (spans.some(([x, y]) => i > x && i < y)) why.push('名前・日時・かっこの中');
        if (/^[、。，．,.」』）)】〕〉》…‥ー〜～・：；ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?]/.test(a)) why.push('行の頭に来てはいけない字');
        if (/[「『（(【〔〈《]$/.test(b)) why.push('開きかっこで終わる行');
        if (api.xmasNovelIsKana(s, i - 1) && api.xmasNovelIsKana(s, i) && !api.xmasNovelGramBreak(s, i)) why.push('ひらがなの言葉の途中');
        const sg = segs.find((x) => x.index === i);
        if (/[一-龯々ァ-ヶー」』）)A-Za-z0-9０-９]$/.test(b) && sg && P1.test(sg.segment)) why.push('助詞の手前');
        if (why.length) bad.push(`[${j.kind}] ${j.where}: ${b.slice(-8)}／${a.slice(0, 6)}(${why.join('・')})`);
      }
      pos += p.t.length;
    });
  }
  check(`幅によらず: 部品が折ってよいとした所が全部、文節の切れ目(${jobs.length}本・${points}か所)`, bad.length === 0, bad.length ? `${bad.length}か所 例: ${bad.slice(0, 3).join(' | ')}` : '');
  if (VERBOSE) bad.forEach((m) => console.log(`   ${m}`));
}

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(failed ? 1 : 0); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const VIEWS = [{ label: '縦', width: 390, height: 844 }, { label: '横', width: 844, height: 390 }, { label: 'タブレット', width: 820, height: 1180 }];
  const modes = BEFORE ? ['before', 'after'] : ['after'];
  const result = {};
  try {
    for (const vp of VIEWS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;font-family:"Hiragino Sans","Noto Sans CJK JP","Noto Sans JP",sans-serif}${cssM[1]}</style><div id=root class="mh-nv" style="position:fixed;inset:0"></div>`);
      for (const mode of modes) {
        const out = await page.evaluate(({ uiSrc, nvSrc, scriptSrc, castSrc, jobs, mode }) => {
          // eslint-disable-next-line no-eval
          const XMAS_NOVEL_SCRIPT = new Function(`${scriptSrc}\nreturn XMAS_NOVEL_SCRIPT;`)();
          const XMAS_NOVEL_CAST = castSrc ? new Function(`${castSrc}\nreturn XMAS_NOVEL_CAST;`)() : [];
          const api = new Function('XMAS_NOVEL_SCRIPT', 'XMAS_NOVEL_CAST', `${uiSrc}\n${nvSrc}\nreturn { xmasNovelWrapPlan, xmasNovelKeepWords, XMAS_NOVEL_KEEP_RES, xmasNovelGramBreak, xmasNovelWidth, xmasNovelBracketFits };`)(XMAS_NOVEL_SCRIPT, XMAS_NOVEL_CAST);
          const root = document.getElementById('root');
          const el = (tag, cls, style) => { const d = document.createElement(tag); if (cls) d.className = cls; if (style) d.style.cssText = style; return d; };
          // 画面と同じ枠を組む。返すのは [外側, 文を入れる所]
          const frame = (place) => {
            if (['band', 'say', 'lead', 'lead-only', 'se-sound', 'se-note'].includes(place)) {
              const box = el('div', 'mh-nv-box'); box.style.zIndex = 5;
              const name = el('div', 'mh-nv-name mh-nv-serif'); name.textContent = 'ソラシド'; box.appendChild(name);
              const isSe = place.startsWith('se-');
              const tx = el('div', `mh-nv-text${place === 'band' ? ' band mh-nv-serif' : isSe ? ' se mh-nv-serif' : ' say'}`);
              box.appendChild(tx);
              const cls = { say: 'mh-nv-say-body', lead: 'mh-nv-say-lead', 'lead-only': 'mh-nv-say-lead only', 'se-sound': 'mh-nv-se-sound', 'se-note': 'mh-nv-se-note' }[place];
              const inner = cls ? el('span', cls) : tx; if (cls) tx.appendChild(inner);
              return [box, inner];
            }
            if (place === 'nametag') { const box = el('div', 'mh-nv-box'); const nm = el('div', 'mh-nv-name mh-nv-serif'); box.appendChild(nm); return [box, nm]; }
            if (place === 'got') { const g = el('div', 'mh-nv-get', 'animation:none'); const p = el('p', 'mh-nv-plain mt-1', 'white-space:pre-wrap;font-size:12px;line-height:1.625'); g.appendChild(p); return [g, p]; }
            if (place === 'endcard' || place === 'titlecard' || place === 'chaptercard') {
              const c = el('div', 'mh-nv-card', 'animation:none');
              const w = place === 'endcard' ? el('div', '', 'width:100%;max-width:24rem') : el('div', 'mh-nv-plain mh-nv-cardtext');
              const t = el('div', 'mh-nv-serif mh-nv-gold', `font-size:${place === 'endcard' ? 28 : 30}px;font-weight:900;line-height:1.25`);
              w.appendChild(t); c.appendChild(w); return [c, t];
            }
            if (place === 'history') {
              const wrap = el('div', 'mh-nv-card', 'animation:none'); const m = el('div', '', 'width:100%;max-width:28rem'); const li = el('div', 'mh-nv-clue mh-nv-history');
              const t = el('div', 'mh-nv-serif', 'margin-top:4px;font-size:17px;font-weight:900;line-height:1.375'); li.appendChild(t); m.appendChild(li); wrap.appendChild(m); return [wrap, t];
            }
            // 下から出る板(手がかり帳・ログ・問い・選択肢)
            const sheet = el('div', 'mh-nv-sheet', 'animation:none'); const panel = el('div', 'mh-nv-panel'); sheet.appendChild(panel);
            let t;
            if (place === 'book') { const c = el('div', 'mh-nv-clue'); t = el('p', 'mh-nv-plain', 'margin-top:4px;white-space:pre-wrap;font-size:12px;line-height:1.625'); c.appendChild(t); panel.appendChild(c); }
            else if (place === 'log') { const c = el('div', '', 'font-size:13px;line-height:1.625;padding-right:4px'); t = el('div', 'mh-nv-plain'); c.appendChild(t); panel.appendChild(c); }
            else if (place === 'choice') { t = el('button', 'mh-nv-choice mh-nv-serif'); panel.appendChild(t); }
            else if (place === 'question') { t = el('div', 'mh-nv-plain mh-nv-serif mh-nv-gold', 'margin-bottom:12px;font-size:17px;font-weight:900'); panel.appendChild(t); }
            else { t = el('div', '', 'border-radius:8px;padding:8px;font-size:13px;font-weight:700;line-height:1.625'); panel.appendChild(t); }
            return [sheet, t];
          };
          // 直す前: 文をそのまま置く(1文字ずつ折れる)。直したあと: XmasNovelWrap と同じ組み方
          const fillIn = (t, text, place) => {
            const allowed = new Set();
            if (mode === 'before') { t.appendChild(document.createTextNode(text)); return allowed; }
            const plan = api.xmasNovelWrapPlan(text, ['endcard', 'titlecard', 'chaptercard'].includes(place) ? 10 : undefined); let pos = 0;
            plan.forEach((p, i) => {
              const prev = plan[i - 1];
              if (i > 0 && !p.space && !(prev && prev.space)) t.appendChild(document.createElement('wbr'));
              if (p.keep) { const s = document.createElement('span'); s.style.whiteSpace = 'nowrap'; s.textContent = p.t; t.appendChild(s); } else t.appendChild(document.createTextNode(p.t));
              pos += p.t.length; allowed.add(pos);
            });
            return allowed;
          };
          // 割らない所(名前・日時・かぎかっこの中など)。部品と同じ一覧を使う
          // 大きい字の札(1行に約11字)では、1行に入らない長い名前は、ひとかたまりとしては見ない(部品と同じ。言葉の切れ目では見る)
          const keepSpans = (s, max) => {
            const spans = [];
            for (const re of api.XMAS_NOVEL_KEEP_RES) for (const m of s.matchAll(new RegExp(re.source, re.flags))) if (!/^[「『【]/.test(m[0]) || api.xmasNovelBracketFits(s, m, max)) spans.push([m.index, m.index + m[0].length]);
            for (const w of api.xmasNovelKeepWords()) if ([...w].length <= max) for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) spans.push([i, i + w.length]);
            return spans;
          };
          const seg = new Intl.Segmenter('ja', { granularity: 'word' });
          // 道具がその所から1字の助詞(または から・まで・より)を1つの言葉として読むか
          const particleAt = (s, i) => { for (const x of seg.segment(s)) { if (x.index === i) return /^(?:の|は|が|を|に|へ|と|で|も|や|から|まで|より)$/.test(x.segment); if (x.index > i) break; } return false; };
          const wordEdges = (s) => { const e = new Set([0, s.length]); for (const x of seg.segment(s)) { e.add(x.index); e.add(x.index + x.segment.length); } return e; };
          const isKana = (s, i) => /[ぁ-ゖゝゞ]/.test(s[i] || '') || (s[i] === 'ー' && i > 0 && /[ぁ-ゖ]/.test(s[i - 1]));
          // 文の組み立てで切れ目になる所(助詞のあと・「て・で」のあと・「から・けど」などのあと)。ja-wrap-lines-check.js と同じ考え
          // 文の組み立てで切れ目になる所は、部品と同じ決まり(xmasNovelGramBreak)で見る。言葉の途中かどうかは、道具の切れ目・名前の一覧でも別に見る
          const gramBreak = api.xmasNovelGramBreak;
          const range = document.createRange();
          const res = { rows: {}, bad: [], overflow: [], lines: 0 };
          for (const j of jobs) {
            const [outer, t] = frame(j.place);
            root.appendChild(outer);
            const allowed = fillIn(t, j.text, j.place);
            const tops = []; let txt = '';
            const walk = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) for (let i = 0; i < n.textContent.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); const r = range.getBoundingClientRect(); tops.push(r.width || r.height ? r.top : null); txt += n.textContent[i]; }
            const spans = keepSpans(txt, ['endcard', 'titlecard', 'chaptercard'].includes(j.place) ? 10 : 18), edges = wordEdges(txt);
            const reasons = [];
            let prevTop = null, lineStart = 0;
            for (let i = 0; i < tops.length; i++) {
              if (tops[i] == null) continue;
              if (prevTop != null && tops[i] - prevTop > 4) {
                res.lines++;
                const b = txt.slice(0, i), a = txt.slice(i);
                if (/\s$/.test(b) || /^\s/.test(a)) { prevTop = tops[i]; lineStart = i; continue; } // 空白で折れた
                const why = [];
                if (!edges.has(i)) why.push('言葉の途中');
                if (spans.some(([x, y]) => i > x && i < y)) why.push('名前・日時・かっこの中');
                if (/^[、。，．,.」』）)】〕〉》…‥ー〜～・：；ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ！？!?]/.test(a)) why.push('行の頭に来てはいけない字');
                if (/[「『（(【〔〈《]$/.test(b)) why.push('開きかっこで終わる行');
                if (isKana(txt, i - 1) && isKana(txt, i) && !gramBreak(txt, i)) why.push('ひらがなの言葉の途中');
                // 漢字・カタカナ・閉じかっこのすぐあと、助詞の手前で折れた(「暖炉の前／のひじかけ椅子」2026-11-27 r1126-077 の止め絵)。助詞は前の言葉といっしょの文節
                if (/[一-龯々ァ-ヶー」』）)A-Za-z0-9０-９]$/.test(b) && /^(?:の|は|が|を|に|へ|と|で|も|や|から|まで|より)(?![ぁ-ゖ]*[一-龯])/.test(a) && particleAt(txt, i)) why.push('助詞の手前');
                if (mode === 'after' && !allowed.has(i)) why.push('枠の中で折れた');
                if (why.length) reasons.push(`${txt.slice(Math.max(lineStart, i - 8), i)}／${txt.slice(i, i + 6)}(${why.join('・')})`);
                lineStart = i;
              }
              prevTop = tops[i];
            }
            if (t.scrollWidth > t.clientWidth + 1 && j.place !== 'se-sound') res.overflow.push(`${j.where}「${j.text.slice(0, 18)}」`);
            const key = `${j.place}|${j.where}|${j.text}`;
            res.rows[key] = reasons.length;
            if (reasons.length) res.bad.push(`[${j.kind}] ${j.where}: ${reasons.join(' / ')}`);
            outer.remove();
          }
          return res;
        }, { uiSrc, nvSrc, scriptSrc, castSrc: castM ? castM[0] : '', jobs, mode });
        result[`${vp.label}:${mode}`] = out;
      }
      await page.close();
    }
  } finally { await browser.close(); }

  const kinds = [...new Set(jobs.map((j) => j.kind))];
  for (const vp of VIEWS) {
    const after = result[`${vp.label}:after`];
    if (BEFORE) {
      const before = result[`${vp.label}:before`];
      const fixed = {};
      jobs.forEach((j) => { const k = `${j.place}|${j.where}|${j.text}`; if (before.rows[k] && !after.rows[k]) fixed[j.kind] = (fixed[j.kind] || 0) + 1; });
      console.log(`… ${vp.label}: 直す前に言葉の途中で折れた文 ${before.bad.length}本 → 直したあと ${after.bad.length}本。直った文: ${kinds.map((k) => `${k} ${fixed[k] || 0}`).join('・')}`);
      if (VERBOSE) before.bad.slice(0, Number(process.env.NV_WRAP_BEFORE_MAX || 40)).forEach((m) => console.log(`   前 ${m}`));
    }
    const byKind = kinds.map((k) => `${k} ${after.bad.filter((m) => m.startsWith(`[${k}]`)).length}`).join('・');
    check(`${vp.label}: 事件簿の文が言葉の途中で折れていない(${jobs.length}本・折り返し ${after.lines}か所)`, after.bad.length === 0, after.bad.length ? `${after.bad.length}本(${byKind}) 例: ${after.bad.slice(0, 3).join(' | ')}` : '');
    check(`${vp.label}: 事件簿の文が枠からはみ出していない`, after.overflow.length === 0, after.overflow.slice(0, 3).join(' | '));
    if (VERBOSE) after.bad.forEach((m) => console.log(`   ${m}`));
  }
  if (failed) { console.log(`NG ${failed}件`); process.exit(1); }
  console.log('OK: 事件簿の改行の位置はすべて文節の切れ目');
})().catch((e) => { console.error(e); process.exit(1); });
