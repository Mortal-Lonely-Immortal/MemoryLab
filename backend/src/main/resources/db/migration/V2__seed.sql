INSERT INTO sys_user (id, username, password_hash, nickname, timezone, daily_new_limit, daily_review_limit, desired_retention)
VALUES (1, 'me', '', '我', 'Asia/Shanghai', 20, 200, 0.900);

INSERT INTO fsrs_param (user_id, version, weights, desired_retention, max_interval)
VALUES (1, 'v4.5',
        JSON_ARRAY(0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61),
        0.900, 36500);

INSERT INTO deck (id, user_id, parent_id, name, description, sort_order)
VALUES (1, 1, 0, '操作系统原理', '曹玲《操作系统原理》课件记忆卡', 0);
