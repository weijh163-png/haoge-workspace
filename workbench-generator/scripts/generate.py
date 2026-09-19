#!/usr/bin/env python3
# ============================================================
# generate.py
# 浩哥工作台可复用生成器：读模板 + config.json -> 生成新单文件工作台
#
# 用法:
#   python scripts/generate.py --template template/浩哥工作台.html \
#       --config config/haoge-workbench.json --out 输出/新工作台.html
#
# 规则:
#   - 模板即「浩哥原版」单文件；config 提供的数据若与模板原值一致则保持原文本（逐字节还原），
#     不一致才按 config 渲染替换。
#   - meta 字段按精确字符串替换（值与模板一致则无变化）。
#   - data 缺失的常量保持模板原样。
# ============================================================
import argparse, json, re, sys, os

# ---------- JS 字面量渲染 ----------
def js_str(s):
    s = s.replace('\\', '\\\\').replace("'", "\\'")
    s = s.replace('\n', '\\n').replace('\r', '\\r')
    return "'" + s + "'"

_IDENT_RE = re.compile(r'^[A-Za-z_$][A-Za-z0-9_$]*$')

def render_js(v, indent=0):
    pad = '  ' * indent
    if v is None:
        return 'null'
    if v is True:
        return 'true'
    if v is False:
        return 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return js_str(v)
    if isinstance(v, list):
        if not v:
            return '[]'
        inner = ',\n'.join(pad + '  ' + render_js(x, indent + 1) for x in v)
        return '[\n' + inner + '\n' + pad + ']'
    if isinstance(v, dict):
        if not v:
            return '{}'
        parts = []
        for k, val in v.items():
            key = k if _IDENT_RE.match(str(k)) else js_str(str(k))
            parts.append(pad + '  ' + key + ': ' + render_js(val, indent + 1))
        return '{\n' + ',\n'.join(parts) + '\n' + pad + '}'
    raise TypeError('不支持的配置值类型: %r' % (v,))

# ---------- 定位 `const NAME = <value>;` 块 ----------
def locate_const(html, name):
    m = re.search(r'\b(const|let|var)\s+' + re.escape(name) + r'\s*=', html)
    if not m:
        return None
    i = m.end()
    while i < len(html) and html[i] in ' \t\r\n':
        i += 1
    start = i
    depth = 0
    quote = None
    while i < len(html):
        c, n = html[i], html[i + 1] if i + 1 < len(html) else ''
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in '"\'`':
            quote = c
            i += 1
            continue
        if c == '/' and n == '/':
            while i < len(html) and html[i] != '\n':
                i += 1
            continue
        if c == '/' and n == '*':
            i += 2
            while i + 1 < len(html) and not (html[i] == '*' and html[i + 1] == '/'):
                i += 1
            i += 2
            continue
        if c in '([{':
            depth += 1
        elif c in ')]}':
            depth -= 1
        elif c == ';' and depth == 0:
            return m.start(), i  # 含分号
        i += 1
    return m.start(), i

def replace_const(html, name, newval_text):
    loc = locate_const(html, name)
    if not loc:
        return html
    s, e = loc
    return html[:s] + newval_text + html[e + 1:]  # 去掉旧分号，尾部自带 ';'

