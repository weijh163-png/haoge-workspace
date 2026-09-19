function getTodayDay(){return new Date().getDate();}
function currentWorkDay(){return Math.min(getTodayDay(),new Date(+state.activePeriod.slice(0,4),+state.activePeriod.slice(5),0).getDate());}
function updateDateDisplay(){
  const now=new Date(),live=state.activePeriod===localDate(now).slice(0,7);
  const date=document.getElementById('dashboardDate');
  const monthLabel=state.activePeriod.replace('-','年')+'月';
  if(date)date.textContent=live?`${now.getMonth()+1}月${now.getDate()}日 · 星期${'日一二三四五六'[now.getDay()]}`:`正在查看 ${monthLabel} 的工作记录`;
  const title=document.getElementById('dashboardTitle');if(title)title.textContent=live?'今天，先做好重要的事':`${monthLabel}工作记录`;
  const todayTitle=document.getElementById('todayTitle');if(todayTitle?.firstChild)todayTitle.firstChild.textContent=live?'今日安排':'本月记录';
  const todayLink=document.getElementById('todayPeriodLink');if(todayLink){todayLink.textContent=live?'查看本月':'回到当前月';todayLink.onclick=()=>live?switchTab('workflow'):changePeriod(localDate(now).slice(0,7));}
  const period=document.getElementById('periodSelect');if(period)period.value=state.activePeriod;
  const remaining=Math.round((new Date(2026,10,14)-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
  document.getElementById('examMiniText').textContent=remaining>0?`还有 ${remaining} 天 · 11月14–15日`:remaining>=-1?'考试期间 · 查看安排':'考试日期已过 · 查看安排';
  const day=currentWorkDay(),phases=[['月初报送','1–10日',day<=10],['月中跟进','11–25日',day>10&&day<=25],['月末收口','26日–月底',day>25]];
  document.getElementById('rhythmStages').innerHTML=phases.map(p=>`<button class="rhythm-stage${live&&p[2]?' current':''}" onclick="switchTab('workflow')"><strong>${p[0]}</strong><span>${p[1]}${live&&p[2]?' · 当前阶段':''}</span></button>`).join('');
}
const DAILY_ROUTINES=[{t:'核对银行回单',detail:'核对到账项目与收款金额',time:'每天'},{t:'统一开票制单',detail:'检查开票申请、应收单与跨期收入',time:'15:00'},{t:'跟进第三方补开票',detail:'按实际缺失资料提前催办',time:'每天'}];
function scheduledDay(day,period=state.activePeriod){return Math.min(day,new Date(+period.slice(0,4),+period.slice(5),0).getDate());}
function dayTasks(day,period=state.activePeriod){
  const scheduled=MONTHLY_TASKS.filter(x=>scheduledDay(x.day,period)===day).flatMap(d=>d.tasks.map((t,i)=>({...t,key:'d'+d.day+'_'+i,time:day+'日',period}))).filter(t=>t.t!=='日常开票制单、银行回单处理');
  return scheduled.concat(DAILY_ROUTINES.map((t,i)=>({...t,key:'daily_'+day+'_'+i,pri:'low',period})));
}
function monthHasActivity(period){
  const m=state.months[period];if(!isRecord(m))return false;
  if(Object.keys(m.tasks||{}).length)return true;
  if(Object.values(m.reportWorkflow||{}).some(v=>v&&v!=='prepare'))return true;
  if(Object.values(m.reports||{}).some(v=>v&&((v.done)||v.updatedAt)))return true;
  if(Object.values(m.tax||{}).some(v=>v&&((v.done)||v.updatedAt)))return true;
  if(Object.keys(m.checklist||{}).length||Object.keys(m.projects||{}).length||Object.keys(m.unresolvedRecords||{}).length)return true;
  return false;
}
function taskMarkup(task,period=state.activePeriod){
  const done=!!getMonthState(period).tasks[task.key];
  return `<label class="task-row${done?' is-done':''}"><span class="task-time">${escapeHTML(task.time||'待办')}</span><input type="checkbox" ${done?'checked':''} onchange="toggleTaskForPeriod('${period}','${task.key}')" aria-label="${escapeHTML(task.t)}"><span class="task-copy"><strong>${escapeHTML(task.t)}</strong><small>${escapeHTML(task.detail||(task.pri==='high'?'关键节点 · 核实后勾选完成':'按实际处理情况记录'))}</small></span></label>`;
}
function renderTodayTasks(){
  const live=state.activePeriod===localDate().slice(0,7);
  let tasks=live?dayTasks(currentWorkDay()):MONTHLY_TASKS.flatMap(d=>d.tasks.map((t,i)=>({...t,key:'d'+d.day+'_'+i,time:scheduledDay(d.day)+'日',period:state.activePeriod}))).filter(t=>t.t!=='日常开票制单、银行回单处理');
  tasks.sort((a,b)=>({high:0,mid:1,low:2}[a.pri]??1)-({high:0,mid:1,low:2}[b.pri]??1));
  const pending=tasks.filter(t=>!state.tasks[t.key]),done=tasks.filter(t=>state.tasks[t.key]);
  document.getElementById('todayTasks').innerHTML=pending.slice(0,3).map(t=>taskMarkup(t)).join('')||'<div class="empty-state">当前清单已完成。需要时可查看本月其他工作。</div>';
  document.getElementById('todoCnt').textContent=pending.length+' 项';
  document.getElementById('moreTasks').hidden=pending.length<=3;
  document.getElementById('moreTaskCount').textContent=Math.max(0,pending.length-3)+' 项';
  document.getElementById('moreTasksList').innerHTML=pending.slice(3).map(t=>taskMarkup(t)).join('');
  document.getElementById('doneCount').textContent=done.length;
  document.getElementById('doneTasksList').innerHTML=done.map(t=>taskMarkup(t)).join('')||'<p class="empty-state">暂无完成记录</p>';
  const earlier=[];
  Object.keys(state.months).filter(p=>p<=state.activePeriod&&(p===state.activePeriod||monthHasActivity(p))).sort().reverse().forEach(p=>{
    const cutoff=p<state.activePeriod?32:live?currentWorkDay():0;
    MONTHLY_TASKS.filter(d=>scheduledDay(d.day,p)<cutoff).forEach(d=>d.tasks.forEach((t,i)=>{if(t.t==='日常开票制单、银行回单处理')return;const key='d'+d.day+'_'+i;if(!getMonthState(p).tasks[key])earlier.push({...t,key,period:p,time:p.slice(5)+'/'+scheduledDay(d.day,p),detail:p+' · 尚未记录完成，请核实实际情况'});}));
  });
  document.getElementById('earlierCount').textContent=earlier.length+' 项';
  document.getElementById('earlierTaskList').innerHTML=earlier.map(t=>taskMarkup(t,t.period)).join('')||'<p class="empty-state">暂无较早的未完成记录</p>';
}
function toggleTaskForPeriod(period,key){
  if(!isPeriod(period)||!/^d\d+_\d+$|^daily_\d+_\d+$/.test(key))return;
  const m=getMonthState(period);m.tasks[key]=!m.tasks[key];if(saveData())refreshWorkspace();else refreshWorkspace();
}
function toggleDayTask(key){toggleTaskForPeriod(state.activePeriod,key);}
function renderFollowups(){
  const list=[...getProjectFollowups(),...getUnresolvedFollowups()];
  list.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  document.getElementById('followupCount').textContent=list.length+' 项';
  document.getElementById('followupList').innerHTML=list.slice(0,4).map(item=>`<div class="followup-row"><strong>${escapeHTML(item.name)}</strong><p>${escapeHTML(item.detail||'待补充跟进说明')}</p><small>${escapeHTML(item.date?item.date+(item.date<localDate()?' · 待跟进':''):'未设跟进日期')}${item.contact?' · '+escapeHTML(item.contact):''}</small><button class="text-button" onclick="${item.source==='extra'?"switchTab('extra')":"openProjectDetail('"+item.code+"')"}">记录跟进</button></div>`).join('')||'<div class="empty-state">暂未记录待催办事项。<br>在项目详情中标记“待资料”，或在未了事项中设置跟进日期，即会在这里显示。</div>';
  if(list.length>4)document.getElementById('followupList').innerHTML+='<p class="section-hint">另有 '+(list.length-4)+' 项，请进入对应模块查看。</p>';
}
function monthlyMilestones(){
  // Only the monthly view omits routine placeholders; preserve original task keys and Today behavior.
  return MONTHLY_TASKS.map(d=>({...d,tasks:d.tasks.map((t,i)=>({...t,key:'d'+d.day+'_'+i})).filter(t=>t.t!=='日常开票制单、银行回单处理')})).filter(d=>d.tasks.length);
}
function renderTimeline(){
  const container=document.getElementById('timelineSection');if(!container)return;
  const live=state.activePeriod===localDate().slice(0,7),today=currentWorkDay();
  const phases=[{label:'月初报送',range:'1–10日',desc:'报表编制、统计申报与税务交付',days:[1,10]}, {label:'月中跟进',range:'11–25日',desc:'上月补开票跟进与凭证装订',days:[11,25]},{label:'月末收口',range:'26日–月底',desc:'收款计划、扎口平账与月末核对',days:[26,31]}];
  const milestones=monthlyMilestones();
  container.innerHTML=phases.map(p=>{
    const days=milestones.filter(d=>d.day>=p.days[0]&&d.day<=p.days[1]);
    return `<section class="tl-stage${live&&today>=p.days[0]&&today<=p.days[1]?' is-open':''}"><button class="tl-stage-head" onclick="toggleGrp(this)"><span class="tl-stage-copy"><span class="tl-stage-name">${p.label} · ${p.range}</span><span class="tl-stage-desc">${p.desc}</span></span><span class="tl-stage-count">${days.length} 个关键节点</span><span class="tl-stage-arrow">›</span></button><div class="tl-stage-days">${days.map(d=>{
      const count=d.tasks.filter(t=>state.tasks[t.key]).length;
      return `<article class="tl-day${live&&scheduledDay(d.day)===today?' today expanded':''}" id="tlDay${d.day}"><button class="tl-day-head" onclick="togglePhase(${d.day})"><span class="tl-date"><strong>${String(scheduledDay(d.day)).padStart(2,'0')}</strong><small>${scheduledDay(d.day)!==d.day?'月末':'日'}</small></span><span class="tl-day-copy"><span class="tl-summary">${escapeHTML(d.tasks[0].t)}</span></span><span class="tl-more">${count}/${d.tasks.length}</span></button><div class="tl-detail">${d.tasks.map(t=>taskMarkup({...t,time:scheduledDay(d.day)+'日'})).join('')}</div></article>`;
    }).join('')}</div></section>`;
  }).join('');
  const input=document.getElementById('routineDay');
  if(input)renderRoutineDay(input.dataset.view===state.activePeriod+'|'+localDate()?input.value:today);
}
function renderRoutineDay(value){
  const max=new Date(+state.activePeriod.slice(0,4),+state.activePeriod.slice(5),0).getDate(),day=Math.min(max,Math.max(1,Math.trunc(Number(value))||1));
  const input=document.getElementById('routineDay');
  input.max=String(max);input.value=String(day);input.dataset.view=state.activePeriod+'|'+localDate();
  document.getElementById('routinePeriod').textContent=state.activePeriod.replace('-','年')+'月';
  document.getElementById('routineDayTasks').innerHTML=DAILY_ROUTINES.map((t,i)=>taskMarkup({...t,key:'daily_'+day+'_'+i})).join('');
}
function toggleGrp(headEl){headEl.parentElement.classList.toggle('is-open');}
function togglePhase(day){document.getElementById('tlDay'+day)?.classList.toggle('expanded');}
function renderCycleTable(){const el=document.getElementById('cycleTable');if(!el)return;el.innerHTML='<p class="section-hint">关键节点已整合到上方阶段视图。原交接记录中“3号前提交”和“4号编制定稿”存在时间差异，请按实际要求确认；本次不擅自改动业务节点。</p>';}
