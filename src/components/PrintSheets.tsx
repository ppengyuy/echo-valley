import { COPY, FOOTER_SHORT, PRINT_HINTS } from '../copy';
import type { Plan } from '../types';
import { addDays, cnDate, fromIso, weekdayLabel } from '../utils/date';
import { findItem, weekItems } from '../plan/build';

const line = '________________________________';

function PrintFooter({ page, hints }: { page: number; hints: string[] }) {
  return (
    <footer className="print-footer">
      <div className="print-hints">
        {hints.map((hint) => (
          <p key={hint}>{hint}</p>
        ))}
      </div>
      <p className="print-disclaimer">{FOOTER_SHORT}</p>
      <p className="print-page">
        第 {page} 页 / 共 3 页
      </p>
    </footer>
  );
}

export function PrintSheets({ plan }: { plan: Plan | null }) {
  const now = new Date();
  const year = plan ? findItem(plan, 'year') : undefined;
  const month = plan ? findItem(plan, 'month') : undefined;
  const day = plan ? findItem(plan, 'day') : undefined;
  const week = plan ? weekItems(plan) : [];
  const weekStart = plan ? fromIso(plan.weekStart) : now;
  const weekEnd = addDays(weekStart, 6);
  const buffer = plan?.items.find((item) => item.level === 'week' && item.is_buffer);

  const three = [0, 1, 2].map((index) => week[index]);

  return (
    <div className="print-root" aria-hidden="true">
      <section className="print-sheet">
        <header className="print-kicker">回音谷 · 我的山间小路 / 手写版</header>
        <h1>这一年 / 这个月</h1>
        <div className="print-block">
          <h2>这一年 / 这个月，想靠近的方向</h2>
          <p>
            年份 / 月份：
            {plan ? `${now.getFullYear()} 年 / ${now.getMonth() + 1} 月` : line}
          </p>
          <p>想靠近的方向：{year?.direction ?? line}</p>
          <p>路上想经过的几站：</p>
          <p className="print-indent">1. {month?.direction ?? line}</p>
          <p className="print-indent">2. {week[0]?.arrangement ?? line}</p>
          <p className="print-indent">3. {week[1]?.arrangement ?? line}</p>
          <p>
            大致节奏：
            {plan ? `${plan.rhythm}专注，一天约 ${Math.round(plan.dailyMinutes / 60)} 小时` : line}
          </p>
          <p>留给生活的空白：{buffer ? '每周留一格给生活' : line}</p>
        </div>
        <div className="print-blank-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <PrintFooter page={1} hints={[PRINT_HINTS[0], PRINT_HINTS[6]]} />
      </section>

      <section className="print-sheet">
        <header className="print-kicker">回音谷 · 我的山间小路 / 手写版</header>
        <h1>
          这一周 · {cnDate(weekStart)} — {cnDate(weekEnd)}
        </h1>
        <div className="print-block">
          <p>这周想去的方向：{week[0]?.direction ?? line}</p>
        </div>

        <div className="print-block">
          <h2>这周想推进的三件事</h2>
          {three.map((item, index) => (
            <div className="print-task" key={item?.plan_id ?? index}>
              <p>
                {index + 1}. {item?.arrangement ?? line}
              </p>
              <p className="print-task-meta">
                大概花多久：{item ? `${item.planned_minutes}` : '____'} 分钟
                <span>做到哪里就可以停：{item?.enough_point || '________________'}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="print-buffer">
          <h3>本周留白</h3>
          <p>这一格不安排事情，留给生活。</p>
          <p>可以休息、发呆、补一补，</p>
          <p>也可以什么都不做。</p>
          <p>用上了很好，空着也很好。</p>
        </div>

        <div className="print-block print-reflect">
          <p>这一周，有哪一刻你觉得自己在往前走？{line}</p>
          <p>想对自己说的一句话：{line}</p>
        </div>

        <PrintFooter
          page={2}
          hints={[PRINT_HINTS[1], PRINT_HINTS[2], PRINT_HINTS[3]]}
        />
      </section>

      <section className="print-sheet">
        <header className="print-kicker">回音谷 · 我的山间小路 / 手写版</header>
        <h1>今天 · {cnDate(now)}</h1>
        <div className="print-block print-today">
          <p className="print-lead">今天最想推进的一件事：</p>
          <p className="print-answer">{day?.arrangement ?? line}</p>
          <p>大概花多久：{day ? `${day.planned_minutes}` : '________'} 分钟</p>
          <p>做到哪里就可以停：{day?.enough_point || '________________________'}</p>
          <p className="print-lead">今天的状态（圈一个）：</p>
          <p className="print-circles">○ 有精神　　○ 一般　　○ 有点累　　○ 先歇一会儿</p>
          <p className="print-lead">今天想留给自己的话：</p>
          <div className="print-hand-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="print-weekday-mini">
          <p>
            {COPY.planWeekDays.join('　　')}
          </p>
          <p className="print-mini-note">{weekdayLabel(now)}，今天这一格，按自己的节奏来。</p>
        </div>
        <PrintFooter page={3} hints={[PRINT_HINTS[5], PRINT_HINTS[7]]} />
      </section>
    </div>
  );
}
