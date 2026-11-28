import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY } from '../copy';
import { localWorryBatch } from '../data/worryPool';
import {
  generateQuoteBatch,
  batchLinePasses,
  pickBatchLines,
  llmConfigured,
  recentlyRateLimited,
} from '../agent/llm';
import { detectFallback } from '../data/fallbacks';
import type { ChatMessage } from '../types';

type QuietMode = 'off' | 'sit' | 'listen' | 'quote';

interface QuietCompanionProps {
  /** 入口面板是否展开（未进入任何方式前）。 */
  panelOpen: boolean;
  onPanelOpen: (value: boolean) => void;
  mode: QuietMode;
  onMode: (mode: QuietMode) => void;
  /** 写一句给自己 → 走原有「存入山谷」确认流程。 */
  onWriteSelf: (text: string) => void;
  /** 进入方式 B：联动音乐库切到山谷舒缓第一首（不自动播放）。 */
  onListen: () => void;
  /** 危机表述：退出静默态并原样输出固定话术。 */
  onCrisis: (text: string) => void;
  /** 静默态里给的一条出路：去静一下心挑个练习。 */
  onCalm: () => void;
  /** 最近的用户消息（这一版暂不用于分批，保留接口以兼容调用方）。 */
  messages: ChatMessage[];
  reduced: boolean;
}

const BATCH_SIZE = 12;
/** 向模型一次要多几行：有效行不足 4 条就整批作废，多要一点能扛住个别行不合格。 */
const BATCH_ASK = 16;

