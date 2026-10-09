// 味方モンスターの「Tier 表」のページを作る。社長が見るパネル式の1枚(アーティファクト用)。
//
// 研究所が数字を直すのは docs/playbot/reports/tier/tier.json(monster-tier.md と同じ値を写したもの)。
// 直したら、このコマンドで作り直す(出来たページは統括部長が Artifact で同じ URL へ出し直す):
//
//   node tools/playbot/tier-page.js [--out <出力先>]    既定: docs/playbot/dashboard/tier.html
//   node tools/playbot/tier-page.js --rebuild-icons     縮めた顔アイコンを作り直してからページを作る
//   node tools/playbot/tier-page.js --json <別の tier.json>   試し用(その JSON を読む。--out と合わせて使う)
//   node tools/playbot/tier-page.js --check             tier.json の形だけ確かめる(ページは作らない)
//
// 顔アイコンは docs/playbot/dashboard/tier-icons/(96px。map.json が 名前 → ファイル)から data URI で埋め込む。
// スクリプトを使わない素の HTML(<details> で開閉)。社長室(president-room.js)と同じ作り・色。
// tier.json の形がおかしいときは、ページを作らずに止める(validate)。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const jsonArg = process.argv.indexOf('--json');
const JSON_PATH = jsonArg > 0 ? path.resolve(process.argv[jsonArg + 1]) : path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'tier.json');
const ICON_DIR = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier-icons');
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier.html');

