import { useEffect, useState } from 'react';

export interface EchoDraft {
  text: string;
  nonce: number;
  source?: string;
}

interface EchoComposerProps {
  draft: EchoDraft | null;
  onSave: (text: string) => boolean;
  onDiscard: () => void;
}

/**
 * 回音谷里的写入口。这里是唯一能把文字变成正式回音的地方：
 * 只有用户点【确认存入山谷】，才写入存储。草稿本身不落库。
 * 练习带过来的草稿也只填在这里，等待用户自己确认。
 */
export function EchoComposer({ draft, onSave, onDiscard }: EchoComposerProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    // 只跟着草稿来：nonce 变了才整段替换，用户正在改的不会被打断。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.nonce]);

  const confirm = () => {
    if (!text.trim()) return;
    if (onSave(text)) setText('');
  };

  const fromExercise = Boolean(draft?.source);

  return (
    <div className={`echo-composer ${fromExercise ? 'is-draft' : ''}`}>
      <div className="echo-composer-head">
        <p className="echo-composer-title">写一条回音</p>
        {fromExercise ? (
          <span className="echo-draft-chip">
            来自【{draft?.source}】练习的草稿 · 还没保存
            <button type="button" className="echo-draft-drop" onClick={onDiscard}>
              丢弃
            </button>
          </span>
        ) : null}
      </div>

      <textarea
        value={text}
        rows={3}
        placeholder="此刻的感受、想法，原样留在这里就好。"
        aria-label="要留下的这句话"
        onChange={(event) => setText(event.target.value)}
      />

      <div className="echo-composer-foot">
        <span className="echo-composer-hint">
          {text.trim() ? '确认之后才会写进山谷，没确认就只有你自己看见。' : '不用写得完整，一句就够。'}
        </span>
        <button type="button" className="button primary" onClick={confirm} disabled={!text.trim()}>
          确认存入山谷
        </button>
      </div>

      {fromExercise && text.trim() ? (
        <p className="echo-composer-note">这段是练习里带过来的草稿，可以随便改，改成现在更想说的那句。</p>
      ) : null}
    </div>
  );
}
