(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer=null, attachments=[], bySpecimen=new Map(), bySource=new Map(), patchQueued=false;
function toast(msg,kind='info'){const t=$('#toast');if(!t)return;t.textContent=msg;t.dataset.kind=kind;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),6000);}
function setMessage(msg,kind='info'){const m=$('#cloudMessage');if(!m)return;m.textContent=msg;m.dataset.kind=kind;m.classList.remove('hidden');}
function clearMessage(){const m=$('#cloudMessage');if(m){m.textContent='';m.classList.add('hidden');}}
function setBusy(btn,busy,busyLabel){if(!btn)return;btn.disabled=busy;if(!btn.dataset.label)btn.dataset.label=btn.textContent;if(busyLabel)btn.textContent=busy?busyLabel:btn.dataset.label;}
function download(name,blob){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function specimenById(id){return (LISApp?.getRecords?.()||[]).find(x=>Number(x.id)===Number(id));}
function isPhoto(a){return a.material_type==='Specimen photograph'||String(a.mime_type||'').startsWith('image/');}
function attachmentSort(a,b){
  if(isPhoto(a)&&isPhoto(b)){
    if(Boolean(a.is_primary)!==Boolean(b.is_primary))return a.is_primary?-1:1;
    const ao=Number.isFinite(Number(a.display_order))?Number(a.display_order):999999;
    const bo=Number.isFinite(Number(b.display_order))?Number(b.display_order):999999;
    if(ao!==bo)return ao-bo;
  }
  return String(a.created_at||'').localeCompare(String(b.created_at||''));
}
function indexAttachments(rows){attachments=rows||[];bySpecimen=new Map();bySource=new Map();for(const a of attachments){if(a.source_path)bySource.set(a.source_path,a);const key=a.specimen_code||'_collection';if(!bySpecimen.has(key))bySpecimen.set(key,[]);bySpecimen.get(key).push(a);}for(const list of bySpecimen.values())list.sort(attachmentSort);}
function syncPhotoMetadata(){
  const records=LISApp?.getRecords?.()||[];
  let changed=false;
  for(const record of records){
    const rows=(bySpecimen.get(record.specimen_code)||[]).filter(isPhoto);
    const next=rows.map(a=>({is_primary:Boolean(a.is_primary),cloud_storage_path:a.storage_path,file_name:a.file_name,display_order:a.display_order??null,attachment_id:a.id}));
    if(JSON.stringify(record.photos||[])!==JSON.stringify(next)){record.photos=next;changed=true;}
  }
  if(changed)LISApp.replaceRecords(records);
}
async function refreshAttachments(){if(!LISCloud.signedIn())return;indexAttachments(await LISCloud.listAttachments(null));syncPhotoMetadata();queuePatch();}
async function secureUrl(a,expires=3600){if(!a)return null;if(a._signedUrl&&a._signedUntil>Date.now()+60000)return a._signedUrl;a._signedUrl=await LISCloud.signedUrl(a.storage_path,expires);a._signedUntil=Date.now()+Math.max(60000,(expires-60)*1000);return a._signedUrl;}
async function openPrivateAttachment(a){const tab=window.open('about:blank','_blank');try{const url=await secureUrl(a);if(tab){tab.location.replace(url);}else{window.location.href=url;}}catch(err){if(tab)tab.close();toast('Could not open private file: '+err.message,'error');}}
function photoRows(code){return (bySpecimen.get(code)||[]).filter(isPhoto).sort(attachmentSort);}
function materialRows(code){return (bySpecimen.get(code)||[]).filter(a=>!isPhoto(a));}
function queuePatch(){if(patchQueued)return;patchQueued=true;requestAnimationFrame(()=>{patchQueued=false;patchPrivateMedia();});}
async function patchCard(card){if(card.dataset.cloudPatched==='loading')return;const code=card.querySelector('.code')?.textContent?.trim(),photo=photoRows(code)[0],box=card.querySelector('.photo');if(!photo||!box)return;card.dataset.cloudPatched='loading';try{box.style.backgroundImage=`url("${await secureUrl(photo,7200)}")`;box.textContent='';card.dataset.cloudPatched='yes';}catch(_){delete card.dataset.cloudPatched;}}
async function managePhoto(action,photo,photos,code,index){
  try{
    if(action==='primary'){
      await LISCloud.setPrimaryPhoto(code,photo.id);
      toast('Primary photograph updated.','success');
    }else if(action==='left'||action==='right'){
      const ordered=photos.slice();
      const target=action==='left'?index-1:index+1;
      if(target<0||target>=ordered.length)return;
      if(ordered[index].is_primary||ordered[target].is_primary)return;
      [ordered[index],ordered[target]]=[ordered[target],ordered[index]];
      await LISCloud.reorderPhotos(ordered);
      toast('Photograph order updated.','success');
    }else if(action==='delete'){
      if(!confirm(`Delete ${photo.file_name}? This permanently removes the photograph from private storage.`))return;
      const wasPrimary=Boolean(photo.is_primary);
      await LISCloud.deleteAttachment(photo);
      const remaining=photos.filter(a=>a.id!==photo.id);
      if(wasPrimary&&remaining.length)await LISCloud.setPrimaryPhoto(code,remaining[0].id);
      toast('Photograph deleted.','success');
    }
    await refreshAttachments();
    const specimen=(LISApp.getRecords()||[]).find(x=>x.specimen_code===code);
    if(specimen)LISApp.openDetail(specimen.id);
  }catch(err){toast('Photo update failed: '+err.message,'error');}
}
async function replacePhoto(photo,file,code){
  if(!file?.name)return;
  try{
    await LISCloud.replaceAttachment(photo,file);
    photo._signedUrl=null;photo._signedUntil=0;
    toast('Photograph replaced.','success');
    await refreshAttachments();
    const specimen=(LISApp.getRecords()||[]).find(x=>x.specimen_code===code);
    if(specimen)LISApp.openDetail(specimen.id);
  }catch(err){toast('Photo replacement failed: '+err.message,'error');}
}
async function patchDetail(){
  const body=$('#detailBody'),code=body?.querySelector('.code')?.textContent?.trim();
  if(!code)return;
  const photos=photoRows(code);
  let gallery=body.querySelector('.gallery');
  if(photos.length){
    if(!gallery){gallery=document.createElement('div');gallery.className='gallery managed-gallery';body.querySelector('.detail-head')?.insertAdjacentElement('afterend',gallery);}
    gallery.classList.add('managed-gallery');
    const photoKey=code+'|'+photos.map(a=>[a.id,a.file_name,a.is_primary,a.display_order,a.updated_at].join(':')).join('|');
    if(gallery.dataset.cloudKey!==photoKey){
      gallery.dataset.cloudKey=photoKey;
      gallery.innerHTML='<div class="placeholder">Loading private photographs…</div>';
      const urls=await Promise.all(photos.map(a=>secureUrl(a,7200).catch(()=>null)));
      if(gallery.dataset.cloudKey===photoKey){
        gallery.innerHTML=urls.map((u,i)=>u?`<article class="photo-manager" data-photo-id="${esc(photos[i].id)}"><img src="${esc(u)}" alt="${esc(photos[i].caption||photos[i].file_name)}"><div class="photo-manager-meta"><span>${photos[i].is_primary?'<b>Primary photo</b>':'Photograph '+(i+1)}</span><small>${esc(photos[i].file_name)}</small></div><div class="photo-manager-actions"><button class="outline" data-photo-action="primary" ${photos[i].is_primary?'disabled':''}>Make Primary</button><button class="outline" data-photo-action="left" ${(i===0||photos[i].is_primary||photos[i-1]?.is_primary)?'disabled':''}>Move Left</button><button class="outline" data-photo-action="right" ${(i===photos.length-1||photos[i].is_primary)?'disabled':''}>Move Right</button><button class="outline" data-photo-action="replace">Replace</button><button class="outline danger" data-photo-action="delete">Delete</button><input type="file" accept="image/*" data-replace-input hidden></div></article>`:'').join('')||'<div class="placeholder">Private photographs could not be opened.</div>';
        gallery.querySelectorAll('.photo-manager').forEach((card,i)=>{
          card.querySelectorAll('[data-photo-action]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();const action=btn.dataset.photoAction;if(action==='replace')card.querySelector('[data-replace-input]').click();else managePhoto(action,photos[i],photos,code,i);});
          card.querySelector('[data-replace-input]').onchange=e=>replacePhoto(photos[i],e.target.files?.[0],code);
        });
      }
    }
  }else if(gallery){gallery.remove();}

  const section=[...body.querySelectorAll('.detail-content section')].find(s=>s.querySelector('h3')?.textContent==='Related materials');
  if(!section)return;
  const rows=materialRows(code);
  const materialKey=code+'|'+rows.map(a=>a.id||a.storage_path).join('|');
  if(section.dataset.cloudMaterialsKey===materialKey)return;
  section.dataset.cloudMaterialsKey=materialKey;
  section.querySelectorAll('.materials-list,.placeholder').forEach(x=>x.remove());
  if(!rows.length){section.insertAdjacentHTML('beforeend','<div class="placeholder">No related documents have been added.</div>');return;}
  const loading=document.createElement('div');loading.className='placeholder';loading.textContent='Loading private documents…';section.appendChild(loading);
  const resolved=await Promise.all(rows.map(async a=>{try{return {a,url:await secureUrl(a,3600)};}catch(err){console.error('Could not create private document link',a,err);return {a,url:null};}}));
  const currentCode=body.querySelector('.code')?.textContent?.trim();if(currentCode!==code||section.dataset.cloudMaterialsKey!==materialKey)return;loading.remove();
  const working=resolved.filter(x=>x.url);if(!working.length){section.insertAdjacentHTML('beforeend','<div class="placeholder">Private documents could not be opened.</div>');return;}
  const wrap=document.createElement('div');wrap.className='materials-list cloud-materials';wrap.innerHTML=working.map(({a,url})=>`<a class="material-item" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="material-type">${esc(a.material_type||'Private document')}</span><strong>${esc(a.file_name||'Open private document')}</strong><small>${esc(a.caption||'Open private file')}</small></a>`).join('');section.appendChild(wrap);
}
async function patchAbout(){for(const el of $$('[data-private-source]')){const path=el.dataset.privateSource,a=bySource.get(path);if(!a)continue;if(el.tagName==='IMG'){if(!el.src||!el.dataset.privateReady){el.src=await secureUrl(a,7200);el.dataset.privateReady='yes';}}else if(!el.dataset.privateReady){el.onclick=e=>{e.preventDefault();openPrivateAttachment(a)};el.dataset.privateReady='yes';}}
const portrait=$('#portraitUpload');if(portrait)portrait.closest('.portrait-control')?.classList.toggle('hidden',bySource.has('images/about/jane-freese.jpg'));
}
function patchPrivateMedia(){if(!LISCloud.signedIn())return;$$('.card').forEach(card=>{if(!card.dataset.cloudPatched)patchCard(card)});patchDetail().catch(()=>{});patchAbout().catch(()=>{});}
async function backup(){const records=LISApp.getRecords(),inventory=attachments.map(({owner_id,...a})=>a),payload={version:'0.6.5',createdAt:new Date().toISOString(),catalogRecords:records,privateAttachmentInventory:inventory,note:'Private file contents remain in Supabase Storage. This backup preserves the catalog and attachment index.'};download(`Legacy_in_Stone_Cloud_Backup_${new Date().toISOString().slice(0,10)}.json`,new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));toast('Cloud catalog and attachment inventory exported.','success');}
async function saveAttachment(e){
  e.preventDefault();
  const f=new FormData(e.target),file=(f.get('camera_file')&&f.get('camera_file').name)?f.get('camera_file'):f.get('file'),specimen=specimenById(f.get('id')),type=String(f.get('material_type'));
  if(!file||!file.name){toast('Choose a file first.','error');return;}
  if(!LISCloud.signedIn()){toast('Sign in before uploading a file.','error');return;}
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try{
    const existing=specimen?photoRows(specimen.specimen_code):[];
    const row=await LISCloud.uploadAttachment({file,specimenCode:specimen?.specimen_code,type,caption:String(f.get('caption')||'')});
    if(type==='Specimen photograph'&&specimen&&row.id){
      await LISCloud.updateAttachment(row.id,{display_order:existing.length,is_primary:existing.length===0});
    }
    $('#attachmentDialog').close();toast(`${type} saved to private cloud storage.`,'success');await refreshAttachments();if(specimen)LISApp.openDetail(specimen.id);
  }catch(err){toast('File save failed: '+err.message,'error');}finally{submit.disabled=false;}
}
function statusText(){if(!LISCloud.configured())return'Cloud account not connected';return LISCloud.signedIn()?'Signed in — cloud saving is active':'Cloud configured; sign in required';}
function refreshStatus(){const s=$('#cloudStatus');if(s)s.textContent=statusText();const last=localStorage.getItem('lis-last-sync');const meta=$('#lastSync');if(meta)meta.textContent=last?`Last full catalog save from this device: ${new Date(last).toLocaleString()}`:'Individual edits and imports save automatically. A full catalog save has not been run from this device.';if($('#cloudSignOut'))$('#cloudSignOut').disabled=!LISCloud.signedIn();if($('#cloudPush'))$('#cloudPush').disabled=!LISCloud.signedIn();}
async function loadCloudCatalog(){if(!LISCloud.signedIn())return;try{const records=await LISCloud.pullCatalog();if(records.length){LISApp.replaceRecords(records);await refreshAttachments();setMessage(`${records.length} cloud records and ${attachments.length} private attachments loaded.`,'success');}else setMessage('The private catalog is empty.','error');}catch(err){setMessage('Could not load the private collection: '+err.message,'error');}}
function unlock(){document.body.classList.remove('auth-locked');$('#authGate')?.classList.add('hidden');}
function lock(){document.body.classList.add('auth-locked');$('#authGate')?.classList.remove('hidden');}
async function authenticate(email,password,form){const btn=form.querySelector('[type=submit]');btn.disabled=true;clearMessage();try{await LISCloud.signIn(email,password);refreshStatus();unlock();await loadCloudCatalog();setMessage('Signed in. Cloud saving is active.','success');toast('Signed in successfully.','success');return true;}catch(err){setMessage('Sign-in failed: '+err.message,'error');const a=$('#authError');if(a){a.textContent='Sign-in failed: '+err.message;a.classList.remove('hidden');}return false;}finally{btn.disabled=false;}}
async function uploadPortrait(file){if(!file?.name)return;try{setMessage('Uploading Jane Freese portrait…','info');await LISCloud.uploadAttachment({file,specimenCode:null,type:'Collection portrait',caption:'Jane Freese',sourcePath:'images/about/jane-freese.jpg'});await refreshAttachments();setMessage('Jane Freese portrait saved in private storage.','success');}catch(err){setMessage('Portrait upload failed: '+err.message,'error');}}
function setupCloud(){refreshStatus();$('#cloudLoginForm').onsubmit=e=>{e.preventDefault();authenticate(e.target.email.value,e.target.password.value,e.target)};$('#authLoginForm').onsubmit=e=>{e.preventDefault();$('#authError').classList.add('hidden');authenticate(e.target.email.value,e.target.password.value,e.target)};$('#cloudSignOut').onclick=()=>{LISCloud.signOut();indexAttachments([]);refreshStatus();lock();setMessage('Signed out.','success')};$('#cloudPush').onclick=async()=>{const btn=$('#cloudPush');setBusy(btn,true,'Saving all…');clearMessage();try{const records=LISApp.getRecords();await LISCloud.pushCatalog(records);const now=new Date().toISOString();localStorage.setItem('lis-last-sync',now);refreshStatus();setMessage(`${records.length} records saved to the private cloud.`,'success');}catch(err){setMessage('Full catalog save failed: '+err.message,'error');}finally{setBusy(btn,false)}};const portrait=$('#portraitUpload');if(portrait)portrait.onchange=()=>uploadPortrait(portrait.files?.[0]);if(!LISCloud.configured()){lock();setMessage('Cloud connection is not configured.','error');}else if(LISCloud.signedIn()){unlock();loadCloudCatalog();}else lock();}
window.addEventListener('DOMContentLoaded',()=>{const settings=$('#settingsDialog .settings-actions');if(settings&&!$('#portraitUpload'))settings.insertAdjacentHTML('beforeend','<label class="outline portrait-control">Add Jane Freese portrait<input id="portraitUpload" type="file" accept="image/*" hidden></label>');$('#attachmentForm').onsubmit=saveAttachment;$('#fullBackup').onclick=backup;$('#settingsButton').onclick=()=>{$('#settingsDialog').showModal();refreshStatus()};new MutationObserver(queuePatch).observe(document.body,{childList:true,subtree:true});setupCloud();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js');const install=$('#installApp');let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;install.hidden=false});install.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;install.hidden=true}else toast('Use your browser’s Add to Home Screen or Install App command.')};});
})();
