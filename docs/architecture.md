# 记忆助手（Memory App）架构设计 v0.1

> 目标：把“当时看懂了、过几天忘了”变成“按遗忘规律自动安排复习，并且每次复习都是主动回忆”。
> 范围：本文只做架构与数据库设计；代码在确认设计后开始。

---

## 1. 需求拆解

你的真实问题不是“没有资料”，而是：

1. **理解了，但没有形成长期记忆**——需要间隔重复（spacing）；
2. **复习时容易“看懂了”而不是“想起来了”**——需要主动回忆（retrieval practice）；
3. **不知道自己哪里忘了**——需要可量化的记忆状态与统计；
4. **资料已经在手边**（82 页记忆手册、课件 PDF、错题）——需要低成本变成卡片；
5. **复习要能坚持**——每天只给一个“今日队列”，不要让你自己决定学什么。

因此产品核心只有四个动作：**导入 → 生成卡片 → 每日复习 → 看统计**。

---

## 2. 记忆科学依据（以及证据强度）

### 2.1 主动回忆 / 测试效应（最该做的一条）

**结论**：同样的时间，用来“合上书回想”比“重复阅读”记得更牢；复习时应当先出题、后看答案。

- Roediger & Karpicke (2006) 的经典实验：测试组比重复阅读组在一周后的延迟测验中保留更多。
- Dunlosky 等 (2013) 对 10 种学习技术做系统评估，**practice testing（自测）**与**distributed practice（分散练习）**是仅有的两项“高效用”技术。
- 机制：提取本身会改变记忆痕迹（retrieval-induced facilitation），并暴露“以为自己会了”的错觉。

> 产品映射：每张卡默认是“问题 → 先自己想 → 再翻答案 → 自评 1–4”，禁止默认展示答案。

### 2.2 间隔重复 / 分散练习

**结论**：把同样的复习次数分散到多天，比集中突击保留更久；间隔应随掌握程度逐步拉长。

- Cepeda 等 (2006) 对 254 项研究的元分析：分散练习显著优于集中练习，且最佳间隔与目标保持期相关。
- 机制：每次在“快要忘记”时成功提取，记忆稳定性增长最大（desirable difficulty）。
- 艾宾浩斯遗忘曲线是经典起点，但**个体差异很大**，固定“1/2/4/7/15 天”并不适合每个人；现代做法是用模型按你的实际评分动态排期。

> 产品映射：不写死复习间隔，使用 FSRS 的 DSR 模型（难度、稳定性、可提取性）按卡片历史计算下一次到期日。

### 2.3 FSRS：目前可落地的最优排期算法

FSRS（Free Spaced Repetition Scheduler）是 Anki 23.10+ 引入的开源调度器，核心是三个变量：

- **Difficulty（D，1–10）**：这张卡对你有多难；
- **Stability（S，天）**：记忆稳定性，定义为“可提取性从 100% 衰减到 90% 所需的天数”；
- **Retrievability（R，0–1）**：此刻还能想起来的概率。

核心公式（v4.5，幂律遗忘曲线）：

```
R(t, S) = (1 + F · t / S)^(-0.5)，F = 19/81
下次间隔 I = S · (81/19) · (R_target^(-2) - 1)
```

当目标保持率 `R_target = 0.9` 时，`I = S`——这就是“到期日 = 稳定性”的直觉。

对比：

| 算法 | 记忆模型 | 个性化 | 复习量 | 适合 |
|---|---|---|---|---|
| SM-2（1987） | 间隔 + 难度因子 | 无 | 最高 | 想完全可解释、参数手调 |
| FSRS v4.5 | DSR | 默认参数已很好；1000+ 次复习后可优化 | 比 SM-2 少 20–30% | **本项目推荐** |
| FSRS v6 | DSR + 同日复习 | 需优化才发挥 | 略低 | 有大量历史后再考虑 |

