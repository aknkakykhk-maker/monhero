// ===== 事件簿の人物調書(登場人物紹介・台帳 r1126-117) =====
//  起動画面の「人物調書」から開く。人ごとに 名前(ふりがな)・顔・肩書き・ひとこと と、物語を進めるほど開く項目。
//  開き方は今の保存(mh_xmas_novel_v1 の snaps=入った章 / endings=見たエンド)から数える(新しい保存キーは足さない)。
//  どの項目をどこで開くかの表: docs/progress/event-xmas-2026/cast-profile-r1126-117/README.md(文を足すときは表も直す)
//  ネタバレの線: 真相・動機・犯人に関わる文は「秘密」(真エンド END-G を見たあと)にだけ書く
const XMAS_NOVEL_PROFILE_STEPS = Object.freeze([
  { key: 'met', label: '名前と顔', hint: '第一章を読むと', ok: (sv) => xmasNovelProfileCh(sv, 1) },
  { key: 'who', label: '人となり', hint: '第二章へ進むと', ok: (sv) => xmasNovelProfileCh(sv, 2) },
  { key: 'tie', label: 'つながり', hint: '第六章へ進むと', ok: (sv) => xmasNovelProfileCh(sv, 6) },
  //  早い結末(第二章の行動の選択など)だけ見た人に先の出来事を見せないよう、章と結末の両方で開く
  { key: 'night', label: 'あの夜の動き', hint: '第七章のあと、結末を見ると', ok: (sv) => xmasNovelProfileCh(sv, 7) && !!(sv && Array.isArray(sv.endings) && sv.endings.length) },
  { key: 'secret', label: '秘密', hint: '本当の結末を見ると', ok: (sv) => !!(sv && Array.isArray(sv.endings) && sv.endings.includes('END-G')) },
]);
//  その章(またはその先の章)に入ったことがあるか。snaps のキーは C1〜C11(後半の C10・C11 は第8章・第9章の扱いなので 8 以上として数える)
const xmasNovelProfileCh = (sv, n) => {
  if (!sv || typeof sv !== 'object') return false;
  const snaps = sv.snaps && typeof sv.snaps === 'object' ? Object.keys(sv.snaps) : [];
  if (snaps.some((k) => { const m = /^C(\d+)$/.exec(k); return !!m && Number(m[1]) >= n; })) return true;
  // 第一章: しおりの無い古い保存でも、第一章の行を読んだ・結末を見たなら開く
  if (n <= 1) return (Array.isArray(sv.read) && sv.read.some((k) => /^C1-/.test(String(k)))) || (Array.isArray(sv.endings) && sv.endings.length > 0);
  return false;
};
const XMAS_NOVEL_PROFILES = Object.freeze({
  atsu: { role: '名探偵', say: '雪山のペンションって、それだけでワクワクする笑',
    who: '勘とひらめきで走る名探偵。助手はみゅあ。同じ探偵の服がかぶったソラシドと、どちらが先に謎を解くかの勝負をしている',
    night: 'ふだんは軽口ばかりだが、重い場面では冗談をやめて言い切る。疑われた仲間を、まっ先にかばいに行く',
    tie: 'ソラシドとは張り合いながらも、だれよりも推理を信じている相手。みゅあの「ひらめきの一言」に、何度も道を開かれている',
    secret: '主役を任された夜は、最後に「謎は全て解けた!」と真相を明かす。12年前の聖夜とのつながりは無く、だからこそまっすぐに真実を追えた' },
  myua: { role: 'あつの助手', say: 'はいはい、名探偵が2人！ 助手のあたしは、あつくんのほうね！',
    who: 'あつの助手で、驚き役。思ったことがすぐ顔と声に出る。何気ない一言が、推理のきっかけになることが多い',
    night: '夜中に、ひとりで台所にいた。手もとには黒い毛糸。そのせいで、疑いの目を向けられたことがある',
    tie: 'あつくんの助手であることが、何よりの自慢。ももすけとは、きゃあきゃあ言い合える仲',
    secret: '台所で編んでいたのは、みんなに配るマフラー。クリスマス会の朝に渡すつもりで、一人ずつ名前を編みこんでいた' },
  sorashido: { role: '名探偵', say: 'ワトソンくん、到着の時刻を',
    who: '記録と計算で推理をつなぐ名探偵。助手はノートパソコンのワトソンくん。重い場面では、笑いを付けずに話す',
    night: '時刻と足どりを一つずつ記録して、だれがいつどこにいたかを組み立てていく。鐘の鳴った時刻にも、最初に引っかかった',
    tie: 'あつとは、探偵の服を先週から決めていたと言い張る好敵手。ワトソンくんの記録を、だれよりも信頼している',
    secret: '主役を任された夜は、最後に「真実はいつもひとつ!」と真相を明かす。12年前の聖夜とのつながりは無い' },
  kiki: { role: '見張り役', say: '私のは、緑のリボンで2回結んでありまつ',
    who: 'ていねいな話し方で、細かいことによく気づく。決めたことは、きちんと書きとめておきたい性分',
    night: 'みんなが眠れない夜、ホールで見張りのノートをつけていた。その間に、白瀬と言葉を交わしている',
    tie: '白瀬が「12年前」を打ち明けかけた相手。その言葉の続きを聞けなかったことを、気にかけている',
    secret: '見張りのノートには、書かずにおいたことがある。だれかを疑わせないために、自分の胸にしまった一行' },
  momosuke: { role: '招かれた客', say: 'ももは、ケーキのいちごの係〜♡',
    who: '甘えんぼうで、にぎやかなのが大好き。こわいことは、こわいと口に出せる素直さを持っている',
    night: '倒れた影を最初に見つけたのは、ももすけだった。「黒いサンタ」という言葉を、なぜか前にも聞いた気がしている',
    tie: 'きゅうこを「きゅうちゃん」と呼んで、いつもくっついている。みゅあとは、おしゃべりの相棒',
    secret: '12年前の聖夜、まだ小さかったももすけは、家族でこのペンションに泊まっていた。窓の外の影を「黒いサンタ」と呼んで泣いた。それが、この山の言い伝えの始まりになった' },
  dra: { role: '招かれた客', say: 'ごはんの係！ もちまる、おで、おまえとは仲良くなれそうだ',
    who: '食いしん坊で、まっすぐ。むずかしいことを考えるより、目の前の人を大事にする',
    night: '事件のたびに、なぜかドラのそばに手がかりが残る。それでも「なにも見てない」とだけ言って、口をつぐんだ',
    tie: 'もちまるとは、ごはんの話で一日目から意気投合した。きゅうこのことを、ずっと気にかけている',
    secret: '停電の夜、台所で、裏口から戻ってきた人とすれちがっていた。その人が泣いていたから、だれにも言わず、疑いを自分で引き受けようとした' },
  kyuko: { role: '招かれた客', say: 'ほい、それ、俺がやるよぉ。古い時計、好きなんだ',
    who: 'ゆるい話し方の、のんびり屋。古い時計が好きで、ホールの柱時計のねじ巻き係を自分から引き受けた',
    night: 'ペンションに着いたとき、少しの間だけ立ち止まって見上げていた。吹雪の中へ出て行き、そのあとには、リボンだけが残された',
    tie: 'ももすけにいつもくっつかれている。えるびんの子どもの頃の話を、スプーンを止めて聞いていた',
    secret: '「黒いサンタ」の正体。12年前の聖夜、閉ざされた裏口の外で母を亡くした息子。母を待った夜と同じ夜を、もう一度ここで作ろうとした' },
  erubin: { role: '招かれた客', say: '……静かだね。雪が、音を全部吸いこんでるみたい',
    who: 'おだやかで、にぎやかな所では一歩うしろにいるのが落ち着くという。子どもの頃は、雪山のふもとに住んでいた',
    night: '鏡の廊下で写真を撮り、そこに写った影を確かめに行った。そのあと、はしごの下で、足をくじいてうずくまっていた',
    tie: '白瀬と並んで食事をし、自分と似た遠慮を持つ人として話をした。ソラシドとは、静かに話の合う仲',
    secret: '生まれは、ふもとの薬屋。12年前の吹雪の夜、店は早く閉まっていた。戸を叩き続けた人の薬が遅れたことを、本人は覚えていない' },
  ichika: { role: 'ペンションのオーナー', say: 'ようこそ、ペンション・シュプールへ。オーナーのイチーカです',
    who: 'ペンション・シュプールのオーナー。おしとやかで、だれにでも優しい。小さい頃、祖父からこの山の言い伝えを聞かされて育った',
    night: '2階の奥の「開かずの部屋」の鍵を持っている。その部屋のことになると、少しだけ口が重くなる',
    tie: '祖父からペンションを受けついだ。世話役のもちまるとは、家族のような間柄',
    secret: '12年前は、主人だった祖父の孫の少女。いつかあの親子が戻るかもしれないと、二人の泊まった部屋をそのままにしてきた。それが「開かずの部屋」' },
  mochimaru: { role: 'ペンションの世話役', say: '世話役のもちまるだっちー！ ごはんと、暖炉と、夜の見回りは、ぼくに任せてっちー',
    who: 'ペンションの世話役。うそがつけない。吹雪の夜は、外に出た人がすぐ戻れるよう、裏口のかんぬきを開けておく',
    night: '鍵を全部あずかっているので、何かあるたびに真っ先に頼られる。夜の見回りも欠かさない',
    tie: 'イチーカの祖父の代から、このペンションで働いている。ドラとは、ごはんの話で特に気が合う',
    secret: '12年前の聖夜の帳面を書いた人。「0時の鐘、なんだか早かったっちー」。うそがつけないから、あの夜の本当がそのまま残っていた' },
  kuroba: { kana: 'くろば そういちろう', role: '招かれざる客', say: '時は金なり、だよ',
    who: '都会の大きな音楽事務所の社長。声が大きく、人を見下した話し方をする。いつも懐中時計を見ている',
    night: '楽譜のケースが消えてから、部屋にこもっておびえていた。のこされたのは、23時47分で止まった懐中時計',
    tie: '白瀬を連れて来た。二人とも、差出人「黒いサンタ」の黒い招待状で呼ばれている',
    secret: '12年前の聖夜、柱時計を13分進め、白瀬に裏口を閉めさせた。外にいたのは、曲を売ることを断った作曲家カノン。黒羽はその楽譜を持ち帰り、自分の曲として売り出した' },
  shirase: { kana: 'しらせ ゆきえ', role: '招かれざる客', say: '白瀬と申します。……突然、ごめんなさい',
    who: '元は歌手で、今は町の音楽教室の先生。静かで、目をふせて話す。口ぐせは「……ごめんなさい」',
    night: 'えるびんやききに、何かを打ち明けかけていた。のこされたのは、赤い毛糸の手袋と、一通の手紙',
    tie: '昔は黒羽の事務所の新人歌手だった。黒羽の前では、いつも目をふせている',
    secret: '12年前の聖夜、黒羽に言われて、早く鳴った鐘で裏口のかんぬきを閉めた。外にまだ人がいるとは知らなかった。12年間、ずっと悔やんでいた' },
});

