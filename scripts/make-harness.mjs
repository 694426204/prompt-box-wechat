/* 生成端到端验证页：
   1) __harness.html —— 在 app.js 之前注入测试数据，验证完整应用链路
   2) __mdtest.html —— 直接调用 MD.render，验证引擎在真实浏览器中的输出
   3) __zoomin.html —— 放大版气泡，用于视觉检查表格横线
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const TB = [
  '| 功能 | 说明 | 对齐 |',
  '| :--- | :---: | ---: |',
  '| 置顶 | 单条置顶 | 左 |',
  '| 收藏 | 永久收藏 | 中 |',
  '',
  '普通段落。',
  '',
  '| 无首尾竖线 | 第二列 |',
  '| --- | --- |',
  '| 甲 | 乙 |'
].join('\n');

const WIDE = [
  '| 编号 | 功能名称 | 说明 | 参数 | 默认值 | 备注 | 状态 | 负责人 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '| 001 | 置顶消息 | 单条置顶 | id | - | 长文本说明内容用于测试换行 | 启用 | 张三 |',
  '| 002 | 收藏消息 | 永久收藏 | id | 24h | 说明 | 启用 | 李四 |'
].join('\n');

const state = {
  sessions: [{ id: 's1', name: '表格测试', icon: '📊' }],
  messages: [
    { id: 'mt1', sessionId: 's1', side: 'them', title: '表格消息', content: TB, fmt: 'md', createdAt: '2026-11-06T10:00:00+08:00' },
    { id: 'mt2', sessionId: 's1', side: 'me', title: '表格消息2', content: TB, fmt: 'md', createdAt: '2026-11-06T10:01:00+08:00' },
    { id: 'mt3', sessionId: 's1', side: 'them', title: '对齐与行内标记', content: '| 语法 | 写法 | 渲染效果 |\n| :--- | :--- | ---: |\n| 粗体 | `**文字**` | **加粗** |\n| 行内代码 | 反引号 | `code` |\n| 链接 | 方括号加圆括号 | [文字](https://example.com) |', fmt: 'md', createdAt: '2026-11-06T10:02:00+08:00' },
    { id: 'mt4', sessionId: 's1', side: 'me', title: '宽表', content: WIDE, fmt: 'md', createdAt: '2026-11-06T10:03:00+08:00' }
  ],
  pins: [], favs: {}, currentSessionId: 's1'
};

/* ---------- 1) 应用链路 harness ---------- */
// 注意：JSON.stringify(state) 的结果本身就是合法的 JS 对象字面量，
// 直接嵌入后在运行时再 JSON.stringify 一次即可 —— 若在此处多套一层
// JSON.stringify，换行会变成字面量 \n 而非真实换行。
// 另外必须把 < 转成 <，否则测试数据里的 </script> 会提前闭合脚本标签。
const stateLiteral = JSON.stringify(state).replace(/</g, '\\u003c');
const seed = `<script>
(function(){
  try {
    localStorage.setItem('prompt-box-wechat-v1', JSON.stringify(${stateLiteral}));
    window.__seedOk = 'YES';
  } catch (e) {
    window.__seedOk = 'ERR:' + e.message;
  }
})();
</script>
`;

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
html = html.replace(/(<script src="assets\/app\.[a-f0-9]+\.js"><\/script>)/, seed + '$1');
// 诊断探针：在页面底部显示 localStorage 实际写入情况
html = html.replace('</body>', '<div id="__diag"></div><script>setTimeout(function(){var d=document.getElementById("__diag");var out=[];var rows=document.querySelectorAll("#msgList .msg-row");for(var i=0;i<rows.length;i++){var b=rows[i].querySelector(".bubble");var wrap=rows[i].querySelector(".md-table-wrap");var r=b.getBoundingClientRect();out.push("["+i+(rows[i].className.indexOf("mine")>=0?"M":"T")+" bw="+Math.round(r.width)+" right="+Math.round(r.right)+" wrap="+(wrap?Math.round(wrap.getBoundingClientRect().width):-1)+" table="+(wrap?Math.round(wrap.querySelector("table").getBoundingClientRect().width):-1)+" scroll="+(wrap?(wrap.scrollWidth>wrap.clientWidth):-1)+"]");}d.textContent="SEEDOK="+window.__seedOk+" LS_LEN="+(localStorage.getItem("prompt-box-wechat-v1")||"").length+" docW="+document.documentElement.scrollWidth+" winW="+window.innerWidth+" "+out.join(" ");},600);</script></body>');
if (!html.includes('prompt-box-wechat-v1')) {
  console.error('[harness] 注入失败：未找到 app.js 引用');
  process.exit(1);
}
writeFileSync(join(DIST, '__harness.html'), html, 'utf8');
console.log('[harness] dist/__harness.html 已生成');

