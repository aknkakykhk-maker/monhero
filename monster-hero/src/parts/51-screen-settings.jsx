// ==== 画面: 設定(gameState === 'SETTINGS') ====
//
// MonsterHeroGame から最初に切り出した画面(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-2)。
// 依存が少なく、実ブラウザの検査が厚い(設定 → ヘルプ → デバッグ設定の経路を
// boot/screen-error-boundary-check.js が通り、音量設定と BGM アレンジは audio/* が開く)ので最初に選んだ。
//
// 【切り出しの決めごと】
// ・見た目・文言・並び・遷移先は1文字も変えない。className もそのまま移した
// ・必要な値は props で明示する。setState をそのまま渡すのではなく「押されたら何をするか」を
//   MonsterHeroGame 側に残し、この画面へは出来上がった操作だけを渡す
//   (データ引き継ぎのように setState を5つ呼ぶものが、画面側の知識にならないようにするため)
// ・BUILD_DATE・ArrowLeft・AssistantBubble は共有層(10〜30)の持ち物なので props にしない
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に SETTINGS の行が無い)ので、
//   useScreenEffects はまだ使っていない
function SettingsScreen({ onBack, onOpenAudioSettings, onOpenBgmArrangement, onOpenBackup, onOpenHelp, onOpenGameUpdate, gameUpdateDisabled, onReturnToTitle }) {
  return (
    <div className="flex-1 flex flex-col h-full p-4 overflow-y-auto mh-scroll">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="p-3 text-slate-400"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black italic text-slate-200">設定</h2>
      </div>
      <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="settings"/></div>
      <div className="space-y-3">
        <button onClick={onOpenAudioSettings} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">音量設定</button>
        <button onClick={onOpenBgmArrangement} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">BGMアレンジ</button>
        <button onClick={onOpenBackup} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">データ引き継ぎ</button>
        <button onClick={onOpenHelp} className="w-full bg-slate-900 border border-white/10 py-4 rounded-2xl font-black">ヘルプ</button>
        <button onClick={onOpenGameUpdate} disabled={gameUpdateDisabled} className="w-full bg-slate-900 border border-cyan-500/30 py-3 rounded-2xl font-black disabled:opacity-50"><span className="block text-cyan-200">ゲームを更新</span><span className="block mt-1 text-[10px] text-slate-400">最新のゲームデータを読み込みます</span></button>
        <div className="text-center text-[9px] font-mono text-slate-600">BUILD {BUILD_DATE}</div>
        <button onClick={onReturnToTitle} className="w-full bg-red-950/50 border border-red-500/40 text-red-200 py-4 rounded-2xl font-black">タイトルへ戻る</button>
      </div>
    </div>
  );
}
