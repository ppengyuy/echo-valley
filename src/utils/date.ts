const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function cnDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function dayPeriod(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 5) return '夜里';
  if (h < 9) return '清晨';
  if (h < 12) return '上午';
  if (h < 14) return '午后';
  if (h < 18) return '傍晚';
  return '夜里';
}

export function echoTimeLabel(ts: number, sameDayCount = 0): string {
  const label = `存入于 ${cnDate(ts)}`;
  return sameDayCount > 1 ? `${label} · ${dayPeriod(ts)}` : label;
}

export function shortDate(iso: string): string {
  return cnDate(fromIso(iso));
}

export function weekdayLabel(date: Date): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

export function formatMinutes(minutes: number): string {
  if (!minutes) return '0 分钟';
  if (minutes >= 120) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (rest === 0) return `${hours} 小时`;
    return `${hours} 小时 ${rest} 分钟`;
  }
  if (minutes % 60 === 0) return `${minutes / 60} 小时`;
  return `${minutes} 分钟`;
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function planId(level: string, date: Date, seq = 1): string {
  return `P-${level}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(seq)}`;
}

export function fileStamp(date = new Date()): string {
  return isoDate(date);
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
