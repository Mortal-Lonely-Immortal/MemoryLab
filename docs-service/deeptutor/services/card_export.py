import os
import tempfile
from typing import Any, Dict, List

import requests
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

from deeptutor.config import Config

BLUE = "E8F1FA"


def _shade(paragraph, fill: str) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    p_pr.append(shd)


def _clean(text: Any, limit: int) -> str:
    value = " ".join(str(text or "").split())
    return value[:limit]


def _chapter_blocks(chapter: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        b for b in chapter.get("blocks", [])
        if b.get("block_type") == "text"
        and (b.get("simplified_text") or b.get("original_text"))
    ]


def build_cards_docx(tutorial_data: Dict[str, Any], doc_id: int) -> str:
    """把教程章节压成“每章一个知识点”的结构化 docx，供记忆后端导入。"""
    filename = tutorial_data.get("filename") or f"document-{doc_id}"
    tutorial = tutorial_data.get("tutorial") or []
    if not tutorial:
        raise ValueError("文档还没有可用的教程内容")

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.size = Pt(10.5)

    doc.add_heading(f"教材翻译｜{filename}", level=1)

    for index, chapter in enumerate(tutorial, start=1):
        title = _clean(chapter.get("chapter") or f"第 {index} 章", 80)
        blocks = _chapter_blocks(chapter)
        if not blocks:
            continue

        heading = f"教材{doc_id}｜{title}"[:120]
        doc.add_heading(heading, level=3)

        first = _clean(blocks[0].get("simplified_text") or blocks[0].get("original_text"), 260)
        if first:
            p = doc.add_paragraph()
            p.add_run("一句话：" + first).bold = True
            _shade(p, BLUE)

        for block in blocks[1:7]:
            point = _clean(block.get("simplified_text") or block.get("original_text"), 160)
            if point and point != first:
                doc.add_paragraph(point, style="List Bullet")

        p = doc.add_paragraph()
        run = p.add_run(f"来源：教材翻译 {filename} · 第 {index} 节")
        run.italic = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    out_dir = os.path.join(Config.UPLOAD_FOLDER, "cards")
    os.makedirs(out_dir, exist_ok=True)
    fd, path = tempfile.mkstemp(prefix=f"doc{doc_id}-", suffix=".docx", dir=out_dir)
    os.close(fd)
    doc.save(path)
    return path


def import_to_memory(docx_path: str, doc_id: int) -> Dict[str, Any]:
    url = Config.MEMORY_API_URL.rstrip("/") + "/import/docx"
    with open(docx_path, "rb") as handle:
        response = requests.post(
            url,
            files={"file": (f"textbook-{doc_id}.docx", handle,
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            timeout=180,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"记忆后端返回 {response.status_code}: {response.text[:300]}")
    payload = response.json()
    if payload.get("code") != 0:
        raise RuntimeError(payload.get("message") or "记忆后端导入失败")
    return payload.get("data") or {}
