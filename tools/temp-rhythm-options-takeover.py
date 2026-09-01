from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'monster-hero' / 'src' / 'game-system.jsx'
CHECK = ROOT / 'tools' / 'mode' / 'rhythm-options-step1-check.js'
DOCS = ROOT / 'docs' / 'spec' / 'RHYTHM_MODE.md'
CHANGELOG = ROOT / 'monster-hero' / 'data' / 'changelog.js'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


game = GAME.read_text(encoding='utf-8')

marker = "const RHYTHM_JUDGMENT_DISPLAY_MS=450;\nconst rhythmInputKey=(kind,id)=>`${kind}:${id}`;\n"
helper = """const RHYTHM_JUDGMENT_DISPLAY_MS=450;
const rhythmInputKey=(kind,id)=>`${kind}:${id}`;
// 6.0はSTEP1以前の見た目(約2150ms)を維持しつつ、3.0/10.0で実機でも明確に差が出る表示時間へ写す。
// authored note time・判定窓・入力時刻には使わず、描画travelだけに使用する。
const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;
const rhythmTravelMsForSpeed=value=>{
  const speed=Math.max(3,Math.min(10,Number(value)||6));
  if(speed===6)return RHYTHM_NOTE_TRAVEL_BASE_MS;
  return Math.round(speed<6
    ? RHYTHM_NOTE_TRAVEL_BASE_MS+(6-speed)*350
    : RHYTHM_NOTE_TRAVEL_BASE_MS-(speed-6)*237.5);
};
"""
game = replace_once(game, marker, helper, 'travel helper insertion')

game = replace_once(
    game,
    'travelMs=Math.max(650,2690-settings.noteSpeed*90)',
    'travelMs=rhythmTravelMsForSpeed(settings.noteSpeed)',
    'runtime travel mapping',
)

