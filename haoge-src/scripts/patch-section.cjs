// Read-only patch producer. All edits are applied by apply_patch, not by this script.
const fs=require('fs'),path=require('path');
const file=path.resolve('浩哥工作台.html');
const s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const part=n=>fs.readFileSync(path.join('src',n),'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
let oldText,newText;
function region(a,b,n){const start=s.indexOf(a),end=s.indexOf(b,start+a.length);if(start<0||end<0)throw Error('Missing markers '+a+' / '+b);oldText=s.slice(start,end);newText=n;}
function exact(o,n){if(!s.includes(o))throw Error('Missing exact '+o.slice(0,60));oldText=o;newText=n;}
switch(process.argv[2]){
case 'comfort-theme':exact('</body>','<style id="comfort-theme">\n'+part('comfort.css')+'</style>\n</body>');break;
case 'comfort-refresh':region('<style id="comfort-theme">','</body>','<style id="comfort-theme">\n'+part('comfort.css')+'</style>\n');break;
case 'dashboard':region('<section class="module active" id="dashboard">','<!-- ==================== Module 2:',part('dashboard.html')+'\n');break;
case 'reports-html':region('<section class="module work-module" id="reports">','<!-- ==================== Module 5:',part('reports.html')+'\n');break;
case 'state':region(s.includes("const STORAGE_KEY = 'haoge_workspace_v2';")?"const STORAGE_KEY = 'haoge_workspace_v2';":"const STORAGE_KEY = 'haoge_workspace_v3';",'// ==================== Navigation',part('state.js')+'\n');break;
case 'daily':region('function getTodayDay(){','// ==================== Notices',part('daily.js')+'\n');break;
case 'daily-refresh':region('function getTodayDay(){','// ==================== Done Panel & Exam Modal',part('daily.js')+'\n');break;
case 'workflow-css-refresh':{
 const start=s.indexOf('/* Quiet daily workspace, separate from the monthly milestone timeline. */');
 const end=s.indexOf('</style>',start);if(start<0||end<0)throw Error('Missing workflow styles');
 oldText=s.slice(start,end);newText=part('workflow.css');break;
}
case 'workflow-css':if(s.includes('/* Quiet daily workspace,'))throw Error('Workflow styles already installed');exact('</head>','<style>\n'+part('workflow.css')+'</style>\n</head>');break;
case 'notices-tax':region('// ==================== Notices','// ==================== Done Panel & Exam Modal','');break;
case 'reports-js':region('// ==================== Reports ====================','// ==================== Toast',part('report-ui.js')+'\n');break;
case 'projects-js':region(s.includes('const PROJECT_STATUS=')?'const PROJECT_STATUS=':'function renderProjects(filter){','const ZAKOU_COMPANIES',part('projects.js')+'\n');break;
case 'report-refresh':region('const REPORT_WORKFLOW_STAGES=','// ==================== Toast',part('report-ui.js')+'\n');break;
case 'final-refresh':region('function renderNotices(){','</script>',part('auxiliary.js')+'\n'+part('init.js'));break;
case 'zakou-js':region('function renderZakouGrid(){','// ==================== Tax Diff','');break;
case 'unresolved-js':region('function renderUnresolved(){','// ==================== Flowchart Module:', '');break;
case 'init':region('// ==================== Init ====================','</script>',part('auxiliary.js')+'\n'+part('init.js'));break;
case 'css':exact('</style>\n</head>','</style>\n<style>\n'+part('core.css')+part('extra.css')+'</style>\n</head>');break;
case 'nav':exact('<div class="nav-date" id="navDate"></div>','<button class="text-button nav-backup" onclick="openBackupDialog()">备份</button>');break;
case 'toolbar':exact('<div class="container">','<div class="container">\n<div class="period-toolbar"><span class="period-note">收入核算工作台 · 本地离线版</span><label for="periodSelect">工作月份</label><input id="periodSelect" type="month" onchange="changePeriod(this.value)"><span id="saveStatus" role="status" aria-live="polite">本地记录</span></div>\n<div class="storage-warning" id="storageWarning" hidden><span id="storageWarningText"></span> <button class="text-button" onclick="openBackupDialog()">备份与记录 →</button></div>');break;
case 'dialogs':exact('<!-- Exam Countdown Modal -->',part('dialogs.html')+'\n<!-- Exam Countdown Modal -->');break;
case 'extra-html':{
  const a='<section class="module" id="extra">',b='<!-- ==================== Module 7:';const begin=s.indexOf(a),end=s.indexOf(b,begin),old=s.slice(begin,end);
  let text=old.replace(a,'<section class="module work-module" id="extra">\n<header class="module-heading"><h1>扎口与未了</h1><p>本月扎口按月份记录；历史未了持续跟进，直到单独办结。</p></header>\n<details class="module-group" open><summary>本月扎口与统计申报</summary>');
  text=text.replace('  <!-- 暂估销项税税差 -->','</details>\n<details class="module-group"><summary>历史未了 · 跟进与办结</summary>\n  <!-- 暂估销项税税差 -->');
  text=text.replace('（7个项目 · 未调整）','（7个项目 · 原交接数据）');
  text=text.replace('  <!-- 审计配合 -->','</details>\n<details class="module-group"><summary>资料与归档 · 审计、凭证、代管物品</summary>\n  <!-- 审计配合 -->');
  text=text.replace('</section>','</details>\n</section>');oldText=old;newText=text;break;
}
case 'assistant-html':{
  const begin=s.indexOf('<section class="module work-module" id="assistant">'),end=s.indexOf('<!-- ==================== Module 4:',begin);if(begin<0)throw Error('assistant start');
  oldText=s.slice(begin,end);newText=oldText.replace('<div class="card special-section">','<details class="card special-section">').replace('<div class="card-title"><span class="ico">🔧</span> 特殊操作指引</div>','<summary class="card-title">特殊操作 · 完整步骤参考</summary>');
  const last=newText.lastIndexOf('  </div>\n</section>');if(last>=0)newText=newText.slice(0,last)+newText.slice(last).replace('  </div>\n</section>','  </details>\n</section>');break;
}
default:throw Error('Unknown job');
}
function lines(text,sign){const a=text.split('\n');if(a.at(-1)==='')a.pop();return a.map(x=>sign+x).join('\n');}
process.stdout.write('*** Begin Patch\n*** Update File: '+file.replace(/\\/g,'/')+'\n@@\n'+lines(oldText,'-')+(oldText?'\n':'')+lines(newText,'+')+(newText?'\n':'')+'*** End Patch\n');
