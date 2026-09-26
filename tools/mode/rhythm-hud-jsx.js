// 演奏画面のHUD(<header data-rhythm-hud>)のJSXを、部品を展開した形で取り出す。
// rhythm-hud-wedge-check.js / rhythm-landscape-hud-check.js が、HUDをHTMLへ写して実ブラウザで測るのに使う。
//
// 【なぜ要るか】(2026-09-27)
// スコアとライフの表示は、毎フレームの再描画を減らすため部品(RhythmHudScore / RhythmHudLife)へ分けた。
// <header> の中には <RhythmHudScore …/> の1行しか残らないので、そのまま写すと
// 箱の中身が空になり、測る位置・大きさが実際とずれる(検査は「未変換のJSX式」で落ちていた)。
// ここでは部品の return の中身をその場へ差し込み、変数名を以前の書き方(view.score 等)へ戻す。
// 検査側の置き換え表(SAMPLE へ写すところ)はそのまま使える。
const HUD_PARTS={
  RhythmHudScore:body=>body
    .replace(/rhythmRankForScore\(score\)/g,'rhythmRankForScore(view.score)')
    .replace(/rhythmRankProgress\(score\)/g,'rhythmRankProgress(view.score)')
    .replace(/\{score\.toLocaleString\(\)\}/g,'{view.score.toLocaleString()}')
    .replace(/BEST \{Number\(bestScore\|\|0\)\.toLocaleString\(\)\}/g,'BEST {Number(bestRecord?.bestScore||0).toLocaleString()}'),
  RhythmHudLife:body=>body
    .replace(/\{lifeState==='down'\?'DOWN':life\}/g,"{lifeState==='down'?'DOWN':view.life}")
    .replace(/\{life\}/g,'{view.life}'),
};
// 部品の定義(const 名前=(…)=>{ … return <…>;};)から、return の JSX だけを取り出す
const partJsx=(game,name)=>{
  const at=game.indexOf(`const ${name}=`);
  if(at<0)return null;
  const end=game.indexOf('\n',game.indexOf(';};',at));
  const body=game.slice(at,end);
  const ret=body.indexOf('return <');
  if(ret<0)return null;
  return body.slice(ret+'return '.length,body.lastIndexOf(';};'));
};
// <header data-rhythm-hud>…</header> を取り出し、部品を展開して返す。展開できない部品があれば missing に名前が入る。
// 曲名のとなりのジャケット(hudArtSrc・2026-09-26)は、出ているほう(曲名の幅が縮むほう)で測る。
// 縦向きは曲名の最大幅が絵のぶん縮む(landscape:true の検査では縮めない)
const rhythmHudHeaderJsx=(game,{landscape=false}={})=>{
  const start=game.indexOf('<header data-rhythm-hud');
  if(start<0)return {jsx:'',start,missing:[]};
  const end=game.indexOf('</header>',start)+'</header>'.length;
  const missing=[];
  const jsx=game.slice(start,end).replace(/<(RhythmHud[A-Za-z]+)\b[^>]*\/>/g,(tag,name)=>{
    const body=HUD_PARTS[name]&&partJsx(game,name);
    if(!body){missing.push(name);return tag;}
    return HUD_PARTS[name](body);
  })
    .replace(/\{hudArtSrc&&(<img\b[^>]*\/>)\}/g,'$1')
    .replace(/\s(?:src=\{hudArtSrc\}|draggable=\{false\})/g,'')
    .replace(/maxWidth:hudArtSrc&&!isLandscape\?('[^']*'):undefined,?/g,(_,value)=>landscape?'':`maxWidth:${value},`);
  return {jsx,start,missing};
};
module.exports={rhythmHudHeaderJsx};
