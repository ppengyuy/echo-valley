import type { ChatMessage } from '../types';
import { FALLBACKS } from '../data/fallbacks';
import { checkReply } from './guard';
import { LIUKANSHAN_SYSTEM_PROMPT } from './systemPrompt';

/**
 * 知乎直答（开发者 API）。
 *
 * 本地开发时走 Vite 代理 `/api/zhida`：Access Secret 只在 Node 侧读取，
 * 不会出现在浏览器 bundle 里。代理会补上 Authorization 和 X-Request-Timestamp。
 */
const endpoint =
  (import.meta.env.VITE_ZHIDA_ENDPOINT as string | undefined)?.trim() ||
  '/api/zhida/v1/chat/completions';
const configured = (import.meta.env.VITE_ZHIDA_ENABLED as string | undefined) === 'true';
const model =
  (import.meta.env.VITE_ZHIDA_MODEL as string | undefined)?.trim() || 'zhida-fast-1p5';

export function llmConfigured(): boolean {
  return configured;
}

type WireMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/** 直答模型容易滑回问答/教程腔，把格式要求跟用户原话放在同一条消息里更稳。 */
const ZHIDA_STYLE_GUARD = `请只以刘看山的口吻回应下面这句话。
只输出 2–5 句短句，先接住情绪，最多问一个问题。
不要分析、不要列点、不要 Markdown、不要建议清单、不要复述原话、不要提界面或记录。`;

/**
 * 只发一次请求，失败返回 null。
 * 401 / 402 / 429 / 超时都交给本地引擎，界面上不弹错误，避免打断情绪。
 */
/**
 * 只发一次请求，失败返回 null。
 * 401 / 402 / 429 / 超时都交给本地引擎，界面上不弹错误，避免打断情绪。
 * 429 单独记一笔：连续换批打太快会被知乎限流，退避由调用方（批量列表）负责。
 */
let rateLimitedAt = 0;

/** 最近是否刚被限流过（批量列表据此决定先回本地、隔一会儿再试知乎）。 */
export function recentlyRateLimited(windowMs = 30000): boolean {
  return rateLimitedAt > 0 && Date.now() - rateLimitedAt < windowMs;
}

async function requestReply(messages: WireMessage[]): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429) rateLimitedAt = Date.now();
      if (import.meta.env.DEV) {
        let detail = '';
        try {
          const error = (await response.json()) as { error?: { message?: string } };
          detail = error.error?.message ? `：${error.error.message}` : '';
        } catch {
          // 忽略错误体解析失败，状态码足够定位。
        }
        console.warn(
          `[回音谷] 知乎直答请求失败：HTTP ${response.status}${detail}，这一句由本地引擎接住。`,
        );
      }
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[回音谷] 知乎直答请求异常，这一句由本地引擎接住。', error);
    }
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 可选的真实模型通道。未配置、调用失败、或两次都没通过口吻安检时返回 null，
 * 由本地对话引擎兜底。只负责生成“说的话”，回音确认、危机兜底、计划生成仍由固定逻辑承接。
 */
