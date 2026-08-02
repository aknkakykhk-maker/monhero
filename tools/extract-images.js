// JSファイルへ base64 で埋め込まれている画像を、PNGファイルとして images/ 以下へ書き出し、
// 元の定数をそのファイルのパスへ置き換える。
//
//   node extract-images.js            … 書き出して置き換える
//   node extract-images.js --dry-run  … 何をするかだけ表示する
//
// 【なぜファイルにするか】
// 画像を base64 で埋め込むと、実データより約33%大きくなったうえに index.html の
// <script> として同期的に読み込まれるため、1枚でも差し替えるとファイル全体
// (images-ally.js は4.3MB)を丸ごと落とし直すことになっていた。
// PNGファイルにしておけば、変わった画像だけがダウンロードされ、起動時に必要な
// JSも小さくなる。絵を差し替えるときもPNGを置き換えるだけで済む。
//
// 【置き場所】定数名から下の表で決める。表に無い定数が出てきたら中断するので、
// 画像を足したときはここへ1行足すこと(勝手な場所へ散らばるのを防ぐため)。
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');

// 定数名 → 置き場所(monster-hero/ からの相対パス)
const PLACEMENT = {
  'monster-hero/data/images/images-ally.js': {
    MOCCHI_IMG: 'images/monsters/mocchi.png',
    HAM_IMG: 'images/monsters/ham.png',
    TIGER_IMG: 'images/monsters/tiger.png',
    PIXIE_IMG: 'images/monsters/pixie.png',
    SUEZO_IMG: 'images/monsters/suezo.png',
    GOLEM_IMG: 'images/monsters/golem.png',
    MONOL_IMG: 'images/monsters/monol.png',
    OBORO_IMG: 'images/monsters/oboro.png',
    ZAN_IMG: 'images/monsters/zan.png',
    MITARASHI_IMG: 'images/monsters/mitarashi.png',
    ARK_IMG: 'images/monsters/ark.png',
    IBLIS_IMG: 'images/monsters/iblis.png',
    HAM_ICON: 'images/monster-icons/ham.png',
    TIGER_ICON: 'images/monster-icons/tiger.png',
    MONOL_ICON: 'images/monster-icons/monol.png',
    OBORO_ICON: 'images/monster-icons/oboro.png',
    ZAN_ICON: 'images/monster-icons/zan.png',
    ARK_ICON: 'images/monster-icons/ark.png',
    MOCCHI_FACE_ICON: 'images/monster-icons/face/mocchi.png',
    HAM_FACE_ICON: 'images/monster-icons/face/ham.png',
    PIXIE_FACE_ICON: 'images/monster-icons/face/pixie.png',
    SUEZO_FACE_ICON: 'images/monster-icons/face/suezo.png',
    GOLEM_FACE_ICON: 'images/monster-icons/face/golem.png',
    ZAN_FACE_ICON: 'images/monster-icons/face/zan.png',
    MITARASHI_FACE_ICON: 'images/monster-icons/face/mitarashi.png',
    ARK_FACE_ICON: 'images/monster-icons/face/ark.png',
    IBLIS_FACE_ICON: 'images/monster-icons/face/iblis.png',
  },
  'monster-hero/data/images/images-enemy.js': {
    DINO_IMG: 'images/enemies/dino.png',
    GEL_IMG: 'images/enemies/gel.png',
    BLACKDINO_IMG: 'images/enemies/blackdino.png',
    JAAKUSOU_IMG: 'images/enemies/jaakusou.png',
    BLUEMOUNTAIN_IMG: 'images/enemies/bluemountain.png',
    GALI_IMG: 'images/enemies/gali.png',
    NAGA_IMG: 'images/enemies/naga.png',
    LILIM_IMG: 'images/enemies/lilim.png',
    DURAHAN_IMG: 'images/enemies/durahan.png',
    MOO_IMG_DATA: 'images/enemies/moo.png',
  },
  'monster-hero/data/breeder.js': {
    ORYO_FACE_ICON: 'images/breeder-icons/oryo.png',
    DRA_FACE_ICON: 'images/breeder-icons/dra.png',
    MYARU_FACE_ICON: 'images/breeder-icons/myaru.png',
    ATSU_FACE_ICON: 'images/breeder-icons/atsu.png',
    MUA_FACE_ICON: 'images/breeder-icons/mua.png',
    MOCCHI_PET_ICON: 'images/breeder-icons/mocchi-pet.png',
    GEZUDERO_ICON: 'images/breeder-icons/gezudero.png',
    MELOPANMAN_ICON: 'images/breeder-icons/melopanman.png',
    CADMIUM_FACE_ICON: 'images/breeder-icons/cadmium.png',
    DISC_STONE_BASE: 'images/disc-icons/stone-base.png',
    ZAN_DISC_ICON: 'images/disc-icons/zan.png',
    MITARASHI_DISC_ICON: 'images/disc-icons/mitarashi.png',
    ARK_DISC_ICON: 'images/disc-icons/ark.png',
    IBLIS_DISC_ICON: 'images/disc-icons/iblis.png',
  },
};

const dryRun = process.argv.includes('--dry-run');
const problems = [];
let written = 0, savedBytes = 0;

for (const [relFile, placement] of Object.entries(PLACEMENT)) {
  const filePath = path.join(REPO_ROOT, relFile);
  if (!fs.existsSync(filePath)) { problems.push(`${relFile} がありません`); continue; }
  let source = fs.readFileSync(filePath, 'utf8');
  const before = Buffer.byteLength(source);
  const re = /const ([A-Z0-9_]+) = "data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)";/g;
  const replaced = source.replace(re, (match, name, type, b64) => {
    const dest = placement[name];
    if (!dest) { problems.push(`${relFile}: ${name} の置き場所が表にありません`); return match; }
    if (type !== 'png') { problems.push(`${relFile}: ${name} は ${type} です(PNGのみ対応)`); return match; }
    const outPath = path.join(WEB_ROOT, dest);
    const bytes = Buffer.from(b64, 'base64');
    if (!dryRun) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, bytes);
    }
    written++;
    console.log(`  ${name.padEnd(22)} → ${dest} (${(bytes.length / 1024).toFixed(0)}KB)`);
    return `const ${name} = "${dest}";`;
  });
  if (!dryRun) fs.writeFileSync(filePath, replaced);
  savedBytes += before - Buffer.byteLength(replaced);
  console.log(`${relFile}: ${(before / 1024 / 1024).toFixed(2)}MB → ${(Buffer.byteLength(replaced) / 1024).toFixed(0)}KB`);
}

console.log(`\n${written}枚を書き出し、JSを合計 ${(savedBytes / 1024 / 1024).toFixed(2)}MB 削減しました${dryRun ? '(--dry-run のため実際には書いていません)' : ''}`);
if (problems.length) { problems.forEach(p => console.log('NG: ' + p)); process.exitCode = 1; }
