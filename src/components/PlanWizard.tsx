import { useEffect, useMemo, useRef, useState } from 'react';
import { generateCandidates } from '../agent/candidates';
import { COPY } from '../copy';
import type { Plan, PlanItem } from '../types';
import {
  buildPlan,
  horizonDays,
  lightenPlan,
  moveLastToNextWeek,
  parseTasks,
  planWeekGroups,
  planWeekTotal,
  weekItems,
  type PlanAnswers,
} from '../plan/build';
import { formatHours, formatMinutes, fromIso, planId, shortDate, weekdayLabel } from '../utils/date';
import { Fox } from './Fox';
import { Modal } from './Modal';
import SplitText from '../motion/SplitText.jsx';
import JellyRadio from '../motion/JellyRadio.jsx';

interface PlanWizardProps {
  open: boolean;
  plan: Plan | null;
  onClose: () => void;
  onPlan: (plan: Plan) => void;
  onUpdatePlan: (plan: Plan) => void;
}

const totalSteps = 5;

const stepQuestions = [
  COPY.planWizard.q1,
  COPY.planWizard.q2,
  COPY.planWizard.q3,
  COPY.planWizard.q4,
  COPY.planWizard.q5,
];
const stepHints = [
  COPY.planWizard.q1Hint,
  COPY.planWizard.q2Hint,
  COPY.planWizard.q3Hint,
  COPY.planWizard.q4Hint,
  COPY.planWizard.q5Hint,
];
const stepChips = [
  COPY.planWizard.q1Chips,
  COPY.planWizard.q2Chips,
  COPY.planWizard.q3Chips,
  COPY.planWizard.q4Chips,
  COPY.planWizard.q5Chips,
];

const dailyMap: Record<string, number> = {
  '1 小时': 60,
  '2 小时': 120,
  '3 小时': 180,
  '4 小时': 240,
  说不准: 120,
};

function parseDaily(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return dailyMap[value] ?? 120;
  const number = Number(match[1]);
  const asHours = value.includes('小时') || (!value.includes('分钟') && number <= 12);
  return Math.max(15, Math.round(asHours ? number * 60 : number));
}

/** 回到上一步时，把之前写过的内容放回输入框里。 */
function draftForStep(target: number, answers: PlanAnswers): string {
  if (target === 0) return answers.goal;
  if (target === 1) return answers.horizon;
  if (target === 3) {
    return answers.dailyMinutes % 60 === 0
      ? `${answers.dailyMinutes / 60} 小时`
      : `${answers.dailyMinutes} 分钟`;
  }
  if (target === 4) return answers.rhythm;
  return '';
}

