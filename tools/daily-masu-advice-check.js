// みゅあの日次ワンポイント案内について、本文データと通常・DEBUGの表示経路を確認する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__scene = ASSISTANT_SCENES.dailyMasuAdvice;`, ctx);
const scene = ctx.__scene;

check('ワンポイント本文のsceneが登録されている', !!scene);
check('本文5件がline packからsceneへ渡されている', scene?.lines?.length === 5, `${scene?.lines?.length || 0}件`);
check('本文がすべて空でない', scene?.lines?.every(line => typeof line.t === 'string' && line.t.trim().length > 0));
check('登録数7体は表示条件を満たす', source.includes('eligible:count < 8'));
check('登録数8体以上は通常表示しない', source.includes('masuMons.length >= 8'));
check('通常表示とDEBUG表示が同じsceneを参照する',
  (source.match(/assistantSceneById\('dailyMasuAdvice'\)/g) || []).length === 1);
check('DEBUGの8体確認は対象外モーダルを表示する',
  source.includes('表示条件の対象外です。') && source.includes('eligible=dailyMasuAdvice.eligible!==false'));
check('本文領域に可視色と最小高さがある',
  source.includes("minHeight:'44px',color:'#ffffff',visibility:'visible'")
    && source.includes("minHeight:'36px',color:'#ffffff',backgroundColor:'#0f172a',display:'block'"));

if (failed) {
  console.error(`\n${failed}件の確認に失敗しました。`);
  process.exit(1);
}
console.log('\nみゅあの日次ワンポイント案内: すべてOK');
