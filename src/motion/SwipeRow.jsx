'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'motion/react';

import './SwipeRow.css';
import { useMotionReduced } from './gate';

/**
 * Swipe Row 的克制版：
 * 只做「左滑露出抽屉」，fullSwipe 永久关闭——情绪内容不给一滑就没的机会。
 * 抽屉里的每一项都只是普通按钮，删除类动作仍交给页面自己的二次确认弹窗。
 */
export default function SwipeRow({
  children,
  actions = /** @type {Array<any>} */ ([]),
  actionWidth = 72,
  direction = 'left',
  open = /** @type {any} */ (undefined),
  onOpenChange = /** @type {any} */ (undefined),
  onAction = /** @type {any} */ (undefined),
  closeOnAction = true,
  disabled = false,
  label = '一条记录',
  className = '',
  style = /** @type {any} */ (undefined),
}) {
  const reduced = useMotionReduced();
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open !== undefined ? open : innerOpen;
  const drawerWidth = actions.length * actionWidth;
  const x = useMotionValue(0);

  const settle = (next) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    animate(x, next ? -drawerWidth : 0, reduced ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 34 });
  };

  useEffect(() => {
    if (reduced) x.set(isOpen ? -drawerWidth : 0);
  }, [reduced, isOpen, drawerWidth, x]);

  const inert = disabled || actions.length === 0;
  const movedRef = useRef(0);

  return (
    <div
      className={`sr-wrap ${className}`.trim()}
      style={{ ...style, '--sr-drawer': `${drawerWidth}px`, '--sr-action': `${actionWidth}px` }}
    >
      <div className="sr-drawer" aria-hidden={!isOpen} style={{ width: `${drawerWidth}px` }}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`sr-action${action.color ? ' is-danger' : ''}`}
            tabIndex={isOpen ? 0 : -1}
            style={{ width: `${actionWidth}px`, ...(action.color ? { color: action.color } : null) }}
            onClick={() => {
              if (closeOnAction) settle(false);
              onAction?.(action);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      <motion.div
        className="sr-row"
        style={{ x }}
        drag={inert ? false : 'x'}
        dragConstraints={{ left: -drawerWidth, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragStart={() => {
          movedRef.current = 0;
        }}
        onDrag={(event, info) => {
          movedRef.current = Math.max(
            movedRef.current,
            Math.abs(info.offset.x) + Math.abs(info.offset.y),
          );
        }}
        onClickCapture={(event) => {
          // 拖动之后抬手那一下不要顺手把卡片点开，只让它归位。
          if (movedRef.current > 8) {
            event.preventDefault();
            event.stopPropagation();
            movedRef.current = 0;
          }
        }}
        onDragEnd={(event, info) => {
          const shouldOpen = info.offset.x < -drawerWidth * 0.34 || info.velocity.x < -320;
          settle(shouldOpen);
        }}
        onTap={() => {
          if (isOpen) settle(false);
        }}
        aria-label={label}
      >
        {children}
      </motion.div>
    </div>
  );
}
