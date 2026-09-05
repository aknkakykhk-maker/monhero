#!/usr/bin/env node
// 曲えらび(曲選択画面)を、実際のブラウザで動かして確かめる。
//
//   node tools/mode/rhythm-song-select-check.js
//
// 【なぜ要るか】
// この画面は「一覧で曲をえらぶ → 難易度をえらぶ → 決定」の3手でできている。
// ソースを文字で見るだけでは「選んだつもりが変わっていない」類の不具合を拾えない。
// 実際に本物のReactで組み立てて、押したときに中身が変わることまで見る。
//
// このサンドボックスはTailwindのCDNへ出られないので見た目は崩れるが、
// DOMの構造と押したときの動きはそのまま観測できる。
const http=require('http');
const path=require('path');
const fs=require('fs');

const ROOT=path.resolve(__dirname,'..','..');
const PORT=8981;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
    const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT,()=>resolve(server));
});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.route('**cdn.tailwindcss.com**',route=>route.abort());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(6000);

    // 曲えらびだけを本物のReactで組み立てる。曲はデバッグ用も含めた全部を渡して、
    // 「曲が増えたとき」の並びも同時に見る。
    const mounted=await page.evaluate(()=>{
      const host=document.createElement('div');
      host.id='song-select-probe';
      host.style.cssText='position:fixed;inset:0;z-index:99999;background:#020617';
      document.body.appendChild(host);
      window.__picked=null;
      const root=ReactDOM.createRoot(host);
      // 選んでいる曲・難易度は本体(App)が持つ形になったので、ここでも同じように
      // 状態を持つ入れ物をかぶせて渡す(2026-09-05・曲を鳴らし続けるための作り替え)。
      // 直接 RhythmSongSelect を描くと、押しても何も変わらない部品を見ることになる。
      const Host=({bestRecords})=>{
        const [songId,setSongId]=React.useState('');
        const [difficultyId,setDifficultyId]=React.useState('');
        // 並び順と助手の畳みも、本体(App)と同じように外側が持つ
        const [view,setView]=React.useState(DEFAULT_RHYTHM_SELECT_VIEW);
        window.__view=view;
        return React.createElement(RhythmSongSelect,{
          songs:RHYTHM_SONGS,
          difficulties:RHYTHM_DIFFICULTIES,
          bestRecords,
          songId,difficultyId,onSongId:setSongId,onDifficultyId:setDifficultyId,
          view,onView:setView,
          notice:React.createElement('p',{id:'probe-notice'},'ここに助手のひとことが入る'),
          onPlay:(song,difficulty)=>{window.__picked=`${song.songId}/${difficulty.id}`;},
        });
      };
      // 記録を差し替えて描き直せるようにしておく（ひし形の色を見るのに使う）
      window.__rerender=bestRecords=>root.render(React.createElement(Host,{bestRecords}));
      root.render(React.createElement(Host,{bestRecords:[]}));
      return true;
    });
    await page.waitForTimeout(600);
    ok('曲えらびを組み立てられる',mounted===true);

    const shape=await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      // スクロールの数は「クラス名」で数える。このサンドボックスはTailwindを読めないので
      // 実際のoverflowは効かず、getComputedStyleで数えると必ず0になってしまう。
      const scrolls=[...host.querySelectorAll('*')]
        .filter(el=>String(el.className||'').split(/\s+/).includes('overflow-y-auto'));
      return {
        rows:rows.length,
        rowIds:rows.map(row=>row.getAttribute('data-rhythm-song-row')),
        levels:rows.map(row=>(row.querySelector('[data-rhythm-song-row-level]')||{}).textContent||''),
        arts:host.querySelectorAll('[data-rhythm-song-art]').length,
        hasList:!!host.querySelector('[data-rhythm-song-list]'),
        hasDetail:!!host.querySelector('[data-rhythm-song-detail]'),
        scrolls:scrolls.length,
        difficulties:[...host.querySelectorAll('[data-rhythm-difficulty]')].map(el=>el.getAttribute('data-rhythm-difficulty')),
        level:(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'',
        best:(host.querySelector('[data-rhythm-demo-best]')||{}).textContent||'',
        start:!!host.querySelector('[data-rhythm-demo-start]'),
        random:!!host.querySelector('[data-rhythm-song-random]'),
      };
    });
    ok('曲が一覧に並ぶ',shape.rows>=2,`${shape.rows}曲`);
    ok('1行ごとに「楽曲Lv.」の数字が出る',shape.levels.every(text=>/^\d+$/.test(text.trim())),
      shape.levels.slice(0,4).join(' / '));
    ok('曲ごとに絵(ジャケット)がある',shape.arts>=shape.rows+1,`${shape.arts}枚（一覧${shape.rows}＋選択中1）`);
    ok('一覧と、選んでいる曲の欄が分かれている',shape.hasList&&shape.hasDetail);
    ok('スクロールするのは一覧の1か所だけ',shape.scrolls===1,`${shape.scrolls}か所`);
    ok('難易度ボタンが出る',shape.difficulties.length>=1,shape.difficulties.join('/'));
    ok('選んでいる難易度のレベルとノーツ数が出る',/Lv\.\d+ \/ \d+ノーツ/.test(shape.level),shape.level.trim());
    ok('自己ベストの欄がある（未プレイなら「まだ遊んでいません」）',/まだ遊んでいません/.test(shape.best),shape.best.trim());
    ok('決定とランダムのボタンがある',shape.start&&shape.random);

    // 曲を選び直すと、選んでいる曲の欄が変わる
    const switched=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      const before=(host.querySelector('[data-rhythm-song-title]')||{}).textContent||'';
      rows[rows.length-1].click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const after=(host.querySelector('[data-rhythm-song-title]')||{}).textContent||'';
      return {before,after,pressed:rows[rows.length-1].getAttribute('aria-pressed')};
    });
    ok('別の曲を押すと選んでいる曲が変わる',switched.before!==switched.after&&switched.pressed==='true',
      `${switched.before} → ${switched.after}`);

    // 難易度を選び直すと、レベルの表示が変わる。
    // 難易度が1つしかない曲では確かめようが無いので、いちばん多い曲へ戻してから見る。
    const changed=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      let best=rows[0],bestCount=-1;
      for(const row of rows){
        row.click();
        await new Promise(resolve=>setTimeout(resolve,60));
        const count=host.querySelectorAll('[data-rhythm-difficulty]').length;
        if(count>bestCount){bestCount=count;best=row;}
      }
      best.click();
      await new Promise(resolve=>setTimeout(resolve,150));
      // 2026-09-05、EXPERT以上は前の難易度をクリアするまで鍵が掛かる。
      // 記録が空のこの検査では鍵つきは押せないのが正しいので、押せるものの中でいちばん上を選ぶ。
      const all=[...host.querySelectorAll('[data-rhythm-difficulty]')];
      const buttons=all.filter(button=>button.getAttribute('data-rhythm-difficulty-locked')==='0');
      const locked=all.filter(button=>button.getAttribute('data-rhythm-difficulty-locked')==='1');
      const before=(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'';
      buttons[buttons.length-1].click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const after=(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'';
      const start=host.querySelector('[data-rhythm-demo-start]');
      // 鍵つきを押しても始まる難易度が変わらないこと(押せてしまわないこと)
      let lockedStayed=true;
      if(locked.length){
        locked[locked.length-1].click();
        await new Promise(resolve=>setTimeout(resolve,150));
        const afterLocked=host.querySelector('[data-rhythm-demo-start]');
        lockedStayed=!!afterLocked&&afterLocked.getAttribute('data-rhythm-demo-start')
          ===(start?start.getAttribute('data-rhythm-demo-start'):'');
      }
      return {before,after,count:buttons.length,lockedCount:locked.length,lockedStayed,
        lockedIds:locked.map(button=>button.getAttribute('data-rhythm-difficulty')).join(','),
        startId:start?start.getAttribute('data-rhythm-demo-start'):'',
        pickedId:buttons[buttons.length-1].getAttribute('data-rhythm-difficulty')};
    });
    ok('難易度を押すとレベルの表示が変わる',changed.count>=2&&changed.before!==changed.after,
      `${changed.before.trim()} → ${changed.after.trim()}`);
    ok('決定は、いま選んでいる難易度をそのまま始める',changed.startId===changed.pickedId,
      `決定=${changed.startId} / 選択=${changed.pickedId}`);
    // 記録がまだ無い状態では、EXPERTとMASTERに鍵が掛かっている
    ok('まだクリアしていないEXPERT・MASTERは鍵つきで押せない',
      changed.lockedIds==='EXPERT,MASTER'&&changed.lockedStayed,
      `鍵つき=${changed.lockedIds||'なし'} / 押しても変わらない=${changed.lockedStayed}`);

    // 決定を押すと、選んだ曲と難易度がそのまま渡る
    const picked=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      host.querySelector('[data-rhythm-demo-start]').click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const row=host.querySelector('[data-rhythm-song-row][aria-pressed="true"]');
      return {picked:window.__picked,songId:row?row.getAttribute('data-rhythm-song-row'):''};
    });
    ok('決定を押すと、選んだ曲と難易度で始まる',
      typeof picked.picked==='string'&&picked.picked.startsWith(`${picked.songId}/`),String(picked.picked));

    // 自己ベストは「難易度ごと」に出す。全国ランキングは難易度をまたいだ合算なので、
    // 曲えらびのほうは難易度別だと分かるようになっていないといけない
    // （2026-09-05・ユーザー指示）。
    const perDifficulty=await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const cells=[...host.querySelectorAll('[data-rhythm-difficulty-best]')];
      const buttons=[...host.querySelectorAll('[data-rhythm-difficulty]')];
      return {cells:cells.length,buttons:buttons.length,
        ids:cells.map(cell=>cell.getAttribute('data-rhythm-difficulty-best')),
        line:(host.querySelector('[data-rhythm-demo-best]')||{}).textContent||''};
    });
    ok('難易度ボタンごとに自己ベストが出る',
      perDifficulty.cells===perDifficulty.buttons&&perDifficulty.cells>=1,
      `${perDifficulty.cells}件 / ${perDifficulty.ids.join(',')}`);

    // 一覧のひし形は「難易度」ではなく「どこまで極めたか」で色が変わる
    // （2026-09-05・ユーザー指示）。記録を差し替えて、印が段ごとに変わることを見る。
    const marks=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      const songId=(host.querySelector('[data-rhythm-song-row]')||{}).getAttribute
        ?host.querySelector('[data-rhythm-song-row]').getAttribute('data-rhythm-song-row'):'';
      const read=()=>[...host.querySelectorAll('[data-rhythm-song-row]')][0]
        .querySelectorAll('[data-rhythm-achievement]');
      const seen={};
      const cases=[
        ['UNPLAYED',{}],
        ['CLEAR',{clear:true}],
        ['FULL_COMBO',{clear:true,fullCombo:true}],
        ['ALL_EXCELLENT',{clear:true,fullCombo:true,allExcellent:true}],
        ['ALL_MARVELOUS',{clear:true,fullCombo:true,allExcellent:true,allMarvelous:true}],
      ];
      for(const [name,record] of cases){
        const records={[songId]:Object.fromEntries(RHYTHM_DIFFICULTIES.map(d=>[d.id,record]))};
        window.__rerender(records);
        await new Promise(resolve=>setTimeout(resolve,120));
        const list=[...read()];
        const target=list.find(el=>el.getAttribute('data-rhythm-achievement')!=='NONE')||list[0];
        seen[name]={id:target.getAttribute('data-rhythm-achievement'),
          background:getComputedStyle(target).background||''};
      }
      return seen;
    });
    ok('ひし形は達成の段ごとに変わる',
      Object.entries(marks).every(([name,entry])=>entry.id===name),
      Object.entries(marks).map(([name,entry])=>`${name}→${entry.id}`).join(' / '));
    ok('同じ曲の難易度どうしで色を変えない（色は達成だけで決まる）',await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const row=host.querySelector('[data-rhythm-song-row]');
      const ids=[...row.querySelectorAll('[data-rhythm-achievement]')]
        .map(el=>el.getAttribute('data-rhythm-achievement'))
        .filter(id=>id!=='NONE');   // 譜面が無い難易度は薄いまま。これは達成の段ではない
      // 遊べる難易度がどれも同じ達成なら、印もすべて同じになる
      return ids.length>=2&&new Set(ids).size===1;
    }));

    // 2026-09-05、ユーザー指示「固定タブを利用して音楽だけ動かせるようにしたい」。
    // 案内(助手のひとこと)はスクロールの外へ出し、動くのは曲の並びだけにした。
    ok('スクロールするのは曲の一覧だけ（案内はその外にある）',await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const list=host.querySelector('[data-rhythm-song-list]');
      const notice=host.querySelector('[data-rhythm-song-notice]');
      if(!list)return false;
      // 案内があるなら、それは一覧の中にいてはいけない
      return !notice||!list.contains(notice);
    }));
    // 2026-09-05、ユーザー指摘「文字数で枠がずれるのがださい」。
    // 曲名が1行の曲と2行の曲で行の高さが変わり、一覧も詳細もガタガタになっていた。
    // 高さの確保はインラインstyle(minHeight)なので、Tailwindを読めないここでも測れる。
    // ただし折り返しは実機と同じにならないので、曲名の幅をこちらで細くして
    // 「何行になっても高さが変わらない」ことを直接確かめる。
    const titleHeights=await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const targets=[...host.querySelectorAll('[data-rhythm-song-row-title]')];
      const detail=host.querySelector('[data-rhythm-song-title]');
      const at=width=>targets.map(title=>{
        title.style.width=width;
        return Math.round(title.getBoundingClientRect().height);
      });
      const wide=at('120px');
      const narrow=at('34px');   // 1文字ずつ折り返すくらい細くする
      // 空振り防止。同じ字を「高さを固定していない」入れ物へ入れて、
      // 本来なら細くしたぶんだけ伸びることを確かめる。
      let grew=false;
      if(targets.length){
        const probe=document.createElement('b');
        probe.style.cssText='display:block;width:34px;position:absolute;visibility:hidden';
        probe.style.font=getComputedStyle(targets[0]).font;
        probe.textContent=targets[0].textContent;
        host.appendChild(probe);
        grew=probe.getBoundingClientRect().height>wide[0]+2;
        probe.remove();
      }
      targets.forEach(title=>{title.style.width='';});
      let detailWide=0,detailNarrow=0;
      if(detail){
        detail.style.width='200px';detailWide=Math.round(detail.getBoundingClientRect().height);
        detail.style.width='34px';detailNarrow=Math.round(detail.getBoundingClientRect().height);
        detail.style.width='';
      }
      return {wide,narrow,unique:[...new Set([...wide,...narrow])],grew,detailWide,detailNarrow};
    });
    ok('細くすれば本来は伸びる（この検査が空振りしていない）',titleHeights.grew===true);
    ok('曲名が何行になっても一覧の高さは変わらない',
      titleHeights.unique.length===1&&titleHeights.unique[0]>0,
      `高さ=${titleHeights.unique.join('/')}`);
    ok('選んだ曲の曲名も高さを固定している（下の難易度が動かない）',
      titleHeights.detailWide>0&&titleHeights.detailWide===titleHeights.detailNarrow,
      `広い=${titleHeights.detailWide} / 細い=${titleHeights.detailNarrow}`);

    // 高さを2行で固定しているぶん、長い曲名は入りきらないと途中で切れてしまう。
    // 副題まで含めた正式な曲名が、実際の幅で最後まで見えているかを測る
    // (「Stay With Me ～Locked Fate～」のように副題つきの曲がある)
    const clipped=await page.evaluate(()=>{
      const list=[...document.querySelectorAll('[data-rhythm-song-row-title]')];
      const detail=document.querySelector('[data-rhythm-song-title]');
      const check=el=>({name:(el.textContent||'').trim(),over:el.scrollHeight>el.clientHeight+1});
      return [...list,...(detail?[detail]:[])].map(check).filter(x=>x.over);
    });
    ok('曲名が途中で切れていない（副題まで見えている）',clipped.length===0,
      clipped.length?clipped.map(x=>x.name).join(' / '):'全部おさまっている');

    // 副題を持つ曲は、画面にも副題まで出ていること
    const shownNames=await page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-song-row-title]')].map(el=>(el.textContent||'').trim()));
    const withSubtitle=shownNames.filter(name=>/[～~]/.test(name));
    ok('副題つきの曲は副題まで出ている',withSubtitle.length>0,
      withSubtitle.length?withSubtitle.join(' / '):'副題つきの曲名が1つも出ていない');

    // 難易度ボタンの高さはTailwindのクラスで決まるので、ここでは書きぶりを見張る。
    // ロック中だけ「◯◯で解放」が2行になり、その曲だけボタンが高くなっていた。
    const gameSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
    // 高さは 66px → 60px にした(2026-09-05・曲の一覧へ回す高さを増やすため)。
    // 見張りたいのは「固定の h で決めていること」なので、数字ではなくその書きぶりを見る。
    ok('難易度ボタンの高さは固定（min-h ではなく h で決めている）',
      /flex h-\[\d+px\] flex-1 flex-col justify-center rounded-xl border-2/.test(gameSource)
      &&!gameSource.includes('min-h-[52px] flex-1 rounded-xl border-2'));

    // ---- 並び替え(2026-09-05・ユーザー指示「曲選択のソートがほしい 入手順 難易度順 名前順」) ----
    const rowIdsNow=()=>page.evaluate(()=>[...document.getElementById('song-select-probe')
      .querySelectorAll('[data-rhythm-song-row]')].map(el=>el.getAttribute('data-rhythm-song-row')));
    const pickSort=async id=>{
      await page.click('#song-select-probe [data-rhythm-song-sort]');
      await page.waitForTimeout(150);
      await page.click(`[data-rhythm-sort-option="${id}"]`);
      await page.waitForTimeout(200);
    };
    ok('並び替えのボタンがある',await page.evaluate(()=>!!document.querySelector('#song-select-probe [data-rhythm-song-sort]')));
    const addedOrder=await rowIdsNow();
    // 並び順の種類は data 側(RHYTHM_SORT_ORDERS)が決める。ここで数を書くと増やすたびに落ちる
    const sortIds=await page.evaluate(()=>RHYTHM_SORT_ORDERS.map(item=>item.id));
    ok('入手順・難易度順・名前順がそろっている',
      ['added','level','name'].every(id=>sortIds.includes(id)),sortIds.join(' / '));
    await page.click('#song-select-probe [data-rhythm-song-sort]');
    await page.waitForTimeout(200);
    const optionCount=await page.evaluate(()=>document.querySelectorAll('[data-rhythm-sort-option]').length);
    ok('並び替えの選択肢が全部シートに出る',optionCount===sortIds.length,`${optionCount}件 / ${sortIds.length}件`);
    await page.click('[data-rhythm-sort-close]');
    await page.waitForTimeout(200);

    const orders={};
    for(const id of sortIds){await pickSort(id);orders[id]=await rowIdsNow();}
    ok('並び替えで実際に並びが変わる',
      Object.entries(orders).filter(([id,list])=>list.join()!==addedOrder.join()).length>=2,
      Object.entries(orders).map(([id,list])=>`${id}=${list.join(',')}`).join(' / '));
    // 名前順・難易度順・長さ順は、それぞれ「そう並んでいるか」を中身で確かめる。
    // 難易度は**画面に出ている「楽曲Lv.」の数字**を読む。実装のLv.は
    // 「いま選んでいる難易度のLv.」なので、検査側で別の計算をすると必ずずれる。
    const meta=await page.evaluate(()=>{
      const out={};
      for(const song of RHYTHM_SONGS){
        const ids=RHYTHM_DIFFICULTIES.filter(d=>rhythmChartPlayable(song,d.id)).map(d=>d.id);
        if(!ids.length)continue;
        out[song.songId]={name:rhythmSongFullName(song),ms:rhythmSongDurationMs(song,RHYTHM_DIFFICULTIES)};
      }
      return out;
    });
    const shownLevels=()=>page.evaluate(()=>[...document.querySelectorAll('#song-select-probe [data-rhythm-song-row-level]')]
      .map(el=>Number((el.textContent||'').trim())||0));
    const nonDecreasing=(list,pick)=>list.every((id,i)=>i===0||pick(meta[list[i-1]])<=pick(meta[id]));
    if(orders.level){
      await pickSort('level');
      const levels=await shownLevels();
      ok('難易度順は数字が小さいほうから並ぶ',levels.every((v,i)=>i===0||levels[i-1]<=v),levels.join(' ≤ '));
    }
    if(orders.length)ok('長さ順は短いほうから並ぶ',nonDecreasing(orders.length,m=>m.ms),
      orders.length.map(id=>Math.round(meta[id].ms/1000)+'s').join(' ≤ '));
    if(orders.name)ok('名前順は曲名の順に並ぶ',
      orders.name.every((id,i)=>i===0||meta[orders.name[i-1]].name.localeCompare(meta[id].name,'ja')<=0),
      orders.name.map(id=>meta[id].name).join(' → '));

    // 逆順
    await pickSort('level');
    await page.click('#song-select-probe [data-rhythm-song-sort]');
    await page.waitForTimeout(150);
    await page.click('[data-rhythm-sort-desc]');
    await page.waitForTimeout(150);
    await page.click('[data-rhythm-sort-close]');
    await page.waitForTimeout(250);
    const descLevels=await shownLevels();
    ok('「逆から並べる」でひっくり返る',descLevels.every((v,i)=>i===0||descLevels[i-1]>=v),descLevels.join(' ≥ '));

    // 並び替えは見え方だけ。選んでいる曲は動かさない
    await page.click('#song-select-probe [data-rhythm-song-sort]');
    await page.waitForTimeout(150);
    await page.click('[data-rhythm-sort-desc]');
    await page.waitForTimeout(150);
    await page.click('[data-rhythm-sort-close]');
    await page.waitForTimeout(200);
    await pickSort('added');
    await page.evaluate(()=>{const rows=[...document.querySelectorAll('#song-select-probe [data-rhythm-song-row]')];
      (rows[rows.length-1]||rows[0]).click();});
    await page.waitForTimeout(250);
    const titleBefore=await page.evaluate(()=>(document.querySelector('#song-select-probe [data-rhythm-song-title]')||{}).textContent||'');
    await pickSort('name');
    const titleAfter=await page.evaluate(()=>(document.querySelector('#song-select-probe [data-rhythm-song-title]')||{}).textContent||'');
    ok('並び替えても選んでいる曲は変わらない',!!titleBefore&&titleBefore===titleAfter,`${titleBefore} → ${titleAfter}`);
    await pickSort('added');

    // ---- 助手のひとことを畳める(曲の一覧へ回す高さを増やすため) ----
    // Tailwindを読めないここでは一覧が画面いっぱいに伸びたままなので「高さ」では測れない。
    // 助手のぶんだけ**一覧の始まる位置が上がる**ことを見る(こちらはCSS無しでも動く)。
    const listTop=()=>page.evaluate(()=>{const el=document.querySelector('#song-select-probe [data-rhythm-song-list]');
      return el?Math.round(el.getBoundingClientRect().top):0;});
    const openedTop=await listTop();
    ok('助手のひとことに畳むボタンがある',
      await page.evaluate(()=>!!document.querySelector('#song-select-probe [data-rhythm-song-notice-toggle]')));
    await page.click('#song-select-probe [data-rhythm-song-notice-toggle]');
    await page.waitForTimeout(250);
    const closedTop=await listTop();
    ok('畳むと曲の一覧がその分だけ上へ広がる',closedTop<openedTop,`一覧の上端 ${openedTop}px → ${closedTop}px`);
    ok('畳んだら助手のひとことは消える',
      await page.evaluate(()=>!document.querySelector('#song-select-probe [data-rhythm-song-notice]')));
    ok('畳んだかどうかは覚える口がある(保存キーと正規化)',
      gameSource.includes("const RHYTHM_SELECT_VIEW_KEY = 'mh_rhythm_select_v1'")
      &&gameSource.includes('normalizeRhythmSelectView')
      &&gameSource.includes('storeSet(RHYTHM_SELECT_VIEW_KEY'));
    await page.click('#song-select-probe [data-rhythm-song-notice-toggle]');
    await page.waitForTimeout(250);

    // ---- 一覧を輪にする(2026-09-05・ユーザー指示
    //      「1番下にいったら止まるんじゃなくて上に戻ってくるループ式にして」) ----
    const loopState=()=>page.evaluate(()=>{const el=document.querySelector('#song-select-probe [data-rhythm-song-list]');
      return {loop:el.getAttribute('data-rhythm-song-loop'),top:Math.round(el.scrollTop),
        max:Math.round(el.scrollHeight-el.clientHeight)};});
    // このサンドボックスはTailwindを読めないので overflow が効かず、
    // scrollTop がそもそも動かない。輪の動きは実際にスクロールできるときだけ測る。
    await page.evaluate(()=>{const el=document.querySelector('#song-select-probe [data-rhythm-song-list]');
      el.style.overflowY='auto';el.style.height='200px';});
    await page.waitForTimeout(250);
    const loop0=await loopState();
    ok('曲が2つ以上あるときは一覧を輪にする',loop0.loop==='1');
    if(loop0.max>0){
      await page.evaluate(()=>{const el=document.querySelector('#song-select-probe [data-rhythm-song-list]');el.scrollTop=el.scrollHeight;});
      await page.waitForTimeout(400);
      const bottom=await loopState();
      ok('いちばん下まで送っても止まらず、続きへ戻る',bottom.top<bottom.max-10,`${bottom.top} / 下端 ${bottom.max}`);
      await page.evaluate(()=>{const el=document.querySelector('#song-select-probe [data-rhythm-song-list]');el.scrollTop=0;});
      await page.waitForTimeout(400);
      const top=await loopState();
      ok('いちばん上まで送っても止まらず、続きへ戻る',top.top>10,`${top.top}`);
    }else{
      console.log('--  輪の動き: この環境では一覧をスクロールできないので測れません');
    }
    // 曲が1つしかないときは輪にしない(同じ行が3つ並ぶだけになるため)
    ok('曲が1つのときは輪にしない',gameSource.includes('const loopEnabled=list.length>=2;'));
    // 影の行は、数えて確かめる検査の邪魔をしない
    const rowMarks=await page.evaluate(()=>({
      rows:document.querySelectorAll('#song-select-probe [data-rhythm-song-row]').length,
      shadows:document.querySelectorAll('#song-select-probe [data-rhythm-song-row-loop]').length,
      titles:document.querySelectorAll('#song-select-probe [data-rhythm-song-row-title]').length,
    }));
    ok('輪のために置いた影の行には目印を付けない',
      rowMarks.shadows>0&&rowMarks.titles===rowMarks.rows,
      `本物${rowMarks.rows} / 影${rowMarks.shadows} / 曲名の目印${rowMarks.titles}`);

    ok('実行時エラーが出ていない',errors.length===0,errors.slice(0,2).join(' / '));
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
