"""
大模型(LLM)服务模块
==================
封装与大语言模型API的交互，兼容OpenAI API格式。
支持自定义API Key、Base URL、Model，可在前端设置页面配置。

核心功能：
  - chat(): 底层聊天请求
  - ask_tutor(): AI导师问答（带教学System Prompt）
  - simplify_text(): 教材内容简化翻译
  - generate_exercise(): 生成习题
  - generate_review_summary(): 生成复习摘要
"""
import requests
import json
import secrets
from deeptutor.config import Config
from deeptutor.services.table_formatter import format_tables_in_response
from typing import Optional


class LLMService:
    """
    大模型服务类，封装所有与LLM API的通信。

    使用示例：
        llm = LLMService(api_key="sk-xxx", api_base="https://api.openai.com/v1")
        answer = llm.ask_tutor("什么是微积分？")
    """

    def __init__(self, api_key=None, api_base=None, model=None):
        """
        初始化LLM服务，支持运行时覆盖默认配置。
        优先级：传入参数 > 数据库持久化配置 > Config默认值
        """
        self.api_key = api_key or Config.LLM_API_KEY
        self.api_base = (api_base or Config.LLM_API_BASE).rstrip('/')
        self.model = model or Config.LLM_MODEL
        # OpenCode Go requires a stable session header on every request.
        # Other OpenAI-compatible providers ignore this header.
        self.session_id = "ses_" + secrets.token_hex(16)

        # 尝试从数据库加载持久化的API配置（覆盖Config默认值）
        # 仅当未通过参数显式传入时生效
        try:
            from deeptutor.database import get_setting
            if not api_key:
                db_key = get_setting('llm_api_key')
                if db_key:
                    self.api_key = db_key
            if not api_base:
                db_base = get_setting('llm_api_base')
                if db_base:
                    self.api_base = db_base.rstrip('/')
            if not model:
                db_model = get_setting('llm_model')
                if db_model:
                    self.model = db_model
        except Exception:
            pass  # 数据库尚未初始化时静默跳过

        # ---------- Agent 工具注册 ----------
        # 每个工具的 schema 描述它的名称、用途、参数，LLM 据此决定何时调用
        self._tool_schemas = [
            {
                "type": "function",
                "function": {
                    "name": "search_textbook",
                    "description": "搜索已上传教材中与关键词相关的内容，返回原文和简化后的段落。适合在学生问'教材里怎么说的'时调用。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "keyword": {
                                "type": "string",
                                "description": "搜索关键词，可以是术语、概念或问题主题"
                            }
                        },
                        "required": ["keyword"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_study_progress",
                    "description": "查询学生对某个主题/技能的学习进度，包括段位、进度百分比、已学时长。适合在学生问'我学了多少'或需要个性化建议时调用。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "topic": {
                                "type": "string",
                                "description": "要查询的主题名称，如'计算机组成原理'或某节课标题"
                            }
                        },
                        "required": ["topic"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_user_skills",
                    "description": "列出学生已上传并学习的所有课程/书籍及其进度。适合在学生问'我有哪些课'或需要选课时调用。",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            }
        ]
        # 工具名 → 实际函数的映射表，_execute_tool 用它来分发调用
        self._tool_map = {
            "search_textbook": self._search_textbook,
            "get_study_progress": self._get_study_progress,
            "get_user_skills": self._get_user_skills,
        }

    def _headers(self):
        """构建API请求头，包含认证信息和内容类型"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "x-opencode-session": self.session_id
        }

    # ========== Agent 工具函数 ==========

    def _search_textbook(self, keyword: str) -> str:
        """在已上传教材的 document_blocks 中全文搜索关键词，返回匹配段落"""
        try:
            from deeptutor.database import get_db
            conn = get_db()
            rows = conn.execute(
                """SELECT d.original_name, db.original_text, db.simplified_text, db.chapter_title
                   FROM document_blocks db
                   JOIN documents d ON db.document_id = d.id
                   WHERE db.original_text LIKE ? OR db.simplified_text LIKE ?
                   LIMIT 8""",
                (f"%{keyword}%", f"%{keyword}%")
            ).fetchall()
            conn.close()

            if not rows:
                return f"未在已上传的教材中找到与「{keyword}」相关的内容。可以建议学生上传相关教材，或根据通用知识回答。"

            results = []
            for r in rows:
                chapter = r["chapter_title"] or "未分类"
                text = r["simplified_text"] or r["original_text"]
                # 截取关键词附近的内容（最多 300 字）
                snippet = text[:300] + ("..." if len(text or "") > 300 else "")
                results.append(
                    f"【教材：{r['original_name']}】【章节：{chapter}】\n{snippet}"
                )
            return "\n\n---\n".join(results)
        except Exception as e:
            return f"搜索教材时出错：{str(e)}"

    def _get_study_progress(self, topic: str) -> str:
        """查询学生对某个主题的学习进度"""
        try:
            from deeptutor.database import get_db
            conn = get_db()
            row = conn.execute(
                """SELECT s.name, s.progress, s.rank, s.category,
                          COALESCE(SUM(ss.duration_minutes), 0) as total_minutes
                   FROM skills s
                   LEFT JOIN study_sessions ss ON s.id = ss.skill_id
                   WHERE s.name LIKE ?
                   GROUP BY s.id
                   LIMIT 1""",
                (f"%{topic}%",)
            ).fetchone()
            conn.close()

            if not row:
                return f"未找到与「{topic}」相关的技能记录。学生可能尚未上传对应教材，或教材名与查询不匹配。"

            return (
                f"技能：{row['name']}（{row['category']}）\n"
                f"进度：{row['progress']:.1f}%\n"
                f"段位：{row['rank']}\n"
                f"累计学习：{row['total_minutes']} 分钟"
            )
        except Exception as e:
            return f"查询学习进度时出错：{str(e)}"

    def _get_user_skills(self) -> str:
        """列出用户所有技能及进度"""
        try:
            from deeptutor.database import get_db
            conn = get_db()
            rows = conn.execute(
                """SELECT name, progress, rank, category,
                          COALESCE((SELECT SUM(duration_minutes) FROM study_sessions
                           WHERE skill_id = s.id), 0) as total_minutes
                   FROM skills s
                   ORDER BY progress DESC"""
            ).fetchall()
            conn.close()

            if not rows:
                return "学生尚未添加任何课程/技能。请建议学生先去「文档」页面上传教材。"

            lines = []
            for r in rows:
                lines.append(
                    f"- {r['name']}：{r['rank']}（{r['progress']:.0f}%），"
                    f"已学 {r['total_minutes']} 分钟，类型：{r['category']}"
                )
            return "学生当前的学习进度：\n" + "\n".join(lines)
        except Exception as e:
            return f"查询技能列表时出错：{str(e)}"

    def _execute_tool(self, name: str, arguments: dict) -> str:
        """工具调度器：根据名称调用对应的工具函数，返回字符串结果"""
        func = self._tool_map.get(name)
        if not func:
            return f"未知工具：{name}"
        try:
            return func(**arguments)
        except Exception as e:
            return f"工具 {name} 执行失败：{str(e)}"

    # ========== 底层 API 调用 ==========

    def chat(self, messages, temperature=0.7, max_tokens=2048):
        """
        底层聊天请求方法，发送messages到LLM并返回响应文本。

        参数：
            messages: 标准OpenAI格式的消息列表 [{"role":"...", "content":"..."}]
            temperature: 生成随机性 0-1，越高越有创意
            max_tokens: 最大回复token数
        返回：
            LLM的回复文本，失败时返回错误描述字符串
        """
        if not self.api_key:
            return "请先在设置中配置API密钥。"

        url = f"{self.api_base}/chat/completions"
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            resp = requests.post(url, headers=self._headers(), json=payload, timeout=60)
            data = resp.json()
            if "choices" in data:
                raw = data["choices"][0]["message"]["content"]
                return format_tables_in_response(raw)
            return f"API错误: {data.get('error', {}).get('message', str(data))}"
        except requests.exceptions.Timeout:
            return "请求超时，请检查网络或API服务状态。"
        except Exception as e:
            return f"请求失败: {str(e)}"

    def chat_with_tools(self, messages, temperature=0.7, max_tokens=2048,
                        max_iterations=8):
        """
        Agent 循环：发送 messages + tools 到 LLM，LLM 自主决定调用哪些工具。

        循环逻辑：
          1. 发送 messages + tool schemas 到 LLM
          2. 如果 LLM 返回文本 → 循环结束，返回文本
          3. 如果 LLM 返回 tool_calls → 执行工具 → 结果追加到 messages → 回到步骤 1

        参数：
            messages: 标准 OpenAI 格式消息列表
            temperature: 生成随机性
            max_tokens: 每次 LLM 调用的最大 token 数
            max_iterations: 最大循环次数（防止死循环或超额消耗）
        """
        if not self.api_key:
            return "请先在设置中配置API密钥。"

        url = f"{self.api_base}/chat/completions"

        for iteration in range(max_iterations):
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "tools": self._tool_schemas,
                "tool_choice": "auto"  # LLM 自主决定调不调工具、调哪个
            }

            try:
                resp = requests.post(url, headers=self._headers(),
                                    json=payload, timeout=60)
                data = resp.json()
            except requests.exceptions.Timeout:
                return "请求超时，请检查网络或API服务状态。"
            except Exception as e:
                return f"请求失败: {str(e)}"

            if "choices" not in data:
                return f"API错误: {data.get('error', {}).get('message', str(data))}"

            msg = data["choices"][0]["message"]

            # LLM 返回了 tool_calls → 执行工具，把结果追加到历史，继续循环
            if msg.get("tool_calls"):
                # 第一步：把 LLM 的 assistant 消息（含 tool_calls）加入历史
                messages.append({
                    "role": "assistant",
                    "content": msg.get("content") or "",
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["function"]["name"],
                                "arguments": tc["function"]["arguments"]
                            }
                        }
                        for tc in msg["tool_calls"]
                    ]
                })

                # 第二步：逐个执行工具，每个工具结果以 tool 角色追加
                for tc in msg["tool_calls"]:
                    import json
                    tool_name = tc["function"]["name"]
                    try:
                        args = json.loads(tc["function"]["arguments"])
                    except json.JSONDecodeError:
                        args = {}
                    result = self._execute_tool(tool_name, args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result
                    })

                # 第三步：循环继续，让 LLM 审视工具结果并决定下一步
                continue

            # LLM 返回纯文本（无 tool_calls）→ 结束循环
            raw = msg.get("content", "")
            return format_tables_in_response(raw)

        return "抱歉，处理您的问题时循环次数过多，请简化问题后重试。"

    def ask_tutor(self, question, chat_history=None):
        """
        AI导师模式：以专业耐心的导师身份回答学生问题。

        System Prompt设计要点：
          1. 简单易懂的语言
          2. 复杂概念先概述再深入
          3. 举例说明
          4. 引导性提问鼓励思考
          5. 感知困惑时主动降级讲解

        参数：
            question: 学生的问题文本
            chat_history: 最近对话历史（最多10轮），用于上下文连贯
        """
        system_prompt = (
            "你是一位专业且耐心的AI导师。你的任务是：\n"
            "1. 用简单易懂的语言解答学生的问题\n"
            "2. 如果问题涉及复杂概念，先给出简要概述再深入讲解\n"
            "3. 适当举例帮助理解\n"
            "4. 鼓励学生思考，可以在回答后提出引导性问题\n"
            "5. 如果学生看起来困惑，主动询问是否需要更基础的讲解\n\n"
            "你有以下工具可以调用：\n"
            "- search_textbook(keyword)：搜索已上传教材中与某概念相关的内容\n"
            "- get_study_progress(topic)：查询学生对某主题的学习进度\n"
            "- get_user_skills()：列出学生所有课程的学习进度\n\n"
            "重要规则：\n"
            "- 学生问教材内容时，优先调用 search_textbook，而不是凭记忆回答\n"
            "- 学生问'我学过什么'/'我的进度'时，调用对应工具查真实数据\n"
            "- 普通聊天（如问候、学习方法咨询）不需要调工具\n"
            "- 工具结果来自数据库，请基于实际数据回答，不要编造"
        )
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            messages.extend(chat_history[-10:])
        messages.append({"role": "user", "content": question})
        return self.chat_with_tools(messages, temperature=0.7)

    def _check_simplify_quality(self, original: str, simplified: str) -> dict:
        """
        让 LLM 冷眼检查简化质量。

        "冷眼"的含义：这是一次独立的 LLM 调用，不带简化时的上下文，
        只对比原文和简化结果之间的差异，判断是否合格。

        返回：{"pass": True/False, "issues": ["问题1", ...]}
        """
        system_prompt = (
            "你是一位严格的质量审核员。请对比原文和简化结果，逐条检查：\n"
            "1. 关键信息是否丢失（术语定义、数字、公式必须一字不差）\n"
            "2. 是否存在未拆分的学术长句（超过40字且包含多层定语）\n"
            "3. 英文术语是否已翻译或括号标注了原文\n"
            "4. 数学符号、希腊字母是否被改变或删除\n\n"
            "返回严格 JSON：\n"
            '{"pass": true/false, "issues": ["问题描述"]}\n'
            "如果所有检查项通过，pass=true，issues为空数组。"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"原文：\n{original}\n\n简化：\n{simplified}"}
        ]
        response = self.chat(messages, temperature=0.1, max_tokens=512)
        # 解析 JSON（容错：有时 LLM 会包在 ```json``` 里）
        try:
            import json
            response = response.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[1]
                if response.endswith("```"):
                    response = response[:-3]
            return json.loads(response)
        except (json.JSONDecodeError, ValueError):
            return {"pass": True, "issues": []}  # 解析失败不卡流程

    def simplify_text(self, text, context="学术教材"):
        """
        教材内容简化翻译：将晦涩的学术/书面语转换成通俗中文。

        处理规则：
          1. 保持原意不变
          2. 学术术语→通俗表达（括号保留原术语）
          3. 长句拆分
          4. 英文先译中再简化
          5. 公式和数字原样保留
          6. 图片描述保留教学意义

        使用较低temperature(0.3)保证翻译的一致性和准确性。
        """
        system_prompt = (
            f"你是一位专业的教材翻译和简化专家。请将以下{context}中的内容转换成简单易懂的中文：\n"
            "规则：\n"
            "1. 保持原意不变，不添加不删除关键信息\n"
            "2. 用通俗的语言替代学术术语（必要时在括号中保留原术语）\n"
            "3. 长句拆分为短句\n"
            "4. 如果原文含有英文，先翻译成中文再简化\n"
            "5. 保留所有公式、数字等关键信息的准确性\n"
            "6. 对于图片描述，保留其教学意义"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请简化以下内容：\n\n{text}"}
        ]
        return self.chat(messages, temperature=0.3, max_tokens=4096)

    def _do_simplify_batch(self, texts, context="学术教材"):
        """批量简化的底层调用：拼接多段 → 一次 LLM → 按分隔符拆回"""
        if not texts:
            return []
        if len(texts) == 1:
            return [self.simplify_text(texts[0], context)]

        sep = "\n\n<<<SEG>>>\n\n"
        joined = sep.join(texts)

        system_prompt = (
            f"你是一位专业的教材翻译和简化专家。请将以下{context}内容逐段转换成简单易懂的中文。\n"
            "规则：\n"
            "1. 保持原意不变，不添加不删除关键信息\n"
            "2. 用通俗的语言替代学术术语（必要时在括号中保留原术语）\n"
            "3. 长句拆分为短句\n"
            "4. 保留所有公式、数字等关键信息的准确性\n"
            "5. 共有{}段文字，请用 <<<SEG>>> 分隔每段输出，保持与输入相同的段落顺序，输出段数必须与输入段数一致\n"
            "输出格式：简化段1\n\n<<<SEG>>>\n\n简化段2\n\n<<<SEG>>>\n\n简化段3"
        ).format(len(texts))
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"请逐段简化以下{len(texts)}段内容：\n\n{joined}"}
        ]
        response = self.chat(messages, temperature=0.3, max_tokens=8192)

        parts = response.split(sep)
        while len(parts) < len(texts):
            parts.append(texts[len(parts)])
        return [p.strip() for p in parts[:len(texts)]]

    def simplify_batch(self, texts, context="学术教材", enable_review=True,
                       max_retries=2):
        """
        批量简化 + 质量自检。

        Agent 特征：简化后 LLM 自审结果，不合格的段落重新简化。

        流程：
          1. 批量简化 → results
          2. 逐段检查 (enable_review=True)：
             → pass → 保留
             → fail → 用带"上次问题"上下文的 prompt 重新简化
          3. 最多重试 max_retries 次

        参数：
            texts: 原文列表
            context: 教材类型描述
            enable_review: 是否启用质量自检（默认开启）
            max_retries: 每段最大重试次数
        """
        if not texts:
            return []

        # 第一步：批量简化
        results = self._do_simplify_batch(texts, context)

        if not enable_review:
            return results

        # 第二步：逐段自检 + 修复
        for i, (orig, simp) in enumerate(zip(texts, results)):
            retries = 0
            while retries < max_retries:
                check = self._check_simplify_quality(orig, simp)
                if check.get("pass", True):
                    break
                # 不合格：用 simplify_text 重新简化，prompt 附带问题描述
                issues = check.get("issues", [])
                fix_prompt = (
                    f"请重新简化以下内容。上一次的简化存在以下问题：\n"
                    + "\n".join(f"- {issue}" for issue in issues)
                    + f"\n\n原文：\n{orig}"
                )
                simp = self.simplify_text(fix_prompt, context)
                retries += 1
            results[i] = simp

        return results

    def generate_exercise(self, topic, difficulty="medium"):
        """
        根据学习主题生成习题（含答案和解析）。

        默认生成3道题，输出格式：
          【题目1】...【答案1】...【解析1】...
          【题目2】...【答案2】...【解析2】...
          【题目3】...【答案3】...【解析3】...
        """
        system_prompt = (
            f"请根据以下主题生成3道{difficulty}难度的习题，包含答案和解析。\n"
            "格式：\n"
            "【题目1】...\n【答案1】...\n【解析1】...\n"
            "【题目2】...\n【答案2】...\n【解析2】...\n"
            "【题目3】...\n【答案3】...\n【解析3】..."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"主题：{topic}"}
        ]
        return self.chat(messages, temperature=0.5, max_tokens=2048)

    def generate_review_summary(self, topic, content_summary):
        """
        生成复习摘要，包含核心概念、关键公式和易忘细节。
        用于配合遗忘曲线复习时提供快速回顾。
        """
        system_prompt = (
            "请根据以下学习内容生成一份简洁的复习摘要，包含：\n"
            "1. 核心概念（3-5个要点）\n"
            "2. 关键公式或定理\n"
            "3. 容易遗忘的细节提醒"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"主题：{topic}\n内容概要：{content_summary}"}
        ]
        return self.chat(messages, temperature=0.4, max_tokens=1024)


# ========== 分层 Agent 架构 ==========

class LayeredTutor:
    """
    三层 Agent 架构，每层在不同时间尺度上做决策：

    ReactiveLayer（秒级）：检测学生情绪/困惑信号 → 即时应对
    PlanningLayer（分钟级）：分析学习目标 → 制定教学计划
    DecisionLayer（每轮）：反应优先于计划 → 选择最终行动

    用 Agent 视角理解三层：

      学生消息 → ReactiveLayer.process()
              → DecisionLayer.process()
              → 如果学生困惑 → 暂停计划，先安抚/降级
              → 如果学生跟上 → PlanningLayer 的下一步

    和 LLMService.ask_tutor() 的关系：
      ask_tutor 是单轮问答（你问什么我答什么）
      LayeredTutor 是有策略的多轮教学（我知道要讲什么，也知道什么时候该停下来）
    """

    def __init__(self, llm_service=None):
        """
        初始化三层架构。

        参数：
            llm_service: LLMService 实例，默认用全局 shared_llm
        """
        self.llm = llm_service or shared_llm
        self.reactive_layer = self.ReactiveLayer(self.llm)
        self.planning_layer = self.PlanningLayer(self.llm)
        self.decision_layer = self.DecisionLayer()

        # 跨轮次持久化状态
        self.current_plan = []       # PlanningLayer 生成的步骤列表
        self.current_step = 0        # 当前走到第几步
        self.student_profile = {}    # 累积的学生画像（技能、进度、已知弱点）

    # ---------- ReactiveLayer：秒级信号检测 ----------

    class ReactiveLayer:
        """
        底层反应——每次学生发消息都先经过这层。
        只关心"学生现在的状态"，不关心"这节课的进度"。

        检测的信号类型：
          confused    — "能不能再讲一遍" / "不太懂" / 沉默很久后突然重复问
          frustrated  — "太难了" / "完全不知道在说什么"
          bored       — "知道了" / "跳过吧" / 反复催促
          engaged     — "那是不是说..." / "我有个想法" / 追问细节
          lost        — "等等" / "刚才说啥" / 长时间没回应
          normal      — 默认状态，无特殊信号
        """

        def __init__(self, llm):
            self.llm = llm
            self._signal_prompt = (
                "分析以下学生消息，判断学生的认知和情绪状态。"
                "从以下标签中选择一个最匹配的：\n"
                "- confused（困惑，需要重新解释）\n"
                "- frustrated（沮丧，需要鼓励或降级）\n"
                "- bored（觉得太简单或不耐烦）\n"
                "- engaged（积极参与，可以深入）\n"
                "- lost（完全跟不上，需要从头开始）\n"
                "- normal（普通状态，无需特殊处理）\n\n"
                "返回 JSON：{\"signal\": \"标签\", \"reason\": \"一句话判断依据\", "
                "\"suggested_action\": \"建议的应对措施\"}"
            )

        def process(self, student_message: str) -> dict:
            """
            处理学生消息，返回信号字典。

            返回格式：
              {"signal": "confused",
               "reason": "学生说'没听懂'",
               "suggested_action": "用更简单的例子重新解释"}
            """
            import json
            try:
                messages = [
                    {"role": "system", "content": self._signal_prompt},
                    {"role": "user", "content": student_message}
                ]
                response = self.llm.chat(messages, temperature=0.1, max_tokens=256)
                return json.loads(response.replace("```json", "").replace("```", "").strip())
            except (json.JSONDecodeError, Exception):
                return {"signal": "normal", "reason": "无法解析信号",
                        "suggested_action": "正常推进教学"}

    # ---------- PlanningLayer：分钟级教学计划 ----------

    class PlanningLayer:
        """
        中层规划——给定教学目标，生成分步教学计划。

        计划的每一步包含：
          - topic: 这一步要讲的概念
          - method: 讲述方式（概述/详解/举例/对比/练习）
          - duration: 预计耗时（分钟）
        """

        def __init__(self, llm):
            self.llm = llm

        def process(self, goal: str, student_progress: dict = {}) -> list:
            """
            为教学目标生成分步计划。

            参数：
                goal: 教学目标，如"理解Cache的三种地址映射方式"
                student_progress: 学生已有知识（可选）
            返回：
                [{"topic": "...", "method": "...", "duration": N}, ...]
            """
            import json
            context = ""
            if student_progress:
                context = f"\n学生已有基础：{json.dumps(student_progress, ensure_ascii=False)}"

            prompt = (
                f"为以下教学目标设计一个分步教学计划：{goal}{context}\n"
                "要求：\n"
                "1. 从概述到细节，循序渐进\n"
                "2. 每一步之间有逻辑衔接\n"
                "3. 穿插举例和对比\n"
                "4. 最后一步是验证理解（提问或练习）\n"
                "5. 总步数控制在 3~6 步\n\n"
                "返回 JSON 数组：\n"
                '[{"step": 1, "topic": "...", "method": "概述|详解|举例|对比|练习", '
                '"duration": 5, "key_point": "这一步要让学生掌握的核心"}, ...]'
            )
            try:
                messages = [
                    {"role": "system", "content": "你是课程设计师。"},
                    {"role": "user", "content": prompt}
                ]
                response = self.llm.chat(messages, temperature=0.3, max_tokens=1024)
                response = response.replace("```json", "").replace("```", "").strip()
                return json.loads(response)
            except (json.JSONDecodeError, Exception):
                return [{"step": 1, "topic": goal, "method": "详解",
                         "duration": 15, "key_point": "核心概念"}]

    # ---------- DecisionLayer：每轮决策 ----------

    class DecisionLayer:
        """
        顶层仲裁——每轮教学中，综合反应层和规划层的输出，决定最终行动。

        规则（优先级从高到低）：
          1. confused/frustrated/lost  → 暂停当前计划，执行应急教学
          2. bored                     → 跳过当前步骤，加速推进
          3. engaged                   → 计划继续，但可以在这个点上多展开
          4. normal / 其他             → 执行计划中的下一步
        """

        # 反应信号 → 对应的教学调整策略
        SIGNAL_ACTIONS = {
            "confused": "slow_down",
            "frustrated": "encourage_and_downgrade",
            "lost": "restart_from_basics",
            "bored": "speed_up_or_skip",
            "engaged": "deepen_or_expand",
            "normal": "continue_plan",
        }

        def process(self, reactive_result: dict, current_plan: list,
                    current_step: int) -> dict:
            """
            综合决策，返回最终行动指令。

            返回：
              {"action": "slow_down|continue_plan|...",
               "override_plan": True/False,
               "teaching_focus": "这一步应该怎么教",
               "note": "给 LLM 的附加指令"}
            """
            signal = reactive_result.get("signal", "normal")
            action = self.SIGNAL_ACTIONS.get(signal, "continue_plan")
            override = signal in ("confused", "frustrated", "lost")

            # 获取当前计划步骤（如果还有）
            plan_step = None
            if current_step < len(current_plan):
                plan_step = current_plan[current_step]

            return {
                "action": action,
                "override_plan": override,
                "signal": signal,
                "signal_reason": reactive_result.get("reason", ""),
                "signal_suggestion": reactive_result.get("suggested_action", ""),
                "plan_step": plan_step,
                "current_step": current_step,
                "note": self._build_note(action, override, plan_step, reactive_result)
            }

        def _build_note(self, action, override, plan_step, reactive):
            """构建给 LLM 的具体教学指令"""
            if action == "continue_plan" and plan_step:
                return (
                    f"当前教学步骤：{plan_step['topic']}（{plan_step['method']}）。"
                    f"核心要点：{plan_step.get('key_point', '')}"
                )
            elif override:
                return (
                    f"检测到学生状态：{reactive.get('reason', '')}。"
                    f"建议：{reactive.get('suggested_action', '')}。"
                    f"暂停原计划，先回应学生的即时需求，确保理解后再继续。"
                )
            return "根据学生状态灵活教学。"

    # ---------- LayeredTutor 主控 ----------

    def teach(self, student_message: str, goal: Optional[str] = None ,
              student_progress:  Optional[dict] = None) -> dict:
        if student_progress is None:
            student_progress = {}
        """
        一次教学交互——三层架构的完整执行。

        流程：
          ReactiveLayer 分析学生信号
          PlanningLayer 生成计划（如果给了新目标）
          DecisionLayer 选择最终行动

        参数：
            student_message: 学生消息
            goal: 可选，新的学习目标（会重新生成计划）
            student_progress: 学生已有知识
        返回：
            {"reply": "给学生的回复",
             "signal": "检测到的信号",
             "action": "采取的行动",
             "plan_progress": "当前步骤/总步骤"}
        """
        # 层 1：秒级反应
        reactive = self.reactive_layer.process(student_message)
        signal = reactive.get("signal", "normal")

        # 层 2：如果有新目标，生成/更新计划
        if goal:
            self.current_plan = self.planning_layer.process(goal, student_progress)
            self.current_step = 0
        if student_progress:
            self.student_profile.update(student_progress)

        # 层 3：决策
        decision = self.decision_layer.process(
            reactive, self.current_plan, self.current_step
        )

        # 构建给 LLM 的最终 prompt
        reply = self._generate_teaching_reply(
            student_message, decision
        )

        # 维护状态：如果正常推进且计划有内容，步进
        if (decision["action"] == "continue_plan"
                and not decision["override_plan"]
                and self.current_step < len(self.current_plan)):
            self.current_step += 1

        return {
            "reply": reply,
            "signal": signal,
            "action": decision["action"],
            "plan_progress": f"{self.current_step}/{len(self.current_plan) if self.current_plan else '?'}"
        }

    def _generate_teaching_reply(self, student_message: str,
                                  decision: dict) -> str:
        """根据 DecisionLayer 的指令，调用 LLM 生成实际回复"""
        import json

        system_prompt = (
            "你是一位专业且耐心的AI导师。请遵循以下教学指令来回复学生。\n\n"
            f"【教学行动】{decision['action']}\n"
            f"【附加指令】{decision['note']}\n\n"
            "如果当前步骤有内容，以它为主线；"
            "如果检测到学生困惑/沮丧，先共情再教学；"
            "讲解后提出一个引导性问题鼓励思考。"
        )

        plan_step = decision.get("plan_step")
        if plan_step:
            system_prompt += (
                f"\n\n【当前教学步骤】\n"
                f"主题：{plan_step['topic']}\n"
                f"方式：{plan_step['method']}\n"
                f"要点：{plan_step.get('key_point', '')}"
            )

        # 附带上下文：学生状态
        context = (
            f"\n\n【学生状态】信号={decision['signal']}，"
            f"原因={decision.get('signal_reason', 'N/A')}"
        )

        messages = [
            {"role": "system", "content": system_prompt + context},
            {"role": "user", "content": student_message}
        ]
        return self.llm.chat(messages, temperature=0.7)

    def get_status(self) -> dict:
        """导出当前教学状态（用于前端显示进度）"""
        return {
            "plan": self.current_plan,
            "current_step": self.current_step,
            "total_steps": len(self.current_plan),
            "student_profile": self.student_profile
        }


# 全局共享实例：所有模块导入此实例，确保 API 配置全局一致
shared_llm = LLMService()
