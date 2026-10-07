// 小さい画面・遅い端末: 幅320px × 高さ568px(いちばん小さい iPhone くらい)で、CPU を4倍遅くして遊ぶ。
//   ・起動にかかる秒数(遅い端末の人が待つ時間)
//   ・HOME の入口を全部回る(横はみ出し・押せないほど小さいボタン・真っ白は、どの担当とも同じ見張りが拾う)
//   ・1曲演奏する。★遅い CPU ではボット自身の押すのも遅れるので、MISS が多くても不具合とは決めつけず、改善のヒントにする
// 画面の大きさと CPU の遅さは roles.js の viewport / cpuSlowdown で決める(lib/session.js が設定する)。
const { tourScenario } = require('./explore');
const { rhythmScenario } = require('./rhythm');

async function smallTourScenario(s, { rand }) {
  return tourScenario(s, { stepsEach: 3, rand, report: { clickCount: new Map() } });
}

async function smallPlayScenario(s) {
  const r = await rhythmScenario(s);
  const res = (r.stats && r.stats.result) || {};
  const miss = Number(res.miss), notes = Number(r.stats && r.stats.notes);
  const rate = Number.isFinite(miss) && notes ? miss / notes : null;
  if (rate !== null && rate > 0.3) await s.addIssue('遅い端末で演奏しにくい', `幅320px・CPU 4倍遅いで ${notes}ノーツ中 ${miss}ノーツが MISS(ボットの押すのも遅れるので目安)`);
  await s.backHome();
  return { ok: r.ok, note: `${r.note || '演奏できなかった'}${rate !== null ? `・MISS ${Math.round(rate * 100)}%` : ''}` };
}

module.exports = { smallTourScenario, smallPlayScenario };
