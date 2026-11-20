/* Memory Lab — native P5 workspace backed by DeepTutor 1.7.3 */
(function () {
  'use strict';
  var API = '/dt-api';
  var state = { section: 'overview', content: null };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(v) {
    if (!v) return '';
    var n = Number(v);
    var d = new Date(n && n < 100000000000 ? n * 1000 : v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  async function dtApi(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    var r = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body
    });
    var text = await r.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!r.ok) {
      var msg = data && (data.detail || data.message || data.error) || ('HTTP ' + r.status);
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
      throw new Error(msg);
    }
    return data;
  }
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
  }
  function card(title, body) {
    return '<div class="p5-card"><div class="p5-card-header">' + title + '</div>' + body + '</div>';
  }
  function empty(text) {
    return '<div class="dt-empty">' + esc(text) + '</div>';
  }
  function status(ok, text) {
    return '<div class="dt-status">' + (ok ? 'DEEPTUTOR CONNECTED' : 'DEEPTUTOR OFFLINE') + ' · ' + esc(text || '127.0.0.1:8001') + '</div>';
  }


  var META = {
    overview: ['OVERVIEW', '学习总览', '知识库、笔记、任务与记忆状态'],
    tutor: ['TUTOR', '导师', 'Chat · Explain · Solve · Research · Visualize'],
    learning: ['LEARNING', '学习', 'Mastery Path · Book · Reading'],
    books: ['BOOKS', '学习书', '从资料生成书 · 章节阅读'],
    reading: ['READING', '阅读', '阅读工作区 · 材料 · 会话'],
    practice: ['PRACTICE', '练习', '题库 · 错题 · 复习'],
    ingest: ['INGEST', '资料导入', '文件夹 · AI 分类 · 知识库 · 笔记'],
    knowledge: ['KNOWLEDGE', '知识库', '上传资料 · RAG · 索引'],
    notebook: ['NOTEBOOK', '笔记', '按主题收集 · 复习'],
    memory: ['MEMORY', '记忆', 'L1 事实 · L2 学习状态 · L3 画像'],
    calendar: ['CALENDAR', '日历', '学习计划 · 时间块 · 复习'],
    tasks: ['TASKS', '任务', '看板 · 进行中 · 已完成'],
    partners: ['PARTNERS', '伙伴', '多智能体 · 协作'],
    research: ['RESEARCH', '研究', '深搜 · 论文 · 证据'],
    visualize: ['VISUALIZE', '可视化', '图表 · SVG · 解释']
  };

  var GROUPS = {
    study: { title: 'STUDY', cn: '学习', sub: '总览 · 掌握路径 · 书 · 阅读 · 练习', sections: ['overview', 'learning', 'books', 'reading', 'practice'] },
    library: { title: 'LIBRARY', cn: '资料', sub: '资料导入 · 知识库 · 笔记 · 记忆', sections: ['ingest', 'knowledge', 'notebook', 'memory'] },
    plan: { title: 'PLAN', cn: '计划', sub: '日历 · 任务', sections: ['calendar', 'tasks'] },
    ai: { title: 'AI', cn: '助手', sub: '导师 · 伙伴 · 研究 · 可视化', sections: ['tutor', 'partners', 'research', 'visualize'] }
  };
  function groupFor(section) {
    for (var g in GROUPS) if (GROUPS[g].sections.indexOf(section) >= 0) return g;
    return 'study';
  }

  function renderGroup(main, group, section) {
    var info = GROUPS[group] || GROUPS.study;
    var current = section && info.sections.indexOf(section) >= 0 ? section : info.sections[0];
    main.innerHTML =
      '<div class="dt-group">' +
        '<div class="dt-page-head">' +
          '<div class="dt-kicker">DEEPTUTOR / ' + info.title + '</div>' +
          '<div class="dt-page-title">' + info.title + ' <span>' + info.cn + '</span></div>' +
          '<div class="dt-page-sub">' + info.sub + '</div>' +
        '</div>' +
        '<div class="dt-group-nav">' + info.sections.map(function (sec) {
          var m = META[sec] || [sec, '', ''];
          return '<button class="dt-subtab' + (sec === current ? ' is-active' : '') + '" data-dt-sub="' + sec + '" onclick="DTWorkspace.navigate(\'' + sec + '\')">' + m[0] + ' ' + m[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="dt-content" id="dt-content"></div>' +
      '</div>';
    state.content = document.getElementById('dt-content');
    go(current);
  }

  function renderSection(main, section) {
    renderGroup(main, groupFor(section || 'overview'), section || 'overview');
  }

  function navigate(section) { location.hash = '#dt-' + section; }

  var TABS = [
    ['overview', 'OVERVIEW 概览'],
    ['tutor', 'TUTOR 导师'],
    ['learning', 'LEARNING 学习'],
    ['knowledge', 'KNOWLEDGE 知识库'],
    ['notebook', 'NOTEBOOK 笔记'],
    ['memory', 'MEMORY 记忆'],
    ['calendar', 'CALENDAR 日历'],
    ['tasks', 'TASKS 任务'],
    ['partners', 'PARTNERS 伙伴'],
    ['research', 'RESEARCH 研究'],
    ['visualize', 'VISUALIZE 可视化']
  ];

  function render(main) {
    renderSection(main, 'overview');
  }

  function go(section) {
    state.section = section;
    var content = document.getElementById('dt-content');
    if (!content) return;
    state.content = content;
    document.querySelectorAll('.dt-tab,.dt-subtab').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-dt') === section || b.getAttribute('data-dt-sub') === section);
    });
    content.innerHTML = '<div class="p5-card"><div class="p5-card-header">LOADING 加载中</div></div>';
    var fn = {
      overview: overview, tutor: tutor, learning: learning, knowledge: knowledge,
      books: books, reading: reading, practice: practice, ingest: ingest,
      notebook: notebook, memory: memory, calendar: calendar, tasks: tasks,
      partners: partners, research: research, visualize: visualize
    }[section];
    Promise.resolve(fn ? fn(content) : null).catch(function (e) {
      content.innerHTML = card('ERROR 错误', '<div class="error-state">' + esc(e.message) + '</div>');
    });
  }

  async function overview(content) {
    var results = await Promise.allSettled([
      dtApi('/api/dashboard/learning-index'),
      dtApi('/api/dashboard/recent'),
      dtApi('/api/knowledge-bases'),
      dtApi('/api/notebooks/statistics'),
      dtApi('/api/task-board'),
      dtApi('/api/memory/overview')
    ]);
    function val(i, fallback) { return results[i].status === 'fulfilled' ? results[i].value : fallback; }
    var learn = val(0, { sources: {} }) || { sources: {} };
    var recent = val(1, []) || [];
    var kbs = val(2, []) || [];
    var nbs = val(3, { total_notebooks: 0, total_records: 0 }) || {};
    var tasks = val(4, { cards: [] }) || { cards: [] };
    var mem = val(5, { docs: [] }) || { docs: [] };
    var sourceCount = Object.keys(learn.sources || {}).reduce(function (n, k) { return n + ((learn.sources[k] || []).length || 0); }, 0);
    var openTasks = (tasks.cards || []).filter(function (c) { return c.status !== 'done'; }).length;
    var memEntries = (mem.docs || []).reduce(function (n, d) { return n + (d.entry_count || 0); }, 0);
    content.innerHTML =
      '<div class="dt-grid">' +
        '<div class="dt-stat"><b>' + (kbs.length || 0) + '</b><span>KNOWLEDGE BASES 知识库</span></div>' +
        '<div class="dt-stat"><b>' + (nbs.total_notebooks || 0) + '</b><span>NOTEBOOKS 笔记本</span></div>' +
        '<div class="dt-stat"><b>' + sourceCount + '</b><span>LEARNING SOURCES 学习资料</span></div>' +
        '<div class="dt-stat"><b>' + openTasks + '</b><span>OPEN TASKS 待办</span></div>' +
      '</div>' +
      card('WORKSPACES 功能入口',
        '<div class="dt-features" style="padding:14px;">' +
          feature('ingest', 'INGEST 导入', '文件夹 · AI 分类 · 知识库 / 笔记') +
    feature('tutor', 'TUTOR 导师', '对话 · 推理 · 工具 · 学习上下文') +
          feature('learning', 'LEARNING 学习', 'Mastery Path · Book · Reading') +
          feature('knowledge', 'KNOWLEDGE 知识库', '上传资料 · RAG · 索引') +
          feature('notebook', 'NOTEBOOK 笔记', '按主题收集 · 复习') +
          feature('memory', 'MEMORY 记忆', 'L1 / L2 / L3 · 画像 · 偏好') +
          feature('calendar', 'CALENDAR 日历', '学习计划 · 时间块') +
          feature('tasks', 'TASKS 任务', '看板 · 进行中 · 已完成') +
          feature('partners', 'PARTNERS 伙伴', '多智能体 · 协作') +
          feature('research', 'RESEARCH 研究', '深搜 · 论文 · 证据') +
          feature('visualize', 'VISUALIZE 可视化', '图表 · SVG · 解释') +
        '</div>') +
      '<div class="dt-two">' +
        card('RECENT 最近', recent.length ? '<div class="dt-list" style="padding:6px 14px;">' + recent.slice(0, 7).map(function (r) {
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(r.title || r.capability || 'Untitled') + '</b><small>' + esc(r.type || r.capability) + ' · ' + fmtDate((r.timestamp || 0) * 1000) + '</small></div><span class="dt-pill">' + esc(r.capability || 'chat') + '</span></div>';
        }).join('') + '</div>' : empty('还没有 DeepTutor 记录')) +
        card('MEMORY 记忆状态', '<div class="dt-list" style="padding:6px 14px;">' + (mem.docs || []).slice(0, 7).map(function (d) {
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(d.layer + ' / ' + d.key) + '</b><small>' + (d.entry_count || 0) + ' entries · ' + (d.exists ? 'ready' : 'empty') + '</small></div><span class="dt-pill">' + esc(d.layer) + '</span></div>';
        }).join('') + '</div>') +
      '</div>' +
      '<div class="dt-note">DeepTutor workspace: <code>data/deeptutor</code> · 与 Memory Lab 卡片/文档数据隔离，导入前不会改写现有数据。</div>';
  }
  function feature(key, name, sub) {
    return '<button class="dt-feature" onclick="DTWorkspace.navigate(\'' + key + '\')"><b>' + name + '</b><small>' + sub + '</small></button>';
  }

  function tutor(content) {
    if (!state.chat) state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '连接中…', mode: 'chat' };
    content.innerHTML =
      '<div class="p5-card">' +
        '<div class="p5-card-header">DEEPTUTOR CHAT 导师' +
          '<div class="dt-actions" style="margin-left:auto;"><button class="btn btn-sm" onclick="DTWorkspace.openSessionHistory()">HISTORY 历史</button><button class="btn btn-sm" onclick="DTWorkspace.newChat()">NEW 新对话</button></div>' +
        '</div>' +
        '<div class="dt-chat-wrap" style="padding:12px 14px;">' +
          '<div class="dt-chat-log" id="dt-chat-log"></div>' +
          '<div class="dt-actions" id="dt-chat-modes" style="margin-bottom:2px;">' +
            ['chat','explain','solve','research','visualize'].map(function (m) {
              return '<button class="dt-tab' + (state.chat.mode === m ? ' is-active' : '') + '" data-dt-mode="' + m + '" onclick="DTWorkspace.setChatMode(\'' + m + '\')">' + m.toUpperCase() + '</button>';
            }).join('') +
          '</div>' +
          '<div class="dt-chat-input"><input class="dt-input" id="dt-chat-text" placeholder="问课程、题目、文档，或让它制定学习路径…" autocomplete="off"><button class="btn btn-primary" id="dt-chat-send" onclick="DTWorkspace.sendChat()">SEND 发送</button></div>' +
          '<div class="dt-note" id="dt-chat-status">' + esc(state.chat.status) + '</div>' +
        '</div>' +
      '</div>';
    var input = document.getElementById('dt-chat-text');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } });
    paintChat();
    connectChat();
    if (window.__dtPendingMode) { setChatMode(window.__dtPendingMode); window.__dtPendingMode = null; }
  }

  function paintChat() {
    var log = document.getElementById('dt-chat-log');
    if (!log || !state.chat) return;
    if (!state.chat.messages.length) {
      log.innerHTML = '<div class="dt-empty">DEEPTUTOR CHAT · 支持课程解释、题目求解、学习路径、知识库引用。<br>当前会话由 DeepTutor 记忆与工具驱动。</div>';
      return;
    }
    log.innerHTML = state.chat.messages.map(function (m, i) {
      var cls = m.role === 'user' ? 'user' : (m.role === 'sys' ? 'sys' : '');
      var actions = m.role === 'assistant' && m.text ? '<div class="dt-msg-actions"><button class="dt-mini-btn" onclick="DTWorkspace.saveChatToNotebook(' + i + ')">SAVE TO NOTEBOOK 保存</button></div>' : '';
      return '<div class="dt-msg ' + cls + '">' + esc(m.text) + actions + '</div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
  }
  async function openSessionHistory() {
    try {
      var data = await dtApi('/api/sessions?limit=30&all_workspaces=true');
      var rows = ((data && data.sessions) || []).filter(function (x) { return !(x.preferences && x.preferences.archived) && !x.archived && !x.is_deleted; });
      var body = '<div class="dt-actions" style="margin-bottom:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newChat()">NEW CHAT 新对话</button><button class="btn btn-sm" onclick="DTWorkspace.openRecycleBin()">ARCHIVED 回收站</button></div>';
      body += rows.length ? '<div class="dt-list">' + rows.map(function (s) {
        var id = s.id || s.session_id;
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(s.title || 'Untitled') + '</b><small>' + esc(s.capability || 'chat') + ' · ' + (s.message_count || 0) + ' msgs · ' + fmtDate(s.updated_at) + '</small></div>' +
          '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.openSession(\'' + esc(id) + '\')">OPEN</button>' +
          '<button class="btn btn-sm" onclick="DTWorkspace.renameSession(\'' + esc(id) + '\',\'' + esc(s.title || '') + '\')">RENAME</button>' +
          '<button class="btn btn-sm btn-danger" onclick="DTWorkspace.deleteSession(\'' + esc(id) + '\')">DEL</button></div></div>';
      }).join('') + '</div>' : empty('还没有历史会话。');
      modal('CHAT HISTORY 对话历史', '恢复、重命名或删除以前的会话', body);
    } catch (e) { toast('读取历史失败：' + e.message, 'error'); }
  }
  async function openRecycleBin() {
    try {
      var data = await dtApi('/api/sessions?limit=100&all_workspaces=true');
      var rows = ((data && data.sessions) || []).filter(function (x) { return (x.preferences && x.preferences.archived) || x.archived || x.is_deleted; });
      try { var rb = await dtApi('/api/sessions/recycle-bin?limit=30'); var extra = rb.sessions || []; extra.forEach(function (x) { if (!rows.some(function (y) { return (y.id || y.session_id) === (x.id || x.session_id); })) rows.push(x); }); } catch (e) {}
      modal('RECYCLE BIN 回收站', rows.length ? rows.length + ' 个已删除会话' : '空',
        (rows.length ? '<div class="dt-list">' + rows.map(function (s) {
          var id = s.id || s.session_id;
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(s.title || 'Untitled') + '</b><small>' + fmtDate(s.deleted_at || s.updated_at) + '</small></div><button class="btn btn-sm btn-primary" onclick="DTWorkspace.restoreSession(\'' + esc(id) + '\')">RESTORE</button></div>';
        }).join('') + '</div>' : '<div class="dt-empty">回收站是空的</div>') + '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.openSessionHistory()">BACK 返回历史</button></div>');
    } catch (e) { toast('读取回收站失败：' + e.message, 'error'); }
  }
  async function openSession(id) {
    try {
      var s = await dtApi('/api/sessions/' + encodeURIComponent(id));
      closeModal();
      state.chat = state.chat || { messages: [] };
      state.chat.sessionId = id;
      state.chat.mode = 'chat';
      state.chat.masteryPathId = null;
      state.chat.messages = (s.messages || []).map(function (m) {
        return { role: (m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'sys' : 'user')), text: m.content || m.text || '' };
      }).filter(function (m) { return m.text; });
      state.chat.busy = false;
      state.chat.status = '已恢复 · ' + (s.title || id);
      if (location.hash !== '#dt-tutor') location.hash = '#dt-tutor';
      setTimeout(function () { var c = document.getElementById('dt-content'); if (c) tutor(c); }, 80);
    } catch (e) { toast('恢复会话失败：' + e.message, 'error'); }
  }
  function renameSession(id, oldTitle) {
    modal('RENAME SESSION 重命名', '只改标题，不改内容。',
      '<div class="dt-form"><input class="dt-input" id="dt-sess-title" value="' + esc(oldTitle) + '" placeholder="会话标题"><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.saveSessionTitle(\'' + esc(id) + '\')">SAVE 保存</button></div></div>');
  }
  async function saveSessionTitle(id) {
    var title = (document.getElementById('dt-sess-title') || {}).value || '';
    if (!title.trim()) { toast('标题不能为空', 'error'); return; }
    try { await dtApi('/api/sessions/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ title: title.trim() }) }); closeModal(); toast('已重命名', 'success'); openSessionHistory(); }
    catch (e) { toast('重命名失败：' + e.message, 'error'); }
  }
  async function deleteSession(id) {
    if (!confirm('把这个会话移入回收站？')) return;
    try { await dtApi('/api/sessions/' + encodeURIComponent(id) + '/organization', { method: 'PATCH', body: JSON.stringify({ archived: true }) }); toast('已移入回收站', 'success'); openSessionHistory(); }
    catch (e) { toast('删除失败：' + e.message, 'error'); }
  }
  async function restoreSession(id) {
    try { await dtApi('/api/sessions/' + encodeURIComponent(id) + '/organization', { method: 'PATCH', body: JSON.stringify({ archived: false }) }); toast('已恢复', 'success'); openSessionHistory(); }
    catch (e) { toast('恢复失败：' + e.message, 'error'); }
  }
  async function saveTextToNotebook(title, text, type, userQuery) {
    try {
      var data = await dtApi('/api/notebooks');
      var list = (data && data.notebooks) || [];
      if (!list.length) { toast('请先在 LIBRARY → Notebook 建一个笔记本', 'error'); return; }
      var opts = list.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.name) + '</option>'; }).join('');
      window.__saveNotebookPayload = { title: title || '', text: text || '', type: type || 'chat', userQuery: userQuery || '' };
      modal('SAVE TO NOTEBOOK 保存到笔记', '选择目标笔记本；保存后可导出或作为学习资料。',
        '<div class="dt-form"><input class="dt-input" id="dt-save-nb-title" value="' + esc(title || '') + '"><select class="dt-select" id="dt-save-nb-target">' + opts + '</select><textarea class="dt-textarea" id="dt-save-nb-text" rows="7">' + esc(text || '') + '</textarea><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.confirmSaveText()">SAVE 保存</button></div></div>');
    } catch (e) { toast('读取笔记本失败：' + e.message, 'error'); }
  }
  async function confirmSaveText() {
    var p = window.__saveNotebookPayload || {};
    var id = (document.getElementById('dt-save-nb-target') || {}).value || '';
    var title = (document.getElementById('dt-save-nb-title') || {}).value || p.title;
    var text = (document.getElementById('dt-save-nb-text') || {}).value || p.text;
    if (!id || !title.trim() || !text.trim()) { toast('标题和内容不能为空', 'error'); return; }
    try {
      await dtApi('/api/notebooks/actions/add-record', { method: 'POST', body: JSON.stringify({ notebook_ids: [id], record_type: p.type || 'chat', title: title.trim(), summary: text.trim().slice(0, 300), user_query: p.userQuery || title.trim(), output: text.trim(), metadata: { source: 'memorylab' }, kb_name: null }) });
      closeModal(); toast('已保存到笔记本', 'success');
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }

  async function saveChatToNotebook(index) {
    if (!state.chat || !state.chat.messages[index]) return;
    var msg = state.chat.messages[index];
    try {
      var data = await dtApi('/api/notebooks');
      var list = (data && data.notebooks) || [];
      if (!list.length) { toast('请先在 LIBRARY → Notebook 建一个笔记本', 'error'); return; }
      var opts = list.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.name) + '</option>'; }).join('');
      var firstUser = state.chat.messages.filter(function (m) { return m.role === 'user'; }).slice(-1)[0];
      var title = (msg.text || '').replace(/\s+/g, ' ').slice(0, 70);
      modal('SAVE TO NOTEBOOK 保存到笔记', '把这条回答收进笔记本，之后可导出或作为学习资料。',
        '<div class="dt-form"><input class="dt-input" id="dt-save-nb-title" value="' + esc(title) + '"><select class="dt-select" id="dt-save-nb-target">' + opts + '</select><textarea class="dt-textarea" id="dt-save-nb-text" rows="6">' + esc(msg.text) + '</textarea><div class="dt-note">来源：Tutor · Chat</div><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.confirmSaveChat(\'' + esc(firstUser ? firstUser.text : '') + '\')">SAVE 保存</button></div></div>');
    } catch (e) { toast('读取笔记本失败：' + e.message, 'error'); }
  }
  async function confirmSaveChat(userQuery) {
    var id = (document.getElementById('dt-save-nb-target') || {}).value || '';
    var title = (document.getElementById('dt-save-nb-title') || {}).value || '';
    var text = (document.getElementById('dt-save-nb-text') || {}).value || '';
    if (!id || !title.trim() || !text.trim()) { toast('标题和内容不能为空', 'error'); return; }
    try {
      await dtApi('/api/notebooks/actions/add-record', { method: 'POST', body: JSON.stringify({ notebook_ids: [id], record_type: 'chat', title: title.trim(), summary: text.trim().slice(0, 300), user_query: userQuery, output: text.trim(), metadata: { source: 'memorylab-chat' }, kb_name: null }) });
      closeModal(); toast('已保存到笔记本', 'success');
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }

  function setChatStatus(text) {
    if (!state.chat) return;
    state.chat.status = text || '';
    var el = document.getElementById('dt-chat-status');
    if (el) el.textContent = text || '';
  }
  function connectChat() {
    if (!state.chat) return;
    if (state.chat.socket && state.chat.socket.readyState <= 1) return;
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    var ws = new WebSocket(proto + location.host + '/dt-ws');
    state.chat.socket = ws;
    ws.onopen = function () { setChatStatus('已连接 DeepTutor · ' + (state.chat.sessionId || '新会话')); };
    ws.onclose = function () { setChatStatus('连接已断开，发送消息会重连'); };
    ws.onerror = function () { setChatStatus('无法连接 DeepTutor 服务'); };
    ws.onmessage = function (ev) {
      var d;
      try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.session_id && !state.chat.sessionId) state.chat.sessionId = d.session_id;
      if (d.type === 'session') { if (d.session_id) state.chat.sessionId = d.session_id; setChatStatus('会话 ' + d.session_id); return; }
      if (d.type === 'content' && d.content) {
        var last = state.chat.messages[state.chat.messages.length - 1];
        if (!last || last.role !== 'assistant') { state.chat.messages.push({ role: 'assistant', text: d.content }); }
        else last.text += d.content;
        paintChat(); return;
      }
      if (d.type === 'progress') { if (d.content) setChatStatus(d.content); return; }
      if (d.type === 'stage_start') { setChatStatus((d.source || 'DeepTutor') + ' · ' + (d.stage || '处理中')); return; }
      if (d.type === 'result' && d.content) {
        var la = state.chat.messages[state.chat.messages.length - 1];
        if (!la || la.role !== 'assistant') state.chat.messages.push({ role: 'assistant', text: d.content });
        else if (la.text.indexOf(d.content) < 0) la.text += d.content;
        paintChat(); return;
      }
      if (d.type === 'error') {
        state.chat.busy = false;
        state.chat.messages.push({ role: 'sys', text: 'ERROR: ' + (d.content || 'DeepTutor 请求失败') });
        setChatStatus('请求失败'); paintChat(); return;
      }
      if (d.type === 'done' || (d.metadata && d.metadata.turn_terminal)) {
        state.chat.busy = false; setChatStatus('就绪'); paintChat();
      }
    };
  }
  function sendChat() {
    if (!state.chat || state.chat.busy) return;
    var input = document.getElementById('dt-chat-text');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    input.value = '';
    state.chat.messages.push({ role: 'user', text: text });
    state.chat.busy = true;
    setChatStatus('DeepTutor 思考中…');
    paintChat();
    connectChat();
    var send = function () {
      if (!state.chat.socket || state.chat.socket.readyState !== 1) { setChatStatus('正在连接…'); setTimeout(send, 500); return; }
      var turn = {
        type: 'start_turn', protocol_version: '2.0', content: text, capability: state.chat.mode || 'chat',
        session_id: state.chat.sessionId || null, language: 'Chinese'
      };
      if (state.chat.masteryPathId) { turn.mastery_path_id = state.chat.masteryPathId; turn.mastery_session_mode = 'study'; turn.workspace_mode = 'mastery'; }
      state.chat.socket.send(JSON.stringify(turn));
    };
    send();
  }
  function setChatMode(mode) {
    if (!state.chat) state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '', mode: 'chat' };
    state.chat.mode = mode || 'chat';
    if (state.chat.mode !== 'mastery_path') state.chat.masteryPathId = null;
    document.querySelectorAll('#dt-chat-modes [data-dt-mode]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-dt-mode') === state.chat.mode);
    });
    var input = document.getElementById('dt-chat-text');
    if (input) input.placeholder = state.chat.mode === 'research' ? '输入研究问题、论文主题或需要核实的观点…' : state.chat.mode === 'visualize' ? '描述要生成的图表、关系图或可视化…' : state.chat.mode === 'solve' ? '输入题目，DeepTutor 会展示推理与步骤…' : state.chat.mode === 'explain' ? '输入概念，让导师拆解…' : '问课程、题目、文档，或让它制定学习路径…';
  }
  function openChatMode(mode) {
    window.__dtPendingMode = mode;
    if (location.hash === '#dt-tutor') {
      setChatMode(mode);
    } else {
      location.hash = '#dt-tutor';
    }
  }
  function newChat() {
    if (state.chat && state.chat.socket) { try { state.chat.socket.close(); } catch (e) {} }
    state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '新会话', mode: 'chat', masteryPathId: null };
    var content = document.getElementById('dt-content');
    if (content) tutor(content);
  }

  async function learning(content) {
    var res = await Promise.allSettled([
      dtApi('/api/mastery-paths/topics'),
      dtApi('/api/books'),
      dtApi('/api/reading/workspaces')
    ]);
    var topics = (res[0].status === 'fulfilled' && res[0].value.topics) || [];
    var books = (res[1].status === 'fulfilled' && res[1].value.books) || [];
    var readings = (res[2].status === 'fulfilled' && res[2].value.workspaces) || [];
    content.innerHTML = '<div class="dt-actions" style="justify-content:flex-end;margin-bottom:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newMastery()">NEW PATH 新建路径</button></div>' +
      '<div class="dt-two">' +
      card('MASTERY PATH 掌握路径', topics.length ? '<div class="dt-list" style="padding:6px 14px;">' + topics.map(function (t) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(t.name || t.title || t.topic) + '</b><small>' + esc((t.metadata && t.metadata.goal) || t.status || '') + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openMastery(\'' + esc(t.path_id || t.id) + '\')">OPEN</button></div>';
      }).join('') + '</div>' : empty('还没有掌握路径')) +
      card('BOOKS 书', books.length ? '<div class="dt-list" style="padding:6px 14px;">' + books.map(function (b) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(b.title || b.name) + '</b><small>' + esc(b.status || '') + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openBook(\'' + esc(b.id) + '\')">OPEN</button></div>';
      }).join('') + '</div>' : empty('还没有学习书')) +
      '</div>' +
      card('READING 阅读', readings.length ? '<div class="dt-list" style="padding:6px 14px;">' + readings.map(function (w) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(w.title || w.name) + '</b><small>' + esc(w.description || '') + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openReading(\'' + esc(w.workspace_id || w.id) + '\')">OPEN</button></div>';
      }).join('') + '</div>' : empty('还没有阅读工作区')) +
      '<div class="dt-note">Mastery Path、Book、Reading 现在都可以从各自的 STUDY 子页创建并打开。</div>';
  }


  async function books(content) {
    var data = await dtApi('/api/books');
    var list = (data && data.books) || [];
    content.innerHTML = card('BOOKS 学习书',
      '<div style="padding:12px 14px;"><div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newBook()">NEW BOOK 新建书</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'books\')">REFRESH 刷新</button></div>' +
      (list.length ? '<div class="dt-list" style="margin-top:10px;">' + list.map(function (b) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(b.title || b.name || b.id) + '</b><small>' + esc(b.status || 'draft') + ' · ' + (b.chapter_count || 0) + ' chapters · ' + (b.page_count || 0) + ' pages</small></div><button class="btn btn-sm" onclick="DTWorkspace.openBook(\'' + esc(b.id) + '\')">OPEN 打开</button></div>';
      }).join('') + '</div>' : empty('还没有学习书。新建时输入主题，DeepTutor 会先生成书籍提案。')) + '</div>');
  }
  async function newBook() {
    var kbs = [];
    try { var d = await dtApi('/api/knowledge-bases'); kbs = Array.isArray(d) ? d : []; } catch (e) {}
    var kbOpts = kbs.map(function (k) { var n = k.name || k.kb_name || k.id; return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    modal('NEW BOOK 新建学习书', '输入主题；可选择一个知识库作为来源。生成提案后可确认并编译。',
      '<div class="dt-form"><input class="dt-input" id="dt-book-intent" placeholder="例如：两周掌握 Java 集合框架"><textarea class="dt-textarea" id="dt-book-desc" rows="2" placeholder="补充范围/目标（可选）"></textarea>' +
      '<select class="dt-select" id="dt-book-kb"><option value="">不指定知识库</option>' + kbOpts + '</select>' +
      '<select class="dt-select" id="dt-book-depth"><option value="quick">QUICK 快速</option><option value="standard" selected>STANDARD 标准</option><option value="deep">DEEP 深入</option></select>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createBook()">CREATE 生成提案</button></div></div>');
  }
  async function createBook() {
    var intent = (document.getElementById('dt-book-intent') || {}).value || '';
    var extra = (document.getElementById('dt-book-desc') || {}).value || '';
    var kb = (document.getElementById('dt-book-kb') || {}).value || '';
    var depth = (document.getElementById('dt-book-depth') || {}).value || 'standard';
    if (!intent.trim()) { toast('请输入书的主题', 'error'); return; }
    var payload = { source_refs: [], user_intent: (intent + (extra ? '\n' + extra : '')).trim(), language: 'zh', fallback_language: 'zh', depth: depth, knowledge_bases: kb ? [kb] : [] };
    try {
      toast('正在生成书籍提案…', 'success');
      var r = await dtApi('/api/books', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      var b = r.book || r;
      var proposal = r.proposal || b.proposal || {};
      openBookProposal(b, proposal);
    } catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  function openBookProposal(book, proposal) {
    var id = book.id;
    var rev = book.revision || 1;
    var p = proposal || {};
    modal('BOOK PROPOSAL 书籍提案', '确认标题和范围后开始生成目录。',
      '<div class="dt-form"><div class="dt-book-title">' + esc(p.title || book.title || '') + '</div><div class="dt-note" style="margin:6px 0 10px;">' + esc(p.description || book.description || '') + '</div>' +
      '<div class="dt-note">范围：' + esc(p.scope || '') + '</div><div class="dt-note">预计章节：' + (p.estimated_chapters || book.chapter_count || 3) + '</div>' +
      '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.confirmBookProposal(\'' + esc(id) + '\',' + rev + ')">CONFIRM & BUILD 确认</button></div></div>');
  }
  async function openProposalById(id) {
    try {
      var r = await dtApi('/api/books/' + encodeURIComponent(id));
      var b = r.book || r;
      openBookProposal(b, b.proposal || {});
    } catch (e) { toast('读取提案失败：' + e.message, 'error'); }
  }
  async function confirmBookProposal(id, rev) {
    try {
      toast('正在生成目录…', 'success');
      await dtApi('/api/books/confirm-proposal', { method: 'POST', body: JSON.stringify({ book_id: id, proposal: null, expected_revision: rev }) });
      toast('目录已生成，正在打开…', 'success');
      setTimeout(function () { DTWorkspace.openBook(id); }, 1200);
    } catch (e) { toast('确认失败：' + e.message, 'error'); }
  }
  async function openBook(id) {
    try {
      var r = await dtApi('/api/books/' + encodeURIComponent(id));
      var b = r.book || r;
      var spine = r.spine || b.spine || r;
      var chapters = (spine && (spine.chapters || spine.nodes)) || [];
      var allPages = r.pages || [];
      var pages = allPages;
      var byChapter = {};
      allPages.forEach(function (pg) { (byChapter[pg.chapter_id || pg.chapterId || ''] = byChapter[pg.chapter_id || pg.chapterId || ''] || []).push(pg); });
      chapters.forEach(function (ch) { ch.pages = (ch.pages && ch.pages.length) ? ch.pages : (byChapter[ch.id] || []); });
      var body = '<div class="dt-note">' + esc(b.description || '') + '</div><div class="dt-actions" style="margin:8px 0;"><span class="dt-pill">' + esc(b.status || 'draft') + '</span><span class="dt-pill">' + (b.chapter_count || chapters.length || 0) + ' CHAPTERS</span><span class="dt-pill">' + (b.page_count || pages.length || 0) + ' PAGES</span></div>';
      if (chapters.length) {
        body += '<div class="dt-list">' + chapters.map(function (ch) {
          var chPages = ch.pages || [];
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(ch.title || ch.name || 'Chapter') + '</b><small>' + chPages.length + ' pages</small></div><div class="dt-actions">' + chPages.map(function (pg) { return '<button class="btn btn-sm" onclick="DTWorkspace.openBookPage(\'' + esc(id) + '\',\'' + esc(pg.id || pg.page_id) + '\')">' + esc(pg.title || 'PAGE') + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>';
      } else if (pages.length) {
        body += '<div class="dt-list">' + pages.map(function (pg) { return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(pg.title || 'Page') + '</b></div><button class="btn btn-sm" onclick="DTWorkspace.openBookPage(\'' + esc(id) + '\',\'' + esc(pg.id || pg.page_id) + '\')">OPEN</button></div>'; }).join('') + '</div>';
      } else {
        body += '<div class="dt-empty">这本书还没有目录/页面。</div>';
        if (b.status === 'draft' || b.proposal) body += '<div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.openProposalById(\'' + esc(id) + '\')">VIEW PROPOSAL 查看提案</button></div>';
        else body += '<div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.buildBookSpine(\'' + esc(id) + '\',' + (b.revision || 1) + ')">BUILD 生成目录</button></div>';
      }
      body += '<div class="dt-actions" style="margin-top:10px;">' + ((b.page_count || 0) === 0 ? '<button class="btn btn-sm btn-primary" onclick="DTWorkspace.buildBookSpine(\'' + esc(id) + '\',' + (b.revision || 1) + ')">BUILD / COMPILE 编译</button>' : '') + '<button class="btn btn-sm" onclick="DTWorkspace.saveTextToNotebook(\'' + esc(b.title || 'Book') + '\',\'' + esc((b.description || '') + '\n\n状态：' + (b.status || '') + '\n章节：' + (b.chapter_count || 0)) + '\',\'co_writer\')">SAVE TO NOTEBOOK 保存</button><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>';
      modal(b.title || 'BOOK', '学习书', body);
    } catch (e) { toast('读取书籍失败：' + e.message, 'error'); }
  }
  async function buildBookSpine(id, rev) {
    try {
      toast('正在生成目录…', 'success');
      await dtApi('/api/books/confirm-spine', { method: 'POST', body: JSON.stringify({ book_id: id, spine: null, auto_compile: true, expected_revision: rev }) });
      toast('目录已生成', 'success');
      setTimeout(function () { DTWorkspace.openBook(id); }, 1200);
    } catch (e) { toast('生成目录失败：' + e.message, 'error'); }
  }
  async function openBookPage(bookId, pageId) {
    try {
      var r = await dtApi('/api/books/' + encodeURIComponent(bookId) + '/pages/' + encodeURIComponent(pageId));
      var page = r.page || r;
      var text = page.markdown || page.content || '';
      if (!text && page.blocks) text = page.blocks.map(function (b) {
        var pld = b.payload || {};
        var val = pld.content || pld.markdown || pld.text || (pld.code && pld.code.content) || b.content || b.text || '';
        if (b.type === 'concept_graph' && pld.chapter_index) val = pld.chapter_index.map(function (x) { return (x.order ? x.order + '. ' : '') + (x.title || ''); }).join('\n');
        if (!val && b.type === 'quiz') val = pld.question || '';
        return (b.title ? '## ' + b.title + '\n' : '') + val;
      }).filter(function (x) { return x.trim(); }).join('\n\n');
      modal(page.title || 'BOOK PAGE', '阅读页', '<div class="dt-book-page">' + esc(text || '这一页还没有内容。') + '</div><div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.saveTextToNotebook(\'' + esc(page.title || 'Book page') + '\',\'' + esc(text) + '\',\'co_writer\')">SAVE TO NOTEBOOK</button><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>');
    } catch (e) { toast('读取页面失败：' + e.message, 'error'); }
  }

  async function reading(content) {
    var data = await dtApi('/api/reading/workspaces');
    var list = (data && data.workspaces) || [];
    content.innerHTML = card('READING 阅读',
      '<div style="padding:12px 14px;"><div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newReading()">NEW WORKSPACE 新建阅读区</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'reading\')">REFRESH 刷新</button></div>' +
      (list.length ? '<div class="dt-list" style="margin-top:10px;">' + list.map(function (w) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(w.title || w.name || w.workspace_id) + '</b><small>' + esc(w.description || '') + ' · ' + ((w.tabs || []).length) + ' materials</small></div><button class="btn btn-sm" onclick="DTWorkspace.openReading(\'' + esc(w.workspace_id || w.id) + '\')">OPEN 打开</button></div>';
      }).join('') + '</div>' : empty('还没有阅读工作区。新建后可以上传材料并创建阅读会话。')) + '</div>');
  }
  function newReading() {
    modal('NEW READING WORKSPACE 新建阅读区', '一个工作区可以放多份材料。',
      '<div class="dt-form"><input class="dt-input" id="dt-read-title" placeholder="例如：计算机网络教材"><textarea class="dt-textarea" id="dt-read-desc" rows="2" placeholder="说明（可选）"></textarea><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createReading()">CREATE 创建</button></div></div>');
  }
  async function createReading() {
    var title = (document.getElementById('dt-read-title') || {}).value || '';
    var desc = (document.getElementById('dt-read-desc') || {}).value || '';
    if (!title.trim()) { toast('请输入标题', 'error'); return; }
    try { await dtApi('/api/reading/workspaces', { method: 'POST', body: JSON.stringify({ title: title.trim(), description: desc.trim() }) }); closeModal(); toast('阅读区已创建', 'success'); go('reading'); }
    catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  async function openReading(id) {
    try {
      var r = await dtApi('/api/reading/workspaces/' + encodeURIComponent(id));
      var w = r.workspace || r;
      var sessions = [];
      try { var sr = await dtApi('/api/reading/workspaces/' + encodeURIComponent(id) + '/sessions'); sessions = sr.sessions || sr || []; } catch (e) {}
      var mats = w.tabs || w.materials || [];
      var body = '<div class="dt-note">' + esc(w.description || '') + '</div><div class="dt-actions" style="margin:8px 0;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.uploadReading(\'' + esc(id) + '\')">UPLOAD MATERIAL 上传材料</button><button class="btn btn-sm" onclick="DTWorkspace.createReadingSession(\'' + esc(id) + '\')">NEW SESSION 新会话</button></div>';
      body += mats.length ? '<div class="dt-list">' + mats.map(function (m) {
        var mm = m.material || m;
        var mid = mm.material_id || mm.id || m.material_id;
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(mm.title || mm.name || mid) + '</b><small>' + esc(mm.status || '') + ' · ' + esc(mm.render_mode || '') + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openReadingMaterial(\'' + esc(mid) + '\')">OPEN</button></div>';
      }).join('') + '</div>' : '<div class="dt-empty">还没有材料。上传 PDF/EPUB/TXT 开始阅读。</div>';
      if (sessions.length) body += '<div class="dt-heading">SESSIONS 阅读会话</div><div class="dt-list">' + sessions.map(function (s) { return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(s.title || s.session_id) + '</b><small>' + fmtDate(s.updated_at) + '</small></div><span class="dt-pill">READING</span></div>'; }).join('') + '</div>';
      body += '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.saveTextToNotebook(\'' + esc(w.title || 'Reading') + '\',\'' + esc('阅读区：' + (w.title || '') + '\n' + (w.description || '') + '\n材料：' + mats.length) + '\',\'reading\')">SAVE TO NOTEBOOK</button><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>';
      modal(w.title || 'READING', '阅读工作区', body);
    } catch (e) { toast('读取阅读区失败：' + e.message, 'error'); }
  }
  function uploadReading(id) {
    var input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,.epub,.txt,.md,.docx';
    input.onchange = async function () {
      var f = input.files[0]; if (!f) return;
      var fd = new FormData(); fd.append('file', f);
      try {
        toast('正在上传并解析…', 'success');
        var resp = await fetch('/dt-api/api/reading/materials', { method: 'POST', body: fd });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var d = await resp.json();
        var m = d.material || d;
        var mid = m.material_id || m.id;
        await dtApi('/api/reading/workspaces/' + encodeURIComponent(id) + '/materials', { method: 'POST', body: JSON.stringify({ material_id: mid, make_active: true }) });
        toast('材料已加入', 'success'); openReading(id);
      } catch (e) { toast('上传失败：' + e.message, 'error'); }
    };
    input.click();
  }
  async function createReadingSession(id) {
    try { await dtApi('/api/reading/workspaces/' + encodeURIComponent(id) + '/sessions', { method: 'POST', body: JSON.stringify({ title: 'New reading conversation' }) }); toast('会话已创建', 'success'); openReading(id); }
    catch (e) { toast('创建会话失败：' + e.message, 'error'); }
  }
  async function openReadingMaterial(id) {
    try {
      var resp = await fetch('/dt-api/api/reading/materials/' + encodeURIComponent(id) + '/units/1');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var text = await resp.text();
      var html = text;
      try { var d = JSON.parse(text); html = d.text || d.html || d.content || d.markdown || text; } catch (e) {}
      modal('READING MATERIAL', '阅读材料', '<div class="dt-book-page">' + esc(html.slice(0, 12000)) + '</div><div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.saveTextToNotebook(\'Reading material\',\'' + esc(html.slice(0, 3000)) + '\',\'reading\')">SAVE TO NOTEBOOK</button><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>');
    } catch (e) { toast('读取材料失败：' + e.message, 'error'); }
  }

  async function practice(content) {
    var sum = {};
    var entries = [];
    try { sum = await dtApi('/api/question-notebook/practice/summary'); } catch (e) {}
    try { var er = await dtApi('/api/question-notebook/entries?limit=50'); entries = er.items || []; } catch (e) {}
    content.innerHTML = card('PRACTICE 练习 / 题库',
      '<div style="padding:12px 14px;"><div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newQuestion()">NEW QUESTION 新建题目</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'practice\')">REFRESH 刷新</button></div>' +
      '<div class="dt-two" style="margin-top:10px;">' +
      '<div class="dt-stat"><b>' + (sum.total || 0) + '</b><small>TOTAL 题</small></div><div class="dt-stat"><b>' + (sum.mistakes || 0) + '</b><small>MISTAKES 错题</small></div><div class="dt-stat"><b>' + (sum.due || 0) + '</b><small>DUE 到期</small></div><div class="dt-stat"><b>' + (sum.reviewed_today || 0) + '</b><small>REVIEWED 今日</small></div>' +
      '</div>' +
      (entries.length ? '<div class="dt-list" style="margin-top:10px;">' + entries.map(function (q) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(q.question || 'Question') + '</b><small>' + esc(q.source || '') + ' · ' + esc(q.result || 'new') + ' · v' + ((q.practice && q.practice.version) || 0) + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openPracticeQuestion(' + q.id + ')">OPEN 练习</button></div>';
      }).join('') + '</div>' : empty('题库为空。新建一道题开始练习。')) + '</div>');
  }
  function newQuestion() {
    modal('NEW QUESTION 新建题目', '保存到题库；可立即练习。',
      '<div class="dt-form"><textarea class="dt-textarea" id="dt-q-text" rows="4" placeholder="题目"></textarea><input class="dt-input" id="dt-q-answer" placeholder="正确答案"><textarea class="dt-textarea" id="dt-q-exp" rows="3" placeholder="解析（可选）"></textarea><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createQuestion()">SAVE 保存</button></div></div>');
  }
  async function createQuestion() {
    var q = (document.getElementById('dt-q-text') || {}).value || '';
    var a = (document.getElementById('dt-q-answer') || {}).value || '';
    var e = (document.getElementById('dt-q-exp') || {}).value || '';
    if (!q.trim()) { toast('题目不能为空', 'error'); return; }
    try {
      await dtApi('/api/question-notebook/entries/upsert', { method: 'POST', body: JSON.stringify({ question_id: 'ml_' + Date.now(), question: q.trim(), correct_answer: a.trim(), explanation: e.trim(), origin_type: 'external_import', origin_ref: 'memorylab', source: 'import' }) });
      closeModal(); toast('题目已保存', 'success'); go('practice');
    } catch (e2) { toast('保存失败：' + e2.message, 'error'); }
  }
  async function openPracticeQuestion(id) {
    try {
      var r = await dtApi('/api/question-notebook/practice/questions/' + id);
      var q = r.entry || r;
      window.__practice = { id: id, version: (q.practice && q.practice.version) || 0, answer: q.correct_answer || '', explanation: q.explanation || '' };
      modal('PRACTICE 练习', esc(q.question || ''), '<div class="dt-form"><textarea class="dt-textarea" id="dt-practice-answer" rows="5" placeholder="写下你的答案"></textarea><div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button><button class="btn btn-sm" onclick="DTWorkspace.revealPractice()">REVEAL 查看答案</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.checkPractice(' + id + ')">CHECK 检查</button></div><div id="dt-practice-result" class="dt-note"></div></div>');
    } catch (e) { toast('读取题目失败：' + e.message, 'error'); }
  }
  function revealPractice() {
    var q = window.__practice || {};
    var el = document.getElementById('dt-practice-result');
    if (el) el.innerHTML = '<b>答案：</b>' + esc(q.answer || '') + '<br><b>解析：</b>' + esc(q.explanation || '');
    var review = document.getElementById('dt-practice-review');
    if (!review) {
      var holder = document.getElementById('dt-practice-result');
      if (holder) holder.innerHTML += '<div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm" onclick="DTWorkspace.reviewPractice(\'again\')">AGAIN</button><button class="btn btn-sm" onclick="DTWorkspace.reviewPractice(\'good\')">GOOD</button><button class="btn btn-sm" onclick="DTWorkspace.reviewPractice(\'easy\')">EASY</button></div>';
    }
  }
  async function checkPractice(id) {
    var ans = (document.getElementById('dt-practice-answer') || {}).value || '';
    try {
      var r = await dtApi('/api/question-notebook/practice/questions/' + id + '/check', { method: 'POST', body: JSON.stringify({ answer: ans }) });
      var el = document.getElementById('dt-practice-result');
      if (el) el.innerHTML = '<b>检查结果：</b>' + esc(r.correct === true ? '正确' : (r.correct === false ? '错误' : '已提交，请对照答案')) + '<div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm" onclick="DTWorkspace.revealPractice()">REVEAL 答案</button></div>';
    } catch (e) { toast('检查失败：' + e.message, 'error'); }
  }
  async function reviewPractice(rating) {
    var q = window.__practice || {};
    var ans = (document.getElementById('dt-practice-answer') || {}).value || '';
    var req = 'mlr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    try { await dtApi('/api/question-notebook/practice/questions/' + q.id + '/review', { method: 'POST', body: JSON.stringify({ answer: ans, rating: rating, request_id: req, version: q.version || 0 }) }); toast('已记录复习', 'success'); closeModal(); go('practice'); }
    catch (e) { toast('复习失败：' + e.message, 'error'); }
  }

  async function openMastery(id) {
    try {
      var r = await dtApi('/api/mastery-paths/topics/' + encodeURIComponent(id));
      var t = r.topic || r;
      var sessions = [];
      try { var sr = await dtApi('/api/mastery-paths/topics/' + encodeURIComponent(id) + '/sessions'); sessions = sr.sessions || sr || []; } catch (e) {}
      var map = t.map || {};
      var mods = map.modules || t.modules || [];
      var body = '<div class="dt-note">' + esc(t.metadata && t.metadata.goal || t.goal || '') + '</div><div class="dt-actions" style="margin:8px 0;"><span class="dt-pill">' + (map.counts && map.counts.total || 0) + ' OBJECTIVES</span><span class="dt-pill">' + (sessions.length || 0) + ' SESSIONS</span></div>';
      if (mods.length) body += '<div class="dt-list">' + mods.map(function (m) { return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(m.name || m.title || 'Module') + '</b><small>' + esc(m.status || '') + '</small></div><span class="dt-pill">MODULE</span></div>'; }).join('') + '</div>';
      else body += '<div class="dt-empty">还没有模块。点击 STUDY 在导师中开始学习。</div>';
      if (sessions.length) body += '<div class="dt-heading">SESSIONS</div><div class="dt-list">' + sessions.map(function (s) { return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(s.title || s.session_id) + '</b><small>' + fmtDate(s.updated_at) + '</small></div></div>'; }).join('') + '</div>';
      body += '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.studyMastery(\'' + esc(id) + '\',\'' + esc(t.name || '') + '\')">STUDY 开始学习</button><button class="btn btn-sm" onclick="DTWorkspace.saveTextToNotebook(\'' + esc(t.name || 'Mastery Path') + '\',\'' + esc('目标：' + ((t.metadata && t.metadata.goal) || '') + '\n模块：' + mods.map(function (m) { return m.name || m.title || ''; }).join(' / ')) + '\',\'question\')">SAVE TO NOTEBOOK</button><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>';
      modal(t.name || 'MASTERY PATH', '掌握路径', body);
    } catch (e) { toast('读取路径失败：' + e.message, 'error'); }
  }
  function studyMastery(id, name) {
    closeModal();
    if (state.chat && state.chat.socket) { try { state.chat.socket.close(); } catch (e) {} }
    state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '', mode: 'mastery_path', masteryPathId: id };
    location.hash = '#dt-tutor';
    setTimeout(function () {
      var input = document.getElementById('dt-chat-text');
      if (input) { input.value = '开始学习「' + (name || '') + '」，请先给我一个诊断问题。'; input.focus(); }
    }, 250);
  }


  var ingestState = { files: [], categories: [], busy: false, last: null };
  var INGEST_EXT = /\.(pdf|docx?|md|markdown|txt|pptx?|epub)$/i;
  var DOCS_EXT = /\.(pdf|docx?|pptx?)$/i;

  async function ingest(content) {
    if (!ingestState.files.length && ingestState.last) {
      // keep the last import visible as a status card, but start with an empty list
    }
    content.innerHTML = card('INGEST 资料导入',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-note" style="margin-bottom:10px;">选一个文件夹或文件；AI 会自动分类，然后把资料同时归档到 <b>Knowledge 知识库</b> 和 <b>Notebook 笔记</b>。PDF/Word/PPT 可同步到 DOCS 教程文档。</div>' +
        '<div class="dt-actions" style="margin-bottom:8px;">' +
          '<button class="btn btn-sm btn-primary" onclick="DTWorkspace.pickIngestFolder()">SELECT FOLDER 选择文件夹</button>' +
          '<button class="btn btn-sm" onclick="DTWorkspace.pickIngestFiles()">SELECT FILES 选择文件</button>' +
          '<button class="btn btn-sm" onclick="DTWorkspace.openDocsFromIngest()">OPEN DOCS 教程文档</button>' +
        '</div>' +
        '<input type="file" id="dt-ingest-files" multiple hidden accept=".pdf,.doc,.docx,.md,.markdown,.txt,.ppt,.pptx,.epub" onchange="DTWorkspace.ingestInputChanged(this)">' +
        '<input type="file" id="dt-ingest-folder" webkitdirectory directory multiple hidden onchange="DTWorkspace.ingestInputChanged(this)">' +
        '<div class="dt-ingest-drop" id="dt-ingest-drop">' +
          '<b>DROP FILES HERE 拖拽文件到这里</b><small>也可以点上面的 SELECT FOLDER，从文件管理器选择整个文件夹。</small>' +
        '</div>' +
        '<div class="dt-actions" style="margin:10px 0 6px;">' +
          '<button class="btn btn-sm btn-primary" id="dt-ingest-ai" onclick="DTWorkspace.classifyIngest()">AI CLASSIFY 自动分类</button>' +
          '<button class="btn btn-sm" id="dt-ingest-import" onclick="DTWorkspace.importIngest()">IMPORT / ARCHIVE 归档</button>' +
          '<button class="btn btn-sm" onclick="DTWorkspace.clearIngest()">CLEAR 清空</button>' +
          '<label class="dt-inline-check"><input type="checkbox" id="dt-ingest-docs" checked> 同步到 DOCS 教程</label>' +
        '</div>' +
        '<div class="dt-note" id="dt-ingest-status"></div>' +
        '<div class="dt-note" id="dt-ingest-embed"></div>' +
        '<div id="dt-ingest-count" class="dt-note"></div>' +
        '<div id="dt-ingest-skip" class="dt-ingest-skip"></div>' +
        '<div id="dt-ingest-list"></div>' +
      '</div>');
    var drop = document.getElementById('dt-ingest-drop');
    if (drop) {
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
      drop.addEventListener('drop', async function (e) {
        e.preventDefault(); drop.classList.remove('is-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          await ingestAddFiles(Array.from(e.dataTransfer.files), '');
        }
      });
    }
    renderIngestList();
    checkIngestEmbedding();
  }
  async function checkIngestEmbedding() {
    var el = document.getElementById('dt-ingest-embed');
    if (!el) return null;
    try {
      var st = await dtApi('/api/system/status');
      var e = (st && st.embeddings) || {};
      ingestState.embeddingReady = e.status === 'configured';
      if (!ingestState.embeddingReady) {
        el.innerHTML = '<span style="color:var(--accent);">EMBEDDING 未配置：文件仍会存入 Knowledge，但不会建立向量索引。当前 P5 只配置了聊天模型，Embedding 是独立模型；接入后在 KNOWLEDGE → OPEN → REINDEX。</span>';
      } else {
        el.textContent = 'EMBEDDING 已配置：知识库会自动建立索引。';
      }
      return ingestState.embeddingReady;
    } catch (e) {
      el.textContent = '无法检查 Embedding 状态：' + e.message;
      return null;
    }
  }

  function ingestInputChanged(input) {
    if (!input || !input.files) return;
    ingestAddFiles(Array.from(input.files), '');
    input.value = '';
  }
  function pickIngestFiles() {
    var el = document.getElementById('dt-ingest-files');
    if (el) el.click();
  }
  async function pickIngestFolder() {
    if (window.showDirectoryPicker) {
      try {
        var dir = await showDirectoryPicker({ mode: 'read' });
        setIngestStatus('正在扫描文件夹…', false);
        await scanIngestDirectory(dir, '');
        setIngestStatus('扫描完成', false);
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        // fall through to webkitdirectory input when the API is unavailable
      }
    }
    var el = document.getElementById('dt-ingest-folder');
    if (el) el.click();
  }
  async function scanIngestDirectory(dir, prefix) {
    for await (var entry of dir.values()) {
      if (ingestState.files.length >= 200) { toast('最多一次导入 200 个文件', 'error'); return; }
      if (entry.kind === 'file') {
        var f = await entry.getFile();
        await ingestAddFiles([f], prefix);
      } else if (entry.kind === 'directory') {
        await scanIngestDirectory(entry, prefix ? prefix + '/' + entry.name : entry.name);
      }
    }
  }
  function ingestSupported(name) {
    return INGEST_EXT.test(name || '');
  }
  function ingestSkipReason(name, rel) {
    var low = String(name || '').toLowerCase();
    if (!ingestSupported(name)) return '不支持的格式 .' + ((name.split('.').pop() || 'unknown').toLowerCase());
    if (low === '.ds_store' || low.startsWith('~$') || low.endsWith('.tmp')) return '系统/临时文件';
    if (/(^|\/)(\.git|node_modules|__MACOSX|\.cache)(\/|$)/i.test(rel || '')) return '系统/缓存目录';
    return '';
  }
  async function ingestAddFiles(files, prefix) {
    var added = 0, skipped = 0;
    var skipInfo = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var rel = prefix ? prefix + '/' + f.name : (f.webkitRelativePath || f.name);
      var reason = ingestSkipReason(f.name, rel);
      if (reason) { skipped++; skipInfo.push({ name: rel, reason: reason }); continue; }
      if (f.size > 200 * 1024 * 1024) { skipped++; skipInfo.push({ name: rel, reason: '超过 200MB' }); continue; }
      if (ingestState.files.some(function (x) { return x.relPath === rel && x.size === f.size; })) { skipped++; skipInfo.push({ name: rel, reason: '重复文件（已在列表）' }); continue; }
      if (ingestState.files.length >= 200) { skipped++; skipInfo.push({ name: rel, reason: '超过 200 个文件上限' }); break; }
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      var excerpt = '';
      if (/^(md|markdown|txt)$/i.test(ext)) {
        try { excerpt = (await f.text()).slice(0, 1200); } catch (e) {}
      }
      ingestState.files.push({
        id: 'f' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        file: f, name: f.name, relPath: rel, ext: ext, size: f.size,
        excerpt: excerpt, category: '', status: '待分类', docsStatus: ''
      });
      added++;
    }
    ingestState.skipped = skipInfo;
    if (added) setIngestStatus('已加入 ' + added + ' 个文件' + (skipped ? '，跳过 ' + skipped + ' 个（原因见下）' : ''), false);
    else if (skipped) setIngestStatus('没有可导入的新文件，跳过 ' + skipped + ' 个（原因见下）', true);
    renderIngestList();
  }
  function setIngestStatus(text, error) {
    var el = document.getElementById('dt-ingest-status');
    if (el) { el.textContent = text || ''; el.style.color = error ? 'var(--accent)' : ''; }
  }
  function ingestCategoryOptions() {
    var names = ['未分类'];
    ingestState.files.forEach(function (f) { if (f.category && names.indexOf(f.category) < 0) names.push(f.category); });
    ingestState.categories.forEach(function (c) { if (c && names.indexOf(c) < 0) names.push(c); });
    return names;
  }
  function setIngestCategory(id, value) {
    var f = ingestState.files.filter(function (x) { return x.id === id; })[0];
    if (f) { f.category = value || '未分类'; renderIngestList(); }
  }
  function clearIngest() {
    if (ingestState.busy) return;
    ingestState.files = []; ingestState.categories = []; ingestState.last = null; ingestState.skipped = [];
    setIngestStatus('', false); renderIngestList();
  }
  function renderIngestList() {
    var list = document.getElementById('dt-ingest-list');
    var count = document.getElementById('dt-ingest-count');
    if (!list) return;
    if (count) {
      var cats = {};
      ingestState.files.forEach(function (f) { cats[f.category || '未分类'] = 1; });
      count.textContent = ingestState.files.length + ' 个文件 · ' + Object.keys(cats).length + ' 个分类' + (ingestState.last ? ' · 上次：' + ingestState.last : '');
    }
    var skipBox = document.getElementById('dt-ingest-skip');
    if (skipBox) {
      skipBox.innerHTML = (ingestState.skipped || []).length ? '<b>SKIPPED 跳过：</b>' + ingestState.skipped.map(function (s) { return '<div>' + esc(s.name) + ' — ' + esc(s.reason) + '</div>'; }).join('') : '';
    }
    if (!ingestState.files.length) {
      list.innerHTML = '<div class="dt-empty">还没有选择文件。点 SELECT FOLDER 从文件管理器选择整个文件夹。</div>';
      return;
    }
    var options = ingestCategoryOptions();
    list.innerHTML = '<div class="dt-list">' + ingestState.files.map(function (f) {
      var opts = options.map(function (c) { return '<option value="' + esc(c) + '"' + ((f.category || '未分类') === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
      return '<div class="dt-ingest-row"><div class="dt-ingest-file"><b>' + esc(f.name) + '</b><small>' + esc(f.relPath) + ' · ' + f.ext.toUpperCase() + ' · ' + Math.round(f.size / 1024) + ' KB</small>' + (f.excerpt ? '<div class="dt-ingest-excerpt">' + esc(f.excerpt.slice(0, 160)) + '</div>' : '') + '</div>' +
        '<select class="dt-select dt-ingest-cat" onchange="DTWorkspace.setIngestCategory(\'' + f.id + '\',this.value)">' + opts + '</select>' +
        '<span class="dt-ingest-status">' + esc(f.status || '') + (f.indexStatus ? ' · ' + esc(f.indexStatus) : '') + (f.docsStatus ? ' · DOCS ' + esc(f.docsStatus) : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function buildClassifyPrompt(files) {
    var items = files.slice(0, 80).map(function (f) {
      return { id: f.id, name: f.name, path: f.relPath, ext: f.ext, size_kb: Math.round(f.size / 1024), excerpt: (f.excerpt || '').slice(0, 500) };
    });
    return '你是学习资料管理员。根据文件名、相对路径、类型和摘录，把文件分到 3-8 个中文主题分类。\n' +
      '只输出合法 JSON，不要 Markdown 代码块，不要解释。格式：\n' +
      '{"categories":[{"name":"分类名","description":"分类说明"}],"files":[{"id":"文件id","category":"分类名"}]}\n' +
      '分类要适合学习资料归档，例如：Java 后端、计算机网络、数学、英语、操作系统、数据库、未分类。\n' +
      '文件列表：\n' + JSON.stringify(items);
  }
  function extractJsonObject(raw) {
    var text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    var a = text.indexOf('{'); var b = text.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('AI 没有返回 JSON');
    return JSON.parse(text.slice(a, b + 1));
  }
  function parseClassification(raw) {
    var obj = extractJsonObject(raw);
    var cats = [];
    if (Array.isArray(obj.categories)) {
      obj.categories.forEach(function (c) { var n = typeof c === 'string' ? c : (c && c.name); if (n) cats.push(String(n).trim()); });
    }
    var map = {};
    if (Array.isArray(obj.files)) {
      obj.files.forEach(function (x) { if (x && x.id && x.category) map[String(x.id)] = String(x.category).trim(); });
    } else if (obj.files && typeof obj.files === 'object') {
      Object.keys(obj.files).forEach(function (k) { if (obj.files[k]) map[k] = String(obj.files[k]).trim(); });
    }
    var names = [];
    cats.concat(Object.keys(map).map(function (k) { return map[k]; })).forEach(function (n) {
      if (n && names.indexOf(n) < 0) names.push(n);
    });
    if (!names.length) throw new Error('AI 分类为空');
    ingestState.categories = names.slice(0, 8);
    ingestState.files.forEach(function (f) {
      var c = map[f.id];
      f.category = c && names.indexOf(c) >= 0 ? c : (f.category || '未分类');
      if (names.indexOf(f.category) < 0) ingestState.categories.push(f.category);
    });
    // files outside the first 80 stay unclassified rather than being guessed by the model
    return true;
  }
  function ingestFallbackCategory(rel) {
    var s = String(rel || '').toLowerCase();
    if (/(java|spring|mybatis|jdk|jvm|maven|gradle)/.test(s)) return 'Java 后端';
    if (/(network|tcp|udp|http|dns|计算机网络|网络)/.test(s)) return '计算机网络';
    if (/(math|calculus|linear|algebra|概率|数学|高数|线代)/.test(s)) return '数学';
    if (/(english|ielts|toefl|英语|词汇|语法)/.test(s)) return '英语';
    if (/(database|mysql|sql|redis|数据库)/.test(s)) return '数据库';
    if (/(operating|linux|操作系统|进程|线程)/.test(s)) return '操作系统';
    if (/(history|历史)/.test(s)) return '历史';
    return '未分类';
  }
  function localClassifyIngest() {
    ingestState.files.forEach(function (f) { f.category = ingestFallbackCategory(f.relPath + ' ' + f.name); });
    ingestState.categories = [];
    ingestState.files.forEach(function (f) { if (ingestState.categories.indexOf(f.category) < 0) ingestState.categories.push(f.category); });
  }
  function askDeepTutor(prompt, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
      var ws;
      var buf = '';
      var sid = '';
      var settled = false;
      function finish(ok, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (e) {}
        if (sid) {
          fetch('/dt-api/api/sessions/' + encodeURIComponent(sid), { method: 'DELETE' }).catch(function () {});
        }
        if (ok) resolve(value); else reject(value);
      }
      var timer = setTimeout(function () { finish(false, new Error('AI 分类超时')); }, timeoutMs || 150000);
      try { ws = new WebSocket(proto + location.host + '/dt-ws'); } catch (e) { finish(false, e); return; }
      ws.onopen = function () {
        ws.send(JSON.stringify({ type: 'start_turn', protocol_version: '2.0', content: prompt, capability: 'chat', session_id: null, language: 'Chinese' }));
      };
      ws.onmessage = function (ev) {
        var d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (d.session_id) sid = d.session_id;
        if (d.type === 'content' && d.content) buf += d.content;
        if (d.type === 'result' && d.content) { if (buf.indexOf(d.content) < 0) buf += d.content; }
        if (d.type === 'error') { finish(false, new Error(d.content || 'AI 请求失败')); return; }
        if (d.type === 'done' || (d.metadata && d.metadata.turn_terminal)) { finish(true, buf); }
      };
      ws.onerror = function () { finish(false, new Error('无法连接 AI 分类服务')); };
      ws.onclose = function () { if (!settled) finish(buf ? true : false, buf ? buf : new Error('AI 连接关闭')); };
    });
  }
  async function classifyIngest() {
    if (ingestState.busy || !ingestState.files.length) { toast('先选择文件', 'error'); return; }
    ingestState.busy = true;
    setIngestStatus('AI 正在阅读文件名和摘录并分类…（首次可能较慢）', false);
    var aiWorked = false;
    try {
      var raw = await askDeepTutor(buildClassifyPrompt(ingestState.files), 180000);
      aiWorked = parseClassification(raw);
    } catch (e) {
      localClassifyIngest();
      setIngestStatus('AI 不可用，已用本地规则分类：' + e.message, true);
    }
    ingestState.busy = false;
    if (aiWorked) setIngestStatus('AI 分类完成：' + ingestState.categories.length + ' 个分类。可手动调整后再归档。', false);
    renderIngestList();
  }
  function ingestFileStatus(file, text) { file.status = text; renderIngestList(); }
  async function ensureIngestNotebook(name) {
    var data = await dtApi('/api/notebooks');
    var list = (data && data.notebooks) || [];
    var found = list.filter(function (n) { return n.name === name; })[0];
    if (found) return found.id;
    var r = await dtApi('/api/notebooks', { method: 'POST', body: JSON.stringify({ name: name, description: '由资料导入自动创建', color: '#e60012', icon: 'book' }) });
    return (r.notebook && r.notebook.id) || r.id;
  }
  async function ensureIngestKb(name) {
    var data = await dtApi('/api/knowledge-bases');
    var list = Array.isArray(data) ? data : [];
    var found = list.filter(function (k) { return (k.name || k.kb_name) === name; })[0];
    if (found) return found.name || found.kb_name || name;
    var fd = new FormData();
    fd.append('name', name);
    fd.append('rag_provider', 'llamaindex');
    await dtApi('/api/knowledge-bases', { method: 'POST', body: fd });
    return name;
  }
  async function uploadIngestKb(kb, file) {
    var fd = new FormData();
    fd.append('files', file.file, file.name);
    fd.append('rel_paths', file.relPath);
    fd.append('rag_provider', 'llamaindex');
    await dtApi('/api/knowledge-bases/' + encodeURIComponent(kb) + '/upload', { method: 'POST', body: fd });
  }
  async function uploadIngestDocs(file) {
    if (!DOCS_EXT.test(file.name)) return 'skip';
    var fd = new FormData();
    fd.append('file', file.file);
    fd.append('user_id', '1');
    var resp = await fetch('/api/documents/upload', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('DOCS HTTP ' + resp.status);
    return 'ok';
  }
  async function addIngestNotebookRecord(nbId, category, file) {
    var summary = '来自资料导入；分类：' + category + '；文件：' + file.relPath + '；大小：' + Math.round(file.size / 1024) + ' KB。';
    var output = summary + (file.excerpt ? '\n\n摘录：\n' + file.excerpt.slice(0, 900) : '');
    await dtApi('/api/notebooks/actions/add-record', {
      method: 'POST',
      body: JSON.stringify({
        notebook_ids: [nbId], record_type: 'co_writer', title: file.name,
        summary: output.slice(0, 500), user_query: file.relPath, output: output,
        metadata: { source: 'memorylab-ingest', category: category, rel_path: file.relPath },
        kb_name: category
      })
    });
  }
  async function importIngest() {
    if (ingestState.busy || !ingestState.files.length) { toast('先选择文件', 'error'); return; }
    ingestState.busy = true;
    var syncDocs = document.getElementById('dt-ingest-docs');
    var doDocs = !!(syncDocs && syncDocs.checked);
    var names = [];
    ingestState.files.forEach(function (f) {
      var c = f.category || '未分类';
      if (names.indexOf(c) < 0) names.push(c);
    });
    setIngestStatus('准备知识库和笔记本…', false);
    var embeddingReady = await checkIngestEmbedding();
    var targets = {};
    for (var i = 0; i < names.length; i++) {
      var cat = names[i];
      try {
        var nb = await ensureIngestNotebook(cat);
        var kb = await ensureIngestKb(cat);
        targets[cat] = { notebook: nb, kb: kb };
      } catch (e) {
        targets[cat] = { error: e.message };
      }
    }
    var ok = 0, fail = 0;
    for (var j = 0; j < ingestState.files.length; j++) {
      var f = ingestState.files[j];
      var cat = f.category || '未分类';
      var t = targets[cat] || {};
      if (t.error) { f.status = '分类归档失败：' + t.error; fail++; renderIngestList(); continue; }
      try {
        f.status = '上传知识库…'; renderIngestList();
        await uploadIngestKb(t.kb, f);
        f.indexStatus = embeddingReady === false ? '未索引（Embedding 未配置）' : '已提交索引';
        if (doDocs && DOCS_EXT.test(f.name)) {
          f.status = '同步 DOCS…'; renderIngestList();
          try { f.docsStatus = await uploadIngestDocs(f); }
          catch (e) { f.docsStatus = '失败'; }
        }
        f.status = '写入笔记…'; renderIngestList();
        await addIngestNotebookRecord(t.notebook, cat, f);
        f.status = embeddingReady === false ? '已归档（未索引）' : '已归档'; ok++; renderIngestList();
      } catch (e) {
        f.status = '失败：' + e.message; fail++; renderIngestList();
      }
    }
    ingestState.busy = false;
    ingestState.last = new Date().toLocaleString('zh-CN');
    try { localStorage.setItem('memorylab.ingest.last', ingestState.last); } catch (e) {}
    var suffix = embeddingReady === false ? ' Knowledge 文件已保存，但 Embedding 未配置，索引未建立；配置后到 KNOWLEDGE 点 REINDEX。' : '';
    setIngestStatus('归档完成：' + ok + ' 个成功' + (fail ? '，' + fail + ' 个失败' : '') + '。分类已进入 LIBRARY → KNOWLEDGE / NOTEBOOK。' + suffix, fail > 0 || embeddingReady === false);
    toast('资料归档完成：' + ok + ' 成功 / ' + fail + ' 失败', fail ? 'error' : 'success');
    renderIngestList();
  }
  function openDocsFromIngest() {
    if (window.loadPage) loadPage('documents');
    else location.hash = '#documents';
  }
  window.openIngest = function () {
    if (window.loadPage) loadPage('dt-ingest');
    else location.hash = '#dt-ingest';
  };

  async function knowledge(content) {
    var kbs = await dtApi('/api/knowledge-bases');
    kbs = Array.isArray(kbs) ? kbs : [];
    content.innerHTML = card('KNOWLEDGE BASES 知识库',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newKb()">NEW KB 新建知识库</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'knowledge\')">REFRESH 刷新</button></div>' +
        (kbs.length ? '<div class="dt-list" style="margin-top:10px;">' + kbs.map(function (k) {
          var name = k.name || k.kb_name || k.id;
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(name) + '</b><small>' + ((k.statistics && (k.statistics.raw_documents || k.statistics.raw_documents === 0)) ? k.statistics.raw_documents : (k.file_count || 0)) + ' files · ' + esc((k.statistics && k.statistics.rag_provider) || 'default') + '</small></div>' +
            '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.openKb(\'' + esc(name) + '\')">OPEN 详情</button><button class="btn btn-sm" onclick="DTWorkspace.uploadKb(\'' + esc(name) + '\')">UPLOAD</button><button class="btn btn-sm btn-danger" onclick="DTWorkspace.deleteKb(\'' + esc(name) + '\')">DEL</button></div></div>';
        }).join('') + '</div>' : empty('还没有知识库。上传 PDF/Word/PPT 后可在导师中引用。')) +
      '</div>');
  }
  async function openKb(name) {
    try {
      var rs = await Promise.allSettled([
        dtApi('/api/knowledge-bases/' + encodeURIComponent(name)),
        dtApi('/api/knowledge-bases/' + encodeURIComponent(name) + '/progress'),
        dtApi('/api/knowledge-bases/' + encodeURIComponent(name) + '/indexing-readiness')
      ]);
      function val(i, d) { return rs[i].status === 'fulfilled' ? rs[i].value : d; }
      var info = val(0, {}); var prog = val(1, {}); var ready = val(2, {});
      var files = [];
      try { var fr = await dtApi('/api/knowledge-bases/' + encodeURIComponent(name) + '/files'); files = fr.files || fr.items || (Array.isArray(fr) ? fr : []); } catch (e) {}
      var st = info.statistics || {};
      var body = '<div class="dt-actions" style="margin-bottom:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.reindexKb(\'' + esc(name) + '\')">REINDEX 重建索引</button><button class="btn btn-sm" onclick="DTWorkspace.uploadKb(\'' + esc(name) + '\')">UPLOAD 上传</button></div>';
      body += '<div class="dt-note">状态：' + esc(info.status || st.status || ready.status || 'ready') + ' · 文档：' + (st.raw_documents != null ? st.raw_documents : files.length) + ' · RAG：' + esc(st.rag_provider || 'default') + (st.rag_initialized === false ? ' · 未初始化' : '') + '</div>';
      if (st.needs_reindex) body += '<div class="dt-note" style="color:var(--accent);">索引需要重建</div>';
      if (prog && (prog.status || prog.progress != null)) body += '<div class="dt-note">任务：' + esc(prog.status || '') + ' ' + esc(prog.message || '') + '</div>';
      body += files.length ? '<div class="dt-list" style="margin-top:8px;">' + files.map(function (x) {
        var fn = x.filename || x.name || x.file || 'file';
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(fn) + '</b><small>' + esc(x.status || x.index_status || 'indexed') + ' · ' + (x.size || x.size_bytes || 0) + ' bytes</small></div><button class="btn btn-sm" onclick="DTWorkspace.previewKbFile(\'' + esc(name) + '\',\'' + esc(fn) + '\')">PREVIEW</button></div>';
      }).join('') + '</div>' : '<div class="dt-empty">还没有文档。上传 PDF/Word/PPT 后这里显示索引状态。</div>';
      body += '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>';
      modal('KNOWLEDGE BASE · ' + name, '文档 · 索引 · 重建', body);
    } catch (e) { toast('读取知识库失败：' + e.message, 'error'); }
  }
  async function reindexKb(name) {
    try { await dtApi('/api/knowledge-bases/' + encodeURIComponent(name) + '/reindex', { method: 'POST', body: '{}' }); toast('已开始重建索引', 'success'); setTimeout(function () { openKb(name); }, 1000); }
    catch (e) { toast('重建失败：' + e.message, 'error'); }
  }
  async function previewKbFile(name, filename) {
    try {
      var resp = await fetch('/dt-api/api/knowledge-bases/' + encodeURIComponent(name) + '/file-preview-text/' + encodeURIComponent(filename));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var text = await resp.text();
      modal('FILE · ' + filename, '索引文本预览', '<div class="dt-book-page">' + esc(text.slice(0, 20000)) + '</div><div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.openKb(\'' + esc(name) + '\')">BACK</button></div>');
    } catch (e) { toast('预览失败：' + e.message, 'error'); }
  }

  function modal(title, sub, body) {
    var old = document.getElementById('dt-modal-mask');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'dt-modal-mask';
    el.className = 'dt-modal-mask';
    el.innerHTML = '<div class="dt-modal"><h3>' + esc(title) + '</h3><p>' + esc(sub || '') + '</p>' + body + '</div>';
    el.addEventListener('click', function (e) { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
    return el;
  }
  function closeModal() { var el = document.getElementById('dt-modal-mask'); if (el) el.remove(); }

  function newKb() {
    var el = modal('NEW KNOWLEDGE BASE', '创建后上传资料；RAG 索引需要 embedding 配置。',
      '<div class="dt-form"><input class="dt-input" id="dt-kb-name" placeholder="Knowledge base name"><textarea class="dt-textarea" id="dt-kb-desc" rows="3" placeholder="Description (optional)"></textarea>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createKb()">CREATE 创建</button></div></div>');
  }
  async function createKb() {
    var name = (document.getElementById('dt-kb-name') || {}).value || '';
    if (!name.trim()) { toast('请输入知识库名称', 'error'); return; }
    var fd = new FormData();
    fd.append('name', name.trim());
    try {
      await dtApi('/api/knowledge-bases', { method: 'POST', body: fd });
      closeModal(); toast('知识库已创建', 'success'); go('knowledge');
    } catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  function uploadKb(name) {
    var input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.docx,.doc,.pptx,.ppt,.md,.txt';
    input.onchange = async function () {
      if (!input.files.length) return;
      var fd = new FormData();
      for (var i = 0; i < input.files.length; i++) fd.append('files', input.files[i]);
      try {
        toast('正在上传 ' + input.files.length + ' 个文件…', 'info');
        await dtApi('/api/knowledge-bases/' + encodeURIComponent(name) + '/upload', { method: 'POST', body: fd });
        toast('已上传，等待索引', 'success'); go('knowledge');
      } catch (e) { toast('上传失败：' + e.message, 'error'); }
    };
    input.click();
  }
  async function deleteKb(name) {
    if (!confirm('删除知识库 ' + name + '？')) return;
    try { await dtApi('/api/knowledge-bases/' + encodeURIComponent(name), { method: 'DELETE' }); toast('已删除', 'success'); go('knowledge'); }
    catch (e) { toast('删除失败：' + e.message, 'error'); }
  }

  async function notebook(content) {
    var data = await dtApi('/api/notebooks');
    var list = (data && data.notebooks) || [];
    content.innerHTML = card('NOTEBOOKS 笔记本',
      '<div style="padding:12px 14px;"><div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newNotebook()">NEW NOTEBOOK 新建</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'notebook\')">REFRESH 刷新</button></div>' +
      (list.length ? '<div class="dt-list" style="margin-top:10px;">' + list.map(function (n) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(n.name) + '</b><small>' + (n.record_count || 0) + ' records · ' + esc(n.description || '') + '</small></div><button class="btn btn-sm" onclick="DTWorkspace.openNotebook(\'' + esc(n.id) + '\')">OPEN 打开</button></div>';
      }).join('') + '</div>' : empty('还没有笔记本。把导师回答、题目和研究记录收进来。')) + '</div>');
  }
  function newNotebook() {
    modal('NEW NOTEBOOK', '为这门课建立一个收集主题。',
      '<div class="dt-form"><input class="dt-input" id="dt-nb-name" placeholder="Notebook name"><textarea class="dt-textarea" id="dt-nb-desc" rows="3" placeholder="Description (optional)"></textarea>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createNotebook()">CREATE 创建</button></div></div>');
  }
  async function createNotebook() {
    var name = (document.getElementById('dt-nb-name') || {}).value || '';
    var desc = (document.getElementById('dt-nb-desc') || {}).value || '';
    if (!name.trim()) { toast('请输入名称', 'error'); return; }
    try { await dtApi('/api/notebooks', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: desc.trim(), color: '#e60012', icon: 'book' }) }); closeModal(); toast('笔记本已创建', 'success'); go('notebook'); }
    catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  async function openNotebook(id) {
    try {
      var n = await dtApi('/api/notebooks/' + encodeURIComponent(id));
      var recs = n.records || n.items || [];
      var body = '<div class="dt-actions" style="margin-bottom:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newNotebookRecord(\'' + esc(id) + '\')">NEW RECORD 新建记录</button><button class="btn btn-sm" onclick="DTWorkspace.exportNotebook(\'' + esc(id) + '\',\'' + esc(n.name || 'notebook') + '\')">EXPORT 导出 MD</button></div>';
      body += recs.length ? '<div class="dt-list">' + recs.map(function (r) {
        var rid = r.id || r.record_id;
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(r.title || r.summary || r.output || 'Record') + '</b><small>' + esc(r.record_type || r.type || 'note') + ' · ' + fmtDate(r.created_at) + '</small>' +
          (r.summary ? '<div class="dt-note" style="margin-top:4px;">' + esc(String(r.summary).slice(0, 220)) + '</div>' : '') +
          '</div><button class="btn btn-sm btn-danger" onclick="DTWorkspace.deleteNotebookRecord(\'' + esc(id) + '\',\'' + esc(rid) + '\')">DEL</button></div>';
      }).join('') + '</div>' : '<div class="dt-empty">还没有记录。把导师回答、题目、研究结论收进来。</div>';
      body += '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE 关闭</button></div>';
      modal(n.name || 'NOTEBOOK', recs.length + ' records · ' + (n.description || '收集、整理、导出'), body);
    } catch (e) { toast('读取失败：' + e.message, 'error'); }
  }
  function newNotebookRecord(id) {
    modal('NEW RECORD 新建记录', '把一段内容收进这个笔记本；以后可用于生成书、阅读或伙伴上下文。',
      '<div class="dt-form"><input class="dt-input" id="dt-nbr-title" placeholder="标题，例如：TCP 拥塞控制总结">' +
      '<select class="dt-select" id="dt-nbr-type"><option value="co_writer">NOTE 笔记 / 写作</option><option value="chat">CHAT 对话摘录</option><option value="question">QUESTION 题目</option><option value="research">RESEARCH 研究</option></select>' +
      '<textarea class="dt-textarea" id="dt-nbr-content" rows="8" placeholder="内容、结论、题目解析……"></textarea>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createNotebookRecord(\'' + esc(id) + '\')">SAVE 保存</button></div></div>');
  }
  async function createNotebookRecord(id) {
    var title = (document.getElementById('dt-nbr-title') || {}).value || '';
    var type = (document.getElementById('dt-nbr-type') || {}).value || 'co_writer';
    var content = (document.getElementById('dt-nbr-content') || {}).value || '';
    if (!title.trim() || !content.trim()) { toast('标题和内容不能为空', 'error'); return; }
    try {
      await dtApi('/api/notebooks/actions/add-record', { method: 'POST', body: JSON.stringify({
        notebook_ids: [id], record_type: type, title: title.trim(),
        summary: content.trim().slice(0, 300), user_query: title.trim(), output: content.trim(),
        metadata: { source: 'memorylab' }, kb_name: null
      }) });
      closeModal(); toast('记录已加入笔记本', 'success'); openNotebook(id);
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }
  async function deleteNotebookRecord(id, rid) {
    if (!confirm('删除这条记录？')) return;
    try { await dtApi('/api/notebooks/' + encodeURIComponent(id) + '/records/' + encodeURIComponent(rid), { method: 'DELETE' }); toast('记录已删除', 'success'); openNotebook(id); }
    catch (e) { toast('删除失败：' + e.message, 'error'); }
  }
  async function exportNotebook(id, name) {
    try {
      var resp = await fetch('/dt-api/api/notebooks/' + encodeURIComponent(id) + '/export');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var text = await resp.text();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      a.download = (name || 'notebook') + '.md'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) { toast('导出失败：' + e.message, 'error'); }
  }

  async function memory(content) {
    var data = await dtApi('/api/memory/overview');
    var docs = data.docs || [];
    content.innerHTML = card('MEMORY 记忆',
      '<div style="padding:12px 14px;" class="dt-list">' + (docs.length ? docs.map(function (d) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(d.layer + ' / ' + d.key) + '</b><small>' + (d.entry_count || 0) + ' entries · ' + (d.exists ? 'ready' : 'empty') + ' · ' + fmtDate(d.updated_at) + '</small></div><span class="dt-pill">' + esc(d.layer) + '</span></div>';
      }).join('') : empty('记忆还是空的。和导师多聊几轮后自动沉淀。')) + '</div>') +
      '<div class="dt-note">L1 事实 / L2 学习状态 / L3 画像与偏好 · 由 DeepTutor 自动维护。</div>';
  }

  async function calendar(content) {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    var end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    var res = await Promise.allSettled([dtApi('/api/calendar/calendars'), dtApi('/api/calendar/events?start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end) + '&tz=Asia%2FShanghai')]);
    var data = res[0].status === 'fulfilled' ? res[0].value : { calendars: [] };
    var events = (res[1].status === 'fulfilled' && res[1].value.occurrences) || [];
    var cals = data.calendars || [];
    content.innerHTML = card('CALENDAR 日历',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newEvent()">NEW EVENT 新建日程</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'calendar\')">REFRESH 刷新</button></div>' +
        '<div class="dt-list" style="margin-top:10px;">' + (events.length ? events.map(function (e) {
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(e.title || '(untitled)') + '</b><small>' + fmtDate(e.start) + ' → ' + fmtDate(e.end) + '</small></div><span class="dt-pill">EVENT</span></div>';
        }).join('') : '<div class="dt-empty">本月还没有日程</div>') + '</div>' +
        '<div class="dt-note" style="margin-top:10px;">' + cals.length + ' 个日历 · 与 DeepTutor 学习计划、Mastery review、任务块共享。</div>' +
      '</div>');
  }
  function newEvent() {
    var d = new Date(Date.now() + 3600000);
    function local(v) { var x = new Date(v); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    modal('NEW EVENT 新建日程', '时间存入 DeepTutor Calendar，和 Mastery review 共用。',
      '<div class="dt-form"><input class="dt-input" id="dt-ev-title" placeholder="标题"><input class="dt-input" id="dt-ev-start" type="datetime-local" value="' + local(d) + '"><input class="dt-input" id="dt-ev-end" type="datetime-local" value="' + local(new Date(d.getTime() + 3600000)) + '"><textarea class="dt-textarea" id="dt-ev-notes" rows="2" placeholder="备注"></textarea>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createEvent()">CREATE 创建</button></div></div>');
  }
  async function createEvent() {
    var title = (document.getElementById('dt-ev-title') || {}).value || '';
    var start = (document.getElementById('dt-ev-start') || {}).value;
    var end = (document.getElementById('dt-ev-end') || {}).value;
    var notes = (document.getElementById('dt-ev-notes') || {}).value || '';
    if (!title.trim() || !start || !end) { toast('标题和时间不能为空', 'error'); return; }
    try {
      await dtApi('/api/calendar/events', { method: 'POST', body: JSON.stringify({ calendar_id: 'default', title: title.trim(), notes: notes, start: new Date(start).toISOString(), end: new Date(end).toISOString(), tzid: 'Asia/Shanghai' }) });
      closeModal(); toast('日程已创建', 'success'); go('calendar');
    } catch (e) { toast('创建失败：' + e.message, 'error'); }
  }

  async function tasks(content) {
    var data = await dtApi('/api/task-board');
    var cards = data.cards || [];
    var groups = { todo: [], doing: [], done: [] };
    cards.forEach(function (c) { (groups[c.status] || groups.todo).push(c); });
    content.innerHTML = '<div class="dt-actions" style="justify-content:flex-end;margin-bottom:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newTask()">NEW TASK 新建任务</button></div>' +
      '<div class="dt-grid" style="grid-template-columns:repeat(3,1fr);">' +
      ['todo', 'doing', 'done'].map(function (st) {
        return '<div class="p5-card"><div class="p5-card-header">' + st.toUpperCase() + ' · ' + groups[st].length + '</div><div style="padding:8px 12px;min-height:160px;">' +
          (groups[st].length ? groups[st].map(function (c) {
            return '<div class="dt-feature" style="margin-bottom:7px;border-left-color:' + esc((data.colors || {})[st] || '#e60012') + '"><b>' + esc(c.title || c.text || 'Task') + '</b><small>' + esc(c.description || '') + '</small></div>';
          }).join('') : '<div class="dt-empty">EMPTY</div>') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="dt-note">任务看板来自 DeepTutor Task Board；新建卡片与拖拽下一步接入。</div>';
  }

  function newTask() {
    modal('NEW TASK 新建任务', '任务会进入 DeepTutor Task Board。',
      '<div class="dt-form"><input class="dt-input" id="dt-task-title" placeholder="任务标题"><textarea class="dt-textarea" id="dt-task-note" rows="2" placeholder="备注"></textarea><input class="dt-input" id="dt-task-due" type="date">' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createTask()">CREATE 创建</button></div></div>');
  }
  async function createTask() {
    var title = (document.getElementById('dt-task-title') || {}).value || '';
    var note = (document.getElementById('dt-task-note') || {}).value || '';
    var due = (document.getElementById('dt-task-due') || {}).value || null;
    if (!title.trim()) { toast('请输入任务标题', 'error'); return; }
    try { await dtApi('/api/task-board/cards', { method: 'POST', body: JSON.stringify({ title: title.trim(), note: note, due_date: due || null }) }); closeModal(); toast('任务已创建', 'success'); go('tasks'); }
    catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  function newMastery() {
    modal('NEW MASTERY PATH', '输入学习目标，DeepTutor 会生成掌握路径。',
      '<div class="dt-form"><input class="dt-input" id="dt-mastery-name" placeholder="路径名称（可选）"><textarea class="dt-textarea" id="dt-mastery-goal" rows="3" placeholder="我想掌握……"></textarea>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createMastery()">CREATE 创建</button></div></div>');
  }
  async function createMastery() {
    var name = (document.getElementById('dt-mastery-name') || {}).value || '';
    var goal = (document.getElementById('dt-mastery-goal') || {}).value || '';
    if (!goal.trim()) { toast('请输入学习目标', 'error'); return; }
    try { await dtApi('/api/mastery-paths/topics', { method: 'POST', body: JSON.stringify({ name: name.trim(), goal: goal.trim(), sources: [], must_cover: [], modules: [] }) }); closeModal(); toast('掌握路径已创建', 'success'); go('learning'); }
    catch (e) { toast('创建失败：' + e.message, 'error'); }
  }

  async function partners(content) {
    var res = await Promise.allSettled([dtApi('/api/partners'), dtApi('/api/partner-groups')]);
    var data = res[0].status === 'fulfilled' ? res[0].value : [];
    var list = Array.isArray(data) ? data : (data.partners || []);
    var groups = res[1].status === 'fulfilled' ? (res[1].value.groups || res[1].value || []) : [];
    content.innerHTML = card('PARTNERS 伙伴',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newPartner()">NEW PARTNER 新建伙伴</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'partners\')">REFRESH 刷新</button></div>' +
        '<div class="dt-note" style="margin-top:8px;">伙伴是带独立人格、模型、工具、资源和记忆的常驻智能体；伙伴组可让多个伙伴同桌讨论。账号级配置，不随课程工作区切换。</div>' +
        '<div class="dt-list" style="margin-top:10px;">' + (list.length ? list.map(function (p) {
          var name = p.name || p.display_name || 'Partner';
          var id = p.partner_id || p.id;
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc((p.emoji ? p.emoji + ' ' : '') + name) + '</b><small>' + esc(p.description || '') + (p.model ? ' · ' + esc(p.model) : '') + (p.running ? ' · running' : '') + '</small></div>' +
            '<div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.openPartnerChat(\'' + esc(id) + '\',\'' + esc(name) + '\')">CHAT 聊天</button><button class="btn btn-sm" onclick="DTWorkspace.editPartner(\'' + esc(id) + '\')">EDIT 设置</button><button class="btn btn-sm btn-danger" onclick="DTWorkspace.deletePartner(\'' + esc(id) + '\')">DEL</button></div></div>';
        }).join('') : empty('还没有伙伴。点 NEW PARTNER 创建第一个常驻智能体。')) + '</div>' +
        (groups.length ? '<div class="dt-note" style="margin-top:10px;">PARTNER GROUPS: ' + groups.map(function(g){return esc(g.name || g.id);}).join(' · ') + '</div>' : '') +
      '</div>');
  }
  function openPartnerChat(id, name) {
    window.__partnerChat = { id: id, name: name, sessionId: null, messages: [] };
    modal('PARTNER CHAT · ' + (name || 'Partner'), '与伙伴独立对话；回答可直接保存到 Notebook。',
      '<div class="dt-partner-log" id="dt-partner-log"><div class="dt-empty">发第一条消息开始。</div></div>' +
      '<div class="dt-chat-input" style="margin-top:8px;"><input class="dt-input" id="dt-partner-input" placeholder="和伙伴说点什么…" autocomplete="off"><button class="btn btn-primary" onclick="DTWorkspace.sendPartnerChat()">SEND 发送</button></div>' +
      '<div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CLOSE</button></div>');
    var input = document.getElementById('dt-partner-input');
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendPartnerChat(); } });
  }
  function paintPartnerChat() {
    var box = document.getElementById('dt-partner-log');
    var c = window.__partnerChat;
    if (!box || !c) return;
    box.innerHTML = c.messages.length ? c.messages.map(function (m) {
      var actions = m.role === 'assistant' ? '<div class="dt-msg-actions"><button class="dt-mini-btn" onclick="DTWorkspace.saveTextToNotebook(\'' + esc((m.text || '').slice(0, 60)) + '\',\'' + esc(m.text || '') + '\',\'chat\')">SAVE TO NOTEBOOK</button></div>' : '';
      return '<div class="dt-msg ' + (m.role === 'user' ? 'user' : '') + '">' + esc(m.text) + actions + '</div>';
    }).join('') : '<div class="dt-empty">发第一条消息开始。</div>';
    box.scrollTop = box.scrollHeight;
  }
  async function sendPartnerChat() {
    var c = window.__partnerChat;
    var input = document.getElementById('dt-partner-input');
    var text = input ? input.value.trim() : '';
    if (!c || !text) return;
    if (input) input.value = '';
    c.messages.push({ role: 'user', text: text }); paintPartnerChat();
    c.messages.push({ role: 'assistant', text: '正在思考…' }); paintPartnerChat();
    try {
      var r = await dtApi('/api/partners/' + encodeURIComponent(c.id) + '/chat', { method: 'POST', body: JSON.stringify({ content: text, session_id: c.sessionId }) });
      c.sessionId = r.session_id || c.sessionId;
      c.messages[c.messages.length - 1] = { role: 'assistant', text: r.content || '（没有返回内容）' };
      paintPartnerChat();
    } catch (e) {
      c.messages[c.messages.length - 1] = { role: 'assistant', text: '请求失败：' + e.message };
      paintPartnerChat();
    }
  }

  function newPartner() {
    modal('NEW PARTNER 新建伙伴', '创建常驻智能体；之后可编辑人格、模型、工具和资源。',
      '<div class="dt-form"><input class="dt-input" id="dt-pt-name" placeholder="伙伴名称"><textarea class="dt-textarea" id="dt-pt-desc" rows="2" placeholder="它擅长什么 / 描述"></textarea><div style="display:flex;gap:8px;"><input class="dt-input" id="dt-pt-emoji" placeholder="Emoji（可选）" style="max-width:110px;"><input class="dt-input" id="dt-pt-color" placeholder="#e60012" style="max-width:130px;"><select class="dt-select" id="dt-pt-lang" style="max-width:160px;"><option value="Chinese">中文</option><option value="English">English</option></select></div>' +
      '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.createPartner()">CREATE 创建</button></div></div>');
  }
  async function createPartner() {
    var name = (document.getElementById('dt-pt-name') || {}).value || '';
    var desc = (document.getElementById('dt-pt-desc') || {}).value || '';
    var emoji = (document.getElementById('dt-pt-emoji') || {}).value || '';
    var color = (document.getElementById('dt-pt-color') || {}).value || '#e60012';
    var lang = (document.getElementById('dt-pt-lang') || {}).value || 'Chinese';
    if (!name.trim()) { toast('请输入伙伴名称', 'error'); return; }
    try { await dtApi('/api/partners', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: desc.trim(), emoji: emoji.trim(), color: color, language: lang }) }); closeModal(); toast('伙伴已创建', 'success'); go('partners'); }
    catch (e) { toast('创建失败：' + e.message, 'error'); }
  }
  async function editPartner(id) {
    try {
      var rs = await Promise.allSettled([
        dtApi('/api/partners/' + encodeURIComponent(id)),
        dtApi('/api/partners/' + encodeURIComponent(id) + '/soul'),
        dtApi('/api/partners/tool-options'),
        dtApi('/api/knowledge-bases'),
        dtApi('/api/settings/llm-options'),
        dtApi('/api/partners/channels/schema'),
        dtApi('/api/partners/' + encodeURIComponent(id) + '/assets')
      ]);
      function val(i, fallback) { return rs[i].status === 'fulfilled' && rs[i].value ? rs[i].value : fallback; }
      var p = val(0, {});
      var soul = val(1, { content: '' });
      var tools = val(2, { tools: [], builtin_tools: [] });
      var kbRaw = val(3, {});
      var kbs = kbRaw.knowledge_bases || kbRaw.items || [];
      var llm = val(4, { options: [] });
      var chSchema = val(5, { channels: {} }).channels || {};
      var assets = val(6, { knowledge_bases: [] });
      window.__partnerEdit = { p: p, chSchema: chSchema, assets: assets };
      var enabledTools = p.enabled_tools || [];
      var builtinTools = p.builtin_tools || [];
      var mountedKbs = assets.knowledge_bases || [];
      var commonChannels = ['weixin','feishu','qq','telegram','discord','email','slack','wecom'];
      var channelKeys = commonChannels.filter(function(k){ return chSchema[k] && chSchema[k].available !== false; });
      Object.keys(p.channels || {}).forEach(function(k){ if (channelKeys.indexOf(k) < 0 && chSchema[k]) channelKeys.push(k); });
      var channelHtml = channelKeys.map(function (key) {
        var ch = chSchema[key] || {};
        var def = ch.default_config || {};
        var cfg = (p.channels || {})[key] || {};
        var fields = Object.keys(def).filter(function (f) {
          if (f === 'enabled') return false;
          var t = typeof def[f];
          if (Array.isArray(def[f])) return f === 'allow_from' || f === 'group_allow_from';
          return t === 'string' || t === 'number' || t === 'boolean';
        });
        var isOn = !!cfg.enabled;
        return '<details class="dt-channel" data-channel="' + esc(key) + '">' +
          '<summary><span class="dt-channel-name">' + esc(ch.display_name || key) + '</span><label class="dt-channel-toggle" onclick="event.stopPropagation()"><input type="checkbox" id="dt-ch-' + esc(key) + '-enabled" ' + (isOn ? 'checked' : '') + '> ENABLED</label></summary>' +
          '<div class="dt-channel-body">' + fields.map(function (f) {
            var v = cfg[f] !== undefined ? cfg[f] : def[f];
            var secret = (ch.secret_fields || []).indexOf(f) >= 0;
            var id = 'dt-ch-' + key + '-' + f;
            if (Array.isArray(v)) {
              return '<label class="dt-field"><span>' + esc(f) + '</span><input class="dt-input" data-ch-field="' + esc(f) + '" id="' + esc(id) + '" value="' + esc((v || []).join(', ')) + '" placeholder="逗号分隔"></label>';
            }
            if (typeof v === 'boolean') {
              return '<label class="dt-check"><input type="checkbox" data-ch-field="' + esc(f) + '" id="' + esc(id) + '" ' + (v ? 'checked' : '') + '> ' + esc(f) + '</label>';
            }
            var type = typeof v === 'number' ? 'number' : 'text';
            return '<label class="dt-field"><span>' + esc(f) + '</span><input class="dt-input" type="' + type + '" data-ch-field="' + esc(f) + '" id="' + esc(id) + '" value="' + (secret ? '' : esc(v == null ? '' : v)) + '" placeholder="' + (secret ? '已配置，留空不修改' : '') + '" ' + (secret ? 'data-secret="1"' : '') + '></label>';
          }).join('') + '</div></details>';
      }).join('');
      var modelOptions = (llm.options || []).map(function (o) {
        var v = o.profile_id + '::' + o.model_id;
        var cur = p.llm_selection && p.llm_selection.profile_id === o.profile_id && p.llm_selection.model_id === o.model_id;
        return '<option value="' + esc(v) + '" ' + (cur ? 'selected' : '') + '>' + esc(o.profile_name || o.provider_label || o.provider || 'LLM') + ' / ' + esc(o.model_name || o.model || '') + '</option>';
      }).join('');
      modal('PARTNER SETTINGS 伙伴设置', 'SOUL 人格 · 模型 · 工具白名单 · 知识库 · IM 频道',
        '<div class="dt-form dt-partner-form">' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">BASIC 基础</div>' +
            '<input class="dt-input" id="dt-pt-name" value="' + esc(p.name || '') + '" placeholder="伙伴名称">' +
            '<textarea class="dt-textarea" id="dt-pt-desc" rows="2" placeholder="描述">' + esc(p.description || '') + '</textarea>' +
            '<div class="dt-inline"><input class="dt-input" id="dt-pt-emoji" value="' + esc(p.emoji || '') + '" placeholder="Emoji"><input class="dt-input" id="dt-pt-color" value="' + esc(p.color || '#e60012') + '" placeholder="#e60012"></div>' +
          '</div>' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">SOUL 人格</div><textarea class="dt-textarea" id="dt-pt-soul" rows="8" placeholder="# Soul ...">' + esc(soul.content || '') + '</textarea></div>' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">MODEL 模型</div><select class="dt-select" id="dt-pt-model"><option value="">Use account default</option>' + modelOptions + '</select></div>' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">TOOLS 工具白名单</div><div class="dt-check-grid">' + (tools.tools || []).map(function (t) {
            return '<label class="dt-check" title="' + esc(t.description_i18n && t.description_i18n.zh || t.description || '') + '"><input type="checkbox" data-tool="' + esc(t.name) + '" ' + (enabledTools.indexOf(t.name) >= 0 ? 'checked' : '') + '> ' + esc(t.name) + '</label>';
          }).join('') + '</div><div class="dt-note" style="margin:6px 0 4px;">BUILTIN 内置工具</div><div class="dt-check-grid">' + (tools.builtin_tools || []).map(function (t) {
            return '<label class="dt-check" title="' + esc(t.description_i18n && t.description_i18n.zh || t.description || '') + '"><input type="checkbox" data-builtin="' + esc(t.name) + '" ' + (builtinTools.indexOf(t.name) >= 0 ? 'checked' : '') + '> ' + esc(t.name) + '</label>';
          }).join('') + '</div></div>' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">KNOWLEDGE 知识库</div><div class="dt-check-grid">' + (kbs.length ? kbs.map(function (k) {
            var kid = k.id || k.kb_id || k.name;
            return '<label class="dt-check"><input type="checkbox" data-kb="' + esc(kid) + '" ' + (mountedKbs.indexOf(kid) >= 0 ? 'checked' : '') + '> ' + esc(k.name || kid) + '</label>';
          }).join('') : '<div class="dt-note">还没有知识库，先在 LIBRARY 里创建。</div>') + '</div></div>' +
          '<div class="dt-pt-sec"><div class="dt-pt-title">CHANNELS IM 频道</div>' + (channelHtml || '<div class="dt-note">没有可用频道。</div>') + '</div>' +
          '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.savePartner(\'' + esc(id) + '\')">SAVE ALL 保存全部</button></div>' +
        '</div>');
    } catch (e) { toast('读取伙伴设置失败：' + e.message, 'error'); }
  }
  async function savePartner(id) {
    var name = (document.getElementById('dt-pt-name') || {}).value || '';
    var desc = (document.getElementById('dt-pt-desc') || {}).value || '';
    var emoji = (document.getElementById('dt-pt-emoji') || {}).value || '';
    var color = (document.getElementById('dt-pt-color') || {}).value || '#e60012';
    var soul = (document.getElementById('dt-pt-soul') || {}).value || '';
    var modelVal = (document.getElementById('dt-pt-model') || {}).value || '';
    var enabledTools = Array.prototype.map.call(document.querySelectorAll('[data-tool]:checked'), function (x) { return x.getAttribute('data-tool'); });
    var builtinTools = Array.prototype.map.call(document.querySelectorAll('[data-builtin]:checked'), function (x) { return x.getAttribute('data-builtin'); });
    var kbs = Array.prototype.map.call(document.querySelectorAll('[data-kb]:checked'), function (x) { return x.getAttribute('data-kb'); });
    var llm = null;
    if (modelVal) { var parts = modelVal.split('::'); llm = { profile_id: parts[0], model_id: parts[1] }; }
    var oldChannels = (window.__partnerEdit && window.__partnerEdit.p.channels) || {};
    var channels = JSON.parse(JSON.stringify(oldChannels));
    document.querySelectorAll('[data-channel]').forEach(function (box) {
      var key = box.getAttribute('data-channel');
      var enabled = document.getElementById('dt-ch-' + key + '-enabled');
      var cfg = channels[key] || {};
      cfg.enabled = !!(enabled && enabled.checked);
      box.querySelectorAll('[data-ch-field]').forEach(function (inp) {
        var f = inp.getAttribute('data-ch-field');
        var secret = inp.getAttribute('data-secret') === '1';
        if (inp.type === 'checkbox') cfg[f] = inp.checked;
        else if (inp.type === 'number') cfg[f] = inp.value === '' ? 0 : Number(inp.value);
        else if (f === 'allow_from' || f === 'group_allow_from') cfg[f] = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        else if (secret && !inp.value) { if (cfg[f] === undefined) cfg[f] = ''; }
        else cfg[f] = inp.value;
      });
      channels[key] = cfg;
    });
    try {
      await dtApi('/api/partners/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ name: name.trim(), description: desc.trim(), emoji: emoji.trim(), color: color, llm_selection: llm, enabled_tools: enabledTools, builtin_tools: builtinTools, channels: channels }) });
      await dtApi('/api/partners/' + encodeURIComponent(id) + '/soul', { method: 'PUT', body: JSON.stringify({ content: soul }) });
      if (kbs.length) await dtApi('/api/partners/' + encodeURIComponent(id) + '/assets', { method: 'POST', body: JSON.stringify({ knowledge_bases: kbs }) });
      closeModal(); toast('伙伴设置已保存', 'success'); go('partners');
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }

  async function deletePartner(id) {
    if (!confirm('删除伙伴 ' + id + '？')) return;
    try { await dtApi('/api/partners/' + encodeURIComponent(id), { method: 'DELETE' }); toast('伙伴已删除', 'success'); go('partners'); }
    catch (e) { toast('删除失败：' + e.message, 'error'); }
  }

  async function research(content) {
    var data = await dtApi('/api/dashboard/recent');
    var list = (data || []).filter(function (r) { return /research|solve|explore/i.test(String(r.capability || r.type || '')); });
    content.innerHTML = card('RESEARCH 研究',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-note">从导师发起深搜、论文检索、证据整理。结果会进入最近记录与笔记。</div>' +
        '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.go(\'tutor\')">ASK IN TUTOR 在导师中开始</button></div>' +
        (list.length ? '<div class="dt-list" style="margin-top:10px;">' + list.map(function (r) {
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(r.title || 'Research') + '</b><small>' + fmtDate((r.timestamp || 0) * 1000) + '</small></div><span class="dt-pill">RESEARCH</span></div>';
        }).join('') + '</div>' : empty('还没有研究记录')) + '</div>');
  }

  async function visualize(content) {
    var data = await dtApi('/api/dashboard/recent');
    var list = (data || []).filter(function (r) { return /visual|chart|diagram/i.test(String(r.capability || r.type || '')); });
    content.innerHTML = card('VISUALIZE 可视化',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-note">用导师生成图表、SVG、关系图和解释；结果可保存进笔记。</div>' +
        '<div class="dt-actions" style="margin-top:10px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.go(\'tutor\')">CREATE IN TUTOR 在导师中生成</button></div>' +
        (list.length ? '<div class="dt-list" style="margin-top:10px;">' + list.map(function (r) {
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(r.title || 'Visualization') + '</b><small>' + fmtDate((r.timestamp || 0) * 1000) + '</small></div><span class="dt-pill">VISUAL</span></div>';
        }).join('') + '</div>' : empty('还没有可视化记录')) + '</div>');
  }

  async function modelState() {
    var s = await dtApi('/api/settings');
    var llm = (((s.catalog || {}).services || {}).llm) || {};
    var profiles = llm.profiles || [];
    var p = profiles.filter(function (x) { return x.id === llm.active_profile_id; })[0] || profiles[0] || null;
    var model = p ? (p.models || []).filter(function (m) { return m.id === llm.active_model_id; })[0] || (p.models || [])[0] : null;
    return { settings: s, profile: p, model: model, llm: llm };
  }
  async function mountModelConfig(el) {
    if (!el) return;
    el.innerHTML = '<div class="dt-empty">读取 DeepTutor 模型配置…</div>';
    try {
      var st = await modelState();
      if (!st.profile) {
        el.innerHTML = '<div class="dt-note">还没有配置模型。</div><div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.editModel()">CONFIGURE 配置模型</button></div>';
        return;
      }
      el.innerHTML = '<div class="dt-list">' +
        '<div class="dt-row"><div class="dt-row-main"><b>' + esc(st.model ? (st.model.name || st.model.model) : 'No model') + '</b><small>' + esc(st.profile.binding || 'custom') + ' · ' + esc(st.profile.base_url || '') + '</small></div><span class="dt-pill">' + esc(st.profile.api_format || 'auto') + '</span></div>' +
        '</div><div class="dt-actions" style="margin-top:8px;"><button class="btn btn-sm" onclick="DTWorkspace.editModel()">EDIT 修改</button></div>';
    } catch (e) {
      el.innerHTML = '<div class="error-state">' + esc(e.message) + '</div>';
    }
  }
  async function editModel() {
    try {
      var st = await modelState();
      var p = st.profile || { binding: 'custom', name: 'Agent Setup', base_url: '', api_format: 'openai_chat', models: [] };
      var m = st.model || { id: 'llm-model', name: 'deepseek-v4.1-flash', model: 'deepseek-v4.1-flash' };
      modal('DEEPTUTOR MODEL 模型配置', '保存后 DeepTutor 使用该模型；当前 Key 只显示掩码，留空表示不修改。',
        '<div class="dt-form">' +
          '<input class="dt-input" id="dtm-name" value="' + esc(p.name || 'Agent Setup') + '" placeholder="Profile name">' +
          '<input class="dt-input" id="dtm-base" value="' + esc(p.base_url || '') + '" placeholder="Base URL，例如 https://api.openai.com/v1">' +
          '<input class="dt-input" id="dtm-model" value="' + esc(m.model || m.name || '') + '" placeholder="Model ID">' +
          '<input class="dt-input" id="dtm-key" value="" placeholder="API Key（留空不修改）">' +
          '<select class="dt-select" id="dtm-format"><option value="openai_chat"' + ((p.api_format || 'openai_chat') === 'openai_chat' ? ' selected' : '') + '>OpenAI Chat</option><option value="openai_responses"' + (p.api_format === 'openai_responses' ? ' selected' : '') + '>OpenAI Responses</option><option value="auto"' + (p.api_format === 'auto' ? ' selected' : '') + '>Auto</option></select>' +
          '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.closeModal()">CANCEL</button><button class="btn btn-sm btn-primary" onclick="DTWorkspace.saveModel()">SAVE 保存</button></div>' +
        '</div>');
    } catch (e) { toast('读取模型配置失败：' + e.message, 'error'); }
  }
  async function saveModel() {
    var name = (document.getElementById('dtm-name') || {}).value || 'Agent Setup';
    var base = (document.getElementById('dtm-base') || {}).value || '';
    var model = (document.getElementById('dtm-model') || {}).value || '';
    var key = (document.getElementById('dtm-key') || {}).value || '';
    var fmt = (document.getElementById('dtm-format') || {}).value || 'openai_chat';
    if (!base.trim() || !model.trim()) { toast('Base URL 和 Model 不能为空', 'error'); return; }
    try {
      var st = await modelState();
      var old = st.profile || {};
      var profile = {
        id: old.id || 'llm-profile-custom',
        name: name.trim(),
        binding: old.binding || 'custom',
        base_url: base.trim(),
        api_version: old.api_version || '',
        extra_headers: (function () {
          var h = Object.assign({}, old.extra_headers || {});
          if (base.trim().indexOf('opencode.ai') >= 0 && !h['x-opencode-session']) {
            var sid = localStorage.getItem('memoryLabOpencodeSession');
            if (!sid) {
              var bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
              sid = 'ses_' + Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
              localStorage.setItem('memoryLabOpencodeSession', sid);
            }
            h['x-opencode-session'] = sid;
          }
          return h;
        })(),
        models: [{ id: (st.model && st.model.id) || 'llm-model-custom', name: model.trim(), model: model.trim() }],
        api_format: fmt,
        wire_api: old.wire_api || 'chat_completions'
      };
      profile.api_key = key.trim() || '***';
      await dtApi('/api/settings/apply/provider', { method: 'POST', body: JSON.stringify({ service: 'llm', profile: profile, active_model_id: profile.models[0].id, activate: true }) });
      closeModal();
      toast('DeepTutor 模型配置已保存', 'success');
      var card = document.getElementById('dt-model-body');
      if (card) mountModelConfig(card);
    } catch (e) { toast('保存失败：' + e.message, 'error'); }
  }

  window.DTWorkspace = {
    render: render, renderGroup: renderGroup, renderSection: renderSection, navigate: navigate, go: go, renderTutor: tutor, closeModal: closeModal,
    newKb: newKb, createKb: createKb, uploadKb: uploadKb, deleteKb: deleteKb,
    openSessionHistory: openSessionHistory, openRecycleBin: openRecycleBin, openSession: openSession, renameSession: renameSession, saveSessionTitle: saveSessionTitle, deleteSession: deleteSession, restoreSession: restoreSession,
    saveChatToNotebook: saveChatToNotebook, confirmSaveChat: confirmSaveChat, saveTextToNotebook: saveTextToNotebook, confirmSaveText: confirmSaveText,
    newNotebook: newNotebook, createNotebook: createNotebook, openNotebook: openNotebook,
    newNotebookRecord: newNotebookRecord, createNotebookRecord: createNotebookRecord, deleteNotebookRecord: deleteNotebookRecord, exportNotebook: exportNotebook,
    sendChat: sendChat, newChat: newChat, setChatMode: setChatMode, openChatMode: openChatMode,
    newEvent: newEvent, createEvent: createEvent, newTask: newTask, createTask: createTask,
    newMastery: newMastery, createMastery: createMastery, openMastery: openMastery, studyMastery: studyMastery,
    newBook: newBook, createBook: createBook, openBook: openBook, openBookProposal: openBookProposal, openProposalById: openProposalById, confirmBookProposal: confirmBookProposal, buildBookSpine: buildBookSpine, openBookPage: openBookPage,
    newReading: newReading, createReading: createReading, openReading: openReading, uploadReading: uploadReading, createReadingSession: createReadingSession, openReadingMaterial: openReadingMaterial,
    newQuestion: newQuestion, createQuestion: createQuestion, openPracticeQuestion: openPracticeQuestion, revealPractice: revealPractice, checkPractice: checkPractice, reviewPractice: reviewPractice,
    newPartner: newPartner, createPartner: createPartner, editPartner: editPartner, savePartner: savePartner, deletePartner: deletePartner,
    openPartnerChat: openPartnerChat, sendPartnerChat: sendPartnerChat,
    pickIngestFolder: pickIngestFolder, pickIngestFiles: pickIngestFiles, ingestInputChanged: ingestInputChanged, classifyIngest: classifyIngest, importIngest: importIngest, clearIngest: clearIngest, setIngestCategory: setIngestCategory, openDocsFromIngest: openDocsFromIngest,
    openKb: openKb, reindexKb: reindexKb, previewKbFile: previewKbFile,
    mountModelConfig: mountModelConfig, editModel: editModel, saveModel: saveModel
  };
})();
