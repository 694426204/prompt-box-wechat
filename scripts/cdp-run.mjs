/* CDP 真实时间驱动的探针运行器
   解决 headless --virtual-time-budget 的两个问题：
     1) 虚拟时钟下图片解码回调（createImageBitmap / Image.onload）永不触发
     2) --window-size 无法精确设定视口，导致宽度类断言误报
   用法：node scripts/cdp-run.mjs <url> [--out=selector] [--w=1440] [--h=900] [--mobile] [--timeout=30000]
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : def;
}
const has = name => process.argv.includes('--' + name);

const url = process.argv[2];
if (!url) { console.error('缺少 url'); process.exit(2); }

const OUT_SEL = arg('out', '#probeOut');
const VW = parseInt(arg('w', '1440'), 10);
const VH = parseInt(arg('h', '900'), 10);
const MOBILE = has('mobile');
const TIMEOUT = parseInt(arg('timeout', '40000'), 10);

const ud = mkdtempSync(join(tmpdir(), 'cr_cdp_'));
const child = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--user-data-dir=' + ud,
  '--remote-debugging-port=0',
  'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let stderrBuf = '';
const wsUrl = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('等待 DevTools 端点超时')), 20000);
  child.stderr.on('data', d => {
    stderrBuf += d.toString();
    const m = stderrBuf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  child.on('exit', c => { clearTimeout(t); reject(new Error('chrome 退出 ' + c)); });
});

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws 连接失败')); });

let msgId = 0;
const pending = new Map();
const listeners = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(m.error.message)) : resolve(m.result);
  } else if (m.method) {
    listeners.forEach(fn => fn(m));
  }
};
function send(method, params, sessionId) {
  const id = ++msgId;
  const msg = { id, method, params: params || {} };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function once(method, sessionId, timeout) {
  return new Promise((resolve, reject) => {
    const fn = m => {
      if (m.method === method && (!sessionId || m.sessionId === sessionId)) {
        listeners.splice(listeners.indexOf(fn), 1);
        resolve(m.params);
      }
    };
    listeners.push(fn);
    if (timeout) setTimeout(() => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); reject(new Error('等待事件超时 ' + method)); }, timeout);
  });
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', {
  width: VW, height: VH, deviceScaleFactor: MOBILE ? 2 : 1, mobile: MOBILE
}, sessionId);

const loaded = once('Page.loadEventFired', sessionId, 30000);
await send('Page.navigate', { url }, sessionId);
await loaded;

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || '页面脚本异常');
  return r.result.value;
}

// 等待探针页面输出结果
const deadline = Date.now() + TIMEOUT;
let out = '', title = '';
while (Date.now() < deadline) {
  out = await evaluate(`(function(){var e=document.querySelector(${JSON.stringify(OUT_SEL)});return e?e.textContent:'';})()`);
  title = await evaluate('document.title');
  if (/PROBE_(PASS|FAIL)/.test(title) || /ERROR/.test(title)) break;
  await new Promise(r => setTimeout(r, 400));
}

console.log('TITLE: ' + title);
console.log('----- PROBE OUTPUT -----');
console.log(out);
console.log('-----------------------');

ws.close();
child.kill();
try { rmSync(ud, { recursive: true, force: true }); } catch (e) {}
process.exit(/PROBE_FAIL|ERROR/.test(title) ? 1 : 0);
