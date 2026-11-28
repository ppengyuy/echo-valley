import { useEffect, useRef, useState, type ReactElement } from 'react';

/**
 * 静一下心 · P0 练习。
 *
 * 硬约束：这里所有组件都不写任何存储——不记次数、时长、完成状态，
 * 不产生行为日志，也不把练习结果送给别的地方。练习结束后的感受，
 * 只能由用户自己在弹窗底部点「我想记下此刻的感受」，填成草稿回音再手动确认。
 */

export type ExerciseCategory = '专注力训练' | '节律呼吸' | '躯体放松' | '即刻疗愈·SOS' | '睡眠';

export interface ExerciseDef {
  id: string;
  cat: ExerciseCategory;
  name: string;
  desc: string;
  body: () => ReactElement;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const shuffle = <T,>(list: T[]): T[] => {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

/* ---------- 1. 动态舒尔特方格 ---------- */

function SchulteGrid() {
  const [cells, setCells] = useState<number[]>(() => shuffle(range(1, 25)));
  const [next, setNext] = useState(1);
  const [miss, setMiss] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const done = next > 25;

  useEffect(() => {
    if (!running || done) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running, done]);

  const tap = (value: number, index: number) => {
    if (done) return;
    if (value !== next) {
      setMiss(index);
      window.setTimeout(() => setMiss(null), 420);
      return;
    }
    setRunning(true);
    const found = next;
    setNext(found + 1);
    // 每找到一个数字，剩下的数字重新排一次：眼睛要重新找，注意力被留在眼前。
    setCells((current) => {
      const left = current.map((item) => (item === found ? 0 : item));
      const slots = left.map((item, i) => (item === 0 ? -1 : i)).filter((i) => i >= 0);
      const values = shuffle(slots.map((i) => left[i]));
      const arranged = [...left];
      slots.forEach((slot, i) => {
        arranged[slot] = values[i];
      });
      return arranged;
    });
  };

  const restart = () => {
    setCells(shuffle(range(1, 25)));
    setNext(1);
    setSeconds(0);
    setRunning(false);
  };

  return (
    <div className="ex-body">
      <div className="ex-stage">
        <p className="ex-lead">
          {done ? '25 个都找到了。' : '按顺序找数字，从 1 开始。'}
        </p>
        <div className={`schulte-grid ${done ? 'is-done' : ''}`}>
          {cells.map((value, index) => (
            <button
              key={index}
              type="button"
              className={`schulte-cell ${value === 0 ? 'is-empty' : ''} ${miss === index ? 'is-miss' : ''}`}
              onClick={() => tap(value, index)}
              disabled={value === 0 || done}
              aria-label={value === 0 ? '已经找到' : `数字 ${value}`}
            >
              {value === 0 ? '' : value}
            </button>
          ))}
        </div>
        <div className="ex-meter">
          <span>{done ? '这一轮走完了，想再走一遍也可以。' : `下一个：${next}`}</span>
          <span className="ex-meter-dim">{seconds > 0 ? `这一轮用了 ${seconds} 秒` : '还没有开始计时'}</span>
        </div>
      </div>
      <p className="ex-note">时间只是这一轮里的参考，不留存，也不和谁比。</p>
      <div className="ex-actions">
        <button type="button" className="button ghost" onClick={restart}>
          换一组数字
        </button>
      </div>
    </div>
  );
}

/* ---------- 2. 呼吸训练 ---------- */

function BreathHalo() {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [second, setSecond] = useState(4);

  useEffect(() => {
    let current: 'in' | 'out' = 'in';
    let left = 4;
    setPhase(current);
    setSecond(left);
    const timer = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        current = current === 'in' ? 'out' : 'in';
        left = current === 'in' ? 4 : 6;
      }
      setPhase(current);
      setSecond(left);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ex-body">
      <div className="ex-stage breath-stage">
        <div className={`breath-halo is-${phase}`} aria-hidden="true">
          <span>{second}</span>
        </div>
        <p className="breath-cue">{phase === 'in' ? '吸气' : '呼气'}</p>
        <p className="ex-lead">跟着光环的节奏：吸气 4 秒，呼气 6 秒。呼气比吸气长一点。</p>
      </div>
      <p className="ex-note">如果觉得头晕或不舒服，随时停下，回到平常的呼吸。</p>
    </div>
  );
}

/* ---------- 3. 54321 练习 ---------- */

const GROUNDING_STEPS = [
  { count: 5, sense: '看', prompt: '说出你此刻能看见的 5 样东西。慢慢看，不用急。' },
  { count: 4, sense: '触', prompt: '摸一摸身边的 4 样东西：桌沿、衣角、椅面，什么都行。' },
  { count: 3, sense: '听', prompt: '听 3 个声音。远的、近的，还有你自己呼吸的声音。' },
  { count: 2, sense: '闻', prompt: '找到 2 种气味。没有气味也可以，空气本身也算。' },
  { count: 1, sense: '尝', prompt: '最后，留意嘴里的 1 种味道，或者喝一小口水。' },
];

function Grounding54321() {
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const finished = step >= GROUNDING_STEPS.length;

  const go = () => {
    setText('');
    setStep((value) => value + 1);
  };

  if (finished) {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="ex-lead">五感都走完了。你现在在此时此刻的房间里。</p>
          <p className="ex-note">如果还想再走一遍，可以点下面的按钮。不想走也可以直接关掉。</p>
        </div>
        <div className="ex-actions">
          <button type="button" className="button ghost" onClick={() => setStep(0)}>
            再走一遍
          </button>
        </div>
      </div>
    );
  }

  const current = GROUNDING_STEPS[step];

  return (
    <div className="ex-body">
      <div className="ex-stage">
        <div className="grounding-count" aria-hidden="true">
          {current.count}
          <span>{current.sense}</span>
        </div>
        <p className="ex-lead">{current.prompt}</p>
        <label className="ex-field">
          <span>想写就写，不写也行。这里不会留下任何记录。</span>
          <textarea
            value={text}
            rows={4}
            placeholder="比如：窗外的树叶、手边的杯子、自己的呼吸……"
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      </div>
      <div className="ex-actions">
        <span className="ex-step">第 {step + 1} / {GROUNDING_STEPS.length} 步</span>
        <button type="button" className="button primary" onClick={go}>
          {step + 1 === GROUNDING_STEPS.length ? '走完了' : '下一步'}
        </button>
      </div>
    </div>
  );
}

/* ---------- 4. 身体放松 PMR ---------- */

const PMR_GROUPS = [
  { name: '双手', tense: '轻轻握拳，把力气留在手掌和指节。', release: '松开，让手指摊平，感受血液回来的温度。' },
  { name: '小臂与肩膀', tense: '手臂收紧，肩膀微微耸起。', release: '放下肩膀，让手臂垂着，不用力。' },
  { name: '面部', tense: '轻轻皱眉、咬一下后槽牙。', release: '松开眉心，松开下巴，让脸平下来。' },
  { name: '腹部', tense: '收一下肚子，像系紧一条带子。', release: '松开，让呼吸自己回到腹部。' },
  { name: '大腿', tense: '两腿并拢，压紧大腿。', release: '放松，让腿的重量落在椅子上。' },
  { name: '小腿与脚', tense: '脚尖轻轻往上勾，绷住小腿。', release: '放下脚，整条腿都松下来。' },
];

function PMRRelax() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<'tense' | 'release'>('tense');
  const [left, setLeft] = useState(5);
  const finished = index >= PMR_GROUPS.length;

