"""
图片 + 文字教程导出
===================
把已经提取/简化的课件内容块，按原始顺序重组成可在本机打开的
DOCX（图片已嵌入门档）和独立 HTML，并生成一个可以通过资源管理器
直接查看的文件夹。

输出目录：
  <DOCS_DATA_DIR>/tutorials/doc_<id>/
    <课件名>_图文教程.docx
    tutorial.html
    images/...
    tutorial.json

不依赖外部服务；图片来自 document_blocks.image_path，也就是处理课件时
已经保存到 uploads/images/ 的原始截图/插图。
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from deeptutor.config import Config
from deeptutor.database import get_db


TUTORIAL_ROOT = os.path.join(Config.DATA_DIR, "tutorials")

_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n]+')


def _safe_name(value: str, fallback: str = "tutorial") -> str:
    value = _ILLEGAL.sub("_", str(value or "")).strip(" ._")
    return (value or fallback)[:70]


def _folder_for(doc_id: int) -> str:
    return os.path.join(TUTORIAL_ROOT, f"doc_{doc_id}")


def _image_from_block(block: Dict[str, Any]) -> Optional[str]:
    raw = block.get("image_path") or ""
    if not raw:
        return None
    name = os.path.basename(str(raw).replace("\\", "/"))
    if not name:
        return None
    # 标准提取路径：/static/uploads/images/<name>
    path = os.path.join(Config.UPLOAD_FOLDER, "images", name)
    if os.path.isfile(path):
        return path
    # 兼容旧数据：image_path 直接存了本机绝对/相对路径
    if os.path.isabs(raw) and os.path.isfile(raw):
        return raw
    alt = os.path.join(Config.UPLOAD_FOLDER, str(raw).lstrip("/\\"))
    if os.path.isfile(alt):
        return alt
    return None


def _text_for(block: Dict[str, Any]) -> str:
    text = (block.get("simplified_text") or block.get("original_text") or "").strip()
    if not text:
        return ""
    # 旧版本曾把 API 错误写进 simplified_text；导出时忽略。
    if re.match(r"^(API错误|请求失败|请求超时|请先在设置中配置API密钥)", text):
        return ""
    return re.sub(r"\n{3,}", "\n\n", text)


def _set_cn_font(run, size: Optional[float] = None, bold: Optional[bool] = None,
                 color: Optional[RGBColor] = None):
    run.font.name = "Microsoft YaHei"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def _add_docx_heading(doc: Document, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.keep_with_next = True
    _set_cn_font(p.add_run(text), 15, True, RGBColor(0x18, 0x33, 0x6B))


def _add_docx_text(doc: Document, text: str):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.45
    _set_cn_font(p.add_run(text), 10.5, False, RGBColor(0x22, 0x22, 0x22))


def _add_docx_image(doc: Document, path: str, description: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(2)
    try:
        p.add_run().add_picture(path, width=Inches(6.15))
    except Exception:
        _add_docx_text(doc, f"[图片无法嵌入：{os.path.basename(path)}]")
        return
    if description:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_after = Pt(8)
        _set_cn_font(cap.add_run(description), 8.5, False, RGBColor(0x77, 0x77, 0x77))


def _extract_fallback_images(doc: Dict[str, Any], images_dir: str):
    """旧文档可能只有文字块；从原文件补提取页面/插图。"""
    source = os.path.join(Config.UPLOAD_FOLDER, doc.get("filename") or "")
    pages: Dict[int, str] = {}
    extras: List[str] = []
    if not os.path.isfile(source):
        return pages, extras
    ftype = (doc.get("file_type") or "").lower()
    if ftype == "pdf":
        try:
            import fitz
            pdf = fitz.open(source)
            for i in range(min(len(pdf), 160)):
                page = pdf[i]
                pix = page.get_pixmap(matrix=fitz.Matrix(1.45, 1.45), alpha=False)
                name = f"_page_{i + 1:03d}.png"
                path = os.path.join(images_dir, name)
                pix.save(path)
                pages[i + 1] = path
            pdf.close()
        except Exception:
            pass
    elif ftype in ("docx", "pptx"):
        prefix = "word/media/" if ftype == "docx" else "ppt/media/"
        try:
            with zipfile.ZipFile(source) as z:
                for idx, name in enumerate(
                    n for n in z.namelist()
                    if n.startswith(prefix) and os.path.splitext(n)[1].lower() in (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")
                ):
                    data = z.read(name)
                    out = os.path.join(images_dir, f"_media_{idx + 1:03d}{os.path.splitext(name)[1].lower()}")
                    with open(out, "wb") as f:
                        f.write(data)
                    extras.append(out)
        except Exception:
            pass
    return pages, extras


def _load_doc(doc_id: int):
    conn = get_db()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    blocks = conn.execute(
        "SELECT * FROM document_blocks WHERE document_id = ? ORDER BY block_order",
        (doc_id,),
    ).fetchall()
    conn.close()
    return (dict(doc) if doc else None), [dict(b) for b in blocks]


def build_tutorial(doc_id: int, open_folder: bool = False) -> Dict[str, Any]:
    doc, blocks = _load_doc(doc_id)
    if not doc:
        raise ValueError("文档不存在")
    if not blocks:
        raise ValueError("这个文档还没有提取内容，请先点 EXTRACT 提取")

    folder = _folder_for(doc_id)
    images_dir = os.path.join(folder, "images")
    os.makedirs(images_dir, exist_ok=True)
    fallback_pages, fallback_extras = _extract_fallback_images(doc, images_dir)

    title = os.path.splitext(doc.get("original_name") or f"doc_{doc_id}")[0]
    docx_name = f"{_safe_name(title, '课件')}_图文教程.docx"
    docx_path = os.path.join(folder, docx_name)
    html_path = os.path.join(folder, "tutorial.html")

    docx = Document()
    section = docx.sections[0]
    section.top_margin = Inches(0.65)
    section.bottom_margin = Inches(0.65)
    section.left_margin = Inches(0.72)
    section.right_margin = Inches(0.72)

    # 封面
    p = docx.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(80)
    _set_cn_font(p.add_run(title), 24, True, RGBColor(0x11, 0x11, 0x11))
    p = docx.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _set_cn_font(p.add_run("图 文 教 程"), 13, True, RGBColor(0x1B, 0x57, 0xFF))
    p = docx.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    _set_cn_font(
        p.add_run(f"由 {doc.get('original_name') or ''} 重组 · {datetime.now().strftime('%Y-%m-%d')}"),
        9, False, RGBColor(0x77, 0x77, 0x77),
    )
    docx.add_page_break()

    html_parts: List[str] = []
    last_chapter = None
    image_count = 0
    text_count = 0
    image_urls: Dict[str, str] = {}

    for block in blocks:
        block_type = (block.get("block_type") or "").lower()
        chapter = (block.get("chapter_title") or "").strip()
        text = _text_for(block)

        page_no = block.get("page_number")
        if page_no in fallback_pages:
            src = fallback_pages.pop(page_no)
            order = int(block.get("block_order") or 0)
            out_name = f"{order:05d}_{os.path.basename(src)}"
            out_path = os.path.join(images_dir, out_name)
            try:
                shutil.copy2(src, out_path)
                image_count += 1
                _add_docx_image(docx, out_path, f"第 {page_no} 页")
                html_parts.append('<figure><img src="images/' + html.escape(out_name) + '" alt=""><figcaption>第 ' + str(page_no) + ' 页</figcaption></figure>')
            except Exception:
                pass

        # 章节标题只在变化时出现，避免每个块重复一次
        if chapter and chapter != last_chapter and block_type not in ("heading", "slide_title"):
            _add_docx_heading(docx, chapter)
            html_parts.append(f"<h2>{html.escape(chapter)}</h2>")
            last_chapter = chapter

        if block_type in ("heading", "slide_title") and text:
            if text != last_chapter:
                _add_docx_heading(docx, text)
                html_parts.append(f"<h2>{html.escape(text)}</h2>")
                last_chapter = text
            continue

        if block_type in ("image", "page_image", "table_image"):
            src = _image_from_block(block)
            if not src:
                continue
            order = int(block.get("block_order") or 0)
            base = _safe_name(os.path.basename(src), "image")
            # 同时保留原始文件名和顺序，避免同名覆盖
            out_name = f"{order:05d}_{base}"
            out_path = os.path.join(images_dir, out_name)
            try:
                shutil.copy2(src, out_path)
            except Exception:
                continue
            image_count += 1
            image_urls[out_name] = out_name
            _add_docx_image(docx, out_path, block.get("image_description") or "")
            html_parts.append(
                '<figure><img src="images/' + html.escape(out_name) + '" alt="">'
                + ("<figcaption>" + html.escape(block.get("image_description") or "") + "</figcaption>" if block.get("image_description") else "")
                + "</figure>"
            )
            continue

        if text:
            # 表格/文本都按段落输出；保留原始换行
            _add_docx_text(docx, text)
            text_count += 1
            for para in re.split(r"\n{2,}", text):
                para = para.strip()
                if para:
                    html_parts.append(f"<p>{html.escape(para)}</p>")

    if fallback_extras:
        _add_docx_heading(docx, "课件插图")
        html_parts.append("<h2>课件插图</h2>")
        for src in fallback_extras:
            out_name = "media_" + os.path.basename(src).lstrip("_")
            out_path = os.path.join(images_dir, out_name)
            try:
                shutil.copy2(src, out_path)
                image_count += 1
                _add_docx_image(docx, out_path, "")
                html_parts.append('<figure><img src="images/' + html.escape(out_name) + '" alt=""></figure>')
            except Exception:
                pass

    docx.save(docx_path)

    html_title = html.escape(title)
    html_doc = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>""" + html_title + """ · 图文教程</title>
<style>
body{margin:0;background:#eef5f9;color:#0a1230;font:16px/1.8 "Microsoft YaHei",sans-serif}
main{max-width:900px;margin:0 auto;padding:48px 24px 100px}
h1{font-size:36px;margin:0 0 4px;color:#071a5c}h2{font-size:23px;margin:42px 0 14px;padding-bottom:8px;border-bottom:3px solid #35d1e8;color:#071a5c}
p{white-space:pre-wrap;margin:10px 0}figure{margin:20px 0;text-align:center}
img{max-width:100%;height:auto;border:1px solid #b9d6e7;box-shadow:8px 8px 0 #cfeaf6}
figcaption{font-size:12px;color:#6b7f99;margin-top:8px}
.meta{color:#6b7f99;font-size:12px;margin-bottom:36px}
</style></head><body><main><h1>""" + html_title + """</h1>
<div class="meta">图 文 教 程 · """ + str(datetime.now().strftime("%Y-%m-%d")) + """ · """ + str(image_count) + """ 张图 / """ + str(text_count) + """ 段文字</div>
""" + "\n".join(html_parts) + "</main></body></html>"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_doc)

    manifest = {
        "doc_id": doc_id,
        "title": title,
        "source": doc.get("original_name"),
        "folder": folder,
        "docx": docx_path,
        "html": html_path,
        "images": image_count,
        "text_blocks": text_count,
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }
    with open(os.path.join(folder, "tutorial.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    if open_folder:
        open_tutorial_folder(doc_id)

    return manifest


def open_tutorial_folder(doc_id: int) -> str:
    folder = _folder_for(doc_id)
    if not os.path.isdir(folder):
        raise ValueError("教程文件夹还不存在，请先生成教程")
    if sys.platform.startswith("win"):
        # explorer 选择目录；不等待进程，服务请求立即返回。
        subprocess.Popen(["explorer.exe", os.path.normpath(folder)], close_fds=True)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", folder])
    else:
        subprocess.Popen(["xdg-open", folder])
    return folder
