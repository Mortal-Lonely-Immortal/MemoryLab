"""
Markdown 表格对齐后处理器
========================
等 AI 完整输出文本后，自动检测并对齐所有表格竖线。

算法：
  1. 全量读取完整文本
  2. 按空行分割段落，识别表格块（连续 ≥2 行包含 | 且含分隔行 |---|）
  3. 记录每行每个 | 的字符索引位置
  4. 以首行 | 为基准，校验后续行的 | 是否对齐
  5. 不对齐时：按每列最大内容宽度重新计算列宽，补空格强制对齐
"""

import re


def align_tables(text: str) -> str:
    """
    检测文本中所有 Markdown 表格，自动修正竖线不对齐。

    返回修正后的文本，如果没有表格或表格已对齐则原样返回。
    """
    lines = text.split("\n")
    blocks = _find_table_blocks(lines)
    if not blocks:
        return text

    result = list(lines)
    for start, end in reversed(blocks):
        original = result[start:end + 1]
        aligned = _align_one_table(original)
        result[start:end + 1] = aligned

    return "\n".join(result)


def _find_table_blocks(lines):
    """
    扫描所有行，找出连续的表格块。
    表格判定：连续行中，≥2 行包含 | 且其中至少一行是分隔行 ---|---|---。

    返回 [(start, end), ...] 闭区间索引列表。
    """
    blocks = []
    i = 0
    while i < len(lines):
        if "|" in lines[i]:
            start = i
            has_sep = False
            while i < len(lines) and "|" in lines[i]:
                if _is_separator_row(lines[i]):
                    has_sep = True
                i += 1
            end = i - 1
            if has_sep and end > start:
                blocks.append((start, end))
        else:
            i += 1
    return blocks


def _is_separator_row(line: str) -> bool:
    """判断是否为 Markdown 表格分隔行，如 |---|---|"""
    return bool(re.match(r'^\|?[\s:]*[-]{2,}[\s:]*\|', line.strip()))


def _align_one_table(rows):
    """
    对单个表格块执行对齐：

    1. 以第一行数据行（非分隔行）的 | 位置为基准
    2. 校验所有行
    3. 任意行竖线偏移 → 触发全表重排
    """
    if len(rows) < 2:
        return rows

    # 获取第一行的 | 位置作为基准
    baseline = _pipe_positions(rows[0])

    # 校验所有行
    misaligned = False
    for row in rows[1:]:
        positions = _pipe_positions(row)
        if len(positions) != len(baseline):
            misaligned = True
            break
        for p, b in zip(positions, baseline):
            if p != b:
                misaligned = True
                break
        if misaligned:
            break

    if not misaligned:
        return rows

    # 触发重排
    return _reflow_table(rows)


def _pipe_positions(line: str) -> list:
    """记录一行中每个 | 的字符索引"""
    return [i for i, ch in enumerate(line) if ch == "|"]


def _reflow_table(rows):
    """
    全表重排：
    1. 逐行解析单元格内容（去掉前后空格）
    2. 计算每列最大显示宽度
    3. 按统一列宽补空格，所有 | 同一列对齐
    """
    # 分离数据行和分隔行
    data_rows = [r for r in rows if not _is_separator_row(r)]
    sep_rows = [r for r in rows if _is_separator_row(r)]

    all_rows = data_rows + sep_rows

    # 解析每行的单元格
    parsed = [_parse_cells(r) for r in all_rows]

    # 计算最大列数
    col_count = max(len(cells) for cells in parsed) if parsed else 0
    if col_count == 0:
        return rows

    # 计算每列最大宽度（中文占 2 个显示宽度）
    col_widths = [0] * col_count
    for cells in parsed:
        for j, cell in enumerate(cells):
            if j < col_count:
                w = _display_width(cell)
                if w > col_widths[j]:
                    col_widths[j] = w

    # 重新格式化为对齐表格
    result = []
    data_idx = 0
    sep_idx = 0
    for row in rows:
        if _is_separator_row(row):
            result.append(_build_sep_row(col_widths, row))
            sep_idx += 1
        else:
            cells = parsed[data_idx] if data_idx < len(parsed) else _parse_cells(row)
            result.append(_build_data_row(cells, col_widths))
            data_idx += 1

    return result


