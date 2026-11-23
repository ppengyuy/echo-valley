import { useEffect, useRef } from 'react';
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
}: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, offer, mirrorInvite, typing]);

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
