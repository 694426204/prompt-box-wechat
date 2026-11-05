/* =========================================================
   提示词收纳箱 · Markdown / TXT 识别与渲染（零依赖）
   纯自动判定：命中 Markdown 特征则按 Markdown 渲染，否则按纯文本。
   安全红线：正文永远先转义再替换，绝不注入用户 HTML。
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- 转义 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------------- 识别打分 ---------------- */
  // 返回 { total, strong }：strong 表示出现高权重特征（直接判 md）
  function score(text) {
    const s = String(text == null ? '' : text);
    if (!s.trim()) return { total: 0, strong: false };

    let total = 0;
    let strong = false;

    // 代码围栏
    if (/^```/m.test(s)) { total += 4; strong = true; }
    // ATX 标题
    if (/^#{1,6}\s+\S/m.test(s)) { total += 3; strong = true; }
    // 表格行
    if (/^\s*\|.+\|\s*$/m.test(s)) { total += 3; strong = true; }
    // 分割线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/m.test(s)) total += 2;
    // 引用
    if (/^>\s+\S/m.test(s)) total += 2;
    // 有序列表
    if (/^\s*\d+\.\s+\S/m.test(s)) total += 2;
    // 无序列表（需 2 行及以上，避免单个破折号误判）
    const ulCount = (s.match(/^\s*[-*+]\s+\S/gm) || []).length;
    if (ulCount >= 2) total += 2;
    // 粗体
    if (/\*\*[^*\n]+\*\*/.test(s)) total += 2;
    // 删除线
    if (/~~[^~\n]+~~/.test(s)) total += 2;
    // 链接
    if (/\[[^\]\n]+\]\([^)\s]+\)/.test(s)) total += 2;
    // 行内代码
    if (/`[^`\n]+`/.test(s)) total += 1;
    // 斜体（成对）
    if (/(^|[^*\n])\*[^*\n]+\*(?![*\n])/.test(s)) total += 1;

    return { total: total, strong: strong };
  }

  function detect(text) {
    const r = score(text);
    return (r.strong || r.total >= 2) ? 'md' : 'txt';
  }

  // 宽松判定：命中任一特征即算 markdown（用于编辑后保留 md 档位）
  function detectLoose(text) {
    return score(text).total >= 1 ? 'md' : 'txt';
  }

  /* ---------------- 行内解析 ---------------- */
  function safeUrl(url) {
    return /^(https?:\/\/|mailto:)/i.test(url);
  }

  // 属性值转义：URL 里的引号可能提前闭合 href
  // 注意：入参已做过 esc()，此处只补引号，避免 & 被二次转义
  function attrEsc(s) {
    return String(s == null ? '' : s)
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(text) {
    let s = String(text == null ? '' : text);

    // 行内代码先抽出，避免代码里的 * 被当作斜体
    // 占位符使用不易出现在正文中的可打印串
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, function (_, c) {
      codes.push(c);
      return '%%MDC' + (codes.length - 1) + '%%';
    });

    // 图片（精简版不支持图片，降级为加粗文字）
    s = s.replace(/!\[([^\]\n]*)\]\(([^()\s]+)\)/g, '<strong>$1</strong>');
    // 链接（URL 白名单，否则降级为纯文本）；URL 允许一层括号，以正确吃掉 alert(1) 这类参数
    s = s.replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g, function (_, label, url) {
      if (safeUrl(url)) {
        return '<a href="' + attrEsc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      }
      return label;
    });

    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\n])/g, '<em>$1</em>');
    s = s.replace(/(^|[^\w_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w_])/g, '$1<em>$2</em>');

    // 还原行内代码（占位符若在正文中自然出现则原样保留）
    s = s.replace(/%%MDC(\d+)%%/g, function (m, i) {
      if (codes[+i] === undefined) return m;
      return '<code>' + codes[+i] + '</code>';
    });
    return s;
  }

  /* ---------------- 块级渲染 ---------------- */
  function render(text) {
    const raw = String(text == null ? '' : text).split(/\r?\n/);
    const out = [];
    let i = 0;

    while (i < raw.length) {
      const line = raw[i];

      // 代码块
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < raw.length && !/^\s*```/.test(raw[i])) { buf.push(raw[i]); i++; }
        if (i < raw.length) i++; // 跳过结束围栏
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // 标题
      let m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const lv = m[1].length;
        out.push('<h' + lv + '>' + inline(esc(m[2])) + '</h' + lv + '>');
        i++;
        continue;
      }

      // 分割线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // 引用
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < raw.length && /^\s*>\s?/.test(raw[i])) {
          buf.push(raw[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + buf.map(l => inline(esc(l))).join('<br>') + '</blockquote>');
        continue;
      }

      // 列表（相邻同类合并）
      const isUl = /^\s*[-*+]\s+/.test(line);
      const isOl = /^\s*\d+\.\s+/.test(line);
      if (isUl || isOl) {
        const items = [];
        while (i < raw.length) {
          const u = raw[i].match(/^\s*[-*+]\s+(.*)$/);
          const o = raw[i].match(/^\s*\d+\.\s+(.*)$/);
          if (isOl && o) { items.push(o[1]); i++; }
          else if (isUl && u) { items.push(u[1]); i++; }
          else break;
        }
        const tag = isOl ? 'ol' : 'ul';
        out.push('<' + tag + '>' +
          items.map(t => '<li>' + inline(esc(t)) + '</li>').join('') +
          '</' + tag + '>');
        continue;
      }

      // 段落（保留手动换行）
      if (!line.trim()) { i++; continue; }
      const buf = [];
      while (i < raw.length &&
             raw[i].trim() &&
             !/^\s*```/.test(raw[i]) &&
             !/^#{1,6}\s+/.test(raw[i]) &&
             !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(raw[i]) &&
             !/^\s*>\s?/.test(raw[i]) &&
             !/^\s*[-*+]\s+/.test(raw[i]) &&
             !/^\s*\d+\.\s+/.test(raw[i])) {
        buf.push(raw[i]);
        i++;
      }
      if (buf.length) {
        out.push('<p>' + buf.map(l => inline(esc(l))).join('<br>') + '</p>');
      }
    }

    return out.join('');
  }

  /* ---------------- 去标记（供摘要用） ---------------- */
  function strip(text) {
    let s = String(text == null ? '' : text);
    s = s.replace(/```[a-zA-Z0-9]*\n?/g, '').replace(/```/g, '');
    s = s.replace(/!\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g, '$1');
    s = s.replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))*)\)/g, '$1');
    s = s.replace(/^#{1,6}\s+/gm, '');
    s = s.replace(/^\s*>\s?/gm, '');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/^\s*\d+\.\s+/gm, '');
    s = s.replace(/`([^`\n]+)`/g, '$1');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '$1');
    s = s.replace(/~~([^~\n]+)~~/g, '$1');
    s = s.replace(/\*([^*\n]+)\*/g, '$1');
    s = s.replace(/(^|[^\w_])_([^_\n]+)_/g, '$1$2');
    return s;
  }

  /* ---------------- 消息格式判定 ---------------- */
  function isMdMsg(m) {
    if (!m) return false;
    if (m.fmt === 'md') return true;
    if (m.fmt === 'txt') return false;
    return detect(m.content) === 'md'; // 旧数据兜底：惰性检测，不写回存储
  }

  // 取正文首个标题的文本（没有则返回 null），用于避免标题与 h1 重复显示
  function firstHeading(text) {
    const s = String(text == null ? '' : text);
    const lines = s.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
      if (m) return strip(m[2]).trim();
      if (lines[i].trim()) return null; // 首个非空行不是标题
    }
    return null;
  }

  window.MD = {
    detect: detect,
    detectLoose: detectLoose,
    render: render,
    strip: strip,
    isMdMsg: isMdMsg,
    firstHeading: firstHeading
  };
})();
