"""
数据库模块
==========
使用SQLite存储所有数据，包含11张核心表：
  users, character_stats, skills, study_sessions, learning_preferences,
  review_schedule, chat_history, documents, document_blocks, daily_plan,
  pomodoro_sessions, app_settings

同时包含经验曲线算法和进度等级计算函数。
"""
import sqlite3
import os
import math
from contextlib import contextmanager
from deeptutor.config import Config

# 默认用户名 — 系统中所有"首次创建用户"的逻辑共用一个常量
DEFAULT_USER_NAME = '学士'


def get_db():
    """
    获取数据库连接（每次调用创建新连接，用完需手动关闭）。
    开启WAL模式提升并发读取性能，启用外键约束保证数据完整性。
    """
    conn = sqlite3.connect(Config.DATABASE)
    conn.row_factory = sqlite3.Row  # 让查询结果支持字典式访问 row['column']
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db_ctx():
    """
    数据库连接的上下文管理器，自动关闭连接。

    用法：
        with get_db_ctx() as conn:
            row = conn.execute('SELECT ...').fetchone()

    退出 with 块时自动调用 conn.close()，即使中途抛异常也不会泄漏。
    """
    conn = get_db()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """
    初始化数据库：创建所有表（IF NOT EXISTS 保证幂等性）。
    应用启动时自动调用，不会覆盖已有数据。
    """
    # 确保数据库所在目录存在
    os.makedirs(os.path.dirname(Config.DATABASE), exist_ok=True)
    conn = get_db()
    c = conn.cursor()

    # ---- 用户表 ----
    # 存储学习者的基本信息
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '学士',       -- 角色显示名称
        avatar_emoji TEXT DEFAULT '',           -- 头像emoji（可选）
        registered INTEGER DEFAULT 0,           -- 0=未注册 1=已注册
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # 兼容旧表：如果 users 表已存在但缺少 registered 列，自动补齐
    existing = [r[1] for r in c.execute('PRAGMA table_info(users)').fetchall()]
    if 'registered' not in existing:
        c.execute('ALTER TABLE users ADD COLUMN registered INTEGER DEFAULT 0')

    # ---- 角色属性表 ----
    # RPG系统的核心：等级、经验、智力、学习统计
    # Lv1~Lv99，经验曲线为S型（先易→中难→后易）
    c.execute('''CREATE TABLE IF NOT EXISTS character_stats (
        user_id INTEGER PRIMARY KEY,
        level INTEGER DEFAULT 1,                -- 角色等级 1-99
        exp INTEGER DEFAULT 0,                  -- 当前等级已获得经验
        intelligence INTEGER DEFAULT 0,         -- 智力属性，每次升级+2
        total_study_minutes INTEGER DEFAULT 0,  -- 累计学习分钟数
        total_pomodoro_sessions INTEGER DEFAULT 0, -- 累计番茄钟次数
        melee INTEGER DEFAULT 0,                -- 近接（勇气驱动增长）
        ranged INTEGER DEFAULT 0,               -- 射撃（知识驱动增长）
        defense INTEGER DEFAULT 0,              -- 防御（五维驱动，1/5速率）
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')
    # 兼容旧表：补齐战斗属性列
    stats_cols = [r[1] for r in c.execute('PRAGMA table_info(character_stats)').fetchall()]
    for col in ['melee', 'ranged', 'defense']:
        if col not in stats_cols:
            c.execute(f'ALTER TABLE character_stats ADD COLUMN {col} INTEGER DEFAULT 0')

    # ---- 技能表 ----
    # 每个"课程/书籍"对应一条技能记录
    # progress 0-100，划分为5个等级：初级→中级→高级→大成→圆满
    c.execute('''CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,                     -- 课程/书籍名称
        category TEXT DEFAULT '课程',           -- 分类标签
        progress REAL DEFAULT 0.0,             -- 学习进度 0.0~100.0
        rank TEXT DEFAULT '初级',               -- 当前等级名称
        rank_level INTEGER DEFAULT 1,          -- 当前等级编号 1-5
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # ---- 学习记录表 ----
    # 记录每次学习会话的详细信息
    c.execute('''CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        skill_id INTEGER,                      -- 关联的技能（可为空）
        duration_minutes INTEGER NOT NULL,     -- 本次学习时长（分钟）
        exp_earned INTEGER DEFAULT 0,          -- 本次获得经验
        session_type TEXT DEFAULT 'study',     -- 类型：study/review/exercise
        notes TEXT,                            -- 备注
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
    )''')

    # ---- 学习偏好表 ----
    # 存储个性化学习向导的配置结果
    c.execute('''CREATE TABLE IF NOT EXISTS learning_preferences (
        user_id INTEGER PRIMARY KEY,
        cycle_days INTEGER DEFAULT 30,         -- 学习周期（天）
        depth TEXT DEFAULT 'medium',           -- 学习深度：basic/medium/deep
        hours_per_day REAL DEFAULT 2.0,        -- 每日学习小时数
        need_exercises INTEGER DEFAULT 1,      -- 是否需要AI生成习题
        need_review INTEGER DEFAULT 1,         -- 是否需要遗忘曲线复习计划
        setup_complete INTEGER DEFAULT 0,      -- 是否已完成个性化设置向导
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # ---- 复习计划表 ----
    # 基于艾宾浩斯遗忘曲线，在6个时间节点分别安排复习
    c.execute('''CREATE TABLE IF NOT EXISTS review_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        skill_id INTEGER,
        content_title TEXT NOT NULL,           -- 需要复习的内容标题
        learned_date DATE NOT NULL,            -- 初次学习日期
        next_review_date DATE NOT NULL,        -- 本次复习安排日期
        review_stage INTEGER DEFAULT 0,        -- 复习阶段 0-5（对应6次复习）
        completed INTEGER DEFAULT 0,           -- 是否已完成本次复习
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )''')

    # ---- 对话记录表 ----
    # AI导师聊天历史，保留最近20轮用于上下文
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,                    -- 发言角色：user / assistant
        content TEXT NOT NULL,                 -- 对话内容
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # ---- 文档表 ----
    # 记录用户上传的PDF/Word/PPT文件及其处理状态
    c.execute('''CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,                -- 服务器存储的文件名
        original_name TEXT NOT NULL,           -- 用户上传时的原始文件名
        file_type TEXT NOT NULL,               -- 文件类型：pdf/docx/ppt/pptx
        status TEXT DEFAULT 'uploaded',        -- 处理状态：uploaded/processing/processed/error
        total_chapters INTEGER DEFAULT 0,
        processed_chapters INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # ---- 文档内容块表 ----
    # 核心设计：记住每个文字块和图片块的"相对位置"(block_order)
    # 这样在翻译简化后可以按原始顺序重组成教程
    c.execute('''CREATE TABLE IF NOT EXISTS document_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chapter_title TEXT,                    -- 所属章节标题
        block_order INTEGER NOT NULL,          -- 在文档中的顺序号（维护图文相对位置）
        block_type TEXT NOT NULL,              -- 内容类型：text / heading / image / slide_title
        original_text TEXT,                    -- 原始文字（未简化）
        simplified_text TEXT,                  -- LLM简化后的文字
        image_path TEXT,                       -- 提取的图片存储路径
        image_description TEXT,                -- 图片描述文字
        page_number INTEGER,                  -- 所在页码
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )''')

    # ---- 每日计划表 ----
    # 根据学习偏好和复习计划自动生成的每日任务列表
    c.execute('''CREATE TABLE IF NOT EXISTS daily_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_date DATE NOT NULL,               -- 计划日期
        tasks_json TEXT DEFAULT '[]',          -- JSON格式的任务列表
        completed_tasks INTEGER DEFAULT 0,     -- 已完成任务数
        total_tasks INTEGER DEFAULT 0,         -- 总任务数
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )''')

    # ---- 番茄钟记录表 ----
    # 记录每次番茄钟的详细信息
    c.execute('''CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        skill_id INTEGER,                      -- 关联的学习内容
        duration_minutes INTEGER DEFAULT 25,   -- 番茄钟时长（用户可调节）
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed INTEGER DEFAULT 0,           -- 是否完成
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE SET NULL
    )''')

    # ---- 应用设置表 ----
    # 键值对存储，用于持久化API Key等运行时配置，服务重启后自动恢复
    c.execute('''CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,                  -- 设置键名，如 llm_api_key
        value TEXT DEFAULT ''                  -- 设置值
    )''')

    # 单用户模式：固定 id=1，保证文档外键可用
    c.execute("INSERT OR IGNORE INTO users (id, name, registered) VALUES (1, '学习者', 1)")

    conn.commit()
    conn.close()


# ==================== 应用设置存取 ====================

def get_setting(key, default=''):
    """
    从数据库读取一个设置值，不存在时返回默认值。
    用于持久化API Key等运行时配置。
    """
    conn = get_db()
    row = conn.execute('SELECT value FROM app_settings WHERE key = ?', (key,)).fetchone()
    conn.close()
    return row['value'] if row else default


def set_setting(key, value):
    """写入或更新一个设置值（upsert）"""
    conn = get_db()
    conn.execute('''INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)''', (key, value))
    conn.commit()
    conn.close()


# ==================== 经验曲线与等级计算 ====================

def exp_for_level(level):
    """
    计算从当前等级升到下一级所需的经验值。

    设计目标：S型曲线（先易→中难→后易），但每级经验值始终递增。
    实现方式：线性增长基础 + Sigmoid函数加成
      - 基础部分：80 + level*20（线性缓慢增长）
      - S型加成：在Lv50附近增长最快，两端增长平缓
      - 最终结果在Lv50附近"最陡"（最难升级），前后平缓（相对容易）

    参数：
        level: 当前等级 (1-98)
    返回：
        升到下一级所需经验值（始终大于上一级的所需经验）
    """
    if level < 1:
        return 100
    if level >= 99:
        return 999999  # Lv99是最高级，不再升级

    midpoint = 50.0    # S曲线中点：Lv50是难度峰值
    steepness = 0.06   # 曲线陡峭度：值越大过渡越快

    # 线性基础：保证低等级时也有一定经验门槛
    base = 80 + level * 20

    # Sigmoid加成：在midpoint附近增长率最大
    # 公式: 4000 / (1 + e^(-k*(x-mid)))
    sigmoid_bonus = 4000 / (1 + math.exp(-steepness * (level - midpoint)))

    # 取整，并确保比上一级多至少1点经验
    result = int(base + sigmoid_bonus)
    if level > 1:
        result = max(result, exp_for_level(level - 1) + 1)
    return result


def total_exp_for_level(level):
    """
    计算从Lv1升到指定等级所需的累计总经验。
    用于展示进度、估算升级所需时间等。
    """
    total = 0
    for lv in range(1, level):
        total += exp_for_level(lv)
    return total


def rank_for_progress(progress):
    """
    根据学习进度百分比(0-100)返回对应的等级名称和编号。

    五段式进度：
      0% ~ 20%  → 初级 (rank_level=1)
      20% ~ 40% → 中级 (rank_level=2)
      40% ~ 60% → 高级 (rank_level=3)
      60% ~ 85% → 大成 (rank_level=4)
      85% ~100% → 圆满 (rank_level=5)
    """
    if progress < 20:
        return '初级', 1
    elif progress < 40:
        return '中级', 2
    elif progress < 60:
        return '高级', 3
    elif progress < 85:
        return '大成', 4
    else:
        return '圆满', 5
