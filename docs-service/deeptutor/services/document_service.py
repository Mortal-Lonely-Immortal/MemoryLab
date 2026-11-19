"""
文档处理服务模块
================
完整的文档处理流水线，支持 PDF / Word / PPT 三种格式。

处理工序（4步）：
  1. 提取(Extract)：PDF逐页渲染为图片，Word/PPT提取文字和图片
  2. 记忆(Memorize)：记录每个内容块的相对位置(block_order)和所属章节
  3. 更改(Simplify)：对文字块调用LLM翻译为通俗中文（图片块跳过）
  4. 重组(Reassemble)：按章节和原始顺序将图文拼接为教程

PDF特殊处理：
  用 page.find_tables() 检测表格区域，用字体大小/符号密度启发式识别公式块，
  对公式和表格区域自动截图插入到对应文字块后方，同时保留整页截图作为兜底。

核心设计理念：
  每个内容块都带有 block_order（顺序号）和 chapter_title（章节归属），
  这样在翻译简化后可以按原始顺序精确重组，保持"一段话后跟一张图"的相对关系。
"""
import os
import re
import json
from typing import Any, Dict, Optional, Tuple, cast
import fitz  # PyMuPDF, 用于PDF解析
from docx import Document as DocxDocument
from pptx import Presentation
from PIL import Image
import io
from deeptutor.config import Config
from deeptutor.services import ocr_service


