import type { Echo, MirrorStage, WeatherKind } from '../types';
import { COPY } from '../copy';
import { echoTimeLabel } from '../utils/date';
import {
  detectFallback,
  FALLBACKS,
  isReading,
  looksLikeEcho,
  looksLikeSelfAttack,
  wantsPlan,
  wantsRecall,
  wantsStop,
} from '../data/fallbacks';

export interface AgentInput {
  text: string;
  assistantTurns: number;
  heavyTurns: number;
  lastWeather?: WeatherKind;
  mirrorStage: MirrorStage;
  recallWait: boolean;
  echoes: Echo[];
  lastDeclinedText?: string;
}

export interface AgentOutput {
  reply: string;
  stop?: boolean;
  crisis?: boolean;
  offer?: { text: string; at: number } | null;
  mirrorInvite?: boolean;
  mirrorStage?: MirrorStage;
  recallWait?: boolean;
  weather?: WeatherKind;
  openPlanner?: boolean;
  allowLlm?: boolean;
}

type Intent =
  | 'studyStuck'
  | 'planBroken'
  | 'tired'
  | 'comparison'
  | 'family'
  | 'reading'
  | 'selfDoubt'
  | 'examPressure'
  | 'gratitude'
  | 'apology'
  | 'default';

const REPLY_BANK: Record<Intent, string[]> = {
  studyStuck: [
    '听起来，今天不是不想学，是心里那口气一直提不上来。先不用逼自己坐回去。要不要就这样躺十分钟，什么都不学，也算今天的一小段。',
    '坐了一晚却没效率，这种烦躁很磨人。它不代表你变差了，只说明今天已经装得有点满。现在更想继续撑一会儿，还是先让自己停下来？',
    '学不进去的时候，硬撑往往更累。可以不急着找方法。今天是从哪一刻开始，觉得心里慢慢发紧的？',
    '心气没了的时候，先把它当成一个信号，不是缺点。今天可以先不安排新的事。想说说是什么把它一点点耗掉的吗？',
  ],
  planBroken: [
    '打开计划看到一排没做到的，确实沉。先不急着复盘哪里没做到。今天哪怕只做了一件小事，也算在走。要不要只挑一件最小的，做十分钟就好？',
    '计划被打乱，不等于你也乱了。它更像是这段时间装得太满，需要挪一挪。要不要一起看看，哪一件可以先放到「改天再来」？',
    '那种「又没做到」的沉重，压久了会变成对自己的责怪。先把它放下一点。此刻你最想留下的是哪一件，其他的我们先不追。',
  ],
  tired: [
    '我听见了。身体先撑不住的时候，学习是排在后面的。这周睡觉比多刷一套题重要。要不要先去喝点水，或者躺一会儿？',
    '累到这种程度，不是你不够努力。是这段时间一直绷着。今天可以先不安排新的事，把休息当成默认项。',
    '听起来身体已经在提醒你了。先照顾它。今天想早点睡，还是先安静坐一会儿？',
  ],
  comparison: [
    '看到别人的进度，心里发紧，很正常。这不是你变差了，是备考这个环境让每个人都被迫互相看见。能把目光收回来一点点，就已经不容易。',
    '比较的念头来了，不代表你要跟着它走。可以先不评判自己。今天有没有哪一件小事，是你自己完成的？',
    '被问进度的时候，那种不舒服很真实。你不需要向所有人交代自己的节奏。要不要先在这里把这句话放下？',
  ],
  family: [
    '家里人的期待压在身上，会让人连停下来都像做错事。这份重量不是你的。最让你喘不过气的，是哪一句话？',
    '被安排的人生，连退出都像背叛。我听见了。我们先把「他们想要的」和「你想要的」分开一点点，不用现在就分清。',
    '家里的声音常常最大，大到盖住你自己的。你愿意的话，可以说说最近一次让你难受的对话。',
  ],
  reading: [
    '那段话好像在你心里停了一下。不用急着总结它。是哪一句让你停下来，愿意的话，可以原样念给我听。',
    '读到有触动的地方，常常说不清为什么。说不清也没关系。它让你想到自己的哪一段？',
    '有些句子会在心里留很久。它可能是替你说出了什么。此刻最想留下的，是那句话，还是你想到的事？',
  ],
  selfDoubt: [
    '这句话背后，好像是很久以来的累。先不急着回答「适不适合」。这一轮里，有没有哪一部分是你已经慢慢弄懂的？',
    '会这样怀疑自己，通常不是因为你不适合，而是因为已经撑了很久。我们先把今天过完。此刻你最想被听见的是哪一部分？',
    '这样问自己的时候，心里大概已经很不好受了。先不给你一个结论。你愿意从最近的一件小事说起吗？',
  ],
  examPressure: [
    '时间逼近的时候，心里会一直响着倒计时。先不放大它，也不假装它不存在。今天只留一件最小的事，做完就算。',
    '越到最后，越容易被「来不及」卷走。我们可以把注意力放回今天这一小段。你现在最想先做哪一件？',
    '考试临近，身体和心都会紧起来。先让自己站稳，再谈进度。今天有没有一个可以停下来的位置？',
  ],
  gratitude: [
    '谢谢你愿意把这些说出来。能停一停，本身就很重要。今天剩下的时间，按你舒服的节奏走就好。',
    '我收下这句话了。山谷一直在。你想坐一会儿，或者先回去，都可以。',
  ],
  apology: ['不用道歉。你的情绪对我不是负担，说多久都可以。想继续说，或者先歇一会儿，都可以。'],
  default: [
    '我听见了。你愿意说这些，我在这里。此刻心里最重的那一块，是什么？',
    '嗯，我在听。可以慢慢说，不用急着理清楚。',
    '这句话好像还有一点没说完。要不要从最近让你心里一动的那件小事说起？',
    '不用急着找到答案。先把它放在这里，也可以。',
  ],
};

