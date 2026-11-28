import { useSyncExternalStore } from 'react';
import { COPY } from '../copy';
import { hasRuntimeKey, snapshot, subscribe } from '../agent/runtimeModel';
import type { Season } from '../types';
import { Fox } from './Fox';
import { MusicPlayer } from './MusicPlayer';
import WarmTooltip from '../motion/WarmTooltip.jsx';

interface HeaderProps {
  season: Season;
  onSeason: (season: Season) => void;
  reduced: boolean;
  onReduced: (value: boolean) => void;
  onRehearsal: () => void;
  onModelSettings: () => void;
  onSettings: () => void;
  onCalm: () => void;
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function Header({
  season,
  onSeason,
  reduced,
  onReduced,
  onRehearsal,
  onModelSettings,
  onSettings,
  onCalm,
}: HeaderProps) {
  useSyncExternalStore(subscribe, snapshot, () => 'off');
  const modelOn = hasRuntimeKey();

  return (
    <header className="topbar">
      <div className="brand">
        <Fox className="brand-fox" />
        <div className="brand-text">
          <h1>
            {COPY.brandShort}
            <span className="brand-divider">｜</span>
            <span className="brand-sub">{COPY.brandSub}</span>
          </h1>
          <p>{COPY.cardSub}</p>
        </div>
      </div>

      <div className="top-actions">
        <WarmTooltip content="换一种天色" side="bottom">
          <div className="season-switch" role="group" aria-label={COPY.seasonLabel}>
            {SEASONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`season-dot ${season === item ? 'is-on' : ''}`}
                aria-pressed={season === item}
                aria-label={`${COPY.seasonLabel}：${COPY.season[item]}`}
                onClick={() => onSeason(item)}
              >
                {COPY.season[item]}
              </button>
            ))}
          </div>
        </WarmTooltip>

        <MusicPlayer />

        <WarmTooltip content="山雾与打字可以慢下来" side="bottom">
          <label className="motion-toggle">
            <input
              type="checkbox"
              checked={reduced}
              aria-label={COPY.motionToggle}
              onChange={(event) => onReduced(event.target.checked)}
            />
            <span>{COPY.motionToggle}</span>
          </label>
        </WarmTooltip>

        <WarmTooltip content="用自己的模型陪聊" side="bottom">
          <button
            type="button"
            className={`text-button model-link ${modelOn ? 'is-on' : ''}`}
            onClick={onModelSettings}
            aria-label={modelOn ? COPY.modelButtonOn : COPY.modelButton}
          >
            {modelOn ? COPY.modelButtonOn : COPY.modelButton}
          </button>
        </WarmTooltip>

        <WarmTooltip content="路演用的假数据" side="bottom">
          <button type="button" className="text-button rehearsal-link" onClick={onRehearsal}>
            {COPY.rehearsal}
          </button>
        </WarmTooltip>

        <div className="quiet-tools">
          <WarmTooltip content="存储、备份、清空" side="bottom">
            <button type="button" className="text-button small quiet-link" onClick={onSettings}>
              设置
            </button>
          </WarmTooltip>
          <WarmTooltip content="九个很小的练习" side="bottom">
            <button type="button" className="text-button small quiet-link calm-link" onClick={onCalm}>
              静一下心
            </button>
          </WarmTooltip>
        </div>

        <details className="boundary">
          <summary>{COPY.boundaryMore}</summary>
          <div className="boundary-card">
            <p>{COPY.boundaryLong}</p>
            <p className="boundary-note">{COPY.sessionNote}</p>
          </div>
        </details>
      </div>
    </header>
  );
}