> 产品映射：MVP 用 **FSRS v4.5（17 个默认权重）**，把算法封装成可替换的 `ReviewScheduler` 接口；以后要换 v6/SM-2 不影响业务层。

### 2.4 交错练习（interleaving）

**结论**：把不同题型/章节混在一起练，比“一个题型刷到底”更能促进辨别与迁移；对数学类材料证据较强，对纯记忆材料要适度。

- Rohrer & Taylor (2007)：数学题混合练习组在延迟测验中优于分块练习组。
- 机制：混合迫使你每次先判断“这是哪类问题”，而不是机械套用刚看过的例题。

> 产品映射：每日队列默认“到期卡 + 新卡”混排，并按 deck/章节轮转；提供“按章刷”开关，但默认交错。

### 2.5 合意困难（desirable difficulties）

**结论**：让提取稍微费劲一点（但不至于失败）能提升长期保持；太顺滑的复习往往是错觉。

- Bjork & Bjork (2011) 的框架：提取练习、间隔、交错、变化、生成，都属于“短期更难、长期更好”。
- 边界：难度必须“可克服”；连续失败会打击动机，也会让排期爆炸。

> 产品映射：目标保持率默认 0.9；提供 0.85（省时间）/0.95（更牢）两档；连续 Again 的卡自动降级为“重点卡”并缩短间隔。

### 2.6 精细化复述 / 生成

**结论**：能用自己的话解释“为什么/怎么用”，比背定义更抗遗忘。

- Dunlosky 等 (2013) 将 **self-explanation** 评为“中等效用”，**elaborative interrogation**（问为什么）为“中等”。
- 对概念性知识（操作系统原理正是），建议卡片不只问“是什么”，还要问“为什么”“什么情况下会出错”。

> 产品映射：卡片类型支持 `QA`（问答）、`CLOZE`（填空）、`WHY`（追问为什么）；导入手册时自动把“易错”生成 WHY/对比卡。

### 2.7 元认知与“假熟练”

**结论**：人对自己是否记住的判断很不准；需要外部指标（延迟测验、错题、评分分布）校准。

- Karpicke 等发现，重复阅读会提高“熟悉感”但不提高“可提取性”。
- 产品上要显示：真实保持率、Again 率、leeches（反复忘的卡）、预测到期量。

### 2.8 证据强度说明（避免伪科学）

- **强证据**：测试效应、分散练习（大量 RCT/元分析）。
- **中等证据**：交错练习（学科/材料依赖）、精细化复述。
- **工程证据**：FSRS 的大规模基准来自 17 亿条复习记录，指标是“预测回忆概率的误差”，不是“学习成绩 RCT”；它比 SM-2 预测更准、复习更少，但不等同于教育实验。
- **不要神化**：睡眠、地点、音乐等对记忆有影响，但不是本产品的核心变量；MVP 不做。

参考文献见文末。

---

## 3. 产品形态与核心流程

### 3.1 形态

- **Web 优先**（桌面/手机浏览器均可），后续可加 PWA 离线；
- 单页应用：今日复习、卡片管理、方法实验室、导入、统计、设置；
- 不做社交、不做课程商城，先做“个人记忆操作系统”。

### 3.2 核心流程

```
导入资料（docx/markdown/手动）
        ↓
生成 note（知识点）与 card（问题卡）
        ↓
每日队列：到期卡 + 新卡（交错）
        ↓
看问题 → 自己回想 → 翻答案 → 自评 1–4
        ↓
FSRS 计算新 D/S/R、下次到期日
        ↓
统计：保持率、到期预测、易忘卡

每周日 20:00 → 自动生成下周 3 个方法的草稿
        ↓
每天给每个方法打 1–5 分
        ↓
周日复盘：≥3.5 保留、≤2.5 淘汰、中间再试一周
```

### 3.3 每日队列规则（MVP）

