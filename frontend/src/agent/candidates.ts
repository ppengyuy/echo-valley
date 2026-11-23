/**
 * AI 辅助备考候选任务生成。
 *
 * 红线：
 * - 只输出「别人常做的备选动作」，不押题、不承诺提分、不绑定时间/时长；
 * - 知乎直答仅作经验素材，失败或超时自动降级到本地通用候选池；
 * - 生成结果永远是「候选项」，用户勾选并逐条确认后才写入计划，绝不自动插入；
 * - 阶段（基础 / 强化 / 冲刺）只由用户自己点选，用来决定这一批给什么，
 *   不写进计划、不进导出，也不根据考试时间或计划进度替用户推断。
 */
import { llmConfigured, generateCandidateText } from './llm';

/** 用户自己点选的阶段；'all' 表示不分阶段，是默认值。 */
export type CandidateStage = 'all' | 'base' | 'build' | 'sprint';

export interface CandidateOptions {
  /** 用户点选的阶段，缺省为 'all'，保持与旧调用一致。 */
  stage?: CandidateStage;
  /** 这一轮里已经给过的条目，换一批时避开。 */
  exclude?: string[];
}

export interface CandidateResult {
  items: string[];
  /** 供用户知情：这一批是网络经验参考，还是本地通用参考。 */
  source: 'zhida' | 'local';
  degraded: boolean;
  /** 本地池里这个阶段的条目已经全给过了；UI 用它显示「差不多都在这里了」。 */
  exhausted: boolean;
}

type StagePool = Record<Exclude<CandidateStage, 'all'>, string[]>;

/**
 * 通用备考参考：不针对某个考试押题，只给普适的动作候选。
 * 每个方向按三个阶段各 12 条以上，合计 36 条以上，够连换两三批不重复。
 */
