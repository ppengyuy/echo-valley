import { COPY } from '../copy';
import type { Echo, Plan } from '../types';
import { weekItems } from '../plan/build';
import { cnDate, shortDate } from '../utils/date';

interface CompareViewProps {
  plan: Plan | null;
  echoes: Echo[];
}

export function CompareView({ plan, echoes }: CompareViewProps) {
  const items = plan ? weekItems(plan) : [];
  const active = echoes.filter((echo) => !echo.archived);

  return (
    <div className="compare">
      <p className="compare-note">{COPY.compareNote}</p>
      <div className="compare-grid">
        <section>
          <h3>{COPY.compareLeft}</h3>
          {items.length === 0 ? (
            <p className="compare-empty">{COPY.pathEmpty}</p>
          ) : (
            <ul className="compare-list">
              {items.map((item) => (
                <li key={item.plan_id}>
                  <span className="compare-date">{shortDate(item.start_date)}</span>
                  <span>{item.arrangement}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>{COPY.compareRight}</h3>
          {active.length === 0 ? (
            <p className="compare-empty">{COPY.echoEmpty}</p>
          ) : (
            <ul className="compare-list echoes">
              {active.map((echo) => (
                <li key={echo.id}>
                  <span className="compare-date">{cnDate(echo.createdAt)}</span>
                  <span>{echo.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
