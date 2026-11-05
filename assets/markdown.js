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
    // 表格：必须存在「表头行 + 分隔行」的结构才算表格
    if (hasTable(s)) { total += 3; strong = true; }
    // 单行竖线内容只是「像表格」的弱信号，不足以单独判 md
    else if (/^\s*\|.+\|\s*$/m.test(s)) total += 1;
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

  /* ---------------- 表格原语（GFM 管道表格） ---------------- */

  // 按「未转义且不在行内代码中」的竖线切分单元格
  function splitCells(line) {
    const s = String(line == null ? '' : line);
    const cells = [];
    let cur = '';
    let inCode = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      // 转义竖线：还原为字面量
      if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '`') { inCode = !inCode; cur += ch; continue; }
      if (ch === '|' && !inCode) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    // 去掉首尾空单元格（对应行首 / 行尾的竖线）
    if (cells.length > 1 && cells[0].trim() === '') cells.shift();
    if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
    return cells.map(c => c.trim());
  }

  // 判定分隔行，返回各列对齐方式；不是分隔行则返回 null
  function isDelimRow(line) {
    const cells = splitCells(line);
    if (!cells.length) return null;
    const aligns = [];
    for (const c of cells) {
      const m = /^(:?)-+(:?)$/.exec(c);
      if (!m) return null;
      const left = m[1] === ':';
      const right = m[2] === ':';
      aligns.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
    }
    return { aligns: aligns };
  }

  // 行内是否存在未转义的竖线（数据行必须含竖线，否则视为段落、表格结束）
  function hasPipe(line) {
    const s = String(line == null ? '' : line);
    let inCode = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '`') { inCode = !inCode; continue; }
      if (ch === '|' && !inCode) return true;
    }
    return false;
  }

  // 判定 lines[i] 处是否为表格起点，返回表头 / 对齐 / 数据行
  function tableAt(lines, i) {
    if (i + 1 >= lines.length) return null;
    const headLine = lines[i];
    if (!hasPipe(headLine)) return null;

    const header = splitCells(headLine);
    if (header.length < 2) return null; // 单列不成表

    const d = isDelimRow(lines[i + 1]);
    if (!d || d.aligns.length !== header.length) return null;

    const rows = [];
    let k = i + 2;
    while (k < lines.length) {
      const line = lines[k];
      if (!line.trim()) break;          // 空行结束表格
      if (/^\s*```/.test(line)) break;  // 代码围栏结束表格
      if (/^#{1,6}\s+/.test(line)) break; // 标题结束表格
      if (!hasPipe(line)) break;        // 无竖线的行是段落，表格结束
      const cells = splitCells(line);
      const row = cells.slice(0, header.length);
      while (row.length < header.length) row.push(''); // 缺列补空
      rows.push(row);
      k++;
    }
    return { header: header, aligns: d.aligns, rows: rows };
  }

  // 整段文本中是否存在表格（用于判档；忽略代码围栏内容）
  function hasTable(text) {
    const s = String(text == null ? '' : text);
    // 先剔除代码围栏，避免围栏内的竖线被当成表格
    const cleaned = s.replace(/```[\s\S]*?(```|$)/g, '');
    const lines = cleaned.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      if (tableAt(lines, i)) return true;
    }
    return false;
  }

  // 对齐方式 -> class 属性
  function alignAttr(align) {
    return align ? ' class="al-' + align + '"' : '';
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

      // 表格（GFM 管道表格）
      const tbl = tableAt(raw, i);
      if (tbl) {
        const ths = tbl.header.map(function (c, k) {
          return '<th' + alignAttr(tbl.aligns[k]) + '>' + inline(esc(c)) + '</th>';
        }).join('');
        const trs = tbl.rows.map(function (r) {
          return '<tr>' + r.map(function (c, k) {
            return '<td' + alignAttr(tbl.aligns[k]) + '>' + inline(esc(c)) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        out.push('<div class="md-table-wrap"><table class="md-table">' +
          '<thead><tr>' + ths + '</tr></thead>' +
          '<tbody>' + trs + '</tbody>' +
          '</table></div>');
        i += 2 + tbl.rows.length;
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
             !/^\s*\d+\.\s+/.test(raw[i]) &&
             !tableAt(raw, i)) {
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

    // 表格行：分隔行整行删除，其余行的竖线换成空格（摘要里不要出现 |）
    s = s.split(/\r?\n/).map(function (line) {
      if (!hasPipe(line)) return line;
      if (isDelimRow(line)) return '';
      // 转义竖线 \| 先用占位符保护，最后还原为字面量 |
      return line.replace(/\\\|/g, '%%MDP%%').replace(/\|/g, ' ').replace(/%%MDP%%/g, '|');
    }).join('\n');

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
