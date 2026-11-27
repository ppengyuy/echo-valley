import { useEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import type { ChatMessage, EchoOffer, MirrorInvite, MirrorStage } from '../types';
import { Fox } from './Fox';

interface ChatThreadProps {
  messages: ChatMessage[];
  offer: EchoOffer | null;
  mirrorInvite: MirrorInvite | null;
  mirrorStage: MirrorStage;
  typing: boolean;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onRequestReply: () => void;
  onSilentKeep: () => void;
  onAcceptMirror: () => void;
  onDeclineMirror: () => void;
  /** 把自己说过的话放回输入框，改一改再问一次。 */
  onReuse?: (text: string) => void;
}

/**
 * 复制一段文字。
 *
 * 优先用 Clipboard API；站内托管 / 非安全上下文 / iframe 里它常被权限策略挡下，
 * 所以带一层 execCommand 兜底。降级方案会先记下并恢复用户原本的选区，
 * 不会把人家正在拖选的文字冲掉。
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 继续走兜底。
    }
  }

  const selection = document.getSelection();
  const saved = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);

  if (selection && saved) {
    selection.removeAllRanges();
    selection.addRange(saved);
  }
  return ok;
}

export function ChatThread({
  messages,
  offer,
  mirrorInvite,
  mirrorStage,
  typing,
  onAcceptOffer,
  onDeclineOffer,
  onRequestReply,
  onSilentKeep,
  onAcceptMirror,
  onDeclineMirror,
  onReuse,
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, offer, mirrorInvite, typing]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyText(text);
    setCopied({ id, ok });
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(null), 1900);
  };

  return (
    <div className="thread" role="log" aria-live="polite" aria-label="回音谷里的对话">
      <div className="thread-date">今天</div>
      {messages.map((message) => (
        <div key={message.id} className={`message-row ${message.role}`}>
          {message.role === 'assistant' ? (
            <div className="avatar" aria-hidden="true">
              <Fox className="avatar-fox" />
            </div>
          ) : null}
          <div className="message-stack">
            {message.weather ? (
              <p className="weather-line">{COPY.weather[message.weather.kind]}</p>
            ) : null}
            <div className={`bubble ${message.role} ${message.quiet ? 'is-quiet' : ''}`}>{message.text}</div>
            <div className="message-tools">
              <button
                type="button"
                className={`message-tool ${copied?.id === message.id ? 'is-feedback' : ''}`}
                onClick={() => void handleCopy(message.id, message.text)}
                title={COPY.messageCopyTitle}
                aria-label={COPY.messageCopyTitle}
              >
                {copied?.id === message.id
                  ? copied.ok
                    ? COPY.messageCopied
                    : COPY.messageCopyFail
                  : COPY.messageCopy}
              </button>
              {message.role === 'user' && onReuse ? (
                <button
                  type="button"
                  className="message-tool"
                  onClick={() => onReuse(message.text)}
                  title={COPY.messageReuseTitle}
                  aria-label={COPY.messageReuseTitle}
                >
                  {COPY.messageReuse}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {offer ? (
        <div className="message-row assistant">
          <div className="avatar" aria-hidden="true">
            <Fox className="avatar-fox" />
          </div>
          <div className={`offer-card ${offer.mirror ? 'is-mirror' : ''}`}>
            <p className="offer-lead">{offer.silent ? COPY.silentConfirm : COPY.saveOffer}</p>
            <blockquote>{offer.text}</blockquote>
            <div className="offer-actions">
              <button type="button" className="button primary" onClick={onAcceptOffer}>
                {COPY.offerSave}
              </button>
              {offer.silent ? (
                <>
                  <button type="button" className="button ghost" onClick={onRequestReply}>
                    {COPY.silentTalk}
                  </button>
                  <button type="button" className="text-button" onClick={onSilentKeep}>
                    {COPY.silentKeep}
                  </button>
                </>
              ) : (
                <button type="button" className="button ghost" onClick={onDeclineOffer}>
                  {COPY.offerKeep}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {mirrorInvite ? (
        <div className="message-row assistant">
          <div className="avatar" aria-hidden="true">
            <Fox className="avatar-fox" />
          </div>
          <div className="offer-card mirror-invite">
            <p className="offer-lead">如果愿意，可以换一个位置看看这句话。</p>
            <p className="offer-sub">
              如果是你最好的朋友看见现在的你，会对你说什么？可以试着写下来，送给此刻的自己。
            </p>
            <div className="offer-actions">
              <button type="button" className="button primary" onClick={onAcceptMirror}>
                试试看
              </button>
              <button type="button" className="button ghost" onClick={onDeclineMirror}>
                先不用
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mirrorStage === 'writing' ? (
        <p className="stage-hint" role="note">
          写给此刻的自己。写完可以存入山谷，也可以先不存。
        </p>
      ) : null}

      {typing ? (
        <div className="message-row assistant is-typing">
          <div className="avatar" aria-hidden="true">
            <Fox className="avatar-fox" />
          </div>
          <div className="bubble assistant typing" aria-label={COPY.listening}>
            <Fox className="typing-fox" />
            <span className="typing-text">在听</span>
          </div>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
