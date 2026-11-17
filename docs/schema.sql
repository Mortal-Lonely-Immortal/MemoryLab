-- =============================================================
-- Memory App · MySQL 8.0 schema (v0.1)
-- 字符集 utf8mb4 / 引擎 InnoDB
-- 说明：所有时间存 UTC；业务层按用户时区换算。
-- =============================================================

CREATE DATABASE IF NOT EXISTS memory_app
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE memory_app;

-- -------------------------------------------------------------
-- 1. 用户
-- -------------------------------------------------------------
CREATE TABLE sys_user (
  id                BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  username          VARCHAR(50)  NOT NULL COMMENT '登录名',
  password_hash     VARCHAR(100) NOT NULL COMMENT 'BCrypt 哈希',
  nickname          VARCHAR(50)  NULL COMMENT '昵称',
  email             VARCHAR(100) NULL COMMENT '邮箱',
  timezone          VARCHAR(50)  NOT NULL DEFAULT 'Asia/Shanghai' COMMENT '用户时区',
  day_cutoff_hour   TINYINT      NOT NULL DEFAULT 4 COMMENT '日切小时（默认凌晨4点）',
  daily_new_limit   INT          NOT NULL DEFAULT 20 COMMENT '每日新卡上限',
  daily_review_limit INT         NOT NULL DEFAULT 200 COMMENT '每日复习上限',
  desired_retention DECIMAL(4,3) NOT NULL DEFAULT 0.900 COMMENT '目标保持率 R_target',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted           TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB COMMENT='用户';

-- -------------------------------------------------------------
-- 2. 卡组（科目 / 章 / 节，支持父子）
-- -------------------------------------------------------------
CREATE TABLE deck (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  parent_id   BIGINT       NOT NULL DEFAULT 0 COMMENT '0 表示根',
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  card_count  INT          NOT NULL DEFAULT 0 COMMENT '冗余计数，异步更新',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_deck_name (user_id, parent_id, name),
  KEY idx_deck_user (user_id, parent_id)
) ENGINE=InnoDB COMMENT='卡组/章节';

-- -------------------------------------------------------------
-- 3. 知识点（原始笔记）
-- -------------------------------------------------------------
CREATE TABLE note (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  deck_id     BIGINT       NOT NULL,
  title       VARCHAR(255) NOT NULL COMMENT '知识点标题，如“3.4.2 银行家算法”',
  content_md  MEDIUMTEXT   NULL COMMENT '原始笔记（Markdown/HTML）',
  source      VARCHAR(255) NULL COMMENT '来源，如 OS_3-2 p13-17',
  chapter     VARCHAR(50)  NULL COMMENT '章号，如 3',
  biz_key     VARCHAR(128) NULL COMMENT '导入去重键：hash(章节+标题)',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_note_biz (user_id, biz_key),
  KEY idx_note_deck (user_id, deck_id)
) ENGINE=InnoDB COMMENT='知识点/原始笔记';

-- -------------------------------------------------------------
-- 4. 卡片（复习热路径）
-- -------------------------------------------------------------
CREATE TABLE card (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  note_id         BIGINT       NULL COMMENT '可为空：手动创建的卡',
  deck_id         BIGINT       NOT NULL,
  card_type       VARCHAR(16)  NOT NULL DEFAULT 'QA' COMMENT 'QA/CLOZE/MCQ/WHY',
  front           TEXT         NOT NULL COMMENT '问题/正面',
  back            TEXT         NOT NULL COMMENT '答案/背面',
  extra           MEDIUMTEXT   NULL COMMENT '附加说明、易错点、来源',

  -- FSRS 记忆状态
  state           TINYINT      NOT NULL DEFAULT 0 COMMENT '0 NEW,1 LEARNING,2 REVIEW,3 RELEARNING',
  due_date        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '下次到期',
  last_review     DATETIME(3)  NULL,
  stability       DECIMAL(10,4) NOT NULL DEFAULT 0 COMMENT '稳定性 S（天）',
  difficulty      DECIMAL(6,4)  NOT NULL DEFAULT 0 COMMENT '难度 D（1-10）',
  elapsed_days    INT          NOT NULL DEFAULT 0 COMMENT '距上次复习天数',
  scheduled_days  INT          NOT NULL DEFAULT 0 COMMENT '上次排期间隔',
  reps            INT          NOT NULL DEFAULT 0 COMMENT '成功复习次数',
  lapses          INT          NOT NULL DEFAULT 0 COMMENT '遗忘次数',
  learning_step   TINYINT      NOT NULL DEFAULT 0 COMMENT '学习/重学步骤',
  suspended       TINYINT      NOT NULL DEFAULT 0 COMMENT '1=暂停',
  leech           TINYINT      NOT NULL DEFAULT 0 COMMENT '1=反复遗忘',

  version         INT          NOT NULL DEFAULT 0 COMMENT '乐观锁',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted         TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_card_due  (user_id, state, due_date),
  KEY idx_card_deck (user_id, deck_id),
  KEY idx_card_note (note_id)
) ENGINE=InnoDB COMMENT='卡片 + FSRS 状态';

-- -------------------------------------------------------------
-- 5. 标签
-- -------------------------------------------------------------
CREATE TABLE tag (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  user_id    BIGINT      NOT NULL,
  name       VARCHAR(50) NOT NULL,
  color      VARCHAR(16) NULL COMMENT '十六进制色值',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tag_name (user_id, name)
) ENGINE=InnoDB COMMENT='标签';

CREATE TABLE card_tag (
  card_id BIGINT NOT NULL,
  tag_id  BIGINT NOT NULL,
  PRIMARY KEY (card_id, tag_id),
  KEY idx_card_tag_tag (tag_id)
) ENGINE=InnoDB COMMENT='卡片-标签';

-- -------------------------------------------------------------
-- 6. 复习流水（只插入，不更新）
-- -------------------------------------------------------------
CREATE TABLE review_log (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id             BIGINT       NOT NULL,
  card_id             BIGINT       NOT NULL,
  rating              TINYINT      NOT NULL COMMENT '1 Again,2 Hard,3 Good,4 Easy',
  state_before        TINYINT      NOT NULL,
  state_after         TINYINT      NOT NULL,
  stability_before    DECIMAL(10,4) NOT NULL DEFAULT 0,
  stability_after     DECIMAL(10,4) NOT NULL DEFAULT 0,
  difficulty_before   DECIMAL(6,4)  NOT NULL DEFAULT 0,
  difficulty_after    DECIMAL(6,4)  NOT NULL DEFAULT 0,
  elapsed_days        INT          NOT NULL DEFAULT 0,
  scheduled_days      INT          NOT NULL DEFAULT 0,
  review_duration_ms  INT          NOT NULL DEFAULT 0,
  reviewed_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  client_req_id       VARCHAR(64)  NULL COMMENT '幂等键',
  PRIMARY KEY (id),
  UNIQUE KEY uk_log_client (user_id, client_req_id),
  KEY idx_log_card (card_id, reviewed_at),
  KEY idx_log_user (user_id, reviewed_at)
) ENGINE=InnoDB COMMENT='复习流水';

-- -------------------------------------------------------------
-- 7. FSRS 参数（每个用户一份，可多版本）
-- -------------------------------------------------------------
CREATE TABLE fsrs_param (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  user_id           BIGINT       NOT NULL,
  version           VARCHAR(16)  NOT NULL DEFAULT 'v4.5',
  weights           JSON         NOT NULL COMMENT '17/19 个权重',
  desired_retention DECIMAL(4,3) NOT NULL DEFAULT 0.900,
  max_interval      INT          NOT NULL DEFAULT 36500 COMMENT '最大间隔（天）',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_fsrs_user_version (user_id, version)
) ENGINE=InnoDB COMMENT='FSRS 参数';

-- -------------------------------------------------------------
-- 8. 每日统计（定时汇总，加速统计页）
-- -------------------------------------------------------------
CREATE TABLE daily_stat (
  id            BIGINT      NOT NULL AUTO_INCREMENT,
  user_id       BIGINT      NOT NULL,
  stat_date     DATE        NOT NULL,
  new_count     INT         NOT NULL DEFAULT 0,
  review_count  INT         NOT NULL DEFAULT 0,
  again_count   INT         NOT NULL DEFAULT 0,
  hard_count    INT         NOT NULL DEFAULT 0,
  good_count    INT         NOT NULL DEFAULT 0,
  easy_count    INT         NOT NULL DEFAULT 0,
  retention     DECIMAL(5,4) NOT NULL DEFAULT 0 COMMENT '当日保持率',
  study_ms      BIGINT      NOT NULL DEFAULT 0,
  due_count     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stat_user_date (user_id, stat_date)
) ENGINE=InnoDB COMMENT='每日统计';

-- -------------------------------------------------------------
-- 9. 导入任务
-- -------------------------------------------------------------
CREATE TABLE import_job (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  user_id        BIGINT       NOT NULL,
  filename       VARCHAR(255) NOT NULL,
  file_hash      CHAR(64)     NULL,
  status         VARCHAR(16)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/PARSING/READY/DONE/FAILED',
  total_notes    INT          NOT NULL DEFAULT 0,
  total_cards    INT          NOT NULL DEFAULT 0,
  created_cards  INT          NOT NULL DEFAULT 0,
  skipped_cards  INT          NOT NULL DEFAULT 0,
  error_msg      VARCHAR(500) NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at    DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_import_user (user_id, created_at)
) ENGINE=InnoDB COMMENT='导入任务';

-- -------------------------------------------------------------
-- 10. 学习会话（可选）
-- -------------------------------------------------------------
CREATE TABLE study_session (
  id             BIGINT      NOT NULL AUTO_INCREMENT,
  user_id        BIGINT      NOT NULL,
  started_at     DATETIME(3) NOT NULL,
  ended_at       DATETIME(3) NULL,
  cards_reviewed INT         NOT NULL DEFAULT 0,
  again_count    INT         NOT NULL DEFAULT 0,
  duration_ms    BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_session_user (user_id, started_at)
) ENGINE=InnoDB COMMENT='学习会话';

-- -------------------------------------------------------------
-- 11. 学习方法周实验
-- -------------------------------------------------------------
CREATE TABLE learning_method (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  user_id        BIGINT       NOT NULL DEFAULT 1,
  name           VARCHAR(100) NOT NULL,
  category       VARCHAR(32)  NULL COMMENT 'retrieval/spacing/interleaving/elaboration/note-taking/other',
  description    VARCHAR(500) NULL,
  evidence_level VARCHAR(16)  NOT NULL DEFAULT 'MEDIUM' COMMENT 'HIGH/MEDIUM/LOW',
  source         VARCHAR(255) NULL,
  builtin        TINYINT      NOT NULL DEFAULT 0,
  active         TINYINT      NOT NULL DEFAULT 1,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_method_name (user_id, name)
) ENGINE=InnoDB COMMENT='学习方法库';

CREATE TABLE weekly_plan (
  id          BIGINT      NOT NULL AUTO_INCREMENT,
  user_id     BIGINT      NOT NULL DEFAULT 1,
  week_start  DATE        NOT NULL COMMENT '周一',
  week_end    DATE        NOT NULL COMMENT '周日',
  status      VARCHAR(16) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/ACTIVE/REVIEWED',
  note        VARCHAR(500) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_plan_week (user_id, week_start)
) ENGINE=InnoDB COMMENT='每周学习方法计划';

CREATE TABLE weekly_plan_item (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  plan_id     BIGINT       NOT NULL,
  method_id   BIGINT       NULL,
  custom_name VARCHAR(100) NULL,
  target_days INT          NOT NULL DEFAULT 5,
  avg_score   DECIMAL(4,2) NULL,
  decision    VARCHAR(16)  NULL COMMENT 'KEEP/DROP/TRIAL',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_item_plan (plan_id),
  KEY idx_item_method (method_id)
) ENGINE=InnoDB COMMENT='每周方法条目';

CREATE TABLE method_log (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  user_id      BIGINT      NOT NULL DEFAULT 1,
  item_id      BIGINT      NOT NULL,
  log_date     DATE        NOT NULL,
  score        TINYINT     NOT NULL COMMENT '1-5',
  note         VARCHAR(500) NULL,
  duration_min INT         NOT NULL DEFAULT 0,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_log_item_date (item_id, log_date),
  KEY idx_log_user_date (user_id, log_date)
) ENGINE=InnoDB COMMENT='方法每日打分';

INSERT INTO learning_method (user_id, name, category, description, evidence_level, source, builtin) VALUES
(1, '主动回忆（检索练习）', 'retrieval', '合上资料先回想，再核对答案；比重复阅读更抗遗忘', 'HIGH', 'Roediger & Karpicke 2006; Dunlosky 2013', 1),
(1, '间隔重复', 'spacing', '把复习分散到多天，按遗忘概率排期', 'HIGH', 'Cepeda 2006; FSRS', 1),
(1, '交错练习', 'interleaving', '不同题型/章节混合练，强迫先判断类型', 'MEDIUM', 'Rohrer & Taylor 2007', 1),
(1, '精细化复述（问为什么）', 'elaboration', '对结论追问“为什么/什么情况下不成立”', 'MEDIUM', 'Dunlosky 2013', 1),
(1, '自我解释', 'elaboration', '用自己的话解释每一步推导，而不是背结论', 'MEDIUM', 'Dunlosky 2013', 1),
(1, '费曼技巧', 'elaboration', '假装讲给外行听，卡住的地方就是没懂', 'MEDIUM', '自我解释的变体', 1),
(1, '闪卡自测', 'retrieval', '问题→先答→翻面核对，适合碎片时间', 'HIGH', '测试效应', 1),
(1, '思维导图', 'note-taking', '画结构图梳理关系；对“回忆”本身帮助有限', 'LOW', 'Dunlosky 2013 评估为低效用', 1),
(1, '划线/重读', 'note-taking', '熟悉感强但提取弱，容易产生“会了”的错觉', 'LOW', 'Dunlosky 2013 评估为低效用', 1);

-- -------------------------------------------------------------
-- 11. 单用户模式的种子数据（多用户时删除）
-- -------------------------------------------------------------
-- INSERT INTO sys_user (username, password_hash, nickname)
-- VALUES ('me', '$2a$10$replace-with-bcrypt-hash', '我');

-- 默认 FSRS v4.5 权重（17 个）
-- INSERT INTO fsrs_param (user_id, version, weights, desired_retention, max_interval)
-- VALUES (1, 'v4.5',
--   JSON_ARRAY(0.4,0.6,2.4,5.8,4.93,0.94,0.86,0.01,1.49,0.14,0.94,2.18,0.05,0.34,1.26,0.29,2.61),
--   0.900, 36500);
