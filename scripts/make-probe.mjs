/* 生成 __probe.html：基于真实 index.html 注入探针脚本（保持真实 DOM 结构） */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

const seedScript = `<script>
/* 探针：预置一条含宽 Markdown 表格的消息，并清掉主题宽度残留 */
(function(){
  var now = new Date().toISOString();
  var sid = 'probe-s1';
  var table = [
    '分类 | 命令 | 作用说明 | 什么时候用 & 注意点',
    '---|---|---|---|',
    '读取 | cat file | 打印文件全部内容 | 想快速看整个文件时，注意大文件慎用',
    '写入 | tee file | 同时输出到屏幕和文件 | 需要边看边存时使用',
    '查找 | grep -rn "kw" . | 递归搜索关键字 | 定位某个符号或配置项所在位置时',
    '磁盘 | du -sh * | 统计各目录占用大小 | 排查空间不足时，建议加 -h 提升可读性',
    '网络 | ss -tulpn | 查看监听端口与进程 | 排查端口占用与连接异常问题时',
    '进程 | ps aux --sort=-%mem | 按内存排序进程列表 | 定位内存占用过高的服务时使用',
    '日志 | journalctl -u svc -f | 实时跟踪服务日志 | 观察服务异常与请求链路时非常有用',
    '长字段 | docker-compose-up-d-build-with-cache-and-log-follow | 启动全部服务并复用构建缓存 | 仅用于本地开发环境快速拉起整个依赖栈，生产环境请勿直接使用该命令'
  ].join('\\n');
  try { localStorage.removeItem('prompt-box-theme-v1'); } catch (e) {}
  /* 探针标题文档：12 个标题（h1/h2/h3/h4 混合），正文足够长以便滚动 */
  var doc = [
    '# 探针主标题',
    '导语段落。',
    '## 第一节',
    '正文一。',
    '### 第一节子项',
    '正文二。',
    '## 第二节',
    '正文三。',
    '### 第二节子项甲',
    '正文四。',
    '### 第二节子项乙',
    '正文五。',
    '#### 第二节深层',
    '正文六。',
    '## 第三节',
    '正文七。',
    '### 第三节子项',
    '正文八。',
    '## 第四节',
    '正文九。',
    '### 第四节子项甲',
    '正文十。',
    '#### 第四节深层甲',
    '正文十一。',
    '### 第四节子项乙',
    '正文十二。',
    '## 第五节',
    '正文十三。'
  ].join('\\n');
  localStorage.setItem('prompt-box-wechat-v1', JSON.stringify({
    sessions: [{ id: sid, name: '探针会话', icon: '💬' }],
    messages: [
      { id: 'probe-m1', sessionId: sid, title: '速查表', content: table, side: 'you', createdAt: now, fmt: 'md' },
      { id: 'probe-m2', sessionId: sid, title: '短消息', content: '你好', side: 'me', createdAt: now },
      { id: 'probe-m3', sessionId: sid, title: '标题文档', content: doc, side: 'you', createdAt: now, fmt: 'md' }
    ],
    pins: [], favs: {}, currentSessionId: sid
  }));
})();
</script>
`;

