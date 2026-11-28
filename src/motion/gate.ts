import { useSyncExternalStore } from 'react';

/**
 * 动效总闸。
 * 两个来源任一为真就整体降级：页头「减少动态效果」勾选，或系统 prefers-reduced-motion。
 * 降级后所有组件退回「直接显示 / 无手势 / 无弹跳」，不 split、不 shred、不 spring。
 */

let userReduced = false;
let systemReduced = false;
let listening = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((fn) => fn());
};

function ensureSystemWatcher() {
  if (listening || typeof window === 'undefined' || !window.matchMedia) return;
  listening = true;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  systemReduced = query.matches;
  query.addEventListener('change', (event) => {
    systemReduced = event.matches;
    emit();
  });
}

export function setUserReduced(value: boolean) {
  ensureSystemWatcher();
  if (userReduced === value) return;
  userReduced = value;
  emit();
}

export function motionReduced() {
  return userReduced || systemReduced;
}

export function subscribeMotion(listener: () => void) {
  ensureSystemWatcher();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMotionReduced() {
  return useSyncExternalStore(subscribeMotion, motionReduced, () => true);
}

/** 只给「手势类」组件用：触屏/窄屏才开启拖拽，桌面保留按钮。 */
export function useTouchFirst() {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const query = window.matchMedia('(hover: none), (max-width: 979px)');
      query.addEventListener('change', listener);
      return () => query.removeEventListener('change', listener);
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: none), (max-width: 979px)').matches
      : false,
    () => false,
  );
}
