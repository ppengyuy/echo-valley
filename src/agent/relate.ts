/**
 * 新旧回音的本地关联判定（P1-03）。
 *
 * 为什么全在本地算：模型可能把两段没关系的话说成"有内在关联"，
 * 而回音一旦被错误牵到一起，就变成了替用户下结论。
 * README 第 9 条已知局限也写明提示词驱动的关联稳定性受模型波动影响，
 * 所以这里只做确定性的字面相近判断，宁缺毋滥。
 *
 * 红线：
 * - 只负责"找出一条可能相近的旧回音"，不解释关联、不总结共同点；
 * - 镜像回音（写给自己的话）不参与配对；
 * - 判定结果只是一个邀请，带不带回原话由用户决定。
 */
import type { Echo } from '../types';

/** 相近判定阈值：再低就会把"今天很累"和"明天考试"也牵到一起。 */
export const RELATE_THRESHOLD = 0.25;
/** 共有二元组的下限：只靠一两个字重合不算相近。 */
export const RELATE_MIN_SHARED = 3;
/** 同标签的加权：用户自己贴的标签比字面更可信。 */
const SAME_TAG_BONUS = 0.15;
/** 刚存下的回音大概率来自同一段对话，隔开这么久才配对。 */
export const RELATE_MIN_AGE_MS = 10 * 60 * 1000;
/** 少于这个条数时，山谷里还没攒够东西，不提示。 */
export const RELATE_MIN_ECHOES = 5;

/** 高频虚字：留着会让任意两句话都"相近"。 */
const STOP_CHARS = new Set('的了是我在也就都很还又吗呢吧啊着过和与把被让这那有个们'.split(''));

/** 去掉空白、标点和高频虚字，只留下能表意的字。 */
export function normalize(text: string): string {
  return Array.from(text)
    .filter((ch) => /[\u4e00-\u9fa5a-zA-Z0-9]/.test(ch))
    .filter((ch) => !STOP_CHARS.has(ch))
    .join('');
}

/** 切成字符二元组集合；长度不足 2 时退化为单字集合。 */
export function bigrams(text: string): Set<string> {
  const clean = normalize(text);
  if (clean.length < 2) return new Set(clean ? [clean] : []);
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i += 1) set.add(clean.slice(i, i + 2));
  return set;
}

export interface RelateScore {
  score: number;
  shared: number;
}

/**
 * 打分：共有二元组占较短那条的比例。
 * 用 min 而不是并集作分母，是为了让一句短话也能和一段长话相近。
 */
export function scoreEchoes(a: Echo, b: Echo): RelateScore {
  const setA = bigrams(a.text);
  const setB = bigrams(b.text);
  if (!setA.size || !setB.size) return { score: 0, shared: 0 };

  let shared = 0;
  for (const gram of setA) if (setB.has(gram)) shared += 1;

  const base = shared / Math.min(setA.size, setB.size);
  const tagA = a.tag?.trim();
  const tagB = b.tag?.trim();
  const bonus = tagA && tagB && tagA === tagB ? SAME_TAG_BONUS : 0;
  return { score: Math.min(1, base + bonus), shared };
}

/** 能参与配对的旧回音：未归档、非镜像、不是刚刚存下的。 */
export function isPairable(echo: Echo, now: number): boolean {
  if (echo.archived) return false;
  if (echo.mirror) return false;
  return now - echo.createdAt >= RELATE_MIN_AGE_MS;
}

/**
 * 找一条和新回音最相近的旧回音；没有够格的就返回 null。
 * 纯函数，不读取时间以外的外部状态，便于单测。
 */
export function findRelated(
  target: Echo,
  echoes: Echo[],
  now: number = Date.now(),
): Echo | null {
  const active = echoes.filter((echo) => !echo.archived);
  if (active.length < RELATE_MIN_ECHOES) return null;

  let best: Echo | null = null;
  let bestScore = 0;

  for (const echo of echoes) {
    if (echo.id === target.id) continue;
    if (!isPairable(echo, now)) continue;
    const { score, shared } = scoreEchoes(target, echo);
    if (score < RELATE_THRESHOLD || shared < RELATE_MIN_SHARED) continue;
    if (score > bestScore) {
      bestScore = score;
      best = echo;
    }
  }

  return best;
}
