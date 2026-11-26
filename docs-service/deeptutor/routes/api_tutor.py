"""
AI导师API路由
=============
提供AI导师功能的REST API端点：

  GET  /api/tutor/config       - 获取当前LLM配置
  POST /api/tutor/config       - 更新LLM配置（API Key/Base URL/Model）
  POST /api/tutor/chat         - 发送问题给AI导师，返回回答
  GET  /api/tutor/history      - 获取对话历史
  POST /api/tutor/history/clear - 清空对话历史
"""
import json
import re

from flask import Blueprint, request, jsonify, session
from deeptutor.services.llm_service import shared_llm as llm
from deeptutor.database import get_db, set_setting

# 创建蓝图，所有路由以 /api/tutor 为前缀
tutor_bp = Blueprint('tutor', __name__)


@tutor_bp.route('/config', methods=['GET'])
def get_config():
    """
    获取当前LLM API配置（来自数据库持久化配置或Config默认值）。
    API Key只返回前8位+省略号，避免完整密钥泄露到前端。
    """
    return jsonify({
        "api_key": llm.api_key[:8] + "..." if llm.api_key else "",
        "api_base": llm.api_base,
        "model": llm.model
    })


@tutor_bp.route('/config', methods=['POST'])
def set_config():
    """
    更新LLM API配置。
    用户可在前端"设置"页面修改API Key、Base URL和Model名称。
    修改同时持久化到数据库，服务重启后自动恢复。
    """
    data = request.json
    if data.get('api_key'):
        llm.api_key = data['api_key']
        set_setting('llm_api_key', data['api_key'])
    if data.get('api_base'):
        base = data['api_base'].strip().rstrip('/')
        if base.endswith('/chat/completions'):
            base = base[:-len('/chat/completions')].rstrip('/')
        llm.api_base = base
        set_setting('llm_api_base', base)
    if data.get('model'):
        llm.model = data['model']
        set_setting('llm_model', data['model'])
    return jsonify({"status": "ok", "message": "API配置已保存"})


@tutor_bp.route('/chat', methods=['POST'])
def chat():
    """
    AI导师对话端点。

    处理流程：
      1. 验证问题不为空
      2. 从数据库获取最近20条对话历史作为上下文
      3. 调用LLM的ask_tutor方法（带教学System Prompt）
      4. 将用户问题和AI回答存入数据库
      5. 返回AI回答给前端

    请求格式：{"question": "...", "user_id": 1}
    响应格式：{"answer": "..."}
    """
    data = request.json
    question = data.get('question', '').strip()
    if not question:
        return jsonify({"error": "请输入问题"}), 400

    user_id = data.get('user_id', 1)

    # 获取最近20条历史对话作为上下文
    conn = get_db()
    history = conn.execute('''SELECT role, content FROM chat_history
        WHERE user_id = ? ORDER BY id DESC LIMIT 20''', (user_id,)).fetchall()
    conn.close()

    # 反转顺序：数据库是最新在前，LLM需要最早在前
    chat_history = [{"role": h['role'], "content": h['content']} for h in reversed(history)]

    # 调用LLM获取回答
    answer = llm.ask_tutor(question, chat_history)

    # 保存本轮对话到数据库
    conn = get_db()
    conn.execute('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)',
                 (user_id, 'user', question))
    conn.execute('INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)',
                 (user_id, 'assistant', answer))
    conn.commit()
    conn.close()

    return jsonify({"answer": answer})


@tutor_bp.route('/inspect', methods=['POST'])
def inspect_selection():
    """划线提问：解释选中的词/句，或检索教材知识点。

    请求：{"text": "...", "context": "...", "action": "explain" | "search"}
    - explain：调用 LLM 做短解释，不写入 chat_history
    - search：只用本地 SQLite 的 document_blocks 检索，不依赖 API Key
    """
    data = request.get_json(silent=True) or {}
    text = str(data.get('text') or '').strip()
    context = str(data.get('context') or '').strip()
    action = data.get('action') or 'explain'
    if not text:
        return jsonify({"error": "请先选中一段文字"}), 400
    if len(text) > 300:
        text = text[:300]

    if action == 'search':
        return jsonify({"text": text, "results": _search_knowledge(text)})

    if not llm.api_key:
        return jsonify({"error": "未配置模型，暂时不能解释；可以先检索知识库。"}), 503

    prompt = (
        "你是 Memory Lab 的学习导师。用户在导师回答中选中了下面这段文字：\n"
        f"【选中内容】{text}\n"
        f"【原句上下文】{context[:500] or '（无）'}\n\n"
        "请只做两件事：1）用不超过 120 个中文字解释它的含义；"
        "2）如果它是术语，补一句它在本课程/本系统中的用途。"
        "不要寒暄，不要展开成长篇。"
    )
    try:
        answer = llm.chat([
            {"role": "system", "content": "你是中文学习导师。只输出简洁解释，不寒暄，不展开长篇。"},
            {"role": "user", "content": prompt},
        ], temperature=0.2, max_tokens=420)
    except Exception as e:
        return jsonify({"error": f"解释失败：{str(e)}"}), 500
    return jsonify({"text": text, "answer": answer})


