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

  // シード(不戦勝)は勝者がその場で確定するため、隣り合う2つのシードが両方とも撮影不可だと
  // 次のラウンドで撮影不可同士が対戦することが「その時点で」わかってしまう。
  // 実際の対戦(bが決まっている試合)には手を触れず、シード同士の並び順だけを入れ替えて事前に回避する。
  function avoidByeCameraCollision(round1, recMap){
    for(let k=0;k+1<round1.length;k+=2){
      const m0 = round1[k], m1 = round1[k+1];
      if(!m0 || !m1 || m0.b !== null || m1.b !== null) continue;
      if(recMap[m0.a] || recMap[m1.a]) continue;
      let bestJ = -1, bestDist = Infinity;
      for(let j=0;j+1<round1.length;j+=2){
        if(j===k) continue;
        const n0 = round1[j], n1 = round1[j+1];
        if(!n0 || !n1 || n0.b !== null || n1.b !== null) continue;
        if(recMap[n0.a] && recMap[n1.a]){
          const dist = Math.abs(j-k);
          if(dist < bestDist){ bestDist = dist; bestJ = j; }
        }
      }
      if(bestJ>=0){
        const donor = round1[bestJ+1];
        const tmp = m1.a;
        m1.a = donor.a; m1.winner = donor.a;
        donor.a = tmp; donor.winner = tmp;
      }
    }
    return round1;
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
    return avoidByeCameraCollision(round1, recMap);
  }

  // 手動で決めた順番(orderedNames)を、そのまま前から2人ずつ組む。人数が2の累乗に足りない分はBYE(不戦勝)になる。
  // seedNamesを指定すると、その人たちを明示的にBYE(シード)として扱う(手動で対戦相手のいない位置を選べる)。
  // 指定がなければ、従来通り順番の後ろの人から自動でBYEになる。
  function buildRound1Manual(orderedNames, seedNames){
    const size = nextPow2(orderedNames.length);
    const byeCount = size - orderedNames.length;
    let pairNames, byeNames;
    if(seedNames && seedNames.length){
      byeNames = orderedNames.filter(n=>seedNames.includes(n));
      pairNames = orderedNames.filter(n=>!seedNames.includes(n));
    }else{
      pairNames = orderedNames.slice(0, orderedNames.length - byeCount);
      byeNames = orderedNames.slice(orderedNames.length - byeCount);
    }
    const round1 = [];
    byeNames.forEach(p=> round1.push({a:p, b:null, winner:p, loser:null, video:""}));
    for(let i=0;i<pairNames.length;i+=2){
      round1.push({a:pairNames[i], b:pairNames[i+1], winner:null, loser:null, video:""});
    }
    return avoidByeCameraCollision(round1, recMapOf());
  }

  function resetDownstream(){
    state.order = [];
    state.remaining = state.people.map(p=>p.name);
    state.matches = state.remaining.length ? [buildRound1(state.remaining)] : [];
    state.thirdPlaceMatch = null;
    state.winnerName = "";
    persist();
  }

  // ラウンド0(1回戦)の元々の参加者だけから、各ラウンド・各カードが「そのブロックには撮影不可の人が
  // 誰1人としていない(=誰が勝ち上がってきても絶対に両者撮影OK確定)」かどうかを、実際の勝敗によらず
  // 静的に判定する。levels[r][k]===trueなら、そのカードは入れ替え(撮影不可回避)の対象に将来も
  // 絶対にならないため、両方の勝者が決まり次第すぐに確定してよい。
  function computeNGFreeLevels(recMap){
    const round0 = state.matches[0];
    if(!round0 || !round0.length) return [];
    let level = round0.map(m=>{
      const aOK = !m.a || !!recMap[m.a];
      const bOK = !m.b || !!recMap[m.b]; // シード(不戦勝)側は常にOK扱い
      return aOK && bOK;
    });
    const levels = [level];
    while(level.length > 1){
      const next = [];
      for(let i=0;i<level.length;i+=2){ next.push(!!(level[i] && level[i+1])); }
      levels.push(next);
      level = next;
    }
    return levels;
  }

  // 同じラウンドの中で、これより後の結果に一切影響されない(=入れ替えの対象に絶対ならない)場合は、
  // ラウンド全体の決着を待たずにその場で次のラウンドのカードを確定させる。
  // 「片方だけ撮影不可」の組み合わせや、その系統に撮影不可の人が誰もいないブロックは、撮影不可同士の
  // 入れ替え判定の対象に絶対ならないため、いつ確定させても結果は変わらない。
  function propagateByes(){
    let changed = true;
    while(changed){
      changed = false;
      const recMap = recMapOf();
      const ngFreeLevels = computeNGFreeLevels(recMap);
      for(let r=0; r<state.matches.length; r++){
        const round = state.matches[r];
        if(round.length === 1){
          if(round[0].winner){ state.winnerName = round[0].winner; }
          continue;
        }
        if(round.length < 2) continue;
        const matchCount = round.length / 2;

        if(!state.matches[r+1]){
          state.matches[r+1] = Array.from({length: matchCount}, () => ({a:null, b:null, winner:null, loser:null, video:""}));
        }
        const nextRound = state.matches[r+1];
        if(nextRound.length !== matchCount) continue; // 想定外の形は触らない(安全策)
        const nextLevel = ngFreeLevels[r+1];

        // 隣り合う2試合の勝者が両方決まった時点で、まだ確定していないカードだけを埋める。
        // 両者とも撮影OK、または両者とも撮影不可の場合だけは、入れ替えの候補になり得るため、
        // ラウンド全体の決着がつくまで保留する(pendingIdxに集める)。
        const pendingIdx = [];
        for(let k=0;k<matchCount;k++){
          if(nextRound[k].a !== null) continue; // 既に確定済み
          const m0 = round[2*k], m1 = round[2*k+1];
          if(!m0.winner || !m1.winner) continue; // まだ両方決まっていない
          const a = m0.winner, b = m1.winner;
          const guaranteedSafe = (nextLevel && nextLevel[k]) || (!!recMap[a] !== !!recMap[b]);
          if(guaranteedSafe){
            // その系統に撮影不可の人がそもそもいない、または片方だけ撮影OK
            // → 入れ替えの対象に絶対ならないので即確定
            nextRound[k] = {a, b, winner:null, loser:null, video:""};
            changed = true;
          }else{
            pendingIdx.push(k);
          }
        }

        // 保留中のカードが残っていても、ラウンド全体の決着がついていれば、これまで通り
        // 一番近い組同士で入れ替える処理をまとめて行い、確定させる。
        const allDecided = round.every(m => m.winner);
        if(allDecided && pendingIdx.length){
          const pairs = pendingIdx.map(k => [round[2*k].winner, round[2*k+1].winner]);
          for(let ii=0; ii<pairs.length; ii++){
            const [a,b] = pairs[ii];
            if(recMap[a] || recMap[b]) continue;
            let bestJJ = -1, bestDist = Infinity;
            for(let jj=0; jj<pairs.length; jj++){
              if(jj===ii) continue;
              const [c,d] = pairs[jj];
              if(recMap[c] && recMap[d]){
                const dist = Math.abs(pendingIdx[jj]-pendingIdx[ii]);
                if(dist < bestDist){ bestDist = dist; bestJJ = jj; }
              }
            }
            if(bestJJ>=0){
              const [c,d] = pairs[bestJJ];
              pairs[ii] = [a, c];
              pairs[bestJJ] = [b, d];
            }
          }
          pendingIdx.forEach((k, idx)=>{
            const [a,b] = pairs[idx];
            nextRound[k] = {a, b, winner:null, loser:null, video:""};
          });
          changed = true;
        }

        // 準決勝(2試合)の両者の勝敗が決まった時点で、両者の敗者による3位決定戦を自動生成
        if(round.length === 2 && !state.thirdPlaceMatch){
          const [m0, m1] = round;
          if(m0.loser && m1.loser){
            state.thirdPlaceMatch = { a:m0.loser, b:m1.loser, winner:null };
          }
        }
      }
    }
  }

  // r回戦より先に、実際の対戦カードや結果が1つでも存在するかどうか
  // (まだ何も確定していない空枠だけなら、変更しても実質的に失われるものはない)
  function hasDownstreamProgress(r){
    for(let i=r+1; i<state.matches.length; i++){
      if(state.matches[i].some(m => m.a !== null)) return true;
    }
    if(state.thirdPlaceMatch) return true;
    return false;
  }

  function pickWinner(r, m, side){
    const match = state.matches[r][m];
    const val = side === 'a' ? match.a : match.b;
    if(!val) return;
    // 1回戦を残したまま2回戦以降を先に消化できるようにするため、次のラウンドは
    // ラウンド全体の決着を待たずに組み上がることがある。そのため、ここで無効にすべきなのは
    // 「既に決まっていた勝敗を選び直した」場合だけであり、初めて決める場合は他の(無関係な)
    // 先のラウンドの結果まで巻き込んで消してしまわないようにする。
    const isRepick = !!match.winner && match.winner !== val;
    const loser = side === 'a' ? match.b : match.a;
    match.winner = val;
    match.loser = loser || null;
    if(isRepick){
      state.matches = state.matches.slice(0, r+1);
      state.thirdPlaceMatch = null;
      state.winnerName = "";
    }
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

  // 大会途中で参加者が増えた場合、空いているBYE(不戦勝)枠に新しい参加者を入れて実際の対戦に変える。
  // それより先のラウンドは(再選択時と同じく)いったん無効になり、決着がつき次第また自動で組み直される。
  function addChallengerToBye(r, m, name){
    const match = state.matches[r] && state.matches[r][m];
    if(!match || match.b !== null) return;
    name = (name||'').trim();
    if(!name || name === match.a) return;
    match.b = name;
    match.winner = null;
    match.loser = null;
    if(!state.roster.includes(name)) state.roster.push(name);
    if(!state.people.some(p=>p.name===name)) state.people.push({name, rec:true});
    state.matches = state.matches.slice(0, r+1);
    state.thirdPlaceMatch = null;
    state.winnerName = "";
    propagateByes();
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
      let place=null, label='参加(結果未確定)', roundIdx=-1;
      if(champion && p.name===champion){ place=1; label='🥇 優勝'; }
      else if(runnerUp && p.name===runnerUp){ place=2; label='🥈 準優勝'; }
      else if(thirdName && p.name===thirdName){ place=3; label='🥉 3位'; }
      else if(fourthName && p.name===fourthName){ place=4; label='4位'; }
      else{
        matches.forEach((round,r)=>{ round.forEach(m=>{ if(m.loser===p.name) roundIdx=Math.max(roundIdx,r); }); });
        if(roundIdx>=0){ label = roundLabel(matches[roundIdx].length)+'敗退'; }
      }
      result[p.name] = {place, label, roundIdx};
    });
    return result;
  }

  // 大会ごとのポイントを計算する: 実際の対戦での勝利(BYEによる不戦勝は含まない)1回につき1P。
  // これに加えて順位ボーナス(優勝10P・準優勝7P・3位5P・4位3P)を上乗せする。
  function computeTournamentPoints(entry){
    const points = {};
    (entry.participants||[]).forEach(p=>{ points[p.name] = 0; });
    (entry.matches||[]).forEach(round=>{
      round.forEach(m=>{
        if(m.a && m.b && m.winner){ points[m.winner] = (points[m.winner]||0) + 1; }
      });
    });
    const tp = entry.thirdPlaceMatch;
    if(tp && tp.a && tp.b && tp.winner){ points[tp.winner] = (points[tp.winner]||0) + 1; }
    const placements = computePlacements(entry);
    const bonusByPlace = {1:10, 2:7, 3:5, 4:3};
    Object.keys(placements).forEach(name=>{
      const bonus = bonusByPlace[placements[name].place];
      if(bonus){ points[name] = (points[name]||0) + bonus; }
    });
    return points;
  }

  // 登録者全員(まだ大会に出ていない人も含む)を対象に、通算ポイント・優勝/準優勝/3位/4位の回数を集計する
  function computeAllTimeStats(){
    const stats = {};
    const ensure = name=>{
      if(!stats[name]) stats[name] = {name, points:0, p1:0, p2:0, p3:0, p4:0, played:0};
      return stats[name];
    };
    state.roster.forEach(name=> ensure(name));
    allFinishedEntries().forEach(entry=>{
      const pts = computeTournamentPoints(entry);
      const placements = computePlacements(entry);
      (entry.participants||[]).forEach(p=>{
        const s = ensure(p.name);
        s.played += 1;
        s.points += (pts[p.name]||0);
        const place = placements[p.name] ? placements[p.name].place : null;
        if(place===1) s.p1++; else if(place===2) s.p2++; else if(place===3) s.p3++; else if(place===4) s.p4++;
      });
    });
    return Object.values(stats);
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

  /* ---------- 更新通知バナー(あつ杯の全ページ共通、モンヒロと同じ方式) ---------- */
  // 更新のたびに手動で書き換える(日付+時刻、JST) ※version.jsonのbuildも同じ値に合わせること
  const BUILD_DATE = "2026-07-24 01:10";
  function initUpdateBanner(){
    if(typeof document === 'undefined' || !document.body) return;
    if(document.getElementById('atsucupUpdateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'atsucupUpdateBanner';
    banner.className = 'atsucup-update-banner';
    banner.style.display = 'none';
    banner.innerHTML = '<button id="atsucupUpdateReloadBtn">⟳ 新しいバージョンがあります。タップして更新</button>';
    document.body.appendChild(banner);
    document.getElementById('atsucupUpdateReloadBtn').addEventListener('click', ()=> location.reload());
    function checkVersion(){
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res=> res.ok ? res.json() : null)
        .then(data=>{
          if(data && data.build && data.build !== BUILD_DATE){ banner.style.display = 'flex'; }
        })
        .catch(()=>{});
    }
    checkVersion();
    document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') checkVersion(); });
    setInterval(checkVersion, 5 * 60 * 1000);
  }
  if(typeof document !== 'undefined'){
    if(document.body) initUpdateBanner();
    else document.addEventListener('DOMContentLoaded', initUpdateBanner);
  }

  return {
    state, STORE_KEY, persist, restore, escapeHtml, roundLabel, recMapOf, resizeImageToDataUrl,
    nextPow2, shuffleArray, pairWithConstraint, buildRound1, buildRound1Manual, resetDownstream,
    propagateByes, pickWinner, pickThirdPlaceWinner, renameParticipant, addChallengerToBye, bracketNotStarted, isRevealed, forcedPairsList, hasDownstreamProgress,
    computePlacements, computeTournamentPoints, computeAllTimeStats, allFinishedEntries, archiveCurrentTournament, endCurrentTournament,
    THEMES, themeForTitle, drawCard, generateAndSaveCard, championEntries,
    ytId, hostFromUrl, videoEmbedHtml, matchesToPlayable, videoTournamentList
  };
})();