export function QuietCompanion({
  panelOpen,
  onPanelOpen,
  mode,
  onMode,
  onWriteSelf,
  onListen,
  onCrisis,
  onCalm,
  reduced,
}: QuietCompanionProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 方式 C：按批呈现的烦恼列表。每批 10 条，换批时整批替换。
  const [batch, setBatch] = useState<string[]>([]);
  const [batchRound, setBatchRound] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchLocal, setBatchLocal] = useState(false);
  const [batchEmpty, setBatchEmpty] = useState(false);
  const [immersiveIndex, setImmersiveIndex] = useState<number | null>(null);
  /** 最近一次点开的是哪一条——「写一句给自己」时把这条留在上方当氛围。 */
  const [focusIndex, setFocusIndex] = useState(0);
  const seenTexts = useRef<string[]>([]);
  const batchRequest = useRef(0);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');

  // 取一批烦恼：优先知乎（一次多要几行，铺开不同面），失败退回本地兜底池。
  // 换批时把已经给过的句子带过去，要求下一批别重复。
  const loadBatch = useCallback(
    async (round: number) => {
      const token = batchRequest.current + 1;
      batchRequest.current = token;
      setBatchLoading(true);
      setBatchEmpty(false);
      setFocusIndex(0);

      if (llmConfigured() && !recentlyRateLimited()) {
        const raw = await generateQuoteBatch(seenTexts.current, BATCH_ASK).catch(() => null);
        if (batchRequest.current !== token) return;
        let lines = (raw ?? '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => batchLinePasses(line));

        // 一次没给够：再补一次，两次合起来凑满一批。
        // 模型偶尔会把「多少行」理解成「多少段」，缺几条就补几条，别让人看到半页。
        if (lines.length > 0 && lines.length < BATCH_SIZE) {
          const more = await generateQuoteBatch(
            [...seenTexts.current, ...lines],
            BATCH_ASK,
          ).catch(() => null);
          if (batchRequest.current !== token) return;
          if (more) {
            const extra = more
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => batchLinePasses(line) && !lines.includes(line));
            lines = [...lines, ...extra];
          }
        }

        if (lines.length >= 4) {
          // 全『我』开头会像一个人自言自语，这里摊一下主语，只调顺序不删内容。
          const picked = pickBatchLines(lines, BATCH_SIZE);
          // 把这一批**全部有效行**都记下来（不止展示的那些），
          // 否则每次被丢掉的几条会反复出现在下一批里。
          seenTexts.current = [...seenTexts.current, ...lines].slice(-200);
          setBatch(picked);
          setBatchLocal(false);
          setBatchLoading(false);
          setBatchRound(round);
          return;
        }
      }

      // 没配置 / 超时 / 这一批不合格：用本地池，条数与口径一致。
      const local = localWorryBatch(round, BATCH_SIZE, seenTexts.current).map((item) => item.text);
      if (batchRequest.current !== token) return;
      if (!local.length) {
        setBatch([]);
        setBatchEmpty(true);
        setBatchLoading(false);
        setBatchLocal(true);
        setBatchRound(round);
        return;
      }
      seenTexts.current = [...seenTexts.current, ...local].slice(-200);
      setBatch(local);
      setBatchLocal(true);
      setBatchLoading(false);
      setBatchRound(round);
    },
    [],
  );

  const openQuote = useCallback(() => {
    onMode('quote');
    setImmersiveIndex(null);
    setWriting(false);
    setDraft('');
    if (!batch.length) void loadBatch(0);
  }, [batch.length, loadBatch, onMode]);

  const nextBatch = useCallback(() => {
    setImmersiveIndex(null);
    void loadBatch(batchRound + 1);
  }, [batchRound, loadBatch]);

  // 方式 A 不再做「90 秒后才浮现出口」：那段时间里页面看着像卡死，人反而更慌。

  // 静默期间打字：检测危机词立即退出并输出固定话术；否则立即恢复正常对话，不评论。
  useEffect(() => {
    if (mode !== 'sit') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;
      // 有可打印输入 → 退出静默态，把该字符交给输入框。
      onMode('off');
      if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(event.key)) {
        window.setTimeout(() => {
          const el = inputRef.current ?? document.querySelector('.composer-box textarea');
          if (el) {
            el.value = event.key;
            el.focus();
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 30);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, onMode]);

  // ESC 退出静默态 / 沉浸阅读 / 面板。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (immersiveIndex !== null) {
        setImmersiveIndex(null);
        return;
      }
      if (mode === 'sit') {
        onMode('off');
        return;
      }
      if (panelOpen) onPanelOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [immersiveIndex, mode, panelOpen, onMode, onPanelOpen]);

  const submitSelf = () => {
    const value = draft.trim();
    if (!value) return;
    // 危机表述：退出静默态并原样输出固定话术。
    const hit = detectFallback(value);
    if (hit?.level === 'crisis') {
      setWriting(false);
      setDraft('');
      onCrisis(value);
      return;
    }
    onWriteSelf(value);
    setWriting(false);
    setDraft('');
    setImmersiveIndex(null);
  };

  const modeLabel = (() => {
    if (mode === 'sit') return COPY.quietWays.sit;
    if (mode === 'listen') return COPY.quietWays.listen;
    if (mode === 'quote') return COPY.quietWays.quote;
    return '';
  })();

  return (
    <>
      {/* 入口面板：从输入区向上展开，不遮对话内容。 */}
      {panelOpen && mode === 'off' ? (
        <div className={`quiet-panel ${reduced ? 'reduced' : ''}`} role="dialog" aria-label="不想说话时">
          <div className="quiet-panel-ways">
            <button
              type="button"
              className="quiet-way"
              onClick={() => {
                onPanelOpen(false);
                onMode('sit');
              }}
            >
              <span className="quiet-way-name">{COPY.quietWays.sit}</span>
              <span className="quiet-way-hint">{COPY.quietWays.sitHint}</span>
            </button>
            <button
              type="button"
              className="quiet-way"
              onClick={() => {
                onPanelOpen(false);
                onMode('listen');
                onListen();
              }}
            >
              <span className="quiet-way-name">{COPY.quietWays.listen}</span>
              <span className="quiet-way-hint">{COPY.quietWays.listenHint}</span>
            </button>
            <button
              type="button"
              className="quiet-way"
              onClick={() => {
                onPanelOpen(false);
                openQuote();
              }}
            >
              <span className="quiet-way-name">{COPY.quietWays.quote}</span>
              <span className="quiet-way-hint">{COPY.quietWays.quoteHint}</span>
            </button>
          </div>
          <p className="quiet-panel-foot">{COPY.quietPanelFoot}</p>
        </div>
      ) : null}

      {/* 方式 A：静默陪伴态。对话区由外层 class 淡出，这里只承载山谷句子与去处。 */}
      {mode === 'sit' ? (
        <div className={`quiet-sit-layer ${reduced ? 'reduced' : ''}`} aria-live="polite">
          <div className="quiet-sit-card">
            <p className="quiet-sit-line">{COPY.quietSitFirst}</p>
            <p className="quiet-sit-hint">{COPY.quietSitHint}</p>
            <div className="quiet-sit-actions">
              <button type="button" className="quiet-sit-calm" onClick={onCalm}>
                {COPY.quietSitCalm}
              </button>
              <button type="button" className="text-button small" onClick={() => onMode('off')}>
                {COPY.quietSitBack}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 方式 B：听一点声音。音乐库由 onListen 联动，这里只给一句陪坐文案。 */}
      {mode === 'listen' ? (
        <div className={`quiet-listen-layer ${reduced ? 'reduced' : ''}`} role="status">
          <p>{COPY.quietListenCopy}</p>
          <button type="button" className="text-button small" onClick={() => onMode('off')}>
            {COPY.quietSitStop}
          </button>
        </div>
      ) : null}

      {/* 方式 C：借一句别人的话 → 改成按批呈现的烦恼列表。
          一批 10 条，铺开备考期里不同面的烦恼；看不动就整批换掉。 */}
      {mode === 'quote' && immersiveIndex === null ? (
        <div className={`quiet-batch-layer ${reduced ? 'reduced' : ''}`}>
          {writing ? (
            <div className="quiet-write-card">
              <p className="quiet-write-ghost" aria-hidden="true">
                {batch[focusIndex] ?? batch[0] ?? ''}
              </p>
              <textarea
                ref={inputRef}
                className="quiet-write-input"
                value={draft}
                rows={3}
                placeholder={COPY.quietWritePlaceholder}
                aria-label={COPY.quietWritePlaceholder}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="quiet-write-actions">
                <button type="button" className="text-button small" onClick={() => setWriting(false)}>
                  {COPY.quietQuoteClose}
                </button>
                <button type="button" className="quiet-primary" disabled={!draft.trim()} onClick={submitSelf}>
                  放进山谷
                </button>
              </div>
            </div>
          ) : (
            <div className="quiet-batch">
              <div className="quiet-batch-head">
                <p className="quiet-batch-lead">
                  {batchLoading && batch.length ? COPY.quietBatchSwapping : COPY.quietBatchLead}
                </p>
                <p className="quiet-batch-meta">
                  {batch.length
                    ? `${COPY.quietBatchCount.replace('{count}', String(batch.length))}${
                        batchRound > 0 ? ` · 第 ${batchRound + 1} 批` : ''
                      }`
                    : ''}
                </p>
              </div>

              {/* 换批时保留上一批、整块淡下去，别让版面先塌成空白再长回来。 */}
              {batch.length && !batchEmpty ? (
                <ul className={`quiet-batch-list ${batchLoading ? 'is-refreshing' : ''}`}>
                  {batch.map((text, index) => (
                    <li key={`${batchRound}-${index}`}>
                      <button
                        type="button"
                        className="quiet-batch-item"
                        title={COPY.quietBatchOpenHint}
                        onClick={() => {
                          if (batchLoading) return;
                          setFocusIndex(index);
                          setImmersiveIndex(index);
                        }}
                      >
                        <span className="quiet-batch-index" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="quiet-batch-text">{text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : batchLoading ? (
                <div className="quiet-batch-loading" role="status">
                  <span className="quiet-batch-dots" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <p>{COPY.quietBatchLoading}</p>
                </div>
              ) : batchEmpty ? (
                <p className="quiet-batch-end">{COPY.quietBatchEnd}</p>
              ) : null}

              {batchLocal && !batchLoading && batch.length ? (
                <p className="quiet-batch-note">{COPY.quietBatchLocal}</p>
              ) : null}

              <div className="quiet-batch-actions">
                <button
                  type="button"
                  className="text-button small"
                  onClick={nextBatch}
                  disabled={batchLoading}
                >
                  {COPY.quietBatchNext}
                </button>
                <button type="button" className="text-button small" onClick={() => setWriting(true)}>
                  {COPY.quietQuoteWrite}
                </button>
                <button type="button" className="text-button small" onClick={() => onMode('off')}>
                  {COPY.quietQuoteClose}
                </button>
              </div>

              <p className="quiet-quote-note">
                {COPY.quietBatchWho}
                {batchRound > 0 ? ` · 已经翻了 ${batchRound + 1} 批` : ''}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* 单条放大：只放大这一条，不切成一张卡片，退回来还是原来的列表位置。 */}
      {mode === 'quote' && immersiveIndex !== null && batch[immersiveIndex] ? (
        <div
          className={`quiet-immersive ${reduced ? 'reduced' : ''}`}
          role="dialog"
          aria-label="放大看这一条"
          onClick={(event) => {
            if (event.target === event.currentTarget) setImmersiveIndex(null);
          }}
        >
          <p className="quiet-immersive-line">{batch[immersiveIndex]}</p>
          <p className="quiet-immersive-source">{COPY.quietBatchWho}</p>
          <div className="quiet-immersive-actions">
            {immersiveIndex < batch.length - 1 ? (
              <button
                type="button"
                className="text-button small"
                onClick={() => {
                  setFocusIndex(immersiveIndex + 1);
                  setImmersiveIndex(immersiveIndex + 1);
                }}
              >
                {COPY.quietQuoteMore}
              </button>
            ) : (
              <button type="button" className="text-button small" onClick={nextBatch}>
                {COPY.quietBatchNext}
              </button>
            )}
            <button type="button" className="text-button small" onClick={() => setImmersiveIndex(null)}>
              {COPY.quietQuoteClose}
            </button>
          </div>
        </div>
      ) : null}

      {/* 当前方式的极淡返回标（静默态下输入框缩为小点，点它即可回来打字）。 */}
      {mode !== 'off' && mode !== 'sit' ? (
        <button
          type="button"
          className="quiet-mode-chip"
          aria-label={`退出${modeLabel}，回来打字`}
          onClick={() => onMode('off')}
        >
          ·
        </button>
      ) : null}
    </>
  );
}

export type { QuietMode };
