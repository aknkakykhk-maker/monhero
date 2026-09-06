const RhythmOptions=({value,onSave,onBack})=>{
  const [draft,setDraft]=useState(()=>normalizeRhythmSettings(value));
  const [message,setMessage]=useState('');
  // 「叩いて合わせる」を開いているか。設定そのものではないので保存には入れない
  const [calibrating,setCalibrating]=useState(false);
  const previewRef=useRef(null);
  useEffect(()=>()=>{previewRef.current?.stop();previewRef.current=null;},[]);
  const savedValue=normalizeRhythmSettings(value),dirty=JSON.stringify(draft)!==JSON.stringify(savedValue);
  const set=(key,next)=>{setDraft(current=>normalizeRhythmSettings({...current,[key]:next}));setMessage('');};
  const stepper=(key,min,max,step,suffix='',decimals=0)=>{
    const value=Number(draft[key]),percent=Math.max(0,Math.min(100,((value-min)/(max-min))*100));
    const change=direction=>set(key,rhythmStepOptionValue(value,min,max,step,direction));
    const display=`${decimals>0?value.toFixed(decimals):value}${suffix}`;
    return <div data-rhythm-option-stepper={key} className="grid grid-cols-[48px_minmax(54px,1fr)_48px_minmax(54px,auto)] items-center gap-2">
      <button type="button" aria-label={`${key}を下げる`} disabled={value<=min} onClick={()=>change(-1)} className="min-h-[48px] min-w-[48px] rounded-xl border border-white/15 bg-slate-800 text-xl font-black text-slate-100 active:scale-95 disabled:opacity-35">−</button>
      {/* つまんで動かせるスライダー。±ボタンだけだと、音量(0〜100)やノーツ速度のように
          幅の広い項目で何十回も押すことになるため(実機で「めんどう」という報告があった)。
          細かく合わせたいときは左右の±で1目盛りずつ動かす。 */}
      <input type="range" data-rhythm-option-slider={key} aria-label={`${key}を変える`}
        min={min} max={max} step={step} value={value}
        onChange={e=>set(key,rhythmSnapOptionValue(e.target.value,min,max,step))}
        className="mh-rhythm-range h-3 min-w-0 w-full cursor-pointer appearance-none rounded-full border border-white/15 bg-slate-950"
        style={{background:`linear-gradient(90deg,#d946ef 0%,#22d3ee ${percent}%,#020617 ${percent}%,#020617 100%)`}}/>
      <button type="button" aria-label={`${key}を上げる`} disabled={value>=max} onClick={()=>change(1)} className="min-h-[48px] min-w-[48px] rounded-xl border border-white/15 bg-slate-800 text-xl font-black text-slate-100 active:scale-95 disabled:opacity-35">＋</button>
      <output aria-live="polite" className="min-w-[54px] rounded-lg border border-cyan-400/30 bg-slate-950 px-1 py-2 text-center text-xs font-black tabular-nums whitespace-nowrap">{display}</output>
    </div>;
  };
  const toggle=(key,label)=><button type="button" aria-pressed={draft[key]} onClick={()=>set(key,!draft[key])} className={`min-h-[44px] min-w-[88px] rounded-xl border px-4 text-xs font-black ${draft[key]?'border-cyan-200 bg-cyan-600 text-white':'border-white/20 bg-slate-900 text-slate-300'}`}>{label} {draft[key]?'ON':'OFF'}</button>;
  const segments=(key,items)=><div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/20">{items.map(([id,label])=><button type="button" key={id} aria-pressed={draft[key]===id} onClick={()=>set(key,id)} className={`min-h-[44px] border-r border-white/10 px-1 text-[10px] font-black last:border-r-0 ${draft[key]===id?'bg-cyan-600 text-white':'bg-slate-900 text-slate-300'}`}>{label}</button>)}</div>;
  // 【2026-09-05・ユーザー指示】「オプション画面が窮屈すぎる／サイズ感に余裕を持たして」
  // 余白(p-4)・項目の間(py-3)・説明文(10px)をひとまわり広げてある。
  // 数値だけを小さくしていくと、指で押す場所と読む場所がどちらも減っていくので、
  // 「入る量」ではなく「押せる・読める」ほうを優先する。
  const card='rounded-2xl border border-cyan-400/35 bg-slate-900/85 p-4 shadow-[0_0_18px_rgba(34,211,238,.08)]';
  const row='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 py-3 last:border-b-0';
  const head='text-[15px] font-black text-cyan-200';
  const label='text-[13px] font-bold';
  const note='text-[10px] leading-relaxed text-slate-400';
  // 数値の項目。見出し → スライダー → 説明、の順で必ず間を空ける
  const field=(title,control,description=null)=><div className="border-b border-white/10 py-3 last:border-b-0">
    <p className={`mb-2 ${label}`}>{title}</p>
    {control}
    {description&&<p className={`mt-2 ${note}`}>{description}</p>}
  </div>;
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
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2"><button aria-label="戻る" onClick={onBack} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button><div><small className="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small><h2 className="text-base font-black">⚙️ オプション</h2></div></header>
    <div data-rhythm-options-scroll className="flex-1 min-h-0 overflow-y-auto px-3 pb-5 pt-3 mh-scroll">
      <div className="space-y-4">
        <RhythmLandscapeHint/>
        <section className={card}>
          <h3 className={head}>🔊 音量</h3>
          {field('BGM音量',stepper('bgmVolume',0,100,1))}
          {field('タップ音量',stepper('noteSeVolume',0,100,1))}
          <div className={row}><span className={label}>タップ音</span>{toggle('noteSeEnabled','')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3"><button type="button" onClick={previewBgm} className="min-h-[48px] rounded-xl bg-indigo-700 text-[12px] font-black">♪ BGM試聴</button><button type="button" onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)} className="min-h-[48px] rounded-xl bg-fuchsia-700 text-[12px] font-black">タップ音試聴</button></div>
          <p className={`mt-3 ${note}`}>この音量はメインゲームの音量設定と別に、音ゲーだけで使います。タイトル画面の全体ミュートのみ共通です。</p>
        </section>
        <section className={card}>
          <h3 className={head}>🎯 プレイ</h3>
          {field('ノーツ速度',stepper('noteSpeed',RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP,'',1),
            `1.0〜12.0を0.1刻みで調整できます。変わるのはノーツが流れてくる見た目の速さだけで、譜面のタイミング・判定窓・スコアは変わりません（現在 約${rhythmTravelMsForSpeed(draft.noteSpeed).toLocaleString()}ms）。`)}
          {field('ノーツサイズ',stepper('noteSize',80,120,5,'%'),
            'ノーツの見た目の大きさだけを変えます。入力判定の範囲・HOLD/SLIDE帯・ENDバーの位置は変わりません。')}
          {/* 【2026-09-05・ユーザー指示】「ノーツの開始位置（奥行き）もオプションで調整できるようにしたい」
              値そのものは前からあったが、変える場所が画面に無かった。 */}
          {field('ノーツの出る位置（奥行き）',stepper('noteStartPosition',-100,100,5),
            'ノーツが画面のどのあたりから出てくるかを変えます。マイナスにすると奥（画面の上の外側）から、プラスにすると手前寄りから出てきます。判定ラインの位置・判定のタイミング・判定窓・スコアは変わりません。ノーツが流れてくる時間も変わらないので、手前から出すほど見えているあいだの動きは速く見えます。')}
          {field('判定タイミング調整',stepper('judgmentTimingOffsetMs',-100,100,5,'ms'),
            '判定窓の幅は変えず、表示と入力の基準を同じ量だけ補正します。数字で決めにくいときは、下の「叩いて合わせる」で実際に叩いて測れます。')}
          <button type="button" data-rhythm-calibrator-open onClick={()=>setCalibrating(true)} className="mt-3 min-h-[52px] w-full rounded-xl border border-cyan-300/60 bg-cyan-950/50 text-[13px] font-black text-cyan-100">🎯 叩いて合わせる</button>
          <p className={`mt-2 ${note}`}>画面いっぱいで開きます。合わせ終わってから戻ると、ここの数字に入ります（保存はまだされません）。</p>
        </section>
        <section className={card}>
          <h3 className={head}>👁 表示</h3>
          <div className={row}><span className={label}>FAST / SLOW表示</span>{toggle('fastSlowDisplay','')}</div>
          <div className={row}><span className={label}>判定文字表示</span>{toggle('judgmentTextDisplay','')}</div>
          {field('レーン発光',segments('laneGlow',[['NORMAL','標準'],['LOW','控えめ'],['NONE','なし']]))}
        </section>
        <section className={card}>
          <h3 className={head}>🐾 両サイドのマスモン</h3>
          <p className={`mt-2 ${note}`}>レーンの外側の空いたところへ、設定したマスモンが出て拍に合わせて跳ねます。ノーツが見づらいときや、端末が熱くなりやすいときは薄くするか止めてください。</p>
          {field('濃さ',segments('sideMonsterOpacity',[['NORMAL','はっきり'],['SOFT','ふつう'],['FAINT','うっすら'],['OFF','出さない']]))}
          {field('動き',segments('sideMonsterMotion',[['NORMAL','跳ねる'],['SMALL','小さく跳ねる'],['NONE','動かない']]))}
          <div className={row}><span className={label}>能力中に光らせる</span>{toggle('sideMonsterAbilityHighlight','')}</div>
        </section>
        <section className={card}>
          <h3 className={head}>✨ 演出・端末</h3>
          {field('演出量',segments('effectAmount',[['NORMAL','標準'],['LOW','少なめ'],['MINIMAL','最小']]))}
          <div className={row}><span className={label}>振動</span><div className="flex items-center gap-2">
            {/* この端末で振動できるかを出す。iPhoneのSafariには振動のしくみが無い時期が長く、
                「設定はあるのに何も起きない」状態になっていたため(2026-09-05の指摘) */}
            <button type="button" data-rhythm-vibration-test disabled={!RHYTHM_HAPTICS.supported()}
              onClick={()=>RHYTHM_HAPTICS.tap(26)}
              className="min-h-[44px] rounded-xl border border-white/20 bg-slate-900 px-3 text-[11px] font-black text-slate-200 disabled:opacity-40">試す</button>
            {toggle('vibrationEnabled','')}
          </div></div>
          {!RHYTHM_HAPTICS.supported()&&<p data-rhythm-vibration-unsupported className="pb-2 text-[10px] font-bold leading-relaxed text-amber-200">この端末は振動に対応していないため、ONにしても振動しません（音とエフェクトはそのまま出ます）。</p>}
          <div className={row}><span className={label}>軽量モード</span>{toggle('lightweightMode','')}</div>
          <div className={row}><span className={label}>曲えらびで試聴する</span>{toggle('songPreviewEnabled','')}</div>
          {/* 【2026-09-05・ユーザー相談】「演奏中のみ物理的に端末の通知を出さないようにすることは可能？
              オプションでオンオフできて」。できる範囲は端末とブラウザで違うので、
              何が起きるかを必ず添える(黙って効かないのがいちばん困る)。 */}
          <div className={row}><span className={label}>演奏中は通知を出さない</span>{toggle('quietDuringPlay','')}</div>
          <p className={`pb-1 ${note}`}>{rhythmQuietModeSupportText()}</p>
        </section>
        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-950/25 p-4 text-[11px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</section>
      </div>
    </div>
    <footer data-rhythm-options-actions className="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 pt-2 shadow-[0_-8px_24px_rgba(2,6,23,.72)]" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      {message&&<p role="status" className="mb-1 text-center text-[11px] font-black text-amber-300">{message}</p>}
      <div className="grid grid-cols-[.9fr_1.1fr] gap-3"><button type="button" onClick={resetDraft} className="min-h-[52px] rounded-xl border border-white/20 bg-slate-800 px-2 text-[12px] font-black">デフォルトに戻す</button><button type="button" onClick={saveDraft} data-rhythm-options-save data-dirty={dirty?'true':'false'} className={`min-h-[52px] rounded-xl px-3 font-black ${dirty?'bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.35)]':'bg-amber-600 text-slate-950'}`}>{dirty?'変更を保存':'保存'}</button></div>
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
  if(!record||!record.clear)return 'UNPLAYED';
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
const RhythmSongArt=({song,large=false,marked=true})=>{
  const hue=rhythmSongArtHue(song&&song.songId);
  const src=typeof rhythmSongArtSrc!=='undefined'?rhythmSongArtSrc(song):(song&&typeof song.artwork==='string'?song.artwork:'');
  const initial=String((song&&song.displayName)||'♪').trim().charAt(0)||'♪';
  return <span {...(marked?{'data-rhythm-song-art':''}:{})} className={`relative block shrink-0 overflow-hidden rounded-lg border border-white/20 ${large?'w-full':'w-12'}`}
    style={{aspectRatio:'1 / 1',background:`linear-gradient(135deg,hsl(${hue},66%,28%),hsl(${(hue+50)%360},72%,48%))`}}>
    {src
      ?<img src={src} alt="" className="absolute inset-0 h-full w-full object-cover"/>
      :<b aria-hidden="true" className={`absolute inset-0 flex items-center justify-center font-black text-white/90 ${large?'text-5xl':'text-xl'}`}
        style={{textShadow:'0 2px 8px rgba(2,6,23,.55)'}}>{initial}</b>}
  </span>;
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
  songId='',difficultyId='',onSongId=null,onDifficultyId=null,view=null,onView=null})=>{
  const spot=name=>(typeof spotClass==='function'?spotClass(name):'');
  const setView=next=>{if(typeof onView==='function')onView(next);};
  const state=normalizeRhythmSelectView(view);
  const [sortOpen,setSortOpen]=React.useState(false);
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
  // 画面に並べる順。並び替えは**見え方だけ**で、遊べる曲も選んでいる曲も変えない。
  const list=rhythmSortSongs(playable,{sort:state.sort,desc:state.desc,levelOf:rowLevel,difficulties});
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
      node.scrollTop=blockHeight(node);
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
    },140);
  };
  React.useEffect(()=>()=>{if(settleRef.current)clearTimeout(settleRef.current);},[]);
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
          return <li key={`${copy}-${entry.songId}`} aria-hidden={main?undefined:'true'}>
            <button type="button" {...(main?{'data-rhythm-song-row':entry.songId}:{'data-rhythm-song-row-loop':entry.songId})}
              tabIndex={main?undefined:-1} aria-pressed={selected}
              onClick={()=>setSongId(entry.songId)}
              className={`flex w-full min-h-[64px] items-center gap-2 rounded-xl border px-2 py-1.5 text-left ${selected?'border-fuchsia-300 bg-fuchsia-900/50':'border-white/10 bg-slate-900/70'}`}>
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
          <div className="w-16 shrink-0 landscape:mx-auto landscape:w-36"><RhythmSongArt song={song} large/></div>
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
                    return record&&record.clear?record.bestScore.toLocaleString():'—';})()
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
            {best&&best.clear
              ?<>{difficulty.id}の自己ベスト {best.bestScore.toLocaleString()}（ランク {rhythmRankForScore(best.bestScore)}） / 最大コンボ {best.maxCombo}</>
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
