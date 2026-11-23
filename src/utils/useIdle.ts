import { useEffect, useState } from 'react';

/**
 * 页面长时间没有交互时返回 true。
 * 用于刘看山打盹、远山缓慢浮动这类“安静下来才出现”的彩蛋。
 */
export function useIdle(delay: number) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer = 0;
    const reset = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest('.fox-hobby')) return;
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), delay);
    };

    reset();
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [delay]);

  return idle;
}