const REBUILD_ICONS = process.argv.includes('--rebuild-icons'); // 縮めたアイコンを作り直す(寄せ指定や大きさを変えたとき)
const TIERS = ['S', 'A', 'B', 'C', 'D', '保留'];
const OVERALL_TIERS = [...TIERS, '回数不足']; // 回数不足 = どの難易度も5回未満で、総合はまだ付けない
const DIFFS = ['Hard', 'Expert', 'Master'];
const DIFF_TIERS = [...TIERS, '—']; // — はその難易度でまだ測れていない
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function validate(d) {
  const p = [];
  if (!d || typeof d !== 'object') return ['tier.json がオブジェクトではありません'];
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(d.更新 || '')) p.push('更新は "2026-10-10 07:42" の形(日本時間)');
  if (!d.数えた回 || !Number.isFinite(d.数えた回.合計)) p.push('数えた回.合計 は数');
  if (!d.決め方 || !d.決め方.重み || !DIFFS.every((k) => Number.isFinite(d.決め方.重み[k]))) p.push('決め方.重み に Hard・Expert・Master の数が要る');
  if (!Array.isArray(d.決め方 && d.決め方.文)) p.push('決め方.文 は文の配列');
  if (!Array.isArray(d.モンスター) || !d.モンスター.length) return p.concat('モンスター が空か配列ではありません');
  const names = new Set();
  for (const m of d.モンスター) {
    const at = `モンスター「${m && m.名前}」`;
    if (!m || !m.名前) { p.push('名前の無いモンスターがあります'); continue; }
    if (names.has(m.名前)) p.push(`${at}: 名前が重なっています`);
    names.add(m.名前);
    if (!OVERALL_TIERS.includes(m.総合)) p.push(`${at}: 総合 は ${OVERALL_TIERS.join('・')} のどれか(いま「${m.総合}」)`);
    for (const k of DIFFS) if (!DIFF_TIERS.includes(m[k])) p.push(`${at}: ${k} は ${DIFF_TIERS.join('・')} のどれか(いま「${m[k]}」)`);
    if (typeof m.暫定 !== 'boolean') p.push(`${at}: 暫定 は true / false`);
    if (!m.役) p.push(`${at}: 役が空です`);
    if (!m.理由) p.push(`${at}: 理由が空です`);
    if (typeof m.強み !== 'string' || typeof m.弱み !== 'string') p.push(`${at}: 強み・弱み は文字(無ければ "")`);
    if (!m.回数 || !DIFFS.every((k) => Number.isInteger(m.回数[k]) && m.回数[k] >= 0)) p.push(`${at}: 回数 に Hard・Expert・Master の0以上の整数が要る`);
    if (m.机上 && (!Number.isFinite(m.机上.通常技1発) || !m.机上.受けられる || !DIFFS.every((k) => Number.isFinite(m.机上.受けられる[k])))) p.push(`${at}: 机上の形がおかしい(通常技1発・20ターンの火力・受けられる{Hard,Expert,Master})`);
  }
  const nameList = (v, at, label) => {
    if (v === undefined) return;
    if (!Array.isArray(v) || v.some((x) => !x || !x.名前 || !x.理由)) p.push(`${at}: ${label} は [{名前, 理由}] の配列`);
  };
  for (const m of d.モンスター) { nameList(m.おすすめアシカ, `モンスター「${m.名前}」`, 'おすすめアシカ'); nameList(m.相性のいい供モン, `モンスター「${m.名前}」`, '相性のいい供モン'); }
  if (d.アシカ !== undefined) {
    if (!Array.isArray(d.アシカ)) p.push('アシカ は配列にする');
    else {
      const an = new Set();
      for (const a of d.アシカ) {
        const at = `アシカ「${a && a.名前}」`;
        if (!a || !a.名前) { p.push('名前の無いアシカがあります'); continue; }
        if (an.has(a.名前)) p.push(`${at}: 名前が重なっています`);
        an.add(a.名前);
        if (!OVERALL_TIERS.includes(a.総合)) p.push(`${at}: 総合 は ${OVERALL_TIERS.join('・')} のどれか(いま「${a.総合}」)`);
        for (const k of DIFFS) if (!DIFF_TIERS.includes(a[k])) p.push(`${at}: ${k} は ${DIFF_TIERS.join('・')} のどれか(いま「${a[k]}」)`);
        if (typeof a.暫定 !== 'boolean') p.push(`${at}: 暫定 は true / false`);
        if (!a.理由) p.push(`${at}: 理由が空です`);
        if (a.回数 && !DIFFS.every((k) => Number.isInteger(a.回数[k]) && a.回数[k] >= 0)) p.push(`${at}: 回数 に Hard・Expert・Master の0以上の整数が要る`);
        nameList(a.合うモンスター, at, '合うモンスター');
      }
    }
  }
  if (d.組み合わせ !== undefined) {
    if (!Array.isArray(d.組み合わせ)) p.push('組み合わせ は配列にする');
    else for (const c of d.組み合わせ) {
      const at = `組み合わせ「${c && c.勇者}×${c && c.供}」`;
      if (!c || !names.has(c.勇者) || !names.has(c.供)) p.push(`${at}: 勇者・供 はモンスターの名前にする`);
      if (!c || !['よい', 'わるい'].includes(c.評価)) p.push(`${at}: 評価 は よい / わるい`);
      if (c && !c.理由) p.push(`${at}: 理由が空です`);
      if (c && typeof c.確かめた !== 'boolean') p.push(`${at}: 確かめた は true / false`);
      if (c && c.点 !== undefined && !Number.isFinite(c.点)) p.push(`${at}: 点 は数`);
    }
  }
  return p;
}

