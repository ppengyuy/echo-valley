import type { StoneType } from '../types';

interface StonePebbleProps {
  /** 0–7，对应 8 款预置形状，不随机生成。 */
  shape: number;
  type: StoneType;
  size?: number;
  lit?: boolean;
}

/** 8 款预置的不规则椭圆；方法类边缘稍硬朗（折线），触动类更圆润（曲线）。 */
const SHAPES = [
  'M23 5 34 8 41 17 39 29 30 39 17 40 7 31 5 18 12 9Z',
  'M24 6 36 10 40 22 34 35 22 40 10 34 6 21 12 10Z',
  'M22 6 33 7 42 16 40 28 31 39 18 40 8 32 5 19 11 10Z',
  'M25 5 37 11 39 24 32 37 19 40 8 33 6 20 14 9Z',
  'M21 7 32 6 41 15 41 27 33 38 20 40 9 33 6 20 13 11Z',
  'M24 6 35 9 40 20 37 32 27 40 15 38 7 28 8 16 15 8Z',
  'M22 5 34 8 41 18 38 30 29 39 16 39 7 30 6 17 13 9Z',
  'M26 6 37 12 39 25 31 37 18 39 9 31 6 19 14 10Z',
];

const ROUNDED = [
  'M23 5C33 5 41 11 41 21c0 11-9 19-20 19S5 32 5 22C5 12 13 5 23 5Z',
  'M24 6c11 0 17 8 16 18S30 41 21 40 6 33 6 22C6 12 15 6 24 6Z',
  'M22 6c11-1 20 6 20 16s-9 18-21 18S5 31 5 20C5 11 13 7 22 6Z',
  'M25 5c11 0 15 9 14 19s-10 16-21 16S6 31 6 20C6 10 15 5 25 5Z',
  'M21 7c11-1 20 5 20 15s-9 18-21 18S5 31 5 20C5 11 13 8 21 7Z',
  'M24 6c11 0 16 7 16 17s-9 17-20 17S6 30 7 19C8 11 15 6 24 6Z',
  'M22 5c11 0 19 6 19 16s-9 19-21 18S5 31 5 20C5 11 13 5 22 5Z',
  'M26 6c10 0 14 8 13 18s-10 16-21 15S6 31 6 20C6 11 16 6 26 6Z',
];

/** 稳定地把 id 映射到 0–7，不用随机数，形状每次一致。 */
export function shapeFor(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum = (sum * 31 + id.charCodeAt(i)) % 997;
  return sum % 8;
}

export function StonePebble({ shape, type, size = 38, lit = false }: StonePebbleProps) {
  const index = Math.max(0, Math.min(7, shape));
  const path = type === 'method' ? SHAPES[index] : ROUNDED[index];
  return (
    <svg
      className={`stone-pebble ${type} ${lit ? 'is-lit' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 46 46"
      fill="none"
      aria-hidden="true"
    >
      <path d={path} className="stone-pebble-fill" />
      <path d={path} className="stone-pebble-line" />
    </svg>
  );
}
