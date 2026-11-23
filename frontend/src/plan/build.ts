import { COPY } from '../copy';
import type { Plan, PlanItem } from '../types';
import { addDays, fromIso, isoDate, planId, startOfWeek } from '../utils/date';

export interface PlanAnswers {
  goal: string;
  horizon: string;
  dailyMinutes: number;
  rhythm: string;
  /** 用户自己写下的、这段时间想做完的几件事。 */
  tasks?: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TASKS = 8;
const TASKS_PER_WEEK = 3;
/** 一周里留给这些事的位置：周二、周四、周日；多了再往后排。 */
const SLOT_OFFSETS = [1, 3, 6, 2, 4, 5];

const rhythmMinutes = (rhythm: string): number => {
  if (rhythm.includes('25')) return 25;
  if (rhythm.includes('45')) return 45;
  if (rhythm.includes('1 小时')) return 60;
  return 40;
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/** 把「三个月后 / 年底 / 明年六月」这类模糊说法，折成一个大概的终点。 */
function endOfHorizon(horizon: string, now: Date): Date {
  const text = horizon.replace(/\s/g, '');
  if (/明年六月|明年6月/.test(text)) return new Date(now.getFullYear() + 1, 5, 30);
  if (/年底|今年底|年末/.test(text)) return new Date(now.getFullYear(), 11, 31);
  if (/半年/.test(text)) return addMonths(now, 6);
  if (/三个月/.test(text)) return addMonths(now, 3);
  const monthMatch = text.match(/(\d+)\s*个?月/);
  if (monthMatch) return addMonths(now, Number(monthMatch[1]));
  const weekMatch = text.match(/(\d+)\s*(?:周|星期|礼拜)/);
  if (weekMatch) return addDays(now, Number(weekMatch[1]) * 7);
  return addMonths(now, 3);
}

/** 从今天到「大概走到」还有多少天，用来估这段时间一共能放下多少小时。 */
export function horizonDays(horizon: string, now = new Date()): number {
  const end = endOfHorizon(horizon, now);
  const days = Math.round((end.getTime() - now.getTime()) / DAY_MS);
  return Math.max(7, Math.min(730, days));
}

/** 一件事一行，也接受用分号隔开；先去重，再留前 8 件。 */
export function parseTasks(text: string): string[] {
  const lines = text
    .split(/\r?\n|；|;/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*·•]\s*/, '').replace(/^\d+\s*[.、)）]\s*/, '').trim())
    .filter(Boolean);
  return Array.from(new Set(lines)).slice(0, MAX_TASKS);
}

const durationPattern =
  /(\d+(?:\.\d+)?)\s*(小时|分钟|minutes|minute|mins|min|hours|hour|hrs|hr|h)/i;

interface ParsedTask {
  title: string;
  minutes: number;
}

/** 如果用户顺手写了「背单词 30 分钟」，就用他写的时间；没写就由系统给一个大概值。 */
function parseTaskLine(line: string): ParsedTask {
  const match = line.match(durationPattern);
  let title = line;
  let minutes = 0;

  if (match) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const isHour =
      unit === '小时' || unit === 'h' || unit === 'hr' || unit === 'hrs' || unit.startsWith('hour');
    minutes = Math.round(isHour ? value * 60 : value);
    title = line.replace(durationPattern, '');
  }

  title = title
    .replace(/[（(]\s*[)）]/g, '')
    .replace(/[（(]\s*$/, '')
    .replace(/^[\s,，、:：\-·]+|[\s,，、:：\-·]+$/g, '')
    .trim();

  return {
    title: title || line.trim(),
    minutes: Math.max(0, Math.min(600, minutes)),
  };
}

function noteForGoal(goal: string): string {
  if (goal.includes('考公') || goal.includes('公考')) return '上半年把行测和申论的底子铺好，下半年按考试节奏做整卷';
  if (goal.includes('考证')) return '先把考纲里的主干过一遍，考前留出整块时间回看';
  if (goal.includes('期末')) return '跟着课程节奏走，考前把重点章节串成自己的话';
  return '上半年跟着课程与自己的计划走，下半年做专题梳理';
}

