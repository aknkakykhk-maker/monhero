// ============================================================================
// 音ゲー設定(オプション)
// ============================================================================
// 【2026-09-13・ユーザー指示】「下にどんどん伸びていって使いづらい / 1画面に収まるように
//   して、いじりたいやつはタップしたら詳細変えれるとかにしたほうがいい」
//   → そのあと実際の音ゲーの画面を示して「オプションはこういうのを参考にしたい」。
//
// 参考の形に合わせて、次の3つで組み立てる。
//   ① 上のタブで大きく3つに分ける(ライブ / 音量 / システム)。1つのタブに入る量を減らす
//   ② 1項目=1枠。枠の頭に帯のラベルを置き、ON/OFFのような小さい項目は**2列**に並べる
//   ③ 数値は「粗く動かす」「細かく動かす」を左右に分けた4つのボタン(-10 -1 値 +1 +10)。
//      ±1つずつしか無いと、音量(0〜200)のような広い項目で何十回も押すことになる
// つまむスライダーも残す。指で大きく動かすときはこちらのほうが速い。
const RHYTHM_OPTION_TABS=Object.freeze([['live','ライブ'],['volume','音量'],['system','システム']]);
const RhythmOptions=({value,onSave,onBack})=>{
  const [draft,setDraft]=useState(()=>normalizeRhythmSettings(value));
  const [message,setMessage]=useState('');
  // 「叩いて合わせる」を開いているか。設定そのものではないので保存には入れない
  const [calibrating,setCalibrating]=useState(false);
  // どのタブを見ているか。これも設定ではないので保存しない
  const [tab,setTab]=useState('live');
  const previewRef=useRef(null);
  const scrollRef=useRef(null);
  // 【2026-09-13・ユーザー指摘】縦横ボタンで横にしたオプション画面のスクリーンショット。
  //   文字が横倒しのまま、1項目しか見えていなかった。
  // ★原因: モンビーの横画面は**端末を回していない**。器を transform:rotate(90deg) で
  //   回しているだけなので、CSSの landscape: (＝@media (orientation:landscape)) は
  //   縦のままと答える。つまり横向け指定が1つも当たっていなかった。
  // ★なので向きは**JSで決める**。orientationIsLandscape() が端末の向きと自前回転の
  //   両方を見ているので、実際に横にしたときも縦横ボタンで回したときも同じ形になる。
  const [wide,setWide]=useState(()=>orientationIsLandscape());
  useEffect(()=>{
    if(typeof window==='undefined'||typeof window.matchMedia!=='function')return;
    const mql=window.matchMedia('(orientation: landscape)');
    const onChange=()=>setWide(orientationIsLandscape());
    onChange();
    // 自前で回したときは端末の向きが変わらないので matchMedia は鳴らない
    const unsubscribeRotation=RHYTHM_VIEW_ROTATION.subscribe(onChange);
    if(mql.addEventListener)mql.addEventListener('change',onChange);else mql.addListener?.(onChange);
    return()=>{
      unsubscribeRotation();
      if(mql.removeEventListener)mql.removeEventListener('change',onChange);else mql.removeListener?.(onChange);
    };
  },[]);
  useEffect(()=>()=>{previewRef.current?.stop();previewRef.current=null;},[]);
  const savedValue=normalizeRhythmSettings(value),dirty=JSON.stringify(draft)!==JSON.stringify(savedValue);
  const set=(key,next)=>{setDraft(current=>normalizeRhythmSettings({...current,[key]:next}));setMessage('');};
  // タブを変えたら先頭から見せる(前のタブの位置に残ると、開いた先が途中から見える)
  const changeTab=id=>{setTab(id);try{scrollRef.current?.scrollTo({top:0});}catch(_){}};
  const label='text-[13px] font-bold';
  const note='text-[10px] leading-relaxed text-slate-400';
  const head='border-b border-cyan-400/30 pb-1.5 text-[15px] font-black text-cyan-200';
  // 横向きのときは外枠と見出しを省く(すぐ上のタブに同じ名前が出ている)。高さをそのぶん中身へ回す
  const card=wide?'':'rounded-2xl border border-cyan-400/35 bg-slate-900/85 p-4 shadow-[0_0_18px_rgba(34,211,238,.08)]';
  const row='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-3 last:border-b-0';
  // 数値の項目。粗く動かす外側(coarse)と、細かく動かす内側(fine)を分ける。
  // 刻み(step)は保存する値の刻みそのもので、fine は必ずその倍数にする。
  const stepper=(key,min,max,step,{fine=step,coarse=step*10,suffix='',decimals=0}={})=>{
    const value=Number(draft[key]),percent=Math.max(0,Math.min(100,((value-min)/(max-min))*100));
    const nudge=amount=>set(key,rhythmNudgeOptionValue(value,min,max,step,amount));
    const display=`${decimals>0?value.toFixed(decimals):value}${suffix}`;
    const sign=amount=>`${amount>0?'+':''}${decimals>0?Number(amount).toFixed(decimals):amount}`;
    const button=(amount,dim)=><button type="button" aria-label={`${key}を${sign(amount)}`} data-rhythm-option-nudge={`${key}${sign(amount)}`}
      disabled={amount<0?value<=min:value>=max} onClick={()=>nudge(amount)}
      className={`${wide?'min-h-[38px]':'min-h-[46px]'} rounded-xl border ${dim?'border-white/25 bg-slate-300 text-slate-900':'border-white/40 bg-slate-100 text-slate-900'} px-0.5 text-[11px] font-black tabular-nums shadow-[0_2px_0_rgba(2,6,23,.55)] active:translate-y-[1px] active:shadow-none disabled:opacity-35`}>{sign(amount)}</button>;
    return <div data-rhythm-option-stepper={key} className={wide?'':'space-y-1.5'}>
      <div className="grid grid-cols-[1fr_1fr_minmax(52px,1.3fr)_1fr_1fr] items-center gap-1">
        {button(-coarse)}{button(-fine,true)}
        <output aria-live="polite" className={`rounded-lg border-2 border-cyan-300/70 bg-white px-1 text-center font-black tabular-nums text-slate-900 whitespace-nowrap ${wide?'min-h-[38px] text-[13px] leading-[34px]':'min-h-[46px] text-[14px] leading-[42px]'}`}>{display}</output>
        {button(fine,true)}{button(coarse)}
      </div>
      {/* つまんで動かせるスライダーも残す。指で大きく動かすときはこちらのほうが速い。
          ★横向きだけは出さない。高さが足りず、4つのボタンで同じことができる */}
      {!wide&&<input type="range" data-rhythm-option-slider={key} aria-label={`${key}を変える`}
        min={min} max={max} step={step} value={value}
        onChange={e=>set(key,rhythmSnapOptionValue(e.target.value,min,max,step))}
        className="mh-rhythm-range h-3 w-full cursor-pointer appearance-none rounded-full border border-white/15 bg-slate-950"
        style={{background:`linear-gradient(90deg,#d946ef 0%,#22d3ee ${percent}%,#020617 ${percent}%,#020617 100%)`}}/>}
    </div>;
  };
  // ON/OFFは押すたびに入れ替わるボタンではなく、**どちらが今の状態か**が一目で分かる2択にする
  // ON/OFFは**丸いラジオ**にする(参考にした画面と同じ)。押すたびに入れ替わるボタンだと
  // 「いまどちらか」が読み取りにくく、2つのボタンを並べる形だと枠の中で場所を取る。
  const toggle=key=><div data-rhythm-option-onoff={key} role="radiogroup" className="flex items-center justify-center gap-2">
    {[[true,'ON'],[false,'OFF']].map(([flag,text])=><button type="button" key={text} role="radio" aria-checked={draft[key]===flag} aria-label={text} onClick={()=>set(key,flag)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-1 text-[12px] font-black ${wide?'min-h-[38px]':'min-h-[44px]'}`}>
      <span aria-hidden="true" className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 ${draft[key]===flag?'border-cyan-300 bg-cyan-500/20':'border-white/35'}`}>
        {draft[key]===flag&&<span className="h-[9px] w-[9px] rounded-full bg-cyan-300"/>}
      </span>
      <span className={draft[key]===flag?'text-white':'text-slate-400'}>{text}</span>
    </button>)}
  </div>;
  const segments=(key,items)=><div className={`grid ${items.length>=4?'grid-cols-4':'grid-cols-3'} overflow-hidden rounded-xl border border-white/20`}>{items.map(([id,text])=><button type="button" key={id} aria-pressed={draft[key]===id} onClick={()=>set(key,id)} className={`border-r border-white/10 px-1 text-[10px] font-black last:border-r-0 ${wide?'min-h-[38px]':'min-h-[44px]'} ${draft[key]===id?'bg-cyan-600 text-white':'bg-slate-900 text-slate-300'}`}>{text}</button>)}</div>;
  // 1項目=1枠。頭に帯のラベルを置く(参考にした画面と同じ形)。
  // ★ここは項目の「入れ物」なので、余白・字の大きさは2026-09-05に広げたまま触らない。
  // ★数値のように横幅の要る項目は wide。縦持ち(2列)ではぶち抜き、
  //   横持ち(3列)は1列が広いので1つぶんに収める。参考にした画面と同じ並び方。
  // ★数値のように横幅の要る項目は full。縦向き(2列)ではぶち抜き、
  //   横向き(3列)は1列が広いので1つぶんに収める。
  // ★横向きは高さが足りないので、帯と余白を詰め、説明(▸ くわしく)は出さない。
  //   説明は縦向きで読めるので、消したわけではない。
  const field=(title,control,description=null,{full=false}={})=><div data-rhythm-option-field className={`${full&&!wide?'col-span-2':''} rounded-xl border border-cyan-400/20 bg-slate-950/55 ${wide?'p-1.5':'p-2.5'}`}>
    <p className={`rounded-lg bg-cyan-700/70 px-2 text-center ${label} ${wide?'mb-1 py-0.5 text-[11px]':'mb-2 py-1'}`}>{title}</p>
    {control}
    {description&&!wide&&<details data-rhythm-option-help className="mt-2">
      <summary className="min-h-[24px] cursor-pointer list-none text-[10px] font-black leading-[24px] text-cyan-300/90">▸ くわしく</summary>
      <p className={`mt-1 ${note}`}>{description}</p>
    </details>}
  </div>;
  // 横向きは幅が広いので3列。縦向きは2列のまま(1列にすると1つずつしか見えない)
  const grid=`grid gap-2.5 ${wide?'grid-cols-3 gap-2':'grid-cols-2'}`;
  const previewBgm=async()=>{previewRef.current?.stop();previewRef.current=null;const audio=await Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume);previewRef.current=audio;if(!audio)setMessage('BGMを再生できませんでした');};
  const resetDraft=()=>{setDraft(normalizeRhythmSettings(DEFAULT_RHYTHM_SETTINGS));setMessage('画面上の値を戻しました（未保存）');};
  const saveDraft=async()=>{const saved=await onSave(draft);setDraft(saved);setMessage('保存しました');};
  // 「叩いて合わせる」は画面いっぱいで開く(2026-09-05・ユーザー指示
  // 「タップ調整が窮屈で見にくい／専用画面に飛ばしたほうがいい」)。
  // gameStateを増やさずここへ重ねるのは、編集中の値(draft)を持ったままにするため。
  // 別の画面へ飛ばすと、この画面がいったん消えて未保存の変更が全部消える。
  if(calibrating)return <RhythmTimingCalibrator
    currentOffsetMs={draft.judgmentTimingOffsetMs}
    onApply={ms=>{set('judgmentTimingOffsetMs',ms);setMessage(`判定タイミング調整を ${ms>0?'+':''}${ms}ms にしました（未保存）`);}}
    onClose={()=>setCalibrating(false)}/>;
  return <main data-rhythm-options className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)'}}>
    {/* ★横持ちは**高さ**が足りない(390pxしかない)。縦持ちで2段だった「見出し」と「タブ」を、
        横持ちでは**1行へ並べる**。これだけで中身へ回せる高さが50pxほど増える。
        押す場所(戻る・タブ)は44pxのまま縮めない。 */}
    <div data-rhythm-options-bar className={`z-10 shrink-0 border-b border-cyan-400/15 bg-slate-950/95 ${wide?'flex items-center gap-3':''}`}>
      <header className={`flex shrink-0 items-center gap-2 px-3 ${wide?'py-1':'py-2'}`}><button aria-label="戻る" onClick={onBack} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button><div className={wide?'flex items-baseline gap-2':''}><small className="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small><h2 className={`font-black ${wide?'text-[13px]':'text-base'}`}>⚙️ オプション</h2></div></header>
      {/* いま見ているタブだけ色を変え、下へ小さな三角を出して「ここの中身」と分かるようにする */}
      <nav data-rhythm-options-tabs className={`grid shrink-0 grid-cols-3 px-3 ${wide?'min-w-0 flex-1 gap-1.5 pb-0 pl-0 pr-3':'gap-2 pb-2'}`}>
        {RHYTHM_OPTION_TABS.map(([id,text])=><button type="button" key={id} data-rhythm-options-tab={id} aria-pressed={tab===id} onClick={()=>changeTab(id)}
            className={`relative rounded-xl border text-[13px] font-black ${wide?'min-h-[38px]':'min-h-[44px]'} ${tab===id?'border-amber-200 bg-amber-400 text-slate-950':'border-white/15 bg-slate-800 text-slate-300'}`}>
          {text}{tab===id&&!wide&&<span aria-hidden="true" className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-amber-300"/>}
        </button>)}
      </nav>
    </div>
    <div ref={scrollRef} data-rhythm-options-scroll className={`flex-1 min-h-0 overflow-y-auto mh-scroll ${wide?'px-3 pb-2 pt-1.5':'px-3 pb-5 pt-3'}`}>
      <div className={wide?'space-y-2':'space-y-4'}>
        {tab==='live'&&<section data-rhythm-options-panel="live" className={card}>
          {!wide&&<h3 className={head}>◆ ライブ設定</h3>}
          <div className={wide?grid:`mt-3 ${grid}`}>
            {field('ノーツの速さ',stepper('noteSpeed',RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP,{fine:RHYTHM_NOTE_SPEED_STEP,coarse:1,decimals:1}),
              `1.0〜12.0を0.1刻みで調整できます。変わるのはノーツが流れてくる見た目の速さだけで、譜面のタイミング・判定窓・スコアは変わりません（現在 約${rhythmTravelMsForSpeed(draft.noteSpeed).toLocaleString()}ms）。`,{full:true})}
            {field('タイミング調整',<>
              {stepper('judgmentTimingOffsetMs',-RHYTHM_TIMING_OFFSET_MAX_MS,RHYTHM_TIMING_OFFSET_MAX_MS,RHYTHM_TIMING_OFFSET_STEP_MS,{fine:1,coarse:10,suffix:'ms'})}
              <button type="button" data-rhythm-calibrator-open onClick={()=>setCalibrating(true)} className="mt-2 min-h-[46px] w-full rounded-xl border border-cyan-300/60 bg-cyan-950/50 text-[12px] font-black text-cyan-100">🎯 タップで調整</button>
            </>,'判定窓の幅は変えず、表示と入力の基準を同じ量だけ補正します。1ms刻みで動かせます。数字で決めにくいときは「タップで調整」で実際に叩いて測れます。',{full:true})}
            {field('ノーツサイズ',stepper('noteSize',80,120,5,{fine:5,coarse:10,suffix:'%'}),
              'ノーツの見た目の大きさだけを変えます。入力判定の範囲・HOLD/SLIDE帯・ENDバーの位置は変わりません。',{full:true})}
            {/* 【2026-09-05・ユーザー指示】「ノーツの開始位置（奥行き）もオプションで調整できるようにしたい」 */}
            {field('ノーツの出る位置',stepper('noteStartPosition',-100,100,5,{fine:5,coarse:25}),
              'ノーツが画面のどのあたりから出てくるかを変えます。マイナスにすると奥（画面の上の外側）から、プラスにすると手前寄りから出てきます。判定ラインの位置・判定のタイミング・判定窓・スコアは変わりません。ノーツが流れてくる時間も変わらないので、手前から出すほど見えているあいだの動きは速く見えます。',{full:true})}
            {field('FAST / SLOW表示',toggle('fastSlowDisplay'))}
            {field('判定文字表示',toggle('judgmentTextDisplay'))}
            {/* コンボ数は2026-09-12にプレイエリアの真ん中へ移した。場に重なるので、
                邪魔だと感じた人が消せるようにする */}
            {field('コンボ数表示',toggle('comboDisplay'))}
            {field('能力中に光らせる',toggle('sideMonsterAbilityHighlight'))}
            {/* 置き場所も選べる(2026-09-12・ユーザー指示「元位置（元位置より少し右より）とか
                選べるほうがいい」)。「右上」が真ん中へ移す前の位置 */}
            {draft.comboDisplay!==false&&field('コンボ数の位置',segments('comboPosition',RHYTHM_COMBO_POSITION_LABELS),
              '「中央」は場の真ん中（既定）、「右上」は2026-09-12より前と同じ、ライフの下の位置です。どこに置いても判定・スコア・コンボの数え方は変わりません。',{full:true})}
            {field('レーン発光',segments('laneGlow',RHYTHM_LANE_GLOW_LABELS),null,{full:true})}
            {field('両サイドのマスモン｜濃さ',segments('sideMonsterOpacity',RHYTHM_SIDE_MONSTER_OPACITY_LABELS),
              'レーンの外側の空いたところへ、設定したマスモンが出て拍に合わせて跳ねます。ノーツが見づらいときや、端末が熱くなりやすいときは薄くするか止めてください。',{full:true})}
            {field('両サイドのマスモン｜動き',segments('sideMonsterMotion',RHYTHM_SIDE_MONSTER_MOTION_LABELS),null,{full:true})}
          </div>
        </section>}
        {tab==='volume'&&<section data-rhythm-options-panel="volume" className={card}>
          {!wide&&<h3 className={head}>◆ 音量設定</h3>}
          <div className={wide?grid:`mt-3 ${grid}`}>
            {field('BGM音量',stepper('bgmVolume',0,RHYTHM_VOLUME_MAX,1,{fine:1,coarse:10}),null,{full:true})}
            {field('タップ音量',stepper('noteSeVolume',0,RHYTHM_VOLUME_MAX,1,{fine:1,coarse:10}),null,{full:true})}
            {field('タップ音',toggle('noteSeEnabled'))}
            <div className="grid gap-2">
              <button type="button" onClick={previewBgm} className="min-h-[44px] rounded-xl bg-indigo-700 text-[12px] font-black">♪ BGM試聴</button>
              <button type="button" onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)} className="min-h-[44px] rounded-xl bg-fuchsia-700 text-[12px] font-black">タップ音試聴</button>
            </div>
          </div>
          <details data-rhythm-option-help className="mt-3">
            <summary className="min-h-[24px] cursor-pointer list-none text-[10px] font-black leading-[24px] text-cyan-300/90">▸ 音量についてくわしく</summary>
            <p className={`mt-1 ${note}`}>この音量はメインゲームの音量設定と別に、音ゲーだけで使います。タイトル画面の全体ミュートのみ共通です。</p>
            {/* タップ音を10倍にしたので、前に合わせていた人は必ず設定し直すことになる(2026-09-12) */}
            <p className={`mt-2 ${note}`}>2026-09-12にタップ音を大きくしました（それまでの10倍）。以前に音量を合わせていた場合は、タップ音量を下げるかBGM音量を上げて合わせ直してください。</p>
            {/* 上限を200まで開けた(2026-09-12・ユーザー指示)。100の意味は今までと同じ */}
            <p className={`mt-2 ${note}`}>音量は0〜{RHYTHM_VOLUME_MAX}まで上げられます。100はこれまでと同じ大きさです。100より上は端末の音量を上げても足りないときの逃げ道で、とくにBGM音量は上げすぎると曲の大きいところが割れて聞こえることがあります。</p>
          </details>
        </section>}
        {tab==='system'&&<section data-rhythm-options-panel="system" className={card}>
          {!wide&&<h3 className={head}>◆ システム設定</h3>}
          <div className={wide?grid:`mt-3 ${grid}`}>
            {/* 「少なめ」が何を止めるのかを、ここで言い切る(2026-09-13・Android勢から
                「重い」との声)。判定文字の金の帯・虹の流れは毎フレーム字を塗り直すので、
                動きがカクつく端末ではここがいちばん効く */}
            {field('演出量',segments('effectAmount',RHYTHM_EFFECT_LABELS),
              '動きがカクついたり、端末が熱くなったりするときは「少なめ」にしてください。判定文字の金色の帯や虹が流れるのを止め、光のにじみを減らします（色・グラデーション・字の大きさは標準と同じままです）。「最小」にすると、それに加えて100コンボごとの演出や光そのものもほぼ出なくなります。',{full:true})}
            {field('軽量モード',toggle('lightweightMode'))}
            {field('曲えらびで試聴する',toggle('songPreviewEnabled'))}
            {field('タップ時の振動',<>
              {toggle('vibrationEnabled')}
              {/* この端末で振動できるかを出す。iPhoneのSafariには振動のしくみが無い時期が長く、
                  「設定はあるのに何も起きない」状態になっていたため(2026-09-05の指摘) */}
              <button type="button" data-rhythm-vibration-test disabled={!RHYTHM_HAPTICS.supported()}
                onClick={()=>RHYTHM_HAPTICS.tap(26)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-[11px] font-black text-slate-200 disabled:opacity-40">試す</button>
            </>,!RHYTHM_HAPTICS.supported()?'この端末は振動に対応していないため、ONにしても振動しません（音とエフェクトはそのまま出ます）。':null)}
            {/* 【2026-09-05・ユーザー相談】「演奏中のみ物理的に端末の通知を出さないようにすることは可能？
                オプションでオンオフできて」。できる範囲は端末とブラウザで違うので、
                何が起きるかを必ず添える(黙って効かないのがいちばん困る)。 */}
            {field('演奏中は通知を出さない',toggle('quietDuringPlay'))}
          </div>
          <details data-rhythm-option-help className="mt-3">
            <summary className="min-h-[24px] cursor-pointer list-none text-[10px] font-black leading-[24px] text-cyan-300/90">▸ この端末で通知をどこまで止められるか</summary>
            <p className={`mt-1 ${note}`}>{rhythmQuietModeSupportText()}</p>
          </details>
          {!RHYTHM_HAPTICS.supported()&&<p data-rhythm-vibration-unsupported className="mt-2 text-[10px] font-bold leading-relaxed text-amber-200">この端末は振動に対応していないため、ONにしても振動しません（音とエフェクトはそのまま出ます）。</p>}
        </section>}
        {!wide&&<p className="rounded-xl border border-cyan-400/25 bg-cyan-950/25 px-3 py-2 text-[10px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</p>}
      </div>
    </div>
    <footer data-rhythm-options-actions className={`z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 shadow-[0_-8px_24px_rgba(2,6,23,.72)] ${wide?'pt-1.5':'pt-2'}`} style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      {message&&<p role="status" className="mb-1 text-center text-[11px] font-black text-amber-300">{message}</p>}
      {/* 横持ちでは中央寄せで細くする(横いっぱいのボタンは押しにくいだけで、場所も食う) */}
      <div className={`mx-auto grid grid-cols-[.9fr_1.1fr] gap-3 ${wide?'max-w-[520px]':''}`}><button type="button" onClick={resetDraft} className={`rounded-xl border border-white/20 bg-slate-800 px-2 text-[12px] font-black ${wide?'min-h-[42px]':'min-h-[52px]'}`}>デフォルトに戻す</button><button type="button" onClick={saveDraft} data-rhythm-options-save data-dirty={dirty?'true':'false'} className={`rounded-xl px-3 font-black ${wide?'min-h-[42px]':'min-h-[52px]'} ${dirty?'bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.35)]':'bg-amber-600 text-slate-950'}`}>{dirty?'変更を保存':'保存'}</button></div>
    </footer>
  </main>;
};
// モンスターノーツ用のマスモン設定。音ゲーデバッグ画面と体験版ホームの両方から使うため、
// 画面の中へ直接書かずにここで1つにまとめてある。中身と操作はどちらから開いても同じ。
// ============================================================================
// 曲えらび(曲選択画面)
// ============================================================================
// 2026-09-05・ユーザーが示した音ゲーの曲選択画面を参考にした構成。
//   ・真ん中に曲の一覧。1行に「楽曲Lv.」「絵」「曲名」「遊べる難易度」
//   ・選んだ曲の大きな絵と、難易度ボタン、ランダム、決定
//   ・左の「ジャンルタブ」は曲が増えてから足す(いまは曲が少ないので置かない)
//   ・オプション(音ゲー設定)とマスモン設定へはヘッダーから入る
//   ・全国ランキングは曲ごとなので、選んだ曲の欄に置く
// 縦画面では一覧が上・選んだ曲が下、横画面では左右に並ぶ(landscape:)。

// 難易度の色。EASY=緑 / NORMAL=青 / HARD=橙 / EXPERT=赤 / MASTER=紫。
// 一覧のひし形も難易度ボタンも同じ色を使い、画面のどこでも同じ意味になるようにする。
const RHYTHM_DIFFICULTY_TONE=Object.freeze({
  EASY:  Object.freeze({dot:'bg-emerald-400', on:'border-emerald-300 bg-emerald-600 text-white', off:'border-emerald-400/40 text-emerald-200'}),
  NORMAL:Object.freeze({dot:'bg-sky-400',     on:'border-sky-300 bg-sky-600 text-white',         off:'border-sky-400/40 text-sky-200'}),
  HARD:  Object.freeze({dot:'bg-amber-400',   on:'border-amber-300 bg-amber-600 text-white',     off:'border-amber-400/40 text-amber-200'}),
  EXPERT:Object.freeze({dot:'bg-rose-400',    on:'border-rose-300 bg-rose-600 text-white',       off:'border-rose-400/40 text-rose-200'}),
  MASTER:Object.freeze({dot:'bg-fuchsia-400', on:'border-fuchsia-300 bg-fuchsia-700 text-white', off:'border-fuchsia-400/40 text-fuchsia-200'}),
});
const rhythmDifficultyTone=id=>RHYTHM_DIFFICULTY_TONE[id]||RHYTHM_DIFFICULTY_TONE.EASY;

// 一覧に並ぶひし形の色。
// 【2026-09-05・ユーザー指示】
// 「難易度毎にひし形に色分かれてるけどこれは全部同じ色にして、クリアとフルコンボと
//   オールエクセレントとオールマーベラスで色が変わる感じで（どんどん派手な色合い）」
// 難易度そのものでは色を変えない。**どこまで極めたか**だけで色が変わる。
// 上へ行くほど派手になるので、一覧を見ただけで「どの曲をどこまでやったか」が分かる。
const RHYTHM_ACHIEVEMENT_MARKS=Object.freeze({
  NONE:      Object.freeze({label:'譜面なし',
    style:Object.freeze({background:'rgba(255,255,255,.14)'})}),
  UNPLAYED:  Object.freeze({label:'まだ遊んでいない',
    style:Object.freeze({background:'rgba(203,213,225,.55)'})}),
  // 遊んだけれどライフが0になって終わった(2026-09-12に追加)。「まだ遊んでいない」と
  // 区別が付かないままにしないためだけの段で、クリアの段より下に置く
  FAILED:    Object.freeze({label:'失敗（ライフ0）',
    style:Object.freeze({background:'linear-gradient(135deg,#7f1d1d,#dc2626)'})}),
  CLEAR:     Object.freeze({label:'クリア',
    style:Object.freeze({background:'linear-gradient(135deg,#7dd3fc,#22d3ee)'})}),
  FULL_COMBO:Object.freeze({label:'フルコンボ',
    style:Object.freeze({background:'linear-gradient(135deg,#fde68a,#f59e0b)',
      boxShadow:'0 0 4px rgba(251,191,36,.8)'})}),
  ALL_EXCELLENT:Object.freeze({label:'オールエクセレント',
    style:Object.freeze({background:'linear-gradient(135deg,#f0abfc,#a855f7)',
      boxShadow:'0 0 6px rgba(232,121,249,.85)'})}),
  ALL_MARVELOUS:Object.freeze({label:'オールマーベラス',
    style:Object.freeze({background:'linear-gradient(135deg,#fde68a,#f0abfc,#67e8f9,#fde68a)',
      boxShadow:'0 0 8px rgba(240,171,252,.95),0 0 14px rgba(103,232,249,.6)'})}),
});
// 上の段から順に見て、いちばん上の達成を返す。
const rhythmAchievementMarkId=(playable,record)=>{
  if(!playable)return 'NONE';
  if(!record||!record.played)return 'UNPLAYED';
  if(!record.clear)return 'FAILED';
  if(record.allMarvelous)return 'ALL_MARVELOUS';
  if(record.allExcellent)return 'ALL_EXCELLENT';
  if(record.fullCombo)return 'FULL_COMBO';
  return 'CLEAR';
};

// 曲の絵(ジャケット)の下地の色。曲idから決めるので、同じ曲はいつも同じ色になる。
// 絵(artwork)を持たない曲はこの色のタイルに曲名の頭文字が出る。絵を持つ曲でも、
// 絵が届くまでの数フレームと、data/rhythm-mode.js が読めなかったときの受け皿になる。
const rhythmSongArtHue=songId=>{
  const text=String(songId||'');
  let hash=0;
  for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))%360;
  return hash;
};
// 横スワイプのカルーセルで、えらんだカードを中央へ寄せる。
//
// 【なぜ scrollIntoView を使わないか】
// 以前は scrollIntoView({inline:'center',block:'nearest'}) を使っていた。
// block:'nearest' は「縦は必要な分だけ」という意味で、**動かさない**ではない。
// 画面の低い端末ではカードが縦に収まりきらず、そのぶん外側まで縦スクロールしてしまい、
// 画面いちばん上の「← バトル」が上へ追い出されて、指でスクロールしないと戻れなかった
// (2026-09-05・ユーザー指摘、Galaxy Z Fold6)。
// ここでは横の位置だけを自分で計算して動かすので、縦は一切動かない。
const centerCarouselChild = (root, index, behavior = 'auto') => {
  const el = root && root.children && root.children[index];
  if (!root || !el) return;
  const rootBox = root.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const left = root.scrollLeft + (box.left - rootBox.left) - (rootBox.width - box.width) / 2;
  if (typeof root.scrollTo === 'function') root.scrollTo({ left, behavior });
  else root.scrollLeft = left;   // 古いブラウザでも位置だけは合わせる
};

