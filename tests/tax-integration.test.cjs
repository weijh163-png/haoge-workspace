const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const workspace = fs.readFileSync('index.html', 'utf8');
const taxStudy = fs.readFileSync('tax-law-one/index.html', 'utf8');

let passed = 0;
function test(name, fn) {
  fn();
  console.log('PASS', name);
  passed++;
}

function inlineScript(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .join('\n');
}

function staticIds(html) {
  const markup = html.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g, '');
  return [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
}

test('both applications have valid JavaScript syntax', () => {
  new vm.Script(inlineScript(workspace));
  new vm.Script(inlineScript(taxStudy));
});

test('both applications keep unique static IDs', () => {
  for (const html of [workspace, taxStudy]) {
    const ids = staticIds(html);
    assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
  }
});

test('tax exam modal lists all three confirmed subjects', () => {
  for (const subject of ['税法一', '税法二', '涉税服务实务']) {
    assert(workspace.includes(subject), subject);
  }
  assert(workspace.includes('href="tax-law-one/index.html"'));
  assert.equal((workspace.match(/>待完善</g) || []).length, 2);
});

test('Tax Law I opens inside the workspace and has a return path', () => {
  assert(workspace.includes('id="taxStudyView"'));
  assert(workspace.includes('id="taxStudyFrame"'));
  assert(workspace.includes('function openTaxStudy(event)'));
  assert(workspace.includes('function closeTaxStudy()'));
  assert(!workspace.includes('href="https://chenchen0523lulu-ops.github.io/tax-law-one-2026-study/"'));
});

test('local study copy contains every original learning area', () => {
  for (const area of ['今日学习', '考纲知识树', '章节练习', '错题本', '冲刺计划', '大纲与说明']) {
    assert(taxStudy.includes(area), area);
  }
});

test('study progress is isolated and handles unavailable storage', () => {
  assert(taxStudy.includes("localStorage.getItem('tax1state')"));
  assert(taxStudy.includes("localStorage.setItem('tax1state'"));
  assert(taxStudy.includes('catch(e){storageAvailable=false'));
  assert(!taxStudy.includes('haoge_workspace_v3'));
});

test('local study copy has no remote runtime assets', () => {
  const remoteAssets = [...taxStudy.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="https?:\/\//gi)];
  assert.deepEqual(remoteAssets, []);
});

console.log(`\n${passed} tax integration checks passed.`);
