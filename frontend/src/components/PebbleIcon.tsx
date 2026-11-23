interface PebbleIconProps {
  size?: number;
  className?: string;
}

/** 一颗小石子：捡起来 / 捡到一句话两处共用的图标，让入口一眼看出属于溪滩。 */
export function PebbleIcon({ size = 14, className = '' }: PebbleIconProps) {
  return (
    <svg
      className={`pebble-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 4.4C4.8 3 7.9 2.4 9.9 3.4c1.9 1 3.1 3.2 2.8 5.3-.3 2.1-2 3.9-4.2 4.1-2.1.2-4.2-1.1-4.9-3.1-.7-2-.9-4.3-.1-5.3Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 6c.9-.6 2.3-.8 3.3-.3"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
