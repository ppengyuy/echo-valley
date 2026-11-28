import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import type { Echo, Stone } from '../types';
import { echoTimeLabel } from '../utils/date';
import { StoneList } from './StoneList';
import SwipeRow from '../motion/SwipeRow.jsx';
import SplitText from '../motion/SplitText.jsx';

export type EchoSection = 'echoes' | 'stones';

/** 新旧回音相近时的轻声提示；只带回原话，不解释关联。 */
export interface RelateHint {
  newId: string;
  oldId: string;
}

interface EchoListProps {
  echoes: Echo[];
  view: 'active' | 'archive';
  onView: (view: 'active' | 'archive') => void;
  tagFilter: string;
  onTagFilter: (tag: string) => void;
  onOpen: (echo: Echo) => void;
  onArchive: (echo: Echo, archived: boolean) => void;
  onDelete: (echo: Echo) => void;
  onClear: () => void;
  onTogglePin?: (echo: Echo) => void;
  pinnedCount?: number;
  justSavedId?: string | null;
  // 溪边的石子
  section?: EchoSection;
  onSection?: (section: EchoSection) => void;
  stones?: Stone[];
  reduced?: boolean;
  onStoneIntoWater?: (stone: Stone, written: string) => void;
  onStoneToPath?: (stone: Stone) => void;
  onStoneLetFlow?: (stone: Stone) => void;
  onStoneReorder?: (id: string, targetId: string) => void;
  onStoneTags?: (id: string, tags: string[]) => void;
  justPickedId?: string | null;
  /** 新旧回音相近的提示；由上层按六项条件判定后传进来。 */
  relateHint?: RelateHint | null;
  onRelateListen?: (hint: RelateHint) => void;
  onRelateSkip?: () => void;
}

