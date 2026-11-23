export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type WeatherKind = 'mist' | 'rain' | 'breeze' | 'clear';

export interface Echo {
  id: string;
  text: string;
  createdAt: number;
  tag?: string;
  link?: string;
  linkNote?: string;
  mirror?: boolean;
  archived?: boolean;
  /** 用户主动置顶，最多 3 条；仅用户自己可取消。 */
  pinned?: boolean;
  /** 由「放进水里」写下的回音：只标来源类型，绝不携带石子原文。 */
  fromStone?: boolean;
}

/** 溪边的石子：别人说过的话，暂放溪滩，由用户决定怎么对待。 */
export type StoneType = 'method' | 'touch';

export interface Stone {
  id: string;
  /** 摘录原文，不限字数，但只摘真正让你停下的那段、不整篇搬运。 */
  text: string;
  /** 来源（知乎 / 书名 / 作者 / 帖子），无来源不收。 */
  source: string;
  /** 由用户点选，AI 不预判。 */
  type: StoneType;
  /** 用户自己写的批注，可空。 */
  my_note?: string;
  /** 用户自建标签，可空。 */
  tags?: string[];
  saved_at: number;
  /** 手动拖拽调序用，越大越靠前；缺省按 saved_at 倒序。 */
  order?: number;
}

export type PlanLevel = 'year' | 'month' | 'week' | 'day';

export type PlanStatus = 'planned' | 'doing' | 'rest' | 'later' | 'let_go';

export interface PlanItem {
  plan_id: string;
  level: PlanLevel;
  start_date: string;
  end_date: string;
  direction: string;
  arrangement: string;
  enough_point?: string;
  planned_minutes: number;
  actual_minutes: number;
  status: PlanStatus;
  is_buffer: boolean;
  /** 先放一放，收进口袋；不计入容量，也不出现在导出里。 */
  pocket?: boolean;
  note?: string;
}

export interface Plan {
  goal: string;
  horizon: string;
  dailyMinutes: number;
  rhythm: string;
  createdAt: number;
  weekStart: string;
  items: PlanItem[];
}

export type ChatRole = 'assistant' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  time: number;
  weather?: { kind: WeatherKind; text: string };
  quiet?: boolean;
}

export interface EchoOffer {
  id: string;
  text: string;
  at: number;
  mirror?: boolean;
  silent?: boolean;
  sourceMessageId: string;
}

export interface MirrorInvite {
  id: string;
  sourceMessageId: string;
}

export type MirrorStage = 'idle' | 'writing' | 'done';

export interface ToastState {
  id: number;
  text: string;
  hint?: string;
}
