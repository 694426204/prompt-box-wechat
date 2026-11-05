/**
 * 构建脚本：把纯静态源码打包成 dist/ 部署产物
 * 只做文件复制 + 内容指纹改名 + 生成平台辅助文件，不修改任何源码内容。
 */
import { cp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// 需要进入部署产物的目录（逐文件加内容指纹后复制）
const COPY_DIRS = ['assets', 'data'];
// 需要复制的文件
const COPY_FILES = ['index.html'];

const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/404.html
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=604800, immutable

/data/*
  Cache-Control: public, max-age=604800, immutable
`;

// 内容指纹：sha1 前 8 位十六进制
async function hashFile(file) {
  const buf = await readFile(file);
  return createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

// 文件名加指纹：app.js -> app.a1b2c3d4.js
function fingerprintName(name, hash) {
  const ext = extname(name);
  const stem = basename(name, ext);
  return stem + '.' + hash + ext;
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // 收集「原引用路径 -> 带指纹的新路径」映射
  const refMap = new Map();

  for (const dir of COPY_DIRS) {
    const srcDir = join(ROOT, dir);
    const files = await readdir(srcDir, { withFileTypes: true });
    for (const entry of files) {
      if (!entry.isFile()) continue;
      const src = join(srcDir, entry.name);
      const hash = await hashFile(src);
      const outName = fingerprintName(entry.name, hash);
      const outPath = join(DIST, dir, outName);
      await mkdir(dirname(outPath), { recursive: true });
      await cp(src, outPath);
      refMap.set(dir + '/' + entry.name, dir + '/' + outName);
    }
  }

  for (const file of COPY_FILES) {
    await cp(join(ROOT, file), join(DIST, file));
  }

  // 改写 index.html 中的资源引用（404.html 由改写后的 index 生成，保证一致）
  let html = await readFile(join(ROOT, 'index.html'), 'utf8');
  for (const [from, to] of refMap) {
    html = html.split(from).join(to);
  }
  await writeFile(join(DIST, 'index.html'), html, 'utf8');

  // 404 页面复用首页（纯前端应用，无路由）
  await writeFile(join(DIST, '404.html'), html, 'utf8');

  // Cloudflare Pages 自定义响应头
  await writeFile(join(DIST, '_headers'), HEADERS, 'utf8');

  console.log('[build] dist/ 已生成：');
  console.log('  index.html');
  for (const dir of COPY_DIRS) console.log(`  ${dir}/  (内容指纹命名)`);
  console.log('  404.html');
  console.log('  _headers');
  for (const [from, to] of refMap) console.log(`  ${from} -> ${to}`);
}

build().catch(err => {
  console.error('[build] 失败：', err);
  process.exit(1);
});
