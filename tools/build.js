// game-system.jsx を配信用のJavaScriptへ事前変換し、monster-hero/game-system.compiled.js を書き出す。
//
//   node build.js          … 変換して書き出す
//   node build.js --check  … 書き出さず、compiled が最新かどうかだけ確認する(古ければ終了コード1)
//   node build.js --from-parts … parts を正として game-system.jsx を作り直す(両方が変わって止まったとき用)
//
// 編集元は monster-hero/src/parts/*.jsx(parts.json の順)。game-system.jsx はそれを連結した生成物で、
// compiled はさらにそれを変換したもの。詳しくは tools/harness.js の PARTS_DIR まわりのコメント。
//
// 【なぜ事前変換するか】
// 以前は index.html が @babel/standalone をCDNから読み込み(約2.8MB)、さらに
// game-system.jsx を cache:'no-store' で毎回取得しなおして、546KBのJSXを
// ブラウザ上で変換してから eval していた。つまりページを開くたびに
//   ①Babel本体のダウンロード ②JSXの再ダウンロード ③端末上での変換
// が走っており、これが読み込みが重い一番の原因だった(画像データを削っても
// 体感が変わらなかったのはこのため)。変換済みのJSを普通の<script>で読むだけにすれば
// ①〜③がまるごと無くなる。
//
// 【注意】game-system.compiled.js は自動生成物なので直接編集しないこと。
// 変更は必ず game-system.jsx に対して行い、このスクリプトで作り直す。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { REPO_ROOT, GAME_SYSTEM, transformGameSystem, syncPartsAndGameSystem, assembleParts, splitGeneratedFile } = require('./harness');

const OUT_FILE = path.join(REPO_ROOT, 'monster-hero', 'game-system.compiled.js');

// 元ファイルのハッシュを出力の先頭に埋め込み、--check で最新かどうか判定できるようにする
function sourceHash() {
  return crypto.createHash('sha256').update(fs.readFileSync(GAME_SYSTEM)).digest('hex').slice(0, 16);
}

function readEmbeddedHash() {
  if (!fs.existsSync(OUT_FILE)) return null;
  const head = fs.readFileSync(OUT_FILE, 'utf8').slice(0, 400);
  const m = head.match(/source-sha256:\s*([0-9a-f]+)/);
  return m ? m[1] : null;
}

// 書き出す内容そのものを作る関数。--check もこれと丸ごと比べるので、
// 「先頭の注記がどこで終わるか」を推測する必要がなくなる。
// (以前は --check 側が「空行までが注記」と決め打ちしていたが、
//  実際の注記は空行を挟まないため、変換後コードの最初の空行までを注記とみなし、
//  正しくビルドした直後でも必ず不一致になっていた。GitHub Actions が
//  ここで必ず落ち、Pagesへの公開が丸ごと止まっていた)
function buildFileContents(hash, code) {
  const header = [
    '// ============================================================',
    '// このファイルは tools/build.js が game-system.jsx から自動生成したものです。',
    '// 直接編集しないでください。変更は game-system.jsx に対して行い、',
    '// リポジトリのルートで `cd tools && node build.js` を実行して作り直します。',
    `// source-sha256: ${hash}`,
    '// ============================================================',
    '',
  ].join('\n');
  return header + code + '\n';
}

