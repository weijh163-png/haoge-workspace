import io, re

p = '浩哥工作台-v2.1.html'
s = io.open(p, encoding='utf-8').read()

# 1. state 初始化添加 customProjects / hiddenProjects
s = s.replace(
    "let state={version:3,activePeriod:localDate().slice(0,7),months:{},unresolvedRecords:{},ai:{software:'千问',links:{千问:'',灵犀:''}},legacy:null};",
    "let state={version:3,activePeriod:localDate().slice(0,7),months:{},unresolvedRecords:{},ai:{software:'千问',links:{千问:'',灵犀:''}},customProjects:[],hiddenProjects:[],legacy:null};"
)

# 2. 添加 getProjectList 函数（插在 setProjectStatus 前面）
s = s.replace(
    'function setProjectStatus(code,status){',
    "function getProjectList(){return PROJECTS.concat(state.customProjects||[]).filter(p=>!(state.hiddenProjects||[]).includes(p.code));}\nfunction setProjectStatus(code,status){"
)

# 3. 6 处 PROJECTS 引用替换（跳过定义处 const PROJECTS = [）
s = s.replace('const rows=PROJECTS.filter(p=>{', 'const rows=getProjectList().filter(p=>{')
s = s.replace("const rows=PROJECTS.map(p=>getProjectRecord(p.code));", "const rows=getProjectList().map(p=>getProjectRecord(p.code));")
s = s.replace("if(!PROJECTS.some(p=>p.code===code)||!Object.hasOwn(PROJECT_STATUS,status))return;", "if(!getProjectList().some(p=>p.code===code)||!Object.hasOwn(PROJECT_STATUS,status))return;")
s = s.replace("const p=PROJECTS.find(p=>p.code===code);if(!p)return;", "const p=getProjectList().find(p=>p.code===code);if(!p)return;")
s = s.replace('return PROJECTS.flatMap(p=>{', 'return getProjectList().flatMap(p=>{')
s = s.replace("'+PROJECTS.length+'", "'+getProjectList().length+'")

# 4. 隐蔽管理入口 HTML（ledger-options 区域）
old_options = '''    <div class="ledger-options">
      <label><input type="checkbox" id="projectProxyFilter" onchange="readProjectFilters()">仅代管项目</label>
      <label><input type="checkbox" id="projectUnresolvedFilter" onchange="readProjectFilters()">有历史未了</label>
      <button class="btn btn-outline btn-sm" onclick="filterProjects('all')">清除筛选</button>
      <span class="ledger-count" id="projectFilterCount" aria-live="polite"></span>
    </div>'''
new_options = '''    <div class="ledger-options">
      <label><input type="checkbox" id="projectProxyFilter" onchange="readProjectFilters()">仅代管项目</label>
      <label><input type="checkbox" id="projectUnresolvedFilter" onchange="readProjectFilters()">有历史未了</label>
      <button class="btn btn-outline btn-sm" onclick="filterProjects('all')">清除筛选</button>
      <button type="button" class="text-button proj-manage-btn" onclick="openProjectManager()" title="管理自定义项目">⚙ 管理</button>
      <span class="ledger-count" id="projectFilterCount" aria-live="polite"></span>
    </div>'''
s = s.replace(old_options, new_options)

# 5. 添加管理弹窗 dialog（紧跟 projectDetailDialog 后面）
old_dialog = '<dialog class="project-detail-dialog detail-panel" id="projectDetailDialog" aria-labelledby="projectDetailTitle"></dialog>'
new_dialog = old_dialog + '''\n<dialog class="project-detail-dialog" id="projectManagerDialog" aria-labelledby="projectManagerTitle"><div class="detail-header"><div><h2 id="projectManagerTitle">项目管理</h2><p class="detail-period">添加自定义项目或移除不再跟踪的项目</p></div><button class="btn btn-outline btn-sm" onclick="this.closest('dialog').close()">关闭</button></div><div class="detail-body"><div class="detail-form" style="grid-template-columns:1fr 1fr"><label>项目编码<input id="pmCode" placeholder="如 CF999" maxlength="20"></label><label>项目名称<input id="pmName" placeholder="项目名称" maxlength="40"></label><label>分部<select id="pmDept"><option value="餐饮一分部">餐饮一分部</option><option value="餐饮二分部">餐饮二分部</option><option value="餐饮三分部">餐饮三分部</option><option value="餐饮五分部">餐饮五分部</option><option value="餐饮六分部">餐饮六分部</option><option value="餐饮职能部门">餐饮职能部门</option></select></label><label>业务类型<select id="pmType"><option value="">待补充</option><option value="差额结算">差额结算</option><option value="人员服务">人员服务</option><option value="全额结算">全额结算</option><option value="职能部门">职能部门</option></select></label><label>对接人<input id="pmContact" placeholder="联系人" maxlength="20"></label><label>成本会计<input id="pmCostAcc" placeholder="成本会计" maxlength="20"></label><label class="detail-wide">核算要点<textarea id="pmNotes" rows="2" placeholder="特殊核算规则"></textarea></label></div><div class="detail-actions" style="margin-top:16px"><span class="detail-save-note">自定义项目保存在本地，换设备需重新添加。</span><button class="btn btn-pri" type="button" onclick="addCustomProject()">添加项目</button></div><div id="pmCustomList" style="margin-top:20px"><p class="section-hint">暂无自定义项目</p></div><div style="margin-top:20px;border-top:1px solid #e3edf4;padding-top:16px"><p class="section-hint">下方列出全部项目；点击“隐藏”可将项目从台账中移除（不影响历史记录）。已隐藏项目可在此恢复显示。</p><div id="pmAllList"></div></div></div></dialog>'''
s = s.replace(old_dialog, new_dialog)

