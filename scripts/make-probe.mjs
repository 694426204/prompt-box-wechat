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
  localStorage.setItem('prompt-box-wechat-v1', JSON.stringify({
    sessions: [{ id: sid, name: '探针会话', icon: '💬' }],
    messages: [
      { id: 'probe-m1', sessionId: sid, title: '速查表', content: table, side: 'you', createdAt: now, fmt: 'md' },
      { id: 'probe-m2', sessionId: sid, title: '短消息', content: '你好', side: 'me', createdAt: now }
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
    if (wrap) {
      var cw = wOf(card());
      ok('W10 宽表格未撑破卡片', wrap.offsetWidth <= cw + 1, 'wrap=' + wrap.offsetWidth + ' card=' + cw);
      ok('W10b 宽表格内部横向滚动', wrap.scrollWidth > wrap.clientWidth, 'sw=' + wrap.scrollWidth + ' cw=' + wrap.clientWidth);
    } else { log.push('INFO 未找到 .md-table-wrap'); fail++; }

    var hint = document.getElementById('lbWidthHint');
    ok('W11 宽度提示条默认隐藏', !!(hint && hint.hidden));

    var grip = document.getElementById('lbGripR');
    var wB = wOf(card());
    grip.focus();
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await sleep(320);
    var wA = wOf(card());
    ok('W12 方向键可调宽', wA > wB, 'before=' + wB + ' after=' + wA + ' lbW=' + theme().lbW + ' css=' + getComputedStyle(document.documentElement).getPropertyValue('--lb-width'));

    // 拖拽结束 300ms 后，遮罩点击必须能正常关闭
    await sleep(400);
    document.getElementById('lbMask').click();
    ok('W13 点击遮罩可关闭灯箱', document.getElementById('lightbox').hidden);
  }
})();
</script>
`;

let out = html.replace('<script src="data/seed-prompts.js"></script>',
  '<script src="data/seed-prompts.js"></script>\n' + seedScript);
out = out.replace('</body>', '<div id="probeOut" style="position:fixed;left:0;top:0;z-index:9999;background:#fff;font:12px/1.6 monospace;white-space:pre-wrap;padding:8px;max-width:100%;pointer-events:none;"></div>\n' + probeScript + '\n</body>');
writeFileSync('__probe.html', out, 'utf8');
console.log('__probe.html 已生成');