start = game.index('const RhythmOptions=({value,onSave,onBack})=>{')
end = game.index('\n\nconst RhythmTapTest=', start)
new_component = r'''const RhythmOptions=({value,onSave,onBack})=>{
  const [draft,setDraft]=useState(()=>normalizeRhythmSettings(value));
  const [message,setMessage]=useState('');
  const previewRef=useRef(null);
  useEffect(()=>()=>{previewRef.current?.stop();previewRef.current=null;},[]);
  const savedValue=normalizeRhythmSettings(value),dirty=JSON.stringify(draft)!==JSON.stringify(savedValue);
  const set=(key,next)=>{setDraft(current=>normalizeRhythmSettings({...current,[key]:next}));setMessage('');};
  const range=(key,min,max,step,suffix='')=><div className="grid grid-cols-[1fr_56px] items-center gap-2"><input aria-label={key} type="range" min={min} max={max} step={step} value={draft[key]} onChange={event=>set(key,Number(event.target.value))} className="h-11 min-w-0 accent-cyan-400"/><output className="rounded-lg border border-cyan-400/30 bg-slate-950 px-1 py-2 text-center text-xs font-black tabular-nums">{draft[key]}{suffix}</output></div>;
  const toggle=(key,label)=><button type="button" aria-pressed={draft[key]} onClick={()=>set(key,!draft[key])} className={`min-h-[44px] min-w-[88px] rounded-xl border px-4 text-xs font-black ${draft[key]?'border-cyan-200 bg-cyan-600 text-white':'border-white/20 bg-slate-900 text-slate-300'}`}>{label} {draft[key]?'ON':'OFF'}</button>;
  const segments=(key,items)=><div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/20">{items.map(([id,label])=><button type="button" key={id} aria-pressed={draft[key]===id} onClick={()=>set(key,id)} className={`min-h-[44px] border-r border-white/10 px-1 text-[10px] font-black last:border-r-0 ${draft[key]===id?'bg-cyan-600 text-white':'bg-slate-900 text-slate-300'}`}>{label}</button>)}</div>;
  const card='rounded-2xl border border-cyan-400/35 bg-slate-900/85 p-3 shadow-[0_0_18px_rgba(34,211,238,.08)]';
  const row='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 py-2 last:border-b-0';
  const previewBgm=async()=>{previewRef.current?.stop();previewRef.current=null;const audio=await Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume);previewRef.current=audio;if(!audio)setMessage('BGMを再生できませんでした');};
  const resetDraft=()=>{setDraft(normalizeRhythmSettings(DEFAULT_RHYTHM_SETTINGS));setMessage('画面上の値を戻しました（未保存）');};
  const saveDraft=async()=>{const saved=await onSave(draft);setDraft(saved);setMessage('保存しました');};
  return <main data-rhythm-options className="flex flex-1 min-h-0 flex-col overflow-hidden bg-slate-950 text-white" style={{paddingTop:'env(safe-area-inset-top)'}}>
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-3 py-2"><button aria-label="音ゲーデバッグへ戻る" onClick={onBack} className="min-h-[44px] min-w-[44px] text-slate-300"><ArrowLeft size={20}/></button><div><small className="block text-[8px] font-black text-cyan-300">DEBUG・正式モード共通設計</small><h2 className="text-base font-black">⚙️ 音ゲーオプション</h2></div></header>
    <div data-rhythm-options-scroll className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 pt-3 mh-scroll">
      <div className="space-y-3">
        <section className={card}><h3 className="text-sm font-black text-cyan-200">🔊 音量</h3><label className="mt-2 block text-xs font-bold">BGM音量{range('bgmVolume',0,100,1)}</label><label className="mt-2 block text-xs font-bold">タップ音量{range('noteSeVolume',0,100,1)}</label><div className={row}><span className="text-xs font-bold">タップ音</span>{toggle('noteSeEnabled','')}</div><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={previewBgm} className="min-h-[46px] rounded-xl bg-indigo-700 text-xs font-black">♪ BGM試聴</button><button type="button" onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)} className="min-h-[46px] rounded-xl bg-fuchsia-700 text-xs font-black">タップ音試聴</button></div></section>
        <section className={card}><h3 className="text-sm font-black text-cyan-200">🎯 プレイ</h3><label className="mt-2 block text-xs font-bold">ノーツ速度{range('noteSpeed',3,10,.5)}</label><label className="mt-2 block text-xs font-bold">ノーツサイズ{range('noteSize',80,120,5,'%')}</label><label className="mt-2 block text-xs font-bold">判定タイミング調整{range('judgmentTimingOffsetMs',-100,100,5,'ms')}</label><p className="mt-2 text-[9px] leading-relaxed text-slate-400">判定窓の幅は変えず、表示と入力の基準を同じ量だけ補正します。</p></section>
        <section className={card}><h3 className="text-sm font-black text-cyan-200">👁 表示</h3><div className={row}><span className="text-xs font-bold">FAST / SLOW表示</span>{toggle('fastSlowDisplay','')}</div><div className={row}><span className="text-xs font-bold">判定文字表示</span>{toggle('judgmentTextDisplay','')}</div><div className="py-2"><p className="mb-2 text-xs font-bold">レーン発光</p>{segments('laneGlow',[['NORMAL','標準'],['LOW','控えめ'],['NONE','なし']])}</div></section>
        <section className={card}><h3 className="text-sm font-black text-cyan-200">✨ 演出・端末</h3><div className="py-2"><p className="mb-2 text-xs font-bold">演出量</p>{segments('effectAmount',[['NORMAL','標準'],['LOW','少なめ'],['MINIMAL','最小']])}</div><div className={row}><span className="text-xs font-bold">振動</span>{toggle('vibrationEnabled','')}</div><div className={row}><span className="text-xs font-bold">軽量モード</span>{toggle('lightweightMode','')}</div></section>
        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-950/25 p-3 text-[10px] leading-relaxed text-cyan-100">判定を甘くする設定ではありません。端末ごとの見え方・音量・タイミングを調整する項目です。</section>
      </div>
    </div>
    <footer data-rhythm-options-actions className="z-20 shrink-0 border-t border-cyan-400/25 bg-slate-950/98 px-3 pt-2 shadow-[0_-8px_24px_rgba(2,6,23,.72)]" style={{paddingBottom:'calc(.5rem + env(safe-area-inset-bottom))'}}>
      {message&&<p role="status" className="mb-1 text-center text-[10px] font-black text-amber-300">{message}</p>}
      <div className="grid grid-cols-[.9fr_1.1fr] gap-2"><button type="button" onClick={resetDraft} className="min-h-[52px] rounded-xl border border-white/20 bg-slate-800 px-2 text-[11px] font-black">デフォルトに戻す</button><button type="button" onClick={saveDraft} data-rhythm-options-save data-dirty={dirty?'true':'false'} className={`min-h-[52px] rounded-xl px-3 font-black ${dirty?'bg-amber-400 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.35)]':'bg-amber-600 text-slate-950'}`}>{dirty?'変更を保存':'保存'}</button></div>
    </footer>
  </main>;
};'''
game = game[:start] + new_component + game[end:]

