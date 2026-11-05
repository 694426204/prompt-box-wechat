/**
 * Markdown 引擎回归测试（零依赖）
 * 运行：npm test
 *
 * 覆盖：表格识别 / 表格渲染 / 对齐 / 转义 / XSS / 边界，
 * 以及代码块、标题、引用、列表、分割线等既有语法的回归。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// markdown.js 是 IIFE，挂到 window 上；这里造一个最小 window 宿主
const src = readFileSync(join(ROOT, 'assets', 'markdown.js'), 'utf8');
const win = {};
new Function('window', src)(win);
const MD = win.MD;

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(name + (extra ? '  ->  ' + extra : ''));
  }
}

function eq(name, actual, expected) {
  ok(name, actual === expected, 'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected));
}

function has(name, haystack, needle) {
  ok(name, String(haystack).indexOf(needle) >= 0,
    'missing ' + JSON.stringify(needle) + ' in ' + JSON.stringify(String(haystack).slice(0, 300)));
}

function hasNot(name, haystack, needle) {
  ok(name, String(haystack).indexOf(needle) < 0,
    'unexpected ' + JSON.stringify(needle) + ' in ' + JSON.stringify(String(haystack).slice(0, 300)));
}

function countOf(haystack, needle) {
  return String(haystack).split(needle).length - 1;
}

/** 统计 <th> 标签数（排除 <thead>） */
function countTh(haystack) {
  return (String(haystack).match(/<th[ >]/g) || []).length;
}

/** 统计 <td> 标签数 */
function countTd(haystack) {
  return (String(haystack).match(/<td[ >]/g) || []).length;
}

/* =========================================================
   一、表格识别
   ========================================================= */
const T_PIPE = '| 功能 | 说明 |\n| --- | --- |\n| 置顶 | 单条置顶 |\n| 收藏 | 永久收藏 |';
const T_BARE = '功能 | 说明\n--- | ---\n置顶 | 单条置顶\n收藏 | 永久收藏';

eq('表格-无首尾竖线判 md', MD.detect(T_BARE), 'md');
eq('表格-有首尾竖线判 md', MD.detect(T_PIPE), 'md');
eq('表格-与正文混排判 md', MD.detect('下面是说明：\n\n' + T_BARE), 'md');
eq('单行竖线不判 md', MD.detect('| a | b |'), 'txt');
eq('纯中文不判 md', MD.detect('普通一段中文，不含任何 Markdown 特征'), 'txt');
eq('detectLoose-单行竖线判 md', MD.detectLoose('| a | b |'), 'md');
eq('detectLoose-空串', MD.detectLoose(''), 'txt');
eq('detect-空串', MD.detect(''), 'txt');
eq('detect-null', MD.detect(null), 'txt');

// 代码块内的表格不应被识别为表格（但代码围栏本身已足以判 md）
eq('代码块内的表格不算表格特征', MD.detect('```\na | b\n--- | ---\n```\n'), 'md');

/* =========================================================
   二、表格渲染
   ========================================================= */
const rPipe = MD.render(T_PIPE);
has('渲染-含 table 标签', rPipe, '<table class="md-table">');
has('渲染-含 thead', rPipe, '<thead>');
has('渲染-含 tbody', rPipe, '<tbody>');
has('渲染-含 wrap 层', rPipe, '<div class="md-table-wrap">');
eq('渲染-th 数量', countTh(rPipe), 2);
eq('渲染-td 数量', countTd(rPipe), 4);
has('渲染-表头内容', rPipe, '<th>功能</th>');
has('渲染-数据内容', rPipe, '<td>置顶</td>');
hasNot('渲染-不残留竖线', rPipe, '|');

const rBare = MD.render(T_BARE);
eq('渲染-无首尾竖线同样成表', countTh(rBare), 2);
eq('渲染-无首尾竖线 td 数量', countTd(rBare), 4);

// 无数据行的表格
const rEmpty = MD.render('| a | b |\n| --- | --- |');
eq('渲染-无数据行 td 数量', countTd(rEmpty), 0);
eq('渲染-无数据行 th 数量', countTh(rEmpty), 2);

/* =========================================================
   三、对齐
   ========================================================= */
