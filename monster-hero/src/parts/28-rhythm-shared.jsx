// 終わり際に離す猶予(RHYTHM_HOLD_RELEASE_GRACE_MS)と、
// 途中で指を持ち替える猶予(RHYTHM_HOLD_HANDOVER_GRACE_MS)は data/rhythm-mode.js が持つ。
// 持ち替えは「指を離す側(ここ)」と「置き直した指をノーツへ結びつける側(rhythm-mode.js)」の
// 両方が同じ数字を見ないと成立しないので、先に読み込まれるほうへ1つだけ置いてある。
// 最後まで取れたHOLD / SLIDE / FLICKを、消える前に光らせておく時間(CSSのアニメーションと同じ長さ)
const RHYTHM_CLEAR_FLASH_MS=260;
const RHYTHM_JUDGMENT_DISPLAY_MS=450;
// 能力の発動表示(「ミーア　元気！」)。判定表示より少し長く出して、何が起きたか読めるようにする
const RHYTHM_MONSTER_ABILITY_DISPLAY_MS=1400;
const rhythmInputKey=(kind,id)=>`${kind}:${id}`;
// 6.0はSTEP1以前の見た目(2150ms)を厳密に維持しつつ、1.0(約7000ms)〜12.0(約500ms)まで
// 音ゲーとして意味のある幅へ広げる。整数速度を基準点として0.1刻みで線形補間する。
// 低速側は等差で「ゆっくり見える」幅を確保し、高速側は約1.27倍ずつの等比で詰めるため、
// どの帯域でも0.1動かせば見た目が変わる。
// authored note time・BPM・beatZero・判定窓・入力時刻・スコアには使わず、描画travelだけに使用する。
// 譜面より音源が長い曲を途中で終わらせるときの、音の落とし方。
// FADE=消していく時間 / MARGIN=「音源のほうが長い」と見なす差
// (これより短い差なら曲が自然に終わるところなので、何もしない)。
const RHYTHM_END_FADE_MS=1400;
const RHYTHM_END_FADE_MARGIN_MS=1500;
const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;
const RHYTHM_NOTE_TRAVEL_MS_POINTS=Object.freeze([7000,6000,5000,4000,3000,RHYTHM_NOTE_TRAVEL_BASE_MS,1680,1300,1020,800,630,500]);
// 横画面で「見た目の飛行時間(travelMs)をプレイエリアの高さに応じて伸ばす」対応を一度入れたが、
// 実機フィードバックで「落下速度が遅くなるのはおかしい、縦画面と同じにしてほしい」と指摘され
// 取り消した(2026-09-03)。travelMsは向きに関係なく常にrhythmTravelMsForSpeedの値のみを使う。
const rhythmTravelMsForSpeed=value=>{
  // null / undefined / 空文字は「値なし」として既定へ落とす(Number()では0になってしまう)。
  const raw=value==null||value===''?NaN:Number(value),fallback=DEFAULT_RHYTHM_SETTINGS.noteSpeed;
  const speed=Math.max(RHYTHM_NOTE_SPEED_MIN,Math.min(RHYTHM_NOTE_SPEED_MAX,Number.isFinite(raw)?raw:fallback));
  const offset=speed-RHYTHM_NOTE_SPEED_MIN;
  const index=Math.max(0,Math.min(RHYTHM_NOTE_TRAVEL_MS_POINTS.length-2,Math.floor(offset)));
  const from=RHYTHM_NOTE_TRAVEL_MS_POINTS[index],to=RHYTHM_NOTE_TRAVEL_MS_POINTS[index+1];
  return Math.round(from+(to-from)*(offset-index));
};
const rhythmStepOptionValue=(value,min,max,step,direction)=>Math.max(min,Math.min(max,Number((Number(value)+direction*step).toFixed(6))));
// スライダーでつまんだ値を、その項目の目盛り(step)に合わせて丸める。
// 範囲外・数値でない値は必ず範囲の中へ収める(壊れた値を設定へ入れない)。
const rhythmSnapOptionValue=(value,min,max,step)=>{
  const raw=Number(value);
  if(!Number.isFinite(raw))return min;
  const snapped=min+Math.round((raw-min)/step)*step;
  return Math.max(min,Math.min(max,Number(snapped.toFixed(6))));
};
// 縦画面のときだけ出す「横画面にも対応している」案内(2026-09-05・ユーザー指示)。
// 音ゲー中(RHYTHM_PLAY)には置かない。プレイ中に文字が増えると譜面が読みにくくなるため。
// 出し分けはCSS(portrait:)だけで行う。JSで向きを見張ると、回すたびに再描画が走って重くなる。
const RhythmLandscapeHint=({className=''})=>
  <p data-rhythm-landscape-hint className={`hidden portrait:block rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[9px] font-bold leading-relaxed text-cyan-100 ${className}`}>
    📱 横画面にも対応しています。端末を横にすると、曲の一覧と選んだ曲を左右に並べて見られます。曲えらびの「🔄 横」ボタンからも切り替えられます。
  </p>;
