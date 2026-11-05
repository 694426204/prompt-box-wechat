/**
 * 零依赖本地静态服务器：替代 npx serve
 *
 * 只用 Node 内置模块，全程离线可用，不产生任何外部网络请求。
 * 用法：
 *   node scripts/serve.mjs [--port 8899] [--dir dist] [--host 127.0.0.1] [--open]
 */
import { createServer, get as httpGet } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const http = { get: httpGet };

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/* ---------------- 参数解析 ---------------- */
function parseArgs(argv) {
  const out = { port: 8899, dir: 'dist', host: '127.0.0.1', open: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--port' || a === '-p') out.port = Number(next());
    else if (a === '--dir' || a === '-d') out.dir = next();
    else if (a === '--host' || a === '-h') out.host = next();
    else if (a === '--open') out.open = true;
    else if (a.startsWith('--port=')) out.port = Number(a.slice(7));
    else if (a.startsWith('--dir=')) out.dir = a.slice(6);
    else if (a.startsWith('--host=')) out.host = a.slice(7);
  }
  if (!Number.isInteger(out.port) || out.port < 1 || out.port > 65535) {
    console.error('[serve] 端口无效：' + out.port + '（应为 1-65535）');
    process.exit(1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const BASE = resolve(ROOT, args.dir);

/* ---------------- MIME ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};
const mimeOf = p => MIME[extname(p).toLowerCase()] || 'application/octet-stream';

/* ---------------- 路径解析（防目录穿越） ---------------- */
function resolveSafe(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch (e) {
    return null; // 非法百分号编码
  }
  if (p.indexOf('\0') !== -1) return null;           // 空字节
  p = p.replace(/\\/g, '/');                          // Windows 分隔符归一
  const full = resolve(BASE, '.' + (p.startsWith('/') ? p : '/' + p));
  if (full !== BASE && !full.startsWith(BASE + sep)) return null; // 越界
  return full;
}

/* ---------------- 响应助手 ---------------- */
function send(res, status, body, type, headOnly) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  if (headOnly) res.end();
  else res.end(body);
}

async function sendFile(res, filePath, status, headOnly) {
  const body = await readFile(filePath);
  send(res, status, body, mimeOf(filePath), headOnly);
}

async function sendIndex(res, status, headOnly) {
  await sendFile(res, join(BASE, 'index.html'), status, headOnly);
}

/* ---------------- 请求处理 ---------------- */
async function handle(req, res) {
  const headOnly = req.method === 'HEAD';
  if (req.method !== 'GET' && !headOnly) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const target = resolveSafe(req.url || '/');
  if (!target) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  let st = null;
  try {
    st = await stat(target);
  } catch (e) {
    st = null;
  }

  // 命中文件
  if (st && st.isFile()) {
    await sendFile(res, target, 200, headOnly);
    return;
  }

  // 命中目录 → 目录内 index.html
  if (st && st.isDirectory()) {
    const idx = join(target, 'index.html');
    try {
      await stat(idx);
      await sendFile(res, idx, 200, headOnly);
      return;
    } catch (e) { /* 落到下面的回退 */ }
  }

  // 未命中且无扩展名 → SPA 回退到 index.html
  if (!extname(target)) {
    try {
      await sendIndex(res, 200, headOnly);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
    return;
  }

  // 未命中且有扩展名 → 404.html
  try {
    await sendFile(res, join(BASE, '404.html'), 404, headOnly);
  } catch (e) {
    try {
      await sendIndex(res, 404, headOnly);
    } catch (e2) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }
}

/* ---------------- 端口探测 ----------------
   端口被占用时，先确认占用者是不是「本项目已在运行」。
   是 → 复用它并直接打开浏览器（而不是报错让人一头雾水）；
   否 → 才报错退出。 */
function probe(url) {
  return new Promise(resolve => {
    const req = http.get(url, { timeout: 1500 }, res => {
      let body = '';
      res.on('data', d => { body += d; if (body.length > 200000) res.destroy(); });
      res.on('end', () => resolve({ ok: res.statusCode === 200, body }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function isOurInstance(port) {
  const r = await probe('http://127.0.0.1:' + port + '/');
  if (!r || !r.ok) return false;
  // 本项目的首页一定包含这些标记
  return /id="app"/.test(r.body) && /msgList|composerInput/.test(r.body);
}

/* ---------------- 启动 ---------------- */
async function main() {
  try {
    const st = await stat(BASE);
    if (!st.isDirectory()) throw new Error('not a directory');
  } catch (e) {
    console.error('[serve] 目录不存在：' + BASE);
    console.error('[serve] 请先执行构建：node scripts/build.mjs');
    process.exit(1);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
    });
  });

  server.on('error', async err => {
    if (err.code === 'EADDRINUSE') {
      // 已有实例在跑同一个项目 → 复用它
      if (await isOurInstance(args.port)) {
        const url = 'http://127.0.0.1:' + args.port + '/';
        console.log('[serve] 端口 ' + args.port + ' 上已有本项目在运行，直接复用。');
        console.log('[serve] 访问：' + url);
        if (args.open) openBrowser(url);
        process.exit(0);
      }
      console.error('[serve] 端口 ' + args.port + ' 已被其它程序占用，服务未启动。');
      console.error('[serve] 请关闭占用该端口的程序，或换一个端口：');
      console.error('[serve]   node scripts/serve.mjs --port ' + (args.port + 1));
      console.error('[serve] 若只是不想起服务，也可以直接双击 index.html 用浏览器打开。');
      process.exit(1);
    }
    console.error('[serve] 启动失败：', err.message);
    process.exit(1);
  });

  server.listen(args.port, args.host, () => {
    const url = 'http://' + (args.host === '0.0.0.0' ? 'localhost' : args.host) + ':' + args.port + '/';
    console.log('[serve] 目录：' + BASE);
    console.log('[serve] 访问：' + url);
    console.log('[serve] 按 Ctrl+C 停止');
    if (args.open) openBrowser(url);
  });
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') exec('start "" "' + url + '"');
    else if (process.platform === 'darwin') exec('open "' + url + '"');
    else exec('xdg-open "' + url + '"');
  } catch (e) {
    console.log('[serve] 无法自动打开浏览器，请手动访问上面的地址');
  }
}

main();
