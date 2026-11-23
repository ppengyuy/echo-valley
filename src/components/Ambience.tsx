import type { Season } from '../types';

interface AmbienceProps {
  season: Season;
  reduced: boolean;
}

/** 低密度花瓣：只在春天出现，数量很少，不参与任何交互。 */
export function Petals({ season, reduced }: { season: Season; reduced: boolean }) {
  if (season !== 'spring' || reduced) return null;

  const petals = [
    { left: 12, delay: 0, duration: 26 },
    { left: 28, delay: 7, duration: 32 },
    { left: 46, delay: 3, duration: 29 },
    { left: 63, delay: 12, duration: 35 },
    { left: 78, delay: 5, duration: 27 },
    { left: 90, delay: 17, duration: 33 },
  ];

  return (
    <div className="petals" aria-hidden="true">
      {petals.map((petal) => (
        <span
          key={petal.left}
          className="petal"
          style={{
            left: `${petal.left}%`,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Ambience({ season, reduced }: AmbienceProps) {
  if (reduced) return null;
  return <Petals season={season} reduced={reduced} />;
}
