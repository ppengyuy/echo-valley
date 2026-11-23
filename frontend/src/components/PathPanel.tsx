import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COPY } from '../copy';
import type { Plan, PlanItem, PlanStatus } from '../types';
import {
  findItem,
  moveLastToNextWeek,
  planWeekBuffer,
  planWeekTotal,
  weekItems,
} from '../plan/build';
import {
  addItem,
  lightestDay,
  mergeItems,
  moveItem,
  moveOneFromDay,
  pocketItem,
  restoreItem,
  splitItem,
} from '../plan/edit';
import { addDays, formatMinutes, fromIso, isoDate, shortDate, weekdayLabel } from '../utils/date';
import { CandidateTasksModal } from './CandidateTasksModal';
import { Fox } from './Fox';
import { ItemEditor } from './ItemEditor';

interface PathPanelProps {
  plan: Plan | null;
  onOpenWizard: () => void;
  onUpdateItem: (id: string, patch: Partial<PlanItem>) => void;
  onChangePlan: (plan: Plan) => void;
  onExport: () => void;
  onCompare: () => void;
  onTalkAbout: (item: PlanItem) => void;
  onSaveNote?: (text: string) => void;
  onDragState?: (dragging: boolean) => void;
  onItemMoved?: () => void;
  className?: string;
  /** 从溪边石子「垫到路上」带过来的预填任务；每次变化唤起一次编辑卡。 */
  stoneDraft?: { text: string; key: number } | null;
  /** 从 AI 候选条目【捡起来】收进溪滩。 */
  onPickStone?: (text: string) => void;
}

const STATUS_ORDER: PlanStatus[] = ['planned', 'doing', 'rest', 'later', 'let_go'];

