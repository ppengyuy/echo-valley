import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { RefObject } from 'react';
import { COPY } from '../copy';
import type { ChatMessage, Echo, EchoOffer, MirrorInvite, MirrorStage, Season, Stone, WeatherKind } from '../types';
import { ChatThread } from './ChatThread';
import { Composer } from './Composer';
import { EchoList, type EchoSection, type RelateHint } from './EchoList';
import { Fox } from './Fox';
import { QuietCompanion, type QuietMode } from './QuietCompanion';
import { RippleOverlay } from './RippleOverlay';
import { useIdle } from '../utils/useIdle';

interface ValleyPanelProps {
  ripple: { text: string; key: number } | null;
  tracking?: boolean;
  dragWagKey?: number;
  weatherKind?: WeatherKind | null;
  tab: 'talk' | 'echoes';
  onTab: (tab: 'talk' | 'echoes') => void;
  onOpenPlan: () => void;
  season: Season;
  messages: ChatMessage[];
  echoes: Echo[];
  offer: EchoOffer | null;
  mirrorInvite: MirrorInvite | null;
  mirrorStage: MirrorStage;
  typing: boolean;
  onSend: (text: string, silent: boolean) => void;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onRequestReply: () => void;
  onSilentKeep: () => void;
  onAcceptMirror: () => void;
  onDeclineMirror: () => void;
  onExitMirror: () => void;
  echoView: 'active' | 'archive';
  onEchoView: (view: 'active' | 'archive') => void;
  tagFilter: string;
  onTagFilter: (tag: string) => void;
  onOpenEcho: (echo: Echo) => void;
  onArchiveEcho: (echo: Echo, archived: boolean) => void;
  onDeleteEcho: (echo: Echo) => void;
  onClearEchoes: () => void;
  onTogglePin?: (echo: Echo) => void;
  pinnedCount?: number;
  justSavedId: string | null;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  className?: string;
  quietPanelOpen: boolean;
  onQuietPanelOpen: (value: boolean) => void;
  quietMode: QuietMode;
  onQuietMode: (mode: QuietMode) => void;
  onQuietWriteSelf: (text: string) => void;
  onQuietListen: () => void;
  onQuietCrisis: (text: string) => void;
  reduced: boolean;
  // 溪边的石子
  echoSection: EchoSection;
  onEchoSection: (section: EchoSection) => void;
  stones: Stone[];
  justPickedId: string | null;
  onStoneIntoWater: (stone: Stone, written: string) => void;
  onStoneToPath: (stone: Stone) => void;
  onStoneLetFlow: (stone: Stone) => void;
  onStoneReorder: (id: string, targetId: string) => void;
  onStoneTags: (id: string, tags: string[]) => void;
  /** 新旧回音相近的提示；判定在上层完成。 */
  relateHint?: RelateHint | null;
  onRelateListen?: (hint: RelateHint) => void;
  onRelateSkip?: () => void;
  /** 输入框上方「捡到一句话」轻入口。 */
  onPickStone: () => void;
}

function FogPatch() {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState(true);
  const timer = useRef(0);

  const openAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPoint({ x, y });
    setHint(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPoint(null), 2600);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const style = {
    '--fog-x': point ? `${point.x}%` : '-20%',
    '--fog-y': point ? `${point.y}%` : '-20%',
  } as CSSProperties;

  return (
    <div
      className="fog-patch"
      style={style}
      role="button"
      tabIndex={0}
      aria-label="在雾上轻轻划一下"
      onPointerDown={openAt}
      onPointerMove={openAt}
      onPointerLeave={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPoint(null), 1400);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setPoint({ x: 50, y: 50 });
        setHint(false);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setPoint(null), 2600);
      }}
    >
      {hint ? <span className="fog-hint">在雾上轻轻划一下</span> : null}
    </div>
  );
}

function HobbyBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 6.6c3.6-1.6 6.2-1.6 8.5.4v11.3c-2.3-2-4.9-2-8.5-.4V6.6Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 6.6c-3.6-1.6-6.2-1.6-8.5.4v11.3c2.3-2 4.9-2 8.5-.4V6.6Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path className="hobby-page" d="M12 7v11.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function ValleyPanel({
  ripple,
  tracking = false,
  dragWagKey = 0,
  weatherKind,
  tab,
  onTab,
  onOpenPlan,
  season,
  messages,
  echoes,
  offer,
  mirrorInvite,
  mirrorStage,
  typing,
  onSend,
  onAcceptOffer,
  onDeclineOffer,
  onRequestReply,
  onSilentKeep,
  onAcceptMirror,
  onDeclineMirror,
  onExitMirror,
  echoView,
  onEchoView,
  tagFilter,
  onTagFilter,
  onOpenEcho,
  onArchiveEcho,
  onDeleteEcho,
  onClearEchoes,
  onTogglePin,
  pinnedCount,
  justSavedId,
  composerRef,
  className = '',
  quietPanelOpen,
  onQuietPanelOpen,
  quietMode,
  onQuietMode,
  onQuietWriteSelf,
  onQuietListen,
  onQuietCrisis,
  reduced,
  echoSection,
  onEchoSection,
  stones,
  justPickedId,
  onStoneIntoWater,
  onStoneToPath,
  onStoneLetFlow,
  onStoneReorder,
  onStoneTags,
  relateHint = null,
  onRelateListen,
  onRelateSkip,
  onPickStone,
}: ValleyPanelProps) {
  const activeCount = echoes.filter((echo) => !echo.archived).length;
  const idleDelay = new URLSearchParams(window.location.search).get('idle') === '1' ? 2500 : 120000;
  const idle = useIdle(idleDelay);
  const [hobbyNote, setHobbyNote] = useState(false);
  const hobbyTimer = useRef(0);
  // 「再问一次」：把旧消息填回输入框。nonce 保证连点同一条也能重新触发。
  const [reuse, setReuse] = useState<{ text: string; nonce: number } | null>(null);
  const reuseNonce = useRef(0);
  const handleReuse = (text: string) => {
    reuseNonce.current += 1;
    setReuse({ text, nonce: reuseNonce.current });
  };

  const lastWeather = [...messages]
    .reverse()
    .find((message) => message.weather)?.weather?.kind;
  const forceMist = new URLSearchParams(window.location.search).get('mist') === '1';
  const misty =
    forceMist || weatherKind === 'mist' || (weatherKind == null && lastWeather === 'mist');

  useEffect(() => () => window.clearTimeout(hobbyTimer.current), []);

  const openHobby = () => {
    setHobbyNote(true);
    window.clearTimeout(hobbyTimer.current);
    hobbyTimer.current = window.setTimeout(() => setHobbyNote(false), 6200);
  };

  return (
    <section
      className={`panel valley-panel ${className} ${quietMode === 'sit' ? 'quiet-sit-active' : ''}`}
      aria-labelledby="valley-title"
    >
      <div className="panel-head valley-head">
        <div className="valley-title">
          <p className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            {COPY.valley}
          </p>
          <h2 id="valley-title">{tab === 'talk' ? '山谷在听' : '山谷里的回音'}</h2>
          <span className="season-line">{COPY.seasonIntro[season]}</span>
        </div>

        <div className="valley-mascot">
          <Fox
            className="valley-fox"
            nodKey={ripple?.key}
            wagKey={(ripple?.key ?? 0) + dragWagKey}
            tracking={tracking}
            dozing={idle}
          />
          {idle ? (
            <button
              type="button"
              className="fox-hobby"
              aria-label="看看刘看山在做什么"
              title="看看刘看山在做什么"
              onClick={openHobby}
            >
              <HobbyBook />
            </button>
          ) : null}
          {hobbyNote ? <p className="fox-hobby-note">刘看山在看一本没有封面的书。</p> : null}
          {misty && !ripple ? <FogPatch /> : null}
        </div>
      </div>

      <nav className="entry-nav" aria-label="在回音谷里做什么">
        <button
          type="button"
          className={tab === 'talk' ? 'is-on' : ''}
          aria-pressed={tab === 'talk'}
          title={COPY.entryHint.talk}
          onClick={() => {
            onTab('talk');
            composerRef.current?.focus();
          }}
        >
          {COPY.entry.talk}
        </button>
        <button type="button" title={COPY.entryHint.plan} onClick={onOpenPlan}>
          {COPY.entry.plan}
        </button>
        <button
          type="button"
          className={tab === 'echoes' ? 'is-on' : ''}
          aria-pressed={tab === 'echoes'}
          title={COPY.entryHint.listen}
          onClick={() => onTab('echoes')}
        >
          {COPY.entry.listen}
          {activeCount > 0 ? <span className="nav-count">{activeCount}</span> : null}
        </button>
      </nav>

      <div className="valley-body">
        <div className="tab-pane" key={tab}>
          {tab === 'talk' ? (
            <>
              <ChatThread
                messages={messages}
                offer={offer}
                mirrorInvite={mirrorInvite}
                mirrorStage={mirrorStage}
                typing={typing}
                onAcceptOffer={onAcceptOffer}
                onDeclineOffer={onDeclineOffer}
                onRequestReply={onRequestReply}
                onSilentKeep={onSilentKeep}
                onAcceptMirror={onAcceptMirror}
                onDeclineMirror={onDeclineMirror}
                onReuse={handleReuse}
              />
              <Composer
                onSend={onSend}
                onExitMirror={onExitMirror}
                mirrorStage={mirrorStage}
                showQuick={messages.length <= 1}
                disabled={typing}
                inputRef={composerRef}
                quiet={quietMode !== 'off'}
                quietPanelOpen={quietPanelOpen}
                onToggleQuiet={() => {
                  onQuietMode('off');
                  onQuietPanelOpen(!quietPanelOpen);
                }}
                onPickStone={onPickStone}
                reuse={reuse}
              />
              <QuietCompanion
                panelOpen={quietPanelOpen}
                onPanelOpen={onQuietPanelOpen}
                mode={quietMode}
                onMode={onQuietMode}
                onWriteSelf={onQuietWriteSelf}
                onListen={onQuietListen}
                onCrisis={onQuietCrisis}
                messages={messages}
                reduced={reduced}
              />
            </>
          ) : (
            <EchoList
              echoes={echoes}
              view={echoView}
              onView={onEchoView}
              tagFilter={tagFilter}
              onTagFilter={onTagFilter}
              onOpen={onOpenEcho}
              onArchive={onArchiveEcho}
              onDelete={onDeleteEcho}
              onClear={onClearEchoes}
              onTogglePin={onTogglePin}
              pinnedCount={pinnedCount}
              justSavedId={justSavedId}
              section={echoSection}
              onSection={onEchoSection}
              stones={stones}
              reduced={reduced}
              onStoneIntoWater={onStoneIntoWater}
              onStoneToPath={onStoneToPath}
              onStoneLetFlow={onStoneLetFlow}
              onStoneReorder={onStoneReorder}
              onStoneTags={onStoneTags}
              justPickedId={justPickedId}
              relateHint={relateHint}
              onRelateListen={onRelateListen}
              onRelateSkip={onRelateSkip}
            />
          )}
        </div>
      </div>

      {ripple ? <RippleOverlay key={ripple.key} text={ripple.text} /> : null}
    </section>
  );
}
