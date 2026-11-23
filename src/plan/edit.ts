import type { Plan, PlanItem } from '../types';
import { addDays, fromIso, isoDate, planId, startOfWeek } from '../utils/date';

/** 出现在「这一周」里的东西：周安排，不是留白，也不在口袋里。 */
const isActiveWeekItem = (item: PlanItem) =>
  item.level === 'week' && !item.is_buffer && !item.pocket;

function nextItemId(plan: Plan, date: Date): string {
  const used = new Set(plan.items.map((item) => item.plan_id));
  for (let seq = 1; seq < 400; seq += 1) {
    const id = planId('week', date, seq);
    if (!used.has(id)) return id;
  }
  return planId('week', date, Date.now() % 997);
}

export function patchItem(plan: Plan, id: string, patch: Partial<PlanItem>): Plan {
  return {
    ...plan,
    items: plan.items.map((item) => (item.plan_id === id ? { ...item, ...patch } : item)),
  };
}

/** 往某一格新放一件事；编号按日期生成，保持全局唯一。 */
export function addItem(plan: Plan, draft: PlanItem): Plan {
  const item: PlanItem = {
    ...draft,
    plan_id: nextItemId(plan, fromIso(draft.start_date)),
  };
  return syncSummaries({ ...plan, items: [...plan.items, item] });
}

/** 挪到另一天；单日节点只改日期，不碰它的层级。 */
export function moveItem(plan: Plan, id: string, iso: string): Plan {
  const target = plan.items.find((item) => item.plan_id === id);
  if (!target || target.is_buffer) return plan;
  return patchItem(plan, id, {
    start_date: iso,
    end_date: target.level === 'week' || target.level === 'day' ? iso : target.end_date,
  });
}

export function dayItems(plan: Plan, iso: string): PlanItem[] {
  return plan.items.filter((item) => isActiveWeekItem(item) && item.start_date === iso);
}

export function dayTotal(plan: Plan, iso: string): number {
  return dayItems(plan, iso)
    .filter((item) => item.status !== 'let_go')
    .reduce((sum, item) => sum + item.planned_minutes, 0);
}

/** 这一周里，除某天之外最空的一天。 */
export function lightestDay(plan: Plan, iso: string): string | null {
  const weekStart = startOfWeek(fromIso(iso));
  let best: string | null = null;
  let bestLoad = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < 7; offset += 1) {
    const date = isoDate(addDays(weekStart, offset));
    if (date === iso) continue;
    const load = dayTotal(plan, date);
    if (load < bestLoad) {
      bestLoad = load;
      best = date;
    }
  }
  return best;
}

/** 这天的安排有点满时，把最后一件挪到最空的那天。 */
export function moveOneFromDay(plan: Plan, iso: string): Plan {
  const items = dayItems(plan, iso).filter((item) => item.status !== 'let_go');
  if (items.length === 0) return plan;
  const target = lightestDay(plan, iso);
  if (!target) return plan;
  return moveItem(plan, items[items.length - 1].plan_id, target);
}

function nextFreeDate(plan: Plan, fromIsoDate: string): string {
  const used = new Set(
    plan.items.filter((item) => isActiveWeekItem(item)).map((item) => item.start_date),
  );
  for (let offset = 1; offset <= 21; offset += 1) {
    const date = isoDate(addDays(fromIso(fromIsoDate), offset));
    if (!used.has(date)) return date;
  }
  return isoDate(addDays(fromIso(fromIsoDate), 1));
}

/** 大事项拆成两件，第二件自动放到下一个空着的日子。 */
export function splitItem(plan: Plan, id: string): Plan {
  const item = plan.items.find((entry) => entry.plan_id === id);
  if (!item || item.is_buffer || item.level !== 'week') return plan;

  const total = Math.max(10, item.planned_minutes);
  const firstMinutes = Math.max(5, Math.round(total / 2 / 5) * 5);
  const secondMinutes = Math.max(5, total - firstMinutes);
  const date = nextFreeDate(plan, item.start_date);
  const secondName = `${item.arrangement}（后半）`;

  const second: PlanItem = {
    ...item,
    plan_id: nextItemId(plan, fromIso(date)),
    start_date: date,
    end_date: date,
    arrangement: secondName,
    direction: `先动「${secondName}」这一件`,
    enough_point: '做到这一小段就可以停',
    planned_minutes: secondMinutes,
    actual_minutes: 0,
    status: 'planned',
    is_buffer: false,
    pocket: false,
    note: '',
  };

  return {
    ...plan,
    items: [
      ...plan.items.map((entry) =>
        entry.plan_id === id
          ? {
              ...entry,
              planned_minutes: firstMinutes,
              enough_point: entry.enough_point || '做到这一小段就可以停',
            }
          : entry,
      ),
      second,
    ],
  };
}

/** 两件小事并成一件；保留正在编辑的那件的日子，另一件从路上收走。 */
export function mergeItems(plan: Plan, keepId: string, otherId: string): Plan {
  if (keepId === otherId) return plan;
  const keep = plan.items.find((item) => item.plan_id === keepId);
  const other = plan.items.find((item) => item.plan_id === otherId);
  if (!keep || !other || keep.is_buffer || other.is_buffer) return plan;

  const mergedName = [keep.arrangement, other.arrangement].filter(Boolean).join('、');
  const merged: PlanItem = {
    ...keep,
    arrangement: mergedName,
    direction: `先动「${mergedName}」这一件`,
    planned_minutes: keep.planned_minutes + other.planned_minutes,
    enough_point: keep.enough_point || other.enough_point,
    note: [keep.note, other.note].filter(Boolean).join(' '),
    status:
      keep.status === 'doing' || other.status === 'doing'
        ? 'doing'
        : keep.status === 'planned'
          ? other.status
          : keep.status,
  };

  return {
    ...plan,
    items: plan.items
      .filter((item) => item.plan_id !== otherId)
      .map((item) => (item.plan_id === keepId ? merged : item)),
  };
}

/** 先放一放：收进口袋，不删除、不计入容量，随时能取回。 */
export function pocketItem(plan: Plan, id: string): Plan {
  return patchItem(plan, id, { pocket: true });
}

export function restoreItem(plan: Plan, id: string): Plan {
  const item = plan.items.find((entry) => entry.plan_id === id);
  if (!item) return plan;
  const today = isoDate(new Date());
  const date = item.start_date < today ? nextFreeDate(plan, today) : item.start_date;
  return patchItem(plan, id, { pocket: false, start_date: date, end_date: date });
}

/** 让「这个月」那句摘要跟着周安排一起变，页面和导出对得上。 */
export function syncSummaries(plan: Plan): Plan {
  const month = plan.items.find((item) => item.level === 'month' && !item.pocket);
  if (!month) return plan;

  const inMonth = plan.items
    .filter(
      (item) =>
        isActiveWeekItem(item) &&
        item.start_date >= month.start_date &&
        item.start_date <= month.end_date,
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const arrangement = inMonth.length
    ? inMonth
        .map((item) => `${item.start_date.slice(5).replace('-', '/')} ${item.arrangement}`)
        .join('；')
    : '这个月先留出空白，走到这儿再看';

  if (arrangement === month.arrangement) return plan;

  return {
    ...plan,
    items: plan.items.map((item) =>
      item.plan_id === month.plan_id ? { ...item, arrangement } : item,
    ),
  };
}
