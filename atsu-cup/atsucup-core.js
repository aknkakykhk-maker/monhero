// あつ杯ツール共通のstate管理・データロジック(全ページで共有、この端末のlocalStorageだけで完結)
const AtsuCup = (function(){
  "use strict";

  const STORE_KEY = "atsucup:state:v2";

  const state = {
    people: [],       // [{name, rec}] 今回の大会に選ばれている参加者
    roster: [],       // [name, ...] この端末に登録済みの参加者マスタ(大会をまたいで再利用)
    order: [],
    remaining: [],
    matches: [],       // matches[round][i] = {a,b,winner,loser,video}
    winnerName: "",
    thirdPlaceMatch: null, // {a,b,winner} 準決勝(2試合)完了時に敗者同士で自動生成
    tournamentMeta: { title: "", details: "", posterUrl: null }, // 開催中の大会の情報(この端末だけに保存)
    history: [] // 過去に「終了する」で確定させた大会の記録(戦績集計に使う)
  };

  let persistFailWarned = false;
  function persist(){
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }catch(e){
      // 容量オーバー等で保存に失敗した場合、ポスター画像を除いてでも他の進行状況(参加者・対戦表・結果)は必ず保存する
      try{
        const fallback = {
          ...state,
          tournamentMeta: { ...state.tournamentMeta, posterUrl: null },
          history: state.history.map(h=>({ ...h, posterUrl: null }))
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(fallback));
        console.error('[atsucup] persist: quota exceeded, saved without local poster image', e);
      }catch(e2){
        console.error('[atsucup] persist failed completely:', e2);
        if(!persistFailWarned){
          persistFailWarned = true;
          alert('この端末への保存に失敗しました(空き容量不足の可能性があります)。直前の操作が保存されていない場合があるので、画面を切り替える前に一度リロードして反映されているか確認してください。');
        }
      }
    }
  }

  function restore(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(raw) Object.assign(state, JSON.parse(raw));
    }catch(e){}
    // 以前のバージョンで参加者マスタ(roster)に登録されないまま選択されていた人がいれば、
    // ここで登録者一覧に反映しておく(「選ばれているのに登録者一覧に出ない」不整合の解消)
    const rosterSet = new Set(state.roster);
    state.people.forEach(p=>{ if(!rosterSet.has(p.name)){ state.roster.push(p.name); rosterSet.add(p.name); } });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function roundLabel(total){
    const map = {1:"決勝",2:"準決勝",4:"準々決勝",8:"ベスト16",16:"ベスト32",32:"ベスト64"};
    return map[total] || `${total*2}回戦`;
  }

  function recMapOf(){
    const m = {};
    state.people.forEach(p=> m[p.name]=p.rec);
    return m;
  }

  // データベース未接続でも保存容量の上限を超えないよう、ポスター画像は縮小・圧縮してから保存する
  function resizeImageToDataUrl(file, maxDim, quality){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width >= height){ height = Math.round(height * maxDim / width); width = maxDim; }
          else{ width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (e)=>{ URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  /* ---------- 対戦表の構築(撮影不可同士が当たらないよう配慮) ---------- */
  function nextPow2(n){ let p=1; while(p<n) p*=2; return p; }
  function shuffleArray(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    return arr;
  }

  // pairs a list of names so that two non-recorders are matched together
  // only when unavoidable (more non-recorders than recorders in the pool).
  function pairWithConstraint(list, recMap){
    let Ns = list.filter(n=>!recMap[n]);
    let Rs = list.filter(n=>recMap[n]);
    shuffleArray(Ns); shuffleArray(Rs);
    const pairs = [];
    while(Ns.length && Rs.length){ pairs.push([Ns.pop(), Rs.pop()]); }
    while(Ns.length>=2){ pairs.push([Ns.pop(), Ns.pop()]); }
    while(Rs.length>=2){ pairs.push([Rs.pop(), Rs.pop()]); }
    shuffleArray(pairs);
    return pairs;
  }

  // 参加者リストから、撮影不可同士が当たらないようラウンド1(不戦勝含む)を組む
  function buildRound1(names){
    const recMap = recMapOf();
    const size = nextPow2(names.length);
    const byes = size - names.length;
    let pool = [...names];
    const byePlayers = [];
    for(let i=0;i<byes;i++){
      let idx = pool.findIndex(n=>!recMap[n]);
      if(idx===-1) idx = 0;
      byePlayers.push(pool.splice(idx,1)[0]);
    }
    const pairs = pairWithConstraint(pool, recMap);
    const round1 = [];
    byePlayers.forEach(p=> round1.push({a:p, b:null, winner:p, loser:null, video:""}));
    pairs.forEach(([a,b])=> round1.push({a, b, winner:null, loser:null, video:""}));
    shuffleArray(round1);
    return round1;
  }

  // 手動で決めた順番(manualOrder)を、そのまま前から2人ずつ組む。人数が2の累乗に足りない分は
  // 順番の後ろの人からBYE(不戦勝)になる。
  function buildRound1Manual(orderedNames){
    const size = nextPow2(orderedNames.length);
    const byeCount = size - orderedNames.length;
    const pairNames = orderedNames.slice(0, orderedNames.length - byeCount);
    const byeNames = orderedNames.slice(orderedNames.length - byeCount);
    const round1 = [];
    byeNames.forEach(p=> round1.push({a:p, b:null, winner:p, loser:null, video:""}));
    for(let i=0;i<pairNames.length;i+=2){
      round1.push({a:pairNames[i], b:pairNames[i+1], winner:null, loser:null, video:""});
    }
    return round1;
  }

  function resetDownstream(){
    state.order = [];
    state.remaining = state.people.map(p=>p.name);
    state.matches = state.remaining.length ? [buildRound1(state.remaining)] : [];
    state.thirdPlaceMatch = null;
    state.winnerName = "";
    persist();
  }

  function propagateByes(){
    let changed = true;
    while(changed){
      changed = false;
      for(let r=0; r<state.matches.length; r++){
        const round = state.matches[r];
        const allDecided = round.every(m => m.winner);
        if(allDecided && round.length > 1 && !state.matches[r+1]){
          const winners = round.map(m=>m.winner);
          const recMap = recMapOf();
          // 本物のトーナメント表と同じく、隣り合う勝者同士を固定位置で組むのが基本。
          // ただし両者とも撮影不可になる場合だけ、両方とも撮影OKな隣の試合から1人借りて入れ替える例外処理を行う
          // (それでも解消できない場合はそのまま続行する)
          const pairs = [];
          for(let k=0;k<winners.length;k+=2){ pairs.push([winners[k], winners[k+1]]); }
          for(let k=0;k<pairs.length;k++){
            const [a,b] = pairs[k];
            if(recMap[a] || recMap[b]) continue;
            for(let j=0;j<pairs.length;j++){
              if(j===k) continue;
              const [c,d] = pairs[j];
              if(recMap[c] && recMap[d]){
                pairs[k] = [a, c];
                pairs[j] = [b, d];
                break;
              }
            }
          }
          state.matches[r+1] = pairs.map(([a,b])=>({a,b,winner:null,loser:null,video:""}));
          // 準決勝(2試合)から決勝が生まれるタイミングで、両者の敗者による3位決定戦を自動生成
          if(round.length === 2 && !state.thirdPlaceMatch){
            const [m0, m1] = round;
            if(m0.loser && m1.loser){
              state.thirdPlaceMatch = { a:m0.loser, b:m1.loser, winner:null };
            }
          }
          changed = true;
        } else if(allDecided && round.length === 1){
          state.winnerName = round[0].winner;
        }
      }
    }
  }

  function pickWinner(r, m, side){
    const match = state.matches[r][m];
    const val = side === 'a' ? match.a : match.b;
    if(!val) return;
    const loser = side === 'a' ? match.b : match.a;
    match.winner = val;
    match.loser = loser || null;
    if(state.matches.length > r+1){
      // 既に決着済みの回を選び直した場合、それより先の結果は無効になる
      state.thirdPlaceMatch = null;
      state.winnerName = "";
    }
    state.matches = state.matches.slice(0, r+1);
    if(state.matches[r].length === 1){
      if(match.winner){ state.winnerName = match.winner; }
    }
    propagateByes();
    persist();
  }

  function pickThirdPlaceWinner(side){
    const m = state.thirdPlaceMatch;
    if(!m) return;
    const val = side === 'a' ? m.a : m.b;
    if(!val) return;
    m.winner = val;
    persist();
  }

  // 対戦が始まった後でも参加者名を書き換えられるよう、全ラウンド・3位決定戦・優勝者名・参加者一覧まで
  // 同じ名前をまとめて置き換える(対戦表の接続線は勝者名の一致で辿っているため、一部だけ書き換えると
  // つながりが壊れてしまう)
  function renameParticipant(oldName, newName){
    if(!oldName || !newName || oldName === newName) return;
    const swap = v => v === oldName ? newName : v;
    state.matches.forEach(round=>{
      round.forEach(m=>{
        m.a = swap(m.a); m.b = swap(m.b);
        m.winner = swap(m.winner); m.loser = swap(m.loser);
      });
    });
    if(state.thirdPlaceMatch){
      const tp = state.thirdPlaceMatch;
      tp.a = swap(tp.a); tp.b = swap(tp.b); tp.winner = swap(tp.winner);
    }
    state.winnerName = swap(state.winnerName);
    state.order = state.order.map(swap);
    const person = state.people.find(p=>p.name===oldName);
    if(person) person.name = newName;
    const rIdx = state.roster.indexOf(oldName);
    if(rIdx>=0) state.roster[rIdx] = newName;
    persist();
  }

  // ラウンド1がまだ1試合も決着していない(=組み合わせをいつでも自由に組み替えられる)かどうか
  function bracketNotStarted(){
    if(!state.matches.length) return true;
    return !state.matches[0].some(m => m.b !== null && m.winner);
  }

  // ルーレットでまだ引かれていない名前は対戦表上でも隠す(演出用)
  function isRevealed(name){
    if(name == null) return true;
    return state.remaining.length === 0 || state.order.includes(name);
  }

  function forcedPairsList(){
    const recMap = recMapOf();
    const forced = [];
    state.matches.forEach((round, r)=>{
      round.forEach(m=>{
        if(m.a && m.b && isRevealed(m.a) && isRevealed(m.b) && !recMap[m.a] && !recMap[m.b]){
          forced.push({r, a:m.a, b:m.b});
        }
      });
    });
    return forced;
  }

  /* ---------- 大会の順位計算(過去の大会・戦績で共通利用) ---------- */
  // 大会の最終結果(matches/thirdPlaceMatch/championName)から、参加者ごとの順位を割り出す
  function computePlacements(entry){
    const result = {};
    const matches = entry.matches || [];
    const champion = entry.championName;
    // 決勝(最終ラウンドが1試合だけ)が優勝者確定まで終わっている場合のみ準優勝を確定させる。
    // 途中終了した大会では最後の配列要素が準決勝以前のこともあるため、誤って準優勝扱いにしない。
    const finalRound = matches.length ? matches[matches.length-1] : null;
    const runnerUp = (champion && finalRound && finalRound.length===1 && finalRound[0]) ? finalRound[0].loser : null;
    const thirdName = entry.thirdPlaceMatch ? entry.thirdPlaceMatch.winner : null;
    const fourthName = (entry.thirdPlaceMatch && thirdName) ? (entry.thirdPlaceMatch.a===thirdName ? entry.thirdPlaceMatch.b : entry.thirdPlaceMatch.a) : null;
    (entry.participants||[]).forEach(p=>{
      let place=null, label='参加(結果未確定)';
      if(champion && p.name===champion){ place=1; label='🥇 優勝'; }
      else if(runnerUp && p.name===runnerUp){ place=2; label='🥈 準優勝'; }
      else if(thirdName && p.name===thirdName){ place=3; label='🥉 3位'; }
      else if(fourthName && p.name===fourthName){ place=4; label='4位'; }
      else{
        let roundIdx=-1;
        matches.forEach((round,r)=>{ round.forEach(m=>{ if(m.loser===p.name) roundIdx=Math.max(roundIdx,r); }); });
        if(roundIdx>=0){ label = roundLabel(matches[roundIdx].length)+'敗退'; }
      }
      result[p.name] = {place, label};
    });
    return result;
  }

  // 過去の大会(state.history)に加え、優勝が決まった今回の大会もあわせて集計対象にする
  function allFinishedEntries(){
    const list = state.history.slice();
    if(state.tournamentMeta && state.tournamentMeta.title && state.winnerName){
      list.push({
        title: state.tournamentMeta.title,
        championName: state.winnerName,
        matches: state.matches,
        thirdPlaceMatch: state.thirdPlaceMatch,
        participants: state.people
      });
    }
    return list;
  }

  /* ---------- 大会のライフサイクル ---------- */
  // 今の大会(未終了でも)を「過去の大会」として記録に残す
  function archiveCurrentTournament(){
    state.history.push({
      id: 'h'+Date.now()+Math.random().toString(36).slice(2,8),
      title: state.tournamentMeta.title,
      details: state.tournamentMeta.details,
      posterUrl: state.tournamentMeta.posterUrl,
      createdAt: new Date().toISOString(),
      finished: !!state.winnerName,
      championName: state.winnerName || null,
      matches: JSON.parse(JSON.stringify(state.matches)),
      thirdPlaceMatch: state.thirdPlaceMatch ? JSON.parse(JSON.stringify(state.thirdPlaceMatch)) : null,
      participants: state.people.map(p=>({...p}))
    });
  }

  // 今の大会を終わらせて「過去の大会」に保存し、開催中を空の状態に戻す(優勝者が未定でも終了できる)
  function endCurrentTournament(){
    if(state.tournamentMeta && state.tournamentMeta.title){
      archiveCurrentTournament();
    }
    state.tournamentMeta = { title:"", details:"", posterUrl:null };
    resetDownstream();
  }

  /* ---------- 歴代優勝者カード ---------- */
  const THEMES = {
    ember:{bg1:"#3a0f02",bg2:"#0a0603",ring:"#e8b34c",accent:"#ff6a2b",glow:"rgba(255,106,43,.55)"},
    ice:{bg1:"#04213a",bg2:"#040912",ring:"#bfe9ff",accent:"#4fd1e8",glow:"rgba(79,209,232,.55)"},
    forest:{bg1:"#0c3a1a",bg2:"#050c07",ring:"#a8e83b",accent:"#2bc97a",glow:"rgba(43,201,122,.5)"}
  };
  const THEME_KEYS = Object.keys(THEMES);
  // 大会名から毎回同じテーマ色になるよう決定的に選ぶ(見た目に変化を持たせるため)
  function themeForTitle(title){
    let h = 0;
    for(let i=0;i<title.length;i++) h = (h*31 + title.charCodeAt(i)) >>> 0;
    return THEMES[THEME_KEYS[h % THEME_KEYS.length]];
  }
  function drawCard(canvas, title, name, theme){
    const cctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    cctx.clearRect(0,0,W,H);
    const grad = cctx.createRadialGradient(W/2,H*0.38,40,W/2,H*0.38,W*0.75);
    grad.addColorStop(0, theme.bg1); grad.addColorStop(1, theme.bg2);
    cctx.fillStyle = grad; cctx.fillRect(0,0,W,H);
    cctx.save(); cctx.translate(W/2,H*0.38); cctx.globalAlpha = 0.25;
    for(let i=0;i<28;i++){
      cctx.rotate(Math.PI*2/28);
      cctx.beginPath(); cctx.moveTo(0,0); cctx.lineTo(W*0.7,-14); cctx.lineTo(W*0.7,14); cctx.closePath();
      cctx.fillStyle = theme.accent; cctx.fill();
    }
    cctx.restore(); cctx.globalAlpha = 1;
    const circ = cctx.createRadialGradient(W/2,H*0.42,W*0.1,W/2,H*0.42,W*0.62);
    circ.addColorStop(0,"rgba(0,0,0,0)"); circ.addColorStop(1,"rgba(0,0,0,0.55)");
    cctx.fillStyle = circ; cctx.fillRect(0,0,W,H);
    cctx.strokeStyle = theme.ring; cctx.lineWidth = 10;
    cctx.beginPath(); cctx.arc(W/2,H/2,W/2-10,0,Math.PI*2); cctx.stroke();
    cctx.strokeStyle = "rgba(255,255,255,.25)"; cctx.lineWidth = 2;
    cctx.beginPath(); cctx.arc(W/2,H/2,W/2-26,0,Math.PI*2); cctx.stroke();
    cctx.font = "80px serif"; cctx.fillStyle = theme.ring; cctx.textAlign = "center";
    cctx.shadowColor = theme.glow; cctx.shadowBlur = 30;
    cctx.fillText("👑", W/2, H*0.30); cctx.shadowBlur = 0;
    cctx.font = "600 22px 'Noto Sans JP', sans-serif"; cctx.fillStyle = "rgba(255,255,255,.75)";
    cctx.letterSpacing = "6px"; cctx.fillText("W I N N E R", W/2, H*0.40); cctx.letterSpacing = "0px";
    let fontSize = 92;
    cctx.font = `900 ${fontSize}px 'Cinzel', 'Noto Serif JP', serif`;
    while(cctx.measureText(name).width > W*0.78 && fontSize > 40){
      fontSize -= 4; cctx.font = `900 ${fontSize}px 'Cinzel', 'Noto Serif JP', serif`;
    }
    cctx.fillStyle = "#fff8ec"; cctx.shadowColor = theme.glow; cctx.shadowBlur = 36;
    cctx.fillText(name, W/2, H*0.56); cctx.shadowBlur = 0;
    cctx.font = "700 26px 'Noto Serif JP', serif"; cctx.fillStyle = theme.ring;
    cctx.fillText(`優勝者 ${name}`, W/2, H*0.88);
    let titleSize = 15;
    cctx.font = `500 ${titleSize}px 'JetBrains Mono', monospace`;
    while(cctx.measureText(title).width > W*0.8 && titleSize > 9){
      titleSize -= 1; cctx.font = `500 ${titleSize}px 'JetBrains Mono', monospace`;
    }
    cctx.fillStyle = "rgba(255,255,255,.5)";
    cctx.fillText(title, W/2, H*0.93);
  }
  async function generateAndSaveCard(canvas, title, name){
    if(document.fonts && document.fonts.ready){ await document.fonts.ready; }
    drawCard(canvas, title, name, themeForTitle(title));
    canvas.style.display = "block";
    const link = document.createElement("a");
    link.download = `atsucup_winner_${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  // 優勝が確定した過去の大会だけを、新しい順に一覧表示する
  function championEntries(){
    return state.history.filter(h=>h.championName).slice().reverse();
  }

  /* ---------- 対戦動画 ---------- */
  function ytId(url){
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
    return m ? m[1] : null;
  }
  function hostFromUrl(u){ try{ return new URL(u).hostname.replace('www.',''); }catch(e){ return 'link'; } }
  function videoEmbedHtml(url){
    if(!url) return '';
    const yid = ytId(url);
    if(yid){ return `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${yid}" allowfullscreen loading="lazy"></iframe></div>`; }
    if(/\.(mp4|webm|mov)(\?|$)/i.test(url)){ return `<div class="video-embed"><video controls preload="metadata" src="${url}"></video></div>`; }
    return `<a class="video-link-btn" href="${url}" target="_blank" rel="noopener">🔗 動画を開く (${hostFromUrl(url)})</a>`;
  }
  function matchesToPlayable(matches){
    const list = [];
    (matches||[]).forEach((round, r)=>{
      round.forEach((m,i)=>{
        if(m.a && m.b) list.push({r,i,m});
      });
    });
    return list;
  }
  // 「開催中の大会」と「過去の大会(state.history)」をまとめて選択肢にする
  function videoTournamentList(){
    const list = [];
    if(state.tournamentMeta && state.tournamentMeta.title){
      list.push({ key:'current', title: state.tournamentMeta.title, matches: state.matches });
    }
    state.history.slice().reverse().forEach(h=>{
      list.push({ key:h.id, title: h.title, matches: h.matches || [] });
    });
    return list;
  }

  return {
    state, STORE_KEY, persist, restore, escapeHtml, roundLabel, recMapOf, resizeImageToDataUrl,
    nextPow2, shuffleArray, pairWithConstraint, buildRound1, buildRound1Manual, resetDownstream,
    propagateByes, pickWinner, pickThirdPlaceWinner, renameParticipant, bracketNotStarted, isRevealed, forcedPairsList,
    computePlacements, allFinishedEntries, archiveCurrentTournament, endCurrentTournament,
    THEMES, themeForTitle, drawCard, generateAndSaveCard, championEntries,
    ytId, hostFromUrl, videoEmbedHtml, matchesToPlayable, videoTournamentList
  };
})();
