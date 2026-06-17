import * as React from 'react';

export type StatusChipVariant = 'live' | 'info' | 'elevated' | 'critical' | 'neutral';

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic color variant */
  variant?: StatusChipVariant;
}

export declare function StatusChip(props: StatusChipProps): React.ReactElement;
