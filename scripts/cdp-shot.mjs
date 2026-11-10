/* CDP 真实时间截图器
   headless --screenshot 配合 --virtual-time-budget 时，图片解码回调不推进，
   图片位会截成空白；因此改用 CDP Page.captureScreenshot 按真实时间拍摄。
   用法：node scripts/cdp-shot.mjs <url> <out.png> [--w=1440] [--h=900] [--mobile] [--wait=SHOT_READY] [--delay=300]
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function arg(name, def) {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : def;
}
const has = name => process.argv.includes('--' + name);

const url = process.argv[2];
const outFile = process.argv[3];
if (!url || !outFile) { console.error('用法: node scripts/cdp-shot.mjs <url> <out.png> [--w=] [--h=] [--mobile] [--wait=] [--delay=]'); process.exit(2); }

const VW = parseInt(arg('w', '1440'), 10);
const VH = parseInt(arg('h', '900'), 10);
const MOBILE = has('mobile');
const WAIT_TITLE = arg('wait', 'SHOT');
const DELAY = parseInt(arg('delay', '400'), 10);
const TIMEOUT = parseInt(arg('timeout', '40000'), 10);

const ud = mkdtempSync(join(tmpdir(), 'cr_shot_'));
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
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 连接失败')); });

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
    setTimeout(() => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); reject(new Error('等待事件超时 ' + method)); }, timeout);
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || '页面脚本异常');
  return r.result.value;
}

// 等待就绪标题
const deadline = Date.now() + TIMEOUT;
let title = '';
while (Date.now() < deadline) {
  title = await evaluate('document.title');
  if (title.indexOf(WAIT_TITLE) >= 0) break;
  await new Promise(r => setTimeout(r, 300));
}
if (title.indexOf(WAIT_TITLE) < 0) {
  console.error('未等到就绪标题，当前 title=' + title);
}

if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY));

const SCROLL_SEL = arg('scroll', '');
if (SCROLL_SEL) {
  // 图表/图示为异步渲染，页面高度会变化，因此分两次滚动：先等布局稳定再定位
  await new Promise(r => setTimeout(r, 500));
  await evaluate(`(function(){var e=document.querySelector(${JSON.stringify(SCROLL_SEL)});if(e)e.scrollIntoView({block:'center'});})()`);
  await new Promise(r => setTimeout(r, 700));
  await evaluate(`(function(){var e=document.querySelector(${JSON.stringify(SCROLL_SEL)});if(e)e.scrollIntoView({block:'center'});})()`);
  await new Promise(r => setTimeout(r, 500));
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
console.log(outFile + ' 已保存 (title=' + title + ')');

ws.close();
child.kill();
try { rmSync(ud, { recursive: true, force: true }); } catch (e) {}
process.exit(0);