1. 先取 `due_date <= now` 的到期卡，按 `due_date` 升序；
2. 再补新卡，数量 = `min(用户每日新卡上限, 剩余配额)`；
3. 按 deck 轮转交错，避免同一章连续出现；
4. 单次会话上限可配置（默认 50 张）；
5. 到期卡为 0 且新卡为 0 时，显示“今日完成”，不硬塞复习。

---

## 4. 技术架构

### 4.1 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 语言 | Java 17 | 本机 JDK 17；Spring Boot 3.3 最低要求 |
| 框架 | Spring Boot 3.3.5 | 稳定、生态好；不追 4.0 |
| 持久层 | MyBatis-Plus 3.5.9 + mybatis-plus-jsqlparser | BaseMapper + LambdaQueryWrapper；3.5.9 起分页插件拆到 jsqlparser 模块 |
| 数据库 | MySQL 8.0 | utf8mb4、InnoDB |
| 缓存 | 暂不接 | 单用户 MVP 不需要 Redis |
| 认证 | 暂不接 | 单用户固定 `user_id=1`；`sys_user` 表保留 |
| 文档 | springdoc-openapi 2.6.0 | Swagger UI：`/swagger-ui.html` |
| 迁移 | Flyway 10 | 版本化 DDL，启动自动迁移 |
| 参数校验 | Jakarta Validation | DTO 上注解 |
| 对象映射 | 手写 record 转换 | 单用户 MVP 不引入 MapStruct，减少一层复杂度 |
| 测试 | JUnit 5 | FSRS 纯函数单测 + docx 解析单测；暂不接 Testcontainers |
| 部署 | Docker Compose | `mysql` + `backend` + `frontend(nginx)`；前端镜像复制预构建 dist，后端镜像复制预构建 jar |

### 4.2 分层

```
Controller（HTTP、参数校验、DTO）
    ↓
Service（业务编排、事务、权限）
    ↓
Mapper（MyBatis-Plus BaseMapper / XML 复杂查询）
    ↓
MySQL
```

约束：

- Controller 不写业务逻辑，只做参数接收、校验、调用 Service、返回 `Result<T>`；
- Service 接口 + 实现；跨表事务在 Service 层；
- Entity 不直接返回给前端，用 VO；
- 所有写接口幂等（`clientReqId`）或带 `version` 乐观锁；
- 统一异常处理：`BizException` + `GlobalExceptionHandler`；
- 统一返回：`{ code, message, data, traceId }`。

### 4.3 模块划分（按业务分包）

```
com.memory
├── common        // Result、异常、常量、工具、MyBatis-Plus 配置
├── auth          // 登录、JWT、用户
├── deck          // 卡组/章节
├── note          // 知识点（原始笔记）
├── card          // 卡片 CRUD、标签
├── review        // 每日队列、评分、FSRS 调度、撤销
├── stats         // 概览、热力图、到期预测、易忘卡
├── methodlab     // 学习方法库、周计划、每日打分、周末复盘
├── scheduler     // 周日晚自动生成下周方法草稿
├── importer      // docx/markdown 导入、卡片生成
└── config        // OpenAPI、Jackson、时区、MyBatis-Plus
```

### 4.4 核心服务

- `ReviewQueueService`：组装每日队列（到期 + 新卡 + 交错 + 上限）；
- `ReviewService`：处理一次评分，写 `review_log`，更新 `card`；
- `FsrsScheduler`：**纯函数**，输入 `(cardState, rating, now)` → `newState`；不依赖 Spring，便于单测；
- `CardGenerationService`：从 note 生成卡片（QA/CLOZE/WHY）；
- `ImportService`：解析 docx，落 note/card，记录 `import_job`；
- `StatsService`：按 `review_log` 聚合保持率、到期量；
- `MethodLabService`：周计划 CRUD、每日打分、周均分与保留/淘汰建议；
- `MethodPlanScheduler`：每周日 20:00（Asia/Shanghai）调用 `ensureNextWeekDraft()`。

---

