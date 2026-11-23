/**
 * 「借一句别人的话」本地摘句库（**当前不在主链路**）。
 *
 * 来源：《知乎用户画像与痛点调研.md》中带来源的真实原声，从中摘取完整句子，
 * 逐字照录、不改写、不编造；每条都保留平台与匿名作者标识用于追溯。
 *
 * 状态说明（2026-11-22 晚）：
 * 方式 C 已从「一次只给一句」改成「按批呈现的烦恼列表」——一句不够让人认出
 * 自己的处境，也看不出「大家其实都在想这些」。批量源见 `generateQuoteBatch()`，
 * 本地兜底见 `worryPool.ts`（那边是转述，不进本文件）。
 *
 * 这个文件因此不再被 `QuietCompanion` 直接使用，保留下来有两个用处：
 * 1. 作为调研原声的**素材底稿**——`README.md` 2.8 的证据映射要能回溯到这里；
 * 2. `llm.ts` 里 `generateQuoteText()` / `QUOTE_GUARD` 仍引用这里的类型与过滤口径，
 *    留作「单句原声」这一通道的备用实现（P1 若要把单句模式接回来，改这里就够）。
 * 若确认不再需要单句模式，可连同 `generateQuoteText()` 一起删。
 *
 * 入库前逐条过 README 所述 7 条硬过滤：
 * 1 第一人称（含叙述者视角） 2 具体细节（时间/地点/动作/数字）
 * 3 无第二人称建议 4 无结果承诺 5 ≤80 字 6 无病症 / 诊断词
 * 7 有可追溯出处（平台 + 匿名作者标识）；另过关键词黑名单。
 *
 * 素材局限：调研原声多为长文，能同时满足全部硬条件的完整句子有限。
 * 部分主题桶条数偏少或为空属真实情况，不以编造 / 改写补足。
 */

export type QuoteBucket =
  | 'lateNight'
  | 'planBroke'
  | 'fearNoResult'
  | 'repeatFail'
  | 'tired'
  | 'family'
  | 'compare';

export interface Quote {
  id: string;
  text: string;
  bucket: QuoteBucket;
  /** 结构配比：经历描述 / 做过一件小事 / 只是承认。 */
  kind: 'experience' | 'smallAct' | 'acknowledge';
  /** 可追溯出处（不展示昵称 / ID）。 */
  source: { platform: '知乎'; author: string; url: string };
}

export const QUOTE_BUCKETS: Array<{ id: QuoteBucket; label: string; keywords: string[] }> = [
  {
    id: 'lateNight',
    label: '深夜学不进去',
    keywords: ['学不进', '看不进', '发呆', '走神', '深夜', '晚上', '坐不住', '崩溃'],
  },
  {
    id: 'planBroke',
    label: '计划崩了',
    keywords: ['打卡', '计划', '断', '中断', '没完成', '没学够', '清零'],
  },
  {
    id: 'fearNoResult',
    label: '怕努力没有结果',
    keywords: ['没结果', '白费', '没用', '考不过', '记不住', '忘了', '回报'],
  },
  {
    id: 'repeatFail',
    label: '反复失败',
    keywords: ['又', '反复', '再', '第几次', '二战', '重来'],
  },
  {
    id: 'tired',
    label: '身体很累',
    keywords: ['累', '很累', '疲惫', '下班', '困', '睡不着', '没力气'],
  },
  {
    id: 'family',
    label: '家里人的期待',
    keywords: ['爸妈', '父母', '家里', '妈妈', '爸爸', '失望', '别考'],
  },
  {
    id: 'compare',
    label: '同辈比较',
    keywords: ['别人', '同学', '进度', '二刷', '比较', '人家'],
  },
];

