-- 学习方法周实验：每周日规划 3-5 个方法，每天打分，周末保留/淘汰
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习方法库';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每周学习方法计划';

CREATE TABLE weekly_plan_item (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  plan_id     BIGINT       NOT NULL,
  method_id   BIGINT       NULL,
  custom_name VARCHAR(100) NULL,
  target_days INT          NOT NULL DEFAULT 5 COMMENT '本周计划练几天',
  avg_score   DECIMAL(4,2) NULL COMMENT '周均分',
  decision    VARCHAR(16)  NULL COMMENT 'KEEP/DROP/TRIAL',
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_item_plan (plan_id),
  KEY idx_item_method (method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每周方法条目';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='方法每日打分';

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
