# 记忆实验室 Memory Lab

一个本地单用户的「教材翻译 + 主动回忆」工作台：

- 上传 PDF / Word / PPT，提取图文，调用 LLM 翻译简化成可读教程；
- 教程按章节一键生成记忆卡，进入 FSRS 间隔重复队列；
- 卡片管理、FSRS 统计、五维自评、学习方法周复盘；
- 黑色 P5 / 白色 P3 双主题；
- **便携版不依赖 Docker / Java / Python，解压双击即可运行**。

## 快速开始（便携版，推荐）

到 GitHub 的 **Releases** 页面下载：

```text
MemoryLab-Portable-1.0.8-win64.zip
```

1. 解压到有写权限的目录（不要放 `Program Files`）；
2. 双击 `MemoryLab.exe`；
3. 首次启动约 10–30 秒，Edge 应用窗口会自动打开；
4. 关闭启动器窗口即停止所有本地服务。

要求：Windows 10/11 x64 + Microsoft Edge（系统自带）。

便携版自带：

```text
runtime/     OpenJDK 17 精简运行时
backend/     Spring Boot + H2 文件数据库
docs/        PyInstaller 打包的文档/导师服务
nginx/       静态页面 + API 反向代理
app/         P5 前端
data/        db / docs / uploads（用户数据，备份这个目录）
```

端口均只监听 `127.0.0.1`：

| 服务 | 端口 |
|---|---|
| 网页 / 反向代理 | `18080` |
| Spring Boot API | `18081` |
| 文档 / 导师服务 | `15000` |

> 便携版 exe 目前没有代码签名。若 Windows 弹出 “Windows 已保护你的电脑”，
> 右键 exe → 属性 → 勾选“解除锁定”，或点“更多信息” → “仍要运行”。

## Docker 开发版

前置：Docker Desktop，Java 17 + Maven。

```powershell
cd backend
mvn -DskipTests package

cd ..
docker compose up -d --build
```

打开 <http://127.0.0.1:8080>。

四个容器：

| 服务 | 端口 | 说明 |
|---|---|---|
| `frontend` | `127.0.0.1:8080:8080` | P5 页面 + Nginx 反向代理 |
| `backend` | `127.0.0.1:8081:8080` | Spring Boot API |
| `docs` | 内部 5000 | 文档翻译 / AI 导师 |
| `mysql` | `127.0.0.1:3307:3306` | Docker 开发版数据库 |

数据卷：`mysql-data`、`docs-data`。

## 页面

| 页面 | 作用 |
|---|---|
| `REVIEW 复习` | FSRS 队列：先回想 → 显示答案 → 忘记/困难/记得/轻松 |
| `DOCS 文档` | 上传 PDF/Word/PPT、提取、翻译简化、阅读教程、生成记忆卡 |
| `TUTOR 导师` | AI 答疑；支持应用内可拖动、可调整大小的置顶浮窗 |
| `CARDS 卡片` | 搜索、卡组/状态筛选、新建/编辑/暂停/删除、分页 |
| `STATS 统计` | 到期/保持率/连续天数、全年热力图、30 天复习量与保持率、到期预测、状态环图、易忘卡、五维星/雷达 |
| `LAB 方法` | 每周学习方法、每日评分、周雷达对比、周复盘 |
| `CONFIG 设置` | 每日新卡/复习上限、目标保持率、LLM API Key / Base URL / Model |

## 架构

便携版：

```text
MemoryLab.exe
  ├─ runtime\bin\java.exe   → backend\memory-app.jar (Spring Boot, H2 file DB, :18081)
  ├─ docs\MemoryLabDocs.exe → Flask 文档/导师服务 (:15000)
  └─ nginx\nginx.exe        → app\ (P5, :18080)
                                ├─ /api/v1/* → :18081
                                └─ /api/*    → :15000
```

Docker 开发版：

```text
浏览器
  └─ P5 前端（Nginx，127.0.0.1:8080）
       ├─ /api/v1/*  → Spring Boot 后端 → MySQL
       └─ /api/*     → Python 文档服务 → SQLite + uploads
```

- **P5 前端**：`p5/index.html`，原生 HTML/CSS/JS + ECharts，单页。
- **记忆后端**：Java 17 + Spring Boot 3.3.5 + MyBatis-Plus + Flyway；FSRS v4.5。
- **便携数据库**：H2 文件库，MySQL 兼容模式；首次启动自动执行 Flyway 迁移。
- **文档服务**：Flask + PyMuPDF + python-docx/python-pptx + LLM。
- **生成卡片的桥**：文档服务把教程章节压成结构化 docx，调用 `/api/v1/import/docx`，归入 `教材翻译` 卡组。

## 黑白双主题

右上角 `WHITE 白 / BLACK 黑` 随时切换，选择保存在本机：

- **BLACK 黑 · P5**：黑底、正红 `#e60012`、米白纸 `#f7f4ee`；预告信卡、Anton/Archivo 剪贴字、斜切纸卡、红色错位阴影与星纹。
- **WHITE 白 · P3**：近白水面 + 蓝 `#1b57ff` / 青 `#35d1e8` / 洋红 `#f0417f`，白色斜切面板、幽灵英文大字、黑色斜体标题。

两套主题共用同一套页面和功能。

## 五维与导师浮窗