def _search_terms(text):
    """从选中的句子中抽出 2~5 个可用于 LIKE 检索的词。

    没有引入分词器：按常见疑问词/动词/助词切开，保留实词片段。
    例：FSRS 的稳定度是什么意思 → ["FSRS", "稳定度"]
    """
    parts = re.split(
        r'(?:是什么|什么意思|怎么|为什么|如何|决定|影响|包括|属于|表示|用于|可以|请|一下|这个|那个|的|是|了|吗|呢)',
        text
    )
    terms = []
    for part in parts:
        part = re.sub(r'[^\u4e00-\u9fffA-Za-z0-9_]+', ' ', part).strip()
        for token in part.split():
            if len(token) < 2:
                continue
            candidates = [token] if len(token) <= 12 else [token[:8], token[-8:]]
            for c in candidates:
                if c and c not in terms:
                    terms.append(c)
    if not terms:
        cleaned = re.sub(r'[^\u4e00-\u9fffA-Za-z0-9_]+', ' ', text).strip()
        terms = [cleaned[:30] or text[:30]]
    return terms[:5]


def _search_knowledge(text):
    """在文档服务的 document_blocks 中检索原文/简化文，返回知识点片段。"""
    from deeptutor.database import get_db
    results, seen = [], set()
    try:
        conn = get_db()
        for term in _search_terms(text):
            rows = conn.execute(
                """SELECT db.id, db.document_id, db.chapter_title,
                          db.original_text, db.simplified_text, d.original_name
                   FROM document_blocks db
                   JOIN documents d ON db.document_id = d.id
                   WHERE db.original_text LIKE ? OR db.simplified_text LIKE ?
                   ORDER BY db.block_order
                   LIMIT 6""",
                (f"%{term}%", f"%{term}%")
            ).fetchall()
            for r in rows:
                key = (r["document_id"], r["id"])
                if key in seen:
                    continue
                seen.add(key)
                body = r["simplified_text"] or r["original_text"] or ""
                pos = body.find(term)
                start = max(0, pos - 60) if pos >= 0 else 0
                snippet = body[start:start + 220]
                if len(body) > start + 220:
                    snippet += "..."
                results.append({
                    "block_id": r["id"],
                    "document_id": r["document_id"],
                    "document": r["original_name"],
                    "chapter": r["chapter_title"] or "未分章",
                    "term": term,
                    "snippet": snippet,
                })
                if len(results) >= 8:
                    conn.close()
                    return results
        conn.close()
    except Exception as e:
        return [{"error": f"检索知识库失败：{str(e)}"}]
    return results