const probeScript = `<script>
/* 探针：拖拽调宽行为断言
   宽度测量统一用 offsetWidth（不受 lbIn 入场动画 scale(.98) 影响），
   只有「是否溢出视口」这类位置断言才用 getBoundingClientRect。
   headless 下 CSS transition 依赖真实时间推进，虚拟时间会让它停在起点，
   因此探针页关闭宽度过渡，保证测到的是目标宽度。 */
(function () {
  var st = document.createElement('style');
  st.textContent = '.lb-card{transition:none!important;animation:none!important}';
  document.head.appendChild(st);
  var log = [], pass = 0, fail = 0;
  function ok(name, cond, extra) {
    if (cond) { pass++; log.push('PASS  ' + name); }
    else { fail++; log.push('FAIL  ' + name + (extra ? '  → ' + extra : '')); }
  }
  function card() { return document.querySelector('#lightbox .lb-card'); }
  function rectOf(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { t: +r.top.toFixed(1), l: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  }
  function wOf(el) { return el ? el.offsetWidth : 0; }
  function fire(el, type, x, y) {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      pointerId: 1, pointerType: 'mouse', isPrimary: true
    }));
  }
  function drag(el, side, dx) {
    var r = el.getBoundingClientRect();
    var x = side === 'r' ? r.right - 3 : r.left + 3;
    var y = r.top + r.height / 2;
    fire(el, 'pointerdown', x, y);
    fire(el, 'pointermove', x + dx, y);
    fire(el, 'pointerup', x + dx, y);
  }
  function theme() { try { return JSON.parse(localStorage.getItem('prompt-box-theme-v1') || '{}'); } catch (e) { return {}; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.addEventListener('load', function () {
    setTimeout(function () {
      run().catch(function (e) { log.push('ERROR ' + e.message + ' | ' + e.stack); fail++; })
        .then(function () {
          var out = document.getElementById('probeOut');
          out.textContent = log.join('\\n');
          document.title = fail === 0 ? 'PROBE_PASS ' + pass : 'PROBE_FAIL ' + fail;
        });
    }, 500);
  });

  async function run() {
    var all = Array.prototype.slice.call(document.querySelectorAll('.bubble'));
    ok('E0 渲染出气泡', all.length > 0, 'count=' + all.length);
    if (!all.length) return;

    // 找到含宽表格的那条气泡（DOM 顺序不保证）
    var tableBubble = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].querySelector('.md-table-wrap')) { tableBubble = all[i]; break; }
    }
    ok('E0b 找到含表格的气泡', !!tableBubble);
    if (!tableBubble) return;

    tableBubble.click();
    await sleep(400);   // 气泡单击有 220ms 防抖延迟
    var lb = document.getElementById('lightbox');
    ok('E1 灯箱已打开', !lb.hidden);
    var c = card();
    if (!c) { log.push('ERROR 未找到 .lb-card'); fail++; return; }

    var vw = document.documentElement.clientWidth;
    var lbcs = getComputedStyle(lb);
    var padX = parseFloat(lbcs.paddingLeft) + parseFloat(lbcs.paddingRight);
    var cap = Math.floor((vw - padX) * (2 / 3));
    var w0 = wOf(c);
    log.push('INFO 视口宽 ' + vw + ' 内容盒 ' + (vw - padX) + ' cap ' + cap + ' 初始宽 ' + w0);

    ok('W1 初始宽度 = 标准宽度 820', Math.abs(w0 - 820) < 1.5, 'w0=' + w0);

    /* 顺序：先左边缘（变宽）再右边缘，避免一开始就顶到上限 */
    var before3 = wOf(c);
    drag(c, 'l', -60);
    await sleep(320);
    var after3 = wOf(c);
    ok('W3 拖左边缘变宽', after3 > before3 + 20, 'before=' + before3 + ' after=' + after3);

    var before2 = wOf(c);
    drag(card(), 'r', 60);
    await sleep(320);
    var after2 = wOf(c);
    ok('W2 拖右边缘变宽', after2 > before2 + 20, 'before=' + before2 + ' after=' + after2);

    drag(card(), 'r', 5000);
    await sleep(320);
    var w4 = wOf(card());
    ok('W4 不超过 2/3 上限', w4 <= cap + 1, 'w4=' + w4 + ' cap=' + cap);

    drag(card(), 'r', -5000);
    await sleep(320);
    var w5 = wOf(card());
    ok('W5 不低于标准宽度', w5 >= 819, 'w5=' + w5);

    var th = theme();
    ok('W6 宽度已持久化', typeof th.lbW === 'number' && Math.abs(th.lbW - w5) < 3, 'lbW=' + th.lbW + ' w5=' + w5);

    ok('W7 拖拽后灯箱未被误关', !document.getElementById('lightbox').hidden);

    var rr = card().getBoundingClientRect();
    ok('W8 卡片不溢出视口', rr.left >= -1 && rr.right <= vw + 1, 'l=' + rr.left.toFixed(1) + ' r=' + rr.right.toFixed(1));

    var closeBtn = document.getElementById('lbClose');
    var cr = closeBtn.getBoundingClientRect();
    var topEl = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
    ok('W9 关闭按钮未被手柄遮挡', topEl === closeBtn || closeBtn.contains(topEl), 'top=' + (topEl && (topEl.className || topEl.id)));

    var wrap = card().querySelector('.md-table-wrap');
    var body = document.getElementById('lbBody');
    if (wrap) {
      var cw = wOf(card());
      ok('W10 宽表格未撑破卡片', wrap.offsetWidth <= cw + 1, 'wrap=' + wrap.offsetWidth + ' card=' + cw);
      // 横向轨道已上提到正文，表格自身不再带滚动容器
      ok('W10b 表格容器不再自带横向轨道', getComputedStyle(wrap).overflowX === 'visible', 'ox=' + getComputedStyle(wrap).overflowX);
    } else { log.push('INFO 未找到 .md-table-wrap'); fail++; }

    /* W14 竖向滚动条已隐藏：轨道不占位（offsetWidth === clientWidth） */
    ok('W14 竖向滚动条已隐藏', body.offsetWidth - body.clientWidth === 0,
       'off=' + body.offsetWidth + ' cli=' + body.clientWidth);

    /* W15 横向滚动归属正文：正文可横滚，且表格容器不再截流 */
    ok('W15 横向滚动归属正文', body.scrollWidth > body.clientWidth,
       'sw=' + body.scrollWidth + ' cw=' + body.clientWidth);

    /* W16 横向轨道常驻卡片底部：纵向滚动后仍在正文盒子底部占位 */
    var canScrollY = body.scrollHeight > body.clientHeight;
    if (canScrollY) { body.scrollTop = body.scrollHeight; await sleep(120); }
    body.scrollLeft = 200;
    await sleep(120);
    ok('W16a 纵向滚动后横向仍可拖动', body.scrollLeft > 0, 'scrollLeft=' + body.scrollLeft + ' scrollTop=' + body.scrollTop);
    ok('W16b 横向轨道常驻正文底部', body.offsetHeight - body.clientHeight > 0,
       'off=' + body.offsetHeight + ' cli=' + body.clientHeight + ' canScrollY=' + canScrollY);

    var hint = document.getElementById('lbWidthHint');
    ok('W11 宽度提示条默认隐藏', !!(hint && hint.hidden));

    var grip = document.getElementById('lbGripR');
    var wB = wOf(card());
    grip.focus();
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await sleep(320);
    var wA = wOf(card());
    ok('W12 方向键可调宽', wA > wB, 'before=' + wB + ' after=' + wA + ' lbW=' + theme().lbW + ' css=' + getComputedStyle(document.documentElement).getPropertyValue('--lb-width'));

    /* W17 宽度变化后宽内容仍正常适配：横向可滚、内容不溢出轨道 */
    var body2 = document.getElementById('lbBody');
    body2.scrollLeft = 0;
    await sleep(80);
    var ovf = body2.scrollWidth > body2.clientWidth;
    body2.scrollLeft = 150;
    await sleep(120);
    ok('W17 宽度变化后横向滚动仍正常', ovf ? body2.scrollLeft > 0 : true,
       'sw=' + body2.scrollWidth + ' cw=' + body2.clientWidth + ' sl=' + body2.scrollLeft + ' cardW=' + wOf(card()));

    // 拖拽结束 300ms 后，遮罩点击必须能正常关闭
    await sleep(400);
    document.getElementById('lbMask').click();
    ok('W13 点击遮罩可关闭灯箱', document.getElementById('lightbox').hidden);

    /* ================= TOC 目录面板 ================= */
    var lbEl = document.getElementById('lightbox');
    var tocBtn = document.getElementById('lbTocBtn');
    var tocEl = document.getElementById('lbToc');
    var tocList = document.getElementById('lbTocList');

    // T1 无标题消息（纯文本）→ 大纲按钮应隐藏
    var txtBubble = document.querySelector('.bubble[data-id="probe-m2"]');
    var docBubble = document.querySelector('.bubble[data-id="probe-m3"]');
    ok('T0 找到纯文本气泡与标题文档气泡', !!txtBubble && !!docBubble,
       'txt=' + !!txtBubble + ' doc=' + !!docBubble);

    if (txtBubble) {
      txtBubble.click();
      await sleep(420);
      ok('T1 纯文本消息打开成功', !lbEl.hidden);
      ok('T2 无标题时大纲按钮隐藏', !tocBtn.classList.contains('show'),
         'show=' + tocBtn.classList.contains('show'));
      ok('T3 无标题时目录列表为空', tocList.children.length === 0, 'n=' + tocList.children.length);
      document.getElementById('lbClose').click();
      await sleep(200);
    }

    if (!docBubble) return;

    docBubble.click();
    await sleep(420);
    ok('T4 标题文档打开成功', !lbEl.hidden);
    ok('T5 有标题时大纲按钮显示', tocBtn.classList.contains('show'));

    var items = Array.prototype.slice.call(tocList.querySelectorAll('.toc-item'));
    ok('T6 目录项上限 10 条', items.length === 10, 'n=' + items.length);

    // T7 层级缩进严格对应标题标签层级：H1 最浅，逐级加 16px
    var lvTags = items.map(function (it) { return it.querySelector('.toc-lv').textContent; });
    var pads = items.map(function (it) { return parseFloat(it.style.paddingLeft) || 0; });
    log.push('INFO 目录层级 ' + lvTags.join(',') + ' | 缩进 ' + pads.join(','));
    var padOk = true, padDetail = '';
    for (var pi = 1; pi < lvTags.length; pi++) {
      var prevLv = parseInt(lvTags[pi - 1].slice(1), 10);
      var curLv = parseInt(lvTags[pi].slice(1), 10);
      var expect = pads[0] + (curLv - parseInt(lvTags[0].slice(1), 10)) * 16;
      if (Math.abs(pads[pi] - expect) > 0.5) {
        padOk = false;
        padDetail = 'i=' + pi + ' lv=' + lvTags[pi] + ' pad=' + pads[pi] + ' expect=' + expect;
        break;
      }
      if (curLv < prevLv) { /* 层级回退属正常（子节结束），仅记录不断言 */ }
    }
    ok('T7 目录缩进与标题层级一一对应', padOk, padDetail);
    ok('T8 首个目录项为 H1 且缩进最浅', lvTags[0] === 'H1' && pads[0] === 14,
       'lv=' + lvTags[0] + ' pad=' + pads[0]);

    // T9 超出 10 条时有提示
    var more = tocList.querySelector('.toc-more');
    ok('T9 超出上限时给出提示', !!more && /10/.test(more.textContent),
       'more=' + (more ? more.textContent : 'null'));

    // T10 面板初始关闭且在视口右侧之外
    ok('T10 面板初始未展开', !tocEl.classList.contains('open'));
    var tocCs = getComputedStyle(tocEl);
    ok('T11 面板滑入过渡 200~300ms',
       /0\\.2|0\\.25|0\\.26|0\\.3/.test(tocCs.transitionDuration),
       'dur=' + tocCs.transitionDuration);

    // T12 点击按钮展开面板
    // headless 虚拟时间不推进 CSS transition，面板会停在 translateX(100%),
    // 测不到展开后的真实位置 —— 这里在 T11 断言完过渡时长后关掉面板过渡。
    var noTocTrans = document.createElement('style');
    noTocTrans.textContent = '.lb-toc{transition:none!important}.lb-toc-btn{transition:none!important}';
    document.head.appendChild(noTocTrans);

    // T12a 面板关闭时：胶囊贴在卡片内侧右缘，并垂直居中于正文区
    var cardRc = card().getBoundingClientRect();
    var btnRc = tocBtn.getBoundingClientRect();
    var bodyRc = document.getElementById('lbBody').getBoundingClientRect();
    ok('T12a 面板关闭时胶囊贴在卡片内侧右缘',
       btnRc.right <= cardRc.right - 4 && btnRc.right >= cardRc.right - 20,
       'btnR=' + btnRc.right.toFixed(1) + ' cardR=' + cardRc.right.toFixed(1));
    ok('T12b 胶囊垂直居中于正文区',
       Math.abs((btnRc.top + btnRc.bottom) / 2 - (bodyRc.top + bodyRc.bottom) / 2) < 6,
       'btnC=' + ((btnRc.top + btnRc.bottom) / 2).toFixed(1) +
       ' bodyC=' + ((bodyRc.top + bodyRc.bottom) / 2).toFixed(1));

    tocBtn.click();
    await sleep(360);
    ok('T12 点击按钮展开面板', tocEl.classList.contains('open'));
    ok('T13 面板可见', tocEl.getBoundingClientRect().width > 100,
       'w=' + tocEl.getBoundingClientRect().width);
    ok('T14 面板在视口右侧', tocEl.getBoundingClientRect().right <= vw + 1,
       'r=' + tocEl.getBoundingClientRect().right);
    log.push('INFO 面板几何 ' + JSON.stringify({
      toc: rectOf(tocEl), head: rectOf(tocEl.querySelector('.lb-toc-head')),
      list: rectOf(tocEl.querySelector('.lb-toc-list')),
      card: rectOf(card()), btn: rectOf(tocBtn),
      vw: vw, vh: document.documentElement.clientHeight
    }));
    ok('T14b 面板顶到视口上沿（不被遮罩压住）',
       Math.abs(tocEl.getBoundingClientRect().top) < 2,
       'top=' + tocEl.getBoundingClientRect().top.toFixed(1));
    ok('T14c 目录头栏可见且在列表上方',
       !!tocEl.querySelector('.lb-toc-head') &&
       tocEl.querySelector('.lb-toc-head').getBoundingClientRect().bottom <=
       tocEl.querySelector('.lb-toc-list').getBoundingClientRect().top + 1,
       'headB=' + (tocEl.querySelector('.lb-toc-head') || {getBoundingClientRect:function(){return{}}}).getBoundingClientRect().bottom);
    ok('T14d 面板不透明（不透出正文）',
       getComputedStyle(tocEl).backgroundColor !== 'rgba(0, 0, 0, 0)',
       'bg=' + getComputedStyle(tocEl).backgroundColor);

    // T15 面板展开时：卡片整体左移让位，按钮仍贴在卡片内侧右缘
    var btnR2 = tocBtn.getBoundingClientRect();
    var cardR2 = card().getBoundingClientRect();
    var tocLeft = vw - tocEl.offsetWidth;
    ok('T15 展开时卡片左移让位',
       cardR2.right <= vw - tocEl.offsetWidth - 12,
       'cardR=' + cardR2.right.toFixed(1) + ' limit=' + (vw - tocEl.offsetWidth - 12).toFixed(1));
    ok('T15d 展开时按钮仍贴卡片内侧右缘',
       Math.abs(btnR2.right - (cardR2.right - 12)) < 6,
       'btnR=' + btnR2.right.toFixed(1) + ' expect=' + (cardR2.right - 12).toFixed(1));

    // T25 胶囊形态：细长、圆角呈胶囊状
    var capH = tocBtn.offsetHeight, capW = tocBtn.offsetWidth;
    var capRadius = parseFloat(getComputedStyle(tocBtn).borderTopLeftRadius) || 0;
    ok('T25 胶囊形态正确（26×110 上下半圆）',
       capH >= 96 && capH <= 110 && Math.abs(capW - 26) <= 1 && capRadius >= capH / 2,
       'h=' + capH + ' w=' + capW + ' r=' + capRadius);

    // T26 不遮挡其他标志模块：头部关闭键、底部操作栏、边缘拖拽热区
    function overlaps(a, b) {
      return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    }
    var btnR3 = tocBtn.getBoundingClientRect();
    var closeRc = document.getElementById('lbClose').getBoundingClientRect();
    var actsRc = document.querySelector('#lightbox .lb-actions').getBoundingClientRect();
    var cardRc3 = card().getBoundingClientRect();
    var hotZone = { left: cardRc3.right - 8, right: cardRc3.right, top: cardRc3.top, bottom: cardRc3.bottom };
    ok('T26 胶囊不遮挡头部关闭键', !overlaps(btnR3, closeRc),
       'btn=' + JSON.stringify(rectOf(tocBtn)) + ' close=' + JSON.stringify(rectOf(document.getElementById('lbClose'))));
    ok('T26b 胶囊不遮挡底部操作栏', !overlaps(btnR3, actsRc),
       'btn=' + JSON.stringify(rectOf(tocBtn)) + ' acts=' + JSON.stringify(rectOf(document.querySelector('#lightbox .lb-actions'))));
    ok('T26c 胶囊不进入卡片边缘拖拽热区', !overlaps(btnR3, hotZone),
       'btnR=' + btnR3.right.toFixed(1) + ' cardR=' + cardRc3.right.toFixed(1));

    // T24 汉堡图标尺寸不小于 15px（防止被缩回不可辨的「三个点」）
    var icoEl = tocBtn.querySelector('.ico');
    ok('T24 汉堡图标尺寸不小于 15px',
       !!icoEl && icoEl.getBoundingClientRect().width >= 14.5,
       'w=' + (icoEl ? icoEl.getBoundingClientRect().width : 0));

    // T15b 面板宽度公式：min(320px, 86vw)，不同屏宽下保持合理比例
    var expectW = Math.min(320, Math.floor(vw * 0.86));
    ok('T15b 面板宽度符合 min(320px,86vw)', Math.abs(tocEl.offsetWidth - expectW) < 2,
       'w=' + tocEl.offsetWidth + ' expect=' + expectW + ' vw=' + vw);

    // T15c 按钮始终不溢出视口
    ok('T15c 按钮不溢出视口', btnR2.left >= 0 && btnR2.right <= vw + 1,
       'l=' + btnR2.left.toFixed(1) + ' r=' + btnR2.right.toFixed(1));

    // T16 点击目录项 → 平滑滚动到对应标题
    var bodyEl = document.getElementById('lbBody');
    bodyEl.scrollTop = 0;
    await sleep(60);
    var target = items[5];
    var targetLv = target.querySelector('.toc-lv').textContent;
    target.click();
    await sleep(600);   // 340ms 动画 + 余量
    var headEls = Array.prototype.slice.call(bodyEl.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    var idx = parseInt(target.dataset.idx, 10);
    var expectHead = headEls[idx];
    var headRect = expectHead.getBoundingClientRect();
    var bodyRect = bodyEl.getBoundingClientRect();
    var off = Math.abs(headRect.top - bodyRect.top - 12);
    ok('T16 点击目录项滚动到目标标题', off < 6,
       'lv=' + targetLv + ' off=' + off.toFixed(1) + ' scrollTop=' + bodyEl.scrollTop);
    ok('T17 滚动后目标标题带高亮反馈', expectHead.classList.contains('toc-hit'),
       'cls=' + expectHead.className);
    ok('T18 目录项标记为当前项', target.classList.contains('active'));

    // T19 跳转后正文确实滚动了
    ok('T19 跳转后正文发生滚动', bodyEl.scrollTop > 0, 'scrollTop=' + bodyEl.scrollTop);

    // T23 末尾章节边界：正文滚到底后无法让标题停到顶部，
    // 但必须保证该标题仍完整落在可视区内（不能滚过头看不见）
    var lastItem = items[items.length - 1];
    bodyEl.scrollTop = 0;
    await sleep(60);
    lastItem.click();
    await sleep(600);
    var lastIdx = parseInt(lastItem.dataset.idx, 10);
    var lastHead = headEls[lastIdx];
    var lh = lastHead.getBoundingClientRect();
    var br = bodyEl.getBoundingClientRect();
    ok('T23 末尾章节仍完整可见',
       lh.top >= br.top - 1 && lh.bottom <= br.bottom + 1,
       'top=' + (lh.top - br.top).toFixed(1) + ' bottom=' + (lh.bottom - br.top).toFixed(1) +
       ' bodyH=' + br.height.toFixed(1));

    // T20 关闭面板后状态复位
    document.getElementById('lbTocClose').click();
    await sleep(360);
    ok('T20 关闭按钮收起面板', !tocEl.classList.contains('open'));

    // T21 Esc 优先收起面板而非直接关灯箱
    tocBtn.click();
    await sleep(300);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(120);
    ok('T21 Esc 先收面板', !tocEl.classList.contains('open') && !lbEl.hidden,
       'tocOpen=' + tocEl.classList.contains('open') + ' lbHidden=' + lbEl.hidden);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(150);
    ok('T22 再次 Esc 关闭灯箱', lbEl.hidden);
  }
})();
</script>
`;

