interface FatorXLogoProps {
  className?: string;
  size?: number;
}

export function FatorXLogo({ className = "", size = 24 }: FatorXLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Outer X shape with rounded terminals */}
      <path
        d="M7.5 5L16 16m0 0L24.5 27M16 16L24.5 5M16 16L7.5 27"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central node / nexus point */}
      <circle cx="16" cy="16" r="3.5" fill="currentColor" opacity="0.9" />
      {/* Orbital dots — representing agents */}
      <circle cx="7.5" cy="5" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="24.5" cy="5" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="7.5" cy="27" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="24.5" cy="27" r="2" fill="currentColor" opacity="0.7" />
      {/* Pulse ring */}
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
    </svg>
  );
}
