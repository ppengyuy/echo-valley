/**
 * 「借一句别人的话」的本地兜底池。
 *
 * 定位：原来一次只给一句，从 11 条真实原声里随机挑；现在改成**按批呈现的烦恼列表**——
 * 一批 10 条，铺开备考期里不同面的烦恼，这一批不感兴趣就整批换下一批。
 * 优先走知乎批量拉取（`generateQuoteBatch`），没配置 / 超时 / 返回不合格时退回这里，
 * 保证完全离线也能一批一批翻下去。
 *
 * 素材口径：
 * - 这里是**常见烦恼的转述**，不是逐字原声，界面上不许标成「一位知乎用户的原话」；
 * - 只写处境与念头，不给建议、不承诺结果、不评价看的人；
 * - 不出现病症名与诊断词，不出现「加油 / 上岸 / 提分 / 逆袭」。
 *
 * 规模：八个面 × 各 15 条 = 120 条。按 10 条一批算，**连续 12 批不重复**；
 * 12 批之后才会回到开头重新走（本地池有限，重复时仍是不同面的组合）。
 */

export interface WorryItem {
  id: string;
  text: string;
}

/** 八种常见烦恼面，每面 15 条，合计 120 条。 */
export const WORRY_POOL: Record<string, WorryItem[]> = {
  /* 深夜学不进 */
  night: [
    { id: 'w-night-1', text: '晚上坐到书桌前，先刷了四十分钟手机，才开始翻书，翻两页又困了。' },
    { id: 'w-night-2', text: '明明一整天都在图书馆，回想起来却说不出到底学了哪一块。' },
    { id: 'w-night-3', text: '白天上班，晚上才有整块时间，一到十一点脑子就转不动了。' },
    { id: 'w-night-4', text: '书是摊开的，人是走神的，一抬头两个小时过去了。' },
    { id: 'w-night-5', text: '越想趁晚上补回来，越坐不住，最后连觉也没睡好。' },
    { id: 'w-night-6', text: '一个人复习到很晚，房间里只剩翻页声，心里空得厉害。' },
    { id: 'w-night-7', text: '定了七点的闹钟，按掉三次，起来已经九点半。' },
    { id: 'w-night-8', text: '台灯开着，笔记摊着，手机放在另一个房间，我还是发了半小时呆。' },
    { id: 'w-night-9', text: '夜里效率最高，可第二天整天都是昏的，这样循环了两个月。' },
    { id: 'w-night-10', text: '常常在凌晨一点合上书，然后躺在床上想"今天又没学够"。' },
    { id: 'w-night-11', text: '打开网课，听老师讲了四十分钟，一个字都没进脑子。' },
    { id: 'w-night-12', text: '想早睡，躺下之后开始复盘今天的进度，越复盘越清醒。' },
    { id: 'w-night-13', text: '周末打算补一整天，结果上午睡过去了，下午才开始，晚上又撑不住。' },
    { id: 'w-night-14', text: '我给自己泡了茶、洗了脸、收了桌子，就是没打开书。' },
    { id: 'w-night-15', text: '学到一半忽然特别想找人说话，翻遍通讯录又关掉了。' },
  ],

  /* 计划断了 */
  broke: [
    { id: 'w-broke-1', text: '计划表做得挺细，第三天就断了，之后每次看到那张表都有点想删掉。' },
    { id: 'w-broke-2', text: '这周只想完成三件事，结果一件都没做完，周末干脆不想打开书。' },
    { id: 'w-broke-3', text: '一断就接不上，接不上就想干脆重新开始，然后又是新的一轮。' },
    { id: 'w-broke-4', text: '每天打卡的软件上，最长的那条连续记录停在第十九天。' },
    { id: 'w-broke-5', text: '给自己排得太满，做不完就自责，自责完更做不完。' },
    { id: 'w-broke-6', text: '原以为这周能补上上周落下的，一周过去，落下的更多了。' },
    { id: 'w-broke-7', text: '定了计划却总在改计划，改到最后计划本身变成一件要做的事。' },
    { id: 'w-broke-8', text: '每次都是"下周一开始"，手机里存了七版计划表。' },
    { id: 'w-broke-9', text: '清单上划掉一件事的快乐，撑不过第二天早上。' },
    { id: 'w-broke-10', text: '我把计划写在便利贴上贴在墙上，贴了六张，一张都没走完。' },
    { id: 'w-broke-11', text: '中间生了场病，停了四天，再坐回桌前像从零开始。' },
    { id: 'w-broke-12', text: '明明是自己的计划，看着却像别人给我派的活。' },
    { id: 'w-broke-13', text: '计划里最常出现的一行是"补昨天的"。' },
    { id: 'w-broke-14', text: '一到周末就想把整周欠下的都还上，结果周末也没了。' },
    { id: 'w-broke-15', text: '我不怕学得慢，怕的是一停就再也接不上。' },
  ],

  /* 怕努力没有结果 */
  noResult: [
    { id: 'w-noresult-1', text: '每天背，合上书还是想不起来，开始怀疑这些时间到底有没有落下去。' },
    { id: 'w-noresult-2', text: '很怕自己认真了大半年，最后分数和随便考考差不多。' },
    { id: 'w-noresult-3', text: '有时候会想，如果本来就不是读书这块料，那现在这样算什么。' },
    { id: 'w-noresult-4', text: '看到别人的进度，会突然觉得自己一直在原地绕。' },
    { id: 'w-noresult-5', text: '最怕的不是考不上，是考不上之后还得跟人解释这大半年。' },
    { id: 'w-noresult-6', text: '做过一套真题，分数跟上次几乎一样，那一刻不太想说话。' },
    { id: 'w-noresult-7', text: '不敢估分，也不敢不估分，两个念头来回换。' },
    { id: 'w-noresult-8', text: '有时候学得很顺，反而更慌，怕这种顺是假的。' },
    { id: 'w-noresult-9', text: '我在心里算过一遍投入产出，算完就不想再算了。' },
    { id: 'w-noresult-10', text: '别人问我准备得怎么样，我说"还行"，其实我完全不知道。' },
    { id: 'w-noresult-11', text: '一想到结果可能是坏的，就会想现在停下来是不是更划算。' },
    { id: 'w-noresult-12', text: '做过一个梦，梦见成绩出来了，醒来第一件事是去看日历。' },
    { id: 'w-noresult-13', text: '我不怕辛苦，我怕辛苦之后什么都没有。' },
    { id: 'w-noresult-14', text: '每次模考完都要缓一天，那一天的效率几乎为零。' },
    { id: 'w-noresult-15', text: '有时候会偷偷希望这场考试快点来，好结束这种悬着。' },
  ],

  /* 反复失败 / 又来一次 */
  again: [
    { id: 'w-again-1', text: '这是第二次准备了，翻开同一本书的时候，心里有点说不出的感觉。' },
    { id: 'w-again-2', text: '上次差了几分，家里人说"再试一次"，我点头了，其实还没想好。' },
    { id: 'w-again-3', text: '第一次考的时候还觉得有新鲜劲，这次只剩熟悉和疲惫。' },
    { id: 'w-again-4', text: '同一道题又错了，翻回去看，上次也在旁边写过一句话。' },
    { id: 'w-again-5', text: '身边人陆续有了去处，我还在原地准备同一场考试。' },
    { id: 'w-again-6', text: '想着这次一定不一样，可到十月，节奏又和去年像了起来。' },
    { id: 'w-again-7', text: '我不敢跟新的朋友说这是第几次，含糊过去了。' },
    { id: 'w-again-8', text: '这本书我翻第三遍了，前两遍的笔记还在，字迹一次比一次潦草。' },
    { id: 'w-again-9', text: '去年的准考证还夹在书里，某天翻到，愣了挺久。' },
    { id: 'w-again-10', text: '我知道自己上次哪里没做好，但知道和做到是两件事。' },
    { id: 'w-again-11', text: '每次有人问"你还在考啊"，我都笑一下，然后换个话题。' },
    { id: 'w-again-12', text: '我把去年的成绩单删了，但那个数字还记着。' },
    { id: 'w-again-13', text: '这次我换了学习方法，用了一个月，又开始怀疑是不是换错了。' },
    { id: 'w-again-14', text: '有过一次失败之后，做任何计划都会先想"万一又不行"。' },
    { id: 'w-again-15', text: '我不太敢跟人说"这次一定"，只敢说"再试试"。' },
  ],

  /* 身体很累 */
  tired: [
    { id: 'w-tired-1', text: '不是不想学，是坐到桌前就先叹一口气，身体比脑子先累。' },
    { id: 'w-tired-2', text: '下班回来只想躺着，书就放在包里，一直没拿出来。' },
    { id: 'w-tired-3', text: '最近总在下午三四点犯困，一杯咖啡顶两个小时，之后更困。' },
    { id: 'w-tired-4', text: '明明什么都没干，晚上还是觉得被抽空了。' },
    { id: 'w-tired-5', text: '想歇一天，躺下又觉得不该歇，结果一天也没歇好。' },
    { id: 'w-tired-6', text: '这周有三天没出门，除了买饭没跟人说过话。' },
    { id: 'w-tired-7', text: '肩膀一直是紧的，睡觉都要想一会儿明天要做什么才能睡着。' },
    { id: 'w-tired-8', text: '眼睛干得厉害，滴了眼药水接着看，字还是糊的。' },
    { id: 'w-tired-9', text: '最近总是忘事，刚放下的东西转身就找不到。' },
    { id: 'w-tired-10', text: '我坐着的时候会不自觉抖腿，一停下来就觉得心里发慌。' },
    { id: 'w-tired-11', text: '吃饭越来越随便，有时候一天只吃一顿，也不觉得饿。' },
    { id: 'w-tired-12', text: '早上起来第一件事是算还能睡多久，第二件事是算还剩几天。' },
    { id: 'w-tired-13', text: '有段时间特别容易感冒，刚好一点又开始熬夜。' },
    { id: 'w-tired-14', text: '我知道该运动，但一想到要换衣服出门，就算了。' },
    { id: 'w-tired-15', text: '累到一定程度反而不困，躺着睁眼到三点。' },
  ],

  /* 家里人的期待 */
  family: [
    { id: 'w-family-1', text: '我妈每天问我今天学得怎么样，我说还行，其实那天没怎么学。' },
    { id: 'w-family-2', text: '家里人嘴上说"不着急"，但每次打电话都会绕回同一件事。' },
    { id: 'w-family-3', text: '不想让他们失望，又不想为了不让他们失望而考。' },
    { id: 'w-family-4', text: '亲戚问起工作，我说还在准备考试，然后话题就换掉了。' },
    { id: 'w-family-5', text: '我爸说考不上也没关系，可他说这话的语气让我更紧张。' },
    { id: 'w-family-6', text: '家里给的生活费不多不少，每次收下都觉得有点沉。' },
    { id: 'w-family-7', text: '我妈会给我发别人家孩子的消息，我知道她没有恶意。' },
    { id: 'w-family-8', text: '过年回家被问了三次同一个问题，第三次我去阳台站了会儿。' },
    { id: 'w-family-9', text: '我爸开始不提考试的事了，这种小心反而让我更难受。' },
    { id: 'w-family-10', text: '我跟家里说压力不大，挂了电话之后坐了很久。' },
    { id: 'w-family-11', text: '家里人觉得我在家复习挺好，只有我知道一天说不了几句话。' },
    { id: 'w-family-12', text: '我妈把我的书桌收拾了一遍，我找了半天才找到要用的资料。' },
    { id: 'w-family-13', text: '有时候想跟他们说说实话，话到嘴边变成"挺好的"。' },
    { id: 'w-family-14', text: '我知道他们是担心我，但被担心这件事本身也有重量。' },
    { id: 'w-family-15', text: '有次我妈说"你自己决定"，我反而更不知道该怎么决定。' },
  ],

  /* 和别人比进度 */
  compare: [
    { id: 'w-compare-1', text: '同宿舍的人已经开始刷第三遍真题了，我第一遍还没过完。' },
    { id: 'w-compare-2', text: '看到群里报进度，会下意识把自己的数字改大一点。' },
    { id: 'w-compare-3', text: '别人一天能学八小时，我四个小时就到顶，还会怀疑自己不够努力。' },
    { id: 'w-compare-4', text: '朋友已经拿到 offer，我还在为一个不确定的结果准备。' },
    { id: 'w-compare-5', text: '不是嫉妒，就是会突然觉得自己慢了很多。' },
    { id: 'w-compare-6', text: '刷到别人的学习日常，会关掉手机，然后有点不想再看书。' },
    { id: 'w-compare-7', text: '同学聚会我没去，去了也不知道说什么。' },
    { id: 'w-compare-8', text: '朋友圈里有人晒录取通知，我点了个赞，然后把朋友圈关了。' },
    { id: 'w-compare-9', text: '有人一边工作一边考，还考得比我好，我就想不通自己差在哪。' },
    { id: 'w-compare-10', text: '我们一起开始准备的，现在他已经在准备复试了。' },
    { id: 'w-compare-11', text: '看到别人一天打卡十几个小时，我会怀疑自己是不是根本没尽力。' },
    { id: 'w-compare-12', text: '家里人提起同学的名字，我心里会先紧一下。' },
    { id: 'w-compare-13', text: '我知道每个人情况不同，可知道不代表不难受。' },
    { id: 'w-compare-14', text: '有时候会故意不去问别人的进度，怕自己受不了。' },
    { id: 'w-compare-15', text: '别人的好消息我也会真心高兴，只是高兴完之后有点空。' },
  ],

  /* 临考前的慌 */
  panic: [
    { id: 'w-panic-1', text: '还有二十天，忽然觉得什么都没准备好，之前学的好像都忘了。' },
    { id: 'w-panic-2', text: '越到最后越想重头再来一遍，可时间只够翻一遍。' },
    { id: 'w-panic-3', text: '看到倒计时上的数字变小，手心会出汗。' },
    { id: 'w-panic-4', text: '我把要背的东西列了一遍，列完发现根本背不完。' },
    { id: 'w-panic-5', text: '这几天总在算"如果每天学十四个小时还来不来得及"。' },
    { id: 'w-panic-6', text: '有人跟我说"放轻松"，我点头，心里更慌了。' },
    { id: 'w-panic-7', text: '临考前反而坐不住，一天要起来十几次。' },
    { id: 'w-panic-8', text: '我开始怀疑自己选的方向是不是一开始就错了。' },
    { id: 'w-panic-9', text: '昨天把笔记从头翻到尾，越翻越快，最后什么都没记住。' },
    { id: 'w-panic-10', text: '想着"考完就好了"，可又怕考完之后是另一种难受。' },
    { id: 'w-panic-11', text: '这几天睡得很浅，梦里都在做题。' },
    { id: 'w-panic-12', text: '我把准考证打印了三份，好像这样能安心一点。' },
    { id: 'w-panic-13', text: '最后一星期我不太敢做新题，怕做错。' },
    { id: 'w-panic-14', text: '明明知道现在慌没用，可就是停不下来。' },
    { id: 'w-panic-15', text: '有时候会想，如果这场考试明天就考，我大概会松一口气。' },
  ],
};

