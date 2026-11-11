// 助手の解放(2026-11-11 社長「これから始める人はアシカの助手を使った回数で解放されるようにしようか」)を見張る。
// 設計: docs/progress/assistant-unlock/DESIGN.md / 部品: monster-hero/src/parts/18-assistant-partner.jsx
//
// 見るもの
//   ① 計算(部品を vm で動かす): 今の人は全員が助手のまま・判定は一度きり・はじめての人は選んだ1人だけ・
//      40回で解放・解放は戻らない・壊れた保存値は既定値・演出は1人ずつ二重に出ない・あつのお話は40回で
//   ② つなぎ(60-app.jsx の文字): 読み込みで一度きりの判定・手札を切った所で数える(AIコピー・デバッグ戦は除く)・
//      仲良し度とごほうびを止める・助手えらびで mode:'earn' を書く・小窓・プロフィール・演出・結果画面の1行
//   ③ 公開前の助手を隠す決まりと混ぜていない(assistantUnlockedBy を先に通す)
//
//   node tools/assistant/assistant-partner-unlock-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ① 計算
const src = read('monster-hero/src/parts/18-assistant-partner.jsx');
const released = new Set(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
const ctx = {
  ASSISTANTS: [...released].map(id => ({ id })),
  TEACHING_CARDS: [{ id: 'kiki', baseName: 'ききの応援' }, { id: 'atsu', baseName: 'あつの挑発' }],
  // あつは加入のお話を見るまで(今の決まりのまま)
  assistantUnlockedBy: (id, seen) => released.has(id) && (id !== 'atsu' || (Array.isArray(seen) && seen.includes('atsu_join'))),
};
vm.createContext(ctx);
vm.runInContext(`${src}\n;this.__P={ASSISTANT_PARTNER_KEY,ASSISTANT_CARD_USES_KEY,ASSISTANT_PARTNER_NEED,normalizeAssistantPartner,normalizeAssistantCardUses,assistantPartnerJudgeExisting,assistantPartnerStartEarn,assistantPartnerAllowed,assistantPartnerCountUse,assistantPartnerPendingNotice,assistantPartnerMarkNoticed,assistantPartnerAtsuJoinReady,assistantPartnerSetNow,assistantPartnerOkNow,assistantPartnerLockedNow,assistantPartnerProgressNow,assistantPartnerIdsNow,assistantPartnerOkWith,assistantPartnerUnlockLine};`, ctx);
const P = ctx.__P;
check('新しいキーだけを使う', P.ASSISTANT_PARTNER_KEY === 'mh_assistant_partner_v1' && P.ASSISTANT_CARD_USES_KEY === 'mh_assistant_card_uses_v1');
check('解放は40回(社長 2026-11-11)', P.ASSISTANT_PARTNER_NEED === 40);
for (const bad of [null, undefined, 'x', 3, [], { mode: 'zzz', unlocked: 'a' }]) {
  const s = P.normalizeAssistantPartner(bad);
  if (s.mode !== null || s.unlocked.length !== 0) { check('壊れた保存値は「まだ判定していない」', false, JSON.stringify(bad)); break; }
}
check('壊れた保存値は「まだ判定していない」(判定前は全員選べる)', P.assistantPartnerAllowed(null, 'kiki') && P.assistantPartnerAllowed({ mode: 'bad' }, 'erubin'));
check('壊れた回数は落とす', JSON.stringify(P.normalizeAssistantCardUses({ kiki: 'x', mua: -3, dra: 2.7, atsu: Infinity })) === '{"dra":2}');

// 今の人
const old = P.assistantPartnerJudgeExisting(null, { wasOnboarded: true, hasAssistant: false });
check('プロフィールを決め終えた人は mode:all', old.changed && old.state.mode === 'all');
check('助手を選んだことがある人も mode:all', P.assistantPartnerJudgeExisting(null, { hasAssistant: true }).state.mode === 'all');
check('今の人は全員が助手のまま', [...released].every(id => P.assistantPartnerAllowed(old.state, id)));
check('判定は一度きり(判定ずみなら書かない)', !P.assistantPartnerJudgeExisting(old.state, { wasOnboarded: true }).changed);
check('今の人に助手えらびから earn を書かない', !P.assistantPartnerStartEarn(old.state, 'kiki').changed);
check('はじめての人(何も無い)は読み込みで判定しない', !P.assistantPartnerJudgeExisting(null, {}).changed);

// はじめての人
const earn = P.assistantPartnerStartEarn(null, 'kiki');
check('最初に選んだ1人だけが助手', earn.changed && earn.state.mode === 'earn' && P.assistantPartnerAllowed(earn.state, 'kiki') && !P.assistantPartnerAllowed(earn.state, 'mua'));
check('earn の人をあとで all にしない', !P.assistantPartnerJudgeExisting(earn.state, { wasOnboarded: true }).changed);
let st = earn.state, uses = {}, unlockedAt = -1;
for (let i = 1; i <= 45; i++) {
  const r = P.assistantPartnerCountUse(uses, st, 'mua');
  uses = r.uses; st = r.state;
  if (r.unlockedId === 'mua') { if (unlockedAt >= 0) unlockedAt = -99; else unlockedAt = i; }
}
check('40回目でちょうど解放(1回だけ)', unlockedAt === 40, `解放した回: ${unlockedAt}`);
check('回数は足し続ける', uses.mua === 45);
check('39回では解放しない', !P.assistantPartnerAllowed(P.assistantPartnerCountUse({ dra: 38 }, earn.state, 'dra').state, 'dra'));
check('解放は戻らない(保存し直しても残る)', P.assistantPartnerAllowed(P.normalizeAssistantPartner(JSON.parse(JSON.stringify(st))), 'mua'));
check('first が unlocked から消えても戻す', P.assistantPartnerAllowed({ mode: 'earn', first: 'kiki', unlocked: [] }, 'kiki'));
check('今の人も回数だけは数える(解放の印は書かない)', (() => { const r = P.assistantPartnerCountUse({}, old.state, 'dra'); return r.uses.dra === 1 && !r.stateChanged; })());

// 演出
check('最初に選んだ助手の演出は出さない', P.assistantPartnerPendingNotice(earn.state) === null);
check('解放した助手の演出が1つ待つ', P.assistantPartnerPendingNotice(st) === 'mua');
const seen = P.assistantPartnerMarkNoticed(st, 'mua');
check('見たら二度出さない', seen.changed && P.assistantPartnerPendingNotice(seen.state) === null && !P.assistantPartnerMarkNoticed(seen.state, 'mua').changed);
check('今の人には演出を出さない', P.assistantPartnerPendingNotice({ mode: 'all', unlocked: ['mua'] }) === null);

// あつ(お話は出会うだけ・助手は回数。はじめての人のあつの加入のお話は40回で)
check('はじめての人のあつのお話は40回で流れる', !P.assistantPartnerAtsuJoinReady(earn.state, { atsu: 39 }) && P.assistantPartnerAtsuJoinReady(earn.state, { atsu: 40 }));
check('今の人のあつのお話は回数で流さない(仲良し度のまま)', !P.assistantPartnerAtsuJoinReady(old.state, { atsu: 99 }));
const atsuSt = P.assistantPartnerCountUse({ atsu: 39 }, earn.state, 'atsu').state;
check('40回でもお話を見るまであつは助手にならない', !P.assistantPartnerOkWith(atsuSt, [], 'atsu') && P.assistantPartnerOkWith(atsuSt, ['atsu_join'], 'atsu'));
check('お話の前は演出も待つ', P.assistantPartnerPendingNotice(atsuSt, id => P.assistantPartnerOkWith(atsuSt, [], id)) === null
  && P.assistantPartnerPendingNotice(atsuSt, id => P.assistantPartnerOkWith(atsuSt, ['atsu_join'], id)) === 'atsu');

// いまの値の入口
P.assistantPartnerSetNow({ state: earn.state, uses: { mua: 12 }, seenStoryIds: [], ownedCards: ['mua'] });
check('ほかの部の入口: 町の人と助手', P.assistantPartnerOkNow('kiki') && !P.assistantPartnerOkNow('mua') && P.assistantPartnerLockedNow('mua') && !P.assistantPartnerLockedNow('kiki'));
const pg = P.assistantPartnerProgressNow('mua');
check('「あと何回」の値', pg.count === 12 && pg.need === 40 && pg.cardOwned === true && pg.unlocked === false);
check('関われる助手の列', JSON.stringify(P.assistantPartnerIdsNow()) === '["kiki"]');
P.assistantPartnerSetNow({ state: old.state, uses: {}, seenStoryIds: [] });
check('今の人は町の人がいない', !P.assistantPartnerLockedNow('mua') && P.assistantPartnerIdsNow().length === 7);
check('一言は8人ぶんある', ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].every(id => P.assistantPartnerUnlockLine(id) !== 'これからは、助手としてよろしくね'));

