// 主な画面の短い字(題名・タブ・16字までの札)が、言葉の途中で折れていないかを数える(2026-10-20 改善部の見直し M3)。
//
//   node tools/boot/ja-wrap-check.js
//
// 「継/承」「攻/撃」「スネグーラチ/カ」のように、日本語は既定だとどの文字の間でも折れる。
// 画面の字を1文字ずつの位置で見て行の変わり目を出し、Intl.Segmenter の言葉の切れ目と合わない所を数える。
//   ・数えるのは 30字までの字のうち、題名(h1〜h4)・タブ、または16字までの札。長い文(説明・助手の吹き出し)は
//     日本語ではどこで折れても読めるので数えない。1行に入らないほど長い言葉(10字以上)・英数字だけの言葉も数えない
//   ・最後の行に1〜2字だけ落ちたもの(「ジャック大王があらわれ／た！」)も数える(単語の切れ目だけでは拾えないため)
//   ・ジャックのセリフの吹き出し([data-home-raid-say])は長い文なので数えない。レイドの札(「ジャック大王が／あらわれた！」)は数える(2026-10-20)
//   ・2026-10-21 社長の指示で広げた: 30字より長い文・助手の吹き出しも「最後の行に1〜2字だけ落ちた」は数える(160字まで)。
//     作り手が <wbr> で決めた折り目は、言葉の切れ目として扱う
//     jaWrap が「……」を含む短いかたまりを包む折らない枠([data-ja-keep])の字は、外側の文の一部として数える(2026-10-24)
//   ・見る画面: ヘルプ・プロフィール・マーケットの全部の売り場とタブ・モンヒロビート・曲えらび・HOME・マーケット・ダイヤショップ・
//     神殿・ギフト(長い題名のギフトを並べて)・ミッション・M/B管理・設定・モンヒロバトル(幅320と390)
// 直し方: 字を言葉の切れ目で折る(41-screen-ui.jsx の jaWrap と JA_WRAP_STYLE、マーケットの札は marketNameForWrap)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8964;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise(r => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const SCAN=()=>{const seg=new Intl.Segmenter('ja',{granularity:'word'});const out=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const range=document.createRange();
const visible=(el)=>{const st=getComputedStyle(el);if(st.visibility==='hidden'||st.display==='none'||Number(st.opacity)===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
const byEl=new Map();
for(let n=walker.nextNode();n;n=walker.nextNode()){const t=n.textContent;if(!t||!/[぀-ヿ一-鿿]/.test(t))continue;let el=n.parentElement;if(el&&el.matches('[data-ja-keep]'))el=el.parentElement;if(!el||!visible(el))continue;if(!byEl.has(el))byEl.set(el,[]);byEl.get(el).push(n);}
for(const [el,nodes] of byEl){let text='';const tops=[];
const wbrAt=new Set();for(const n of nodes){const s=n.textContent;if(n.previousSibling&&n.previousSibling.nodeName==='WBR')wbrAt.add(text.length);for(let i=0;i<s.length;i++){range.setStart(n,i);range.setEnd(n,i+1);const rs=range.getClientRects();if(!rs.length){continue;}text+=s[i];tops.push(Math.round(rs[0].top));}}
const plain=text.replace(/\u200B/g,'');const longText=plain.length>30;if(plain.length>160)continue;const inBubble=!!el.closest('[data-bubble-text],[class*="bubble"],[class*="speech"],[data-home-raid-say]');const labelLike=!longText&&!inBubble&&(el.closest('h1,h2,h3,h4,[role=tab]')||plain.length<=16);
// 行の変わり目(文字の上端が大きく下がった所)
const breaks=[];for(let i=1;i<tops.length;i++){if(tops[i]-tops[i-1]>4)breaks.push(i);}
if(!breaks.length)continue;
// 最後の行に1〜2字だけ落ちた(「ジャック大王があらわれ／た！」)。単語の切れ目の道具は「あらわれ」と「た」を別の語として扱うので、
// 言葉の切れ目だけでは拾えない。句読点・かっこ・記号は数えない
{const last=breaks[breaks.length-1];const rest=[...text.slice(last).replace(/[\u200B\s]/g,'')];
 // 見た目の字数(句読点も含む)で2字以下、かつ8字以上の文だけ。「フレーム／なし」のような短い札の折り方は数えない
 if(plain.length>=8&&rest.length>0&&rest.length<=2)out.push({kind:longText||inBubble?'文の最後':'札',fs:getComputedStyle(el).fontSize,w:Math.round(el.getBoundingClientRect().width),word:'(最後の字だけ落ちた)',at:text.slice(Math.max(0,last-8),last)+'/'+text.slice(last),cls:''});}
// 言葉の切れ目
// ひらがな同士の間(「書い|て」「ませ|ん」)は、言葉の切れ目の道具が切れ目と言っても言葉の途中として数える(2026-10-21「まだ書い／ていません」を見逃した)。
// 「の」「を」などの助詞のあとと、<wbr> の所は折ってよい
const hira=c=>/[ぁ-ゖ]/.test(c||'');const bounds=new Set([0,...wbrAt]);let pos=0;for(const s of seg.segment(text)){pos+=s.segment.length;const a=text.slice(0,pos).replace(/\u200B+$/,'').slice(-1),b=text.slice(pos).replace(/^\u200B+/,'')[0];if(hira(a)&&hira(b)&&!/[のをはがにともへ]/.test(a))continue;bounds.add(pos);}
for(const b of breaks){if(!labelLike)break;if(bounds.has(b))continue;// 言葉の途中
// その言葉が1行に入らないほど長いなら数えない(折るしかない)
let st=b,en=b;const arr=[...bounds].sort((a,c)=>a-c);for(const x of arr){if(x<b)st=x;if(x>b){en=x;break;}}
const word=text.slice(st,en).replace(/​/g,'');if(word.length>=10)continue;
if(/^[\x00-\x7f]+$/.test(word))continue;
out.push({fs:getComputedStyle(el).fontSize,w:Math.round(el.getBoundingClientRect().width),word,at:text.slice(Math.max(0,b-8),b)+'/'+text.slice(b,b+8),cls:(el.className&&String(el.className).slice(0,40))||el.tagName});}}
// 商品名の字の並び(2026-10-21「スキップ　・序／チケット」)。名前の字を、画面の上から・左からの順に並べ直しても、元の順と同じか
for(const el of document.querySelectorAll('[data-market-name-text]')){if(!el.parentElement||!visible(el.parentElement))continue;const cs=[];const w2=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
 for(let n=w2.nextNode();n;n=w2.nextNode()){for(let i=0;i<n.textContent.length;i++){range.setStart(n,i);range.setEnd(n,i+1);const rs=range.getClientRects();if(rs.length)cs.push({c:n.textContent[i],top:Math.round(rs[0].top),left:rs[0].left});}}
 const sorted=[...cs].sort((a,b)=>Math.abs(a.top-b.top)>4?a.top-b.top:a.left-b.left);
 if(sorted.map(x=>x.c).join('')!==cs.map(x=>x.c).join(''))out.push({kind:'字の並びが崩れた',fs:getComputedStyle(el).fontSize,w:0,word:'',at:sorted.map(x=>x.c).join(''),cls:''});}
// 画面の文に折り返し用の見えない文字(U+200B)が残っていない(2026-10-21: コピーすると混ざり、文を照らす検査も一致しなくなる。折り目は <wbr> で描く)
{const t=document.body.innerText||'';const k=t.indexOf('\u200B');if(k>=0)out.push({kind:'見えない文字(U+200B)が画面の文にある',fs:'',w:0,word:'',at:t.slice(Math.max(0,k-8),k+8).replace(/\u200B/g,'|'),cls:''});}
// ハロウィンの飾りのかぼちゃ(画面の枠の下の余白の左右の角)の上に、見えている字が乗っていない(2026-10-21 窓口「プロフィールの『助手』の見出しがかぼちゃにかかる」)。
// かぼちゃは枠の下の余白の中だけに描くので、余白の左右の角(左40px・右32px)に見えている字があれば NG。
// 見えているかは、字のうち余白に入った所の1点で elementFromPoint を引いて確かめる(スクロールの枠で切れて余白に出ていない字は数えない)
for(const sh of document.querySelectorAll('[data-mh-theme="halloween"] .mh-screen-shell')){if(!visible(sh))continue;const R=sh.getBoundingClientRect(),pb=parseFloat(getComputedStyle(sh).paddingBottom)||0,top=R.bottom-Math.max(pb,30);
 const w3=document.createTreeWalker(sh,NodeFilter.SHOW_TEXT);
 for(let n=w3.nextNode();n;n=w3.nextNode()){const t=n.textContent;if(!t||!t.trim())continue;for(let i=0;i<t.length;i++){if(!t[i].trim())continue;range.setStart(n,i);range.setEnd(n,i+1);const rs=range.getClientRects();if(!rs.length)continue;const c=rs[0];
  if(c.bottom<=top+1||c.top>=R.bottom)continue;const inCorner=c.left<R.left+40||c.right>R.right-32;if(!inCorner)continue;const py=Math.max((c.top+c.bottom)/2,top+2);if(py>=c.bottom)continue;const hit=document.elementFromPoint((c.left+c.right)/2,py);
  if(hit&&(hit===n.parentElement||n.parentElement.contains(hit))){out.push({kind:'かぼちゃの上に字',fs:'',w:0,word:'',at:`${t.slice(Math.max(0,i-4),i+4)}@${Math.round(c.left)},${Math.round(c.top)}(枠の下${Math.round(R.bottom)}・余白${pb})`,cls:''});break;}}}}
// 短い札(8字以下)が「…」で切れて読めない(2026-10-21「アイコン えらびな…」)
for(const el of document.querySelectorAll('b,small,span,div,button')){const t=(el.innerText||'').replace(/[\u200B\s]/g,'');if(!t||t.length>8||!/[぀-ヿ一-鿿]/.test(t)||el.children.length)continue;
 const st=getComputedStyle(el);if(st.textOverflow!=='ellipsis'||!visible(el))continue;if(el.scrollWidth>el.clientWidth+1)out.push({kind:'「…」で切れた',fs:st.fontSize,w:Math.round(el.clientWidth),word:t,at:t,cls:''});}
return out;};
(async()=>{let chromium;try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}const server=await serve();const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const W of [320,390]){const page=await browser.newPage({viewport:{width:W,height:W===320?568:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.addInitScript(()=>{if(sessionStorage.getItem('s'))return;sessionStorage.setItem('s','1');const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);
// ギフトボックスに長い題名のギフトを並べる(2026-10-21 窓口「ききとの仲良し度 Lv25 のごほ／うび」)。助手4人の仲良し度・お詫び・ログインボーナス・ミッション・イベントの報酬
const r=[{type:'diamond',amount:1}];const g=(id,title,source)=>({id:'jawrap_'+id,title,source,rewards:r,createdAt:new Date().toISOString(),claimedAt:null});
put('mh_gifts',[...['みゅあ','きき','ももすけ','ドラ'].flatMap(n=>[22,25,28,30].map(lv=>g(n+lv,`${n}との仲良し度 Lv${lv} のごほうび`,'assistantBond'))),g('apology','お詫びのしるし','compensation'),g('login','ログインボーナス 7日目','loginBonus'),g('mission','ミッション報酬「ウィークリーコンプリート」','mission'),g('event','第3回 異世界交響祭 の報酬','rhythmEvent')]);});
await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
await page.getByRole('button',{name:'TAP TO START'}).click({force:true});await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
const dismiss=async()=>{for(let i=0;i<14;i++){const did=await page.evaluate(()=>{const inO=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(s.position==='fixed'||(s.position==='absolute'&&Number(s.zIndex)>=40))return true;}return false;};const l=[...document.querySelectorAll('button')].filter(b=>inO(b)&&/^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む)$/.test((b.innerText||'').replace(/\s+/g,' ').trim()));if(!l.length)return false;l[0].click();return true;});if(!did)break;await page.waitForTimeout(300);}};
await dismiss();
const clickText=re=>page.evaluate(p=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(p).test((x.innerText||'').replace(/\s+/g,' ').trim()));if(b)b.click();return !!b;},re);
const screens=[['ヘルプ',['^設定','^ヘルプ']],['プロフィール',['^テスト']],['ダイヤ・アシスト',['^マーケット','ダイヤ ?ショップ','^アシスト$']],['ダイヤ・アイテム',['^マーケット','ダイヤ ?ショップ','^アイテム$']],['ダイヤ・着替え',['^マーケット','ダイヤ ?ショップ','^着替え$']],['ブリーダーP',['^マーケット','ブリーダーP']],['ブリーダーP・フレーム',['^マーケット','ブリーダーP','^フレーム$']],['交換所',['^マーケット','アイテム ?交換']],['ビートP・円盤石',['^マーケット','ビートP ?交換']],['ビートP・アイテム',['^マーケット','ビートP ?交換','^アイテム$']],['ビートP・強化素材',['^マーケット','ビートP ?交換','^強化素材$']],['ビートP・アイコン',['^マーケット','ビートP ?交換','^アイコン$']],['ビートP・着替え',['^マーケット','ビートP ?交換','^着替え$']],['モンヒロビート',['モンヒロビート$']],['曲えらび',['モンヒロビート$','ソロライブ']],['HOME',[]],['マーケット',['^マーケット']],['ダイヤショップ',['^マーケット','ダイヤ ?ショップ']],['神殿',['^神殿']],['ギフト',['^ギフト']],['ミッション',['^ミッション']],['M/B管理',['^M/B管理']],['設定',[]],['モンヒロバトル',['^モンヒロバトル$']]];
for(const [name,steps] of screens){await page.goto(`http://localhost:${PORT}/monster-hero/index.html`).catch(()=>{});
await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});await page.getByRole('button',{name:'TAP TO START'}).click({force:true});await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});await dismiss();
if(name==='設定')await page.evaluate(()=>document.querySelector('button[aria-label="設定"]')?.click());
for(const st of steps){await clickText(st);await page.waitForTimeout(900);await dismiss();}
await page.waitForTimeout(600);const r=await page.evaluate(SCAN);
// ギフトは長い題名のギフトが画面の下にも並ぶので、1枚ずつ見える所へ出して数える(2026-10-21)
if(name==='ギフト'){const n=await page.evaluate(()=>document.querySelectorAll('.mh-gift-card').length);const seen=new Set(r.map(x=>x.at));
  for(let i=0;i<n;i++){await page.evaluate(i=>document.querySelectorAll('.mh-gift-card')[i]?.scrollIntoView({block:'center'}),i);await page.waitForTimeout(80);
    for(const x of await page.evaluate(SCAN)){if(!seen.has(x.at)){seen.add(x.at);r.push(x);}}}
  ok(`幅${W} ギフト: 長い題名のギフトまで見た`,n>=20,`${n}枚`);}
