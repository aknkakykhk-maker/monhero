function MonsterAttackPreviewScreen({ dexMonsterId, dexAttackPreview, unlockedMonsterIds, getAtkSkillLevels, getUniqueSkillLevels, onMissing, onBackToDetail, onStopPreview, onPlayPreview }) {
      const monsters=dexMonsterList();
      const mon=monsters.find(m=>m.id===dexMonsterId)||null;
      if(!mon||!unlockedMonsterIds.includes(mon.id)){ onMissing(); return null; }
      const atkMotion=mon.atkMotion||'default';
      const playing=dexAttackPreview?.monsterId===mon.id?dexAttackPreview:null;
      const previewAnim=playing?playing.anim:null;
      const playingKind=playing?playing.kind:null;
      const backToDetail=()=>{onStopPreview();onBackToDetail();};
      // 再生そのもの(コマ送りのタイマーと世代管理)は MonsterHeroGame 側に残してある。
      // 進行中の setTimeout を画面のライフサイクルで止めると、演出が途中で固まるため
      const playAttackPreview=async(kind)=>{
        if(playingKind)return;
        await onPlayPreview(mon,kind,atkMotion);
      };
      const kindButton=(kind,label)=>(
        <button key={kind} type="button" data-attack-preview-play={kind} onClick={()=>{Audio_.se.tap();playAttackPreview(kind);}} disabled={!!playingKind}
          className={`flex-1 min-w-0 min-h-[48px] rounded-2xl border-2 px-2 text-[12px] font-black active:scale-95 disabled:opacity-45 ${playingKind===kind?'border-cyan-200 bg-cyan-700 text-white':'border-cyan-400/50 bg-slate-900 text-cyan-100'}`}>
          {playingKind===kind?'再生中…':label}
        </button>
      );
      return <main data-mh-screen className="flex-1 flex flex-col h-full min-h-0" style={{paddingTop:'calc(0.5rem + env(safe-area-inset-top))',paddingBottom:'calc(0.5rem + env(safe-area-inset-bottom))'}}>
        <div className="shrink-0 flex items-center gap-2 px-3">
          <button onClick={backToDetail} className="p-3 text-slate-400 active:scale-90" aria-label="図鑑の詳細へ戻る"><ArrowLeft size={20}/></button>
          <div className="min-w-0">
            <small className="block text-[8px] font-black text-cyan-300 uppercase tracking-[0.2em]">Attack Action</small>
            <h2 className="text-base font-black text-amber-100 truncate">{mon.name}の攻撃アクション</h2>
          </div>
        </div>
        {/* 演出の舞台。立ち絵は下寄りに置き、音符や光が上へ抜けるぶんの余白を上に残す */}
        <div data-attack-preview-stage className="relative flex-1 min-h-0 overflow-hidden mx-3 mt-2 rounded-3xl border-2 border-cyan-500/30 bg-gradient-to-b from-slate-900 to-slate-950">
          {/* 立ち絵も演出も、まとめて少しだけ拡大して見せる(演出の移動量はpx固定なので、
              ここを大きくしないと図鑑の枠と同じ大きさのままになる)。
              拡大の基準は足元にして、伸びるぶんはすべて上の余白へ向ける */}
          <div data-attack-preview-art className="absolute left-1/2" style={{bottom:'11%',width:'clamp(132px, 44vw, 184px)',height:'clamp(132px, 44vw, 184px)',transform:'translateX(-50%) scale(1.15)',transformOrigin:'bottom center'}}>
            <BattleAttackMotionPreview image={<DexMonsterArt mon={mon} alt={mon.name}/>} anim={previewAnim}/>
          </div>
          <span className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-bold text-slate-500">バトルと同じ演出です（ダメージや性能は変わりません）</span>
        </div>
        <div className="shrink-0 px-3 pt-2">
          <div className="w-full max-w-md mx-auto flex gap-2">
            {kindButton('normal','通常攻撃')}
            {kindButton('unique','固有技')}
          </div>
        </div>
      </main>;}