// 顔アイコンは「ゲームと同じ定義」から引く(2026-10-10 社長「顔アイコンはゲーム上に実装されてるから、それと同じ仕組みを使えない?」)。
// images-ally.js と ally-monsters.js を読み、ALL_PLAYER_MONSTERS[...].faceIconUrl のファイルを縮めて tier-icons/ に置き(置いたものは使い回す)、
// data URI で埋め込む。名前の対応は手で書かない。縮めるのは ImageMagick の convert(置き済みのものがあれば要らない)。
// 立ち絵そのものを顔アイコンにしている子(ライガー・ミーア・パンドラ・プラント)は、ゲームのプロフィールアイコン(BreederIcon)と同じ
// 「contain で置き、MARKET_PROFILE_ICON_STYLES の scale / x / y で寄せる」やり方で出す(値は 20-market-notices-help.jsx から読む。手で写さない)。
function gameFaces() {
  const vm = require('vm');
  const ctx = vm.createContext({ console, Object, Math });
  const MH = path.join(ROOT, 'monster-hero');
  for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/breeder.js']) {
    vm.runInContext(fs.readFileSync(path.join(MH, f), 'utf8') + '\n;this.__r = typeof ALL_PLAYER_MONSTERS !== "undefined" ? ALL_PLAYER_MONSTERS : this.__r; this.__t = typeof TEACHING_CARDS !== "undefined" ? TEACHING_CARDS : this.__t', ctx, { filename: f });
  }
  const market = fs.readFileSync(path.join(MH, 'src', 'parts', '20-market-notices-help.jsx'), 'utf8');
  // ほかの定数を参照する行(kiki_icon: KIKI_… など)があるので、全体を評価せず「モンスターの id: { scale, x, y }」の行だけ読む
  const mm = /const MARKET_PROFILE_ICON_STYLES = \{([\s\S]*?)\n\};/.exec(market);
  const styles = {};
  for (const line of (mm ? mm[1] : '').split('\n')) {
    const r = /^\s*(\w+): \{ scale: ([\d.-]+), x: ([\d.-]+), y: ([\d.-]+) \}/.exec(line);
    if (r) styles[r[1]] = { scale: +r[2], x: +r[3], y: +r[4] };
  }
  const out = {};
  // アシカ(アシストカード)。ゲームの TEACHING_CARDS の icon と、15-dye-and-art.jsx の ASSIST_CARD_ICON_STYLES(ききだけ顔へ寄せる)をそのまま使う
  const dye = fs.readFileSync(path.join(MH, 'src', 'parts', '15-dye-and-art.jsx'), 'utf8');
  const consts = {};
  for (const r of dye.matchAll(/const (\w+) = Object\.freeze\(\{ scale:\s*([\d.-]+),\s*x:\s*([\d.-]+),\s*y:\s*([\d.-]+)\s*\}\);/g)) consts[r[1]] = { scale: +r[2], x: +r[3], y: +r[4] };
  const am = /const ASSIST_CARD_ICON_STYLES = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(dye);
  const assistStyles = {};
  for (const r of (am ? am[1] : '').matchAll(/(\w+):\s*(\w+)/g)) if (consts[r[2]]) assistStyles[r[1]] = consts[r[2]];
  const assists = (ctx.__t || []).map((c) => ({ id: c.id, name: c.baseName, file: path.join(MH, String(c.icon || '').split('?')[0]), style: assistStyles[c.id] || { scale: 1, x: 0, y: 0 } }));
  out.__assists = assists;
  for (const [id, m] of Object.entries(ctx.__r || {})) {
    const u = String(m.faceIconUrl || m.iconUrl || '').split('?')[0];
    if (!u || u.startsWith('data:')) continue;
    // 立ち絵そのものが顔アイコンの子だけ、ゲームのプロフィールアイコン(<id小文字>_icon。無ければ id)の寄せ指定を当てる
    const sameArt = u === String(m.imgUrl || '').split('?')[0];
    out[m.name] = { file: path.join(MH, u), style: (sameArt && (styles[id.toLowerCase() + '_icon'] || styles[id])) || { scale: 1, x: 0, y: 0 } };
  }
  return out;
}

// アシカの名前は、ゲームの baseName(「ニコラオの力」)・id(oryo)・名前の頭(「ニコラオ」)のどれでも引ける
function findAssist(assists, name) {
  return assists.find((c) => c.name === name || c.id === name) || assists.find((c) => c.name.startsWith(name));
}

function loadIcons(monNames, assistNames) {
  const faces = gameFaces();
  const css = [];
  const cls = {};
  const style = {};
  fs.mkdirSync(ICON_DIR, { recursive: true });
  const put = (key, i, f) => {
    if (!f || !fs.existsSync(f.file)) return; // ゲームに顔アイコンが無い子は頭文字のタイル
    const dst = path.join(ICON_DIR, path.basename(f.file, path.extname(f.file)).toLowerCase() + '.png');
    if (REBUILD_ICONS || !fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(f.file).mtimeMs) {
      const px = f.style.scale > 2 ? 300 : f.style.scale > 1.2 ? 200 : 96; // 大きく寄せる絵は粗くならないよう大きめに残す
      require('child_process').execFileSync('convert', [f.file, '-resize', `${px}x${px}`, '-strip', dst]);
    }
    cls[key] = 'i' + i;
    const { scale = 1, x = 0, y = 0 } = f.style;
    style[key] = scale === 1 && !x && !y ? '' : ` style="transform:translate(${x}%,${y}%) scale(${scale})"`;
    css.push(`.i${i}{background-image:url(data:image/png;base64,${fs.readFileSync(dst).toString('base64')})}`);
  };
  monNames.forEach((n, i) => put('m:' + n, 'm' + i, faces[n]));
  assistNames.forEach((n, i) => put('a:' + n, 'a' + i, findAssist(faces.__assists, n)));
  return { cls, style, css: css.join('\n') };
}

