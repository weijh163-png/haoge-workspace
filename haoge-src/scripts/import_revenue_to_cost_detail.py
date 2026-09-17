"""Create a review copy of the cost-detail workbook with revenue only imported.

This tool deliberately does not calculate or change any cost-accounting field.
It only replaces the monthly revenue lookup in the calculation sheet (column K)
when an exact five-field key exists in the revenue source.  Manual revenue values
are retained.  Unmatched lookups are cleared and surfaced on an audit worksheet.
"""

from __future__ import annotations

import argparse
import ast
from copy import copy
from collections import Counter
from datetime import datetime
from numbers import Number
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


SOURCE_KEY_COLUMNS = (4, 5, 7, 8, 9)  # 项目代码、名称、班组、窗口、签订人
TARGET_KEY_COLUMNS = (4, 5, 8, 9, 10)  # 成本表中的对应位置
TARGET_REVENUE_COLUMN = 11  # K：当月营业额

HEADER_FILL = PatternFill("solid", fgColor="1F5F5B")
HEADER_FONT = Font(color="FFFFFF", bold=True)
SECTION_FILL = PatternFill("solid", fgColor="DFF0EC")
UNMATCHED_FILL = PatternFill("solid", fgColor="FCE8E6")
MANUAL_FILL = PatternFill("solid", fgColor="FFF4D6")
NEW_FILL = PatternFill("solid", fgColor="E5F4EE")


def text(value: object) -> str:
    return "" if value is None else str(value).strip().replace("\u3000", "")


def revenue_value(value: object) -> float:
    """Excel blank revenue is treated as zero, matching XLOOKUP display behaviour."""
    if value in (None, ""):
        return 0.0
    if isinstance(value, Number):
        return float(value)
    raw = str(value).replace(",", "").strip()
    if raw.startswith("="):
        return evaluate_arithmetic_formula(raw[1:])
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"营业额列出现非数字值：{value!r}") from exc