function MonsterDexScreen({ dexLineageFilter, unlockedMonsterIds, onSelectLineage, onOpenDetail, onBackToManagement }) {
      const monsters=dexMonsterList();
      const unlockedCount=monsters.filter(mon=>unlockedMonsterIds.includes(mon.id)).length;
      const filters=dexMainLineages();
      const shown=dexLineageFilter==='all'?monsters:monsters.filter(mon=>monsterLineageOf(mon.id).main.id===dexLineageFilter);
      const chipClass=(on)=>`shrink-0 min-h-[40px] px-3 rounded-full border text-[10px] font-black whitespace-nowrap active:scale-95 ${on?'bg-amber-600 border-amber-300 text-white':'bg-slate-900 border-amber-500/30 text-amber-200/80'}`;
      return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button onClick={onBackToManagement} className="p-3 text-slate-400 active:scale-90" aria-label="M/B管理へ戻る"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-black italic text-amber-300 uppercase tracking-widest">モンスター図鑑</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="monsterDex"/></div>
        <div data-dex-count className="shrink-0 w-full max-w-md mx-auto mb-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/70 to-orange-950/50 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest shrink-0">図鑑登録数</span>
          <span className="text-[15px] font-mono font-black text-amber-100 tabular-nums">{unlockedCount}<span className="text-slate-400 text-[10px]"> / {monsters.length}</span></span>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2 flex gap-1.5 overflow-x-auto mh-scroll pb-1" role="tablist" aria-label="主血統でしぼりこむ">
          <button type="button" role="tab" aria-selected={dexLineageFilter==='all'} onClick={()=>onSelectLineage('all')} className={chipClass(dexLineageFilter==='all')}>すべて</button>
          {filters.map(lineage=>(
            <button key={lineage.id} type="button" role="tab" aria-selected={dexLineageFilter===lineage.id} onClick={()=>onSelectLineage(lineage.id)} className={chipClass(dexLineageFilter===lineage.id)}>{lineage.name}</button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll w-full max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-2.5 pb-4">
            {shown.map(mon=>{
              const unlocked=unlockedMonsterIds.includes(mon.id);
              const iconSrc=mon.iconUrl||mon.imgUrl||'';
              const category=monsterCategoryOf(mon.id);
              return (
                <button key={mon.id} type="button" data-dex-entry aria-label={unlocked?`${mon.name}の図鑑を見る`:'まだ出会っていないモンスター'}
                  onClick={()=>onOpenDetail(mon.id)}
                  className="w-full min-h-[124px] rounded-2xl border-2 border-amber-600/30 bg-gradient-to-b from-amber-950/40 to-slate-900 p-2 flex flex-col items-center gap-1 active:scale-95 select-none">
                  {/* 血統チップと同じ理由。丸く切り抜くと円の外側へかかる部分が切れるので、
                      少し縮めて中央へ置き、全身が円の中へ収まるようにする */}
                  <DexMonsterIcon src={iconSrc} hidden={!unlocked}/>
                  <div className="text-[10px] font-black truncate w-full text-center leading-tight text-amber-100">{unlocked?mon.name:'？？？'}</div>
                  <div className="text-[8px] font-black text-amber-400/80 leading-tight">{unlocked?monsterCategoryName(category):'未発見'}</div>
                </button>
              );
            })}
          </div>
          {shown.length===0&&<div className="text-[10px] text-slate-400 font-bold text-center py-6">この血統のモンスターはまだいません。</div>}
        </div>
      </div>);}

function MonsterDexDetailScreen({ dexMonsterId, dexTab, unlockedMonsterIds, getAtkSkillLevels, getUniqueSkillLevels, swipeRef, onMissing, onBackToList, onOpenAttackPreview, onSelectMonster, onSelectTab, onStopPreview }) {
      const monsters=dexMonsterList();
      const index=monsters.findIndex(m=>m.id===dexMonsterId);
      const mon=index>=0?monsters[index]:null;
      if(!mon){ onMissing(); return null; }
      const unlocked=unlockedMonsterIds.includes(mon.id);
      const {main,sub}=monsterLineageOf(mon.id);
      const category=monsterCategoryOf(mon.id);
      const categoryClass=category==='rare'?'bg-amber-600 text-white':category==='pure'?'bg-emerald-700 text-white':'bg-indigo-700 text-white';
      // 攻撃演出そのものは MONSTER_ATTACK_PREVIEW で再生する。ここでは立ち絵を静止で見せ、
      // 途中で移動・離脱したときに向こうの再生が残らないよう止める口だけ持つ
      const stopDexAttackPreview=onStopPreview;
      const go=(delta)=>{ stopDexAttackPreview(); const next=monsters[(index+delta+monsters.length)%monsters.length]; if(!next) return; onSelectMonster(next.id); Audio_.se.tap(); };
      // 血統1つぶんの見せ方。絵があるときだけ絵を出し、無い血統は名前だけにする
      const lineageChip=(lineage)=><DexLineageChip lineage={lineage} iconUrl={lineageIconUrl(lineage)}/>;
      const tabs=[['basic','基本'],['stats','能力'],['skills','技']];
      const tab=tabs.some(([id])=>id===dexTab)?dexTab:'basic';
      // 図鑑の1行。値は左揃えにする。
      // 以前は text-right だったが、折り返すたびに行頭がずれて読みにくかった
      // (2026-09-08・ユーザー指摘「図鑑説明の文字の並びが悪い」。ザンの特性の効果は
      //  最終行が「撃」1文字だけになっていた)。1行に収まる短い値は flex の justify-between が
      //  右端へ寄せるので、text-right を外しても見た目は1pxも変わらない(実測で確認済み)。
      // 「特性の効果」のように必ず長くなる値だけは block:true でラベルを上に置き、
      // 幅いっぱいを使って行数を減らす(文字数で機械的に決めると、端末の幅しだいで
      //  同じ行の見た目が入れ替わってしまうため、呼ぶ側が明示する)
      const row=(label,value,{block=false}={})=>(
        block
          ? (
            <div className="border-b border-amber-500/15 py-1.5 last:border-b-0">
              <span className="block text-[10px] font-black text-amber-300/90">{label}</span>
              <span className="mt-1 block text-[11px] font-bold leading-relaxed text-white break-words">{value}</span>
            </div>
          )
          : (
            <div className="flex items-start justify-between gap-3 border-b border-amber-500/15 py-1.5 last:border-b-0">
              <span className="text-[10px] font-black text-amber-300/90 shrink-0">{label}</span>
              <span className="text-[11px] font-bold text-white min-w-0 break-words">{value}</span>
            </div>
          )
      );
      const skillPills=(list,accent)=>(
        <div className="grid grid-cols-2 gap-1.5">
          {list.map(skill=>(
            <div key={skill.lvl} className={`min-w-0 rounded-xl border px-2 py-1.5 ${accent}`}>
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span className="text-[10px] font-black text-white truncate min-w-0">{skill.name}</span>
                <span className="text-[8px] font-mono font-black text-amber-300 shrink-0">Lv.{skill.lvl}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[8px] font-mono font-black text-slate-400">
                <span className="text-red-300">威力{skill.power}</span><span className="text-amber-300">消費G{skill.guts}</span><span className="text-yellow-300">会心{skill.crit}%</span>
              </div>
            </div>
          ))}
        </div>
      );
      return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0" style={{paddingTop:'calc(0.5rem + env(safe-area-inset-top))',paddingBottom:'calc(0.5rem + env(safe-area-inset-bottom))'}}>
        <div className="flex items-center gap-2 px-3 shrink-0">
          <button onClick={()=>{stopDexAttackPreview();onBackToList();}} className="p-3 text-slate-400 active:scale-90" aria-label="図鑑一覧へ戻る"><ArrowLeft size={20}/></button>
          <h2 className="text-lg font-black italic text-amber-300 uppercase tracking-widest">モンスター図鑑</h2>
          <span className="ml-auto text-[10px] font-mono font-black text-amber-200/80 tabular-nums pr-1">{index+1} / {monsters.length}</span>
        </div>
        {/* 上半分: 立ち絵。左右のボタンと横スワイプで前後へ移る */}
        {/* 立ち絵の枠。高さをここで決め、絵は枠に合わせて縮尺する。
            元画像は160px四方のものと1024px四方のものが混ざっており、
            寸法を指定しないと「小さい元画像はそのままの大きさ、大きい元画像は枠いっぱい」となって
            モンスターごとに見た目の大きさが2倍近く変わってしまう(ザンだけ極端に大きく見えた)。 */}
        <div data-dex-art className="relative shrink-0 flex items-center justify-center px-14" style={{height:'clamp(150px, 20dvh, 180px)'}}
          onTouchStart={e=>{swipeRef.current=e.touches&&e.touches[0]?e.touches[0].clientX:null;}}
          onTouchEnd={e=>{const from=swipeRef.current; swipeRef.current=null; if(from==null)return; const to=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientX:from; const dx=to-from; if(Math.abs(dx)>=48) go(dx<0?1:-1);}}>
          {unlocked
            ? <DexMonsterArt mon={mon} alt={mon.name}/>
            : <DexMonsterArt mon={mon} alt="まだ出会っていないモンスター" hidden/>}
          <button type="button" data-dex-prev aria-label="前のモンスター" onClick={()=>go(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 w-11 min-h-[48px] rounded-full bg-black/50 border border-amber-400/40 text-amber-200 flex items-center justify-center active:scale-90"><ChevronLeft size={22}/></button>
          <button type="button" data-dex-next aria-label="次のモンスター" onClick={()=>go(1)} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 min-h-[48px] rounded-full bg-black/50 border border-amber-400/40 text-amber-200 flex items-center justify-center active:scale-90"><ChevronRight size={22}/></button>
        </div>
        {/* 攻撃アクションの入口。立ち絵の上に重ねると絵が隠れてしまうので、枠の外に1行で置く。
            演出は上へ大きく飛ぶため、ここでは再生せず専用画面(MONSTER_ATTACK_PREVIEW)へ移る */}
        {unlocked&&<div className="shrink-0 px-3 pt-1 flex justify-center">
          <button type="button" data-dex-attack-preview onClick={()=>{stopDexAttackPreview();Audio_.se.tap();onOpenAttackPreview();}}
            className="min-h-[40px] px-5 rounded-full border border-cyan-300/60 bg-slate-950/85 text-[10px] font-black text-cyan-100 shadow-lg active:scale-95">
            ▶ 攻撃アクション
          </button>
        </div>}
        {/* 下半分: 情報カード */}
        <div className="flex-1 min-h-0 px-3 pt-2">
          <div className="w-full max-w-md mx-auto h-full flex flex-col min-h-0 rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/50 to-slate-950 p-3">
            <div className="shrink-0 text-center text-[17px] font-black text-amber-100 truncate">{unlocked?mon.name:'？？？'}</div>
            {unlocked?(<>
              {/* 血統の行。血統名や区分の文字数で位置が動かないよう、
                  左右のチップを同じ幅(1fr)の枠へ入れ、ラベル・×・区分は端と中央へ固定する */}
              <div data-dex-lineage-row className="shrink-0 mt-2 grid items-center gap-1.5" style={{gridTemplateColumns:'auto minmax(0,1fr) auto minmax(0,1fr) auto'}}>
                <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest shrink-0">血統</span>
                {lineageChip(main)}
                <span className="text-[12px] font-black text-amber-300 shrink-0 text-center">×</span>
                {lineageChip(sub)}
                <span data-dex-category className={`shrink-0 min-w-[42px] text-center text-[9px] font-black px-1.5 py-1 rounded-full ${categoryClass}`}>{monsterCategoryName(category)}</span>
              </div>
              {/* 説明文。1行の子と3行の子でタブから下がまるごと動いてしまうため、
                  3行ぶんの高さを必ず確保する(それより長い説明はこの枠の中で送る) */}
              <div data-dex-desc className="shrink-0 mt-2 overflow-y-auto mh-scroll" style={{height:'calc(1.625em * 3)',fontSize:'10px'}}>
                <p className="text-[10px] font-bold leading-relaxed text-slate-200 break-words">{monsterDexDescription(mon.id)}</p>
              </div>
              <div role="tablist" aria-label="図鑑の内容" className="shrink-0 mt-2 grid grid-cols-3 gap-1.5">
                {tabs.map(([id,label])=>(
                  <button key={id} type="button" role="tab" aria-selected={tab===id} onClick={()=>onSelectTab(id)}
                    className={`min-h-[40px] rounded-xl border text-[11px] font-black active:scale-95 ${tab===id?'bg-amber-600 border-amber-300 text-white':'bg-slate-900 border-amber-500/30 text-amber-200/80'}`}>{label}</button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto mh-scroll mt-2 pr-0.5">
                {tab==='basic'&&(<div data-dex-tab-basic>
                  {row('主血統', main.name)}
                  {row('副血統', sub.name)}
                  {row('区分', monsterCategoryName(category))}
                  {row('勇者特性', mon.trait||'なし')}
                  {row('特性の効果', mon.traitDesc||'特性なし', {block:true})}
                </div>)}
                {tab==='stats'&&(<div data-dex-tab-stats>
                  <div className="text-[9px] font-black text-amber-300/90 mb-1">その種の基礎能力（育てたマスモンの値ではありません）</div>
                  {row('ライフ', mon.baseHp)}
                  {row('ちから', mon.baseAtk)}
                  {row('丈夫さ', mon.baseDef)}
                  {row('ガッツ', mon.baseGuts)}
                  <div className="text-[9px] font-black text-amber-300/90 mt-2 mb-1">間合い適性</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RANGE_LABELS.map((label,i)=>(
                      <div key={label} className="rounded-xl border border-amber-500/25 bg-black/30 py-1.5 text-center">
                        <div className="text-[9px] font-black text-slate-400">{label}</div>
                        <div className="text-[13px] font-mono font-black text-amber-200">{(mon.distAptitude&&mon.distAptitude[i])||'C'}</div>
                      </div>
                    ))}
                  </div>
                </div>)}
                {tab==='skills'&&(<div data-dex-tab-skills className="space-y-2">
                  <div>
                    <div className="text-[9px] font-black text-amber-300/90 mb-1 text-center tracking-widest">通常技</div>
                    {skillPills(getAtkSkillLevels(mon), 'border-red-500/30 bg-red-950/25')}
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-amber-300/90 mb-1 text-center tracking-widest">固有技（進化段階）</div>
                    {skillPills(getUniqueSkillLevels(mon), 'border-amber-500/40 bg-amber-950/30')}
                    <div className="text-[9px] text-slate-300 font-bold leading-relaxed mt-1.5 italic break-words">"{mon.unique?.effectDesc||''}"</div>
                  </div>
                </div>)}
              </div>
            </>):(
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-2 text-center">
                <p className="text-[11px] font-black text-amber-200">まだ出会っていないモンスターです</p>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">マーケットで円盤石を手に入れて解放すると、血統・能力・技が図鑑に記録されます。</p>
              </div>
            )}
          </div>
        </div>
      </div>);}
