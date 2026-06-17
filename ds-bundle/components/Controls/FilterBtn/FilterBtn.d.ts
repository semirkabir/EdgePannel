import * as React from 'react';

export interface FilterBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Fills the button with the semantic-info accent colour */
  active?: boolean;
}

export declare function FilterBtn(props: FilterBtnProps): React.ReactElement;
