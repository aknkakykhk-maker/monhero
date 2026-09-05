#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const changelogSource = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
const assistantsSource = fs.readFileSync('monster-hero/data/assistants.js', 'utf8');
const game = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const context = {};
vm.runInNewContext(`${changelogSource}\n${assistantsSource}\nthis.changelog=CHANGELOG;this.notices=ASSISTANT_UPDATE_NOTICES;`, context);
const changelog = context.changelog;
const notices = context.notices;
const officialNotices = notices.filter(n => n.enabled === true && n.debugOnly !== true);
const annotatedEntries = changelog.filter(entry => entry.assistantNotice);

// 更新履歴の種別。画面のタブは「更新情報」「不具合情報」の2つで、
// issue 以外はすべて更新情報へ出る(game-system.jsx の changelogEntriesOfTab)。
// ここに無い種別を書くと、画面での扱いが決まっていないまま増えてしまうので止める
const CHANGELOG_ENTRY_TYPES = ['update', 'issue', 'fix', 'feature', 'market', 'mode'];
const unknownTypes = [...new Set(changelog.map(entry => entry.type).filter(type => !CHANGELOG_ENTRY_TYPES.includes(type)))];
assert(unknownTypes.length === 0, `更新履歴に知らない種別があります: ${unknownTypes.join(', ')}`);
assert(annotatedEntries.length, 'assistantNotice 付きの更新履歴が必要です');
assert.strictEqual(officialNotices.length, annotatedEntries.length, '通常通知は changelog のメタデータからだけ生成する必要があります');
assert.strictEqual(new Set(notices.map(n => n.id)).size, notices.length, '通知IDは一意である必要があります');
assert(annotatedEntries.every(entry => ['market', 'mode', 'feature'].includes(entry.assistantNotice.type)), '通知種別は market / mode / feature だけです');
annotatedEntries.forEach(entry => {
  const notice = officialNotices.find(item => item.id === entry.assistantNotice.id);
  assert(notice, `${entry.title} の通知が生成されていません`);
  assert.strictEqual(notice.title, entry.title, '通知タイトルは changelog から生成する必要があります');
  assert.deepStrictEqual(Array.from(notice.pages), Array.from(entry.items), '通知本文は changelog.items から生成する必要があります');
});
assert(notices.filter(n => n.debugOnly !== true).every(n => n.id !== 'update_notice_debug_v1'), 'テスト通知を通常配信してはいけません');
assert(changelog.filter(entry => entry.type === 'issue').every(entry => !entry.assistantNotice), '通常の不具合修正を助手通知にしてはいけません');
assert(changelog.find(entry => entry.title === '転生オーラを専用画像へ変更しました' && !entry.assistantNotice), '細かな更新は通知対象外にする必要があります');

const marketNotice = officialNotices.find(n => n.id === 'update_notice_undine_yaobikuni_market_v1');
assert(marketNotice, 'ウンディーネ・ヤオビクニのマーケット通知が必要です');
assert.strictEqual(marketNotice.destination, 'market');
assert.strictEqual(marketNotice.buttonLabel, 'マーケットを見る');
const resetTicketEntry = changelog.find(entry => entry.title === 'スキルポイントリセット券を追加しました');
assert(resetTicketEntry, 'スキルポイントリセット券の更新履歴が必要です');
assert.strictEqual(resetTicketEntry.type, 'update', 'スキルポイントリセット券は更新情報へ掲載する必要があります');
assert(resetTicketEntry.items.some(item => item.includes('1000ダイヤ')), '既存の販売価格1000ダイヤを更新履歴へ掲載する必要があります');
assert.strictEqual(resetTicketEntry.assistantNotice?.type, 'market', 'マーケット新商品は market 通知にする必要があります');
const resetTicketNotice = officialNotices.find(n => n.id === resetTicketEntry.assistantNotice?.id);
assert(resetTicketNotice, 'スキルポイントリセット券のみゅあ通知が必要です');
assert.strictEqual(resetTicketNotice.destination, 'market');
assert.strictEqual(resetTicketNotice.buttonLabel, 'マーケットを見る');
const modeNotices = officialNotices.filter(n => annotatedEntries.find(entry => entry.assistantNotice.id === n.id)?.assistantNotice.type === 'mode');
assert(modeNotices.length && modeNotices.every(n => n.destination === 'battle'), 'mode 通知はバトルへ遷移する必要があります');
const featureEntry = annotatedEntries.find(entry => entry.assistantNotice.type === 'feature' && entry.assistantNotice.destination);
const featureNotice = officialNotices.find(n => n.id === featureEntry.assistantNotice.id);
assert.strictEqual(featureNotice.destination, featureEntry.assistantNotice.destination, 'feature の遷移先を引き継ぐ必要があります');

