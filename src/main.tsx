import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ValleyProvider } from './store';
import './styles.css';

// 开发态的错误提示：外部浏览器里如果按钮点了没反应，至少能看到出错的原文。
// 正式构建不会出现这段。
if (import.meta.env.DEV) {
  const showNotice = (text: string) => {
    let el = document.getElementById('runtime-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'runtime-notice';
      el.setAttribute('role', 'status');
      el.style.cssText = [
        'position:fixed',
        'left:16px',
        'right:16px',
        'bottom:16px',
        'z-index:9999',
        'padding:10px 14px',
        'border:1px solid #c9d3c7',
        'border-radius:12px',
        'background:#f7faf4',
        'color:#4a5a4c',
        'font:12px/1.6 system-ui,sans-serif',
        'box-shadow:0 8px 30px rgba(0,0,0,.08)',
        'white-space:pre-wrap',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = `页面遇到一点问题：${text}\n刷新一下再试；如果反复出现，把这句话发给我。`;
  };

  window.addEventListener('error', (event) => showNotice(event.message || '未知错误'));
  window.addEventListener('unhandledrejection', (event) => {
    showNotice(String(event.reason ?? '未知错误'));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ValleyProvider>
      <App />
    </ValleyProvider>
  </StrictMode>,
);
