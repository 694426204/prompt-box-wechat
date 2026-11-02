/**
 * 构建脚本：把纯静态源码打包成 dist/ 部署产物
 * 只做文件复制 + 生成平台辅助文件，不修改任何源码内容。
 */
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// 需要进入部署产物的目录
const COPY_DIRS = ['assets', 'data'];
// 需要复制的文件
const COPY_FILES = ['index.html'];

const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/assets/*
  Cache-Control: public, max-age=604800, immutable

/data/*
  Cache-Control: public, max-age=3600
`;

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const dir of COPY_DIRS) {
    await cp(join(ROOT, dir), join(DIST, dir), { recursive: true });
  }

  for (const file of COPY_FILES) {
    await cp(join(ROOT, file), join(DIST, file));
  }

  // 404 页面复用首页（纯前端应用，无路由）
  const html = await readFile(join(ROOT, 'index.html'));
  await writeFile(join(DIST, '404.html'), html);

  // Cloudflare Pages 自定义响应头
  await writeFile(join(DIST, '_headers'), HEADERS, 'utf8');

  console.log('[build] dist/ 已生成：');
  console.log('  index.html');
  for (const dir of COPY_DIRS) console.log(`  ${dir}/`);
  console.log('  404.html');
  console.log('  _headers');
}

build().catch(err => {
  console.error('[build] 失败：', err);
  process.exit(1);
});
