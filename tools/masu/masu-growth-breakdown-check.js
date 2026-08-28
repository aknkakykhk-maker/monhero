// マスモン詳細の「育成の内訳」表示を実ブラウザで確かめる。
//
//   node tools/masu/masu-growth-breakdown-check.js
//
// 見るのは次のとおり。
//   ① ステータスは1項目1行で、現在値がいちばん目立つ
//   ② 基礎UP(超越)が0ならピンクのバッジを出さない／通常強化が0なら緑のバッジを出さない
//   ③ タップで内訳が開き、元 ＋ 基礎UP ＋ 強化 ＝ 現在 が数字として必ず一致する
//   ④ 間合い適性も同じで、元の適性＋基礎UP段階＋強化段階＝現在の適性が分かる
//   ⑤ 桁が大きくなっても、現在値が全部読めて画面から横へはみ出さない
//   ⑥ 内訳を開いても、全画面の不透明なレイヤーが二重にならない
//   ⑦ 個体データを持たないベースモンの詳細には、存在しない内訳・バッジを出さない
//
// 数値は仕込んだ保存データから本体の既存計算(mergeMasuIntoMon)が出したものを読むだけで、
// 検査側で計算式を持たない。桁あふれの確認のため、わざと大きな値の個体も入れてある。
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const PORT = 8983;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 本物と同じ見た目で測るためのCSS。このサンドボックスは外部CDN(Tailwind)へ出られないので、
// 同梱のtailwindcssで game-system.jsx から実際に使っているクラスだけを組み立てて流し込む。
// これをやらないと flex も w-full も効かず、「はみ出していない」の測定が意味を持たない
const buildTailwindCss = () => {
  const bin = path.join(root, 'tools', 'node_modules', '.bin', 'tailwindcss');
  if (!fs.existsSync(bin)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-tw-'));
  const configPath = path.join(dir, 'tailwind.config.js');
  const inputPath = path.join(dir, 'in.css');
  const outputPath = path.join(dir, 'out.css');
  fs.writeFileSync(configPath, `module.exports={content:[${JSON.stringify(path.join(root, 'monster-hero/src/game-system.jsx'))}],theme:{extend:{}},plugins:[]};\n`);
  fs.writeFileSync(inputPath, '@tailwind base;@tailwind components;@tailwind utilities;\n');
  execFileSync(bin, ['-c', configPath, '-i', inputPath, '-o', outputPath, '--minify'], { stdio:'ignore', timeout: 300000 });
  return fs.readFileSync(outputPath, 'utf8');
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const toNumber = (text) => Number(String(text || '').replace(/[^\d-]/g, '')) || 0;

// 仕込む個体。育て方の組み合わせを変えて、バッジの出し分けと桁あふれの両方を見る
const MASU_FIXTURES = [
  // 基礎UP・通常強化の両方あり(画像と同じ形)
  { id:'gb-both', baseId:'Mocchi', name:'内訳検証ふつう',
    statPoints:{ hp:640, atk:30, def:180, guts:0 }, transcendStatPoints:{ hp:10, atk:0, def:0, guts:0 },
    distAptBoosts:[0,0,6,0], transcendAptBoosts:[0,0,1,0] },
  // どちらも無し(バッジが1つも出ないこと)
  { id:'gb-none', baseId:'Suezo', name:'内訳検証まっさら',
    statPoints:{ hp:0, atk:0, def:0, guts:0 }, transcendStatPoints:{ hp:0, atk:0, def:0, guts:0 },
    distAptBoosts:[0,0,0,0], transcendAptBoosts:[0,0,0,0] },
  // 桁が大きい個体(はみ出さないこと)
  { id:'gb-huge', baseId:'Golem', name:'内訳検証おおきい数字のとてもながい個体名',
    statPoints:{ hp:12560000, atk:1256001, def:125601, guts:12561 },
    transcendStatPoints:{ hp:1256000, atk:125600, def:12560, guts:1256 },
    distAptBoosts:[7,0,0,0], transcendAptBoosts:[1,0,0,0] },
];

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    const tailwindCss = buildTailwindCss();
    check('本物と同じCSSを用意できる', !!tailwindCss && tailwindCss.length > 10000, `${tailwindCss ? Math.round(tailwindCss.length / 1024) : 0}KB`);
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    // いちばん狭い想定として iPhone SE 相当(375)でも見る
    for (const width of [390, 375]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route('**cdn.tailwindcss.com**', (r) => r.abort());
      await page.addInitScript((fixtures) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー');
        put('mh_breeder_icon', '🐣');
        put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true);
        put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua');
        put('mh_assistant_unlock_seen_v1', true);
        put('mh_inherited_unique_level_compensation_v1', true);
        put('mh_inherited_unique_level_compensation_pending_v1', false);
        put('mh_masu_mons', fixtures.map((m, i) => ({ ...m, bondXp: 500000, createdAt: i + 1 })));
      }, MASU_FIXTURES);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      if (tailwindCss) await page.addStyleTag({ content: tailwindCss });

      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 6; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(250);
      }

      // HOME → M/B管理 → モンスター一覧 → マスモン
      await page.getByRole('button', { name: 'M/B管理' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: /モンスター/ }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'マスモン' }).first().dispatchEvent('click');
      await page.getByText('内訳検証ふつう').first().waitFor({ timeout: 20000 });

      const openDetail = async (name) => {
        await page.getByText(name, { exact: false }).first().dispatchEvent('click');
        await page.locator('[data-growth-stat-list]').waitFor({ timeout: 20000 });
      };
      const noSideScroll = async (label) => {
        const size = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
        check(`${label}が横にはみ出さない(${width}px)`, size.s <= size.c + 1, `${size.s} / ${size.c}`);
      };
      // 開いている要素が画面幅からはみ出していないか(バッジの枠外飛び出しも拾う)
      const noElementOverflow = async (label) => {
        // 測るのは今回の表示が持つ要素だけ。モンスターの立ち絵のように、
        // わざと枠より大きく描いて親で切り抜いている装飾まで測ると誤検出になる
        const worst = await page.evaluate(() => {
          const targets = document.querySelectorAll(
            '[data-growth-stat-row], [data-growth-stat-row] *, [data-growth-badge],'
            + '[data-growth-stat-detail], [data-growth-stat-detail] *,'
            + '[data-growth-apt-cell], [data-growth-apt-cell] *,'
            + '[data-growth-apt-detail], [data-growth-apt-detail] *');
          let over = 0, tag = '';
          for (const el of targets) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            const diff = Math.max(r.right - document.documentElement.clientWidth, -r.left);
            if (diff > over) { over = diff; tag = (el.getAttribute('data-growth-stat-row') || el.getAttribute('data-growth-badge') || el.className || el.tagName).toString().slice(0, 40); }
          }
          return { over: Math.round(over), tag, count: targets.length };
        });
        check(`${label}の測定対象が見つかる(${width}px)`, worst.count > 0, `${worst.count}要素`);
        check(`${label}のどの要素も画面外へ出ない(${width}px)`, worst.over <= 1, `最大 ${worst.over}px はみ出し (${worst.tag})`);
      };

      // --- ① ② 通常表示 ---
      await openDetail('内訳検証ふつう');
      const rows = page.locator('[data-growth-stat-row]');
      check(`ステータスは1項目1行で4行(${width}px)`, await rows.count() === 4, `${await rows.count()}行`);
      const hpRow = page.locator('[data-growth-stat-row="hp"]');
      check(`基礎UPがある項目にピンクのバッジを出す(${width}px)`, await hpRow.locator('[data-growth-badge="base"]').count() === 1);
      check(`通常強化がある項目に緑のバッジを出す(${width}px)`, await hpRow.locator('[data-growth-badge="enhance"]').count() === 1);
      const gutsRow = page.locator('[data-growth-stat-row="guts"]');
      check(`基礎UP0・強化0の項目にはバッジを出さない(${width}px)`,
        await gutsRow.locator('[data-growth-badge]').count() === 0);
      const atkRow = page.locator('[data-growth-stat-row="atk"]');
      check(`基礎UPだけ0ならピンクのバッジを出さない(${width}px)`,
        await atkRow.locator('[data-growth-badge="base"]').count() === 0
        && await atkRow.locator('[data-growth-badge="enhance"]').count() === 1);
      // 数字がバラバラの位置に散らないこと。値の欄は4項目で同じ幅なので、右端がそろう
      const valueRights = async () => page.evaluate(() => [...document.querySelectorAll('[data-growth-stat-row] b')]
        .map(el => Math.round(el.getBoundingClientRect().right)));
      const rights = await valueRights();
      check(`4項目の現在値が縦一列にそろう(${width}px)`, rights.length === 4 && new Set(rights).size === 1, JSON.stringify(rights));
      // バッジが1つの行と2つの行で高さが変わらない(行の高さがそろう)
      const rowHeights = await page.evaluate(() => [...document.querySelectorAll('[data-growth-stat-row]')]
        .map(el => Math.round(el.getBoundingClientRect().height)));
      check(`ふつうの桁ならバッジが1行に収まり行の高さがそろう(${width}px)`,
        rowHeights.length === 4 && new Set(rowHeights).size === 1, JSON.stringify(rowHeights));
      await noSideScroll('マスモン詳細');
      await noElementOverflow('マスモン詳細');

      // --- ③ 内訳と最終値が一致 ---
      check(`最初は内訳が閉じている(${width}px)`, await page.locator('[data-growth-stat-detail]').count() === 0);
      for (const key of ['hp', 'atk', 'def', 'guts']) {
        const row = page.locator(`[data-growth-stat-row="${key}"]`);
        const current = toNumber(await row.locator('b').first().textContent());
        await row.dispatchEvent('click');
        await page.locator(`[data-growth-stat-detail="${key}"]`).waitFor({ timeout: 10000 });
        const values = await page.locator(`[data-growth-stat-detail="${key}"] b`).allTextContents();
        const [origin, baseUp, enhance, result] = values.map(toNumber);
        check(`${key}の内訳が現在値と一致する(${width}px)`,
          values.length === 4 && origin + baseUp + enhance === result && result === current,
          `${origin} + ${baseUp} + ${enhance} = ${result} / 行の現在値 ${current}`);
        check(`${key}の内訳は1つだけ開く(${width}px)`, await page.locator('[data-growth-stat-detail]').count() === 1);
        await noSideScroll(`${key}の内訳`);
        await noElementOverflow(`${key}の内訳`);
      }
      // 同じ行をもう一度押すと閉じる
      await page.locator('[data-growth-stat-row="guts"]').dispatchEvent('click');
      await page.waitForTimeout(150);
      check(`もう一度押すと内訳を閉じられる(${width}px)`, await page.locator('[data-growth-stat-detail]').count() === 0);

      // --- ④ 間合い適性 ---
      const aptCells = page.locator('[data-growth-apt-cell]');
      check(`間合い適性は4距離ともタップできる(${width}px)`, await aptCells.count() === 4, `${await aptCells.count()}距離`);
      check(`基礎UP・強化がある距離にバッジを出す(${width}px)`,
        await page.locator('[data-growth-apt-cell="2"] [data-growth-badge="base"]').count() === 1
        && await page.locator('[data-growth-apt-cell="2"] [data-growth-badge="enhance"]').count() === 1);
      check(`育てていない距離にはバッジを出さない(${width}px)`,
        await page.locator('[data-growth-apt-cell="0"] [data-growth-badge]').count() === 0);
      await page.locator('[data-growth-apt-cell="2"]').dispatchEvent('click');
      await page.locator('[data-growth-apt-detail="2"]').waitFor({ timeout: 10000 });
      const aptTexts = await page.locator('[data-growth-apt-detail="2"] b').allTextContents();
      check(`間合い適性の内訳に元・基礎UP・強化・現在が出る(${width}px)`, aptTexts.length === 4, aptTexts.join(' / '));
      const aptDetailText = (await page.locator('[data-growth-apt-detail="2"]').textContent()).replace(/\s+/g, ' ');
      const cellGrade = (await page.locator('[data-growth-apt-cell="2"] span').nth(1).textContent()).trim();
      check(`内訳の「現在の適性」がカードの表示と一致する(${width}px)`,
        String(aptTexts[3] || '').startsWith(cellGrade), `内訳 ${aptTexts[3]} / カード ${cellGrade}`);
      check(`適性ランクの段階を出す(${width}px)`, aptDetailText.includes('適性ランクの段階'));
      check(`間合い適性の内訳も1つだけ開く(${width}px)`, await page.locator('[data-growth-apt-detail]').count() === 1);
      // ステータスと間合い適性は別々に開ける(片方を開いてももう片方が閉じない)
      await page.locator('[data-growth-stat-row="hp"]').dispatchEvent('click');
      await page.locator('[data-growth-stat-detail="hp"]').waitFor({ timeout: 10000 });
      check(`ステータスと間合い適性の内訳を同時に開ける(${width}px)`,
        await page.locator('[data-growth-stat-detail]').count() === 1
        && await page.locator('[data-growth-apt-detail]').count() === 1);
      await page.locator('[data-growth-stat-row="hp"]').dispatchEvent('click');
      await page.waitForTimeout(150);
      await noSideScroll('間合い適性の内訳');
      await noElementOverflow('間合い適性の内訳');

      // --- ⑦ 下部固定の「強化 / トレーニング / 染色」と重ならない ---
      // 内訳を2つ開いた状態のまま、いちばん下までスクロールして最後の中身が読めることを見る
      await page.locator('[data-growth-stat-row="hp"]').dispatchEvent('click');
      await page.locator('[data-growth-stat-detail="hp"]').waitFor({ timeout: 10000 });
      const scrollState = await page.evaluate(() => {
        const box = document.querySelector('[data-growth-stat-list]')?.closest('.mh-scroll');
        if (!box) return null;
        box.scrollTop = box.scrollHeight;
        const last = box.lastElementChild?.getBoundingClientRect();
        const footer = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('強化'))?.closest('div');
        return {
          scrollable: box.scrollHeight > box.clientHeight + 1,
          reachedEnd: Math.abs(box.scrollHeight - box.clientHeight - box.scrollTop) <= 2,
          lastBottom: last ? Math.round(last.bottom) : null,
          boxBottom: Math.round(box.getBoundingClientRect().bottom),
          footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
        };
      });
      check(`内訳を開いてもスクロールできる(${width}px)`, !!scrollState && scrollState.scrollable && scrollState.reachedEnd, JSON.stringify(scrollState));
      check(`いちばん下まで送ると最後の中身が枠の中に収まる(${width}px)`,
        !!scrollState && scrollState.lastBottom !== null && scrollState.lastBottom <= scrollState.boxBottom + 1,
        `最後の下端 ${scrollState?.lastBottom} / 枠の下端 ${scrollState?.boxBottom}`);
      await page.locator('[data-growth-stat-row="hp"]').dispatchEvent('click');
      await page.waitForTimeout(150);

      // --- ⑥ 二重レイヤーにならない ---
      const opaqueLayers = await page.evaluate(() => [...document.querySelectorAll('div')].filter(el => {
        const st = getComputedStyle(el); const r = el.getBoundingClientRect();
        return st.position === 'absolute' && r.width >= window.innerWidth * 0.98 && r.height >= window.innerHeight * 0.9
          && st.backgroundColor !== 'rgba(0, 0, 0, 0)' && !/rgba\(.*0(\.\d+)?\)$/.test(st.backgroundColor)
          && Number(st.opacity || 1) > 0.95;
      }).length);
      check(`内訳を開いても全画面の不透明なレイヤーが増えない(${width}px)`, opaqueLayers <= 1, `${opaqueLayers}枚`);

      // --- ⑤ 桁が大きい個体 ---
      await page.getByRole('button', { name: /閉じる|×/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(300);
      await openDetail('内訳検証おおきい数字');
      const hugeCurrent = toNumber(await page.locator('[data-growth-stat-row="hp"] b').first().textContent());
      check(`大きい数字でも現在値を丸めずに全部出す(${width}px)`, hugeCurrent > 10000000, `${hugeCurrent.toLocaleString()}`);
      const hugeRights = await page.evaluate(() => [...document.querySelectorAll('[data-growth-stat-row] b')]
        .map(el => Math.round(el.getBoundingClientRect().right)));
      check(`桁が増えても4項目の現在値がそろう(${width}px)`, hugeRights.length === 4 && new Set(hugeRights).size === 1, JSON.stringify(hugeRights));
      await noSideScroll('大きい数字の詳細');
      await noElementOverflow('大きい数字の詳細');
      await page.locator('[data-growth-stat-row="hp"]').dispatchEvent('click');
      await page.locator('[data-growth-stat-detail="hp"]').waitFor({ timeout: 10000 });
      const hugeValues = (await page.locator('[data-growth-stat-detail="hp"] b').allTextContents()).map(toNumber);
      check(`大きい数字でも内訳が一致する(${width}px)`,
        hugeValues[0] + hugeValues[1] + hugeValues[2] === hugeValues[3] && hugeValues[3] === hugeCurrent,
        hugeValues.join(' / '));
      await noSideScroll('大きい数字の内訳');
      await noElementOverflow('大きい数字の内訳');
      // 上限Mで止まる距離は、その旨を伝える
      await page.locator('[data-growth-apt-cell="0"]').dispatchEvent('click');
      await page.locator('[data-growth-apt-detail="0"]').waitFor({ timeout: 10000 });
      await noElementOverflow('上限に達した適性の内訳');

      // --- ② 何も育てていない個体 ---
      await page.getByRole('button', { name: /閉じる|×/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(300);
      await openDetail('内訳検証まっさら');
      check(`何も育てていない個体にはバッジを1つも出さない(${width}px)`,
        await page.locator('[data-growth-badge]').count() === 0);
      const plainRow = page.locator('[data-growth-stat-row="hp"]');
      await plainRow.dispatchEvent('click');
      await page.locator('[data-growth-stat-detail="hp"]').waitFor({ timeout: 10000 });
      const plainValues = (await page.locator('[data-growth-stat-detail="hp"] b').allTextContents()).map(toNumber);
      check(`育てていなくても 元 ＝ 現在 が成り立つ(${width}px)`,
        plainValues[0] === plainValues[3] && plainValues[1] === 0 && plainValues[2] === 0, plainValues.join(' / '));

      // --- ⑦ ベースモン詳細には内訳を出さない ---
      await page.getByRole('button', { name: /閉じる|×/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(300);
      // マスモン一覧 → (戻る) → モンスター一覧メニュー → ベースモン。
      // 戻るはアイコンだけのボタンなので、文字を持たない先頭のボタンを押す
      for (let i = 0; i < 4; i++) {
        if (await page.getByRole('button', { name: 'ベースモン' }).count() > 0) break;
        await page.evaluate(() => {
          const back = [...document.querySelectorAll('button')].find(b => b.querySelector('svg') && !(b.innerText || '').trim());
          if (back) back.click();
        });
        await page.waitForTimeout(600);
      }
      await page.getByRole('button', { name: 'ベースモン' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ベースモン' }).first().dispatchEvent('click');
      await page.waitForTimeout(800);
      await page.getByText('モッチー', { exact: false }).first().dispatchEvent('click');
      await page.waitForTimeout(800);
      check(`ベースモン詳細には育成の内訳を出さない(${width}px)`,
        await page.locator('[data-growth-stat-list]').count() === 0
        && await page.locator('[data-growth-badge]').count() === 0);
      check(`ベースモン詳細もこれまでどおり開ける(${width}px)`,
        (await page.evaluate(() => document.body.innerText)).includes('間合い適性'));

      check(`操作中に実行時エラーが出ない(${width}px)`, errors.length === 0, errors[0] || '');
      await page.close();
    }

    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (errors.length) console.log(`  実行時エラー: ${errors[0]}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