export async function generateWithLlm(
  history: ChatMessage[],
  userText: string,
): Promise<string | null> {
  if (!llmConfigured()) return null;

  const recent: WireMessage[] = history
    .filter(
      (message) =>
        message.text &&
        !message.text.startsWith('山谷为你带回') &&
        !(Object.values(FALLBACKS) as string[]).includes(message.text),
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  // 当前这句用户消息会重新包一层格式要求，避免和原文重复。
  const last = recent[recent.length - 1];
  if (last && last.role === 'user' && last.content === userText) recent.pop();

  let correction: string | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userContent = [
      ZHIDA_STYLE_GUARD,
      correction ? `上一条回复被退回：${correction}` : '',
      `用户说：「${userText}」`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const messages: WireMessage[] = [
      { role: 'system', content: LIUKANSHAN_SYSTEM_PROMPT },
      ...recent,
      { role: 'user', content: userContent },
    ];

    const raw = await requestReply(messages);
    if (raw === null) return null;

    const checked = checkReply(raw);
    if (checked.ok) {
      if (import.meta.env.DEV) console.info('[回音谷] 知乎直答回复已通过口吻检查');
      return checked.text;
    }

    if (import.meta.env.DEV) {
      console.warn('[回音谷] 模型这句没通过口吻安检：', checked.reasons.join('；'), '\n原文：', raw);
    }

    correction = `原因：${checked.reasons.join(
      '；',
    )}。请只回 2–5 句刘看山的口语，先接住情绪，不要分析、列点、Markdown、建议清单，也不要复述用户原话。`;
  }

  if (import.meta.env.DEV) console.info('[回音谷] 知乎直答两次未通过，退回本地引擎');
  return null;
}

/** 候选备考任务的专用提示：只要经验动作，不押题、不承诺、不绑定时间。 */
const CANDIDATE_GUARD = `你在帮备考的人列"别人常做的备考动作"当作备选参考，不是权威方案。
只输出 10–15 行，每行一件具体动作，不要编号、不要时间、不要时长、不要解释、不要 Markdown。
不要押题、不要承诺提分、不要评价用户、不要复述问题。
不要判断用户现在处在哪个阶段、进度是快是慢，也不要催促。`;

/** 阶段说明只用来决定这一批给什么，不代表对用户进度的判断。 */
const STAGE_HINT: Record<string, string> = {
  base: '基础（先把地图摊开，熟悉框架和范围）',
  build: '强化（把卡住的地方磨一磨，练熟练透）',
  sprint: '冲刺（把手感留住，整体过一遍）',
};

export interface CandidateTextOptions {
  /** 用户自己点选的阶段；'all' 或缺省时不加阶段约束。 */
  stage?: string;
  /** 这一轮已经给过的条目，最多带 30 条，避免 prompt 过长。 */
  exclude?: string[];
}

/**
 * 为「AI 辅助备考计划生成」拉取候选任务。失败返回 null 由调用方降级到本地通用池。
 * 不走情绪口吻检查（候选是动作清单，不是安慰话），但仍要求结构干净。
 */
export async function generateCandidateText(
  goal: string,
  opts: CandidateTextOptions = {},
): Promise<string | null> {
  if (!configured) return null;

  const stageLine =
    opts.stage && opts.stage !== 'all' && STAGE_HINT[opts.stage]
      ? `\n用户自己选的阶段：${STAGE_HINT[opts.stage]}。请只给这一类的动作。`
      : '';
  const excludeList = (opts.exclude ?? []).slice(0, 30);
  const excludeLine = excludeList.length
    ? `\n下面这些已经给过，请避开，换一些别的：\n${excludeList.join('\n')}`
    : '';

  const raw = await requestReply([
    { role: 'system', content: CANDIDATE_GUARD },
    {
      role: 'user',
      content: `这位备考者想靠近的方向是：${goal}${stageLine}\n请给出这个方向下常见的备考动作，给 10–15 条，每行一件，不要编号。${excludeLine}`,
    },
  ]);
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length >= 4 &&
        !/\d+\s*(?:分钟|小时)/.test(line) &&
        !/[：:]$/.test(line) &&
        !/^(?:以下|下面|例如|比如|常见|参考|建议|这里是|这个方向)/.test(line),
    );
  return lines.length >= 3 ? lines.slice(0, 15).join('\n') : null;
}

/**
 * 「借一句别人的话」的补充源：从知乎经验里找同路人的第一人称原声。
 * 只做素材采集，不生成安慰、不改写；不合格由调用方逐条丢弃。
 * 文档规定 Query：知乎 备考 {主题桶关键词} 第一人称 经历 当时。
 */
const QUOTE_GUARD = `你在找备考者写下的真实经历原句，当作"同路人的原声"给另一个备考者看。
只输出 3–5 行，每行一句，必须是第一人称、含具体细节（时间/地点/动作/数字），不超过 80 字。
不要安慰、不要建议、不要承诺、不要评价、不要编号、不要解释、不要 Markdown。
不要出现病症名、诊断词、加油/上岸/提分这类词。`;

export async function generateQuoteText(bucketKeyword: string): Promise<string | null> {
  if (!configured) return null;
  const raw = await requestReply([
    { role: 'system', content: QUOTE_GUARD },
    { role: 'user', content: `知乎 备考 ${bucketKeyword} 第一人称 经历 当时` },
  ]);
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^["「]|["」]$/g, '').trim())
    .filter((line) => line.length >= 8 && line.length <= 80 && !/[：:]$/.test(line));
  return lines.length ? lines.slice(0, 5).join('\n') : null;
}

/**
 * 「借一句别人的话」批量源。
 *
 * 一次拉一批，尽可能铺开备考期里的不同烦恼面——
 * 深夜学不进、计划断了、怕没结果、反复失败、身体累、家里期待、同辈比较、临考前的慌，
 * 而不是围着同一个情绪点绕。调用方按批呈现，看不下去就换下一批。
 *
 * 输出的是「知乎问答里的说法整理」，不是逐字原声，界面要如实标注来源，
 * 不能冒充某位具体用户的原话。`exclude` 里已有的句子会被要求避开。
 */
