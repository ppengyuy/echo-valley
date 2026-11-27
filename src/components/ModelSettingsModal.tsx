import { useState, useSyncExternalStore } from 'react';
import { COPY } from '../copy';
import {
  FREE_MODELS,
  DEFAULT_MODEL,
  SILICONFLOW_SIGNUP,
  SILICONFLOW_KEY_PAGE,
  SILICONFLOW_PRICING,
  clearRuntimeConfig,
  getRuntimeModel,
  hasRuntimeKey,
  setRuntimeConfig,
  snapshot,
  subscribe,
  testSiliconFlow,
} from '../agent/runtimeModel';
import { Modal } from './Modal';

interface ModelSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 运行时模型设置弹窗。
 *
 * 安全约定（与 runtimeModel.ts 一致）：
 * - 密钥输入框是受控的本地 state，组件关闭即随组件卸载消失；
 * - 提交后只写入 runtimeModel 的内存变量，不落任何 storage；
 * - 已配置时界面只显示「已接入 + 模型名」，绝不把密钥读回来显示。
 */
export function ModelSettingsModal({ open, onClose }: ModelSettingsModalProps) {
  // 订阅内存态，让「已接入」状态在 Header 与弹窗之间同步。
  useSyncExternalStore(subscribe, snapshot, () => 'off');

  const [key, setKey] = useState('');
  const [model, setModel] = useState(() => getRuntimeModel());
  const [custom, setCustom] = useState('');
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const connected = hasRuntimeKey();

  const activeModel = custom.trim() || model || DEFAULT_MODEL;

  const chooseModel = (id: string) => {
    setModel(id);
    setCustom('');
    setMessage('');
  };

  const handleUse = async () => {
    const value = key.trim();
    if (!value) {
      setMessage(COPY.modelNoKey);
      return;
    }
    setTesting(true);
    setMessage('');
    const result = await testSiliconFlow(value, activeModel);
    setTesting(false);
    if (!result.text) {
      setMessage(
        COPY.modelTestFail.replace('{reason}', result.error ?? '连接失败'),
      );
      return;
    }
    // 测试通过后才写内存；密钥只存在于模块变量里。
    setRuntimeConfig(value, activeModel);
    setKey(''); // 输入框立刻清空，页面上不再留有密钥明文。
    setSaved(true);
    setMessage(COPY.modelSaved);
  };

  const handleClear = () => {
    clearRuntimeConfig();
    setKey('');
    setCustom('');
    setModel(DEFAULT_MODEL);
    setSaved(false);
    setMessage('');
  };

  return (
    <Modal
      open={open}
      title={COPY.modelTitle}
      onClose={onClose}
      label="model-settings"
      footer={<p className="modal-foot-note">{COPY.sessionNote}</p>}
    >
      <p className="model-intro">{COPY.modelIntro}</p>

      <div className="model-status" aria-live="polite">
        <span className={`model-status-dot ${connected ? 'is-on' : ''}`} aria-hidden="true" />
        <span>{connected ? `${COPY.modelButtonOn} · ${getRuntimeModel()}` : '当前：山谷里备好的话'}</span>
      </div>

      <div className="model-steps">
        <h3>{COPY.modelStepTitle}</h3>
        <ol>
          <li>{COPY.modelStep1}</li>
          <li>{COPY.modelStep2}</li>
          <li>{COPY.modelStep3}</li>
        </ol>
        <div className="model-links">
          <a href={SILICONFLOW_SIGNUP} target="_blank" rel="noreferrer noopener">
            {COPY.modelSignup}
          </a>
          <a href={SILICONFLOW_KEY_PAGE} target="_blank" rel="noreferrer noopener">
            {COPY.modelKeyPage}
          </a>
          <a href={SILICONFLOW_PRICING} target="_blank" rel="noreferrer noopener">
            {COPY.modelPricing}
          </a>
        </div>
      </div>

      <label className="model-field">
        <span>{COPY.modelKeyLabel}</span>
        <input
          type="password"
          value={key}
          autoComplete="off"
          spellCheck={false}
          placeholder={COPY.modelKeyPlaceholder}
          onChange={(event) => {
            setKey(event.target.value);
            setSaved(false);
            setMessage('');
          }}
        />
      </label>

      <div className="model-field">
        <span>{COPY.modelChooseLabel}</span>
        <div className="model-options" role="group">
          {FREE_MODELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`model-option ${!custom && model === item.id ? 'is-on' : ''}`}
              aria-pressed={!custom && model === item.id}
              onClick={() => chooseModel(item.id)}
            >
              <strong>{item.label}</strong>
              <small>{item.note}</small>
            </button>
          ))}
        </div>
        <label className="model-custom">
          <span>{COPY.modelCustomLabel}</span>
          <input
            type="text"
            value={custom}
            autoComplete="off"
            spellCheck={false}
            placeholder={COPY.modelCustomPlaceholder}
            onChange={(event) => {
              setCustom(event.target.value);
              setSaved(false);
              setMessage('');
            }}
          />
        </label>
        <p className="model-free-note">{COPY.modelFreeNote}</p>
      </div>

      {message ? (
        <p className={`model-message ${saved ? 'is-ok' : ''}`} role="status">
          {message}
        </p>
      ) : null}

      <div className="model-actions">
        <button
          type="button"
          className="button primary"
          onClick={() => void handleUse()}
          disabled={testing}
        >
          {testing ? COPY.modelTesting : COPY.modelUse}
        </button>
        {connected ? (
          <button type="button" className="button ghost" onClick={handleClear}>
            {COPY.modelClear}
          </button>
        ) : null}
      </div>

      <div className="model-safety">
        <h3>{COPY.modelSafetyTitle}</h3>
        <p>{COPY.modelSafety}</p>
        <ul>
          {COPY.modelSafetyList.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
