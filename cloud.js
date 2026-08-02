(() => {
  'use strict';
  const cfg = window.LEGACY_IN_STONE_CLOUD || {};
  let session = null;
  try { session = JSON.parse(localStorage.getItem('lis-cloud-session') || 'null'); } catch (_) {}

  function persistSession(next){
    session = next || null;
    if(session) localStorage.setItem('lis-cloud-session', JSON.stringify(session));
    else localStorage.removeItem('lis-cloud-session');
  }
  const headers = (extra = {}, json = true) => ({
    apikey: cfg.supabaseAnonKey,
    ...(json ? {'Content-Type':'application/json'} : {}),
    ...(session?.access_token ? {Authorization:`Bearer ${session.access_token}`} : {}),
    ...extra
  });
  async function parseError(response){
    const text=await response.text();
    let message=text||response.statusText||`HTTP ${response.status}`;
    try { const p=JSON.parse(text); message=p.msg||p.message||p.error_description||p.error||message; } catch(_){}
    return {text,message};
  }
  async function refreshSession(){
    if(!session?.refresh_token) throw new Error('Your cloud session expired. Sign in again.');
    const response=await fetch(cfg.supabaseUrl + '/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{apikey:cfg.supabaseAnonKey,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if(!response.ok){ const e=await parseError(response); persistSession(null); throw new Error('Session refresh failed: '+e.message); }
    const next=await response.json();
    if(!next?.access_token) throw new Error('Session refresh did not return an access token.');
    persistSession({...session,...next});
    return session;
  }
  function tokenNeedsRefresh(){
    if(!session?.access_token) return false;
    try {
      const payload=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return Number(payload.exp||0)*1000 < Date.now()+120000;
    } catch(_) { return false; }
  }
  async function ensureSession(){
    if(!session?.access_token) throw new Error('Sign in first.');
    if(tokenNeedsRefresh()) await refreshSession();
    return session;
  }
  async function request(path, options = {}, json = true, retried = false) {
    if(path.startsWith('/rest/') || path.startsWith('/storage/')) await ensureSession();
    const response = await fetch(cfg.supabaseUrl + path, {...options, headers:headers(options.headers,json)});
    if(response.status===401 && !retried && session?.refresh_token){
      await refreshSession();
      return request(path,options,json,true);
    }
    const text = await response.text();
    if (!response.ok) {
      let message=text||response.statusText||`HTTP ${response.status}`;
      try { const p=JSON.parse(text); message=p.msg||p.message||p.error_description||p.error||message; } catch(_){}
      throw new Error(message);
    }
    if (!text) return null;
    try { return JSON.parse(text); } catch(_) { return text; }
  }
  async function signIn(email,password){
    const response=await fetch(cfg.supabaseUrl+'/auth/v1/token?grant_type=password',{
      method:'POST',headers:{apikey:cfg.supabaseAnonKey,'Content-Type':'application/json'},
      body:JSON.stringify({email:String(email||'').trim(),password})
    });
    if(!response.ok){const e=await parseError(response);throw new Error(e.message);}
    const result=await response.json();
    if(!result?.access_token||!result?.user?.id) throw new Error('Supabase did not return a valid login session.');
    persistSession(result); return session;
  }
  function signOut(){persistSession(null);}
  async function pushCatalog(records){
    await ensureSession();
    const ownerId=session.user.id, updatedAt=new Date().toISOString();
    const rows=records.map(record=>({owner_id:ownerId,specimen_code:record.specimen_code,payload:record,updated_at:updatedAt}));
    return request('/rest/v1/specimens?on_conflict=owner_id%2Cspecimen_code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  }

  async function upsertSpecimen(record){
    await ensureSession();
    if(!record?.specimen_code) throw new Error('Specimen number is required.');
    const row={owner_id:session.user.id,specimen_code:record.specimen_code,payload:record,updated_at:new Date().toISOString()};
    await request('/rest/v1/specimens?on_conflict=owner_id%2Cspecimen_code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
    return record;
  }
  async function pullCatalog(){
    await ensureSession();
    const rows=await request('/rest/v1/specimens?select=payload&order=specimen_code');
    return (rows||[]).map(x=>x.payload);
  }
  function safeName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-');}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  async function uploadObject(file,objectPath,attempt=0){
    await ensureSession();
    const response=await fetch(`${cfg.supabaseUrl}/storage/v1/object/collection-files/${objectPath}`,{
      method:'POST',headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file
    });
    if(response.status===401 && attempt<1){await refreshSession();return uploadObject(file,objectPath,attempt+1);}
    if(!response.ok){
      const e=await parseError(response);
      if((response.status===408||response.status===429||response.status>=500) && attempt<3){await sleep(750*(attempt+1));return uploadObject(file,objectPath,attempt+1);}
      throw new Error(`Storage upload ${response.status}: ${e.message}`);
    }
  }
  async function uploadAttachment({file,specimenCode,type,caption='',sourcePath=null}){
    await ensureSession();
    const folder=specimenCode||'_collection';
    const sourceKey=sourcePath ? safeName(sourcePath.replaceAll('/','-')) : `${Date.now()}-${safeName(file.name)}`;
    const objectPath=`${session.user.id}/${folder}/${sourceKey}`;
    await uploadObject(file,objectPath);
    const row={owner_id:session.user.id,specimen_code:specimenCode||null,material_type:type,file_name:file.name,mime_type:file.type||'application/octet-stream',storage_path:objectPath,caption,source_path:sourcePath};
    const saved=await request('/rest/v1/attachments?on_conflict=owner_id%2Csource_path',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
    return Array.isArray(saved)&&saved.length?saved[0]:row;
  }
  async function listAttachments(specimenCode){
    await ensureSession();
    const filter=specimenCode?`&specimen_code=eq.${encodeURIComponent(specimenCode)}`:'';
    return request(`/rest/v1/attachments?select=*&order=created_at.desc${filter}`);
  }
  async function updateAttachment(id,changes){
    await ensureSession();
    if(!id) throw new Error('Attachment ID is required.');
    const allowed={};
    for(const key of ['caption','display_order','is_primary','file_name','mime_type']) if(Object.prototype.hasOwnProperty.call(changes||{},key)) allowed[key]=changes[key];
    return request(`/rest/v1/attachments?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(allowed)});
  }
  async function setPrimaryPhoto(specimenCode,id){
    await ensureSession();
    const code=encodeURIComponent(specimenCode);
    await request(`/rest/v1/attachments?specimen_code=eq.${code}&material_type=eq.${encodeURIComponent('Specimen photograph')}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_primary:false})});
    await updateAttachment(id,{is_primary:true,display_order:0});
  }
  async function reorderPhotos(photoRows){
    await ensureSession();
    for(let i=0;i<photoRows.length;i++) await updateAttachment(photoRows[i].id,{display_order:i});
  }
  async function replaceAttachment(attachment,file){
    await ensureSession();
    if(!attachment?.storage_path) throw new Error('Storage path is missing.');
    await uploadObject(file,attachment.storage_path);
    await updateAttachment(attachment.id,{file_name:file.name,mime_type:file.type||'application/octet-stream'});
    return {...attachment,file_name:file.name,mime_type:file.type||'application/octet-stream'};
  }
  async function deleteAttachment(attachment){
    await ensureSession();
    if(!attachment?.id) throw new Error('Attachment ID is required.');
    if(attachment.storage_path){
      const response=await fetch(`${cfg.supabaseUrl}/storage/v1/object/collection-files/${attachment.storage_path}`,{method:'DELETE',headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}});
      if(!response.ok&&response.status!==404){const e=await parseError(response);throw new Error(`Storage delete ${response.status}: ${e.message}`);}
    }
    await request(`/rest/v1/attachments?id=eq.${encodeURIComponent(attachment.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  }
  async function signedUrl(storagePath,expiresIn=3600){
    await ensureSession();
    const result=await request(`/storage/v1/object/sign/collection-files/${storagePath}`,{method:'POST',body:JSON.stringify({expiresIn})});
    const signed=result?.signedURL||result?.signedUrl;
    if(!signed) throw new Error('Could not create a private file link.');
    return cfg.supabaseUrl + '/storage/v1' + signed;
  }
  async function migratedSourcePaths(){
    await ensureSession();
    const rows=await request('/rest/v1/attachments?select=source_path&source_path=not.is.null');
    return new Set((rows||[]).map(x=>x.source_path));
  }
  window.LISCloud={configured:()=>Boolean(cfg.enabled&&cfg.supabaseUrl&&cfg.supabaseAnonKey),signedIn:()=>Boolean(session?.access_token),user:()=>session?.user||null,signIn,signOut,refreshSession,pushCatalog,upsertSpecimen,pullCatalog,uploadAttachment,listAttachments,updateAttachment,setPrimaryPhoto,reorderPhotos,replaceAttachment,deleteAttachment,signedUrl,migratedSourcePaths};
})();
