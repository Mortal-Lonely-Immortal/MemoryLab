# -*- coding: utf-8 -*-
"""Memory Lab 核心类图（含独立 Mapper 层）。

四层：Controller → Service → Mapper → Entity。
五个代表性 Mapper：CardMapper / DeckMapper / NoteMapper /
ReviewLogMapper / FsrsParamMapper，均继承 MyBatis-Plus BaseMapper<T>。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, GREY, INK, LINE

FONT = 17
TITLE = 21
ROW = 24


def box(cv, x, y, w, name, attrs, methods, color=BLUE):
    fill, edge, ink = color
    head = 42
    h = head + 8 + len(attrs) * ROW + (8 if attrs else 0) + 8 + len(methods) * ROW + 8
    cv.rect(x, y, w, h, fill, edge, 1.5)
    cv.line(x, y + head, x + w, y + head, edge, 1.1)
    cv.text(x + w / 2, y + head / 2, name, TITLE, ink, True)
    yy = y + head + 7
    for a in attrs:
        cv.text(x + 10, yy, a, FONT, "#2C3E50", anchor="lm")
        yy += ROW
    if attrs:
        yy += 8
    cv.line(x, yy - 4, x + w, yy - 4, edge, 0.9)
    for m in methods:
        cv.text(x + 10, yy + 5, m, FONT, "#2C3E50", anchor="lm")
        yy += ROW
    return (x, y, w, h)


def arrow(cv, pts, color=LINE, sw=1.3, dash=None):
    cv.polyline(pts, color, sw, dash=dash)
    import math
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    p1 = (x2 - ux * 8 + px * 4, y2 - uy * 8 + py * 4)
    p2 = (x2 - ux * 8 - px * 4, y2 - uy * 8 - py * 4)
    cv.polygon([(x2, y2), p1, p2], color, color, 1.0)


def container(cv, x, y, w, h, label, fill, edge):
    cv.rrect(x, y, w, h, 10, fill, edge, 1.2)
    cv.text(x + 18, y - 8, label, 18, edge, True, anchor="lm")


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "docs", "figures", "class.svg")
    cv = Svg(2200, 1650)

    container(cv, 40, 30, 2120, 240, "表现层（Controller）", "#F7FAFD", "#6F9BC3")
    container(cv, 40, 315, 2120, 225, "业务层（Service）", "#F5FAF7", "#5E9A7C")
    container(cv, 40, 650, 2120, 390, "数据访问层（Mapper）  ·  «interface» 均 extends BaseMapper<T>", "#F8F5FC", "#8B78A8")
    container(cv, 40, 1050, 2120, 550, "实体层（Entity）", "#FFF9EE", "#C49A53")

    c1 = box(cv, 80, 55, 420, "CardController",
             ["- cardService : CardService"],
             ["+ list(page,size) : Result", "+ create(card) : Result",
              "+ update(id,card) : Result", "+ delete(id) : Result"])
    c2 = box(cv, 600, 55, 420, "ReviewController",
             ["- reviewService : ReviewService"],
             ["+ queue(limit) : Result", "+ submit(cardId,rating) : Result"])
    c3 = box(cv, 1120, 55, 420, "ImportController",
             ["- importService : ImportService"],
             ["+ importDocx(file) : Result"])

    s1 = box(cv, 80, 345, 420, "CardService",
             ["- cardMapper : CardMapper", "- deckMapper : DeckMapper"],
             ["+ page(userId,query) : PageResult", "+ save(card) : void",
              "+ remove(id) : void"])
    s2 = box(cv, 600, 345, 420, "ReviewService",
             ["- fsrsService : FsrsService", "- reviewLogMapper : ReviewLogMapper"],
             ["+ nextQueue(userId) : List", "+ review(card,rating) : ReviewLog"])
    s3 = box(cv, 1120, 345, 420, "ImportService",
             ["- noteMapper : NoteMapper", "- cardMapper : CardMapper"],
             ["+ importDocx(stream,file) : ImportJob"])
    s4 = box(cv, 1640, 345, 420, "FsrsService",
             ["- paramMapper : FsrsParamMapper"],
             ["+ schedule(card,rating) : Card", "+ retrievability(card,days) : double"])

    m1 = box(cv, 80, 690, 420, "«interface» CardMapper",
             [],
             ["+ selectById(id) : Card", "+ insert(card) : int",
              "+ updateById(card) : int", "+ deleteById(id) : int"], GREEN)
    m2 = box(cv, 600, 690, 420, "«interface» ReviewLogMapper",
             [],
             ["+ selectById(id) : ReviewLog", "+ insert(log) : int",
              "+ selectList(...) : List", "+ deleteById(id) : int"], GREEN)
    m3 = box(cv, 1120, 690, 420, "«interface» NoteMapper",
             [],
             ["+ selectById(id) : Note", "+ insert(note) : int",
              "+ selectList(...) : List", "+ deleteById(id) : int"], GREEN)
    m4 = box(cv, 1640, 690, 420, "«interface» FsrsParamMapper",
             [],
             ["+ selectById(id) : FsrsParam", "+ insert(p) : int",
              "+ updateById(p) : int"], GREEN)
    m5 = box(cv, 80, 890, 420, "«interface» DeckMapper",
             [],
             ["+ selectIncludingDeleted(...) : Deck", "+ restore(id) : int",
              "+ selectById(id) : Deck"], GREEN)

    e5 = box(cv, 80, 1420, 420, "Deck",
             ["- id : Long", "- parentId : Long", "- name : String",
              "- cardCount : int"], [], ORANGE)
    e1 = box(cv, 80, 1120, 420, "Card",
             ["- id : Long", "- deckId : Long", "- front : String", "- back : String",
              "- state : int", "- stability : double", "- difficulty : double",
              "- dueDate : Date"], [], ORANGE)
    e2 = box(cv, 600, 1120, 420, "ReviewLog",
             ["- id : Long", "- cardId : Long", "- rating : int",
              "- stateBefore : int", "- stateAfter : int", "- reviewedAt : Date"], [], ORANGE)
    e3 = box(cv, 1120, 1120, 420, "Note",
             ["- id : Long", "- deckId : Long", "- title : String",
              "- contentMd : String"], [], ORANGE)
    e4 = box(cv, 1640, 1120, 420, "FsrsParam",
             ["- id : Long", "- userId : Long", "- version : String",
              "- weights : String"], [], ORANGE)
    # controllers -> services
    arrow(cv, [(290, 249), (290, 345)], dash="8 6")
    arrow(cv, [(810, 201), (810, 345)], dash="8 6")
    arrow(cv, [(1330, 177), (1330, 345)], dash="8 6")
    for x in (290, 810, 1330):
        cv.label(x + 18, 280, "uses", 13, "#5D6D7E")

    # services -> mappers
    arrow(cv, [(290, 539), (290, 690)], dash="8 6")
    arrow(cv, [(810, 511), (810, 690)], dash="8 6")
    arrow(cv, [(1330, 491), (1330, 690)], dash="8 6")
    arrow(cv, [(1850, 491), (1850, 690)], dash="8 6")
    for x, y in ((308, 610), (828, 590), (1348, 580), (1868, 580)):
        cv.label(x, y, "uses", 13, "#5D6D7E")

    # CardService also uses DeckMapper, route right gutter
    arrow(cv, [(500, 460), (540, 460), (540, 930), (500, 930)])
    cv.label(552, 700, "uses", 13, "#5D6D7E")

    # ReviewService -> FsrsService, route above the controller row
    arrow(cv, [(810, 345), (810, 320), (1060, 320), (1060, 20), (2100, 20), (2100, 430), (2060, 430)])
    cv.label(1500, 38, "schedules", 13, "#5D6D7E")

    # mappers -> entities
    arrow(cv, [(500, 780), (560, 780), (560, 1050), (400, 1050), (400, 1120)])
    arrow(cv, [(500, 1000), (580, 1000), (580, 1350), (400, 1350), (400, 1420)])
    arrow(cv, [(810, 854), (810, 1120)])
    arrow(cv, [(1330, 854), (1330, 1120)])
    arrow(cv, [(1850, 828), (1850, 1120)])
    for x, y in ((575, 900), (595, 1180), (828, 960), (1348, 960), (1868, 950)):
        cv.label(x, y, "maps", 13, "#5D6D7E")

    cv.save(out)
    print(out)


if __name__ == "__main__":
    main()
