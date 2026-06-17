import * as React from 'react';

export interface PanelTabsProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface PanelTabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Underline indicator + accent colour */
  active?: boolean;
  /** Emoji or icon string rendered at 12 px before the label */
  icon?: string;
  /** Tab label text */
  label?: string;
}

export declare function PanelTabs(props: PanelTabsProps): React.ReactElement;
export declare function PanelTab(props: PanelTabProps): React.ReactElement;