/** 面的顺序：一批里按这个次序轮转，保证相邻两条不是同一个烦恼面。 */
const BUCKET_ORDER = ['night', 'broke', 'noResult', 'again', 'tired', 'family', 'compare', 'panic'];

/**
 * 把八个面交错摊平：night[0], broke[0], …, panic[0], night[1], …
 *
 * 这样按 10 条一段切下去，每一批都自然铺开七八个面，
 * 不会出现「这一批全是深夜学不进」那种重复感。
 */
const INTERLEAVED: WorryItem[] = (() => {
  const out: WorryItem[] = [];
  const deepest = Math.max(...BUCKET_ORDER.map((key) => WORRY_POOL[key].length));
  for (let depth = 0; depth < deepest; depth += 1) {
    for (const key of BUCKET_ORDER) {
      const item = WORRY_POOL[key][depth];
      if (item) out.push(item);
    }
  }
  return out;
})();

export const WORRY_POOL_SIZE = INTERLEAVED.length;

/**
 * 取一批：从交错序列里按 `round` 整段切，切到底再从头绕。
 *
 * - `used` 里的句子优先避开（换下一批不重复）；
 * - 池子被榨干时（`used` 已满 120 条）退回忽略 `used` 的补位，保证「换一批」永远还有内容，
 *   而不是停在一个空的结束页上——离线兜底宁可重复，也不要把人卡住。
 */
export function localWorryBatch(round: number, count = 10, used: string[] = []): WorryItem[] {
  const out: WorryItem[] = [];
  const total = INTERLEAVED.length;
  if (!total) return out;

  const start = (round * count) % total;
  for (let step = 0; step < total && out.length < count; step += 1) {
    const item = INTERLEAVED[(start + step) % total];
    if (used.includes(item.text)) continue;
    if (out.some((one) => one.text === item.text)) continue;
    out.push(item);
  }

  // 池子榨干了：从另一处起头重走，只避免这一批内部重复。
  if (out.length < count) {
    const restart = (start + total / 2) % total;
    for (let step = 0; step < total && out.length < count; step += 1) {
      const item = INTERLEAVED[(Math.floor(restart) + step) % total];
      if (out.some((one) => one.text === item.text)) continue;
      out.push(item);
    }
  }

  return out;
}