# 演出量・軽量モードを単なるラベルではなく、非必須グロー/影にも反映する。
game = replace_once(
    game,
    "boxShadow:'inset 0 -52px 42px rgba(207,250,254,.72),inset 0 -10px 16px rgba(255,255,255,.82),0 0 20px rgba(103,232,249,.72)',filter:'brightness(1.22)',transition:'opacity 45ms linear'",
    "boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'inset 0 -18px 18px rgba(207,250,254,.38),0 0 8px rgba(103,232,249,.38)':'inset 0 -52px 42px rgba(207,250,254,.72),inset 0 -10px 16px rgba(255,255,255,.82),0 0 20px rgba(103,232,249,.72)',filter:settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'brightness(1.08)':'brightness(1.22)',transition:settings.lightweightMode?'none':'opacity 45ms linear'",
    'feedback effect levels',
)
game = replace_once(
    game,
    'className="absolute bottom-[12%] left-0 right-0 h-[3px] bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300 shadow-[0_0_18px_#67e8f9,0_0_30px_#c084fc]"/>',
    'className="absolute bottom-[12%] left-0 right-0 h-[3px] bg-gradient-to-r from-fuchsia-300 via-cyan-100 to-fuchsia-300" style={{boxShadow:settings.lightweightMode||settings.effectAmount===\'MINIMAL\'?\'none\':settings.effectAmount===\'LOW\'?\'0 0 8px #67e8f9\':\'0 0 18px #67e8f9,0 0 30px #c084fc\'}}/>',
    'judgment line effect levels',
)
game = replace_once(
    game,
    "style={{textShadow:'0 0 10px rgba(255,255,255,.75),0 0 22px rgba(217,70,239,.35)'}}",
    "style={{textShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 7px rgba(255,255,255,.45)':'0 0 10px rgba(255,255,255,.75),0 0 22px rgba(217,70,239,.35)'}}",
    'judgment text effect levels',
)
game = replace_once(
    game,
    "style={{pointerEvents:'none',transform:'scaleY(var(--rhythm-end-depth-scale, 1))'}}",
    "style={{pointerEvents:'none',transform:'scaleY(var(--rhythm-end-depth-scale, 1))',boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 0 7px #67e8f9':'0 0 10px #67e8f9,0 0 18px #d946ef'}}",
    'end bar effect levels',
)
game = replace_once(
    game,
    "<span className={`absolute inset-0 rounded-full shadow-lg ${note.type==='HOLD'?'bg-gradient-to-b from-emerald-200 to-cyan-500':'bg-gradient-to-b from-amber-200 to-fuchsia-500'}`}/>",
    "<span className={`absolute inset-0 rounded-full ${note.type==='HOLD'?'bg-gradient-to-b from-emerald-200 to-cyan-500':'bg-gradient-to-b from-amber-200 to-fuchsia-500'}`} style={{boxShadow:settings.lightweightMode||settings.effectAmount==='MINIMAL'?'none':settings.effectAmount==='LOW'?'0 2px 6px rgba(15,23,42,.45)':'0 10px 15px -3px rgba(0,0,0,.24)'}}/>",
    'note effect levels',
)

