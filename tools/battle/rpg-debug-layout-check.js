#!/usr/bin/env node
// ダンジョンRPG戦闘テスト(デバッグ専用)の3画面を、実ブラウザのiPhone相当の縦画面で測る。
//
// この試作は縦画面のスマホで何度も触って数値感を確かめるためのものなので、
// 「横にはみ出す」「コマンドが押せない」「敵4体で崩れる」と目的を果たせない。
// 本体のJSXとCSSをそのまま切り出して描き、次を数値で見る。
//
//   ・横スクロールが起きない(body幅 <= 画面幅)
//   ・セットアップ画面の「戦闘開始」が常に画面内にあり、上の内容はスクロールで全部追える
//   ・戦闘画面で敵1〜4体・味方1〜4体のどれでもコマンドが画面内に収まり、押せる大きさ(44px以上)がある
//   ・結果画面の一覧が見切れず、下のボタンまで届く
//
//   node tools/battle/rpg-debug-layout-check.js
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const { chromium } = require('playwright');
const { REPO_ROOT, GAME_SYSTEM } = require('../harness');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const whole = fs.readFileSync(GAME_SYSTEM, 'utf8');
const grab = (text, startMark, endMark) => {
  const from = text.indexOf(startMark);
  if (from < 0) throw new Error(`見つからない: ${startMark}`);
  const to = text.indexOf(endMark, from);
  if (to < 0) throw new Error(`見つからない: ${endMark}`);
  return text.slice(from, to);
};
// {gameState==='X'&&(()=>{ ... })()} から、中の関数の本体だけを取り出して部品にする
const screenBody = (name) => {
  const head = `{gameState==='${name}'&&`;
  const from = whole.indexOf(head);
  if (from < 0) throw new Error(`画面が見つからない: ${name}`);
  const start = whole.indexOf('(()=>{', from) + '(()=>{'.length;
  const end = whole.indexOf('\n        })()}', start);
  if (end < 0) throw new Error(`画面の終わりが見つからない: ${name}`);
  return whole.slice(start, end);
};

// 本体のRPG計算と、この画面が使うCSSをそのまま持ち込む
const rpgSource = grab(whole, 'const RPG_MAX_LEVEL = 50;', '// Storage helpers');
const cssRules = [
  (whole.match(/\.mh-debug-banner\{[^}]*\}/) || [''])[0],
  (whole.match(/^\.mh-rpg-screen,\.mh-rpg-battle\{.*$/m) || [''])[0],
].join('\n');
check('画面のCSSを本体から取り出せている', cssRules.includes('.mh-rpg-commands') && cssRules.includes('.mh-debug-banner'),
  `${cssRules.length}文字`);

const app = `
const ArrowLeft = ({size}) => React.createElement('span', {style:{fontSize:size}}, '<');
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
// 画像の読み込みで測定がぶれないよう、絵だけ1x1へ置き換える(枠の大きさはCSSで決まっている)
Object.values(ALL_PLAYER_MONSTERS).forEach(m => { m.iconUrl = BLANK; m.imgUrl = BLANK; m.faceIconUrl = BLANK; });

const params = new URLSearchParams(location.search);
const SCREEN = params.get('s') || 'setup';
const N_ALLY = Number(params.get('a') || 4);
const N_ENEMY = Number(params.get('e') || 4);

const noop = () => {};
const setGameState = noop, setRpgPartySize = noop, setRpgEnemyCount = noop;
const rpgPatchAlly = noop, rpgPatchEnemy = noop, rpgResetAlloc = noop, rpgStepAlloc = noop;
const rpgResetAllocAll = noop, rpgStartBattle = noop, rpgCommand = noop, setRpgBattle = noop;
const setRpgVarianceOn = noop;
const rpgVarianceOn = false;
const MONS = rpgMonsterList();
// 6ステータスすべてへ振り切った状態(使用49/49P)で測る
const partySlots = Array.from({length:N_ALLY}, (_, i) => ({ monId: MONS[i % MONS.length].id, level: 50, alloc: rpgNormalizeAlloc({hp:14,atk:11,def:9,guts:7,speed:5,luck:3}, 50) }));
const enemySlots = Array.from({length:N_ENEMY}, (_, i) => ({ monId: MONS[(i+3) % MONS.length].id, level: 50, typeId: RPG_ENEMY_TYPES[i % 3].id }));
const rpgPartySize = N_ALLY, rpgEnemyCount = N_ENEMY;
const rpgActiveParty = partySlots, rpgActiveEnemies = enemySlots;
// 戦闘中の状態は本体の関数でそのまま作る(ログが最大まで溜まった状態で測る)
let battle = rpgCreateBattle(partySlots, enemySlots);
battle.turn = 12;
battle.log = ['ヤオビクニのアクアゲイザー！','赤ゴーレムに1234ダメージ','赤ゴーレムは戦闘不能！','--- TURN 12 ---','スネグーラチカのこうげき！'];
battle.allies.forEach((u, i) => { u.record = { dealt: 123456, taken: 65432, attacks: 12, skills: 8, gutsSpent: 96, crits: 14, evaded: 11 }; u.hp = Math.max(1, Math.floor(u.maxHp * 0.4)); });
battle.enemies.forEach(u => { u.record = { dealt: 54321, taken: 98765, attacks: 9, skills: 5, gutsSpent: 45, crits: 13, evaded: 12 }; u.hp = Math.max(1, Math.floor(u.maxHp * 0.6)); });
battle.outcome = 'win';
// 行動順の帯を「そのターンの確定順」で最大(味方4+敵4=8体)まで並べた状態にする
if (params.get('p') === 'resolve') {
  battle.phase = 'resolve';
  battle.plan = rpgSpeedOrder(battle).map((entry, i) => ({ ...entry, command:'attack', targetSide: entry.side === 'ally' ? 'enemy' : 'ally', targetIndex:0, value: 100 - i }));
  battle.planStep = Math.min(2, battle.plan.length - 1);
} else {
  battle.phase = 'command';
  battle.inputIndex = 0;
  battle.inputs = {};
}
const rpgBattle = battle;

function Setup() {
${screenBody('RPG_DEBUG_SETUP')}
}
function Battle() {
${screenBody('RPG_DEBUG_BATTLE').replace("gameState==='RPG_DEBUG_BATTLE'&&rpgBattle&&", '')}
}
function Result() {
${screenBody('RPG_DEBUG_RESULT').replace("gameState==='RPG_DEBUG_RESULT'&&rpgBattle&&", '')}
}
const SCREENS = { setup: Setup, battle: Battle, result: Result };
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(SCREENS[SCREEN]));
`;