let out = html.replace('<script src="data/seed-prompts.js"></script>',
  '<script src="data/seed-prompts.js"></script>\n' + seedScript);
out = out.replace('</body>', '<div id="probeOut" style="position:fixed;left:0;top:0;z-index:9999;background:#fff;font:12px/1.6 monospace;white-space:pre-wrap;padding:8px;max-width:100%;pointer-events:none;"></div>\n' + probeScript + '\n</body>');
writeFileSync('__probe.html', out, 'utf8');
console.log('__probe.html 已生成');

/* ================= 移动端探针 =================
   桌面探针里不少断言依赖 820px 初始宽度，窄屏下会误报，
   故单独生成一份只覆盖 TOC 响应式行为的移动端探针。 */
const mobileScript = `<script>
(function () {
  var st = document.createElement('style');
  st.textContent = '.lb-card{transition:none!important;animation:none!important}.lb-toc{transition:none!important}.lb-toc-btn{transition:none!important}';
  document.head.appendChild(st);
  var log = [], pass = 0, fail = 0;
  function ok(name, cond, extra) {
    if (cond) { pass++; log.push('PASS  ' + name); }
    else { fail++; log.push('FAIL  ' + name + (extra ? '  → ' + extra : '')); }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  window.addEventListener('load', function () {
    setTimeout(function () {
      run().catch(function (e) { log.push('ERROR ' + e.message); fail++; })
        .then(function () {
          var out = document.getElementById('probeOut');
          out.textContent = log.join('\\n');
          document.title = fail === 0 ? 'PROBE_PASS ' + pass : 'PROBE_FAIL ' + fail;
        });
    }, 500);
  });

  async function run() {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    log.push('INFO 移动端视口 ' + vw + 'x' + vh);

    var docBubble = document.querySelector('.bubble[data-id="probe-m3"]');
    ok('M0 找到标题文档气泡', !!docBubble);
    if (!docBubble) return;

    docBubble.click();
    await sleep(450);

    var lbEl = document.getElementById('lightbox');
    var tocBtn = document.getElementById('lbTocBtn');
    var tocEl = document.getElementById('lbToc');
    var tocList = document.getElementById('lbTocList');
    var card = document.querySelector('#lightbox .lb-card');
    var bodyEl = document.getElementById('lbBody');

    ok('M1 灯箱已打开', !lbEl.hidden);
    ok('M2 卡片不溢出视口',
       card.getBoundingClientRect().right <= vw + 1,
       'r=' + card.getBoundingClientRect().right.toFixed(1) + ' vw=' + vw);
    ok('M3 大纲按钮显示', tocBtn.classList.contains('show'));

    var btnR = tocBtn.getBoundingClientRect();
    ok('M4 按钮完整落在视口内', btnR.left >= 0 && btnR.right <= vw + 1 && btnR.top >= 0 && btnR.bottom <= vh + 1,
       'l=' + btnR.left.toFixed(1) + ' r=' + btnR.right.toFixed(1) + ' t=' + btnR.top.toFixed(1) + ' b=' + btnR.bottom.toFixed(1));
    ok('M5 目录项数量为 10', tocList.querySelectorAll('.toc-item').length === 10,
       'n=' + tocList.querySelectorAll('.toc-item').length);

    // 窄屏下面板应占 86vw（不超过 320px 的上限由视口宽决定）
    tocBtn.click();
    await sleep(320);
    ok('M6 面板已展开', tocEl.classList.contains('open'));
    var expectW = Math.min(320, Math.floor(vw * 0.86));
    log.push('INFO 面板宽 ' + tocEl.offsetWidth + ' / 视口 ' + vw +
             ' → 占比 ' + (tocEl.offsetWidth / vw * 100).toFixed(1) + '%');
    ok('M7 面板宽度符合 min(320px,86vw)', Math.abs(tocEl.offsetWidth - expectW) < 2,
       'w=' + tocEl.offsetWidth + ' expect=' + expectW + ' vw=' + vw);
    var tr = tocEl.getBoundingClientRect();
    ok('M8 面板完整落在视口内', tr.left >= -1 && tr.right <= vw + 1,
       'l=' + tr.left.toFixed(1) + ' r=' + tr.right.toFixed(1));
    ok('M9 展开后按钮不溢出视口',
       tocBtn.getBoundingClientRect().left >= 0 && tocBtn.getBoundingClientRect().right <= vw + 1,
       'l=' + tocBtn.getBoundingClientRect().left.toFixed(1));
    // 窄屏没有让位空间：开关应移入面板头部左侧，收为圆角小块充当关闭开关
    var tocHead = tocEl.querySelector('.lb-toc-head');
    ok('M9b 窄屏下开关移入面板头部',
       !!tocHead && tocHead.contains(tocBtn) && tocBtn.classList.contains('lb-toc-btn--panel'),
       'inHead=' + (tocHead ? tocHead.contains(tocBtn) : false) +
       ' cls=' + tocBtn.className);
    ok('M9c 窄屏下开关为圆角小块',
       tocBtn.offsetWidth <= 30 && tocBtn.offsetHeight <= 30,
       'w=' + tocBtn.offsetWidth + ' h=' + tocBtn.offsetHeight);
    ok('M9d 窄屏下开关位于面板头部左侧',
       !!tocHead && tocBtn.getBoundingClientRect().left <= tocHead.getBoundingClientRect().left + 40,
       'btnL=' + tocBtn.getBoundingClientRect().left.toFixed(1) +
       ' headL=' + (tocHead ? tocHead.getBoundingClientRect().left.toFixed(1) : 'na'));

    // 窄屏下跳转定位
    var items = Array.prototype.slice.call(tocList.querySelectorAll('.toc-item'));
    bodyEl.scrollTop = 0;
    await sleep(60);
    items[4].click();
    await sleep(600);
    var headEls = Array.prototype.slice.call(bodyEl.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    var off = Math.abs(headEls[4].getBoundingClientRect().top - bodyEl.getBoundingClientRect().top - 12);
    ok('M10 窄屏跳转定位到目标标题', off < 6, 'off=' + off.toFixed(1));
    ok('M11 落点标题有高亮反馈', headEls[4].classList.contains('toc-hit'));

    // 遮罩点击先收面板
    document.getElementById('lbMask').click();
    await sleep(200);
    ok('M12 遮罩点击先收面板不关灯箱', !tocEl.classList.contains('open') && !lbEl.hidden,
       'tocOpen=' + tocEl.classList.contains('open') + ' lbHidden=' + lbEl.hidden);
    document.getElementById('lbClose').click();
    await sleep(150);
    ok('M13 关闭按钮关闭灯箱', lbEl.hidden);
  }
})();
</script>
`;

let mOut = html.replace('<script src="data/seed-prompts.js"></script>',
  '<script src="data/seed-prompts.js"></script>\n' + seedScript);
mOut = mOut.replace('</body>', '<div id="probeOut" style="position:fixed;left:0;top:0;z-index:9999;background:#fff;font:12px/1.6 monospace;white-space:pre-wrap;padding:8px;max-width:100%;pointer-events:none;"></div>\n' + mobileScript + '\n</body>');
writeFileSync('__probe-m.html', mOut, 'utf8');
console.log('__probe-m.html 已生成');
