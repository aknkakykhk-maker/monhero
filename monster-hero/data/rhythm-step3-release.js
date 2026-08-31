// 音ゲーデバッグ STEP5 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-08-31 16:17';
  const RHYTHM_DATA_BUILD='2026-08-31 16:17';
  const RHYTHM_COMPILED_BUILD='2026-08-31 10:17';
  const RHYTHM_RELEASE_TITLE='音ゲーデバッグのiPhoneポーズ操作を修正';

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
        'iPhone Safariのポーズ画面で「再開」「中断して音ゲーデバッグへ戻る」が押せない問題を修正しました。',
        'ポーズメニュー3ボタンをtouchendのcapture段階で判定し、リスタートは完全再マウント、再開と中断は元のReact onClickへ安全に橋渡しするよう変更しました。',
        '曲終了後の「もう一度プレイ」とポーズ中の「リスタート」のフリーズ対策はそのまま維持しています。'
      ]
    });
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。ポーズ・リスタート・完走リザルト・端末内BEST保存にも対応し、中断したプレイは記録されません。通常画面には表示されません。iPhone Safariのポーズ画面は「再開」「リスタート」「中断して音ゲーデバッグへ戻る」をtouchendのcapture段階で受け取り、プレイエリア側の入力処理にclickを消されないようにしています。リスタートは古いプレイ画面を破棄して新しいプレイ画面を起動します。'}];
  }
})();
