// ソラシドの加入のお話「推しに会える夜 ～ソラシド登場～」(2026-10-27)の台本と、流し方のつなぎを見る。
//
//   node tools/assistant/sorashido-story-check.js
//
// 社長が選んだ案1の流れ(①HOME に駆け込む → ②浜で来ない → ③風鈴で現れる → ④三線の音で通じる → ⑤仲間になる)と、
// 守ること(キュービ・オリヒメは人の言葉を話さない・山場は「笑」や顔文字を入れない・呼び方)を、台本から確かめる。
// 仕組みはきゅうこの加入のお話と同じ形(お話の id・見終えたお話の id で見たかを持つ・公開の印で出し入れ)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const assistantsSrc = read('monster-hero/data/assistants.js');
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const core = read('monster-hero/src/parts/10-core.jsx');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__e={EVENT_REPLAYS,STORY:ASSISTANT_SORASHIDO_JOIN_STORY,CALLS:ASSISTANT_SORASHIDO_JOIN_STORY_CALLS,GUESTS:STORY_GUEST_SPEAKERS,PEER:ASSISTANT_PEER_CALLS};`, ctx);
const { EVENT_REPLAYS, STORY, CALLS, GUESTS, PEER } = ctx.__e;

// ---- 回想の登録と、流し方のつなぎ ----
const entry = EVENT_REPLAYS.find((ev) => ev.id === 'sorashido_join_2026_10_27');
check('回想に登録されている(公開の印で出し入れ・助手のお話のまとまり)', !!entry && entry.releaseFlag === 'assistantSorashido' && entry.group === 'assistant'
  && entry.unlockedKey === 'sorashidoJoinSeen' && entry.script === STORY, entry ? entry.title : 'なし');
check('ゲーム側のお話の id がデータと同じ', rel.includes("const SORASHIDO_JOIN_STORY_ID = 'sorashido_join_2026_10_27';"));
check('公開の印はまだ偽のまま(社長が「公開」と言うまで立てない)', /assistantSorashido: false,/.test(rel) && core.includes('get assistantSorashido()'));
check('見たかどうかは既存の「見終えたお話の id」で持つ(新しい保存キーを作らない)',
  /RHYTHM_EVENT_STORY_IDS = \[[^\]]*SORASHIDO_JOIN_STORY_ID[,\]]/.test(app)
  && app.includes('sorashidoJoinSeen: Array.isArray(rhythmEventStorySeen) && rhythmEventStorySeen.includes(SORASHIDO_JOIN_STORY_ID)')
  && !/mh_[a-z_]*sorashido_join/.test(app + rel));
check('お話を流すのは公開の印が立ったときだけ(公開のあとの最初の HOME で1回)',
  /if \(!EVENT_REPLAY_RELEASE_FLAGS\.assistantSorashido\) return;\s*\n\s*if \(!Array\.isArray\(rhythmEventStorySeen\) \|\| rhythmEventStorySeen\.includes\(SORASHIDO_JOIN_STORY_ID\)\) return;[\s\S]{0,400}setRhythmEventStoryPending\(SORASHIDO_JOIN_STORY_ID\);/.test(app));
check('はじめての人の「見た扱い」には、公開してからだけ入れる(公開前に始めた人にも、公開の日に流れる)',
  app.includes('...(EVENT_REPLAY_RELEASE_FLAGS.assistantSorashido ? [SORASHIDO_JOIN_STORY_ID] : [])'));
const guest = (id) => GUESTS.find((g) => g.id === id);
check('キュービ・オリヒメはお話の話し手にいる(全身の絵を枠に収める)', ['kyubi', 'orihime'].every((id) => guest(id) && guest(id).imageFit === 'contain'),
  ['kyubi', 'orihime'].filter((id) => !guest(id)).join(','));

// ---- 台本 ----
// 場面は台本のコメント「// ---- ①」〜「// ---- ⑤」で分ける
const body = assistantsSrc.slice(assistantsSrc.indexOf('const ASSISTANT_SORASHIDO_JOIN_STORY = ['), assistantsSrc.indexOf('const ASSISTANT_SORASHIDO_JOIN_STORY_CALLS'));
const scenes = body.split(/\n\s*\/\/ ---- [①②③④⑤]/).slice(1).map((chunk) => (chunk.match(/\{ who:'[a-z]+'[^\n]*\}/g) || []));
// あつの出し分けは with と without が1組で1行ぶん
const lineCount = (rows) => rows.filter((r) => !/atsu:'without'/.test(r)).length;
check('場面は5つ', scenes.length === 5, `${scenes.length}`);
check('大きさはきゅうこの加入のお話と同じくらい(55〜75行)', lineCount(scenes.flat()) >= 55 && lineCount(scenes.flat()) <= 75, `${scenes.map(lineCount).join('・')} 行`);
const at = (i) => scenes[i] ? scenes[i].join('\n') : '';
check('① ソラシドが駆け込み、AIで出した予測を見せる', /sorashido/.test(at(0)) && /AI/.test(at(0)) && /オリヒメが現れそうな夜/.test(at(0)));
check('② 来ない夜に、データを洗い直して没頭する', /来ない/.test(at(1)) && /データ/.test(at(1)));
check('③ 風鈴でオリヒメが現れ、キュービが提灯で立ちふさがる', /who:'orihime'[^\n]*風鈴/.test(at(2)) && /who:'kyubi'[^\n]*提灯[^\n]*立ちふさがる/.test(at(2)));
check('④ 三線を鳴らすと、オリヒメが袖を引き、キュービが提灯を下ろす', /三線/.test(at(3)) && /who:'orihime'[^\n]*袖を引く/.test(at(3)) && /who:'kyubi'[^\n]*提灯を下ろ/.test(at(3)) && /うぉぉぉ/.test(at(3)));
check('⑤ 「推しのそばにいたいから」助手になり、みゅあに「正直すぎ」と笑われる', /推しのそばにいたいから/.test(at(4)) && /who:'mua'[^\n]*正直すぎ/.test(at(4)));
check('⑤ お酒(泡盛)はこの場面だけ', /泡盛/.test(at(4)) && !/泡盛|お酒/.test(scenes.slice(0, 4).flat().join('\n')));
// 山場はシリアス(台帳 2026-10-23「シリアスなお話では笑や顔文字を入れない」)
check('④ 山場には「笑」「w」や顔文字を入れない', !/笑|[wｗ](?=['\s])|\(´|♡|♪/.test(at(3)), (at(3).match(/[^\n]*(笑|\(´|♡|♪)[^\n]*/) || [''])[0].slice(0, 80));

const rows = STORY;
const mon = rows.filter((r) => r.who === 'kyubi' || r.who === 'orihime');
// 鳴き声としぐさだけ: かっこの中のしぐさを除くと、鳴き声(コン・ウゥ・りん)と記号しか残らない
const strayWords = mon.filter((r) => !/^[コンッウゥりんっ…♪！!、。\s]*$/.test(r.t.replace(/\([^)]*\)/g, '')));
check('キュービ・オリヒメは人の言葉を話さない(鳴き声としぐさだけ)', mon.length >= 10 && strayWords.length === 0, strayWords.map((r) => r.t).join(' / '));
const sora = rows.filter((r) => r.who === 'sorashido');
check('ソラシドは「笑」を使い、「w」は使わない', sora.some((r) => /笑/.test(r.t)) && !sora.some((r) => /[wｗ]/.test(r.t)));
check('ソラシドの「〜ぜ・・・！」は1行に1回まで', sora.every((r) => (r.t.match(/ぜ・・・/g) || []).length <= 1) && sora.some((r) => /ぜ・・・！/.test(r.t)));
check('ソラシドは沖縄の言葉を少し使う(なんくるないさ〜)', sora.some((r) => /なんくるないさ/.test(r.t)));
check('最後はソラシドから {name} へのあいさつ', rows[rows.length - 1].who === 'sorashido' && rows[rows.length - 1].t.includes('{name}'));

// ---- 真ん中に出すモンスター(monsters:[{ id, pose }]・2026-10-27 社長「この形で作る」) ----
const POSES = ['in', 'idle', 'back', 'front', 'approach', 'hop', 'hide'];
const monRows = rows.filter((r) => Array.isArray(r.monsters));
check('monsters の id はキュービ・オリヒメだけ、pose は7つのどれか', monRows.length > 0 && monRows.every((r) => r.monsters.every((m) => ['Kyubi', 'Orihime'].includes(m.id) && POSES.includes(m.pose))));
const posesIn = (i) => (scenes[i] || []).filter((r) => /monsters:\[/.test(r)).map((r) => [...r.matchAll(/id:'(\w+)', pose:'(\w+)'/g)].map((m) => `${m[1]}:${m[2]}`).join(','));
const flat = (i) => posesIn(i).join(' / ');
check('①② には出さない', posesIn(0).length === 0 && posesIn(1).length === 0);
check('③ オリヒメは現れて後ずさる・キュービは現れて前に出る', /Orihime:in/.test(flat(2)) && /Orihime:back/.test(flat(2)) && /Kyubi:in/.test(flat(2)) && /Kyubi:front/.test(flat(2)), flat(2));
check('④ 2体とも待機 → オリヒメは寄る・キュービは後ずさって待機へ', /Orihime:idle,Kyubi:idle/.test(posesIn(3)[0] || '') && /Orihime:approach/.test(flat(3)) && /Kyubi:back/.test(flat(3)) && /Kyubi:idle$/.test(posesIn(3).slice(-1)[0] || ''), flat(3));
check('⑤ 2体とも跳ねる → 待機(打ち上げも待機)', /Orihime:hop,Kyubi:hop/.test(flat(4)) && /Orihime:idle,Kyubi:idle$/.test(posesIn(4).slice(-1)[0] || ''), flat(4));
const otherMon = EVENT_REPLAYS.filter((ev) => ev.id !== 'sorashido_join_2026_10_27' && (ev.script || []).some((l) => l && l.monsters));
check('ほかのお話(ジャック・きゅうこなど)には monsters を付けていない', otherMon.length === 0, otherMon.map((ev) => ev.id).join(','));
const art = read('monster-hero/src/parts/21-assistant.jsx');
check('絵は全身の絵(KYUBI_IMG・ORIHIME_IMG)、待機アニメは withMonsterIdleArt', /Kyubi: typeof KYUBI_IMG/.test(art) && /Orihime: typeof ORIHIME_IMG/.test(art)
  && app.includes("m.pose==='idle'?withMonsterIdleArt(m.id,art,{fill:true,own:true}):art"));

// ---- 呼び方(社長の決定・ASSISTANT_PEER_CALLS と同じ) ----
const callOf = { mua: 'ソラちん', kiki: 'ソラシドさん', momosuke: 'ソラ', dra: 'ソラさん', atsu: 'ソラシド', kyuko: 'ソラ' };
check('ほかの助手からの呼び方が ASSISTANT_PEER_CALLS と同じ', Object.entries(callOf).every(([id, c]) => PEER[id] && PEER[id].sorashido === c && CALLS[id] === c));
const usesCall = Object.entries(callOf).filter(([id, c]) => !rows.some((r) => r.who === id && r.t.includes(c)));
check('ほかの助手は、台本の中でその呼び方でソラシドを呼んでいる', usesCall.length === 0, usesCall.map(([id]) => id).join(','));
check('ソラシドのあいさつは、みゅあ・きき・もも・ドラちゃん・あっくん・きゅうこ の呼び方', sora.some((r) => r.atsu === 'with' && /みゅあ、きき、もも、ドラちゃん、あっくん、きゅうこ/.test(r.t))
  && sora.some((r) => r.atsu === 'without' && /みゅあ、きき、もも、ドラちゃん、きゅうこ/.test(r.t) && !/あっくん/.test(r.t)));
// ---- あつの出し分け(きゅうこのお話と同じ) ----
check('あつの行はすべて「あつを解放している人だけ」(atsu:\'with\')', rows.filter((r) => r.who === 'atsu').every((r) => r.atsu === 'with'));
check('あつの出し分けは with と without が同じ数', rows.filter((r) => r.atsu === 'with').length === rows.filter((r) => r.atsu === 'without').length);
check('解放していない人へは、あつの名前を出さない', rows.filter((r) => r.atsu === 'without').every((r) => !/あつ|あっくん/.test(r.t)));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
