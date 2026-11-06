#!/usr/bin/env node
// プロフィールの「性別」と、助手・マスモンの呼び方(2026-11-06 社長)を確かめる。
//   node tools/assistant/breeder-gender-call-check.js
// 【見ること】
//  ・答えない('none')・保存が無い・壊れているときは、どの助手のどの段でも、これまでと同じ呼び方(段の表の call そのもの)
//  ・男の子/女の子のときは ASSISTANT_GENDER_CALLS(社長「この表で」)のとおり。ももすけ・えるびんは変えない
//  ・Lv6から本人が決めた呼び方は、性別より優先する
//  ・マスモンは、性格の候補にくん・ちゃんの両方があるときだけ持ち替える
//  ・保存は新しいキー mh_breeder_gender_v1 だけ。フレンドに送るプロフィールには入れない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const c = { console };
vm.createContext(c);
vm.runInContext(`${read('data/assistants.js')}\n;this.T = { assistantCallName, assistantSetPlayerGender, assistantBondLevelsOf, normalizeBreederGender, ASSISTANT_GENDER_CALLS };`, c);
const T = c.T;
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const N = 'リバ';

// 答えない・壊れた値は今までと同じ
for (const raw of ['none', undefined, null, '', 'MALE', 3, {}]) {
  T.assistantSetPlayerGender(raw);
  const diff = [];
  for (const id of IDS) for (const st of T.assistantBondLevelsOf(id)) {
    const want = String(st.call || '{name}').replace('{name}', N);
    const got = T.assistantCallName(N, st.level, null, id);
    if (got !== want) diff.push(`${id} Lv${st.level} ${got}≠${want}`);
  }
  check(`性別が ${JSON.stringify(raw)} のときは、これまでと同じ呼び方`, diff.length === 0, diff.slice(0, 4).join(' / '));
}
check('壊れた値は none になる', ['x', 1, null, undefined, 'Male'].every((v) => T.normalizeBreederGender(v) === 'none') && T.normalizeBreederGender('male') === 'male' && T.normalizeBreederGender('female') === 'female');

// 表のとおり(社長「この表で」)
const WANT = {
  male:   { mua: ['さん', 'くん', 'ちん'], kiki: ['さん', 'さん', 'くん'], momosuke: ['', 'っち', 'っち'], dra: ['さん', 'くん', 'くん'], atsu: ['くん', 'くん', 'くん'], kyuko: ['さん', 'ニキ', 'ニキ'], sorashido: ['さん', 'くん', 'くん'], erubin: ['さん', 'さん', 'さん'] },
  female: { mua: ['さん', 'ちゃん', 'ちん'], kiki: ['さん', 'さん', 'ちゃん'], momosuke: ['', 'っち', 'っち'], dra: ['さん', 'ちゃん', 'ちゃん'], atsu: ['ちゃん', 'ちゃん', 'ちゃん'], kyuko: ['さん', 'ネキ', 'ネキ'], sorashido: ['さん', 'ちゃん', 'ちゃん'], erubin: ['さん', 'さん', 'さん'] },
};
for (const g of ['male', 'female']) {
  T.assistantSetPlayerGender(g);
  const diff = [];
  for (const id of IDS) [1, 3, 5].forEach((lv, i) => { const got = T.assistantCallName(N, lv, null, id); if (got !== N + WANT[g][id][i]) diff.push(`${id} Lv${lv} ${got}`); });
  check(`${g === 'male' ? '男の子' : '女の子'}のときの段ごとの呼び方が表のとおり(Lv1/3/5)`, diff.length === 0, diff.join(' / '));
  check(`${g}: Lv6から本人が決めた呼び方が優先される`, T.assistantCallName(N, 7, '{name}さま', 'atsu') === 'リバさま' && T.assistantCallName(N, 7, '相棒', 'mua') === '相棒');
  check(`${g}: 名前が敬称で終わるときは重ねない`, !/くんくん|くんちゃん|くんニキ|くんネキ/.test(IDS.map((id) => T.assistantCallName('モンヒロくん', 3, null, id)).join('')));
}
T.assistantSetPlayerGender('none');

// マスモン
const persona = read('src/parts/33-rhythm-buddy-persona.jsx');
const pc = { console, Object, Array, Math, String, Number, JSON, Date };
vm.createContext(pc);
const fn = persona.match(/const rhythmBuddyCallForGender = [\s\S]*?\n};/);
check('マスモンの持ち替えの関数がある', !!fn);
if (fn) {
  vm.runInContext(`${fn[0]}\nthis.f = rhythmBuddyCallForGender;`, pc);
  const both = ['san', 'kun', 'chan'], kunOnly = ['bare', 'partner', 'boss', 'kun'];
  check('マスモン: 答えないなら変えない', pc.f('kun', both, 'none') === 'kun' && pc.f('chan', both, 'none') === 'chan');
  check('マスモン: 男の子なら ちゃん→くん、女の子なら くん→ちゃん', pc.f('chan', both, 'male') === 'kun' && pc.f('kun', both, 'female') === 'chan' && pc.f('san', both, 'female') === 'san');
  check('マスモン: 候補に替える先が無い性格では替えない', pc.f('kun', kunOnly, 'female') === 'kun');
}
check('マスモンの呼び方の決め方が持ち替えを通る', /const callId = rhythmBuddyCallForGender\(callId0,/.test(persona));

// 保存とプロフィール
const app = read('src/parts/60-app.jsx');
check('保存は新しいキー mh_breeder_gender_v1', /const BREEDER_GENDER_KEY = 'mh_breeder_gender_v1';/.test(app) && /storeGet\(BREEDER_GENDER_KEY, 'none', false\)/.test(app));
const pub = app.match(/message: latest\.profileMessage, records,[^\n]*/);
check('フレンドに送るプロフィールに性別を入れない', !!pub && !/gender/i.test(pub[0]));
const prof = read('src/parts/56-screen-profile.jsx');
check('プロフィールに「性別」の欄(男の子/女の子/答えない)がある', /data-profile-gender/.test(prof) && /\['male','男の子'\],\['female','女の子'\],\['none','答えない'\]/.test(prof));
console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
