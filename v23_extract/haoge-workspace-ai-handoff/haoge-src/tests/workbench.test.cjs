const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('浩哥工作台.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const script=scripts.join('\n');new vm.Script(script);
const boot=script.lastIndexOf('\nloadData();');assert(boot>0,'boot marker');const library=script.slice(0,boot);
const fixed=Date.parse('2026-09-14T08:00:00+08:00');
class TestDate extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
function create(initial={}){
 const elements=new Map(),store=new Map(Object.entries(initial)),downloads=[];
 function element(id){if(elements.has(id))return elements.get(id);const classes=new Set();const el={id,value:'',innerHTML:'',textContent:'',hidden:false,open:false,checked:false,dataset:{},style:{setProperty(){}},className:'',classList:{add(...x){x.forEach(k=>classes.add(k));},remove(...x){x.forEach(k=>classes.delete(k));},contains(x){return classes.has(x)},toggle(x,force){const on=force??!classes.has(x);on?classes.add(x):classes.delete(x);return on;}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},getAttribute(k){return this[k];},querySelector(s){return element(id+':'+s);},querySelectorAll(){return[];},appendChild(){},addEventListener(){},scrollIntoView(){},focus(){},select(){this.selected=true;},showModal(){this.open=true;},close(){this.open=false;},click(){if(this.download)downloads.push(this.download);}};elements.set(id,el);return el;}
 ['projectDeptFilter','projectBizFilter','projectStatusFilter'].forEach(id=>element(id).value='all');
 const doc={getElementById:element,querySelectorAll(){return[];},querySelector(){return null},createElement(tag){return element('created_'+tag+'_'+elements.size)},addEventListener(){}};
 const storage={getItem:k=>store.has(k)?store.get(k):null,setItem(k,v){store.set(k,String(v));},removeItem:k=>store.delete(k)};
 const URLMock=class extends URL{};URLMock.createObjectURL=()=> 'blob:test';URLMock.revokeObjectURL=()=>{};
 const sandbox={document:doc,localStorage:storage,console,Date:TestDate,URL:URLMock,Blob, navigator:{},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,alert(){},requestAnimationFrame(){}};
 sandbox.window=sandbox;sandbox.addEventListener=()=>{};sandbox.open=(...args)=>{sandbox.lastOpened=args;};
 const ctx=vm.createContext(sandbox);vm.runInContext(library,ctx);const run=exp=>vm.runInContext(exp,ctx);run('loadData();refreshWorkspace();');return{ctx,run,store,elements,element,downloads,storage};
}
let total=0;function test(name,fn){fn();console.log('PASS',name);total++;}
test('JavaScript parses',()=>assert(scripts.length>=1));
test('No duplicate static IDs',()=>{const markup=html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g,'');const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);assert.deepEqual(dup,[]);});
test('Cancelled tools and handlers removed',()=>{for(const text of ['id="exceptionGen"','id="excelFileInput"','id="calcRev"','function generateExceptionReport','function generateFromImport','function autoCalc','openExceptionGenerator('])assert(!html.includes(text),text);});
const app=create();
test('Fresh homepage has real routine tasks, no sample followups',()=>{assert(app.element('todayTasks').innerHTML.includes('核对银行回单'));assert(app.element('followupList').innerHTML.includes('暂未记录'));});
test('Daily task state persists after reload',()=>{app.run("toggleTaskForPeriod('2026-09','daily_14_0')");assert.equal(app.run("state.tasks.daily_14_0"),true);const reload=create(Object.fromEntries(app.store));assert.equal(reload.run('state.tasks.daily_14_0'),true);});
test('Month isolation and reversal',()=>{app.run("setProjectStatus('CF127-1','done');changePeriod('2026-10')");assert.equal(app.run("getProjectRecord('CF127-1').status"),'pending');app.run("setProjectStatus('CF127-1','waiting');changePeriod('2026-09')");assert.equal(app.run("getProjectRecord('CF127-1').status"),'done');app.run("setProjectStatus('CF127-1','working')");assert.equal(app.run("getProjectRecord('CF127-1').completedAt"),null);});
test('No tax progress fabricated from daily task checkbox',()=>{app.run("state.tasks.d9_0=true;updateTaxProgress()");assert(app.element('taxMini').textContent.includes('0/6'));app.run('toggleTax(1)');assert(app.element('taxMini').textContent.includes('1/6'));app.run('toggleTax(7)');assert.equal(app.run('state.tax[7].done'),false);});
test('Report review does not mean submitted',()=>{app.run("setReportStage(7,'review')");assert.equal(app.run('state.reports[7].done'),false);app.run("setReportStage(7,'reviewed')");assert.equal(app.run('state.reports[7].done'),false);app.run("setReportStage(7,'submitted')");assert.equal(app.run('state.reports[7].done'),true);app.run("setReportStage(7,'prepare')");assert.equal(app.run('state.reports[7].done'),false);});
test('Checklist persists per month',()=>{app.run("toggleChecklist('check_0',true);changePeriod('2026-10')");assert(!app.run('state.checklist.check_0'));app.run("changePeriod('2026-09')");assert.equal(app.run('state.checklist.check_0'),true);});
test('Short months preserve month-end task keys without impossible dates',()=>{const a=create();a.run("changePeriod('2027-02')");assert.equal(a.run('scheduledDay(30)'),28);assert(a.run("dayTasks(28).some(t=>t.key==='d30_0')"));a.run("changePeriod('2028-02')");assert.equal(a.run('scheduledDay(30)'),29);});
test('Waiting project goes to followup, completion removes monthly wait',()=>{app.run("state.projects['CF127-1']={status:'waiting',missing:'缺申请',followupDate:'2026-09-15'};renderFollowups()");assert(app.element('followupList').innerHTML.includes('缺申请'));app.run("setProjectStatus('CF127-1','done')");assert(!app.element('followupList').innerHTML.includes('缺申请'));});
test('Historical records independent across months/project completion',()=>{app.run("state.unresolvedRecords[issueItems()[0].key]={status:'working',note:'核实资料',date:'2026-09-15'};setProjectStatus('CF173','done');changePeriod('2026-10')");assert(app.run('getUnresolvedFollowups().length')>=1);assert.equal(app.run('state.unresolvedRecords[issueItems()[0].key].status'),'working');app.run("changePeriod('2026-09')");});
test('Excluded projects not counted in pending total',()=>{const before=app.run('projectSummary().total');app.run("setProjectStatus('C001','na')");assert.equal(app.run('projectSummary().total'),before-1);});
test('Project search and filters are combined',()=>{app.element('projectSearch').value='泰科';app.element('projectDeptFilter').value='二分部';app.run('renderProjects()');assert(app.element('projTbody').innerHTML.includes('没有匹配'));app.run("filterProjects('all')");assert(app.element('projTbody').innerHTML.includes('泰科老厂'));});
test('Project notes escaped',()=>{app.run("state.projects['CF127-1'].note='<img src=x onerror=alert(1)>';openProjectDetail('CF127-1')");assert(app.element('projectDetailDialog').innerHTML.includes('&lt;img'));assert(!app.element('projectDetailDialog').innerHTML.includes('<img'));});
test('Unconfigured AI uses handoff without changing report state',()=>{const before=app.run('JSON.stringify(state.reportWorkflow)');app.run('openAIHandoff()');assert(app.element('aiLaunchLink').hidden);assert(app.element('aiHandoffHelp').textContent.includes('手动打开'));assert.equal(app.run('JSON.stringify(state.reportWorkflow)'),before);});
test('AI links validated and arbitrary execution schemes rejected',()=>{assert.throws(()=>app.run("validAILink('javascript:alert(1)')"));assert.throws(()=>app.run("validAILink('file:///C:/test')"));assert.throws(()=>app.run("validAILink('https://name:pass@example.com')"));assert.equal(app.run("validAILink('https://example.com/task')"),'https://example.com/task');});
test('Configured AI waits for an explicit link click',()=>{const a=create();a.run("state.ai.links['千问']='https://example.com/task';openAIHandoff()");assert.equal(a.ctx.lastOpened,undefined);assert.equal(a.element('aiLaunchLink').hidden,false);assert.equal(a.element('aiLaunchLink').href,'https://example.com/task');assert.equal(a.run('getReportWorkflowStage(7)'),'prepare');});
test('Project followups include dated in-progress work and close history filters',()=>{const a=create();a.run("state.projects['CF127-1']={status:'working',followupDate:'2026-09-18',missing:'等签字'};renderFollowups()");assert(a.element('followupList').innerHTML.includes('等签字'));a.run("const p=PROJECTS.find(p=>p.unresolved);state.unresolvedRecords[issueItems().find(i=>i.code===p.code).key]={status:'closed'}");assert.equal(a.run("getHistoricalProjectStatus(PROJECTS.find(p=>p.unresolved).code).open"),0);});
test('Monthly workflow typography and advanced cards are intentionally quiet',()=>{assert(html.includes('#workflow .tl-summary{color:var(--workflow-ink)')||html.includes('#workflow .tl-summary,#workflow .routine-summary'));assert(html.includes('fc-maintenance'));assert(html.includes('fc-trend-card'));assert(html.includes('label: \'先做收款计划\''));assert(html.includes('placeholder="7份报表'));});
test('Invalid review backup cannot partially overwrite work records',()=>{const a=create();a.run("setProjectStatus('CF127-1','done')");const before=a.store.get('haoge_workspace_v3');a.ctx.incoming=JSON.stringify({app:'haoge-workbench',version:3,data:{version:3,activePeriod:'2026-10',months:{}},reviews:'invalid-json'});assert.throws(()=>a.run('applyBackupText(incoming)'));assert.equal(a.store.get('haoge_workspace_v3'),before);});
test('Historical issue can close, filter, reopen and persist',()=>{const a=create();a.element('issueStatus0').value='closed';a.element('issueNote0').value='实际办结凭据已留档';a.run('saveIssue(0)');assert.equal(a.run('state.unresolvedRecords[issueItems()[0].key].status'),'closed');assert(!a.element('unresolvedList').innerHTML.includes('id="issueRow0"'));a.element('issueFilter').value='closed';a.run('renderUnresolved()');assert(a.element('unresolvedList').innerHTML.includes('id="issueRow0"'));a.element('issueStatus0').value='working';a.run('saveIssue(0)');assert.equal(a.run('state.unresolvedRecords[issueItems()[0].key].status'),'working');});
test('Original business constants are preserved byte-equivalent as values',()=>{const original=fs.readFileSync('浩哥工作台-本轮修改前备份-20260914.html','utf8'),js=[...original.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');for(const name of ['MONTHLY_TASKS','NOTICES','TAX_COMPANIES','REPORTS','PROJECTS','ZAKOU_COMPANIES','TAX_DIFFS','UNRESOLVED']){const start=js.indexOf('const '+name+' = [');assert(start>=0,name);const end=js.indexOf('\n];',start);const literal=js.slice(js.indexOf('[',start),end+2);const value=vm.runInNewContext(literal);assert.equal(app.run('JSON.stringify('+name+')'),JSON.stringify(value),name);}});
test('Legacy storage preserved without assigning completion to current month',()=>{const raw=JSON.stringify({tasks:{d9_0:true},reports:{7:{done:true}},tax:{1:{done:true}},reportData:[{name:'保留旧录入'}]});const a=create({haoge_workspace_v2:raw});assert.equal(a.run('state.tax[1].done'),false);assert.equal(a.run('getReportWorkflowStage(7)'),'prepare');assert.equal(a.run('state.legacy.raw'),raw);assert.equal(a.store.get('haoge_workspace_v2'),raw);a.element('legacyPeriod').value='2026-08';a.run('assignLegacyPeriod()');assert.equal(a.run("state.months['2026-08'].reportWorkflow[7]"),'drafting');assert.equal(a.store.get('haoge_workspace_v2'),raw);});
test('Corrupt records never overwritten silently',()=>{const a=create({haoge_workspace_v3:'{bad-json'});assert.equal(a.run('saveData()'),false);assert.equal(a.store.get('haoge_workspace_v3'),'{bad-json');assert(a.element('saveStatus').textContent.includes('读取异常'));});
test('Save failure shown and remains unsaved',()=>{const a=create();a.storage.setItem=()=>{throw Error('quota')};assert.equal(a.run('saveData()'),false);assert(a.element('saveStatus').textContent.includes('保存失败'));assert.equal(a.run('storageDirty'),true);});
test('Invalid months and malformed backup rejected',()=>{assert.throws(()=>app.run("getMonthState('2026-99')"));assert.throws(()=>app.run("applyBackupText('{\"version\":3,\"months\":[],\"activePeriod\":\"2026-09\"}')"));});
test('V3 backup roundtrip retains notes and histories',()=>{const payload=app.run('JSON.stringify({app:"haoge-workbench",version:3,data:savedPayload()})');const a=create();a.ctx.incoming=payload;a.run('applyBackupText(incoming)');assert.equal(a.run("state.projects['CF127-1'].note"),'<img src=x onerror=alert(1)>');assert.equal(a.run('state.unresolvedRecords[issueItems()[0].key].status'),'working');});
test('All static inline event function references exist',()=>{const events=[...html.slice(0,html.indexOf('<script>')).matchAll(/\bon\w+="([^"]*)"/g)].map(x=>x[1]);const refs=new Set(events.flatMap(s=>[...s.matchAll(/(?<![.\w])([A-Za-z_$][\w$]*)\s*\(/g)].map(x=>x[1])));for(const name of refs)if(!['if','function'].includes(name))assert.equal(app.run('typeof '+name),'function',name);});
test('Monthly timeline omits routine-only dates but keeps all real milestones',()=>{
 const a=create(),timeline=a.element('timelineSection').innerHTML;
 assert.equal(a.run('monthlyMilestones().length'),16);
 assert(!timeline.includes('日常开票制单、银行回单处理'));
 for(const day of [13,14,15,16,17,18,19,21,22,23,24,25,28,29])assert(!timeline.includes('id="tlDay'+day+'"'));
 for(const day of [1,2,3,4,5,6,7,8,9,10,11,12,20,26,27,30])assert(timeline.includes('id="tlDay'+day+'"'));
 for(const text of ['完成上月31日（或月末最后一天）的银行回单录入','核对总账收入','装订上月凭证','3 个关键节点'])assert(timeline.includes(text),text);
 assert(!timeline.includes('daily_'));
});
test('Today keeps daily routines while deduplicating monthly routine placeholder',()=>{
 const a=create();
 for(const [period,days] of [['2026-09',30],['2026-10',31],['2027-02',28],['2028-02',29]])for(let day=1;day<=days;day++){
  assert.equal(a.run(`dayTasks(${day},'${period}').filter(t=>t.key.startsWith('daily_${day}_')).length`),3);
  assert(!a.run(`dayTasks(${day},'${period}').some(t=>t.t==='日常开票制单、银行回单处理')`));
 }
});
test('Filtering within mixed days keeps original keys and completion counts',()=>{
 const a=create();a.run("MONTHLY_TASKS.push({day:31,tasks:[{t:'日常开票制单、银行回单处理',pri:'mid'},{t:'专项测试节点',pri:'high'}]});state.tasks.d31_1=true;renderTimeline()");
 const timeline=a.element('timelineSection').innerHTML;
 assert(timeline.includes("toggleTaskForPeriod('2026-09','d31_1')"));assert(!timeline.includes("'d31_0'"));
 assert(timeline.includes('<span class="tl-more">1/1</span>'));
 assert(a.run('monthlyMilestones().find(d=>d.day===31).tasks[0].key')==='d31_1');
});
test('Routine records keep selected day on completion and share Today state',()=>{
 const a=create();a.run("renderRoutineDay(6);toggleTaskForPeriod('2026-09','daily_6_0')");
 assert.equal(a.element('routineDay').value,'6');assert(a.element('routineDayTasks').innerHTML.includes("'daily_6_0'"));
 assert(a.element('routineDayTasks').innerHTML.includes('is-done'));assert(!a.run('state.tasks.daily_14_0'));
 a.run("renderRoutineDay(14);toggleTaskForPeriod('2026-09','daily_14_1')");
 assert(a.element('doneTasksList').innerHTML.includes('统一开票制单'));
 const reload=create(Object.fromEntries(a.store));assert.equal(reload.run('state.tasks.daily_6_0'),true);assert.equal(reload.run('state.tasks.daily_14_1'),true);
});
test('Routine date stays valid across month changes, short months and invalid input',()=>{
 const a=create();a.run("renderRoutineDay(30);changePeriod('2027-02')");
 assert.equal(a.element('routineDay').value,'14');assert.equal(a.element('routineDay').max,'28');assert.equal(a.element('routinePeriod').textContent,'2027年02月');
 for(const [input,expected] of [[31,28],[0,1],[-1,1],[5.8,5],['invalid',1]]){a.ctx.routineInput=input;a.run('renderRoutineDay(routineInput)');assert.equal(a.element('routineDay').value,String(expected));}
 a.run("changePeriod('2028-02');renderRoutineDay(31)");assert.equal(a.element('routineDay').value,'29');
});
test('Independent routines are collapsed by default; monthly follow-through stays monthly',()=>{
 const staticHTML=html.slice(0,html.indexOf('<script>'));
 const tag=staticHTML.match(/<details[^>]*id="dailyRoutineSection"[^>]*>/)[0];assert(!/\sopen(?:\s|>|=)/.test(tag));
 const routineStart=staticHTML.indexOf(tag),routineEnd=staticHTML.indexOf('<!-- Weekly Routine -->',routineStart);
 assert(routineStart>staticHTML.indexOf('id="timelineSection"></div>'));
 const routineHTML=staticHTML.slice(routineStart,routineEnd);assert(routineHTML.includes('id="routineDayTasks"'));assert(!routineHTML.includes('阳光食堂'));
 assert(staticHTML.slice(staticHTML.indexOf('id="timelineSection"'),routineStart).includes('CF160/CF173/CF174/CF175/CF177/CF179/CF180'));
});
test('Existing routine-placeholder completion records survive the new view',()=>{
 const a=create();a.run("state.tasks.d13_0=true;saveData();renderTimeline()");
 const reload=create(Object.fromEntries(a.store));assert.equal(reload.run('state.tasks.d13_0'),true);assert(!reload.element('timelineSection').innerHTML.includes('id="tlDay13"'));
});
test('Standalone HTML contains synchronized routine script and layout styles',()=>{
 const normalized=html.replace(/\r\n/g,'\n');
 for(const file of ['src/daily.js','src/workflow.css'])assert(normalized.includes(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').trim()),file);
});
console.log(`\n${total} checks passed. DOM behavior exercised with an in-memory test double; this is NOT browser or screenshot verification.`);
