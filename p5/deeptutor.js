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
    var d = new Date(v);
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
    study: { title: 'STUDY', cn: '学习', sub: '总览 · 掌握路径', sections: ['overview', 'learning'] },
    library: { title: 'LIBRARY', cn: '资料', sub: '知识库 · 笔记 · 记忆', sections: ['knowledge', 'notebook', 'memory'] },
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
          '<div class="dt-actions" style="margin-left:auto;"><button class="btn btn-sm" onclick="DTWorkspace.newChat()">NEW 新对话</button></div>' +
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
    log.innerHTML = state.chat.messages.map(function (m) {
      return '<div class="dt-msg ' + (m.role === 'user' ? 'user' : (m.role === 'sys' ? 'sys' : '')) + '">' + esc(m.text) + '</div>';
    }).join('');
    log.scrollTop = log.scrollHeight;
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
      state.chat.socket.send(JSON.stringify({
        type: 'start_turn', protocol_version: '2.0', content: text, capability: state.chat.mode || 'chat',
        session_id: state.chat.sessionId || null, language: 'Chinese', capability: state.chat.mode || 'chat'
      }));
    };
    send();
  }
  function setChatMode(mode) {
    if (!state.chat) state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '', mode: 'chat' };
    state.chat.mode = mode || 'chat';
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
    state.chat = { messages: [], sessionId: null, socket: null, busy: false, status: '新会话' };
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
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(t.title || t.name || t.topic) + '</b><small>' + esc(t.status || t.progress || '') + '</small></div><span class="dt-pill">PATH</span></div>';
      }).join('') + '</div>' : empty('还没有掌握路径')) +
      card('BOOKS 书', books.length ? '<div class="dt-list" style="padding:6px 14px;">' + books.map(function (b) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(b.title || b.name) + '</b><small>' + esc(b.status || '') + '</small></div><span class="dt-pill">BOOK</span></div>';
      }).join('') + '</div>' : empty('还没有学习书')) +
      '</div>' +
      card('READING 阅读', readings.length ? '<div class="dt-list" style="padding:6px 14px;">' + readings.map(function (w) {
        return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(w.title || w.name) + '</b><small>' + esc(w.status || '') + '</small></div><span class="dt-pill">READING</span></div>';
      }).join('') + '</div>' : empty('还没有阅读工作区')) +
      '<div class="dt-note">Mastery Path、Book、Reading 的创建与学习流程在 DeepTutor 后端继续可用；当前先把列表与状态接入 P5，创建流程下一步补齐。</div>';
  }

  async function knowledge(content) {
    var kbs = await dtApi('/api/knowledge-bases');
    kbs = Array.isArray(kbs) ? kbs : [];
    content.innerHTML = card('KNOWLEDGE BASES 知识库',
      '<div style="padding:12px 14px;">' +
        '<div class="dt-actions"><button class="btn btn-sm btn-primary" onclick="DTWorkspace.newKb()">NEW KB 新建知识库</button><button class="btn btn-sm" onclick="DTWorkspace.go(\'knowledge\')">REFRESH 刷新</button></div>' +
        (kbs.length ? '<div class="dt-list" style="margin-top:10px;">' + kbs.map(function (k) {
          var name = k.name || k.kb_name || k.id;
          return '<div class="dt-row"><div class="dt-row-main"><b>' + esc(name) + '</b><small>' + ((k.statistics && (k.statistics.raw_documents || k.statistics.raw_documents === 0)) ? k.statistics.raw_documents : (k.file_count || 0)) + ' files · ' + esc((k.statistics && k.statistics.rag_provider) || 'default') + '</small></div>' +
            '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.uploadKb(\'' + esc(name) + '\')">UPLOAD</button><button class="btn btn-sm btn-danger" onclick="DTWorkspace.deleteKb(\'' + esc(name) + '\')">DEL</button></div></div>';
        }).join('') + '</div>' : empty('还没有知识库。上传 PDF/Word/PPT 后可在导师中引用。')) +
      '</div>');
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
            '<div class="dt-actions"><button class="btn btn-sm" onclick="DTWorkspace.editPartner(\'' + esc(id) + '\')">EDIT 设置</button><button class="btn btn-sm btn-danger" onclick="DTWorkspace.deletePartner(\'' + esc(id) + '\')">DEL</button></div></div>';
        }).join('') : empty('还没有伙伴。点 NEW PARTNER 创建第一个常驻智能体。')) + '</div>' +
        (groups.length ? '<div class="dt-note" style="margin-top:10px;">PARTNER GROUPS: ' + groups.map(function(g){return esc(g.name || g.id);}).join(' · ') + '</div>' : '') +
      '</div>');
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
    newNotebook: newNotebook, createNotebook: createNotebook, openNotebook: openNotebook,
    newNotebookRecord: newNotebookRecord, createNotebookRecord: createNotebookRecord, deleteNotebookRecord: deleteNotebookRecord, exportNotebook: exportNotebook,
    sendChat: sendChat, newChat: newChat, setChatMode: setChatMode, openChatMode: openChatMode,
    newEvent: newEvent, createEvent: createEvent, newTask: newTask, createTask: createTask,
    newMastery: newMastery, createMastery: createMastery,
    newPartner: newPartner, createPartner: createPartner, editPartner: editPartner, savePartner: savePartner, deletePartner: deletePartner,
    mountModelConfig: mountModelConfig, editModel: editModel, saveModel: saveModel
  };
})();