// marked=false は「輪にするために置いた影の行」で使う。同じ目印が3つに増えると、
// 画面を数えて確かめている検査が本物の3倍を見てしまうため、影には目印を付けない。
// onZoom を渡すと、絵のある曲だけ「押せる絵」になる(押すと拡大して見られる)。
// 一覧の行は曲を選ぶボタンそのものなので、渡さない(ボタンの中にボタンは置けない)。
const RhythmSongArt=({song,large=false,marked=true,onZoom=null})=>{
  const hue=rhythmSongArtHue(song&&song.songId);
  const src=typeof rhythmSongArtSrc!=='undefined'?rhythmSongArtSrc(song):(song&&typeof song.artwork==='string'?song.artwork:'');
  const initial=String((song&&song.displayName)||'♪').trim().charAt(0)||'♪';
  const zoomable=!!src&&typeof onZoom==='function';
  const inner=<>
    {src
      ?<img src={src} alt="" className="absolute inset-0 h-full w-full object-cover"/>
      :<b aria-hidden="true" className={`absolute inset-0 flex items-center justify-center font-black text-white/90 ${large?'text-5xl':'text-xl'}`}
        style={{textShadow:'0 2px 8px rgba(2,6,23,.55)'}}>{initial}</b>}
    {/* 押せることが見て分かるように、右下に小さな虫めがねを出す */}
    {zoomable&&<i aria-hidden="true" className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-slate-950/70 text-[10px] leading-none"
      style={{backgroundColor:'rgba(2,6,23,.7)'}}>🔍</i>}
  </>;
  const shape=`relative block shrink-0 overflow-hidden rounded-lg border border-white/20 ${large?'w-full':'w-12'}`;
  const box={aspectRatio:'1 / 1',background:`linear-gradient(135deg,hsl(${hue},66%,28%),hsl(${(hue+50)%360},72%,48%))`};
  if(zoomable)return <button type="button" {...(marked?{'data-rhythm-song-art':''}:{})} data-rhythm-song-art-zoom
    onClick={onZoom} aria-label={`${rhythmSongFullName(song)}のジャケットを大きく見る`}
    className={shape} style={box}>{inner}</button>;
  return <span {...(marked?{'data-rhythm-song-art':''}:{})} className={shape} style={box}>{inner}</span>;
};

