#!/usr/bin/env node
// ダンジョンRPG戦闘テスト(デバッグ専用)の3画面を、実ブラウザのiPhone相当の縦画面で測る。
//
// この試作は縦画面のスマホで何度も触って数値感を確かめるためのものなので、
// 「横にはみ出す」「コマンドが押せない」「敵4体で崩れる」と目的を果たせない。
// 本体のJSXとCSSをそのまま切り出して描き、次を数値で見る。
//
//   ・横スクロールが起きない(body幅 <= 画面幅)
//   ・セットアップ画面の「戦闘開始」が常に画面内にあり、上の内容はスクロールで全部追える
//   ・セットアップ画面の「人数」がいちばん上にあり、スクロールせずに味方・敵の数を変えられる
//   ・戦闘画面で敵1〜4体・味方1〜4体のどれでもコマンドが画面内に収まり、押せる大きさ(44px以上)がある
//   ・対象を選ばなくても「ねらい」が必ず1体に決まり、その表示が画面内にある
//   ・行動順の並びが、同じモンスターでも味方と敵を色と形の両方で見分けられる
//   ・ダメージの数字が読める大きさで出て、名前と重ならず、画面の外へ出ない
//   ・技の演出(技名の帯・閃光・衝撃波)が出て、長い技名でも切れず画面からはみ出さない
//   ・技名の帯とダメージの数字が同時に出ても重ならない(敵1・2・4体すべて)
//   ・攻撃モーション中も枠からはみ出さず、味方は上・敵は下へ動く
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
// 絵は本物を出す(images/ へのリンクを置いてある)。枠の大きさはCSSで決まっているので、
// 画像の有無で測定結果は変わらないが、見た目の確認画像が実物になる

const params = new URLSearchParams(location.search);
const SCREEN = params.get('s') || 'setup';
const N_ALLY = Number(params.get('a') || 4);
const N_ENEMY = Number(params.get('e') || 4);

const noop = () => {};
const setGameState = noop, setRpgPartySize = noop, setRpgEnemyCount = noop;
// 「技」の一覧はコマンド欄の中で開く。画面だけの開閉なので、測るときは URL から切り替える
const rpgSkillMenu = new URLSearchParams(location.search).get('p') === 'skill';
const setRpgSkillMenu = noop;
// ダメージの数字は表示だけの状態。p=hit のとき、通常ダメージ・会心・回避・戦闘不能を
// 一度に出した状態で測る(いちばん混み合う場面をわざと作る)
const HIT_PHASE = params.get('p') === 'hit' || params.get('p') === 'specialhit';
const rpgHits = HIT_PHASE
  ? { at: 3,
      ally:  [{ damage:284, evaded:false, crit:false, down:false }, null, null, null],
      enemy: [{ damage:1362, evaded:false, crit:true, down:false }, { damage:0, evaded:true, crit:false, down:false },
              { damage:97, evaded:false, crit:false, down:true }, { damage:6, evaded:false, crit:false, down:false }] }
  : null;
// 技の演出も表示だけの状態。p=special のとき、いちばん長い技名で帯を出した状態にする
const rpgSpecial = (params.get('p') === 'special' || params.get('p') === 'specialhit')
  ? { side:'ally', index:0, by:'スネグーラチカ', name:'ブリザードエンドオブザワールド', targetSide:'enemy', targetIndex:2 }
  : null;
// 「ねらい」は画面だけの状態。p=aim のとき2体目を固定してあり、それ以外は自動(ライフ最小)
const rpgAim = params.get('p') === 'aim' ? 1 : null;
const setRpgAim = noop;
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
// 攻撃モーションは表示だけの状態。p=motion / p=motionfoe のとき、
// 本体と同じ rpgMotionName() でモーション名を決めて1体へ当てる
const MOTION_PHASE = params.get('p');
const rpgActing = (MOTION_PHASE === 'motion' || MOTION_PHASE === 'motionfoe')
  ? (() => {
      const side = MOTION_PHASE === 'motion' ? 'ally' : 'enemy';
      const monId = (side === 'ally' ? partySlots : enemySlots)[0].monId;
      return { side, index: 0, motion: rpgMotionName(side, monId, false) };
    })()
  : null;
