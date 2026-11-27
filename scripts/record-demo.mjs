import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = 'D:/我的项目';
const VID_DIR = path.join(ROOT, '.demo-record');
const MP4 = path.join(ROOT, '回音谷_项目演示.mp4');
const POSTER = path.join(ROOT, '回音谷_演示封面.png');
fs.mkdirSync(VID_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: VID_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5178/?demo=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

await page.addStyleTag({
  content: `
    #demo-caption, #demo-cover { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
    #demo-caption {
      position: fixed; left: 50%; top: 16%; transform: translateX(-50%);
      z-index: 99999; max-width: 78%; padding: 14px 28px;
      background: rgba(255,255,255,.88); border: 1px solid rgba(80,110,90,.18);
      border-radius: 16px; box-shadow: 0 12px 40px rgba(40,60,50,.12);
      backdrop-filter: blur(8px); color: #2d4036; font-size: 21px; font-weight: 600;
      line-height: 1.55; text-align: center; letter-spacing: .02em;
      opacity: 0; transition: opacity .35s ease; pointer-events: none;
    }
    #demo-caption.show { opacity: 1; }
    #demo-cover {
      position: fixed; inset: 0; z-index: 99998;
      background: linear-gradient(135deg, rgba(247,250,244,.96), rgba(232,241,235,.96));
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #294036; opacity: 0; transition: opacity .5s ease; pointer-events: none;
    }
    #demo-cover.show { opacity: 1; }
    #demo-cover h1 { font-size: 46px; margin: 0 0 18px; letter-spacing: .08em; font-weight: 700; }
    #demo-cover p { font-size: 22px; margin: 0; color: #5b7365; letter-spacing: .04em; }
  `,
});
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'demo-caption'; document.body.appendChild(c);
  const v = document.createElement('div'); v.id = 'demo-cover'; document.body.appendChild(v);
});

async function caption(text, ms = 1300) {
  await page.evaluate((t) => {
    const el = document.getElementById('demo-caption');
    el.textContent = t; el.classList.add('show');
  }, text);
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById('demo-caption').classList.remove('show'));
  await page.waitForTimeout(280);
}
async function cover(title, sub, ms = 2000) {
  await page.evaluate(({ t, s }) => {
    const el = document.getElementById('demo-cover');
    el.innerHTML = `<h1>${t}</h1><p>${s}</p>`; el.classList.add('show');
  }, { t: title, s: sub });
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById('demo-cover').classList.remove('show'));
  await page.waitForTimeout(600);
}
async function safeClick(getter, label) {
  try {
    const loc = await getter();
    await loc.first().waitFor({ state: 'visible', timeout: 5000 });
    try {
      await loc.first().click({ timeout: 3000 });
    } catch {
      await loc.first().click({ force: true, timeout: 3000 });
    }
    console.log('OK   ' + label);
    return true;
  } catch (e) {
    console.log('SKIP ' + label + ' :: ' + String(e.message).split('\n')[0]);
    return false;
  }
}

console.log('--- 开始录制 ---');

await cover('回音谷', '刘看山陪你，备考感悟陪伴搭子', 1900);
await caption('双栏陪伴：左边把路标出来，右边把情绪安放下来', 1600);

await safeClick(() => page.getByText('我害怕努力没有回报', { exact: true }), '快捷句');
await page.waitForTimeout(700);
await caption('向山谷倾诉：不必组织好语言，一句就够', 1200);
await page.waitForTimeout(2100);
if (await page.getByRole('button', { name: '存入山谷' }).count()) {
  await safeClick(() => page.getByRole('button', { name: '存入山谷' }), '存入山谷');
  await page.waitForTimeout(900);
}
await safeClick(() => page.getByRole('button', { name: /聆听回音/ }), '聆听回音');
await caption('回音会被好好收下，也可以随时回来聆听', 1400);
await page.waitForTimeout(700);

await safeClick(() => page.getByRole('button', { name: /梳理山间行程/ }), '打开向导');
await page.waitForTimeout(500);
await caption('梳理山间行程：一次只问一件事', 1200);
// 向导里点标签会自动进入下一步；第 3 步（任务）需要点「接着说」。
await page.waitForTimeout(450);
await safeClick(() => page.locator('.wizard-chips .chip', { hasText: '考研' }), '方向 考研');
await page.waitForTimeout(500);
await safeClick(() => page.locator('.wizard-chips .chip', { hasText: '三个月后' }), '时间 三个月后');
await page.waitForTimeout(500);
await page.locator('.wizard-textarea').fill('背完一轮单词\n过完专业课第一轮');
await page.waitForTimeout(350);
await safeClick(() => page.getByRole('button', { name: '接着说' }), '接着说');
await page.waitForTimeout(550);
await safeClick(() => page.locator('.wizard-chips .chip', { hasText: '2 小时' }), '每天 2 小时');
await page.waitForTimeout(500);
await safeClick(() => page.locator('.wizard-chips .chip', { hasText: '25 分钟' }), '节奏 25 分钟');
await page.locator('.wizard-done').waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
await page.waitForTimeout(800);
await caption('刘看山慢慢画路：不是进度条，是一起走的小路', 1500);
await safeClick(() => page.getByRole('button', { name: '就这样' }), '就这样');
await page.waitForTimeout(700);

await safeClick(() => page.locator('.path-node').first(), '路径节点');
await page.waitForTimeout(500);
await caption('时间线：任务安排 / 进度记录 / 自留独白', 1400);
await page.locator('.note-input').first().fill('今天只做一点点，也算在走。').catch(() => {});
await page.waitForTimeout(300);
await safeClick(() => page.getByRole('button', { name: '把这句话存为回音' }), '独白存回音');
await page.waitForTimeout(1800);

await safeClick(() => page.locator('.week-empty-add').first(), '空白格');
await page.waitForTimeout(500);
await caption('往这一格放一件事：浮层只在左栏展开，不遮挡回音谷', 1500);
await page.locator('.editor-input').fill('整理错题').catch(() => {});
await safeClick(() => page.locator('.editor-chips .editor-chip').first(), '预设时长');
await page.waitForTimeout(450);
await safeClick(() => page.getByRole('button', { name: '放进这一格' }), '放进这一格');
await page.waitForTimeout(900);

await safeClick(() => page.getByRole('button', { name: '把这份计划带走' }), '带走计划');
await page.waitForTimeout(500);
await caption('计划可带走：CSV / Excel / 打印手写版', 1300);
await safeClick(() => page.getByRole('button', { name: '先收起来' }), '关闭导出');
await page.waitForTimeout(400);

for (const s of ['春', '夏', '秋', '冬']) {
  await safeClick(() => page.getByRole('button', { name: '山谷的季节：' + s }), '季节 ' + s);
  await page.waitForTimeout(430);
}
await caption('四季主题：只换色调，不换语气', 1100);
await safeClick(() => page.getByRole('checkbox', { name: '减少动态效果' }), '开启减少动态效果');
await page.waitForTimeout(600);
await caption('减少动态效果：关掉位移与漂浮，只留淡入淡出', 1300);
await safeClick(() => page.getByRole('checkbox', { name: '减少动态效果' }), '恢复动效');
await page.waitForTimeout(400);

await cover('回音谷', '山谷不评判、不催促，安静陪着你收下这些声音。', 2200);

const video = page.video();
await page.close();
await context.close();
await browser.close();
const webm = await video.path();

fs.writeFileSync(path.join(VID_DIR, 'latest.txt'), webm);
console.log('--- 录制完成 ---');
console.log('WEBM:', webm, fs.statSync(webm).size, 'bytes');
console.log('控制台错误:', errors.length, errors.slice(0, 3));
