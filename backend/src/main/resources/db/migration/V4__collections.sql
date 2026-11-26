ALTER TABLE card ADD COLUMN favorite TINYINT NOT NULL DEFAULT 0;
ALTER TABLE card ADD COLUMN wrong TINYINT NOT NULL DEFAULT 0;
ALTER TABLE card ADD COLUMN wrong_count INT NOT NULL DEFAULT 0;
ALTER TABLE card ADD COLUMN last_wrong_at DATETIME(3) NULL;

CREATE INDEX idx_card_favorite ON card(user_id, favorite);
CREATE INDEX idx_card_wrong ON card(user_id, wrong);
