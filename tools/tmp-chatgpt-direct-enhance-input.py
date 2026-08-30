from pathlib import Path

ROOT = Path('.')
SOURCE = ROOT / 'monster-hero/src/game-system.jsx'
HELP = ROOT / 'monster-hero/data/help.js'
CHANGELOG = ROOT / 'monster-hero/data/changelog.js'
BULK_CHECK = ROOT / 'tools/masu/bulk-enhance-check.js'
TRANSCEND_CHECK = ROOT / 'tools/masu/transcendence-check.js'


def replace_once(path, old, new, label):
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

# --- game-system.jsx: normal enhancement direct input ---
replace_once(
    SOURCE,
    """          const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);\n          const addPlanStat = (key, direction) => changePlan('stat',key,direction);""",
    """          const setPlanValue = (kind, target, rawValue) => setBulkPlan(previous => {\n            const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};\n            const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);\n            const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);\n            const available=Math.max(0,points-(used-current));\n            const requested=Math.max(0,Math.trunc(Number(rawValue)||0));\n            let maxForTarget=available;\n            if(kind==='apt'){\n              const baseGradeIndex=DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[target]||'C');\n              maxForTarget=Math.min(maxForTarget,Math.max(0,DIST_APTITUDE_GRADES.length-1-baseGradeIndex));\n            }\n            const next=Math.min(requested,maxForTarget);\n            if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;\n            return q;\n          });\n          const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);\n          const addPlanStat = (key, direction) => changePlan('stat',key,direction);\n          const setPlanAptValue = (idx, value) => setPlanValue('apt',idx,value);\n          const setPlanStatValue = (key, value) => setPlanValue('stat',key,value);""",
    'normal direct-input setter',
)
replace_once(
    SOURCE,
    """<span className=\"text-center text-[9px] font-mono font-black text-amber-300\">{added}pt</span>""",
    """<input type=\"number\" inputMode=\"numeric\" min=\"0\" step=\"1\" aria-label={`${label}距離適性の振り分けポイントを直接入力`} value={added} onFocus={(e)=>e.currentTarget.select()} onChange={(e)=>setPlanAptValue(idx,e.currentTarget.value)} className=\"min-h-[40px] w-full rounded-lg border border-amber-500/30 bg-slate-950/80 px-1 text-center text-[10px] font-mono font-black text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400\" />""",
    'normal aptitude input',
)
replace_once(
    SOURCE,
    """<span className=\"text-center text-[9px] font-mono font-black text-amber-300\">{n}pt</span>""",
    """<input type=\"number\" inputMode=\"numeric\" min=\"0\" step=\"1\" aria-label={`${label}の振り分けポイントを直接入力`} value={n} onFocus={(e)=>e.currentTarget.select()} onChange={(e)=>setPlanStatValue(key,e.currentTarget.value)} className=\"min-h-[40px] w-full rounded-lg border border-amber-500/30 bg-slate-950/80 px-1 text-center text-[10px] font-mono font-black text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400\" />""",
    'normal stat input',
)
replace_once(
    SOURCE,
    """<div className=\"text-[8px] text-slate-500 mt-2\">＋／−は長押しでも連続調整できます。確定するまで保存データは変わりません。</div>""",
    """<div className=\"text-[8px] text-slate-500 mt-2\">ポイント欄をタップすると数値を直接入力できます。＋／−は長押しでも連続調整できます。確定するまで保存データは変わりません。</div>""",
    'normal helper text',
)