// ② つなぎ
const app = read('monster-hero/src/parts/60-app.jsx');
check('読み込みで一度きりの判定', /assistantPartnerJudgeExisting\(partnerRaw, \{ wasOnboarded: everOnboarded, hasAssistant: savedAssistant != null \}\)/.test(app) && /if \(judged\.changed\) await storeSet\(ASSISTANT_PARTNER_KEY/.test(app));
check('手札を切った所で数える(AIコピー・デバッグ戦は除く)', /if\(!entry\.aiCopy&&isBreeder&&!debugBattleRef\.current\)\{ const partnerCardId=assistantIdOfAssistCard\(card\.id\); if\(partnerCardId\) countAssistantCardUse\(partnerCardId\); \}/.test(app));
check('町の人の仲良し度を増やさない', /if \(!assistantPartnerAllowed\(assistantPartnerRef\.current, id\)\) return;/.test(app));
check('町の人のごほうびは届けない(Lv0 とみなす)', /\|\| !assistantPartnerAllowed\(assistantPartnerRef\.current, who\.id\)\) \? 0/.test(app));
check('助手えらびで earn を書く(見本の画面では書かない)', /if\(!onboardingPreview&&RELEASE_FLAGS\.assistantPartnerUnlock===true\)startAssistantPartnerEarn\(pick\.id\);chooseAssistant\(pick\.id\)/.test(app));
check('助手を変える小窓: 町の人は選べない', /if\(!assistantPartnerAllowed\(assistantPartner,who\.id\)\)\{/.test(app) && /data-assistant-partner-locked/.test(app));
check('プロフィールの仲良し度は助手になった人だけ', /unlockedAssistants=\{assistantsUnlockedFrom\(rhythmEventStorySeen\)\.filter\(who=>\(who\.id!=='momosuke'\|\|momosukeIntroSeenFlag\)&&assistantPartnerAllowed\(assistantPartner,who\.id\)\)\}/.test(app));
check('解放の演出は HOME で1人ずつ', /<AssistantPartnerUnlockFx key=\{who\.id\}/.test(app) && /gameState!=='HOME'/.test(app));
check('結果画面の1行(勝ち・負け・リタイアの3つ)', (app.match(/masuRegisterButtonNode=\{masuRegisterWithPartnerNode\}/g) || []).length === 3);
check('あつのお話の条件(はじめての人は40回)', /assistantPartner\.mode === 'earn' \? !assistantPartnerAtsuJoinReady\(assistantPartner, assistantCardUses\)/.test(app));
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
check('公開の印 assistantPartnerUnlock がある', /assistantPartnerUnlock: (true|false),/.test(rel));
check('印が偽でも、今の人の一度きりの判定は読み込みで書く(印で止めていない)', !/RELEASE_FLAGS\.assistantPartnerUnlock[^\n]*assistantPartnerJudgeExisting/.test(app));
check('使った回数は戦いの終わりにまとめて書く(切るたびに書かない・窓口 2026-11-11)', (() => {
  const at = app.indexOf('const countAssistantCardUse = (assistantId) => {');
  const body = app.slice(at, app.indexOf('\n  };\n', at));
  return at > 0 && !/storeSet\(ASSISTANT_CARD_USES_KEY/.test(body) && /flushAssistantCardUses\(\)/.test(body);
})());
check('戦いの終わり・画面の切り替え・ページを離れるときに書く', /useEffect\(\(\) => \{ flushAssistantCardUses\(\); \}, \[gameState, runStage, hp <= 0, gaveUp\]\);/.test(app)
  && /window\.addEventListener\('pagehide', flushAssistantCardUses\)/.test(app));
check('画面用の回数は毎回更新する(勝ちの結果画面で古くならない・ミハリ3)', /assistantCardUsesRef\.current = r\.uses; setAssistantCardUses\(r\.uses\);/.test(app));
check('解放したときはその場で書く', /if \(r\.stateChanged\) \{ saveAssistantPartner\(r\.state\); flushAssistantCardUses\(\); \}/.test(app));
// ③ 公開前の助手の決まりと混ぜない
check('判定はお話・公開の決まり(assistantUnlockedBy)を先に通す', /if \(typeof assistantUnlockedBy === 'function' && !assistantUnlockedBy\(id, seenStoryIds\)\) return false;\n  return assistantPartnerAllowed\(state, id\);/.test(src));
check('公開の印の判定を書き換えていない', /const assistantReleased = \(assistantId\) => \{/.test(read('monster-hero/data/assistants.js')));
const parts = JSON.parse(read('monster-hero/src/parts/parts.json')).parts;
check('部品は純粋(pure:true)で登録', parts.some(p => p.file === '18-assistant-partner.jsx' && p.pure === true) && parts.some(p => p.file === '59-assistant-partner-fx.jsx'));

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