// JA_WRAP_SHOTS=<フォルダ> を付けると、画面ごとの写しを残す(直す前後を見比べる用)
if(process.env.JA_WRAP_SHOTS){fs.mkdirSync(process.env.JA_WRAP_SHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.JA_WRAP_SHOTS,`${W}-${name.replace(/[\/・]/g,'-')}.jpg`),type:'jpeg',quality:60});}
// HOME のレイドの札は、いまの段階の文しか出ないので、段階ごとの文(男爵〜大王・ぱんぷきん)に差し替えて数える(2026-10-20)
if(name==='HOME'){const titles=['ジャック男爵','ジャック子爵','ジャック伯爵','ジャック公爵','ジャック大王'].map(n=>[n,'あらわれた！']).concat([['ぱんぷきん','遊びに来た！']]);
  const has=await page.evaluate(()=>!!document.querySelector('[data-home-raid-jack-title]'));
  if(has){for(const [who,rest] of titles){const rr=await page.evaluate(([who,rest,scanSrc])=>{const el=document.querySelector('[data-home-raid-jack-title]');el.innerHTML='';el.append(who+'が',document.createElement('wbr'),rest);return (new Function('return ('+scanSrc+')'))()();},[who,rest,SCAN.toString()]);
    ok(`幅${W} HOME のレイドの札「${who}が${rest}」が言葉の途中で折れていない`,rr.length===0,rr.map(x=>`「${x.at}」`).join(' / '));}}}ok(`幅${W} ${name}: 札が言葉の途中で折れず、文の最後の1〜2字だけが次の行へ落ちていない`,r.length===0,r.slice(0,4).map(x=>`[${x.kind||'言葉の途中'}]「${x.at}」(${x.fs})`).join(' / '));}
await page.close();}
await browser.close();server.close();
console.log(failed===0?'\nすべてOK':`\n${failed}件NG`);process.exit(failed===0?0:1);})();
