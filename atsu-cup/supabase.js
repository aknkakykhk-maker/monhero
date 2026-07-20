// あつ杯運営ツール共通: Supabase(モンヒロと同じプロジェクト)への簡易アクセスヘルパー
(function(){
  "use strict";
  const SB_URL = 'https://zrzevudkbgtxlbvmuziy.supabase.co';
  const SB_KEY = 'sb_publishable_D4WJBXJ1xE97amndZarEPw_0M4LAwOp';
  const SB_HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

  async function sbSelect(table, query){
    const res = await fetch(`${SB_URL}/rest/v1/${table}${query ? '?' + query : ''}`, { headers: SB_HEADERS });
    if(!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
    return res.json();
  }
  async function sbInsert(table, row){
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(row)
    });
    if(!res.ok) throw new Error(`insert ${table} failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }
  async function sbInsertMany(table, rows){
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(rows)
    });
    if(!res.ok) throw new Error(`insert ${table} failed: ${res.status}`);
    return res.json();
  }
  async function sbUpdate(table, id, patch){
    const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(patch)
    });
    if(!res.ok) throw new Error(`update ${table} failed: ${res.status}`);
    return res.json();
  }
  async function sbUploadPoster(file){
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g,'') || 'png';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/atsucup-posters/${path}`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });
    if(!res.ok) throw new Error(`poster upload failed: ${res.status}`);
    return `${SB_URL}/storage/v1/object/public/atsucup-posters/${path}`;
  }

  window.AtsuCupDB = { sbSelect, sbInsert, sbInsertMany, sbUpdate, sbUploadPoster };
})();
