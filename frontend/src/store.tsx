import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { FALLBACKS } from './data/fallbacks';
import { syncSummaries } from './plan/edit';
import type {
  ChatMessage,
  Echo,
  EchoOffer,
  MirrorInvite,
  MirrorStage,
  Plan,
  PlanItem,
  Season,
  Stone,
  ToastState,
  WeatherKind,
} from './types';
import { uid } from './utils/date';

const STORAGE_KEY = 'echo-valley-session-v1';

export interface ValleyState {
  messages: ChatMessage[];
  echoes: Echo[];
  /** 溪边的石子：别人的话，与回音完全隔离。 */
  stones: Stone[];
  plan: Plan | null;
  offer: EchoOffer | null;
  mirrorInvite: MirrorInvite | null;
  mirrorStage: MirrorStage;
  recallWait: boolean;
  lastDeclinedText?: string;
  heavyTurns: number;
  season: Season;
  reducedMotion: boolean;
  tagFilter: string;
  toasts: ToastState[];
  rippleSeed: number;
  fiveEchoSeed: number;
  /** 新旧回音可能相近时的轻声提示；带不带回原话由用户决定。 */
  relateHint: { newId: string; oldId: string } | null;
  /** 用户说过"先不用"，本会话不再提示任何关联。 */
  relateMuted: boolean;
  /** 提示过的回音对（`新id|旧id`），同一对不重复提示。 */
  relatedPairs: string[];
}

export const welcomeMessage = (): ChatMessage => ({
  id: uid('msg'),
  role: 'assistant',
  text: FALLBACKS.welcome,
  time: Date.now(),
});

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function initialState(): ValleyState {
  return {
    messages: [welcomeMessage()],
    echoes: [],
    stones: [],
    plan: null,
    offer: null,
    mirrorInvite: null,
    mirrorStage: 'idle',
    recallWait: false,
    heavyTurns: 0,
    season: 'spring',
    reducedMotion: prefersReducedMotion(),
    tagFilter: 'all',
    toasts: [],
    rippleSeed: 0,
    fiveEchoSeed: 0,
    relateHint: null,
    relateMuted: false,
    relatedPairs: [],
  };
}

type Action =
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'SET_OFFER'; offer: EchoOffer }
  | { type: 'DECLINE_OFFER' }
  | { type: 'CLEAR_OFFER' }
  | { type: 'ADD_ECHO'; echo: Echo }
  | { type: 'ARCHIVE_ECHO'; id: string; archived: boolean }
  | { type: 'TOGGLE_PIN'; id: string; pinned: boolean }
  | { type: 'DELETE_ECHO'; id: string }
  | { type: 'CLEAR_ECHOES' }
  | { type: 'UPDATE_ECHO'; id: string; patch: Partial<Echo> }
  | { type: 'ADD_STONE'; stone: Stone }
  | { type: 'UPDATE_STONE'; id: string; patch: Partial<Stone> }
  | { type: 'REMOVE_STONE'; id: string }
  | { type: 'REORDER_STONE'; id: string; targetId: string }
  | { type: 'SET_MIRROR_INVITE'; invite: MirrorInvite | null }
  | { type: 'SET_MIRROR_STAGE'; stage: MirrorStage }
  | { type: 'SET_RECALL_WAIT'; value: boolean }
  | { type: 'BUMP_HEAVY' }
  | { type: 'SET_PLAN'; plan: Plan }
  | { type: 'UPDATE_PLAN_ITEM'; id: string; patch: Partial<PlanItem> }
  | { type: 'SET_SEASON'; season: Season }
  | { type: 'SET_REDUCED'; value: boolean }
  | { type: 'SET_TAG_FILTER'; value: string }
  | { type: 'TOAST'; toast: ToastState }
  | { type: 'DISMISS_TOAST'; id: number }
  | { type: 'SET_RIPPLE'; seed: number }
  | { type: 'SET_FIVE_ECHO'; seed: number }
  | { type: 'SET_RELATE_HINT'; newId: string; oldId: string }
  | { type: 'DISMISS_RELATE'; mute?: boolean }
  | { type: 'RESET' }
  | { type: 'LOAD'; state: ValleyState };

