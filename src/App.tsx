import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY, CSV_USAGE_TXT, FOOTER_SHORT } from './copy';
import { respond } from './agent/engine';
import { findRelated } from './agent/relate';
import { generateWithLlm, llmConfigured } from './agent/llm';
import { demoEchoes, demoPlan } from './data/demo';
import { syncSummaries } from './plan/edit';
import { buildCsv } from './export/csv';
import { buildExcel } from './export/excel';
import { downloadBlob, downloadText } from './export/download';
import { downloadEchoCard } from './export/excerpt';
import { buildPlanText } from './export/textPlan';
import { useValley } from './store';
import type { Echo, EchoOffer, MirrorStage, Plan, PlanItem, Stone, WeatherKind } from './types';
import { fileStamp, uid } from './utils/date';
import { echoTimeLabel } from './utils/date';
import { ackNotice, applyBackup, buildBackup, hasAckedNotice, hasSeenTour, markTourSeen, parseBackup } from './persist';
import { DRAFT_PREFIX, type ExerciseDef } from './exercises';
import { CalmPanel } from './components/CalmPanel';
import { CompareView } from './components/CompareView';
import { EchoModal } from './components/EchoModal';
import type { EchoDraft } from './components/EchoComposer';
import { ExerciseModal } from './components/ExerciseModal';
import { FirstRunNotice } from './components/FirstRunNotice';
import { TourGuide, type TourStep } from './components/TourGuide';
import { SafetyModal } from './components/SafetyModal';
import { SettingsModal } from './components/SettingsModal';
import type { EchoSection } from './components/EchoList';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { PickStoneModal } from './components/PickStoneModal';
import { PathPanel } from './components/PathPanel';
import { PlanWizard } from './components/PlanWizard';
import { PrintSheets } from './components/PrintSheets';
import { Sky } from './components/Sky';
import { Toasts } from './components/Toasts';
import { ValleyPanel } from './components/ValleyPanel';
import type { QuietMode } from './components/QuietCompanion';
import { Ambience } from './components/Ambience';
import { FALLBACKS } from './data/fallbacks';
import { detectFallback } from './data/fallbacks';
import { useIdle } from './utils/useIdle';
import { setUserReduced } from './motion/gate';
import Shredder from './motion/Shredder.jsx';

type ConfirmState =
  | { kind: 'delete'; echo: Echo }
  | { kind: 'stone-flow'; stone: Stone }
  | { kind: 'clear' }
  | { kind: 'reset' }
  | null;

type ExportFormat = 'csv' | 'excel' | 'print';

