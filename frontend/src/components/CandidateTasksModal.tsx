import { useEffect, useRef, useState } from 'react';
import {
  generateCandidates,
  sanitizeCandidates,
  type CandidateResult,
  type CandidateStage,
} from '../agent/candidates';
import { COPY } from '../copy';
import { Fox } from './Fox';
import { Modal } from './Modal';
import { PebbleIcon } from './PebbleIcon';

interface CandidateTasksModalProps {
  open: boolean;
  goal: string;
  onClose: () => void;
  /** 只回传用户勾选并确认的任务名；写入由调用方逐条走编辑卡完成。 */
  onConfirm: (names: string[]) => void;
  /** 把某条候选收进溪滩当石子；来源由调用方标注。 */
  onPickStone?: (text: string) => void;
}

const STAGE_ORDER: CandidateStage[] = ['all', 'base', 'build', 'sprint'];

export function CandidateTasksModal({
  open,
  goal,
  onClose,
  onConfirm,
  onPickStone,
}: CandidateTasksModalProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CandidateResult | null>(null);
  /** 勾选保存完整条目，换批、换阶段都不丢。 */
  const [checked, setChecked] = useState<string[]>([]);
  /** 用户自己点选的阶段，默认「全部」，不替用户推断。 */
  const [stage, setStage] = useState<CandidateStage>('all');
  /** 换一批的轮次，用来触发重新拉取。 */
  const [batch, setBatch] = useState(0);
  /** 这一阶段里已经给过的条目，换一批时避开。 */
  const seenRef = useRef<string[]>([]);
  const loadRef = useRef(0);

  // 打开、换阶段、换一批时重新拉候选；勾选不清空。
  useEffect(() => {
    if (!open) return;
    const token = ++loadRef.current;
    setLoading(true);
    void generateCandidates(goal, { stage, exclude: seenRef.current }).then((data) => {
      if (token !== loadRef.current) return;
      const items = sanitizeCandidates(data.items);
      seenRef.current = Array.from(new Set([...seenRef.current, ...items]));
      setResult({ ...data, items });
      setLoading(false);
    });
    return () => {
      loadRef.current += 1;
    };
  }, [open, goal, stage, batch]);

  // 关闭后复位，下次打开是干净的一轮。
  useEffect(() => {
    if (open) return;
    seenRef.current = [];
    setChecked([]);
    setStage('all');
    setBatch(0);
    setResult(null);
  }, [open]);

  const toggle = (name: string) => {
    setChecked((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const changeStage = (next: CandidateStage) => {
    if (next === stage || loading) return;
    // 换了类别，已给过的记录也从头开始，避免把别的阶段整段排除掉。
    seenRef.current = [];
    setStage(next);
  };

  const nextBatch = () => {
    if (loading) return;
    setBatch((value) => value + 1);
  };

  const confirm = () => {
    if (!checked.length) return;
    onConfirm(checked);
  };

  // 当前这一批里，去掉已经固定在顶部的勾选项，避免重复出现。
  const batchItems = (result?.items ?? []).filter((item) => !checked.includes(item));

  const renderRow = (item: string) => (
    <div key={item} className={`candidate-item ${checked.includes(item) ? 'is-on' : ''}`}>
      <label className="candidate-pick-main">
        <input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} />
        <span className="candidate-mark" aria-hidden="true">✦</span>
        <span className="candidate-text">{item}</span>
      </label>
      {onPickStone ? (
        <button
          type="button"
          className="candidate-stone-button"
          title={COPY.stone.pickRowHint}
          aria-label={`${COPY.stone.pickUp}：${item}（${COPY.stone.pickRowHint}）`}
          onClick={() => onPickStone(item)}
        >
          <PebbleIcon size={13} />
          <span>{COPY.stone.pickUp}</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <Modal
      open={open}
      title={COPY.candidate.title}
      onClose={onClose}
      label="candidate-tasks"
      wide
      footer={
        <>
          <span className="modal-foot-note">{COPY.candidate.footNote}</span>
          <button
            type="button"
            className="button primary"
            disabled={checked.length === 0}
            onClick={confirm}
          >
            {checked.length > 0
              ? COPY.candidate.confirm.replace('{count}', String(checked.length))
              : COPY.candidate.confirmIdle}
          </button>
        </>
      }
    >
      <p className="candidate-disclaimer">{COPY.candidate.disclaimer}</p>
      <p className="candidate-goal">
        {COPY.candidate.goalLabel} <strong>{goal}</strong>
      </p>

      {/* 阶段由用户自己点，默认「全部」；只换这一批看什么，不写进计划。 */}
      <div className="candidate-stages" role="group" aria-label={COPY.candidate.stageLabel}>
        <span className="candidate-stage-label">{COPY.candidate.stageLabel}</span>
        {STAGE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`candidate-stage ${stage === key ? 'is-on' : ''}`}
            aria-pressed={stage === key}
            title={COPY.candidate.stages[key].hint}
            onClick={() => changeStage(key)}
          >
            {COPY.candidate.stages[key].label}
          </button>
        ))}
      </div>
      <p className="candidate-stage-hint">
        {COPY.candidate.stages[stage].hint} · {COPY.candidate.stageNote}
      </p>

      {loading && !result ? (
        <div className="candidate-loading">
          <div className="wizard-walk" aria-hidden="true">
            <Fox className="walking-fox" walking />
          </div>
          <p>{COPY.candidate.loading}</p>
        </div>
      ) : result ? (
        <>
          {result.degraded ? <p className="candidate-degraded">{COPY.candidate.degraded}</p> : null}
          {result.source === 'local' && !result.degraded ? (
            <p className="candidate-degraded">{COPY.candidate.localNote}</p>
          ) : null}
          {onPickStone ? <p className="candidate-two-ways">{COPY.candidate.twoWays}</p> : null}

          <div className={`candidate-list ${loading ? 'is-swapping' : ''}`}>
            {checked.length ? (
              <div className="candidate-picked">
                <p className="candidate-group-title">{COPY.candidate.pickedGroup}</p>
                {checked.map(renderRow)}
              </div>
            ) : null}
            {batchItems.map(renderRow)}
          </div>

          <div className="candidate-next-row">
            <button type="button" className="text-button small" disabled={loading} onClick={nextBatch}>
              {loading ? COPY.candidate.nextLoading : COPY.candidate.next}
            </button>
            {result.exhausted ? (
              <span className="candidate-exhausted">{COPY.candidate.exhausted}</span>
            ) : null}
          </div>

          <p className="candidate-note">{COPY.candidate.note}</p>
        </>
      ) : null}
    </Modal>
  );
}
