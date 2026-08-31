// 音ゲーデバッグ STEP3 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-08-31 14:53';
  const RHYTHM_DATA_BUILD='2026-08-31 14:53';
  const RHYTHM_COMPILED_BUILD='2026-08-31 10:17';
  const RHYTHM_RELEASE_TITLE='音ゲーデバッグのレーン表示と再プレイ停止を修正';

  if(typeof window!=='undefined'&&typeof window.fetch==='function'&&!window.__mhRhythmDataBuildBridge){
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await nativeFetch(...args);
      try{
        const input=args[0];
        const rawUrl=typeof input==='string'?input:(input&&input.url)||'';
        if(String(rawUrl).includes('version.json')&&typeof Response!=='undefined'){
          const data=await response.clone().json();
          if(data?.build===RHYTHM_DATA_BUILD){
            const headers=new Headers(response.headers);
            headers.set('content-type','application/json; charset=utf-8');
            return new Response(JSON.stringify({...data,build:RHYTHM_COMPILED_BUILD}),{status:response.status,statusText:response.statusText,headers});
          }
        }
      }catch(_e){}
      return response;
    };
    Object.defineProperty(window,'__mhRhythmDataBuildBridge',{value:true,configurable:false});
  }

  if(typeof CHANGELOG!=='undefined'&&!CHANGELOG.some(entry=>entry?.title===RHYTHM_RELEASE_TITLE)){
    CHANGELOG.unshift({
      date:RHYTHM_RELEASE_DATE,type:'issue',title:RHYTHM_RELEASE_TITLE,status:'new',
      items:[
        'デバッグ中の音ゲーで、5レーン・6本の境界・判定ラインを1枚のSVG座標面から描くようにし、ノーツと入力位置の基準がずれにくい構成へ変更しました。',
        '曲終了後の「もう一度プレイ」とポーズ中の「リスタート」は、前回のプレイ部品を再利用せず、古い音声・入力・描画状態を破棄して新しいプレイを開始する方式へ変更しました。'
      ]
    });
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。ポーズ・リスタート・完走リザルト・端末内BEST保存にも対応し、中断したプレイは記録されません。通常画面には表示されません。デバッグプレイでは、奥ほど細く手前ほど広い5レーン・6本の境界・判定ラインを1枚のSVG座標面で描き、ノーツの上下移動・中心・幅、HOLD／SLIDE帯、タッチ位置も同じ遠近座標を使います。押しているレーンは同じ台形面が発光します。曲終了後の「もう一度プレイ」とポーズ中の「リスタート」は、古いプレイ画面を丸ごと破棄して新しいプレイ画面を起動するため、前回の音声・入力・描画状態を引き継ぎません。'}];
  }
})();
