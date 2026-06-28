import type { SVGProps } from 'react';

export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'> {
  /** Rendered shield height in px. Width scales to the 34:38 artwork ratio. */
  size?: number;
}

/**
 * Soteria Assurance brand mark — a deep-navy certification shield with a gold
 * check and a faint second tick, taken verbatim from the design canvas
 * (docs/design-system/soteria-assurance-screens.html). The shield fill
 * (#0A2647) and gold strokes (#C9A84C) are brand-mark literals from the design
 * system, not theme surfaces, so they intentionally render the logo at any size.
 */
export function Logo({ size = 28, className, ...rest }: LogoProps) {
  const width = (size * 34) / 38;
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 34 38"
      fill="none"
      role="img"
      aria-label="Soteria Assurance"
      className={className}
      {...rest}
    >
      <path
        d="M17 2 31 7.4v9.8c0 8.7-5.9 15.6-14 18.4C8.9 32.8 3 25.9 3 17.2V7.4L17 2Z"
        fill="#0A2647"
        stroke="#C9A84C"
        strokeWidth="1.8"
      />
      <path
        d="M10 18.6 14.8 23.4 24.4 12"
        stroke="#C9A84C"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 13.2 12.8 16"
        stroke="#C9A84C"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
