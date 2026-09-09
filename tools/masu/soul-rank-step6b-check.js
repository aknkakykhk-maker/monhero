// 魂格 STEP6B「魂格オーラ」のコード側回帰検査。
// 正式PNG実体の存在・透過品質は画像保存後のasset checkで別確認する。
// migration fixture: images/effects/soul-rank-aura-blue.PNG images/effects/soul-rank-aura-yellow.PNG images/effects/soul-rank-aura-green.PNG images/effects/soul-rank-aura-red.PNG images/effects/soul-rank-aura-rainbow.PNG
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const widgets=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/16-ranking-detail-and-widgets.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/70-bootstrap.jsx'),'utf8');
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
const names=['blue','yellow','green','red','rainbow'];
const auraPaths=['soul_rank_I_blue.png','soul_rank_II_yellow.png','soul_rank_III_green.png','soul_rank_IV_red.png','soul_rank_V_rainbow.png'];
ck('魂格Ⅰ〜Ⅴの正式PNGパスを参照',auraPaths.every(n=>widgets.includes(`images/effects/${n}`)));
ck('オーラ判定はsoulRankStageのみ',widgets.includes('const SoulRankAura')&&widgets.includes('normalizeSoulRankStage(soulRankStage)'));
ck('魂格0ではオーラなし',widgets.includes('if (!stage) return null'));
ck('転生回数ベースの旧オーラ定義を廃止',!widgets.includes('REINCARNATE_AURA_IMAGES')&&!widgets.includes('const ReincarnateAura'));
ck('実個体表示に旧ReincarnateAura呼び出しが残らない',!app.includes('<ReincarnateAura'));
ck('実個体表示はSoulRankAuraへ置換', (app.match(/<SoulRankAura/g)||[]).length>=2);
ck('HOMEも魂格段階でオーラ表示',widgets.includes('<SoulRankAura soulRankStage={masu.soulRankStage} className="is-home"/>'));
ck('青黄緑赤虹の表示補正を持つ',names.every(n=>css.includes(`.mh-reincarnate-aura.is-${n}`)));
ck('prefers-reduced-motion既存基盤を維持',css.includes('prefers-reduced-motion'));
console.log(failed?`\n${failed}件のNG`:'\n魂格STEP6Bコード: すべてOK');process.exit(failed?1:0);
