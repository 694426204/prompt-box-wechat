/* =========================================================
   提示词收纳箱 · 逻辑层
   数据全部保存在浏览器 localStorage，可导入/导出 JSON 备份。
   ========================================================= */
(function () {
  'use strict';

  const LS_KEY = 'prompt-box-wechat-v1';
  const DAY = 24 * 60 * 60 * 1000;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* ---------------- Markdown 引擎优雅降级 ----------------
     markdown.js 若因缓存错配 / 部署滚动而加载失败，window.MD 会是 undefined，
     直接调用会抛 ReferenceError 并中断整个 render()，导致页面一片空白。
     这里用局部常量遮蔽全局，MD 缺失时自动降级为「全部按纯文本处理」，
     页面照常可用，仅失去 Markdown 排版能力。 */
  const MD_OK = !!(window.MD && typeof window.MD.render === 'function');
  const MD = MD_OK ? window.MD : {
    detect: function () { return 'txt'; },
    detectLoose: function () { return 'txt'; },
    render: function (s) { return esc(s); },
    strip: function (s) { return String(s == null ? '' : s); },
    isMdMsg: function () { return false; },
    firstHeading: function () { return null; }
  };

  function showDegrade(msg) {
    const bar = document.getElementById('degradeBar');
    if (!bar) return;
    bar.textContent = msg;
    bar.hidden = false;
  }

  /* ---------------- 状态 ---------------- */
  let state = load();

  function blankState() {
    const seed = window.SEED_PROMPTS || { sessions: [], messages: [] };
    return {
      sessions: seed.sessions.map(s => Object.assign({}, s)),
      messages: seed.messages.map(m => Object.assign({}, m)),
      pins: [],
      favs: {},
      currentSessionId: seed.sessions[0] ? seed.sessions[0].id : null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return blankState();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.messages) || !Array.isArray(data.sessions)) return blankState();
      data.pins = Array.isArray(data.pins) ? data.pins : [];
      data.favs = data.favs && typeof data.favs === 'object' ? data.favs : {};
      return data;
    } catch (e) {
      console.warn('读取本地数据失败，已重置为初始数据', e);
      return blankState();
    }
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存失败：浏览器存储空间可能已满');
    }
  }

  const uid = p => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------------- 收藏过期处理 ---------------- */
  function favActive(msgId) {
    const f = state.favs[msgId];
    if (!f) return null;
    if (f.until && f.until <= Date.now()) {
      delete state.favs[msgId];
      save();
      return null;
    }
    return f;
  }

  function favLabel(msgId) {
    const f = favActive(msgId);
    if (!f) return null;
    if (!f.until) return { text: '已收藏', cls: 'fav' };
    const left = f.until - Date.now();
    if (left <= 0) return null;
    const hours = Math.ceil(left / 3600000);
    if (hours <= 24) return { text: '收藏剩 ' + hours + ' 小时', cls: 'exp' };
    const days = Math.ceil(left / DAY);
    return { text: '收藏剩 ' + days + ' 天', cls: 'exp' };
  }

  function favDaysLeft(msgId) {
    const f = favActive(msgId);
    if (!f || !f.until) return null;
    return Math.ceil((f.until - Date.now()) / DAY);
  }

  function favModeText(f, mode, label) {
    if (f && f.mode === mode) return '取消收藏';
    return label;
  }

  /* ---------------- 工具 ---------------- */
  function fmtTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now.getTime() - DAY).toDateString() === d.toDateString();
    const hm = p(d.getHours()) + ':' + p(d.getMinutes());
    if (sameDay) return hm;
    if (yest) return '昨天 ' + hm;
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  function fmtDateSep(iso) {
    const d = new Date(iso);
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return '今天 ' + p(d.getHours()) + ':' + p(d.getMinutes());
    if (new Date(now.getTime() - DAY).toDateString() === d.toDateString()) return '昨天';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  let toastTimer = null;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1900);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- 渲染：侧栏 ---------------- */
  function renderSidebar() {
    const list = $('#sessionList');
    const empty = $('#sessionEmpty');
    list.innerHTML = '';

    const groups = state.sessions.slice().sort((a, b) => {
      const la = lastMsg(a.id), lb = lastMsg(b.id);
      return (lb ? lb.createdAt : '') < (la ? la.createdAt : '') ? -1 : 1;
    });

    empty.hidden = groups.length > 0;

    groups.forEach(s => {
      const msgs = state.messages.filter(m => m.sessionId === s.id);
      const last = lastMsg(s.id);
      const pinCount = msgs.filter(m => state.pins.indexOf(m.id) >= 0).length;
      const favCount = msgs.filter(m => favActive(m.id)).length;

      const el = document.createElement('div');
      el.className = 'conv' + (s.id === state.currentSessionId && currentView === 'chat' ? ' active' : '');
      el.dataset.session = s.id;
      el.innerHTML =
        '<div class="avatar' + (s.id === state.currentSessionId ? ' me' : '') + '">' + esc(s.icon || '💬') + '</div>' +
        '<div class="c-main">' +
          '<div class="c-row1"><span class="c-name">' + esc(s.name) + '</span>' +
            '<span class="c-time">' + (last ? fmtTime(last.createdAt) : '') + '</span></div>' +
          '<div class="c-row2"><span class="c-prev">' + esc(last ? summaryText(last).slice(0, 40) : '暂无消息') + '</span>' +
            '<span class="c-flags">' +
              (pinCount ? '<i class="pin" title="置顶">📌' + pinCount + '</i>' : '') +
              (favCount ? '<i class="fav" title="收藏">⭐' + favCount + '</i>' : '') +
            '</span></div>' +
        '</div>';
      el.addEventListener('click', () => {
        state.currentSessionId = s.id;
        currentView = 'chat';
        save();
        render();
        closeSidebarMobile();
      });
      list.appendChild(el);
    });

    const total = state.messages.length;
    $('#statLine').textContent = total + ' 条消息 · ' + state.sessions.length + ' 个会话';
  }

  // 摘要文本：Markdown 消息去掉标记后取正文
  function summaryText(m) {
    if (!m) return '';
    if (m.title) return m.title;
    const body = MD.isMdMsg(m) ? MD.strip(m.content) : m.content;
    return body.replace(/\s+/g, ' ').trim() || '暂无消息';
  }

  function lastMsg(sid) {
    let best = null;
    state.messages.forEach(m => {
      if (m.sessionId !== sid) return;
      if (!best || m.createdAt > best.createdAt) best = m;
    });
    return best;
  }

  /* ---------------- 渲染：聊天区 ---------------- */
  let currentView = 'chat'; // chat | pinned | fav

  function visibleMessages() {
    // 统一按时间正序：最旧在上，最新在最底部
    const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
    if (currentView === 'pinned') {
      return state.messages.filter(m => state.pins.indexOf(m.id) >= 0).sort(byTime);
    }
    if (currentView === 'fav') {
      return state.messages.filter(m => favActive(m.id)).sort(byTime);
    }
    if (searchKw) {
      // 搜索时跨全部会话查找
      return state.messages.slice().sort(byTime);
    }
    return state.messages.filter(m => m.sessionId === state.currentSessionId).sort(byTime);
  }

  function currentTitle() {
    if (currentView === 'pinned') return '置顶的消息';
    if (currentView === 'fav') return '收藏的消息';
    if (searchKw) return '搜索结果';
    const s = state.sessions.find(x => x.id === state.currentSessionId);
    return s ? s.name : '提示词速记';
  }

  function buildRow(m) {
    const row = document.createElement('div');
    row.className = 'msg-row' + (m.side === 'me' ? ' mine' : '');
    const pinned = state.pins.indexOf(m.id) >= 0;
    const fl = favLabel(m.id);

    // Markdown 消息若首个标题与 title 相同，气泡内不再重复显示 title
    let titleHtml = '';
    if (m.title) {
      const h = MD.isMdMsg(m) ? MD.firstHeading(m.content) : null;
      if (h === null || h !== m.title.trim()) {
        titleHtml = '<span class="b-title">' + esc(m.title) + '</span>';
      }
    }

    row.innerHTML =
      '<div class="avatar">' + (m.side === 'me' ? '我' : '✦') + '</div>' +
      '<div class="msg-col">' +
        '<div class="bubble" data-id="' + m.id + '">' +
          titleHtml +
          (MD.isMdMsg(m) ? '<div class="md">' + MD.render(m.content) + '</div>' : esc(m.content)) +
          '<div class="b-flags">' +
            (pinned ? '<span>📌 已置顶</span>' : '') +
            (fl ? '<span class="' + fl.cls + '">' + esc(fl.text) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="msg-meta">' + fmtTime(m.createdAt) +
          '<span class="quick">' +
            '<button data-quick="pin" data-id="' + m.id + '" class="' + (pinned ? 'on' : '') + '" title="置顶">📌</button>' +
            '<button data-quick="fav" data-id="' + m.id + '" class="' + (fl ? 'on' : '') + '" title="收藏">⭐</button>' +
          '</span>' +
        '</div>' +
      '</div>';

    const bubble = $('.bubble', row);
    bubble.addEventListener('click', () => handleBubbleClick(m.id));
    bubble.addEventListener('dblclick', () => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      openLightbox(m.id, true);
    });
    bubble.addEventListener('contextmenu', e => {
      e.preventDefault();
      openCtxMenu(e.clientX, e.clientY, m.id);
    });

    $$('[data-quick]', row).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.quick === 'pin') togglePin(id);
        else toggleFav(id, null);
      });
    });
    return row;
  }

  /* ---------------- 操作 ---------------- */
  function togglePin(id) {
    const i = state.pins.indexOf(id);
    if (i >= 0) { state.pins.splice(i, 1); toast('已取消置顶'); }
    else { state.pins.unshift(id); toast('已置顶'); }
    save(); render();
    if (lightboxId) refreshLightbox();
  }

  function toggleFav(id, days) {
    const mode = days === null ? 'forever' : (days + 'd');
    const cur = state.favs[id];
    if (cur && cur.mode === mode) {
      delete state.favs[id];
      toast('已取消收藏');
    } else {
      state.favs[id] = { mode: mode, until: days === null ? null : Date.now() + days * DAY };
      toast(days === null ? '已收藏（长期有效）' : '已收藏 ' + days + ' 天，到期自动解除');
    }
    save(); render();
    if (lightboxId) refreshLightbox();
  }

  function deleteMessage(id) {
    state.messages = state.messages.filter(m => m.id !== id);
    state.pins = state.pins.filter(x => x !== id);
    delete state.favs[id];
    save(); render(); closeLightbox();
    toast('已删除该消息');
  }

  /* ---------------- 放大层 ---------------- */
  let lightboxId = null;

  // 单击气泡 → 居中卡片；双击气泡 → 半全屏放大
  let clickTimer = null;
  function handleBubbleClick(id) {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickTimer = null; openLightbox(id, false); }, 220);
  }

  function openLightbox(id, wide) {
    const m = state.messages.find(x => x.id === id);
    if (!m) return;
    lightboxId = id;
    $('#lightbox').classList.toggle('wide', !!wide);
    $('#lightbox').hidden = false;
    $('#lbEdit').hidden = true;
    refreshLightbox();
  }

  function refreshLightbox() {
    const m = state.messages.find(x => x.id === lightboxId);
    if (!m) { closeLightbox(); return; }
    const pinned = state.pins.indexOf(m.id) >= 0;
    const f = favActive(m.id);
    const s = state.sessions.find(x => x.id === m.sessionId);

    // Markdown 消息首个标题与 title 相同时，灯箱标题栏不重复显示
    const firstH = MD.isMdMsg(m) ? MD.firstHeading(m.content) : null;
    $('#lbTitle').textContent = (firstH !== null && firstH === (m.title || '').trim()) ? '' : (m.title || '消息详情');
    $('#lbMeta').textContent =
      (s ? s.name : '未知会话') + ' · ' + fmtTime(m.createdAt) +
      (m.side === 'me' ? ' · 我发送' : ' · 助手消息') +
      (pinned ? ' · 已置顶' : '') +
      (f ? ' · ' + (f.until ? '收藏中（' + Math.ceil((f.until - Date.now()) / DAY) + ' 天内到期）' : '已收藏') : '');
    const lbBody = $('#lbBody');
    if (MD.isMdMsg(m)) {
      lbBody.classList.add('md');
      lbBody.innerHTML = MD.render(m.content);
    } else {
      lbBody.classList.remove('md');
      lbBody.textContent = m.content;
    }

    const acts = $$('#lightbox .act');
    acts.forEach(a => a.classList.remove('on'));
    const pinBtn = $('#lightbox .act[data-act="pin"]');
    if (pinBtn) {
      pinBtn.classList.toggle('on', pinned);
      setActLabel(pinBtn, pinned ? '取消置顶' : '置顶');
    }
    const favBtn = $('#lightbox .act[data-act="fav"]');
    if (favBtn) {
      const on = !!f && f.mode === 'forever';
      favBtn.classList.toggle('on', on);
      setActLabel(favBtn, on ? '取消收藏' : '收藏');
    }
    const f2 = $('#lightbox .act[data-act="fav2"]');
    if (f2) {
      const on = !!f && f.mode === '2d';
      f2.classList.toggle('on', on);
      setActLabel(f2, on ? '取消收藏' : '收藏两天');
    }
    const f3 = $('#lightbox .act[data-act="fav3"]');
    if (f3) {
      const on = !!f && f.mode === '3d';
      f3.classList.toggle('on', on);
      setActLabel(f3, on ? '取消收藏' : '收藏三天');
    }
  }

  function setActLabel(btn, text) {
    let span = btn.querySelector('span');
    const icon = span ? span.textContent : (btn.dataset.icon || '');
    btn.dataset.icon = icon;
    btn.textContent = '';
    if (!span) { span = document.createElement('span'); span.textContent = icon; }
    btn.appendChild(span);
    btn.appendChild(document.createTextNode(text));
  }

  function closeLightbox() {
    $('#lightbox').hidden = true;
    $('#lightbox').classList.remove('wide');
    lightboxId = null;
    $('#lbEdit').hidden = true;
  }

  /* ---------------- 右键菜单 ---------------- */
  let ctxTarget = null;
  function openCtxMenu(x, y, id) {
    ctxTarget = id;
    const menu = $('#ctxmenu');
    const pinned = state.pins.indexOf(id) >= 0;
    const f = favActive(id);
    menu.innerHTML =
      '<button data-act="open">🔍 查看/放大</button>' +
      '<button data-act="pin">' + (pinned ? '📌 取消置顶' : '📌 置顶') + '</button>' +
      '<button data-act="fav">⭐ ' + favModeText(f, 'forever', '收藏（长期有效）') + '</button>' +
      '<button data-act="fav2">⏳ ' + favModeText(f, '2d', '收藏两天') + '</button>' +
      '<button data-act="fav3">🗓 ' + favModeText(f, '3d', '收藏三天') + '</button>' +
      '<hr><button data-act="copy">📋 复制内容</button>' +
      '<button data-act="edit">✎ 编辑</button>' +
      '<button data-act="del" class="danger">🗑 删除</button>';
    menu.hidden = false;
    const w = 160, h = menu.offsetHeight || 240;
    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';

    $$('button', menu).forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        menu.hidden = true;
        if (act === 'open') openLightbox(id);
        else if (act === 'pin') togglePin(id);
        else if (act === 'fav') toggleFav(id, null);
        else if (act === 'fav2') toggleFav(id, 2);
        else if (act === 'fav3') toggleFav(id, 3);
        else if (act === 'copy') copyText(msgOf(id).content);
        else if (act === 'edit') { openLightbox(id); startEdit(); }
        else if (act === 'del') deleteMessage(id);
      });
    });
  }
  function msgOf(id) { return state.messages.find(m => m.id === id); }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板'), () => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); }
    catch (e) { toast('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }

  /* ---------------- 放大层按钮 ---------------- */
  $('#lightbox').addEventListener('click', e => {
    const btn = e.target.closest('.act');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = lightboxId;
    if (act === 'pin') togglePin(id);
    else if (act === 'fav') toggleFav(id, null);
    else if (act === 'fav2') toggleFav(id, 2);
    else if (act === 'fav3') toggleFav(id, 3);
    else if (act === 'copy') copyText(msgOf(id).content);
    else if (act === 'edit') startEdit();
    else if (act === 'del') deleteMessage(id);
  });

  function startEdit() {
    const m = msgOf(lightboxId);
    if (!m) return;
    $('#lbEditTitle').value = m.title || '';
    $('#lbEditBody').value = m.content;
    $('#lbEdit').hidden = false;
    $('#lbEditBody').focus();
  }

  $('#lbEditCancel').addEventListener('click', () => { $('#lbEdit').hidden = true; });
  $('#lbEditSave').addEventListener('click', () => {
    const m = msgOf(lightboxId);
    if (!m) return;
    m.title = $('#lbEditTitle').value.trim();
    m.content = $('#lbEditBody').value;
    // 重新判定格式：原本是 Markdown 的，即使删改后特征变少也保留 md 档位
    if (m.fmt === 'md') m.fmt = MD.detectLoose(m.content);
    else m.fmt = MD.detect(m.content);
    save(); $('#lbEdit').hidden = true; render(); refreshLightbox();
    toast('已保存');
  });

  $('#lbClose').addEventListener('click', closeLightbox);
  $('#lbMask').addEventListener('click', closeLightbox);

  /* ---------------- 侧栏视图切换 ---------------- */
  $('#sideNav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    $$('#sideNav .nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });

  /* ---------------- 搜索 ---------------- */
  let searchKw = '';
  $('#searchInput').addEventListener('input', e => {
    searchKw = e.target.value.trim().toLowerCase();
    render();
  });
  $('#btnSearch2').addEventListener('click', () => {
    $('#searchInput').focus();
    if (window.innerWidth <= 820) $('#sidebar').classList.add('open');
  });

  /* ---------------- 发送消息 ---------------- */
  function send() {
    const ta = $('#composerInput');
    const raw = ta.value;
    if (!raw.trim()) return;
    let sid = state.currentSessionId;
    if (!sid || currentView !== 'chat') {
      const s = state.sessions[0];
      sid = s ? s.id : null;
    }
    if (!sid) { toast('请先新建一个会话'); return; }
    const fmt = MD.detect(raw);
    const lines = raw.split('\n');
    const head = fmt === 'md' ? MD.strip(lines[0]).trim() : lines[0];
    state.messages.push({
      id: uid('m'),
      sessionId: sid,
      side: 'me',
      title: head.length > 40 ? head.slice(0, 40) + '…' : head,
      content: raw,
      fmt: fmt,
      createdAt: new Date().toISOString()
    });
    ta.value = '';
    ta.style.height = 'auto';
    resetPreview();
    save(); currentView = 'chat'; render();
    scrollBottom();
    toast('已保存到「' + (state.sessions.find(s => s.id === sid) || {}).name + '」');
  }
  $('#btnSend').addEventListener('click', send);
  $('#composerInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('#composerInput').addEventListener('input', e => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
    updatePreview();
  });

  /* ---------------- 实时格式识别 + 预览条 ---------------- */
  let previewOpen = false;

  function updatePreview(forceFmt) {
    const ta = $('#composerInput');
    const text = ta.value;
    const box = $('#compPreview');
    if (!text.trim()) { resetPreview(); return; }

    // 整段判定；粘贴时若片段强判为 md 则整体判 md（只升不降）
    const fmt = forceFmt || MD.detect(text);

    const badge = $('#cpBadge');
    badge.textContent = fmt === 'md' ? 'Markdown' : 'TXT';
    badge.classList.toggle('md', fmt === 'md');
    $('#cpHint').textContent = fmt === 'md' ? '已识别为 Markdown，将按 Markdown 排版' : '纯文本，按原样显示';

    box.hidden = false;
    const body = $('#cpBody');
    if (fmt === 'md') {
      body.classList.add('md');
      body.innerHTML = MD.render(text);
    } else {
      body.classList.remove('md');
      body.textContent = text;
    }
    body.hidden = !previewOpen;
    $('#cpToggle').textContent = previewOpen ? '收起预览' : '展开预览';
  }

  function resetPreview() {
    const box = $('#compPreview');
    if (box) box.hidden = true;
    const body = $('#cpBody');
    if (body) { body.innerHTML = ''; body.textContent = ''; body.hidden = true; }
    const badge = $('#cpBadge');
    if (badge) { badge.textContent = 'TXT'; badge.classList.remove('md'); }
  }

  // 粘贴时对刚粘贴的片段单独判定，片段判为 md 则整体判 md
  $('#composerInput').addEventListener('paste', e => {
    const clip = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!clip) return;
    setTimeout(() => {
      const ta = $('#composerInput');
      if (MD.detect(clip) === 'md') {
        updatePreview('md');
      } else {
        updatePreview();
      }
    }, 0);
  });

  function togglePreview() {
    previewOpen = !previewOpen;
    const body = $('#cpBody');
    if (body) body.hidden = !previewOpen;
    $('#cpToggle').textContent = previewOpen ? '收起预览' : '展开预览';
  }
  $('#cpBadge').addEventListener('click', togglePreview);
  $('#cpToggle').addEventListener('click', togglePreview);

  function scrollBottom() {
    const s = $('#msgScroll');
    s.scrollTop = s.scrollHeight;
  }

  /* ---------------- 会话管理 ---------------- */
  $('#btnNewSession').addEventListener('click', () => {
    const name = (prompt('新会话名称', '新的提示词集') || '').trim();
    if (!name) return;
    const s = { id: uid('s'), name, icon: '💬' };
    state.sessions.push(s);
    state.currentSessionId = s.id;
    currentView = 'chat';
    save(); render();
    toast('已新建会话');
  });

  $('#btnRenameSession').addEventListener('click', () => {
    const s = state.sessions.find(x => x.id === state.currentSessionId);
    if (!s) { toast('请先选择一个会话'); return; }
    const name = (prompt('重命名会话', s.name) || '').trim();
    if (!name) return;
    s.name = name;
    save(); render();
  });

  $('#btnDeleteSession').addEventListener('click', () => {
    const s = state.sessions.find(x => x.id === state.currentSessionId);
    if (!s) { toast('请先选择一个会话'); return; }
    if (!confirm('删除会话「' + s.name + '」及其中的 ' +
      state.messages.filter(m => m.sessionId === s.id).length + ' 条消息？')) return;
    state.messages = state.messages.filter(m => m.sessionId !== s.id);
    state.sessions = state.sessions.filter(x => x.id !== s.id);
    state.currentSessionId = state.sessions.length ? state.sessions[0].id : null;
    save(); render();
    toast('已删除会话');
  });

  /* ---------------- 导入 / 导出 ---------------- */
  $('#btnMenu').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const menu = $('#ctxmenu');
    menu.innerHTML =
      '<button data-m="export">📤 导出备份 JSON</button>' +
      '<button data-m="import">📥 导入备份 JSON</button>' +
      '<hr><button data-m="reset" class="danger">♻️ 清空并恢复初始数据</button>';
    menu.hidden = false;
    menu.style.left = Math.min(r.left, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(r.top - 130, window.innerHeight - 130) + 'px';
    $$('button', menu).forEach(b => {
      b.addEventListener('click', () => {
        const m = b.dataset.m;
        menu.hidden = true;
        if (m === 'export') doExport();
        else if (m === 'import') $('#fileImport').click();
        else if (m === 'reset') {
          if (!confirm('清空当前全部数据并恢复初始的 6 条示例提示词？')) return;
          localStorage.removeItem(LS_KEY);
          state = blankState();
          save(); render();
          toast('已恢复初始数据');
        }
      });
    });
  });

  function doExport() {
    const payload = {
      app: 'prompt-box-wechat',
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: state.sessions,
      messages: state.messages,
      pins: state.pins,
      favs: state.favs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '提示词备份-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('已导出备份文件');
  }

  $('#btnExport').addEventListener('click', doExport);
  $('#btnImport').addEventListener('click', () => $('#fileImport').click());
  $('#fileImport').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.messages || !data.sessions) throw new Error('格式不正确');
        const mode = confirm('导入将覆盖当前全部数据，确定继续？\n\n点「取消」则与现有数据合并。');
        if (mode) {
          state.sessions = data.sessions;
          state.messages = data.messages;
          state.pins = data.pins || [];
          state.favs = data.favs || {};
        } else {
          const sidMap = {};
          data.sessions.forEach(s => {
            const nid = uid('s');
            sidMap[s.id] = nid;
            state.sessions.push({ id: nid, name: s.name, icon: s.icon || '💬' });
          });
          data.messages.forEach(m => {
            state.messages.push(Object.assign({}, m, {
              id: uid('m'),
              sessionId: sidMap[m.sessionId] || state.currentSessionId
            }));
          });
        }
        state.currentSessionId = state.sessions.length ? state.sessions[0].id : null;
        save(); render();
        toast('导入完成');
      } catch (err) {
        toast('导入失败：文件格式不正确');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  /* ---------------- 移动端 ---------------- */
  function closeSidebarMobile() {
    if (window.innerWidth <= 820) $('#sidebar').classList.remove('open');
  }
  $('#btnBack').addEventListener('click', () => {
    if (window.innerWidth <= 820) {
      $('#sidebar').classList.toggle('open');
    } else {
      currentView = 'chat';
      $$('#sideNav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'chat'));
      render();
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#ctxmenu') && !e.target.closest('#btnMenu')) $('#ctxmenu').hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('#lightbox').hidden) closeLightbox();
      $('#ctxmenu').hidden = true;
    }
  });

  /* ---------------- 渲染总入口 ---------------- */
  let lastRenderKey = null;

  function render() {
    let msgs = visibleMessages();
    if (searchKw) {
      msgs = msgs.filter(m =>
        (m.title || '').toLowerCase().includes(searchKw) ||
        (m.content || '').toLowerCase().includes(searchKw));
    }
    renderSidebar();
    renderChatFiltered(msgs);

    // 切换会话 / 切换视图 / 搜索时，自动滚动到最底部，让最新消息第一眼可见
    const key = state.currentSessionId + '|' + currentView + '|' + searchKw;
    if (key !== lastRenderKey) {
      lastRenderKey = key;
      scrollBottom();
    }
  }

  function renderChatFiltered(msgs) {
    const list = $('#msgList');
    list.innerHTML = '';
    $('#chatTitle').textContent = currentTitle();
    $('#chatSub').textContent = msgs.length + ' 条消息' + (searchKw ? '（搜索：' + searchKw + '）' : '');
    $('#msgEmpty').hidden = msgs.length > 0;

    let lastDate = '';
    msgs.forEach(m => {
      const sep = fmtDateSep(m.createdAt);
      if (sep !== lastDate) {
        lastDate = sep;
        const s = document.createElement('div');
        s.className = 'date-sep';
        s.innerHTML = '<span>' + esc(sep) + '</span>';
        list.appendChild(s);
      }
      list.appendChild(buildRow(m));
    });

    const pinBar = $('#pinBar');
    const pinned = state.messages.filter(m => state.pins.indexOf(m.id) >= 0)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    if (pinned.length && currentView === 'chat') {
      pinBar.hidden = false;
      pinBar.innerHTML = '<span>置顶</span>' + pinned.map(m =>
        '<span class="pb-item" data-jump="' + m.id + '">📌 ' + esc(summaryText(m).slice(0, 18)) + '</span>'
      ).join('');
      $$('#pinBar .pb-item').forEach(el => {
        el.addEventListener('click', () => openLightbox(el.dataset.jump));
      });
    } else {
      pinBar.hidden = true;
    }

    const pinBadge = $('#badgePinned'), favBadge = $('#badgeFav');
    pinBadge.textContent = state.pins.length;
    pinBadge.dataset.zero = state.pins.length ? '0' : '1';
    let fc = 0;
    state.messages.forEach(m => { if (favActive(m.id)) fc++; });
    favBadge.textContent = fc;
    favBadge.dataset.zero = fc ? '0' : '1';
  }

  /* ---------------- 主题系统 ---------------- */
  const THEME_KEY = 'prompt-box-theme-v1';

  /* 放大层宽度规则
     STD  : 标准宽度，既是初始值也是最小值（用户可在主题面板中调整）
     LB_STD_MIN / LB_STD_MAX : 标准宽度输入框自身的合法区间，防止极端值撑坏布局 */
  const LB_STD_DEFAULT = 820;
  const LB_STD_MIN = 320;
  const LB_STD_MAX = 1200;
  const LB_RATIO = 2 / 3;   // 最大宽度 = 父容器内容盒宽度 × 2/3

  const THEMES = [
    { id: 'day',   name: '白天', side: '#2e2e2e', bg: '#f5f5f5', bubble: '#95ec69', accent: '#07c160' },
    { id: 'dark',  name: '暗黑', side: '#121214', bg: '#1b1b1f', bubble: '#2f6b3a', accent: '#07c160' },
    { id: 'eye',   name: '护眼', side: '#3c4438', bg: '#e8eee0', bubble: '#cbe4a8', accent: '#5a8f4a' },
    { id: 'night', name: '夜间', side: '#010409', bg: '#0d1117', bubble: '#1f6f43', accent: '#2ea043' },
    { id: 'wood',  name: '原木', side: '#5b4632', bg: '#f2e8db', bubble: '#e3c795', accent: '#a9713f' }
  ];

  let theme = { preset: 'day', bg: '', accent: '', lbStd: LB_STD_DEFAULT, lbW: LB_STD_DEFAULT };

  function loadTheme() {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (!raw) return;
      const t = JSON.parse(raw);
      if (t && t.preset) {
        theme = {
          preset: t.preset,
          bg: t.bg || '',
          accent: t.accent || '',
          lbStd: clampInt(t.lbStd, LB_STD_MIN, LB_STD_MAX, LB_STD_DEFAULT),
          lbW: clampInt(t.lbW, LB_STD_MIN, LB_STD_MAX, LB_STD_DEFAULT)
        };
      }
    } catch (e) { /* 忽略损坏的主题配置 */ }
  }

  function saveTheme() {
    try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); } catch (e) { /* 存储空间不足时忽略 */ }
  }

  function applyTheme() {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.preset);
    // 自定义背景色覆盖
    if (theme.bg) {
      root.style.setProperty('--chat-bg', theme.bg);
      root.style.setProperty('--lb-body-bg', theme.bg);
    } else {
      root.style.removeProperty('--chat-bg');
      root.style.removeProperty('--lb-body-bg');
    }
    if (theme.accent) root.style.setProperty('--accent', theme.accent);
    else root.style.removeProperty('--accent');

    const grid = $('#themeGrid');
    if (grid) {
      grid.innerHTML = '';
      THEMES.forEach(t => {
        const item = document.createElement('button');
        item.className = 'tp-item' + (t.id === theme.preset && !theme.bg ? ' on' : '');
        item.innerHTML =
          '<span class="tp-swatch">' +
            '<i style="background:' + t.side + '"></i>' +
            '<i style="background:' + t.bg + '"></i>' +
            '<i style="background:' + t.bubble + '"></i>' +
          '</span>' +
          '<span class="tp-name">' + t.name + '</span>';
        item.addEventListener('click', () => {
          theme.preset = t.id;
          theme.bg = '';
          theme.accent = '';
          saveTheme();
          applyTheme();
          toast('已切换到「' + t.name + '」主题');
        });
        grid.appendChild(item);
      });
    }
    const bgInput = $('#customBg'), acInput = $('#customAccent');
    if (bgInput) bgInput.value = theme.bg || '#f5f5f5';
    if (acInput) acInput.value = theme.accent || '#07c160';

    applyLbWidth();
  }

  /* ---------------- 放大层宽度控制 ----------------
     规则：宽度可在「标准宽度」与「最大宽度」之间调整。
       上限 cap  = 父容器（放大层内容盒）宽度 × 2/3
       下限 minV = min(标准宽度, cap)  —— 窄屏时物理上限优先于标准宽度
       生效 eff  = clamp(设定宽度, minV, cap)
     theme.lbW 存的是用户设定值（意图），不是钳制后的 eff：
     窗口缩小时显示被钳窄，窗口放大后自动恢复原设定宽度。 */

  function clampInt(v, lo, hi, fallback) {
    const n = Math.round(Number(v));
    if (!isFinite(n)) return fallback;
    return Math.min(Math.max(n, lo), hi);
  }

  /* 放大层内容盒宽度 = 视口宽 − 放大层左右 padding */
  function lbContainerWidth() {
    const lb = $('#lightbox');
    const cs = getComputedStyle(lb);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const vw = document.documentElement.clientWidth;
    return Math.max(0, vw - padX);
  }

  /* 最大宽度：父容器内容盒的 2/3 */
  function lbMaxWidth() {
    return Math.floor(lbContainerWidth() * LB_RATIO);
  }

  function applyLbWidth() {
    const std = clampInt(theme.lbStd, LB_STD_MIN, LB_STD_MAX, LB_STD_DEFAULT);
    const cap = lbMaxWidth();
    const minV = Math.min(std, cap);
    const eff = Math.min(Math.max(clampInt(theme.lbW, LB_STD_MIN, LB_STD_MAX, std), minV), cap);

    const root = document.documentElement;
    root.style.setProperty('--lb-std-width', std + 'px');
    root.style.setProperty('--lb-width', eff + 'px');

    const slider = $('#lbWidth'), stdInput = $('#lbStdWidth'), val = $('#lbWidthVal');
    if (slider) {
      slider.min = String(minV);
      slider.max = String(Math.max(minV, cap));
      slider.value = String(eff);
    }
    if (stdInput) stdInput.value = String(std);
    if (val) {
      val.textContent = eff + 'px';
      // 显式告知上限来源：屏幕宽度的 2/3，避免"标准宽度 820 却只显示 810"的困惑
      val.title = '上限 ' + cap + 'px（屏幕宽度的 2/3）';
    }
  }

  $('#btnTheme').addEventListener('click', e => {
    e.stopPropagation();
    const p = $('#themePanel');
    p.hidden = !p.hidden;
  });
  $('#themePanel').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { $('#themePanel').hidden = true; });
  $('#customBg').addEventListener('input', e => {
    theme.bg = e.target.value;
    saveTheme(); applyTheme();
  });
  $('#customAccent').addEventListener('input', e => {
    theme.accent = e.target.value;
    saveTheme(); applyTheme();
  });

  // 放大层宽度：input 实时预览，change 松手时才落盘，避免拖动过程高频写存储
  $('#lbWidth').addEventListener('input', e => {
    theme.lbW = Number(e.target.value);
    applyLbWidth();
  });
  $('#lbWidth').addEventListener('change', e => {
    theme.lbW = Number(e.target.value);
    applyLbWidth();
    saveTheme();
  });
  // 标准宽度变更：设定宽度不得低于标准宽度，低于则抬到新标准宽度
  $('#lbStdWidth').addEventListener('input', e => {
    theme.lbStd = clampInt(e.target.value, LB_STD_MIN, LB_STD_MAX, LB_STD_DEFAULT);
    if (theme.lbW < theme.lbStd) theme.lbW = theme.lbStd;
    applyLbWidth();
  });
  $('#lbStdWidth').addEventListener('change', e => {
    theme.lbStd = clampInt(e.target.value, LB_STD_MIN, LB_STD_MAX, LB_STD_DEFAULT);
    if (theme.lbW < theme.lbStd) theme.lbW = theme.lbStd;
    applyLbWidth();
    saveTheme();
  });

  // 视口变化时上限 cap 随之变化，需重算（展开状态与设定值均保留）
  window.addEventListener('resize', () => { applyLbWidth(); });

  loadTheme();
  applyTheme();
  applyLbWidth();

  /* ---------------- 启动 ---------------- */
  if (!MD_OK) {
    showDegrade('Markdown 排版模块未能加载，已降级为纯文本显示。请按 Ctrl+F5 强制刷新页面。');
  }
  render();
  scrollBottom();
  window.__promptBoxReady = true;

  // 每分钟检查一次收藏到期
  setInterval(() => {
    let changed = false;
    Object.keys(state.favs).forEach(k => {
      const f = state.favs[k];
      if (f && f.until && f.until <= Date.now()) { delete state.favs[k]; changed = true; }
    });
    if (changed) { save(); render(); toast('有收藏已到期，自动转入普通消息'); }
  }, 60000);

  window.__promptBox = { get state() { return state; }, save, render };
})();

