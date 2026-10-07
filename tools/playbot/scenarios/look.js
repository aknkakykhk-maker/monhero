// 見た目: 主な画面を毎回同じ手順で開いて撮り、前回と比べて大きく変わった画面だけを知らせる。
//   ・撮る前に、画面の動き(アニメーション・切り替えの動き)を止める
//   ・比べるのは、縮めた白黒の画像(97×211)。前回の分は tools/playbot/baseline/look/<画面>.png(1枚10KBほど)
//   ・助手のセリフのように毎回変わるところがあるので、少しの違いでは知らせない(THRESHOLD)
//   ・大きく変わった画面は、前回と今回を並べた画像を残して「改善のヒント」に出す(わざと変えたのか、崩れたのかは人が見る)
// --save-baseline のときは、今回の画像を前回の分として書く。
// 縮めるのに sharp(tools/node_modules)を使う。無ければ撮るだけにする。
const fs = require('fs');
const path = require('path');

const LOOK_DIR = path.join(__dirname, '..', 'baseline', 'look');
const W = 97, H = 211;
// 画素の明るさが 40 より大きく変わった点が、全体の 18% を超えたら「大きく変わった」
const PIXEL_DIFF = 40, THRESHOLD = 0.18;

// 画面の名前 → HOME から押していくボタン(名前の正規表現)
const SCREENS = [
  ['HOME', []],
  ['マーケット', [/^マーケット$/]],
  ['ダイヤショップ', [/^マーケット$/, /^ダイヤショップ$/]],
  ['M-B管理', [/^M\/B管理$/]],
  ['モンヒロビート', [/^モンヒロビート$/]],
  ['曲えらび', [/^モンヒロビート$/, /ソロライブ/]],
  ['モンヒロバトル', [/^モンヒロバトル$/]],
  ['ミッション', [/^ミッション/]],
  ['ギフト', [/^ギフト/]],
  ['プロフィール', [/^プロフィールを開く$/]],
  ['設定', [/^設定$/]],
];

let sharp = null;
try { sharp = require('sharp'); } catch { sharp = null; }

const small = (buf) => sharp(buf).resize(W, H, { fit: 'fill' }).grayscale().raw().toBuffer();

async function lookScenario(s, { out }) {
  const save = process.argv.includes('--save-baseline');
  if (save) fs.mkdirSync(LOOK_DIR, { recursive: true });
  const shot = [], changed = [], missing = [];
  for (const [name, steps] of SCREENS) {
    await s.backHome();
    await s.dismissOverlays(10);
    let reached = true;
    for (const re of steps) {
      if (!(await s.tapLabel(re, 1500))) { reached = false; break; }
      await s.dismissOverlays(6);
    }
    if (!reached) { missing.push(name); continue; }
    // 動きを止めて、落ち着くのを待ってから撮る
    await s.page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' }).catch(() => {});
    await s.wait(1200);
    await s.inspect();
    const buf = await s.page.screenshot();
    fs.writeFileSync(path.join(out, `look-${name}.png`), buf);
    shot.push(name);
    if (!sharp) continue;
    const now = await small(buf);
    const basePath = path.join(LOOK_DIR, `${name}.png`);
    if (fs.existsSync(basePath)) {
      const base = await sharp(basePath).grayscale().raw().toBuffer();
      let diff = 0;
      for (let i = 0; i < Math.min(base.length, now.length); i++) if (Math.abs(base[i] - now[i]) > PIXEL_DIFF) diff += 1;
      const rate = diff / now.length;
      if (process.env.PLAYBOT_DEBUG) console.log(`    [見た目] ${name}: 変わった割合 ${(rate * 100).toFixed(1)}%`);
      if (rate > THRESHOLD) {
        // 前回(縮めた画像を元の大きさへ)と今回を並べた画像を残す
        const vp = s.page.viewportSize();
        const prev = await sharp(basePath).resize(vp.width, vp.height, { fit: 'fill' }).png().toBuffer();
        const side = await sharp({ create: { width: vp.width * 2 + 8, height: vp.height, channels: 3, background: '#ff00aa' } })
          .composite([{ input: prev, left: 0, top: 0 }, { input: buf, left: vp.width + 8, top: 0 }]).png().toBuffer();
        const sideName = `look-${name}-前回と今回.png`;
        fs.writeFileSync(path.join(out, sideName), side);
        changed.push(`${name}(${Math.round(rate * 100)}%)`);
        await s.addIssue('見た目が大きく変わった', `「${name}」の見た目が前回から ${Math.round(rate * 100)}% 変わった。わざと変えたのか、崩れたのかを \`${sideName}\`(左が前回・右が今回)で確かめる`);
      }
    }
    if (save) await sharp(now, { raw: { width: W, height: H, channels: 1 } }).png().toFile(basePath);
  }
  await s.backHome();
  const note = `${shot.length}画面を撮った${sharp ? '' : '(sharp が無いので比べていない)'}${changed.length ? `・大きく変わった: ${changed.join('・')}` : '・大きく変わった画面なし'}${missing.length ? `・開けなかった: ${missing.join('・')}` : ''}${save ? '・今回の分を前回の分として残した' : ''}`;
  return { ok: !missing.length, note };
}

module.exports = { lookScenario, SCREENS };
