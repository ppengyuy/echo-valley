import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 本地开发用的知乎直答转发。
 *
 * 浏览器只请求同源 /api/zhida/v1/chat/completions；
 * 这里在 Node 侧补 Authorization / X-Request-Timestamp，
 * Access Secret 不会出现在浏览器 bundle 里。
 */
function zhidaProxy(secret: string): Plugin {
  return {
    name: 'zhida-proxy',
    configureServer(server) {
      server.middlewares.use('/api/zhida', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'method not allowed' } }));
          return;
        }

        if (!secret) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'missing ZHIDA_ACCESS_SECRET' } }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          const upstream = await fetch('https://developer.zhihu.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${secret}`,
              'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
            },
            body: Buffer.concat(chunks).toString('utf8'),
          });

          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') ?? 'application/json',
          );
          res.end(text);
          console.log(`[zhida] upstream ${upstream.status}`);
        } catch (error) {
          console.warn('[zhida] upstream failed', error);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'zhida upstream failed' } }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 只在 Node 侧读取 Access Secret，不通过 VITE_* 暴露给浏览器。
  const env = loadEnv(mode, process.cwd(), '');
  const zhidaSecret = (env.ZHIDA_ACCESS_SECRET ?? '').trim();

  return {
    plugins: [react(), zhidaProxy(zhidaSecret)],
    server: {
      port: 5178,
      host: '127.0.0.1',
      watch: {
        // 根目录里的预览图有时被看图软件锁住，会让文件监听直接崩掉。
        ignored: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.webp'],
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
  };
});
