#!/usr/bin/env node
// 曲えらびの「同じ曲の別の版をまとめる」(2026-10-03・RHYTHM_SONG_VERSION_GROUPS)を見張る。
//   ・表にある曲はどれも公開中(RHYTHM_DEMO_SONG_IDS)で、1曲が2つの組に入っていない
//   ・表示名(displayName)が同じ公開曲は、どれも同じ組に入っている(short ver. ・remix を足したときの入れ忘れを止める)
//   ・実際の曲えらびで、一覧の行は組ごとに1つ・行を押すといつも原曲・難易度の上の切り替えで版が変わる
//   ・まとめても songId は版ごとのまま(切り替えると選んでいる songId がその版になる。自己ベスト・ランキングは版ごと)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..');
const PORT=8983;
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const ctx={console,Object,Number,Math,Array,JSON,String,Boolean,isNaN,parseInt,parseFloat,Date,Map,Set};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')
  +'\nthis.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_SONG_VERSION_GROUPS,rhythmSongVersionHead,rhythmSongVersionLabel};',ctx);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_SONG_VERSION_GROUPS:GROUPS,rhythmSongVersionHead}=ctx.out;
const ids=GROUPS.flatMap(group=>group.map(([id])=>id));
ok('表にある曲はどれも公開中',ids.every(id=>RHYTHM_DEMO_SONG_IDS.includes(id)),ids.filter(id=>!RHYTHM_DEMO_SONG_IDS.includes(id)).join(', '));
ok('1曲が2つの組に入っていない',new Set(ids).size===ids.length);
ok('どの組も2つ以上の版を持ち、先頭は「原曲」',GROUPS.every(group=>group.length>=2&&group[0][1]==='原曲'&&group.slice(1).every(([,label])=>label&&label!=='原曲')));
const byName=new Map();
for(const id of RHYTHM_DEMO_SONG_IDS){const song=RHYTHM_SONGS.find(s=>s.songId===id);if(!song)continue;
  if(!byName.has(song.displayName))byName.set(song.displayName,[]);byName.get(song.displayName).push(id);}
const loose=[...byName].filter(([,list])=>list.length>1&&new Set(list.map(rhythmSongVersionHead)).size>1);
ok('表示名が同じ公開曲は、どれも同じ組に入っている',!loose.length,loose.map(([name,list])=>`${name}: ${list.join(' / ')}`).join(' ・ '));
const expectedRows=RHYTHM_DEMO_SONG_IDS.length-GROUPS.reduce((sum,group)=>sum+group.length-1,0);

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
(async()=>{
  let playwright;
  try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので画面は確かめません');process.exit(failed?1:0);}
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
  await new Promise(resolve=>server.listen(PORT,resolve));
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(6000);
    await page.evaluate(()=>{
      const host=document.createElement('div');host.id='version-probe';
      host.style.cssText='position:fixed;inset:0;z-index:99999;background:#020617;display:flex;flex-direction:column';document.body.appendChild(host);
      const root=ReactDOM.createRoot(host);
      const Host=()=>{const [songId,setSongId]=React.useState('');const [difficultyId,setDifficultyId]=React.useState('');
        const [view,setView]=React.useState(DEFAULT_RHYTHM_SELECT_VIEW);window.__songId=songId;
        return React.createElement(RhythmSongSelect,{songs:rhythmDemoSongs(RHYTHM_SONGS),difficulties:RHYTHM_DIFFICULTIES,bestRecords:[],
          songId,difficultyId,onSongId:setSongId,onDifficultyId:setDifficultyId,view,onView:setView,onPlay:()=>{}});};
      root.render(React.createElement(Host));
    });
    await page.waitForTimeout(600);
    const q=(sel,attr)=>page.evaluate(([s,a])=>[...document.querySelectorAll(s)].map(el=>el.getAttribute(a)),[sel,attr]);
    const rows=await q('#version-probe [data-rhythm-song-row]','data-rhythm-song-row');
    ok(`一覧の行は組ごとに1つ(${expectedRows}行)`,rows.length===expectedRows,`${rows.length}行`);
    for(const group of GROUPS){
      const [head]=group[0],others=group.slice(1).map(([id])=>id);
      ok(`${head}: 原曲の行があり、ほかの版は行にならない`,rows.includes(head)&&others.every(id=>!rows.includes(id)));
    }
    // 組の行を押すと原曲。版を切り替えると選んでいる曲がその版になり、行もその版を出す
    const [head,,]=GROUPS[2][0],[other]=GROUPS[2][2]||GROUPS[2][1];
    await page.click(`#version-probe [data-rhythm-song-row="${head}"]`);await page.waitForTimeout(300);
    ok('組の行を押すと原曲を選ぶ',await page.evaluate(()=>window.__songId)===head);
    const versions=await q('#version-probe [data-rhythm-song-version]','data-rhythm-song-version');
    ok('難易度の上に、その組の版が全部並ぶ',JSON.stringify(versions)===JSON.stringify(GROUPS[2].map(([id])=>id)),versions.join(' / '));
    await page.click(`#version-probe [data-rhythm-song-version="${other}"]`);await page.waitForTimeout(300);
    ok('版を切り替えると、選んでいる曲がその版になる',await page.evaluate(()=>window.__songId)===other);
    ok('切り替えた版が一覧の行に出る',(await q('#version-probe [data-rhythm-song-row][aria-pressed="true"]','data-rhythm-song-row'))[0]===other);
    // ほかの組を押してから戻ると、また原曲(いつも原曲)
    await page.click(`#version-probe [data-rhythm-song-row="${GROUPS[0][0][0]}"]`);await page.waitForTimeout(300);
    await page.click(`#version-probe [data-rhythm-song-row="${head}"]`);await page.waitForTimeout(300);
    ok('ほかの曲を選んでから戻っても原曲',await page.evaluate(()=>window.__songId)===head);
    ok('組に入っていない曲には版の切り替えが出ない',await (async()=>{
      const plain=RHYTHM_DEMO_SONG_IDS.find(id=>!ids.includes(id));
      await page.click(`#version-probe [data-rhythm-song-row="${plain}"]`);await page.waitForTimeout(300);
      return (await q('#version-probe [data-rhythm-song-version]','data-rhythm-song-version')).length===0;})());
    ok('実行時エラーが出ていない',!errors.length,errors.slice(0,2).join(' / '));
  }finally{await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})().catch(error=>{console.error(error);process.exit(1);});
