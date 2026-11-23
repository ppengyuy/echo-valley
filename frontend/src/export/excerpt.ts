import type { Echo } from '../types';
import { cnDate, fileStamp } from '../utils/date';
import { downloadBlob } from './download';

const W = 1080;
const H = 1440;

type RGB = [number, number, number];

type Palette = {
  bg: [string, string, string];
  far: RGB;
  mid: RGB;
  near: RGB;
  ink: string;
  accent: RGB;
};

const PALETTES: Record<'spring' | 'summer' | 'autumn' | 'winter', Palette> = {
  spring: {
    bg: ['#f8f9f3', '#f2f5ee', '#e7eee4'],
    far: [199, 217, 195],
    mid: [178, 201, 175],
    near: [156, 186, 155],
    ink: '#354038',
    accent: [104, 136, 111],
  },
  summer: {
    bg: ['#f6f9f5', '#edf4f1', '#dfeae5'],
    far: [190, 215, 209],
    mid: [163, 198, 190],
    near: [139, 181, 174],
    ink: '#2f403d',
    accent: [88, 135, 128],
  },
  autumn: {
    bg: ['#faf7f0', '#f5efe4', '#ebe2d2'],
    far: [221, 208, 185],
    mid: [206, 188, 160],
    near: [190, 168, 137],
    ink: '#463c30',
    accent: [151, 126, 86],
  },
  winter: {
    bg: ['#f7f9fa', '#eef2f4', '#e2e9ed'],
    far: [203, 216, 222],
    mid: [181, 199, 208],
    near: [159, 181, 192],
    ink: '#35414a',
    accent: [105, 133, 148],
  },
};