/* ---------- 2) 引擎直测页 ---------- */
const cssHref = (html.match(/href="(assets\/style\.[a-f0-9]+\.css)"/) || [])[1] || 'assets/style.css';
const mdHref = (html.match(/src="(assets\/markdown\.[a-f0-9]+\.js)"/) || [])[1] || 'assets/markdown.js';

const mdTest = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>mdtest</title>
<link rel="stylesheet" href="${cssHref}">
</head><body>
<div class="app"><div class="chat"><div class="msg-scroll">
<div id="them" class="msg-row"><div class="avatar">✦</div><div class="msg-col"><div class="bubble"><div class="md" id="a"></div></div></div></div>
<div id="mine" class="msg-row mine"><div class="avatar">我</div><div class="msg-col"><div class="bubble"><div class="md" id="b"></div></div></div></div>
<div class="msg-row"><div class="avatar">✦</div><div class="msg-col"><div class="bubble"><div class="md" id="c"></div></div></div></div>
</div></div></div>
<div id="probe"></div>
<script src="${mdHref}"></script>
<script>
var TB = ${JSON.stringify(TB)};
var XSS = '| a | b |\\n| --- | --- |\\n| \\u003cscript>alert(1)\\u003c/script> | **粗** \`code\` [链接](https://example.com) |';
document.getElementById('a').innerHTML = MD.render(TB);
document.getElementById('b').innerHTML = MD.render(TB);
document.getElementById('c').innerHTML = MD.render(XSS);
document.getElementById('probe').textContent =
  'DETECT=' + MD.detect(TB) +
  ' TH=' + document.querySelectorAll('#a th').length +
  ' TD=' + document.querySelectorAll('#a td').length +
  ' TABLE=' + document.querySelectorAll('#a table.md-table').length +
  ' SCRIPT_EL=' + document.querySelectorAll('#a script').length +
  ' STRONG=' + document.querySelectorAll('#c strong').length +
  ' CODE=' + document.querySelectorAll('#c code').length +
  ' LINK=' + document.querySelectorAll('#c a').length +
  ' SCRIPT_EL_C=' + document.querySelectorAll('#c script').length +
  ' AL_C=' + document.querySelectorAll('#a .al-center').length +
  ' AL_R=' + document.querySelectorAll('#a .al-right').length +
  ' AL_L=' + document.querySelectorAll('#a .al-left').length +
  ' PIPE_TEXT=' + (document.getElementById('a').textContent.indexOf('|') >= 0) +
  ' WRAP=' + document.querySelectorAll('#a .md-table-wrap').length;
