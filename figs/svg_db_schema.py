# -*- coding: utf-8 -*-
"""Memory Lab 数据库表结构可视化（中文注释版）。

三张图：业务库核心表、方法实验室、文档库。
字段行同时给出 英文列名、类型、中文注释；表头用「中文表名 + 物理表名」。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "docs_kit"))
from svgkit import Svg, BLUE, GREEN, PURPLE, ORANGE, RED, GREY, INK, LINE

FIG = os.path.join(os.path.dirname(__file__), "..", "docs", "figures")
os.makedirs(FIG, exist_ok=True)

FONT = 16
HEAD = 19
ROW = 25


def table(cv, x, y, w, title, fields, footer=None, color=BLUE):
    fill, edge, ink = color
    head_h = 46
    h = head_h + len(fields) * ROW + (24 if footer else 12)
    cv.rect(x, y, w, h, "white", edge, 1.5)
    cv.rect(x, y, w, head_h, fill, edge, 1.5)
    cv.text(x + w / 2, y + head_h / 2, title, HEAD, ink, True)
    yy = y + head_h + 6
    for f in fields:
        cv.text(x + 10, yy + 8, f, FONT, "#2C3E50", anchor="lm")
        yy += ROW
        cv.line(x + 8, yy - 4, x + w - 8, yy - 4, "#E3E8EF", 0.7)
    if footer:
        cv.line(x, y + h - 24, x + w, y + h - 24, edge, 0.8)
        cv.text(x + 10, y + h - 12, footer, 12, "#7F8C8D", anchor="lm")
    return (x, y, w, h)


def ortho(cv, pts, color=LINE, sw=1.4, head=8):
    cv.polyline(pts, color, sw)
    import math
    x1, y1 = pts[-2]
    x2, y2 = pts[-1]
    dx, dy = x2 - x1, y2 - y1
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    p1 = (x2 - ux * head + px * head * 0.5, y2 - uy * head + py * head * 0.5)
    p2 = (x2 - ux * head - px * head * 0.5, y2 - uy * head - py * head * 0.5)
    cv.polygon([(x2, y2), p1, p2], color, color, 1.0)


def legend(cv, y, w):
    cv.text(w / 2, y, "PK 主键    FK 外键    UK 唯一键    IDX 普通索引    1:n 一对多    n:m 多对多",
            14, "#5D6D7E")


def business():
    cv = Svg(2300, 1450)
    user = table(cv, 80, 60, 500, "用户表 sys_user", [
        "PK  id : BIGINT  主键", "UK  username : VARCHAR(50)  登录名",
        "password_hash : VARCHAR(100)  密码哈希", "timezone : VARCHAR(50)  时区",
        "day_cutoff_hour : TINYINT  日切点(4点)", "daily_new_limit : INT  每日新卡上限",
        "desired_retention : DECIMAL(4,3)  目标保持率", "deleted : TINYINT  逻辑删除",
    ], "UK(username)", BLUE)
    deck = table(cv, 80, 370, 500, "卡组表 deck", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "parent_id : BIGINT  父卡组(0=根)", "name : VARCHAR(100)  卡组名",
        "sort_order : INT  排序", "card_count : INT  卡片数(缓存)",
        "deleted : TINYINT  逻辑删除",
    ], "UK(user_id,parent_id,name)  IDX(user_id,parent_id)", GREEN)
    note = table(cv, 80, 680, 500, "知识点表 note", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "FK  deck_id : BIGINT  所属卡组", "title : VARCHAR(255)  标题",
        "content_md : MEDIUMTEXT  原文Markdown", "source / chapter  来源/章节",
        "biz_key : VARCHAR(128)  导入去重键", "deleted : TINYINT  逻辑删除",
    ], "UK(user_id,biz_key)  IDX(user_id,deck_id)", GREEN)
    card = table(cv, 80, 1000, 500, "卡片表 card", [
        "PK  id : BIGINT  主键", "FK  note_id : BIGINT  知识点(可空)",
        "FK  deck_id : BIGINT  所属卡组", "front / back : TEXT  正面/背面",
        "state : TINYINT  0新 1学 2复 3重学", "due_date : DATETIME(3)  到期时间",
        "stability : DECIMAL(10,4)  稳定度", "difficulty : DECIMAL(6,4)  难度",
        "reps / lapses : INT  复习/遗忘次数", "suspended / deleted  暂停/删除",
    ], "IDX(user_id,state,due_date)  IDX(user_id,deck_id)", ORANGE)

    review = table(cv, 900, 780, 500, "复习流水表 review_log", [
        "PK  id : BIGINT  主键", "FK  card_id : BIGINT  卡片",
        "rating : TINYINT  评分1-4", "state_before / after  前/后状态",
        "stability_before / after  前/后稳定度", "difficulty_before / after  前/后难度",
        "elapsed_days / scheduled_days  实际/计划间隔", "reviewed_at : DATETIME(3)  复习时间",
        "client_req_id : VARCHAR(64)  幂等请求号",
    ], "UK(user_id,client_req_id)  IDX(card_id,reviewed_at)", ORANGE)
    tag = table(cv, 900, 60, 500, "标签表 tag", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "name : VARCHAR(50)  标签名", "color : VARCHAR(16)  颜色",
    ], "UK(user_id,name)", PURPLE)
    card_tag = table(cv, 900, 260, 500, "卡片标签关联 card_tag", [
        "PK/FK  card_id : BIGINT  卡片", "PK/FK  tag_id : BIGINT  标签",
    ], "PK(card_id,tag_id)  IDX(tag_id)", PURPLE)

    fsrs = table(cv, 900, 480, 500, "FSRS 参数表 fsrs_param", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "version : VARCHAR(16)  算法版本", "weights : JSON  17个权重",
        "desired_retention : DECIMAL(4,3)  目标保持率", "max_interval : INT  最大间隔天数",
    ], "UK(user_id,version)", BLUE)
    daily = table(cv, 1600, 60, 420, "每日统计表 daily_stat", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "stat_date : DATE  统计日期", "new_count / review_count  新卡/复习数",
        "again / hard / good / easy  四档计数", "retention : DECIMAL(5,4)  保持率",
        "study_ms / due_count  时长/到期数",
    ], "UK(user_id,stat_date)", BLUE)
    imp = table(cv, 1600, 360, 420, "导入任务表 import_job", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "filename / file_hash  文件名/哈希", "status : VARCHAR(16)  任务状态",
        "total_cards : INT  总卡数", "created_cards / skipped_cards  新建/跳过",
        "error_msg : VARCHAR(500)  错误信息",
    ], "IDX(user_id,created_at)", BLUE)
    session = table(cv, 1600, 700, 420, "学习会话表 study_session", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "started_at / ended_at  开始/结束", "cards_reviewed / again_count  复习/忘记",
        "duration_ms : BIGINT  时长(毫秒)",
    ], "IDX(user_id,started_at)", BLUE)

    # 内容主链
    ortho(cv, [(330, 332), (330, 370)], LINE)
    ortho(cv, [(330, 620), (330, 680)], LINE)
    ortho(cv, [(330, 899), (330, 1000)], LINE)
    cv.label(350, 351, "1:n", 13, "#5D6D7E")
    cv.label(350, 650, "1:n", 13, "#5D6D7E")
    cv.label(350, 950, "1:n", 13, "#5D6D7E")

    # 卡片 -> 复习 / 标签
    ortho(cv, [(580, 1120), (850, 1120), (850, 930), (900, 930)], LINE)
    cv.label(710, 1108, "1:n", 13, "#5D6D7E")
    ortho(cv, [(580, 1050), (830, 1050), (830, 300), (900, 300)], LINE)
    cv.label(845, 680, "n:m", 13, "#5D6D7E")
    ortho(cv, [(1150, 260), (1150, 236)], LINE)
    cv.label(1170, 248, "n:m", 13, "#5D6D7E")

    # 用户 -> FSRS / 统计 / 导入 / 会话
    ortho(cv, [(580, 170), (800, 170), (800, 540), (900, 540)], LINE)
    cv.label(780, 360, "1:n", 13, "#5D6D7E")
    ortho(cv, [(330, 60), (330, 30), (1520, 30), (1520, 770)], LINE)
    for yy in (100, 430, 770):
        ortho(cv, [(1520, yy), (1600, yy)], LINE)
    cv.text(1000, 18, "用户配置 / 统计 / 导入 / 会话", 13, "#5D6D7E")

    legend(cv, 1425, 2300)
    cv.save(os.path.join(FIG, "db-business.svg"))


def method():
    cv = Svg(1650, 1020)
    m = table(cv, 80, 70, 620, "学习方法表 learning_method", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "name / category  名称/分类", "description : VARCHAR(500)  描述",
        "evidence_level : VARCHAR(16)  证据等级", "builtin / active  内置/启用",
    ], "UK(user_id,name)", GREEN)
    p = table(cv, 860, 70, 620, "周计划表 weekly_plan", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "week_start / week_end  周一/周日", "status : VARCHAR(16)  状态",
        "note : VARCHAR(500)  备注",
    ], "UK(user_id,week_start)", BLUE)
    item = table(cv, 860, 500, 620, "计划条目表 weekly_plan_item", [
        "PK  id : BIGINT  主键", "FK  plan_id : BIGINT  周计划",
        "FK  method_id : BIGINT  学习方法", "custom_name : VARCHAR(100)  自定义名",
        "target_days : INT  目标天数", "avg_score : DECIMAL(4,2)  周均分",
        "decision : VARCHAR(16)  结论KEEP/DROP/TRIAL",
    ], "IDX(plan_id)  IDX(method_id)", PURPLE)
    log = table(cv, 80, 500, 620, "方法打分表 method_log", [
        "PK  id : BIGINT  主键", "FK  user_id : BIGINT  所属用户",
        "FK  item_id : BIGINT  计划条目", "log_date : DATE  打分日期",
        "score : TINYINT  评分1-5",
        "note : VARCHAR(500)  备注", "duration_min : INT  时长(分钟)",
    ], "UK(item_id,log_date)  IDX(user_id,log_date)", ORANGE)
    ortho(cv, [(700, 190), (860, 190)], LINE); cv.label(780, 175, "1:n", 13, "#5D6D7E")
    ortho(cv, [(1170, 340), (1170, 500)], LINE); cv.label(1188, 420, "1:n", 13, "#5D6D7E")
    ortho(cv, [(860, 700), (700, 700)], LINE); cv.label(780, 685, "1:n", 13, "#5D6D7E")
    legend(cv, 990, 1650)
    cv.save(os.path.join(FIG, "db-method.svg"))


def docs():
    cv = Svg(1950, 950)
    users = table(cv, 80, 80, 360, "用户表 users", [
        "PK  id : INTEGER  主键", "name : TEXT  用户名", "registered : INTEGER  已注册",
    ], None, BLUE)
    documents = table(cv, 600, 80, 460, "教材表 documents", [
        "PK  id : INTEGER  主键", "FK  user_id : INTEGER  所属用户",
        "filename / original_name  存储名/原名", "file_type : TEXT  文件类型",
        "status : TEXT  上传/处理/完成/错误", "total_chapters / processed_chapters  章节",
        "created_at : TIMESTAMP  上传时间",
    ], "FK(user_id)", ORANGE)
    blocks = table(cv, 600, 500, 460, "文档块表 document_blocks", [
        "PK  id : INTEGER  主键", "FK  document_id : INTEGER  教材",
        "block_order : INTEGER  原文顺序", "block_type : TEXT  文字/图片/标题",
        "original_text / simplified_text  原文/简化", "image_path : TEXT  图片路径",
        "page_number : INTEGER  页码",
    ], "FK(document_id) ON DELETE CASCADE", GREEN)
    chat = table(cv, 80, 400, 360, "导师对话表 chat_history", [
        "PK  id : INTEGER  主键", "FK  user_id : INTEGER  所属用户",
        "role : TEXT  user/assistant", "content : TEXT  对话内容", "created_at : TIMESTAMP  时间",
    ], "FK(user_id)", BLUE)
    settings = table(cv, 1250, 80, 380, "应用设置表 app_settings", [
        "PK  key : TEXT  设置键", "value : TEXT  设置值",
    ], "键值：API Key / Base URL / Model", GREY)
    ortho(cv, [(440, 160), (600, 160)], LINE); cv.label(520, 145, "1:n", 13, "#5D6D7E")
    ortho(cv, [(260, 230), (260, 400)], LINE); cv.label(278, 315, "1:n", 13, "#5D6D7E")
    ortho(cv, [(830, 360), (830, 500)], LINE); cv.label(848, 430, "1:n", 13, "#5D6D7E")
    legend(cv, 920, 1950)
    cv.save(os.path.join(FIG, "db-docs.svg"))


def main():
    business()
    method()
    docs()
    for n in ("db-business", "db-method", "db-docs"):
        print(os.path.join(FIG, n + ".svg"))


if __name__ == "__main__":
    main()
