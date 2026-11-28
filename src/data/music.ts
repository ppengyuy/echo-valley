/**
 * 内置陪伴音乐库。
 *
 * 音源均来自 Wikimedia Commons 的 CC0 / Public Domain 素材，仅在本原型内使用。
 * 原始文件与许可（均在 commons.wikimedia.org 对应文件页可查）：
 * - 山谷舒缓 5 首：Rain on a veranda and t.ogg (PD)、20090610 0 ambience.ogg (PD)、
 *   Shallow small river with stony riverbed.ogg (PD)、Country night noise.ogg (PD)、
 *   On a pebble beach.ogg (PD)
 * - 山间向前 3 首：Relaxing-piano-music-351844.wav (CC0)、Pleasant Moments Piano Roll.ogg (PD)、
 *   El Noi de la Mare (guitar).ogg (PD)
 *
 * 不推荐、不自动播放、不按情绪切歌——是否听、听哪首，始终由用户决定。
 */
export interface Track {
  id: string;
  name: string;
  desc: string;
  /** 分类：山谷舒缓 / 山间向前 / 自己带的声音。 */
  group: 'calm' | 'forward' | 'local';
  src: string;
  /** 是否适合循环铺垫（环境音比纯音乐更适合长循环）。 */
  ambient: boolean;
}

/**
 * 音频放在 public/audio 下，构建后位于站点根。
 * 用 Vite 的 BASE_URL 拼接，本地开发是 '/'，部署到子路径（如 /echo-valley/）时自动带前缀，
 * 避免浏览器请求 /audio/... 被网关 404。
 */
const audioSrc = (file: string): string => `${import.meta.env.BASE_URL}audio/${file}`;

export const MUSIC_TRACKS: Track[] = [
  // 山谷舒缓：低密度环境音，适合沉淀、背书、平复焦虑。
  {
    id: 'rain-on-veranda',
    name: '雨落屋檐',
    desc: '雨声落在屋檐上，把杂念轻轻盖住',
    group: 'calm',
    src: audioSrc('rain-on-veranda.ogg'),
    ambient: true,
  },
  {
    id: 'forest-ambience',
    name: '林间有风',
    desc: '远处的风穿过树林，像坐在山里',
    group: 'calm',
    src: audioSrc('forest-ambience.ogg'),
    ambient: true,
  },
  {
    id: 'shallow-river',
    name: '浅溪碎石',
    desc: '水声漫过碎石，走走停停都没关系',
    group: 'calm',
    src: audioSrc('shallow-river.ogg'),
    ambient: true,
  },
  {
    id: 'country-night',
    name: '夜色原野',
    desc: '夜里很轻的底噪，陪你把心放下来',
    group: 'calm',
    src: audioSrc('country-night.ogg'),
    ambient: true,
  },
  {
    id: 'pebble-beach',
    name: '远岸潮声',
    desc: '潮水一遍遍漫上石滩，节奏很慢',
    group: 'calm',
    src: audioSrc('pebble-beach.ogg'),
    ambient: true,
  },
  // 山间向前：温和纯音，适合想稳稳往前走时。
  {
    id: 'relaxing-piano',
    name: '慢慢向前',
    desc: '平稳温和的琴声，不催你，只是陪着走',
    group: 'forward',
    src: audioSrc('relaxing-piano.wav'),
    ambient: false,
  },
  {
    id: 'pleasant-moments',
    name: '清晨琴声',
    desc: '一段清亮的旧钢琴，像刚醒来的早晨',
    group: 'forward',
    src: audioSrc('pleasant-moments.ogg'),
    ambient: false,
  },
  {
    id: 'guitar-warm',
    name: '木吉他暖',
    desc: '手指拨过琴弦，暖暖的，不慌不忙',
    group: 'forward',
    src: audioSrc('guitar-warm.ogg'),
    ambient: false,
  },
];

export const MUSIC_GROUPS: Array<{ id: Track['group']; label: string; hint: string }> = [
  { id: 'calm', label: '山谷舒缓', hint: '沉淀、背书、平复焦虑时 · 5 首' },
  { id: 'forward', label: '山间向前', hint: '想稳稳往前走时 · 3 首' },
];

export const MUSIC_TIP = '背景音乐仅陪伴，随时可以关掉';
export const LOCAL_AUDIO_TIP = '仅在当前页面播放，音频不会上传';

/** 自己带的声音：最多留 5 首，超过提示先移走一首。 */
export const LOCAL_AUDIO_MAX = 5;
/** 超过这个大小先给性能提示，由用户决定要不要放进来。 */
export const LOCAL_AUDIO_BIG_MB = 50;

export const LOCAL_AUDIO_COPY = {
  groupLabel: '自己带的声音',
  add: '＋ 选一首本地音乐',
  addHint: '点一下从电脑里选，选完要你再点播放',
  notAudio: '这个文件好像不是音乐',
  tooMany: '先放这几首就好，想换的话可以移走一首',
  bigFile: '这首有点大，放起来可能会慢一点',
  bigConfirm: '仍然放进来',
  bigCancel: '算了',
  broken: '这首暂时放不出来，换一首试试',
  remove: '移走',
  ghostHint: '上次选过，重新选一次就能听',
  emptyHint: '选过的音乐只在这一页放，关掉页面就没有了',
} as const;