export default function App() {
  const { state, dispatch, mode, switchMode, reload, wipe } = useValley();
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fiveRef = useRef(state.fiveEchoSeed);
  const seededRef = useRef(false);

  const [tab, setTab] = useState<'talk' | 'echoes'>('talk');
  const [echoView, setEchoView] = useState<'active' | 'archive'>('active');
  const [echoSection, setEchoSection] = useState<EchoSection>('echoes');
  const [mobileView, setMobileView] = useState<'valley' | 'path' | 'calm'>('valley');
  /** 练习弹窗、设置页、安全页、练习带过来的回音草稿。 */
  const [exercise, setExercise] = useState<ExerciseDef | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [echoDraft, setEchoDraft] = useState<EchoDraft | null>(null);
  const [firstRunOpen, setFirstRunOpen] = useState(() => !hasAckedNotice());
  /** 新手引导：见过就不再自动弹。 */
  const [tourOpen, setTourOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [echoOpenId, setEchoOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  /** 消散动画：先确认，播完再真正删库。 */
  const [shred, setShred] = useState<{ id: string; text: string; meta: string; run: () => void } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [quietPanelOpen, setQuietPanelOpen] = useState(false);
  const [quietMode, setQuietMode] = useState<QuietMode>('off');
  const [exportError, setExportError] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  /** 「听一听」带回的旧回音，只展示原话与时间。 */
  const [relateEcho, setRelateEcho] = useState<Echo | null>(null);
  const [lastFormat, setLastFormat] = useState<ExportFormat>('csv');
  const [ripple, setRipple] = useState<{ text: string; key: number } | null>(null);
  const [fiveShow, setFiveShow] = useState(false);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [foxDragging, setFoxDragging] = useState(false);
  const [foxWag, setFoxWag] = useState(0);
  // 溪边的石子
  const [pickStoneOpen, setPickStoneOpen] = useState(false);
  const [pickPreset, setPickPreset] = useState<{ text: string; source: string }>({
    text: '',
    source: '',
  });
  const [justPickedId, setJustPickedId] = useState<string | null>(null);
  const [stoneDraft, setStoneDraft] = useState<{ text: string; key: number } | null>(null);
  const [weatherKind, setWeatherKind] = useState<WeatherKind | null>(
    () => [...state.messages].reverse().find((message) => message.weather)?.weather?.kind ?? null,
  );
  const skyIdle = useIdle(20000);

  const rippleTimer = useRef<number | null>(null);
  const justSavedTimer = useRef<number | null>(null);
  /** 关联提示的延时与自动收起计时器。 */
  const relateTimer = useRef<number | null>(null);
  const relateHideTimer = useRef<number | null>(null);
  /** 最近一次触发危机或边界兜底的时间；高敏感时刻不翻旧回音。 */
  const lastCrisisAt = useRef(0);
  /** 静默态标记，供提示判定读取，避免闭包拿到旧值。 */
  const quietModeRef = useRef<QuietMode>('off');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setUserReduced(state.reducedMotion);
  }, [state.reducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.reduced = state.reducedMotion ? 'true' : 'false';
  }, [state.reducedMotion]);

  useEffect(() => {
    // 弹窗 / 浮层通过 portal 挂在 body 下，季节变量要同步到 body 才能让雾层跟着变色。
    document.body.dataset.season = state.season;
  }, [state.season]);

  useEffect(() => {
    if (seededRef.current) return;
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
    // 先等存储层读完：否则首帧的空状态会先盖掉已有的珍藏。
    if (!state.hydrated) return;
    if (state.echoes.length > 0 || state.plan) return;
    seededRef.current = true;
    demoEchoes().forEach((echo) => dispatch({ type: 'ADD_ECHO', echo }));
    dispatch({ type: 'SET_PLAN', plan: demoPlan() });
  }, [dispatch, state.echoes.length, state.plan, state.hydrated]);

  useEffect(() => {
    if (state.fiveEchoSeed > fiveRef.current) {
      fiveRef.current = state.fiveEchoSeed;
      setFiveShow(true);
      const timer = window.setTimeout(() => setFiveShow(false), 4600);
      return () => window.clearTimeout(timer);
    }
  }, [state.fiveEchoSeed]);

  useEffect(
    () => () => {
      if (rippleTimer.current) window.clearTimeout(rippleTimer.current);
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
      if (relateTimer.current) window.clearTimeout(relateTimer.current);
      if (relateHideTimer.current) window.clearTimeout(relateHideTimer.current);
    },
    [],
  );

  // 静默态写进 ref，让关联判定随时读到当下的值。
  useEffect(() => {
    quietModeRef.current = quietMode;
  }, [quietMode]);

  const notify = useCallback(
    (text: string, hint?: string) => {
      dispatch({ type: 'TOAST', toast: { id: Date.now() + Math.random(), text, hint } });
    },
    [dispatch],
  );

  /**
   * 存入一条回音后，看看山谷里有没有一段离得不远的旧回音。
   * 六项条件全满足才提示；判定全在本地，不调用模型，也不解释关联。
   */
  const maybeRelate = useCallback(
    (echo: Echo) => {
      if (relateTimer.current) window.clearTimeout(relateTimer.current);
      // 镜像回音是写给自己的话，不参与配对。
      if (echo.mirror) return;
      // 让存入的涟漪先播完，再轻声说这一句。
      relateTimer.current = window.setTimeout(() => {
        const current = stateRef.current;
        if (current.relateMuted) return;
        // 高敏感时刻不翻旧回音：刚触发过危机或边界兜底、正处在静默态、刚说过想停。
        if (Date.now() - lastCrisisAt.current < 5 * 60 * 1000) return;
        if (quietModeRef.current !== 'off') return;

        const related = findRelated(echo, current.echoes);
        if (!related) return;
        const pair = `${echo.id}|${related.id}`;
        if (current.relatedPairs.includes(pair)) return;

        dispatch({ type: 'SET_RELATE_HINT', newId: echo.id, oldId: related.id });
        // 没有动作就自己收起来，不停在那里等回答。
        if (relateHideTimer.current) window.clearTimeout(relateHideTimer.current);
        relateHideTimer.current = window.setTimeout(() => {
          dispatch({ type: 'DISMISS_RELATE' });
        }, 8000);
      }, 2000);
    },
    [dispatch],
  );

  /** 从任意入口（对话确认 / 节点独白）保存一条回音；只存原话与时间。 */
  const saveEchoText = useCallback(
    (text: string, mirror = false) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const activeCount = stateRef.current.echoes.filter((echo) => !echo.archived).length;
      if (activeCount >= 10) {
        notify(COPY.toasts.echoFull);
        return false;
      }
      const echo: Echo = {
        id: uid('echo'),
        text: trimmed,
        createdAt: Date.now(),
        mirror,
      };
      dispatch({ type: 'ADD_ECHO', echo });
      notify(COPY.toasts.saved);
      setJustSavedId(echo.id);
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
      justSavedTimer.current = window.setTimeout(() => setJustSavedId(null), 3600);
      if (rippleTimer.current) window.clearTimeout(rippleTimer.current);
      setRipple({ text: trimmed, key: Date.now() });
      rippleTimer.current = window.setTimeout(() => setRipple(null), 3000);
      maybeRelate(echo);
      return true;
    },
    [dispatch, notify, maybeRelate],
  );

  const focusComposer = useCallback(() => {
    window.setTimeout(() => composerRef.current?.focus(), 120);
  }, []);

  /** 练习 → 回音草稿：只把一句话填进回音谷，绝不自动保存。 */
  const draftFromExercise = useCallback(
    (name: string) => {
      setExercise(null);
      setMobileView('valley');
      setTab('echoes');
      setEchoSection('echoes');
      setEchoView('active');
      setEchoDraft({ text: DRAFT_PREFIX(name), nonce: Date.now(), source: name });
      notify('草稿放进回音谷了，确认之后才会存下来。');
    },
    [notify],
  );

  const saveEchoDraft = useCallback(
    (text: string) => {
      const ok = saveEchoText(text);
      if (ok) setEchoDraft(null);
      return ok;
    },
    [saveEchoText],
  );

  const discardEchoDraft = useCallback(() => {
    setEchoDraft(null);
  }, []);

  /** 首次启动的两个选项：确认进珍藏，或本次只用会话。 */
  const chooseFirstRun = useCallback(
    (choice: 'local' | 'session') => {
      if (choice === 'local') {
        ackNotice();
        if (mode !== 'local') switchMode('local');
      } else {
        // 本次不落库；下次打开会再问一次。
        switchMode('session');
      }
      setFirstRunOpen(false);
    },
    [mode, switchMode],
  );

  const exportBackup = useCallback(async () => {
    const backup = await buildBackup();
    downloadText(`回音谷_本地珍藏_${fileStamp()}.json`, JSON.stringify(backup, null, 2));
  }, []);

  const importBackup = useCallback(
    async (file: File) => {
      const raw = await file.text();
      const parsed = parseBackup(raw);
      await applyBackup(parsed);
      await reload();
      return mode === 'local'
        ? `已经恢复了 ${parsed.echoes.length} 条回音${parsed.plan ? '和这一份小路计划' : ''}。`
        : '已经恢复到本地珍藏。现在是会话模式，切回珍藏就能看见。';
    },
    [mode, reload],
  );

  const wipeEverything = useCallback(async () => {
    await wipe();
    setEchoDraft(null);
    notify('山谷空下来了。');
  }, [notify, wipe]);

  /** 「听一听」：只带回旧回音的原话与时间，再问一句，不做分析也不做对比。 */
  const relateListen = useCallback(
    (hint: { newId: string; oldId: string }) => {
      if (relateHideTimer.current) window.clearTimeout(relateHideTimer.current);
      const old = stateRef.current.echoes.find((echo) => echo.id === hint.oldId);
      dispatch({ type: 'DISMISS_RELATE' });
      if (old) setRelateEcho(old);
    },
    [dispatch],
  );

  /** 「先不用」：收起提示，本会话不再提示任何关联。 */
  const relateSkip = useCallback(() => {
    if (relateHideTimer.current) window.clearTimeout(relateHideTimer.current);
    dispatch({ type: 'DISMISS_RELATE', mute: true });
  }, [dispatch]);

  /** 「写一句给自己」：把用户自己的话交给既有确认流程，绝不自动存、绝不把摘句当原话。 */
  const quietWriteSelf = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setQuietMode('off');
      setQuietPanelOpen(false);
      dispatch({
        type: 'SET_OFFER',
        offer: {
          id: uid('offer'),
          text: trimmed,
          at: Date.now(),
          silent: true,
          sourceMessageId: `quiet-${uid('msg')}`,
        },
      });
    },
    [dispatch],
  );

  /** 方式 B：联动音乐库切到山谷舒缓第一首并展开面板；播放仍需用户再点一次。 */
  const quietListen = useCallback(() => {
    window.dispatchEvent(new CustomEvent('echo-valley:music', { detail: { group: 'calm' } }));
  }, []);

  /** 危机表述：立即退出静默态、不追问，原样输出第 3 条固定话术。 */
  const quietCrisis = useCallback(
    (text: string) => {
      setQuietMode('off');
      setQuietPanelOpen(false);
      // 记一下时刻：这之后的一段时间里不翻旧回音。
      lastCrisisAt.current = Date.now();
      dispatch({ type: 'DISMISS_RELATE' });
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: uid('msg'),
          role: 'user',
          text,
          time: Date.now(),
        },
      });
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: uid('msg'),
          role: 'assistant',
          text: FALLBACKS.crisis,
          time: Date.now(),
        },
      });
    },
    [dispatch],
  );

  /** 捡起一颗石子：别人的话只进溪滩，不进回音、不进小路。 */
  const pickStone = useCallback(
    (draft: Omit<Stone, 'id' | 'saved_at'>) => {
      const stone: Stone = { ...draft, id: uid('stone'), saved_at: Date.now() };
      dispatch({ type: 'ADD_STONE', stone });
      setPickStoneOpen(false);
      setPickPreset({ text: '', source: '' });
      setEchoSection('stones');
      setTab('echoes');
      setJustPickedId(stone.id);
      window.setTimeout(() => setJustPickedId((current) => (current === stone.id ? null : current)), 1400);
      notify(COPY.stone.saved);
    },
    [dispatch, notify],
  );

  /** 打开捡石子弹窗；可从对话/候选带一句预填过来。 */
  const openPickStone = useCallback((text = '', source = '') => {
    setPickPreset({ text, source });
    setPickStoneOpen(true);
  }, []);

  /** 放进水里：石子原文绝不进回音，只存用户自己写的那段，带极淡来源标记。 */
  const stoneIntoWater = useCallback(
    (stone: Stone, written: string) => {
      const value = written.trim();
      if (!value) return;
      const hit = detectFallback(value);
      if (hit?.level === 'crisis') {
        lastCrisisAt.current = Date.now();
        dispatch({ type: 'DISMISS_RELATE' });
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: uid('msg'), role: 'user', text: value, time: Date.now() },
        });
        dispatch({
          type: 'ADD_MESSAGE',
          message: { id: uid('msg'), role: 'assistant', text: FALLBACKS.crisis, time: Date.now() },
        });
        return;
      }
      const trimmed = value.slice(0, 120);
      const activeCount = stateRef.current.echoes.filter((echo) => !echo.archived).length;
      if (activeCount >= 10) {
        notify(COPY.toasts.echoFull);
        return;
      }
      const echo: Echo = {
        id: uid('echo'),
        text: trimmed,
        createdAt: Date.now(),
        fromStone: true,
      };
      dispatch({ type: 'ADD_ECHO', echo });
      setJustSavedId(echo.id);
      if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
      justSavedTimer.current = window.setTimeout(() => setJustSavedId(null), 3600);
      if (rippleTimer.current) window.clearTimeout(rippleTimer.current);
      setRipple({ text: trimmed, key: Date.now() });
      rippleTimer.current = window.setTimeout(() => setRipple(null), 3000);
      notify(COPY.stone.intoWaterDone, COPY.stone.fromStoneMark);
      maybeRelate(echo);
      // 石子仍留在溪滩，只是波纹痕淡一下——用 justPickedId 复用柔光提示。
      setJustPickedId(stone.id);
      window.setTimeout(() => setJustPickedId((current) => (current === stone.id ? null : current)), 1200);
    },
    [dispatch, notify, maybeRelate],
  );

  /** 垫到路上：把石子文字送进小路编辑卡，由用户自己定日期与时长；无计划先建路。 */
  const stoneToPath = useCallback(
    (stone: Stone) => {
      if (!stateRef.current.plan) {
        notify('先有一点点路，才垫得上去。一起把路标出来吧。');
        setPlanOpen(true);
        return;
      }
      setStoneDraft({ text: stone.text, key: Date.now() + Math.random() });
      setMobileView('path');
    },
    [notify],
  );

  const requestReply = useCallback(
    (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setTyping(true);
      const current = stateRef.current;
      const assistantTurns = current.messages.filter((message) => message.role === 'assistant').length;
      const lastAssistant = [...current.messages].reverse().find((message) => message.role === 'assistant');
      window.setTimeout(async () => {
        try {
          const output = respond({
            text,
            assistantTurns,
            heavyTurns: current.heavyTurns,
            lastWeather: lastAssistant?.weather?.kind,
            mirrorStage: current.mirrorStage as MirrorStage,
            recallWait: current.recallWait,
            echoes: current.echoes.filter((echo) => !echo.archived),
            lastDeclinedText: current.lastDeclinedText,
          });

          if (output.weather) setWeatherKind(output.weather);

          // 危机、固定边界话术、用户说想停：这之后的一段时间不翻旧回音。
          if (output.crisis || output.stop) {
            lastCrisisAt.current = Date.now();
            dispatch({ type: 'DISMISS_RELATE' });
          }

          let reply = output.reply;
          const activeEchoes = current.echoes.filter((echo) => !echo.archived).length;
          if (llmConfigured() && output.allowLlm && activeEchoes < 10) {
            const generated = await generateWithLlm(current.messages, text);
            if (generated) reply = generated;
          }

          const message = {
            id: uid('msg'),
            role: 'assistant' as const,
            text: reply,
            time: Date.now(),
            weather: output.weather
              ? { kind: output.weather, text: COPY.weather[output.weather] }
              : undefined,
          };
          dispatch({ type: 'ADD_MESSAGE', message });
          if (output.offer) {
            const offer: EchoOffer = {
              id: uid('offer'),
              text: output.offer.text,
              at: output.offer.at,
              mirror: current.mirrorStage === 'writing' || undefined,
              sourceMessageId: message.id,
            };
            dispatch({ type: 'SET_OFFER', offer });
          }
          if (output.mirrorStage) {
            dispatch({ type: 'SET_MIRROR_STAGE', stage: output.mirrorStage });
          }
          if (output.mirrorInvite) {
            dispatch({
              type: 'SET_MIRROR_INVITE',
              invite: { id: uid('mirror'), sourceMessageId: message.id },
            });
          }
          if (output.recallWait !== undefined) {
            dispatch({ type: 'SET_RECALL_WAIT', value: output.recallWait });
          }
          if (output.openPlanner) {
            setPlanOpen(true);
          }
        } catch {
          notify(COPY.toasts.network);
        } finally {
          busyRef.current = false;
          setTyping(false);
        }
      }, 720);
    },
    [dispatch, notify],
  );

  const send = useCallback(
    (raw: string, silent: boolean) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      const message = {
        id: uid('msg'),
        role: 'user' as const,
        text,
        time: Date.now(),
        quiet: silent || undefined,
      };
      dispatch({ type: 'ADD_MESSAGE', message });
      if (/学不进|不想学|累|焦虑|难受|害怕|崩|内耗|撑|一个人|没力气|失眠/.test(text)) {
        dispatch({ type: 'BUMP_HEAVY' });
      }

      if (silent) {
        dispatch({
          type: 'SET_OFFER',
          offer: {
            id: uid('offer'),
            text,
            at: Date.now(),
            silent: true,
            sourceMessageId: message.id,
          },
        });
        return;
      }

      setMobileView('valley');
      requestReply(text);
    },
    [dispatch, requestReply],
  );

  const acceptOffer = useCallback(() => {
    const offer = stateRef.current.offer;
    if (!offer) return;
    saveEchoText(offer.text, offer.mirror);
  }, [saveEchoText]);

  const declineOffer = useCallback(() => {
    dispatch({ type: 'DECLINE_OFFER' });
  }, [dispatch]);

  const silentKeep = useCallback(() => {
    dispatch({ type: 'CLEAR_OFFER' });
  }, [dispatch]);

  const requestReplyForOffer = useCallback(() => {
    const offer = stateRef.current.offer;
    if (!offer) return;
    dispatch({ type: 'CLEAR_OFFER' });
    requestReply(offer.text);
  }, [dispatch, requestReply]);

  const acceptMirror = useCallback(() => {
    dispatch({ type: 'SET_MIRROR_STAGE', stage: 'writing' });
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: uid('msg'),
        role: 'assistant',
        text: '那就慢慢写。不用写得完整，一句就够。写完之后存不存，都由你决定。',
        time: Date.now(),
      },
    });
    focusComposer();
  }, [dispatch, focusComposer]);

  const declineMirror = useCallback(() => {
    dispatch({ type: 'SET_MIRROR_STAGE', stage: 'idle' });
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: uid('msg'),
        role: 'assistant',
        text: '好，那就先不换位置。想继续说，我在这里。',
        time: Date.now(),
      },
    });
  }, [dispatch]);

  const exitMirror = useCallback(() => {
    dispatch({ type: 'SET_MIRROR_STAGE', stage: 'done' });
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: uid('msg'),
        role: 'assistant',
        text: '好，那就不写。愿意停在这里，已经够了。想说点别的，或者先歇一会儿，都可以。',
        time: Date.now(),
      },
    });
  }, [dispatch]);

  const archiveEcho = useCallback(
    (echo: Echo, archived: boolean) => {
      dispatch({ type: 'ARCHIVE_ECHO', id: echo.id, archived });
      notify(archived ? COPY.toasts.archived : COPY.toasts.unarchived);
      setEchoOpenId(null);
    },
    [dispatch, notify],
  );

  const updateEcho = useCallback(
    (id: string, patch: Partial<Echo>) => {
      dispatch({ type: 'UPDATE_ECHO', id, patch });
    },
    [dispatch],
  );

  const pinnedEchoCount = state.echoes.filter((echo) => echo.pinned && !echo.archived).length;

  const togglePin = useCallback(
    (echo: Echo) => {
      const next = !echo.pinned;
      if (next && pinnedEchoCount >= 3) {
        notify(COPY.pinLimit);
        return;
      }
      dispatch({ type: 'TOGGLE_PIN', id: echo.id, pinned: next });
      notify(next ? COPY.pinHint : COPY.unpin);
    },
    [dispatch, notify, pinnedEchoCount],
  );

  const takeCard = useCallback(
    async (echo: Echo) => {
      try {
        await downloadEchoCard(echo);
        notify(COPY.toasts.cardSaved);
      } catch {
        notify(COPY.toasts.network);
      }
    },
    [notify],
  );

  const openPlanner = useCallback(() => {
    setPlanOpen(true);
    setMobileView('path');
  }, []);

  const handlePlan = useCallback(
    (plan: Plan) => {
      dispatch({ type: 'SET_PLAN', plan });
    },
    [dispatch],
  );

  const handleUpdatePlan = useCallback(
    (plan: Plan) => {
      dispatch({ type: 'SET_PLAN', plan: syncSummaries(plan) });
    },
    [dispatch],
  );

  const updatePlanItem = useCallback(
    (id: string, patch: Partial<PlanItem>) => {
      dispatch({ type: 'UPDATE_PLAN_ITEM', id, patch });
    },
    [dispatch],
  );

  const talkAbout = useCallback(
    (item: PlanItem) => {
      setTab('talk');
      setMobileView('valley');
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: uid('msg'),
          role: 'assistant',
          text: `这是「${item.direction}」这个节点。想从哪里说起，都可以。`,
          time: Date.now(),
        },
      });
      focusComposer();
    },
    [dispatch, focusComposer],
  );

  const doCsv = useCallback(() => {
    const plan = stateRef.current.plan;
    if (!plan) {
      notify(COPY.emptyExport);
      return;
    }
    try {
      const csv = buildCsv(plan);
      const stamp = fileStamp();
      downloadText(`回音谷_山间小路_${stamp}.csv`, csv, true);
      window.setTimeout(() => downloadText('使用说明.txt', CSV_USAGE_TXT, true), 420);
      notify(COPY.toasts.downloaded, COPY.toasts.downloadHint);
      setFoxWag((value) => value + 1);
      setExportOpen(false);
      setExportError(0);
    } catch (error) {
      console.error('[export]', { format: 'csv', code: 'UNKNOWN', retry: exportError });
      void error;
      setExportError((value) => Math.min(2, value + 1));
    }
  }, [exportError, notify]);

  const doExcel = useCallback(async () => {
    const plan = stateRef.current.plan;
    if (!plan || exportBusy) return;
    setExportBusy(true);
    try {
      const blob = await buildExcel(plan);
      downloadBlob(`回音谷_山间小路_${fileStamp()}.xlsx`, blob);
      notify(COPY.toasts.downloaded, COPY.toasts.downloadHint);
      setFoxWag((value) => value + 1);
      setExportOpen(false);
      setExportError(0);
    } catch (error) {
      console.error('[export]', { format: 'excel', code: 'UNKNOWN', retry: exportError });
      void error;
      setExportError((value) => Math.min(2, value + 1));
    } finally {
      setExportBusy(false);
    }
  }, [exportBusy, exportError, notify]);

  const doPrint = useCallback(() => {
    if (!stateRef.current.plan) return;
    setExportOpen(false);
    setFoxWag((value) => value + 1);
    window.setTimeout(() => window.print(), 90);
  }, []);

  const startExport = useCallback(
    (format: ExportFormat) => {
      setLastFormat(format);
      if (format === 'csv') doCsv();
      if (format === 'excel') void doExcel();
      if (format === 'print') doPrint();
    },
    [doCsv, doExcel, doPrint],
  );

  const retryExport = useCallback(() => {
    setExportError(0);
    startExport(lastFormat);
  }, [lastFormat, startExport]);

  const copyPlanText = useCallback(async () => {
    const plan = stateRef.current.plan;
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(buildPlanText(plan));
      notify(COPY.toasts.copied);
    } catch {
      notify(COPY.toasts.network);
    }
  }, [notify]);

  const addDemoEchoes = useCallback(() => {
    const active = stateRef.current.echoes.filter((echo) => !echo.archived).length;
    if (active + 2 > 10) {
      notify(COPY.toasts.echoFull);
      return;
    }
    demoEchoes().forEach((echo) => dispatch({ type: 'ADD_ECHO', echo }));
    notify('演示回音已经放进山谷。');
  }, [dispatch, notify]);

  const addDemoPlan = useCallback(() => {
    dispatch({ type: 'SET_PLAN', plan: demoPlan() });
    setRehearsalOpen(false);
    setMobileView('path');
    notify('演示计划已经放进小路。');
  }, [dispatch, notify]);

  /** 先把要被带走的内容交给 Shredder，动画结束再真正落库删除。 */
  const beginShred = useCallback((text: string, meta: string, run: () => void) => {
    setConfirm(null);
    setShred({ id: uid(), text: text.length > 260 ? `${text.slice(0, 260)}…` : text, meta, run });
  }, []);

  const doConfirm = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === 'delete') {
      const target = confirm.echo;
      beginShred(target.text, `${COPY.timePrefix} ${echoTimeLabel(target.createdAt)}`, () => {
        dispatch({ type: 'DELETE_ECHO', id: target.id });
        notify(COPY.toasts.letGo);
        if (echoOpenId === target.id) setEchoOpenId(null);
      });
      return;
    }
    if (confirm.kind === 'clear') {
      beginShred('全部回音，连同溪滩上那句话与归档里的旧声音', '清空后不可恢复，只能靠之前的备份', () => {
        dispatch({ type: 'CLEAR_ECHOES' });
        notify(COPY.toasts.cleared);
      });
      return;
    }
    if (confirm.kind === 'stone-flow') {
      const target = confirm.stone;
      beginShred(target.text, '让它顺水走，溪滩上不再留着', () => {
        dispatch({ type: 'REMOVE_STONE', id: target.id });
        notify(COPY.stone.flowed);
      });
      return;
    }
    if (confirm.kind === 'reset') {
      dispatch({ type: 'RESET' });
      setWeatherKind(null);
      setTab('talk');
      setEchoView('active');
      setPlanOpen(false);
      setEchoOpenId(null);
      setRehearsalOpen(false);
      setEchoSection('echoes');
      setStoneDraft(null);
      setJustPickedId(null);
    }
    setConfirm(null);
  }, [confirm, dispatch, echoOpenId, notify, beginShred]);

  const echoOpen = state.echoes.find((echo) => echo.id === echoOpenId) ?? null;
  const planText = state.plan ? buildPlanText(state.plan) : '';

  const confirmCopy =
    confirm?.kind === 'clear'
      ? { title: COPY.clearTitle, body: COPY.clearBody, ok: COPY.clearConfirm, cancel: COPY.clearCancel }
      : confirm?.kind === 'stone-flow'
        ? {
            title: COPY.stone.flowConfirmTitle,
            body: COPY.stone.flowConfirmBody,
            ok: COPY.stone.flowConfirmOk,
            cancel: COPY.stone.flowConfirmCancel,
          }
        : confirm?.kind === 'reset'
        ? {
            title: '要清空这次会话吗？',
            body: '这次会话里的回音与小路都会空下来，山谷会重新安静。',
            ok: '清空这次会话',
            cancel: '再留一会儿',
          }
        : { title: COPY.confirmTitle, body: COPY.confirmBody, ok: COPY.confirmOk, cancel: COPY.confirmCancel };

  /** 进「静一下心」：顺手把静默态和面板收掉，免得切走了还留着半透明的一层。 */
  const openCalm = () => {
    setQuietMode('off');
    setQuietPanelOpen(false);
    setMobileView('calm');
  };

  useEffect(() => {
    if (!state.hydrated) return;
    if (firstRunOpen) return;
    if (hasSeenTour()) return;
    const timer = window.setTimeout(() => setTourOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [state.hydrated, firstRunOpen]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    markTourSeen();
    setMobileView('valley');
    setTab('talk');
  }, []);

  const tourSteps: TourStep[] = [
    {
      id: 'welcome',
      title: '这是回音谷，先花一分钟认一下',
      body: '三个空间：回音谷（把话放下）、山间小路（把学习排进这一周）、静一下心（九个练习）。它不做心理咨询，也不解题，只陪着你。',
      hint: '引导只有这一次，跳过也没关系。',
      enter: () => {
        setMobileView('valley');
        setTab('talk');
      },
    },
    {
      id: 'entries',
      title: '三条入口，挑最轻的那一条',
      target: '.entry-nav',
      body: '「向山谷倾诉」是打字聊；「梳理山间行程」打开标路向导；「聆听回音」翻看以前留下来的句子。',
    },
    {
      id: 'composer',
      title: '想说话，就写在这里',
      target: '.composer',
      body: 'Enter 说给刘看山，Shift + Enter 换行。勾上「只想留一句话，不用回应」，它就只收下，不追问。',
      hint: '没想好也可以先空着，山谷不催。',
    },
    {
      id: 'quiet',
      title: '不想开口，也有别的入口',
      target: '.quiet-chip',
      body: '点「今天不想说话」：陪你坐一会儿、放一点山谷的声音，或者借一句别人的话。',
    },
    {
      id: 'path',
      title: '山间小路：把想推进的事排进这一周',
      target: '.path-panel .panel-head',
      enter: () => setMobileView('path'),
      body: '点右上「重新标一遍」走一遍向导：想去哪、大概多久、这周先动哪一件。排好的卡片可以直接拖到别的日子。',
    },
    {
      id: 'calm',
      title: '静一下心：九个练习，随手挑一个',
      target: '.calm-panel .calm-head',
      enter: () => setMobileView('calm'),
      body: '呼吸、身体扫描、舒尔特方格……每一个都写明时长和「做到哪里就可以停」，不满意随时退出。',
    },
    {
      id: 'echoes',
      title: '留下来的句子，都在这儿',
      target: '.echo-view .echo-toolbar',
      enter: () => {
        setMobileView('valley');
        setTab('echoes');
      },
      body: '可以搜索、置顶（最多三条）、归档，或者让某一条彻底消散。没点「确认存入山谷」的话，什么都不会留下。',
    },
    {
      id: 'settings',
      title: '最后，看一眼「设置」',
      target: '.quiet-tools',
      enter: () => {
        setMobileView('valley');
        setTab('talk');
      },
      body: '里面能换存储方式（本地珍藏 / 会话模式）、导出 JSON 备份、清空山谷，也能「再看一遍这个引导」。',
      hint: '内容只存在你这台电脑的浏览器里，不经过网络。',
    },
    {
      id: 'done',
      title: '从哪一步开始都行',
      body: '先去回音谷写一句，还是先去山间小路排一件事，都不影响。准备好了就开始。',
      enter: () => {
        setMobileView('valley');
        setTab('talk');
      },
    },
  ];

  return (
    <>
      <div
        className={`app season-${state.season} ${state.reducedMotion ? 'reduced' : ''}`}
        data-reduced={state.reducedMotion ? 'true' : 'false'}
      >
        <Sky idle={skyIdle} />
        <Ambience season={state.season} reduced={state.reducedMotion} />

        <Header
          season={state.season}
          onSeason={(season) => dispatch({ type: 'SET_SEASON', season })}
          reduced={state.reducedMotion}
          onReduced={(value) => dispatch({ type: 'SET_REDUCED', value })}
          onRehearsal={() => setRehearsalOpen(true)}
          onModelSettings={() => setModelSettingsOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onCalm={openCalm}
        />

        <main className={`split ${mobileView === 'calm' ? 'calm-mode' : `mobile-${mobileView}`}`}>
          <PathPanel
            plan={state.plan}
            onOpenWizard={openPlanner}
            onUpdateItem={updatePlanItem}
            onChangePlan={handleUpdatePlan}
            onExport={() => {
              setExportError(0);
              setExportOpen(true);
            }}
            onCompare={() => setCompareOpen(true)}
            onTalkAbout={talkAbout}
            onSaveNote={(text) => saveEchoText(text)}
            onDragState={setFoxDragging}
            onItemMoved={() => setFoxWag((value) => value + 1)}
            className={mobileView === 'path' ? 'mobile-active' : ''}
            stoneDraft={stoneDraft}
            onPickStone={(text) => openPickStone(text, state.plan?.goal ?? '知乎经验')}
          />
          <ValleyPanel
            ripple={ripple}
            tracking={foxDragging}
            dragWagKey={foxWag}
            weatherKind={weatherKind}
            tab={tab}
            onTab={setTab}
            onOpenPlan={openPlanner}
            season={state.season}
            messages={state.messages}
            echoes={state.echoes}
            offer={state.offer}
            mirrorInvite={state.mirrorInvite}
            mirrorStage={state.mirrorStage}
            typing={typing}
            onSend={send}
            onAcceptOffer={acceptOffer}
            onDeclineOffer={declineOffer}
            onRequestReply={requestReplyForOffer}
            onSilentKeep={silentKeep}
            onAcceptMirror={acceptMirror}
            onDeclineMirror={declineMirror}
            onExitMirror={exitMirror}
            echoView={echoView}
            onEchoView={setEchoView}
            tagFilter={state.tagFilter}
            onTagFilter={(value) => dispatch({ type: 'SET_TAG_FILTER', value })}
            onOpenEcho={(echo) => setEchoOpenId(echo.id)}
            onArchiveEcho={archiveEcho}
            onDeleteEcho={(echo) => setConfirm({ kind: 'delete', echo })}
            onClearEchoes={() => setConfirm({ kind: 'clear' })}
            quietPanelOpen={quietPanelOpen}
            onQuietPanelOpen={setQuietPanelOpen}
            quietMode={quietMode}
            onQuietMode={setQuietMode}
            onQuietWriteSelf={quietWriteSelf}
            onQuietListen={quietListen}
            onQuietCrisis={quietCrisis}
            reduced={state.reducedMotion}
            onTogglePin={togglePin}
            pinnedCount={pinnedEchoCount}
            justSavedId={justSavedId}
            composerRef={composerRef}
            className={mobileView === 'valley' ? 'mobile-active' : ''}
            echoSection={echoSection}
            onEchoSection={setEchoSection}
            stones={state.stones}
            justPickedId={justPickedId}
            onStoneIntoWater={stoneIntoWater}
            onStoneToPath={stoneToPath}
            onStoneLetFlow={(stone) => setConfirm({ kind: 'stone-flow', stone })}
            onStoneReorder={(id, targetId) => dispatch({ type: 'REORDER_STONE', id, targetId })}
            onStoneTags={(id, tags) => dispatch({ type: 'UPDATE_STONE', id, patch: { tags } })}
            relateHint={state.relateHint}
            onRelateListen={relateListen}
            onRelateSkip={relateSkip}
            onPickStone={() => openPickStone()}
            echoDraft={echoDraft}
            onEchoSave={saveEchoDraft}
            onEchoDiscard={discardEchoDraft}
            onQuietCalm={openCalm}
          />
          {mobileView === 'calm' ? (
            <CalmPanel
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenSafety={() => setSafetyOpen(true)}
              onStart={(item) => setExercise(item)}
              onBack={() => setMobileView('valley')}
            />
          ) : null}
        </main>

        <footer className="app-foot">
          <p>{COPY.footer}</p>
          <p className="app-foot-note">
            {mode === 'local' ? '本地珍藏已开启：内容存在本机，记得定期导出备份。' : '会话模式：关掉这一页，新写下的回音就散了。'}
          </p>
        </footer>

        <nav className="mobile-nav" aria-label="在山谷与小路的切换">
          <button
            type="button"
            className={mobileView === 'valley' ? 'is-on' : ''}
            aria-pressed={mobileView === 'valley'}
            onClick={() => setMobileView('valley')}
          >
            {COPY.valley}
          </button>
          <button
            type="button"
            className={mobileView === 'path' ? 'is-on' : ''}
            aria-pressed={mobileView === 'path'}
            onClick={() => setMobileView('path')}
          >
            {COPY.path}
          </button>
          <button
            type="button"
            className={mobileView === 'calm' ? 'is-on' : ''}
            aria-pressed={mobileView === 'calm'}
            onClick={openCalm}
          >
            静一下心
          </button>
        </nav>

        {fiveShow ? <p className="five-echo">{COPY.fiveEcho}</p> : null}
      </div>

      <PrintSheets plan={state.plan} />

      <ModelSettingsModal open={modelSettingsOpen} onClose={() => setModelSettingsOpen(false)} />

      <PlanWizard
        open={planOpen}
        plan={state.plan}
        onClose={() => setPlanOpen(false)}
        onPlan={handlePlan}
        onUpdatePlan={handleUpdatePlan}
      />

      <EchoModal
        echo={echoOpen}
        onClose={() => setEchoOpenId(null)}
        onArchive={archiveEcho}
        onDelete={(echo) => setConfirm({ kind: 'delete', echo })}
        onUpdate={updateEcho}
        onCard={(echo) => void takeCard(echo)}
      />

      <PickStoneModal
        open={pickStoneOpen}
        presetText={pickPreset.text}
        presetSource={pickPreset.source}
        onClose={() => setPickStoneOpen(false)}
        onPick={pickStone}
      />

      <Modal
        open={confirm !== null}
        title={confirmCopy.title}
        onClose={() => setConfirm(null)}
        label="confirm"
        footer={
          <>
            <button type="button" className="button ghost" onClick={() => setConfirm(null)}>
              {confirmCopy.cancel}
            </button>
            <button type="button" className="button primary" onClick={doConfirm}>
              {confirmCopy.ok}
            </button>
          </>
        }
      >
        <p className="dialog-text">{confirmCopy.body}</p>
      </Modal>

      <Modal
        open={exportOpen}
        title={COPY.exportDialogTitle}
        onClose={() => {
          setExportOpen(false);
          setExportError(0);
        }}
        label="export"
        footer={<p className="modal-foot-note">{FOOTER_SHORT}</p>}
      >
        {!state.plan ? (
          <>
            <p className="dialog-text">{COPY.emptyExport}</p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setExportOpen(false);
                  openPlanner();
                }}
              >
                {COPY.emptyExportTalk}
              </button>
              <button type="button" className="button ghost" onClick={() => setExportOpen(false)}>
                {COPY.emptyExportOk}
              </button>
            </div>
          </>
        ) : exportError > 0 ? (
          <>
            <p className="dialog-text">
              {exportError === 1 ? COPY.exportFail : COPY.exportFailAgain}
            </p>
            <div className="dialog-actions">
              <button type="button" className="button primary" onClick={retryExport}>
                {COPY.retry}
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setExportOpen(false);
                  setExportError(0);
                  setTextOpen(true);
                }}
              >
                {COPY.textFallback}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog-text">{COPY.exportDialogBody}</p>
            <div className="export-options">
              <button type="button" className="export-option" onClick={() => startExport('csv')}>
                <span className="export-name">{COPY.exportCsv}</span>
                <span className="export-desc">适合自己在表格软件里继续改，也可以做统计。</span>
              </button>
              <button
                type="button"
                className="export-option"
                onClick={() => startExport('excel')}
                disabled={exportBusy}
              >
                <span className="export-name">{COPY.exportExcel}</span>
                <span className="export-desc">
                  {exportBusy ? '正在把表格放好……' : '带格式的阅读版，打开就能看，也能直接打印。'}
                </span>
              </button>
              <button type="button" className="export-option" onClick={() => startExport('print')}>
                <span className="export-name">{COPY.exportPrint}</span>
                <span className="export-desc">A4 黑白，三页手写版；不想开电脑时用。</span>
              </button>
            </div>
            <p className="export-small">{COPY.printHint}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setExportOpen(false);
                setExportError(0);
                setTextOpen(true);
              }}
            >
              {COPY.textFallback}
            </button>
          </>
        )}
      </Modal>

      <Modal
        open={textOpen}
        title={COPY.textPlanTitle}
        onClose={() => setTextOpen(false)}
        label="text-plan"
        wide
        footer={
          <>
            <button type="button" className="button ghost" onClick={() => setTextOpen(false)}>
              {COPY.printMore3}
            </button>
            <button type="button" className="button primary" onClick={() => void copyPlanText()}>
              {COPY.textPlanCopy}
            </button>
          </>
        }
      >
        <pre className="plan-text">{planText}</pre>
      </Modal>

      <Modal
        open={compareOpen}
        title={COPY.compareTitle}
        onClose={() => setCompareOpen(false)}
        label="compare"
        wide
      >
        <CompareView plan={state.plan} echoes={state.echoes} />
      </Modal>

      {/* 「听一听」带回的旧回音：只有原话、时间和一句问话 */}
      <Modal
        open={Boolean(relateEcho)}
        title={COPY.actions.listen}
        onClose={() => setRelateEcho(null)}
        label="relate-echo"
        footer={
          <button type="button" className="button ghost" onClick={() => setRelateEcho(null)}>
            {COPY.relate.close}
          </button>
        }
      >
        {relateEcho ? (
          <div className="relate-recall">
            <blockquote>「{relateEcho.text}」</blockquote>
            <p className="relate-recall-time">{echoTimeLabel(relateEcho.createdAt)}</p>
            <p className="relate-recall-ask">{COPY.relate.after}</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={rehearsalOpen}
        title={COPY.rehearsalTitle}
        onClose={() => setRehearsalOpen(false)}
        label="rehearsal"
        footer={
          <button type="button" className="button ghost" onClick={() => setRehearsalOpen(false)}>
            {COPY.close}
          </button>
        }
      >
        <p className="dialog-text">{COPY.rehearsalNote}</p>
        <p className="license-note">
          {llmConfigured()
            ? '这次排练接着知乎直答说话。'
            : '这次排练由本地对话引擎接住，断网也能走完。'}
        </p>
        <p className="license-note">{COPY.licenseNote}</p>
        <div className="rehearsal-actions">
          <button type="button" className="button ghost" onClick={addDemoEchoes}>
            {COPY.rehearsalEchoes}
          </button>
          <button type="button" className="button ghost" onClick={addDemoPlan}>
            {COPY.rehearsalPlan}
          </button>
          <button type="button" className="button ghost" onClick={() => setWeatherKind('mist')}>
            让山谷起雾
          </button>
          <button
            type="button"
            className="text-button danger-quiet"
            onClick={() => setConfirm({ kind: 'reset' })}
          >
            {COPY.rehearsalClear}
          </button>
        </div>
      </Modal>

      <ExerciseModal exercise={exercise} onClose={() => setExercise(null)} onDraft={draftFromExercise} />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        onSwitchMode={(next) => switchMode(next)}
        onExport={exportBackup}
        onImport={importBackup}
        onWipe={() => {
          beginShred('全部回音，连同山间小路上的这一版计划', '清空后不可恢复', () => {
            void wipeEverything();
          });
          return Promise.resolve();
        }}
        onOpenSafety={() => {
          setSettingsOpen(false);
          setSafetyOpen(true);
        }}
        onReplayTour={() => setTourOpen(true)}
      />

      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} />

      <FirstRunNotice open={firstRunOpen} onChoose={chooseFirstRun} />

      <TourGuide open={tourOpen && !firstRunOpen} steps={tourSteps} onClose={closeTour} />

      {shred ? (
        <div className="shred-layer" role="presentation">
          <div className="shred-card">
            <Shredder
              key={shred.id}
              text={shred.text}
              meta={shred.meta}
              onDone={() => {
                shred.run();
                setShred(null);
              }}
            />
          </div>
          <p className="shred-note">正在让它慢慢散开，不用做别的。</p>
        </div>
      ) : null}

      <Toasts toasts={state.toasts} onDone={(id) => dispatch({ type: 'DISMISS_TOAST', id })} />
    </>
  );
}