# ---------- 精确字符串替换（meta） ----------
def apply_meta(html, meta, orig_meta):
    def rep(old, new):
        nonlocal html
        if new is None or str(new) == str(old):
            return
        if html.count(old) == 0:
            print('  [warn] 未找到待替换文本: %r' % (old[:40],))
            return
        html = html.replace(old, str(new))

    # 1) <title>
    m = re.search(r'<title>[^<]*</title>', html)
    if m:
        rep(m.group(0), '<title>' + meta.get('title', orig_meta['title']) + '</title>')
    # 2) 导航品牌
    rep('<div class="nav-brand">' + orig_meta['brand'] + ' <span>' + orig_meta['brandSub'] + '</span></div>',
        '<div class="nav-brand">' + meta.get('brand', orig_meta['brand']) + ' <span>' + meta.get('brandSub', orig_meta['brandSub']) + '</span></div>')
    # 3) period note
    rep('<span class="period-note">' + orig_meta['periodNote'] + '</span>',
        '<span class="period-note">' + meta.get('periodNote', orig_meta['periodNote']) + '</span>')
    # 4) 考试弹窗标题
    rep(orig_meta['examModalTitle'], meta.get('examModalTitle', orig_meta['examModalTitle']))
    # 5) 首页考试按钮名称
    rep('<strong>' + orig_meta['examHomeName'] + '</strong>',
        '<strong>' + meta.get('examHomeName', orig_meta['examHomeName']) + '</strong>')
    # 6) 首页倒计时日期
    home_date = meta.get('examHomeDate', orig_meta['examHomeDate'])
    y, mo, d = home_date.split('-')
    rep("new Date(2026,10,14)", "new Date(%d,%d,%d)" % (int(y), int(mo) - 1, int(d)))
    rep(orig_meta['examHomeRange'], meta.get('examHomeRange', orig_meta['examHomeRange']))
    # 7) 考试弹窗：两门考试（exams[0]=jingji 中级经济师，exams[1]=shuiwu 税务师）
    exams = meta.get('exams') or orig_meta['exams']
    e0, e1 = (exams + [None] * 2)[:2]
    if e0:
        rep("const jingji = new Date('2026-11-07');", "const jingji = new Date('%s');" % e0.get('date', orig_meta['exams'][0]['date']))
        rep('>' + orig_meta['exams'][0]['name'] + '</div>', '>' + e0.get('name', orig_meta['exams'][0]['name']) + '</div>')
        rep(orig_meta['exams'][0]['text'], e0.get('text', orig_meta['exams'][0]['text']))
    if e1:
        rep("const shuiwu = new Date('2026-11-14');", "const shuiwu = new Date('%s');" % e1.get('date', orig_meta['exams'][1]['date']))
        rep('>' + orig_meta['exams'][1]['name'] + '</div>', '>' + e1.get('name', orig_meta['exams'][1]['name']) + '</div>')
        rep(orig_meta['exams'][1]['text'], e1.get('text', orig_meta['exams'][1]['text']))
    # 8) 存储 key（先长后短，防止子串误替换）
    rep(orig_meta['fcReviewsLegacyKey'], meta.get('fcReviewsLegacyKey', orig_meta['fcReviewsLegacyKey']))
    rep(orig_meta['fcReviewKey'], meta.get('fcReviewKey', orig_meta['fcReviewKey']))
    rep(orig_meta['storageKey'], meta.get('storageKey', orig_meta['storageKey']))
    rep(orig_meta['legacyStorageKey'], meta.get('legacyStorageKey', orig_meta['legacyStorageKey']))
    # 9) 备份文件名前缀 & app id
    rep(orig_meta['backupPrefix'], meta.get('backupPrefix', orig_meta['backupPrefix']))
    rep(orig_meta['backupAppId'], meta.get('backupAppId', orig_meta['backupAppId']))
    # 10) 扎口核算公司数量（按 ZAKOU_COMPANIES 实际长度联动）
    return html

# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser(description='浩哥工作台生成器')
    ap.add_argument('--template', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    with open(args.template, 'r', encoding='utf-8') as f:
        html = f.read()
    with open(args.config, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    meta = cfg.get('meta', {})
    data = cfg.get('data', {})
    orig = cfg.get('_orig', {})

    # 数据常量：与模板原值一致则保持原文，否则渲染替换
    replaced = []
    for name, val in data.items():
        loc = locate_const(html, name)
        if not loc:
            print('  [warn] 模板中无常量 %s，跳过' % name)
            continue
        orig_text = html[loc[0]:loc[1] + 1]
        if name in orig and json.dumps(val, ensure_ascii=False, separators=(',', ':')) == orig[name]:
            continue  # 与模板一致 → 保持逐字节原文
        new_text = 'const ' + name + ' = ' + render_js(val) + ';'
        html = replace_const(html, name, new_text)
        replaced.append(name)

    html = apply_meta(html, meta, cfg.get('_orig_meta', {
        'title': '浩哥工作台 · 收入核算', 'brand': '浩哥工作台', 'brandSub': '收入核算科 v2',
        'periodNote': '收入核算工作台 · 本地离线版', 'examModalTitle': '全部考试倒计时',
        'examHomeName': '税务师考试', 'examHomeDate': '2026-11-14', 'examHomeRange': '11月14–15日',
        'exams': [{'id': 'jingji', 'name': '中级经济师', 'date': '2026-11-07', 'text': '2026年11月7-8日'},
                  {'id': 'shuiwu', 'name': '税务师三科', 'date': '2026-11-14', 'text': '2026年11月14-15日'}],
        'storageKey': 'haoge_workspace_v3', 'legacyStorageKey': 'haoge_workspace_v2',
        'fcReviewKey': 'haoge_fc_review', 'fcReviewsLegacyKey': 'haoge_fc_reviews',
        'backupPrefix': '浩哥工作台-备份-', 'backupAppId': 'haoge-workbench',
    }))

    out_dir = os.path.dirname(os.path.abspath(args.out))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        f.write(html)

    print('生成完成: %s (替换数据常量 %d 个: %s)' % (args.out, len(replaced), ', '.join(replaced) or '无'))

if __name__ == '__main__':
    sys.exit(main())