GAME.write_text(game, encoding='utf-8')

check = r'''#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','game-system.jsx'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const docs=fs.readFileSync(path.join(ROOT,'docs','spec','RHYTHM_MODE.md'),'utf8');
const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};

ok('既存設定キーを後方互換で拡張',game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")&&game.includes("noteSeEnabled:bool('noteSeEnabled')")&&game.includes('DEFAULT_RHYTHM_SETTINGS'));
ok('STEP1項目と現行相当の既定値',game.includes('bgmVolume:100, noteSpeed:6, noteSize:100')&&game.includes('vibrationEnabled:false')&&game.includes("laneGlow:'NORMAL'")&&game.includes("effectAmount:'NORMAL', lightweightMode:false"));
ok('速度・サイズ・タイミングを指定範囲と刻みへnormalize',game.includes("rhythmFiniteStep(source.noteSpeed,3,10,.5")&&game.includes('rhythmFiniteStep(source.noteSize,80,120,5')&&game.includes('rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5'));
ok('デバッグ画面だけに44px以上の入口',game.includes('data-rhythm-options-open')&&game.includes("setGameState('RHYTHM_OPTIONS')")&&game.includes('min-h-[44px]'));
ok('下部固定操作バーと独立スクロール領域',game.includes('data-rhythm-options-scroll')&&game.includes('data-rhythm-options-actions')&&game.includes("env(safe-area-inset-bottom)")&&game.includes('data-rhythm-options-save'));
ok('変更時に保存ボタンを明示',game.includes("data-dirty={dirty?'true':'false'}")&&game.includes("dirty?'変更を保存':'保存'"));
ok('試聴はボタンの直接イベントから既存音声経路を使う',game.includes('onClick={previewBgm}')&&game.includes("Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume)")&&game.includes('onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)}')&&data.includes('preview:settings=>play(settings)'));
ok('音ゲーBGM音量だけを専用gainへ反映',game.includes('rhythmGain.gain.value=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))')&&game.includes('Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume)'));

const speedBlock=game.match(/const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;[\s\S]*?const rhythmTravelMsForSpeed=value=>\{[\s\S]*?\n\};/);
ok('速度変換を独立した描画helperに集約',!!speedBlock&&game.includes('travelMs=rhythmTravelMsForSpeed(settings.noteSpeed)'));
const sandbox={};
vm.runInNewContext(`${speedBlock[0]}\nthis.speed=rhythmTravelMsForSpeed;`,sandbox);
const slow=sandbox.speed(3),normal=sandbox.speed(6),fast=sandbox.speed(10);
ok('速度3/6/10は3200/2150/1200msで明確な実効差',slow===3200&&normal===2150&&fast===1200&&slow>normal&&normal>fast);
ok('速度は判定関数・入力照合へ渡さない',!game.includes('rhythmJudgeTap(deltaMs,settings.noteSpeed)')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSpeed)'));
ok('サイズは描画scaleだけで入力hitboxへ渡さない',game.includes('scale(${settings.noteSize/100})')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSize'));
ok('表示と入力で同じ判定offsetを使い窓幅は不変',game.includes('visualTime=songTimeMs-settings.judgmentTimingOffsetMs')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('const rhythmJudgeTap = deltaMs => RHYTHM_JUDGMENTS.find'));
ok('表示切替・レーン発光は入力を消さない',game.includes('settings.judgmentTextDisplay?view.last')&&game.includes('settings.fastSlowDisplay?(view.fastSlow')&&game.includes("settings.laneGlow==='NONE'?'0'")&&game.includes('inputStarts(starts)'));
ok('振動未対応を安全に扱う',game.includes('try{navigator.vibrate?.(8);}catch{}'));
ok('演出量は彩度だけでなくグローも段階化',game.includes("settings.effectAmount==='MINIMAL'?'none'")&&game.includes("settings.effectAmount==='LOW'?'0 0 8px #67e8f9'"));
ok('軽量モードはtransitionと複数グローを停止',game.includes("transition:settings.lightweightMode?'none'")&&game.match(/settings\.lightweightMode\|\|settings\.effectAmount==='MINIMAL'\?'none'/g)?.length>=4);
ok('軽量モードでもプレイ領域とDOM判定ラインを維持',game.includes('data-rhythm-lightweight')&&game.includes('data-rhythm-judgment-line')&&game.includes('data-rhythm-note'));
ok('仕様書へSTEP1と正式HOME未接続を記録',docs.includes('オプション STEP1')&&docs.includes('通常HOMEや一般公開導線には接続しない')&&docs.includes('正式HOMEへの入口と、正式公開時の最終デザインは未実装'));
console.log(`OK: 音ゲーオプション STEP1 runtime / speed ${slow}ms -> ${normal}ms -> ${fast}ms`);
'''
CHECK.write_text(check, encoding='utf-8')