const QUOTE_BATCH_GUARD = (asked: number) => `你在为备考的人整理"大家在备考期里心里冒出来的念头"，素材来自知乎上的问答与经历分享。
读者是另一个正在备考、心里很累的人，他要能从里面认出"这就是我"。

【要什么】一个人在心里说的话——担心什么、怕什么、卡在哪里、什么时候最难受。
【不要什么】学习方法、用什么资料、报什么班、考多少分、怎么提分。这些一律不要。

好的样子（都是心里的话，有具体的处境）：
- 每天晚上十一点坐下，翻开书就开始犯困，硬撑到两点，第二天又起不来。
- 计划表做到第三天就断了，之后每次看到那张表都想删掉，又舍不得。
- 有人一整天坐在图书馆，回宿舍路上想不起今天学了哪一块。
- 我妈每天打电话问我学得怎么样，我说还行，其实那天没怎么学。
- 最怕的不是考不上，是考不上之后还得跟人解释这大半年。
- 模考完那天什么也做不了，就躺着刷手机，刷到凌晨。

不要的样子（这些全都不合格）：
- 精讲听了两遍，第三遍挑着听，觉得直播效率不高就改录播。（这是学习方法）
- 案例分析踩不准得分点，公文格式总拿捏不准。（这是能力短板，不是心里的话）
- 计划表排得满满当当，执行到第三天就开始塌方。（没有人，像总结）
- 背了忘、忘了背，记忆像漏水的桶。（格言，没有人，也不是具体处境）

要求：
1. 只输出 ${asked} 行，每行一句，不要编号、不要项目符号、不要解释、不要 Markdown。
2. 每句 18–70 字，写具体的处境（时间、地点、动作），不要抽象概括。
3. 句式要杂，不要每句都从"我"开头：一半左右第一人称，其余用"有人……""很多人……"
   "那时候……""每天……""最怕的是……"或直接从动作场景切入。
4. 尽量铺开不同面，每个面最多 2 行：深夜学不进、计划断了、怕努力没结果、反复失败、
   身体累、家里人的期待、和别人比进度、临考前的慌。
5. 不要安慰、不要建议、不要承诺结果、不要评价看的人，不要写"你应该"。
6. 不要出现病症名、诊断词，不要出现"加油、上岸、提分、逆袭"这类词。
7. 不要写"我是不是病了 / 身体出了问题 / 该去看医生"这类往病症上靠的话——
   写具体状态就好（睡不着、心慌、坐不住），不替人下判断。
8. 不要用比喻收尾，不要写得漂亮，写粗糙的实话。`;

/** 批量源里额外拦一层：不够格的句子不进列表，不靠改写补救。 */
const BATCH_BLOCKLIST = [
  '加油',
  '上岸',
  '提分',
  '逆袭',
  '相信自己',
  '你已经很棒',
  '别想太多',
  '想开点',
  '抑郁症',
  '焦虑症',
  '双相',
  '强迫症',
  '人格障碍',
  '精神病',
  '诊断',
  '确诊',
  '服药',
  '吃药',
  '看医生',
  '去医院',
  '出了问题',
  '病了',
];

/**
 * 方法论 / 经验分享的标记词。
 *
 * 知乎上「备考」相关的内容八成是**怎么学**（听谁的课、用哪本书、刷几遍真题），
 * 而这里要的是**心里怎么想**。模型经常把前者混进来，于是单独拦一层。
 *
 * 只收「明显指向方法、资料、课程、得分」的强信号词，不放「网课」「学习方法」
 * 这类在情绪句里也常见的词——"打开网课，听老师讲了四十分钟，一个字都没进脑子"
 * 是合格的情绪句，不该被拦。宽进窄出，宁可漏一条也别把好句子毙了。
 */
const METHOD_WORDS = [
  '精讲',
  '录播',
  '讲义',
  '答题模板',
  '得分点',
  '背诵方法',
  '复习方法',
  '提分方法',
  '刷题技巧',
  '答题技巧',
  '经验贴',
  '押题',
  '报班',
];

/**
 * 「这像不像一个人在心里说话」——只用于**排序**，不用于淘汰。
 *
 * 中文常省主语，硬规则一定会误杀（试过：硬拦会毙掉 21/120 条本地句，
 * 而"计划表做到第三天就断了"这种完全合格）。所以这里只打分：
 * 沾到人称 / 情绪 / 具体场景的排前面，三样都不沾的（更像现象总结）排后面。
 * 数量不够时它们照样会被选进来——宁可留着，也不为了好看把句子扔掉。
 */
