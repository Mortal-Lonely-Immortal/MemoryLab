# -*- coding: utf-8 -*-
"""svgkit - 轻量 SVG 画布。

四个绘图原语：rect / line / polygon / text；箭头、折线、椭圆和白底标签
都由这四个原语组合而来。字体使用微软雅黑，输出白底矢量图。
"""
from xml.sax.saxutils import escape

FONT = "'Microsoft YaHei', 'PingFang SC', sans-serif"
_ANCHOR = {"l": "start", "m": "middle", "r": "end"}


class Svg:
    def __init__(self, w, h, bg="white"):
        self.w, self.h = w, h
        self.bg = bg
        self.parts = []

    def rect(self, x, y, w, h, fill="none", stroke=None, sw=1.0, dash=None):
        s = f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" fill="{fill}"'
        if stroke:
            s += f' stroke="{stroke}" stroke-width="{sw}"'
        if dash:
            s += f' stroke-dasharray="{dash}"'
        self.parts.append(s + "/>")

    def rrect(self, x, y, w, h, r, fill="none", stroke=None, sw=1.0):
        s = (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
             f'rx="{r}" ry="{r}" fill="{fill}"')
        if stroke:
            s += f' stroke="{stroke}" stroke-width="{sw}"'
        self.parts.append(s + "/>")

    def line(self, x1, y1, x2, y2, stroke="#1A1A1A", sw=1.0, dash=None):
        s = (f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
             f'stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round"')
        if dash:
            s += f' stroke-dasharray="{dash}"'
        self.parts.append(s + "/>")

    def polygon(self, pts, fill="none", stroke=None, sw=1.0):
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        s = f'<polygon points="{p}" fill="{fill}"'
        if stroke:
            s += f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"'
        self.parts.append(s + "/>")

    def polyline(self, pts, stroke="#1A1A1A", sw=1.0, fill="none", dash=None):
        p = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        s = (f'<polyline points="{p}" fill="{fill}" stroke="{stroke}" '
             f'stroke-width="{sw}" stroke-linejoin="round"')
        if dash:
            s += f' stroke-dasharray="{dash}"'
        self.parts.append(s + "/>")

    def ellipse(self, cx, cy, rx, ry, fill="none", stroke=None, sw=1.0):
        s = f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}"'
        if stroke:
            s += f' stroke="{stroke}" stroke-width="{sw}"'
        self.parts.append(s + "/>")

    def text(self, x, y, s, size=10.0, color="#111111", bold=False, anchor="mm"):
        a = _ANCHOR.get(anchor[0] if anchor else "m", "middle")
        base = "central" if (len(anchor) < 2 or anchor[1] in "mac") else "alphabetic"
        weight = ' font-weight="bold"' if bold else ""
        self.parts.append(
            f'<text x="{x:.2f}" y="{y:.2f}" font-family="{FONT}" font-size="{size}" '
            f'fill="{color}" text-anchor="{a}" dominant-baseline="{base}"{weight}>'
            f'{escape(str(s))}</text>')

    def arrow(self, x1, y1, x2, y2, color="#1A1A1A", sw=1.0, head=8, dash=None):
        self.line(x1, y1, x2, y2, color, sw, dash)
        self._head(x2, y2, x1, y1, color, sw, head)

    def path_arrow(self, pts, color="#1A1A1A", sw=1.0, head=8):
        self.polyline(pts, color, sw)
        self._head(pts[-1][0], pts[-1][1], pts[-2][0], pts[-2][1], color, sw, head)

    def _head(self, ax, ay, bx, by, color, sw, head=8):
        dx, dy = ax - bx, ay - by
        n = (dx * dx + dy * dy) ** 0.5 or 1
        ux, uy = dx / n, dy / n
        px, py = -uy, ux
        p1 = (ax - ux * head + px * head * 0.5, ay - uy * head + py * head * 0.5)
        p2 = (ax - ux * head - px * head * 0.5, ay - uy * head - py * head * 0.5)
        self.polygon([(ax, ay), p1, p2], color, color, sw)

    def label(self, x, y, text, size=10.0, color="#111111", pad=4):
        """白底文字，压在线/生命线上也不糊。"""
        w = len(str(text)) * size * 0.62 + pad * 2
        h = size * 1.45
        self.rect(x - w / 2, y - h / 2, w, h, "white", None, 0)
        self.text(x, y, text, size, color)

    def save(self, path):
        body = "\n".join(self.parts)
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}">\n'
            f'<rect width="100%" height="100%" fill="{self.bg}"/>\n{body}\n</svg>\n'
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        return path


# 统一配色：白底 + 浅色填充，边框同色系加深
BLUE = ("#E8F1FB", "#2E5E8C", "#123B5E")
GREEN = ("#EDF3F0", "#3F7A5E", "#1E4A2E")
PURPLE = ("#F3EEF9", "#6A5691", "#392A57")
ORANGE = ("#FDF1DC", "#A9762A", "#6B4410")
RED = ("#FBEBE8", "#A8564A", "#5E2419")
GREY = ("#F5F7FA", "#8796A8", "#34495E")
INK = "#1B2B3A"
LINE = "#33475B"
