import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { generateCandidates } from '../agent/candidates';
import { COPY } from '../copy';
import type { Plan, PlanItem, PlanStatus } from '../types';
import { dayTotal } from '../plan/edit';
import { addDays, formatMinutes, fromIso, isoDate, shortDate } from '../utils/date';

interface ItemEditorProps {
  item: PlanItem;
  plan: Plan;
  isNew?: boolean;
  onClose: () => void;
  onCreate?: (item: PlanItem) => void;
  onPatch: (patch: Partial<PlanItem>) => void;
  onMove: (iso: string) => void;
  onSplit: () => void;
  onMerge: (otherId: string) => void;
  onPocket: () => void;
}

const STATUS_ORDER: PlanStatus[] = ['planned', 'doing', 'rest', 'later', 'let_go'];
const MINUTE_CHIPS = [15, 30, 45, 60, 90, 120];

export function ItemEditor({
  item,
  plan,
  isNew = false,
  onClose,
  onCreate,
  onPatch,
  onMove,
  onSplit,
  onMerge,
  onPocket,
}: ItemEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const isHeadline = item.level === 'year' || item.level === 'month';
  const isWeek = item.level === 'week';

  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(
    null,
  );
  const [closing, setClosing] = useState(false);

  const [name, setName] = useState(isHeadline ? item.direction : item.arrangement);
  const [enough, setEnough] = useState(item.enough_point ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [minutes, setMinutes] = useState(item.planned_minutes);
  const [status, setStatus] = useState<PlanStatus>(item.status);
  const [date, setDate] = useState(item.start_date);
  const [confirmLetGo, setConfirmLetGo] = useState(false);
  const [confirmPocket, setConfirmPocket] = useState(false);
  const [merging, setMerging] = useState(false);
  /** 「参考一点经验」：与小路面板同一个生成器，结果只是备选，点了才填进名称。 */
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaItems, setIdeaItems] = useState<string[]>([]);
  const ideaLoadedFor = useRef('');
  /** 这一轮已经给过的条目，换一批时避开。 */
  const ideaSeen = useRef<string[]>([]);

  const loadIdeas = async () => {
    if (ideaLoading) return;
    setIdeaOpen(true);
    if (ideaItems.length && ideaLoadedFor.current === plan.goal) return;
    setIdeaLoading(true);
    const result = await generateCandidates(plan.goal);
    ideaLoadedFor.current = plan.goal;
    ideaSeen.current = result.items;
    setIdeaItems(result.items);
    setIdeaLoading(false);
  };

  /** 换一批：避开已给过的，这里不做阶段分组，保持编辑卡简单。 */
  const nextIdeas = async () => {
    if (ideaLoading) return;
    setIdeaLoading(true);
    const result = await generateCandidates(plan.goal, { exclude: ideaSeen.current });
    ideaSeen.current = Array.from(new Set([...ideaSeen.current, ...result.items]));
    setIdeaItems(result.items);
    setIdeaLoading(false);
  };

  // 只在山间小路卡片内展开，不盖住右边的回音谷。
  useLayoutEffect(() => {
    const measure = () => {
      const host = document.querySelector('.path-panel');
      if (!host) return;
      const rect = host.getBoundingClientRect();
      setBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const requestClose = () => {
    window.clearTimeout(closeTimer.current);
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onClose(), 260);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const weekEnd = isoDate(addDays(fromIso(plan.weekStart), 6));
  const inThisWeek = date >= plan.weekStart && date <= weekEnd;
  const baseTotal = isWeek ? dayTotal(plan, date) : 0;
  const total = isWeek ? baseTotal + (isNew ? minutes : 0) : 0;
  const over = isWeek && total > plan.dailyMinutes;

  const mergeCandidates = isNew
    ? []
    : plan.items
        .filter(
          (entry) =>
            entry.level === 'week' &&
            !entry.is_buffer &&
            !entry.pocket &&
            entry.plan_id !== item.plan_id,
        )
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 6);

  const commitName = () => {
    const next = name.trim();
    if (!next) {
      if (!isNew) setName(isHeadline ? item.direction : item.arrangement);
      return;
    }
    setName(next);
    if (isNew) return;
    if (isHeadline) onPatch({ direction: next });
    else if (isWeek) onPatch({ arrangement: next, direction: `先动「${next}」这一件` });
    else onPatch({ arrangement: next, direction: `先从「${next}」开始` });
  };

  const commitEnough = () => {
    if (!isNew && enough !== (item.enough_point ?? '')) onPatch({ enough_point: enough });
  };

  const commitNote = () => {
    if (!isNew && note !== (item.note ?? '')) onPatch({ note });
  };

  const commitMinutes = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(600, Math.round(value)));
    setMinutes(next);
    if (!isNew) onPatch({ planned_minutes: next });
  };

  const applyStatus = (next: PlanStatus) => {
    setStatus(next);
    if (!isNew) onPatch({ status: next });
  };

  const applyDate = (iso: string) => {
    if (!iso) return;
    setDate(iso);
    if (!isNew) onMove(iso);
  };

  const save = () => {
    if (isNew) {
      const title = name.trim();
      if (!title || !onCreate) return;
      onCreate({
        ...item,
        arrangement: title,
        direction: `先动「${title}」这一件`,
        planned_minutes: minutes,
        start_date: date,
        end_date: date,
        status,
        enough_point: enough,
        note,
      });
    }
    requestClose();
  };

  const canSave = !isNew || name.trim().length > 0;

  if (!box) return null;

  return createPortal(
    <div
      className={`item-editor-layer ${closing ? 'is-closing' : ''}`}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <div className="item-editor" role="dialog" aria-label="往这一格放一件事" ref={rootRef}>
      <div className="item-editor-head">
        <div>
          <p className="item-editor-kicker">{isNew ? '这一格' : COPY.planLabels.detail}</p>
          <h3>{isNew ? '往这一格放一件事' : isWeek ? '改一改这件事' : '改一改这个节点'}</h3>
        </div>
        <button type="button" className="icon-button" onClick={requestClose} aria-label="先收起来">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <label className="editor-field">
        <span>这件事叫什么</span>
        <input
          className="editor-input"
          value={name}
          autoFocus={isNew}
          placeholder={isNew ? '比如：背完一轮单词' : undefined}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {isNew && !name.trim() ? (
          <span className="editor-required-hint">写一句就好，不用很准确。</span>
        ) : null}
      </label>

      {/* 想不出写什么时，看看别人常做的几件小事；挑了才填进去，不自动写入。 */}
      <div className="editor-field editor-idea">
        {!ideaOpen ? (
          <button
            type="button"
            className="editor-idea-entry"
            title={COPY.candidateEntry.hint}
            onClick={loadIdeas}
          >
            {COPY.candidateEntry.button}
          </button>
        ) : (
          <div className="editor-idea-box">
            {ideaLoading ? (
              <p className="editor-idea-loading">{COPY.candidate.loading}</p>
            ) : (
              <>
                <div className="editor-idea-head">
                  <span>{COPY.candidateEntry.hint}</span>
                  <button
                    type="button"
                    className="text-button small"
                    onClick={() => setIdeaOpen(false)}
                  >
                    先不看了
                  </button>
                </div>
                <div className="editor-idea-list">
                  {ideaItems.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`editor-idea-chip ${name === item ? 'is-on' : ''}`}
                      onClick={() => {
                        setName(item);
                        if (!isNew) {
                          if (isHeadline) onPatch({ direction: item });
                          else if (isWeek)
                            onPatch({ arrangement: item, direction: `先动「${item}」这一件` });
                          else onPatch({ arrangement: item, direction: `先从「${item}」开始` });
                        }
                        setIdeaOpen(false);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button type="button" className="text-button small" onClick={nextIdeas}>
                  {COPY.candidate.next}
                </button>
                <p className="editor-idea-note">{COPY.candidate.note}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="editor-field">
        <span>大概花多久</span>
        <div className="editor-chips">
          {MINUTE_CHIPS.map((value) => (
            <button
              key={value}
              type="button"
              className={`editor-chip ${minutes === value ? 'is-on' : ''}`}
              onClick={() => commitMinutes(value)}
            >
              {value} 分钟
            </button>
          ))}
        </div>
        <div className="editor-minutes">
          <input
            type="number"
            min={0}
            max={600}
            step={5}
            value={minutes}
            onChange={(event) => commitMinutes(Number(event.target.value))}
            aria-label="大概花多少分钟"
          />
          <span>分钟</span>
        </div>
      </div>

      {isWeek ? (
        <label className="editor-field">
          <span>{isNew ? '放在哪天' : '挪到哪天'}</span>
          <input
            type="date"
            className="editor-input"
            value={date}
            min={plan.weekStart}
            onChange={(event) => applyDate(event.target.value)}
          />
          <span className="editor-hint">也可以直接把这一周的卡片拖到别的日子。</span>
          {!inThisWeek ? (
            <span className="editor-hint">不在这一周了，会先出现在后面的路上。</span>
          ) : null}
        </label>
      ) : null}

      <label className="editor-field">
        <span>{COPY.planLabels.enough}</span>
        <textarea
          className="editor-textarea"
          value={enough}
          rows={2}
          placeholder="比如：看完这一节就可以停"
          onChange={(event) => setEnough(event.target.value)}
          onBlur={commitEnough}
        />
      </label>

      <div className="editor-field">
        <span>{COPY.planLabels.status}</span>
        <div className="editor-status">
          {STATUS_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              className={`editor-status-button status-${option} ${
                status === option ? 'is-on' : ''
              }`}
              onClick={() => {
                if (option === 'let_go') {
                  setConfirmLetGo(true);
                  setConfirmPocket(false);
                  return;
                }
                applyStatus(option);
              }}
            >
              {COPY.planStatus[option]}
            </button>
          ))}
        </div>
        <span className="editor-hint">{COPY.planStatusHint[status]}</span>
        {confirmLetGo ? (
          <div className="editor-confirm">
            <p>这件先不走了，这块平石会摊平（压扁、转灰），随时能回来改。</p>
            <div className="editor-confirm-actions">
              <button
                type="button"
                className="button ghost small"
                onClick={() => {
                  applyStatus('let_go');
                  setConfirmLetGo(false);
                }}
              >
                就这样
              </button>
              <button type="button" className="text-button small" onClick={() => setConfirmLetGo(false)}>
                再想想
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <label className="editor-field">
        <span>加一句话（可选）</span>
        <textarea
          className="editor-textarea"
          value={note}
          rows={2}
          placeholder="想对自己说的，或者留一条回音"
          onChange={(event) => setNote(event.target.value)}
          onBlur={commitNote}
        />
      </label>

      {isWeek ? (
        <p className={`editor-capacity ${over ? 'is-full' : ''}`}>
          这天现在放了 {formatMinutes(total)}，你说一天大概能留出 {formatMinutes(plan.dailyMinutes)}。
          {over ? ' 这天有点满。' : ' 还装得下。'}
        </p>
      ) : null}
      {!isNew && status === 'let_go' ? (
        <p className="editor-hint">这件已经放下了，先不占这周的容量；想捡回来，随时改回来。</p>
      ) : null}

      {!isNew && isWeek ? (
        <div className="editor-actions">
          <button type="button" className="text-button small" onClick={onSplit}>
            拆开
          </button>
          <button type="button" className="text-button small" onClick={() => setMerging((value) => !value)}>
            和另一件合并
          </button>
          <button
            type="button"
            className="text-button small"
            onClick={() => {
              setConfirmPocket(true);
              setConfirmLetGo(false);
            }}
          >
            先放一放
          </button>
        </div>
      ) : null}

      {merging ? (
        <div className="editor-merge">
          <p>和哪一件并在一起？</p>
          {mergeCandidates.length === 0 ? (
            <p className="editor-hint">这一版里还没有另一件可以合并。</p>
          ) : (
            <div className="editor-merge-list">
              {mergeCandidates.map((candidate) => (
                <button
                  key={candidate.plan_id}
                  type="button"
                  onClick={() => onMerge(candidate.plan_id)}
                >
                  <span>{shortDate(candidate.start_date)}</span>
                  {candidate.arrangement}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {confirmPocket ? (
        <div className="editor-confirm">
          <p>这件先不走了，放到口袋里，随时能取回。</p>
          <div className="editor-confirm-actions">
            <button
              type="button"
              className="button ghost small"
              onClick={() => {
                setConfirmPocket(false);
                onPocket();
              }}
            >
              放进口袋
            </button>
            <button type="button" className="text-button small" onClick={() => setConfirmPocket(false)}>
              再想想
            </button>
          </div>
        </div>
      ) : null}

      <div className="item-editor-foot">
        <button type="button" className="button primary small" disabled={!canSave} onClick={save}>
          {isNew ? '放进这一格' : '好了'}
        </button>
      </div>
      </div>
    </div>,
    document.body,
  );
}
