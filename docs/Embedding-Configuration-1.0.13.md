# Embedding 向量模型配置

**入口：** CONFIG 设置 → EMBEDDING 向量模型 · 知识库搜索  
**从导入页进入：** LIBRARY → INGEST → 红色提示里的 `CONFIGURE 配置`

## 这个设置是干什么的

```text
聊天模型（DeepSeek）= 写答案
Embedding 模型      = 把书变成可搜索的目录
```

没有 Embedding：

- 文件可以进 Knowledge 知识库
- Notebook 记录可以创建
- DOCS 可以同步
- 但知识库没有向量索引，AI 无法做语义检索/RAG

配置 Embedding 后，点击 `SAVE + TEST + REBUILD 一键保存并重建`：

1. 保存 Base URL / 模型 / Key / 维度
2. 测试连接
3. 对所有知识库执行 REINDEX
4. 之后 Chat 就能检索知识库内容

## 字段说明

| 字段 | 含义 |
|---|---|
| Base URL | 服务的完整接口地址，通常以 `/embeddings` 结尾 |
| Model | Embedding 模型名，不是聊天模型名 |
| API Key | 这个服务的密钥；本地 Ollama 可留空 |
| Dimension | 向量维度；选推荐服务会自动填好 |

## 推荐服务

| 服务 | 类型 | 默认模型 | 维度 | 说明 |
|---|---|---|---|---|
| SiliconFlow | 国内 API | `BAAI/bge-m3` | 1024 | 国内访问方便，通常有免费额度，以官网为准 |
| Jina AI | 海外 API | `jina-embeddings-v3` | 1024 | 多语言，有免费额度 |
| OpenAI | 海外 API | `text-embedding-3-small` | 1536 | 稳定，按量付费 |
| 智谱 BigModel | 国内 API | `embedding-3` | 2048 | 国内 API，价格/额度以官网为准 |
| Ollama | 本地免费 | `bge-m3` | 1024 | 先安装 Ollama，执行 `ollama pull bge-m3` |
| LM Studio | 本地免费 | `nomic-embed-text-v1.5` | 768 | 在 LM Studio 加载模型并启动本地服务 |
| 自定义 | OpenAI 兼容 | 自填 | 自填 | 任何支持 `POST /embeddings` 的服务 |

## 为什么 DeepSeek 不在这里

DeepSeek 官方 API 提供 Chat / Responses / Messages / FIM / Models / Balance / Files / Search / Fetch / OCR / TTS / ASR，**没有 `/embeddings` 接口**。

“OpenAI 兼容”只表示 Chat 协议兼容，不等于所有 OpenAI 端点都实现了。DeepSeek 聊天 Key 不能当 Embedding Key 用。

## 测试与限制

- 保存后点击 `TEST 测试连接` 会实际请求一次 Embedding 接口。
- `REINDEX ALL` 会对所有知识库逐个调用重建接口；空知识库可能失败，属于正常。
- 修改 Embedding 模型或维度后，旧索引需要重建，否则签名不匹配。
- 当前 UI 的向量维度来自推荐预设；自定义模型需要自己填写正确维度。


## SSL 证书验证失败

如果出现：

```text
[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed:
unable to get local issuer certificate
```

说明系统代理/安全软件替换了 HTTPS 证书，Windows 信任它，但 Python 自带的 certifi 不信任。

便携包已加入 `truststore` 启动引导，改用 Windows 证书库：

- `deep-tutor/truststore_bootstrap/sitecustomize.py`
- `deep-tutor/start-deeptutor.cmd` 设置 `PYTHONPATH`
- 同时写入 `.venv/Lib/site-packages/sitecustomize.py`

**修改后必须完全退出 Memory Lab 再重新打开**，只刷新页面不够，因为 DeepTutor 后端进程需要重启。

如果重启后仍失败，检查代理软件是否使用了自己的根证书；需要把该根证书安装到 Windows“受信任的根证书颁发机构”，或暂时关闭 HTTPS 扫描。
