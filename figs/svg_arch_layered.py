# -*- coding: utf-8 -*-
"""Memory Lab 平台架构图（分层容器版，参考 RabbitMQ 架构图风格）。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, RED, GREY, INK, LINE

FIG = os.path.join(os.path.dirname(__file__), "..", "docs", "figures")
os.makedirs(FIG, exist_ok=True)


def card(cv, x, y, w, h, title, sub=None, color=BLUE, fs=20):
    fill, edge, ink = color
    cv.rrect(x, y, w, h, 8, "white", edge, 1.5)
    if sub:
        cv.text(x + w / 2, y + h / 2 - 12, title, fs, ink, True)
        cv.text(x + w / 2, y + h / 2 + 16, sub, 14, "#5D6D7E")
    else:
        cv.text(x + w / 2, y + h / 2, title, fs, ink, True)


def arrow(cv, pts, color=LINE, sw=1.5, dash=None):
    cv.polyline(pts, color, sw, dash=dash)
    import math
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    p1 = (x2 - ux * 9 + px * 4.5, y2 - uy * 9 + py * 4.5)
    p2 = (x2 - ux * 9 - px * 4.5, y2 - uy * 9 - py * 4.5)
    cv.polygon([(x2, y2), p1, p2], color, color, 1.0)


def band(cv, x, y, w, h, label, fill, edge):
    cv.rrect(x, y, w, h, 10, fill, edge, 1.3)
    cv.text(x + 18, y + 22, label, 18, edge, True, anchor="lm")


def main():
    cv = Svg(1800, 960)

    # main layer bands
    band(cv, 180, 35, 1260, 150, "客户端  Windows 10 / 11 x64", "#F4F8FD", "#6F9BC3")
    band(cv, 180, 215, 1260, 345, "本地服务  127.0.0.1", "#F4FAF7", "#5E9A7C")
    band(cv, 180, 590, 1260, 270, "本地数据  data/", "#F8F5FC", "#8B78A8")

    # left role labels
    for y, h, text, color in [
        (35, 150, "客户端", "#2E5E8C"),
        (215, 345, "本地服务", "#3F7A5E"),
        (590, 270, "本地数据", "#6A5691"),
    ]:
        cv.rect(20, y, 140, h, "white", color, 1.3)
        cv.text(90, y + h / 2, text, 22, color, True)

    # client
    card(cv, 230, 85, 380, 70, "Edge 应用窗口", "P5 / P3 单页应用", BLUE, 20)
    card(cv, 850, 85, 470, 70, "MemoryLab.exe  C# 启动器", "启动 / 停止 / 健康检查", GREY, 20)

    # local service
    card(cv, 600, 245, 420, 66, "Nginx :18080", "P5/P3 静态页 + 反向代理", ORANGE, 20)
    card(cv, 215, 385, 330, 92, "Spring Boot :18081", "卡片 / 复习 / 统计 / 方法", GREEN, 19)
    card(cv, 590, 385, 330, 92, "Flask :15000", "文档 / 导师 / OCR", ORANGE, 19)
    card(cv, 965, 385, 330, 92, "DeepTutor :3782/:8001", "可选全科工作台", GREY, 18)

    # external LLM
    cv.rrect(1480, 300, 280, 92, 8, "#FBEBE8", "#A8564A", 1.5)
    cv.text(1620, 330, "LLM API", 20, "#5E2419", True)
    cv.text(1620, 360, "OpenAI 兼容，可选", 14, "#8A5A50")

    # data
    card(cv, 220, 665, 280, 86, "H2 文件库", "data/db  memory.mv.db", PURPLE, 18)
    card(cv, 535, 665, 280, 86, "SQLite tutor.db", "文档块 / 聊天", PURPLE, 18)
    card(cv, 850, 665, 280, 86, "uploads / tutorials", "教材 / 教程 / 图片", PURPLE, 18)
    card(cv, 1165, 665, 280, 86, "data/deeptutor", "独立工作区", PURPLE, 18)

    # arrows
    arrow(cv, [(420, 120), (420, 200), (810, 200), (810, 245)], LINE, 1.6)
    cv.label(615, 188, "打开页面 / HTTP", 14, "#5D6D7E")

    # launcher dashed to local band
    cv.line(1085, 155, 1085, 205, "#7F8C8D", 1.5, dash="9 7")
    cv.label(1085, 180, "启动 / 停止", 13, "#7F8C8D")

    # nginx to services
    for x in (380, 755, 1130):
        arrow(cv, [(810, 311), (810, 345), (x, 345), (x, 385)], LINE, 1.4)
    cv.label(810, 332, "反向代理", 13, "#5D6D7E")

    # flask to llm
    arrow(cv, [(920, 440), (960, 440), (960, 330), (1480, 330)], "#A8564A", 1.4, dash="9 7")
    cv.label(1240, 318, "HTTPS", 14, "#A8564A")

    # services to stores
    arrow(cv, [(380, 477), (380, 610), (360, 610), (360, 665)], LINE, 1.4)
    arrow(cv, [(755, 477), (755, 610), (675, 610), (675, 665)], LINE, 1.4)
    arrow(cv, [(755, 477), (755, 610), (990, 610), (990, 665)], LINE, 1.4)
    arrow(cv, [(1130, 477), (1130, 610), (1305, 610), (1305, 665)], LINE, 1.4)

    # legend
    lx, ly = 1480, 500
    cv.rrect(lx, ly, 280, 220, 8, "#FBFCFF", "#B7C3CF", 1.2)
    cv.text(lx + 18, ly + 24, "图例", 18, "#34495E", True, anchor="lm")
    cv.line(lx + 18, ly + 52, lx + 78, ly + 52, LINE, 1.5)
    cv.text(lx + 88, ly + 52, "本地 HTTP / 调用", 14, "#5D6D7E", anchor="lm")
    cv.line(lx + 18, ly + 90, lx + 78, ly + 90, "#A8564A", 1.5, dash="9 7")
    cv.text(lx + 88, ly + 90, "HTTPS / 可选", 14, "#5D6D7E", anchor="lm")
    cv.line(lx + 18, ly + 128, lx + 78, ly + 128, "#7F8C8D", 1.5, dash="9 7")
    cv.text(lx + 88, ly + 128, "启动 / 停止", 14, "#5D6D7E", anchor="lm")
    cv.text(lx + 18, ly + 170, "所有本地服务只监听 127.0.0.1", 13, "#5D6D7E", anchor="lm")
    cv.text(lx + 18, ly + 192, "大文件不进数据库，只存路径", 13, "#5D6D7E", anchor="lm")

    cv.save(os.path.join(FIG, "architecture.svg"))
    print(os.path.join(FIG, "architecture.svg"))


if __name__ == "__main__":
    main()