function build(d) {
  const mons = d.モンスター;
  const assists = Array.isArray(d.アシカ) ? d.アシカ : null;
  const combos = Array.isArray(d.組み合わせ) ? d.組み合わせ : null;
  const aNames = [...new Set([...(assists || []).map((a) => a.名前), ...mons.flatMap((m) => (m.おすすめアシカ || []).map((x) => x.名前)), ...(assists || []).flatMap(() => [])])];
  const { cls, style, css } = loadIcons(mons.map((m) => m.名前), aNames);
  const iconOf = (kind, name, extra = '') => {
    const key = kind + ':' + name;
    return `<span class="ic ${extra}" role="img" aria-label="${esc(name)}">${cls[key] ? `<i class="${cls[key]}"${style[key]}></i>` : esc(name.slice(0, 1))}</span>`;
  };
  const tcls = (t) => (['保留', '—', '回数不足'].includes(t) ? 'h' : t);
  const tier = (t) => `<b class="t t-${tcls(t)}">${esc(t)}</b>`;
  const tile = (m, bodyHtml, letter, prov, kind = 'm') => `
      <details class="mon">
        <summary>${iconOf(kind, m.名前)}${prov ? '<span class="prov">暫定</span>' : ''}<span class="nm">${esc(m.名前)}</span>${letter ? `<span class="lt">${tier(letter)}</span>` : ''}</summary>
        <div class="body">${bodyHtml}</div>
      </details>`;
  const kv = (rows) => `<dl>${rows.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const diffTable = (m) => `<div class="tw"><table><thead><tr><th>難易度</th><th>Tier</th><th>試した回数(勇者)</th>${m.机上 ? '<th>受けられる</th>' : ''}</tr></thead><tbody>${DIFFS.map((k) => `<tr><td>${k}</td><td>${tier(m[k])}${m.難易度が暫定 && m.難易度が暫定[k] ? ' <small>暫定</small>' : ''}</td><td>${m.回数[k]}${m.勇者の回数 ? `(${m.勇者の回数[k]})` : ''}</td>${m.机上 ? `<td>${m.机上.受けられる[k]}発</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  const refList = (kind, list) => `<ul class="rl">${list.map((x) => `<li>${iconOf(kind, x.名前, 'sm')}<span><b>${esc(x.名前)}</b> ${esc(x.理由)}</span></li>`).join('')}</ul>`;
  const assistBody = (a) => kv([
    ['ひとこと', esc(a.理由)],
    a.強み ? ['強み', esc(a.強み)] : null,
    a.弱み ? ['弱み', esc(a.弱み)] : null,
    a.合うモンスター && a.合うモンスター.length ? ['合うモンスター', refList('m', a.合うモンスター)] : null,
  ]) + (a.回数 ? `<div class="tw"><table><thead><tr><th>難易度</th><th>Tier</th><th>試した回数</th></tr></thead><tbody>${DIFFS.map((k) => `<tr><td>${k}</td><td>${tier(a[k])}</td><td>${a.回数[k]}</td></tr>`).join('')}</tbody></table></div>` : '');
  const fullBody = (m) => kv([
    ['役', esc(m.役)],
    m.仮の総合 ? ['仮の総合', `${tier(m.仮の総合)} (5回未満のマスから出した仮)`] : null,
    ['ひとこと', esc(m.理由)],
    m.強み ? ['強み', esc(m.強み)] : null,
    m.弱み ? ['弱み', esc(m.弱み)] : null,
    m.動いた理由 ? ['動き', esc(m.動いた理由)] : null,
    m.おすすめアシカ && m.おすすめアシカ.length ? ['おすすめアシカ', refList('a', m.おすすめアシカ)] : null,
    m.相性のいい供モン && m.相性のいい供モン.length ? ['相性のいい供モン', refList('m', m.相性のいい供モン)] : null,
    m.机上 ? ['机上', `通常技1発 ${m.机上.通常技1発.toLocaleString('en-US')} / 20ターンの火力 ${(m.机上['20ターンの火力'] || 0).toLocaleString('en-US')}`] : null,
  ]) + diffTable(m);
  const diffBody = (m, k) => kv([
    ['役', esc(m.役)],
    ['この難易度', `${tier(m[k])}${m.難易度が暫定 && m.難易度が暫定[k] ? ' 暫定' : ''}(総合 ${esc(m.総合)})`],
    ['試した回数', `${m.回数[k]}回${m.勇者の回数 ? `(勇者モンにした回数 ${m.勇者の回数[k]})` : ''}`],
    m.机上 ? ['受けられる', `WAVE 1 の通常攻撃を ${m.机上.受けられる[k]} 発`] : null,
    ['ひとこと', esc(m.理由)],
  ]);
  const panels = (key, bodyOf, withLetter, tiers, src = mons, kind = 'm', unit = '体') => tiers.map((t) => {
    const list = src.filter((m) => m[key] === t);
    if (!list.length && t === '—') return '';
    return `
    <section class="panel tp-${tcls(t)}">
      <h3>${tier(t)}<span class="cnt">${list.length}${unit}${t === '保留' ? '(まだ決められない)' : t === '—' ? '(まだ試していない)' : t === '回数不足' ? '(どの難易度も5回未満。総合はまだ付けない)' : ''}</span></h3>
      <div class="grid">${list.length ? list.map((m) => tile(m, bodyOf(m), withLetter, key === '総合' && m.暫定, kind)).join('') : '<p class="empty">いません</p>'}
      </div>
    </section>`;
  }).join('');
  const diffSections = DIFFS.map((k) => `
  <details class="diff">
    <summary>${k} の Tier(重み ${d.決め方.重み[k]})</summary>
    ${panels(k, (m) => diffBody(m, k), null, DIFF_TIERS)}
  </details>`).join('');
  const comboRow = (c) => `
        <li class="cb ${c.評価 === 'よい' ? 'cg' : 'cx'}">
          <div class="pair">${iconOf('m', c.勇者)}<span class="x">×</span>${iconOf('m', c.供)}</div>
          <div class="ct"><b>勇者 ${esc(c.勇者)} × 供 ${esc(c.供)}</b> <span class="vd">${c.評価 === 'よい' ? '◎ よく合う' : '△ 合わない'}</span>${c.点 !== undefined ? `<small> ${esc(c.点)}点</small>` : ''}<small> ${c.確かめた ? '実戦で確かめた' : '机上・シミュレーターの見立て'}</small>
          <div>${esc(c.理由)}</div></div>
        </li>`;
  const comboGroup = (label, hit) => {
    const list = combos.filter((c) => c.評価 === hit);
    return `<details class="diff" ${hit === 'よい' ? 'open' : ''}><summary>${label}(${list.length}組)</summary>${list.length ? `<ul class="cbl">${list.map(comboRow).join('')}</ul>` : '<p class="empty">まだありません。</p>'}</details>`;
  };
  const soon = '<p class="empty">準備中です(研究所がデータを足すと出ます)。</p>';
  const assistSection = assists
    ? panels('総合', assistBody, null, OVERALL_TIERS, assists, 'a', '枚')
    : soon;
  const comboSection = combos ? comboGroup('よく合う組み合わせ', 'よい') + '\n    ' + comboGroup('合わない組み合わせ', 'わるい') : soon;
  const weights = DIFFS.map((k) => `${k} ${d.決め方.重み[k]}`).join('・');
  const c = d.数えた回;

  return `<title>モンスター Tier 表</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@500;800&display=swap">
<style>
/* 上から「総合 Tier(S〜保留のパネル)」→「難易度ごと」→「決め方」。アイコンを押すと、その子の詳細が開く(スクリプトなし) */
:root{--bg:#f3f5f8;--panel:#ffffff;--fg:#18202c;--muted:#5b6676;--line:#dde2ea;--accent:#2a56c6;--track:#e8ecf2;
--tS:#c0392b;--tA:#c76a00;--tB:#2f8a3e;--tC:#2a6fd0;--tD:#7a4fb8;--tH:#6b7685;
--bS:#fdecea;--bA:#fff2e0;--bB:#e8f6ea;--bC:#e8f0fc;--bD:#f1eafa;--bH:#eef0f3;
--font-head:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif;--font-body:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--accent:#7fa2ff;--track:#232c39;
--tS:#ff8a7a;--tA:#ffb35c;--tB:#6fd27f;--tC:#7fa2ff;--tD:#c3a0f5;--tH:#9aa6b6;
--bS:#33191b;--bA:#33260f;--bB:#16291a;--bC:#16233a;--bD:#251c36;--bH:#222a35;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#11161e;--panel:#19202b;--fg:#e8edf4;--muted:#9aa6b6;--line:#2a3442;--accent:#7fa2ff;--track:#232c39;
--tS:#ff8a7a;--tA:#ffb35c;--tB:#6fd27f;--tC:#7fa2ff;--tD:#c3a0f5;--tH:#9aa6b6;
--bS:#33191b;--bA:#33260f;--bB:#16291a;--bC:#16233a;--bD:#251c36;--bH:#222a35;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font-body);font-size:15px;line-height:1.6}
.wrap{max-width:68rem;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column;gap:22px}
h1,h2,h3{font-family:var(--font-head);margin:0}
h1{font-size:24px;font-weight:800;letter-spacing:.02em}
h2{font-size:18px;font-weight:800}
.lead{margin:4px 0 0;color:var(--muted);font-size:13px}
.note{font-size:12px;color:var(--muted);margin:0}
.panel{border:1px solid var(--line);border-left:6px solid var(--c);border-radius:12px;background:var(--bg2);padding:10px 12px 12px;margin-bottom:10px}
.tp-S{--c:var(--tS);--bg2:var(--bS)}.tp-A{--c:var(--tA);--bg2:var(--bA)}.tp-B{--c:var(--tB);--bg2:var(--bB)}
.tp-C{--c:var(--tC);--bg2:var(--bC)}.tp-D{--c:var(--tD);--bg2:var(--bD)}.tp-h{--c:var(--tH);--bg2:var(--bH)}
.panel h3{display:flex;align-items:center;gap:10px;font-size:15px;margin-bottom:8px}
.cnt{font-size:12px;font-weight:500;color:var(--muted);font-family:var(--font-body)}
.t{display:inline-block;min-width:1.9em;padding:0 8px;white-space:nowrap;border-radius:8px;text-align:center;font-family:var(--font-head);font-weight:800;color:#fff;line-height:1.5}
.t-S{background:var(--tS)}.t-A{background:var(--tA)}.t-B{background:var(--tB)}.t-C{background:var(--tC)}.t-D{background:var(--tD)}.t-h{background:var(--tH)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .t{color:#11161e}}
:root[data-theme="dark"] .t{color:#11161e}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;align-items:start}
.mon{min-width:0}
.mon[open]{grid-column:1/-1}
.mon>summary{list-style:none;cursor:pointer;width:72px;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;-webkit-tap-highlight-color:transparent}
.mon>summary::-webkit-details-marker{display:none}
.ic{position:relative;overflow:hidden;width:56px;height:56px;border-radius:12px;background-color:var(--panel);border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-weight:800;font-size:24px;color:var(--muted)}
.mon[open]>summary .ic{border-color:var(--c)}
.nm{font-size:11px;line-height:1.25;text-align:center;overflow-wrap:anywhere;max-width:72px}
.lt{margin-top:1px}.lt .t{min-width:1.6em;padding:0 5px;font-size:12px}
.prov{position:absolute;top:-4px;right:2px;font-size:9px;line-height:1.3;padding:0 4px;border-radius:6px;background:var(--panel);color:var(--muted);border:1px solid var(--line)}
.body{margin-top:8px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;min-width:0}
dl{margin:0 0 8px;display:grid;grid-template-columns:auto 1fr;gap:3px 12px}
dt{color:var(--muted);font-size:12px;white-space:nowrap}
dd{margin:0;min-width:0;overflow-wrap:anywhere}
.tw{overflow-x:auto}
table{border-collapse:collapse;font-size:12px;width:100%}
th,td{border:1px solid var(--line);padding:3px 6px;text-align:left;white-space:nowrap}
small{color:var(--muted)}
.diff{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:0 12px}
.diff>summary{cursor:pointer;padding:12px 0;font-family:var(--font-head);font-weight:800;list-style-position:inside}
.diff[open]>summary{color:var(--accent);border-bottom:1px solid var(--line);margin-bottom:12px}
.diff .panel:last-child{margin-bottom:12px}
.empty{margin:0;color:var(--muted);font-size:13px}
.how{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;font-size:13px}
.how p{margin:0}
.jump{display:flex;gap:8px;position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0;margin:-8px 0 0}
.jump a{flex:1;text-align:center;text-decoration:none;color:var(--accent);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 4px;font-family:var(--font-head);font-weight:800;font-size:13px}
html{scroll-behavior:smooth;scroll-padding-top:56px}
.ic.sm{width:36px;height:36px;border-radius:9px;border-width:1px;font-size:15px;flex:none}
.rl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.rl li{display:flex;gap:8px;align-items:center}
.cbl{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:8px}
.cb{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-left:5px solid var(--c);border-radius:10px;padding:8px 10px;background:var(--panel);font-size:13px;min-width:0}
.cg{--c:var(--tB)}.cx{--c:var(--tS)}
.pair{display:flex;align-items:center;gap:4px;flex:none}.pair .ic{width:44px;height:44px}.x{color:var(--muted);font-size:12px}
.ct{min-width:0;overflow-wrap:anywhere}.vd{font-weight:800}
.ic>i{position:absolute;inset:0;background-size:contain;background-position:center;background-repeat:no-repeat;transform-origin:center center}
${css}
</style>
<div class="wrap">
  <header>
    <h1>モンスター Tier 表</h1>
    <p class="lead">${esc(d.更新)} 更新 / 研究所:ハカセくん / 数えた回 ${c.合計}回(Hard ${c.Hard}・Expert ${c.Expert}・Master ${c.Master})・戦った ${d.戦った体数}/${d.全体数}体。アイコンを押すと詳細が開きます。</p>
  </header>

  <nav class="jump" aria-label="ページ内の移動"><a href="#monsters">モンスター</a><a href="#assists">アシカ</a><a href="#combos">組み合わせ</a></nav>

  <section id="monsters">
    <h2>モンスター 総合 Tier</h2>
    <p class="note" style="margin-bottom:10px">${weights} の重みで難易度ごとの点を合わせた順。「暫定」の印は、試した回数が少なく動くかもしれない子。</p>${panels('総合', fullBody, null, OVERALL_TIERS)}
  </section>

  <section id="monsters-diff">
    <h2>モンスターを難易度で見る</h2>
    <p class="note" style="margin-bottom:10px">難易度で敵の火力とライフが大きく違うので、難易度ごとにも付けています(押して開く)。</p>${diffSections}
  </section>

  <section id="assists">
    <h2>アシカ Tier(アシストカード)</h2>
    <p class="note" style="margin-bottom:10px">モンスターと同じ決め方の Tier。アイコンを押すと、難易度ごとの Tier・理由・合うモンスターが開きます。</p>${assistSection}
  </section>

  <section id="combos">
    <h2>勇者モン × 供モンの組み合わせ</h2>
    <p class="note" style="margin-bottom:10px">よく合う組み合わせと合わない組み合わせ。「実戦で確かめた」は、タクティクスプロで実際に戦って確かめたもの。</p>
    ${comboSection}
  </section>

  <section>
    <h2>決め方</h2>
    <div class="how">${d.決め方.文.map((s) => `<p>${esc(s)}</p>`).join('')}<p>${esc(d.決め方.暫定 || '')}</p></div>
  </section>
</div>
`;
}

function main() {
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const problems = validate(d);
  if (problems.length) {
    console.error('tier.json に問題があります(ページは作りません):\n' + problems.map((x) => '  - ' + x).join('\n'));
    process.exit(1);
  }
  if (process.argv.includes('--check')) { console.log(`tier.json OK(${d.モンスター.length}体)`); return; }
  const html = build(d);
  fs.writeFileSync(OUT, html);
  console.log(`作りました: ${path.relative(ROOT, OUT)}(${(html.length / 1024).toFixed(0)}KB・${d.モンスター.length}体)`);
}
if (require.main === module) main();
module.exports = { validate, build };
