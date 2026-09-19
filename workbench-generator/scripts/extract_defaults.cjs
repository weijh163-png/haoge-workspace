#!/usr/bin/env node
// ============================================================
// extract_defaults.cjs
// 从浩哥工作台模板中提取全部数据常量的默认值，生成 config JSON。
// 用法: node scripts/extract_defaults.cjs <模板html> <输出config.json>
// 注意: 本脚本只做提取，不改写模板。
// ============================================================
'use strict';
const fs = require('fs');

const TPL = process.argv[2];
const OUT = process.argv[3] || 'config/haoge-workbench.json';
if (!TPL || !fs.existsSync(TPL)) { console.error('模板不存在:', TPL); process.exit(1); }
const html = fs.readFileSync(TPL, 'utf8');

const CONSTS = [
  'MONTHLY_TASKS', 'NOTICES', 'TAX_COMPANIES', 'REPORTS', 'DAILY_ROUTINES',
  'CHECK_GROUPS', 'PROJECTS', 'PROJECT_STATUS', 'ZAKOU_COMPANIES',
  'TAX_DIFFS', 'UNRESOLVED', 'FC_DEFAULT_IR', 'FC_TYPE_COLORS', 'FC_DARK_COLORS'
];

// 定位 `const NAME = <value>;` 片段，返回 { start, end, valText, kw }
function locateConst(html, name) {
  const re = new RegExp('\\b(const|let|var)\\s+' + name + '\\s*=');
  const m = re.exec(html);
  if (!m) throw new Error('未找到常量: ' + name);
  let i = m.index + m[0].length;
  while (i < html.length && /\s/.test(html[i])) i++;
  const start = i;
  let depth = 0, quote = null;
  while (i < html.length) {
    const c = html[i], n = html[i + 1];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && n === '/') { while (i < html.length && html[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < html.length && !(html[i] === '*' && html[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; i++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; i++; continue; }
    if (c === ';' && depth === 0) break;
    i++;
  }
  return { start: m.index, end: i, valText: html.slice(start, i), kw: m[1], head: m[0] };
}

const data = {}, orig = {};
for (const name of CONSTS) {
  const { valText } = locateConst(html, name);
  let val;
  try { val = Function('return (' + valText + ');')(); }
  catch (e) { console.error('解析失败 ' + name + ': ' + e.message); process.exit(1); }
  data[name] = val;
  orig[name] = JSON.stringify(val);
}

// meta 默认值（与模板原文一致；generate.py 中“相同即不替换”保证逐字节还原）
const meta = {
  title: '浩哥工作台 · 收入核算',
  brand: '浩哥工作台',
  brandSub: '收入核算科 v2',
  periodNote: '收入核算工作台 · 本地离线版',
  examModalTitle: '全部考试倒计时',
  examHomeName: '税务师考试',
  examHomeDate: '2026-11-14',
  examHomeRange: '11月14–15日',
  exams: [
    { id: 'jingji', name: '中级经济师', date: '2026-11-07', text: '2026年11月7-8日' },
    { id: 'shuiwu', name: '税务师三科', date: '2026-11-14', text: '2026年11月14-15日' }
  ],
  storageKey: 'haoge_workspace_v3',
  legacyStorageKey: 'haoge_workspace_v2',
  fcReviewKey: 'haoge_fc_review',
  fcReviewsLegacyKey: 'haoge_fc_reviews',
  backupPrefix: '浩哥工作台-备份-',
  backupAppId: 'haoge-workbench'
};

const config = { meta, data, _orig: orig };
fs.writeFileSync(OUT, JSON.stringify(config, null, 2), 'utf8');
console.log('已提取', Object.keys(data).length, '个数据常量 ->', OUT);