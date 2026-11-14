// モンサクの技の絵(資料の技アイコン)を、使う技の分だけ配信用に作る(2026-11-15 社長 r1115-003)。
//   元: docs/reference/line-mf/monster-skill-data/skill-icons/sk-####.png(832枚・ファイル名が技ID・資料のまま。そのまま配信しない)
//   使う技: data/assistant-masmon-techs.js の技のうち、id が資料の skillId と同じもの(名前も同じことを確かめる)
//   出力: monster-hero/images/success/skill/sk-####.png(96×96・減色PNG) と、56-monhero-success-start.jsx の「技の絵のある id」の一覧(印の間だけ書き換える)
//   82×82 の元は右下に消費ガッツの数字が焼き込まれている(うちの数字と食い違う)ので、画面側で数字の札をかぶせる。ここでは加工しない
//   使い方: node tools/success/build-skill-icons.js   (--check で、一覧と置いてある絵が合っているかだけ見る)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const SRC = path.join(ROOT, 'docs', 'reference', 'line-mf', 'monster-skill-data');
const OUT = path.join(ROOT, 'monster-hero', 'images', 'success', 'skill');
const JSX = path.join(ROOT, 'monster-hero', 'src', 'parts', '56-monhero-success-start.jsx');
const SIZE = 96;
const { ASSISTANT_MASMON_TECHS: T } = require(path.join(ROOT, 'monster-hero', 'data', 'assistant-masmon-techs.js'));
const ref = {};
for (const f of fs.readdirSync(path.join(SRC, 'monster-skills-by-blood'))) {
  const j = JSON.parse(fs.readFileSync(path.join(SRC, 'monster-skills-by-blood', f), 'utf8'));
  for (const s of j.skills) ref[s.skillId] = s;
}
const ids = new Set(); let none = 0; let mismatch = 0;
for (const list of Object.values(T.species)) for (const t of list) {
  const r = ref[t.id];
  if (!r) { none++; continue; }
  if (r.name !== t.name) { mismatch++; continue; }
  if (fs.existsSync(path.join(SRC, 'skill-icons', `${t.id}.png`))) ids.add(t.id);
}
const list = [...ids].sort();
// 画像の検査(image-asset-check ④)が「使われている」と数えられるよう、完全なパスで書く
const pathsOf = () => list.map((i) => `images/success/skill/${i}.png`);
const block = () => `/* skill-icons:begin(tools/success/build-skill-icons.js が書く) */\nconst MSX_SKILL_ICONS = new Set([\n${pathsOf().map((x) => `'${x}'`).join(',')}]);\n/* skill-icons:end */`;
(async () => {
  const check = process.argv.includes('--check');
  if (!check) {
    fs.mkdirSync(OUT, { recursive: true });
    const keep = new Set(list.map((i) => `${i}.png`));
    for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.unlinkSync(path.join(OUT, f));
    for (const id of list) {
      await sharp(path.join(SRC, 'skill-icons', `${id}.png`)).resize(SIZE, SIZE, { fit: 'fill' }).png({ palette: true, quality: 85, effort: 10, colours: 96 }).toFile(path.join(OUT, `${id}.png`));
    }
    let s = fs.readFileSync(JSX, 'utf8');
    const a = s.indexOf('/* skill-icons:begin'); const b = s.indexOf('/* skill-icons:end */');
    if (a < 0 || b < 0) throw new Error('56-monhero-success-start.jsx に skill-icons の印が無い');
    s = s.slice(0, a) + block() + s.slice(b + '/* skill-icons:end */'.length);
    fs.writeFileSync(JSX, s);
  }
  const have = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length : 0;
  const jsx = fs.readFileSync(JSX, 'utf8'); const inJsx = jsx.includes(block());
  const bytes = fs.existsSync(OUT) ? fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0) : 0;
  console.log(`技の絵: 資料の絵あり ${list.length}種 / 資料に無い技 ${none}技 / 名前が食い違う ${mismatch}技 / 置いてある絵 ${have}枚(${Math.round(bytes / 1024)}KB) / 一覧が合っている ${inJsx}`);
  if (have !== list.length || !inJsx || mismatch) { console.log('NG: 絵か一覧がずれています。node tools/success/build-skill-icons.js で作り直してください'); process.exit(1); }
})();
