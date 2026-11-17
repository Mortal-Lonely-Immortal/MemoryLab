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
        llm.api_base = data['api_base'].rstrip('/')
        set_setting('llm_api_base', data['api_base'].rstrip('/'))
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
