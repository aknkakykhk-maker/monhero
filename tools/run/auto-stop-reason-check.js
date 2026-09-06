// AUTO・∞周回が「本当に裏へ回ったとき」以外で止まらないこと、
// 止まったときは理由が分かることを見張る。
//
//   node tools/run/auto-stop-reason-check.js
//
// 2026-09-07・ユーザー報告「クイック中に1曲やったら周回が止まってた」。
//
// blur / pagehide は「他のアプリへ行った」以外でも飛ぶ。
// モンヒロビートは演奏のときに全画面と画面消灯の抑止へ入るので、その出入りで
// blur が飛び、裏で回していた周回が「アプリが裏に回った」と誤判定されて止まっていた。
// 本当に見えなくなったかどうかは visibilityState が持っているので、そちらで確かめる。
//
// あわせて、帯が「終わりました」としか言わないと、負けたのか裏に回ったのかが
// 分からない。止めるときは理由を渡し、帯に出す。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  path.join(root, 'monster-hero/src/parts/60-app.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const compact = src.replace(/\s+/g, '');

  // ★blur / pagehide は「見えているなら止めない」を通す
  check(`${rel}: blur・pagehide では、本当に見えなくなったときだけ止める`,
    compact.includes("constonMaybeHidden=()=>{if(typeofdocument!=='undefined'&&document.visibilityState!=='hidden')return;onHidden();};"));
  check(`${rel}: blur は onMaybeHidden につなぐ`,
    compact.includes("window.addEventListener('blur',onMaybeHidden)"));
  check(`${rel}: pagehide も onMaybeHidden につなぐ`,
    compact.includes("window.addEventListener('pagehide',onMaybeHidden)"));
  // visibilitychange の hidden は今までどおり確実に止める(裏に回ったら止まる約束は守る)
  check(`${rel}: 本当に裏へ回ったときは今までどおり止める`,
    compact.includes("constonVisibilityChange=()=>document.visibilityState==='hidden'?onHidden():onVisible();")
    || compact.includes("constonVisibilityChange=()=>(document.visibilityState==='hidden'?onHidden():onVisible());"));
  check(`${rel}: 後始末も同じものを外す（外し忘れない）`,
    compact.includes("window.removeEventListener('blur',onMaybeHidden)")
    && compact.includes("window.removeEventListener('pagehide',onMaybeHidden)"));

  // ---- 止まった理由 ----
  check(`${rel}: 止めるときは理由を渡せる`, compact.includes("conststopAllAuto=(reason='')=>{"));
  check(`${rel}: 理由は帯へ出す文言に変わる`, /const quickRunFinishReasonText\s*=/.test(src));
  for (const [reason, when] of [
    ['defeat', '負けたとき'],
    ['retire', '諦めたとき'],
    ['hidden', 'アプリが裏に回ったとき'],
    ['manual', '自分でAUTOを切ったとき'],
    ['error', '続けられなくなったとき'],
  ]) {
    check(`${rel}: ${when}の理由を渡している`, compact.includes(`stopAllAuto('${reason}')`), reason);
  }
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
