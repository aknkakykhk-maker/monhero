const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ミッション・ギフトの未受取バッジ、ミッション一括受取、編成決定後の戻り先、
// ランキングのタブ分離を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// --- 判定ロジックは本番の定義をそのまま動かして確かめる ---
const start = source.indexOf('const LOGIN_BONUS_REWARDS');
const end = source.indexOf('const STAT_POINT_GAIN');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.__m={MISSION_DEFS,normalizeMissions,missionValue,missionClaimableList,missionClaimableCount,giftIsClaimable,giftClaimableCount};`, context);
const m = context.__m;
const at = (s) => Date.parse(s);

// ミッション: 種別ごとの「達成済みかつ未受取」件数
let state = m.normalizeMissions(null, at('2026-07-29T20:00:00Z'));
state.daily = { ...state.daily, login: 1, battles: 3 };
const dailyClaimable = m.missionClaimableList(state, 'daily');
check('デイリーの達成済み・未受取を数えられる', dailyClaimable.length > 0, `${dailyClaimable.length}件`);
check('ウィークリー未達成は0件', m.missionClaimableList(state, 'weekly').length === 0);
check('マンスリー未達成は0件', m.missionClaimableList(state, 'monthly').length === 0);
check('HOMEの合計はタブ別件数の合計と一致する',
  m.missionClaimableCount(state) === m.missionClaimableList(state, 'daily').length + m.missionClaimableList(state, 'weekly').length + m.missionClaimableList(state, 'monthly').length);
state.sentDaily = dailyClaimable.map(x => x.id);
check('受取(ギフト送付)済みは数に入らない', m.missionClaimableList(state, 'daily').length === 0);

// ギフト: 期限内かつ受取可能なものだけ数える
const future = new Date(Date.now() + 864e5).toISOString();
const past = new Date(Date.now() - 864e5).toISOString();
const reward = [{ type: 'diamond', amount: 100 }];
const gifts = [
  { id: 'a', rewards: reward, expiresAt: future, claimedAt: null },
  { id: 'b', rewards: reward, expiresAt: past, claimedAt: null },          // 期限切れ
  { id: 'c', rewards: reward, expiresAt: future, claimedAt: future },      // 受取済み
  { id: 'd', rewards: [{ type: 'unknown_reward' }], expiresAt: future, claimedAt: null }, // 無効
  { id: 'e', rewards: reward, expiresAt: null, claimedAt: null },          // 期限情報なし
];
check('期限内・未受取・報酬有効だけを数える', m.giftClaimableCount(gifts) === 1, `${m.giftClaimableCount(gifts)}件`);
check('期限切れは受取可能に含めない', m.giftIsClaimable(gifts[1]) === false);
check('受取済みは受取可能に含めない', m.giftIsClaimable(gifts[2]) === false);
check('報酬が無効なギフトは含めない', m.giftIsClaimable(gifts[3]) === false);

// --- 画面側の結線はソースで確認する ---
const has = (needle) => source.includes(needle);
check('タブ用の赤い丸バッジがある', has('const tabCountBadge = (count)') && has("backgroundColor: '#dc2626'"));
check('0件ならバッジを出さない', has('count > 0 ?') && has(') : null)'));
check('3種のミッションタブにバッジを出す',
  has("tabCountBadge(missionClaimableList(state,'daily').length)") && has("tabCountBadge(missionClaimableList(state,'weekly').length)") && has("tabCountBadge(missionClaimableList(state,'monthly').length)"));
check('ギフトの未受取タブにバッジを出す', has('tabCountBadge(claimable.length)'));
check('HOMEのギフト通知も同じ判定を使う', has('{giftClaimableCount(gifts)>0&&<em>{giftClaimableCount(gifts)}</em>}'));
check('ギフト画面の受取可能判定も共通化されている', has('const claimable=unclaimed.filter(g=>giftIsClaimable(g,now));'));

// 一括受取
check('一括受取ボタンがある', has('claimMissionsBulk(missionTab)') && has('一括受け取り'));
check('対象が無ければ無効化する', has('disabled={!bulk.length}'));
check('個別受取も残っている', has('claimMission(missionTab,m)'));
check('個別・一括とも同じ送付処理を通る',
  has('const claimMission = (type,mission) => sendMissionsToGiftBox(type,[mission]);') &&
  has('const claimMissionsBulk = (type) => sendMissionsToGiftBox(type,missionClaimableList('));
check('連打を同期ロックで止める', has('if(missionClaimingRef.current)return 0;'));
check('ギフトIDは種別+期間+ミッションIDで固定', has('id:`gift_mission_${type}_${period}_${mission.id}`'));
check('同じIDのギフトは二重に作らない', has('if(!nextGifts.some(g=>g?.id===gift.id)) nextGifts=[gift,...nextGifts];'));
check('受取期限30日は維持', has('expiresAt:new Date(Date.now()+30*24*60*60*1000).toISOString()'));
check('報酬は直接付与せずギフトへ送る', has("await storeSet('mh_gifts',nextGifts,false);") && has("await storeSet('mh_missions',reconciled,false);"));
check('保存済みの進捗で判定し直す', has('const targets=(missionList||[]).filter(m=>m&&!state[sentKey].includes(m.id)&&missionValue(state,type,m)>=m.target);'));

// 編成の戻り先
check('モンスター編成の決定でモンスタータブへ戻る', has("setManagementTab('monster');\n    setGameState('MB_MANAGEMENT');"));
check('アシストカード編成の決定でアシストカードタブへ戻る', has("setManagementTab('assist');\n    setGameState('MB_MANAGEMENT');"));
check('編成画面の戻るボタンも同じ導線', has("onClick={()=>{setManagementTab(rosterTab==='monster'?'monster':'assist');setGameState('MB_MANAGEMENT');}}"));
check('古いFORMATION_MENUが残っていない', !source.includes('FORMATION_MENU'));

// ランキング
check('一覧の取得件数は50件', has('const RANKING_SCORE_LIMIT = 50;'));
check('ブリーダーLvは編成(party)を取得しない', has('RANKING_SELECT_NO_PARTY') && has("levelKind === 'bond' ? RANKING_SELECT_FULL : RANKING_SELECT_NO_PARTY"));
check('遅い取得を失敗にしないタイムアウト', has('controller.abort(), 15000'));
check('画面のエラー文は短い日本語', has('通信が混み合っています。少し待って再読込してください'));
check('ブリーダーLvの取得がスコア一覧を上書きしない',
  has("} else if (includeLevels && levelKind === 'breeder') {\n        setBreederRankingPool(prev => ({ ...prev, ...poolByDiff }));"));
check('レベル系ランキングは1回の取得にまとめる', has('const cacheKey = `levels:${levelKind}`;') && has('sbFetchRankings(null, levelLimit, order, 0, requestId, columns)'));
// ブリーダーLvは名前ごとにまとめて出すため、取得件数が少ないと下位の人が一覧から消える
check('ブリーダーLvは取得件数を多くする',
  has('const RANKING_BREEDER_FETCH_LIMIT = 400;')
    && has("const levelLimit = levelKind === 'bond' ? RANKING_LEVEL_FETCH_LIMIT : RANKING_BREEDER_FETCH_LIMIT;"));
check('起動時の先読みは1難易度だけ', has("loadRankings('Normal')"));
check('前回のランキングを端末に残す', has("const RANKING_CACHE_KEY = 'mh_ranking_cache';") && has('const saveRankingCache = (patch)'));
check('起動時に前回の内容をそのまま出す', has('hydrateRankingCache(await storeGet(RANKING_CACHE_KEY, null, false))'));
check('キャッシュ表示はLoadingにしない', has("const cachedStatus = { loading:false, refreshing:false, error:null, fetched:true };"));
check('起動時にブリーダーLv・絆Lvも裏で先読みする', has("preload('breeder', () => loadRankings(null, true, false, 'breeder'))") && has("preload('bond', () => loadRankings(null, true, false, 'bond'))"));
check('取得できた内容だけをキャッシュする', has("if (sourceByDiff[key] === 'global' && byDiff[key]?.length) cachedScore[key] = byDiff[key];"));
check('一覧を消さずに部分更新する', has('const next = { ...prev };') && has("if (sourceByDiff[key] === 'local' && Array.isArray(prev[key]) && prev[key].length) return;"));
check('取得中でも表示済みは残す(更新中表示)', has('status.refreshing&&<div className="text-center text-[9px] text-indigo-300">更新中…</div>'));
check('永久Loadingにしないタイムアウトがある', has('controller.abort(), 15000'));
check('詳細ログは既定で出さない', has('const rankingDebugEnabled = ()'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
