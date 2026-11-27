import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);
const UPSTREAM = 'https://developer.zhihu.com/v1/chat/completions';
const ZHIDA_PATH = '/api/zhida/v1/chat/completions';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function serveStatic(res, pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { error: { message: 'bad path' } });
  }

  const target = resolve(join(DIST, normalize(decoded)));
  if (target !== DIST && !target.startsWith(DIST + sep)) {
    return sendJson(res, 403, { error: { message: 'forbidden' } });
  }

  let file = target;
  if (!existsSync(file) || !statSync(file).isFile()) {
    // SPA 回退：未知路径都交给前端路由。
    file = join(DIST, 'index.html');
  }
  if (!existsSync(file)) {
    return sendJson(res, 500, { error: { message: 'dist 不存在，请先 npm run build' } });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  const stream = createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) sendJson(res, 500, { error: { message: 'read failed' } });
    else res.end();
  });
  stream.pipe(res);
}

async function proxyZhida(req, res) {
  const secret = (process.env.ZHIDA_ACCESS_SECRET || '').trim();
  if (!secret) {
    return sendJson(res, 503, { error: { message: 'missing ZHIDA_ACCESS_SECRET' } });
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body: Buffer.concat(chunks),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.end(text);
    console.log(`[zhida] upstream ${upstream.status}`);
  } catch (error) {
    console.warn('[zhida] upstream failed', error instanceof Error ? error.message : error);
    sendJson(res, 502, { error: { message: 'zhida upstream failed' } });
  }
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname === ZHIDA_PATH && req.method === 'POST') {
    void proxyZhida(req, res);
    return;
  }
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: { message: 'not found' } });
  }
  serveStatic(res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[echo-valley] listening on 0.0.0.0:${PORT}`);
});