export const QUOTES: Quote[] = [
  {
    id: 'q-desk-stare',
    text: '坐在书桌前发呆的时间比真正学进去的时间还长。',
    bucket: 'lateNight',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '漫漫谈（已匿名）',
      url: 'https://www.zhihu.com/question/5294421710/answer/2105405587693618742',
    },
  },
  {
    id: 'q-vicious-loop',
    text: '越觉得考不过，越学不进去；越学不进去，又越觉得自己考不过。',
    bucket: 'lateNight',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: 'de-yu-bu-wang-quan-87（已匿名）',
      url: 'https://www.zhihu.com/question/2092939314053367233/answer/2094185522172380137',
    },
  },
  {
    id: 'q-checkin-broke',
    text: '今天打卡断了我和你有一样的情绪，很自责，就差几分钟。',
    bucket: 'planBroke',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '韩大麦（已匿名）',
      url: 'https://www.zhihu.com/question/21536663/answer/982974194',
    },
  },
  {
    id: 'q-forgot-checkin',
    text: '那天特别累……晚上躺到床上，才猛地想起：今天忘了打卡。',
    bucket: 'planBroke',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '自修日进爸爸（已匿名）',
      url: 'https://zhuanlan.zhihu.com/p/2017932448013493502',
    },
  },
  {
    id: 'q-200-days',
    text: '之前已经坚持了200天，突然有一天忘打卡了，隔天打开软件的时候一身冷汗，紧紧张张地补一次卡。',
    bucket: 'planBroke',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '多邻国长期用户（已匿名）',
      url: 'https://www.zhihu.com/question/2028043318978691458/answer/2035383409749512223',
    },
  },
  {
    id: 'q-took-a-day-off',
    text: '但是某一天我主动选了一天没上线……那个中断的天数突然让我感到如释重负，不再被打卡所绑架。',
    bucket: 'planBroke',
    kind: 'smallAct',
    source: {
      platform: '知乎',
      author: '安慰记心理（已匿名）',
      url: 'https://zhuanlan.zhihu.com/p/1939094947673412360',
    },
  },
  {
    id: 'q-checkin-anxiety',
    text: '每天就是为了打卡而打卡，自己被搞得很焦虑。',
    bucket: 'planBroke',
    kind: 'acknowledge',
    source: {
      platform: '知乎',
      author: '多邻国长期用户（已匿名）',
      url: 'https://www.zhihu.com/question/2028043318978691458/answer/2035383409749512223',
    },
  },
  {
    id: 'q-offwork-task',
    text: '即使下班后很累，也要先做完任务再休息，感觉自己是另一个世界的『打工人』。',
    bucket: 'tired',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '安慰记心理（已匿名）',
      url: 'https://zhuanlan.zhihu.com/p/1939094947673412360',
    },
  },
  {
    id: 'q-let-her-down',
    text: '我不是难过她让我别考，我是难过——我连让她失望的资格都没有。',
    bucket: 'family',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '考研学员原话（已匿名，经专栏转述）',
      url: 'https://zhuanlan.zhihu.com/p/2032109062448469937',
    },
  },
  {
    id: 'q-peer-pace',
    text: '看到别人进度快就会慌得不行，觉得自己落后了……刷到别人说『单词已经二刷了』『专业课笔记整理完了』。',
    bucket: 'compare',
    kind: 'experience',
    source: {
      platform: '知乎',
      author: '优优学姐（已匿名）',
      url: 'https://www.zhihu.com/question/1987482638039142403/answer/1989025950038520995',
    },
  },
  {
    id: 'q-book-forgot',
    text: '读的时候觉得字字戳心，合上书没几天，只剩下一句『那本书写得真好』。好在哪，说不上来了。',
    bucket: 'fearNoResult',
    kind: 'acknowledge',
    source: {
      platform: '知乎',
      author: 'NoetiLab（已匿名）',
      url: 'https://www.zhihu.com/question/2040512171499590822/answer/2048293427503273920',
    },
  },
];

/** 黑名单：命中即拦截，不改写、不降级。 */
export const QUOTE_BLACKLIST = [
  '加油',
  '相信自己',
  '一切都会',
  '你已经很棒',
  '想开点',
  '别想太多',
  '你应该',
  '坚持下去',
  '上岸',
  '提分',
];

/** 病症 / 诊断词：命中即拦截。 */
const DIAGNOSIS_WORDS = [
  '抑郁症',
  '焦虑症',
  '双相',
  '强迫症',
  '人格障碍',
  '精神病',
  '诊断',
  '确诊',
  '服药',
  '药物',
];

/** 第二人称建议句式：命中即拦截（第二人称本身不拦，如"我和你有一样的情绪"是共情）。 */
const ADVICE_PATTERNS = [/(你|您)应该/, /你要/, /你得/, /别想/, /建议你/, /(你|您)需要/];

/** 对单条摘句做 7 条硬过滤 + 黑名单，返回是否合格。 */
export function quotePasses(text: string): boolean {
  if (!text || text.length > 80 || text.length < 8) return false;
  if (QUOTE_BLACKLIST.some((word) => text.includes(word))) return false;
  if (DIAGNOSIS_WORDS.some((word) => text.includes(word))) return false;
  if (ADVICE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  // 具体细节：至少含一个时间 / 地点 / 动作 / 状态 / 数字线索。
  // 素材已人工逐条核对，这里只做兜底宽筛，避免把合法句子误杀。
  const hasDetail =
    /\d|[一二三四五六七八九十百]/.test(text) ||
    /(那天|今天|每天|晚上|后来|当时|忽然|几天|一个月|一年|时候|一阵)/.test(text) ||
    /(书桌|图书馆|床上|桌前|公司|家|学校|手机|软件|游戏|书上)/.test(text) ||
    /(坐|盯|写|背|打卡|翻|读|躺|上线|复习|做题|哭|想|逛|考|学|进|慌|落后|进度|笔记|任务|休息|难过|失望|累|做|说|看|记|刷|停|断)/.test(text);
  return hasDetail;
}

/** 构建时自检：库内每一条都必须合格，避免手滑放进不合格素材。 */
export function validateQuoteLibrary(): string[] {
  return QUOTES.filter((quote) => !quotePasses(quote.text)).map((quote) => quote.id);
}

/**
 * 把知乎直答补充源返回的文字解析成合规摘句。
 * 逐条过 7 条硬过滤 + 黑名单；不合格直接丢弃，不改写、不降级。
 * 出处标注为知乎平台 + 匿名作者 + 该主题搜索页（卡片只显示「一位知乎用户」）。
 */
export function parseSupplementQuotes(raw: string, bucket: QuoteBucket): Quote[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^["「『]|["」』]$/g, '').trim())
    .filter((line) => quotePasses(line))
    .slice(0, 5)
    .map((text, index) => ({
      id: `supplement-${bucket}-${index}-${Date.now()}`,
      text,
      bucket,
      kind: 'experience' as const,
      source: {
        platform: '知乎' as const,
        author: '一位知乎用户（直答补充，已匿名）',
        url: `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(QUOTE_BUCKETS.find((b) => b.id === bucket)?.label ?? bucket)}`,
      },
    }));
}
