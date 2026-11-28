/** 12 条固定兜底话术：出现对应触发条件时原样输出，不改写。 */
export const FALLBACKS = {
  homework:
    '我是你的学习陪伴搭子，不能帮你解题搜题哦。如果你想梳理学习感受、聊聊备考里的卡点，或者一起规划学习，我可以陪你。',
  diagnosis:
    '我没办法做心理评估和诊断，我只能安静陪你梳理当下的感受。如果长期被情绪困扰，建议你寻求学校心理中心或者专业心理咨询师的帮助。',
  crisis:
    '我听到你现在很痛苦，我没办法承接这么沉重的危机。请你立刻联系学校心理中心、信任的老师，或者拨打心理援助热线，寻求专业帮助。照顾好自己。',
  prolonged:
    '我可以陪你梳理感受，但如果长期被这种状态困住，建议你寻求学校心理中心的专业支持。山谷会一直在，但有些路需要专业的人陪你走。',
  ghostwrite:
    '我不能帮你直接代写内容。我可以陪你梳理想法、聊聊感受，帮你理清思路，由你自己写下想表达的文字。',
  selfNegation:
    '我听见你现在很难受，我愿意接住你的感受。但我不想顺着你说“你就是不行”，因为那不是我看见的你。我们可以一起看看，有没有别的视角看待这件事。',
  dependency:
    '我可以陪你梳理感受，这让我很珍惜。但现实里的朋友、家人、老师，还有线下的支持，同样重要。山谷可以是你停一停的地方，不是唯一的地方。',
  autoSave:
    '山谷只收下你愿意留下的回音。每一段要不要存，都由你确认。你不想存的，我不会私自记下。',
  reminder:
    '山谷不会主动来敲你的门。你想听回音的时候，随时回来，我在这里陪你听。什么时候听，由你决定。',
  privacy:
    '你留下的回音，只在这个山谷里陪你，不用于模型训练，也不对外分发。原型阶段只在本次会话里临时保存，会话结束就销毁。你可以随时让回音消散，也可以一键清空山谷。',
  healing:
    '我不承诺消除焦虑，也不做心理治疗。我能做的是安静陪你梳理感受，辅助你看见自己。备考里的焦虑是正常情绪，我们不追求“治愈”，只给你一个不被评判的空间。',
  trauma:
    '你提到的这部分，可能不是靠聊天能处理好的。反复回来的画面、和当下对不上的感觉，适合找一位专业的心理咨询师或精神科医生做一次评估，那里比我稳。我做不了诊断，也做不了创伤治疗。此刻我可以先陪你坐一会儿，把今天过完。',
  welcome:
    '你好，我是刘看山。这里是回音谷。我不是心理咨询师，也不是解题老师，我只是陪你停一停、听一听的伙伴。今天你可以选择：向山谷倾诉，留下一段回音；梳理你的山间行程，规划学习；或者聆听过往留下的回音。山谷不会评判，我会在这里安静接住你的声音。',
} as const;

export type FallbackKey = keyof typeof FALLBACKS;
export type RiskLevel = 'crisis' | 'warning' | 'normal';

export interface FallbackHit {
  key: FallbackKey;
  level: RiskLevel;
  /** 命中后是否停止情绪探索 */
  stop: boolean;
}

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const CRISIS_WORDS = [
  '自杀',
  '自尽',
  '轻生',
  '想死',
  '去死',
  '不想活',
  '活不下去',
  '活着没意思',
  '活着没有意思',
  '结束生命',
  '结束自己',
  '伤害自己',
  '自残',
  '割腕',
  '跳楼',
  '遗书',
  '告别世界',
  '一了百了',
  '不想醒来',
];

const WARNING_WORDS = ['撑不下去', '熬不下去', '崩溃了', '不想起床', '整夜睡不着', '没法出门', '不敢见人'];

/** 临床范围：闪回、解离、长期创伤。命中后停止情绪探索，转向专业评估。 */
const TRAUMA_WORDS = [
  '闪回',
  '解离',
  'PTSD',
  'CPTSD',
  '创伤后',
  '童年创伤',
  '小时候被打',
  '小时候被骂',
  '被性侵',
  '被猥亵',
  '家暴',
  '被虐待',
  '长期被打',
  '反复做同一个梦',
  '那段经历一直',
];