  // 只在一个地方倒数；到 0 之后由下面的 effect 决定是放松还是换下一组。
  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => {
      setLeft((value) => (value > 1 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (finished) return;
    if (left > 0) return;
    if (stage === 'tense') {
      setStage('release');
      setLeft(10);
      return;
    }
    setStage('tense');
    setIndex((value) => value + 1);
    setLeft(5);
  }, [left, stage, finished]);

  if (finished) {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="ex-lead">六组都走完了。身体现在比刚才重一点，这是松开的样子。</p>
          <p className="ex-note">不用马上起身，可以再躺一会儿。</p>
        </div>
        <div className="ex-actions">
          <button type="button" className="button ghost" onClick={() => { setIndex(0); setStage('tense'); setLeft(5); }}>
            再来一遍
          </button>
        </div>
      </div>
    );
  }

  const group = PMR_GROUPS[index];

  return (
    <div className="ex-body">
      <div className="ex-stage">
        <div className="pmr-head">
          <span className="pmr-group">第 {index + 1} / {PMR_GROUPS.length} 组</span>
          <span className={`pmr-stage is-${stage}`}>{stage === 'tense' ? '绷紧' : '放松'}</span>
        </div>
        <p className="pmr-name">{group.name}</p>
        <p className="ex-lead">{stage === 'tense' ? group.tense : group.release}</p>
        <div className="pmr-clock" aria-live="off">
          <span>{left}</span> 秒
        </div>
      </div>
      <div className="pmr-dots" aria-hidden="true">
        {PMR_GROUPS.map((item, i) => (
          <span key={item.name} className={i <= index ? 'is-on' : ''} />
        ))}
      </div>
      <p className="ex-note">绷紧的时候不用太用力，能感觉到紧就够了；放松的时候，也不要刻意去松。</p>
    </div>
  );
}