# --- game-system.jsx: transcend enhancement direct input ---
replace_once(
    SOURCE,
    """          const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);\n          const addStat = (key, direction) => changeTranscendPlan('stat', key, direction);""",
    """          const setTranscendPlanValue = (kind, target, rawValue) => setTranscendPlan(previous => {\n            const q = previous ? {apt:[...previous.apt], stat:{...previous.stat}} : {apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0}};\n            const current = kind==='apt' ? q.apt[target] : (q.stat[target]||0);\n            const used = q.apt.reduce((a,b)=>a+b,0) + Object.values(q.stat).reduce((a,b)=>a+b,0);\n            const available = Math.max(0, points - (used - current));\n            const requested = Math.max(0, Math.trunc(Number(rawValue)||0));\n            let maxForTarget = available;\n            if (kind==='apt') {\n              const room = DIST_APTITUDE_GRADES.length - 1 - DIST_APTITUDE_GRADES.indexOf(transcendGrade(target));\n              maxForTarget = Math.min(maxForTarget, Math.max(0, room));\n            }\n            const next = Math.min(requested, maxForTarget);\n            if (kind==='apt') q.apt[target] = next; else q.stat[target] = next;\n            return q;\n          });\n          const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);\n          const addStat = (key, direction) => changeTranscendPlan('stat', key, direction);\n          const setTranscendAptValue = (idx, value) => setTranscendPlanValue('apt', idx, value);\n          const setTranscendStatValue = (key, value) => setTranscendPlanValue('stat', key, value);""",
    'transcend direct-input setter',
)
replace_once(
    SOURCE,
    """<span className=\"text-center text-[9px] font-mono font-black text-sky-300\">{added}P</span>""",
    """<input type=\"number\" inputMode=\"numeric\" min=\"0\" step=\"1\" aria-label={`${label}の基礎適性の振り分けポイントを直接入力`} value={added} onFocus={(e)=>e.currentTarget.select()} onChange={(e)=>setTranscendAptValue(idx,e.currentTarget.value)} className=\"min-h-[40px] w-full rounded-lg border border-sky-500/30 bg-slate-950/80 px-1 text-center text-[10px] font-mono font-black text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400\" />""",
    'transcend aptitude input',
)
replace_once(
    SOURCE,
    """<span className=\"text-center text-[9px] font-mono font-black text-sky-300\">{n}P</span>""",
    """<input type=\"number\" inputMode=\"numeric\" min=\"0\" step=\"1\" aria-label={`${label}の基礎値の振り分けポイントを直接入力`} value={n} onFocus={(e)=>e.currentTarget.select()} onChange={(e)=>setTranscendStatValue(key,e.currentTarget.value)} className=\"min-h-[40px] w-full rounded-lg border border-sky-500/30 bg-slate-950/80 px-1 text-center text-[10px] font-mono font-black text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400\" />""",
    'transcend stat input',
)
replace_once(
    SOURCE,
    """<div className=\"text-[8px] text-slate-500 mt-2\">＋／−は長押しでも連続調整できます。1Pで基礎ライフ+{STAT_POINT_GAIN.hp}／ちから・丈夫さ・ガッツ+{STAT_POINT_GAIN.atk}／間合い適性1段階（どれも総合力+10相当）。</div>""",
    """<div className=\"text-[8px] text-slate-500 mt-2\">ポイント欄をタップすると数値を直接入力できます。＋／−は長押しでも連続調整できます。1Pで基礎ライフ+{STAT_POINT_GAIN.hp}／ちから・丈夫さ・ガッツ+{STAT_POINT_GAIN.atk}／間合い適性1段階（どれも総合力+10相当）。</div>""",
    'transcend helper text',
)

# --- help text ---
replace_once(
    HELP,
    """          { t:'p', text:'マスモン一覧の詳細画面から振れます。まとめて強化では、全項目共通の1P・5P・10P・MAXから単位を選び、＋／−（長押し対応）で下書きしてから一度に確定できます。MAXの＋は残りポイントと上限の範囲で最大まで配分し、MAXの−はその項目への今回の配分をすべて戻します。' },""",
    """          { t:'p', text:'マスモン一覧の詳細画面から振れます。まとめて強化では、全項目共通の1P・5P・10P・MAXから単位を選び、＋／−（長押し対応）で下書きしてから一度に確定できます。各項目のポイント欄をタップして、今回使いたいポイント数を直接入力することもできます。直接入力も確定前の下書きとして扱われ、残りポイントを超える入力や間合い適性の上限Mを超える入力は使える範囲へ自動で調整されます。MAXの＋は残りポイントと上限の範囲で最大c��で配分し、MAXの−はその項目への今回の配分をすべて戻します。' },""",
    'help normal enhance',
)
old_trans_note = """          { t:'note', title:'超越ポイントの使い道', text:'マスモン詳細の「強化」を開くと、どのマスモンでも「通常強化」と「超越強化」を切り替えられます。超越ポイントは基礎値を永久に上げるために使い、1ポイントでライフ基礎+10／ちから基礎+3／丈夫さ基礎+3／ガッツ基礎+3／間合い適性を1段階、のどれかを選べます。どれを選んでも総合力は+10相当です。間合い適性の上限は通常と同じMまです。振り分けかたは通常強化と同じで、1P／5P／10P／MAXの単位を選び、＋−は長押しでも動かせます。確定するまで保存データは変わりません。' },"""
new_trans_note = """          { t:'note', title:'超越ポイントの使い道', text:'マスモン詳細の「強化」を開くと、どのマスモンでも「通常強化」と「超越強化」を切り替えられます。超越ポイントは基礎値を永久に上げるために使い、1ポイントでライフ基礎+10／ちから基礎+3／丈夫さ基礎+3／ガッツ基礎+3／間合い適性を1段階、のどれかを選べます。どれを選んでも総合力は+10相当です。間合い適性の上限は通常と同じMまでです。振り分けかたは通常強化と同じで、1P／5P／10P／MAXの単位と長押しの＋−に加え、各項目のポイント欄へ今回使いたい数を直接入力できます。直接入力も残り超越ポイントと間合い適性の上限内へ自動で調整され、確定するまで保存データは変わりません。' },"""
replace_once(HELP, old_trans_note, new_trans_note, 'help transcend enhance')

