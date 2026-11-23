import { Fox } from './Fox';

export function RippleOverlay({ text }: { text: string }) {
  return (
    <div className="ripple-overlay" aria-hidden="true">
      <div className="ripple-rings">
        <span />
        <span />
        <span />
        <span />
      </div>
      <Fox className="ripple-fox" nodKey={1} wagKey={1} />
      <span className="ripple-kicker">山谷收下了</span>
      <p>{text}</p>
    </div>
  );
}
