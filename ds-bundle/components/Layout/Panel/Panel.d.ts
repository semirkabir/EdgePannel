import * as React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Panel header title — rendered in mono uppercase */
  title?: string;
  /** Right-side header actions (typically SysBtn elements) */
  actions?: React.ReactNode;
}

export declare function Panel(props: PanelProps): React.ReactElement;
