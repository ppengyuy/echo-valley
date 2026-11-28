import { useState } from 'react';
import { CALM_CATEGORIES, CALM_FAQ, CALM_SCIENCE, EXERCISES, type ExerciseDef } from '../exercises';
import { Fox } from './Fox';
import SplitText from '../motion/SplitText.jsx';
import JellyRadio from '../motion/JellyRadio.jsx';

interface CalmPanelProps {
  onOpenSettings: () => void;
  onOpenSafety: () => void;
  onStart: (exercise: ExerciseDef) => void;
  /** 宽屏没有底部 Tab，这里留一条回山路的门。 */
  onBack?: () => void;
}

/**
 * 🧘 静一下心：自助身心调节工具箱。
 * 这里没有打卡、没有连续奖励、不记录打开过哪个练习。
 */
export function CalmPanel({ onOpenSettings, onOpenSafety, onStart, onBack }: CalmPanelProps) {
  const [filter, setFilter] = useState<(typeof CALM_CATEGORIES)[number]>('全部');
  const visible = filter === '全部' ? EXERCISES : EXERCISES.filter((item) => item.cat === filter);

  return (
    <section className="panel calm-panel" aria-labelledby="calm-title">
      <div className="panel-head calm-head">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            静一下心
          </p>
          <SplitText
            id="calm-title"
            tag="h2"
            text="帮你的身心回到平缓的状态"
            splitType="chars"
            effect="rise"
            trigger="load"
            duration={1.5}
            delay={55}
            className="calm-title-split"
          />
          <span className="season-line">按照你当下的感受，挑选一个练习。</span>
        </div>
        <div className="calm-head-right">
          {onBack ? (
            <button type="button" className="text-button small" onClick={onBack}>
              ← 回到山谷
            </button>
          ) : null}
          <Fox className="calm-fox" />
          <button type="button" className="text-button small" onClick={onOpenSettings}>
            设置
          </button>
        </div>
      </div>

      <p className="calm-intro">
        安静、低压力。这里没有「你必须变好」的要求，刘看山只在旁边蹲着，不打扰你。
      </p>

      <div className="calm-warning">
        <p>
          本工具为自助调节练习，无法替代专业心理帮助。如果感觉难以承受，请查看
          <button type="button" className="inline-link" onClick={onOpenSafety}>
            【安全与帮助】
          </button>
          。
        </p>
      </div>

      <div className="calm-filters">
        <JellyRadio
          items={CALM_CATEGORIES}
          value={filter}
          onChange={(next: any) => setFilter(next as (typeof CALM_CATEGORIES)[number])}
          size="sm"
          ariaLabel="按感受筛选练习"
          swell={0.08}
          gap={6}
        />
      </div>

      <div className="calm-grid">
        {visible.map((item) => (
          <article key={item.id} className="calm-card">
            <span className="calm-card-cat">{item.cat}</span>
            <h3>{item.name}</h3>
            <p>{item.desc}</p>
            <button type="button" className="calm-card-go" onClick={() => onStart(item)}>
              ▶️ 开始练习
            </button>
          </article>
        ))}
      </div>

      {!visible.length ? <p className="calm-empty">这一类暂时没有练习，换个标签看看。</p> : null}

      <section className="calm-section" aria-labelledby="calm-science-title">
        <p className="eyebrow">
          <span className="eyebrow-line" aria-hidden="true" />
          为什么这些练习有用
        </p>
        <h2 id="calm-science-title">科学依据</h2>
        {CALM_SCIENCE.map((block) => (
          <div key={block.title} className="calm-science-block">
            <h3>{block.title}</h3>
            {block.body ? <p>{block.body}</p> : null}
            {block.list ? (
              <ul>
                {block.list.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      <section className="calm-section" aria-labelledby="calm-faq-title">
        <p className="eyebrow">
          <span className="eyebrow-line" aria-hidden="true" />
          常见问题
        </p>
        <h2 id="calm-faq-title">你可能想问的</h2>
        {CALM_FAQ.map((item) => (
          <details key={item.q} className="calm-faq">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <section className="calm-safety" aria-labelledby="calm-safety-title">
        <h2 id="calm-safety-title">🚨 什么时候该寻求专业帮助</h2>
        <ul>
          <li>焦虑、低落或睡眠问题几乎每天出现，并持续超过两周；</li>
          <li>明显影响工作、学习、社交或日常自理；</li>
          <li>出现惊恐发作、强烈的回避行为，或反复有伤害自己的念头。</li>
        </ul>
        <button type="button" className="button primary" onClick={onOpenSafety}>
          打开安全与帮助页面
        </button>
      </section>

      <p className="calm-foot">
        本工具全部为自助心理调节练习，不是心理治疗。如果长期陷入痛苦，请一定寻求专业人员帮助。
      </p>
    </section>
  );
}