## 5. 数据库设计

> 完整 DDL 见 `schema.sql`。所有表：`id BIGINT` 主键、`created_at/updated_at`、`deleted` 逻辑删除、`utf8mb4`。

### 5.1 表清单

| 表 | 作用 | 关键点 |
|---|---|---|
| `sys_user` | 用户 | 时区、每日新卡上限、目标保持率 |
| `deck` | 卡组/章节（支持父子） | 按科目→章→节组织 |
| `note` | 知识点（原始笔记） | 一个 note 可生成多张 card |
| `card` | 卡片 + FSRS 状态 | 复习热路径，索引在 `(user_id, state, due_date)` |
| `tag` / `card_tag` | 标签 | 多对多，支持“易错/计算/概念” |
| `review_log` | 每次复习流水 | 算法输入与统计来源，不可变 |
| `fsrs_param` | 用户算法参数 | 17 个权重 JSON，支持以后优化 |
| `daily_stat` | 每日汇总 | 加速统计页，定时任务生成 |
| `import_job` | 导入任务 | 记录解析/生成结果与错误 |
| `study_session` | 学习会话（可选） | 用于“今天学了多久” |
| `learning_method` | 学习方法库 | 9 个内置候选，带 HIGH/MEDIUM/LOW 证据等级 |
| `weekly_plan` | 每周方法计划 | 周一~周日；DRAFT/ACTIVE/REVIEWED |
| `weekly_plan_item` | 周计划条目 | 3–5 个方法，`target_days`、`avg_score`、`decision` |
| `method_log` | 方法每日打分 | `UNIQUE(item_id, log_date)`，1–5 分 |

### 5.2 关键字段说明

**card（最重要的表）**

```sql
state          TINYINT      -- 0 NEW, 1 LEARNING, 2 REVIEW, 3 RELEARNING
due_date       DATETIME(3)  -- 下次到期（精确到毫秒，支持 10 分钟后重试）
stability      DECIMAL(10,4)-- 稳定性 S（天）
difficulty     DECIMAL(6,4) -- 难度 D（1–10）
elapsed_days   INT          -- 距上次复习的天数
scheduled_days INT          -- 上次排期的间隔（天）
reps           INT          -- 成功复习次数
lapses         INT          -- 遗忘次数
learning_step  TINYINT      -- 学习/重学步骤（0,1,2…）
suspended      TINYINT      -- 暂停（不进入队列）
leech          TINYINT      -- 反复遗忘标记
version        INT          -- 乐观锁
```

**review_log（不可变流水）**

```sql
rating            TINYINT   -- 1 Again, 2 Hard, 3 Good, 4 Easy
state_before/after TINYINT
stability_before/after DECIMAL(10,4)
difficulty_before/after DECIMAL(6,4)
elapsed_days      INT
scheduled_days    INT
review_duration_ms INT
reviewed_at       DATETIME(3)
client_req_id     VARCHAR(64) UNIQUE  -- 幂等
```

### 5.3 索引设计

- `card (user_id, state, due_date)`：每日队列主查询；
- `card (user_id, deck_id)`：按章浏览；
- `card (note_id)`：note 下的卡；
- `review_log (card_id, reviewed_at)`：单卡历史；
- `review_log (user_id, reviewed_at)`：统计；
- `daily_stat (user_id, stat_date)` 唯一。

### 5.4 时区与“一天”的边界

- 数据库存 UTC；用户时区默认 `Asia/Shanghai`；
- “今日到期”按用户时区的 **04:00** 为日切（可配置），避免熬夜复习被算到第二天；
- 所有 `due_date` 用 `DATETIME(3)`，短间隔（10 分钟）也能精确排。

### 5.5 方法实验室表

```sql
learning_method   -- 方法库：name, category, evidence_level, builtin, active
weekly_plan       -- 周计划：week_start(周一), week_end(周日), status, note
weekly_plan_item  -- 条目：plan_id, method_id/custom_name, target_days, avg_score, decision
method_log        -- 打分：item_id, log_date, score(1-5), note, duration_min
```

