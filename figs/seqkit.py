# -*- coding: utf-8 -*-
"""seqkit - 数据驱动的 UML 时序图排版引擎。

只填 participants 和 messages，横坐标等分、纵坐标按消息累加、
控制焦点按每个参与者的首末消息自动计算。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, RED, GREY, INK, LINE

C_LIFE = "#B7C3CF"
C_MSG = "#33475B"
C_BAR = "#F4D7B8"
C_BAR_EDGE = "#A9762A"
C_FRAME = "#8B6A3E"


def _actor(cv, x, y, name):
    cv.ellipse(x, y, 10, 10, "white", INK, 1.5)
    cv.line(x, y + 10, x, y + 46, INK, 1.5)
    cv.line(x - 20, y + 24, x + 20, y + 24, INK, 1.5)
    cv.line(x, y + 46, x - 16, y + 70, INK, 1.5)
    cv.line(x, y + 46, x + 16, y + 70, INK, 1.5)
    cv.text(x, y + 86, name, 18, INK, True)


def render(parts, msgs, out, width=1800, step=60, self_step=82,
           frames=None, font=18, margin=56):
    n = len(parts)
    left, right = 130, width - 130
    xs = [left + (right - left) * i / (n - 1) for i in range(n)] if n > 1 else [width / 2]
    head_y = 110

    y0 = 225
    ys = []
    y = y0
    for m in msgs:
        ys.append(y)
        y += self_step if m["kind"] == "self" else step
    bottom = y + 10
    cv = Svg(width, bottom + 50)

    # frame behind messages
    if frames:
        for fr in frames:
            fy1 = ys[fr["from"]] - 34
            fy2 = ys[fr["to"]] + 24
            cv.rect(36, fy1, width - 72, fy2 - fy1, "none", C_FRAME, 1.5)
            cv.rect(36, fy1, 58, 26, "#FDF1DC", C_FRAME, 1.5)
            cv.text(65, fy1 + 13, fr.get("tag", "alt"), 15, "#6B4410", True)
            if fr.get("cond"):
                cv.text(104, fy1 + 13, fr["cond"], 15, "#5D6D7E", anchor="lm")
            for sec in fr.get("sections", []):
                sy = ys[sec["at"]] - 22
                cv.line(40, sy, width - 40, sy, C_LIFE, 1.2, dash="9 7")
                cv.label(150, sy - 12, sec["label"], 14, "#8B3A2E")

    # lifelines + headers
    span = {}
    for i, p in enumerate(parts):
        x = xs[i]
        top = 145
        if p.get("kind") == "actor":
            _actor(cv, x, 62, p["name"])
            top = 150
        else:
            fill, edge, ink = p.get("color", BLUE)
            cv.rect(x - 92, 58, 184, 58, fill, edge, 1.5)
            cv.text(x, 87, p["name"], 18, ink, True)
        cv.line(x, top, x, bottom, C_LIFE, 1.2, dash="10 8")
        span[i] = [None, None]

    # activation bars and message collection
    for idx, m in enumerate(msgs):
        for pidx in (m["f"], m.get("t")):
            if pidx is None:
                continue
            if span[pidx][0] is None:
                span[pidx][0] = ys[idx]
            span[pidx][1] = ys[idx]
    for i, (a, b) in span.items():
        if a is not None:
            cv.rect(xs[i] - 7, a - 12, 14, b - a + 26, C_BAR, C_BAR_EDGE, 1.0)

    # messages
    for idx, m in enumerate(msgs):
        y = ys[idx]
        k = m["kind"]
        f, t = m["f"], m.get("t")
        if k == "self":
            x = xs[f]
            cv.path_arrow([(x + 7, y), (x + 62, y), (x + 62, y + 34), (x + 10, y + 34)],
                          C_MSG, 1.5, 8)
            cv.label(x + 72, y + 17, m["text"], font, INK)
            continue
        x1, x2 = xs[f], xs[t]
        if k == "ret":
            cv.arrow(x1, y, x2, y, C_MSG, 1.4, 8, dash="9 7")
        else:
            cv.arrow(x1, y, x2, y, C_MSG, 1.5, 8)
        if x2 > x1:
            tx = (x1 + x2) / 2
        else:
            tx = (x1 + x2) / 2
        cv.label(tx, y - 16, m["text"], font, INK)

    cv.save(out)
    return out
