function refreshWorkspace(){
  // Preserve disclosure state while checkboxes update their own record.
  const opened=Array.from(document.querySelectorAll('details[id][open]')).map(x=>x.id);
  const timelineOpen=Array.from(document.querySelectorAll('.tl-stage')).map(x=>x.classList.contains('is-open'));
  const dayOpen=Array.from(document.querySelectorAll('.tl-day.expanded')).map(x=>x.id);
  updateDateDisplay();renderTodayTasks();renderTimeline();renderCycleTable();renderNotices();renderTaxGrid();renderReportCards();renderProjects();renderZakouGrid();renderTaxDiff();renderUnresolved();renderStatistics();renderFollowups();
  opened.forEach(id=>{const el=document.getElementById(id);if(el)el.open=true;});
  document.querySelectorAll('.tl-stage').forEach((el,i)=>{if(timelineOpen.length)el.classList.toggle('is-open',!!timelineOpen[i]);});
  dayOpen.forEach(id=>document.getElementById(id)?.classList.add('expanded'));
  const warning=document.getElementById('storageWarning');warning.hidden=!storageBlocked&&!(state.legacy&&!state.legacy.assignedPeriod);
  document.getElementById('storageWarningText').textContent=storageBlocked?'本地记录读取异常。原记录未覆盖，请先导出备份，再导入有效备份恢复。':'发现旧版记录，但无法确定所属月份。请在“备份与记录”中指定月份；本月不会直接沿用旧完成标记。';
}
function setRandomGlassDrop(drop,first=false){
  const pick=(min,max)=>(min+Math.random()*(max-min)).toFixed(1),duration=Number(pick(7,13));
  drop.style.setProperty('--drop-x',pick(1,97)+'%');drop.style.setProperty('--drop-y',pick(-14,96)+'%');drop.style.setProperty('--drop-width',pick(6,21)+'px');
  drop.style.setProperty('--drop-duration',duration+'s');drop.style.setProperty('--drop-delay',first?'-'+pick(0,duration)+'s':'0s');
  drop.style.setProperty('--drift-mid',pick(-4,4)+'px');drop.style.setProperty('--drift-end',pick(-5,5)+'px');drop.style.setProperty('--drift-final',pick(-6,6)+'px');
  drop.style.setProperty('--drop-mid',pick(12,36)+'px');drop.style.setProperty('--drop-end',pick(60,118)+'px');drop.style.setProperty('--drop-distance',pick(130,230)+'px');
}
function initGlassDrops(){
  const sheet=document.querySelector('.glass-sheet');if(!sheet||sheet.dataset.randomDrops==='1')return;
  const count=typeof matchMedia==='function'&&matchMedia('(max-width:720px)').matches?10:26;sheet.replaceChildren();sheet.dataset.randomDrops='1';
  for(let i=0;i<count;i++){const drop=document.createElement('span');drop.className='glass-drop';setRandomGlassDrop(drop,true);drop.addEventListener('animationiteration',()=>setRandomGlassDrop(drop));sheet.appendChild(drop);}
}
loadData();
refreshWorkspace();
fcInit();
initGlassDrops();
document.getElementById('legacyPeriod').value=state.activePeriod;
document.querySelectorAll('.nav-tab').forEach((tab,i)=>{tab.setAttribute('role','tab');tab.setAttribute('tabindex','0');tab.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tab.click();}};});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
let lastWorkspaceDate=localDate();
setInterval(()=>{const next=localDate();if(next!==lastWorkspaceDate){lastWorkspaceDate=next;refreshWorkspace();}else updateDateDisplay();},60000);
