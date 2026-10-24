/** JSON API for the existing department record. No HTML is served.
 * Deploy as Web app / Execute as me / Anyone.
 * CORS: use simple GET or POST text/plain containing JSON, no custom headers.
 * ContentService redirects responses to script.googleusercontent.com.
 * Apps Script TextOutput cannot set arbitrary CORS headers or implement OPTIONS.
 */
const SHEET_NAME = 'الإنجازات';
const FOLDER_NAME = 'شواهد السجل الإنجازي - الاقتصاد المنزلي';
const HEADERS = ['المعرف','العضوة','العنوان','التصنيف','التاريخ','الوصف','الرابط','رابط الملف','اسم الملف','تاريخ الإضافة'];

const MEMBERS=[{n:'هاجر القامس',r:'رئيسة القسم'},{n:'مريم العرادة',r:'معلمة'},{n:'أسماء العتيبي',r:'معلمة'},{n:'عايشة الكندري',r:'معلمة'}];
const CATS=['التنمية المهنية (دورات حضرتها)','التنمية المهنية (دورات قدمتها)','القيم التربوية','الاجتماعات واللجان','الزيارات والدروس الريادية','الأنشطة والمبادرات','رعاية الموهوبات والمسابقات','التقنية والذكاء الاصطناعي في التعليم','المشاركة المجتمعية','الشهادات والتكريم'];
const MAX_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4','video/webm','video/quicktime'];
function json_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function fail_(code,message) { const err=new Error(message);err.code=code;throw err; }
function error_(err) { return json_({ok:false,error:{code:err.code||'SERVER_ERROR',message:err.code?err.message:'تعذّر تنفيذ العملية. راجعي إعدادات المشروع وصلاحيات Sheets وDrive وسجل التنفيذ.'}}); }
function doGet(e) {
 try { if(e&&e.parameter&&e.parameter.action&&e.parameter.action!=='list')fail_('INVALID_ACTION','القراءة فقط متاحة عبر GET.');return json_({ok:true,entries:getEntries_()}); } catch(err){return error_(err);}
}
function doPost(e) {
 try {
  const raw=e&&e.postData&&e.postData.contents;
  if(!raw||raw.length>Math.ceil(MAX_BYTES*4/3)+50000)fail_('INVALID_REQUEST','الطلب فارغ أو أكبر من الحد المسموح.');
  let body;try{body=JSON.parse(raw);}catch(err){fail_('INVALID_JSON','صيغة JSON غير صالحة.');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail_('INVALID_REQUEST','طلب غير صالح.');
  authorize_(body.secret);
  if(!['add','delete','upload'].includes(body.action))fail_('INVALID_ACTION','عملية غير معروفة.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_('BUSY','السجل مشغول. أعيدي المحاولة بعد قليل.');
  try{
   if(body.action==='add')return json_(addEntry_(body.entry,body.file,body.requestId));
   if(body.action==='delete')return json_(deleteEntry_(body.id));
   return json_(attachEvidence_(body.id,body.file));
  }finally{lock.releaseLock();}
 }catch(err){return error_(err);}
}
function authorize_(secret){
 const expected=PropertiesService.getScriptProperties().getProperty('DEPARTMENT_SECRET');
 if(!expected||expected.length<16)fail_('NOT_CONFIGURED','يجب إعداد DEPARTMENT_SECRET بطول 16 حرفًا على الأقل في Script Properties.');
 if(typeof secret!=='string'||secret.length>256)fail_('UNAUTHORIZED','الرمز السري غير صحيح.');
 const a=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,secret,Utilities.Charset.UTF_8);
 const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,expected,Utilities.Charset.UTF_8);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 if(diff!==0)fail_('UNAUTHORIZED','الرمز السري غير صحيح.');
}
/** Run once in the editor. Reuses existing IDs, creates only when an ID is absent. */
function setupBackend(){
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const props=PropertiesService.getScriptProperties();let id=props.getProperty('SHEET_ID');
  const ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('السجل الإنجازي - قسم الاقتصاد المنزلي');
  if(!id)props.setProperty('SHEET_ID',ss.getId());
  let sh=ss.getSheetByName(SHEET_NAME);if(!sh){sh=ss.insertSheet(SHEET_NAME);sh.appendRow(HEADERS);sh.setFrozenRows(1);sh.setRightToLeft(true);}
  const folderId=props.getProperty('FOLDER_ID');if(folderId)DriveApp.getFolderById(folderId);else props.setProperty('FOLDER_ID',DriveApp.createFolder(FOLDER_NAME).getId());
  getSheet_();
 }finally{lock.releaseLock();}
}
function getSheet_(){
 const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');
 if(!id)fail_('NOT_CONFIGURED','شغّلي setupBackend أولًا أو أضيفي SHEET_ID الخاص بالسجل الحالي.');
 const sh=SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
 if(!sh)fail_('SHEET_MISSING','ورقة الإنجازات غير موجودة في الجدول المحدد.');
 const headers=sh.getRange(1,1,1,HEADERS.length).getValues()[0];
 if(headers.some((h,i)=>h!==HEADERS[i]))fail_('SCHEMA_MISMATCH','عناوين أعمدة السجل لا تطابق النسخة الأصلية.');
 return sh;
}
function getFolder_(){const id=PropertiesService.getScriptProperties().getProperty('FOLDER_ID');if(!id)fail_('NOT_CONFIGURED','شغّلي setupBackend لإعداد مجلد الشواهد.');return DriveApp.getFolderById(id);}
function getEntries_(){
 const rows=getSheet_().getDataRange().getValues();rows.shift();
 return rows.filter(r=>r[0]).map(r=>({id:String(r[0]),member:String(r[1]),title:String(r[2]),category:String(r[3]),date:r[4] instanceof Date?Utilities.formatDate(r[4],'Asia/Kuwait','yyyy-MM-dd'):String(r[4]),description:String(r[5]),link:String(r[6]),fileUrl:String(r[7]),fileName:String(r[8])})).reverse();
}
function text_(value,max,required){if(typeof value!=='string')value='';value=value.trim();if(value.length>max||(required&&!value))fail_('VALIDATION','تحققي من الحقول المطلوبة وأطوال النصوص.');return value;}
function validateEntry_(entry){
 if(!entry||typeof entry!=='object')fail_('VALIDATION','بيانات الإنجاز مطلوبة.');
 const out={member:text_(entry.member,100,true),title:text_(entry.title,300,true),category:text_(entry.category,150,true),date:text_(entry.date,10,true),description:text_(entry.description||'',10000,false),link:text_(entry.link||'',2048,false)};
 if(!MEMBERS.some(m=>m.n===out.member)||!CATS.includes(out.category))fail_('VALIDATION','العضوة أو التصنيف غير صحيح.');
 const date=new Date(out.date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(out.date)||isNaN(date.getTime())||date.toISOString().slice(0,10)!==out.date)fail_('VALIDATION','التاريخ غير صحيح.');
 if(out.link&&!/^https?:\/\/[^\s<>"']+$/i.test(out.link))fail_('VALIDATION','الرابط يجب أن يبدأ بـ https:// أو http://.');
 return out;
}
function validateFile_(file){
 if(!file)return null;
 if(typeof file!=='object'||typeof file.data!=='string'||!file.data||file.data.length>Math.ceil(MAX_BYTES/3)*4||file.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.data))fail_('INVALID_FILE','ملف الشاهد غير صالح أو يتجاوز 20MB.');
 if(!MIME_TYPES.includes(file.mimeType))fail_('INVALID_FILE','نوع الملف غير مدعوم. استخدمي صورة JPG أو PNG أو WebP أو GIF، أو PDF، أو فيديو MP4 أو WebM أو MOV.');
 const name=text_(file.name,200,true).replace(/[\x00-\x1f/\\]/g,'_');
 let bytes;try{bytes=Utilities.base64Decode(file.data);}catch(err){fail_('INVALID_FILE','تعذّر قراءة الملف.');}
 if(bytes.length>MAX_BYTES||!bytes.length)fail_('INVALID_FILE','حجم الملف غير صالح.');
 return {name,mimeType:file.mimeType,bytes};
}
function writeFile_(file,member){
 if(!file)return null;const folder=getFolder_();const folders=folder.getFoldersByName(member);const sub=folders.hasNext()?folders.next():folder.createFolder(member);
 const created=sub.createFile(Utilities.newBlob(file.bytes,file.mimeType,file.name));
 try{created.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return created;}catch(err){created.setTrashed(true);throw err;}
}
function rowFor_(sh,id){if(typeof id!=='string'||id.length>100)fail_('VALIDATION','معرّف غير صالح.');const ids=sh.getDataRange().getValues();for(let i=1;i<ids.length;i++)if(String(ids[i][0])===id)return i+1;return 0;}
// Prefix formula-like values so Sheets never evaluates user-provided formulas.
function cell_(s){return /^[=+@\-\t\r]/.test(s)?"'"+s:s;}
function addEntry_(entry,file,requestId){
 if(typeof requestId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))fail_('VALIDATION','معرّف الطلب غير صالح.');
 const value=validateEntry_(entry),validatedFile=validateFile_(file),sh=getSheet_();
 if(rowFor_(sh,requestId))return {ok:true,id:requestId,duplicate:true};
 let uploaded=null;
 try{uploaded=writeFile_(validatedFile,value.member);sh.appendRow([requestId,cell_(value.member),cell_(value.title),cell_(value.category),value.date,cell_(value.description),cell_(value.link),uploaded?uploaded.getUrl():'',uploaded?cell_(uploaded.getName()):'',new Date()]);SpreadsheetApp.flush();return {ok:true,id:requestId};}
 catch(err){if(uploaded&&!rowFor_(sh,requestId))uploaded.setTrashed(true);throw err;}
}
function deleteEntry_(id){const sh=getSheet_(),row=rowFor_(sh,id);if(row)sh.deleteRow(row);return {ok:true,deleted:!!row};}
/** Optional API operation for attaching a first file to an existing record. */
function attachEvidence_(id,file){
 const validated=validateFile_(file);if(!validated)fail_('INVALID_FILE','ملف الشاهد مطلوب.');
 const sh=getSheet_(),row=rowFor_(sh,id);if(!row)fail_('NOT_FOUND','الإنجاز غير موجود.');
 const values=sh.getRange(row,1,1,10).getValues()[0];if(values[7])fail_('FILE_EXISTS','يوجد شاهد بالفعل لهذا الإنجاز.');
 const uploaded=writeFile_(validated,String(values[1]));
 try{sh.getRange(row,8,1,2).setValues([[uploaded.getUrl(),cell_(uploaded.getName())]]);SpreadsheetApp.flush();return {ok:true,fileUrl:uploaded.getUrl(),fileName:uploaded.getName()};}catch(err){const stored=sh.getRange(row,8).getValue();if(stored!==uploaded.getUrl())uploaded.setTrashed(true);throw err;}
}
