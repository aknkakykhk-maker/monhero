from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


src_path = Path('monster-hero/src/game-system.jsx')
src = src_path.read_text()

# 通常強化: 各項目の使用Pを直接セットする。
normal_marker = "          const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);"
normal_helper = """          const setPlanAmount = (kind, target, rawValue) => setBulkPlan(previous => {
            const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};
            const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);
            const requested=Math.max(0,Math.floor(Number(rawValue)||0));
            const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);
            const otherUsed=Math.max(0,used-current);
            let next=Math.min(requested,Math.max(0,points-otherUsed));
            if(kind==='apt'){
              const baseGradeIndex=DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[target]||'C');
              next=Math.min(next,Math.max(0,DIST_APTITUDE_GRADES.length-1-baseGradeIndex));
            }
            if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;
            return q;
          });
""" + normal_marker
src = replace_once(src, normal_marker, normal_helper, 'normal direct-input helper')

# 超越強化も同じ操作感にする。
transcend_marker = "          const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);"
transcend_helper = """          const setTranscendPlanAmount = (kind, target, rawValue) => setTranscendPlan(previous => {
            const q = previous ? {apt:[...previous.apt], stat:{...previous.stat}} : {apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0}};
            const current = kind==='apt' ? q.apt[target] : (q.stat[target]||0);
            const requested = Math.max(0, Math.floor(Number(rawValue)||0));
            const used = q.apt.reduce((a,b)=>a+b,0) + Object.values(q.stat).reduce((a,b)=>a+b,0);
            const otherUsed = Math.max(0, used-current);
            let next = Math.min(requested, Math.max(0, points-otherUsed));
            if (kind==='apt') {
              const room = DIST_APTITUDE_GRADES.length - 1 - DIST_APTITUDE_GRADES.indexOf(transcendGrade(target));
              next = Math.min(next, Math.max(0, room));
            }
            if (kind==='apt') q.apt[target] = next; else q.stat[target] = next;
            return q;
          });
""" + transcend_marker
src = replace_once(src, transcend_marker, transcend_helper, 'transcend direct-input helper')

old_grid = 'grid grid-cols-[44px_1fr_46px_1fr] items-center gap-1 rounded-xl bg-black/35 p-1.5'
grid_count = src.count(old_grid)
if grid_count != 4:
    raise SystemExit(f'enhance allocation row grid: expected 4 matches, got {grid_count}')
src = src.replace(old_grid, 'grid grid-cols-[44px_minmax(0,1fr)_58px_minmax(0,1fr)] items-center gap-1 rounded-xl bg-black/35 p-1.5')

normal_apt_old = '<span className="text-center text-[9px] font-mono font-black text-amber-300">{added}pt</span>'
normal_apt_new = '<label className="h-10 min-w-0 flex items-center rounded-lg border border-amber-500/30 bg-slate-950/80 px-1"><input type="number" inputMode="numeric" min="0" step="1" value={added||\'\'} placeholder="0" aria-label={`${label}距離適性の使用ポイントを直接入力`} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanAmount(\'apt\',idx,e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\')e.currentTarget.blur();}} className="w-full min-w-0 bg-transparent text-center font-mono font-black text-[10px] text-amber-200 outline-none"/><span className="shrink-0 text-[8px] font-black text-amber-500">P</span></label>'
src = replace_once(src, normal_apt_old, normal_apt_new, 'normal aptitude input')

normal_stat_old = '<span className="text-center text-[9px] font-mono font-black text-amber-300">{n}pt</span>'
normal_stat_new = '<label className="h-10 min-w-0 flex items-center rounded-lg border border-amber-500/30 bg-slate-950/80 px-1"><input type="number" inputMode="numeric" min="0" step="1" value={n||\'\'} placeholder="0" aria-label={`${label}の使用ポイントを直接入力`} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanAmount(\'stat\',key,e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\')e.currentTarget.blur();}} className="w-full min-w-0 bg-transparent text-center font-mono font-black text-[10px] text-amber-200 outline-none"/><span className="shrink-0 text-[8px] font-black text-amber-500">P</span></label>'
src = replace_once(src, normal_stat_old, normal_stat_new, 'normal stat input')

transcend_apt_old = '<span className="text-center text-[9px] font-mono font-black text-sky-300">{added}P</span>'
transcend_apt_new = '<label className="h-10 min-w-0 flex items-center rounded-lg border border-sky-500/30 bg-slate-950/80 px-1"><input type="number" inputMode="numeric" min="0" step="1" value={added||\'\'} placeholder="0" aria-label={`${label}の基礎適性の使用ポイントを直接入力`} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanAmount(\'apt\',idx,e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\')e.currentTarget.blur();}} className="w-full min-w-0 bg-transparent text-center font-mono font-black text-[10px] text-sky-200 outline-none"/><span className="shrink-0 text-[8px] font-black text-sky-500">P</span></label>'
src = replace_once(src, transcend_apt_old, transcend_apt_new, 'transcend aptitude input')

transcend_stat_old = '<span className="text-center text-[9px] font-mono font-black text-sky-300">{n}P</span>'
transcend_stat_new = '<label className="h-10 min-w-0 flex items-center rounded-lg border border-sky-500/30 bg-slate-950/80 px-1"><input type="number" inputMode="numeric" min="0" step="1" value={n||\'\'} placeholder="0" aria-label={`${label}の基礎値の使用ポイントを直接入力`} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanAmount(\'stat\',key,e.target.value)} onKeyDown={e=>{if(e.key===\'Enter\')e.currentTarget.blur();}} className="w-full min-w-0 bg-transparent text-center font-mono font-black text-[10px] text-sky-200 outline-none"/><span className="shrink-0 text-[8px] font-black text-sky-500">P</span></label>'
src = replace_once(src, transcend_stat_old, transcend_stat_new, 'transcend stat input')

