import { useRef, useState } from 'react';
import { Modal } from './Modal';
import type { StorageMode } from '../persist';
import JellyRadio from '../motion/JellyRadio.jsx';
import FlipCard from '../motion/FlipCard.jsx';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  mode: StorageMode;
  onSwitchMode: (mode: StorageMode) => void;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<string>;
  onWipe: () => Promise<void>;
  onOpenSafety: () => void;
  /** 重看新手引导（走过一次之后，还能从设置里再点开）。 */
  onReplayTour?: () => void;
}

/**
 * 设置页：存储模式开关、备份导出/恢复、全部回音消散、隐私说明。
 * 所有清理动作都要用户自己点，产品不会替他做决定。
 */
export function SettingsModal({
  open,
  onClose,
  mode,
  onSwitchMode,
  onExport,
  onImport,
  onWipe,
  onOpenSafety,
  onReplayTour,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wipeStep, setWipeStep] = useState<0 | 1>(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExport();
      setNotice('备份已经导出。文件在你自己的电脑里，没有经过网络。');
    } catch {
      setNotice('这次导出没成功。可以再点一次。');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const message = await onImport(file);
      setNotice(message);
    } catch {
      setNotice('这个文件读不出来，或者不是回音谷导出的备份。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal
      open={open}
      title="设置"
      onClose={onClose}
      label="settings"
      wide
      footer={
        <button type="button" className="button ghost" onClick={onClose}>
          收起设置
        </button>
      }
    >
      <div className="settings-page">
        <section className="settings-block">
          <h3>存储方式</h3>
          <p className="settings-mode-line">
            当前：<strong>{mode === 'local' ? '本地珍藏（已开启）' : '会话模式'}</strong>
          </p>
          <div className="mode-switch" role="group" aria-label="存储方式">
            <JellyRadio
              items={[
                { value: 'local', label: '本地珍藏（默认）' },
                { value: 'session', label: '会话模式' },
              ]}
              value={mode}
              onChange={(next: any) => onSwitchMode(next as StorageMode)}
              size="md"
              ariaLabel="存储方式"
              swell={0.1}
            />
            <p className="settings-mode-desc">
              {mode === 'local'
                ? '回音与学习计划存在这台电脑的浏览器里，刷新、重开都还在。'
                : '演示机、公共电脑用。关掉页面就消散，不留下任何内容。'}
            </p>
          </div>
          <FlipCard
            className="settings-flip"
            height={148}
            ariaLabel="翻看本地珍藏的边界"
            front={
              <div className="settings-flip-face">
                <strong>边界与备份</strong>
                <span>
                  {mode === 'local'
                    ? '这份珍藏只在这台电脑的这个浏览器里'
                    : '这一版是会话模式，关掉页面就消散'}
                </span>
                <small>点一下，看需要注意的几件事</small>
              </div>
            }
            back={
              <div className="settings-flip-face">
                <strong>换浏览器、清站点数据、换设备，都读不到</strong>
                <span>想留住就定期导出 JSON 备份；关掉珍藏模式不会删已有数据。</span>
                <small>再点一下翻回来</small>
              </div>
            }
          />
        </section>

        <section className="settings-block">
          <h3>备份与清理</h3>
          <div className="settings-actions">
            <button type="button" className="button ghost" onClick={() => void doExport()} disabled={busy}>
              导出全部珍藏为 JSON 备份
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              从备份文件恢复
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="settings-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void doImport(file);
              }}
            />
          </div>
          <p className="settings-note">
            单条回音的归档与消散在「回音谷」里做，这里只处理整份备份。备份文件只在你自己的电脑上，不经过任何服务器。
          </p>

          <div className="settings-danger">
            <h4>全部回音消散</h4>
            <p>彻底清空本机的回音与小路计划，不可恢复。清空后如果还想留，只能靠之前的备份。</p>
            {wipeStep === 0 ? (
              <button type="button" className="button ghost danger" onClick={() => setWipeStep(1)}>
                全部回音消散
              </button>
            ) : (
              <div className="settings-confirm">
                <p>确认清空吗？这一步做完就收不回来了。</p>
                <div className="dialog-actions">
                  <button type="button" className="button ghost" onClick={() => setWipeStep(0)}>
                    再留一会儿
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      void (async () => {
                        await onWipe();
                        setWipeStep(0);
                        setNotice('山谷已经空下来了。这里没有留下任何回音。');
                      })();
                    }}
                  >
                    确认，全部消散
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="settings-block">
          <h3>隐私说明</h3>
          <ul className="settings-list">
            <li>回音只在你点「确认存入山谷」之后才写入，对话不会被自动收走；</li>
            <li>只保存你写的原话与时间，不做情绪分析、不打标签、不生成摘要；</li>
            <li>练习不留任何记录：不统计次数、时长、完成状态，也不写行为日志；</li>
            <li>不会根据回音或练习行为自动改动山间小路上的计划；</li>
            <li>没有打卡、积分、排行榜、连续练习奖励，也不会主动推送；</li>
            <li>所有数据只存在这台电脑的浏览器里（IndexedDB / 会话存储），不上传任何后端。</li>
          </ul>
          <button type="button" className="text-button" onClick={onOpenSafety}>
            打开安全与帮助 →
          </button>
        </section>

        <section className="settings-block">
          <h3>本期范围</h3>
          <p className="settings-note">
            这一版只做 P0：本地珍藏、三个空间、静一下心工具箱、设置与安全页。
          </p>
          <ul className="settings-list is-scope">
            <li className="is-in">P0 · 山间小路、回音谷、静一下心、本地珍藏与备份、安全与帮助</li>
            <li className="is-out">范围外（保留可体验，未纳入本期验收）：对话陪伴、溪边的石子、音乐、双线复盘、计划导出</li>
            <li className="is-out">本期不做：溯回山谷、时间段双线复盘、多套计划管理、回音自定义标签、复习闪卡</li>
          </ul>
        </section>

        {onReplayTour ? (
          <section className="settings-block">
            <h3>新手引导</h3>
            <p className="settings-note">
              第一次打开时的那几步导览，随时可以再看一遍：三条入口、写一句的地方、山间小路、静一下心、回音列表与设置。
            </p>
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                onClose();
                onReplayTour();
              }}
            >
              再看一遍新手引导
            </button>
          </section>
        ) : null}

        {notice ? <p className="settings-toast-line">{notice}</p> : null}
      </div>
    </Modal>
  );
}

