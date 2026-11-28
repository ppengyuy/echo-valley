import { useEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import type { Stone } from '../types';
import { Modal } from './Modal';
import { StonePebble, shapeFor } from './StonePebble';
import JellyRadio from '../motion/JellyRadio.jsx';

interface StoneListProps {
  stones: Stone[];
  reduced: boolean;
  onIntoWater: (stone: Stone, written: string) => void;
  onToPath: (stone: Stone) => void;
  onLetFlow: (stone: Stone) => void;
  onReorder: (id: string, targetId: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  justPickedId?: string | null;
}

export function StoneList({
  stones,
  reduced,
  onIntoWater,
  onToPath,
  onLetFlow,
  onReorder,
  onUpdateTags,
  justPickedId,
}: StoneListProps) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [writing, setWriting] = useState<Stone | null>(null);
  const [draft, setDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  /** 点开哪一颗看全文；不点就保持两行预览，不主动展开。 */
  const [openId, setOpenId] = useState<string | null>(null);
  const waterRef = useRef<HTMLTextAreaElement>(null);

  // 放进水里写的这段也不限字数：框随内容长高，写多少都看得全。
  useEffect(() => {
    const el = waterRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, writing]);

  const saveTags = (stone: Stone) => {
    const list = tagDraft
      .split(/[,，\s]+/)
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 4);
    onUpdateTags(stone.id, list);
    setTagEditId(null);
    setTagDraft('');
  };

  const searching = query.trim().length > 0;
  const tags = Array.from(new Set(stones.flatMap((stone) => stone.tags ?? [])));
  let shown = stoneSorted(stones);
  if (tag !== 'all') shown = shown.filter((stone) => (stone.tags ?? []).includes(tag));
  if (searching) {
    const needle = query.trim().toLocaleLowerCase();
    shown = shown.filter((stone) =>
      `${stone.text} ${stone.source} ${stone.my_note ?? ''}`.toLocaleLowerCase().includes(needle),
    );
  }

  const openWriting = (stone: Stone) => {
    setWriting(stone);
    setDraft('');
  };

  const submitWriting = () => {
    const value = draft.trim();
    if (!value || !writing) return;
    onIntoWater(writing, value);
    setWriting(null);
    setDraft('');
  };

  const beginDrag = (id: string) => {
    if (reduced) return;
    dragIdRef.current = id;
    setDragId(id);
  };

  const dropOn = (targetId: string) => {
    const from = dragIdRef.current;
    dragIdRef.current = null;
    setDragId(null);
    if (from && from !== targetId) onReorder(from, targetId);
  };

  return (
    <div className="stone-view">
      <div className="echo-search">
        <span className="echo-search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          placeholder={COPY.stone.searchPlaceholder}
          aria-label={COPY.stone.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? (
          <button type="button" className="echo-search-clear" onClick={() => setQuery('')}>
            清除
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="tag-filter">
          <JellyRadio
            items={[
              { value: 'all', label: COPY.tagFilterAll },
              ...tags.map((item) => ({ value: item, label: item })),
            ]}
            value={tag}
            onChange={(next: any) => setTag(next)}
            size="sm"
            ariaLabel="按标签筛选石子"
            swell={0.08}
            gap={6}
          />
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="echo-empty stone-empty">
          <div className="stone-empty-pebbles" aria-hidden="true">
            <StonePebble shape={2} type="touch" size={30} />
            <StonePebble shape={5} type="method" size={26} />
          </div>
          <p>{searching || tag !== 'all' ? COPY.stone.searchEmpty : COPY.stone.empty}</p>
        </div>
      ) : (
        <div className="stone-list">
          {shown.map((stone) => (
            <article
              key={stone.id}
              className={`stone-row ${dragId === stone.id ? 'is-dragging' : ''} ${
                justPickedId === stone.id ? 'just-picked' : ''
              }`}
              draggable={!reduced && !searching && tag === 'all'}
              onDragStart={(event) => {
                beginDrag(stone.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(stone.id)}
              onDragEnd={() => {
                dragIdRef.current = null;
                setDragId(null);
              }}
            >
              <div className="stone-mark" aria-hidden="true">
                <StonePebble shape={shapeFor(stone.id)} type={stone.type} size={38} />
              </div>
              <div className="stone-main">
                {/* 整块可点：点一下展开看全文，再点收起；不用先摸到某个小按钮 */}
                <button
                  type="button"
                  className={`stone-text-toggle ${openId === stone.id ? 'is-open' : ''}`}
                  aria-expanded={openId === stone.id}
                  aria-label={openId === stone.id ? '收起这句话' : '看这句话的全文'}
                  onClick={() => setOpenId(openId === stone.id ? null : stone.id)}
                >
                  <p className={`stone-text ${openId === stone.id ? 'is-open' : ''}`}>{stone.text}</p>
                  {stone.text.length > 34 ? (
                    <span className="stone-text-more" aria-hidden="true">
                      {openId === stone.id ? '收起' : '看全文'}
                    </span>
                  ) : null}
                </button>
                <p className="stone-source">
                  {COPY.stone.sourceLine.replace('{source}', stone.source)}
                </p>
                <div className="stone-meta">
                  {stone.my_note ? (
                    <span className={`stone-note ${openId === stone.id ? 'is-open' : ''}`}>
                      批注：{stone.my_note}
                    </span>
                  ) : null}
                  {(stone.tags ?? []).map((item) => (
                    <span key={item} className="echo-tag"># {item}</span>
                  ))}
                  {tagEditId === stone.id ? (
                    <span className="stone-tag-edit">
                      <input
                        value={tagDraft}
                        autoFocus
                        placeholder="标签，逗号分隔"
                        aria-label="给这颗石子贴标签"
                        onChange={(event) => setTagDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveTags(stone);
                          if (event.key === 'Escape') {
                            setTagEditId(null);
                            setTagDraft('');
                          }
                        }}
                      />
                      <button type="button" onClick={() => saveTags(stone)}>好</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="stone-tag-add"
                      title="贴个标签"
                      onClick={() => {
                        setTagEditId(stone.id);
                        setTagDraft((stone.tags ?? []).join(' '));
                      }}
                    >
                      + 标签
                    </button>
                  )}
                </div>
                <div className="stone-actions">
                  {stone.type === 'method' ? (
                    <button type="button" onClick={() => onToPath(stone)}>
                      {COPY.stone.toPath}
                    </button>
                  ) : (
                    <button type="button" onClick={() => openWriting(stone)}>
                      {COPY.stone.intoWater}
                    </button>
                  )}
                  <button type="button" onClick={() => onLetFlow(stone)}>
                    {COPY.stone.letFlow}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {stones.length > 0 ? <p className="stone-foot-note">{COPY.stone.dragHint}</p> : null}

      <Modal
        open={writing !== null}
        title={COPY.stone.intoWaterTitle}
        onClose={() => setWriting(null)}
        label="stone-into-water"
        footer={
          <>
            <span className="modal-foot-note">{COPY.stone.intoWaterDone}</span>
            <button
              type="button"
              className="button primary"
              disabled={!draft.trim()}
              onClick={submitWriting}
            >
              {COPY.stone.intoWaterConfirm}
            </button>
          </>
        }
      >
        <div className="stone-water">
          <p className="stone-water-ghost" aria-hidden="true">
            {writing?.text}
          </p>
          <p className="stone-water-ghost-note">{COPY.stone.intoWaterGhost}</p>
          <textarea
            ref={waterRef}
            className="stone-water-input"
            value={draft}
            rows={4}
            placeholder={COPY.stone.intoWaterPlaceholder}
            aria-label={COPY.stone.intoWaterPlaceholder}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

/** 默认按捡到时间倒序；手动拖过的用 order 排前面。 */
function stoneSorted(stones: Stone[]): Stone[] {
  return [...stones].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    if (ao !== bo) return bo - ao;
    return b.saved_at - a.saved_at;
  });
}

export type { Stone };