function seasonOf(timestamp: number): keyof typeof PALETTES {
  const month = new Date(timestamp).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function rgba([r, g, b]: RGB, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text.replace(/\r/g, '')) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      if ('，。！？、；：」』）】…'.includes(char)) {
        line = next;
        lines.push(line);
        line = '';
      } else {
        lines.push(line);
        line = char;
      }
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 画山谷里那个很小的陪伴者，只作为安静的彩蛋，不抢正文。 */
function drawLittleFox(ctx: CanvasRenderingContext2D, x: number, y: number, color: RGB) {
  ctx.save();
  ctx.fillStyle = rgba(color, 0.46);
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 17, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7.5, y - 22);
  ctx.lineTo(x - 10, y - 32);
  ctx.lineTo(x - 2, y - 25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 7.5, y - 22);
  ctx.lineTo(x + 10, y - 32);
  ctx.lineTo(x + 2, y - 25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 4, 8, 4.5, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function downloadEchoCard(echo: Echo): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  const palette = PALETTES[seasonOf(echo.createdAt)];

  // 底：随季节变化的米纸与雾色
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, palette.bg[0]);
  bg.addColorStop(0.55, palette.bg[1]);
  bg.addColorStop(1, palette.bg[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 一层极淡的横向雾带，让空间有纵深
  const mist = ctx.createLinearGradient(0, 820, 0, 1240);
  mist.addColorStop(0, rgba(palette.accent, 0));
  mist.addColorStop(0.55, rgba(palette.accent, 0.045));
  mist.addColorStop(1, rgba(palette.accent, 0));
  ctx.fillStyle = mist;
  ctx.fillRect(0, 820, W, 420);

  // 回音从这句话荡开：圆心落在正文中央，而不是悬在角落
  const cx = W / 2;
  const cy = 632;
  ctx.save();
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, 190 + i * 116, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(palette.accent, 0.13 - i * 0.019);
    ctx.lineWidth = i === 0 ? 1.5 : 1.1;
    ctx.stroke();
  }
  // 最内圈的一点余韵
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = rgba(palette.accent, 0.16);
  ctx.fill();
  ctx.restore();

  // 三重山：远山最淡，近山略深，把「山谷」做出来
  ctx.save();
  ctx.fillStyle = rgba(palette.far, 0.46);
  ctx.beginPath();
  ctx.moveTo(0, 1090);
  ctx.bezierCurveTo(210, 950, 380, 1040, 560, 1090);
  ctx.bezierCurveTo(760, 1146, 890, 990, 1080, 1050);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgba(palette.mid, 0.5);
  ctx.beginPath();
  ctx.moveTo(0, 1190);
  ctx.bezierCurveTo(250, 1090, 470, 1210, 700, 1160);
  ctx.bezierCurveTo(870, 1124, 980, 1190, W, 1170);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgba(palette.near, 0.58);
  ctx.beginPath();
  ctx.moveTo(0, 1310);
  ctx.bezierCurveTo(280, 1210, 520, 1330, 760, 1270);
  ctx.bezierCurveTo(920, 1230, 1010, 1290, W, 1280);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 一条走进山谷的小路，尽头是安静陪着的那一个
  ctx.save();
  ctx.setLineDash([2, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(palette.accent, 0.3);
  ctx.beginPath();
  ctx.moveTo(566, H);
  ctx.bezierCurveTo(520, 1380, 624, 1320, 590, 1236);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(590, 1236, 3, 0, Math.PI * 2);
  ctx.fillStyle = rgba(palette.accent, 0.38);
  ctx.fill();
  ctx.restore();
  drawLittleFox(ctx, 604, 1226, palette.accent);

  // 页眉
  ctx.fillStyle = rgba(palette.accent, 0.82);
  ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('回音谷', 96, 96);
  ctx.fillStyle = rgba(palette.accent, 0.55);
  ctx.textAlign = 'right';
  ctx.fillText('刘看山陪你', W - 96, 96);
  ctx.strokeStyle = rgba(palette.accent, 0.16);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(96, 132);
  ctx.lineTo(W - 96, 132);
  ctx.stroke();

  // 正文：随长度调整字号，整体落在波纹中心
  const maxWidth = W - 240;
  let fontSize = 52;
  let lines: string[] = [];
  for (const size of [52, 48, 44, 40, 36, 32, 28]) {
    fontSize = size;
    ctx.font = `${size}px "Songti SC", "Noto Serif SC", "SimSun", serif`;
    lines = wrapText(ctx, echo.text.trim(), maxWidth);
    if (lines.length <= 16) break;
  }
  const lineHeight = Math.round(fontSize * 1.8);
  const blockHeight = lines.length * lineHeight;
  const firstY = Math.max(300, Math.round(cy - blockHeight / 2 + fontSize * 0.82));

  // 引号跟着正文走，成为开口而不是孤立的装饰
  ctx.fillStyle = rgba(palette.accent, 0.3);
  ctx.font = '118px "Songti SC", "Noto Serif SC", "SimSun", serif';
  ctx.textAlign = 'left';
  ctx.fillText('“', 106, firstY - 66);

  ctx.fillStyle = palette.ink;
  ctx.font = `${fontSize}px "Songti SC", "Noto Serif SC", "SimSun", serif`;
  let y = firstY;
  for (const line of lines) {
    ctx.fillText(line, 120, y);
    y += lineHeight;
  }

  // 分隔线与时间
  const footerY = Math.max(y + 42, 1120);
  ctx.strokeStyle = rgba(palette.accent, 0.2);
  ctx.beginPath();
  ctx.moveTo(120, footerY);
  ctx.lineTo(W - 120, footerY);
  ctx.stroke();

  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = rgba(palette.accent, 0.72);
  ctx.textAlign = 'left';
  ctx.fillText(`存入于 ${cnDate(echo.createdAt)}`, 120, footerY + 56);

  if (echo.tag) {
    ctx.textAlign = 'right';
    ctx.fillText(`# ${echo.tag}`, W - 120, footerY + 56);
    ctx.textAlign = 'left';
  }

  if (echo.mirror) {
    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = rgba(palette.accent, 0.5);
    ctx.fillText('你写给自己的话', 120, footerY + 94);
  }

  // 底部落款
  ctx.textAlign = 'center';
  ctx.font = '21px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = rgba(palette.accent, 0.78);
  ctx.fillText('山谷不评判、不催促，安静陪着你收下这些声音。', W / 2, 1372);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('card encode failed');
  downloadBlob(`回音谷_回音_${fileStamp()}.png`, blob);
}