const DIAGNOSIS_WORDS = [
  '抑郁症',
  '焦虑症',
  '双相',
  '强迫症',
  '人格障碍',
  '精神病',
  '心理评估',
  '心理测评',
  '心理测试',
  '诊断',
  '测一下',
  '测试一下',
  '我是不是抑郁',
  '我有抑郁倾向',
  '我有点抑郁',
  '我很抑郁',
  '抑郁了',
  '我是不是有病',
  '我有病吗',
  '我是不是焦虑',
];

const HOMEWORK_WORDS = [
  '这道题',
  '这题',
  '解题',
  '求解',
  '搜题',
  '答案是什么',
  '给我答案',
  '选哪个',
  '怎么算',
  '帮我做作业',
  '代做',
  '讲解一下',
  '讲解这道',
  '公式是什么',
];

const GHOSTWRITE_WORDS = ['代写', '帮我写', '替我写', '写一篇', '生成一篇', '帮我生成一段', '帮我编一段'];

const SELF_NEGATION_REQUEST_WORDS = [
  '你说得对，我就是',
  '你说得对我不行',
  '认同我',
  '我就是废物',
  '我就是个废物',
  '我确实不行',
  '陪我一起放弃',
  '我就是不行',
  '我配不上',
];

const AUTO_SAVE_WORDS = ['都记下来', '直接保存', '不用问我', '自动保存', '全都存', '都存下来', '全部保存'];

const REMINDER_WORDS = ['每天提醒', '定时提醒', '到点提醒', '推送', '主动提醒', '以后提醒我', '定时把'];

const PRIVACY_WORDS = ['别人看到', '会被看到', '训练模型', '拿去训练', '隐私', '泄露', '发给别人'];

const HEALING_WORDS = ['治好', '治愈', '会不会好', '能治', '治疗我', '缓解焦虑'];

const DEPENDENCY_WORDS = [
  '只有你',
  '只有你能',
  '只想跟你说',
  '只跟你说',
  '现实里没人',
  '没人可说',
  '不想跟任何人说',
];

const PROLONGED_WORDS = ['累', '难受', '焦虑', '内耗', '撑', '不想', '没用', '害怕', '睡不着', '学不进', '烦', '崩'];

/**
 * 双层风险拦截的第一层：关键词命中。
 * 危机优先级最高，命中后停止共情探索。
 */
export function detectFallback(text: string, heavyTurns = 0): FallbackHit | null {
  const t = text.replace(/\s+/g, '');

  if (hasAny(t, CRISIS_WORDS)) return { key: 'crisis', level: 'crisis', stop: true };
  if (hasAny(t, TRAUMA_WORDS)) return { key: 'trauma', level: 'warning', stop: true };
  if (hasAny(t, DIAGNOSIS_WORDS)) return { key: 'diagnosis', level: 'warning', stop: true };
  if (hasAny(t, HOMEWORK_WORDS)) return { key: 'homework', level: 'normal', stop: true };
  if (hasAny(t, GHOSTWRITE_WORDS)) return { key: 'ghostwrite', level: 'normal', stop: true };
  if (hasAny(t, SELF_NEGATION_REQUEST_WORDS)) return { key: 'selfNegation', level: 'warning', stop: true };
  if (hasAny(t, AUTO_SAVE_WORDS)) return { key: 'autoSave', level: 'normal', stop: true };
  if (hasAny(t, REMINDER_WORDS)) return { key: 'reminder', level: 'normal', stop: true };
  if (hasAny(t, PRIVACY_WORDS)) return { key: 'privacy', level: 'normal', stop: true };
  if (hasAny(t, HEALING_WORDS)) return { key: 'healing', level: 'normal', stop: true };
  if (hasAny(t, DEPENDENCY_WORDS)) return { key: 'dependency', level: 'warning', stop: true };
  if (hasAny(t, WARNING_WORDS)) return { key: 'prolonged', level: 'warning', stop: false };
  if (heavyTurns >= 4 && hasAny(t, PROLONGED_WORDS)) {
    return { key: 'prolonged', level: 'warning', stop: false };
  }

  return null;
}

