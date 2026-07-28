(() => {
  'use strict';
  const cfg = window.LEGACY_IN_STONE_CLOUD || {};
  let session = null;
  try { session = JSON.parse(localStorage.getItem('lis-cloud-session') || 'null'); } catch (_) {}
  const headers = (extra = {}, json = true) => ({
    apikey: cfg.supabaseAnonKey,
    ...(json ? {'Content-Type':'application/json'} : {}),
    ...(session?.access_token ? {Authorization:`Bearer ${session.access_token}`} : {}),
    ...extra
  });
  async function request(path, options = {}, json = true) {
    const response = await fetch(cfg.supabaseUrl + path, {...options, headers:headers(options.headers,json)});
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
    const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:String(email||'').trim(),password})});
    if(!result?.access_token||!result?.user?.id) throw new Error('Supabase did not return a valid login session.');
    session=result; localStorage.setItem('lis-cloud-session',JSON.stringify(session)); return session;
  }
  function signOut(){session=null;localStorage.removeItem('lis-cloud-session');}
  async function pushCatalog(records){
    if(!session?.user?.id) throw new Error('Sign in first.');
    const ownerId=session.user.id, updatedAt=new Date().toISOString();
    const rows=records.map(record=>({owner_id:ownerId,specimen_code:record.specimen_code,payload:record,updated_at:updatedAt}));
    return request('/rest/v1/specimens?on_conflict=owner_id%2Cspecimen_code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  }
  async function pullCatalog(){
    if(!session) throw new Error('Sign in first.');
    const rows=await request('/rest/v1/specimens?select=payload&order=specimen_code');
    return (rows||[]).map(x=>x.payload);
  }
  function safeName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-');}
  async function uploadAttachment({file,specimenCode,type,caption='',sourcePath=null}){
    if(!session?.user?.id) throw new Error('Sign in first.');
    const stamp=Date.now(), folder=specimenCode||'_collection', objectPath=`${session.user.id}/${folder}/${stamp}-${safeName(file.name)}`;
    const response=await fetch(`${cfg.supabaseUrl}/storage/v1/object/collection-files/${objectPath}`,{method:'POST',headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file});
    if(!response.ok) throw new Error((await response.text())||'File upload failed.');
    const row={owner_id:session.user.id,specimen_code:specimenCode||null,material_type:type,file_name:file.name,mime_type:file.type||'application/octet-stream',storage_path:objectPath,caption,source_path:sourcePath};
    await request('/rest/v1/attachments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
    return row;
  }
  async function listAttachments(specimenCode){
    if(!session) throw new Error('Sign in first.');
    const filter=specimenCode?`&specimen_code=eq.${encodeURIComponent(specimenCode)}`:'';
    return request(`/rest/v1/attachments?select=*&order=created_at.desc${filter}`);
  }
  async function signedUrl(storagePath,expiresIn=3600){
    const result=await request(`/storage/v1/object/sign/collection-files/${storagePath}`,{method:'POST',body:JSON.stringify({expiresIn})});
    const signed=result?.signedURL||result?.signedUrl;
    if(!signed) throw new Error('Could not create a private file link.');
    return cfg.supabaseUrl + '/storage/v1' + signed;
  }
  async function migratedSourcePaths(){
    if(!session) throw new Error('Sign in first.');
    const rows=await request('/rest/v1/attachments?select=source_path&source_path=not.is.null');
    return new Set((rows||[]).map(x=>x.source_path));
  }
  window.LISCloud={configured:()=>Boolean(cfg.enabled&&cfg.supabaseUrl&&cfg.supabaseAnonKey),signedIn:()=>Boolean(session?.access_token),user:()=>session?.user||null,signIn,signOut,pushCatalog,pullCatalog,uploadAttachment,listAttachments,signedUrl,migratedSourcePaths};
})();
