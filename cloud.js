(() => {
  'use strict';
  const cfg=window.LEGACY_IN_STONE_CLOUD||{};
  let session=JSON.parse(localStorage.getItem('lis-cloud-session')||'null');
  const headers=(extra={})=>({'apikey':cfg.supabaseAnonKey,'Content-Type':'application/json',...(session?.access_token?{'Authorization':'Bearer '+session.access_token}:{}),...extra});
  async function request(path,options={}){ const r=await fetch(cfg.supabaseUrl+path,{...options,headers:headers(options.headers)}); if(!r.ok) throw new Error((await r.text())||r.statusText); const t=await r.text(); return t?JSON.parse(t):null; }
  async function signIn(email,password){ session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})}); localStorage.setItem('lis-cloud-session',JSON.stringify(session)); return session; }
  function signOut(){session=null;localStorage.removeItem('lis-cloud-session');}
  async function pushCatalog(records){ if(!session) throw new Error('Sign in first.'); const rows=records.map(x=>({specimen_code:x.specimen_code,payload:x,updated_at:new Date().toISOString()})); return request('/rest/v1/specimens?on_conflict=specimen_code',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)}); }
  async function pullCatalog(){ if(!session) throw new Error('Sign in first.'); return request('/rest/v1/specimens?select=payload&order=specimen_code'); }
  window.LISCloud={configured:()=>Boolean(cfg.enabled&&cfg.supabaseUrl&&cfg.supabaseAnonKey),signedIn:()=>Boolean(session),signIn,signOut,pushCatalog,pullCatalog};
})();