export function buildPlan(answers: PlanAnswers): Plan {
  const now = new Date();
  const todayIso = isoDate(now);
  const weekStart = startOfWeek(now);
  const daily = Math.max(30, Math.round(answers.dailyMinutes));
  const focus = Math.min(daily, Math.max(25, rhythmMinutes(answers.rhythm)));
  const goal = answers.goal.trim() || '想靠近的方向';
  const horizon = answers.horizon.trim() || '三个月后';
  const totalDays = horizonDays(horizon, now);

  const parsedTasks = (answers.tasks ?? [])
    .map((task) => task.trim())
    .filter(Boolean)
    .slice(0, MAX_TASKS)
    .map(parseTaskLine);

  // 每件先按「两次专注」估；用户写了时间就听他的。
  const defaultTaskMinutes = Math.min(daily, Math.max(30, focus * 2));
  const hasOwnTasks = parsedTasks.length > 0;
  const taskEntries: ParsedTask[] = hasOwnTasks
    ? parsedTasks
    : [
        {
          title: `把${goal}里最想先弄懂的那一段过一遍`,
          minutes: Math.min(daily, Math.max(30, focus * 2)),
        },
        {
          title: '整理这一周的笔记与疑问，写三句自己的话',
          minutes: Math.min(daily, Math.max(30, focus)),
        },
        { title: '挑一个安静的时间，回看这一周', minutes: 30 },
      ];

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // 把用户写下的几件事，一件件放到接下来几周的固定位置。
  const weekPlanItems: PlanItem[] = taskEntries.map((task, index) => {
    const weekOffset = Math.floor(index / TASKS_PER_WEEK) * 7;
    const dayOffset = SLOT_OFFSETS[index % TASKS_PER_WEEK];
    const date = addDays(weekStart, weekOffset + dayOffset);
    const minutes = task.minutes || defaultTaskMinutes;
    return {
      plan_id: planId('week', date, index + 1),
      level: 'week',
      start_date: isoDate(date),
      end_date: isoDate(date),
      direction: hasOwnTasks ? `先动「${task.title}」这一件` : '这周想再往前一点点',
      arrangement: task.title,
      enough_point: minutes >= 60 ? '做到这一小段就可以停' : '做完这一小件就可以停',
      planned_minutes: minutes,
      actual_minutes: 0,
      status: 'planned',
      is_buffer: false,
      note: '',
    };
  });

  const monthItems = weekPlanItems.filter(
    (item) => item.start_date >= isoDate(monthStart) && item.start_date <= isoDate(monthEnd),
  );
  const monthList = (monthItems.length ? monthItems : weekPlanItems).slice(0, 5);
  const monthArrangement = monthList.length
    ? monthList
        .map((item) => `${item.start_date.slice(5).replace('-', '/')} ${item.arrangement}`)
        .join('；')
    : '每周挑两三件慢慢过，月底回看一次';

  const items: PlanItem[] = [
    {
      plan_id: planId('year', yearStart),
      level: 'year',
      start_date: isoDate(yearStart),
      end_date: isoDate(yearEnd),
      direction: `把${goal}这件事，按自己的节奏往前带`,
      arrangement: hasOwnTasks
        ? `到${horizon}之前，按自己的节奏把这几件一件件过过去，中间留出回看和空白的日子。`
        : noteForGoal(goal),
      enough_point: '',
      planned_minutes: Math.round(daily * totalDays * 0.6),
      actual_minutes: 0,
      status: 'doing',
      is_buffer: false,
      note: '年末再回来看看',
    },
    {
      plan_id: planId('month', monthStart),
      level: 'month',
      start_date: isoDate(monthStart),
      end_date: isoDate(monthEnd),
      direction: `${goal}，先把这个月这几件往前带`,
      arrangement: monthArrangement,
      enough_point: '',
      planned_minutes: Math.round(daily * 24),
      actual_minutes: 0,
      status: 'planned',
      is_buffer: false,
      note: '月末回看',
    },
    ...weekPlanItems,
  ];

  const bufferDay = addDays(weekStart, 5);
  items.push({
    plan_id: planId('week', bufferDay, 90),
    level: 'week',
    start_date: isoDate(weekStart),
    end_date: isoDate(addDays(weekStart, 6)),
    direction: '留白',
    arrangement: COPY.weekBufferText,
    enough_point: '',
    planned_minutes: 0,
    actual_minutes: 0,
    status: 'planned',
    is_buffer: true,
    note: COPY.weekBufferNote,
  });

  const firstTask = taskEntries[0];
  items.push({
    plan_id: planId('day', now),
    level: 'day',
    start_date: todayIso,
    end_date: todayIso,
    direction: hasOwnTasks ? `先从「${firstTask.title}」开始` : '把最想推进的那一件做起来',
    arrangement: hasOwnTasks
      ? `把「${firstTask.title}」里最想先弄懂的一小段过一遍`
      : `先把${goal}里最想推进的那一件做起来`,
    enough_point: '做到自己定的那一小段就可以停',
    planned_minutes: Math.min(daily, focus),
    actual_minutes: 0,
    status: 'planned',
    is_buffer: false,
    note: '今天状态一般，慢一点也没关系',
  });

  return {
    goal,
    horizon,
    dailyMinutes: daily,
    rhythm: answers.rhythm,
    createdAt: Date.now(),
    weekStart: isoDate(weekStart),
    items,
  };
}

