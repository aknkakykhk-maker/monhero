// ==== 画面: 設定(gameState === 'SETTINGS') ====
//
// MonsterHeroGame から最初に切り出した画面(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-2)。
// 依存が少なく、実ブラウザの検査が厚い(設定 → ヘルプ → デバッグ設定の経路を
// boot/screen-error-boundary-check.js が通り、音量設定と BGM アレンジは audio/* が開く)ので最初に選んだ。
//
// 【切り出しの決めごと】
// ・文言・並び・遷移先は1文字も変えない
// ・必要な値は props で明示する。setState をそのまま渡すのではなく「押されたら何をするか」を
//   MonsterHeroGame 側に残し、この画面へは出来上がった操作だけを渡す
//   (データ引き継ぎのように setState を5つ呼ぶものが、画面側の知識にならないようにするため)
// ・BUILD_DATE・ArrowLeft・AssistantBubble は共有層(10〜30)の持ち物なので props にしない
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に SETTINGS の行が無い)ので、
//   useScreenEffects はまだ使っていない
//
// 【2026-09-18・見た目をそろえたときの決めごと】
// ・この画面だけ根に data-mh-screen が無く、画面ぜんぶが一枚でスクロールしていた。
//   根は SCREEN_SHELL_CLASS、中身は根の直下の SCREEN_LIST_CLASS へ移した
//   (横画面で「左＝見出し・助手 / 右＝メニュー」に組み替わるのも、この形が条件)
// ・メニューの1行は menuClass ひとつに寄せた。高さ(64px)・角丸・枠線・押した手応えを
//   ここでだけ決める。「ゲームを更新」だけ余白と枠色がずれていたのも同じ型に入れた
function SettingsScreen({ onBack, onOpenAudioSettings, onOpenBgmArrangement, onOpenBackup, onOpenHelp, onOpenGameUpdate, gameUpdateDisabled, onReturnToTitle, updateNoticeStyle, onChangeUpdateNoticeStyle, battleScreenStyle, onChangeBattleScreenStyle }) {
  const menuClass = 'mh-button mh-button-secondary w-full min-h-[64px] flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-black active:scale-[.98]';
  return (
    <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="設定" accent="text-slate-200" onBack={onBack} backLabel="HOMEへ戻る"/>
      <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="settings"/></div>
      <div className={`${SCREEN_LIST_CLASS} w-full max-w-md mx-auto space-y-3 pb-4`}>
        <button type="button" onClick={onOpenAudioSettings} className={menuClass}>音量設定</button>
        <button type="button" onClick={onOpenBgmArrangement} className={menuClass}>BGMアレンジ</button>
        <button type="button" onClick={onOpenBackup} className={menuClass}>データ引き継ぎ</button>
        <button type="button" onClick={onOpenHelp} className={menuClass}>ヘルプ</button>
        <div data-battle-screen-setting className={`${SCREEN_PANEL_CLASS} w-full text-left`}>
          <b className="block text-[13px] font-black text-slate-200">バトル画面</b>
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">使用するバトル画面を選びます。タクティクス旧／新は表示だけが切り替わり、戦闘ルールは共通です。</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {BATTLE_SCREEN_STYLE_LABELS.map(option => (
              <button key={option.id} type="button" data-battle-screen-style={option.id}
                aria-pressed={battleScreenStyle === option.id}
                onClick={() => onChangeBattleScreenStyle(option.id)}
                className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[10px] font-black leading-tight active:scale-95 ${battleScreenStyle === option.id ? 'border border-cyan-400 bg-cyan-600 text-white' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
                <span className="block">{option.label}</span>
                <small className="mt-0.5 block text-[9px] font-bold opacity-80">{option.note}</small>
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={onOpenGameUpdate} disabled={gameUpdateDisabled} className={`${menuClass} flex-col disabled:opacity-40`}><span className="block text-cyan-200">ゲームを更新</span><span className="mt-1 block text-[10px] text-slate-400">最新のゲームデータを読み込みます</span></button>
        {/* 新しいバージョンのお知らせ(画面へ出るバナー)の出し方。
            2026-09-12・ユーザー依頼「更新バナーのオンオフをゲーム上の設定で出来るようにしたい」。
            選べるのは3つ(UPDATE_NOTICE_STYLE_LABELS が正本。ここへ手で書き写さない)。
            「出さない」を選んでも、すぐ上の「ゲームを更新」からいつでも更新できる。 */}
        <div data-update-notice-setting className={`${SCREEN_PANEL_CLASS} w-full text-left`}>
          <b className="block text-[13px] font-black text-slate-200">新しいバージョンのお知らせ</b>
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">新しいバージョンが出たときに画面へ出るお知らせです。「小さく」にすると端に小さく出ます。「出さない」を選んでも、上の「ゲームを更新」からいつでも更新できます。</p>
          {/* 選ばれている側にも枠を持たせる。tailwind の preflight が border:0 を敷いているので、
              片方だけ border クラスが無いと、選ぶたびに中身が1pxずれる */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {UPDATE_NOTICE_STYLE_LABELS.map(option => (
              <button key={option.id} type="button" data-update-notice-style={option.id}
                aria-pressed={updateNoticeStyle === option.id}
                onClick={() => onChangeUpdateNoticeStyle(option.id)}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-black leading-tight active:scale-95 ${updateNoticeStyle === option.id ? 'border border-cyan-400 bg-cyan-600 text-white' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
                <span className="block">{option.label}</span>
                <small className="mt-0.5 block text-[10px] font-bold opacity-80">{option.note}</small>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">モンヒロビートの演奏中は、どの設定でも出ません（レーンの上に重なってしまうため）。曲が終わってから出ます。</p>
        </div>
        {/* 「タイトルへ戻る」は後戻りの大きい操作なので、区切り線でメニューから切り離す */}
        <div className="border-t border-white/10 pt-6 space-y-3">
          <div className="text-center text-[10px] font-mono text-slate-400">BUILD {BUILD_DATE}</div>
          <button type="button" onClick={onReturnToTitle} className="mh-button mh-button-danger w-full min-h-[64px] flex items-center justify-center rounded-2xl border border-red-500/40 bg-red-950/50 px-4 py-3 font-black text-red-200 active:scale-[.98]">タイトルへ戻る</button>
        </div>
      </div>
    </div>
  );
}
