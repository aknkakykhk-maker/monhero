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
function SettingsScreen({ onBack, onOpenAudioSettings, onOpenBgmArrangement, onOpenBackup, onOpenHelp, onOpenGameUpdate, gameUpdateDisabled, onReturnToTitle, updateNoticeStyle, onChangeUpdateNoticeStyle }) {
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
        {/* 新しいバージョンのお知らせ(画面へ出るバナー)の出し方。
            2026-09-12・ユーザー依頼「更新バナーのオンオフをゲーム上の設定で出来るようにしたい」。
            選べるのは3つ(UPDATE_NOTICE_STYLE_LABELS が正本。ここへ手で書き写さない)。
            「出さない」を選んでも、すぐ上の「ゲームを更新」からいつでも更新できる。 */}
        <div data-update-notice-setting className="w-full bg-slate-900 border border-white/10 px-3 py-3 rounded-2xl text-left">
          <b className="block text-[13px] font-black text-slate-200">新しいバージョンのお知らせ</b>
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">新しいバージョンが出たときに画面へ出るお知らせです。「小さく」にすると端に小さく出ます。「出さない」を選んでも、上の「ゲームを更新」からいつでも更新できます。</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {UPDATE_NOTICE_STYLE_LABELS.map(option => (
              <button key={option.id} type="button" data-update-notice-style={option.id}
                aria-pressed={updateNoticeStyle === option.id}
                onClick={() => onChangeUpdateNoticeStyle(option.id)}
                className={`min-h-[52px] rounded-xl px-1 py-1.5 text-[11px] font-black leading-tight ${updateNoticeStyle === option.id ? 'bg-cyan-600 text-white' : 'border border-white/15 bg-slate-950 text-slate-300'}`}>
                <span className="block">{option.label}</span>
                <small className="mt-0.5 block text-[8px] font-bold opacity-80">{option.note}</small>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] font-bold leading-relaxed text-slate-500">モンヒロビートの演奏中は、どの設定でも出ません（レーンの上に重なってしまうため）。曲が終わってから出ます。</p>
        </div>
        <div className="text-center text-[9px] font-mono text-slate-600">BUILD {BUILD_DATE}</div>
        <button onClick={onReturnToTitle} className="w-full bg-red-950/50 border border-red-500/40 text-red-200 py-4 rounded-2xl font-black">タイトルへ戻る</button>
      </div>
    </div>
  );
}