docs = DOCS.read_text(encoding='utf-8')
docs = replace_once(
    docs,
    '「デフォルトに戻す」は編集中の値だけを戻し、「保存」で初めて確定する。振動の既定値はOFFで、Vibration APIがない端末でも失敗しない。',
    '「デフォルトに戻す」は編集中の値だけを戻し、「保存」で初めて確定する。操作ボタンはiPhoneのSafe Areaを避けた画面下固定バーに置き、設定項目だけをスクロールする。未保存変更がある場合は保存ボタンを強調する。振動の既定値はOFFで、Vibration APIがない端末でも失敗しない。',
    'docs fixed action bar',
)
docs = replace_once(
    docs,
    'ノーツ速度は見た目の移動時間だけ、ノーツサイズは描画scaleだけを変更する。判定タイミング調整は同一の `judgmentTimingOffsetMs` を表示時計・入力・HOLD終端へ適用し、判定窓幅、BPM、noteTime、スコア計算は変更しない。FAST/SLOW・判定文字・レーン発光・演出量・軽量モードも表示だけを変え、入力判定、DOM判定ライン、ノーツ、レーンを残す。',
    'ノーツ速度は見た目の移動時間だけを変更し、6.0は従来相当の約2150msを維持する。実機で差が分かるよう3.0は約3200ms、10.0は約1200msへ写し、authored noteTime・判定窓・入力時刻は変更しない。ノーツサイズは描画scaleだけを変更する。判定タイミング調整は同一の `judgmentTimingOffsetMs` を表示時計・入力・HOLD終端へ適用し、判定窓幅、BPM、noteTime、スコア計算は変更しない。FAST/SLOW・判定文字・レーン発光は表示だけを変える。演出量は彩度と非必須グロー/影を段階的に抑え、軽量モードは非必須グロー/影とtransitionを停止するが、入力判定、DOM判定ライン、ノーツ、レーンは残す。',
    'docs runtime behavior',
)
DOCS.write_text(docs, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
entry = '''  {\n    date: "2026-09-02 07:55", type:'issue', title:'音ゲーオプションの実動作と操作性を改善', releaseFlag:'rhythmMode',\n    items:['保存済みのノーツ速度が実機でほとんど変化して見えない問題を修正し、3.0／6.0／10.0で明確な流速差が出るようにしました。オプションの保存・デフォルト操作は画面下へ固定し、演出量と軽量モードも非必須グローや影へ実際に反映するよう改善しました。'],\n  },\n'''
changelog = replace_once(changelog, 'const CHANGELOG = [\n', 'const CHANGELOG = [\n' + entry, 'changelog entry')
CHANGELOG.write_text(changelog, encoding='utf-8')

print('patched rhythm options runtime/UI/docs/check')
