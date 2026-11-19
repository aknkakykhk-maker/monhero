// 分析の入り口(Edge Function analysis-gateway・r1119-014 PR1)へ送る口。会話の機械から使う。
//
//   node tools/analysis/gateway-client.js usage
//       … 今日使った額と上限
//   node tools/analysis/gateway-client.js message --kind balance --system <ファイル> --prompt <ファイル> [--image a.png ...]
//                                               [--max-tokens 8000] [--effort high] [--out 結果.md] [--dry-run]
//       … 1回だけ Claude Opus 5.5 を呼んで、返事を --out へ書く(無ければ画面へ)
//   node tools/analysis/gateway-client.js batch-get <batch_id> [--out 結果.json]
//   node tools/analysis/gateway-client.js batch-cancel <batch_id>
//   --dry-run … 送らずに、入り口と同じ計算で「多めの見積り」(ドル)だけを出す(合言葉が無くても使える)
//
// 合言葉: 環境変数 ANALYSIS_GATEWAY_TOKEN。値はリポジトリ・会話・報告に書かない。
//   クラウドの環境のネットワークの秘密(ヘッダー x-analysis-token)に入れてあるときは ANALYSIS_GATEWAY_TOKEN=proxy にする
//   (送るのは置き場所の文字だけで、プロキシが本物に差し替える)。
// 送り先: 環境変数 ANALYSIS_GATEWAY_URL(無ければ本番の Supabase の関数)。
// Node の fetch はそのままではプロキシを通らないので、HTTPS_PROXY があれば NODE_USE_ENV_PROXY=1 を付けて自分を起動し直す。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const CORE = path.join(root, 'supabase', 'functions', 'analysis-gateway', 'core.js');
const DEFAULT_URL = 'https://zrzevudkbgtxlbvmuziy.supabase.co/functions/v1/analysis-gateway';
const PROXY_PLACEHOLDER = 'proxy-injects-analysis-token';

const loadCore = () => import(CORE);

// HTTPS_PROXY を Node の fetch に使わせる(Node 22.21 以上)。CLI から呼ぶときだけ
const ensureProxyEnv = () => {
  if (!process.env.HTTPS_PROXY || process.env.NODE_USE_ENV_PROXY === '1') return false;
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
  return true;
};

const tokenFromEnv = () => {
  const v = process.env.ANALYSIS_GATEWAY_TOKEN || '';
  if (v === 'proxy') return PROXY_PLACEHOLDER;
  return v;
};

// payload を入り口へ送る。返り: { status, json }
const send = async (payload, { url = process.env.ANALYSIS_GATEWAY_URL || DEFAULT_URL, token = tokenFromEnv(), fetchImpl = globalThis.fetch } = {}) => {
  if (!token) throw new Error('合言葉がありません(環境変数 ANALYSIS_GATEWAY_TOKEN)。窓口に頼んでください');
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-analysis-token': token },
    body: JSON.stringify(payload),
  });
  let json = null;
  try { json = await res.json(); } catch { json = { ok: false, error: 'not_json' }; }
  return { status: res.status, json };
};

const imageBlock = (file) => {
  const ext = path.extname(file).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : null;
  if (!mediaType) throw new Error(`絵は png か jpg だけです: ${file}`);
  return { type: 'image', media_type: mediaType, data: fs.readFileSync(file).toString('base64') };
};

// 入り口と同じ計算の見積り(送らない)
const estimate = async (request, { batch = false } = {}) => {
  const core = await loadCore();
  const built = core.buildParams(request, { batch });
  if (!built.ok) return { ok: false, error: built.error };
  return { ok: true, usd_est: core.estimateUsd(built.est, { batch }), input_tokens_est: built.est.inputTokens, max_tokens: built.est.maxTokens };
};

const argOf = (args, name, fallback = null) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback; };
const argsOf = (args, name) => args.reduce((acc, a, i) => (a === name && i + 1 < args.length ? [...acc, args[i + 1]] : acc), []);

const main = async () => {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const dry = args.includes('--dry-run');
  if (!dry && ensureProxyEnv()) return;
  const out = argOf(args, '--out');
  const write = (text) => { if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, text); console.log(`書いた: ${out}`); } else console.log(text); };

  if (cmd === 'usage') {
    const r = await send({ action: 'usage' });
    console.log(JSON.stringify(r.json));
    return r.status === 200 ? 0 : 1;
  }
  if (cmd === 'message') {
    const kind = argOf(args, '--kind', 'misc');
    const systemFile = argOf(args, '--system');
    const promptFile = argOf(args, '--prompt');
    if (!promptFile) throw new Error('--prompt <ファイル> が要ります');
    const content = [...argsOf(args, '--image').map(imageBlock), { type: 'text', text: fs.readFileSync(promptFile, 'utf8') }];
    const request = {
      system: systemFile ? fs.readFileSync(systemFile, 'utf8') : undefined,
      messages: [{ role: 'user', content }],
      max_tokens: Number(argOf(args, '--max-tokens', '8000')),
      effort: argOf(args, '--effort', 'high'),
    };
    const est = await estimate(request);
    console.log(`見積り(多め): ${JSON.stringify(est)}`);
    if (dry || !est.ok) return est.ok ? 0 : 1;
    const r = await send({ action: 'message', kind, label: path.basename(promptFile), request });
    if (r.status !== 200 || !r.json?.ok) { console.log(`断られた・失敗: ${r.status} ${JSON.stringify(r.json)}`); return 1; }
    console.log(`使った額: $${r.json.usd}(見積り $${r.json.usd_est})・モデル ${r.json.model}・止まった理由 ${r.json.stop_reason}`);
    write(r.json.text);
    return 0;
  }
  if (cmd === 'batch-get' || cmd === 'batch-cancel') {
    const batchId = args[1];
    const r = await send({ action: cmd === 'batch-get' ? 'batch_get' : 'batch_cancel', batch_id: batchId });
    if (cmd === 'batch-get' && r.json?.results) write(JSON.stringify(r.json, null, 1));
    else console.log(JSON.stringify(r.json));
    return r.status === 200 ? 0 : 1;
  }
  console.log('使い方は、このファイルの先頭を見てください');
  return 1;
};

module.exports = { send, estimate, imageBlock, ensureProxyEnv, tokenFromEnv, DEFAULT_URL };

if (require.main === module) {
  main().then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
