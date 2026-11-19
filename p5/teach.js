/* ================================================================
   TEACH 教学 — data input, simplified materials, pomodoro, music.
   Card glass/scan treatment is inspired by RhineLabUI (MIT):
   https://github.com/LBEILC/RhineLabUI
   ================================================================ */
(function () {
  'use strict';

  var SUPPORTED = ['.pdf', '.docx', '.ppt', '.pptx'];
  var AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac', '.opus', '.webm'];
  var TIMER_KEY = 'memoryLabTeachTimer';

  var teachState = {
    docs: [],
    busy: false,
    studyDocId: null,
    studyStartedAt: 0,
    timer: null,
    music: { tracks: [], index: -1, audio: null, objectUrls: [] }
  };

  function $(id) { return document.getElementById(id); }
  function esc(v) { return (typeof escapeHtml === 'function') ? escapeHtml(String(v == null ? '' : v)) : String(v == null ? '' : v); }
  function toast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'info'); }
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function docById(id) {
    return (teachState.docs || []).filter(function (d) { return Number(d.id) === Number(id); })[0] || null;
  }

  // Small, safe Markdown renderer for document blocks. It intentionally
  // supports only headings, lists, fenced code, bold and inline code.
  function renderTeachMarkdown(text) {
    var lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n');
    var out = [], inCode = false, inList = false;
    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    function inline(s) {
      s = esc(s);
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      return s;
    }
    lines.forEach(function (line) {
      var t = line.trim();
      // The extractor stores one source line per block, so a fenced block is
      // split across blocks. Don't open an empty <pre> for a lone fence.
      if (t.indexOf('```') === 0) { closeList(); return; }
      if (inCode) { out.push(esc(line) + '\n'); return; }
      if (!t) { closeList(); return; }
      var m = t.match(/^(#{1,3})\s+(.+)$/);
      if (m) { closeList(); out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); return; }
      var li = t.match(/^[-*]\s+(.+)$/);
      if (li) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inline(li[1]) + '</li>');
        return;
      }
      closeList();
      out.push('<p class="block-text">' + inline(line) + '</p>');
    });
    closeList();
    if (inCode) out.push('</code></pre>');
    return out.join('');
  }

  // ------------------------------------------------------------
  // Page
  // ------------------------------------------------------------
  function renderTeach(main) {
    teachStopTimer(false);
    teachPauseMusic();
    main.innerHTML =
      '<div class="teach-page">' +
        '<div class="teach-hero">' +
          '<div><div class="teach-hero-kicker">TEACHING LAB / LEARN V7</div>' +
            '<h1>TEACH <em>教学</em></h1>' +
            '<p>把资料变成能学、能看、能复习的内容 · INPUT → SIMPLIFY → FOCUS</p></div>' +
          '<div class="teach-hero-mark">L7</div>' +
        '</div>' +
        '<div class="teach-grid" id="teach-grid">' +
          '<div class="teach-col">' +
            '<section class="p5-card teach-panel">' +
              '<div class="p5-card-header">01 INPUT 资料输入</div>' +
              '<div class="teach-panel-body">' +
                '<div class="teach-drop" id="teach-drop" role="button" tabindex="0" onclick="teachPickFiles()">' +
                  '<div class="teach-drop-icon">↓</div>' +
                  '<strong>DROP FILES HERE</strong>' +
                  '<small>拖入文件或文件夹，也可以点击选择<br>PDF / Word / PPT · 多个文件会排队导入</small>' +
                '</div>' +
                '<div class="teach-input-actions">' +
                  '<button class="btn btn-sm btn-primary" onclick="teachPickFiles()">选择文件</button>' +
                  '<button class="btn btn-sm" onclick="teachPickFolder()">选择文件夹</button>' +
                '</div>' +
                '<input type="file" id="teach-file-input" multiple accept=".pdf,.docx,.ppt,.pptx" style="display:none" onchange="teachHandleFiles(this.files)">' +
                '<input type="file" id="teach-folder-input" webkitdirectory directory multiple style="display:none" onchange="teachHandleFiles(this.files)">' +
                '<div class="teach-upload-log" id="teach-upload-log">等待资料...</div>' +
              '</div>' +
            '</section>' +
            '<section class="p5-card teach-panel">' +
              '<div class="p5-card-header">04 MUSIC 音乐</div>' +
              '<div class="teach-music-body">' +
                '<div class="teach-music-now">' +
                  '<div class="teach-music-title" id="teach-music-title">NO TRACK 未选择</div>' +
                  '<div class="teach-music-sub" id="teach-music-sub">本地文件不会上传，只保留在浏览器中</div>' +
                '</div>' +
                '<div class="teach-music-controls">' +
                  '<button class="btn btn-sm btn-primary" onclick="teachMusicPickFiles()">本地文件</button>' +
                  '<button class="btn btn-sm" onclick="teachMusicPickFolder()">本地文件夹</button>' +
                  '<button class="btn btn-sm" onclick="teachMusicToggle()">PLAY 播放</button>' +
                  '<button class="btn btn-sm" onclick="teachMusicPrev()">PREV</button>' +
                  '<button class="btn btn-sm" onclick="teachMusicNext()">NEXT</button>' +
                  '<button class="btn btn-sm" onclick="teachMusicClear()">CLEAR</button>' +
                '</div>' +
                '<input type="file" id="teach-music-input" accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus" multiple style="display:none" onchange="teachMusicHandleFiles(this.files)">' +
                '<input type="file" id="teach-music-folder" webkitdirectory directory multiple style="display:none" onchange="teachMusicHandleFiles(this.files)">' +
                '<div class="teach-music-list" id="teach-music-list"><div class="teach-empty">尚未导入音乐</div></div>' +
                '<div class="teach-system-box">' +
                  '<div class="teach-system-title">SYSTEM MEDIA 系统媒体</div>' +
                  '<p>浏览器不能直接读取 QQ 音乐 / 网易云 / Spotify 的歌单或歌名；这里发送 Windows 全局媒体键，控制当前系统媒体会话。完整歌单/元数据需要各家官方 API 或 Windows GSMTC 原生桥。</p>' +
                  '<div class="teach-system-controls">' +
                    '<button class="btn btn-sm" onclick="teachSystemMedia(\'play_pause\')">PLAY/PAUSE</button>' +
                    '<button class="btn btn-sm" onclick="teachSystemMedia(\'prev\')">PREV</button>' +
                    '<button class="btn btn-sm" onclick="teachSystemMedia(\'next\')">NEXT</button>' +
                  '</div>' +
                  '<div class="teach-music-sub" id="teach-system-status"></div>' +
                '</div>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<div class="teach-col">' +
            '<section class="p5-card teach-panel">' +
              '<div class="p5-card-header">02 SIMPLIFIED 简化资料</div>' +
              '<div class="teach-panel-body">' +
                '<div class="teach-doc-list" id="teach-doc-list"><div class="teach-empty">读取资料列表...</div></div>' +
                '<div class="teach-note">“本软件观看”会打开下面的阅读器和番茄钟；“外部观看”由系统默认应用打开原文件。PDF 可在 Edge 内预览，Word/PPT 通常会下载后用 Office/WPS 打开。</div>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<div class="teach-col teach-col-study" id="teach-study-col" style="display:none;">' +
            '<section class="p5-card teach-side-card">' +
              '<div class="p5-card-header">03 FOCUS 番茄钟</div>' +
              '<div class="teach-timer-body">' +
                '<div class="teach-timer-ring" id="teach-timer-ring" style="--pct:0">' +
                  '<div class="teach-timer-face">' +
                    '<div class="teach-timer-time" id="teach-timer-time">25:00</div>' +
                    '<div class="teach-timer-phase" id="teach-timer-phase">FOCUS 专注</div>' +
                  '</div>' +
                '</div>' +
                '<div class="teach-timer-controls">' +
                  '<button class="btn btn-sm btn-primary" id="teach-timer-start" onclick="teachTimerStart()">START 开始</button>' +
                  '<button class="btn btn-sm" onclick="teachTimerPause()">PAUSE 暂停</button>' +
                  '<button class="btn btn-sm" onclick="teachTimerReset()">RESET 重置</button>' +
                  '<button class="btn btn-sm" onclick="teachTimerSkip()">SKIP 跳过</button>' +
                '</div>' +
                '<div class="teach-timer-settings">' +
                  '<label>专注分钟<input type="number" id="teach-focus-min" min="1" max="180" value="25" onchange="teachTimerSettings()"></label>' +
                  '<label>休息分钟<input type="number" id="teach-break-min" min="1" max="60" value="5" onchange="teachTimerSettings()"></label>' +
                '</div>' +
                '<div class="teach-timer-note">完成后自动切换阶段，并在后台记录本次阅读时长</div>' +
              '</div>' +
            '</section>' +
          '</div>' +
        '</div>' +
        '<div class="teach-study" id="teach-study">' +
          '<section class="p5-card teach-reader-card">' +
            '<div class="p5-card-header">READER 阅读器 <span id="teach-reader-name" style="font-size:9px;color:var(--text-muted);margin-left:6px;"></span>' +
              '<span style="margin-left:auto;display:flex;gap:5px;">' +
                '<button class="btn btn-sm" onclick="teachGenerateCards()">MAKE CARDS 生成卡片</button>' +
                '<button class="btn btn-sm" onclick="teachCloseStudy()">CLOSE 关闭</button>' +
              '</span>' +
            '</div>' +
            '<div class="teach-reader" id="teach-reader"><div class="teach-empty-study">选择一份资料，在“本软件观看”中打开。</div></div>' +
          '</section>' +
        '</div>' +
      '</div>';

    bindTeachDrop();
    initTeachTimer();
    initTeachMusic();
    loadTeachDocs();
  }

  // ------------------------------------------------------------
  // File import
  // ------------------------------------------------------------
  function teachLog(msg, cls) {
    var el = $('teach-upload-log');
    if (!el) return;
    if (el.dataset.empty !== '0') { el.innerHTML = ''; el.dataset.empty = '0'; }
    var line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function extOf(name) {
    var i = String(name || '').lastIndexOf('.');
    return i >= 0 ? String(name).slice(i).toLowerCase() : '';
  }

  function isSupportedFile(file) {
    return SUPPORTED.indexOf(extOf(file && file.name)) >= 0;
  }

  function teachPickFiles() { var el = $('teach-file-input'); if (el) el.click(); }
  function teachPickFolder() { var el = $('teach-folder-input'); if (el) el.click(); }

  async function readEntry(entry, out) {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise(function (resolve) {
        entry.file(function (f) { out.push(f); resolve(); }, function () { resolve(); });
      });
    } else if (entry.isDirectory) {
      var reader = entry.createReader();
      while (true) {
        var entries = await new Promise(function (resolve) {
          reader.readEntries(function (e) { resolve(e || []); }, function () { resolve([]); });
        });
        if (!entries.length) break;
        for (var i = 0; i < entries.length; i++) await readEntry(entries[i], out);
      }
    }
  }

  async function teachHandleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var supported = files.filter(isSupportedFile);
    var skipped = files.length - supported.length;
    if (skipped) teachLog('跳过 ' + skipped + ' 个非 PDF/Word/PPT 文件', 'bad');
    if (!supported.length) { toast('没有可导入的 PDF / Word / PPT 文件', 'error'); return; }
    await uploadTeachFiles(supported);
  }

  async function teachHandleDrop(ev) {
    ev.preventDefault();
    var zone = $('teach-drop');
    if (zone) zone.classList.remove('is-over');
    var dt = ev.dataTransfer;
    if (!dt) return;
    var files = [];
    var items = dt.items ? Array.prototype.slice.call(dt.items) : [];
    var entries = [];
    items.forEach(function (it) {
      if (it.kind === 'file' && it.webkitGetAsEntry) {
        var entry = it.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
    });
    if (entries.length) {
      for (var i = 0; i < entries.length; i++) await readEntry(entries[i], files);
    } else {
      files = Array.prototype.slice.call(dt.files || []);
    }
    await teachHandleFiles(files);
  }

  function bindTeachDrop() {
    var zone = $('teach-drop');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (name) {
      zone.addEventListener(name, function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (name) {
      zone.addEventListener(name, function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-over'); });
    });
    zone.addEventListener('drop', teachHandleDrop);
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); teachPickFiles(); }
    });
    var fileInput = $('teach-file-input');
    var folderInput = $('teach-folder-input');
    if (fileInput) fileInput.addEventListener('change', function () { this.value = ''; });
    if (folderInput) folderInput.addEventListener('change', function () { this.value = ''; });
  }

  async function uploadTeachFiles(files) {
    if (teachState.busy) { toast('上一批资料还在导入，请稍等', 'info'); return; }
    teachState.busy = true;
    var ok = 0, fail = 0;
    try {
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        teachLog('UPLOAD ' + (i + 1) + '/' + files.length + ' · ' + f.name);
        try {
          var fd = new FormData();
          fd.append('file', f, f.name);
          fd.append('user_id', '1');
          var res = await fetch(API + '/documents/upload', { method: 'POST', body: fd });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok || !data.doc_id) throw new Error(data.error || ('HTTP ' + res.status));
          teachLog('EXTRACT ' + f.name, 'ok');
          var proc = await fetch(API + '/documents/' + data.doc_id + '/process', { method: 'POST' });
          var pdata = await proc.json().catch(function () { return {}; });
          if (!proc.ok) throw new Error(pdata.error || ('提取失败 HTTP ' + proc.status));
          ok++;
          teachLog('READY ' + f.name + ' · ' + (pdata.blocks ? pdata.blocks.length : 0) + ' 块', 'ok');
        } catch (e) {
          fail++;
          teachLog('FAIL ' + f.name + ' · ' + (e.message || e), 'bad');
        }
      }
      toast('导入完成：' + ok + ' 成功' + (fail ? '，' + fail + ' 失败' : ''), fail ? 'error' : 'success');
      await loadTeachDocs();
    } finally {
      teachState.busy = false;
    }
  }

  // ------------------------------------------------------------
  // Simplified materials
  // ------------------------------------------------------------
  async function loadTeachDocs() {
    var list = $('teach-doc-list');
    if (!list) return;
    try {
      var docs = await api('GET', '/documents/list?user_id=' + userId);
      if (!Array.isArray(docs)) throw new Error(docs.error || '资料列表加载失败');
      teachState.docs = docs;
      renderTeachDocs();
    } catch (e) {
      list.innerHTML = '<div class="error-state">' + esc(e.message) + '</div>';
    }
  }

  function renderTeachDocs() {
    var list = $('teach-doc-list');
    if (!list) return;
    var docs = teachState.docs || [];
    if (!docs.length) {
      list.innerHTML = '<div class="teach-empty"><strong>NO MATERIALS 暂无资料</strong><br>从左边导入 PDF / Word / PPT。</div>';
      return;
    }
    list.innerHTML = docs.map(function (d) {
      var total = Number(d.total_blocks || 0);
      var simp = Number(d.simplified_blocks || 0);
      var ready = total > 0 && simp >= total;
      var failed = d.status === 'error';
      var status = failed ? 'ERROR' : (total === 0 ? 'UPLOADED' : (ready ? 'SIMPLIFIED' : (simp > 0 ? 'PARTIAL' : 'EXTRACTED')));
      var pill = failed ? 'bad' : (ready ? 'ready' : (simp > 0 ? 'busy' : ''));
      var buttons = '';
      if (total === 0) buttons += '<button class="btn btn-sm btn-primary" onclick="teachExtractDoc(' + d.id + ')">EXTRACT 提取</button>';
      if (total > 0 && !ready) buttons += '<button class="btn btn-sm btn-primary" onclick="teachSimplifyDoc(' + d.id + ')">AI SIMPLIFY 简化</button>';
      if (total > 0) {
        buttons += '<button class="btn btn-sm btn-success" onclick="teachOpenStudy(' + d.id + ')">IN APP 本软件观看</button>';
        buttons += '<button class="btn btn-sm" onclick="teachOpenExternal(' + d.id + ')">EXTERNAL 外部观看</button>';
      }
      return '<div class="teach-doc" data-doc-id="' + d.id + '">' +
        '<div class="teach-doc-top"><div style="min-width:0;"><div class="teach-doc-name">' + esc(d.original_name) + '</div>' +
          '<div class="teach-doc-meta">' + esc(String(d.file_type || '').toUpperCase()) + ' · ' + total + ' 块 · ' + simp + ' 已简化</div></div>' +
          '<span class="teach-pill ' + pill + '">' + status + '</span></div>' +
        '<div class="teach-doc-actions">' + buttons + '</div>' +
        '<div class="teach-note" data-doc-note="' + d.id + '">' + (failed ? '上次简化失败，点 AI SIMPLIFY 重试' : '') + '</div>' +
      '</div>';
    }).join('');
  }

  async function teachExtractDoc(id) {
    try {
      await api('POST', '/documents/' + id + '/process');
      toast('提取完成', 'success');
      await loadTeachDocs();
    } catch (e) { toast('提取失败：' + e.message, 'error'); }
  }

  async function teachSimplifyDoc(id) {
    var row = document.querySelector('[data-doc-id="' + id + '"]');
    var note = row ? row.querySelector('[data-doc-note]') : null;
    try {
      if (note) note.textContent = '正在启动 AI 简化...';
      var start = await api('POST', '/documents/' + id + '/simplify', {});
      if (start.error) throw new Error(start.error);
      if (note) note.textContent = 'AI 简化中... 可继续使用其他功能';
      var poll = setInterval(async function () {
        try {
          var p = await api('GET', '/documents/' + id + '/progress');
          if (note) note.textContent = '简化进度 ' + (p.simplified || 0) + '/' + (p.total || 0) + (p.status ? ' · ' + p.status : '');
          if (p.status === 'error') {
            clearInterval(poll);
            if (note) note.textContent = '简化失败：' + (p.error || '请检查 API Key');
            toast('简化失败：' + (p.error || '请检查 API Key'), 'error');
            await loadTeachDocs();
          } else if (p.status === 'processed' || (p.total > 0 && p.simplified >= p.total)) {
            clearInterval(poll);
            if (note) note.textContent = '简化完成';
            toast('简化完成', 'success');
            await loadTeachDocs();
          }
        } catch (e) { clearInterval(poll); if (note) note.textContent = '进度读取失败'; }
      }, 1600);
    } catch (e) {
      if (note) note.textContent = e.message;
      toast('简化失败：' + e.message, 'error');
    }
  }

  function teachOpenExternal(id) {
    window.open('/api/documents/' + id + '/download', '_blank', 'noopener');
    toast('已交给系统默认应用打开', 'info');
  }

  // ------------------------------------------------------------
  // Study reader + timer
  // ------------------------------------------------------------
  async function teachOpenStudy(id) {
    var doc = docById(id);
    var study = $('teach-study');
    var col = $('teach-study-col');
    var grid = $('teach-grid');
    var reader = $('teach-reader');
    if (!study || !reader) return;
    teachState.studyDocId = id;
    teachState.studyStartedAt = Date.now();
    study.classList.add('is-on');
    if (col) col.style.display = 'block';
    if (grid) grid.classList.add('has-study');
    var name = $('teach-reader-name');
    if (name) name.textContent = doc ? doc.original_name : ('DOC #' + id);
    reader.innerHTML = '<div class="teach-empty-study">LOADING 加载中...</div>';
    try {
      var data = await api('GET', '/documents/' + id + '/tutorial');
      if (data.error) throw new Error(data.error);
      var chapters = data.tutorial || [];
      var html = '<div class="teach-reader-label">SIMPLIFIED 视图 · 原文与简化文字来自 tutor.db</div>';
      chapters.forEach(function (ch) {
        html += '<div class="chapter-title">' + esc(String(ch.chapter || '未分类').replace(/^(.*?-\s*)?#+\s*/, '')) + '</div>';
        (ch.blocks || []).forEach(function (b) {
          if (b.block_type === 'image') {
            var src = b.image_path || b.image_url || '';
            if (src) html += '<img src="' + esc(src) + '" alt="">';
          } else {
            var text = b.simplified_text || b.original_text || '';
            if (text) html += renderTeachMarkdown(text);
          }
        });
      });
      reader.innerHTML = html || '<div class="teach-empty-study">暂无内容，请先提取或简化。</div>';
      study.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      reader.innerHTML = '<div class="error-state">' + esc(e.message) + '</div>';
    }
  }

  async function teachCloseStudy() {
    var study = $('teach-study');
    var col = $('teach-study-col');
    var grid = $('teach-grid');
    if (study) study.classList.remove('is-on');
    if (col) col.style.display = 'none';
    if (grid) grid.classList.remove('has-study');
    await teachLogStudyTime();
    teachState.studyDocId = null;
    teachState.studyStartedAt = 0;
    teachStopTimer(false);
  }

  async function teachLogStudyTime() {
    if (!teachState.studyDocId || !teachState.studyStartedAt) return;
    var seconds = Math.round((Date.now() - teachState.studyStartedAt) / 1000);
    if (seconds < 5) return;
    try {
      await api('POST', '/documents/' + teachState.studyDocId + '/study-time', { user_id: userId, duration_seconds: seconds });
    } catch (e) {}
  }

  async function teachGenerateCards() {
    if (!teachState.studyDocId) return;
    try {
      var data = await api('POST', '/documents/' + teachState.studyDocId + '/cards');
      if (data.error) throw new Error(data.error);
      if ((data.created_cards || 0) > 0 && typeof awardPersona === 'function') {
        awardPersona('knowledge', 1);
        awardPersona('dexterity', 2);
      }
      toast('已生成 ' + (data.created_cards || 0) + ' 张记忆卡', 'success');
    } catch (e) { toast('生成失败：' + e.message, 'error'); }
  }

  // ------------------------------------------------------------
  // Pomodoro
  // ------------------------------------------------------------
  function defaultTimer() {
    return { focus: 25, break: 5, phase: 'focus', remaining: 25 * 60, running: false, endAt: 0, interval: null };
  }

  function initTeachTimer() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch (e) {}
    var timer = teachState.timer || defaultTimer();
    if (saved) {
      timer.focus = Math.min(180, Math.max(1, Number(saved.focus) || 25));
      timer.break = Math.min(60, Math.max(1, Number(saved.break) || 5));
      timer.remaining = timer.focus * 60;
      timer.phase = 'focus';
      timer.running = false;
      timer.endAt = 0;
    }
    teachState.timer = timer;
    var f = $('teach-focus-min'), b = $('teach-break-min');
    if (f) f.value = timer.focus;
    if (b) b.value = timer.break;
    renderTeachTimer();
  }

  function saveTimerSettings() {
    var t = teachState.timer;
    if (!t) return;
    try { localStorage.setItem(TIMER_KEY, JSON.stringify({ focus: t.focus, break: t.break })); } catch (e) {}
  }

  function teachTimerSettings() {
    var f = Number($('teach-focus-min') && $('teach-focus-min').value) || 25;
    var b = Number($('teach-break-min') && $('teach-break-min').value) || 5;
    var t = teachState.timer;
    if (!t) return;
    t.focus = Math.min(180, Math.max(1, f));
    t.break = Math.min(60, Math.max(1, b));
    if (!t.running) t.remaining = (t.phase === 'focus' ? t.focus : t.break) * 60;
    saveTimerSettings();
    renderTeachTimer();
  }

  function renderTeachTimer() {
    var t = teachState.timer;
    if (!t) return;
    var total = (t.phase === 'focus' ? t.focus : t.break) * 60;
    var pct = total > 0 ? ((total - t.remaining) / total) * 100 : 0;
    var ring = $('teach-timer-ring');
    var time = $('teach-timer-time');
    var phase = $('teach-timer-phase');
    var start = $('teach-timer-start');
    if (ring) ring.style.setProperty('--pct', String(Math.max(0, Math.min(100, pct))));
    if (time) time.textContent = fmtClock(t.remaining);
    if (phase) phase.textContent = t.phase === 'focus' ? 'FOCUS 专注' : 'BREAK 休息';
    if (start) start.textContent = t.running ? 'RUNNING 进行中' : 'START 开始';
  }

  function tickTeachTimer() {
    var t = teachState.timer;
    if (!t || !t.running) return;
    t.remaining = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
    renderTeachTimer();
    if (t.remaining <= 0) completeTeachPhase();
  }

  function teachTimerStart() {
    var t = teachState.timer;
    if (!t) return;
    if (t.running) return;
    if (t.remaining <= 0) t.remaining = (t.phase === 'focus' ? t.focus : t.break) * 60;
    t.running = true;
    t.endAt = Date.now() + t.remaining * 1000;
    if (t.interval) clearInterval(t.interval);
    t.interval = setInterval(tickTeachTimer, 250);
    renderTeachTimer();
  }

  function teachStopTimer(reset) {
    var t = teachState.timer;
    if (!t) return;
    if (t.running) t.remaining = Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
    t.running = false;
    if (t.interval) { clearInterval(t.interval); t.interval = null; }
    if (reset) t.remaining = (t.phase === 'focus' ? t.focus : t.break) * 60;
    renderTeachTimer();
  }

  function teachTimerPause() { teachStopTimer(false); }
  function teachTimerReset() { teachStopTimer(true); }
  function teachTimerSkip() { completeTeachPhase(true); }

  function completeTeachPhase(skip) {
    var t = teachState.timer;
    if (!t) return;
    if (t.interval) { clearInterval(t.interval); t.interval = null; }
    t.running = false;
    if (!skip) beepTeach();
    t.phase = t.phase === 'focus' ? 'break' : 'focus';
    t.remaining = (t.phase === 'focus' ? t.focus : t.break) * 60;
    renderTeachTimer();
    // Auto-start the next phase, like a normal pomodoro.
    teachTimerStart();
  }

  function beepTeach() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 660;
      gain.gain.value = 0.0001;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  }

  // ------------------------------------------------------------
  // Music
  // ------------------------------------------------------------
  function initTeachMusic() {
    if (!teachState.music.audio) {
      var audio = new Audio();
      audio.loop = true;
      audio.preload = 'metadata';
      audio.addEventListener('ended', teachMusicNext);
      audio.addEventListener('play', function () { updateTeachMusicUI(); });
      audio.addEventListener('pause', function () { updateTeachMusicUI(); });
      teachState.music.audio = audio;
    }
    updateTeachMusicUI();
    fetch(API + '/music/system', { method: 'GET' }).then(function (r) { return r.json(); }).then(function (d) {
      var el = $('teach-system-status');
      if (el) el.textContent = d.available ? '系统媒体可用：Windows 媒体键' : '当前系统不支持系统媒体键';
    }).catch(function () {
      var el = $('teach-system-status');
      if (el) el.textContent = '系统媒体服务不可用';
    });
  }

  function teachMusicPickFiles() { var el = $('teach-music-input'); if (el) el.click(); }
  function teachMusicPickFolder() { var el = $('teach-music-folder'); if (el) el.click(); }

  async function teachMusicHandleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var audioFiles = files.filter(function (f) {
      var e = extOf(f.name);
      return AUDIO_EXT.indexOf(e) >= 0 || String(f.type || '').indexOf('audio/') === 0;
    });
    if (!audioFiles.length) { toast('没有找到音频文件', 'error'); return; }
    audioFiles.forEach(function (f) {
      var url = URL.createObjectURL(f);
      teachState.music.objectUrls.push(url);
      teachState.music.tracks.push({ name: f.name, url: url });
    });
    if (teachState.music.index < 0) {
      teachState.music.index = 0;
      teachLoadMusicTrack(true);
    }
    updateTeachMusicUI();
    toast('已导入 ' + audioFiles.length + ' 首音乐', 'success');
  }

  function teachLoadMusicTrack(autoplay) {
    var m = teachState.music;
    var track = m.tracks[m.index];
    var audio = m.audio;
    if (!track || !audio) return;
    audio.src = track.url;
    audio.load();
    if (autoplay) audio.play().catch(function () {});
    updateTeachMusicUI();
  }

  function teachMusicToggle() {
    var m = teachState.music;
    if (!m.tracks.length) { teachMusicPickFiles(); return; }
    if (!m.audio.src) { teachLoadMusicTrack(true); return; }
    if (m.audio.paused) m.audio.play().catch(function () {}); else m.audio.pause();
    updateTeachMusicUI();
  }

  function teachMusicNext() {
    var m = teachState.music;
    if (!m.tracks.length) return;
    m.index = (m.index + 1) % m.tracks.length;
    teachLoadMusicTrack(true);
  }

  function teachMusicPrev() {
    var m = teachState.music;
    if (!m.tracks.length) return;
    m.index = (m.index - 1 + m.tracks.length) % m.tracks.length;
    teachLoadMusicTrack(true);
  }

  function teachPauseMusic() {
    var m = teachState.music;
    if (m && m.audio && !m.audio.paused) m.audio.pause();
  }

  function teachMusicClear() {
    var m = teachState.music;
    if (m.audio) { m.audio.pause(); m.audio.removeAttribute('src'); m.audio.load(); }
    m.objectUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    m.tracks = []; m.objectUrls = []; m.index = -1;
    updateTeachMusicUI();
  }

  function updateTeachMusicUI() {
    var m = teachState.music;
    var title = $('teach-music-title'), sub = $('teach-music-sub'), list = $('teach-music-list');
    var track = m.tracks[m.index];
    if (title) title.textContent = track ? track.name : 'NO TRACK 未选择';
    if (sub) sub.textContent = track ? (m.audio && !m.audio.paused ? 'PLAYING 播放中' : 'PAUSED 已暂停') + ' · ' + m.tracks.length + ' 首 · 本地文件' : '本地文件不会上传，只保留在浏览器中';
    if (list) {
      if (!m.tracks.length) list.innerHTML = '<div class="teach-empty">尚未导入音乐</div>';
      else {
        list.innerHTML = m.tracks.map(function (t, i) {
          return '<div class="teach-music-track ' + (i === m.index ? 'active' : '') + '" onclick="teachMusicSelect(' + i + ')"><span>' + esc(t.name) + '</span></div>';
        }).join('');
      }
    }
  }

  function teachMusicSelect(i) {
    var m = teachState.music;
    if (i < 0 || i >= m.tracks.length) return;
    m.index = i;
    teachLoadMusicTrack(true);
  }

  async function teachSystemMedia(action) {
    var el = $('teach-system-status');
    try {
      var r = await api('POST', '/music/system', { action: action });
      if (r.error) throw new Error(r.error);
      if (el) el.textContent = '已发送媒体键：' + action;
    } catch (e) {
      if (el) el.textContent = '系统媒体不可用：' + e.message;
      toast('系统媒体不可用：' + e.message, 'error');
    }
  }

  // ------------------------------------------------------------
  // RhineLab-inspired memory-card effect
  // ------------------------------------------------------------
  function decryptRhineText(el) {
    if (!el || el.dataset.decrypting === '1') return;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    var final = el.textContent;
    if (!final || final.length > 900) return;
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/\\';
    var frame = 0;
    el.dataset.decrypting = '1';
    var timer = setInterval(function () {
      frame++;
      var cut = Math.floor(final.length * Math.min(1, frame / 10));
      var out = final.slice(0, cut);
      for (var i = cut; i < Math.min(final.length, cut + 18); i++) {
        out += /\s/.test(final[i]) ? final[i] : chars[Math.floor(Math.random() * chars.length)];
      }
      if (cut < final.length) out += final.slice(Math.min(final.length, cut + 18));
      el.textContent = out;
      if (frame >= 10) {
        clearInterval(timer);
        el.textContent = final;
        el.dataset.decrypting = '0';
      }
    }, 32);
  }

  function bindRhineCards(container) {
    if (!container) return;
    var cards = Array.prototype.slice.call(container.querySelectorAll('.rhine-card'));
    cards.forEach(function (card, index) {
      card.style.setProperty('--rhine-i', index);
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / Math.max(1, r.width);
        var y = (e.clientY - r.top) / Math.max(1, r.height);
        card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
        card.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
      card.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select, textarea')) return;
        var open = card.classList.toggle('is-open');
        if (open) decryptRhineText(card.querySelector('.card-back'));
        cards.forEach(function (other) {
          other.classList.remove('is-active');
          other.classList.remove('is-near');
        });
        card.classList.add('is-active');
        cards.forEach(function (other, i) {
          if (other !== card && Math.abs(i - index) <= 1) other.classList.add('is-near');
        });
        if (!open) card.classList.remove('is-active');
      });
    });
  }

  // Called by index loadPage before leaving the page.
  function teachCleanup() {
    teachLogStudyTime();
    teachStopTimer(false);
    teachPauseMusic();
  }

  window.renderTeach = renderTeach;
  window.teachPickFiles = teachPickFiles;
  window.teachPickFolder = teachPickFolder;
  window.teachHandleFiles = teachHandleFiles;
  window.teachHandleDrop = teachHandleDrop;
  window.teachExtractDoc = teachExtractDoc;
  window.teachSimplifyDoc = teachSimplifyDoc;
  window.teachOpenStudy = teachOpenStudy;
  window.teachCloseStudy = teachCloseStudy;
  window.teachOpenExternal = teachOpenExternal;
  window.teachGenerateCards = teachGenerateCards;
  window.teachTimerStart = teachTimerStart;
  window.teachTimerPause = teachTimerPause;
  window.teachTimerReset = teachTimerReset;
  window.teachTimerSkip = teachTimerSkip;
  window.teachTimerSettings = teachTimerSettings;
  window.teachMusicPickFiles = teachMusicPickFiles;
  window.teachMusicPickFolder = teachMusicPickFolder;
  window.teachMusicHandleFiles = teachMusicHandleFiles;
  window.teachMusicToggle = teachMusicToggle;
  window.teachMusicPrev = teachMusicPrev;
  window.teachMusicNext = teachMusicNext;
  window.teachMusicClear = teachMusicClear;
  window.teachMusicSelect = teachMusicSelect;
  window.teachSystemMedia = teachSystemMedia;
  window.teachCleanup = teachCleanup;
  window.bindRhineCards = bindRhineCards;
})();
