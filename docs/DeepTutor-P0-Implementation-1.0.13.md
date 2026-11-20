# DeepTutor P0 功能补齐记录

**版本：** Memory Lab P5 1.0.13（本地包已更新）  
**日期：** 2026-11-20  
**范围：** 只补 P0 的 8 项，不包含 Co-Writer、Partner Groups、Learning Space、Watching 等 P1 功能。

## 1. 已完成

| 功能 | 入口 | 当前能力 | 测试 |
|---|---|---|---|
| Chat 历史 | AI 助手 → Tutor → HISTORY | 列表、打开、重命名、归档删除、回收站恢复 | 通过 |
| Save to Notebook | Chat / Partner / Book / Reading / Mastery | 选择笔记本、标题、内容，保存记录 | 通过 |
| Books | STUDY → BOOKS | 新建提案、确认、生成目录、编译、章节/页面阅读 | 通过 |
| Reading | STUDY → READING | 新建工作区、上传材料、加入材料、材料阅读、阅读会话 | 通过 |
| Mastery | STUDY → LEARNING → OPEN | 路径详情、模块、会话列表、STUDY 进入 `mastery_path` 对话 | 通过 |
| Partner Chat | AI 助手 → PARTNERS → CHAT | 伙伴独立对话、保存回答到 Notebook | 通过 |
| Practice | STUDY → PRACTICE | 新建题目、题库列表、查看答案、检查、AGAIN/GOOD/EASY 复习 | 通过 |
| Knowledge 详情 | LIBRARY → KNOWLEDGE → OPEN | 文档数、RAG 状态、索引状态、文档预览、重建索引 | 通过 |

## 2. 关键实现

- `p5/deeptutor.js`
  - 会话 API：`/api/sessions`、PATCH organization `archived`、回收站过滤
  - Notebook：`/api/notebooks/actions/add-record`
  - Books：`/api/books`、`confirm-proposal`、`confirm-spine`、`pages`
  - Reading：`/api/reading/workspaces`、`/materials`、`/units/1`
  - Mastery：`/api/mastery-paths/topics/{id}`、WS `capability=mastery_path` + `mastery_path_id`
  - Partner：`/api/partners/{id}/chat`
  - Practice：`/api/question-notebook/entries/upsert`、`/practice/questions/{id}`、`/review`
  - Knowledge：`/api/knowledge-bases/{name}`、`/files`、`/reindex`
- `p5/deeptutor.css`
  - 新增消息保存按钮、书籍阅读、阅读材料、练习统计、伙伴聊天、知识库详情样式
- 包内同步
  - `desktop/dist/MemoryLab-Portable-1.0.4-win64/app/`
  - `desktop/dist/MemoryLab-Portable-1.0.13-win64/app/`

## 3. 已知限制

1. **Books 生成较慢**：提案/目录由 LLM 生成，可能超过 2 分钟；UI 会等待，不要重复点击。
2. **Reading 材料阅读**目前取第一个 unit，复杂 PDF/EPUB 的目录跳转还未做。
3. **Mastery 详情**能进入 `mastery_path` 学习对话，但原版的完整 Study 侧栏/评分卡还没移植。
4. **Practice** 是单题模式，未接分类、批量导入、AI 判分；检查接口在部分题目返回 `null`，UI 用“对照答案”兜底。
5. **Knowledge 文件接口在空库时可能 500**；详情页已从 KB 元数据兜底显示状态。
6. **Notebook 保存**目前保存摘要片段，不做原版的 LLM 自动摘要/多消息选择。
7. **Chat 删除**使用原版 `archived` 字段归档，不做物理删除；回收站可恢复。
8. **Partner Chat** 依赖当前模型配置；模型未配置时会显示请求失败。

## 4. 下一步 P1

- Co-Writer
- Partner Groups
- Books 结构编辑/多 block 渲染
- Reading 目录/标注/生词
- Mastery 完整 Study 评分卡
- Practice 分类/导入/AI 判分
- Memory L1-L3/图谱
- Research/Visualize 专用工作区