def _parse_cells(line: str) -> list:
    """解析一行表格的单元格，返回每列去除首尾空格后的文本"""
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def _display_width(text: str) -> int:
    """
    计算文本的显示宽度。
    CJK 字符和全角符号占 2，ASCII 占 1。
    """
    w = 0
    for ch in text:
        code = ord(ch)
        if (0x1100 <= code <= 0x115F or     # Hangul Jamo
            0x2E80 <= code <= 0xA4CF or     # CJK Radicals ~ Yi
            0xA960 <= code <= 0xA97C or     # Hangul Jamo Extended-A
            0xAC00 <= code <= 0xD7A3 or     # Hangul Syllables
            0xF900 <= code <= 0xFAFF or     # CJK Compatibility Ideographs
            0xFE10 <= code <= 0xFE19 or     # Vertical forms
            0xFE30 <= code <= 0xFE6F or     # CJK Compatibility Forms
            0xFF00 <= code <= 0xFF60 or     # Fullwidth Forms
            0xFFE0 <= code <= 0xFFE6 or     # Fullwidth Signs
            0x1F300 <= code <= 0x1F64F or   # Emoticons
            0x1F900 <= code <= 0x1F9FF or   # Supplemental Symbols
            0x20000 <= code <= 0x2FFFD or   # CJK Unified Ideographs Extension B+
            0x30000 <= code <= 0x3FFFD):     # CJK Unified Ideographs Extension G+
            w += 2
        else:
            w += 1
    return w


def _build_data_row(cells: list, col_widths: list) -> str:
    """按统一列宽构建数据行"""
    parts = []
    for j, w in enumerate(col_widths):
        content = cells[j] if j < len(cells) else ""
        padding = w - _display_width(content)
        parts.append(f" {content}{' ' * padding} ")
    return "|" + "|".join(parts) + "|"


def _build_sep_row(col_widths: list, original: str) -> str:
    """构建对齐后的分隔行 --- | ---，保留原始对齐标记 :--- :---: ---:"""
    parts = []
    for j, w in enumerate(col_widths):
        parts.append("-" * (w + 2))
    return "|" + "|".join(parts) + "|"


# ========== ASCII 框图对齐 ==========

# 框图专用字符
_BOX_CORNER = set('┌┐└┘')
_BOX_HORIZ = set('─━')
_BOX_VERT = set('│┃')
_BOX_INNER = set('├┤┬┴┏┓┗┛┣┫┳┻╋')
_BOX_ALL = _BOX_CORNER | _BOX_HORIZ | _BOX_VERT | _BOX_INNER


def align_box_diagrams(text: str) -> str:
    """
    检测并修正 AI 生成的 ASCII 框图竖线错位。
    只修正简单矩形框（左右边界清晰的盒形），复杂框图保留原样。

    原理：
      1. 找边框行（含 ─ 的行），取左右端点的字符索引
      2. 内容行（│...│）的右边 │ 若偏离边框右端点 ≥3 格 → 修正
    """
    lines = text.split("\n")
    blocks = _find_box_blocks(lines)
    if not blocks:
        return text

    result = list(lines)
    for start, end in reversed(blocks):
        segment = result[start:end + 1]
        aligned = _align_one_box_block_v2(segment)
        result[start:end + 1] = aligned

    return "\n".join(result)


