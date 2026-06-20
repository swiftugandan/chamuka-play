type Mood = "happy" | "cheer";

/**
 * Mishi — the Chamuka Play mascot. A friendly blob-buddy with a star antenna.
 * Rendered as inline SVG so it stays crisp at any size and needs no assets.
 */
export function Mascot({
  size = 80,
  mood = "happy",
  className,
}: {
  size?: number;
  mood?: Mood;
  className?: string;
}) {
  const gradientId = `mishi-body-${mood}`;
  const isCheer = mood === "cheer";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 150 150"
      fill="none"
      className={className}
      role="img"
      aria-label="Mishi the game buddy"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a06bff" />
          <stop offset="1" stopColor="#7a3cf0" />
        </linearGradient>
      </defs>

      {/* antenna + star */}
      <line
        x1="75"
        y1="34"
        x2="75"
        y2="14"
        stroke="#7a3cf0"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M75 2 l5 9 10 1 -7 8 2 10 -10 -5 -10 5 2 -10 -7 -8 10 -1Z"
        fill="#ffc233"
      />

      {/* arms */}
      {isCheer ? (
        <>
          <path
            d="M26 92 q-16 -6 -20 -24"
            stroke="#5b23c2"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="M124 92 q16 -6 20 -24"
            stroke="#5b23c2"
            strokeWidth="11"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M24 96 q-14 6 -16 22"
            stroke="#5b23c2"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="M126 96 q14 6 16 22"
            stroke="#5b23c2"
            strokeWidth="11"
            strokeLinecap="round"
          />
        </>
      )}

      {/* body */}
      <path
        d="M75 30 C40 30 26 56 26 86 C26 118 48 138 75 138 C102 138 124 118 124 86 C124 56 110 30 75 30Z"
        fill={`url(#${gradientId})`}
      />

      {/* eyes */}
      <ellipse cx="56" cy="74" rx="14" ry="16" fill="#fff" />
      <ellipse cx="94" cy="74" rx="14" ry="16" fill="#fff" />
      <circle cx="58" cy="77" r="6.5" fill="#2b1454" />
      <circle cx="92" cy="77" r="6.5" fill="#2b1454" />
      <circle cx="55" cy="74" r="2.2" fill="#fff" />
      <circle cx="89" cy="74" r="2.2" fill="#fff" />

      {/* cheeks */}
      <circle cx="44" cy="98" r="7" fill="#ff7fb8" opacity="0.7" />
      <circle cx="106" cy="98" r="7" fill="#ff7fb8" opacity="0.7" />

      {/* mouth */}
      {isCheer ? (
        <path d="M58 86 q17 26 34 0 q-17 10 -34 0Z" fill="#3a1c6e" />
      ) : (
        <path
          d="M60 84 q15 16 30 0"
          stroke="#3a1c6e"
          strokeWidth="6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