function reducer(state: ValleyState, action: Action): ValleyState {
  switch (action.type) {
    case 'LOAD':
      return action.state;
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message], mirrorInvite: null };
    case 'SET_OFFER':
      return { ...state, offer: action.offer };
    case 'DECLINE_OFFER':
      return {
        ...state,
        lastDeclinedText: state.offer?.text,
        offer: null,
      };
    case 'CLEAR_OFFER':
      return { ...state, offer: null };
    case 'ADD_ECHO': {
      const wasFive = state.echoes.length === 4;
      return {
        ...state,
        echoes: [action.echo, ...state.echoes],
        offer: null,
        mirrorInvite: null,
        tagFilter: 'all',
        rippleSeed: state.rippleSeed + 1,
        fiveEchoSeed: wasFive ? state.fiveEchoSeed + 1 : state.fiveEchoSeed,
      };
    }
    case 'ARCHIVE_ECHO':
      return {
        ...state,
        echoes: state.echoes.map((echo) =>
          echo.id === action.id ? { ...echo, archived: action.archived } : echo,
        ),
        tagFilter: 'all',
        // 被收进归档的那条不再参与提示。
        relateHint:
          state.relateHint &&
          action.archived &&
          (state.relateHint.newId === action.id || state.relateHint.oldId === action.id)
            ? null
            : state.relateHint,
      };
    case 'TOGGLE_PIN': {
      // 置顶上限 3 条由调用方提示；这里只做状态翻转，避免"自动替用户取消别的置顶"。
      const target = state.echoes.find((echo) => echo.id === action.id);
      if (!target) return state;
      if (action.pinned) {
        const already = state.echoes.filter((echo) => echo.pinned && !echo.archived).length;
        if (already >= 3) return state;
      }
      return {
        ...state,
        echoes: state.echoes.map((echo) =>
          echo.id === action.id ? { ...echo, pinned: action.pinned } : echo,
        ),
      };
    }
    case 'DELETE_ECHO':
      return {
        ...state,
        echoes: state.echoes.filter((echo) => echo.id !== action.id),
        // 提示指向的回音被消散了，提示也跟着收起。
        relateHint:
          state.relateHint &&
          (state.relateHint.newId === action.id || state.relateHint.oldId === action.id)
            ? null
            : state.relateHint,
      };
    case 'CLEAR_ECHOES':
      return { ...state, echoes: [], tagFilter: 'all', offer: null, relateHint: null };
    case 'UPDATE_ECHO':
      return {
        ...state,
        echoes: state.echoes.map((echo) =>
          echo.id === action.id ? { ...echo, ...action.patch } : echo,
        ),
      };
    case 'ADD_STONE':
      return { ...state, stones: [action.stone, ...state.stones] };
    case 'UPDATE_STONE':
      return {
        ...state,
        stones: state.stones.map((stone) =>
          stone.id === action.id ? { ...stone, ...action.patch } : stone,
        ),
      };
    case 'REMOVE_STONE':
      return { ...state, stones: state.stones.filter((stone) => stone.id !== action.id) };
    case 'REORDER_STONE': {
      const from = state.stones.findIndex((stone) => stone.id === action.id);
      const to = state.stones.findIndex((stone) => stone.id === action.targetId);
      if (from < 0 || to < 0 || from === to) return state;
      const stones = [...state.stones];
      const [moved] = stones.splice(from, 1);
      stones.splice(to, 0, moved);
      return {
        ...state,
        stones: stones.map((stone, index) => ({ ...stone, order: stones.length - index })),
      };
    }
    case 'SET_MIRROR_INVITE':
      return { ...state, mirrorInvite: action.invite };
    case 'SET_MIRROR_STAGE':
      return { ...state, mirrorStage: action.stage, mirrorInvite: null };
    case 'SET_RECALL_WAIT':
      return { ...state, recallWait: action.value };
    case 'BUMP_HEAVY':
      return { ...state, heavyTurns: state.heavyTurns + 1 };
    case 'SET_PLAN':
      return { ...state, plan: action.plan };
    case 'UPDATE_PLAN_ITEM': {
      if (!state.plan) return state;
      const nextPlan: Plan = {
        ...state.plan,
        items: state.plan.items.map((item) =>
          item.plan_id === action.id ? { ...item, ...action.patch } : item,
        ),
      };
      const touchesSummary =
        'arrangement' in action.patch ||
        'start_date' in action.patch ||
        'end_date' in action.patch ||
        'pocket' in action.patch;
      return { ...state, plan: touchesSummary ? syncSummaries(nextPlan) : nextPlan };
    }
    case 'SET_RELATE_HINT':
      // 同一对只提示一次；用户静默过就不再提示。
      if (state.relateMuted) return state;
      return {
        ...state,
        relateHint: { newId: action.newId, oldId: action.oldId },
        relatedPairs: [...state.relatedPairs, `${action.newId}|${action.oldId}`],
      };
    case 'DISMISS_RELATE':
      return {
        ...state,
        relateHint: null,
        relateMuted: action.mute ? true : state.relateMuted,
      };
    case 'SET_SEASON':
      return { ...state, season: action.season };
    case 'SET_REDUCED':
      return { ...state, reducedMotion: action.value };
    case 'SET_TAG_FILTER':
      return { ...state, tagFilter: action.value };
    case 'TOAST':
      return { ...state, toasts: [...state.toasts.slice(-2), action.toast] };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) };
    case 'SET_RIPPLE':
      return { ...state, rippleSeed: action.seed };
    case 'SET_FIVE_ECHO':
      return { ...state, fiveEchoSeed: action.seed };
    case 'RESET':
      return {
        ...initialState(),
        season: state.season,
        reducedMotion: state.reducedMotion,
        toasts: [
          {
            id: Date.now(),
            text: '山谷空下来了。',
          },
        ],
      };
    default:
      return state;
  }
}

