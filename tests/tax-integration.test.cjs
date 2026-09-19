const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const workspace = fs.readFileSync('index.html', 'utf8');
const taxOne = fs.readFileSync('tax-law-one/index.html', 'utf8');
const taxTwo = fs.readFileSync('tax-law-two/index.html', 'utf8');
const practice = fs.readFileSync('tax-service-practice/index.html', 'utf8');
const sharedJs = fs.readFileSync('study/shared-app.js', 'utf8');
const sharedCss = fs.readFileSync('study/shared-app.css', 'utf8');
const subjectPages = [taxTwo, practice];

let passed = 0;
function test(name, fn) { fn(); console.log('PASS', name); passed++; }
function inlineScript(html) { return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n'); }
function staticIds(html) { const markup=html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g,'');return [...markup.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]); }
function configOf(html) { const sandbox={window:{}};vm.runInNewContext(inlineScript(html),sandbox);return sandbox.window.SUBJECT_CONFIG; }

test('all application JavaScript has valid syntax', () => {
  [workspace,taxOne,...subjectPages].forEach(html=>new vm.Script(inlineScript(html)));
  new vm.Script(sharedJs);
});

test('all static pages keep unique IDs', () => {
  [workspace,taxOne,...subjectPages].forEach(html=>{const ids=staticIds(html);assert.deepEqual(ids.filter((id,i)=>ids.indexOf(id)!==i),[]);});
});

test('tax exam modal opens all three subjects inside the workspace', () => {
  const expected=['tax-law-one/index.html','tax-law-two/index.html','tax-service-practice/index.html'];
  expected.forEach(path=>assert(workspace.includes(`href="${path}"`),path));
  assert(workspace.includes('function openSubjectStudy(event,path,title,summary)'));
  assert(workspace.includes('id="taxStudyFrame"'));
  assert(workspace.includes('function closeTaxStudy()'));
  assert.equal((workspace.match(/>待完善</g)||[]).length,0);
});

test('new subjects contain required learning areas and isolated state', () => {
  const configs=subjectPages.map(configOf);
  assert.deepEqual(configs.map(x=>x.storageKey),['tax2state','taxPracticeState']);
  configs.forEach((c,i)=>{
    assert.equal(c.questions.length,5);
    assert.equal(c.tasks.length,4);
    assert.equal(c.chapters.reduce((n,x)=>n+x.weight,0),100);
    assert(c.sources.length>=4);
    assert(c.sources.some(group=>group.items.some(item=>item[1].startsWith('http'))));
  });
  assert.equal(configs[0].chapters.length,10);
  assert.equal(configs[1].chapters.length,9);
  assert(sharedJs.includes('simple-tax-advisor-site/sources.html'));
  ['今日学习','完整知识树','5 道练习题','错题本','四阶段计划','备查资料'].forEach(x=>assert(sharedJs.includes(x),x));
});

test('Tax Law I now includes the reference-materials area', () => {
  assert(taxOne.includes('data-view="sources"'));
  assert(taxOne.includes('id="sources"'));
  assert(taxOne.includes('simple-tax-advisor-site/sources.html'));
  assert(taxOne.includes("localStorage.getItem('tax1state')"));
});

test('all subjects link the official 2026 syllabus', () => {
  [taxOne,...subjectPages].forEach(html=>assert(html.includes('W020260429711461270871.pdf')));
});

test('study pages have no remote runtime assets', () => {
  [taxOne,...subjectPages].forEach(html=>assert.deepEqual([...html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="https?:\/\//gi)],[]));
});

test('shared runtime persists by configured storage key and degrades safely', () => {
  assert(sharedJs.includes('localStorage.getItem(c.storageKey)'));
  assert(sharedJs.includes('localStorage.setItem(c.storageKey'));
  assert(sharedJs.includes('storageAvailable=false'));
  assert(!sharedJs.includes('haoge_workspace_v3'));
});

test('all seven learning areas remain reachable on narrow screens', () => {
  assert(sharedCss.includes('@media(max-width:980px)'));
  assert(sharedCss.includes('overflow-x:auto'));
  assert(sharedCss.includes('.mobile-nav{display:flex'));
  assert(taxOne.includes('overflow-x:auto'));
  assert.equal((sharedJs.match(/data-view=/g)||[]).length>=1,true);
});

console.log(`\n${passed} tax integration checks passed.`);