@tutor_bp.route('/cards', methods=['POST'])
def cards_from_tutor():
    """把导师回答保存后的内容转成卡片候选。

    请求：{"text": "...", "title": "..."}
    响应：{"cards": [{"front": "...", "back": "..."}]}
    只生成候选，不直接写业务库；前端确认后再 POST /api/v1/cards。
    """
    data = request.get_json(silent=True) or {}
    text = str(data.get('text') or '').strip()
    title = str(data.get('title') or '').strip()
    if not text:
        return jsonify({"error": "保存内容为空"}), 400
    if len(text) > 12000:
        text = text[:12000]
    if not llm.api_key:
        return jsonify({"error": "未配置模型，不能自动生成卡片；可以先保存到笔记。"}), 503

    prompt = (
        "你是 Memory Lab 的卡片制作助手。把下面导师回答拆成 3～5 张可独立复习的问答卡。\n"
        "要求：\n"
        "1. front 是一个具体问题，back 是简洁答案；\n"
        "2. 每张卡只考一个点，不要照抄整段；\n"
        "3. 保留关键术语、公式或步骤；\n"
        "4. 只输出 JSON 数组，不要 Markdown 代码块，不要解释。\n"
        "格式：[{\"front\":\"问题\",\"back\":\"答案\"}]\n\n"
        f"标题：{title or '导师回答'}\n"
        f"内容：\n{text}"
    )
    try:
        raw = llm.chat([
            {"role": "system", "content": "你只输出严格 JSON，不要输出其他文字。"},
            {"role": "user", "content": prompt},
        ], temperature=0.2, max_tokens=1200)
    except Exception as e:
        return jsonify({"error": f"生成卡片失败：{str(e)}"}), 500

    if not isinstance(raw, str) or raw.strip().startswith(('API错误:', '请求失败:', '请求超时')):
        return jsonify({"error": raw if isinstance(raw, str) else "模型没有返回内容"}), 502

    m = re.search(r'\[[\s\S]*\]', raw)
    if not m:
        return jsonify({"error": "模型返回格式不是 JSON 数组"}), 422
    try:
        items = json.loads(m.group(0))
    except Exception:
        return jsonify({"error": "模型返回的 JSON 无法解析"}), 422

    cards, seen = [], set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        front = str(item.get('front') or '').strip()
        back = str(item.get('back') or '').strip()
        if not front or not back:
            continue
        key = (front, back)
        if key in seen:
            continue
        seen.add(key)
        cards.append({"front": front[:300], "back": back[:1200]})
        if len(cards) >= 5:
            break
    if not cards:
        return jsonify({"error": "没有生成有效卡片，请换一段内容或手动建卡"}), 422
    return jsonify({"cards": cards})


@tutor_bp.route('/rewrite', methods=['POST'])
def rewrite_tutor_answer():
    """导师回答的文言文 → 现代白话两段式改写。

    请求：{"text": "导师回答", "title": "可选标题"}
    响应：{"classical": "...", "modern": "..."}
    只返回展示文本，不写聊天历史、不覆盖原回答。
    """
    data = request.get_json(silent=True) or {}
    text = str(data.get('text') or '').strip()
    if not text:
        return jsonify({"error": "导师回答为空"}), 400
    if len(text) > 8000:
        text = text[:8000]
    if not llm.api_key:
        return jsonify({"error": "未配置模型，不能改写。"}), 503

    try:
        classical = llm.chat([
            {"role": "system", "content": "你只输出改写结果，不要解释、不要加标题。"},
            {"role": "user", "content": (
                "把下面现代中文导师回答改写成简洁、准确、可读的文言文。\n"
                "保留公式、数字、英文术语、代码和专有名词；不增加原文没有的信息；"
                "不要输出 Markdown 代码块，只输出文言文。\n\n" + text
            )},
        ], temperature=0.2, max_tokens=1800)
        classical = _clean_rewrite_text(classical)
        if not classical or _is_llm_error(classical):
            return jsonify({"error": f"文言文改写失败：{classical or '空结果'}"}), 502

        modern = llm.chat([
            {"role": "system", "content": "你只输出翻译结果，不要解释、不要加标题。"},
            {"role": "user", "content": (
                "把下面文言文翻译成自然、准确的现代白话文。\n"
                "保留公式、数字、英文术语、代码和专有名词；不增加原文没有的信息；"
                "不要输出 Markdown 代码块，只输出白话文。\n\n" + classical
            )},
        ], temperature=0.2, max_tokens=1800)
        modern = _clean_rewrite_text(modern)
        if not modern or _is_llm_error(modern):
            return jsonify({"error": f"现代白话翻译失败：{modern or '空结果'}", "classical": classical}), 502
    except Exception as e:
        return jsonify({"error": f"改写失败：{str(e)}"}), 500

    return jsonify({"classical": classical, "modern": modern})


def _clean_rewrite_text(raw):
    if not isinstance(raw, str):
        return ''
    text = raw.strip()
    text = re.sub(r'^```(?:text|markdown)?\s*', '', text, flags=re.I)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


def _is_llm_error(text):
    return str(text).strip().startswith(('API错误:', '请求失败:', '请求超时', '请先在设置中配置API密钥'))


@tutor_bp.route('/history', methods=['GET'])
def get_history():
    """
    获取对话历史。
    按时间正序返回，前端直接渲染为聊天记录。
    """
    user_id = request.args.get('user_id', 1)
    conn = get_db()
    rows = conn.execute('''SELECT role, content, created_at FROM chat_history
        WHERE user_id = ? ORDER BY id ASC''', (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@tutor_bp.route('/history/clear', methods=['POST'])
def clear_history():
    """清空指定用户的全部对话历史"""
    user_id = request.json.get('user_id', 1)
    conn = get_db()
    conn.execute('DELETE FROM chat_history WHERE user_id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})