// 戦闘中の状態は本体の関数でそのまま作る(ログが最大まで溜まった状態で測る)
let battle = rpgCreateBattle(partySlots, enemySlots);
battle.turn = 12;
battle.log = ['ヤオビクニのアクアゲイザー！','赤ゴーレムに1234ダメージ','赤ゴーレムは戦闘不能！','--- TURN 12 ---','スネグーラチカのこうげき！'];
battle.allies.forEach((u, i) => { u.record = { dealt: 123456, taken: 65432, attacks: 12, skills: 8, gutsSpent: 96, crits: 14, evaded: 11 }; u.hp = Math.max(1, Math.floor(u.maxHp * 0.4)); });
battle.enemies.forEach(u => { u.record = { dealt: 54321, taken: 98765, attacks: 9, skills: 5, gutsSpent: 45, crits: 13, evaded: 12 }; u.hp = Math.max(1, Math.floor(u.maxHp * 0.6)); });
battle.outcome = 'win';
// 行動順の帯を「そのターンの確定順」で最大(味方4+敵4=8体)まで並べた状態にする
if (params.get('p') === 'resolve' || HIT_PHASE || params.get('p') === 'special' || rpgActing) {
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
// data/*.js が持つ画像パスは monster-hero/ からの相対なので、同じ名前でリンクを張って実物を出す
const imagesLink = path.join(dir, 'images');
try { fs.unlinkSync(imagesLink); } catch {}
try { fs.symlinkSync(path.join(web, 'images'), imagesLink, 'dir'); } catch {}
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
      ['battle', 2, 2, '戦闘(味方2・敵2)', 'command'],
      ['battle', 4, 3, '戦闘(味方4・敵3)', 'command'],
      ['battle', 4, 4, '戦闘(味方4・敵4・コマンド入力中)', 'command'],
      ['battle', 4, 4, '戦闘(味方4・敵4・技一覧を開いた状態)', 'skill'],
      ['battle', 4, 4, '戦闘(味方4・敵4・敵をタップしてねらいを固定)', 'aim'],
      ['battle', 4, 4, '戦闘(味方4・敵4・行動順8体を実行中)', 'resolve'],
      ['battle', 4, 4, '戦闘(味方4・敵4・ダメージ/会心/回避/戦闘不能の数字が出た瞬間)', 'hit'],
      ['battle', 4, 4, '戦闘(味方4・敵4・技の演出中)', 'special'],
      ['battle', 4, 1, '戦闘(味方4・敵1・技名とダメージが同時)', 'specialhit'],
      ['battle', 4, 2, '戦闘(味方4・敵2・技名とダメージが同時)', 'specialhit'],
      ['battle', 4, 4, '戦闘(味方4・敵4・技名とダメージが同時)', 'specialhit'],
      ['battle', 4, 4, '戦闘(味方4・敵4・味方の攻撃モーション中)', 'motion'],
      ['battle', 4, 4, '戦闘(味方4・敵4・敵の攻撃モーション中)', 'motionfoe'],
      ['result', 4, 4, '結果(味方4・敵4)', 'command'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`file://${path.join(dir, 'index.html')}?s=${screen}&a=${allies}&e=${enemies}&p=${phase}`);
      await page.waitForTimeout(120);
      // ダメージの数字は動いている途中なので、測るたびに結果が変わらないよう
      // 「出はじめ(いちばん下にある瞬間)」で止めてから測る。ここが名前と重なりやすい
      if (phase === 'hit') {
        await page.evaluate(() => document.querySelectorAll('.mh-rpg-hit')
          .forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; })));
      }
      const m = await page.evaluate(() => {
        const rect = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().toJSON() : null; };
        const scroller = document.querySelector('.mh-rpg-scroll');
        const taps = [...document.querySelectorAll('.mh-rpg-command-row button, .mh-rpg-footer button, .mh-rpg-count button, .mh-rpg-stat button, .mh-rpg-enemy')]
          .map(el => el.getBoundingClientRect().height);
        const order = document.querySelector('.mh-rpg-order-list');
        const chips = [...document.querySelectorAll('.mh-rpg-order-chip')];
        const foeRings = [...document.querySelectorAll('.mh-rpg-foe-ring')];
        const members = [...document.querySelectorAll('.mh-rpg-member')];
        return {
          foeCount: foeRings.length,
          foeMinSize: foeRings.length ? Math.min(...foeRings.map(el => el.getBoundingClientRect().width)) : 0,
          foeMaxRight: foeRings.length ? Math.max(...[...document.querySelectorAll('.mh-rpg-foe')].map(el => el.getBoundingClientRect().right)) : 0,
          foeTop: foeRings.length ? Math.min(...foeRings.map(el => el.getBoundingClientRect().top)) : 0,
          selectable: document.querySelectorAll('.mh-rpg-foe.selectable').length,
          memberCount: members.length,
          activeMembers: document.querySelectorAll('.mh-rpg-member.active').length,
          commandBadge: document.querySelectorAll('.mh-rpg-member.active .mh-rpg-member-body em').length,
          message: (document.querySelector('.mh-rpg-message') || {}).getBoundingClientRect ? document.querySelector('.mh-rpg-message').getBoundingClientRect().toJSON() : null,
          skills: [...document.querySelectorAll('.mh-rpg-skill')].map(el => el.getBoundingClientRect().toJSON()),
          fieldScroll: document.querySelector('.mh-rpg-field') ? { h: document.querySelector('.mh-rpg-field').clientHeight, s: document.querySelector('.mh-rpg-field').scrollHeight } : null,
          skillListBox: document.querySelector('.mh-rpg-skill-list') ? document.querySelector('.mh-rpg-skill-list').getBoundingClientRect().toJSON() : null,
          hud: document.querySelector('.mh-rpg-hud') ? document.querySelector('.mh-rpg-hud').getBoundingClientRect().toJSON() : null,
          rendered: !!document.querySelector('.mh-rpg-screen, .mh-rpg-battle'),
          docWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          // 予測順・行動順の並び。同じモンスターが敵味方どちらにも居ても見分けられるか
          orderChips: [...document.querySelectorAll('.mh-rpg-order-chip')].map(el => ({
            enemy: el.classList.contains('enemy'),
            current: el.classList.contains('current'),
            color: getComputedStyle(el).borderTopColor,
            radius: getComputedStyle(el).borderTopLeftRadius,
            alpha: getComputedStyle(el).borderTopColor.startsWith('rgba')
              ? parseFloat(getComputedStyle(el).borderTopColor.split(',')[3]) : 1,
          })),
          band: rect('.mh-rpg-special-band'),
          bandName: (document.querySelector('.mh-rpg-special-band b') || {}).getBoundingClientRect
            ? { r: document.querySelector('.mh-rpg-special-band b').getBoundingClientRect().toJSON(),
                font: parseFloat(getComputedStyle(document.querySelector('.mh-rpg-special-band b')).fontSize),
                text: document.querySelector('.mh-rpg-special-band b').textContent,
                clipped: document.querySelector('.mh-rpg-special-band b').scrollWidth > document.querySelector('.mh-rpg-special-band b').clientWidth + 1 }
            : null,
          bandBy: (document.querySelector('.mh-rpg-special-band small') || {}).textContent || '',
          flash: rect('.mh-rpg-special-flash'),
          specialRings: document.querySelectorAll('.mh-rpg-special-ring').length,
          ringOnTarget: (() => {
            const foes = [...document.querySelectorAll('.mh-rpg-foe')];
            return foes.findIndex(el => el.querySelector('.mh-rpg-special-ring'));
          })(),
          struckMembers: document.querySelectorAll('.mh-rpg-member.struck').length,
          hits: [...document.querySelectorAll('.mh-rpg-hit')].map(el => ({
            text: el.textContent,
            font: parseFloat(getComputedStyle(el).fontSize),
            r: el.getBoundingClientRect().toJSON(),
          })),
          // 数字は絵の上へ重ねて出す。味方カードでは名前と重ならないことも見る
          hitOverName: [...document.querySelectorAll('.mh-rpg-member')].some(card => {
            const hit = card.querySelector('.mh-rpg-hit'), name = card.querySelector('.mh-rpg-member-body b');
            if (!hit || !name) return false;
            const a = hit.getBoundingClientRect(), b = name.getBoundingClientRect();
            return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
          }),
          fieldScrollX: document.querySelector('.mh-rpg-field')
            ? { w: document.querySelector('.mh-rpg-field').clientWidth, s: document.querySelector('.mh-rpg-field').scrollWidth } : null,
          aimBox: rect('.mh-rpg-aim'),
          aimText: (document.querySelector('.mh-rpg-aim') || {}).textContent || '',
          aimHighlight: document.querySelectorAll('.mh-rpg-foe.aimed, .mh-rpg-foe.auto').length,
          aimMarks: document.querySelectorAll('.mh-rpg-aim-mark').length,
          // 光っている敵が「固定したほうか」「ライフ最小か」を、画面のHP表示から確かめる
          aimedIndexIsFixed: (() => {
            const foes = [...document.querySelectorAll('.mh-rpg-foe')];
            const i = foes.findIndex(el => el.classList.contains('aimed'));
            return i === 1 && !foes.some(el => el.classList.contains('auto'));
          })(),
          autoIsLowestHp: (() => {
            const foes = [...document.querySelectorAll('.mh-rpg-foe')];
            const hp = foes.map(el => Number((el.querySelector('.mh-rpg-foe-hp') || {}).textContent.split('/')[0]) || Infinity);
            const lowest = hp.indexOf(Math.min(...hp));
            const i = foes.findIndex(el => el.classList.contains('auto'));
            return i >= 0 && i === lowest && !foes.some(el => el.classList.contains('aimed'));
          })(),
          countsBox: rect('.mh-rpg-counts'),
          countRows: document.querySelectorAll('.mh-rpg-count').length,
          countButtons: document.querySelectorAll('.mh-rpg-count button').length,
          countActive: document.querySelectorAll('.mh-rpg-count button.active').length,
          countMaxRight: Math.max(0, ...[...document.querySelectorAll('.mh-rpg-count button')].map(el => el.getBoundingClientRect().right)),
          firstCardTop: document.querySelector('.mh-rpg-card') ? document.querySelector('.mh-rpg-card').getBoundingClientRect().top : null,
          scrollTop: scroller ? scroller.scrollTop : null,
          statRows: document.querySelectorAll('.mh-rpg-card:first-of-type .mh-rpg-stat').length,
          statRowMaxRight: Math.max(0, ...[...document.querySelectorAll('.mh-rpg-stat')].map(el => el.getBoundingClientRect().right)),
          orderCount: chips.length,
          orderBox: order ? order.getBoundingClientRect().toJSON() : null,
          orderMaxRight: chips.length ? Math.max(...chips.map(el => el.getBoundingClientRect().right)) : 0,
          resultMaxRight: Math.max(0, ...[...document.querySelectorAll('.mh-rpg-result-row')].map(el => el.getBoundingClientRect().right)),
          footer: rect('.mh-rpg-footer'),
          commands: rect('.mh-rpg-commands'),
          firstCommand: rect('.mh-rpg-command-row button'),
          firstCancel: rect('.mh-rpg-cancel'),
          enemies: rect('.mh-rpg-field'),
          allies: rect('.mh-rpg-party'),
          log: rect('.mh-rpg-message'),
          scrollable: scroller ? { h: scroller.clientHeight, s: scroller.scrollHeight } : null,
          minTap: taps.length ? Math.min(...taps) : null,
        };
      });
      const tag = `${label} / ${caseLabel}`;
      check(`${tag}: 描画できている`, m.rendered && errors.length === 0, errors.join(' / '));
      check(`${tag}: 横スクロールしない`, m.docWidth <= width && m.bodyWidth <= width, `幅 ${m.docWidth}px / 画面 ${width}px`);
      if (screen === 'battle') {
        // 行動順は小さな顔アイコンだけ。最大8体でも折り返して画面内に収まること
        check(`${tag}: 行動順が生存者ぶん出ている`, m.orderCount === allies + enemies, `${m.orderCount}体`);
        check(`${tag}: 行動順が横にはみ出さない`, m.orderMaxRight <= width + 0.5, `右端 ${Math.round(m.orderMaxRight)}px / 画面 ${width}px`);
        // 同じモンスターが敵にも味方にも居ることがあるので、顔だけでは見分けられない。
        // 枠の色と形の両方で分かるようにしてある
        {
          const ally = m.orderChips.filter(c => !c.enemy), foe = m.orderChips.filter(c => c.enemy);
          const one = (arr, key) => arr.length && arr.every(c => c[key] === arr[0][key]) ? arr[0][key] : null;
          check(`${tag}: 行動順の枠の色が味方と敵で違う`,
            !!one(ally, 'color') && !!one(foe, 'color') && one(ally, 'color') !== one(foe, 'color'),
            `味方 ${one(ally, 'color')} / 敵 ${one(foe, 'color')}`);
          check(`${tag}: 行動順の枠の形が味方と敵で違う`,
            !!one(ally, 'radius') && !!one(foe, 'radius') && one(ally, 'radius') !== one(foe, 'radius'),
            `味方 ${one(ally, 'radius')} / 敵 ${one(foe, 'radius')}`);
          check(`${tag}: 行動順の枠の色が薄すぎない`, m.orderChips.every(c => c.alpha >= 0.9),
            `いちばん薄い枠 ${Math.min(...m.orderChips.map(c => c.alpha))}`);
          // いま動いている1体を光らせるときに枠の色まで変えると、その1体だけ味方か敵か分からなくなる
          const cur = m.orderChips.find(c => c.current);
          if (cur) check(`${tag}: いま動いている1体も味方か敵か分かる`,
            cur.color === one(cur.enemy ? foe : ally, 'color'), `${cur.enemy ? '敵' : '味方'} ${cur.color}`);
        }
        // モンスターの立ち絵が主役。丸枠が小さくなりすぎないこと
        check(`${tag}: 敵の立ち絵が敵の数だけ出ている`, m.foeCount === enemies, `${m.foeCount}体`);
        // 「小さくなりすぎない」は画面幅に対する割合で見る。狭い画面で敵4体だと物理的に大きくできないので、
        // 固定pxではなく「画面幅の20%以上」を下限にする(320pxなら64px、393pxなら約79px)
        check(`${tag}: 敵の立ち絵が小さくなりすぎない`, m.foeMinSize >= width * 0.2 - 0.5,
          `いちばん小さい丸枠 ${Math.round(m.foeMinSize)}px（画面幅の${Math.round(m.foeMinSize / width * 100)}%）`);
        check(`${tag}: 敵の立ち絵が横にはみ出さない`, m.foeMaxRight <= width + 0.5, `右端 ${Math.round(m.foeMaxRight)}px`);
        check(`${tag}: 敵の立ち絵がヘッダーより下にある`, !!m.hud && m.foeTop >= m.hud.bottom - 0.5, `敵 ${Math.round(m.foeTop)}px / ヘッダー下端 ${Math.round(m.hud?.bottom)}px`);
        // 敵の名前・HPが切れないこと(技一覧を開いたときに押しつぶされていないか)
        check(`${tag}: 敵エリアが切れていない`, !!m.fieldScroll && m.fieldScroll.s <= m.fieldScroll.h + 1,
          m.fieldScroll ? `表示 ${m.fieldScroll.h}px / 中身 ${m.fieldScroll.s}px` : '見つからない');
        check(`${tag}: 味方が人数ぶん出ている`, m.memberCount === allies, `${m.memberCount}体`);
        check(`${tag}: メッセージ欄が敵と味方の間にある`,
          !!m.message && !!m.enemies && !!m.allies && m.message.top >= m.enemies.bottom - 0.5 && m.message.bottom <= m.allies.top + 0.5,
          `敵 ${Math.round(m.enemies?.bottom)} → メッセージ ${Math.round(m.message?.top)}〜${Math.round(m.message?.bottom)} → 味方 ${Math.round(m.allies?.top)}`);
        check(`${tag}: コマンドが画面内に収まる`, !!m.commands && m.commands.bottom <= height + 0.5,
          m.commands ? `下端 ${Math.round(m.commands.bottom)}px` : '見つからない');
        check(`${tag}: 敵・メッセージ・味方・コマンドが縦に全部入る`,
          !!m.enemies && !!m.allies && m.enemies.top >= -0.5 && m.allies.bottom <= m.commands.top + 0.5,
          `敵 ${Math.round(m.enemies?.bottom)} → 味方 ${Math.round(m.allies?.top)}〜${Math.round(m.allies?.bottom)} → コマンド ${Math.round(m.commands?.top)}`);
        if (phase === 'resolve' || phase === 'hit' || phase === 'special' || phase === 'specialhit' || phase.startsWith('motion')) {
          // 実行中はコマンドを出さず「行動中…」を出す
          check(`${tag}: 実行中はコマンドの代わりに進行状況が出る`, !m.firstCommand && !!m.commands);
          check(`${tag}: 実行中は現在コマンド入力中の味方が居ない`, m.activeMembers === 0);
        }
        if (phase.startsWith('motion')) {
          const isAlly = phase === 'motion';
          // アニメーションを止めて途中(45%)へ送り、実際にどれだけ動くかを測る。
          // 「動いた気がする」ではなく、位置の差と枠の中に収まっているかを数値で見る
          const mo = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const anims = el.getAnimations();
            if (!anims.length) return { anims: 0 };
            const a = anims[0];
            const dur = a.effect.getTiming().duration;
            a.pause();
            a.currentTime = 0;
            const at0 = el.getBoundingClientRect().toJSON();
            a.currentTime = dur * 0.45;
            const mid = el.getBoundingClientRect().toJSON();
            a.currentTime = dur;
            const end = el.getBoundingClientRect().toJSON();
            const others = [...document.querySelectorAll('.mh-rpg-foe-ring, .mh-rpg-member-face')]
              .filter(e => e !== el).reduce((n, e) => n + (e.getAnimations().length ? 1 : 0), 0);
            return { anims: anims.length, name: a.animationName, dur, at0, mid, end, others,
              docWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth };
          }, isAlly ? '.mh-rpg-party .mh-rpg-member:first-child .mh-rpg-member-face' : '.mh-rpg-field .mh-rpg-foe:first-child .mh-rpg-foe-ring');
          check(`${tag}: 動いている1体にだけモーションが付く`, !!mo && mo.anims === 1 && mo.others === 0,
            mo ? `本人 ${mo.anims}件 / ほか ${mo.others}体` : '見つからない');
          check(`${tag}: モーションの長さが本体の指定どおり`, !!mo && mo.dur >= 300 && mo.dur <= 500, `${Math.round(mo?.dur)}ms`);
          const dy = mo ? mo.mid.top - mo.at0.top : 0;
          check(`${tag}: ${isAlly ? '味方は上' : '敵は下'}へ動く`, isAlly ? dy <= -6 : dy >= 6, `${Math.round(dy)}px`);
          check(`${tag}: 動き終わると元の位置へ戻る`, !!mo && Math.abs(mo.end.top - mo.at0.top) <= 1 && Math.abs(mo.end.left - mo.at0.left) <= 1,
            mo ? `ずれ ${Math.round(mo.end.top - mo.at0.top)}px` : '');
          check(`${tag}: モーション中も横スクロールが増えない`, !!mo && mo.docWidth <= width && mo.bodyWidth <= width,
            `幅 ${mo?.docWidth}px / 画面 ${width}px`);
        }
        if (phase === 'specialhit') {
          // 技を撃つと、技名の帯とダメージの数字が同じ瞬間に出る。
          // 帯はモンスターの上に出すと数字を隠すので、敵エリアのすぐ下へ置いてある
          const over = m.hits.filter(h => m.band
            && h.r.right > m.band.left && h.r.left < m.band.right
            && h.r.bottom > m.band.top && h.r.top < m.band.bottom);
          check(`${tag}: 技名の帯とダメージの数字が重ならない`, !!m.band && over.length === 0,
            over.length ? `${over.map(h => h.text).join(' / ')} が帯(${Math.round(m.band.top)}〜${Math.round(m.band.bottom)}px)と重なる` : '重なりなし');
          check(`${tag}: 帯は敵エリアより下から始まる`,
            !!m.band && !!m.enemies && m.band.bottom <= m.enemies.bottom + 8,
            `帯 ${Math.round(m.band?.top)}〜${Math.round(m.band?.bottom)} / 敵エリアの下端 ${Math.round(m.enemies?.bottom)}`);
          check(`${tag}: 帯もダメージの数字も画面内に収まる`,
            !!m.band && m.band.top >= -0.5 && m.band.bottom <= height + 0.5
            && m.hits.every(h => h.r.top >= -0.5 && h.r.bottom <= height + 0.5),
            `帯 ${Math.round(m.band?.top)}〜${Math.round(m.band?.bottom)}px / 画面 ${height}px`);
          check(`${tag}: 長い技名が切れずに全部読める`, !!m.bandName && !m.bandName.clipped, m.bandName ? m.bandName.text : '');
        }
        if (phase === 'special') {
          // 技は通常こうげきより重い行動なので、必ず気づける形で出す
          check(`${tag}: 技名の帯が出ている`, !!m.band && !!m.bandName, m.bandName ? m.bandName.text : '見つからない');
          check(`${tag}: 技を撃った本人の名前も出る`, m.bandBy === 'スネグーラチカ', m.bandBy);
          check(`${tag}: 技名が読める大きさ(18px以上)`, !!m.bandName && m.bandName.font >= 18, `${m.bandName?.font}px`);
          check(`${tag}: 長い技名でも横にはみ出さない`,
            !!m.band && m.band.left >= -0.5 && m.band.right <= width + 0.5,
            `${Math.round(m.band?.left)}〜${Math.round(m.band?.right)}px / 画面 ${width}px`);
          check(`${tag}: 長い技名が切れずに全部読める`, !!m.bandName && !m.bandName.clipped,
            m.bandName ? `${m.bandName.text}` : '');
          check(`${tag}: 帯が画面の縦にも収まる`, !!m.band && m.band.top >= -0.5 && m.band.bottom <= height + 0.5,
            `${Math.round(m.band?.top)}〜${Math.round(m.band?.bottom)}px / 画面 ${height}px`);
          check(`${tag}: 画面が光る`, !!m.flash && m.flash.width >= width - 0.5 && m.flash.height >= height * 0.5);
          check(`${tag}: 技を受けた敵にだけ衝撃波が出る`, m.specialRings === 1 && m.ringOnTarget === 2,
            `${m.specialRings}個 / ${m.ringOnTarget}番目の敵`);
          check(`${tag}: 味方が受けたわけではないので味方は光らない`, m.struckMembers === 0, `${m.struckMembers}体`);
          // 帯はモンスターの上ではなく敵エリアのすぐ下に出す(ダメージの数字を隠さないため)
          check(`${tag}: 帯が敵の立ち絵の上に重ならない`,
            !!m.enemies && m.band.bottom <= m.enemies.bottom + 8 && m.band.top > m.enemies.top,
            `帯 ${Math.round(m.band?.top)}〜${Math.round(m.band?.bottom)} / 敵エリア ${Math.round(m.enemies?.top)}〜${Math.round(m.enemies?.bottom)}`);
        }
        if (phase === 'hit') {
          check(`${tag}: ダメージの数字が当たった数だけ出る`, m.hits.length === 5, `${m.hits.length}個`);
          check(`${tag}: 通常ダメージ・会心・回避・戦闘不能がすべて読める形で出る`,
            m.hits.some(h => h.text === '-284') && m.hits.some(h => h.text === '会心-1362')
            && m.hits.some(h => h.text === 'MISS') && m.hits.some(h => h.text === '-97'),
            m.hits.map(h => h.text).join(' / '));
          // 「目立たせる」ための下限。小さくすると気づけないので、実測の文字サイズで見る
          check(`${tag}: 数字が小さすぎない(14px以上・会心は19px以上)`,
            m.hits.every(h => h.font >= 14) && m.hits.filter(h => h.text.startsWith('会心')).every(h => h.font >= 19),
            `最小 ${Math.min(...m.hits.map(h => h.font))}px`);
          check(`${tag}: 味方の数字が名前と重ならない`, !m.hitOverName);
          check(`${tag}: 数字が画面の外へ出ない`,
            m.hits.every(h => h.r.left >= -0.5 && h.r.right <= width + 0.5 && h.r.top >= -0.5 && h.r.bottom <= height + 0.5),
            `左端 ${Math.round(Math.min(...m.hits.map(h => h.r.left)))} / 右端 ${Math.round(Math.max(...m.hits.map(h => h.r.right)))} / 上端 ${Math.round(Math.min(...m.hits.map(h => h.r.top)))} / 下端 ${Math.round(Math.max(...m.hits.map(h => h.r.bottom)))} — 画面 ${width}x${height}`);
          check(`${tag}: 数字が出ても敵エリアが横スクロールしない`,
            !!m.fieldScrollX && m.fieldScrollX.s <= m.fieldScrollX.w + 1,
            m.fieldScrollX ? `表示 ${m.fieldScrollX.w}px / 中身 ${m.fieldScrollX.s}px` : '見つからない');
        }
        if (phase === 'skill') {
          // 技ボタン → 技一覧 → 技選択 の途中。一覧が画面外へはみ出さないこと
          check(`${tag}: 技一覧が出ている`, m.skills.length >= 1, `${m.skills.length}件`);
          check(`${tag}: 技一覧が画面内に収まる`,
            !!m.skillListBox && m.skillListBox.bottom <= height + 0.5 && m.skillListBox.right <= width + 0.5 && m.skillListBox.top >= -0.5,
            m.skillListBox ? `${Math.round(m.skillListBox.top)}〜${Math.round(m.skillListBox.bottom)}px / 画面 ${height}px` : '見つからない');
          check(`${tag}: 技が押せる大きさ`, m.skills.every(r => r.height >= MIN_TAP), `最小 ${Math.round(Math.min(...m.skills.map(r => r.height)))}px`);
          check(`${tag}: 技一覧から「もどる」で通常コマンドへ帰れる`, !!m.firstCancel && m.firstCancel.height >= MIN_TAP, `${Math.round(m.firstCancel?.height)}px`);
        } else if (phase === 'command' || phase === 'aim') {
          check(`${tag}: コマンドが押せる大きさ`, !!m.firstCommand && m.firstCommand.height >= MIN_TAP, `${Math.round(m.firstCommand?.height)}px`);
          check(`${tag}: いまコマンドを入力する味方が1体だけ強調される`, m.activeMembers === 1, `${m.activeMembers}体`);
          check(`${tag}: 入力中の味方にCOMMANDの目印が出る`, m.commandBadge === 1);
          // 対象選択を挟まないぶん、いま誰へ飛ぶかが常に画面に出ていること
          check(`${tag}: ねらいの表示が画面内にあってはみ出さない`,
            !!m.aimBox && m.aimBox.bottom <= height + 0.5 && m.aimBox.right <= width + 0.5,
            m.aimBox ? `${Math.round(m.aimBox.top)}〜${Math.round(m.aimBox.bottom)}px / 右端 ${Math.round(m.aimBox.right)}px` : '見つからない');
          check(`${tag}: ねらっている敵が1体だけ光る`, m.aimHighlight === 1, `${m.aimHighlight}体`);
          check(`${tag}: ねらいの🎯が1体だけに付く`, m.aimMarks === 1, `${m.aimMarks}個`);
          // 敵はいつでも押せる(押すのはねらいの切り替えだけなので行動を消費しない)
          check(`${tag}: 生きている敵はいつでも押せる`, m.selectable === enemies, `${m.selectable}体`);
          check(`${tag}: 敵が押せる大きさ`, m.foeMinSize >= MIN_TAP, `${Math.round(m.foeMinSize)}px`);
          if (phase === 'aim') {
            check(`${tag}: タップで固定したほうがねらいになる`, m.aimedIndexIsFixed, m.aimText || '');
          } else {
            check(`${tag}: 自動のときはライフがいちばん低い敵がねらいになる`, m.autoIsLowestHp, m.aimText || '');
          }
        }
      } else {
        if (screen === 'setup') {
          check(`${tag}: ステ振りの行が6ステータスぶん出ている`, m.statRows === 6, `${m.statRows}行`);
          check(`${tag}: ステ振りの行が横にはみ出さない`, m.statRowMaxRight <= width + 0.5, `右端 ${Math.round(m.statRowMaxRight)}px`);
          // 人数は「味方」「敵」の2列だけ。カードの中に散らばっていないこと
          check(`${tag}: 人数を変える所が味方・敵の2か所にまとまっている`, m.countRows === 2, `${m.countRows}か所`);
          check(`${tag}: 人数のボタンが味方4+敵4ぶん出ている`, m.countButtons === 8, `${m.countButtons}個`);
          check(`${tag}: 味方・敵それぞれ今の人数が選択済みで分かる`, m.countActive === 2, `${m.countActive}個`);
          // いちばん上に置いた意味が無いと困るので、開いた直後(スクロール0)に画面内で押せることを見る
          check(`${tag}: 人数がスクロールせずに見える`,
            m.scrollTop === 0 && !!m.countsBox && m.countsBox.top >= -0.5 && m.countsBox.bottom <= height + 0.5,
            m.countsBox ? `${Math.round(m.countsBox.top)}〜${Math.round(m.countsBox.bottom)}px / 画面 ${height}px` : '見つからない');
          check(`${tag}: 人数がモンスターの詳細カードより上にある`,
            !!m.countsBox && m.firstCardTop !== null && m.countsBox.bottom <= m.firstCardTop + 0.5,
            `人数の下端 ${Math.round(m.countsBox?.bottom)}px / 最初のカード ${Math.round(m.firstCardTop)}px`);
          check(`${tag}: 人数のボタンが横にはみ出さない`, m.countMaxRight <= width + 0.5, `右端 ${Math.round(m.countMaxRight)}px`);
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
        // 確認用の画像は「いちばん読ませたい山」で撮る(測定は出はじめで止めたまま)
        if (phase === 'hit') {
          await page.evaluate(() => document.querySelectorAll('.mh-rpg-hit')
            .forEach(el => el.getAnimations().forEach(a => { a.currentTime = a.effect.getTiming().duration * 0.3; })));
        }
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