class DocumentProcessor:
    """
    文档处理器：负责文档的完整生命周期处理。

    使用示例：
        processor = DocumentProcessor(llm_service)
        blocks, chapters = processor.extract_pdf(filepath, doc_id)
        blocks = processor.simplify_blocks(blocks, llm_service)
        tutorial = processor.reassemble(blocks, chapters)
    """

    def __init__(self, llm_service=None):
        """
        初始化处理器。
        参数：
            llm_service: LLMService实例，用于文本简化。可为None（仅提取不简化）。
        """
        self.llm = llm_service
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        # 提取的图片统一存储在 uploads/images/ 下
        self.image_dir = os.path.join(Config.UPLOAD_FOLDER, 'images')
        os.makedirs(self.image_dir, exist_ok=True)

    def get_document_path(self, doc_id, filename):
        """根据文档ID和文件名构建服务器存储路径"""
        return os.path.join(Config.UPLOAD_FOLDER, f"doc_{doc_id}_{filename}")

    # ==================== PDF处理 ====================

    def extract_pdf(self, filepath, doc_id):
        """
        提取PDF的文字和图片，自动识别公式/表格区域并截图。

        处理流水线（每页）：
          1. 用 page.find_tables() 检测所有表格，记录 bbox
          2. 提取文字块和嵌入图片，对每个文字块：
             - 公式特征 → text + 公式区域截图（紧跟该文字块）
             - 表格单元格 → 仅 text，记录所属表格ID
             - 普通文字 → 仅 text（送LLM简化）
          3. 遍历结束后，每个表格生成一张整表截图，插入到最后一个单元格之后
          4. 每页末尾追加整页截图作为兜底参考

        公式识别分两层：
          - _is_formula_block：三信号判定是否为公式（字号差异/符号密度/碎片比例）
          - _is_complex_formula：判断是否需要截图（积分/分式/矩阵等复杂结构）
          复杂公式 → 文字块 + 区域截图；简单公式（a+b=c, x>5）→ 仅文字块，走LLM翻译

        返回：
          blocks: 文字块 + 公式/表格截图 + 整页截图混合排列
          chapters: 目录结构列表
        """
        blocks = []# 初始化一个空列表，准备装提取出的
        doc = fitz.open(filepath) # 用 PyMuPDF 打开 PDF 文件
        block_order = 0# 块计数器，记录每个块在原文中的顺序
        dpi = 120 # 渲染图片时的分辨率（dots per inch）

        # 优先解析PDF内置目录（书签/TOC）
        toc = doc.get_toc()
        chapters = self._parse_toc(toc)
        ocr_chapters = []
        ocr_chapter_title = None
        ocr_used = False

        for page_num in range(len(doc)):# 遍历每一页
            page = doc[page_num] # 取出当前页对象
            chapter_title = self._find_chapter_for_page(page_num + 1, chapters)# 查当前页属于哪个章节

            # 纯扫描页：没有文字层时，走 Umi-OCR / RapidOCR。
            # 只处理没有 PDF 目录的文档；有目录时保持原书章节名。
            ocr_lines = []
            try:
                page_text = page.get_text("text").strip()
            except Exception:
                page_text = ""
            if not toc and len(page_text) < 20:
                try:
                    if ocr_service.available():
                        pix = page.get_pixmap(dpi=200)
                        ocr_lines = ocr_service.recognize_png(pix.tobytes("png"))
                        if ocr_lines:
                            ocr_used = True
                            heading = self._ocr_page_heading(ocr_lines, pix.height)
                            if heading:
                                ocr_chapter_title = heading
                                if not ocr_chapters or ocr_chapters[-1]["title"] != heading:
                                    ocr_chapters.append({
                                        "level": 1,
                                        "title": heading,
                                        "start_page": page_num + 1
                                    })
                            chapter_title = ocr_chapter_title or "OCR 正文"
                except Exception as e:
                    print(f"OCR failed on page {page_num + 1}: {e}")

            # 把 OCR 行按原顺序写入 blocks，供后续翻译/重组使用。
            for line in ocr_lines:
                txt = (line.get("text") or "").strip()
                if not txt:
                    continue
                is_heading = bool(self._ocr_heading_match(txt))
                blocks.append({
                    "block_order": block_order,
                    "block_type": "heading" if is_heading else "text",
                    "original_text": txt,
                    "simplified_text": None,
                    "image_path": None,
                    "image_description": None,
                    "page_number": page_num + 1,
                    "chapter_title": chapter_title
                })
                block_order += 1

            # 检测当前页的表格，给每个表格分配唯一ID用于去重
            table_bboxes = {}  #  ← 本页表格字典
            try:  # 表格检测可能失败，用 try 包裹
                tabs = page.find_tables()  # ← 检测表格
                if tabs and tabs.tables:    # ← 遍历表格
                    for i, tab in enumerate(tabs.tables):# 遍历表格：i 是序号，tab 是 Table 对象
                        global_id = f"{page_num}_{i}" 
                        table_bboxes[global_id] = tab.bbox  # ← 记录 bbox
            except Exception as e:
                print(f"Error parsing table in page {page_num}: {e}")
                
            # 记录本页待插入的表格截图：table_id → 最后一个单元格的 block_order
            table_last_block = {}

            # 提取文字块和嵌入图片
            text_blocks = cast(Dict[str, Any], page.get_text("dict"))["blocks"]

            # 缓冲区：用于合并相邻的普通文字块，减少LLM调用次数
            buf_text = ""
            buf_font_sizes = []

            def flush_text_buffer():
                """将缓冲区中的合并文字输出为一个block"""
                nonlocal block_order
                t = buf_text.strip()
                if len(t) > 5:
                    blocks.append({
                        "block_order": block_order,
                        "block_type": "text",
                        "original_text": t,
                        "simplified_text": None,
                        "image_path": None,
                        "image_description": None,
                        "page_number": page_num + 1,
                        "chapter_title": chapter_title
                    })
                    block_order += 1

            for block in text_blocks:
                if block["type"] == 0:  # 文字块
                    text = ""
                    font_sizes = []
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text += span.get("text", "")
                            if span.get("size"):
                                font_sizes.append(span["size"])
                    text = text.strip()
                    if len(text) <= 5:
                        continue

                    block_bbox = block.get("bbox")

                    # 判断是否为表格单元格或公式
                    cell_table_id = self._find_table_id(block_bbox, table_bboxes)
                    is_formula = not cell_table_id and self._is_formula_block(text, font_sizes)
                    # 复杂公式（积分/矩阵/分式）需要截图；简单公式（a+b=c）保留文字
                    is_complex = is_formula and self._is_complex_formula(text)
                    is_special = is_complex or (cell_table_id is not None)

                    if is_special:
                        # 复杂公式或表格：先清空缓冲区，再单独输出
                        flush_text_buffer()
                        buf_text = ""
                        buf_font_sizes = []

                        blocks.append({
                            "block_order": block_order,
                            "block_type": "text",
                            "original_text": text,
                            "simplified_text": None,
                            "image_path": None,
                            "image_description": None,
                            "page_number": page_num + 1,
                            "chapter_title": chapter_title
                        })
                        block_order += 1

                        # 复杂公式块：紧跟着插入区域截图
                        if is_complex and block_bbox:
                            try:
                                clip = fitz.Rect(*block_bbox)
                                pix = page.get_pixmap(dpi=dpi, clip=clip)
                                img_filename = f"doc{doc_id}_p{page_num+1}_b{block_order}.png"
                                img_path = os.path.join(self.image_dir, img_filename)
                                pix.save(img_path)
                                blocks.append({
                                    "block_order": block_order,
                                    "block_type": "image",
                                    "original_text": None,
                                    "simplified_text": None,
                                    "image_path": f"/static/uploads/images/{img_filename}",
                                    "image_description": "📐 公式区域截图",
                                    "page_number": page_num + 1,
                                    "chapter_title": chapter_title
                                })
                                block_order += 1
                            except Exception:
                                pass

                        # 表格单元格：记住最后出现位置
                        if cell_table_id is not None:
                            table_last_block[cell_table_id] = block_order - 1
                    else:
                        # 普通文字或简单公式：累积到缓冲区，相邻块用换行连接
                        # 简单公式（a+b=c, x>5, f(x)=y）保留文字，由LLM翻译时处理
                        buf_text = (buf_text + "\n" + text) if buf_text else text
                        buf_font_sizes.extend(font_sizes)

                elif block["type"] == 1:  # 嵌入图片
                    # 图片打断文字合并
                    flush_text_buffer()
                    buf_text = ""
                    buf_font_sizes = []
                    try:
                        image_bytes = block.get("image")
                        if image_bytes:
                            img = Image.open(io.BytesIO(image_bytes))
                            img_filename = f"doc{doc_id}_p{page_num+1}_b{block_order}.png"
                            img_path = os.path.join(self.image_dir, img_filename)
                            img.save(img_path)
                            blocks.append({
                                "block_order": block_order,
                                "block_type": "image",
                                "original_text": None,
                                "simplified_text": None,
                                "image_path": f"/static/uploads/images/{img_filename}",
                                "image_description": None,
                                "page_number": page_num + 1,
                                "chapter_title": chapter_title
                            })
                            block_order += 1
                    except Exception:
                        pass

            # 清空当前页的文字缓冲区
            flush_text_buffer()

            # 为每个检测到的表格生成整表截图，插入到该表最后一个单元格之后
            # 使用 pending_inserts 按目标 block_order 排序，倒序插入避免位置偏移
            pending_inserts = []
            for tid, tbbox in table_bboxes.items():
                if tid in table_last_block:
                    try:
                        clip = fitz.Rect(*tbbox)
                        pix = page.get_pixmap(dpi=dpi, clip=clip)
                        img_filename = f"doc{doc_id}_p{page_num+1}_table{tid}.png"
                        img_path = os.path.join(self.image_dir, img_filename)
                        pix.save(img_path)
                        pending_inserts.append({
                            "after_order": table_last_block[tid],
                            "block": {
                                "block_type": "image",
                                "original_text": None,
                                "simplified_text": None,
                                "image_path": f"/static/uploads/images/{img_filename}",
                                "image_description": f"📊 第{page_num+1}页表格截图",
                                "page_number": page_num + 1,
                                "chapter_title": chapter_title
                            }
                        })
                    except Exception:
                        pass

            # 按 after_order 降序排列，从后往前插入避免位置偏移
            pending_inserts.sort(key=lambda x: x["after_order"], reverse=True)
            for pi in pending_inserts:
                for i, b in enumerate(blocks):
                    if b.get("page_number") == page_num + 1 and b["block_order"] == pi["after_order"]:
                        block_order += 1
                        pi["block"]["block_order"] = block_order
                        blocks.insert(i + 1, pi["block"])
                        break

            # 每页末尾追加整页截图作为兜底参考
            try:
                pix = page.get_pixmap(dpi=dpi)
                page_img_filename = f"doc{doc_id}_page{page_num+1}.png"
                page_img_path = os.path.join(self.image_dir, page_img_filename)
                pix.save(page_img_path)
                blocks.append({
                    "block_order": block_order,
                    "block_type": "page_image",
                    "original_text": None,
                    "simplified_text": None,
                    "image_path": f"/static/uploads/images/{page_img_filename}",
                    "image_description": f"📄 第{page_num+1}页原版截图（公式/图表参考）",
                    "page_number": page_num + 1,
                    "chapter_title": chapter_title
                })
                block_order += 1
            except Exception:
                pass

        doc.close()
        if not toc and ocr_used:
            if ocr_chapters:
                for i, ch in enumerate(ocr_chapters):
                    ch["end_page"] = (ocr_chapters[i + 1]["start_page"] - 1
                                      if i < len(ocr_chapters) - 1 else 9999)
                chapters = ocr_chapters
            else:
                chapters = [{"level": 1, "title": "OCR 正文", "start_page": 1, "end_page": 9999}]
        return blocks, chapters

    def _ocr_heading_match(self, text):
        import re
        t = (text or "").strip()
        if len(t) > 80:
            return False
        patterns = [
            r"^第\s*[一二三四五六七八九十百零〇0-9]+\s*[章节篇部]",
            r"^Chapter\s+\d+",
            r"^Unit\s+\d+",
            r"^[0-9]+\s*[、.．]\s*\S+",
            r"^[一二三四五六七八九十]+\s*[、.．]\s*\S+",
        ]
        return any(re.match(p, t, re.IGNORECASE) for p in patterns)

    def _ocr_page_heading(self, lines, page_height):
        """Pick the first chapter-like line on an OCR page."""
        if not lines:
            return None
        heights = []
        for line in lines:
            box = line.get("box") or []
            if len(box) >= 4:
                ys = [float(pt[1]) for pt in box]
                heights.append(max(ys) - min(ys))
        median = sorted(heights)[len(heights) // 2] if heights else 0
        for line in lines:
            text = (line.get("text") or "").strip()
            if not text:
                continue
            if self._ocr_heading_match(text):
                return text
            box = line.get("box") or []
            if len(box) >= 4:
                ys = [float(pt[1]) for pt in box]
                h = max(ys) - min(ys)
                # Large, short, standalone line is a likely section heading.
                if median and h >= median * 1.35 and len(text) <= 32 and not text.endswith(("。", "，", ",", ".")):
                    return text
        return None

    def _is_formula_block(self, text, font_sizes):
        """
        判断文字块是否为数学公式。

        纯启发式规则（字体差异 / 符号密度 / 碎片比例），不依赖任何模型。
        """
        if not text:
            return False

        # 启发式规则
        if len(font_sizes) >= 3:
            fs_min, fs_max = min(font_sizes), max(font_sizes)
            if fs_max - fs_min > 4:
                return True

        math_symbols = len(re.findall(
            r'[+\-×÷=≠≈≡±∓∑∏∫∮∂∇√∛∜∞∧∨∩∪∈∉⊂⊃⊆⊇∀∃∄→←↑↓↔⇒⇔]', text
        ))
        if math_symbols >= 3:
            return True

        tokens = text.split()
        if len(tokens) >= 5:
            short_ratio = sum(1 for t in tokens if len(t) <= 2) / len(tokens)
            if short_ratio > 0.3:
                return True

        return False

    def _is_complex_formula(self, text):
        """
        判断公式是否包含复杂结构（需要截图），简单公式走文字保留。

        复杂结构特征（满足任一）：
          1. 积分/求和/求积/偏导/梯度/根号符号
          2. 嵌套分式（至少2层 / ）
          3. 矩阵特征：括号包裹 + 长分号分隔（如 a&b\\c&d）
          4. 下标/上标箭头组合（化学方程式）

        简单公式（这些不触发）：
          a+b=c, x>5, f(x)=y, E=mc² 这类一行表达式
        """
        if not text:
            return False

        # 特征1：复杂数学符号（积分/求和/求积/偏导/梯度/无穷）
        advanced_ops = re.findall(
            r'[∫∮∑∏∂∇√∛∜∞∬∭∯∰]', text
        )
        if advanced_ops:
            return True

        # 特征2：嵌套分式（至少两层 / 号，且不是URL）
        slash_count = text.count('/')
        if slash_count >= 2 and 'http' not in text.lower():
            return True

        # 特征3：LaTeX 风格的括号+分隔符组合（矩阵/分段函数）
        if re.search(r'[{}]', text) and re.search(r'[\\&]', text):
            return True

        # 特征4：上下标箭头组合（化学方程式/核反应）
        arrows = re.findall(r'[→←↑↓↔⇒⇔⇐⇑⇓]', text)
        sub_sup = re.findall(r'[_^]', text)
        if arrows and sub_sup:
            return True

        return False

    def _find_table_id(self, bbox, table_bboxes):
        """
        判断一个文字块属于页面上的哪个表格。
        返回 table_id（int），不属于任何表格时返回 None。
        """
        if not bbox or not table_bboxes:
            return None
        ax0, ay0, ax1, ay1 = bbox
        for tid, (bx0, by0, bx1, by1) in table_bboxes.items():
            if ax0 < bx1 and ax1 > bx0 and ay0 < by1 and ay1 > by0:
                return tid
        return None

    def _bbox_overlaps_any(self, bbox, bbox_list):
        """判断一个 bbox 是否与列表中的任一 bbox 有重叠（保留兼容）"""
        return self._find_table_id(bbox, {i: b for i, b in enumerate(bbox_list)}) is not None

    # ==================== Word处理 ====================

    def extract_docx(self, filepath, doc_id):
        """
        提取Word(.docx)文档的文字和图片。

        Word处理策略：
          - 遍历所有段落，识别标题样式(Heading)标记章节
          - 通过rels关系查找嵌入的图片
          - 图片在Word中没有精确的"位置"，按插入顺序排列

        返回：
          blocks: 内容块列表
          chapters: 从标题样式中提取的章节结构
        """
        blocks = []
        block_order = 0
        doc = DocxDocument(filepath)

        # 第一步：提取段落文字
        for para in doc.paragraphs:
            text = para.text.strip()
            style = para.style.name if para.style else ""

            # 通过样式名判断是否为标题（中文Word样式名可能含"标题"）
            is_heading = style and ('Heading' in style or 'heading' in style or
                                     'Title' in style or '标题' in style)

            if text and len(text) > 3:
                blocks.append({
                    "block_order": block_order,
                    "block_type": "heading" if is_heading else "text",
                    "original_text": text,
                    "simplified_text": None,
                    "image_path": None,
                    "image_description": None,
                    "page_number": None,
                    # 标题文字同时作为章节名
                    "chapter_title": text if is_heading else None
                })
                block_order += 1

        # 第二步：提取嵌入的图片
        for rel_id, rel in doc.part.rels.items():
            if "image" in rel.reltype:
                try:
                    image = rel.target_part
                    img_bytes = image.blob
                    ext = image.partname.split('.')[-1]
                    img_filename = f"doc{doc_id}_img{block_order}.{ext}"
                    img_path = os.path.join(self.image_dir, img_filename)
                    with open(img_path, 'wb') as f:
                        f.write(img_bytes)

                    blocks.append({
                        "block_order": block_order,
                        "block_type": "image",
                        "original_text": None,
                        "simplified_text": None,
                        "image_path": f"/static/uploads/images/{img_filename}",
                        "image_description": None,
                        "page_number": None,
                        "chapter_title": None
                    })
                    block_order += 1
                except Exception:
                    pass

        chapters = self._extract_chapters_from_blocks(blocks)
        return blocks, chapters

    # ==================== PPT处理 ====================

    def extract_pptx(self, filepath, doc_id):
        """
        提取PPT(.pptx)的文字和图片。

        PPT处理策略：
          - 逐幻灯片遍历，先提取文字再提取图片
          - 识别占位符(placeholder)中的Title作为幻灯片标题
          - 每张幻灯片的内容按出现顺序排列

        返回：
          blocks: 内容块列表
          chapters: 以幻灯片为单位的章节
        """
        blocks = []
        block_order = 0
        prs = Presentation(filepath)

        for slide_num, slide in enumerate(prs.slides, 1):
            slide_title = None

            for shape in slide.shapes:
                # 提取文字（文本框、标题框等）
                if hasattr(shape, "text_frame") and shape.has_text_frame:   # ← 加 hasattr
                    text = shape.text_frame.text.strip()
                    if text:
                        # 判断是否为标题占位符
                        is_title = shape.has_text_frame and (
                            'Title' in str(shape.placeholder_format.type)
                            if shape.is_placeholder else False
                        )
                        if is_title or not slide_title:
                            slide_title = text  # 第一段文字作为幻灯片标题

                        blocks.append({
                            "block_order": block_order,
                            "block_type": "slide_title" if is_title else "text",
                            "original_text": text,
                            "simplified_text": None,
                            "image_path": None,
                            "image_description": None,
                            "page_number": slide_num,
                            "chapter_title": slide_title if is_title else None
                        })
                        block_order += 1

                # 提取图片（shape_type == 13 表示Picture类型）
                if shape.shape_type == 13:
                    try:
                        image = shape.image
                        img_bytes = image.blob
                        ext = image.content_type.split('/')[-1]
                        img_filename = f"doc{doc_id}_s{slide_num}_b{block_order}.{ext}"
                        img_path = os.path.join(self.image_dir, img_filename)
                        with open(img_path, 'wb') as f:
                            f.write(img_bytes)

                        blocks.append({
                            "block_order": block_order,
                            "block_type": "image",
                            "original_text": None,
                            "simplified_text": None,
                            "image_path": f"/static/uploads/images/{img_filename}",
                            "image_description": None,
                            "page_number": slide_num,
                            "chapter_title": slide_title
                        })
                        block_order += 1
                    except Exception:
                        pass

        chapters = self._extract_chapters_from_blocks(blocks)
        return blocks, chapters

    # ==================== 文本简化 ====================

    def simplify_blocks(self, blocks, llm_service):
        """
        工序3：对内容块中的文字调用LLM进行简化翻译。

        处理规则：
          - 文字块(text/heading/slide_title) → 调用LLM简化
          - 图片块(image) → 添加占位描述"[图片 - 已保留原图]"
          - 简化失败时保留原文，不阻塞流程
        """
        for block in blocks:
            if block["block_type"] in ("text", "heading", "slide_title") and block["original_text"]:
                try:
                    block["simplified_text"] = llm_service.simplify_text(
                        block["original_text"]
                    )
                except Exception:
                    # 简化失败时保留原文，确保内容不丢失
                    block["simplified_text"] = block["original_text"]
            elif block["block_type"] == "image" and block["image_path"]:
                block["image_description"] = "[图片 - 已保留原图]"
        return blocks

    # ==================== 教程重组 ====================

    def reassemble(self, blocks, chapters):
        """
        工序4：将处理后的内容块重组成教程格式。

        重组策略：
          1. 优先使用目录/章节结构分组
          2. 每个章节内的块按block_order排序（保持原始图文位置）
          3. 如果没有章节结构，将所有内容归入"全文内容"
        """
        tutorial = []

        for chapter in chapters:
            # 收集属于本章节的所有内容块
            chapter_blocks = [
                b for b in blocks
                if b.get("chapter_title") == chapter["title"]
                or b.get("page_number", 0) >= chapter.get("start_page", 0)
                and (chapter.get("end_page", 9999) is None
                     or b.get("page_number", 0) <= chapter.get("end_page", 0))
            ]
            if chapter_blocks:
                tutorial.append({
                    "type": "chapter_title",
                    "title": f"# {chapter['title']}",
                    "blocks": chapter_blocks
                })

        # 如果无法解析章节，按顺序输出全部内容
        if not tutorial:
            tutorial.append({
                "type": "chapter_title",
                "title": "# 全文内容",
                "blocks": blocks
            })

        return tutorial

    # ==================== 内部辅助方法 ====================

    def _parse_toc(self, toc):
        """
        解析PDF目录(Table of Contents)。

        PDF的TOC格式：[(level, title, page_number), ...]
        解析后计算每个章节的起始页和结束页（下一个章节起始页-1即为本页结束页）。
        """
        chapters = []
        if toc:
            for item in toc:
                level, title, page = item
                chapters.append({
                    "level": level,        # 目录层级（1=一级标题，2=二级标题...）
                    "title": title,        # 章节标题文本
                    "start_page": page     # 章节起始页码
                })
            # 计算每个章节的结束页：下一个章节的起始页-1
            for i, ch in enumerate(chapters):
                if i < len(chapters) - 1:
                    ch["end_page"] = chapters[i + 1]["start_page"] - 1
                else:
                    ch["end_page"] = 9999  # 最后一章到文档末尾
        return chapters

    def _extract_chapters_from_blocks(self, blocks):
        """
        从内容块中提取章节结构（用于Word/PPT等没有内置目录的文档）。

        将block_type为heading/slide_title的块识别为章节标题，
        用 block_order 范围划分章节边界（替代页码，兼容所有文档类型）。
        """
        chapters = []
        for block in blocks:
            if block["block_type"] in ("heading", "slide_title") and block.get("original_text"):
                chapters.append({
                    "level": 1,
                    "title": block["original_text"],
                    "start_order": block["block_order"]
                })
        # 计算每个章节的 block_order 结束范围
        max_order = max((b["block_order"] for b in blocks), default=0)
        for i, ch in enumerate(chapters):
            if i < len(chapters) - 1:
                ch["end_order"] = chapters[i + 1]["start_order"] - 1
            else:
                ch["end_order"] = max_order
        return chapters

    def _find_chapter_for_page(self, page_num, chapters):
        """
        根据页码查找所属章节名称。
        用于将PDF中提取的内容块标记到对应章节。
        """
        for ch in chapters:
            start = ch.get("start_page", 0)
            end = ch.get("end_page", 9999)
            if start <= page_num <= end:
                return ch["title"]
        return None
