import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ROOT = 'D:/我的项目';
const DIR = path.join(ROOT, '.demo-record');
const WEBM = fs.readFileSync(path.join(DIR, 'latest.txt'), 'utf8').trim();
const MP4 = path.join(ROOT, '回音谷_项目演示.mp4');
const POSTER = path.join(ROOT, '回音谷_演示封面.png');

const dataUrl = 'data:video/webm;base64,' + fs.readFileSync(WEBM).toString('base64');
console.log('输入 WEBM:', (fs.statSync(WEBM).size / 1024 / 1024).toFixed(2), 'MB');

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => console.log('[page]', m.text()));

const parts = [];
await page.exposeFunction('receiveChunk', (b64) => {
  parts.push(Buffer.from(b64, 'base64'));
});

await page.goto('about:blank');

const meta = await page.evaluate(async (src) => {
  return await new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:200px';
    document.body.appendChild(video);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const mime = 'video/mp4;codecs=avc1.42E01E';
    if (!MediaRecorder.isTypeSupported(mime)) {
      reject(new Error('MP4 MediaRecorder 不支持'));
      return;
    }
    let recorder = null;
    let chunks = [];
    let posterTaken = false;
    const guard = setTimeout(() => {
      console.log('guard stop');
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    }, 150000);

    video.addEventListener('loadedmetadata', () => {
      console.log('meta ready', video.duration, video.videoWidth, video.videoHeight);
      canvas.width = video.videoWidth || 1440;
      canvas.height = video.videoHeight || 900;
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4200000 });
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        console.log('recorder stop', chunks.length);
        clearTimeout(guard);
        const blob = new Blob(chunks, { type: mime });
        const reader = new FileReader();
        reader.onload = async () => {
          console.log('reader done', blob.size);
          const b64 = String(reader.result).split(',')[1];
          const step = 600000;
          for (let i = 0; i < b64.length; i += step) {
            await window.receiveChunk(b64.slice(i, i + step));
          }
          console.log('chunks sent');
          resolve({ duration: video.duration, width: canvas.width, height: canvas.height });
        };
        reader.onerror = () => reject(new Error('MP4 读取失败'));
        reader.readAsDataURL(blob);
      };
      recorder.start(1000);
      const draw = () => {
        if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!posterTaken && video.currentTime >= 2.2) {
          posterTaken = true;
          window.__poster = canvas.toDataURL('image/png');
        }
        if (!video.ended) requestAnimationFrame(draw);
      };
      draw();
      video.play().catch((e) => console.log('play error', String(e)));
    });
    video.addEventListener('ended', () => {
      console.log('video ended');
      setTimeout(() => { if (recorder && recorder.state !== 'inactive') recorder.stop(); }, 400);
    });
    video.addEventListener('error', () => reject(new Error('视频加载失败')));
  });
}, dataUrl);

fs.writeFileSync(MP4, Buffer.concat(parts));

const posterData = await page.evaluate(() => window.__poster || '');
if (posterData) fs.writeFileSync(POSTER, Buffer.from(posterData.split(',')[1], 'base64'));

await browser.close();

console.log('--- 转换完成 ---');
console.log('时长:', Math.round(meta.duration), '秒；分辨率:', meta.width + 'x' + meta.height);
console.log('MP4:', MP4, fs.statSync(MP4).size, 'bytes');
console.log('POSTER:', POSTER, fs.existsSync(POSTER) ? fs.statSync(POSTER).size + ' bytes' : '未生成');
