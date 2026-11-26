# -*- coding: utf-8 -*-
"""Memory Lab 六类图的统一生成入口。

用法：
    python figs/make_memorylab_figs.py
输出：
    docs/figures/*.svg
再用 Edge 无头模式截图成 PNG，见 docs/绘图方案.md。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, RED, GREY, INK, LINE
from seqkit import render as render_seq
import svg_class_layered
import svg_arch_layered

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIG = os.path.join(ROOT, "docs", "figures")
os.makedirs(FIG, exist_ok=True)


def ortho_arrow(cv, pts, color=LINE, sw=1.5, head=9, dash=None):
    cv.polyline(pts, color, sw, dash=dash)
    # arrow head at last segment
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    import math
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    p1 = (x2 - ux * head + px * head * 0.5, y2 - uy * head + py * head * 0.5)
    p2 = (x2 - ux * head - px * head * 0.5, y2 - uy * head - py * head * 0.5)
    cv.polygon([(x2, y2), p1, p2], color, color, 1.0)


def actor(cv, x, y, name, tag=None):
    cv.ellipse(x, y, 12, 12, "white", INK, 1.6)
    cv.line(x, y + 12, x, y + 52, INK, 1.6)
    cv.line(x - 25, y + 30, x + 25, y + 30, INK, 1.6)
    cv.line(x, y + 52, x - 20, y + 82, INK, 1.6)
    cv.line(x, y + 52, x + 20, y + 82, INK, 1.6)
    cv.text(x, y + 102, name, 20, INK, True)
    if tag:
        cv.text(x, y + 126, tag, 13, "#7F8C8D")


def box(cv, x, y, w, h, title, lines=None, color=BLUE, title_size=19, line_size=16):
    fill, edge, ink = color
    cv.rect(x, y, w, h, fill, edge, 1.6)
    cv.text(x + w / 2, y + 22, title, title_size, ink, True)
    if lines:
        cv.line(x, y + 42, x + w, y + 42, edge, 1.2)
        yy = y + 54
        for s in lines:
            cv.text(x + 10, yy, s, line_size, "#2C3E50", anchor="lm")
            yy += 23


def usecase():
    cv = Svg(1600, 1000)
    cv.rect(430, 65, 750, 860, "white", "#7F92A5", 1.5, dash="10 8")
    cv.text(805, 92, "Memory Lab 本地工作台", 19, "#4A5F75", True)
    actor(cv, 180, 480, "学习者", "<<local user>>")
    actor(cv, 1370, 480, "AI 模型 / DeepTutor", "<<external>>")

    names = [
        "导入 PDF / Word / PPT", "提取图文", "简化教程", "生成记忆卡",
        "复习卡片", "管理卡片与卡组", "查看统计", "方法周实验",
        "AI 导师答疑", "划线提问", "导师生成卡片", "配置模型", "DeepTutor 工作台", "回忆卡片", "文言白话改写",
    ]
    top, step = 190, 50
    ucs = []
    for i, name in enumerate(names):
        cy = top + i * step
        cv.ellipse(805, cy, 300, 25, "#E8F1FB", "#2E5E8C", 1.3)
        cv.text(805, cy, name, 17, INK)
        ucs.append((cy, 505, 1105))
    for cy, l, r in ucs:
        cv.line(205, 500, l, cy, LINE, 1.0)
    # external association bus, outside the system boundary
    cv.line(1342, 500, 1210, 500, "#6B4410", 1.2)
    cv.line(1210, 500, 1210, 890, "#6B4410", 1.2)
    for idx in (2, 8, 9, 10, 12, 14):
        cy, l, r = ucs[idx]
        cv.line(1210, cy, r, cy, "#6B4410", 1.2)
    cv.text(800, 955, "外部服务不可用时，导入、复习、统计和卡片管理仍可离线使用。", 14, "#5D6D7E")
    cv.save(os.path.join(FIG, "usecase.svg"))


def architecture():
    cv = Svg(1800, 980)
    cv.rect(40, 30, 1520, 170, "#FBFCFE", "#B7C3CF", 1.3)
    cv.text(60, 52, "Windows 10 / 11 x64", 16, "#5D6D7E", anchor="lm")
    box(cv, 90, 82, 360, 70, "Edge 应用窗口", None, BLUE)
    box(cv, 1060, 82, 430, 70, "MemoryLab.exe  C# 启动器", None, GREY)

    cv.rect(40, 260, 1520, 300, "#FBFCFE", "#B7C3CF", 1.3)
    cv.text(60, 282, "本地服务  127.0.0.1", 16, "#5D6D7E", anchor="lm")
    box(cv, 610, 300, 380, 64, "Nginx :18080  P5/P3 + 反向代理", None, ORANGE)
    box(cv, 90, 425, 340, 90, "Spring Boot :18081", ["卡片 / 复习 / 统计 / 方法"], GREEN, 18, 15)
    box(cv, 555, 425, 340, 90, "Flask :15000", ["文档 / 导师 / OCR"], ORANGE, 18, 15)
    box(cv, 1020, 425, 340, 90, "DeepTutor :3782/:8001", ["可选全科工作台"], GREY, 18, 15)
    box(cv, 1580, 300, 180, 60, "LLM API", ["可选"], RED, 16, 13)

    cv.rect(40, 630, 1520, 260, "#FBFCFE", "#B7C3CF", 1.3)
    cv.text(60, 652, "本地数据", 16, "#5D6D7E", anchor="lm")
    box(cv, 90, 700, 280, 80, "H2 文件库", ["data/db"], PURPLE, 18, 15)
    box(cv, 430, 700, 280, 80, "SQLite tutor.db", ["文档块 / 聊天"], PURPLE, 18, 15)
    box(cv, 770, 700, 280, 80, "uploads / tutorials", ["教材、教程、图片"], PURPLE, 18, 15)
    box(cv, 1110, 700, 300, 80, "data/deeptutor", ["独立工作区"], PURPLE, 18, 15)

    # top -> nginx
    ortho_arrow(cv, [(270, 152), (270, 250), (800, 250), (800, 300)], LINE, 1.4)
    cv.line(1275, 152, 1275, 250, LINE, 1.2, dash="8 6")
    cv.label(1275, 200, "启动/停止", 13, "#5D6D7E")
    # nginx -> services
    for x in (260, 800, 1190):
        ortho_arrow(cv, [(800, 364), (800, 392), (x, 392), (x, 425)], LINE, 1.3)
    # docs -> llm
    ortho_arrow(cv, [(895, 470), (920, 470), (920, 390), (1570, 390), (1570, 330), (1580, 330)], "#A8564A", 1.3, 8, dash="8 6")
    cv.label(1250, 378, "HTTPS", 13, "#A8564A")
    # stores: connect each service to its own store
    ortho_arrow(cv, [(260, 515), (260, 650), (230, 650), (230, 700)], LINE, 1.3)
    ortho_arrow(cv, [(725, 515), (725, 600), (570, 600), (570, 700)], LINE, 1.3)
    ortho_arrow(cv, [(725, 515), (725, 600), (910, 600), (910, 700)], LINE, 1.3)
    ortho_arrow(cv, [(1190, 515), (1190, 650), (1260, 650), (1260, 700)], LINE, 1.3)
    cv.save(os.path.join(FIG, "architecture.svg"))


def relationship():
    cv = Svg(1600, 1020)
    ents = {
        "用户": (80, 450, 190),
        "卡组": (360, 450, 190),
        "知识点": (640, 450, 190),
        "卡片": (920, 450, 190),
        "复习记录": (1200, 450, 210),
        "标签": (920, 650, 190),
        "FSRS 参数": (80, 270, 210),
        "每日统计": (80, 150, 210),
        "导入任务": (80, 30, 210),
        "学习方法": (80, 740, 210),
        "周计划": (360, 740, 190),
        "计划条目": (640, 740, 190),
        "方法打分": (920, 740, 190),
        "学习会话": (80, 880, 210),
        "教材文档": (360, 900, 210),
        "文档块": (640, 900, 190),
        "图文教程": (920, 900, 210),
    }
    for name, (x, y, w) in ents.items():
        cv.rect(x, y, w, 58, "#F3F6FA", "#8796A8", 1.3)
        cv.text(x + w / 2, y + 29, name, 17, INK, True)

    def h(a, b, label="1:n"):
        ax, ay, aw = ents[a]
        bx, by, bw = ents[b]
        cv.arrow(ax + aw, ay + 29, bx, by + 29, LINE, 1.2)
        cv.label((ax + aw + bx) / 2, ay + 17, label, 12, "#5D6D7E")

    def v(a, b, label="1:n"):
        ax, ay, aw = ents[a]
        bx, by, bw = ents[b]
        cv.arrow(ax + aw / 2, ay + 58, bx + bw / 2, by, LINE, 1.2)
        cv.label(ax + aw / 2 + 16, (ay + 58 + by) / 2, label, 12, "#5D6D7E")

    for a, b in [("用户", "卡组"), ("卡组", "知识点"), ("知识点", "卡片"),
                 ("卡片", "复习记录")]:
        h(a, b)
    v("卡片", "标签", "n:m")
    # left branches
    cv.path_arrow([(175, 450), (175, 328)], LINE, 1.2, 8)
    cv.label(192, 390, "1:n", 12, "#5D6D7E")
    cv.path_arrow([(175, 270), (175, 208)], LINE, 1.2, 8)
    cv.label(192, 238, "1:n", 12, "#5D6D7E")
    cv.path_arrow([(175, 150), (175, 88)], LINE, 1.2, 8)
    cv.label(192, 118, "1:n", 12, "#5D6D7E")
    cv.path_arrow([(175, 508), (175, 740)], LINE, 1.2, 8)
    cv.label(192, 620, "1:n", 12, "#5D6D7E")
    cv.path_arrow([(175, 798), (175, 880)], LINE, 1.2, 8)
    cv.label(192, 840, "1:n", 12, "#5D6D7E")
    # learning chain
    h("学习方法", "周计划")
    h("周计划", "计划条目")
    h("计划条目", "方法打分")
    # docs chain
    h("教材文档", "文档块")
    h("文档块", "图文教程")
    ortho_arrow(cv, [(735, 900), (860, 900), (860, 479), (830, 479)], LINE, 1.2, 8, dash="8 6")
    cv.label(870, 690, "生成", 12, "#5D6D7E")
    cv.save(os.path.join(FIG, "relationship.svg"))


def er():
    cv = Svg(1600, 1300)
    tables = {
        "SYS_USER": (80, 60, 330, ["PK id : bigint", "username : varchar", "desired_retention : decimal"]),
        "DECK": (80, 310, 330, ["PK id : bigint", "FK user_id : bigint", "name : varchar", "card_count : int"]),
        "NOTE": (80, 560, 330, ["PK id : bigint", "FK deck_id : bigint", "title : varchar", "source : varchar"]),
        "CARD": (80, 810, 330, ["PK id : bigint", "FK note_id : bigint", "FK deck_id : bigint", "front / back : text", "state / due_date"]),
        "REVIEW_LOG": (80, 1060, 330, ["PK id : bigint", "FK card_id : bigint", "rating : tinyint", "reviewed_at : datetime"]),
        "FSRS_PARAM": (610, 310, 330, ["PK id : bigint", "FK user_id : bigint", "weights : json", "desired_retention : decimal"]),
        "LEARNING_METHOD": (1100, 60, 330, ["PK id : bigint", "name : varchar", "category : varchar", "evidence_level : varchar"]),
        "WEEKLY_PLAN": (1100, 310, 330, ["PK id : bigint", "FK user_id : bigint", "week_start : date", "status : varchar"]),
        "WEEKLY_PLAN_ITEM": (1100, 560, 330, ["PK id : bigint", "FK plan_id : bigint", "FK method_id : bigint", "avg_score : decimal", "decision : varchar"]),
        "METHOD_LOG": (1100, 810, 330, ["PK id : bigint", "FK item_id : bigint", "log_date : date", "score : tinyint"]),
    }
    for name, (x, y, w, lines) in tables.items():
        h = 42 + len(lines) * 25 + 10
        cv.rect(x, y, w, h, "#F8FAFD", "#8796A8", 1.4)
        cv.rect(x, y, w, 34, "#E8F1FB", "#8796A8", 1.4)
        cv.text(x + w / 2, y + 17, name, 17, INK, True)
        yy = y + 46
        for s in lines:
            cv.text(x + 10, yy, s, 14, "#2C3E50", anchor="lm")
            yy += 25

    def rel(a, b, label="1:n", color=LINE):
        ax, ay, aw, _ = tables[a]
        bx, by, bw, _ = tables[b]
        if abs(ay - by) < 20:
            x1, x2 = ax + aw, bx
            y = ay + 60
            cv.arrow(x1, y, x2, y, color, 1.2)
            cv.label((x1 + x2) / 2, y - 12, label, 12, "#5D6D7E")
        else:
            x = ax + aw / 2
            y1, y2 = ay + 42 + len(tables[a][3]) * 25 + 10, by
            cv.arrow(x, y1, x, y2, color, 1.2)
            cv.label(x + 18, (y1 + y2) / 2, label, 12, "#5D6D7E")

    for a, b in [("SYS_USER", "DECK"), ("DECK", "NOTE"), ("NOTE", "CARD"), ("CARD", "REVIEW_LOG")]:
        rel(a, b)
    cv.path_arrow([(410, 100), (520, 100), (520, 350), (610, 350)], LINE, 1.2, 8)
    cv.label(510, 240, "1:n", 12, "#5D6D7E")
    # learning chain
    cv.arrow(1265, 160, 1265, 310, LINE, 1.2)
    cv.label(1283, 240, "1:n", 12, "#5D6D7E")
    cv.arrow(1265, 460, 1265, 560, LINE, 1.2)
    cv.label(1283, 515, "1:n", 12, "#5D6D7E")
    cv.arrow(1265, 700, 1265, 810, LINE, 1.2)
    cv.label(1283, 760, "1:n", 12, "#5D6D7E")
    # weekly -> item, learning -> item, user -> weekly (orthogonal)
    cv.path_arrow([(1430, 460), (1510, 460), (1510, 610), (1430, 610)], LINE, 1.2, 8)
    cv.path_arrow([(1430, 160), (1540, 160), (1540, 610), (1430, 610)], LINE, 1.2, 8)
    # user owns weekly plan (route above the FSRS box)
    cv.path_arrow([(410, 100), (500, 100), (500, 250), (1050, 250), (1050, 339), (1100, 339)], LINE, 1.2, 8)
    cv.label(770, 238, "1:n", 12, "#5D6D7E")
    cv.save(os.path.join(FIG, "er.svg"))


def sequence():
    parts = [
        {"name": "学习者", "kind": "actor"},
        {"name": "P5 前端", "kind": "object", "color": BLUE},
        {"name": "Flask 文档服务", "kind": "object", "color": ORANGE},
        {"name": "LLM 服务", "kind": "object", "color": RED},
        {"name": "Spring Boot", "kind": "object", "color": GREEN},
        {"name": "H2 / MySQL", "kind": "object", "color": PURPLE},
    ]
    msgs = [
        {"kind": "sync", "f": 0, "t": 1, "text": "1  上传 PDF/Word/PPT"},
        {"kind": "sync", "f": 1, "t": 2, "text": "2  POST /api/documents/upload"},
        {"kind": "self", "f": 2, "text": "3  保存 uploads，写 document"},
        {"kind": "ret", "f": 2, "t": 1, "text": "4  返回 doc_id"},
        {"kind": "sync", "f": 0, "t": 1, "text": "5  EXTRACT 提取"},
        {"kind": "sync", "f": 1, "t": 2, "text": "6  POST /process"},
        {"kind": "self", "f": 2, "text": "7  PyMuPDF/docx/pptx 提取"},
        {"kind": "ret", "f": 2, "t": 1, "text": "8  返回块数/章节"},
        {"kind": "sync", "f": 0, "t": 1, "text": "9  SIMPLIFY 简化"},
        {"kind": "sync", "f": 1, "t": 2, "text": "10  POST /simplify"},
        {"kind": "sync", "f": 2, "t": 3, "text": "11  chat/completions"},
        {"kind": "ret", "f": 3, "t": 2, "text": "12  简化文本"},
        {"kind": "ret", "f": 2, "t": 1, "text": "13  返回进度与教程"},
        {"kind": "sync", "f": 0, "t": 1, "text": "14  MAKE CARDS 生成卡片"},
        {"kind": "self", "f": 2, "text": "15  导出结构化 DOCX"},
        {"kind": "sync", "f": 2, "t": 4, "text": "16  POST /api/v1/import/docx"},
        {"kind": "self", "f": 4, "text": "17  写 note/card"},
        {"kind": "ret", "f": 4, "t": 2, "text": "18  导入结果"},
        {"kind": "ret", "f": 2, "t": 1, "text": "19  返回卡片数量"},
        {"kind": "ret", "f": 1, "t": 0, "text": "20  进入 REVIEW 队列"},
    ]
    render_seq(parts, msgs, os.path.join(FIG, "sequence.svg"), width=1800, step=60, self_step=82, font=18)


def main():
    usecase()
    svg_arch_layered.main()
    relationship()
    sequence()
    svg_class_layered.main()
    for name in ("usecase", "architecture", "relationship", "sequence", "class"):
        print(os.path.join(FIG, name + ".svg"))


if __name__ == "__main__":
    main()
