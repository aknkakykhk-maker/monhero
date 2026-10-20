// 主な画面の短い字(題名・タブ・16字までの札)が、言葉の途中で折れていないかを数える(2026-10-20 改善部の見直し M3)。
//
//   node tools/boot/ja-wrap-check.js
//
// 「継/承」「攻/撃」「スネグーラチ/カ」のように、日本語は既定だとどの文字の間でも折れる。
// 画面の字を1文字ずつの位置で見て行の変わり目を出し、Intl.Segmenter の言葉の切れ目と合わない所を数える。
//   ・数えるのは 30字までの字のうち、題名(h1〜h4)・タブ、または16字までの札。長い文(説明・助手の吹き出し)は
//     日本語ではどこで折れても読めるので数えない。1行に入らないほど長い言葉(10字以上)・英数字だけの言葉も数えない
//   ・見る画面: HOME・マーケット・ダイヤショップ・神殿・ギフト・ミッション・M/B管理・設定・モンヒロバトル(幅320と390)
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
for(let n=walker.nextNode();n;n=walker.nextNode()){const t=n.textContent;if(!t||!/[぀-ヿ一-鿿]/.test(t))continue;const el=n.parentElement;if(!el||!visible(el))continue;if(!byEl.has(el))byEl.set(el,[]);byEl.get(el).push(n);}
for(const [el,nodes] of byEl){let text='';const tops=[];
for(const n of nodes){const s=n.textContent;for(let i=0;i<s.length;i++){range.setStart(n,i);range.setEnd(n,i+1);const rs=range.getClientRects();if(!rs.length){continue;}text+=s[i];tops.push(Math.round(rs[0].top));}}
const plain=text.replace(/\u200B/g,'');if(plain.length>30)continue;if(el.closest('[data-bubble-text],[class*="bubble"],[class*="speech"],[class*="mh-rj"]'))continue;if(!(el.closest('h1,h2,h3,h4,[role=tab]')||plain.length<=16))continue;
// 行の変わり目(文字の上端が大きく下がった所)
const breaks=[];for(let i=1;i<tops.length;i++){if(tops[i]-tops[i-1]>4)breaks.push(i);}
if(!breaks.length)continue;
// 言葉の切れ目
const bounds=new Set([0]);let pos=0;for(const s of seg.segment(text)){pos+=s.segment.length;bounds.add(pos);}
for(const b of breaks){if(bounds.has(b))continue;// 言葉の途中
// その言葉が1行に入らないほど長いなら数えない(折るしかない)
let st=b,en=b;const arr=[...bounds].sort((a,c)=>a-c);for(const x of arr){if(x<b)st=x;if(x>b){en=x;break;}}
const word=text.slice(st,en).replace(/​/g,'');if(word.length>=10)continue;
if(/^[\x00-\x7f]+$/.test(word))continue;
out.push({fs:getComputedStyle(el).fontSize,w:Math.round(el.getBoundingClientRect().width),word,at:text.slice(Math.max(0,b-8),b)+'/'+text.slice(b,b+8),cls:(el.className&&String(el.className).slice(0,40))||el.tagName});}}
return out;};
(async()=>{let chromium;try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}const server=await serve();const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const W of [320,390]){const page=await browser.newPage({viewport:{width:W,height:W===320?568:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.addInitScript(()=>{if(sessionStorage.getItem('s'))return;sessionStorage.setItem('s','1');const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);});
await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
await page.getByRole('button',{name:'TAP TO START'}).click({force:true});await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
const dismiss=async()=>{for(let i=0;i<14;i++){const did=await page.evaluate(()=>{const inO=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(s.position==='fixed'||(s.position==='absolute'&&Number(s.zIndex)>=40))return true;}return false;};const l=[...document.querySelectorAll('button')].filter(b=>inO(b)&&/^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む)$/.test((b.innerText||'').replace(/\s+/g,' ').trim()));if(!l.length)return false;l[0].click();return true;});if(!did)break;await page.waitForTimeout(300);}};
await dismiss();
const clickText=re=>page.evaluate(p=>{const b=[...document.querySelectorAll('button')].find(x=>new RegExp(p).test((x.innerText||'').replace(/\s+/g,' ').trim()));if(b)b.click();return !!b;},re);
const screens=[['HOME',[]],['マーケット',['^マーケット']],['ダイヤショップ',['^マーケット','ダイヤ ?ショップ']],['神殿',['^神殿']],['ギフト',['^ギフト']],['ミッション',['^ミッション']],['M/B管理',['^M/B管理']],['設定',[]],['モンヒロバトル',['^モンヒロバトル$']]];
for(const [name,steps] of screens){await page.goto(`http://localhost:${PORT}/monster-hero/index.html`).catch(()=>{});
await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});await page.getByRole('button',{name:'TAP TO START'}).click({force:true});await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});await dismiss();
if(name==='設定')await page.evaluate(()=>document.querySelector('button[aria-label="設定"]')?.click());
for(const st of steps){await clickText(st);await page.waitForTimeout(900);await dismiss();}
await page.waitForTimeout(600);const r=await page.evaluate(SCAN);ok(`幅${W} ${name}: 短い字が言葉の途中で折れていない`,r.length===0,r.slice(0,4).map(x=>`「${x.at}」(${x.fs})`).join(' / '));}
await page.close();}
await browser.close();server.close();
console.log(failed===0?'\nすべてOK':`\n${failed}件NG`);process.exit(failed===0?0:1);})();