</script>
</body></html>
`;
writeFileSync(join(DIST, '__mdtest.html'), mdTest, 'utf8');
console.log('[harness] dist/__mdtest.html 已生成');

/* ---------- 3) 放大视觉检查页 ---------- */
const zoom = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="day"><head><meta charset="UTF-8"><title>zoom</title>
<link rel="stylesheet" href="${cssHref}">
<style>body{background:#f5f5f5;padding:24px;}
.box{background:#fff;border-radius:8px;padding:16px;margin-bottom:16px;max-width:520px;}
.box h3{margin:0 0 10px;font-size:14px;color:#888;}
.zoom{zoom:1.8;}</style>
</head><body>
<div class="box"><h3>自己（绿底）气泡内</h3><div class="msg-row mine zoom"><div class="avatar">我</div><div class="msg-col"><div class="bubble"><div class="md" id="b"></div></div></div></div></div>
<div class="box"><h3>对方（白底）气泡内</h3><div class="msg-row zoom"><div class="avatar">✦</div><div class="msg-col"><div class="bubble"><div class="md" id="a"></div></div></div></div></div>
<script src="${mdHref}"></script>
<script>
var TB = ${JSON.stringify(TB)};
document.getElementById('a').innerHTML = MD.render(TB);
document.getElementById('b').innerHTML = MD.render(TB);
</script>
</body></html>
`;
writeFileSync(join(DIST, '__zoomin.html'), zoom, 'utf8');
console.log('[harness] dist/__zoomin.html 已生成');

/* ---------- 4) 五主题对照页 ---------- */
const THEMES = ['day', 'dark', 'eye', 'night', 'wood'];
const themeBoxes = THEMES.map(function (t) {
  return '<div class="tbox" data-theme="' + t + '"><h3>' + t + '</h3>' +
    '<div class="msg-row mine"><div class="avatar">我</div><div class="msg-col"><div class="bubble"><div class="md" id="m-' + t + '"></div></div></div></div>' +
    '<div class="msg-row"><div class="avatar">✦</div><div class="msg-col"><div class="bubble"><div class="md" id="t-' + t + '"></div></div></div></div>' +
    '</div>';
}).join('\n');

// 各主题气泡的填充脚本（在模板外拼好，避免模板表达式里嵌套引号）
const renderThemeCells = THEMES.map(function (t) {
  return "document.getElementById('m-" + t + "').innerHTML = MD.render(TB);\n" +
    "document.getElementById('t-" + t + "').innerHTML = MD.render(TB);";
}).join('\n');