function classify(text: string): Intent {
  const t = text.replace(/\s+/g, '');
  if (/学不进|不想学|看不进|发呆|没效率|没心气|静不下|坐不住|学不下去/.test(t)) return 'studyStuck';
  if (/计划|没完成|落下|崩|堆着|积压|来不及做/.test(t)) return 'planBroken';
  if (/累|困|疲惫|撑不住|没力气|身体|失眠|睡不着|头疼|胃疼|皮肤|绷着/.test(t)) return 'tired';
  if (/别人|同学|进度|比较|排名|朋友圈|都在学/.test(t)) return 'comparison';
  if (/爸妈|父母|家里|亲戚|家人|期待|他们要我/.test(t)) return 'family';
  if (isReading(t)) return 'reading';
  if (/不适合|考不上|没意义|要不要继续|怀疑自己|很差|失败/.test(t)) return 'selfDoubt';
  if (/考试|倒计时|快考|来不及|临近/.test(t)) return 'examPressure';
  if (/谢谢|好多了|有帮助|舒服一点|轻松一点/.test(t)) return 'gratitude';
  if (/对不起|抱歉|不好意思/.test(t)) return 'apology';
  return 'default';
}

function pickReply(intent: Intent, turn: number): string {
  const bank = REPLY_BANK[intent];
  return bank[turn % bank.length];
}

function moodWeather(text: string, intent: Intent): WeatherKind {
  if (intent === 'reading') return 'clear';
  if (intent === 'gratitude') return 'breeze';
  if (intent === 'tired') return 'rain';
  if (intent === 'studyStuck' || intent === 'planBroken' || intent === 'selfDoubt' || intent === 'examPressure') {
    return 'mist';
  }
  if (/累|委屈|难过|想哭|说出来|倾诉/.test(text)) return 'rain';
  if (/焦虑|害怕|怕|担心|乱|内耗|紧|崩|难受|迷茫/.test(text)) return 'mist';
  if (/复盘|放下|轻松|谢谢|好一点|在走/.test(text)) return 'breeze';
  return 'clear';
}