// 曲の長さ。譜面の終わりか、曲の再生時間の指定から出す。
const rhythmSongLengthLabel=(song,chart)=>{
  const ms=Number((song&&song.playDurationMs)||(chart&&chart.durationMs)||0);
  if(!Number.isFinite(ms)||ms<=0)return '';
  const total=Math.round(ms/1000);
  return `${Math.floor(total/60)}分${String(total%60).padStart(2,'0')}秒`;
};
// 曲の長さ(ミリ秒)。並び替えの「長さ順」で使う。譜面が無い曲は 0 ではなく
// Infinity を返して**いちばん後ろ**へ回す(長さの分からない曲を先頭に集めない)。
const rhythmSongDurationMs=(song,difficulties)=>{
  const own=Number(song&&song.playDurationMs);
  if(Number.isFinite(own)&&own>0)return own;
  for(const item of (difficulties||[])){
    const chart=song&&song.difficulties&&song.difficulties[item.id];
    const ms=Number(chart&&chart.durationMs);
    if(Number.isFinite(ms)&&ms>0)return ms;
  }
  return Infinity;
};
// 曲の並び替え。**元の配列は書き換えない**(渡されたのは Object.freeze された曲データで、
// 並びそのものが「入手順」という意味を持っているため)。
// 同じ値のときは必ず入手順で決着させる。そうしないと、同じLv.の曲どうしが
// 描き直しのたびに入れ替わって見える。
const rhythmSortSongs=(songs,{sort='added',desc=false,levelOf=null,difficulties=null}={})=>{
  const list=(songs||[]).map((song,index)=>({song,index}));
  const compare=(a,b)=>{
    if(sort==='level'){
      const av=typeof levelOf==='function'?Number(levelOf(a.song))||0:0;
      const bv=typeof levelOf==='function'?Number(levelOf(b.song))||0:0;
      if(av!==bv)return av-bv;
    }else if(sort==='name'){
      const an=rhythmSongFullName(a.song),bn=rhythmSongFullName(b.song);
      // 日本語も並べたいので localeCompare を使う。使えない環境では素の比較へ落ちる
      let diff=0;
      try{diff=an.localeCompare(bn,'ja');}catch(e){diff=an<bn?-1:an>bn?1:0;}
      if(diff!==0)return diff;
    }else if(sort==='length'){
      const av=rhythmSongDurationMs(a.song,difficulties),bv=rhythmSongDurationMs(b.song,difficulties);
      if(av!==bv)return av<bv?-1:1;
    }
    return 0;
  };
  list.sort((a,b)=>{
    const diff=compare(a,b);
    if(diff!==0)return desc?-diff:diff;
    return a.index-b.index;   // 決着がつかないときは入手順(降順でもここは崩さない)
  });
  return list.map(entry=>entry.song);
};

