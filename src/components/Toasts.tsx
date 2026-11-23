import { useEffect } from 'react';
import type { ToastState } from '../types';

function ToastItem({ toast, onDone }: { toast: ToastState; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(toast.id), toast.hint ? 6200 : 3600);
    return () => window.clearTimeout(timer);
  }, [toast, onDone]);

  return (
    <div className="toast" role="status">
      <span className="toast-text">{toast.text}</span>
      {toast.hint ? <span className="toast-hint">{toast.hint}</span> : null}
    </div>
  );
}

export function Toasts({ toasts, onDone }: { toasts: ToastState[]; onDone: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDone={onDone} />
      ))}
    </div>
  );
}
