import { useEffect, useState, type CSSProperties } from 'react';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  hint?: string;
  /** 要聚光的目标选择器；不填就是一张居中的卡片。 */
  target?: string;
  /** 进入这一步前，先把界面切到该出现的样子。 */
  enter?: () => void;
}

interface TourGuideProps {
  open: boolean;
  steps: TourStep[];
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 330;

function readBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

/**
 * 新手引导：一次只讲一件事，聚光跟着目标走。
 * 铺一层不挡点击的暗层，把要讲的地方挖亮；不锁滚动，也不强制走完。
 */
export function TourGuide({ open, steps, onClose }: TourGuideProps) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];
  const last = index >= total - 1;
  const target = step?.target;

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setBox(null);
    }
  }, [open]);

  // 换一步：先让界面切过去，再找目标位置（切界面有动画，所以要重试几次）。
  useEffect(() => {
    if (!open || !step) return;
    step.enter?.();
    setBox(null);
    if (!target) return;

    let timer = 0;
    let tries = 0;

    const locate = () => {
      const el = document.querySelector(target);
      if (!el) {
        tries += 1;
        if (tries < 8) timer = window.setTimeout(locate, 180);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        tries += 1;
        if (tries < 8) timer = window.setTimeout(locate, 180);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      timer = window.setTimeout(() => setBox(readBox(el)), 280);
    };

    locate();
    return () => window.clearTimeout(timer);
  }, [open, index, step, target]);

  // 滚动或改窗口：聚光跟着目标走。
  useEffect(() => {
    if (!open || !target) return;
    const follow = () => {
      const el = document.querySelector(target);
      if (el) setBox(readBox(el));
    };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((value) => Math.min(value + 1, total - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, total, onClose]);

  if (!open || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw <= 560;

  let cardStyle: CSSProperties | undefined;
  if (box && !narrow) {
    const below = box.top + box.height + 16;
    const left = Math.max(16, Math.min(box.left, vw - CARD_W - 16));
    cardStyle =
      below + 230 < vh
        ? { left, top: below, width: CARD_W }
        : { left, width: CARD_W, bottom: vh - box.top + 16 };
  }

  return (
    <div className="tour-layer">
      {box ? (
        <>
          <div className="tour-hole" style={{ top: 0, left: 0, right: 0, height: Math.max(0, box.top) }} />
          <div
            className="tour-hole"
            style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="tour-hole"
            style={{
              top: box.top,
              left: 0,
              width: Math.max(0, box.left),
              height: box.height,
            }}
          />
          <div
            className="tour-hole"
            style={{
              top: box.top,
              left: box.left + box.width,
              right: 0,
              height: box.height,
            }}
          />
          <div
            className="tour-spot"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        </>
      ) : (
        <div className="tour-dim" />
      )}
      <div
        className={`tour-card ${narrow ? 'is-sheet' : ''} ${box ? '' : 'is-center'}`}
        style={cardStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <div className="tour-meta">
          <span className="tour-count">
            {index + 1} / {total}
          </span>
          <span className="tour-dots" aria-hidden="true">
            {steps.map((item, i) => (
              <i key={item.id} className={i === index ? 'is-on' : ''} />
            ))}
          </span>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <p className="tour-body" id="tour-body">
          {step.body}
        </p>
        {step.hint ? <p className="tour-hint">{step.hint}</p> : null}
        <div className="tour-actions">
          <button type="button" className="text-button small" onClick={onClose}>
            先不看
          </button>
          <div className="tour-buttons">
            <button
              type="button"
              className="button ghost"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(value - 1, 0))}
            >
              上一步
            </button>
            {last ? (
              <button type="button" className="button primary" onClick={onClose}>
                开始体验
              </button>
            ) : (
              <button
                type="button"
                className="button primary"
                onClick={() => setIndex((value) => Math.min(value + 1, total - 1))}
              >
                下一步
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