export function respond(input: AgentInput): AgentOutput {
  const { text, assistantTurns, heavyTurns, mirrorStage, recallWait, echoes } = input;
  const t = text.trim();
  const compact = t.replace(/\s+/g, '');
  const fallback = detectFallback(t, heavyTurns);

  // 1. 危机与固定边界话术：原样输出，停止深挖。
  if (fallback) {
    return {
      reply: FALLBACKS[fallback.key],
      stop: fallback.stop,
      crisis: fallback.level === 'crisis',
      mirrorStage: fallback.level === 'crisis' && mirrorStage === 'writing' ? 'done' : undefined,
    };
  }

  // 2. 镜像写作阶段：用户写下的内容作为镜像回音候选。
  if (mirrorStage === 'writing') {
    if (/不想写|写不出|退出|算了|先不写/.test(compact)) {
      return {
        reply: '好，那就不写。愿意停在这里，已经够了。想说点别的，或者先歇一会儿，都可以。',
        mirrorStage: 'done',
      };
    }
    return {
      reply: '写下来的这段，是你对自己的照顾。它会以你的原话留着，不会被改写。要不要存入山谷？',
      offer: { text: t, at: Date.now() },
      mirrorStage: 'done',
    };
  }

  // 3. 用户想停：不挽留，不追问。
  if (wantsStop(t)) {
    return {
      reply: '好，那就先到这里。山谷一直在，你想回来的时候再回来。',
      stop: true,
      mirrorStage: 'idle',
    };
  }

  // 4. 复盘时，先听完当下，再带回旧回音；只带回原话。
  if (recallWait && echoes.length > 0) {
    const echo =
      [...echoes].filter((item) => !item.mirror).sort((a, b) => b.createdAt - a.createdAt)[0] ?? echoes[0];
    const closing = /[。！？!?…；;]$/.test(echo.text) ? '' : '。';
    return {
      reply: `山谷为你带回一段你曾经留下的回音：「${echo.text}」${closing}（${echoTimeLabel(echo.createdAt)}）。此刻再听见这句话，你有什么新的感受吗？如果不想继续，也可以就放在这里。`,
      recallWait: false,
      weather: 'breeze',
    };
  }

  if (wantsRecall(t)) {
    if (echoes.length === 0) {
      return {
        reply: '山谷里还没有回音。等你想留下什么的时候，再回来就好。此刻想先说说这周吗？',
        recallWait: false,
      };
    }
    return {
      reply: '这周走到这里，辛苦了。先不急着看做了什么。此刻回头，你心里最先浮起来的是什么？',
      recallWait: true,
    };
  }

  // 5. 想梳理计划：把小路铺开，从第一句问起。
  if (wantsPlan(t) && !/没完成|崩|落下|打乱|做不到|来不及/.test(compact)) {
    return {
      reply: '好，我们慢慢来。先不急着排满，先想一件事：这段时间，你最想往哪个方向走？我把小路铺开了，我们从第一句开始。',
      openPlanner: true,
    };
  }

  const intent = classify(t);
  const reply = pickReply(intent, assistantTurns);

  // 6. 自我攻击：先接住，再询问是否愿意换一个位置看它。
  if (looksLikeSelfAttack(t)) {
    return {
      reply:
        intent === 'selfDoubt'
          ? reply
          : '听起来，你正在用很重的话说自己。先让这句话在这儿停一下。要不要换个位置看看它？',
      mirrorInvite: true,
      mirrorStage: 'idle',
      weather: assistantTurns === 1 ? 'mist' : undefined,
    };
  }

  // 7. 值得留下的感受：先回应，再把选择权交给用户。
  const canOffer =
    looksLikeEcho(t) &&
    t !== input.lastDeclinedText &&
    echoes.length < 10 &&
    intent !== 'gratitude' &&
    intent !== 'apology';

  const output: AgentOutput = { reply, allowLlm: true };

  if (echoes.length >= 10 && looksLikeEcho(t)) {
    output.reply = `${reply} ${COPY.echoLimitChat}`;
  } else if (canOffer) {
    output.offer = { text: t, at: Date.now() };
  }

  // 8. 天气意象偶尔出现，不每句都加，也不重复上一种。
  const showWeather = assistantTurns === 1 || assistantTurns % 3 === 0;
  if (showWeather) {
    const kind = moodWeather(t, intent);
    if (kind !== input.lastWeather) output.weather = kind;
  }

  return output;
}