- **五维成长**：统计页默认是 P5 黄色五角星（暗基底星 + 5 层刻度 + 金色分面数值星 + 黄底标签），也可切雷达。成长规则沿用 Velvet：初始全为 Lv.1 / 0 点，阈值 40 / 200 / 350 / 500；复习 +知识，挑战 +胆量，生成卡 +灵巧，导师提问 +温柔/魅力，点数保存在本机 `localStorage`。白色主题自动改为深蓝星面/标签。
- **ARCHIVE 3D**：卡片页新增独立三维视图。使用 RhineLabUI 的 archive-cassette GLB、Three.js 和 OrbitControls，渲染 5 列档案盒阵列；点击档案盒后镜头推进、盒体抬起，右侧显示卡片详情。支持拖拽旋转、滚轮缩放、重置和返回列表。模型/视觉来源见 NOTICE。
- **TEACH 教学**：新导航页。支持文件/文件夹选择与拖拽导入、AI 简化资料、本软件阅读器、可调番茄钟、本地音乐文件夹播放和系统媒体键；阅读器与番茄钟在“本应用观看”时展开。
- **资料落点**：原始文件保存在 `data/docs/uploads/`，提取后的文本块存入 `data/docs/tutor.db` 的 `document_blocks`；导师通过 `search_textbook` 检索这些块，简化结果写回 `simplified_text`。
- **音乐**：本地音乐用浏览器 File/ObjectURL 播放，不上传；系统媒体通过 Windows 全局媒体键控制当前播放器，不读取歌单/歌名。
- **learn v7 内置导师**：导师页带 `LEARN 学懂材料` 入口，也支持在输入框输入 `/learn ...`。模型会先定靶子（目标/经验/deadline），再按 skill 砍量、讲解、配图、一页纸复述、5 题检验、记录状态和排复习；参考文件通过 `read_learning_skill_reference` 按需读取。
- **导师浮窗**：导师页右上角 `FLOAT 浮窗` 或右下角常驻 `T 导师` 按钮；支持 Document Picture-in-Picture 的浏览器得到系统置顶小窗，不支持时回退普通窗口或应用内浮层。

## 配置 LLM

打开 `CONFIG 设置`，填写 OpenAI 兼容接口的 API Key / Base URL / Model。

Docker 开发版也可以在同目录 `.env` 中配置：

```env
LLM_API_KEY=sk-...
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
MYSQL_ROOT_PASSWORD=memory_root_pwd
```

没有配置 Key 时，文档仍可提取、阅读、生成卡；只是不会翻译简化或 AI 答疑。

如果你使用 **opencode-go**，配置为：

```text
Base URL: https://opencode.ai/inference/go/openai/v1
Model:    deepseek-v4.1-flash
```

opencode-go 的 Key 以 `oc_sk_` 开头，不是 DeepSeek 官方 Key；不要填 `api.deepseek.com`。

## 教材 → 记忆卡

1. `DOCS 文档` 上传 PDF / Word / PPT；
2. `EXTRACT 提取` 抽文字/图片/公式区域；
3. `SIMPLIFY ALL 全部简化` 或按章节简化（需要 LLM）；
4. `VIEW 查看` 阅读教程；
5. `MAKE CARDS 生成记忆卡` → 自动导入 `教材翻译` 卡组；
6. 去 `REVIEW 复习` 开始 FSRS。

## 从源码构建便携版

前置：Windows、JDK 17、Maven、Python 3.12、PowerShell 7、curl。

```powershell
# 1. 后端
cd backend
mvn -DskipTests package
cd ..

# 2. 文档服务（PyInstaller）
cd docs-service
python -m pip install pyinstaller flask flask-cors PyMuPDF python-docx python-pptx Pillow lxml requests
pyinstaller --noconfirm --onedir --name MemoryLabDocs portable_entry.py
cd ..

# 3. JRE
jlink --add-modules ALL-MODULE-PATH --strip-debug --no-header-files --no-man-pages --compress=2 --output desktop/portable/runtime

# 4. Nginx（下载 Windows 版后解压到 desktop/portable/nginx）
# 5. 复制 p5 到 desktop/portable/app
# 6. 编译启动器
csc /target:winexe /platform:x64 /out:desktop/portable/MemoryLab.exe desktop/win/PortableLauncher.cs
```

完整脚本与目录说明见 `docs/PORTABLE.md`。

## 目录

```text
memory-app/
├── backend/            Spring Boot + MyBatis-Plus + FSRS（H2/MySQL）
├── p5/                 主前端（P5 / P3 双主题）
├── docs-service/       文档 / 导师服务
├── desktop/
│   ├── win/            启动器源码（Docker 版 + 便携版）
│   └── portable/       便携构建产物（不提交）
├── docker-compose.yml
├── docs/               架构说明
└── .github/workflows/  CI
```

## 说明

- 单用户、本机使用，没有登录；所有端口只绑定 `127.0.0.1`。
- 文档服务的 API Key 存在本地 SQLite；这是本地单用户取舍。
- 便携版数据在 `data/`，升级时保留该目录。
- 旧 Vue 前端 `frontend/` 只作历史参考，不再由 compose 使用。

## License

代码 MIT，见 [LICENSE](LICENSE)。第三方组件与视觉素材见 [NOTICE](NOTICE)。

Persona 5 / Persona 3 © ATLUS / SEGA。本项目是非商业 fan project，与 ATLUS/SEGA 无关联。