export function PlanWizard({ open, plan, onClose, onPlan, onUpdatePlan }: PlanWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<PlanAnswers>({
    goal: '',
    horizon: '',
    dailyMinutes: 120,
    rhythm: '',
    tasks: [],
  });
  const [taskText, setTaskText] = useState('');
  const [draft, setDraft] = useState('');
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState<Plan | null>(null);
  const [lighter, setLighter] = useState(false);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [overloadOpen, setOverloadOpen] = useState(false);
  const [overloadNotice, setOverloadNotice] = useState('');
  /** 「参考一点经验」：与小路面板、编辑卡同一个生成器；点了才追加到任务框。 */
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaLoading, setIdeaLoading] = useState(false);
  const [ideaItems, setIdeaItems] = useState<string[]>([]);
  const [ideaGoal, setIdeaGoal] = useState('');
  /** 这一轮已经给过的条目，换一批时避开。 */
  const ideaSeen = useRef<string[]>([]);

  useEffect(() => {
    if (!open) return;
    // 重新打开时，把上一次走过的路带回来，不用从头再写一遍。
    const tasks = plan
      ? plan.items
          .filter((item) => item.level === 'week' && !item.is_buffer)
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
          .map((item) => item.arrangement)
      : [];
    setAnswers({
      goal: plan?.goal ?? '',
      horizon: plan?.horizon ?? '',
      dailyMinutes: plan?.dailyMinutes ?? 120,
      rhythm: plan?.rhythm ?? '',
      tasks,
    });
    setTaskText(tasks.join('\n'));
    setStep(0);
    setDraft(plan?.goal ?? '');
    setBuilding(false);
    setBuilt(null);
    setLighter(false);
    setExtraId(null);
    setOverloadOpen(false);
    setOverloadNotice('');
    setIdeaOpen(false);
    setIdeaItems([]);
    setIdeaGoal('');
    // 只在打开时取一次，避免刚排好一版又被重置。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = (nextAnswers: PlanAnswers) => {
    setBuilding(true);
    window.setTimeout(() => {
      const nextPlan = buildPlan(nextAnswers);
      setBuilt(nextPlan);
      setBuilding(false);
      onPlan(nextPlan);
      setStep(4);
    }, 760);
  };

  const stepValue = (value: string): PlanAnswers => {
    if (step === 0) return { ...answers, goal: value };
    if (step === 1) return { ...answers, horizon: value };
    if (step === 3) return { ...answers, dailyMinutes: parseDaily(value) };
    if (step === 4) return { ...answers, rhythm: value };
    return answers;
  };

  const pick = (value: string) => {
    if (step === 2) {
      setTaskText((prev) => {
        const current = parseTasks(prev);
        if (current.includes(value) || current.length >= 8) return prev;
        return prev.trim() ? `${prev.trim()}\n${value}` : value;
      });
      return;
    }
    const next = stepValue(value);
    setAnswers(next);
    if (step === 4) {
      setDraft('');
      finish(next);
    } else {
      setDraft(draftForStep(step + 1, next));
      setStep(step + 1);
    }
  };

  const proceed = () => {
    if (building) return;
    if (step === 2) {
      const tasks = parseTasks(taskText);
      if (!tasks.length) return;
      const next = { ...answers, tasks };
      setAnswers(next);
      setDraft(draftForStep(3, next));
      setStep(3);
      return;
    }
    if (!draft.trim()) return;
    const next = stepValue(draft.trim());
    setAnswers(next);
    if (step === 4) {
      setDraft('');
      finish(next);
    } else {
      setDraft(draftForStep(step + 1, next));
      setStep(step + 1);
    }
  };

  const parsedTaskCount = parseTasks(taskText).length;

  /** 拉一批经验候选：方向取第 1 步的目标，没填就用已写的第一件任务当线索。 */
  const loadIdeas = async () => {
    if (ideaLoading) return;
    setIdeaOpen(true);
    const goal = (answers.goal || parseTasks(taskText)[0] || '').trim();
    if (ideaItems.length && ideaGoal === goal) return;
    setIdeaLoading(true);
    const result = await generateCandidates(goal);
    setIdeaGoal(goal);
    ideaSeen.current = result.items;
    setIdeaItems(result.items);
    setIdeaLoading(false);
  };

  /** 换一批：避开这一轮已给过的；阶段分组只在弹窗里做，向导保持一条线。 */
  const nextIdeas = async () => {
    if (ideaLoading) return;
    const goal = (answers.goal || parseTasks(taskText)[0] || '').trim();
    setIdeaLoading(true);
    const result = await generateCandidates(goal, { exclude: ideaSeen.current });
    setIdeaGoal(goal);
    ideaSeen.current = Array.from(new Set([...ideaSeen.current, ...result.items]));
    setIdeaItems(result.items);
    setIdeaLoading(false);
  };

  /** 点一条就追加到任务框末尾，已有同一件则不重复加。 */
  const takeIdea = (value: string) => {
    setTaskText((prev) => {
      const current = parseTasks(prev);
      if (current.includes(value)) return prev;
      if (current.length >= 8) return prev;
      return prev.trim() ? `${prev.trim()}\n${value}` : value;
    });
  };

  const currentValue =
    step === 0 ? answers.goal : step === 1 ? answers.horizon : step === 4 ? answers.rhythm : '';
  const canProceed = step === 2 ? parsedTaskCount > 0 : Boolean(draft.trim());

  const weekSum = useMemo(() => (built ? planWeekTotal(built) : 0), [built]);
  const overload = built ? weekSum > built.dailyMinutes * 6 : false;
  const groups = useMemo(() => (built ? planWeekGroups(built) : []), [built]);
  const availableHours = built
    ? String(Math.round((built.dailyMinutes * horizonDays(built.horizon) * 0.75) / 60))
    : '0';
  const extraDate = built && extraId ? built.items.find((item) => item.plan_id === extraId)?.start_date : undefined;
  const extraDayTotal =
    built && extraDate
      ? built.items
          .filter((item) => item.level === 'week' && !item.is_buffer && item.start_date === extraDate)
          .reduce((sum, item) => sum + item.planned_minutes, 0)
      : 0;

  const addExtra = () => {
    if (!built || extraId) return;
    const firstWeek = weekItems(built)[0];
    const date = firstWeek?.start_date ?? built.weekStart;
    const extra: PlanItem = {
      plan_id: planId('week', fromIso(date), 9),
      level: 'week',
      start_date: date,
      end_date: date,
      direction: '这周想再往前一点点',
      arrangement: '再把另一小段过一遍，写两句自己的话',
      enough_point: '看二十分钟也可以',
      planned_minutes: Math.min(60, built.dailyMinutes),
      actual_minutes: 0,
      status: 'planned',
      is_buffer: false,
      note: '',
    };
    const next = { ...built, items: [...built.items, extra] };
    const dayTotal = next.items
      .filter((item) => item.level === 'week' && !item.is_buffer && item.start_date === date)
      .reduce((sum, item) => sum + item.planned_minutes, 0);
    setBuilt(next);
    setExtraId(extra.plan_id);
    setLighter(false);
    setOverloadNotice('');
    setOverloadOpen(dayTotal > built.dailyMinutes);
    onUpdatePlan(next);
  };

  const dropExtra = () => {
    if (!built || !extraId) return;
    const next = { ...built, items: built.items.filter((item) => item.plan_id !== extraId) };
    setBuilt(next);
    setExtraId(null);
    setOverloadOpen(false);
    setOverloadNotice('先把它放到「以后想做」了，不会丢。');
    onUpdatePlan(next);
  };

  const keepExtra = () => {
    if (!built || !extraId) return;
    const next = {
      ...built,
      items: built.items.map((item) =>
        item.plan_id === extraId
          ? {
              ...item,
              note: '这几天有点满。没做到不是你的问题，是我们对时间的估计要再调。',
            }
          : item,
      ),
    };
    setBuilt(next);
    setOverloadOpen(false);
    setOverloadNotice('都留着也可以。没做到不是你的问题，是我们对时间的估计要再调。');
    onUpdatePlan(next);
  };

  const moveOneToNextWeek = () => {
    if (!built) return;
    const next = moveLastToNextWeek(built);
    setBuilt(next);
    setLighter(false);
    setOverloadOpen(false);
    setOverloadNotice(COPY.planWizard.moved);
    onUpdatePlan(next);
  };

  return (
    <Modal
      open={open}
      title={COPY.entry.plan}
      onClose={onClose}
      label="plan-wizard"
      wide
      footer={
        built ? (
          <>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setBuilt(null);
                setStep(0);
                setDraft(answers.goal);
                setLighter(false);
                setOverloadOpen(false);
                setOverloadNotice('');
              }}
            >
              {COPY.planWizard.restart}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                const lighterPlan = lightenPlan(built);
                setBuilt(lighterPlan);
                setLighter(true);
                setOverloadOpen(false);
                onUpdatePlan(lighterPlan);
              }}
            >
              {COPY.planWizard.lighter}
            </button>
            <button type="button" className="button primary" onClick={onClose}>
              {COPY.planWizard.keep}
            </button>
          </>
        ) : (
          <>
            {step > 0 ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  const prev = step - 1;
                  setDraft(draftForStep(prev, answers));
                  setStep(prev);
                }}
              >
                {COPY.planWizard.back}
              </button>
            ) : (
              <span className="modal-foot-note">{plan ? '重新标一遍会替换现在的小路。' : '慢慢来，一次只想一件事。'}</span>
            )}
            <button type="button" className="button primary" disabled={!canProceed || building} onClick={proceed}>
              {step === totalSteps - 1 ? COPY.planWizard.build : COPY.planWizard.next}
            </button>
          </>
        )
      }
    >
      {built ? (
        <div className="wizard-done">
          <div className="wizard-speaker">
            <div className="avatar">
              <Fox className="avatar-fox" />
            </div>
            <div className="bubble assistant">
              {overload
                ? COPY.planWizard.overload
                    .replace('{planned}', formatHours(weekSum))
                    .replace('{daily}', formatHours(built.dailyMinutes))
                : COPY.planWizard.doneLead}
            </div>
          </div>
          <div className="ghost-plan">
            <div className="ghost-plan-head">
              <span>{COPY.planLabels.goal}</span>
              <strong>{built.goal}</strong>
              <span className="ghost-plan-side">大概走到 {built.horizon}</span>
            </div>
            <p className="ghost-plan-time">
              {COPY.planWizard.timeNote
                .replace('{horizon}', built.horizon)
                .replace('{daily}', formatMinutes(built.dailyMinutes))
                .replace('{hours}', availableHours)}
            </p>
            <div className="ghost-plan-weeks">
              {groups.slice(0, 6).map((group, index) => (
                <div className="ghost-week" key={group.start}>
                  <div className="ghost-week-head">
                    <span>{shortDate(group.start)} 那一周</span>
                    <span>
                      {formatMinutes(group.items.reduce((sum, item) => sum + item.planned_minutes, 0))}
                    </span>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.plan_id} className="ghost-plan-row">
                      <span className="ghost-date">{weekdayLabel(fromIso(item.start_date))}</span>
                      <span className="ghost-task">{item.arrangement}</span>
                      <span className="ghost-min">{formatMinutes(item.planned_minutes)}</span>
                    </div>
                  ))}
                  {index === 0 ? (
                    <div className="ghost-plan-row buffer">
                      <span className="ghost-date">{COPY.planLabels.buffer}</span>
                      <span className="ghost-task">{COPY.weekBufferText}</span>
                      <span className="ghost-min">—</span>
                    </div>
                  ) : null}
                </div>
              ))}
              {groups.length === 0 ? (
                <div className="ghost-plan-row buffer">
                  <span className="ghost-date">{COPY.planLabels.buffer}</span>
                  <span className="ghost-task">{COPY.weekBufferText}</span>
                  <span className="ghost-min">—</span>
                </div>
              ) : null}
            </div>
            <p className="ghost-plan-note">
              {COPY.planWizard.doneAsk}
              {lighter ? ' 已经把这一版放轻了一点。' : ''}
            </p>
            <p className="field-hint">{COPY.planWizard.planNote}</p>
            {groups.length > 6 ? (
              <p className="field-hint">再往后的路，先不排满，走到那儿再看。</p>
            ) : null}
            {overload ? (
              <>
                <p className="field-hint">{COPY.planWizard.overloadShort}</p>
                <button type="button" className="text-button small" onClick={moveOneToNextWeek}>
                  {COPY.planWizard.moveNext}
                </button>
              </>
            ) : null}
            {!extraId ? (
              <button type="button" className="text-button small" onClick={addExtra}>
                想再多放一件事
              </button>
            ) : null}
            {overloadOpen && built ? (
              <div className="overload-card">
                <p>
                  {COPY.planWizard.overload
                    .replace('{planned}', formatHours(extraDayTotal))
                    .replace('{daily}', formatHours(built.dailyMinutes))}
                </p>
                <div className="offer-actions">
                  <button type="button" className="button ghost small" onClick={dropExtra}>
                    先放一放
                  </button>
                  <button type="button" className="text-button small" onClick={keepExtra}>
                    都留着
                  </button>
                </div>
              </div>
            ) : null}
            {overloadNotice ? <p className="field-hint">{overloadNotice}</p> : null}
          </div>
        </div>
      ) : building ? (
        <div className="wizard-building">
          <div className="wizard-walk" aria-hidden="true">
            <Fox className="walking-fox" walking />
          </div>
          <p>{COPY.planWizard.building}</p>
        </div>
      ) : (
        <div className="wizard">
          <div className="wizard-progress" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, item) => (
              <span key={item} className={item <= step ? 'is-on' : ''} />
            ))}
          </div>
          <div className="wizard-speaker">
            <div className="avatar">
              <Fox className="avatar-fox" />
            </div>
            <div className="bubble assistant">
              <SplitText
                key={`q-${step}`}
                text={stepQuestions[step]}
                splitType="lines"
                effect="blur"
                trigger="load"
                duration={0.9}
                className="wizard-question"
              />
              <p className="bubble-hint">{stepHints[step]}</p>
            </div>
          </div>
          <div className="wizard-chips">
            {step === 2 ? (
              stepChips[step].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`chip ${currentValue === chip ? 'is-on' : ''}`}
                  onClick={() => pick(chip)}
                >
                  {chip}
                </button>
              ))
            ) : (
              <JellyRadio
                items={[...stepChips[step]]}
                value={currentValue}
                onChange={(next: any) => pick(next)}
                size={step === 4 ? 'md' : 'sm'}
                ariaLabel={stepQuestions[step]}
                swell={0.1}
              />
            )}
            {/* 第 3 步：跟「刷几套真题」并排的同一行，是同等份量的选项，不是角落里的小字 */}
            {step === 2 ? (
              <button
                type="button"
                className={`chip chip-idea ${ideaOpen ? 'is-on' : ''}`}
                title={COPY.candidateEntry.hint}
                aria-expanded={ideaOpen}
                onClick={() => (ideaOpen ? setIdeaOpen(false) : loadIdeas())}
              >
                {COPY.candidateEntry.button}
              </button>
            ) : null}
          </div>
          {step === 2 ? (
            <>
              <textarea
                className="wizard-input wizard-textarea"
                value={taskText}
                rows={4}
                onChange={(event) => setTaskText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') proceed();
                }}
                placeholder={COPY.planWizard.taskPlaceholder}
                aria-label={stepQuestions[step]}
              />
              {parsedTaskCount > 0 ? (
                <p className="wizard-foot-hint">
                  {COPY.planWizard.taskCount.replace('{count}', String(parsedTaskCount))}
                </p>
              ) : null}

              {/* 点 chip 后在这里展开候选；点一条才追加，不自动填。 */}
              {ideaOpen ? (
                <div className="wizard-idea">
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
                          {ideaItems.map((item) => {
                            const taken = parseTasks(taskText).includes(item);
                            return (
                              <button
                                key={item}
                                type="button"
                                className={`editor-idea-chip ${taken ? 'is-on' : ''}`}
                                aria-pressed={taken}
                                onClick={() => takeIdea(item)}
                              >
                                {taken ? `✓ ${item}` : item}
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" className="text-button small" onClick={nextIdeas}>
                          {COPY.candidate.next}
                        </button>
                        <p className="editor-idea-note">
                          点一条就加到上面，几件都行；最多先放 8 件，往下还能改。
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <input
              className="wizard-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) proceed();
              }}
              placeholder={COPY.planWizard.answerPlaceholder}
              aria-label={stepQuestions[step]}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
