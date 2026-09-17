const STORAGE_KEY = 'haoge_workspace_v3';
const LEGACY_STORAGE_KEY = 'haoge_workspace_v2';
const MONTH_FIELDS = ['tasks','reports','tax','reportWorkflow','checklist','projects','zakou','stats'];
function localDate(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isPeriod(s){return typeof s==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);}
function isRecord(v){return !!v && typeof v==='object' && !Array.isArray(v);}
function cleanParse(raw){return JSON.parse(raw,(k,v)=>['__proto__','constructor','prototype'].includes(k)?undefined:v);}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let state={version:3,activePeriod:localDate().slice(0,7),months:{},unresolvedRecords:{},ai:{software:'千问',links:{千问:'',灵犀:''}},legacy:null};
let storageBlocked=false,storageDirty=false,lastSaved='';
function getMonthState(period=state.activePeriod){
  if(!isPeriod(period)) throw new Error('无效月份');
  if(!isRecord(state.months[period])) state.months[period]={createdAt:new Date().toISOString()};
  const m=state.months[period];
  MONTH_FIELDS.forEach(k=>{if(!isRecord(m[k]))m[k]={};});
  REPORTS.forEach(r=>{if(!isRecord(m.reports[r.id]))m.reports[r.id]={done:false};});
  TAX_COMPANIES.forEach(c=>{if(!isRecord(m.tax[c.id]))m.tax[c.id]={done:false};});
  return m;
}
function bindMonth(){const m=getMonthState();MONTH_FIELDS.forEach(k=>{state[k]=m[k];});}
function savedPayload(){const p={...state};MONTH_FIELDS.forEach(k=>delete p[k]);delete p.reportData;return p;}
function updateSaveStatus(message,error=false){const el=document.getElementById('saveStatus');if(el){el.textContent=message;el.classList.toggle('save-failed',error);}}
function saveData(){
  storageDirty=true;
  if(storageBlocked){updateSaveStatus('原记录读取异常，请先导出备份再恢复',true);return false;}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(savedPayload()));lastSaved=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});storageDirty=false;updateSaveStatus('已保存 '+lastSaved);return true;}
  catch(e){updateSaveStatus('保存失败：记录暂留内存，请立即导出备份',true);return false;}
}
function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){
      const p=cleanParse(raw);
      if(!isRecord(p)||p.version!==3||!isRecord(p.months)||!isPeriod(p.activePeriod))throw new Error('记录结构异常');
      state={...state,...p};
      if(!isRecord(state.unresolvedRecords))state.unresolvedRecords={};
      if(!isRecord(state.ai))state.ai={software:'千问',links:{千问:'',灵犀:''}};
      if(!isRecord(state.ai.links))state.ai.links={千问:'',灵犀:''};
      if(!['千问','灵犀'].includes(state.ai.software))state.ai.software='千问';
    }else{
      const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
      if(legacy)state.legacy={raw:legacy,sourceKey:LEGACY_STORAGE_KEY,assignedPeriod:null};
    }
  }catch(e){storageBlocked=true;try{state.recoveryRaw=localStorage.getItem(STORAGE_KEY);}catch(_){} }
  bindMonth();
  updateSaveStatus(storageBlocked?'旧记录读取异常，请先导出备份':state.legacy&&!state.legacy.assignedPeriod?'旧版记录待确认月份':'本地记录已载入',storageBlocked);
}
function changePeriod(value){
  if(!isPeriod(value)){showToast('请选择有效月份');return false;}
  if(!saveData()){document.getElementById('periodSelect').value=state.activePeriod;return false;}
  state.activePeriod=value;bindMonth();saveData();refreshWorkspace();return true;
}
function downloadJSON(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportBackup(){
  let reviews=null;try{reviews=localStorage.getItem('haoge_fc_reviews');}catch(_){}
  // Keep the exact review key of this legacy app alongside any other backup data.
  try{if(typeof FC_REVIEW_KEY!=='undefined')reviews=localStorage.getItem(FC_REVIEW_KEY);}catch(_){}
  downloadJSON('浩哥工作台-备份-'+localDate()+'.json',{app:'haoge-workbench',version:3,exportedAt:new Date().toISOString(),data:savedPayload(),reviews});
}
function applyBackupText(raw){
  const p=cleanParse(raw);let next;
  if(p&&p.app==='haoge-workbench'&&p.version===3)next=p.data;
  else if(p&&p.version===3&&p.months)next=p;
  else if(isRecord(p)&&(p.tasks||p.reports||p.tax)){
    state.legacy={raw,sourceKey:'导入的旧版备份',assignedPeriod:null};saveData();refreshWorkspace();return 'legacy';
  }else throw new Error('不是有效的工作台备份');
  if(!isRecord(next)||next.version!==3||!isRecord(next.months)||!isPeriod(next.activePeriod)||Object.keys(next.months).some(k=>!isPeriod(k)||!isRecord(next.months[k])))throw new Error('备份中的月份或结构无效');
  Object.values(next.months).forEach(m=>MONTH_FIELDS.forEach(k=>{if(m[k]!==undefined&&!isRecord(m[k]))throw new Error('备份状态格式无效');}));
  if(next.unresolvedRecords!==undefined&&!isRecord(next.unresolvedRecords))throw new Error('未了事项记录无效');
  const serialized=JSON.stringify(next);
  if(p.reviews!==null&&p.reviews!==undefined){if(typeof p.reviews!=='string'||!isRecord(cleanParse(p.reviews)))throw new Error('复盘备份格式无效');}
  const oldMain=localStorage.getItem(STORAGE_KEY),reviewKey=typeof FC_REVIEW_KEY!=='undefined'?FC_REVIEW_KEY:null,oldReviews=reviewKey?localStorage.getItem(reviewKey):null;
  try{localStorage.setItem(STORAGE_KEY,serialized);if(p.reviews&&reviewKey)localStorage.setItem(reviewKey,p.reviews);}
  catch(e){try{oldMain===null?localStorage.removeItem(STORAGE_KEY):localStorage.setItem(STORAGE_KEY,oldMain);if(reviewKey)oldReviews===null?localStorage.removeItem(reviewKey):localStorage.setItem(reviewKey,oldReviews);}catch(_){}throw e;}
  storageBlocked=false;loadData();refreshWorkspace();return 'v3';
}
async function importBackup(event){
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>10*1024*1024)throw new Error('备份超过10MB');const raw=await file.text();cleanParse(raw);if(!confirm('导入会替换工作台记录。请先保存即将下载的当前备份，再继续。'))return;exportBackup();applyBackupText(raw);showToast('备份已导入');}
  catch(e){showToast('未导入：'+e.message);}
}
function assignLegacyPeriod(){
  if(!state.legacy||state.legacy.assignedPeriod)return;
  const period=document.getElementById('legacyPeriod').value;if(!isPeriod(period)){showToast('请先选择旧记录所属月份');return;}
  try{
    const old=cleanParse(state.legacy.raw);if(!isRecord(old))throw new Error('旧记录格式无效');
    const m=getMonthState(period);
    if(Object.keys(m.tasks).length||Object.keys(m.reportWorkflow).length||Object.keys(m.projects).length||Object.keys(m.checklist).length||Object.values(m.tax).some(t=>t.done)){showToast('该月份已有处理记录，请选择空月份，防止覆盖');return;}
    if(!confirm('把旧记录归入 '+period+'？旧报表“完成”仅转为待核实编制状态，不自动标记已提交。'))return;
    m.tasks=isRecord(old.tasks)?old.tasks:{};if(isRecord(old.tax))m.tax={...m.tax,...old.tax};
    REPORTS.forEach(r=>{if(old.reports?.[r.id]?.done||old.reportWorkflow?.[r.id])m.reportWorkflow[r.id]='drafting';});
    state.legacy.assignedPeriod=period;bindMonth();saveData();refreshWorkspace();showToast('旧记录已归档；报表提交状态请另行核实');
  }catch(e){showToast('无法迁移：'+e.message);}
}
function resetMonthlyData(){
  if(!confirm('仅清空 '+state.activePeriod+' 的月度处理标记？历史未了不受影响。操作前将导出完整备份。'))return;
  exportBackup();state.months[state.activePeriod]={};bindMonth();saveData();refreshWorkspace();
}
function openBackupDialog(){document.getElementById('backupDialog').showModal();}
window.addEventListener('beforeunload',e=>{if(storageDirty){e.preventDefault();e.returnValue='';}});