const PERSON_MARKS = /(我|自己|有人|很多人|有些人|我们|大家|他|她|那时候|那年|当时)/;
const FEELING_MARKS =
  /(怕|慌|累|困|烦|难受|委屈|空|闷|崩|绷|自责|愧疚|后悔|焦虑|着急|心慌|睡不着|失眠|想哭|喘不过气|提不起|坐不住|不想说话|不想动|紧张|压力|羡慕|不甘|失落|无力|走神|舍不得|不敢|怀疑|失望|撑不住|熬)/;
const SCENE_MARKS =
  /(凌晨|半夜|深夜|晚上|早上|中午|下午|这几天|最近|这周|上周|今天|昨天|倒计时|每天|一整天|闹钟|书桌|桌前|图书馆|自习室|宿舍|教室|地铁|通勤|躺下|翻开|合上|合书|打卡|真题|模考|日历|笔记|手机|群里|朋友圈|打电话|饭桌|亲戚|出门|下课|下班)/;

/** 这句话有多像「谁在心里说的」，0–3 分。 */
export function voiceScore(line: string): number {
  let score = 0;
  if (PERSON_MARKS.test(line)) score += 1;
  if (FEELING_MARKS.test(line)) score += 1;
  if (SCENE_MARKS.test(line)) score += 1;
  return score;
}

export function batchLinePasses(line: string): boolean {
  if (!line || line.length < 10 || line.length > 90) return false;
  if (BATCH_BLOCKLIST.some((word) => line.includes(word))) return false;
  if (METHOD_WORDS.some((word) => line.includes(word))) return false;
  if (/(你|您)应该|你要|你得|你该|您该|建议你|你最好/.test(line)) return false;
  if (/[：:]$/.test(line)) return false;
  if (/^(?:以下|下面|这些|希望|注意|说明|补充)/.test(line)) return false;
  // 「引用 + 破折号解释」是知乎帖子的排版，不是一个人在心里说的话。
  // 这类句子还特别长（列表里要占三四行），整条拦掉。
  if (line.includes('——')) return false;
  // 整句被引号包住的，多半是从回答里整段抄下来的，也不要。
  if (/^["“「『]/.test(line)) return false;
  return true;
}

/**
 * 选一批要展示的行：先过 `batchLinePasses`，再按「像不像人说的话」定优先级。
 *
 * 三件事依次做：
 * 1. 用 `voiceScore` 把句子分三档（3 分 / 2 分 / 1 分及以下），高档优先挑；
 * 2. 每一档内部按**开头字**分组轮转，避免一整页全是"我……"；
 * 3. 挑不满时按原顺序补足，一行都不丢。
 */
export function pickBatchLines(lines: string[], count: number): string[] {
  const clean = lines.filter((line) => batchLinePasses(line));
  const tiers = [3, 2, 1, 0].map((score) => clean.filter((line) => voiceScore(line) === score));

  const interleave = (group: string[]): string[] => {
    const buckets = new Map<string, string[]>();
    for (const line of group) {
      const key = line.trim().slice(0, 1);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(line);
      else buckets.set(key, [line]);
    }
    const order = [...buckets.keys()];
    const merged: string[] = [];
    for (let round = 0; merged.length < group.length; round += 1) {
      let took = false;
      for (const key of order) {
        const item = buckets.get(key)![round];
        if (item === undefined) continue;
        merged.push(item);
        took = true;
      }
      if (!took) break;
    }
    return merged;
  };

  const ordered = tiers.flatMap((group) => interleave(group));
  return ordered.slice(0, count);
}

export async function generateQuoteBatch(
  exclude: string[] = [],
  asked = 12,
): Promise<string | null> {
  if (!configured) return null;
  const avoid = exclude.slice(-30);
  const raw = await requestReply([
    { role: 'system', content: QUOTE_BATCH_GUARD(asked) },
    {
      role: 'user',
      content: [
        `去知乎翻备考相关的问答和经历分享，只抄**心里的话**——担心什么、怕什么、卡在哪里、什么时候最难受。`,
        `不要抄学习方法、用什么资料、报什么班、考多少分。这些不是这里要的。`,
        `注意：是抄别人怎么说，不是你来总结。每条都要能看出是谁、在什么处境里、心里冒出什么念头。`,
        `抄 ${asked} 条，每条 18–70 字，一条一行，不要编号。`,
        `别每句都用"我"开头，也别写"计划表排得太满就会塌方"这种没人称的总结。`,
        avoid.length ? `下面这些已经抄过了，不要再出现或改写它们：\n${avoid.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ]);
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*·•]|\d+[.、)])\s*/, '')
        .replace(/^["「『]|["」』]$/g, '')
        .trim(),
    )
    .filter((line) => batchLinePasses(line) && !avoid.includes(line));
  const unique = [...new Set(lines)];
  return unique.length >= 4 ? unique.slice(0, asked).join('\n') : null;
}
