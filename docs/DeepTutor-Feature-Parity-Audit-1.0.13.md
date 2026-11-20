# DeepTutor 原版功能对照审计

> 2026-11-20 更新：审计中的 8 项 P0 已在本地包补齐，详见 `DeepTutor-P0-Implementation-1.0.13.md`。本文保留为补齐前的差异基线。

**对照对象：** DeepTutor 1.7.3（`web/app` 路由 + 后端模块）  
**当前实现：** Memory Lab P5 原生工作台 1.0.13  
**审计日期：** 2026-11-20

---

## 0. 结论

当前 P5 原生工作台是“11 个一级页面”的轻量整合，而原版 DeepTutor 是完整的 20+ 功能面应用。

- **基础可用：** Tutor 对话、Knowledge 基本管理、Notebook 基础记录、Calendar 新建、Task 新建、Partners 配置、Overview 统计
- **部分实现：** Chat 能力模式、Learning 列表、Mastery 新建、Memory 概览、Partner 高级设置
- **只显示列表 / 空壳：** Books、Reading、Watching、Practice、Research、Visualize
- **完全未接：** Co-Writer、Partner Groups、Partner Chat、Learning Space（Personas/Skills/MCP/Agents/Journal/CLI Apps）、Memory 图谱与 L1-L3 详情、Profile/Personalization、Whisper/Handoff
- **本地单用户不需要：** 登录/注册、Admin 用户管理、多用户权限

> 原版大部分能力在后端 API 里已经存在，缺的是 P5 前端页面和交互，不是重写 DeepTutor。

---

## 1. 总览表

| 功能面 | 原版入口 | 当前 P5 | 状态 |
|---|---|---|---|
| 首页 / 通用对话 | `/chat` | AI 助手 → Tutor | 部分 |
| 对话历史与会话管理 | `/chat/[sessionId]`、chat history | 无 | 未接 |
| 能力模式（Question / Solve / Research / Visualize / Quiz / Animator） | Chat 内 capability | Tutor 的 CHAT/EXPLAIN/SOLVE/RESEARCH/VISUALIZE | 部分 |
| 笔记本 | `/notebooks` | Library → Notebook | 部分 |
| 知识库 | `/knowledge-bases`、`/[kbName]` | Library → Knowledge | 部分 |
| 记忆 | `/memory`、`/memory/l1`、`/l2`、`/l3`、`/graph` | Library → Memory | 部分 |
| 个性化学习首页 | `/learning` | Study → Learning | 部分 |
| 掌握路径 | `/learning/mastery`、`/[pathId]`、`sessions` | Study → Learning → NEW PATH | 部分 |
| 学习书 | `/learning/books`、`/[bookId]`、`pages/[pageId]` | Study → Learning → Books 列表 | 未接 |
| 阅读 | `/learning/reading`、`workspace`、`sessions`、`materials`、`folders` | Study → Learning → Reading 列表 | 未接 |
| 视频学习 | `/learning/watching` | 无 | 未接 |
| 练习 / 题库 | `/learning/practice`、`/space/questions` | 无 | 未接 |
| 学习空间 | `/space` | 无 | 未接 |
| Personas | `/space/personas` | 无 | 未接 |
| Skills | `/space/skills` | 无 | 未接 |
| MCP | `/space/mcp` | 无 | 未接 |
| My Agents | `/agents` | 无 | 未接 |
| Learning Journal | `/space/journal` | 无 | 未接 |
| CLI Apps | `/space/cli-apps` | 无 | 未接 |
| 伙伴 | `/partners`、`/partners/new`、`/[partnerId]` | AI 助手 → Partners | 部分 |
| 伙伴群组 | `/partners/groups/new`、`/groups/[groupId]` | 无 | 未接 |
| 伙伴聊天 | `/partners/[partnerId]` | 无 | 未接 |
| Co-Writer | `/co-writer`、`/[docId]` | 无 | 未接 |
| 日历 | `/calendar` | Plan → Calendar | 部分 |
| 任务看板 | `/kanban` | Plan → Tasks | 部分 |
| 设置 | `/settings` | CONFIG（仅模型） | 部分 |
| 个人资料 / 个性化 | `/profile`、`/personalization` | 无 | 未接 |
| 登录 / 注册 / 管理 | `/login`、`/register`、`/admin/users` | 无 | 不适用 |
| Whisper | `/whisper` | 无 | 未接 |
| Session handoff | `/session-handoff`、`/handoff` | 无 | 未接 |

