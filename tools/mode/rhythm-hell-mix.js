#!/usr/bin/env node
// HELL(6段目・空中のノーツあり)を「空と地上が混ざって行き来する」形で作る(2026-10-11・オンプくん。社長の依頼)。
//
//   node tools/mode/rhythm-hell-mix.js --song sheriruth                # 作って数字を出すだけ(書かない)
//   node tools/mode/rhythm-hell-mix.js --song sheriruth --write        # rhythm-mode.js の <曲-v3-hell-notes> の内側と HELL の Lv. だけを書く
//
// 【なぜ要るか】社長「HELL やってみたけどマスターと譜面同じ過ぎてつまらない。空中ノーツをあんまり活かしてない。
//   もっと混ざったりとかそういう難易度の上げ方のほうがいい。空中スライドが地上に降りてきたりとか最初あったけど、なくしたの?」
//   前の HELL は MASTER の写しに空中のタップを足しただけで、空と地上を行き来するスライドが0本だった。
// 【作り方】土台は同じ曲の MASTER(ノーツの時刻・レーンはそのまま。数を増やして難しくしない)。難しさは「空と地上の混ざり方」で上げる。
//   ・スライド(2拍以上): 空から地上へ降りる/地上から空へ上がる/上がって降りる、を順に当てる。行き来は拍の頭から1拍かけて
//   ・タップ: 2小節ごとに「左手が空・右手が地上」「右手が空・左手が地上」「両手とも地上」を回す(片手が空・片手が地上、交互に叩く流れ)
//   ・ホールドとモンスターノーツ(4個)は地上のまま
//   ・同じ親指が段(空⇄地上)を変えるのは、その親指の前のノーツから1.5拍以上あいてから(人が段を見分けて動く時間。前の HELL と同じ決まり)
//   ・左右の手は、横持ちの親指2本のモデル(rhythm-ref-tiers.js の thumbCheck)が MASTER で選んだ振り分けに従う
// 【決めごと】既存曲の譜面は変えない(tools/mode/CLAUDE.md ⑩-2)。書くのはその曲の HELL のマーカーの内側と HELL の Lv. だけ。
//   地上の5難易度のマーカーが1バイトでも変わるなら、書く前に止める。HELL はデバッグ専用(公開の印は触らない)。
'use strict';
const fs=require('fs'),path=require('path');
const rt0=require('./rhythm-runtime-notes.js');
const {thumbCheck,THUMB_PROFILES,simulateRuntime,chartStats}=require('./rhythm-ref-tiers.js');

