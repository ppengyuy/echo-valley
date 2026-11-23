import { useEffect, useState } from 'react';

interface FoxProps {
  className?: string;
  /** 换一个数，就让刘看山轻轻点一下头（存入回音时用）。 */
  nodKey?: number;
  /** 换一个数，就让短尾巴晃一下（拖完卡片、导出完成时用）。 */
  wagKey?: number;
  /** 用户在拖拽时，头微微转向被拖的东西。 */
  tracking?: boolean;
  /** 页面安静很久时，趴下来打盹。 */
  dozing?: boolean;
  /** 生成计划时逐帧走路，替代转圈 spinner。 */
  walking?: boolean;
}

/**
 * 刘看山：知乎的那只白色小狐狸，保持原来的简笔造型。
 * 与初版唯一的差别是耳朵短了一截（原来的耳尖顶到 y=15，现在收在 y≈39），
 * 其余身体、四肢、尾巴、眼鼻都沿用原样，避免和官方形象差太远。
 * viewBox 跟着收紧到 `12 28 136 179`，让各处的刘看山维持原来的视觉大小。
 */
export function Fox({
  className = '',
  nodKey,
  wagKey,
  tracking = false,
  dozing = false,
  walking = false,
}: FoxProps) {
  const [blinking, setBlinking] = useState(false);
  const [nodding, setNodding] = useState(false);
  const [wagging, setWagging] = useState(false);

  // 不规律地眨眼，3–7 秒一次，每次 0.13 秒。
  useEffect(() => {
    let blinkTimer = 0;
    let closeTimer = 0;

    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        setBlinking(true);
        closeTimer = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 130);
      }, 3000 + Math.random() * 4000);
    };

    schedule();
    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  useEffect(() => {
    if (!nodKey) return;
    setNodding(true);
    const timer = window.setTimeout(() => setNodding(false), 1400);
    return () => window.clearTimeout(timer);
  }, [nodKey]);

  useEffect(() => {
    if (!wagKey) return;
    setWagging(true);
    const timer = window.setTimeout(() => setWagging(false), 1500);
    return () => window.clearTimeout(timer);
  }, [wagKey]);

  return (
    <svg
      className={`fox-svg ${className} ${tracking ? 'is-tracking' : ''} ${
        dozing ? 'is-dozing' : ''
      } ${nodding ? 'is-nodding' : ''} ${wagging ? 'is-wagging' : ''} ${
        walking ? 'is-walking' : ''
      }`}
      viewBox="6 23 149 195"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className="fox-breathe">
        <g className="fox-nod">
          <g className="fox-legs" fill="currentColor">
            <rect className="fox-leg fox-leg-a" x="60" y="172" width="12" height="30" rx="6" />
            <rect className="fox-leg fox-leg-b" x="92" y="172" width="12" height="30" rx="6" />
          </g>

          <g className="fox-tail">
            <path
              d="M114 158c8-4 14 0 14 6 0 5-6 8-12 7"
              fill="#fcfbf5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </g>

          {/* 身体 + 双耳一体：耳尖从 y=15 收到 y≈39，其余轮廓与原来一致 */}
          <path
            className="fox-body"
            d="M38 74C36 64 38 54 43 46C46 41 53 41 56 46C61 52 68 56 76 60C84 56 91 52 96 46C99 41 106 41 109 46C114 54 116 64 114 74C121 94 126 114 124 136C122 166 106 186 82 190C58 186 42 166 40 136C38 114 40 94 38 74Z"
            fill="#fcfbf5"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          <g className="fox-arms" stroke="currentColor" strokeWidth="10" strokeLinecap="round">
            <path d="M40 116 33 144" />
            <path d="M114 116 121 144" />
          </g>

          <g className="fox-head">
            <g className="fox-gaze">
              <ellipse cx="81" cy="92" rx="14" ry="16" fill="currentColor" />
              <ellipse
                className={`fox-eye ${blinking || dozing ? 'is-blinking' : ''}`}
                cx="58"
                cy="87"
                rx="3.4"
                ry="6.2"
                fill="currentColor"
              />
              <ellipse
                className={`fox-eye ${blinking || dozing ? 'is-blinking' : ''}`}
                cx="104"
                cy="87"
                rx="3.4"
                ry="6.2"
                fill="currentColor"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
