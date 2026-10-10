const sharp = require('/home/user/monhero/tools/node_modules/sharp');
const S = process.argv[2];
const styles = [['gold', '案A いまの形', '金色の板+山形の印'], ['glow', '案B 光る板', '地上と同じ丸い板で金色に光る'], ['gem', '案C 宝石', '横長の菱形+白い芯'], ['roof', '案D 屋根', '上がとがった板(上へを形で)']];
(async () => {
  const cw = 360, top = 150, colW = 380;
  const crop = { left: 0, top: 160, width: 390, height: 560 };
  const comps = [];
  let x = 10;
  for (const [id, name, desc] of styles) {
    for (const [row, at] of [[0, 2350], [1, 4700]]) {
      const img = await sharp(`${S}/shots/${id}-${at}.png`).extract(crop).resize(cw).png().toBuffer();
      comps.push({ input: img, left: x, top: top + row * (Math.round(560 * cw / 390) + 14) });
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${colW}" height="${top}"><style>.t{font-family:'IPAGothic',sans-serif}</style>
      <text class="t" x="4" y="92" font-size="28" font-weight="700" fill="#fcd34d">${name}</text><text class="t" x="4" y="128" font-size="19" fill="#e5e7eb">${desc}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: 0 });
    x += colW;
  }
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="1530" height="50"><style>.t{font-family:'IPAGothic',sans-serif}</style><text class="t" x="10" y="36" font-size="26" font-weight="700" fill="#ffffff">空中のタップの見た目の案(上下は別の場面・白い板は地上のタップ・金色の線が SKY)</text></svg>`;
  comps.push({ input: Buffer.from(head), left: 0, top: 0 });
  const H = top + 2 * (Math.round(560 * cw / 390) + 14) + 10;
  await sharp({ create: { width: 1530, height: H, channels: 3, background: '#0b0b14' } }).composite(comps).png().toFile(`${S}/sky-tap-styles.png`);
  console.log('書き出し', H);
})();