const out = babel.transformSync(app, {
  presets: [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]],
  filename: 'rpg-debug.jsx', babelrc: false, configFile: false,
});

const dir = path.join(TOOLS_DIR, 'out', 'rpg-debug-layout');
fs.mkdirSync(dir, { recursive: true });
const web = path.join(REPO_ROOT, 'monster-hero');
fs.copyFileSync(path.join(web, 'vendor', 'react.production.min.js'), path.join(dir, 'react.js'));
fs.copyFileSync(path.join(web, 'vendor', 'react-dom.production.min.js'), path.join(dir, 'react-dom.js'));
fs.copyFileSync(path.join(web, 'data', 'images', 'images-ally.js'), path.join(dir, 'images-ally.js'));
fs.copyFileSync(path.join(web, 'data', 'ally-monsters.js'), path.join(dir, 'ally-monsters.js'));
fs.writeFileSync(path.join(dir, 'rpg.js'), babel.transformSync(rpgSource, { filename: 'rpg.js', babelrc: false, configFile: false }).code);
fs.writeFileSync(path.join(dir, 'app.js'), out.code);
// この画面はTailwindを使わず専用CSSだけで組んでいるので、本体のCSSをそのまま貼れば本番と同じになる。
// 足りないのは全体の下地(body・入力部品の既定)だけ
fs.writeFileSync(path.join(dir, 'shim.css'), `*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%;background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif}
#root{height:100vh;display:flex;flex-direction:column}
button{border:0;color:inherit;font:inherit;cursor:pointer}
ul{margin:0;padding:0;list-style:none}
p,h2,h3{margin:0}
${cssRules}`);
fs.writeFileSync(path.join(dir, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="shim.css"></head><body><div id="root"></div>
<script src="react.js"></script><script src="react-dom.js"></script>
<script src="images-ally.js"></script><script src="ally-monsters.js"></script>
<script src="rpg.js"></script><script src="app.js"></script></body></html>`);

const VIEWPORTS = [
  ['iPhone SE(第1世代) 320x568', 320, 568],
  ['iPhone SE/8 375x667', 375, 667],
  ['iPhone 14 Pro 393x852', 393, 852],
];
const MIN_TAP = 40; // タップ領域の下限(px)。本文の指示より少し緩めに見て、明らかに小さいものだけ落とす

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shots = [];
  for (const [label, width, height] of VIEWPORTS) {
    for (const [screen, allies, enemies, caseLabel, phase] of [
      ['setup', 4, 4, 'セットアップ(味方4・敵4・6ステータス)', 'command'],
      ['battle', 1, 1, '戦闘(味方1・敵1)', 'command'],
      ['battle', 4, 4, '戦闘(味方4・敵4・コマンド入力中)', 'command'],
      ['battle', 4, 4, '戦闘(味方4・敵4・行動順8体を実行中)', 'resolve'],
      ['result', 4, 4, '結果(味方4・敵4)', 'command'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`file://${path.join(dir, 'index.html')}?s=${screen}&a=${allies}&e=${enemies}&p=${phase}`);
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => {
        const rect = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().toJSON() : null; };
        const scroller = document.querySelector('.mh-rpg-scroll');
        const taps = [...document.querySelectorAll('.mh-rpg-command-row button, .mh-rpg-footer button, .mh-rpg-count button, .mh-rpg-stat button, .mh-rpg-enemy')]
          .map(el => el.getBoundingClientRect().height);
        const order = document.querySelector('.mh-rpg-order-list');
        const chips = [...document.querySelectorAll('.mh-rpg-order-chip')];
        return {
          rendered: !!document.querySelector('.mh-rpg-screen, .mh-rpg-battle'),
          docWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          statRows: document.querySelectorAll('.mh-rpg-card:first-of-type .mh-rpg-stat').length,
          statRowMaxRight: Math.max(0, ...[...document.querySelectorAll('.mh-rpg-stat')].map(el => el.getBoundingClientRect().right)),
          orderCount: chips.length,
          orderBox: order ? order.getBoundingClientRect().toJSON() : null,
          orderMaxRight: chips.length ? Math.max(...chips.map(el => el.getBoundingClientRect().right)) : 0,
          resultMaxRight: Math.max(0, ...[...document.querySelectorAll('.mh-rpg-result-row')].map(el => el.getBoundingClientRect().right)),
          footer: rect('.mh-rpg-footer'),
          commands: rect('.mh-rpg-commands'),
          firstCommand: rect('.mh-rpg-command-row button'),
          enemies: rect('.mh-rpg-enemies'),
          allies: rect('.mh-rpg-allies'),
          log: rect('.mh-rpg-log'),
          scrollable: scroller ? { h: scroller.clientHeight, s: scroller.scrollHeight } : null,
          minTap: taps.length ? Math.min(...taps) : null,
        };
      });
      const tag = `${label} / ${caseLabel}`;
      check(`${tag}: 描画できている`, m.rendered && errors.length === 0, errors.join(' / '));
      check(`${tag}: 横スクロールしない`, m.docWidth <= width && m.bodyWidth <= width, `幅 ${m.docWidth}px / 画面 ${width}px`);
      if (screen === 'battle') {
        // 行動順の帯。最大8体でも折り返して画面内に収まること
        check(`${tag}: 行動順が生存者ぶん出ている`, m.orderCount === allies + enemies, `${m.orderCount}体`);
        check(`${tag}: 行動順が横にはみ出さない`, m.orderMaxRight <= width + 0.5, `右端 ${Math.round(m.orderMaxRight)}px / 画面 ${width}px`);
        check(`${tag}: コマンドが画面内に収まる`, !!m.commands && m.commands.bottom <= height + 0.5,
          m.commands ? `下端 ${Math.round(m.commands.bottom)}px` : '見つからない');
        check(`${tag}: 敵・味方・ログ・コマンドが縦に全部入る`,
          !!m.enemies && !!m.allies && !!m.log && m.enemies.top >= -0.5 && m.log.bottom <= m.allies.top + 0.5 && m.allies.bottom <= m.commands.top + 0.5,
          `敵 ${Math.round(m.enemies?.bottom)} → 味方 ${Math.round(m.allies?.top)}〜${Math.round(m.allies?.bottom)} → コマンド ${Math.round(m.commands?.top)}`);
        // 実行中はコマンドを出さず「行動中…」を出すので、押せる大きさを見るのは入力中だけ
        if (phase === 'resolve') check(`${tag}: 実行中はコマンドの代わりに進行状況が出る`, !m.firstCommand && !!m.commands);
        else check(`${tag}: コマンドが押せる大きさ`, !!m.firstCommand && m.firstCommand.height >= MIN_TAP, `${Math.round(m.firstCommand?.height)}px`);
      } else {
        if (screen === 'setup') {
          check(`${tag}: ステ振りの行が6ステータスぶん出ている`, m.statRows === 6, `${m.statRows}行`);
          check(`${tag}: ステ振りの行が横にはみ出さない`, m.statRowMaxRight <= width + 0.5, `右端 ${Math.round(m.statRowMaxRight)}px`);
        }
        if (screen === 'result') {
          check(`${tag}: 結果の表(会心・回避を含む9列)が横にはみ出さない`, m.resultMaxRight <= width + 0.5, `右端 ${Math.round(m.resultMaxRight)}px`);
        }
        check(`${tag}: 下のボタンが画面内に収まる`, !!m.footer && m.footer.bottom <= height + 0.5,
          m.footer ? `下端 ${Math.round(m.footer.bottom)}px` : '見つからない');
        check(`${tag}: 上の内容をスクロールで全部追える`, !!m.scrollable && m.scrollable.h > 0,
          m.scrollable ? `表示 ${m.scrollable.h}px / 中身 ${m.scrollable.s}px` : '見つからない');
      }
      check(`${tag}: 小さすぎるタップ領域が無い`, m.minTap === null || m.minTap >= MIN_TAP, `最小 ${Math.round(m.minTap)}px`);
      if (width === 375) {
        const file = path.join(dir, `${screen}-${allies}v${enemies}-${phase}.png`);
        await page.screenshot({ path: file });
        shots.push(file);
      }
      await page.close();
    }
  }
  await browser.close();
  console.log(`\n確認用の画像: ${shots.map(f => path.relative(REPO_ROOT, f)).join(' / ')}`);
  console.log(failed === 0 ? 'すべてOK' : `${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
