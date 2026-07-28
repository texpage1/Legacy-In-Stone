(() => {
  'use strict';
  const DB_NAME = 'legacy-in-stone-v06';
  const DB_VERSION = 1;
  const STORE = 'attachments';
  function openDb(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,DB_VERSION);
      r.onupgradeneeded=()=>{ const db=r.result; if(!db.objectStoreNames.contains(STORE)){ const s=db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true}); s.createIndex('specimenId','specimenId'); }};
      r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);
    });
  }
  async function saveAttachment(record){ const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); const q=tx.objectStore(STORE).add({...record,createdAt:new Date().toISOString()}); q.onsuccess=()=>resolve(q.result); q.onerror=()=>reject(q.error); }); }
  async function listAttachments(specimenId){ const db=await openDb(); return new Promise((resolve,reject)=>{ const tx=db.transaction(STORE,'readonly'); const q=tx.objectStore(STORE).index('specimenId').getAll(Number(specimenId)); q.onsuccess=()=>resolve(q.result||[]); q.onerror=()=>reject(q.error); }); }
  async function allAttachments(){ const db=await openDb(); return new Promise((resolve,reject)=>{ const q=db.transaction(STORE,'readonly').objectStore(STORE).getAll(); q.onsuccess=()=>resolve(q.result||[]); q.onerror=()=>reject(q.error); }); }
  async function deleteAttachment(id){ const db=await openDb(); return new Promise((resolve,reject)=>{ const q=db.transaction(STORE,'readwrite').objectStore(STORE).delete(Number(id)); q.onsuccess=()=>resolve(); q.onerror=()=>reject(q.error); }); }
  window.LISStorage={saveAttachment,listAttachments,allAttachments,deleteAttachment};
})();
