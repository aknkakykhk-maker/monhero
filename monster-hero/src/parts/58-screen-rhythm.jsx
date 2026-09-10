// ==== 画面: モンヒロビート(演奏画面以外) ====
//
// MonsterHeroGame から切り出した9画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-10)。
// 曲えらび・案内・マスモン枠・全国ランキング・入口の案内の5つ。
//
// 【この画面ならではの注意】
// ・**演奏画面(RHYTHM_PLAY / RhythmTapTest)は触っていない。** タイミング基盤は STEP 9 の領域で、
//   REGRESSION_RISK_MAP.md §4-1 の「構造目的では変更しない」対象
// ・曲を決めて演奏へ入る処理(全画面化の要求・静音・setRhythmPlay)は、
//   「指で押した直後」でないとブラウザに断られるため、中身は MonsterHeroGame 側に残して
//   onPlaySong として受け取る
// ・オプション画面(RHYTHM_OPTIONS)は前から共有層 29 の RhythmOptions に出ているので対象外
// ・∞周回を裏で走らせたままモンヒロビートへ来ている場合(rhythmBackgroundRun)は
//   戻り先が変わる。判断は本体に残し、画面は onExit を呼ぶだけ

function RhythmInfoScreen({
  returnToHome,
}) {
  return (
      <main data-rhythm-info className="flex h-full flex-1 flex-col bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          <button aria-label="HOMEへ戻る" onClick={returnToHome} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
          <div className="min-w-0"><small className="block text-[8px] font-black text-cyan-300">COMING SOON</small><h2 className="text-sm font-black tracking-widest text-cyan-200">モンヒロビート</h2></div>
        </header>
        <div className="flex-1 overflow-y-auto mh-scroll px-4 pb-6 pt-3" style={{paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
          <div className="my-6 text-center text-6xl">🎵</div>
          <h3 className="text-center text-xl font-black text-cyan-200">モンヒロビートは準備中です</h3>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
            曲に合わせて、5つのレーンを流れてくるノーツを演奏する音ゲーのモードです。
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
            設定したマスモンが曲の途中で「モンスターノーツ」になって流れてきて、取ると血統ごとの力が働く予定です。
          </p>
          <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-3">
            <b className="text-[11px] font-black text-amber-200">正式実装前のお知らせ</b>
            <small className="mt-1 block text-[10px] leading-relaxed text-amber-100/90">
              いまは譜面を制作している段階です。通常プレイからは開始できません。ハイスコアの記録や報酬の付与も行いません。
            </small>
          </div>
          <button onClick={returnToHome} className="mt-5 min-h-[48px] w-full rounded-xl bg-slate-700 text-sm font-black">HOMEへ戻る</button>
        </div>
      </main>
  );
}

function RhythmSongSelectScreen({
  catchingUp, difficulty, dismissQuickRhythmBackground, handleGiveUp, mainHero,
  onExit, onOpenHelp, onOpenMonsterSlots, onOpenOptions, onOpenRanking,
  onPlaySong, quickClearCounts, quickRhythmBackgroundVisible, quickRunDetailOpen, quickRunFinishReasonText,
  quickRunPendingRewards, quickRunProgress, quickRunResumable, quickRunStartError, quickRunStopConfirm,
  repeatTemplateForNewRun, resultProcessing, resumeQuickRunFromRhythm, returnToBackgroundRun, returnToHome,
  rhythmBackgroundRun, rhythmBestRecords, rhythmSelectView, rhythmSelectedDifficultyId, rhythmSelectedSongId,
  rhythmSongListScrollRef, runStage, runStageRef, saveRhythmSelectView, setQuickRunDetailOpen,
  setQuickRunStartError, setQuickRunStopConfirm, setRhythmSelectedDifficultyId, setRhythmSelectedSongId, spotClass,
  startQuickRunFromRhythm, wave,
}) {
      const songs=rhythmDemoSongs(RHYTHM_SONGS);
      const difficulties=rhythmDemoDifficultyList(RHYTHM_DIFFICULTIES);
      // ===== クイック∞周回の進捗(docs/spec/QUICK_RHYTHM_LINK.md PR6) =====
      // 1行の帯は、縦持ちならヘッダーの下、横持ちならヘッダーの空きへ入れる。
      // 横は上のタブに余白があるので、そこを使えば曲の一覧を押し下げずに済む
      // (2026-09-07・ユーザー提案)。縦は余白が無いので今までどおり下に置く。
      // 中身は同じものを使い回す(2つ書くと片方だけ直す事故が起きる)。
      const quickRunBandLabel = quickRunProgress
        ? (quickRunProgress.finished
          // なぜ終わったかまで出す。「終わりました」だけだと、負けたのか
          // アプリが裏に回ったのか分からなかった(2026-09-07・ユーザー報告)
          ? `${quickRunFinishReasonText(quickRunProgress.reason)}（タップで結果へ）`
          // ★演奏で何周ぶん入ったかは曲リザルトで出す。ここはいま何WAVE・何周目かを
          //   出す唯一の場所なので、知らせを重ねない
          //   (2026-09-07・ユーザー提案「曲リザルトの画面で出すほうがいい。
          //    そうしたら帯にわざわざ何周分追加とか表示する必要もない」)
          : `WAVE ${wave}/10 ・ ${quickRunProgress.loops}周目${catchingUp?' ・ 追いつき中':''}`)
        : '';
      const quickRunBandButton = quickRunProgress
        ? <button type="button" onClick={()=>setQuickRunDetailOpen(open=>!open)} aria-expanded={quickRunDetailOpen} aria-label="クイック周回の進捗"
            className="flex min-h-[44px] w-full items-center gap-2 px-3 py-1 text-left active:scale-[.995]">
            <span className={`shrink-0 text-[10px] font-black ${quickRunProgress.finished?'text-amber-200':'text-fuchsia-200'}`}>{quickRunProgress.finished?'⏹':'⚔'}</span>
            <span className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-200">{quickRunBandLabel}</span>
            <span className="shrink-0 text-[9px] font-black text-slate-400">{quickRunDetailOpen?'▲':'▼'}</span>
          </button>
        : null;
      // 周回していないときの「ここから始める」。帯と同じく、縦持ちはヘッダーの下・
      // 横持ちはヘッダーの空きへ入れる。中身は1つ作って使い回す(2つ書くと片方だけ直す事故になる)。
      // ★塗りつぶしをやめて枠だけにし、主張を抑える。モンヒロビートだけで遊ぶ人には
      //   関係のないボタンなので、大きく出しすぎない(2026-09-07・ユーザー指摘)
      const quickRunStartNode = !quickRunProgress && !runStage
        ? (repeatTemplateForNewRun()
          ? <button type="button" data-quick-run-start-button onClick={()=>{if(!startQuickRunFromRhythm())setQuickRunStartError(true);}}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-fuchsia-400/40 px-2 text-[10px] font-black text-fuchsia-200 active:scale-[.98]">⚔ 裏でクイックの∞周回を始める</button>
          : <p data-quick-run-start-hint className="px-1 py-1 text-[9px] leading-relaxed text-slate-500">裏で周回を回すには、クイックで1度∞周回を始めるか、M/B管理の「AUTO設定 → モンヒロビート中に回すクイック周回」で勇者モン・配置距離・難易度を決めてください。</p>)
        : null;
      return (
      <main data-rhythm-demo-home className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-1 border-b border-cyan-400/15 bg-slate-950/95 px-2 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          {/* 裏でクイック∞周回が回っているあいだは、HOMEではなくバトルへ戻す。
              HOMEへ抜けると returnToHome を通らないぶん周回が宙ぶらりんになるので、
              やめるときはバトル画面で∞を切ってから戻ってもらう */}
          <button data-rhythm-back aria-label={rhythmBackgroundRun?'クイックのバトルへ戻る':'戻る'} title={rhythmBackgroundRun?'クイックのバトルへ戻る':'戻る'}
            onClick={onExit}
            className="min-h-[44px] min-w-[44px] shrink-0 text-slate-300">{rhythmBackgroundRun?<span className="text-[10px] font-black leading-tight text-fuchsia-200">⚔<br/>戻る</span>:<ArrowLeft size={20}/>}</button>
          {/* ボタンが4つ並ぶので、題名は縮んでも1行のまま(truncate)にする。
              折り返すとヘッダーが2行になり、そのぶん曲の一覧が減るため */}
          <div className="min-w-0 flex-1">
            <small className="block text-[8px] font-black leading-none tracking-[0.2em] text-fuchsia-300">MONBEAT</small>
            <h2 className="truncate text-sm font-black leading-tight tracking-widest text-cyan-200">🎵 楽曲選択</h2>
          </div>
          {/* 横持ちはここに余白があるので、周回の帯をヘッダーへ入れる(縦持ちでは出さない) */}
          {quickRunProgress&&<div data-quick-run-progress-header className="min-w-0 max-w-[260px] flex-1 rounded-lg border border-fuchsia-400/30 bg-slate-900/70">{quickRunBandButton}</div>}
          {/* 周回していないときの入口も、横持ちではここへ入れる(縦持ちでは出さない) */}
          {quickRunStartNode&&<div data-quick-run-start-header className="min-w-0 max-w-[260px] flex-1">{quickRunStartNode}</div>}
          <span data-rhythm-demo-badge className="shrink-0 rounded-full border border-amber-300/60 bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-200">体験版</span>
          {/* 縦⇄横の切り替え。端末の回転ロックを解除しに行かなくても横画面で遊べるようにする
              (2026-09-05・ユーザー指示「縦なら横に横なら縦に変わるボタン」) */}
          <RhythmOrientationButton/>
          <button data-rhythm-demo-help aria-label="遊びかた" title="遊びかた"
            onClick={onOpenHelp}
            className={`min-h-[44px] min-w-[40px] shrink-0 rounded-xl border border-amber-400/50 bg-amber-950/40 text-base text-amber-100${spotClass('help')}`}>📖</button>
          <button data-rhythm-demo-monsters aria-label="マスモン設定" title="マスモン設定"
            onClick={onOpenMonsterSlots}
            className={`min-h-[44px] min-w-[40px] shrink-0 rounded-xl border border-fuchsia-400/50 bg-fuchsia-950/40 text-base text-fuchsia-100${spotClass('monsters')}`}>👾</button>
          <button data-rhythm-demo-options aria-label="オプション" title="オプション"
            onClick={onOpenOptions}
            className={`min-h-[44px] min-w-[40px] shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-base text-cyan-100${spotClass('options')}`}>⚙️</button>
        </header>
        {/* ===== クイック∞周回の進捗(docs/spec/QUICK_RHYTHM_LINK.md PR6) =====
            常に出すのは1行だけ。曲の一覧を押し下げないよう、詳細はタップで開く。
            演奏中(RHYTHM_PLAY)はこの画面ではないので、そもそも出ない */}
        {quickRunProgress&&<div data-quick-run-progress className="shrink-0 border-b border-fuchsia-400/20 bg-slate-900/80">
          {/* 横持ちのときはヘッダーの中に同じものを出しているので、こちらは隠す */}
          <div data-quick-run-band-portrait>{quickRunBandButton}</div>
          {quickRunDetailOpen&&<div data-quick-run-progress-detail className="border-t border-white/10 px-3 py-2">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              <div className="flex justify-between gap-2"><dt className="text-slate-400">周回数</dt><dd className="font-black text-white">{quickRunProgress.loops}周</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-400">難易度</dt><dd className="font-black text-white">{quickDifficultySetting(difficulty)?.label||difficulty}</dd></div>
              {(()=>{const pending=quickRunPendingRewards();return <>
              <div className="flex justify-between gap-2"><dt className="text-slate-400">経験値</dt><dd className="font-black text-cyan-200">+{Math.floor(quickRunProgress.xp+pending.xp).toLocaleString()}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-400">ダイヤ</dt><dd className="font-black text-amber-200">+{Math.floor(quickRunProgress.gold+pending.gold).toLocaleString()}</dd></div>
              {(pending.xp>0||pending.gold>0)&&<div className="col-span-2 text-[9px] text-slate-500">うち今の周のぶん（経験値 +{Math.floor(pending.xp).toLocaleString()} ／ ダイヤ +{Math.floor(pending.gold).toLocaleString()}）は、この周が終わったときに入ります（負けても、途中でやめても、ここまでのぶんは入ります）。</div>}
              {/* 直前の演奏で入ったぶん(2026-09-07・ユーザー提案) */}
              {/* 演奏で何周ぶん入ったかは、曲リザルト([data-rhythm-result-quick-run])で出す。
                  ここは進捗を見る場所なので、演奏1回ごとの知らせは重ねない
                  (2026-09-07・ユーザー提案) */}
              </>;})()}
              <div className="col-span-2 flex justify-between gap-2"><dt className="text-slate-400">勇者モン</dt><dd className="truncate font-black text-white">{mainHero?.masuName||mainHero?.name||'—'}</dd></div>
            </dl>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-400">{quickRunProgress.finished
              // 止まっていても、挑戦がまだ生きていれば続きから再開できる。
              // ★負けた・リタイアしたあとは「続き」が無い。ランの段階は残るので、
              //   段階の有無ではなく勝負がついたかどうかで分ける
              //   (2026-09-07・ユーザー報告「負けた場合は最初からにしないとおかしい」)
              ?(quickRunResumable
                ?`${quickRunFinishReasonText(quickRunProgress.reason)}。下の「再開する」で続きから回せます。`
                :`${quickRunFinishReasonText(quickRunProgress.reason)}。続きはないので、始めるときは1周目からになります。バトルへ戻ると結果を見られます。`)
              :catchingUp
                ?'演奏で止まっていたぶんを取り戻しています。しばらく速く進みます（バトルへ戻ると通常の速さに戻ります）。'
                // ★仕様が「曲の長さぶんの周回クリア」へ変わったので、文言もそちらへ合わせる
                //   (2026-09-07・ユーザー指摘「演奏中の文言ってこれであってる？仕様変わったよね？」。
                //    追いつき方式のころの説明が残っていた)。
                //   まだその難易度をクリアしていない人には入らないので、そこも言い分ける
                :rhythmPlayRunLoopsAllowed(difficulty,quickClearCounts)
                  ?'ここにいるあいだも周回は進みます。演奏中は止まりますが、曲を最後まで演奏すると、その曲の長さぶんの周回がクリア扱いで入ります（2分台までは2周・3分台は3周…）。'
                  :'ここにいるあいだも周回は進みます。演奏中は止まり、そのぶんは曲のあとに速く進んで取り戻します。この難易度をクイックで一度クリアすると、演奏したぶんがそのまま周回クリアとして入るようになります。'}</p>
            {/* ===== ここから操作。状態は3つだけ(2026-09-07に整理) =====
                  ① 回っている                … バトルへ戻る ／ ここで周回をやめる
                  ② 止まった・挑戦は生きている … 周回を再開する ／ バトルへ戻る
                  ③ 止まった・勝負がついた     … 新しく周回を始める ／ バトルへ戻る(結果を見る)
                ★②と③の分かれ目は quickRunResumable。ランの段階(runStage)は負けても
                  残るので、段階の有無で分けると負けたあとに②が出てしまう
                  (2026-09-07・ユーザー報告)。
                ★どの状態でも「バトルへ戻る」は出す。行き先を失わないため */}
            {quickRunProgress.finished&&quickRunResumable&&<button type="button" data-quick-run-resume
              onClick={()=>{resumeQuickRunFromRhythm();}}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-emerald-300/60 bg-emerald-800/70 text-[11px] font-black text-emerald-50 active:scale-[.98]">▶ 周回を再開する</button>}
            {quickRunProgress.finished&&!quickRunResumable&&repeatTemplateForNewRun()&&<button type="button" data-quick-run-restart
              disabled={resultProcessing}
              onClick={()=>{if(!startQuickRunFromRhythm())setQuickRunStartError(true);}}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-fuchsia-300/60 bg-fuchsia-800/70 text-[11px] font-black text-fuchsia-50 active:scale-[.98] disabled:opacity-50">{resultProcessing?'結果を記録しています…':'⚔ 1周目から新しく始める'}</button>}
            {quickRunStartError&&<p className="mt-1 text-[9px] font-black text-red-300">いま周回を始められませんでした。編成のモンスターが見当たらないか、難易度がまだ解放されていません。</p>}
            <button type="button" data-quick-run-progress-back onClick={()=>{if(runStageRef.current)returnToBackgroundRun();}}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-fuchsia-300/60 bg-fuchsia-800/70 text-[11px] font-black text-fuchsia-50 active:scale-[.98]">{quickRunProgress.finished&&!quickRunResumable?'⚔ バトルへ戻って結果を見る':'⚔ バトルへ戻る'}</button>
            {/* バトルへ行かずにここで終わらせる(2026-09-07・ユーザー指示
                「バトルにいかなくてもクイック周回を止められるようにしたい」)。
                やめ方は「あきらめる」と同じで、そこまでにクリアしたWAVEの報酬が
                その場で入る(ユーザー選択「その周も終わらせて報酬を受け取る」)。
                ★時間をかけて積み上げるものなので、誤って押しても止まらないよう確認をはさむ */}
            {!quickRunProgress.finished&&quickRunResumable&&(quickRunStopConfirm
              ? <div data-quick-run-stop-confirm className="mt-2 rounded-xl border border-amber-400/50 bg-amber-950/30 p-2">
                  <p className="text-[9px] leading-relaxed text-amber-100">周回をやめますか？ いまの周もここで終わり、クリアしたWAVEぶんの報酬が入ります。</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={()=>setQuickRunStopConfirm(false)}
                      className="min-h-[44px] rounded-lg border border-white/20 text-[10px] font-black text-slate-300 active:scale-[.98]">続ける</button>
                    <button type="button" data-quick-run-stop-yes onClick={()=>{setQuickRunStopConfirm(false);void handleGiveUp();}}
                      className="min-h-[44px] rounded-lg border border-amber-300/70 bg-amber-800/60 text-[10px] font-black text-amber-50 active:scale-[.98]">やめる</button>
                  </div>
                </div>
              : <button type="button" data-quick-run-stop onClick={()=>setQuickRunStopConfirm(true)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/15 text-[10px] font-black text-slate-400 active:scale-[.98]">⏹ ここで周回をやめる</button>)}
          </div>}
        </div>}
        {/* 裏で周回したままモンビーを開いた最初の1回だけ(PR8) */}
        {quickRhythmBackgroundVisible&&<div data-quick-rhythm-background className="shrink-0 border-b border-fuchsia-400/20 bg-slate-950/90 px-2 py-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="quickRhythmBackground" compact/></div>
            <button type="button" onClick={dismissQuickRhythmBackground} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        {/* 周回していないときだけ「ここから始める」を出す。
            編成は「1周目に自分で組んだもの」→ 無ければAUTO設定の事前設定(PR5)。
            ★周回中の帯と同じく、縦持ちはヘッダーの下・横持ちはヘッダーの空きへ入れる。
              横持ちで下に置いたままだと画面の幅いっぱいの大きな帯になってしまっていた。
              モンヒロビートだけで遊ぶ人もいるので、塗りつぶしをやめて枠だけにし、
              主張を抑える(2026-09-07・ユーザー指摘
              「クイック前の場所は変わってない」「主張は強くしすぎないほうがいい」)。 */}
        {!quickRunProgress&&!runStage&&<div data-quick-run-start data-quick-run-start-portrait className="shrink-0 border-b border-white/10 bg-slate-900/40 px-3 py-1">
          {quickRunStartNode}
          {quickRunStartError&&<p className="mt-1 text-[9px] font-black text-red-300">いま周回を始められませんでした。編成のモンスターが見当たらないか、難易度がまだ解放されていません。</p>}
        </div>}
        {/* 曲えらびの上に固定で出すのは、助手のひとことだけにする(notice)。
            「これは体験版です…」の長い断り書きと横画面の案内はここから外した。
            曲を選ぶ画面でいちばん要るのは曲の並びで、読み物は場所を取りすぎるため
            (2026-09-05・ユーザー指示)。同じ内容はチュートリアルと「📖 遊びかた」にある。 */}
        <RhythmSongSelect
          songs={songs}
          difficulties={difficulties}
          bestRecords={rhythmBestRecords}
          songId={rhythmSelectedSongId}
          difficultyId={rhythmSelectedDifficultyId}
          onSongId={setRhythmSelectedSongId}
          onDifficultyId={setRhythmSelectedDifficultyId}
          spotClass={spotClass}
          onPlay={onPlaySong}
          notice={<AssistantBubble scene="rhythmHome" compact/>}
          view={rhythmSelectView}
          onView={saveRhythmSelectView}
          listScrollTop={rhythmSongListScrollRef.current}
          onListScrollTop={top=>{rhythmSongListScrollRef.current=top;}}
          footer={song=><>
            {/* 全国ランキングは曲ごとなので、いま選んでいる曲のぶんを開く。
                ここにあったマスモンの説明文は外した。同じ内容が「📖 遊びかた」にあり、
                曲えらびでは1行でも多く曲を並べたいため
                (2026-09-05・ユーザー指摘「縦画面の楽曲選択が2曲までしか出ないのがやりづらい」)。 */}
            <button data-rhythm-demo-ranking onClick={()=>onOpenRanking(song)}
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-amber-300/60 bg-amber-500/10 text-xs font-black text-amber-100">🏆 この曲の全国ランキング</button>
          </>}/>
      </main>
      );
}

function RhythmHelpScreen({
  onBackToSongSelect, rhythmHelpTopicId, setRhythmHelpTopicId, startRhythmPractice, startRhythmTutorial,
}) {
      // 公開フラグで伏せてある項目を出さないよう、生の HELP_CATEGORIES ではなく
      // ふるい分け済みの HELP_GUIDE から引く
      const category=helpCategoryById('rhythm');
      const topics=(category&&category.topics)||[];
      const topic=rhythmHelpTopicId?topics.find(x=>x.id===rhythmHelpTopicId)||null:null;
      const accent=(category&&category.color)||'#fbbf24';
      const topicIndex=topic?topics.findIndex(x=>x.id===topic.id):-1;
      const nextTopic=topicIndex>=0?topics[topicIndex+1]:null;
      return (
      <main data-rhythm-demo-help className="flex h-full min-h-0 flex-1 flex-col bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-amber-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          <button aria-label="戻る" data-rhythm-demo-help-back onClick={()=>{if(topic)setRhythmHelpTopicId(null);else onBackToSongSelect();}} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
          <div className="min-w-0 flex-1">
            <small className="block text-[8px] font-black leading-none tracking-[0.2em] text-fuchsia-300">MONBEAT</small>
            <h2 className="text-sm font-black leading-tight tracking-widest text-amber-200">{topic?`${topic.emoji} ${topic.title}`:'📖 遊びかた'}</h2>
          </div>
        </header>
        <div data-rhythm-demo-help-scroll className="flex-1 min-h-0 overflow-y-auto mh-scroll px-3 pb-6 pt-3" style={{paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
          <RhythmLandscapeHint className="mb-3"/>
          {!topic&&(<>
            <AssistantBubble scene="rhythmHelp"/>
            {/* 【2026-09-05・ユーザー指示】「実際の音ゲー画面でやり方や各ノーツの操作方法などまで作って」
                読むだけの案内と、叩いて覚える練習の2つを並べる。練習は記録に残らない */}
            <button data-rhythm-demo-practice onClick={startRhythmPractice}
              className="mt-3 min-h-[56px] w-full rounded-2xl bg-gradient-to-r from-amber-400 to-fuchsia-500 text-sm font-black text-slate-950">🥁 叩いて練習する</button>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">実際のプレイ画面で、タップ・同時押し・ホールド・スライド・フリック・終点フリック・モンスターノーツを1つずつ練習します。約20秒です。スコアも自己ベストも残りません。</p>
            <button data-rhythm-demo-help-tutorial onClick={startRhythmTutorial}
              className="mt-3 min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-sm font-black text-white">🎓 もう一度チュートリアルを見る</button>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">曲えらびへ戻って、助手が最初から説明します。何度でも見られます。</p>
            <div data-rhythm-demo-help-list className="mt-4 space-y-2">
              {topics.length===0
                ?<p className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs text-slate-300">説明がまだありません。</p>
                :topics.map((x,i)=>(
                  <React.Fragment key={x.id}>
                    {x.group&&x.group!==(topics[i-1]||{}).group&&(
                      <div data-rhythm-demo-help-group className="pt-2 pb-0.5 text-[10px] font-black tracking-[0.18em]" style={{color:accent}}>{x.group}</div>
                    )}
                    <button data-rhythm-demo-help-open={x.id} onClick={()=>setRhythmHelpTopicId(x.id)}
                      className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left active:scale-95" style={{borderColor:`${accent}55`,backgroundColor:'rgba(15,23,42,0.7)'}}>
                      <span className="shrink-0 text-base leading-none">{x.emoji}</span>
                      <span className="min-w-0 flex-1 text-[12px] font-black leading-tight text-white">{x.title}</span>
                      <ChevronRight size={16} className="shrink-0 text-slate-500"/>
                    </button>
                  </React.Fragment>
                ))}
            </div>
          </>)}
          {topic&&(
            <div data-rhythm-demo-help-topic={topic.id} className="space-y-3.5 pb-2">
              <p className="text-[10px] font-bold leading-relaxed text-cyan-200">{topic.assistant}</p>
              {/* 本文の描き方は本ゲームのヘルプと共通(renderHelpBlocks) */}
              {renderHelpBlocks(topic.blocks,accent)}
              <div className="flex gap-2 pt-1">
                <button data-rhythm-demo-help-list-back onClick={()=>setRhythmHelpTopicId(null)} className="min-h-[48px] flex-1 rounded-2xl border border-white/10 bg-slate-900 py-3 text-[11px] font-black text-slate-300 active:scale-95">項目一覧へ</button>
                {nextTopic&&<button data-rhythm-demo-help-next onClick={()=>setRhythmHelpTopicId(nextTopic.id)} className="min-h-[48px] flex-1 truncate rounded-2xl px-2 py-3 text-[11px] font-black text-black active:scale-95" style={{backgroundColor:accent}}>次: {nextTopic.title}</button>}
              </div>
            </div>
          )}
        </div>
      </main>
      );
}

function RhythmMonstersScreen({
  applyRhythmMonsterSlots, masuMons, onBackToSongSelect, rhythmMonsterMessage, rhythmMonsterPickerOpen,
  rhythmMonsterSlotIdsInUse, rhythmMonsterSlots, setRhythmMonsterMessage, setRhythmMonsterPickerOpen,
}) {
  return (
      <main data-rhythm-demo-monsters-screen className="flex h-full flex-1 flex-col bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-fuchsia-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          <button aria-label="戻る" onClick={()=>{setRhythmMonsterPickerOpen(false);onBackToSongSelect();}} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
          <h2 className="text-sm font-black tracking-widest text-fuchsia-200">👾 マスモン設定</h2>
        </header>
        {/* 【2026-09-05・ユーザー指示】「マスモン設定のとこをUIやレイアウトを整えて。
            モンスターノーツが何がつくかとか説明とかその辺の詳細を追加して」
            枠を並べるだけだったのを、①助手のひとこと ②設定枠(何番目・何の能力が出るか)
            ③モンスターノーツの説明と能力の一覧、の3段に分けた。
            能力の一覧はデータから作るので、値を変えてもここが古くならない */}
        <div className="flex-1 overflow-y-auto mh-scroll px-3 pb-6 pt-3 space-y-3" style={{paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
          <RhythmLandscapeHint/>
          <AssistantBubble scene="rhythmMonsters" compact/>
          <RhythmMonsterSlotsPanel rhythmMonsterSlots={rhythmMonsterSlots} rhythmMonsterSlotIdsInUse={rhythmMonsterSlotIdsInUse} rhythmMonsterPickerOpen={rhythmMonsterPickerOpen} setRhythmMonsterPickerOpen={setRhythmMonsterPickerOpen} rhythmMonsterMessage={rhythmMonsterMessage} setRhythmMonsterMessage={setRhythmMonsterMessage} applyRhythmMonsterSlots={applyRhythmMonsterSlots} masuMons={masuMons}/>
          <RhythmMonsterNoteGuide/>
        </div>
      </main>
  );
}

function RhythmRankingScreen({
  loadRhythmRanking, onBackToSongSelect, rankingBreederIcon, rhythmRanking, rhythmRankingDetail,
  setRhythmRankingDetail,
}) {
      // 曲えらびから開いたときの曲を追いかける。曲が5つになったので、
      // ここを固定にすると「別の曲のランキングを見ているのに曲名が違う」ことになる。
      const song=RHYTHM_SONGS.find(entry=>entry.songId===rhythmRanking.songId)||rhythmDemoSong(RHYTHM_SONGS);
      return (
      <main data-rhythm-ranking className="flex h-full flex-1 flex-col bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-amber-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          <button aria-label="戻る" onClick={onBackToSongSelect} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
          <h2 className="text-sm font-black tracking-widest text-amber-200">🏆 全国ランキング</h2>
          <button aria-label="更新" data-rhythm-ranking-refresh onClick={()=>loadRhythmRanking(song)} className="ml-auto min-h-[44px] px-2 text-[10px] font-black text-amber-200">更新</button>
        </header>
        <div className="flex-1 overflow-y-auto mh-scroll px-3 pb-6 pt-3" style={{paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
          <RhythmLandscapeHint className="mb-3"/>
          <p className="mb-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-3 text-[10px] font-bold leading-relaxed text-amber-100">
            「{song?.displayName||'—'}」のEASY〜MASTERをまとめた合算ランキングです。難易度が高いほど満点も高いため、高い難易度で挑むほど上位に近づきます。自分のスコアはいちばん高い1件だけが載ります。
          </p>
          {rhythmRanking.status==='loading'&&<p data-rhythm-ranking-loading className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">読み込み中…</p>}
          {rhythmRanking.status==='error'&&<p data-rhythm-ranking-error className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">読み込めませんでした。電波の良い場所で「更新」をお試しください。</p>}
          {rhythmRanking.status==='ready'&&rhythmRanking.entries.length===0&&<p data-rhythm-ranking-empty className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">まだ記録がありません。最初の1件になってみましょう。</p>}
          {rhythmRanking.status==='ready'&&rhythmRanking.entries.length>0&&<ol data-rhythm-ranking-list className="space-y-2">
            {rhythmRanking.entries.map((entry,index)=>(
              <li key={`${entry.userName}-${index}`} data-rhythm-ranking-row className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
                <b className="w-6 shrink-0 text-center text-xs font-black text-amber-200">{index+1}</b>
                {rankingBreederIcon(entry)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white">{entry.userName}</p>
                  <p className="text-[9px] text-slate-400">{RHYTHM_DEMO_DIFFICULTY_LABELS[entry.difficultyId]?.name||entry.difficultyId||'-'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-black text-amber-200">{entry.score.toLocaleString()}</p>
                  <p className={`text-[10px] font-black ${RHYTHM_RANK_COLORS[rhythmRankForScore(entry.score)]}`}>{rhythmRankForScore(entry.score)}</p>
                </div>
                {entry.detail&&<button data-rhythm-ranking-detail onClick={()=>setRhythmRankingDetail(entry)} className="shrink-0 min-h-[44px] rounded-lg border border-white/20 px-2 text-[9px] font-black text-slate-200">詳細</button>}
              </li>
            ))}
          </ol>}
        </div>
        {rhythmRankingDetail&&(
          <div data-rhythm-ranking-detail-modal className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3" onClick={()=>setRhythmRankingDetail(null)}>
            <div className="w-full max-w-md rounded-2xl border border-amber-300/40 bg-slate-900 p-4" onClick={e=>e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-black text-amber-200">{rhythmRankingDetail.userName} のリザルト</h3>
                <button aria-label="閉じる" data-rhythm-ranking-detail-close onClick={()=>setRhythmRankingDetail(null)} className="min-h-[44px] min-w-[44px] px-2 text-slate-400">✕</button>
              </div>
              <p className="text-[10px] text-slate-400">{RHYTHM_DEMO_DIFFICULTY_LABELS[rhythmRankingDetail.difficultyId]?.name||rhythmRankingDetail.difficultyId} / スコア {rhythmRankingDetail.score.toLocaleString()} / ランク {rhythmRankForScore(rhythmRankingDetail.score)}</p>
              <p className="mt-1 text-[10px] text-slate-400">最大コンボ {rhythmRankingDetail.detail?.maxCombo??'-'}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]">
                {RHYTHM_JUDGMENT_IDS.map(id=><React.Fragment key={id}><dt className="text-slate-400">{id}</dt><dd className="text-right font-mono text-white">{rhythmRankingDetail.detail?.judgments?.[id]??0}</dd></React.Fragment>)}
              </dl>
              <p className="mt-2 text-[9px] font-black text-amber-200">
                {rhythmRankingDetail.detail?.allMarvelous?'ALL MARVELOUS!!':rhythmRankingDetail.detail?.allExcellent?'ALL EXCELLENT!!':rhythmRankingDetail.detail?.fullCombo?'FULL COMBO!':''}
              </p>
            </div>
          </div>
        )}
      </main>
      );
}
