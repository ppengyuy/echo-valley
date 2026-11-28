'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

import './TrueFocus.css';
import { useMotionReduced } from './gate';

/**
 * TrueFocus 的克制版：
 * 只做「逐条聚焦」的视觉框，不做彩虹、不做点击吃事件。
 * 外层永远是纯展示容器：框和底下三条都不是按钮，点击需求交给页面自己的控件。
 * 中文没有空格，所以 separator 默认 '|'，句子里的「、」写在每个词尾部。
 */

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const FRAME_GAP = 8;
const SMOOTH_EASE = [0.65, 0, 0.35, 1];

const useIsoEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function TrueFocus({
  sentence = '',
  separator = '|',
  focusStyle = 'underline',
  blurAmount = 2.4,
  borderColor = 'var(--accent)',
  animationDuration = 0.7,
  pauseBetweenAnimations = 2.2,
  cornerSize = 12,
  borderWidth = 2,
  order = 'sequential',
  className = '',
}) {
  const words = sentence
    .split(separator)
    .map((word) => word.trim())
    .filter(Boolean);

  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState(null);
  const containerRef = useRef(null);
  const wordRefs = useRef([]);
  const reduced = useMotionReduced();

  useEffect(() => {
    if (reduced || words.length < 2) return undefined;
    const timer = setInterval(
      () => {
        setIndex((prev) => {
          if (order !== 'random') return (prev + 1) % words.length;
          const next = Math.floor(Math.random() * (words.length - 1));
          return next >= prev % words.length ? next + 1 : next;
        });
      },
      (animationDuration + pauseBetweenAnimations) * 1000,
    );
    return () => clearInterval(timer);
  }, [reduced, words.length, animationDuration, pauseBetweenAnimations, order]);

  useIsoEffect(() => {
    const container = containerRef.current;
    const word = wordRefs.current[index];
    if (!container || !word) return undefined;
    const measure = () => {
      const next = {
        x: word.offsetLeft,
        y: word.offsetTop,
        width: word.offsetWidth,
        height: word.offsetHeight,
      };
      setFrame((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    wordRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [index, sentence, separator]);

  const shapes =
    frame && {
      underline: { x: frame.x, y: frame.y + frame.height + FRAME_GAP * 0.4, width: frame.width, height: borderWidth },
      box: { x: frame.x - 8, y: frame.y - 8, width: frame.width + 16, height: frame.height + 16 },
    };

  const cornerSpots =
    frame && {
      'top-left': { x: frame.x - 14, y: frame.y - 14 },
      'top-right': { x: frame.x + frame.width + 14 - cornerSize, y: frame.y - 14 },
      'bottom-left': { x: frame.x - 14, y: frame.y + frame.height + 14 - cornerSize },
      'bottom-right': { x: frame.x + frame.width + 14 - cornerSize, y: frame.y + frame.height + 14 - cornerSize },
    };

  return (
    <div
      ref={containerRef}
      className={`tf-container ${className}`.trim()}
      style={{ '--tf-border': borderColor, '--tf-corner': `${cornerSize}px`, '--tf-width': `${borderWidth}px` }}
    >
      {words.map((word, i) => {
        const active = !reduced && i === index;
        return (
          <span
            key={`${word}-${i}`}
            ref={(node) => {
              wordRefs.current[i] = node;
            }}
            className={`tf-word${active ? ' is-active' : ''}`}
            style={{
              filter: reduced || active ? 'none' : `blur(${blurAmount}px)`,
              opacity: reduced || active ? 1 : 0.62,
              transition: reduced ? undefined : `filter ${animationDuration}s ease, opacity ${animationDuration}s ease`,
            }}
          >
            {word}
          </span>
        );
      })}

      {!reduced && shapes && focusStyle === 'underline' && (
        <motion.span
          aria-hidden="true"
          className="tf-underline"
          initial={{ ...shapes.underline, opacity: 0 }}
          animate={{ ...shapes.underline, opacity: 1 }}
          transition={{ duration: animationDuration, ease: SMOOTH_EASE }}
        />
      )}

      {!reduced && shapes && focusStyle === 'box' && (
        <>
          {CORNERS.map((corner) => (
            <motion.span
              key={corner}
              aria-hidden="true"
              className={`tf-corner ${corner}`}
              initial={{ ...(cornerSpots?.[corner] ?? {}), opacity: 0 }}
              animate={{ ...(cornerSpots?.[corner] ?? {}), opacity: 1 }}
              transition={{ duration: animationDuration, ease: SMOOTH_EASE }}
            />
          ))}
        </>
      )}
    </div>
  );
}