// 画面: 一覧(12人の札)→ 押すと、その人の調書。見た目はホラーの見た目(#8091)の事件ファイルにそろえる
//  名前のふりがなは kana(フルネームの読み)。まだ開いていない項目は「？？？」と、開く目安だけ
const XmasNovelProfileFace = ({ c, met }) => {
  const f = met && typeof xmasNovelFaceOf === 'function' ? xmasNovelFaceOf(c.id) : '';
  return f ? <img src={f} alt="" draggable={false} /> : <XmasNovelShadow tone={met ? c.tone : '#1a1210'} />;
};
const XmasNovelProfile = ({ save, onBack }) => {
  const [pick, setPick] = useState('');
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-xmas-novel-profile-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-xmas-novel-profile-css'; tag.textContent = XMAS_NOVEL_PROFILE_CSS; document.head.appendChild(tag);
  }, []);
  const sv = save && typeof save === 'object' ? save : {};
  const open = XMAS_NOVEL_PROFILE_STEPS.map((st) => { try { return !!st.ok(sv); } catch (e) { return false; } });
  const met = open[0];
  const cast = typeof XMAS_NOVEL_CAST !== 'undefined' ? XMAS_NOVEL_CAST : [];
  const c = pick ? cast.find((x) => x.id === pick) : null;
  const p = c ? (XMAS_NOVEL_PROFILES[c.id] || {}) : null;
  if (c && p) {
    return (
      <div className="my-auto w-full max-w-md" data-xmas-novel-profile={c.id}>
        <div className="mh-hr-tab mh-nv-serif">人物調書　No.{String(cast.indexOf(c) + 1).padStart(2, '0')}</div>
        <div className="mh-hr-folder mh-hr-stain mh-nv-prof-card">
          <div className="mh-nv-prof-head">
            <span className="ph"><XmasNovelProfileFace c={c} met={met} /></span>
            <div className="min-w-0 flex-1">
              {p.role && <div className="mh-nv-prof-role mh-nv-serif">{p.role}</div>}
              {p.kana && <div className="mh-nv-prof-kana" data-xmas-novel-profile-kana>{p.kana}</div>}
              <div className="mh-nv-prof-name mh-nv-serif">{c.full || c.name}</div>
            </div>
          </div>
          {p.say && <p className="mh-nv-prof-say mh-nv-serif">{xmasNovelWrap(`「${p.say}」`)}</p>}
          <ul className="mt-3 space-y-2">
            {XMAS_NOVEL_PROFILE_STEPS.slice(1).map((st, i) => {
              const ok = open[i + 1];
              return (
                <li key={st.key} className="mh-nv-clue mh-nv-prof-item" data-xmas-novel-profile-item={st.key} data-open={ok ? '' : undefined}>
                  <div className="mh-nv-serif mh-nv-prof-label">{st.label}</div>
                  <div className="mh-nv-plain mh-nv-prof-text">{ok ? xmasNovelWrap(p[st.key] || '') : '？？？'}</div>
                  {!ok && <div className="mh-nv-prof-hint">{xmasNovelWrap(`${st.hint}、書き足されます`)}</div>}
                </li>
              );
            })}
          </ul>
        </div>
        <button type="button" className="mh-nv-btn wide mt-4" data-xmas-novel-profile-back onClick={() => setPick('')}>一覧へ</button>
      </div>
    );
  }
  return (
    <div className="my-auto w-full max-w-md" data-xmas-novel-profile-list>
      <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black tracking-widest">人物調書</div>
      <div className="mh-nv-rule" />
      <p className="mh-nv-plain mb-3 text-center text-[11px] text-slate-300">{xmasNovelWrap(met ? '物語を読み進めるほど、調書が書き足されていきます' : '物語を読みはじめると、調書がひらきます')}</p>
      <div className="mh-nv-prof-grid">
        {cast.map((x) => (
          <button type="button" key={x.id} className="mh-nv-prof-cell active:scale-95" data-xmas-novel-profile-pick={x.id} disabled={!met} onClick={() => setPick(x.id)}>
            <span className="ph"><XmasNovelProfileFace c={x} met={met} /></span>
            <span className="mh-nv-serif nm">{met ? x.name : '？？？'}</span>
          </button>
        ))}
      </div>
      <button type="button" className="mh-nv-btn wide mt-4" onClick={onBack}>戻る</button>
    </div>
  );
};
// 見た目(事件簿の画面の CSS のあとに足す。ホラーの見た目の色 --hr-* を使う)
const XMAS_NOVEL_PROFILE_CSS = `
.mh-nv-prof-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
@media (min-width: 560px) { .mh-nv-prof-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.mh-nv-prof-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px 7px; border-radius: 3px; background: rgba(14,9,8,.85); box-shadow: inset 0 -2px 0 var(--hr-red, #6d0b12), 0 0 0 1px rgba(109,11,18,.45); color: var(--hr-bone, #e6dcc6); }
.mh-nv-prof-cell:disabled { opacity: .55; }
.mh-nv-prof-cell .ph, .mh-nv-prof-head .ph { display: flex; align-items: flex-end; justify-content: center; overflow: hidden; border-radius: 2px; background: #0b0807; box-shadow: 0 0 0 1px rgba(165,156,135,.25); }
.mh-nv-prof-cell .ph { width: 100%; aspect-ratio: 1; }
.mh-nv-prof-cell .ph img, .mh-nv-prof-head .ph img { width: 100%; height: 100%; object-fit: cover; object-position: top; filter: sepia(.25) contrast(1.05); }
.mh-nv-prof-cell .nm { font-size: 12px; font-weight: 800; line-height: 1.2; white-space: nowrap; }
.mh-nv-prof-card { padding: 18px 16px 16px; }
.mh-nv-prof-head { display: flex; align-items: flex-end; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(109,11,18,.55); }
.mh-nv-prof-head .ph { width: 84px; height: 84px; flex: none; }
.mh-nv-prof-role { font-size: 11px; letter-spacing: .25em; color: var(--hr-bone2, #a59c87); }
.mh-nv-prof-kana { margin-top: 4px; font-size: 11px; letter-spacing: .18em; color: var(--hr-bone2, #a59c87); }
.mh-nv-prof-name { font-size: 24px; font-weight: 900; letter-spacing: .12em; line-height: 1.2; color: var(--hr-bone, #e6dcc6); }
.mh-nv-prof-say { margin-top: 10px; padding-left: 1em; text-indent: -1em; font-size: 14px; font-weight: 700; line-height: 1.7; color: var(--hr-bone, #e6dcc6); }
.mh-nv-prof-item { padding: 9px 12px; }
.mh-nv-prof-label { font-size: 11px; font-weight: 900; letter-spacing: .25em; color: var(--hr-red2, #b3121c); }
.mh-nv-prof-text { margin-top: 3px; font-size: 13px; line-height: 1.7; color: var(--hr-bone, #e6dcc6); }
.mh-nv-prof-item:not([data-open]) .mh-nv-prof-text { letter-spacing: .3em; color: #5d5448; }
.mh-nv-prof-hint { margin-top: 2px; font-size: 10px; color: var(--hr-bone2, #a59c87); }
`;
