// 魂格システム: 既存.mhsaveバックアップ往復で魂格資産が保持されることを確認する。
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
let src=fs.readFileSync(path.join(ROOT,'monster-hero/data/mhsave-backup.js'),'utf8');
src=src.replace(/\}\)\(\);\s*$/, 'globalThis.__mhsaveTest={collectBackupCode,decodeBackupCode};})();');
const values=new Map();
const localStorage={
  get length(){return values.size;},
  key(i){return Array.from(values.keys())[i]??null;},
  getItem(k){return values.has(k)?values.get(k):null;},
  setItem(k,v){values.set(String(k),String(v));},
};
const ctx={
  window:{localStorage,requestAnimationFrame:()=>{}},
  document:{documentElement:{},readyState:'loading',addEventListener:()=>{},querySelectorAll:()=>[]},
  MutationObserver:class{observe(){}},
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  escape,unescape,encodeURIComponent,decodeURIComponent,
  Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},setTimeout:()=>{},
  console,
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx);
const {collectBackupCode,decodeBackupCode}=ctx.__mhsaveTest||{};
let failed=0;const ck=(n,o)=>{console.log(`${o?'OK':'NG'}: ${n}`);if(!o)failed++;};
ck('既存バックアップ関数を実行可能',typeof collectBackupCode==='function'&&typeof decodeBackupCode==='function');

const masu=[{
  id:'soul-backup',baseId:'Mocchi',soulRankStage:4,levelCap:900,
  soulPointMaxReachedLevel:873,
  soulTraitLevels:{allDamage:12,partyDamageReduction:3,coordination:1},
}];
const items={hero_proof:37,soul_rank_respec_scroll:4,psyche_rainbow:999};
localStorage.setItem('mh_masu_mons',JSON.stringify(masu));
localStorage.setItem('mh_owned_items',JSON.stringify(items));
localStorage.setItem('unrelated_key','keep-out');

const code=collectBackupCode();
const decoded=decodeBackupCode(code);
ck('mh_*だけバックアップ対象',decoded.keys.includes('mh_masu_mons')&&decoded.keys.includes('mh_owned_items')&&!decoded.keys.includes('unrelated_key'));
ck('魂格段階・最高初到達Lv・特性振り分けを保持',decoded.data.mh_masu_mons===JSON.stringify(masu));
ck('勇者の証・魂格再編の書を保持',decoded.data.mh_owned_items===JSON.stringify(items));

values.clear();
decoded.keys.forEach(k=>localStorage.setItem(k,decoded.data[k]));
const restoredMasu=JSON.parse(localStorage.getItem('mh_masu_mons'));
const restoredItems=JSON.parse(localStorage.getItem('mh_owned_items'));
ck('復元後の魂格個体データが完全一致',JSON.stringify(restoredMasu)===JSON.stringify(masu));
ck('復元後の所持アイテムが完全一致',JSON.stringify(restoredItems)===JSON.stringify(items));
console.log(failed?`\n${failed}件のNG`:'\n魂格バックアップ: すべてOK');process.exit(failed?1:0);
