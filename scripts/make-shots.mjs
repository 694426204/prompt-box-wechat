/* 生成 __shot1.html / __shot2.html / __shot3.html：用于视觉截图
   1) 灯箱打开：右侧无竖向滚动条，底部有横向滚动条
   2) 正文纵向滚到底：横向滚动条仍在卡片底部原位
   3) 拖宽卡片：表格自适应，横向轨道长度随宽度变化 */
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
    '日志 | journalctl -u svc -f | 实时跟踪服务日志 | 观察服务异常与请求链路时非常有用',
    '长字段 | docker-compose-up-d-build-with-cache-and-log-follow | 启动全部服务并复用构建缓存 | 仅用于本地开发环境快速拉起整个依赖栈',
    '进程 | ps aux --sort=-%cpu | 按 CPU 排序进程列表 | 排查 CPU 占用过高的服务时使用',
    '网络 | netstat -anp | 查看全部连接与端口 | 排查连接数过多或端口未释放时',
    '磁盘 | df -h | 查看各分区使用率 | 排查磁盘即将写满的紧急状况时',
    '日志 | tail -f app.log | 实时跟踪应用日志 | 观察接口报错与请求链路时非常有用',
    '容器 | docker ps -a | 查看全部容器状态 | 排查容器异常退出与端口映射问题时',
    '镜像 | docker image prune -a | 清理无用镜像 | 磁盘告急且确认无回滚需求时才执行',
    '配置 | kubectl get pod -A | 查看集群全部 Pod | 排查集群内服务健康状态与调度异常时',
    '监控 | promtail -config.file.yml | 启动日志采集代理 | 采集节点日志上报监控平台时使用'
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

const FIRE_SRC = `function fire(el, type, x, y) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1, pointerType: 'mouse', isPrimary: true
  }));
}`;

const OPEN_HELPER = `function openLightbox(){
  var bubbles = Array.prototype.slice.call(document.querySelectorAll('.bubble'));
  var tb = null;
  for (var i=0;i<bubbles.length;i++){ if(bubbles[i].querySelector('.md-table-wrap')){ tb=bubbles[i]; break; } }
  if(tb) tb.click();
}`;

/* 场景1：灯箱打开（标准宽度），右侧无竖条，底部有横条 */
const shot1 = `<script>
${FIRE_SRC}
${OPEN_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openLightbox();
      setTimeout(function(){ document.title='SHOT1_READY'; }, 600);
    }, 400);
  });
})();
</script>
`;

/* 场景2：正文纵向滚到底，横向轨道仍常驻卡片底部 */
const shot2 = `<script>
${FIRE_SRC}
${OPEN_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openLightbox();
      setTimeout(function(){
        var b = document.getElementById('lbBody');
        b.scrollTop = b.scrollHeight;
        b.scrollLeft = 60;
        setTimeout(function(){ document.title='SHOT2_READY'; }, 400);
      }, 600);
    }, 400);
  });
})();
</script>
`;

/* 场景3：拖宽卡片，表格随宽度自适应 */
const shot3 = `<script>
${FIRE_SRC}
${OPEN_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openLightbox();
      setTimeout(function(){
        var c = document.querySelector('#lightbox .lb-card');
        var r = c.getBoundingClientRect();
        var x = r.right - 3, y = r.top + r.height/2;
        fire(c,'pointerdown',x,y);
        fire(c,'pointermove',x+220,y);
        fire(c,'pointerup',x+220,y);
        setTimeout(function(){
          var b = document.getElementById('lbBody');
          b.scrollLeft = 0;
          document.title='SHOT3_READY';
        }, 500);
      }, 600);
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
build('__shot3.html', shot3);
