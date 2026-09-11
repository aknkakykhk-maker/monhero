// 魂格 STEP6A「魂格バッジ」の回帰検査。
// 画像オーラはSTEP6Bで正式PNG保存後に接続する。
const fs=require('fs'),path=require('path');
const {REPO_ROOT,readAppSource}=require('../harness');
const widgets=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/16-ranking-detail-and-widgets.jsx'),'utf8');
// 画面を切り出した(51〜71-screen-*.jsx)ので、60-app.jsx だけでは足りない。
// 超越演出のマークは 62-screen-masu-temple.jsx へ移っている
const app=readAppSource();
const css=fs.readFileSync(path.join(REPO_ROOT,'monster-hero/src/parts/70-bootstrap.jsx'),'utf8');
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
ck('魂格Ⅰ〜Ⅴの共通バッジ定義がある',
  widgets.includes("SOUL_RANK_BADGE_LABELS")&&widgets.includes("soulRankStage = 0")
  &&widgets.includes("mh-soul-rank-badge is-stage-"));
ck('魂格Ⅰ以上は超越バッジより優先される',
  widgets.indexOf("if (stage > 0)")<widgets.indexOf("if (!transcended) return null"));
ck('5段階の青/黄/緑/赤/虹スタイルがある',
  [1,2,3,4,5].every(n=>css.includes(`.mh-soul-rank-badge.is-stage-${n}`))
  &&css.includes('conic-gradient'));
ck('魂格Ⅴバッジに常時アニメーションを追加していない',
  !/mh-soul-rank-badge[^\n]{0,300}animation:/.test(css));
ck('個体表示の共通呼び出しへsoulRankStageを渡す',
  (app.match(/<TranscendenceBadge[^>]*soulRankStage=/g)||[]).length>=4);
ck('超越儀式そのものの超越マークは従来表示を維持',
  app.includes('<div className="mh-transcend-mark" aria-hidden="true"><TranscendenceBadge transcended/></div>'));
// STEP6Bで転生オーラ→魂格オーラへ置換済み(旧名が残っていないことは soul-rank-step6b-check.js が見る)。
// ここではオーラ実装そのものを消していないことだけを見張る
ck('魂格オーラの実装を削除しない(STEP6Bで転生オーラから置換済み)',
  app.includes('<SoulRankAura')&&widgets.includes('SOUL_RANK_AURA_IMAGES'));
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP6A: すべてOK');process.exit(failed?1:0);
