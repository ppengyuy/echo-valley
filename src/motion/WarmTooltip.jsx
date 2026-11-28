'use client';

import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import './WarmTooltip.css';
import { useMotionReduced } from './gate';

/**
 * Warm Tooltip 的克制版：
 * 冷启动要等 delay(400ms) 才出现，鼠标移开 warmWindow(300ms) 内滑到下一个不重新等；
 * 只往 trigger 上挂 aria-describedby，不覆盖原有的 aria-label / 事件。
 * reduced 时只做即时显示，无缩放与模糊。
 */

let lastClosedAt = 0;

export default function WarmTooltip({
  content,
  shortcut = undefined,
  side = 'bottom',
  delay = 400,
  warmWindow = 300,
  size = 'sm',
  radius = 8,
  gap = 8,
  arrow = true,
  popScale = 0.98,
  popBlur = 2,
  className = '',
  disabled = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const id = useId();
  const reduced = useMotionReduced();

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const show = () => {
    if (disabled) return;
    const warm = Date.now() - lastClosedAt < warmWindow;
    if (timer.current) window.clearTimeout(timer.current);
    if (warm) {
      setOpen(true);
      return;
    }
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
    lastClosedAt = Date.now();
  };

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onPointerEnter: (event) => {
      children.props.onPointerEnter?.(event);
      if (event.pointerType !== 'touch') show();
    },
    onPointerLeave: (event) => {
      children.props.onPointerLeave?.(event);
      hide();
    },
    onFocus: (event) => {
      children.props.onFocus?.(event);
      // 触屏上点一下就 focus，会顺手弹出气泡；只在键盘 focus 时才显示。
      const visible = event.target?.matches?.(':focus-visible');
      if (visible) show();
    },
    onBlur: (event) => {
      children.props.onBlur?.(event);
      hide();
    },
  });

  return (
    <span className={`wt-wrap wt-${size} ${className}`.trim()} style={{ '--wt-gap': `${gap}px` }}>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.span
            key="bubble"
            id={id}
            role="tooltip"
            className={`wt-bubble wt-side-${side}`}
            style={{ borderRadius: `${radius}px` }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: popScale, y: side === 'top' ? 4 : -4, filter: `blur(${popBlur}px)` }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: popScale, filter: `blur(${popBlur}px)` }}
            transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <span className="wt-label">{content}</span>
            {shortcut ? <span className="wt-key">{shortcut}</span> : null}
            {arrow ? <span className="wt-arrow" aria-hidden="true" /> : null}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