/* ---------- 5. Stroop 训练 ---------- */

const STROOP_COLORS = [
  { name: '红', hex: '#b4574e' },
  { name: '黄', hex: '#b08a3e' },
  { name: '蓝', hex: '#4a6c85' },
  { name: '绿', hex: '#4f7a5b' },
];

function StroopGame() {
  const [round, setRound] = useState(0);
  const [right, setRight] = useState(0);
  const [feedback, setFeedback] = useState<'ok' | 'no' | null>(null);
  const [item, setItem] = useState(() => makeStroop());

  const total = 12;
  const done = round >= total;

  function makeStroop() {
    const word = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
    let ink = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
    if (ink.name === word.name) {
      ink = STROOP_COLORS[(STROOP_COLORS.indexOf(ink) + 1) % STROOP_COLORS.length];
    }
    return { word, ink };
  }

  const answer = (name: string) => {
    if (done || feedback) return;
    const correct = name === item.ink.name;
    setFeedback(correct ? 'ok' : 'no');
    if (correct) setRight((value) => value + 1);
    window.setTimeout(() => {
      setFeedback(null);
      setRound((value) => value + 1);
      setItem(makeStroop());
    }, 620);
  };

  if (done) {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="ex-lead">十二轮走完了，其中 {right} 次读对了颜色。</p>
          <p className="ex-note">数字只在这一轮里出现，不留存。真正有用的是刚刚那几次「停下来看一眼」。</p>
        </div>
        <div className="ex-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setRound(0);
              setRight(0);
              setItem(makeStroop());
            }}
          >
            再来一轮
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ex-body">
      <div className="ex-stage">
        <p className="ex-lead">只读字的颜色，不管字写的是什么。</p>
        <div className={`stroop-card ${feedback ? `is-${feedback}` : ''}`}>
          <span style={{ color: item.ink.hex }}>{item.word.name}</span>
        </div>
        <div className="stroop-options">
          {STROOP_COLORS.map((color) => (
            <button key={color.name} type="button" className="stroop-choice" onClick={() => answer(color.name)}>
              {color.name}
            </button>
          ))}
        </div>
      </div>
      <div className="ex-meter">
        <span>第 {round + 1} / {total} 轮</span>
        <span className="ex-meter-dim">读错也没关系，下一轮继续</span>
      </div>
    </div>
  );
}

