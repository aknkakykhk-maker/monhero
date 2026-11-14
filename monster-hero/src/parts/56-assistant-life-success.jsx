// ===== 助手ライフからモンヒロサクセスへの入口(2026-11-14 社長「助手ライフの機能でモンヒロサクセスも足しといてね」・窓口経由・ナカヨシ) =====
//   ・部屋の「できること」(マスモンで対戦(β)の次)と、地図のモンヒロバトルにいる助手の札に「🌱 モンヒロサクセス(β)」
//   ・押すと MonheroSuccessScreen を開く。HOME の札(MonheroSuccessHomeEntry)と同じ開き方: 開いているあいだの知らせ onOpenChange・callNameOf・bondLvOf を同じに渡す
//   ・入れ物 AssistantLifeSuccessHost は 60-app に1つだけ置く(マスモン対戦の AssistantMasmonBattleHost と同じ形)
//   ・始める画面はみゅあ編が選ばれた状態で開く(いま開いている編はみゅあ編だけ)。みゅあ以外の助手は sub に「いまはみゅあ編だけ」
//   ・公開の印 monheroSuccess が偽のあいだは何も出さない(msxReleased)。何も保存しない
const ALSX_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach(f => { try { f(v); } catch (_) {} }); } };
const assistantLifeSuccessOn = () => { try { return typeof msxReleased === 'function' && !!msxReleased() && typeof MonheroSuccessScreen === 'function'; } catch (_) { return false; } };
// 開く。印が偽なら何もしない(false)。from: 'room' | 'place'
const assistantLifeSuccessOpen = (opts = {}) => {
  if (!assistantLifeSuccessOn()) return false;
  const o = opts && typeof opts === 'object' ? opts : {};
  ALSX_HOST.set({ assistantId: typeof o.assistantId === 'string' ? o.assistantId : '', from: typeof o.from === 'string' ? o.from : 'room', at: Date.now() });
  return true;
};
// 「できること」の1行。印が偽なら null(ボタンを出さない)
const assistantLifeSuccessRowInfo = (assistantId) => {
  if (!assistantLifeSuccessOn()) return null;
  const open = (typeof MSX_SCENARIOS !== 'undefined' && Array.isArray(MSX_SCENARIOS) ? MSX_SCENARIOS : []).filter(x => x && (typeof msxBetaAidOk !== 'function' || msxBetaAidOk(x.aid))).map(x => x.aid);
  const own = open.includes(assistantId);
  const name = typeof assistantById === 'function' && assistantById(assistantId) ? assistantById(assistantId).name : '';
  return { label: '🌱 モンヒロサクセス(β)', sub: own ? `${name}編でモンスターを育てる` : 'モンスターを育てる(いまはみゅあ編だけ)' };
};
// 60-app に1つだけ置く入れ物。HOME の札と同じ3つを受け取る
function AssistantLifeSuccessHost({ callNameOf, bondLvOf, onOpenChange }) {
  const [open, setOpen] = useState(ALSX_HOST.open);
  useEffect(() => { const f = (v) => setOpen(v); ALSX_HOST.subs.add(f); return () => { ALSX_HOST.subs.delete(f); }; }, []);
  useEffect(() => { try { if (onOpenChange) onOpenChange(!!open); } catch (_) {} }, [!!open]);
  if (!open || !assistantLifeSuccessOn()) return null;
  return <MonheroSuccessScreen key={open.at} onClose={() => ALSX_HOST.set(null)} callNameOf={callNameOf} bondLvOf={bondLvOf}/>;
}
