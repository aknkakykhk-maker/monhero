// バトル画面の描き直しを部品ごとに数える計測用フック。ページ読み込み前に差し込み、React の commit ごとに描き直された部品を数える(render-count-run.js が使う)。
(() => {
  const C = window.__rc = { commits: 0, names: {}, battle: 0, on: false };
  let prev = new WeakSet();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber:true, renderers:new Map(), inject(){return 1}, onScheduleFiberRoot(){}, onCommitFiberUnmount(){}, checkDCE(){},
    onCommitFiberRoot(id, root){ C.commits++; const cur = new WeakSet(); const st=[root.current];
      while(st.length){ const x=st.pop(); if(!x) continue; cur.add(x);
        if (C.on && typeof x.type==='function' && x.alternate && prev.has(x.alternate) && !prev.has(x) && (x.memoizedProps!==x.alternate.memoizedProps || x.memoizedState!==x.alternate.memoizedState)) { const n=x.type.name||'(anon)'; C.names[n]=(C.names[n]||0)+1; if(n==='BattleScreen') C.battle++; }
        if(x.sibling) st.push(x.sibling); if(x.child) st.push(x.child); }
      prev = cur; } };
})();