# 6. CSS 样式（在 #projects style 结束前的 @media 区域之前插入）
old_css = '    @media(max-width:900px){#projects .ledger-heading{align-items:flex-start;flex-direction:column;gap:16px}#projects .ledger-toolbar{grid-template-columns:1fr 1fr}}'
new_css = '    .proj-manage-btn{color:#9ab;font-size:12px;padding:3px 6px;margin-left:auto}.proj-manage-btn:hover{color:var(--pri-d)}\n    #pmCustomList .pm-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8eff5;font-size:13px}\n    #pmCustomList .pm-item button{font-size:12px;color:var(--red);background:none;border:0;cursor:pointer;padding:2px 6px}\n    #pmCustomList .pm-item button:hover{background:var(--red-l);border-radius:4px}\n    #pmAllList .pm-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f4f8;font-size:13px}\n    #pmAllList .pm-row button{font-size:12px;color:#8899a8;background:none;border:0;cursor:pointer;padding:2px 6px}\n    #pmAllList .pm-row button:hover{color:var(--text)}\n    #pmAllList .pm-row .pm-hidden{color:#aab;font-style:italic}\n    ' + old_css
s = s.replace(old_css, new_css)

# 7. 添加管理函数（插在 const ZAKOU_COMPANIES 前面）
marker = "const ZAKOU_COMPANIES = ["
manager_js = '''function openProjectManager(){const d=document.getElementById('projectManagerDialog');renderProjectManager();if(!d.open)d.showModal();}
function renderProjectManager(){const custom=state.customProjects||[];const hidden=state.hiddenProjects||[];const all=getProjectList();const cList=document.getElementById('pmCustomList');if(custom.length){cList.innerHTML=custom.map(p=>'<div class="pm-item"><span><strong>'+escapeHTML(p.code)+'</strong> '+escapeHTML(p.name)+' &middot; '+escapeHTML(p.dept)+'</span><button onclick="deleteCustomProject('+JSON.stringify(p.code)+')" title="删除此自定义项目">删除</button></div>').join('');}else{cList.innerHTML='<p class="section-hint">暂无自定义项目</p>';}const aList=document.getElementById('pmAllList');aList.innerHTML=all.concat(PROJECTS.filter(p=>hidden.includes(p.code))).map(p=>{const isHidden=hidden.includes(p.code);return '<div class="pm-row"><span>'+escapeHTML(p.code)+' '+escapeHTML(p.name)+(isHidden?' <span class="pm-hidden">(已隐藏)</span>':'')+'</span><button onclick="toggleProjectVisibility('+JSON.stringify(p.code)+')">'+(isHidden?'恢复显示':'隐藏')+'</button></div>';}).join('');}
function addCustomProject(){const code=document.getElementById('pmCode').value.trim(),name=document.getElementById('pmName').value.trim(),dept=document.getElementById('pmDept').value,contact=document.getElementById('pmContact').value.trim()||'/',costAcc=document.getElementById('pmCostAcc').value.trim()||'-',type=document.getElementById('pmType').value,notes=document.getElementById('pmNotes').value.trim();if(!code||!name){showToast('请填写项目编码和名称');return;}if(!/^[A-Z0-9\\-_]+$/i.test(code)){showToast('编码只能包含字母、数字、横线和下划线');return;}const list=getProjectList();if(list.some(p=>p.code===code)){showToast('编码 '+code+' 已存在');return;}const p={code,name,contact,dept:'餐饮'+dept.replace('餐饮',''),costAcc,isProxy:false,type,bizType:type||'',notes,unresolved:'',settlement:''};if(!state.customProjects)state.customProjects=[];state.customProjects.push(p);saveData();renderProjectManager();renderProjects();showToast('已添加 '+name);['pmCode','pmName','pmContact','pmCostAcc','pmNotes'].forEach(id=>document.getElementById(id).value='');document.getElementById('pmType').value='';document.getElementById('pmDept').value='餐饮一分部';}
function deleteCustomProject(code){if(!confirm('确认删除自定义项目 '+code+'？此操作不可恢复。'))return;state.customProjects=(state.customProjects||[]).filter(p=>p.code!==code);if(state.projects[code])delete state.projects[code];saveData();renderProjectManager();renderProjects();showToast('已删除');}
function toggleProjectVisibility(code){const hidden=state.hiddenProjects||[];if(hidden.includes(code)){state.hiddenProjects=hidden.filter(c=>c!==code);showToast('已恢复显示');}else{if(!confirm('确认隐藏项目 '+code+'？隐藏后该项目不再出现在台账中，但历史记录保留。'))return;state.hiddenProjects=hidden.concat(code);showToast('已隐藏');}saveData();renderProjectManager();renderProjects();}
'''
s = s.replace(marker, manager_js + marker)

# 验证关键替换
assert 'getProjectList' in s, 'getProjectList missing'
assert 'customProjects' in s, 'customProjects missing'
assert 'hiddenProjects' in s, 'hiddenProjects missing'
assert 'projectManagerDialog' in s, 'projectManagerDialog missing'
assert 'proj-manage-btn' in s, 'proj-manage-btn missing'

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('OK all replacements applied')