---

## 2. 逐项差异

### 2.1 Chat / Tutor

**原版有：**

- 会话列表、历史、重命名、归档、删除、分支
- 文件附件、图片、PDF、知识库引用
- 选择 persona / partner / agent 作答
- 手选 Notebook / Question Bank / Book 作为上下文
- 能力卡：Question、Solve、Research、Visualize、Quiz、Animator
- 保存到 Notebook
- 分享 / handoff / 导出
- 语音、Whisper
- 活动面板、工具调用轨迹、引用来源

**当前有：**

- 原生 WebSocket 对话
- 五种 capability 模式
- 新建会话
- 消息流
- 无历史、无附件、无 persona 选择、无 Notebook 引用、无保存、无分支

**缺口：**

1. 会话历史列表/恢复/重命名/删除
2. 文件与知识库上下文
3. Persona / Partner / Agent 选择器
4. Save to Notebook
5. 专用 Question / Quiz / Animator / Research 配置卡
6. 引用、工具调用详情
7. 导出/分享

**优先级：高**

---

### 2.2 Notebook 笔记本

**原版有：**

- 从 Chat / Partner / Reading / Mastery / Co-Writer 保存记录
- 保存时选择消息、生成摘要
- 记录类型：solve / question / research / chat / co_writer / tutorbot / reading / video_learning
- 记录编辑、删除、复制、移动
- 导出 Markdown
- 作为 Chat / Book / Partner 的上下文
- 从 Notebook 生成 Book

**当前有：**

- 创建笔记本
- 查看记录列表
- 手工 NEW RECORD
- 删除记录
- 导出 Markdown

**缺口：**

1. 各功能页面的 “SAVE TO NOTEBOOK” 按钮
2. 选择消息/轮次
3. 自动摘要
4. 记录详情/编辑
5. 复制/移动
6. 作为 Chat 上下文
7. 作为 Book 的 `notebook_refs`

**优先级：高（这是 Notebook 原本的核心入口）**

---

### 2.3 Knowledge 知识库

**原版有：**

- 知识库列表、创建
- 知识库详情：文档列表、上传、删除、索引状态
- RAG 配置、模型、分块、检索测试
- 文档解析进度、失败重试
- 在 Chat / Partner / Book 中引用
- GitHub / 网页 / 文件夹等来源

**当前有：**

- 列表、创建、上传、删除
- 只读统计
- 无详情页、无索引状态、无 RAG 配置

**缺口：**

1. KB 详情页
2. 文档列表 + 索引状态 + 失败重试
3. 检索测试
4. 解析/嵌入模型配置
5. Chat 中引用 KB

**优先级：高**

---

### 2.4 Memory 记忆

**原版有：**

- L1 事实、L2 学习状态、L3 画像
- Memory graph 图谱
- 按 surface 查看/编辑/删除
- resolve 引用跳转
- 记忆审计和来源

**当前有：**

- `/api/memory/overview` 的层列表
- 只读数量和状态

**缺口：**

1. L1/L2/L3 详情页
2. 图谱
3. 单条记忆编辑/删除
4. 引用解析
5. 记忆来源审计

**优先级：中**

---

### 2.5 Personalized Learning / Learning

**原版有：**

- Learning hub：Mastery、Books、Reading、Watching、Practice
- New Learning 创建向导
- 学习活动/进度
- 会话挂载到学习记录

**当前有：**

- Learning 列表
- Mastery Path 新建
- Books/Reading 只读列表

**缺口：**

