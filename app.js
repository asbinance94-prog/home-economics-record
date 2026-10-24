
const MEMBERS=[{n:'هاجر القامس',r:'رئيسة القسم'},{n:'مريم العرادة',r:'معلمة'},{n:'أسماء العتيبي',r:'معلمة'},{n:'عايشة الكندري',r:'معلمة'}];
const CATS=['التنمية المهنية (دورات حضرتها)','التنمية المهنية (دورات قدمتها)','القيم التربوية','الاجتماعات واللجان','الزيارات والدروس الريادية','الأنشطة والمبادرات','رعاية الموهوبات والمسابقات','التقنية والذكاء الاصطناعي في التعليم','المشاركة المجتمعية','الشهادات والتكريم'];
const SUPERVISOR=new URLSearchParams(location.search).get('view')==='supervisor';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
let entries=[],loaded=false,saving=false,requestId='',focusBeforeModal=null;
function fill(sel,arr,all){$(sel).innerHTML=(all?`<option value="">${all}</option>`:'')+arr.map(x=>`<option>${esc(x)}</option>`).join('');}
function status(message,error=false){$('status').hidden=!message;$('status').textContent=message;$('status').classList.toggle('error',error);}
function apiUrl(){const raw=window.RECORD_CONFIG?.API_URL||'';if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(raw))throw Error('لم يُربط السجل بعد. ضعي رابط تطبيق Google Apps Script المنشور في config.js.');return raw;}
async function api(action,payload={}){
 const url=apiUrl(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
 try{
  const response=await fetch(action==='list'?url+'?action=list':url,action==='list'?{signal:controller.signal,redirect:'follow',credentials:'omit',cache:'no-store'}:{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,...payload}),signal:controller.signal,redirect:'follow',credentials:'omit'});
  if(!response.ok)throw Error('تعذّر الاتصال بالخدمة ('+response.status+').');
  let result;try{result=await response.json();}catch{throw Error('استجابة غير صالحة. تحققي من نشر التطبيق وإتاحة الوصول إلى Anyone.');}
  if(!result.ok)throw Error(result.error?.message||'تعذّر تنفيذ الطلب.');
  return result;
 }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error(action==='list'?'تعذّر تحميل السجل. تحققي من الاتصال وإعداد نشر API ثم أعيدي المحاولة.':'تعذّر تأكيد العملية بسبب الاتصال. حدّثي السجل قبل إعادة المحاولة؛ قد يكون الطلب نُفّذ.');throw e;}finally{clearTimeout(timer);}
}
async function load(){status('جارٍ تحميل السجل…');try{const r=await api('list');if(!Array.isArray(r.entries))throw Error('صيغة بيانات غير صالحة.');entries=r.entries;loaded=true;render();status('');return true;}catch(e){status(e.message,true);return false;}}
function render(){
 const fm=$('fMember').value,fc=$('fCat').value;
 $('printFilter').textContent='العضوة: '+(fm||'كل الأعضاء')+' · التصنيف: '+(fc||'كل التصنيفات');
 const memCount=m=>loaded?entries.filter(e=>e.member===m).length:'—';
 const withFile=entries.filter(e=>e.fileUrl||e.link).length;
 $('totals').innerHTML=`<div class="tot"><b>${loaded?entries.length:"—"}</b>إجمالي الإنجازات</div><div class="tot"><b>${MEMBERS.length}</b>أعضاء القسم</div><div class="tot"><b>${loaded?withFile:"—"}</b>إنجازات موثقة بشاهد</div>`;
 $('members').innerHTML=MEMBERS.map(m=>`<div role="button" tabindex="0" class="mem ${fm===m.n?'active':''}" onclick="pick('fMember','${m.n}')"><div class="av">${m.n[0]}</div><b>${m.n}</b><small>${m.r}</small><span class="n">${memCount(m.n)} إنجاز</span></div>`).join('');
 const base=entries.filter(e=>!fm||e.member===fm);
 $('cats').innerHTML=CATS.map((c,i)=>`<div role="button" tabindex="0" class="cat ${fc===c?'active':''}" onclick="pick('fCat',CATS[${i}])"><b>${loaded?base.filter(e=>e.category===c).length:"—"}</b>${c}</div>`).join('');
 const list=base.filter(e=>!fc||e.category===fc).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 $('listTitle').textContent='سجل الإنجازات'+(fm?' - '+fm:'');
 $('list').innerHTML=list.length?list.map(e=>{
  e={...e,fileUrl:safeUrl(e.fileUrl),link:safeUrl(e.link)};
  const isImg=e.fileUrl&&(/^data:image/.test(e.fileUrl)||/\.(png|jpe?g|webp|gif)$/i.test(e.fileName||''));
  const imgSrc=isImg?(e.fileUrl.startsWith('data:')?e.fileUrl:e.fileUrl.replace(/\/file\/d\/([^/]+).*/,'/thumbnail?id=$1&sz=w600')):'';
  return `<div class="entry">${!SUPERVISOR?`<button class="del owner-only" data-delete-id="${esc(e.id)}">حذف</button>`:''}<h3>${esc(e.title)}</h3>
  <div class="meta">${e.example?'<span class="ex">مثال</span>':''}<span class="tag">${esc(e.category)}</span><span>${esc(e.member)}</span><span>${esc(e.date)}</span></div>
  ${e.description?`<p>${esc(e.description)}</p>`:''}${imgSrc?`<img src="${esc(imgSrc)}" alt="">`:''}
  <div>${e.fileUrl&&!isImg?`<a href="${esc(e.fileUrl)}" target="_blank" rel="noopener noreferrer">📎 ${esc(e.fileName||'الملف')}</a>`:''}${e.fileUrl&&isImg&&!e.fileUrl.startsWith('data:')?`<a href="${esc(e.fileUrl)}" target="_blank" rel="noopener noreferrer">📷 الصورة</a>`:''}${e.link?`<a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">🔗 الرابط</a>`:''}</div></div>`}).join(''):`<div class="empty">${loaded?'لا توجد إنجازات بعد':'لم تُحمّل بيانات السجل بعد'}</div>`;
}
function pick(sel,v){$(sel).value=$(sel).value===v?'':v;render();}
function openModal(){if(SUPERVISOR)return;try{apiUrl();}catch(e){status(e.message,true);return;}focusBeforeModal=document.activeElement;$('iDate').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());requestId=crypto.randomUUID();$('modal').classList.add('open');$('iMember').focus();}
function closeModal(){if(saving)return;$('departmentSecret').value='';$('modal').classList.remove('open');focusBeforeModal?.focus();}
function readFile(f){return new Promise((resolve,reject)=>{if(!f)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve({name:f.name,mimeType:f.type,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('تعذّرت قراءة الملف.'));reader.readAsDataURL(f);});}
async function save(){
 if(SUPERVISOR||saving)return;
 const entry={member:$('iMember').value,title:$('iTitle').value.trim(),category:$('iCat').value,date:$('iDate').value,description:$('iDesc').value.trim(),link:$('iLink').value.trim()};
 if(!entry.title||!entry.date)return alert('اكتبي عنوان الإنجاز والتاريخ.');
 if(entry.link&&!safeUrl(entry.link))return alert('استخدمي رابط http أو https صحيحًا.');
 if(!$('departmentSecret').value)return alert('أدخلي الرمز السري للقسم.');
 const f=$('iFile').files[0];if(f&&f.size>20*1024*1024)return alert('حجم الملف كبير (الحد 20MB)');
 saving=true;$('saveBtn').disabled=true;$('saveBtn').textContent='جاري الحفظ...';
 let saved=false;
 try{const file=await readFile(f);await api('add',{entry,file,secret:$('departmentSecret').value,requestId});saved=true;}catch(e){alert(e.message);}finally{saving=false;$('saveBtn').disabled=false;$('saveBtn').textContent='حفظ';$('departmentSecret').value='';}
 if(saved){['iTitle','iDesc','iLink','iFile'].forEach(i=>$(i).value='');closeModal();const refreshed=await load();if(!refreshed)status('تم الحفظ بنجاح، لكن تعذّر تحديث القائمة. أعيدي تحميل الصفحة.',true);}
}
function del(id){
 if(SUPERVISOR||saving)return;
 const item=entries.find(e=>e.id===id);if(!item)return;
 const dialog=document.createElement('dialog');dialog.className='delete-dialog';dialog.innerHTML=`<form><h2>حذف هذا الإنجاز؟</h2><p>${esc(item.title)}</p><label for="deleteSecret">الرمز السري للقسم</label><input type="password" id="deleteSecret" autocomplete="off" required maxlength="256"><p>يُحذف السجل من الجدول، وتبقى نسخة الشاهد في Drive.</p><div class="row"><button class="btn btn-p" type="submit">حذف</button><button class="btn btn-s" type="button" data-cancel>إلغاء</button></div></form>`;
 document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();if(saving)return;saving=true;const button=dialog.querySelector('[type=submit]');button.disabled=true;button.textContent='جارٍ الحذف…';try{await api('delete',{id,secret:dialog.querySelector('input').value});dialog.close();const refreshed=await load();if(!refreshed)status('تم الحذف، لكن تعذّر تحديث القائمة. أعيدي تحميل الصفحة.',true);}catch(e){alert(e.message);}finally{saving=false;if(dialog.isConnected){dialog.querySelector('input').value='';button.disabled=false;button.textContent='حذف';}}};
}
function toggleSup(){const url=new URL(location.href);url.searchParams.set('view','supervisor');window.open(url.href,'_blank','noopener,noreferrer');}
async function printRecord(){await document.fonts.ready;window.print();}
document.addEventListener('click',event=>{const b=event.target.closest('[data-delete-id]');if(b)del(b.dataset.deleteId);});
document.addEventListener('keydown',event=>{if(event.target.matches('.mem,.cat')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}if(!SUPERVISOR&&$('modal').classList.contains('open')){if(event.key==='Escape')closeModal();if(event.key==='Tab'){const nodes=[...$('modal').querySelectorAll('button:not(:disabled),input,select,textarea')];const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}});
fill('fMember',MEMBERS.map(m=>m.n),'كل الأعضاء');fill('fCat',CATS,'كل التصنيفات');
if(SUPERVISOR){document.body.classList.add('sup');document.querySelectorAll('.owner-only,#modal').forEach(el=>el.remove());}else{fill('iMember',MEMBERS.map(m=>m.n));fill('iCat',CATS);}
render();load();
