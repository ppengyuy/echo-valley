'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';

import { useMotionReduced } from './gate';

gsap.registerPlugin(GSAPSplitText);

/**
 * SplitText 的克制版：
 * 只保留 rise / fade / blur 三种入场，不做 hover 上浮、不做循环、不做 pop/skew/flip。
 * 触发只保留 load / view。reduced 时完全不拆字，直接显示原文。
 */
const LOOKS = {
  rise: {
    from: { opacity: 0, y: 22 },
    to: { opacity: 1, y: 0 },
    ease: 'power2.out',
  },
  fade: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    ease: 'power1.inOut',
  },
  blur: {
    from: { opacity: 0, filter: 'blur(4px)' },
    to: { opacity: 1, filter: 'blur(0px)' },
    ease: 'power2.out',
  },
};

export default function SplitText({
  text,
  className = '',
  splitType = 'lines',
  effect = 'fade',
  trigger = 'view',
  duration = 1.2,
  delay = 60,
  staggerFrom = 'start',
  threshold = 0.1,
  rootMargin = '-80px',
  tag = 'p',
  mask = false,
  style = /** @type {any} */ (undefined),
  id = /** @type {any} */ (undefined),
  onComplete = /** @type {any} */ (undefined),
}) {
  const ref = useRef(null);
  const reduced = useMotionReduced();
  const [ready, setReady] = useState(false);
  const doneRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!text) {
      setReady(true);
      return undefined;
    }

    if (reduced) {
      gsap.set(el, { clearProps: 'all' });
      setReady(true);
      if (doneRef.current !== text) {
        doneRef.current = text;
        onCompleteRef.current?.();
      }
      return undefined;
    }

    const look = LOOKS[effect] ?? LOOKS.fade;
    const unit = splitType.includes('chars') ? 'chars' : splitType === 'words' ? 'words' : 'lines';

    const split = new GSAPSplitText(el, {
      type: splitType,
      linesClass: 'mt-split-line',
      wordsClass: 'mt-split-word',
      charsClass: 'mt-split-char',
      smartWrap: true,
      reduceWhiteSpace: false,
      mask: mask ? unit : undefined,
    });

    const pieces = (split[unit] && split[unit].length ? split[unit] : split.lines) ?? [];
    const targets = mask && split.masks && split.masks.length === pieces.length ? split.masks : pieces;

    const timeline = gsap.timeline({
      paused: trigger === 'view',
      onComplete: () => {
        gsap.set(targets, { clearProps: 'transform,opacity,filter' });
        setReady(true);
        if (doneRef.current !== text) {
          doneRef.current = text;
          onCompleteRef.current?.();
        }
      },
    });

    gsap.set(targets, { ...look.from, willChange: 'transform, opacity, filter' });
    timeline.to(targets, {
      ...look.to,
      duration,
      ease: look.ease,
      stagger: delay / 1000,
      staggerFrom,
    });

    if (trigger === 'load' || reduced) {
      timeline.play(0);
      return () => {
        timeline.kill();
        split.revert();
      };
    }

    // trigger="view"：用最轻的 IntersectionObserver 进场播放，不引入 ScrollTrigger。
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          timeline.play(0);
          io.disconnect();
        }
      },
      {
        threshold: Math.max(0.1, Math.min(1, threshold || 0.1)),
        rootMargin,
      },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      timeline.kill();
      split.revert();
    };
  }, [text, splitType, effect, trigger, duration, delay, staggerFrom, threshold, rootMargin, mask, reduced]);

  const Tag = tag || 'p';

  return (
    <>
      <Tag
        ref={ref}
        id={id}
        className={`mt-split ${className}`.trim()}
        style={style}
      >
        {text}
      </Tag>
    </>
  );
}