def evaluate_arithmetic_formula(expression: str) -> float:
    """Safely evaluate only literal arithmetic such as =171543.95+51733.33."""
    def evaluate(node):
        if isinstance(node, ast.Expression):
            return evaluate(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = evaluate(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            left, right = evaluate(node.left), evaluate(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            return left / right
        raise ValueError("只允许数字与加、减、乘、除、括号")

    try:
        return evaluate(ast.parse(expression, mode="eval"))
    except (SyntaxError, ValueError, ZeroDivisionError) as exc:
        raise ValueError(f"无法安全计算营业额算式：={expression}") from exc


def row_key(sheet, row: int, columns: tuple[int, ...]) -> tuple[str, ...]:
    return tuple(text(sheet.cell(row, col).value) for col in columns)


def find_sheet(workbook, marker: str):
    for sheet in workbook.worksheets:
        if marker in sheet.title:
            return sheet
    raise KeyError(f"找不到工作表：{marker}")


def find_revenue_total_row(sheet) -> int:
    for row in range(3, sheet.max_row + 1):
        value = sheet.cell(row, TARGET_REVENUE_COLUMN).value
        if sheet.cell(row, 2).value in (None, "") and isinstance(value, str) and value.startswith("=SUM(K3:"):
            return row
    raise ValueError("未找到 8 月营业额合计行")


def copy_source_sheet(workbook, source_sheet):
    """Embed the business data area A:M so audit links work in one workbook."""
    title = "营业额数据源"
    if title in workbook.sheetnames:
        del workbook[title]
    destination = workbook.create_sheet(title)
    destination.sheet_view.showGridLines = False
    for row in range(1, source_sheet.max_row + 1):
        destination.row_dimensions[row].height = source_sheet.row_dimensions[row].height
        for col in range(1, 14):
            source_cell = source_sheet.cell(row, col)
            target_cell = destination.cell(row, col, source_cell.value)
            if source_cell.has_style:
                target_cell._style = copy(source_cell._style)
            target_cell.number_format = source_cell.number_format
            target_cell.alignment = copy(source_cell.alignment)
            target_cell.font = copy(source_cell.font)
            target_cell.fill = copy(source_cell.fill)
            target_cell.border = copy(source_cell.border)
    for col in range(1, 14):
        letter = get_column_letter(col)
        destination.column_dimensions[letter].width = source_sheet.column_dimensions[letter].width or 16
    for merged_range in source_sheet.merged_cells.ranges:
        if merged_range.max_col <= 13:
            destination.merge_cells(str(merged_range))
    destination.freeze_panes = "A4"
    destination.auto_filter.ref = f"A3:M{source_sheet.max_row}"
    return destination


def build_source_map(source_sheet):
    rows_by_key: dict[tuple[str, ...], list[int]] = {}
    for row in range(4, source_sheet.max_row + 1):
        if not text(source_sheet.cell(row, 2).value):
            continue
        key = row_key(source_sheet, row, SOURCE_KEY_COLUMNS)
        rows_by_key.setdefault(key, []).append(row)

    duplicate_keys = {key: rows for key, rows in rows_by_key.items() if len(rows) > 1}
    if duplicate_keys:
        sample_key, sample_rows = next(iter(duplicate_keys.items()))
        raise ValueError(f"原稿存在重复五项匹配键，示例 {sample_key}，行号 {sample_rows}")

    return {key: rows[0] for key, rows in rows_by_key.items()}


def prepare_audit_sheet(workbook):
    title = "营业额导入核验"
    if title in workbook.sheetnames:
        del workbook[title]
    sheet = workbook.create_sheet(title)
    sheet.sheet_view.showGridLines = False
    return sheet


def write_audit_sheet(sheet, *, source_path, template_path, calc_sheet_title, records, stats):
    sheet["A1"] = "营业额自动导入与核验"
    sheet["A1"].font = Font(size=16, bold=True, color="173D3A")
    sheet.merge_cells("A1:L1")
    sheet["A3"] = "原始营业额文件"
    sheet["B3"] = source_path.name
    sheet["A4"] = "模板文件"
    sheet["B4"] = template_path.name
    sheet["A5"] = "生成时间"
    sheet["B5"] = datetime.now().strftime("%Y-%m-%d %H:%M")

    sheet["A7"] = "核验汇总"
    sheet["A7"].fill = SECTION_FILL
    sheet["A7"].font = Font(bold=True, color="173D3A")
    summary = [
        ("原目标数据行", stats["target_rows"]),
        ("自动导入", stats["imported"]),
        ("保留人工营业额", stats["manual"]),
        ("待核验（原稿未匹配）", stats["unmatched"]),
        ("新增窗口", stats["new_window"]),
        ("其中责任人变更", stats["responsibility_changed"]),
        ("导入后目标数据行", stats["target_rows_after"]),
        ("自动导入营业额合计", stats["imported_total"]),
    ]
    for index, (label, value) in enumerate(summary, start=8):
        sheet.cell(index, 1, label)
        sheet.cell(index, 2, value)
    sheet["B15"].number_format = '#,##0.00'

    start_row = 19
    headers = [
        "状态", "目标行", "档口唯一标志", "项目代码", "项目名称", "项目类型",
        "分组作业", "窗口", "签订人", "原稿行（点击跳转）", "导入/保留营业额", "说明",
    ]
    for col, label in enumerate(headers, start=1):
        cell = sheet.cell(start_row, col, label)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row_index, record in enumerate(records, start=start_row + 1):
        values = [
            record["status"], record["target_row"], record["stall_id"], record["project_code"],
            record["project_name"], record["project_type"], record["group"], record["window"],
            record["signer"], record["source_row"], record["revenue"], record["note"],
        ]
        for col, value in enumerate(values, start=1):
            cell = sheet.cell(row_index, col, value)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        if record["target_row"]:
            target = sheet.cell(row_index, 2)
            target.hyperlink = f"#'{calc_sheet_title}'!A{record['target_row']}"
            target.style = "Hyperlink"
        if record["source_row"]:
            source = sheet.cell(row_index, 10)
            source.hyperlink = f"#'营业额数据源'!A{record['source_row']}"
            source.style = "Hyperlink"
        sheet.cell(row_index, 11).number_format = '#,##0.00'
        if record["status"] == "待核验":
            for col in range(1, len(headers) + 1):
                sheet.cell(row_index, col).fill = UNMATCHED_FILL
        elif record["status"] == "保留人工录入":
            for col in range(1, len(headers) + 1):
                sheet.cell(row_index, col).fill = MANUAL_FILL
        elif record["status"].startswith("新增"):
            for col in range(1, len(headers) + 1):
                sheet.cell(row_index, col).fill = NEW_FILL

    end_row = start_row + len(records)
    sheet.auto_filter.ref = f"A{start_row}:L{end_row}"
    sheet.freeze_panes = f"A{start_row + 1}"
    widths = [14, 10, 16, 14, 30, 15, 18, 34, 14, 10, 20, 34]
    for col, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(col)].width = width


def generate(source_path: Path, template_path: Path, output_path: Path):
    # Formulas/styles come from the original template; cached formula values come
    # from a second read-only view so unmatched cells can be audited safely.
    source_wb = load_workbook(source_path, data_only=False, keep_links=True)
    source_sheet = source_wb.worksheets[0]
    source_map = build_source_map(source_sheet)

    template_wb = load_workbook(template_path, data_only=False, keep_links=True)
    cached_wb = load_workbook(template_path, data_only=True, keep_links=True)
    target_sheet = find_sheet(template_wb, "(8月)")
    cached_sheet = find_sheet(cached_wb, "(8月)")
    copy_source_sheet(template_wb, source_sheet)

    records = []
    used_source_keys: set[tuple[str, ...]] = set()
    stats = Counter()
    imported_total = 0.0

    for row in range(3, target_sheet.max_row + 1):
        stall_id = text(target_sheet.cell(row, 2).value)
        if not stall_id:
            continue
        stats["target_rows"] += 1
        target_key = row_key(target_sheet, row, TARGET_KEY_COLUMNS)
        revenue_cell = target_sheet.cell(row, TARGET_REVENUE_COLUMN)
        values = {
            "target_row": row,
            "stall_id": stall_id,
            "project_code": target_sheet.cell(row, 4).value,
            "project_name": target_sheet.cell(row, 5).value,
            "project_type": target_sheet.cell(row, 6).value,
            "group": target_sheet.cell(row, 8).value,
            "window": target_sheet.cell(row, 9).value,
            "signer": target_sheet.cell(row, 10).value,
            "source_row": "",
        }

        if revenue_cell.data_type != "f":
            stats["manual"] += 1
            source_row = source_map.get(target_key)
            if source_row:
                used_source_keys.add(target_key)
            values.update(
                status="保留人工录入",
                source_row=source_row or "",
                revenue=revenue_value(revenue_cell.value),
                note="原表为人工营业额，未覆盖",
            )
            revenue_cell.fill = MANUAL_FILL
        elif target_key in source_map:
            source_row = source_map[target_key]
            amount = revenue_value(source_sheet.cell(source_row, 10).value)
            revenue_cell.value = amount
            revenue_cell.number_format = '#,##0.00'
            stats["imported"] += 1
            imported_total += amount
            used_source_keys.add(target_key)
            values.update(status="自动导入", source_row=source_row, revenue=amount, note="五项键精确匹配原稿")
        else:
            # Never invent a value: blank the broken external lookup and force an
            # explicit user review rather than silently treating it as a zero.
            revenue_cell.value = None
            revenue_cell.fill = UNMATCHED_FILL
            stats["unmatched"] += 1
            cached_value = cached_sheet.cell(row, TARGET_REVENUE_COLUMN).value
            values.update(
                status="待核验",
                revenue="",
                note=f"原稿未匹配；原模板缓存值：{cached_value if cached_value is not None else '空'}",
            )
        records.append(values)

    # Any source row without an exact five-field match is a new target row.
    # The fifth key is the responsible person, so a changed person is kept as
    # a separate line instead of overwriting the historical target row.
    target_keys = {
        row_key(target_sheet, row, TARGET_KEY_COLUMNS)
        for row in range(3, target_sheet.max_row + 1)
        if text(target_sheet.cell(row, 2).value)
    }
    source_rows_not_in_target = [
        source_row for key, source_row in source_map.items() if key not in target_keys
    ]
    target_by_window = {}
    for row in range(3, target_sheet.max_row + 1):
        if not text(target_sheet.cell(row, 2).value):
            continue
        window_key = tuple(text(target_sheet.cell(row, col).value) for col in (4, 5, 8, 9))
        target_by_window.setdefault(window_key, []).append(row)

    total_row = find_revenue_total_row(target_sheet)
    seed_row = total_row - 1
    target_sheet.insert_rows(total_row, amount=len(source_rows_not_in_target))
    for offset, source_row in enumerate(source_rows_not_in_target):
        row = total_row + offset
        for col in range(1, target_sheet.max_column + 1):
            target_sheet.cell(row, col)._style = copy(target_sheet.cell(seed_row, col)._style)
        target_sheet.row_dimensions[row].height = target_sheet.row_dimensions[seed_row].height

        source_window_key = tuple(text(source_sheet.cell(source_row, col).value) for col in (4, 5, 7, 8))
        old_rows = target_by_window.get(source_window_key, [])
        source_signer = source_sheet.cell(source_row, 9).value
        if old_rows:
            status = "新增（责任人变更）"
            old_signers = "、".join(text(target_sheet.cell(old_row, 10).value) or "空" for old_row in old_rows)
            note = f"同窗口责任人变更：原目标 {old_signers}；原稿 {text(source_signer) or '空'}"
            stats["responsibility_changed"] += 1
        else:
            status = "新增窗口"
            note = "原稿新增窗口，成本字段留待成本会计维护"
        stats["new_window"] += 1

        # Populate revenue-related identity fields only.  Existing cost records
        # are untouched, and new cost cells remain blank for the cost accountant.
        for col in range(1, target_sheet.max_column + 1):
            target_sheet.cell(row, col).value = None
        target_sheet.cell(row, 1).value = "新增"
        target_sheet.cell(row, 2).value = source_sheet.cell(source_row, 2).value
        target_sheet.cell(row, 3).value = source_sheet.cell(source_row, 3).value
        target_sheet.cell(row, 4).value = source_sheet.cell(source_row, 4).value
        target_sheet.cell(row, 5).value = source_sheet.cell(source_row, 5).value
        target_sheet.cell(row, 6).value = source_sheet.cell(source_row, 6).value
        target_sheet.cell(row, 8).value = source_sheet.cell(source_row, 7).value
        target_sheet.cell(row, 9).value = source_sheet.cell(source_row, 8).value
        target_sheet.cell(row, 10).value = source_signer
        target_sheet.cell(row, TARGET_REVENUE_COLUMN).value = revenue_value(source_sheet.cell(source_row, 10).value)
        target_sheet.cell(row, TARGET_REVENUE_COLUMN).number_format = '#,##0.00'
        target_sheet.cell(row, TARGET_REVENUE_COLUMN).fill = NEW_FILL
        target_sheet.cell(row, 13).value = note
        used_source_keys.add(row_key(source_sheet, source_row, SOURCE_KEY_COLUMNS))
        records.append({
            "status": status,
            "target_row": row,
            "stall_id": source_sheet.cell(source_row, 2).value,
            "project_code": source_sheet.cell(source_row, 4).value,
            "project_name": source_sheet.cell(source_row, 5).value,
            "project_type": source_sheet.cell(source_row, 6).value,
            "group": source_sheet.cell(source_row, 7).value,
            "window": source_sheet.cell(source_row, 8).value,
            "signer": source_signer,
            "source_row": source_row,
            "revenue": revenue_value(source_sheet.cell(source_row, 10).value),
            "note": note,
        })

    moved_total_row = total_row + len(source_rows_not_in_target)
    target_sheet.cell(moved_total_row, TARGET_REVENUE_COLUMN).value = f"=SUM(K3:K{moved_total_row - 1})"
    stats["target_rows_after"] = stats["target_rows"] + stats["new_window"]
    stats["imported_total"] = imported_total
    audit_sheet = prepare_audit_sheet(template_wb)
    write_audit_sheet(
        audit_sheet,
        source_path=source_path,
        template_path=template_path,
        calc_sheet_title=target_sheet.title,
        records=records,
        stats=stats,
    )

    template_wb.calculation.fullCalcOnLoad = True
    template_wb.calculation.forceFullCalc = True
    output_path.parent.mkdir(parents=True, exist_ok=True)
    template_wb.save(output_path)
    return stats


def main():
    parser = argparse.ArgumentParser(description="将营业额原稿导入成本费用明细的营业额列，并生成核验页。")
    parser.add_argument("--source", type=Path, required=True, help="营业额原稿 xlsx")
    parser.add_argument("--template", type=Path, required=True, help="成本费用明细最终版 xlsx")
    parser.add_argument("--output", type=Path, required=True, help="生成的测试版 xlsx")
    args = parser.parse_args()
    stats = generate(args.source, args.template, args.output)
    print(f"已生成：{args.output}")
    print(dict(stats))


if __name__ == "__main__":
    main()