src = replace_once(
    src,
    '＋／−は長押しでも連続調整できます。確定するまで保存データは変わりません。',
    'P欄は数値を直接入力できます。＋／−は長押しでも連続調整できます。確定するまで保存データは変わりません。',
    'normal help note',
)
src = replace_once(
    src,
    '＋／−は長押しでも連続調整できます。1Pで基礎ライフ+{STAT_POINT_GAIN.hp}／ちから・丈夫さ・ガッツ+{STAT_POINT_GAIN.atk}／間合い適性1段階（どれも総合力+10相当）。',
    'P欄は数値を直接入力できます。＋／−は長押しでも連続調整できます。1Pで基礎ライフ+{STAT_POINT_GAIN.hp}／ちから・丈夫さ・ガッツ+{STAT_POINT_GAIN.atk}／間合い適性1段階（どれも総合力+10相当）。',
    'transcend help note',
)

for label in [
    '距離適性の使用ポイントを直接入力',
    'の使用ポイントを直接入力',
    'の基礎適性の使用ポイントを直接入力',
    'の基礎値の使用ポイントを直接入力',
]:
    if label not in src:
        raise SystemExit(f'missing direct-input label: {label}')
src_path.write_text(src)

# 既存ブラウザ回帰テストへ通常強化の直接入力確認を追加。
check_path = Path('tools/masu/bulk-enhance-check.js')
check_src = check_path.read_text()
check_marker = "  check('1P・5P・10P・MAXの共通切替がある', await page.locator('[aria-label=\"振り分け単位\"] button').count() === 4);\n"
check_insert = check_marker + """

  const directLifeInput = page.locator('input[aria-label="ライフの使用ポイントを直接入力"]');
  check('通常強化にポイント直接入力欄がある', await directLifeInput.count() === 1);
  await directLifeInput.fill('37');
  allocation = await shownAllocation();
  check('直接入力した37Pがそのまま下書きへ反映される', allocation && allocation.total-allocation.left === 37, allocation?.text);
  check('直接入力でも確定前はセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));
  await directLifeInput.fill('9999');
  allocation = await shownAllocation();
  check('所持Pを超える直接入力は残りPまでで止まる', allocation && allocation.left === 0, allocation?.text);
  await directLifeInput.fill('0');
  allocation = await shownAllocation();
  check('直接入力で0へ戻すと下書きも0になる', allocation && allocation.left === allocation.total, allocation?.text);
  check('390px幅で直接入力欄を追加しても横スクロールしない', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
"""
if check_src.count(check_marker) != 1:
    raise SystemExit('bulk-enhance-check insertion marker not unique')
check_path.write_text(check_src.replace(check_marker, check_insert, 1))

# 更新履歴。
changelog_path = Path('monster-hero/data/changelog.js')
changelog = changelog_path.read_text()
changelog_marker = 'const CHANGELOG = [\n'
if changelog.count(changelog_marker) != 1:
    raise SystemExit('changelog marker not unique')
now = datetime.now(ZoneInfo('Asia/Tokyo')).strftime('%Y-%m-%d %H:%M')
entry = f"""const CHANGELOG = [
  {{
    date: \"{now}\", type: 'update', title: '強化ポイントを直接入力できるようにしました', status: 'new',
    items: [
      'マスモンの通常強化と超越強化で、各ステータス・間合い適性のP欄へ使いたいポイント数を直接入力できるようにしました。',
      'これまでの1P・5P・10P・MAXと＋／−操作もそのまま使えます。所持ポイントや間合い適性の上限を超える入力は、自動で使える範囲までに調整されます。',
    ],
  }},
"""
changelog_path.write_text(changelog.replace(changelog_marker, entry, 1))

# ヘルプ。「育成」を含むカテゴリへ追加し、無ければ先頭カテゴリへ追加。
help_path = Path('monster-hero/data/help.js')
help_src = help_path.read_text()
if "id: 'enhance-point-direct-input'" in help_src:
    raise SystemExit('help topic already exists unexpectedly')
topic = """      {
        id: 'enhance-point-direct-input', emoji: '🔢', title: '強化ポイントの直接入力',
        assistant: 'ポイントが多いときは、P欄に数字を直接入れると一気に振れるよ♪',
        expression: 'happy',
        blocks: [
          { t:'p', text:'マスモンの「強化」では、通常強化・超越強化とも各ステータスと間合い適性のP欄へ、使いたいポイント数を直接入力できます。1P・5P・10P・MAXと＋／−操作もこれまでどおり使えます。入力値は所持ポイントと間合い適性の上限を超えない範囲へ自動調整され、確定するまで保存データは変わりません。' },
        ],
      },
"""
cat_match = re.search(r"\{\n\s+id:\s*'[^']+'[\s\S]{0,500}?title:\s*'[^']*育成[^']*'[\s\S]{0,800}?topics:\s*\[\n", help_src)
if cat_match:
    insert_at = cat_match.end()
else:
    fallback = '    topics: [\n'
    insert_at = help_src.find(fallback)
    if insert_at < 0:
        raise SystemExit('help topics insertion point not found')
    insert_at += len(fallback)
help_path.write_text(help_src[:insert_at] + topic + help_src[insert_at:])

print('Focused enhancement direct-input patch applied.')