// ============================================================================
// 縦画面 ⇄ 横画面の切り替え
// ============================================================================
// 【2026-09-05・ユーザー指示】
// 「モンビーのホーム画面に縦画面横画面切り替えボタンを作って／縦なら横に横なら縦に変わるボタン」。
//
// 【なぜ要るか】
// 端末側の画面回転ロックを入れていると、本体を横にしても画面は縦のままになる。
// モンビーは横画面のほうが曲の一覧と選んだ曲を同時に見られるのに、
// 回転ロックを解除しに設定アプリまで行かないと横にできなかった。
//
// 【どうやるか】
// ブラウザの screen.orientation.lock() で向きを指定する。多くのブラウザは
// 「全画面表示のあいだだけ」向きの固定を許すので、必要なら先に全画面へ入る。
// iOSのSafariのように lock() 自体が無い環境もあるため、できなかったときは
// 黙って何も起きないのではなく「端末を回してください」と案内へ切り替える。
const screenOrientationApi=()=>{
  if(typeof window==='undefined')return null;
  const o=window.screen&&window.screen.orientation;
  return (o&&typeof o.lock==='function')?o:null;
};
// 端末そのものがいま横向きか。
//
// 【なぜ画面の形を先に見るか】(2026-09-06・Galaxy Z Fold6での報告)
// 折りたたみを開いた内側の画面のような**大きい画面では、端末が向きの指定を無視することがある**。
// やっかいなのは、無視されても lock() は例外を投げず、素通りして成功したように見えること。
// このとき screen.orientation.type だけが「横になった」と言い、画面は1ミリも動かない、
// ということが起きうる。type を信じると「回った」と勘違いして、そこで話が終わってしまう。
//
// 画面の形(ビューポートの幅と高さ)は、遊ぶ人が実際に見ているものそのもので、
// 勘違いのしようがない。CSSのメディアクエリ (orientation: landscape) や Tailwind の
// landscape: も同じ基準なので、こちらへそろえておけば画面の並びと判断が食い違わない。
// screen.orientation.type は、どちらも使えない環境のための最後の手段に下げた。
//
// これがあるから waitForScreenOrientation が「受け付けられたのに回っていない」を見抜けて、
// 自前で回すほう(二の矢)へ進める。
const deviceIsLandscape=()=>{
  if(typeof window==='undefined')return false;
  if(typeof window.matchMedia==='function')return window.matchMedia('(orientation: landscape)').matches;
  const w=Number(window.innerWidth),h=Number(window.innerHeight);
  if(w>0&&h>0)return w>h;
  const o=window.screen&&window.screen.orientation;
  if(o&&typeof o.type==='string')return o.type.indexOf('landscape')===0;
  return false;
};
// 遊ぶ人から見ていま横向きか。自前で回しているあいだは端末の向きと**逆**になる
// (端末は縦のまま、絵だけ90度回して横向きに見せているため)。
// ボタンの表示も案内も、端末の都合ではなく見えている向きで決めたいのでこちらを使う。
const orientationIsLandscape=()=>{
  const device=deviceIsLandscape();
  return RHYTHM_VIEW_ROTATION.active()?!device:device;
};
// ボタンで向きを固定したかどうか。モンビーを離れるときに戻すために覚えておく
// (プレイ画面へ移るだけで戻してしまうと、演奏の途中で向きが変わってしまう)
let screenOrientationLockedByUs=false;
// 全画面を抜けると、ブラウザが向きの固定も一緒に外す。
// こちらが知らないうちに外れることがある(端末の「戻る」ボタン・スワイプなど)ので、
// 外れたことに気づいて控えも合わせておく。合っていないと、モンビーを離れるときに
// 「もう外れている固定」を外そうとしたり、逆に外し忘れたりする。
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement)screenOrientationLockedByUs=false;
  });
}
// 向きが**実際に変わる**のを待つ。
// lock() は「受け付けた」だけで解決することがあり、画面が回るのはそのあと。
// ここを待たずに次へ進むと、回っていないのに「できた」と扱ってしまい、
// 押しても何も起きないのに案内も出ない、という状態になる。
const waitForScreenOrientation=(want,timeoutMs=900)=>{
  const wantLandscape=want==='landscape';
  if(orientationIsLandscape()===wantLandscape)return Promise.resolve(true);
  if(typeof window==='undefined')return Promise.resolve(false);
  return new Promise(resolve=>{
    let settled=false;
    const orientation=window.screen&&window.screen.orientation;
    const mql=typeof window.matchMedia==='function'?window.matchMedia('(orientation: landscape)'):null;
    const cleanup=()=>{
      clearTimeout(timer);
      if(orientation&&orientation.removeEventListener)orientation.removeEventListener('change',onChange);
      if(mql){
        if(mql.removeEventListener)mql.removeEventListener('change',onChange);
        else if(mql.removeListener)mql.removeListener(onChange);
      }
      if(typeof window.removeEventListener==='function')window.removeEventListener('resize',onChange);
    };
    const finish=value=>{if(settled)return;settled=true;cleanup();resolve(value);};
    const onChange=()=>{if(orientationIsLandscape()===wantLandscape)finish(true);};
    const timer=setTimeout(()=>finish(orientationIsLandscape()===wantLandscape),timeoutMs);
    if(orientation&&orientation.addEventListener)orientation.addEventListener('change',onChange);
    if(mql){
      if(mql.addEventListener)mql.addEventListener('change',onChange);
      else if(mql.addListener)mql.addListener(onChange);
    }
    if(typeof window.addEventListener==='function')window.addEventListener('resize',onChange);
  });
};
// target: 'landscape' | 'portrait'。**実際にその向きになったら** true を返す
// (ならなければ案内を出す側で使う)。
//
// 【2026-09-06・Androidの利用者からの報告「横にはできるけど縦にはできないときがある」】
// 縦へ戻す側だけ作りが違っていたのが原因だった。前は
//   ① portrait で固定する → ② 全画面を抜ける → ③ 抜けたら「できた」とみなす
// という順で、②で**固定が自動的に外れる**。Androidのブラウザは全画面のあいだしか
// 向きの固定を許さないので、全画面を抜けた瞬間に端末のセンサーの向きへ戻る。
// 本体を横に持っていれば、そのまま横へ戻ってしまう。しかも③で「できた」と返すので、
// 画面は横のままなのに案内も出ない＝「押しても何も起きない」になっていた。
// 本体を縦に持っている人だけたまたま成功するので、「ときがある」という出方になる。
//
// いまは縦も横も**同じ道**を通す。全画面へ入り、固定し、実際に向きが変わるまで待つ。
// 全画面は抜けない(抜けると固定が外れるため)。モンビーを離れるときにまとめて戻す。
const lockScreenOrientation=async(target)=>{
  const orientation=screenOrientationApi();
  const root=(typeof document!=='undefined')?document.documentElement:null;
  if(!orientation||!root)return false;
  // 向きの固定は「全画面のあいだだけ」許すブラウザが多い。縦へ戻すときも同じ。
  // ここで入れなくても lock だけ通ることがあるので、失敗しても先へ進む。
  if(!document.fullscreenElement&&typeof root.requestFullscreen==='function'){
    try{await root.requestFullscreen({navigationUI:'hide'});}catch(_){}
  }
  try{await orientation.lock(target);}catch(_){return false;}
  // 受け付けられても、実際に回るまでは「できた」と言わない
  if(!await waitForScreenOrientation(target))return false;
  // 縦でも横でも、固定を持っているあいだは覚えておく(離れるときに戻すため)
  screenOrientationLockedByUs=true;
  return true;
};
// --- 二の矢: 端末が回ってくれないなら、こちらの絵を回す ---
//
// 【なぜ要るか】(2026-09-06・ユーザーからの相談)
// 「端末の設定とか関係なく強制的に画面の向きを変えられないの？」
// 端末の向きを変える手段は screen.orientation.lock() ひとつしか無く、Androidは全画面中のみ・
// iOSのSafariには機能そのものが無い・アプリ内ブラウザは全画面を塞いでいる。
// つまりAPIに頼るかぎり「できない端末」は必ず残る。
//
// そこで、端末は縦のまま**絵のほうを90度回して描く**。ただのCSSなので、
// 許可もAPIも端末の「画面の自動回転」の設定も一切関係なく、どのブラウザでも必ず効く。
// 指の位置と箱の測定は RHYTHM_VIEW_ROTATION が回転を打ち消すので、
// レーン判定もノーツの配置もそのまま正しく動く。
// いま自前回転で「どちら向きにしたいか」。本体を持ち替えたときに測り直すために覚えておく。
let forcedRotationWantLandscape=null;
// 戻り値は「実際に何をしたか」。
//   'rotated' … 絵を回した(本体は向きが変わっていないので、持ち替えてもらう必要がある)
//   'already' … 端末がもう望みの向きだったので、何もしていない(言うことは無い)
//
// 【なぜ分けるか】(2026-09-06・Galaxy Z Fold6の画面写真)
// 前は両方とも「回した」として扱い、どちらでも
// 「絵のほうを縦向きにしました。本体を縦向きに持ち替えてお使いください」と案内していた。
// 実際の画面には「絵の回転 なし」と出ているのに「回しました」と言っており、
// しかも本体はもともと縦なので、持ち替える必要も無い。案内が二重に間違っていた。
//
// これが起きるのは、自前で横にしてから「縦」を押したとき。
// applyScreenOrientation の頭で自前回転を解除するので、その時点でもう縦になっている。
// あとは端末に頼んで断られるだけで、回すものが残っていない。
const applyForcedRotation=wantLandscape=>{
  forcedRotationWantLandscape=wantLandscape;
  // 端末そのものが既に望みの向きなら、回す必要はない(回すとかえって狂う)
  if(deviceIsLandscape()===wantLandscape){RHYTHM_VIEW_ROTATION.set(0);return 'already';}
  RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle());
  return 'rotated';
};
// 【本体を持ち替えたときの追従】
// 自前回転は「端末が縦のままなので絵を回す」ものなので、**端末が回ったらもう要らない**。
// 端末の自動回転が入っている人が本体を横にすると、端末も回った上にこちらも回ったままで
// 二重になり、横倒しの絵になってしまう。向きが変わったら必ず測り直す。
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
  const recheck=()=>{
    if(forcedRotationWantLandscape===null)return;
    applyForcedRotation(forcedRotationWantLandscape);
  };
  window.addEventListener('orientationchange',recheck);
  window.addEventListener('resize',recheck);
  if(typeof window.matchMedia==='function'){
    const mql=window.matchMedia('(orientation: landscape)');
    if(mql.addEventListener)mql.addEventListener('change',recheck);
    else if(mql.addListener)mql.addListener(recheck);
  }
}
// target: 'landscape' | 'portrait'。
// 戻り値は「どうやってその向きにしたか」。
//   'device'  … 端末そのものが回った(いちばん自然。本体の向きも一緒に変わる)
//   'forced'  … 端末は回らなかったので、絵のほうを回した(本体は持ち替えてもらう)
//   'already' … 端末に頼んだ時点でもう望みの向きだった(回すものが無い。言うことも無い)
//   ''        … どちらもできなかった(まず起きないが、案内を出す側のために残す)
// ①端末に頼む → ②断られたら自分で回す、の順。
const applyScreenOrientation=async(target)=>{
  const wantLandscape=target==='landscape';
  // 自前で回したまま端末に頼むと、端末が回った上にこちらも回って二重になる。
  // 頼む前にいったん戻し、失敗したときだけ改めて自分で回す。
  RHYTHM_VIEW_ROTATION.set(0);
  if(await lockScreenOrientation(target))return 'device';
  const done=applyForcedRotation(wantLandscape);
  return done==='rotated'?'forced':done==='already'?'already':'';
};
// モンビーを離れるときの後始末。ボタンで固定したときだけ戻す。
// これが無いと、横のままHOMEへ戻ったときにゲーム全体が横＋全画面のままになり、
// 縦向きで作ってあるHOMEやバトルの画面が崩れる。
// 自分で固定していないとき(端末を横向きに持っているだけ)には何もしない。
const releaseScreenOrientation=()=>{
  // 自前で回しているぶんは必ず戻す。残したままHOMEへ帰るとゲーム全体が横倒しになる
  const hadForcedRotation=RHYTHM_VIEW_ROTATION.active();
  forcedRotationWantLandscape=null;
  RHYTHM_VIEW_ROTATION.set(0);
  if(!screenOrientationLockedByUs)return hadForcedRotation;
  screenOrientationLockedByUs=false;
  const orientation=screenOrientationApi();
  if(orientation&&typeof orientation.unlock==='function'){try{orientation.unlock();}catch(_){}}
  if(typeof document!=='undefined'&&document.fullscreenElement&&typeof document.exitFullscreen==='function'){
    try{document.exitFullscreen();}catch(_){}
  }
  return true;
};
// 切り替えがうまくいかなかったときに、端末のいまの状態を1行で出す。
//
// 【なぜ要るか】(2026-09-06)
// 「Galaxyだと開いた状態だとだめ・案内も出ないらしい」という報告が届いたが、
// こちらの筋書きではどの道を通っても案内が出るはずで、説明が付かなかった。
// 手元に無い端末について、伝聞で当て推量を重ねても当たらない。
// うまくいかなかったときだけ、そのとき端末が答えた値をそのまま画面へ出す。
// 画面を撮って送ってもらえれば、次はもう推測しなくて済む。
const screenOrientationStateLine=()=>{
  if(typeof window==='undefined')return '';
  const o=window.screen&&window.screen.orientation;
  const type=(o&&typeof o.type==='string')?o.type:'なし';
  const angle=(o&&Number.isFinite(Number(o.angle)))?`${Number(o.angle)}度`:'不明';
  const full=(typeof document!=='undefined'&&document.fullscreenElement)?'あり':'なし';
  const rot=RHYTHM_VIEW_ROTATION.active()?`${RHYTHM_VIEW_ROTATION.get()}度`:'なし';
  const lock=screenOrientationApi()?'あり':'なし';
  return `画面 ${window.innerWidth}×${window.innerHeight} / 端末 ${type} ${angle} / 全画面 ${full} / 回す機能 ${lock} / 絵の回転 ${rot}`;
};
// 自前回転をReactから使うためのフック。
// 器のCSSは RHYTHM_VIEW_ROTATION.frameStyle() が持っているので、ここでは
// 「変わったら描き直す」ことと「画面の大きさを追いかける」ことだけをする。
// 回していないときは null を返すので、画面の作りは今までと1ミリも変わらない。
const useRhythmForcedRotationStyle=()=>{
  const [angle,setAngle]=useState(()=>RHYTHM_VIEW_ROTATION.get());
  const [,bumpSize]=useState(0);
  useEffect(()=>{
    setAngle(RHYTHM_VIEW_ROTATION.get());
    return RHYTHM_VIEW_ROTATION.subscribe(setAngle);
  },[]);
  useEffect(()=>{
    if(angle===0||typeof window==='undefined')return undefined;
    // 器の大きさは画面の縦横をそのまま使うので、変わったら測り直す
    const onResize=()=>bumpSize(n=>n+1);
    window.addEventListener('resize',onResize);
    window.addEventListener('orientationchange',onResize);
    return()=>{window.removeEventListener('resize',onResize);window.removeEventListener('orientationchange',onResize);};
  },[angle]);
  return angle===0?null:RHYTHM_VIEW_ROTATION.frameStyle();
};
// ============================================================================
// 演奏中は通知を出さない
// ============================================================================
// 【2026-09-05・ユーザーからの相談】
// 「演奏中のみ物理的に端末の通知を出さないようにすることは可能？ オプションでオンオフできて」
// 「演奏中に通知来ると上が見えなくなって無理になる」
//
// 【できること・できないこと】
// ブラウザのページから**端末の通知そのものを止めるしくみは無い**。ここは正直に書いておく。
// ページ側からできるのは次の2つだけ。
//   ① 全画面表示へ入る … Androidのブラウザでは、全画面のあいだ画面いちばん上の通知バーが
//      隠れる。通知が上から降りてくる表示も出にくくなる(端末と設定によっては出る)
//   ② 画面を消させない(Screen Wake Lock) … 演奏の途中で画面が暗くなる・ロックされるのを防ぐ
// iPhoneのSafariには、ページからの全画面もWake Lockも無い
// (ホーム画面へ追加して開いた場合はWake Lockが使えることがある)。
// 通知そのものを止めたいときは、端末側の「集中モード」を使ってもらうしかない。
//
// できないのに「ONにすれば止まる」と見せるのがいちばん困るので、
// オプションにはこの端末で実際に何ができるかを必ず添える(rhythmQuietModeSupportText)。
const rhythmQuietModeCan=()=>({
  fullscreen:typeof document!=='undefined'&&typeof document.documentElement?.requestFullscreen==='function',
  wakeLock:typeof navigator!=='undefined'&&!!navigator.wakeLock&&typeof navigator.wakeLock.request==='function',
});
const rhythmQuietModeSupportText=()=>{
  const can=rhythmQuietModeCan();
  const tail='通知そのものを止めることはブラウザからはできないので、確実に止めたいときは端末の「集中モード」もお使いください。';
  if(can.fullscreen&&can.wakeLock)
    return `この端末では、演奏のあいだだけ全画面にして、画面が消えないようにできます。全画面のあいだは画面いちばん上の通知バーが隠れるので、通知が降りてくる表示も出にくくなります。${tail}`;
  if(can.fullscreen)
    return `この端末では、演奏のあいだだけ全画面にできます。全画面のあいだは画面いちばん上の通知バーが隠れます。画面が消えないようにする機能はこのブラウザにはありません。${tail}`;
  if(can.wakeLock)
    return `この端末では、演奏のあいだ画面が消えないようにできます。全画面にする機能がこのブラウザには無いため、通知バーは隠せません。${tail}`;
  return `この端末のブラウザでは、全画面にすることも画面が消えないようにすることもできません。ONにしても何も起きないので、通知を止めたいときは端末の「集中モード」をお使いください。`;
};
const RHYTHM_QUIET_MODE=(()=>{
  let fullscreenByUs=false,wakeLock=null,watching=false;
  // 画面を伏せる・別のアプリへ行くと、Wake Lockはブラウザが勝手に外す。
  // 戻ってきたときに取り直さないと、そこから先は画面が消えるようになってしまう
  const reacquire=async()=>{
    if(!wakeLock&&!watching)return;
    if(typeof document==='undefined'||document.visibilityState!=='visible')return;
    if(wakeLock)return;
    try{wakeLock=await navigator.wakeLock.request('screen');}catch(_){}
  };
  const onVisibility=()=>{reacquire();};
  const enter=async()=>{
    const can=rhythmQuietModeCan();
    if(can.fullscreen&&!document.fullscreenElement){
      try{await document.documentElement.requestFullscreen({navigationUI:'hide'});fullscreenByUs=true;}catch(_){}
    }
    if(can.wakeLock&&!wakeLock){
      try{
        wakeLock=await navigator.wakeLock.request('screen');
        if(!watching){watching=true;document.addEventListener('visibilitychange',onVisibility);}
      }catch(_){}
    }
    return fullscreenByUs||!!wakeLock;
  };
  const exit=async()=>{
    if(wakeLock){try{await wakeLock.release();}catch(_){}wakeLock=null;}
    if(watching){watching=false;document.removeEventListener('visibilitychange',onVisibility);}
    // 自分で入った全画面だけ抜ける。縦横の切り替えで入っているぶんまで抜くと、
    // 演奏が終わった瞬間に画面が縦へ戻ってしまう
    if(fullscreenByUs){
      fullscreenByUs=false;
      if(typeof document!=='undefined'&&document.fullscreenElement&&typeof document.exitFullscreen==='function'){
        try{await document.exitFullscreen();}catch(_){}
      }
    }
  };
  return {enter,exit,can:rhythmQuietModeCan};
})();
// 切り替えボタン本体。向きの見張りをこの中だけで持つのは、
// 画面全体の状態にすると回すたびにアプリ全部が描き直されるため
// (プレイ中の描き直しはカクつきに直結する)。
const RhythmOrientationButton=({className=''})=>{
  const [landscape,setLandscape]=useState(()=>orientationIsLandscape());
  const [note,setNote]=useState('');
  useEffect(()=>{
    if(typeof window==='undefined'||typeof window.matchMedia!=='function')return undefined;
    const mql=window.matchMedia('(orientation: landscape)');
    const onChange=()=>setLandscape(orientationIsLandscape());
    onChange();
    if(mql.addEventListener)mql.addEventListener('change',onChange);
    else if(mql.addListener)mql.addListener(onChange);
    // 自前で回したときは端末の向きが変わらないので、matchMedia は鳴らない。
    // 見えている向きが変わったことをこちらから知らせる
    const unsubscribe=RHYTHM_VIEW_ROTATION.subscribe(onChange);
    return ()=>{
      if(mql.removeEventListener)mql.removeEventListener('change',onChange);
      else if(mql.removeListener)mql.removeListener(onChange);
      unsubscribe();
    };
  },[]);
  // 案内は押すまで消さない。「本体を持ち替えてください」は**やってもらうこと**が
  // 書いてあるので、8秒で消すと気づかないまま終わる。実際に「案内も出ない」という
  // 報告が届いたが、出ていたのに消えたあとだった可能性がある(2026-09-06)。
  // 回している最中にもう一度押されると、固定の指示が二重に飛んで
  // 端末側が混乱する(片方だけ効いて向きと表示が食い違う)。押している間は受け付けない。
  const [busy,setBusy]=useState(false);
  const target=landscape?'portrait':'landscape';
  const label=landscape?'縦画面にする':'横画面にする';
  const wanted=landscape?'縦':'横';
  const toggle=async()=>{
    if(busy)return;
    setBusy(true);
    setNote('');
    try{
      const how=await applyScreenOrientation(target);
      setLandscape(orientationIsLandscape());
      if(how==='device')return;    // 本体ごと回ったので言うことはない
      // 頼んだ時点でもう望みの向きだった。回すものが無いので、言うことも無い。
      // ここで「絵を回しました。持ち替えてください」と出すと、回してもいないことを
      // 言ったうえ、もともと正しい向きで持っている人へ持ち替えさせてしまう
      if(how==='already')return;
      if(how==='forced'){
        // 端末は回ってくれなかったので、絵のほうを回した。
        // 本体の向きはそのままなので、**持ち替えてもらう**必要がある。ここは必ず伝える。
        setNote(`この端末は画面を回せないので、代わりに絵のほうを${wanted}向きにしました。本体を${wanted}向きに持ち替えてお使いください。\n${screenOrientationStateLine()}`);
        return;
      }
      setNote(`画面を${wanted}にできませんでした。お手数ですが本体を${wanted}向きにしてお使いください。\n${screenOrientationStateLine()}`);
    }finally{setBusy(false);}
  };
  return <div className={`relative shrink-0 ${className}`}>
    <button data-rhythm-orientation-toggle data-orientation={landscape?'landscape':'portrait'}
      aria-label={label} title={label} onClick={toggle} disabled={busy} aria-busy={busy?'true':undefined}
      className="flex min-h-[44px] min-w-[40px] flex-col items-center justify-center gap-0.5 rounded-xl border border-emerald-400/50 bg-emerald-950/40 leading-none text-emerald-100 disabled:opacity-60">
      <span aria-hidden="true" className="text-base leading-none">🔄</span>
      <span className="text-[7px] font-black leading-none">{landscape?'縦':'横'}</span>
    </button>
    {note!==''&&<p data-rhythm-orientation-note onClick={()=>setNote('')}
      style={{whiteSpace:'pre-line'}}
      className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-amber-300/50 bg-slate-900/95 px-2 py-1.5 text-[9px] font-bold leading-relaxed text-amber-100 shadow-lg">{note}<span className="mt-1 block text-[8px] font-black text-amber-300/80">タップで閉じる</span></p>}
  </div>;
};
// ============================================================================
// タップのタイミング合わせ
// ============================================================================
// 【2026-09-05・ユーザー指示】
// 「レーンとノーツに合わせて何回かタップして調整するみたいなやつ」。
// 音ゲーによくある形で、一定の間隔で流れてくる目印に合わせて叩き、
// そのずれの平均から「判定タイミング調整」の値を決める。
//
// 【なぜ要るか】
// 画面に見えてから指が触れて、端末がそれを知らせるまでの遅れは端末ごとに違う。
// 20〜40msほどあり、いちばん良い判定(±55ms)の半分を食う。
// 目分量で合わせるのは難しいので、実際に叩いた結果から決める。
//
// 【測り方】
//   ・一定の間隔(RHYTHM_CALIBRATION_BEAT_MS)で目印が判定ラインへ来る
//   ・そのときのタップの時刻とのずれを集める
//   ・外れ値(いちばん大きいものといちばん小さいもの)を落として平均を取る
//     …1回の押し間違いで全部が狂わないようにするため
//   ・平均を5ms刻みへ丸めて、-100〜+100の範囲に収める(設定と同じ刻み・範囲)
//
// 時刻は音と同じ AudioContext ではなく performance.now() を使う。
// ここでは音を鳴らさず、目印の動きだけに合わせてもらうため。
const RHYTHM_CALIBRATION_BEAT_MS=1000;      // 目印が来る間隔。1秒ちょうどで数えやすくする
const RHYTHM_CALIBRATION_TAPS=8;            // 何回叩いてもらうか
const RHYTHM_CALIBRATION_DROP_EACH_END=1;   // 外れ値として上下いくつずつ落とすか
const RHYTHM_CALIBRATION_MAX_MS=100;        // 設定の範囲と同じ
const RHYTHM_CALIBRATION_STEP_MS=5;         // 設定の刻みと同じ
// 集めたずれから、設定へ入れる値を出す。ここだけ切り出してあるので検査から直接動かせる。
const rhythmCalibrationOffsetFromTaps=(deltas)=>{
  const list=(Array.isArray(deltas)?deltas:[]).filter(value=>Number.isFinite(Number(value))).map(Number).sort((a,b)=>a-b);
  if(!list.length)return null;
  // 上下を落とす。落としたあとに何も残らないなら落とさない
  const drop=list.length>RHYTHM_CALIBRATION_DROP_EACH_END*2?RHYTHM_CALIBRATION_DROP_EACH_END:0;
  const used=drop?list.slice(drop,list.length-drop):list;
  const mean=used.reduce((sum,value)=>sum+value,0)/used.length;
  const stepped=Math.round(mean/RHYTHM_CALIBRATION_STEP_MS)*RHYTHM_CALIBRATION_STEP_MS;
  return {offsetMs:Math.max(-RHYTHM_CALIBRATION_MAX_MS,Math.min(RHYTHM_CALIBRATION_MAX_MS,stepped)),
    usedCount:used.length,droppedCount:list.length-used.length,rawMeanMs:Math.round(mean)};
};

// 実際に叩いてもらう部品。オプションの中へ置く。
// レーンを1本だけ出し、ノーツが上から降りてきて判定ラインへ来る。それに合わせて叩く。
// 判定・スコア・譜面には一切関わらない(ここで測るのは「ずれ」だけ)。
const RhythmTimingCalibrator=({onApply,onClose,currentOffsetMs=0})=>{
  const [taps,setTaps]=useState([]);
  const [running,setRunning]=useState(false);
  const startRef=useRef(0);
  const frameRef=useRef(null);
  const noteRef=useRef(null);
  const areaRef=useRef(null);
  const tapsRef=useRef([]);
  const result=rhythmCalibrationOffsetFromTaps(taps);

  const stop=useCallback(()=>{
    if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);
    frameRef.current=null;setRunning(false);
  },[]);
  useEffect(()=>()=>{if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);},[]);

  const start=()=>{
    setTaps([]);tapsRef.current=[];
    startRef.current=performance.now();
    setRunning(true);
    const tick=()=>{
      const area=areaRef.current,note=noteRef.current;
      if(!area||!note){frameRef.current=requestAnimationFrame(tick);return;}
      const elapsed=performance.now()-startRef.current;
      // 1拍ぶんを上から判定ラインまで動かし、着いたら次の拍へ回す
      const phase=(elapsed%RHYTHM_CALIBRATION_BEAT_MS)/RHYTHM_CALIBRATION_BEAT_MS;
      const height=area.clientHeight||120;
      note.style.transform=`translate3d(0,${Math.round(phase*(height-18))}px,0)`;
      if(tapsRef.current.length>=RHYTHM_CALIBRATION_TAPS){stop();return;}
      frameRef.current=requestAnimationFrame(tick);
    };
    frameRef.current=requestAnimationFrame(tick);
  };

  const tap=()=>{
    if(!running)return;
    const elapsed=performance.now()-startRef.current;
    // いちばん近い拍からのずれ。早ければマイナス、遅ければプラス
    const nearest=Math.round(elapsed/RHYTHM_CALIBRATION_BEAT_MS)*RHYTHM_CALIBRATION_BEAT_MS;
    const delta=elapsed-nearest;
    // 最初の1拍は目印がまだ降りきっていないので数えない
    if(elapsed<RHYTHM_CALIBRATION_BEAT_MS)return;
    const next=[...tapsRef.current,delta];
    tapsRef.current=next;setTaps(next);
    RHYTHM_NOTE_SE_RUNTIME.playEmpty();
  };

  // 【2026-09-05・ユーザー指示】「タップ調整が窮屈で見にくい／専用画面に飛ばしたほうがいい」
  // オプションの中の小さな枠(高さ112px)ではなく、画面いっぱいで開く。
  // 叩く場所が広いほど、実際のプレイに近い姿勢で測れる。
  return <main data-rhythm-calibrator className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)'}}>
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2">
      <button aria-label="オプションへ戻る" data-rhythm-calibrator-close onClick={()=>{stop();onClose();}} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button>
      <div className="min-w-0 flex-1">
        <small className="block text-[8px] font-black tracking-[0.2em] text-cyan-300">MONBEAT</small>
        <h2 className="text-base font-black">🎯 タップのタイミングを合わせる</h2>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
      <p className="text-[12px] leading-relaxed text-slate-300">
        下の線へノーツが重なった瞬間に、リズムよく{RHYTHM_CALIBRATION_TAPS}回叩いてください。
        画面に見えてから指が触れるまでの遅れは端末ごとに違うので、実際に叩いて測ります。
      </p>
      {/* 叩く場所は画面の残りいっぱい。実際のプレイと同じように、指を置く姿勢で測れるようにする */}
      <div ref={areaRef} data-rhythm-calibrator-area onPointerDown={e=>{e.preventDefault();tap();}}
        className="relative mt-3 min-h-0 flex-1 w-full overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-900"
        style={{touchAction:'none',WebkitUserSelect:'none',userSelect:'none'}}>
        <i ref={noteRef} data-rhythm-calibrator-note aria-hidden="true"
          className="absolute left-1/2 top-0 h-6 w-40 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-200 to-fuchsia-500"/>
        <i aria-hidden="true" className="absolute inset-x-0 bottom-8 h-[4px] bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300"/>
        {!running&&<span className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] font-black leading-relaxed text-slate-300">
          {taps.length?'もう一度やるなら「はじめる」':'「はじめる」を押して、線に重なったら叩いてね'}</span>}
        {running&&<span className="absolute inset-x-0 bottom-2 text-center text-[11px] font-black text-cyan-200">ここを叩く</span>}
      </div>
      <p data-rhythm-calibrator-count className="mt-3 text-center text-[14px] font-black tabular-nums text-cyan-200">
        {taps.length} / {RHYTHM_CALIBRATION_TAPS} 回
      </p>
      {result&&taps.length>=RHYTHM_CALIBRATION_TAPS&&(
        <p data-rhythm-calibrator-result className="mt-2 text-center text-[12px] font-bold leading-relaxed text-amber-200">
          平均{result.rawMeanMs>0?'+':''}{result.rawMeanMs}ms（{result.droppedCount}回は外れ値として除外）<br/>→ 判定タイミング調整 {result.offsetMs>0?'+':''}{result.offsetMs}ms
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-slate-500">いまの値: {currentOffsetMs>0?'+':''}{currentOffsetMs}ms（「この値にする」を押しても、保存するまでは変わりません）</p>
    </div>
    <footer className="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-4 pt-2" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" data-rhythm-calibrator-start onClick={start} disabled={running}
          className="min-h-[54px] rounded-xl bg-cyan-700 text-[13px] font-black text-white disabled:opacity-40">はじめる</button>
        <button type="button" data-rhythm-calibrator-apply
          disabled={!result||taps.length<RHYTHM_CALIBRATION_TAPS}
          onClick={()=>{if(result){onApply(result.offsetMs);stop();onClose();}}}
          className="min-h-[54px] rounded-xl bg-amber-400 text-[13px] font-black text-slate-950 disabled:opacity-40">この値にする</button>
      </div>
    </footer>
  </main>;
};

// ===== モンヒロビートのイベント報酬(2026-09-11) =====
// data/rhythm-event.js は「何位に何個」だけを持ち、アイテムの実体(id・名前・絵文字)は
// ゲーム本体側にある(アイテムの定義は 11-masu-progression.jsx で、data より後に読み込まれるため)。
// ここで結びつける。名前を2か所に書かないよう、必ず実データから引く。
const rhythmEventRewardItem=(reward)=>{
  if(!reward||typeof reward!=='object')return null;
  if(reward.kind==='speciesFruit'){
    const item=speciesTranscendFruitItems()[reward.lineageId];
    return item?{id:item.id,name:item.name,emoji:item.emoji||'🍇'}:null;
  }
  if(reward.kind==='heroProof')return {id:HERO_PROOF_ITEM_ID,name:HERO_PROOF_ITEM.name,emoji:HERO_PROOF_ITEM.emoji};
  // 週間ランキングの順位報酬・参加報酬(2026-09-13)
  if(reward.kind==='heroProofShard')return {id:HERO_PROOF_SHARD_ITEM_ID,name:HERO_PROOF_SHARD_ITEM.name,emoji:HERO_PROOF_SHARD_ITEM.emoji};
  if(reward.kind==='rainbowFruit')return {id:RAINBOW_TRANSCEND_FRUIT_ITEM_ID,name:RAINBOW_TRANSCEND_FRUIT_ITEM.name,emoji:'🌈'};
  return null;
};
// イベントの告知画像。画像が無いイベントでは何も出さない。
// ★読めなかったときは黙って消す。壊れた画像のアイコンが残ると、
//   「絵が出ない」より見た目が悪い(綴り間違いは image-asset-check.js が先に捕まえる)
const RhythmEventBanner=({event,className=''})=>{
  const src=rhythmEventBanner(event);
  const [failed,setFailed]=React.useState(false);
  React.useEffect(()=>{setFailed(false);},[src]);
  if(!src||failed)return null;
  return (
    <img data-rhythm-event-banner src={src} alt={`${event&&event.name?event.name:'イベント'}の告知`}
      onError={()=>setFailed(true)} loading="lazy" decoding="async"
      className={`w-full rounded-2xl border border-fuchsia-300/30 ${className}`}/>
  );
};
// 参加報酬の1行。ダイヤと虹のプシュケーだけなので、アイテムの実体は要らない
// 参加報酬の1行。週間は勇者の証片も付くので、アイテムぶんも出す
const rhythmEventParticipationText=(reward)=>{
  if(!reward)return '';
  const parts=[];
  if(reward.count>0)parts.push(`${HERO_PROOF_SHARD_ITEM.emoji} ${HERO_PROOF_SHARD_ITEM.name}×${reward.count.toLocaleString()}`);
  if(reward.gold>0)parts.push(`💎 ダイヤ×${reward.gold.toLocaleString()}`);
  if(reward.psyche>0)parts.push(`💗 虹のプシュケー×${reward.psyche.toLocaleString()}`);
  return parts.join(' ／ ');
};
// 「🍇 超越の実（スエゾー種）×5 ／ 虹のプシュケー×1,000」のような1行。
// 順位ごとの表示にも、受け取ったときの知らせにも同じ文を使う
const rhythmEventRewardText=(reward)=>{
  if(!reward)return '';
  const item=rhythmEventRewardItem(reward);
  const parts=[];
  if(item&&reward.count>0)parts.push(`${item.emoji} ${item.name}×${reward.count}`);
  if(reward.psyche>0)parts.push(`💗 虹のプシュケー×${reward.psyche.toLocaleString()}`);
  // 週間の順位報酬にはダイヤも付く(イベントの順位報酬には無いので、ある時だけ出す)
  if(reward.gold>0)parts.push(`💎 ダイヤ×${reward.gold.toLocaleString()}`);
  return parts.join(' ／ ');
};
