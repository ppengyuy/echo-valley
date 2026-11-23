import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { COPY } from '../copy';
import type { MirrorStage } from '../types';
import { PebbleIcon } from './PebbleIcon';

interface ComposerProps {
  onSend: (text: string, silent: boolean) => void;
  onExitMirror: () => void;
  mirrorStage: MirrorStage;
  showQuick: boolean;
  disabled?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  quiet?: boolean;
  quietPanelOpen?: boolean;
  onToggleQuiet?: () => void;
  /** 输入框上方「捡到一句话」轻入口，粘贴别人的话进溪滩。 */
  onPickStone?: () => void;
}

/** 入口图标：闭着眼的刘看山，呼应「今天不用说话」。 */
function QuietFoxIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10 19 9 8l9 5M38 19l1-11-9 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M24 41c-9 0-15-6-15-15V17c0-3 2-5 5-5h20c3 0 5 2 5 5v9c0 9-6 15-15 15Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M15 23c2 2 5 2 7 0M26 23c2 2 5 2 7 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 30c1.2 1 2.8 1 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Composer({
  onSend,
  onExitMirror,
  mirrorStage,
  showQuick,
  disabled,
  inputRef,
  quiet = false,
  quietPanelOpen = false,
  onToggleQuiet,
  onPickStone,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [silent, setSilent] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? fallbackRef;

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value, silent);
    setText('');
    setSilent(false);
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const placeholder =
    mirrorStage === 'writing' ? '写一句给此刻的自己……' : COPY.composePlaceholder;

  return (
    <div className={`composer ${silent ? 'silent-on' : ''}`}>
      {showQuick ? (
        <div className="quick-row">
          <span className="quick-label">如果不知道从哪一句开始</span>
          <div className="quick-chips">
            {COPY.quick.map((item) => (
              <button
                key={item}
                type="button"
                className="chip"
                onClick={() => onSend(item, false)}
                disabled={disabled}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="composer-topline">
        <div className="composer-topline-left">
          <label className="silent-toggle">
            <input
              type="checkbox"
              checked={silent}
              onChange={(event) => setSilent(event.target.checked)}
              disabled={mirrorStage === 'writing' || quiet}
            />
            <span>{COPY.silentToggle}</span>
          </label>
          {onToggleQuiet ? (
            <button
              type="button"
              className={`quiet-chip ${quietPanelOpen ? 'is-on' : ''} ${quiet ? 'is-quiet' : ''}`}
              aria-expanded={quietPanelOpen}
              aria-label={`${COPY.quietEntry}：${COPY.quietEntrySub}`}
              title={COPY.quietEntrySub}
              onClick={onToggleQuiet}
              disabled={mirrorStage === 'writing'}
            >
              <span className="quiet-chip-icon" aria-hidden="true">
                <QuietFoxIcon />
              </span>
              <span>{COPY.quietEntry}</span>
            </button>
          ) : null}
          {onPickStone ? (
            <button
              type="button"
              className="pick-stone-chip"
              onClick={onPickStone}
              title={COPY.stone.pickEntryHint}
              aria-label={`${COPY.stone.pickEntry}：${COPY.stone.pickEntryHint}`}
              disabled={mirrorStage === 'writing'}
            >
              <span className="pick-stone-chip-icon" aria-hidden="true">
                <PebbleIcon />
              </span>
              <span>{COPY.stone.pickEntry}</span>
            </button>
          ) : null}
        </div>
        <span className="composer-hint">
          {silent
            ? COPY.silentHint
            : mirrorStage === 'writing'
              ? '不用写得完整，一句就够。'
              : 'Enter 说给刘看山，Shift + Enter 换行'}
        </span>
      </div>

      <div className="composer-box">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => {
            setText(event.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <button
          type="button"
          className="send-button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label={silent ? COPY.composeSend : COPY.composeSendTalk}
        >
          <span className="send-arrow" aria-hidden="true">
            ↑
          </span>
        </button>
      </div>

      <div className="composer-foot">
        {mirrorStage === 'writing' ? (
          <button type="button" className="text-button small" onClick={onExitMirror}>
            先不写了
          </button>
        ) : (
          <span className="composer-foot-note">山谷不会催你，想说什么都可以。</span>
        )}
      </div>
    </div>
  );
}
