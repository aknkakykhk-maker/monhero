// 味方モンスターの「Tier 表」のページを作る。社長が見るパネル式の1枚(アーティファクト用)。
//
// tier.json は手で書かない。monster-tier.md と同じ元データから tactics-tier.js(モンスター)・asika-tier.js(アシカ)が一緒に作る。
// 直したら、このコマンドで作り直す(出来たページは統括部長が Artifact で同じ URL へ出し直す):
//
//   node tools/playbot/tier-page.js [--out <出力先>]    既定: docs/playbot/dashboard/tier.html
//   node tools/playbot/tier-page.js --rebuild-icons     縮めた顔アイコンを作り直してからページを作る
//   node tools/playbot/tier-page.js --json <別の tier.json>   試し用(その JSON を読む。--out と合わせて使う)
//   node tools/playbot/tier-page.js --check             tier.json の形と、monster-tier.md・asika-tier.md(早見表・合うモンスター)・combo.md(よく合う・合わない)・party.md(おすすめパーティ)・tier.html との食い違いを確かめる(ページは作らない)
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
  // 根拠(2026-10-10 社長「表面的に出すだけじゃなくて…ちゃんと根拠があるように」)。全項目に同じ形で付く。無い項目は「根拠はまだ入っていません」と出す
  const SOURCES = ['実戦', 'シミュレーター', '机上', '実戦+シミュレーター'];
  const evidenceCheck = (e, at) => {
    if (e === undefined) return;
    const r = e && e.根拠;
    if (r === undefined) return;
    if (!r || typeof r !== 'object') { p.push(`${at}: 根拠 はオブジェクト`); return; }
    if (!SOURCES.includes(r.出どころ)) p.push(`${at}: 根拠.出どころ は ${SOURCES.join(' / ')}`);
    if (typeof r.回数 !== 'string') p.push(`${at}: 根拠.回数 は1文の文字`);
    if (r.数字 !== undefined && (!Array.isArray(r.数字) || r.数字.length > 6 || r.数字.some((x) => !x || !x.名前 || typeof x.値 !== 'string'))) p.push(`${at}: 根拠.数字 は [{名前,値,基準,差,ぶれ}] の6行まで(値・基準・差・ぶれは単位つきの文字)`);
    if (r.効いている機能 !== undefined && (!Array.isArray(r.効いている機能) || r.効いている機能.some((x) => typeof x !== 'string'))) p.push(`${at}: 根拠.効いている機能 は文字の配列`);
    if (typeof r.だから !== 'string' || !r.だから) p.push(`${at}: 根拠.だから が空です`);
    if (r.まだ分からない !== undefined && typeof r.まだ分からない !== 'string') p.push(`${at}: 根拠.まだ分からない は文字(無ければ "")`);
  };
  d.モンスター.forEach((m) => evidenceCheck(m, `モンスター「${m.名前}」`));
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
        evidenceCheck(a, at);
      }
    }
  }
  if (d.組み合わせ !== undefined) {
    if (!Array.isArray(d.組み合わせ)) p.push('組み合わせ は配列にする');
    else for (const c of d.組み合わせ) {
      const at = `組み合わせ「${c && c.勇者}×${c && c.供モン}」`;
      if (!c || !names.has(c.勇者) || !names.has(c.供モン)) p.push(`${at}: 勇者・供モン はモンスターの名前にする`);
      if (!c || !['良い', '合わない'].includes(c.良し悪し)) p.push(`${at}: 良し悪し は 良い / 合わない`);
      if (c && !c.理由) p.push(`${at}: 理由が空です`);
      if (c && typeof c.実戦で確認 !== 'boolean') p.push(`${at}: 実戦で確認 は true / false`);
      if (c && c.点 !== undefined && !Number.isFinite(c.点)) p.push(`${at}: 点 は数`);
      evidenceCheck(c, at);
    }
  }
  if (d.おすすめパーティ !== undefined) {
    if (!Array.isArray(d.おすすめパーティ)) p.push('おすすめパーティ は配列にする');
    else {
      const ranks = new Set();
      for (const t of d.おすすめパーティ) {
        const at = `おすすめパーティ「${t && t.難易度}${t && t.順位}位 ${t && t.勇者}」`;
        if (!t) { p.push('空のおすすめパーティがあります'); continue; }
        if (!DIFFS.includes(t.難易度)) p.push(`${at}: 難易度は ${DIFFS.join(' / ')}`);
        if (!Number.isInteger(t.順位) || t.順位 < 1) p.push(`${at}: 順位は1以上の整数`);
        else if (ranks.has(t.難易度 + t.順位)) p.push(`${at}: 同じ難易度で順位が重なっています`);
        ranks.add(t.難易度 + t.順位);
        if (!names.has(t.勇者)) p.push(`${at}: 勇者はモンスターの名前にする`);
        if (!Array.isArray(t.供モン) || !t.供モン.length || t.供モン.some((n) => !names.has(n))) p.push(`${at}: 供モンはモンスターの名前の配列にする`);
        if (!t.点 || !t.点.名前 || !Number.isFinite(t.点.値) || (t.点.基準との差 !== undefined && !Number.isFinite(t.点.基準との差))) p.push(`${at}: 点は { 名前, 値(数), 基準との差(数) }`);
        if (typeof t.確か !== 'boolean') p.push(`${at}: 確か は true / false`);
        if (t.暫定を含む !== undefined && (!Array.isArray(t.暫定を含む) || t.暫定を含む.some((n) => !names.has(n)))) p.push(`${at}: 暫定を含む はモンスターの名前の配列`);
        if (!t.理由) p.push(`${at}: 理由が空です`);
        if (t.アシカ !== undefined && (!t.アシカ || !Array.isArray(t.アシカ.優先) || (t.アシカ.使いどころ !== undefined && !Array.isArray(t.アシカ.使いどころ)))) p.push(`${at}: アシカ は { 優先:[名前], 使いどころ:[文] }`);
        if (t.強化 !== undefined && (!t.強化 || typeof t.強化 !== 'object')) p.push(`${at}: 強化 は { トレーニング, 固有技の強化, ごほうび } のような文字の組`);
        evidenceCheck(t, at);
        if (t.実戦で確認 != null && (!Number.isInteger(t.実戦で確認.回数) || !Number.isInteger(t.実戦で確認.クリア))) p.push(`${at}: 実戦で確認 は { 回数, クリア } か null`);
      }
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
  const parties = Array.isArray(d.おすすめパーティ) ? d.おすすめパーティ : [];
  const hasParties = Array.isArray(d.おすすめパーティ);
  const aNames = [...new Set([...(assists || []).map((a) => a.名前), ...mons.flatMap((m) => (m.おすすめアシカ || []).map((x) => x.名前)), ...parties.flatMap((t) => (t.アシカ && t.アシカ.優先) || [])])];
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
  const evidence = (e) => {
    const r = e && e.根拠;
    if (!r) return '<div class="ev none">根拠はまだ入っていません。</div>';
    const num = (v) => parseFloat(String(v == null ? '' : v).replace(/[±+−-]/g, (c) => (c === '−' || c === '-' ? '-' : '')));
    const rows = (r.数字 || []).map((x) => {
      const diff = Math.abs(num(x.差)), noise = Math.abs(num(x.ぶれ));
      const inNoise = Number.isFinite(diff) && Number.isFinite(noise) && x.差 !== undefined && x.ぶれ !== undefined && diff < noise;
      return `<tr${inNoise ? ' class="dim"' : ''}><td>${esc(x.名前)}</td><td>${esc(x.値)}</td><td>${esc(x.基準 || '')}</td><td>${esc(x.差 || '')}${inNoise ? ' <small>ぶれの中</small>' : ''}</td><td>${esc(x.ぶれ || '')}</td></tr>`;
    }).join('');
    return `<div class="ev">
      <div class="evh"><span class="src src-${{ 実戦: 'j', シミュレーター: 's', 机上: 'd', '実戦+シミュレーター': 'js' }[r.出どころ] || 'd'}">${esc(r.出どころ)}</span><span class="evn">${esc(r.回数)}</span></div>
      ${rows ? `<div class="tw"><table><thead><tr><th>数字</th><th>値</th><th>基準</th><th>差</th><th>ぶれ</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
      ${(r.効いている機能 || []).length ? `<div class="evf"><small>効いている機能</small> ${r.効いている機能.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
      <p class="evs"><b>だから</b> ${esc(r.だから)}</p>
      ${r.まだ分からない ? `<p class="evu"><b>まだ分からない</b> ${esc(r.まだ分からない)}</p>` : ''}
    </div>`;
  };
  const refAssists = (names) => `<ul class="rl">${names.map((n) => `<li>${iconOf('a', n, 'sm')}<span><b>${esc(n)}</b></span></li>`).join('')}</ul>`;
  const assistBody = (a) => evidence(a) + kv([
    a.仮の総合 ? ['仮の総合', `${tier(a.仮の総合)} (5回未満のマスから出した仮)`] : null,
    ['ひとこと', esc(a.理由)],
    a.強み ? ['強み', esc(a.強み)] : null,
    a.弱み ? ['弱み', esc(a.弱み)] : null,
    a.合うモンスター && a.合うモンスター.length ? ['合うモンスター', refList('m', a.合うモンスター)] : (a.合う子なし ? ['合うモンスター', esc(a.合う子なし)] : null),
  ]) + (a.回数 ? `<div class="tw"><table><thead><tr><th>難易度</th><th>Tier</th><th>試した回数</th></tr></thead><tbody>${DIFFS.map((k) => `<tr><td>${k}</td><td>${tier(a[k])}</td><td>${a.回数[k]}</td></tr>`).join('')}</tbody></table></div>` : '');
  const fullBody = (m) => evidence(m) + kv([
    ['役', esc(m.役)],
    m.仮の総合 ? ['仮の総合', `${tier(m.仮の総合)} (5回未満のマスから出した仮)`] : null,
    ['ひとこと', esc(m.理由)],
    m.強み ? ['強み', esc(m.強み)] : null,
    m.弱み ? ['弱み', esc(m.弱み)] : null,
    m.動いた理由 ? ['動き', esc(m.動いた理由)] : null,
    m.緊急回復 ? ['緊急回復', esc(m.緊急回復)] : null,
    m.おすすめアシカ && m.おすすめアシカ.length ? ['おすすめアシカ', refList('a', m.おすすめアシカ)] : null,
    m.相性のいい供モン && m.相性のいい供モン.length ? ['相性のいい供モン', refList('m', m.相性のいい供モン)] : null,
    m.机上 ? ['机上', `通常技1発 ${m.机上.通常技1発.toLocaleString('en-US')} / 20ターンの火力 ${(m.机上['20ターンの火力'] || 0).toLocaleString('en-US')}`] : null,
  ]) + diffTable(m);
  const diffBody = (m, k) => evidence(m) + kv([
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
        <li class="cb ${c.良し悪し === '良い' ? 'cg' : 'cx'}"><details class="cbd">
          <summary><div class="pair">${iconOf('m', c.勇者)}<span class="x">×</span>${iconOf('m', c.供モン)}</div>
          <div class="ct"><b>勇者 ${esc(c.勇者)} × 供モン ${esc(c.供モン)}</b> <span class="vd">${c.良し悪し === '良い' ? '◎ よく合う' : '△ 合わない'}</span>${c.点 !== undefined ? `<small> ${esc(c.点)}点</small>` : ''}<small> ${c.実戦で確認 ? '実戦で確かめた' : '机上・シミュレーターの見立て'}</small>
          <div>${esc(c.理由)}</div></div></summary>
          <div class="body">${evidence(c)}${kv([['勇者', esc(c.勇者)], ['供モン', esc(c.供モン)], ['ひとこと', esc(c.理由)]])}</div>
        </details></li>`;
  const comboGroup = (label, hit) => {
    const list = combos.filter((c) => c.良し悪し === hit);
    return `<details class="diff" ${hit === '良い' ? 'open' : ''}><summary>${label}(${list.length}組)</summary>${list.length ? `<ul class="cbl">${list.map(comboRow).join('')}</ul>` : '<p class="empty">まだありません。</p>'}</details>`;
  };
  const soon = '<p class="empty">準備中です(研究所がデータを足すと出ます)。</p>';
  const assistSection = assists
    ? panels('総合', assistBody, null, OVERALL_TIERS, assists, 'a', '枚')
    : soon;
  const comboSection = combos ? comboGroup('よく合う組み合わせ', '良い') + '\n    ' + comboGroup('合わない組み合わせ', '合わない') : soon;
  const partyCard = (t) => {
    const members = [t.勇者, ...t.供モン];
    const prov = new Set(t.暫定を含む || []);
    const faces = members.map((n, i) => `<span class="pm">${iconOf('m', n, i === 0 ? 'hero' : '')}<span class="nm2">${esc(n)}${prov.has(n) ? '<small>暫定</small>' : ''}</span></span>`).join('');
    const diff = t.点.基準との差;
    const sign = (v) => (v >= 0 ? '+' : '−') + Math.abs(v);
    const assist = t.アシカ ? kv([
      ['優先', refAssists(t.アシカ.優先)],
      t.アシカ.使いどころ && t.アシカ.使いどころ.length ? ['使いどころ', `<ul class="bl">${t.アシカ.使いどころ.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`] : null,
    ]) : '';
    const grow = t.強化 ? kv(Object.entries(t.強化).map(([k, v]) => [k, esc(v)])) : '';
    const real = t.実戦で確認 ? `実戦 ${t.実戦で確認.回数}回(クリア ${t.実戦で確認.クリア})` : '実戦ではまだ確かめていない';
    return `
      <details class="party">
        <summary><span class="rk">${esc(t.順位)}位</span><span class="faces">${faces}</span></summary>
        <div class="pinfo"><b>${esc(t.点.名前)} ${esc(t.点.値)}</b>${diff !== undefined ? `<small> 基準との差 ${esc(sign(diff))}</small>` : ''}<small> ${t.確か ? '測り直しても残った' : 'まだぶれ以内'}</small><small> ${esc(real)}</small></div>
        <div class="body">${evidence(t)}${kv([['噛み合う理由', esc(t.理由)]])}${assist ? `<h4>アシカの入れ方</h4>${assist}` : ''}${grow ? `<h4>強化の順番</h4>${grow}` : ''}</div>
      </details>`;
  };
  const partySection = hasParties
    ? DIFFS.map((k) => {
        const list = parties.filter((t) => t.難易度 === k).sort((a, b) => a.順位 - b.順位);
        return `<details class="diff" ${k === 'Expert' ? 'open' : ''}><summary>${k} のおすすめパーティ(${list.length}組)</summary>${list.length ? `<div class="pl">${list.map(partyCard).join('')}</div>` : '<p class="empty">まだありません。</p>'}</details>`;
      }).join('\n    ')
    : soon;
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
.jump a{min-width:0}
.party{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:10px;min-width:0}
.party>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px;-webkit-tap-highlight-color:transparent}
.party>summary::-webkit-details-marker{display:none}
.rk{font-family:var(--font-head);font-weight:800;color:var(--accent);flex:none;min-width:2.2em}
.faces{display:flex;gap:6px;min-width:0;flex:1;justify-content:space-between}
.pm{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;flex:1}
.pm .ic{width:100%;max-width:56px;height:auto;aspect-ratio:1}.pm .ic.hero{border-color:var(--accent)}
.nm2{font-size:10px;line-height:1.25;text-align:center;overflow-wrap:anywhere;display:flex;flex-direction:column;align-items:center}
.pinfo{padding:0 12px 8px;font-size:13px;display:flex;flex-wrap:wrap;gap:2px 10px;align-items:baseline}
.party .body{margin:0 10px 10px}
.party h4{margin:8px 0 4px;font-size:13px;font-family:var(--font-head)}
.bl{margin:0;padding-left:1.2em}
.pl{margin-bottom:12px}
.ev{border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:8px 10px;margin-bottom:10px;font-size:12px}
.ev.none{color:var(--muted)}
.evh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.src{font-family:var(--font-head);font-weight:800;font-size:11px;padding:1px 8px;border-radius:8px;color:#fff;white-space:nowrap}
.src-j{background:var(--tB)}.src-s{background:var(--tC)}.src-d{background:var(--tH)}.src-js{background:linear-gradient(90deg,var(--tB),var(--tC))}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .src{color:#11161e}}
:root[data-theme="dark"] .src{color:#11161e}
.evn{color:var(--muted);min-width:0;overflow-wrap:anywhere}
.ev th,.ev td{white-space:normal;overflow-wrap:anywhere;padding:3px 4px}
.ev .dim td{color:var(--muted);opacity:.75}
.evf{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}
.chip{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid var(--line);background:var(--panel)}
.ev p{margin:4px 0}.evu{color:var(--muted)}
.cb{padding:0;display:block}
.cbd>summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:center;padding:8px 10px;-webkit-tap-highlight-color:transparent}
.cbd>summary::-webkit-details-marker{display:none}
.cbd .body{margin:0 10px 10px}
.ic>i{position:absolute;inset:0;background-size:contain;background-position:center;background-repeat:no-repeat;transform-origin:center center}
${css}
</style>
<div class="wrap">
  <header>
    <h1>モンスター Tier 表</h1>
    <p class="lead">${esc(d.更新)} 更新 / 研究所:ハカセくん / 数えた回 ${c.合計}回(Hard ${c.Hard}・Expert ${c.Expert}・Master ${c.Master})・戦った ${d.戦った体数}/${d.全体数}体。アイコンを押すと詳細が開きます。</p>
  </header>

  <nav class="jump" aria-label="ページ内の移動"><a href="#monsters">モンスター</a><a href="#assists">アシカ</a><a href="#combos">組み合わせ</a><a href="#party">パーティ</a></nav>

  <section id="monsters">
    <h2>モンスター 総合 Tier</h2>
    <p class="note" style="margin-bottom:10px">${weights} の重みで難易度ごとの点を合わせた順。「暫定」の印は、試した回数が少なく動くかもしれない子。モンスターの Tier はブラウザの実戦の記録から(ボットが緊急回復を使うようになったのは 2026-10-10 からで、それより前の回は使っていません)。</p>${panels('総合', fullBody, null, OVERALL_TIERS)}
  </section>

  <section id="monsters-diff">
    <h2>モンスターを難易度で見る</h2>
    <p class="note" style="margin-bottom:10px">難易度で敵の火力とライフが大きく違うので、難易度ごとにも付けています(押して開く)。</p>${diffSections}
  </section>

  <section id="assists">
    <h2>アシカ Tier(アシストカード)</h2>
    <p class="note" style="margin-bottom:10px">モンスターと同じ決め方の Tier。アイコンを押すと、難易度ごとの Tier・理由・合うモンスターが開きます。</p><p class="note" style="margin-bottom:10px">緊急回復は、ゲームの AUTO と同じ条件(出せるカードが無くガッツさえあれば出せるとき)と全滅の手前で使った数字です。回数の上限が無いので、ガッツの少ない子(モノリスなど)ほど押す回数が多く伸びます。手で遊んで緊急回復を押さないと、順位が変わる子がいます(各モンスターの「緊急回復」の行)。</p>${assistSection}
  </section>

  <section id="combos">
    <h2>勇者モン × 供モンの組み合わせ</h2>
    <p class="note" style="margin-bottom:10px">よく合う組み合わせと合わない組み合わせ。「実戦で確かめた」は、タクティクスプロで実際に戦って確かめたもの。</p><p class="note" style="margin-bottom:10px">緊急回復は、ゲームの AUTO と同じ条件(出せるカードが無くガッツさえあれば出せるとき)と全滅の手前で使った数字です。回数の上限が無いので、ガッツの少ない子(モノリスなど)ほど押す回数が多く伸びます。手で遊んで緊急回復を押さないと、順位が変わる子がいます(各モンスターの「緊急回復」の行)。</p>
    ${comboSection}
  </section>

  <section id="party">
    <h2>おすすめパーティ(勇者モン+供モン3体)</h2>
    <p class="note" style="margin-bottom:10px">難易度ごとの上位の4体パーティ。押すと、噛み合う理由・アシカの入れ方・強化の順番が開きます。左端が勇者モンです。</p><p class="note" style="margin-bottom:10px">緊急回復は、ゲームの AUTO と同じ条件(出せるカードが無くガッツさえあれば出せるとき)と全滅の手前で使った数字です。回数の上限が無いので、ガッツの少ない子(モノリスなど)ほど押す回数が多く伸びます。手で遊んで緊急回復を押さないと、順位が変わる子がいます(各モンスターの「緊急回復」の行)。</p>
    ${partySection}
  </section>

  <section>
    <h2>決め方</h2>
    <div class="how">${d.決め方.文.map((s) => `<p>${esc(s)}</p>`).join('')}<p>${esc(d.決め方.暫定 || '')}</p></div>
  </section>
</div>
`;
}

// ---------- md と tier.json と tier.html の食い違いを止める(2026-10-10 改善部 W2) ----------
// 3つは同じ元データから道具が作る(monster-tier.md と tier.json の「モンスター」は tactics-tier.js、
// asika-tier.md と「アシカ」は asika-tier.js、tier.html はこのファイル)。手で片方だけ直すと、ここで止まる。
const TIER_DIR = path.join(ROOT, 'docs', 'playbot', 'reports', 'tier');
const jsonHash = (text) => require('crypto').createHash('sha1').update(text).digest('hex').slice(0, 12);
const HASH_MARK = (h) => `<!-- tier.json ${h} -->`;
// md の「早見表」の行 → { 名前: [総合, Hard, Expert, Master] }
function quickTable(md) {
  const sec = (md.split(/^## 早見表\s*$/m)[1] || '').split(/^## /m)[0];
  const rows = {};
  for (const line of sec.split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length !== 5 || c[0] === 'モンスター' || c[0] === 'アシカ' || /^-+$/.test(c[1])) continue;
    rows[c[0]] = c.slice(1);
  }
  return rows;
}
function crossCheck(d, jsonText) {
  const p = [];
  const read = (f) => { try { return fs.readFileSync(path.join(TIER_DIR, f), 'utf8'); } catch (e) { return null; } };
  const mmd = read('monster-tier.md');
  if (mmd == null) p.push('monster-tier.md がありません');
  else {
    const up = (mmd.match(/^更新: (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/m) || [])[1];
    if (up !== d.更新) p.push(`更新の時刻が違う(monster-tier.md ${up} / tier.json ${d.更新})。tactics-tier.js --md で両方を作り直す`);
    const q = quickTable(mmd);
    for (const m of d.モンスター) {
      const r = q[m.名前];
      if (!r) { p.push(`${m.名前}: monster-tier.md の早見表に無い`); continue; }
      const mdOverall = r[0] === '不足' ? '回数不足' : r[0];
      if (mdOverall !== m.総合) p.push(`${m.名前}: 総合が違う(md ${r[0]} / json ${m.総合})`);
      DIFFS.forEach((k, i) => {
        const cell = r[i + 1]; const star = cell.endsWith('*');
        if (cell.replace(/\*$/, '') !== m[k]) p.push(`${m.名前}: ${k} が違う(md ${cell} / json ${m[k]})`);
        else if (star !== !!(m.難易度が暫定 && m.難易度が暫定[k])) p.push(`${m.名前}: ${k} の暫定(*)が違う`);
      });
    }
    const overallLine = (mmd.split(/^## 総合 Tier\s*$/m)[1] || '').split(/^## /m)[0];
    for (const m of d.モンスター) {
      if (!['S', 'A', 'B', 'C', 'D'].includes(m.総合)) continue;
      const mdProv = new RegExp(`(^|[\\s・])${m.名前}\\(暫定\\)`, 'm').test(overallLine);
      if (mdProv !== !!m.暫定) p.push(`${m.名前}: 総合の「暫定」が違う(md ${mdProv ? 'あり' : 'なし'} / json ${m.暫定 ? 'あり' : 'なし'})`);
    }
    for (const t of [...(d.決め方.文 || []), d.決め方.暫定].filter(Boolean)) {
      if (!mmd.includes(t)) p.push(`決め方の文が monster-tier.md と違う: 「${t.slice(0, 30)}…」`);
    }
  }
  if (Array.isArray(d.アシカ) && d.アシカ.length) {
    const amd = read('asika-tier.md');
    if (amd == null) p.push('asika-tier.md がありません');
    else {
      const q = quickTable(amd);
      for (const c of d.アシカ) {
        const r = q[c.名前];
        if (!r) { p.push(`${c.名前}: asika-tier.md の早見表に無い`); continue; }
        if (r[0].replace(/\*$/, '') !== c.総合 || r[0].endsWith('*') !== !!c.暫定) p.push(`${c.名前}: 総合が違う(md ${r[0]} / json ${c.総合}${c.暫定 ? '*' : ''})`);
        DIFFS.forEach((k, i) => { if (r[i + 1] !== c[k]) p.push(`${c.名前}: ${k} が違う(md ${r[i + 1]} / json ${c[k]})`); });
      }
    }
  }
  // アシカの「合うモンスター」(asika-tier.md の「アシカごとの合うモンスター」の節)
  if (Array.isArray(d.アシカ) && d.アシカ.length) {
    const amd = read('asika-tier.md') || '';
    const sec = (amd.split(/^## アシカごとの合うモンスター\s*$/m)[1] || '').split(/^## /m)[0];
    const lines = Object.fromEntries(sec.split('\n').map((l) => l.match(/^- \*\*(.+?)\*\*: (.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    for (const c of d.アシカ) {
      const line = lines[c.名前];
      const names = (c.合うモンスター || []).map((x) => (typeof x === 'string' ? x : x.名前));
      if (line == null) { if (names.length || c.合う子なし) p.push(`${c.名前}: asika-tier.md の「合うモンスター」に無い`); continue; }
      if (c.合う子なし ? line !== c.合う子なし : names.join('・') !== line.split('・').map((t) => t.replace(/\(.*\)$/, '')).join('・')) {
        p.push(`${c.名前}: 合うモンスターが違う(md ${line.slice(0, 40)} / json ${c.合う子なし || names.join('・')})`);
      }
    }
  }
  // 組み合わせ(combo.md の「よく合う」「合わない」の表。どちらも測り直しの数字)
  if (Array.isArray(d.組み合わせ) && d.組み合わせ.length) {
    const cmd = read('combo.md');
    if (cmd == null) p.push('combo.md がありません');
    else {
      const table = (head) => {
        const sec = (cmd.split(new RegExp(`^## ${head}.*$`, 'm'))[1] || '').split(/^##+ /m)[0];
        const rows = {};
        for (const line of sec.split('\n')) {
          const c = line.split('|').slice(1, -1).map((x) => x.trim());
          if (c.length >= 3 && c[0] !== '勇者モン' && !/^-+$/.test(c[0])) rows[`${c[0]}×${c[1]}`] = Number(c[2]);
        }
        return rows;
      };
      const good = table('よく合う組み合わせ');
      const bad = table('合わない組み合わせ');
      for (const c of d.組み合わせ) {
        const key = `${c.勇者}×${c.供モン}`;
        const t = c.良し悪し === '良い' ? good : bad;
        if (!(key in t)) p.push(`組み合わせ ${key}(${c.良し悪し}): combo.md の表に無い`);
        else if (Math.abs(t[key] - c.点) > 0.005) p.push(`組み合わせ ${key}: 点が違う(md ${t[key]} / json ${c.点})`);
      }
    }
  }
  // おすすめパーティ(party.md の難易度ごとの表 | 順位 | 勇者 | 供モン | 点 | 確か |。供モンは「・」でつなぐ)
  if (Array.isArray(d.おすすめパーティ) && d.おすすめパーティ.length) {
    const pmd = read('party.md');
    if (pmd == null) p.push('party.md がありません');
    else {
      for (const k of DIFFS) {
        const sec = (pmd.split(new RegExp(`^## ${k}\\b.*$`, 'm'))[1] || '').split(/^## /m)[0];
        const rows = {};
        for (const line of sec.split('\n')) {
          const c = line.split('|').slice(1, -1).map((x) => x.trim());
          if (c.length >= 5 && /^\d+$/.test(c[0])) rows[c[0]] = c;
        }
        for (const x of d.おすすめパーティ.filter((y) => y.難易度 === k)) {
          const r = rows[String(x.順位)];
          const label = `パーティ ${k} ${x.順位}位`;
          if (!r) { p.push(`${label}: party.md の「## ${k}」の表に無い`); continue; }
          if (r[1] !== x.勇者 || r[2] !== (x.供モン || []).join('・')) p.push(`${label}: 顔ぶれが違う(md ${r[1]}+${r[2]} / json ${x.勇者}+${(x.供モン || []).join('・')})`);
          if ((r[4] === '確か') !== !!x.確か) p.push(`${label}: 「確か」が違う(md ${r[4]} / json ${x.確か})`);
        }
      }
    }
  }
  if (fs.existsSync(OUT) && OUT === path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier.html')) {
    const html = fs.readFileSync(OUT, 'utf8');
    if (!html.includes(HASH_MARK(jsonHash(jsonText)))) p.push('tier.html が今の tier.json から作られていない。node tools/playbot/tier-page.js で作り直す');
  }
  return p;
}

// tier.json からページを書く(tactics-tier.js からも呼ぶ)。形がおかしいときは書かない
function writePage() {
  const text = fs.readFileSync(JSON_PATH, 'utf8');
  const d = JSON.parse(text);
  const problems = validate(d);
  if (problems.length) return { ok: false, problems };
  const html = build(d) + HASH_MARK(jsonHash(text)) + '\n';
  fs.writeFileSync(OUT, html);
  return { ok: true, out: path.relative(ROOT, OUT), kb: html.length / 1024, n: d.モンスター.length };
}

function main() {
  const text = fs.readFileSync(JSON_PATH, 'utf8');
  const d = JSON.parse(text);
  const problems = validate(d);
  if (problems.length) {
    console.error('tier.json に問題があります(ページは作りません):\n' + problems.map((x) => '  - ' + x).join('\n'));
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    const diffs = jsonArg > 0 ? [] : crossCheck(d, text);
    if (diffs.length) {
      console.error('md・tier.json・tier.html が食い違っています(手で片方だけ直さず、道具で作り直す):\n' + diffs.map((x) => '  - ' + x).join('\n'));
      process.exit(1);
    }
    console.log(`tier.json OK(${d.モンスター.length}体・md と tier.html とも一致)`);
    return;
  }
  const r = writePage();
  console.log(`作りました: ${r.out}(${r.kb.toFixed(0)}KB・${r.n}体)`);
}
if (require.main === module) main();
module.exports = { validate, build, writePage, crossCheck };
