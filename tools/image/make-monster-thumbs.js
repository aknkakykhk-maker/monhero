// モンスターの立ち絵から、小さい枠で使う「小さい版」を作る(2026-10-27 社長の決定・オート無限周回のメモリ対策)。
//
//   node tools/image/make-monster-thumbs.js          … 足りない・古い小さい版を作り、一覧を書く(build.js が毎回呼ぶ)
//   node tools/image/make-monster-thumbs.js --check  … 作らずに、一覧と小さい版が今の立ち絵に合っているかだけ見る
//
// 【なぜ要るか】
// 30体ほどはアイコンが立ち絵そのもの(const X_ICON = X_IMG。1024四方前後)で、モンスターの札の 48px の丸い枠にも
// その大きさのまま展開されていた。iPhone(画素3倍)でも 48px なら 144px あれば足りるので、1体あたり約4MB を
// 約0.15MB にできる。持っているモンスターが多い人ほど効く。
//
// 【決めごと】
// ・元の立ち絵は消さない・変えない。小さい版は images/monster-thumbs/<種族のidを小文字にした名前>.png に別に置く
// ・縦横の比はそのまま、短い辺が THUMB_SHORT_SIDE になるよう縮める(object-cover で丸く切っても足りる)。
//   元が小さければ作らない(縮める意味が無い)
// ・使ってよいのは、画面での大きさが 64px 以下と分かっている枠だけ(図鑑・大きい立ち絵・染色する絵は元のまま)
// ・一覧は data/images/images-ally.js の <monster-thumbs> の間に書く。?v= は stamp-version.js が中身から打つ
// ・作り直すのは、元の立ち絵の中身が変わったときだけ(tools/image/monster-thumbs.json に元の指紋を控える)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..', '..');
const GAME = path.join(REPO, 'monster-hero');
const ALLY = path.join(GAME, 'data', 'ally-monsters.js');
const IMAGES_ALLY = path.join(GAME, 'data', 'images', 'images-ally.js');
const OUT_DIR = path.join(GAME, 'images', 'monster-thumbs');
const STATE = path.join(__dirname, 'monster-thumbs.json');
const THUMB_SHORT_SIDE = 192;
const BEGIN = '// <monster-thumbs>';
const END = '// </monster-thumbs>';

const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

function pngSize(buf) {
  if (buf.length > 24 && buf[1] === 0x50 && buf[2] === 0x4e) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  return null;
}

// 種族のid → 立ち絵のパス(ally-monsters.js の imgUrl:X_IMG と images-ally.js の const X_IMG = "…")
function monsterSources() {
  const ally = fs.readFileSync(ALLY, 'utf8');
  const images = fs.readFileSync(IMAGES_ALLY, 'utf8');
  const constPath = new Map([...images.matchAll(/const ([A-Z0-9_]+_IMG) = "(images\/monsters\/[^"?]+)(?:\?v=[0-9a-f]*)?";/g)].map(m => [m[1], m[2]]));
  const out = [];
  for (const m of ally.matchAll(/^\s*([A-Za-z0-9_]+)\s*:\s*\{\s*id\s*:\s*'([^']+)'[^\n]*?\bimgUrl\s*:\s*([A-Z0-9_]+_IMG)\b/gm)) {
    const rel = constPath.get(m[3]);
    if (rel) out.push({ id: m[2], rel });
  }
  return out;
}

function readState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return {}; } }

function blockOf(entries) {
  const lines = entries.map(e => `  ${JSON.stringify(e.id)}: "${e.thumb}",`);
  return `${BEGIN}\n// 小さい枠(64px 以下)で使うモンスターの小さい版。tools/image/make-monster-thumbs.js が作る(手で書かない)\nconst MONSTER_THUMBS = {\n${lines.join('\n')}\n};\n${END}`;
}

function writeBlock(text, block) {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length);
  return text.replace(/\s*$/, '\n\n') + block + '\n';
}

async function run({ check = false } = {}) {
  const state = readState();
  const next = {};
  const entries = [];
  const problems = [];
  let made = 0;
  let sharp = null;
  for (const { id, rel } of monsterSources()) {
    const src = path.join(GAME, rel);
    if (!fs.existsSync(src)) { problems.push(`${id} の立ち絵が見つかりません(${rel})`); continue; }
    const buf = fs.readFileSync(src);
    const size = pngSize(buf);
    if (!size || Math.min(size.w, size.h) < THUMB_SHORT_SIDE * 1.5) continue;
    // 名前は種族の id から付ける(立ち絵には SNEGUROCHKA.PNG と snegurochka.png のように大文字小文字だけ違う別の絵があり、
    // ファイル名から付けると大文字小文字を区別しない端末でぶつかる)
    const name = `${id.toLowerCase()}.png`;
    const thumbRel = `images/monster-thumbs/${name}`;
    const thumbAbs = path.join(GAME, thumbRel);
    const v = hashOf(buf);
    next[thumbRel] = v;
    entries.push({ id, thumb: thumbRel });
    if (state[thumbRel] === v && fs.existsSync(thumbAbs)) continue;
    if (check) { problems.push(`${thumbRel} が今の立ち絵から作られていません`); continue; }
    if (!sharp) sharp = require(path.join(REPO, 'tools', 'node_modules', 'sharp'));
    const scale = THUMB_SHORT_SIDE / Math.min(size.w, size.h);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await sharp(buf).resize(Math.round(size.w * scale), Math.round(size.h * scale), { kernel: 'lanczos3' })
      .png({ compressionLevel: 9, palette: false }).toFile(thumbAbs);
    made++;
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const images = fs.readFileSync(IMAGES_ALLY, 'utf8');
  // 一覧の比べ合わせは ?v= を外してから(?v= は stamp-version.js が打つ)
  const strip = (t) => t.replace(/(images\/monster-thumbs\/[^"?]+)\?v=[0-9a-f]*/g, '$1');
  const current = images.indexOf(BEGIN) >= 0 ? strip(images.slice(images.indexOf(BEGIN), images.indexOf(END) + END.length)) : '';
  const block = blockOf(entries);
  if (check) {
    if (current !== block) problems.push('data/images/images-ally.js の MONSTER_THUMBS が今の立ち絵と合っていません');
    return { ok: problems.length === 0, problems, count: entries.length, made };
  }
  if (current !== block) fs.writeFileSync(IMAGES_ALLY, writeBlock(images, block));
  if (JSON.stringify(state) !== JSON.stringify(next)) fs.writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  return { ok: problems.length === 0, problems, count: entries.length, made, changed: made > 0 || current !== block };
}

module.exports = { run, monsterSources, THUMB_SHORT_SIDE };

if (require.main === module) {
  run({ check: process.argv.includes('--check') }).then(r => {
    if (!r.ok) { r.problems.forEach(p => console.error(`NG: ${p}`)); console.error('node tools/build.js を実行してください'); process.exit(1); }
    console.log(`OK: モンスターの小さい版 ${r.count}体(作った ${r.made}枚)`);
  }).catch(e => { console.error('NG:', e && e.message || e); process.exit(1); });
}
