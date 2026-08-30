from pathlib import Path

src = Path('monster-hero/src/game-system.jsx')
s = src.read_text()

old_button = '''{(autoBattle||autoRepeat)&&<button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="AUTO BGMを選ぶ" title="AUTO BGM" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[7px] font-black leading-none">BGM</span></button>}'''
new_button = '''<button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="バトルBGMと音量を調整" title="BGM / 音量" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[7px] font-black leading-none">BGM</span></button>'''
count = s.count(old_button)
if count != 2:
    raise SystemExit(f'BGM button pattern count expected 2, got {count}')
s = s.replace(old_button, new_button)

old_route = '''      if (autoBattleRef.current) {
        if (autoBgmOverride === '__none__') return '__silence_bgm__';
        return autoBgmOverride || bgmArrangement.autoBattle;
      }
'''
new_route = '''      // バトル画面のBGMボタンで選んだ曲は、手動/AUTOどちらでもそのラン中だけ優先する。
      // 保存済みBGMアレンジは変更しない。パンドラ専用曲は上で優先する。
      if (autoBgmOverride === '__none__') return '__silence_bgm__';
      if (autoBgmOverride) return autoBgmOverride;
      if (autoBattleRef.current) return bgmArrangement.autoBattle;
'''
if old_route not in s:
    raise SystemExit('BGM routing pattern not found')
s = s.replace(old_route, new_route, 1)

start = s.find("{showAutoBgmPicker&&(autoBattle||autoRepeat)&&<div data-auto-bgm-picker")
if start < 0:
    raise SystemExit('AUTO BGM picker start not found')
end = s.find("</div></div>}", start)
if end < 0:
    raise SystemExit('AUTO BGM picker end not found')
end += len("</div></div>}")
picker_new = '''{showAutoBgmPicker&&gameState==='BATTLE'&&<div data-auto-bgm-picker className="fixed inset-0 flex items-end justify-center bg-black/55 p-3" style={{zIndex:2147483647}} onClick={()=>setShowAutoBgmPicker(false)}><div className="w-full max-w-sm rounded-2xl border border-indigo-300/40 bg-slate-950 p-4 text-left shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-2 mb-3"><div><div className="text-sm font-black text-white">BGM / 音量</div><div className="text-[10px] text-slate-400">{ultraEcoSession?'超省エネ中：SEはOFF固定':(autoBattle||autoRepeat)?'AUTO中のBGMを一時変更':'このバトル中のBGMを一時変更'}</div></div><button type="button" onClick={()=>setShowAutoBgmPicker(false)} className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 text-slate-200 font-black">×</button></div><div className="mb-2">{ultraEcoSession?<div className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-black text-slate-400">🔕 SE 0　超省エネ中はOFF固定</div>:<VolumeSlider label="SE" icon="🔔" value={seVolume} onChange={changeSeVolume} gradient="from-cyan-500 to-indigo-500" thumbRing="border-indigo-400"/>}</div><div className="mb-3"><VolumeSlider label="BGM" icon="🎵" value={bgmVolume} onChange={changeBgmVolume} gradient="from-fuchsia-500 to-pink-500" thumbRing="border-fuchsia-400"/></div><label className="block"><span className="text-xs font-black text-slate-300">再生するBGM</span><select aria-label="バトル中に再生するBGM" value={autoBgmOverride||(autoBattle||autoRepeat?bgmArrangement.autoBattle:bgmKeyForState(gameState,wave,enemy?.id,(waveHistory||[]).length>0,hp<=0||gaveUp))} onChange={e=>selectAutoRuntimeBgm(e.target.value)} className="mt-1 w-full min-h-[48px] rounded-xl border border-white/15 bg-slate-900 px-3 text-sm text-white"><option value="__none__">BGMなし</option>{BGM_TRACKS.map(track=><option key={track.id} value={track.id}>{track.name}</option>)}</select></label><p className="mt-2 text-[10px] leading-relaxed text-slate-400">BGMの一時選択は保存済みBGMアレンジを変更しません。SE/BGM音量はHOMEの音量設定と共通です。</p></div></div>}'''
s = s[:start] + picker_new + s[end:]
src.write_text(s)

