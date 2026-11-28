'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

import './Shredder.css';
import { useMotionReduced } from './gate';

/**
 * Shredder 的轻量版：
 * 保留「纸条过滚轴、切断、卷着落下」的效果与语义（消散），
 * 不搬整套拖拽进槽的列表机器——只在单条消散/清空那一刻播一次。
 * 播完调用 onDone，由调用方真正落库删除；绝不先删后播。
 */
export default function Shredder({
  text = '',
  meta = '',
  stripWidth = 8,
  fallHeight = 120,
  curl = 0.6,
  duration = 1.15,
  height = 180,
  onDone,
}) {
  const wrapRef = useRef(null);
  const reduced = useMotionReduced();
  const [width, setWidth] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const count = width ? Math.max(10, Math.min(40, Math.round(width / stripWidth))) : 0;
  const realStrip = width && count ? width / count : stripWidth;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => setWidth(wrap.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !count) return undefined;
    if (reduced) {
      const timer = window.setTimeout(() => doneRef.current?.(), 240);
      return () => window.clearTimeout(timer);
    }

    const ctx = gsap.context(() => {
      const strips = gsap.utils.toArray('.shred-strip');
      const timeline = gsap.timeline({ onComplete: () => doneRef.current?.() });
      timeline.fromTo('.shred-slit', { scaleX: 0.35, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.26, ease: 'power2.out' });
      timeline.to('.shred-sheet', { y: 24, duration: 0.26, ease: 'power2.in' }, 0.04);
      timeline.to(
        strips,
        {
          y: fallHeight,
          opacity: 0,
          rotate: () => gsap.utils.random(-3.5, 3.5) * curl,
          scaleY: 1.3,
          duration: duration * 0.85,
          ease: 'power2.in',
          stagger: { each: 0.014, from: 'start' },
        },
        0.26,
      );
    }, wrap);

    return () => ctx.revert();
  }, [reduced, curl, duration, fallHeight, count]);

  return (
    <div
      className="shred"
      ref={wrapRef}
      style={{ '--shred-h': `${height}px`, '--shred-fall': `${fallHeight}px`, '--shred-w': `${width}px` }}
      aria-hidden="true"
    >
      <div className="shred-machine">
        {count ? (
          <div className="shred-sheet">
            {Array.from({ length: count }).map((_, index) => {
              // 按整数像素切条，缝里不会出现半条重复的字。
              const from = Math.round(index * realStrip);
              const to = index === count - 1 ? Math.round(width) : Math.round((index + 1) * realStrip);
              return (
                <span
                  key={index}
                  className="shred-strip"
                  style={{ width: `${to - from}px`, left: `${from}px` }}
                >
                  <span className="shred-strip-inner" style={{ left: `${-from}px`, width: `${Math.round(width)}px` }}>
                    <span className="shred-text">{text}</span>
                    {meta ? <span className="shred-meta">{meta}</span> : null}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}
        <div className="shred-slit" />
        <div className="shred-fall" />
      </div>
    </div>
  );
}