export function PathPanel({
  plan,
  onOpenWizard,
  onUpdateItem,
  onChangePlan,
  onExport,
  onCompare,
  onTalkAbout,
  onSaveNote,
  onDragState,
  onItemMoved,
  className = '',
  stoneDraft,
  onPickStone,
}: PathPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [pocketOpen, setPocketOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [weekWag, setWeekWag] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [candidateOpen, setCandidateOpen] = useState(false);
  /** 用户勾选的候选任务，逐条送进编辑卡确认；不自动写入。 */
  const [candidateQueue, setCandidateQueue] = useState<string[]>([]);
  const flashTimer = useRef(0);
  const dragRef = useRef<string | null>(null);
  const lastDragRef = useRef(0);
  const lastStoneDraftKey = useRef(0);

  // 「垫到路上」：石子文字走与 AI 候选相同的预填队列，由用户在编辑卡里自己定日期与时长。
  useEffect(() => {
    if (!stoneDraft || stoneDraft.key === lastStoneDraftKey.current) return;
    lastStoneDraftKey.current = stoneDraft.key;
    if (!plan) return;
    const target = lightestDay(plan, plan.weekStart);
    if (!target) return;
    setSelectedId(null);
    setEditingId(null);
    setNewDate(target);
    setCandidateQueue([stoneDraft.text]);
  }, [stoneDraft, plan]);

  const day = plan ? findItem(plan, 'day') : undefined;
  const footprint = Boolean(day && (day.actual_minutes > 0 || day.status === 'doing'));
  const selected =
    plan?.items.find((item) => item.plan_id === selectedId) ?? day ?? plan?.items.find((item) => !item.pocket);
  const week = plan ? weekItems(plan) : [];
  const buffer = plan ? planWeekBuffer(plan) : undefined;
  const total = plan ? planWeekTotal(plan) : 0;
  const capacity = plan ? plan.dailyMinutes * 6 : 0;
  const full = capacity > 0 && total > capacity;
  const ratio = capacity > 0 ? Math.min(1, total / capacity) : 0;
  const pocket = plan ? plan.items.filter((item) => item.pocket) : [];
  const weekEnd = plan ? isoDate(addDays(fromIso(plan.weekStart), 6)) : '';
  const laterCount = plan
    ? plan.items.filter(
        (item) =>
          item.level === 'week' && !item.is_buffer && !item.pocket && item.start_date > weekEnd,
      ).length
    : 0;
  const editing = plan?.items.find((item) => item.plan_id === editingId);
  const candidateDate = plan ? lightestDay(plan, plan.weekStart) : null;
  const draftDate = newDate ?? (candidateQueue.length > 0 ? candidateDate : null);
  const draft: PlanItem | null =
    plan && draftDate
      ? {
          plan_id: `draft-${draftDate}`,
          level: 'week',
          start_date: draftDate,
          end_date: draftDate,
          direction: '',
          arrangement: candidateQueue.length > 0 ? candidateQueue[0] : '',
          enough_point: '做到这一小段就可以停',
          planned_minutes: Math.min(45, plan.dailyMinutes),
          actual_minutes: 0,
          status: 'planned',
          is_buffer: false,
          pocket: false,
          note: '',
        }
      : null;

  const update = (patch: Partial<PlanItem>) => {
    if (!selected) return;
    onUpdateItem(selected.plan_id, patch);
  };

  const statusForLevel = (level: PlanItem['level']): PlanStatus => {
    if (!plan) return 'planned';
    if (level === 'week') {
      if (week.length === 0) return 'planned';
      if (week.every((item) => item.status === 'let_go')) return 'let_go';
      if (week.some((item) => item.status === 'doing')) return 'doing';
      if (week.every((item) => item.status === 'rest')) return 'rest';
      if (week.every((item) => item.status === 'later')) return 'later';
      return 'planned';
    }
    return findItem(plan, level)?.status ?? 'planned';
  };

  const itemsOn = (iso: string) => week.filter((item) => item.start_date === iso);

  const markFlash = (id: string) => {
    window.clearTimeout(flashTimer.current);
    setFlashId(id);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 900);
  };

  return (
    <section className={`panel path-panel ${className}`} aria-labelledby="path-title">
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            {COPY.path}
          </p>
          <h2 id="path-title">{plan ? '这周走到这里了' : '一起把路标出来'}</h2>
        </div>
        {plan ? (
          <div className="path-head-actions">
            <button
              type="button"
              className="text-button small"
              onClick={() => setCandidateOpen(true)}
              title={COPY.candidateEntry.hint}
            >
              {COPY.candidateEntry.button}
            </button>
            <button
              type="button"
              className="text-button small"
              onClick={onExport}
              title={COPY.exportHover}
            >
              带走计划
            </button>
            <button type="button" className="text-button small" onClick={onOpenWizard}>
              重新标一遍
            </button>
          </div>
        ) : null}
      </div>

      {plan ? (
        <>
          <div className="path-summary">
            <p className="path-goal">
              <span>{COPY.planLabels.goal}</span>
              <strong>{plan.goal}</strong>
            </p>
            <p className="path-meta">
              大概走到 {plan.horizon} · 这周安排了 {formatMinutes(total)}
              {buffer ? ' · 留了一格给生活' : ''}
            </p>
            {footprint ? (
              <p className="footprint is-done">{COPY.footprintDone}</p>
            ) : day ? (
              <button
                type="button"
                className="footprint footprint-action"
                onClick={() => onUpdateItem(day.plan_id, { status: 'doing' })}
              >
                今天走到这里
              </button>
            ) : (
              <p className="footprint">{COPY.footprintNone}</p>
            )}
          </div>

          <div className="path-map" aria-label="山间小路的路标">
            <svg className="path-line" viewBox="0 0 360 200" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M42 178 C 76 156, 96 150, 120 138 S 170 114, 196 102 S 252 72, 268 52 S 300 26, 322 20"
                fill="none"
                stroke="var(--path-line)"
                strokeWidth="1.1"
                strokeDasharray="4 6"
                strokeLinecap="round"
              />
              <circle cx="322" cy="20" r="3.4" fill="var(--path-line)" />
            </svg>
            {footprint ? (
              <>
                <svg className="path-paw" viewBox="0 0 24 24" aria-hidden="true">
                  <ellipse cx="12" cy="15.6" rx="5.1" ry="4" fill="currentColor" />
                  <circle cx="5.4" cy="9.4" r="1.7" fill="currentColor" />
                  <circle cx="9.4" cy="6.2" r="1.7" fill="currentColor" />
                  <circle cx="14.6" cy="6.2" r="1.7" fill="currentColor" />
                  <circle cx="18.6" cy="9.4" r="1.7" fill="currentColor" />
                </svg>
                {day?.note ? <span className="path-paw-dot" aria-hidden="true" /> : null}
              </>
            ) : null}
            <span className="peak-label">
              <span aria-hidden="true">山巅</span>
              {plan.goal}
            </span>
            {(['year', 'month', 'week', 'day'] as const).map((level) => {
              const item = findItem(plan, level);
              if (!item) return null;
              return (
                <button
                  key={level}
                  type="button"
                  className={`path-node node-${level} node-state-${statusForLevel(level)} ${
                    selected?.plan_id === item.plan_id ? 'is-on' : ''
                  }`}
                  onClick={() => {
                    setEditingId(null);
                    setNewDate(null);
                    setSelectedId(item.plan_id);
                  }}
                  aria-label={`${COPY.planLevel[level]}：${item.direction}`}
                >
                  <span className="node-dot" aria-hidden="true" />
                  <span className="node-label">{COPY.planLevel[level]}</span>
                  <span className="node-preview" aria-hidden="true">
                    <strong>{item.direction || item.arrangement}</strong>
                    <span>大概 {formatMinutes(item.planned_minutes)}</span>
                    <span>{COPY.planStatus[item.status]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {plan && (editing || draft) ? (
            <ItemEditor
              key={
                editing
                  ? editing.plan_id
                  : `new-${draftDate}-${candidateQueue.length}-${stoneDraft?.key ?? 0}-${lastStoneDraftKey.current}`
              }
              item={(editing ?? draft) as PlanItem}
              plan={plan}
              isNew={!editing}
              onClose={() => {
                setEditingId(null);
                setNewDate(null);
                setCandidateQueue([]);
              }}
              onCreate={(item) => {
                onChangePlan(addItem(plan, item));
                markFlash(item.plan_id);
                if (candidateQueue.length > 1) {
                  // 还有下一件：保留草稿打开状态，只消费队首。
                  setCandidateQueue((queue) => queue.slice(1));
                } else {
                  setNewDate(null);
                  setCandidateQueue([]);
                }
              }}
              onPatch={(patch) => {
                if (editing) onUpdateItem(editing.plan_id, patch);
              }}
              onMove={(iso) => {
                if (editing) onUpdateItem(editing.plan_id, { start_date: iso, end_date: iso });
              }}
              onSplit={() => {
                if (editing) onChangePlan(splitItem(plan, editing.plan_id));
                setEditingId(null);
              }}
              onMerge={(otherId) => {
                if (editing) onChangePlan(mergeItems(plan, editing.plan_id, otherId));
                setEditingId(null);
              }}
              onPocket={() => {
                if (editing) onChangePlan(pocketItem(plan, editing.plan_id));
                setEditingId(null);
                setSelectedId(null);
              }}
            />
          ) : selected ? (
            <div className="node-detail">
              <p className="node-note">{COPY.nodeNote}</p>
              <div className="node-detail-head">
                <h3>
                  {COPY.planLevel[selected.level]} · {selected.direction}
                </h3>
                <span className={`status-pill status-${selected.status}`}>
                  {COPY.planStatus[selected.status]}
                </span>
              </div>
              <p className="node-start">
                {COPY.planLevel[selected.level]}・先从「{selected.arrangement}」开始
              </p>
              <div className="node-modules">
                <section className="node-module">
                  <h4 className="node-module-title">任务安排</h4>
                  <dl className="node-fields">
                    <div>
                      <dt>具体安排</dt>
                      <dd>{selected.arrangement}</dd>
                    </div>
                    <div>
                      <dt>{COPY.planLabels.planned}</dt>
                      <dd>{formatMinutes(selected.planned_minutes)}</dd>
                    </div>
                    <div>
                      <dt>{COPY.planLabels.enough}</dt>
                      <dd>{selected.enough_point || COPY.planLabels.noEnough}</dd>
                    </div>
                  </dl>
                </section>
                <section className="node-module">
                  <h4 className="node-module-title">进度记录</h4>
                  <dl className="node-fields">
                    <div>
                      <dt>{COPY.planLabels.actual}</dt>
                      <dd className="inline-input">
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={selected.actual_minutes}
                          aria-label="实际投入的分钟"
                          onChange={(event) =>
                            update({ actual_minutes: Math.max(0, Number(event.target.value) || 0) })
                          }
                        />
                        <span>分钟</span>
                      </dd>
                    </div>
                    <div>
                      <dt>{COPY.planLabels.status}</dt>
                      <dd>
                        <select
                          className={`status-select status-${selected.status}`}
                          value={selected.status}
                          aria-label="现在的状态"
                          onChange={(event) => update({ status: event.target.value as PlanStatus })}
                        >
                          {STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {COPY.planStatus[status]}
                            </option>
                          ))}
                        </select>
                        <span className="status-hint">{COPY.planStatusHint[selected.status]}</span>
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="node-module">
                  <h4 className="node-module-title">自留独白</h4>
                  <div className="module-note">
                    <p className="module-note-label">{COPY.planLabels.note}</p>
                    <textarea
                      className="note-input"
                      value={selected.note ?? ''}
                      rows={2}
                      placeholder="想对自己说的话"
                      onChange={(event) => update({ note: event.target.value })}
                    />
                    {selected.note?.trim() ? (
                      <button
                        type="button"
                        className="text-button small"
                        onClick={() => onSaveNote?.(selected.note!.trim())}
                      >
                        把这句话存为回音
                      </button>
                    ) : (
                      <span className="status-hint">存不存，都由你决定。</span>
                    )}
                  </div>
                </section>
              </div>
              <div className="node-detail-actions">
                <button
                  type="button"
                  className="text-button small"
                  onClick={() => setEditingId(selected.plan_id)}
                >
                  改一改这一件
                </button>
                <button type="button" className="text-button small" onClick={() => onTalkAbout(selected)}>
                  回到对话里聊聊它
                </button>
              </div>
            </div>
          ) : null}

          <div className="week-block">
            <div className="week-head">
              <h3>
                <Fox className="week-fox" tracking={dragging} wagKey={weekWag} />
                {COPY.planLabels.week} · {shortDate(plan.weekStart)} — {shortDate(weekEnd)}
              </h3>
              <span>{formatMinutes(total)}</span>
            </div>

            <div className={`capacity ${full ? 'is-full' : ''}`}>
              <p className="capacity-lead">走过的小路</p>
              <div className="capacity-bar" aria-hidden="true">
                <span style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="capacity-text">
                {total === 0
                  ? '这周还没排什么，慢慢来。'
                  : full
                    ? `这周排了 ${formatMinutes(total)}，比大概能装的 ${formatMinutes(capacity)} 多了一点，要不要先挪一件到下周。`
                    : `这周排了 ${formatMinutes(total)}，还有余地。`}
              </p>
              {full ? (
                <button
                  type="button"
                  className="text-button small"
                  onClick={() => onChangePlan(moveLastToNextWeek(plan))}
                >
                  挪一件到下周
                </button>
              ) : null}
            </div>

            <div className="week-grid">
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDays(fromIso(plan.weekStart), index);
                const iso = isoDate(date);
                const items = itemsOn(iso);
                const active = items.filter((item) => item.status !== 'let_go');
                const daySum = active.reduce((sum, item) => sum + item.planned_minutes, 0);
                const dayOver = plan.dailyMinutes > 0 && daySum > plan.dailyMinutes;
                const target = dayOver ? lightestDay(plan, iso) : null;
                return (
                  <div
                    key={iso}
                    style={{ '--row-index': index } as CSSProperties}
                    className={`week-row ${items.length ? 'has-item' : ''} ${
                      dropTarget === iso ? 'is-drop' : ''
                    } ${dayOver ? 'is-full' : ''} ${
                      items.some((item) => item.plan_id === flashId) ? 'is-flash' : ''
                    }`}
                    onDragOver={(event) => {
                      if (!dragRef.current) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropTarget(iso);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const id = event.dataTransfer.getData('text/plain') || dragRef.current;
                      if (id) onChangePlan(moveItem(plan, id, iso));
                      dragRef.current = null;
                      setDropTarget(null);
                      setDragging(false);
                      onDragState?.(false);
                      onItemMoved?.();
                      setWeekWag((value) => value + 1);
                    }}
                  >
                    <span className="week-date">
                      {COPY.planWeekDays[index]}
                      <em>{shortDate(iso)}</em>
                    </span>
                    <div className="week-tasks">
                      {items.length === 0 ? (
                        <button
                          type="button"
                          className="week-empty week-empty-add"
                          aria-label={`往${COPY.planWeekDays[index]}放一件事`}
                          onClick={() => {
                            setEditingId(null);
                            setNewDate(iso);
                          }}
                        >
                          <span className="empty-dot" aria-hidden="true" /> 这一格可以先空着
                        </button>
                      ) : (
                        items.map((item) => (
                          <div className={`week-task-row ${item.status === 'let_go' ? 'is-let-go' : ''}`} key={item.plan_id}>
                            <button
                              type="button"
                              className="week-task"
                              draggable
                              onDragStart={(event) => {
                                dragRef.current = item.plan_id;
                                setDragging(true);
                                onDragState?.(true);
                                event.dataTransfer.setData('text/plain', item.plan_id);
                                event.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => {
                                lastDragRef.current = Date.now();
                                dragRef.current = null;
                                setDropTarget(null);
                                setDragging(false);
                                onDragState?.(false);
                              }}
                              onClick={() => {
                                if (Date.now() - lastDragRef.current < 300) return;
                                setSelectedId(item.plan_id);
                                setNewDate(null);
                                setEditingId(item.plan_id);
                              }}
                            >
                              <span className={`week-dot status-${item.status}`} aria-hidden="true" />
                              <span className="week-task-name">{item.arrangement}</span>
                            </button>
                            <select
                              className={`status-select compact status-${item.status}`}
                              value={item.status}
                              aria-label={`${COPY.planWeekDays[index]}的状态`}
                              onChange={(event) =>
                                onUpdateItem(item.plan_id, { status: event.target.value as PlanStatus })
                              }
                            >
                              {STATUS_ORDER.map((status) => (
                                <option key={status} value={status}>
                                  {COPY.planStatus[status]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                    <span className="week-minutes">{daySum ? formatMinutes(daySum) : ''}</span>
                    {dayOver ? (
                      active.length > 1 && target ? (
                        <button
                          type="button"
                          className="day-full"
                          onClick={() => onChangePlan(moveOneFromDay(plan, iso))}
                        >
                          这天有点满，挪一件到{weekdayLabel(fromIso(target))}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="day-full"
                          onClick={() => setEditingId(active[0].plan_id)}
                        >
                          这天有点满，点开调短一点
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
              {buffer ? (
                <div className="week-row buffer-row">
                  <span className="week-date">{COPY.weekBufferLabel}</span>
                  <span className="week-task buffer-text">{COPY.weekBufferText}</span>
                  <span className="buffer-note">{COPY.weekBufferNote}</span>
                </div>
              ) : null}
            </div>
            <div className="path-footer">
              <p>
                {shortDate(plan.weekStart)} — {shortDate(weekEnd)}
                {capacity > 0
                  ? ` · 这周大概能装 ${formatMinutes(capacity)}，排了 ${formatMinutes(total)}`
                  : ''}
              </p>
              {laterCount > 0 ? <p>后面几周还有 {laterCount} 件，先放在路上了。</p> : null}
              <p>{week.length} 件想推进的事，留白也可以。卡片可以直接拖到别的日子，点开就能改时间。</p>
            </div>
          </div>

          {pocket.length > 0 ? (
            <div className="pocket-block">
              <button
                type="button"
                className="text-button small"
                onClick={() => setPocketOpen((open) => !open)}
              >
                口袋里放着几件，{pocketOpen ? '先收起来' : '看看'}
              </button>
              {pocketOpen ? (
                <div className="pocket-list">
                  {pocket.map((item) => (
                    <div className="pocket-row" key={item.plan_id}>
                      <span>{item.arrangement}</span>
                      <button
                        type="button"
                        className="text-button small"
                        onClick={() => onChangePlan(restoreItem(plan, item.plan_id))}
                      >
                        取回
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="path-actions">
            <button type="button" className="button primary" onClick={onExport} title={COPY.exportHover}>
              把这份计划带走
            </button>
            <button type="button" className="button ghost" onClick={onCompare}>
              这周的路与回音
            </button>
            <p className="path-export-note">{COPY.exportNote}</p>
          </div>
        </>
      ) : (
        <div className="path-empty">
          <div className="path-empty-art" aria-hidden="true">
            <svg viewBox="0 0 320 180" preserveAspectRatio="none">
              <path
                d="M28 154 C 72 142, 94 120, 132 112 S 206 92, 236 66 S 282 38, 294 26"
                fill="none"
                stroke="var(--path-line)"
                strokeWidth="1"
                strokeDasharray="3 7"
              />
              <circle cx="294" cy="26" r="2.6" fill="var(--path-line)" />
            </svg>
            <Fox className="empty-fox" />
          </div>
          <p>{COPY.pathEmpty}</p>
          <button type="button" className="button primary" onClick={onOpenWizard}>
            {COPY.planWizard.start}
          </button>
          <p className="empty-hint">
            不会一次排满。先知道你大概想往哪走，再一起把这一周轻轻放下。
          </p>
          <button type="button" className="text-button" onClick={onExport}>
            先看看可以带走什么
          </button>
        </div>
      )}

      <CandidateTasksModal
        open={candidateOpen}
        goal={plan?.goal ?? ''}
        onClose={() => setCandidateOpen(false)}
        onConfirm={(names) => {
          setCandidateOpen(false);
          setEditingId(null);
          setNewDate(null);
          setCandidateQueue(names);
        }}
        onPickStone={onPickStone}
      />
    </section>
  );
}
