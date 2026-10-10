const sharp = require('/home/user/monhero/tools/node_modules/sharp');
const S = process.argv[2];
const info = JSON.parse(require('fs').readFileSync(S + '/info.json', 'utf8'));
const C = info.colors;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cells = [
  ['タップ', C.TAP, '横長の角丸の板・白い芯の帯・外に水色の光'],
  ['ホールド', C.HOLD, '板の中央に暗い短い横線(-)・後ろに緑の帯が伸びる'],
  ['スライド', C.SLIDE, '板+紫の帯(折れ線)が奥へ伸びる'],
  ['フリック(上)', C.FLICK, '板の上に ▲ の三角(淡いピンク)'],
  ['横フリック 左', C.LEFT, '板の上に « の矢印3つ(オレンジの線)'],
  ['横フリック 右', C.RIGHT, '板の上に » の矢印3つ(黄緑の線)'],
  ['モンスターノーツ', { hi: '#fef3c7', mid: '#fde68a(輪)', lo: '#f59e0b', label: '琥珀色(黄〜オレンジ)' }, '丸みの強い(角5)板・淡黄の輪・光は紫と金とシアンの3色'],
  ['幅広タップ(同時の幅広)', C.TAP, 'タップと同じ水色で横に長い・両端に白い帯'],
  ['空中のタップ(いまの試作)', { hi: '#fde68a', mid: '#fbbf24', lo: '#d97706', label: '金(琥珀に近い)' }, '金の板+暗い茶のふち・下へ棒(影の柱)'],
];
const cw = 380, ch = 300, imgW = 300, imgH = 225;
const cols = 3;
(async () => {
  const comps = [];
  for (let i = 0; i < cells.length; i++) {
    const [name, c, shape] = cells[i];
    const x = 10 + (i % cols) * cw, y = 70 + Math.floor(i / cols) * ch;
    comps.push({ input: await sharp(`${S}/n${i}.png`).extract({ left: 100, top: 50, width: 200, height: 150 }).resize(imgW, imgH).png().toBuffer(), left: x, top: y });
    const sw = (hex, k) => /^#[0-9a-f]{6}/i.test(hex) ? `<rect x="${k * 110}" y="0" width="22" height="22" rx="4" fill="${hex.slice(0, 7)}" stroke="#fff" stroke-opacity=".5"/><text class="t" x="${k * 110 + 28}" y="17" font-size="14" fill="#e5e7eb">${hex.slice(0, 7)}</text>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw - 10}" height="${ch - imgH}"><style>.t{font-family:'IPAGothic',sans-serif}</style>
      <text class="t" x="2" y="22" font-size="19" font-weight="700" fill="#fcd34d">${esc(name)}</text>
      <g transform="translate(2,32)">${sw(c.hi, 0)}${sw(c.mid, 1)}${sw(c.lo, 2)}</g>
      <text class="t" x="2" y="72" font-size="12.5" fill="#cbd5e1">${esc(c.label || '')}・${esc(shape).slice(0, 30)}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y + imgH });
  }
  // 色だけの一覧(コードの値)
  const rowY = 70 + Math.ceil(cells.length / cols) * ch + 40;
  const sw2 = (items, x0, y0, title, note) => {
    let g = `<text class="t" x="${x0}" y="${y0}" font-size="19" font-weight="700" fill="#fcd34d">${esc(title)}</text><text class="t" x="${x0}" y="${y0 + 20}" font-size="12.5" fill="#cbd5e1">${esc(note)}</text>`;
    items.forEach(([n, hex], k) => { const x = x0 + (k % 6) * 185, y = y0 + 34 + Math.floor(k / 6) * 34; g += `<rect x="${x}" y="${y}" width="26" height="26" rx="5" fill="${hex}" stroke="#fff" stroke-opacity=".5"/><text class="t" x="${x + 34}" y="${y + 13}" font-size="13" fill="#e5e7eb">${esc(n)}</text><text class="t" x="${x + 34}" y="${y + 26}" font-size="11" fill="#94a3b8">${hex}</text>`; });
    return g;
  };
  const J = info.judg;
  const body = [
    sw2([['スライドの手 左(試作)', '#22d3ee'], ['スライドの手 右(試作)', '#db2777'], ['地上のタップ 水色', C.TAP.mid], ['フリック ピンク', C.FLICK.mid], ['ホールド 緑', C.HOLD.mid], ['スライド 紫', C.SLIDE.mid]], 10, 30, '帯・手の色(コードの値)', '試作の左手=#22d3ee はタップの水色に、右手=#db2777 はフリックのピンクに近い'),
    sw2([['MARVELOUS 金', J.MARVELOUS], ['EXCELLENT', J.EXCELLENT], ['GREAT', J.GREAT], ['GOOD', J.GOOD], ['BAD', J.BAD], ['MISS', J.MISS]], 10, 30, '判定の光(RHYTHM_JUDGMENT_COLORS)', 'MARVELOUS の金(#fbbf24)は、空中の金・モンスターの琥珀と同じ系統'),
    sw2(info.rainbow.map((h, k) => ['ジャスト虹 ' + (k + 1), h]), 10, 30, 'ジャストMARVELOUSの虹(RHYTHM_JUDGMENT_RAINBOW)', '文字のグラデーションと弾ける粒に使う6色'),
    sw2([['空中の判定ライン', '#fbbf24'], ['空中の線の文字 SKY', '#fbbf24'], ['道のふち', '#38bdf8'], ['道のふちの芯', '#e0f2fe'], ['地上の判定ライン', '#e9d5ff'], ['同時押し', '#ffffff']], 10, 30, 'ライン・道(コードの値)', '同時押しは特別な形が無く、同じ時刻のタップが2つ並ぶだけ'),
  ].map((g) => `<svg xmlns="http://www.w3.org/2000/svg" width="1150" height="110"><style>.t{font-family:'IPAGothic',sans-serif}</style>${g}</svg>`);
  body.forEach((svg, k) => comps.push({ input: Buffer.from(svg), left: 0, top: rowY + k * 120 - 20 }));
  const W = 10 + cw * cols, H = rowY + 4 * 120 - 10;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="60"><style>.t{font-family:'IPAGothic',sans-serif}</style><text class="t" x="10" y="38" font-size="26" font-weight="700" fill="#fff">モンヒロビート ノーツの色と形の一覧(ゲームの描画部品でそのまま描いた)</text></svg>`;
  comps.push({ input: Buffer.from(head), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#0b1020' } }).composite(comps).png().toFile(`${S}/note-inventory.png`);
  console.log(W, H);
})();