function loadState(): ValleyState {
  const base = initialState();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<ValleyState> & { version?: number };
    if (parsed.version && parsed.version !== 1) return base;
    const messages = Array.isArray(parsed.messages) && parsed.messages.length ? parsed.messages : base.messages;
    const stones = Array.isArray(parsed.stones) ? parsed.stones : base.stones;
    return {
      ...base,
      ...parsed,
      messages,
      stones,
      toasts: [],
      offer: parsed.offer ?? null,
      mirrorStage: parsed.mirrorStage ?? 'idle',
      tagFilter: 'all',
      // 提示是当下那一刻的邀请，刷新后不再弹出；静默意愿与提示过的对照保留。
      relateHint: null,
      relateMuted: parsed.relateMuted ?? false,
      relatedPairs: Array.isArray(parsed.relatedPairs) ? parsed.relatedPairs : [],
    };
  } catch {
    return base;
  }
}

interface ValleyContextValue {
  state: ValleyState;
  dispatch: Dispatch<Action>;
}

const ValleyContext = createContext<ValleyContextValue | null>(null);

export function ValleyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      const { toasts, ...rest } = state;
      void toasts;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, version: 1 }));
    } catch {
      // 本次会话仍可继续，只是刷新后不一定保留。
    }
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduced = state.reducedMotion ? 'true' : 'false';
  }, [state.reducedMotion]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <ValleyContext.Provider value={value}>{children}</ValleyContext.Provider>;
}

export function useValley(): ValleyContextValue {
  const value = useContext(ValleyContext);
  if (!value) throw new Error('useValley must be used inside ValleyProvider');
  return value;
}

export type { Action as ValleyAction, WeatherKind };
