CREATE TABLE sys_user (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  username          VARCHAR(50)  NOT NULL,
  password_hash     VARCHAR(100) NOT NULL DEFAULT '',
  nickname          VARCHAR(50)  NULL,
  email             VARCHAR(100) NULL,
  timezone          VARCHAR(50)  NOT NULL DEFAULT 'Asia/Shanghai',
  day_cutoff_hour   TINYINT      NOT NULL DEFAULT 4,
  daily_new_limit   INT          NOT NULL DEFAULT 20,
  daily_review_limit INT         NOT NULL DEFAULT 200,
  desired_retention DECIMAL(4,3) NOT NULL DEFAULT 0.900,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted           TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户';

CREATE TABLE deck (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  parent_id   BIGINT       NOT NULL DEFAULT 0,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  card_count  INT          NOT NULL DEFAULT 0,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_deck_name (user_id, parent_id, name),
  KEY idx_deck_user (user_id, parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡组/章节';

CREATE TABLE note (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  deck_id     BIGINT       NOT NULL,
  title       VARCHAR(255) NOT NULL,
  content_md  MEDIUMTEXT   NULL,
  source      VARCHAR(255) NULL,
  chapter     VARCHAR(50)  NULL,
  biz_key     VARCHAR(128) NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted     TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_note_biz (user_id, biz_key),
  KEY idx_note_deck (user_id, deck_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识点/原始笔记';

CREATE TABLE card (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  user_id         BIGINT       NOT NULL,
  note_id         BIGINT       NULL,
  deck_id         BIGINT       NOT NULL,
  card_type       VARCHAR(16)  NOT NULL DEFAULT 'QA',
  front           TEXT         NOT NULL,
  back            TEXT         NOT NULL,
  extra           MEDIUMTEXT   NULL,
  state           TINYINT      NOT NULL DEFAULT 0,
  due_date        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_review     DATETIME(3)  NULL,
  stability       DECIMAL(10,4) NOT NULL DEFAULT 0,
  difficulty      DECIMAL(6,4)  NOT NULL DEFAULT 0,
  elapsed_days    INT          NOT NULL DEFAULT 0,
  scheduled_days  INT          NOT NULL DEFAULT 0,
  reps            INT          NOT NULL DEFAULT 0,
  lapses          INT          NOT NULL DEFAULT 0,
  learning_step   TINYINT      NOT NULL DEFAULT 0,
  suspended       TINYINT      NOT NULL DEFAULT 0,
  leech           TINYINT      NOT NULL DEFAULT 0,
  version         INT          NOT NULL DEFAULT 0,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted         TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_card_due  (user_id, state, due_date),
  KEY idx_card_deck (user_id, deck_id),
  KEY idx_card_note (note_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡片 + FSRS 状态';

CREATE TABLE tag (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  user_id    BIGINT      NOT NULL,
  name       VARCHAR(50) NOT NULL,
  color      VARCHAR(16) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_tag_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签';

CREATE TABLE card_tag (
  card_id BIGINT NOT NULL,
  tag_id  BIGINT NOT NULL,
  PRIMARY KEY (card_id, tag_id),
  KEY idx_card_tag_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='卡片-标签';

CREATE TABLE review_log (
  id                  BIGINT       NOT NULL AUTO_INCREMENT,
  user_id             BIGINT       NOT NULL,
  card_id             BIGINT       NOT NULL,
  rating              TINYINT      NOT NULL,
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
  client_req_id       VARCHAR(64)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_log_client (user_id, client_req_id),
  KEY idx_log_card (card_id, reviewed_at),
  KEY idx_log_user (user_id, reviewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='复习流水';

CREATE TABLE fsrs_param (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  user_id           BIGINT       NOT NULL,
  version           VARCHAR(16)  NOT NULL DEFAULT 'v4.5',
  weights           JSON         NOT NULL,
  desired_retention DECIMAL(4,3) NOT NULL DEFAULT 0.900,
  max_interval      INT          NOT NULL DEFAULT 36500,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_fsrs_user_version (user_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='FSRS 参数';

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
  retention     DECIMAL(5,4) NOT NULL DEFAULT 0,
  study_ms      BIGINT      NOT NULL DEFAULT 0,
  due_count     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_stat_user_date (user_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日统计';

CREATE TABLE import_job (
  id             BIGINT       NOT NULL AUTO_INCREMENT,
  user_id        BIGINT       NOT NULL,
  filename       VARCHAR(255) NOT NULL,
  file_hash      CHAR(64)     NULL,
  status         VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
  total_notes    INT          NOT NULL DEFAULT 0,
  total_cards    INT          NOT NULL DEFAULT 0,
  created_cards  INT          NOT NULL DEFAULT 0,
  skipped_cards  INT          NOT NULL DEFAULT 0,
  error_msg      VARCHAR(500) NULL,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at    DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_import_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='导入任务';

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习会话';