规则：

- 每周 3–5 个方法；少于 3 或多于 5 直接拒绝；
- 每天每个方法只允许一条打分（唯一键），重复提交视为修改；
- 周均分 = 该条目所有打分的算术平均，保留两位；
- 复盘建议：`avg >= 3.5 → KEEP`、`avg <= 2.5 → DROP`、其余 `TRIAL`；用户可覆盖；
- 周日晚 20:00 的定时任务只为**下周**建草稿，不自动覆盖本周已复盘的计划。

---

## 6. FSRS 调度设计

### 6.1 状态机

```
NEW ──评分──> LEARNING（Again，10 分钟后）
  └────────> REVIEW（Hard/Good/Easy，按 S 排期）

REVIEW ──Again──> RELEARNING（10 分钟后）──Good──> REVIEW
       └─Hard/Good/Easy──> REVIEW
```

MVP 简化：不实现 Anki 的多步学习步骤，只用“Again → 10 分钟后；其他 → 按 S 排期”。

### 6.2 计算（v4.5）

- 新卡：`S0 = w[rating-1]`；`D0 = w4 - (rating-3)*w5`，clamp 到 [1,10]。
- 复习：先算 `R = (1 + 19/81 * t/S)^-0.5`；
  - `rating = 1`：`S' = min(S, w11 * D^-w12 * ((S+1)^w13 - 1) * e^(w14*(1-R)))`；
  - 否则：`D' = D - w6*(rating-3)`，再做均值回归 `D'' = w7*w4 + (1-w7)*D'`；
    `S' = S * (1 + e^w8 * (11-D) * S^-w9 * (e^(w10*(1-R))-1) * H_G * E_G)`，
    其中 Hard 时 `H_G=w15`、Easy 时 `E_G=w16`，其余为 1。
- 下次间隔：`I = S' * (81/19) * (R_target^-2 - 1)`，clamp 到 `[1, maxInterval]`。
- 目标保持率默认 0.9；`maxInterval` 默认 36500 天。
- 简化：Learning/Relearning 状态评分 ≥2 时，直接按 `max(S, S0)` 进入 REVIEW，不实现 Anki 多步学习步。

### 6.3 预览

复习页四个按钮上显示“下次间隔”（如 `<10分`、`3天`、`8天`、`15天`），由 `preview(card)` 纯函数计算，不落库。

### 6.4 参数优化（后续）

`fsrs_param.weights` 存 JSON；当用户累计复习 ≥ 1000 次，可离线跑优化器（Python/JS 实现），把新权重写回。MVP 不做在线优化。

---

## 7. API 设计（REST，`/api/v1`）

### 7.1 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册（单用户模式未实现） |
| POST | `/auth/login` | 返回 JWT（单用户模式未实现） |
| GET | `/auth/me` | 当前用户与设置（MVP 可用） |

### 7.2 卡组 / 知识点 / 卡片

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/decks` | 列表 / 新建 |
| PUT/DELETE | `/decks/{id}` | 改名 / 删除 |
| GET/POST | `/notes` | 知识点列表 / 新建 |
| GET/PUT/DELETE | `/notes/{id}` | 详情 / 修改 / 删除 |
| POST | `/notes/{id}/cards` | 从 note 生成卡片 |
| GET/POST | `/cards` | 卡片列表（分页/筛选）/ 新建 |
| GET/PUT/DELETE | `/cards/{id}` | 详情 / 修改 / 删除 |
| POST | `/cards/{id}/suspend` | 暂停/恢复 |

### 7.3 复习

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/review/queue?limit=20&mode=mixed` | 今日队列 |
| GET | `/review/{cardId}/preview` | 四个评分的下次间隔 |
| POST | `/review/{cardId}` | 提交评分 `{rating, durationMs, clientReqId}` |
| POST | `/review/undo` | 撤销上一次（可选，MVP 可后置） |

