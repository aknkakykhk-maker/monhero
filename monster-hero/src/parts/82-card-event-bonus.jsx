// ===== MFバトルカード: イベント期間のごほうびの倍(クリスマスイベント 2026・台帳 r1119-172 追記(期間中のボーナス)・追跡 r1125-044) =====
// 期間中は、対戦のごほうび(ビートP・カードランクの経験値・クイック周回)が 1.5倍。
//   掛ける所: 助手と対戦(手・オート)・みんなのデッキとの対戦・マルチ対戦。掛けない所: その日はじめての勝ちの上乗せ・杯と大会の賞品・レイドのボスとの1戦
//   重ね方(社長 2026-11-25「A 掛け算」): カード部屋の助手と対戦(×1.375)・マルチ対戦(×2)とは掛け算で重ねる(部屋の助手 ≒2.06倍・マルチ 3倍)
// ★期間は見るたびに時刻で決める(保存しない)。対戦の倍は、助手と対戦・みんなのデッキは始めた時点、マルチは終わった時点で決める
const CARD_EVENT_BONUS = Object.freeze({
  id: 'xmas_2026',
  name: 'クリスマスイベント',
  startAt: '2026-11-30T10:00:00+09:00',
  endAt: '2026-12-31T04:00:00+09:00',
  mult: 1.5,
  label: '1.5倍',
});
// デバッグで期間の前に見るための印(デバッグの画面だけが立てる。保存しない)
let cardEventBonusForce = false;
const cardEventBonusOn = (nowMs = Date.now()) => {
  if (cardEventBonusForce === true) return true;
  const t = Number(nowMs);
  if (!Number.isFinite(t)) return false;
  return t >= Date.parse(CARD_EVENT_BONUS.startAt) && t < Date.parse(CARD_EVENT_BONUS.endAt);
};
// いまの倍(期間外は 1)
const cardEventBonusMult = (nowMs = Date.now()) => (cardEventBonusOn(nowMs) ? CARD_EVENT_BONUS.mult : 1);
// 数に倍を掛ける(0 は 0 のまま・四捨五入。82 の cardLifeUpApply と同じ丸め)
const cardEventBonusApply = (n, ev = 1) => {
  const v = Number.isFinite(n) ? n : 0;
  return Number.isFinite(ev) && ev > 1 && v > 0 ? Math.round(v * ev) : v;
};
