# Memory Lab 新手使用手册

版本：1.0.13  
适用：Windows 10 / 11 64 位便携版  
更新：2026-11-19

---

## 三分钟快速开始

1. 下载完整包 `MemoryLab-Portable-1.0.13-win64.zip`
2. 解压到短路径，例如 `D:\MemoryLab`
3. 双击 `MemoryLab.exe`
4. 等页面打开，进入 `CONFIG` 填一次 API Key
5. 点 `SAVE TO ALL`，去 `AI 助手 → Tutor` 发一句“你好”

第一次启动需要 30–90 秒；页面空白时等 5 秒刷新。

没有 API Key 也能用卡片复习、教材上传、OCR 和图文教程，只有 AI 功能需要 Key。

---

## 1. Memory Lab 是什么

Memory Lab 是一个本地优先的学习工具，把记忆卡、教材和 AI 导师放在一个便携文件夹里。

| 模块 | 用途 |
|---|---|
| REVIEW 复习 | 按 FSRS 间隔重复算法复习 |
| DOCS 文档 | 上传 PDF/Word/PPT，提取图文，生成教程 |
| TEACH 教学 | 讲解、提纲、学习材料 |
| CARDS 卡片 | 浏览、搜索、编辑、删除卡片 |
| STATS 统计 | 复习量、正确率、连续学习 |
| LAB 方法 | 调整学习/复习方法 |
| CONFIG 设置 | API Key、复习参数、版本 |
| STUDY / LIBRARY / PLAN / AI | DeepTutor 全科功能 |

它不是网盘，也不要求登录。数据默认在软件目录的 `data` 里。

---

## 2. 电脑要求与下载

- Windows 10/11 64 位
- Microsoft Edge
- 4GB 内存起，建议 8GB
- 至少 3GB 可用磁盘
- AI 需要联网；卡片和 OCR 可离线

下载完整包：

`MemoryLab-Portable-1.0.13-win64.zip`

下载页：<https://github.com/Mortal-Lonely-Immortal/MemoryLab/releases/tag/v1.0.13>

SHA-256：

`5425EF2650AC2224ADEDB06A6500C8A2C783A36187B666A15C3E59373CBFA8DF`

新用户不要下载补丁包。

---

## 3. 第一次启动

解压到短路径，例如：

`D:\MemoryLab\`

只双击：

`MemoryLab.exe`

如果出现“已保护你的电脑”：

1. 点“更多信息”
2. 点“仍要运行”
3. 仍被拦截时：右键 zip → 属性 → 解除锁定 → 重新解压

启动器会打开一个 Edge 应用窗口。关闭启动器即可停止服务；残留进程时运行 `stop.cmd`。

不要删除 `data`，不要在运行时把整个目录放进 OneDrive 同步。

---

## 4. 配置 API Key

需要三样：

| 字段 | 示例 | 说明 |
|---|---|---|
| API Key | 服务商 Key | 不是 GitHub 密码 |
| Base URL | `https://…/v1` | 以服务商文档为准 |
| Model | `deepseek-v4.1-flash` | 支持 Chat Completions |

步骤：

1. `CONFIG 设置`
2. `ONE API KEY 统一模型`
3. 填 Key、Base URL、Model
4. `SAVE TO ALL 保存并同步`
5. `AI 助手 → Tutor` 发一句“你好”测试

一个 Key 会同步到 Tutor、教材简化、DeepTutor。OpenCode 网关需要的会话头由程序自动附加。

常见错误：

| 提示 | 处理 |
|---|---|
| 401 Invalid credential | 重新粘贴 Key；确认 1.0.13；再保存 |
| No active LLM model | 使用 1.0.13；重启；检查启动脚本 |
| model not found | 改成服务商控制台的准确模型 ID |

---

## 5. 主界面

第一行：REVIEW / DOCS / TEACH / CARDS / STATS / LAB / CONFIG

第二行：

| 入口 | 内容 |
|---|---|
| STUDY 学习 | Overview、Learning |
| LIBRARY 资料 | Knowledge、Notebook、Memory |
| PLAN 计划 | Calendar、Tasks |
| AI 助手 | Tutor、Partners、Research、Visualize |

鼠标移到左上角 MEMORY LAB 会翻到另一主题；点击切换黑色 P5 / 白色 P3。

---

## 6. 开始复习

1. 点 `REVIEW 复习`
2. 看正面，回想答案
3. 点显示答案
4. 按实际掌握程度选 Again / Hard / Good / Easy
5. 完成当天队列

每日新卡/复习数量在 `CONFIG → REVIEW SETTINGS` 调整；目标保持率默认 90%。

卡片编辑和删除在 `CARDS 卡片`。删除前先备份 `data`。

---

## 7. 上传教材与扫描版 PDF

支持 PDF、DOCX、PPTX。PDF 可以是文字版，也可以是整页扫描图。

1. `DOCS 文档`
2. 上传文件
3. 等待提取；扫描版会先 OCR
4. 打开教程检查章节和文字
5. 需要时做 AI 简化或导出 DOCX/HTML