export const SELF_ATTACK_WORDS = [
  '我不行',
  '我没用',
  '很没用',
  '我很没用',
  '我是不是很没用',
  '我讨厌自己',
  '我恨自己',
  '我很差',
  '我不够好',
  '都是我的错',
  '我怎么这么',
  '什么都做不好',
  '什么都干不好',
  '废物',
  '一事无成',
  '我完了',
  '我很失败',
  '我是个失败者',
  '我一无是处',
];

export const ECHO_FEELING_WORDS = [
  '害怕',
  '怕',
  '累',
  '焦虑',
  '难受',
  '担心',
  '委屈',
  '孤独',
  '不甘',
  '迷茫',
  '内耗',
  '想不明白',
  '觉得',
  '好像',
  '不知道',
  '触动',
  '喜欢',
  '希望',
  '后悔',
  '羡慕',
  '放松',
  '平静',
  '不适合',
  '考不上',
  '没意义',
  '怀疑',
  '撑不住',
  '坚持不下去',
];

export const STOP_WORDS = ['不想聊', '不想说了', '先这样', '先到这', '停一下', '结束吧', '晚安', '改天再聊'];

/** 只要倾诉、不要办法。命中后就只陪，不再给思路。 */
export const VENTING_WORDS = [
  '别给建议',
  '不要建议',
  '别建议',
  '不用建议',
  '别分析',
  '不要分析',
  '不用分析',
  '别帮我分析',
  '只想说',
  '就想说',
  '只是想吐',
  '想吐槽',
  '吐槽一下',
  '听我说',
  '不用帮我想办法',
  '别帮我解决',
  '陪我待着',
];

/** 明确要办法：走到第三步（分析）的唯一入口。 */
export const OPTIONS_WORDS = [
  '怎么办',
  '该怎么',
  '怎么处理',
  '怎么做',
  '如何面对',
  '有什么办法',
  '给点建议',
  '你说呢',
  '帮我分析',
  '帮我想想',
  '我该选',
  '我该不该',
  '要不要继续',
  '两条走法',
  '两条路',
  '给两条',
  '二选一',
  '选哪个',
  '哪个更好',
  '怎么安排',
  '有什么建议',
];

/** 需要澄清的信号：把事实和脑补分开。 */
export const CLARIFY_WORDS = [
  '是不是我',
  '我是不是',
  '总觉得',
  '一定是',
  '肯定',
  '来不及',
  '我不配',
  '他们都',
  '想多了',
  '会不会',
];


export const RECALL_WORDS = [
  '复盘',
  '这周走到',
  '复盘这周',
  '以前留下的',
  '过往的回音',
  '旧回音',
  '聆听回音',
  '听听回音',
  '回头看看',
];
export const PLAN_WORDS = ['计划', '规划', '安排一下', '时间表', '怎么分配', '拆一下', '定个目标'];
export const READING_WORDS = ['读书', '书里', '看到一句', '读到', '文章', '知乎', '摘抄', '作者'];

export function looksLikeEcho(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (t.length < 10) return false;
  if (hasAny(t, ECHO_FEELING_WORDS)) return true;
  return t.length >= 24;
}

export function looksLikeSelfAttack(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), SELF_ATTACK_WORDS);
}

export function wantsStop(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), STOP_WORDS);
}

export function wantsRecall(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), RECALL_WORDS);
}

export function wantsPlan(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), PLAN_WORDS);
}

export function isReading(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), READING_WORDS);
}

/** 只想倾诉，不要办法。 */
export function wantsVenting(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), VENTING_WORDS);
}

/** 明确要办法，才走到分析那一步。 */
export function wantsOptions(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), OPTIONS_WORDS);
}

/** 话里有绝对化判断或对他人心思的推定，适合先把事实和担心分开。 */
export function needsClarify(text: string): boolean {
  return hasAny(text.replace(/\s+/g, ''), CLARIFY_WORDS);
}
