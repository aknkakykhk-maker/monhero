// game-system.jsx の構文チェック。改修後は必ず実行する。
// ブラウザ側は @babel/standalone で同じ変換を行うため、ここが通れば本番でも構文エラーにはならない。
const { transformGameSystem } = require('./harness');

try {
  const code = transformGameSystem();
  console.log(`OK: game-system.jsx の構文エラーはありません (変換後 ${(code.length / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.error('構文エラー:');
  console.error(e.message);
  process.exit(1);
}