1. Learning hub 完整分类
2. New Learning 创建向导
3. 学习进度
4. 记录与聊天会话关联

**优先级：中高**

---

### 2.6 Mastery Path

**原版有：**

- 目标/来源/模块创建向导
- 路径详情、阶段、进度
- Study session
- 工具 gates、练习、复习
- 与 Notebook / Book 关联

**当前有：**

- 新建 topic（goal）
- 列表

**缺口：**

1. 路径详情
2. 阶段/模块
3. Study session
4. 进度和工具限制
5. 从 Notebook/Book 生成

**优先级：高**

---

### 2.7 Books 学习书

**原版有：**

- 从来源/Notebook/Chat/KB 创建
- 书结构编辑（spine）
- 章节页面
- 多种 block：文本、图、公式、代码、Quiz、闪卡、时间线、概念图、动画、交互
- 阅读进度、书签、笔记
- 重新生成/暂停/恢复
- 分享/只读

**当前有：**

- Books 列表
- `NEW PATH` 不是新建书

**缺口：**

几乎整块未接：创建、结构、页面、block 渲染、阅读进度、编辑/重建。

**优先级：高**

---

### 2.8 Reading 阅读

**原版有：**

- 阅读工作区
- 材料库、文件夹
- 阅读会话
- 选中段落解释、翻译、生词、测验
- 标注/笔记
- 保存到 Notebook
- 阅读进度

**当前有：**

- Reading 列表，空状态

**缺口：**

整块未接。

**优先级：高**

---

### 2.9 Watching 视频学习

**原版有：**

- 视频学习会话
- 字幕/转写、章节、问答、笔记
- 保存到 Notebook

**当前：** 无。

**优先级：中**

---

### 2.10 Practice / Question Bank

**原版有：**

- 题库分类、题目、错题
- 练习会话、判分、解析
- 后续追问
- 保存到 Notebook
- 生成闪卡/复习

**当前：** 无。

**优先级：高**

---

### 2.11 Learning Space

原版 `/space` 下有一整套学习资源管理：

| 功能 | 作用 | 当前 |
|---|---|---|
| Personas | 人格/回答风格 | 未接 |
| Skills | 技能包 | 未接 |
| MCP | 外部工具/服务器 | 未接 |
| My Agents | 接外部 coding agent | 未接 |
| Journal | 学习日志/复盘 | 未接 |
| CLI Apps | 本机 CLI 工具接入 | 未接 |
| Questions | 题库 | 未接 |

**优先级：中高**（Personas/Skills 对回答质量影响大；MCP/Agents 偏高级）

---

### 2.12 Partners 伙伴

**原版有：**

- 伙伴列表、新建、详情
- 每个伙伴独立聊天
- SOUL、模型、工具、知识库、频道
- 频道状态/二维码/重载
- 伙伴历史、链接、分享
- Save to Notebook
- Partner Groups：多伙伴讨论、共享记忆、白板、轮次摘要、工具审批
- 伙伴作为 Chat 的 answerer

**当前有：**

- 列表、新建
- 基础信息
- SOUL、模型、工具白名单、知识库、IM 频道配置
- 删除

**缺口：**

1. 伙伴聊天
2. 伙伴历史/会话
3. 频道 QR/onboarding/状态
4. Partner Groups
5. 群组讨论/共享记忆/白板
6. 伙伴作为 Chat answerer
7. Save to Notebook

**优先级：高（聊天）/中（Groups）**

---

### 2.13 Co-Writer

**原版有：**

- 文档列表、新建、导入 DOCX
- Markdown 编辑器
- AI 改写/续写/润色
- 保存到 Notebook
- 预览/导出

**当前：** 无。

**优先级：中高**

---

### 2.14 Calendar 日历

**原版有：**

- 多日历、事件 CRUD
- 重复事件、提醒、时区
- 任务/学习计划联动
- 拖拽/调整

**当前有：**

- 读取本月事件
- 新建事件
- 无编辑/删除/重复/提醒

**优先级：中**

---

