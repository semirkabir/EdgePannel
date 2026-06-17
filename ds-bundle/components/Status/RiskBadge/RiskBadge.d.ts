import * as React from 'react';

export type RiskLevel = 'low' | 'med' | 'high' | 'critical';

export interface RiskBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Severity level — drives background tint and text colour */
  level: RiskLevel;
}

export declare function RiskBadge(props: RiskBadgeProps): React.ReactElement;
