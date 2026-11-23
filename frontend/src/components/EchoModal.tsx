import { useEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import type { Echo } from '../types';
import { echoTimeLabel } from '../utils/date';
import { Modal } from './Modal';

interface EchoModalProps {
  echo: Echo | null;
  onClose: () => void;
  onArchive: (echo: Echo, archived: boolean) => void;
  onDelete: (echo: Echo) => void;
  onUpdate: (id: string, patch: Partial<Echo>) => void;
  onCard: (echo: Echo) => void;
}

/** 正文最多多长：和「存回音」一路的上限保持一致，不鼓励写成长文。 */
const TEXT_MAX = 300;

const safeUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    return null;
  }
  return null;
};

export function EchoModal({ echo, onClose, onArchive, onDelete, onUpdate, onCard }: EchoModalProps) {
  const [tag, setTag] = useState('');
  const [link, setLink] = useState('');
  const [linkNote, setLinkNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [linkHint, setLinkHint] = useState('');
  const [copied, setCopied] = useState(false);
  /** 正文编辑：默认是只读的，必须显式点「改一改这句话」才进入。 */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [textHint, setTextHint] = useState('');
  const [textSaved, setTextSaved] = useState(false);
  /** 改了还没保存就想关窗时，先问一句，别把字弄丢。 */
  const [discardAsk, setDiscardAsk] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTag(echo?.tag ?? '');
    setLink(echo?.link ?? '');
    setLinkNote(echo?.linkNote ?? '');
    setSaved(false);
    setLinkHint('');
    // 换一条回音就退出编辑态，不把上一条的草稿带过来。
    setEditing(false);
    setDraft(echo?.text ?? '');
    setTextHint('');
    setTextSaved(false);
    setDiscardAsk(false);
    // 只在切换到另一条回音时重置；保存备注后保留“已经放好了”的轻提示。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo?.id]);

  // 进入编辑态就把光标放到正文末尾，省一次点击。
  useEffect(() => {
    if (!editing) return;
    const field = textRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editing]);

  const dirty = editing && draft !== (echo?.text ?? '');

  // 正文改了还没保存时，拦住 ESC 与点背景关窗，先问一句。
  useEffect(() => {
    if (!dirty) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDiscardAsk(true);
    };
    // 捕获阶段先拿到，才能挡在 Modal 自己的 ESC 处理之前。
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [dirty]);

  if (!echo) return null;

  const copyText = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(echo.text);
      } else {
        const field = document.createElement('textarea');
        field.value = echo.text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const saveDetails = () => {
    const cleanTag = tag.trim().replace(/^#\s*/, '');
    const cleanLink = link.trim();
    const cleanNote = linkNote.trim();
    if (cleanLink && !safeUrl(cleanLink)) {
      setLinkHint(COPY.linkInvalid);
      return;
    }
    setLinkHint('');
    onUpdate(echo.id, {
      tag: cleanTag || undefined,
      link: cleanLink || undefined,
      linkNote: cleanNote || undefined,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  /** 保存正文：只写用户自己改出来的文字，不加工、不润色、不改时间。 */
  const saveText = () => {
    const next = draft.trim();
    if (!next) {
      setTextHint(COPY.echoEdit.empty);
      return;
    }
    if (next === echo.text) {
      setTextHint(COPY.echoEdit.unchanged);
      setEditing(false);
      return;
    }
    onUpdate(echo.id, { text: next });
    setEditing(false);
    setTextHint('');
    setTextSaved(true);
    window.setTimeout(() => setTextSaved(false), 2600);
  };

  /** 放弃这次改动，回到原话；原话本身不动。 */
  const cancelText = () => {
    setDraft(echo.text);
    setEditing(false);
    setTextHint('');
    setDiscardAsk(false);
  };

  /** 正文改了还没保存时，关窗先问一句。 */
  const requestClose = () => {
    if (dirty) {
      setDiscardAsk(true);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      title={COPY.actions.listen}
      onClose={requestClose}
      label="echo"
      footer={
        <>
          <button type="button" className="button ghost" onClick={copyText} disabled={editing}>
            {copied ? COPY.copyEchoDone : COPY.copyEcho}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => onCard(echo)}
            disabled={editing}
          >
            {COPY.excerptCard}
          </button>
          {echo.archived ? (
            <button
              type="button"
              className="button ghost"
              onClick={() => onArchive(echo, false)}
              disabled={editing}
            >
              {COPY.actions.unarchive}
            </button>
          ) : (
            <button
              type="button"
              className="button ghost"
              onClick={() => onArchive(echo, true)}
              disabled={editing}
            >
              {COPY.actions.archive}
            </button>
          )}
          <button
            type="button"
            className="text-button danger-quiet"
            onClick={() => onDelete(echo)}
            disabled={editing}
          >
            {COPY.actions.letGo}
          </button>
        </>
      }
    >
      <div className="listening">
        <div className="listening-rings" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        {editing ? (
          /* 编辑态：改的是你自己写下的原话，改完要显式保存 */
          <div className="echo-edit">
            <p className="echo-edit-hint">
              {echo.mirror ? COPY.echoEdit.mirrorHint : COPY.echoEdit.hint}
            </p>
            <textarea
              ref={textRef}
              className="echo-edit-input"
              value={draft}
              rows={4}
              maxLength={TEXT_MAX}
              aria-label={COPY.echoEdit.entry}
              onChange={(event) => {
                setDraft(event.target.value);
                setTextHint('');
              }}
            />
            <div className="echo-edit-foot">
              <span className="echo-edit-count">
                {draft.trim().length} / {TEXT_MAX}
              </span>
              <div className="echo-edit-actions">
                <button type="button" className="text-button small" onClick={cancelText}>
                  {COPY.echoEdit.cancel}
                </button>
                <button
                  type="button"
                  className="button primary small"
                  disabled={!draft.trim()}
                  onClick={saveText}
                >
                  {COPY.echoEdit.save}
                </button>
              </div>
            </div>
            {textHint ? <p className="field-hint">{textHint}</p> : null}
          </div>
        ) : (
          <>
            <blockquote className="listening-quote">{echo.text}</blockquote>
            <p className="listening-time">{echoTimeLabel(echo.createdAt, 1)}</p>
            {echo.mirror ? <p className="mirror-mark">{COPY.mirrorMark}</p> : null}
            <div className="echo-edit-entry-row">
              <button
                type="button"
                className="text-button small"
                onClick={() => {
                  setDraft(echo.text);
                  setEditing(true);
                  setTextHint('');
                }}
              >
                {COPY.echoEdit.entry}
              </button>
              {textSaved ? <span className="echo-edit-done">{COPY.echoEdit.saved}</span> : null}
              {!textSaved && textHint ? <span className="field-note">{textHint}</span> : null}
            </div>
          </>
        )}
      </div>

      {/* 改了没保存就想关窗：先问一句，不替用户丢掉这几个字 */}
      {discardAsk ? (
        <div className="echo-edit-discard" role="alertdialog" aria-label={COPY.echoEdit.discardTitle}>
          <p className="echo-edit-discard-title">{COPY.echoEdit.discardTitle}</p>
          <p>{COPY.echoEdit.discardBody}</p>
          <div className="echo-edit-discard-actions">
            <button
              type="button"
              className="button ghost small"
              onClick={() => {
                cancelText();
                onClose();
              }}
            >
              {COPY.echoEdit.discardOk}
            </button>
            <button
              type="button"
              className="text-button small"
              onClick={() => setDiscardAsk(false)}
            >
              {COPY.echoEdit.discardCancel}
            </button>
          </div>
        </div>
      ) : null}

      {echo.link && safeUrl(echo.link) ? (
        <p className="echo-source">
          来自这篇文章：
          <a href={safeUrl(echo.link) ?? '#'} target="_blank" rel="noreferrer noopener">
            {echo.linkNote || '打开来源'}
          </a>
        </p>
      ) : null}

      <div className={`echo-fields ${editing ? 'is-locked' : ''}`}>
        <label className="field">
          <span>{COPY.tagHint}</span>
          <div className="field-row">
            <input
              value={tag}
              maxLength={12}
              disabled={editing}
              placeholder="比如：备考 / 读书 / 今天"
              onChange={(event) => setTag(event.target.value)}
            />
            {echo.tag ? (
              <button
                type="button"
                className="text-button"
                disabled={editing}
                onClick={() => setTag('')}
              >
                去掉标签
              </button>
            ) : null}
          </div>
        </label>

        <label className="field">
          <span>{COPY.linkPlaceholder}</span>
          <input
            value={link}
            type="url"
            disabled={editing}
            placeholder="https://…"
            onChange={(event) => {
              setLink(event.target.value);
              setLinkHint('');
            }}
          />
        </label>
        <label className="field">
          <span>{COPY.linkNotePlaceholder}</span>
          <input
            value={linkNote}
            disabled={editing}
            placeholder="比如：知乎上的一段回答"
            onChange={(event) => setLinkNote(event.target.value)}
          />
        </label>
        {linkHint ? <p className="field-hint">{linkHint}</p> : null}
        <div className="field-actions">
          <button
            type="button"
            className="button ghost small"
            disabled={editing}
            onClick={saveDetails}
          >
            {saved ? '已经放好了' : '把这段备注放好'}
          </button>
          <span className="field-note">只留下链接和你的备注，不会去打开或摘取文章里的内容。</span>
        </div>
      </div>
    </Modal>
  );
}
