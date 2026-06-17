import * as React from 'react';

export interface SysBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Highlights the button — used for active toggles or selected state */
  active?: boolean;
  /** Removes padding and fixes width to 24 px — for icon-only buttons */
  iconOnly?: boolean;
}

export declare function SysBtn(props: SysBtnProps): React.ReactElement;
