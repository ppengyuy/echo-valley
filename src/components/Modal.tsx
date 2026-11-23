import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  label?: string;
}

/**
 * 统一的弹层：雾层铺开 → 弹窗上浮；关闭时弹窗先淡出，雾再慢慢收回。
 * 雾色跟随四季变量，减少动态效果时只保留淡入淡出。
 */
export function Modal({ open, title, onClose, children, footer, wide, label }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const timers = useRef<number[]>([]);

  const [closing, setClosing] = useState(false);
  const [veilClosing, setVeilClosing] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setClosing(false);
      setVeilClosing(false);
      return;
    }
    previousFocus.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 420);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(timer);
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      previousFocus.current?.focus?.();
    };
  }, [open]);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    timers.current.push(
      window.setTimeout(() => setVeilClosing(true), 300),
      window.setTimeout(() => {
        setClosing(false);
        setVeilClosing(false);
        onCloseRef.current();
      }, 720),
    );
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // requestClose 只依赖 closing，闭包里读最新值即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  if (!open) return null;

  const titleId = `modal-title-${label ?? title}`;

  return createPortal(
    <div
      className={`modal-backdrop ${veilClosing ? 'is-veil-closing' : ''}`}
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''} ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="先收起来">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