/* ---------- 6. 微小行动 ---------- */

const TINY_ACTIONS = [
  '把桌上的一个杯子拿去洗掉。',
  '站起来，走到窗边，看三十秒外面。',
  '给手机充上电，放在手够不到的地方。',
  '把书包里今天不用的东西拿出来。',
  '喝一杯水，喝完把杯子放回原位。',
  '把书翻到你要看的那一页，只翻页，不读。',
  '打开窗户，让房间换一次空气。',
  '把桌面上的三样东西摆正。',
  '穿上鞋，在楼下走五分钟。',
  '把明天要带的东西放到门口。',
];

function TinyAction() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TINY_ACTIONS.length));
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="ex-lead">做完了。哪怕只是一件很小的事，身体也已经动起来了。</p>
          <p className="ex-note">不用接着做第二件。想停在这里，就停在这里。</p>
        </div>
        <div className="ex-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setDone(false);
              setIndex((value) => (value + 1) % TINY_ACTIONS.length);
            }}
          >
            再来一件
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ex-body">
      <div className="ex-stage">
        <p className="ex-lead">只做这一件，做完就结束。</p>
        <p className="tiny-card">{TINY_ACTIONS[index]}</p>
      </div>
      <p className="ex-note">不用等「有力气」再开始。动一下，情绪会跟着走一点。</p>
      <div className="ex-actions">
        <button type="button" className="button ghost" onClick={() => setIndex((value) => (value + 1) % TINY_ACTIONS.length)}>
          换一件
        </button>
        <button type="button" className="button primary" onClick={() => setDone(true)}>
          我做完了
        </button>
      </div>
    </div>
  );
}

/* ---------- 7. 反刍打断 ---------- */

function RuminationBreak() {
  const [text, setText] = useState('');
  const [step, setStep] = useState<'write' | 'judge' | 'yes' | 'no'>('write');

  if (step === 'write') {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="ex-lead">把此刻在脑子里转的那句话，写下来。一句话就够。</p>
          <label className="ex-field">
            <span>写完不用保存，关掉就散了。</span>
            <textarea
              value={text}
              rows={4}
              placeholder="比如：万一考不好怎么办……"
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        </div>
        <div className="ex-actions">
          <button type="button" className="button primary" onClick={() => setStep('judge')} disabled={!text.trim()}>
            写好了
          </button>
        </div>
      </div>
    );
  }

  if (step === 'judge') {
    return (
      <div className="ex-body">
        <div className="ex-stage">
          <p className="rumi-quote">「{text.trim()}」</p>
          <p className="ex-lead">这件事，现在有你能做的下一步吗？</p>
          <p className="ex-note">能，就想一个五分钟内做得完的小动作；不能，就先把它放在这里。</p>
        </div>
        <div className="ex-actions">
          <button type="button" className="button ghost" onClick={() => setStep('no')}>
            现在做不了
          </button>
          <button type="button" className="button primary" onClick={() => setStep('yes')}>
            有一件能做的
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ex-body">
      <div className="ex-stage">
        {step === 'yes' ? (
          <>
            <p className="ex-lead">那就把它缩到最小：只做五分钟，做完就算完成。</p>
            <p className="ex-note">写下来、做一点点，比在脑子里反复演算要轻。</p>
          </>
        ) : (
          <>
            <p className="ex-lead">那就先把它放在这里。不是不管，是现在不管。</p>
            <p className="ex-note">反刍会把「还没发生的事」当成「已经在发生的事」。它今晚不需要答案。</p>
          </>
        )}
      </div>
      <div className="ex-actions">
        <button type="button" className="button ghost" onClick={() => { setText(''); setStep('write'); }}>
          再来一次
        </button>
      </div>
    </div>
  );
}

/* ---------- 8. 睡前放松 ---------- */

const SLEEP_PROMPTS = [
  '让额头松下来。',
  '让肩膀往下沉一点。',
  '把手放在肚子上，感觉它起伏。',
  '让大腿的重量交给床。',
  '让脚趾松开。',
  '不用再检查今天做得够不够。',
];

