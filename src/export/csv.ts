import { COPY, CSV_HEADERS } from '../copy';
import type { Plan, PlanItem } from '../types';

const escapeCsv = (value: string | number | boolean): string => {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const levelOrder: Record<PlanItem['level'], number> = { year: 0, month: 1, week: 2, day: 3 };

export function buildCsv(plan: Plan): string {
  const rows = [...plan.items]
    .filter((item) => !item.pocket)
    .sort(
      (a, b) =>
        levelOrder[a.level] - levelOrder[b.level] ||
        Number(a.is_buffer) - Number(b.is_buffer) ||
        a.start_date.localeCompare(b.start_date),
    )
    .map((item) =>
      [
        item.plan_id,
        COPY.planLevel[item.level],
        item.start_date,
        item.end_date,
        item.direction,
        item.arrangement,
        item.enough_point ?? '',
        item.planned_minutes,
        item.actual_minutes,
        COPY.planStatus[item.status],
        item.is_buffer ? '是' : '否',
        item.note ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );

  return `${CSV_HEADERS.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