/** 把这一版再放轻一点：留白不动，其余减少一些，不删掉用户的方向。 */
export function lightenPlan(plan: Plan): Plan {
  const items = plan.items.map((item) => {
    if (item.is_buffer || item.pocket || item.level === 'year') return item;
    const next = Math.max(15, Math.round((item.planned_minutes * 0.7) / 5) * 5);
    return {
      ...item,
      planned_minutes: next,
      enough_point: item.enough_point || '做到这一小段就可以停',
      note: item.note || '今天轻一点，也算在走',
    };
  });
  return { ...plan, items };
}

function planWeekEnd(plan: Plan): string {
  return isoDate(addDays(fromIso(plan.weekStart), 6));
}

export function planWeekTotal(plan: Plan): number {
  return weekItems(plan)
    .filter((item) => item.status !== 'let_go')
    .reduce((sum, item) => sum + item.planned_minutes, 0);
}

export function planWeekBuffer(plan: Plan): PlanItem | undefined {
  return plan.items.find((item) => item.level === 'week' && item.is_buffer);
}

/** 只取「这一周」的安排；后面几周留在这份计划里，等走到了再看。 */
export function weekItems(plan: Plan): PlanItem[] {
  const end = planWeekEnd(plan);
  return plan.items
    .filter(
      (item) =>
        item.level === 'week' &&
        !item.is_buffer &&
        !item.pocket &&
        item.start_date >= plan.weekStart &&
        item.start_date <= end,
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export interface PlanWeekGroup {
  start: string;
  items: PlanItem[];
}

/** 按周把事分组，给向导最后那一眼用。 */
export function planWeekGroups(plan: Plan): PlanWeekGroup[] {
  const groups = new Map<string, PlanItem[]>();
  plan.items
    .filter((item) => item.level === 'week' && !item.is_buffer && !item.pocket)
    .forEach((item) => {
      const key = isoDate(startOfWeek(fromIso(item.start_date)));
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, items]) => ({
      start,
      items: items.sort((a, b) => a.start_date.localeCompare(b.start_date)),
    }));
}

/** 这周装不下时，把最晚的一件挪到下周空着的位置，不删掉它。 */
export function moveLastToNextWeek(plan: Plan): Plan {
  const current = weekItems(plan).filter((item) => item.status !== 'let_go');
  if (current.length < 1) return plan;

  const last = current[current.length - 1];
  const nextMonday = addDays(fromIso(plan.weekStart), 7);
  const nextEnd = isoDate(addDays(nextMonday, 6));
  const used = new Set(
    plan.items
      .filter(
        (item) =>
          item.level === 'week' &&
          !item.is_buffer &&
          !item.pocket &&
          item.start_date >= isoDate(nextMonday) &&
          item.start_date <= nextEnd,
      )
      .map((item) => item.start_date),
  );
  const offset = SLOT_OFFSETS.find((slot) => !used.has(isoDate(addDays(nextMonday, slot)))) ?? 5;
  const date = isoDate(addDays(nextMonday, offset));

  return {
    ...plan,
    items: plan.items.map((item) =>
      item.plan_id === last.plan_id ? { ...item, start_date: date, end_date: date } : item,
    ),
  };
}

export function findItem(plan: Plan, level: 'year' | 'month' | 'week' | 'day'): PlanItem | undefined {
  return plan.items.find((item) => item.level === level && !item.is_buffer && !item.pocket);
}
