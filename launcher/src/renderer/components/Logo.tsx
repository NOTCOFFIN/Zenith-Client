export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="logo">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <defs>
          <linearGradient id="zg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3d8bff" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path d="M24 3 44 40H4z" fill="none" stroke="url(#zg)" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M16 22h16L16 34h16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="logo-text">
        <strong>ZENITH</strong>
        <span>CLIENT</span>
      </div>
    </div>
  );
}
