import { buildPlan } from '../plan/build';
import type { Echo, Plan } from '../types';
import { uid } from '../utils/date';

const day = 24 * 60 * 60 * 1000;

export function demoEchoes(): Echo[] {
  return [
    {
      id: uid('echo'),
      text: '我害怕努力没有回报。',
      createdAt: Date.now() - 3 * day,
      tag: '备考',
    },
    {
      id: uid('echo'),
      text: '我是不是不适合考研。',
      createdAt: Date.now() - 7 * day,
      tag: '自我怀疑',
    },
  ];
}

export function demoPlan(): Plan {
  const base = buildPlan({
    goal: '考研',
    horizon: '明年六月',
    dailyMinutes: 120,
    rhythm: '45 分钟',
  });

  const items = base.items.map((item) => {
    if (item.level === 'year') {
      return {
        ...item,
        direction: '把专业课基础慢慢打稳',
        arrangement: '上半年跟着课程走，下半年做专题梳理',
        planned_minutes: 36000,
        actual_minutes: 8400,
        status: 'doing' as const,
        note: '年末再回来看看',
      };
    }
    if (item.level === 'month') {
      return {
        ...item,
        direction: '把专业课第一轮过完',
        arrangement: '每周整理两章笔记，周末回看一次',
        planned_minutes: 4800,
        actual_minutes: 1200,
        status: 'doing' as const,
      };
    }
    if (item.is_buffer) return item;
    if (item.level === 'week') {
      if (item.plan_id.endsWith('-01')) {
        return {
          ...item,
          arrangement: '读专业课第三章，写三条自己的话',
          enough_point: '读完这一章就可以停',
          planned_minutes: 60,
          actual_minutes: 40,
          status: 'doing' as const,
          note: '慢一点也算在走',
        };
      }
      if (item.plan_id.endsWith('-02')) {
        return {
          ...item,
          arrangement: '把第三章的框架画一遍',
          enough_point: '画完框架就可以停',
          planned_minutes: 45,
          actual_minutes: 0,
          status: 'rest' as const,
          note: '今天先歇一会儿',
        };
      }
      return item;
    }
    if (item.level === 'day') {
      return {
        ...item,
        direction: '把第三章的思路理顺',
        arrangement: '先看一遍，再写三条自己的话',
        enough_point: '看完第一节就可以停',
        planned_minutes: 60,
        actual_minutes: 0,
        status: 'planned' as const,
        note: '今天状态一般，慢一点也没关系',
      };
    }
    return item;
  });

  return { ...base, items };
}
