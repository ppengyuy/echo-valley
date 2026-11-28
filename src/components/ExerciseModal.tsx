import { Modal } from './Modal';
import type { ExerciseDef } from '../exercises';

interface ExerciseModalProps {
  exercise: ExerciseDef | null;
  onClose: () => void;
  /** 只生成可编辑草稿，绝不自动保存成回音。 */
  onDraft: (name: string) => void;
}

/**
 * 练习弹窗外壳：中途随时可以关，没有「必须完成」。
 * 底部只有两个动作：关掉，或者带着一句草稿去回音谷。
 */
export function ExerciseModal({ exercise, onClose, onDraft }: ExerciseModalProps) {
  return (
    <Modal
      open={Boolean(exercise)}
      title={exercise?.name ?? ''}
      onClose={onClose}
      label="exercise"
      wide
      footer={
        exercise ? (
          <>
            <button type="button" className="button ghost" onClick={onClose}>
              先停在这里
            </button>
            <button type="button" className="button primary" onClick={() => onDraft(exercise.name)}>
              ✍️ 我想记下此刻的感受
            </button>
          </>
        ) : null
      }
    >
      {exercise ? (
        <>
          <p className="ex-sub">{exercise.desc}</p>
          {exercise.body()}
          <p className="ex-privacy">这次练习不会被记录：不统计次数、时长、是否完成，也不写进任何地方。</p>
        </>
      ) : null}
    </Modal>
  );
}