help_path = Path('monster-hero/data/help.js')
h = help_path.read_text()
old_help = 'AUTO中はバトル画面の🎵ボタン（下部）から、そのAUTOセッションだけ別の登録曲へ変更でき、「BGMなし」も選べます。🎵ボタン内ではBGM音量も調整できます。'
new_help = 'バトル画面下部の🎵BGMボタンは通常操作中もAUTO中も常設されています。通常操作中はそのバトル中だけ、AUTO中はそのAUTOセッション中だけ別の登録曲へ変更でき、「BGMなし」も選べます。🎵BGMパネルではSE音量とBGM音量をHOMEの音量設定と共通で調整できます。'
if old_help not in h:
    raise SystemExit('help BGM guidance pattern not found')
h = h.replace(old_help, new_help, 1)
h = h.replace('AUTO中の🎵BGMボタンは、スコア表示などと重ならないよう画面下部のVIEW／AUTO付近にあります。', '🎵BGMボタンは、スコア表示などと重ならないよう画面下部のVIEW／AUTO付近にあります。', 1)
help_path.write_text(h)

changelog_path = Path('monster-hero/data/changelog.js')
c = changelog_path.read_text()
marker = 'const CHANGELOG = [\n'
if marker not in c:
    raise SystemExit('changelog marker not found')
entry = '''  {\n    date: "2026-08-30 10:00", type: 'update', title: 'バトル中の音量操作をまとめました', status: 'new',\n    items: [\n      '画面下部の🎵BGMボタンを通常バトル中も常設し、AUTOをOFFにしていても使えるようにしました。',\n      'BGMパネルにSE音量とBGM音量をまとめ、HOMEの音量設定と同じ保存値をその場で調整できるようにしました。',\n      'AUTO∞の超省エネ中は従来どおりSEをOFF固定にし、BGM選択・BGM音量だけ操作できます。',\n    ],\n  },\n'''
if 'バトル中の音量操作をまとめました' not in c:
    c = c.replace(marker, marker + entry, 1)
changelog_path.write_text(c)

check_path = Path('tools/audio/auto-bgm-runtime-picker-check.js')
r = check_path.read_text()
old = "check(file+': AUTO中は一時選択を優先',s.includes(\"if (autoBgmOverride === '__none__') return '__silence_bgm__';\")&&s.includes('return autoBgmOverride || bgmArrangement.autoBattle;'));"
new = "check(file+': バトル中は一時選択を優先',s.includes(\"if (autoBgmOverride === '__none__') return '__silence_bgm__';\")&&s.includes('if (autoBgmOverride) return autoBgmOverride;')&&s.includes('if (autoBattleRef.current) return bgmArrangement.autoBattle;'));"
if old not in r:
    raise SystemExit('runtime picker route check pattern not found')
r = r.replace(old, new)
old2 = "if(file.includes('/src/')) check(file+': BGM選択UIの主要文字列',s.includes('AUTO BGMを選ぶ')&&s.includes('BGMなし')&&s.includes('AUTO中に再生するBGM'));"
new2 = "if(file.includes('/src/')) { check(file+': BGMボタン常設',s.includes('バトルBGMと音量を調整')&&!s.includes('{(autoBattle||autoRepeat)&&<button data-auto-bgm-button')); check(file+': BGM/SEパネル',s.includes('BGM / 音量')&&s.includes('label=\\\"SE\\\"')&&s.includes('label=\\\"BGM\\\"')&&s.includes('バトル中に再生するBGM')); }"
if old2 not in r:
    raise SystemExit('runtime picker UI check pattern not found')
r = r.replace(old2, new2)
old3 = "check('ヘルプにAUTO BGM選択を掲載',help.includes('AUTO中はバトル画面の🎵ボタン'));"
new3 = "check('ヘルプにバトルBGM操作を掲載',help.includes('通常操作中もAUTO中も常設')&&help.includes('SE音量とBGM音量'));"
if old3 not in r:
    raise SystemExit('runtime picker help check pattern not found')
r = r.replace(old3, new3)
check_path.write_text(r)