### 7.4 统计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/stats/overview` | 今日到期、今日已复习、保持率、连续天数 |
| GET | `/stats/heatmap?from=&to=` | 每日复习量热力图 |
| GET | `/stats/forecast?days=30` | 未来 30 天到期量 |
| GET | `/stats/leeches` | 反复遗忘的卡 |

### 7.5 导入

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/import/docx` | multipart 上传，创建导入任务 |
| GET | `/import/jobs/{id}` | 查询进度与结果 |
| POST | `/import/jobs/{id}/confirm` | 预览后确认落库（可选） |

### 7.6 设置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/PUT | `/settings` | 每日新卡上限、目标保持率、日切时间、时区 |

### 7.7 方法实验室

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/method-lab/methods` | 方法库（含证据等级） |
| GET | `/method-lab/plan/current` | 本周计划（不存在则自动建） |
| POST | `/method-lab/plan` | 创建/调整周计划，3–5 个方法 |
| POST | `/method-lab/plan/next-draft` | 生成/查看下周草稿 |
| POST | `/method-lab/score` | 每天给某个方法打 1–5 分 |
| POST | `/method-lab/review` | 周末复盘，写 KEEP/DROP/TRIAL |

---

## 8. 从现有 docx 记忆手册导入

这是本项目的“冷启动”关键：你已经有 82 页、约 200 个知识点的结构化手册。

### 8.1 解析规则（与现有文档结构对齐）

| 文档结构 | 识别方式 | 生成 |
|---|---|---|
| `Heading 2/3/4`（如“3.4.2 银行家算法实例”） | `pStyle=Heading2/3/4` 或 `outlineLvl` | `note`（标题=知识点）；`Heading 1` 只作章节边界 |
| 蓝底框“一句话：…” | 段落底纹 `E8F1FA` | `card(QA)`：Q=“这个知识点的核心结论？”，A=一句话 |
| 琥珀底框“易错：…” | 段落底纹 `FDF3E3` | `card(WHY)`：Q=“这个知识点的易错点？”，A=易错内容 |
| 灰底“校订：…” | 底纹 `F2F2F2` | 附到 note 的 `content_md`，不单独成卡 |
| 要点 bullets | `List Bullet` / `numId` | 生成 1 张 `QA`（“要点有哪些？”） |
| 表格 | `XWPFTable` | 每个知识点最多 2 张，问题里带表头，长表截断 1200 字 |
| “来源：OS_x pXX” | 文本前缀 | 写入 `note.source`，便于回查 |

> 解析时会跳过“来源覆盖审计 / 课件定位 / 本章范围”等元信息小节，以及“第 N 章 …”这类导航条目，避免生成无效卡。

### 8.2 去重与更新

- 以 `hash(标题)` 作为 note 的业务键；
- 重复导入时**跳过**已存在的知识点，不覆盖已有复习历史；需要更新时先删旧 note 再导入；
- 导入时按章建立子卡组（`第 1 章`…`附录 A`）；标题以 `实验03` 这类前缀开头时，归入 `实验 3` 子卡组；每日队列按卡组轮转，形成章节交错；
- 导入任务记录 `total_notes / created_cards / skipped`。

### 8.3 生成策略

- 每个知识点至少 1 张“核心结论”卡；
- 有易错框 → 1 张“易错”卡；
- 有对比表 → 1 张“对比”卡（Q：“A 和 B 的区别？”）；
- 长 bullet 不直接切成多张卡，避免“卡片爆炸”；先保骨架，再手动拆分。

---

## 9. 非功能性设计

