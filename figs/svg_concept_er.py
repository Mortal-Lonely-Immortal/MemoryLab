# -*- coding: utf-8 -*-
"""Memory Lab 概念模型图（完整 Chen 记号）。

矩形 = 实体，椭圆 = 属性，菱形 = 联系，下划线 = 主键。
只表达概念，不展开物理表；物理表结构见 db-business/db-method/db-docs。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, GREY, INK, LINE

FIG = os.path.join(os.path.dirname(__file__), "..", "docs", "figures")
TITLE = 32
ENTITY = 23
ATTR = 16


def entity(cv, cx, cy, name, color=BLUE):
    w, h = 300, 112
    fill, edge, ink = color
    cv.rect(cx - w / 2, cy - h / 2, w, h, fill, edge, 1.8)
    cv.text(cx, cy, name, ENTITY, ink, True)
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def attr(cv, cx, cy, text, target, pk=False):
    w = max(150, len(text) * ATTR * 0.62 + 28)
    h = 40
    cv.ellipse(cx, cy, w / 2, h / 2, "white", "#6B7C8F", 1.2)
    cv.text(cx, cy, text, ATTR, "#2C3E50")
    if pk:
        tw = len(text) * ATTR * 0.55
        cv.line(cx - tw / 2, cy + 13, cx + tw / 2, cy + 13, "#2C3E50", 1.6)
    # connect to nearest point on entity box
    tx, ty = target
    cv.line(cx, cy + h / 2 if cy < ty else cy - h / 2, tx, ty, "#8A9AAC", 1.0)


def diamond(cv, cx, cy, text, w=150, h=82):
    cv.polygon([(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)],
               "#FDF1DC", "#A9762A", 1.5)
    cv.text(cx, cy, text, 19, "#6B4410", True)


def main():
    cv = Svg(2600, 1580)
    cv.text(1300, 48, "Memory Lab 概念模型图（Chen 记号）", TITLE, "#0F2A44", True)

    # top entities
    user = entity(cv, 300, 380, "用户")
    deck = entity(cv, 900, 380, "卡组")
    note = entity(cv, 1500, 380, "知识点")
    card = entity(cv, 2100, 380, "卡片")

    # bottom entities
    method = entity(cv, 300, 1030, "学习方法")
    item = entity(cv, 900, 1030, "计划条目")
    review = entity(cv, 1500, 1030, "复习记录")
    tag = entity(cv, 2100, 1030, "标签")

    # top attributes
    attr(cv, 180, 260, "用户编号", (300, 324), True)
    attr(cv, 390, 260, "用户名", (330, 324))
    attr(cv, 100, 380, "目标保持率", (150, 380))
    attr(cv, 110, 540, "每日上限", (150, 420))

    attr(cv, 780, 260, "卡组编号", (900, 324), True)
    attr(cv, 1020, 260, "名称", (940, 324))
    attr(cv, 900, 510, "卡片数", (900, 436))

    attr(cv, 1380, 260, "知识点编号", (1500, 324), True)
    attr(cv, 1620, 260, "标题", (1540, 324))
    attr(cv, 1500, 510, "来源", (1500, 436))

    attr(cv, 1960, 260, "卡片编号", (2100, 324), True)
    attr(cv, 2230, 260, "正面", (2160, 324))
    attr(cv, 2300, 380, "背面", (2250, 380))
    attr(cv, 2100, 510, "状态 / 到期", (2100, 436))

    # bottom attributes
    attr(cv, 160, 1160, "方法编号", (300, 1086), True)
    attr(cv, 380, 1160, "名称", (340, 1086))
    attr(cv, 300, 1250, "证据等级", (300, 1086))

    attr(cv, 760, 1160, "条目编号", (900, 1086), True)
    attr(cv, 1020, 1160, "目标天数", (940, 1086))
    attr(cv, 900, 1250, "周均分", (900, 1086))

    attr(cv, 1360, 1160, "记录编号", (1500, 1086), True)
    attr(cv, 1620, 1160, "评分", (1540, 1086))
    attr(cv, 1500, 1250, "复习时间", (1500, 1086))

    attr(cv, 1960, 1160, "标签编号", (2100, 1086), True)
    attr(cv, 2230, 1160, "名称", (2160, 1086))
    attr(cv, 2100, 1250, "颜色", (2100, 1086))

    # relationships
    diamond(cv, 600, 380, "拥有")
    cv.line(450, 380, 525, 380, LINE, 1.4)
    cv.line(675, 380, 750, 380, LINE, 1.4)
    cv.text(470, 360, "1", 17, INK); cv.text(720, 360, "N", 17, INK)

    diamond(cv, 1200, 380, "包含")
    cv.line(1050, 380, 1125, 380, LINE, 1.4)
    cv.line(1275, 380, 1350, 380, LINE, 1.4)
    cv.text(1070, 360, "1", 17, INK); cv.text(1320, 360, "N", 17, INK)

    diamond(cv, 1800, 380, "生成")
    cv.line(1650, 380, 1725, 380, LINE, 1.4)
    cv.line(1875, 380, 1950, 380, LINE, 1.4)
    cv.text(1670, 360, "1", 17, INK); cv.text(1920, 360, "N", 17, INK)

    diamond(cv, 300, 705, "选择")
    cv.line(300, 436, 300, 664, LINE, 1.4)
    cv.line(300, 746, 300, 974, LINE, 1.4)
    cv.text(320, 620, "1", 17, INK); cv.text(320, 900, "N", 17, INK)

    diamond(cv, 600, 1030, "列入")
    cv.line(450, 1030, 525, 1030, LINE, 1.4)
    cv.line(675, 1030, 750, 1030, LINE, 1.4)
    cv.text(470, 1010, "1", 17, INK); cv.text(720, 1010, "N", 17, INK)

    diamond(cv, 1800, 705, "复习")
    cv.line(1950, 436, 1875, 705, LINE, 1.4)
    cv.line(1725, 705, 1500, 974, LINE, 1.4)
    cv.text(1880, 580, "1", 17, INK); cv.text(1540, 900, "N", 17, INK)

    diamond(cv, 2400, 705, "标记")
    cv.line(2250, 436, 2325, 705, LINE, 1.4)
    cv.line(2475, 705, 2250, 974, LINE, 1.4)
    cv.text(2280, 570, "M", 17, INK); cv.text(2300, 900, "N", 17, INK)

    # legend
    lx, ly = 80, 1360
    cv.rrect(lx, ly, 900, 170, 8, "#FBFCFF", "#B7C3CF", 1.2)
    cv.text(lx + 20, ly + 24, "图例", 18, "#34495E", True, anchor="lm")
    cv.rect(lx + 20, ly + 48, 70, 34, BLUE[0], BLUE[1], 1.3)
    cv.text(lx + 104, ly + 65, "实体", 15, "#2C3E50", anchor="lm")
    cv.ellipse(lx + 250, ly + 65, 38, 18, "white", "#6B7C8F", 1.2)
    cv.text(lx + 300, ly + 65, "属性", 15, "#2C3E50", anchor="lm")
    cv.polygon([(lx + 410, ly + 46), (lx + 455, ly + 65), (lx + 410, ly + 84), (lx + 365, ly + 65)],
               "#FDF1DC", "#A9762A", 1.3)
    cv.text(lx + 470, ly + 65, "联系", 15, "#2C3E50", anchor="lm")
    cv.text(lx + 20, ly + 110, "下划线 = 主键    1 / N / M = 基数", 15, "#5D6D7E", anchor="lm")
    cv.text(lx + 20, ly + 140, "矩形=实体  椭圆=属性  菱形=联系", 15, "#5D6D7E", anchor="lm")

    # notes
    nx = 1040
    cv.rrect(nx, ly, 1480, 170, 8, "#FFFDF8", "#D8C7A8", 1.2)
    cv.text(nx + 20, ly + 24, "说明", 18, "#6B4410", True, anchor="lm")
    cv.text(nx + 20, ly + 56, "① 本图是概念模型，不展开物理字段；物理表见数据库表结构图。", 15, "#5D6D7E", anchor="lm")
    cv.text(nx + 20, ly + 84, "② 卡片可属于卡组；知识点是卡片的内容来源，一个知识点可生成多张卡。", 15, "#5D6D7E", anchor="lm")
    cv.text(nx + 20, ly + 112, "③ 标签与卡片是多对多；复习记录只追加，不修改历史。", 15, "#5D6D7E", anchor="lm")
    cv.text(nx + 20, ly + 140, "④ 学习方法与计划条目属于方法实验，独立于 FSRS 复习。", 15, "#5D6D7E", anchor="lm")

    cv.save(os.path.join(FIG, "concept-er.svg"))
    print(os.path.join(FIG, "concept-er.svg"))


if __name__ == "__main__":
    main()
