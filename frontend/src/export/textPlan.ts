import { COPY, FOOTER_SHORT, PRINT_HINTS } from '../copy';
import type { Plan } from '../types';
import { weekItems } from '../plan/build';
import { shortDate } from '../utils/date';

export function buildPlanText(plan: Plan): string {
  const year = plan.items.find((item) => item.level === 'year' && !item.pocket);
  const month = plan.items.find((item) => item.level === 'month' && !item.pocket);
  const day = plan.items.find((item) => item.level === 'day' && !item.pocket);
  const buffer = plan.items.find((item) => item.level === 'week' && item.is_buffer);
  const week = buffer ? [...weekItems(plan), buffer] : weekItems(plan);

  const lines: string[] = [
    `回音谷 · 我的山间小路`,
    `想靠近的方向：${plan.goal}`,
    `大概走到：${plan.horizon}`,
    `一天能留出的时间：${Math.round(plan.dailyMinutes / 60)} 小时左右`,
    '',
    `【这一年】`,
    `${year?.direction ?? ''}`,
    `${year?.arrangement ?? ''}`,
    '',
    `【这个月】`,
    `${month?.direction ?? ''}`,
    `${month?.arrangement ?? ''}`,
    '',
    `【这一周】`,
  ];

  for (const item of week) {
    if (item.is_buffer) {
      lines.push(`· ${shortDate(item.start_date)}｜留白：${item.arrangement}`);
    } else {
      lines.push(
        `· ${shortDate(item.start_date)}｜${item.arrangement}｜${item.planned_minutes} 分钟｜${COPY.planStatus[item.status]}`,
      );
    }
  }

  lines.push(
    '',
    `【今天】`,
    `${day?.arrangement ?? ''}`,
    `大概花多久：${day?.planned_minutes ?? 0} 分钟`,
    `做到哪里就可以停：${day?.enough_point || '还没写'}`,
    '',
    `想对自己说：${day?.note || '还没有留话'}`,
    '',
    PRINT_HINTS[3],
    '',
    FOOTER_SHORT,
  );

  return lines.join('\n');
}
