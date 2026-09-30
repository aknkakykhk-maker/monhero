#!/usr/bin/env node
// Supabase へ、リポジトリに用意したSQLを「予行演習 → 本番 → 確認」の順で流す(2026-09-30・ユーザー指示「全部そっちでやれるようにできないの?」)。
//
//   node tools/supabase-apply.js RHYTHM_TOUCH_DIAG            # docs/sql/rankings/RHYTHM_TOUCH_DIAG_{APPLY_TEST,APPLY,VERIFY}.sql
//   node tools/supabase-apply.js RHYTHM_PLAY_LOG --dry        # 流さずに、何を流すかだけ出す
//   node tools/supabase-apply.js --query "select count(*) from public.rhythm_touch_diagnostics"   # 読み取りだけの問い合わせ
//
// 鍵: 環境変数 SUPABASE_ACCESS_TOKEN(Supabase の Account → Access Tokens で作るもの)。チャットには貼らない。
// 通信先: https://api.supabase.com(Management API の /v1/projects/{ref}/database/query)。環境のネットワーク設定で許可が要る。
//
// ★安全装置(CLAUDE.md ⑦「既存のデータは絶対に壊さない」)
//   ・流せるのは docs/sql/ の下の、名前が *_APPLY_TEST.sql / *_APPLY.sql / *_VERIFY.sql の3本組だけ。組がそろっていなければ止まる
//   ・予行演習(APPLY_TEST。末尾が rollback;)が通らなければ、本番(APPLY)は流さない
//   ・drop table / truncate / delete from / drop schema / drop database / drop column を含むSQLは、コメントを除いて1つでもあれば流さない
//     (既存の表を消す・中身を消す・列を消す操作は、この道具では絶対にしない。要るときはユーザーが自分で流す)
//   ・--query で流せるのは select / with で始まる読み取りだけ
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..');
const PROJECT_REF='zrzevudkbgtxlbvmuziy';
const API=`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const SQL_DIRS=['docs/sql/rankings','docs/sql/bond-levels','docs/sql'];
const FORBIDDEN=/\b(drop\s+table|truncate\b|delete\s+from|drop\s+schema|drop\s+database|drop\s+column)/i;

const stripComments=sql=>String(sql).replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
const forbiddenIn=sql=>{const m=stripComments(sql).match(FORBIDDEN);return m?m[0]:null;};
const isReadOnly=sql=>/^\s*(select|with)\b/i.test(stripComments(sql))&&!/;\s*\S/.test(stripComments(sql).trim().replace(/;\s*$/,''))
  &&!/\b(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/i.test(stripComments(sql));

const findTrio=name=>{
  const base=String(name).replace(/_(APPLY_TEST|APPLY|VERIFY)(\.sql)?$/i,'');
  for(const dir of SQL_DIRS){
    const files=['APPLY_TEST','APPLY','VERIFY'].map(kind=>path.join(ROOT,dir,`${base}_${kind}.sql`));
    if(files.every(file=>fs.existsSync(file)))return {base,dir,files};
  }
  return null;
};

const runQuery=sql=>{
  const token=process.env.SUPABASE_ACCESS_TOKEN;
  if(!token)throw new Error('環境変数 SUPABASE_ACCESS_TOKEN がありません(環境の設定の「環境変数」に登録し、新しい会話で使う)');
  const result=spawnSync('curl',['-sS','-m','60','-X','POST',API,'-H',`Authorization: Bearer ${token}`,'-H','Content-Type: application/json',
    '--data-binary','@-','-w','\n%{http_code}'],{input:JSON.stringify({query:sql}),encoding:'utf8',maxBuffer:64*1024*1024});
  const lines=(result.stdout||'').trimEnd().split('\n');
  const status=Number(lines.pop());
  const body=lines.join('\n');
  if(result.status!==0)throw new Error(`つながりませんでした: ${(result.stderr||'').trim()}(ネットワーク設定で api.supabase.com の許可が要る)`);
  if(status<200||status>=300)throw new Error(`HTTP ${status}: ${body.slice(0,400)}`);
  try{return JSON.parse(body||'[]');}catch{return body;}
};

const main=()=>{
  const args=process.argv.slice(2);
  if(args[0]==='--query'){
    const sql=args.slice(1).join(' ');
    if(!isReadOnly(sql)){console.log('止めました: --query で流せるのは select / with で始まる読み取り1文だけです');process.exit(2);}
    console.log(JSON.stringify(runQuery(sql),null,1));
    return;
  }
  const name=args.find(arg=>!arg.startsWith('--'));
  if(!name){console.log('使い方: node tools/supabase-apply.js <SQLの名前(例 RHYTHM_TOUCH_DIAG)> [--dry] / --query "<select文>"');process.exit(1);}
  const trio=findTrio(name);
  if(!trio){console.log(`止めました: ${name} の APPLY_TEST / APPLY / VERIFY の3本組が docs/sql/ に見つかりません`);process.exit(2);}
  const [testFile,applyFile,verifyFile]=trio.files;
  const texts=trio.files.map(file=>fs.readFileSync(file,'utf8'));
  for(const [i,text] of texts.entries()){
    const bad=forbiddenIn(text);
    if(bad){console.log(`止めました: ${path.relative(ROOT,trio.files[i])} に「${bad}」があります。消す操作はこの道具では流しません`);process.exit(2);}
  }
  if(!/rollback;\s*$/i.test(stripComments(texts[0]).trim()+'\n')&&!/rollback;\s*$/i.test(texts[0].trim())){
    console.log(`止めました: 予行演習 ${path.relative(ROOT,testFile)} が rollback; で終わっていません`);process.exit(2);
  }
  console.log(`流す順: ${trio.files.map(file=>path.relative(ROOT,file)).join(' → ')}`);
  if(args.includes('--dry'))return;
  const step=(label,file,text)=>{
    try{const rows=runQuery(text);console.log(`OK ${label}(${path.basename(file)}):`,JSON.stringify(rows).slice(0,600));return true;}
    catch(error){console.log(`NG ${label}(${path.basename(file)}): ${error.message}`);return false;}
  };
  if(!step('予行演習',testFile,texts[0])){console.log('予行演習が通らなかったので、本番は流しませんでした(本番には何も残っていません)');process.exit(3);}
  if(!step('本番',applyFile,texts[1])){console.log('本番が通りませんでした。SQL は begin/commit の中で確かめて止まるので、途中までの変更は残りません');process.exit(3);}
  step('確認',verifyFile,texts[2]);
};

module.exports={forbiddenIn,isReadOnly,findTrio,stripComments};
if(require.main===module){
  try{main();}catch(error){console.log(`止めました: ${error.message}`);process.exit(2);}
}
