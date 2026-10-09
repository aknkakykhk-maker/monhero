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
// ・メニューの1行は SettingsMenuLink ひとつに寄せた(以前は menuClass)。高さ(64px)・角丸・枠線・押した手応えを
//   ここでだけ決める。「ゲームを更新」だけ余白と枠色がずれていたのも同じ型に入れた
// 設定のメニュー1行。「絵＋名前＋説明＋›」。押せる高さは 64px 以上
function SettingsMenuLink({ icon, label, desc, onClick, disabled = false, accent = 'text-white', ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}
      className="mh-button mh-button-secondary w-full min-h-[64px] flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-left active:scale-[.98] disabled:opacity-40">
      {/* 絵文字はCSS(.mh-emoji-icon)で描き、ボタンの文字には含めない。文字が「📚ヘルプ…」になると、
          「ヘルプ」で始まるボタンを探す検査や読み上げが絵文字に引っかかる */}
      <span aria-hidden="true" data-icon={icon} className="mh-emoji-icon w-8 shrink-0 text-center text-[22px] leading-none"/>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-black leading-tight ${accent}`}>{label}</span>
        <span className="mt-0.5 block text-[10px] font-bold leading-snug text-slate-400">{desc}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 opacity-60"/>
    </button>
  );
}

function SettingsScreen({ onBack, onOpenAudioSettings, onOpenBgmArrangement, onOpenTitleArt, onOpenHomeArt, onOpenScreenTheme, onOpenBackup, onOpenHelp, onOpenGameUpdate, gameUpdateDisabled, onReturnToTitle, updateNoticeStyle, onChangeUpdateNoticeStyle, battleScreenStyle, onChangeBattleScreenStyle, battleFxSettings, onChangeBattleFxSetting, battleFxAutoLoad }) {
  // バトル設定は設定画面の中の1ページ(2026-09-24 ユーザー指示「バトルの設定をバラにしないで、
  // 音量設定の上に作ってその中に細かい設定欄を作って」)。画面(gameState)は増やさず、ここで切り替える
  const [battleSettingsOpen, setBattleSettingsOpen] = useState(false);
  // 助手のひとことの出し方(21-assistant.jsx の ASSISTANT_BUBBLE_STORE。早期の return より前で読む)
  const assistantBubble = useAssistantBubbleState();
  if (battleSettingsOpen) {
    return (
      <div data-mh-screen data-battle-settings-page className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="バトル設定" accent="text-cyan-200" onBack={() => setBattleSettingsOpen(false)} backLabel="設定へ戻る"/>
        <div className={`${SCREEN_LIST_CLASS} w-full max-w-md mx-auto space-y-3 pb-4`}>
          {/* バトル設定(2026-09-24 ユーザー指示「バトル設定を作って。タクティクスの旧画面とかあるし何項目か」)。
              バトルの見た目に関わる設定をここへまとめる。項目と文言は BATTLE_FX_SETTING_ITEMS が正本 */}
          <section data-battle-settings className={`${SCREEN_PANEL_CLASS} w-full text-left space-y-3`}>
            <div data-battle-screen-setting>
              <b className="block text-[13px] font-black text-slate-200">タクティクスバトル画面</b>
              <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">タクティクスバトルの表示を選びます。通常のクラシックバトルには影響しません。戦闘ルールは旧／新で共通です。</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
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
            {BATTLE_FX_SETTING_ITEMS.map(item => {
              const current = normalizeBattleFxSettings(battleFxSettings)[item.key];
              return (
                <div key={item.key} data-battle-fx-setting={item.key} className="border-t border-white/10 pt-3">
                  <b className="block text-[13px] font-black text-slate-200">{item.title}</b>
                  <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">{item.desc}</p>
                  {/* 「重いときは自動で軽く」で、いま自動で下げている軽さ(保存はしていない)。選び直すと消える */}
                  {item.key === 'load' && battleFxAutoLoad && battleFxAutoLoad !== current && (
                    <p data-battle-fx-auto-note className="mt-1 rounded-lg border border-amber-400/40 bg-amber-950/30 px-2 py-1 text-[10px] font-bold leading-relaxed text-amber-100">
                      かくつきが続いたので、いまは「{(item.options.find(o => o.id === battleFxAutoLoad) || {}).label}」で表示しています。アプリを開き直すか、ここで選び直すと元に戻ります。
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {item.options.map(option => (
                      <button key={option.id} type="button" data-battle-fx-option={option.id}
                        aria-pressed={current === option.id}
                        onClick={() => onChangeBattleFxSetting(item.key, option.id)}
                        className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-black leading-tight active:scale-95 ${current === option.id ? 'border border-cyan-400 bg-cyan-600 text-white' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
                        <span className="block">{option.label}</span>
                        <small className="mt-0.5 block text-[10px] font-bold opacity-80">{option.note}</small>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    );
  }
  return (
    <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="設定" accent="text-slate-200" onBack={onBack} backLabel="HOMEへ戻る"/>
      <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="settings" compact/></div>
      <div className={`${SCREEN_LIST_CLASS} w-full max-w-md mx-auto space-y-3 pb-4`}>
        {/* 1行ずつ「絵＋名前＋何の設定か」を出す(2026-10-05)。名前だけのボタンが9つ同じ見た目で並び、
            どれが何の設定か押すまで分からなかった。M/B管理・神殿のメニューと同じ形 */}
        <SettingsMenuLink icon="⚔️" label="バトル設定" desc="タクティクスの画面・画面の軽さ・待機中の動き" onClick={() => setBattleSettingsOpen(true)} data-open-battle-settings/>
        <SettingsMenuLink icon="🎚️" label="音量設定" desc="効果音とBGMの大きさ・音が出ないとき" onClick={onOpenAudioSettings}/>
        <SettingsMenuLink icon="🎵" label="BGMアレンジ" desc="場面ごとに流す曲を選ぶ" onClick={onOpenBgmArrangement}/>
        <SettingsMenuLink icon="🖼️" label="タイトル画像アレンジ" desc="タイトル画面の絵を選ぶ" onClick={onOpenTitleArt} data-open-title-art/>
        <SettingsMenuLink icon="🏡" label="ホーム画面アレンジ" desc="ホーム画面の背景を選ぶ" onClick={onOpenHomeArt} data-open-home-art/>
        <SettingsMenuLink icon="🎨" label="画面テーマ" desc="画面ごとにハロウィン／クラシックを選ぶ" onClick={onOpenScreenTheme} data-open-screen-theme/>
        <SettingsMenuLink icon="💾" label="データ引き継ぎ" desc="バックアップの保存と、別の端末での復元" onClick={onOpenBackup}/>
        <SettingsMenuLink icon="📚" label="ヘルプ" desc="遊び方・育て方・画面の説明" onClick={onOpenHelp}/>
        <SettingsMenuLink icon="🔄" label="ゲームを更新" desc="最新のゲームデータを読み込みます" onClick={onOpenGameUpdate} disabled={gameUpdateDisabled} accent="text-cyan-200"/>
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
        {/* 助手のひとことを出す回数(2026-10-10・改善 G6)。選べるのは3つ(ASSISTANT_BUBBLE_MODE_LABELS が正本)。
            止めるのは画面ごとのひとことだけ。はじめての案内・一度きりの案内・HOMEの助手・助手の告知は出る(21-assistant.jsx) */}
        <div data-assistant-bubble-setting className={`${SCREEN_PANEL_CLASS} w-full text-left`}>
          <b className="block text-[13px] font-black text-slate-200">助手のひとこと</b>
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">画面の上に出る助手の吹き出しです。「1日1回」にすると、同じ画面のひとことは1日1回だけ出ます(朝5:00で戻ります)。「出さない」にしても、はじめての案内やHOMEの助手、新しい機能のお知らせは出ます。</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ASSISTANT_BUBBLE_MODE_LABELS.map(option => (
              <button key={option.id} type="button" data-assistant-bubble-mode={option.id}
                aria-pressed={assistantBubble.mode === option.id}
                onClick={() => ASSISTANT_BUBBLE_STORE.setMode(option.id)}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-black leading-tight active:scale-95 ${assistantBubble.mode === option.id ? 'border border-cyan-400 bg-cyan-600 text-white' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
                <span className="block">{option.label}</span>
                <small className="mt-0.5 block text-[10px] font-bold opacity-80">{option.note}</small>
              </button>
            ))}
          </div>
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

// タイトル画像アレンジ・ホーム画面アレンジで使う「絵を選ぶ」窓。
// options は { id, label, desc, src } の並び(TITLE_ART_OPTIONS / HOME_ART_OPTIONS)
function ArtPickerModal({ pickerId, heading, note, options, value, resolved, onChange, onClose }) {
  const auto=value==='auto';
  return (
    <div className="mh-title-modal" onPointerDown={e=>e.stopPropagation()}>
      <div className="mh-title-dialog" data-art-picker={pickerId} style={{maxHeight:'calc(var(--mh-vh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)',overflowY:'auto'}}>
        <div className="mh-dialog-head"><h3>{heading}</h3><button onClick={onClose} aria-label="閉じる"><X size={18}/></button></div>
        <p className="text-[11px] font-bold leading-relaxed text-slate-300">{note}</p>
        {/* おまかせは季節に合わせて切り替わる(10月中はハロウィン、11月からクラシック) */}
        <button type="button" aria-pressed={auto} onClick={()=>onChange('auto')} className={`w-full min-h-[44px] rounded-xl border-2 px-3 py-2 text-left text-[12px] font-black ${auto?'border-amber-300 bg-amber-500/15 text-amber-100':'border-white/15 bg-white/5 text-slate-200'}`}>おまかせ(季節に合わせて切り替え){auto&&<small className="block text-[10px] font-bold text-amber-200/80">いまは「{(options.find(o=>o.id===resolved)||options[0]).label}」を出しています</small>}</button>
        <div className="grid grid-cols-2 gap-3">{options.map(option=>{
          const selected=value===option.id;
          return <button key={option.id} type="button" aria-pressed={selected} onClick={()=>onChange(option.id)} className={`relative flex flex-col overflow-hidden rounded-2xl border-2 text-left ${selected?'border-amber-300 bg-amber-500/15 shadow-[0_0_16px_rgba(252,211,77,.45)]':'border-white/15 bg-white/5'}`}>
            <img src={option.src} alt={option.label} loading="lazy" className="block w-full aspect-[9/16] object-cover"/>
            {selected&&<span className="absolute right-1.5 top-1.5 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-slate-900">選択中</span>}
            {auto&&resolved===option.id&&<span className="absolute right-1.5 top-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-black text-slate-900">おまかせ中</span>}
            <span className="block px-2 pt-1.5 text-[13px] font-black text-white">{option.label}</span>
            <small className="block px-2 pb-2 text-[10px] font-bold leading-snug text-slate-400">{option.desc}</small>
          </button>;
        })}</div>
        <button type="button" className="mh-button mh-button-primary w-full min-h-[52px] rounded-xl font-black text-[14px] active:scale-[.98]" onClick={onClose}>決定</button>
      </div>
    </div>
  );
}

// 画面テーマ。画面の種類ごとに おまかせ/ハロウィン/クラシック を選ぶ。
// タイトルとホームの絵も同じ3択でここから変えられる(絵を見て選びたいときは各アレンジ画面から)
function ScreenThemeModal({ screenTheme, onChange, titleArt, onChangeTitleArt, homeArt, onChangeHomeArt, onClose }) {
  const rows = [
    { id: 'title', label: 'タイトル画面', desc: 'タイトル画面の絵', value: titleArt, set: onChangeTitleArt },
    { id: 'home', label: 'ホーム画面', desc: 'ホーム画面の背景', value: homeArt, set: onChangeHomeArt },
    ...SCREEN_THEME_READY_CATEGORIES.map(category => ({ ...category, value: screenTheme[category.id], set: choice => onChange(category.id, choice) })),
  ];
  const setAll = choice => { onChangeTitleArt(choice); onChangeHomeArt(choice); onChange('*', choice); };
  const chip = (selected) => `min-h-[44px] flex-1 rounded-lg border px-1 text-[11px] font-black ${selected ? 'border-amber-300 bg-amber-500/25 text-amber-100' : 'border-white/15 bg-white/5 text-slate-300'}`;
  return (
    <div className="mh-title-modal" onPointerDown={e=>e.stopPropagation()}>
      <div className="mh-title-dialog" data-screen-theme-picker style={{maxHeight:'calc(var(--mh-vh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)',overflowY:'auto'}}>
        <div className="mh-dialog-head"><h3>画面テーマ</h3><button onClick={onClose} aria-label="閉じる"><X size={18}/></button></div>
        <p className="text-[11px] font-bold leading-relaxed text-slate-300">画面の種類ごとに見た目を選べます。「おまかせ」は季節に合わせて切り替わり、10月31日まではハロウィン、11月1日からはクラシックになります。</p>
        <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2">
          <b className="block text-[12px] font-black text-amber-100">まとめて変える</b>
          <div className="mt-1.5 flex gap-1.5">{SCREEN_THEME_CHOICES.map(choice => <button key={choice.id} type="button" onClick={() => setAll(choice.id)} className={chip(false)}>{choice.label}</button>)}</div>
        </div>
        {rows.map(row => (
          <div key={row.id} data-screen-theme-row={row.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
            <b className="block text-[12px] font-black text-white">{row.label}</b>
            <small className="block text-[10px] font-bold text-slate-400">{row.desc}</small>
            <div className="mt-1.5 flex gap-1.5">{SCREEN_THEME_CHOICES.map(choice => <button key={choice.id} type="button" aria-pressed={row.value === choice.id} onClick={() => row.set(choice.id)} className={chip(row.value === choice.id)}>{choice.label}</button>)}</div>
          </div>
        ))}
        <button type="button" className="mh-button mh-button-primary w-full min-h-[52px] rounded-xl font-black text-[14px] active:scale-[.98]" onClick={onClose}>決定</button>
      </div>
    </div>
  );
}
