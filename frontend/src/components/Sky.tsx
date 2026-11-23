interface SkyProps {
  idle?: boolean;
}

export function Sky({ idle = false }: SkyProps) {
  return (
    <div className={`sky ${idle ? 'is-idle' : ''}`} aria-hidden="true">
      <div className="mist mist-a" />
      <div className="mist mist-b" />
      <svg
        className="mountains"
        viewBox="0 0 1440 520"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 380c120-58 214-30 318-88 92-51 134-128 236-130 82-2 126 52 196 96 82 52 158 40 262 8 112-34 198-98 428-54v308H0Z"
          fill="var(--mountain-far)"
        />
        <path
          d="M0 446c138-38 236-6 350-62 100-49 172-124 280-110 90 12 132 82 224 100 118 24 206-48 336-34 98 10 174 50 250 88v92H0Z"
          fill="var(--mountain-mid)"
        />
        <path
          d="M0 492c170-30 262 12 398-24 124-33 208-86 326-66 106 18 160 72 292 66 136-6 246-58 424-34v86H0Z"
          fill="var(--mountain-near)"
        />
      </svg>
      <div className="grain" />
    </div>
  );
}
