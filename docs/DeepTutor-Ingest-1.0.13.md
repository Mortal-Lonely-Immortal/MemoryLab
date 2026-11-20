# 文件夹资料导入 / AI 自动归档

**入口：** LIBRARY → INGEST 资料导入  
**顶部入口：** DOCS 导入（点击直接进入本页）  
**旧教程页：** 本页的 OPEN DOCS 教程文档  
**版本：** P5 1.0.13

## 怎么用

1. 打开 `LIBRARY 资料`，点 `INGEST 资料导入`。
2. 点 `SELECT FOLDER 选择文件夹`，从 Windows 文件管理器选择文件夹。
   - 支持递归扫描子文件夹。
   - 也支持 `SELECT FILES 选择文件`、拖拽文件。
3. 点 `AI CLASSIFY 自动分类`。
   - AI 会读取文件名、相对路径、类型，Markdown/TXT 还会读取前 1200 字。
   - 输出 3–8 个主题分类。
   - 每个文件的下拉框可以手动改分类。
4. 点 `IMPORT / ARCHIVE 归档`。
   - 为每个分类创建/复用 Knowledge 知识库和 Notebook 笔记本。
   - 文件上传到知识库。
   - 每个文件写一条 Notebook 记录。
   - 勾选 `同步到 DOCS 教程` 时，PDF/Word/PPT 同时上传到 DOCS 文档页。

## 支持格式

`pdf` `doc` `docx` `md` `markdown` `txt` `ppt` `pptx` `epub`

跳过：

- 隐藏文件、`~$` 临时文件、`.tmp`
- `.git`、`node_modules`、`__MACOSX`、`.cache`
- 超过 200MB 的单文件
- 一次超过 200 个文件

## 归档结果

```text
分类 → Knowledge 知识库（同名，复用）
     → Notebook 笔记本（同名，复用）
     → 每个文件一条记录
     → DOCS 教程文档（可选）
```

知识库文件上传后由 DeepTutor 在后台解析/索引。索引状态可在 `LIBRARY → KNOWLEDGE → OPEN` 查看。

## 重要：Embedding 未配置

如果系统没有配置 Embedding：

- 文件仍会出现在 Knowledge 知识库里；
- Notebook 记录仍会创建；
- DOCS 同步仍会执行；
- 但**不会建立向量索引**，知识库状态会显示错误，AI 检索无法使用。

页面会显示：

> EMBEDDING 未配置：文件仍会存入 Knowledge，但不会建立向量索引。

处理方式：

1. 到 `CONFIG` / DeepTutor 设置中配置 Embedding 模型。
2. 打开对应知识库详情，点 `REINDEX 重建索引`。

## 实现说明

- 目录选择优先使用浏览器 `showDirectoryPicker()`；不可用时回退到 `<input webkitdirectory>`。
- AI 分类通过 DeepTutor WebSocket `start_turn`（`capability=chat`）完成；失败时回退到本地关键词规则。
- 知识库：`POST /api/knowledge-bases`、`POST /api/knowledge-bases/{name}/upload`
- 笔记：`POST /api/notebooks`、`POST /api/notebooks/actions/add-record`
- 文档：`POST /api/documents/upload`
- 分类会话在完成后会删除，不占用 Chat 历史。

## 测试

- 混合文件夹：Java 基础.md、计算机网络笔记.md、线性代数公式.txt、操作系统.pdf
- AI 分类：Java 后端 / 计算机网络 / 数学 / 操作系统
- 归档：4 个文件成功；4 个知识库、4 个笔记本、4 条记录；PDF 同步 DOCS。
- 嵌入未配置时显示“已归档（未索引）”，不误报为完整索引成功。