const rAlign = MD.render('| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| a | b | c |');
has('对齐-左对齐', rAlign, '<th class="al-left">左</th>');
has('对齐-居中', rAlign, '<th class="al-center">中</th>');
has('对齐-右对齐', rAlign, '<th class="al-right">右</th>');
has('对齐-数据格居中', rAlign, '<td class="al-center">b</td>');
has('对齐-数据格右对齐', rAlign, '<td class="al-right">c</td>');
hasNot('对齐-默认无 class', rAlign, '<th class="al-left">a</th>');

/* =========================================================
   四、转义与 XSS
   ========================================================= */
const rEsc = MD.render('| a | b |\n| --- | --- |\n| \\| 竖线 | <script>alert(1)</script> |');
has('转义-竖线还原为字面量', rEsc, '<td>| 竖线</td>');
has('转义-script 被转义', rEsc, '&lt;script&gt;alert(1)&lt;/script&gt;');
hasNot('转义-无裸 script 标签', rEsc, '<script>');
hasNot('转义-无裸 img 标签', MD.render('| a |\n| --- |\n| <img src=x onerror=alert(1)> |'), '<img');

// 单元格内的行内 Markdown 生效
const rInline = MD.render('| a | b |\n| --- | --- |\n| **粗** | `代码` |');
has('单元格-粗体', rInline, '<td><strong>粗</strong></td>');
has('单元格-行内代码', rInline, '<td><code>代码</code></td>');

const rLink = MD.render('| a |\n| --- |\n| [链接](https://example.com) |');
has('单元格-链接', rLink, '<a href="https://example.com"');

// 非 http 协议的链接降级为纯文本
const rBadLink = MD.render('| a |\n| --- |\n| [x](javascript:alert(1)) |');
hasNot('单元格-危险协议被拒', rBadLink, 'javascript:');

/* =========================================================
   五、边界
   ========================================================= */
// 空行中断表格
const rBlank = MD.render('| a | b |\n| --- | --- |\n| 1 | 2 |\n\n后面是正文');
eq('边界-空行中断 td 数量', countTd(rBlank), 2);
has('边界-空行后正文独立成段', rBlank, '<p>后面是正文</p>');

// 表格前的正文不被吞并
const rBefore = MD.render('这是一段引言\n\n| a | b |\n| --- | --- |\n| 1 | 2 |');
has('边界-表格前正文独立成段', rBefore, '<p>这是一段引言</p>');
eq('边界-表格前正文 td 数量', countTd(rBefore), 2);

// 数据行列数不足 -> 补空
const rShort = MD.render('| a | b | c |\n| --- | --- | --- |\n| 1 |');
eq('边界-缺列补空 td 数量', countTd(rShort), 3);
has('边界-缺列补空内容', rShort, '<td></td>');

// 数据行列数超出 -> 截断
const rLong = MD.render('| a | b |\n| --- | --- |\n| 1 | 2 | 3 |');
eq('边界-多列截断 td 数量', countTd(rLong), 2);
has('边界-多列截断内容', rLong, '<td>1</td>');
hasNot('边界-多列截断丢弃第三列', rLong, '<td>3</td>');

// 分隔行列数与表头不等 -> 不成表
const rMismatch = MD.render('| a | b |\n| --- |\n| 1 | 2 |');
hasNot('边界-列数不匹配不成表', rMismatch, '<table');
has('边界-列数不匹配按段落处理', rMismatch, '<p>');

// 单列不成表
hasNot('边界-单列不成表', MD.render('| a |\n| --- |\n| 1 |'), '<table');

// 标题 / 代码围栏终止表格
const rHead = MD.render('| a | b |\n| --- | --- |\n| 1 | 2 |\n# 标题');
eq('边界-标题终止 td 数量', countTd(rHead), 2);
has('边界-标题独立渲染', rHead, '<h1>标题</h1>');

const rFence = MD.render('| a | b |\n| --- | --- |\n| 1 | 2 |\n```\ncode\n```');
eq('边界-代码围栏终止 td 数量', countTd(rFence), 2);
has('边界-代码块独立渲染', rFence, '<pre><code>code</code></pre>');

// 表格出现在段落中间时，段落被截断
const rMid = MD.render('引言文字\n| a | b |\n| --- | --- |\n| 1 | 2 |');
has('边界-表格中断段落', rMid, '<table');
hasNot('边界-表格中断后引言不吞表', rMid, '<p>引言文字<br>');