// 譜面が入っている難易度だけを「遊べる」とみなす(押せるのに始まらない状態を作らないため)。
const rhythmChartPlayable=(song,difficultyId)=>{
  const chart=song&&song.difficulties&&song.difficulties[difficultyId];
  return !!chart&&Array.isArray(chart.notes)&&chart.notes.length>0;
};

// footer は「選んでいる曲」を受け取れる。全国ランキングのように**曲ごとに違うもの**を
// 置くため。ただの要素を渡してもよい。
// 曲えらびで曲を鳴らし始めるまでの間。一覧をなぞって選び替えているあいだに
// 曲を読み込み直すと、そのたびに引っかかるので、少し止まってから鳴らす。
const RHYTHM_PREVIEW_DELAY_MS=350;
// 選んでいる曲を鳴らし続ける画面。ここに無い画面へ移ると音は止まる。
//   ・オプション(RHYTHM_OPTIONS) … 「♪ BGM試聴」と重なるので無音のまま(ユーザー指示)
//   ・演奏中(RHYTHM_PLAY)         … 自分で曲を鳴らす
//   ・モンビーの外               … HOMEなどへ戻るので止める
const RHYTHM_PREVIEW_SCREENS=Object.freeze(['RHYTHM_DEMO_HOME','RHYTHM_DEMO_HELP','RHYTHM_DEMO_MONSTERS','RHYTHM_RANKING']);
// spotClass … チュートリアルで光らせる場所に付けるクラスを返す関数(省略時は光らせない)。
// 画面側が知っているキー: songList / songLevel / achievement / difficulty
// 選んでいる曲・難易度は**画面の外(App本体)**で持つ。
// 中で持っていたころは、ランキングやマスモン設定を開いてこの画面が消えるたびに選択が消え、
// 戻ってくると先頭の曲へ戻っていた。選んでいた曲を鳴らし続けるのにも、外から見える必要がある
// (2026-09-05・ユーザー指示「選んでいた音楽が鳴り続けるようにして」)。
const RhythmSongSelect=({songs,difficulties,bestRecords,onPlay,notice=null,footer=null,emptyText='遊べる譜面がまだありません。',spotClass=null,
  songId='',difficultyId='',onSongId=null,onDifficultyId=null,view=null,onView=null,
  listScrollTop=null,onListScrollTop=null})=>{
  const spot=name=>(typeof spotClass==='function'?spotClass(name):'');
  const setView=next=>{if(typeof onView==='function')onView(next);};
  const state=normalizeRhythmSelectView(view);
  const [sortOpen,setSortOpen]=React.useState(false);
  const [genreOpen,setGenreOpen]=React.useState(false);
  // ジャケットを大きく見ているか(2026-09-08・ユーザー指示「モンビー中のジャケットをタップすると拡大画像が見れるように」)。
  // 画面(gameState)は増やさない。曲えらびの上に重ねるだけなので、閉じれば元の場所に戻る。
  const [artZoom,setArtZoom]=React.useState(false);
  const playable=(songs||[]).filter(song=>(difficulties||[]).some(difficulty=>rhythmChartPlayable(song,difficulty.id)));
  const setSongId=id=>{if(typeof onSongId==='function')onSongId(id);};
  const setDifficultyId=id=>{if(typeof onDifficultyId==='function')onDifficultyId(id);};
  // 選んでいる曲・難易度が無くなっても落ちないよう、毎回その場で選び直す
  // (曲を変えたときに「前の曲にしかない難易度」が残らない)。
  // 並び替えても**選んでいる曲は変わらない**(並びは見え方だけの話なので)。
  const song=playable.find(entry=>entry.songId===songId)||playable[0]||null;
  const available=song?(difficulties||[]).filter(difficulty=>rhythmChartPlayable(song,difficulty.id)):[];
  // EXPERT以上は1つ下の難易度をクリアするまで選べない(2026-09-05・ユーザー指示)。
  // 一覧からは消さずに鍵つきで見せる。「先に何をクリアすればよいか」が分かるようにするため。
  const unlocked=item=>!song||rhythmDifficultyUnlocked(song.songId,item.id,bestRecords);
  const openList=available.filter(unlocked);
  const picked=available.find(entry=>entry.id===difficultyId);
  const difficulty=(picked&&unlocked(picked)?picked:null)||openList[0]||null;
  const chart=song&&difficulty?song.difficulties[difficulty.id]:null;
  const best=song&&difficulty?rhythmBestRecord(bestRecords,song.songId,difficulty.id):null;
  // 一覧の「楽曲Lv.」は、いま選んでいる難易度のレベル。その曲に無ければいちばん上の難易度。
  const rowLevel=entry=>{
    const ids=(difficulties||[]).filter(item=>rhythmChartPlayable(entry,item.id)).map(item=>item.id);
    if(!ids.length)return 0;
    const id=difficulty&&ids.includes(difficulty.id)?difficulty.id:ids[ids.length-1];
    return Number(entry.difficulties[id].level)||0;
  };
  // ★イベントの対象曲は、一覧で見てすぐ分かるようにする
  //   (2026-09-11・ユーザー指示「イベント曲は見てすぐ分かるようにして」)。
  //   曲えらびの案内は初回に1度だけで、閉じるともう出ない。だから「いまどれを遊べば
  //   イベントに載るのか」を知る場所が、この一覧のほかに無かった。
  //   ★曲のidはイベントの定義から引く(ここに書き写さない)。開催していなければ何も出ない。
  const eventSongIds=(()=>{
    const released=(typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS&&RELEASE_FLAGS.rhythmWeeklyRanking===true);
    const event=(released&&typeof rhythmLimitedEventAt==='function')?rhythmLimitedEventAt(Date.now()):null;
    return new Set((event&&Array.isArray(event.songIds))?event.songIds:[]);
  })();
  // いま選べるジャンル。★イベント中だけのもの(whileEvent)は、開催していなければ出さない。
  //   ジャンルが1つ(すべて)だけなら、えらぶ意味が無いのでボタンごと出さない
  const genres=RHYTHM_GENRES.filter(item=>!item.whileEvent||eventSongIds.size>0);
  //   保存値が「いま選べないジャンル」を指しているときは「すべて」に倒す。
  //   そうしないと、イベントが終わったあとに一覧が空になる人が出る
  const genre=genres.find(item=>item.id===state.genre)||genres[0];
  const genreMatches=entry=>{
    if(!genre||genre.id==='all')return true;
    if(genre.id==='event')return eventSongIds.has(entry.songId);
    // ★ジャンルを増やしたらここへ1行。曲の側の印を見て決める
    return true;
  };
  // 画面に並べる順。並び替えも絞り込みも**見え方だけ**で、遊べる曲も選んでいる曲も変えない。
  const list=rhythmSortSongs(playable.filter(genreMatches),
    {sort:state.sort,desc:state.desc,levelOf:rowLevel,difficulties});
  const sortLabel=(RHYTHM_SORT_ORDERS.find(item=>item.id===state.sort)||RHYTHM_SORT_ORDERS[0]).label;
  // 選んでいる曲を鳴らすのは App本体(rhythmPreviewTrackId)。ここでは鳴らさない。
  // この画面の中で鳴らしていたころは、ランキングやマスモン設定を開いた瞬間に
  // 画面ごと消えて音が止まっていた。
  // 外へ「いまこの曲を選んでいる」と伝えるだけにする(保存値が空・曲が入れ替わったときの保険)。
  React.useEffect(()=>{
    if(song&&song.songId!==songId)setSongId(song.songId);
  },[song?song.songId:'',songId]);

  const pickRandom=()=>{
    if(!list.length)return;
    const nextSong=list[Math.floor(Math.random()*list.length)];
    const ids=(difficulties||[]).filter(item=>rhythmChartPlayable(nextSong,item.id));
    setSongId(nextSong.songId);
    if(ids.length)setDifficultyId(ids[Math.floor(Math.random()*ids.length)].id);
  };

  // ---- 一覧を輪にする(2026-09-05・ユーザー指示
  //      「1番下にいったら止まるんじゃなくて上に戻ってくるループ式にして」) ----
  //
  // 同じ並びを前・本体・後ろの3つぶん置き、指を止めたときに**本体の同じ位置へ**
  // そっと戻す。見た目は途切れずに繋がり、実際に動いているのは常にまん中になる。
  //
  // 端まで来た瞬間に反対側へ飛ばす作りにしなかったのは、指で送っている最中に
  // 位置が跳ぶと勢い(慣性)が切れて、輪ではなく「引っかかり」に感じるため。
  // 戻すのは指が離れてスクロールが止まってからにする。
  //
  // 曲が1曲しかないときは輪にしない(同じ行が3つ並ぶだけで、かえって分かりにくい)。
  const loopEnabled=list.length>=2;
  const listRef=React.useRef(null);
  const loopReadyRef=React.useRef(false);
  const settleRef=React.useRef(null);
  // 全国ランキングや遊びかたを見て戻ってきたとき、見ていた場所へ戻すための控え。
  // 一覧は「同じ並びを3つ重ねて輪にする」作りで、開くたびにまん中の先頭へ立たせるため、
  // 戻ると必ず先頭に見えていた(2026-09-07・ユーザー報告
  // 「スクロールが初期位置に戻るからどこまで確認してたかわかりづらくなる」)。
  // ★覚えるだけで保存はしない。リロードで消えてよい値
  const restoreTopRef=React.useRef(typeof listScrollTop==='number'&&listScrollTop>0?listScrollTop:null);
  const rememberTop=()=>{const el=listRef.current; if(el&&typeof onListScrollTop==='function')onListScrollTop(el.scrollTop);};
  // 3つぶんのうち、まん中の先頭がどこから始まるか
  const blockHeight=el=>Math.max(1,Math.round(el.scrollHeight/3));
  React.useEffect(()=>{
    const el=listRef.current;
    if(!el)return;
    if(!loopEnabled){loopReadyRef.current=false;return;}
    // 開いた直後は「まん中の先頭」に立たせる。ここが 0 のままだと、
    // 上へ送ったときに輪ではなく行き止まりになる
    const put=()=>{
      const node=listRef.current;
      if(!node)return;
      if(node.scrollHeight<=node.clientHeight){loopReadyRef.current=false;return;}   // 全部見えているなら輪は要らない
      if(loopReadyRef.current)return;                  // もう立っているなら動かさない
      // 戻ってきたときは、前に見ていた場所から始める。無ければまん中の先頭
      const saved=restoreTopRef.current;
      restoreTopRef.current=null;
      node.scrollTop=(saved!=null&&saved>0&&saved<node.scrollHeight)?saved:blockHeight(node);
      loopReadyRef.current=true;
    };
    put();
    // 一覧の高さは外部CDNのTailwindが届いてから決まる。最初に測った時点ではまだ
    // 画面いっぱいに伸びていて「スクロールできない=輪は要らない」と見えてしまい、
    // 遅れてCSSが届いても輪が始まらないままだった。大きさが決まったら置き直す。
    let observer=null;
    if(typeof ResizeObserver==='function'){
      try{observer=new ResizeObserver(()=>put());observer.observe(el);}catch(e){observer=null;}
    }
    return ()=>{if(observer)observer.disconnect();loopReadyRef.current=false;};
  },[loopEnabled,list.length,state.sort,state.desc]);
  const handleListScroll=()=>{
    const el=listRef.current;
    rememberTop();
    if(!el||!loopEnabled)return;
    // ResizeObserver が無い端末でも、動かし始めた時点で輪に入れるようにしておく
    if(!loopReadyRef.current){
      if(el.scrollHeight<=el.clientHeight)return;
      loopReadyRef.current=true;
    }
    if(settleRef.current)clearTimeout(settleRef.current);
    // 指が離れて動きが止まってから、まん中へ戻す
    settleRef.current=setTimeout(()=>{
      const node=listRef.current;
      if(!node||!loopReadyRef.current)return;
      const block=blockHeight(node);
      if(block<=0)return;
      const top=node.scrollTop;
      if(top<block*0.5)node.scrollTop=top+block;
      else if(top>block*1.5)node.scrollTop=top-block;
      rememberTop();
    },140);
  };
  React.useEffect(()=>()=>{if(settleRef.current)clearTimeout(settleRef.current);},[]);
  // 輪にしないとき(曲が1つ)は上の put() を通らないので、ここで戻す。
  // 高さは外部CDNのCSSが届いてから決まるので、少し遅らせてもう一度試す
  React.useEffect(()=>{
    if(loopEnabled)return;
    const saved=restoreTopRef.current;
    restoreTopRef.current=null;
    if(saved==null||saved<=0)return;
    const apply=()=>{const node=listRef.current; if(node&&node.scrollHeight>node.clientHeight)node.scrollTop=saved;};
    apply();
    const id=setTimeout(apply,160);
    return ()=>clearTimeout(id);
  },[loopEnabled]);
  // 前・本体・後ろの3つぶん。本体(copy===1)だけが検査やクリックの目印になる
  // data-rhythm-song-row を持つ。上下のぶんは「同じものの影」なので別の名前にする。
  const blocks=loopEnabled?[0,1,2]:[1];

  return <div data-rhythm-song-select className="flex min-h-0 flex-1 flex-col landscape:flex-row">
    {/* 曲の一覧。案内(notice)はスクロールの**外**へ置き、動くのは曲の並びだけにする。
        中に入れていたときは、曲を探して指を動かすと案内も一緒に流れて場所を食っていた
        (2026-09-05・ユーザー指示「固定タブを利用して音楽だけ動かせるようにしたい」)。 */}
    <div className="flex min-h-0 flex-1 flex-col landscape:border-r landscape:border-white/10">
      {/* 助手のひとことは畳める。曲を探すのに使える高さがそのぶん増える
          (2026-09-05・ユーザー指摘「縦画面の楽曲選択が2曲までしか出ないのがやりづらい」)。
          畳んだかどうかは覚えるので、毎回たたみ直さなくてよい。 */}
      {/* 横画面では助手のひとことを右の欄(aside)へ移す。左は縦がそのまま曲の並びに使えるので、
          同じ画面でも1〜2行ぶん多く見える。出す中身は同じで、置く場所だけがCSSで入れ替わる。 */}
      {notice&&state.noticeOpen&&<div data-rhythm-song-notice className="shrink-0 px-2 pt-2 landscape:hidden">{notice}</div>}
      {/* 並び替えと、助手の開け閉め。1本の行にまとめて、一覧から取る高さを最小にする */}
      <div data-rhythm-song-toolbar className="flex shrink-0 items-center gap-1.5 px-2 pt-2">
        <button type="button" data-rhythm-song-sort onClick={()=>setSortOpen(true)}
          className="flex min-h-[44px] flex-1 items-center justify-between gap-1 rounded-xl border border-white/15 bg-slate-900/80 px-3 text-[11px] font-black text-slate-200">
          <span className="truncate">並び替え：{sortLabel}{state.desc?'（逆）':''}</span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">▾</span>
        </button>
        {/* ★ジャンルの絞り込み。並び替えと同じ行に置いて、縦を1行も増やさない
            (2026-09-11・ユーザー指示「対象曲のところをジャンルに変えて、その中から選べるようにしよう」)。
            並び替えの一覧へ混ぜないのは、これが並び順ではなく絞り込みのため。
            えらべるジャンルが1つ(すべて)だけのときは、ボタンごと出さない */}
        {genres.length>1&&<button type="button" data-rhythm-song-genre={genre?genre.id:'all'} onClick={()=>setGenreOpen(true)}
          className={`flex h-[44px] min-w-0 flex-1 items-center justify-between gap-1 rounded-xl border px-3 text-[11px] font-black ${genre&&genre.id!=='all'?'border-amber-300 bg-amber-500/20 text-amber-100':'border-white/15 bg-slate-900/80 text-slate-200'}`}>
          <span className="truncate">{genre&&genre.id!=='all'?genre.label:'ジャンル：すべて'}</span>
          <span aria-hidden="true" className="shrink-0 text-slate-400">▾</span>
        </button>}
        {notice&&<button type="button" data-rhythm-song-notice-toggle aria-pressed={state.noticeOpen}
          onClick={()=>setView({...state,noticeOpen:!state.noticeOpen})}
          title={state.noticeOpen?'助手のひとことを畳む':'助手のひとことを出す'}
          className={`flex h-[44px] w-[52px] shrink-0 items-center justify-center gap-0.5 rounded-xl border text-[11px] font-black ${state.noticeOpen?'border-fuchsia-300/60 bg-fuchsia-900/40 text-fuchsia-100':'border-white/15 bg-slate-900/80 text-slate-300'}`}>
          <span aria-hidden="true">💬</span><span aria-hidden="true">{state.noticeOpen?'▲':'▼'}</span>
        </button>}
      </div>
    <div ref={listRef} onScroll={handleListScroll}
      data-rhythm-song-list data-rhythm-song-loop={loopEnabled?'1':'0'}
      className={`min-h-0 flex-1 overflow-y-auto mh-scroll px-2 py-2${spot('songList')}`}>
      {list.length===0
        ?<p className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-xs text-slate-300">{emptyText}</p>
        :<ul className="space-y-1.5">{blocks.map(copy=>list.map(entry=>{
          const main=copy===1;
          const selected=!!song&&entry.songId===song.songId;
          const eventSong=eventSongIds.has(entry.songId);
          return <li key={`${copy}-${entry.songId}`} aria-hidden={main?undefined:'true'}>
            <button type="button" {...(main?{'data-rhythm-song-row':entry.songId}:{'data-rhythm-song-row-loop':entry.songId})}
              tabIndex={main?undefined:-1} aria-pressed={selected}
              onClick={()=>setSongId(entry.songId)}
              className={`flex w-full min-h-[64px] items-center gap-2 rounded-xl border px-2 py-1.5 text-left ${selected?'border-fuchsia-300 bg-fuchsia-900/50':eventSong?'border-amber-300/50 bg-amber-500/[0.07]':'border-white/10 bg-slate-900/70'}`}>
              <span className="w-10 shrink-0 text-center">
                <small className="block text-[7px] font-black leading-none text-slate-400">楽曲Lv.</small>
                <b {...(main?{'data-rhythm-song-row-level':''}:{})} className={`mt-0.5 block text-xl font-black leading-none tabular-nums text-white${spot('songLevel')}`}>{rowLevel(entry)}</b>
              </span>
              <RhythmSongArt song={entry} marked={main}/>
              {/* 曲名は**必ず2行分**の場所を取る(行の高さ1.25×2行=2.5em で高さを固定)。
                  1行の曲と2行の曲で行の高さが変わり、一覧の枠がガタガタになっていたため
                  (2026-09-05・ユーザー指摘「文字数で枠がずれるのがださい」)。
                  2行を超える曲は省略する。行そのものにも min-h を置いて下限をそろえる。 */}
              <span className="min-w-0 flex-1">
                <b {...(main?{'data-rhythm-song-row-title':''}:{})} className="block text-[13px] font-black leading-tight text-white"
                  style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.25,height:'2.5em'}}>{rhythmSongFullName(entry)}</b>
                <span className={`mt-1 flex items-center gap-1${spot('achievement')}`}>
                  {(difficulties||[]).map(item=>{
                    const playable=rhythmChartPlayable(entry,item.id);
                    const markId=rhythmAchievementMarkId(playable,playable?rhythmBestRecord(bestRecords,entry.songId,item.id):null);
                    const mark=RHYTHM_ACHIEVEMENT_MARKS[markId];
                    return <i key={item.id} {...(main?{'data-rhythm-achievement':markId}:{})} title={`${item.id}: ${mark.label}`}
                      className="block h-2 w-2 rotate-45 rounded-[1px]" style={mark.style}/>;
                  })}
                  <small className="ml-1 text-[9px] font-bold text-slate-400">
                    {(difficulties||[]).filter(item=>rhythmChartPlayable(entry,item.id)).length}難易度
                  </small>
                  {eventSong&&<small {...(main?{'data-rhythm-song-event':entry.songId}:{})}
                    className="ml-auto shrink-0 rounded-md border border-amber-300/60 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-200">🏆 イベント対象</small>}
                </span>
              </span>
            </button>
          </li>;
        }))}</ul>}
    </div>
    </div>

    {/* 選んでいる曲 */}
    <aside data-rhythm-song-detail
      className="shrink-0 border-t border-white/10 bg-slate-950/90 px-3 py-2 landscape:w-[42%] landscape:max-w-[420px] landscape:overflow-y-auto landscape:border-l landscape:border-t-0 landscape:py-3"
      style={{paddingBottom:'calc(0.5rem + env(safe-area-inset-bottom))'}}>
      {notice&&state.noticeOpen&&<div data-rhythm-song-notice-landscape className="mb-2 hidden landscape:block">{notice}</div>}
      {!song||!difficulty
        ?<p className="text-xs font-bold text-slate-400">遊べる曲がありません。</p>
        :<>
        <div className="flex items-center gap-3 landscape:block">
          <div className="w-16 shrink-0 landscape:mx-auto landscape:w-36"><RhythmSongArt song={song} large onZoom={()=>setArtZoom(true)}/></div>
          {/* ここも一覧と同じ理由で2行分を確保する。曲名が1行か2行かで
              「長さ」「難易度ボタン」「ノーツ数」まで丸ごと上下に動いていた。 */}
          <div className="min-w-0 flex-1 landscape:mt-2 landscape:text-center">
            <b data-rhythm-song-title className="block text-sm font-black leading-tight text-white"
              style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.25,height:'2.5em'}}>{rhythmSongFullName(song)}</b>
            <small className="mt-0.5 block text-[10px] font-bold text-slate-400">{rhythmSongLengthLabel(song,chart)}</small>
          </div>
        </div>

        {/* 難易度をえらぶ */}
        <div data-rhythm-difficulty-row className={`mt-1.5 flex flex-wrap gap-1${spot('difficulty')}`}>
          {available.map(item=>{
            const tone=rhythmDifficultyTone(item.id);
            const open=unlocked(item);
            const on=!!difficulty&&item.id===difficulty.id;
            const need=rhythmDifficultyUnlockRequirement(item.id);
            // 高さは固定(h-[66px])。ロック中だけ「◯◯で解放」が2行になり、
            // その曲だけボタンが高くなって下の行までずれていた。
            return <button key={item.id} type="button" data-rhythm-difficulty={item.id} aria-pressed={on}
              data-rhythm-difficulty-locked={open?'0':'1'} disabled={!open}
              title={open?undefined:`${need}をクリアすると挑めます`}
              onClick={()=>{if(open)setDifficultyId(item.id);}}
              className={`flex h-[60px] flex-1 flex-col justify-center rounded-xl border-2 px-1 text-[10px] font-black leading-tight ${open?(on?tone.on:`${tone.off} bg-slate-900/70`):'border-white/10 bg-slate-900/70 text-slate-500'}`}>
              <span className="block">{open?item.id:`🔒 ${item.id}`}</span>
              <span className="block text-[9px] font-black tabular-nums opacity-90">Lv.{song.difficulties[item.id].level}</span>
              {/* 自己ベストは**難易度ごと**に出す。全国ランキングは難易度をまたいだ
                  合算なので、そちらとは別のものだと分かるように、ここへ並べて置く */}
              <span data-rhythm-difficulty-best={item.id} className="mt-0.5 block text-[9px] font-black tabular-nums opacity-80">
                {open
                  ?(()=>{const record=rhythmBestRecord(bestRecords,song.songId,item.id);
                    return record&&record.played?record.bestScore.toLocaleString():'—';})()
                  :`${need}で解放`}
              </span>
            </button>;
          })}
        </div>

        {/* 「Lv./ノーツ」と自己ベストは同じ1本の行に置く。別々の段に分けていたころは
            そのぶん一覧の高さを取っていた。狭い画面では折り返して2行になる。 */}
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] font-bold">
          <span data-rhythm-demo-level className="text-slate-300">Lv.{chart.level} / {chart.totalNotes}ノーツ</span>
          <span data-rhythm-demo-best className="text-amber-200">
            {best&&best.played
              ?<>{difficulty.id}の自己ベスト {best.bestScore.toLocaleString()}（ランク {rhythmRankForScore(best.bestScore)}） / 最大コンボ {best.maxCombo}{best.clear?'':' / まだクリアしていません'}</>
              :<>まだ遊んでいません</>}
          </span>
        </p>

        <div className="mt-1.5 flex gap-2">
          <button type="button" data-rhythm-song-random onClick={pickRandom}
            className="min-h-[48px] w-[38%] rounded-xl border border-white/20 bg-slate-900 text-xs font-black text-slate-200">ランダム</button>
          <button type="button" data-rhythm-demo-start={difficulty.id}
            onClick={()=>onPlay(song,difficulty)}
            className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-base font-black text-white">決定</button>
        </div>
        {typeof footer==='function'?footer(song,difficulty):footer}
        </>}
    </aside>

    {/* 並び替えのシート。行を1本増やさずに済むよう、選ぶところは下から出す。
        並びを変えても、選んでいる曲・難易度・自己ベスト・全国ランキングは何も変わらない。 */}
    {/* ジャケットの拡大。曲えらびの上に重ねるだけで、選んでいる曲・難易度・再生中の曲は動かさない。
        Tailwindが遅れて届いても真っ黒の背景と中央寄せだけは効くよう、位置と色は style にも書く。 */}
    {artZoom&&song&&<div data-rhythm-song-art-modal role="dialog" aria-modal="true" aria-label={`${rhythmSongFullName(song)}のジャケット`}
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-4"
      style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:9000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
      onClick={()=>setArtZoom(false)}>
      <img src={typeof rhythmSongArtSrc!=='undefined'?rhythmSongArtSrc(song):song.artwork} alt={`${rhythmSongFullName(song)}のジャケット`}
        onClick={e=>e.stopPropagation()}
        className="max-h-[74vh] w-auto max-w-[92vw] rounded-2xl border border-white/25 object-contain"
        style={{maxHeight:'74vh',maxWidth:'92vw'}}/>
      <b className="mt-3 max-w-[92vw] text-center text-sm font-black leading-tight text-white">{rhythmSongFullName(song)}</b>
      <button type="button" data-rhythm-song-art-close onClick={()=>setArtZoom(false)}
        className="mt-3 min-h-[52px] w-full max-w-xs rounded-xl bg-slate-700 text-sm font-black text-white"
        style={{minHeight:'52px'}}>とじる</button>
    </div>}
    {genreOpen&&<div data-rhythm-genre-sheet className="fixed inset-0 z-[9000] flex items-end justify-center"
      style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.72)',zIndex:9000}}
      onClick={()=>setGenreOpen(false)}>
      <section onClick={e=>e.stopPropagation()}
        className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-amber-300/60 bg-slate-900 p-4"
        style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h3 className="text-sm font-black text-white">ジャンル</h3>
        <p className="mt-1 text-[10px] font-bold text-slate-400">出す曲を絞るだけです。遊べる曲・自己ベスト・全国ランキングは変わりません。</p>
        <div className="mt-3 space-y-1.5">
          {genres.map(item=>{
            const on=!!genre&&item.id===genre.id;
            return <button key={item.id} type="button" data-rhythm-genre-option={item.id} aria-pressed={on}
              onClick={()=>{setView({...state,genre:item.id});setGenreOpen(false);}}
              className={`flex min-h-[52px] w-full flex-col justify-center rounded-xl border-2 px-3 text-left ${on?'border-amber-300 bg-amber-500/20':'border-white/15 bg-slate-950/60'}`}>
              <b className="text-xs font-black text-white">{on?'● ':''}{item.label}</b>
              <small className="text-[10px] font-bold text-slate-400">{item.note}</small>
            </button>;
          })}
        </div>
        <button type="button" data-rhythm-genre-close onClick={()=>setGenreOpen(false)}
          className="mt-3 min-h-[52px] w-full rounded-xl bg-slate-700 text-sm font-black text-white">とじる</button>
      </section>
    </div>}
    {sortOpen&&<div data-rhythm-sort-sheet className="fixed inset-0 z-[9000] flex items-end justify-center"
      style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.72)',zIndex:9000}}
      onClick={()=>setSortOpen(false)}>
      <section onClick={e=>e.stopPropagation()}
        className="max-h-[80%] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-fuchsia-400/60 bg-slate-900 p-4"
        style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h3 className="text-sm font-black text-white">曲の並び替え</h3>
        <p className="mt-1 text-[10px] font-bold text-slate-400">並びを変えても、遊べる曲・自己ベスト・全国ランキングは変わりません。</p>
        <div className="mt-3 space-y-1.5">
          {RHYTHM_SORT_ORDERS.map(item=>{
            const on=item.id===state.sort;
            return <button key={item.id} type="button" data-rhythm-sort-option={item.id} aria-pressed={on}
              onClick={()=>{setView({...state,sort:item.id});setSortOpen(false);}}
              className={`flex min-h-[52px] w-full flex-col justify-center rounded-xl border-2 px-3 text-left ${on?'border-fuchsia-300 bg-fuchsia-900/50':'border-white/15 bg-slate-950/60'}`}>
              <b className="text-xs font-black text-white">{on?'● ':''}{item.label}</b>
              <small className="text-[10px] font-bold text-slate-400">{item.note}</small>
            </button>;
          })}
        </div>
        <button type="button" data-rhythm-sort-desc aria-pressed={state.desc}
          onClick={()=>setView({...state,desc:!state.desc})}
          className={`mt-3 flex min-h-[52px] w-full items-center justify-between rounded-xl border-2 px-3 text-xs font-black ${state.desc?'border-cyan-300 bg-cyan-900/40 text-cyan-100':'border-white/15 bg-slate-950/60 text-slate-200'}`}>
          <span>逆から並べる</span><span>{state.desc?'ON':'OFF'}</span>
        </button>
        <button type="button" data-rhythm-sort-close onClick={()=>setSortOpen(false)}
          className="mt-3 min-h-[52px] w-full rounded-xl bg-slate-700 text-sm font-black text-white">とじる</button>
      </section>
    </div>}
  </div>;
};
