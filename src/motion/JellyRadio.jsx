'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

import './JellyRadio.css';
import { useMotionReduced } from './gate';

/**
 * Jelly Radio 的克制版：
 * 保留「选中 → 邻居让位」的弹性排布，把 swell / bounce 全部调低，
 * 换掉项目里那些呆板的 chip 按钮；键盘左右箭头仍可切换。
 */
export default function JellyRadio({
  items = /** @type {Array<any>} */ ([]),
  value = /** @type {any} */ (undefined),
  defaultValue = /** @type {any} */ (undefined),
  onChange = /** @type {any} */ (undefined),
  size = 'md',
  gap = 8,
  radius = 18,
  swell = 0.12,
  bounce = 0.2,
  stagger = 18,
  stiffness = 520,
  ariaLabel = '选项',
  className = '',
  disabled = false,
}) {
  const normalized = items.map((item) =>
    typeof item === 'string' ? { value: item, label: item } : item,
  );
  const [inner, setInner] = useState(defaultValue ?? normalized[0]?.value);
  const current = value !== undefined ? value : inner;
  const reduced = useMotionReduced();

  const transition = reduced
    ? { duration: 0 }
    : { type: 'spring', stiffness, damping: 22 + (1 - bounce) * 8, mass: 0.9, delay: stagger / 1000 };

  const commit = (next) => {
    if (disabled) return;
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const step = (dir) => {
    const index = normalized.findIndex((item) => item.value === current);
    const next = normalized[(index + dir + normalized.length) % normalized.length];
    if (next) commit(next.value);
  };

  return (
    <div
      className={`jr-group jr-${size} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ gap: `${gap}px`, '--jr-radius': `${radius}px`, '--jr-swell': swell }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          step(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      {normalized.map((item) => {
        const active = item.value === current;
        return (
          <motion.button
            key={item.value}
            type="button"
            layout
            role="radio"
            aria-checked={active}
            disabled={disabled || item.disabled}
            className={`jr-chip${active ? ' is-active' : ''}`}
            onClick={() => commit(item.value)}
            transition={transition}
            animate={reduced ? undefined : { scale: active ? 1 + swell * 0.12 : 1 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
          >
            {item.icon ? <span className="jr-icon">{item.icon}</span> : null}
            <span>{item.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