const noticePlannerSource = game.slice(
  game.indexOf("const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1';"),
  game.indexOf('const localCalendarDate =', game.indexOf("const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1';")),
);
const plannerContext = { ASSISTANT_UPDATE_NOTICES: officialNotices };
vm.runInNewContext(`${noticePlannerSource}\nthis.plan=planUpdateNoticesForLogin;this.normalize=normalizeSeenUpdateNoticeIds;`, plannerContext);
const planLogin = (all, seen) => {
  const result = plannerContext.plan(all, seen);
  return { queue: Array.from(result.queue), seen: Array.from(result.seen) };
};
const markConfirmed = (seen, notice) => Array.from(plannerContext.normalize([...seen, notice.id]));
const fixtureNotices = Array.from({ length: 11 }, (_, i) => ({ id: `notice_${11 - i}` }));

for (const count of [1, 2, 3]) {
  const plan = planLogin(fixtureNotices.slice(0, count), []);
  assert.deepStrictEqual(plan.queue.map(n => n.id), fixtureNotices.slice(0, count).map(n => n.id), `未読${count}件はすべて新しい順で案内する必要があります`);
  assert.deepStrictEqual(plan.seen, [], `未読${count}件を表示前に一括既読にしてはいけません`);
}

const firstLogin = planLogin(fixtureNotices.slice(1), []);
assert.deepStrictEqual(firstLogin.queue.map(n => n.id), ['notice_10', 'notice_9', 'notice_8'], '未読10件は最新3件だけを案内する必要があります');
assert.deepStrictEqual(firstLogin.seen, ['notice_7', 'notice_6', 'notice_5', 'notice_4', 'notice_3', 'notice_2', 'notice_1'], '4件目より古い未読7件は既読にする必要があります');

const afterOneConfirmed = markConfirmed(firstLogin.seen, firstLogin.queue[0]);
const resumedLogin = planLogin(fixtureNotices.slice(1), afterOneConfirmed);
assert.deepStrictEqual(resumedLogin.queue.map(n => n.id), ['notice_9', 'notice_8'], '3件のうち1件だけ確認して終了した場合は残り2件を次回表示する必要があります');
assert.strictEqual(resumedLogin.seen.length, 8, '古い7件は次回ログインでも未読へ戻してはいけません');

const allThreeConfirmed = markConfirmed(markConfirmed(afterOneConfirmed, firstLogin.queue[1]), firstLogin.queue[2]);
assert.deepStrictEqual(planLogin(fixtureNotices.slice(1), allThreeConfirmed).queue, [], '既読通知は再表示してはいけません');
const afterNewNotice = planLogin(fixtureNotices, allThreeConfirmed);
assert.deepStrictEqual(afterNewNotice.queue.map(n => n.id), ['notice_11'], '新しい通知の追加後は新たな未読を正常に案内する必要があります');

assert(game.includes("const UPDATE_NOTICE_SEEN_KEY = 'mh_seen_update_notices_v1'"));
assert(game.includes('new Set((Array.isArray(value) ? value : [])'), '不正値の正規化と重複除去が必要です');
assert(game.includes('else await storeSet(UPDATE_NOTICE_SEEN_KEY'), '新規プレイヤーの既存通知seedが必要です');
assert(game.includes('availableUpdateNotices().map(n=>n.id)'), '新規プレイヤー向けの既存通知seedを維持する必要があります');
assert(game.includes('await storeSet(UPDATE_NOTICE_SEEN_KEY, normalizeSeenUpdateNoticeIds([...seen, current.id])'), '終了時の既読保存が必要です');
assert(!/BUILD_DATE[^\n]*ASSISTANT_UPDATE_NOTICES|ASSISTANT_UPDATE_NOTICES[^\n]*BUILD_DATE/.test(game + assistantsSource), 'BUILD_DATEと通知を連動してはいけません');
assert(game.includes("market:'BREEDER_MARKET'") && game.includes('setGameState(destinationState)'), 'マーケット通知からマーケットへ遷移する必要があります');
assert(game.includes("battle:'BATTLE_MODE_SELECT'"), 'mode 通知からバトルへ遷移する必要があります');
assert(game.includes("/^[A-Z][A-Z0-9_]*$/"), 'feature の指定遷移先だけを安全に受け付ける必要があります');
assert(game.includes("notice.destination?'あとで':'閉じる'"));
console.log('assistant update notice check: OK');