const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
// crosses: 交差する両手の長押し(片手が空・片手が地上)を入れる所(両手のスライドが重なる所の始まりの時刻・音で選んだ)。
// showcase: MASTER にもともとある交差の見せ場(社長が決めた形・押せないの例外はこの中だけ)
const SONGS={sheriruth:{marker:'sheriruth-v3',zero:711.6-2594.75,beat:324.342,levelRe:/const sheriruthHellChart=mhChart\((\d+),/,
  crosses:[75960,78550,83419],showcase:[[107900,112600],[130200,132100]],drawers:false},
  // 風がそよぐ場所(2026-10-12 社長「もう1曲だけ簡単な曲のヘルも作ってみるのが良いと思う」)。空中のノーツを覚える入口なので gentle:
  // 空中は片手だけが空の小節の、拍の頭のタップだけ(スライド・ホールドは地上のまま・両手が空の小節は作らない)。交差の見せ場は置かない。
  // 土台はいま遊ばれている切り替わったあとの譜面(-v4-・RHYTHM_EVENT の after)
  kaze_ga_soyogu:{marker:'kaze-ga-soyogu-v4',zero:209,beat:60000/118.88,levelRe:/const kazeGaSoyoguHellChart=mhChart\((\d+),/,gentle:true,drawers:false},
  // Against My Own Shadow(2026-10-13 社長「中くらいの HELL」)。拍は解析ファイル(authoring/against-my-own-shadow-v3-audio.json の timing)。
  // crosses は MASTER で両手の長押しが重なる所(10.72・39.23・94.24秒の2本目の始まり)
  against_my_own_shadow:{marker:'against-my-own-shadow-v3',zero:2022.9,beat:419.1788,levelRe:/const againstMyOwnShadowHellChart=mhChart\((\d+),/,
    // 2026-10-13 社長「ヘル用に作り直して」: MASTER を土台にせず、曲の解析から作る(source:'audio')。交差は音から自動で選ぶ
    // crossDepth:-1(前 0.75): 94.2〜94.9秒の左手の空中スライドは、右手の地上スライドの真ん中を越えずに手前1レーン(レーン1.5)で止める。
    //   越えると、交わる所で帯を持ち替える遊び方では親指が空中と地上を入れ替えることになり押せない(テンポくんの bot・持ち替え --freeze 3 で
    //   93.61・94.24秒の2本が3種とも MISS。指を交差させる遊び方 --freeze 0 では MISS 0)。左右が入れ替わらなければ、どちらの遊び方でも押せる
    source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1,drawers:false},
  // ROSE(HANA・2026-10-18 社長「新曲。ショートとフルで両方作って。ヘルもありで」)。拍は解析ファイル(authoring/rose-v3-audio.json・rose-short-v3-audio.json の timing)。
  // 曲の解析から作る(source:'audio')。引き出し(R1〜R5)は曲の区切りを見て道具が使う/使わないを決める(出力に理由が出る)
  rose:{marker:'rose-v3',zero:2116,beat:480,levelRe:/const roseHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  rose_short:{marker:'rose-short-v3',zero:2116,beat:480,levelRe:/const roseShortHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // SAD SONG(2026-10-18 社長「SAD SONG フル、ショート」)。拍は解析ファイル(authoring/sad-song-v3-audio.json の timing。全編と short は同じ格子)
  sad_song:{marker:'sad-song-v3',zero:99.5,beat:348.818,levelRe:/const sadSongHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  sad_song_short:{marker:'sad-song-short-v3',zero:99.5,beat:348.818,levelRe:/const sadSongShortHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // BLACK SHOUT(Roselia・2026-10-21 社長「譜面の新しい作り方で新曲作って」・手の流れを狙う配置 flowPlacement)。拍は解析ファイル(authoring/black-shout-v3-audio.json の timing)
  black_shout:{marker:'black-shout-v3',zero:2285.8,beat:324.2017,levelRe:/const blackShoutHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // Toward the Stars, Paradise or Truth short ver.(hitoyakyuko・2026-10-19・新曲は基本 HELL あり)
  // 全曲ヘル(2026-10-21 社長「全曲ヘルを実装して」)。marker・track は rhythm-runtime-notes.js の RELEASED_MARKERS・RELEASED_TRACKS、拍の頭と1拍は解析の timing
  mf_ichika_mix:{marker:'atsu-cup-theme-v3',track:'atsu_cup_theme',zero:40,beat:355.0296,levelRe:/const mfIchikaMixHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  monster_hero:{marker:'monster-hero-v4',track:'monster_hero_theme',zero:206,beat:346.515,levelRe:/const monsterHeroHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  monster_hero_another:{marker:'monster-hero-theme-alt-v3',track:'monster_hero_theme_alt',zero:1268.3,beat:350.678,levelRe:/const monsterHeroAnotherHellChart=mhChart\((\d+),/,source:'audio',variant:1,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  six_eternel_beat:{marker:'six-eternel-beat-v3',track:'six_eternel_beat',zero:562.4,beat:217.3992,levelRe:/const sixEternelBeatHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  six_eternel_remix:{marker:'six-eternel-remix-beat-v3',track:'six_eternel_remix_beat',zero:1452.6,beat:368.91,levelRe:/const sixEternelRemixHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // 2026-10-21 社長「すてぃうぃずみーだけ上げる」(35ぐらい): 量を少し多めに拾う(hellDensity)
  stay_with_me:{marker:'pandora-boss-v3',track:'pandora_boss',zero:440,beat:352.9619,levelRe:/const stayWithMeHellChart=mhChart\((\d+),/,source:'audio',variant:2,hellDensity:1.02,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  kiki_issen:{marker:'eiki-boss-v3',track:'eiki_boss',zero:188.4,beat:387.07,levelRe:/const kikiIssenHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  close_to_your_heart:{marker:'close-to-your-heart-v4',track:'close_to_your_heart',zero:570.5,beat:461.655,levelRe:/const closeToYourHeartHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  eiki_boss_remix:{marker:'eiki-boss-remix-v3',track:'eiki_boss_remix',zero:992.5,beat:389.196,levelRe:/const eikiBossRemixHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  pandora_boss_remix:{marker:'pandora-boss-remix-v3',track:'pandora_boss_remix',zero:452.7,beat:371.017,levelRe:/const pandoraBossRemixHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  dullahan:{marker:'dullahan-v3',track:'dullahan',zero:602.7,beat:400.002,levelRe:/const dullahanHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  dullahan_clockwork:{marker:'dullahan-clockwork-v3',track:'dullahan_clockwork',zero:99.8,beat:394.732,levelRe:/const dullahanClockworkHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  toriko:{marker:'toriko-v3',track:'toriko',zero:32.2,beat:444.472,levelRe:/const torikoHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  '4u_hitasura':{marker:'4u-hitasura-v3',track:'4u_hitasura',zero:1442.8,beat:413.812,levelRe:/const song4uHitasuraHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  kindan_no_resistance:{marker:'kindan-no-resistance-v3',track:'kindan_no_resistance',zero:76.1,beat:333.339,levelRe:/const kindanNoResistanceHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  crossing_field:{marker:'crossing-field-v3',track:'crossing_field',zero:792.7,beat:335.2517,levelRe:/const crossingFieldHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  nothing_without_you:{marker:'nothing-without-you-v3',track:'nothing_without_you',zero:83.1,beat:309.271,levelRe:/const nothingWithoutYouHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  mou_hitotsu_no_sekai_e:{marker:'mou-hitotsu-no-sekai-e-v3',track:'mou_hitotsu_no_sekai_e',zero:384.1,beat:320,levelRe:/const mouHitotsuNoSekaiEHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  senjou_no_shippuu:{marker:'senjou-no-shippuu-v3',track:'senjou_no_shippuu',zero:321.3,beat:428.676,levelRe:/const senjouNoShippuuHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  makutsu_no_senritsu:{marker:'makutsu-no-senritsu-v3',track:'makutsu_no_senritsu',zero:38,beat:416.9475,levelRe:/const makutsuNoSenritsuHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // 2026-10-21 社長「ざしてぃを60ぐらいまで下げる」: 量を0.78倍に(hellDensity)
  the_city_beneath_the_comets:{marker:'the-city-beneath-the-comets-v3',track:'the_city_beneath_the_comets',zero:1054.3,beat:351.976,levelRe:/const theCityBeneathTheCometsHellChart=mhChart\((\d+),/,source:'audio',variant:3,hellDensity:0.78,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  freedom_dive:{marker:'freedom-dive-v3',track:'freedom_dive',zero:117,beat:270.0027,levelRe:/const freedomDiveHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  only_my_railgun:{marker:'only-my-railgun-v3',track:'only_my_railgun',zero:152.9,beat:419.5804,levelRe:/const onlyMyRailgunHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  big_bridge_no_shitou:{marker:'big-bridge-no-shitou-v3',track:'big_bridge_no_shitou',zero:349.6,beat:337.6097,levelRe:/const bigBridgeNoShitouHellChart=mhChart\((\d+),/,source:'audio',variant:1,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  rising_hope:{marker:'rising-hope-v3',track:'rising_hope',zero:551.7,beat:315.7895,levelRe:/const risingHopeHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  haruka:{marker:'haruka-v3',track:'haruka',zero:104,beat:300.06,levelRe:/const harukaHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  stay_with_me_short:{marker:'stay-with-me-short-v3',track:'stay_with_me_short',zero:474,beat:352.9619,levelRe:/const stayWithMeShortHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  kiki_issen_short:{marker:'kiki-issen-short-v3',track:'kiki_issen_short',zero:234.4,beat:387.0693,levelRe:/const kikiIssenShortHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  crazy_party_night:{marker:'crazy-party-night-v3',track:'crazy_party_night',zero:434.1,beat:468.777,levelRe:/const crazyPartyNightHellChart=mhChart\((\d+),/,source:'audio',variant:1,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  crazy_party_night_full:{marker:'crazy-party-night-full-v3',track:'crazy_party_night_full',zero:456,beat:468.7793,levelRe:/const crazyPartyNightFullHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  emerald_rush:{marker:'emerald-rush-v3',track:'emerald_rush',zero:487.8,beat:396.021,levelRe:/const emeraldRushHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  wrath_of_the_thorn_king:{marker:'wrath-of-the-thorn-king-v3',track:'wrath_of_the_thorn_king',zero:234,beat:424.0073,levelRe:/const wrathOfTheThornKingHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  monster:{marker:'monster-v3',track:'monster',zero:494,beat:444.4115,levelRe:/const monsterHellChart=mhChart\((\d+),/,source:'audio',variant:3,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  monster_short:{marker:'monster-short-v3',track:'monster_short',zero:494,beat:444.4115,levelRe:/const monsterShortHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  // ANiMA・Journey(2026-10-21 社長「ジャーニーとアニマもヘル作って」)。拍の頭と1拍は authoring/<曲>-v3-audio.json の timing。見分けにくい形は山場もなし(mixedWindows なし)
  anima:{marker:'anima-v3',zero:200,beat:326.9755,levelRe:/const animaHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  journey:{marker:'journey-v3',zero:272.3,beat:468.749,levelRe:/const journeyHellChart=mhChart\((\d+),/,source:'audio',variant:0,crosses:'auto',crossUpper:'mover',crossDepth:-1},
  toward_the_stars_short:{marker:'toward-the-stars-short-v3',zero:1390.5,beat:418.796,levelRe:/const towardTheStarsShortHellChart=mhChart\((\d+),/,source:'audio',variant:2,crosses:'auto',crossUpper:'mover',crossDepth:-1,phrases:['L','both','R','both']}};
// mixedWindows:[[開始ms,終わりms],…] または 'peak' … 見分けにくい形(近いレーンで高さの違うノーツが続く)を残してよい山場の区間(2026-10-21)。
//   'peak' はいちばん混んだ区間を1つ選ぶ。合わせて曲の長さの PEAK_SHARE(12%)まで。--peak でその場だけ 'peak' を試せる。
//   書かない曲は入り乱れを作らない(地上⇄空中は指を離した位置へ)。いまある曲はどれも書いていない
// drawers:false … 引き出し(2026-10-16)より前に作った HELL。作り直すときも今の形のまま(使うかは社長が決める)。新しい曲は書かない(=使う)
const BEAT_GAP=1.5;                      // 同じ親指が段を変えるまでの拍
// 同じ側(レーンの左右)で高さ(地上⇔空中)を変えるまでの間(2026-10-12 社長「HELL の操作性をもっと改良して」・テンポくんの数え方)。
// 親指の振り分けとは別に、画面の左半分・右半分ごとに見る。点は押し始めと、長押し・スライドの終わり(指が離れる高さ)。同時押し(0ms)は両手で取るので数えない
const SIDE_GAP_MS=150;
// 地上から空中へ上げる押し始めは、同じ側の地上の点からこれだけあける(テンポくんの「上下が半分しか届かない」条件・rhythm-chart-hand-rules.js の SKY_RAISE_MS)
const SKY_RAISE_MS=require('./rhythm-chart-hand-rules.js').SKY_RAISE_MS;
const PHRASE_BEATS=4;                    // タップの段を回す長さ(1小節)
const PHRASE_MODES=['L','R','ground','both'];   // L=左手が空 / R=右手が空 / ground=両手とも地上 / both=両手が空(同時押しは片方だけ)
const HELL_LANDSCAPE={...THUMB_PROFILES.landscape,name:'横持ち(HELL・高さの差39%)',skyDy:390*0.39};

// MASTER のマーカーを下書きの形へ(t=タップ・h=ホールド・s=スライド)
const readBlock=(source,name)=>{
  const block=rt0.markerBlock(source,name);if(!block)throw new Error(`<${name}-notes> が無い`);
  const notes=[];
  const t=(at,sub,w,mon)=>notes.push({k:'t',t:at,sub,w,sky:0,...(mon?{mon}:{})});
  const h=(at,sub,w,end)=>notes.push({k:'h',t:at,sub,w,end,sky:0});
  const s=(at,end,pts,ef)=>notes.push({k:'s',hand:null,endFlick:!!ef,pts:pts.map(p=>[p[0],p[1],p[2]??2,0,0])});
  // フリック(風がそよぐ場所の MASTER にある)。書いてあった引数のまま書き戻す。HELL では地上のまま(fixedGround)
  const f=(at,sub,w,...rest)=>notes.push({k:'f',t:at,sub,w,args:[at,sub,w,...rest],sky:0});
  new Function('t','h','s','f','return ['+block.body+']')(t,h,s,f);
  return notes;
};
// 曲の解析から HELL の骨組みを作る(2026-10-13 社長「ヘル用に作り直して」「参考動画がない限り、各難易度を難易度ごとにちゃんと作る」)。
//   MASTER の譜面は読まない。譜面を作る道具(rhythm-chart-v3-generate.js)を --difficulty HELL で回し、出た譜面を下書きの形へ直す。
//   時刻への直し方は rhythm-chart-v3-pipeline.js の runtimeRow と同じ(拍の頭+格子×格子の長さ+テンポの揺れ)
const audioDraft=(trackId,variant=0,drawersOn=true,hellDensity=null)=>{
  const os=require('os'),{spawnSync}=require('child_process'),{tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');
  const dashed=trackId.replace(/_/g,'-'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-hell-'));
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--difficulty','HELL','--variant',String(variant),'--output-dir',dir,'--write',...(drawersOn?[]:['--no-drawers']),...(Number.isFinite(hellDensity)?['--hell-density',String(hellDensity)]:[])],{encoding:'utf8'});
  if(r.status!==0)throw new Error('HELL の骨組みを作れなかった: '+String(r.stderr||r.stdout).slice(-400));
  const chart=JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-hell.json`),'utf8'));
  const audio=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring',`${dashed}-v3-audio.json`),'utf8'));
  const timing=audio.timing,gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat,warp=tempoWarpForChart(chart,audio);
  const T=g=>Math.round(timing.beatZeroMs+g*gridMs+warp.at(g));
  const notes=[];
  for(const n of chart.notes){const at=T(n.grid);
    if(n.type==='SLIDE')notes.push({k:'s',hand:null,endFlick:n.endFlick===true,pts:n.slidePoints.map(p=>[T(p.grid),p.lane,p.subLaneWidth??2,0,0])});
    else if(n.type==='HOLD')notes.push({k:'h',t:at,sub:n.subLane,w:n.subLaneWidth,end:T(n.grid+n.durationGrids),sky:0});
    else if(n.type==='FLICK'){const dir=['','left','right'].indexOf(n.flickDir);notes.push({k:'f',t:at,sub:n.subLane,w:n.subLaneWidth,args:[at,n.subLane,n.subLaneWidth,...(dir>0?[dir]:[])],sky:0});}
    else notes.push({k:'t',t:at,sub:n.subLane,w:n.subLaneWidth,sky:0,...(n.monsterSlot?{mon:n.monsterSlot}:{})});}
  fs.rmSync(dir,{recursive:true,force:true});
  // 押しにくさが固まる2つの型を直す(2026-10-13 テンポくんの bot・Against My Own Shadow の作り直し)
  //   ① 幅1のホールドは幅2に(端の細いホールドを、構えのくせで外す。36.29秒)。12サブレーンの中に収める
  //   ② 押さえているホールドのすぐ隣(半レーン未満)のタップ・フリックは、ホールドから離れる向きへ半レーン(サブレーン1つ)ずらす(帯の隣の片寄り。97.70・98.02秒)
  for(const n of notes)if(n.k==='h'&&n.w<2){n.w=2;if(n.sub+n.w>12)n.sub=12-n.w;}
  //   重なっている・端で寄せられないときは、ホールドを1つ細くしてから(幅2まで)、それでも入らなければタップの幅を詰める(幅2まで)
  for(const n of notes){if(n.k!=='t'&&n.k!=='f')continue;
    const h=notes.find(m=>m.k==='h'&&m.t<n.t-2&&n.t<m.end-2);if(!h)continue;
    const right=n.sub+n.w/2>=h.sub+h.w/2;
    for(let r=0;r<3;r++){
      if(right){const want=h.sub+h.w+1;if(n.sub>=want)break;
        if(want+n.w<=12)n.sub=want;else if(h.w>2){h.w-=1;continue;}else if(12-want>=2){n.sub=want;n.w=12-want;}break;}
      else{const want=h.sub-1-n.w;if(n.sub<=want)break;
        if(want>=0)n.sub=want;else if(h.w>2){h.sub+=1;h.w-=1;continue;}else if(h.sub-1>=2){n.sub=0;n.w=h.sub-1;}break;}}
    if(n.args){n.args[1]=n.sub;n.args[2]=n.w;}}
  // 横持ちの物差し(HELL・高さの差39%)で「押せない」と出るタップは取り除く(譜面を作る道具の両手のシミュレートより厳しい。
  //   同時に来る2つの間が0〜0.5レーン・反対の手がふさがったまま真ん中を越える、など。2026-10-13 Against My Own Shadow で10件)
  for(let r=0;r<40;r++){const th=thumbCheck(notes,HELL_LANDSCAPE,timing.beatMs);const bad=th.issues.find(i=>i.kind==='impossible'&&/タップ/.test(i.what));if(!bad)break;
    const k=notes.findIndex(n=>(n.k==='t'||n.k==='f')&&!n.mon&&Math.abs(n.t-bad.t)<=2);if(k<0)break;notes.splice(k,1);}
  // モンスターノーツは1〜4番がそろっていること(骨組みで欠けた番号があれば、前後のモンスターノーツの間の真ん中に一番近い、
  //   同時押しでない地上のタップに付ける。2026-10-21 ROSE(short) の HELL で3個になった)
  {const dur=Math.max(...notes.map(startOf)),monAt=f=>notes.filter(m=>m.mon&&f(m.mon)).map(m=>m.t);
    for(let slot=1;slot<=4;slot++){if(notes.some(n=>n.mon===slot))continue;
      const prev=Math.max(0,...monAt(s=>s<slot)),next=Math.min(dur,...monAt(s=>s>slot)),mid=(prev+next)/2;
      const solo=notes.filter(n=>n.k==='t'&&!n.sky&&!n.mon&&n.t>prev&&n.t<next&&!notes.some(m=>m!==n&&Math.abs(startOf(m)-n.t)<=1))
        .sort((x,y)=>Math.abs(x.t-mid)-Math.abs(y.t-mid));
      if(solo[0])solo[0].mon=slot;}}
  return notes;};
// 画面のどちら側か(ノーツの真ん中のレーン座標が 3 より左なら左)。スライドは始まりと終わりで見る
const sideOf=(n,end)=>{const c=n.k==='s'?n.pts[end?n.pts.length-1:0][1]+0.5:(n.sub+n.w/2)/2;return c<3?'L':'R';};
const startOf=n=>n.k==='s'?n.pts[0][0]:n.t,endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const laneAt=(pts,at)=>{if(at<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(at<=pts[i][0]){const r=(at-pts[i-1][0])/Math.max(1,pts[i][0]-pts[i-1][0]);return pts[i-1][1]+(pts[i][1]-pts[i-1][1])*r;}return pts[pts.length-1][1];};

// 引き出し(2026-10-16 社長の決定・rhythm-chart-drawers.js の R3・R4・R5)。曲の解析(audio の区切りと盛り上がり)を見て、合う曲・合う区間にだけ使う。
//   drawers:false の曲(引き出しより前に作った HELL)は使わない(作り直すときに社長が決める)。--drawers で試しに使う・--no-drawers で使わない
const D=require('./rhythm-chart-drawers.js');
// 2本のスライドが重なる間に左右が入れ替わるか(両方を空にすると同じ高さの交差=水平クロスになる。HELL では作らない)
const lanesCross=(a,b)=>{const s0=Math.max(startOf(a),startOf(b)),e0=Math.min(endOf(a),endOf(b));if(e0-s0<=0)return false;
  let sign=0;for(let k=0;k<=8;k++){const at=s0+(e0-s0)*k/8,d=laneAt(a.pts,at)-laneAt(b.pts,at);if(Math.abs(d)<.5)return true;const g=Math.sign(d);if(sign&&g!==sign)return true;sign=g;}
  return false;};
// 山場の区間を1つ選ぶ(mixedWindows:'peak')。押し始めの数がいちばん多い、曲の長さの PEAK_SHARE の区間
const PEAK_SHARE=.12;
const peakWindows=master=>{const ts=master.map(startOf).sort((a,b)=>a-b);if(!ts.length)return [];
  const len=(Math.max(...master.map(endOf))-ts[0])*PEAK_SHARE;let best=[ts[0],ts[0]+len],bestN=0;
  for(let i=0,j=0;i<ts.length;i++){while(j<ts.length&&ts[j]<=ts[i]+len)j++;if(j-i>bestN){bestN=j-i;best=[ts[i],ts[i]+len];}}
  return [best.map(Math.round)];};
const mix=(master,{zero,beat,crosses=[],gentle=false,crossUpper='hold',crossDepth=null,audio=null,drawersOn=false,drawerIds=null,phrases=null,mixedWindows=null,keepMixed=false})=>{
  const want=id=>drawersOn&&audio&&(!drawerIds||drawerIds.includes(id));
  // 格子へ寄せる。元の譜面に近い時刻(3ms以内)があればその時刻を使う(丸め方が1ms違うと、2本のスライドの間がその瞬間だけ詰まる)
  const chartTimes=[...new Set(master.flatMap(n=>n.k==='s'?n.pts.map(p=>p[0]):[n.t,n.end].filter(x=>x!=null)))].sort((a,b)=>a-b);
  const Q=beat/4,snap=at=>{const g=Math.round(zero+Math.round((at-zero)/Q)*Q);const near=chartTimes.find(x=>Math.abs(x-g)<=3);return near!=null?near:g;};
  const hands=thumbCheck(master,THUMB_PROFILES.landscape,beat).hands;
  const handOf=n=>n.hand||hands.get(n)||((n.k==='s'?n.pts[0][1]+0.5:(n.sub+n.w/2)/2)<3?'L':'R');
  const notes=master.map(n=>n.k==='s'?{...n,hand:handOf(n),pts:n.pts.map(p=>p.slice())}:{...n,hand:handOf(n)});
  // スライドの形: 2拍以上は「降りる・上がる・上がって降りる」を順に。短いものは段の回し方に従う(行き来しない)
  const PROFILES=['down','up','hill'];let slideIndex=0;
  // R4(引き出し): 同じ勢いが続く区切りでは、長めの回し(左手が空 ⇄ 右手が空)。使う区切りは下で決める
  let r4Windows=[],r4Beats=0;
  const phraseOf=at=>{const w=r4Windows.find(([a,b])=>at>=a&&at<b);if(w)return ['L','R'][Math.floor((at-w[0])/(beat*r4Beats))%2];return phraseBase(at);};
  // phrases: 曲の設定で回し方を上書きする(2026-10-18・Toward the Stars の HELL を重くする。書いた曲だけ・書いていない曲は今までの4つの回し)
  const modes=Array.isArray(phrases)&&phrases.length&&phrases.every(m=>PHRASE_MODES.includes(m))?phrases:PHRASE_MODES;
  const phraseBase=at=>modes[((Math.floor((at-zero)/(beat*PHRASE_BEATS))%modes.length)+modes.length)%modes.length];
  // gentle: 拍の頭(3ms 以内)のタップだけを空にする・両手が空の小節は片手(その音の手)だけ
  const onBeat=at=>{const k=(at-zero)/beat;return Math.abs(k-Math.round(k))*beat<=3;};
  const wantSky=(n)=>{const m=phraseOf(startOf(n));
    if(gentle)return n.k==='t'&&onBeat(n.t)&&m===n.hand;
    return m==='both'||m===n.hand;};
  // 引き出しを選ぶ(使う/使わないと理由は notes.drawers に残り、表示に出る)
  const drawerLog=[];
  const slideList=()=>notes.filter(n=>n.k==='s').map(n=>({hand:n.hand,start:startOf(n),end:endOf(n),n}));
  const r4=want('R4')?D.chooseR4(audio,{gentle}):null;
  if(r4){drawerLog.push(r4);if(r4.use){r4Windows=r4.windows;r4Beats=r4.phraseBeats;}}
  const fixedGround=n=>n.k==='h'||n.k==='f'||!!n.mon||!!n.pin;   // pin: 同じ側の高さの切り替えを避けるため段を固定したタップ(空中のこともある。前後は fix・backFix がその段へそろえる)
  // 交差する両手の長押し(2026-10-11 社長「スカイホールドのダブルで右と左で地上と空中でクロスさせるのもいれたいね」)。
  // 両手のスライドが重なる所で、真ん中に近いほうを横に動かない空中の長押し、もう片方を地上で空中の長押しの下をくぐって反対側へ渡らせる。
  // 渡るのは重なりの真ん中の1拍。遊ぶ人は交差のところで指を置き換える(右で押していたものが左指に変わる)。2本の形は固定し、前後のタップを合わせる
  const crossWindows=[];
  // crosses:'auto'(2026-10-13・HELL を曲の解析から作るとき): 左右の手のスライドが0.3秒以上重なる所を、時刻の順に4秒以上あけて最大6か所選ぶ
  const crossList=crosses==='auto'?(()=>{const out=[];const sl=notes.filter(n=>n.k==='s').sort((a,b)=>startOf(a)-startOf(b));
    for(let i=0;i<sl.length;i++)for(let j=i+1;j<sl.length;j++){const a=sl[i],b=sl[j];if(a.hand===b.hand)continue;
      const s0=Math.max(startOf(a),startOf(b)),e0=Math.min(endOf(a),endOf(b));if(e0-s0<300)continue;
      if(notes.filter(n=>n.k==='s'&&startOf(n)<=s0+5&&endOf(n)>=s0+5).length!==2)continue;
      if(out.every(t=>Math.abs(t-s0)>=4000))out.push(s0);}
    return out.sort((x,y)=>x-y).slice(0,6);})():crosses;
  for(const at of crossList){
    const pair=notes.filter(n=>n.k==='s'&&startOf(n)<=at+5&&endOf(n)>=at+5);
    if(pair.length!==2||pair[0].hand===pair[1].hand)throw new Error(`${at}ms に左右のスライド2本が無い(交差の長押しを置けない)`);
    const a=Math.max(...pair.map(startOf)),b=Math.min(...pair.map(endOf));
    const lanes=pair.map(n=>laneAt(n.pts,a)),k=Math.abs(lanes[0]-2.5)<Math.abs(lanes[1]-2.5)||(Math.abs(lanes[0]-2.5)===Math.abs(lanes[1]-2.5)&&pair[0].hand==='R')?0:1;
    const hold=pair[k],mover=pair[1-k],L0=Math.round(lanes[k]*4)/4,x0=lanes[1-k],side=x0<L0?-1:1;
    // 越える深さ: 今までは元の間隔と同じだけ反対側へ(1レーン以上)。動く帯が空中のとき(crossUpper:'mover')は1レーンまで
    //   (深く越えると、越えた指が相手の親指に寄る。Against My Own Shadow の 39〜41秒で 1.5レーン越えて 43〜57px・テンポくんの bot)
    //   crossDepth(交差ごとの深さの並び)を書いた曲は、その値(Against My Own Shadow の2つめは 0.5・越えた先で左手の親指の線に寄ったため)
    //   負の値は越えない(相手の帯の真ん中の手前その分で止める・左右が入れ替わらない。Against My Own Shadow は -1)
    const ci=crossList.indexOf(at),depth=crossUpper==='mover'?(Array.isArray(crossDepth)&&Number.isFinite(crossDepth[ci])?crossDepth[ci]:Number.isFinite(crossDepth)?crossDepth:1):Math.max(1,Math.abs(x0-L0));
    const xEnd=Math.max(0,Math.min(5,Math.round((L0-side*depth)*4)/4));
    // 越える瞬間: 今までは重なりの真ん中。動く帯が空中のとき(crossUpper:'mover')は、重なりの終わりの約0.33秒前に寄せて、交差したままの時間を短くする
    //   (交差が長いと、越えた指が相手の親指に寄ったまま。Against My Own Shadow の 39〜41秒・テンポくんの bot)
    const mid=(a+b)/2,crossAt=crossUpper==='mover'?Math.max(mid,b-330):mid,c0=snap(crossAt-beat/2),c1=Math.min(snap(crossAt+beat/2),b);
    // 横に動かないのは両手が重なってから(それより前は元の通り道。前から止めると、同じ時刻の反対の手のタップと重なることがある)
    const holdLane=t=>t<a?Math.round(laneAt(hold.pts,t)*1000)/1000:L0;
    hold.pts=[...new Set([...hold.pts.map(p=>p[0]),a])].sort((x,y)=>x-y).filter(t=>t>=startOf(hold)&&t<=endOf(hold)).map(t=>[t,holdLane(t),hold.pts[0][2],1,0]);hold.profile='sky';hold.fixed=true;
    // 同じ手の次が地上に固定のノーツ(ホールド・モンスター)で近いときは、渡り終えたあとの最後の1拍で地上へ降ろす(段を変える間 1.5拍を守る)
    const holdEnd=endOf(hold),nextFixed=notes.filter(n=>n!==hold&&n.hand===hold.hand&&startOf(n)>holdEnd&&(n.k==='h'||n.mon)).sort((x,y)=>startOf(x)-startOf(y))[0];
    if(nextFixed&&startOf(nextFixed)-holdEnd<(BEAT_GAP+3)*beat&&holdEnd-snap(mid+beat/2)>=beat/2-2){const d0=Math.max(snap(holdEnd-beat),snap(mid+beat/2));
      hold.pts=[...hold.pts.filter(p=>p[0]<d0),[d0,L0,hold.pts[0][2],1,0],...hold.pts.filter(p=>p[0]>d0)].map(p=>[p[0],p[1],p[2],p[0]<=d0?1:Math.max(0,1-(p[0]-d0)/(holdEnd-d0)),0]);
      hold.pts=hold.pts.map(p=>[p[0],p[1],p[2],Math.round(p[3]*4)/4,0]);hold.profile='custom';}
    // 空中の長押しが重なりより前から始まるときは、地上から始めて重なりの始まりまでに空へ上げる(押さえたまま上がるので、段を変える間の決まりに当たらない)
    if(startOf(hold)<a-2){const r0=Math.max(startOf(hold),snap(a-beat));
      const pts2=[...new Set([...hold.pts.map(p=>p[0]),r0,a])].sort((x,y)=>x-y).map(t=>{const old=hold.pts.find(p=>p[0]===t);return [t,old?old[1]:holdLane(t),hold.pts[0][2],old?old[3]:1,0];});
      hold.pts=pts2.map(p=>[p[0],p[1],p[2],p[0]<=r0?(p[0]===startOf(hold)&&r0===startOf(hold)?1:0):p[0]>=a?p[3]:Math.round((p[0]-r0)/(a-r0)*4)/4,0]);
      if(r0===startOf(hold))hold.pts[0][3]=0;
      hold.profile='custom';}
    const laneOf=t=>t<a?laneAt(mover.pts,t):t<=c0?x0:t>=c1?xEnd:x0+(xEnd-x0)*(t-c0)/(c1-c0);
    const times=[...new Set([...mover.pts.map(p=>p[0]),a,c0,c1].filter(t=>t>=startOf(mover)&&t<=endOf(mover)))].sort((x,y)=>x-y);
    mover.pts=times.map(t=>[t,Math.round(laneOf(t)*1000)/1000,mover.pts[0][2],0,0]);mover.profile='ground';mover.fixed=true;
    // crossUpper:'mover'(2026-10-13〜・HELL の交差は上の帯が越える): 上下を入れ替え、横へ動いて越える帯を空中、止まっている帯を地上にする。
    //   止まっている空中の帯の下を地上の帯がくぐると、くぐった親指が上の親指の腹に当たる(Grievous Lady HELL の調べ・docs/playbot/shots/2026-10-13-gl-hell-cross/)。
    //   動く帯は、重なりの1拍前から重なりの始まりまでに地上から空へ上げる。書かない曲(Sheriruth・風がそよぐ場所)は今までどおり
    if(crossUpper==='mover'){
      hold.pts=hold.pts.map(p=>[p[0],p[1],p[2],0,0]);hold.profile='ground';
      const r0=Math.max(startOf(mover),snap(a-beat));
      mover.pts=[...new Set([...mover.pts.map(p=>p[0]),r0])].sort((x,y)=>x-y).map(t=>{const o=mover.pts.find(p=>p[0]===t);const lane=o?o[1]:Math.round(laneAt(mover.pts,t)*1000)/1000;
        const sky=t>=a?1:t<=r0?(r0===startOf(mover)&&t===r0?1:0):Math.round((t-r0)/Math.max(1,a-r0)*4)/4;return [t,lane,mover.pts[0][2],sky,0];});
      mover.profile='custom';}
    crossWindows.push([a-120,b+120]);   // 押せない・交差の例外は両手が重なっている所だけ
  }
  for(const n of notes){
    if(n.fixed)continue;
    // gentle のスライドは地上のまま形を固定する(あとの段の直しで空へ上げない)
    if(n.k==='s'&&gentle){n.profile='ground';n.fixed=true;}
    else if(n.k==='s'){n.profile=endOf(n)-startOf(n)>=2*beat-2?PROFILES[slideIndex++%PROFILES.length]:(wantSky(n)?'sky':'ground');}
    else n.want=fixedGround(n)?0:(wantSky(n)?1:0);
  }
  // R3(引き出し): 空中スライドの見せ場。いちばん盛り上がる区切りの、両手のスライド(1拍以上)を空のまま通す(交差の長押しの形は触らない)
  // R5(引き出し): 盛り上がったまま終わる曲は、最後の左右のスライドを床から空へ上げて締める
  //   どちらも、重なる反対の手のスライドと左右が入れ替わる(両方空だと水平クロスになる)ものは空にしない
  const airborne=[];
  // 同じ親指で詰まって(1.5拍未満の間で)続く鎖の中に、段の違う固定のノーツ(ホールド・モンスター・形を固定したスライド)があるときは空にしない
  //   (固定どうしで段を変える間を守れず、段の直しが行ったり来たりして収まらない。sideFix の lockedClash と同じ考え)
  const lockedLevel=(m,atEnd)=>m.k==='h'||m.mon?0:m.k==='s'&&m.fixed?(airborne.includes(m)?(atEnd?1:(m.profile==='up'?0:1)):(m.pts[atEnd?m.pts.length-1:0][3]>=.5?1:0)):null;
  const nearLocked=(n,profile)=>{const list=notes.filter(m=>m.hand===n.hand).sort((x,y)=>startOf(x)-startOf(y)),i=list.indexOf(n),g=BEAT_GAP*beat-2;
    const startLevel=profile==='up'?0:1;
    for(let j=i-1;j>=0&&startOf(list[j+1])-endOf(list[j])<g;j--){const lv=lockedLevel(list[j],true);if(lv!=null){if(lv!==startLevel)return true;break;}}
    for(let j=i+1;j<list.length&&startOf(list[j])-endOf(list[j-1])<g;j++){const lv=lockedLevel(list[j],false);if(lv!=null){if(lv!==1)return true;break;}}
    return false;};
  const lift=(n,profile)=>{if(n.fixed||nearLocked(n,profile))return false;if(airborne.some(m=>m.hand!==n.hand&&lanesCross(m,n)))return false;n.profile=profile;n.fixed=true;airborne.push(n);return true;};
  {
    const r3=want('R3')?D.chooseR3(audio,slideList(),{gentle}):null;if(r3)drawerLog.push(r3);
    if(r3&&r3.use){r3.lifted=0;for(const x of slideList().filter(x=>x.start>=r3.window[0]&&x.start<r3.window[1]&&x.end-x.start>=beat-2).sort((a,b)=>a.start-b.start))if(lift(x.n,'sky'))r3.lifted++;}
    const lastMs=Math.max(...notes.map(endOf));
    const r5=want('R5')?D.chooseR5(audio,slideList(),lastMs,{gentle}):null;if(r5)drawerLog.push(r5);
    if(r5&&r5.use){r5.lifted=0;for(const x of r5.slides)if(lift(x.n,x.end-x.start>=2*beat-2?'up':'sky'))r5.lifted++;r5.slides=r5.slides.map(x=>({hand:x.hand,start:x.start,end:x.end}));}
  }
  // 同時押しは片方だけ空(両手が空の回では、右手を地上に残す)
  const byTime=new Map();for(const n of notes)if(n.k!=='s'){const k=n.t;byTime.set(k,[...(byTime.get(k)||[]),n]);}
  for(const g of byTime.values())if(g.length>1&&g.every(n=>n.want===1))g.filter(n=>n.hand==='R').forEach(n=>{n.want=0;});
  // スライドの高さを形どおりに置く(行き来は真ん中の拍の頭から1拍)
  const shape=(n,profile)=>{
    if(profile==='custom')return;   // 交差の長押しで高さを点ごとに決めたもの
    const a=startOf(n),b=endOf(n),pts=n.pts.map(p=>[p[0],p[1],p[2],0,0]);
    const levelAt=at=>{const mid=snap((a+b)/2),down=[mid-beat/2,mid+beat/2];
      const ramp=(x,u,v)=>x<=u?0:x>=v?1:(x-u)/(v-u);
      if(profile==='sky')return 1;if(profile==='ground')return 0;
      if(profile==='down')return 1-ramp(at,down[0],down[1]);
      if(profile==='up')return ramp(at,down[0],down[1]);
      const q1=snap(a+(b-a)/3),q2=snap(a+2*(b-a)/3);return Math.min(ramp(at,q1-beat/2,q1+beat/2),1-ramp(at,q2-beat/2,q2+beat/2));};
    // 行き来の区間には16分ごとに点を足す(高さの変わり目で道がとぎれないように)
    const extra=[];if(profile!=='sky'&&profile!=='ground')for(let at=snap(a)+Q;at<b-1;at=Math.round(at+Q)){const at2=snap(at);if(!pts.some(p=>Math.abs(p[0]-at2)<2))extra.push([at2,laneAt(n.pts,at2),pts[0][2],0,0]);}
    const all=[...pts,...extra].sort((x,y)=>x[0]-y[0]).map(p=>[p[0],Math.round(p[1]*1000)/1000,p[2],Math.round(levelAt(p[0])*4)/4,0]);   // 足した点のレーンは元の線の上(丸めると2本の間が詰まる)
    // 同じ高さ・同じレーンが続く点は間引く(始まりと終わりは残す)
    n.pts=all.filter((p,i,A)=>i===0||i===A.length-1||!(A[i-1][1]===p[1]&&A[i+1][1]===p[1]&&A[i-1][3]===p[3]&&A[i+1][3]===p[3]));
  };
  // 親指ごとに時刻順で、段を変える間(1.5拍)を守る。守れないタップは前の段のまま、スライドは前の段から始まる形へ替える
  const gap=BEAT_GAP*beat-2;
  // スライドの始まり・終わりの段。交差の2本(形を点ごとに決めたもの)は点の高さから読む
  const START={down:1,up:0,hill:0,sky:1,ground:0},END={down:0,up:1,hill:0,sky:1,ground:0};
  const sLv=n=>n.profile in START?START[n.profile]:(n.pts[0][3]>=0.5?1:0),eLv=n=>n.profile in END?END[n.profile]:(n.pts[n.pts.length-1][3]>=0.5?1:0);
  const fix=()=>{let changed=0;
    for(const h of ['L','R']){let prevEnd=-1e9,prevLevel=0;
      for(const n of notes.filter(m=>m.hand===h).sort((x,y)=>startOf(x)-startOf(y))){
        const close=startOf(n)-prevEnd<gap;
        if(n.k==='s'){
          const startLevel=sLv(n);
          if(close&&startLevel!==prevLevel&&!n.fixed){n.profile={down:'up',up:'down',hill:'sky',sky:'ground',ground:'sky'}[n.profile];if(n.profile==='sky'&&prevLevel===0)n.profile='ground';changed++;}
          prevLevel=eLv(n);
        }else{
          if(close&&n.want!==prevLevel){if(fixedGround(n)){/* 地上に固定のノーツの前は、下で後ろから直す */}else{n.want=prevLevel;changed++;}}
          prevLevel=n.want;
        }
        prevEnd=endOf(n);
      }}
    return changed;};
  // 地上に固定のノーツ(ホールド・モンスター)の直前に空があれば、そのタップを地上へ戻す(前から順に何度か回す)
  const backFix=()=>{let changed=0;
    for(const h of ['L','R']){const list=notes.filter(m=>m.hand===h).sort((x,y)=>startOf(x)-startOf(y));
      for(let i=list.length-1;i>0;i--){const n=list[i],p=list[i-1];
        const nStart=n.k==='s'?sLv(n):n.want,pEnd=p.k==='s'?eLv(p):p.want;
        if(startOf(n)-endOf(p)<gap&&nStart!==pEnd){
          if(p.k!=='s'&&!fixedGround(p)){p.want=nStart;changed++;}
          else if(p.k==='s'&&!p.fixed){p.profile={down:'hill',up:'ground',hill:'up',sky:'down',ground:'up'}[p.profile];if(nStart===0&&(p.profile==='up'||p.profile==='sky'))p.profile=p.profile==='up'?'hill':'down';changed++;}
          else if(n.k!=='s'&&!fixedGround(n)){n.want=pEnd;changed++;}
        }}}
    return changed;};
  // 同じ側(レーンの左右)の続く2点で、150ms 以内に高さが変わる所を直す。空中を減らしすぎないよう、タップは前の点の高さにそろえ(前が空なら空のまま)、
  // タップで直せないときだけスライドの形を替える
  // そのタップをこの段にしても、同じ親指の前後のノーツと段を変える間(1.5拍)を守れるか
  const handOk=(n,level)=>{const list=notes.filter(m=>m.hand===n.hand).sort((x,y)=>startOf(x)-startOf(y)),i=list.indexOf(n),p=list[i-1],q=list[i+1];
    const pEnd=p&&(p.k==='s'?eLv(p):p.k==='h'?0:p.want),qStart=q&&(q.k==='s'?sLv(q):q.k==='h'?0:q.want);
    return !(p&&startOf(n)-endOf(p)<gap&&pEnd!==level)&&!(q&&startOf(q)-endOf(n)<gap&&qStart!==level);};
  const sideFix=()=>{let changed=0;
    const ev=[];for(const n of notes){ev.push({n,at:startOf(n),end:false,side:sideOf(n,false)});if(n.k!=='t')ev.push({n,at:endOf(n),end:true,side:sideOf(n,true)});}
    const lv=e=>e.n.k==='s'?(e.end?eLv(e.n):sLv(e.n)):e.n.k==='h'?0:e.n.want;
    // スライドの片方の端だけ段を替える(もう片方の端と、行き来の形はなるべく残す)
    const reshape=(n,s0,e0)=>s0===1&&e0===0?'down':s0===0&&e0===1?'up':s0===1&&e0===1?'sky':['hill','down','up'].includes(n.profile)?'hill':'ground';
    // 段を固定する(タップは pin、スライドは端の段を決めて形を固定)。固定したものの前後は fix・backFix が親指の決まりどおりその段へそろえる
    // 同じ親指で詰まって(1.5拍未満の間で)続くノーツの鎖の中に、段の違う固定のノーツ(ホールド・モンスター・固定したタップやスライド)があると、
    // 固定どうしで親指の決まりを破り、fix と backFix が行ったり来たりするので固定しない
    const lockedClash=(n,startLevel,endLevel=startLevel)=>{const list=notes.filter(m=>m.hand===n.hand).sort((x,y)=>startOf(x)-startOf(y)),i=list.indexOf(n);
      const locked=m=>m.k==='t'||m.k==='h'?fixedGround(m):m.fixed;
      const lvS=m=>m.k==='s'?sLv(m):m.k==='h'?0:m.want,lvE=m=>m.k==='s'?eLv(m):m.k==='h'?0:m.want;
      for(let j=i-1;j>=0&&startOf(list[j+1])-endOf(list[j])<gap;j--)if(locked(list[j])){if(lvE(list[j])!==startLevel)return true;break;}
      for(let j=i+1;j<list.length&&startOf(list[j])-endOf(list[j-1])<gap;j++)if(locked(list[j])){if(lvS(list[j])!==endLevel)return true;break;}
      return false;};
    const pinTo=(x,level)=>{const n=x.n;
      if(n.k==='t'&&!n.mon&&!n.pin&&!lockedClash(n,level)){n.want=level;n.pin=true;return true;}
      if(n.k==='s'&&!n.fixed){const s0=x.end?sLv(n):level,e0=x.end?level:eLv(n);if(lockedClash(n,s0,e0))return false;n.profile=reshape(n,s0,e0);n.fixed=true;return true;}
      return false;};
    for(const side of ['L','R']){const list=ev.filter(e=>e.side===side).sort((a,b)=>a.at-b.at||(a.end?-1:1));
      for(let i=1;i<list.length;i++){
        // 比べる相手は、同時の点(和音の相手)を飛ばした、その前の点(同じ側で同時に地上と空中を押す和音も、手前の地上から数える)
        let j=i-1;while(j>0&&list[i].at-list[j].at<=2)j--;
        const p=list[j],e=list[i],d=e.at-p.at;
        // 下ろす・長押しの終わりは SIDE_GAP_MS、地上から空中の押し始めへ上げるのは SKY_RAISE_MS
        const limit=!e.end&&lv(p)===0&&lv(e)===1?Math.max(SIDE_GAP_MS,SKY_RAISE_MS):SIDE_GAP_MS;
        if(p.n===e.n||d<=0||d>limit||lv(p)===lv(e))continue;
        // 手前の同時の点のどれかが同じ高さなら、その高さの指がある(和音で押し分けている)ので直さない
        if(list.some(q=>q!==e&&q.n!==e.n&&Math.abs(q.at-p.at)<=2&&lv(q)===lv(e)))continue;
        // まず、タップを相手の段にそろえる(同じ親指の前後とも段がそろうときだけ。前が空なら空のまま残る)
        if(!e.end&&e.n.k==='t'&&!fixedGround(e.n)&&handOk(e.n,lv(p))){e.n.want=lv(p);changed++;continue;}
        if(!p.end&&p.n.k==='t'&&!fixedGround(p.n)&&handOk(p.n,lv(e))){p.n.want=lv(e);changed++;continue;}
        // そろえられないときは、地上の側を空中へ上げて固定する(空中を減らさない)。上げられないもの(ホールド・モンスター・交差の形)なら、空中の側を地上へ固定する
        // どちらで固定するかは、試しに当てて親指の決まりまで直し切ったあとの空中の数が多いほう(固定は1つでも、前後のフレーズごと地上へ連なって下りることがある)
        const [low,high]=lv(e)===1?[p,e]:[e,p];
        const snap=()=>notes.map(n=>[n.want,n.pin,n.profile,n.fixed]),restore=v=>notes.forEach((n,k)=>{[n.want,n.pin,n.profile,n.fixed]=v[k];});
        const skyAmount=()=>notes.reduce((a,n)=>a+(n.k==='t'?n.want:n.k==='s'?sLv(n)+eLv(n):0),0);
        const before=snap();let best=null;
        for(const [x,level] of [[low,1],[high,0]]){
          if(!pinTo(x,level)){restore(before);continue;}
          let settled=false;for(let r=0;r<40;r++)if(!fix()&&!backFix()){settled=true;break;}
          const score=settled?skyAmount():-1;restore(before);
          if(score>=0&&(!best||score>best.score))best={x,level,score};}
        if(best&&pinTo(best.x,best.level))changed++;
      }}
    return changed;};
  for(let i=0;i<40;i++){const a=fix(),b=backFix(),c=sideFix();if(!a&&!b&&!c)break;}
  for(const n of notes){if(n.k==='s')shape(n,n.profile);else n.sky=n.want;delete n.want;delete n.fixed;delete n.profile;}
  // 押さえている帯の中(同じ高さで重なる・幅1が絡む半レーン)に来るタップ・フリックを、帯の外へ出す(2026-10-13 社長「ホールド・スライド中に同じところにノーツを出すのはやめたほうがいい」)。
  //   置き直し方は共通の物差し(rhythm-chart-hand-rules.js の fixHeldBand): 時刻はそのまま、帯を押さえていない手の側へ。入らないものは取り除く(モンスターノーツは左右を反対側へ写す)。
  //   0件の曲(Sheriruth・風がそよぐ場所)では何もしない
  const bandFix=()=>{const HR=require('./rhythm-chart-hand-rules.js'),rt=notes.map(n=>{const r=toRuntime([n])[0];Object.defineProperty(r,'src',{value:n});return r;});
    const res=HR.fixHeldBand(rt,{canRemove:r=>!r.src.mon,canMirror:r=>!!r.src.mon&&!r.src.mirrored});
    for(const r of rt)if((r.type==='TAP'||r.type==='FLICK')&&(r.src.sub!==r.subLane||r.src.w!==r.subLaneWidth)){const n=r.src;if(n.mon&&r.subLane===12-n.sub-n.w&&r.subLaneWidth===n.w)n.mirrored=true;n.sub=r.subLane;n.w=r.subLaneWidth;if(n.args){n.args[1]=n.sub;n.args[2]=n.w;}}
    for(const r of res.removed)notes.splice(notes.indexOf(r.src),1);
    return res.moved+res.removed.length+res.mirrored;};
  bandFix();
  // 最後の手直し(2026-10-13 Against My Own Shadow で、上の直しで残った所があった): 共通の物差し(rhythm-chart-hand-rules.js)で
  // 同じ側の150ms以内の高さの切り替え・地上から250ms以内の空中が残っていれば、そこに関わる空中のタップ(モンスター以外)を地上へ下ろす。
  // 残りが0の曲(Sheriruth・風がそよぐ場所)では何もしない(出力は1文字も変わらない)
  {const HR=require('./rhythm-chart-hand-rules.js');
    for(let r=0;r<60;r++){const rt=toRuntime(notes),res=[...HR.sideHeightSwitch(rt),...HR.skyAfterGround(rt)];if(!res.length)break;
      let moved=false;
      for(const v of res){const side=v.side;
        // その時刻の点と、同じ側でその直前の点のうち、空中のタップを下ろす(その時刻のものを先に)
        const cands=notes.filter(n=>n.k==='t'&&n.sky&&!n.mon&&sideOf(n)===side&&n.t<=v.at+2&&n.t>=v.at-Math.max(SIDE_GAP_MS,SKY_RAISE_MS)-2).sort((a,b)=>Math.abs(b.t-v.at)>Math.abs(a.t-v.at)?-1:1);
        if(cands.length){cands[0].sky=0;moved=true;break;}
        // タップが無ければ、その時刻の近くで空中で終わる・空中から始まるスライドの端を地上へ下ろす(交差の区間のものは触らない)
        const W=Math.max(SIDE_GAP_MS,SKY_RAISE_MS)+2,inCross=t=>(crossWindows||[]).some(([a,b])=>t>=a&&t<=b);
        const sl=notes.find(n=>n.k==='s'&&!inCross(startOf(n))&&((Math.abs(endOf(n)-v.at)<=W&&n.pts[n.pts.length-1][3]>=0.5&&sideOf(n,true)===side)||(Math.abs(startOf(n)-v.at)<=2&&n.pts[0][3]>=0.5&&sideOf(n)===side)));
        if(sl){if(Math.abs(startOf(sl)-v.at)<=2&&sl.pts[0][3]>=0.5)sl.pts[0][3]=0;else sl.pts[sl.pts.length-1][3]=0;moved=true;break;}}
      if(!moved)break;}}
  // 地上と空中の見分けにくさ(2026-10-21 社長「地上と空中が近辺で入り混じってるのがあるけどこれかなり難易度高い」「気安くいれていい譜面の形ではない」
  //   「空中地上は基本は指を離した位置に置くのが基本」「見分けづらいってのが相当難易度高いんだよ」)。
  //   重なって見える近いレーンへ、短い間に高さの違うノーツ(rhythm-chart-hand-rules.js の skyConfusable)は、曲の山場(mixedWindows)の中にだけ残し、
  //   外のものは関わる空中のタップ(モンスター以外)を地上へ下ろす。指を離した位置への持ち上げ・下ろしは数えないのでそのまま。--keep-mixed で止められる(比べるときだけ)
  if(!keepMixed){const HR=require('./rhythm-chart-hand-rules.js'),allowed=t=>(mixedWindows||[]).some(([a,b])=>t>=a&&t<=b);
    for(let r=0;r<400;r++){const res=HR.skyConfusable(toRuntime(notes)).filter(v=>!allowed(v.at));if(!res.length)break;
      let moved=false;
      for(const v of res){for(const x of [v.note,v.prev]){if(x.type!=='TAP'||!(x.skyHeight>0)||x.monsterSlot)continue;
          const cand=notes.find(n=>n.k==='t'&&n.sky&&!n.mon&&Math.abs(n.t-x.timeMs)<=1&&n.sub===x.subLane);
          if(cand){cand.sky=0;moved=true;break;}}
        if(moved)break;}
      // 下ろせない(空中の側が長押し・スライド・モンスターノーツ)ときは、相手の地上のタップ・フリックを抜く。
      //   地上の側がモンスターノーツなら、抜かずに左右を反対側へ写す(1曲に4個の決まり・1つにつき1回だけ)。2026-10-21 社長「残りも直す」
      if(!moved)for(const v of res){for(const x of [v.note,v.prev]){if(x.skyHeight>0||(x.type!=='TAP'&&x.type!=='FLICK'))continue;
          const k=notes.findIndex(n=>(n.k==='t'||n.k==='f')&&!n.sky&&Math.abs(n.t-x.timeMs)<=1&&n.sub===x.subLane);if(k<0)continue;
          const g=notes[k];
          if(!g.mon){notes.splice(k,1);moved=true;break;}
          if(!g.mirrored){g.sub=12-g.sub-g.w;if(g.hand)g.hand=g.hand==='L'?'R':'L';g.mirrored=true;moved=true;break;}}
        if(moved)break;}
      // どちらも長押し(スライド・ホールド)の組は、地上で始まるほうを抜く(2026-10-21 Journey の HELL で、空中から降りるスライドの
      //   468ms 後に、近い所から地上のスライドが始まる組が1つ残った。上の2つはタップ・フリックしか見ていない)
      if(!moved)for(const v of res){for(const x of [v.note,v.prev]){if(x.skyHeight>0||(x.type!=='SLIDE'&&x.type!=='HOLD'))continue;
          if(x.type==='SLIDE'&&x.slidePoints&&x.slidePoints[0]&&x.slidePoints[0].sky>=.5)continue;
          const k=notes.findIndex(n=>(n.k==='s'&&Math.abs(startOf(n)-x.timeMs)<=1&&n.pts[0][3]<.5&&Math.abs(n.pts[0][1]-x.lane)<.01)||(n.k==='h'&&Math.abs(n.t-x.timeMs)<=1&&n.sub===x.subLane));
          if(k>=0){notes.splice(k,1);moved=true;break;}}
        if(moved)break;}
      // 相手がモンスターノーツで写しても残るとき(2026-10-21 Stay With Me short: 空中のスライドのあと 441ms で地上のモンスターノーツ)は、
      //   空中で始まるスライドを抜く(モンスターノーツは1曲に4個の決まり)
      if(!moved)for(const v of res){for(const x of [v.note,v.prev]){if(x.type!=='SLIDE'||!x.slidePoints||!x.slidePoints[0]||!(x.slidePoints[0].sky>=.5))continue;
          const k=notes.findIndex(n=>n.k==='s'&&Math.abs(startOf(n)-x.timeMs)<=1&&n.pts[0][3]>=.5&&Math.abs(n.pts[0][1]-x.lane)<.01);
          if(k>=0){notes.splice(k,1);moved=true;break;}}
        if(moved)break;}
      if(!moved)break;}}
  // 空中を付けたあとにも、横持ちの物差しで「押せない」と出る地上のタップ・フリックが交差の区間の外に残っていれば取り除く
  //   (骨組みのときと手の割り振りが変わって見えることがある。0件の曲では何もしない)
  for(let r=0;r<20;r++){const th=thumbCheck(notes,HELL_LANDSCAPE,beat);
    // タップだけでなく、ホールド・スライドが押せない所も見る(2026-10-21 全曲ヘル: SIX ÉTERNEL remix・綺季一閃 remix・The City Beneath the Comets・
    //   Wrath of the Thorn King で、ふさがった手のスライドの始まり・同じ指の叩き直しのホールドが1つずつ残った)
    const bad=th.issues.find(i=>i.kind==='impossible'&&!crossWindows.some(([a,b])=>i.t>=a&&i.t<=b));if(!bad)break;
    let k=notes.findIndex(n=>(n.k==='t'||n.k==='f')&&!n.mon&&!n.sky&&Math.abs(n.t-bad.t)<=2);
    // その時刻に地上のタップが無く、空中のタップが押せない所を作っているときは、空中のタップを抜く(2026-10-21 ANiMA・Journey の HELL で
    //   空中の連打が163ms・118ms で3レーン以上を跳ぶ所が2つずつ残った。地上のタップだけを見ていたので取り残されていた)
    if(k<0)k=notes.findIndex(n=>n.k==='t'&&n.sky&&!n.mon&&Math.abs(n.t-bad.t)<=2);
    // モンスターノーツは1曲に4個の決まりがあるので取り除かず、左右を反対側へ写す(ふさがっていない手の側へ)
    if(k<0){const m=notes.find(n=>n.k==='t'&&n.mon&&!n.sky&&Math.abs(n.t-bad.t)<=2&&!n.mirrored);
      if(m){m.sub=12-m.sub-m.w;m.hand=m.hand==='L'?'R':'L';m.mirrored=true;continue;}}
    // それでも無ければ、その時刻に始まるホールド・スライドを抜き、無ければその時刻にかかっているスライドを抜く
    if(k<0)k=notes.findIndex(n=>(n.k==='h'||n.k==='s')&&Math.abs(startOf(n)-bad.t)<=2);
    if(k<0)k=notes.findIndex(n=>n.k==='s'&&startOf(n)<bad.t&&bad.t<=endOf(n));
    if(k<0)break;
    notes.splice(k,1);}
  // 上の手直しで高さや置き場所が変わって、帯の中のノーツがまた出ていれば、もう一度外へ出す
  bandFix();
  for(const n of notes)delete n.mirrored;
  notes.crossWindows=crossWindows;
  // 引き出しが手直しのあとまで残ったか(空中の点がある本数)
  for(const d of drawerLog){if(d.id==='R3'&&d.use){const w=d.window;d.kept=notes.filter(n=>n.k==='s'&&startOf(n)>=w[0]&&startOf(n)<w[1]&&n.pts.some(p=>p[3]>=.5)).length;}
    if(d.id==='R5'&&d.use)d.kept=d.slides.filter(x=>notes.some(n=>n.k==='s'&&n.hand===x.hand&&startOf(n)===x.start&&n.pts[n.pts.length-1][3]>=.5)).length;}
  notes.drawers=drawerLog;
  return notes;
};

// 段を変える間の違反(同じ親指で、前のノーツの終わりから1.5拍未満に段が変わる)
const levelSwitchViolations=(notes,beat)=>{const out=[];
  const startLv=n=>n.k==='s'?(n.pts[0][3]>=0.5?1:0):(n.sky?1:0),endLv=n=>n.k==='s'?(n.pts[n.pts.length-1][3]>=0.5?1:0):(n.sky?1:0);
  for(const h of ['L','R']){const list=notes.filter(n=>n.hand===h).sort((a,b)=>startOf(a)-startOf(b));
    for(let i=1;i<list.length;i++)if(startLv(list[i])!==endLv(list[i-1])&&startOf(list[i])-endOf(list[i-1])<BEAT_GAP*beat-2)out.push(startOf(list[i]));}
  return out;};
// 同じ側(レーンの左右)の続く2点で、SIDE_GAP_MS 以内に高さが変わる所(同時押しは除く)。テンポくんの数え方
const sideSwitches=notes=>{const out=[],lv=(n,e)=>n.k==='s'?(n.pts[e?n.pts.length-1:0][3]>=0.5?1:0):(n.sky?1:0);
  const ev=[];for(const n of notes){ev.push({n,at:startOf(n),e:false});if(n.k!=='t')ev.push({n,at:endOf(n),e:true});}
  for(const side of ['L','R']){const l=ev.filter(x=>sideOf(x.n,x.e)===side).sort((a,b)=>a.at-b.at||(a.e?-1:1));
    for(let i=1;i<l.length;i++){const p=l[i-1],x=l[i],d=x.at-p.at;if(p.n!==x.n&&d>0&&d<=SIDE_GAP_MS&&lv(p.n,p.e)!==lv(x.n,x.e))out.push(x.at);}}
  return out.sort((a,b)=>a-b);};
const counts=notes=>{const slides=notes.filter(n=>n.k==='s');
  const kind=s=>{const hs=s.pts.map(p=>p[3]);return hs.every(x=>x===0)?'地上だけ':hs.every(x=>x>0)?'空だけ':'行き来';};
  const c={地上タップ:notes.filter(n=>n.k==='t'&&!n.sky).length,空タップ:notes.filter(n=>n.k==='t'&&n.sky).length,ホールド:notes.filter(n=>n.k==='h').length,
    スライド:slides.length,地上だけ:0,空だけ:0,行き来:0,モンスター:notes.filter(n=>n.mon).length};
  for(const s of slides)c[kind(s)]++;return c;};
// 引き出しを使って、手の決まりの数(同じ側の150ms・地上から250ms・段を変える間・水平クロス)が増えるなら、増えない組み合わせまで外す
//   (2026-10-16 Freedom Dive を試したとき、R3 で同じ側の150ms が7→17件になった。引き出しは曲に合うときだけ使う)
const handRuleScore=(notes,beat)=>{const HR=require('./rhythm-chart-hand-rules.js'),rt=toRuntime(notes);
  return sideSwitches(notes).length+levelSwitchViolations(notes,beat).length+HR.flatCross(rt).length+HR.skyAfterGround(rt).length;};
const mixBest=(master,opts)=>{
  const copy=()=>JSON.parse(JSON.stringify(master));
  if(!opts.drawersOn||!opts.audio)return mix(master,opts);
  const plain=mix(copy(),{...opts,drawersOn:false}),base=handRuleScore(plain,opts.beat);
  const all=(opts.drawerIds||['R3','R4','R5']).slice();
  let ids=all,out=mix(copy(),{...opts,drawerIds:ids}),score=handRuleScore(out,opts.beat);
  const dropped=[];
  // 使ったもの(use)を1つずつ外して、元より増えない所まで戻す(最後に使ったものから)
  while(score>base){const used=(out.drawers||[]).filter(d=>d.use&&ids.includes(d.id)).map(d=>d.id);if(!used.length)break;
    let best=null;for(const id of used){const next=ids.filter(x=>x!==id),o=mix(copy(),{...opts,drawerIds:next}),sc=handRuleScore(o,opts.beat);if(!best||sc<best.sc)best={id,next,o,sc};}
    dropped.push({id:best.id,from:score,to:best.sc});ids=best.next;out=best.o;score=best.sc;}
  const log=out.drawers||[];
  for(const d of dropped){const old=log.find(x=>x.id===d.id);const entry={id:d.id,use:false,reason:`曲には合うが、使うと手の決まりの数が増える(引き出し無し ${base}件 → 使うと ${d.from}件)ので使わない`};
    if(old)Object.assign(old,entry,{lifted:undefined,kept:undefined});else log.push(entry);}
  out.drawers=log.sort((a,b)=>a.id.localeCompare(b.id));
  return out;};
// 書き出し(t=地上タップ・h=ホールド・T=空中のタップ・S=手の決まったスライド[時刻,レーン,幅,高さ,なめらかさ])
const render=notes=>{const items=notes.slice().sort((a,b)=>startOf(a)-startOf(b)||(a.k==='s'?1:-1)).map(n=>
  n.k==='s'?`S(${startOf(n)},${endOf(n)},${JSON.stringify(n.pts)},${n.endFlick?1:0},'${n.hand}')`
  :n.k==='h'?`h(${n.t},${n.sub},${n.w},${n.end})`
  :n.k==='f'?`f(${n.args.join(',')})`
  :n.sky?`T(${n.t},${n.sub},${n.w},1)`:`t(${n.t},${n.sub},${n.w},${n.mon||0})`);
  const lines=[];for(let i=0;i<items.length;i+=4)lines.push('  '+items.slice(i,i+4).join(',')+',');
  // 改行から始める(目印の行 // <…-hell-notes> にくっつくと、最初の行がコメントとして読み飛ばされる・2026-10-12 に4ノーツ落ちていたのを直した)
  return '\n'+lines.join('\n')+'\n';};
// ゲームのノーツの形(レベルの式・両手のシミュレートへ渡す)
const toRuntime=notes=>notes.map(n=>n.k==='s'?{type:'SLIDE',timeMs:startOf(n),endTimeMs:endOf(n),lane:n.pts[0][1],endLane:n.pts[n.pts.length-1][1],subLaneWidth:n.pts[0][2],hand:n.hand,
  slidePoints:n.pts.map(p=>({timeMs:p[0],lane:p[1],subLaneWidth:p[2],sky:p[3]}))}
  :n.k==='h'?{type:'HOLD',timeMs:n.t,endTimeMs:n.end,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w}
  :n.k==='f'?{type:'FLICK',timeMs:n.t,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w}
  :{type:'TAP',timeMs:n.t,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w,...(n.sky?{skyHeight:1}:{}),...(n.mon?{monsterSlot:n.mon}:{})}).sort((a,b)=>a.timeMs-b.timeMs);

if(require.main===module){
  try{
    const songId=argOf('--song');
    // SONGS に無い曲でも、解析ファイルがあれば曲の解析から試しに作れる(数字を出すだけ・書けない。新しい曲の HELL を考えるとき)
    const trialAudio=!SONGS[songId]&&songId&&path.join(__dirname,'authoring',`${String(songId).replace(/_/g,'-')}-v3-audio.json`);
    const conf=SONGS[songId]||(trialAudio&&fs.existsSync(trialAudio)?(()=>{const tm=JSON.parse(fs.readFileSync(trialAudio,'utf8')).timing;
      return {marker:`${songId.replace(/_/g,'-')}-v3`,zero:tm.beatZeroMs,beat:tm.beatMs,source:'audio',crosses:'auto',crossUpper:'mover',trial:true};})():null);
    if(!conf)throw new Error(`--song は ${Object.keys(SONGS).join('/')} のどれか(または解析ファイルのある曲を試しに)`);
    if(conf.trial&&args.includes('--write'))throw new Error('SONGS に無い曲は試すだけ(--write は SONGS に足してから)');
    const source=fs.readFileSync(rt0.RUNTIME,'utf8');
    // source:'audio' の曲は MASTER を読まず、曲の解析から HELL の骨組みを作る(before は比べるための MASTER)
    // 引き出し(rhythm-chart-drawers.js)。drawers:false の曲は使わない。--drawers で試しに使う(書くのは社長が決めてから)・--no-drawers で使わない
    const drawersOn=args.includes('--drawers')||(conf.drawers!==false&&!args.includes('--no-drawers'));
    // 解析ファイルの名前は曲の名前と違う曲がある(mf_ichika_mix=atsu_cup_theme など)。SONGS の track に書く(書かなければ曲の名前)
    const trackId=conf.track||songId;
    const audioFile=path.join(__dirname,'authoring',`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    const audio=fs.existsSync(audioFile)?JSON.parse(fs.readFileSync(audioFile,'utf8')):null;
    const master=conf.source==='audio'?audioDraft(trackId,argOf('--variant')!=null?Number(argOf('--variant')):(conf.variant||0),drawersOn,argOf('--hell-density')!=null?Number(argOf('--hell-density')):(Number.isFinite(conf.hellDensity)?conf.hellDensity:null)):readBlock(source,`${conf.marker}-master`);
    const before=rt0.markerBlock(source,`${conf.marker}-master`)?readBlock(source,`${conf.marker}-master`):master;
    const oldHell=conf.trial?null:rt0.markerBlock(source,`${conf.marker}-hell`);
    // mixedWindows(見分けにくい形を残してよい山場の区間・2026-10-21)。'peak' はいちばん混んだ区間を1つ選ぶ。どちらも合わせて曲の長さの PEAK_SHARE まで
    const mixedWindows=(args.includes('--peak')?'peak':conf.mixedWindows)==='peak'?peakWindows(master):(conf.mixedWindows||[]);
    {const span=Math.max(1,Math.max(...master.map(endOf))-Math.min(...master.map(startOf))),used=mixedWindows.reduce((a,[x,y])=>a+(y-x),0);
      if(used>span*PEAK_SHARE+1)throw new Error(`mixedWindows は合わせて曲の長さの${Math.round(PEAK_SHARE*100)}%まで(山場だけ・docs/rules/CHART_ENGINE.md「HELL の地上と空中の入り乱れ」)`);}
    const hell=mixBest(master,{...conf,mixedWindows,audio,drawersOn,drawerIds:argOf('--drawers-only')?argOf('--drawers-only').split(','):null,keepMixed:args.includes('--keep-mixed')});
    for(const d of hell.drawers||[])console.log(`引き出し ${D.drawerLine(d)}${d.use&&d.lifted!=null?`(空へ上げた ${d.lifted}本・手直しのあと${d.id==='R3'?'区間の中で空を通るスライド':'空で終わる'} ${d.kept}本)`:''}`);
    if(!drawersOn)console.log('引き出し: 使わない(この曲は drawers:false。試すときは --drawers)');
    const {chartLevel}=require('./rhythm-chart-level.js');
    const rt=toRuntime(hell),level=chartLevel({notes:rt}).level,mLevel=chartLevel({notes:toRuntime(before)}).level;
    const windows=[...(conf.showcase||[]),...(hell.crossWindows||[])],inWin=t=>windows.some(([a,b])=>t>=a&&t<=b);
    const th0=thumbCheck(hell,HELL_LANDSCAPE,conf.beat),outside=th0.issues.filter(i=>i.kind!=='busy'&&!inWin(i.t));
    const th={count:{impossible:outside.filter(i=>i.kind==='impossible').length,cross:outside.filter(i=>i.kind==='cross').length,reach:outside.filter(i=>i.kind==='reach').length},issues:outside};
    console.log(`交差の区間(見せ場 ${(conf.showcase||[]).length}・両手の長押し ${(hell.crossWindows||[]).length}): `+windows.map(([a,b])=>`${(a/1000).toFixed(2)}〜${(b/1000).toFixed(2)}`).join(' / ')
      +` | 区間の中(わざと) ${th0.issues.filter(i=>i.kind!=='busy'&&inWin(i.t)).length}件`);
    const sim=simulateRuntime(rt.filter(n=>!(n.skyHeight>0)&&!(n.slidePoints&&n.slidePoints.some(p=>p.sky>0))));
    const viol=levelSwitchViolations(hell,conf.beat);
    console.log('数:',JSON.stringify(counts(hell)));
    {const HR=require('./rhythm-chart-hand-rules.js'),cf=HR.skyConfusable(rt),inMix=t=>mixedWindows.some(([a,b])=>t>=a&&t<=b),out=cf.filter(v=>!inMix(v.at));
      console.log(`${HR.SKY_CONFUSE_LABEL} ${cf.length}件(山場の区間 ${mixedWindows.map(([a,b])=>`${(a/1000).toFixed(1)}〜${(b/1000).toFixed(1)}`).join(' / ')||'なし'} の中 ${cf.length-out.length}・外 ${out.length})`
        +` 重さの合計 ${cf.reduce((a,v)=>a+v.score,0).toFixed(1)}・指を離した位置への持ち上げ/下ろし ${HR.skyMixedSwitch(rt).filter(v=>v.kind==='near').length}件`
        +(out.length?': '+out.slice(0,12).map(v=>(v.at/1000).toFixed(2)).join(' / ')+' ← 下ろせなかった(モンスターノーツ・長押し)':''));}
    const ss=sideSwitches(hell);console.log(`同じ側で${SIDE_GAP_MS}ms以内に高さが変わる ${ss.length}件`+(ss.length?': '+ss.map(t=>(t/1000).toFixed(2)).join(' / '):''));
    // 共通の物差し(rhythm-chart-hand-rules.js・検査 rhythm-chart-hand-rules-check.js と同じ数え方)で、ほかの手の決まりも出す(作り方は変えない・目安)
    {const HR=require('./rhythm-chart-hand-rules.js'),res=HR.analyze(rt);
      for(const k of ['skyAfterGround','besideHeldBand'])console.log(`  目安: ${HR.RULE_LABELS[k]} ${res[k].length}件`+(res[k].length?': '+res[k].slice(0,12).map(x=>(x.at/1000).toFixed(2)).join(' / ')+(res[k].length>12?' …':''):''));
      {const fc=HR.flatCross(rt);console.log(`  ${HR.FLAT_CROSS_LABEL} ${fc.length}件`+(fc.length?': '+fc.map(x=>`${(x.at/1000).toFixed(2)}(${x.level})`).join(' / ')+' ← HELL の交差は上下に分ける(書いたあと rhythm-chart-hand-rules-check.js が NG にする)':''));}
      {const hb=HR.heldBandBlocked(rt);console.log(`  ${HR.ON_HELD_BAND_LABEL} ${hb.length}件`+(hb.length?': '+hb.map(x=>`${(x.at/1000).toFixed(2)}(${HR.HELD_BAND_KINDS[x.kind]})`).join(' / ')+' ← 書いたあと rhythm-chart-hand-rules-check.js が NG にする':''));}
      if(res.sideHeightSwitch.length!==ss.length)console.log(`  ※ 共通の物差しでは ${res.sideHeightSwitch.length}件(ゲームの形へ写したあとで数えたため)`);}
    console.log(`Lv.${level}(MASTER Lv.${mLevel}) | 横持ち(高さの差39%・交差の区間の外) 押せない${th.count.impossible}・交差${th.count.cross}・届きにくい${th.count.reach} | 両手のシミュレート(地上だけ) 押せない${sim.impossible} | 同じ親指が1.5拍未満で段を変える ${viol.length}`);
    if(th.count.impossible||th.count.cross||th.count.reach)console.log('  横持ち:',th.issues.filter(i=>i.kind!=='busy').slice(0,12).map(i=>`${(i.t/1000).toFixed(2)} ${i.kind} ${i.what} ${i.why}`).join(' / '));
    if(!args.includes('--write')){console.log('※ --write を付けると HELL のマーカーの内側と Lv. だけを書く');process.exit(0);}
    let next=source.slice(0,oldHell.from)+render(hell)+source.slice(oldHell.to);
    next=next.replace(conf.levelRe,m=>m.replace(/\(\d+,/,`(${level},`));
    // 地上の5難易度(とほかの曲)のマーカーが1バイトも変わっていないこと
    const names=t=>[...t.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)].map(m=>m[1]).filter(n=>n!==`${conf.marker}-hell`);
    const bad=names(source).filter(n=>(rt0.markerBlock(source,n)||{}).body!==(rt0.markerBlock(next,n)||{}).body);
    if(bad.length)throw new Error(`HELL のほかのマーカーまで変わりそうなので止めた: ${bad.join(' ')}`);
    fs.writeFileSync(rt0.RUNTIME,next);
    // Lv. はゲームに読み込んだ形(道の上へ置き直したあと)で式を通した値にする。社長の値(rhythm-chart-level.js の LEVEL_OVERRIDES)があればそちら(rhythm-chart-level-check.js が同じ値か見る)
    const {spawnSync}=require('child_process');
    const probe=spawnSync(process.execPath,['-e',`const {loadRuntimeSongs,chartLevel}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});
      const {shownLevel}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});const s=(loadRuntimeSongs().RHYTHM_PROTO_SONGS||[]).find(x=>x.songId===${JSON.stringify(songId+'_hell_debug')});console.log(shownLevel(s.songId,'HELL',s.difficulties.HELL));`],{encoding:'utf8'});
    const runtimeLevel=Number(String(probe.stdout).trim());
    let finalLevel=level;
    if(Number.isFinite(runtimeLevel)&&runtimeLevel!==level){finalLevel=runtimeLevel;fs.writeFileSync(rt0.RUNTIME,fs.readFileSync(rt0.RUNTIME,'utf8').replace(conf.levelRe,m=>m.replace(/\(\d+,/,`(${runtimeLevel},`)));}
    // 書いた譜面をゲームに読み込んだ形で数え直し、道具の数(上の「見分けにくい所」)と食い違えば止める(2026-10-21 Journey の HELL で、
    //   同時のノーツの並び順のせいで道具の形では0・ゲームの形では2と食い違った)。見分けにくい所は rhythm-chart-hand-rules-check.js も見る
    {const probe2=spawnSync(process.execPath,['-e',`const {loadRuntimeSongs}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});
      const HR=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-hand-rules.js'))});const s=(loadRuntimeSongs().RHYTHM_PROTO_SONGS||[]).find(x=>x.songId===${JSON.stringify(songId+'_hell_debug')});
      console.log(HR.skyConfusable(s.difficulties.HELL.notes).length);`],{encoding:'utf8'});
      const HR=require('./rhythm-chart-hand-rules.js'),inTool=HR.skyConfusable(rt).length,inGame=Number(String(probe2.stdout).trim());
      if(!Number.isFinite(inGame)||inGame!==inTool)throw new Error(`書いた譜面をゲームの形で数え直すと、見分けにくい所が ${inGame}件(道具では ${inTool}件)。数え方か書き方がずれている`);
      console.log(`書いた譜面をゲームの形で数え直した: 見分けにくい所 ${inGame}件(道具と同じ)`);}
    console.log(`書いた: ${path.relative(rt0.ROOT,rt0.RUNTIME)} の <${conf.marker}-hell-notes> と HELL の Lv.${finalLevel}(ほかのマーカーは1バイトも変えていない)。この後 node tools/build.js`);
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}
module.exports={peakWindows,PEAK_SHARE,mix,mixBest,handRuleScore,readBlock,audioDraft,render,counts,levelSwitchViolations,sideSwitches,toRuntime,HELL_LANDSCAPE,SONGS};