### 2.15 Task Board 任务

**原版有：**

- 看板列、拖拽
- 卡片详情、截止日期、备注
- 与日历/学习联动

**当前有：**

- 读取 TODO/DOING/DONE
- 新建卡片
- 无拖拽/编辑/完成

**优先级：中**

---

### 2.16 Settings / Profile

**原版有：**

- 模型 Provider 目录、测试、模型能力
- 文档解析引擎（MinerU/Docling/MarkItDown/PyMuPDF4LLM 等）
- Embedding、Search、TTS/STT、Image/Video
- UI 主题、语言、字号、侧栏顺序
- 数据导入/导出、诊断
- Profile / Personalization
- 学习进度页

**当前有：**

- 一个 API Key 模型配置
- Memory Lab 自己的复习参数

**缺口：**

1. 文档解析引擎设置（OCR 当前固定本地 RapidOCR）
2. Embedding/Search 配置
3. Provider 测试/模型列表
4. UI/语言
5. 诊断/日志
6. Profile/Personalization
7. 学习进度

**优先级：中高（文档解析/Embedding 影响 RAG）**

---

### 2.17 Auth / Admin / Handoff / Whisper

| 功能 | 当前 | 建议 |
|---|---|---|
| 登录/注册 | 无 | 本地单用户不需要 |
| Admin 用户管理 | 无 | 不需要 |
| 多用户权限 | 无 | 不需要 |
| Session handoff / QR | 无 | 低 |
| Whisper 语音 | 无 | 低 |
| 分享/公开链接 | 无 | 低 |

---

## 3. 按优先级排序

### P0：现在最影响“原版感”的缺口

1. **Chat 会话历史 / 恢复 / 删除**
2. **Save to Notebook** 全链路
3. **Books 创建 + 阅读**
4. **Reading 工作区**
5. **Mastery Path 详情 + Study session**
6. **Partner 聊天**
7. **Practice / Question Bank**
8. **Knowledge 详情 + RAG 状态**

### P1：完整体验

9. Co-Writer
10. Partner Groups
11. Research / Visualize 实际流程（当前只是 Chat 模式）
12. Watching 视频学习
13. Memory L1/L2/L3 + 图谱
14. Task 拖拽/编辑
15. Calendar 编辑/重复
16. Learning Space（Personas / Skills / MCP / Agents / Journal）
17. Settings 文档解析/Embedding
18. Profile/Personalization

### P2：本地版可不做

- 登录 / 注册 / Admin
- 多用户权限
- Session handoff / QR
- Whisper
- 公开分享

---

## 4. 当前页面的“空壳”清单

这些页面看起来有入口，但实际只有列表或占位：

| 页面 | 现状 |
|---|---|
| Study → Learning → Books | 只显示“还没有学习书” |
| Study → Learning → Reading | 只显示“还没有阅读工作区” |
| Library → Memory | 只显示 L2 层状态 |
| AI 助手 → Research | 只显示最近记录 + 跳 Chat 模式 |
| AI 助手 → Visualize | 只显示最近记录 + 跳 Chat 模式 |
| AI 助手 → Partners | 能配置，不能聊天/群组 |
| Plan → Tasks | 能新建，不能拖拽/编辑 |
| Plan → Calendar | 能新建，不能编辑/删除 |
| Library → Notebook | 能手工记录，不能从 Chat/Reading 保存 |

---

## 5. 实施建议

1. **先补 Chat 会话 + Save to Notebook**：这两个一通，Notebook 才有原版意义。
2. **再补 Books / Reading**：这是原版“个性化学习”的主干。
3. **再补 Mastery Path 详情 + Partner Chat**。
4. **Practice / Question Bank** 可独立做，和 Memory Lab 的卡片复习能形成闭环。
5. **Co-Writer / Learning Space** 属于增强功能，放后面。
6. **Auth/Admin/Handoff/Whisper** 本地版可不做。

后端 API 大多已存在；优先做 P5 页面和交互，不需要重写 DeepTutor 服务。
