'use client';

// Curated positions (not computed from trig) tracing a single arc above the bridge, clear of
// the two island labels below — each also carries a static translateZ for depth (closer to the
// bridge's peak = more "in front") layered under the float bob animation.
const ORBIT_ITEMS: { emoji: string; top: string; left: string; z: number; delay: string }[] = [
  { emoji: '⚽', top: '34%', left: '20%', z: 10, delay: '0s' },
  { emoji: '🎬', top: '13%', left: '32%', z: 22, delay: '0.5s' },
  { emoji: '📺', top: '0%', left: '44%', z: 30, delay: '1s' },
  { emoji: '🎮', top: '0%', left: '56%', z: 30, delay: '1.6s' },
  { emoji: '🎧', top: '13%', left: '68%', z: 22, delay: '0.8s' },
  { emoji: '🚗', top: '34%', left: '80%', z: 10, delay: '2.1s' }
];

/**
 * The literal brand metaphor, rendered: a hard concept on one side, something you actually
 * love on the other, a single bridge between them — with the category icons that could form
 * that bridge orbiting around it. This is what the product does, shown instead of described.
 */
export function BridgeHero() {
  return (
    <div className="relative mx-auto mt-4 h-[220px] w-full max-w-2xl select-none md:h-[300px]" style={{ perspective: '1200px' }}>
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {ORBIT_ITEMS.map((item, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ top: item.top, left: item.left, transform: `translateZ(${item.z}px)` }}
          >
            <div
              className="animate-float flex h-10 w-10 items-center justify-center rounded-2xl border border-ink-100 bg-surface/90 text-lg shadow-card backdrop-blur md:h-12 md:w-12 md:text-xl"
              style={{ animationDelay: item.delay }}
            >
              {item.emoji}
            </div>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 400 200" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="bridge-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff3b4c" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#ff3b4c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff3b4c" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <path d="M 100 110 Q 200 40 300 110" stroke="url(#bridge-gradient)" strokeWidth="2" strokeDasharray="5 7" />
        <circle r="4.5" fill="#ff3b4c">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M 100 110 Q 200 40 300 110" />
        </circle>
        <circle r="9" fill="#ff3b4c" opacity="0.35">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M 100 110 Q 200 40 300 110" />
          <animate attributeName="r" values="6;11;6" dur="1.3s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="absolute right-[4%] top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 md:right-[8%]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-100 bg-surface text-2xl shadow-glow md:h-16 md:w-16 md:text-3xl">
          📚
        </div>
        <span className="text-xs font-bold text-ink-500">مفهوم صعب</span>
      </div>
      <div className="absolute left-[4%] top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 md:left-[8%]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-300/40 bg-surface text-2xl shadow-glow md:h-16 md:w-16 md:text-3xl">
          ❤️
        </div>
        <span className="text-xs font-bold text-ink-500">شي تحبه</span>
      </div>
    </div>
  );
}