- **性能**：单用户 1 万张卡、10 万条 review_log 内，队列查询走覆盖索引，P95 < 100ms；
- **幂等**：评分接口用 `client_req_id` 唯一约束，防重复提交；
- **并发**：`card.version` 乐观锁，防多端同时评分；
- **安全**：密码 BCrypt；JWT 过期 + 刷新；接口按 `user_id` 隔离；
- **备份**：MySQL 每日 `mysqldump`，保留 7 天；
- **可观测**：MDC traceId、慢 SQL 日志、Actuator health；
- **测试**：FSRS 用固定样例做黄金测试；导入用真实手册做回归。

---

## 10. 迭代计划

### MVP（先能用）

1. 用户/设置（单用户可先固定 user_id）
2. deck/note/card CRUD
3. docx 导入（先支持现有手册结构）
4. FSRS v4.5 + 每日队列 + 四键评分
5. 基础统计（今日、保持率、到期预测）

### v1（好用）

6. 标签、搜索、按章刷/交错开关
7. 热力图、leeches、撤销
8. PWA/手机适配
9. 导入预览与冲突处理

### v2（更聪明）

10. FSRS 参数优化（1000+ 复习后）
11. 填空/选择题/图片遮挡
12. “为什么/怎么用”卡片模板
13. 考试倒计时冲刺模式（按剩余天数反推每日新卡量）

---

## 11. 已确认的设计决策（2026-11-13）

1. **单用户**：固定 `user_id = 1`，不做注册/登录/权限；表结构保留 `user_id`，以后要多用户不用改表。
2. **自动导入**：第一版就做 docx 解析，直接吃现有《操作系统原理-记忆手册.docx》的结构（H3 + 蓝框 + 琥珀框 + 来源）。
3. **算法**：FSRS v4.5，默认 17 个权重；`ReviewScheduler` 接口预留，以后可换 v6。
4. **前端**：完整前端，Vue 3 + Vite + vue-router + axios，手写 CSS，不依赖重型 UI 库；包含今日复习、卡片管理、方法实验室、导入、统计、设置六个页面。
5. **方法实验室**：每周日 20:00 自动生成下周 3 个方法的草稿；每天 1–5 分；周末按周均分给保留/淘汰建议，用户确认。

### 11.1 单用户下的简化

- 不做 Spring Security / JWT；所有请求默认 `user_id = 1`。
- 仍保留 `sys_user` 表与设置项，便于以后加登录。
- `GET /api/v1/auth/me` 直接返回固定用户，前端不需要登录页。

### 11.2 MVP 验收标准

- 能上传现有 docx，生成 ≥ 150 个知识点、≥ 200 张卡片；
- 每日队列能按 FSRS 到期日排期，四键评分后正确更新 `stability/difficulty/due_date`；
- 刷新页面后复习进度与统计不丢；
- `mvn test` 通过（FSRS 黄金样例 + 导入解析样例）；
- `npm run build` 通过，前端六个页面可用。


---

## 参考文献

1. Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1), 4–58. https://doi.org/10.1177/1529100612453266
2. Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science, 17*(3), 249–255. https://doi.org/10.1111/j.1467-9280.2006.01693.x
3. Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354
4. Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science, 35*, 481–498. https://doi.org/10.1007/s11251-007-9015-8
5. Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. *Science, 331*(6018), 772–775. https://doi.org/10.1126/science.1199327
6. Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In *Psychology and the Real World* (pp. 56–64). Worth Publishers.
7. FSRS 算法文档（v4.5）：https://github.com/SqueakyRobot/fsrs/blob/main/docs/ALGORITHM.md
8. FSRS for Anki Wiki：https://github.com/open-spaced-repetition/fsrs4anki/wiki
9. RemNote: Spaced Repetition Algorithms: FSRS vs SM-2 vs SM-18：https://www.remnote.com/blog/spaced-repetition-algorithms

---

## 绘图方案

六类图（用例图、平台架构图、领域关系图、ER 图、核心类图、时序图）均为 Python 代码生成，不使用 Mermaid / Visio / Draw.io。工具链、四个绘图原语、生成命令和自检流程见 [绘图方案](绘图方案.md)。