const themes = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="day"><head><meta charset="UTF-8"><title>themes</title>
<link rel="stylesheet" href="${cssHref}">
<style>body{background:#f0f0f0;padding:16px;margin:0;}
.tbox{background:#fff;border-radius:8px;padding:12px;margin-bottom:16px;}
.tbox h3{margin:0 0 8px;font-size:13px;color:#888;}</style>
</head><body>
${themeBoxes}
<script src="${mdHref}"></script>
<script>
var TB = ${JSON.stringify(TB)};
${renderThemeCells}
</script>
</body></html>
`;
writeFileSync(join(DIST, '__themes.html'), themes, 'utf8');
console.log('[harness] dist/__themes.html 已生成');

/* ---------- 5) 主题横线对比度探针（数值化验证） ---------- */
const themeCheck = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="day"><head><meta charset="UTF-8"><title>themecheck</title>
<link rel="stylesheet" href="${cssHref}">
</head><body>
${themeBoxes}
<div id="probe"></div>
<script src="${mdHref}"></script>
<script>
var TB = ${JSON.stringify(TB)};
${renderThemeCells}

function parseRGB(s){
  var m = /rgba?\\(([^)]+)\\)/.exec(s || '');
  if (!m) return null;
  var p = m[1].split(',').map(function(x){return parseFloat(x);});
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
function lum(c){
  if (!c) return 0;
  function f(v){ v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function over(fg, bg){
  if (!fg || fg.a >= 1) return fg;
  return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
}
function ratio(fg, bg){
  var f = over(fg, bg), b = over(bg, fg);
  var l1 = lum(f), l2 = lum(b);
  if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
  return (l1 + 0.05) / (l2 + 0.05);
}
var lines = [];
var THEMES = ${JSON.stringify(THEMES)};
try {
  for (var i = 0; i < THEMES.length; i++) {
    lines.push(THEMES[i] + ' ' + check(THEMES[i]));
  }
} catch (e) {
  lines.push('ERROR:' + e.message);
}

function check(t){
  var mdMine = document.getElementById('m-' + t);
  var mdYou = document.getElementById('t-' + t);
  var bubbleM = mdMine.closest('.bubble');
  var bubbleY = mdYou.closest('.bubble');
  var mine = mdMine.querySelector('.md-table th');
  var you  = mdYou.querySelector('.md-table th');
  var mBg = getComputedStyle(bubbleM).backgroundColor;
  var yBg = getComputedStyle(bubbleY).backgroundColor;
  var mb = parseRGB(mBg), yb = parseRGB(yBg);
  var mLine = parseRGB(getComputedStyle(mine).borderBottomColor);
  var yLine = parseRGB(getComputedStyle(you).borderBottomColor);
  var rM = ratio(mLine, mb), rY = ratio(yLine, yb);
  return 'mine_line=' + getComputedStyle(mine).borderBottomColor +
    ' mine_bg=' + mBg + ' mine_ratio=' + rM.toFixed(2) +
    ' | you_line=' + getComputedStyle(you).borderBottomColor +
    ' you_bg=' + yBg + ' you_ratio=' + rY.toFixed(2) +
    ' | th_w=' + getComputedStyle(mine).fontWeight +
    ' td_left_border=' + getComputedStyle(mdMine.querySelector('.md-table td')).borderLeftWidth +
    ' wrap_overflow=' + getComputedStyle(mdMine.querySelector('.md-table-wrap')).overflowX;
}
document.getElementById('probe').textContent = lines.join(' || ');
</script>
</body></html>
`;
writeFileSync(join(DIST, '__themecheck.html'), themeCheck, 'utf8');
console.log('[harness] dist/__themecheck.html 已生成');

/* ---------- 6) 宽表窄屏页（验证横向滚动、气泡不撑破） ---------- */
const wide = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="day"><head><meta charset="UTF-8"><title>wide</title>
<link rel="stylesheet" href="${cssHref}">
<style>body{margin:0;padding:12px;}</style>
</head><body>
<div class="app"><div class="chat"><div class="msg-scroll">
<div class="msg-row mine"><div class="avatar">我</div><div class="msg-col"><div class="bubble"><div class="md" id="w1"></div></div></div></div>
<div class="msg-row"><div class="avatar">✦</div><div class="msg-col"><div class="bubble"><div class="md" id="w2"></div></div></div></div>
</div></div></div>
<div id="probe2"></div>
<script src="${mdHref}"></script>
<script>
var WIDE = ${JSON.stringify(WIDE)};
document.getElementById('w1').innerHTML = MD.render(WIDE);
document.getElementById('w2').innerHTML = MD.render(WIDE);
var b = document.getElementById('w1').closest('.bubble');
var wrap = document.getElementById('w1').querySelector('.md-table-wrap');
document.getElementById('probe2').textContent =
  'BUBBLE_W=' + Math.round(b.getBoundingClientRect().width) +
  ' BUBBLE_RIGHT=' + Math.round(b.getBoundingClientRect().right) +
  ' WRAP_W=' + Math.round(wrap.getBoundingClientRect().width) +
  ' TABLE_W=' + Math.round(wrap.querySelector('table').getBoundingClientRect().width) +
  ' SCROLL=' + (wrap.scrollWidth > wrap.clientWidth) +
  ' OVERFLOW_X=' + getComputedStyle(wrap).overflowX +
  ' TH=' + wrap.querySelectorAll('th').length +
  ' TD=' + wrap.querySelectorAll('td').length +
  ' | docScrollW=' + document.documentElement.scrollWidth +
  ' winW=' + window.innerWidth +
  ' appW=' + Math.round(document.querySelector('.app').getBoundingClientRect().width) +
  ' chatW=' + Math.round(document.querySelector('.chat').getBoundingClientRect().width) +
  ' scrollW=' + Math.round(document.querySelector('.msg-scroll').getBoundingClientRect().width) +
  ' colW=' + Math.round(document.querySelector('.msg-col').getBoundingClientRect().width) +
  ' colMax=' + getComputedStyle(document.querySelector('.msg-col')).maxWidth;
</script>
</body></html>
`;
writeFileSync(join(DIST, '__wide.html'), wide, 'utf8');
console.log('[harness] dist/__wide.html 已生成');
