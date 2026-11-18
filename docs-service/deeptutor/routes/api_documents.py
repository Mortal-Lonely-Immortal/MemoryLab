"""
文档处理API路由
==============
提供文档上传、处理、简化、查看等REST API。

处理流水线（4步）：
  POST /api/documents/upload              → 第0步：上传文件
  POST /api/documents/<id>/process        → 第1步：提取文字+图片
  POST /api/documents/<id>/simplify       → 第2步：LLM翻译简化（后台异步）
  GET  /api/documents/<id>/progress       → 查询简化进度
  GET  /api/documents/<id>/tutorial       → 第3步：查看重组后的教程

辅助端点：
  GET  /api/documents/list                → 文档列表
  POST /api/documents/<id>/delete         → 删除文档
"""
import os
import uuid
import threading
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from deeptutor.config import Config
from deeptutor.database import get_db
from deeptutor.services.document_service import DocumentProcessor
from deeptutor.services.llm_service import shared_llm as llm
from deeptutor.services.card_export import build_cards_docx, import_to_memory

documents_bp = Blueprint('documents', __name__)

# 记录活跃的简化会话：doc_id → {target, start_simplified}
_simplify_sessions = {}


# 扩展名 → 合法 MIME 类型映射（双重校验：扩展名 + 文件头）
ALLOWED_MIME = {
    'pdf':  {'application/pdf'},
    'docx': {'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    'pptx': {'application/vnd.openxmlformats-officedocument.presentationml.presentation'},
    'ppt':  {'application/vnd.ms-powerpoint', 'application/octet-stream'},
    'txt':  {'text/plain', 'application/octet-stream'},
}


def allowed_file(filename):
    """检查文件扩展名是否在允许列表中"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def allowed_mime(filename, mimetype):
    """双重校验：扩展名 + MIME 类型是否匹配"""
    if not mimetype:
        return False
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    allowed = ALLOWED_MIME.get(ext, set())
    return mimetype in allowed


def safe_join(directory, filename):
    """
    安全路径拼接：防止目录穿越攻击。

    先用 os.path.realpath 解析出真实路径，再校验是否在目标目录内。
    即使 secure_filename 被绕过，这一层也能拦截 ../ 类攻击。
    """
    target = os.path.realpath(os.path.join(directory, filename))
    base = os.path.realpath(directory)
    if not target.startswith(base + os.sep):
        raise ValueError(f"非法文件名: {filename}")
    return target


@documents_bp.route('/upload', methods=['POST'])
def upload_document():
    """
    上传文档文件（PDF/Word/PPT）。

    处理流程：
      1. 验证文件存在且格式合法
      2. 使用secure_filename过滤文件名中的危险字符
      3. 生成唯一ID作为文件名前缀（防止覆盖）
      4. 保存到 uploads/ 目录并在数据库创建记录

    返回：
      doc_id: 数据库文档ID（后续处理用此ID）
      filename: 原始文件名
      file_type: 文件类型
    """
    user_id = request.form.get('user_id', 1)
    if 'file' not in request.files:
        return jsonify({"error": "请选择文件"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "请选择文件"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"不支持的文件格式，支持: {Config.ALLOWED_EXTENSIONS}"}), 400

    # MIME 类型校验（防扩展名伪装：把 .exe 改名成 .pdf 上传）
    if not allowed_mime(file.filename, file.content_type):
        return jsonify({
            "error": f"文件内容与扩展名不匹配（{file.content_type}），拒绝上传"
        }), 400

    # ====== 文件名安全处理 ======
    original_name = file.filename
    file_type = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else 'unknown'

    # 1. secure_filename 过滤危险字符（会删除中文）
    safe_name = secure_filename(file.filename)

    # 2. 安全兜底：secure_filename 处理中文名后可能为空，用 UUID 代替
    if not safe_name or safe_name == file_type:
        safe_name = f"file.{file_type}"
    elif '.' not in safe_name:
        safe_name = f"{safe_name}.{file_type}"

    # 3. 完整 UUID 前缀（128 位随机数，碰撞概率可忽略）
    unique_id = uuid.uuid4().hex

    # 4. 最终存储名：uuid_安全名.ext
    stored_name = f"{unique_id}_{safe_name}"

    # 5. 安全路径拼接 + 目录穿越防护
    try:
        filepath = safe_join(Config.UPLOAD_FOLDER, stored_name)
    except ValueError as e:
        return jsonify({"error": f"文件名不安全: {str(e)}"}), 400

    file.save(filepath)

    # 在documents表中创建记录
    conn = get_db()
    conn.execute('''INSERT INTO documents (user_id, filename, original_name, file_type, status)
        VALUES (?, ?, ?, ?, 'uploaded')''',
        (int(user_id), stored_name, original_name, file_type))
    conn.commit()
    doc_db_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]

    # 自动创建同名技能（用原始文件名去扩展名），用于角色面板技能进度追踪
    skill_name = original_name.rsplit('.', 1)[0].strip()
    existing = conn.execute(
        'SELECT id FROM skills WHERE user_id = ? AND name = ?',
        (int(user_id), skill_name)
    ).fetchone()
    if not existing and skill_name:
        conn.execute(
            'INSERT INTO skills (user_id, name, category) VALUES (?, ?, ?)',
            (int(user_id), skill_name, '书籍'))

    conn.commit()
    conn.close()

    return jsonify({
        "status": "ok",
        "doc_id": doc_db_id,
        "filename": stored_name,
        "original_name": original_name,
        "file_type": file_type
    })


@documents_bp.route('/list', methods=['GET'])
def list_documents():
    """获取用户上传的所有文档列表，按时间倒序"""
    user_id = request.args.get('user_id', 1)
    conn = get_db()
    docs = conn.execute('''SELECT d.*,
        (SELECT COUNT(*) FROM document_blocks b WHERE b.document_id = d.id
          AND b.block_type IN ('text','heading','slide_title')) AS total_blocks,
        (SELECT COUNT(*) FROM document_blocks b WHERE b.document_id = d.id
          AND b.block_type IN ('text','heading','slide_title')
          AND b.simplified_text IS NOT NULL AND b.simplified_text != '') AS simplified_blocks
        FROM documents d
        WHERE d.user_id = ? ORDER BY d.created_at DESC''', (int(user_id),)).fetchall()
    conn.close()
    return jsonify([dict(d) for d in docs])


@documents_bp.route('/<int:doc_id>/process', methods=['POST'])
def process_document(doc_id):
    """
    处理文档：执行工序1和工序2（提取+记忆位置）。

    根据文件类型调用对应的提取方法：
      PDF  → extract_pdf()
      DOCX → extract_docx()
      PPT  → extract_pptx()

    提取出的内容块直接存入document_blocks表，
    每个块都记录了block_order（顺序号）和chapter_title（章节归属），
    保证后续重组时能还原图文相对位置。

    返回前20个内容块作为预览。
    """
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "文档不存在"}), 404

    # 更新状态为"处理中"
    conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('processing', doc_id))
    conn.commit()
    conn.close()

    filepath = os.path.join(Config.UPLOAD_FOLDER, doc['filename'])

    try:
        processor = DocumentProcessor(llm)

        # 根据文件类型选择提取方法
        if doc['file_type'] == 'pdf':
            blocks, chapters = processor.extract_pdf(filepath, doc_id)
        elif doc['file_type'] == 'docx':
            blocks, chapters = processor.extract_docx(filepath, doc_id)
        elif doc['file_type'] in ('ppt', 'pptx'):
            blocks, chapters = processor.extract_pptx(filepath, doc_id)
        else:
            return jsonify({"error": "不支持的文件格式"}), 400

        # 将所有内容块保存到数据库（记录 block_order 用于保持位置）
        conn = get_db()
        for block in blocks:
            conn.execute('''INSERT INTO document_blocks
                (document_id, chapter_title, block_order, block_type,
                 original_text, image_path, page_number)
                VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (doc_id, block.get('chapter_title'), block['block_order'],
                 block['block_type'], block.get('original_text'),
                 block.get('image_path'), block.get('page_number')))
        conn.commit()
        conn.close()

        return jsonify({
            "status": "ok",
            "message": f"提取完成，共 {len(blocks)} 个内容块",
            "total_blocks": len(blocks),
            "chapters": chapters,
            "blocks": blocks[:20]  # 返回前20个作为预览，避免响应过大
        })
    except Exception as e:
        # 处理失败时标记为error状态
        conn = get_db()
        conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('error', doc_id))
        conn.commit()
        conn.close()
        return jsonify({"error": f"处理失败: {str(e)}"}), 500


def _do_simplify(doc_id, block_ids=None):
    """后台线程批量简化：每8个文字块合并为一次LLM调用，大幅提速"""
    BATCH_SIZE = 8
    try:
        conn = get_db()
        if block_ids:
            placeholders = ','.join('?' * len(block_ids))
            all_blocks = conn.execute(
                f'SELECT * FROM document_blocks WHERE id IN ({placeholders}) ORDER BY block_order',
                block_ids).fetchall()
        else:
            all_blocks = conn.execute(
                'SELECT * FROM document_blocks WHERE document_id = ? ORDER BY block_order',
                (doc_id,)).fetchall()
        conn.close()

        # 只处理需要简化的文字块（跳过图片和已完成的）
        text_blocks = [b for b in all_blocks
                       if b['block_type'] in ('text', 'heading', 'slide_title')
                       and b['original_text'] and not b['simplified_text']]

        # 分批处理
        for i in range(0, len(text_blocks), BATCH_SIZE):
            batch = text_blocks[i:i + BATCH_SIZE]
            texts = [b['original_text'] for b in batch]

            try:
                results = llm.simplify_batch(texts)
            except Exception as exc:
                # Never write an API error string into simplified_text and
                # never pretend the document was simplified.
                conn = get_db()
                conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('error', doc_id))
                conn.commit()
                conn.close()
                session = _simplify_sessions.get(doc_id)
                if session is not None:
                    session['error'] = str(exc)
                return

            # 确保结果数量匹配
            if len(results) != len(batch):
                results = results[:len(batch)] if len(results) > len(batch) else results + texts[len(results):]

            conn = get_db()
            for j, block in enumerate(batch):
                try:
                    conn.execute('UPDATE document_blocks SET simplified_text = ? WHERE id = ?',
                                 (results[j], block['id']))
                except Exception:
                    pass
            conn.commit()
            conn.close()

        conn = get_db()
        conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('processed', doc_id))
        conn.commit()
        conn.close()
        session = _simplify_sessions.get(doc_id)
        if session is not None:
            session['error'] = None
    except Exception as exc:
        try:
            conn = get_db()
            conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('error', doc_id))
            conn.commit()
            conn.close()
        except Exception:
            pass
        session = _simplify_sessions.get(doc_id)
        if session is not None:
            session['error'] = str(exc)


@documents_bp.route('/<int:doc_id>/chapters', methods=['GET'])
def list_chapters(doc_id):
    """
    获取文档的章节列表，每个章节包含 text block 计数，
    前端用于展示章节选择界面。
    复用 tutorial 的分组逻辑，按章节或页码分组。
    """
    from deeptutor.services.document_service import DocumentProcessor

    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "文档不存在"}), 404

    blocks = conn.execute(
        'SELECT * FROM document_blocks WHERE document_id = ? ORDER BY block_order',
        (doc_id,)).fetchall()
    conn.close()

    processor = DocumentProcessor()
    chapters = processor._extract_chapters_from_blocks([dict(b) for b in blocks])

    result = []
    if chapters:
        for ch in chapters:
            ch_blocks = [b for b in blocks
                        if b['block_type'] in ('text','heading','slide_title')
                        and b['original_text']
                        and 'start_order' in ch
                        and ch['start_order'] <= b['block_order'] <= ch['end_order']]
            simplified = sum(1 for b in ch_blocks if b['simplified_text'])
            result.append({
                "title": ch['title'],
                "text_blocks": len(ch_blocks),
                "simplified": simplified,
                "start_order": ch.get('start_order', 0),
                "end_order": ch.get('end_order', 0)
            })
    else:
        # 无章节结构，按页码分组
        page_data = {}
        for b in blocks:
            p = b['page_number'] or 0
            if p not in page_data:
                page_data[p] = {"total": 0, "simplified": 0}
            if b['block_type'] in ('text','heading','slide_title') and b['original_text']:
                page_data[p]["total"] += 1
                if b['simplified_text']:
                    page_data[p]["simplified"] += 1
        for p in sorted(page_data.keys()):
            if page_data[p]["total"] > 0:
                result.append({
                    "title": f"第{p}页",
                    "text_blocks": page_data[p]["total"],
                    "simplified": page_data[p]["simplified"],
                    "start_order": 0,
                    "end_order": 0,
                    "page": p
                })

    return jsonify({"chapters": result})


@documents_bp.route('/<int:doc_id>/simplify', methods=['POST'])
def simplify_document(doc_id):
    """
    启动后台LLM翻译简化任务。

    可选请求参数（JSON body）：
      - chapter_titles: [str]  只简化指定章节
      - pages: [int]           只简化指定页码

    不传参数则简化全部未完成的内容块。
    前端通过 GET /api/documents/<id>/progress 轮询进度。
    """
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "文档不存在"}), 404

    if doc['status'] == 'simplifying':
        conn.close()
        return jsonify({"error": "正在简化中，请等待"}), 409

    # Older versions wrote API error strings into simplified_text. Clear them
    # so a retry after fixing the key starts from real content again.
    conn.execute(
        """UPDATE document_blocks SET simplified_text = NULL
           WHERE document_id = ? AND (
             simplified_text LIKE 'API错误:%' OR simplified_text LIKE '请求失败:%'
             OR simplified_text LIKE '请求超时%' OR simplified_text LIKE '请先在设置中配置API密钥%'
             OR simplified_text = original_text
           )""",
        (doc_id,))
    conn.commit()

    data = request.json or {}
    chapter_titles = data.get('chapter_titles')
    pages = data.get('pages')

    # 根据过滤条件筛选要处理的 block IDs
    import re
    block_ids = None
    if chapter_titles:
        # 检查是否为"第N页"格式 → 按页码筛选
        page_match = [re.match(r'^第(\d+)页$', t) for t in chapter_titles]
        if all(page_match):
            page_nums = [int(m.group(1)) for m in page_match]
            placeholders = ','.join('?' * len(page_nums))
            rows = conn.execute(
                f'SELECT id FROM document_blocks WHERE document_id = ? AND page_number IN ({placeholders}) '
                f'AND block_type IN (\'text\',\'heading\',\'slide_title\') AND original_text IS NOT NULL AND original_text != \'\'',
                [doc_id] + page_nums).fetchall()
        else:
            # 按真实章节标题筛选
            placeholders = ','.join('?' * len(chapter_titles))
            rows = conn.execute(
                f'SELECT id FROM document_blocks WHERE document_id = ? AND chapter_title IN ({placeholders}) '
                f'AND block_type IN (\'text\',\'heading\',\'slide_title\') AND original_text IS NOT NULL AND original_text != \'\'',
                [doc_id] + list(chapter_titles)).fetchall()
        block_ids = [r['id'] for r in rows]
    elif pages:
        placeholders = ','.join('?' * len(pages))
        rows = conn.execute(
            f'SELECT id FROM document_blocks WHERE document_id = ? AND page_number IN ({placeholders}) '
            f'AND block_type IN (\'text\',\'heading\',\'slide_title\') AND original_text IS NOT NULL AND original_text != \'\'',
            [doc_id] + [int(p) for p in pages]).fetchall()
        block_ids = [r['id'] for r in rows]

    # 记录本次简化会话的起始状态（用于计算增量进度）
    start_simplified = conn.execute(
        "SELECT COUNT(*) FROM document_blocks WHERE document_id = ? AND simplified_text IS NOT NULL AND simplified_text != ''",
        (doc_id,)).fetchone()[0]

    if block_ids:
        target_count = len(block_ids)
    else:
        target_count = conn.execute(
            "SELECT COUNT(*) FROM document_blocks WHERE document_id = ? AND block_type IN ('text','heading','slide_title') AND original_text IS NOT NULL AND original_text != '' AND (simplified_text IS NULL OR simplified_text = '')",
            (doc_id,)).fetchone()[0]
    _simplify_sessions[doc_id] = {"target": target_count, "start_simplified": start_simplified, "error": None}

    conn.execute('UPDATE documents SET status = ? WHERE id = ?', ('simplifying', doc_id))
    conn.commit()
    conn.close()

    thread = threading.Thread(target=_do_simplify, args=(doc_id, block_ids), daemon=True)
    thread.start()

    return jsonify({"status": "started", "message": f"开始简化 ({target_count} 个文字块)", "target_blocks": target_count})


@documents_bp.route('/<int:doc_id>/progress', methods=['GET'])
def simplify_progress(doc_id):
    """
    查询文档简化进度。
    有活跃会话时：total=选中块数，simplified=本次新增完成数
    无活跃会话时：回退到全文档统计
    """
    conn = get_db()
    session = _simplify_sessions.get(doc_id)

    if session:
        total = session["target"]
        current = conn.execute(
            "SELECT COUNT(*) FROM document_blocks WHERE document_id = ? AND simplified_text IS NOT NULL AND simplified_text != ''",
            (doc_id,)).fetchone()[0]
        simplified = max(0, current - session["start_simplified"])
    else:
        total = conn.execute(
            "SELECT COUNT(*) FROM document_blocks WHERE document_id = ? AND block_type IN ('text','heading','slide_title') AND original_text IS NOT NULL AND original_text != ''",
            (doc_id,)).fetchone()[0]
        simplified = conn.execute(
            "SELECT COUNT(*) FROM document_blocks WHERE document_id = ? AND simplified_text IS NOT NULL AND simplified_text != ''",
            (doc_id,)).fetchone()[0]

    doc = conn.execute('SELECT status FROM documents WHERE id = ?', (doc_id,)).fetchone()
    conn.close()

    return jsonify({
        "total": total,
        "simplified": simplified,
        "status": doc['status'] if doc else 'unknown',
        "error": (session or {}).get('error')
    })


@documents_bp.route('/<int:doc_id>/tutorial', methods=['GET'])
def get_tutorial(doc_id):
    """
    获取重组后的教程内容：执行工序4。

    重组逻辑：
      1. 如果文档有章节结构 → 按章节分组
      2. 如果没有章节 → 按页码分组
      3. 每组内的块按block_order排序，保持图文位置

    前端将渲染为可阅读的教程格式（章节标题 → 图文内容 → 下一章节）。
    """
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "文档不存在"}), 404

    blocks = conn.execute('''SELECT * FROM document_blocks
        WHERE document_id = ? ORDER BY block_order''', (doc_id,)).fetchall()
    conn.close()

    processor = DocumentProcessor()
    chapters = processor._extract_chapters_from_blocks([dict(b) for b in blocks])

    if not chapters:
        # 无章节结构 → 按页码分组
        page_groups = {}
        for b in blocks:
            p = b['page_number'] or 0
            if p not in page_groups:
                page_groups[p] = []
            page_groups[p].append(dict(b))

        tutorial = []
        for page, page_blocks in sorted(page_groups.items()):
            # 用该页第一段文字的前50字作为页面摘要
            first_text = next((b['original_text'][:50] for b in page_blocks
                              if b['block_type'] == 'text' and b['original_text']), f"第{page}页")
            tutorial.append({
                "chapter": f"第{page}页 - {first_text}",
                "blocks": page_blocks
            })
    else:
        # 有章节结构 → 按 block_order 范围分组（兼容PDF/Word/PPT）
        tutorial = []
        for ch in chapters:
            if 'start_order' in ch:
                ch_blocks = [dict(b) for b in blocks
                             if ch['start_order'] <= b['block_order'] <= ch['end_order']]
            else:
                # TOC章节用页码匹配（仅PDF有目录时走这里）
                ch_blocks = [dict(b) for b in blocks
                             if b['page_number'] and ch.get('start_page', 0) <= b['page_number'] <= ch.get('end_page', 9999)]
            if ch_blocks:
                tutorial.append({
                    "chapter": ch['title'],
                    "blocks": ch_blocks
                })

    return jsonify({
        "doc_id": doc_id,
        "filename": doc['original_name'],
        "status": doc['status'],
        "tutorial": tutorial
    })


@documents_bp.route('/<int:doc_id>/study-time', methods=['POST'])
def record_study_time(doc_id):
    """
    记录查看教程的学习时长，并奖励经验值。

    请求参数（JSON body）：
      - duration_seconds: int  本次查看教程的时长（秒）
      - user_id: int           用户ID（默认1）

    经验值规则：每分钟2经验（与番茄钟一致），最少1经验。
    同时更新 character_stats.total_study_minutes。
    """
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if not doc:
        conn.close()
        return jsonify({"error": "文档不存在"}), 404

    data = request.json or {}
    user_id = int(data.get('user_id', 1))
    duration_seconds = max(1, int(data.get('duration_seconds', 0)))
    if duration_seconds <= 0:
        conn.close()
        return jsonify({"error": "无效的学习时长"}), 400

    duration_minutes = max(1, round(duration_seconds / 60))
    earned_exp = duration_minutes * 2

    # 更新角色属性
    stats = conn.execute(
        'SELECT * FROM character_stats WHERE user_id = ?', (user_id,)
    ).fetchone()

    level_up = False
    new_level = 0
    if stats:
        new_exp = stats['exp'] + earned_exp
        new_total_minutes = stats['total_study_minutes'] + duration_minutes
        level = stats['level']
        intelligence = stats['intelligence']

        from deeptutor.database import exp_for_level
        exp_needed = exp_for_level(level)
        while new_exp >= exp_needed and level < 99:
            new_exp -= exp_needed
            level += 1
            intelligence += 2
            exp_needed = exp_for_level(level)
            level_up = True
        new_level = level

        conn.execute('''UPDATE character_stats SET
            exp = ?, level = ?, intelligence = ?,
            total_study_minutes = ?
            WHERE user_id = ?''',
            (new_exp, level, intelligence, new_total_minutes, user_id))
    else:
        conn.execute('''INSERT INTO character_stats
            (user_id, level, exp, intelligence, total_study_minutes)
            VALUES (?, 1, ?, 10, ?)''',
            (user_id, earned_exp, duration_minutes))
        new_level = 1

    # 记录学习会话
    conn.execute('''INSERT INTO study_sessions
        (user_id, skill_id, duration_minutes, exp_earned, session_type, notes)
        VALUES (?, NULL, ?, ?, 'tutorial', ?)''',
        (user_id, duration_minutes, earned_exp,
         f"查看教程: {doc['original_name']}"))

    # 如果文档名匹配某个技能，同时更新技能进度
    skill = conn.execute(
        'SELECT * FROM skills WHERE user_id = ? AND name = ?',
        (user_id, doc['original_name'])
    ).fetchone()
    if skill:
        increment = duration_minutes / 60 * 3
        new_progress = min(100, skill['progress'] + increment)
        from deeptutor.database import rank_for_progress
        rank, rank_level = rank_for_progress(new_progress)
        conn.execute('''UPDATE skills SET progress = ?, rank = ?, rank_level = ?
            WHERE id = ?''', (new_progress, rank, rank_level, skill['id']))

    conn.commit()
    conn.close()

    return jsonify({
        "status": "ok",
        "earned_exp": earned_exp,
        "duration_minutes": duration_minutes,
        "level": new_level,
        "level_up": level_up
    })


@documents_bp.route('/<int:doc_id>/cards', methods=['POST'])
def export_cards(doc_id):
    """把当前教程按章节导出为 docx，并直接导入记忆后端的 FSRS 卡组。"""
    result = get_tutorial(doc_id)
    if isinstance(result, tuple):
        return result
    data = result.get_json()
    if data.get('error'):
        return jsonify({"error": data['error']}), 404
    path = None
    try:
        path = build_cards_docx(data, doc_id)
        imported = import_to_memory(path, doc_id)
        return jsonify({
            "status": "ok",
            "message": "已生成记忆卡",
            "created_cards": imported.get("createdCards", 0),
            "total_cards": imported.get("totalCards", 0),
            "total_notes": imported.get("totalNotes", 0),
            "skipped_cards": imported.get("skippedCards", 0)
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if path and os.path.exists(path):
            os.remove(path)


@documents_bp.route('/<int:doc_id>/download', methods=['GET'])
def download_document(doc_id):
    """Open/download the original uploaded file for external viewing."""
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    conn.close()
    if not doc:
        return jsonify({"error": "文档不存在"}), 404
    return send_from_directory(
        Config.UPLOAD_FOLDER,
        doc['filename'],
        as_attachment=False,
        download_name=doc['original_name'],
    )


@documents_bp.route('/<int:doc_id>/delete', methods=['POST'])
def delete_document(doc_id):
    """
    删除文档及其所有关联数据。
    包括：物理文件、document_blocks记录、documents记录。
    """
    conn = get_db()
    doc = conn.execute('SELECT * FROM documents WHERE id = ?', (doc_id,)).fetchone()
    if doc:
        # 删除物理文件
        filepath = os.path.join(Config.UPLOAD_FOLDER, doc['filename'])
        if os.path.exists(filepath):
            os.remove(filepath)
        # 删除数据库记录
        conn.execute('DELETE FROM document_blocks WHERE document_id = ?', (doc_id,))
        conn.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})