def _find_box_blocks(lines):
    """找连续含框图字符的行块"""
    blocks = []
    i = 0
    while i < len(lines):
        if any(ch in _BOX_ALL for ch in lines[i]):
            start = i
            while i < len(lines) and any(ch in _BOX_ALL for ch in lines[i]):
                i += 1
            end = i - 1
            if end > start:
                blocks.append((start, end))
        else:
            i += 1
    return blocks


def _align_one_box_block_v2(rows):
    """
    简单盒形对齐：
    1. 从所有行中找最小左边界和最大右边界（以角字符为准）
    2. 每行按左右边界重排内容间距
    3. 只修正偏差 ≥3 格的行（容忍手绘误差）
    """
    # 找全局左右边界
    left_positions = []
    right_positions = []
    for row in rows:
        for i, ch in enumerate(row):
            if ch in _BOX_CORNER or ch in _BOX_INNER or ch in _BOX_VERT:
                left_positions.append(i)
                break
        for i in range(len(row) - 1, -1, -1):
            if row[i] in _BOX_CORNER or row[i] in _BOX_INNER or row[i] in _BOX_VERT:
                right_positions.append(i)
                break

    if not left_positions or not right_positions:
        return rows

    left = min(left_positions)
    right = max(right_positions)

    # 检查：所有行是否有相同的列数（简单矩形才修正）
    col_counts = set()
    for row in rows:
        cnt = sum(1 for ch in row if ch in _BOX_VERT or ch in _BOX_CORNER or ch in _BOX_INNER)
        col_counts.add(cnt)
    # 列数不一致（复杂框图）→ 不处理
    if len(col_counts) > 2:
        return rows

    result = []
    for row in rows:
        fixed = _fix_simple_box_row(row, left, right)
        result.append(fixed)

    return result


def _fix_simple_box_row(line, target_left, target_right):
    """修正一行的左右边框位置"""
    # 找当前左右边界
    cur_left = cur_right = None
    for i, ch in enumerate(line):
        if ch in _BOX_ALL:
            if cur_left is None:
                cur_left = i
            cur_right = i

    if cur_left is None or cur_right is None:
        return line

    # 偏差 <3 格就不动
    if abs(cur_left - target_left) < 3 and abs(cur_right - target_right) < 3:
        return line

    # 前缀（左边界之前的内容）
    prefix = line[:target_left]

    # 左边界字符
    left_ch = line[cur_left] if cur_left < len(line) else '│'

    # 内部内容（cur_left+1 到 cur_right）
    inner = line[cur_left + 1:cur_right] if cur_left + 1 < len(line) else ''

    # 右边界字符
    right_ch = line[cur_right] if cur_right < len(line) else '│'

    # 后缀（右边界之后）
    suffix = line[cur_right + 1:] if cur_right + 1 < len(line) else ''

    # 计算目标内部宽度
    target_inner_width = target_right - target_left - 1
    current_display = _display_width(inner)
    diff = target_inner_width - current_display

    if diff > 0:
        # 内容太窄，补空格/横线
        fill = '─' if (left_ch in _BOX_CORNER or left_ch in _BOX_INNER) and not inner.strip() else ' '
        inner = inner + fill * diff
    elif diff < 0:
        # 内容太宽，截断
        inner = _truncate_to_display(inner, target_inner_width)

    return prefix + left_ch + inner + right_ch + suffix


def _truncate_to_display(text, max_width):
    """按显示宽度截断文本"""
    result = []
    w = 0
    for ch in text:
        cw = _display_width(ch)
        if w + cw > max_width:
            break
        result.append(ch)
        w += cw
    return ''.join(result)


# ========== 便捷函数 ==========

def format_tables_in_response(text: str) -> str:
    """
    对 LLM 返回的完整文本进行表格对齐。
    自动检测 markdown 表格，修正竖线错位。

    用法：
        response = llm.chat(messages)
        response = format_tables_in_response(response)
    """
    if "|" in text:
        text = align_tables(text)
    return text


# ========== 命令行 ==========

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = sys.stdin.read()

    print(format_tables_in_response(content))
