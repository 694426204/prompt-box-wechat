/* 生成 __shot1.html / __shot2.html：用于视觉截图（拖拽后状态 / 拖拽中提示条） */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

const seed = `<script>
/* headless 虚拟时间下 CSS transition 不会推进，截图会停在过渡起点，
   因此截图页关闭宽度过渡（仅影响截图，不改产品代码） */
(function(){
  var st = document.createElement('style');
  st.textContent = '.lb-card{transition:none!important}';
  document.head.appendChild(st);
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
    '日志 | journalctl -u svc -f | 实时跟踪服务日志 | 观察服务异常与请求链路时非常有用'
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

function fire(el, type, x, y) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1, pointerType: 'mouse', isPrimary: true
  }));
}

const FIRE_SRC = `function fire(el, type, x, y) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1, pointerType: 'mouse', isPrimary: true
  }));
}`;

/* 场景1：拖拽完成后的状态（宽度已加宽，表格横向滚动条可见） */
const shot1 = `<script>
${FIRE_SRC}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      var bubbles = Array.prototype.slice.call(document.querySelectorAll('.bubble'));
      var tb = null;
      for (var i=0;i<bubbles.length;i++){ if(bubbles[i].querySelector('.md-table-wrap')){ tb=bubbles[i]; break; } }
      if(!tb) return;
      tb.click();
      setTimeout(function(){
        var c = document.querySelector('#lightbox .lb-card');
        var r = c.getBoundingClientRect();
        var x = r.right - 3, y = r.top + r.height/2;
        fire(c,'pointerdown',x,y);
        fire(c,'pointermove',x+200,y);
        fire(c,'pointerup',x+200,y);
        setTimeout(function(){ document.title='SHOT1_READY'; }, 400);
      }, 500);
    }, 400);
  });
})();
</script>
`;

/* 场景2：拖拽进行中（宽度提示条跟随指针） */
const shot2 = `<script>
${FIRE_SRC}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      var bubbles = Array.prototype.slice.call(document.querySelectorAll('.bubble'));
      var tb = null;
      for (var i=0;i<bubbles.length;i++){ if(bubbles[i].querySelector('.md-table-wrap')){ tb=bubbles[i]; break; } }
      if(!tb) return;
      tb.click();
      setTimeout(function(){
        var c = document.querySelector('#lightbox .lb-card');
        var r = c.getBoundingClientRect();
        var x = r.right - 3, y = r.top + r.height/2;
        fire(c,'pointerdown',x,y);
        fire(c,'pointermove',x+140,y);
        // 不 pointerup，保持拖拽态与提示条
        setTimeout(function(){ document.title='SHOT2_READY'; }, 300);
      }, 500);
    }, 400);
  });
})();
</script>
`;

function build(file, extra) {
  let out = html.replace('<script src="data/seed-prompts.js"></script>',
    '<script src="data/seed-prompts.js"></script>\n' + seed);
  out = out.replace('</body>', extra + '\n</body>');
  writeFileSync(file, out, 'utf8');
  console.log(file + ' 已生成');
}

build('__shot1.html', shot1);
build('__shot2.html', shot2);
