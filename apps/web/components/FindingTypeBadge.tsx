'use client';

import type { CSSProperties } from 'react';
import { getFindingColor } from '@soteria/ui';
import { FINDING_TYPE_META, type FindingType } from '@soteria/core';
import { cn } from '@/lib/cn';

export interface FindingTypeBadgeProps {
  type: FindingType;
  /** Show the long label instead of the short code. */
  long?: boolean;
  className?: string;
}

/**
 * Badge for a finding type. The color is resolved by the design system's own
 * {@link getFindingColor} (token-derived, RULE 5) and the label by core's
 * {@link FINDING_TYPE_META} (RULE 4). It is applied via CSS custom properties so
 * the per-type semantic color stays data-driven rather than hardcoded.
 */
export function FindingTypeBadge({ type, long = false, className }: FindingTypeBadgeProps) {
  const meta = FINDING_TYPE_META[type];
  const color = getFindingColor(type);
  // Drive the badge color from the resolved token value. Using a CSS variable
  // keeps the value out of the className while still derived from design tokens.
  const style: CSSProperties = {
    color,
    backgroundColor: `${color}1A`, // ~10% alpha tint
    borderColor: `${color}4D`, // ~30% alpha border
  };

  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-sm py-0.5 text-xs font-semibold font-body',
        className,
      )}
      title={meta.description}
    >
      {long ? meta.label : meta.code}
    </span>
  );
}