export function EchoList({
  echoes,
  view,
  onView,
  tagFilter,
  onTagFilter,
  onOpen,
  onArchive,
  onDelete,
  onClear,
  onTogglePin,
  pinnedCount = 0,
  justSavedId,
  section = 'echoes',
  onSection,
  stones = [],
  reduced = false,
  onStoneIntoWater,
  onStoneToPath,
  onStoneLetFlow,
  onStoneReorder,
  onStoneTags,
  justPickedId,
  relateHint = null,
  onRelateListen,
  onRelateSkip,
}: EchoListProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});
  /** 两条回音之间那条极淡的光连线；量不到位置就不画。 */
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const searching = query.trim().length > 0;
  const active = echoes.filter((echo) => !echo.archived);
  const archived = echoes.filter((echo) => echo.archived);
  const tags = Array.from(new Set(active.map((echo) => echo.tag).filter(Boolean))) as string[];
  // 置顶条目固定在列表顶部（仅在非搜索、非归档时排序，避免和检索结果打架）。
  const base = view === 'archive' ? archived : active;
  const ordered = searching
    ? base
    : [...base].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  let filtered =
    view === 'archive' || tagFilter === 'all' ? ordered : ordered.filter((echo) => echo.tag === tagFilter);
  if (searching) {
    const needle = query.trim().toLocaleLowerCase();
    filtered = filtered.filter((echo) => echo.text.toLocaleLowerCase().includes(needle));
  }

  const sameDayCount = (echo: Echo) => {
    const key = new Date(echo.createdAt).toDateString();
    return echoes.filter((item) => new Date(item.createdAt).toDateString() === key).length;
  };

  // 两条都在当前列表里看得见时才画线；被筛选或搜索隐藏就只留文字提示。
  const bothVisible = Boolean(
    relateHint &&
      filtered.some((echo) => echo.id === relateHint.newId) &&
      filtered.some((echo) => echo.id === relateHint.oldId),
  );

  useLayoutEffect(() => {
    if (!relateHint || !bothVisible) {
      setLine(null);
      return;
    }
    const measure = () => {
      const host = listRef.current;
      const from = rowRefs.current[relateHint.newId];
      const to = rowRefs.current[relateHint.oldId];
      if (!host || !from || !to) {
        setLine(null);
        return;
      }
      const base = host.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      setLine({
        x1: a.left - base.left + 15,
        y1: a.top - base.top + a.height / 2,
        x2: b.left - base.left + 15,
        y2: b.top - base.top + b.height / 2,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    const host = listRef.current;
    host?.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      host?.removeEventListener('scroll', measure);
    };
  }, [relateHint, bothVisible, filtered.length]);

  // 提示收起时，顺手把线也擦掉。
  useEffect(() => {
    if (!relateHint) setLine(null);
  }, [relateHint]);

  const relateOld = relateHint ? echoes.find((echo) => echo.id === relateHint.oldId) : undefined;

  return (
    <div className="echo-view">
      {onSection ? (
        <div className="segmented echo-section" role="tablist" aria-label="聆听的去处">
          <button
            type="button"
            role="tab"
            aria-selected={section === 'echoes'}
            className={section === 'echoes' ? 'is-on' : ''}
            onClick={() => onSection('echoes')}
          >
            {COPY.stone.sectionEchoes}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === 'stones'}
            className={section === 'stones' ? 'is-on' : ''}
            onClick={() => onSection('stones')}
          >
            {COPY.stone.sectionStones}
          </button>
        </div>
      ) : null}

      {section === 'stones' ? (
        <StoneList
          stones={stones}
          reduced={reduced}
          onIntoWater={(stone, written) => onStoneIntoWater?.(stone, written)}
          onToPath={(stone) => onStoneToPath?.(stone)}
          onLetFlow={(stone) => onStoneLetFlow?.(stone)}
          onReorder={(id, targetId) => onStoneReorder?.(id, targetId)}
          onUpdateTags={(id, tags) => onStoneTags?.(id, tags)}
          justPickedId={justPickedId}
        />
      ) : (
        <>
      <div className="echo-toolbar">
        <div className="segmented" role="tablist" aria-label="回音的去处">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'active'}
            className={view === 'active' ? 'is-on' : ''}
            onClick={() => onView('active')}
          >
            山谷里的回音
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'archive'}
            className={view === 'archive' ? 'is-on' : ''}
            onClick={() => onView('archive')}
          >
            {COPY.archivedTitle}
          </button>
        </div>
        <span className="echo-count">{base.length} 条回音</span>
      </div>

      {view === 'active' ? (
        <div className="echo-search">
          <span className="echo-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            placeholder={COPY.searchPlaceholder}
            aria-label={COPY.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
          {searching ? (
            <button type="button" className="echo-search-clear" onClick={() => setQuery('')}>
              清除
            </button>
          ) : null}
        </div>
      ) : null}

      {view === 'archive' ? <p className="echo-note">{COPY.archivedNote}</p> : null}

      {view === 'active' && tags.length > 0 ? (
        <div className="tag-filter" aria-label="按标签聆听">
          <button
            type="button"
            className={`tag-pill ${tagFilter === 'all' ? 'is-on' : ''}`}
            onClick={() => onTagFilter('all')}
          >
            {COPY.tagFilterAll}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-pill ${tagFilter === tag ? 'is-on' : ''}`}
              onClick={() => onTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="echo-empty">
          <div className="echo-empty-rings" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <SplitText
            key={`empty-${searching}-${view}-${tagFilter}`}
            text={
              searching
                ? COPY.searchEmpty
                : view === 'archive'
                  ? COPY.archiveEmpty
                  : tagFilter !== 'all'
                    ? COPY.tagEmpty
                    : COPY.echoEmpty
            }
            splitType="lines"
            effect="fade"
            trigger="load"
            duration={0.8}
            className="echo-empty-line"
          />
        </div>
      ) : (
        <div className="echo-list" ref={listRef}>
          {/* 极细极淡的光连线，不抢视觉；量不到位置就不画 */}
          {line ? (
            <svg className="relate-line" aria-hidden="true">
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            </svg>
          ) : null}
          {filtered.map((echo) => (
            <SwipeRow
              key={echo.id}
              label="一条回音"
              actionWidth={76}
              actions={[
                { id: 'archive', label: echo.archived ? COPY.actions.unarchive : COPY.actions.archive },
                { id: 'letgo', label: COPY.actions.letGo, color: 'var(--ink-soft)' },
              ]}
              onAction={(action: any) => {
                if (action.id === 'archive') onArchive(echo, !echo.archived);
                if (action.id === 'letgo') onDelete(echo);
              }}
            >
            <article
              ref={(node) => {
                rowRefs.current[echo.id] = node;
              }}
              className={`echo-row ${echo.pinned ? 'is-pinned' : ''} ${justSavedId === echo.id ? 'just-saved' : ''} ${echo.mirror ? 'mirror' : ''} ${
                relateHint && (relateHint.newId === echo.id || relateHint.oldId === echo.id)
                  ? 'is-related'
                  : ''
              }`}
            >
              <button
                type="button"
                className="ripple-mark"
                aria-label={`${COPY.actions.listen}这段回音`}
                onClick={() => onOpen(echo)}
              >
                <span />
                <span />
                <span />
              </button>
              <div className="echo-main">
                <button type="button" className="echo-text" onClick={() => onOpen(echo)}>
                  「{echo.text}」
                </button>
                <div className="echo-meta">
                  <span>{echoTimeLabel(echo.createdAt, sameDayCount(echo))}</span>
                  {echo.pinned ? <span className="pinned-mark">留在这</span> : null}
                  {echo.tag ? <span className="echo-tag"># {echo.tag}</span> : null}
                  {echo.mirror ? <span className="mirror-mark">{COPY.mirrorMark}</span> : null}
                  {echo.fromStone ? (
                    <span className="from-stone-mark">{COPY.stone.fromStoneMark}</span>
                  ) : null}
                </div>
                <div className="echo-actions">
                  <button type="button" title={COPY.actionHints.listen} onClick={() => onOpen(echo)}>
                    {COPY.actions.listen}
                  </button>
                  {!echo.archived && onTogglePin ? (
                    <button
                      type="button"
                      className={echo.pinned ? 'pin-button is-on' : 'pin-button'}
                      title={echo.pinned ? COPY.unpin : COPY.pinHint}
                      disabled={!echo.pinned && pinnedCount >= 3}
                      onClick={() => onTogglePin(echo)}
                    >
                      {echo.pinned ? COPY.unpin : '留在这'}
                    </button>
                  ) : null}
                  {echo.archived ? (
                    <button
                      type="button"
                      title={COPY.actionHints.unarchive}
                      onClick={() => onArchive(echo, false)}
                    >
                      {COPY.actions.unarchive}
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={COPY.actionHints.archive}
                      onClick={() => onArchive(echo, true)}
                    >
                      {COPY.actions.archive}
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger-quiet"
                    title={COPY.actionHints.letGo}
                    onClick={() => onDelete(echo)}
                  >
                    {COPY.actions.letGo}
                  </button>
                </div>
              </div>

              {/* 相近提示：只出现在新回音下方，问一句，不替用户下结论 */}
              {relateHint && relateHint.newId === echo.id && relateOld ? (
                <div className="relate-hint" role="status">
                  <p>{COPY.relate.hint}</p>
                  <div className="relate-hint-actions">
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => onRelateListen?.(relateHint)}
                    >
                      {COPY.relate.listen}
                    </button>
                    <button type="button" className="text-button small" onClick={onRelateSkip}>
                      {COPY.relate.skip}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
            </SwipeRow>
          ))}
        </div>
      )}
      {view === 'active' && active.length >= 10 ? <p className="echo-limit">{COPY.echoLimit}</p> : null}

      {echoes.length > 0 ? (
        <div className="echo-clear">
          <button type="button" className="text-button" onClick={onClear}>
            {COPY.clearValley}
          </button>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
