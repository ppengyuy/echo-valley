'use client';

import { useRef, useState } from 'react';
import { motion } from 'motion/react';

import './FlipCard.css';
import { useMotionReduced } from './gate';

/**
 * Flip Card 的克制版：
 * 点击 / 横向拖动翻面，两面各转到 90° 交界处交接，全程不出现镜像字；
 * hover 只做很小的倾斜与一层很淡的反光，不做浮起。
 */
export default function FlipCard({
  front,
  back,
  defaultFlipped = false,
  onFlipChange = /** @type {any} */ (undefined),
  axis = 'y',
  flipOnClick = true,
  draggable = true,
  tilt = true,
  tiltMax = 6,
  glare = true,
  glareOpacity = 0.12,
  width = /** @type {any} */ (undefined),
  height = /** @type {any} */ (undefined),
  radius = 16,
  disabled = false,
  ariaLabel = '翻看这张卡',
  className = '',
  style = /** @type {any} */ (undefined),
}) {
  const [flipped, setFlipped] = useState(defaultFlipped);
  const [dragLean, setDragLean] = useState(0);
  const [lean, setLean] = useState({ x: 0, y: 0 });
  const [glareAt, setGlareAt] = useState({ x: 50, y: 40 });
  const startRef = useRef(null);
  const reduced = useMotionReduced();

  const setFlip = (next) => {
    if (disabled || next === flipped) return;
    setFlipped(next);
    onFlipChange?.(next);
  };

  const onPointerDown = (event) => {
    if (disabled || !draggable) return;
    startRef.current = { x: event.clientX, y: event.clientY, moved: 0 };
  };

  const onPointerMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (glare) {
      setGlareAt({
        x: ((event.clientX - box.left) / box.width) * 100,
        y: ((event.clientY - box.top) / box.height) * 100,
      });
    }
    if (!reduced && tilt) {
      setLean({
        x: -((event.clientY - box.top) / box.height - 0.5) * 2 * tiltMax,
        y: ((event.clientX - box.left) / box.width - 0.5) * 2 * tiltMax,
      });
    }
    if (!startRef.current) return;
    const delta = event.clientX - startRef.current.x;
    startRef.current.moved = Math.abs(delta);
    // 拖拽阶段只做一点点倾斜，换面留到抬手，半路不会出现倒着的字。
    if (draggable && startRef.current.moved > 6) {
      setDragLean(Math.max(-1, Math.min(1, delta / (box.width * 0.6))) * 8);
    }
  };

  const onPointerUp = () => {
    const state = startRef.current;
    startRef.current = null;
    setDragLean(0);
    if (!state) return;
    if (flipOnClick && state.moved < 6) setFlip(!flipped);
  };

  const spin = axis === 'x';
  const spring = reduced
    ? { duration: 0 }
    : { type: 'spring', stiffness: 170, damping: 20 };
  const faceSpring = reduced
    ? { duration: 0 }
    : { type: 'spring', stiffness: 210, damping: 24 };

  const frontMotion = spin
    ? { rotateX: flipped ? -90 : 0, opacity: flipped ? 0 : 1 }
    : { rotateY: flipped ? -90 : 0, opacity: flipped ? 0 : 1 };
  const backMotion = spin
    ? { rotateX: flipped ? 0 : 90, opacity: flipped ? 1 : 0 }
    : { rotateY: flipped ? 0 : 90, opacity: flipped ? 1 : 0 };

  return (
    <div
      className={`fc-wrap ${className}`.trim()}
      style={{ width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined, ...style }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={flipped}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        startRef.current = null;
        setDragLean(0);
        setLean({ x: 0, y: 0 });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setFlip(!flipped);
        }
      }}
    >
      <motion.div
        className="fc-inner"
        style={{ borderRadius: `${radius}px` }}
        animate={{
          rotateX: spin ? 0 : lean.x,
          rotate: reduced ? 0 : lean.y * 0.14 + dragLean * 0.4,
          scale: dragLean ? 1.01 : 1,
        }}
        transition={spring}
      >
        <motion.div
          className="fc-face fc-front"
          style={{ borderRadius: `${radius}px` }}
          initial={false}
          animate={frontMotion}
          transition={faceSpring}
        >
          {front}
          {glare && (
            <span
              aria-hidden="true"
              className="fc-glare"
              style={{
                opacity: glareOpacity,
                background: `radial-gradient(circle at ${glareAt.x}% ${glareAt.y}%, #ffffff, transparent 62%)`,
              }}
            />
          )}
        </motion.div>
        <motion.div
          className="fc-face fc-back"
          style={{ borderRadius: `${radius}px` }}
          initial={false}
          animate={backMotion}
          transition={faceSpring}
        >
          {back}
        </motion.div>
      </motion.div>
    </div>
  );
}