const LOCAL_POOL: Record<string, StagePool> = {
  考研: {
    base: [
      '梳理一门专业课的知识框架',
      '过一遍去年的招生简章与参考书',
      '把专业课目录抄下来当地图',
      '过一遍英语高频词的第一轮',
      '通读一遍政治的章节标题',
      '把参考书按厚度和难度排个先后',
      '找一位学长学姐问清复习重点',
      '整理一份专业课的名词解释清单',
      '把这门课最基础的概念念懂一遍',
      '看一节网课，先听个大概',
      '把要考的科目和分值抄在一张纸上',
      '给自己准备一本错题本和一支顺手的笔',
      '先读完专业课第一章，不求记住',
    ],
    build: [
      '刷一套真题并订正',
      '复盘今天的错题',
      '精读一篇英语阅读并逐句翻译',
      '把一章专业课的真题考点标出来',
      '默写一遍专业课的核心概念',
      '刷一组英语新题型并总结套路',
      '整理政治马原的易混考点',
      '把错题按知识点归类成一张表',
      '把一章的内容讲给自己听一遍',
      '对着框架回忆一遍细节，补上空缺',
      '把两个容易混的概念并排写出来比一比',
      '挑一道做错两次的题，弄懂到能复述',
      '把专业课的论述题拆成答题骨架',
    ],
    sprint: [
      '背一篇作文模板并仿写一段',
      '限时做一套完整真题',
      '把名词解释清单再过一遍',
      '把错题本从头翻到尾',
      '看一遍近期的政治时政要点',
      '把论述题骨架默写一遍',
      '按考试时间做一次英语阅读',
      '把最没把握的一章再读一遍',
      '把高频词的生词挑出来再看一遍',
      '对着真题卷看一遍题型分布',
      '把答题纸的书写和排版练一遍',
      '准备好考试当天要带的东西',
      '把今天记住的三件事写下来就睡',
    ],
  },
  考公: {
    base: [
      '过一遍常识高频点',
      '先弄清行测各模块的题量和时间',
      '把申论的题型分类抄一遍',
      '看一节资料分析的入门讲解',
      '把判断推理的常见题型认一遍',
      '准备一本错题本和一份时间记录表',
      '通读一篇申论范文，不急着分析',
      '整理一份高频成语与实词清单',
      '把数量关系最基础的公式抄下来',
      '找一份岗位表看清自己要考什么',
      '先做一套行测感受一下难度',
      '把近半年的时政标题浏览一遍',
      '问一位考过的人从哪里开始',
    ],
    build: [
      '刷一组行测题并计时',
      '专项刷一组资料分析',
      '专项刷一组判断推理',
      '练一篇申论小题并对照答案',
      '整理今天的错题思路',
      '把错题本上同一类错误再练一遍',
      '把数量关系的常见题型过一遍',
      '积累几条申论素材',
      '整理一份申论常用的分论点框架',
      '把一道秒杀技巧练到能脱口而出',
      '统计一下各模块的正确率，看哪块最弱',
      '把常识错的那几条背景补一下',
      '抄写并背诵一段申论范文',
    ],
    sprint: [
      '限时做一套行测并统计各项正确率',
      '复盘一套模拟卷',
      '按考场时间写一篇完整申论',
      '把分论点框架默写一遍',
      '把错题本上还没弄懂的挑出来过一遍',
      '看一遍最近的时政要点',
      '练一遍涂答题卡的节奏',
      '把速算技巧再手算几道',
      '把申论素材精简成能背的几句',
      '把最弱的那个模块再刷一组',
      '模拟一次完整考试日的作息',
      '准备好考试当天的证件和文具',
      '把今天的三个收获写下来就停',
    ],
  },
  考证: {
    base: [
      '过一遍考试大纲章节',
      '把教材目录抄成一张地图',
      '弄清这门考试考几科、怎么算过',
      '跟一遍网课的第一章',
      '把这一章的公式抄成一张卡片',
      '准备一本错题本',
      '先读完第一章，不求记住',
      '把往年考点在目录上标一遍',
      '看一遍教材上的例题',
      '把专业名词列成一张清单',
      '问一位考过的人从哪章开始',
      '先做一组最简单的题热身',
      '把学习资料整理到一个地方',
    ],
    build: [
      '刷一组章节练习题',
      '整理易混知识点卡片',
      '复盘今天的错题',
      '专项练一组案例分析题',
      '整理一份按章节分的错题清单',
      '背一遍这一章的高频考点',
      '把这一章讲给自己听一遍',
      '把两个容易混的概念并排写出来',
      '跟一遍网课的重点章节',
      '整理一份自己的速记口诀',
      '挑一道做错两次的题弄到会',
      '把计算题的步骤完整写一遍',
      '对着大纲回忆一遍，补上空缺',
    ],
    sprint: [
      '做一套模拟题',
      '限时做一套真题并算分',
      '把错题清单从头过一遍',
      '把速记口诀再默一遍',
      '把最容易忘的三条再看一遍',
      '把公式卡片快速翻一遍',
      '按考试时间做一次完整卷',
      '把最没把握的一章再读一遍',
      '把案例分析的答题模板过一遍',
      '看一遍考场规则和时间安排',
      '准备好证件、文具和路线',
      '把今天记住的三件事写下来',
      '早点睡，明天还要用脑子',
    ],
  },
  期末: {
    base: [
      '梳理一章的知识框架',
      '把老师划的重点抄成一张纸',
      '过一遍课堂重点笔记',
      '弄清这门课怎么算分',
      '把课本目录当地图看一遍',
      '和同学对一遍笔记的重点',
      '找往年卷子看一遍题型分布',
      '整理公式与概念清单',
      '过一遍课本上的例题',
      '把要背的章节圈出来',
      '问一下学长这门课考什么',
      '先读完一章，不求记住',
      '把复习资料整理到一处',
    ],
    build: [
      '做一套往年题',
      '复盘今天的薄弱点',
      '背一遍这门课的名词解释',
      '整理一份错题与易错点清单',
      '把需要背的内容分三遍过',
      '把一章讲给自己听一遍',
      '把两个容易混的概念比一比',
      '挑最难的两道例题弄懂',
      '对着框架回忆细节，补上空缺',
      '把公式推一遍而不是只背',
      '找同学互相提问一轮',
      '把笔记里看不懂的地方问清楚',
      '把计算题完整写一遍步骤',
    ],
    sprint: [
      '限时做一套期末模拟题',
      '整理一份考前速记卡',
      '把最没把握的一章再读一遍',
      '把名词解释快速过一遍',
      '把错题清单从头翻一遍',
      '按考试时间做一次完整卷',
      '把老师划的重点再确认一遍',
      '看一遍考场和考试时间',
      '把速记卡在睡前翻一遍',
      '准备好文具和学生证',
      '把今天记住的三件事写下来',
      '别熬太晚，睡够比多看一章重要',
      '明早起来先把速记卡再看五分钟',
    ],
  },
  default: {
    base: [
      '梳理这段时间的核心框架',
      '过一遍最重要的资料',
      '先弄清这件事的全貌',
      '把要做的部分列成一张清单',
      '把这一段的重点写成一页纸',
      '找同路的人问一问怎么走的',
      '先读完第一部分，不求记住',
      '准备好要用的工具和材料',
      '把资料整理到一个地方',
      '先做一点最容易的，热热身',
      '把不懂的地方先标出来',
      '给自己留一次什么都不做的时间',
      '问清楚自己到底想到哪里',
    ],
    build: [
      '做一组练习并订正',
      '整理易错的知识点',
      '复盘今天走过的路',
      '把最没把握的一块单独练一遍',
      '找一份参考答案对照自己的做法',
      '整理一份自己的错题清单',
      '把需要记的内容分三遍过',
      '把上周卡住的地方再看一遍',
      '挑一件事做到能讲给别人听',
      '把两个容易混的地方比一比',
      '对着框架回忆一遍，补上空缺',
      '把一个步骤完整写下来',
      '找人问一个一直没弄懂的问题',
    ],
    sprint: [
      '限时做一遍并记录用了多久',
      '把清单从头到尾过一遍',
      '把最没把握的一块再看一遍',
      '按真实节奏完整走一次',
      '把要记的内容快速翻一遍',
      '整理一份自己的速记卡',
      '把这段时间的收获写成几句',
      '准备好接下来要用的东西',
      '把今天的三个收获写下来',
      '留一点时间什么都不做',
      '早点睡，状态比进度重要',
      '明早起来先看五分钟速记卡',
      '把剩下的事挑一件最小的做完',
    ],
  },
};

