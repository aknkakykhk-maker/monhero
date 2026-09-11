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
  catchingUp, difficulty, dismissQuickRhythmBackground, dismissRhythmEventNotice, handleGiveUp, mainHero,
  onExit, onOpenEventRanking, onOpenHelp, onOpenMonsterSlots, onOpenOptions, onOpenRanking,
  onPlaySong, quickClearCounts, quickRhythmBackgroundVisible, quickRunDetailOpen, quickRunFinishReasonText,
  quickRunPendingRewards, quickRunProgress, quickRunResumable, quickRunStartError, quickRunStopConfirm,
  repeatTemplateForNewRun, resultProcessing, resumeQuickRunFromRhythm, returnToBackgroundRun, returnToHome,
  rhythmBackgroundRun, rhythmBestRecords, rhythmEventNotice, rhythmSelectView, rhythmSelectedDifficultyId, rhythmSelectedSongId,
  rhythmSongListScrollRef, runStage, runStageRef, saveRhythmSelectView, setQuickRunDetailOpen,
  setQuickRunStartError, setQuickRunStopConfirm, setRhythmSelectedDifficultyId, setRhythmSelectedSongId, spotClass,
  startQuickRunFromRhythm, wave,
}) {
      const songs=rhythmDemoSongs(RHYTHM_SONGS);
      const difficulties=rhythmDemoDifficultyList(RHYTHM_DIFFICULTIES);
      // 今週の対象曲の名前。曲名はデータから引くので、ここに書き写さない。
      // 副題まで入れるのは rhythmSongFullName の役目(原曲とリミックスが同じ displayName を持つため)
      const eventSongTitles=rhythmEventNotice
        ?rhythmEventNotice.songIds.map(songId=>rhythmSongFullName(rhythmEventSong(songId,RHYTHM_SONGS))||songId)
        :[];
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
        {/* 週間ランキングの「今週の対象曲」案内(docs/spec/RHYTHM_RANKING.md §10.2)。
            その週の初回に1度だけ出す。閉じるか、その週にもう一度見たら出ない。
            ★ヘルプと更新履歴は探しに行った人しか読まないので、画面のなかでも伝える(CLAUDE.md ⑤) */}
        {rhythmEventNotice&&<div data-rhythm-event-notice className="shrink-0 border-b border-fuchsia-400/20 bg-slate-950/90 px-2 py-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <AssistantBubble scene="rhythmWeeklyEvent" condition={rhythmEventNotice.kind==='limited'?'limited':null} compact/>
              {/* 期間限定のときはイベントの名前を出す。「今週の対象曲」のままだと、
                  週間ランキングが動いていると誤解される */}
              {rhythmEventNotice.kind==='limited'&&<p className="mt-1 truncate text-[10px] font-black text-amber-200">🏆 {rhythmEventNotice.name} 開催中！</p>}
              <p className="mt-1 text-[10px] font-black leading-tight text-fuchsia-100">{rhythmEventSongsLabel(rhythmEventNotice)}：{eventSongTitles.join(' ／ ')}</p>
              <button type="button" data-rhythm-event-notice-open onClick={onOpenEventRanking}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-fuchsia-400/40 px-2 text-[10px] font-black text-fuchsia-200 active:scale-[.98]">🏆 {rhythmEventNotice.kind==='limited'?'イベントランキングを見る':'週間ランキングを見る'}</button>
            </div>
            <button type="button" data-rhythm-event-notice-close onClick={dismissRhythmEventNotice} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
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

// モンヒロビートのイベント報酬の受け取り(docs/spec/RHYTHM_RANKING.md §9.1)。
// イベントが終わったあと、入賞していた人にだけ最初の起動で1度だけ出す。
// ★新しい画面(gameState)は増やさない。重ねて出すだけなので、ヘルプの対応表・戻り先・
//   BGMの引き継ぎに手を入れずに済む(CLAUDE.md ⑤)。
function RhythmEventRewardModal({ prize, onClaim, claiming }) {
  if (!prize) return null;
  const { event, prizes, participation } = prize;
  // 入賞していなくても参加報酬だけで出ることがあるので、見出しを言い分ける
  const won = Array.isArray(prizes) && prizes.length > 0;
  return (
    <div data-rhythm-event-reward className="fixed inset-0 z-[90000] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-amber-300/70 bg-slate-950 p-4 shadow-2xl">
        <p className="text-center text-[10px] font-black tracking-widest text-amber-300">RESULT</p>
        <h3 className="mt-1 text-center text-base font-black text-amber-100">{won ? '入賞おめでとうございます！' : 'ご参加ありがとうございました！'}</h3>
        <p className="mt-1 text-center text-[10px] font-bold text-slate-300">{event.name}</p>
        <ul className="mt-3 space-y-2">
          {prizes.map(entry => (
            <li key={entry.divisionId} data-rhythm-event-reward-row className="rounded-2xl border border-amber-300/40 bg-amber-500/5 p-2">
              <p className="flex items-baseline gap-2 text-[10px] font-black text-amber-200">
                <span className="min-w-0 flex-1 truncate text-slate-200">
                  {entry.songId ? (rhythmSongFullName(rhythmEventSong(entry.songId, RHYTHM_SONGS)) || entry.songId) : '総合'}
                </span>
                <b className="shrink-0 text-sm text-amber-100">{entry.rank}位</b>
              </p>
              <p className="mt-1 text-[10px] leading-tight text-white">{rhythmEventRewardText(entry.reward)}</p>
            </li>
          ))}
        </ul>
        {participation&&(
          <div data-rhythm-event-reward-participation className="mt-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/5 p-2">
            <p className="text-[10px] font-black text-cyan-200">参加報酬（対象曲を{participation.songs}曲すべて）</p>
            <p className="mt-1 text-[10px] leading-tight text-white">{rhythmEventParticipationText(participation)}</p>
          </div>
        )}
        <button type="button" data-rhythm-event-reward-claim disabled={claiming} onClick={onClaim}
          className="mt-4 min-h-[52px] w-full rounded-2xl border-2 border-amber-300 bg-amber-500/20 text-sm font-black text-amber-50 active:scale-[.98] disabled:opacity-50">
          {claiming ? '受け取っています…' : '🎁 受け取る'}
        </button>
        <p className="mt-2 text-center text-[9px] leading-relaxed text-slate-400">超越の実・勇者の証・虹のプシュケーはHOMEの「アイテム」から、ダイヤは画面上の表示から確認できます。</p>
      </div>
    </div>
  );
}

function RhythmRankingScreen({
  loadRhythmEventRanking, loadRhythmRanking, loadRhythmTotalRanking, onBackToSongSelect, onGoToSongSelect,
  rankingBreederIcon, rhythmEventDivision, rhythmEventRanking, rhythmRanking, rhythmRankingDetail,
  rhythmRankingTab, rhythmTotalRanking,
  setRhythmEventDivision, setRhythmRankingDetail, setRhythmRankingTab,
}) {
      // 曲えらびから開いたときの曲を追いかける。曲が5つになったので、
      // ここを固定にすると「別の曲のランキングを見ているのに曲名が違う」ことになる。
      const song=RHYTHM_SONGS.find(entry=>entry.songId===rhythmRanking.songId)||rhythmDemoSong(RHYTHM_SONGS);
      // 「この曲」と「総合(全曲合算)」の出し分け(2026-09-11)。
      // 画面(gameState)は増やさない。増やすとヘルプの対応表・戻り先・BGMの引き継ぎが
      // それぞれ別の場所にあるため、どこかで必ず抜ける(CLAUDE.md ⑤)。
      //
      // ★公開フラグが立つまでタブごと出さない。集計はSupabase側のビューが行うので、
      //   SQLを適用するまで中身が無い。機能と案内(ヘルプ・更新履歴・助手の告知)を
      //   同じフラグでまとめて出し入れし、「説明だけ先に出る」を起こさない。
      const totalReleased=RELEASE_FLAGS.rhythmTotalRanking===true;
      const totalTab=totalReleased&&rhythmRankingTab==='total';
      const total=rhythmTotalRanking||{status:'idle',entries:[],self:null};
      // 曲数も理論満点もデータから作る。曲が増えても、ここは書き換えない
      // (docs/spec/RHYTHM_RANKING.md §5.1)
      const totalSongCount=rhythmTotalRankingSongCount(RHYTHM_SONGS);
      // 週間ランキングとイベントランキング(2026-09-11・docs/spec/RHYTHM_RANKING.md §6・§7)。
      // ★2026-09-11・ユーザー指示「週間ランキングとイベントランキングは別々に作ったほうがいい」。
      //   タブを分け、両方を同時に動かす。週末イベントの裏でもいつもの週間は進む。
      // ★ここも公開フラグが立つまでタブごと出さない。期間の窓と集計はSupabase側の
      //   ビュー・関数が行うので、SQLを適用するまで中身が出せない(総合タブと同じ考え方)。
      // ★部門(対象曲ごと＋総合)の数は対象曲の数から作る。3曲でも5曲でも画面は書き換えない。
      const eventReleased=RELEASE_FLAGS.rhythmWeeklyRanking===true;
      // 期間限定は開催しているときだけタブを出す。開催の判定は端末の時計でよい
      // (順位の期間はサーバーから受け取ったもの・定義に書いた日時を使う)
      const limitedEvent=eventReleased?rhythmLimitedEventAt(Date.now()):null;
      const boardKind=rhythmRankingTab==='weekly'?'weekly':(rhythmRankingTab==='event'&&limitedEvent?'limited':null);
      const boardTab=eventReleased&&!!boardKind;
      const totalTabOpen=totalTab&&!boardTab;
      const songTab=!totalTabOpen&&!boardTab;
      const boards=rhythmEventRanking||{};
      const event=(boardKind&&boards[boardKind])||{status:'idle',window:null,event:null,boards:{}};
      const eventDefinition=event.event||null;
      const eventDivisions=eventDefinition?rhythmEventDivisions(eventDefinition,RHYTHM_SONGS):[];
      const wantedDivision=(rhythmEventDivision&&boardKind&&rhythmEventDivision[boardKind])||RHYTHM_EVENT_TOTAL_DIVISION;
      const eventDivisionId=eventDivisions.some(division=>division.id===wantedDivision)
        ?wantedDivision:RHYTHM_EVENT_TOTAL_DIVISION;
      const eventBoard=(event.boards&&event.boards[eventDivisionId])||{status:'idle',entries:[],self:null};
      const eventSongId=rhythmEventDivisionSongId(eventDivisionId);
      const eventRange=rhythmEventWindow(eventDefinition,event.window);
      const eventSongCount=eventDefinition?eventDefinition.songIds.length:0;
      // その部門の報酬(1位から順に)。報酬を持たない週間ランキングでは空になる
      const eventRewardRanks=eventDefinition
        ?Array.from({length:RHYTHM_EVENT_REWARD_RANKS},(_,index)=>({
          rank:index+1,reward:rhythmEventRewardForRank(eventDefinition,eventDivisionId,index+1),
        })).filter(entry=>!!entry.reward)
        :[];
      const eventReward=eventRewardRanks.length>0;
      // 参加報酬(入賞しなくても、対象曲をすべて遊べばもらえる)
      const eventParticipation=rhythmEventParticipationReward(eventDefinition);
      const eventLimited=boardKind==='limited';
      // 残り時間だけは端末の時計で数える(1秒ごとにサーバーへ聞きに行かないため・§6.1)。
      // 30秒ごとに数え直せば「残り ◯時間 ◯分」の表示には足りる
      const [eventNowMs,setEventNowMs]=React.useState(()=>Date.now());
      React.useEffect(()=>{
        if(!boardTab)return undefined;
        setEventNowMs(Date.now());
        const timer=setInterval(()=>setEventNowMs(Date.now()),30000);
        return ()=>clearInterval(timer);
      },[boardTab]);
      const rankingTabs=[
        {id:'song',label:'この曲'},
        ...(totalReleased?[{id:'total',label:'総合'}]:[]),
        ...(eventReleased?[{id:'weekly',label:'週間'}]:[]),
        // 開催していないあいだはイベントのタブそのものを出さない
        ...(eventReleased&&limitedEvent?[{id:'event',label:'イベント'}]:[]),
      ];
      const openTab=(tab)=>{
        setRhythmRankingTab(tab);
        // 初めて開いたときだけ取りにいく。タブを往復するたびに通信しない
        if(tab==='total'&&total.status==='idle')loadRhythmTotalRanking&&loadRhythmTotalRanking();
        const kind=tab==='weekly'?'weekly':(tab==='event'?'limited':null);
        if(kind&&(!boards[kind]||boards[kind].status==='idle'))loadRhythmEventRanking&&loadRhythmEventRanking(kind,RHYTHM_EVENT_TOTAL_DIVISION);
      };
      // 部門も、初めて開いたときだけ取りにいく
      const openDivision=(divisionId)=>{
        if(!boardKind)return;
        setRhythmEventDivision&&setRhythmEventDivision(prev=>({...prev,[boardKind]:divisionId}));
        const board=event.boards&&event.boards[divisionId];
        if(!board||board.status==='idle')loadRhythmEventRanking&&loadRhythmEventRanking(boardKind,divisionId);
      };
      const refresh=()=>{
        if(boardTab)loadRhythmEventRanking&&loadRhythmEventRanking(boardKind,eventDivisionId);
        else if(totalTabOpen)loadRhythmTotalRanking&&loadRhythmTotalRanking();
        else loadRhythmRanking(song);
      };
      const totalRow=(entry,rank,mine)=>(
        <div data-rhythm-total-row className={`flex items-center gap-2 rounded-2xl border p-2 ${mine?'border-amber-300/60 bg-amber-500/10':'border-white/10 bg-slate-900/80'}`}>
          <b className="w-8 shrink-0 text-center text-xs font-black text-amber-200">{rank?`${rank}`:'—'}</b>
          {rankingBreederIcon(entry)}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{entry.userName}</p>
            <p className="text-[9px] text-slate-400">{entry.songCount} / {totalSongCount}曲 ・ Lv.{entry.level}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-black text-amber-200">{entry.totalScore.toLocaleString()}</p>
            <p className="text-[9px] text-slate-400">{rhythmTotalRankingProgress(entry.totalScore,RHYTHM_SONGS).toFixed(1)}%</p>
          </div>
        </div>
      );
      // イベントの「対象曲」部門の1行。難易度は問わないので、遊んだ難易度も出す
      const eventSongRow=(entry,rank,mine)=>(
        <div data-rhythm-event-row className={`flex items-center gap-2 rounded-2xl border p-2 ${mine?'border-fuchsia-300/60 bg-fuchsia-500/10':'border-white/10 bg-slate-900/80'}`}>
          <b className="w-8 shrink-0 text-center text-xs font-black text-fuchsia-200">{rank?`${rank}`:'—'}</b>
          {rankingBreederIcon(entry)}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{entry.userName}</p>
            <p className="text-[9px] text-slate-400">{RHYTHM_DEMO_DIFFICULTY_LABELS[entry.difficultyId]?.name||entry.difficultyId||'-'} ・ Lv.{entry.level}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-black text-fuchsia-100">{entry.score.toLocaleString()}</p>
            <p className={`text-[10px] font-black ${RHYTHM_RANK_COLORS[rhythmRankForScore(entry.score)]}`}>{rhythmRankForScore(entry.score)}</p>
          </div>
        </div>
      );
      // イベントの「総合」部門の1行。分母は対象曲の数から作る(曲数を書き写さない)
      const eventTotalRow=(entry,rank,mine)=>(
        <div data-rhythm-event-row className={`flex items-center gap-2 rounded-2xl border p-2 ${mine?'border-fuchsia-300/60 bg-fuchsia-500/10':'border-white/10 bg-slate-900/80'}`}>
          <b className="w-8 shrink-0 text-center text-xs font-black text-fuchsia-200">{rank?`${rank}`:'—'}</b>
          {rankingBreederIcon(entry)}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{entry.userName}</p>
            <p className="text-[9px] text-slate-400">{entry.songCount} / {eventSongCount}曲 ・ Lv.{entry.level}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-black text-fuchsia-100">{entry.totalScore.toLocaleString()}</p>
          </div>
        </div>
      );
      const eventRow=(entry,rank,mine)=>eventSongId?eventSongRow(entry,rank,mine):eventTotalRow(entry,rank,mine);
      return (
      <main data-rhythm-ranking className="flex h-full flex-1 flex-col bg-slate-950 text-white">
        <header className="z-10 flex shrink-0 items-center gap-2 border-b border-amber-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
          <button aria-label="戻る" onClick={onBackToSongSelect} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
          <h2 className="text-sm font-black tracking-widest text-amber-200">🏆 全国ランキング</h2>
          <button aria-label="更新" data-rhythm-ranking-refresh onClick={refresh} className="ml-auto min-h-[44px] px-2 text-[10px] font-black text-amber-200">更新</button>
        </header>
        {/* タブ。押したときに初めて取りにいく。公開前はタブごと出さない */}
        {rankingTabs.length>1&&<div data-rhythm-ranking-tabs className="flex shrink-0 gap-1 border-b border-white/10 bg-slate-950/95 px-3 pb-2 pt-1">
          {rankingTabs.map(tab=>(
            <button key={tab.id} data-rhythm-ranking-tab={tab.id} onClick={()=>openTab(tab.id)}
              className={`min-h-[44px] flex-1 rounded-xl border px-2 text-[11px] font-black ${rhythmRankingTab===tab.id?'border-amber-300/60 bg-amber-500/15 text-amber-100':'border-white/10 bg-slate-900/60 text-slate-400'}`}>
              {tab.label}
            </button>
          ))}
        </div>}
        <div className="flex-1 overflow-y-auto mh-scroll px-3 pb-6 pt-3" style={{paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
          {/* ★ここには説明を置かない(2026-09-11・ユーザー指摘
              「ランキングページに余計な説明が多くて見にくい／横画面対応、ページ説明みたいの、
              助手のコメント、これはなくしていいとおもう」)。
              ランキングは順位を見に来る画面なので、読み物は場所を取りすぎる。
              説明はヘルプ(rhythm-ranking)に、案内は曲えらびのみゅあの吹き出しにある。
              ・横画面の案内(RhythmLandscapeHint)  … 曲えらび・遊びかたの側にある
              ・タブごとの説明文                   … ヘルプの「全国ランキング」にある
              ・みゅあの吹き出し                   … 曲えらび(イベント開催中)にある */}
          {totalTabOpen&&(<>
            {total.status==='loading'&&<p data-rhythm-total-loading className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">読み込み中…</p>}
            {/* 集計のしたくがまだのとき。エラーではないので、赤い表示にはしない */}
            {total.status==='notReady'&&<p data-rhythm-total-not-ready className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">総合ランキングはただいま準備中です。もうしばらくお待ちください。</p>}
            {total.status==='error'&&<p data-rhythm-total-error className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">読み込めませんでした。電波の良い場所で「更新」をお試しください。</p>}
            {total.status==='ready'&&(<>
              {/* ★自分の行を上に固定しない(2026-09-11・ユーザー指示
                  「自分の名前の固定はなしでおけ。今後人が増えたらまた考える」)。
                  上位に入っていると、同じ行が「あなたの記録」と一覧の両方に並んで見にくかった。
                  自分の行は一覧の中で色を変えて示す。まだ遊んでいない曲への入口だけは残す */}
              {total.self&&total.self.songCount<totalSongCount&&(
                <button data-rhythm-total-remaining onClick={onGoToSongSelect}
                  className="mb-3 w-full min-h-[44px] rounded-xl border border-amber-300/40 bg-slate-900/70 px-3 text-[10px] font-black text-amber-100">
                  まだ記録のない曲が {totalSongCount-total.self.songCount} 曲あります ▶ 曲をえらぶ
                </button>
              )}
              {!total.self&&<p data-rhythm-total-self-empty className="mb-3 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-center text-[10px] text-slate-300">まだあなたの記録がありません。1曲でも遊ぶとここに載ります。</p>}
              {total.entries.length===0&&<p data-rhythm-total-empty className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">まだ記録がありません。最初の1件になってみましょう。</p>}
              {total.entries.length>0&&<ol data-rhythm-total-list className="space-y-2">
                {total.entries.map((entry,index)=>(
                  <li key={`${entry.identityKey}-${index}`}>
                    {totalRow(entry,index+1,!!total.self&&entry.identityKey===total.self.identityKey)}
                  </li>
                ))}
              </ol>}
            </>)}
          </>)}
          {boardTab&&(<>
            {event.status==='loading'&&<p data-rhythm-event-loading className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">読み込み中…</p>}
            {/* 集計のしたくがまだのとき。エラーではないので、赤い表示にはしない */}
            {event.status==='notReady'&&<p data-rhythm-event-not-ready className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">週間ランキングはただいま準備中です。もうしばらくお待ちください。</p>}
            {event.status==='closed'&&<p data-rhythm-event-closed className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">いま開催しているイベントはありません。次の開催をお待ちください。</p>}
            {event.status==='error'&&<p data-rhythm-event-error className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">読み込めませんでした。電波の良い場所で「更新」をお試しください。</p>}
            {event.status==='ready'&&eventDefinition&&(<>
              {/* 期間はサーバーが決める。残り時間の見た目だけ端末の時計で数える */}
              <div data-rhythm-event-window className="mb-3 flex items-center gap-2 rounded-2xl border border-fuchsia-300/40 bg-slate-900/70 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-black text-fuchsia-100">{eventDefinition.name}</p>
                  {/* 週間は「毎週月曜5:00に切り替わります」、期間限定は開始と終了そのものを出す */}
                  <p data-rhythm-event-period className="text-[9px] text-slate-400">{rhythmEventPeriodText(eventDefinition,eventRange)}</p>
                </div>
                <p data-rhythm-event-remaining className="shrink-0 text-[10px] font-black text-fuchsia-200">
                  {eventRange?rhythmEventRemainingText(eventRange.endMs-eventNowMs):'—'}
                </p>
              </div>
              {/* 部門。対象曲ごと＋総合で、数は対象曲の数から作る */}
              <div data-rhythm-event-divisions className="mb-3 flex flex-wrap gap-1">
                {eventDivisions.map(division=>(
                  <button key={division.id} data-rhythm-event-division={division.id} onClick={()=>openDivision(division.id)}
                    className={`min-h-[44px] flex-1 basis-[45%] rounded-xl border px-2 py-1 text-[10px] font-black leading-tight ${division.id===eventDivisionId?'border-fuchsia-300/60 bg-fuchsia-500/15 text-fuchsia-100':'border-white/10 bg-slate-900/60 text-slate-400'}`}>
                    {division.songId?(rhythmSongFullName(division.song)||division.songId):'総合'}
                  </button>
                ))}
              </div>
              {/* その部門の報酬。何を狙って遊ぶのかが分からないと、そもそも参加してもらえない。
                  順位も個数もデータから作るので、ここに数字を書き写さない */}
              {eventReward&&<div data-rhythm-event-rewards className="mb-3 rounded-2xl border border-amber-300/40 bg-amber-500/5 p-2">
                <p className="mb-1 text-[9px] font-black text-amber-200">この部門の報酬（終了後に受け取れます）</p>
                <ul className="space-y-0.5">
                  {eventRewardRanks.map(({rank,reward})=>(
                    <li key={rank} className="flex items-baseline gap-2 text-[10px] leading-tight">
                      <b className="w-7 shrink-0 text-right font-black text-amber-200">{rank}位</b>
                      <span className="min-w-0 flex-1 text-slate-200">{rhythmEventRewardText(reward)}</span>
                    </li>
                  ))}
                </ul>
                {/* 参加報酬。入賞しなくてももらえるので、順位の表とは分けて出す */}
                {eventParticipation&&<p data-rhythm-event-participation className="mt-2 border-t border-amber-300/20 pt-2 text-[10px] leading-tight text-slate-200">
                  <b className="text-amber-200">参加報酬</b>　対象曲を{eventParticipation.songs}曲すべて遊ぶと {rhythmEventParticipationText(eventParticipation)}
                </p>}
              </div>}
              {eventBoard.status==='loading'&&<p data-rhythm-event-board-loading className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">読み込み中…</p>}
              {eventBoard.status==='error'&&<p data-rhythm-event-board-error className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">この部門を読み込めませんでした。「更新」をお試しください。</p>}
              {eventBoard.status==='ready'&&(<>
                {/* ★自分の行は上に固定しない(2026-09-11・ユーザー指示)。一覧の中で色を変えて示す。
                    まだ1曲も遊んでいない人にだけ、対象曲への入口を出す */}
                {!eventBoard.self&&<div className="mb-3">
                  <p data-rhythm-event-self-empty className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-center text-[10px] text-slate-300">{eventLimited?'まだあなたの記録がありません。対象曲を1曲でも遊ぶとここに載ります。':'今週はまだあなたの記録がありません。対象曲を1曲でも遊ぶとここに載ります。'}</p>
                  <button data-rhythm-event-play onClick={onGoToSongSelect}
                    className="mt-2 w-full min-h-[44px] rounded-xl border border-fuchsia-300/40 bg-slate-900/70 px-3 text-[10px] font-black text-fuchsia-100">▶ 対象曲をえらぶ</button>
                </div>}
                {eventBoard.entries.length===0&&<p data-rhythm-event-empty className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">{eventLimited?'まだ記録がありません。最初の1件になってみましょう。':'今週はまだ記録がありません。最初の1件になってみましょう。'}</p>}
                {eventBoard.entries.length>0&&<ol data-rhythm-event-list className="space-y-2">
                  {eventBoard.entries.map((entry,index)=>(
                    <li key={`${entry.identityKey}-${index}`}>
                      {eventRow(entry,index+1,!!eventBoard.self&&entry.identityKey===eventBoard.self.identityKey)}
                    </li>
                  ))}
                </ol>}
              </>)}
            </>)}
          </>)}
          {songTab&&rhythmRanking.status==='loading'&&<p data-rhythm-ranking-loading className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">読み込み中…</p>}
          {songTab&&rhythmRanking.status==='error'&&<p data-rhythm-ranking-error className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-4 text-center text-xs text-rose-200">読み込めませんでした。電波の良い場所で「更新」をお試しください。</p>}
          {songTab&&rhythmRanking.status==='ready'&&rhythmRanking.entries.length===0&&<p data-rhythm-ranking-empty className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-center text-xs text-slate-300">まだ記録がありません。最初の1件になってみましょう。</p>}
          {songTab&&rhythmRanking.status==='ready'&&rhythmRanking.entries.length>0&&<ol data-rhythm-ranking-list className="space-y-2">
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
