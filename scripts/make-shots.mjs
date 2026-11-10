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
  st.textContent = '.lb-card{transition:none!important}.lb-toc{transition:none!important}.lb-toc-btn{transition:none!important}';
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
  /* 带层级标题的文档消息：用于 TOC 面板截图（正文需足够长，
     否则正文滚到底后章节无法停到顶部，截不出理想效果） */
  var filler = '这一段是正文内容，用于把文档撑到足够长，保证点击目录项后目标章节能够滚动到正文顶部停住，从而完整呈现锚点定位效果。';
  var doc = [
    '# 产品需求文档',
    '这是文档导语段落，用于占位说明整体内容范围与背景动机。' + filler + filler,
    '## 一、背景与目标',
    '说明为什么需要这份文档，以及要解决的核心问题是什么。' + filler + filler,
    '### 1.1 现状梳理',
    '罗列当前实现方式与其中的限制条件。' + filler + filler,
    '### 1.2 目标拆解',
    '把整体目标拆成可以分别交付的子项。' + filler + filler,
    '## 二、方案设计',
    '描述整体技术路线与关键取舍。' + filler + filler,
    '### 2.1 核心流程',
    '按步骤描述主链路。' + filler + filler,
    '#### 2.1.1 边界处理',
    '说明异常分支的兜底策略。' + filler + filler,
    '### 2.2 数据结构',
    '列出主要字段与含义。' + filler + filler,
    '## 三、里程碑',
    '列出分阶段交付计划。' + filler + filler,
    '### 3.1 第一阶段',
    '第一阶段需要完成的内容。' + filler + filler,
    '### 3.2 第二阶段',
    '第二阶段需要完成的内容。' + filler + filler,
    '## 四、风险与对策',
    '列出主要风险点及应对方案。' + filler + filler,
    '### 4.1 技术风险',
    '说明技术层面的不确定因素。' + filler + filler,
    '### 4.2 进度风险',
    '说明排期层面的不确定因素。' + filler + filler,
    '## 五、附录',
    '补充说明与术语表。' + filler + filler,
    '### 5.1 术语表',
    '列出关键缩写与全称。' + filler + filler
  ].join('\\n');
  localStorage.setItem('prompt-box-wechat-v1', JSON.stringify({
    sessions: [{ id: sid, name: '探针会话', icon: '💬' }],
    messages: [
      { id: 'probe-m1', sessionId: sid, title: '速查表', content: table, side: 'you', createdAt: now, fmt: 'md' },
      { id: 'probe-m2', sessionId: sid, title: '短消息', content: '你好', side: 'me', createdAt: now },
      { id: 'probe-m3', sessionId: sid, title: '产品需求文档', content: doc, side: 'you', createdAt: now, fmt: 'md' }
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

/* 打开带标题的文档消息（TOC 场景用） */
const OPEN_DOC_HELPER = `function openDocLightbox(){
  var b = document.querySelector('.bubble[data-id="probe-m3"]');
  if(b) b.click();
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

/* 场景4：TOC 目录面板展开（层级缩进可见 + 卡片左移让位、胶囊按钮原地不动） */
const shot4 = `<script>
${OPEN_DOC_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openDocLightbox();
      setTimeout(function(){
        document.getElementById('lbTocBtn').click();
        setTimeout(function(){ document.title='SHOT4_READY'; }, 500);
      }, 700);
    }, 400);
  });
})();
</script>
`;

/* 场景5：展开目录面板并点击目录项，展示滚动到章节 + 当前项高亮 */
const shot5 = `<script>
${OPEN_DOC_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openDocLightbox();
      setTimeout(function(){
        document.getElementById('lbTocBtn').click();
        setTimeout(function(){
          var items = document.querySelectorAll('#lbTocList .toc-item');
          if (items[5]) items[5].click();
          setTimeout(function(){
            var b = document.getElementById('lbBody');
            var heads = b.querySelectorAll('h1,h2,h3,h4,h5,h6');
            var t = heads[5].getBoundingClientRect();
            var bb = b.getBoundingClientRect();
            /* 落点诊断写进隐藏节点，title 只做就绪标记 */
            var d = document.createElement('div');
            d.id = 'shot5Diag';
            d.style.display = 'none';
            d.textContent = 'off=' + (t.top - bb.top).toFixed(1) +
              ' st=' + b.scrollTop + ' max=' + (b.scrollHeight - b.clientHeight) +
              ' txt=' + heads[5].textContent;
            document.body.appendChild(d);
            document.title = 'SHOT5_READY';
          }, 900);
        }, 500);
      }, 700);
    }, 400);
  });
})();
</script>
`;

/* 场景7：放大态大纲开关特写（闭合态：卡片内侧右缘的竖向胶囊）
   主题由 URL 查询参数 ?theme=dark 指定，便于一次拍齐五套主题 */
const shot7 = `<script>
${OPEN_DOC_HELPER}
(function(){
  var m = /[?&]theme=([a-z]+)/.exec(location.search);
  var th = m ? m[1] : 'day';
  window.addEventListener('load', function(){
    setTimeout(function(){
      document.documentElement.setAttribute('data-theme', th);
      openDocLightbox();
      setTimeout(function(){
        document.title='SHOT7_READY';
      }, 900);
    }, 400);
  });
})();
</script>
`;

/* 场景8：窄屏（≤820px）下 TOC 面板展开，开关收为面板头部左侧的圆角小块
   需以 390x844 视口打开 */
const shot8 = `<script>
${OPEN_DOC_HELPER}
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){
      openDocLightbox();
      setTimeout(function(){
        document.getElementById('lbTocBtn').click();
        setTimeout(function(){ document.title='SHOT8_READY'; }, 500);
      }, 700);
    }, 400);
  });
})();
</script>
`;

/* 场景9：消息气泡内的图片网格（待发送条 + 已发送气泡）
   图片由 canvas 现场生成 → 走真实上传链路（格式校验 + 转 JPG + 入库） */
const shot9 = `<script>
(function(){
  function makePng(w, h){
    return new Promise(function(res){
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#4a6cf7'); g.addColorStop(0.5, '#7b5cf0'); g.addColorStop(1, '#e05fc0');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.22)';
      for (var i = 0; i < 14; i++) {
        c.beginPath();
        c.arc((i * 137) % w, (i * 89) % h, 18 + (i % 5) * 12, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#fff';
      c.font = 'bold 44px "Microsoft YaHei", sans-serif';
      c.textAlign = 'center';
      c.fillText('上传图片示例', w / 2, h / 2 - 8);
      c.font = '26px "Microsoft YaHei", sans-serif';
      c.fillStyle = 'rgba(255,255,255,.88)';
      c.fillText('自动转换为标准 JPG', w / 2, h / 2 + 44);
      cv.toBlob(function(b){ res(new File([b], '示例图.png', { type: 'image/png' })); }, 'image/png');
    });
  }
  function paste(files){
    var dt = new DataTransfer();
    for (var i=0;i<files.length;i++) dt.items.add(files[i]);
    document.getElementById('composerInput').dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }
  window.addEventListener('load', function(){
    setTimeout(function(){
      Promise.all([makePng(900, 620), makePng(620, 620)]).then(function(files){
        paste(files);
        setTimeout(function(){
          var ta = document.getElementById('composerInput');
          ta.value = '这是带图片的消息，图片已统一转换为标准 JPG 格式。';
          document.getElementById('btnSend').click();
          setTimeout(function(){
            var list = document.getElementById('msgList');
            if (list) list.scrollTop = list.scrollHeight;
            setTimeout(function(){ document.title = 'SHOT9_READY'; }, 500);
          }, 700);
        }, 900);
      });
    }, 500);
  });
})();
</script>
`;

/* 场景10：点击气泡内图片 → 全屏预览层 */
const shot10 = `<script>
(function(){
  function makePng(w, h){
    return new Promise(function(res){
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0f8f6f'); g.addColorStop(0.5, '#2fb0a8'); g.addColorStop(1, '#7fd6b0');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.25)';
      for (var i = 0; i < 10; i++) {
        c.beginPath();
        c.moveTo((i * 121) % w, 0);
        c.lineTo((i * 121) % w + 160, h);
        c.lineTo((i * 121) % w + 80, h);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#fff';
      c.font = 'bold 46px "Microsoft YaHei", sans-serif';
      c.textAlign = 'center';
      c.fillText('全屏预览', w / 2, h / 2);
      cv.toBlob(function(b){ res(new File([b], '预览图.png', { type: 'image/png' })); }, 'image/png');
    });
  }
  window.addEventListener('load', function(){
    setTimeout(function(){
      makePng(1000, 700).then(function(f){
        var dt = new DataTransfer();
        dt.items.add(f);
        document.getElementById('composerInput').dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        setTimeout(function(){
          document.getElementById('btnSend').click();
          setTimeout(function(){
            var list = document.getElementById('msgList');
            if (list) list.scrollTop = list.scrollHeight;
            setTimeout(function(){
              var img = document.querySelector('.msg-row.mine .b-imgs img');
              if (img) img.click();
              setTimeout(function(){ document.title = 'SHOT10_READY'; }, 600);
            }, 600);
          }, 700);
        }, 900);
      });
    }, 500);
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
build('__shot4.html', shot4);
build('__shot5.html', shot5);
build('__shot7.html', shot7);
build('__shot8.html', shot8);
build('__shot9.html', shot9);
build('__shot10.html', shot10);