1.0.13 内置 RapidOCR（来自 Umi-OCR）。某页没有文字层时，会自动渲染并识别中文/英文，再按“第X章 / 第X节 / Chapter N”分章。

| 情况 | 结果 |
|---|---|
| 清晰印刷体扫描 | 通常可识别并分章 |
| 手机拍照、倾斜、阴影 | 识别率下降，建议先纠偏 |
| 手写笔记 | 识别率有限 |
| 复杂公式/表格 | 文字尽量识别，公式表格保留原图 |

OCR 在本机运行；AI 简化才会把文字发给模型服务。

---

## 8. AI 导师与全科

`AI 助手 → Tutor` 支持：

- CHAT：普通问答
- EXPLAIN：概念拆解
- SOLVE：题目求解
- RESEARCH：带来源研究
- VISUALIZE：图表/关系图

其他：

- `LIBRARY → Knowledge`：知识库、上传、索引
- `STUDY → Learning`：Mastery Path、Books、Reading
- `PLAN`：日历、任务
- `AI 助手 → Research / Visualize`：研究和可视化模式

---

## 9. 伙伴、知识库、笔记

伙伴是带独立人格、模型、工具、知识库和记忆的常驻智能体。

1. `AI 助手 → Partners`
2. `NEW PARTNER`
3. `EDIT` 设置
4. 编辑 SOUL、模型、工具白名单、知识库、IM 频道
5. `SAVE ALL`

密钥字段留空表示保留原值。不要把带 Key 的截图发给别人。

其他：

- `LIBRARY → Notebook`：按主题记笔记
- `LIBRARY → Memory`：查看 L1/L2/L3 记忆

---

## 10. 数据、备份与迁移

| 路径 | 内容 |
|---|---|
| `data\db` | 卡片、复习记录、设置 |
| `data\docs` | 教材、教程、Tutor 对话 |
| `data\deeptutor` | DeepTutor 知识库、聊天、伙伴、模型配置 |
| `data\tmp` | 临时文件，可删 |

备份：

1. 关闭 Memory Lab
2. 复制整个 `data` 到移动硬盘或另一个目录
3. 重要节点再复制整个软件文件夹

换电脑：

1. 新电脑解压同版本完整包
2. 把旧电脑 `data` 覆盖到新包 `data`
3. 启动检查卡片和文档

不要只复制 `MemoryLab.exe`，那只是一个启动器。

---

## 11. 更新

| 情况 | 文件 |
|---|---|
| 新用户 | `MemoryLab-Portable-1.0.13-win64.zip` |
| 已有旧版 | `MemoryLab-OCR-Docs-Update-1.0.13.zip` |

完整包更新：

1. 关闭旧版
2. 解压新版到新文件夹
3. 把旧 `data` 复制到新版 `data`
4. 启动检查

不要用空 `data` 覆盖旧 `data`。

补丁更新：

1. 关闭旧版，确认没有 MemoryLab / MemoryLabDocs / nginx / java
2. 解压补丁
3. 把 `app`、`docs`、`nginx`、`deep-tutor`、`MemoryLab.exe` 覆盖到旧包根目录
4. 启动确认 V1.0.13

补丁不含 `data`。

---

## 12. 常见问题

| 现象 | 处理 |
|---|---|
| Windows 提示已保护电脑 | 更多信息 → 仍要运行；解除 zip 锁定 |
| 页面空白 | 等 5 秒刷新；关闭重开；检查 18080 |
| 401 Invalid credential | 重新填 Key，SAVE TO ALL；使用 1.0.13 |
| No active LLM model | 升级 1.0.13/补丁；重启 |
| AI 一直转圈 | 换网络；检查 Base URL |
| 扫描 PDF 没文字 | 等 OCR；换清晰扫描；确认 1.0.13 |
| OCR 很慢 | 一次传一章；关闭大型程序 |
| 上传失败 | 解除 PDF 密码；换短路径 |
| 卡片不见了 | 检查启动目录；从 data 备份恢复 |
| 端口占用 | 关闭残留进程；重启电脑 |

---

## 13. 卸载与隐私

卸载：

1. 关闭 Memory Lab，必要时 `stop.cmd`
2. 备份 `data`
3. 删除整个软件文件夹

没有注册表卸载项或系统服务。

隐私：

- 卡片、教材、OCR 默认本机处理
- AI 对话/简化会把文字发给模型服务商
- API Key 存在本机，不要把整个软件文件夹连同 Key 发给别人
- 分享截图前遮住 Key、Base URL、聊天内容和个人路径

---

## 附：文件结构

```text
MemoryLab\
├─ MemoryLab.exe        ← 只启动这个
├─ app\                 前端页面
├─ backend\             后端
├─ docs\                文档 / OCR
├─ deep-tutor\          DeepTutor
├─ nginx\               本地网页
├─ runtime\             Java 运行环境
├─ data\                ← 你的数据，重点备份
└─ stop.cmd             停止服务
```

遇到问题先看：

- 右上角版本是否 V1.0.13
- CONFIG 的 Key/Base/Model 是否完整
- `data` 是否还在
- `portable.log` 最后几行
