interface FirstRunNoticeProps {
  open: boolean;
  onChoose: (mode: 'local' | 'session') => void;
}

/**
 * 首次启动的知情确认：只弹一次。
 * 点「确认并继续」→ 初始化本地珍藏；点「本次仅用会话模式」→ 这次不落库，下次再问。
 */
export function FirstRunNotice({ open, onChoose }: FirstRunNoticeProps) {
  if (!open) return null;

  return (
    <div className="firstrun-backdrop" role="dialog" aria-modal="true" aria-labelledby="firstrun-title">
      <div className="firstrun-card">
        <p className="eyebrow">
          <span className="eyebrow-line" aria-hidden="true" />
          第一次见面
        </p>
        <h2 id="firstrun-title">已默认开启「本地珍藏」</h2>
        <p>你的回音、学习计划会保存在本机浏览器，不会上传网络。</p>
        <p className="firstrun-warn">
          ⚠️ 清除浏览器缓存 / 站点数据会导致全部内容丢失，请定期导出备份。
        </p>
        <p>你随时可在设置中切换为「会话模式」，或手动执行「全部回音消散」。</p>
        <div className="firstrun-actions">
          <button type="button" className="button primary" onClick={() => onChoose('local')}>
            确认并继续
          </button>
          <button type="button" className="button ghost" onClick={() => onChoose('session')}>
            本次仅用会话模式
          </button>
        </div>
        <p className="firstrun-foot">
          回音仍然只在你点「确认存入山谷」之后才留下，不会被自动收走。
        </p>
      </div>
    </div>
  );
}