/* =========================================================
   六、strip（摘要）
   ========================================================= */
const s1 = MD.strip(T_PIPE);
hasNot('摘要-不含竖线', s1, '|');
has('摘要-含表头内容', s1, '功能');
has('摘要-含数据内容', s1, '置顶');
hasNot('摘要-不含分隔行', s1, '---');

const s2 = MD.strip(T_BARE);
hasNot('摘要-无首尾竖线也不含竖线', s2, '|');
has('摘要-无首尾竖线含内容', s2, '功能');

/* =========================================================
   七、既有语法回归
   ========================================================= */
const rCode = MD.render('```js\nconst a = 1;\n```');
has('回归-代码块', rCode, '<pre><code>const a = 1;</code></pre>');
hasNot('回归-代码块内不解析', rCode, '<strong>');

const rTitle = MD.render('# 一级\n## 二级');
has('回归-h1', rTitle, '<h1>一级</h1>');
has('回归-h2', rTitle, '<h2>二级</h2>');

const rQuote = MD.render('> 引用一句');
has('回归-引用', rQuote, '<blockquote>引用一句</blockquote>');

const rList = MD.render('- 甲\n- 乙');
has('回归-无序列表', rList, '<ul><li>甲</li><li>乙</li></ul>');

const rOl = MD.render('1. 第一\n2. 第二');
has('回归-有序列表', rOl, '<ol><li>第一</li><li>第二</li></ol>');

const rHr = MD.render('---');
has('回归-分割线', rHr, '<hr>');

const rBold = MD.render('**加粗**');
has('回归-粗体', rBold, '<strong>加粗</strong>');

const rEm = MD.render('*斜体*');
has('回归-斜体', rEm, '<em>斜体</em>');

const rDel = MD.render('~~删除~~');
has('回归-删除线', rDel, '<del>删除</del>');

const rCodeIn = MD.render('行内 `code` 混排');
has('回归-行内代码', rCodeIn, '<code>code</code>');

const rLinkMd = MD.render('[文字](https://a.com)');
has('回归-链接', rLinkMd, '<a href="https://a.com"');
has('回归-链接新窗口', rLinkMd, 'target="_blank"');

const rImg = MD.render('![alt](https://a.com/x.png)');
has('回归-图片降级为加粗', rImg, '<strong>alt</strong>');
hasNot('回归-图片不产生 img 标签', rImg, '<img');

// firstHeading
eq('回归-firstHeading 命中', MD.firstHeading('# 标题\n正文'), '标题');
eq('回归-firstHeading 首行非标题', MD.firstHeading('正文\n# 标题'), null);
eq('回归-firstHeading 无标题', MD.firstHeading('纯正文'), null);

// isMdMsg
eq('回归-isMdMsg fmt=md', MD.isMdMsg({ fmt: 'md', content: 'x' }), true);
eq('回归-isMdMsg fmt=txt', MD.isMdMsg({ fmt: 'txt', content: 'x' }), false);
eq('回归-isMdMsg 无 fmt 惰性检测', MD.isMdMsg({ content: '**x**' }), true);
eq('回归-isMdMsg 无 fmt 纯文本', MD.isMdMsg({ content: '纯文本' }), false);

// strip 既有行为
eq('回归-strip 标题', MD.strip('# 标题'), '标题');
eq('回归-strip 粗体', MD.strip('**加粗**'), '加粗');
eq('回归-strip 链接', MD.strip('[文字](https://a.com)'), '文字');
eq('回归-strip 引用', MD.strip('> 引用'), '引用');
eq('回归-strip 列表', MD.strip('- 项目'), '项目');

/* =========================================================
   结果
   ========================================================= */
console.log('');
console.log('  ============================================');
console.log('     Markdown 引擎回归测试');
console.log('  ============================================');
console.log('');
if (fail === 0) {
  console.log('   ALL PASS  ' + pass + ' 项断言');
  console.log('');
  process.exit(0);
} else {
  console.log('   FAIL ' + fail + ' / PASS ' + pass);
  console.log('');
  failures.forEach(f => console.log('   x ' + f));
  console.log('');
  process.exit(1);
}
