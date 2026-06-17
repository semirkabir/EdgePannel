# FilterBtn

Pill-shaped filter toggle. Used in horizontal scroll bars above data panels to let users select a category or impact level. Rounded (12 px radius), body-font, slightly larger than SysBtn.

## Usage

```jsx
import { FilterBtn } from '@ds/world-monitor';

// Filter bar — one active at a time
<div style={{ display: 'flex', gap: 6 }}>
  <FilterBtn active>All</FilterBtn>
  <FilterBtn>Politics</FilterBtn>
  <FilterBtn>Markets</FilterBtn>
  <FilterBtn>Energy</FilterBtn>
  <FilterBtn>Security</FilterBtn>
</div>
```

## Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `active` | boolean | false | Fills with `--semantic-info` blue |
| All `<button>` attrs | — | — | `onClick`, `disabled`, etc. |

## Styling idiom

Wrap a row of FilterBtns in a `div` with `display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none`. Use exactly one `active` at a time (or zero for a deselected state). Do not use FilterBtn for actions — use SysBtn instead.
