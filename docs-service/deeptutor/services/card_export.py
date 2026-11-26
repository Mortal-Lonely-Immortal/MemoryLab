import os
import re
import tempfile
from typing import Any, Dict, List

import requests
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

from deeptutor.config import Config

BLUE = "E8F1FA"
GRAY = "F2F2F2"


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


def _text_of(block: Dict[str, Any]) -> str:
    return " ".join(str(block.get("simplified_text") or block.get("original_text") or "").split())


def _chapter_blocks(chapter: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        b for b in chapter.get("blocks", [])
        if b.get("block_type") in ("text", "heading", "slide_title")
        and _text_of(b)
    ]


def _split_sentences(text: str) -> List[str]:
    """Split Chinese/English prose into review-sized sentences."""
    text = " ".join(str(text or "").split())
    if not text:
        return []
    parts = re.split(r'(?<=[。！？!?；;])\s*', text)
    out = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) <= 260:
            out.append(part)
            continue
        # Very long paragraphs: split again at commas, then hard-wrap.
        clauses = re.split(r'(?<=[，,、])\s*', part)
        cur = ""
        for clause in clauses:
            if not cur:
                cur = clause
            elif len(cur) + len(clause) <= 240:
                cur += clause
            else:
                out.append(cur)
                cur = clause
        if cur:
            out.append(cur)
    return out


def _is_noise(text: str) -> bool:
    t = text.strip()
    if len(t) < 12:
        return True
    if re.match(r'^(第?\d+\s*[页章节]|page\s*\d+)$', t, re.I):
        return True
    if re.match(r'^(来源|出处|本节|本章|目录|前言|附录)\s*[:：]?', t):
        return True
    if re.search(r'(版权所有|仅供学习|参考教材|扫码|关注公众号)', t):
        return True
    return False


def _importance(text: str) -> int:
    """Cheap importance signal; used only for ordering/dedup, not truth."""
    keys = (
        "定义", "是指", "称为", "包括", "分为", "组成", "原理", "机制",
        "特点", "作用", "优点", "缺点", "区别", "步骤", "过程", "条件",
        "公式", "定理", "法则", "原因", "结果", "例如", "注意",
    )
    score = sum(1 for k in keys if k in text)
    if re.search(r'\d', text):
        score += 1
    if 40 <= len(text) <= 220:
        score += 1
    return score


def _headline(text: str, chapter: str) -> str:
    """A content-derived question stem for an atomic unit."""
    clean = " ".join(str(text or "").split()).strip()
    subject = re.split(r'[，。；：,;:]', clean)[0].strip()
    subject = re.sub(r'^[（(]?[一二三四五六七八九十\d]+[）).、]\s*', '', subject)
    subject = subject[:42] or "这一知识点"

    # Prefer a real question over "…的要点是什么" when the sentence gives
    # a definition, classification, composition, or purpose.
    if "组成" in clean:
        idx = clean.find("组成")
        cut = clean.find("由", 0, idx)
        head = clean[:cut if cut >= 0 else idx].strip("，。；：,;: ")
        if 2 <= len(head) <= 42:
            return f"{head}由哪些部分组成？"
    if "分为" in clean:
        idx = clean.find("分为")
        head = clean[:idx].strip("，。；：,;: ")
        if 2 <= len(head) <= 42:
            return f"{head}分为哪些部分？"
    if "是" in clean and "是指" not in clean and "称为" not in clean:
        idx = clean.find("是")
        head = clean[:idx].strip("，。；：,;: ")
        if 2 <= len(head) <= 42:
            return f"什么是{head}？"
    for marker, template in (
        ("是指", "什么是{subject}？"),
        ("称为", "什么是{subject}？"),
        ("分为", "{subject}分为哪些部分？"),
        ("包括", "{subject}包括哪些内容？"),
        ("组成", "{subject}由哪些部分组成？"),
        ("优点", "{subject}有哪些优点？"),
        ("缺点", "{subject}有哪些缺点？"),
        ("作用", "{subject}有什么作用？"),
        ("区别", "{subject}有什么区别？"),
    ):
        if marker in clean:
            idx = clean.find(marker)
            head = clean[:idx].strip("，。；：,;: ")
            if 2 <= len(head) <= 42:
                return template.format(subject=head)
    # Generic but still answerable without seeing the answer.
    return f"请说明「{chapter}」中“{subject}”的含义或要点。"


def _atomic_units(tutorial_data: Dict[str, Any]) -> List[Dict[str, str]]:
    units: List[Dict[str, str]] = []
    seen = set()
    for chapter_index, chapter in enumerate(tutorial_data.get("tutorial") or [], start=1):
        chapter_name = _clean(chapter.get("chapter") or f"第 {chapter_index} 章", 80)
        sentences: List[str] = []
        for block in _chapter_blocks(chapter):
            text = _text_of(block)
            if not text:
                continue
            sentences.extend(_split_sentences(text))

        # One sentence = one atomic knowledge point. Never merge a full
        # paragraph into the next card just to hit a character target.
        grouped = [sentence for sentence in sentences if not _is_noise(sentence)]

        candidates = []
        for group in grouped:
            answer = " ".join(group.split()).strip()
            if not answer or len(answer) < 16 or len(answer) > 360:
                continue
            key = re.sub(r'[^\w\u4e00-\u9fff]', '', answer.lower())
            if key in seen:
                continue
            seen.add(key)
            candidates.append({
                "chapter": chapter_name,
                "answer": answer,
                "question": _headline(answer, chapter_name),
                "score": _importance(answer),
            })

        # Keep the strongest 8 per chapter, but preserve reading order.
        selected = sorted(enumerate(candidates), key=lambda x: (-x[1]["score"], x[0]))[:8]
        selected.sort(key=lambda x: x[0])
        units.extend(item for _, item in selected)
    return units


def build_cards_docx(tutorial_data: Dict[str, Any], doc_id: int) -> str:
    """Build atomic Q/A notes for the memory importer.

    Each heading is one note; the importer reads explicit ``Q:`` / ``A:``
    paragraphs and creates exactly one focused card per note. Older builders
    produced one massive card per chapter, which mixed unrelated points.
    """
    filename = tutorial_data.get("filename") or f"document-{doc_id}"
    units = _atomic_units(tutorial_data)
    if not units:
        raise ValueError("文档还没有可切分的原子知识点")

    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    style.font.size = Pt(10.5)

    doc.add_heading(f"教材翻译｜{filename}", level=1)

    for index, unit in enumerate(units, start=1):
        chapter = _clean(unit["chapter"], 80)
        heading = f"教材{doc_id}｜{chapter}｜知识点 {index:02d}"[:120]
        doc.add_heading(heading, level=3)

        p = doc.add_paragraph()
        p.add_run("Q: " + unit["question"]).bold = True
        _shade(p, BLUE)

        p = doc.add_paragraph()
        p.add_run("A: " + unit["answer"])
        _shade(p, GRAY)

        p = doc.add_paragraph()
        run = p.add_run(f"来源：教材翻译 {filename} · {chapter}")
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