if (process.argv.includes('--check')) {
  // 編集元(parts)と連結生成物(game-system.jsx)が一致しているかを先に見る。
  // parts だけ直して build.js を忘れると、ここで止まる(compiled の --check と同じ考え方)
  {
    const current = splitGeneratedFile(fs.readFileSync(GAME_SYSTEM, 'utf8'));
    if (current.body !== assembleParts()) {
      console.error('NG: game-system.jsx が monster-hero/src/parts/ の連結結果と一致しません。node tools/build.js を実行してください');
      process.exit(1);
    }
  }
  const hash = sourceHash();
  const embedded = readEmbeddedHash();
  if (!embedded) {
    console.error('NG: game-system.compiled.js がありません。node build.js を実行してください');
    process.exit(1);
  }
  if (embedded !== hash) {
    console.error('NG: game-system.compiled.js が game-system.jsx より古いです。node build.js を実行してください');
    console.error(`  compiled: ${embedded} / jsx: ${hash}`);
    process.exit(1);
  }

  // ハッシュだけでは、別の変換器で生成したコードへ同じハッシュを付けた不整合を検出できない。
  // 正規ビルドの出力そのものを比較し、tools/build.js 以外による生成物の混入を防ぐ。
  if (fs.readFileSync(OUT_FILE, 'utf8') !== buildFileContents(hash, transformGameSystem())) {
    console.error('NG: game-system.compiled.js が正規ビルドの出力と一致しません。node tools/build.js を実行してください');
    process.exit(1);
  }
  // 音源を差し替えたのにキーが古いままだと、端末に古い音が残り続ける(2026-09-10)
  {
    const {spawnSync}=require('child_process');
    const r=spawnSync(process.execPath,[path.join(__dirname,'stamp-audio-keys.js'),'--check'],{encoding:'utf8'});
    if(r.status!==0){process.stderr.write(r.stderr||r.stdout||'');process.exit(1);}
  }
  // 見た目のCSS(tailwind.css)が今のソースから作られたものかを見る。
  // tailwindcss は optionalDependencies なので CI では作り直せない。かわりに
  // CSSの1行目へ書いてある「元の中身の指紋」と今のソースを突き合わせる。
  // クラスを1つ足して build.js を忘れると、そのクラスだけ効かない画面が公開されてしまう
  {
    const r = require('./build-tailwind').checkTailwind();
    if (!r.ok) {
      console.error(`NG: ${r.reason}。node tools/build.js を実行してください`);
      process.exit(1);
    }
  }
  console.log('OK: game-system.compiled.js は game-system.jsx の正規ビルドと一致しています');
  process.exit(0);
}

// まず編集元(parts)と game-system.jsx をそろえる。parts が変わっていれば連結し直し、
// game-system.jsx が直接編集されていれば parts へ書き戻す(両方が別々に変わっていれば止まる)
{
  const sync = syncPartsAndGameSystem({ fromParts: process.argv.includes('--from-parts') });
  if (sync.action !== 'none') console.log(`parts と game-system.jsx をそろえました: ${sync.action}(${sync.reason})`);
}

// 音源(audio/*.mp3)のキャッシュキーを中身に合わせる。
// 音源を差し替えてもURLが同じままだと、loadBuffer の force-cache のせいで
// 端末に残った古い音が鳴り続ける(2026-09-10・ユーザー指摘で発覚)。
// parts を書き換えるので、変わったら game-system.jsx を作り直す。
{
  const stampAudio = require('./stamp-audio-keys');
  if (stampAudio.changed) {
    syncPartsAndGameSystem({ fromParts: true });
    console.log(`音源のキャッシュキーを書き直しました(${stampAudio.count}件)`);
  }
}

// 見た目のCSS(tailwind.css)を、いまのソースから作り直す。
// 中身が変わっていなければ何もしない(作るのに7秒かかるため)。
// stamp-version はこのファイルのキャッシュキーを打つので、必ずその前に行う。
{
  const { buildTailwindIfNeeded } = require('./build-tailwind');
  const r = buildTailwindIfNeeded();
  if (r.missingTool) {
    console.error('NG: tailwind.css を作り直せません。tailwindcss が入っていません(cd tools && npm install)');
    process.exit(1);
  }
  console.log(r.changed
    ? `tailwind.css を作り直しました(${Math.round(r.size / 1024)} KB / ${r.fingerprint})`
    : `tailwind.css は最新でした(${r.fingerprint})`);
}

// 公開用ビルドではバージョン3箇所を先に同一時刻へ揃える。機能変更後に古い日時の
// compiled.jsを作れてしまわないよう、出荷工程を別コマンドの実行忘れに依存させない。
require('./stamp-version');

const hash = sourceHash();
const code = transformGameSystem();

fs.writeFileSync(OUT_FILE, buildFileContents(hash, code));
const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
console.log(`書き出しました: ${path.relative(process.cwd(), OUT_FILE)} (${kb} KB)`);
console.log(`source-sha256: ${hash}`);

// ローディングのゲージが使う「起動時に読み込むファイルの実サイズ」を測り直す。
// game-system.compiled.js 自身も対象なので、必ず書き出したあとに行う。
const { stampBootSizes } = require('./stamp-boot-sizes');
const boot = stampBootSizes();
console.log(`起動時に読み込むファイル: ${boot.count}件 / 合計 ${(boot.total / 1024 / 1024).toFixed(2)}MB (ローディングのゲージの分母)`);