const STAGE_KEYS: Array<Exclude<CandidateStage, 'all'>> = ['base', 'build', 'sprint'];

function poolFor(goal: string): StagePool {
  const key = Object.keys(LOCAL_POOL).find((item) => goal.includes(item)) ?? 'default';
  return LOCAL_POOL[key];
}

/** 取某个方向、某个阶段的全部条目；'all' 时按基础→强化→冲刺顺序合并。 */
function stageItems(goal: string, stage: CandidateStage): string[] {
  const pool = poolFor(goal);
  if (stage !== 'all') return [...pool[stage]];
  return STAGE_KEYS.flatMap((key) => pool[key]);
}

/** 引导语/标题行不算候选动作，避免把"以下是常见动作："当成一件事预填。 */
function isHeaderLine(line: string): boolean {
  return (
    /[：:]$/.test(line) ||
    /^(?:以下|下面|例如|比如|常见|参考|建议|这里是|这个方向)/.test(line) ||
    (/动作$/.test(line) && /常见|备考动作/.test(line))
  );
}

/** 一次给 10–15 条，够挑一轮；仍然只是备选，用户勾选确认才写入。 */
const MAX_CANDIDATES = 15;
const MIN_CANDIDATES = 10;

/** 把模型输出按行拆成干净的候选条目；去掉编号、项目符号、时间和时长后缀。 */
function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^\s*(?:[-*•✦]|\d+[.、)])\s*/, '')
        .replace(/[（(]\s*\d+\s*(?:分钟|小时|min|h)\s*[)）]/gi, '')
        .trim(),
    )
    .filter((line) => line.length >= 4 && line.length <= 40 && !isHeaderLine(line))
    .slice(0, MAX_CANDIDATES);
}

