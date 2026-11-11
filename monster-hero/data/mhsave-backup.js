// Monster Hero: 長文化した引き継ぎコードを .mhsave ファイルで保存・復元する補助。
// .mhsave の中身は従来のバックアップコードそのもの。保存対象・復元結果は既存仕様と同じ。
(function(){
  'use strict';
  const FILE_EXT = '.mhsave';
  const MAX_FILE_BYTES = 20 * 1024 * 1024;

  function collectBackupCode(){
    try {
      const data = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('mh_')) data[key] = window.localStorage.getItem(key);
      }
      return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    } catch (_) { return ''; }
  }

  function decodeBackupCode(value){
    const json = decodeURIComponent(escape(atob(String(value || '').trim())));
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid-save');
    const keys = Object.keys(data).filter(key => key.startsWith('mh_'));
    if (!keys.length) throw new Error('no-save-keys');
    return { data, keys };
  }

  // ── 復元の共通の口(2026-11-12・社長の選択 案1「一覧の印だけ消す」・保存を消すことは社長が確認済み) ──
  // 復元は3か所(このファイルのファイルから戻す・60-app.jsx のコードから戻す/ファイルから戻す)。どれもここを呼ぶ。
  // 新しく始めた端末(はじめての案内を通った端末)に、前から遊んでいる人のバックアップを戻すと、
  // バックアップに無い「はじめての人の印」が端末に残り、前から遊んでいる人がはじめての人の扱いを受けていた。
  // 両方そろったときだけ、下の一覧の印のうちバックアップに無いものを消す(遊んだ記録には触らない。一覧の外は消さない):
  //   ① バックアップが前から遊んでいる人のもの(mh_onboarded が true・無ければ名前とアイコンが決まっている。mh_story_one_at_a_time_v1 が true でない)
  //   ② いまの端末が新しく始めた端末(戻す前の mh_story_one_at_a_time_v1 が true)
  // 消したあとの一覧の印はバックアップと同じになる(元の端末と同じ扱い)ので、お詫び・記念・報酬は二重に配られない。
  // ★はじめての人だけに書く印を増やしたら、ここへ足す(見張り: tools/boot/restore-first-timer-marks-check.js)
  const FIRST_TIMER_MARK_KEYS = Object.freeze([
    'mh_story_one_at_a_time_v1', 'mh_first_steps_v1', 'mh_first_battle_done_v1',
    'mh_kiki_intro_seen_v1', 'mh_momosuke_intro_seen_v1', 'mh_tactics_intro_seen_v1',
    'mh_story_assistant_chat_seen_v1', 'mh_story_tactics_types_seen_v1', 'mh_story_card_battle_seen_v1',
    'mh_rhythm_look_intro_seen_v1', 'mh_rhythm_event_story_v1',
    'mh_compensation_waived_v1', 'mh_inherited_unique_level_compensation_v1', 'mh_rhythm_grand_open_gift_v1',
    'mh_sorashido_gift_v1', 'mh_rhythm_event_reward_v1', 'mh_mission_renew_v1',
  ]);
  function parseStored(raw){
    if (typeof raw !== 'string') return undefined;
    try { return JSON.parse(raw); } catch (_) { return undefined; }
  }
  function isVeteranBackup(data){
    if (parseStored(data.mh_story_one_at_a_time_v1) === true) return false;
    const onboarded = parseStored(data.mh_onboarded);
    if (onboarded === true) return true;
    if (onboarded !== undefined && onboarded !== null) return false;
    // 印が無い古いバックアップは、起動と同じ見分け方(名前とアイコンが決まっている)
    const name = parseStored(data.mh_breeder_name);
    const icon = parseStored(data.mh_breeder_icon);
    return typeof name === 'string' && !!name.trim() && name !== '名無しのブリーダー' && typeof icon === 'string' && icon.length > 0;
  }
  function applyBackupRestore(data, keys){
    const storage = window.localStorage;
    let freshDevice = false;
    try { freshDevice = parseStored(storage.getItem('mh_story_one_at_a_time_v1')) === true; } catch (_) { freshDevice = false; }
    const veteran = isVeteranBackup(data);
    keys.forEach(key => storage.setItem(key, data[key]));
    const cleared = [];
    if (veteran && freshDevice) {
      FIRST_TIMER_MARK_KEYS.forEach(key => {
        if (keys.indexOf(key) >= 0) return;
        try { if (storage.getItem(key) !== null) { storage.removeItem(key); cleared.push(key); } } catch (_) {}
      });
    }
    // 助手の解放(2026-11-11・Fable の確認): 今日より前のバックアップには mh_assistant_partner_v1 が無い。先に助手を選んで mode:'earn' が書かれた端末へ戻すと、今の人が助手を失うので、無いときは「今の人(全員が助手)」を書く
    if (keys.indexOf('mh_assistant_partner_v1') < 0) storage.setItem('mh_assistant_partner_v1', JSON.stringify({ v:1, mode:'all', first:null, unlocked:[], noticed:[] }));
    return { veteran, freshDevice, cleared };
  }
  window.mhApplyBackupRestore = applyBackupRestore;
  window.MH_FIRST_TIMER_MARK_KEYS = FIRST_TIMER_MARK_KEYS;

  function fileStamp(date){
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function setMessage(modal, text, isError){
    let box = modal.querySelector('[data-mhsave-message]');
    if (!box) {
      box = document.createElement('div');
      box.dataset.mhsaveMessage = 'true';
      box.style.cssText = 'margin-top:8px;text-align:center;font-size:10px;font-weight:800;line-height:1.5;';
      modal.appendChild(box);
    }
    box.textContent = text;
    box.style.color = isError ? '#fca5a5' : '#86efac';
  }

  function saveFile(modal){
    const code = collectBackupCode();
    if (!code) { setMessage(modal, 'バックアップを作成できませんでした', true); return; }
    try {
      const blob = new Blob([code], { type:'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MonsterHero_Backup_${fileStamp(new Date())}${FILE_EXT}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(modal, 'バックアップファイルを保存しました');
    } catch (_) { setMessage(modal, 'バックアップファイルを保存できませんでした', true); }
  }

  function restoreValue(modal, value){
    try {
      const { data, keys } = decodeBackupCode(value);
      applyBackupRestore(data, keys);
      setMessage(modal, '復元しました。再読み込みします...');
      setTimeout(() => window.location.reload(), 900);
    } catch (_) { setMessage(modal, 'バックアップファイルが正しくありません', true); }
  }

  function chooseFile(modal){
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mhsave,text/plain,application/octet-stream';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > MAX_FILE_BYTES) { setMessage(modal, 'バックアップファイルが大きすぎます', true); return; }
        try { restoreValue(modal, await file.text()); }
        catch (_) { setMessage(modal, 'バックアップファイルを読み込めませんでした', true); }
      };
      input.click();
    } catch (_) { setMessage(modal, 'バックアップファイルを開けませんでした', true); }
  }

  function actionButton(label, mode, modal, useTitleStyle){
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mhsaveAction = mode;
    button.textContent = label;
    if (useTitleStyle) button.className = 'mh-dialog-choice';
    else button.className = 'w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-xs active:scale-95';
    button.addEventListener('click', () => mode === 'export' ? saveFile(modal) : chooseFile(modal));
    return button;
  }

  function findBackupModal(){
    const headings = Array.from(document.querySelectorAll('h3'));
    const heading = headings.find(el => el.textContent.trim() === 'データ引き継ぎ' || el.textContent.trim() === 'データのバックアップ');
    if (!heading) return null;
    if (heading.closest('.mh-title-dialog')) return { modal:heading.closest('.mh-title-dialog'), title:true };
    return { modal:heading.parentElement, title:false };
  }

  let lastFoundModal = null;
  function enhanceModal(){
    const found = findBackupModal();
    lastFoundModal = found && found.modal ? found.modal : null;
    if (!found || !found.modal) return;
    const { modal, title } = found;
    const buttons = Array.from(modal.querySelectorAll('button'));
    const codeRestore = buttons.find(btn => btn.textContent.trim() === 'このコードで復元する');
    const exportMode = !codeRestore;
    const mode = exportMode ? 'export' : 'import';
    modal.querySelectorAll('[data-mhsave-action]').forEach(el => {
      if (el.dataset.mhsaveAction !== mode) el.remove();
    });
    if (modal.querySelector(`[data-mhsave-action="${mode}"]`)) return;

    const button = actionButton(
      exportMode ? 'バックアップファイルを保存（.mhsave）' : 'バックアップファイルから復元（.mhsave）',
      mode, modal, title
    );

    if (title) {
      const tabs = modal.querySelector('.mh-changelog-tabs');
      if (tabs) tabs.insertAdjacentElement('afterend', button); else modal.appendChild(button);
    } else {
      const codeAction = exportMode
        ? buttons.find(btn => /バックアップコードを作成|コードをコピー/.test(btn.textContent))
        : codeRestore;
      const panel = codeAction && codeAction.parentElement;
      if (panel) panel.insertBefore(button, panel.firstChild); else modal.appendChild(button);
    }
  }

  try {
    const categories = typeof HELP_CATEGORIES !== 'undefined' ? HELP_CATEGORIES : [];
    const topics = categories.flatMap(category => Array.isArray(category.topics) ? category.topics : []);
    const settings = topics.find(topic => topic.id === 'settings');
    const backup = topics.find(topic => topic.id === 'backup');
    if (settings) {
      const kv = (settings.blocks || []).find(block => block && block.t === 'kv' && Array.isArray(block.rows));
      if (kv) {
        const row = kv.rows.find(item => Array.isArray(item) && item[0] === 'データ引き継ぎ');
        if (row) row[1] = 'バックアップファイル（.mhsave）または引き継ぎコードで書き出し・読み込み';
      }
    }
    if (backup) {
      backup.assistant = 'ここが一番大事かも…！ ファイルでバックアップしておけば、長いコードを控えなくても復元できるよ。';
      backup.blocks = [
        { t:'note', title:'定期的にバックアップしましょう', text:'HOMEの「設定」内にある「データ引き継ぎ」で、バックアップファイル（.mhsave）を保存しておくと安心です。' },
        { t:'p', text:'「バックアップファイルを保存（.mhsave）」なら、長い引き継ぎコードをコピーせず端末のファイルとして保管できます。iPhone / iPadは共有メニューから「ファイルに保存」、Android / PCはダウンロードフォルダへ直接保存されます。端末を替えるときは同じ.mhsaveファイルをGoogle Driveなどで受け渡し、「バックアップファイルから復元」で開きます。' },
        { t:'note', title:'従来のコード方式も使えます', text:'これまでの引き継ぎコードも引き続き作成・復元できます。.mhsaveファイルの中身は従来のバックアップコードと同じデータなので、保存対象のmh_*データや復元結果は変わりません。' },
      ];
    }
  } catch (_) {}

  // DOM が変わるたびに呼ばれるので、次のフレームへの予約は1つにまとめる(以前は変わった回数だけ積んでいた)。
  // モンヒロビートの演奏中は引き継ぎの画面が開かないので探さない。演奏中は判定文字・タップの波紋などで
  // 1秒に何度も DOM が変わり、そのたびに画面中の見出しを読んでいた(2026-09-25・演奏中のカクつき対策)
  // 引き継ぎの窓は見出し(h3)ごと出てくるので、窓が開いていないあいだは「見出しが出入りした変化」のときだけ探す。
  // 窓が開いているあいだ(書き出し/読み込みの切り替え)は、これまでどおり変化のたびに見る
  // (2026-11-11 カルク: バトル中などは変化のたびに画面中の見出しを読み、20秒で34〜55回動いていた。窓の出方は変わらない)
  let enhancePending = 0;
  let openModal = null;
  const runEnhance = () => {
    enhancePending = 0;
    enhanceModal();
    openModal = lastFoundModal;
  };
  const scheduleEnhance = () => {
    if (enhancePending) return;
    if (document.documentElement.dataset.rhythmPlayActive === 'true') return;
    enhancePending = window.requestAnimationFrame(runEnhance);
  };
  const touchesHeading = (m) => {
    const t = m.target;
    if (t && t.nodeType === 1 && (t.tagName === 'H3' || (t.closest && t.closest('h3')))) return true;
    for (const n of m.addedNodes) if (n.nodeType === 1 && (n.tagName === 'H3' || (n.querySelector && n.querySelector('h3')))) return true;
    return false;
  };
  new MutationObserver((list) => {
    if (enhancePending) return;
    if (openModal && openModal.isConnected) { scheduleEnhance(); return; }
    openModal = null;
    if (list.some(touchesHeading)) scheduleEnhance();
  }).observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runEnhance, { once:true });
  else runEnhance();
})();