function SleepRelax() {
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [second, setSecond] = useState(4);
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    let current: 'in' | 'out' = 'in';
    let left = 4;
    const timer = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        if (current === 'out') {
          setPromptIndex((value) => (value + 1) % SLEEP_PROMPTS.length);
        }
        current = current === 'in' ? 'out' : 'in';
        left = current === 'in' ? 4 : 7;
      }
      setPhase(current);
      setSecond(left);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ex-body sleep-body">
      <div className="sleep-stage">
        <div className={`sleep-halo is-${phase}`} aria-hidden="true" />
        <p className="sleep-cue">{phase === 'in' ? '吸气' : '呼气'} · {second}</p>
        <p className="sleep-prompt">{SLEEP_PROMPTS[promptIndex]}</p>
      </div>
      <p className="ex-note sleep-note">
        呼气放到 7 秒，比吸气长。不用数得准，跟着感觉就好。屏幕暗下来了，想直接关掉也可以。
      </p>
    </div>
  );
}

/* ---------- 9. 睡前思绪整理 ---------- */

interface NightItem {
  id: string;
  text: string;
  mark?: 'later' | 'tonight';
}

function SleepThoughtDump() {
  const [items, setItems] = useState<NightItem[]>([]);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const value = text.trim();
    if (!value) return;
    setItems((current) => [{ id: `n-${Date.now()}`, text: value }, ...current].slice(0, 12));
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="ex-body sleep-body">
      <div className="sleep-stage sleep-stage-plain">
        <p className="ex-lead">把脑子里转的事一件件放到这里。</p>
        <div className="night-input">
          <input
            ref={inputRef}
            value={text}
            placeholder="还有一件事是……"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="button ghost small" onClick={add} disabled={!text.trim()}>
            放上去
          </button>
        </div>
      </div>

      {items.length ? (
        <ul className="night-list">
          {items.map((item) => (
            <li key={item.id} className={`night-item ${item.mark ? `is-${item.mark}` : ''}`}>
              <p>{item.text}</p>
              <div className="night-marks">
                <button
                  type="button"
                  className={item.mark === 'later' ? 'is-on' : ''}
                  onClick={() =>
                    setItems((current) =>
                      current.map((row) => (row.id === item.id ? { ...row, mark: 'later' } : row)),
                    )
                  }
                >
                  今晚不解决
                </button>
                <button
                  type="button"
                  className={item.mark === 'tonight' ? 'is-on' : ''}
                  onClick={() =>
                    setItems((current) =>
                      current.map((row) => (row.id === item.id ? { ...row, mark: 'tonight' } : row)),
                    )
                  }
                >
                  明天再说
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ex-note sleep-note">还没放上来也没关系。写下来的那一刻，它就不用在脑子里转了。</p>
      )}

      {items.length ? (
        <p className="ex-note sleep-note">
          标好的这些，今晚都不用处理。关掉这一页，它们就散了——明天真的想起来，再写一遍也不迟。
        </p>
      ) : null}
    </div>
  );
}

/* ---------- 注册表 ---------- */

export const CALM_CATEGORIES: Array<'全部' | ExerciseCategory> = [
  '全部',
  '专注力训练',
  '节律呼吸',
  '躯体放松',
  '即刻疗愈·SOS',
  '睡眠',
];

export const EXERCISES: ExerciseDef[] = [
  {
    id: 'schulte',
    cat: '专注力训练',
    name: '动态舒尔特方格',
    desc: '在数字矩阵中按顺序搜寻目标，把注意力从杂念拉回眼前。',
    body: () => <SchulteGrid />,
  },
  {
    id: 'breath',
    cat: '节律呼吸',
    name: '呼吸训练',
    desc: '跟随光环做节律呼吸，延长呼气，安抚身体紧张。',
    body: () => <BreathHalo />,
  },
  {
    id: 'grounding',
    cat: '即刻疗愈·SOS',
    name: '54321 练习',
    desc: '五感逐级锚定当下，快速从惊恐或强烈反刍中抽离。',
    body: () => <Grounding54321 />,
  },
  {
    id: 'pmr',
    cat: '躯体放松',
    name: '身体放松 PMR',
    desc: '依次绷紧再放松肌群，体会紧张与松弛的对照，卸下身体负担。',
    body: () => <PMRRelax />,
  },
  {
    id: 'stroop',
    cat: '专注力训练',
    name: 'Stroop 训练',
    desc: '读出字的颜色而非字义，锻炼抑制控制，打断自动化焦虑。',
    body: () => <StroopGame />,
  },
  {
    id: 'tiny',
    cat: '即刻疗愈·SOS',
    name: '微小行动',
    desc: '从一件极小、马上能完成的事开始，让行动带动情绪。',
    body: () => <TinyAction />,
  },
  {
    id: 'rumination',
    cat: '即刻疗愈·SOS',
    name: '反刍打断',
    desc: '把盘旋的念头写下来并判断能否解决，打断反复回放。',
    body: () => <RuminationBreak />,
  },
  {
    id: 'sleep',
    cat: '睡眠',
    name: '睡前放松',
    desc: '睡前把呼吸放慢、身体松开，为入睡做准备。',
    body: () => <SleepRelax />,
  },
  {
    id: 'sleep-thoughts',
    cat: '睡眠',
    name: '睡前思绪整理',
    desc: '把脑子里转的事写下来，判断今晚要不要解决。',
    body: () => <SleepThoughtDump />,
  },
];

export const CALM_SCIENCE = [
  {
    title: '焦虑是什么',
    body: '焦虑是身体面对压力时的正常警报：大脑判断有潜在威胁，就启动「战斗或逃跑」，让心跳、呼吸、注意力进入准备状态。短期出现是合理的，危险的是长期高警觉得不到恢复。',
  },
  {
    title: '练习生效的底层逻辑',
    body: '',
    list: [
      '呼吸类：刻意延长呼气，强化迷走神经张力，把身体从交感主导切换回副交感（休息与修复）状态，带来心率下降、心率变异性上升等可测量的生理变化，并非单纯心理暗示。',
      '接地 / 54321 五感：借五感信号把注意力拉回此时此地的身体，缓解解离与失控感，属注意锚定技术（Grounding）。',
      '注意力训练（舒尔特、Stroop）：持续占用注意资源，让内部反刍循环暂时中断，是即时干预而非「训练注意力」。',
      '渐进肌肉放松 PMR：紧张—放松的对照重建身体的安全信号，降低生理唤醒。',
      '微小行动：行为激活思路，先做极小行动，用行动带动情绪，而不是等「有力气」再开始。',
      '反刍打断：把念头外化到纸上并判断「现在能否解决」，切断反复回放，对应 CBT 对反刍的干预。',
      '睡眠相关：参考失眠认知行为治疗（CBT-I）的放松训练与刺激控制，帮神经系统从警觉切回休息。',
    ],
  },
];

export const CALM_FAQ = [
  {
    q: '呼吸练习真的有用吗，还是只是心理安慰？',
    a: '延长呼气会经迷走神经引发可测量的生理变化，如心率变异性上升、心率下降，并非单纯的主观放松。',
  },
  {
    q: '每天要练多久才会见效？',
    a: '没有硬性指标。难受的时候拿出来用几分钟就可以，不必追求每日打卡。',
  },
  {
    q: '惊恐发作或极度难受时该怎么办？',
    a: '工具仅做临时缓解。请看「安全与帮助」页面。',
  },
];

/** 练习弹窗底部统一的一句引导；具体文案在 ExerciseModal 里用。 */
export const DRAFT_PREFIX = (name: string) => `刚刚做完【${name}】练习，此刻我的感受：`;
