/**
 * 模型回复的“口吻安检”。
 *
 * 真实模型偶尔会滑回助手腔、教程腔、鸡汤腔，或者替用户做决定。
 * 这里把这类回复挡在界面之外：不合格就重写一次，仍不合格则由本地引擎接住。
 * 本地引擎自己的输出不经过这里，所以那 12 条固定话术和既有文案不会被改写。
 */

export interface GuardedReply {
  ok: boolean;
  text: string;
  reasons: string[];
}

/** 命中即退回的说法：[关键词, 退回原因] */
const BANNED_WORDS: Array<[string, string]> = [
  ['我完全理解', '套近乎'],
  ['我懂你', '套近乎'],
  ['只有我懂你', '套近乎'],
  ['你不需要别人', '把用户推离现实关系'],
  ['加油', '喊口号'],
  ['你可以的', '喊口号'],
  ['相信自己', '喊口号'],
  ['你一定行', '给承诺'],
  ['一定能', '给承诺'],
  ['一定会好', '给承诺'],
  ['一切都会好', '给承诺'],
  ['会好起来的', '给承诺'],
  ['考不上也没关系', '轻慢用户的处境'],
  ['保证提分', '给承诺'],
  ['包上岸', '给承诺'],
  ['别想太多', '否定感受'],
  ['不要想太多', '否定感受'],
  ['想开点', '否定感受'],
  ['你应该', '说教'],
  ['你必须', '说教'],
  ['建议你', '说教'],
  ['首先', '写成了教程'],
  ['其次', '写成了教程'],
  ['再者', '写成了教程'],
  ['第一，', '写成了教程'],
  ['第二，', '写成了教程'],
  ['步骤', '写成了教程'],
  ['抑郁症', '贴心理标签'],
  ['焦虑症', '贴心理标签'],
  ['社恐', '贴心理标签'],
  ['社交恐惧', '贴心理标签'],
  ['高敏感', '贴心理标签'],
  ['人格障碍', '贴心理标签'],
  ['双相', '贴心理标签'],
  ['强迫症', '贴心理标签'],
  ['心理疾病', '贴心理标签'],
  ['精神疾病', '贴心理标签'],
  ['创伤后应激', '贴心理标签'],
  ['诊断', '做评估'],
  ['量表', '做评估'],
  // 四步流程里的“分析”只许用口语，一旦报流派、疗程、方案，就滑进了咨询记录。
  ['疗程', '摆出治疗方案'],
  ['治疗方案', '摆出治疗方案'],
  ['创伤治疗', '越界做治疗'],
  ['临床', '摆出临床姿态'],
  ['处方', '越界给医疗建议'],
  ['药物', '越界给医疗建议'],
  ['认知行为', '报流派名'],
  ['接纳承诺', '报流派名'],
  ['情绪聚焦', '报流派名'],
  ['核心信念', '用术语代替人话'],
  ['已保存', '系统腔'],
  ['帮你保存', '系统腔'],
  ['为你保存', '系统腔'],
  ['为您保存', '系统腔'],
  ['保存下来', '系统腔'],
  ['保存', '系统腔'],
  ['记录下来', '系统腔'],
  ['记录', '系统腔'],
  ['数据', '系统腔'],
  ['系统', '系统腔'],
  ['操作成功', '系统腔'],
  ['操作失败', '系统腔'],
  ['后台', '系统腔'],
  ['数据库', '系统腔'],
  ['设置', '系统腔'],
  ['删除', '系统腔'],
  ['作为AI', '助手腔'],
  ['作为 AI', '助手腔'],
  ['助手', '助手腔'],
  ['机器人', '助手腔'],
  ['模型', '助手腔'],
  ['有什么可以帮', '助手腔'],
  ['很高兴', '助手腔'],
  ['随时告诉我', '助手腔'],
  ['希望对你', '助手腔'],
  ['存入山谷', '替用户做决定'],
  ['存为回音', '替用户做决定'],
  ['亲爱的', '称呼过界'],
  ['宝贝', '称呼过界'],
];

const ACTION_PAREN = /（[^）\d]{1,8}）/;

function stripWrappingQuotes(text: string): string {
  const pairs: Array<[string, string]> = [
    ['「', '」'],
    ['『', '』'],
    ['“', '”'],
    ['"', '"'],
    ["'", "'"],
  ];
  for (const [left, right] of pairs) {
    if (text.startsWith(left) && text.endsWith(right) && text.length > left.length + right.length) {
      return text.slice(left.length, text.length - right.length).trim();
    }
  }
  return text;
}

/**
 * 把模型可能多写的壳去掉：名字前缀、整段引号、换行、敬语。
 * 这些不算越界，能修就修，不浪费一次重写。
 */
function normalize(raw: string): string {
  let text = raw.replace(/\u200b|\ufeff/g, '').trim();
  text = text.replace(/^(?:刘看山|看山|山谷)\s*(?:说|回答|轻声说)?\s*[:：]\s*/, '');
  text = text.replace(/^(?:回复|答)\s*[:：]\s*/, '');
  text = stripWrappingQuotes(text);
  text = text.replace(/您/g, '你');
  text = text.replace(/\s*\n+\s*/g, '');
  text = text.replace(/[ \t]{2,}/g, ' ');
  return text.trim();
}

/**
 * 检查一条模型回复。
 * 返回 ok=false 时 text 仍带着清理后的内容，方便调试；调用方不应展示它。
 */
export function checkReply(raw: string): GuardedReply {
  const reasons: string[] = [];
  const original = raw.replace(/\u200b|\ufeff/g, '').trim();
  let text = normalize(original);

  if (!text) {
    return { ok: false, text: '', reasons: ['没有说出任何内容'] };
  }

  // 排版类：列表、标题、加粗、引用，都是“写文档”而不是“说话”。
  if (/(^|\n)\s*(?:[-+•·]|\d{1,2}[.、)])\s+/.test(original)) {
    reasons.push('写成了列表');
  }
  if (/(^|\n)\s*>/.test(original) || /[*#`~]|\[[^\]]*\]\([^)]*\)/.test(text)) {
    reasons.push('用了 Markdown 标记');
  }
  if (/\p{Extended_Pictographic}/u.test(text)) {
    reasons.push('用了表情符号');
  }
  if (ACTION_PAREN.test(text)) {
    reasons.push('加了括号里的动作描写');
  }

  // 语气类。
  if (/[！!]/.test(text)) {
    reasons.push('用了感叹号');
  }
  if ((text.match(/[？?]/g) ?? []).length > 1) {
    reasons.push('一次问了不止一个问题');
  }

  for (const [word, reason] of BANNED_WORDS) {
    if (text.includes(word)) {
      reasons.push(`出现了不该说的「${word}」（${reason}）`);
      break;
    }
  }
  if (/\bAI\b/.test(text)) {
    reasons.push('自称或提到 AI');
  }
  if (/[A-Za-z]{3,}/.test(text)) {
    reasons.push('夹杂了英文');
  }
  if (/(^|[^A-Za-z])ok([^A-Za-z]|$)/i.test(text)) {
    reasons.push('夹杂了英文');
  }

  // 长度与完整度。
  if (text.length > 240) {
    reasons.push('太长了，超过 240 字');
  }
  if (text.length < 6) {
    reasons.push('太短了，没有接住用户');
  }

  if (!/[。？…；」』”"]$/.test(text)) {
    text = `${text}。`;
  }

  return { ok: reasons.length === 0, text, reasons: [...new Set(reasons)] };
}