# --- changelog ---
replace_once(
    CHANGELOG,
    "const CHANGELOG = [\n",
    """const CHANGELOG = [\n  {\n    date: \"2026-08-30 14:46\", type: 'update', title: '強化ポイントを数値で直接入力できるようにしました', status: 'new',\n    items: [\n      '通常強化と超越強化の各項目で、今回使うポイント数を直接入力できるようにしました。',\n      '1P・5P・10P・MAXと長押しの＋／−はそのまま使え、直接入力した値も確定前の下書きとしてプレビューへ反映します。',\n      '残りポイントを超える入力や、間合い適性がMを超える入力は使える範囲へ自動で調整します。',\n    ],\n  },\n""",
    'changelog entry',
)

# --- browser check: normal direct input ---
replace_once(
    BULK_CHECK,
    """  check('1P・5P・10P・MAXの共通切替がある', await page.locator('[aria-label=\"振り分け単位\"] button').count() === 4);\n\n  await clickExact('1P'); await clickControl('ライフを増やす');""",
    """  check('1P・5P・10P・MAXの共通切替がある', await page.locator('[aria-label=\"振り分け単位\"] button').count() === 4);\n  check('4距離＋4能力に直接入力欄がある', await page.locator('input[aria-label*=\"振り分けポイントを直接入力\"]').count() === 8);\n  const fillDirect = (aria, value) => page.locator(`input[aria-label=\"${aria}\"]`).fill(String(value));\n\n  await fillDirect('ライフの振り分けポイントを直接入力', 23);\n  allocation = await shownAllocation();\n  check('能力はポイント数を直接入力して下書きできる', allocation && allocation.total-allocation.left === 23, allocation?.text);\n  check('直接入力しただけではセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));\n  await fillDirect('ライフの振り分けポイントを直接入力', 0);\n  allocation = await shownAllocation();\n  check('直接入力を0へ戻すとその項目の下書きも0になる', allocation && allocation.left === allocation.total, allocation?.text);\n\n  await fillDirect('零距離適性の振り分けポイントを直接入力', 999);\n  allocation = await shownAllocation();\n  const directAptText = await text();\n  check('距離適性の直接入力はMで自動停止する', /C\\s*→\\s*M/.test(directAptText), directAptText.match(/C\\s*→\\s*\\S+/)?.[0]);\n  check('距離適性の上限を超えた入力でも余りポイントを残す', allocation && allocation.left > 0, allocation?.text);\n  await fillDirect('零距離適性の振り分けポイントを直接入力', 0);\n\n  await fillDirect('ライフの振り分けポイントを直接入力', 999);\n  allocation = await shownAllocation();\n  check('能力の直接入力は残りポイントを超えず自動停止する', allocation && allocation.left === 0, allocation?.text);\n  await fillDirect('ライフの振り分けポイントを直接入力', 0);\n\n  await clickExact('1P'); await clickControl('ライフを増やす');""",
    'bulk browser direct-input checks',
)

# --- transcendence static coverage for direct-input UI ---
replace_once(
    TRANSCEND_CHECK,
    """const DIAMOND_COST = G('TRANSCEND_DIAMOND_COST');\n\nconst masu = (over = {}) => ({""",
    """const DIAMOND_COST = G('TRANSCEND_DIAMOND_COST');\n\ncheck('通常強化の直接入力UIを実装している',\n  source.includes('const setPlanValue =')\n  && source.includes('距離適性の振り分けポイントを直接入力')\n  && source.includes('の振り分けポイントを直接入力'));\ncheck('超越強化の直接入力UIを実装している',\n  source.includes('const setTranscendPlanValue =')\n  && source.includes('の基礎適性の振り分けポイントを直接入力')\n  && source.includes('の基礎値の振り分けポイントを直接入力'));\n\nconst masu = (over = {}) => ({""",
    'transcend direct-input static checks',
)

print('direct-input patch applied')
