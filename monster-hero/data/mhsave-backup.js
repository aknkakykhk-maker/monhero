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

  function fileStamp(date){
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
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
      const blob = new Blob([code], { type:'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `monster-hero-backup-${fileStamp(new Date())}${FILE_EXT}`;
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
      keys.forEach(key => window.localStorage.setItem(key, data[key]));
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

  function enhanceModal(){
    const found = findBackupModal();
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
        { t:'p', text:'「バックアップファイルを保存（.mhsave）」なら、長い引き継ぎコードをコピーせず端末のファイルとして保管できます。復元するときは「バックアップファイルから復元」を選んで保存した.mhsaveファイルを開きます。' },
        { t:'note', title:'従来のコード方式も使えます', text:'これまでの引き継ぎコードも引き続き作成・復元できます。.mhsaveファイルの中身は従来のバックアップコードと同じデータなので、保存対象のmh_*データや復元結果は変わりません。' },
      ];
    }
  } catch (_) {}

  const scheduleEnhance = () => window.requestAnimationFrame(enhanceModal);
  new MutationObserver(scheduleEnhance).observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceModal, { once:true });
  else enhanceModal();
})();
