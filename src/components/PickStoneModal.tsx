import { useEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import type { Stone, StoneType } from '../types';
import { Modal } from './Modal';

interface PickStoneModalProps {
  open: boolean;
  /** 从 AI 候选 / 对话带过来的预填文字，可空。 */
  presetText?: string;
  presetSource?: string;
  onClose: () => void;
  onPick: (stone: Omit<Stone, 'id' | 'saved_at'>) => void;
}

/** 捡起一颗石子：用户自己填原文与来源、自己选类型；AI 不预判、不打分。 */
export function PickStoneModal({
  open,
  presetText = '',
  presetSource = '',
  onClose,
  onPick,
}: PickStoneModalProps) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [type, setType] = useState<StoneType | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [hint, setHint] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(presetText);
    setSource(presetSource);
    setType(null);
    setNote('');
    setTags('');
    setHint('');
  }, [open, presetText, presetSource]);

  // 不限字数：输入框跟着内容长高，写多少都能一眼看全，不用在框里滚动。
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, open]);

  const pick = () => {
    const cleanText = text.trim();
    const cleanSource = source.trim();
    if (!cleanText) {
      setHint(COPY.stone.textRequired);
      return;
    }
    if (!cleanSource) {
      setHint(COPY.stone.sourceRequired);
      return;
    }
    if (!type) {
      setHint(COPY.stone.typeRequired);
      return;
    }
    const tagList = tags
      .split(/[,，\s]+/)
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 4);
    onPick({
      text: cleanText,
      source: cleanSource,
      type,
      my_note: note.trim() || undefined,
      tags: tagList.length ? tagList : undefined,
    });
  };

  return (
    <Modal
      open={open}
      title={COPY.stone.pickTitle}
      onClose={onClose}
      label="pick-stone"
      footer={
        <>
          <span className="modal-foot-note">别人说过的话，不会变成你的回音或待办。</span>
          <button type="button" className="button primary" onClick={pick}>
            {COPY.stone.pickConfirm}
          </button>
        </>
      }
    >
      <div className="pick-stone-form">
        <p className="pick-stone-lead">{COPY.stone.pickLead}</p>

        <label className="editor-field">
          <span>那句话</span>
          <textarea
            ref={textRef}
            className="editor-textarea pick-stone-textarea"
            value={text}
            rows={3}
            placeholder={COPY.stone.pickPlaceholder}
            aria-label={COPY.stone.pickPlaceholder}
            onChange={(event) => setText(event.target.value)}
          />
          <span className="editor-hint">写多少都行，能看全，不用截断。</span>
        </label>

        <label className="editor-field">
          <span>来自哪里</span>
          <input
            className="editor-input"
            value={source}
            placeholder={COPY.stone.sourcePlaceholder}
            aria-label={COPY.stone.sourcePlaceholder}
            onChange={(event) => setSource(event.target.value)}
          />
        </label>

        <div className="editor-field">
          <span>{COPY.stone.typeTitle}</span>
          <div className="stone-type-choices">
            <button
              type="button"
              className={`stone-type-choice method ${type === 'method' ? 'is-on' : ''}`}
              aria-pressed={type === 'method'}
              onClick={() => {
                setType('method');
                setHint('');
              }}
            >
              <span className="stone-type-name">{COPY.stone.typeMethod}</span>
              <span className="stone-type-hint">{COPY.stone.typeMethodHint}</span>
            </button>
            <button
              type="button"
              className={`stone-type-choice touch ${type === 'touch' ? 'is-on' : ''}`}
              aria-pressed={type === 'touch'}
              onClick={() => {
                setType('touch');
                setHint('');
              }}
            >
              <span className="stone-type-name">{COPY.stone.typeTouch}</span>
              <span className="stone-type-hint">{COPY.stone.typeTouchHint}</span>
            </button>
          </div>
        </div>

        <label className="editor-field">
          <span>批注（可选）</span>
          <input
            className="editor-input"
            value={note}
            placeholder={COPY.stone.notePlaceholder}
            aria-label={COPY.stone.notePlaceholder}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <label className="editor-field">
          <span>标签（可选）</span>
          <input
            className="editor-input"
            value={tags}
            placeholder={COPY.stone.tagsPlaceholder}
            aria-label={COPY.stone.tagsPlaceholder}
            onChange={(event) => setTags(event.target.value)}
          />
        </label>

        {hint ? <p className="stone-form-hint" role="alert">{hint}</p> : null}
      </div>
    </Modal>
  );
}