/** 轻量乱序：换一批时顺序不同，但同一批内不重复。 */
function shuffle(items: string[]): string[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * 本地池不够 10 条时，用同方向的其它阶段、再不够用通用池补齐，
 * 保证列表看起来不是三五条就没了。补进来的也会避开 exclude。
 */
function padWithDefault(items: string[], goal: string, exclude: Set<string>): string[] {
  if (items.length >= MIN_CANDIDATES) return items;
  const merge = [...items];
  const push = (extra: string) => {
    if (merge.length >= MIN_CANDIDATES) return;
    if (merge.includes(extra) || exclude.has(extra)) return;
    merge.push(extra);
  };

  // 先补同方向其它阶段，口吻和方向更贴近。
  const own = poolFor(goal);
  for (const key of STAGE_KEYS) own[key].forEach(push);
  if (merge.length >= MIN_CANDIDATES) return merge;

  // 再补通用池。
  for (const key of STAGE_KEYS) LOCAL_POOL.default[key].forEach(push);
  if (merge.length >= MIN_CANDIDATES) return merge;

  // 最后在其它方向里找不重复的，避免总是同一批。
  for (const pool of Object.values(LOCAL_POOL)) {
    if (pool === own) continue;
    for (const key of STAGE_KEYS) pool[key].forEach(push);
    if (merge.length >= MIN_CANDIDATES) break;
  }
  return merge;
}

/** 本地兜底：按阶段取、避开已给过的、乱序后取一批。 */
function localBatch(goal: string, stage: CandidateStage, exclude: Set<string>) {
  const all = stageItems(goal, stage);
  const fresh = all.filter((item) => !exclude.has(item));
  // 这个阶段的条目全给过了：从头循环，并告知 UI 已经绕完一圈。
  if (fresh.length === 0) {
    return { items: shuffle(all).slice(0, MAX_CANDIDATES), exhausted: true };
  }
  const picked = shuffle(fresh).slice(0, MAX_CANDIDATES);
  return {
    items: padWithDefault(picked, goal, exclude),
    // 这一批就把剩下的全用完了，下一次点换一批会从头循环。
    exhausted: fresh.length <= MAX_CANDIDATES,
  };
}

export async function generateCandidates(
  goal: string,
  opts: CandidateOptions = {},
): Promise<CandidateResult> {
  const stage = opts.stage ?? 'all';
  const exclude = new Set((opts.exclude ?? []).map((item) => item.trim()).filter(Boolean));

  if (llmConfigured()) {
    try {
      const raw = await generateCandidateText(goal, {
        stage,
        exclude: Array.from(exclude),
      });
      if (raw) {
        // 模型也可能重复给已出现过的条目，这里再去一次重。
        const items = parseLines(raw).filter((item) => !exclude.has(item));
        if (items.length >= 3) {
          return {
            items: padWithDefault(items, goal, exclude),
            source: 'zhida',
            degraded: false,
            exhausted: false,
          };
        }
      }
    } catch {
      // 掉到本地兜底，不打断用户。
    }
  }

  const local = localBatch(goal, stage, exclude);
  return {
    items: local.items,
    source: 'local',
    degraded: llmConfigured(),
    exhausted: local.exhausted,
  };
}

/** 口吻/内容兜底检查复用 guard；候选条目本身不承载情绪口吻，这里只挡空结果与过长行。 */
export function sanitizeCandidates(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(
    0,
    MAX_CANDIDATES,
  );
}
