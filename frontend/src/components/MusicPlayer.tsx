import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LOCAL_AUDIO_BIG_MB,
  LOCAL_AUDIO_COPY,
  LOCAL_AUDIO_MAX,
  LOCAL_AUDIO_TIP,
  MUSIC_GROUPS,
  MUSIC_TIP,
  MUSIC_TRACKS,
  type Track,
} from '../data/music';

const VOLUME_KEY = 'echo-valley-music-volume';
const LAST_TRACK_KEY = 'echo-valley-music-track';
/** 只存文件名与大小，用来在刷新后显示灰色记录；绝不存音频本身。 */
const LOCAL_META_KEY = 'echo-valley-local-audio-meta';
const LOCAL_ID_PREFIX = 'local-';

type LoopMode = 'list' | 'single';

interface LocalTrack extends Track {
  group: 'local';
  /** 原始文件名与大小，用于去重与灰色记录。 */
  fileName: string;
  fileSize: number;
}

interface LocalMeta {
  name: string;
  size: number;
}

interface PendingBig {
  file: File;
  sizeMb: string;
}

const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|flac)$/i;

function readNumber(key: string, fallback: number): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readString(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readLocalMeta(): LocalMeta[] {
  try {
    const raw = sessionStorage.getItem(LOCAL_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LocalMeta =>
          !!item && typeof item.name === 'string' && typeof item.size === 'number',
      )
      .slice(0, LOCAL_AUDIO_MAX);
  } catch {
    return [];
  }
}

function writeLocalMeta(list: LocalMeta[]) {
  try {
    sessionStorage.setItem(LOCAL_META_KEY, JSON.stringify(list));
  } catch {
    // 会话存储不可用也不影响播放。
  }
}

/** 去掉扩展名当显示名；不读 ID3 标签与封面。 */
function displayName(fileName: string): string {
  return fileName.replace(AUDIO_EXT, '').trim() || fileName;
}

function looksLikeAudio(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);
}

function NoteIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 17.5V7.2l9-2.1v10.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="7.3" cy="17.8" rx="2.4" ry="1.8" fill="currentColor" />
      <ellipse cx="16.3" cy="15.7" rx="2.4" ry="1.8" fill="currentColor" />
      {playing ? (
        <path d="M12 5.4c1.2.7 1.2 2.1 0 2.8M15 4.8c1.9 1.1 1.9 3.3 0 4.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export function MusicPlayer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState<string>(() => {
    const saved = readString(LAST_TRACK_KEY);
    return saved && MUSIC_TRACKS.some((t) => t.id === saved) ? saved : MUSIC_TRACKS[0].id;
  });
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => Math.min(1, Math.max(0, readNumber(VOLUME_KEY, 0.5))));
  const [loopMode, setLoopMode] = useState<LoopMode>('list');

  /** 本地音乐只放在内存里：objectURL 不进 sessionStorage，刷新即失效。 */
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  /** 刷新后留下的灰色记录，只有名字和大小；本次会话内不再变动。 */
  const [ghosts] = useState<LocalMeta[]>(() => readLocalMeta());
  const [localHint, setLocalHint] = useState('');
  const [pendingBig, setPendingBig] = useState<PendingBig | null>(null);
  const localRef = useRef<LocalTrack[]>([]);

  localRef.current = localTracks;

  /** 内置 + 本地，播放与循环都按这个顺序走。 */
  const allTracks = useMemo<Track[]>(() => [...MUSIC_TRACKS, ...localTracks], [localTracks]);

  const track = useMemo(
    () => allTracks.find((t) => t.id === trackId) ?? MUSIC_TRACKS[0],
    [allTracks, trackId],
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // 会话存储不可用也不影响播放。
    }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // 本地曲目的 id 指向一个内存 URL，刷新后必然失效，所以不写进会话记录。
  useEffect(() => {
    if (trackId.startsWith(LOCAL_ID_PREFIX)) return;
    try {
      sessionStorage.setItem(LAST_TRACK_KEY, trackId);
    } catch {
      // 忽略。
    }
  }, [trackId]);

  // 「今天不想说话」方式 B 联动：切到山谷舒缓第一首并展开面板，但不自动播放。
  useEffect(() => {
    const onQuietListen = (event: Event) => {
      const detail = (event as CustomEvent<{ group?: string }>).detail;
      if (detail?.group !== 'calm') return;
      const first = MUSIC_TRACKS.find((track) => track.group === 'calm');
      if (first) setTrackId(first.id);
      setOpen(true);
    };
    window.addEventListener('echo-valley:music', onQuietListen);
    return () => window.removeEventListener('echo-valley:music', onQuietListen);
  }, []);

  // 离开页面与卸载时释放全部内存 URL，避免白占内存。
  useEffect(() => {
    const revokeAll = () => {
      localRef.current.forEach((item) => URL.revokeObjectURL(item.src));
    };
    window.addEventListener('pagehide', revokeAll);
    return () => {
      window.removeEventListener('pagehide', revokeAll);
      revokeAll();
    };
  }, []);

  // 面板打开时，点外面就收起；点按钮与面板内部不会误关。
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  // 只有用户主动点播放才 play，绝不自动播放。
  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    void audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const selectTrack = (next: Track) => {
    if (next.id === trackId) {
      if (playing) pause();
      else play();
      return;
    }
    setTrackId(next.id);
    setPlaying(false);
    // 换曲后由 ended/onLoaded 触发；这里直接请求播放，因为仍是用户主动点击。
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.load();
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }, 30);
  };

  const onEnded = () => {
    if (loopMode === 'single') {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
      return;
    }
    const index = allTracks.findIndex((t) => t.id === trackId);
    const next = allTracks[(index + 1) % allTracks.length];
    if (!next) return;
    setTrackId(next.id);
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.load();
      void audio.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }, 30);
  };

  /** 选中的曲子解码失败：提示并移走，不留一个放不出来的条目。 */
  const onAudioError = () => {
    if (!trackId.startsWith(LOCAL_ID_PREFIX)) return;
    setLocalHint(LOCAL_AUDIO_COPY.broken);
    removeLocal(trackId, true);
  };

  /** 真正把一个文件加进列表：创建内存 URL，不上传、不读标签。 */
  const pushLocal = (file: File) => {
    const id = `${LOCAL_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: LocalTrack = {
      id,
      name: displayName(file.name),
      desc: LOCAL_AUDIO_TIP,
      group: 'local',
      src: URL.createObjectURL(file),
      ambient: false,
      fileName: file.name,
      fileSize: file.size,
    };
    setLocalTracks((current) => {
      const next = [...current, entry];
      writeLocalMeta(next.map((item) => ({ name: item.fileName, size: item.fileSize })));
      return next;
    });
    // 选中但不播放：选文件不等于现在就想听。
    setTrackId(id);
    setPlaying(false);
    setLocalHint('');
  };

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    setLocalHint('');
    let slots = LOCAL_AUDIO_MAX - localRef.current.length;
    const existing = new Set(
      localRef.current.map((item) => `${item.fileName}:${item.fileSize}`),
    );

    for (const file of Array.from(files)) {
      if (slots <= 0) {
        setLocalHint(LOCAL_AUDIO_COPY.tooMany);
        break;
      }
      if (!looksLikeAudio(file)) {
        setLocalHint(LOCAL_AUDIO_COPY.notAudio);
        continue;
      }
      // 同名同大小视为同一首，不重复添加。
      const key = `${file.name}:${file.size}`;
      if (existing.has(key)) continue;
      existing.add(key);

      if (file.size > LOCAL_AUDIO_BIG_MB * 1024 * 1024) {
        // 大文件先问一句，由用户决定。一次只排一个待确认。
        setPendingBig({ file, sizeMb: (file.size / 1024 / 1024).toFixed(0) });
        continue;
      }
      pushLocal(file);
      slots -= 1;
    }
  };

  const removeLocal = (id: string, silent = false) => {
    const target = localRef.current.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.src);
    setLocalTracks((current) => {
      const next = current.filter((item) => item.id !== id);
      writeLocalMeta(next.map((item) => ({ name: item.fileName, size: item.fileSize })));
      return next;
    });
    if (trackId === id) {
      pause();
      setTrackId(MUSIC_TRACKS[0].id);
    }
    if (!silent) setLocalHint('');
  };

  const pickFiles = () => {
    if (localTracks.length >= LOCAL_AUDIO_MAX) {
      setLocalHint(LOCAL_AUDIO_COPY.tooMany);
      return;
    }
    fileInputRef.current?.click();
  };

  const close = () => setOpen(false);
  const localFull = localTracks.length >= LOCAL_AUDIO_MAX;
  // 已经放进来的文件，就不用再提示"上次选过"了。
  const ghostList = ghosts.filter(
    (meta) => !localTracks.some((item) => item.fileName === meta.name && item.fileSize === meta.size),
  );

  return (
    <div className={`music-wrap ${open ? 'is-open' : ''}`} ref={rootRef}>
      <audio
        ref={audioRef}
        src={track.src}
        loop={false}
        preload="none"
        onEnded={onEnded}
        onError={onAudioError}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files);
          // 清空后同一个文件还能再选一次。
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className={`music-top-button ${playing ? 'is-playing' : ''}`}
        aria-label={playing ? '背景音乐播放中，点开看看' : '听点声音，打开背景音乐'}
        aria-expanded={open}
        title={playing ? '背景音乐播放中' : '听点声音'}
        onClick={() => setOpen((value) => !value)}
      >
        <NoteIcon playing={playing} />
        <span>{playing ? '正在听' : '听点声音'}</span>
        {playing ? <i className="music-button-dot" aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div className="music-panel" role="dialog" aria-label="背景音乐">
          <div className="music-panel-head">
            <div>
              <p className="music-eyebrow">刘看山为你放一点声音</p>
              <h3>背景音乐</h3>
            </div>
            <button type="button" className="music-close" aria-label="收起音乐面板" onClick={close}>
              ×
            </button>
          </div>

          <p className="music-state">
            <span className={`music-state-dot ${playing ? 'is-on' : ''}`} aria-hidden="true" />
            {playing ? '正在陪你' : '还没有播放'}
          </p>

          <div className="music-now">
            <div className="music-now-info">
              <strong>{track.name}</strong>
              <span>{track.desc}</span>
            </div>
            <button
              type="button"
              className="music-play"
              aria-label={playing ? '暂停' : '播放'}
              onClick={() => (playing ? pause() : play())}
            >
              {playing ? '❚❚' : '▶'}
            </button>
          </div>

          <div className="music-controls">
            <label className="music-volume">
              <span>音量</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                aria-label="音量"
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="music-loop"
              title={loopMode === 'single' ? '单曲循环，点一下换列表循环' : '列表循环，点一下换单曲循环'}
              onClick={() => setLoopMode((mode) => (mode === 'list' ? 'single' : 'list'))}
            >
              {loopMode === 'single' ? '单曲循环' : '列表循环'}
            </button>
          </div>

          <div className="music-list">
            {MUSIC_GROUPS.map((group) => (
              <div className="music-group" key={group.id}>
                <p className="music-group-title">
                  {group.label} <span>{group.hint}</span>
                </p>
                {MUSIC_TRACKS.filter((item) => item.group === group.id).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`music-track ${item.id === trackId ? 'is-on' : ''}`}
                    onClick={() => selectTrack(item)}
                  >
                    <span className="music-track-dot" aria-hidden="true" />
                    <span className="music-track-text">
                      <strong>{item.name}</strong>
                      <small>{item.desc}</small>
                    </span>
                    {item.id === trackId && playing ? <span className="music-track-playing">在听</span> : null}
                  </button>
                ))}
              </div>
            ))}

            {/* 自己带的声音：只在这一页内存播放，不上传、不持久保存 */}
            <div className="music-group is-local">
              <p className="music-group-title">
                {LOCAL_AUDIO_COPY.groupLabel} <span>{LOCAL_AUDIO_TIP}</span>
              </p>

              {localTracks.map((item) => (
                <div className={`music-track-row ${item.id === trackId ? 'is-on' : ''}`} key={item.id}>
                  <button
                    type="button"
                    className={`music-track ${item.id === trackId ? 'is-on' : ''}`}
                    onClick={() => selectTrack(item)}
                  >
                    <span className="music-track-dot" aria-hidden="true" />
                    <span className="music-track-text">
                      <strong>{item.name}</strong>
                      <small>{LOCAL_AUDIO_TIP}</small>
                    </span>
                    {item.id === trackId && playing ? (
                      <span className="music-track-playing">在听</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="music-track-remove"
                    aria-label={`${LOCAL_AUDIO_COPY.remove}：${item.name}`}
                    title={LOCAL_AUDIO_COPY.remove}
                    onClick={() => removeLocal(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {ghostList.map((meta) => (
                <button
                  type="button"
                  className="music-local-ghost"
                  key={`${meta.name}-${meta.size}`}
                  title={LOCAL_AUDIO_COPY.ghostHint}
                  onClick={pickFiles}
                >
                  <span className="music-local-ghost-name">{displayName(meta.name)}</span>
                  <small>{LOCAL_AUDIO_COPY.ghostHint}</small>
                </button>
              ))}

              {pendingBig ? (
                <div className="music-local-confirm">
                  <p>
                    {LOCAL_AUDIO_COPY.bigFile}（约 {pendingBig.sizeMb} MB）
                  </p>
                  <div className="music-local-confirm-actions">
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => {
                        pushLocal(pendingBig.file);
                        setPendingBig(null);
                      }}
                    >
                      {LOCAL_AUDIO_COPY.bigConfirm}
                    </button>
                    <button
                      type="button"
                      className="text-button small"
                      onClick={() => setPendingBig(null)}
                    >
                      {LOCAL_AUDIO_COPY.bigCancel}
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="music-local-add"
                disabled={localFull}
                title={localFull ? LOCAL_AUDIO_COPY.tooMany : LOCAL_AUDIO_COPY.addHint}
                onClick={pickFiles}
              >
                {LOCAL_AUDIO_COPY.add}
              </button>

              {localHint ? <p className="music-local-hint">{localHint}</p> : null}
              {!localTracks.length && !ghostList.length && !localHint ? (
                <p className="music-local-hint">{LOCAL_AUDIO_COPY.emptyHint}</p>
              ) : null}
            </div>
          </div>

          <p className="music-tip">{MUSIC_TIP}</p>
        </div>
      ) : null}
    </div>
  );
}
